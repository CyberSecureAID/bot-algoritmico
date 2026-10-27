/* ══════════════════════════════════════════════════════════════
   structural/grafica.js — Lienzo de "Structural Logic" (dos paneles).

   Arriba (precio): velas ORIGINALES coloreadas por tendencia + velas
   SUAVIZADAS (la "media móvil especial" con cuerpo tipo volumen) + la
   línea de cierre suavizado + marcadores LONG/SHORT.
   Abajo (subpanel): el oscilador de momento con sus umbrales y rellenos.
   Zoom/paneo sincronizado entre los dos.
   ══════════════════════════════════════════════════════════════ */

function redondeado(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
const fmt = (p) => (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : (p || 0).toFixed(p >= 1 ? 2 : 4));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const COL = {
  bg: '#0b0f16', gold: '#E8B84B', goldRGB: '232,184,75',
  up: '#17c784', upRGB: '23,199,132', dn: '#f6465d', dnRGB: '246,70,93',
  dim: '#79838f', eje: '#4a525c'
};
const INTRA = (tf) => tf === '1m' || tf === '5m' || tf === '15m' || tf === '30m' || tf === '1h';
const fechaEje = (t, tf) => { const d = new Date(t); return INTRA(tf) ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }); };
const fechaCruz = (t, tf) => { const d = new Date(t); return INTRA(tf) ? d.toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }); };

export function crearChart(cv, cont) {
  const S = {
    velas: [], ind: null, precio: 0, tf: '1d', fuente: '', cruz: null,
    vista: { desde: -6, ancho: 130, zoomY: 1, offsetY: 0 }, _geo: null
  };

  function pill(g, cx, cy, txt, rgb, fuerte, pulso) {
    g.font = (fuerte ? '800 11px' : '800 9.5px') + ' "Chakra Petch",system-ui,sans-serif';
    const w = g.measureText(txt).width + (fuerte ? 18 : 13), h = fuerte ? 20 : 16, x = cx - w / 2, y = cy - h / 2;
    g.save();
    if (fuerte) { g.strokeStyle = `rgba(${rgb},${0.25 + 0.3 * pulso})`; g.lineWidth = 1.2; redondeado(g, x - 3 - pulso * 2, y - 3 - pulso * 2, w + 6 + pulso * 4, h + 6 + pulso * 4, (h + 6) / 2); g.stroke(); }
    g.shadowColor = `rgba(${rgb},${fuerte ? .95 : .55})`; g.shadowBlur = fuerte ? 15 : 8;
    g.fillStyle = 'rgba(8,12,18,.94)'; redondeado(g, x, y, w, h, h / 2); g.fill();
    g.shadowBlur = 0; g.strokeStyle = `rgba(${rgb},1)`; g.lineWidth = fuerte ? 1.5 : 1.1; redondeado(g, x, y, w, h, h / 2); g.stroke();
    g.fillStyle = `rgb(${rgb})`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cx, cy + 0.5); g.textBaseline = 'alphabetic';
    g.restore();
  }

  function dibujar() {
    const W = cont.clientWidth, H = cont.clientHeight;
    if (W < 40 || H < 40) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.textBaseline = 'alphabetic';
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    const total = S.velas.length, ind = S.ind; if (!total || !ind) return;

    const mDer = 62, mAba = 22, gap = 10;
    const x1 = W - mDer;
    const usable = H - mAba;
    const oscH = Math.max(66, Math.round(usable * 0.27));
    const pH = usable - oscH - gap;            // alto del panel de precio
    const oscTop = pH + gap, oscBot = usable;

    const ancho = Math.max(24, Math.min(total, S.vista.ancho));
    const huecoMax = Math.floor(ancho * 0.16);
    const desp = Math.max(-huecoMax, Math.min(S.vista.desde, Math.max(0, total - ancho)));
    S.vista.desde = desp;
    const fin = total - desp, primero = Math.max(0, fin - ancho);
    const vis = S.velas.slice(primero, Math.min(total, fin)); if (!vis.length) return;
    const paso = x1 / ancho;
    const xAt = (i) => (i - primero) * paso + paso / 2;

    // ── escala vertical del PRECIO (velas originales + suavizadas visibles) ──
    let alto = -Infinity, bajo = Infinity;
    for (let i = primero; i < Math.min(total, fin); i++) {
      const v = S.velas[i]; if (v.h > alto) alto = v.h; if (v.l < bajo) bajo = v.l;
      if (isFinite(ind.hda[i]) && ind.hda[i] > alto) alto = ind.hda[i];
      if (isFinite(ind.lda[i]) && ind.lda[i] < bajo) bajo = ind.lda[i];
    }
    if (!isFinite(alto) || !isFinite(bajo)) return;
    const r0 = (alto - bajo) || 1, despY = ((S.vista.offsetY || 0) / Math.max(1, pH)) * r0;
    const centro = (alto + bajo) / 2 + despY, semi = (r0 / 2) * (S.vista.zoomY || 1), pad = semi * 0.12 || 1;
    const pMax = centro + semi + pad, pMin = centro - semi - pad;
    const Yp = (p) => clamp(pH * (1 - (p - pMin) / Math.max(1e-9, pMax - pMin)), -9999, 9999);

    // ── escala del OSCILADOR (change visible, simétrico) ──
    let chMax = Math.abs(ind.l) * 1.6;
    for (let i = primero; i < Math.min(total, fin); i++) if (isFinite(ind.change[i])) chMax = Math.max(chMax, Math.abs(ind.change[i]));
    chMax *= 1.1;
    const Yo = (c) => oscTop + oscH * (1 - (c + chMax) / (2 * chMax));
    S._geo = { x1, pH, oscTop, oscBot, oscH, paso, pMin, pMax, chMax, Yp, Yo, primero, fin, ancho, mAba };
    const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 420);
    const cTrend = (t) => (t === 1 ? COL.up : COL.dn), cTrendRGB = (t) => (t === 1 ? COL.upRGB : COL.dnRGB);

    // rejilla panel precio
    g.strokeStyle = 'rgba(255,255,255,.03)'; g.lineWidth = 1;
    for (let i = 1; i < 5; i++) { const y = (pH / 5) * i; g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); }

    // ── VELAS SUAVIZADAS (la "MA especial", semitransparente, detrás) ──
    const cw = Math.max(1.2, paso * 0.6);
    for (let i = primero; i < Math.min(total, fin); i++) {
      if (!isFinite(ind.oda[i]) || !isFinite(ind.cda[i])) continue;
      const x = xAt(i), rgb = cTrendRGB(ind.trend[i]);
      g.strokeStyle = `rgba(${rgb},.5)`; g.fillStyle = `rgba(${rgb},.26)`; g.lineWidth = Math.max(1, paso * 0.14);
      g.beginPath(); g.moveTo(x, Yp(ind.hda[i])); g.lineTo(x, Yp(ind.lda[i])); g.stroke();
      const a = Yp(Math.max(ind.oda[i], ind.cda[i])), b = Yp(Math.min(ind.oda[i], ind.cda[i]));
      g.fillRect(x - cw / 2, a, cw, Math.max(1, b - a));
    }

    // ── VELAS ORIGINALES coloreadas por tendencia (delante) ──
    const cwo = Math.max(1, paso * 0.46);
    for (let i = primero; i < Math.min(total, fin); i++) {
      const v = S.velas[i], x = xAt(i), c = cTrend(ind.trend[i]);
      g.strokeStyle = c; g.fillStyle = c; g.lineWidth = Math.max(0.8, paso * 0.08);
      g.beginPath(); g.moveTo(x, Yp(v.h)); g.lineTo(x, Yp(v.l)); g.stroke();
      const a = Yp(Math.max(v.o, v.c)), b = Yp(Math.min(v.o, v.c));
      g.fillRect(x - cwo / 2, a, cwo, Math.max(1, b - a));
    }

    // ── línea de cierre suavizado (bold) ──
    g.save(); g.lineWidth = 2; g.lineJoin = 'round'; let prev = null;
    for (let i = primero; i < Math.min(total, fin); i++) {
      if (!isFinite(ind.cda[i])) { prev = null; continue; }
      const x = xAt(i), y = Yp(ind.cda[i]);
      if (prev) { g.strokeStyle = cTrend(ind.trend[i]); g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(x, y); g.stroke(); }
      prev = { x, y };
    }
    g.restore();

    // ── marcadores LONG/SHORT ──
    const ult = ind.ultima;
    (ind.senales || []).forEach((sg) => {
      if (sg.bar < primero || sg.bar >= fin) return;
      const v = S.velas[sg.bar]; if (!v) return;
      const x = xAt(sg.bar), esLong = sg.tipo === 'LONG', rgb = esLong ? COL.upRGB : COL.dnRGB, fuerte = ult && sg.bar === ult.bar;
      const ty = esLong ? Yp(v.l) + 11 : Yp(v.h) - 11, ts = fuerte ? 6 : 4.4;
      g.save(); g.fillStyle = `rgb(${rgb})`; g.shadowColor = `rgba(${rgb},${fuerte ? .95 : .5})`; g.shadowBlur = fuerte ? 11 : 5;
      g.beginPath();
      if (esLong) { g.moveTo(x, ty - ts); g.lineTo(x - ts, ty + ts); g.lineTo(x + ts, ty + ts); } else { g.moveTo(x, ty + ts); g.lineTo(x - ts, ty - ts); g.lineTo(x + ts, ty - ts); }
      g.closePath(); g.fill(); g.restore();
      if (fuerte) pill(g, x, esLong ? ty + 20 : ty - 20, sg.tipo, rgb, true, pulso);
    });

    // ── precio actual ──
    const yP = Yp(S.precio);
    if (yP > 0 && yP < pH) { g.strokeStyle = `rgba(${COL.goldRGB},.8)`; g.setLineDash([5, 4]); g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, yP); g.lineTo(x1, yP); g.stroke(); g.setLineDash([]); }

    // ══ SUBPANEL: oscilador de momento ══
    g.fillStyle = 'rgba(255,255,255,.015)'; g.fillRect(0, oscTop, x1, oscH);
    const y0 = Yo(0), yL = Yo(ind.l), yS = Yo(ind.s);
    // banda entre umbrales
    g.fillStyle = 'rgba(120,120,130,.08)'; g.fillRect(0, Math.min(yL, yS), x1, Math.abs(yS - yL));
    // relleno del momento a cero (verde arriba / rojo abajo)
    for (let i = primero + 1; i < Math.min(total, fin); i++) {
      if (!isFinite(ind.change[i])) continue;
      const x = xAt(i), yc = Yo(ind.change[i]), up = ind.change[i] >= 0;
      g.fillStyle = up ? `rgba(${COL.upRGB},.5)` : `rgba(${COL.dnRGB},.5)`;
      g.fillRect(x - paso / 2, Math.min(yc, y0), Math.max(1, paso), Math.abs(yc - y0));
    }
    // línea del momento
    g.save(); g.lineWidth = 1.6; g.lineJoin = 'round'; let pO = null;
    for (let i = primero; i < Math.min(total, fin); i++) { if (!isFinite(ind.change[i])) { pO = null; continue; } const x = xAt(i), y = Yo(ind.change[i]); if (pO) { g.strokeStyle = cTrend(ind.trend[i]); g.beginPath(); g.moveTo(pO.x, pO.y); g.lineTo(x, y); g.stroke(); } pO = { x, y }; }
    g.restore();
    // umbrales
    g.setLineDash([4, 4]); g.lineWidth = 1;
    g.strokeStyle = `rgba(${COL.upRGB},.5)`; g.beginPath(); g.moveTo(0, yL); g.lineTo(x1, yL); g.stroke();
    g.strokeStyle = `rgba(${COL.dnRGB},.5)`; g.beginPath(); g.moveTo(0, yS); g.lineTo(x1, yS); g.stroke();
    g.setLineDash([]); g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(0, y0); g.lineTo(x1, y0); g.stroke();
    // etiqueta del subpanel
    g.fillStyle = '#8b94a0'; g.font = '700 10px "Chakra Petch",system-ui,sans-serif'; g.textAlign = 'left';
    g.fillText('Momentum', 8, oscTop + 14);
    g.fillStyle = cTrend(ind.trendActual); g.font = '700 10px "IBM Plex Mono",ui-monospace,monospace';
    g.fillText((isFinite(ind.changeActual) ? (ind.changeActual >= 0 ? '+' : '') + ind.changeActual.toFixed(3) : '--'), 78, oscTop + 14);

    // divisoria entre paneles
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(0, oscTop - gap / 2); g.lineTo(x1, oscTop - gap / 2); g.stroke();

    // ── escala de precio (derecha, panel de arriba) ──
    g.fillStyle = 'rgba(11,15,22,.96)'; g.fillRect(x1, 0, mDer, H);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(x1 + .5, 0); g.lineTo(x1 + .5, H); g.stroke();
    g.font = '10px "IBM Plex Mono",ui-monospace,monospace'; g.textAlign = 'left';
    for (let i = 0; i <= 5; i++) { const p = pMin + (pMax - pMin) * (i / 5), y = Yp(p); if (y < 6 || y > pH - 2 || Math.abs(y - yP) < 12) continue; g.fillStyle = COL.eje; g.fillText(fmt(p), x1 + 7, y + 3.4); }
    if (yP > 0 && yP < pH) { g.fillStyle = COL.gold; redondeado(g, x1 + 2, yP - 9, mDer - 5, 18, 4); g.fill(); g.fillStyle = '#2a1c00'; g.font = 'bold 10px "IBM Plex Mono",ui-monospace,monospace'; g.fillText(fmt(S.precio), x1 + 6, yP + 3.5); }
    // escala del oscilador
    g.font = '9px "IBM Plex Mono",ui-monospace,monospace'; g.fillStyle = COL.eje; g.textAlign = 'left';
    [[ind.l, yL], [0, y0], [ind.s, yS]].forEach(([val, y]) => { if (y > oscTop + 2 && y < oscBot - 2) g.fillText((val >= 0 ? '+' : '') + val.toFixed(2), x1 + 7, y + 3); });

    // ── cruz ──
    if (S.cruz && S.cruz.x >= 0 && S.cruz.x < x1 && S.cruz.y >= 0 && S.cruz.y < usable) {
      const cx = S.cruz.x, cy = S.cruz.y, enP = cy < pH;
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, usable); g.stroke(); g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke(); g.setLineDash([]);
      const val = enP ? pMin + (pMax - pMin) * (1 - cy / pH) : (chMax - (cy - oscTop) / oscH * 2 * chMax);
      g.fillStyle = '#2b3139'; redondeado(g, x1 + 2, cy - 9, mDer - 5, 18, 4); g.fill();
      g.fillStyle = '#eaecef'; g.font = 'bold 10px "IBM Plex Mono",ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(enP ? fmt(val) : val.toFixed(3), x1 + 6, cy + 3.4);
      const iV = primero + Math.floor(cx / paso), vC = S.velas[iV];
      if (vC) { const et = fechaCruz(vC.t, S.tf); g.font = '10px "IBM Plex Mono",ui-monospace,monospace'; const w = g.measureText(et).width + 14; g.fillStyle = '#2b3139'; redondeado(g, clamp(cx - w / 2, 2, x1 - w - 2), usable + 2, w, 18, 4); g.fill(); g.fillStyle = '#eaecef'; g.textAlign = 'center'; g.fillText(et, clamp(cx, w / 2 + 2, x1 - w / 2 - 2), usable + 15); g.textAlign = 'left'; }
    }

    // ── eje de fechas ──
    g.fillStyle = 'rgba(11,15,22,.96)'; g.fillRect(0, usable, W, mAba);
    g.font = '9px "IBM Plex Mono",ui-monospace,monospace'; g.textAlign = 'center';
    const cada = Math.max(1, Math.floor(vis.length / 8));
    vis.forEach((v, i) => { if (i % cada) return; const x = i * paso + paso / 2; if (x > x1 - 20) return; g.fillStyle = COL.eje; g.fillText(fechaEje(v.t, S.tf), x, usable + 15); });
    g.textAlign = 'left';
  }

  /* ══ GESTOS ══ */
  let pend = false;
  const refrescar = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; dibujar(); }); };
  const zoomX = (f) => { S.vista.ancho = Math.max(24, Math.min(1200, Math.round(S.vista.ancho * f))); refrescar(); };
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
    let cambio = false; const paso = (cv.clientWidth - 62) / S.vista.ancho;
    const d = Math.round((e.clientX - ax) / Math.max(1, paso));
    if (d !== 0) { const tope = Math.max(0, S.velas.length - S.vista.ancho) + Math.floor(S.vista.ancho * 0.6), suelo = -Math.floor(S.vista.ancho * 0.6); S.vista.desde = Math.max(suelo, Math.min(tope, S.vista.desde + d)); ax = e.clientX; cambio = true; }
    const dy = e.clientY - ay; if (Math.abs(dy) > 1) { S.vista.offsetY = (S.vista.offsetY || 0) + dy; ay = e.clientY; cambio = true; }
    if (cambio) refrescar();
  });
  window.addEventListener('mouseup', () => { if (arr) { arr = false; cv.style.cursor = 'crosshair'; } });
  cv.addEventListener('dblclick', () => { S.vista.ancho = window.innerWidth < 760 ? 90 : 130; S.vista.desde = -6; S.vista.zoomY = 1; S.vista.offsetY = 0; refrescar(); });
  let d0 = 0, dy0 = 0, tx = 0, tarr = false;
  cv.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { tx = e.touches[0].clientX; tarr = true; } else if (e.touches.length === 2) { tarr = false; d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); dy0 = Math.abs(e.touches[0].clientY - e.touches[1].clientY); } }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && tarr) { e.preventDefault(); const paso = (cv.clientWidth - 62) / S.vista.ancho; const d = Math.round((e.touches[0].clientX - tx) / Math.max(1, paso)); if (d !== 0) { const tope = Math.max(0, S.velas.length - S.vista.ancho) + Math.floor(S.vista.ancho * 0.6), suelo = -Math.floor(S.vista.ancho * 0.6); S.vista.desde = Math.max(suelo, Math.min(tope, S.vista.desde + d)); tx = e.touches[0].clientX; refrescar(); } }
    else if (e.touches.length === 2 && d0 > 0) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const dy = Math.abs(e.touches[0].clientY - e.touches[1].clientY); if (dy > dy0 * 1.3 || dy0 > dy * 1.3) { zoomY(dy0 / Math.max(1, dy)); dy0 = dy; } else if (Math.abs(d - d0) > 8) { zoomX(d0 / d); } d0 = d; } }, { passive: false });
  cv.addEventListener('touchend', () => { tarr = false; d0 = 0; });
  const ro = new ResizeObserver(() => dibujar()); ro.observe(cont);
  cv.style.cursor = 'crosshair';
  return { S, dibujar, refrescar, destruir() { try { ro.disconnect(); } catch (_) {} } };
}
