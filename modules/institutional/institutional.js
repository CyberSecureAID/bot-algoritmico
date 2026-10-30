/* modules/institutional/institutional.js — ANÁLISIS INSTITUCIONAL (4º servicio).

   Terminal de mesa institucional en vanilla con la identidad de DecFreedom.
   Motor de gráficas: lightweight-charts de TradingView (Apache-2.0, vendido en
   ./vendor, con su logo desactivado y la NUESTRA en su lugar). Matemática de
   indicadores y mapa de fuentes de datos: de OpenTerminal (MIT), reimplementados.
   Datos en vivo del lado del cliente (Binance, CoinGecko, alternative.me).

   Barra superior con la moneda (logo+nombre, lista completa, SIN operar), su
   temporalidad, precio y máx/mín del día. Ventanas que se mueven, se
   redimensionan, se maximizan a pantalla completa, se cierran, y se restauran.
*/

import { estilos } from './estilos.js?v=3';
import * as D from './datos.js?v=3';
import { sma, ema, vwap, rsi, macd, bollinger, stochastic, atr, cci, williams, obv, roc, donchian, keltner, supertrend } from './indicadores.js?v=3';

const LOGO = 'assets/img/cco-marca.png';
const LOGO_ALT = 'assets/img/cco-full.webp';
const SELLO = 'assets/portada/red/disclaimer.webp';
const DISC_KEY = 'it-disclaimer-ok';
const LAYOUT_KEY = 'it-layout-v2';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
const grupoNm = { cripto: 'Crypto', divisa: 'Forex', materia: 'Commodities' };

const INDS = [
  { k: 'SMA', nm: 'SMA 20', tipo: 'overlay' }, { k: 'EMA', nm: 'EMA 50', tipo: 'overlay' },
  { k: 'VWAP', nm: 'VWAP', tipo: 'overlay' }, { k: 'BOLL', nm: 'Bollinger', tipo: 'overlay' },
  { k: 'DONCH', nm: 'Donchian', tipo: 'overlay' }, { k: 'KELT', nm: 'Keltner', tipo: 'overlay' },
  { k: 'ST', nm: 'Supertrend', tipo: 'overlay' },
  { k: 'RSI', nm: 'RSI 14', tipo: 'pane' }, { k: 'MACD', nm: 'MACD', tipo: 'pane' },
  { k: 'STOCH', nm: 'Stochastic', tipo: 'pane' }, { k: 'ATR', nm: 'ATR 14', tipo: 'pane' },
  { k: 'CCI', nm: 'CCI 20', tipo: 'pane' }, { k: 'WILL', nm: 'Williams %R', tipo: 'pane' },
  { k: 'OBV', nm: 'OBV', tipo: 'pane' }, { k: 'ROC', nm: 'ROC 12', tipo: 'pane' }
];

function cargarLWC() {
  if (window.LightweightCharts) return Promise.resolve();
  return new Promise((res, rej) => {
    let sc = document.getElementById('it-lwc');
    if (sc) { sc.addEventListener('load', () => res()); sc.addEventListener('error', () => rej(new Error('lwc'))); return; }
    sc = document.createElement('script'); sc.id = 'it-lwc';
    sc.src = new URL('./vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
    sc.onload = () => res(); sc.onerror = () => rej(new Error('lwc'));
    document.head.appendChild(sc);
  });
}

const S = {
  par: null, tf: '1h', ind: {}, velas: [], chart: null, serieVela: null, serieVol: null, legendRefs: [],
  refQuote: null, refBoard: null, cargandoChart: false, onResize: null,
  layout: null, zTop: 10, maxed: null, hidden: {}, logos: {}, board: [], boardObs: null, ultTicker: null
};
const PANELES = ['it-p-chart', 'it-p-quote', 'it-p-watch', 'it-p-board', 'it-p-macro'];
const LISTA_WATCH = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'LTC', 'DOT', 'TRX'];

export async function abrirInstitutional() {
  estilos();
  const prev = document.getElementById('it-overlay'); if (prev) prev.remove();
  S.par = D.PARES.find((p) => p.id === 'BTC') || D.PARES[0];
  cargarLayout();

  const ov = document.createElement('div');
  ov.id = 'it-overlay'; ov.innerHTML = plantilla();
  document.body.appendChild(ov);

  cablearTop(ov);
  montarVentanas();
  aplicarLayout();
  S.onResize = () => aplicarLayout();
  window.addEventListener('resize', S.onResize);
  mostrarDisclaimer(false);

  D.logos().then((m) => { S.logos = m || {}; pintarCoin(); }).catch(() => {});
  try { await cargarLWC(); } catch (_) {}
  await cargarChart();
  cargarQuote(); cargarWatch(); cargarBoard(); cargarMacro();

  S.refQuote = setInterval(() => { cargarQuote(); cargarWatch(); }, 5000);
  S.refBoard = setInterval(() => { cargarBoard(); cargarMacro(); }, 30000);
}

function cerrar() {
  clearInterval(S.refQuote); clearInterval(S.refBoard);
  if (S.onResize) window.removeEventListener('resize', S.onResize);
  if (S.boardObs) { try { S.boardObs.disconnect(); } catch (_) {} S.boardObs = null; }
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  S.chart = null;
  const ov = document.getElementById('it-overlay'); if (ov) ov.remove();
}

/* ── Plantilla ── */
function panel(id, titulo, extra) {
  const max = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
  const x = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  return `<div class="it-panel" id="${id}">
    <div class="it-ph">
      <h4>${titulo}</h4>
      ${extra || ''}
      <div class="it-ph-ctrl">
        <button class="it-pbtn it-max" data-max="${id}" title="Fullscreen">${max}</button>
        <button class="it-pbtn it-x" data-close="${id}" title="Close">${x}</button>
      </div>
    </div>
    <div class="it-pb" id="${id}-body">${cargando()}</div>
    <span class="it-resize" data-rz></span>
  </div>`;
}

function plantilla() {
  const icoSearch = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  const back = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  const reset = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
  const expo = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>';
  const chev = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
  return `
  <div class="it-top">
    <button class="it-back" id="it-back" aria-label="Back">${back}Back</button>
    <div class="it-sep"></div>
    <button class="it-coin" id="it-coin"><i class="it-coin-lg" id="it-coin-lg"></i><b id="it-coin-id">BTC</b><span id="it-coin-nm">Bitcoin</span>${chev}</button>
    <button class="it-chip it-drop" id="it-tf-btn">1H ${chev}</button>
    <div class="it-pxbox">
      <div class="it-px" id="it-top-px">—</div>
      <div class="it-pxhl"><span>H <b id="it-top-h" class="up">—</b></span><span>L <b id="it-top-l" class="down">—</b></span></div>
    </div>
    <div class="it-search">${icoSearch}<input id="it-q" type="text" autocomplete="off" placeholder="Search symbol"><div class="it-sug" id="it-sug" style="display:none"></div></div>
    <div class="it-top-r">
      <button class="it-chip it-drop" id="it-in-btn">Indicators ${chev}</button>
      <button class="it-ico" id="it-export" title="Export image">${expo}</button>
      <button class="it-ico" id="it-reset" title="Reset layout">${reset}</button>
    </div>
  </div>
  <div class="it-grid" id="it-grid">
    <div class="it-panel" id="it-p-chart">
      <div class="it-ph"><h4 id="it-chart-title">CHART</h4>
        <div class="it-ph-ctrl">
          <button class="it-pbtn it-max" data-max="it-p-chart" title="Fullscreen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg></button>
          <button class="it-pbtn it-x" data-close="it-p-chart" title="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
      </div>
      <div class="it-pb"><div class="it-cv" id="it-cv"><div class="it-legend" id="it-legend"></div></div></div>
      <span class="it-resize" data-rz></span>
    </div>
    ${panel('it-p-quote', 'QUOTE')}
    ${panel('it-p-watch', 'WATCHLIST')}
    ${panel('it-p-board', 'MARKET HEATMAP', '<div class="it-ph-r dim" style="font-family:var(--it-mono);font-size:10px;margin-left:8px">SIZE · 24H MOVE</div>')}
    ${panel('it-p-macro', 'MACRO')}
  </div>
  <div class="it-foot">
    <div>DecFreedom · Institutional Analysis — <a href="https://decfreedom.com" target="_blank" rel="noopener">decfreedom.com</a></div>
    <div>Live technical analysis · <button class="it-disc-link" id="it-disc-link" type="button">Disclaimer</button> · not financial advice</div>
  </div>`;
}

function cargando() { return '<div class="it-empty"><div class="it-spin"></div><span>Loading…</span></div>'; }
function vacio(t) { return `<div class="it-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 2 5-6"/></svg><b>No data</b><span>${esc(t || '')}</span></div>`; }
function logoHTML(cls2, p) {
  const url = p && p.cg && S.logos[p.cg];
  if (url) return `<i class="${cls2} con" style="background-image:url(${esc(url)})"></i>`;
  return `<i class="${cls2}">${esc((p && p.id || '?')[0])}</i>`;
}

/* ── Barra superior ── */
function pintarCoin() {
  const lg = document.getElementById('it-coin-lg'), id = document.getElementById('it-coin-id'), nm = document.getElementById('it-coin-nm');
  if (!lg) return;
  const url = S.par.cg && S.logos[S.par.cg];
  if (url) { lg.style.backgroundImage = `url(${url})`; lg.classList.add('con'); lg.textContent = ''; }
  else { lg.style.backgroundImage = ''; lg.classList.remove('con'); lg.textContent = (S.par.id || '?')[0]; }
  if (id) id.textContent = S.par.id;
  if (nm) nm.textContent = S.par.n || '';
}

function cablearTop(ov) {
  $('#it-back', ov).onclick = cerrar;
  $('#it-coin', ov).onclick = (e) => { e.stopPropagation(); menuMonedas(); };
  $('#it-tf-btn', ov).onclick = (e) => { e.stopPropagation(); menuTf(); };
  $('#it-in-btn', ov).onclick = (e) => { e.stopPropagation(); menuInd(); };
  $('#it-export', ov).onclick = exportar;
  $('#it-reset', ov).onclick = resetLayout;
  $('#it-disc-link', ov).onclick = () => mostrarDisclaimer(true);
  pintarCoin();
  const tfNm = (D.TFS.find((t) => t.id === S.tf) || {}).n || S.tf;
  $('#it-tf-btn', ov).childNodes[0].nodeValue = tfNm + ' ';

  const inp = $('#it-q', ov), sug = $('#it-sug', ov);
  let idx = -1, lista = [];
  const pintar = () => {
    const q = inp.value.trim().toLowerCase();
    lista = !q ? [] : D.PARES.filter((p) => p.id.toLowerCase().includes(q) || (p.n || '').toLowerCase().includes(q)).slice(0, 8);
    if (!lista.length) { sug.style.display = 'none'; return; }
    sug.innerHTML = lista.map((p, i) => `<button data-i="${i}" class="${i === idx ? 'on' : ''}">${logoHTML('it-mini-lg', p)}<b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`).join('');
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
  S.par = par; pintarCoin();
  cargarChart(); cargarQuote();
  document.querySelectorAll('#it-p-watch-body tr, #it-p-board-body .it-tile').forEach((el) => el.classList.remove('on'));
}

/* ── Popups ── */
function cerrarPopups() { document.querySelectorAll('.it-pop').forEach((x) => x.remove()); }
function posicionar(m, ancla, derecha) {
  const r = ancla.getBoundingClientRect(); const w = m.offsetWidth || 220;
  m.style.top = (r.bottom + 6) + 'px';
  m.style.left = Math.max(8, Math.min(derecha ? r.right - w : r.left, window.innerWidth - w - 8)) + 'px';
}
function cierreFuera(m, ancla) {
  const fn = (ev) => { if (!m.contains(ev.target) && ev.target !== ancla && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('click', fn); } };
  setTimeout(() => document.addEventListener('click', fn), 10);
}

function menuMonedas() {
  if (document.getElementById('it-coinmenu')) { cerrarPopups(); return; }
  cerrarPopups();
  const ancla = document.getElementById('it-coin');
  const m = document.createElement('div'); m.className = 'it-pop it-coinmenu'; m.id = 'it-coinmenu';
  const grupos = {};
  D.PARES.forEach((p) => { const g = p.grupo || 'cripto'; (grupos[g] = grupos[g] || []).push(p); });
  let html = '<div class="it-cm-top"><input id="it-cm-q" placeholder="Filter…" autocomplete="off"></div><div class="it-cm-list" id="it-cm-list">';
  ['cripto', 'divisa', 'materia'].forEach((g) => {
    if (!grupos[g]) return;
    html += `<div class="it-cm-cat">${grupoNm[g]}</div>`;
    html += grupos[g].map((p) => `<button class="it-cm-it ${p.id === S.par.id ? 'on' : ''}" data-id="${esc(p.id)}" data-buscar="${esc((p.id + ' ' + (p.n || '')).toLowerCase())}">${logoHTML('it-mini-lg', p)}<b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`).join('');
  });
  html += '</div>';
  m.innerHTML = html;
  document.body.appendChild(m); posicionar(m, ancla);
  m.querySelectorAll('.it-cm-it').forEach((b) => b.onclick = () => { const p = D.PARES.find((x) => x.id === b.dataset.id); cerrarPopups(); if (p) setSimbolo(p); });
  const q = m.querySelector('#it-cm-q');
  q.addEventListener('input', () => {
    const v = q.value.trim().toLowerCase();
    m.querySelectorAll('.it-cm-it').forEach((b) => b.style.display = (!v || b.dataset.buscar.includes(v)) ? '' : 'none');
    m.querySelectorAll('.it-cm-cat').forEach((c) => { let n = c.nextElementSibling, hay = false; while (n && !n.classList.contains('it-cm-cat')) { if (n.style.display !== 'none') { hay = true; break; } n = n.nextElementSibling; } c.style.display = hay ? '' : 'none'; });
  });
  setTimeout(() => q.focus(), 30);
  cierreFuera(m, ancla);
}

function menuTf() {
  if (document.getElementById('it-tfmenu')) { cerrarPopups(); return; }
  cerrarPopups();
  const ancla = document.getElementById('it-tf-btn');
  const m = document.createElement('div'); m.className = 'it-pop it-tfmenu'; m.id = 'it-tfmenu';
  m.innerHTML = D.TFS.map((t) => `<button class="it-tf-it ${t.id === S.tf ? 'on' : ''}" data-tf="${t.id}">${esc(t.n)}</button>`).join('');
  document.body.appendChild(m); posicionar(m, ancla);
  m.querySelectorAll('.it-tf-it').forEach((b) => b.onclick = () => {
    S.tf = b.dataset.tf; cerrarPopups();
    const btn = document.getElementById('it-tf-btn'); if (btn) btn.childNodes[0].nodeValue = ((D.TFS.find((t) => t.id === S.tf) || {}).n || S.tf) + ' ';
    cargarChart();
  });
  cierreFuera(m, ancla);
}

function menuInd() {
  if (document.getElementById('it-inmenu')) { cerrarPopups(); return; }
  cerrarPopups();
  const ancla = document.getElementById('it-in-btn');
  const m = document.createElement('div'); m.className = 'it-pop it-inmenu'; m.id = 'it-inmenu';
  const grupo = (t, arr) => `<div class="it-pop-tit">${t}</div>` + arr.map((it) => `<button class="it-in-it ${S.ind[it.k] ? 'on' : ''}" data-k="${it.k}"><span class="it-in-ck">${S.ind[it.k] ? '✓' : ''}</span>${esc(it.nm)}</button>`).join('');
  m.innerHTML = grupo('Overlays', INDS.filter((i) => i.tipo === 'overlay')) + grupo('Oscillators', INDS.filter((i) => i.tipo === 'pane'));
  document.body.appendChild(m); posicionar(m, ancla, true);
  m.querySelectorAll('.it-in-it').forEach((b) => b.onclick = () => {
    const k = b.dataset.k; S.ind[k] = !S.ind[k];
    b.classList.toggle('on', S.ind[k]); b.querySelector('.it-in-ck').textContent = S.ind[k] ? '✓' : '';
    actualizarIndBtn(); pintarChart();
  });
  cierreFuera(m, ancla);
}
function actualizarIndBtn() { const btn = document.getElementById('it-in-btn'); if (!btn) return; const n = Object.values(S.ind).filter(Boolean).length; btn.childNodes[0].nodeValue = 'Indicators' + (n ? ' · ' + n : '') + ' '; }

/* ── CHART ── */
async function cargarChart() {
  if (S.cargandoChart) return; S.cargandoChart = true;
  const title = document.getElementById('it-chart-title');
  if (title) title.textContent = 'CHART · ' + S.par.id + 'USD';
  try { S.velas = await D.velas(S.par.s, S.tf, 500); }
  catch (_) { S.velas = []; const cv = document.getElementById('it-cv'); if (cv) cv.innerHTML = '<div class="it-legend" id="it-legend"></div>' + vacio('Could not reach the market data feed.'); S.cargandoChart = false; return; }
  pintarChart(); S.cargandoChart = false;
}

function pintarChart() {
  if (!window.LightweightCharts || !S.velas.length) return;
  const LC = window.LightweightCharts;
  const cv = document.getElementById('it-cv'); if (!cv) return;
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  cv.innerHTML = '<div class="it-legend" id="it-legend"></div><div class="it-wm" aria-hidden="true"><img src="' + LOGO + '" onerror="this.onerror=null;this.src=\'' + LOGO_ALT + '\'"></div>';

  const chart = LC.createChart(cv, {
    autoSize: true, localization: { locale: 'en' },
    layout: { background: { color: 'transparent' }, textColor: '#7d8794', fontFamily: '"Chakra Petch", ui-monospace, monospace', attributionLogo: false, panes: { separatorColor: '#232b35' } },
    grid: { vertLines: { color: 'rgba(35,43,53,.45)' }, horzLines: { color: 'rgba(35,43,53,.45)' } },
    rightPriceScale: { borderColor: '#232b35' },
    timeScale: { borderColor: '#232b35', timeVisible: true, secondsVisible: false },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  S.chart = chart; const V = S.velas;
  const vela = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e' });
  vela.setData(V.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))); S.serieVela = vela;
  const vol = chart.addSeries(LC.HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } });
  vol.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
  vol.setData(V.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(46,232,106,.28)' : 'rgba(255,91,110,.28)' })));

  const refs = [];
  const linea = (nm, k, pts, color, pane, w) => { if (!pts || !pts.length) return; const s = chart.addSeries(LC.LineSeries, { color, lineWidth: w || 1, priceLineVisible: false, lastValueVisible: false }, pane || 0); s.setData(pts.map((p) => ({ time: p.time, value: p.value }))); if (nm) refs.push({ nm, k, serie: s, color }); };
  if (S.ind.SMA) linea('SMA 20', 'SMA', sma(V, 20), '#E8B84B');
  if (S.ind.EMA) linea('EMA 50', 'EMA', ema(V, 50), '#4aa3ff');
  if (S.ind.VWAP) linea('VWAP', 'VWAP', vwap(V), '#c678dd');
  if (S.ind.BOLL) { const b = bollinger(V, 20, 2); linea('Bollinger', 'BOLL', b.middle, 'rgba(150,160,175,.55)'); linea(null, null, b.upper, 'rgba(120,180,255,.6)'); linea(null, null, b.lower, 'rgba(120,180,255,.6)'); }
  if (S.ind.DONCH) { const d = donchian(V, 20); linea('Donchian', 'DONCH', d.upper, 'rgba(232,184,75,.6)'); linea(null, null, d.lower, 'rgba(232,184,75,.6)'); }
  if (S.ind.KELT) { const k = keltner(V, 20, 2); linea('Keltner', 'KELT', k.upper, 'rgba(198,120,221,.55)'); linea(null, null, k.middle, 'rgba(198,120,221,.3)'); linea(null, null, k.lower, 'rgba(198,120,221,.55)'); }
  if (S.ind.ST) linea('Supertrend', 'ST', supertrend(V, 10, 3), '#2ee86a', 0, 2);
  let pane = 1; const abrir = () => { const p = pane; pane++; try { const ps = chart.panes(); if (ps[p]) ps[p].setHeight(84); } catch (_) {} return p; };
  if (S.ind.RSI) linea('RSI 14', 'RSI', rsi(V, 14), '#E8B84B', abrir());
  if (S.ind.MACD) { const p = abrir(); const m = macd(V); chart.addSeries(LC.HistogramSeries, {}, p).setData(m.histogram.map((x) => ({ time: x.time, value: x.value, color: x.value >= 0 ? 'rgba(46,232,106,.5)' : 'rgba(255,91,110,.5)' }))); linea('MACD', 'MACD', m.macd, '#E8B84B', p); linea(null, null, m.signal, '#ffffff', p); }
  if (S.ind.STOCH) { const p = abrir(); const st = stochastic(V); linea('Stoch %K', 'STOCH', st.k, '#E8B84B', p); linea(null, null, st.d, '#4aa3ff', p); }
  if (S.ind.ATR) linea('ATR 14', 'ATR', atr(V, 14), '#c678dd', abrir());
  if (S.ind.CCI) linea('CCI 20', 'CCI', cci(V, 20), '#4aa3ff', abrir());
  if (S.ind.WILL) linea('Williams %R', 'WILL', williams(V, 14), '#E8B84B', abrir());
  if (S.ind.OBV) linea('OBV', 'OBV', obv(V), '#2ee86a', abrir());
  if (S.ind.ROC) linea('ROC 12', 'ROC', roc(V, 12), '#ff9f43', abrir());

  S.legendRefs = refs;
  chart.timeScale().fitContent();
  chart.subscribeCrosshairMove((param) => { const vd = (param && param.seriesData) ? param.seriesData.get(S.serieVela) : null; pintarLegend(vd || V[V.length - 1], param); });
  pintarLegend(V[V.length - 1]);
}

function pintarLegend(ohlc, param) {
  const el = document.getElementById('it-legend'); if (!el || !ohlc) return;
  const o = ohlc.open, h = ohlc.high, l = ohlc.low, c = ohlc.close;
  const col = c >= o ? '#2ee86a' : '#ff5b6e';
  const tf = (D.TFS.find((t) => t.id === S.tf) || {}).n || S.tf;
  let html = `<div class="nm">${esc(S.par.id)}USD <span style="color:var(--it-dim);font-weight:600">· ${esc(tf)}</span></div>`;
  html += `<div><span class="o">O</span> ${fmtP(o)} <span class="o">H</span> ${fmtP(h)} <span class="o">L</span> ${fmtP(l)} <span class="o">C</span> <b style="color:${col}">${fmtP(c)}</b></div>`;
  S.legendRefs.forEach((r) => {
    let v = null; if (param && param.seriesData) { const d = param.seriesData.get(r.serie); if (d) v = d.value; }
    html += `<div class="ind"><span style="color:${r.color}">●</span> ${esc(r.nm)}${v != null ? ' ' + fmtP(v) : ''}<button class="it-leg-x" data-k="${esc(r.k)}" title="Remove">✕</button></div>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.it-leg-x').forEach((b) => b.onclick = (e) => { e.stopPropagation(); S.ind[b.dataset.k] = false; actualizarIndBtn(); pintarChart(); });
}

function exportar() {
  if (!S.chart) { return; }
  let src; try { src = S.chart.takeScreenshot(); } catch (_) { return; }
  const W = src.width, Hh = 46, Hf = 30;
  const out = document.createElement('canvas'); out.width = W; out.height = Hh + src.height + Hf;
  const g = out.getContext('2d');
  g.fillStyle = '#0b0e13'; g.fillRect(0, 0, out.width, out.height);
  const tf = (D.TFS.find((t) => t.id === S.tf) || {}).n || S.tf;
  g.textAlign = 'left'; g.fillStyle = '#E8B84B'; g.font = '800 18px "Chakra Petch", system-ui, monospace';
  g.fillText(S.par.id + 'USD · ' + tf, 16, 30);
  if (S.ultTicker) { g.textAlign = 'right'; g.fillStyle = '#eaecef'; g.fillText(fmtP(S.ultTicker.last) + '  ' + fmtPct(S.ultTicker.chgPct), W - 16, 30); }
  g.drawImage(src, 0, Hh);
  g.fillStyle = '#0a0d12'; g.fillRect(0, Hh + src.height, W, Hf);
  g.textAlign = 'left'; g.fillStyle = '#C9A84B'; g.font = '700 12px "Chakra Petch", system-ui, monospace';
  g.fillText('DecFreedom · Institutional Analysis — decfreedom.com', 14, Hh + src.height + 20);
  out.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `decfreedom-institutional-${S.par.id}-${S.tf}-${Date.now()}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }, 'image/png');
}

/* ── QUOTE (+ cabecera superior) ── */
async function cargarQuote() {
  const body = document.getElementById('it-p-quote-body'); const t = document.querySelector('#it-p-quote h4'); if (t) t.textContent = 'QUOTE · ' + S.par.id;
  let q; try { q = await D.ticker(S.par.s); } catch (_) { if (body) body.innerHTML = vacio('Quote feed unavailable.'); return; }
  S.ultTicker = q;
  const px = document.getElementById('it-top-px'), hh = document.getElementById('it-top-h'), ll = document.getElementById('it-top-l');
  if (px) { px.textContent = fmtP(q.last); px.className = 'it-px ' + cls(q.chgPct); }
  if (hh) hh.textContent = fmtP(q.high); if (ll) ll.textContent = fmtP(q.low);
  if (!body) return;
  const c = cls(q.chgPct); const cell = (k, v) => `<div class="it-q-cell"><span class="k">${k}</span><span class="v">${v}</span></div>`; const signo = q.chg >= 0 ? '+' : '−';
  body.innerHTML = `<div class="it-q-top"><div class="it-q-last">${fmtP(q.last)}</div><div class="it-q-chg ${c}">${signo}${fmtP(Math.abs(q.chg))} · ${fmtPct(q.chgPct)}</div></div>
    <div class="it-q-grid">${cell('Open', fmtP(q.open))}${cell('Prev close', fmtP(q.prevClose))}${cell('24h High', fmtP(q.high))}${cell('24h Low', fmtP(q.low))}${cell('Bid', fmtP(q.bid))}${cell('Ask', fmtP(q.ask))}${cell('Vol (base)', (q.volBase || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }))}${cell('Vol (quote)', fmtBig(q.volQuote))}</div>`;
}

/* ── WATCHLIST ── */
async function cargarWatch() {
  const body = document.getElementById('it-p-watch-body'); if (!body) return;
  const pares = LISTA_WATCH.map((id) => D.PARES.find((p) => p.id === id)).filter(Boolean);
  let ts; try { ts = await D.tickers(pares.map((p) => p.s)); } catch (_) { if (body.querySelector('.it-spin')) body.innerHTML = vacio('Watchlist feed unavailable.'); return; }
  const map = {}; ts.forEach((t) => { map[t.simbolo] = t; });
  const rows = pares.map((p) => { const t = map[p.s] || {}; const c = cls(t.chgPct); const on = p.id === S.par.id ? ' class="on"' : ''; return `<tr data-id="${esc(p.id)}"${on}><td><div class="sym">${logoHTML('it-mini-lg', p)}<b class="gold">${esc(p.id)}</b></div></td><td>${fmtP(t.last)}</td><td class="${c}">${fmtPct(t.chgPct)}</td></tr>`; }).join('');
  body.innerHTML = `<table class="it-tbl"><thead><tr><th>Symbol</th><th>Last</th><th>24h</th></tr></thead><tbody>${rows}</tbody></table>`;
  body.querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => { const p = D.PARES.find((x) => x.id === tr.dataset.id); if (p) setSimbolo(p); });
}

/* ── MARKET HEATMAP (treemap: tamaño por magnitud del % 24h) ── */
function treemap(items, W, H) {
  const nodes = items.filter((n) => n.v > 0).sort((a, b) => b.v - a.v).map((n) => Object.assign({}, n));
  if (!nodes.length || W <= 0 || H <= 0) return [];
  const total = nodes.reduce((a, n) => a + n.v, 0); const scale = (W * H) / total; nodes.forEach((n) => n.area = n.v * scale);
  const worst = (row, side) => { let s = 0, mx = -Infinity, mn = Infinity; for (const r of row) { s += r.area; if (r.area > mx) mx = r.area; if (r.area < mn) mn = r.area; } const s2 = s * s, w2 = side * side; return Math.max(w2 * mx / s2, s2 / (w2 * mn)); };
  const rect = { x: 0, y: 0, w: W, h: H }; let row = []; let i = 0;
  const layout = () => { let s = 0; for (const r of row) s += r.area; const vert = rect.w >= rect.h; if (vert) { const rw = s / rect.h; let y = rect.y; for (const r of row) { const rh = r.area / rw; r.x = rect.x; r.y = y; r.w = rw; r.h = rh; y += rh; } rect.x += rw; rect.w -= rw; } else { const rh = s / rect.w; let x = rect.x; for (const r of row) { const rw2 = r.area / rh; r.x = x; r.y = rect.y; r.w = rw2; r.h = rh; x += rw2; } rect.y += rh; rect.h -= rh; } row = []; };
  while (i < nodes.length) { const side = Math.min(rect.w, rect.h); const next = nodes[i]; if (!row.length || worst(row, side) >= worst(row.concat([next]), side)) { row.push(next); i++; } else layout(); }
  if (row.length) layout();
  return nodes;
}
function pintarHeat() {
  const body = document.getElementById('it-p-board-body'); if (!body || !S.board.length) return;
  const W = body.clientWidth, H = body.clientHeight; if (W < 10 || H < 10) return;
  const items = S.board.map((c) => ({ ...c, v: Math.abs(c.chg24 || 0) + 0.25 }));
  const laid = treemap(items, W, H);
  const tinte = (ch) => { const x = Math.max(-10, Math.min(10, ch || 0)) / 10; return x >= 0 ? `rgba(46,232,106,${0.14 + x * 0.55})` : `rgba(255,91,110,${0.14 + (-x) * 0.55})`; };
  body.innerHTML = laid.map((c) => {
    const grande = c.w > 70 && c.h > 46; const chico = c.w < 46 || c.h < 30;
    return `<div class="it-tile" data-cg="${esc(c.id)}" data-sym="${esc(c.simbolo)}" style="left:${c.x}px;top:${c.y}px;width:${Math.max(0, c.w - 3)}px;height:${Math.max(0, c.h - 3)}px;background:${tinte(c.chg24)}">
      <b${chico ? ' style="font-size:10px"' : ''}>${esc(c.simbolo)}</b>${grande ? `<div class="pr">${fmtP(c.price)}</div>` : ''}<em style="color:${(c.chg24 || 0) >= 0 ? '#d6ffe6' : '#ffd7dc'}${chico ? ';font-size:9px' : ''}">${fmtPct(c.chg24)}</em></div>`;
  }).join('') + `<div class="it-hm-wm"><img src="${LOGO}" onerror="this.onerror=null;this.src='${LOGO_ALT}'"></div>`;
  body.querySelectorAll('.it-tile').forEach((t) => t.onclick = () => { const p = D.PARES.find((x) => x.cg && x.cg === t.dataset.cg) || D.PARES.find((x) => x.id === t.dataset.sym); if (p) setSimbolo(p); });
}
async function cargarBoard() {
  const body = document.getElementById('it-p-board-body'); if (!body) return;
  let b; try { b = await D.board(); } catch (_) { if (body.querySelector('.it-spin')) body.innerHTML = vacio('Market board unavailable.'); return; }
  if (!b || !b.length) { body.innerHTML = vacio('No market data.'); return; }
  S.board = b;
  if (body.classList.contains('it-pb')) body.style.overflow = 'hidden';
  pintarHeat();
  if (!S.boardObs && window.ResizeObserver) { S.boardObs = new ResizeObserver(() => pintarHeat()); S.boardObs.observe(body); }
}

/* ── MACRO ── */
async function cargarMacro() {
  const body = document.getElementById('it-p-macro-body'); if (!body) return;
  let g = null, fg = null; try { g = await D.global(); } catch (_) {} try { fg = await D.fearGreed(); } catch (_) {}
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
  if (fg) html += `<div class="it-macro-row" style="flex-direction:column;align-items:stretch;gap:5px"><div style="display:flex;justify-content:space-between"><span class="k">Fear &amp; Greed</span><span class="v ${fg.valor >= 50 ? 'up' : 'down'}">${fg.valor} · ${esc(fg.etiqueta)}</span></div><div class="it-gauge"><div class="pin" style="left:${Math.max(0, Math.min(100, fg.valor))}%"></div></div></div>`;
  body.innerHTML = `<div class="it-macro">${html}</div>`;
}

/* ── VENTANAS: z-index propio, traer-al-frente, maximizar, cerrar, redimensionar ── */
const DEF_LAYOUT = {
  'it-p-chart': [0.006, 0.01, 0.60, 0.605], 'it-p-quote': [0.614, 0.01, 0.38, 0.33],
  'it-p-watch': [0.614, 0.35, 0.38, 0.265], 'it-p-board': [0.006, 0.625, 0.60, 0.365],
  'it-p-macro': [0.614, 0.625, 0.38, 0.365]
};
function cargarLayout() { try { const j = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); if (j && typeof j === 'object') S.layout = j; } catch (_) {} }
function guardarLayout() { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(S.layout)); } catch (_) {} }
function rejilla() { return document.getElementById('it-grid'); }

function aplicarLayout() {
  const grid = rejilla(); if (!grid) return;
  const flotante = window.innerWidth >= 980;
  grid.classList.toggle('it-float', flotante);
  const lay = S.layout || DEF_LAYOUT;
  const W = grid.clientWidth, H = grid.clientHeight;
  PANELES.forEach((id, i) => {
    const el = document.getElementById(id); if (!el) return;
    el.style.display = S.hidden[id] ? 'none' : '';
    if (!el.style.zIndex) el.style.zIndex = 1 + i;
    if (!flotante) { el.style.left = el.style.top = el.style.width = el.style.height = ''; return; }
    if (S.maxed === id) { el.style.left = '0px'; el.style.top = '0px'; el.style.width = W + 'px'; el.style.height = H + 'px'; el.style.zIndex = ++S.zTop; return; }
    const [x, y, w, h] = lay[id] || DEF_LAYOUT[id];
    el.style.left = (x * W) + 'px'; el.style.top = (y * H) + 'px'; el.style.width = (w * W) + 'px'; el.style.height = (h * H) + 'px';
  });
  setTimeout(pintarHeat, 30);
}
function traerFrente(el) { if (window.innerWidth < 980) return; el.style.zIndex = ++S.zTop; }
function maximizar(id) { S.maxed = (S.maxed === id) ? null : id; aplicarLayout(); setTimeout(pintarHeat, 60); }
function cerrarPanel(id) { S.hidden[id] = true; if (S.maxed === id) S.maxed = null; const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function resetLayout() { S.layout = null; S.hidden = {}; S.maxed = null; try { localStorage.removeItem(LAYOUT_KEY); } catch (_) {} PANELES.forEach((id) => { const el = document.getElementById(id); if (el) el.style.display = ''; }); aplicarLayout(); }

function montarVentanas() {
  const grid = rejilla(); if (!grid) return;
  let modo = null, el = null, sx = 0, sy = 0, sl = 0, st = 0, sw = 0, sh = 0;
  const empezar = (e, panel, tipo) => {
    if (window.innerWidth < 980 || S.maxed) return;
    modo = tipo; el = panel; traerFrente(panel);
    const p = e.touches ? e.touches[0] : e; sx = p.clientX; sy = p.clientY;
    const r = panel.getBoundingClientRect(), g = grid.getBoundingClientRect();
    sl = r.left - g.left; st = r.top - g.top; sw = r.width; sh = r.height;
    panel.classList.add('it-dragging'); e.preventDefault();
    document.addEventListener('mousemove', mover); document.addEventListener('mouseup', soltar);
    document.addEventListener('touchmove', mover, { passive: false }); document.addEventListener('touchend', soltar);
  };
  const mover = (e) => {
    if (!modo) return; const p = e.touches ? e.touches[0] : e; const dx = p.clientX - sx, dy = p.clientY - sy; const W = grid.clientWidth, H = grid.clientHeight;
    if (modo === 'drag') { el.style.left = Math.max(0, Math.min(W - sw, sl + dx)) + 'px'; el.style.top = Math.max(0, Math.min(H - sh, st + dy)) + 'px'; }
    else { el.style.width = Math.max(220, Math.min(W - sl, sw + dx)) + 'px'; el.style.height = Math.max(140, Math.min(H - st, sh + dy)) + 'px'; if (el.id === 'it-p-board') pintarHeat(); }
    e.preventDefault();
  };
  const soltar = () => {
    if (!modo || !el) return; const W = grid.clientWidth, H = grid.clientHeight;
    S.layout = S.layout || JSON.parse(JSON.stringify(DEF_LAYOUT));
    S.layout[el.id] = [parseFloat(el.style.left) / W, parseFloat(el.style.top) / H, parseFloat(el.style.width) / W, parseFloat(el.style.height) / H];
    guardarLayout(); el.classList.remove('it-dragging'); if (el.id === 'it-p-board') pintarHeat();
    modo = null; el = null;
    document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar);
    document.removeEventListener('touchmove', mover); document.removeEventListener('touchend', soltar);
  };
  grid.querySelectorAll('.it-panel').forEach((panel) => {
    panel.addEventListener('mousedown', () => traerFrente(panel), true);
    const head = panel.querySelector('.it-ph');
    if (head) {
      head.addEventListener('mousedown', (e) => { if (e.target.closest('button')) return; empezar(e, panel, 'drag'); });
      head.addEventListener('touchstart', (e) => { if (e.target.closest('button')) return; empezar(e, panel, 'drag'); }, { passive: false });
    }
    const rz = panel.querySelector('[data-rz]');
    if (rz) { rz.addEventListener('mousedown', (e) => empezar(e, panel, 'resize')); rz.addEventListener('touchstart', (e) => empezar(e, panel, 'resize'), { passive: false }); }
    const mx = panel.querySelector('.it-max'); if (mx) mx.onclick = (e) => { e.stopPropagation(); maximizar(panel.id); };
    const cx = panel.querySelector('.it-x'); if (cx) cx.onclick = (e) => { e.stopPropagation(); cerrarPanel(panel.id); };
  });
}

/* ── DISCLAIMER ── */
function mostrarDisclaimer(reView) {
  if (!reView) { try { if (localStorage.getItem(DISC_KEY)) return; } catch (_) {} }
  const old = document.getElementById('it-disc'); if (old) old.remove();
  const m = document.createElement('div'); m.className = 'it-modal'; m.id = 'it-disc';
  m.innerHTML = `<div class="it-modal-bg"></div><div class="it-modal-card">
    ${reView ? '<button class="it-modal-x" aria-label="Close">✕</button>' : ''}
    <div class="it-disc-box">
      <img class="it-disc-seal" src="${SELLO}" alt="" onerror="this.style.display='none'">
      <h3>Institutional Analysis</h3>
      <p>A professional desk for <b>technical analysis only</b>. In a fully connected environment it wires together every system we can reach: live charting, multi source news tracking, market screeners, sector heatmaps and macro feeds, so advanced analysis runs from one screen.</p>
      <p>Nothing here is financial, investment, legal or tax advice, and no result is guaranteed. Digital assets carry substantial risk and every decision is your own.</p>
      ${reView ? '' : `<label class="it-disc-chk"><input type="checkbox" id="it-disc-agree"><span>I understand this is an analysis tool only, not financial advice, and I use it at my own risk.</span></label>`}
      <button class="it-pay" id="it-disc-ok"${reView ? '' : ' disabled'}>${reView ? 'Close' : 'Accept'}</button>
    </div></div>`;
  document.body.appendChild(m);
  requestAnimationFrame(() => m.classList.add('on'));
  const cerrarM = () => { m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 180); };
  if (reView) { m.querySelector('.it-modal-x').onclick = cerrarM; m.querySelector('.it-modal-bg').onclick = cerrarM; }
  else { m.querySelector('.it-modal-bg').onclick = (e) => { e.preventDefault(); e.stopPropagation(); }; const a = m.querySelector('#it-disc-agree'), ok = m.querySelector('#it-disc-ok'); a.addEventListener('change', () => { if (a.checked) ok.removeAttribute('disabled'); else ok.setAttribute('disabled', ''); }); }
  m.querySelector('#it-disc-ok').onclick = () => { if (!reView) { const a = m.querySelector('#it-disc-agree'); if (!a || !a.checked) return; try { localStorage.setItem(DISC_KEY, '1'); } catch (_) {} } cerrarM(); };
}
