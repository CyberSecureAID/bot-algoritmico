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

import { estilos } from './estilos.js?v=4';
import * as D from './datos.js?v=3';
import { sma, ema, wma, hma, dema, tema, vwap, rsi, macd, bollinger, stochastic, atr, cci, williams, obv, roc, donchian, keltner, supertrend, psar, adx, mfi, awesome, momentum, stddev, ultimate, cmf } from './indicadores.js?v=4';

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
  if (S._cvObs) { try { S._cvObs.disconnect(); } catch (_) {} S._cvObs = null; }
  if (S.barra) { try { S.barra.desmontar(); } catch (_) {} S.barra = null; }
  S.dibMontada = false;
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
  try { S.velas = await D.velas(S.par.s, S.tf, 1000); }   // más historial para desplazar a la izquierda
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
  const mapa = (pts) => { const m = {}; pts.forEach((p) => { m[p.time] = p.value; }); return m; };
  const gap = (pts) => pts.map((p) => p.value == null ? { time: p.time } : { time: p.time, value: p.value });
  const linea = (nm, k, pts, color, pane, w, opt) => {
    if (!pts || !pts.length) return null;
    const s = chart.addSeries(LC.LineSeries, Object.assign({ color, lineWidth: w || 1, priceLineVisible: false, lastValueVisible: false }, opt || {}), pane || 0);
    s.setData(gap(pts)); if (nm) refs.push({ nm, k, serie: s, color }); return s;
  };
  const long = (t) => S.marks.push({ time: t, position: 'belowBar', color: '#2ee86a', shape: 'arrowUp', text: 'L' });
  const short = (t) => S.marks.push({ time: t, position: 'aboveBar', color: '#ff5b6e', shape: 'arrowDown', text: 'S' });

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

  // ── VWAP + tachuelas (cruce de la línea morada) ──
  if (S.ind.VWAP) {
    const vw = vwap(V); linea('VWAP', 'VWAP', vw, '#c678dd', 0, 2);
    const mv = mapa(vw);
    for (let i = 1; i < V.length; i++) { const a = mv[V[i].time], pa = mv[V[i - 1].time]; if (a == null || pa == null) continue; const c = V[i].close, pc = V[i - 1].close; if (pc <= pa && c > a) short(V[i].time); else if (pc >= pa && c < a) long(V[i].time); }
  }
  // ── Bollinger: señal filtrada por tendencia (alcista→long, bajista→short) ──
  if (S.ind.BOLL) {
    const b = bollinger(V, 20, 2); linea('Bollinger', 'BOLL', b.middle, 'rgba(150,160,175,.6)'); linea(null, null, b.upper, 'rgba(120,180,255,.65)'); linea(null, null, b.lower, 'rgba(120,180,255,.65)');
    const mm = mapa(b.middle), mu = mapa(b.upper), ml = mapa(b.lower);
    for (let i = 1; i < V.length; i++) {
      const mid = mm[V[i].time], pmid = mm[V[i - 1].time]; if (mid == null || pmid == null) continue;
      const alza = mid > pmid, c = V[i].close, pc = V[i - 1].close, lo = ml[V[i].time], pl = ml[V[i - 1].time], u = mu[V[i].time], pu = mu[V[i - 1].time];
      if (alza && lo != null && pl != null && pc >= pl && c < lo) long(V[i].time);
      else if (!alza && u != null && pu != null && pc <= pu && c > u) short(V[i].time);
    }
  }
  if (S.ind.DONCH) { const d = donchian(V, 20); linea('Donchian', 'DONCH', d.upper, 'rgba(232,184,75,.6)'); linea(null, null, d.lower, 'rgba(232,184,75,.6)'); }
  // ── Keltner: long al perforar la banda inferior, short al perforar la superior ──
  if (S.ind.KELT) {
    const k = keltner(V, 20, 2); linea('Keltner', 'KELT', k.upper, 'rgba(198,120,221,.6)'); linea(null, null, k.middle, 'rgba(198,120,221,.3)'); linea(null, null, k.lower, 'rgba(198,120,221,.6)');
    const mu = mapa(k.upper), ml = mapa(k.lower);
    for (let i = 1; i < V.length; i++) { const u = mu[V[i].time], lo = ml[V[i].time], pu = mu[V[i - 1].time], pl = ml[V[i - 1].time], c = V[i].close, pc = V[i - 1].close; if (lo != null && pl != null && pc >= pl && c < lo) long(V[i].time); if (u != null && pu != null && pc <= pu && c > u) short(V[i].time); }
  }
  // ── Parabolic SAR: puntos verdes (alcista) / rojos (bajista) + giro ──
  if (S.ind.PSAR) {
    const ps = psar(V);
    linea('Parabolic SAR', 'PSAR', ps.map((p) => ({ time: p.time, value: p.dir === 1 ? p.value : null })), '#2ee86a', 0, 1, { pointMarkersVisible: true, lineVisible: false, pointMarkersRadius: 1.6 });
    linea(null, null, ps.map((p) => ({ time: p.time, value: p.dir === -1 ? p.value : null })), '#ff5b6e', 0, 1, { pointMarkersVisible: true, lineVisible: false, pointMarkersRadius: 1.6 });
    for (let i = 1; i < ps.length; i++) { if (ps[i].dir === 1 && ps[i - 1].dir === -1) long(ps[i].time); if (ps[i].dir === -1 && ps[i - 1].dir === 1) short(ps[i].time); }
  }
  // ── Supertrend: tramo verde (long) / rojo (short) + alerta en cada giro ──
  if (S.ind.ST) {
    const st = supertrend(V, 10, 3);
    const sUp = linea('Supertrend', 'ST', st.map((p) => ({ time: p.time, value: p.dir === 1 ? p.value : null })), '#2ee86a', 0, 2);
    linea(null, null, st.map((p) => ({ time: p.time, value: p.dir === -1 ? p.value : null })), '#ff5b6e', 0, 2);
    for (let i = 1; i < st.length; i++) { if (st[i].dir === 1 && st[i - 1].dir === -1) long(st[i].time); if (st[i].dir === -1 && st[i - 1].dir === 1) short(st[i].time); }
  }

  // ── Osciladores en panel propio ──
  let pane = 1; const abrir = () => { const p = pane; pane++; try { const ps = chart.panes(); if (ps[p]) ps[p].setHeight(76); } catch (_) {} return p; };
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

  // marcas long/short (una sola colección, ordenada por tiempo)
  if (S.marks.length) { S.marks.sort((a, b) => a.time - b.time); try { S.marksApi = LC.createSeriesMarkers ? LC.createSeriesMarkers(vela, S.marks) : (vela.setMarkers && vela.setMarkers(S.marks)); } catch (_) {} }

  S.legendRefs = refs;
  // Vista por defecto LEGIBLE: ~140 velas recientes grandes, con historial a la izquierda.
  try {
    const ts = chart.timeScale();
    const vis = Math.min(V.length, 140);
    ts.setVisibleLogicalRange({ from: V.length - vis, to: V.length + 4 });
    ts.subscribeVisibleLogicalRangeChange(() => sincronizarDib());
  } catch (_) {}
  chart.subscribeCrosshairMove((param) => { const vd = (param && param.seriesData) ? param.seriesData.get(S.serieVela) : null; pintarLegend(vd || V[V.length - 1], param); });
  pintarLegend(V[V.length - 1]);
  sincronizarDib();
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
    const w = Math.max(0, c.w - 3), h = Math.max(0, c.h - 3);
    const sym = String(c.simbolo || '');
    // la tipografía se ESCALA con el tile: nunca desborda ni se desfasa en los pequeños
    const base = Math.min(w, h);
    let fSym = Math.min(base * 0.30, (w - 8) / Math.max(1, sym.length * 0.60), 22);
    fSym = Math.max(0, fSym);
    const muestraTexto = fSym >= 7 && w > 24 && h > 18;
    const fPct = Math.max(7, fSym * 0.72), fPr = Math.max(7, fSym * 0.58);
    const verPct = muestraTexto && h > 34 && w > 38;
    const verPr = muestraTexto && h > 66 && w > 66;
    const pad = base < 40 ? 3 : 6;
    let inner = '';
    if (muestraTexto) {
      inner = `<b style="font-size:${fSym.toFixed(1)}px">${esc(sym)}</b>`
        + (verPr ? `<div class="pr" style="font-size:${fPr.toFixed(1)}px">${fmtP(c.price)}</div>` : '')
        + (verPct ? `<em style="font-size:${fPct.toFixed(1)}px;color:${(c.chg24 || 0) >= 0 ? '#d6ffe6' : '#ffd7dc'}">${fmtPct(c.chg24)}</em>` : '');
    }
    return `<div class="it-tile" data-cg="${esc(c.id)}" data-sym="${esc(sym)}" title="${esc(sym)} ${fmtPct(c.chg24)}" style="left:${c.x}px;top:${c.y}px;width:${w}px;height:${h}px;padding:${pad}px;background:${tinte(c.chg24)}">${inner}</div>`;
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
