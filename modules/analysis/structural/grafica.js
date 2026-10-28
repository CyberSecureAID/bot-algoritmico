/* ══════════════════════════════════════════════════════════════
   structural/grafica.js — Lienzo de "Structural Logic" (REVERSIÓN A LA MEDIA).

   Arriba (precio): velas coloreadas por RÉGIMEN (sobre/bajo la base 200) +
   la LÍNEA DE LA MEDIA (objetivo de reversión) + alertas LONG/SHORT en los
   extremos + caja de posición (stop ATR / objetivo = la media).
   Abajo (subpanel): el "estiramiento" desde la media (qué tan lejos y a qué
   lado), con sus bandas de extremo. Zoom/paneo sincronizado.

   Dinámicas vivas: iluminación escalonada en las velas y en la media desde
   la última alerta (punto viajero verde/rojo), medidor de próxima señal
   arriba-derecha, y clic derecho = la MISMA dinámica de órdenes de los pools.
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
    velas: [], ind: null, precio: 0, tf: '1h', fuente: '', marca: 'DecFreedom', marcaUrl: null,
    par: '', simbolo: '', cruz: null,
    vista: { desde: -6, ancho: 130, zoomY: 1, offsetY: 0 }, _geo: null
  };
  let marcaImg = null, marcaTry = false;
  const cargarMarca = () => { if (marcaImg || marcaTry || !S.marcaUrl) return; marcaTry = true; const im = new Image(); im.onload = () => { marcaImg = im; }; im.src = S.marcaUrl; };

  /* ── órdenes por clic derecho: EXACTAMENTE la dinámica de los pools ── */
  let od = null, zonasOd = [];
  import(new URL('../../../assets/js/orden.js?v=126', import.meta.url).href).then((m) => {
    od = m; S._od = m;
    try {
      m.conectar({
        canvas: cv,
        precioEn: (y) => { const G = S._geo; if (!G) return 0; const yy = clamp(y, 0, G.pH); return G.pMin + (G.pMax - G.pMin) * (1 - yy / G.pH); },
        precioActual: () => S.precio,
        par: () => S.par || '',
        simbolo: () => S.simbolo || '',
        repintar: () => dibujar()
      });
      m.clicCancelar(cv, () => zonasOd, () => dibujar());
    } catch (_) {}
    dibujar();
  }).catch(() => {});
  const cerrarOrden = () => { try { if (od && od.cerrarFichas) od.cerrarFichas(); } catch (_) {} };

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

  function alerta(g, x, yAncla, esLong, rgb, fuerte, pulso) {
    const dir = esLong ? 1 : -1;
    const ts = fuerte ? 6.5 : 5, puntaY = yAncla + dir * 3;
    g.save();
    g.strokeStyle = `rgba(${rgb},${0.12 + 0.3 * pulso})`; g.lineWidth = 1.1;
    g.beginPath(); g.arc(x, puntaY + dir * ts, (fuerte ? 9 : 7) + pulso * (fuerte ? 3 : 1.6), 0, 6.283); g.stroke();
    g.fillStyle = `rgb(${rgb})`; g.shadowColor = `rgba(${rgb},${fuerte ? .95 : .7})`; g.shadowBlur = fuerte ? 12 : 7;
    g.beginPath();
    if (esLong) { g.moveTo(x, puntaY); g.lineTo(x - ts, puntaY + ts * 1.7); g.lineTo(x + ts, puntaY + ts * 1.7); }
    else { g.moveTo(x, puntaY); g.lineTo(x - ts, puntaY - ts * 1.7); g.lineTo(x + ts, puntaY - ts * 1.7); }
    g.closePath(); g.fill(); g.restore();
    pill(g, x, puntaY + dir * (ts * 1.7 + (fuerte ? 13 : 11)), esLong ? 'LONG' : 'SHORT', rgb, fuerte, fuerte ? pulso : 0);
  }

  function nivelDer(g, x1, y, tag, rgb, valor) {
    g.save();
    g.font = '800 8.5px "IBM Plex Mono",ui-monospace,monospace';
    const txt = tag + ' ' + valor, w = g.measureText(txt).width + 14, x = x1 - w - 4;
    g.globalAlpha = 0.96; g.fillStyle = 'rgba(8,12,18,.9)'; redondeado(g, x, y - 8, w, 16, 5); g.fill();
    g.globalAlpha = 1; g.strokeStyle = `rgba(${rgb},.85)`; g.lineWidth = 1; redondeado(g, x, y - 8, w, 16, 5); g.stroke();
    g.fillStyle = `rgb(${rgb})`; g.textAlign = 'left'; g.fillText(txt, x + 7, y + 3);
    g.restore();
  }

  /* medidor de próxima señal (reversión): qué tan "cargado" está el muelle
     en el régimen actual (cerca de sobreventa→long, o sobrecompra→short). */
  function medidor(g, x1, ind) {
    const r = ind.rsi2Hoy; if (!isFinite(r)) return;
    const bull = ind.regimenActual === 1, bear = ind.regimenActual === -1;
    const os = ind.bandaOS || 10, ob = ind.bandaOB || 90;
    let longR = bull ? clamp(Math.round((60 - r) / (60 - os) * 100), 0, 100) : (bear ? 0 : clamp(Math.round((50 - r) / 40 * 100), 0, 100));
    let shortR = bear ? clamp(Math.round((r - 40) / (ob - 40) * 100), 0, 100) : (bull ? 0 : clamp(Math.round((r - 50) / 40 * 100), 0, 100));
    const pct = isFinite(ind.estirHoy) ? ind.estirHoy : 0;        // estiramiento en ATR
    const w = 162, h = 58, x = x1 - w - 10, y = 10;
    g.save();
    g.fillStyle = 'rgba(9,12,18,.86)'; redondeado(g, x, y, w, h, 10); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1; redondeado(g, x, y, w, h, 10); g.stroke();
    g.font = '800 8px "IBM Plex Mono",ui-monospace,monospace'; g.textAlign = 'left';
    g.fillStyle = '#8b94a0'; g.fillText('NEXT SETUP', x + 10, y + 13);
    g.textAlign = 'right'; g.fillStyle = pct <= 0 ? `rgb(${COL.upRGB})` : `rgb(${COL.dnRGB})`;
    g.fillText((pct >= 0 ? '+' : '') + pct.toFixed(2) + ' from mean', x + w - 10, y + 13);
    const bx = x + 46, bw = w - 56;
    const fila = (yy, lab, pctv, rgb) => {
      g.textAlign = 'left'; g.font = '800 9px "Chakra Petch",system-ui,sans-serif'; g.fillStyle = `rgb(${rgb})`;
      g.fillText(lab, x + 10, yy + 4);
      g.fillStyle = 'rgba(255,255,255,.07)'; redondeado(g, bx, yy - 3.5, bw, 7, 3.5); g.fill();
      g.fillStyle = `rgba(${rgb},.9)`; redondeado(g, bx, yy - 3.5, Math.max(3, bw * pctv / 100), 7, 3.5); g.fill();
      g.textAlign = 'right'; g.font = '800 9px "IBM Plex Mono",ui-monospace,monospace'; g.fillStyle = '#eaecef';
      g.fillText(pctv + '%', x + w - 10, yy + 3.5);
    };
    fila(y + 30, 'LONG', longR, COL.upRGB);
    fila(y + 46, 'SHORT', shortR, COL.dnRGB);
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
    const x1 = W - mDer, usable = H - mAba;
    const oscH = Math.max(66, Math.round(usable * 0.27));
    const pH = usable - oscH - gap, oscTop = pH + gap, oscBot = usable;

    const ancho = Math.max(24, Math.min(total, S.vista.ancho));
    const huecoMax = Math.floor(ancho * 0.16);
    const desp = Math.max(-huecoMax, Math.min(S.vista.desde, Math.max(0, total - ancho)));
    S.vista.desde = desp;
    const fin = total - desp, primero = Math.max(0, fin - ancho);
    const vis = S.velas.slice(primero, Math.min(total, fin)); if (!vis.length) return;
    const paso = x1 / ancho, xAt = (i) => (i - primero) * paso + paso / 2;

    // ── escala de PRECIO (velas + media visibles) ──
    let alto = -Infinity, bajo = Infinity;
    for (let i = primero; i < Math.min(total, fin); i++) {
      const v = S.velas[i]; if (v.h > alto) alto = v.h; if (v.l < bajo) bajo = v.l;
      if (isFinite(ind.media[i])) { if (ind.media[i] > alto) alto = ind.media[i]; if (ind.media[i] < bajo) bajo = ind.media[i]; }
    }
    if (!isFinite(alto) || !isFinite(bajo)) return;
    const r0 = (alto - bajo) || 1, despY = ((S.vista.offsetY || 0) / Math.max(1, pH)) * r0;
    const centro = (alto + bajo) / 2 + despY, semi = (r0 / 2) * (S.vista.zoomY || 1), pad = semi * 0.12 || 1;
    const pMax = centro + semi + pad, pMin = centro - semi - pad;
    const Yp = (p) => clamp(pH * (1 - (p - pMin) / Math.max(1e-9, pMax - pMin)), -9999, 9999);

    // ── escala del OSCILADOR (estiramiento desde la media, simétrico) ──
    let eMax = 2;
    for (let i = primero; i < Math.min(total, fin); i++) if (isFinite(ind.estir[i])) eMax = Math.max(eMax, Math.abs(ind.estir[i]));
    eMax *= 1.1;
    const Yo = (e) => oscTop + oscH * (1 - (e + eMax) / (2 * eMax));
    S._geo = { x1, pH, oscTop, oscBot, oscH, paso, pMin, pMax, eMax, Yp, Yo, primero, fin, ancho, mAba };
    const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 420);
    const cReg = (t) => (t === 1 ? COL.up : COL.dn), cRegRGB = (t) => (t === 1 ? COL.upRGB : COL.dnRGB);

    // rejilla precio
    g.strokeStyle = 'rgba(255,255,255,.03)'; g.lineWidth = 1;
    for (let i = 1; i < 5; i++) { const y = (pH / 5) * i; g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); }

    const cwo = Math.max(1, paso * 0.46);

    // ── VELAS coloreadas por RÉGIMEN (sobre/bajo la base) ──
    for (let i = primero; i < Math.min(total, fin); i++) {
      const v = S.velas[i], x = xAt(i), c = cReg(ind.regimen[i]);
      g.strokeStyle = c; g.fillStyle = c; g.lineWidth = Math.max(0.8, paso * 0.09);
      g.beginPath(); g.moveTo(x, Yp(v.h)); g.lineTo(x, Yp(v.l)); g.stroke();
      const a = Yp(Math.max(v.o, v.c)), b = Yp(Math.min(v.o, v.c));
      g.fillRect(x - cwo / 2, a, cwo, Math.max(1, b - a));
    }

    // ── LÍNEA DE LA MEDIA (objetivo de reversión), coloreada por régimen ──
    g.save(); g.lineWidth = 2; g.lineJoin = 'round'; let prev = null;
    for (let i = primero; i < Math.min(total, fin); i++) {
      if (!isFinite(ind.media[i])) { prev = null; continue; }
      const x = xAt(i), y = Yp(ind.media[i]);
      if (prev) { g.strokeStyle = cReg(ind.regimen[i]); g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(x, y); g.stroke(); }
      prev = { x, y };
    }
    g.restore();

    // ── ILUMINACIÓN escalonada desde la última alerta (velas + media) ──
    const ult = ind.ultima;
    if (ult && ult.activa && ult.bar < total - 1) {
      const a0 = ult.bar, a1 = total - 1, span = Math.max(1, a1 - a0);
      const per = 1400 + span * 15, head = a0 + ((performance.now() % per) / per) * span;
      const rgbU = ult.tipo === 'LONG' ? COL.upRGB : COL.dnRGB;
      g.save(); g.lineCap = 'round';
      for (let i = Math.max(a0, primero); i <= Math.min(a1, fin - 1); i++) {
        const v = S.velas[i]; if (!v) continue;
        const d = head - i, br = d >= 0 ? Math.max(0, 1 - d / (span * 0.5)) : Math.max(0, 1 + d * 0.9);
        if (br <= 0.04) continue;
        const x = xAt(i);
        g.strokeStyle = `rgba(${rgbU},${0.22 + 0.68 * br})`; g.lineWidth = Math.max(1, paso * 0.1);
        g.shadowColor = `rgba(${rgbU},${0.9 * br})`; g.shadowBlur = 16 * br;
        g.beginPath(); g.moveTo(x, Yp(v.h)); g.lineTo(x, Yp(v.l)); g.stroke();
        const a = Yp(Math.max(v.o, v.c)), b = Yp(Math.min(v.o, v.c));
        g.fillStyle = `rgba(${rgbU},${0.28 + 0.6 * br})`; g.fillRect(x - cwo / 2, a, cwo, Math.max(1, b - a));
      }
      g.shadowBlur = 0;
      for (let i = Math.max(a0 + 1, primero + 1); i <= Math.min(a1, fin - 1); i++) {
        if (!isFinite(ind.media[i]) || !isFinite(ind.media[i - 1])) continue;
        const d = head - i, br = d >= 0 ? Math.max(0, 1 - d / (span * 0.5)) : Math.max(0, 1 + d * 0.9);
        if (br <= 0.04) continue;
        const x = xAt(i), y = Yp(ind.media[i]), xp = xAt(i - 1), yp = Yp(ind.media[i - 1]);
        g.strokeStyle = `rgba(255,255,255,${0.1 * br})`; g.lineWidth = 2 + 3 * br;
        g.shadowColor = `rgba(${rgbU},${0.95 * br})`; g.shadowBlur = 14 * br;
        g.beginPath(); g.moveTo(xp, yp); g.lineTo(x, y); g.stroke();
      }
      const hb = Math.round(head);
      if (hb >= primero && hb < fin) {
        const v = S.velas[hb];
        if (v) {
          const x = xAt(hb);
          const punto = (y) => { g.shadowColor = `rgba(${rgbU},1)`; g.shadowBlur = 18; g.fillStyle = `rgb(${rgbU})`; g.beginPath(); g.arc(x, y, 3.3, 0, 6.283); g.fill(); g.shadowBlur = 0; g.fillStyle = COL.bg; g.beginPath(); g.arc(x, y, 1.1, 0, 6.283); g.fill(); };
          if (isFinite(ind.media[hb])) punto(Yp(ind.media[hb]));
          punto(Yp(v.c));
        }
      }
      g.restore();
    }

    // ── CAJA DE POSICIÓN: entrada, stop (ATR) y objetivo (la media) ──
    if (ult && ult.activa && isFinite(ult.sl) && isFinite(ult.tp) && isFinite(ult.entry)) {
      const xe = clamp(xAt(ult.bar), 0, x1 - 2);
      const yE = Yp(ult.entry), ySL = Yp(ult.sl), yTP = Yp(ult.tp);
      g.save();
      g.fillStyle = `rgba(${COL.upRGB},.06)`; g.fillRect(xe, Math.min(yE, yTP), x1 - xe, Math.abs(yTP - yE));
      g.fillStyle = `rgba(${COL.dnRGB},.06)`; g.fillRect(xe, Math.min(yE, ySL), x1 - xe, Math.abs(ySL - yE));
      g.setLineDash([3, 3]); g.lineWidth = 1;
      g.strokeStyle = `rgba(${COL.upRGB},.7)`; g.beginPath(); g.moveTo(xe, yTP); g.lineTo(x1, yTP); g.stroke();
      g.strokeStyle = `rgba(${COL.dnRGB},.7)`; g.beginPath(); g.moveTo(xe, ySL); g.lineTo(x1, ySL); g.stroke();
      g.setLineDash([]); g.strokeStyle = `rgba(${COL.goldRGB},.85)`; g.lineWidth = 1.1; g.beginPath(); g.moveTo(xe, yE); g.lineTo(x1, yE); g.stroke();
      g.restore();
      nivelDer(g, x1, yTP, 'TGT', COL.upRGB, fmt(ult.tp));
      nivelDer(g, x1, yE, '◆', COL.goldRGB, fmt(ult.entry));
      nivelDer(g, x1, ySL, 'SL', COL.dnRGB, fmt(ult.sl));
    }

    // ── ALERTAS visibles como LONG/SHORT completas ──
    (ind.senales || []).forEach((sg) => {
      if (sg.bar < primero || sg.bar >= fin) return;
      const v = S.velas[sg.bar]; if (!v) return;
      const x = xAt(sg.bar), esLong = sg.tipo === 'LONG', rgb = esLong ? COL.upRGB : COL.dnRGB;
      const fuerte = ult && ult.activa && sg.bar === ult.bar;
      const yAncla = esLong ? Yp(v.l) + 7 : Yp(v.h) - 7;
      alerta(g, x, yAncla, esLong, rgb, fuerte, pulso);
    });

    medidor(g, x1, ind);

    if (od && od.pintar) { try { zonasOd = od.pintar(g, { x1, y1: pH, Y: Yp, pMin, pMax, simbolo: S.simbolo }) || []; } catch (_) { zonasOd = []; } }

    // ── precio actual ──
    const yP = Yp(S.precio);
    if (yP > 0 && yP < pH) { g.strokeStyle = `rgba(${COL.goldRGB},.8)`; g.setLineDash([5, 4]); g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, yP); g.lineTo(x1, yP); g.stroke(); g.setLineDash([]); }

    // ── marca de agua (solo en la gráfica) ──
    cargarMarca();
    if (marcaImg && marcaImg.height) { const wh = Math.min(30, pH * 0.085), ww = marcaImg.width * (wh / marcaImg.height); g.save(); g.globalAlpha = 0.4; try { g.drawImage(marcaImg, 14, pH - wh - 12, ww, wh); } catch (_) {} g.restore(); }

    // ══ SUBPANEL: estiramiento desde la media ══
    g.fillStyle = 'rgba(255,255,255,.015)'; g.fillRect(0, oscTop, x1, oscH);
    const y0 = Yo(0), band = 2, yOB = Yo(band), yOS = Yo(-band);
    g.fillStyle = 'rgba(120,120,130,.06)'; g.fillRect(0, yOB, x1, yOS - yOB);
    const bw = Math.max(1.5, paso * 0.64);
    if (!S._t0) S._t0 = performance.now();
    const crecer = clamp((performance.now() - S._t0) / 500, 0, 1);
    const faseH = (performance.now() / 1500) % 1;
    for (let i = primero; i < Math.min(total, fin); i++) {
      if (!isFinite(ind.estir[i])) continue;
      const x = xAt(i), e = ind.estir[i], rel = (i - primero) / Math.max(1, ancho);
      const dist = Math.min(Math.abs(rel - faseH), Math.abs(rel - faseH + 1), Math.abs(rel - faseH - 1));
      const brillo = Math.max(0, 1 - dist * 6);
      // debajo de la media (e<0) = zona de compra (verde); encima = venta (rojo)
      const rgb = e <= 0 ? COL.upRGB : COL.dnRGB;
      const yTip = y0 + (Yo(e) - y0) * crecer;
      const grad = g.createLinearGradient(0, y0, 0, yTip);
      grad.addColorStop(0, `rgba(${rgb},0.12)`); grad.addColorStop(1, `rgba(${rgb},${0.45 + 0.4 * brillo})`);
      g.fillStyle = grad; g.fillRect(x - bw / 2, Math.min(y0, yTip), bw, Math.max(1, Math.abs(yTip - y0)));
    }
    // bandas de extremo
    g.setLineDash([4, 4]); g.lineWidth = 1;
    g.strokeStyle = `rgba(${COL.dnRGB},.5)`; g.beginPath(); g.moveTo(0, yOB); g.lineTo(x1, yOB); g.stroke();
    g.strokeStyle = `rgba(${COL.upRGB},.5)`; g.beginPath(); g.moveTo(0, yOS); g.lineTo(x1, yOS); g.stroke();
    g.setLineDash([]); g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(0, y0); g.lineTo(x1, y0); g.stroke();
    g.fillStyle = '#8b94a0'; g.font = '700 10px "Chakra Petch",system-ui,sans-serif'; g.textAlign = 'left';
    g.fillText('Stretch from mean', 8, oscTop + 14);
    g.fillStyle = (ind.estirHoy <= 0 ? COL.up : COL.dn); g.font = '700 10px "IBM Plex Mono",ui-monospace,monospace';
    g.fillText((isFinite(ind.estirHoy) ? (ind.estirHoy >= 0 ? '+' : '') + ind.estirHoy.toFixed(2) : '--'), 118, oscTop + 14);

    g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(0, oscTop - gap / 2); g.lineTo(x1, oscTop - gap / 2); g.stroke();

    // ── escala de precio ──
    g.fillStyle = 'rgba(11,15,22,.96)'; g.fillRect(x1, 0, mDer, H);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(x1 + .5, 0); g.lineTo(x1 + .5, H); g.stroke();
    g.font = '10px "IBM Plex Mono",ui-monospace,monospace'; g.textAlign = 'left';
    for (let i = 0; i <= 5; i++) { const p = pMin + (pMax - pMin) * (i / 5), y = Yp(p); if (y < 6 || y > pH - 2 || Math.abs(y - yP) < 12) continue; g.fillStyle = COL.eje; g.fillText(fmt(p), x1 + 7, y + 3.4); }
    if (yP > 0 && yP < pH) { g.fillStyle = COL.gold; redondeado(g, x1 + 2, yP - 9, mDer - 5, 18, 4); g.fill(); g.fillStyle = '#2a1c00'; g.font = 'bold 10px "IBM Plex Mono",ui-monospace,monospace'; g.fillText(fmt(S.precio), x1 + 6, yP + 3.5); }
    g.font = '9px "IBM Plex Mono",ui-monospace,monospace'; g.fillStyle = COL.eje; g.textAlign = 'left';
    [[band, yOB], [0, y0], [-band, yOS]].forEach(([val, y]) => { if (y > oscTop + 2 && y < oscBot - 2) g.fillText((val >= 0 ? '+' : '') + val.toFixed(0), x1 + 7, y + 3); });

    // ── cruz ──
    if (S.cruz && S.cruz.x >= 0 && S.cruz.x < x1 && S.cruz.y >= 0 && S.cruz.y < usable) {
      const cx = S.cruz.x, cy = S.cruz.y, enP = cy < pH;
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, usable); g.stroke(); g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke(); g.setLineDash([]);
      const val = enP ? pMin + (pMax - pMin) * (1 - cy / pH) : (eMax - (cy - oscTop) / oscH * 2 * eMax);
      g.fillStyle = '#2b3139'; redondeado(g, x1 + 2, cy - 9, mDer - 5, 18, 4); g.fill();
      g.fillStyle = '#eaecef'; g.font = 'bold 10px "IBM Plex Mono",ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(enP ? fmt(val) : val.toFixed(2), x1 + 6, cy + 3.4);
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
  const zoomX = (f) => { S.vista.ancho = Math.max(24, Math.min(2000, Math.round(S.vista.ancho * f))); refrescar(); };
  const zoomY = (f) => { S.vista.zoomY = Math.max(0.3, Math.min(5, (S.vista.zoomY || 1) * f)); refrescar(); };
  const enEscala = (x) => x > cv.clientWidth - 64;
  const loc = (e, t) => { const r = cv.getBoundingClientRect(); const s = t || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; };
  const topePan = () => Math.max(0, S.velas.length - 1);
  const sueloPan = () => -Math.floor(S.vista.ancho * 0.6);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = loc(e); if (enEscala(p.x)) zoomY(e.deltaY > 0 ? 1.12 : 0.9); else zoomX(e.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });
  let arr = false, ax = 0, ay = 0, modo = 'libre';
  cv.addEventListener('mousedown', (e) => { if (e.button !== 0) return; const p = loc(e); modo = enEscala(p.x) ? 'y' : 'libre'; arr = true; ax = e.clientX; ay = e.clientY; cv.style.cursor = modo === 'y' ? 'ns-resize' : 'grabbing'; });
  cv.addEventListener('mousemove', (e) => { const p = loc(e); if (!arr) { S.cruz = { x: Math.round(p.x), y: Math.round(p.y) }; if (cv.style.cursor !== 'pointer') cv.style.cursor = enEscala(p.x) ? 'ns-resize' : 'crosshair'; refrescar(); } });
  cv.addEventListener('mouseleave', () => { S.cruz = null; refrescar(); });
  window.addEventListener('mousemove', (e) => {
    if (!arr) return;
    if (modo === 'y') { const dy = e.clientY - ay; if (Math.abs(dy) > 2) { zoomY(1 + dy * 0.004); ay = e.clientY; } return; }
    let cambio = false; const paso = (cv.clientWidth - 62) / S.vista.ancho;
    const d = Math.round((e.clientX - ax) / Math.max(1, paso));
    if (d !== 0) { S.vista.desde = Math.max(sueloPan(), Math.min(topePan(), S.vista.desde + d)); ax = e.clientX; cambio = true; }
    const dy = e.clientY - ay; if (Math.abs(dy) > 1) { S.vista.offsetY = (S.vista.offsetY || 0) + dy; ay = e.clientY; cambio = true; }
    if (cambio) refrescar();
  });
  window.addEventListener('mouseup', () => { if (arr) { arr = false; cv.style.cursor = 'crosshair'; } });
  cv.addEventListener('dblclick', () => { S.vista.ancho = window.innerWidth < 760 ? 90 : 130; S.vista.desde = -6; S.vista.zoomY = 1; S.vista.offsetY = 0; refrescar(); });
  let d0 = 0, dy0 = 0, tx = 0, tarr = false;
  cv.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { tx = e.touches[0].clientX; tarr = true; } else if (e.touches.length === 2) { tarr = false; d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); dy0 = Math.abs(e.touches[0].clientY - e.touches[1].clientY); } }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && tarr) { e.preventDefault(); const paso = (cv.clientWidth - 62) / S.vista.ancho; const d = Math.round((e.touches[0].clientX - tx) / Math.max(1, paso)); if (d !== 0) { S.vista.desde = Math.max(sueloPan(), Math.min(topePan(), S.vista.desde + d)); tx = e.touches[0].clientX; refrescar(); } }
    else if (e.touches.length === 2 && d0 > 0) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const dy = Math.abs(e.touches[0].clientY - e.touches[1].clientY); if (dy > dy0 * 1.3 || dy0 > dy * 1.3) { zoomY(dy0 / Math.max(1, dy)); dy0 = dy; } else if (Math.abs(d - d0) > 8) { zoomX(d0 / d); } d0 = d; } }, { passive: false });
  cv.addEventListener('touchend', () => { tarr = false; d0 = 0; });
  const ro = new ResizeObserver(() => dibujar()); ro.observe(cont);
  cv.style.cursor = 'crosshair';
  return { S, dibujar, refrescar, cerrarOrden, destruir() { try { ro.disconnect(); } catch (_) {} try { cerrarOrden(); } catch (_) {} } };
}
