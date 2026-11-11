/* modules/velaavela/velaavela.js — "Footprint" (nombre de cara al usuario).
   El archivo NO se renombra, igual que "VWAP Pro" vive en modules/institutional/.

   Servicio de Analysis. MISMO chrome y dinámica que Reaction/Smart/Heat/Liquidity
   Pools: barra superior idéntica (Back · moneda+lista · temporalidad · precio+máx/mín
   · export con marca de agua · ayuda), gráfica de canvas propia con zoom/pan (rueda,
   arrastre del eje de precios = estira vertical, arrastre del eje de tiempo = estira
   horizontal, doble clic = reset), barra de dibujo compartida (barra.js),
   órdenes/alertas con clic derecho (orden.js), catálogo único de monedas (config.js),
   y botón Single/Double como las demás. El ÚNICO cambio es el MOTOR.

   MOTOR "Footprint" (flujo de órdenes): lee la CINTA ejecutada midiendo, por vela, el
   DELTA = volumen taker comprador menos taker vendedor. Las velas de Binance ya traen
   el volumen taker comprador (índice 10) y el quote (índice 7): delta = 2·takerBuy −
   quote, exacto para todo el histórico y en vivo por el mismo WebSocket de klines (k.Q
   y k.q). Con eso se arma el CVD (delta acumulado) y se detectan TRES señales
   accionables, cada una proyecta entrada/stop/objetivo a 1:2 (Single/Double, órdenes):
     1) ABSORCIÓN: ola agresiva fuerte contra el movimiento pero el precio no cede →
        hay un pasivo absorbiendo → giro a favor del que absorbe.
     2) DIVERGENCIA CVD/precio: el precio hace extremo nuevo y el CVD no lo acompaña →
        agotamiento → giro.
     3) RUPTURA CONFIRMADA POR DELTA: el precio rompe un nivel con delta fuerte a favor
        → continuación (filtra rupturas falsas).
   Datos solo de Binance SPOT (regla de CLAUDE.md), sin futuros. */

import { montarBarra } from '../../assets/js/niveles/barra.js?v=6';
import { PARES, pintarIcono, TFS } from '../../assets/js/niveles/config.js?v=1';
import { N } from '../../assets/js/niveles/estado.js?v=1';
import { cargarDib } from '../../assets/js/niveles/dibujo.js?v=3';

const WEB = 'decfreedom.com';
/* Ruta del logo resuelta contra la URL del script (no del documento): así
   /assets/img/cco-marca.png carga igual aunque la página se sirva desde
   /modules/analysis/. Es la marca de agua del export y del lienzo. */
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let _par = 'BTC';

const M = {
  tf: '1h', velas: [], precio: 0, data: { live: [], dead: [], triangles: [] }, sig: null, cvd: [],
  ancho: window.innerWidth < 760 ? 46 : 70, desplaz: 0, zoomY: 1, offsetY: 0,
  _geo: null, _cursor: null, _modoPos: null, _posAuto: null, _posSig: null,
  cargando: true, error: null
};
let _barra = null, _od = null, _zonasOd = null, _reloj = null, _pulso = null;

/* ── Datos (Binance klines con respaldo de hosts, igual que las pools) ── */
const HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision', 'https://api-gcp.binance.com', 'https://api1.binance.com'];
let _host = 0;
async function rzFetch(path) {
  const orden = [_host, ...HOSTS.map((_, i) => i).filter((i) => i !== _host)];
  let err;
  for (const i of orden) {
    try { const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4500); const r = await fetch(HOSTS[i] + path, { signal: ctl.signal }); clearTimeout(to); if (r.ok) { _host = i; return r; } err = new Error('HTTP ' + r.status); }
    catch (e) { err = e; }
  }
  throw err || new Error('sin datos');
}
async function traerVelas(simbolo, tf, n = 700) {
  const r = await rzFetch(`/api/v3/klines?symbol=${simbolo}&interval=${tf}&limit=${n}`);
  const j = await r.json();
  // La kline de Binance trae el volumen TAKER comprador (índice 10, quote) y el
  // volumen quote total (índice 7). El DELTA de flujo de una vela = taker comprador
  // menos taker vendedor = 2·takerBuy − total. Es la cinta ejecutada (los agresores).
  return j.map((x) => {
    const qv = +x[7] || 0, tb = +x[10] || 0;
    return { t: Math.floor(x[0] / 1000), o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: qv || +x[5] || 0, qv, tb, d: 2 * tb - qv };
  });
}

/* ── Velas EN VIVO por WebSocket de Binance ──
   La vela en formación se ve al instante (el bucle de 90 ms ya repinta); al
   cerrar se recalculan las zonas. El sondeo de 15 s sigue como resync/respaldo,
   así que se conserva el fallback de hosts si stream.binance.com estuviera
   bloqueado. `t` en SEGUNDOS y `v` en volumen quote, igual que traerVelas. ── */
let _rzStream = null, _rzStreamKey = '';
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
  const key = p.s + '|' + M.tf;
  if (_rzStreamKey === key && _rzStream) return;
  if (_rzStream) { try { _rzStream.cerrar(); } catch (_) {} _rzStream = null; }
  _rzStreamKey = key;
  try { _rzStream = streamVelasRz(p.s, M.tf, onKlineRz); } catch (_) { _rzStream = null; }
}
function onKlineRz(k) {
  if (!k || !M.velas || !M.velas.length) return;
  // k.q = volumen quote total, k.Q = volumen taker comprador (quote). Delta vivo igual
  // que en el histórico: 2·takerBuy − total. Así el CVD y el delta de la vela en curso
  // se actualizan al instante con el mismo stream, sin pedir aggTrades.
  const qv = +k.q || 0, tb = +k.Q || 0;
  const c = { t: Math.floor(k.t / 1000), o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: qv || +k.v || 0, qv, tb, d: 2 * tb - qv };
  if (!(c.c > 0)) return;
  const last = M.velas[M.velas.length - 1];
  if (c.t === last.t) { M.velas[M.velas.length - 1] = c; }        // misma vela en formación
  else if (c.t > last.t) { M.velas.push(c); }                      // nueva vela
  else return;                                                     // vieja → ignorar
  M.precio = c.c;                                                  // el bucle de 90 ms repinta solo
  if (k.x === true) { try { recalcular(); } catch (_) {} }         // al CERRAR: recalcular zonas de reacción
}

const fmt = (p) => {
  if (!(p > 0)) return '—';
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(8);
};
/* Etiqueta del eje de tiempo: hora en intradía, fecha en diario/semanal. */
function fmtFecha(tsSec) {
  const d = new Date(tsSec * 1000);
  const intradia = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h'].includes(M.tf);
  return intradia
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/* ══════════════════ APERTURA ══════════════════ */
export async function abrirVelaVela() {
  estilos();
  const prev = $('vv-overlay'); if (prev) prev.remove();
  M.velas = []; M.data = { live: [], dead: [], triangles: [] }; M.cargando = true; M.error = null;
  M._modoPos = null; M._posAuto = null;

  const p0 = PARES.find((p) => p.id === _par) || PARES[0]; _par = p0.id;
  const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
  const d = document.createElement('div');
  d.id = 'vv-overlay';
  d.innerHTML = `<div class="vv-bg"></div>
    <div class="vv-c">
      <div class="vv-barra">
        <button class="vv-back" id="vv-back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>Back</button>
        <button class="vv-sel" id="vv-sel"><i class="vv-logo" id="vv-logo" data-cg="${esc(p0.cg || '')}" data-ico="${esc(p0.ico || '')}"></i><b id="vv-par">${esc(_par)}</b><span id="vv-nm">${esc(p0.n || '')}</span>${chev}</button>
        <button class="vv-tfchip" id="vv-tfchip" type="button"><b id="vv-tfchip-t">${esc((TFS.find((t) => t.id === M.tf) || TFS[0]).n)}</b>${chev}</button>
        <div class="vv-px"><div class="vv-px-v" id="vv-px">—</div><div class="vv-hl"><span>H <b id="vv-hi">—</b></span><span>L <b id="vv-lo">—</b></span></div></div>
        <span class="vv-badge">ANALYSIS</span><span class="vv-badge vv-badge-spot">SPOT</span>
        <span id="vv-estado" class="vv-estado"></span>
        <div class="vv-der">
          <div class="vv-pos-split" id="vv-pos-split" title="Positions">
            <button class="vv-pos-half" id="vv-pos-single">Single</button>
            <button class="vv-pos-half" id="vv-pos-double">Double</button>
          </div>
          <button class="vv-share" id="vv-share" title="Share signal" disabled>Share signal</button>
          <button class="vv-ico" id="vv-foto" title="Share image"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.5"/></svg></button>
          <button class="vv-ico" id="vv-ayuda" title="How it works">?</button>
        </div>
      </div>
      <div class="vv-graf" id="vv-graf">
        <canvas class="vv-cv" id="vv-cv"></canvas>
        <div class="vv-esperando" id="vv-esperando"><div class="vv-spin"></div><b>Reading the order flow…</b><span>Measuring taker delta and building the cumulative volume read.</span></div>
        <img class="vv-marca" id="vv-marca" src="${LOGO}" alt="">
      </div>
    </div>`;
  document.body.appendChild(d);

  d.querySelector('.vv-bg').onclick = cerrar;
  $('vv-back').onclick = cerrar;
  $('vv-sel').onclick = (e) => { e.stopPropagation(); menuPares(); };
  $('vv-ayuda').onclick = ayuda;
  $('vv-foto').onclick = guardarImagen;
  $('vv-share').onclick = () => compartirSenal();
  $('vv-tfchip').onclick = (e) => { e.stopPropagation(); menuTf(); };
  { const bS = $('vv-pos-single'), bD = $('vv-pos-double'), bSh = $('vv-share');
    const set = (modo) => { M._modoPos = (M._modoPos === modo) ? null : modo; bS.classList.toggle('on', M._modoPos === 'single'); bD.classList.toggle('on', M._modoPos === 'double'); if (bSh) bSh.disabled = !M._modoPos; M._posAuto = null; if (!M._modoPos) M.desplaz = 0; dibujar(); };
    bS.onclick = () => set('single'); bD.onclick = () => set('double'); }

  ponerLogos();
  cargarVelas();
  clearInterval(_pulso);
  _pulso = setInterval(() => { if ($('vv-cv')) dibujar(); }, 90);   // ~11fps: titilar/latido fluido
  let _t = null; M._onResize = () => { clearTimeout(_t); _t = setTimeout(() => { if ($('vv-cv')) dibujar(); }, 200); };
  window.addEventListener('resize', M._onResize);
}

function cerrar() {
  clearInterval(_reloj); clearInterval(_pulso);
  if (_rzStream) { try { _rzStream.cerrar(); } catch (_) {} _rzStream = null; _rzStreamKey = ''; }   // cierra el WebSocket de velas en vivo
  if (M._onResize) window.removeEventListener('resize', M._onResize);
  if (_barra) { try { _barra.desmontar(); } catch (_) {} _barra = null; }
  document.querySelectorAll('#vv-picker, #vv-tfmenu, #vv-ayuda-box').forEach((x) => x.remove());
  const e = $('vv-overlay'); if (e) e.remove();
  const sel = $('an-sel'); if (sel) sel.style.display = '';   // vuelve al selector de Analysis
}

async function cargarVelas() {
  M.cargando = true;
  if (_rzStream) { try { _rzStream.cerrar(); } catch (_) {} _rzStream = null; _rzStreamKey = ''; }   // corta el stream anterior antes de recargar otra moneda/temporalidad
  const p = PARES.find((x) => x.id === _par) || {};
  try {
    M.velas = await traerVelas(p.s, M.tf, 700);
    M.cargando = false;
    if (M.velas.length) { M.precio = M.velas[M.velas.length - 1].c; recalcular(); }
    const est = $('vv-estado'); if (est) est.textContent = '';
  } catch (e) { M.cargando = false; M.error = 'feed'; const est = $('vv-estado'); if (est) est.textContent = 'Market data unavailable.'; }
  dibujar();
  clearInterval(_reloj);
  _reloj = setInterval(async () => {
    try { const v = await traerVelas(p.s, M.tf, 700); M.velas = v; if (v.length) M.precio = v[v.length - 1].c; recalcular(); dibujar(); } catch (_) {}
  }, 15000);
  conectarStreamRz();          // velas EN VIVO por WebSocket (el sondeo de 15 s queda de resync)
}
function recalcular() {
  M.cvd = calcularCVD(M.velas);                 // delta acumulado (la cinta)
  M.sig = calcularFootprint(M.velas, M.cvd);    // señal accionable vigente
  M._posAuto = null;                            // reproyecta la posición a la señal
  refrescarCabecera();
}

/* ══════════════════ MOTOR "Footprint" (flujo de órdenes) ══════════════════
   Delta por vela = taker comprador − taker vendedor (ya calculado en v.d). El CVD
   es su suma acumulada. Sobre eso se detecta la señal accionable vigente: absorción,
   divergencia CVD/precio o ruptura confirmada por delta. Cada una proyecta entrada,
   stop y objetivo a 1:2 (los dibuja la herramienta de posición Single/Double). */
function calcularCVD(velas) {
  const out = new Array(velas.length); let s = 0;
  for (let i = 0; i < velas.length; i++) { s += (velas[i].d || 0); out[i] = s; }
  return out;
}
function calcAtr(velas, idx, p) {
  let s = 0, c = 0;
  for (let i = Math.max(1, idx - p + 1); i <= idx; i++) {
    const tr = Math.max(velas[i].h - velas[i].l, Math.abs(velas[i].h - velas[i - 1].c), Math.abs(velas[i].l - velas[i - 1].c));
    s += tr; c++;
  }
  return c ? s / c : 0;
}
/* Pivotes locales (k vecinos a cada lado): devuelve [másReciente, previo]. */
function pivotes(velas, last, tipo) {
  const k = 2, out = [];
  for (let i = last - k; i >= Math.max(k, last - 44); i--) {
    const v = velas[i]; let ok = true;
    for (let j = 1; j <= k; j++) {
      if (tipo === 'low') { if (!(v.l < velas[i - j].l && v.l < velas[i + j].l)) { ok = false; break; } }
      else { if (!(v.h > velas[i - j].h && v.h > velas[i + j].h)) { ok = false; break; } }
    }
    if (ok) { out.push(i); if (out.length >= 2) break; }
  }
  return out;
}
/* Arma la señal: entrada, stop (invalidación del flujo) y objetivo a 1:2. */
function armarSenal(kind, largo, bar, velas, atr, verdict, opt) {
  opt = opt || {};
  const v = velas[bar];
  const entry = opt.entry != null ? opt.entry : v.c;
  const buf = atr * 0.12;
  const sl = opt.sl != null ? opt.sl : (largo ? Math.min(v.l, entry) - buf : Math.max(v.h, entry) + buf);
  const R = Math.abs(entry - sl) || atr || 1e-9;
  const tp = largo ? entry + 2 * R : entry - 2 * R;
  const zw = Math.min(atr * 0.2, R * 0.6);
  return { kind, largo, bar, entry, sl, tp, zoneHi: entry + zw, zoneLo: entry - zw, refHi: v.h, refLo: v.l, refBar: opt.refBar != null ? opt.refBar : null, verdict };
}
function detectarDivergencia(velas, cvd, last, atr) {
  const hs = pivotes(velas, last, 'high');
  if (hs.length >= 2) { const a = hs[0], b = hs[1];
    if (velas[a].h > velas[b].h && cvd[a] < cvd[b])
      return armarSenal('divergencia', false, a, velas, atr, 'Higher high, weaker delta — buying exhausted', { entry: velas[last].c, sl: velas[a].h + atr * 0.15, refBar: b });
  }
  const ls = pivotes(velas, last, 'low');
  if (ls.length >= 2) { const a = ls[0], b = ls[1];
    if (velas[a].l < velas[b].l && cvd[a] > cvd[b])
      return armarSenal('divergencia', true, a, velas, atr, 'Lower low, stronger delta — selling exhausted', { entry: velas[last].c, sl: velas[a].l - atr * 0.15, refBar: b });
  }
  return null;
}
function detectarRuptura(velas, cvd, last, atr, strong) {
  const look = 20, from = Math.max(0, last - look);
  let hi = -Infinity, lo = Infinity;
  for (let i = from; i <= last - 1; i++) { if (velas[i].h > hi) hi = velas[i].h; if (velas[i].l < lo) lo = velas[i].l; }
  const v = velas[last], mom = cvd[last] - cvd[Math.max(0, last - 3)];
  if (v.c > hi && v.d >= strong * 0.8 && mom > 0)
    return armarSenal('ruptura', true, last, velas, atr, 'Break up, delta confirming — continuation', { entry: hi, sl: Math.min(v.l, hi - atr * 0.6) - atr * 0.05 });
  if (v.c < lo && v.d <= -strong * 0.8 && mom < 0)
    return armarSenal('ruptura', false, last, velas, atr, 'Break down, delta confirming — continuation', { entry: lo, sl: Math.max(v.h, lo + atr * 0.6) + atr * 0.05 });
  return null;
}
function calcularFootprint(velas, cvd) {
  const n = velas.length;
  if (n < 30 || !cvd || !cvd.length) return null;
  const last = n - 2;                                   // última CERRADA (la n-1 está en formación)
  const win = 40, from = Math.max(0, last - win);
  let sAbs = 0, cAbs = 0;
  for (let i = from; i <= last; i++) { sAbs += Math.abs(velas[i].d || 0); cAbs++; }
  const dAvg = cAbs ? sAbs / cAbs : 0;
  const strong = (dAvg * 1.7) || 1;                     // umbral de flujo "fuerte"
  const atr = calcAtr(velas, last, 14) || ((velas[last].h - velas[last].l) || 1e-9);

  // 1) ABSORCIÓN — disparo más reciente entre las últimas cerradas
  for (let i = last; i >= Math.max(3, last - 6); i--) {
    const v = velas[i], d = v.d || 0, rng = (v.h - v.l) || 1e-9;
    // venta agresiva fuerte pero el precio no cede → absorción compradora → LONG
    if (d <= -strong && v.l >= Math.min(velas[i - 1].l, velas[i - 2].l) - atr * 0.05 && v.c >= v.l + rng * 0.33)
      return armarSenal('absorcion', true, i, velas, atr, 'Sellers hitting, price holding — buyers absorbing');
    // compra agresiva fuerte pero el precio no sube → absorción vendedora → SHORT
    if (d >= strong && v.h <= Math.max(velas[i - 1].h, velas[i - 2].h) + atr * 0.05 && v.c <= v.h - rng * 0.33)
      return armarSenal('absorcion', false, i, velas, atr, 'Buyers hitting, price capped — sellers absorbing');
  }
  // 2) DIVERGENCIA CVD/precio
  const div = detectarDivergencia(velas, cvd, last, atr);
  if (div) return div;
  // 3) RUPTURA CONFIRMADA POR DELTA
  return detectarRuptura(velas, cvd, last, atr, strong);
}
/* Etiqueta corta por tipo de señal (para la ficha y el chip del gráfico). */
function etiquetaSig(s) { return !s ? '' : ({ absorcion: 'ABSORPTION', divergencia: 'DELTA DIVERGENCE', ruptura: 'DELTA BREAK' }[s.kind] || ''); }
function refrescarCabecera() {
  const px = $('vv-px'), hi = $('vv-hi'), lo = $('vv-lo');
  if (!M.velas.length) return;
  const u = M.velas[M.velas.length - 1];
  // máx/mín del día (24h): últimas ~24h según TF
  let dH = u.h, dL = u.l; const back = Math.min(M.velas.length, tfPorDia(M.tf));
  for (let k = M.velas.length - back; k < M.velas.length; k++) { if (M.velas[k].h > dH) dH = M.velas[k].h; if (M.velas[k].l < dL) dL = M.velas[k].l; }
  if (px) { px.textContent = fmt(M.precio); px.className = 'vv-px-v ' + (u.c >= u.o ? 'up' : 'down'); }
  if (hi) hi.textContent = fmt(dH); if (lo) lo.textContent = fmt(dL);
}
function tfPorDia(tf) { const m = { '1m': 1440, '3m': 480, '5m': 288, '15m': 96, '30m': 48, '1h': 24, '2h': 12, '4h': 6, '6h': 4, '12h': 2, '1d': 1, '1w': 1 }; return m[tf] || 24; }

/* ══════════════════ RENDER ══════════════════ */
function pal() { return { fondo: '#0a0e14', rejilla: 'rgba(255,255,255,.04)', ink: '#e7ebf0', dim: '#7d8794' }; }

function dibujar() {
  const cv = $('vv-cv'), zona = $('vv-graf'); if (!cv || !zona) return;
  const W = zona.clientWidth, H = zona.clientHeight; if (W < 50 || H < 50) return;

  if (!cv.dataset.listo) {
    engancharGestos(cv);
    cv.dataset.listo = '1';
    _barra = montarBarra(zona);
    // barra.js solo carga los dibujos cuando el par CAMBIA (par !== N.par). Como
    // N.par arranca en 'BTC' por defecto, al abrir en BTC nunca se cargaban y
    // N.dibujos quedaba undefined → al soltar un trazo, soltarDib() reventaba
    // (push sobre undefined) y la barra quedaba congelada. Lo garantizamos aquí.
    try { N.seccion = 'velaavela'; N.par = _par; cargarDib(); } catch (_) { N.dibujos = N.dibujos || []; }
    import('../../assets/js/orden.js?v=126').then((od) => {
      od.conectar({
        canvas: cv,
        precioEn: (y) => { if (!M._geo) return 0; const { pMin, pMax, y1 } = M._geo; return pMin + (pMax - pMin) * ((y1 - y) / y1); },
        precioActual: () => M.precio > 0 ? M.precio : (M.velas.length ? M.velas[M.velas.length - 1].c : 0),
        par: () => _par,
        simbolo: () => (PARES.find((p) => p.id === _par) || {}).s || '',
        repintar: () => dibujar()
      });
      _od = od; od.clicCancelar(cv, () => _zonasOd, () => dibujar()); dibujar();
    }).catch(() => {});
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = pal(); g.fillStyle = P.fondo; g.fillRect(0, 0, W, H);

  const esp = $('vv-esperando');
  if (M.cargando || !M.velas.length) { if (esp) esp.style.display = ''; return; }
  if (esp) esp.style.display = 'none';

  const mDer = 66, mAba = 22;
  // Panel inferior para el flujo (histograma de delta + línea CVD). El área de precio
  // termina en y1; el panel va entre y1+gapP y yTime; el eje de tiempo queda abajo.
  const panelH = Math.max(50, Math.round((H - mAba) * 0.20)), gapP = 8;
  const yTime = H - mAba;
  const x1 = W - mDer, y1 = yTime - panelH - gapP, xVelas = x1;
  const ancho = Math.min(M.velas.length, M.ancho || 100);
  const huecoMax = Math.floor(ancho * 0.45);
  // Con Single/Double activo se reserva hueco a la derecha para proyectar las
  // cajas de posición ADELANTADAS al precio (igual que Heat Pools).
  // Reserva espacio a la derecha para PROYECTAR las zonas de la estrategia hacia
  // adelante (el nacimiento de la vela siguiente), aunque no haya Single/Double.
  const futNec = M._modoPos ? Math.min(huecoMax, M._modoPos === 'double' ? 32 : 16) : (M.sig ? Math.min(huecoMax, 12) : 0);
  let desp = Math.max(-huecoMax, Math.min(M.desplaz || 0, Math.max(0, M.velas.length - ancho)));
  if (futNec && (M.desplaz || 0) <= 0 && desp > -futNec) desp = -futNec;
  M.desplaz = desp;
  const fin = M.velas.length - desp;
  const vis = M.velas.slice(Math.max(0, fin - ancho), Math.min(M.velas.length, fin));
  if (!vis.length) return;
  if (desp <= 0 && M.precio > 0) { const u = vis[vis.length - 1]; u.c = M.precio; if (M.precio > u.h) u.h = M.precio; if (M.precio < u.l) u.l = M.precio; }

  let pAlto = Math.max(...vis.map((v) => v.h)), pBajo = Math.min(...vis.map((v) => v.l));
  if (M.precio > 0) { pAlto = Math.max(pAlto, M.precio); pBajo = Math.min(pBajo, M.precio); }
  // abre la escala para que entren el stop y el take profit de la señal (tope 45%)
  const rV0 = (pAlto - pBajo) || 1, capHi = pAlto + rV0 * 0.45, capLo = pBajo - rV0 * 0.45;
  if (M.sig) { [M.sig.sl, M.sig.tp, M.sig.entry].forEach((p) => { if (p <= capHi && p >= capLo) { pAlto = Math.max(pAlto, p); pBajo = Math.min(pBajo, p); } }); }
  const rangoB = (pAlto - pBajo) || 1;
  const despY = ((M.offsetY || 0) / Math.max(1, y1)) * rangoB;
  const centro = (pAlto + pBajo) / 2 + despY;
  const semi = (rangoB / 2) * (M.zoomY || 1);
  const pad = semi * 0.14 || 1;
  const pMax = centro + semi + pad, pMin = centro - semi - pad;
  const Y = (p) => y1 - y1 * ((p - pMin) / Math.max(1e-12, pMax - pMin));
  const paso = xVelas / (ancho || vis.length);
  const pri = fin - ancho;
  const Xbar = (barIdx) => (barIdx - pri) * paso + paso / 2;   // índice de vela → x
  M._geo = { pMin, pMax, y1, xVelas, n: vis.length, vis, paso, pri, fin, ancho, tfMs: (M.velas.length > 1 ? (M.velas[1].t - M.velas[0].t) * 1000 : 3600000), t0: M.velas[0].t };

  // órdenes/alertas del usuario (mismo estilo que las pools)
  if (_od) _zonasOd = _od.pintar(g, { x1, Y, pMin, pMax, simbolo: (PARES.find((p) => p.id === _par) || {}).s || '' });

  // rejilla
  g.strokeStyle = P.rejilla; g.lineWidth = 1;
  for (let i = 1; i < 6; i++) { const y = (y1 / 6) * i; g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); }

  const now = Date.now();
  const pulso = 0.5 + 0.5 * Math.sin(now / 420);          // latido lento de zonas

  // ── VELAS ──
  dibujarVelas(g, vis, Y, paso);

  // ── SEÑAL FOOTPRINT: marca de la vela gatillo + zona de entrada / SL / TP ──
  dibujarFootprint(g, x1, Y, pMin, pMax, Xbar, pulso, now);

  // línea del precio
  if (M.precio > 0) {
    const yp = Y(M.precio); g.strokeStyle = 'rgba(232,184,75,.55)'; g.lineWidth = 1; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(0, yp); g.lineTo(x1, yp); g.stroke(); g.setLineDash([]);
    const u = M.velas[M.velas.length - 1]; const col = u.c >= u.o ? '#2ee86a' : '#ff5b6e';
    g.fillStyle = col; redondeado(g, x1 + 2, yp - 9, mDer - 4, 18, 4); g.fill();
    g.fillStyle = '#071018'; g.font = 'bold 10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(fmt(M.precio), x1 + 6, yp + 3.5);
  }

  // ── Herramientas de posición (Single/Double): cajas proyectadas como Heat Pools ──
  if (M._modoPos) {
    if (!M._posAuto) M._posAuto = posicionesDeNiveles();
    M._posAuto.forEach((Pz) => dibujarPosicion(g, Pz));
  } else { M._posAuto = null; }

  // eje de precios (marcas)
  g.fillStyle = pal().dim; g.font = '10px ui-monospace,monospace'; g.textAlign = 'left';
  for (let i = 0; i <= 5; i++) { const y = (y1 / 5) * i; const pr = pMax - (pMax - pMin) * (i / 5); g.fillText(fmt(pr), x1 + 6, y + (i === 0 ? 10 : i === 5 ? -3 : 3)); }

  // ── PANEL DE FLUJO (CVD): histograma de delta + línea acumulada, debajo del precio ──
  dibujarPanelCVD(g, vis, x1, y1 + gapP, yTime, paso);

  // eje de TIEMPO (abajo): fechas/horas, igual que las demás secciones
  g.fillStyle = '#0b0e12'; g.fillRect(0, yTime, W, mAba);
  g.fillStyle = pal().dim; g.font = '9px ui-monospace,monospace'; g.textAlign = 'center';
  const cadaX = Math.max(1, Math.floor(vis.length / 7));
  vis.forEach((v, i) => { if (i % cadaX !== 0) return; const x = i * paso + paso / 2; if (x > xVelas - 14) return; g.fillText(fmtFecha(v.t), x, yTime + 14); });
  g.textAlign = 'left';

  // crosshair + tachuelas de precio (der) y hora (abajo)
  if (M._cursor && M._cursor.x < x1 && M._cursor.y < y1 && M._cursor.x > 0 && M._cursor.y > 0) {
    const cx = M._cursor.x, cy = M._cursor.y, pCur = pMin + (pMax - pMin) * ((y1 - cy) / y1);
    g.save(); g.strokeStyle = 'rgba(200,210,224,.4)'; g.lineWidth = 1; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, yTime); g.stroke();
    g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke(); g.restore(); g.setLineDash([]);
    g.fillStyle = '#e8ecf2'; redondeado(g, x1 + 2, cy - 9, mDer - 4, 18, 4); g.fill();
    g.fillStyle = '#0b0e12'; g.font = 'bold 10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(fmt(pCur), x1 + 6, cy + 3.5);
    const idx = Math.floor(cx / paso);
    if (idx >= 0 && idx < vis.length) {
      const ht = fmtFecha(vis[idx].t); g.font = 'bold 9px ui-monospace,monospace';
      const hw = g.measureText(ht).width + 12;
      g.fillStyle = '#e8ecf2'; redondeado(g, Math.max(2, Math.min(x1 - hw, cx - hw / 2)), yTime + 3, hw, 15, 4); g.fill();
      g.fillStyle = '#0b0e12'; g.textAlign = 'center'; g.fillText(ht, Math.max(2 + hw / 2, Math.min(x1 - hw / 2, cx)), yTime + 13.5); g.textAlign = 'left';
    }
  }

  // barra de dibujo compartida
  if (_barra && M._geo) _barra.redibujar({ W, H, x1: xVelas, y1, pMin, pMax, Y, ancho, paso, fin }, M.velas, _par);
}

function dibujarVelas(g, vis, Y, paso) {
  const w = Math.max(1, paso * 0.62);
  for (let i = 0; i < vis.length; i++) {
    const c = vis[i], x = i * paso + paso / 2;
    const sube = c.c >= c.o;
    const col = sube ? '#26d46a' : '#ff5162';
    g.strokeStyle = col; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, Y(c.h)); g.lineTo(x, Y(c.l)); g.stroke();
    const yO = Y(c.o), yC = Y(c.c); const top = Math.min(yO, yC), hgt = Math.max(1, Math.abs(yC - yO));
    g.fillStyle = col; g.fillRect(x - w / 2, top, w, hgt);
  }
}

/* Chip de veredicto (arriba-izquierda): tipo de señal + lectura en lenguaje claro. */
function chipFlow(g, title, sub, rgb) {
  g.save();
  g.font = '800 11px system-ui,sans-serif'; const w1 = g.measureText(title).width;
  g.font = '600 10px system-ui,sans-serif'; const w2 = sub ? g.measureText(sub).width : 0;
  const bw = Math.max(w1, w2) + 30, bx = 10, by = 10, bh = sub ? 40 : 26;
  g.shadowColor = `rgba(${rgb},.4)`; g.shadowBlur = 10;
  g.fillStyle = 'rgba(10,14,20,.92)'; redondeado(g, bx, by, bw, bh, 9); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = `rgba(${rgb},.55)`; g.lineWidth = 1; redondeado(g, bx, by, bw, bh, 9); g.stroke();
  g.fillStyle = `rgb(${rgb})`; g.beginPath(); g.arc(bx + 14, by + (sub ? 15 : bh / 2), 3.4, 0, 6.283); g.fill();
  g.textAlign = 'left'; g.fillStyle = '#eef2f6'; g.font = '800 11px system-ui,sans-serif'; g.fillText(title, bx + 24, by + (sub ? 17 : bh / 2 + 4));
  if (sub) { g.fillStyle = '#aab3bf'; g.font = '600 10px system-ui,sans-serif'; g.fillText(sub, bx + 24, by + 32); }
  g.restore();
}
/* SEÑAL FOOTPRINT en el precio: marca de la vela gatillo + zona de entrada + EN/SL/TP,
   proyectadas al frente. Verde = long, rojo = short. Sin señal: chip de "stand aside". */
function dibujarFootprint(g, x1, Y, pMin, pMax, Xbar, pulso, now) {
  const S = M.sig, geo = M._geo; if (!geo) return;
  if (!S) { chipFlow(g, 'NO CLEAN FLOW', 'Stand aside — waiting for a read', '125,135,148'); return; }
  const rgb = S.largo ? '46,232,106' : '255,74,90';
  const rgbHi = S.largo ? '150,255,195' : '255,150,165';
  const paso = geo.paso || 8;
  const xc = Xbar(S.bar), xa = Math.max(0, xc - paso * 0.6), xR = x1;
  if (xR <= xa) { chipFlow(g, etiquetaSig(S) + ' · ' + (S.largo ? 'LONG' : 'SHORT'), S.verdict, rgb); return; }

  // zona de entrada (banda) proyectada con barrido de luz
  const yzT = Y(Math.max(S.zoneHi, S.zoneLo)), yzB = Y(Math.min(S.zoneHi, S.zoneLo));
  const sweep = (now % 2600) / 2600, hh = Math.max(1, yzB - yzT);
  g.fillStyle = `rgba(${rgb},.16)`; g.fillRect(xa, yzT, xR - xa, hh);
  { const grd = g.createLinearGradient(xa, 0, xR, 0);
    for (let k = 0; k <= 10; k++) { const p = k / 10, b = 0.5 + 0.5 * Math.cos((p - sweep) * Math.PI * 4); grd.addColorStop(p, `rgba(${rgbHi},${(0.02 + 0.06 * b).toFixed(3)})`); }
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grd; g.fillRect(xa, yzT, xR - xa, hh); g.restore(); }

  // marca (triángulo) en la vela gatillo
  { const v = M.velas[S.bar];
    if (v) { const yy = S.largo ? Y(v.l) + 11 : Y(v.h) - 11, s = 5.5;
      g.save(); g.fillStyle = `rgb(${rgb})`; g.shadowColor = `rgba(${rgb},.7)`; g.shadowBlur = 8; g.beginPath();
      if (S.largo) { g.moveTo(xc, yy - s); g.lineTo(xc - s, yy + s); g.lineTo(xc + s, yy + s); }
      else { g.moveTo(xc, yy + s); g.lineTo(xc - s, yy - s); g.lineTo(xc + s, yy - s); }
      g.closePath(); g.fill(); g.restore(); } }

  // entrada / stop / objetivo
  const linea = (lab, p, c, dash, lw) => {
    if (p > pMax || p < pMin) return; const y = Y(p);
    g.save(); if (dash) g.setLineDash(dash); g.strokeStyle = c; g.lineWidth = lw || 1.5; g.globalAlpha = 0.95;
    g.beginPath(); g.moveTo(xa, y); g.lineTo(xR, y); g.stroke(); g.restore(); g.setLineDash([]);
    g.font = '800 9px ui-monospace,monospace'; const t = lab + ' ' + fmt(p), tw = g.measureText(t).width, bw = Math.max(52, tw + 12);
    g.fillStyle = (c[0] === 'r' ? `rgb(${rgbHi})` : c); redondeado(g, xR - bw - 2, y - 8, bw, 16, 4); g.fill();
    g.fillStyle = '#06110a'; g.textAlign = 'left'; g.fillText(t, xR - bw + 4, y + 3.3);
  };
  linea('EN', S.entry, `rgba(${rgbHi},${(0.8 + 0.2 * pulso).toFixed(3)})`, null, 2);
  linea('TP', S.tp, '#2ee86a', [5, 4], 1.4);
  linea('SL', S.sl, '#ff4a5a', [5, 4], 1.4);
  g.textAlign = 'left';
  chipFlow(g, etiquetaSig(S) + ' · ' + (S.largo ? 'LONG' : 'SHORT'), S.verdict, rgb);
}

/* PANEL DE FLUJO: línea CVD (delta acumulado) arriba y histograma de delta por vela
   abajo. Es la vista reconocible de order flow, limpia, debajo del precio. */
function dibujarPanelCVD(g, vis, x1, yTop, yBot, paso) {
  const H = yBot - yTop; if (H < 24 || !vis.length) return;
  g.fillStyle = 'rgba(255,255,255,.015)'; g.fillRect(0, yTop, x1, H);
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, yTop + 0.5); g.lineTo(x1, yTop + 0.5); g.stroke();

  // franjas: CVD arriba, delta abajo
  const hC0 = yTop + 6, hC1 = yTop + H * 0.5;
  const hD0 = yTop + H * 0.56, hD1 = yBot - 4, zero = (hD0 + hD1) / 2, half = (hD1 - hD0) / 2 - 1;

  // histograma de delta
  const deltas = vis.map((v) => v.d || 0);
  let maxAbs = 1e-9; for (const d of deltas) if (Math.abs(d) > maxAbs) maxAbs = Math.abs(d);
  const w = Math.max(1, paso * 0.6);
  for (let i = 0; i < vis.length; i++) { const d = deltas[i]; if (!d) continue; const x = i * paso + paso / 2, bh = (Math.abs(d) / maxAbs) * half;
    g.fillStyle = d >= 0 ? 'rgba(38,212,106,.5)' : 'rgba(255,81,98,.5)';
    if (d >= 0) g.fillRect(x - w / 2, zero - bh, w, bh); else g.fillRect(x - w / 2, zero, w, bh); }
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, zero); g.lineTo(x1, zero); g.stroke();

  // línea CVD (ventana visible reescalada a su propio rango)
  const base = M._geo ? M._geo.pri : 0, cvdAll = M.cvd || [], seg = [];
  for (let i = 0; i < vis.length; i++) { const gi = base + i; seg.push(cvdAll[gi] != null ? cvdAll[gi] : (seg.length ? seg[seg.length - 1] : 0)); }
  let cMin = Infinity, cMax = -Infinity; for (const s of seg) { if (s < cMin) cMin = s; if (s > cMax) cMax = s; }
  if (!(cMax - cMin > 1e-9)) { cMax = cMin + 1; } const pad = (cMax - cMin) * 0.12 || 1; cMin -= pad; cMax += pad;
  const yC = (val) => hC1 - (hC1 - hC0) * ((val - cMin) / (cMax - cMin));
  const rising = seg.length > 3 && seg[seg.length - 1] >= seg[seg.length - 4];
  g.save(); g.strokeStyle = '#E8B84B'; g.lineWidth = 2; g.shadowColor = 'rgba(232,184,75,.45)'; g.shadowBlur = 6;
  g.beginPath(); for (let i = 0; i < seg.length; i++) { const x = i * paso + paso / 2, y = yC(seg[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.restore();
  // último punto
  if (seg.length) { const x = (seg.length - 1) * paso + paso / 2, y = yC(seg[seg.length - 1]); g.fillStyle = '#E8B84B'; g.beginPath(); g.arc(x, y, 2.6, 0, 6.283); g.fill(); }

  // etiquetas
  g.textAlign = 'left'; g.fillStyle = 'rgba(232,184,75,.95)'; g.font = '800 9px ui-monospace,monospace'; g.fillText('CVD', 8, yTop + 13);
  g.fillStyle = rising ? 'rgba(38,212,106,.9)' : 'rgba(255,81,98,.9)'; g.font = '800 8px ui-monospace,monospace'; g.fillText(rising ? '▲ buyers' : '▼ sellers', 40, yTop + 13);
  g.fillStyle = 'rgba(170,179,191,.7)'; g.font = '700 8px ui-monospace,monospace'; g.fillText('DELTA', 8, zero - 3);
}

function redondeado(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ══════════════════ POSICIONES (Single / Double) ══════════════════
   Misma herramienta/dibujo que Reaction (cajas proyectadas a la derecha, RR 1:2,
   tarjeta minimizada que se expande), pero ancladas a la SEÑAL de flujo.
   Single = la entrada de la señal. Double = añade un respaldo más profundo (mejor
   precio) que COMPARTE la misma invalidación: dos parciales a un solo riesgo (~1R),
   no dos riesgos sumados. El TP de cada una a 1:2 de su propia entrada. */
const _ORD_RZ = ['izq', 'abajo', 'der', 'arriba'];
function mXbar(b) { const g = M._geo; if (!g) return 0; return (b - g.pri) * g.paso + g.paso / 2; }
function mYp(p) { const g = M._geo; if (!g) return 0; return g.y1 - g.y1 * ((p - g.pMin) / Math.max(1e-9, g.pMax - g.pMin)); }
function _hex2rgb(hex) { const n = parseInt((hex || '#2ee86a').slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }

function posicionesDeNiveles() {
  const geo = M._geo, S = M.sig; if (!geo || !S) return [];
  const doble = M._modoPos === 'double';
  const bLast = M.velas.length - 1;
  const W = 13, GAP = 2;                                  // caja y hueco, en velas
  const slotX = (s) => bLast + 1 + s * (W + GAP);
  const tipo = S.largo ? 'largo' : 'corto', corto = tipo === 'corto';
  // d = riesgo = |entrada − stop de la señal|. La caja recalcula el stop con pe ± d,
  // que cae justo en la invalidación de la señal; el TP a 1:2 de cada entrada.
  const mk = (pe, slot) => {
    const d = Math.abs(pe - S.sl) || (S.zoneHi - S.zoneLo) || 1e-9;
    const sl = corto ? pe + d : pe - d;
    const pT = corto ? pe - 2 * d : pe + 2 * d;          // take profit = el doble (1:2)
    const b0 = slotX(slot);
    const lineCol = slot === 0 ? '#eaecef' : '#E8B84B';  // principal blanco, respaldo dorado
    return { tipo, pe, pStop: sl, pTarget: pT, b0, b1: b0 + W, rr: 2, oculto: true, cardPos: 'izq', slot, lineCol };
  };
  const out = [mk(S.entry, 0)];                          // Single = entrada de la señal
  if (doble) {                                           // Double = respaldo más profundo, mismo stop
    const deep = corto ? Math.max(S.zoneHi, S.entry + (S.sl - S.entry) * 0.4)
                       : Math.min(S.zoneLo, S.entry - (S.entry - S.sl) * 0.4);
    out.push(mk(deep, 1));
  }
  return out;
}

function _anclaTarjetaRZ(pos, x, w, yt, ye, ys, cw, ch, x1, y1) {
  const yTop = Math.min(yt, ye, ys), yBot = Math.max(yt, ye, ys), cyMid = (yTop + yBot) / 2;
  let cx, cy; pos = pos || 'izq';
  if (pos === 'izq') { cx = x - cw - 12; cy = cyMid - ch / 2; }
  else if (pos === 'arriba') { cx = x + w / 2 - cw / 2; cy = yTop - ch - 10; }
  else if (pos === 'abajo') { cx = x + w / 2 - cw / 2; cy = yBot + 10; }
  else { cx = x + w + 12; cy = cyMid - ch / 2; }
  cx = Math.max(4, Math.min(x1 - cw - 4, cx)); cy = Math.max(4, Math.min(y1 - ch - 4, cy));
  return { cx, cy };
}

/* Dibujo FIEL de la herramienta de posición de Heat Pools. */
function dibujarPosicion(g, P) {
  const geo = M._geo; if (!P || !geo) return;
  const largo = P.tipo === 'largo';
  const x1 = geo.xVelas, y1 = geo.y1;
  const Ax = mXbar(P.b0), Bx = mXbar(P.b1);
  const pe = P.pe, pT = P.pTarget, pS = P.pStop;
  const ye = mYp(pe), yt = mYp(pT), ys = mYp(pS);
  const x = Math.min(Ax, Bx), w = Math.abs(Bx - Ax) || 120;
  const cT = '#2ee86a', cE = '#eaecef', cS = '#ff4a5a';
  const rgbT = _hex2rgb(cT), rgbS = _hex2rgb(cS);
  const acc = largo ? '#2ee86a' : '#ff4a5a', accRGB = largo ? '46,232,106' : '255,74,90';

  // zonas ganancia / riesgo (bloques, como la herramienta de posición)
  g.fillStyle = `rgba(${rgbT},.16)`; g.fillRect(x, Math.min(ye, yt), w, Math.abs(yt - ye));
  g.fillStyle = `rgba(${rgbS},.16)`; g.fillRect(x, Math.min(ye, ys), w, Math.abs(ys - ye));
  // 3 líneas objetivo / entrada / stop
  [[cT, yt], [cE, ye], [cS, ys]].forEach((r) => {
    g.strokeStyle = r[0]; g.lineWidth = 2; g.beginPath(); g.moveTo(x, r[1]); g.lineTo(x + w, r[1]); g.stroke();
  });
  // ── Rayas PUNTEADAS hasta el eje de precios, con etiqueta (para leer/copiar). ──
  //    Color POR OPERACIÓN (principal blanco, respaldo dorado) para no confundir
  //    los precios de una y otra al pulsar Double.
  { const lc = P.lineCol || '#eaecef', lcRGB = _hex2rgb(lc), mDer = 66;
    g.save();
    [['TP', pT, yt], ['EN', pe, ye], ['SL', pS, ys]].forEach(([lab, pr, yy]) => {
      g.setLineDash([2, 3]); g.lineWidth = 1; g.strokeStyle = `rgba(${lcRGB},.85)`;
      g.beginPath(); g.moveTo(x + w, yy); g.lineTo(x1, yy); g.stroke(); g.setLineDash([]);
      g.fillStyle = lc; redondeado(g, x1 + 2, yy - 8, mDer - 4, 16, 4); g.fill();
      g.fillStyle = '#0b0e12'; g.font = '800 8px ui-monospace,monospace'; g.textAlign = 'left';
      g.fillText(`${lab} ${fmt(pr)}`, x1 + 5, yy + 3);
    });
    g.restore(); g.textAlign = 'left';
  }
  if (!P.oculto) {
    g.save();
    [[cT, yt], [cE, ye], [cS, ys]].forEach((r) => {
      [x, x + w].forEach((xx) => {
        g.fillStyle = '#0b0e12'; g.beginPath(); g.arc(xx, r[1], 3.6, 0, 6.283); g.fill();
        g.fillStyle = r[0]; g.beginPath(); g.arc(xx, r[1], 2.4, 0, 6.283); g.fill();
      });
    });
    g.restore();
  }
  P._pos = { x, w, yt, ye, ys };
  const gPct = ((pT - pe) / pe) * 100, rPct = ((pS - pe) / pe) * 100;
  const rr = Math.abs(rPct) > 0 ? Math.abs(gPct / rPct) : 0;

  if (P.oculto) {
    const bw = 30, bh = 17;
    const bcx = x + w / 2, bcy = ye + (yt - ye) * 0.35;
    const mp = { cx: bcx - bw / 2, cy: bcy - bh / 2 };
    g.save(); g.shadowColor = `rgba(${accRGB},.55)`; g.shadowBlur = 9;
    g.fillStyle = acc; redondeado(g, mp.cx, mp.cy, bw, bh, 5); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = '#0b0f16'; g.font = '800 10px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(largo ? 'L' : 'S', mp.cx + 10, mp.cy + bh / 2 + .5);
    g.font = '800 8px system-ui,sans-serif'; g.fillText('▾', mp.cx + 21, mp.cy + bh / 2 - .5);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.restore();
    P._miniBtn = { x: mp.cx, y: mp.cy, w: bw, h: bh }; P._hideBtn = P._arrL = P._arrR = null;
    return;
  }
  P._miniBtn = null;

  // ── Tarjeta (a escala, OPACA) ──
  const Sc = 0.72;
  const cw = 210, ch = 132;
  const ap = _anclaTarjetaRZ(P.cardPos, x, w, yt, ye, ys, cw * Sc, ch * Sc, x1, y1);
  const cx = ap.cx, cy = ap.cy;
  const hbL = { x: cw - 34, y: 9, w: 24, h: 19 };
  const rxL = cw - 42, divXL = cw - 76, ay2L = ch - 18;
  const alL = { x: rxL - 27, y: ay2L - 11, w: 22, h: 22 }, arL = { x: rxL + 5, y: ay2L - 11, w: 22, h: 22 };
  const rrTxt = Math.abs(rr - Math.round(rr)) < 0.06 ? String(Math.round(rr)) : rr.toFixed(1);
  g.save();
  g.translate(cx, cy); g.scale(Sc, Sc);
  g.shadowColor = 'rgba(0,0,0,.62)'; g.shadowBlur = 22;
  g.fillStyle = 'rgba(12,16,23,1)'; redondeado(g, 0, 0, cw, ch, 16); g.fill();
  g.shadowColor = 'transparent';
  g.strokeStyle = `rgba(${accRGB},.55)`; g.lineWidth = 1.2; redondeado(g, 0, 0, cw, ch, 16); g.stroke();
  g.fillStyle = acc; redondeado(g, 0, 14, 4, ch - 28, 2); g.fill();
  g.textAlign = 'left';
  g.fillStyle = acc; g.font = '800 11px "Chakra Petch",system-ui,sans-serif';
  g.fillText(largo ? 'LONG POSITION' : 'SHORT POSITION', 16, 23);
  g.fillStyle = 'rgba(255,255,255,.1)'; redondeado(g, hbL.x, hbL.y, hbL.w, hbL.h, 6); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; redondeado(g, hbL.x, hbL.y, hbL.w, hbL.h, 6); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(hbL.x + 6, hbL.y + 9.5); g.lineTo(hbL.x + 18, hbL.y + 9.5); g.stroke();
  const colX = 16;
  g.fillStyle = '#79838f'; g.font = 'bold 9px system-ui,sans-serif'; g.fillText('TAKE PROFIT', colX, 46);
  g.save(); g.shadowColor = 'rgba(46,232,106,.65)'; g.shadowBlur = 14;
  g.fillStyle = cT; g.font = '800 27px system-ui,sans-serif';
  g.fillText(`+${Math.abs(gPct).toFixed(2)}%`, colX, 73); g.restore();
  g.fillStyle = '#79838f'; g.font = 'bold 9px system-ui,sans-serif'; g.fillText('STOP LOSS', colX, 95);
  g.save(); g.shadowColor = `rgba(${rgbS},.65)`; g.shadowBlur = 14;
  g.fillStyle = cS; g.font = '800 23px system-ui,sans-serif';
  g.fillText(`−${Math.abs(rPct).toFixed(2)}%`, colX, 120); g.restore();
  g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(divXL, 40); g.lineTo(divXL, ch - 34); g.stroke();
  g.textAlign = 'center';
  g.fillStyle = '#79838f'; g.font = 'bold 9px system-ui,sans-serif'; g.fillText('R : R', rxL, 56);
  g.save(); g.shadowColor = 'rgba(232,184,75,.55)'; g.shadowBlur = 12;
  g.fillStyle = '#E8B84B'; g.font = '800 23px system-ui,sans-serif';
  g.fillText(`1:${rrTxt}`, rxL, 84); g.restore();
  [[alL, -1], [arL, 1]].forEach((f) => {
    g.fillStyle = 'rgba(255,255,255,.09)'; redondeado(g, f[0].x, f[0].y, 22, 22, 6); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1; redondeado(g, f[0].x, f[0].y, 22, 22, 6); g.stroke();
    g.strokeStyle = '#c3cad2'; g.lineWidth = 1.8; g.beginPath();
    const mx = f[0].x + 11, my = f[0].y + 11;
    if (f[1] < 0) { g.moveTo(mx + 3, my - 4); g.lineTo(mx - 3, my); g.lineTo(mx + 3, my + 4); }
    else { g.moveTo(mx - 3, my - 4); g.lineTo(mx + 3, my); g.lineTo(mx - 3, my + 4); }
    g.stroke();
  });
  g.restore();
  P._hideBtn = { x: cx + hbL.x * Sc, y: cy + hbL.y * Sc, w: hbL.w * Sc, h: hbL.h * Sc };
  P._arrL = { x: cx + alL.x * Sc, y: cy + alL.y * Sc, w: 22 * Sc, h: 22 * Sc };
  P._arrR = { x: cx + arL.x * Sc, y: cy + arL.y * Sc, w: 22 * Sc, h: 22 * Sc };
  g.textAlign = 'left';
}

/* ══════════════════ GESTOS (zoom/pan) ══════════════════ */
function engancharGestos(cv) {
  const zoom = (f) => { const maxA = Math.max(60, (M.velas.length || 700) - 2); M.ancho = Math.max(14, Math.min(maxA, Math.round((M.ancho || 100) * f))); dibujar(); };
  let ax = 0, ay = 0, arr = false, dragEsc = false, dragX = false;
  const enEscala = (x) => x > cv.clientWidth - 66;              // eje de PRECIOS (derecha)
  const enEjeX = (x, y) => y > cv.clientHeight - 24 && x < cv.clientWidth - 66;   // eje de FECHAS (abajo)
  const dRz = (lx, ly, rc) => rc && lx >= rc.x - 6 && lx <= rc.x + rc.w + 6 && ly >= rc.y - 6 && ly <= rc.y + rc.h + 6;
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  cv.addEventListener('mousedown', (e) => {
    const r = cv.getBoundingClientRect(); const lx = e.clientX - r.left, ly = e.clientY - r.top;
    // Posiciones automáticas: expandir / minimizar / mover su tarjeta (igual que Heat Pools)
    for (const P of (M._posAuto || [])) {
      if (P.oculto && dRz(lx, ly, P._miniBtn)) { P.oculto = false; dibujar(); return; }
      if (!P.oculto) {
        if (dRz(lx, ly, P._hideBtn)) { P.oculto = true; dibujar(); return; }
        if (dRz(lx, ly, P._arrL)) { P.cardPos = _ORD_RZ[(_ORD_RZ.indexOf(P.cardPos || 'izq') + 3) % 4]; dibujar(); return; }
        if (dRz(lx, ly, P._arrR)) { P.cardPos = _ORD_RZ[(_ORD_RZ.indexOf(P.cardPos || 'izq') + 1) % 4]; dibujar(); return; }
      }
    }
    ax = lx; ay = ly; dragEsc = enEscala(lx); dragX = !dragEsc && enEjeX(lx, ly); arr = true;
    cv.style.cursor = dragX ? 'ew-resize' : (dragEsc ? 'ns-resize' : 'grabbing');
  });
  window.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    M._cursor = { x, y };
    if (!arr) {
      let ptr = false;
      for (const P of (M._posAuto || [])) {
        if (P.oculto) { if (dRz(x, y, P._miniBtn)) { ptr = true; break; } }
        else if (dRz(x, y, P._hideBtn) || dRz(x, y, P._arrL) || dRz(x, y, P._arrR)) { ptr = true; break; }
      }
      cv.style.cursor = ptr ? 'pointer' : (enEscala(x) ? 'ns-resize' : (enEjeX(x, y) ? 'ew-resize' : 'crosshair'));   // precios → ↕ · fechas → ↔
      if (M._geo) dibujar(); return;
    }
    if (dragEsc) {   // arrastre sobre el eje de precios → estira/contrae la escala vertical (como TradingView)
      const dy = y - ay;
      if (Math.abs(dy) > 1) { M.zoomY = Math.max(0.2, Math.min(6, (M.zoomY || 1) * (1 + dy * 0.004))); ay = y; dibujar(); }
      return;
    }
    if (dragX) {   // arrastre sobre el eje de FECHAS → estira/contrae el tiempo (↔, como TradingView)
      const dxx = x - ax;
      if (Math.abs(dxx) > 2) { const maxA = Math.max(60, (M.velas.length || 700) - 2); M.ancho = Math.max(14, Math.min(maxA, Math.round((M.ancho || 100) * (1 + dxx * 0.006)))); ax = x; dibujar(); }
      return;
    }
    const paso = M._geo ? M._geo.paso : 8; const dx = x - ax, dy = y - ay;
    if (Math.abs(dx) > paso) { M.desplaz = (M.desplaz || 0) + Math.round(dx / paso); ax = x; }
    M.offsetY = (M.offsetY || 0) + dy; ay = y; dibujar();
  });
  window.addEventListener('mouseup', () => { arr = false; dragEsc = false; dragX = false; cv.style.cursor = 'crosshair'; });
  cv.addEventListener('mouseleave', () => { M._cursor = null; dibujar(); });
  cv.addEventListener('dblclick', () => { M.ancho = window.innerWidth < 760 ? 34 : 52; M.desplaz = 0; M.zoomY = 1; M.offsetY = 0; dibujar(); });
}

/* ══════════════════ SELECTOR DE MONEDAS / TF ══════════════════ */
const grupoNm = { cripto: 'Crypto', divisa: 'Forex', materia: 'Commodities' };
function menuPares() {
  if ($('vv-picker')) { $('vv-picker').remove(); return; }
  const ancla = $('vv-sel'); const m = document.createElement('div'); m.id = 'vv-picker'; m.className = 'vv-pop';
  const grupos = {}; PARES.forEach((p) => { (grupos[p.grupo || 'cripto'] = grupos[p.grupo || 'cripto'] || []).push(p); });
  let html = '<div class="vv-cm-top"><input id="vv-cm-q" placeholder="Filter…" autocomplete="off"></div><div class="vv-cm-list">';
  ['cripto', 'divisa', 'materia'].forEach((gr) => { if (!grupos[gr]) return; html += `<div class="vv-cm-cat">${grupoNm[gr]}</div>` + grupos[gr].map((p) => `<button class="vv-cm-it ${p.id === _par ? 'on' : ''}" data-id="${esc(p.id)}" data-b="${esc((p.id + ' ' + (p.n || '')).toLowerCase())}"><i class="vv-mini" data-cg="${esc(p.cg || '')}" data-ico="${esc(p.ico || '')}"></i><b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`).join(''); });
  html += '</div>'; m.innerHTML = html; document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, r.left) + 'px';
  ponerLogos(m);
  m.querySelectorAll('.vv-cm-it').forEach((b) => b.onclick = () => { const id = b.dataset.id; m.remove(); if (id !== _par) { _par = id; const p = PARES.find((x) => x.id === id) || {}; const lg = $('vv-logo'); if (lg) { lg.dataset.cg = p.cg || ''; lg.dataset.ico = p.ico || ''; } $('vv-par').textContent = id; $('vv-nm').textContent = p.n || ''; ponerLogos(); M._posAuto = null; cargarVelas(); } });
  const q = m.querySelector('#vv-cm-q'); q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); m.querySelectorAll('.vv-cm-it').forEach((b) => b.style.display = (!v || b.dataset.b.includes(v)) ? '' : 'none'); });
  setTimeout(() => q.focus(), 30);
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function menuTf() {
  if ($('vv-tfmenu')) { $('vv-tfmenu').remove(); return; }
  const ancla = $('vv-tfchip'); const m = document.createElement('div'); m.id = 'vv-tfmenu'; m.className = 'vv-pop vv-tfpop';
  m.innerHTML = TFS.map((t) => `<button class="vv-tf-it ${t.id === M.tf ? 'on' : ''}" data-tf="${t.id}">${esc(t.n)}</button>`).join('');
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); const w = m.offsetWidth || 210;
  m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
  m.querySelectorAll('.vv-tf-it').forEach((b) => b.onclick = () => { M.tf = b.dataset.tf; $('vv-tfchip-t').textContent = (TFS.find((t) => t.id === M.tf) || {}).n || M.tf; m.remove(); M._posAuto = null; cargarVelas(); });
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function ponerLogos(root) {
  (root || document).querySelectorAll('.vv-logo, .vv-mini').forEach((el) => {
    const cg = el.dataset.cg, ico = el.dataset.ico;
    el.style.backgroundImage = '';
    if (ico) { pintarIcono(el); return; }   // divisas (EUR €, GBP £) → moneda SVG
    if (cg && window.__aurexLogos && window.__aurexLogos[cg]) { el.style.backgroundImage = `url(${window.__aurexLogos[cg]})`; el.classList.add('con'); el.textContent = ''; return; }
    el.textContent = (el.closest('[data-id]')?.dataset.id || _par || '?')[0];
  });
  cargarLogosCache(root);
}
let _logosFetch = null;
/* Garantiza que window.__aurexLogos esté cargado (caché local o CoinGecko) y
   DEVUELVE una promesa esperable. Lo usan tanto los logos de la interfaz como
   el export de señal: así, igual que Heat Pools espera a ponerLogos() antes de
   dibujar, aquí se espera a tener el logo antes de pintarlo en la imagen. */
function asegurarLogos() {
  if (window.__aurexLogos && Object.keys(window.__aurexLogos).length) return Promise.resolve();
  try { const g = JSON.parse(localStorage.getItem('aurex-logos') || 'null'); if (g && g.datos && Object.keys(g.datos).length) { window.__aurexLogos = g.datos; return Promise.resolve(); } } catch (_) {}
  if (!_logosFetch) {
    const ids = PARES.filter((p) => p.cg).map((p) => p.cg).join(',');
    _logosFetch = fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=250&page=1`).then((r) => r.json()).then((j) => { const m = {}; j.forEach((x) => { m[x.id] = x.image; }); window.__aurexLogos = m; try { localStorage.setItem('aurex-logos', JSON.stringify({ cuando: Date.now(), datos: m })); } catch (_) {} }).catch(() => { window.__aurexLogos = window.__aurexLogos || {}; });
  }
  return _logosFetch;
}
function cargarLogosCache(root) {
  asegurarLogos().then(() => aplicarLogos(root));
}
function aplicarLogos(root) {
  if (!window.__aurexLogos) return;
  (root || document).querySelectorAll('.vv-logo, .vv-mini').forEach((el) => { if (el.dataset.ico) return; const cg = el.dataset.cg; const url = cg && window.__aurexLogos[cg]; if (url) { el.style.backgroundImage = `url(${url})`; el.classList.add('con'); el.textContent = ''; } });
}

/* ══════════════════ EXPORT (con marca de agua = logo en el pie) ══════════════════ */
function guardarImagen() {
  const cv = $('vv-cv'); if (!cv) return;
  const marca = $('vv-marca'); const antes = marca ? marca.style.display : null; if (marca) marca.style.display = 'none';
  const devolver = () => { if (marca) marca.style.display = antes || ''; };
  try {
    const e2 = cv.width / cv.clientWidth, barra = 78 * e2;
    const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height + barra;
    const g = out.getContext('2d'); g.fillStyle = '#0a0e14'; g.fillRect(0, 0, out.width, out.height); g.drawImage(cv, 0, 0);
    const yB = cv.height; g.fillStyle = '#0b0e12'; g.fillRect(0, yB, out.width, barra);
    g.fillStyle = 'rgba(232,184,75,.35)'; g.fillRect(0, yB, out.width, 2 * e2);
    const textos = (x) => {
      g.textAlign = 'left'; g.fillStyle = '#E8B84B'; g.font = `800 ${19 * e2}px system-ui,sans-serif`; g.fillText('Footprint', x, yB + 34 * e2);
      g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillStyle = '#C9A84B'; g.fillText(WEB, x, yB + 56 * e2);
      g.textAlign = 'right'; g.fillStyle = '#8b96a3'; g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillText(`${_par} · ${M.tf}`, out.width - 20 * e2, yB + 34 * e2);
      g.font = `${11 * e2}px ui-monospace,monospace`; g.fillStyle = '#6b7681'; g.fillText(new Date().toLocaleString('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), out.width - 20 * e2, yB + 56 * e2);
      g.textAlign = 'left';
    };
    const bajar = () => out.toBlob((blob) => { devolver(); if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `decfreedom-footprint-${_par}-${Date.now()}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }, 'image/png');
    const logo = new Image(); let hecho = false;
    const una = (w) => { if (hecho) return; hecho = true; textos(w ? 20 * e2 + w + 18 * e2 : 20 * e2); bajar(); };
    logo.onload = () => { try { const alto = 52 * e2, ancho = Math.round(logo.width * (alto / logo.height)); g.drawImage(logo, 20 * e2, yB + (barra - alto) / 2, ancho, alto); una(ancho); } catch (_) { una(0); } };
    logo.onerror = () => una(0); setTimeout(() => una(0), 1500); logo.src = LOGO;
  } catch (_) { devolver(); }
}

/* ══════════════════ SHARE SIGNAL (misma dinámica que Heat Pools, adaptada) ══════════
   Copia un texto y genera una IMAGEN: gráfico + columnas ENTRY/STOP/TARGET de las
   posiciones (single/double), R:R 1:2, logo de la moneda, sección, fecha, precio y
   temporalidad. Solo se usa con Single/Double activo. */
function compartirSenal() {
  const pos = M._posAuto || posicionesDeNiveles();
  const sh = $('vv-share');
  const flash = (m) => { if (sh) { const t = sh.dataset.base || sh.textContent; sh.dataset.base = t; sh.textContent = m; setTimeout(() => { sh.textContent = t; }, 1500); } };
  if (!pos.length) { flash('No signals'); return; }
  const par = PARES.find((p) => p.id === _par) || { id: _par };
  const dec = (v) => { const a = Math.abs(v); return a >= 1000 ? v.toFixed(1) : a >= 1 ? v.toFixed(3) : v.toFixed(5); };
  const hora = new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
  const precio = M.precio ? dec(M.precio) : '—';
  const ents = pos.map((p) => dec(p.pe)), sls = pos.map((p) => dec(p.pStop)), tps = pos.map((p) => dec(p.pTarget));
  const n = ents.length;
  const lista = (arr) => arr.map((v, i) => `${i + 1}: ${v}`).join('\n');
  const tipoTxt = M.sig ? `${etiquetaSig(M.sig)} · ${M.sig.largo ? 'LONG' : 'SHORT'}\n` : '';
  const txt = `FOOTPRINT — SIGNAL\n${tipoTxt}\n${par.id} · ${M.tf} · ${hora} UTC · Price ${precio}\n\nENTRY\n${lista(ents)}\n\nSTOP LOSS\n${lista(sls)}\n\nTAKE PROFIT\n${lista(tps)}\n\nRISK : REWARD — 1:2\n\n${WEB} · Footprint`;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => flash('Copied ✓')).catch(() => {});

  const chart = $('vv-cv');
  const W = 1180, BG = '#0a0d12';
  const chartH = chart && chart.width ? Math.round(W * (chart.height / chart.width)) : 0;
  const padX = 54, headH = 156, rowH = 56, rrH = 92, footH = 84;
  const H = chartH + headH + n * rowH + rrH + footH;
  const cv = document.createElement('canvas'), g = cv.getContext('2d'); cv.width = W; cv.height = H;
  const cargar = (src, cors) => new Promise((res) => { if (!src) return res(null); const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const prep = (async () => {
    const sym = par.id.toLowerCase();
    let coin = await cargar(`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym}.png`, true);
    if (!coin && par.cg) {                                   // spothq no tiene monedas nuevas (p.ej. JUP) → respaldo CoinGecko
      if (!(window.__aurexLogos && window.__aurexLogos[par.cg])) { try { await asegurarLogos(); } catch (_) {} }
      if (window.__aurexLogos && window.__aurexLogos[par.cg]) coin = await cargar(window.__aurexLogos[par.cg], true);
    }
    const marca = await cargar(LOGO, false);
    return [coin, marca];
  })();
  prep.then(([coin, marca]) => {
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    if (chart && chart.width) g.drawImage(chart, 0, 0, W, chartH);
    const y0 = chartH;
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y0 + 0.5); g.lineTo(W, y0 + 0.5); g.stroke();
    const ls = 72, lx = padX, ly = y0 + 30;
    g.save(); g.beginPath(); g.arc(lx + ls / 2, ly + ls / 2, ls / 2, 0, 6.2832); g.closePath();
    g.fillStyle = coin ? '#ffffff' : '#141b25'; g.fill();
    if (coin) { g.clip(); g.drawImage(coin, lx, ly, ls, ls); }
    else { g.fillStyle = '#E8B84B'; g.font = '800 24px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(par.id.slice(0, 4), lx + ls / 2, ly + ls / 2 + 1); }
    g.restore();
    if (coin) { g.strokeStyle = 'rgba(232,184,75,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(lx + ls / 2, ly + ls / 2, ls / 2, 0, 6.2832); g.stroke(); }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const tx = lx + ls + 24;
    g.fillStyle = '#E8B84B'; g.font = '800 40px system-ui,sans-serif'; g.fillText('Foot', tx, y0 + 56);
    const hw = g.measureText('Foot').width;
    g.fillStyle = '#e8ecf2'; g.font = '800 40px system-ui,sans-serif'; g.fillText('print', tx + hw, y0 + 56);
    g.fillStyle = '#8b95a1'; g.font = '600 18px ui-monospace,monospace';
    g.fillText(`${par.id}    ·    ${M.tf}    ·    ${hora} UTC    ·    Price ${precio}`, tx, y0 + 88);
    const colBlock = 250;
    const xs = [padX, Math.round(W / 2 - colBlock / 2), W - padX - colBlock];
    const cols = [['ENTRY', ents, '#e8ecf2'], ['STOP LOSS', sls, '#ff5b6e'], ['TARGET', tps, '#2ee86a']];
    const colY = y0 + headH;
    cols.forEach((c, ci) => {
      const cx = xs[ci]; g.textAlign = 'left';
      g.fillStyle = c[2]; g.font = '800 20px system-ui,sans-serif'; g.fillText(c[0], cx, colY);
      g.strokeStyle = c[2]; g.globalAlpha = .3; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, colY + 13); g.lineTo(cx + colBlock, colY + 13); g.stroke(); g.globalAlpha = 1;
      c[1].forEach((v, i) => {
        const ry = colY + 46 + i * rowH;
        g.fillStyle = '#5a6570'; g.font = '700 17px ui-monospace,monospace'; g.fillText(String(i + 1), cx, ry);
        g.fillStyle = '#eef2f6'; g.font = '800 27px ui-monospace,monospace'; g.fillText(v, cx + 32, ry + 2);
      });
    });
    const rry = colY + 46 + n * rowH + 40;
    g.textAlign = 'center';
    g.fillStyle = '#8b95a1'; g.font = '700 18px system-ui,sans-serif'; g.fillText('RISK : REWARD', W / 2 - 60, rry);
    g.fillStyle = '#E8B84B'; g.font = '800 26px system-ui,sans-serif'; g.fillText('1 : 2', W / 2 + 90, rry + 1);
    const fy = H - footH;
    g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(0, fy, W, footH);
    g.strokeStyle = 'rgba(232,184,75,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, fy + 0.5); g.lineTo(W, fy + 0.5); g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'middle';
    let dx = padX;
    if (marca) { const mh = 46, mw = marca.width * (mh / marca.height); g.drawImage(marca, padX, fy + (footH - mh) / 2, mw, mh); dx = padX + mw + 18; }
    g.fillStyle = '#dfe5ec'; g.font = '700 19px system-ui,sans-serif'; g.fillText(WEB, dx, fy + footH / 2 + 1);
    g.fillStyle = '#E8B84B'; g.font = '800 19px system-ui,sans-serif'; g.textAlign = 'right'; g.fillText('Footprint', W - padX, fy + footH / 2 + 1);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    try { cv.toBlob((b) => { if (!b) return; const url = URL.createObjectURL(b), a = document.createElement('a'); a.href = url; a.download = `decfreedom-footprint-${par.id}-${M.tf}-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); }, 'image/png'); } catch (e) { flash('Copied ✓'); }
  });
}

/* ══════════════════ AYUDA (stepper experto, igual que Heat Pools) ══════════════════ */
const PASOS_RZ = [
  {
    t: 'What Footprint is',
    d: 'Footprint reads the <b>executed tape</b>, not the order book. For every candle it measures <b>delta</b> = aggressive <b>buy</b> volume minus aggressive <b>sell</b> volume (the takers who cross the spread). Add each delta up and you get the <b>CVD</b> (cumulative volume delta): the real, running balance of pressure that moves price. This is the read professional desks pay for.',
    x: 'It is a different axis from structure, VWAP or the order book: it is who is actually hitting the market.'
  },
  {
    t: 'The CVD panel',
    d: 'The lower panel is the engine room. The <b>gold line</b> is the CVD; the <b>green/red bars</b> are each candle&#39;s delta. When the CVD <b>rises</b>, buyers are in control; when it <b>falls</b>, sellers are. What matters most is when the CVD and price <b>disagree</b> — that gap is the edge the chip at the top-left names for you.',
    x: 'Price tells you where; delta tells you who. Reading them together is the whole point.'
  },
  {
    t: 'Absorption',
    d: 'A burst of <b>aggressive selling</b> hits but price <b>refuses to drop</b> — a passive buyer is soaking it all up. That is <b>absorption</b>, and it flips the move: the side that absorbs usually wins. The tool marks the candle and projects a trade <b>in the direction of the absorber</b> (long when buyers absorb, short when sellers do).',
    x: 'Heavy volume with no price progress is the tell. The market tried and failed — fade the failure.'
  },
  {
    t: 'Delta divergence',
    d: 'Price prints a <b>higher high</b> but the CVD makes a <b>lower high</b>: the push is running on fumes, buying is <b>exhausted</b> → short. The mirror (lower low in price, higher low in CVD) means selling is spent → long. Divergence is the classic order-flow <b>reversal</b> read.',
    x: 'A new price extreme that the flow does not confirm is a trap forming, not a breakout.'
  },
  {
    t: 'Delta-confirmed break',
    d: 'A break of a level is only worth taking when the <b>flow backs it</b>. Footprint confirms a breakout only when the delta of the breaking candle is <b>strongly aligned</b> and the CVD is pushing the same way → <b>continuation</b>. Breaks without delta behind them are filtered out — those are the fakeouts that trap price traders.',
    x: 'This single filter is why the tool exists: it separates the real break from the liquidity grab.'
  },
  {
    t: 'Take the trade (Single / Double)',
    d: 'Every signal projects a full ticket: <b>EN</b> entry, <b>SL</b> at the flow&#39;s invalidation and <b>TP</b> at <b>1:2</b>. Tap <b>Single</b> for one entry; tap <b>Double</b> to add a <b>deeper backup</b> at a better price that <b>shares the same stop</b>. <b>Right-click</b> the chart for your own order or alert, and <b>Share signal</b> exports it with levels and watermark.',
    x: 'Scale in, never martingale: both fills share ONE invalidation, so the pair still risks about 1R, not 3R.'
  },
  {
    t: 'Manage risk like a professional',
    d: 'Pick the <b>coin</b> and <b>timeframe</b> up top; higher timeframes give cleaner flow, lower ones react faster with more noise. Risk a <b>fixed small percentage</b> per idea and let the 1:2 work. Trade <b>with</b> the flow, not against it — when the CVD and your idea point the same way, you are on the right side of the tape.',
    x: 'Analysis only: nothing here is executed for you, and no signal is a guarantee. Risk is managed, never removed.'
  }
];
let _pasoRZ = 0;
function ayuda() {
  if ($('vv-ayuda-box')) { $('vv-ayuda-box').remove(); return; }
  _pasoRZ = 0;
  const d = document.createElement('div'); d.id = 'vv-ayuda-box';
  d.innerHTML = `<div class="vv-ab-bg"></div>
    <div class="vv-ab-c">
      <button class="vv-ab-x" aria-label="Close">✕</button>
      <div class="vv-ab-eyebrow">Footprint</div>
      <div id="vv-ab-cuerpo"></div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  d.querySelector('.vv-ab-bg').onclick = q; d.querySelector('.vv-ab-x').onclick = q;
  pintarPasoRZ();
}
function pintarPasoRZ() {
  const c = $('vv-ab-cuerpo'); if (!c) return;
  const p = PASOS_RZ[_pasoRZ]; const ultimo = _pasoRZ === PASOS_RZ.length - 1;
  c.innerHTML = `
    <div class="vv-ab-card">
      <div class="vv-ab-n">${_pasoRZ + 1} <em>of ${PASOS_RZ.length}</em></div>
      <div class="vv-ab-t">${p.t}</div>
      <div class="vv-ab-d">${p.d}</div>
      <div class="vv-ab-x2">${p.x}</div>
    </div>
    <div class="vv-ab-dots">${PASOS_RZ.map((_, i) => `<i class="${i === _pasoRZ ? 'on' : ''}" data-paso="${i}"></i>`).join('')}</div>
    <div class="vv-ab-acts">
      ${_pasoRZ > 0 ? '<button class="vv-ab-back" id="vv-ab-back">Back</button>' : ''}
      <button class="vv-ab-next" id="vv-ab-next">${ultimo ? 'Got it' : 'Learn more'}</button>
    </div>`;
  $('vv-ab-next').onclick = () => { if (_pasoRZ >= PASOS_RZ.length - 1) { $('vv-ayuda-box')?.remove(); return; } _pasoRZ++; pintarPasoRZ(); };
  const at = $('vv-ab-back'); if (at) at.onclick = () => { _pasoRZ = Math.max(0, _pasoRZ - 1); pintarPasoRZ(); };
  c.querySelectorAll('[data-paso]').forEach((b) => b.onclick = () => { _pasoRZ = Number(b.dataset.paso); pintarPasoRZ(); });
}

/* ══════════════════ ESTILOS ══════════════════ */
let _css = false;
function estilos() {
  if (_css || $('vv-css')) { _css = true; return; } _css = true;
  const s = document.createElement('style'); s.id = 'vv-css'; s.textContent = CSS; document.head.appendChild(s);
}
const CSS = `
/* z-index a la PAR de las pools (9740): el menú de clic derecho de orden.js vive
   en 9860, así que con 10030 el menú salía DETRÁS de la gráfica y parecía que el
   clic derecho "no hacía nada". A 9740 el menú/ficha/alerta se ven por encima,
   igual que en Liquidity/Heat/Smart. Los popups propios (vv-pop 10050, ayuda
   10300) siguen por encima porque son fixed con su propio z-index. */
#vv-overlay{position:fixed;inset:0;z-index:9740;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#e7ebf0;
  --g:#28d26a; --r:#ff4a5a; --gold:#E8B84B; --line:#1d2630; --mono:"Chakra Petch",ui-monospace,monospace}
#vv-overlay *{box-sizing:border-box}
.vv-bg{position:absolute;inset:0;background:radial-gradient(1100px 560px at 80% -10%,rgba(232,184,75,.04),transparent 60%),#070b10}
.vv-c{position:relative;width:100%;height:100%;display:flex;flex-direction:column}
.vv-barra{display:flex;align-items:center;gap:10px;height:54px;flex:0 0 auto;padding:0 12px;background:linear-gradient(180deg,#0e141b,#090d12);border-bottom:1px solid var(--line)}
.vv-back{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px 0 10px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#c3cad3;cursor:pointer;font-weight:700;font-size:13px}
.vv-back svg{width:14px;height:14px}
.vv-back:hover{border-color:var(--gold);color:var(--gold)}
.vv-sel{display:inline-flex;align-items:center;gap:9px;height:38px;padding:0 11px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#e7ebf0;cursor:pointer}
.vv-sel:hover{border-color:var(--gold)}
.vv-sel b{font-family:var(--mono);font-weight:800;font-size:14px}
.vv-sel span{color:#7d8794;font-size:12.5px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vv-sel svg{width:11px;height:11px;color:#7d8794}
.vv-logo,.vv-mini{flex:0 0 auto;border-radius:50%;background:#1b222c center/cover no-repeat;display:grid;place-items:center;font-family:var(--mono);font-weight:800;color:var(--gold);border:1px solid #2a333f;overflow:hidden}
.vv-logo{width:24px;height:24px;font-size:11px}
.vv-mini{width:19px;height:19px;font-size:9px}
.vv-logo.con,.vv-mini.con{border-color:transparent;color:transparent}
.vv-logo.con-svg,.vv-mini.con-svg{background:none;border:none}
.vv-logo.con-svg svg,.vv-mini.con-svg svg{width:100%;height:100%}
.vv-tfchip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:11px;background:#12161c;border:1px solid #2b3139;color:#eaecef;cursor:pointer;font-family:var(--mono);font-weight:800;font-size:13.5px}
.vv-tfchip svg{width:12px;height:12px;color:#8b96a3}
.vv-tfchip:hover{border-color:var(--gold)}
.vv-px{display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:84px}
.vv-px-v{font-family:var(--mono);font-weight:800;font-size:18px;line-height:1}
.vv-px-v.up{color:var(--g)} .vv-px-v.down{color:var(--r)}
.vv-hl{display:flex;gap:10px;font-family:var(--mono);font-size:10px;color:#7d8794}
.vv-hl b{font-weight:800} .vv-hl span:first-child b{color:var(--g)} .vv-hl span:last-child b{color:var(--r)}
.vv-badge{font-family:var(--mono);font-size:9.5px;font-weight:800;letter-spacing:.08em;padding:3px 8px;border-radius:6px;background:rgba(232,184,75,.14);color:var(--gold);border:1px solid rgba(232,184,75,.3)}
.vv-badge-spot{background:rgba(40,210,100,.12);color:#54e08a;border-color:rgba(40,210,100,.3)}
.vv-estado{font-family:var(--mono);font-size:11px;color:var(--r)}
.vv-der{display:flex;align-items:center;gap:9px;margin-left:auto}
.vv-pos-split{display:inline-flex;flex:0 0 auto;height:36px;border-radius:9px;overflow:hidden;border:1px solid rgba(232,184,75,.55);background:rgba(232,184,75,.06)}
.vv-pos-half{background:transparent;border:0;color:#d8b24a;font:700 12px system-ui,sans-serif;padding:0 13px;cursor:pointer;letter-spacing:.2px;transition:background .15s,color .15s}
.vv-pos-half+.vv-pos-half{border-left:1px solid rgba(232,184,75,.35)}
.vv-pos-half:hover{background:rgba(232,184,75,.14)}
.vv-pos-half.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800}
.vv-share{height:36px;border-radius:9px;border:1px solid rgba(46,232,106,.55);background:rgba(46,232,106,.08);color:#39e07a;font:700 12px system-ui,sans-serif;padding:0 14px;cursor:pointer;white-space:nowrap;transition:filter .15s,opacity .15s}
.vv-share:hover{filter:brightness(1.15)}
.vv-share:disabled{opacity:.4;cursor:not-allowed;filter:none}
.vv-ico{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#9aa4af;font-weight:800}
.vv-ico:hover{border-color:var(--gold);color:var(--gold)}
.vv-graf{flex:1 1 auto;min-height:0;position:relative;background:#0a0e14}
.vv-cv{display:block;position:absolute;inset:0}
.vv-marca{position:absolute;left:64px;bottom:40px;height:42px;width:auto;opacity:.8;pointer-events:none;filter:drop-shadow(0 2px 9px rgba(0,0,0,.95))}
.vv-esperando{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:30px;background:rgba(10,14,20,.6);z-index:2}
.vv-esperando b{font-family:var(--mono);font-size:14px;color:#cbd3dc}
.vv-esperando span{font-size:12px;color:#7d8794;max-width:280px}
.vv-spin{width:30px;height:30px;border:2.5px solid rgba(232,184,75,.2);border-top-color:var(--gold);border-radius:50%;animation:vv-sp .8s linear infinite}
@keyframes vv-sp{to{transform:rotate(360deg)}}
.vv-pop{position:fixed;z-index:10050;background:#0c1016;border:1px solid #2a333f;border-radius:12px;box-shadow:0 20px 55px rgba(0,0,0,.65);font-family:var(--mono);color:#e7ebf0}
.vv-picker,.vv-pop.vv-tfpop{}
#vv-picker{width:300px;max-height:70vh;display:flex;flex-direction:column;overflow:hidden}
.vv-cm-top{padding:8px;border-bottom:1px solid var(--line)}
.vv-cm-top input{width:100%;height:32px;border-radius:8px;border:1px solid #2a333f;background:#0a0d12;color:#e7ebf0;padding:0 11px;font-size:12.5px;font-family:var(--mono);outline:none}
.vv-cm-top input:focus{border-color:var(--gold)}
.vv-cm-list{overflow-y:auto;padding:6px}
.vv-cm-cat{font-size:9px;letter-spacing:.14em;color:var(--gold);text-transform:uppercase;padding:8px 8px 4px}
.vv-cm-it{display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 9px;border-radius:8px;border:0;background:transparent;color:#e7ebf0;cursor:pointer;text-align:left;font-size:13px}
.vv-cm-it:hover{background:rgba(232,184,75,.1)} .vv-cm-it.on{background:rgba(232,184,75,.16)}
.vv-cm-it b{font-family:var(--mono);min-width:50px;color:var(--gold);font-weight:800}
.vv-cm-it span{color:#7d8794;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vv-tfpop{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:6px;min-width:210px;background:#12161c;border-color:#2b3139;border-radius:14px}
.vv-tf-it{min-height:42px;border-radius:10px;border:1px solid transparent;background:rgba(255,255,255,.04);color:#c7cdd6;cursor:pointer;font-family:var(--mono);font-size:13px;font-weight:700}
.vv-tf-it:hover{border-color:#3a424c;color:#eaecef}
.vv-tf-it.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;border-color:var(--gold)}
/* ── Ayuda: stepper experto (igual que Heat Pools) ── */
#vv-ayuda-box{position:fixed;inset:0;z-index:10300;display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Plus Jakarta Sans",system-ui,sans-serif}
.vv-ab-bg{position:absolute;inset:0;background:rgba(3,5,8,.93)}
.vv-ab-c{position:relative;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid #C9A84B;border-radius:20px;padding:24px 20px}
.vv-ab-x{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;padding:0;cursor:pointer;font-size:15px;z-index:5;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6}
.vv-ab-eyebrow{font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:2px;text-align:center;margin-bottom:18px}
.vv-ab-card{padding:24px 20px;border-radius:16px;text-align:center;margin-bottom:18px;background:linear-gradient(165deg,rgba(232,184,75,.08),rgba(255,255,255,.015));border:1px solid rgba(232,184,75,.26)}
.vv-ab-n{font-family:var(--mono);font-size:11px;color:var(--gold);font-weight:700;margin-bottom:10px}
.vv-ab-n em{font-style:normal;color:#5c6672;font-weight:400}
.vv-ab-t{font-weight:800;font-size:21px;color:#eaecef;margin-bottom:12px;line-height:1.25}
.vv-ab-d{font-size:14px;color:#b7bdc6;line-height:1.65;margin-bottom:14px}
.vv-ab-d b{color:var(--gold);font-weight:700}
.vv-ab-x2{padding:12px 14px;border-radius:11px;background:rgba(255,255,255,.035);border-left:2px solid #C9A84B;font-size:12.5px;color:#8b96a3;line-height:1.55;text-align:left}
.vv-ab-dots{display:flex;gap:5px;justify-content:center;margin-bottom:18px;flex-wrap:wrap}
.vv-ab-dots i{width:7px;height:7px;border-radius:50%;background:#2b3139;cursor:pointer;transition:background .18s,transform .18s}
.vv-ab-dots i.on{background:var(--gold);transform:scale(1.35)}
.vv-ab-acts{display:flex;gap:9px}
.vv-ab-back{flex:0 0 auto;min-height:48px;padding:0 20px;border-radius:12px;background:transparent;border:1px solid #2b3139;color:#8b96a3;cursor:pointer;font-weight:700;font-size:13px}
.vv-ab-back:hover{border-color:#3a424c;color:#b7bdc6}
.vv-ab-next{flex:1;min-height:48px;border-radius:12px;border:0;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;font-weight:800;font-size:14px;cursor:pointer}
@media(max-width:900px){ .vv-sel span,.vv-px,.vv-badge{display:none} }
`;
