/* modules/institutional/institutional.js
   ANÁLISIS INSTITUCIONAL — el 4º servicio del área de Análisis.

   Terminal de mesa institucional reescrito en vanilla con la identidad de
   DecFreedom. Se APALANCA en los dos repos aportados: el motor de gráficas es
   lightweight-charts de TradingView (Apache-2.0, vendido en ./vendor) y la
   matemática de indicadores + el mapa de fuentes de datos vienen de
   OpenTerminal (MIT), reimplementados. Datos en vivo del lado del cliente sobre
   fuentes públicas con CORS (Binance, CoinGecko, alternative.me).

   Dinámica de la casa: botón Back clásico (no X), temporalidades e indicadores
   en POPUP (como el resto de secciones), paneles que se mueven y se redimensionan,
   y NUESTRA marca de agua en la gráfica (el logo de TradingView va desactivado).

   Entrada única:  import { abrirInstitutional } from '.../institutional.js';
*/

import { estilos } from './estilos.js?v=2';
import * as D from './datos.js?v=2';
import { sma, ema, vwap, rsi, macd, bollinger, stochastic, atr, cci, williams, obv, roc, donchian, keltner, supertrend } from './indicadores.js?v=2';

const LOGO = 'assets/img/cco-full.webp';
const SELLO = 'assets/portada/red/disclaimer.webp';
const DISC_KEY = 'it-disclaimer-ok';
const LAYOUT_KEY = 'it-layout-v1';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ── Formato ── */
function fmtP(p) {
  if (!(p > 0)) return '—';
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(8);
}
function fmtPct(v) { return (v > 0 ? '+' : '') + (v == null ? '—' : v.toFixed(2)) + '%'; }
function fmtBig(v) {
  if (v == null) return '—';
  const a = Math.abs(v);
  if (a >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(0);
}
const cls = (v) => v > 0 ? 'up' : v < 0 ? 'down' : 'dim';
const $ = (sel, root) => (root || document).querySelector(sel);

/* Catálogo de indicadores. tipo: overlay (sobre el precio) | pane (panel propio). */
const INDS = [
  { k: 'SMA',   nm: 'SMA 20',       tipo: 'overlay' },
  { k: 'EMA',   nm: 'EMA 50',       tipo: 'overlay' },
  { k: 'VWAP',  nm: 'VWAP',         tipo: 'overlay' },
  { k: 'BOLL',  nm: 'Bollinger',    tipo: 'overlay' },
  { k: 'DONCH', nm: 'Donchian',     tipo: 'overlay' },
  { k: 'KELT',  nm: 'Keltner',      tipo: 'overlay' },
  { k: 'ST',    nm: 'Supertrend',   tipo: 'overlay' },
  { k: 'RSI',   nm: 'RSI 14',       tipo: 'pane' },
  { k: 'MACD',  nm: 'MACD',         tipo: 'pane' },
  { k: 'STOCH', nm: 'Stochastic',   tipo: 'pane' },
  { k: 'ATR',   nm: 'ATR 14',       tipo: 'pane' },
  { k: 'CCI',   nm: 'CCI 20',       tipo: 'pane' },
  { k: 'WILL',  nm: 'Williams %R',  tipo: 'pane' },
  { k: 'OBV',   nm: 'OBV',          tipo: 'pane' },
  { k: 'ROC',   nm: 'ROC 12',       tipo: 'pane' }
];

/* Carga perezosa del motor de gráficas (UMD → window.LightweightCharts). */
function cargarLWC() {
  if (window.LightweightCharts) return Promise.resolve();
  return new Promise((res, rej) => {
    let sc = document.getElementById('it-lwc');
    if (sc) { sc.addEventListener('load', () => res()); sc.addEventListener('error', () => rej(new Error('lwc'))); return; }
    sc = document.createElement('script');
    sc.id = 'it-lwc';
    sc.src = new URL('./vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
    sc.onload = () => res();
    sc.onerror = () => rej(new Error('lwc'));
    document.head.appendChild(sc);
  });
}

const S = {
  par: null, tf: '1h',
  ind: { SMA: true },
  velas: [], chart: null, serieVela: null, serieVol: null,
  refQuote: null, refBoard: null, reloj: null, cargandoChart: false,
  layout: null, onResize: null
};

const LISTA_WATCH = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'LTC', 'DOT', 'TRX'];

export async function abrirInstitutional() {
  estilos();
  const prev = document.getElementById('it-overlay'); if (prev) prev.remove();
  S.par = D.PARES.find((p) => p.id === 'BTC') || D.PARES[0];
  cargarLayout();

  const ov = document.createElement('div');
  ov.id = 'it-overlay';
  ov.innerHTML = plantilla();
  document.body.appendChild(ov);

  cablearTop(ov);
  cablearChartBar(ov);
  montarDragResize();
  aplicarLayout();
  S.onResize = () => aplicarLayout();
  window.addEventListener('resize', S.onResize);
  mostrarDisclaimer(false);

  try { await cargarLWC(); } catch (_) {}
  await cargarChart();
  cargarQuote(); cargarWatch(); cargarBoard(); cargarMacro(); tic();

  S.refQuote = setInterval(() => { cargarQuote(); cargarWatch(); }, 5000);
  S.refBoard = setInterval(() => { cargarBoard(); cargarMacro(); }, 30000);
  S.reloj = setInterval(tic, 1000);
}

function cerrar() {
  clearInterval(S.refQuote); clearInterval(S.refBoard); clearInterval(S.reloj);
  if (S.onResize) window.removeEventListener('resize', S.onResize);
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  S.chart = null;
  const ov = document.getElementById('it-overlay'); if (ov) ov.remove();
}

/* ── Plantilla ── */
function plantilla() {
  const icoSearch = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  const back = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  const reset = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
  return `
  <div class="it-top">
    <button class="it-back" id="it-back" aria-label="Back">${back}Back</button>
    <div class="it-sep"></div>
    <b class="it-title">INSTITUTIONAL ANALYSIS</b>
    <div class="it-status"><span class="it-dot"></span> MARKETS OPEN · 24/7</div>
    <div class="it-clock" id="it-clock">—</div>
    <div class="it-search">
      ${icoSearch}
      <input id="it-q" type="text" autocomplete="off" placeholder="Search symbol — BTC, ETH, SOL…">
      <span class="it-kbd">↵</span>
      <div class="it-sug" id="it-sug" style="display:none"></div>
    </div>
    <div class="it-top-r">
      <div class="it-fng" id="it-fng-top"></div>
      <button class="it-ico" id="it-reset" title="Reset layout">${reset}</button>
    </div>
  </div>

  <div class="it-grid" id="it-grid">
    <div class="it-panel" id="it-p-chart">
      <div class="it-ph"><h4 id="it-chart-title">CHART</h4><div class="it-ph-r" id="it-chart-meta"></div><span class="it-grip"></span></div>
      <div class="it-pb"><div class="it-chart-body">
        <div class="it-chart-bar" id="it-chart-bar"></div>
        <div class="it-cv" id="it-cv"><div class="it-legend" id="it-legend"></div></div>
      </div></div>
      <span class="it-resize" data-rz></span>
    </div>

    <div class="it-panel" id="it-p-quote">
      <div class="it-ph"><h4 id="it-quote-title">QUOTE</h4><span class="it-grip"></span></div>
      <div class="it-pb" id="it-quote-body">${cargando()}</div>
      <span class="it-resize" data-rz></span>
    </div>

    <div class="it-panel" id="it-p-watch">
      <div class="it-ph"><h4>WATCHLIST</h4><span class="it-grip"></span></div>
      <div class="it-pb" id="it-watch-body">${cargando()}</div>
      <span class="it-resize" data-rz></span>
    </div>

    <div class="it-panel" id="it-p-board">
      <div class="it-ph"><h4>MARKET HEATMAP</h4><div class="it-ph-r dim" style="font-family:var(--it-mono);font-size:10px">24H %</div><span class="it-grip"></span></div>
      <div class="it-pb" id="it-board-body">${cargando()}</div>
      <span class="it-resize" data-rz></span>
    </div>

    <div class="it-panel" id="it-p-macro">
      <div class="it-ph"><h4>MACRO</h4><span class="it-grip"></span></div>
      <div class="it-pb" id="it-macro-body">${cargando()}</div>
      <span class="it-resize" data-rz></span>
    </div>
  </div>

  <div class="it-foot">
    <div>DecFreedom · Institutional Analysis — <a href="https://decfreedom.com" target="_blank" rel="noopener">decfreedom.com</a></div>
    <div>Live technical analysis · <button class="it-disc-link" id="it-disc-link" type="button">Disclaimer</button> · not financial advice</div>
  </div>`;
}

function cargando() { return '<div class="it-empty"><div class="it-spin"></div><span>Loading…</span></div>'; }
function vacio(txt) {
  return `<div class="it-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 2 5-6"/></svg><b>No data</b><span>${esc(txt || '')}</span></div>`;
}
function marca() {
  return `<div class="it-wm" aria-hidden="true"><img src="${LOGO}" alt="" onerror="this.style.display='none'"><span>DecFreedom</span></div>`;
}

/* ── Barra superior ── */
function tic() {
  const c = document.getElementById('it-clock');
  if (!c) return;
  const off = -new Date().getTimezoneOffset() / 60;
  c.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC' + (off >= 0 ? '+' : '') + off;
}

function cablearTop(ov) {
  $('#it-back', ov).onclick = cerrar;
  $('#it-reset', ov).onclick = () => { S.layout = null; try { localStorage.removeItem(LAYOUT_KEY); } catch (_) {} aplicarLayout(); };
  $('#it-disc-link', ov).onclick = () => mostrarDisclaimer(true);

  const inp = $('#it-q', ov), sug = $('#it-sug', ov);
  let idx = -1, lista = [];
  const pintar = () => {
    const q = inp.value.trim().toLowerCase();
    lista = !q ? [] : D.PARES.filter((p) => p.id.toLowerCase().includes(q) || (p.n || '').toLowerCase().includes(q)).slice(0, 8);
    if (!lista.length) { sug.style.display = 'none'; return; }
    sug.innerHTML = lista.map((p, i) => `<button data-i="${i}" class="${i === idx ? 'on' : ''}"><b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`).join('');
    sug.style.display = '';
    sug.querySelectorAll('button').forEach((b) => b.onclick = () => elegir(lista[+b.dataset.i]));
  };
  const elegir = (p) => { if (!p) return; sug.style.display = 'none'; inp.value = ''; idx = -1; setSimbolo(p); };
  inp.addEventListener('input', () => { idx = -1; pintar(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { idx = Math.min(lista.length - 1, idx + 1); pintar(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); pintar(); e.preventDefault(); }
    else if (e.key === 'Enter') { elegir(lista[idx >= 0 ? idx : 0]); }
    else if (e.key === 'Escape') { sug.style.display = 'none'; }
  });
  document.addEventListener('click', (e) => { const s = $('.it-search', ov); if (s && !s.contains(e.target)) sug.style.display = 'none'; });
}

function setSimbolo(par) {
  if (!par || par.id === (S.par && S.par.id)) return;
  S.par = par;
  cargarChart(); cargarQuote();
  document.querySelectorAll('#it-watch-body tr, #it-board-body .it-tile').forEach((el) => el.classList.remove('on'));
}

/* ── Barra del chart: TF e indicadores en POPUP (dinámica de la casa) ── */
function cablearChartBar(ov) {
  const bar = $('#it-chart-bar', ov);
  const nActivos = Object.values(S.ind).filter(Boolean).length;
  const tfNm = (D.TFS.find((t) => t.id === S.tf) || {}).n || S.tf;
  bar.innerHTML = `
    <button class="it-chip it-drop" id="it-tf-btn">${esc(tfNm)} <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>
    <button class="it-chip it-drop" id="it-in-btn">Indicators${nActivos ? ' · ' + nActivos : ''} <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>`;
  $('#it-tf-btn', ov).onclick = (e) => { e.stopPropagation(); menuTf(); };
  $('#it-in-btn', ov).onclick = (e) => { e.stopPropagation(); menuInd(); };
}

function cerrarPopups() { document.querySelectorAll('.it-pop').forEach((x) => x.remove()); }

function menuTf() {
  const ancla = document.getElementById('it-tf-btn');
  if (document.getElementById('it-tfmenu')) { cerrarPopups(); return; }
  cerrarPopups();
  const m = document.createElement('div');
  m.className = 'it-pop it-tfmenu'; m.id = 'it-tfmenu';
  m.innerHTML = D.TFS.map((t) => `<button type="button" class="it-tf-it ${t.id === S.tf ? 'on' : ''}" data-tf="${t.id}">${esc(t.n)}</button>`).join('');
  document.body.appendChild(m);
  posicionar(m, ancla);
  m.querySelectorAll('.it-tf-it').forEach((b) => b.onclick = () => {
    S.tf = b.dataset.tf; cerrarPopups();
    const bar = document.getElementById('it-chart-bar'); if (bar) cablearChartBar(document);
    cargarChart();
  });
  cierreFuera(m, ancla);
}

function menuInd() {
  const ancla = document.getElementById('it-in-btn');
  if (document.getElementById('it-inmenu')) { cerrarPopups(); return; }
  cerrarPopups();
  const m = document.createElement('div');
  m.className = 'it-pop it-inmenu'; m.id = 'it-inmenu';
  const grupo = (titulo, arr) => `<div class="it-pop-tit">${titulo}</div>` + arr.map((it) =>
    `<button type="button" class="it-in-it ${S.ind[it.k] ? 'on' : ''}" data-k="${it.k}"><span class="it-in-ck">${S.ind[it.k] ? '✓' : ''}</span>${esc(it.nm)}</button>`).join('');
  m.innerHTML = grupo('Overlays', INDS.filter((i) => i.tipo === 'overlay')) + grupo('Oscillators', INDS.filter((i) => i.tipo === 'pane'));
  document.body.appendChild(m);
  posicionar(m, ancla);
  m.querySelectorAll('.it-in-it').forEach((b) => b.onclick = () => {
    const k = b.dataset.k; S.ind[k] = !S.ind[k];
    b.classList.toggle('on', S.ind[k]); b.querySelector('.it-in-ck').textContent = S.ind[k] ? '✓' : '';
    const btn = document.getElementById('it-in-btn'); const n = Object.values(S.ind).filter(Boolean).length;
    if (btn) btn.childNodes[0].nodeValue = 'Indicators' + (n ? ' · ' + n : '') + ' ';
    pintarChart();
  });
  cierreFuera(m, ancla);
}

function posicionar(m, ancla) {
  const r = ancla.getBoundingClientRect();
  const w = m.offsetWidth || 200;
  m.style.top = (r.bottom + 6) + 'px';
  m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
}
function cierreFuera(m, ancla) {
  const fn = (ev) => { if (!m.contains(ev.target) && ev.target !== ancla && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('click', fn); } };
  setTimeout(() => document.addEventListener('click', fn), 10);
}

/* ── CHART ── */
async function cargarChart() {
  if (S.cargandoChart) return;
  S.cargandoChart = true;
  const title = document.getElementById('it-chart-title');
  if (title) title.textContent = 'CHART · ' + S.par.id + 'USD';
  try {
    S.velas = await D.velas(S.par.s, S.tf, 500);
  } catch (_) {
    S.velas = [];
    const cv = document.getElementById('it-cv');
    if (cv) cv.innerHTML = '<div class="it-legend" id="it-legend"></div>' + vacio('Could not reach the market data feed. Retry in a moment.');
    S.cargandoChart = false; return;
  }
  pintarChart();
  S.cargandoChart = false;
}

function pintarChart() {
  if (!window.LightweightCharts || !S.velas.length) return;
  const LC = window.LightweightCharts;
  const cv = document.getElementById('it-cv'); if (!cv) return;
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  cv.innerHTML = '<div class="it-legend" id="it-legend"></div>' + marca();

  const chart = LC.createChart(cv, {
    autoSize: true,
    localization: { locale: 'en' },
    layout: { background: { color: 'transparent' }, textColor: '#7d8794', fontFamily: '"Chakra Petch", ui-monospace, monospace', attributionLogo: false, panes: { separatorColor: '#232b35' } },
    grid: { vertLines: { color: 'rgba(35,43,53,.45)' }, horzLines: { color: 'rgba(35,43,53,.45)' } },
    rightPriceScale: { borderColor: '#232b35' },
    timeScale: { borderColor: '#232b35', timeVisible: true, secondsVisible: false },
    crosshair: {
      mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0,
      vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' },
      horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' }
    }
  });
  S.chart = chart;
  const V = S.velas;

  const vela = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e' });
  vela.setData(V.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
  S.serieVela = vela;

  const vol = chart.addSeries(LC.HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } });
  vol.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
  vol.setData(V.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(46,232,106,.28)' : 'rgba(255,91,110,.28)' })));
  S.serieVol = vol;

  const refs = [];
  const linea = (nm, pts, color, pane, w) => {
    if (!pts || !pts.length) return null;
    const s = chart.addSeries(LC.LineSeries, { color, lineWidth: w || 1, priceLineVisible: false, lastValueVisible: false }, pane || 0);
    s.setData(pts.map((p) => ({ time: p.time, value: p.value })));
    if (nm) refs.push({ nm, serie: s, color });
    return s;
  };

  // Overlays sobre el precio
  if (S.ind.SMA) linea('SMA 20', sma(V, 20), '#E8B84B');
  if (S.ind.EMA) linea('EMA 50', ema(V, 50), '#4aa3ff');
  if (S.ind.VWAP) linea('VWAP', vwap(V), '#c678dd');
  if (S.ind.BOLL) { const b = bollinger(V, 20, 2); linea('Bollinger', b.middle, 'rgba(150,160,175,.55)'); linea(null, b.upper, 'rgba(120,180,255,.6)'); linea(null, b.lower, 'rgba(120,180,255,.6)'); }
  if (S.ind.DONCH) { const d = donchian(V, 20); linea('Donchian', d.upper, 'rgba(232,184,75,.6)'); linea(null, d.lower, 'rgba(232,184,75,.6)'); }
  if (S.ind.KELT) { const k = keltner(V, 20, 2); linea('Keltner', k.upper, 'rgba(198,120,221,.55)'); linea(null, k.middle, 'rgba(198,120,221,.3)'); linea(null, k.lower, 'rgba(198,120,221,.55)'); }
  if (S.ind.ST) linea('Supertrend', supertrend(V, 10, 3), '#2ee86a', 0, 2);

  // Osciladores en panel propio
  let pane = 1;
  const abrirPane = () => { const p = pane; pane++; try { const panes = chart.panes(); if (panes[p]) panes[p].setHeight(84); } catch (_) {} return p; };
  if (S.ind.RSI) { const p = abrirPane(); linea('RSI 14', rsi(V, 14), '#E8B84B', p); }
  if (S.ind.MACD) {
    const p = abrirPane(); const m = macd(V);
    chart.addSeries(LC.HistogramSeries, {}, p).setData(m.histogram.map((x) => ({ time: x.time, value: x.value, color: x.value >= 0 ? 'rgba(46,232,106,.5)' : 'rgba(255,91,110,.5)' })));
    linea('MACD', m.macd, '#E8B84B', p); linea(null, m.signal, '#ffffff', p);
  }
  if (S.ind.STOCH) { const p = abrirPane(); const st = stochastic(V); linea('Stoch %K', st.k, '#E8B84B', p); linea('%D', st.d, '#4aa3ff', p); }
  if (S.ind.ATR) { const p = abrirPane(); linea('ATR 14', atr(V, 14), '#c678dd', p); }
  if (S.ind.CCI) { const p = abrirPane(); linea('CCI 20', cci(V, 20), '#4aa3ff', p); }
  if (S.ind.WILL) { const p = abrirPane(); linea('Williams %R', williams(V, 14), '#E8B84B', p); }
  if (S.ind.OBV) { const p = abrirPane(); linea('OBV', obv(V), '#2ee86a', p); }
  if (S.ind.ROC) { const p = abrirPane(); linea('ROC 12', roc(V, 12), '#ff9f43', p); }

  chart.timeScale().fitContent();
  chart.subscribeCrosshairMove((param) => {
    const vd = (param && param.seriesData) ? param.seriesData.get(S.serieVela) : null;
    pintarLegend(refs, vd || V[V.length - 1], param);
  });
  pintarLegend(refs, V[V.length - 1]);
}

function pintarLegend(refs, ohlc, param) {
  const el = document.getElementById('it-legend'); if (!el || !ohlc) return;
  const o = ohlc.open, h = ohlc.high, l = ohlc.low, c = ohlc.close;
  const col = c >= o ? '#2ee86a' : '#ff5b6e';
  const tf = (D.TFS.find((t) => t.id === S.tf) || {}).n || S.tf;
  let html = `<div class="nm">${esc(S.par.id)}USD <span style="color:var(--it-dim);font-weight:600">· ${esc(tf)}</span></div>`;
  html += `<div><span class="o">O</span> ${fmtP(o)} <span class="o">H</span> ${fmtP(h)} <span class="o">L</span> ${fmtP(l)} <span class="o">C</span> <b style="color:${col}">${fmtP(c)}</b></div>`;
  refs.forEach((r) => {
    let v = null;
    if (param && param.seriesData) { const d = param.seriesData.get(r.serie); if (d) v = d.value; }
    html += `<div class="ind"><span style="color:${r.color}">●</span> ${esc(r.nm)}${v != null ? ' ' + fmtP(v) : ''}</div>`;
  });
  el.innerHTML = html;
}

/* ── QUOTE ── */
async function cargarQuote() {
  const body = document.getElementById('it-quote-body'); if (!body) return;
  const t = document.getElementById('it-quote-title'); if (t) t.textContent = 'QUOTE · ' + S.par.id;
  let q;
  try { q = await D.ticker(S.par.s); } catch (_) { body.innerHTML = vacio('Quote feed unavailable.'); return; }
  const c = cls(q.chgPct);
  const cell = (k, v) => `<div class="it-q-cell"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  const signo = q.chg >= 0 ? '+' : '−';
  body.innerHTML = `
    <div class="it-q-top">
      <div class="it-q-last">${fmtP(q.last)}</div>
      <div class="it-q-chg ${c}">${signo}${fmtP(Math.abs(q.chg))} · ${fmtPct(q.chgPct)}</div>
    </div>
    <div class="it-q-grid">
      ${cell('Open', fmtP(q.open))}${cell('Prev close', fmtP(q.prevClose))}
      ${cell('24h High', fmtP(q.high))}${cell('24h Low', fmtP(q.low))}
      ${cell('Bid', fmtP(q.bid))}${cell('Ask', fmtP(q.ask))}
      ${cell('Vol (base)', (q.volBase || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }))}${cell('Vol (quote)', fmtBig(q.volQuote))}
    </div>`;
}

/* ── WATCHLIST ── */
async function cargarWatch() {
  const body = document.getElementById('it-watch-body'); if (!body) return;
  const pares = LISTA_WATCH.map((id) => D.PARES.find((p) => p.id === id)).filter(Boolean);
  let ts;
  try { ts = await D.tickers(pares.map((p) => p.s)); } catch (_) { if (body.querySelector('.it-spin')) body.innerHTML = vacio('Watchlist feed unavailable.'); return; }
  const map = {}; ts.forEach((t) => { map[t.simbolo] = t; });
  const rows = pares.map((p) => {
    const t = map[p.s] || {}; const c = cls(t.chgPct); const on = p.id === S.par.id ? ' class="on"' : '';
    return `<tr data-id="${esc(p.id)}"${on}><td><div class="sym"><b class="gold">${esc(p.id)}</b></div></td><td>${fmtP(t.last)}</td><td class="${c}">${fmtPct(t.chgPct)}</td></tr>`;
  }).join('');
  body.innerHTML = `<table class="it-tbl"><thead><tr><th>Symbol</th><th>Last</th><th>24h</th></tr></thead><tbody>${rows}</tbody></table>`;
  body.querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => { const p = D.PARES.find((x) => x.id === tr.dataset.id); if (p) setSimbolo(p); });
}

/* ── BOARD / HEATMAP ── */
async function cargarBoard() {
  const body = document.getElementById('it-board-body'); if (!body) return;
  let b;
  try { b = await D.board(); } catch (_) { if (body.querySelector('.it-spin')) body.innerHTML = vacio('Market board unavailable.'); return; }
  if (!b || !b.length) { body.innerHTML = vacio('No market data.'); return; }
  const tinte = (ch) => { if (ch == null) return 'rgba(60,70,82,.5)'; const x = Math.max(-8, Math.min(8, ch)) / 8; return x >= 0 ? `rgba(46,232,106,${0.12 + x * 0.5})` : `rgba(255,91,110,${0.12 + (-x) * 0.5})`; };
  body.innerHTML = `<div class="it-heat">` + b.slice(0, 40).map((c) => `
    <div class="it-tile" data-cg="${esc(c.id)}" data-sym="${esc(c.simbolo)}" style="background:${tinte(c.chg24)}">
      <b>${esc(c.simbolo)}</b>
      <div><div class="pr">${fmtP(c.price)}</div><em style="color:${c.chg24 >= 0 ? '#bdf5d2' : '#ffc2ca'}">${fmtPct(c.chg24)}</em></div>
    </div>`).join('') + `</div>`;
  body.querySelectorAll('.it-tile').forEach((t) => t.onclick = () => { const p = D.PARES.find((x) => x.cg && x.cg === t.dataset.cg) || D.PARES.find((x) => x.id === t.dataset.sym); if (p) setSimbolo(p); });
}

/* ── MACRO ── */
async function cargarMacro() {
  const body = document.getElementById('it-macro-body'); if (!body) return;
  let g = null, fg = null;
  try { g = await D.global(); } catch (_) {}
  try { fg = await D.fearGreed(); } catch (_) {}
  const topFng = document.getElementById('it-fng-top');
  if (topFng && fg) topFng.innerHTML = `F&amp;G <b class="${fg.valor >= 50 ? 'up' : 'down'}">${fg.valor}</b> ${esc(fg.etiqueta)}`;
  if (!g && !fg) { if (body.querySelector('.it-spin')) body.innerHTML = vacio('Macro feed unavailable.'); return; }
  const row = (k, v, c) => `<div class="it-macro-row"><span class="k">${k}</span><span class="v ${c || ''}">${v}</span></div>`;
  let html = '';
  if (g) {
    html += row('Total market cap', fmtBig(g.totalMcap), g.mcapChg >= 0 ? 'up' : 'down');
    html += row('24h cap change', fmtPct(g.mcapChg), cls(g.mcapChg));
    html += row('BTC dominance', g.btcDom != null ? g.btcDom.toFixed(1) + '%' : '—', 'gold');
    html += row('ETH dominance', g.ethDom != null ? g.ethDom.toFixed(1) + '%' : '—');
    html += row('24h volume', fmtBig(g.totalVol));
  }
  if (fg) {
    html += `<div class="it-macro-row" style="flex-direction:column;align-items:stretch;gap:4px">
      <div style="display:flex;justify-content:space-between"><span class="k">Fear &amp; Greed</span><span class="v ${fg.valor >= 50 ? 'up' : 'down'}">${fg.valor} · ${esc(fg.etiqueta)}</span></div>
      <div class="it-gauge"><div class="pin" style="left:${Math.max(0, Math.min(100, fg.valor))}%"></div></div></div>`;
  }
  body.innerHTML = `<div class="it-macro">${html}</div>`;
}

/* ── PANELES MOVIBLES Y REDIMENSIONABLES (apalancado de la idea de OpenTerminal) ── */
const DEF_LAYOUT = {
  'it-p-chart': [0, 0, 0.62, 0.62], 'it-p-quote': [0.62, 0, 0.38, 0.34],
  'it-p-watch': [0.62, 0.34, 0.38, 0.28], 'it-p-board': [0, 0.62, 0.62, 0.38],
  'it-p-macro': [0.62, 0.62, 0.38, 0.38]
};
function cargarLayout() { try { const j = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); if (j && typeof j === 'object') S.layout = j; } catch (_) {} }
function guardarLayout() { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(S.layout)); } catch (_) {} }
function rejilla() { return document.getElementById('it-grid'); }

function aplicarLayout() {
  const grid = rejilla(); if (!grid) return;
  const flotante = window.innerWidth >= 980;
  grid.classList.toggle('it-float', flotante);
  const lay = S.layout || DEF_LAYOUT;
  Object.keys(DEF_LAYOUT).forEach((id) => {
    const el = document.getElementById(id); if (!el) return;
    if (!flotante) { el.style.left = el.style.top = el.style.width = el.style.height = ''; return; }
    const [x, y, w, h] = lay[id] || DEF_LAYOUT[id];
    const W = grid.clientWidth, H = grid.clientHeight;
    el.style.left = (x * W) + 'px'; el.style.top = (y * H) + 'px';
    el.style.width = (w * W) + 'px'; el.style.height = (h * H) + 'px';
  });
}

function montarDragResize() {
  const grid = rejilla(); if (!grid) return;
  let modo = null, el = null, sx = 0, sy = 0, sl = 0, st = 0, sw = 0, sh = 0;
  const empezar = (e, panel, tipo) => {
    if (window.innerWidth < 980) return;
    modo = tipo; el = panel;
    const p = e.touches ? e.touches[0] : e;
    sx = p.clientX; sy = p.clientY;
    const r = panel.getBoundingClientRect(), g = grid.getBoundingClientRect();
    sl = r.left - g.left; st = r.top - g.top; sw = r.width; sh = r.height;
    el.classList.add('it-dragging');
    e.preventDefault();
    document.addEventListener('mousemove', mover); document.addEventListener('mouseup', soltar);
    document.addEventListener('touchmove', mover, { passive: false }); document.addEventListener('touchend', soltar);
  };
  const mover = (e) => {
    if (!modo) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - sx, dy = p.clientY - sy;
    const W = grid.clientWidth, H = grid.clientHeight;
    if (modo === 'drag') {
      let nl = Math.max(0, Math.min(W - sw, sl + dx)), nt = Math.max(0, Math.min(H - sh, st + dy));
      el.style.left = nl + 'px'; el.style.top = nt + 'px';
    } else {
      let nw = Math.max(220, Math.min(W - sl, sw + dx)), nh = Math.max(140, Math.min(H - st, sh + dy));
      el.style.width = nw + 'px'; el.style.height = nh + 'px';
    }
    e.preventDefault();
  };
  const soltar = () => {
    if (!modo || !el) return;
    const W = grid.clientWidth, H = grid.clientHeight;
    S.layout = S.layout || JSON.parse(JSON.stringify(DEF_LAYOUT));
    S.layout[el.id] = [parseFloat(el.style.left) / W, parseFloat(el.style.top) / H, parseFloat(el.style.width) / W, parseFloat(el.style.height) / H];
    guardarLayout();
    el.classList.remove('it-dragging');
    modo = null; el = null;
    document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar);
    document.removeEventListener('touchmove', mover); document.removeEventListener('touchend', soltar);
  };
  grid.querySelectorAll('.it-panel').forEach((panel) => {
    const head = panel.querySelector('.it-ph');
    if (head) { head.addEventListener('mousedown', (e) => { if (e.target.closest('button')) return; empezar(e, panel, 'drag'); });
                head.addEventListener('touchstart', (e) => { if (e.target.closest('button')) return; empezar(e, panel, 'drag'); }, { passive: false }); }
    const rz = panel.querySelector('[data-rz]');
    if (rz) { rz.addEventListener('mousedown', (e) => empezar(e, panel, 'resize'));
              rz.addEventListener('touchstart', (e) => empezar(e, panel, 'resize'), { passive: false }); }
  });
}

/* ── DISCLAIMER (misma composición que el disclaimer de Análisis: sello flotado a la derecha) ── */
function mostrarDisclaimer(reView) {
  if (!reView) { try { if (localStorage.getItem(DISC_KEY)) return; } catch (_) {} }
  const old = document.getElementById('it-disc'); if (old) old.remove();
  const m = document.createElement('div');
  m.className = 'it-modal'; m.id = 'it-disc';
  m.innerHTML = `
    <div class="it-modal-bg"></div>
    <div class="it-modal-card">
      ${reView ? '<button class="it-modal-x" aria-label="Close">✕</button>' : ''}
      <div class="it-disc-box">
        <img class="it-disc-seal" src="${SELLO}" alt="" onerror="this.style.display='none'">
        <h3>Institutional Analysis</h3>
        <p>A professional desk for <b>technical analysis only</b>. In a fully connected environment it wires together every system we can reach: live charting, multi source news tracking, market screeners, sector heatmaps and macro feeds, so advanced analysis runs from one screen.</p>
        <p>Nothing here is financial, investment, legal or tax advice, and no result is guaranteed. Digital assets carry substantial risk and every decision is your own.</p>
        ${reView ? '' : `<label class="it-disc-chk"><input type="checkbox" id="it-disc-agree"><span>I understand this is an analysis tool only, not financial advice, and I use it at my own risk.</span></label>`}
        <button class="it-pay" id="it-disc-ok"${reView ? '' : ' disabled'}>${reView ? 'Close' : 'Accept'}</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  requestAnimationFrame(() => m.classList.add('on'));
  const cerrarM = () => { m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 180); };
  if (reView) {
    m.querySelector('.it-modal-x').onclick = cerrarM;
    m.querySelector('.it-modal-bg').onclick = cerrarM;
  } else {
    m.querySelector('.it-modal-bg').onclick = (e) => { e.preventDefault(); e.stopPropagation(); };
    const a = m.querySelector('#it-disc-agree'), ok = m.querySelector('#it-disc-ok');
    a.addEventListener('change', () => { if (a.checked) ok.removeAttribute('disabled'); else ok.setAttribute('disabled', ''); });
  }
  m.querySelector('#it-disc-ok').onclick = () => {
    if (!reView) { const a = m.querySelector('#it-disc-agree'); if (!a || !a.checked) return; try { localStorage.setItem(DISC_KEY, '1'); } catch (_) {} }
    cerrarM();
  };
}
