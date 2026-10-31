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
import { detectarReaction, zoneBounds } from './motor.js?v=1';

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
  $('rz-tfchip').onclick = (e) => { e.stopPropagation(); menuTf(); };
  { const bS = $('rz-pos-single'), bD = $('rz-pos-double');
    const set = (modo) => { M._modoPos = (M._modoPos === modo) ? null : modo; bS.classList.toggle('on', M._modoPos === 'single'); bD.classList.toggle('on', M._modoPos === 'double'); M._posAuto = null; dibujar(); };
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
  const desp = Math.max(-huecoMax, Math.min(M.desplaz || 0, Math.max(0, M.velas.length - ancho)));
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
  const titila = 0.5 + 0.5 * Math.sin(now / 240);         // titilar de puntos

  // ── ZONAS (detrás de las velas): bandas sutiles ── (upper=rojo/short, lower=verde/long)
  dibujarZonas(g, x1, Y, pMin, pMax, Xbar, pulso, false);

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

  // ── ZONAS encima: líneas ancla + marcadores titilando + triángulos ──
  dibujarZonas(g, x1, Y, pMin, pMax, Xbar, pulso, true, titila);
  dibujarTriangulos(g, Xbar, Y, titila);

  // ── Herramientas de posición (Single/Double) ──
  if (M._modoPos) {
    if (!M._posAuto) M._posAuto = posicionesDeNiveles();
    M._posAuto.forEach((Pz) => dibujarPosicion(g, Pz, x1, Y, Xbar));
  } else M._posAuto = null;

  // eje de precios (marcas)
  g.fillStyle = pal().dim; g.font = '10px ui-monospace,monospace'; g.textAlign = 'left';
  for (let i = 0; i <= 5; i++) { const y = (y1 / 5) * i; const pr = pMax - (pMax - pMin) * (i / 5); g.fillText(fmt(pr), x1 + 6, y + (i === 0 ? 10 : i === 5 ? -3 : 3)); }

  // crosshair
  if (M._cursor && M._cursor.x < x1 && M._cursor.y < y1 && M._cursor.x > 0 && M._cursor.y > 0) {
    const cx = M._cursor.x, cy = M._cursor.y, pCur = pMin + (pMax - pMin) * ((y1 - cy) / y1);
    g.save(); g.strokeStyle = 'rgba(200,210,224,.4)'; g.lineWidth = 1; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, y1); g.stroke();
    g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke(); g.restore(); g.setLineDash([]);
    g.fillStyle = '#e8ecf2'; redondeado(g, x1 + 2, cy - 9, mDer - 4, 18, 4); g.fill();
    g.fillStyle = '#0b0e12'; g.font = 'bold 10px ui-monospace,monospace'; g.fillText(fmt(pCur), x1 + 6, cy + 3.5);
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

/* Dibuja las zonas. pase=false → bandas detrás; pase=true → líneas ancla +
   marcadores titilando (encima). upper=rojo(short), lower=verde(long). */
function dibujarZonas(g, x1, Y, pMin, pMax, Xbar, pulso, encima, titila) {
  const live = M.data.live || [];
  live.forEach((lv) => {
    if (lv.p > pMax || lv.p < pMin) return;
    const rojo = lv.upper;                       // SUPERIOR = resistencia = ROJO = short
    const rgb = rojo ? '255,74,90' : '40,210,100';
    const [zTop, zBot] = zoneBounds(lv.upper, lv.p, lv.depth);
    const yTop = Y(Math.max(zTop, zBot)), yBot = Y(Math.min(zTop, zBot));
    const yAnc = Y(lv.p);
    const intensidad = 0.10 + 0.14 * lv.pressure;
    const xa = Math.max(0, Xbar(lv.anchorBar));
    if (!encima) {
      // banda sutil a todo el ancho
      g.fillStyle = `rgba(${rgb},${(intensidad * (0.85 + 0.3 * pulso)).toFixed(3)})`;
      g.fillRect(0, Math.min(yTop, yBot), x1, Math.abs(yBot - yTop));
      // borde superior e inferior finos
      g.strokeStyle = `rgba(${rgb},.5)`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, yTop); g.lineTo(x1, yTop); g.stroke();
      g.beginPath(); g.moveTo(0, yBot); g.lineTo(x1, yBot); g.stroke();
      // traza entre los dos pivotes que formaron el nivel (dotted dorado)
      if (lv.pairStartBar != null) {
        const xs = Xbar(lv.pairStartBar);
        g.strokeStyle = 'rgba(232,184,75,.45)'; g.lineWidth = 1; g.setLineDash([5, 4]);
        g.beginPath(); g.moveTo(Math.max(0, xs), yAnc); g.lineTo(xa, yAnc); g.stroke(); g.setLineDash([]);
      }
      return;
    }
    // ── encima: línea ancla (barra horizontal) desde el ancla hasta el borde derecho ──
    const grosor = lv.pressure >= 0.82 ? 4 : lv.pressure >= 0.62 ? 3 : lv.pressure >= 0.42 ? 2 : 1;
    g.save(); g.strokeStyle = `rgba(${rgb},${(0.55 + 0.35 * pulso).toFixed(3)})`; g.lineWidth = grosor;
    g.shadowColor = `rgba(${rgb},.6)`; g.shadowBlur = 5 + 7 * pulso;
    g.beginPath(); g.moveTo(Math.max(0, xa), yAnc); g.lineTo(x1, yAnc); g.stroke(); g.restore();
    // marcador de "score" en el ancla (diamante/círculo que titila por presión)
    marcadorAnillos(g, xa, yAnc, rgb, lv.ringN || 1, titila, true);
    // marcador de último toque
    if (lv.lastTouchBar != null && lv.lastTouchBar >= 0 && lv.lastTouchBar !== lv.anchorBar) {
      const xt = Xbar(lv.lastTouchBar); if (xt > 0 && xt < x1) marcadorAnillos(g, xt, yAnc, rgb, lv.touchN || 1, titila, false);
    }
  });
}

/* Marcador en capas (anillos) que titila: núcleo dorado + anillos del color. */
function marcadorAnillos(g, x, y, rgb, nivel, titila, diamante) {
  const t = titila == null ? 1 : titila;
  const base = diamante ? 11 : 8;
  const r = base + nivel * 2.2;
  const pulse = 0.6 + 0.4 * t;
  g.save();
  // halo exterior
  g.shadowColor = `rgba(${rgb},${(0.45 * pulse).toFixed(3)})`; g.shadowBlur = 8 + 10 * t;
  g.fillStyle = `rgba(${rgb},${(0.16 + 0.14 * pulse).toFixed(3)})`;
  forma(g, x, y, r * pulse, diamante); g.fill();
  g.shadowBlur = 0;
  // anillo del color
  g.strokeStyle = `rgba(${rgb},${(0.6 + 0.3 * t).toFixed(3)})`; g.lineWidth = 2;
  forma(g, x, y, r * (0.8 + 0.1 * pulse), diamante); g.stroke();
  // núcleo dorado
  g.fillStyle = `rgba(232,184,75,${(0.85 * (0.7 + 0.3 * t)).toFixed(3)})`;
  forma(g, x, y, Math.max(2.5, r * 0.34), diamante); g.fill();
  g.restore();
}
function forma(g, x, y, r, diamante) {
  g.beginPath();
  if (diamante) { g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); }
  else g.arc(x, y, r, 0, 6.283);
}

function dibujarTriangulos(g, Xbar, Y, titila) {
  const tr = M.data.triangles || []; const geo = M._geo; if (!geo) return;
  const pri = geo.pri, fin = geo.fin;
  tr.forEach((tri) => {
    if (tri.bar < pri - 1 || tri.bar > fin) return;
    const x = Xbar(tri.bar), y = Y(tri.price);
    const rojo = !tri.up ? false : true;   // ruptura de upper(rojo) hacia arriba; de lower(verde) hacia abajo
    const rgb = tri.up ? '255,74,90' : '40,210,100';
    const s = 7 + 3 * (titila || 0);
    g.save(); g.shadowColor = `rgba(${rgb},.7)`; g.shadowBlur = 6 + 8 * (titila || 0);
    g.fillStyle = `rgba(${rgb},${(0.7 + 0.3 * (titila || 0)).toFixed(3)})`;
    g.beginPath();
    if (tri.up) { g.moveTo(x, y - s - 6); g.lineTo(x - s, y - 4); g.lineTo(x + s, y - 4); }
    else { g.moveTo(x, y + s + 6); g.lineTo(x - s, y + 4); g.lineTo(x + s, y + 4); }
    g.closePath(); g.fill(); g.restore();
  });
}

function redondeado(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ══════════════════ POSICIONES (Single / Double) ══════════════════
   Short en niveles superiores (rojo), Long en inferiores (verde). Siguen al
   precio: se proyectan en el nivel relevante MÁS CERCANO por encima/por debajo
   del precio, listas ANTES de que el precio los toque. Double añade una entrada
   de respaldo en el borde de la zona. RR 1:2 por defecto. */
function posicionesDeNiveles() {
  const live = (M.data.live || []).filter((lv) => lv.pressure >= 0.3);
  const precio = M.precio || (M.velas.length ? M.velas[M.velas.length - 1].c : 0);
  if (!precio) return [];
  const doble = M._modoPos === 'double';
  const RR = 2;
  const sup = live.filter((lv) => lv.upper && lv.p > precio).sort((a, b) => a.p - b.p);   // resistencias por encima
  const inf = live.filter((lv) => !lv.upper && lv.p < precio).sort((a, b) => b.p - a.p);  // soportes por debajo
  const out = [];
  const nearestN = 2;
  sup.slice(0, nearestN).forEach((lv) => {
    const [zTop, zBot] = zoneBounds(true, lv.p, lv.depth);     // zTop=p, zBot=p-depth
    const e1 = lv.p, sl = Math.max(zTop, zBot) + lv.depth * 0.6, riesgo = Math.abs(sl - e1) || lv.depth;
    const tp = e1 - RR * riesgo;
    out.push({ tipo: 'corto', pe: e1, pe2: doble ? sl : null, pStop: sl, pTarget: tp, p: lv.p, anchorBar: lv.anchorBar, rr: RR });
  });
  inf.slice(0, nearestN).forEach((lv) => {
    const [zTop, zBot] = zoneBounds(false, lv.p, lv.depth);    // zTop=p+depth, zBot=p
    const e1 = lv.p, sl = Math.min(zTop, zBot) - lv.depth * 0.6, riesgo = Math.abs(e1 - sl) || lv.depth;
    const tp = e1 + RR * riesgo;
    out.push({ tipo: 'largo', pe: e1, pe2: doble ? sl : null, pStop: sl, pTarget: tp, p: lv.p, anchorBar: lv.anchorBar, rr: RR });
  });
  return out;
}

function dibujarPosicion(g, Pz, x1, Y, Xbar) {
  const largo = Pz.tipo === 'largo';
  const acc = largo ? '46,232,106' : '255,74,90';
  const x0 = Math.max(10, Math.min(x1 - 180, Xbar(Pz.anchorBar)));
  const w = x1 - x0;
  const yE = Y(Pz.pe), yT = Y(Pz.pTarget), yS = Y(Pz.pStop);
  // zonas de ganancia (verde) y riesgo (rojo)
  g.fillStyle = `rgba(46,232,106,.12)`; g.fillRect(x0, Math.min(yE, yT), w, Math.abs(yT - yE));
  g.fillStyle = `rgba(255,74,90,.12)`; g.fillRect(x0, Math.min(yE, yS), w, Math.abs(yS - yE));
  // líneas entry / target / stop
  const linea = (y, col, dash) => { g.strokeStyle = col; g.lineWidth = 1.4; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]); };
  linea(yT, '#2ee86a');
  linea(yE, '#eaecef', [5, 3]);
  linea(yS, '#ff5b6e');
  if (Pz.pe2 != null) { const yE2 = Y(Pz.pe2); linea(yE2, 'rgba(234,236,239,.55)', [2, 3]); }   // entrada de respaldo (Double)
  // tarjeta compacta con el veredicto
  const cw = 150, ch = 54, cx = x1 - cw - 8, cy = Math.max(6, Math.min(Y(Pz.pe) - ch / 2, (M._geo ? M._geo.y1 : 400) - ch - 6));
  g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 12; g.fillStyle = 'rgba(12,16,23,.95)'; redondeado(g, cx, cy, cw, ch, 10); g.fill(); g.restore();
  g.strokeStyle = `rgba(${acc},.5)`; g.lineWidth = 1; redondeado(g, cx + .5, cy + .5, cw - 1, ch - 1, 10); g.stroke();
  g.fillStyle = `rgb(${acc})`; g.font = '800 12px "Chakra Petch",ui-monospace,monospace'; g.textAlign = 'left';
  g.fillText(largo ? 'LONG' : 'SHORT', cx + 11, cy + 20);
  g.fillStyle = '#9aa4af'; g.font = '9px ui-monospace,monospace';
  g.fillText('TP ' + fmt(Pz.pTarget), cx + 11, cy + 35);
  g.fillText('SL ' + fmt(Pz.pStop), cx + 11, cy + 47);
  g.textAlign = 'right'; g.fillStyle = '#E8B84B'; g.font = '800 15px "Chakra Petch",ui-monospace,monospace';
  g.fillText('1:' + Pz.rr, cx + cw - 11, cy + 30);
  g.fillStyle = '#79838f'; g.font = '8px ui-monospace,monospace'; g.fillText('R : R', cx + cw - 11, cy + 43);
  g.textAlign = 'left';
}

/* ══════════════════ GESTOS (zoom/pan) ══════════════════ */
function engancharGestos(cv) {
  const zoom = (f) => { const maxA = Math.max(60, (M.velas.length || 700) - 2); M.ancho = Math.max(14, Math.min(maxA, Math.round((M.ancho || 100) * f))); dibujar(); };
  let ax = 0, ay = 0, arr = false; const enEscala = (x) => x > cv.clientWidth - 70;
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  cv.addEventListener('mousedown', (e) => { const r = cv.getBoundingClientRect(); ax = e.clientX - r.left; ay = e.clientY - r.top; arr = !enEscala(ax); });
  window.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    M._cursor = { x, y };
    if (!arr) { if (M._geo) dibujar(); return; }
    const paso = M._geo ? M._geo.paso : 8; const dx = x - ax, dy = y - ay;
    if (Math.abs(dx) > paso) { M.desplaz = (M.desplaz || 0) + Math.round(dx / paso); ax = x; }
    M.offsetY = (M.offsetY || 0) + dy; ay = y; dibujar();
  });
  window.addEventListener('mouseup', () => { arr = false; });
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
  const r = ancla.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, r.left) + 'px';
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

/* ══════════════════ AYUDA ══════════════════ */
function ayuda() {
  if ($('rz-ayuda-box')) { $('rz-ayuda-box').remove(); return; }
  const m = document.createElement('div'); m.id = 'rz-ayuda-box'; m.className = 'rz-modal';
  m.innerHTML = `<div class="rz-modal-bg"></div><div class="rz-modal-card">
    <button class="rz-modal-x">✕</button>
    <h3>Reaction Zones</h3>
    <p>The engine scans market structure and marks the <b>price levels where a reaction is likely</b> — built from repeated pivots, with a live <b>break-pressure</b> read (volume, absorption, approach and compression).</p>
    <p><span class="rz-dot-r"></span> <b>Red levels</b> sit above price — resistance → <b>short</b> context.<br>
    <span class="rz-dot-g"></span> <b>Green levels</b> sit below price — support → <b>long</b> context.</p>
    <p>The brighter and thicker a level pulses, the more pressure it is under. Triangles mark confirmed breaks. Use <b>Single</b> to auto-project a position at the nearest levels, <b>Double</b> to add a backup entry. Right-click the chart to place your own order or alert.</p>
    <p class="rz-dis">Analysis only — no orders are executed. Place your trades at a 1:1 or 1:2 risk–reward as you prefer.</p></div>`;
  document.body.appendChild(m);
  const cerrarM = () => m.remove();
  m.querySelector('.rz-modal-x').onclick = cerrarM; m.querySelector('.rz-modal-bg').onclick = cerrarM;
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
.rz-tfchip{display:inline-flex;align-items:center;gap:5px;height:34px;padding:0 11px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#c3cad3;cursor:pointer;font-family:var(--mono);font-weight:700;font-size:12px}
.rz-tfchip svg{width:11px;height:11px;color:#7d8794}
.rz-tfchip:hover{border-color:var(--gold);color:var(--gold)}
.rz-px{display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:84px}
.rz-px-v{font-family:var(--mono);font-weight:800;font-size:18px;line-height:1}
.rz-px-v.up{color:var(--g)} .rz-px-v.down{color:var(--r)}
.rz-hl{display:flex;gap:10px;font-family:var(--mono);font-size:10px;color:#7d8794}
.rz-hl b{font-weight:800} .rz-hl span:first-child b{color:var(--g)} .rz-hl span:last-child b{color:var(--r)}
.rz-badge{font-family:var(--mono);font-size:9.5px;font-weight:800;letter-spacing:.08em;padding:3px 8px;border-radius:6px;background:rgba(232,184,75,.14);color:var(--gold);border:1px solid rgba(232,184,75,.3)}
.rz-badge-spot{background:rgba(40,210,100,.12);color:#54e08a;border-color:rgba(40,210,100,.3)}
.rz-estado{font-family:var(--mono);font-size:11px;color:var(--r)}
.rz-der{display:flex;align-items:center;gap:9px;margin-left:auto}
.rz-pos-split{display:flex;border:1px solid #2a333f;border-radius:9px;overflow:hidden}
.rz-pos-half{height:34px;padding:0 13px;border:0;background:rgba(255,255,255,.03);color:#aeb6c0;cursor:pointer;font-family:var(--mono);font-weight:700;font-size:12px}
.rz-pos-half+.rz-pos-half{border-left:1px solid #2a333f}
.rz-pos-half:hover{color:#e7ebf0}
.rz-pos-half.on{background:rgba(232,184,75,.18);color:var(--gold)}
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
.rz-tfpop{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:7px;width:220px}
.rz-tf-it{height:34px;border-radius:8px;border:1px solid #2a333f;background:rgba(255,255,255,.03);color:#aeb6c0;cursor:pointer;font-family:var(--mono);font-size:12px;font-weight:700}
.rz-tf-it:hover{border-color:var(--gold);color:var(--gold)} .rz-tf-it.on{background:rgba(232,184,75,.15);border-color:var(--gold);color:var(--gold)}
.rz-modal{position:fixed;inset:0;z-index:10060;display:flex;align-items:center;justify-content:center;padding:18px;font-family:"Plus Jakarta Sans",system-ui,sans-serif}
.rz-modal-bg{position:absolute;inset:0;background:rgba(4,7,11,.8);backdrop-filter:blur(3px)}
.rz-modal-card{position:relative;width:min(560px,96vw);max-height:90vh;overflow-y:auto;background:linear-gradient(180deg,#121823,#0b0e13);border:1px solid #2a333f;border-radius:16px;padding:26px 28px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.rz-modal-card h3{margin:2px 0 12px;font-family:var(--mono);font-size:20px;color:var(--gold)}
.rz-modal-card p{margin:0 0 13px;font-size:13px;line-height:1.6;color:#c4ccd4}
.rz-modal-card p b{color:#e9eef3}
.rz-dis{color:#8b96a3 !important;font-size:12px !important}
.rz-modal-x{position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:8px;border:1px solid #2a333f;background:rgba(255,255,255,.04);color:#9aa4af;cursor:pointer}
.rz-dot-r,.rz-dot-g{display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:middle;margin-right:4px}
.rz-dot-r{background:var(--r)} .rz-dot-g{background:var(--g)}
@media(max-width:900px){ .rz-sel span,.rz-px,.rz-badge{display:none} }
`;
