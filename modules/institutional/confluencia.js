/* modules/institutional/confluencia.js — MOTOR DE CONFLUENCIA (v5, por ESTADOS).

   Problema de las versiones anteriores: capturaban el CRUCE exacto (obligatorio en
   la misma vela) y las continuas con tolerancias finas. Con varios indicadores la
   confluencia se volvía casi imposible (6 indicadores → 1 marca) y, según dónde
   clicaras, la regla era o demasiado estricta o demasiado laxa: alertas "sin
   sentido".

   v5: cada indicador aporta un ESTADO alcista/bajista (+1/−1) según de qué lado de
   su neutro está (medias: rápida vs lenta; osciladores: sobre/bajo su línea media;
   histogramas: signo; Supertrend/PSAR/OBV: dirección). Un punto marcado captura el
   VECTOR DE ESTADOS; una vela coincide si la gran mayoría de esos estados se
   repiten. Los estados PERSISTEN, así que la combinación vuelve a darse, escala con
   muchos indicadores y la alerta dispara cuando se RE-ALINEA. La UI
   (institutional.js) lo consume. */

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
/* Mediana de los valores finitos (neutro de los niveles sin umbral natural). */
function _median(vals) {
  const xs = []; for (let i = 0; i < vals.length; i++) if (isFinite(vals[i])) xs.push(vals[i]);
  if (!xs.length) return 0; xs.sort((a, b) => a - b); return xs[xs.length >> 1];
}
/* Neutro (línea media) de cada indicador de NIVEL. Para una confluencia no
   importa el valor exacto sino de qué LADO está: alcista vs bajista. Los que no
   tienen umbral natural (ATR, Std Dev) usan su propia mediana. */
const NEUTRAL = { 'lvl:RSI': 50, 'lvl:STOCH': 50, 'lvl:STOCHRSI': 50, 'lvl:CCI': 0, 'lvl:WILL': -50, 'lvl:MFI': 50, 'lvl:UO': 50, 'lvl:ROC': 0, 'lvl:CMO': 0, 'lvl:CMF': 0, 'lvl:ADX': 25, 'pctb:BOLL': 50, 'pctb:DONCH': 50, 'pctb:KELT': 50, 'pctb:ENV': 50 };
/* ESTADO del rasgo en una vela: +1 (alcista / sobre el neutro) o −1 (bajista /
   bajo el neutro). 0 = sin dato. Es el corazón del motor nuevo: una confluencia
   es una COMBINACIÓN DE ESTADOS que se repite, no un valor exacto ni un cruce en
   la misma vela (eso volvía imposible juntar varios indicadores: 6 → 1 marca).
   Los estados PERSISTEN, así que la combinación vuelve a darse y la alerta
   dispara al re-alinearse. */
function _estado(f, i) {
  const v = f.vals[i];
  if (!isFinite(v)) return 0;
  if (f.kind === 'dir') return v >= 0 ? 1 : -1;
  const neu = (f.neutral == null ? 0 : f.neutral);
  return v >= neu ? 1 : -1;
}

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
  const addPar = (id, keys, vals, nm, nm2, unit) => feats.push({ id, keys, kind: 'par', vals, neutral: 0, nm, nm2, unit: unit || '%' });
  const addLvl = (id, keys, vals, nm, unit) => feats.push({ id, keys, kind: 'level', vals, neutral: (NEUTRAL[id] != null ? NEUTRAL[id] : _median(vals)), nm, unit: unit || '' });
  const addHist = (id, keys, vals, nm) => feats.push({ id, keys, kind: 'hist', vals, neutral: 0, nm });
  const addDir = (id, keys, vals, nm) => feats.push({ id, keys, kind: 'dir', vals, neutral: 0, nm });

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

/* Captura el VECTOR DE ESTADOS en la vela del punto marcado. */
export function capturarRasgos(ras, barIdx) {
  const cap = [];
  for (const f of ras.feats) {
    const st = _estado(f, barIdx);
    if (st === 0) continue;                 // sin dato de ese indicador aquí → no entra
    cap.push({ id: f.id, keys: f.keys.slice(), kind: f.kind, side: st, nm: f.nm, nm2: f.nm2, unit: f.unit });
  }
  return cap;
}
export function rasgosActivos(ras, cap) {
  const fid = {}; for (const f of ras.feats) fid[f.id] = 1; const act = new Set();
  for (const c of cap) if (fid[c.id]) c.keys.forEach((k) => act.add(k)); return act.size;
}
/* ¿La vela barIdx reproduce la confluencia? Coincide si la gran mayoría de los
   estados capturados (de indicadores aún activos) se repiten. _CONF_FRAC tolera
   que UNO parpadee (con 1-2 reglas se exige todo). Como los estados persisten,
   juntar MUCHOS indicadores ya NO vuelve la confluencia imposible. Mínimo 1. */
const _CONF_FRAC = 0.8;
export function coincideRasgos(ras, cap, barIdx) {
  const fById = {}; for (const f of ras.feats) fById[f.id] = f;
  const act = new Set(); let total = 0, ok = 0;
  for (const c of cap) {
    const f = fById[c.id]; if (!f) continue;             // indicador quitado → no cuenta
    c.keys.forEach((k) => act.add(k));
    total++;
    if (_estado(f, barIdx) === c.side) ok++;
  }
  if (act.size < 1 || total === 0) return false;
  return ok >= Math.max(1, Math.ceil(total * _CONF_FRAC));
}
export function escanearRasgos(ras, cap, soloInicios = true) {
  const out = []; let prev = false;
  for (let i = 0; i < ras.n; i++) { const m = coincideRasgos(ras, cap, i); if (m && (!soloInicios || !prev)) out.push(ras.V[i].time); prev = m; }
  return out;
}
/* ¿El estado c se cumple en la vela barIdx? (para las palomitas de la libreta) */
export function cumpleRasgo(ras, c, barIdx) {
  const f = ras.feats.find((x) => x.id === c.id); if (!f) return null;   // null → tachado (indicador quitado)
  const st = _estado(f, barIdx); if (st === 0) return false;
  return st === c.side;
}

/* ── Texto legible (EN/ES) de un estado ── */
export function rasgoLabel(c, lang) {
  const es = lang === 'es', up = c.side > 0;
  switch (c.kind) {
    case 'par':
      if (c.nm === 'Price') return es ? `Precio ${up ? 'sobre' : 'bajo'} ${c.nm2}` : `Price ${up ? 'above' : 'below'} ${c.nm2}`;
      return es ? `${c.nm} ${up ? 'sobre' : 'bajo'} ${c.nm2}` : `${c.nm} ${up ? 'above' : 'below'} ${c.nm2}`;
    case 'hist':
      return es ? `${c.nm} ${up ? 'positivo' : 'negativo'}` : `${c.nm} histogram ${up ? 'positive' : 'negative'}`;
    case 'dir':
      return es ? `${c.nm} ${up ? 'alcista' : 'bajista'}` : `${c.nm} ${up ? 'bullish' : 'bearish'}`;
    case 'level':
    default:
      if (c.id === 'lvl:ADX') return es ? `ADX: tendencia ${up ? 'fuerte' : 'débil'}` : `ADX: ${up ? 'strong' : 'weak'} trend`;
      if (c.id === 'lvl:ATR' || c.id === 'lvl:STDDEV') return es ? `${c.nm} ${up ? 'alta' : 'baja'}` : `${c.nm} ${up ? 'high' : 'low'}`;
      if (c.unit === '%b') return es ? `${c.nm}: mitad ${up ? 'alta' : 'baja'} del canal` : `${c.nm}: ${up ? 'upper' : 'lower'} half of band`;
      return es ? `${c.nm} ${up ? 'alcista' : 'bajista'}` : `${c.nm} ${up ? 'bullish' : 'bearish'}`;
  }
}
