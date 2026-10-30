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
