/* modules/multichart/multichart.js — Servicio Multichart.

   Varias gráficas en vivo a la vez (2×2 por defecto: BTC, ETH, BNB, SOL),
   cada una independiente, redimensionable (como VWAP Pro), con selector de
   moneda con búsqueda, temporalidad, indicadores con la MISMA iluminación
   (glow) del área VWAP, pantalla completa, exportar imagen y cierre.

   Reutiliza, sin tocarlos, los recursos que ya tiene la plataforma: la capa de
   datos (Binance en vivo por WebSocket), el catálogo de monedas y SUS logos, la
   librería de velas (lightweight-charts) y la MISMA barra de dibujo de Smart
   Pools / Trading Demo (barra.js). Nada de widgets externos. */

import { estilos } from './estilos.js?v=4';
import * as D from '../trading-demo/datos.js?v=2';
import { montarBarra } from '../../assets/js/niveles/barra.js?v=7';
import { dibujarHerramientas } from '../../assets/js/niveles/dibujo.js?v=3';
import { N as NIV } from '../../assets/js/niveles/estado.js?v=1';

const LIB = new URL('../trading-demo/vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const ICONO = (s) => 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/' + String(s).toLowerCase() + '.png';

const $ = (id) => document.getElementById(id);
const DEF = ['BTC', 'ETH', 'BNB', 'SOL'];
const S = {
  paneles: [], seq: 0, raf: null, logos: {}, menu: null,
  focus: null, sync: false, tool: null, vlines: [], preview: null, syncing: false, _lastHerr: null
};
let LC = null;

/* ── Indicadores ── */
const cls = (v) => v.map((c) => c.close);
function sma(a, n) { const o = Array(a.length).fill(null); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; } return o; }
function ema(a, n) { const o = Array(a.length).fill(null); const k = 2 / (n + 1); let p = null; for (let i = 0; i < a.length; i++) { p = p == null ? a[i] : a[i] * k + p * (1 - k); if (i >= n - 1) o[i] = p; } return o; }
function rsi(c, n = 14) { const o = Array(c.length).fill(null); let g = 0, l = 0; for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1], up = Math.max(0, d), dn = Math.max(0, -d); if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; o[i] = 100 - 100 / (1 + (l === 0 ? 100 : g / l)); } } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o[i] = 100 - 100 / (1 + (l === 0 ? 100 : g / l)); } } return o; }
function macd(c) { const e12 = ema(c, 12), e26 = ema(c, 26); const line = c.map((_, i) => (e12[i] != null && e26[i] != null) ? e12[i] - e26[i] : null); const base = line.map((v) => v == null ? 0 : v); const sig = ema(base, 9).map((v, i) => line[i] == null ? null : v); const hist = line.map((v, i) => (v != null && sig[i] != null) ? v - sig[i] : null); return { line, sig, hist }; }
function stoch(v, n = 14, d = 3) { const k = Array(v.length).fill(null); for (let i = 0; i < v.length; i++) { if (i < n - 1) continue; let hi = -1e18, lo = 1e18; for (let j = i - n + 1; j <= i; j++) { hi = Math.max(hi, v[j].high); lo = Math.min(lo, v[j].low); } k[i] = hi === lo ? 50 : (v[i].close - lo) / (hi - lo) * 100; } const dd = sma(k.map((x) => x == null ? 0 : x), d).map((x, i) => k[i] == null ? null : x); return { k, d: dd }; }
function cci(v, n = 20) { const o = Array(v.length).fill(null); const tp = v.map((x) => (x.high + x.low + x.close) / 3); const ma = sma(tp, n); for (let i = 0; i < v.length; i++) { if (ma[i] == null) continue; let md = 0; for (let j = i - n + 1; j <= i; j++) md += Math.abs(tp[j] - ma[i]); md /= n; o[i] = md === 0 ? 0 : (tp[i] - ma[i]) / (0.015 * md); } return o; }
function vwap(v) { const o = Array(v.length).fill(null); let pv = 0, vv = 0; for (let i = 0; i < v.length; i++) { const tp = (v[i].high + v[i].low + v[i].close) / 3, vol = v[i].volume || 1; pv += tp * vol; vv += vol; o[i] = pv / vv; } return o; }
function boll(c, n = 20, k = 2) { const ma = sma(c, n), up = Array(c.length).fill(null), lo = Array(c.length).fill(null); for (let i = 0; i < c.length; i++) { if (ma[i] == null) continue; let s = 0; for (let j = i - n + 1; j <= i; j++) s += (c[j] - ma[i]) ** 2; const sd = Math.sqrt(s / n); up[i] = ma[i] + k * sd; lo[i] = ma[i] - k * sd; } return { ma, up, lo }; }

const OVL = [
  { k: 'ema9', n: 'EMA 9', col: '#49b6ff', f: (v) => ema(cls(v), 9) },
  { k: 'ema21', n: 'EMA 21', col: '#E8B84B', f: (v) => ema(cls(v), 21) },
  { k: 'ema50', n: 'EMA 50', col: '#b07cff', f: (v) => ema(cls(v), 50) },
  { k: 'sma200', n: 'SMA 200', col: '#ff8fbf', f: (v) => sma(cls(v), 200) },
  { k: 'vwap', n: 'VWAP', col: '#2ee8c6', f: (v) => vwap(v) }
];
const OSC = [
  { k: 'rsi', n: 'RSI 14', col: '#E8B84B', rango: [0, 100], ref: [30, 70] },
  { k: 'macd', n: 'MACD', col: '#49b6ff', ref: [0] },
  { k: 'stoch', n: 'Stochastic', col: '#2ee8c6', rango: [0, 100], ref: [20, 80] },
  { k: 'cci', n: 'CCI 20', col: '#b07cff', ref: [-100, 100] }
];

const IC = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.4"/></svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a8 8 0 0 1 13-2.5L20 7"/><path d="M20 17a8 8 0 0 1-13 2.5L4 17"/><path d="M20 3v4h-4M4 21v-4h4"/></svg>',
  vline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 3v18"/><circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>',
  hline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M3 12h18"/><circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16"/><path d="M20 20v-4h-4"/></svg>',
  goright: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5l7 7-7 7"/><path d="M16 5v14"/></svg>'
};

function lib() { return window.LightweightCharts ? Promise.resolve(window.LightweightCharts) : new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.onload = () => res(window.LightweightCharts); s.onerror = rej; document.head.appendChild(s); }); }

export async function abrirMulti() {
  if ($('mc-overlay')) return;
  estilos();
  const ov = document.createElement('div'); ov.id = 'mc-overlay';
  ov.innerHTML = `
    <div class="mc-top">
      <button class="mc-back" id="mc-back">${IC.back} Back</button>
      <span class="mc-title">Multi<b>chart</b></span>
      <span class="mc-demo">LIVE · Binance</span>
      <div class="mc-top-r">
        <button class="mc-tool" id="mc-sync" title="Sync all charts: crosshair, zoom and scroll move together">${IC.sync}<span>Sync</span></button>
        <button class="mc-tool" id="mc-vline" title="Vertical line: mark the same time on every chart">${IC.vline}<span>V-line</span></button>
        <button class="mc-tool" id="mc-hline" title="Horizontal line: mark a price level">${IC.hline}<span>H-line</span></button>
        <span class="mc-sep"></span>
        <button class="mc-icobtn" id="mc-reset" title="Reset layout (re-tidy all charts)">${IC.refresh}</button>
        <button class="mc-icobtn" id="mc-save" title="Save image of all charts">${IC.cam}</button>
        <button class="mc-add" id="mc-addbtn">${IC.plus}<span>Add chart</span></button>
      </div>
    </div>
    <div class="mc-grid" id="mc-grid"></div>`;
  document.body.appendChild(ov);
  $('mc-back').onclick = cerrarMulti;
  $('mc-addbtn').onclick = () => addFloat();
  $('mc-reset').onclick = reorganizar;
  $('mc-save').onclick = guardarImagenTodas;
  $('mc-sync').onclick = () => toggleSync();
  $('mc-vline').onclick = () => toggleTool('vline');
  $('mc-hline').onclick = () => toggleTool('hline');
  document.addEventListener('mousedown', fueraMenu, true);
  try { LC = await lib(); } catch (_) { toast('Could not load the chart library.'); return; }
  await Promise.all(DEF.map((id) => crearPanel(id, '1m')));   // los 4 en paralelo (antes iban uno tras otro y tardaba)
  ajustarGrid();
  if (S.paneles[0]) enfocar(S.paneles[0]);
  D.logos().then((l) => { S.logos = l || {}; S.paneles.forEach(pintarLogoHead); });
  arrancarRAF();
  window.addEventListener('resize', onResize);
}

function cerrarMulti() {
  if (S.raf) cancelAnimationFrame(S.raf);
  document.removeEventListener('mousedown', fueraMenu, true);
  window.removeEventListener('resize', onResize);
  S.paneles.forEach((p) => { try { p.stream && p.stream.cerrar(); } catch (_) {} try { p.barra && p.barra.desmontar && p.barra.desmontar(); } catch (_) {} try { p.chart.remove(); } catch (_) {} });
  S.paneles = []; S.focus = null;
  cerrarMenu();
  const m = $('mc-modal'); if (m) m.remove();
  const ov = $('mc-overlay'); if (ov) ov.remove();
  if (window.__ANALISIS_PAGINA__ && !document.getElementById('an-root')) { try { history.back(); } catch (_) {} }
}
function onResize() { S.paneles.forEach((p) => { try { p.chart.applyOptions({}); } catch (_) {} }); if (S.focus) sincronizarFocus(); }

/* ── Panel ── */
async function crearPanel(parId, tf, flotante, pos) {
  const par = D.PARES.find((p) => p.id === parId) || D.PARES[0];
  const id = 'mcp' + (++S.seq);
  const pane = {
    id, par, tf, chart: null, serie: null, velas: [], velasMs: [], stream: null,
    flotante: !!flotante, max: false, ovl: new Set(), bollOn: false, oscK: null, ind: {},
    hlines: [], dibCache: [], barra: null
  };
  const el = document.createElement('div'); el.className = flotante ? 'mc-float' : 'mc-pane'; el.id = id;
  el.innerHTML = `
    <div class="mc-head">
      <button class="mc-fsback" data-fsback title="Back to all charts">${IC.back} Back</button>
      <button class="mc-coin" data-coin><span class="ic"></span><b class="nm">${par.id}</b><span class="q">/USDT</span><span class="cv">▾</span></button>
      <button class="mc-tf" data-tf>${tf}</button>
      <span class="mc-px" data-px>—</span>
      <span class="mc-hsp"></span>
      <button class="mc-indbtn" data-ind title="Indicators">Indicator ${IC.chev}</button>
      <button class="mc-hb" data-share title="Share image">${IC.cam}</button>
      <button class="mc-hb" data-full title="Fullscreen">${IC.full}</button>
      <button class="mc-hb mc-close" data-close title="Close">${IC.x}</button>
    </div>
    <div class="mc-body">
      <div class="mc-cv"></div>
      <canvas class="mc-fx"></canvas>
      <canvas class="mc-ux"></canvas>
      <div class="mc-wm"><img src="${LOGO}" alt=""></div>
      <div class="mc-cap"></div>
      <button class="mc-goright" data-goright title="Go to current price">${IC.goright}</button>
      <div class="mc-grip"></div>
      <div class="mc-hint">Click to draw</div>
      <div class="mc-spin"><i></i></div>
    </div>`;
  if (flotante) { el.style.left = ((pos && pos.x) || 130 + S.paneles.length * 22) + 'px'; el.style.top = ((pos && pos.y) || 86 + S.paneles.length * 20) + 'px'; $('mc-overlay').appendChild(el); }
  else $('mc-grid').appendChild(el);
  pane.el = el;
  pane.body = el.querySelector('.mc-body');
  pane.fx = el.querySelector('.mc-fx');
  pane.ux = el.querySelector('.mc-ux');
  const mount = el.querySelector('.mc-cv');
  const chart = LC.createChart(mount, {
    autoSize: true, localization: { locale: 'en' },
    layout: { background: { type: 'solid', color: '#05070a' }, textColor: '#8b95a1', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, attributionLogo: false },
    grid: { vertLines: { color: 'rgba(255,255,255,.028)' }, horzLines: { color: 'rgba(255,255,255,.028)' } },
    rightPriceScale: { borderColor: '#222b35', scaleMargins: { top: 0.06, bottom: 0.28 } },
    timeScale: { borderColor: '#222b35', timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 6, minBarSpacing: 0.4 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  const serie = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e' });
  pane.chart = chart; pane.serie = serie;
  S.paneles.push(pane);
  pintarLogoHead(pane);
  wirePane(pane);
  // barra de dibujo (la MISMA de Smart Pools / Demo), una por panel
  try { pane.barra = montarBarra(pane.body); } catch (_) { pane.barra = null; }
  // sincroniza la cruceta / zoom / scroll entre gráficas cuando Sync está activo
  try {
    chart.timeScale().subscribeVisibleLogicalRangeChange((r) => {
      if (S.sync && !S.syncing && r) { S.syncing = true; S.paneles.forEach((o) => { if (o !== pane) { try { o.chart.timeScale().setVisibleLogicalRange({ from: r.from, to: r.to }); } catch (_) {} } }); S.syncing = false; }
      if (pane === S.focus) sincronizarFocus();
    });
    chart.subscribeCrosshairMove((param) => {
      if (!S.sync) return;
      if (!param.point || param.time == null) { S.paneles.forEach((o) => { if (o !== pane) try { o.chart.clearCrosshairPosition(); } catch (_) {} }); return; }
      S.paneles.forEach((o) => { if (o === pane) return; const v = valorEn(o, param.time); if (v != null) { try { o.chart.setCrosshairPosition(v, param.time, o.serie); } catch (_) {} } });
    });
  } catch (_) {}
  await cargarPanel(pane);
  return pane;
}

async function cargarPanel(pane) {
  const sp = pane.el.querySelector('.mc-spin'); if (sp) sp.style.display = 'grid';
  try {
    const [v, t] = await Promise.all([D.velas(pane.par.s, pane.tf, 1000), D.ticker(pane.par.s).catch(() => null)]);
    pane.velas = v;
    pane.velasMs = v.map((c) => ({ t: c.time * 1000, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume }));
    pane.serie.setData(v.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    recalc(pane);
    if (t) pintarPx(pane, t.last, t.chgPct); else if (v.length) pintarPx(pane, v[v.length - 1].close);
    vistaDefecto(pane);
    if (pane === S.focus) sincronizarFocus();
  } catch (_) { toast('Could not load ' + pane.par.id + '.'); }
  if (sp) sp.style.display = 'none';
  iniciarStream(pane);
}
function iniciarStream(pane) {
  try { pane.stream && pane.stream.cerrar(); } catch (_) {}
  try { pane.stream = D.streamVelas(pane.par.s, pane.tf, (k) => onKline(pane, k)); } catch (_) { pane.stream = null; }
}
function onKline(pane, k) {
  if (!pane.serie) return;
  const c = { time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v };
  if (!(c.close > 0)) return;
  const last = pane.velas[pane.velas.length - 1];
  const cm = { t: c.time * 1000, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume };
  if (last && c.time === last.time) { pane.velas[pane.velas.length - 1] = c; pane.velasMs[pane.velasMs.length - 1] = cm; }
  else if (!last || c.time > last.time) { pane.velas.push(c); pane.velasMs.push(cm); if (pane.velas.length > 1200) { pane.velas.shift(); pane.velasMs.shift(); } }
  else return;
  try { pane.serie.update({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }); } catch (_) {}
  recalc(pane);
  pintarPx(pane, c.close);
  if (pane === S.focus) sincronizarFocus();
}
function pintarPx(pane, px, chg) {
  const e = pane.el.querySelector('[data-px]'); if (!e) return;
  const d = decimales(px);
  e.innerHTML = Number(px).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + (chg != null ? ` <small class="${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</small>` : '');
}
function pintarLogoHead(pane) {
  const ic = pane.el.querySelector('.mc-coin .ic'); if (!ic) return;
  const url = (S.logos && pane.par.cg && S.logos[pane.par.cg]) || ICONO(pane.par.id);
  const im = new Image(); im.onload = () => { ic.style.backgroundImage = `url(${url})`; ic.textContent = ''; }; im.onerror = () => { ic.textContent = pane.par.id[0]; }; im.src = url;
}

/* ── Indicadores: cálculo cacheado + trazo limpio con animación cometa ── */
function recalc(pane) {
  const v = pane.velas; if (!v.length) { pane.ind = {}; return; }
  const ind = { ovl: [], boll: null, osc: null };
  OVL.forEach((o) => { if (pane.ovl.has(o.k)) ind.ovl.push({ col: o.col, data: o.f(v) }); });
  if (pane.bollOn) ind.boll = boll(cls(v), 20, 2);
  if (pane.oscK) {
    const def = OSC.find((o) => o.k === pane.oscK);
    if (pane.oscK === 'rsi') ind.osc = { def, serie: rsi(cls(v)) };
    else if (pane.oscK === 'stoch') { const s = stoch(v); ind.osc = { def, serie: s.k, serie2: s.d, col2: '#ff8fbf' }; }
    else if (pane.oscK === 'cci') ind.osc = { def, serie: cci(v) };
    else if (pane.oscK === 'macd') { const m = macd(cls(v)); ind.osc = { def, serie: m.line, serie2: m.sig, col2: '#ff8fbf', hist: m.hist }; }
  }
  pane.ind = ind;
}
function arrancarRAF() {
  let last = 0;
  const tick = (ts) => {
    S.raf = requestAnimationFrame(tick);
    if (ts - last < 33) return;            // ~30fps: suave y barato (como el VWAP Pro)
    last = ts;
    if (NIV.herr !== S._lastHerr) { S._lastHerr = NIV.herr; sincronizarStrips(); }
    S.paneles.forEach((p) => { dibujarInds(p); dibujarUX(p); });
  };
  S.raf = requestAnimationFrame(tick);
}

function dibujarInds(pane) {
  const fx = pane.fx, body = pane.body; if (!fx || !body || !pane.serie) return;
  const W = body.clientWidth, H = body.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (fx.width !== Math.round(W * dpr)) { fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); fx.style.width = W + 'px'; fx.style.height = H + 'px'; }
  const g = fx.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const ind = pane.ind; if (!ind) return;
  const ts = pane.chart.timeScale();
  const X = (t) => { try { const c = ts.timeToCoordinate(t); return c == null ? null : c; } catch (_) { return null; } };
  const Yp = (p) => { try { const c = pane.serie.priceToCoordinate(p); return c == null ? null : c; } catch (_) { return null; } };
  const now = performance.now();
  const v = pane.velas;
  (ind.ovl || []).forEach((o, i) => lineaComet(g, v, o.data, X, Yp, o.col, W, now, i));
  if (ind.boll) { lineaComet(g, v, ind.boll.up, X, Yp, '#7aa2ff', W, now, 5); lineaComet(g, v, ind.boll.lo, X, Yp, '#7aa2ff', W, now, 5); lineaComet(g, v, ind.boll.ma, X, Yp, 'rgba(120,160,255,.55)', W, now, 6); }
  if (ind.osc) oscilador(g, v, ind.osc, X, W, H, now);
}
/* Indicador: trazo LIMPIO + una luz (cometa) que lo recorre de izquierda a
   derecha, suave y lenta, igual que el área VWAP Pro. Sin neón constante. */
function lineaComet(g, velas, data, X, Yp, col, W, now, idx) {
  if (!data) return;
  const pts = [];
  for (let i = 0; i < velas.length; i++) { const val = data[i]; if (val == null) continue; const x = X(velas[i].time); if (x == null) continue; const y = Yp(val); if (y == null) continue; pts.push([x, y, i]); }
  if (pts.length < 2) return;
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.shadowBlur = 0; g.globalAlpha = 1;
  g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath();
  let prev = null;
  for (let k = 0; k < pts.length; k++) { const p = pts[k]; if (prev && p[2] === prev[2] + 1) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); prev = p; }
  g.stroke();
  const period = 4600, headX = (((now + idx * 760) % period) / period) * (W + 260) - 130, tail = 130;
  prev = null;
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k];
    if (prev && p[2] === prev[2] + 1) {
      const mx = (prev[0] + p[0]) / 2, d = Math.abs(mx - headX);
      if (d <= tail) {
        const a = 1 - d / tail;
        g.shadowColor = col; g.shadowBlur = 6; g.strokeStyle = col; g.lineWidth = 2; g.globalAlpha = 0.5 * a;
        g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke();
        g.shadowBlur = 0; g.strokeStyle = '#ffffff'; g.lineWidth = 1.1; g.globalAlpha = 0.42 * a * a;
        g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke();
      }
    }
    prev = p;
  }
  g.globalAlpha = 1; g.restore();
}
function oscilador(g, velas, osc, X, W, H, now) {
  const band = Math.min(150, H * 0.22), top = H - band - 24, bot = H - 24;
  const def = osc.def;
  let lo, hi;
  if (def.rango) { lo = def.rango[0]; hi = def.rango[1]; }
  else { lo = 1e18; hi = -1e18; const all = [osc.serie, osc.serie2, osc.hist].filter(Boolean); all.forEach((ser) => ser.forEach((x) => { if (x != null) { lo = Math.min(lo, x); hi = Math.max(hi, x); } })); if (!(hi > lo)) { hi = 1; lo = -1; } const pad = (hi - lo) * 0.12; lo -= pad; hi += pad; }
  const Y = (val) => bot - (val - lo) / (hi - lo) * (bot - top);
  g.save();
  g.fillStyle = 'rgba(8,11,16,.55)'; g.fillRect(0, top - 4, W, band + 8);
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, top - 4); g.lineTo(W, top - 4); g.stroke();
  (def.ref || []).forEach((r) => { if (r < lo || r > hi) return; const y = Y(r); g.setLineDash([3, 4]); g.strokeStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.setLineDash([]); });
  if (osc.hist) { for (let i = 0; i < velas.length; i++) { const hv = osc.hist[i]; if (hv == null) continue; const x = X(velas[i].time); if (x == null) continue; const y0 = Y(0), y1 = Y(hv); g.fillStyle = hv >= 0 ? 'rgba(46,232,106,.5)' : 'rgba(255,91,110,.5)'; g.fillRect(x - 1.5, Math.min(y0, y1), 3, Math.abs(y1 - y0)); } }
  const dibSer = (ser, col, cometa) => {
    if (!ser) return;
    const pts = [];
    for (let i = 0; i < velas.length; i++) { const val = ser[i]; if (val == null) continue; const x = X(velas[i].time); if (x == null) continue; pts.push([x, Y(val), i]); }
    if (pts.length < 2) return;
    g.shadowBlur = 0; g.globalAlpha = 1; g.strokeStyle = col; g.lineWidth = 1.5; g.lineJoin = 'round'; g.beginPath();
    let prev = null; for (let k = 0; k < pts.length; k++) { const p = pts[k]; if (prev && p[2] === prev[2] + 1) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); prev = p; }
    g.stroke();
    if (cometa) {
      const period = 4600, headX = ((now % period) / period) * (W + 260) - 130, tail = 130;
      prev = null;
      for (let k = 0; k < pts.length; k++) { const p = pts[k]; if (prev && p[2] === prev[2] + 1) { const mx = (prev[0] + p[0]) / 2, d = Math.abs(mx - headX); if (d <= tail) { const a = 1 - d / tail; g.shadowColor = col; g.shadowBlur = 6; g.strokeStyle = col; g.lineWidth = 2; g.globalAlpha = 0.5 * a; g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke(); } } prev = p; }
      g.globalAlpha = 1; g.shadowBlur = 0;
    }
  };
  dibSer(osc.serie2, osc.col2 || '#ff8fbf', false);
  dibSer(osc.serie, def.col, true);
  g.shadowBlur = 0; g.globalAlpha = 1; g.fillStyle = '#7b8694'; g.font = '700 10px "IBM Plex Mono", monospace'; g.textAlign = 'left'; g.fillText(def.n, 8, top + 11);
  g.restore();
}

/* ── Capa UX: trazos (solo lectura en no enfocados) + líneas cruzadas ── */
function dibujarUX(pane) {
  const ux = pane.ux, body = pane.body; if (!ux || !body) return;
  const W = body.clientWidth, H = body.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (ux.width !== Math.round(W * dpr)) { ux.width = Math.round(W * dpr); ux.height = Math.round(H * dpr); ux.style.width = W + 'px'; ux.style.height = H + 'px'; }
  const g = ux.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (pane !== S.focus) dibujosRO(pane, g);
  const ts = pane.chart.timeScale(), now = performance.now();
  S.vlines.forEach((vl) => { const x = safeX(pane, vl.time); if (x == null) return; const a = vl.t0 ? Math.min(1, (now - vl.t0) / 360) : 1; lineaVert(g, x, W, H, a, false, fmtFecha(vl.time)); });
  (pane.hlines || []).forEach((hl) => { const y = safeY(pane, hl.price); if (y == null) return; const a = hl.t0 ? Math.min(1, (now - hl.t0) / 360) : 1; lineaHorz(g, y, W, a, hl.price, false); });
  if (S.tool === 'vline' && S.preview && S.preview.time != null) { const x = safeX(pane, S.preview.time); if (x != null) lineaVert(g, x, W, H, 0.65, true, fmtFecha(S.preview.time)); }
  if (S.tool === 'hline' && S.preview && S.preview.pane === pane && S.preview.price != null) { const y = safeY(pane, S.preview.price); if (y != null) lineaHorz(g, y, W, 0.55, S.preview.price, true); }
}
function dibujosRO(pane, g) {
  const lista = pane.dibCache; if (!lista || !lista.length) return;
  const geo = geoDibPane(pane); if (!geo) return;
  const s = { geo: NIV._geo, velas: NIV.velas, dib: NIV.dibujos, sel: NIV.sel, cur: NIV.dib, goma: NIV.gomaBox };
  NIV._geo = geo; NIV.velas = pane.velasMs; NIV.dibujos = lista; NIV.sel = -1; NIV.dib = null; NIV.gomaBox = null;
  try { dibujarHerramientas(g, geo.x1, geo.y1); } catch (_) {}
  NIV._geo = s.geo; NIV.velas = s.velas; NIV.dibujos = s.dib; NIV.sel = s.sel; NIV.dib = s.cur; NIV.gomaBox = s.goma;
}
function lineaVert(g, x, W, H, a, preview, label) {
  g.save(); g.globalAlpha = a; g.strokeStyle = '#E8B84B'; g.lineWidth = preview ? 1 : 1.6; g.shadowColor = 'rgba(232,184,75,.9)'; g.shadowBlur = preview ? 4 : 8;
  if (preview) g.setLineDash([5, 5]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  g.setLineDash([]); g.shadowBlur = 0;
  if (label) {   // etiqueta con la FECHA/hora exacta de la línea, para poder situarla (p. ej. "28 Nov 15:00")
    g.font = '700 10px "IBM Plex Mono", monospace';
    const tw = g.measureText(label).width + 12; let lx = x - tw / 2; lx = Math.max(2, Math.min(lx, W - tw - 2)); const ly = H - 32;
    g.globalAlpha = Math.min(1, a + 0.2); redondea(g, lx, ly, tw, 17, 5); g.fillStyle = 'rgba(20,16,4,.96)'; g.fill(); g.strokeStyle = '#8f6a1a'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#E8B84B'; g.textAlign = 'left'; g.fillText(label, lx + 6, ly + 12);
  }
  g.restore();
}
function lineaHorz(g, y, W, a, price, preview) {
  g.save(); g.globalAlpha = a; g.strokeStyle = '#2ee8c6'; g.lineWidth = preview ? 1 : 1.6; g.shadowColor = 'rgba(46,232,198,.85)'; g.shadowBlur = preview ? 4 : 9;
  if (preview) g.setLineDash([5, 5]); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  if (price != null) { const t = fmtNum(price); g.setLineDash([]); g.shadowBlur = 0; g.font = '700 10px "IBM Plex Mono", monospace'; const tw = g.measureText(t).width + 10; g.fillStyle = 'rgba(13,30,27,.95)'; g.fillRect(W - tw - 4, y - 8, tw, 16); g.fillStyle = '#2ee8c6'; g.textAlign = 'left'; g.fillText(t, W - tw + 1, y + 3); }
  g.restore();
}
function safeX(pane, timeSec) { try { const c = pane.chart.timeScale().timeToCoordinate(timeSec); return c == null ? null : c; } catch (_) { return null; } }
function safeY(pane, price) { try { const c = pane.serie.priceToCoordinate(price); return c == null ? null : c; } catch (_) { return null; } }
function valorEn(pane, t) {
  const v = pane.velas; if (!v.length) return null;
  if (t <= v[0].time) return v[0].close; if (t >= v[v.length - 1].time) return v[v.length - 1].close;
  let lo = 0, hi = v.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (v[m].time === t) return v[m].close; if (v[m].time < t) lo = m + 1; else hi = m - 1; }
  const a = v[Math.max(0, hi)], b = v[Math.min(v.length - 1, lo)]; return (Math.abs(a.time - t) <= Math.abs(b.time - t) ? a : b).close;
}

/* ── Geometría para la barra de dibujo (igual que el Trading Demo) ── */
function geoDibPane(pane) {
  const chart = pane.chart, serie = pane.serie, body = pane.body;
  if (!chart || !serie || !body || !pane.velas.length) return null;
  let ts; try { ts = chart.timeScale(); } catch (_) { return null; }
  const W = body.clientWidth, H = body.clientHeight;
  let x1; try { x1 = ts.width(); } catch (_) { x1 = W; } if (!(x1 > 0)) x1 = W;
  let y1 = H; try { const pn = chart.panes(); y1 = (pn && pn[0]) ? pn[0].getHeight() : H; } catch (_) { y1 = H; } if (!(y1 > 0)) y1 = H;
  let vr; try { vr = ts.getVisibleLogicalRange(); } catch (_) { vr = null; } if (!vr) return null;
  const nV = pane.velas.length;
  const iA = Math.max(0, Math.min(nV - 1, Math.ceil(vr.from))), iB = Math.max(0, Math.min(nV - 1, iA + 1));
  let paso, b; const xA = ts.logicalToCoordinate(iA), xB = ts.logicalToCoordinate(iB);
  if (xA == null || xB == null || iB === iA) { paso = (ts.options().barSpacing) || 6; b = (xA != null) ? xA - paso * iA : 0; }
  else { paso = (xB - xA) / (iB - iA); b = xA - paso * iA; }
  if (!(paso > 0)) paso = 6;
  const pri = 0.5 - b / paso, ancho = x1 / paso, fin = pri + ancho;
  const pMax = serie.coordinateToPrice(0), pMin = serie.coordinateToPrice(y1);
  if (pMax == null || pMin == null) return null;
  const Y = (p) => { const c = serie.priceToCoordinate(p); return (c == null) ? (y1 * (pMax - p) / ((pMax - pMin) || 1)) : c; };
  return { W, H, x1, y1, pMin, pMax, Y, ancho, paso, fin };
}
let _focusPend = false;
function sincronizarFocus() {
  if (!S.focus || !S.focus.barra) return;
  if (_focusPend) return; _focusPend = true;
  requestAnimationFrame(() => { _focusPend = false; const p = S.focus; if (!p || !p.barra) return; const g = geoDibPane(p); if (g) { try { p.barra.redibujar(g, p.velas.map((v) => ({ t: v.time, o: v.open, h: v.high, l: v.low, c: v.close, v: v.volume })), p.par.id); } catch (_) {} } });
}
function sincronizarStrips() {
  S.paneles.forEach((p) => { const st = p.body.querySelector('.nv-tools'); if (st) st.querySelectorAll('.nv-tool[data-h]').forEach((o) => o.classList.toggle('on', o.dataset.h === NIV.herr)); });
}

/* ── Enfoque: la barra de dibujo VIVA actúa sobre el panel enfocado ── */
function enfocar(pane) {
  if (S.focus === pane) return;
  const prev = S.focus;
  S.focus = pane;
  S.paneles.forEach((p) => p.el.classList.toggle('mc-focus', p === pane));
  if (prev) { const cvh = prev.body.querySelector('.nv-cvh'); if (cvh) { const g = cvh.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cvh.width, cvh.height); } prev.dibCache = cargarDibDe(prev.par.id); }
  NIV.seccion = 'multi'; NIV.par = pane.par.id;
  sincronizarFocus();
}
function cargarDibDe(coin) { try { const m = JSON.parse(localStorage.getItem('cco-dibujos') || '{}'); const a = m['multi|' + coin]; return Array.isArray(a) ? a : []; } catch (_) { return []; } }

/* ── Controles del panel ── */
function wirePane(pane) {
  const q = (s) => pane.el.querySelector(s);
  q('[data-coin]').onclick = (e) => { e.stopPropagation(); menuMonedas(pane, q('[data-coin]')); };
  q('[data-tf]').onclick = (e) => { e.stopPropagation(); menuTf(pane, q('[data-tf]')); };
  q('[data-ind]').onclick = (e) => { e.stopPropagation(); menuInd(pane, q('[data-ind]')); };
  q('[data-share]').onclick = () => guardarImagenPanel(pane);
  q('[data-full]').onclick = () => fullPane(pane);
  q('[data-fsback]').onclick = () => { if (pane.max) fullPane(pane); };   // Back solo sale en fullscreen: vuelve a la rejilla
  q('[data-goright]').onclick = () => irAlPresente(pane);
  q('[data-close]').onclick = () => cerrarPane(pane);
  // enfocar al interactuar con el cuerpo (si no hay herramienta cruzada armada)
  pane.body.addEventListener('mousedown', () => { if (!S.tool) enfocar(pane); }, true);
  // capa de captura para las líneas cruzadas
  const cap = pane.body.querySelector('.mc-cap');
  cap.addEventListener('mousemove', (e) => {
    const r = cap.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (S.tool === 'vline') S.preview = { time: timeAt(pane, x) };
    else if (S.tool === 'hline') S.preview = { pane, price: priceAt(pane, y) };
  });
  cap.addEventListener('mouseleave', () => { S.preview = null; });
  cap.addEventListener('click', (e) => {
    const r = cap.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (S.tool === 'vline') colocarVLine(pane, x);
    else if (S.tool === 'hline') colocarHLine(pane, y);
  });
  if (pane.flotante) arrastrar(pane);
}
function timeAt(pane, x) { try { const lg = pane.chart.timeScale().coordinateToLogical(x); if (lg == null) return null; const i = Math.max(0, Math.min(pane.velas.length - 1, Math.round(lg))); const v = pane.velas[i]; return v ? v.time : null; } catch (_) { return null; } }
function priceAt(pane, y) { try { const p = pane.serie.coordinateToPrice(y); return p == null ? null : p; } catch (_) { return null; } }
function colocarVLine(pane, x) {
  const t = timeAt(pane, x); if (t == null) return;
  // ¿cerca de una existente? → quitarla
  for (let i = 0; i < S.vlines.length; i++) { const xx = safeX(pane, S.vlines[i].time); if (xx != null && Math.abs(xx - x) < 7) { S.vlines.splice(i, 1); return; } }
  S.vlines.push({ time: t, t0: performance.now() });
}
function colocarHLine(pane, y) {
  const p = priceAt(pane, y); if (p == null) return;
  pane.hlines = pane.hlines || [];
  for (let i = 0; i < pane.hlines.length; i++) { const yy = safeY(pane, pane.hlines[i].price); if (yy != null && Math.abs(yy - y) < 7) { pane.hlines.splice(i, 1); return; } }
  pane.hlines.push({ price: p, t0: performance.now() });
}
function fullPane(pane) {
  pane.max = !pane.max;
  const ov = $('mc-overlay');
  if (pane.max) {
    pane._inline = pane.el.getAttribute('style') || '';   // guarda left/top/width/height (del flotante o de un resize)
    pane.el.removeAttribute('style');                      // si no, los estilos inline impiden que .mc-max ocupe toda la pantalla
    pane.el.classList.add('mc-max');
    if (ov) ov.classList.add('mc-hasmax');
  } else {
    pane.el.classList.remove('mc-max');
    if (ov) ov.classList.remove('mc-hasmax');
    if (pane._inline) pane.el.setAttribute('style', pane._inline); else pane.el.removeAttribute('style');
  }
  pane.el.querySelector('[data-full]').innerHTML = pane.max ? IC.shrink : IC.full;
  pane.el.querySelector('[data-full]').classList.toggle('on', pane.max);
  // reajusta la gráfica al nuevo tamaño con una vista cercana (si no, solo se veía un pedacito)
  setTimeout(() => { vistaDefecto(pane); if (pane === S.focus) sincronizarFocus(); }, 90);
}
/* Vista por defecto: muestra las ~130 velas más recientes (velas de buen tamaño,
   no las 1000 diminutas), dejando TODO el historial disponible al arrastrar. */
function vistaDefecto(pane) { try { const n = pane.velas.length; if (n > 3) pane.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 130), to: n + 3 }); } catch (_) {} }
function irAlPresente(pane) { vistaDefecto(pane); if (pane === S.focus) sincronizarFocus(); }
/* Reorganiza todo al 2×2 por defecto y re-ajusta las gráficas (rescate si un
   resize manual dejó la rejilla descolocada). */
function reorganizar() {
  const ov = $('mc-overlay'); if (ov) ov.classList.remove('mc-hasmax');
  S.paneles.forEach((p) => {
    if (p.max) {
      p.max = false; p.el.classList.remove('mc-max');
      const fb = p.el.querySelector('[data-full]'); if (fb) { fb.innerHTML = IC.full; fb.classList.remove('on'); }
      if (p.flotante && p._inline) p.el.setAttribute('style', p._inline);
    }
    if (!p.flotante) { p.el.removeAttribute('style'); p._inline = ''; }
  });
  ajustarGrid();
  setTimeout(() => { S.paneles.forEach((p) => vistaDefecto(p)); if (S.focus) sincronizarFocus(); }, 90);
  toast('Layout reset');
}
function cerrarPane(pane) {
  const docked = S.paneles.filter((p) => !p.flotante);
  if (!pane.flotante && docked.length <= 1) { toast('Keep at least one chart.'); return; }
  if (pane.max) { const ov = $('mc-overlay'); if (ov) ov.classList.remove('mc-hasmax'); }   // si estaba en fullscreen, libera el modo (si no, los demás quedan ocultos)
  try { pane.stream && pane.stream.cerrar(); } catch (_) {}
  try { pane.barra && pane.barra.desmontar && pane.barra.desmontar(); } catch (_) {}
  try { pane.chart.remove(); } catch (_) {}
  pane.el.remove();
  S.paneles = S.paneles.filter((p) => p !== pane);
  if (S.focus === pane) { S.focus = null; const n = S.paneles.find((p) => !p.flotante) || S.paneles[0]; if (n) enfocar(n); }
  ajustarGrid();
}
function ajustarGrid() {
  const grid = $('mc-grid'); if (!grid) return;
  const n = S.paneles.filter((p) => !p.flotante).length;
  grid.classList.toggle('mc-uno', n === 1);
}
function arrastrar(pane) {
  const head = pane.el.querySelector('.mc-head'); let sx, sy, ox, oy, mov = false;
  head.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    mov = true; sx = e.clientX; sy = e.clientY; ox = parseInt(pane.el.style.left) || 0; oy = parseInt(pane.el.style.top) || 0;
    head.style.cursor = 'grabbing'; pane.el.style.zIndex = 58; e.preventDefault();
    const mm = (ev) => { if (!mov) return; pane.el.style.left = Math.max(0, ox + ev.clientX - sx) + 'px'; pane.el.style.top = Math.max(52, oy + ev.clientY - sy) + 'px'; };
    const mu = () => { mov = false; head.style.cursor = 'grab'; window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
  });
}
function addFloat() { crearPanel('BTC', '1m', true).then((p) => { if (p) { D.logos().then(() => pintarLogoHead(p)); } }); ajustarGrid(); }

/* ── Herramientas de la barra superior (actúan en TODAS las gráficas) ── */
function toggleSync() {
  S.sync = !S.sync;
  $('mc-sync').classList.toggle('on', S.sync);
  if (!S.sync) S.paneles.forEach((o) => { try { o.chart.clearCrosshairPosition(); } catch (_) {} });
  toast(S.sync ? 'Sync ON · move one chart, all follow' : 'Sync OFF');
}
function toggleTool(t) {
  S.tool = (S.tool === t) ? null : t;
  S.preview = null;
  $('mc-vline').classList.toggle('on', S.tool === 'vline');
  $('mc-hline').classList.toggle('on', S.tool === 'hline');
  S.paneles.forEach((p) => { const cap = p.body.querySelector('.mc-cap'); if (cap) cap.classList.toggle('on', !!S.tool); });
  if (S.tool === 'vline') toast('Vertical line · click any chart to mark the same time on all');
  else if (S.tool === 'hline') toast('Horizontal line · click a chart to mark a price');
}

/* ── Menús ── */
function cerrarMenu() { if (S.menu) { S.menu.remove(); S.menu = null; } }
function fueraMenu(e) { if (S.menu && !S.menu.contains(e.target)) cerrarMenu(); }
function pop(anc, html, w) {
  cerrarMenu();
  const m = document.createElement('div'); m.className = 'mc-pop'; m.innerHTML = html;
  if (w) m.style.width = w + 'px';
  ($('mc-overlay') || document.body).appendChild(m);
  const r = anc.getBoundingClientRect();
  let left = r.left, top = r.bottom + 6;
  const mw = m.offsetWidth, mh = m.offsetHeight;
  if (left + mw > innerWidth - 8) left = innerWidth - mw - 8;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  m.style.left = Math.max(8, left) + 'px'; m.style.top = top + 'px';
  m.onmousedown = (e) => e.stopPropagation();
  S.menu = m; return m;
}
function menuMonedas(pane, anc) {
  const m = pop(anc, `<input class="mc-search" placeholder="Search coin (USDT pairs)…"><div class="mc-list" id="mc-coinlist"></div>`, 260);
  const list = m.querySelector('#mc-coinlist'), inp = m.querySelector('.mc-search');
  const base = D.PARES.filter((p) => p.grupo !== 'divisa' && p.grupo !== 'materia');   // solo pares USDT (cripto), como el resto de la sección
  const render = (f) => {
    const t = (f || '').trim().toLowerCase();
    const arr = base.filter((p) => !t || p.id.toLowerCase().includes(t) || (p.n || '').toLowerCase().includes(t)).slice(0, 140);
    list.innerHTML = arr.map((p) => `<div class="mc-opt${p.id === pane.par.id ? ' on' : ''}" data-id="${p.id}"><span class="ic" data-cg="${p.cg || ''}" data-id2="${p.id}">${p.id[0]}</span><b>${p.id}</b><span>${esc(p.n || '')}</span></div>`).join('') || `<div class="mc-opt" style="opacity:.6">No matches</div>`;
    list.querySelectorAll('.mc-opt[data-id]').forEach((o) => o.onclick = () => { cambiarMoneda(pane, o.dataset.id); cerrarMenu(); });
    list.querySelectorAll('.ic[data-cg]').forEach((ic) => { const url = (S.logos && ic.dataset.cg && S.logos[ic.dataset.cg]) || ICONO(ic.dataset.id2); const im = new Image(); im.onload = () => { ic.style.backgroundImage = `url(${url})`; ic.textContent = ''; }; im.src = url; });
  };
  render(''); setTimeout(() => inp.focus(), 30);
  inp.oninput = () => render(inp.value);
}
async function cambiarMoneda(pane, id) {
  const par = D.PARES.find((p) => p.id === id); if (!par) return;
  pane.par = par;
  pane.hlines = [];
  pane.el.querySelector('.mc-coin .nm').textContent = par.id;
  pintarLogoHead(pane);
  if (pane === S.focus) NIV.par = par.id;
  pane.dibCache = cargarDibDe(par.id);
  await cargarPanel(pane);
}
function menuTf(pane, anc) {
  const m = pop(anc, `<div class="mc-indhead">Timeframe</div><div class="mc-tfgrid">${D.TFS.map((t) => `<button class="${t.id === pane.tf ? 'on' : ''}" data-tf="${t.id}">${t.n}</button>`).join('')}</div>`, 220);
  m.querySelectorAll('[data-tf]').forEach((b) => b.onclick = async () => { pane.tf = b.dataset.tf; pane.el.querySelector('[data-tf]').textContent = pane.tf; cerrarMenu(); await cargarPanel(pane); });
}
function menuInd(pane, anc) {
  const ovl = OVL.map((o) => `<div class="mc-ir${pane.ovl.has(o.k) ? ' on' : ''}" data-ovl="${o.k}"><span><i class="dot" style="background:${o.col}"></i>${o.n}</span><span class="sw"></span></div>`).join('');
  const bollR = `<div class="mc-ir${pane.bollOn ? ' on' : ''}" data-boll><span><i class="dot" style="background:#78a0ff"></i>Bollinger</span><span class="sw"></span></div>`;
  const osc = OSC.map((o) => `<div class="mc-ir${pane.oscK === o.k ? ' on' : ''}" data-osc="${o.k}"><span><i class="dot" style="background:${o.col}"></i>${o.n}</span><span class="sw"></span></div>`).join('');
  const m = pop(anc, `<div class="mc-indhead">Overlays</div>${ovl}${bollR}<div class="mc-indhead">Oscillator</div>${osc}`, 248);
  const marca = () => pane.el.querySelector('[data-ind]').classList.toggle('on', indActivo(pane));
  m.querySelectorAll('[data-ovl]').forEach((r) => r.onclick = () => { const k = r.dataset.ovl; pane.ovl.has(k) ? pane.ovl.delete(k) : pane.ovl.add(k); r.classList.toggle('on'); recalc(pane); marca(); });
  m.querySelector('[data-boll]').onclick = (e) => { pane.bollOn = !pane.bollOn; e.currentTarget.classList.toggle('on'); recalc(pane); marca(); };
  m.querySelectorAll('[data-osc]').forEach((r) => r.onclick = () => { pane.oscK = (pane.oscK === r.dataset.osc) ? null : r.dataset.osc; m.querySelectorAll('[data-osc]').forEach((x) => x.classList.toggle('on', x.dataset.osc === pane.oscK)); recalc(pane); marca(); });
}
function indActivo(pane) { return pane.ovl.size > 0 || pane.bollOn || !!pane.oscK; }

/* ── Guardar imagen ── */
async function guardarImagenPanel(pane) {
  const cv = componerPanel(pane, 1040, 620); if (!cv) return;
  modalImg(cv, 'DecFreedom-' + pane.par.id + '-' + pane.tf + '.png', pane.par.id + 'USDT · ' + pane.tf);
}
function componerPanel(pane, cw, ch) {
  const out = document.createElement('canvas'); out.width = cw; out.height = ch; const g = out.getContext('2d');
  g.fillStyle = '#05070a'; g.fillRect(0, 0, cw, ch);
  g.fillStyle = '#E8B84B'; g.fillRect(0, 0, cw, 4);
  const top = 46;
  g.fillStyle = '#eaecef'; g.font = '800 18px "Chakra Petch", sans-serif'; g.textAlign = 'left'; g.fillText(pane.par.id + 'USDT', 16, 30);
  g.fillStyle = '#6b7580'; g.font = '700 12px "IBM Plex Mono", monospace'; g.fillText(pane.tf, 20 + g.measureText(pane.par.id + 'USDT').width, 29);
  g.textAlign = 'right'; g.fillText('decfreedom.com', cw - 16, 29);
  try {
    const shot = pane.chart.takeScreenshot();
    g.drawImage(shot, 0, top, cw, ch - top);
    if (pane.fx && pane.fx.width) g.drawImage(pane.fx, 0, top, cw, ch - top);
    if (pane.ux && pane.ux.width) g.drawImage(pane.ux, 0, top, cw, ch - top);
    const cvh = pane.body.querySelector('.nv-cvh'); if (cvh && cvh.width) g.drawImage(cvh, 0, top, cw, ch - top);
  } catch (_) {}
  // marca de agua abajo a la izquierda
  try { const wm = pane.el.querySelector('.mc-wm img'); if (wm && wm.complete && wm.naturalWidth) { const h = 26, w = h * (wm.naturalWidth / wm.naturalHeight); g.globalAlpha = 0.72; g.drawImage(wm, 16, ch - h - 14, w, h); g.globalAlpha = 1; } } catch (_) {}
  return out;
}
async function guardarImagenTodas() {
  const ps = S.paneles.filter((p) => !p.flotante); if (!ps.length) return;
  const cols = ps.length <= 1 ? 1 : 2, filas = Math.ceil(ps.length / cols);
  const cw = 760, ch = 460, gap = 10, pad = 14, top = 52;
  const W = pad * 2 + cols * cw + (cols - 1) * gap, H = top + pad * 2 + filas * ch + (filas - 1) * gap;
  const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d');
  g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H); g.fillStyle = '#E8B84B'; g.fillRect(0, 0, W, 4);
  g.fillStyle = '#eaecef'; g.font = '800 22px "Chakra Petch", sans-serif'; g.textAlign = 'left'; g.fillText('Multichart', pad, 38);
  g.fillStyle = '#6b7580'; g.font = '700 13px "IBM Plex Mono", monospace'; g.textAlign = 'right'; g.fillText('decfreedom.com', W - pad, 36);
  ps.forEach((p, i) => {
    const cx = pad + (i % cols) * (cw + gap), cy = top + pad + ((i / cols) | 0) * (ch + gap);
    g.fillStyle = '#0b0f15'; redondea(g, cx, cy, cw, ch, 10); g.fill();
    try { const shot = p.chart.takeScreenshot(); g.save(); redondea(g, cx + 1, cy + 30, cw - 2, ch - 31, 8); g.clip(); g.drawImage(shot, cx + 1, cy + 30, cw - 2, ch - 31); if (p.fx && p.fx.width) g.drawImage(p.fx, cx + 1, cy + 30, cw - 2, ch - 31); if (p.ux && p.ux.width) g.drawImage(p.ux, cx + 1, cy + 30, cw - 2, ch - 31); const cvh = p.body.querySelector('.nv-cvh'); if (cvh && cvh.width) g.drawImage(cvh, cx + 1, cy + 30, cw - 2, ch - 31); g.restore(); } catch (_) {}
    g.textAlign = 'left'; g.fillStyle = '#eaecef'; g.font = '800 14px "Chakra Petch", sans-serif'; g.fillText(p.par.id + 'USDT', cx + 12, cy + 21);
    g.fillStyle = '#6b7580'; g.font = '700 11px "IBM Plex Mono", monospace'; g.fillText(p.tf, cx + 14 + g.measureText(p.par.id + 'USDT').width, cy + 20);
  });
  modalImg(out, 'DecFreedom-multichart.png', 'Multichart');
}
function modal(titulo, innerHTML) {
  const old = $('mc-modal'); if (old) old.remove();
  const m = document.createElement('div'); m.className = 'mc-modal'; m.id = 'mc-modal';
  m.innerHTML = `<div class="bx"><div class="bxh"><b>${esc(titulo)}</b><button class="mc-icobtn x" id="mc-mx">${IC.x}</button></div>${innerHTML}</div>`;
  ($('mc-overlay') || document.body).appendChild(m);
  const ce = () => m.remove(); m.querySelector('#mc-mx').onclick = ce; m.onclick = (e) => { if (e.target === m) ce(); };
  return m;
}
function modalImg(cv, fname, titulo) {
  const m = modal(titulo || 'Chart image', `<div class="bxc"></div><div class="bxf"><button class="dl" id="mc-dl">Download image</button><button id="mc-cl">Close</button></div>`);
  m.querySelector('.bxc').appendChild(cv);
  m.querySelector('#mc-cl').onclick = () => m.remove();
  m.querySelector('#mc-dl').onclick = () => { try { cv.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname || 'DecFreedom.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); } catch (_) {} };
}

/* ── Utilidades ── */
function decimales(p) { p = Math.abs(+p || 0); if (p >= 1000) return 2; if (p >= 1) return 2; if (p >= 0.01) return 4; if (p >= 0.0001) return 6; return 8; }
function fmtNum(p) { const d = decimales(p); return Number(p).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
const _MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtFecha(t) { try { const d = new Date(t * 1000); const p = (n) => (n < 10 ? '0' + n : '' + n); return p(d.getDate()) + ' ' + _MESES[d.getMonth()] + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); } catch (_) { return ''; } }
function redondea(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
let tmrToast = null;
function toast(msg) { let t = $('mc-toast'); if (!t) { t = document.createElement('div'); t.id = 'mc-toast'; t.className = 'mc-toast'; ($('mc-overlay') || document.body).appendChild(t); } t.textContent = msg; requestAnimationFrame(() => t.classList.add('on')); clearTimeout(tmrToast); tmrToast = setTimeout(() => t.classList.remove('on'), 2600); }
