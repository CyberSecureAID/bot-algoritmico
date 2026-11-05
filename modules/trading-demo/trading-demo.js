/* modules/trading-demo/trading-demo.js — Trading Demo.

   Interfaz de futuros estilo Binance (gráfica de alta frecuencia + libro de
   órdenes + trades + entrada + posiciones) con la paleta de DecFreedom. Es una
   DEMO: sin órdenes reales, sin contrato, sin backend. El usuario abre a mercado
   o MARCA una entrada en la gráfica y el precio en vivo decide si entra; el PnL
   corre en tiempo real y se puede cerrar o liquidar.

   Módulo AUTÓNOMO: su gráfica, sus datos y su motor son propios (no tocan nada
   del resto). Lo ÚNICO que reutiliza, a propósito, es lo compartido que el resto
   de secciones también usa: el catálogo de monedas, las temporalidades y la
   MISMA barra de dibujo. Nada de esto se modifica: solo se importa en lectura. */

import { estilos } from './estilos.js?v=1';
import * as D from './datos.js?v=1';
import * as M from './motor.js?v=1';
import { montarBarra } from '../../assets/js/niveles/barra.js?v=6';
import { N as NIV } from '../../assets/js/niveles/estado.js?v=1';

const LIB = new URL('./vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const LOGO_ALT = new URL('../../assets/img/cco-full.webp', import.meta.url).href;

const S = {
  par: null, tf: '1m', velas: [], velasDib: [], chart: null, serieVela: null, serieVol: null,
  mark: 0, open24: 0, high24: 0, low24: 0, vol24: 0, chgPct: 0,
  book: { bids: [], asks: [] }, trades: [], lev: 20, tam: 200, modo: 'market', limitPx: 0,
  stream: null, barra: null, dibMontada: false, lineas: [], tab: 'pos',
  bookDirty: false, uiRAF: null, onResize: null, cvObs: null, lineaLimit: null
};

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dec = (x) => { const a = Math.abs(x); return a >= 1000 ? 2 : a >= 1 ? 2 : a >= 0.1 ? 3 : a >= 0.001 ? 5 : 7; };
const fmtP = (x) => (x > 0 || x === 0) ? x.toLocaleString('en-US', { minimumFractionDigits: dec(x), maximumFractionDigits: dec(x) }) : '—';
const fmtUsd = (x) => (x >= 0 ? '' : '-') + '$' + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (x) => (x >= 0 ? '+' : '') + x.toFixed(2) + '%';
const cls = (x) => x > 0 ? 'up' : x < 0 ? 'down' : '';

const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
const RESET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';

export async function abrirDemo() {
  estilos();
  const prev = $('td-overlay'); if (prev) prev.remove();
  S.par = (D.PARES.find((p) => p.id === 'BTC') || D.PARES[0]);
  const ov = document.createElement('div'); ov.id = 'td-overlay';
  ov.innerHTML = plantilla();
  document.body.appendChild(ov);
  cablear(ov);
  renderTf();
  try { await cargarLib(); } catch (_) { toast('Chart engine failed to load. Reload.', 'bad'); return; }
  await cargarDatos();
  montarBarraDemo();
  S.onResize = () => { try { if (S.chart) S.chart.applyOptions({}); } catch (_) {} sincronizarDib(); };
  window.addEventListener('resize', S.onResize);
  arrancarUI();
}

function plantilla() {
  return `
  <div class="td-top">
    <button class="td-back" id="td-back">${BACK} Back</button>
    <span class="td-demo">Demo</span>
    <button class="td-coin" id="td-coin"><i></i><b id="td-coin-id">BTC</b>${CHEV}</button>
    <div class="td-tf" id="td-tf"></div>
    <div class="td-px"><div class="td-px-big" id="td-mark">—</div><div class="td-px-sub" id="td-marksub">Mark price</div></div>
    <div class="td-stats">
      <div class="td-stat"><b>24h change</b><span id="td-chg">—</span></div>
      <div class="td-stat"><b>24h high</b><span id="td-high">—</span></div>
      <div class="td-stat"><b>24h low</b><span id="td-low">—</span></div>
      <div class="td-stat"><b>24h volume</b><span id="td-vol">—</span></div>
    </div>
    <div class="td-wallet"><b>Demo balance</b><span id="td-bal">—</span></div>
    <button class="td-reset" id="td-reset" title="Reset demo balance">${RESET}</button>
  </div>
  <div class="td-body">
    <div class="td-main">
      <div class="td-chart" id="td-chart">
        <div class="td-cv" id="td-cv"></div>
        <div class="td-wm"><img src="${LOGO}" onerror="this.onerror=null;this.src='${LOGO_ALT}'" alt=""></div>
        <div class="td-spin" id="td-spin"><i></i></div>
      </div>
      <div class="td-book">
        <div class="td-book-hd"><span>Price (USDT)</span><span>Size</span></div>
        <div class="td-dom">
          <div class="td-dom-side asks" id="td-asks"></div>
          <div class="td-mid"><b id="td-mid">—</b></div>
          <div class="td-dom-side bids" id="td-bids"></div>
        </div>
        <div class="td-trades">
          <div class="td-trades-hd"><span>Price</span><span>Size</span><span>Time</span></div>
          <div class="td-trades-l" id="td-trades"></div>
        </div>
      </div>
      <div class="td-entry">
        <div class="td-modes">
          <button class="td-mode on" data-modo="market">Market</button>
          <button class="td-mode" data-modo="limit">Limit (mark)</button>
        </div>
        <div class="td-lev">
          <span class="td-fld-l" style="text-transform:none">Leverage</span>
          <input type="range" id="td-lev" min="1" max="125" value="20">
          <span class="td-lev-v" id="td-lev-v">20x</span>
        </div>
        <div class="td-fld" id="td-limitwrap" style="display:none">
          <div class="td-fld-l"><span>Entry price</span><span>click the chart</span></div>
          <div class="td-in"><input type="number" id="td-limit" placeholder="0.00" step="any"><em>USDT</em></div>
        </div>
        <div class="td-fld">
          <div class="td-fld-l"><span>Size</span><span id="td-avail">—</span></div>
          <div class="td-in"><input type="number" id="td-size" value="200" step="any"><em>USDT</em></div>
          <div class="td-pcts"><button class="td-pct" data-pct="25">25%</button><button class="td-pct" data-pct="50">50%</button><button class="td-pct" data-pct="75">75%</button><button class="td-pct" data-pct="100">Max</button></div>
        </div>
        <div class="td-cost"><span>Margin</span><b id="td-margin">—</b></div>
        <div class="td-cost"><span>Liq. price (est.)</span><b id="td-liqprev">—</b></div>
        <div class="td-ops">
          <button class="td-op long" id="td-long">Buy / Long<small id="td-long-s">Market</small></button>
          <button class="td-op short" id="td-short">Sell / Short<small id="td-short-s">Market</small></button>
        </div>
        <div class="td-hint">Demo only. <b>Market</b> fills now at the mark price. <b>Limit (mark)</b>: click the chart to mark an entry and the price decides when it is taken. No real orders.</div>
      </div>
    </div>
    <div class="td-pos">
      <div class="td-pos-tabs">
        <button class="td-pos-tab on" data-tab="pos">Positions <b id="td-npos">0</b></button>
        <button class="td-pos-tab" data-tab="ord">Marked orders <b id="td-nord">0</b></button>
      </div>
      <div class="td-pos-body" id="td-pos-body"></div>
    </div>
  </div>`;
}

function cablear(ov) {
  $('td-back').onclick = cerrar;
  $('td-coin').onclick = (e) => { e.stopPropagation(); menuMonedas(); };
  $('td-reset').onclick = () => { if (confirm('Reset the demo balance to $10,000 and clear all demo positions?')) { M.reset(); S.lineas.forEach((l) => { try { S.serieVela.removePriceLine(l); } catch (_) {} }); S.lineas = []; renderTodo(); toast('Demo balance reset.', 'ok'); } };
  const lev = $('td-lev'); lev.oninput = () => { S.lev = +lev.value; $('td-lev-v').textContent = S.lev + 'x'; renderEntry(); };
  const size = $('td-size'); size.oninput = () => { S.tam = Math.max(0, +size.value || 0); renderEntry(); };
  $('td-limit').oninput = () => { S.limitPx = Math.max(0, +$('td-limit').value || 0); dibujarLimit(); };
  ov.querySelectorAll('.td-mode').forEach((b) => b.onclick = () => {
    S.modo = b.dataset.modo; ov.querySelectorAll('.td-mode').forEach((x) => x.classList.toggle('on', x === b));
    $('td-limitwrap').style.display = S.modo === 'limit' ? 'flex' : 'none';
    $('td-long-s').textContent = $('td-short-s').textContent = S.modo === 'limit' ? 'Marked' : 'Market';
    dibujarLimit();
  });
  ov.querySelectorAll('.td-pct').forEach((b) => b.onclick = () => { const bal = M.balance(); S.tam = Math.max(0, +(bal * S.lev * (+b.dataset.pct) / 100).toFixed(2)); $('td-size').value = S.tam; renderEntry(); });
  $('td-long').onclick = () => operar('long');
  $('td-short').onclick = () => operar('short');
  ov.querySelectorAll('.td-pos-tab').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; ov.querySelectorAll('.td-pos-tab').forEach((x) => x.classList.toggle('on', x === b)); renderPos(); });
}

function renderTf() {
  const box = $('td-tf'); if (!box) return;
  const TFS = D.TFS || [{ id: '1m', n: '1m' }, { id: '5m', n: '5m' }, { id: '15m', n: '15m' }, { id: '1h', n: '1H' }, { id: '4h', n: '4H' }, { id: '1d', n: '1D' }];
  const quiero = ['1m', '5m', '15m', '1h', '4h', '1d'];
  const lista = TFS.filter((t) => quiero.includes(t.id));
  box.innerHTML = (lista.length ? lista : quiero.map((id) => ({ id, n: id.toUpperCase() }))).map((t) => `<button data-tf="${t.id}" class="${t.id === S.tf ? 'on' : ''}">${esc(t.n)}</button>`).join('');
  box.querySelectorAll('button').forEach((b) => b.onclick = async () => { if (b.dataset.tf === S.tf) return; S.tf = b.dataset.tf; box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); await cargarDatos(); });
}

function cargarLib() {
  return new Promise((res, rej) => {
    if (window.LightweightCharts) return res();
    let sc = $('td-lwc');
    if (sc) { sc.addEventListener('load', () => res()); sc.addEventListener('error', () => rej(new Error('lib'))); return; }
    sc = document.createElement('script'); sc.id = 'td-lwc'; sc.src = LIB;
    sc.onload = () => res(); sc.onerror = () => rej(new Error('lib'));
    document.head.appendChild(sc);
  });
}

async function cargarDatos() {
  const spin = $('td-spin'); if (spin) spin.style.display = 'grid';
  $('td-coin-id').textContent = S.par.id;
  try {
    const [v, t] = await Promise.all([ D.velas(S.par.s, S.tf, 500), D.ticker(S.par.s).catch(() => null) ]);
    S.velas = v || [];
    if (t) { S.mark = t.last; S.open24 = t.open; S.high24 = t.high; S.low24 = t.low; S.vol24 = t.volQuote; S.chgPct = t.chgPct; }
    else if (S.velas.length) { S.mark = S.velas[S.velas.length - 1].close; }
    pintarChart();
    conectarStream();
    renderTodo();
  } catch (_) { toast('Could not load market data.', 'bad'); }
  if (spin) spin.style.display = 'none';
}

function pintarChart() {
  const LC = window.LightweightCharts; const cv = $('td-cv'); if (!LC || !cv || !S.velas.length) return;
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  S.chart = null; S.lineas = [];
  const chart = LC.createChart(cv, {
    autoSize: true, localization: { locale: 'en' },
    layout: { background: { color: 'transparent' }, textColor: '#7d8794', fontFamily: '"Chakra Petch", ui-monospace, monospace', attributionLogo: false },
    grid: { vertLines: { color: 'rgba(35,43,53,.4)' }, horzLines: { color: 'rgba(35,43,53,.4)' } },
    rightPriceScale: { borderColor: '#232b35', scaleMargins: { top: 0.08, bottom: 0.08 } },
    timeScale: { borderColor: '#232b35', timeVisible: true, secondsVisible: false, barSpacing: 8, rightOffset: 8, minBarSpacing: 1 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  S.chart = chart;
  const V = S.velas;
  const vela = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e' });
  vela.setData(V.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))); S.serieVela = vela;
  const vol = chart.addSeries(LC.HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } });
  vol.priceScale().applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
  vol.setData(V.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(46,232,106,.26)' : 'rgba(255,91,110,.26)' }))); S.serieVol = vol;
  S.velasDib = V.map((c) => ({ t: c.time, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume }));
  try { const ts = chart.timeScale(); ts.setVisibleLogicalRange({ from: V.length - 150, to: V.length + 8 }); ts.subscribeVisibleLogicalRangeChange(() => sincronizarDib()); } catch (_) {}
  // Marcar entrada con un clic en la gráfica (modo Limit): el precio decide cuándo entra.
  try { chart.subscribeClick((p) => { if (!p || !p.point || S.modo !== 'limit') return; const px = S.serieVela.coordinateToPrice(p.point.y); if (px > 0) { S.limitPx = +px.toFixed(dec(px)); $('td-limit').value = S.limitPx; dibujarLimit(); renderEntry(); } }); } catch (_) {}
  actualizarLineas();
}

let _streamKey = '';
function conectarStream() {
  const key = S.par.s + '|' + S.tf;
  if (S.stream && _streamKey === key) return;
  if (S.stream) { try { S.stream.cerrar(); } catch (_) {} S.stream = null; }
  _streamKey = key;
  try {
    S.stream = D.streamMercado(S.par.s, S.tf, {
      onKline: (k) => onKline(k),
      onDepth: (d) => { S.book = { bids: d.bids || [], asks: d.asks || [] }; S.bookDirty = true; },
      onTrade: (t) => onTrade(t)
    });
  } catch (_) { S.stream = null; }
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

function onTrade(t) {
  const px = +t.p, qty = +t.q;
  if (!(px > 0)) return;
  S.trades.unshift({ p: px, q: qty, buy: !t.m, time: t.T || Date.now() });
  if (S.trades.length > 40) S.trades.length = 40;
  nuevoPrecio(px);
}

/* Cada nuevo precio: PnL, liquidaciones y fills de órdenes marcadas. */
function nuevoPrecio(px) {
  S.mark = px;
  if (S.open24 > 0) S.chgPct = ((px - S.open24) / S.open24) * 100;
  const ev = M.onPrecio(S.par.id, px);
  if (ev.fills.length) { ev.fills.forEach((p) => toast(`Marked ${p.lado === 'long' ? 'long' : 'short'} filled at ${fmtP(p.entrada)}`, 'ok')); renderPos(); actualizarLineas(); }
  if (ev.liqs.length) { ev.liqs.forEach((p) => toast(`${p.lado === 'long' ? 'Long' : 'Short'} liquidated at ${fmtP(p.liq)}`, 'bad')); renderPos(); actualizarLineas(); }
}

/* ── Bucle de UI (≈12 fps): precio, libro, PnL en vivo ── */
function arrancarUI() {
  let last = 0;
  const loop = (ts) => {
    S.uiRAF = requestAnimationFrame(loop);
    if (ts - last < 80) return; last = ts;
    try { pintarPrecio(); } catch (_) {}
    if (S.bookDirty) { S.bookDirty = false; try { renderBook(); } catch (_) {} }
    try { renderTrades(); } catch (_) {}
    try { refrescarPnL(); } catch (_) {}
  };
  S.uiRAF = requestAnimationFrame(loop);
}

function pintarPrecio() {
  const m = $('td-mark'); if (m) { m.textContent = fmtP(S.mark); m.className = 'td-px-big ' + cls(S.chgPct); }
  const mid = $('td-mid'); if (mid) { mid.textContent = fmtP(S.mark); mid.className = cls(S.chgPct); }
  const chg = $('td-chg'); if (chg) { chg.textContent = fmtPct(S.chgPct); chg.className = cls(S.chgPct); }
  const hi = $('td-high'); if (hi) hi.textContent = fmtP(S.high24);
  const lo = $('td-low'); if (lo) lo.textContent = fmtP(S.low24);
  const vo = $('td-vol'); if (vo) vo.textContent = (S.vol24 >= 1e9 ? (S.vol24 / 1e9).toFixed(2) + 'B' : (S.vol24 / 1e6).toFixed(1) + 'M');
  const bal = $('td-bal'); if (bal) bal.textContent = fmtUsd(M.balance());
}

function renderBook() {
  const asks = $('td-asks'), bids = $('td-bids'); if (!asks || !bids) return;
  const A = S.book.asks.slice(0, 11), B = S.book.bids.slice(0, 11);
  let max = 0; A.concat(B).forEach((r) => { const q = +r[1]; if (q > max) max = q; }); max = max || 1;
  const fila = (r, lado) => { const p = +r[0], q = +r[1]; const w = Math.min(100, (q / max) * 100); return `<button class="td-row ${lado}" data-px="${p}"><span class="td-bar" style="width:${w}%"></span><span class="td-pxv">${fmtP(p)}</span><span class="td-sz">${q.toFixed(3)}</span></button>`; };
  asks.innerHTML = A.slice().reverse().map((r) => fila(r, 'ask')).join('');
  bids.innerHTML = B.map((r) => fila(r, 'bid')).join('');
  asks.querySelectorAll('.td-row').forEach((b) => b.onclick = () => clicLibro(+b.dataset.px));
  bids.querySelectorAll('.td-row').forEach((b) => b.onclick = () => clicLibro(+b.dataset.px));
}
function clicLibro(px) { if (!(px > 0)) return; if (S.modo !== 'market') { S.limitPx = px; $('td-limit').value = px; dibujarLimit(); renderEntry(); } }

function renderTrades() {
  const box = $('td-trades'); if (!box) return;
  box.innerHTML = S.trades.map((t) => { const d = new Date(t.time); const hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0'); return `<div class="td-trade ${t.buy ? 'buy' : 'sell'}"><span class="p">${fmtP(t.p)}</span><span class="m">${t.q.toFixed(3)}</span><span class="t">${hh}</span></div>`; }).join('');
}

function renderEntry() {
  const avail = $('td-avail'); if (avail) avail.textContent = 'Avail ' + fmtUsd(M.balance());
  const margen = S.lev > 0 ? S.tam / S.lev : 0;
  const mg = $('td-margin'); if (mg) mg.textContent = fmtUsd(margen);
  const px = S.modo === 'limit' && S.limitPx > 0 ? S.limitPx : S.mark;
  const liqL = px * (1 - (1 / S.lev - 0.004)), liqS = px * (1 + (1 / S.lev - 0.004));
  const lp = $('td-liqprev'); if (lp) lp.textContent = px > 0 ? (fmtP(liqL) + ' / ' + fmtP(liqS)) : '—';
}

function operar(lado) {
  const tam = S.tam, lev = S.lev;
  if (!(tam > 0)) { toast('Enter a size first.', 'warn'); return; }
  let r;
  if (S.modo === 'limit') {
    if (!(S.limitPx > 0)) { toast('Click the chart (or type a price) to mark the entry.', 'warn'); return; }
    r = M.colocarOrden(S.par.id, lado, tam, lev, S.limitPx, S.mark);
    if (r.ok) { toast(`Marked ${lado} at ${fmtP(S.limitPx)}. The price will decide when it is taken.`, 'ok'); S.limitPx = 0; $('td-limit').value = ''; dibujarLimit(); }
  } else {
    r = M.abrirMercado(S.par.id, lado, tam, lev, S.mark);
    if (r.ok) toast(`${lado === 'long' ? 'Long' : 'Short'} opened at ${fmtP(r.pos.entrada)}`, 'ok');
  }
  if (!r.ok) { toast(r.motivo === 'saldo' ? 'Not enough demo balance for that margin.' : 'Could not place the order.', 'bad'); return; }
  renderPos(); actualizarLineas();
}

/* ── Posiciones / órdenes marcadas ── */
function renderPos() {
  const pos = M.posiciones().filter((p) => true), ord = M.ordenes();
  $('td-npos').textContent = pos.length; $('td-nord').textContent = ord.length;
  const body = $('td-pos-body'); if (!body) return;
  if (S.tab === 'pos') {
    if (!pos.length) { body.innerHTML = '<div class="td-empty">No open positions. Open a Market trade or mark a Limit entry on the chart.</div>'; return; }
    body.innerHTML = `<table class="td-tbl"><thead><tr><th>Symbol</th><th>Size</th><th>Entry</th><th>Mark</th><th>Liq.</th><th>Margin</th><th>PnL (ROE)</th><th></th></tr></thead><tbody>${pos.map((p) => filaPos(p)).join('')}</tbody></table>`;
    body.querySelectorAll('[data-cerrar]').forEach((b) => b.onclick = () => { const r = M.cerrar(b.dataset.cerrar, S.mark); if (r) { toast(`Closed ${r.pos.lado} · PnL ${fmtUsd(r.pnl)}`, r.pnl >= 0 ? 'ok' : 'bad'); renderPos(); actualizarLineas(); } });
  } else {
    if (!ord.length) { body.innerHTML = '<div class="td-empty">No marked orders. In Limit mode, click the chart to mark where you want to enter.</div>'; return; }
    body.innerHTML = `<table class="td-tbl"><thead><tr><th>Symbol</th><th>Side</th><th>Size</th><th>Mark-in price</th><th>Current</th><th></th></tr></thead><tbody>${ord.map((o) => `<tr><td class="sym">${esc(o.par)}USDT <span class="td-lev-badge">${o.lev}x</span></td><td><span class="td-tag ${o.lado}">${o.lado.toUpperCase()}</span></td><td>${fmtUsd(o.tam)}</td><td>${fmtP(o.precio)}</td><td>${fmtP(S.mark)}</td><td><button class="td-x cancel" data-cancel="${o.id}">Cancel</button></td></tr>`).join('')}</tbody></table>`;
    body.querySelectorAll('[data-cancel]').forEach((b) => b.onclick = () => { if (M.cancelarOrden(b.dataset.cancel)) { renderPos(); actualizarLineas(); } });
  }
}
function filaPos(p) {
  const { pnl, roe, qty } = M.pnlDe(p, S.mark);
  const c = pnl >= 0 ? 'up' : 'down';
  return `<tr><td class="sym">${esc(p.par)}USDT <span class="td-tag ${p.lado}">${p.lado.toUpperCase()}</span> <span class="td-lev-badge">${p.lev}x</span></td>
    <td>${qty.toFixed(4)}</td><td>${fmtP(p.entrada)}</td><td data-mark="${p.id}">${fmtP(S.mark)}</td>
    <td class="td-liq">${fmtP(p.liq)}</td><td>${fmtUsd(p.margen)}</td>
    <td class="td-pnl ${c}" data-pnl="${p.id}">${fmtUsd(pnl)} (${fmtPct(roe)})</td>
    <td><button class="td-x" data-cerrar="${p.id}">Close</button></td></tr>`;
}
/* Refresco ligero del PnL/mark en la tabla sin reconstruirla (cada frame). */
function refrescarPnL() {
  if (S.tab !== 'pos') return;
  M.posiciones().forEach((p) => {
    const mk = document.querySelector(`[data-mark="${p.id}"]`); if (mk) mk.textContent = fmtP(S.mark);
    const pe = document.querySelector(`[data-pnl="${p.id}"]`); if (pe) { const { pnl, roe } = M.pnlDe(p, S.mark); pe.textContent = `${fmtUsd(pnl)} (${fmtPct(roe)})`; pe.className = 'td-pnl ' + (pnl >= 0 ? 'up' : 'down'); }
  });
}

/* ── Líneas de precio en la gráfica: entradas, liquidación, orden marcada ── */
function actualizarLineas() {
  if (!S.serieVela) return;
  S.lineas.forEach((l) => { try { S.serieVela.removePriceLine(l); } catch (_) {} }); S.lineas = [];
  const add = (price, color, style, title) => { try { S.lineas.push(S.serieVela.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title })); } catch (_) {} };
  M.posiciones().filter((p) => p.par === S.par.id).forEach((p) => {
    add(p.entrada, p.lado === 'long' ? '#2ee86a' : '#ff5b6e', 0, (p.lado === 'long' ? 'LONG ' : 'SHORT ') + p.lev + 'x');
    add(p.liq, '#ff5b6e', 2, 'LIQ');
  });
  M.ordenes().filter((o) => o.par === S.par.id).forEach((o) => add(o.precio, '#E8B84B', 1, (o.lado === 'long' ? 'LONG' : 'SHORT') + ' mark'));
  dibujarLimit();
}
function dibujarLimit() {
  if (!S.serieVela) return;
  if (S.lineaLimit) { try { S.serieVela.removePriceLine(S.lineaLimit); } catch (_) {} S.lineaLimit = null; }
  if (S.modo === 'limit' && S.limitPx > 0) { try { S.lineaLimit = S.serieVela.createPriceLine({ price: S.limitPx, color: '#C9A84B', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'entry' }); } catch (_) {} }
}

function renderTodo() { pintarPrecio(); renderBook(); renderTrades(); renderEntry(); renderPos(); }

/* ── Barra de dibujo COMPARTIDA (la misma de las demás secciones) ── */
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
  if (xA == null || xB == null || iB === iA) { paso = (ts.options().barSpacing) || 8; b = (xA != null) ? xA - paso * iA : 0; }
  else { paso = (xB - xA) / (iB - iA); b = xA - paso * iA; }
  if (!(paso > 0)) paso = 8;
  const pri = 0.5 - b / paso, ancho = x1 / paso, fin = pri + ancho;
  const pMax = S.serieVela.coordinateToPrice(0), pMin = S.serieVela.coordinateToPrice(y1);
  if (pMax == null || pMin == null) return null;
  const Y = (p) => { const c = S.serieVela.priceToCoordinate(p); return (c == null) ? (y1 * (pMax - p) / ((pMax - pMin) || 1)) : c; };
  return { W, H, x1, y1, pMin, pMax, Y, ancho, paso, fin };
}
let _syncPend = false;
function sincronizarDib() {
  if (!S.barra) return; if (_syncPend) return; _syncPend = true;
  requestAnimationFrame(() => { _syncPend = false; const g = geoDib(); if (g) { try { S.barra.redibujar(g, S.velasDib, S.par.id); } catch (_) {} } });
}
function montarBarraDemo() {
  const host = $('td-chart'); if (!host || S.dibMontada) { sincronizarDib(); return; }
  try {
    NIV.seccion = 'demo';
    S.barra = montarBarra(host);
    if (S.barra && S.barra._tools) S.barra._tools.classList.add('nv-oculta');
    S.dibMontada = true;
    if (window.ResizeObserver && !S.cvObs) { S.cvObs = new ResizeObserver(() => sincronizarDib()); S.cvObs.observe($('td-cv')); }
    sincronizarDib();
  } catch (_) { S.barra = null; }
}

/* ── Menú de monedas (catálogo compartido) ── */
function menuMonedas() {
  cerrarMenu();
  const anc = $('td-coin'); const r = anc.getBoundingClientRect();
  const m = document.createElement('div'); m.id = 'td-coinmenu';
  m.style.left = r.left + 'px'; m.style.top = (r.bottom + 6) + 'px';
  const lista = D.PARES.filter((p) => p.grupo !== 'divisa' && p.grupo !== 'materia');
  const pintar = (q) => {
    const f = !q ? lista : lista.filter((p) => (p.id + ' ' + (p.n || '')).toLowerCase().includes(q.toLowerCase()));
    m.querySelector('.td-lst').innerHTML = f.slice(0, 60).map((p) => `<button class="it ${p.id === S.par.id ? 'on' : ''}" data-id="${esc(p.id)}"><b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`).join('');
    m.querySelectorAll('.it').forEach((b) => b.onclick = async () => { const p = D.PARES.find((x) => x.id === b.dataset.id); if (p) { S.par = p; cerrarMenu(); await cargarDatos(); montarBarraDemo(); actualizarLineas(); } });
  };
  m.innerHTML = `<input type="text" placeholder="Search symbol" id="td-cm-q"><div class="td-lst"></div>`;
  document.body.appendChild(m); pintar('');
  const inp = m.querySelector('#td-cm-q'); inp.oninput = () => pintar(inp.value.trim()); setTimeout(() => inp.focus(), 0);
  setTimeout(() => document.addEventListener('mousedown', cierraMenuFuera), 0);
}
function cierraMenuFuera(e) { const m = $('td-coinmenu'); if (m && !m.contains(e.target) && e.target !== $('td-coin') && !$('td-coin').contains(e.target)) cerrarMenu(); }
function cerrarMenu() { const m = $('td-coinmenu'); if (m) m.remove(); document.removeEventListener('mousedown', cierraMenuFuera); }

function toast(msg, tipo) {
  const old = document.querySelector('.td-toast'); if (old) old.remove();
  const t = document.createElement('div'); t.className = 'td-toast ' + (tipo || ''); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 2600);
}

function cerrar() {
  try { if (S.uiRAF) cancelAnimationFrame(S.uiRAF); } catch (_) {} S.uiRAF = null;
  try { if (S.stream) S.stream.cerrar(); } catch (_) {} S.stream = null; _streamKey = '';
  try { if (S.cvObs) S.cvObs.disconnect(); } catch (_) {} S.cvObs = null;
  if (S.onResize) { window.removeEventListener('resize', S.onResize); S.onResize = null; }
  try { if (S.barra && S.barra.desmontar) S.barra.desmontar(); } catch (_) {} S.barra = null; S.dibMontada = false;
  try { if (S.chart) S.chart.remove(); } catch (_) {} S.chart = null; S.serieVela = null;
  cerrarMenu();
  const ov = $('td-overlay'); if (ov) ov.remove();
}
