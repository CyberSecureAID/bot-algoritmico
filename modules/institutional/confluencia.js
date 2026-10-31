/* modules/institutional/confluencia.js — MOTOR DE CONFLUENCIA (Fase 3).

   Idea: el usuario marca un punto con dos o más indicadores activos. En ese
   instante capturamos el ESTADO DISCRETO de cada indicador (precio sobre/bajo
   la media, MACD vs su señal, zona del RSI, dirección del Supertrend, etc.).
   Esa combinación es la "firma" de confluencia. Luego se recorre TODO el
   historial y, cada vez que la misma firma vuelve a cumplirse, se marca (para
   backtesting) y en vivo cuando se forma la última vela.

   Este archivo es SOLO matemática pura (sin DOM): entra el array de velas y la
   lista de indicadores activos, salen mapas de estado y coincidencias. Así es
   testeable por separado y la UI (institutional.js) solo lo consume. */

import { ema, sma, wma, hma, dema, tema, vwma, alma, zlema, kama, vwapBands,
  bollinger, donchian, keltner, envelopes, psar, supertrend, rsi, macd, ppo,
  stochastic, stochRsi, atr, cci, williams, obv, roc, adx, mfi, awesome,
  momentum, stddev, ultimate, cmf, trix, vortex, aroon, fisher, cmo } from './indicadores.js?v=6';

/* ── Helpers de discretización (serie {time,value} → Map(time → estado)) ── */
const mapVal = (serie) => { const m = new Map(); for (const p of serie) if (p && p.value != null && isFinite(p.value)) m.set(p.time, p.value); return m; };

// Precio vs una línea: 'A' encima, 'B' debajo.
function vsLinea(V, serie) { const s = mapVal(serie); const out = new Map(); for (const c of V) { const v = s.get(c.time); if (v != null) out.set(c.time, c.close > v ? 'A' : 'B'); } return out; }
// Precio dentro de un canal: 'U' sobre la banda alta, 'L' bajo la baja, 'M' dentro.
function banda(V, up, lo) { const U = mapVal(up), L = mapVal(lo); const out = new Map(); for (const c of V) { const u = U.get(c.time), l = L.get(c.time); if (u != null && l != null) out.set(c.time, c.close > u ? 'U' : c.close < l ? 'L' : 'M'); } return out; }
// Dirección de una serie {time,value,dir}: 'A' alcista / 'B' bajista.
function dirDe(serie) { const out = new Map(); for (const p of serie) if (p && p.dir != null) out.set(p.time, p.dir === 1 ? 'A' : 'B'); return out; }
// Zona por umbrales: 'L' bajo / 'M' medio / 'H' alto.
function zona(serie, lo, hi) { const out = new Map(); for (const p of serie) if (p && p.value != null) out.set(p.time, p.value < lo ? 'L' : p.value > hi ? 'H' : 'M'); return out; }
// Signo: '+' / '-'.
function signo(serie) { const out = new Map(); for (const p of serie) if (p && p.value != null) out.set(p.time, p.value >= 0 ? '+' : '-'); return out; }
// Cruce de dos series por tiempo: 'A' si a>b, 'B' si no.
function cruce(a, b) { const B = mapVal(b); const out = new Map(); for (const p of a) { const bv = B.get(p.time); if (bv != null && p.value != null) out.set(p.time, p.value > bv ? 'A' : 'B'); } return out; }
// Pendiente (expande/contrae) comparando con k velas atrás: 'E' / 'C'.
function pend(serie, k = 3) { const out = new Map(); for (let i = k; i < serie.length; i++) { const a = serie[i], b = serie[i - k]; if (a && b && a.value != null && b.value != null) out.set(a.time, a.value >= b.value ? 'E' : 'C'); } return out; }

/* Discretizador por indicador. Los parámetros COINCIDEN con los que pinta el
   gráfico (institutional.js), para que lo que se ve sea lo que se mide. */
const DISC = {
  EMA9: (V) => vsLinea(V, ema(V, 9)), EMA20: (V) => vsLinea(V, ema(V, 20)), EMA50: (V) => vsLinea(V, ema(V, 50)),
  EMA100: (V) => vsLinea(V, ema(V, 100)), EMA200: (V) => vsLinea(V, ema(V, 200)),
  SMA: (V) => vsLinea(V, sma(V, 20)), WMA: (V) => vsLinea(V, wma(V, 20)), HMA: (V) => vsLinea(V, hma(V, 20)),
  DEMA: (V) => vsLinea(V, dema(V, 20)), TEMA: (V) => vsLinea(V, tema(V, 20)),
  VWMA: (V) => vsLinea(V, vwma(V, 20)), ALMA: (V) => vsLinea(V, alma(V, 20)), ZLEMA: (V) => vsLinea(V, zlema(V, 20)), KAMA: (V) => vsLinea(V, kama(V, 10)),
  VWAP: (V) => vsLinea(V, vwapBands(V, 2).mid),
  BOLL: (V) => { const b = bollinger(V, 20, 2); return banda(V, b.upper, b.lower); },
  DONCH: (V) => { const d = donchian(V, 20); return banda(V, d.upper, d.lower); },
  KELT: (V) => { const k = keltner(V, 20, 2); return banda(V, k.upper, k.lower); },
  ENV: (V) => { const e = envelopes(V, 20, 2.5); return banda(V, e.upper, e.lower); },
  PSAR: (V) => dirDe(psar(V)), ST: (V) => dirDe(supertrend(V, 10, 3)),
  RSI: (V) => zona(rsi(V, 14), 30, 70),
  MACD: (V) => { const m = macd(V); return cruce(m.macd, m.signal); },
  PPO: (V) => { const p = ppo(V); return cruce(p.ppo, p.signal); },
  STOCH: (V) => zona(stochastic(V).k, 20, 80),
  STOCHRSI: (V) => zona(stochRsi(V).k, 20, 80),
  ATR: (V) => pend(atr(V, 14)), STDDEV: (V) => pend(stddev(V, 20)),
  CCI: (V) => zona(cci(V, 20), -100, 100),
  WILL: (V) => zona(williams(V, 14), -80, -20),
  OBV: (V) => pend(obv(V), 1),
  ROC: (V) => signo(roc(V, 12)), MOM: (V) => signo(momentum(V, 10)), AO: (V) => signo(awesome(V)),
  ADX: (V) => { const a = adx(V, 14); const P = mapVal(a.plus), M = mapVal(a.minus); const out = new Map(); for (const pt of a.adx) { const p = P.get(pt.time), m = M.get(pt.time); if (p != null && m != null) out.set(pt.time, (pt.value > 25 ? 'T' : 't') + (p > m ? '+' : '-')); } return out; },
  MFI: (V) => zona(mfi(V, 14), 20, 80), UO: (V) => zona(ultimate(V), 30, 70),
  CMF: (V) => signo(cmf(V, 20)), CMO: (V) => signo(cmo(V, 14)),
  TRIX: (V) => signo(trix(V, 15).trix),
  VORTEX: (V) => { const vx = vortex(V, 14); return cruce(vx.plus, vx.minus); },
  AROON: (V) => { const ar = aroon(V, 14); return cruce(ar.up, ar.down); },
  FISHER: (V) => { const f = fisher(V, 9); return cruce(f.fisher, f.trigger); }
};

/* Indicadores que el motor sabe discretizar (para contar los "válidos"). */
export function soportado(k) { return !!DISC[k]; }

/* Construye el estado discreto de cada indicador activo sobre las velas V.
   Devuelve { orden:[keys], maps:{key→Map(time→estado)} }. */
export function construirEstados(activeKeys, V) {
  const orden = activeKeys.filter((k) => DISC[k]).sort();
  const maps = {};
  for (const k of orden) { try { maps[k] = DISC[k](V); } catch (_) { maps[k] = new Map(); } }
  return { orden, maps };
}

/* Firma de confluencia en un tiempo dado: cadena 'A|M|+|…' o null si algún
   indicador activo todavía no tiene dato ahí (calentamiento). */
export function firmaEn(est, time) {
  if (!est || !est.orden.length) return null;
  const parts = [];
  for (const k of est.orden) { const s = est.maps[k].get(time); if (s == null) return null; parts.push(s); }
  return parts.join('|');
}

/* Velas cuyo estado coincide EXACTAMENTE con la firma de referencia. Por
   defecto se devuelve SOLO el inicio de cada racha (el instante en que la
   confluencia VUELVE a cumplirse), no cada vela que la mantiene: así no se
   amontonan marcadores pegados cuando la condición dura varias velas —
   justo una señal por ocurrencia. Con soloInicios=false devuelve todas. */
export function escanear(est, V, firmaRef, soloInicios = true) {
  if (!firmaRef) return [];
  const out = [];
  let prev = false;
  for (const c of V) {
    const m = firmaEn(est, c.time) === firmaRef;
    if (m && (!soloInicios || !prev)) out.push(c.time);
    prev = m;
  }
  return out;
}
