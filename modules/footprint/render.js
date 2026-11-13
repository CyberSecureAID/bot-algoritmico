/* modules/footprint/render.js — Render en canvas de Footprint Pro.

   Replica el layout profesional (ATAS / Sierra Chart / estándar documentado por
   LuxAlgo):
     · Columna por vela: cuerpo OHLC (open/close + mecha) + footprint de celdas.
     · Celdas: Bid x Ask (venta izq / compra der), con intensidad por volumen.
     · POC marcado por vela y extendido a la derecha hasta que lo rompan.
     · Value Area (70% del volumen) sombreada alrededor del POC.
     · Imbalances diagonales resaltados (teal compra / rojo venta) y zonas
       apiladas como líneas S/R a la derecha.
     · TABLA POR VELA debajo (Volumen · Delta · Delta%): el aviso de quién gana
       cada vela (alcistas vs bajistas).
     · Panel CVD (delta acumulado) con flechas de divergencia.
   Tres vistas de celda: 'bidask', 'delta', 'profile'. Zoom rueda, pan arrastre,
   tooltip por celda, ajuste automático de precio. Sin librerías. */

const C = {
  bg: '#0a0e14', grid: 'rgba(255,255,255,.045)', eje: '#6b7681',
  buy: '#26c281', sell: '#e8445d', buyTx: '#7ff0b0', sellTx: '#ff8a9a',
  up: '#26c281', down: '#e8445d', upBody: 'rgba(38,194,129,.9)', downBody: 'rgba(232,68,93,.9)',
  txt: '#c7ccd4', dim: '#7d8794', poc: '#E8B84B', va: 'rgba(232,184,75,.06)',
  imbBuy: '#2ff0c0', imbSell: '#ff5d73', cvd: '#8ea2ff', wm: 'rgba(232,184,75,.55)'
};

export function crearRender(host, opts = {}) {
  const onHover = opts.onHover || function () {};
  const cv = document.createElement('canvas');
  cv.style.cssText = 'display:block;width:100%;height:100%;cursor:crosshair';
  host.appendChild(cv);
  const ctx = cv.getContext('2d');

  // Marcadores (opcionales): absorción (bull/bear) y flechas de guerra en vivo
  // (warUp = compradores/verde abajo, warDown = vendedores/rojo arriba). El logo
  // de marca NO se dibuja en el canvas: va como capa DOM .fp-wm.
  const imgs = { bull: null, bear: null, warUp: null, warDown: null };
  function cargarImg(url) { if (!url) return null; const i = new Image(); i.onload = () => render(); i.src = url; return i; }
  if (opts.imgBull) imgs.bull = cargarImg(opts.imgBull);
  if (opts.imgBear) imgs.bear = cargarImg(opts.imgBear);
  if (opts.imgWarUp) imgs.warUp = cargarImg(opts.imgWarUp);
  if (opts.imgWarDown) imgs.warDown = cargarImg(opts.imgWarDown);

  // Capa FX propia para el CVD: una luz que lo recorre (comet), igual que la
  // iluminación del VWAP en VWAP Pro. Va encima, sin tocar el dibujo principal.
  const fx = document.createElement('canvas');
  fx.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  host.appendChild(fx);
  const fctx = fx.getContext('2d');

  const st = { agg: null, meta: null, mode: 'bidask', colW: 72, leftF: 0, anclaDer: true, yZoom: 1, yPan: 0,
    pMin: 0, pMax: 1, W: 0, H: 0, dpr: 1, hover: null, drag: null, _cvdPts: null, _absMarks: null, _warPos: null, _winMarks: null, _deltaTiles: null,
    live: null, liveT: null, disp: new Map(), dispC: 0, dispH: 0, dispL: 0, flash: new Map() };
  let _rafId = null, _animId = null, _lastFx = 0;
  /* Animación de la vela EN FORMACIÓN: el cuerpo sigue al precio en vivo y las
     celdas de volumen CRECEN suavemente hacia su valor real según entra el
     flujo (la lucha compra/venta). Nada de parpadeos: easing + un realce que
     se apaga en la celda donde acaba de entrar volumen. */
  function _ease() {
    _rafId = requestAnimationFrame(() => {
      let moved = false; const L = st.live;
      if (L) {
        const k = 0.2, rango = Math.max(1e-9, st.pMax - st.pMin);
        st.dispC += (L.c - st.dispC) * k; st.dispH += (L.h - st.dispH) * k; st.dispL += (L.l - st.dispL) * k;
        if ((Math.abs(L.c - st.dispC) + Math.abs(L.h - st.dispH) + Math.abs(L.l - st.dispL)) / rango > 1e-4) moved = true;
        const bin = (st.agg && st.agg.binSize) || 1;
        for (const lv of L.niveles) {
          const key = Math.round(lv.price / bin); let d = st.disp.get(key);
          if (!d) { d = { price: lv.price, buy: 0, sell: 0 }; st.disp.set(key, d); }
          if ((lv.buy - d.buy) > 1e-4 || (lv.sell - d.sell) > 1e-4) st.flash.set(key, 1);
          d.buy += (lv.buy - d.buy) * k; d.sell += (lv.sell - d.sell) * k;
          if (Math.abs(lv.buy - d.buy) + Math.abs(lv.sell - d.sell) > 1e-3) moved = true;
        }
        st.flash.forEach((v, key) => { const nv = v - 0.07; if (nv <= 0) st.flash.delete(key); else { st.flash.set(key, nv); moved = true; } });
      }
      render();
      if (moved) _ease(); else _rafId = null;
    });
  }
  function setLive(candle) {
    if (!candle) return;
    if (candle.t !== st.liveT) { st.liveT = candle.t; st.disp = new Map(); st.flash = new Map(); const o = candle.o != null ? candle.o : candle.c; st.dispC = o; st.dispH = o; st.dispL = o; }
    st.live = candle; if (!_rafId) _ease();
  }

  function resize() {
    const r = host.getBoundingClientRect();
    st.W = Math.max(360, Math.floor(r.width)); st.H = Math.max(280, Math.floor(r.height));
    st.dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.floor(st.W * st.dpr); cv.height = Math.floor(st.H * st.dpr);
    cv.style.width = st.W + 'px'; cv.style.height = st.H + 'px';
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    fx.width = cv.width; fx.height = cv.height; fx.style.width = st.W + 'px'; fx.style.height = st.H + 'px';
    fctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    st.anclaDer = true; st.yPan = 0; st.yZoom = 1; st.colW = anchoInicial(); render();
  }
  // Ancho de columna inicial: ~16 velas. Suficientes columnas para leer los
  // números de cada celda (compra x venta) sin que se vea ni muy de lejos ni muy
  // de cerca. El footprint se lee por sus números, así que no se encoge de más.
  function anchoInicial() { return Math.max(58, Math.min(104, Math.round((st.W - GUT) / 16))); }

  const GUT = 68, HFOOT = 50;
  function layout() {
    const w = st.W - GUT, h = st.H;
    const hCvd = Math.round(h * 0.15);
    const main = { x: 0, y: 0, w, h: h - HFOOT - hCvd - 20 };
    const foot = { x: 0, y: main.h, w, h: HFOOT };
    const cvd = { x: 0, y: main.h + HFOOT + 2, w, h: hCvd };
    return { w, h, main, foot, cvd };
  }

  function redondo(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function dec() { const b = (st.agg && st.agg.binSize) || 1; return Math.max(0, Math.min(8, Math.ceil(-Math.log10(b)))); }
  function fp(p) { return Number(p).toLocaleString('en-US', { minimumFractionDigits: dec(), maximumFractionDigits: dec() }); }
  function fv(v) { const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K'; if (a >= 100) return v.toFixed(0); if (a >= 1) return v.toFixed(1); return v.toFixed(2); }
  function sfv(v) { return (v >= 0 ? '+' : '−') + fv(Math.abs(v)); }

  function RPAD() { return Math.min(46, st.colW * 0.7); }   // aire entre la vela nueva y el eje de precio: que NUNCA quede detrás
  function nVis(L) { return Math.max(1, Math.floor((L.main.w - RPAD()) / st.colW)); }
  function visibles(L) {
    const cs = (st.agg && st.agg.candles) || []; if (!cs.length) return [];
    const maxLeft = Math.max(0, cs.length - nVis(L));
    if (st.anclaDer) st.leftF = maxLeft;
    st.leftF = Math.max(0, Math.min(maxLeft, st.leftF));
    const out = [];
    for (let i = Math.floor(st.leftF); i < cs.length; i++) { const x = L.main.x + (i - st.leftF) * st.colW; if (x > L.main.w - 2) break; out.push({ c: cs[i], x, i }); }
    return out;
  }
  function rango(vis) {
    let lo = Infinity, hi = -Infinity;
    for (const { c } of vis) { const cl = Math.min(c.l, c.lo), ch = Math.max(c.h, c.hi); if (cl < lo) lo = cl; if (ch > hi) hi = ch; }   // rango REAL de la vela (cuerpo+mecha), no solo celdas
    if (st.meta && st.meta.last > 0) { if (st.meta.last < lo) lo = st.meta.last; if (st.meta.last > hi) hi = st.meta.last; }
    if (!isFinite(lo) || !isFinite(hi) || hi <= lo) { lo = 0; hi = 1; }
    const pad = (hi - lo) * 0.07 || 1; let a = lo - pad, b = hi + pad;
    const cen = (a + b) / 2, half = ((b - a) / 2) / (st.yZoom || 1);   // zoom de precio (arrastre del eje derecho)
    st.pMin = cen - half + st.yPan; st.pMax = cen + half + st.yPan;    // yPan: la gráfica se despega del eje y se mueve en vertical
  }
  const yP = (p, A) => A.y + (st.pMax - p) / (st.pMax - st.pMin) * A.h;
  const pY = (y, A) => st.pMax - (y - A.y) / A.h * (st.pMax - st.pMin);

  // Value Area: banda de precios que concentra el 70% del volumen alrededor del POC
  function valueArea(c) {
    if (!c.niveles.length) return null;
    const orden = c.niveles.map((n) => ({ price: n.price, v: n.buy + n.sell })).sort((a, b) => b.v - a.v);
    const objetivo = c.total * 0.7; let acc = 0, lo = Infinity, hi = -Infinity;
    for (const n of orden) { acc += n.v; if (n.price < lo) lo = n.price; if (n.price > hi) hi = n.price; if (acc >= objetivo) break; }
    return { lo, hi };
  }

  function render() {
    const L = layout();
    ctx.clearRect(0, 0, st.W, st.H); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, st.W, st.H);
    if (!st.agg || !st.agg.candles || !st.agg.candles.length) { st._cvdPts = null; st._absMarks = null; st._warPos = null; st._winMarks = null; st._deltaTiles = null; return; }   // el loader DOM cubre la espera (sin texto en el canvas)
    const vis = visibles(L); rango(vis);
    ejeP(L); cols(L, vis); marcasFx(L, vis);
    statFooter(L, vis); cvdPanel(L, vis); ejeT(L, vis); if (st.hover) cruz(L);
  }

  // Calcula (no dibuja) lo que va en la capa FX: absorción flotando sobre su
  // vela, la "guerra" en vivo de la vela en formación, y la flecha del GANADOR
  // que se queda en cada vela YA cerrada (verde abajo si ganaron los toros,
  // roja arriba si ganaron los osos).
  function marcasFx(L, vis) {
    const A = L.main, marks = [], wins = [];
    for (const a of (st.agg.absorciones || [])) {
      const v = vis.find((x) => x.c.t === a.t); if (!v) continue;
      const y = yP(v.c.hi, A); if (y < -24 || y > A.h) continue;
      marks.push({ x: v.x + st.colW / 2, y, bull: a.side === 'sell' });
    }
    st._absMarks = marks;
    for (const { c, x } of vis) {
      if (c.t === st.liveT) continue;                 // la viva lleva las dos flechas titilando, no la del ganador
      const o = c.o != null ? c.o : c.c;
      const buyWin = c.c >= o, cx = x + st.colW / 2;   // GANADOR por color de la vela (cierre vs apertura), no por delta
      // Separada del bloque: verde BAJO el mínimo, roja SOBRE el máximo, con aire.
      const y = buyWin ? Math.min(A.h - 6, yP(c.l, A) + 16) : Math.max(12, yP(c.h, A) - 16);
      if (y < -20 || y > A.h + 20) continue;
      wins.push({ x: cx, y, buyWin });
    }
    st._winMarks = wins;
    const lv = vis.find((x) => x.c.t === st.liveT);
    if (lv && st.live) {
      let b = 0, s = 0; for (const n of (st.live.niveles || [])) { b += n.buy; s += n.sell; }
      const o = lv.c.o != null ? lv.c.o : st.dispC;
      const yTop = Math.max(12, yP(Math.max(st.dispH, st.dispC), A) - 18);
      const yBot = Math.min(A.h - 6, yP(Math.min(st.dispL, st.dispC), A) + 18);
      st._warPos = { x: lv.x + st.colW / 2, yTop, yBot, b, s, up: st.dispC >= o };   // ganando = precio sobre la apertura (color de la vela)
    } else st._warPos = null;
  }

  function ejeP(L) {
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L.main.w + .5, 0); ctx.lineTo(L.main.w + .5, L.cvd.y + L.cvd.h); ctx.stroke();
    ctx.fillStyle = C.eje; ctx.font = '10px ui-monospace,monospace'; ctx.textAlign = 'left';
    for (let i = 0; i <= 8; i++) { const p = st.pMin + (st.pMax - st.pMin) * (i / 8), y = yP(p, L.main); if (y < 2 || y > L.main.y + L.main.h) continue; ctx.fillText(fp(p), L.main.w + 6, y + 3); }
    if (st.meta && st.meta.last > 0) { const y = yP(st.meta.last, L.main); if (y > 0 && y < L.main.h) { ctx.strokeStyle = C.poc; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(L.main.w, y + .5); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = C.poc; ctx.fillRect(L.main.w, y - 7, GUT, 14); ctx.fillStyle = '#20160a'; ctx.font = '700 10px ui-monospace,monospace'; ctx.fillText(fp(st.meta.last), L.main.w + 5, y + 3); } }
  }

  function cols(L, vis) {
    const A = L.main, bin = st.agg.binSize || 1;
    const rowH = Math.max(0.6, (bin / (st.pMax - st.pMin)) * A.h);
    const maxV = st.agg.maxCellVol || 1;
    const texto = st.colW >= 58 && rowH >= 9;
    ctx.textBaseline = 'middle';
    ctx.save(); ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();   // la vela y las celdas NO invaden delta/CVD
    for (const { c, x } of vis) {
      const cx = x + st.colW / 2;
      const esLive = (c.t === st.liveT && st.live);
      // En la vela en formación, las celdas se dibujan con los valores EASED
      // (st.disp), que crecen hacia los reales según entra volumen.
      const nivs = esLive ? [...st.disp.values()].sort((a, b) => a.price - b.price) : c.niveles;
      let cMax = 1; for (const l of nivs) { if (l.buy > cMax) cMax = l.buy; if (l.sell > cMax) cMax = l.sell; }
      if (esLive) { ctx.save(); ctx.globalAlpha = .035; ctx.fillStyle = C.poc; ctx.fillRect(x, A.y, st.colW, A.h); ctx.restore(); }
      const imb = new Set((c.imbalances || []).map((i) => Math.round(i.price / bin) + i.side));
      const va = valueArea(c);
      if (va && isFinite(va.lo)) { const y1 = yP(va.hi, A) - rowH / 2, y2 = yP(va.lo, A) + rowH / 2; ctx.fillStyle = C.va; ctx.fillRect(x + 1, y1, st.colW - 2, Math.max(1, y2 - y1)); }

      for (const lv of nivs) {
        const y = yP(lv.price, A) - rowH / 2, k = Math.round(lv.price / bin);
        const fl = esLive ? (st.flash.get(k) || 0) : 0;   // realce al entrar volumen (se apaga solo)
        if (st.mode === 'delta') {
          const d = lv.buy - lv.sell, inten = Math.min(1, Math.abs(d) / maxV);
          ctx.fillStyle = d >= 0 ? `rgba(38,194,129,${0.1 + inten * 0.62 + fl * 0.25})` : `rgba(232,68,93,${0.1 + inten * 0.62 + fl * 0.25})`;
          ctx.fillRect(x + 2, y, st.colW - 4, Math.max(1, rowH - 1));
          if (texto && rowH >= 11) { ctx.fillStyle = inten > 0.5 ? '#07130c' : C.txt; ctx.font = '10px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText(sfv(d), cx, y + rowH / 2); }
        } else if (st.mode === 'profile') {
          const wB = (lv.buy / cMax) * (st.colW / 2 - 5), wS = (lv.sell / cMax) * (st.colW / 2 - 5);
          ctx.fillStyle = `rgba(232,68,93,${0.55 + fl * 0.35})`; ctx.fillRect(cx - wS, y, Math.max(0, wS), Math.max(1.5, rowH - 1));
          ctx.fillStyle = `rgba(38,194,129,${0.55 + fl * 0.35})`; ctx.fillRect(cx, y, Math.max(0, wB), Math.max(1.5, rowH - 1));
        } else {
          const iS = Math.min(1, lv.sell / maxV), iB = Math.min(1, lv.buy / maxV);
          ctx.fillStyle = `rgba(232,68,93,${0.08 + iS * 0.5 + fl * 0.3})`; ctx.fillRect(x + 2, y, st.colW / 2 - 2, Math.max(1, rowH - 1));
          ctx.fillStyle = `rgba(38,194,129,${0.08 + iB * 0.5 + fl * 0.3})`; ctx.fillRect(cx, y, st.colW / 2 - 2, Math.max(1, rowH - 1));
          if (imb.has(k + 'buy')) { ctx.strokeStyle = C.imbBuy; ctx.lineWidth = 1.5; ctx.strokeRect(cx + .5, y + .5, st.colW / 2 - 3, Math.max(1, rowH - 2)); }
          if (imb.has(k + 'sell')) { ctx.strokeStyle = C.imbSell; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2.5, y + .5, st.colW / 2 - 3, Math.max(1, rowH - 2)); }
          if (texto) { ctx.font = '10px ui-monospace,monospace'; ctx.fillStyle = C.sellTx; ctx.textAlign = 'right'; ctx.fillText(fv(lv.sell), cx - 4, y + rowH / 2); ctx.fillStyle = C.buyTx; ctx.textAlign = 'left'; ctx.fillText(fv(lv.buy), cx + 4, y + rowH / 2); }
        }
      }
      if (c.poc != null) { const yp = yP(c.poc, A) - rowH / 2; ctx.strokeStyle = C.poc; ctx.lineWidth = 1.6; ctx.strokeRect(x + 1.5, yp - .5, st.colW - 3, Math.max(2, rowH)); }
      // cuerpo OHLC: en la vela viva usa el precio EASED → sigue al precio en vivo
      const oc = esLive ? { o: c.o, c: st.dispC, h: Math.max(st.dispH, st.dispC, c.o), l: Math.min(st.dispL, st.dispC, c.o) } : c;
      dibujarVela(oc, cx, A);
      ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + st.colW - .5, A.y); ctx.lineTo(x + st.colW - .5, A.y + A.h); ctx.stroke();
    }
    ctx.restore();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  function dibujarVela(c, cx, A) {
    const o = c.o != null ? c.o : c.c, cl = c.c != null ? c.c : o;
    const sube = cl >= o, col = sube ? C.up : C.down;
    const yH = yP(c.h, A), yL = yP(c.l, A), yO = yP(o, A), yC = yP(cl, A);
    const bw = Math.max(3, Math.min(10, st.colW * 0.12));
    ctx.strokeStyle = col; ctx.globalAlpha = .8; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx, yH); ctx.lineTo(cx, yL); ctx.stroke();            // mecha (visible, conecta la vela)
    ctx.globalAlpha = .72; ctx.fillStyle = col;
    const top = Math.min(yO, yC), hh = Math.max(1.5, Math.abs(yC - yO));
    ctx.fillRect(cx - bw / 2, top, bw, hh);                                            // cuerpo
    ctx.globalAlpha = 1;
  }

  function apiladas(L, vis) {
    const A = L.main, z = st.agg.stacked || []; if (!z.length || !vis.length) return;
    for (const s of z) {
      const col = s.side === 'buy' ? C.imbBuy : C.imbSell;
      const yA = yP(s.yHi, A), yB = yP(s.yLo, A);
      if ((yA < 0 && yB < 0) || (yA > A.h && yB > A.h)) continue;
      let x0 = A.x; const idx = vis.findIndex((v) => v.c.t === s.fromT); if (idx >= 0) x0 = vis[idx].x;
      ctx.fillStyle = s.side === 'buy' ? 'rgba(47,240,192,.06)' : 'rgba(255,93,115,.06)'; ctx.fillRect(x0, Math.min(yA, yB), A.w - x0, Math.abs(yB - yA) || 2);
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); const ym = (yA + yB) / 2; ctx.beginPath(); ctx.moveTo(x0, ym); ctx.lineTo(A.w, ym); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // POC de la última vela extendido a la derecha (nivel de control vigente)
  function pocExtendido(L, vis) {
    if (!vis.length) return; const A = L.main; const ult = vis[vis.length - 1].c; if (ult.poc == null) return;
    const y = yP(ult.poc, A); if (y < 0 || y > A.h) return;
    ctx.strokeStyle = 'rgba(232,184,75,.5)'; ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(vis[vis.length - 1].x, y); ctx.lineTo(A.w, y); ctx.stroke(); ctx.setLineDash([]);
  }

  // Imagen (o triángulo de respaldo) en el canvas PRINCIPAL, con sombra suave,
  // sin movimiento. Para las flechas de delta y de divergencia del CVD.
  function marca(cx, cy, h, im, color, dir) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1.5;
    if (im && im.complete && im.naturalWidth) { const w = im.naturalWidth * (h / im.naturalHeight); ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h); }
    else { const s = h * 0.46; ctx.fillStyle = color; ctx.beginPath(); if (dir === 'up') { ctx.moveTo(cx, cy - s); ctx.lineTo(cx - s, cy + s); ctx.lineTo(cx + s, cy + s); } else { ctx.moveTo(cx, cy + s); ctx.lineTo(cx - s, cy - s); ctx.lineTo(cx + s, cy - s); } ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  // TABLA POR VELA: delta coloreado + volumen + flecha de quién gana la vela
  function statFooter(L, vis) {
    const A = L.foot;
    ctx.fillStyle = 'rgba(255,255,255,.015)'; ctx.fillRect(A.x, A.y, A.w, A.h);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(0, A.y + .5); ctx.lineTo(A.w, A.y + .5); ctx.stroke();
    let maxD = 1; for (const { c } of vis) maxD = Math.max(maxD, Math.abs(c.delta));
    const texto = st.colW >= 52;
    const tiles = [];
    for (const { c, x } of vis) {
      const gana = c.delta >= 0, col = gana ? C.up : C.down, cx = x + st.colW / 2;
      const base = gana ? '38,194,129' : '232,68,93', inten = Math.min(1, Math.abs(c.delta) / maxD);
      const bx = x + 1.5, by = A.y + 2, bw = st.colW - 3, bh = A.h - 4, rr = 5;
      const grad = ctx.createLinearGradient(0, by, 0, by + bh);
      grad.addColorStop(0, `rgba(${base},${(0.12 + inten * 0.44).toFixed(3)})`); grad.addColorStop(1, `rgba(${base},${(0.04 + inten * 0.16).toFixed(3)})`);
      ctx.save(); redondo(bx, by, bw, bh, rr); ctx.shadowColor = `rgba(${base},${(0.16 + inten * 0.28).toFixed(3)})`; ctx.shadowBlur = 4 + inten * 6; ctx.fillStyle = grad; ctx.fill(); ctx.restore();
      // TODO el contenido va recortado al recuadro → nunca se sale (fix del desfase)
      ctx.save(); redondo(bx, by, bw, bh, rr); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(bx, by, bw, 2);
      ctx.globalAlpha = 0.5; marca(cx, A.y + 9, 8, gana ? imgs.bull : imgs.bear, col, gana ? 'up' : 'down'); ctx.globalAlpha = 1;   // flecha diminuta y tenue
      if (texto) {
        const pct = c.total > 0 ? Math.round((c.delta / c.total) * 100) : 0;
        ctx.textAlign = 'center';
        ctx.font = '700 10.5px ui-monospace,monospace'; ctx.fillStyle = col; ctx.fillText(sfv(c.delta), cx, A.y + 25);
        ctx.font = '8px ui-monospace,monospace'; ctx.fillStyle = C.dim; ctx.fillText(fv(c.total) + ' ' + (pct >= 0 ? '+' : '−') + Math.abs(pct) + '%', cx, A.y + A.h - 7);
      }
      ctx.restore();
      redondo(bx, by, bw, bh, rr); ctx.strokeStyle = `rgba(${base},${(0.26 + inten * 0.34).toFixed(3)})`; ctx.lineWidth = 1; ctx.stroke();
      tiles.push({ bx, by, bw, bh, rr, base, inten });
    }
    st._deltaTiles = tiles;
    ctx.textAlign = 'left';
  }

  function cvdPanel(L, vis) {
    const A = L.cvd;
    ctx.fillStyle = 'rgba(255,255,255,.02)'; ctx.fillRect(A.x, A.y, A.w, A.h);
    ctx.fillStyle = C.dim; ctx.font = '8px ui-monospace,monospace'; ctx.textAlign = 'left'; ctx.fillText('CVD · cumulative volume delta', 5, A.y + 10);
    if (!vis.length) { st._cvdPts = null; return; }
    // CVD REAL y CONTINUO: delta acumulado verdadero del motor (origen fijo en la
    // primera vela cargada), NO rebaseado por lo que ves. Así la línea no cambia
    // de forma al desplazar: solo ves otra ventana de la MISMA curva, como en una
    // terminal profesional. La escala vertical se ajusta al tramo visible.
    const map = new Map((st.agg.cvd || []).map((p) => [p.t, p.v]));
    let prev = 0;
    const pts = vis.map(({ c, x }) => { const v = map.has(c.t) ? map.get(c.t) : prev; prev = v; return { x: x + st.colW / 2, v, t: c.t }; });
    let lo = Infinity, hi = -Infinity; for (const p of pts) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; }
    if (!isFinite(lo) || hi === lo) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
    const yv = (v) => A.y + 14 + (hi - v) / (hi - lo) * (A.h - 20);
    const subiendo = pts.length > 1 && pts[pts.length - 1].v >= pts[0].v;
    const col = subiendo ? '38,194,129' : '232,68,93';
    st._cvdPts = pts.map((p) => ({ x: p.x, y: yv(p.v) })); st._cvdCol = col;   // para el comet de la capa FX
    // área bajo la curva (degradado) + línea con glow (igual que el VWAP)
    ctx.beginPath(); pts.forEach((p, i) => { const y = yv(p.v); i ? ctx.lineTo(p.x, y) : ctx.moveTo(p.x, y); });
    ctx.lineTo(pts[pts.length - 1].x, A.y + A.h); ctx.lineTo(pts[0].x, A.y + A.h); ctx.closePath();
    const g = ctx.createLinearGradient(0, A.y, 0, A.y + A.h); g.addColorStop(0, `rgba(${col},.28)`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.shadowColor = `rgba(${col},.95)`; ctx.shadowBlur = 9; ctx.strokeStyle = `rgb(${col})`; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach((p, i) => { const y = yv(p.v); i ? ctx.lineTo(p.x, y) : ctx.moveTo(p.x, y); }); ctx.stroke(); ctx.restore();
    const lastp = pts[pts.length - 1]; if (lastp) { ctx.save(); ctx.shadowColor = `rgba(${col},1)`; ctx.shadowBlur = 10; ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(lastp.x, yv(lastp.v), 3, 0, 7); ctx.fill(); ctx.restore(); }   // punto vivo del CVD
    if (0 >= lo && 0 <= hi) { const yz = yv(0); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(0, yz + .5); ctx.lineTo(A.w, yz + .5); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = C.dim; ctx.font = '8px ui-monospace,monospace'; ctx.fillText('0', A.w - 12, yz - 2); }
    const cur = pts[pts.length - 1]; if (cur) { ctx.fillStyle = `rgb(${col})`; ctx.font = '700 10px ui-monospace,monospace'; ctx.textAlign = 'right'; ctx.fillText('CVD ' + sfv(cur.v), A.w - 6, A.y + 11); ctx.textAlign = 'left'; }
    for (const d of (st.agg.divergences || [])) { const p = pts.find((q) => q.t === d.t); if (!p) continue; const y = yv(p.v); marca(p.x, y + (d.kind === 'bull' ? 13 : -13), 13, d.kind === 'bull' ? imgs.bull : imgs.bear, d.kind === 'bull' ? C.buy : C.sell, d.kind === 'bull' ? 'up' : 'down'); }
  }

  function ejeT(L, vis) {
    const y = L.cvd.y + L.cvd.h + 2; ctx.fillStyle = C.eje; ctx.font = '9px ui-monospace,monospace'; ctx.textAlign = 'center';
    const paso = Math.max(1, Math.round(vis.length / 8));
    vis.forEach(({ c, x }, i) => { if (i % paso) return; const d = new Date(c.t); ctx.fillText(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), x + st.colW / 2, y + 11); });
    ctx.textAlign = 'left';
  }

  function cruz(L) { const { x, y } = st.hover, A = L.main; ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, L.cvd.y + L.cvd.h); ctx.stroke(); if (y < A.h) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(A.w, y + .5); ctx.stroke(); } ctx.setLineDash([]); }

  function hit(mx, my) {
    const L = layout(); if (!st.agg) return null; const vis = visibles(L);
    const v = vis.find((q) => mx >= q.x && mx < q.x + st.colW); if (!v) return null;
    const bin = st.agg.binSize || 1, price = pY(my, L.main), k = Math.round(price / bin);
    const lv = v.c.niveles.find((n) => Math.round(n.price / bin) === k);
    return { c: v.c, lv: lv || null, price: k * bin };
  }

  cv.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; st.hover = { x: mx, y: my };
    if (st.drag) {
      if (st.drag.modo === 'y') st.yZoom = Math.max(0.25, Math.min(6, st.drag.yZoom * Math.exp(-(my - st.drag.my) / 170)));      // eje de precio (derecha): estira/comprime precio
      else if (st.drag.modo === 'x') st.colW = Math.max(26, Math.min(260, st.drag.colW * Math.exp((mx - st.drag.mx) / 170)));   // eje de tiempo (abajo): estira/comprime tiempo
      else { const dx = mx - st.drag.mx, dy = my - st.drag.my; const cs = st.agg ? st.agg.candles.length : 0; const maxLeft = Math.max(0, cs - nVis(layout())); st.leftF = Math.max(0, Math.min(maxLeft, st.drag.left - dx / st.colW)); st.anclaDer = (st.leftF >= maxLeft - 0.001); st.yPan = st.drag.yPan0 + dy * st.drag.ppp; }   // arrastre: tiempo (x) + precio (y)
    }
    cv.style.cursor = st.drag ? (st.drag.modo === 'y' ? 'ns-resize' : st.drag.modo === 'x' ? 'ew-resize' : 'grabbing') : (mx >= st.W - GUT ? 'ns-resize' : my >= st.H - 18 ? 'ew-resize' : 'crosshair');
    onHover(hit(mx, my), e.clientX, e.clientY); render();
  });
  cv.addEventListener('mouseleave', () => { st.hover = null; onHover(null); render(); });
  cv.addEventListener('mousedown', (e) => { const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; const L = layout(); const modo = mx >= st.W - GUT ? 'y' : my >= st.H - 18 ? 'x' : 'pan'; const ppp = (st.pMax - st.pMin) / Math.max(1, L.main.h); st.drag = { mx, my, left: st.leftF, yZoom: st.yZoom, colW: st.colW, yPan0: st.yPan, ppp, modo }; });
  window.addEventListener('mouseup', () => { st.drag = null; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, f = e.deltaY < 0 ? 1.15 : 0.87; if (mx >= st.W - GUT) st.yZoom = Math.max(0.25, Math.min(6, st.yZoom * f)); else st.colW = Math.max(26, Math.min(260, st.colW * f)); render(); }, { passive: false });

  function setData(agg, meta) {
    st.agg = agg; if (meta) st.meta = meta;
    const cs = agg && agg.candles; if (cs && cs.length) setLive(cs[cs.length - 1]);
    render();
  }
  function setMeta(meta) { st.meta = Object.assign(st.meta || {}, meta); render(); }
  function setMode(m) { st.mode = m; render(); }
  function getMode() { return st.mode; }
  function resetView() { st.anclaDer = true; st.colW = anchoInicial(); st.yZoom = 1; st.yPan = 0; render(); }
  function snapshot() { return cv; }
  // Distancia (px) desde el borde inferior del lienzo hasta el borde inferior del
  // área de VELAS. La marca de agua se coloca por encima de esto → nunca sobre
  // delta ni CVD. La usa footprint.js para posicionar .fp-wm.
  function panelBottomPx() { const L = layout(); return st.H - L.main.h; }
  function destroy() { try { cancelAnimationFrame(_animId); } catch (_) {} try { cancelAnimationFrame(_rafId); } catch (_) {} try { host.removeChild(cv); } catch (_) {} try { host.removeChild(fx); } catch (_) {} }

  // Imagen (o triángulo) en la capa FX, centrada, con sombra suave.
  function fxImg(im, x, y, h, alpha, color, dir) {
    fctx.save(); fctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    fctx.shadowColor = 'rgba(0,0,0,.5)'; fctx.shadowBlur = 5; fctx.shadowOffsetY = 1.5;
    if (im && im.complete && im.naturalWidth) { const w = im.naturalWidth * (h / im.naturalHeight); fctx.drawImage(im, x - w / 2, y - h / 2, w, h); }
    else { const s = h * 0.46; fctx.fillStyle = color; fctx.beginPath(); if (dir === 'up') { fctx.moveTo(x, y - s); fctx.lineTo(x - s, y + s); fctx.lineTo(x + s, y + s); } else { fctx.moveTo(x, y + s); fctx.lineTo(x - s, y - s); fctx.lineTo(x + s, y - s); } fctx.closePath(); fctx.fill(); }
    fctx.restore();
  }

  // Capa FX a ~30fps (barata, no repinta el gráfico): comet del CVD + marcas de
  // absorción FLOTANDO sobre su vela + las flechas de GUERRA en vivo.
  function animFx(ts) {
    _animId = requestAnimationFrame(animFx);
    if (ts - _lastFx < 33) return; _lastFx = ts;
    if (!fctx) return; fctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); fctx.clearRect(0, 0, st.W, st.H);
    const now = performance.now();
    // 1) Comet del CVD
    const pts = st._cvdPts;
    if (pts && pts.length >= 2) {
      const w = st.W, period = 2600, frac = (now % period) / period, headX = frac * (w + 260) - 130, tail = 170, col = st._cvdCol || '142,162,255';
      fctx.save(); fctx.lineJoin = 'round'; fctx.lineCap = 'round'; fctx.shadowColor = `rgba(${col},1)`; fctx.shadowBlur = 15; fctx.lineWidth = 3.2;
      for (let i = 1; i < pts.length; i++) { const mx = (pts[i - 1].x + pts[i].x) / 2, d = Math.abs(mx - headX); if (d > tail) continue; const a = 1 - d / tail; fctx.strokeStyle = `rgba(255,255,255,` + (0.15 + 0.8 * a * a).toFixed(3) + ')'; fctx.beginPath(); fctx.moveTo(pts[i - 1].x, pts[i - 1].y); fctx.lineTo(pts[i].x, pts[i].y); fctx.stroke(); }
      fctx.restore();
    }
    // 1b) DELTA: iluminación que respira sobre cada tile (como el Heatmap de VWAP
    //     Pro). Suave, no exagerada. Va en la capa FX → se anima sin repintar todo.
    for (const t of (st._deltaTiles || [])) {
      const a = (0.05 + 0.1 * t.inten) * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now / 820 + t.bx * 0.04)));
      fctx.save(); fctx.beginPath(); const r = t.rr, x = t.bx, y = t.by, w = t.bw, h = t.bh;
      fctx.moveTo(x + r, y); fctx.arcTo(x + w, y, x + w, y + h, r); fctx.arcTo(x + w, y + h, x, y + h, r); fctx.arcTo(x, y + h, x, y, r); fctx.arcTo(x, y, x + w, y, r); fctx.closePath();
      fctx.clip(); const gg = fctx.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, `rgba(${t.base},${a.toFixed(3)})`); gg.addColorStop(1, `rgba(${t.base},0)`); fctx.fillStyle = gg; fctx.fillRect(x, y, w, h); fctx.restore();
    }
    // 2) Flecha del GANADOR que se queda en cada vela cerrada (verde abajo = toros,
    //    roja arriba = osos). Estática, con sombra.
    for (const m of (st._winMarks || [])) { fxImg(m.buyWin ? imgs.warUp : imgs.warDown, m.x, m.y, 13, 0.88, m.buyWin ? C.buy : C.sell, m.buyWin ? 'up' : 'down'); }
    // 3) Absorción: imagen pequeña FLOTANDO en el lugar (sube/baja suave) + sombra
    for (const m of (st._absMarks || [])) { const bob = Math.sin(now / 640 + m.x * 0.05) * 2.4; fxImg(m.bull ? imgs.bull : imgs.bear, m.x, m.y - 14 + bob, 15, 0.96, m.bull ? C.buy : C.sell, m.bull ? 'up' : 'down'); }
    // 3) Guerra en vivo: roja (vendedores) arriba, verde (compradores) abajo. La
    //    del lado que va ganando PARPADEA; la otra queda tenue. Lee el estado en
    //    vivo cada frame → seguro en movimientos rápidos.
    const wp = st._warPos;
    if (wp) {
      const delta = wp.b - wp.s, tot = wp.b + wp.s, lead = tot > 0 ? Math.min(1, Math.abs(delta) / tot) : 0;
      const pulse = 0.5 + 0.5 * Math.sin(now / 150), buyWin = wp.up;   // el que va ganando = color de la vela (precio vs apertura)
      fxImg(imgs.warUp, wp.x, wp.yBot, 16, buyWin ? (0.5 + 0.5 * pulse * (0.5 + 0.5 * lead)) : 0.2, C.buy, 'up');     // compradores (verde, abajo)
      fxImg(imgs.warDown, wp.x, wp.yTop, 16, !buyWin ? (0.5 + 0.5 * pulse * (0.5 + 0.5 * lead)) : 0.2, C.sell, 'down'); // vendedores (rojo, arriba)
    }
  }
  _animId = requestAnimationFrame(animFx);

  return { setData, setLive, setMeta, setMode, getMode, resetView, resize, render, snapshot, destroy, panelBottomPx };
}
