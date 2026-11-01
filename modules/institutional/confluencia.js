/* modules/institutional/confluencia.js — MOTOR DE CONFLUENCIA (v4).

   Diferencia CLAVE con v3: los CRUCES se detectan como EVENTO (cambio de signo
   de la diferencia entre dos líneas), NO como "gap cerca de cero". Antes, clicar
   en un cruce capturaba "gap≈0" y disparaba donde las medias solo se ACERCABAN,
   y fallaba en cruces reales. Ahora: si clicas CERCA de un cruce real, la regla
   es el EVENTO de cruce (misma dirección); si clicas lejos de un cruce, la regla
   es la DISTANCIA exacta (% con tolerancia ajustada). Preciso como un reloj.

   Cada punto marcado captura un VECTOR DE RASGOS; una vela coincide solo si TODOS
   los rasgos (de indicadores aún activos) vuelven a darse a la vez. Solo mates:
   la UI (institutional.js) lo consume. */

import { ema, sma, wma, hma, dema, tema, vwma, alma, zlema, kama, vwapBands,
  bollinger, donchian, keltner, envelopes, psar, supertrend, rsi, macd, ppo,
  stochastic, stochRsi, atr, cci, williams, obv, roc, adx, mfi, awesome,
  momentum, stddev, ultimate, cmf, trix, vortex, aroon, fisher, cmo } from './indicadores.js?v=6';

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
/* σ de los últimos ~160 valores (para tolerancias ajustadas por rasgo). */
function _sigma(vals) {
  const xs = []; for (let i = vals.length - 1; i >= 0 && xs.length < 160; i--) if (isFinite(vals[i])) xs.push(vals[i]);
  if (xs.length < 8) return NaN;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
}
function _tolDist(vals, unit) { const s = _sigma(vals); const min = unit === 'pts' ? 2.5 : 0.08; return isFinite(s) ? Math.max(min, 0.3 * s) : (min * 3); }
function _tolLevel(vals) { const s = _sigma(vals); return isFinite(s) ? Math.max(3, 0.4 * s) : 6; }
function _tolHist(vals) { const s = _sigma(vals); return isFinite(s) ? Math.max(0.02, 0.4 * s) : 0.1; }
/* Eventos de cruce: +1 si la serie cruza 0 hacia arriba en i, −1 hacia abajo. */
function _cruces(vals) {
  const n = vals.length, c = new Int8Array(n); let prev = NaN;
  for (let i = 0; i < n; i++) { const v = vals[i]; if (isFinite(v) && isFinite(prev)) { if (prev <= 0 && v > 0) c[i] = 1; else if (prev >= 0 && v < 0) c[i] = -1; } if (isFinite(v)) prev = v; }
  return c;
}
function _pend(vals, i) { if (i <= 0) return 0; const a = vals[i], b = vals[i - 1]; if (!isFinite(a) || !isFinite(b)) return 0; return a >= b ? 1 : -1; }

/* Banco de rasgos de los indicadores ACTIVOS. Tipos:
   'par'   dos líneas (medias, %K/%D, MACD/señal, DI±, etc.) → cruce o distancia.
   'level' un valor (RSI, CCI, %B de banda…) → nivel.
   'hist'  histograma (MACD, AO, Momentum…) → valor + pendiente.
   'dir'   dirección binaria (Supertrend, PSAR, OBV). */
export function construirRasgos(activeKeys, V) {
  const n = V.length;
  const close = new Float64Array(n); for (let i = 0; i < n; i++) close[i] = V[i].close;
  const timeIdx = new Map(); for (let i = 0; i < n; i++) timeIdx.set(V[i].time, i);
  const alinear = (serie) => { const a = new Float64Array(n).fill(NaN); if (serie) for (const p of serie) { const i = timeIdx.get(p.time); if (i != null && p && p.value != null && isFinite(p.value)) a[i] = p.value; } return a; };
  const restaPct = (aA, bA) => { const o = new Float64Array(n).fill(NaN); for (let i = 0; i < n; i++) if (isFinite(aA[i]) && isFinite(bA[i]) && close[i]) o[i] = (aA[i] - bA[i]) / close[i] * 100; return o; };
  const resta = (aA, bA) => { const o = new Float64Array(n).fill(NaN); for (let i = 0; i < n; i++) if (isFinite(aA[i]) && isFinite(bA[i])) o[i] = aA[i] - bA[i]; return o; };
  const pct = (aA) => { const o = new Float64Array(n).fill(NaN); for (let i = 0; i < n; i++) if (isFinite(aA[i]) && close[i]) o[i] = aA[i] / close[i] * 100; return o; };
  const feats = [];
  const addPar = (id, keys, vals, nm, nm2, unit) => feats.push({ id, keys, kind: 'par', vals, cruces: _cruces(vals), tol: _tolDist(vals, unit), nm, nm2, unit: unit || '%' });
  const addLvl = (id, keys, vals, nm, unit) => feats.push({ id, keys, kind: 'level', vals, tol: _tolLevel(vals), nm, unit: unit || '' });
  const addHist = (id, keys, vals, nm) => feats.push({ id, keys, kind: 'hist', vals, tol: _tolHist(vals), nm });
  const addDir = (id, keys, vals, nm) => feats.push({ id, keys, kind: 'dir', vals, tol: 0.5, nm });

  // ── Medias: pares consecutivos (la rápida vs la lenta). Con 1 sola media → precio vs media ──
  const maKeys = activeKeys.filter((k) => MA_PER[k] != null).sort((a, b) => MA_PER[a] - MA_PER[b]);
  if (maKeys.length) {
    const S = {}; maKeys.forEach((k) => { S[k] = alinear(_serieMA(k, V)); });
    if (maKeys.length >= 2) {
      for (let p = 0; p < maKeys.length - 1; p++) { const f = maKeys[p], s = maKeys[p + 1]; addPar('gap:' + f + ':' + s, [f, s], restaPct(S[f], S[s]), nmDe(f), nmDe(s), '%'); }
    } else { const k = maKeys[0], v = new Float64Array(n).fill(NaN); for (let i = 0; i < n; i++) if (isFinite(S[k][i]) && close[i]) v[i] = (close[i] - S[k][i]) / close[i] * 100; addPar('pdist:' + k, [k], v, 'Price', nmDe(k), '%'); }
  }
  for (const k of activeKeys) {
    if (MA_PER[k] != null) continue;
    try {
      switch (k) {
        case 'RSI': addLvl('lvl:RSI', [k], alinear(rsi(V, 14)), 'RSI'); break;
        case 'MACD': { const m = macd(V); addPar('cross:MACD', [k], restaPct(alinear(m.macd), alinear(m.signal)), 'MACD', 'signal', '%'); addHist('hist:MACD', [k], pct(alinear(m.histogram)), 'MACD'); break; }
        case 'PPO': { const m = ppo(V); addPar('cross:PPO', [k], resta(alinear(m.ppo), alinear(m.signal)), 'PPO', 'signal', 'pts'); addHist('hist:PPO', [k], alinear(m.histogram), 'PPO'); break; }
        case 'STOCH': { const st = stochastic(V); addPar('cross:STOCH', [k], resta(alinear(st.k), alinear(st.d)), '%K', '%D', 'pts'); addLvl('lvl:STOCH', [k], alinear(st.k), 'Stochastic %K'); break; }
        case 'STOCHRSI': { const st = stochRsi(V); addPar('cross:STOCHRSI', [k], resta(alinear(st.k), alinear(st.d)), '%K', '%D', 'pts'); addLvl('lvl:STOCHRSI', [k], alinear(st.k), 'Stoch RSI %K'); break; }
        case 'CCI': addLvl('lvl:CCI', [k], alinear(cci(V, 20)), 'CCI'); break;
        case 'WILL': addLvl('lvl:WILL', [k], alinear(williams(V, 14)), 'Williams %R'); break;
        case 'MFI': addLvl('lvl:MFI', [k], alinear(mfi(V, 14)), 'MFI'); break;
        case 'UO': addLvl('lvl:UO', [k], alinear(ultimate(V)), 'Ultimate Osc.'); break;
        case 'ROC': addLvl('lvl:ROC', [k], alinear(roc(V, 12)), 'ROC'); break;
        case 'MOM': addHist('hist:MOM', [k], pct(alinear(momentum(V, 10))), 'Momentum'); break;
        case 'CMO': addLvl('lvl:CMO', [k], alinear(cmo(V, 14)), 'CMO'); break;
        case 'CMF': addLvl('lvl:CMF', [k], alinear(cmf(V, 20)), 'Chaikin MF'); break;
        case 'TRIX': addHist('hist:TRIX', [k], alinear(trix(V, 15).trix), 'TRIX'); break;
        case 'AO': addHist('hist:AO', [k], pct(alinear(awesome(V))), 'Awesome Osc.'); break;
        case 'STDDEV': addLvl('lvl:STDDEV', [k], pct(alinear(stddev(V, 20))), 'Std Dev', '%'); break;
        case 'ATR': addLvl('lvl:ATR', [k], pct(alinear(atr(V, 14))), 'ATR', '%'); break;
        case 'OBV': { const o = alinear(obv(V)), d = new Float64Array(n).fill(NaN); for (let i = 1; i < n; i++) if (isFinite(o[i]) && isFinite(o[i - 1])) d[i] = o[i] >= o[i - 1] ? 1 : -1; addDir('dir:OBV', [k], d, 'OBV'); break; }
        case 'ADX': { const a = adx(V, 14); addLvl('lvl:ADX', [k], alinear(a.adx), 'ADX'); addPar('cross:ADX', [k], resta(alinear(a.plus), alinear(a.minus)), '+DI', '−DI', 'pts'); break; }
        case 'ST': { const st = supertrend(V, 10, 3), d = new Float64Array(n).fill(NaN); for (const p of st) { const i = timeIdx.get(p.time); if (i != null) d[i] = p.dir === 1 ? 1 : -1; } addDir('dir:ST', [k], d, 'Supertrend'); break; }
        case 'PSAR': { const ps = psar(V), d = new Float64Array(n).fill(NaN); for (const p of ps) { const i = timeIdx.get(p.time); if (i != null) d[i] = p.dir === 1 ? 1 : -1; } addDir('dir:PSAR', [k], d, 'Parabolic SAR'); break; }
        case 'VORTEX': { const vx = vortex(V, 14); addPar('cross:VORTEX', [k], resta(alinear(vx.plus), alinear(vx.minus)), 'VI+', 'VI−', 'pts'); break; }
        case 'AROON': { const ar = aroon(V, 14); addPar('cross:AROON', [k], resta(alinear(ar.up), alinear(ar.down)), 'Aroon Up', 'Down', 'pts'); break; }
        case 'FISHER': { const fi = fisher(V, 9); addPar('cross:FISHER', [k], resta(alinear(fi.fisher), alinear(fi.trigger)), 'Fisher', 'trigger', 'pts'); break; }
        case 'BOLL': case 'DONCH': case 'KELT': case 'ENV': {
          const b = k === 'BOLL' ? bollinger(V, 20, 2) : k === 'DONCH' ? donchian(V, 20) : k === 'KELT' ? keltner(V, 20, 2) : envelopes(V, 20, 2.5);
          const U = alinear(b.upper), L = alinear(b.lower), v = new Float64Array(n).fill(NaN);
          for (let i = 0; i < n; i++) { if (isFinite(U[i]) && isFinite(L[i]) && U[i] !== L[i]) v[i] = (close[i] - L[i]) / (U[i] - L[i]) * 100; }
          addLvl('pctb:' + k, [k], v, nmDe(k), '%b'); break;
        }
        default: break;
      }
    } catch (_) {}
  }
  return { V, n, feats, timeIdx };
}

const _VENT = 2;   // ventana (velas) para considerar que el clic cayó "en" un cruce
/* Captura el vector de rasgos en una vela (índice). Decide cruce vs distancia. */
export function capturarRasgos(ras, barIdx) {
  const cap = [];
  for (const f of ras.feats) {
    if (f.kind === 'par') {
      let cr = 0; for (let d = 0; d <= _VENT && !cr; d++) { if (barIdx + d < f.cruces.length && f.cruces[barIdx + d]) cr = f.cruces[barIdx + d]; else if (barIdx - d >= 0 && f.cruces[barIdx - d]) cr = f.cruces[barIdx - d]; }
      if (cr) { cap.push({ id: f.id, keys: f.keys.slice(), mode: 'cross', dir: cr, nm: f.nm, nm2: f.nm2 }); }
      else { const v = f.vals[barIdx]; if (isFinite(v)) cap.push({ id: f.id, keys: f.keys.slice(), mode: 'dist', val: v, tol: f.tol, nm: f.nm, nm2: f.nm2, unit: f.unit }); }
    } else if (f.kind === 'level') { const v = f.vals[barIdx]; if (isFinite(v)) cap.push({ id: f.id, keys: f.keys.slice(), mode: 'level', val: v, tol: f.tol, nm: f.nm, unit: f.unit }); }
    else if (f.kind === 'hist') { const v = f.vals[barIdx]; if (isFinite(v)) cap.push({ id: f.id, keys: f.keys.slice(), mode: 'hist', val: v, tol: f.tol, dir: _pend(f.vals, barIdx), nm: f.nm }); }
    else if (f.kind === 'dir') { const v = f.vals[barIdx]; if (isFinite(v)) cap.push({ id: f.id, keys: f.keys.slice(), mode: 'dir', val: v, nm: f.nm }); }
  }
  return cap;
}
export function rasgosActivos(ras, cap) {
  const fid = {}; for (const f of ras.feats) fid[f.id] = 1; const act = new Set();
  for (const c of cap) if (fid[c.id]) c.keys.forEach((k) => act.add(k)); return act.size;
}
/* ¿La vela barIdx cumple la confluencia? Los CRUCES son eventos exactos y siempre
   obligatorios; de las reglas CONTINUAS (distancia/nivel/histograma) basta con que
   coincida el _CONF_FRAC (75%). Así, al añadir muchos indicadores el sistema NO deja
   de encontrar confluencias (antes, exigir todas a la vez las volvía imposibles: 6
   indicadores → 1 marca). Con 1-3 reglas sigue siendo exacto. Mínimo 1 indicador. */
const _CONF_FRAC = 0.75;
export function coincideRasgos(ras, cap, barIdx) {
  const fById = {}; for (const f of ras.feats) fById[f.id] = f;
  const act = new Set(); let cont = 0, contOk = 0;
  for (const c of cap) {
    const f = fById[c.id]; if (!f) continue;                          // indicador quitado → no cuenta
    c.keys.forEach((k) => act.add(k));
    if (c.mode === 'cross') { if (f.cruces[barIdx] !== c.dir) return false; continue; }   // cruce obligatorio
    cont++;
    const v = f.vals[barIdx];
    let ok = isFinite(v) && Math.abs(v - c.val) <= c.tol;
    if (ok && c.mode === 'hist' && c.dir && _pend(f.vals, barIdx) !== c.dir) ok = false;
    if (ok) contOk++;
  }
  if (act.size < 1) return false;
  const need = cont === 0 ? 0 : Math.max(1, Math.ceil(cont * _CONF_FRAC));
  return contOk >= need;
}
export function escanearRasgos(ras, cap, soloInicios = true) {
  const out = []; let prev = false;
  for (let i = 0; i < ras.n; i++) { const m = coincideRasgos(ras, cap, i); if (m && (!soloInicios || !prev)) out.push(ras.V[i].time); prev = m; }
  return out;
}
/* ¿El rasgo c se cumple en la vela barIdx? (para las palomitas de la libreta) */
export function cumpleRasgo(ras, c, barIdx) {
  const f = (ras.feats.find((x) => x.id === c.id)); if (!f) return null;   // null → tachado (indicador quitado)
  if (c.mode === 'cross') return f.cruces[barIdx] === c.dir;
  const v = f.vals[barIdx]; if (!isFinite(v)) return false;
  if (Math.abs(v - c.val) > c.tol) return false;
  if (c.mode === 'hist' && c.dir && _pend(f.vals, barIdx) !== c.dir) return false;
  return true;
}

/* ── Texto legible (EN/ES) de un rasgo ── */
function _num(v, unit) { const a = Math.abs(v); const dec = unit === 'pts' ? (a < 10 ? 1 : 0) : (a < 5 ? 2 : (a < 20 ? 1 : 0)); return v.toFixed(dec); }
export function rasgoLabel(c, lang) {
  const es = lang === 'es', up = c.dir > 0, pos = c.val >= 0, u = c.unit === 'pts' ? ' pts' : c.unit === '%b' ? '% of band' : (c.unit === '%' ? '%' : '');
  switch (c.mode) {
    case 'cross':
      return es ? `${c.nm} cruza ${c.nm2} hacia ${up ? 'arriba' : 'abajo'}` : `${c.nm} crossing ${c.nm2} ${up ? 'up' : 'down'}`;
    case 'dist':
      if (c.nm === 'Price') return es ? `Precio ${pos ? 'sobre' : 'bajo'} ${c.nm2} ${_num(Math.abs(c.val), c.unit)}${u}` : `Price ${pos ? 'above' : 'below'} ${c.nm2} by ${_num(Math.abs(c.val), c.unit)}${u}`;
      return es ? `${c.nm} ${pos ? 'sobre' : 'bajo'} ${c.nm2} ${_num(Math.abs(c.val), c.unit)}${u}` : `${c.nm} ${pos ? 'above' : 'below'} ${c.nm2} by ${_num(Math.abs(c.val), c.unit)}${u}`;
    case 'hist':
      return es ? `${c.nm} ${pos ? 'positivo' : 'negativo'} (${up ? 'creciendo' : 'decreciendo'})` : `${c.nm} histogram ${pos ? 'positive' : 'negative'} (${up ? 'growing' : 'shrinking'})`;
    case 'dir':
      return es ? `${c.nm} ${pos ? 'alcista' : 'bajista'}` : `${c.nm} ${pos ? 'bullish' : 'bearish'}`;
    case 'level':
    default:
      return es ? `${c.nm} en ${_num(c.val, c.unit)}${c.unit === '%b' ? '% del canal' : ''}` : `${c.nm} at ${_num(c.val, c.unit)}${c.unit === '%b' ? '% of band' : ''}`;
  }
}
