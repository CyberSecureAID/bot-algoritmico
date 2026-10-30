/* niveles/render.js — El render principal de Smart Levels: dibuja las velas,
   los niveles, los indicadores (Marea, Faro), las herramientas del usuario y
   arranca la interacción (gestos) y las órdenes (orden.js) en el primer
   dibujado. Extraído de niveles.js. Recibe recargar por initRender para no
   crear dependencias circulares. Sin cambios de lógica. */

import { N } from './estado.js?v=1';
import { T } from './i18n.js?v=1';
import { fmt, esc, redondeado, hora, fecha } from './util.js?v=1';
import { panelMarea } from './panel.js?v=1';
import { dibujarHerramientas, dibAxy, dibXYa, _tfMs, DIB_FIBS, guardarDib } from './dibujo.js?v=1';
import { gestos } from './interaccion.js?v=1';
import { burbujas } from './burbujas.js?v=1';
import { PARES } from './config.js?v=1';

const $ = (id) => document.getElementById(id);
function velaEn(i) { return N.velas[i] || null; }
let _recargar = () => {};
export function initRender(recargar) { _recargar = recargar; }

export function dibujar() {
  const cv = $('nv-cv'); const zona = $('nv-graf');
  if (!cv || !zona) return;
  const W = zona.clientWidth, H = zona.clientHeight;
  if (W < 50 || H < 50) return;

  if (!cv.dataset.listo) {
    gestos(cv, dibujar, burbujas, guardarDib);
    cv.dataset.listo = '1';
    /* Órdenes desde el gráfico: clic derecho o toque largo. */
    import('../orden.js?v=126').then((od) => {
      od.conectar({
        canvas: cv,
        precioEn: (y) => {
          if (!N._geo) return 0;
          const { pMin, pMax, y1 } = N._geo;
          return pMin + (pMax - pMin) * ((y1 - y) / y1);
        },
        precioActual: () => N.precio,
        par: () => N.par,
        simbolo: () => (PARES.find((p) => p.id === N.par) || {}).s || '',
        repintar: () => dibujar()
      });
      N.od = od;
      N.cerrarFichas = od.cerrarFichas;
      od.clicCancelar(cv, () => N.zonasOd, () => dibujar());
      dibujar();
    }).catch(() => {});
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr)) {
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#0b0f16';
  g.fillRect(0, 0, W, H);

  /* [NUEVA REGLA] Las etiquetas se guardan aquí y se pintan AL
     FINAL, por encima de todas las líneas. Antes cualquier línea
     trazada después las tapaba y el texto era ilegible. */
  const etiquetas = [];
  /* Las TACHUELAS (LONG/SHORT de Marea) van en su propia cola y se
     pintan al final del todo, por encima de cualquier línea. */
  const tachuelas = [];

  const esp = $('nv-esperando');
  if (N.error) {
    if (esp) {
      esp.style.display = '';
      esp.innerHTML = `<b>${esc(N.error)}</b><span>Revisa tu conexión y vuelve a intentarlo.</span>
        <button class="nv-btn" id="nv-retry">Reintentar</button>`;
      const b = $('nv-retry'); if (b) b.onclick = () => _recargar();
    }
    return;
  }
  if (N.cargando || !N.velas.length) { if (esp) esp.style.display = ''; return; }
  if (esp) esp.style.display = 'none';

  const mDer = 64, mAba = 26;
  const x1 = W - mDer, y1 = H - mAba;

  /* [CORREGIDO] Las velas llegaban pegadas al borde derecho y no se
     podían despegar. Ahora se reserva un hueco a la derecha, como en
     TradingView, y el desplazamiento puede ser negativo para empujar
     el gráfico más allá de la última vela. */
  /* La ventana siempre muestra `ancho` velas completas: al mover a la
     izquierda se detiene cuando llega a la vela más antigua (sin aplastar
     ni dejar hueco), y a la derecha se permite solo un respiro del 15%. */
  const total = N.velas.length;
  const ancho = Math.max(20, Math.min(total, N.vista.ancho));
  const huecoMax = Math.floor(ancho * 0.15);
  const desp = Math.max(-huecoMax,
                        Math.min(N.vista.desde, Math.max(0, total - ancho)));
  N.vista.desde = desp;
  const fin = total - desp;
  const vis = N.velas.slice(Math.max(0, fin - ancho), Math.min(total, fin));
  if (!vis.length) return;

  /* Cuántas posiciones vacías quedan a la derecha (hueco de respiro) */
  const huecoDer = Math.max(0, ancho - vis.length + (desp < 0 ? -desp : 0));

  /* Rango vertical: velas y niveles, con el zoom del usuario */
  let alto = -Infinity, bajo = Infinity;
  vis.forEach((v) => { if (v.h > alto) alto = v.h; if (v.l < bajo) bajo = v.l; });
  N.niveles.forEach((n) => {
    if (n.p > alto * 1.03 || n.p < bajo * 0.97) return;   // fuera de vista, no fuerza el rango
    if (n.p > alto) alto = n.p;
    if (n.p < bajo) bajo = n.p;
  });
  /* El arrastre vertical desplaza el centro del rango, para poder
     recolocar el gráfico donde el usuario quiera. */
  const rangoBase = (alto - bajo) || 1;
  const despY = ((N.vista.offsetY || 0) / Math.max(1, y1)) * rangoBase;
  const centro = (alto + bajo) / 2 + despY;
  const semi = (rangoBase / 2) * (N.vista.zoomY || 1);
  const pad = semi * 0.1 || 1;
  const pMax = centro + semi + pad, pMin = centro - semi - pad;
  const Y = (p) => y1 - y1 * ((p - pMin) / Math.max(1e-12, pMax - pMin));



  /* Visibilidad del indicador de ESTRUCTURA (Faro): APAGADO por defecto,
     como el resto. Solo se dibuja si el usuario lo enciende. La "Gráfica
     limpia" apaga todo de golpe. */
  const _verBase = !N.limpia && N.verEstructura === true;

  /* ── Rejilla suave ── */
  g.strokeStyle = 'rgba(255,255,255,.028)';
  g.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const y = (y1 / 6) * i;
    g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke();
  }

  /* ══ LOS NIVELES ══
     Lo primero que se dibuja, para que las velas queden encima. */
  if (_verBase) N.niveles.forEach((n) => {
    if (n.p < pMin || n.p > pMax) return;
    const y = Y(n.p);
    /* [CORREGIDO] El tipo se decide por la POSICIÓN respecto al
       precio, no por cómo nació el pivote. Un soporte que quedó por
       encima del precio ya no es soporte: es resistencia. Poner
       "COMPRA" por encima del precio no tiene sentido. */
    const esS = n.p < N.precio;
    const col = esS ? '#2ee86a' : '#f6465d';
    const op = 0.22 + (n.fuerza / 100) * 0.5;

    // La banda: su grosor crece con la fuerza del nivel
    const grosor = 3 + (n.fuerza / 100) * 9;
    g.fillStyle = col + Math.round(op * 40).toString(16).padStart(2, '0');
    g.fillRect(0, y - grosor / 2, x1, grosor);

    // La línea
    g.strokeStyle = col;
    g.globalAlpha = 0.3 + (n.fuerza / 100) * 0.6;
    g.lineWidth = n.fuerza > 70 ? 2 : 1.4;
    g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke();
    g.globalAlpha = 1;

    /* La etiqueta: dice qué hacer, no qué es. Esto es lo que
       convierte la línea en una decisión. */
    /* La etiqueta va ENCIMA de la línea, no cruzada por ella. */
    /* [MEJORADO] Las etiquetas se confundían con el rojo de las
       velas. Ahora llevan sombra y borde claro: se despegan del
       fondo sin recurrir a neones. */
    const txt = (esS ? 'COMPRA ' : 'VENDE ') + fmt(n.p) + '  ·  ' + n.toques + (n.toques === 1 ? ' toque' : ' toques');
    g.font = 'bold 11.5px ui-monospace,monospace';
    const w = g.measureText(txt).width + 24;
    const yEt = y - 16;
    const alt = 23;
    /* A la cola: se pinta al final, por encima de toda línea. */
    etiquetas.push({
      txt, x: 10, y: yEt - alt / 2, w, h: alt, r: 7,
      fondo: col, tinta: esS ? '#04210f' : '#2a0509',
      borde: 'rgba(232,184,75,.9)',
      font: 'bold 11.5px ui-monospace,monospace', pad: 12
    });
  });

  /* ══ LAS VELAS ══ */
  const paso = x1 / ancho;
  const cuerpo = Math.max(1.4, paso * 0.66);
  N._geo = { W, H, x1, y1, pMax, pMin, Y, vis, ancho, paso, fin };
  vis.forEach((v, i) => {
    const x = i * paso + paso / 2;
    const sube = v.c >= v.o;
    const col = sube ? '#26a69a' : '#ef5350';
    g.strokeStyle = col; g.fillStyle = col;
    g.lineWidth = Math.max(1, paso * 0.11);
    g.beginPath(); g.moveTo(x, Y(v.h)); g.lineTo(x, Y(v.l)); g.stroke();
    const yA = Y(Math.max(v.o, v.c)), yB = Y(Math.min(v.o, v.c));
    g.fillRect(x - cuerpo / 2, yA, cuerpo, Math.max(1.2, yB - yA));
  });

  const idxVis = (i) => {
    const pri = Math.max(0, fin - ancho);
    return (i - pri) * paso + paso / 2;
  };

  /* ══ CONTROL DE ETIQUETAS ══
     [CORREGIDO] Las etiquetas se pisaban unas a otras. Ahora cada
     una se registra y, si choca, se desplaza hasta encontrar hueco.
     Si no lo hay, no se dibuja: mejor menos y legible. */
  const ocupado = [];
  const hueco = (x, y, w, h) => {
    for (let intento = 0; intento < 5; intento++) {
      const choca = ocupado.some((o) =>
        x < o.x + o.w + 6 && x + w + 6 > o.x && y < o.y + o.h + 4 && y + h + 4 > o.y);
      if (!choca) { ocupado.push({ x, y, w, h }); return { x, y }; }
      y += h + 6;
      if (y > y1 - h - 4) return null;
    }
    return null;
  };

  /* ══ LA LÍNEA DE TENDENCIA ══
     Se traza delante del usuario cuando abre: da la sensación de
     que alguien está dibujando el análisis en directo. */
  if (N.linea && N.trazo > 0 && _verBase) {
    const L = N.linea;
    const iA = L.pts[0].i, iB = Math.max(L.pts[L.pts.length - 1].i, fin - 1);
    const xA = idxVis(iA), xB = idxVis(iB);
    const yA = Y(L.m * iA + L.b), yB = Y(L.m * iB + L.b);
    // El trazo avanza de 0 a 1
    const xT = xA + (xB - xA) * N.trazo;
    const yT = yA + (yB - yA) * N.trazo;
    const col = L.tipo === 'alcista' ? '#2ee86a' : '#f6465d';

    g.strokeStyle = col;
    g.lineWidth = 2.2;
    g.globalAlpha = 0.9;
    g.setLineDash([]);
    g.beginPath(); g.moveTo(xA, yA); g.lineTo(xT, yT); g.stroke();
    g.globalAlpha = 1;

    // La punta que va dibujando
    if (N.trazo < 1) {
      g.beginPath(); g.arc(xT, yT, 4, 0, Math.PI * 2);
      g.fillStyle = col; g.fill();
    } else {
      /* Los dos extremos con su punto, para que se vea acabada */
      [[xA, yA], [xB, yB]].forEach(([xx, yy]) => {
        g.beginPath(); g.arc(xx, yy, 4.5, 0, Math.PI * 2);
        g.fillStyle = col; g.fill();
        g.strokeStyle = '#0b0f16'; g.lineWidth = 1.6; g.stroke();
      });
      // Prolongación hacia el futuro, discontinua
      /* La prolongación se corta si se sale de la vista: antes se
         iba al infinito y arrastraba la etiqueta fuera de pantalla. */
      const iF = iB + 3;
      const yFut = Y(L.m * iF + L.b);
      if (yFut > -20 && yFut < y1 + 20) {
        g.strokeStyle = col + '66';
        g.setLineDash([6, 5]); g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(xB, yB); g.lineTo(Math.min(x1, idxVis(iF)), yFut); g.stroke();
        g.setLineDash([]);
      }

      // Etiqueta
      const et = L.tipo === 'alcista' ? 'TENDENCIA ALCISTA' : 'TENDENCIA BAJISTA';
      g.font = 'bold 9px ui-monospace,monospace';
      const w = g.measureText(et).width + 14;
      const xE = Math.max(4, Math.min(x1 - w - 4, xB - w / 2));
      const yE = Math.max(20, Math.min(y1 - 24, yB + (L.tipo === 'alcista' ? 10 : -26)));
      g.fillStyle = col;
      redondeado(g, xE, yE, w, 16, 4); g.fill();
      g.fillStyle = L.tipo === 'alcista' ? '#04210f' : '#2a0509';
      g.textAlign = 'left';
      g.fillText(et, xE + 7, yE + 11);
    }
  }

  /* ══ MAREA ══
     El detector de cambio de ciclo. Ya NO dibuja ningún canal ni
     ninguna línea que siga al precio: eso era un SuperTrend disfrazado.
     Solo deja las TACHUELAS del giro (a la cola, para que queden por
     encima de todo). El estado (lado, lateral, finde) lo cuenta el
     panel de confluencia, así que aquí no se repite ninguna etiqueta. */
  if (N.marea && N.verMarea && !N.limpia) {
    const MA = N.marea;
    const primG = Math.max(0, fin - ancho);

    /* Las señales confirmadas: se guardan en la cola de tachuelas para
       pintarse al final, por encima de cualquier línea. La tachuela se
       coloca en la vela EXACTA del giro. */
    const visSig = [];
    MA.validas.forEach((sg) => {
      if (sg.i < primG) return;
      const x = idxVis(sg.i);
      if (x < 10 || x > x1 - 10) return;
      const y = Y(sg.precio);
      tachuelas.push({ x, y, alc: sg.dir === 'compra' });
      visSig.push({ x, y, alc: sg.dir === 'compra', precio: sg.precio, i: sg.i });
    });

    /* ══ LA CORRIENTE DE LA MAREA ══
       Elementos avanzados que dan a entender que detrás de las tachuelas
       hay un sistema, SIN saturar la gráfica ni tapar las velas (todo va
       con baja opacidad y solo alrededor de los giros y del precio):

       · una ESPINA fina que enlaza los últimos giros — deja ver, de un
         vistazo, el ciclo que el sistema va cabalgando;
       · un TRAMO ACTIVO desde el último giro hasta el precio de ahora;
       · el RECORRIDO CAPTURADO en vivo (% ganado desde ese giro);
       · un AURA suave sobre el giro más reciente, para guiar la mirada. */
    if (visSig.length && !MA.finde) {
      const rgbOf = (alc) => (alc ? '46,232,106' : '255,60,80');
      const nvv = N.velas;

      /* Traza la TENDENCIA REAL entre dos velas siguiendo la estructura
         del precio como un FLEJE DE METAL: recorre los cierres y los une
         con un spline suave (Catmull-Rom) que se acomoda a los picos y
         valles sin volverse un espagueti. Si la distancia es larga, el
         muestreo es más grueso y la línea sale más recta; si hay muchos
         picos cerca, se curva para seguirlos. */
      const trazaReal = (iA, iB) => {
        if (iB <= iA || !nvv[iA] || !nvv[iB]) return false;
        const paso = Math.max(1, Math.floor((iB - iA) / 60));   // muestreo
        const pts = [];
        for (let k = iA; k <= iB; k += paso) { if (nvv[k]) pts.push({ x: idxVis(k), y: Y(nvv[k].c) }); }
        const xf = idxVis(iB), yf = Y(nvv[iB].c);
        if (!pts.length || pts[pts.length - 1].x !== xf) pts.push({ x: xf, y: yf });
        if (pts.length < 2) return false;
        g.moveTo(pts[0].x, pts[0].y);
        // Catmull-Rom → Bézier: pasa por TODOS los puntos, curva suave
        for (let k = 0; k < pts.length - 1; k++) {
          const p0 = pts[k - 1] || pts[k], p1 = pts[k], p2 = pts[k + 1], p3 = pts[k + 2] || pts[k + 1];
          const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
          const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
          g.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
        }
        return true;
      };

      g.save();
      g.lineJoin = 'round'; g.lineCap = 'round';

      // Espina: enlaza los giros visibles siguiendo la estructura real del
      // precio. Bien visible y del color del tramo (verde/rojo).
      const espina = visSig.slice(-6);
      for (let k = 1; k < espina.length; k++) {
        const a = espina[k - 1], b = espina[k];
        // leve resplandor por debajo
        g.strokeStyle = `rgba(${rgbOf(a.alc)},.12)`; g.lineWidth = 4.5;
        g.beginPath(); if (trazaReal(a.i, b.i)) g.stroke();
        // línea principal con degradado entre los dos colores
        const gl = g.createLinearGradient(a.x, a.y, b.x, b.y);
        gl.addColorStop(0, `rgba(${rgbOf(a.alc)},.72)`);
        gl.addColorStop(1, `rgba(${rgbOf(b.alc)},.72)`);
        g.strokeStyle = gl; g.lineWidth = 1.8;
        g.beginPath(); if (trazaReal(a.i, b.i)) g.stroke();
        g.fillStyle = `rgba(${rgbOf(a.alc)},.85)`;
        g.beginPath(); g.arc(a.x, a.y, 2.4, 0, Math.PI * 2); g.fill();
      }

      // Tramo activo: del último giro al precio actual, siguiendo la tendencia
      const last = visSig[visSig.length - 1];
      const iNow = fin - 1;
      const xNow = Math.min(x1 - 2, idxVis(iNow));
      const yNow = Y(N.precio);
      const rgb = rgbOf(last.alc);
      g.strokeStyle = `rgba(${rgb},.14)`; g.lineWidth = 6;
      g.beginPath(); if (trazaReal(last.i, iNow)) g.stroke();
      const gl2 = g.createLinearGradient(last.x, last.y, xNow, yNow);
      gl2.addColorStop(0, `rgba(${rgb},.55)`);
      gl2.addColorStop(1, `rgba(${rgb},.95)`);
      g.strokeStyle = gl2; g.lineWidth = 2.2;
      g.beginPath(); if (trazaReal(last.i, iNow)) g.stroke();
      g.fillStyle = `rgba(${rgb},1)`; g.shadowColor = `rgba(${rgb},.9)`; g.shadowBlur = 8;
      g.beginPath(); g.arc(xNow, yNow, 3, 0, Math.PI * 2); g.fill();
      g.restore();

      // Aura del giro más reciente (ping estático, tres anillos que se apagan)
      g.save();
      for (let r = 0; r < 3; r++) {
        g.strokeStyle = `rgba(${rgb},${0.2 - r * 0.055})`;
        g.lineWidth = 1.4;
        g.beginPath(); g.arc(last.x, last.y, 8 + r * 5, 0, Math.PI * 2); g.stroke();
      }
      g.restore();

      // Recorrido capturado en vivo: % desde el giro hasta ahora. Se omite
      // si cayera sobre el panel (arriba-derecha).
      const enPanelB = (yy) => yy > 4 && yy < 12 + 250 && xNow > (x1 - Math.min(218, Math.max(150, x1 - 16)) - 14);
      if (!enPanelB(yNow)) {
        const mov = last.precio > 0 ? ((N.precio - last.precio) / last.precio) * 100 : 0;
        const favorable = last.alc ? mov >= 0 : mov <= 0;
        const signo = mov >= 0 ? '+' : '−';
        const txt = `${last.alc ? '▲' : '▼'} ${signo}${Math.abs(mov).toFixed(2)}%`;
        g.font = 'bold 9.5px ui-monospace,monospace';
        const wE = g.measureText(txt).width + 16;
        const tinta = favorable ? (last.alc ? '#2ee86a' : '#FFD400') : '#9aa4af';
        etiquetas.push({
          txt,
          x: Math.max(8, xNow - wE - 8),
          y: Math.max(2, Math.min(y1 - 20, yNow - 22)),
          w: wE, h: 18,
          fondo: 'rgba(11,15,22,.92)', tinta,
          borde: favorable ? `rgba(${rgb},.85)` : 'rgba(154,164,175,.55)',
          font: 'bold 9.5px ui-monospace,monospace', pad: 8
        });
      }
    }

    /* Las marcas de PRÓXIMA ALERTA (línea horizontal + tachuela a la
       derecha con el precio y cuánto falta) se dibujan DESPUÉS del panel,
       para que el panel nunca las tape. Ver dibujarProx() más abajo. */
  }

  /* ══ EL CANAL DEL RANGO ══
     Si el precio va lateral, se marcan las dos horizontales. */
  if (N.rango && N.trazo > 0 && _verBase) {
    const yA = Y(N.rango.alto), yB = Y(N.rango.bajo);
    const xT = x1 * N.trazo;
    g.strokeStyle = 'rgba(232,184,75,.85)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, yA); g.lineTo(xT, yA); g.stroke();
    g.beginPath(); g.moveTo(0, yB); g.lineTo(xT, yB); g.stroke();
    if (N.trazo >= 1) {
      /* La banda tapaba las velas. Solo un borde suave. */
      g.fillStyle = 'rgba(232,184,75,.02)';
      g.fillRect(0, yA, x1, yB - yA);
      ['TECHO DEL RANGO', 'SUELO DEL RANGO'].forEach((et, k) => {
        const y = k === 0 ? yA : yB;
        g.font = 'bold 9px ui-monospace,monospace';
        const w = g.measureText(et).width + 14;
        g.fillStyle = '#E8B84B';
        redondeado(g, x1 - w - 8, y + (k === 0 ? -20 : 6), w, 15, 4); g.fill();
        g.fillStyle = '#2a1c00';
        g.textAlign = 'left';
        g.fillText(et, x1 - w - 1, y + (k === 0 ? -9 : 17));
      });
    }
  }

  /* ══ DOBLE SUELO / DOBLE TECHO ══ */
  if (_verBase) (N.dobles || []).forEach((d) => {
    if (!d.confirmado) return;   // solo patrones confirmados, sin marcar todo
    const primero2 = Math.max(0, fin - ancho);
    if (d.p1.i < primero2 - 2) return;
    const suelo = d.tipo === 'dobleSuelo';
    const col = suelo ? '#2ee86a' : '#f6465d';
    const x1p = idxVis(d.p1.i), x2p = idxVis(d.p2.i);
    const yN = Y(d.nivel), yC = Y(d.cuello);

    /* [CORREGIDO] La línea se estiraba hasta el borde derecho y
       quedaba fea. Un doble techo lo forman DOS picos: la línea
       nace en el izquierdo y muere en el derecho. Nada más. */
    g.strokeStyle = col + 'cc';
    g.setLineDash([5, 4]); g.lineWidth = 1.6;
    /* [CORREGIDO] La línea quedaba desfasada porque idxVis apunta al
       CENTRO de la vela. Se extiende medio paso a cada lado para que
       toque los dos picos de verdad. */
    const xIz = Math.max(0, x1p - paso / 2);
    const xDe = Math.min(x1, x2p + paso / 2);
    g.beginPath();
    g.moveTo(xIz, yC);
    g.lineTo(xDe, yC);
    g.stroke();
    g.setLineDash([]);

    /* Y la línea que une los dos extremos, para que se vea el patrón */
    g.strokeStyle = col + '77';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(xIz, yN);
    g.lineTo(xDe, yN);
    g.stroke();

    const et = (suelo ? 'DOBLE SUELO' : 'DOBLE TECHO') + (d.confirmado ? ' ✓' : '');
    g.font = 'bold 9px ui-monospace,monospace';
    const w = g.measureText(et).width + 14;
    // Anclada al primer extremo del patrón, no al centro
    const h2 = hueco(Math.max(4, Math.min(x1 - w - 4, x1p - w / 2)),
                     yN + (suelo ? 12 : -28), w, 16);
    if (h2) {
      g.fillStyle = col;
      redondeado(g, h2.x, h2.y, w, 16, 4); g.fill();
      g.fillStyle = suelo ? '#04210f' : '#2a0509';
      g.textAlign = 'left';
      g.fillText(et, h2.x + 7, h2.y + 11);
    }
  });

  /* ══ LAS ESTRUCTURAS DIBUJADAS ══
     Aquí es donde el usuario VE de lo que se le habla: la ruptura,
     la zona institucional, el barrido. No hay que creerse nada. */
  if (_verBase) {
    let _ultOb = null;
    N._faroBtn = null;
    (N.estructuras || []).forEach((e) => {
      const primero = Math.max(0, fin - ancho);
      if ((e.tipo === 'ob' || e.tipo === 'barrido') && e.iRef >= primero - 2 && e.iRef <= fin && (!_ultOb || e.iRef > _ultOb.iRef)) _ultOb = e;
    });
    (N.estructuras || []).forEach((e) => {
    const primero = Math.max(0, fin - ancho);
    if (e.iRef < primero - 2 || e.iRef > fin) return;
    const col = e.dir === 'alcista' ? '#2ee86a' : '#f6465d';
    const xR = idxVis(e.iRef), xT = idxVis(e.iRot);

    if (e.tipo === 'bos' || e.tipo === 'choch') {
      /* La línea del nivel roto, desde donde nació hasta donde
         se rompió, y una marca en el punto de ruptura. */
      const y = Y(e.nivel);
      if (y < -20 || y > y1 + 20) return;
      g.strokeStyle = col;
      g.setLineDash(e.tipo === 'choch' ? [7, 4] : []);
      g.lineWidth = 1.8;
      g.globalAlpha = 0.85;
      g.beginPath(); g.moveTo(Math.max(0, xR), y); g.lineTo(Math.min(x1, xT + paso), y); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;

      // Flecha en el punto de ruptura
      const yRot = Y(velaEn(e.iRot) ? velaEn(e.iRot).c : e.nivel);
      g.fillStyle = col;
      g.beginPath();
      const sube = e.dir === 'alcista';
      g.moveTo(xT, y + (sube ? -9 : 9));
      g.lineTo(xT - 5, y + (sube ? 1 : -1));
      g.lineTo(xT + 5, y + (sube ? 1 : -1));
      g.closePath(); g.fill();

      // La etiqueta
      const et = e.tipo === 'bos' ? 'BOS' : 'CHoCH';
      g.font = 'bold 9px ui-monospace,monospace';
      const w = g.measureText(et).width + 12;
      g.fillStyle = col;
      redondeado(g, xT - w / 2, y + (sube ? -26 : 14), w, 15, 4); g.fill();
      g.fillStyle = sube ? '#04210f' : '#2a0509';
      g.textAlign = 'center';
      g.fillText(et, xT, y + (sube ? -15 : 25));
      g.textAlign = 'left';
    }

    if (e.tipo === 'ob' || e.tipo === 'barrido') {
      /* Banda de la zona (compacta, sin tapar velas) + una HERRAMIENTA DE
         POSICIÓN: si es demanda (compra) → LONG; si es oferta (venta) →
         SHORT. El stop abarca toda la franja; el objetivo va a R:R
         proporcional al grosor de la franja (1:1 si es ancha, 1:1.5 si es
         fina), para no ser desproporcionado. */
      const yA = Y(e.zonaA), yB = Y(e.zonaB);
      if (yB < -30 || yA > y1 + 30) return;
      const yTop = Math.min(yA, yB), alto = Math.max(3, Math.abs(yB - yA));
      const x0 = Math.max(0, xR - paso / 2);
      const largo = e.dir === 'alcista';   // demanda = compra = LONG ; oferta = venta = SHORT

      // Banda sutil de la zona
      g.fillStyle = col + '16';
      g.fillRect(x0, yTop, x1 - x0, alto);
      g.strokeStyle = col + '66'; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.strokeRect(x0, yTop, x1 - x0, alto); g.setLineDash([]);

      // Etiqueta compacta y legible (fondo oscuro + texto del color), pegada a la banda
      const et = e.tipo === 'ob' ? (largo ? 'DEMANDA' : 'OFERTA')
                                 : (largo ? 'BARRIDO ↓' : 'BARRIDO ↑');
      g.font = 'bold 8.5px ui-monospace,monospace';
      const wLab = g.measureText(et).width + 14;
      etiquetas.push({
        txt: et, x: Math.max(3, Math.min(x1 - wLab - 4, x0 + 4)), y: alto >= 20 ? yTop + 3 : yTop - 17,
        w: wLab, h: 16, r: 5, fondo: 'rgba(11,15,22,.92)', tinta: largo ? '#3ee88a' : '#ff6b7a',
        borde: col + '99', font: 'bold 8.5px ui-monospace,monospace', pad: 7
      });

      // ── Herramienta de posición: solo en la zona institucional MÁS RECIENTE ──
      if (e === _ultOb) {
        const pHi = Math.max(e.zonaA, e.zonaB), pLo = Math.min(e.zonaA, e.zonaB);
        const banda = pHi - pLo, buffer = Math.max(banda * 0.12, pHi * 0.0004);
        const bandPct = pHi > 0 ? (banda / pHi) * 100 : 0;
        const RR = bandPct > 1.0 ? 1.0 : 1.5;   // franja ancha → R:R modesto
        let pE, pS, pT;
        if (largo) { pE = pHi; pS = pLo - buffer; pT = pE + (pE - pS) * RR; }
        else { pE = pLo; pS = pHi + buffer; pT = pE - (pS - pE) * RR; }
        /* La operación ya se resolvió: el precio alcanzó el objetivo o rompió el
           stop. No se proyecta más (deja de tener sentido); la banda de la zona
           permanece como referencia. Cuando surja otra zona más reciente, la
           proyección se traslada sola a ella. */
        const resuelta = largo ? (N.precio >= pT || N.precio <= pS) : (N.precio <= pT || N.precio >= pS);
        if (!resuelta) {
        const yE = Y(pE), yS = Y(pS), yT = Y(pT);
        const acc = largo ? '#2ee86a' : '#ff3b52', accRGB = largo ? '46,232,106' : '255,59,82';
        const xs = x0;
        // ancho MODERADO: la proyección termina antes del borde para verse completa
        const xFin = Math.min(x1 - 12, Math.max(x0 + 150, idxVis(N.velas.length - 1) + paso * 8));
        // zonas ganancia / riesgo tenues
        g.fillStyle = 'rgba(46,232,106,.09)'; g.fillRect(xs, Math.min(yE, yT), xFin - xs, Math.abs(yT - yE));
        g.fillStyle = 'rgba(255,59,82,.09)'; g.fillRect(xs, Math.min(yE, yS), xFin - xs, Math.abs(yS - yE));
        // líneas objetivo / entrada / stop
        [['#2ee86a', yT], ['#eaecef', yE], ['#ff3b52', yS]].forEach((r) => {
          g.strokeStyle = r[0]; g.lineWidth = 1.4; g.beginPath(); g.moveTo(xs, r[1]); g.lineTo(xFin, r[1]); g.stroke();
        });
        // borde derecho que cierra la posición, para que se vea dónde termina
        g.strokeStyle = `rgba(${accRGB},.5)`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(xFin, Math.min(yT, yS)); g.lineTo(xFin, Math.max(yT, yS)); g.stroke();
        const gPct = Math.abs((pT - pE) / pE) * 100, rPct = Math.abs((pS - pE) / pE) * 100;
        if (!N._faroExp) {
          // ── MINIMIZADO: solo una pastillita sobre la línea de entrada ──
          g.font = '800 9.5px "Chakra Petch", system-ui, sans-serif';
          const et = (largo ? '▲ ' : '▼ ') + 'R:R ' + RR.toFixed(1);
          const pw = g.measureText(et).width + 24, ph = 20;
          const px = xFin - pw, py = Math.max(4, Math.min(y1 - ph - 4, yE - ph / 2));
          g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 10;
          g.fillStyle = 'rgba(12,16,23,.96)'; redondeado(g, px, py, pw, ph, 10); g.fill(); g.restore();
          g.strokeStyle = `rgba(${accRGB},.6)`; g.lineWidth = 1.1; redondeado(g, px, py, pw, ph, 10); g.stroke();
          g.fillStyle = acc; g.textAlign = 'left'; g.fillText(et, px + 9, py + ph / 2 + 3.3);
          // signo + de "expandir"
          g.strokeStyle = '#9aa4b0'; g.lineWidth = 1.4;
          const plusX = px + pw - 11, plusY = py + ph / 2;
          g.beginPath(); g.moveTo(plusX - 3, plusY); g.lineTo(plusX + 3, plusY); g.moveTo(plusX, plusY - 3); g.lineTo(plusX, plusY + 3); g.stroke();
          N._faroBtn = { x: px, y: py, w: pw, h: ph };
        } else {
          // ── EXPANDIDO: recuadro completo con botón "−" para minimizar ──
          const cw = 154, ch = 70;
          let cyc = Math.min(yE, yT, yS) - 8; cyc = Math.max(4, Math.min(y1 - ch - 4, cyc));
          let cxc = Math.max(4, xFin - cw);
          g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 16;
          g.fillStyle = 'rgba(12,16,23,.97)'; redondeado(g, cxc, cyc, cw, ch, 12); g.fill(); g.restore();
          g.strokeStyle = `rgba(${accRGB},.5)`; g.lineWidth = 1.1; redondeado(g, cxc, cyc, cw, ch, 12); g.stroke();
          g.fillStyle = acc; redondeado(g, cxc, cyc + 11, 3, ch - 22, 2); g.fill();
          g.textAlign = 'left';
          g.fillStyle = acc; g.font = '800 10px "Chakra Petch", system-ui, sans-serif';
          g.fillText(largo ? 'COMPRA · LONG' : 'VENTA · SHORT', cxc + 12, cyc + 18);
          const divX = cxc + cw - 44;
          g.fillStyle = '#79838f'; g.font = 'bold 7.5px "Plus Jakarta Sans", system-ui, sans-serif';
          g.fillText('OBJETIVO', cxc + 12, cyc + 36); g.fillText('STOP', cxc + 12, cyc + 52);
          g.fillStyle = '#2ee86a'; g.font = '800 12px "Chakra Petch", system-ui, sans-serif'; g.fillText(`+${gPct.toFixed(2)}%`, cxc + 60, cyc + 37);
          g.fillStyle = '#ff5b6e'; g.fillText(`−${rPct.toFixed(2)}%`, cxc + 60, cyc + 53);
          g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1; g.beginPath(); g.moveTo(divX, cyc + 26); g.lineTo(divX, cyc + ch - 9); g.stroke();
          g.textAlign = 'center';
          const rrX = divX + (cxc + cw - divX) / 2;
          g.fillStyle = '#79838f'; g.font = 'bold 7.5px "Plus Jakarta Sans", system-ui, sans-serif'; g.fillText('R:R', rrX, cyc + 34);
          g.fillStyle = '#E8B84B'; g.font = '800 17px "Chakra Petch", system-ui, sans-serif'; g.fillText(RR.toFixed(1), rrX, cyc + 52);
          g.textAlign = 'left';
          // botón "−" para minimizar, arriba a la derecha
          const mb = { x: cxc + cw - 22, y: cyc + 6, w: 16, h: 16 };
          g.strokeStyle = '#9aa4b0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(mb.x + 3, mb.y + 8); g.lineTo(mb.x + 13, mb.y + 8); g.stroke();
          N._faroBtn = { x: mb.x - 3, y: mb.y - 3, w: mb.w + 6, h: mb.h + 6 };
        }
        }
      }
    }
  });
  }

  /* ══ LA SOGUITA ══
     Solo cuando el usuario pulsa "Señálame dónde está". Sale de
     arriba (donde está su cápsula) y baja curvándose hasta el
     punto exacto, con la punta marcada. */
  if (_verBase && N.senalado != null && N.mensajes[N.senalado]) {
    const m = N.mensajes[N.senalado];
    if (m.p >= pMin && m.p <= pMax) {
      const y = Y(m.p);
      const col = m.tipo === 'compra' ? '#2ee86a' : m.tipo === 'venta' ? '#f6465d' : '#E8B84B';

      /* Dónde ocurre: si la señal viene de una estructura, en su
         vela; si no, hacia el centro. */
      let xFin = x1 * 0.55;
      if (m.marca && m.marca.iRef != null) xFin = idxVis(m.marca.iRef);
      else if (m.iAncla != null) xFin = idxVis(m.iAncla);
      xFin = Math.max(30, Math.min(x1 - 20, xFin));

      /* [CORREGIDO] La soguita salía de un punto inventado y se
         cortaba con la banda. Ahora arranca de la píldora real:
         se mide dónde está y se traza desde ahí. */
      let xIni = x1 * 0.5, yIni = 2;
      try {
        const pil = document.querySelector(`.nv-cap[data-nvm="${N.senalado}"] .nv-cap-b`);
        const zonaG = $('nv-graf');
        if (pil && zonaG) {
          const rp = pil.getBoundingClientRect();
          const rg = zonaG.getBoundingClientRect();
          xIni = Math.max(10, Math.min(x1 - 10, rp.left + rp.width / 2 - rg.left));
          yIni = Math.max(0, rp.bottom - rg.top);   // justo bajo la píldora
        }
      } catch (_) {}

      // La cuerda con pandeo
      g.strokeStyle = col;
      g.lineWidth = 1.8;
      g.globalAlpha = 0.85;
      g.setLineDash([5, 4]);
      g.beginPath();
      g.moveTo(xIni, yIni);
      g.quadraticCurveTo(xIni + (xFin - xIni) * 0.15, y - (y - yIni) * 0.22, xFin, y);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;

      // La banda del nivel y su línea
      g.fillStyle = col + '1c';
      g.fillRect(0, y - 8, x1, 16);
      g.strokeStyle = col;
      g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke();

      // La punta, en el punto exacto
      g.beginPath(); g.arc(xFin, y, 6, 0, Math.PI * 2);
      g.fillStyle = col; g.fill();
      g.strokeStyle = '#0b0f16'; g.lineWidth = 2; g.stroke();

      const et = (N.senalado + 1) + ' · ' + fmt(m.p);
      g.font = 'bold 11px ui-monospace,monospace';
      const w = g.measureText(et).width + 20;
      g.fillStyle = col;
      redondeado(g, 12, y - 11, w, 22, 6); g.fill();
      g.fillStyle = m.tipo === 'compra' ? '#04210f' : m.tipo === 'venta' ? '#2a0509' : '#2a1c00';
      g.textAlign = 'left';
      g.fillText(et, 22, y + 4);
    }
  }

  /* Tus órdenes y alertas, con el estilo común de las tres. */
  if (N.od) {
    N.zonasOd = N.od.pintar(g, {
      x1, y1, Y, pMin, pMax,
      simbolo: (PARES.find((p) => p.id === N.par) || {}).s || ''
    });
  }

  /* ── El precio actual ── */
  const yP = Y(N.precio);
  g.strokeStyle = 'rgba(232,184,75,.8)';
  g.setLineDash([5, 4]); g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(0, yP); g.lineTo(x1, yP); g.stroke();
  g.setLineDash([]);

  /* ── La escala de precios ── */
  g.fillStyle = 'rgba(11,15,22,.96)';
  g.fillRect(x1, 0, mDer, H);
  g.strokeStyle = 'rgba(255,255,255,.06)';
  g.beginPath(); g.moveTo(x1 + .5, 0); g.lineTo(x1 + .5, H); g.stroke();

  g.font = '10px ui-monospace,monospace';
  g.textAlign = 'left';
  for (let i = 0; i <= 6; i++) {
    const p = pMin + (pMax - pMin) * (i / 6);
    const y = Y(p);
    if (Math.abs(y - yP) < 14) continue;
    /* Con "Gráfica limpia" no hay etiquetas de nivel, así que tampoco
       hay que dejarles hueco: los números normales de la escala se
       pintan también donde antes iba un nivel. */
    if (_verBase && N.niveles.some((n) => Math.abs(Y(n.p) - y) < 14)) continue;
    g.fillStyle = '#4a525c';
    g.fillText(fmt(p), x1 + 7, y + 3.5);
  }
  /* Los niveles también marcan la escala (las "tachuelas" del eje).
     [CORREGIDO] Antes se pintaban SIEMPRE y quedaban encendidas con
     "Gráfica limpia": esas eran las etiquetas rojas/verdes que no se
     apagaban. Ahora respetan N.limpia como todo lo demás del análisis. */
  if (_verBase) N.niveles.forEach((n) => {
    if (n.p < pMin || n.p > pMax) return;
    const y = Y(n.p);
    const col = n.tipo === 'soporte' ? '#2ee86a' : '#f6465d';
    g.fillStyle = col;
    redondeado(g, x1 + 2, y - 9, mDer - 5, 18, 4); g.fill();
    g.fillStyle = n.tipo === 'soporte' ? '#04210f' : '#2a0509';
    g.font = 'bold 10px ui-monospace,monospace';
    g.fillText(fmt(n.p), x1 + 6, y + 3.5);
  });
  g.fillStyle = '#E8B84B';
  redondeado(g, x1 + 2, yP - 10, mDer - 5, 20, 4); g.fill();
  g.fillStyle = '#2a1c00';
  g.font = 'bold 11px ui-monospace,monospace';
  g.fillText(fmt(N.precio), x1 + 6, yP + 4);

  /* ══ LA CRUZ DEL CURSOR ══
     Como en TradingView: sigue al ratón y muestra el precio a la
     derecha y la hora abajo. */
  if (N.cruz && N.cruz.x >= 0 && N.cruz.x < x1 && N.cruz.y >= 0 && N.cruz.y < y1 && (N.herr === 'cursor' || N.herr === 'borrar')) {
    const cx = N.cruz.x, cy = N.cruz.y;
    const tipoC = N.cursorTipo || 'cruz';
    if (tipoC === 'cruz') {
      g.strokeStyle = 'rgba(255,255,255,.22)';
      g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, y1); g.stroke();
      g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke();
      g.setLineDash([]);
    } else if (tipoC === 'punto') {
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(cx, cy, 3.5, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, 7, 0, 6.283); g.stroke();
    }
    // (flecha: no dibuja retícula, deja el cursor nativo)

    // El precio a esa altura
    const pC = pMin + (pMax - pMin) * ((y1 - cy) / y1);
    g.fillStyle = '#2b3139';
    redondeado(g, x1 + 2, cy - 10, mDer - 5, 20, 4); g.fill();
    g.fillStyle = '#eaecef';
    g.font = 'bold 11px ui-monospace,monospace';
    g.textAlign = 'left';
    g.fillText(fmt(pC), x1 + 7, cy + 4);

    // La hora de esa columna
    const iV = Math.floor(cx / paso);
    const vC = vis[iV];
    if (vC) {
      const et = (N.tf === '4h' || N.tf === '1d') ? fecha(vC.t) + ' ' + hora(vC.t) : hora(vC.t);
      g.font = '10px ui-monospace,monospace';
      const w = g.measureText(et).width + 14;
      g.fillStyle = '#2b3139';
      redondeado(g, Math.max(2, Math.min(x1 - w - 2, cx - w / 2)), y1 + 3, w, 18, 4); g.fill();
      g.fillStyle = '#eaecef';
      g.textAlign = 'center';
      g.fillText(et, Math.max(w / 2 + 2, Math.min(x1 - w / 2 - 2, cx)), y1 + 16);
      g.textAlign = 'left';
    }
  }

  /* ══ LAS ETIQUETAS, AL FINAL ══
     Se pintan aquí para que ninguna línea las tape. */
  etiquetas.forEach((et) => {
    g.save();
    g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 8; g.shadowOffsetY = 2;
    g.fillStyle = et.fondo;
    redondeado(g, et.x, et.y, et.w, et.h, et.r || 6); g.fill();
    g.restore();
    if (et.borde) {
      g.strokeStyle = et.borde; g.lineWidth = 1.3;
      redondeado(g, et.x, et.y, et.w, et.h, et.r || 6); g.stroke();
    }
    g.fillStyle = et.tinta;
    g.font = et.font || 'bold 10px ui-monospace,monospace';
    g.textAlign = 'left';
    g.fillText(et.txt, et.x + (et.pad || 10), et.y + et.h / 2 + 3.6);
  });

  /* ══ LAS TACHUELAS, POR ENCIMA DE TODO ══
     Se pintan las últimas, después incluso de las etiquetas, para que
     nunca las tape una línea. El dibujo es el de siempre:
       · LONG  — verde, texto NEGRO, pico ARRIBA, DEBAJO de la vela
       · SHORT — rojo #FF0000, texto AMARILLO, pico ABAJO, ENCIMA
       · un punto pequeño en la vela exacta del giro */
  tachuelas.forEach(({ x, y, alc }) => {
    const txt = alc ? 'LONG' : 'SHORT';
    g.font = 'bold 12px ui-monospace,monospace';
    const w = g.measureText(txt).width + 22;
    const h = 24;
    const pico = 7;
    const yCaja = alc ? y + 16 : y - 16 - h;
    const xCaja = Math.max(2, Math.min(x1 - w - 2, x - w / 2));

    g.save();
    g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 10; g.shadowOffsetY = 2;
    g.fillStyle = alc ? '#2ee86a' : '#FF0000';
    redondeado(g, xCaja, yCaja, w, h, 6); g.fill();
    g.beginPath();
    if (alc) {
      g.moveTo(x, yCaja - pico);
      g.lineTo(x - pico, yCaja + 1);
      g.lineTo(x + pico, yCaja + 1);
    } else {
      g.moveTo(x, yCaja + h + pico);
      g.lineTo(x - pico, yCaja + h - 1);
      g.lineTo(x + pico, yCaja + h - 1);
    }
    g.closePath(); g.fill();
    g.restore();

    g.fillStyle = alc ? '#000000' : '#FFD400';
    g.textAlign = 'center';
    g.fillText(txt, xCaja + w / 2, yCaja + h / 2 + 4.5);
    g.textAlign = 'left';

    g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2);
    g.fillStyle = alc ? '#2ee86a' : '#FF0000'; g.fill();
    g.strokeStyle = '#0b0f16'; g.lineWidth = 1.5; g.stroke();
  });

  /* ══ EL PANEL DE PROBABILIDAD DE MAREA ══
     Esquina superior derecha, dentro de la gráfica. Dice cuántos
     requisitos de cada señal están ya cumplidos (NO es una predicción)
     y cuánto le falta al precio para dispararla. */
  if (N.marea && N.verMarea && !N.limpia && !N.cargando) {
    panelMarea(g, N.marea, x1, W);

    /* ══ PRÓXIMA ALERTA (línea horizontal + tachuela a la derecha) ══
       La dinámica que el usuario quiere: una línea horizontal en el
       precio que hay que SUPERAR para que salte LONG (verde) o PERDER
       para que salte SHORT (rojo), con una TACHUELA a la derecha que
       dice el precio y cuánto falta. Se dibuja DESPUÉS del panel para que
       nunca quede tapada; si el nivel cae a la altura del panel, la línea
       y su tachuela se detienen justo antes del panel (siguen a la
       derecha, pero sin pisarlo). */
    const MA = N.marea;
    // Las líneas de PRÓXIMA ALERTA se dibujan SIEMPRE (también en fin de
    // semana): el umbral de precio para LONG/SHORT sigue siendo válido y el
    // cliente quiere ver a qué distancia está en todo momento.
    {
      const box = N._panelBox || { x: x1, y: 12, w: 0, h: 0 };
      const prox = (dato, alc) => {
        if (!dato) return;
        const nv = dato.nivel;
        if (!isFinite(nv) || nv <= 0) return;
        const col = alc ? '#2ee86a' : '#FF0000';
        const rgb = alc ? '46,232,106' : '255,60,80';
        const cruzado = dato.falta <= 0;       // el precio ya cruzó el nivel
        const cerca = !cruzado && dato.falta < 0.4;  // a punto de gatillar
        // ¿el nivel de disparo está a la vista, o fuera (arriba/abajo)?
        const arriba = nv > pMax, abajo = nv < pMin, fuera = arriba || abajo;
        const yN = arriba ? 11 : abajo ? y1 - 11 : Y(nv);
        // si la línea llegara a la altura del panel, se detiene antes de él
        const chocaPanel = !fuera && yN >= box.y - 2 && yN <= box.y + box.h + 2;
        const xFin = chocaPanel ? Math.max(60, box.x - 6) : x1 - 4;
        const aClara = cruzado ? .5 : 1;       // los ya cruzados, más tenues

        g.save();
        g.globalAlpha = aClara;
        if (!fuera) {
          // LÍNEA horizontal de disparo, directamente sobre las velas
          g.strokeStyle = `rgba(${rgb},.10)`; g.lineWidth = 7;
          g.beginPath(); g.moveTo(2, yN); g.lineTo(xFin, yN); g.stroke();
          const gl = g.createLinearGradient(2, 0, xFin, 0);
          gl.addColorStop(0, `rgba(${rgb},.14)`);
          gl.addColorStop(0.7, `rgba(${rgb},.6)`);
          gl.addColorStop(1, `rgba(${rgb},.95)`);
          g.strokeStyle = gl; g.lineWidth = 2.2; g.setLineDash([7, 5]);
          g.beginPath(); g.moveTo(2, yN); g.lineTo(xFin, yN); g.stroke();
          g.setLineDash([]);
        } else {
          // el nivel queda fuera de la vista: banda tenue en el borde
          const y0 = arriba ? 0 : y1 - 22;
          const grd = g.createLinearGradient(0, arriba ? 0 : y1, 0, arriba ? 22 : y1 - 22);
          grd.addColorStop(0, `rgba(${rgb},.30)`);
          grd.addColorStop(1, `rgba(${rgb},0)`);
          g.fillStyle = grd; g.fillRect(0, y0, xFin, 22);
        }
        g.restore();

        // TACHUELA: precio + cuánto falta (o "cruzado" si ya pasó). Doble
        // flecha si el nivel está fuera de la vista.
        const dir = alc ? 'LONG' : 'SHORT';
        const fl = fuera ? (arriba ? '▲▲ ' : '▼▼ ') : (alc ? '▲ ' : '▼ ');
        const dist = cruzado ? 'cruzado' : (cerca ? '¡a punto!' : `falta ${dato.falta.toFixed(1)}%`);
        const txt = chocaPanel ? `${fl}${dir} · ${dist}` : `${fl}${dir} ${fmt(nv)} · ${dist}`;
        g.save();
        g.globalAlpha = aClara;
        g.font = 'bold 9px ui-monospace,monospace';
        const tw = g.measureText(txt).width + 20;
        const th = 19;
        const tX = Math.max(6, xFin - tw);
        const tY = Math.max(2, Math.min(y1 - th - 2, yN - th / 2));
        // Siempre fondo oscuro + texto de color (el look de diario, legible en
        // toda temporalidad). Si está a punto de gatillar, solo se resalta el
        // borde y un glow suave, sin bloque brillante que impida leer.
        g.shadowColor = col; g.shadowBlur = cerca ? 9 : 5;
        g.fillStyle = alc ? 'rgba(6,26,14,.97)' : 'rgba(30,6,9,.97)';
        redondeado(g, tX, tY, tw, th, 6); g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = col; g.lineWidth = cerca ? 1.9 : 1.2;
        redondeado(g, tX, tY, tw, th, 6); g.stroke();
        g.fillStyle = alc ? '#4dff8f' : '#ff8f9c';
        g.textAlign = 'left';
        g.fillText(txt, tX + 9, tY + th / 2 + 3.2);
        g.restore();
        N._proxBtns.push({ x: tX, y: tY, w: tw, h: th });
      };
      N._proxBtns = [];
      prox(MA.panel.long, true);
      prox(MA.panel.short, false);
    }
  }

  /* ── Las fechas ── */
  g.fillStyle = 'rgba(11,15,22,.96)';
  g.fillRect(0, y1, W, mAba);
  g.font = '9px ui-monospace,monospace';
  g.fillStyle = '#4a525c';
  g.textAlign = 'center';
  const cada = Math.max(1, Math.floor(vis.length / 7));
  const largo = N.tf === '4h' || N.tf === '1d';
  vis.forEach((v, i) => {
    if (i % cada) return;
    const x = i * paso + paso / 2;
    if (x > x1 - 24) return;
    g.fillText(largo ? fecha(v.t) : hora(v.t), x, y1 + 16);
  });
  g.textAlign = 'left';

  // Los dibujos del usuario (herramientas de análisis), encima de todo
  dibujarHerramientas(g, x1, y1);
}
