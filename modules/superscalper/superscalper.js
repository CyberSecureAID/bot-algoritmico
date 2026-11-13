/* modules/superscalper/superscalper.js — "Multiverse" (nombre de cara al usuario).
   El archivo NO se renombra (la carpeta queda como superscalper), igual que "VWAP Pro"
   vive en modules/institutional/ y "Footprint" en modules/footprint/.

   Servicio de Analysis. Reemplaza al antiguo Relative Rotation en el MISMO módulo,
   conservando el chrome y la arquitectura del resto (barra superior idéntica, selector de
   moneda, temporalidades, barra de dibujo lateral, órdenes por clic derecho, export con
   marca de agua y ayuda). La vista es una gráfica de VELAS con el indicador encima.

   INDICADOR: dos capas sobre la gráfica de velas.
     A) Ribbon de medias GMMA (Daryl Guppy): 12 EMAs (6 cortas + 6 largas) que convergen en
        lateral y se abren en tendencia. El color sigue la tendencia actual y emite señal
        LONG/SHORT solo en el giro confirmado (banda de histéresis sobre ATR contra el ruido),
        en tiempo real al cierre, nunca pintada hacia atrás.
     B) Zonas de Order Block (concepto de BigBeluga): cajas de demanda (verde) y oferta
        (roja) a partir de pivotes con volumen y desplazamiento ATR(100); se extienden a la
        derecha y se retiran al invalidarse. Implementación propia en JavaScript desde la
        especificación funcional (no se copia el Pine original).
   Las zonas y señales son INFERENCIAS del precio y el volumen, no órdenes institucionales
   verificadas ni garantía de resultado. Es información, no consejo.

   Datos: solo Binance SPOT (klines OHLCV + stream), regla de CLAUDE.md. Default 1H. */

import { montarBarra } from '../../assets/js/niveles/barra.js?v=6';
import { PARES, pintarIcono } from '../../assets/js/niveles/config.js?v=1';
import { N } from '../../assets/js/niveles/estado.js?v=1';
import { cargarDib } from '../../assets/js/niveles/dibujo.js?v=3';

const WEB = 'decfreedom.com';
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const DISC_IMG = new URL('../../assets/portada/red/disclaimer.webp', import.meta.url).href;
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let _par = 'BTC';

const M = {
  tf: '1h', velas: [], precio: 0, dispC: null,        // DEFAULT 1H; dispC = cierre suavizado (easing)
  arbol: null, estado: null, arbolAlpha: 0,           // árbol de realidades + estado del mercado
  ancho: window.innerWidth < 760 ? 56 : 84, desplaz: 0, zoomY: 1, offsetY: 0,
  _geo: null, _cursor: null, cargando: true, error: null
};
const FUT = 0.42;                                     // fracción derecha del gráfico reservada a la proyección futura
const COL = { bull: '58,214,128', bear: '255,90,104', gold: '232,184,75' };   // verde / rojo de las velas fantasma + dorado de marca
// Temporalidades (las normales); el indicador se calcula sobre la elegida. Default 1H.
const SS_TFS = [
  { id: '1s', n: '1s', sec: 1 }, { id: '5s', n: '5s', sec: 5 }, { id: '15s', n: '15s', sec: 15 }, { id: '30s', n: '30s', sec: 30 },
  { id: '1m', n: '1m' }, { id: '5m', n: '5m' }, { id: '15m', n: '15m' }, { id: '30m', n: '30m' },
  { id: '1h', n: '1H' }, { id: '2h', n: '2H' }, { id: '4h', n: '4H' }, { id: '1d', n: '1D' }
];
const tfDef = (id) => SS_TFS.find((t) => t.id === id) || SS_TFS.find((t) => t.id === '1h');
function agregar(velas, sec) {
  const out = []; let cur = null;
  for (const v of velas) { const bt = Math.floor(v.t / sec) * sec;
    if (!cur || cur.t !== bt) { if (cur) out.push(cur); cur = { t: bt, o: v.o, h: v.h, l: v.l, c: v.c, v: v.v }; }
    else { if (v.h > cur.h) cur.h = v.h; if (v.l < cur.l) cur.l = v.l; cur.c = v.c; cur.v += v.v; } }
  if (cur) out.push(cur); return out;
}
async function traerVelasTF(simbolo, tf) {
  const d = tfDef(tf);
  if (d.sec && d.sec > 1) { const base = await traerVelas(simbolo, '1s', 1000); return agregar(base, d.sec); }
  return traerVelas(simbolo, tf, 800);
}
const streamTF = () => { const d = tfDef(M.tf); return (d.sec && d.sec > 1) ? '1s' : M.tf; };
let _barra = null, _od = null, _zonasOd = null, _reloj = null, _pulso = null;

/* ── Datos: klines OHLCV de Binance con respaldo de hosts ── */
const HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision', 'https://api-gcp.binance.com', 'https://api1.binance.com'];
let _host = 0;
async function rzFetch(path) {
  const orden = [_host, ...HOSTS.map((_, i) => i).filter((i) => i !== _host)];
  let err;
  for (const i of orden) {
    try { const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 5000); const r = await fetch(HOSTS[i] + path, { signal: ctl.signal }); clearTimeout(to); if (r.ok) { _host = i; return r; } err = new Error('HTTP ' + r.status); }
    catch (e) { err = e; }
  }
  throw err || new Error('sin datos');
}
async function traerVelas(simbolo, tf, n = 800) {
  const r = await rzFetch(`/api/v3/klines?symbol=${simbolo}&interval=${tf}&limit=${n}`);
  const j = await r.json();
  return j.map((x) => ({ t: Math.floor(x[0] / 1000), o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: (+x[7] || +x[5] || 0) }));
}
let _ssStream = null, _ssStreamKey = '';
function streamVelasRz(simbolo, tf, onK) {
  const url = `wss://stream.binance.com:9443/ws/${String(simbolo).toLowerCase()}@kline_${tf}`;
  let ws = null, cerrado = false, tmr = null;
  const abrir = () => {
    if (cerrado) return;
    try { ws = new WebSocket(url); } catch (_) { tmr = setTimeout(abrir, 2500); return; }
    ws.onmessage = (ev) => { try { const d = JSON.parse(ev.data); if (d && d.k) onK(d.k); } catch (_) {} };
    ws.onclose = () => { if (!cerrado) { clearTimeout(tmr); tmr = setTimeout(abrir, 2500); } };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  };
  abrir();
  return { cerrar: () => { cerrado = true; clearTimeout(tmr); try { if (ws) ws.close(); } catch (_) {} } };
}
function conectarStreamRz() {
  const p = PARES.find((x) => x.id === _par) || {};
  if (!p.s) return;
  const stf = streamTF(), key = p.s + '|' + stf;
  if (_ssStreamKey === key && _ssStream) return;
  if (_ssStream) { try { _ssStream.cerrar(); } catch (_) {} _ssStream = null; }
  _ssStreamKey = key;
  try { _ssStream = streamVelasRz(p.s, stf, onKlineRz); } catch (_) { _ssStream = null; }
}
function onKlineRz(k) {
  if (!k || !M.velas || !M.velas.length) return;
  const raw = { t: Math.floor(k.t / 1000), o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: (+k.q || +k.v || 0) };
  if (!(raw.c > 0)) return;
  const d = tfDef(M.tf), sec = (d.sec && d.sec > 1) ? d.sec : 0;
  const last = M.velas[M.velas.length - 1];
  let nueva = false;
  if (sec) {
    const bt = Math.floor(raw.t / sec) * sec;
    if (last && last.t === bt) { if (raw.h > last.h) last.h = raw.h; if (raw.l < last.l) last.l = raw.l; last.c = raw.c; last.v += 0; M.precio = raw.c; }
    else if (!last || bt > last.t) { M.velas.push({ t: bt, o: raw.o, h: raw.h, l: raw.l, c: raw.c, v: raw.v }); M.precio = raw.c; nueva = true; }
    else return;
  } else {
    if (raw.t === last.t) M.velas[M.velas.length - 1] = raw;
    else if (raw.t > last.t) { M.velas.push(raw); nueva = true; }
    else return;
    M.precio = raw.c;
  }
  if (nueva) { if (M.velas.length > 1500) M.velas.shift(); recalcArbol(); }   // recalcula el modelo al CERRAR una vela
}

const fmt = (p) => {
  if (!(p > 0)) return '·';
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(8);
};
function fmtFecha(tsSec) {
  const d = new Date(tsSec * 1000);
  if (tfDef(M.tf).sec) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const intradia = ['1m', '5m', '15m', '30m', '1h', '2h', '4h'].includes(M.tf);
  return intradia ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/* ══════════════════ MOTOR: Sistema de Probabilidad (árbol de realidades) ══════════════════ */
function smaEn(arr, n, i) { if (i < n - 1) return null; let s = 0; for (let j = i - n + 1; j <= i; j++) s += arr[j]; return s / n; }
function calcATR(velas, n) {   // ATR(n) de Wilder (RMA del True Range)
  const tr = [], atr = new Array(velas.length).fill(null);
  for (let i = 0; i < velas.length; i++) { const h = velas[i].h, l = velas[i].l, pc = i ? velas[i - 1].c : velas[i].o; tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))); }
  let prev = null;
  for (let i = 0; i < velas.length; i++) { if (i < n - 1) continue; if (i === n - 1) { let s = 0; for (let j = 0; j < n; j++) s += tr[j]; prev = s / n; } else prev = (prev * (n - 1) + tr[i]) / n; atr[i] = prev; }
  return atr;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hashId(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function regPend(cl, L) {   // pendiente de regresión lineal (precio por vela) sobre las últimas L
  const n = Math.min(L, cl.length); if (n < 3) return 0; const a = cl.slice(-n);
  let sx = 0, sy = 0, sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sx += i; sy += a[i]; sxy += i * a[i]; sxx += i * i; }
  const d = n * sxx - sx * sx; return d ? (n * sxy - sx * sy) / d : 0;
}
function rsiEn(velas, n) {   // RSI(n) clásico
  const L = velas.length; if (L < n + 1) return 50; let g = 0, p = 0;
  for (let i = L - n; i < L; i++) { const d = velas[i].c - velas[i - 1].c; if (d >= 0) g += d; else p -= d; }
  const rs = p === 0 ? 100 : g / p; return 100 - 100 / (1 + rs);
}
function nivelesEn(velas, atr) {   // ANALIZADOR 4: soportes/resistencias (pivotes agrupados)
  const n = velas.length, sw = 3, piv = [];
  for (let i = sw; i < n - sw; i++) { let hi = true, lo = true;
    for (let j = i - sw; j <= i + sw; j++) { if (j === i) continue; if (velas[j].h >= velas[i].h) hi = false; if (velas[j].l <= velas[i].l) lo = false; }
    if (hi) piv.push({ p: velas[i].h, i }); if (lo) piv.push({ p: velas[i].l, i }); }
  const a = atr[n - 1] || velas[n - 1].c * 0.004; piv.sort((x, y) => x.p - y.p); const cl = [];
  for (const pv of piv) { const last = cl[cl.length - 1]; if (last && Math.abs(pv.p - last.p) < a * 0.6) { last.p = (last.p * last.w + pv.p) / (last.w + 1); last.w++; last.i = Math.max(last.i, pv.i); } else cl.push({ p: pv.p, w: 1, i: pv.i }); }
  return cl;
}
function ultimoImpulso(velas) {   // ANALIZADOR 5: último tramo (swing a swing)
  const n = velas.length, look = Math.min(n, 60); let hi = -Infinity, lo = Infinity, hiI = n - 1, loI = n - 1;
  for (let i = n - look; i < n; i++) { if (velas[i].h > hi) { hi = velas[i].h; hiI = i; } if (velas[i].l < lo) { lo = velas[i].l; loI = i; } }
  const dir = hiI >= loI ? 1 : -1; return { dir, hi, lo, magAbs: Math.abs(hi - lo) || velas[n - 1].c * 0.01 };
}
/* Reúne los 5 analizadores en un estado medible del mercado. */
function analizarMercado(velas) {
  const n = velas.length, px = velas[n - 1].c, atr = calcATR(velas, 14), a = atr[n - 1] || px * 0.004, cl = velas.map((v) => v.c);
  const s1 = regPend(cl, 50), s2 = regPend(cl, 150);                       // 1) tendencia
  const trend = clamp((s1 * 0.6 + s2 * 0.4) / (a * 0.12), -1, 1);
  const roc = n > 12 ? (px - cl[n - 12]) / a : 0, mom = clamp(roc / 6, -1, 1);  // 2) impulso/agotamiento
  const r = rsiEn(velas, 14), exUp = clamp((r - 55) / 35, 0, 1), exDn = clamp((45 - r) / 35, 0, 1);
  const vols = velas.map((v) => v.v), vMean = smaEn(vols, 20, n - 1) || vols[n - 1] || 1, volRel = vMean > 0 ? vols[n - 1] / vMean : 1; // 3) volumen/rango
  let aMean = 0, cnt = 0; for (let i = Math.max(0, n - 50); i < n; i++) if (atr[i]) { aMean += atr[i]; cnt++; } aMean = cnt ? aMean / cnt : a;
  const rango = clamp(1 - a / (aMean * 1.1), 0, 1), volBreak = clamp((volRel - 1) / 1.5, 0, 1) * (0.4 + 0.6 * rango);
  const nv = nivelesEn(velas, atr);                                        // 4) niveles
  const resis = nv.filter((l) => l.p > px + a * 0.2).sort((x, y) => x.p - y.p), sopor = nv.filter((l) => l.p < px - a * 0.2).sort((x, y) => y.p - x.p);
  const resNext = resis[0] ? resis[0].p : px + a * 3, supNext = sopor[0] ? sopor[0].p : px - a * 3;
  const imp = ultimoImpulso(velas);                                        // 5) estructura
  return { px, a, trend, mom, exUp, exDn, r, volRel, rango, volBreak, resNext, supNext, niveles: nv, imp, n };
}

/* ── El árbol de realidades. En cada nodo, los analizadores definen la probabilidad
   condicional de 5 arquetipos; cada uno proyecta un tramo de velas fantasma hacia su
   objetivo. Se ramifica varias generaciones; la probabilidad de ruta es el producto. ── */
const ARB = { gen: 3, seg: 7, pMin: 0.05, maxNodos: 30 };
const ARQ = { cont: 'cont', pull: 'pull', rev: 'rev', rango: 'rango', ruptura: 'ruptura' };
function ramas(E, ctx, pFin) {
  const d = ctx.dir, px = pFin, a = E.a, paso = a * (2.2 - 0.2 * ctx.prof);   // el avance se acorta al profundizar (la tendencia pierde fuelle)
  const alin = d > 0 ? clamp(E.trend, 0, 1) : clamp(-E.trend, 0, 1);
  const exHacia = d > 0 ? E.exUp : E.exDn, exContra = d > 0 ? E.exDn : E.exUp;
  const lvlDir = d > 0 ? E.resNext : E.supNext, distLvl = Math.abs(lvlDir - px);
  const retro = Math.min(E.imp.magAbs * 0.5, a * 2.4);
  const targCont = distLvl < paso * 1.25 ? lvlDir : px + d * paso;         // continúa hasta la próxima barrera
  const targPull = px + d * paso * 0.28, targRev = px - d * paso * 0.95, targRange = px + d * paso * 0.05, targBreak = px + d * paso * 1.25;
  let w = {
    cont: (0.26 + 0.42 * alin) * (1 - 0.6 * exHacia) * (ctx.enNivel ? 0.24 : 1),
    pull: (0.18 + 0.45 * exHacia + 0.25 * Math.abs(E.mom)) * (ctx.faseRetro ? 0.4 : 1),
    rev: (0.16 + 0.55 * exHacia + 0.30 * exContra) * (ctx.enNivel ? 1.7 : 0.85),   // suelo alto: el lado contrario siempre tiene presencia
    rango: (0.12 + 0.7 * E.rango) * (1 - 0.4 * Math.abs(E.trend)),
    ruptura: (0.08 + 0.8 * E.volBreak) * (ctx.enNivel ? 1.9 : 0.5)
  };
  const tot = w.cont + w.pull + w.rev + w.rango + w.ruptura || 1;
  let outs = [
    { arq: ARQ.cont, dir: d, cond: w.cont / tot, target: targCont, enNivel: distLvl < paso * 1.25, retro },
    { arq: ARQ.pull, dir: d, cond: w.pull / tot, target: targPull, enNivel: false, retro },
    { arq: ARQ.rev, dir: -d, cond: w.rev / tot, target: targRev, enNivel: false, retro },
    { arq: ARQ.rango, dir: d, cond: w.rango / tot, target: targRange, enNivel: ctx.enNivel, retro },
    { arq: ARQ.ruptura, dir: d, cond: w.ruptura / tot, target: targBreak, enNivel: false, retro }
  ].sort((x, y) => y.cond - x.cond);
  const keep = ctx.prof < 1 ? 3 : 2;                                       // gen 0: 3 ramas; luego 2 (abanico limpio)
  outs = outs.slice(0, keep); const s = outs.reduce((z, o) => z + o.cond, 0) || 1; outs.forEach((o) => o.cond /= s);
  return outs;
}
function velasFantasma(p0, target, n, arq, seed, a, retro, dir) {
  const R = rng(seed), pts = [p0], d = dir || (Math.sign(target - p0) || 1);
  for (let i = 1; i <= n; i++) { const t = i / n; let base;
    if (arq === ARQ.pull) { const dip = p0 - d * retro; base = t < 0.45 ? p0 + (dip - p0) * ease(t / 0.45) : dip + (target - dip) * ease((t - 0.45) / 0.55); }
    else if (arq === ARQ.rango) base = p0 + Math.sin(t * Math.PI * 2.2) * a * 0.9 + (target - p0) * t;
    else if (arq === ARQ.ruptura) { const lvl = p0 + (target - p0) * 0.62; base = t < 0.55 ? p0 + (lvl - p0) * ease(t / 0.55) : t < 0.75 ? lvl - d * a * 0.7 * Math.sin((t - 0.55) / 0.2 * Math.PI) : lvl + (target - lvl) * ease((t - 0.75) / 0.25); }
    else base = p0 + (target - p0) * ease(t);                             // cont / rev
    pts.push(base + (R() - 0.5) * a * 0.45);
  }
  const vel = [];
  for (let i = 0; i < n; i++) { const o = pts[i], c = pts[i + 1], wick = a * (0.22 + R() * 0.5), hi = Math.max(o, c) + wick * R(), lo = Math.min(o, c) - wick * R(); vel.push({ o, h: hi, l: lo, c }); }
  return vel;
}
function construirArbol(E) {
  const raiz = { id: 'r', cumP: 1, bar0: E.n, pFin: E.px, velas: [], hijos: [], prof: 0 };
  const nodos = []; let total = 0; let lo = E.px, hi = E.px;
  const expandir = (nodo, ctx) => {
    if (ctx.prof >= ARB.gen || total > ARB.maxNodos) return;
    for (const o of ramas(E, ctx, nodo.pFin)) {
      const cumP = nodo.cumP * o.cond; if (cumP < ARB.pMin) continue; total++;
      const vel = velasFantasma(nodo.pFin, o.target, ARB.seg, o.arq, hashId(nodo.id + o.arq + total), E.a, o.retro, o.dir);
      for (const v of vel) { if (v.h > hi) hi = v.h; if (v.l < lo) lo = v.l; }
      const hijo = { id: nodo.id + '-' + total, arq: o.arq, dir: o.dir, cond: o.cond, cumP, bar0: nodo.bar0 + nodo.velas.length, pFin: o.target, pIni: nodo.pFin, velas: vel, prof: ctx.prof + 1 };
      nodos.push(hijo); nodo.esPadre = true;
      expandir(hijo, { dir: o.dir, enNivel: o.enNivel, faseRetro: o.arq === ARQ.pull, prof: ctx.prof + 1 });
    }
  };
  expandir(raiz, { dir: E.trend >= 0 ? 1 : -1, enNivel: false, faseRetro: false, prof: 0 });
  nodos.sort((x, y) => x.cumP - y.cumP);   // dibuja primero las improbables (debajo)
  let loP = E.px, hiP = E.px;              // envolvente de las ramas probables, para encuadrar la vista
  for (const nd of nodos) if (nd.cumP > 0.12) for (const v of nd.velas) { if (v.h > hiP) hiP = v.h; if (v.l < loP) loP = v.l; }
  return { raiz, nodos, px: E.px, lo, hi, loP, hiP };
}
function recalcArbol() {
  try { const E = analizarMercado(M.velas); M.estado = E; M.arbol = construirArbol(E); M.arbolAlpha = 0; }
  catch (_) { M.arbol = null; M.estado = null; }
}

/* ══════════════════ APERTURA ══════════════════ */
export async function abrirSuperScalper() {
  estilos();
  const prev = $('ss-overlay'); if (prev) prev.remove();
  M.velas = []; M.arbol = null; M.estado = null; M.arbolAlpha = 0; M.cargando = true; M.error = null; M.dispC = null;
  const p0 = PARES.find((p) => p.id === _par) || PARES[0]; _par = p0.id;
  const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
  const d = document.createElement('div');
  d.id = 'ss-overlay';
  d.innerHTML = `<div class="ss-bg"></div>
    <div class="ss-c">
      <div class="ss-barra">
        <button class="ss-back" id="ss-back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>Back</button>
        <button class="ss-sel" id="ss-sel"><i class="ss-logo" id="ss-logo" data-cg="${esc(p0.cg || '')}" data-ico="${esc(p0.ico || '')}"></i><b id="ss-par">${esc(_par)}</b><span id="ss-nm">${esc(p0.n || '')}</span>${chev}</button>
        <button class="ss-tfchip" id="ss-tfchip" type="button" title="Timeframe"><b id="ss-tfchip-t">${esc(tfDef(M.tf).n)}</b>${chev}</button>
        <div class="ss-px"><div class="ss-px-v" id="ss-px">·</div><div class="ss-hl"><span>H <b id="ss-hi">·</b></span><span>L <b id="ss-lo">·</b></span></div></div>
        <span id="ss-estado" class="ss-estado"></span>
        <div class="ss-der">
          <button class="ss-ico" id="ss-foto" title="Share image"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.5"/></svg></button>
          <button class="ss-ico" id="ss-ayuda" title="How it works">?</button>
        </div>
      </div>
      <div class="ss-graf" id="ss-graf">
        <canvas class="ss-cv" id="ss-cv"></canvas>
        <div class="ss-esperando" id="ss-esperando"><div class="ss-spin"></div><b>Building the multiverse…</b><span>Mapping the probable paths of price on the ${esc(tfDef(M.tf).n)} chart.</span></div>
        <img class="ss-marca" id="ss-marca" src="${LOGO}" alt="">
      </div>
    </div>`;
  document.body.appendChild(d);
  d.querySelector('.ss-bg').onclick = cerrar;
  $('ss-back').onclick = cerrar;
  $('ss-sel').onclick = (e) => { e.stopPropagation(); menuPares(); };
  $('ss-ayuda').onclick = ayuda;
  $('ss-foto').onclick = guardarImagen;
  $('ss-tfchip').onclick = (e) => { e.stopPropagation(); menuTf(); };
  ponerLogos();
  cargarVelas();
  clearInterval(_pulso);
  _pulso = setInterval(() => {
    if (!$('ss-cv')) return;
    if (M.precio > 0) { if (M.dispC == null) M.dispC = M.precio; else M.dispC += (M.precio - M.dispC) * 0.22; }   // easing fluido del precio
    if (M.arbolAlpha < 1) M.arbolAlpha = Math.min(1, M.arbolAlpha + 0.06);   // el árbol aparece suave al recalcularse
    dibujar();
  }, 33);
  let _t = null; M._onResize = () => { clearTimeout(_t); _t = setTimeout(() => { if ($('ss-cv')) dibujar(); }, 200); };
  window.addEventListener('resize', M._onResize);
  discOB(false);
}

/* Disclaimer oficial (sello + aceptación obligatoria). Herramienta de análisis, no consejo. */
function discOB(reView) {
  if (!reView) { try { if (localStorage.getItem('ss-disc-mv1') === '1') return; } catch (_) {} }
  const vieja = $('ss-disc'); if (vieja) vieja.remove();
  const d = document.createElement('div'); d.id = 'ss-disc'; d.className = 'ss-disc' + (reView ? ' rev' : '');
  d.innerHTML = `<div class="ss-disc-bg"></div><div class="ss-disc-c">
    ${reView ? '<button class="ss-disc-x" id="ss-disc-x" aria-label="Close">✕</button>' : ''}
    <img class="ss-disc-sello" src="${DISC_IMG}" alt="">
    <h4>Before you start</h4>
    <p>Multiverse is a <b>probability tool</b>, for information and education only. It reads the current structure, trend, momentum, volume and levels, and draws the paths price <b>could</b> take next as ghost candles, each with an estimated probability. These are <b>statistical projections, not predictions of the future</b>: the ghost candles are not real price, the percentages are modelled estimates that will not always be right, and no path is a promise. Nothing here is financial, investment, legal or tax advice, we make no recommendation to buy or sell, and we do not guarantee any result, profit or performance.</p>
    <p>Every entry, exit and the size of every trade are your own decision and your sole responsibility. The tools are provided as is, without warranty of any kind, and the data comes from third parties (Binance) and may be delayed or incomplete. To the maximum extent permitted by law, DecFreedom, its owners and affiliates accept no liability for any loss or damage arising from the use of this section. By continuing you accept this notice and our Terms and Conditions.</p>
    ${reView ? '' : '<label class="ss-disc-chk"><input type="checkbox" id="ss-disc-agree"><span>I have read and I accept this notice and the Terms and Conditions. I understand these are modelled probabilities, not predictions, that the ghost candles are projections and not real price, that nothing here is guaranteed, and that I trade entirely at my own risk.</span></label>'}
    <button class="ss-disc-ok" id="ss-disc-ok"${reView ? '' : ' disabled'}>${reView ? 'Close' : 'Accept'}</button></div>`;
  document.body.appendChild(d);
  const cerrarD = () => d.remove();
  if (reView) { $('ss-disc-x').onclick = cerrarD; d.querySelector('.ss-disc-bg').onclick = cerrarD; }
  else { d.querySelector('.ss-disc-bg').onclick = (e) => { e.preventDefault(); e.stopPropagation(); };
    const chk = $('ss-disc-agree'), ok = $('ss-disc-ok'); chk.addEventListener('change', () => { if (chk.checked) ok.removeAttribute('disabled'); else ok.setAttribute('disabled', ''); }); }
  $('ss-disc-ok').onclick = () => { if (!reView) { const chk = $('ss-disc-agree'); if (!chk || !chk.checked) return; try { localStorage.setItem('ss-disc-mv1', '1'); } catch (_) {} } cerrarD(); };
}

function cerrar() {
  clearInterval(_reloj); clearInterval(_pulso);
  if (_ssStream) { try { _ssStream.cerrar(); } catch (_) {} _ssStream = null; _ssStreamKey = ''; }
  if (M._onResize) window.removeEventListener('resize', M._onResize);
  if (_barra) { try { _barra.desmontar(); } catch (_) {} _barra = null; }
  document.querySelectorAll('#ss-picker, #ss-tfmenu, #ss-ayuda-box, #ss-disc').forEach((x) => x.remove());
  const e = $('ss-overlay'); if (e) e.remove();
  const sel = $('an-sel'); if (sel) sel.style.display = '';
}

async function cargarVelas() {
  M.cargando = true; M.dispC = null;
  if (_ssStream) { try { _ssStream.cerrar(); } catch (_) {} _ssStream = null; _ssStreamKey = ''; }
  const p = PARES.find((x) => x.id === _par) || {};
  try {
    M.velas = await traerVelasTF(p.s, M.tf);
    M.cargando = false;
    if (M.velas.length) M.precio = M.velas[M.velas.length - 1].c;
    recalcArbol();
    const est = $('ss-estado'); if (est) est.textContent = '';
  } catch (e) { M.cargando = false; M.error = 'feed'; const est = $('ss-estado'); if (est) est.textContent = 'Market data unavailable.'; }
  dibujar();
  clearInterval(_reloj);
  _reloj = setInterval(async () => { try { const v = await traerVelasTF(p.s, M.tf); M.velas = v; if (v.length) M.precio = v[v.length - 1].c; recalcArbol(); dibujar(); } catch (_) {} }, 20000);
  conectarStreamRz();
}

function refrescarCabecera() {
  const px = $('ss-px'), hi = $('ss-hi'), lo = $('ss-lo'); if (!M.velas.length) return;
  const u = M.velas[M.velas.length - 1]; let dH = u.h, dL = u.l; const back = Math.min(M.velas.length, tfPorDia(M.tf));
  for (let k = M.velas.length - back; k < M.velas.length; k++) { if (M.velas[k].h > dH) dH = M.velas[k].h; if (M.velas[k].l < dL) dL = M.velas[k].l; }
  if (px) { px.textContent = fmt(M.precio); px.className = 'ss-px-v ' + (u.c >= u.o ? 'up' : 'down'); }
  if (hi) hi.textContent = fmt(dH); if (lo) lo.textContent = fmt(dL);
}
function tfPorDia(tf) { if (tfDef(tf).sec) return 800; const m = { '1m': 1440, '5m': 288, '15m': 96, '30m': 48, '1h': 24, '2h': 12, '4h': 6, '1d': 1 }; return m[tf] || 120; }

/* ══════════════════ RENDER ══════════════════ */
function pal() { return { fondo: '#0a0e14', rejilla: 'rgba(255,255,255,.04)', ink: '#e7ebf0', dim: '#7d8794' }; }
function dibujar() {
  const cv = $('ss-cv'), zona = $('ss-graf'); if (!cv || !zona) return;
  const W = zona.clientWidth, H = zona.clientHeight; if (W < 50 || H < 50) return;
  if (!cv.dataset.listo) {
    engancharGestos(cv); cv.dataset.listo = '1'; _barra = montarBarra(zona);
    try { N.seccion = 'superscalper'; N.par = _par; cargarDib(); } catch (_) { N.dibujos = N.dibujos || []; }
    import('../../assets/js/orden.js?v=126').then((od) => {
      od.conectar({ canvas: cv, precioEn: (y) => { if (!M._geo) return 0; const { pMin, pMax, y1 } = M._geo; return pMin + (pMax - pMin) * ((y1 - y) / y1); },
        precioActual: () => M.precio > 0 ? M.precio : (M.velas.length ? M.velas[M.velas.length - 1].c : 0), par: () => _par,
        simbolo: () => (PARES.find((p) => p.id === _par) || {}).s || '', repintar: () => dibujar() });
      _od = od; od.clicCancelar(cv, () => _zonasOd, () => dibujar()); dibujar();
    }).catch(() => {});
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = pal(); g.fillStyle = P.fondo; g.fillRect(0, 0, W, H);
  const esp = $('ss-esperando');
  if (M.cargando || !M.velas.length) { if (esp) esp.style.display = ''; return; }
  if (esp) esp.style.display = 'none';

  const mDer = 66, mAba = 22, yTime = H - mAba;
  const x1 = W - mDer, y1 = yTime, xVelas = Math.round(x1 * (1 - FUT));   // velas reales a la izquierda; derecha = proyección futura
  const ancho = Math.min(M.velas.length, M.ancho || 120);
  const huecoMax = Math.floor(ancho * 0.5);
  let desp = Math.max(-huecoMax, Math.min(M.desplaz || 0, Math.max(0, M.velas.length - ancho))); M.desplaz = desp;
  const fin = M.velas.length - desp, vis = M.velas.slice(Math.max(0, fin - ancho), Math.min(M.velas.length, fin));
  if (!vis.length) return;
  const pc = (M.dispC != null && M.dispC > 0) ? M.dispC : M.precio;
  if (desp <= 0 && pc > 0) { const u = vis[vis.length - 1]; u.c = pc; if (pc > u.h) u.h = pc; if (pc < u.l) u.l = pc; }
  let pAlto = Math.max(...vis.map((v) => v.h)), pBajo = Math.min(...vis.map((v) => v.l));
  if (pc > 0) { pAlto = Math.max(pAlto, pc); pBajo = Math.min(pBajo, pc); }
  // incluye el árbol en el rango vertical, acotado a ±3.2 ATR para que no aplane la vista
  if (M.arbol && M.estado && desp <= 0) { const a = M.estado.a || (pAlto - pBajo) * 0.1, th = M.arbol.hiP != null ? M.arbol.hiP : M.arbol.hi, tl = M.arbol.loP != null ? M.arbol.loP : M.arbol.lo;
    pAlto = Math.max(pAlto, Math.min(th, pc + a * 4)); pBajo = Math.min(pBajo, Math.max(tl, pc - a * 4)); }
  const rangoB = (pAlto - pBajo) || 1, despY = ((M.offsetY || 0) / Math.max(1, y1)) * rangoB;
  const centro = (pAlto + pBajo) / 2 + despY, semi = (rangoB / 2) * (M.zoomY || 1), pad = semi * 0.14 || 1;
  const pMax = centro + semi + pad, pMin = centro - semi - pad;
  const Y = (p) => y1 - y1 * ((p - pMin) / Math.max(1e-12, pMax - pMin));
  const paso = xVelas / (ancho || vis.length), pri = fin - ancho;
  const Xbar = (barIdx) => (barIdx - pri) * paso + paso / 2;
  M._geo = { pMin, pMax, y1, xVelas, x1, n: vis.length, vis, paso, pri, fin, ancho };

  if (_od) _zonasOd = _od.pintar(g, { x1, Y, pMin, pMax, simbolo: (PARES.find((p) => p.id === _par) || {}).s || '' });
  g.strokeStyle = P.rejilla; g.lineWidth = 1;
  for (let i = 1; i < 6; i++) { const y = (y1 / 6) * i; g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); }

  dibujarVelas(g, vis, Y, paso);
  g.save(); g.strokeStyle = 'rgba(232,184,75,.26)'; g.lineWidth = 1; g.setLineDash([2, 4]);   // divisoria "ahora"
  g.beginPath(); g.moveTo(xVelas, 0); g.lineTo(xVelas, y1); g.stroke(); g.restore(); g.setLineDash([]);
  dibujarArbol(g, Y, Xbar, xVelas, x1, y1, pc);          // árbol de realidades en velas fantasma

  if (pc > 0) {
    const yp = Y(pc); g.strokeStyle = 'rgba(232,184,75,.5)'; g.lineWidth = 1; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(0, yp); g.lineTo(x1, yp); g.stroke(); g.setLineDash([]);
    const u = M.velas[M.velas.length - 1], col = pc >= u.o ? '#2ee86a' : '#ff5b6e';
    g.fillStyle = col; redondeado(g, x1 + 2, yp - 9, mDer - 4, 18, 4); g.fill();
    g.fillStyle = '#071018'; g.font = 'bold 10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(fmt(pc), x1 + 6, yp + 3.5);
  }
  g.fillStyle = pal().dim; g.font = '10px ui-monospace,monospace'; g.textAlign = 'left';
  for (let i = 0; i <= 5; i++) { const y = (y1 / 5) * i, pr = pMax - (pMax - pMin) * (i / 5); g.fillText(fmt(pr), x1 + 6, y + (i === 0 ? 10 : i === 5 ? -3 : 3)); }
  g.fillStyle = '#0b0e12'; g.fillRect(0, yTime, W, mAba);
  g.fillStyle = pal().dim; g.font = '9px ui-monospace,monospace'; g.textAlign = 'center';
  const cadaX = Math.max(1, Math.floor(vis.length / 7));
  vis.forEach((v, i) => { if (i % cadaX !== 0) return; const x = i * paso + paso / 2; if (x > xVelas - 14) return; g.fillText(fmtFecha(v.t), x, yTime + 14); });
  g.textAlign = 'left';
  dibujarPanel(g);

  if (M._cursor && M._cursor.x < x1 && M._cursor.y < y1 && M._cursor.x > 0 && M._cursor.y > 0) {
    const cx = M._cursor.x, cy = M._cursor.y, pCur = pMin + (pMax - pMin) * ((y1 - cy) / y1);
    g.save(); g.strokeStyle = 'rgba(200,210,224,.4)'; g.lineWidth = 1; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, yTime); g.stroke(); g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke(); g.restore(); g.setLineDash([]);
    g.fillStyle = '#e8ecf2'; redondeado(g, x1 + 2, cy - 9, mDer - 4, 18, 4); g.fill();
    g.fillStyle = '#0b0e12'; g.font = 'bold 10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(fmt(pCur), x1 + 6, cy + 3.5);
  }
  refrescarCabecera();
  if (_barra && M._geo) _barra.redibujar({ W, H, x1: xVelas, y1, pMin, pMax, Y, ancho, paso, fin }, M.velas, _par);
}

function dibujarVelas(g, vis, Y, paso) {
  const w = Math.max(1, paso * 0.62);
  for (let i = 0; i < vis.length; i++) {
    const c = vis[i], x = i * paso + paso / 2, sube = c.c >= c.o, col = sube ? '#26d46a' : '#ff5162';
    g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x, Y(c.h)); g.lineTo(x, Y(c.l)); g.stroke();
    const yO = Y(c.o), yC = Y(c.c); g.fillStyle = col; g.fillRect(x - w / 2, Math.min(yO, yC), w, Math.max(1, Math.abs(yC - yO)));
  }
}

/* ══ Árbol de realidades: velas fantasma proyectadas al futuro, con el flujo de iluminación
   de Huehua Pro por dentro. Ramas probables = más brillantes y gruesas; improbables, tenues. ══ */
function velaFantasma(g, x, w, v, Y, rgb, hi, alpha, lw, aF, now) {
  const yO = Y(v.o), yC = Y(v.c), top = Math.min(yO, yC), hB = Math.max(1.6, Math.abs(yC - yO));
  g.strokeStyle = `rgba(${rgb},${(alpha * 0.9).toFixed(3)})`; g.lineWidth = lw;
  g.beginPath(); g.moveTo(x, Y(v.h)); g.lineTo(x, Y(v.l)); g.stroke();                       // mecha
  g.fillStyle = `rgba(${rgb},${(0.05 * alpha + 0.02).toFixed(3)})`; g.fillRect(x - w / 2, top, w, hB); // cuerpo hueco translúcido
  g.strokeRect(x - w / 2, top, w, hB);                                                        // contorno
  if (aF > 0.12) {                                                                            // flujo de iluminación (Huehua Pro)
    const sweep = (now % 2600) / 2600, grd = g.createLinearGradient(0, top, 0, top + hB);
    for (let k = 0; k <= 6; k++) { const p = k / 6, b = 0.5 + 0.5 * Math.cos((p - sweep) * Math.PI * 4); grd.addColorStop(p, `rgba(${hi},${(0.02 + 0.10 * b * aF).toFixed(3)})`); }
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grd; g.fillRect(x - w / 2, top, w, hB); g.restore();
  }
}
function dibujarArbol(g, Y, Xbar, xVelas, x1, y1) {
  const A = M.arbol, geo = M._geo; if (!A || !geo || !A.raiz) return;
  const now = Date.now(), paso = geo.paso || 8, gA = M.arbolAlpha, futW = x1 - xVelas;
  const pasoF = clamp(futW * 0.82 / (ARB.gen * ARB.seg), paso * 1.15, paso * 2.8), w = Math.max(2, pasoF * 0.5);
  const raiz = A.raiz.bar0, xF = (bar) => xVelas + (bar - raiz + 0.5) * pasoF;                // paso propio de la proyección (más ancho, separa las ramas)
  g.save(); g.beginPath(); g.rect(xVelas - 1, 0, x1 - xVelas + 2, y1); g.clip();              // dibuja solo en la zona futura
  for (const nodo of A.nodos) {                                                               // esqueleto: línea close a close de cada rama (hace legible el árbol)
    const aF = clamp(nodo.cumP, 0, 1), al = (0.10 + 0.6 * Math.sqrt(aF)) * gA; if (al < 0.04) continue;
    const sube = nodo.pFin >= nodo.pIni, rgb = sube ? COL.bull : COL.bear;
    g.beginPath(); g.moveTo(xF(nodo.bar0) - pasoF / 2, Y(nodo.pIni));
    for (let j = 0; j < nodo.velas.length; j++) g.lineTo(xF(nodo.bar0 + j), Y(nodo.velas[j].c));
    g.strokeStyle = `rgba(${rgb},${(al * 0.5).toFixed(3)})`; g.lineWidth = 1 + 1.8 * aF; g.stroke();
  }
  for (const nodo of A.nodos) {                                                               // velas fantasma: de improbable a probable (brillantes encima)
    const aF = clamp(nodo.cumP, 0, 1), alpha = (0.14 + 0.72 * Math.sqrt(aF)) * gA; if (alpha < 0.04) continue;
    const lw = 1 + 1.5 * aF;
    for (let j = 0; j < nodo.velas.length; j++) {
      const x = xF(nodo.bar0 + j); if (x < xVelas - 2 || x > x1 + 2) continue;
      const v = nodo.velas[j], sube = v.c >= v.o, rgb = sube ? COL.bull : COL.bear, hi = sube ? '150,255,195' : '255,150,170';
      velaFantasma(g, x, w, v, Y, rgb, hi, alpha, lw, aF, now);
    }
  }
  g.restore();
  g.save(); g.textAlign = 'left';                                                             // % de los escenarios y acumulado de rutas
  for (const n of A.nodos) { if (n.prof !== 1) continue;
    const sube = n.pFin >= n.pIni, rgb = sube ? COL.bull : COL.bear, x = xF(n.bar0 + Math.floor(n.velas.length / 2)), y = Y(n.pFin) + (sube ? -10 : 18);
    etqProb(g, x, y, Math.round(n.cond * 100) + '%', rgb, 0.92 * gA, true);
  }
  const hojas = A.nodos.filter((n) => !n.esPadre && n.cumP > 0.05).sort((a, b) => b.cumP - a.cumP).slice(0, 7);
  for (const n of hojas) {
    const sube = n.pFin >= A.px, rgb = sube ? COL.bull : COL.bear, x = Math.min(x1 - 24, xF(n.bar0 + n.velas.length - 1) + 5), y = Y(n.pFin);
    etqProb(g, x, y, Math.round(n.cumP * 100) + '%', rgb, (0.4 + 0.6 * clamp(n.cumP, 0, 1)) * gA, false);
  }
  g.restore(); g.textAlign = 'left';
}
function etqProb(g, x, y, txt, rgb, alpha, fuerte) {
  if (alpha < 0.05) return; g.globalAlpha = Math.min(1, alpha);
  g.font = (fuerte ? '900 11px ' : '800 10px ') + 'system-ui,sans-serif'; const tw = g.measureText(txt).width, pw = tw + 12, ph = fuerte ? 17 : 15, yy = y - ph + 3;
  g.fillStyle = 'rgba(10,14,20,.78)'; redondeado(g, x - 2, yy, pw, ph, 6); g.fill();
  g.strokeStyle = `rgba(${rgb},${fuerte ? 0.8 : 0.5})`; g.lineWidth = 1; redondeado(g, x - 2, yy, pw, ph, 6); g.stroke();
  g.fillStyle = `rgb(${rgb})`; g.fillText(txt, x + 4, yy + ph - 4.5); g.globalAlpha = 1;
}
/* Panel (arriba-izquierda): identidad + sesgo de probabilidad al alza/baja + aviso. */
function dibujarPanel(g) {
  const A = M.arbol; const bx = 12, by = 12, bw = 252, bh = 66;
  g.save(); g.textAlign = 'left';
  g.fillStyle = 'rgba(12,16,23,.86)'; redondeado(g, bx, by, bw, bh, 12); g.fill();
  g.strokeStyle = 'rgba(232,184,75,.22)'; g.lineWidth = 1; redondeado(g, bx, by, bw, bh, 12); g.stroke();
  g.fillStyle = `rgb(${COL.gold})`; g.font = '900 13px system-ui,sans-serif'; g.fillText('MULTIVERSE', bx + 13, by + 22);
  g.fillStyle = '#7d8794'; g.font = '600 9px system-ui,sans-serif'; g.fillText('probability tree', bx + 104, by + 21);
  let netW = 0, mass = 0; if (A) for (const n of A.nodos) if (!n.esPadre) { mass += n.cumP; netW += n.cumP * (n.pFin >= A.px ? 1 : -1); }
  const lean = mass > 0 ? netW / mass : 0, upP = clamp(0.5 + 0.5 * lean, 0.08, 0.92), dnP = 1 - upP;
  const bxx = bx + 13, bww = bw - 26, byy = by + 32, bhh = 11;
  g.fillStyle = `rgba(${COL.bear},.9)`; redondeado(g, bxx, byy, bww, bhh, 5); g.fill();
  if (upP > 0.01) { g.fillStyle = `rgba(${COL.bull},.95)`; redondeado(g, bxx, byy, Math.max(bhh, bww * upP), bhh, 5); g.fill(); }
  g.fillStyle = '#eef2f6'; g.font = '800 9px system-ui,sans-serif'; g.fillText('UP ' + Math.round(upP * 100) + '%', bxx + 5, byy + 9);
  g.textAlign = 'right'; g.fillText(Math.round(dnP * 100) + '% DOWN', bxx + bww - 5, byy + 9); g.textAlign = 'left';
  g.fillStyle = '#6b7681'; g.font = '600 9px system-ui,sans-serif'; g.fillText('Modelled odds, not a prediction', bx + 13, by + 58);
  g.restore(); g.textAlign = 'left';
}
function redondeado(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ══════════════════ GESTOS ══════════════════ */
function engancharGestos(cv) {
  const zoom = (f) => { const maxA = Math.max(60, (M.velas.length || 800) - 2); M.ancho = Math.max(20, Math.min(maxA, Math.round((M.ancho || 120) * f))); dibujar(); };
  let ax = 0, ay = 0, arr = false, dragEsc = false, dragX = false;
  const enEscala = (x) => x > cv.clientWidth - 66, enEjeX = (x, y) => y > cv.clientHeight - 24 && x < cv.clientWidth - 66;
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  cv.addEventListener('mousedown', (e) => { const r = cv.getBoundingClientRect(), lx = e.clientX - r.left, ly = e.clientY - r.top; ax = lx; ay = ly; dragEsc = enEscala(lx); dragX = !dragEsc && enEjeX(lx, ly); arr = true; cv.style.cursor = dragX ? 'ew-resize' : (dragEsc ? 'ns-resize' : 'grabbing'); });
  window.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; M._cursor = { x, y };
    if (!arr) { cv.style.cursor = enEscala(x) ? 'ns-resize' : (enEjeX(x, y) ? 'ew-resize' : 'crosshair'); return; }
    if (dragEsc) { const dy = y - ay; if (Math.abs(dy) > 1) { M.zoomY = Math.max(0.2, Math.min(6, (M.zoomY || 1) * (1 + dy * 0.004))); ay = y; dibujar(); } return; }
    if (dragX) { const dxx = x - ax; if (Math.abs(dxx) > 2) { const maxA = Math.max(60, (M.velas.length || 800) - 2); M.ancho = Math.max(20, Math.min(maxA, Math.round((M.ancho || 120) * (1 + dxx * 0.006)))); ax = x; dibujar(); } return; }
    const paso = M._geo ? M._geo.paso : 8, dx = x - ax, dy = y - ay;
    if (Math.abs(dx) > paso) { M.desplaz = (M.desplaz || 0) + Math.round(dx / paso); ax = x; }
    M.offsetY = (M.offsetY || 0) + dy; ay = y; dibujar();
  });
  window.addEventListener('mouseup', () => { arr = false; dragEsc = false; dragX = false; cv.style.cursor = 'crosshair'; });
  cv.addEventListener('mouseleave', () => { M._cursor = null; dibujar(); });
  cv.addEventListener('dblclick', () => { M.ancho = window.innerWidth < 760 ? 56 : 84; M.desplaz = 0; M.zoomY = 1; M.offsetY = 0; dibujar(); });
}

/* ══════════════════ SELECTORES ══════════════════ */
const grupoNm = { cripto: 'Crypto', divisa: 'Forex', materia: 'Commodities' };
function menuPares() {
  if ($('ss-picker')) { $('ss-picker').remove(); return; }
  const ancla = $('ss-sel'); const m = document.createElement('div'); m.id = 'ss-picker'; m.className = 'ss-pop';
  const grupos = {}; PARES.forEach((p) => { (grupos[p.grupo || 'cripto'] = grupos[p.grupo || 'cripto'] || []).push(p); });
  let html = '<div class="ss-cm-top"><input id="ss-cm-q" placeholder="Filter…" autocomplete="off"></div><div class="ss-cm-list">';
  ['cripto', 'divisa', 'materia'].forEach((gr) => { if (!grupos[gr]) return; html += `<div class="ss-cm-cat">${grupoNm[gr]}</div>` + grupos[gr].map((p) => `<button class="ss-cm-it ${p.id === _par ? 'on' : ''}" data-id="${esc(p.id)}" data-b="${esc((p.id + ' ' + (p.n || '')).toLowerCase())}"><i class="ss-mini" data-cg="${esc(p.cg || '')}" data-ico="${esc(p.ico || '')}"></i><b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`).join(''); });
  html += '</div>'; m.innerHTML = html; document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, r.left) + 'px';
  ponerLogos(m);
  m.querySelectorAll('.ss-cm-it').forEach((b) => b.onclick = () => { const id = b.dataset.id; m.remove(); if (id !== _par) { _par = id; const p = PARES.find((x) => x.id === id) || {}; const lg = $('ss-logo'); if (lg) { lg.dataset.cg = p.cg || ''; lg.dataset.ico = p.ico || ''; } $('ss-par').textContent = id; $('ss-nm').textContent = p.n || ''; ponerLogos(); cargarVelas(); } });
  const q = m.querySelector('#ss-cm-q'); q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); m.querySelectorAll('.ss-cm-it').forEach((b) => b.style.display = (!v || b.dataset.b.includes(v)) ? '' : 'none'); });
  setTimeout(() => q.focus(), 30);
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function menuTf() {
  if ($('ss-tfmenu')) { $('ss-tfmenu').remove(); return; }
  const ancla = $('ss-tfchip'); const m = document.createElement('div'); m.id = 'ss-tfmenu'; m.className = 'ss-pop ss-tfpop';
  m.innerHTML = SS_TFS.map((t) => `<button class="ss-tf-it ${t.id === M.tf ? 'on' : ''}" data-tf="${t.id}">${esc(t.n)}</button>`).join('');
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(), w = m.offsetWidth || 210; m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
  m.querySelectorAll('.ss-tf-it').forEach((b) => b.onclick = () => { M.tf = b.dataset.tf; $('ss-tfchip-t').textContent = (SS_TFS.find((t) => t.id === M.tf) || {}).n || M.tf; m.remove(); cargarVelas(); });
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function ponerLogos(root) {
  (root || document).querySelectorAll('.ss-logo, .ss-mini').forEach((el) => { const cg = el.dataset.cg, ico = el.dataset.ico; el.style.backgroundImage = '';
    if (ico) { pintarIcono(el); return; }
    if (cg && window.__aurexLogos && window.__aurexLogos[cg]) { el.style.backgroundImage = `url(${window.__aurexLogos[cg]})`; el.classList.add('con'); el.textContent = ''; return; }
    el.textContent = (el.closest('[data-id]')?.dataset.id || _par || '?')[0]; });
  cargarLogosCache(root);
}
let _logosFetch = null;
function asegurarLogos() {
  if (window.__aurexLogos && Object.keys(window.__aurexLogos).length) return Promise.resolve();
  try { const g = JSON.parse(localStorage.getItem('aurex-logos') || 'null'); if (g && g.datos && Object.keys(g.datos).length) { window.__aurexLogos = g.datos; return Promise.resolve(); } } catch (_) {}
  if (!_logosFetch) { const ids = PARES.filter((p) => p.cg).map((p) => p.cg).join(',');
    _logosFetch = fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=250&page=1`).then((r) => r.json()).then((j) => { const m = {}; j.forEach((x) => { m[x.id] = x.image; }); window.__aurexLogos = m; try { localStorage.setItem('aurex-logos', JSON.stringify({ cuando: Date.now(), datos: m })); } catch (_) {} }).catch(() => { window.__aurexLogos = window.__aurexLogos || {}; }); }
  return _logosFetch;
}
function cargarLogosCache(root) { asegurarLogos().then(() => aplicarLogos(root)); }
function aplicarLogos(root) { if (!window.__aurexLogos) return; (root || document).querySelectorAll('.ss-logo, .ss-mini').forEach((el) => { if (el.dataset.ico) return; const cg = el.dataset.cg, url = cg && window.__aurexLogos[cg]; if (url) { el.style.backgroundImage = `url(${url})`; el.classList.add('con'); el.textContent = ''; } }); }

/* ══════════════════ EXPORT (logo en el pie) ══════════════════ */
function guardarImagen() {
  const cv = $('ss-cv'); if (!cv) return;
  const marca = $('ss-marca'); const antes = marca ? marca.style.display : null; if (marca) marca.style.display = 'none';
  const devolver = () => { if (marca) marca.style.display = antes || ''; };
  try {
    const e2 = cv.width / cv.clientWidth, barra = 78 * e2;
    const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height + barra;
    const g = out.getContext('2d'); g.fillStyle = '#0a0e14'; g.fillRect(0, 0, out.width, out.height); g.drawImage(cv, 0, 0);
    const yB = cv.height; g.fillStyle = '#0b0e12'; g.fillRect(0, yB, out.width, barra); g.fillStyle = 'rgba(232,184,75,.35)'; g.fillRect(0, yB, out.width, 2 * e2);
    const textos = (x) => {
      g.textAlign = 'left'; g.fillStyle = '#E8B84B'; g.font = `800 ${19 * e2}px system-ui,sans-serif`; g.fillText('Multiverse', x, yB + 34 * e2);
      g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillStyle = '#C9A84B'; g.fillText(WEB, x, yB + 56 * e2);
      g.textAlign = 'right'; g.fillStyle = '#8b96a3'; g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillText(`${_par} · ${M.tf}`, out.width - 20 * e2, yB + 34 * e2);
      g.font = `${11 * e2}px ui-monospace,monospace`; g.fillStyle = '#6b7681'; g.fillText(new Date().toLocaleString('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), out.width - 20 * e2, yB + 56 * e2);
      g.textAlign = 'left';
    };
    const bajar = () => out.toBlob((blob) => { devolver(); if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `decfreedom-multiverse-${_par}-${Date.now()}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }, 'image/png');
    const logo = new Image(); let hecho = false;
    const una = (w) => { if (hecho) return; hecho = true; textos(w ? 20 * e2 + w + 18 * e2 : 20 * e2); bajar(); };
    logo.onload = () => { try { const alto = 52 * e2, ancho = Math.round(logo.width * (alto / logo.height)); g.drawImage(logo, 20 * e2, yB + (barra - alto) / 2, ancho, alto); una(ancho); } catch (_) { una(0); } };
    logo.onerror = () => una(0); setTimeout(() => una(0), 1500); logo.src = LOGO;
  } catch (_) { devolver(); }
}

/* ══════════════════ AYUDA (guía interactiva, 8 componentes reales) ══════════════════ */
const PASOS_RZ = [
  { t: 'Fractal Cycles', d: 'Price moves in <b>cycles</b>, and those cycles are <b>fractal</b>: the same shapes, impulses, pullbacks, ranges and turns, repeat on every timeframe. Multiverse reads the structure of the current cycle and projects where price could go next. Because it works on structure, it runs the same on 1 second or 1 day, just change the timeframe.', x: 'The tool does not predict the future. It maps what tends to happen next when the chart looks like it does now.' },
  { t: 'Five Analyzers', d: 'Five measurable readings drive everything: <b>trend</b> (the bias of the last 50 to 200 candles), <b>momentum and exhaustion</b> (how stretched the move is), <b>volume and range</b> (whether fuel is entering a quiet market), <b>levels</b> (supports and resistances), and <b>market structure</b> (impulses, pullbacks and ranges). You never see them directly, they set the odds.', x: 'Every percentage on the chart comes from these five, measured live, not from an opinion.' },
  { t: 'Ghost Candles', d: 'The possible futures are drawn as <b>ghost candles</b>: hollow, translucent candles with a flowing inner light. They are deliberately not solid, so you never confuse a projection with real price. The lit flow and brightness show how alive and how probable a path is.', x: 'Ghost candles are a drawing of a scenario, not a quote. Nothing to their right has happened yet.' },
  { t: 'The Tree of Realities', d: 'From the current price the tool branches into scenarios, and <b>each scenario branches again</b>, generation after generation, like a multiverse. A move can continue, pull back and continue, reverse, range, or break a level and retest it. The result is a fan of possible paths over the same future time.', x: 'It is not three fixed scenarios. It is a living tree of what could unfold, step by step.' },
  { t: 'Reading the Probabilities', d: 'Every branch carries a <b>probability</b>, and every full route carries an <b>accumulated probability</b> (the product along the path). The <b>brighter and thicker</b> a branch, the more likely it is; faint branches are long shots. The panel sums it all into a simple <b>upside vs downside</b> lean.', x: 'A 70% branch is not a promise. It means that, on this structure, roughly seven times in ten price tends this way.' },
  { t: 'Branching Rules', d: 'The branches follow real market logic. After an impulse up, price may <b>range and continue</b> or <b>pull back to support and continue</b>. It rises until the <b>next resistance</b>, where it either rejects and falls or <b>breaks and retests</b>. A pullback can reach 30%, 50% or a support, and from there hold the trend or flip, depending on <b>volume</b>. The same applies inverted to the downside.', x: 'The tool is encoding how price usually behaves around structure, not guessing at random.' },
  { t: 'Living and Real Time', d: 'The tree is <b>not fixed</b>. On every new candle it recomputes from fresh structure, volume and levels, so paths that stop making sense <b>fade</b> and new ones appear. Zoom, drag and zoom out to see the whole scheme. The inner light keeps flowing so you can feel which paths are active now.', x: 'What you see is the current best map. A minute later, with new data, the map can change.' },
  { t: 'How to Use It', d: 'Read the <b>dominant lean</b> and the <b>brightest routes</b>, then make your own decision with your own risk. Treat a high probability as an edge over many trades, not a certainty on the next one, and always plan for the paths that did not light up. This is a <b>probability tool</b>, not a promise of any result.', x: 'The map improves your odds of deciding well. It never removes the risk. Risk only what you can lose.' }
];
let _pasoRZ = 0;
function ayuda() {
  if ($('ss-ayuda-box')) { $('ss-ayuda-box').remove(); return; }
  _pasoRZ = 0;
  const d = document.createElement('div'); d.id = 'ss-ayuda-box';
  d.innerHTML = `<div class="ss-ab-bg"></div><div class="ss-ab-c"><button class="ss-ab-x" aria-label="Close">✕</button><div class="ss-ab-eyebrow">Multiverse · How it works</div><div id="ss-ab-cuerpo"></div><div class="ss-ab-legal"><button class="ss-disc-link" id="ss-disc-link" type="button">Disclaimer</button></div></div>`;
  document.body.appendChild(d);
  const q = () => d.remove(); d.querySelector('.ss-ab-bg').onclick = q; d.querySelector('.ss-ab-x').onclick = q; $('ss-disc-link').onclick = () => discOB(true);
  pintarPasoRZ();
}
function pintarPasoRZ() {
  const c = $('ss-ab-cuerpo'); if (!c) return; const p = PASOS_RZ[_pasoRZ], ultimo = _pasoRZ === PASOS_RZ.length - 1;
  c.innerHTML = `<div class="ss-ab-card"><div class="ss-ab-n">${_pasoRZ + 1} <em>of ${PASOS_RZ.length}</em></div><div class="ss-ab-t">${p.t}</div><div class="ss-ab-d">${p.d}</div><div class="ss-ab-x2">${p.x}</div></div>
    <div class="ss-ab-dots">${PASOS_RZ.map((_, i) => `<i class="${i === _pasoRZ ? 'on' : ''}" data-paso="${i}"></i>`).join('')}</div>
    <div class="ss-ab-acts">${_pasoRZ > 0 ? '<button class="ss-ab-back" id="ss-ab-back">Back</button>' : ''}<button class="ss-ab-next" id="ss-ab-next">${ultimo ? 'Got it' : 'Learn more'}</button></div>`;
  $('ss-ab-next').onclick = () => { if (_pasoRZ >= PASOS_RZ.length - 1) { $('ss-ayuda-box')?.remove(); return; } _pasoRZ++; pintarPasoRZ(); };
  const at = $('ss-ab-back'); if (at) at.onclick = () => { _pasoRZ = Math.max(0, _pasoRZ - 1); pintarPasoRZ(); };
  c.querySelectorAll('[data-paso]').forEach((b) => b.onclick = () => { _pasoRZ = Number(b.dataset.paso); pintarPasoRZ(); });
}

/* ══════════════════ ESTILOS ══════════════════ */
let _css = false;
function estilos() { if (_css || $('ss-css')) { _css = true; return; } _css = true; const s = document.createElement('style'); s.id = 'ss-css'; s.textContent = CSS; document.head.appendChild(s); }
const CSS = `
#ss-overlay{position:fixed;inset:0;z-index:9740;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#e7ebf0;--g:#28d26a;--r:#ff4a5a;--gold:#E8B84B;--line:#1d2630;--mono:"Chakra Petch",ui-monospace,monospace}
#ss-overlay *{box-sizing:border-box}
.ss-bg{position:absolute;inset:0;background:radial-gradient(1100px 560px at 80% -10%,rgba(232,184,75,.04),transparent 60%),#070b10}
.ss-c{position:relative;width:100%;height:100%;display:flex;flex-direction:column}
.ss-barra{display:flex;align-items:center;gap:10px;height:54px;flex:0 0 auto;padding:0 12px;background:linear-gradient(180deg,#0e141b,#090d12);border-bottom:1px solid var(--line)}
.ss-back{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px 0 10px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#c3cad3;cursor:pointer;font-weight:700;font-size:13px}
.ss-back svg{width:14px;height:14px}
.ss-back:hover{border-color:var(--gold);color:var(--gold)}
.ss-sel{display:inline-flex;align-items:center;gap:9px;height:38px;padding:0 11px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#e7ebf0;cursor:pointer}
.ss-sel:hover{border-color:var(--gold)}
.ss-sel b{font-family:var(--mono);font-weight:800;font-size:14px}
.ss-sel span{color:#7d8794;font-size:12.5px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-sel svg{width:11px;height:11px;color:#7d8794}
.ss-logo,.ss-mini{flex:0 0 auto;border-radius:50%;background:#1b222c center/cover no-repeat;display:grid;place-items:center;font-family:var(--mono);font-weight:800;color:var(--gold);border:1px solid #2a333f;overflow:hidden}
.ss-logo{width:24px;height:24px;font-size:11px}.ss-mini{width:19px;height:19px;font-size:9px}
.ss-logo.con,.ss-mini.con{border-color:transparent;color:transparent}
.ss-tfchip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:11px;background:#12161c;border:1px solid #2b3139;color:#eaecef;cursor:pointer;font-family:var(--mono);font-weight:800;font-size:13.5px}
.ss-tfchip svg{width:12px;height:12px;color:#8b96a3}.ss-tfchip:hover{border-color:var(--gold)}
.ss-px{display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:84px}
.ss-px-v{font-family:var(--mono);font-weight:800;font-size:18px;line-height:1}.ss-px-v.up{color:var(--g)}.ss-px-v.down{color:var(--r)}
.ss-hl{display:flex;gap:10px;font-family:var(--mono);font-size:10px;color:#7d8794}
.ss-hl b{font-weight:800}.ss-hl span:first-child b{color:var(--g)}.ss-hl span:last-child b{color:var(--r)}
.ss-estado{font-family:var(--mono);font-size:11px;color:var(--r)}
.ss-der{display:flex;align-items:center;gap:9px;margin-left:auto}
.ss-ico{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#9aa4af;font-weight:800}
.ss-ico:hover{border-color:var(--gold);color:var(--gold)}
.ss-graf{flex:1 1 auto;min-height:0;position:relative;background:#0a0e14}
.ss-cv{display:block;position:absolute;inset:0}
.ss-marca{position:absolute;left:64px;bottom:40px;z-index:4;height:42px;width:auto;opacity:.82;pointer-events:none;display:flex;align-items:center;filter:drop-shadow(0 2px 9px rgba(0,0,0,.95))}
@media(max-width:620px){.ss-marca{left:58px;bottom:30px;height:32px}}
.ss-esperando{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:30px;background:rgba(10,14,20,.6);z-index:2}
.ss-esperando b{font-family:var(--mono);font-size:14px;color:#cbd3dc}.ss-esperando span{font-size:12px;color:#7d8794;max-width:300px}
.ss-spin{width:30px;height:30px;border:2.5px solid rgba(232,184,75,.2);border-top-color:var(--gold);border-radius:50%;animation:ss-sp .8s linear infinite}
@keyframes ss-sp{to{transform:rotate(360deg)}}
.ss-pop{position:fixed;z-index:10050;background:#0c1016;border:1px solid #2a333f;border-radius:12px;box-shadow:0 20px 55px rgba(0,0,0,.65);font-family:var(--mono);color:#e7ebf0}
#ss-picker{width:300px;max-height:70vh;display:flex;flex-direction:column;overflow:hidden}
.ss-cm-top{padding:8px;border-bottom:1px solid var(--line)}
.ss-cm-top input{width:100%;height:32px;border-radius:8px;border:1px solid #2a333f;background:#0a0d12;color:#e7ebf0;padding:0 11px;font-size:12.5px;font-family:var(--mono);outline:none}
.ss-cm-top input:focus{border-color:var(--gold)}
.ss-cm-list{overflow-y:auto;padding:6px}
.ss-cm-cat{font-size:9px;letter-spacing:.14em;color:var(--gold);text-transform:uppercase;padding:8px 8px 4px}
.ss-cm-it{display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 9px;border-radius:8px;border:0;background:transparent;color:#e7ebf0;cursor:pointer;text-align:left;font-size:13px}
.ss-cm-it:hover{background:rgba(232,184,75,.1)}.ss-cm-it.on{background:rgba(232,184,75,.16)}
.ss-cm-it b{font-family:var(--mono);min-width:50px;color:var(--gold);font-weight:800}
.ss-cm-it span{color:#7d8794;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-tfpop{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:6px;min-width:210px;background:#12161c;border-color:#2b3139;border-radius:14px}
.ss-tf-it{min-height:42px;border-radius:10px;border:1px solid transparent;background:rgba(255,255,255,.04);color:#c7cdd6;cursor:pointer;font-family:var(--mono);font-size:13px;font-weight:700}
.ss-tf-it:hover{border-color:#3a424c;color:#eaecef}
.ss-tf-it.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;border-color:var(--gold)}
#ss-ayuda-box{position:fixed;inset:0;z-index:10300;display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Plus Jakarta Sans",system-ui,sans-serif}
.ss-ab-bg{position:absolute;inset:0;background:rgba(3,5,8,.93)}
.ss-ab-c{position:relative;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid #C9A84B;border-radius:20px;padding:24px 20px}
.ss-ab-x{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;padding:0;cursor:pointer;font-size:15px;z-index:5;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6}
.ss-ab-eyebrow{font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:2px;text-align:center;margin-bottom:18px}
.ss-ab-card{padding:24px 20px;border-radius:16px;text-align:center;margin-bottom:18px;background:linear-gradient(165deg,rgba(232,184,75,.08),rgba(255,255,255,.015));border:1px solid rgba(232,184,75,.26)}
.ss-ab-n{font-family:var(--mono);font-size:11px;color:var(--gold);font-weight:700;margin-bottom:10px}.ss-ab-n em{font-style:normal;color:#5c6672;font-weight:400}
.ss-ab-t{font-weight:800;font-size:21px;color:#eaecef;margin-bottom:12px;line-height:1.25}
.ss-ab-d{font-size:14px;color:#b7bdc6;line-height:1.65;margin-bottom:14px}.ss-ab-d b{color:var(--gold);font-weight:700}
.ss-ab-x2{padding:12px 14px;border-radius:11px;background:rgba(255,255,255,.035);border-left:2px solid #C9A84B;font-size:12.5px;color:#8b96a3;line-height:1.55;text-align:left}
.ss-ab-dots{display:flex;gap:5px;justify-content:center;margin-bottom:18px;flex-wrap:wrap}
.ss-ab-dots i{width:7px;height:7px;border-radius:50%;background:#2b3139;cursor:pointer;transition:background .18s,transform .18s}.ss-ab-dots i.on{background:var(--gold);transform:scale(1.35)}
.ss-ab-acts{display:flex;gap:9px}
.ss-ab-back{flex:0 0 auto;min-height:48px;padding:0 20px;border-radius:12px;background:transparent;border:1px solid #2b3139;color:#8b96a3;cursor:pointer;font-weight:700;font-size:13px}
.ss-ab-back:hover{border-color:#3a424c;color:#b7bdc6}
.ss-ab-next{flex:1;min-height:48px;border-radius:12px;border:0;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;font-weight:800;font-size:14px;cursor:pointer}
.ss-disc{position:fixed;inset:0;z-index:10400;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Plus Jakarta Sans",system-ui,sans-serif}
.ss-disc-bg{position:absolute;inset:0;background:rgba(4,6,10,.9);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.ss-disc-c{position:relative;width:100%;max-width:560px;border-radius:18px;padding:24px 26px 22px;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid #C9A84B;box-shadow:0 24px 60px rgba(0,0,0,.7);text-align:left;display:flow-root;max-height:88vh;overflow:auto}
.ss-disc-sello{float:right;width:116px;height:116px;margin:0 0 10px 18px;shape-outside:margin-box;filter:drop-shadow(0 8px 18px rgba(0,0,0,.5))}
.ss-disc-c h4{margin:2px 0 12px;font-size:20px;color:var(--gold)}
.ss-disc-c p{font-size:12.8px;line-height:1.65;color:#c4ccd4;margin:0 0 12px}.ss-disc-c p b{color:#eaecef}
.ss-disc-chk{display:flex;align-items:flex-start;gap:10px;clear:both;margin:6px 0 16px;cursor:pointer;font-size:12.5px;line-height:1.5;color:#d4dae1}
.ss-disc-chk input{flex:none;width:18px;height:18px;margin:1px 0 0;accent-color:var(--gold);cursor:pointer}
.ss-disc-ok{clear:both;width:100%;min-height:46px;border-radius:11px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold) 45%,#c79426);color:#3a2800;font-weight:800;font-size:14px;cursor:pointer}
.ss-disc-ok[disabled]{opacity:.45;cursor:not-allowed}
.ss-disc-x{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:9px;border:1px solid #232b36;background:rgba(255,255,255,.05);color:#c7ccd4;font-size:13px;cursor:pointer;z-index:2}
.ss-ab-legal{margin-top:16px;text-align:center}
.ss-disc-link{display:inline-flex;align-items:center;height:32px;padding:0 16px;border-radius:9px;border:1px solid #2b3139;background:rgba(255,255,255,.03);color:#C9A84B;font-size:12px;font-weight:700;cursor:pointer}
.ss-disc-link:hover{color:#f4d089;border-color:rgba(232,184,75,.5)}
@media(max-width:560px){.ss-disc-sello{float:none;display:block;width:92px;height:92px;margin:0 auto 10px}.ss-disc-c{text-align:center}.ss-disc-c p,.ss-disc-chk{text-align:left}}
@media(max-width:900px){.ss-sel span,.ss-px{display:none}}
`;