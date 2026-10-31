/* modules/reaction/motor.js — Motor de "Reaction Zones".

   Transpone, fielmente y sin placeholders, la lógica de detección de niveles
   donde el precio reacciona (pivotes estructurales + motor de presión de
   ruptura). Es una reescritura propia en JavaScript de una idea de análisis de
   pivotes/presión: el código, los nombres, la estructura de datos y el render
   son nuestros; aquí vive SOLO la matemática de detección, idéntica en
   comportamiento (pivote → semilla → nivel → presión → ruptura → retest).

   Entrada: velas [{t,o,h,l,c,v}] (t en segundos). Salida: el estado actual de
   niveles vivos / rotos / triángulos de ruptura, que el render dibuja.

   CONVENCIÓN DE COLOR (invertida respecto al original, a propósito):
     · nivel SUPERIOR  (resistencia) → ROJO  → zona de SHORT
     · nivel INFERIOR  (soporte)     → VERDE → zona de LONG
   El motor no pinta: solo marca upper=true/false; el render decide el color. */

// ── Parámetros (equivalentes a los inputs del indicador) ──
const PIV = 20;            // confirmación de pivote (izq/der)
const MATCH_PCT = 0.90;    // % de distancia máx. entre dos pivotes del mismo lado
const GAP_MIN = 2;         // mínimo de barras entre las dos confirmaciones
const MAX_UNBROKEN = 600;  // barras máx. que un nivel vive sin romperse
const ZONE_ATR = 1.12;     // profundidad de la zona (en ATR)
const PRESSURE_SPEED = 1;  // sensibilidad de la presión de ruptura
const BREAK_MODE = 'Wick'; // 'Wick' | 'Close'
const BREAK_ATR = 0.05;    // colchón ATR antes de considerar rota
// Constantes internas
const SEED_MAX = 120, LIVE_MAX = 40, DEAD_MAX = 50, VOL_LEN = 20, ABS_RAD = 2;

const clip = (x) => Math.max(0, Math.min(1, x));
const MINTICK = 1e-8;

function atrArr(V, n = 14) {
  const out = new Array(V.length).fill(0);
  let prev = null;
  for (let i = 0; i < V.length; i++) {
    const tr = i === 0 ? (V[i].h - V[i].l) : Math.max(V[i].h - V[i].l, Math.abs(V[i].h - V[i - 1].c), Math.abs(V[i].l - V[i - 1].c));
    prev = prev === null ? tr : (prev * (n - 1) + tr) / n;
    out[i] = prev;
  }
  return out;
}
function smaVol(V, n) {
  const out = new Array(V.length).fill(0);
  let s = 0;
  for (let i = 0; i < V.length; i++) { s += V[i].v; if (i >= n) s -= V[i - n].v; out[i] = s / Math.min(i + 1, n); }
  return out;
}
// Pivote alto confirmado en la barra `conf`: el máximo de V[conf-PIV] domina ±PIV
function esPivHigh(V, k) {
  if (k - PIV < 0 || k + PIV >= V.length) return false;
  const p = V[k].h;
  for (let j = k - PIV; j <= k + PIV; j++) if (j !== k && V[j].h > p) return false;
  return true;
}
function esPivLow(V, k) {
  if (k - PIV < 0 || k + PIV >= V.length) return false;
  const p = V[k].l;
  for (let j = k - PIV; j <= k + PIV; j++) if (j !== k && V[j].l < p) return false;
  return true;
}

function zoneBounds(upper, p, d) { return upper ? [p, p - d] : [p + d, p]; }   // [zTop, zBot]
const rings = (score) => score >= 82 ? 4 : score >= 66 ? 3 : score >= 50 ? 2 : 1;
const touchRings = (rv) => rv >= 2.20 ? 4 : rv >= 1.45 ? 3 : rv >= 1.00 ? 2 : 1;

function pivotFeatures(V, avg, i, off) {
  const at = (j) => V[i - j];
  const pv = Math.max(at(off).v, 0);
  const vb = Math.max(avg[i - off] || pv, 1);
  const vq = clip((pv / vb - 0.8) / 1.7);
  const rad = Math.min(ABS_RAD, off);
  let dNum = 0, dDen = 0, aq = 0;
  for (let n = 0; n <= rad * 2; n++) {
    const o = off - rad + n;
    const idx = i - o; if (idx < 1 || idx >= V.length) continue;
    const c = V[idx];
    const barRange = Math.max(c.h - c.l, MINTICK);
    const v = Math.max(c.v, 0);
    const pos = clip((c.c - c.l) / barRange);
    dNum += v * (pos * 2 - 1); dDen += v;
    const base = Math.max(avg[idx] || v, 1);
    const rv = v / base;
    const body = Math.abs(c.c - c.o) / barRange;
    aq = Math.max(aq, clip((rv - 1) / 1) * clip((0.45 - body) / 0.45));
  }
  const dl = dDen > 0 ? dNum / dDen : 0;
  return [vq, Math.abs(dl), aq, dl];
}

/* Procesa TODA la historia bar-a-bar (como el indicador) y devuelve el estado
   actual: niveles vivos, rotos y triángulos de ruptura. */
export function detectarReaction(velas) {
  const V = velas || [];
  const n = V.length;
  if (n < PIV * 2 + 5) return { live: [], dead: [], triangles: [] };
  const atr = atrArr(V, 14);
  const avg = smaVol(V, VOL_LEN);

  const upSeeds = [], dnSeeds = [], live = [], dead = [], triangles = [];
  let nextId = 1;

  const prune = (upper, arr, i) => {
    for (let k = arr.length - 1; k >= 0; k--) {
      const s = arr[k];
      const tol = s.p * MATCH_PCT * 0.01;
      const invalid = upper ? V[i].h > s.p + tol : V[i].l < s.p - tol;
      if (invalid) arr.splice(k, 1);
    }
  };
  const findLive = (upper, p) => {
    let id = -1, best = 1e20;
    for (let k = 0; k < live.length; k++) {
      const lv = live[k]; if (lv.upper !== upper) continue;
      const d = Math.abs(p - lv.p), tol = lv.p * MATCH_PCT * 0.01;
      if (d <= tol && d < best) { best = d; id = k; if (d === 0) break; }
    }
    return id;
  };
  const makeLvl = (upper, anchor, anchorBar, pivBar, seedBar, atrP, matchQ, vq, dq, aq, formDelta) => {
    const quality = clip(0.42 * matchQ + 0.20 * vq + 0.18 * dq + 0.20 * aq);
    const pressure = clip(0.28 + 0.58 * quality);
    const depth = Math.max(atrP * ZONE_ATR, MINTICK * 2);
    live.push({ id: nextId++, p: anchor, depth, quality, pressure, attackRv: 1, attackDelta: upper ? formDelta : -formDelta, confirms: 2, touches: 0, bornBar: pivBar, anchorBar, pairStartBar: seedBar, upper, inZone: false, lastTouchBar: -1, touchRv: 0, touchBars: [] });
    while (live.length > LIVE_MAX) live.shift();
  };
  const reconfirm = (id, p, pivBar, vq, dq, aq, dl) => {
    const lv = live[id];
    const tol = Math.max(lv.p * MATCH_PCT * 0.01, MINTICK);
    const closeQ = clip(1 - Math.abs(p - lv.p) / tol);
    const featureQ = clip(0.40 * closeQ + 0.20 * vq + 0.18 * dq + 0.22 * aq);
    lv.quality = clip(lv.quality * 0.76 + featureQ * 0.24);
    lv.pressure = clip(lv.pressure + 0.05 + 0.07 * closeQ);
    lv.attackDelta = lv.attackDelta * 0.75 + (lv.upper ? dl : -dl) * 0.25;
    lv.confirms += 1;
    lv.lastTouchBar = pivBar; lv.touchRv = 1.45;
    (lv.touchBars = lv.touchBars || []).push({ bar: pivBar, rv: 1.45 });
    while (lv.touchBars.length > 24) lv.touchBars.shift();
  };
  const registerLvl = (seeds, upper, p, pivBar, atrP, vq, dq, aq, dl) => {
    const liveId = findLive(upper, p);
    if (liveId >= 0) { reconfirm(liveId, p, pivBar, vq, dq, aq, dl); return; }
    let pick = -1, best = 1e20;
    for (let k = 0; k < seeds.length; k++) {
      const s = seeds[k], tol = s.p * MATCH_PCT * 0.01, dist = Math.abs(p - s.p);
      if (dist <= tol && pivBar - s.b >= GAP_MIN && dist < best) { best = dist; pick = k; if (dist === 0) break; }
    }
    if (pick === -1) {
      seeds.push({ p, b: pivBar, vq, dq, aq, dl });
      while (seeds.length > SEED_MAX) seeds.shift();
    } else {
      const s = seeds[pick];
      const tol = Math.max(s.p * MATCH_PCT * 0.01, MINTICK);
      const matchQ = clip(1 - Math.abs(p - s.p) / tol);
      const anchor = upper ? Math.max(s.p, p) : Math.min(s.p, p);
      const anchorBar = upper ? (p > s.p ? pivBar : s.b) : (p < s.p ? pivBar : s.b);
      const cvq = (s.vq + vq) * 0.5, cdq = (s.dq + dq) * 0.5, caq = Math.max(s.aq, aq), cdl = (s.dl + dl) * 0.5;
      makeLvl(upper, anchor, anchorBar, pivBar, s.b, atrP, matchQ, cvq, cdq, caq, cdl);
      seeds.splice(pick, 1);
    }
  };
  const isBreak = (lv, i, atrNow) => {
    const pad = Math.max(atrNow * BREAK_ATR, 0);
    return BREAK_MODE === 'Close'
      ? (lv.upper ? V[i].c > lv.p + pad : V[i].c < lv.p - pad)
      : (lv.upper ? V[i].h > lv.p + pad : V[i].l < lv.p - pad);
  };

  for (let i = 0; i < n; i++) {
    const atrNow = Math.max(atr[i], MINTICK);
    // 1) prune seeds
    prune(true, upSeeds, i); prune(false, dnSeeds, i);
    // 2) manage live (presión / ruptura / caducidad)
    if (live.length > 0) {
      const volBase = Math.max(avg[i] || V[i].v, 1);
      const relVol = Math.max(V[i].v, 0) / volBase;
      const barRange = Math.max(V[i].h - V[i].l, MINTICK);
      const closePos = clip((V[i].c - V[i].l) / barRange);
      const barDelta = closePos * 2 - 1;
      const bodyFrac = Math.abs(V[i].c - V[i].o) / barRange;
      const absorption = clip((relVol - 0.9) / 1.2) * clip((0.55 - bodyFrac) / 0.55);
      const compression = clip(1 - barRange / atrNow);
      const cPrev = i > 0 ? V[i - 1].c : V[i].c;
      const upApproach = clip(Math.max(V[i].c - cPrev, 0) / atrNow);
      const dnApproach = clip(Math.max(cPrev - V[i].c, 0) / atrNow);
      const upDP = clip(Math.max(barDelta, 0) * relVol / 2);
      const dnDP = clip(Math.max(-barDelta, 0) * relVol / 2);
      for (let k = live.length - 1; k >= 0; k--) {
        const lv = live[k];
        if (isBreak(lv, i, atrNow)) {
          lv.breakBar = i; lv.retested = false;
          live.splice(k, 1); dead.push(lv); while (dead.length > DEAD_MAX) dead.shift();
          if (lv.upper) triangles.push({ bar: i, up: true, price: Math.min(...sliceLow(V, i, 5)) });
          else triangles.push({ bar: i, up: false, price: Math.max(...sliceHigh(V, i, 5)) });
        } else if (i - lv.bornBar >= MAX_UNBROKEN) {
          live.splice(k, 1);
        } else {
          const [zTop, zBot] = zoneBounds(lv.upper, lv.p, lv.depth);
          const inside = V[i].h >= zBot && V[i].l <= zTop;
          const fresh = inside && !lv.inZone && i > lv.bornBar;
          const proximity = clip(1 - Math.abs(V[i].c - lv.p) / (atrNow * 1.5));
          const approach = lv.upper ? upApproach : dnApproach;
          const deltaP = lv.upper ? upDP : dnDP;
          const load = proximity * (0.30 * approach + 0.26 * deltaP + 0.22 * absorption + 0.10 * compression) + (fresh ? 0.12 : 0);
          const decay = proximity < 0.15 ? 0.990 : 0.997;
          lv.pressure = clip(lv.pressure * decay + load * 0.10 * PRESSURE_SPEED);
          lv.inZone = inside;
          if (proximity > 0.35) {
            lv.attackRv = lv.attackRv * 0.85 + relVol * 0.15;
            lv.attackDelta = lv.attackDelta * 0.85 + (lv.upper ? barDelta : -barDelta) * 0.15;
          }
          if (fresh) { lv.touches += 1; lv.lastTouchBar = i; lv.touchRv = relVol; (lv.touchBars = lv.touchBars || []).push({ bar: i, rv: relVol }); while (lv.touchBars.length > 24) lv.touchBars.shift(); }
        }
      }
    }
    // 3) retests sobre niveles rotos
    for (const lv of dead) {
      if (!lv.retested && i > (lv.breakBar || 0)) {
        const retest = lv.upper ? (V[i].l <= lv.p && V[i].c > lv.p) : (V[i].h >= lv.p && V[i].c < lv.p);
        if (retest) { lv.retested = true; lv.retestBar = i; }
      }
    }
    // 4) pivotes confirmados en esta barra
    const kH = i - PIV;
    if (kH >= 0 && esPivHigh(V, kH)) {
      const [vq, dq, aq, dl] = pivotFeatures(V, avg, i, PIV);
      registerLvl(upSeeds, true, V[kH].h, kH, Math.max(atr[kH] || atrNow, MINTICK), vq, dq, aq, dl);
    }
    if (kH >= 0 && esPivLow(V, kH)) {
      const [vq, dq, aq, dl] = pivotFeatures(V, avg, i, PIV);
      registerLvl(dnSeeds, false, V[kH].l, kH, Math.max(atr[kH] || atrNow, MINTICK), vq, dq, aq, dl);
    }
  }

  live.forEach((lv) => { lv.score = lv.pressure * 100; lv.ringN = rings(lv.score); lv.touchN = touchRings(lv.touchRv || 1); });
  dead.forEach((lv) => { lv.score = lv.pressure * 100; });
  return { live, dead, triangles };
}

function sliceLow(V, i, n) { const a = []; for (let k = Math.max(0, i - n + 1); k <= i; k++) a.push(V[k].l); return a.length ? a : [V[i].l]; }
function sliceHigh(V, i, n) { const a = []; for (let k = Math.max(0, i - n + 1); k <= i; k++) a.push(V[k].h); return a.length ? a : [V[i].h]; }

export { rings, touchRings, zoneBounds };
