/* modules/footprint/motor.worker.js — Web Worker de agregación de Footprint Pro.

   Recibe trades crudos + velas y devuelve la estructura lista para pintar:
   footprint por vela (volumen comprador x vendedor por nivel de precio), POC,
   delta, CVD, imbalances diagonales apilados, divergencias y absorción.

   Worker CLÁSICO (sin imports): cálculo puro, universal en todos los navegadores.
   Nada de red aquí: solo matemática sobre lo que le pasa el hilo principal. */

'use strict';

/* Índice de bin de un precio (nivel discreto). */
function binIdx(p, bin) { return Math.round(p / bin); }

/* Elige un tamaño de bin "bonito" a partir del rango y el tick real del par. */
function autoBin(lo, hi, tick) {
  const rango = Math.max(1e-9, hi - lo);
  let b = rango / 100;                       // ~100 niveles visibles de salida
  if (tick > 0) b = Math.max(b, tick);       // nunca por debajo del tick real
  // redondear a 1/2/5 x 10^n
  const e = Math.pow(10, Math.floor(Math.log10(b)));
  const m = b / e;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return nice * e;
}

function construir(msg) {
  const velas = msg.velas || [];
  const trades = msg.trades || [];
  const tfMs = msg.tfMs || 60000;
  const imbR = (msg.imbThreshold || 300) / 100;     // 300% → ratio 3
  if (!velas.length) return { ok: true, candles: [], cvd: [], divergences: [], absorciones: [], stacked: [], binSize: 0, maxCellVol: 0 };

  const base = velas[0].t;
  let globLo = Infinity, globHi = -Infinity;
  for (const v of velas) { if (v.l < globLo) globLo = v.l; if (v.h > globHi) globHi = v.h; }
  for (const t of trades) { if (t.p < globLo) globLo = t.p; if (t.p > globHi) globHi = t.p; }
  if (!isFinite(globLo) || !isFinite(globHi)) { globLo = 0; globHi = 1; }

  let bin = msg.binSize > 0 ? msg.binSize : autoBin(globLo, globHi, msg.tick || 0);
  if (!(bin > 0)) bin = 1;

  // Mapa de velas por tiempo de apertura; se crean columnas nuevas si llegan
  // trades más allá de la última vela (vela en formación / en vivo).
  const porT = new Map();
  const orden = [];
  const nueva = (t, seed) => {
    const c = { t, o: seed ? seed.o : null, h: seed ? seed.h : -Infinity, l: seed ? seed.l : Infinity, c: seed ? seed.c : null, niveles: new Map(), buyTot: 0, sellTot: 0 };
    porT.set(t, c); orden.push(t); return c;
  };
  for (const v of velas) nueva(v.t, v);

  const openDe = (t) => base + Math.floor((t - base) / tfMs) * tfMs;

  for (const tr of trades) {
    if (tr.t < base) continue;
    const ot = openDe(tr.t);
    let c = porT.get(ot);
    if (!c) c = nueva(ot, null);
    const k = binIdx(tr.p, bin);
    let lv = c.niveles.get(k);
    if (!lv) { lv = { buy: 0, sell: 0 }; c.niveles.set(k, lv); }
    if (tr.buy) { lv.buy += tr.q; c.buyTot += tr.q; } else { lv.sell += tr.q; c.sellTot += tr.q; }
    if (c.o == null) c.o = tr.p;
    c.c = tr.p;
    if (tr.p > c.h) c.h = tr.p;
    if (tr.p < c.l) c.l = tr.p;
  }

  orden.sort((a, b) => a - b);

  // Construcción final por vela + métricas
  let maxCellVol = 0;
  const candles = [];
  for (const t of orden) {
    const c = porT.get(t);
    const niveles = [];
    let poc = null, pocVol = -1, delta = 0, total = 0;
    for (const [k, lv] of c.niveles) {
      const price = k * bin;
      const vol = lv.buy + lv.sell;
      delta += lv.buy - lv.sell;
      total += vol;
      if (vol > pocVol) { pocVol = vol; poc = price; }
      if (lv.buy > maxCellVol) maxCellVol = lv.buy;
      if (lv.sell > maxCellVol) maxCellVol = lv.sell;
      niveles.push({ price, buy: lv.buy, sell: lv.sell });
    }
    niveles.sort((a, b) => a.price - b.price);
    const hi = niveles.length ? niveles[niveles.length - 1].price : c.h;
    const lo = niveles.length ? niveles[0].price : c.l;

    // ── Imbalances diagonales ──────────────────────────────────────────
    // Comprador: buy[nivel] vs sell[nivel-1] (una celda abajo). Vendedor:
    // sell[nivel] vs buy[nivel+1]. Si la relación supera el umbral → imbalance.
    const mapK = new Map();
    niveles.forEach((n) => mapK.set(Math.round(n.price / bin), n));
    const imbalances = [];
    for (const n of niveles) {
      const k = Math.round(n.price / bin);
      const ab = mapK.get(k - 1);                 // celda diagonal inferior (venta)
      const ar = mapK.get(k + 1);                 // celda diagonal superior (compra)
      if (ab && ab.sell > 0 && n.buy >= imbR * ab.sell) imbalances.push({ price: n.price, side: 'buy' });
      else if (n.buy > 0 && (!ab || ab.sell === 0)) imbalances.push({ price: n.price, side: 'buy' });
      if (ar && ar.buy > 0 && n.sell >= imbR * ar.buy) imbalances.push({ price: n.price, side: 'sell' });
      else if (n.sell > 0 && (!ar || ar.buy === 0)) { /* borde: no forzamos venta por defecto */ }
    }

    candles.push({ t, o: c.o, h: c.h === -Infinity ? hi : c.h, l: c.l === Infinity ? lo : c.l, c: c.c,
      niveles, poc, delta, total, buyTot: c.buyTot, sellTot: c.sellTot, hi, lo, imbalances });
  }

  // ── CVD (delta acumulado) ───────────────────────────────────────────
  const cvd = [];
  let acc = 0;
  for (const c of candles) { acc += c.delta; cvd.push({ t: c.t, v: acc }); }

  // ── Zonas de imbalance APILADAS (3+ niveles seguidos del mismo lado) ──
  // Se extienden a la derecha como soporte/resistencia.
  const stacked = [];
  for (const c of candles) {
    const buys = c.imbalances.filter((i) => i.side === 'buy').map((i) => i.price).sort((a, b) => a - b);
    const sells = c.imbalances.filter((i) => i.side === 'sell').map((i) => i.price).sort((a, b) => a - b);
    const rachas = (arr, side) => {
      let i = 0;
      while (i < arr.length) {
        let j = i;
        while (j + 1 < arr.length && Math.round(arr[j + 1] / bin) - Math.round(arr[j] / bin) === 1) j++;
        if (j - i + 1 >= 3) stacked.push({ yLo: arr[i], yHi: arr[j], side, fromT: c.t });
        i = j + 1;
      }
    };
    rachas(buys, 'buy'); rachas(sells, 'sell');
  }

  // ── Divergencias precio vs CVD (swings simples) ─────────────────────
  const divergences = [];
  const piv = (serie, getV) => {
    const out = [];
    for (let i = 2; i < serie.length - 2; i++) {
      const v = getV(serie[i]);
      const izq = getV(serie[i - 1]), izq2 = getV(serie[i - 2]);
      const der = getV(serie[i + 1]), der2 = getV(serie[i + 2]);
      if (v > izq && v > izq2 && v > der && v > der2) out.push({ i, tipo: 'hi', v });
      if (v < izq && v < izq2 && v < der && v < der2) out.push({ i, tipo: 'lo', v });
    }
    return out;
  };
  if (candles.length > 6) {
    const pPrecio = piv(candles, (c) => c.c);
    const his = pPrecio.filter((p) => p.tipo === 'hi');
    const los = pPrecio.filter((p) => p.tipo === 'lo');
    const cvdAt = (i) => (cvd[i] ? cvd[i].v : 0);
    if (his.length >= 2) {
      const a = his[his.length - 2], b = his[his.length - 1];
      if (candles[b.i].c > candles[a.i].c && cvdAt(b.i) < cvdAt(a.i)) divergences.push({ t: candles[b.i].t, kind: 'bear', price: candles[b.i].h });
    }
    if (los.length >= 2) {
      const a = los[los.length - 2], b = los[los.length - 1];
      if (candles[b.i].c < candles[a.i].c && cvdAt(b.i) > cvdAt(a.i)) divergences.push({ t: candles[b.i].t, kind: 'bull', price: candles[b.i].l });
    }
  }

  // ── Absorción: mucho volumen de un lado y el precio NO avanza ────────
  // (gran delta de un lado pero el cierre no se mueve a favor → lo absorbieron)
  const absorciones = [];
  if (candles.length) {
    const tots = candles.map((c) => c.total).filter((x) => x > 0).sort((a, b) => a - b);
    const q3 = tots.length ? tots[Math.floor(tots.length * 0.75)] : 0;
    for (const c of candles) {
      if (c.total < q3 || c.total <= 0) continue;
      const rango = Math.max(1e-9, c.h - c.l);
      const cuerpo = Math.abs((c.c || 0) - (c.o || 0));
      const estancado = cuerpo <= rango * 0.35;                 // apenas se movió
      const dRel = c.delta / Math.max(1e-9, c.total);
      if (estancado && dRel >= 0.33) absorciones.push({ t: c.t, price: c.poc, side: 'buy', strength: Math.abs(dRel) });
      else if (estancado && dRel <= -0.33) absorciones.push({ t: c.t, price: c.poc, side: 'sell', strength: Math.abs(dRel) });
    }
  }

  return { ok: true, candles, cvd, divergences, absorciones, stacked, binSize: bin, maxCellVol };
}

self.onmessage = function (ev) {
  const msg = ev.data || {};
  if (msg.type !== 'build') return;
  try {
    const r = construir(msg);
    r.reqId = msg.reqId;
    self.postMessage(r);
  } catch (e) {
    self.postMessage({ ok: false, error: String(e && e.message || e), reqId: msg.reqId });
  }
};
