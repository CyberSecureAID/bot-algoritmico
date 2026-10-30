/* niveles/barra.js — LA MISMA barra de herramientas de Smart Pools, montada
   sobre otra gráfica (Heat Pools, Liquidity Pools).

   No se recrea nada: se reutilizan tal cual los módulos de Smart Pools
   (interaccion.js = gestos y menús de la barra, dibujo.js = trazado y
   persistencia, estilos.js = CSS). Lo único propio de aquí es el ADAPTADOR:

     · un canvas transparente encima de la gráfica anfitriona, donde se
       dibujan las herramientas;
     · en modo cursor ese canvas NO intercepta nada (pointer-events:none),
       así los gestos, el zoom y el clic derecho de la gráfica anfitriona
       siguen exactamente igual; solo captura cuando hay una herramienta
       activa, o cuando el cursor pasa cerca de un dibujo existente (para
       poder seleccionarlo y editarlo);
     · la geometría (precio ↔ píxel, vela ↔ píxel) se sincroniza desde la
       gráfica anfitriona en cada repintado, vía N._geo, que es lo que leen
       dibujo.js e interaccion.js.

   Los dibujos se guardan por moneda (localStorage 'cco-dibujos'), igual que
   en Smart Pools: lo que trazas en una gráfica lo ves en las otras. */

import { N } from './estado.js?v=1';
import { gestos } from './interaccion.js?v=1';
import { dibujarHerramientas, guardarDib, cargarDib, dibAxy } from './dibujo.js?v=1';
import { estilos } from './estilos.js?v=1';

/* Copia literal de la barra de Smart Pools (niveles.js), con clases en vez de
   ids en los dos botones de acción para no duplicar ids en la página. */
export const BARRA_HTML = `
  <div class="nv-tools">
    <button class="nv-tool on nv-tool-fly" data-h="cursor" data-fly="cursores" title="Cursor"><svg viewBox="0 0 24 24"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg><b class="nv-fly-mark"></b></button>
    <button class="nv-tool" data-h="marca" title="Marker (leaves points)"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="7"/></svg></button>
    <button class="nv-tool nv-tool-fly" data-h="linea" data-fly="lineas" title="Lines"><svg viewBox="0 0 24 24"><path d="M4 19L20 5"/><circle cx="4" cy="19" r="1.8" fill="currentColor" stroke="none"/><circle cx="20" cy="5" r="1.8" fill="currentColor" stroke="none"/></svg><b class="nv-fly-mark"></b></button>
    <button class="nv-tool" data-h="rect" title="Rectangle / zone"><svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1.5"/></svg></button>
    <button class="nv-tool" data-h="fib" title="Fibonacci"><svg viewBox="0 0 24 24"><path d="M3 5h18M3 10h18M3 14h18M3 19h18" opacity=".9"/></svg></button>
    <button class="nv-tool" data-h="flecha" title="Arrow"><svg viewBox="0 0 24 24"><path d="M5 19L19 5M19 5h-7M19 5v7"/></svg></button>
    <button class="nv-tool" data-h="brush" title="Brush (freehand)"><svg viewBox="0 0 24 24"><path d="M3 21c3 0 3-3 6-3s3 3 6 0 3-6 6-6"/><path d="M14 5l5 5-2 2-5-5z"/></svg></button>
    <button class="nv-tool" data-h="texto" title="Text"><svg viewBox="0 0 24 24"><path d="M5 6h14M12 6v13M9 19h6"/></svg></button>
    <button class="nv-tool" data-h="regla" title="Measure (ruler)"><svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="1.2"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/></svg></button>
    <button class="nv-tool" data-h="poslarga" title="Long position"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="7" rx="1.2"/><rect x="4" y="13" width="16" height="7" rx="1.2" opacity=".55"/><path d="M12 4V2"/></svg></button>
    <button class="nv-tool" data-h="poscorta" title="Short position"><svg viewBox="0 0 24 24"><rect x="4" y="13" width="16" height="7" rx="1.2"/><rect x="4" y="4" width="16" height="7" rx="1.2" opacity=".55"/><path d="M12 20v2"/></svg></button>
    <span class="nv-tool-sep"></span>
    <button class="nv-tool" data-h="borrar" title="Eraser (tap a drawing)"><svg viewBox="0 0 24 24"><path d="M4 15l7-7 7 7-4 4H8z"/><path d="M9 20h11"/></svg></button>
    <button class="nv-tool nv-tool-tg nv-tool-iman" title="Snap to candles"><svg viewBox="0 0 24 24"><path d="M6 4v7a6 6 0 0 0 12 0V4"/><path d="M6 4h4M14 4h4"/></svg></button>
    <button class="nv-tool nv-tool-limpiar" title="Clear all"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>
  </div>`;

/* Distancia punto–segmento en píxeles (para saber si el cursor está sobre un dibujo). */
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx, y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}
function cercaDeDibujo(x, y) {
  const ds = N.dibujos || [];
  for (const d of ds) {
    const pts = (d.pts || []).map(dibAxy);
    if (!pts.length) continue;
    for (let k = 0; k < pts.length; k++) {
      if (Math.hypot(pts[k].x - x, pts[k].y - y) < 14) return true;
      if (k > 0 && distSeg(x, y, pts[k - 1].x, pts[k - 1].y, pts[k].x, pts[k].y) < 9) return true;
    }
    if (d.tipo === 'rect' || d.tipo === 'poslarga' || d.tipo === 'poscorta' || d.tipo === 'fib') {
      if (pts.length >= 2) {
        const x0 = Math.min(pts[0].x, pts[1].x), x1 = Math.max(pts[0].x, pts[1].x);
        const y0 = Math.min(pts[0].y, pts[1].y), y1 = Math.max(pts[0].y, pts[1].y);
        const enBorde = (x >= x0 - 8 && x <= x1 + 8 && y >= y0 - 8 && y <= y1 + 8) &&
                        !(x > x0 + 8 && x < x1 - 8 && y > y0 + 8 && y < y1 - 8);
        if (enBorde) return true;
      }
    }
  }
  return false;
}

/**
 * Monta la barra sobre `host` (un contenedor position:relative que ya
 * contiene el canvas de la gráfica anfitriona). Devuelve { redibujar }.
 *
 * redibujar(geo, velas, par) se llama al FINAL de cada repintado de la
 * gráfica anfitriona con su geometría:
 *   geo = { W, H, x1, y1, pMin, pMax, Y, ancho, paso, fin }
 *     · Y(p) → píxel; ancho = velas visibles; paso = px por vela;
 *     · fin = índice (exclusivo) de la última vela visible en `velas`.
 */
export function montarBarra(host, opciones = {}) {
  if (!host) return null;
  if (host._nvBarra && host._nvBarra._tools && host.contains(host._nvBarra._tools)) return host._nvBarra;
  estilos();
  host.classList.add('nv-host');

  /* Estado compartido mínimo que esperan interaccion.js / dibujo.js */
  N.herr = N.herr || 'cursor';
  N.imant = (N.imant !== false);
  N.fijar = !!N.fijar;
  N.cursorTipo = N.cursorTipo || 'cruz';
  N.sel = -1; N.dib = null;
  N.vista = N.vista || { desde: 0, ancho: 130, zoomY: 1, offsetY: 0 };
  if (!N.estilo) N.estilo = { color: '#22d3ee', grosor: 2, punteado: false, tam: 7 };
  N._mareaBtn = null; N._faroBtn = null; N._proxBtns = null;

  const wrap = document.createElement('div');
  wrap.innerHTML = BARRA_HTML;
  const tools = wrap.firstElementChild;
  host.appendChild(tools);

  const cv = document.createElement('canvas');
  cv.className = 'nv-cvh';
  Object.assign(cv.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', zIndex: '5', pointerEvents: 'none' });
  host.appendChild(cv);

  let geo = null, velasRef = [];
  const dpr = () => Math.min(2, window.devicePixelRatio || 1);

  function pintar() {
    if (!geo) return;
    const W = geo.W, H = geo.H, d = dpr();
    if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const g = cv.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, W, H);
    N._geo = geo; N.velas = velasRef;
    dibujarHerramientas(g, geo.x1, geo.y1);
  }

  /* El canvas solo captura cuando hace falta. */
  const modoCaptura = (x, y) => {
    if (N.herr !== 'cursor') return true;         // herramienta activa: dibuja
    if (N.sel >= 0 || N.dib) return true;         // editando un dibujo
    return (x != null) ? cercaDeDibujo(x, y) : false;
  };
  const aplicarCaptura = (x, y) => { cv.style.pointerEvents = modoCaptura(x, y) ? 'auto' : 'none'; };

  /* Apertura de la barra al acercarse al borde izquierdo (como en Smart Pools,
     donde lo hace el propio canvas; aquí el canvas no recibe el movimiento). */
  let tHide = 0;
  host.addEventListener('mousemove', (e) => {
    const r = host.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (x < 20) { clearTimeout(tHide); tools.classList.add('abierta'); }
    else if (x > 90) { clearTimeout(tHide); tHide = setTimeout(() => tools.classList.remove('abierta'), 300); }
    if (N._geo === geo) aplicarCaptura(x, y);
  });
  host.addEventListener('click', () => setTimeout(() => aplicarCaptura(), 0), true);
  tools.addEventListener('click', () => setTimeout(() => aplicarCaptura(), 0));

  /* Los gestos y menús: los MISMOS de Smart Pools, sobre nuestro canvas. */
  gestos(cv, () => { pintar(); aplicarCaptura(); }, () => {}, guardarDib);

  /* Las velas de la gráfica anfitriona pueden traer el tiempo en SEGUNDOS
     (Liquidity) y Smart Pools lo guarda en MILISEGUNDOS: se normaliza a ms
     para que un dibujo hecho aquí caiga en el mismo sitio en las tres
     gráficas. Se cachea por referencia para no reconstruir en cada frame. */
  let _cacheSrc = null, _cacheLen = -1, _cacheOut = [];
  const normalizar = (velas) => {
    velas = velas || [];
    if (!velas.length) return velas;
    if (velas[0].t > 1e11) return velas;                    // ya en ms
    if (velas === _cacheSrc && velas.length === _cacheLen) return _cacheOut;
    _cacheSrc = velas; _cacheLen = velas.length;
    _cacheOut = velas.map((v) => ({ t: v.t * 1000, o: v.o, h: v.h, l: v.l, c: v.c, v: v.v }));
    return _cacheOut;
  };

  const api = {
    redibujar(g2, velas, par) {
      if (!g2) return;
      geo = g2; velasRef = normalizar(velas);
      if (par && par !== N.par) { N.par = par; cargarDib(); N.sel = -1; N.dib = null; }
      else if (!N.par && par) { N.par = par; cargarDib(); }
      pintar();
    },
    desmontar() { try { tools.remove(); cv.remove(); host.classList.remove('nv-host'); } catch (_) {} host._nvBarra = null; }
  };
  api._tools = tools;
  host._nvBarra = api;
  return api;
}
