/* ══════════════════════════════════════════════════════════════════════
   futuros-grafica.js — Gráfica de velas LIMPIA para Futuros (pieza 1)
   ══════════════════════════════════════════════════════════════════════
   Gráfica propia, sin TradingView y sin las herramientas de Smart Levels.
   Solo velas, ejes, precio en vivo, cuadrícula, scroll y zoom. Datos de
   Binance vía traerVelas (la misma función que ya usa el resto del sitio).

   Expone un objeto de control con el CONTRATO que el sistema de órdenes
   necesita (precioEn, precioActual, par, canvas, repintar), para que en la
   pieza siguiente el clic derecho dibuje las posiciones sobre esta gráfica,
   igual que en spot.

   Uso:
     const g = crearGrafica(contenedor);
     await g.cargar('BTCUSDT', '15m');
     g.cfg  // -> { canvas, precioEn, precioActual, par, repintar }
*/

import { traerVelas } from './niveles/motor.js?v=1';

const COL = {
  up:   '#22c55e',
  down: '#f6465d',
  upW:  '#16a34a',
  downW:'#c1283b',
  grid: 'rgba(255,255,255,.05)',
  axis: '#7d8794',
  bg:   'transparent',
  cross:'rgba(232,184,75,.5)'
};

export function crearGrafica(cont) {
  cont.innerHTML = '<canvas class="fg-cv"></canvas><div class="fg-load">Cargando…</div>';
  const cv = cont.querySelector('.fg-cv');
  const load = cont.querySelector('.fg-load');
  const ctx = cv.getContext('2d');

  let velas = [];
  let simbolo = '', tf = '15m';
  let vista = { fin: 0, ancho: 90 };        // qué tramo de velas se ve
  let zoomY = 1, offY = 0;
  let cursor = null;                        // {x,y} del ratón
  let ejeW = 66, ejeH = 26;                 // márgenes de ejes (precio der, tiempo abajo)
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function medir() {
    const r = cont.getBoundingClientRect();
    // Si el contenedor aún no tiene tamaño (layout sin asentar), reintenta.
    if (r.width < 10 || r.height < 10) { requestAnimationFrame(medir); return; }
    dpr = Math.max(1, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    cv.style.width = r.width + 'px';
    cv.style.height = r.height + 'px';
    dibujar();
  }

  /* Rango de precio visible (con margen y zoom del usuario). */
  function rango() {
    const vis = tramoVisible();
    if (!vis.length) return { min: 0, max: 1 };
    let min = Infinity, max = -Infinity;
    vis.forEach((k) => { if (k.l < min) min = k.l; if (k.h > max) max = k.h; });
    const m = (max - min) * 0.08 || 1;
    min -= m; max += m;
    // zoom/paneo vertical
    const c = (min + max) / 2, h = (max - min) / 2 / zoomY;
    return { min: c - h + offY, max: c + h + offY };
  }

  function tramoVisible() {
    const total = velas.length;
    if (!total) return [];
    const fin = vista.fin || total;
    return velas.slice(Math.max(0, fin - vista.ancho), Math.min(total, fin));
  }

  /* Coordenada Y -> precio (contrato para órdenes). */
  function precioEn(y) {
    const r = rango();
    const h = cv.height / dpr - ejeH;
    return r.max - (y / h) * (r.max - r.min);
  }
  /* Precio -> Y en pantalla. */
  function yDe(precio) {
    const r = rango();
    const h = cv.height / dpr - ejeH;
    return ((r.max - precio) / (r.max - r.min)) * h;
  }
  function precioActual() {
    return velas.length ? velas[velas.length - 1].c : 0;
  }

  function fmtPrecio(p) {
    if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 1 });
    if (p >= 1)    return p.toFixed(2);
    if (p >= 0.01) return p.toFixed(4);
    return p.toPrecision(4);
  }

  function dibujar() {
    if (!velas.length) return;
    const W = cv.width / dpr, H = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const areaW = W - ejeW;
    const areaH = H - ejeH;
    const vis = tramoVisible();
    const n = vis.length;
    const paso = areaW / n;
    const velaW = Math.max(1, Math.min(paso * 0.7, 18));
    const r = rango();
    const escY = (p) => ((r.max - p) / (r.max - r.min)) * areaH;

    // Cuadrícula horizontal + eje de precio.
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'middle';
    const pasos = 6;
    for (let i = 0; i <= pasos; i++) {
      const p = r.min + (r.max - r.min) * (i / pasos);
      const y = escY(p);
      ctx.strokeStyle = COL.grid;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(areaW, y); ctx.stroke();
      ctx.fillStyle = COL.axis;
      ctx.textAlign = 'left';
      ctx.fillText(fmtPrecio(p), areaW + 6, y);
    }

    // Velas.
    vis.forEach((k, i) => {
      const x = i * paso + paso / 2;
      const sube = k.c >= k.o;
      const col = sube ? COL.up : COL.down;
      const colW = sube ? COL.upW : COL.downW;
      // mecha
      ctx.strokeStyle = colW;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, escY(k.h)); ctx.lineTo(x, escY(k.l));
      ctx.stroke();
      // cuerpo
      const yO = escY(k.o), yC = escY(k.c);
      const top = Math.min(yO, yC);
      const alt = Math.max(1, Math.abs(yC - yO));
      ctx.fillStyle = col;
      ctx.fillRect(x - velaW / 2, top, velaW, alt);
    });

    // Línea de precio actual.
    const pa = precioActual();
    const yPA = escY(pa);
    ctx.strokeStyle = 'rgba(232,184,75,.55)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, yPA); ctx.lineTo(areaW, yPA); ctx.stroke();
    ctx.setLineDash([]);
    // etiqueta de precio actual
    ctx.fillStyle = 'var(--gold,#E8B84B)';
    ctx.fillStyle = '#E8B84B';
    ctx.fillRect(areaW, yPA - 9, ejeW, 18);
    ctx.fillStyle = '#241900';
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px "IBM Plex Mono", monospace';
    ctx.fillText(fmtPrecio(pa), areaW + 6, yPA);

    // Cruz del cursor.
    if (cursor) {
      ctx.strokeStyle = COL.cross;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cursor.x, 0); ctx.lineTo(cursor.x, areaH);
      ctx.moveTo(0, cursor.y); ctx.lineTo(areaW, cursor.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // precio en el cursor
      const pc = precioEn(cursor.y);
      ctx.fillStyle = '#1b2027';
      ctx.fillRect(areaW, cursor.y - 9, ejeW, 18);
      ctx.fillStyle = '#e9edf5';
      ctx.fillText(fmtPrecio(pc), areaW + 6, cursor.y);
    }

    // Permite a quien use la gráfica dibujar ENCIMA (posiciones, órdenes).
    if (typeof _alDibujar === 'function') {
      try { _alDibujar({ ctx, areaW, areaH, escY, yDe, precioActual, rango: r }); } catch (_) {}
    }
  }

  let _alDibujar = null;

  async function cargar(sim, temporalidad) {
    simbolo = sim; tf = temporalidad || tf;
    load.style.display = '';
    try {
      velas = await traerVelas(simbolo, tf, 500);
      vista.fin = velas.length;
      zoomY = 1; offY = 0;
      load.style.display = 'none';
      medir(); dibujar();
    } catch (e) {
      load.textContent = 'No se pudieron cargar las velas.';
    }
  }

  // Interacción estilo TradingView. Tres zonas:
  //  · eje de PRECIO (derecha): arrastrar vertical estira/contrae el precio.
  //  · eje de TIEMPO (abajo): arrastrar horizontal aleja/acerca (nº de velas).
  //  · área central: arrastrar = desplazar (pan horizontal + vertical).
  let arr = false, zona = 'area', ax = 0, ay = 0, finIni = 0, offYini = 0, zoomYini = 1, anchoIni = 0;
  cv.style.touchAction = 'none';

  function zonaDe(x, y) {
    const W = cv.width / dpr, H = cv.height / dpr;
    if (x >= W - ejeW) return 'precio';   // banda derecha
    if (y >= H - ejeH) return 'tiempo';   // banda inferior
    return 'area';
  }
  // Cursor según la zona bajo el ratón.
  function cursorZona(z) {
    cv.style.cursor = z === 'precio' ? 'ns-resize' : z === 'tiempo' ? 'ew-resize' : 'crosshair';
  }

  cv.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    arr = true; zona = zonaDe(x, y);
    ax = e.clientX; ay = e.clientY;
    finIni = vista.fin || velas.length; offYini = offY; zoomYini = zoomY; anchoIni = vista.ancho;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  });
  cv.addEventListener('pointerup', (e) => { arr = false; try { cv.releasePointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener('pointercancel', () => { arr = false; });

  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    cursor = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!arr) { cursorZona(zonaDe(cursor.x, cursor.y)); dibujar(); return; }

    if (zona === 'precio') {
      // Arrastrar el eje de precio: estira/contrae vertical (como TradingView).
      const dy = e.clientY - ay;
      const factor = 1 + dy / 200;
      zoomY = Math.max(0.4, Math.min(8, zoomYini * factor));
    } else if (zona === 'tiempo') {
      // Arrastrar el eje de tiempo: aleja/acerca (nº de velas visibles).
      const dx = e.clientX - ax;
      const factor = 1 - dx / 300;
      vista.ancho = Math.max(20, Math.min(480, Math.round(anchoIni * factor)));
    } else {
      // Área central: pan.
      const areaW = cv.width / dpr - ejeW;
      const paso = areaW / vista.ancho;
      const dv = Math.round((e.clientX - ax) / paso);
      vista.fin = Math.max(20, Math.min(velas.length + Math.floor(vista.ancho * 0.3), finIni - dv));
      const rg = rango();
      offY = offYini + (e.clientY - ay) / (cv.height / dpr - ejeH) * (rg.max - rg.min);
    }
    dibujar();
  });
  cv.addEventListener('pointerleave', () => { if (!arr) { cursor = null; cv.style.cursor = 'default'; dibujar(); } });

  // Doble clic en el eje de precio = auto-fit (resetea zoom vertical).
  cv.addEventListener('dblclick', (e) => {
    const r = cv.getBoundingClientRect();
    const z = zonaDe(e.clientX - r.left, e.clientY - r.top);
    if (z === 'precio') { zoomY = 1; offY = 0; dibujar(); }
    else if (z === 'tiempo') { vista.ancho = 90; dibujar(); }
  });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.shiftKey) {                 // zoom vertical
      zoomY = Math.max(0.5, Math.min(6, zoomY * (e.deltaY < 0 ? 1.1 : 0.9)));
    } else {                          // zoom horizontal (nº de velas)
      vista.ancho = Math.max(20, Math.min(480, Math.round(vista.ancho * (e.deltaY < 0 ? 0.9 : 1.1))));
    }
    dibujar();
  }, { passive: false });

  window.addEventListener('resize', () => { medir(); dibujar(); });

  // Refresco en vivo: repide la última vela cada 5 s.
  const refresco = setInterval(async () => {
    if (!simbolo) return;
    try {
      const nuevas = await traerVelas(simbolo, tf, 2);
      if (nuevas.length && velas.length) {
        const ult = velas[velas.length - 1];
        const fresca = nuevas[nuevas.length - 1];
        if (fresca.t === ult.t) velas[velas.length - 1] = fresca;
        else velas.push(fresca);
        if (vista.fin >= velas.length - 1) vista.fin = velas.length;
        dibujar();
      }
    } catch (_) {}
  }, 5000);

  medir();

  return {
    cargar,
    dibujar,
    setTemporalidad: (t) => cargar(simbolo, t),
    alDibujar: (fn) => { _alDibujar = fn; },
    destruir: () => { clearInterval(refresco); },
    // CONTRATO para el sistema de órdenes (pieza siguiente).
    cfg: {
      get canvas() { return cv; },
      precioEn,
      precioActual,
      par: () => simbolo,
      repintar: dibujar
    }
  };
}
