/* ══════════════════════════════════════════════════════════════
   structural/motor.js — Motor de "Structural Logic" (versión nueva).

   Port FIEL del Pine [Structural logic]:
     - Precio suavizado tipo Hull: d = 2·precio − EMA(precio,len); suav = WMA(d,len).
       Se calcula para O,H,L,C → velas suavizadas (oda,hda,lda,cda).
     - Oscilador de momento: change = (cda − cda[1]) / ATR(len).
     - Tendencia con histéresis: change>umbralLong → +1 (verde);
       change<umbralShort → −1 (rojo); si no, se mantiene.

   MEJORAS pedidas (y validadas en datos reales):
     - Lookback por defecto 100 (el Pine traía 45).
     - Señales LONG/SHORT en el cambio de color, FILTRADAS por una EMA200
       oculta: LONG solo si tendencia verde Y cierre por encima de EMA200;
       SHORT solo si tendencia roja Y cierre por debajo. Una por régimen
       (no se repite hasta que cambie de lado). Todo causal: NO repinta.
   ══════════════════════════════════════════════════════════════ */

export const LEN = 100;            // Lookback por defecto (el Pine traía 45)
export const UMBRAL_L = 0.05;      // Long threshold
export const UMBRAL_S = -0.05;     // Short threshold
export const EMA_FILTRO = 200;     // EMA oculta de filtro de tendencia

/* ── ayudantes sobre arreglos numéricos ── */
function emaArr(arr, len) {
  const n = arr.length, out = new Array(n).fill(NaN);
  if (!n) return out;
  const k = 2 / (len + 1); let e = arr[0]; out[0] = e;
  for (let i = 1; i < n; i++) { e = arr[i] * k + e * (1 - k); out[i] = e; }
  return out;
}
function wmaArr(arr, len) {
  const n = arr.length, out = new Array(n).fill(NaN), den = len * (len + 1) / 2;
  for (let i = len - 1; i < n; i++) {
    let s = 0; for (let j = 0; j < len; j++) s += arr[i - j] * (len - j);
    out[i] = s / den;
  }
  return out;
}

/* ── ayudantes sobre velas ── */
export function rsi(velas, periodo = 14) {
  const n = velas.length, out = new Array(n).fill(NaN);
  if (n < periodo + 1) return out;
  let g = 0, p = 0;
  for (let i = 1; i <= periodo; i++) { const d = velas[i].c - velas[i - 1].c; g += Math.max(0, d); p += Math.max(0, -d); }
  g /= periodo; p /= periodo; out[periodo] = p === 0 ? 100 : 100 - 100 / (1 + g / p);
  for (let i = periodo + 1; i < n; i++) { const d = velas[i].c - velas[i - 1].c; g = (g * (periodo - 1) + Math.max(0, d)) / periodo; p = (p * (periodo - 1) + Math.max(0, -d)) / periodo; out[i] = p === 0 ? 100 : 100 - 100 / (1 + g / p); }
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
   analizar — calcula el indicador completo sobre una serie de velas.
   ══════════════════════════════════════════════════════════════ */
export function analizar(velas, opts = {}) {
  const len = opts.len || LEN, l = opts.l != null ? opts.l : UMBRAL_L, s = opts.s != null ? opts.s : UMBRAL_S;
  const n = velas.length;
  const O = velas.map((v) => v.o), H = velas.map((v) => v.h), L = velas.map((v) => v.l), C = velas.map((v) => v.c);

  // precio suavizado tipo Hull (de-lag + WMA)
  const oa = emaArr(O, len), ha = emaArr(H, len), la = emaArr(L, len), ca = emaArr(C, len);
  const od = O.map((x, i) => x * 2 - oa[i]), hd = H.map((x, i) => x * 2 - ha[i]), ld = L.map((x, i) => x * 2 - la[i]), cd = C.map((x, i) => x * 2 - ca[i]);
  const oda = wmaArr(od, len), hda = wmaArr(hd, len), lda = wmaArr(ld, len), cda = wmaArr(cd, len);

  // momento normalizado por ATR
  const at = atr(velas, len);
  const change = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) if (isFinite(cda[i]) && isFinite(cda[i - 1]) && at[i] > 0) change[i] = (cda[i] - cda[i - 1]) / at[i];

  // tendencia con histéresis
  const trend = new Array(n).fill(0); let t = 0;
  for (let i = 0; i < n; i++) { if (isFinite(change[i])) { if (change[i] > l) t = 1; else if (change[i] < s) t = -1; } trend[i] = t; }

  // EMA200 oculta (filtro)
  const e200 = emaArr(C, opts.emaFiltro || EMA_FILTRO);

  // señales (validado en datos reales): el régimen lo manda la EMA200.
  //   LONG  solo si el CUERPO de la vela cierra por encima de la EMA200 Y la
  //         EMA200 va subiendo (tendencia mayor alcista).
  //   SHORT simétrico. Una por régimen; se ignora el arranque hasta que la
  //         EMA200 esté formada (warmup). Esto mata las entradas que no
  //         consolidan (el whipsaw alrededor de la media).
  const senales = [];
  let bullPrev = false, bearPrev = false, lastSig = null;
  const guard = opts.emaFiltro || EMA_FILTRO, slopeN = opts.slope || 20;
  for (let i = 0; i < n; i++) {
    if (i < guard || !isFinite(e200[i])) { bullPrev = false; bearPrev = false; continue; }
    const cuerpoArriba = Math.min(velas[i].o, velas[i].c) > e200[i];
    const cuerpoAbajo = Math.max(velas[i].o, velas[i].c) < e200[i];
    const subeE = i >= slopeN && e200[i] > e200[i - slopeN];
    const bajaE = i >= slopeN && e200[i] < e200[i - slopeN];
    const bull = trend[i] === 1 && cuerpoArriba && subeE;
    const bear = trend[i] === -1 && cuerpoAbajo && bajaE;
    if (bull && !bullPrev && lastSig !== 'LONG') { senales.push({ bar: i, t: velas[i].t, price: velas[i].c, tipo: 'LONG' }); lastSig = 'LONG'; }
    else if (bear && !bearPrev && lastSig !== 'SHORT') { senales.push({ bar: i, t: velas[i].t, price: velas[i].c, tipo: 'SHORT' }); lastSig = 'SHORT'; }
    bullPrev = bull; bearPrev = bear;
  }
  const ultima = senales.length ? senales[senales.length - 1] : null;

  // Plan de riesgo de la ÚLTIMA señal: stop a 1.5·ATR(14), objetivo 1:2.
  //   (El estudio en datos reales dice que salir en la señal opuesta rinde
  //   más que un TP fijo; el 1:2 se dibuja como REFERENCIA de gestión, no
  //   como promesa. Lo honesto va en el panel.)
  if (ultima) {
    const at14 = atr(velas, 14);
    const aU = isFinite(at14[ultima.bar]) && at14[ultima.bar] > 0 ? at14[ultima.bar] : ultima.price * 0.01;
    const risk = 1.5 * aU;
    const esL = ultima.tipo === 'LONG';
    ultima.entry = ultima.price;
    ultima.risk = risk;
    ultima.sl = esL ? ultima.price - risk : ultima.price + risk;
    ultima.tp = esL ? ultima.price + 2 * risk : ultima.price - 2 * risk;
    ultima.rr = 2;
  }

  const sobre = n && isFinite(e200[n - 1]) ? velas[n - 1].c > e200[n - 1] : null;
  const emaSube = (n > slopeN && isFinite(e200[n - 1]) && isFinite(e200[n - 1 - slopeN])) ? e200[n - 1] > e200[n - 1 - slopeN] : null;
  const regimen = (sobre === true && emaSube === true) ? 'risk-on' : (sobre === false && emaSube === false) ? 'risk-off' : 'mixed';
  const conviccion = n && isFinite(change[n - 1]) ? Math.max(0, Math.min(100, Math.round(Math.abs(change[n - 1]) / 0.22 * 100))) : 0;
  return {
    len, l, s, n, precio: n ? velas[n - 1].c : 0,
    oda, hda, lda, cda, change, trend, e200,
    senales, ultima,
    trendActual: n ? trend[n - 1] : 0,
    changeActual: n ? change[n - 1] : NaN,
    sesgo: n && trend[n - 1] === 1 ? 'alcista' : n && trend[n - 1] === -1 ? 'bajista' : 'neutro',
    sobre200: sobre, emaSube, regimen, conviccion,
    e200Hoy: n ? e200[n - 1] : NaN
  };
}

/* ══════════════════════════════════════════════════════════════
   backtest — entra en cada señal, stop por ATR, sale en la señal
   opuesta. Walk-forward, sin mirar al futuro. R = resultado/riesgo.
   ══════════════════════════════════════════════════════════════ */
export function backtest(velas, opts = {}) {
  const E = analizar(velas, opts);
  const sig = E.senales, at = atr(velas, 14), kStop = opts.kStop || 1.5, trades = [];
  for (let i = 0; i < sig.length; i++) {
    const sg = sig[i], esLong = sg.tipo === 'LONG', entry = sg.price;
    const a = isFinite(at[sg.bar]) && at[sg.bar] > 0 ? at[sg.bar] : entry * 0.01, risk = kStop * a;
    const next = sig[i + 1], limit = next ? next.bar : velas.length - 1;
    if (limit <= sg.bar) continue;
    const exit = velas[limit].c, move = esLong ? (exit - entry) : (entry - exit);
    trades.push({ tipo: sg.tipo, bar: sg.bar, entry, exit, R: move / risk, retPct: (move / entry) * 100, barras: limit - sg.bar });
  }
  /* Métricas CONSISTENTES en R (riesgo normalizado por volatilidad), que es
     como una mesa real mide un sistema: cada operación arriesga una fracción
     fija del capital (1%% por defecto) dimensionada por el stop ATR. Así el
     Profit Factor, la expectativa y el resultado neto cuentan la MISMA
     historia (no se mezcla R con %% de notional fijo, que se contradicen). */
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
