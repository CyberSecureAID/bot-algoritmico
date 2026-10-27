/* ══════════════════════════════════════════════════════════════
   structural/grafica.js — Lienzo de "Structural Logic".

   Mismo motor de gráfica (una transformación, zoom/paneo clavados) que
   el resto del sitio. Dibuja: velas + las dos líneas de tendencia
   proyectadas (resistencia / soporte) + las señales LONG (verde) y
   SHORT (rojo) con efecto neón, la última resaltada y latiendo.
   ══════════════════════════════════════════════════════════════ */

import { valorLinea } from './motor.js?v=1';

function redondeado(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
const fmt = (p) => (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : (p || 0).toFixed(2));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COL = {
  bg: '#0b0f16', up: '#2ebd85', down: '#f6465d',
  gold: '#E8B84B', goldRGB: '232,184,75',
  res: '255,91,110', sop: '46,232,106',
  longRGB: '46,232,106', shortRGB: '255,91,110',
  dim: '#79838f', eje: '#4a525c'
};
const INTRA = (tf) => tf === '1m' || tf === '5m' || tf === '15m' || tf === '30m' || tf === '1h';
function fechaEje(t, tf) {
  const d = new Date(t);
  if (INTRA(tf)) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
}
function fechaCruz(t, tf) {
  const d = new Date(t);
  if (INTRA(tf)) return d.toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function crearChart(cv, cont) {
  const S = {
    velas: [], estructura: null, precio: 0, tf: '1d', fuente: '', cruz: null,
    vista: { desde: -8, ancho: 120, zoomY: 1, offsetY: 0 }, _geo: null
  };

  function lineaProyectada(g, ln, primero, ancho, paso, Y, rgb) {
    const bA = Math.max(ln.x1, primero), bB = primero + ancho - 1;
    if (bB <= bA) return;
    const xA = (bA - primero) * paso + paso / 2, yA = Y(valorLinea(ln, bA));
    const xB = (bB - primero) * paso + paso / 2, yB = Y(valorLinea(ln, bB));
    g.save();
    g.setLineDash([6, 5]); g.lineCap = 'round';
    g.shadowColor = `rgba(${rgb},.45)`; g.shadowBlur = 7;
    g.strokeStyle = `rgba(${rgb},.92)`; g.lineWidth = 1.7;
    g.beginPath(); g.moveTo(xA, yA); g.lineTo(xB, yB); g.stroke();
    g.restore();
    // puntos ancla de los dos pivotes
    [[ln.x1, ln.y1], [ln.x2, ln.y2]].forEach(([bx, by]) => {
      if (bx < primero || bx >= primero + ancho) return;
      const x = (bx - primero) * paso + paso / 2;
      g.save(); g.fillStyle = `rgba(${rgb},.95)`; g.shadowColor = `rgba(${rgb},.7)`; g.shadowBlur = 6;
      g.beginPath(); g.arc(x, Y(by), 2.6, 0, 6.283); g.fill(); g.restore();
    });
  }

  function pill(g, cx, cy, txt, rgb, fuerte, pulso) {
    g.font = (fuerte ? '800 11px' : '800 9.5px') + ' "Chakra Petch",system-ui,sans-serif';
    const w = g.measureText(txt).width + (fuerte ? 18 : 13), h = fuerte ? 20 : 16;
    const x = cx - w / 2, y = cy - h / 2;
    g.save();
    if (fuerte) { // halo que late
      g.strokeStyle = `rgba(${rgb},${0.25 + 0.3 * pulso})`; g.lineWidth = 1.2;
      redondeado(g, x - 3 - pulso * 2, y - 3 - pulso * 2, w + 6 + pulso * 4, h + 6 + pulso * 4, (h + 6) / 2); g.stroke();
    }
    g.shadowColor = `rgba(${rgb},${fuerte ? .95 : .55})`; g.shadowBlur = fuerte ? 15 : 8;
    g.fillStyle = 'rgba(8,12,18,.94)'; redondeado(g, x, y, w, h, h / 2); g.fill();
    g.shadowBlur = 0; g.strokeStyle = `rgba(${rgb},1)`; g.lineWidth = fuerte ? 1.5 : 1.1;
    redondeado(g, x, y, w, h, h / 2); g.stroke();
    g.fillStyle = `rgb(${rgb})`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, cx, cy + 0.5); g.textBaseline = 'alphabetic';
    g.restore();
    return { w, h };
  }

  function dibujar() {
    const W = cont.clientWidth, H = cont.clientHeight;
    if (W < 40 || H < 40) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.textBaseline = 'alphabetic';
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    const total = S.velas.length; if (!total) return;

    const mDer = 62, mAba = 24;
    const x1 = W - mDer, y1 = H - mAba;
    const ancho = Math.max(24, Math.min(total, S.vista.ancho));
    const huecoMax = Math.floor(ancho * 0.18);
    const desp = Math.max(-huecoMax, Math.min(S.vista.desde, Math.max(0, total - ancho)));
    S.vista.desde = desp;
    const fin = total - desp, primero = Math.max(0, fin - ancho);
    const vis = S.velas.slice(primero, Math.min(total, fin)); if (!vis.length) return;
    const paso = x1 / ancho;

    let alto = -Infinity, bajo = Infinity;
    for (const v of vis) { if (v.h > alto) alto = v.h; if (v.l < bajo) bajo = v.l; }
    if (!isFinite(alto) || !isFinite(bajo)) return;
    const rango0 = (alto - bajo) || 1;
    const despY = ((S.vista.offsetY || 0) / Math.max(1, y1)) * rango0;
    const centro = (alto + bajo) / 2 + despY;
    const semi = (rango0 / 2) * (S.vista.zoomY || 1), pad = semi * 0.14 || 1;
    const pMax = centro + semi + pad, pMin = centro - semi - pad;
    const Y = (p) => y1 - y1 * ((p - pMin) / Math.max(1e-9, pMax - pMin));
    S._geo = { x1, y1, paso, pMin, pMax, Y, primero, fin, ancho };
    const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 420);

    // rejilla
    g.strokeStyle = 'rgba(255,255,255,.03)'; g.lineWidth = 1;
    for (let i = 1; i < 6; i++) { const y = (y1 / 6) * i; g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); }

    // velas
    const cuerpo = Math.max(1.4, paso * 0.62);
    vis.forEach((v, i) => {
      const x = i * paso + paso / 2, col = v.c >= v.o ? COL.up : COL.down;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, paso * 0.1);
      g.beginPath(); g.moveTo(x, Y(v.h)); g.lineTo(x, Y(v.l)); g.stroke();
      const yA = Y(Math.max(v.o, v.c)), yB = Y(Math.min(v.o, v.c));
      g.fillRect(x - cuerpo / 2, yA, cuerpo, Math.max(1.2, yB - yA));
    });

    // ── ESTRUCTURA: líneas de tendencia + señales ──
    const E = S.estructura;
    if (E) {
      if (E.resistencia) lineaProyectada(g, E.resistencia, primero, ancho, paso, Y, COL.res);
      if (E.soporte) lineaProyectada(g, E.soporte, primero, ancho, paso, Y, COL.sop);

      const ultimaBar = E.ultima ? E.ultima.bar : -1;
      (E.senales || []).forEach((s) => {
        if (s.bar < primero || s.bar >= fin) return;
        const v = S.velas[s.bar]; if (!v) return;
        const x = (s.bar - primero) * paso + paso / 2;
        const esLong = s.tipo === 'LONG';
        const rgb = esLong ? COL.longRGB : COL.shortRGB;
        const fuerte = s.bar === ultimaBar;
        // conector al nivel de ruptura
        const yNivel = Y(s.nivel);
        const cyPill = esLong ? Y(v.l) + (fuerte ? 26 : 18) : Y(v.h) - (fuerte ? 26 : 18);
        g.save();
        g.strokeStyle = `rgba(${rgb},${fuerte ? .7 : .4})`; g.lineWidth = 1; g.setLineDash([2, 3]);
        g.beginPath(); g.moveTo(x, yNivel); g.lineTo(x, cyPill + (esLong ? -9 : 9)); g.stroke();
        g.setLineDash([]);
        // punto en el nivel de ruptura
        g.fillStyle = `rgb(${rgb})`; g.shadowColor = `rgba(${rgb},.9)`; g.shadowBlur = fuerte ? 10 : 5;
        g.beginPath(); g.arc(x, yNivel, fuerte ? 3.4 : 2.3, 0, 6.283); g.fill();
        g.restore();
        pill(g, x, cyPill, s.tipo, rgb, fuerte, pulso);
      });
    }

    // precio actual
    const yP = Y(S.precio);
    if (yP > 0 && yP < y1) { g.strokeStyle = `rgba(${COL.goldRGB},.8)`; g.setLineDash([5, 4]); g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, yP); g.lineTo(x1, yP); g.stroke(); g.setLineDash([]); }

    // escala
    g.fillStyle = 'rgba(11,15,22,.96)'; g.fillRect(x1, 0, mDer, H);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(x1 + .5, 0); g.lineTo(x1 + .5, H); g.stroke();
    g.font = '10px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'left';
    for (let i = 0; i <= 6; i++) { const p = pMin + (pMax - pMin) * (i / 6); const y = Y(p); if (Math.abs(y - yP) < 13) continue; g.fillStyle = COL.eje; g.fillText(fmt(p), x1 + 7, y + 3.4); }
    if (yP > 0 && yP < y1) { g.fillStyle = COL.gold; redondeado(g, x1 + 2, yP - 9, mDer - 5, 18, 4); g.fill(); g.fillStyle = '#2a1c00'; g.font = 'bold 10px "IBM Plex Mono", ui-monospace, monospace'; g.fillText(fmt(S.precio), x1 + 6, yP + 3.5); }

    // cruz
    if (S.cruz && S.cruz.x >= 0 && S.cruz.x < x1 && S.cruz.y >= 0 && S.cruz.y < y1) {
      const cx = S.cruz.x, cy = S.cruz.y;
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, y1); g.stroke(); g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke(); g.setLineDash([]);
      const pC = pMin + (pMax - pMin) * ((y1 - cy) / y1);
      g.fillStyle = '#2b3139'; redondeado(g, x1 + 2, cy - 9, mDer - 5, 18, 4); g.fill();
      g.fillStyle = '#eaecef'; g.font = 'bold 10px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'left'; g.fillText(fmt(pC), x1 + 6, cy + 3.4);
      const iV = Math.floor(cx / paso), vC = vis[iV];
      if (vC) { const et = fechaCruz(vC.t, S.tf); g.font = '10px "IBM Plex Mono", ui-monospace, monospace'; const w = g.measureText(et).width + 14; g.fillStyle = '#2b3139'; redondeado(g, clamp(cx - w / 2, 2, x1 - w - 2), y1 + 3, w, 18, 4); g.fill(); g.fillStyle = '#eaecef'; g.textAlign = 'center'; g.fillText(et, clamp(cx, w / 2 + 2, x1 - w / 2 - 2), y1 + 16); g.textAlign = 'left'; }
    }

    // eje de fechas
    g.fillStyle = 'rgba(11,15,22,.96)'; g.fillRect(0, y1, W, mAba);
    g.font = '9px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'center';
    const cada = Math.max(1, Math.floor(vis.length / 8));
    vis.forEach((v, i) => { if (i % cada) return; const x = i * paso + paso / 2; if (x > x1 - 20) return; g.fillStyle = COL.eje; g.fillText(fechaEje(v.t, S.tf), x, y1 + 16); });
    g.textAlign = 'left';
  }

  /* ══ GESTOS (idénticos al resto del sitio) ══ */
  let pend = false;
  const refrescar = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; dibujar(); }); };
  const zoomX = (f) => { S.vista.ancho = Math.max(24, Math.min(900, Math.round(S.vista.ancho * f))); refrescar(); };
  const zoomY = (f) => { S.vista.zoomY = Math.max(0.3, Math.min(5, (S.vista.zoomY || 1) * f)); refrescar(); };
  const enEscala = (x) => x > cv.clientWidth - 64;
  const loc = (e, t) => { const r = cv.getBoundingClientRect(); const s = t || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; };
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = loc(e); if (enEscala(p.x)) zoomY(e.deltaY > 0 ? 1.12 : 0.9); else zoomX(e.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });
  let arr = false, ax = 0, ay = 0, modo = 'libre';
  cv.addEventListener('mousedown', (e) => { if (e.button !== 0) return; const p = loc(e); modo = enEscala(p.x) ? 'y' : 'libre'; arr = true; ax = e.clientX; ay = e.clientY; cv.style.cursor = modo === 'y' ? 'ns-resize' : 'grabbing'; });
  cv.addEventListener('mousemove', (e) => { const p = loc(e); if (!arr) { S.cruz = { x: Math.round(p.x), y: Math.round(p.y) }; cv.style.cursor = enEscala(p.x) ? 'ns-resize' : 'crosshair'; refrescar(); } });
  cv.addEventListener('mouseleave', () => { S.cruz = null; refrescar(); });
  window.addEventListener('mousemove', (e) => {
    if (!arr) return;
    if (modo === 'y') { const dy = e.clientY - ay; if (Math.abs(dy) > 2) { zoomY(1 + dy * 0.004); ay = e.clientY; } return; }
    let cambio = false; const paso = (cv.clientWidth - 60) / S.vista.ancho;
    const d = Math.round((e.clientX - ax) / Math.max(1, paso));
    if (d !== 0) { const tope = Math.max(0, S.velas.length - S.vista.ancho) + Math.floor(S.vista.ancho * 0.6); const suelo = -Math.floor(S.vista.ancho * 0.6); S.vista.desde = Math.max(suelo, Math.min(tope, S.vista.desde + d)); ax = e.clientX; cambio = true; }
    const dy = e.clientY - ay; if (Math.abs(dy) > 1) { S.vista.offsetY = (S.vista.offsetY || 0) + dy; ay = e.clientY; cambio = true; }
    if (cambio) refrescar();
  });
  window.addEventListener('mouseup', () => { if (arr) { arr = false; cv.style.cursor = 'crosshair'; } });
  cv.addEventListener('dblclick', () => { S.vista.ancho = window.innerWidth < 760 ? 80 : 120; S.vista.desde = -8; S.vista.zoomY = 1; S.vista.offsetY = 0; refrescar(); });
  let d0 = 0, dy0 = 0, tx = 0, tarr = false;
  cv.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { tx = e.touches[0].clientX; tarr = true; } else if (e.touches.length === 2) { tarr = false; d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); dy0 = Math.abs(e.touches[0].clientY - e.touches[1].clientY); } }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && tarr) { e.preventDefault(); const paso = (cv.clientWidth - 60) / S.vista.ancho; const d = Math.round((e.touches[0].clientX - tx) / Math.max(1, paso)); if (d !== 0) { const tope = Math.max(0, S.velas.length - S.vista.ancho) + Math.floor(S.vista.ancho * 0.6); const suelo = -Math.floor(S.vista.ancho * 0.6); S.vista.desde = Math.max(suelo, Math.min(tope, S.vista.desde + d)); tx = e.touches[0].clientX; refrescar(); } }
    else if (e.touches.length === 2 && d0 > 0) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const dy = Math.abs(e.touches[0].clientY - e.touches[1].clientY); if (dy > dy0 * 1.3 || dy0 > dy * 1.3) { zoomY(dy0 / Math.max(1, dy)); dy0 = dy; } else if (Math.abs(d - d0) > 8) { zoomX(d0 / d); } d0 = d; } }, { passive: false });
  cv.addEventListener('touchend', () => { tarr = false; d0 = 0; });
  const ro = new ResizeObserver(() => dibujar()); ro.observe(cont);
  cv.style.cursor = 'crosshair';
  return { S, dibujar, refrescar, destruir() { try { ro.disconnect(); } catch (_) {} } };
}
