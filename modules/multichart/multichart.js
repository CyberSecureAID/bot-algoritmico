/* modules/multichart/multichart.js — Servicio Multichart.

   Varias gráficas en vivo a la vez (2×2 por defecto: BTC, ETH, BNB, SOL),
   cada una independiente, redimensionable (como VWAP Pro), con selector de
   moneda con búsqueda, temporalidad, indicadores con la MISMA iluminación
   (glow) del área VWAP, pantalla completa y cierre. Un botón "+" dorado añade
   gráficas flotantes (con sombra sobre las demás). Botón para guardar imagen y
   calendario económico. Reutiliza la capa de datos y el catálogo de monedas que
   ya usa el resto de la plataforma (Binance en vivo, sin servidor). */

import { estilos } from './estilos.js?v=1';
import * as D from '../trading-demo/datos.js?v=2';

const LIB = new URL('../trading-demo/vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const ICONO = (s) => 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/' + String(s).toLowerCase() + '.png';

const $ = (id) => document.getElementById(id);
const DEF = ['BTC', 'ETH', 'BNB', 'SOL'];
const S = { paneles: [], seq: 0, raf: null, logos: {}, menu: null };
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

// overlays sobre el precio (línea simple)
const OVL = [
  { k: 'ema9', n: 'EMA 9', col: '#49b6ff', f: (v) => ema(cls(v), 9) },
  { k: 'ema21', n: 'EMA 21', col: '#E8B84B', f: (v) => ema(cls(v), 21) },
  { k: 'ema50', n: 'EMA 50', col: '#b07cff', f: (v) => ema(cls(v), 50) },
  { k: 'sma200', n: 'SMA 200', col: '#ff8fbf', f: (v) => sma(cls(v), 200) },
  { k: 'vwap', n: 'VWAP', col: '#2ee8c6', f: (v) => vwap(v) }
];
// osciladores (uno activo en la banda inferior)
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
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.4"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>',
  ind: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13c2.5 0 2.5-6 5-6s2.5 10 5 10 2.5-8 5-8"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>'
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
        <button class="mc-icobtn" id="mc-cal" title="Economic calendar">${IC.cal}</button>
        <button class="mc-icobtn" id="mc-save" title="Save image">${IC.cam}</button>
        <button class="mc-add" id="mc-addbtn">${IC.plus} Add chart</button>
      </div>
    </div>
    <div class="mc-grid" id="mc-grid"></div>`;
  document.body.appendChild(ov);
  $('mc-back').onclick = cerrarMulti;
  $('mc-addbtn').onclick = () => addFloat();
  $('mc-save').onclick = guardarImagen;
  $('mc-cal').onclick = calendario;
  document.addEventListener('mousedown', fueraMenu, true);
  try { LC = await lib(); } catch (_) { toast('Could not load the chart library.'); return; }
  for (const id of DEF) { await crearPanel(id, '1m'); }
  ajustarGrid();
  D.logos().then((l) => { S.logos = l || {}; S.paneles.forEach(pintarLogoHead); });
  arrancarRAF();
  window.addEventListener('resize', onResize);
}

function cerrarMulti() {
  if (S.raf) cancelAnimationFrame(S.raf);
  document.removeEventListener('mousedown', fueraMenu, true);
  window.removeEventListener('resize', onResize);
  S.paneles.forEach((p) => { try { p.stream && p.stream.cerrar(); } catch (_) {} try { p.chart.remove(); } catch (_) {} });
  S.paneles = [];
  cerrarMenu();
  const m = $('mc-modal'); if (m) m.remove();
  const ov = $('mc-overlay'); if (ov) ov.remove();
  if (window.__ANALISIS_PAGINA__ && !document.getElementById('an-root')) { try { history.back(); } catch (_) {} }
}
function onResize() { S.paneles.forEach((p) => { try { p.chart.applyOptions({}); } catch (_) {} }); }

/* ── Panel ── */
async function crearPanel(parId, tf, flotante, pos) {
  const par = D.PARES.find((p) => p.id === parId) || D.PARES[0];
  const id = 'mcp' + (++S.seq);
  const pane = { id, par, tf, chart: null, serie: null, velas: [], stream: null, flotante: !!flotante, max: false, ovl: new Set(['ema9', 'ema21', 'vwap']), bollOn: false, oscK: 'rsi', ind: {} };
  const el = document.createElement('div'); el.className = flotante ? 'mc-float' : 'mc-pane'; el.id = id;
  el.innerHTML = `
    <div class="mc-head">
      <button class="mc-coin" data-coin><span class="ic"></span><b class="nm">${par.id}</b><span class="q">/USDT</span><span class="cv">▾</span></button>
      <button class="mc-tf" data-tf>${tf}</button>
      <span class="mc-px" data-px>—</span>
      <span class="mc-hsp"></span>
      <button class="mc-hb" data-ind title="Indicators">${IC.ind}</button>
      <button class="mc-hb" data-full title="Fullscreen">${IC.full}</button>
      <button class="mc-hb mc-close" data-close title="Close">${IC.x}</button>
    </div>
    <div class="mc-body">
      <div class="mc-cv"></div>
      <canvas class="mc-fx"></canvas>
      <div class="mc-wm"><img src="${LOGO}" alt=""></div>
      <div class="mc-grip"></div>
      <div class="mc-spin"><i></i></div>
    </div>`;
  if (flotante) { el.style.left = ((pos && pos.x) || 130 + S.paneles.length * 22) + 'px'; el.style.top = ((pos && pos.y) || 86 + S.paneles.length * 20) + 'px'; $('mc-overlay').appendChild(el); }
  else $('mc-grid').appendChild(el);
  pane.el = el;
  pane.fx = el.querySelector('.mc-fx');
  const mount = el.querySelector('.mc-cv');
  const chart = LC.createChart(mount, {
    layout: { background: { type: 'solid', color: '#05070a' }, textColor: '#8b95a1', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10 },
    grid: { vertLines: { color: 'rgba(255,255,255,.028)' }, horzLines: { color: 'rgba(255,255,255,.028)' } },
    autoSize: true,
    rightPriceScale: { borderColor: '#222b35', scaleMargins: { top: 0.06, bottom: 0.28 } },
    timeScale: { borderColor: '#222b35', timeVisible: true, secondsVisible: false, rightOffset: 5, barSpacing: 7, minBarSpacing: 0.6 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  const serie = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e' });
  pane.chart = chart; pane.serie = serie;
  S.paneles.push(pane);
  pintarLogoHead(pane);
  wirePane(pane);
  await cargarPanel(pane);
  return pane;
}

async function cargarPanel(pane) {
  const sp = pane.el.querySelector('.mc-spin'); if (sp) sp.style.display = 'grid';
  try {
    const [v, t] = await Promise.all([D.velas(pane.par.s, pane.tf, 500), D.ticker(pane.par.s).catch(() => null)]);
    pane.velas = v;
    pane.serie.setData(v.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    recalc(pane);
    if (t) pintarPx(pane, t.last, t.chgPct); else if (v.length) pintarPx(pane, v[v.length - 1].close);
    try { pane.chart.timeScale().fitContent(); } catch (_) {}
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
  if (last && c.time === last.time) pane.velas[pane.velas.length - 1] = c;
  else if (!last || c.time > last.time) { pane.velas.push(c); if (pane.velas.length > 700) pane.velas.shift(); }
  else return;
  try { pane.serie.update({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }); } catch (_) {}
  recalc(pane);
  pintarPx(pane, c.close);
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

/* ── Indicadores: cálculo cacheado + dibujo con glow en cada frame ── */
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
function arrancarRAF() { const tick = () => { S.paneles.forEach(dibujar); S.raf = requestAnimationFrame(tick); }; S.raf = requestAnimationFrame(tick); }
function dibujar(pane) {
  const fx = pane.fx, body = pane.el.querySelector('.mc-body'); if (!fx || !body || !pane.serie) return;
  const W = body.clientWidth, H = body.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (fx.width !== Math.round(W * dpr)) { fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); fx.style.width = W + 'px'; fx.style.height = H + 'px'; }
  const g = fx.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const ind = pane.ind; if (!ind) return;
  const ts = pane.chart.timeScale();
  const X = (t) => { try { const c = ts.timeToCoordinate(t); return c == null ? null : c; } catch (_) { return null; } };
  const Yp = (p) => { try { const c = pane.serie.priceToCoordinate(p); return c == null ? null : c; } catch (_) { return null; } };
  const gp = 0.5 + 0.5 * Math.sin(performance.now() / 620);
  const v = pane.velas;
  (ind.ovl || []).forEach((o) => linea(g, v, o.data, X, Yp, o.col, gp));
  if (ind.boll) { linea(g, v, ind.boll.up, X, Yp, 'rgba(120,160,255,.85)', gp); linea(g, v, ind.boll.lo, X, Yp, 'rgba(120,160,255,.85)', gp); linea(g, v, ind.boll.ma, X, Yp, 'rgba(120,160,255,.5)', gp); }
  if (ind.osc) oscilador(g, v, ind.osc, X, W, H, gp);
}
function linea(g, velas, data, X, Yp, col, gp) {
  if (!data) return; g.save(); g.beginPath(); let on = false;
  for (let i = 0; i < velas.length; i++) { const val = data[i]; if (val == null) { on = false; continue; } const x = X(velas[i].time); if (x == null) { on = false; continue; } const y = Yp(val); if (y == null) { on = false; continue; } if (on) g.lineTo(x, y); else { g.moveTo(x, y); on = true; } }
  g.strokeStyle = col; g.lineWidth = 1.7; g.lineJoin = 'round'; g.shadowColor = col; g.shadowBlur = 4 + 8 * gp; g.stroke(); g.restore();
}
function oscilador(g, velas, osc, X, W, H, gp) {
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
  // histograma (MACD)
  if (osc.hist) { for (let i = 0; i < velas.length; i++) { const hv = osc.hist[i]; if (hv == null) continue; const x = X(velas[i].time); if (x == null) continue; const y0 = Y(0), y1 = Y(hv); g.fillStyle = hv >= 0 ? 'rgba(46,232,106,.5)' : 'rgba(255,91,110,.5)'; g.fillRect(x - 1.5, Math.min(y0, y1), 3, Math.abs(y1 - y0)); } }
  const dibSer = (ser, col) => { if (!ser) return; g.beginPath(); let on = false; for (let i = 0; i < velas.length; i++) { const val = ser[i]; if (val == null) { on = false; continue; } const x = X(velas[i].time); if (x == null) { on = false; continue; } const y = Y(val); if (on) g.lineTo(x, y); else { g.moveTo(x, y); on = true; } } g.strokeStyle = col; g.lineWidth = 1.7; g.lineJoin = 'round'; g.shadowColor = col; g.shadowBlur = 4 + 8 * gp; g.stroke(); };
  dibSer(osc.serie2, osc.col2 || '#ff8fbf');
  dibSer(osc.serie, def.col);
  g.shadowBlur = 0; g.fillStyle = '#7b8694'; g.font = '700 10px "IBM Plex Mono", monospace'; g.textAlign = 'left'; g.fillText(def.n, 8, top + 11);
  g.restore();
}

/* ── Controles del panel ── */
function wirePane(pane) {
  const q = (s) => pane.el.querySelector(s);
  q('[data-coin]').onclick = (e) => { e.stopPropagation(); menuMonedas(pane, q('[data-coin]')); };
  q('[data-tf]').onclick = (e) => { e.stopPropagation(); menuTf(pane, q('[data-tf]')); };
  q('[data-ind]').onclick = (e) => { e.stopPropagation(); menuInd(pane, q('[data-ind]')); };
  q('[data-full]').onclick = () => fullPane(pane);
  q('[data-close]').onclick = () => cerrarPane(pane);
  if (pane.flotante) arrastrar(pane);
}
function fullPane(pane) {
  pane.max = !pane.max;
  pane.el.classList.toggle('mc-max', pane.max);
  pane.el.querySelector('[data-full]').innerHTML = pane.max ? IC.shrink : IC.full;
  pane.el.querySelector('[data-full]').classList.toggle('on', pane.max);
  setTimeout(() => { try { pane.chart.applyOptions({}); } catch (_) {} }, 60);
}
function cerrarPane(pane) {
  const docked = S.paneles.filter((p) => !p.flotante);
  if (!pane.flotante && docked.length <= 1) { toast('Keep at least one chart.'); return; }
  try { pane.stream && pane.stream.cerrar(); } catch (_) {}
  try { pane.chart.remove(); } catch (_) {}
  pane.el.remove();
  S.paneles = S.paneles.filter((p) => p !== pane);
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
function addFloat() { crearPanel('BTC', '1m', true); ajustarGrid(); }

/* ── Menús ── */
function cerrarMenu() { if (S.menu) { S.menu.remove(); S.menu = null; } }
function fueraMenu(e) { if (S.menu && !S.menu.contains(e.target)) cerrarMenu(); }
function pop(anc, html, w) {
  cerrarMenu();
  const m = document.createElement('div'); m.className = 'mc-pop'; m.innerHTML = html;
  if (w) m.style.width = w + 'px';
  document.body.appendChild(m);
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
  const render = (f) => {
    const t = (f || '').trim().toLowerCase();
    const arr = D.PARES.filter((p) => !t || p.id.toLowerCase().includes(t) || (p.n || '').toLowerCase().includes(t)).slice(0, 80);
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
  pane.el.querySelector('.mc-coin .nm').textContent = par.id;
  pintarLogoHead(pane);
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
  m.querySelectorAll('[data-ovl]').forEach((r) => r.onclick = () => { const k = r.dataset.ovl; pane.ovl.has(k) ? pane.ovl.delete(k) : pane.ovl.add(k); r.classList.toggle('on'); recalc(pane); });
  m.querySelector('[data-boll]').onclick = (e) => { pane.bollOn = !pane.bollOn; e.currentTarget.classList.toggle('on'); recalc(pane); };
  m.querySelectorAll('[data-osc]').forEach((r) => r.onclick = () => { pane.oscK = (pane.oscK === r.dataset.osc) ? null : r.dataset.osc; m.querySelectorAll('[data-osc]').forEach((x) => x.classList.toggle('on', x.dataset.osc === pane.oscK)); recalc(pane); });
}

/* ── Calendario económico (widget de TradingView) ── */
function calendario() {
  const m = modal('Economic calendar', `<div class="bxc" id="mc-calbox"></div>`);
  const box = m.querySelector('#mc-calbox');
  try {
    const w = document.createElement('div'); w.className = 'tradingview-widget-container';
    w.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
    const sc = document.createElement('script'); sc.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js'; sc.async = true;
    sc.textContent = JSON.stringify({ colorTheme: 'dark', isTransparent: true, locale: 'en', countryFilter: 'us,eu,gb,jp,cn', importanceFilter: '0,1', width: '100%', height: 560 });
    w.appendChild(sc); box.appendChild(w);
  } catch (_) { box.innerHTML = '<div style="padding:40px;text-align:center;color:#8b95a1">Could not load the calendar.</div>'; }
}

/* ── Guardar imagen (compone los paneles visibles) ── */
async function guardarImagen() {
  const ps = S.paneles.filter((p) => !p.flotante);
  if (!ps.length) return;
  const cols = ps.length <= 1 ? 1 : 2, filas = Math.ceil(ps.length / cols);
  const cw = 760, ch = 460, gap = 10, pad = 16, top = 54;
  const W = pad * 2 + cols * cw + (cols - 1) * gap, H = top + pad * 2 + filas * ch + (filas - 1) * gap;
  const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d');
  g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#E8B84B'; g.fillRect(0, 0, W, 4);
  g.fillStyle = '#eaecef'; g.font = '800 22px "Chakra Petch", sans-serif'; g.textAlign = 'left'; g.fillText('Multichart', pad, 38);
  g.fillStyle = '#6b7580'; g.font = '700 13px "IBM Plex Mono", monospace'; g.textAlign = 'right'; g.fillText('decfreedom.com', W - pad, 36);
  ps.forEach((p, i) => {
    const cx = pad + (i % cols) * (cw + gap), cy = top + pad + ((i / cols) | 0) * (ch + gap);
    g.fillStyle = '#0b0f15'; redondea(g, cx, cy, cw, ch, 10); g.fill();
    try { const shot = p.chart.takeScreenshot(); g.save(); redondea(g, cx + 1, cy + 34, cw - 2, ch - 35, 8); g.clip(); g.drawImage(shot, cx + 1, cy + 34, cw - 2, ch - 35); if (p.fx && p.fx.width) g.drawImage(p.fx, cx + 1, cy + 34, cw - 2, ch - 35); g.restore(); } catch (_) {}
    g.textAlign = 'left'; g.fillStyle = '#eaecef'; g.font = '800 14px "Chakra Petch", sans-serif'; g.fillText(p.par.id + 'USDT', cx + 12, cy + 23);
    g.fillStyle = '#6b7580'; g.font = '700 11px "IBM Plex Mono", monospace'; g.fillText(p.tf, cx + 12 + g.measureText(p.par.id + 'USDT').width + 10, cy + 22);
  });
  modalImg(out);
}

/* ── Modales ── */
function modal(titulo, innerHTML) {
  const old = $('mc-modal'); if (old) old.remove();
  const m = document.createElement('div'); m.className = 'mc-modal'; m.id = 'mc-modal';
  m.innerHTML = `<div class="bx"><div class="bxh"><b>${esc(titulo)}</b><button class="mc-icobtn x" id="mc-mx">${IC.x}</button></div>${innerHTML}</div>`;
  document.body.appendChild(m);
  const ce = () => m.remove(); m.querySelector('#mc-mx').onclick = ce; m.onclick = (e) => { if (e.target === m) ce(); };
  return m;
}
function modalImg(cv) {
  const m = modal('Multichart image', `<div class="bxc"></div><div class="bxf"><button class="dl" id="mc-dl">Download image</button><button id="mc-cl">Close</button></div>`);
  m.querySelector('.bxc').appendChild(cv);
  m.querySelector('#mc-cl').onclick = () => m.remove();
  m.querySelector('#mc-dl').onclick = () => { try { cv.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'DecFreedom-multichart.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); } catch (_) {} };
}

/* ── Utilidades ── */
function decimales(p) { p = Math.abs(+p || 0); if (p >= 1000) return 2; if (p >= 1) return 2; if (p >= 0.01) return 4; if (p >= 0.0001) return 6; return 8; }
function redondea(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
let tmrToast = null;
function toast(msg) { let t = $('mc-toast'); if (!t) { t = document.createElement('div'); t.id = 'mc-toast'; t.className = 'mc-toast'; document.body.appendChild(t); } t.textContent = msg; requestAnimationFrame(() => t.classList.add('on')); clearTimeout(tmrToast); tmrToast = setTimeout(() => t.classList.remove('on'), 2600); }
