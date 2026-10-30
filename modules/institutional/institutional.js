/* modules/institutional/institutional.js
   ANÁLISIS INSTITUCIONAL — el 4º servicio del área de Análisis.

   Un terminal estilo "mesa institucional" (inspirado en OpenTerminal, MIT) pero
   REESCRITO en vanilla y con la identidad de DecFreedom: dorado sobre oscuro,
   tipografías de la casa, nuestra marca. El motor de gráficas es lightweight-
   charts de TradingView (Apache-2.0), vendido en ./vendor. Los datos son en
   vivo y del lado del cliente sobre fuentes públicas con CORS (Binance,
   CoinGecko, alternative.me) — las mismas que ya usa la plataforma. Los paneles
   que requieren servidor propio (acciones, RSS, macro FRED) se activan en el
   "entorno conectado" que explica el disclaimer de entrada.

   Entrada única:
     import { abrirInstitutional } from '.../institutional.js';
     abrirInstitutional();
*/

import { estilos } from './estilos.js?v=1';
import * as D from './datos.js?v=1';
import { sma, ema, vwap, rsi, macd, bollinger } from './indicadores.js?v=1';

const LOGO = 'assets/img/cco-full.webp';
const SELLO = 'assets/portada/red/disclaimer.webp';
const DISC_KEY = 'it-disclaimer-ok';

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
  par: null, rango: '1M',
  ind: { SMA: true, EMA: false, VWAP: false, BOLL: false, RSI: false, MACD: false },
  velas: [], chart: null, serieVela: null, serieVol: null, series: [],
  refQuote: null, refBoard: null, reloj: null, cargandoChart: false
};

const LISTA_WATCH = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'LTC', 'DOT', 'TRX'];

export async function abrirInstitutional() {
  estilos();
  const prev = document.getElementById('it-overlay'); if (prev) prev.remove();
  S.par = D.PARES.find((p) => p.id === 'BTC') || D.PARES[0];

  const ov = document.createElement('div');
  ov.id = 'it-overlay';
  ov.innerHTML = plantilla();
  document.body.appendChild(ov);

  cablearTop(ov);
  cablearChartBar(ov);
  mostrarDisclaimer(false);

  // Motor de gráficas + primera carga
  try { await cargarLWC(); } catch (_) {}
  await cargarChart();
  cargarQuote();
  cargarWatch();
  cargarBoard();
  cargarMacro();
  tic();

  // Refrescos en vivo
  S.refQuote = setInterval(() => { cargarQuote(); cargarWatch(); }, 5000);
  S.refBoard = setInterval(() => { cargarBoard(); cargarMacro(); }, 30000);
  S.reloj = setInterval(tic, 1000);
}

function cerrar() {
  clearInterval(S.refQuote); clearInterval(S.refBoard); clearInterval(S.reloj);
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  S.chart = null;
  const ov = document.getElementById('it-overlay'); if (ov) ov.remove();
}

/* ── Plantilla del terminal ── */
function plantilla() {
  const icoSearch = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  return `
  <div class="it-top">
    <div class="it-brand">
      <img src="${LOGO}" alt="DecFreedom" onerror="this.style.display='none'">
      <div><b>INSTITUTIONAL</b><br><span>Analysis desk</span></div>
    </div>
    <div class="it-sep"></div>
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
      <button class="it-ico" id="it-close" title="Close">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
  </div>

  <div class="it-grid">
    <div class="it-panel" id="it-p-chart">
      <div class="it-ph"><h4 id="it-chart-title">CHART</h4><div class="it-ph-r" id="it-chart-meta"></div></div>
      <div class="it-pb"><div class="it-chart-body">
        <div class="it-chart-bar" id="it-chart-bar"></div>
        <div class="it-cv" id="it-cv"><div class="it-legend" id="it-legend"></div></div>
      </div></div>
    </div>

    <div class="it-panel" id="it-p-quote">
      <div class="it-ph"><h4 id="it-quote-title">QUOTE</h4></div>
      <div class="it-pb" id="it-quote-body">${cargando()}</div>
    </div>

    <div class="it-panel" id="it-p-watch">
      <div class="it-ph"><h4>WATCHLIST</h4></div>
      <div class="it-pb" id="it-watch-body">${cargando()}</div>
    </div>

    <div class="it-panel" id="it-p-board">
      <div class="it-ph"><h4>MARKET HEATMAP</h4><div class="it-ph-r dim" style="font-family:var(--it-mono);font-size:10px">24H %</div></div>
      <div class="it-pb" id="it-board-body">${cargando()}</div>
    </div>

    <div class="it-panel" id="it-p-macro">
      <div class="it-ph"><h4>MACRO</h4></div>
      <div class="it-pb" id="it-macro-body">${cargando()}</div>
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

/* ── Barra superior: reloj, buscador, cerrar, disclaimer ── */
function tic() {
  const c = document.getElementById('it-clock');
  if (c) c.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC' + (-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : '') + (-new Date().getTimezoneOffset() / 60);
}

function cablearTop(ov) {
  $('#it-close', ov).onclick = cerrar;
  $('#it-disc-link', ov).onclick = () => mostrarDisclaimer(true);

  const inp = $('#it-q', ov), sug = $('#it-sug', ov);
  let idx = -1, lista = [];
  const pintar = () => {
    const q = inp.value.trim().toLowerCase();
    lista = !q ? [] : D.PARES.filter((p) =>
      p.id.toLowerCase().includes(q) || (p.n || '').toLowerCase().includes(q)).slice(0, 8);
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
  document.addEventListener('click', (e) => { if (!$('.it-search', ov).contains(e.target)) sug.style.display = 'none'; });
}

function setSimbolo(par) {
  if (!par || par.id === (S.par && S.par.id)) return;
  S.par = par;
  cargarChart(); cargarQuote();
  document.querySelectorAll('#it-watch-body tr, #it-board-body .it-tile').forEach((el) => el.classList.remove('on'));
}

/* ── Barra del chart: rangos + indicadores ── */
function cablearChartBar(ov) {
  const bar = $('#it-chart-bar', ov);
  const rangos = D.ORDEN_RANGOS.map((r) => `<button class="it-chip it-rg ${r === S.rango ? 'on' : ''}" data-rg="${r}">${r}</button>`).join('');
  const inds = Object.keys(S.ind).map((k) => `<button class="it-chip it-in ${S.ind[k] ? 'on' : ''}" data-in="${k}">${k}</button>`).join('');
  bar.innerHTML = rangos + '<span class="it-chip-sep"></span>' + inds;
  bar.querySelectorAll('.it-rg').forEach((b) => b.onclick = () => {
    if (b.dataset.rg === S.rango) return;
    S.rango = b.dataset.rg;
    bar.querySelectorAll('.it-rg').forEach((x) => x.classList.toggle('on', x.dataset.rg === S.rango));
    cargarChart();
  });
  bar.querySelectorAll('.it-in').forEach((b) => b.onclick = () => {
    const k = b.dataset.in; S.ind[k] = !S.ind[k];
    b.classList.toggle('on', S.ind[k]);
    pintarChart();   // re-pinta indicadores sin re-descargar velas
  });
}

/* ── CHART ── */
async function cargarChart() {
  if (S.cargandoChart) return;
  S.cargandoChart = true;
  const title = document.getElementById('it-chart-title');
  if (title) title.textContent = 'CHART · ' + S.par.id + 'USD';
  try {
    S.velas = await D.velas(S.par.s, S.rango);
  } catch (_) {
    S.velas = [];
    const cv = document.getElementById('it-cv');
    if (cv) cv.innerHTML = '<div class="it-legend" id="it-legend"></div>' + vacio('Could not reach the market data feed. Retry in a moment.');
    S.cargandoChart = false;
    return;
  }
  pintarChart();
  S.cargandoChart = false;
}

function pintarChart() {
  if (!window.LightweightCharts || !S.velas.length) return;
  const LC = window.LightweightCharts;
  const cv = document.getElementById('it-cv');
  if (!cv) return;
  // Reconstruir el chart limpio (evita series obsoletas al cambiar par/rango/indicadores)
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  cv.innerHTML = '<div class="it-legend" id="it-legend"></div>';

  const chart = LC.createChart(cv, {
    autoSize: true,
    localization: { locale: 'en' },   // fija el idioma del eje/precios (inglés) y evita que el motor use un locale raro del navegador
    layout: { background: { color: 'transparent' }, textColor: '#7d8794', fontFamily: '"Chakra Petch", ui-monospace, monospace', panes: { separatorColor: '#232b35' } },
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

  const vela = chart.addSeries(LC.CandlestickSeries, {
    upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false,
    wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e'
  });
  vela.setData(S.velas.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
  S.serieVela = vela;

  const vol = chart.addSeries(LC.HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } });
  vol.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
  vol.setData(S.velas.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(46,232,106,.28)' : 'rgba(255,91,110,.28)' })));
  S.serieVol = vol;

  // Overlays sobre el precio
  const refs = [{ nm: 'OHLC', serie: vela, tipo: 'vela' }];
  const addLinea = (nm, pts, color, pane) => {
    if (!pts || !pts.length) return;
    const s = chart.addSeries(LC.LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, pane || 0);
    s.setData(pts.map((p) => ({ time: p.time, value: p.value })));
    refs.push({ nm, serie: s, color });
  };
  if (S.ind.SMA) addLinea('SMA 20', sma(S.velas, 20), '#E8B84B');
  if (S.ind.EMA) addLinea('EMA 50', ema(S.velas, 50), '#4aa3ff');
  if (S.ind.VWAP) addLinea('VWAP', vwap(S.velas), '#c678dd');
  if (S.ind.BOLL) {
    const b = bollinger(S.velas, 20, 2);
    addLinea('BB up', b.upper, 'rgba(120,180,255,.6)');
    addLinea('BB mid', b.middle, 'rgba(150,160,175,.5)');
    addLinea('BB low', b.lower, 'rgba(120,180,255,.6)');
  }
  // Paneles inferiores
  let pane = 1;
  if (S.ind.RSI) {
    const s = chart.addSeries(LC.LineSeries, { color: '#E8B84B', lineWidth: 1 }, pane);
    s.setData(rsi(S.velas, 14).map((p) => ({ time: p.time, value: p.value })));
    try { chart.panes()[pane].setHeight(90); } catch (_) {}
    refs.push({ nm: 'RSI 14', serie: s, color: '#E8B84B' });
    pane++;
  }
  if (S.ind.MACD) {
    const m = macd(S.velas);
    chart.addSeries(LC.HistogramSeries, { color: '#4aa3ff' }, pane).setData(m.histogram.map((p) => ({ time: p.time, value: p.value, color: p.value >= 0 ? 'rgba(46,232,106,.5)' : 'rgba(255,91,110,.5)' })));
    const sl = chart.addSeries(LC.LineSeries, { color: '#E8B84B', lineWidth: 1 }, pane);
    sl.setData(m.macd.map((p) => ({ time: p.time, value: p.value })));
    const sg = chart.addSeries(LC.LineSeries, { color: '#ffffff', lineWidth: 1 }, pane);
    sg.setData(m.signal.map((p) => ({ time: p.time, value: p.value })));
    try { chart.panes()[pane].setHeight(90); } catch (_) {}
    refs.push({ nm: 'MACD', serie: sl, color: '#E8B84B' });
    pane++;
  }

  chart.timeScale().fitContent();
  legendaEnVivo(chart, refs);
  const ult = S.velas[S.velas.length - 1];
  pintarLegend(refs, ult);
}

function legendaEnVivo(chart, refs) {
  chart.subscribeCrosshairMove((param) => {
    if (!param || !param.seriesData || !param.seriesData.size) {
      pintarLegend(refs, S.velas[S.velas.length - 1]); return;
    }
    const vd = param.seriesData.get(S.serieVela);
    pintarLegend(refs, vd || S.velas[S.velas.length - 1], param);
  });
}

function pintarLegend(refs, ohlc, param) {
  const el = document.getElementById('it-legend'); if (!el || !ohlc) return;
  const o = ohlc.open, h = ohlc.high, l = ohlc.low, c = ohlc.close;
  const col = c >= o ? '#2ee86a' : '#ff5b6e';
  let html = `<div class="nm">${esc(S.par.id)}USD <span style="color:var(--it-dim);font-weight:600">· ${esc(S.rango)}</span></div>`;
  html += `<div><span class="o">O</span> ${fmtP(o)} <span class="o">H</span> ${fmtP(h)} <span class="o">L</span> ${fmtP(l)} <span class="o">C</span> <b style="color:${col}">${fmtP(c)}</b></div>`;
  refs.filter((r) => r.serie !== S.serieVela).forEach((r) => {
    let v = null;
    if (param && param.seriesData) { const d = param.seriesData.get(r.serie); if (d) v = d.value; }
    if (v == null) { /* último valor de la serie no disponible sin crosshair */ }
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
      ${cell('Open', fmtP(q.open))}
      ${cell('Prev close', fmtP(q.prevClose))}
      ${cell('24h High', fmtP(q.high))}
      ${cell('24h Low', fmtP(q.low))}
      ${cell('Bid', fmtP(q.bid))}
      ${cell('Ask', fmtP(q.ask))}
      ${cell('Vol (base)', (q.volBase || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }))}
      ${cell('Vol (quote)', fmtBig(q.volQuote))}
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
    const t = map[p.s] || {};
    const c = cls(t.chgPct);
    const on = p.id === S.par.id ? ' class="on"' : '';
    return `<tr data-id="${esc(p.id)}"${on}>
      <td><div class="sym"><b class="gold">${esc(p.id)}</b></div></td>
      <td>${fmtP(t.last)}</td>
      <td class="${c}">${fmtPct(t.chgPct)}</td>
    </tr>`;
  }).join('');
  body.innerHTML = `<table class="it-tbl"><thead><tr><th>Symbol</th><th>Last</th><th>24h</th></tr></thead><tbody>${rows}</tbody></table>`;
  body.querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => {
    const p = D.PARES.find((x) => x.id === tr.dataset.id); if (p) setSimbolo(p);
  });
}

/* ── BOARD / HEATMAP ── */
async function cargarBoard() {
  const body = document.getElementById('it-board-body'); if (!body) return;
  let b;
  try { b = await D.board(); } catch (_) { if (body.querySelector('.it-spin')) body.innerHTML = vacio('Market board unavailable.'); return; }
  if (!b || !b.length) { body.innerHTML = vacio('No market data.'); return; }
  const tinte = (ch) => {
    if (ch == null) return 'rgba(60,70,82,.5)';
    const x = Math.max(-8, Math.min(8, ch)) / 8;
    return x >= 0 ? `rgba(46,232,106,${0.12 + x * 0.5})` : `rgba(255,91,110,${0.12 + (-x) * 0.5})`;
  };
  body.innerHTML = `<div class="it-heat">` + b.slice(0, 40).map((c) => `
    <div class="it-tile" data-cg="${esc(c.id)}" data-sym="${esc(c.simbolo)}" style="background:${tinte(c.chg24)}">
      <b>${esc(c.simbolo)}</b>
      <div><div class="pr">${fmtP(c.price)}</div><em class="${cls(c.chg24)}" style="color:${c.chg24 >= 0 ? '#bdf5d2' : '#ffc2ca'}">${fmtPct(c.chg24)}</em></div>
    </div>`).join('') + `</div>`;
  body.querySelectorAll('.it-tile').forEach((t) => t.onclick = () => {
    const p = D.PARES.find((x) => x.cg && x.cg === t.dataset.cg) || D.PARES.find((x) => x.id === t.dataset.sym);
    if (p) setSimbolo(p);
  });
}

/* ── MACRO ── */
async function cargarMacro() {
  const body = document.getElementById('it-macro-body'); if (!body) return;
  let g = null, fg = null;
  try { g = await D.global(); } catch (_) {}
  try { fg = await D.fearGreed(); } catch (_) {}
  // Índice miedo/codicia en la barra superior
  const topFng = document.getElementById('it-fng-top');
  if (topFng && fg) topFng.innerHTML = `F&G <b class="${fg.valor >= 50 ? 'up' : 'down'}">${fg.valor}</b> ${esc(fg.etiqueta)}`;
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
      <div class="it-gauge"><div class="pin" style="left:${Math.max(0, Math.min(100, fg.valor))}%"></div></div>
    </div>`;
  }
  body.innerHTML = `<div class="it-macro">${html}</div>`;
}

/* ── DISCLAIMER ── */
function mostrarDisclaimer(reView) {
  if (!reView) { try { if (localStorage.getItem(DISC_KEY)) return; } catch (_) {} }
  const old = document.getElementById('it-disc'); if (old) old.remove();
  const chk = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4L19 6"/></svg>';
  const m = document.createElement('div');
  m.className = 'it-modal'; m.id = 'it-disc';
  m.innerHTML = `
    <div class="it-modal-bg"></div>
    <div class="it-modal-card">
      ${reView ? '<button class="it-modal-x" aria-label="Close">✕</button>' : ''}
      <img class="it-disc-seal" src="${SELLO}" alt="" onerror="this.style.display='none'">
      <h3>Institutional Analysis</h3>
      <p>A professional-grade technical-analysis desk. In a fully <b>connected environment</b> we wire in every available system — live charting, multi-source news tracking, market screeners, sector heatmaps and macro feeds — so you can run advanced analysis from one screen.</p>
      <div class="it-feat">
        <div>${chk} Pro charting &amp; indicators</div>
        <div>${chk} Live market heatmap</div>
        <div>${chk} Quotes &amp; watchlist</div>
        <div>${chk} Macro &amp; sentiment</div>
      </div>
      <p>This workspace is for <b>technical analysis and information only</b>. Nothing here is financial, investment, legal or tax advice, and no result is guaranteed. Markets carry substantial risk and every decision is your own.</p>
      ${reView ? '' : `<label class="it-disc-chk"><input type="checkbox" id="it-disc-agree"><span>I understand this is an analysis tool only, not financial advice, and I use it entirely at my own risk.</span></label>`}
      <button class="it-pay" id="it-disc-ok"${reView ? '' : ' disabled'}>${reView ? 'Close' : 'Enter the desk'}</button>
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
