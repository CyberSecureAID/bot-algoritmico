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

  const st = { agg: null, meta: null, mode: 'bidask', colW: 92, leftF: 0, anclaDer: true,
    pMin: 0, pMax: 1, W: 0, H: 0, dpr: 1, hover: null, drag: null, pulse: 0, prevLastTotal: -1, _pulseT: 0 };
  let _rafId = null;
  function _anim() { _rafId = requestAnimationFrame(() => { const now = (window.performance ? performance.now() : Date.now()); st.pulse = Math.max(0, (st._pulseT - now) / 450); render(); if (st.pulse > 0) _anim(); else _rafId = null; }); }
  function pulsar() { st._pulseT = (window.performance ? performance.now() : Date.now()) + 450; if (!_rafId) _anim(); }

  function resize() {
    const r = host.getBoundingClientRect();
    st.W = Math.max(360, Math.floor(r.width)); st.H = Math.max(280, Math.floor(r.height));
    st.dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.floor(st.W * st.dpr); cv.height = Math.floor(st.H * st.dpr);
    cv.style.width = st.W + 'px'; cv.style.height = st.H + 'px';
    ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    st.anclaDer = true; st.colW = 92; render();
  }

  const GUT = 68, HFOOT = 50;
  function layout() {
    const w = st.W - GUT, h = st.H;
    const hCvd = Math.round(h * 0.15);
    const main = { x: 0, y: 0, w, h: h - HFOOT - hCvd - 20 };
    const foot = { x: 0, y: main.h, w, h: HFOOT };
    const cvd = { x: 0, y: main.h + HFOOT + 2, w, h: hCvd };
    return { w, h, main, foot, cvd };
  }

  function dec() { const b = (st.agg && st.agg.binSize) || 1; return Math.max(0, Math.min(8, Math.ceil(-Math.log10(b)))); }
  function fp(p) { return Number(p).toLocaleString('en-US', { minimumFractionDigits: dec(), maximumFractionDigits: dec() }); }
  function fv(v) { const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K'; if (a >= 100) return v.toFixed(0); if (a >= 1) return v.toFixed(1); return v.toFixed(2); }
  function sfv(v) { return (v >= 0 ? '+' : '−') + fv(Math.abs(v)); }

  function visibles(L) {
    const cs = (st.agg && st.agg.candles) || []; if (!cs.length) return [];
    const n = Math.max(1, Math.floor(L.main.w / st.colW));
    const maxLeft = Math.max(0, cs.length - n);
    if (st.anclaDer) st.leftF = maxLeft;
    st.leftF = Math.max(0, Math.min(maxLeft, st.leftF));
    const out = [];
    for (let i = Math.floor(st.leftF); i < cs.length; i++) { const x = L.main.x + (i - st.leftF) * st.colW; if (x > L.main.w) break; out.push({ c: cs[i], x, i }); }
    return out;
  }
  function rango(vis) {
    let lo = Infinity, hi = -Infinity;
    for (const { c } of vis) { if (c.lo < lo) lo = c.lo; if (c.hi > hi) hi = c.hi; }
    if (st.meta && st.meta.last > 0) { if (st.meta.last < lo) lo = st.meta.last; if (st.meta.last > hi) hi = st.meta.last; }
    if (!isFinite(lo) || !isFinite(hi) || hi <= lo) { lo = 0; hi = 1; }
    const pad = (hi - lo) * 0.07 || 1; st.pMin = lo - pad; st.pMax = hi + pad;
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
    if (!st.agg || !st.agg.candles || !st.agg.candles.length) { ctx.fillStyle = C.dim; ctx.font = '13px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText('Waiting for order flow…', st.W / 2, st.H / 2); ctx.textAlign = 'left'; return; }
    const vis = visibles(L); rango(vis);
    ejeP(L); cols(L, vis); absorcion(L, vis);
    statFooter(L, vis); cvdPanel(L, vis); ejeT(L, vis); if (st.hover) cruz(L);
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
    const texto = st.colW >= 70 && rowH >= 9;
    const lastT = st.agg.candles[st.agg.candles.length - 1].t;
    ctx.textBaseline = 'middle';
    for (const { c, x } of vis) {
      const cx = x + st.colW / 2, bin2 = bin;
      let cMax = 1; for (const l of c.niveles) { if (l.buy > cMax) cMax = l.buy; if (l.sell > cMax) cMax = l.sell; }
      if (c.t === lastT) {
        ctx.save(); ctx.globalAlpha = .05 + st.pulse * .09; ctx.fillStyle = C.poc; ctx.fillRect(x, A.y, st.colW, A.h); ctx.restore();
        if (st.pulse > 0 && st.meta && st.meta.last > 0) { const py = yP(st.meta.last, A), rr = 5 + (1 - st.pulse) * 16; ctx.save(); ctx.globalAlpha = st.pulse * .55; ctx.strokeStyle = C.poc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, py, rr, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      }
      const imb = new Set((c.imbalances || []).map((i) => Math.round(i.price / bin2) + i.side));
      // Value area (sombra)
      const va = valueArea(c);
      if (va && isFinite(va.lo)) { const y1 = yP(va.hi, A) - rowH / 2, y2 = yP(va.lo, A) + rowH / 2; ctx.fillStyle = C.va; ctx.fillRect(x + 1, y1, st.colW - 2, Math.max(1, y2 - y1)); }

      // ── celdas ──
      for (const lv of c.niveles) {
        const y = yP(lv.price, A) - rowH / 2, k = Math.round(lv.price / bin2);
        if (st.mode === 'delta') {
          const d = lv.buy - lv.sell, inten = Math.min(1, Math.abs(d) / maxV);
          ctx.fillStyle = d >= 0 ? `rgba(38,194,129,${0.1 + inten * 0.62})` : `rgba(232,68,93,${0.1 + inten * 0.62})`;
          ctx.fillRect(x + 2, y, st.colW - 4, Math.max(1, rowH - 1));
          if (texto && rowH >= 11) { ctx.fillStyle = inten > 0.5 ? '#07130c' : C.txt; ctx.font = '10px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillText(sfv(d), cx, y + rowH / 2); }
        } else if (st.mode === 'profile') {
          const wB = (lv.buy / cMax) * (st.colW / 2 - 5), wS = (lv.sell / cMax) * (st.colW / 2 - 5);
          ctx.fillStyle = 'rgba(232,68,93,.62)'; ctx.fillRect(cx - wS, y, Math.max(0, wS), Math.max(1.5, rowH - 1));
          ctx.fillStyle = 'rgba(38,194,129,.62)'; ctx.fillRect(cx, y, Math.max(0, wB), Math.max(1.5, rowH - 1));
        } else {
          const iS = Math.min(1, lv.sell / maxV), iB = Math.min(1, lv.buy / maxV);
          ctx.fillStyle = `rgba(232,68,93,${0.08 + iS * 0.5})`; ctx.fillRect(x + 2, y, st.colW / 2 - 2, Math.max(1, rowH - 1));
          ctx.fillStyle = `rgba(38,194,129,${0.08 + iB * 0.5})`; ctx.fillRect(cx, y, st.colW / 2 - 2, Math.max(1, rowH - 1));
          if (imb.has(k + 'buy')) { ctx.strokeStyle = C.imbBuy; ctx.lineWidth = 1.5; ctx.strokeRect(cx + .5, y + .5, st.colW / 2 - 3, Math.max(1, rowH - 2)); }
          if (imb.has(k + 'sell')) { ctx.strokeStyle = C.imbSell; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2.5, y + .5, st.colW / 2 - 3, Math.max(1, rowH - 2)); }
          if (texto) { ctx.font = '10px ui-monospace,monospace'; ctx.fillStyle = C.sellTx; ctx.textAlign = 'right'; ctx.fillText(fv(lv.sell), cx - 4, y + rowH / 2); ctx.fillStyle = C.buyTx; ctx.textAlign = 'left'; ctx.fillText(fv(lv.buy), cx + 4, y + rowH / 2); }
        }
      }
      // ── POC (celda marcada) ──
      if (c.poc != null) { const yp = yP(c.poc, A) - rowH / 2; ctx.strokeStyle = C.poc; ctx.lineWidth = 1.6; ctx.strokeRect(x + 1.5, yp - .5, st.colW - 3, Math.max(2, rowH)); }
      // ── cuerpo OHLC de la vela, fino en el centro ──
      dibujarVela(c, cx, A);
      ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + st.colW - .5, A.y); ctx.lineTo(x + st.colW - .5, A.y + A.h); ctx.stroke();
    }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  function dibujarVela(c, cx, A) {
    const o = c.o != null ? c.o : c.c, cl = c.c != null ? c.c : o;
    const sube = cl >= o, col = sube ? C.up : C.down;
    const yH = yP(c.h, A), yL = yP(c.l, A), yO = yP(o, A), yC = yP(cl, A);
    const bw = Math.max(2, Math.min(9, st.colW * 0.1));
    ctx.strokeStyle = col; ctx.globalAlpha = .55; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx, yH); ctx.lineTo(cx, yL); ctx.stroke();            // mecha
    ctx.globalAlpha = .5; ctx.fillStyle = col;
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

  function absorcion(L, vis) {
    const A = L.main; for (const a of (st.agg.absorciones || [])) { const v = vis.find((x) => x.c.t === a.t); if (!v || a.price == null) continue; const x = v.x + st.colW / 2, y = yP(a.price, A); ctx.fillStyle = a.side === 'buy' ? C.sell : C.buy; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#0a0e14'; ctx.lineWidth = 1.5; ctx.stroke(); } }

  // TABLA POR VELA: delta coloreado + volumen + flecha de quién gana la vela
  function statFooter(L, vis) {
    const A = L.foot;
    ctx.fillStyle = 'rgba(255,255,255,.015)'; ctx.fillRect(A.x, A.y, A.w, A.h);
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(0, A.y + .5); ctx.lineTo(A.w, A.y + .5); ctx.stroke();
    ctx.fillStyle = C.dim; ctx.font = '8px ui-monospace,monospace'; ctx.textAlign = 'left';
    ctx.fillText('Δ DELTA', 5, A.y + 10); ctx.fillText('VOL', 5, A.y + A.h - 6);
    let maxD = 1; for (const { c } of vis) maxD = Math.max(maxD, Math.abs(c.delta));
    const texto = st.colW >= 60;
    for (const { c, x } of vis) {
      const gana = c.delta >= 0, col = gana ? C.up : C.down, cx = x + st.colW / 2;
      // barra de fondo tenue segun quien gana
      ctx.fillStyle = gana ? 'rgba(38,194,129,.09)' : 'rgba(232,68,93,.09)'; ctx.fillRect(x + 1, A.y + 2, st.colW - 2, A.h - 4);
      // flecha
      ctx.fillStyle = col; ctx.font = '700 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(gana ? '▲' : '▼', cx, A.y + 13);
      if (texto) {
        const pct = c.total > 0 ? (c.delta / c.total) * 100 : 0;
        ctx.font = '700 10px ui-monospace,monospace'; ctx.fillStyle = col; ctx.fillText(sfv(c.delta), cx, A.y + 27);
        ctx.font = '9px ui-monospace,monospace'; ctx.fillStyle = C.dim; ctx.fillText(fv(c.total) + '  ' + (pct >= 0 ? '+' : '−') + Math.abs(pct).toFixed(0) + '%', cx, A.y + A.h - 7);
      } else { const hh = (Math.abs(c.delta) / maxD) * (A.h - 16); ctx.fillStyle = col; ctx.fillRect(x + 3, A.y + A.h - 4 - hh, st.colW - 6, hh); }
      ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.beginPath(); ctx.moveTo(x + st.colW - .5, A.y); ctx.lineTo(x + st.colW - .5, A.y + A.h); ctx.stroke();
    }
    ctx.textAlign = 'left';
  }

  function cvdPanel(L, vis) {
    const A = L.cvd;
    ctx.fillStyle = 'rgba(255,255,255,.02)'; ctx.fillRect(A.x, A.y, A.w, A.h);
    ctx.fillStyle = C.dim; ctx.font = '8px ui-monospace,monospace'; ctx.fillText('CVD · cumulative delta', 5, A.y + 10);
    if (!vis.length) return;
    const map = new Map((st.agg.cvd || []).map((p) => [p.t, p.v]));
    const pts = vis.map(({ c, x }) => ({ x: x + st.colW / 2, v: map.has(c.t) ? map.get(c.t) : 0, t: c.t }));
    let lo = Infinity, hi = -Infinity; for (const p of pts) { if (p.v < lo) lo = p.v; if (p.v > hi) hi = p.v; } if (!isFinite(lo) || hi === lo) { lo -= 1; hi += 1; }
    const yv = (v) => A.y + 14 + (hi - v) / (hi - lo) * (A.h - 20);
    ctx.strokeStyle = C.cvd; ctx.lineWidth = 1.6; ctx.beginPath(); pts.forEach((p, i) => { const y = yv(p.v); i ? ctx.lineTo(p.x, y) : ctx.moveTo(p.x, y); }); ctx.stroke();
    ctx.lineTo(pts[pts.length - 1].x, A.y + A.h); ctx.lineTo(pts[0].x, A.y + A.h); ctx.closePath(); ctx.fillStyle = 'rgba(142,162,255,.08)'; ctx.fill();
    if (0 >= lo && 0 <= hi) { const yz = yv(0); ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(0, yz + .5); ctx.lineTo(A.w, yz + .5); ctx.stroke(); ctx.setLineDash([]); }
    const cur = pts[pts.length - 1]; if (cur) { ctx.fillStyle = cur.v >= 0 ? C.buy : C.sell; ctx.font = '700 10px ui-monospace,monospace'; ctx.textAlign = 'right'; ctx.fillText('CVD ' + sfv(cur.v), A.w - 6, A.y + 11); ctx.textAlign = 'left'; }
    for (const d of (st.agg.divergences || [])) { const p = pts.find((q) => q.t === d.t); if (!p) continue; const y = yv(p.v); ctx.fillStyle = d.kind === 'bull' ? C.buy : C.sell; ctx.font = '700 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(d.kind === 'bull' ? '▲' : '▼', p.x, y + (d.kind === 'bull' ? 15 : -5)); ctx.textAlign = 'left'; }
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
    if (st.drag) { const dx = mx - st.drag.mx; const cs = st.agg ? st.agg.candles.length : 0; const n = Math.max(1, Math.floor((st.W - GUT) / st.colW)); const maxLeft = Math.max(0, cs - n); st.leftF = Math.max(0, Math.min(maxLeft, st.drag.left - dx / st.colW)); st.anclaDer = (st.leftF >= maxLeft - 0.001); }
    onHover(hit(mx, my), e.clientX, e.clientY); render();
  });
  cv.addEventListener('mouseleave', () => { st.hover = null; onHover(null); render(); });
  cv.addEventListener('mousedown', (e) => { const r = cv.getBoundingClientRect(); st.drag = { mx: e.clientX - r.left, left: st.leftF }; });
  window.addEventListener('mouseup', () => { st.drag = null; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); st.colW = Math.max(26, Math.min(260, st.colW * (e.deltaY < 0 ? 1.15 : 0.87))); render(); }, { passive: false });

  function setData(agg, meta) {
    st.agg = agg; if (meta) st.meta = meta;
    const cs = agg && agg.candles; const lt = cs && cs.length ? cs[cs.length - 1].total : 0;
    if (st.prevLastTotal >= 0 && lt > st.prevLastTotal + 1e-9) pulsar();   // llegó volumen → pulso en vivo
    st.prevLastTotal = lt; render();
  }
  function setMeta(meta) { st.meta = Object.assign(st.meta || {}, meta); render(); }
  function setMode(m) { st.mode = m; render(); }
  function getMode() { return st.mode; }
  function resetView() { st.anclaDer = true; st.colW = 92; render(); }
  function snapshot() { return cv; }
  function destroy() { try { host.removeChild(cv); } catch (_) {} }

  return { setData, setMeta, setMode, getMode, resetView, resize, render, snapshot, destroy };
}
