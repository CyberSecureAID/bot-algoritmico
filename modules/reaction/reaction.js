/* modules/reaction/reaction.js — "Reaction Zones".

   Cuarta/quinta sección de Analysis. Transpone la lógica de detección de niveles
   donde el precio reacciona (motor.js) a NUESTRA gráfica, con la MISMA dinámica
   que Smart/Heat/Liquidity Pools: barra superior idéntica (Back · moneda+lista ·
   temporalidad · precio+máx/mín · export con marca de agua · ayuda), barra de
   dibujo compartida (barra.js), órdenes/alertas con clic derecho (orden.js),
   catálogo único de monedas (config.js), y botón Single/Double como Heat Pools.

   Color INVERTIDO a propósito: nivel superior (resistencia) = ROJO = SHORT;
   nivel inferior (soporte) = VERDE = LONG. Todo con animación (puntos y
   triángulos titilando, zonas con latido). */

import { montarBarra } from '../../assets/js/niveles/barra.js?v=1';
import { PARES, pintarIcono, TFS } from '../../assets/js/niveles/config.js?v=1';
import { detectarReaction, zoneBounds, touchRings } from './motor.js?v=2';
import { N } from '../../assets/js/niveles/estado.js?v=1';
import { cargarDib } from '../../assets/js/niveles/dibujo.js?v=1';

const WEB = 'decfreedom.com';
/* Ruta del logo resuelta contra la URL del script (no del documento): así
   /assets/img/cco-marca.png carga igual aunque la página se sirva desde
   /modules/analysis/. Es la marca de agua del export y del lienzo. */
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let _par = 'BTC';

const M = {
  tf: '1h', velas: [], precio: 0, data: { live: [], dead: [], triangles: [] },
  ancho: window.innerWidth < 760 ? 70 : 120, desplaz: 0, zoomY: 1, offsetY: 0,
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
  return j.map((x) => ({ t: Math.floor(x[0] / 1000), o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: +x[7] || +x[5] || 0 }));
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
export async function abrirReaction() {
  estilos();
  const prev = $('rz-overlay'); if (prev) prev.remove();
  M.velas = []; M.data = { live: [], dead: [], triangles: [] }; M.cargando = true; M.error = null;
  M._modoPos = null; M._posAuto = null;

  const p0 = PARES.find((p) => p.id === _par) || PARES[0]; _par = p0.id;
  const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
  const d = document.createElement('div');
  d.id = 'rz-overlay';
  d.innerHTML = `<div class="rz-bg"></div>
    <div class="rz-c">
      <div class="rz-barra">
        <button class="rz-back" id="rz-back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>Back</button>
        <button class="rz-sel" id="rz-sel"><i class="rz-logo" id="rz-logo" data-cg="${esc(p0.cg || '')}" data-ico="${esc(p0.ico || '')}"></i><b id="rz-par">${esc(_par)}</b><span id="rz-nm">${esc(p0.n || '')}</span>${chev}</button>
        <button class="rz-tfchip" id="rz-tfchip" type="button"><b id="rz-tfchip-t">${esc((TFS.find((t) => t.id === M.tf) || TFS[0]).n)}</b>${chev}</button>
        <div class="rz-px"><div class="rz-px-v" id="rz-px">—</div><div class="rz-hl"><span>H <b id="rz-hi">—</b></span><span>L <b id="rz-lo">—</b></span></div></div>
        <span class="rz-badge">ANALYSIS</span><span class="rz-badge rz-badge-spot">SPOT</span>
        <span id="rz-estado" class="rz-estado"></span>
        <div class="rz-der">
          <div class="rz-pos-split" id="rz-pos-split" title="Positions">
            <button class="rz-pos-half" id="rz-pos-single">Single</button>
            <button class="rz-pos-half" id="rz-pos-double">Double</button>
          </div>
          <button class="rz-share" id="rz-share" title="Share signal" disabled>Share signal</button>
          <button class="rz-ico" id="rz-foto" title="Share image"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.5"/></svg></button>
          <button class="rz-ico" id="rz-ayuda" title="How it works">?</button>
        </div>
      </div>
      <div class="rz-graf" id="rz-graf">
        <canvas class="rz-cv" id="rz-cv"></canvas>
        <div class="rz-esperando" id="rz-esperando"><div class="rz-spin"></div><b>Scanning structure…</b><span>Mapping the levels where price is likely to react.</span></div>
        <img class="rz-marca" id="rz-marca" src="${LOGO}" alt="">
      </div>
    </div>`;
  document.body.appendChild(d);

  d.querySelector('.rz-bg').onclick = cerrar;
  $('rz-back').onclick = cerrar;
  $('rz-sel').onclick = (e) => { e.stopPropagation(); menuPares(); };
  $('rz-ayuda').onclick = ayuda;
  $('rz-foto').onclick = guardarImagen;
  $('rz-share').onclick = () => compartirSenal();
  $('rz-tfchip').onclick = (e) => { e.stopPropagation(); menuTf(); };
  { const bS = $('rz-pos-single'), bD = $('rz-pos-double'), bSh = $('rz-share');
    const set = (modo) => { M._modoPos = (M._modoPos === modo) ? null : modo; bS.classList.toggle('on', M._modoPos === 'single'); bD.classList.toggle('on', M._modoPos === 'double'); if (bSh) bSh.disabled = !M._modoPos; M._posAuto = null; if (!M._modoPos) M.desplaz = 0; dibujar(); };
    bS.onclick = () => set('single'); bD.onclick = () => set('double'); }

  ponerLogos();
  cargarVelas();
  clearInterval(_pulso);
  _pulso = setInterval(() => { if ($('rz-cv')) dibujar(); }, 90);   // ~11fps: titilar/latido fluido
  let _t = null; M._onResize = () => { clearTimeout(_t); _t = setTimeout(() => { if ($('rz-cv')) dibujar(); }, 200); };
  window.addEventListener('resize', M._onResize);
}

function cerrar() {
  clearInterval(_reloj); clearInterval(_pulso);
  if (M._onResize) window.removeEventListener('resize', M._onResize);
  if (_barra) { try { _barra.desmontar(); } catch (_) {} _barra = null; }
  document.querySelectorAll('#rz-picker, #rz-tfmenu, #rz-ayuda-box').forEach((x) => x.remove());
  const e = $('rz-overlay'); if (e) e.remove();
  const sel = $('an-sel'); if (sel) sel.style.display = '';   // vuelve al selector de Analysis
}

async function cargarVelas() {
  M.cargando = true;
  const p = PARES.find((x) => x.id === _par) || {};
  try {
    M.velas = await traerVelas(p.s, M.tf, 700);
    M.cargando = false;
    if (M.velas.length) { M.precio = M.velas[M.velas.length - 1].c; recalcular(); }
    const est = $('rz-estado'); if (est) est.textContent = '';
  } catch (e) { M.cargando = false; M.error = 'feed'; const est = $('rz-estado'); if (est) est.textContent = 'Market data unavailable.'; }
  dibujar();
  clearInterval(_reloj);
  _reloj = setInterval(async () => {
    try { const v = await traerVelas(p.s, M.tf, 700); M.velas = v; if (v.length) M.precio = v[v.length - 1].c; recalcular(); dibujar(); } catch (_) {}
  }, 15000);
}
function recalcular() {
  try { M.data = detectarReaction(M.velas); } catch (_) { M.data = { live: [], dead: [], triangles: [] }; }
  M._posAuto = null;   // reproyecta las posiciones al nivel más cercano: la herramienta "sigue al precio"
  refrescarCabecera();
}
function refrescarCabecera() {
  const px = $('rz-px'), hi = $('rz-hi'), lo = $('rz-lo');
  if (!M.velas.length) return;
  const u = M.velas[M.velas.length - 1];
  // máx/mín del día (24h): últimas ~24h según TF
  let dH = u.h, dL = u.l; const back = Math.min(M.velas.length, tfPorDia(M.tf));
  for (let k = M.velas.length - back; k < M.velas.length; k++) { if (M.velas[k].h > dH) dH = M.velas[k].h; if (M.velas[k].l < dL) dL = M.velas[k].l; }
  if (px) { px.textContent = fmt(M.precio); px.className = 'rz-px-v ' + (u.c >= u.o ? 'up' : 'down'); }
  if (hi) hi.textContent = fmt(dH); if (lo) lo.textContent = fmt(dL);
}
function tfPorDia(tf) { const m = { '1m': 1440, '3m': 480, '5m': 288, '15m': 96, '30m': 48, '1h': 24, '2h': 12, '4h': 6, '6h': 4, '12h': 2, '1d': 1, '1w': 1 }; return m[tf] || 24; }

/* ══════════════════ RENDER ══════════════════ */
function pal() { return { fondo: '#0a0e14', rejilla: 'rgba(255,255,255,.04)', ink: '#e7ebf0', dim: '#7d8794' }; }

function dibujar() {
  const cv = $('rz-cv'), zona = $('rz-graf'); if (!cv || !zona) return;
  const W = zona.clientWidth, H = zona.clientHeight; if (W < 50 || H < 50) return;

  if (!cv.dataset.listo) {
    engancharGestos(cv);
    cv.dataset.listo = '1';
    _barra = montarBarra(zona);
    // barra.js solo carga los dibujos cuando el par CAMBIA (par !== N.par). Como
    // N.par arranca en 'BTC' por defecto, al abrir en BTC nunca se cargaban y
    // N.dibujos quedaba undefined → al soltar un trazo, soltarDib() reventaba
    // (push sobre undefined) y la barra quedaba congelada. Lo garantizamos aquí.
    try { N.par = _par; cargarDib(); } catch (_) { N.dibujos = N.dibujos || []; }
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

  const esp = $('rz-esperando');
  if (M.cargando || !M.velas.length) { if (esp) esp.style.display = ''; return; }
  if (esp) esp.style.display = 'none';

  const mDer = 66, mAba = 22;
  const x1 = W - mDer, y1 = H - mAba, xVelas = x1;
  const ancho = Math.min(M.velas.length, M.ancho || 100);
  const huecoMax = Math.floor(ancho * 0.45);
  // Con Single/Double activo se reserva hueco a la derecha para proyectar las
  // cajas de posición ADELANTADAS al precio (igual que Heat Pools).
  const futNec = M._modoPos ? Math.min(huecoMax, M._modoPos === 'double' ? 32 : 16) : 0;
  let desp = Math.max(-huecoMax, Math.min(M.desplaz || 0, Math.max(0, M.velas.length - ancho)));
  if (futNec && (M.desplaz || 0) <= 0 && desp > -futNec) desp = -futNec;
  M.desplaz = desp;
  const fin = M.velas.length - desp;
  const vis = M.velas.slice(Math.max(0, fin - ancho), Math.min(M.velas.length, fin));
  if (!vis.length) return;
  if (desp <= 0 && M.precio > 0) { const u = vis[vis.length - 1]; u.c = M.precio; if (M.precio > u.h) u.h = M.precio; if (M.precio < u.l) u.l = M.precio; }

  let pAlto = Math.max(...vis.map((v) => v.h)), pBajo = Math.min(...vis.map((v) => v.l));
  if (M.precio > 0) { pAlto = Math.max(pAlto, M.precio); pBajo = Math.min(pBajo, M.precio); }
  // abre la escala para que entren los niveles cercanos (con tope del 45%)
  const rV0 = (pAlto - pBajo) || 1, capHi = pAlto + rV0 * 0.45, capLo = pBajo - rV0 * 0.45;
  (M.data.live || []).forEach((lv) => { if (lv.p <= capHi && lv.p >= pBajo) pAlto = Math.max(pAlto, lv.p); if (lv.p >= capLo && lv.p <= pAlto) pBajo = Math.min(pBajo, lv.p); });
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

  // ── ZONAS: barras MORADAS con barrido de luz (detrás de las velas). Solo barras:
  //    sin triángulos ni rombos. Las recientes salen más intensas. ──
  dibujarZonas(g, x1, Y, pMin, pMax, Xbar, pulso, now, W);

  // ── VELAS ──
  dibujarVelas(g, vis, Y, paso);

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

  // eje de TIEMPO (abajo): fechas/horas, igual que las demás secciones
  g.fillStyle = '#0b0e12'; g.fillRect(0, y1, W, mAba);
  g.fillStyle = pal().dim; g.font = '9px ui-monospace,monospace'; g.textAlign = 'center';
  const cadaX = Math.max(1, Math.floor(vis.length / 7));
  vis.forEach((v, i) => { if (i % cadaX !== 0) return; const x = i * paso + paso / 2; if (x > xVelas - 14) return; g.fillText(fmtFecha(v.t), x, y1 + 14); });
  g.textAlign = 'left';

  // crosshair + tachuelas de precio (der) y hora (abajo)
  if (M._cursor && M._cursor.x < x1 && M._cursor.y < y1 && M._cursor.x > 0 && M._cursor.y > 0) {
    const cx = M._cursor.x, cy = M._cursor.y, pCur = pMin + (pMax - pMin) * ((y1 - cy) / y1);
    g.save(); g.strokeStyle = 'rgba(200,210,224,.4)'; g.lineWidth = 1; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, y1); g.stroke();
    g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke(); g.restore(); g.setLineDash([]);
    g.fillStyle = '#e8ecf2'; redondeado(g, x1 + 2, cy - 9, mDer - 4, 18, 4); g.fill();
    g.fillStyle = '#0b0e12'; g.font = 'bold 10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(fmt(pCur), x1 + 6, cy + 3.5);
    const idx = Math.floor(cx / paso);
    if (idx >= 0 && idx < vis.length) {
      const ht = fmtFecha(vis[idx].t); g.font = 'bold 9px ui-monospace,monospace';
      const hw = g.measureText(ht).width + 12;
      g.fillStyle = '#e8ecf2'; redondeado(g, Math.max(2, Math.min(x1 - hw, cx - hw / 2)), y1 + 3, hw, 15, 4); g.fill();
      g.fillStyle = '#0b0e12'; g.textAlign = 'center'; g.fillText(ht, Math.max(2 + hw / 2, Math.min(x1 - hw / 2, cx)), y1 + 13.5); g.textAlign = 'left';
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

/* ZONAS = barras MORADAS, y nada más (sin triángulos ni rombos). Un BARRIDO de
   luz las recorre de izquierda a derecha, como la iluminación del heatmap de
   Institutional. Las RECIENTES salen más intensas; las ROTAS, tenues y NO
   infinitas (terminan en la ruptura, "detrás del precio"). */
const clip01 = (x) => Math.max(0, Math.min(1, x));
const PURP = '168,85,247', PURP_HI = '203,150,255';
function dibujarZonas(g, x1, Y, pMin, pMax, Xbar, pulso, now, W) {
  const live = M.data.live || [], dead = M.data.dead || [];
  const geo = M._geo; const ancho = geo ? geo.ancho : 1, fin = geo ? geo.fin : 0, pri = fin - ancho;
  // Gradiente de BARRIDO: franjas claras que se desplazan (compartido entre barras).
  const s = (now % 3200) / 3200;
  const gr = g.createLinearGradient(0, 0, W, 0);
  for (let i = 0; i <= 14; i++) { const p = i / 14, b = 0.5 + 0.5 * Math.cos((p - s) * Math.PI * 4); gr.addColorStop(p, `rgba(${PURP_HI},${(0.02 + 0.13 * b).toFixed(3)})`); }
  const uno = (lv, muerto) => {
    if (lv.p > pMax || lv.p < pMin) return;
    const [zTop, zBot] = zoneBounds(lv.upper, lv.p, lv.depth);
    const yTop = Y(Math.max(zTop, zBot)), yBot = Y(Math.min(zTop, zBot));
    const hh = Math.abs(yBot - yTop); if (hh < 1) return;
    const xa = Math.max(0, Xbar(lv.anchorBar));
    let xRight = x1;
    if (muerto) {
      const xb = Xbar(lv.breakBar != null ? lv.breakBar : lv.anchorBar);
      if (xb <= 2) return;   // zona ROTA totalmente fuera por la izquierda → no pintar (evita las "rayitas" pegadas al borde)
      xRight = Math.min(x1, Math.max(xa + 4, xb));
    }
    if (xRight <= xa) return;
    const yTp = Math.min(yTop, yBot), ww = xRight - xa;
    const recency = clip01((lv.anchorBar - pri) / Math.max(1, ancho));   // 0 vieja → 1 reciente
    const at = muerto ? 0.42 : (0.82 + 0.4 * recency);                   // las recientes, más intensas
    // relleno morado base
    const baseA = (0.11 + 0.17 * lv.pressure) * at;
    g.fillStyle = `rgba(${PURP},${baseA.toFixed(3)})`; g.fillRect(xa, yTp, ww, hh);
    // corazón de la zona, más intenso
    const [iTop, iBot] = lv.upper ? [lv.p, lv.p - lv.depth * 0.5] : [lv.p + lv.depth * 0.5, lv.p];
    const yiT = Y(Math.max(iTop, iBot)), yiB = Y(Math.min(iTop, iBot));
    g.fillStyle = `rgba(${PURP},${(baseA * 1.5).toFixed(3)})`; g.fillRect(xa, Math.min(yiT, yiB), ww, Math.abs(yiB - yiT));
    // BARRIDO de luz (solo en las vivas), añadido por encima
    if (!muerto) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(xa, yTp, ww, hh); g.restore(); }
    // bordes INTENSOS (más que el relleno), con leve resplandor en las vivas
    g.save();
    g.lineWidth = muerto ? 1 : (1.5 + 1.4 * lv.pressure);
    g.strokeStyle = `rgba(${PURP_HI},${(muerto ? 0.4 : 0.72 + 0.22 * recency).toFixed(3)})`;
    if (muerto) g.setLineDash([4, 4]); else { g.shadowColor = `rgba(${PURP_HI},${(0.45 + 0.3 * pulso).toFixed(3)})`; g.shadowBlur = 5 + 6 * pulso; }
    g.beginPath(); g.moveTo(xa, yTop); g.lineTo(xRight, yTop); g.stroke();
    g.beginPath(); g.moveTo(xa, yBot); g.lineTo(xRight, yBot); g.stroke();
    g.restore(); g.setLineDash([]);
  };
  dead.forEach((lv) => uno(lv, true));
  live.forEach((lv) => uno(lv, false));
}

function redondeado(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ══════════════════ POSICIONES (Single / Double) ══════════════════
   Puerto FIEL de la herramienta de Heat Pools: cajas de posición ancladas en el
   tiempo y PROYECTADAS a la derecha del precio (adelantadas, listas antes de que
   el precio toque la zona). Short en la resistencia roja más cercana por encima;
   Long en el soporte verde más cercano por debajo. Single = una entrada por lado;
   Double = una segunda que entra donde estaría el stop de la primera (mismo
   diámetro) para "salvar el stop". RR 1:2. Tarjeta minimizada por defecto: un
   botón L/S que se expande al pulsarlo (igual que Heat Pools). */
const _ORD_RZ = ['izq', 'abajo', 'der', 'arriba'];
function mXbar(b) { const g = M._geo; if (!g) return 0; return (b - g.pri) * g.paso + g.paso / 2; }
function mYp(p) { const g = M._geo; if (!g) return 0; return g.y1 - g.y1 * ((p - g.pMin) / Math.max(1e-9, g.pMax - g.pMin)); }
function _hex2rgb(hex) { const n = parseInt((hex || '#2ee86a').slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }

function posicionesDeNiveles() {
  const geo = M._geo; if (!geo) return [];
  const precio = M.precio || (M.velas.length ? M.velas[M.velas.length - 1].c : 0);
  if (!precio) return [];
  const live = (M.data.live || []).filter((lv) => lv.pressure >= 0.3);
  const doble = M._modoPos === 'double';
  const bLast = M.velas.length - 1;
  const W = 13, GAP = 2;                                  // caja y hueco, en velas
  const slotX = (s) => bLast + 1 + s * (W + GAP);
  const sup = live.filter((lv) => lv.upper && lv.p > precio).sort((a, b) => a.p - b.p)[0];   // resistencia más cercana
  const inf = live.filter((lv) => !lv.upper && lv.p < precio).sort((a, b) => b.p - a.p)[0];  // soporte más cercano
  const out = [];
  /* REGLA (idéntica a la de Heat Pools): el TAMAÑO de la caja (= profundidad de
     la zona) marca el STOP; el TAKE PROFIT es el DOBLE (1:2). La entrada va en la
     BASE del rectángulo. En corto el TP va hacia abajo; en largo, hacia arriba.
     Double = una 2ª operación JUSTO AL LADO que entra donde está el stop de la 1ª
     (para "salvar el stop" de la primera). */
  const mk = (tipo, pe, d, slot) => {
    const corto = tipo === 'corto';
    const sl = corto ? pe + d : pe - d;                  // stop = una altura de caja
    const pT = corto ? pe - 2 * d : pe + 2 * d;          // take profit = el doble
    const b0 = slotX(slot);
    // Color de las rayas de precio: principal blanco, respaldo (doble) dorado,
    // para distinguir los precios de una operación y de la otra.
    const lineCol = slot === 0 ? '#eaecef' : '#E8B84B';
    return { tipo, pe, pStop: sl, pTarget: pT, b0, b1: b0 + W, rr: 2, oculto: true, cardPos: 'izq', slot, lineCol };
  };
  if (sup) {
    const d = sup.depth, base = sup.p - d;               // base de la zona de resistencia (zBot)
    out.push(mk('corto', base, d, 0));
    if (doble) out.push(mk('corto', base + d, d, 1));    // la 2ª entra en el stop de la 1ª
  }
  if (inf) {
    // LONG: la entrada va ARRIBA de la caja (borde superior de la zona de soporte,
    // el más cercano al precio), el stop ABAJO (borde inferior) y el TP el doble
    // hacia arriba. Simétrico al short (que ya estaba bien).
    const d = inf.depth, base = inf.p + d;               // borde superior de la zona (zTop)
    out.push(mk('largo', base, d, 0));
    if (doble) out.push(mk('largo', base - d, d, 1));    // la 2ª entra en el stop de la 1ª (= inf.p)
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
  let ax = 0, ay = 0, arr = false, dragEsc = false; const enEscala = (x) => x > cv.clientWidth - 66;
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
    ax = lx; ay = ly; dragEsc = enEscala(lx); arr = true;
    cv.style.cursor = dragEsc ? 'ns-resize' : 'grabbing';
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
      cv.style.cursor = ptr ? 'pointer' : (enEscala(x) ? 'ns-resize' : 'crosshair');   // eje de precios → estirar
      if (M._geo) dibujar(); return;
    }
    if (dragEsc) {   // arrastre sobre el eje de precios → estira/contrae la escala vertical (como TradingView)
      const dy = y - ay;
      if (Math.abs(dy) > 1) { M.zoomY = Math.max(0.2, Math.min(6, (M.zoomY || 1) * (1 + dy * 0.004))); ay = y; dibujar(); }
      return;
    }
    const paso = M._geo ? M._geo.paso : 8; const dx = x - ax, dy = y - ay;
    if (Math.abs(dx) > paso) { M.desplaz = (M.desplaz || 0) + Math.round(dx / paso); ax = x; }
    M.offsetY = (M.offsetY || 0) + dy; ay = y; dibujar();
  });
  window.addEventListener('mouseup', () => { arr = false; dragEsc = false; cv.style.cursor = 'crosshair'; });
  cv.addEventListener('mouseleave', () => { M._cursor = null; dibujar(); });
  cv.addEventListener('dblclick', () => { M.ancho = window.innerWidth < 760 ? 70 : 120; M.desplaz = 0; M.zoomY = 1; M.offsetY = 0; dibujar(); });
}

/* ══════════════════ SELECTOR DE MONEDAS / TF ══════════════════ */
const grupoNm = { cripto: 'Crypto', divisa: 'Forex', materia: 'Commodities' };
function menuPares() {
  if ($('rz-picker')) { $('rz-picker').remove(); return; }
  const ancla = $('rz-sel'); const m = document.createElement('div'); m.id = 'rz-picker'; m.className = 'rz-pop';
  const grupos = {}; PARES.forEach((p) => { (grupos[p.grupo || 'cripto'] = grupos[p.grupo || 'cripto'] || []).push(p); });
  let html = '<div class="rz-cm-top"><input id="rz-cm-q" placeholder="Filter…" autocomplete="off"></div><div class="rz-cm-list">';
  ['cripto', 'divisa', 'materia'].forEach((gr) => { if (!grupos[gr]) return; html += `<div class="rz-cm-cat">${grupoNm[gr]}</div>` + grupos[gr].map((p) => `<button class="rz-cm-it ${p.id === _par ? 'on' : ''}" data-id="${esc(p.id)}" data-b="${esc((p.id + ' ' + (p.n || '')).toLowerCase())}"><i class="rz-mini" data-cg="${esc(p.cg || '')}" data-ico="${esc(p.ico || '')}"></i><b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`).join(''); });
  html += '</div>'; m.innerHTML = html; document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, r.left) + 'px';
  ponerLogos(m);
  m.querySelectorAll('.rz-cm-it').forEach((b) => b.onclick = () => { const id = b.dataset.id; m.remove(); if (id !== _par) { _par = id; const p = PARES.find((x) => x.id === id) || {}; const lg = $('rz-logo'); if (lg) { lg.dataset.cg = p.cg || ''; lg.dataset.ico = p.ico || ''; } $('rz-par').textContent = id; $('rz-nm').textContent = p.n || ''; ponerLogos(); M._posAuto = null; cargarVelas(); } });
  const q = m.querySelector('#rz-cm-q'); q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); m.querySelectorAll('.rz-cm-it').forEach((b) => b.style.display = (!v || b.dataset.b.includes(v)) ? '' : 'none'); });
  setTimeout(() => q.focus(), 30);
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function menuTf() {
  if ($('rz-tfmenu')) { $('rz-tfmenu').remove(); return; }
  const ancla = $('rz-tfchip'); const m = document.createElement('div'); m.id = 'rz-tfmenu'; m.className = 'rz-pop rz-tfpop';
  m.innerHTML = TFS.map((t) => `<button class="rz-tf-it ${t.id === M.tf ? 'on' : ''}" data-tf="${t.id}">${esc(t.n)}</button>`).join('');
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); const w = m.offsetWidth || 210;
  m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
  m.querySelectorAll('.rz-tf-it').forEach((b) => b.onclick = () => { M.tf = b.dataset.tf; $('rz-tfchip-t').textContent = (TFS.find((t) => t.id === M.tf) || {}).n || M.tf; m.remove(); M._posAuto = null; cargarVelas(); });
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function ponerLogos(root) {
  (root || document).querySelectorAll('.rz-logo, .rz-mini').forEach((el) => {
    const cg = el.dataset.cg, ico = el.dataset.ico;
    el.style.backgroundImage = '';
    if (ico) { pintarIcono(el); return; }   // divisas (EUR €, GBP £) → moneda SVG
    if (cg && window.__aurexLogos && window.__aurexLogos[cg]) { el.style.backgroundImage = `url(${window.__aurexLogos[cg]})`; el.classList.add('con'); el.textContent = ''; return; }
    el.textContent = (el.closest('[data-id]')?.dataset.id || _par || '?')[0];
  });
  cargarLogosCache(root);
}
let _logosFetch = null;
function cargarLogosCache(root) {
  try { const g = JSON.parse(localStorage.getItem('aurex-logos') || 'null'); if (g && g.datos) { window.__aurexLogos = g.datos; aplicarLogos(root); return; } } catch (_) {}
  if (window.__aurexLogos) { aplicarLogos(root); return; }
  if (_logosFetch) { _logosFetch.then(() => aplicarLogos(root)); return; }
  const ids = PARES.filter((p) => p.cg).map((p) => p.cg).join(',');
  _logosFetch = fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=250&page=1`).then((r) => r.json()).then((j) => { const m = {}; j.forEach((x) => { m[x.id] = x.image; }); window.__aurexLogos = m; try { localStorage.setItem('aurex-logos', JSON.stringify({ cuando: Date.now(), datos: m })); } catch (_) {} }).catch(() => { window.__aurexLogos = {}; });
  _logosFetch.then(() => aplicarLogos(root));
}
function aplicarLogos(root) {
  if (!window.__aurexLogos) return;
  (root || document).querySelectorAll('.rz-logo, .rz-mini').forEach((el) => { if (el.dataset.ico) return; const cg = el.dataset.cg; const url = cg && window.__aurexLogos[cg]; if (url) { el.style.backgroundImage = `url(${url})`; el.classList.add('con'); el.textContent = ''; } });
}

/* ══════════════════ EXPORT (con marca de agua = logo en el pie) ══════════════════ */
function guardarImagen() {
  const cv = $('rz-cv'); if (!cv) return;
  const marca = $('rz-marca'); const antes = marca ? marca.style.display : null; if (marca) marca.style.display = 'none';
  const devolver = () => { if (marca) marca.style.display = antes || ''; };
  try {
    const e2 = cv.width / cv.clientWidth, barra = 78 * e2;
    const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height + barra;
    const g = out.getContext('2d'); g.fillStyle = '#0a0e14'; g.fillRect(0, 0, out.width, out.height); g.drawImage(cv, 0, 0);
    const yB = cv.height; g.fillStyle = '#0b0e12'; g.fillRect(0, yB, out.width, barra);
    g.fillStyle = 'rgba(232,184,75,.35)'; g.fillRect(0, yB, out.width, 2 * e2);
    const textos = (x) => {
      g.textAlign = 'left'; g.fillStyle = '#E8B84B'; g.font = `800 ${19 * e2}px system-ui,sans-serif`; g.fillText('Reaction Zones', x, yB + 34 * e2);
      g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillStyle = '#C9A84B'; g.fillText(WEB, x, yB + 56 * e2);
      g.textAlign = 'right'; g.fillStyle = '#8b96a3'; g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillText(`${_par} · ${M.tf}`, out.width - 20 * e2, yB + 34 * e2);
      g.font = `${11 * e2}px ui-monospace,monospace`; g.fillStyle = '#6b7681'; g.fillText(new Date().toLocaleString('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), out.width - 20 * e2, yB + 56 * e2);
      g.textAlign = 'left';
    };
    const bajar = () => out.toBlob((blob) => { devolver(); if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `decfreedom-reactionzones-${_par}-${Date.now()}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }, 'image/png');
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
  const sh = $('rz-share');
  const flash = (m) => { if (sh) { const t = sh.dataset.base || sh.textContent; sh.dataset.base = t; sh.textContent = m; setTimeout(() => { sh.textContent = t; }, 1500); } };
  if (!pos.length) { flash('No signals'); return; }
  const par = PARES.find((p) => p.id === _par) || { id: _par };
  const dec = (v) => { const a = Math.abs(v); return a >= 1000 ? v.toFixed(1) : a >= 1 ? v.toFixed(3) : v.toFixed(5); };
  const hora = new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
  const precio = M.precio ? dec(M.precio) : '—';
  const ents = pos.map((p) => dec(p.pe)), sls = pos.map((p) => dec(p.pStop)), tps = pos.map((p) => dec(p.pTarget));
  const n = ents.length;
  const lista = (arr) => arr.map((v, i) => `${i + 1}: ${v}`).join('\n');
  const txt = `REACTION ZONES — SIGNAL\n\n${par.id} · ${M.tf} · ${hora} UTC · Price ${precio}\n\nENTRY\n${lista(ents)}\n\nSTOP LOSS\n${lista(sls)}\n\nTAKE PROFIT\n${lista(tps)}\n\nRISK : REWARD — 1:2\n\n${WEB} · Reaction Zones`;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => flash('Copied ✓')).catch(() => {});

  const chart = $('rz-cv');
  const W = 1180, BG = '#0a0d12';
  const chartH = chart && chart.width ? Math.round(W * (chart.height / chart.width)) : 0;
  const padX = 54, headH = 156, rowH = 56, rrH = 92, footH = 84;
  const H = chartH + headH + n * rowH + rrH + footH;
  const cv = document.createElement('canvas'), g = cv.getContext('2d'); cv.width = W; cv.height = H;
  const cargar = (src, cors) => new Promise((res) => { if (!src) return res(null); const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const prep = (async () => {
    const sym = par.id.toLowerCase();
    let coin = await cargar(`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym}.png`, true);
    if (!coin && window.__aurexLogos && par.cg && window.__aurexLogos[par.cg]) coin = await cargar(window.__aurexLogos[par.cg], true);
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
    else { g.fillStyle = '#a855f7'; g.font = '800 24px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(par.id.slice(0, 4), lx + ls / 2, ly + ls / 2 + 1); }
    g.restore();
    if (coin) { g.strokeStyle = 'rgba(168,85,247,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(lx + ls / 2, ly + ls / 2, ls / 2, 0, 6.2832); g.stroke(); }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const tx = lx + ls + 24;
    g.fillStyle = '#a855f7'; g.font = '800 40px system-ui,sans-serif'; g.fillText('Reaction', tx, y0 + 56);
    const hw = g.measureText('Reaction').width;
    g.fillStyle = '#e8ecf2'; g.font = '800 40px system-ui,sans-serif'; g.fillText(' Zones', tx + hw, y0 + 56);
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
    g.fillStyle = '#E8B84B'; g.font = '800 19px system-ui,sans-serif'; g.textAlign = 'right'; g.fillText('Reaction Zones', W - padX, fy + footH / 2 + 1);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    try { cv.toBlob((b) => { if (!b) return; const url = URL.createObjectURL(b), a = document.createElement('a'); a.href = url; a.download = `decfreedom-reactionzones-${par.id}-${M.tf}-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); }, 'image/png'); } catch (e) { flash('Copied ✓'); }
  });
}

/* ══════════════════ AYUDA (stepper experto, igual que Heat Pools) ══════════════════ */
const PASOS_RZ = [
  {
    t: 'What Reaction Zones is',
    d: 'Reaction Zones is a <b>structural engine</b> that maps the exact price levels where the market is <b>statistically likely to react</b>. It confirms swing pivots, pairs the ones that agree on a level, and reads the <b>live break pressure</b> on each one from volume, absorption, approach speed and range compression.',
    x: 'A level is not drawn until real structure confirms it, so what you see is where orders have actually defended price.'
  },
  {
    t: 'Reading the zones',
    d: 'A <b>red zone above price</b> is resistance and frames a <b>short</b>. A <b>green zone below price</b> is support and frames a <b>long</b>. The <b>brighter and thicker</b> a zone pulses, the more break pressure it is carrying, so a faint zone is passive and a bright, heavy one is primed to give way.',
    x: 'Pressure is a live read, not a fixed label: a zone can cool down or heat up as price works into it.'
  },
  {
    t: 'Markers and breaks',
    d: 'The <b>layered circle</b> on each anchor grades the level by formation quality and current pressure, with a gold core at the center. A <b>diamond</b> marks every fresh retest of the zone. When price finally clears a level with conviction, a <b>triangle</b> prints the confirmed break and the old zone fades into history.',
    x: 'More rings on the circle means a stronger, better-defended level. Watch retests on diamonds for continuation.'
  },
  {
    t: 'Pick coin and timeframe',
    d: 'Select the <b>coin</b> at the top and the <b>timeframe</b> you intend to trade. Higher timeframes build <b>sturdier zones</b> with cleaner pressure reads; lower ones react faster but carry more noise. The level logic is identical on every timeframe.',
    x: 'When a zone appears on more than one timeframe at the same price, treat it as a heavier level.'
  },
  {
    t: 'Project entries (Single / Double)',
    d: 'Tap <b>Single</b> to project one position at the nearest zone on each side, placed <b>ahead of price</b> so the trade is ready before price arrives: a short waiting at the red zone, a long waiting at the green. Tap <b>Double</b> to add a <b>backup entry</b> that fills where the first stop sits, so a second fill can <b>rescue the stop</b> of the first and lift your average.',
    x: 'Every projected trade is sized to a 1:2 risk/reward. Minimized by default; tap the L/S tag to expand the ticket.'
  },
  {
    t: 'Place your own orders',
    d: 'Right-click anywhere on the chart to drop your <b>own order or price alert</b> exactly where you want it, and use the <b>drawing tools</b> on the left for your own structure. Reaction Zones maps the levels; you stay in full control of the execution.',
    x: 'Use the share button to export the current chart, watermark included, for your signals or analysis.'
  },
  {
    t: 'Manage risk like a professional',
    d: 'Entries are framed at <b>1:2 risk/reward</b>. Once price has moved your risk in profit, in <b>futures</b> move the stop to your <b>entry</b> so the trade can no longer lose; in <b>spot</b> there is no liquidation, so you can size properly and let the idea breathe. Trade <b>with</b> the dominant trend, not against it.',
    x: 'Analysis only: nothing here is executed for you, and no level is a guarantee. Risk is managed, never removed.'
  }
];
let _pasoRZ = 0;
function ayuda() {
  if ($('rz-ayuda-box')) { $('rz-ayuda-box').remove(); return; }
  _pasoRZ = 0;
  const d = document.createElement('div'); d.id = 'rz-ayuda-box';
  d.innerHTML = `<div class="rz-ab-bg"></div>
    <div class="rz-ab-c">
      <button class="rz-ab-x" aria-label="Close">✕</button>
      <div class="rz-ab-eyebrow">Reaction Zones</div>
      <div id="rz-ab-cuerpo"></div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  d.querySelector('.rz-ab-bg').onclick = q; d.querySelector('.rz-ab-x').onclick = q;
  pintarPasoRZ();
}
function pintarPasoRZ() {
  const c = $('rz-ab-cuerpo'); if (!c) return;
  const p = PASOS_RZ[_pasoRZ]; const ultimo = _pasoRZ === PASOS_RZ.length - 1;
  c.innerHTML = `
    <div class="rz-ab-card">
      <div class="rz-ab-n">${_pasoRZ + 1} <em>of ${PASOS_RZ.length}</em></div>
      <div class="rz-ab-t">${p.t}</div>
      <div class="rz-ab-d">${p.d}</div>
      <div class="rz-ab-x2">${p.x}</div>
    </div>
    <div class="rz-ab-dots">${PASOS_RZ.map((_, i) => `<i class="${i === _pasoRZ ? 'on' : ''}" data-paso="${i}"></i>`).join('')}</div>
    <div class="rz-ab-acts">
      ${_pasoRZ > 0 ? '<button class="rz-ab-back" id="rz-ab-back">Back</button>' : ''}
      <button class="rz-ab-next" id="rz-ab-next">${ultimo ? 'Got it' : 'Learn more'}</button>
    </div>`;
  $('rz-ab-next').onclick = () => { if (_pasoRZ >= PASOS_RZ.length - 1) { $('rz-ayuda-box')?.remove(); return; } _pasoRZ++; pintarPasoRZ(); };
  const at = $('rz-ab-back'); if (at) at.onclick = () => { _pasoRZ = Math.max(0, _pasoRZ - 1); pintarPasoRZ(); };
  c.querySelectorAll('[data-paso]').forEach((b) => b.onclick = () => { _pasoRZ = Number(b.dataset.paso); pintarPasoRZ(); });
}

/* ══════════════════ ESTILOS ══════════════════ */
let _css = false;
function estilos() {
  if (_css || $('rz-css')) { _css = true; return; } _css = true;
  const s = document.createElement('style'); s.id = 'rz-css'; s.textContent = CSS; document.head.appendChild(s);
}
const CSS = `
#rz-overlay{position:fixed;inset:0;z-index:10030;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#e7ebf0;
  --g:#28d26a; --r:#ff4a5a; --gold:#E8B84B; --line:#1d2630; --mono:"Chakra Petch",ui-monospace,monospace}
#rz-overlay *{box-sizing:border-box}
.rz-bg{position:absolute;inset:0;background:radial-gradient(1100px 560px at 80% -10%,rgba(232,184,75,.04),transparent 60%),#070b10}
.rz-c{position:relative;width:100%;height:100%;display:flex;flex-direction:column}
.rz-barra{display:flex;align-items:center;gap:10px;height:54px;flex:0 0 auto;padding:0 12px;background:linear-gradient(180deg,#0e141b,#090d12);border-bottom:1px solid var(--line)}
.rz-back{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px 0 10px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#c3cad3;cursor:pointer;font-weight:700;font-size:13px}
.rz-back svg{width:14px;height:14px}
.rz-back:hover{border-color:var(--gold);color:var(--gold)}
.rz-sel{display:inline-flex;align-items:center;gap:9px;height:38px;padding:0 11px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#e7ebf0;cursor:pointer}
.rz-sel:hover{border-color:var(--gold)}
.rz-sel b{font-family:var(--mono);font-weight:800;font-size:14px}
.rz-sel span{color:#7d8794;font-size:12.5px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rz-sel svg{width:11px;height:11px;color:#7d8794}
.rz-logo,.rz-mini{flex:0 0 auto;border-radius:50%;background:#1b222c center/cover no-repeat;display:grid;place-items:center;font-family:var(--mono);font-weight:800;color:var(--gold);border:1px solid #2a333f;overflow:hidden}
.rz-logo{width:24px;height:24px;font-size:11px}
.rz-mini{width:19px;height:19px;font-size:9px}
.rz-logo.con,.rz-mini.con{border-color:transparent;color:transparent}
.rz-logo.con-svg,.rz-mini.con-svg{background:none;border:none}
.rz-logo.con-svg svg,.rz-mini.con-svg svg{width:100%;height:100%}
.rz-tfchip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:11px;background:#12161c;border:1px solid #2b3139;color:#eaecef;cursor:pointer;font-family:var(--mono);font-weight:800;font-size:13.5px}
.rz-tfchip svg{width:12px;height:12px;color:#8b96a3}
.rz-tfchip:hover{border-color:var(--gold)}
.rz-px{display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:84px}
.rz-px-v{font-family:var(--mono);font-weight:800;font-size:18px;line-height:1}
.rz-px-v.up{color:var(--g)} .rz-px-v.down{color:var(--r)}
.rz-hl{display:flex;gap:10px;font-family:var(--mono);font-size:10px;color:#7d8794}
.rz-hl b{font-weight:800} .rz-hl span:first-child b{color:var(--g)} .rz-hl span:last-child b{color:var(--r)}
.rz-badge{font-family:var(--mono);font-size:9.5px;font-weight:800;letter-spacing:.08em;padding:3px 8px;border-radius:6px;background:rgba(232,184,75,.14);color:var(--gold);border:1px solid rgba(232,184,75,.3)}
.rz-badge-spot{background:rgba(40,210,100,.12);color:#54e08a;border-color:rgba(40,210,100,.3)}
.rz-estado{font-family:var(--mono);font-size:11px;color:var(--r)}
.rz-der{display:flex;align-items:center;gap:9px;margin-left:auto}
.rz-pos-split{display:inline-flex;flex:0 0 auto;height:36px;border-radius:9px;overflow:hidden;border:1px solid rgba(232,184,75,.55);background:rgba(232,184,75,.06)}
.rz-pos-half{background:transparent;border:0;color:#d8b24a;font:700 12px system-ui,sans-serif;padding:0 13px;cursor:pointer;letter-spacing:.2px;transition:background .15s,color .15s}
.rz-pos-half+.rz-pos-half{border-left:1px solid rgba(232,184,75,.35)}
.rz-pos-half:hover{background:rgba(232,184,75,.14)}
.rz-pos-half.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800}
.rz-share{height:36px;border-radius:9px;border:1px solid rgba(46,232,106,.55);background:rgba(46,232,106,.08);color:#39e07a;font:700 12px system-ui,sans-serif;padding:0 14px;cursor:pointer;white-space:nowrap;transition:filter .15s,opacity .15s}
.rz-share:hover{filter:brightness(1.15)}
.rz-share:disabled{opacity:.4;cursor:not-allowed;filter:none}
.rz-ico{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#9aa4af;font-weight:800}
.rz-ico:hover{border-color:var(--gold);color:var(--gold)}
.rz-graf{flex:1 1 auto;min-height:0;position:relative;background:#0a0e14}
.rz-cv{display:block;position:absolute;inset:0}
.rz-marca{position:absolute;left:64px;bottom:40px;height:42px;width:auto;opacity:.8;pointer-events:none;filter:drop-shadow(0 2px 9px rgba(0,0,0,.95))}
.rz-esperando{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:30px;background:rgba(10,14,20,.6);z-index:2}
.rz-esperando b{font-family:var(--mono);font-size:14px;color:#cbd3dc}
.rz-esperando span{font-size:12px;color:#7d8794;max-width:280px}
.rz-spin{width:30px;height:30px;border:2.5px solid rgba(232,184,75,.2);border-top-color:var(--gold);border-radius:50%;animation:rz-sp .8s linear infinite}
@keyframes rz-sp{to{transform:rotate(360deg)}}
.rz-pop{position:fixed;z-index:10050;background:#0c1016;border:1px solid #2a333f;border-radius:12px;box-shadow:0 20px 55px rgba(0,0,0,.65);font-family:var(--mono);color:#e7ebf0}
.rz-picker,.rz-pop.rz-tfpop{}
#rz-picker{width:300px;max-height:70vh;display:flex;flex-direction:column;overflow:hidden}
.rz-cm-top{padding:8px;border-bottom:1px solid var(--line)}
.rz-cm-top input{width:100%;height:32px;border-radius:8px;border:1px solid #2a333f;background:#0a0d12;color:#e7ebf0;padding:0 11px;font-size:12.5px;font-family:var(--mono);outline:none}
.rz-cm-top input:focus{border-color:var(--gold)}
.rz-cm-list{overflow-y:auto;padding:6px}
.rz-cm-cat{font-size:9px;letter-spacing:.14em;color:var(--gold);text-transform:uppercase;padding:8px 8px 4px}
.rz-cm-it{display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 9px;border-radius:8px;border:0;background:transparent;color:#e7ebf0;cursor:pointer;text-align:left;font-size:13px}
.rz-cm-it:hover{background:rgba(232,184,75,.1)} .rz-cm-it.on{background:rgba(232,184,75,.16)}
.rz-cm-it b{font-family:var(--mono);min-width:50px;color:var(--gold);font-weight:800}
.rz-cm-it span{color:#7d8794;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rz-tfpop{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:6px;min-width:210px;background:#12161c;border-color:#2b3139;border-radius:14px}
.rz-tf-it{min-height:42px;border-radius:10px;border:1px solid transparent;background:rgba(255,255,255,.04);color:#c7cdd6;cursor:pointer;font-family:var(--mono);font-size:13px;font-weight:700}
.rz-tf-it:hover{border-color:#3a424c;color:#eaecef}
.rz-tf-it.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;border-color:var(--gold)}
/* ── Ayuda: stepper experto (igual que Heat Pools) ── */
#rz-ayuda-box{position:fixed;inset:0;z-index:10300;display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Plus Jakarta Sans",system-ui,sans-serif}
.rz-ab-bg{position:absolute;inset:0;background:rgba(3,5,8,.93)}
.rz-ab-c{position:relative;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid #C9A84B;border-radius:20px;padding:24px 20px}
.rz-ab-x{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;padding:0;cursor:pointer;font-size:15px;z-index:5;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6}
.rz-ab-eyebrow{font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:2px;text-align:center;margin-bottom:18px}
.rz-ab-card{padding:24px 20px;border-radius:16px;text-align:center;margin-bottom:18px;background:linear-gradient(165deg,rgba(232,184,75,.08),rgba(255,255,255,.015));border:1px solid rgba(232,184,75,.26)}
.rz-ab-n{font-family:var(--mono);font-size:11px;color:var(--gold);font-weight:700;margin-bottom:10px}
.rz-ab-n em{font-style:normal;color:#5c6672;font-weight:400}
.rz-ab-t{font-weight:800;font-size:21px;color:#eaecef;margin-bottom:12px;line-height:1.25}
.rz-ab-d{font-size:14px;color:#b7bdc6;line-height:1.65;margin-bottom:14px}
.rz-ab-d b{color:var(--gold);font-weight:700}
.rz-ab-x2{padding:12px 14px;border-radius:11px;background:rgba(255,255,255,.035);border-left:2px solid #C9A84B;font-size:12.5px;color:#8b96a3;line-height:1.55;text-align:left}
.rz-ab-dots{display:flex;gap:5px;justify-content:center;margin-bottom:18px;flex-wrap:wrap}
.rz-ab-dots i{width:7px;height:7px;border-radius:50%;background:#2b3139;cursor:pointer;transition:background .18s,transform .18s}
.rz-ab-dots i.on{background:var(--gold);transform:scale(1.35)}
.rz-ab-acts{display:flex;gap:9px}
.rz-ab-back{flex:0 0 auto;min-height:48px;padding:0 20px;border-radius:12px;background:transparent;border:1px solid #2b3139;color:#8b96a3;cursor:pointer;font-weight:700;font-size:13px}
.rz-ab-back:hover{border-color:#3a424c;color:#b7bdc6}
.rz-ab-next{flex:1;min-height:48px;border-radius:12px;border:0;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;font-weight:800;font-size:14px;cursor:pointer}
@media(max-width:900px){ .rz-sel span,.rz-px,.rz-badge{display:none} }
`;
