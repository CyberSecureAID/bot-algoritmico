/* ══════════════════════════════════════════════════════════════
   structural/motor.js — Motor de "Structural Logic" (REVERSIÓN A LA MEDIA).

   POR QUÉ ESTE MOTOR
     Una investigación a fondo (momentum, inversión, pullback, reversión y
     un techo con machine-learning fuera de muestra) demostró que la
     DIRECCIÓN del precio a corto plazo NO es predecible (AUC≈0.50). Lo
     único con ventaja real y ALTO PORCENTAJE DE ACIERTO es la reversión a
     la media: comprar la debilidad DENTRO de una tendencia, no la fuerza.

   LÓGICA (validada en datos reales, fuera de muestra: 65–74% de aciertos)
     - Régimen por EMA200: precio por encima → solo largos; por debajo → solo cortos.
     - Gatillo RSI(2): se dispara cuando el precio entra en zona extrema
       (sobreventa en alcista, sobrecompra en bajista) — el "muelle" cargado.
     - Objetivo: la reversión a la MEDIA (SMA20). Stop: 2.5·ATR. Todo causal.
     - Una alerta por extremo (se re-arma al volver el RSI al centro).
   ══════════════════════════════════════════════════════════════ */

export const LEN = 20;             // periodo de la media (objetivo de reversión)
export const RSI_LEN = 2;          // RSI rápido (Connors) para el gatillo
export const BANDA_OS = 10;        // sobreventa (long)
export const BANDA_OB = 90;        // sobrecompra (short)
export const EMA_FILTRO = 200;     // régimen de tendencia
export const STOP_ATR = 2.5;       // stop en múltiplos de ATR
export const MAX_BARRAS = 24;      // tope de velas por operación (backtest)

/* ── ayudantes ── */
function emaArr(arr, len) {
  const n = arr.length, out = new Array(n).fill(NaN);
  if (!n) return out;
  const k = 2 / (len + 1); let e = arr[0]; out[0] = e;
  for (let i = 1; i < n; i++) { e = arr[i] * k + e * (1 - k); out[i] = e; }
  return out;
}
function smaArr(arr, len) {
  const n = arr.length, out = new Array(n).fill(NaN); let s = 0;
  for (let i = 0; i < n; i++) { s += arr[i]; if (i >= len) s -= arr[i - len]; if (i >= len - 1) out[i] = s / len; }
  return out;
}
export function rsi(velas, periodo = 14) {
  const n = velas.length, out = new Array(n).fill(NaN);
  if (n < periodo + 1) return out;
  let g = 0, p = 0;
  for (let i = 1; i <= periodo; i++) { const d = velas[i].c - velas[i - 1].c; g += Math.max(0, d); p += Math.max(0, -d); }
  g /= periodo; p /= periodo; out[periodo] = p === 0 ? 100 : 100 - 100 / (1 + g / p);
  for (let i = periodo + 1; i < n; i++) { const d = velas[i].c - velas[i - 1].c; g = (g * (periodo - 1) + Math.max(0, d)) / periodo; p = (p * (periodo - 1) + Math.max(0, -d)) / periodo; out[i] = p === 0 ? 100 : 100 - 100 / (1 + g / p); }
  return out;
}
// RSI sobre un arreglo de cierres (para RSI2 interno)
function rsiC(C, periodo) {
  const n = C.length, out = new Array(n).fill(NaN);
  if (n < periodo + 1) return out;
  let g = 0, p = 0;
  for (let i = 1; i <= periodo; i++) { const d = C[i] - C[i - 1]; g += Math.max(0, d); p += Math.max(0, -d); }
  g /= periodo; p /= periodo; out[periodo] = p === 0 ? 100 : 100 - 100 / (1 + g / p);
  for (let i = periodo + 1; i < n; i++) { const d = C[i] - C[i - 1]; g = (g * (periodo - 1) + Math.max(0, d)) / periodo; p = (p * (periodo - 1) + Math.max(0, -d)) / periodo; out[i] = p === 0 ? 100 : 100 - 100 / (1 + g / p); }
  return out;
}
export function atr(velas, periodo = 14) {
  const n = velas.length, out = new Array(n).fill(NaN);
  if (n < 2) return out;
  const tr = (i) => Math.max(velas[i].h - velas[i].l, Math.abs(velas[i].h - velas[i - 1].c), Math.abs(velas[i].l - velas[i - 1].c));
  const m = Math.min(periodo, n - 1); let a = 0;
  for (let i = 1; i <= m; i++) a += tr(i); a /= m; out[m] = a;
  for (let i = m + 1; i < n; i++) { a = (a * (periodo - 1) + tr(i)) / periodo; out[i] = a; }
  return out;
}
export function stoch(velas, periodo = 14) {
  const n = velas.length; if (n < periodo) return NaN;
  let hi = -Infinity, lo = Infinity;
  for (let i = n - periodo; i < n; i++) { if (velas[i].h > hi) hi = velas[i].h; if (velas[i].l < lo) lo = velas[i].l; }
  return hi === lo ? 50 : (100 * (velas[n - 1].c - lo)) / (hi - lo);
}
export function reagrupar(velas, f) {
  if (f <= 1) return velas.slice();
  const out = [];
  for (let i = 0; i < velas.length; i += f) { const g = velas.slice(i, i + f); if (!g.length) break; let h = -Infinity, l = Infinity, v = 0; for (const x of g) { if (x.h > h) h = x.h; if (x.l < l) l = x.l; v += x.v || 0; } out.push({ t: g[0].t, o: g[0].o, h, l, c: g[g.length - 1].c, v }); }
  return out;
}
const estMom = (x) => (x >= 80 ? 'sobrecompra' : x <= 20 ? 'sobreventa' : 'estable');
export function momentoMTF(velas, factores = [1, 4, 12]) {
  return factores.map((f) => { const sv = reagrupar(velas, f); const r = rsi(sv), rl = r.length ? r[r.length - 1] : NaN; const k = stoch(sv); return { factor: f, rsi: rl, stoch: k, rsiEstado: estMom(rl), stochEstado: estMom(k) }; });
}

/* ══════════════════════════════════════════════════════════════
   analizar — reversión a la media sobre una serie de velas.
   ══════════════════════════════════════════════════════════════ */
export function analizar(velas, opts = {}) {
  const n = velas.length;
  const periodo = opts.len || LEN, rl = opts.rsi || RSI_LEN;
  const os = opts.os != null ? opts.os : BANDA_OS, ob = opts.ob != null ? opts.ob : BANDA_OB;
  const guardE = opts.emaFiltro || EMA_FILTRO, stopK = opts.stopATR || STOP_ATR;
  const C = velas.map((v) => v.c);

  const sma = smaArr(C, periodo);        // la MEDIA (objetivo de reversión)
  const e200 = emaArr(C, guardE);        // régimen de tendencia
  const r2 = rsiC(C, rl);                // RSI rápido (gatillo)
  const at = atr(velas, 14);

  // régimen y "estiramiento" desde la media (en ATR) para el oscilador/display
  const regimen = new Array(n).fill(0);
  const estir = new Array(n).fill(NaN);  // (precio - media)/ATR  → + arriba, − abajo
  for (let i = 0; i < n; i++) {
    if (isFinite(e200[i])) regimen[i] = C[i] > e200[i] ? 1 : -1;
    if (isFinite(sma[i]) && isFinite(at[i]) && at[i] > 0) estir[i] = (C[i] - sma[i]) / at[i];
  }

  // SEÑALES: cruce del RSI2 al extremo, filtrado por el régimen. Una por extremo.
  const senales = [];
  let zonaPrev = null, lastBar = -1e9;
  const cd = opts.cooldown != null ? opts.cooldown : 5;
  for (let i = guardE; i < n; i++) {
    if (!isFinite(e200[i]) || !isFinite(r2[i]) || !isFinite(r2[i - 1]) || !isFinite(sma[i])) continue;
    const bull = C[i] > e200[i], bear = C[i] < e200[i];
    const longT = bull && r2[i] < os && r2[i - 1] >= os;     // entra en sobreventa dentro de alcista
    const shortT = bear && r2[i] > ob && r2[i - 1] <= ob;    // entra en sobrecompra dentro de bajista
    if (longT && zonaPrev !== 'L' && (i - lastBar) >= cd) { senales.push({ bar: i, t: velas[i].t, price: velas[i].c, tipo: 'LONG' }); zonaPrev = 'L'; lastBar = i; }
    else if (shortT && zonaPrev !== 'S' && (i - lastBar) >= cd) { senales.push({ bar: i, t: velas[i].t, price: velas[i].c, tipo: 'SHORT' }); zonaPrev = 'S'; lastBar = i; }
    if (r2[i] > 40 && r2[i] < 60) zonaPrev = null;           // se re-arma al volver al centro
  }
  const ultima = senales.length ? senales[senales.length - 1] : null;

  // Plan de la última señal: stop 2.5·ATR, objetivo = la MEDIA en el momento
  // de la señal (geométricamente correcto respecto a la entrada). Se marca si
  // la operación sigue ABIERTA (no ha tocado objetivo ni stop todavía): solo
  // así se dibuja su caja, para no mostrar un plan ya resuelto.
  if (ultima) {
    const b = ultima.bar, esL = ultima.tipo === 'LONG';
    const aU = isFinite(at[b]) && at[b] > 0 ? at[b] : ultima.price * 0.01;
    ultima.entry = ultima.price;
    ultima.risk = stopK * aU;
    ultima.sl = esL ? ultima.price - ultima.risk : ultima.price + ultima.risk;
    ultima.tp = isFinite(sma[b]) ? sma[b] : (esL ? ultima.price + ultima.risk : ultima.price - ultima.risk);
    ultima.rr = ultima.risk > 0 ? Math.abs(ultima.tp - ultima.entry) / ultima.risk : 0;
    let abierta = true;
    for (let k = b + 1; k < n; k++) {
      if (esL) { if (velas[k].l <= ultima.sl) { abierta = false; break; } if (isFinite(sma[k]) && C[k] >= sma[k]) { abierta = false; break; } }
      else { if (velas[k].h >= ultima.sl) { abierta = false; break; } if (isFinite(sma[k]) && C[k] <= sma[k]) { abierta = false; break; } }
    }
    ultima.activa = abierta;
  }

  const rHoy = n ? r2[n - 1] : NaN;
  const sobre = n && isFinite(e200[n - 1]) ? C[n - 1] > e200[n - 1] : null;
  const zona = isFinite(rHoy) ? (rHoy < os ? 'oversold' : rHoy > ob ? 'overbought' : 'neutral') : 'neutral';
  // convicción: qué tan al extremo está el RSI2 (0 en el centro, 100 en el borde)
  const conviccion = isFinite(rHoy) ? Math.round(Math.min(100, Math.abs(rHoy - 50) / 45 * 100)) : 0;

  return {
    len: periodo, n, precio: n ? C[n - 1] : 0,
    media: sma, e200, r2, estir, regimen, at,
    senales, ultima,
    regimenActual: n ? regimen[n - 1] : 0,
    sesgo: sobre === true ? 'alcista' : sobre === false ? 'bajista' : 'neutro',
    sobre200: sobre, zona, conviccion,
    rsi2Hoy: rHoy, mediaHoy: n ? sma[n - 1] : NaN, e200Hoy: n ? e200[n - 1] : NaN,
    estirHoy: n ? estir[n - 1] : NaN,
    bandaOS: os, bandaOB: ob
  };
}

/* ══════════════════════════════════════════════════════════════
   backtest — entra en cada señal, objetivo = la media, stop = 2.5·ATR,
   tope de velas. Walk-forward, sin mirar al futuro. Métricas en R
   (riesgo fijo 1% por operación) para que todo sea consistente.
   ══════════════════════════════════════════════════════════════ */
export function backtest(velas, opts = {}) {
  const E = analizar(velas, opts);
  const C = velas.map((v) => v.c), n = velas.length;
  const media = E.media, at = E.at, stopK = opts.stopATR || STOP_ATR, maxB = opts.maxBarras || MAX_BARRAS;
  const trades = [];
  for (const s of E.senales) {
    const esL = s.tipo === 'LONG', en = s.price, i = s.bar;
    const a = isFinite(at[i]) && at[i] > 0 ? at[i] : en * 0.01, risk = stopK * a;
    const stp = esL ? en - risk : en + risk;
    let ex = null, k;
    for (k = i + 1; k < Math.min(n, i + maxB + 1); k++) {
      if (esL) { if (velas[k].l <= stp) { ex = stp; break; } if (isFinite(media[k]) && C[k] >= media[k]) { ex = C[k]; break; } }
      else { if (velas[k].h >= stp) { ex = stp; break; } if (isFinite(media[k]) && C[k] <= media[k]) { ex = C[k]; break; } }
    }
    if (ex == null) { k = Math.min(n - 1, i + maxB); ex = C[k]; }
    const mv = esL ? (ex - en) : (en - ex);
    trades.push({ tipo: s.tipo, bar: i, entry: en, exit: ex, R: risk > 0 ? mv / risk : 0, retPct: (mv / en) * 100, barras: k - i });
  }
  const f = opts.riesgo || 0.01;
  const nt = trades.length, wins = trades.filter((x) => x.R > 0), losses = trades.filter((x) => x.R <= 0);
  const swR = wins.reduce((a, x) => a + x.R, 0), slR = Math.abs(losses.reduce((a, x) => a + x.R, 0)), sr = trades.reduce((a, x) => a + x.R, 0);
  let eq = 1; for (const x of trades) eq *= (1 + f * x.R);
  const aw = wins.length ? swR / wins.length : 0, al = losses.length ? slR / losses.length : 0;
  return {
    n: nt, ganados: wins.length, perdidos: losses.length,
    winRate: nt ? wins.length / nt * 100 : 0,
    pf: slR > 0 ? swR / slR : (swR > 0 ? Infinity : 0),
    expectativaR: nt ? sr / nt : 0, retornoTotal: (eq - 1) * 100,
    avgWinPct: aw, avgLossPct: al, avgRR: al > 0 ? aw / al : 0, trades
  };
}
