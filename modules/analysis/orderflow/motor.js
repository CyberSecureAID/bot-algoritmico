/* ══════════════════════════════════════════════════════════════
   orderflow/motor.js — Logica del order flow (sin pintar nada).

   - Vela en vivo: acumula el tape real operacion a operacion.
   - Historia: footprint anclado a los totales REALES de cada kline
     (volumen y delta reales), repartido por nivel de precio. Cuando
     haya un backend de ticks se sustituye por el reparto exacto.
   - Imbalances diagonales, area de valor y POC.
   - Metricas del libro real: OBI, VPIN y una heuristica de SPOOF.
   ══════════════════════════════════════════════════════════════ */

const RATIO_IMB = 3;              // imbalance: un lado >= 3x el opuesto diagonal

/* PRNG estable por semilla (para que el reparto modelado no parpadee). */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gss = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s));
const nivel = (p, tick) => Math.round(p / tick) * tick;

/* ---- Vela en vivo: estructura y acumulacion del tape real ---- */
export function velaViva(t, precio) {
  return { t, o: precio, h: precio, l: precio, c: precio, vol: 0, buy: 0, sell: 0, delta: 0, cerrada: false, mapa: new Map() };
}
export function acumular(v, tr, tick) {
  const lv = nivel(tr.p, tick);
  const e = v.mapa.get(lv) || { bid: 0, ask: 0 };
  if (tr.venta) { e.bid += tr.q; v.sell += tr.q; } else { e.ask += tr.q; v.buy += tr.q; }
  v.mapa.set(lv, e);
  v.c = tr.p; if (tr.p > v.h) v.h = tr.p; if (tr.p < v.l) v.l = tr.p;
  v.vol = v.buy + v.sell; v.delta = v.buy - v.sell;
}
function filasVivas(v) {
  const out = [];
  for (const [p, e] of v.mapa) out.push({ p, bid: e.bid, ask: e.ask, tot: e.bid + e.ask });
  out.sort((a, b) => a.p - b.p);
  return out;
}

/* ---- Footprint modelado para historia (anclado a kline real) ---- */
function filasModeladas(v, tick) {
  const rLo = Math.round(v.l / tick) * tick, rHi = Math.round(v.h / tick) * tick;
  const rnd = rng((v.t / 3600000) | 0);
  const pocP = v.o + (v.c - v.o) * (0.45 + rnd() * 0.25);
  const sigma = Math.max(tick * 1.5, (v.h - v.l) / 3.4);
  const up = v.c >= v.o;
  const niveles = [];
  let suma = 0;
  for (let p = rLo; p <= rHi + 1e-9; p += tick) {
    const w = gss(p, pocP, sigma) * (0.55 + rnd() * 0.9) + 0.04;
    niveles.push({ p, w }); suma += w;
  }
  const vol = v.vol || 1, buyFracG = v.vol ? v.buy / v.vol : 0.5;
  const filas = [];
  niveles.forEach((n) => {
    const lv = (vol * n.w) / suma;
    const pos = (v.h === v.l) ? 0.5 : (n.p - v.l) / (v.h - v.l);
    // sesgo: en vela alcista compran mas abajo, en bajista venden mas arriba
    const sesgo = up ? (0.5 - pos) * 0.5 : (pos - 0.5) * 0.5;
    const bf = Math.max(0.08, Math.min(0.92, buyFracG + sesgo + (rnd() - 0.5) * 0.18));
    const ask = Math.round(lv * bf), bid = Math.round(lv * (1 - bf));
    filas.push({ p: n.p, bid, ask, tot: bid + ask });
  });
  return filas;
}

/* Filas de una vela (vivas si tiene tape, modeladas si es historia pura). */
export function filasDe(v, tick) {
  if (v.mapa && v.mapa.size > 2) return filasVivas(v);
  return filasModeladas(v, tick);
}

/* ---- Analitica de una vela: POC, area de valor, maximo, imbalances ---- */
export function analizar(filas, tick) {
  let maxV = 0, poc = filas.length ? filas[0].p : 0;
  const byP = {};
  filas.forEach((r) => { byP[r.p] = r; if (r.tot > maxV) { maxV = r.tot; poc = r.p; } });
  // area de valor: 70% del volumen alrededor del POC
  const vol = filas.reduce((s, r) => s + r.tot, 0);
  const orden = [...filas].sort((a, b) => b.tot - a.tot);
  let acc = 0, vaLo = poc, vaHi = poc;
  for (const r of orden) { acc += r.tot; if (r.p < vaLo) vaLo = r.p; if (r.p > vaHi) vaHi = r.p; if (acc >= vol * 0.7) break; }
  // imbalances diagonales
  const maxSide = Math.max(1, ...filas.map((r) => Math.max(r.bid, r.ask)));
  filas.forEach((r) => {
    const ab = byP[r.p - tick], ar = byP[r.p + tick];
    r._buy = ab && r.ask >= RATIO_IMB * Math.max(1, ab.bid) && r.ask > maxSide * 0.1;
    r._sell = ar && r.bid >= RATIO_IMB * Math.max(1, ar.ask) && r.bid > maxSide * 0.1;
  });
  return { maxV, poc, vaLo, vaHi, vol };
}

/* ---- Metricas del libro real + tape reciente ----
   bids/asks: [[precio, tamano_base], ...] (depth20)
   tape: operaciones recientes [{q, venta}] (ventana rodante en el main)  */
export function metricasLibro(bids, asks, tape) {
  const sum = (arr) => arr.reduce((s, x) => s + x[1], 0);
  const bq = sum(bids), aq = sum(asks), tot = bq + aq;
  const obi = tot ? (bq / tot) * 100 : 50;                       // order book imbalance real
  // VPIN: desequilibrio |compra-venta| / volumen en la ventana reciente
  let vb = 0, vs = 0;
  for (const t of tape) { if (t.venta) vs += t.q; else vb += t.q; }
  const vv = vb + vs;
  const vpin = vv ? (Math.abs(vb - vs) / vv) * 100 : 0;
  const net = vb - vs;                                           // delta neto de la ventana
  // SPOOF (heuristica): cuanto sobresale el muro mayor sobre el tamano tipico del libro
  const sizes = bids.concat(asks).map((x) => x[1]).sort((a, b) => a - b);
  const med = sizes.length ? sizes[sizes.length >> 1] : 0;
  const maxW = sizes.length ? sizes[sizes.length - 1] : 0;
  const spoof = med > 0 ? Math.max(0, Math.min(100, (maxW / med - 1) * 14)) : 0;
  return { obi, vpin, net, spoof };
}
