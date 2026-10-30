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
