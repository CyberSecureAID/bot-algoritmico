/* modules/trading-demo/trading-demo.js — Trading Demo.

   Experiencia de futuros lo más realista posible, pero DEMO: sin órdenes
   reales, sin contrato, sin backend. Gráfica de alta frecuencia, entrada a
   mercado o con orden marcada (limit) que entra cuando el precio la toca,
   posiciones con PnL/equity en vivo (PnL puro, verde por encima de la entrada
   en un long), Stop Loss / Take Profit arrastrables sobre la gráfica (como el
   paper trading de TradingView), comisiones estilo Binance, animación y sonido
   al activarse, exportar la gráfica y tarjeta de PnL por operación.

   Autónomo: datos, motor y gráfica propios. Reutiliza, sin modificar, lo
   compartido del resto de secciones: catálogo de monedas, sus logos y la misma
   barra de dibujo. */

import { estilos } from './estilos.js?v=7';
import * as D from './datos.js?v=2';
import * as M from './motor.js?v=6';
import { montarBarra } from '../../assets/js/niveles/barra.js?v=7';
import { N as NIV } from '../../assets/js/niveles/estado.js?v=1';

const LIB = new URL('./vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const LOGO_ALT = new URL('../../assets/img/cco-full.webp', import.meta.url).href;
const SELLO = new URL('../../assets/img/cco-sello.webp', import.meta.url).href;      // marca de agua grande (como futuros)
const IMG_LONG = new URL('../../assets/portada/img/long.webp', import.meta.url).href;  // fondo tarjeta long (el de futuros)
const IMG_SHORT = new URL('../../assets/portada/img/short.webp', import.meta.url).href; // fondo tarjeta short

const S = {
  par: null, tf: '1m', velas: [], velasDib: [], chart: null, serieVela: null,
  mark: 0, open24: 0, high24: 0, low24: 0, vol24: 0, chgPct: 0,
  lev: 10, cap: 100, tam: 1000, modo: 'limit', limitPx: 0, histPage: 0,
  stream: null, barra: null, dibMontada: false, lineaLimit: null, tab: 'pos',
  uiRAF: null, onResize: null, cvObs: null, marks: {}, logos: {},
  drag: null, hoverH: null, ac: null, expand: false
};

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dec = (x) => { const a = Math.abs(x); return a >= 1000 ? 2 : a >= 1 ? 2 : a >= 0.1 ? 3 : a >= 0.001 ? 5 : 7; };
const fmtP = (x) => (isFinite(x) && x > 0) ? x.toLocaleString('en-US', { minimumFractionDigits: dec(x), maximumFractionDigits: dec(x) }) : '—';
function fmtMoney(x) { if (!isFinite(x)) x = 0; const n = Math.round(x * 100) / 100; const ent = Number.isInteger(n); return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: ent ? 0 : 2, maximumFractionDigits: 2 }); }
const fmtPct = (x) => (x >= 0 ? '+' : '') + (isFinite(x) ? x : 0).toFixed(2) + '%';
const cls = (x) => x > 0 ? 'up' : x < 0 ? 'down' : '';

const IC = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.2 9.2a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2.2-2.6 4"/><path d="M12 17.5v.01"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  cert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.2 13.5 7 22l5-3 5 3-1.2-8.5"/></svg>'
};

export async function abrirDemo() {
  estilos();
  const prev = $('td-overlay'); if (prev) prev.remove();
  S.par = (D.PARES.find((p) => p.id === 'BTC') || D.PARES[0]);
  const ov = document.createElement('div'); ov.id = 'td-overlay';
  ov.innerHTML = plantilla();
  document.body.appendChild(ov);
  cablear(ov);
  S.cap = Math.min(S.cap, M.balance()); S.tam = +(S.cap * S.lev).toFixed(2); sincronCap();
  try { if (localStorage.getItem('td-help-seen')) { const dot = $('td-help-dot'); if (dot) dot.remove(); } } catch (_) {}
  renderTf(); cargarLogos();
  try { await cargarLib(); } catch (_) { toast('Chart engine failed to load. Reload.', 'bad'); return; }
  await cargarDatos();
  montarBarraDemo();
  wireDrag();
  S.onResize = () => sincronizarDib();
  window.addEventListener('resize', S.onResize);
  arrancarUI();
}

function plantilla() {
  return `
  <div class="td-top">
    <button class="td-back" id="td-back">${IC.back} Back</button>
    <span class="td-demo">Demo</span>
    <button class="td-coin" id="td-coin"><i id="td-coin-ico">B</i><b id="td-coin-id">BTC</b>${IC.chev}</button>
    <div class="td-tf" id="td-tf"><button class="cur" id="td-tfcur">1m <span class="cv">▾</span></button><div class="menu" id="td-tfmenu"></div></div>
    <div class="td-px"><div class="td-px-big" id="td-mark">—</div><div class="td-px-sub">Mark · <span id="td-pair">BTCUSDT</span></div></div>
    <div class="td-stats">
      <div class="td-stat"><b>24h change</b><span id="td-chg">—</span></div>
      <div class="td-stat"><b>24h high</b><span id="td-high">—</span></div>
      <div class="td-stat"><b>24h low</b><span id="td-low">—</span></div>
    </div>
    <div class="td-wallet"><b>Equity · Demo</b><span class="eq" id="td-eq">—</span><small id="td-bal">—</small></div>
    <button class="td-icobtn" id="td-expand" title="Expand chart">${IC.expand}</button>
    <button class="td-icobtn" id="td-help-btn" title="How it works">${IC.help}<span class="td-dot" id="td-help-dot"></span></button>
    <button class="td-icobtn" id="td-export" title="Export chart image">${IC.cam}</button>
    <button class="td-icobtn" id="td-reset" title="Reset demo balance">${IC.reset}</button>
  </div>
  <div class="td-body" id="td-body">
    <div class="td-main" id="td-main">
      <div class="td-chart" id="td-chart">
        <div class="td-cv" id="td-cv"></div>
        <canvas class="td-fx" id="td-fx"></canvas>
        <div class="td-wm"><img src="${LOGO}" onerror="this.onerror=null;this.src='${LOGO_ALT}'" alt=""></div>
        <button class="td-icobtn td-exit" id="td-exit" title="Exit full chart">${IC.shrink} Exit</button>
        <div class="td-spin" id="td-spin"><i></i></div>
      </div>
      <div class="td-entry">
        <div class="td-modes"><button class="td-mode" data-modo="market">Market</button><button class="td-mode on" data-modo="limit">Limit (mark)</button></div>
        <div class="td-fld" id="td-limitwrap">
          <div class="td-fld-l"><span>Entry price</span><span>click the chart</span></div>
          <div class="td-in"><input type="number" id="td-limit" placeholder="0.00" step="any"><em>USDT</em></div>
        </div>
        <div class="td-sld">
          <div class="td-sld-top"><span class="lbl">Leverage</span><span class="val" id="td-levv">10x</span></div>
          <input type="range" class="td-range" id="td-levr" min="1" max="125" value="10">
          <div class="td-marks"><span data-lev="1">1x</span><span data-lev="25">25x</span><span data-lev="50">50x</span><span data-lev="75">75x</span><span data-lev="125">125x</span></div>
        </div>
        <div class="td-sld">
          <div class="td-sld-top"><span class="lbl">Capital (margin)</span><span class="val" id="td-capv">—</span></div>
          <input type="range" class="td-range" id="td-capr" min="0" max="10000" step="1" value="100">
          <div class="td-pcts"><button class="td-pct" data-pct="25">25%</button><button class="td-pct" data-pct="50">50%</button><button class="td-pct" data-pct="75">75%</button><button class="td-pct" data-pct="100">Max</button></div>
        </div>
        <div class="td-fld">
          <div class="td-fld-l"><span>Order size</span><span id="td-avail">—</span></div>
          <div class="td-in"><input type="number" id="td-size" value="1000" step="any"><em>USDT</em><span class="td-step"><button data-step="1">${IC.up}</button><button data-step="-1">${IC.down}</button></span></div>
        </div>
        <div class="td-tpsl">
          <div class="td-in"><em>TP</em><input type="number" id="td-tp" placeholder="optional" step="any"></div>
          <div class="td-in"><em>SL</em><input type="number" id="td-sl" placeholder="optional" step="any"></div>
        </div>
        <div class="td-cost"><span>Margin</span><b id="td-margin">—</b></div>
        <div class="td-cost"><span>Liq. (est.)</span><b class="liqv" id="td-liqprev">—</b></div>
        <div class="td-summary" id="td-summary">
          <div class="td-sum-h">Order summary</div>
          <div class="td-sum-row"><span>Order value</span><b id="td-sum-val">—</b></div>
          <div class="td-sum-row"><span>Est. fees · round trip</span><b id="td-sum-fee">—</b></div>
          <div class="td-sum-row"><span>Breakeven</span><b id="td-sum-be">—</b></div>
          <div class="td-sum-note">Demo balance · fees simulated like Binance. No real funds, no liquidation of your account below $0.</div>
        </div>
        <div class="td-ops"><button class="td-op long" id="td-long">Long</button><button class="td-op short" id="td-short">Short</button></div>
      </div>
    </div>
    <div class="td-pos">
      <div class="td-pos-hint">${IC.down} Positions · Marked orders · History ${IC.down}</div>
      <div class="td-pos-tabs">
        <button class="td-pos-tab on" data-tab="pos">Positions <b id="td-npos">0</b></button>
        <button class="td-pos-tab" data-tab="ord">Marked orders <b id="td-nord">0</b></button>
        <button class="td-pos-tab" data-tab="hist">History <b id="td-nhist">0</b></button>
        <div class="td-pos-r" id="td-pos-r"></div>
      </div>
      <div class="td-pos-body" id="td-pos-body"></div>
    </div>
  </div>`;
}

function cablear(ov) {
  $('td-back').onclick = cerrar;
  $('td-coin').onclick = (e) => { e.stopPropagation(); menuMonedas(); };
  $('td-export').onclick = exportarChart;
  $('td-expand').onclick = toggleExpand;
  $('td-exit').onclick = toggleExpand;
  $('td-help-btn').onclick = (e) => { e.stopPropagation(); ayuda(); };
  $('td-reset').onclick = () => { if (confirm('Reset the demo to $10,000 and clear all positions and history?')) { M.reset(); S.cap = Math.min(S.cap, M.balance()); S.tam = +(S.cap * S.lev).toFixed(2); sincronCap(); renderTodo(); toast('Demo reset to $10,000.', 'ok'); } };
  $('td-tfcur').onclick = (e) => { e.stopPropagation(); $('td-tf').classList.toggle('open'); };
  document.addEventListener('click', () => $('td-tf') && $('td-tf').classList.remove('open'));
  // Apalancamiento (barra progresiva)
  $('td-levr').oninput = () => setLev(+$('td-levr').value);
  ov.querySelectorAll('.td-marks span[data-lev]').forEach((s) => s.onclick = () => setLev(+s.dataset.lev));
  // Capital / margen (barra progresiva) + atajos de porcentaje
  $('td-capr').oninput = () => setCap(+$('td-capr').value);
  ov.querySelectorAll('.td-pct').forEach((b) => b.onclick = () => setCap(M.balance() * (+b.dataset.pct) / 100));
  // Tamano de la orden (editable; recalcula el capital)
  const size = $('td-size'); size.oninput = () => setTam(+size.value || 0);
  ov.querySelectorAll('.td-step button').forEach((b) => b.onclick = () => { const paso = Math.max(10, Math.round(S.tam * 0.1)); setTam(Math.max(0, +(S.tam + (+b.dataset.step) * paso).toFixed(2))); });
  $('td-limit').oninput = () => { S.limitPx = Math.max(0, +$('td-limit').value || 0); dibujarLimit(); renderEntry(); };
  ov.querySelectorAll('.td-mode').forEach((b) => b.onclick = () => { S.modo = b.dataset.modo; ov.querySelectorAll('.td-mode').forEach((x) => x.classList.toggle('on', x === b)); $('td-limitwrap').style.display = S.modo === 'limit' ? 'flex' : 'none'; dibujarLimit(); renderEntry(); });
  $('td-long').onclick = () => operar('long');
  $('td-short').onclick = () => operar('short');
  ov.querySelectorAll('.td-pos-tab').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; ov.querySelectorAll('.td-pos-tab').forEach((x) => x.classList.toggle('on', x === b)); renderPos(); });
}

/* Capital (margen) y apalancamiento como dos barras progresivas independientes.
   Tamano de la orden = capital x apalancamiento. */
function setLev(v) { S.lev = Math.max(1, Math.min(125, Math.round(v))); S.tam = +(S.cap * S.lev).toFixed(2); sincronCap(); renderEntry(); }
function setCap(c) { S.cap = Math.max(0, Math.min(M.balance(), +(+c).toFixed(2))); S.tam = +(S.cap * S.lev).toFixed(2); sincronCap(); renderEntry(); }
function setTam(t) { S.tam = Math.max(0, +(+t).toFixed(2)); S.cap = S.lev > 0 ? +(S.tam / S.lev).toFixed(2) : 0; if (S.cap > M.balance()) { S.cap = M.balance(); S.tam = +(S.cap * S.lev).toFixed(2); } sincronCap(); renderEntry(); }
function sincronCap() {
  const capr = $('td-capr'); if (capr) { capr.max = Math.max(1, Math.round(M.balance())); if (Math.round(+capr.value) !== Math.round(S.cap)) capr.value = Math.round(S.cap); }
  const levr = $('td-levr'); if (levr && +levr.value !== S.lev) levr.value = S.lev;
  const size = $('td-size'); if (size && document.activeElement !== size) size.value = S.tam;
}

function toggleExpand() {
  S.expand = !S.expand;
  const ov = $('td-overlay'); if (ov) ov.classList.toggle('td-expand', S.expand);
  const b = $('td-expand'); if (b) { b.classList.toggle('on', S.expand); b.innerHTML = S.expand ? IC.shrink : IC.expand; b.title = S.expand ? 'Exit full chart' : 'Full chart'; }
  // la grafica (autoSize) se reajusta sola; forzamos un par de sincronizaciones
  try { window.dispatchEvent(new Event('resize')); } catch (_) {}
  setTimeout(() => { try { window.dispatchEvent(new Event('resize')); sincronizarDib(); } catch (_) {} }, 80);
  setTimeout(() => { try { sincronizarDib(); } catch (_) {} }, 240);
}

function renderTf() {
  const cur = $('td-tfcur'), menu = $('td-tfmenu'); if (!cur || !menu) return;
  cur.firstChild.nodeValue = (D.TFS.find((t) => t.id === S.tf) || { n: S.tf }).n + ' ';
  const lista = D.TFS || [{ id: '1m', n: '1m' }];
  menu.innerHTML = lista.map((t) => `<button data-tf="${t.id}" class="${t.id === S.tf ? 'on' : ''}">${esc(t.n)}</button>`).join('');
  menu.querySelectorAll('button').forEach((b) => b.onclick = async (e) => { e.stopPropagation(); $('td-tf').classList.remove('open'); if (b.dataset.tf === S.tf) return; S.tf = b.dataset.tf; renderTf(); await cargarDatos(); });
}

async function cargarLogos() { try { S.logos = await D.logos() || {}; aplicarLogo($('td-coin-ico'), S.par); } catch (_) {} }
function aplicarLogo(el, par) { if (!el || !par) return; const url = par.cg && S.logos[par.cg]; if (url) { el.style.backgroundImage = `url(${url})`; el.classList.add('con'); el.textContent = ''; } else { el.style.backgroundImage = ''; el.classList.remove('con'); el.textContent = (par.id || '?')[0]; } }

function cargarLib() { return new Promise((res, rej) => { if (window.LightweightCharts) return res(); let sc = $('td-lwc'); if (sc) { sc.addEventListener('load', () => res()); sc.addEventListener('error', () => rej(new Error('lib'))); return; } sc = document.createElement('script'); sc.id = 'td-lwc'; sc.src = LIB; sc.onload = () => res(); sc.onerror = () => rej(new Error('lib')); document.head.appendChild(sc); }); }

async function cargarDatos() {
  const spin = $('td-spin'); if (spin) spin.style.display = 'grid';
  $('td-coin-id').textContent = S.par.id; $('td-pair').textContent = S.par.s; aplicarLogo($('td-coin-ico'), S.par);
  try {
    const [v, t] = await Promise.all([D.velas(S.par.s, S.tf, 500), D.ticker(S.par.s).catch(() => null)]);
    S.velas = v || [];
    if (t) { S.mark = t.last; S.open24 = t.open; S.high24 = t.high; S.low24 = t.low; S.vol24 = t.volQuote; S.chgPct = t.chgPct; }
    else if (S.velas.length) S.mark = S.velas[S.velas.length - 1].close;
    S.marks[S.par.id] = S.mark;
    pintarChart(); conectarStream(); renderTodo();
  } catch (_) { toast('Could not load market data.', 'bad'); }
  if (spin) spin.style.display = 'none';
}

function pintarChart() {
  const LC = window.LightweightCharts; const cv = $('td-cv'); if (!LC || !cv || !S.velas.length) return;
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  S.chart = null; S.lineaLimit = null;
  const chart = LC.createChart(cv, {
    autoSize: true, localization: { locale: 'en' },
    layout: { background: { color: 'transparent' }, textColor: '#7d8794', fontFamily: '"Chakra Petch", ui-monospace, monospace', attributionLogo: false },
    grid: { vertLines: { color: 'rgba(35,43,53,.4)' }, horzLines: { color: 'rgba(35,43,53,.4)' } },
    rightPriceScale: { borderColor: '#232b35', scaleMargins: { top: 0.08, bottom: 0.08 } },
    timeScale: { borderColor: '#232b35', timeVisible: true, secondsVisible: false, barSpacing: 9, rightOffset: 10, minBarSpacing: 1 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  S.chart = chart;
  const V = S.velas;
  const vela = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e' });
  vela.setData(V.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))); S.serieVela = vela;
  S.velasDib = V.map((c) => ({ t: c.time, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume }));
  try { const ts = chart.timeScale(); ts.setVisibleLogicalRange({ from: V.length - 160, to: V.length + 10 }); ts.subscribeVisibleLogicalRangeChange(() => sincronizarDib()); } catch (_) {}
  try { chart.subscribeClick((p) => { if (!p || !p.point || S.modo !== 'limit' || S.drag) return; const px = S.serieVela.coordinateToPrice(p.point.y); if (px > 0) { S.limitPx = +px.toFixed(dec(px)); $('td-limit').value = S.limitPx; dibujarLimit(); renderEntry(); } }); } catch (_) {}
  dibujarLimit();
}

let _streamKey = '';
function conectarStream() {
  const key = S.par.s + '|' + S.tf;
  if (S.stream && _streamKey === key) return;
  if (S.stream) { try { S.stream.cerrar(); } catch (_) {} S.stream = null; }
  _streamKey = key;
  try { S.stream = D.streamVelas(S.par.s, S.tf, (k) => onKline(k)); } catch (_) { S.stream = null; }
}

function onKline(k) {
  if (!S.serieVela) return;
  const c = { time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v };
  if (!(c.close > 0)) return;
  const last = S.velas[S.velas.length - 1];
  if (last && c.time === last.time) S.velas[S.velas.length - 1] = c;
  else if (!last || c.time > last.time) { S.velas.push(c); if (S.velas.length > 1500) S.velas.shift(); }
  else return;
  try { S.serieVela.update({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }); } catch (_) {}
  nuevoPrecio(c.close, c.high, c.low);
  if (k.x === true) { S.velasDib = S.velas.map((v) => ({ t: v.time, o: v.open, h: v.high, l: v.low, c: v.close, v: v.volume })); sincronizarDib(); }
}

function nuevoPrecio(px, hi, lo) {
  S.mark = px; S.marks[S.par.id] = px;
  if (S.open24 > 0) S.chgPct = ((px - S.open24) / S.open24) * 100;
  const ev = M.onPrecio(S.par.id, px, hi, lo); let cambio = false;
  if (ev.fills.length) { ev.fills.forEach((p) => { flash(p.entrada, p.lado, (p.lado === 'long' ? 'LONG' : 'SHORT') + ' filled'); toast(`Marked ${p.lado} filled at ${fmtP(p.entrada)}`, 'ok'); snd('open'); }); cambio = true; }
  if (ev.tp.length) { ev.tp.forEach((r) => { flash(r.salida, 'long', 'TAKE PROFIT'); toast(`Take profit hit · ${fmtMoney(r.pnl)}`, 'ok'); snd('tp'); }); cambio = true; }
  if (ev.sl.length) { ev.sl.forEach((r) => { flash(r.salida, 'short', 'STOP LOSS'); toast(`Stop loss hit · ${fmtMoney(r.pnl)}`, 'bad'); snd('sl'); }); cambio = true; }
  if (ev.liqs.length) { ev.liqs.forEach((p) => { flash(p.liq, 'short', 'LIQUIDATED'); toast(`${p.lado} liquidated at ${fmtP(p.liq)}`, 'bad'); snd('liq'); }); cambio = true; }
  if (cambio) renderPos();
}

/* ── Bucle de UI (≈16 fps): precio, equity, PnL y overlay de posiciones ── */
function arrancarUI() {
  let last = 0;
  const loop = (ts) => { S.uiRAF = requestAnimationFrame(loop); if (ts - last < 60) return; last = ts; try { pintarPrecio(); refrescarPnL(); pintarFx(); } catch (_) {} };
  S.uiRAF = requestAnimationFrame(loop);
}
function pintarPrecio() {
  const m = $('td-mark'); if (m) { m.textContent = fmtP(S.mark); m.className = 'td-px-big ' + cls(S.chgPct); }
  const chg = $('td-chg'); if (chg) { chg.textContent = fmtPct(S.chgPct); chg.className = cls(S.chgPct); }
  const hi = $('td-high'); if (hi) hi.textContent = fmtP(S.high24);
  const lo = $('td-low'); if (lo) lo.textContent = fmtP(S.low24);
  const vo = $('td-vol'); if (vo) vo.textContent = S.vol24 >= 1e9 ? (S.vol24 / 1e9).toFixed(2) + 'B' : (S.vol24 / 1e6).toFixed(1) + 'M';
  const eq = M.equity(S.marks); const unreal = M.posiciones().reduce((a, p) => a + M.pnlDe(p, S.marks[p.par] || p.entrada).pnl, 0);
  const eqEl = $('td-eq'); if (eqEl) { eqEl.textContent = fmtMoney(eq); eqEl.className = 'eq ' + (Math.abs(unreal) < 0.005 ? '' : cls(unreal)); }
  const balEl = $('td-bal'); if (balEl) balEl.textContent = 'Avail ' + fmtMoney(M.balance());
}
function renderEntry() {
  const bal = M.balance();
  const av = $('td-avail'); if (av) av.textContent = 'Avail ' + fmtMoney(bal);
  const mg = $('td-margin'); if (mg) mg.textContent = fmtMoney(S.cap);
  const lv = $('td-levv'); if (lv) lv.textContent = S.lev + 'x';
  const cv = $('td-capv'); if (cv) cv.textContent = fmtMoney(S.cap);
  const levr = $('td-levr'); if (levr) levr.style.setProperty('--f', ((S.lev - 1) / 124 * 100).toFixed(1) + '%');
  const capr = $('td-capr'); if (capr) capr.style.setProperty('--f', (Math.min(1, S.cap / Math.max(1, bal)) * 100).toFixed(1) + '%');
  const px = S.modo === 'limit' && S.limitPx > 0 ? S.limitPx : S.mark;
  const lp = $('td-liqprev'); if (lp) lp.textContent = px > 0 ? (fmtP(M.liqPrecio('long', px, S.lev)) + ' / ' + fmtP(M.liqPrecio('short', px, S.lev))) : '—';
  const fee = M.feeRueda(S.tam);
  const sv = $('td-sum-val'); if (sv) sv.textContent = fmtMoney(S.tam);
  const sf = $('td-sum-fee'); if (sf) sf.textContent = '~' + fmtMoney(fee);
  const sb = $('td-sum-be'); if (sb) sb.textContent = (px > 0 && S.tam > 0) ? fmtP(px * (1 + fee / S.tam)) : '—';
}


function operar(lado) {
  if (!(S.tam > 0)) { toast('Enter a size first.', 'warn'); return; }
  arranqueAudio();
  const tp = +$('td-tp').value || 0, sl = +$('td-sl').value || 0;
  let r;
  if (S.modo === 'limit') {
    if (!(S.limitPx > 0)) { toast('Select Limit, then click the chart to mark the entry.', 'warn'); return; }
    r = M.colocarOrden(S.par.id, lado, S.tam, S.lev, S.limitPx, S.mark, tp, sl);
    if (r.ok) { toast(`Marked ${lado} at ${fmtP(S.limitPx)}. The price decides when it fills.`, 'ok'); S.limitPx = 0; $('td-limit').value = ''; dibujarLimit(); }
  } else {
    r = M.abrirMercado(S.par.id, lado, S.tam, S.lev, S.mark, tp, sl);
    if (r.ok) { flash(r.pos.entrada, lado, (lado === 'long' ? 'LONG' : 'SHORT') + ' opened'); toast(`${lado === 'long' ? 'Long' : 'Short'} opened at ${fmtP(r.pos.entrada)}`, 'ok'); snd('open'); }
  }
  if (!r.ok) { toast(r.motivo === 'saldo' ? 'Not enough demo balance for that margin.' : 'Could not place the order.', 'bad'); return; }
  $('td-tp').value = ''; $('td-sl').value = '';
  renderPos(); renderEntry();
}

/* ── Panel inferior ── */
function renderPos() {
  const pos = M.posiciones(), ord = M.ordenes(), hist = M.historial();
  $('td-npos').textContent = pos.length; $('td-nord').textContent = ord.length; $('td-nhist').textContent = hist.length;
  const r = $('td-pos-r'); if (r) r.innerHTML = '';
  const body = $('td-pos-body'); if (!body) return;
  if (S.tab === 'pos') {
    if (!pos.length) { body.innerHTML = '<div class="td-empty">No open positions. Open a Market trade, or mark a Limit entry on the chart.</div>'; return; }
    body.innerHTML = `<table class="td-tbl"><thead><tr><th>Symbol</th><th>Size</th><th>Entry</th><th>Mark</th><th>Liq.</th><th>Margin</th><th>TP</th><th>SL</th><th>PnL (ROE)</th><th></th></tr></thead><tbody>${pos.map(filaPos).join('')}</tbody></table>`;
    body.querySelectorAll('[data-cerrar]').forEach((b) => b.onclick = () => { const x = M.cerrar(b.dataset.cerrar, S.marks[b.dataset.par] || S.mark, 'manual'); if (x) { toast(`Closed ${x.pos.lado} · ${fmtMoney(x.pnl)} (fee ${fmtMoney(x.fee)})`, x.pnl >= 0 ? 'ok' : 'bad'); renderPos(); } });
    body.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => editarTPSL(b.dataset.edit, b.dataset.k));
    body.querySelectorAll('[data-share]').forEach((b) => b.onclick = () => { const p = pos.find((x) => x.id === b.dataset.share); if (p) tarjetaPnL(cerradoDesde(p)); });
  } else if (S.tab === 'ord') {
    if (!ord.length) { body.innerHTML = '<div class="td-empty">No marked orders. In Limit mode, click the chart to mark where you want to enter.</div>'; return; }
    body.innerHTML = `<table class="td-tbl"><thead><tr><th>Symbol</th><th>Side</th><th>Size</th><th>Mark-in</th><th>Current</th><th>TP</th><th>SL</th><th></th></tr></thead><tbody>${ord.map(filaOrd).join('')}</tbody></table>`;
    body.querySelectorAll('[data-cancel]').forEach((b) => b.onclick = () => { if (M.cancelarOrden(b.dataset.cancel)) renderPos(); });
    body.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => editarTPSL(b.dataset.edit, b.dataset.k));
  } else {
    const st = M.stats(30);
    const PP = 60, tot = hist.length, pags = Math.max(1, Math.ceil(tot / PP));
    if (S.histPage >= pags) S.histPage = pags - 1; if (S.histPage < 0) S.histPage = 0;
    const pag = hist.slice(S.histPage * PP, S.histPage * PP + PP);
    if (r) r.innerHTML = `<span class="td-stat-chip">30d PnL <b class="${cls(st.total)}">${fmtMoney(st.total)}</b></span><span class="td-stat-chip">Win rate <b>${st.winRate}%</b></span><span class="td-stat-chip">Trades <b>${st.n}</b></span>${tot > PP ? `<span class="td-pager"><button class="td-x" id="td-prev"${S.histPage === 0 ? ' disabled' : ''}>‹</button><span>${S.histPage + 1}/${pags}</span><button class="td-x" id="td-next"${S.histPage >= pags - 1 ? ' disabled' : ''}>›</button></span>` : ''}`;
    if ($('td-prev')) $('td-prev').onclick = () => { S.histPage--; renderPos(); };
    if ($('td-next')) $('td-next').onclick = () => { S.histPage++; renderPos(); };
    if (!tot) { body.innerHTML = '<div class="td-empty">No closed trades yet. Your track record builds here as you open and close demo trades.</div>'; return; }
    const cta = `<div class="td-cert-cta"><button class="td-cert-btn" id="td-cert">${IC.cert} Export performance certificate</button></div>`;
    body.innerHTML = cta + `<table class="td-tbl"><thead><tr><th>Closed</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>PnL (ROE)</th><th></th></tr></thead><tbody>${pag.map((h) => { const c = h.pnl >= 0 ? 'up' : 'down'; const d = new Date(h.cerrado); const f = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); const mo = h.motivo === 'tp' ? ' · TP' : h.motivo === 'sl' ? ' · SL' : h.motivo === 'liq' ? ' · LIQ' : ''; return `<tr><td>${f}</td><td><span class="td-sym">${logoChip(h.par)} ${esc(h.par)}</span></td><td><span class="td-tag ${h.lado}">${h.lado.toUpperCase()}</span> <span class="td-lev-badge">${h.lev}x</span></td><td>${fmtP(h.entrada)}</td><td>${fmtP(h.salida)}</td><td class="td-pnl ${c}">${fmtMoney(h.pnl)} (${fmtPct(h.roe)})${mo}</td><td><button class="td-share" data-shareh="${h.id}" title="Export trade card">${IC.share}</button></td></tr>`; }).join('')}</tbody></table>`;
    if ($('td-cert')) $('td-cert').onclick = pedirNombreCert;
    body.querySelectorAll('[data-shareh]').forEach((b) => b.onclick = () => { const h = hist.find((x) => x.id === b.dataset.shareh); if (h) tarjetaPnL(h); });
  }
}
function celdaTPSL(obj, k, col) {
  return `<span class="td-tpsl-c"><em style="color:${col}">${obj[k] ? fmtP(obj[k]) : '—'}</em><button class="td-edit" data-edit="${obj.id}" data-k="${k}" title="Edit ${k.toUpperCase()}">${IC.edit}</button></span>`;
}
function filaPos(p) {
  const { pnl, roe, qty } = M.pnlDe(p, S.marks[p.par] || S.mark); const c = pnl >= 0 ? 'up' : 'down';
  return `<tr><td><span class="td-sym">${logoChip(p.par)} ${esc(p.par)}USDT <span class="td-tag ${p.lado}">${p.lado.toUpperCase()}</span> <span class="td-lev-badge">${p.lev}x</span></span></td>
    <td>${qty.toFixed(4)}</td><td>${fmtP(p.entrada)}</td><td data-mark="${p.id}">${fmtP(S.marks[p.par] || S.mark)}</td>
    <td class="td-liq">${fmtP(p.liq)}</td><td>${fmtMoney(p.margen)}</td>
    <td>${celdaTPSL(p, 'tp', '#2ee86a')}</td><td>${celdaTPSL(p, 'sl', '#ff5b6e')}</td>
    <td class="td-pnl ${c}" data-pnl="${p.id}">${fmtMoney(pnl)} (${fmtPct(roe)})</td>
    <td><span class="td-acts"><button class="td-share" data-share="${p.id}" title="Export trade card">${IC.share}</button><button class="td-x" data-cerrar="${p.id}" data-par="${p.par}">Close</button></span></td></tr>`;
}
function filaOrd(o) {
  return `<tr><td><span class="td-sym">${logoChip(o.par)} ${esc(o.par)}USDT</span></td>
    <td><span class="td-tag ${o.lado}">${o.lado.toUpperCase()}</span> <span class="td-lev-badge">${o.lev}x</span></td>
    <td>${fmtMoney(o.tam)}</td><td>${fmtP(o.precio)}</td><td>${fmtP(S.marks[o.par] || S.mark)}</td>
    <td>${celdaTPSL(o, 'tp', '#2ee86a')}</td><td>${celdaTPSL(o, 'sl', '#ff5b6e')}</td>
    <td><button class="td-x" data-cancel="${o.id}">Cancel</button></td></tr>`;
}
function logoChip(parId) { const p = D.PARES.find((x) => x.id === parId); const url = p && p.cg && S.logos[p.cg]; return url ? `<i class="con" style="background-image:url(${esc(url)})"></i>` : `<i>${esc((parId || '?')[0])}</i>`; }
function refrescarPnL() {
  if (S.tab !== 'pos') return;
  M.posiciones().forEach((p) => {
    const mk = document.querySelector(`[data-mark="${p.id}"]`); if (mk) mk.textContent = fmtP(S.marks[p.par] || S.mark);
    const pe = document.querySelector(`[data-pnl="${p.id}"]`); if (pe) { const { pnl, roe } = M.pnlDe(p, S.marks[p.par] || S.mark); pe.textContent = `${fmtMoney(pnl)} (${fmtPct(roe)})`; pe.className = 'td-pnl ' + (pnl >= 0 ? 'up' : 'down'); }
  });
}
/* Tarjeta de una posición ABIERTA: usa el PnL EN VIVO (bruto), idéntico a lo que
   muestra la posición en pantalla (no resta comisiones de cierre). */
function cerradoDesde(p) { const mk = S.marks[p.par] || S.mark; const { pnl, roe } = M.pnlDe(p, mk); return { par: p.par, lado: p.lado, lev: p.lev, tam: p.tam, entrada: p.entrada, salida: mk, pnl, roe, cerrado: Date.now() }; }

/* Editar TP o SL de una posición o de una orden marcada (como en futuros). El
   SL no puede pasar el precio de liquidación: si lo pasa, se retira. Dejar el
   campo vacío (0) retira ese TP/SL. */
function editarTPSL(id, k) {
  const p = M.posiciones().find((x) => x.id === id) || M.ordenes().find((x) => x.id === id);
  if (!p) return;
  const esTP = k === 'tp';
  modalValor({
    titulo: esTP ? 'Take Profit' : 'Stop Loss',
    sub: `${esc(p.par)}USDT · ${p.lado === 'long' ? 'Long' : 'Short'} ${p.lev}x`,
    valor: p[k] || '', unidad: 'USDT', tono: esTP ? 'tp' : 'sl',
    ok: (v) => {
      let tp = p.tp || 0, sl = p.sl || 0;
      if (esTP) tp = v > 0 ? v : 0;
      else {
        sl = v > 0 ? v : 0;
        if (sl > 0 && p.liq) { const malo = p.lado === 'long' ? (sl <= p.liq) : (sl >= p.liq); if (malo) { sl = 0; toast('SL beyond liquidation — removed.', 'warn'); } }
      }
      M.setTPSL(p.id, tp, sl); renderPos();
    }
  });
}
function modalValor(o) {
  const old = $('td-sheet'); if (old) old.remove();
  const m = document.createElement('div'); m.className = 'td-sheet'; m.id = 'td-sheet';
  m.innerHTML = `<div class="bx"><h5>${esc(o.titulo)}</h5><div class="sub">${esc(o.sub || '')}</div>
    <div class="fld"><input type="number" id="td-sheet-in" step="any" value="${o.valor ? o.valor : ''}" placeholder="0.00"><span class="u">${esc(o.unidad || '')}</span></div>
    <div class="btns"><button id="td-sheet-x">Cancel</button><button class="ok ${o.tono || ''}" id="td-sheet-ok">Confirm</button></div></div>`;
  document.body.appendChild(m);
  const cerrarS = () => { try { m.remove(); } catch (_) {} };
  const inp = m.querySelector('#td-sheet-in'); setTimeout(() => { try { inp.focus(); inp.select(); } catch (_) {} }, 40);
  m.querySelector('#td-sheet-x').onclick = cerrarS;
  m.onclick = (e) => { if (e.target === m) cerrarS(); };
  const confirmar = () => { const v = +inp.value || 0; cerrarS(); o.ok(v); };
  m.querySelector('#td-sheet-ok').onclick = confirmar;
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') confirmar(); else if (e.key === 'Escape') cerrarS(); });
}

/* ── Línea de la orden limit en preparación ── */
function dibujarLimit() {
  if (!S.serieVela) return;
  if (S.lineaLimit) { try { S.serieVela.removePriceLine(S.lineaLimit); } catch (_) {} S.lineaLimit = null; }
  if (S.modo === 'limit' && S.limitPx > 0) { try { S.lineaLimit = S.serieVela.createPriceLine({ price: S.limitPx, color: '#C9A84B', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'entry' }); } catch (_) {} }
}

/* ── Overlay de posiciones: entrada + PnL, liq, y controles TP/SL estilo
   TradingView (tiradores cuadrados junto a la tachuela, arrastrables). ── */
function ejeAncho() { try { const tw = S.chart.timeScale().width(); const cw = $('td-cv').clientWidth; if (tw > 0 && cw > tw) return Math.max(44, Math.min(92, cw - tw)); } catch (_) {} return 66; }
function pintarFx() {
  const fx = $('td-fx'), cv = $('td-cv'); if (!fx || !cv || !S.serieVela) return;
  const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (fx.width !== Math.round(W * dpr)) { fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); fx.style.width = W + 'px'; fx.style.height = H + 'px'; }
  const g = fx.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const Y = (p) => { try { const c = S.serieVela.priceToCoordinate(p); return c == null ? null : c; } catch (_) { return null; } };
  S._handles = [];
  const plotR = W - ejeAncho();
  const markY = Y(S.mark);
  // órdenes marcadas: línea dorada pulsante
  const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 320);
  const gp = 0.5 + 0.5 * Math.sin(performance.now() / 600);   // iluminacion suave (glow) de las posiciones
  M.ordenes().filter((o) => o.par === S.par.id).forEach((o) => { const y = Y(o.precio); if (y == null) return; g.save(); g.setLineDash([6, 5]); g.strokeStyle = `rgba(232,184,75,${0.5 + 0.4 * pulso})`; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); etiqueta(g, plotR, y, (o.lado === 'long' ? 'LONG' : 'SHORT') + ' mark ' + fmtP(o.precio), '#E8B84B', '#2a1d00'); g.restore(); });
  // posiciones
  M.posiciones().filter((p) => p.par === S.par.id).forEach((p) => {
    const ey = Y(p.entrada), ly = Y(p.liq); if (ey == null) return;
    const { pnl, roe } = M.pnlDe(p, S.mark); const verde = pnl >= 0;
    const col = p.lado === 'long' ? '#2ee86a' : '#ff5b6e';
    if (markY != null) { g.fillStyle = verde ? 'rgba(46,232,106,.08)' : 'rgba(255,91,110,.08)'; const a = Math.min(ey, markY), b = Math.max(ey, markY); g.fillRect(0, a, W, b - a); }
    // línea de entrada con iluminación suave: verde en ganancia, roja en pérdida
    g.save(); g.strokeStyle = verde ? '#2ee86a' : '#ff5b6e'; g.lineWidth = 1.8; g.shadowColor = verde ? 'rgba(46,232,106,.95)' : 'rgba(255,91,110,.95)'; g.shadowBlur = 5 + 9 * gp; g.beginPath(); g.moveTo(0, ey); g.lineTo(W, ey); g.stroke(); g.restore();
    etiqueta(g, plotR, ey, `${p.lado === 'long' ? 'LONG' : 'SHORT'} ${p.lev}x  ${fmtMoney(pnl)} (${fmtPct(roe)})`, verde ? '#2ee86a' : '#ff5b6e', '#04210f');
    if (ly != null) { g.save(); g.setLineDash([2, 4]); g.strokeStyle = 'rgba(255,91,110,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, ly); g.lineTo(plotR, ly); g.stroke(); etiqueta(g, plotR, ly, 'LIQ ' + fmtP(p.liq), 'rgba(255,91,110,.85)', '#2a0509'); g.restore(); }
    ctrlTPSL(g, p, 'tp', '#2ee86a', ey, plotR, H, Y, gp);
    ctrlTPSL(g, p, 'sl', '#ff5b6e', ey, plotR, H, Y, gp);
  });
}
/* Control TP o SL: si está fijado dibuja línea + etiqueta + tirador al nivel;
   si no, un botón cuadrado junto a la entrada (TP arriba / SL abajo en un long)
   que al arrastrar lo crea. Registra el rectángulo clicable en S._handles. */
function ctrlTPSL(g, p, cual, col, ey, plotR, H, Y, gp) {
  const set = cual === 'tp' ? p.tp : p.sl;
  const bw = 30, bh = 18, bx = plotR - bw - 2;
  if (set) {
    const y = Y(set); if (y == null) return;
    g.save(); g.setLineDash([7, 4]); g.strokeStyle = col; g.lineWidth = 1.5; g.shadowColor = col; g.shadowBlur = 3 + 7 * (gp || 0); g.beginPath(); g.moveTo(0, y); g.lineTo(bx - 4, y); g.stroke(); g.setLineDash([]); g.restore();
    etiqueta(g, bx - 4, y, (cual === 'tp' ? 'TP ' : 'SL ') + fmtP(set), col, '#04210f');
    botonCuadro(g, bx, y - bh / 2, bw, bh, col, cual.toUpperCase(), false);
    S._handles.push({ id: p.id, cual, x0: bx - 6, x1: plotR, y0: y - 10, y1: y + 10 });
  } else {
    const arriba = (cual === 'tp') === (p.lado === 'long');
    let y = ey + (arriba ? -23 : 23); y = Math.max(12, Math.min(H - 12, y));
    botonCuadro(g, bx, y - bh / 2, bw, bh, col, cual.toUpperCase(), true);
    S._handles.push({ id: p.id, cual, creating: true, x0: bx - 6, x1: plotR, y0: y - 11, y1: y + 11 });
  }
}
function botonCuadro(g, x, y, w, h, col, txt, hueco) {
  g.save();
  if (hueco) { g.fillStyle = 'rgba(10,14,20,.92)'; redondea(g, x, y, w, h, 4); g.fill(); g.strokeStyle = col; g.lineWidth = 1.3; redondea(g, x + .7, y + .7, w - 1.4, h - 1.4, 4); g.stroke(); g.fillStyle = col; }
  else { g.fillStyle = col; redondea(g, x, y, w, h, 4); g.fill(); g.fillStyle = '#04210f'; }
  g.font = '800 10px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, x + w / 2, y + h / 2 + .5);
  g.restore();
}
function etiqueta(g, xRight, y, txt, bg, fg) { g.save(); g.font = '700 10.5px "IBM Plex Mono", monospace'; const w = g.measureText(txt).width + 14; const x = xRight - w - 8; g.fillStyle = bg; redondea(g, x, y - 9, w, 18, 4); g.fill(); g.fillStyle = fg; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, x + 7, y + 0.5); g.restore(); }
function redondea(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ── Arrastre y creación de TP/SL (tiradores cuadrados del overlay) ── */
function wireDrag() {
  const host = $('td-chart'), fx = $('td-fx'); if (!host || !fx) return;
  const handleEn = (e) => {
    if (!(NIV.herr === 'cursor' || NIV.herr == null) || !S._handles || !S._handles.length) return null;
    const r = host.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    for (const h of S._handles) if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h;
    return null;
  };
  /* La capa fx deja pasar TODO a la gráfica (pan, zoom, arrastre de ejes,
     crosshair y clic). Solo "despierta" (pointer-events:auto) sobre un tirador. */
  host.addEventListener('mousemove', (e) => {
    if (S.drag) return;
    const h = handleEn(e);
    fx.style.pointerEvents = h ? 'auto' : 'none';
    fx.style.cursor = h ? 'ns-resize' : '';
  });
  fx.addEventListener('mousedown', (e) => {
    const h = handleEn(e); if (!h) return;
    e.stopPropagation(); e.preventDefault();
    const p = M.posiciones().find((x) => x.id === h.id); if (!p) return;
    if (h.creating) {
      const r = host.getBoundingClientRect(); let px; try { px = S.serieVela.coordinateToPrice(e.clientY - r.top); } catch (_) { px = null; }
      if (!(px > 0)) px = p.entrada * (h.cual === 'tp' ? (p.lado === 'long' ? 1.01 : 0.99) : (p.lado === 'long' ? 0.99 : 1.01));
      fijarTPSL(p, h.cual, px);
    }
    S.drag = { id: h.id, cual: h.cual };
  });
  window.addEventListener('mousemove', (e) => {
    if (!S.drag || !S.serieVela) return;
    const r = host.getBoundingClientRect(); const y = e.clientY - r.top;
    let px; try { px = S.serieVela.coordinateToPrice(y); } catch (_) { px = null; }
    if (px > 0) { const p = M.posiciones().find((x) => x.id === S.drag.id); if (p) fijarTPSL(p, S.drag.cual, px); }
  });
  window.addEventListener('mouseup', () => { if (S.drag) { S.drag = null; fx.style.pointerEvents = 'none'; renderPos(); } });
}
/* Fija TP o SL respetando la liquidación: el SL no puede pasar el precio de liq. */
function fijarTPSL(p, cual, px) {
  px = +(+px).toFixed(dec(px));
  if (cual === 'sl') { const malo = p.lado === 'long' ? (px <= p.liq) : (px >= p.liq); if (malo) px = +(p.lado === 'long' ? p.liq * 1.0008 : p.liq * 0.9992).toFixed(dec(p.liq)); }
  M.setTPSL(p.id, cual === 'tp' ? px : (p.tp || 0), cual === 'sl' ? px : (p.sl || 0));
}

/* ── Animación + sonido ── */
function flash(price, lado, texto) {
  const host = $('td-chart'); if (!host || !S.serieVela) return;
  let y; try { y = S.serieVela.priceToCoordinate(price); } catch (_) { y = null; } if (y == null) return;
  const tk = document.createElement('div'); tk.className = 'td-ticket ' + (lado === 'long' ? 'long' : lado === 'short' ? 'short' : 'gold'); tk.style.top = y + 'px'; tk.textContent = texto;
  host.appendChild(tk); setTimeout(() => { try { tk.remove(); } catch (_) {} }, 2400);
}
function arranqueAudio() { try { if (!S.ac) S.ac = new (window.AudioContext || window.webkitAudioContext)(); if (S.ac.state === 'suspended') S.ac.resume(); } catch (_) {} }
function snd(tipo) {
  try {
    if (!S.ac) return; const ac = S.ac; let t = ac.currentTime;
    const seqs = { open: [[660, .07, .1], [880, .09, .1]], tp: [[784, .09, .13], [988, .09, .13], [1319, .16, .13]], sl: [[320, .11, .13], [240, .16, .13]], liq: [[180, .22, .16], [130, .3, .16]] };
    (seqs[tipo] || []).forEach(([f, d, gg]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = tipo === 'tp' ? 'sine' : 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.min(.6, gg * 2.7), t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); t += d * .9; });
  } catch (_) {}
}

/* ── Exportaciones ── */
function descargar(blob, nombre) { if (!blob) return; const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); }
function cargarImg(url, cross) { return new Promise((res) => { if (!url) return res(null); const im = new Image(); if (cross) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }); }
async function exportarChart() {
  if (!S.chart) { toast('Chart is not ready yet.', 'warn'); return; }
  let ch; try { ch = S.chart.takeScreenshot(); } catch (_) { toast('Could not export the chart.', 'bad'); return; }
  const W = ch.width, H = ch.height, top = 64;
  // Logo de la moneda: igual que Heat Pool (Share signal) → spothq en GitHub (con
  // CORS), respaldo CoinGecko. Así SÍ aparece el logo en la imagen exportada.
  const sym = ((S.par && S.par.id) || '').toLowerCase();
  const coinRepo = sym ? 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/' + sym + '.png' : null;
  const coinCg = S.par && S.par.cg && S.logos[S.par.cg];
  const [imgRepo, wm1] = await Promise.all([cargarImg(coinRepo, true), cargarImg(LOGO, false)]);
  const imgCoin = imgRepo || await cargarImg(coinCg, true);
  const imgWm = wm1 || await cargarImg(LOGO_ALT, false);
  const out = document.createElement('canvas'); out.width = W; out.height = H + top; const g = out.getContext('2d');
  g.fillStyle = '#0a0d12'; g.fillRect(0, 0, out.width, out.height);
  // Franja superior
  g.fillStyle = '#0e141c'; g.fillRect(0, 0, out.width, top);
  g.fillStyle = 'rgba(232,184,75,.28)'; g.fillRect(0, top - 1, out.width, 1);
  // Izquierda: la moneda (logo, nombre, precio) y debajo temporalidad y hora
  const r = 15, cx = 18 + r, cy = 27;
  if (imgCoin) { g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.closePath(); g.clip(); g.drawImage(imgCoin, cx - r, cy - r, r * 2, r * 2); g.restore(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
  else { g.fillStyle = '#232b36'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.fillStyle = '#c9d1d9'; g.font = '800 14px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((S.par.id || '?')[0], cx, cy + 1); }
  const tx = cx + r + 12;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '800 18px "Chakra Petch", sans-serif'; g.fillStyle = '#eaecef'; g.fillText(S.par.id + 'USDT', tx, 27);
  const nameW = g.measureText(S.par.id + 'USDT').width;
  g.font = '700 16px "IBM Plex Mono", monospace'; g.fillStyle = S.chgPct >= 0 ? '#3ee88a' : '#ff6b7a'; g.fillText(fmtP(S.mark), tx + nameW + 12, 27);
  g.font = '700 11px "IBM Plex Mono", monospace'; g.fillStyle = '#8b96a3'; g.fillText(S.tf + '  ·  ' + new Date().toLocaleString('en-US'), tx, 48);
  // Derecha: Trading Demo y nuestro dominio
  g.textAlign = 'right';
  g.font = '800 17px "Chakra Petch", sans-serif'; g.fillStyle = '#E8B84B'; g.fillText('Trading Demo', out.width - 16, 27);
  g.font = '700 11.5px "IBM Plex Mono", monospace'; g.fillStyle = '#8b96a3'; g.fillText('decfreedom.com', out.width - 16, 48);
  // Grafica
  g.drawImage(ch, 0, top);
  // Posiciones activas: componer el overlay (td-fx) encima de la gráfica exportada
  try { const fx = $('td-fx'); if (fx && fx.width) g.drawImage(fx, 0, top, W, H); } catch (_) {}
  // Marca de agua: el logo (imagen) abajo a la izquierda, por encima del eje de tiempo
  if (imgWm && imgWm.width) { const wmH = 30, wmW = imgWm.width * (wmH / imgWm.height); g.save(); g.globalAlpha = .8; g.drawImage(imgWm, 18, out.height - wmH - 34, wmW, wmH); g.restore(); }
  try { out.toBlob((b) => { descargar(b, `demo-${S.par.id}-${S.tf}.png`); toast('Chart image exported.', 'ok'); }); } catch (_) { toast('Could not export the chart.', 'bad'); }
}
function exportarCSV() {
  try {
    let nombre = ''; try { nombre = localStorage.getItem('td-cert-name') || ''; } catch (_) {}
    const st = certStats();
    const pre = [
      'DecFreedom - Trading Demo track record (DEMO, not real money)',
      'Trader,' + (nombre || 'Demo Trader'),
      'Issued,' + new Date().toISOString(),
      'Starting balance,10000',
      'Trades,' + st.n,
      'Win rate %,' + st.winRate,
      'Net PnL USDT,' + st.total.toFixed(2),
      'End balance,' + st.endBal.toFixed(2),
      'decfreedom.com', '', M.csv()
    ].join('\n');
    descargar(new Blob([pre], { type: 'text/csv' }), 'DecFreedom-track-record.csv'); toast('History exported (CSV).', 'ok');
  } catch (_) { toast('Could not export the history.', 'bad'); }
}

/* Tarjeta de operación: MISMA dinámica que el área de futuros (fondo long/short
   de portada/img, sello cco-sello, logo de la moneda), con la marca DEMO grande
   encima para que no pueda reutilizarse de forma fraudulenta. */
async function tarjetaPnL(tr) {
  const esLong = tr.lado === 'long', gana = tr.pnl >= 0;
  const vcol = gana ? '#16c784' : '#f6465d', col = esLong ? '#16c784' : '#f6465d';
  const oro = '#E8B84B', blanco = '#ffffff';
  const logoUrl = tr.par ? 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/' + String(tr.par).toLowerCase() + '.png' : null;
  const [fondo, logo, sello] = await Promise.all([
    cargarImg(esLong ? IMG_LONG : IMG_SHORT, false),
    cargarImg(logoUrl, true),
    cargarImg(SELLO, false)
  ]);
  const W = 1670, H = 941;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  if (fondo) g.drawImage(fondo, 0, 0, W, H); else { g.fillStyle = '#0b0e12'; g.fillRect(0, 0, W, H); }
  const grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, 'rgba(5,7,10,.82)'); grad.addColorStop(.5, 'rgba(5,7,10,.42)'); grad.addColorStop(1, 'rgba(5,7,10,.05)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // marca de agua DEMO grande (anti fraude)
  g.save(); g.translate(W * .64, H * .54); g.rotate(-Math.PI / 9); g.font = '800 240px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.07)'; g.fillText('DEMO', 0, 0); g.restore();
  const X = 70; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  let topY = 132;
  g.save(); g.beginPath(); g.arc(X + 30, topY, 32, 0, 6.28); g.closePath(); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill(); g.clip();
  if (logo) g.drawImage(logo, X - 2, topY - 32, 64, 64); else { g.fillStyle = oro; g.font = '800 34px "Plus Jakarta Sans", sans-serif'; g.textAlign = 'center'; g.fillText((tr.par || '?')[0], X + 30, topY + 12); g.textAlign = 'left'; }
  g.restore();
  g.strokeStyle = 'rgba(232,184,75,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(X + 30, topY, 32, 0, 6.28); g.stroke();
  g.fillStyle = blanco; g.font = '800 46px "Plus Jakarta Sans", sans-serif'; g.fillText((tr.par || '') + 'USDT', X + 80, topY + 16);
  topY += 86; g.fillStyle = col; g.font = '800 28px "IBM Plex Mono", monospace'; g.fillText((esLong ? 'LONG' : 'SHORT') + '  ' + tr.lev + '×', X, topY);
  topY += 50; const d = new Date(tr.cerrado || Date.now()); g.fillStyle = blanco; g.font = '500 24px "IBM Plex Mono", monospace';
  g.fillText(d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) + '  ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), X, topY);
  let cy = H * 0.42; g.fillStyle = vcol; g.font = '800 120px "IBM Plex Mono", monospace';
  g.fillText((tr.roe >= 0 ? '+' : '') + tr.roe.toFixed(2) + '%', X, cy);
  g.font = '800 52px "IBM Plex Mono", monospace';
  g.fillText((tr.pnl >= 0 ? '+' : '') + tr.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT', X + 10, cy + 70);
  let iy = H * 0.62; g.fillStyle = oro; g.font = '700 22px "IBM Plex Mono", monospace'; g.fillText('ENTRY PRICE', X, iy); g.fillText('EXIT PRICE', X + 330, iy);
  g.fillStyle = blanco; g.font = '800 34px "IBM Plex Mono", monospace'; g.fillText(fmtP(tr.entrada), X, iy + 42); g.fillText(fmtP(tr.salida), X + 330, iy + 42);
  iy += 112; g.fillStyle = oro; g.font = '700 22px "IBM Plex Mono", monospace'; g.fillText('DEMO ACCOUNT · decfreedom.com', X, iy);
  if (sello) { const lw = 150, lh = sello.height * (lw / sello.width); g.save(); g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = 18; g.shadowOffsetY = 5; g.drawImage(sello, X, H - lh - 44, lw, lh); g.restore(); }
  mostrarTarjeta(cv, `DecFreedom-${tr.par}.png`);
}
function mostrarTarjeta(cv, nombre) {
  const old = $('td-modal'); if (old) old.remove();
  const m = document.createElement('div'); m.id = 'td-modal'; m.innerHTML = `<div class="card"></div>`;
  m.querySelector('.card').appendChild(cv);
  const acts = document.createElement('div'); acts.className = 'acts'; acts.innerHTML = `<button class="dl">Download image</button><button class="cl">Close</button>`;
  m.querySelector('.card').appendChild(acts); document.body.appendChild(m);
  const ce = () => m.remove(); m.querySelector('.cl').onclick = ce; m.onclick = (e) => { if (e.target === m) ce(); };
  m.querySelector('.dl').onclick = () => { try { cv.toBlob((b) => descargar(b, nombre), 'image/png', 0.95); } catch (_) { toast('Could not export the image.', 'bad'); } };
}

/* ── Certificado de track record (imagen PNG, PDF sin cortes de fila, CSV) ── */
function certStats() {
  const histN = M.historial();                    // mas reciente primero
  const hist = histN.slice().reverse();            // cronologico
  const n = hist.length;
  const wins = hist.filter((h) => h.pnl > 0).length;
  const total = hist.reduce((a, h) => a + h.pnl, 0);
  let eq = 10000; const curva = [10000];
  hist.forEach((h) => { eq += h.pnl; curva.push(eq); });
  const desde = n ? new Date(hist[0].cerrado) : null, hasta = n ? new Date(hist[n - 1].cerrado) : null;
  return { n, wins, losses: n - wins, winRate: n ? Math.round(wins / n * 100) : 0, total, startBal: 10000, endBal: 10000 + total, curva, desde, hasta };
}
function wrapTexto(g, txt, x, y, maxW, lh) {
  const ws = txt.split(' '); let linea = '', yy = y;
  ws.forEach((p) => { const t = linea ? linea + ' ' + p : p; if (g.measureText(t).width > maxW && linea) { g.fillText(linea, x, yy); linea = p; yy += lh; } else linea = t; });
  if (linea) g.fillText(linea, x, yy);
}
function pedirNombreCert() {
  const old = $('td-sheet'); if (old) old.remove();
  let prev = ''; try { prev = localStorage.getItem('td-cert-name') || ''; } catch (_) {}
  const m = document.createElement('div'); m.className = 'td-sheet'; m.id = 'td-sheet';
  m.innerHTML = `<div class="bx"><h5>Track record certificate</h5><div class="sub">Your name appears on the document. Demo account.</div>
    <div class="fld"><input type="text" id="td-cert-in" maxlength="46" placeholder="Your name" value="${esc(prev)}"></div>
    <div class="btns"><button id="td-cert-x">Cancel</button><button class="ok" id="td-cert-ok">Generate</button></div></div>`;
  document.body.appendChild(m);
  const cerrarS = () => { try { m.remove(); } catch (_) {} };
  const inp = m.querySelector('#td-cert-in'); setTimeout(() => { try { inp.focus(); inp.select(); } catch (_) {} }, 40);
  m.querySelector('#td-cert-x').onclick = cerrarS;
  m.onclick = (e) => { if (e.target === m) cerrarS(); };
  const go = () => { const nom = (inp.value || '').trim().slice(0, 46) || 'Demo Trader'; try { localStorage.setItem('td-cert-name', nom); } catch (_) {} cerrarS(); generarCert(nom); };
  m.querySelector('#td-cert-ok').onclick = go;
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); else if (e.key === 'Escape') cerrarS(); });
}
async function generarCert(nombre) {
  const st = certStats();
  const sello = await cargarImg(SELLO, false);
  const W = 1240, H = 1754; const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H; const g = cvs.getContext('2d');
  const oro = '#E8B84B', up = '#2ee86a', dn = '#ff5b6e', ink = '#eaecef', ink2 = '#9aa4af', ink3 = '#6b7580';
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b111a'); bg.addColorStop(1, '#070a0f'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = oro; g.fillRect(0, 0, W, 10);
  g.strokeStyle = 'rgba(232,184,75,.22)'; g.lineWidth = 2; g.strokeRect(22, 22, W - 44, H - 44);
  g.save(); g.translate(W / 2, H * .52); g.rotate(-Math.PI / 10); g.font = '800 300px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.033)'; g.fillText('DEMO', 0, 0); g.restore();
  const M0 = 74;
  // Logo (sello) arriba a la DERECHA; dominio debajo del logo.
  let domY = 92;
  if (sello) { const lw = 200, lh = sello.height * (lw / sello.width); g.drawImage(sello, W - M0 - lw, 54, lw, lh); domY = 54 + lh + 30; }
  g.textAlign = 'right'; g.fillStyle = ink3; g.font = '700 18px "IBM Plex Mono", monospace'; g.fillText('decfreedom.com', W - M0, domY);
  // Título arriba a la IZQUIERDA (ocupa el espacio que deja el logo al irse a la derecha).
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = ink; g.font = '800 54px "Chakra Petch", sans-serif'; g.fillText('Trading Performance', M0, 132);
  g.fillStyle = oro; g.font = '800 54px "Chakra Petch", sans-serif'; g.fillText('Certificate', M0, 196);
  g.fillStyle = ink3; g.font = '700 17px "IBM Plex Mono", monospace'; g.fillText('DEMO ACCOUNT · NOT REAL MONEY', M0, 230);
  g.fillStyle = ink2; g.font = '600 19px "IBM Plex Mono", monospace'; g.fillText('Issued to', M0, 306);
  g.fillStyle = '#fff'; g.font = '800 42px "Plus Jakarta Sans", sans-serif'; g.fillText(nombre, M0, 352);
  g.fillStyle = '#c3cbd4'; g.font = '400 19px "Plus Jakarta Sans", sans-serif';
  wrapTexto(g, 'DecFreedom provided a demo trading service with a starting balance of $10,000. This document certifies the track record achieved on the demo platform over the period shown.', M0, 398, W - M0 * 2, 27);
  const periodo = st.desde ? (st.desde.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }) + '  →  ' + st.hasta.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' })) : '—';
  const roi = st.total / st.startBal * 100;
  const tiles = [
    ['Trades', String(st.n), ink],
    ['Win rate', st.winRate + '%', st.winRate >= 50 ? up : ink],
    ['Net PnL', (st.total >= 0 ? '+' : '−') + '$' + Math.abs(st.total).toLocaleString('en-US', { maximumFractionDigits: 0 }), st.total >= 0 ? up : dn],
    ['ROI', (roi >= 0 ? '+' : '−') + Math.abs(roi).toFixed(1) + '%', roi >= 0 ? up : dn],
    ['Start', '$10,000', ink],
    ['End balance', '$' + st.endBal.toLocaleString('en-US', { maximumFractionDigits: 0 }), st.endBal >= 10000 ? up : dn]
  ];
  const tY = 480, tW = (W - M0 * 2 - 2 * 18) / 3, tH = 112;
  tiles.forEach((t, i) => {
    const x = M0 + (i % 3) * (tW + 18), y = tY + ((i / 3) | 0) * (tH + 16);
    g.fillStyle = 'rgba(255,255,255,.035)'; redondea(g, x, y, tW, tH, 12); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; redondea(g, x + .5, y + .5, tW - 1, tH - 1, 12); g.stroke();
    g.fillStyle = ink3; g.font = '700 14px "IBM Plex Mono", monospace'; g.textAlign = 'left'; g.fillText(t[0].toUpperCase(), x + 18, y + 33);
    g.fillStyle = t[2]; g.font = '800 33px "Chakra Petch", sans-serif'; g.fillText(t[1], x + 18, y + 78);
  });
  g.fillStyle = ink2; g.font = '600 18px "IBM Plex Mono", monospace'; g.textAlign = 'left'; g.fillText('Period:  ' + periodo, M0, tY + 2 * (tH + 16) + 36);
  const chY = 820, chH = 360, chW = W - M0 * 2;
  g.fillStyle = ink; g.font = '800 24px "Chakra Petch", sans-serif'; g.fillText('Equity curve', M0, chY - 16);
  dibChartLinea(g, M0, chY, chW, chH, st.curva, oro);
  const bY = chY + chH + 78, bH = 240;
  g.fillStyle = ink; g.font = '800 24px "Chakra Petch", sans-serif'; g.fillText('Wins vs losses', M0, bY - 16);
  dibBarras(g, M0, bY, chW, bH, [['Wins', st.wins, up], ['Losses', st.losses, dn]]);
  const fY = H - 150;
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(M0, fY); g.lineTo(W - M0, fY); g.stroke();
  g.fillStyle = ink3; g.font = '600 16px "IBM Plex Mono", monospace'; g.textAlign = 'left'; g.fillText('Issued ' + new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · DecFreedom demo', M0, fY + 34);
  g.textAlign = 'right'; g.fillText('Practice record. No real funds were traded.', W - M0, fY + 34); g.textAlign = 'left';
  mostrarCert(cvs, nombre);
}
function dibChartLinea(g, x, y, w, h, datos, col) {
  g.save();
  g.fillStyle = 'rgba(255,255,255,.02)'; redondea(g, x, y, w, h, 12); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; redondea(g, x + .5, y + .5, w - 1, h - 1, 12); g.stroke();
  if (!datos || datos.length < 2) { g.fillStyle = '#6b7580'; g.font = '600 18px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Not enough trades yet', x + w / 2, y + h / 2); g.restore(); return; }
  const padX = 20, padT = 24, padB = 24;
  let min = Math.min(...datos), max = Math.max(...datos);
  const base = (max - min) || (max * 0.02) || 1; min -= base * 0.14; max += base * 0.14; const rng = max - min;
  const px = (i) => x + padX + (w - padX * 2) * (datos.length === 1 ? 0.5 : i / (datos.length - 1));
  const py = (v) => y + padT + (h - padT - padB) * (1 - (v - min) / rng);
  // rejilla + etiquetas de valor
  g.textAlign = 'right'; g.textBaseline = 'middle'; g.font = '600 13px "IBM Plex Mono", monospace';
  for (let k = 0; k <= 3; k++) { const v = min + rng * k / 3, yy = py(v); g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + padX, yy); g.lineTo(x + w - padX, yy); g.stroke(); g.fillStyle = '#5a636e'; g.fillText('$' + Math.round(v).toLocaleString('en-US'), x + w - 10, yy); }
  // baseline $10,000
  if (min <= 10000 && max >= 10000) { const yb = py(10000); g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + padX, yb); g.lineTo(x + w - padX, yb); g.stroke(); g.setLineDash([]); }
  const pts = datos.map((v, i) => ({ x: px(i), y: py(v) }));
  // trazo SUAVE (Catmull-Rom -> bezier) para que la curva fluya
  const trazo = () => { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2; g.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y); } };
  const grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, 'rgba(232,184,75,.26)'); grd.addColorStop(1, 'rgba(232,184,75,0)');
  trazo(); g.lineTo(pts[pts.length - 1].x, y + h - padB); g.lineTo(pts[0].x, y + h - padB); g.closePath(); g.fillStyle = grd; g.fill();
  g.save(); g.shadowColor = 'rgba(232,184,75,.45)'; g.shadowBlur = 8; trazo(); g.strokeStyle = col; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke(); g.restore();
  pts.forEach((p, i) => { const last = i === pts.length - 1; g.beginPath(); g.arc(p.x, p.y, (i === 0 || last) ? 5 : 3.5, 0, 7); g.fillStyle = last ? '#fff' : col; g.fill(); if (last) { g.strokeStyle = col; g.lineWidth = 2; g.stroke(); } });
  g.restore();
}
function dibBarras(g, x, y, w, h, series) {
  g.save();
  const maxV = Math.max(1, ...series.map((s) => s[1]));
  const bw = 160, gap = 80; let bx = x + 30;
  series.forEach((s) => {
    const bh = Math.max(2, (h - 60) * (s[1] / maxV)); const by = y + (h - 34) - bh;
    g.fillStyle = s[2]; redondea(g, bx, by, bw, bh, 8); g.fill();
    g.fillStyle = '#eaecef'; g.font = '800 28px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.fillText(String(s[1]), bx + bw / 2, by - 12);
    g.fillStyle = '#9aa4af'; g.font = '700 16px "IBM Plex Mono", monospace'; g.fillText(s[0], bx + bw / 2, y + h - 4);
    bx += bw + gap;
  });
  g.restore();
}
function mostrarCert(cvs, nombre) {
  const old = $('td-modal'); if (old) old.remove();
  const m = document.createElement('div'); m.id = 'td-modal'; m.innerHTML = `<div class="card"></div>`;
  m.querySelector('.card').appendChild(cvs);
  const acts = document.createElement('div'); acts.className = 'acts';
  acts.innerHTML = `<button class="dl" id="cert-png">Image (PNG)</button><button id="cert-pdf">PDF</button><button id="cert-csv">Excel (CSV)</button><button class="cl">Close</button>`;
  m.querySelector('.card').appendChild(acts); document.body.appendChild(m);
  const ce = () => m.remove(); m.querySelector('.cl').onclick = ce; m.onclick = (e) => { if (e.target === m) ce(); };
  const base = 'DecFreedom-track-record-' + String(nombre).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  m.querySelector('#cert-png').onclick = () => { try { cvs.toBlob((b) => descargar(b, base + '.png'), 'image/png'); } catch (_) { toast('Could not export PNG.', 'bad'); } };
  m.querySelector('#cert-pdf').onclick = () => { try { const jpg = cvs.toDataURL('image/jpeg', 0.92); const bin = atob(jpg.split(',')[1]); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); descargar(pdfDeImagen(bytes, cvs.width, cvs.height), base + '.pdf'); toast('PDF exported.', 'ok'); } catch (_) { toast('Could not export PDF.', 'bad'); } };
  m.querySelector('#cert-csv').onclick = exportarCSV;
}
/* PDF de una sola página con la imagen embebida (JPEG/DCTDecode): sin librerías
   y sin cortes de fila, porque el certificado es una imagen completa. */
function pdfDeImagen(jpg, Wpx, Hpx) {
  const enc = new TextEncoder(); const parts = []; let len = 0; const off = [];
  const push = (d) => { const b = (typeof d === 'string') ? enc.encode(d) : d; parts.push(b); len += b.length; };
  const mark = () => off.push(len);
  const pageW = 595, pageH = Math.round(595 * Hpx / Wpx);
  push('%PDF-1.3\n');
  mark(); push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  mark(); push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  mark(); push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
  mark(); push('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + Wpx + ' /Height ' + Hpx + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'); push(jpg); push('\nendstream\nendobj\n');
  const content = 'q\n' + pageW + ' 0 0 ' + pageH + ' 0 0 cm\n/Im0 Do\nQ\n';
  mark(); push('5 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\nendobj\n');
  const xs = len; let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 0; i < 5; i++) xref += String(off[i]).padStart(10, '0') + ' 00000 n \n';
  push(xref); push('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xs + '\n%%EOF');
  return new Blob(parts, { type: 'application/pdf' });
}

function renderTodo() { sincronCap(); pintarPrecio(); renderEntry(); renderPos(); }

/* ── Ayuda ── */
function ayuda() {
  cerrarPops();
  marcarAyudaVista();
  const old = $('td-help'); if (old) old.remove();
  const m = document.createElement('div'); m.id = 'td-help';
  m.innerHTML = `<div class="box"><button class="x" id="td-help-x" title="Close">✕</button>
    <h4>How to trade (demo)</h4>
    <div class="st"><b>1</b><div><em>Capital & leverage:</em> use the two sliders to set how much margin you commit and your leverage. Order size = capital × leverage.</div></div>
    <div class="st"><b>2</b><div><em>Market:</em> hit Long or Short to fill now at the mark price. <em>Limit:</em> pick the Limit tab, click the chart to mark your entry, then Long or Short (the price decides when it fills).</div></div>
    <div class="st"><b>3</b><div><em>TP / SL like TradingView:</em> on an open position, grab the small green <em>TP</em> and red <em>SL</em> squares next to the entry tag and <em>drag them</em> up or down. You can also edit them with the pencil on each row.</div></div>
    <div class="st"><b>4</b><div><em>Liquidation:</em> every position shows a liquidation price from your leverage. More leverage sits closer to entry. If price reaches it you lose that position's margin, and SL cannot be placed past it.</div></div>
    <div class="st"><b>5</b><div>Drag the price or time axis to zoom, use Expand for a bigger chart, scroll down for Positions, Marked orders and History, and export a trade card or your track record certificate.</div></div>
    <div class="pie">Demo only. No real orders, no real money. Fees are simulated like Binance (taker, round trip).</div></div>`;
  document.body.appendChild(m);
  const ce = () => m.remove();
  $('td-help-x').onclick = ce;
  m.onclick = (e) => { if (e.target === m) ce(); };
}
function marcarAyudaVista() { try { localStorage.setItem('td-help-seen', '1'); } catch (_) {} const dot = $('td-help-dot'); if (dot) dot.remove(); }

/* ── Barra de dibujo compartida ── */
function geoDib() {
  const cv = $('td-cv'); if (!S.chart || !S.serieVela || !cv) return null;
  let ts; try { ts = S.chart.timeScale(); } catch (_) { return null; }
  const W = cv.clientWidth, H = cv.clientHeight;
  let x1; try { x1 = ts.width(); } catch (_) { x1 = W; } if (!(x1 > 0)) x1 = W;
  let y1 = H; try { const pn = S.chart.panes(); y1 = (pn && pn[0]) ? pn[0].getHeight() : H; } catch (_) { y1 = H; } if (!(y1 > 0)) y1 = H;
  let vr; try { vr = ts.getVisibleLogicalRange(); } catch (_) { vr = null; } if (!vr) return null;
  const nV = S.velas.length;
  const iA = Math.max(0, Math.min(nV - 1, Math.ceil(vr.from))), iB = Math.max(0, Math.min(nV - 1, iA + 1));
  let paso, b; const xA = ts.logicalToCoordinate(iA), xB = ts.logicalToCoordinate(iB);
  if (xA == null || xB == null || iB === iA) { paso = (ts.options().barSpacing) || 9; b = (xA != null) ? xA - paso * iA : 0; }
  else { paso = (xB - xA) / (iB - iA); b = xA - paso * iA; }
  if (!(paso > 0)) paso = 9;
  const pri = 0.5 - b / paso, ancho = x1 / paso, fin = pri + ancho;
  const pMax = S.serieVela.coordinateToPrice(0), pMin = S.serieVela.coordinateToPrice(y1);
  if (pMax == null || pMin == null) return null;
  const Y = (p) => { const c = S.serieVela.priceToCoordinate(p); return (c == null) ? (y1 * (pMax - p) / ((pMax - pMin) || 1)) : c; };
  return { W, H, x1, y1, pMin, pMax, Y, ancho, paso, fin };
}
let _syncPend = false;
function sincronizarDib() { if (!S.barra) return; if (_syncPend) return; _syncPend = true; requestAnimationFrame(() => { _syncPend = false; const g = geoDib(); if (g) { try { S.barra.redibujar(g, S.velasDib, S.par.id); } catch (_) {} } }); }
function montarBarraDemo() {
  const host = $('td-chart'); if (!host || S.dibMontada) { sincronizarDib(); return; }
  try { NIV.seccion = 'demo'; S.barra = montarBarra(host); if (S.barra && S.barra._tools) S.barra._tools.classList.add('nv-oculta'); S.dibMontada = true; if (window.ResizeObserver && !S.cvObs) { S.cvObs = new ResizeObserver(() => sincronizarDib()); S.cvObs.observe($('td-cv')); } sincronizarDib(); } catch (_) { S.barra = null; }
}

/* ── Menú de monedas ── */
function menuMonedas() {
  cerrarPops();
  const anc = $('td-coin'), r = anc.getBoundingClientRect();
  const m = document.createElement('div'); m.className = 'td-pop'; m.id = 'td-coinmenu';
  m.style.left = Math.max(8, r.left) + 'px'; m.style.top = (r.bottom + 6) + 'px';
  const lista = D.PARES.filter((p) => p.grupo !== 'divisa' && p.grupo !== 'materia');
  const pintar = (q) => {
    const f = !q ? lista : lista.filter((p) => (p.id + ' ' + (p.n || '')).toLowerCase().includes(q.toLowerCase()));
    m.querySelector('.td-lst').innerHTML = f.slice(0, 60).map((p) => { const url = p.cg && S.logos[p.cg]; return `<button class="it ${p.id === S.par.id ? 'on' : ''}" data-id="${esc(p.id)}">${url ? `<i class="con" style="background-image:url(${esc(url)})"></i>` : `<i>${esc(p.id[0])}</i>`}<b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`; }).join('');
    m.querySelectorAll('.it').forEach((b) => b.onclick = async () => { const p = D.PARES.find((x) => x.id === b.dataset.id); if (p) { S.par = p; cerrarPops(); await cargarDatos(); montarBarraDemo(); } });
  };
  m.innerHTML = `<input type="text" placeholder="Search symbol" id="td-cm-q"><div class="td-lst"></div>`;
  document.body.appendChild(m); pintar('');
  const inp = m.querySelector('#td-cm-q'); inp.oninput = () => pintar(inp.value.trim()); setTimeout(() => inp.focus(), 0);
  m.onclick = (e) => e.stopPropagation();
  setTimeout(() => document.addEventListener('mousedown', cierraPopFuera), 0);
}
function cierraPopFuera(e) { const ids = ['td-coinmenu']; const anc = ['td-coin']; const hit = ids.some((id) => { const m = $(id); return m && m.contains(e.target); }) || anc.some((id) => { const a = $(id); return a && a.contains(e.target); }); if (!hit) cerrarPops(); }
function cerrarPops() { ['td-coinmenu'].forEach((id) => { const m = $(id); if (m) m.remove(); }); document.removeEventListener('mousedown', cierraPopFuera); }

function toast(msg, tipo) { const old = document.querySelector('.td-toast'); if (old) old.remove(); const t = document.createElement('div'); t.className = 'td-toast ' + (tipo || ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => { try { t.remove(); } catch (_) {} }, 320); }, 2600); }

function cerrar() {
  try { if (S.uiRAF) cancelAnimationFrame(S.uiRAF); } catch (_) {} S.uiRAF = null;
  try { if (S.stream) S.stream.cerrar(); } catch (_) {} S.stream = null; _streamKey = '';
  try { if (S.cvObs) S.cvObs.disconnect(); } catch (_) {} S.cvObs = null;
  if (S.onResize) { window.removeEventListener('resize', S.onResize); S.onResize = null; }
  try { if (S.barra && S.barra.desmontar) S.barra.desmontar(); } catch (_) {} S.barra = null; S.dibMontada = false;
  try { if (S.chart) S.chart.remove(); } catch (_) {} S.chart = null; S.serieVela = null;
  try { if (S.ac) S.ac.close(); } catch (_) {} S.ac = null;
  cerrarPops();
  ['td-modal', 'td-sheet', 'td-help'].forEach((id) => { const el = $(id); if (el) el.remove(); });
  S.expand = false; S.drag = null;
  const ov = $('td-overlay'); if (ov) ov.remove();
}
