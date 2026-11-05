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

import { estilos } from './estilos.js?v=4';
import * as D from './datos.js?v=2';
import * as M from './motor.js?v=4';
import { montarBarra } from '../../assets/js/niveles/barra.js?v=6';
import { N as NIV } from '../../assets/js/niveles/estado.js?v=1';

const LIB = new URL('./vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const LOGO_ALT = new URL('../../assets/img/cco-full.webp', import.meta.url).href;

const S = {
  par: null, tf: '1m', velas: [], velasDib: [], chart: null, serieVela: null, serieVol: null,
  mark: 0, open24: 0, high24: 0, low24: 0, vol24: 0, chgPct: 0,
  lev: 20, tam: 200, modo: 'market', limitPx: 0,
  stream: null, barra: null, dibMontada: false, lineaLimit: null, tab: 'pos',
  uiRAF: null, onResize: null, cvObs: null, marks: {}, logos: {},
  drag: null, hoverH: null, ac: null
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
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>'
};

export async function abrirDemo() {
  estilos();
  const prev = $('td-overlay'); if (prev) prev.remove();
  S.par = (D.PARES.find((p) => p.id === 'BTC') || D.PARES[0]);
  const ov = document.createElement('div'); ov.id = 'td-overlay';
  ov.innerHTML = plantilla();
  document.body.appendChild(ov);
  cablear(ov);
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
      <div class="td-stat"><b>24h volume</b><span id="td-vol">—</span></div>
    </div>
    <div class="td-wallet"><b>Equity · Demo</b><span class="eq" id="td-eq">—</span><small id="td-bal">—</small></div>
    <button class="td-icobtn" id="td-help-btn" title="How it works">${IC.help}</button>
    <button class="td-icobtn" id="td-export" title="Export chart image">${IC.cam}</button>
    <button class="td-icobtn" id="td-reset" title="Reset demo balance">${IC.reset}</button>
  </div>
  <div class="td-body">
    <div class="td-main" id="td-main">
      <div class="td-chart" id="td-chart">
        <div class="td-cv" id="td-cv"></div>
        <canvas class="td-fx" id="td-fx"></canvas>
        <div class="td-wm"><img src="${LOGO}" onerror="this.onerror=null;this.src='${LOGO_ALT}'" alt=""></div>
        <div class="td-spin" id="td-spin"><i></i></div>
      </div>
      <div class="td-entry">
        <div class="td-modes"><button class="td-mode on" data-modo="market">Market</button><button class="td-mode" data-modo="limit">Limit (mark)</button></div>
        <div class="td-fld" id="td-limitwrap" style="display:none">
          <div class="td-fld-l"><span>Entry price</span><span>click the chart</span></div>
          <div class="td-in"><input type="number" id="td-limit" placeholder="0.00" step="any"><em>USDT</em></div>
        </div>
        <button class="td-levbtn" id="td-levbtn"><span>Leverage</span><b id="td-levbv">20x</b></button>
        <div class="td-fld">
          <div class="td-fld-l"><span>Size</span><span id="td-avail">—</span></div>
          <div class="td-in"><input type="number" id="td-size" value="200" step="any"><em>USDT</em><span class="td-step"><button data-step="1">${IC.up}</button><button data-step="-1">${IC.down}</button></span></div>
          <div class="td-pcts"><button class="td-pct" data-pct="25">25%</button><button class="td-pct" data-pct="50">50%</button><button class="td-pct" data-pct="75">75%</button><button class="td-pct" data-pct="100">Max</button></div>
        </div>
        <div class="td-tpsl">
          <div class="td-in"><em>TP</em><input type="number" id="td-tp" placeholder="optional" step="any"></div>
          <div class="td-in"><em>SL</em><input type="number" id="td-sl" placeholder="optional" step="any"></div>
        </div>
        <div class="td-cost"><span>Margin</span><b id="td-margin">—</b></div>
        <div class="td-cost"><span>Liq. (est.)</span><b class="liqv" id="td-liqprev">—</b></div>
        <div class="td-ops"><button class="td-op long" id="td-long">Long</button><button class="td-op short" id="td-short">Short</button></div>
      </div>
    </div>
    <div class="td-pos">
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
  $('td-help-btn').onclick = (e) => { e.stopPropagation(); ayuda(); };
  $('td-reset').onclick = () => { if (confirm('Reset the demo to $10,000 and clear all positions and history?')) { M.reset(); renderTodo(); toast('Demo reset to $10,000.', 'ok'); } };
  $('td-tfcur').onclick = (e) => { e.stopPropagation(); $('td-tf').classList.toggle('open'); };
  document.addEventListener('click', () => $('td-tf') && $('td-tf').classList.remove('open'));
  const size = $('td-size'); size.oninput = () => { S.tam = Math.max(0, +size.value || 0); renderEntry(); };
  ov.querySelectorAll('.td-step button').forEach((b) => b.onclick = () => { const paso = Math.max(10, Math.round(S.tam * 0.1)); S.tam = Math.max(0, +(S.tam + (+b.dataset.step) * paso).toFixed(2)); size.value = S.tam; renderEntry(); });
  $('td-limit').oninput = () => { S.limitPx = Math.max(0, +$('td-limit').value || 0); dibujarLimit(); renderEntry(); };
  ov.querySelectorAll('.td-mode').forEach((b) => b.onclick = () => { S.modo = b.dataset.modo; ov.querySelectorAll('.td-mode').forEach((x) => x.classList.toggle('on', x === b)); $('td-limitwrap').style.display = S.modo === 'limit' ? 'flex' : 'none'; dibujarLimit(); renderEntry(); });
  ov.querySelectorAll('.td-pct').forEach((b) => b.onclick = () => { S.tam = Math.max(0, +(M.balance() * S.lev * (+b.dataset.pct) / 100).toFixed(2)); size.value = S.tam; renderEntry(); });
  $('td-levbtn').onclick = (e) => { e.stopPropagation(); popLev(); };
  $('td-long').onclick = () => operar('long');
  $('td-short').onclick = () => operar('short');
  ov.querySelectorAll('.td-pos-tab').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; ov.querySelectorAll('.td-pos-tab').forEach((x) => x.classList.toggle('on', x === b)); renderPos(); });
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
    rightPriceScale: { borderColor: '#232b35', scaleMargins: { top: 0.06, bottom: 0.06 } },
    timeScale: { borderColor: '#232b35', timeVisible: true, secondsVisible: false, barSpacing: 9, rightOffset: 10, minBarSpacing: 1 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  S.chart = chart;
  const V = S.velas;
  const vela = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e' });
  vela.setData(V.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))); S.serieVela = vela;
  const vol = chart.addSeries(LC.HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } });
  vol.priceScale().applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });
  vol.setData(V.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(46,232,106,.26)' : 'rgba(255,91,110,.26)' }))); S.serieVol = vol;
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
  try { S.serieVol.update({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(46,232,106,.26)' : 'rgba(255,91,110,.26)' }); } catch (_) {}
  nuevoPrecio(c.close);
  if (k.x === true) { S.velasDib = S.velas.map((v) => ({ t: v.time, o: v.open, h: v.high, l: v.low, c: v.close, v: v.volume })); sincronizarDib(); }
}

function nuevoPrecio(px) {
  S.mark = px; S.marks[S.par.id] = px;
  if (S.open24 > 0) S.chgPct = ((px - S.open24) / S.open24) * 100;
  const ev = M.onPrecio(S.par.id, px); let cambio = false;
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
  const avail = $('td-avail'); if (avail) avail.textContent = 'Avail ' + fmtMoney(M.balance());
  const margen = S.lev > 0 ? S.tam / S.lev : 0;
  const mg = $('td-margin'); if (mg) mg.textContent = fmtMoney(margen);
  $('td-levbv').textContent = S.lev + 'x';
  const px = S.modo === 'limit' && S.limitPx > 0 ? S.limitPx : S.mark;
  const lp = $('td-liqprev'); if (lp) lp.textContent = px > 0 ? (fmtP(M.liqPrecio('long', px, S.lev)) + ' / ' + fmtP(M.liqPrecio('short', px, S.lev))) : '—';
}

function popLev() {
  cerrarPops();
  const anc = $('td-levbtn'), r = anc.getBoundingClientRect();
  const m = document.createElement('div'); m.className = 'td-pop'; m.id = 'td-levpop';
  m.style.left = Math.max(8, r.left) + 'px'; m.style.top = (r.bottom + 6) + 'px';
  const presets = [1, 5, 10, 25, 50, 75, 100, 125];
  m.innerHTML = `<div class="t">Adjust leverage</div><div class="big" id="lv-big">${S.lev}x</div>
    <input type="range" id="lv-rng" min="1" max="125" value="${S.lev}"><div class="marks"><span>1x</span><span>25x</span><span>50x</span><span>75x</span><span>125x</span></div>
    <div class="chips">${presets.map((p) => `<button data-l="${p}" class="${p === S.lev ? 'on' : ''}">${p}x</button>`).join('')}</div>
    <div class="nota">Max position at this leverage: <b id="lv-max">—</b><br>Higher leverage, higher liquidation risk.</div>
    <button class="ok" id="lv-ok">Confirm</button>`;
  document.body.appendChild(m);
  const rng = m.querySelector('#lv-rng'), big = m.querySelector('#lv-big'), max = m.querySelector('#lv-max');
  const upd = (v) => { S.lev = Math.max(1, Math.min(125, v | 0)); big.textContent = S.lev + 'x'; rng.value = S.lev; max.textContent = fmtMoney(M.balance() * S.lev); m.querySelectorAll('.chips button').forEach((b) => b.classList.toggle('on', +b.dataset.l === S.lev)); };
  upd(S.lev);
  rng.oninput = () => upd(+rng.value);
  m.querySelectorAll('.chips button').forEach((b) => b.onclick = () => upd(+b.dataset.l));
  m.querySelector('#lv-ok').onclick = () => { cerrarPops(); renderEntry(); };
  m.onclick = (e) => e.stopPropagation();
  setTimeout(() => document.addEventListener('mousedown', cierraPopFuera), 0);
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
    body.innerHTML = `<table class="td-tbl"><thead><tr><th>Symbol</th><th>Size</th><th>Entry</th><th>Mark</th><th>Liq.</th><th>Margin</th><th>TP / SL</th><th>PnL (ROE)</th><th></th></tr></thead><tbody>${pos.map(filaPos).join('')}</tbody></table>`;
    body.querySelectorAll('[data-cerrar]').forEach((b) => b.onclick = () => { const x = M.cerrar(b.dataset.cerrar, S.marks[b.dataset.par] || S.mark, 'manual'); if (x) { toast(`Closed ${x.pos.lado} · ${fmtMoney(x.pnl)} (fee ${fmtMoney(x.fee)})`, x.pnl >= 0 ? 'ok' : 'bad'); renderPos(); } });
    body.querySelectorAll('[data-tpsl]').forEach((b) => b.onclick = () => { const p = pos.find((x) => x.id === b.dataset.tpsl); if (p) toggleTPSL(p); });
    body.querySelectorAll('[data-share]').forEach((b) => b.onclick = () => { const p = pos.find((x) => x.id === b.dataset.share); if (p) tarjetaPnL(cerradoDesde(p)); });
  } else if (S.tab === 'ord') {
    if (!ord.length) { body.innerHTML = '<div class="td-empty">No marked orders. In Limit mode, click the chart to mark where you want to enter.</div>'; return; }
    body.innerHTML = `<table class="td-tbl"><thead><tr><th>Symbol</th><th>Side</th><th>Size</th><th>Mark-in</th><th>Current</th><th></th></tr></thead><tbody>${ord.map((o) => `<tr><td><span class="td-sym">${logoChip(o.par)} ${esc(o.par)}USDT</span></td><td><span class="td-tag ${o.lado}">${o.lado.toUpperCase()}</span></td><td>${fmtMoney(o.tam)}</td><td>${fmtP(o.precio)}</td><td>${fmtP(S.marks[o.par] || S.mark)}</td><td><button class="td-x" data-cancel="${o.id}">Cancel</button></td></tr>`).join('')}</tbody></table>`;
    body.querySelectorAll('[data-cancel]').forEach((b) => b.onclick = () => { if (M.cancelarOrden(b.dataset.cancel)) renderPos(); });
  } else {
    const st = M.stats(30);
    if (r) r.innerHTML = `<span class="td-stat-chip">30d PnL <b class="${cls(st.total)}">${fmtMoney(st.total)}</b></span><span class="td-stat-chip">Win rate <b>${st.winRate}%</b></span><span class="td-stat-chip">Trades <b>${st.n}</b></span>${hist.length ? `<button class="td-x" id="td-csv">Export CSV</button>` : ''}`;
    if ($('td-csv')) $('td-csv').onclick = exportarCSV;
    if (!hist.length) { body.innerHTML = '<div class="td-empty">No closed trades yet. Your track record builds here as you open and close demo trades.</div>'; return; }
    body.innerHTML = `<table class="td-tbl"><thead><tr><th>Closed</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>PnL (ROE)</th><th></th></tr></thead><tbody>${hist.map((h) => { const c = h.pnl >= 0 ? 'up' : 'down'; const d = new Date(h.cerrado); const f = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); const mo = h.motivo === 'tp' ? ' · TP' : h.motivo === 'sl' ? ' · SL' : h.motivo === 'liq' ? ' · LIQ' : ''; return `<tr><td>${f}</td><td><span class="td-sym">${logoChip(h.par)} ${esc(h.par)}</span></td><td><span class="td-tag ${h.lado}">${h.lado.toUpperCase()}</span> <span class="td-lev-badge">${h.lev}x</span></td><td>${fmtP(h.entrada)}</td><td>${fmtP(h.salida)}</td><td class="td-pnl ${c}">${fmtMoney(h.pnl)} (${fmtPct(h.roe)})${mo}</td><td><button class="td-share" data-shareh="${h.id}" title="Export trade card">${IC.share}</button></td></tr>`; }).join('')}</tbody></table>`;
    body.querySelectorAll('[data-shareh]').forEach((b) => b.onclick = () => { const h = hist.find((x) => x.id === b.dataset.shareh); if (h) tarjetaPnL(h); });
  }
}
function filaPos(p) {
  const { pnl, roe, qty } = M.pnlDe(p, S.marks[p.par] || S.mark); const c = pnl >= 0 ? 'up' : 'down';
  const tpsl = (p.tp || p.sl) ? `${p.tp ? fmtP(p.tp) : '—'} / ${p.sl ? fmtP(p.sl) : '—'}` : 'Add';
  return `<tr><td><span class="td-sym">${logoChip(p.par)} ${esc(p.par)}USDT <span class="td-tag ${p.lado}">${p.lado.toUpperCase()}</span> <span class="td-lev-badge">${p.lev}x</span></span></td>
    <td>${qty.toFixed(4)}</td><td>${fmtP(p.entrada)}</td><td data-mark="${p.id}">${fmtP(S.marks[p.par] || S.mark)}</td>
    <td class="td-liq">${fmtP(p.liq)}</td><td>${fmtMoney(p.margen)}</td>
    <td><button class="td-mini" data-tpsl="${p.id}">${tpsl}</button></td>
    <td class="td-pnl ${c}" data-pnl="${p.id}">${fmtMoney(pnl)} (${fmtPct(roe)})</td>
    <td><button class="td-share" data-share="${p.id}" title="Export trade card">${IC.share}</button> <button class="td-x" data-cerrar="${p.id}" data-par="${p.par}">Close</button></td></tr>`;
}
function logoChip(parId) { const p = D.PARES.find((x) => x.id === parId); const url = p && p.cg && S.logos[p.cg]; return url ? `<i class="con" style="background-image:url(${esc(url)})"></i>` : `<i>${esc((parId || '?')[0])}</i>`; }
function refrescarPnL() {
  if (S.tab !== 'pos') return;
  M.posiciones().forEach((p) => {
    const mk = document.querySelector(`[data-mark="${p.id}"]`); if (mk) mk.textContent = fmtP(S.marks[p.par] || S.mark);
    const pe = document.querySelector(`[data-pnl="${p.id}"]`); if (pe) { const { pnl, roe } = M.pnlDe(p, S.marks[p.par] || S.mark); pe.textContent = `${fmtMoney(pnl)} (${fmtPct(roe)})`; pe.className = 'td-pnl ' + (pnl >= 0 ? 'up' : 'down'); }
  });
}
function cerradoDesde(p) { const { pnl, roe } = M.pnlDe(p, S.marks[p.par] || S.mark); const fee = M.feeRueda(p.tam); return { par: p.par, lado: p.lado, lev: p.lev, tam: p.tam, entrada: p.entrada, salida: S.marks[p.par] || S.mark, pnl: pnl - fee, roe: roe - (fee / p.margen) * 100, cerrado: Date.now() }; }

/* Crea TP/SL por defecto (si no hay) para poder arrastrarlos; si ya hay, limpia. */
function toggleTPSL(p) {
  if (p.tp || p.sl) { M.setTPSL(p.id, 0, 0); toast('TP/SL cleared.', 'warn'); }
  else {
    const tp = p.lado === 'long' ? p.entrada * 1.008 : p.entrada * 0.992;
    const sl = p.lado === 'long' ? p.entrada * 0.996 : p.entrada * 1.004;
    M.setTPSL(p.id, +tp.toFixed(dec(tp)), +sl.toFixed(dec(sl)));
    toast('TP/SL added. Drag the lines on the chart to adjust.', 'ok');
  }
  renderPos();
}

/* ── Línea de la orden limit en preparación ── */
function dibujarLimit() {
  if (!S.serieVela) return;
  if (S.lineaLimit) { try { S.serieVela.removePriceLine(S.lineaLimit); } catch (_) {} S.lineaLimit = null; }
  if (S.modo === 'limit' && S.limitPx > 0) { try { S.lineaLimit = S.serieVela.createPriceLine({ price: S.limitPx, color: '#C9A84B', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'entry' }); } catch (_) {} }
}

/* ── Overlay de posiciones (entrada, zona PnL, TP/SL arrastrables, liq) ── */
function pintarFx() {
  const fx = $('td-fx'), cv = $('td-cv'); if (!fx || !cv || !S.serieVela) return;
  const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (fx.width !== Math.round(W * dpr)) { fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); fx.style.width = W + 'px'; fx.style.height = H + 'px'; }
  const g = fx.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const Y = (p) => { try { const c = S.serieVela.priceToCoordinate(p); return c == null ? null : c; } catch (_) { return null; } };
  S._handles = [];
  const markY = Y(S.mark);
  // órdenes marcadas: línea dorada pulsante
  const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 320);
  M.ordenes().filter((o) => o.par === S.par.id).forEach((o) => { const y = Y(o.precio); if (y == null) return; g.save(); g.setLineDash([6, 5]); g.strokeStyle = `rgba(232,184,75,${0.5 + 0.4 * pulso})`; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); etiqueta(g, W, y, (o.lado === 'long' ? 'LONG' : 'SHORT') + ' mark ' + fmtP(o.precio), '#E8B84B', '#2a1d00'); g.restore(); });
  // posiciones
  M.posiciones().filter((p) => p.par === S.par.id).forEach((p) => {
    const ey = Y(p.entrada), ly = Y(p.liq); if (ey == null) return;
    const { pnl, roe } = M.pnlDe(p, S.mark); const verde = pnl >= 0;
    const col = p.lado === 'long' ? '#2ee86a' : '#ff5b6e';
    // zona entrada -> mark
    if (markY != null) { g.fillStyle = verde ? 'rgba(46,232,106,.08)' : 'rgba(255,91,110,.08)'; const a = Math.min(ey, markY), b = Math.max(ey, markY); g.fillRect(0, a, W, b - a); }
    // línea de entrada
    g.save(); g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, ey); g.lineTo(W, ey); g.stroke(); g.restore();
    etiqueta(g, W, ey, `${p.lado === 'long' ? 'LONG' : 'SHORT'} ${p.lev}x  ${fmtMoney(pnl)} (${fmtPct(roe)})`, col, '#04210f');
    // liq
    if (ly != null) { g.save(); g.setLineDash([2, 4]); g.strokeStyle = 'rgba(255,91,110,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, ly); g.lineTo(W, ly); g.stroke(); etiqueta(g, W, ly, 'LIQ ' + fmtP(p.liq), 'rgba(255,91,110,.85)', '#2a0509'); g.restore(); }
    // TP / SL arrastrables
    if (p.tp) { const ty = Y(p.tp); if (ty != null) { lineaTPSL(g, W, ty, '#2ee86a', 'TP ' + fmtP(p.tp)); S._handles.push({ id: p.id, cual: 'tp', y: ty }); } }
    if (p.sl) { const sy = Y(p.sl); if (sy != null) { lineaTPSL(g, W, sy, '#ff5b6e', 'SL ' + fmtP(p.sl)); S._handles.push({ id: p.id, cual: 'sl', y: sy }); } }
  });
}
function lineaTPSL(g, W, y, col, txt) {
  g.save();
  g.setLineDash([7, 4]); g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.setLineDash([]);
  const xr = W - 72;                                        // a la izquierda del eje de precios
  etiqueta(g, xr, y, txt, col, '#04210f');
  g.fillStyle = col; redondea(g, xr + 3, y - 8, 13, 16, 3); g.fill();                          // tirador
  g.fillStyle = 'rgba(0,0,0,.5)'; [-3, 0, 3].forEach((o) => g.fillRect(xr + 6, y + o, 7, 1.4));  // grip
  g.restore();
}
function etiqueta(g, xRight, y, txt, bg, fg) { g.save(); g.font = '700 10.5px "IBM Plex Mono", monospace'; const w = g.measureText(txt).width + 14; const x = xRight - w - 8; g.fillStyle = bg; redondea(g, x, y - 9, w, 18, 4); g.fill(); g.fillStyle = fg; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, x + 7, y + 0.5); g.restore(); }
function redondea(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ── Arrastre de TP/SL ── */
function wireDrag() {
  const host = $('td-chart'), fx = $('td-fx'); if (!host || !fx) return;
  const handleEn = (e) => {
    if (!(NIV.herr === 'cursor' || NIV.herr == null) || !S._handles || !S._handles.length) return null;
    const r = host.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < r.width - 190 || x > r.width - 70) return null;   // banda del tirador, a la izquierda del eje de precios
    for (const h of S._handles) if (Math.abs(y - h.y) < 8) return h;
    return null;
  };
  /* La capa fx normalmente deja pasar TODO a la grafica (pan, zoom, arrastre de
     ejes, crosshair y clic). Solo "despierta" (pointer-events:auto) cuando el
     puntero esta sobre un tirador TP/SL, para arrastrarlo sin estorbar al resto. */
  host.addEventListener('mousemove', (e) => {
    if (S.drag) return;
    const h = handleEn(e);
    fx.style.pointerEvents = h ? 'auto' : 'none';
    fx.style.cursor = h ? 'ns-resize' : '';
  });
  fx.addEventListener('mousedown', (e) => {
    const h = handleEn(e); if (!h) return;
    e.stopPropagation(); e.preventDefault(); S.drag = { id: h.id, cual: h.cual };
  });
  window.addEventListener('mousemove', (e) => {
    if (!S.drag || !S.serieVela) return;
    const r = $('td-chart').getBoundingClientRect(); const y = e.clientY - r.top;
    let px; try { px = S.serieVela.coordinateToPrice(y); } catch (_) { px = null; }
    if (px > 0) { const p = M.posiciones().find((x) => x.id === S.drag.id); if (p) { M.setTPSL(p.id, S.drag.cual === 'tp' ? +px.toFixed(dec(px)) : (p.tp || 0), S.drag.cual === 'sl' ? +px.toFixed(dec(px)) : (p.sl || 0)); } }
  });
  window.addEventListener('mouseup', () => { if (S.drag) { S.drag = null; fx.style.pointerEvents = 'none'; renderPos(); } });
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
    (seqs[tipo] || []).forEach(([f, d, gg]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = tipo === 'tp' ? 'sine' : 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gg, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); t += d * .9; });
  } catch (_) {}
}

/* ── Exportaciones ── */
function descargar(blob, nombre) { if (!blob) return; const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); }
function cargarImg(url, cross) { return new Promise((res) => { if (!url) return res(null); const im = new Image(); if (cross) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }); }
async function exportarChart() {
  if (!S.chart) { toast('Chart is not ready yet.', 'warn'); return; }
  let ch; try { ch = S.chart.takeScreenshot(); } catch (_) { toast('Could not export the chart.', 'bad'); return; }
  const W = ch.width, H = ch.height, top = 64;
  const coinUrl = S.par && S.par.cg && S.logos[S.par.cg];
  const [imgCoin, wm1] = await Promise.all([cargarImg(coinUrl, true), cargarImg(LOGO, false)]);
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
  // Marca de agua: el logo (imagen) abajo a la izquierda, por encima del eje de tiempo
  if (imgWm && imgWm.width) { const wmH = 30, wmW = imgWm.width * (wmH / imgWm.height); g.save(); g.globalAlpha = .8; g.drawImage(imgWm, 18, out.height - wmH - 34, wmW, wmH); g.restore(); }
  try { out.toBlob((b) => { descargar(b, `demo-${S.par.id}-${S.tf}.png`); toast('Chart image exported.', 'ok'); }); } catch (_) { toast('Could not export the chart.', 'bad'); }
}
function exportarCSV() { try { descargar(new Blob([M.csv()], { type: 'text/csv' }), `demo-history-${S.par.id}.csv`); toast('History exported (CSV).', 'ok'); } catch (_) { toast('Could not export the history.', 'bad'); } }

function tarjetaPnL(tr) {
  const W = 600, H = 340, dpr = 2;
  const cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const verde = tr.pnl >= 0, col = verde ? '#2ee86a' : '#ff5b6e';
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#121a24'); bg.addColorStop(1, '#0a0d12'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.strokeRect(.5, .5, W - 1, H - 1);
  g.save(); g.translate(W / 2, H / 2); g.rotate(-Math.PI / 9); g.font = '800 120px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.035)'; g.fillText('DEMO', 0, 40); g.restore();
  g.fillStyle = '#E8B84B'; g.beginPath(); g.arc(34, 36, 6, 0, 7); g.fill();
  g.font = '800 16px "Chakra Petch", sans-serif'; g.fillStyle = '#E8B84B'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText('DecFreedom', 50, 42);
  g.font = '700 11px "IBM Plex Mono", monospace'; g.fillStyle = '#6b7580'; g.fillText('TRADING DEMO · not real', 50, 58);
  g.font = '800 26px "Chakra Petch", sans-serif'; g.fillStyle = '#eaecef'; g.fillText(tr.par + 'USDT', 34, 112);
  g.font = '800 14px "IBM Plex Mono", monospace'; g.fillStyle = col; g.fillText((tr.lado === 'long' ? 'LONG' : 'SHORT') + '  ·  ' + tr.lev + 'x', 34, 136);
  g.font = '800 72px "Chakra Petch", sans-serif'; g.fillStyle = col; g.fillText((tr.roe >= 0 ? '+' : '') + tr.roe.toFixed(2) + '%', 30, 220);
  g.font = '700 16px "IBM Plex Mono", monospace'; g.fillStyle = col; g.fillText((tr.pnl >= 0 ? '+' : '-') + '$' + Math.abs(tr.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT', 34, 250);
  g.textAlign = 'right'; g.font = '700 11px "IBM Plex Mono", monospace'; g.fillStyle = '#6b7580'; g.fillText('ENTRY', W - 160, 196); g.fillText('EXIT', W - 160, 224);
  g.font = '700 14px "IBM Plex Mono", monospace'; g.fillStyle = '#c9d1d9'; g.fillText(fmtP(tr.entrada), W - 34, 196); g.fillText(fmtP(tr.salida), W - 34, 224);
  g.font = '700 11px "IBM Plex Mono", monospace'; g.fillStyle = '#6b7580'; g.fillText(new Date(tr.cerrado).toLocaleString('en-US'), W - 34, H - 24);
  g.textAlign = 'left'; g.fillText('decfreedom.com', 34, H - 24);
  g.fillStyle = col; g.globalAlpha = .9; g.fillRect(0, H - 6, W, 6); g.globalAlpha = 1;
  const old = $('td-modal'); if (old) old.remove();
  const m = document.createElement('div'); m.id = 'td-modal'; m.innerHTML = `<div class="card"><button class="x">✕</button></div>`;
  m.querySelector('.card').prepend(cv);
  const acts = document.createElement('div'); acts.className = 'acts'; acts.innerHTML = `<button class="dl">Download image</button><button class="cl">Close</button>`;
  m.querySelector('.card').appendChild(acts); document.body.appendChild(m);
  const ce = () => m.remove(); m.querySelector('.x').onclick = ce; m.querySelector('.cl').onclick = ce; m.onclick = (e) => { if (e.target === m) ce(); };
  m.querySelector('.dl').onclick = () => { try { cv.toBlob((b) => descargar(b, `demo-trade-${tr.par}-${Date.now()}.png`)); } catch (_) {} };
}

function renderTodo() { pintarPrecio(); renderEntry(); renderPos(); }

/* ── Ayuda ── */
function ayuda() {
  cerrarPops();
  const old = $('td-help'); if (old) old.remove();
  const m = document.createElement('div'); m.id = 'td-help';
  m.innerHTML = `<div class="box"><button class="x" id="td-help-x" title="Close">✕</button>
    <h4>How to trade (demo)</h4>
    <div class="st"><b>1</b><div><em>Market:</em> set leverage and size, then hit Long or Short. It fills now at the mark price.</div></div>
    <div class="st"><b>2</b><div><em>Limit:</em> pick the Limit tab and <em>click the chart</em> where you want to enter. Set leverage and size, then Long or Short. The price decides when it fills (keep this open).</div></div>
    <div class="st"><b>3</b><div><em>TP / SL:</em> set them before entering, or on an open position press TP/SL and <em>drag the green and red lines</em> on the chart.</div></div>
    <div class="st"><b>4</b><div><em>Liquidation:</em> every position shows a liquidation price based on your leverage. More leverage means it sits closer to your entry. If the price reaches it, you lose that position's margin.</div></div>
    <div class="st"><b>5</b><div>Zoom by dragging the price axis or the time axis, close with Close, export the chart, or share a trade as an image. Your track record lives in History.</div></div>
    <div class="pie">Demo only. No real orders, no real money. Fees are simulated like Binance (taker, round trip).</div></div>`;
  document.body.appendChild(m);
  const ce = () => m.remove();
  $('td-help-x').onclick = ce;
  m.onclick = (e) => { if (e.target === m) ce(); };
}

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
function cierraPopFuera(e) { const ids = ['td-coinmenu', 'td-levpop', 'td-help']; const anc = ['td-coin', 'td-levbtn', 'td-help-btn']; const hit = ids.some((id) => { const m = $(id); return m && m.contains(e.target); }) || anc.some((id) => { const a = $(id); return a && a.contains(e.target); }); if (!hit) cerrarPops(); }
function cerrarPops() { ['td-coinmenu', 'td-levpop', 'td-help'].forEach((id) => { const m = $(id); if (m) m.remove(); }); document.removeEventListener('mousedown', cierraPopFuera); }

function toast(msg, tipo) { const old = document.querySelector('.td-toast'); if (old) old.remove(); const t = document.createElement('div'); t.className = 'td-toast ' + (tipo || ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => { try { t.remove(); } catch (_) {} }, 320); }, 2600); }

function cerrar() {
  try { if (S.uiRAF) cancelAnimationFrame(S.uiRAF); } catch (_) {} S.uiRAF = null;
  try { if (S.stream) S.stream.cerrar(); } catch (_) {} S.stream = null; _streamKey = '';
  try { if (S.cvObs) S.cvObs.disconnect(); } catch (_) {} S.cvObs = null;
  if (S.onResize) { window.removeEventListener('resize', S.onResize); S.onResize = null; }
  try { if (S.barra && S.barra.desmontar) S.barra.desmontar(); } catch (_) {} S.barra = null; S.dibMontada = false;
  try { if (S.chart) S.chart.remove(); } catch (_) {} S.chart = null; S.serieVela = null;
  try { if (S.ac) S.ac.close(); } catch (_) {} S.ac = null;
  cerrarPops(); const md = $('td-modal'); if (md) md.remove();
  const ov = $('td-overlay'); if (ov) ov.remove();
}
