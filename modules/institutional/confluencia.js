/* modules/institutional/confluencia.js — MOTOR DE CONFLUENCIA (v3, por RASGOS).

   Idea (mejorada): un "estado" como "precio sobre la media" NO es una regla de
   trader. Lo que importa es la GEOMETRÍA exacta del punto: la DISTANCIA entre
   dos medias (y si se CRUZAN y hacia dónde), la distancia/cruce de las dos
   líneas del estocástico, la "barriguita" del MACD, el nivel del RSI, etc.

   Por eso cada punto que marca el usuario captura un VECTOR DE RASGOS: valores
   numéricos (distancias en %, niveles, pendientes/cruces) con una TOLERANCIA
   adaptativa por rasgo. Una vela (pasada o futura) coincide solo cuando TODOS
   los rasgos vuelven a caer dentro de su tolerancia. Así un cruce (gap≈0) o una
   separación de 3% son reglas precisas, no un "sale donde quiera".

   Archivo de solo matemática (sin DOM): la UI (institutional.js) lo consume. */

import { ema, sma, wma, hma, dema, tema, vwma, alma, zlema, kama, vwapBands,
  bollinger, donchian, keltner, envelopes, psar, supertrend, rsi, macd, ppo,
  stochastic, stochRsi, atr, cci, williams, obv, roc, adx, mfi, awesome,
  momentum, stddev, ultimate, cmf, trix, vortex, aroon, fisher, cmo } from './indicadores.js?v=6';

/* Periodo de cada media (para ordenar pares: la chiquita es la "rápida"). */
const MA_PER = { EMA9: 9, EMA20: 20, EMA50: 50, EMA100: 100, EMA200: 200, SMA: 20, WMA: 20, HMA: 20, DEMA: 20, TEMA: 20, VWMA: 20, ALMA: 20, ZLEMA: 20, KAMA: 10, VWAP: 1 };
const NM = { EMA9: 'EMA 9', EMA20: 'EMA 20', EMA50: 'EMA 50', EMA100: 'EMA 100', EMA200: 'EMA 200', SMA: 'SMA 20', WMA: 'WMA 20', HMA: 'HMA 20', DEMA: 'DEMA 20', TEMA: 'TEMA 20', VWMA: 'VWMA 20', ALMA: 'ALMA 20', ZLEMA: 'ZLEMA 20', KAMA: 'KAMA 10', VWAP: 'VWAP', RSI: 'RSI', MACD: 'MACD', PPO: 'PPO', STOCH: 'Stochastic', STOCHRSI: 'Stoch RSI', CCI: 'CCI', WILL: 'Williams %R', MFI: 'MFI', UO: 'Ultimate Osc.', ROC: 'ROC', MOM: 'Momentum', CMO: 'CMO', CMF: 'Chaikin MF', TRIX: 'TRIX', AO: 'Awesome Osc.', OBV: 'OBV', ATR: 'ATR', STDDEV: 'Std Dev', ADX: 'ADX', PSAR: 'Parabolic SAR', ST: 'Supertrend', BOLL: 'Bollinger', DONCH: 'Donchian', KELT: 'Keltner', ENV: 'Envelopes', VORTEX: 'Vortex', AROON: 'Aroon', FISHER: 'Fisher' };
const nmDe = (k) => NM[k] || k;

const _SOP = new Set(Object.keys(NM));
export function soportado(k) { return _SOP.has(k); }

function _serieMA(k, V) {
  switch (k) {
    case 'EMA9': return ema(V, 9); case 'EMA20': return ema(V, 20); case 'EMA50': return ema(V, 50);
    case 'EMA100': return ema(V, 100); case 'EMA200': return ema(V, 200);
    case 'SMA': return sma(V, 20); case 'WMA': return wma(V, 20); case 'HMA': return hma(V, 20);
    case 'DEMA': return dema(V, 20); case 'TEMA': return tema(V, 20);
    case 'VWMA': return vwma(V, 20); case 'ALMA': return alma(V, 20); case 'ZLEMA': return zlema(V, 20); case 'KAMA': return kama(V, 10);
    case 'VWAP': return vwapBands(V, 2).mid; default: return [];
  }
}
const _USA_PEND = { gap: 1, pdist: 1, cross: 1, hist: 1, dir: 0, level: 0 };
/* Tolerancia adaptativa: ~0.55·σ de los últimos valores, con mínimos por tipo. */
function _tol(vals, kind) {
  if (kind === 'dir') return 0.5;
  const xs = []; for (let i = vals.length - 1; i >= 0 && xs.length < 160; i--) if (isFinite(vals[i])) xs.push(vals[i]);
  if (xs.length < 8) return ({ gap: 0.12, pdist: 0.15, level: 4, cross: 0.06, hist: 0.03 }[kind] || 0.1);
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
  const min = { gap: 0.08, pdist: 0.1, level: 3, cross: 0.04, hist: 0.02 }[kind] || 0.05;
  return Math.max(min, 0.55 * sd);
}

/* Construye el banco de RASGOS para los indicadores ACTIVOS sobre V.
   Devuelve { V, n, feats:[{id,keys,kind,vals(Float64),tol,nm,nm2}], timeIdx }. */
export function construirRasgos(activeKeys, V) {
  const n = V.length;
  const close = new Float64Array(n); for (let i = 0; i < n; i++) close[i] = V[i].close;
  const timeIdx = new Map(); for (let i = 0; i < n; i++) timeIdx.set(V[i].time, i);
  const alinear = (serie) => { const a = new Float64Array(n).fill(NaN); if (serie) for (const p of serie) { const i = timeIdx.get(p.time); if (i != null && p && p.value != null && isFinite(p.value)) a[i] = p.value; } return a; };
  const feats = [];
  const add = (id, keys, kind, vals, nm, nm2) => feats.push({ id, keys, kind, vals, tol: _tol(vals, kind), nm, nm2 });

  // ── MEDIAS: pares consecutivos por periodo (la rápida define el sentido) ──
  const maKeys = activeKeys.filter((k) => MA_PER[k] != null).sort((a, b) => MA_PER[a] - MA_PER[b]);
  if (maKeys.length) {
    const S = {}; maKeys.forEach((k) => { S[k] = alinear(_serieMA(k, V)); });
    if (maKeys.length >= 2) {
      for (let p = 0; p < maKeys.length - 1; p++) {
        const f = maKeys[p], s = maKeys[p + 1], vals = new Float64Array(n).fill(NaN);
        for (let i = 0; i < n; i++) { const a = S[f][i], b = S[s][i]; if (isFinite(a) && isFinite(b) && close[i]) vals[i] = (a - b) / close[i] * 100; }
        add('gap:' + f + ':' + s, [f, s], 'gap', vals, nmDe(f), nmDe(s));
      }
    } else {
      const k = maKeys[0], vals = new Float64Array(n).fill(NaN);
      for (let i = 0; i < n; i++) { const a = S[k][i]; if (isFinite(a) && close[i]) vals[i] = (close[i] - a) / close[i] * 100; }
      add('pdist:' + k, [k], 'pdist', vals, nmDe(k));
    }
  }

  // helpers para líneas normalizadas en %
  const pct = (arr) => { const o = new Float64Array(n).fill(NaN); for (let i = 0; i < n; i++) if (isFinite(arr[i]) && close[i]) o[i] = arr[i] / close[i] * 100; return o; };
  const resta = (aA, bA) => { const o = new Float64Array(n).fill(NaN); for (let i = 0; i < n; i++) if (isFinite(aA[i]) && isFinite(bA[i])) o[i] = aA[i] - bA[i]; return o; };

  for (const k of activeKeys) {
    if (MA_PER[k] != null) continue;
    try {
      switch (k) {
        case 'RSI': add('lvl:RSI', [k], 'level', alinear(rsi(V, 14)), 'RSI'); break;
        case 'MACD': { const m = macd(V); add('cross:MACD', [k], 'cross', pct(resta(alinear(m.macd), alinear(m.signal))), 'MACD', 'signal'); add('hist:MACD', [k], 'hist', pct(alinear(m.histogram)), 'MACD'); break; }
        case 'PPO': { const p = ppo(V); add('cross:PPO', [k], 'cross', resta(alinear(p.ppo), alinear(p.signal)), 'PPO', 'signal'); add('hist:PPO', [k], 'hist', alinear(p.histogram), 'PPO'); break; }
        case 'STOCH': { const st = stochastic(V); add('lvl:STOCH', [k], 'level', alinear(st.k), 'Stochastic %K'); add('cross:STOCH', [k], 'cross', resta(alinear(st.k), alinear(st.d)), '%K', '%D'); break; }
        case 'STOCHRSI': { const st = stochRsi(V); add('lvl:STOCHRSI', [k], 'level', alinear(st.k), 'Stoch RSI %K'); add('cross:STOCHRSI', [k], 'cross', resta(alinear(st.k), alinear(st.d)), '%K', '%D'); break; }
        case 'CCI': add('lvl:CCI', [k], 'level', alinear(cci(V, 20)), 'CCI'); break;
        case 'WILL': add('lvl:WILL', [k], 'level', alinear(williams(V, 14)), 'Williams %R'); break;
        case 'MFI': add('lvl:MFI', [k], 'level', alinear(mfi(V, 14)), 'MFI'); break;
        case 'UO': add('lvl:UO', [k], 'level', alinear(ultimate(V)), 'Ultimate Osc.'); break;
        case 'ROC': add('lvl:ROC', [k], 'level', alinear(roc(V, 12)), 'ROC'); break;
        case 'MOM': add('hist:MOM', [k], 'hist', pct(alinear(momentum(V, 10))), 'Momentum'); break;
        case 'CMO': add('lvl:CMO', [k], 'level', alinear(cmo(V, 14)), 'CMO'); break;
        case 'CMF': add('lvl:CMF', [k], 'level', alinear(cmf(V, 20)), 'Chaikin MF'); break;
        case 'TRIX': add('hist:TRIX', [k], 'hist', alinear(trix(V, 15).trix), 'TRIX'); break;
        case 'AO': add('hist:AO', [k], 'hist', pct(alinear(awesome(V))), 'Awesome Osc.'); break;
        case 'STDDEV': add('lvl:STDDEV', [k], 'level', pct(alinear(stddev(V, 20))), 'Std Dev'); break;
        case 'ATR': add('lvl:ATR', [k], 'level', pct(alinear(atr(V, 14))), 'ATR'); break;
        case 'OBV': { const o = alinear(obv(V)), d = new Float64Array(n).fill(NaN); for (let i = 1; i < n; i++) if (isFinite(o[i]) && isFinite(o[i - 1])) d[i] = o[i] >= o[i - 1] ? 1 : -1; add('dir:OBV', [k], 'dir', d, 'OBV'); break; }
        case 'ADX': { const a = adx(V, 14); add('lvl:ADX', [k], 'level', alinear(a.adx), 'ADX'); add('cross:ADX', [k], 'cross', resta(alinear(a.plus), alinear(a.minus)), '+DI', '−DI'); break; }
        case 'ST': { const st = supertrend(V, 10, 3), d = new Float64Array(n).fill(NaN); for (const p of st) { const i = timeIdx.get(p.time); if (i != null) d[i] = p.dir === 1 ? 1 : -1; } add('dir:ST', [k], 'dir', d, 'Supertrend'); break; }
        case 'PSAR': { const ps = psar(V), d = new Float64Array(n).fill(NaN); for (const p of ps) { const i = timeIdx.get(p.time); if (i != null) d[i] = p.dir === 1 ? 1 : -1; } add('dir:PSAR', [k], 'dir', d, 'Parabolic SAR'); break; }
        case 'VORTEX': { const vx = vortex(V, 14); add('cross:VORTEX', [k], 'cross', resta(alinear(vx.plus), alinear(vx.minus)), 'VI+', 'VI−'); break; }
        case 'AROON': { const ar = aroon(V, 14); add('cross:AROON', [k], 'cross', resta(alinear(ar.up), alinear(ar.down)), 'Aroon Up', 'Down'); break; }
        case 'FISHER': { const fi = fisher(V, 9); add('cross:FISHER', [k], 'cross', resta(alinear(fi.fisher), alinear(fi.trigger)), 'Fisher', 'trigger'); break; }
        case 'BOLL': case 'DONCH': case 'KELT': case 'ENV': {
          const b = k === 'BOLL' ? bollinger(V, 20, 2) : k === 'DONCH' ? donchian(V, 20) : k === 'KELT' ? keltner(V, 20, 2) : envelopes(V, 20, 2.5);
          const U = alinear(b.upper), L = alinear(b.lower), vals = new Float64Array(n).fill(NaN);
          for (let i = 0; i < n; i++) { const u = U[i], l = L[i]; if (isFinite(u) && isFinite(l) && u !== l) vals[i] = (close[i] - l) / (u - l) * 100; }
          add('pctb:' + k, [k], 'level', vals, nmDe(k)); break;
        }
        default: break;
      }
    } catch (_) {}
  }
  return { V, n, feats, timeIdx };
}

function _pend(vals, i) { if (i <= 0) return 0; const a = vals[i], b = vals[i - 1]; if (!isFinite(a) || !isFinite(b)) return 0; return a >= b ? 1 : -1; }

/* Captura el vector de rasgos en una vela (índice). */
export function capturarRasgos(ras, barIdx) {
  const cap = [];
  for (const f of ras.feats) {
    const v = f.vals[barIdx]; if (!isFinite(v)) continue;
    cap.push({ id: f.id, keys: f.keys.slice(), kind: f.kind, val: v, dir: _USA_PEND[f.kind] ? _pend(f.vals, barIdx) : 0, tol: f.tol, nm: f.nm, nm2: f.nm2 });
  }
  return cap;
}
/* Indicadores (distintos) del vector que SIGUEN activos en `ras`. */
export function rasgosActivos(ras, cap) {
  const fid = {}; for (const f of ras.feats) fid[f.id] = 1;
  const act = new Set();
  for (const c of cap) if (fid[c.id]) c.keys.forEach((k) => act.add(k));
  return act.size;
}
/* ¿La vela `barIdx` cumple TODOS los rasgos (de indicadores aún activos)?
   Requiere ≥2 indicadores distintos activos. */
export function coincideRasgos(ras, cap, barIdx) {
  const fById = {}; for (const f of ras.feats) fById[f.id] = f;
  const act = new Set(); let usados = 0;
  for (const c of cap) {
    const f = fById[c.id]; if (!f) continue;              // su indicador se quitó → no cuenta
    const v = f.vals[barIdx]; if (!isFinite(v)) return false;
    if (Math.abs(v - c.val) > c.tol) return false;
    if (_USA_PEND[c.kind] && c.dir) { if (_pend(f.vals, barIdx) !== c.dir) return false; }
    usados++; c.keys.forEach((k) => act.add(k));
  }
  return usados >= 1 && act.size >= 2;
}
/* Velas donde se cumple la confluencia (inicio de cada racha → una por ocurrencia). */
export function escanearRasgos(ras, cap, soloInicios = true) {
  const out = []; let prev = false;
  for (let i = 0; i < ras.n; i++) {
    const m = coincideRasgos(ras, cap, i);
    if (m && (!soloInicios || !prev)) out.push(ras.V[i].time);
    prev = m;
  }
  return out;
}

/* ── Texto legible (EN/ES) de un rasgo, para la libreta ── */
const _CRUCE = 0.1;   // |gap%| por debajo de esto ≈ "cruce"
export function rasgoLabel(c, lang) {
  const es = lang === 'es';
  const up = c.dir > 0, pos = c.val >= 0;
  const abs = Math.abs(c.val);
  switch (c.kind) {
    case 'gap':
      if (abs <= _CRUCE) return es ? `${c.nm} cruza ${c.nm2} hacia ${up ? 'arriba' : 'abajo'}` : `${c.nm} crossing ${c.nm2} ${up ? 'up' : 'down'}`;
      return es ? `${c.nm} ${pos ? 'sobre' : 'bajo'} ${c.nm2} ${abs.toFixed(2)}% (${up ? 'subiendo' : 'bajando'})` : `${c.nm} ${pos ? 'above' : 'below'} ${c.nm2} by ${abs.toFixed(2)}% (${up ? 'rising' : 'falling'})`;
    case 'pdist':
      return es ? `Precio ${pos ? 'sobre' : 'bajo'} ${c.nm} ${abs.toFixed(2)}% (${up ? 'subiendo' : 'bajando'})` : `Price ${pos ? 'above' : 'below'} ${c.nm} by ${abs.toFixed(2)}% (${up ? 'rising' : 'falling'})`;
    case 'cross':
      if (abs <= (c.id.indexOf('STOCH') > -1 || c.id.indexOf('ADX') > -1 || c.id.indexOf('AROON') > -1 ? 2 : _CRUCE)) return es ? `${c.nm} cruza ${c.nm2} hacia ${up ? 'arriba' : 'abajo'}` : `${c.nm} crossing ${c.nm2} ${up ? 'up' : 'down'}`;
      return es ? `${c.nm} ${pos ? 'sobre' : 'bajo'} ${c.nm2} (${up ? 'subiendo' : 'bajando'})` : `${c.nm} ${pos ? 'above' : 'below'} ${c.nm2} (${up ? 'rising' : 'falling'})`;
    case 'hist':
      return es ? `${c.nm} ${pos ? 'positivo' : 'negativo'} (${up ? 'creciendo' : 'decreciendo'})` : `${c.nm} histogram ${pos ? 'positive' : 'negative'} (${up ? 'growing' : 'shrinking'})`;
    case 'dir':
      return es ? `${c.nm} ${pos ? 'alcista' : 'bajista'}` : `${c.nm} ${pos ? 'bullish' : 'bearish'}`;
    case 'level':
    default:
      return es ? `${c.nm} en ${c.val.toFixed(c.id.indexOf('pctb') > -1 ? 0 : (abs < 5 ? 2 : 0))}${c.id.indexOf('pctb') > -1 ? '% del canal' : ''}` : `${c.nm} at ${c.val.toFixed(c.id.indexOf('pctb') > -1 ? 0 : (abs < 5 ? 2 : 0))}${c.id.indexOf('pctb') > -1 ? '% of band' : ''}`;
  }
}
