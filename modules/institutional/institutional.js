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

import { estilos } from './estilos.js?v=8';
import * as D from './datos.js?v=5';
import { ICONOS } from '../../assets/js/niveles/config.js?v=1';   // monedas SVG para divisas (EUR €, GBP £)
import { sma, ema, wma, hma, dema, tema, vwap, vwapBands, rsi, macd, bollinger, stochastic, atr, cci, williams, obv, roc, donchian, keltner, supertrend, psar, adx, mfi, awesome, momentum, stddev, ultimate, cmf } from './indicadores.js?v=5';

/* La MISMA barra de dibujo de las otras secciones (Smart/Heat/Liquidity Pools):
   se importa en diferido para que, si fallara, el terminal siga funcionando. */
let _montarBarra = null, _nivN = null, _cargarDib = null;
async function cargarBarra() {
  if (_montarBarra) return _montarBarra;
  try {
    const base = new URL('../../assets/js/niveles/', import.meta.url).href;
    const [mb, est, dib] = await Promise.all([
      import(base + 'barra.js?v=1'), import(base + 'estado.js?v=1'), import(base + 'dibujo.js?v=1')
    ]);
    _montarBarra = mb.montarBarra; _nivN = est.N; _cargarDib = dib.cargarDib;
  } catch (_) { _montarBarra = null; }
  return _montarBarra;
}

/* Resueltas contra la URL del script (no del documento) para que la marca de
   agua cargue aunque la página se sirva desde /modules/analysis/. */
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const LOGO_ALT = new URL('../../assets/img/cco-full.webp', import.meta.url).href;
const SELLO = 'assets/portada/red/disclaimer.webp';
const DISC_KEY = 'it-disclaimer-ok';
const LAYOUT_KEY = 'it-layout-v4';   // v4: la gráfica domina aún más (reinicia layouts guardados antiguos)

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

/* sig:true → el indicador emite señales long/short (marcas verdes/rojas). */
const INDS = [
  // Medias móviles (overlay)
  { k: 'EMA9', nm: 'EMA 9', tipo: 'ma' }, { k: 'EMA20', nm: 'EMA 20', tipo: 'ma' },
  { k: 'EMA50', nm: 'EMA 50', tipo: 'ma' }, { k: 'EMA100', nm: 'EMA 100', tipo: 'ma' },
  { k: 'EMA200', nm: 'EMA 200', tipo: 'ma' }, { k: 'SMA', nm: 'SMA 20', tipo: 'ma' },
  { k: 'WMA', nm: 'WMA 20', tipo: 'ma' }, { k: 'HMA', nm: 'HMA 20', tipo: 'ma' },
  { k: 'DEMA', nm: 'DEMA 20', tipo: 'ma' }, { k: 'TEMA', nm: 'TEMA 20', tipo: 'ma' },
  // Overlays con bandas / tendencia
  { k: 'VWAP', nm: 'VWAP', tipo: 'overlay', sig: true }, { k: 'BOLL', nm: 'Bollinger', tipo: 'overlay', sig: true },
  { k: 'DONCH', nm: 'Donchian', tipo: 'overlay' }, { k: 'KELT', nm: 'Keltner', tipo: 'overlay', sig: true },
  { k: 'PSAR', nm: 'Parabolic SAR', tipo: 'overlay', sig: true }, { k: 'ST', nm: 'Supertrend', tipo: 'overlay', sig: true },
  // Osciladores (panel propio)
  { k: 'RSI', nm: 'RSI 14', tipo: 'pane' }, { k: 'MACD', nm: 'MACD', tipo: 'pane' },
  { k: 'STOCH', nm: 'Stochastic', tipo: 'pane' }, { k: 'ATR', nm: 'ATR 14', tipo: 'pane' },
  { k: 'CCI', nm: 'CCI 20', tipo: 'pane' }, { k: 'WILL', nm: 'Williams %R', tipo: 'pane' },
  { k: 'OBV', nm: 'OBV', tipo: 'pane' }, { k: 'ROC', nm: 'ROC 12', tipo: 'pane' },
  { k: 'ADX', nm: 'ADX 14', tipo: 'pane' }, { k: 'MFI', nm: 'MFI 14', tipo: 'pane' },
  { k: 'AO', nm: 'Awesome Osc.', tipo: 'pane' }, { k: 'MOM', nm: 'Momentum', tipo: 'pane' },
  { k: 'STDDEV', nm: 'Std Deviation', tipo: 'pane' }, { k: 'UO', nm: 'Ultimate Osc.', tipo: 'pane' },
  { k: 'CMF', nm: 'Chaikin MF', tipo: 'pane' }
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
  par: null, tf: '1h', ind: { EMA50: true }, velas: [], velasDib: [], chart: null, serieVela: null, serieVol: null, legendRefs: [], marks: [], marksApi: null,
  refQuote: null, refBoard: null, cargandoChart: false, onResize: null, barra: null, dibMontada: false,
  layout: null, zTop: 10, maxed: null, hidden: {}, logos: {}, board: [], boardObs: null, ultTicker: null,
  tileEls: {}, senal: null, senalPar: null, senalTF: {}, oleajeRAF: null
};
const PANELES = ['it-p-chart', 'it-p-quote', 'it-p-watch', 'it-p-board', 'it-p-macro'];
const LISTA_WATCH = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'LTC', 'DOT', 'TRX'];

export async function abrirInstitutional() {
  estilos();
  const prev = document.getElementById('it-overlay'); if (prev) prev.remove();
  S.par = D.PARES.find((p) => p.id === 'BTC') || D.PARES[0];
  S.tileEls = {}; S.senalPar = null; S.senalTF = {}; S.senal = null;
  cargarLayout();

  const ov = document.createElement('div');
  ov.id = 'it-overlay'; ov.innerHTML = plantilla();
  document.body.appendChild(ov);

  cablearTop(ov);
  montarVentanas();
  aplicarLayout();
  S.onResize = () => aplicarLayout();
  window.addEventListener('resize', S.onResize);
  if (!S._fsWired) { S._fsWired = true; document.addEventListener('fullscreenchange', onFsChange); document.addEventListener('webkitfullscreenchange', onFsChange); }
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
  if (S._cvObs) { try { S._cvObs.disconnect(); } catch (_) {} S._cvObs = null; }
  if (S.oleajeRAF) { try { cancelAnimationFrame(S.oleajeRAF); } catch (_) {} S.oleajeRAF = null; }
  if (S.barra) { try { S.barra.desmontar(); } catch (_) {} S.barra = null; }
  S.dibMontada = false;
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  S.chart = null;
  try { if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (_) {}
  const eb = document.getElementById('it-ultra-exit'); if (eb) eb.remove();
  const ov = document.getElementById('it-overlay'); if (ov) ov.remove();
  // Back SIEMPRE devuelve al selector de Analysis (no fuera): lo revelamos explícitamente.
  const sel = document.getElementById('an-sel'); if (sel) sel.style.display = '';
}

/* Back INTELIGENTE: si hay pantalla completa real del navegador o una ventana
   maximizada, Back sale de ESO y deja al usuario DENTRO de Institutional (no lo
   bota afuera). Solo cuando ya está en la vista normal, Back cierra la sección y
   vuelve al selector de Analysis. */
function backInteligente() {
  if (enFullscreen() || S.maxed) {
    if (enFullscreen()) salirUltra();
    if (S.maxed) { S.maxed = null; aplicarLayout(); setTimeout(() => pintarHeat({ instant: true }), 60); }
    return;
  }
  cerrar();
}

/* ── Plantilla ── */
const IC_ULTRA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
const IC_MAX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
const IC_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function ctrlPanel(id) {
  return `<div class="it-ph-ctrl">
    <button class="it-pbtn it-ultra" data-ultra="${id}" title="Ultra screen (full browser)">${IC_ULTRA}</button>
    <button class="it-pbtn it-max" data-max="${id}" title="Fullscreen">${IC_MAX}</button>
    <button class="it-pbtn it-x" data-close="${id}" title="Close">${IC_X}</button>
  </div>`;
}
function panel(id, titulo, extra) {
  return `<div class="it-panel" id="${id}">
    <div class="it-ph">
      <h4>${titulo}</h4>
      ${extra || ''}
      ${ctrlPanel(id)}
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
        ${ctrlPanel('it-p-chart')}
      </div>
      <div class="it-pb"><div class="it-cv" id="it-cv"><div class="it-legend" id="it-legend"></div></div></div>
      <span class="it-resize" data-rz></span>
    </div>
    ${panel('it-p-quote', 'QUOTE')}
    ${panel('it-p-watch', 'WATCHLIST')}
    ${panel('it-p-board', 'MARKET HEATMAP', '<div class="it-ph-r dim" style="font-family:var(--it-mono);font-size:10px;margin-left:8px">SIZE · 24H MOVE</div>')}
    ${panel('it-p-macro', 'SIGNALS')}
  </div>
  <div class="it-foot">
    <div>Institutional Analysis</div>
    <div>Live technical analysis · <button class="it-disc-link" id="it-disc-link" type="button">Disclaimer</button> · not financial advice</div>
  </div>`;
}

function cargando() { return '<div class="it-empty"><div class="it-spin"></div><span>Loading…</span></div>'; }
function vacio(t) { return `<div class="it-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 2 5-6"/></svg><b>No data</b><span>${esc(t || '')}</span></div>`; }
function logoHTML(cls2, p) {
  const url = p && p.cg && S.logos[p.cg];
  if (url) return `<i class="${cls2} con" style="background-image:url(${esc(url)})"></i>`;
  if (p && p.ico && ICONOS[p.ico]) return `<i class="${cls2} con-svg">${ICONOS[p.ico]}</i>`;   // divisas (EUR, GBP…)
  return `<i class="${cls2}">${esc((p && p.id || '?')[0])}</i>`;
}

/* ── Barra superior ── */
function pintarCoin() {
  const lg = document.getElementById('it-coin-lg'), id = document.getElementById('it-coin-id'), nm = document.getElementById('it-coin-nm');
  if (!lg) return;
  const url = S.par.cg && S.logos[S.par.cg];
  lg.classList.remove('con', 'con-svg');
  if (url) { lg.style.backgroundImage = `url(${url})`; lg.classList.add('con'); lg.textContent = ''; }
  else if (S.par.ico && ICONOS[S.par.ico]) { lg.style.backgroundImage = ''; lg.classList.add('con-svg'); lg.innerHTML = ICONOS[S.par.ico]; }   // divisas
  else { lg.style.backgroundImage = ''; lg.textContent = (S.par.id || '?')[0]; }
  if (id) id.textContent = S.par.id;
  if (nm) nm.textContent = S.par.n || '';
}

function cablearTop(ov) {
  $('#it-back', ov).onclick = backInteligente;
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
  const wr = document.querySelector('#it-p-watch-body tr[data-id="' + (S.par.id || '') + '"]'); if (wr) wr.classList.add('on');   // resalta la nueva al instante
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
  const item = (it) => `<button class="it-in-it ${S.ind[it.k] ? 'on' : ''}" data-k="${it.k}"><span class="it-in-ck">${S.ind[it.k] ? '✓' : ''}</span><span class="it-in-nm">${esc(it.nm)}</span>${it.sig ? '<span class="it-in-sig" title="Long/short signals">L/S</span>' : ''}</button>`;
  const grupo = (t, arr) => `<div class="it-pop-tit">${t}</div>` + arr.map(item).join('');
  const n = Object.values(S.ind).filter(Boolean).length;
  m.innerHTML = `<div class="it-in-head"><span>${n} active</span><button class="it-in-clear" type="button">Clear all</button></div>`
    + grupo('Moving averages', INDS.filter((i) => i.tipo === 'ma'))
    + grupo('Overlays & bands', INDS.filter((i) => i.tipo === 'overlay'))
    + grupo('Oscillators', INDS.filter((i) => i.tipo === 'pane'));
  document.body.appendChild(m); posicionar(m, ancla, true);
  m.querySelectorAll('.it-in-it').forEach((b) => b.onclick = () => {
    const k = b.dataset.k; S.ind[k] = !S.ind[k];
    b.classList.toggle('on', S.ind[k]); b.querySelector('.it-in-ck').textContent = S.ind[k] ? '✓' : '';
    const hc = m.querySelector('.it-in-head span'); if (hc) hc.textContent = Object.values(S.ind).filter(Boolean).length + ' active';
    actualizarIndBtn(); pintarChart();
  });
  const clr = m.querySelector('.it-in-clear');
  if (clr) clr.onclick = () => { S.ind = {}; actualizarIndBtn(); pintarChart(); cerrarPopups(); };
  cierreFuera(m, ancla);
}
function actualizarIndBtn() { const btn = document.getElementById('it-in-btn'); if (!btn) return; const n = Object.values(S.ind).filter(Boolean).length; btn.childNodes[0].nodeValue = 'Indicators' + (n ? ' · ' + n : '') + ' '; }

/* ── CHART ── */
async function cargarChart() {
  if (S.cargandoChart) return; S.cargandoChart = true;
  const title = document.getElementById('it-chart-title');
  if (title) title.textContent = 'CHART · ' + S.par.id + 'USD';
  try { S.velas = await D.velas(S.par.s, S.tf, 3000); }   // historial profundo PAGINADO (análisis / backtesting hacia atrás)
  catch (_) { S.velas = []; const cv = document.getElementById('it-cv'); if (cv) cv.innerHTML = '<div class="it-legend" id="it-legend"></div>' + vacio('Could not reach the market data feed.'); S.cargandoChart = false; return; }
  // velas en el formato de la barra de dibujo (t en segundos → la barra normaliza a ms)
  S.velasDib = S.velas.map((c) => ({ t: c.time, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume }));
  pintarChart();
  montarDibujo();            // la barra de herramientas (una vez)
  S.cargandoChart = false;
}

/* Asegura la leyenda y la marca de agua como capas persistentes del chart, SIN
   borrar la barra de dibujo (que vive como hermana dentro de #it-cv). */
function asegurarCapas(cv) {
  if (!document.getElementById('it-legend')) { const l = document.createElement('div'); l.className = 'it-legend'; l.id = 'it-legend'; cv.appendChild(l); }
  if (!cv.querySelector('.it-wm')) { const w = document.createElement('div'); w.className = 'it-wm'; w.setAttribute('aria-hidden', 'true'); w.innerHTML = '<img src="' + LOGO + '" onerror="this.onerror=null;this.src=\'' + LOGO_ALT + '\'">'; cv.appendChild(w); }
}

function pintarChart() {
  if (!window.LightweightCharts || !S.velas.length) return;
  const LC = window.LightweightCharts;
  const cv = document.getElementById('it-cv'); if (!cv) return;
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  S.chart = null; S.marks = []; S.marksApi = null;
  asegurarCapas(cv);

  const chart = LC.createChart(cv, {
    autoSize: true, localization: { locale: 'en' },
    layout: { background: { color: 'transparent' }, textColor: '#7d8794', fontFamily: '"Chakra Petch", ui-monospace, monospace', attributionLogo: false, panes: { separatorColor: '#232b35' } },
    grid: { vertLines: { color: 'rgba(35,43,53,.45)' }, horzLines: { color: 'rgba(35,43,53,.45)' } },
    rightPriceScale: { borderColor: '#232b35', scaleMargins: { top: 0.08, bottom: 0.08 }, mode: LC.PriceScaleMode ? LC.PriceScaleMode.Normal : 0 },
    timeScale: { borderColor: '#232b35', timeVisible: true, secondsVisible: false, barSpacing: 9, rightOffset: 6, minBarSpacing: 1 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  S.chart = chart; const V = S.velas;
  const vela = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e' });
  vela.setData(V.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))); S.serieVela = vela;
  const vol = chart.addSeries(LC.HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } });
  vol.priceScale().applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
  vol.setData(V.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(46,232,106,.26)' : 'rgba(255,91,110,.26)' })));

  const refs = [];
  const gap = (pts) => pts.map((p) => p.value == null ? { time: p.time } : { time: p.time, value: p.value });
  const linea = (nm, k, pts, color, pane, w, opt) => {
    if (!pts || !pts.length) return null;
    const s = chart.addSeries(LC.LineSeries, Object.assign({ color, lineWidth: w || 1, priceLineVisible: false, lastValueVisible: false }, opt || {}), pane || 0);
    s.setData(gap(pts)); if (nm) refs.push({ nm, k, serie: s, color }); return s;
  };
  // Los indicadores van en try/catch: si uno fallara, las velas SIEMPRE se dibujan.
  try {
    // ── Medias móviles ──
    if (S.ind.EMA9) linea('EMA 9', 'EMA9', ema(V, 9), '#f0b90b');
    if (S.ind.EMA20) linea('EMA 20', 'EMA20', ema(V, 20), '#4aa3ff');
    if (S.ind.EMA50) linea('EMA 50', 'EMA50', ema(V, 50), '#E8B84B');
    if (S.ind.EMA100) linea('EMA 100', 'EMA100', ema(V, 100), '#c678dd');
    if (S.ind.EMA200) linea('EMA 200', 'EMA200', ema(V, 200), '#ff5b6e', 0, 2);
    if (S.ind.SMA) linea('SMA 20', 'SMA', sma(V, 20), '#9fb0c2');
    if (S.ind.WMA) linea('WMA 20', 'WMA', wma(V, 20), '#38bdf8');
    if (S.ind.HMA) linea('HMA 20', 'HMA', hma(V, 20), '#a3e635', 0, 2);
    if (S.ind.DEMA) linea('DEMA 20', 'DEMA', dema(V, 20), '#fb7185');
    if (S.ind.TEMA) linea('TEMA 20', 'TEMA', tema(V, 20), '#e879f9');
    // ── Overlays con bandas / tendencia (coloreados; sin marcas L/S) ──
    if (S.ind.VWAP) { const vb = vwapBands(V, 2); linea('VWAP', 'VWAP', vb.mid, '#c678dd', 0, 2); linea(null, null, vb.up, 'rgba(198,120,221,.5)'); linea(null, null, vb.lo, 'rgba(198,120,221,.5)'); }
    if (S.ind.BOLL) { const b = bollinger(V, 20, 2); linea('Bollinger', 'BOLL', b.middle, 'rgba(150,160,175,.6)'); linea(null, null, b.upper, 'rgba(120,180,255,.65)'); linea(null, null, b.lower, 'rgba(120,180,255,.65)'); }
    if (S.ind.DONCH) { const d = donchian(V, 20); linea('Donchian', 'DONCH', d.upper, 'rgba(232,184,75,.6)'); linea(null, null, d.lower, 'rgba(232,184,75,.6)'); }
    if (S.ind.KELT) { const k = keltner(V, 20, 2); linea('Keltner', 'KELT', k.upper, 'rgba(198,120,221,.6)'); linea(null, null, k.middle, 'rgba(198,120,221,.3)'); linea(null, null, k.lower, 'rgba(198,120,221,.6)'); }
    // Parabolic SAR: puntos verdes (alcista) / rojos (bajista)
    if (S.ind.PSAR) {
      const ps = psar(V);
      linea('Parabolic SAR', 'PSAR', ps.map((p) => ({ time: p.time, value: p.dir === 1 ? p.value : null })), '#2ee86a', 0, 1, { pointMarkersVisible: true, lineVisible: false, pointMarkersRadius: 1.8 });
      linea(null, null, ps.map((p) => ({ time: p.time, value: p.dir === -1 ? p.value : null })), '#ff5b6e', 0, 1, { pointMarkersVisible: true, lineVisible: false, pointMarkersRadius: 1.8 });
    }
    // Supertrend: tramo verde (alcista) / rojo (bajista)
    if (S.ind.ST) {
      const st = supertrend(V, 10, 3);
      linea('Supertrend', 'ST', st.map((p) => ({ time: p.time, value: p.dir === 1 ? p.value : null })), '#2ee86a', 0, 2);
      linea(null, null, st.map((p) => ({ time: p.time, value: p.dir === -1 ? p.value : null })), '#ff5b6e', 0, 2);
    }
    // ── Osciladores en panel propio ──
    let pane = 1; const abrir = () => { const p = pane; pane++; try { const ps = chart.panes(); if (ps[p]) ps[p].setHeight(72); } catch (_) {} return p; };
    if (S.ind.RSI) linea('RSI 14', 'RSI', rsi(V, 14), '#E8B84B', abrir());
    if (S.ind.MACD) { const p = abrir(); const m = macd(V); chart.addSeries(LC.HistogramSeries, {}, p).setData(m.histogram.map((x) => ({ time: x.time, value: x.value, color: x.value >= 0 ? 'rgba(46,232,106,.5)' : 'rgba(255,91,110,.5)' }))); linea('MACD', 'MACD', m.macd, '#E8B84B', p); linea(null, null, m.signal, '#ffffff', p); }
    if (S.ind.STOCH) { const p = abrir(); const st = stochastic(V); linea('Stoch %K', 'STOCH', st.k, '#E8B84B', p); linea(null, null, st.d, '#4aa3ff', p); }
    if (S.ind.ATR) linea('ATR 14', 'ATR', atr(V, 14), '#c678dd', abrir());
    if (S.ind.CCI) linea('CCI 20', 'CCI', cci(V, 20), '#4aa3ff', abrir());
    if (S.ind.WILL) linea('Williams %R', 'WILL', williams(V, 14), '#E8B84B', abrir());
    if (S.ind.OBV) linea('OBV', 'OBV', obv(V), '#2ee86a', abrir());
    if (S.ind.ROC) linea('ROC 12', 'ROC', roc(V, 12), '#ff9f43', abrir());
    if (S.ind.ADX) { const p = abrir(); const a = adx(V, 14); linea('ADX 14', 'ADX', a.adx, '#E8B84B', p, 2); linea(null, null, a.plus, '#2ee86a', p); linea(null, null, a.minus, '#ff5b6e', p); }
    if (S.ind.MFI) linea('MFI 14', 'MFI', mfi(V, 14), '#38bdf8', abrir());
    if (S.ind.AO) { const p = abrir(); const ao = awesome(V); chart.addSeries(LC.HistogramSeries, {}, p).setData(ao.map((x, i) => ({ time: x.time, value: x.value, color: (i && ao[i - 1] && x.value >= ao[i - 1].value) ? 'rgba(46,232,106,.6)' : 'rgba(255,91,110,.6)' }))); refs.push({ nm: 'Awesome Osc.', k: 'AO', serie: null, color: '#9fb0c2' }); }
    if (S.ind.MOM) linea('Momentum', 'MOM', momentum(V, 10), '#a3e635', abrir());
    if (S.ind.STDDEV) linea('Std Deviation', 'STDDEV', stddev(V, 20), '#c678dd', abrir());
    if (S.ind.UO) linea('Ultimate Osc.', 'UO', ultimate(V), '#E8B84B', abrir());
    if (S.ind.CMF) linea('Chaikin MF', 'CMF', cmf(V, 20), '#38bdf8', abrir());
  } catch (_) {}

  S.legendRefs = refs;
  // Vista por defecto: ~190 velas recientes (mucha gráfica y legible), con miles más a la izquierda.
  try {
    const ts = chart.timeScale();
    const vis = Math.min(V.length, 190);
    ts.setVisibleLogicalRange({ from: V.length - vis, to: V.length + 2 });
    ts.subscribeVisibleLogicalRangeChange(() => sincronizarDib());
  } catch (_) {}
  pintarIndLegend();     // leyenda ESTÁTICA (solo indicadores activos, con ✕). Sin OHLC que salte con el cursor.
  sincronizarDib();
  calcularSenales();     // panel SIGNALS (rating técnico)
}

/* ── Puente con la barra de dibujo (misma de Smart/Heat/Liquidity Pools) ──
   Construye la geometría que esa barra espera { W,H,x1,y1,pMin,pMax,Y,ancho,
   paso,fin } a partir de la API de coordenadas de lightweight-charts (escala
   lineal), para que los trazos se peguen a precio/tiempo igual que allí. */
function geoDib() {
  const cv = document.getElementById('it-cv');
  if (!S.chart || !S.serieVela || !cv) return null;
  let ts; try { ts = S.chart.timeScale(); } catch (_) { return null; }
  const W = cv.clientWidth, H = cv.clientHeight;
  let x1; try { x1 = ts.width(); } catch (_) { x1 = W; }
  if (!(x1 > 0)) x1 = W;
  let y1; try { const p = S.chart.panes(); y1 = (p && p[0]) ? p[0].getHeight() : H; } catch (_) { y1 = H; }
  if (!(y1 > 0)) y1 = H;
  let vr; try { vr = ts.getVisibleLogicalRange(); } catch (_) { vr = null; }
  if (!vr) return null;
  const nV = S.velas.length;
  let iA = Math.max(0, Math.min(nV - 1, Math.ceil(vr.from)));
  let iB = Math.max(0, Math.min(nV - 1, iA + 1));
  let paso, b;
  const xA = ts.logicalToCoordinate(iA), xB = ts.logicalToCoordinate(iB);
  if (xA == null || xB == null || iB === iA) { paso = (ts.options().barSpacing) || 9; b = (xA != null) ? xA - paso * iA : 0; }
  else { paso = (xB - xA) / (iB - iA); b = xA - paso * iA; }
  if (!(paso > 0)) paso = 9;
  const pri = 0.5 - b / paso;
  const ancho = x1 / paso;
  const fin = pri + ancho;
  const pMax = S.serieVela.coordinateToPrice(0);
  const pMin = S.serieVela.coordinateToPrice(y1);
  const Y = (p) => { const c = S.serieVela.priceToCoordinate(p); return (c == null) ? (y1 * (pMax - p) / ((pMax - pMin) || 1)) : c; };
  if (pMax == null || pMin == null) return null;
  return { W, H, x1, y1, pMin, pMax, Y, ancho, paso, fin };
}
let _syncPend = false;
function sincronizarDib() {
  if (!S.barra) return;
  if (_syncPend) return; _syncPend = true;
  requestAnimationFrame(() => { _syncPend = false; const g = geoDib(); if (g) try { S.barra.redibujar(g, S.velasDib, S.par.id); } catch (_) {} });
}
async function montarDibujo() {
  if (S.dibMontada) { sincronizarDib(); return; }
  const cv = document.getElementById('it-cv'); if (!cv) return;
  const mb = await cargarBarra(); if (!mb) return;
  try {
    S.barra = mb(cv);
    if (S.barra && S.barra._tools) S.barra._tools.classList.add('nv-oculta');   // auto-ocultable, con pestaña (no come gráfica)
    // estado.js arranca con par:'BTC' y sin 'dibujos'; si el 1.er par coincide,
    // la barra no dispara cargarDib → lo inicializamos aquí para la moneda actual.
    try { if (_nivN && _cargarDib) { _nivN.par = S.par.id; _cargarDib(); } } catch (_) {}
    S.dibMontada = true;
    if (window.ResizeObserver && !S._cvObs) { S._cvObs = new ResizeObserver(() => sincronizarDib()); S._cvObs.observe(cv); }
    sincronizarDib();
  } catch (_) { S.barra = null; }
}

/* Leyenda ESTÁTICA: solo la lista de indicadores activos, cada uno con su ✕.
   No se reconstruye al mover el cursor (antes el OHLC cambiaba de ancho en cada
   frame y la ✕ "bailaba", imposible de pulsar). */
function pintarIndLegend() {
  const el = document.getElementById('it-legend'); if (!el) return;
  const refs = (S.legendRefs || []).filter((r) => r.nm && r.k);
  el.innerHTML = refs.map((r) => `<div class="ind"><span class="dot" style="background:${r.color}"></span><span class="lbl">${esc(r.nm)}</span><button class="it-leg-x" data-k="${esc(r.k)}" title="Remove indicator" aria-label="Remove ${esc(r.nm)}">&times;</button></div>`).join('');
  el.querySelectorAll('.it-leg-x').forEach((b) => b.onclick = (e) => { e.stopPropagation(); e.preventDefault(); S.ind[b.dataset.k] = false; actualizarIndBtn(); pintarChart(); });
}

function exportar() {
  if (!S.chart) { return; }
  let src; try { src = S.chart.takeScreenshot(); } catch (_) { return; }
  const cv = document.getElementById('it-cv');
  const e2 = (cv && cv.clientWidth) ? (src.width / cv.clientWidth) : 1;
  const Hh = Math.round(46 * e2);      // cabecera: par · tf + precio
  const barra = Math.round(78 * e2);   // pie con la marca — uniforme con Heat/Liquidity Pools
  const out = document.createElement('canvas');
  out.width = src.width; out.height = Hh + src.height + barra;
  const g = out.getContext('2d');
  g.fillStyle = '#0a0e14'; g.fillRect(0, 0, out.width, out.height);

  // ── cabecera superior: par · tf (izq) + precio (der) ──
  const tf = (D.TFS.find((t) => t.id === S.tf) || {}).n || S.tf;
  g.textAlign = 'left'; g.fillStyle = '#E8B84B'; g.font = `800 ${18 * e2}px "Chakra Petch", system-ui, monospace`;
  g.fillText(S.par.id + 'USD · ' + tf, 16 * e2, 30 * e2);
  if (S.ultTicker) { g.textAlign = 'right'; g.fillStyle = '#eaecef'; g.fillText(fmtP(S.ultTicker.last) + '  ' + fmtPct(S.ultTicker.chgPct), out.width - 16 * e2, 30 * e2); }

  // ── chart ──
  g.drawImage(src, 0, Hh);

  // ── pie de página con la marca (logo + nombre + dominio · par·tf + fecha) ──
  const yB = Hh + src.height;
  g.fillStyle = '#0b0e12'; g.fillRect(0, yB, out.width, barra);
  g.fillStyle = 'rgba(232,184,75,.35)'; g.fillRect(0, yB, out.width, 2 * e2);

  const textos = (x) => {
    g.textAlign = 'left';
    g.fillStyle = '#E8B84B';
    g.font = `800 ${19 * e2}px system-ui,sans-serif`;
    g.fillText('Institutional Analysis', x, yB + 34 * e2);
    g.font = `700 ${14 * e2}px ui-monospace,monospace`;
    g.fillStyle = '#C9A84B';
    g.fillText('decfreedom.com', x, yB + 56 * e2);
    g.textAlign = 'right';
    g.fillStyle = '#8b96a3';
    g.font = `700 ${14 * e2}px ui-monospace,monospace`;
    g.fillText(`${S.par.id} · ${tf}`, out.width - 20 * e2, yB + 34 * e2);
    g.font = `${11 * e2}px ui-monospace,monospace`;
    g.fillStyle = '#6b7681';
    g.fillText(new Date().toLocaleString('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      out.width - 20 * e2, yB + 56 * e2);
    g.textAlign = 'left';
  };

  const bajar = () => out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `decfreedom-institutional-${S.par.id}-${S.tf}-${Date.now()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, 'image/png');

  const logo = new Image();
  let hecho = false;
  const una = (w) => { if (hecho) return; hecho = true; textos(w ? 20 * e2 + w + 18 * e2 : 20 * e2); bajar(); };
  logo.onload = () => {
    try {
      const alto = 52 * e2;
      const ancho = Math.round(logo.width * (alto / logo.height));
      g.drawImage(logo, 20 * e2, yB + (barra - alto) / 2, ancho, alto);
      una(ancho);
    } catch (_) { una(0); }
  };
  logo.onerror = () => una(0);
  setTimeout(() => una(0), 1500);
  logo.src = LOGO;
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
  // TODAS las monedas cripto (las de Binance con par USDT), con las de referencia
  // arriba. La tabla se construye UNA sola vez y luego se actualizan las celdas
  // por símbolo: nunca se reconstruye en cada refresco → no se pierde el scroll
  // ni la fila seleccionada.
  const cripto = D.PARES.filter((p) => p.grupo !== 'divisa' && p.grupo !== 'materia');
  const top = LISTA_WATCH.map((id) => cripto.find((p) => p.id === id)).filter(Boolean);
  const pares = top.concat(cripto.filter((p) => !LISTA_WATCH.includes(p.id)));
  let ts; try { ts = await D.tickers(pares.map((p) => p.s)); } catch (_) { if (body.querySelector('.it-spin')) body.innerHTML = vacio('Watchlist feed unavailable.'); return; }
  const map = {}; ts.forEach((t) => { map[t.simbolo] = t; });
  let tb = body.querySelector('.it-tbl tbody');
  if (!tb) {
    const rows = pares.map((p) => `<tr data-id="${esc(p.id)}" data-s="${esc(p.s)}"${p.id === S.par.id ? ' class="on"' : ''}><td><div class="sym">${logoHTML('it-mini-lg', p)}<b class="gold">${esc(p.id)}</b></div></td><td class="w-last">—</td><td class="w-chg dim">—</td></tr>`).join('');
    body.innerHTML = `<table class="it-tbl"><thead><tr><th>Symbol</th><th>Last</th><th>24h</th></tr></thead><tbody>${rows}</tbody></table>`;
    tb = body.querySelector('.it-tbl tbody');
    tb.querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => {
      const p = D.PARES.find((x) => x.id === tr.dataset.id); if (!p) return;
      tb.querySelectorAll('tr.on').forEach((r) => r.classList.remove('on')); tr.classList.add('on');   // selección instantánea
      setSimbolo(p);
    });
  }
  tb.querySelectorAll('tr[data-id]').forEach((tr) => {
    const t = map[tr.dataset.s];
    const last = tr.querySelector('.w-last'), chg = tr.querySelector('.w-chg');
    if (t) { if (last) last.textContent = fmtP(t.last); if (chg) { chg.textContent = fmtPct(t.chgPct); chg.className = 'w-chg ' + cls(t.chgPct); } }
    tr.classList.toggle('on', tr.dataset.id === S.par.id);
  });
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
/* Treemap con ACTUALIZACIÓN POR CLAVE: los tiles no se recrean en cada refresco,
   se reposicionan/redimensionan con transición CSS (animación de crecer/encoger).
   El texto se ESCALA al tamaño del tile (se reduce, no se elimina). */
function pintarHeat(opts) {
  const body = document.getElementById('it-p-board-body'); if (!body || !S.board.length) return;
  const W = body.clientWidth, H = body.clientHeight; if (W < 10 || H < 10) return;
  // Al redimensionar la ventana NO se anima (evita el "tranque"); solo al refrescar datos.
  const instant = !!(opts && opts.instant);
  body.classList.toggle('it-hm-noanim', instant);
  const items = S.board.map((c) => ({ ...c, v: Math.abs(c.chg24 || 0) + 0.3 }));
  const laid = treemap(items, W, H);
  const tinte = (ch) => { const x = Math.max(-10, Math.min(10, ch || 0)) / 10; return x >= 0 ? `rgba(40,210,100,${(0.16 + x * 0.6).toFixed(3)})` : `rgba(240,70,90,${(0.16 + (-x) * 0.6).toFixed(3)})`; };
  S.tileEls = S.tileEls || {};
  const vivos = {};
  laid.forEach((c) => {
    const w = Math.max(0, c.w - 4), h = Math.max(0, c.h - 4);   // 4px gap → respira
    const sym = String(c.simbolo || ''); vivos[sym] = 1;
    let el = S.tileEls[sym]; if (el && !el.isConnected) el = null;
    const nuevo = !el;
    if (nuevo) {
      el = document.createElement('div'); el.className = 'it-tile it-tile-in'; el.dataset.sym = sym;
      el.onclick = () => { const p = D.PARES.find((x) => x.cg && x.cg === el.dataset.cg) || D.PARES.find((x) => x.id === el.dataset.sym); if (p) setSimbolo(p); };
      body.appendChild(el); S.tileEls[sym] = el;
    }
    el.dataset.cg = c.id;
    // ── Escritura por DIFF: solo se toca lo que cambió (transiciones suaves, sin trabas) ──
    if (el._x !== c.x) { el.style.left = c.x + 'px'; el._x = c.x; }
    if (el._y !== c.y) { el.style.top = c.y + 'px'; el._y = c.y; }
    if (el._w !== w) { el.style.width = w + 'px'; el._w = w; }
    if (el._h !== h) { el.style.height = h + 'px'; el._h = h; }
    const bg = tinte(c.chg24); if (el._bg !== bg) { el.style.background = bg; el._bg = bg; }
    const on = (c.id === S.par.cg || sym === S.par.id); if (el._on !== on) { el.classList.toggle('on', on); el._on = on; }
    el.title = sym + '  ' + fmtPct(c.chg24);
    // ── Tipografía PROFESIONAL: moderada, con jerarquía clara (símbolo > %), sin precio ──
    const base = Math.min(w, h);
    let fSym = Math.min(base * 0.19, (w - 10) / Math.max(1, sym.length * 0.62));
    fSym = Math.max(8.5, Math.min(fSym, 34));
    const fPct = Math.max(7, Math.min(fSym * 0.52, 15));
    const verSym = w > 20 && h > 15 && (w - 6) / Math.max(1, sym.length * 0.62) >= 7;
    const verPct = verSym && h > fSym + fPct + 11 && w > 34;
    const pad = base < 30 ? 2 : (base < 70 ? 4 : 7);
    let inner = '';
    if (verSym) {
      inner = `<b style="font-size:${fSym.toFixed(1)}px">${esc(sym)}</b>`;
      if (verPct) inner += `<em style="font-size:${fPct.toFixed(1)}px;color:${(c.chg24 || 0) >= 0 ? '#c9ffe0' : '#ffd2d8'}">${fmtPct(c.chg24)}</em>`;
    }
    if (el._pad !== pad) { el.style.padding = pad + 'px'; el._pad = pad; }
    if (el._txt !== inner) { el.innerHTML = inner; el._txt = inner; }
    if (nuevo) requestAnimationFrame(() => el.classList.remove('it-tile-in'));
  });
  Object.keys(S.tileEls).forEach((sym) => { if (!vivos[sym]) { try { S.tileEls[sym].remove(); } catch (_) {} delete S.tileEls[sym]; } });
  if (!body.querySelector('.it-hm-wm')) { const wm = document.createElement('div'); wm.className = 'it-hm-wm'; wm.innerHTML = `<img src="${LOGO}" onerror="this.onerror=null;this.src='${LOGO_ALT}'">`; body.appendChild(wm); }
}

/* "Oleaje" orgánico del heatmap: ondas de brillo que nacen en puntos que van
   cambiando (impredecible), recorren las casillas como un enjambre/ola y se
   desvanecen; las casillas pequeñas realzan un pelín más (de pequeña a grande).
   Es solo filter (GPU), ~25fps → estético y barato. Se usa en pantalla completa. */
function iniciarOleaje() {
  if (S.oleajeRAF) return;
  const rnd = () => Math.random();
  const nuevoOrigen = (now) => {
    const abajoDer = rnd() < 0.5;   // sesgo hacia la zona de casillas pequeñas (abajo-der)
    return { x: abajoDer ? 0.55 + rnd() * 0.45 : rnd(), y: abajoDer ? 0.55 + rnd() * 0.45 : rnd(), t0: now, vida: 3800 + rnd() * 5200, speed: 0.85 + rnd() * 0.85 };
  };
  let origenes = [nuevoOrigen(performance.now() - 2600), nuevoOrigen(performance.now() - 1300), nuevoOrigen(performance.now())];
  let last = 0;
  const paso = (now) => {
    S.oleajeRAF = requestAnimationFrame(paso);
    if (now - last < 40) return; last = now;    // ~25fps
    const body = document.getElementById('it-p-board-body');
    if (!body || !S.tileEls || body.offsetParent === null) return;
    const W = body.clientWidth || 1, H = body.clientHeight || 1, diag = Math.hypot(W, H) || 1;
    origenes = origenes.map((o) => (now - o.t0 > o.vida) ? nuevoOrigen(now) : o);
    for (const sym in S.tileEls) {
      const el = S.tileEls[sym]; if (!el || !el.isConnected) continue;
      const w = parseFloat(el.style.width) || 0, h = parseFloat(el.style.height) || 0;
      const cx = (parseFloat(el.style.left) || 0) + w / 2, cy = (parseFloat(el.style.top) || 0) + h / 2;
      let inten = 0;
      for (const o of origenes) {
        const age = (now - o.t0) / 1000;
        const front = age * o.speed;
        const d = Math.hypot(cx - o.x * W, cy - o.y * H) / diag;
        const dd = d - front;
        inten += Math.exp(-(dd * dd) * 11) * Math.max(0, 1 - age / (o.vida / 1000));
      }
      const chico = (w * h) < 4200 ? 1.3 : 1;
      inten = Math.min(1, inten * chico);
      el.style.filter = inten > 0.02 ? `brightness(${(1 + inten * 0.24).toFixed(3)}) saturate(${(1 + inten * 0.28).toFixed(3)})` : '';
    }
  };
  S.oleajeRAF = requestAnimationFrame(paso);
}
async function cargarBoard() {
  const body = document.getElementById('it-p-board-body'); if (!body) return;
  let b; try { b = await D.board(); } catch (_) { if (!Object.keys(S.tileEls || {}).length && body.querySelector('.it-spin')) body.innerHTML = vacio('Market board unavailable.'); return; }
  if (!b || !b.length) { if (!Object.keys(S.tileEls || {}).length) body.innerHTML = vacio('No market data.'); return; }
  S.board = b;
  body.style.overflow = 'hidden';
  if (body.querySelector('.it-empty')) { body.innerHTML = ''; S.tileEls = {}; }   // quita el spinner inicial antes del 1.er render
  pintarHeat();
  iniciarOleaje();
  if (!S.boardObs && window.ResizeObserver) { S.boardObs = new ResizeObserver(() => pintarHeat({ instant: true })); S.boardObs.observe(body); }
}

/* ── MACRO ── */
/* ══ SIGNALS — Rating técnico (lo "premium": resumen accionable multi-TF) ══
   Agrega osciladores y medias en un veredicto Strong Buy … Strong Sell, igual
   que el panel de Análisis Técnico de los terminales profesionales, y lo cruza
   en 1h/4h/1d (confluencia). Todo del lado del cliente, sobre las mismas velas. */
const SIG_TFS = ['1h', '4h', '1d'];
function ratingDe(V) {
  if (!V || V.length < 60) return null;
  const last = V[V.length - 1].close;
  const ult = (arr) => (arr && arr.length) ? arr[arr.length - 1].value : null;
  let osB = 0, osS = 0, osN = 0, maB = 0, maS = 0, maN = 0;
  const osc = (v, buy, sell) => { if (v == null) { osN++; return; } if (buy(v)) osB++; else if (sell(v)) osS++; else osN++; };
  try {
    osc(ult(rsi(V, 14)), (v) => v < 30, (v) => v > 70);
    osc(ult(stochastic(V).k), (v) => v < 20, (v) => v > 80);
    osc(ult(cci(V, 20)), (v) => v < -100, (v) => v > 100);
    osc(ult(williams(V, 14)), (v) => v < -80, (v) => v > -20);
    const mc = macd(V); const md = ult(mc.macd), sg = ult(mc.signal); osc(md != null && sg != null ? md - sg : null, (v) => v > 0, (v) => v < 0);
    osc(ult(momentum(V, 10)), (v) => v > 0, (v) => v < 0);
    osc(ult(ultimate(V)), (v) => v < 30, (v) => v > 70);
    osc(ult(awesome(V)), (v) => v > 0, (v) => v < 0);
    [[9, ema], [20, ema], [50, ema], [100, ema], [200, ema], [20, sma], [50, sma]].forEach(([p, fn]) => { const m = ult(fn(V, p)); if (m == null) { maN++; return; } if (last > m) maB++; else if (last < m) maS++; else maN++; });
  } catch (_) {}
  const total = osB + osS + osN + maB + maS + maN || 1;
  const norm = (osB + maB - osS - maS) / total;
  let rating, nivel;
  if (norm >= 0.4) { rating = 'STRONG BUY'; nivel = 2; } else if (norm >= 0.12) { rating = 'BUY'; nivel = 1; }
  else if (norm > -0.12) { rating = 'NEUTRAL'; nivel = 0; } else if (norm > -0.4) { rating = 'SELL'; nivel = -1; } else { rating = 'STRONG SELL'; nivel = -2; }
  return { rating, nivel, norm, osB, osS, osN, maB, maS, maN };
}
const SIG_COL = (n) => n > 0 ? '#2ee86a' : n < 0 ? '#ff5b6e' : '#E8B84B';
function calcularSenales() {
  const r = ratingDe(S.velas);
  S.senal = r;
  if (S.senalPar !== S.par.id) {    // confluencia 1h/4h/1d: se recalcula al cambiar de moneda
    S.senalPar = S.par.id; S.senalTF = {};
    SIG_TFS.forEach((tf) => {
      D.velas(S.par.s, tf, 300).then((v) => { S.senalTF[tf] = ratingDe(v); pintarSignals(); }).catch(() => {});
    });
  }
  pintarSignals();
}
function asegurarMacro() {
  const body = document.getElementById('it-p-macro-body'); if (!body) return null;
  if (!document.getElementById('it-sig')) body.innerHTML = '<div id="it-sig"></div><div id="it-macro-data"></div>';
  return body;
}
function pintarSignals() {
  if (!asegurarMacro()) return;
  const el = document.getElementById('it-sig'); if (!el) return;
  const r = S.senal;
  if (!r) { el.innerHTML = '<div class="it-sig-wrap"><div class="it-sig-lead">SIGNALS</div><div class="dim" style="font-family:var(--it-mono);font-size:11px;padding:4px 0">Not enough data.</div></div>'; return; }
  const col = SIG_COL(r.nivel);
  const segs = ['STRONG SELL', 'SELL', 'NEUTRAL', 'BUY', 'STRONG BUY'];
  const activeIdx = r.nivel + 2;
  const barra = segs.map((s, i) => `<span class="it-sig-seg ${i === activeIdx ? 'on' : ''}" style="--c:${SIG_COL(i - 2)}"></span>`).join('');
  const conf = SIG_TFS.map((tf) => {
    const rr = (S.senalTF || {})[tf];
    const c = rr ? SIG_COL(rr.nivel) : '#4a525c';
    const lbl = rr ? rr.rating.replace('STRONG ', 'S.') : '…';
    return `<div class="it-sig-tf"><b>${esc(tf.toUpperCase())}</b><span style="color:${c}">${esc(lbl)}</span></div>`;
  }).join('');
  const cuenta = (b, n, s) => `<div class="it-sig-cnt"><span class="up">${b}</span><span class="dim">${n}</span><span class="down">${s}</span></div>`;
  el.innerHTML = `<div class="it-sig-wrap">
    <div class="it-sig-top"><span class="it-sig-lead">TECHNICAL RATING</span><span class="it-sig-tfnow">${esc(((D.TFS.find((t) => t.id === S.tf) || {}).n || S.tf))}</span></div>
    <div class="it-sig-verdict" style="color:${col};text-shadow:0 0 18px ${col}66">${esc(r.rating)}</div>
    <div class="it-sig-bar">${barra}</div>
    <div class="it-sig-grid">
      <div class="it-sig-box"><span class="t">Oscillators</span>${cuenta(r.osB, r.osN, r.osS)}</div>
      <div class="it-sig-box"><span class="t">Moving avg.</span>${cuenta(r.maB, r.maN, r.maS)}</div>
    </div>
    <div class="it-sig-conf-tit">Multi-timeframe confluence</div>
    <div class="it-sig-conf">${conf}</div>
  </div>`;
}

async function cargarMacro() {
  if (!asegurarMacro()) return;
  const body = document.getElementById('it-macro-data'); if (!body) return;
  let g = null, fg = null; try { g = await D.global(); } catch (_) {} try { fg = await D.fearGreed(); } catch (_) {}
  if (!g && !fg) { if (!body.innerHTML) body.innerHTML = ''; return; }
  const row = (k, v, c) => `<div class="it-macro-row"><span class="k">${k}</span><span class="v ${c || ''}">${v}</span></div>`;
  let html = '<div class="it-macro-tit">Market &amp; sentiment</div>';
  if (fg) html += `<div class="it-macro-row" style="flex-direction:column;align-items:stretch;gap:5px"><div style="display:flex;justify-content:space-between"><span class="k">Fear &amp; Greed</span><span class="v ${fg.valor >= 50 ? 'up' : 'down'}">${fg.valor} · ${esc(fg.etiqueta)}</span></div><div class="it-gauge"><div class="pin" style="left:${Math.max(0, Math.min(100, fg.valor))}%"></div></div></div>`;
  if (g) {
    html += row('24h cap change', fmtPct(g.mcapChg), cls(g.mcapChg));
    html += row('BTC dominance', g.btcDom != null ? g.btcDom.toFixed(1) + '%' : '—', 'gold');
    html += row('Total market cap', fmtBig(g.totalMcap), g.mcapChg >= 0 ? 'up' : 'down');
  }
  body.innerHTML = `<div class="it-macro">${html}</div>`;
}

/* ── VENTANAS: z-index propio, traer-al-frente, maximizar, cerrar, redimensionar ── */
// La GRÁFICA domina (73% × 72%): máximo espacio para análisis/backtesting.
const DEF_LAYOUT = {
  'it-p-chart': [0.006, 0.01, 0.73, 0.72], 'it-p-quote': [0.742, 0.01, 0.252, 0.30],
  'it-p-watch': [0.742, 0.315, 0.252, 0.30], 'it-p-board': [0.006, 0.735, 0.73, 0.255],
  'it-p-macro': [0.742, 0.62, 0.252, 0.37]
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
  setTimeout(() => pintarHeat({ instant: true }), 30);
}
function traerFrente(el) { if (window.innerWidth < 980) return; el.style.zIndex = ++S.zTop; }
function maximizar(id) { S.maxed = (S.maxed === id) ? null : id; aplicarLayout(); setTimeout(() => pintarHeat({ instant: true }), 60); }
function cerrarPanel(id) { S.hidden[id] = true; if (S.maxed === id) S.maxed = null; const el = document.getElementById(id); if (el) el.style.display = 'none'; }

/* ── Ultra screen: fullscreen REAL del navegador (sin barras), con la ventana
   maximizada. Un botón flotante vuelve al modo normal (fullscreen regular). ── */
function enFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function entrarUltra(id) {
  const ov = document.getElementById('it-overlay'); if (!ov) return;
  S.maxed = id; aplicarLayout(); setTimeout(() => pintarHeat({ instant: true }), 60);
  const req = ov.requestFullscreen || ov.webkitRequestFullscreen || ov.msRequestFullscreen;
  if (req) { try { const r = req.call(ov); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
  else { onFsChange(); }   // sin API: al menos muestra el botón de salida
}
function salirUltra() {
  try { if (enFullscreen()) { const ex = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen; ex.call(document); } } catch (_) {}
  onFsChange();
}
function onFsChange() {
  const ov = document.getElementById('it-overlay'); if (!ov) return;
  let btn = document.getElementById('it-ultra-exit');
  if (enFullscreen()) {
    ov.dataset.ultra = '1';
    if (!btn) {
      btn = document.createElement('button'); btn.id = 'it-ultra-exit'; btn.className = 'it-ultra-exit'; btn.title = 'Exit ultra screen';
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>';
      btn.onclick = (e) => { e.stopPropagation(); salirUltra(); };
      ov.appendChild(btn);
    }
  } else {
    ov.dataset.ultra = '';
    if (btn) btn.remove();
  }
  // El grid cambia de tamaño (se ocultan barra/pie/encabezados): recomputar ventanas.
  try { aplicarLayout(); } catch (_) {}
  setTimeout(() => pintarHeat({ instant: true }), 50);
}
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
    else { el.style.width = Math.max(220, Math.min(W - sl, sw + dx)) + 'px'; el.style.height = Math.max(140, Math.min(H - st, sh + dy)) + 'px'; if (el.id === 'it-p-board') pintarHeat({ instant: true }); }
    e.preventDefault();
  };
  const soltar = () => {
    if (!modo || !el) return; const W = grid.clientWidth, H = grid.clientHeight;
    S.layout = S.layout || JSON.parse(JSON.stringify(DEF_LAYOUT));
    S.layout[el.id] = [parseFloat(el.style.left) / W, parseFloat(el.style.top) / H, parseFloat(el.style.width) / W, parseFloat(el.style.height) / H];
    guardarLayout(); el.classList.remove('it-dragging'); if (el.id === 'it-p-board') pintarHeat({ instant: true });
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
    const ul = panel.querySelector('.it-ultra'); if (ul) ul.onclick = (e) => { e.stopPropagation(); entrarUltra(panel.id); };
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
