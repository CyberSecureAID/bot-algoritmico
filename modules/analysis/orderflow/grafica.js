/* ══════════════════════════════════════════════════════════════
   orderflow/grafica.js — Render del terminal en un unico lienzo.

   Dibuja: footprint (vela + perfil de volumen a su derecha, rojo venta /
   azul compra, numeros sobre la barra, POC, area de valor, imbalances y
   zonas apiladas), eje de precio, DOM espejo (ASK rojo a la derecha,
   BID verde a la izquierda) con su propia escala, y la tabla inferior
   (Volumen / Delta / Delta % / Session) con eje de tiempo.

   No conoce Binance: solo pinta el estado S que le pasa el main.
   ══════════════════════════════════════════════════════════════ */

import { filasDe, analizar } from './motor.js?v=1';

const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const SANS = "'Plus Jakarta Sans',system-ui,sans-serif";
const GOLD = '232,184,75';
const UP = String.fromCharCode(9650), DN = String.fromCharCode(9660);
const kfmt = (n) => { const a = Math.abs(n); return a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1000 ? (a / 1000).toFixed(a >= 1e4 ? 0 : 1) + 'K' : '' + Math.round(a); };
const sfmt = (n) => (n >= 0 ? UP : DN) + kfmt(n);          // signo por flecha, nunca con menos
const hhmm = (t) => { const d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };

export function crearChart(cv, cont) {
  const g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, raf = 0, muerto = false;
  let pxEase = 0;                                  // precio suavizado

  const S = {
    velas: [], dom: { bids: [], asks: [] }, met: { obi: 50, vpin: 0, spoof: 0, net: 0 },
    precio: 0, tick: 1, sym: 'BTCUSDT', nombre: 'Bitcoin', tf: '1H', chg: 0
  };

  function resize() {
    const r = cont.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(320, r.width); H = Math.max(240, r.height);
    cv.width = W * dpr; cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const ro = new ResizeObserver(() => resize()); ro.observe(cont);
  resize();

  /* Prepara filas + analitica de cada vela (cachea; la viva se recalcula). */
  function preparar() {
    S.velas.forEach((v) => {
      if (!v.cerrada || !v._filas) { v._filas = filasDe(v, S.tick); v._an = analizar(v._filas, S.tick); }
    });
  }

  function dibujar() {
    if (muerto || !W) return;
    preparar();
    const velas = S.velas; if (!velas.length) { limpiar(); return; }
    pxEase = pxEase ? pxEase + (S.precio - pxEase) * 0.25 : S.precio;

    // rango de precio del footprint
    let pMin = 1e18, pMax = -1e18;
    velas.forEach((v) => { if (v.l < pMin) pMin = v.l; if (v.h > pMax) pMax = v.h; });
    const pad = (pMax - pMin) * 0.04 + S.tick;
    pMin = Math.floor((pMin - pad) / S.tick) * S.tick; pMax = Math.ceil((pMax + pad) / S.tick) * S.tick;
    let MAXDELTA = 1; velas.forEach((v) => { MAXDELTA = Math.max(MAXDELTA, Math.abs(v.delta)); });

    limpiar();
    const domW = Math.round(W * 0.265), axisW = 46, padL = 10, deltaH = Math.min(104, Math.max(74, H * 0.14)), padT = 8;
    const fpX = padL, fpW = W - domW - axisW - padL - 6, fpY = padT, fpH = H - padT - deltaH - 10;
    const domX = W - domW, axisX = fpX + fpW;
    const Y = (p) => fpY + fpH - fpH * ((p - pMin) / (pMax - pMin));
    const rowH = fpH / ((pMax - pMin) / S.tick);
    const yP = Y(pxEase);

    rejilla(Y, fpX, axisX, fpY, fpH, pMin, pMax);
    footprint(velas, Y, rowH, fpX, fpW, fpY, fpH, domX, MAXDELTA);
    // precio actual (linea punteada sobre el footprint)
    g.strokeStyle = `rgba(${GOLD},.55)`; g.setLineDash([5, 4]); g.lineWidth = 1; g.beginPath(); g.moveTo(fpX, yP); g.lineTo(axisX, yP); g.stroke(); g.setLineDash([]);
    dom(domX, domW, fpY, fpH, rowH);
    tabla(velas, fpX, fpW, fpY, fpH, deltaH, domX);
  }

  function limpiar() {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#070a0f'; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W * 0.4, H * 0.4, 80, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(16,22,32,.35)'); vg.addColorStop(1, 'rgba(2,4,8,.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  function rejilla(Y, fpX, axisX, fpY, fpH, pMin, pMax) {
    const paso = pasoPrecio(pMax - pMin);
    g.strokeStyle = 'rgba(255,255,255,.028)'; g.lineWidth = 1;
    g.fillStyle = 'rgba(125,135,148,.5)'; g.font = '8px ' + MONO; g.textAlign = 'left';
    for (let p = Math.ceil(pMin / paso) * paso; p <= pMax; p += paso) {
      const y = Y(p); g.beginPath(); g.moveTo(fpX, y); g.lineTo(axisX, y); g.stroke();
      g.fillText(p.toFixed(S.tick < 1 ? 2 : 1), axisX + 5, y + 3);
    }
  }

  function footprint(velas, Y, rowH, fpX, fpW, fpY, fpH, domX, MAXDELTA) {
    const NC = velas.length, cw = fpW / NC;
    const bodyW = Math.max(4, Math.min(10, cw * 0.14)), baseGap = 2, trailGap = Math.max(4, cw * 0.1);
    const profW = cw - bodyW - baseGap - trailGap;
    velas.forEach((v, i) => {
      const slotX = fpX + i * cw, bodyX = slotX + 1, bodyCx = bodyX + bodyW / 2, baseX = slotX + bodyW + baseGap;
      const up = v.c >= v.o, brgb = up ? '46,189,133' : '246,70,93';
      const an = v._an, filas = v._filas, maxV = an.maxV || 1;
      // vela
      g.strokeStyle = `rgba(${brgb},.72)`; g.lineWidth = 1.1; g.beginPath(); g.moveTo(bodyCx, Y(v.h)); g.lineTo(bodyCx, Y(v.l)); g.stroke();
      const by0 = Y(Math.max(v.o, v.c)), by1 = Y(Math.min(v.o, v.c));
      g.fillStyle = up ? '#2ebd85' : '#f6465d'; g.fillRect(bodyX, by0, bodyW, Math.max(2, by1 - by0));
      const byP = {}; filas.forEach((r) => { byP[r.p] = r; });
      filas.forEach((r) => {
        const cy = Y(r.p), top = cy - rowH / 2 + 0.4, h = Math.max(1, rowH - 0.8);
        const inten = r.tot / maxV;
        const len = Math.max(3, Math.round(inten * profW));          // el largo lo manda el VOLUMEN (silueta), no el numero
        const col = r.ask >= r.bid
          ? `rgb(${Math.round(52 + 60 * inten)},${Math.round(84 + 70 * inten)},${Math.round(138 + 96 * inten)})`
          : `rgb(${Math.round(150 + 85 * inten)},${Math.round(48 + 42 * inten)},${Math.round(62 + 58 * inten)})`;
        g.fillStyle = col; g.fillRect(baseX, top, len, h);
        if (r._buy) { g.strokeStyle = 'rgba(70,240,170,.95)'; g.lineWidth = 1.1; g.strokeRect(baseX + 0.5, top + 0.5, len - 1, h - 1); }
        else if (r._sell) { g.strokeStyle = 'rgba(255,120,140,.95)'; g.lineWidth = 1.1; g.strokeRect(baseX + 0.5, top + 0.5, len - 1, h - 1); }
        if (rowH >= 6) { g.font = '6px ' + MONO; const t = kfmt(r.tot), tw = g.measureText(t).width; if (len >= tw + 5) { g.fillStyle = 'rgba(244,248,253,.92)'; g.textAlign = 'right'; g.fillText(t, baseX + len - 3, cy + 2.1); } }
      });
      // POC dorado
      { const pr = byP[an.poc]; const pl = Math.max(3, Math.round((pr ? pr.tot / maxV : 1) * profW)), cy = Y(an.poc), h = Math.max(1, rowH - 0.8);
        g.strokeStyle = `rgba(${GOLD},.95)`; g.lineWidth = 1.2; g.strokeRect(baseX + 0.5, cy - rowH / 2 + 0.4, pl, h); }
      // area de valor
      g.strokeStyle = `rgba(${GOLD},.4)`; g.lineWidth = 1.3; g.beginPath(); g.moveTo(baseX - 1.5, Y(an.vaHi) - rowH / 2); g.lineTo(baseX - 1.5, Y(an.vaLo) + rowH / 2); g.stroke();
      // zonas de imbalance apilado (3+)
      const zona = (flag, rgb) => { let s = -1; for (let k = 0; k <= filas.length; k++) { const on = k < filas.length && filas[k][flag];
        if (on && s < 0) s = k; if (!on && s >= 0) { if (k - s >= 3) { const ya = Y(filas[s].p) - rowH / 2, yb = Y(filas[k - 1].p) + rowH / 2;
          const zx = baseX + profW, zw = Math.min(domX, slotX + cw * 4) - zx;
          g.fillStyle = `rgba(${rgb},.08)`; g.fillRect(zx, Math.min(ya, yb), zw, Math.abs(yb - ya));
          g.fillStyle = `rgba(${rgb},.9)`; g.fillRect(zx, Math.min(ya, yb), 2, Math.abs(yb - ya)); } s = -1; } } };
      zona('_buy', '46,230,150'); zona('_sell', '255,64,96');
      // triangulo de delta + V
      const ty = Y(Math.round(v.l / S.tick) * S.tick) + rowH / 2 + 8, uCx = baseX + profW / 2;
      if (ty < fpY + fpH - 6) {
        if (Math.abs(v.delta) > MAXDELTA * 0.55) { const tc = v.delta >= 0 ? '#2ebd85' : '#f6465d'; g.fillStyle = tc; g.beginPath();
          if (v.delta >= 0) { g.moveTo(uCx, ty - 4); g.lineTo(uCx - 4, ty + 1.5); g.lineTo(uCx + 4, ty + 1.5); } else { g.moveTo(uCx, ty + 1.5); g.lineTo(uCx - 4, ty - 4); g.lineTo(uCx + 4, ty - 4); }
          g.closePath(); g.fill(); }
        g.fillStyle = 'rgba(125,135,148,.6)'; g.font = '7px ' + MONO; g.textAlign = 'center'; g.fillText('V:' + kfmt(v.vol), uCx, ty + 11);
      }
    });
  }

  /* DOM con su PROPIA escala (los ~20 niveles cerca del precio llenan el panel). */
  function dom(domX, domW, fpY, fpH, rowH) {
    g.fillStyle = '#090c12'; g.fillRect(domX, fpY, domW, fpH);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(domX, fpY); g.lineTo(domX, fpY + fpH); g.stroke();
    // cabecera + metricas reales
    g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(domX, fpY, domW, 30);
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(domX, fpY + 30); g.lineTo(W, fpY + 30); g.stroke();
    g.fillStyle = '#eaecef'; g.font = '800 10px ' + SANS; g.textAlign = 'left'; g.fillText('DOM', domX + 10, fpY + 12);
    g.fillStyle = '#4a5561'; g.font = '700 7px ' + MONO; g.fillText('BINANCE ' + String.fromCharCode(183) + ' PERP', domX + 38, fpY + 11.5);
    const m = S.met, mets = [['OBI', Math.round(m.obi) + '%', '#2ebd85'], ['SPOOF', Math.round(m.spoof) + '%', '#E8B84B'], ['VPIN', Math.round(m.vpin) + '%', '#f6465d']];
    let mx = domX + 10; g.font = '700 7.5px ' + MONO;
    mets.forEach((me) => { g.fillStyle = '#4a5561'; g.textAlign = 'left'; g.fillText(me[0], mx, fpY + 24); const lw = g.measureText(me[0]).width + 2; g.fillStyle = me[2]; g.fillText(me[1], mx + lw, fpY + 24); mx += lw + g.measureText(me[1]).width + 10; });
    g.fillStyle = m.net >= 0 ? '#2ebd85' : '#f6465d'; g.textAlign = 'right'; g.fillText(sfmt(m.net), W - 8, fpY + 24);

    const asks = (S.dom.asks || []).filter((x) => x[0] >= S.precio).slice(0, 18).sort((a, b) => b[0] - a[0]);
    const bids = (S.dom.bids || []).filter((x) => x[0] <= S.precio).slice(0, 18).sort((a, b) => b[0] - a[0]);
    const filas = asks.concat(bids); if (!filas.length) return;
    let MAXN = 1; filas.forEach((x) => { MAXN = Math.max(MAXN, x[0] * x[1]); });
    const top = fpY + 44, panelH = fpY + fpH - top - 2, rh = Math.min(16, panelH / filas.length), y0 = top + (panelH - rh * filas.length) / 2;
    const priceCx = domX + domW * 0.46, askBar0 = priceCx + 62, askBarMax = W - 6 - askBar0, bidBar0 = priceCx - 62, bidBarMax = bidBar0 - (domX + 6);
    g.fillStyle = '#4a5561'; g.font = '700 7px ' + MONO; g.textAlign = 'center'; g.fillText('PRICE', priceCx, top - 3);
    g.textAlign = 'left'; g.fillText('ASK', askBar0, top - 3); g.textAlign = 'right'; g.fillText('BID', bidBar0, top - 3);
    filas.forEach((x, i) => {
      const p = x[0], notion = p * x[1], isAsk = p >= S.precio, rgb = isAsk ? '246,70,93' : '46,189,133';
      const cy = y0 + i * rh + rh / 2, by = cy - rh / 2 + 0.5, bh = Math.max(1, rh - 1), wall = notion > MAXN * 0.5;
      g.font = '7.5px ' + MONO;
      if (isAsk) { const len = Math.max(3, (notion / MAXN) * askBarMax); g.fillStyle = `rgba(${rgb},${wall ? 0.8 : 0.3})`;
        if (wall) { g.save(); g.shadowColor = `rgba(${rgb},.6)`; g.shadowBlur = 6; g.fillRect(askBar0, by, len, bh); g.restore(); } else g.fillRect(askBar0, by, len, bh);
        g.fillStyle = 'rgba(255,150,162,.85)'; g.textAlign = 'left'; g.fillText(kfmt(notion), priceCx + 26, cy + 2.6);
      } else { const len = Math.max(3, (notion / MAXN) * bidBarMax); g.fillStyle = `rgba(${rgb},${wall ? 0.8 : 0.3})`;
        if (wall) { g.save(); g.shadowColor = `rgba(${rgb},.6)`; g.shadowBlur = 6; g.fillRect(bidBar0 - len, by, len, bh); g.restore(); } else g.fillRect(bidBar0 - len, by, len, bh);
        g.fillStyle = 'rgba(140,235,190,.85)'; g.textAlign = 'right'; g.fillText(kfmt(notion), priceCx - 26, cy + 2.6);
      }
      g.fillStyle = isAsk ? 'rgba(230,150,160,.72)' : 'rgba(150,225,190,.72)'; g.textAlign = 'center'; g.fillText(p.toFixed(S.tick < 1 ? 2 : 1), priceCx, cy + 2.6);
    });
    // banda de precio actual (entre ask y bid)
    const yband = y0 + asks.length * rh;
    g.save(); g.fillStyle = `rgba(${GOLD},.14)`; g.fillRect(domX, yband - rh / 2, domW, rh);
    g.strokeStyle = `rgba(${GOLD},.75)`; g.lineWidth = 1; g.beginPath(); g.moveTo(domX, yband); g.lineTo(W, yband); g.stroke(); g.restore();
    g.fillStyle = '#E8B84B'; g.fillRect(priceCx - 32, yband - 8, 64, 16); g.fillStyle = '#17110a'; g.font = '700 9px ' + MONO; g.textAlign = 'center'; g.fillText(S.precio.toFixed(S.tick < 1 ? 2 : 1), priceCx, yband + 3);
  }

  function tabla(velas, fpX, fpW, fpY, fpH, deltaH, domX) {
    const NC = velas.length, cw = fpW / NC;
    const dY = fpY + fpH + 10, rH = (deltaH - 16) / 4;
    const SLATE = '92,124,168';
    const cel = (x, ry, w, txt, rgb, a, tc) => { g.fillStyle = `rgba(${rgb},${a})`; g.fillRect(x, ry, w, rH - 2); g.fillStyle = tc; g.font = '8.5px ' + MONO; g.textAlign = 'center'; g.fillText(txt, x + w / 2, ry + rH / 2 + 1.6); };
    let sess = 0; const sessAcc = velas.map((v) => (sess += v.delta));
    velas.forEach((v, i) => { const x = fpX + i * cw + 1, w = cw - 2, up = v.delta >= 0, pct = v.vol ? Math.round(v.delta / v.vol * 100) : 0, sp = sessAcc[i] >= 0;
      cel(x, dY, w, kfmt(v.vol), SLATE, .22, 'rgba(206,218,234,.9)');
      cel(x, dY + rH, w, sfmt(v.delta), up ? '46,189,133' : '246,70,93', .22, up ? 'rgba(150,240,195,.95)' : 'rgba(255,145,160,.95)');
      cel(x, dY + 2 * rH, w, (up ? UP : DN) + Math.abs(pct) + '%', up ? '46,189,133' : '246,70,93', .13, up ? 'rgba(150,240,195,.85)' : 'rgba(255,145,160,.85)');
      cel(x, dY + 3 * rH, w, sfmt(sessAcc[i]), sp ? '46,189,133' : '246,70,93', .13, sp ? 'rgba(150,240,195,.8)' : 'rgba(255,145,160,.8)');
    });
    g.textAlign = 'left'; g.font = '700 8px ' + MONO; g.fillStyle = '#4a5561';
    ['VOLUMEN', 'DELTA', 'DELTA %', 'SESSION'].forEach((t, k) => g.fillText(t, domX + 10, dY + k * rH + rH / 2 + 1.6));
    g.fillStyle = '#4a5561'; g.font = '7.5px ' + MONO; g.textAlign = 'center';
    velas.forEach((v, i) => g.fillText(hhmm(v.t), fpX + i * cw + cw / 2, dY + 4 * rH + 8));
  }

  let ultimo = 0;
  function arrancar() { if (raf) return; const paso = () => { if (muerto) return; const n = performance.now(); if (n - ultimo >= 33 && !document.hidden) { ultimo = n; dibujar(); } raf = requestAnimationFrame(paso); }; raf = requestAnimationFrame(paso); }
  function destruir() { muerto = true; cancelAnimationFrame(raf); try { ro.disconnect(); } catch (_) {} }

  return { S, dibujar, arrancar, destruir, resize };
}

function pasoPrecio(rango) { const b = rango / 8; const mag = Math.pow(10, Math.floor(Math.log10(b))); const n = b / mag; const p = n >= 5 ? 5 : n >= 2 ? 2 : 1; return p * mag; }
