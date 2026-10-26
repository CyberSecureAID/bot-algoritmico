/* ══════════════════════════════════════════════════════════════
   sp500/grafica.js — Motor de gráfica propio (un solo lienzo).

   NADA de velo montado encima. Igual que Smart Pools: hay un único
   canvas y una función dibujar() que, en cada gesto, recalcula la
   MISMA transformación (paso para el tiempo, Y para el precio) y
   repinta las velas y la caja JUNTAS. Por eso, al estirar, encoger,
   mover o hacer zoom, la caja, los tercios y la señal se mueven
   clavados con el precio.

   La mecánica de transformación y de gestos (rueda, arrastre,
   pellizco, doble clic) está copiada de niveles (Smart Pools), sin
   sus herramientas de dibujo, que aquí no hacen falta.
   ══════════════════════════════════════════════════════════════ */

import { etHora, etFecha, etMin, VENTANA_ET, APERTURA } from './motor.js?v=1';

function redondeado(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
const fmt = (p) => (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : p.toFixed(2));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const COL = {
  bg: '#0b0f16', up: '#26a69a', down: '#ef5350',
  gold: '#E8B84B', goldRGB: '232,184,75',
  buy: '#2ee86a', buyRGB: '46,232,106',
  sell: '#ff3b52', sellRGB: '255,59,82',
  tinta: '#eaecef', dim: '#79838f', eje: '#4a525c'
};

export function crearChart(cv, cont) {
  const S = {
    velas: [], dias: [], precio: 0, finMin: 600, win: '30',
    tf: '5m', fuente: '', cruz: null, vivo: false,
    vista: { desde: 0, ancho: 130, zoomY: 1, offsetY: 0 },
    _geo: null
  };

  function dibujar() {
    const W = cont.clientWidth, H = cont.clientHeight;
    if (W < 40 || H < 40) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.textBaseline = 'alphabetic';
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);

    const total = S.velas.length;
    if (!total) return;

    const mDer = 60, mAba = 24;
    const x1 = W - mDer, y1 = H - mAba;

    const ancho = Math.max(24, Math.min(total, S.vista.ancho));
    const huecoMax = Math.floor(ancho * 0.18);
    const desp = Math.max(-huecoMax, Math.min(S.vista.desde, Math.max(0, total - ancho)));
    S.vista.desde = desp;
    const fin = total - desp;
    const primero = Math.max(0, fin - ancho);
    const vis = S.velas.slice(primero, Math.min(total, fin));
    if (!vis.length) return;

    const paso = x1 / ancho;
    const idxVis = (i) => (i - primero) * paso + paso / 2;

    /* Días visibles (su rango de índices toca la ventana). */
    const diasVis = S.dias.filter((d) => d.iFin >= primero - 1 && d.i0 <= fin + 1);
    const foco = S.dias.length ? S.dias[S.dias.length - 1] : null;

    /* Rango vertical: velas visibles + cajas visibles + señal del día foco. */
    let alto = -Infinity, bajo = Infinity;
    for (const v of vis) { if (v.h > alto) alto = v.h; if (v.l < bajo) bajo = v.l; }
    for (const d of diasVis) { if (d.caja.hi > alto) alto = d.caja.hi; if (d.caja.lo < bajo) bajo = d.caja.lo; }
    if (foco && foco.senal && diasVis.includes(foco)) {
      const s = foco.senal;
      [s.stop, s.objetivo].forEach((p) => { if (p > alto) alto = p; if (p < bajo) bajo = p; });
    }
    if (!isFinite(alto) || !isFinite(bajo)) return;
    const rangoBase = (alto - bajo) || 1;
    const despY = ((S.vista.offsetY || 0) / Math.max(1, y1)) * rangoBase;
    const centro = (alto + bajo) / 2 + despY;
    const semi = (rangoBase / 2) * (S.vista.zoomY || 1);
    const pad = semi * 0.12 || 1;
    const pMax = centro + semi + pad, pMin = centro - semi - pad;
    const Y = (p) => y1 - y1 * ((p - pMin) / Math.max(1e-9, pMax - pMin));
    S._geo = { x1, y1, paso, pMin, pMax, Y, primero, fin, ancho };

    const ahora = performance.now();
    const pulso = 0.5 + 0.5 * Math.sin(ahora / 420);        // 0..1 para latidos
    const dash = (ahora / 55) % 14;                          // borde animado

    /* ── Rejilla ── */
    g.strokeStyle = 'rgba(255,255,255,.03)'; g.lineWidth = 1;
    for (let i = 1; i < 6; i++) { const y = (y1 / 6) * i; g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); }

    /* ══ CAJAS: relleno y tintes (DETRÁS de las velas) ══ */
    const cajaGeo = (d) => {
      const xL = Math.max(-4, idxVis(d.i0) - paso / 2);
      const xR = Math.min(x1 + 4, idxVis(d.iBox) + paso / 2);
      return { xL, xR, yHi: Y(d.caja.hi), yLo: Y(d.caja.lo), w: xR - (idxVis(d.i0) - paso / 2) };
    };
    for (const d of diasVis) {
      if (d.caja.R <= 0) continue;
      const esFoco = d === foco;
      const { xL, xR, yHi, yLo } = cajaGeo(d);
      if (xR < 0 || xL > x1) continue;
      const w = xR - xL, hh = yLo - yHi;
      if (w < 1 || hh < 1) continue;
      g.save();
      // Relleno dorado suave, más intenso en el día foco
      const gr = g.createLinearGradient(0, yHi, 0, yLo);
      const a = esFoco ? 0.16 : 0.07;
      gr.addColorStop(0, `rgba(${COL.goldRGB},${a})`);
      gr.addColorStop(0.5, `rgba(${COL.goldRGB},${a * 0.45})`);
      gr.addColorStop(1, `rgba(${COL.goldRGB},${a})`);
      g.fillStyle = gr; g.fillRect(xL, yHi, w, hh);
      // Tinte tenue de las franjas (telegrafía la lógica): alta verde, baja roja
      const t1 = yHi + hh / 3, t2 = yHi + (2 * hh) / 3;
      g.fillStyle = `rgba(${COL.buyRGB},${esFoco ? 0.06 : 0.03})`; g.fillRect(xL, yHi, w, hh / 3);
      g.fillStyle = `rgba(${COL.sellRGB},${esFoco ? 0.06 : 0.03})`; g.fillRect(xL, t2, w, hh / 3);
      g.restore();
    }

    /* ══ VELAS ══ */
    const cuerpo = Math.max(1.4, paso * 0.64);
    vis.forEach((v, i) => {
      const x = i * paso + paso / 2;
      const sube = v.c >= v.o;
      const col = sube ? COL.up : COL.down;
      g.strokeStyle = col; g.fillStyle = col;
      g.lineWidth = Math.max(1, paso * 0.1);
      g.beginPath(); g.moveTo(x, Y(v.h)); g.lineTo(x, Y(v.l)); g.stroke();
      const yA = Y(Math.max(v.o, v.c)), yB = Y(Math.min(v.o, v.c));
      g.fillRect(x - cuerpo / 2, yA, cuerpo, Math.max(1.2, yB - yA));
    });

    /* ══ CAJAS: bordes, tercios, etiqueta y marca de resultado (ENCIMA) ══ */
    for (const d of diasVis) {
      if (d.caja.R <= 0) continue;
      const esFoco = d === foco;
      const { xL, xR, yHi, yLo } = cajaGeo(d);
      if (xR < 0 || xL > x1) continue;
      const w = xR - xL, hh = yLo - yHi;
      const rgb = COL.goldRGB;

      // Bordes superior (techo) e inferior (piso), con glow en el día foco
      g.save();
      if (esFoco) { g.shadowColor = `rgba(${rgb},.55)`; g.shadowBlur = 10; }
      g.strokeStyle = `rgba(${rgb},${esFoco ? 0.95 : 0.5})`;
      g.lineWidth = esFoco ? 2 : 1.3;
      if (esFoco) { g.setLineDash([7, 5]); g.lineDashOffset = -dash; }
      g.beginPath(); g.moveTo(xL, yHi); g.lineTo(xR, yHi); g.stroke();
      g.beginPath(); g.moveTo(xL, yLo); g.lineTo(xR, yLo); g.stroke();
      g.setLineDash([]);
      g.restore();

      // Laterales suaves
      g.strokeStyle = `rgba(${rgb},${esFoco ? 0.4 : 0.18})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(xL, yHi); g.lineTo(xL, yLo); g.stroke();
      g.beginPath(); g.moveTo(xR, yHi); g.lineTo(xR, yLo); g.stroke();

      // Los dos tercios, finos y punteados
      if (hh > 16) {
        g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1; g.setLineDash([3, 4]);
        [yHi + hh / 3, yHi + (2 * hh) / 3].forEach((y) => { g.beginPath(); g.moveTo(xL, y); g.lineTo(xR, y); g.stroke(); });
        g.setLineDash([]);
      }

      // Etiqueta flotante de la caja (arriba a la izquierda), solo si cabe
      if (w > 54) {
        const et = esFoco ? 'OPENING RANGE' : etFecha(d.t0);
        const sub = esFoco ? ('9:30 ' + String.fromCharCode(8594) + ' ' + VENTANA_ET[S.win] + ' ET') : '';
        g.font = '800 9.5px "Chakra Petch", system-ui, sans-serif';
        const wEt = Math.max(g.measureText(et).width, sub ? g.measureText(sub).width : 0) + 16;
        const hEt = sub ? 30 : 18;
        let xe = xL + 2, ye = Math.max(2, yHi - hEt - 5);
        xe = Math.min(xe, x1 - wEt - 2);
        g.save();
        g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8;
        g.fillStyle = 'rgba(12,16,23,.94)'; redondeado(g, xe, ye, wEt, hEt, 6); g.fill();
        g.restore();
        g.fillStyle = `rgba(${rgb},${esFoco ? 0.9 : 0.5})`; redondeado(g, xe, ye + 4, 3, hEt - 8, 2); g.fill();
        g.fillStyle = esFoco ? COL.gold : COL.dim;
        g.textAlign = 'left'; g.fillText(et, xe + 10, ye + (sub ? 13 : 13));
        if (sub) { g.fillStyle = COL.dim; g.font = 'bold 8px "IBM Plex Mono", ui-monospace, monospace'; g.fillText(sub, xe + 10, ye + 25); }
      }

      // Marca de resultado del backtest en días pasados (✓ / ✗ / ·)
      if (!esFoco && d.senal && w > 10) {
        const mk = d.resultado === 'ganada' ? '✓' : d.resultado === 'perdida' ? '✗' : '·';
        const mc = d.resultado === 'ganada' ? COL.buy : d.resultado === 'perdida' ? COL.sell : COL.dim;
        g.fillStyle = mc; g.font = 'bold 12px system-ui, sans-serif'; g.textAlign = 'center';
        g.fillText(mk, (xL + xR) / 2, yHi - 4);
        g.textAlign = 'left';
      }
    }

    /* ══ LA SEÑAL DEL DÍA FOCO (proyección a la derecha) ══ */
    if (foco && diasVis.includes(foco)) {
      const d = foco;
      const xRead = Math.min(x1, idxVis(d.iRead) + paso / 2);
      // Línea vertical de lectura + bandera con la hora
      g.save();
      g.strokeStyle = `rgba(${COL.goldRGB},.5)`; g.lineWidth = 1; g.setLineDash([2, 4]);
      g.beginPath(); g.moveTo(xRead, 2); g.lineTo(xRead, y1); g.stroke(); g.setLineDash([]);
      g.restore();

      if (d.senal) {
        const s = d.senal;
        const compra = s.lado === 'compra';
        const acc = compra ? COL.buy : COL.sell, accRGB = compra ? COL.buyRGB : COL.sellRGB;
        const xEnd = x1 - 2;
        const yE = Y(s.entrada), yS = Y(s.stop), yT = Y(s.objetivo);
        // Zonas de ganancia (entrada→objetivo) y riesgo (entrada→stop)
        g.fillStyle = `rgba(${COL.buyRGB},.08)`; g.fillRect(xRead, Math.min(yE, yT), xEnd - xRead, Math.abs(yT - yE));
        g.fillStyle = `rgba(${COL.sellRGB},.08)`; g.fillRect(xRead, Math.min(yE, yS), xEnd - xRead, Math.abs(yS - yE));
        // Líneas objetivo / entrada / stop
        const linea = (y, c, w, dsh) => { g.strokeStyle = c; g.lineWidth = w; if (dsh) g.setLineDash(dsh); g.beginPath(); g.moveTo(xRead, y); g.lineTo(xEnd, y); g.stroke(); g.setLineDash([]); };
        linea(yT, COL.buy, 1.5); linea(yE, '#eaecef', 1.3, [5, 4]); linea(yS, COL.sell, 1.5);
        // Etiquetas de precio a la derecha
        const tag = (y, c, tinta, txt) => {
          g.font = 'bold 9px "IBM Plex Mono", ui-monospace, monospace';
          const w = g.measureText(txt).width + 12;
          const xx = xEnd - w;
          g.fillStyle = c; redondeado(g, xx, y - 8, w, 16, 4); g.fill();
          g.fillStyle = tinta; g.textAlign = 'left'; g.fillText(txt, xx + 6, y + 3.4);
        };
        tag(yT, COL.buy, '#04210f', 'TARGET ' + fmt(s.objetivo));
        tag(yE, '#2b3139', '#eaecef', 'ENTRY ' + fmt(s.entrada));
        tag(yS, COL.sell, '#2a0509', 'STOP ' + fmt(s.stop));

        // Píldora de veredicto cerca de la entrada
        const verd = compra ? 'BUY' : 'SELL';
        g.font = '800 11px "Chakra Petch", system-ui, sans-serif';
        const pw = g.measureText(verd + '  R:R 1:2').width + 30, ph = 22;
        const px = clamp(xRead + 8, 4, xEnd - pw), py = clamp(yE - (compra ? ph + 8 : -8), 4, y1 - ph - 2);
        g.save(); g.shadowColor = `rgba(${accRGB},.5)`; g.shadowBlur = 10;
        g.fillStyle = 'rgba(12,16,23,.96)'; redondeado(g, px, py, pw, ph, 11); g.fill(); g.restore();
        g.strokeStyle = acc; g.lineWidth = 1.2; redondeado(g, px, py, pw, ph, 11); g.stroke();
        g.fillStyle = acc; g.beginPath(); g.arc(px + 13, py + ph / 2, 3.2 + pulso * 0.8, 0, 6.283); g.fill();
        g.textAlign = 'left'; g.fillStyle = acc; g.fillText(verd, px + 22, py + ph / 2 + 3.6);
        g.fillStyle = COL.dim; g.font = 'bold 9px "IBM Plex Mono", ui-monospace, monospace';
        g.fillText('R:R 1:2', px + 22 + g.measureText(verd).width + 8, py + ph / 2 + 3.4);
      } else if (!d.completa) {
        // Caja aún formándose (sesión en curso antes de la hora de lectura)
        g.font = '800 10px "Chakra Petch", system-ui, sans-serif';
        const txt = 'FORMING  ' + String.fromCharCode(8594) + '  read ' + VENTANA_ET[S.win] + ' ET';
        const w = g.measureText(txt).width + 22;
        const xx = clamp(xRead + 8, 4, x1 - w - 2), yy = 8;
        g.fillStyle = 'rgba(12,16,23,.94)'; redondeado(g, xx, yy, w, 20, 8); g.fill();
        g.strokeStyle = `rgba(${COL.goldRGB},.6)`; g.lineWidth = 1.1; redondeado(g, xx, yy, w, 20, 8); g.stroke();
        g.fillStyle = COL.gold; g.textAlign = 'left'; g.fillText(txt, xx + 11, yy + 13);
      } else {
        // Franja media: lateralización, sin señal
        g.font = '800 10px "Chakra Petch", system-ui, sans-serif';
        const txt = 'RANGE  ' + String.fromCharCode(183) + '  no trade';
        const w = g.measureText(txt).width + 22;
        const xx = clamp(xRead + 8, 4, x1 - w - 2), yy = 8;
        g.fillStyle = 'rgba(12,16,23,.94)'; redondeado(g, xx, yy, w, 20, 8); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1.1; redondeado(g, xx, yy, w, 20, 8); g.stroke();
        g.fillStyle = COL.dim; g.textAlign = 'left'; g.fillText(txt, xx + 11, yy + 13);
      }
    }

    /* ── Precio actual ── */
    const yP = Y(S.precio);
    if (yP > 0 && yP < y1) {
      g.strokeStyle = `rgba(${COL.goldRGB},.8)`; g.setLineDash([5, 4]); g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(0, yP); g.lineTo(x1, yP); g.stroke(); g.setLineDash([]);
    }

    /* ── Escala de precios ── */
    g.fillStyle = 'rgba(11,15,22,.96)'; g.fillRect(x1, 0, mDer, H);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(x1 + .5, 0); g.lineTo(x1 + .5, H); g.stroke();
    g.font = '10px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'left';
    for (let i = 0; i <= 6; i++) {
      const p = pMin + (pMax - pMin) * (i / 6); const y = Y(p);
      if (Math.abs(y - yP) < 13) continue;
      g.fillStyle = COL.eje; g.fillText(fmt(p), x1 + 7, y + 3.4);
    }
    if (yP > 0 && yP < y1) {
      g.fillStyle = COL.gold; redondeado(g, x1 + 2, yP - 9, mDer - 5, 18, 4); g.fill();
      g.fillStyle = '#2a1c00'; g.font = 'bold 10px "IBM Plex Mono", ui-monospace, monospace'; g.fillText(fmt(S.precio), x1 + 6, yP + 3.5);
    }

    /* ── Cruz del cursor ── */
    if (S.cruz && S.cruz.x >= 0 && S.cruz.x < x1 && S.cruz.y >= 0 && S.cruz.y < y1) {
      const cx = S.cruz.x, cy = S.cruz.y;
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, y1); g.stroke();
      g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke(); g.setLineDash([]);
      const pC = pMin + (pMax - pMin) * ((y1 - cy) / y1);
      g.fillStyle = '#2b3139'; redondeado(g, x1 + 2, cy - 9, mDer - 5, 18, 4); g.fill();
      g.fillStyle = '#eaecef'; g.font = 'bold 10px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'left'; g.fillText(fmt(pC), x1 + 6, cy + 3.4);
      const iV = Math.floor(cx / paso); const vC = vis[iV];
      if (vC) {
        const et = etHora(vC.t);
        g.font = '10px "IBM Plex Mono", ui-monospace, monospace'; const w = g.measureText(et).width + 14;
        g.fillStyle = '#2b3139'; redondeado(g, clamp(cx - w / 2, 2, x1 - w - 2), y1 + 3, w, 18, 4); g.fill();
        g.fillStyle = '#eaecef'; g.textAlign = 'center'; g.fillText(et, clamp(cx, w / 2 + 2, x1 - w / 2 - 2), y1 + 16); g.textAlign = 'left';
      }
    }

    /* ── Eje de fechas y horas (ET), con separadores de día ── */
    g.fillStyle = 'rgba(11,15,22,.96)'; g.fillRect(0, y1, W, mAba);
    g.font = '9px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'center';
    let diaPrev = null;
    const cada = Math.max(1, Math.floor(vis.length / 9));
    vis.forEach((v, i) => {
      const x = i * paso + paso / 2; if (x > x1 - 20) return;
      const esApertura = etMin(v.t) === APERTURA;
      const dayId = Math.floor(v.t / 86400000);
      const nuevoDia = diaPrev !== null && dayId !== diaPrev;
      if (esApertura || nuevoDia) {
        // separador de sesión
        g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x - paso / 2, 0); g.lineTo(x - paso / 2, y1); g.stroke();
        g.fillStyle = COL.dim; g.fillText(etFecha(v.t), x, y1 + 16);
      } else if (i % cada === 0) {
        g.fillStyle = COL.eje; g.fillText(etHora(v.t), x, y1 + 16);
      }
      diaPrev = dayId;
    });
    g.textAlign = 'left';
  }

  /* ══ GESTOS (rueda, arrastre, pellizco, doble clic) ══ */
  let pend = false;
  const refrescar = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; dibujar(); }); };
  const zoomX = (f) => { S.vista.ancho = Math.max(24, Math.min(600, Math.round(S.vista.ancho * f))); refrescar(); };
  const zoomY = (f) => { S.vista.zoomY = Math.max(0.3, Math.min(5, (S.vista.zoomY || 1) * f)); refrescar(); };
  const enEscala = (x) => x > cv.clientWidth - 64;
  const loc = (e, t) => { const r = cv.getBoundingClientRect(); const s = t || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; };

  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = loc(e);
    if (enEscala(p.x)) zoomY(e.deltaY > 0 ? 1.12 : 0.9);
    else zoomX(e.deltaY > 0 ? 1.15 : 0.87);
  }, { passive: false });

  let arr = false, ax = 0, ay = 0, modo = 'libre';
  cv.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const p = loc(e);
    modo = enEscala(p.x) ? 'y' : 'libre';
    arr = true; ax = e.clientX; ay = e.clientY;
    cv.style.cursor = modo === 'y' ? 'ns-resize' : 'grabbing';
  });
  cv.addEventListener('mousemove', (e) => {
    const p = loc(e);
    if (!arr) { S.cruz = { x: Math.round(p.x), y: Math.round(p.y) }; cv.style.cursor = enEscala(p.x) ? 'ns-resize' : 'crosshair'; refrescar(); }
  });
  cv.addEventListener('mouseleave', () => { S.cruz = null; refrescar(); });
  window.addEventListener('mousemove', (e) => {
    if (!arr) return;
    if (modo === 'y') { const dy = e.clientY - ay; if (Math.abs(dy) > 2) { zoomY(1 + dy * 0.004); ay = e.clientY; } return; }
    let cambio = false;
    const paso = (cv.clientWidth - 60) / S.vista.ancho;
    const d = Math.round((e.clientX - ax) / Math.max(1, paso));
    if (d !== 0) { const tope = Math.max(0, S.velas.length - S.vista.ancho) + Math.floor(S.vista.ancho * 0.6); const suelo = -Math.floor(S.vista.ancho * 0.6); S.vista.desde = Math.max(suelo, Math.min(tope, S.vista.desde + d)); ax = e.clientX; cambio = true; }
    const dy = e.clientY - ay; if (Math.abs(dy) > 1) { S.vista.offsetY = (S.vista.offsetY || 0) + dy; ay = e.clientY; cambio = true; }
    if (cambio) refrescar();
  });
  window.addEventListener('mouseup', () => { if (arr) { arr = false; cv.style.cursor = 'crosshair'; } });
  cv.addEventListener('dblclick', () => { S.vista.ancho = window.innerWidth < 760 ? 90 : 130; S.vista.desde = 0; S.vista.zoomY = 1; S.vista.offsetY = 0; refrescar(); });

  let d0 = 0, dy0 = 0, tx = 0, tarr = false;
  cv.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) { tx = e.touches[0].clientX; tarr = true; }
    else if (e.touches.length === 2) { tarr = false; d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); dy0 = Math.abs(e.touches[0].clientY - e.touches[1].clientY); }
  }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && tarr) {
      e.preventDefault();
      const paso = (cv.clientWidth - 60) / S.vista.ancho;
      const d = Math.round((e.touches[0].clientX - tx) / Math.max(1, paso));
      if (d !== 0) { const tope = Math.max(0, S.velas.length - S.vista.ancho) + Math.floor(S.vista.ancho * 0.6); const suelo = -Math.floor(S.vista.ancho * 0.6); S.vista.desde = Math.max(suelo, Math.min(tope, S.vista.desde + d)); tx = e.touches[0].clientX; refrescar(); }
    } else if (e.touches.length === 2 && d0 > 0) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const dy = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
      if (dy > dy0 * 1.3 || dy0 > dy * 1.3) { zoomY(dy0 / Math.max(1, dy)); dy0 = dy; }
      else if (Math.abs(d - d0) > 8) { zoomX(d0 / d); }
      d0 = d;
    }
  }, { passive: false });
  cv.addEventListener('touchend', () => { tarr = false; d0 = 0; });

  const ro = new ResizeObserver(() => dibujar());
  ro.observe(cont);
  cv.style.cursor = 'crosshair';

  return { S, dibujar, refrescar, destruir() { try { ro.disconnect(); } catch (_) {} } };
}
