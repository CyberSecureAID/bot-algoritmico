// niveles.js — Smart Levels
//
// QUÉ HACE
//
// Analiza la estructura real del mercado y dibuja sobre la gráfica
// los niveles donde conviene comprar y vender. Nada más.
//
// El usuario no ve celdas, ni números que descifrar, ni el proceso.
// Ve una gráfica limpia con dos o tres líneas y un asistente que le
// dice qué está pasando y qué hacer.
//
// DE DÓNDE SALEN LOS NIVELES
//
// Todo se calcula con las velas reales de Binance. Nada inventado:
//
//   · Pivotes      — máximos y mínimos que el precio respetó
//   · Toques       — cuántas veces volvió a ese nivel sin romperlo
//   · Volumen      — cuánto se negoció ahí de verdad
//   · Tendencia    — la dirección real, medida por estructura
//   · Rango        — si el precio está lateral, se dice y punto
//
// Un nivel solo se dibuja si supera un filtro estricto. Si no hay
// nada claro, el asistente lo dice: "ahora mismo no hay entrada".
// Preferimos callar que inventar una señal.

import { pivotes, tendencia, detectarRango, calcularNiveles, detectarImpulso, detectarEstructuras, calcularTendencia, detectarDobles, marea, calcularATR, construirPlan, traerVelas } from './niveles/motor.js?v=1';
import { estilos } from './niveles/estilos.js?v=1';
import { N } from './niveles/estado.js?v=1';
import { PARES, TFS } from './niveles/config.js?v=1';
import { DIB_FIBS, _tfMs, dibAxy, dibXYa, dibujarHerramientas, guardarDib, cargarDib } from './niveles/dibujo.js?v=1';
import { avisoMarea, activarAlertasMarea, desactivarAlertas } from './niveles/alertas.js?v=1';
import { guardarImagen } from './niveles/imagen.js?v=1';
import { panelMarea } from './niveles/panel.js?v=1';
import { T } from './niveles/i18n.js?v=1';
import { analizar } from './niveles/asistente.js?v=1';
import { guiaIndicador, menuAlertas, abrirWidget, registrarIndicador, ponerLogos, ayuda } from './niveles/menus.js?v=1';
import { gestos } from './niveles/interaccion.js?v=1';
import { burbujas, initBurbujas } from './niveles/burbujas.js?v=1';
import { dibujar, initRender } from './niveles/render.js?v=1';
import { esc, elegir, sembrar, fmt, miles, hora, fecha, _hex2rgb, redondeado } from './niveles/util.js?v=1';

const $ = (id) => document.getElementById(id);






/* ══════════════════════════════════════════════════════════════
   LOS DATOS
   ══════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════
   12. LA LECTURA — qué decirle al usuario

   Aquí no se inventa nada: cada frase sale de un dato calculado.
   Y hay varias formas de decir lo mismo, para que no suene a
   máquina repitiendo la misma línea.
   ══════════════════════════════════════════════════════════════ */

/** Varias formas de decir lo mismo, para que no suene repetitivo.
 *  La elección es estable por par y hora: no cambia en cada refresco. */

const nombreTend = (d) => ({
  alcista: 'alcista', bajista: 'bajista',
  lateral: 'lateral', indefinida: 'sin definir'
}[d] || d);


/* ══════════════════════════════════════════════════════════════
   ABRIR

   Interfaz deliberadamente distinta a las otras dos: no hay panel
   lateral. La gráfica ocupa todo y el asistente habla encima de
   ella, con burbujas ancladas al precio del que hablan.
   ══════════════════════════════════════════════════════════════ */
export async function abrirNiveles() {
  estilos();
  initBurbujas(dibujar);
  initRender(recargar);
  const prev = $('nv-overlay'); if (prev) prev.remove();

  N.velas = []; N.cargando = true; N.error = null;
  _yaTrazado = false;   // la animación de trazado solo en la primera carga
  N.vista = { desde: 0, ancho: window.innerWidth < 760 ? 80 : 130, zoomY: 1, offsetY: 0 };
  N.herr = 'cursor';          // herramienta activa
  N.imant = (N.imant !== false); // imán a las velas (por defecto sí)
  N.fijar = !!N.fijar;        // mantener la herramienta activa tras dibujar
  N.cursorTipo = N.cursorTipo || 'cruz';   // cruz | punto | flecha
  N.mareaMin = true;   // el panel Marea arranca siempre recogido
  N.dib = null;               // dibujo en curso
  N.sel = -1;                 // índice del dibujo seleccionado
  if (!N.estilo) N.estilo = { color: '#22d3ee', grosor: 2, punteado: false, tam: 7 };
  cargarDib();                // dibujos guardados de esta moneda

  const d = document.createElement('div');
  d.id = 'nv-overlay';
  d.innerHTML = `<div class="nv-bg"></div>
    <div class="nv-c">
      <header class="nv-cab">
        <button class="nv-sel" id="nv-sel">
          <i class="nv-logo" data-cg="${esc((PARES.find((p) => p.id === N.par) || {}).cg || '')}"></i>
          <b>${esc(N.par)}</b>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>

        <div class="nv-tfs">
          ${TFS.map((t) => `<button class="nv-tf ${t.id === N.tf ? 'on' : ''}" data-ntf="${t.id}">${t.n}</button>`).join('')}
        </div>

        <div class="nv-estado" id="nv-estado"></div>



        <div class="nv-der">
          <button class="nv-ico" id="nv-cal" title="Economic calendar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4M7.5 13h2M11 13h2M14.5 13h2"/></svg>
          </button>
          <button class="nv-ico" id="nv-widget" title="Overlay (floating window on top of everything)">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="15" rx="2"/><rect x="12" y="11" width="7" height="5" rx="1" fill="currentColor" stroke="none"/></svg>
          </button>
          <button class="nv-ico" id="nv-foto" title="Compartir">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.5"/></svg>
          </button>
          <button class="nv-ico nv-herr-btn" id="nv-herr" title="Indicators">
            <svg class="nv-ind-ic" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="2.6" y="13" width="3.2" height="8" rx="1"/><rect x="7.7" y="9.5" width="3.2" height="11.5" rx="1"/><rect x="12.8" y="6" width="3.2" height="15" rx="1"/><rect x="17.9" y="3" width="3.2" height="18" rx="1"/></svg>
            <span class="nv-ind-tx">Indicators</span>
          </button>
          <button class="nv-ico nv-comof" id="nv-ayuda">
            <span class="nv-cf-tx">Cómo funciona</span><span class="nv-cf-s">?</span>
          </button>
          <button class="nv-ico" id="nv-x" aria-label="Cerrar">✕</button>
        </div>
      </header>

      <!-- La banda de lecturas: aquí viven las píldoras 1, 2 y 3.
           El veredicto y el título salían aquí y eran redundantes:
           las propias tarjetas ya lo dicen. -->
      <div class="nv-veredicto" id="nv-veredicto">
        <div class="nv-caps" id="nv-caps"></div>
        <div class="nv-meta" id="nv-meta"></div>
        <button class="nv-herr-m" id="nv-herr-m" title="Indicators" aria-label="Indicators">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><rect x="2.6" y="13" width="3.2" height="8" rx="1"/><rect x="7.7" y="9.5" width="3.2" height="11.5" rx="1"/><rect x="12.8" y="6" width="3.2" height="15" rx="1"/><rect x="17.9" y="3" width="3.2" height="18" rx="1"/></svg>
        </button>
      </div>

      <div class="nv-graf" id="nv-graf">
        <div class="nv-tools" id="nv-tools">
          <button class="nv-tool on nv-tool-fly" data-h="cursor" data-fly="cursores" title="Cursor"><svg viewBox="0 0 24 24"><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg><b class="nv-fly-mark"></b></button>
          <button class="nv-tool" data-h="marca" title="Marcador (deja puntos)"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="7"/></svg></button>
          <button class="nv-tool nv-tool-fly" data-h="linea" data-fly="lineas" title="Lines"><svg viewBox="0 0 24 24"><path d="M4 19L20 5"/><circle cx="4" cy="19" r="1.8" fill="currentColor" stroke="none"/><circle cx="20" cy="5" r="1.8" fill="currentColor" stroke="none"/></svg><b class="nv-fly-mark"></b></button>
          <button class="nv-tool" data-h="rect" title="Rectangle / zone"><svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1.5"/></svg></button>
          <button class="nv-tool" data-h="fib" title="Fibonacci"><svg viewBox="0 0 24 24"><path d="M3 5h18M3 10h18M3 14h18M3 19h18" opacity=".9"/></svg></button>
          <button class="nv-tool" data-h="flecha" title="Flecha"><svg viewBox="0 0 24 24"><path d="M5 19L19 5M19 5h-7M19 5v7"/></svg></button>
          <button class="nv-tool" data-h="brush" title="Pincel (mano alzada)"><svg viewBox="0 0 24 24"><path d="M3 21c3 0 3-3 6-3s3 3 6 0 3-6 6-6"/><path d="M14 5l5 5-2 2-5-5z"/></svg></button>
          <button class="nv-tool" data-h="texto" title="Texto"><svg viewBox="0 0 24 24"><path d="M5 6h14M12 6v13M9 19h6"/></svg></button>
          <button class="nv-tool" data-h="regla" title="Medir (regla)"><svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="1.2"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/></svg></button>
          <button class="nv-tool" data-h="poslarga" title="Long position"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="7" rx="1.2"/><rect x="4" y="13" width="16" height="7" rx="1.2" opacity=".55"/><path d="M12 4V2"/></svg></button>
          <button class="nv-tool" data-h="poscorta" title="Short position"><svg viewBox="0 0 24 24"><rect x="4" y="13" width="16" height="7" rx="1.2"/><rect x="4" y="4" width="16" height="7" rx="1.2" opacity=".55"/><path d="M12 20v2"/></svg></button>
          <span class="nv-tool-sep"></span>
          <button class="nv-tool" data-h="borrar" title="Eraser (tap a drawing)"><svg viewBox="0 0 24 24"><path d="M4 15l7-7 7 7-4 4H8z"/><path d="M9 20h11"/></svg></button>
          <button class="nv-tool nv-tool-tg" id="nv-iman" title="Snap to candles"><svg viewBox="0 0 24 24"><path d="M6 4v7a6 6 0 0 0 12 0V4"/><path d="M6 4h4M14 4h4"/></svg></button>
          <button class="nv-tool" id="nv-limpiar" title="Clear all"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>
        </div>
        <canvas class="nv-cv" id="nv-cv"></canvas>
        <div class="nv-burbujas" id="nv-burbujas"></div>
        <div class="nv-esperando" id="nv-esperando">
          <div class="nv-spin"></div>
          <b>Analizando la estructura del mercado</b>
          <span>Buscando los niveles donde el precio ha reaccionado de verdad.</span>
        </div>
        <img class="nv-marca" src="assets/img/cco-marca.webp" alt="">
      </div>
    </div>`;
  document.body.appendChild(d);

  const cerrar = () => {
    try { clearInterval(_reloj); } catch (_) {}
    _reloj = null; _widgetVivo = false;
    document.querySelectorAll('#nv-picker,#nv-ayuda-box,#nv-herr-panel,.nv-pop,#nv-ind-modal,#nv-herr-menu,.od-menu,.od-ficha').forEach((x) => x.remove());
    const e = $('nv-overlay'); if (e) e.remove();
    /* Al cerrar se vuelve a la portada de Liquidity, no se sale. */
    try { if (window.__lqpVolver) window.__lqpVolver(); } catch (_) {}
  };
  d.querySelector('.nv-bg').onclick = cerrar;
  $('nv-x').onclick = cerrar;
  $('nv-ayuda').onclick = () => ayuda();
  { const cb = $('nv-cal'); if (cb) cb.onclick = () => { try { window.abrirCalendario && window.abrirCalendario(); } catch (_) {} }; }
  $('nv-herr').onclick = (e) => { e.stopPropagation(); menuHerramientas($('nv-herr')); };
  { const hm = $('nv-herr-m'); if (hm) hm.onclick = (e) => { e.stopPropagation(); menuHerramientas(hm); }; }
  $('nv-foto').onclick = () => guardarImagen(N.par, N.tf);
  /* ── Superponer: convierte el análisis en una ventana flotante que se
     puede mover, agrandar/achicar y queda por encima de todo. Funciona
     en cualquier navegador (no depende de Picture-in-Picture nativo). ── */
  {
    const bw = $('nv-widget');
    const nvc = d.querySelector('.nv-c');
    const redib = () => { if ($('nv-cv')) { dibujar(); burbujas(); } };
    const PASO_W = 90, PASO_H = 70;
    let rObs = null, zoomBtns = null;
    const guardarFlot = () => {
      try {
        const on = d.classList.contains('flotante');
        localStorage.setItem('cco-flotante', JSON.stringify(on
          ? { on: 1, x: parseInt(nvc.style.left) || 0, y: parseInt(nvc.style.top) || 0, w: nvc.offsetWidth, h: nvc.offsetHeight }
          : { on: 0 }));
      } catch (_) {}
    };
    const clampPos = () => {
      const W = nvc.offsetWidth, H = nvc.offsetHeight;
      nvc.style.left = Math.max(4, Math.min(innerWidth - W - 4, parseInt(nvc.style.left) || 0)) + 'px';
      nvc.style.top = Math.max(4, Math.min(innerHeight - H - 4, parseInt(nvc.style.top) || 0)) + 'px';
    };
    const redimPaso = (dir) => {
      nvc.style.width = Math.max(360, Math.min(innerWidth - 8, nvc.offsetWidth + dir * PASO_W)) + 'px';
      nvc.style.height = Math.max(260, Math.min(innerHeight - 8, nvc.offsetHeight + dir * PASO_H)) + 'px';
      clampPos(); redib(); guardarFlot();
    };
    const activarFlotante = (geo) => {
      let W = geo ? geo.w : Math.min(760, Math.round(innerWidth * 0.62));
      let H = geo ? geo.h : Math.min(520, Math.round(innerHeight * 0.66));
      W = Math.max(360, Math.min(innerWidth - 8, W)); H = Math.max(260, Math.min(innerHeight - 8, H));
      nvc.style.width = W + 'px'; nvc.style.height = H + 'px';
      nvc.style.left = (geo ? Math.max(4, Math.min(innerWidth - W - 4, geo.x)) : Math.max(8, innerWidth - W - 24)) + 'px';
      nvc.style.top = (geo ? Math.max(4, Math.min(innerHeight - H - 4, geo.y)) : Math.max(8, innerHeight - H - 24)) + 'px';
      d.classList.add('flotante');
      if (bw) bw.classList.add('on');
      if (!nvc.querySelector('.nv-rz')) { const rz = document.createElement('div'); rz.className = 'nv-rz'; nvc.appendChild(rz); }
      if (!zoomBtns && bw) {   // botones +/- en la cabecera, junto a Superponer
        zoomBtns = document.createElement('div'); zoomBtns.className = 'nv-flot-zoom';
        zoomBtns.innerHTML = `<button class="nv-fz" data-z="-1" title="Achicar">−</button><button class="nv-fz" data-z="1" title="Agrandar">+</button>`;
        bw.parentNode.insertBefore(zoomBtns, bw.nextSibling);
        zoomBtns.addEventListener('click', (e) => { const b = e.target.closest('[data-z]'); if (!b) return; e.stopPropagation(); redimPaso(+b.dataset.z); });
      }
      if ('ResizeObserver' in window && !rObs) { rObs = new ResizeObserver(() => redib()); rObs.observe(nvc); }
      redib(); guardarFlot();
    };
    const desactivarFlotante = () => {
      d.classList.remove('flotante'); if (bw) bw.classList.remove('on');
      nvc.style.left = nvc.style.top = nvc.style.width = nvc.style.height = '';
      if (rObs) { rObs.disconnect(); rObs = null; }
      const rz = nvc.querySelector('.nv-rz'); if (rz) rz.remove();
      if (zoomBtns) { zoomBtns.remove(); zoomBtns = null; }
      redib(); guardarFlot();
    };
    if (bw) bw.onclick = () => {
      // PiP nativo: se mantiene encima de TODO (incluso fuera del navegador).
      // Si el navegador no lo soporta (móvil/Safari/Firefox), ventana flotante en la página.
      if ('documentPictureInPicture' in window) { abrirWidget(N.par, N.tf); return; }
      d.classList.contains('flotante') ? desactivarFlotante() : activarFlotante();
    };

    // Mover la ventana arrastrando la cabecera (menos los botones)
    const cab = d.querySelector('.nv-cab');
    let mv = null;
    cab.addEventListener('mousedown', (e) => {
      if (!d.classList.contains('flotante')) return;
      if (e.target.closest('button, .nv-tfs, .nv-sel, input, .nv-flot-zoom')) return;
      const r = nvc.getBoundingClientRect();
      mv = { dx: e.clientX - r.left, dy: e.clientY - r.top }; e.preventDefault();
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (e) => {
      if (!mv) return;
      const W = nvc.offsetWidth, H = nvc.offsetHeight;
      nvc.style.left = Math.max(4, Math.min(innerWidth - W - 4, e.clientX - mv.dx)) + 'px';
      nvc.style.top = Math.max(4, Math.min(innerHeight - H - 4, e.clientY - mv.dy)) + 'px';
    });
    window.addEventListener('mouseup', () => { if (mv) { mv = null; document.body.style.userSelect = ''; guardarFlot(); } });

    // Redimensionar con la esquina inferior derecha
    let rs = null;
    nvc.addEventListener('mousedown', (e) => {
      if (!d.classList.contains('flotante') || !e.target.classList.contains('nv-rz')) return;
      const r = nvc.getBoundingClientRect();
      rs = { x: e.clientX, y: e.clientY, w: r.width, h: r.height }; e.preventDefault();
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (e) => {
      if (!rs) return;
      nvc.style.width = Math.max(340, Math.min(innerWidth - 8, rs.w + (e.clientX - rs.x))) + 'px';
      nvc.style.height = Math.max(260, Math.min(innerHeight - 8, rs.h + (e.clientY - rs.y))) + 'px';
      redib();
    });
    window.addEventListener('mouseup', () => { if (rs) { rs = null; document.body.style.userSelect = ''; redib(); guardarFlot(); } });
    // Táctil para mover
    cab.addEventListener('touchstart', (e) => {
      if (!d.classList.contains('flotante') || e.touches.length !== 1) return;
      if (e.target.closest('button, .nv-tfs, .nv-sel, input, .nv-flot-zoom')) return;
      const r = nvc.getBoundingClientRect(); mv = { dx: e.touches[0].clientX - r.left, dy: e.touches[0].clientY - r.top };
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!mv || e.touches.length !== 1) return;
      const W = nvc.offsetWidth, H = nvc.offsetHeight;
      nvc.style.left = Math.max(4, Math.min(innerWidth - W - 4, e.touches[0].clientX - mv.dx)) + 'px';
      nvc.style.top = Math.max(4, Math.min(innerHeight - H - 4, e.touches[0].clientY - mv.dy)) + 'px';
    }, { passive: true });
    window.addEventListener('touchend', () => { if (mv) { mv = null; guardarFlot(); } });

    // Recordar entre sesiones (solo la flotante en página; el PiP nativo es aparte)
    try { const gg = JSON.parse(localStorage.getItem('cco-flotante') || 'null'); if (gg && gg.on && !('documentPictureInPicture' in window)) activarFlotante(gg); } catch (_) {}
  }
  $('nv-sel').onclick = (e) => { e.stopPropagation(); menuPares(); };

  d.querySelectorAll('[data-ntf]').forEach((b) => b.onclick = () => {
    N.tf = b.dataset.ntf;
    d.querySelectorAll('[data-ntf]').forEach((x) => x.classList.toggle('on', x.dataset.ntf === N.tf));
    N.vista.desde = 0;
    try { if (N.cerrarFichas) N.cerrarFichas(); } catch (_) {}
    recargar();
  });

  ponerLogos();
  recargar();

  let _t = null;
  window.addEventListener('resize', () => {
    clearTimeout(_t);
    _t = setTimeout(() => { if ($('nv-cv')) { dibujar(); burbujas(); } }, 250);
  });
}

let _reloj = null;
let _yaTrazado = false;
let _planFijo = null;
let _soloOperables = false;  // filtro del selector de monedas
let _operables = null;       // las que tienen contrato en BNB Chain

async function recargar() {
  clearInterval(_reloj);
  N.cargando = true; N.error = null;
  _planFijo = null;      // al cambiar de par o marco, se replantea
  const esp = $('nv-esperando'); if (esp) esp.style.display = '';
  const bs = $('nv-burbujas'); if (bs) bs.innerHTML = '';

  const tick = async () => {
    if (!$('nv-cv')) { clearInterval(_reloj); return; }
    try {
      const par = PARES.find((p) => p.id === N.par) || PARES[0];
      N.velas = await traerVelas(par.s, N.tf, 1000);
      /* La semilla se fija por par y hora: así las frases no bailan
         en cada refresco, pero cambian con el tiempo. */
      sembrar((N.par.charCodeAt(0) + new Date().getHours()) * 1.7);
      analizar(N.par);

      /* [CORREGIDO] El plan cambiaba de dirección entre refrescos y
         eso deja al usuario tirado a medio trade. Ahora una vez
         fijado, se mantiene mientras la tendencia no cambie de
         verdad: es lo que haría cualquier analista serio. */
      const dirAhora = N.tendencia ? N.tendencia.dir : 'lateral';
      if (_planFijo && _planFijo.dir === dirAhora && N.plan &&
          N.plan.lado !== _planFijo.lado && N.plan.lado !== 'esperar') {
        // Se ignora el cambio: la tendencia no ha girado
        N.mensajes = _planFijo.mensajes || N.mensajes;
        N.plan = _planFijo.plan || N.plan;
      } else if (N.plan && N.plan.lado !== 'esperar') {
        _planFijo = { dir: dirAhora, lado: N.plan.lado, plan: N.plan, mensajes: N.mensajes };
      }

      N.cargando = false; N.error = null;
      pintarEstado();
      /* La primera vez se traza el análisis delante del usuario.
         En los refrescos siguientes ya no, para no molestar. */
      if (!_yaTrazado) { _yaTrazado = true; animarTrazo(); }
      else { N.trazo = 1; dibujar(); burbujas(); }
    } catch (_) {
      if (N.cargando) {
        N.error = 'No se pudieron cargar los datos del mercado.';
        N.cargando = false;
        dibujar();
      }
    }
  };
  await tick();
  _reloj = setInterval(tick, 30000);
}

function pintarEstado() {
  const e = $('nv-estado');
  const t = N.tendencia || { dir: 'indefinida' };
  if (e) {
    const cls = t.dir === 'alcista' ? 'sube' : t.dir === 'bajista' ? 'baja' : 'lat';
    const txt = N.rango ? 'In range' : nombreTend(t.dir);
    /* Cambio de las últimas 24 h, calculado con las velas reales (el número
       de velas equivale exactamente a 24 h según la temporalidad). Cápsula
       verde si sube, roja si baja, gris si está plano. */
    const perTf = { '15m': 96, '1h': 24, '4h': 6, '1d': 1 };
    const n24 = perTf[N.tf] || 24;
    let c24 = 0;
    if (N.velas && N.velas.length > 1) {
      const base = N.velas[Math.max(0, N.velas.length - 1 - n24)].c;
      if (base > 0) c24 = ((N.precio - base) / base) * 100;
    }
    const c24cls = c24 > 0.05 ? 'sube' : c24 < -0.05 ? 'baja' : 'lat';
    const c24txt = (c24 >= 0 ? '+' : '') + c24.toFixed(2) + '%';
    e.innerHTML = `<span class="nv-pill ${cls}">${esc(txt.charAt(0).toUpperCase() + txt.slice(1))}</span>
      <span class="nv-precio">${fmt(N.precio)}</span>
      <span class="nv-24h ${c24cls}" title="${esc(T('Cambio 24h'))}">${c24txt}</span>`;
  }

  /* Solo el horizonte y el número de lecturas: lo demás lo dicen
     ya las propias tarjetas, y repetirlo era ruido. */
  const meta = $('nv-meta'); if (!meta) return;
  const cuantas = (N.mensajes || []).length;
  if (!cuantas) { meta.innerHTML = ''; return; }

  const horizonte = {
    '15m': 'horas', '1h': 'de 1 a 3 días', '4h': 'de 3 a 10 días', '1d': 'semanas'
  }[N.tf] || '';

  meta.innerHTML = `
    ${horizonte ? `<span class="nv-v-hz">${esc(T('Horizonte'))}: ${esc(T(horizonte))}</span>` : ''}
    <span class="nv-v-pt">${cuantas} ${cuantas === 1 ? esc(T('lectura')) : esc(T('lecturas'))}</span>`;
}

/* ══════════════════════════════════════════════════════════════
   LA GRÁFICA

   Velas limpias y los niveles dibujados con su etiqueta. Nada más.
   El usuario ve dónde comprar y dónde vender, sin descifrar nada.

   Se guardan las coordenadas de cada nivel para que las burbujas
   del asistente queden ancladas: si la gráfica se mueve, ellas se
   mueven con ella.
   ══════════════════════════════════════════════════════════════ */
let _animId = null;

/* ══════════════════════════════════════════════════════════════
   HERRAMIENTAS DE DIBUJO · análisis técnico sobre el gráfico
   Barra lateral izquierda con las herramientas de TradingView que
   SÍ se pueden hacer sobre este canvas (velas de Binance), en versión
   mejorada: trazos limpios con leve resplandor, imán a las velas, y
   guardado por moneda. Los dibujos se anclan en coordenadas (tiempo,
   precio), así que se mueven con el gráfico al hacer scroll o zoom.
   ══════════════════════════════════════════════════════════════ */

/* Guardado por moneda (persiste entre sesiones) */

/** Traza la línea de tendencia delante del usuario. */
function animarTrazo() {
  cancelAnimationFrame(_animId);
  N.trazo = 0;
  const ini = performance.now();
  const dura = 1100;
  const paso = (t) => {
    const p = Math.min(1, (t - ini) / dura);
    // Suave al final, como si la mano frenara
    N.trazo = 1 - Math.pow(1 - p, 3);
    dibujar();
    if (p < 1) _animId = requestAnimationFrame(paso);
    else { N.trazo = 1; dibujar(); burbujas(); }
  };
  _animId = requestAnimationFrame(paso);
}


function velaEn(i) { return N.velas[i] || null; }


/* ══════════════════════════════════════════════════════════════
   EL PANEL DE MAREA — tablero de confluencia

   Va dentro de la gráfica, arriba a la derecha. No es una raya de
   colores: es un instrumento. Reúne en un sitio la lectura de los
   indicadores internos (Heikin Ashi, ADX/DI, volumen, estructura y
   ciclo) y enseña cuántos coinciden ahora mismo — la CONFLUENCIA — más
   cuánto le falta al precio para disparar cada señal.

   El anillo y los porcentajes NO son una predicción: son cuántos de
   los cinco confirmadores se cumplen. Se dice así en el pie.
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   LAS BURBUJAS DEL ASISTENTE

   Van ancladas al precio del que hablan: si la gráfica se mueve o
   se estira, ellas siguen a su nivel. Nunca se despegan.
   ══════════════════════════════════════════════════════════════ */

/** Traza el Fibonacci delante del usuario, como la tendencia. */
function animarFibo() {
  cancelAnimationFrame(_animId);
  const desde = 0.35;
  N.trazo = desde;
  const ini = performance.now();
  const dura = 900;
  const paso = (t) => {
    const p = Math.min(1, (t - ini) / dura);
    N.trazo = desde + (1 - desde) * (1 - Math.pow(1 - p, 3));
    dibujar();
    if (p < 1) _animId = requestAnimationFrame(paso);
    else { N.trazo = 1; dibujar(); }
  };
  _animId = requestAnimationFrame(paso);
}

/** Escribe el texto letra a letra, como si lo tecleara. */

/** El plan de operación, en tabla: entrada, stop y objetivos. */

/* ══════════════════════════════════════════════════════════════
   GESTOS — como en TradingView

   · Arrastrar el gráfico mueve en el tiempo
   · Rueda sobre el gráfico: acerca y aleja
   · Rueda sobre la escala derecha: estira y comprime en vertical
   · Arrastrar la escala derecha: lo mismo, con el dedo
   · Doble clic: vuelve al encuadre inicial
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   MENÚ DE HERRAMIENTAS
   ══════════════════════════════════════════════════════════════ */
function menuHerramientas(anchor) {
  const prev = document.getElementById('nv-ind-modal');
  if (prev) { prev.remove(); return; }

  /* Data-driven: añadir una herramienta nueva es meter una entrada aquí.
     Cada una lleva su ícono SVG, nombre, etiqueta corta y descripción.
     El modal (estilo TradingView) trae buscador y una lista con
     interruptores, con espacio para muchos más indicadores en el futuro. */
  const IC = {
    limpia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M18.5 6l-.9 13.1A2 2 0 0 1 15.6 21H8.4a2 2 0 0 1-2-1.9L5.5 6"/><path d="M10 10.5v6M14 10.5v6"/></svg>',
    marea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 11c2.2 0 2.2-2.2 4.4-2.2S8.6 11 10.8 11 13 8.8 15.2 8.8 17.4 11 19.6 11 22 8.8 22 8.8"/><path d="M2 16c2.2 0 2.2-2.2 4.4-2.2S8.6 16 10.8 16 13 13.8 15.2 13.8 17.4 16 19.6 16 22 13.8 22 13.8"/></svg>',
    estructura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9.4" y="3.4" width="5.2" height="3.6" rx="1.1"/><path d="M12 1.6V3.2"/><path d="M16.6 5.2 19 4M7.4 5.2 5 4"/><path d="M10 7h4l1.1 13.4H8.9L10 7z"/><path d="M9.3 12.2h5.4"/></svg>',
    alertas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>'
  };
  const HERRAS = [
    { h: 'marea', on: !!N.verMarea, nombre: 'Marea', tag: 'cycle change', ico: IC.marea, accion: false,
      desc: 'cycle change',
      guia: 'Marea identifica los puntos en los que el mercado cambia de ciclo: el momento en que el control pasa de compradores a vendedores, o al revés. Su propósito es señalar el giro de tendencia con criterio, no en cada oscilación.\n\nCómo interpretarlo: una señal LONG (verde) indica que el ciclo ha girado al alza y que la presión compradora toma el control; una señal SHORT (roja) indica lo contrario. Sobre el gráfico verás además dos niveles de disparo: la línea que el precio debe superar para activar el próximo LONG y la que debe perder para activar el próximo SHORT, cada una con la distancia que le falta al precio para alcanzarla.\n\nAplicación operativa: use la distancia a esos niveles para anticipar cuándo se acerca una señal y planificar la entrada con antelación en lugar de reaccionar tarde. Confirme el giro con precio y volumen antes de comprometer capital, y combine la herramienta con las Alertas para no depender de la vigilancia manual. La ausencia de señal es información válida: indica que no hay un cambio de ciclo con respaldo suficiente.' },
    { h: 'estructura', on: N.verEstructura === true, nombre: 'Faro', tag: 'estructura', ico: IC.estructura, accion: false,
      desc: 'estructura',
      guia: 'Faro traza la estructura del mercado sobre el gráfico: soportes y resistencias, la dirección de la tendencia, los límites del rango y las formaciones de doble techo y doble suelo. Ofrece el mapa de las zonas donde el precio suele reaccionar.\n\nCómo interpretarlo: un soporte es un nivel por debajo del precio donde la demanda tiende a frenar las caídas; una resistencia, un nivel por encima donde la oferta tiende a frenar las subidas. Los dobles techos y dobles suelos anticipan agotamiento de la tendencia vigente.\n\nAplicación operativa: apóyese en estos niveles para definir entradas, objetivos y la ubicación del stop de pérdidas. Trátelos como zonas de probabilidad, no de certeza: aportan contexto para la decisión, no una garantía. Puede desactivarlo cuando necesite un gráfico despejado.' },
    { h: 'alertas', on: !!N.alertas, nombre: 'Alertas', tag: (N.alertas && N.alertaPar) ? N.alertaPar : N.par, ico: IC.alertas, accion: true,
      desc: 'notificaciones',
      guia: 'Las Alertas emiten una notificación con sonido cuando se produce el evento que usted defina, de modo que no necesite mantener la vista sobre el gráfico de forma continua.\n\nCómo configurarlas: seleccione Marea para recibir aviso en el instante en que se dispare una señal LONG o SHORT, o Faro para fijar una alerta sobre un precio concreto directamente en el gráfico. La alerta queda asociada al par que esté operando.\n\nConsideración importante: al ejecutarse en el navegador, las notificaciones se entregan mientras la página permanezca abierta, incluso en segundo plano. Manténgala activa para no perder avisos.' }
  ];

  const items = HERRAS.map((t) => `
    <div class="nv-ind-item ${t.on ? 'on' : ''}" data-h="${t.h}" data-buscar="${esc((t.nombre + ' ' + t.tag + ' ' + t.desc).toLowerCase())}" role="button" tabindex="0">
      <span class="nv-ind-ic">${t.ico || ''}</span>
      <div class="nv-ind-tx">
        <div class="nv-ind-nm"><b>${esc(T(t.nombre))}</b>${t.tag ? `<em>${esc(T(t.tag))}</em>` : ''}</div>
      </div>
      <button class="nv-ind-help" data-help="${t.h}" type="button" aria-label="${esc(T('Cómo funciona') + ' ' + T(t.nombre))}">
        <span>?</span><em>${esc(T('Cómo funciona'))}</em>
      </button>
      ${t.accion
        ? `<span class="nv-ind-go">›</span>`
        : `<span class="nv-ind-sw" aria-hidden="true"><span class="nv-ind-kn"></span></span>`}
    </div>`).join('');

  const m = document.createElement('div');
  m.id = 'nv-ind-modal';
  m.innerHTML = `
    <div class="nv-ind-bg"></div>
    <div class="nv-ind-card" role="dialog" aria-modal="true">
      <div class="nv-ind-head">
        <h3>Indicators</h3>
        <div class="nv-ind-acc">
          <button class="nv-ind-limpia ${N.limpia ? 'on' : ''}" id="nv-ind-limpia" type="button" title="${esc(T('Gráfica limpia'))}" aria-label="${esc(T('Gráfica limpia'))}">
            ${IC.limpia}<span>${esc(T('Limpiar'))}</span>
          </button>
          <button class="nv-ind-x" aria-label="${esc(T('Cerrar'))}">✕</button>
        </div>
      </div>
      <div class="nv-ind-search">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input id="nv-ind-q" type="text" placeholder="${esc(T('Buscar indicador…'))}" autocomplete="off">
      </div>
      <div class="nv-ind-list" id="nv-ind-list">${items}</div>
      <div class="nv-ind-nada" id="nv-ind-nada" style="display:none">${esc(T('No hay indicadores que coincidan.'))}</div>
      <div class="nv-ind-pie">${esc(T('Más indicadores muy pronto · ¿tienes uno? Regístralo.'))}</div>
    </div>`;
  document.body.appendChild(m);

  const cerrar = () => m.remove();
  m.querySelector('.nv-ind-bg').onclick = cerrar;
  m.querySelector('.nv-ind-x').onclick = cerrar;

  // Botón compacto "Gráfica limpia" (arriba): apaga/enciende todo
  const btnLimpia = m.querySelector('#nv-ind-limpia');
  if (btnLimpia) btnLimpia.onclick = () => {
    N.limpia = !N.limpia;
    btnLimpia.classList.toggle('on', N.limpia);
    dibujar(); burbujas();
  };

  // Buscador: filtra la lista en vivo
  const q = m.querySelector('#nv-ind-q');
  const lista = m.querySelector('#nv-ind-list');
  const nada = m.querySelector('#nv-ind-nada');
  const filtrar = () => {
    const t = q.value.trim().toLowerCase();
    let vis = 0;
    lista.querySelectorAll('.nv-ind-item').forEach((it) => {
      const ok = !t || it.dataset.buscar.includes(t);
      it.style.display = ok ? '' : 'none';
      if (ok) vis++;
    });
    nada.style.display = vis ? 'none' : '';
  };
  q.addEventListener('input', filtrar);
  setTimeout(() => { try { q.focus(); } catch (_) {} }, 30);

  // Encender / apagar cada indicador, o abrir su guía "Cómo funciona"
  lista.addEventListener('click', (e) => {
    const ayuda = e.target.closest('[data-help]');
    if (ayuda) {
      e.stopPropagation();
      const t = HERRAS.find((x) => x.h === ayuda.dataset.help);
      if (t) guiaIndicador(T(t.nombre), t.guia);
      return;
    }
    const it = e.target.closest('[data-h]');
    if (!it) return;
    const cual = it.dataset.h;
    if (cual === 'alertas') { cerrar(); menuAlertas(N.par, N.tf); return; }
    if (cual === 'marea') { N.verMarea = !N.verMarea; if (N.verMarea && N.mareaMin == null) N.mareaMin = true; }
    else if (cual === 'limpia') N.limpia = !N.limpia;
    else if (cual === 'estructura') N.verEstructura = !N.verEstructura;
    it.classList.toggle('on');
    dibujar(); burbujas();
  });
}

/* Ventana "Cómo funciona": explicación para principiantes (no técnica) de
   cómo usar y aprovechar el indicador. Se abre encima del modal y trae una
   X para cerrarla (no se queda congelada). */

/* ══════════════════════════════════════════════════════════════
   ALERTAS DE MAREA — notificación push con sonido

   Cuando el usuario las enciende, la herramienta vigila EN SEGUNDO
   PLANO el par fijado (aunque esté mirando otro) y, en cuanto Marea
   dispara una señal nueva, lanza una notificación del sistema con
   sonido: en el móvil y en la computadora.

   Límite honesto: una web solo puede notificar mientras la página
   siga viva (abierta, aunque esté en segundo plano). Para recibir
   avisos con la app cerrada del todo haría falta un servidor de push,
   que no forma parte de esta herramienta.
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   VENTANA DE ALERTAS — elegir indicador y condiciones

   Al tocar "Alertas" no se activa nada a ciegas: se abre esta ventana
   donde el usuario elige PARA QUÉ INDICADOR y con QUÉ CONDICIONES.
     · Marea  → avisos de señal LONG, SHORT o ambas (tiene tachuelas).
     · Faro   → no tiene señales de entrada/salida, así que sus alertas
                son de PRECIO por clic derecho ("solo avísame").
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   MODO VENTANA FLOTANTE (widget de escritorio)

   Abre una ventana pequeña, SIEMPRE ENCIMA de las demás ventanas del
   escritorio, que refleja la gráfica en vivo. Sirve para tener el
   precio y las señales de Marea a la vista mientras se trabaja en otra
   cosa. Usa Document Picture-in-Picture (Chrome/Edge de escritorio).

   Aclaración honesta: una web NO puede ponerse por encima de las demás
   APPS del teléfono (eso solo lo hace una app nativa con permiso de
   superposición). En móvil, para no perderse una señal están las
   Alertas, que notifican con sonido.
   ══════════════════════════════════════════════════════════════ */
let _widgetVivo = false;

/* ══════════════════════════════════════════════════════════════
   REGISTRAR MI INDICADOR — propuesta comercial

   Abre una tarjeta explicando que un creador de indicadores o
   estrategias (por ejemplo de TradingView) puede proponer su
   herramienta para mostrarla en esta gráfica, con un proceso previo de
   evaluación y verificación, y un acuerdo por comisión (BNB o USDT).
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   SELECTOR DE MONEDA
   ══════════════════════════════════════════════════════════════ */
function menuPares() {
  const prev = document.getElementById('nv-picker');
  if (prev) { prev.remove(); return; }
  const anc = $('nv-sel');
  const m = document.createElement('div');
  m.id = 'nv-picker';
  m.innerHTML = `<input class="nv-buscar" id="nv-buscar" placeholder="Buscar…" autocomplete="off">
    <!-- Filtro: solo las que se pueden comprar y vender desde aquí -->
    <button class="nv-filtro ${_soloOperables ? 'on' : ''}" id="nv-filtro" type="button">
      <span class="nv-fl-ic">${_soloOperables ? '✓' : '○'}</span>
      ${esc(T('Only the ones I can trade'))}
    </button>
    <div class="nv-lista-mon">
      ${['cripto', 'divisa', 'materia'].map((gr) => {
        const lista = PARES.filter((p) => (p.grupo || 'cripto') === gr);
        if (!lista.length) return '';
        const tit = { cripto: 'Criptomonedas', divisa: 'Forex', materia: 'Materias primas' }[gr];
        return `<div class="nv-grupo">${esc(T(tit))}</div>` + lista.map((p) => `
          <button class="nv-op ${p.id === N.par ? 'on' : ''}" data-np="${p.id}"
                  data-busca="${esc((p.id + ' ' + p.n).toLowerCase())}">
            <i class="nv-logo" data-cg="${esc(p.cg)}"></i>
            <b>${esc(p.id)}</b><span>${esc(p.n)}</span>
          </button>`).join('');
      }).join('')}
    </div>`;
  document.body.appendChild(m);
  const r = anc.getBoundingClientRect();
  const w = m.offsetWidth || 232;
  m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
  m.style.top = (r.bottom + 6) + 'px';
  setTimeout(ponerLogos, 30);

  m.addEventListener('click', (e) => e.stopPropagation());
  $('nv-buscar').oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    m.querySelectorAll('[data-np]').forEach((x) => {
      x.style.display = !q || x.dataset.busca.includes(q) ? '' : 'none';
    });
    // Ocultar los títulos de grupos que se quedan sin resultados
    m.querySelectorAll('.nv-grupo').forEach((g) => {
      let hay = false, sig = g.nextElementSibling;
      while (sig && !sig.classList.contains('nv-grupo')) {
        if (sig.style.display !== 'none') { hay = true; break; }
        sig = sig.nextElementSibling;
      }
      g.style.display = hay ? '' : 'none';
    });
  };
  /* El filtro deja solo las monedas con contrato en BNB Chain:
     las demás se pueden analizar, pero no operar desde el gráfico. */
  const aplicarFiltro = async () => {
    if (!_operables) {
      try {
        const tk = await import('./tokens.js?v=125');
        _operables = new Set(Object.values(tk.MONEDAS).map((x) => x.simbolo));
      } catch (_) { _operables = new Set(); }
    }
    m.querySelectorAll('[data-np]').forEach((x) => {
      const puede = _operables.has(x.dataset.np);
      x.classList.toggle('no-operable', !puede);
      if (_soloOperables && !puede) x.style.display = 'none';
      else if (!x.dataset.busca || !$('nv-buscar').value) x.style.display = '';
    });
    m.querySelectorAll('.nv-grupo').forEach((g) => {
      let hay = false, sig = g.nextElementSibling;
      while (sig && !sig.classList.contains('nv-grupo')) {
        if (sig.style.display !== 'none') { hay = true; break; }
        sig = sig.nextElementSibling;
      }
      g.style.display = hay ? '' : 'none';
    });
  };

  $('nv-filtro').onclick = (e) => {
    e.stopPropagation();
    _soloOperables = !_soloOperables;
    const b = $('nv-filtro');
    b.classList.toggle('on', _soloOperables);
    b.querySelector('.nv-fl-ic').textContent = _soloOperables ? '✓' : '○';
    if (!_soloOperables) m.querySelectorAll('[data-np]').forEach((x) => { x.style.display = ''; });
    aplicarFiltro();
  };
  aplicarFiltro();

  setTimeout(() => { try { $('nv-buscar').focus(); } catch (_) {} }, 60);

  m.querySelectorAll('[data-np]').forEach((b) => b.onclick = () => {
    N.par = b.dataset.np;
    const bb = anc.querySelector('b'); if (bb) bb.textContent = N.par;
    const lg = anc.querySelector('.nv-logo');
    if (lg) { lg.dataset.cg = (PARES.find((x) => x.id === N.par) || {}).cg || ''; lg.classList.remove('con'); lg.style.backgroundImage = ''; }
    m.remove();
    /* Una ficha de otra moneda no puede quedarse abierta. */
    try { if (N.cerrarFichas) N.cerrarFichas(); } catch (_) {}
    N.vista.desde = 0; N.vista.zoomY = 1;
    ponerLogos();
    recargar();
  });
  setTimeout(() => document.addEventListener('click', () => {
    const x = document.getElementById('nv-picker'); if (x) x.remove();
  }, { once: true }), 10);
}


/* ══════════════════════════════════════════════════════════════
   LA GUÍA
   ══════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════
   COMPARTIR
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   ESTILOS
   ══════════════════════════════════════════════════════════════ */
