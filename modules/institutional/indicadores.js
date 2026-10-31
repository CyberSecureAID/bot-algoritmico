/* modules/institutional/indicadores.js
   Indicadores técnicos para el terminal de Análisis Institucional.

   Portado 1:1 desde OpenTerminal (web/lib/indicators.ts, MIT) a JavaScript
   vanilla. La matemática es idéntica; solo se quitaron los tipos de TypeScript.
   Cada vela es { time, open, high, low, close, volume } con `time` en SEGUNDOS
   (lo que espera lightweight-charts). Cada punto es { time, value }. */

export function sma(velas, period) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < velas.length; i++) {
    sum += velas[i].close;
    if (i >= period) sum -= velas[i - period].close;
    if (i >= period - 1) out.push({ time: velas[i].time, value: sum / period });
  }
  return out;
}

export function ema(velas, period) {
  const out = [];
  const k = 2 / (period + 1);
  let prev = null;
  for (const c of velas) {
    prev = prev === null ? c.close : c.close * k + prev * (1 - k);
    out.push({ time: c.time, value: prev });
  }
  return out.slice(period - 1);
}

export function vwap(velas) {
  const out = [];
  let cumPV = 0, cumV = 0;
  for (const c of velas) {
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumV += c.volume;
    if (cumV > 0) out.push({ time: c.time, value: cumPV / cumV });
  }
  return out;
}

export function rsi(velas, period = 14) {
  const out = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < velas.length; i++) {
    const diff = velas[i].close - velas[i - 1].close;
    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);
    if (i <= period) {
      avgGain += gain / period;
      avgLoss += loss / period;
      if (i === period) {
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out.push({ time: velas[i].time, value: 100 - 100 / (1 + rs) });
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out.push({ time: velas[i].time, value: 100 - 100 / (1 + rs) });
    }
  }
  return out;
}

export function macd(velas, fast = 12, slow = 26, signal = 9) {
  const emaAll = (period) => {
    const k = 2 / (period + 1);
    const vals = [];
    let prev = null;
    for (const c of velas) {
      prev = prev === null ? c.close : c.close * k + prev * (1 - k);
      vals.push(prev);
    }
    return vals;
  };
  const fastE = emaAll(fast);
  const slowE = emaAll(slow);
  const macdLine = velas.map((c, i) => ({ time: c.time, value: fastE[i] - slowE[i] })).slice(slow - 1);
  const k = 2 / (signal + 1);
  let prev = null;
  const signalLine = macdLine.map((p) => {
    prev = prev === null ? p.value : p.value * k + prev * (1 - k);
    return { time: p.time, value: prev };
  });
  const histogram = macdLine.map((p, i) => ({ time: p.time, value: p.value - signalLine[i].value }));
  return { macd: macdLine, signal: signalLine, histogram };
}

export function bollinger(velas, period = 20, mult = 2) {
  const middle = sma(velas, period);
  const upper = [], lower = [];
  for (let i = period - 1; i < velas.length; i++) {
    const slice = velas.slice(i - period + 1, i + 1);
    const mean = middle[i - period + 1].value;
    const variance = slice.reduce((acc, c) => acc + (c.close - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push({ time: velas[i].time, value: mean + mult * sd });
    lower.push({ time: velas[i].time, value: mean - mult * sd });
  }
  return { upper, middle, lower };
}

/* ── Indicadores ampliados (apalancados en la misma base de velas) ──
   Overlays sobre el precio: Donchian, Keltner, Supertrend.
   Osciladores en panel propio: Stochastic, ATR, CCI, Williams %R, OBV, ROC. */

const mayor = (v, i, n) => { let m = -Infinity; for (let k = i - n + 1; k <= i; k++) if (v[k].high > m) m = v[k].high; return m; };
const menor = (v, i, n) => { let m = Infinity; for (let k = i - n + 1; k <= i; k++) if (v[k].low < m) m = v[k].low; return m; };

export function stochastic(velas, period = 14, suave = 3) {
  const kRaw = [];
  for (let i = period - 1; i < velas.length; i++) {
    const hh = mayor(velas, i, period), ll = menor(velas, i, period);
    const k = hh === ll ? 50 : 100 * (velas[i].close - ll) / (hh - ll);
    kRaw.push({ time: velas[i].time, value: k });
  }
  const d = [];
  for (let i = suave - 1; i < kRaw.length; i++) {
    let s = 0; for (let j = i - suave + 1; j <= i; j++) s += kRaw[j].value;
    d.push({ time: kRaw[i].time, value: s / suave });
  }
  return { k: kRaw, d };
}

export function atr(velas, period = 14) {
  const tr = [];
  for (let i = 1; i < velas.length; i++) {
    const h = velas[i].high, l = velas[i].low, pc = velas[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const out = [];
  let prev = null;
  for (let i = 0; i < tr.length; i++) {
    prev = prev === null ? tr.slice(0, period).reduce((a, b) => a + b, 0) / period : (prev * (period - 1) + tr[i]) / period;
    if (i >= period - 1) out.push({ time: velas[i + 1].time, value: prev });
  }
  return out;
}

export function cci(velas, period = 20) {
  const out = [];
  for (let i = period - 1; i < velas.length; i++) {
    const tp = velas.slice(i - period + 1, i + 1).map((c) => (c.high + c.low + c.close) / 3);
    const ma = tp.reduce((a, b) => a + b, 0) / period;
    const md = tp.reduce((a, b) => a + Math.abs(b - ma), 0) / period;
    const t = (velas[i].high + velas[i].low + velas[i].close) / 3;
    out.push({ time: velas[i].time, value: md === 0 ? 0 : (t - ma) / (0.015 * md) });
  }
  return out;
}

export function williams(velas, period = 14) {
  const out = [];
  for (let i = period - 1; i < velas.length; i++) {
    const hh = mayor(velas, i, period), ll = menor(velas, i, period);
    out.push({ time: velas[i].time, value: hh === ll ? -50 : -100 * (hh - velas[i].close) / (hh - ll) });
  }
  return out;
}

export function obv(velas) {
  const out = []; let acc = 0;
  for (let i = 1; i < velas.length; i++) {
    if (velas[i].close > velas[i - 1].close) acc += velas[i].volume;
    else if (velas[i].close < velas[i - 1].close) acc -= velas[i].volume;
    out.push({ time: velas[i].time, value: acc });
  }
  return out;
}

export function roc(velas, period = 12) {
  const out = [];
  for (let i = period; i < velas.length; i++) {
    const base = velas[i - period].close;
    out.push({ time: velas[i].time, value: base ? 100 * (velas[i].close - base) / base : 0 });
  }
  return out;
}

export function donchian(velas, period = 20) {
  const upper = [], lower = [], middle = [];
  for (let i = period - 1; i < velas.length; i++) {
    const hh = mayor(velas, i, period), ll = menor(velas, i, period);
    upper.push({ time: velas[i].time, value: hh });
    lower.push({ time: velas[i].time, value: ll });
    middle.push({ time: velas[i].time, value: (hh + ll) / 2 });
  }
  return { upper, middle, lower };
}

export function keltner(velas, period = 20, mult = 2) {
  const mid = ema(velas, period);
  const a = atr(velas, period);
  const mapA = {}; a.forEach((p) => { mapA[p.time] = p.value; });
  const upper = [], lower = [], middle = [];
  mid.forEach((p) => {
    const av = mapA[p.time];
    middle.push({ time: p.time, value: p.value });
    if (av != null) { upper.push({ time: p.time, value: p.value + mult * av }); lower.push({ time: p.time, value: p.value - mult * av }); }
  });
  return { upper, middle, lower };
}

export function supertrend(velas, period = 10, mult = 3) {
  const a = atr(velas, period);
  const mapA = {}; a.forEach((p) => { mapA[p.time] = p.value; });
  const out = [];
  let prevUp = null, prevLo = null, prevST = null, prevDir = 1;
  for (let i = 0; i < velas.length; i++) {
    const av = mapA[velas[i].time]; if (av == null) continue;
    const hl2 = (velas[i].high + velas[i].low) / 2;
    let up = hl2 - mult * av, lo = hl2 + mult * av;
    const c = velas[i].close, pc = i ? velas[i - 1].close : c;
    if (prevUp != null) up = (pc > prevUp) ? Math.max(up, prevUp) : up;
    if (prevLo != null) lo = (pc < prevLo) ? Math.min(lo, prevLo) : lo;
    let dir = prevDir;
    if (prevST != null) { if (prevDir === 1 && c < prevUp) dir = -1; else if (prevDir === -1 && c > prevLo) dir = 1; }
    const st = dir === 1 ? up : lo;
    out.push({ time: velas[i].time, value: st, dir });
    prevUp = up; prevLo = lo; prevST = st; prevDir = dir;
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════
   Indicadores ampliados (set "premium"): medias avanzadas y más osciladores.
   Mantienen el mismo contrato: entran velas {time,open,high,low,close,volume}
   y salen puntos {time,value}. Operan sobre la MISMA base, sin dependencias.
   ══════════════════════════════════════════════════════════════════════ */

/* Media ponderada lineal (WMA) sobre una serie de cierres. */
function wmaArr(vals, period) {
  const out = []; const denom = period * (period + 1) / 2;
  for (let i = period - 1; i < vals.length; i++) {
    let s = 0; for (let k = 0; k < period; k++) s += vals[i - period + 1 + k] * (k + 1);
    out.push(s / denom);
  }
  return out;
}
function emaArr(vals, period) {
  const out = []; const k = 2 / (period + 1); let prev = null;
  for (const v of vals) { prev = prev === null ? v : v * k + prev * (1 - k); out.push(prev); }
  return out;
}

export function wma(velas, period = 20) {
  const c = velas.map((v) => v.close); const w = wmaArr(c, period);
  return w.map((value, i) => ({ time: velas[i + period - 1].time, value }));
}

/* Hull Moving Average: WMA(2·WMA(n/2) − WMA(n), √n). Muy reactiva, poco lag. */
export function hma(velas, period = 20) {
  const c = velas.map((v) => v.close);
  const half = Math.max(1, Math.round(period / 2)), sq = Math.max(1, Math.round(Math.sqrt(period)));
  const wHalf = wmaArr(c, half), wFull = wmaArr(c, period);
  // alinear por el final (wFull es más corto)
  const off = wHalf.length - wFull.length;
  const raw = wFull.map((wf, i) => 2 * wHalf[i + off] - wf);
  const h = wmaArr(raw, sq);
  const startIdx = (period - 1) + (sq - 1);
  return h.map((value, i) => ({ time: velas[startIdx + i].time, value }));
}

/* DEMA = 2·EMA − EMA(EMA). */
export function dema(velas, period = 20) {
  const c = velas.map((v) => v.close);
  const e1 = emaArr(c, period), e2 = emaArr(e1, period);
  const out = e1.map((v, i) => 2 * v - e2[i]);
  return out.map((value, i) => ({ time: velas[i].time, value })).slice(period - 1);
}

/* TEMA = 3·EMA − 3·EMA(EMA) + EMA(EMA(EMA)). */
export function tema(velas, period = 20) {
  const c = velas.map((v) => v.close);
  const e1 = emaArr(c, period), e2 = emaArr(e1, period), e3 = emaArr(e2, period);
  const out = e1.map((v, i) => 3 * v - 3 * e2[i] + e3[i]);
  return out.map((value, i) => ({ time: velas[i].time, value })).slice(period - 1);
}

/* Parabolic SAR (overlay). value + dir (+1 alcista / −1 bajista). */
export function psar(velas, step = 0.02, maxStep = 0.2) {
  const out = [];
  if (velas.length < 2) return out;
  let dir = velas[1].close >= velas[0].close ? 1 : -1;
  let sar = dir === 1 ? velas[0].low : velas[0].high;
  let ep = dir === 1 ? velas[0].high : velas[0].low;
  let af = step;
  for (let i = 1; i < velas.length; i++) {
    const h = velas[i].high, l = velas[i].low;
    sar = sar + af * (ep - sar);
    if (dir === 1) {
      sar = Math.min(sar, velas[i - 1].low, velas[i > 1 ? i - 2 : i - 1].low);
      if (h > ep) { ep = h; af = Math.min(maxStep, af + step); }
      if (l < sar) { dir = -1; sar = ep; ep = l; af = step; }
    } else {
      sar = Math.max(sar, velas[i - 1].high, velas[i > 1 ? i - 2 : i - 1].high);
      if (l < ep) { ep = l; af = Math.min(maxStep, af + step); }
      if (h > sar) { dir = 1; sar = ep; ep = h; af = step; }
    }
    out.push({ time: velas[i].time, value: sar, dir });
  }
  return out;
}

/* ADX con +DI / −DI (fuerza de tendencia, panel). */
export function adx(velas, period = 14) {
  const n = velas.length; if (n < period + 1) return { adx: [], plus: [], minus: [] };
  const tr = [], plusDM = [], minusDM = [];
  for (let i = 1; i < n; i++) {
    const up = velas[i].high - velas[i - 1].high, dn = velas[i - 1].low - velas[i].low;
    plusDM.push(up > dn && up > 0 ? up : 0);
    minusDM.push(dn > up && dn > 0 ? dn : 0);
    const h = velas[i].high, l = velas[i].low, pc = velas[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const smooth = (arr) => { const o = []; let s = arr.slice(0, period).reduce((a, b) => a + b, 0); o.push(s); for (let i = period; i < arr.length; i++) { s = s - s / period + arr[i]; o.push(s); } return o; };
  const trS = smooth(tr), pS = smooth(plusDM), mS = smooth(minusDM);
  const plus = [], minus = [], dx = [];
  for (let i = 0; i < trS.length; i++) {
    const pdi = trS[i] ? 100 * pS[i] / trS[i] : 0, mdi = trS[i] ? 100 * mS[i] / trS[i] : 0;
    const t = velas[i + period].time;
    plus.push({ time: t, value: pdi }); minus.push({ time: t, value: mdi });
    dx.push(pdi + mdi ? 100 * Math.abs(pdi - mdi) / (pdi + mdi) : 0);
  }
  const adxArr = [];
  if (dx.length >= period) {
    let a = dx.slice(0, period).reduce((x, y) => x + y, 0) / period;
    adxArr.push({ time: plus[period - 1].time, value: a });
    for (let i = period; i < dx.length; i++) { a = (a * (period - 1) + dx[i]) / period; adxArr.push({ time: plus[i].time, value: a }); }
  }
  return { adx: adxArr, plus, minus };
}

/* Money Flow Index (volumen + precio, 0–100, panel). */
export function mfi(velas, period = 14) {
  const out = []; const tp = velas.map((v) => (v.high + v.low + v.close) / 3);
  for (let i = period; i < velas.length; i++) {
    let pos = 0, neg = 0;
    for (let k = i - period + 1; k <= i; k++) {
      const rmf = tp[k] * velas[k].volume;
      if (tp[k] > tp[k - 1]) pos += rmf; else if (tp[k] < tp[k - 1]) neg += rmf;
    }
    const mr = neg === 0 ? 100 : pos / neg;
    out.push({ time: velas[i].time, value: 100 - 100 / (1 + mr) });
  }
  return out;
}

/* Awesome Oscillator (histograma): SMA(mediana,5) − SMA(mediana,34). */
export function awesome(velas) {
  const med = velas.map((v) => (v.high + v.low) / 2);
  const smaArr = (arr, p) => { const o = []; let s = 0; for (let i = 0; i < arr.length; i++) { s += arr[i]; if (i >= p) s -= arr[i - p]; if (i >= p - 1) o.push(s / p); } return o; };
  const f = smaArr(med, 5), sl = smaArr(med, 34);
  const off = f.length - sl.length;
  const out = [];
  for (let i = 0; i < sl.length; i++) { const idx = i + 33; out.push({ time: velas[idx].time, value: f[i + off] - sl[i] }); }
  return out;
}

/* Momentum simple (panel). */
export function momentum(velas, period = 10) {
  const out = [];
  for (let i = period; i < velas.length; i++) out.push({ time: velas[i].time, value: velas[i].close - velas[i - period].close });
  return out;
}

/* Desviación estándar de los cierres (volatilidad, panel). */
export function stddev(velas, period = 20) {
  const out = [];
  for (let i = period - 1; i < velas.length; i++) {
    const s = velas.slice(i - period + 1, i + 1);
    const m = s.reduce((a, c) => a + c.close, 0) / period;
    const v = s.reduce((a, c) => a + (c.close - m) ** 2, 0) / period;
    out.push({ time: velas[i].time, value: Math.sqrt(v) });
  }
  return out;
}

/* Ultimate Oscillator (7/14/28, panel). */
export function ultimate(velas, p1 = 7, p2 = 14, p3 = 28) {
  const bp = [], tr = [];
  for (let i = 1; i < velas.length; i++) {
    const pc = velas[i - 1].close, l = Math.min(velas[i].low, pc), h = Math.max(velas[i].high, pc);
    bp.push(velas[i].close - l); tr.push(h - l);
  }
  const sum = (arr, i, p) => { let s = 0; for (let k = i - p + 1; k <= i; k++) s += arr[k]; return s; };
  const out = [];
  for (let i = p3 - 1; i < bp.length; i++) {
    const a1 = sum(bp, i, p1) / (sum(tr, i, p1) || 1);
    const a2 = sum(bp, i, p2) / (sum(tr, i, p2) || 1);
    const a3 = sum(bp, i, p3) / (sum(tr, i, p3) || 1);
    out.push({ time: velas[i + 1].time, value: 100 * (4 * a1 + 2 * a2 + a3) / 7 });
  }
  return out;
}

/* Chaikin Money Flow (panel, −1..1 escalado a %). */
export function cmf(velas, period = 20) {
  const out = [];
  for (let i = period - 1; i < velas.length; i++) {
    let mfv = 0, vol = 0;
    for (let k = i - period + 1; k <= i; k++) {
      const rng = velas[k].high - velas[k].low;
      const m = rng ? ((velas[k].close - velas[k].low) - (velas[k].high - velas[k].close)) / rng : 0;
      mfv += m * velas[k].volume; vol += velas[k].volume;
    }
    out.push({ time: velas[i].time, value: vol ? 100 * mfv / vol : 0 });
  }
  return out;
}
