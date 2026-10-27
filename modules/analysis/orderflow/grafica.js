/* ══════════════════════════════════════════════════════════════
   orderflow/grafica.js — Grafica de footprint INTERACTIVA.

   Como en TradingView: rueda para acercar/alejar, arrastrar para
   desplazar, y al llegar al borde izquierdo pide mas historia.
   Cada vela lleva a su derecha su perfil de volumen (silueta roja
   venta / azul compra, numeros sobre la barra, POC y area de valor).
   La vela EN CURSO va resaltada y se forma en vivo con el tape.
   El DOM y el analizador viven en el panel lateral (no aqui).
   ══════════════════════════════════════════════════════════════ */

import { filasDe, analizar } from './motor.js?v=2';

const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const GOLD = '232,184,75';
const UP = String.fromCharCode(9650), DN = String.fromCharCode(9660);
const kfmt = (n) => { const a = Math.abs(n); return a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1000 ? (a / 1000).toFixed(a >= 1e4 ? 0 : 1) + 'K' : '' + Math.round(a); };
const sfmt = (n) => (n >= 0 ? UP : DN) + kfmt(n);
const hhmm = (t, tf) => { const d = new Date(t); const dia = (tf === '1d' || tf === '1w'); return dia ? (d.getDate() + '/' + (d.getMonth() + 1)) : (('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)); };

export function crearChart(cv, cont) {
  const g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, muerto = false, ultimo = 0, pxEase = 0, drag = null, pulso = 0;
  let lay = { fpX: 0, fpW: 1, cw: 1 };

  const S = {
    velas: [], tick: 1, sym: 'BTCUSDT', nombre: 'Bitcoin', tf: '1h', tfLabel: '1H', precio: 0, chg: 0,
    view: { n: 42, off: 0 }, onHistoria: null, cargandoHist: false
  };

  function resize() { const r = cont.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = Math.max(320, r.width); H = Math.max(240, r.height); cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  const ro = new ResizeObserver(() => resize()); ro.observe(cont); resize();

  // ---------- viewport ----------
  const Ln = () => S.velas.length;
  function clampView() { const l = Ln(); S.view.n = Math.max(8, Math.min(160, Math.round(S.view.n))); if (S.view.n > l) S.view.n = Math.max(1, l); S.view.off = Math.max(0, Math.min(Math.round(S.view.off), Math.max(0, l - S.view.n))); }
  function visibles() { const l = Ln(), n = S.view.n, off = S.view.off; return S.velas.slice(Math.max(0, l - off - n), l - off); }
  function resetView() { S.view.off = 0; S.view.n = 42; clampView(); }

  function pedirHistoria() { if (S.cargandoHist || !S.onHistoria) return; if (S.view.off + S.view.n >= Ln() - 2) { S.cargandoHist = true; const o = S.velas[0]; Promise.resolve(S.onHistoria(o ? o.t : Date.now())).finally(() => { S.cargandoHist = false; }); } }

  // ---------- interaccion ----------
  cv.style.cursor = 'grab';
  cv.addEventListener('wheel', (e) => {
    e.preventDefault(); const l = Ln(); if (!l) return;
    const f = Math.max(0, Math.min(1, (e.offsetX - lay.fpX) / lay.fpW));   // 0 izq .. 1 der
    const offDer = S.view.off + S.view.n * (1 - f);                        // candela bajo el cursor, desde la derecha
    S.view.n = e.deltaY < 0 ? S.view.n * 0.84 : S.view.n * 1.19;
    S.view.n = Math.max(8, Math.min(160, S.view.n));
    S.view.off = offDer - S.view.n * (1 - f);
    clampView(); pedirHistoria();
  }, { passive: false });
  cv.addEventListener('mousedown', (e) => { drag = { x: e.clientX, off0: S.view.off }; cv.style.cursor = 'grabbing'; });
  window.addEventListener('mousemove', onMove); function onMove(e) { if (!drag) return; const d = Math.round((e.clientX - drag.x) / lay.cw); S.view.off = drag.off0 + d; clampView(); pedirHistoria(); }
  window.addEventListener('mouseup', onUp); function onUp() { if (drag) { drag = null; cv.style.cursor = 'grab'; } }
  cv.addEventListener('dblclick', resetView);
  // tactil
  let tx = 0, tn = 0;
  cv.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { drag = { x: e.touches[0].clientX, off0: S.view.off }; } else if (e.touches.length === 2) { tx = Math.abs(e.touches[0].clientX - e.touches[1].clientX); tn = S.view.n; } }, { passive: true });
  cv.addEventListener('touchmove', (e) => { if (e.touches.length === 1 && drag) { const d = Math.round((e.touches[0].clientX - drag.x) / lay.cw); S.view.off = drag.off0 + d; clampView(); pedirHistoria(); } else if (e.touches.length === 2 && tx) { const nx = Math.abs(e.touches[0].clientX - e.touches[1].clientX); S.view.n = Math.max(8, Math.min(160, tn * (tx / Math.max(1, nx)))); clampView(); pedirHistoria(); } }, { passive: true });
  cv.addEventListener('touchend', () => { drag = null; });

  // ---------- preparar footprint (cachea; la viva se recalcula) ----------
  function preparar(vs) { vs.forEach((v) => { if (!v.cerrada || !v._filas) { v._filas = filasDe(v, S.tick); v._an = analizar(v._filas, S.tick); } }); }

  function dibujar() {
    if (muerto || !W) return;
    clampView();
    const vs = visibles();
    limpiar();
    if (!vs.length) { aviso('Loading…'); return; }
    preparar(vs);
    pulso = 0.5 + 0.5 * Math.sin(performance.now() / 500);
    pxEase = pxEase ? pxEase + (S.precio - pxEase) * 0.25 : S.precio;

    let pMin = 1e18, pMax = -1e18;
    vs.forEach((v) => { if (v.l < pMin) pMin = v.l; if (v.h > pMax) pMax = v.h; });
    if (S.precio > pMax) pMax = S.precio; if (S.precio < pMin) pMin = S.precio;
    const pad = (pMax - pMin) * 0.06 + S.tick;
    pMin = Math.floor((pMin - pad) / S.tick) * S.tick; pMax = Math.ceil((pMax + pad) / S.tick) * S.tick;
    let MAXDELTA = 1; vs.forEach((v) => { MAXDELTA = Math.max(MAXDELTA, Math.abs(v.delta)); });

    const axisW = 52, padL = 10, deltaH = Math.min(92, Math.max(66, H * 0.13)), padT = 8;
    const fpX = padL, fpW = W - axisW - padL - 6, fpY = padT, fpH = H - padT - deltaH - 8;
    const axisX = fpX + fpW;
    const Y = (p) => fpY + fpH - fpH * ((p - pMin) / (pMax - pMin));
    const rowH = fpH / ((pMax - pMin) / S.tick);
    const NC = vs.length, cw = fpW / NC;
    lay = { fpX, fpW, cw };
    const esViva = (i) => S.view.off === 0 && i === NC - 1;   // la vela en curso es la ultima, sin desplazar

    rejilla(Y, fpX, axisX, fpY, fpH, pMin, pMax);
    const yP = Y(pxEase);
    footprint(vs, Y, rowH, fpX, fpW, fpY, fpH, cw, MAXDELTA, esViva);
    g.strokeStyle = `rgba(${GOLD},.55)`; g.setLineDash([5, 4]); g.lineWidth = 1; g.beginPath(); g.moveTo(fpX, yP); g.lineTo(axisX, yP); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#E8B84B'; g.fillRect(axisX, yP - 8, axisW, 16); g.fillStyle = '#17110a'; g.font = '700 9px ' + MONO; g.textAlign = 'left'; g.fillText(S.precio.toFixed(S.tick < 1 ? 2 : 1), axisX + 4, yP + 3);
    tabla(vs, fpX, fpW, fpY, fpH, deltaH, cw, esViva);
    if (S.cargandoHist) { g.fillStyle = 'rgba(125,135,148,.7)'; g.font = '700 9px ' + MONO; g.textAlign = 'left'; g.fillText('loading history…', fpX + 6, fpY + 14); }
  }

  function limpiar() { g.clearRect(0, 0, W, H); g.fillStyle = '#070a0f'; g.fillRect(0, 0, W, H); const vg = g.createRadialGradient(W * 0.4, H * 0.4, 80, W * 0.5, H * 0.5, Math.max(W, H) * 0.8); vg.addColorStop(0, 'rgba(16,22,32,.35)'); vg.addColorStop(1, 'rgba(2,4,8,.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
  function aviso(t) { g.fillStyle = 'rgba(169,178,189,.7)'; g.font = '13px ' + MONO; g.textAlign = 'center'; g.fillText(t, W / 2, H / 2); }

  function rejilla(Y, fpX, axisX, fpY, fpH, pMin, pMax) {
    const paso = pasoPrecio(pMax - pMin);
    g.strokeStyle = 'rgba(255,255,255,.028)'; g.lineWidth = 1; g.fillStyle = 'rgba(125,135,148,.5)'; g.font = '8px ' + MONO; g.textAlign = 'left';
    for (let p = Math.ceil(pMin / paso) * paso; p <= pMax; p += paso) { const y = Y(p); g.beginPath(); g.moveTo(fpX, y); g.lineTo(axisX, y); g.stroke(); g.fillText(p.toFixed(S.tick < 1 ? 2 : 1), axisX + 5, y + 3); }
  }

  function footprint(vs, Y, rowH, fpX, fpW, fpY, fpH, cw, MAXDELTA, esViva) {
    const bodyW = Math.max(3, Math.min(12, cw * 0.14)), baseGap = 2, trailGap = Math.max(3, cw * 0.1);
    const profW = cw - bodyW - baseGap - trailGap, IMB = 3;
    const verNum = cw > 34;                      // solo mostrar numeros si hay ancho (al acercar)
    vs.forEach((v, i) => {
      const slotX = fpX + i * cw, bodyX = slotX + 1, bodyCx = bodyX + bodyW / 2, baseX = slotX + bodyW + baseGap;
      const up = v.c >= v.o, brgb = up ? '46,189,133' : '246,70,93';
      const viva = esViva(i), an = v._an, filas = v._filas, maxV = an.maxV || 1;
      if (viva) { g.fillStyle = `rgba(${GOLD},${(0.05 + 0.03 * pulso).toFixed(3)})`; g.fillRect(slotX - 1, fpY, cw + 2, fpH); }
      // vela
      g.strokeStyle = `rgba(${brgb},.75)`; g.lineWidth = 1.1; g.beginPath(); g.moveTo(bodyCx, Y(v.h)); g.lineTo(bodyCx, Y(v.l)); g.stroke();
      const by0 = Y(Math.max(v.o, v.c)), by1 = Y(Math.min(v.o, v.c)); g.fillStyle = up ? '#2ebd85' : '#f6465d'; g.fillRect(bodyX, by0, bodyW, Math.max(2, by1 - by0));
      // perfil
      filas.forEach((r) => {
        const cy = Y(r.p), top = cy - rowH / 2 + 0.4, h = Math.max(1, rowH - 0.8), inten = r.tot / maxV;
        const len = Math.max(2, Math.round(inten * profW));
        const col = r.ask >= r.bid
          ? `rgb(${Math.round(52 + 60 * inten)},${Math.round(84 + 70 * inten)},${Math.round(138 + 96 * inten)})`
          : `rgb(${Math.round(150 + 85 * inten)},${Math.round(48 + 42 * inten)},${Math.round(62 + 58 * inten)})`;
        g.fillStyle = col; g.fillRect(baseX, top, len, h);
        if (r._buy) { g.strokeStyle = 'rgba(70,240,170,.9)'; g.lineWidth = 1; g.strokeRect(baseX + 0.5, top + 0.5, len - 1, h - 1); }
        else if (r._sell) { g.strokeStyle = 'rgba(255,120,140,.9)'; g.lineWidth = 1; g.strokeRect(baseX + 0.5, top + 0.5, len - 1, h - 1); }
        if (verNum && rowH >= 6) { g.font = '6px ' + MONO; const t = kfmt(r.tot), tw = g.measureText(t).width; if (len >= tw + 5) { g.fillStyle = 'rgba(244,248,253,.92)'; g.textAlign = 'right'; g.fillText(t, baseX + len - 3, cy + 2.1); } }
      });
      // POC dorado
      { const pr = (() => { let b = filas[0]; filas.forEach((r) => { if (r.p === an.poc) b = r; }); return b; })(); const pl = Math.max(2, Math.round((pr ? pr.tot / maxV : 1) * profW)), cy = Y(an.poc), h = Math.max(1, rowH - 0.8); g.strokeStyle = `rgba(${GOLD},.9)`; g.lineWidth = 1.1; g.strokeRect(baseX + 0.5, cy - rowH / 2 + 0.4, pl, h); }
      // area de valor (corchete)
      g.strokeStyle = `rgba(${GOLD},.38)`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(baseX - 1.5, Y(an.vaHi) - rowH / 2); g.lineTo(baseX - 1.5, Y(an.vaLo) + rowH / 2); g.stroke();
      // borde vivo
      if (viva) { g.strokeStyle = `rgba(${GOLD},${(0.5 + 0.4 * pulso).toFixed(2)})`; g.lineWidth = 1.2; g.strokeRect(slotX - 0.5, fpY + 0.5, cw, fpH - 1); g.fillStyle = `rgba(${GOLD},.9)`; g.font = '700 7px ' + MONO; g.textAlign = 'center'; g.fillText('LIVE', slotX + cw / 2, fpY + 9); }
    });
  }

  function tabla(vs, fpX, fpW, fpY, fpH, deltaH, cw, esViva) {
    const dY = fpY + fpH + 8, rH = (deltaH - 14) / 3;
    const cel = (x, ry, w, txt, rgb, a, tc) => { g.fillStyle = `rgba(${rgb},${a})`; g.fillRect(x, ry, w - 1, rH - 2); g.fillStyle = tc; g.font = (cw > 30 ? '8.5px ' : '7px ') + MONO; g.textAlign = 'center'; g.fillText(txt, x + w / 2, ry + rH / 2 + 1.6); };
    vs.forEach((v, i) => { const x = fpX + i * cw + 1, w = cw - 2, upd = v.delta >= 0, pct = v.vol ? Math.round(v.delta / v.vol * 100) : 0;
      cel(x, dY, w, kfmt(v.vol), '92,124,168', .22, 'rgba(206,218,234,.9)');
      cel(x, dY + rH, w, sfmt(v.delta), upd ? '46,189,133' : '246,70,93', .22, upd ? 'rgba(150,240,195,.95)' : 'rgba(255,145,160,.95)');
      cel(x, dY + 2 * rH, w, (upd ? UP : DN) + Math.abs(pct) + '%', upd ? '46,189,133' : '246,70,93', .12, upd ? 'rgba(150,240,195,.85)' : 'rgba(255,145,160,.85)');
      g.fillStyle = esViva(i) ? 'rgba(232,184,75,.85)' : '#4a5561'; g.font = '7px ' + MONO; g.textAlign = 'center'; g.fillText(hhmm(v.t, S.tf), x + w / 2, dY + 3 * rH + 8);
    });
  }

  let ultimoLoop = 0;
  function arrancar() { if (raf) return; const paso = () => { if (muerto) return; const n = performance.now(); if (n - ultimoLoop >= 33 && !document.hidden) { ultimoLoop = n; dibujar(); } raf = requestAnimationFrame(paso); }; raf = requestAnimationFrame(paso); }
  function destruir() { muerto = true; cancelAnimationFrame(raf); try { ro.disconnect(); } catch (_) {} window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }

  return { S, dibujar, arrancar, destruir, resize, resetView };
}

function pasoPrecio(rango) { const b = rango / 7; const mag = Math.pow(10, Math.floor(Math.log10(b))); const n = b / mag; const p = n >= 5 ? 5 : n >= 2 ? 2 : 1; return p * mag; }
