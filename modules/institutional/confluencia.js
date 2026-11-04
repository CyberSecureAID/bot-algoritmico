/* modules/institutional/confluencia.js — MOTOR DE CONFLUENCIA (v8, GEOMETRIA EXACTA).

   v8 sobre v6: las lineas de PRECIO (medias moviles, las TRES bandas del VWAP y las
   bandas de Bollinger / Donchian / Keltner / Envelopes) ya no aportan solo un
   "lado" (encima o debajo). Ahora se captura la GEOMETRIA EXACTA del punto marcado:
   la distancia en POR CIENTO del precio entre cada par de lineas consecutivas del
   apilado. Una vela coincide SOLO cuando ese mismo apilado vuelve a darse dentro de
   una tolerancia (en el pasado y en vivo). Asi la regla deja de ser "VWAP bajo
   EMA 50" y pasa a ser "VWAP superior 0.4% sobre la central, central 0.3% sobre la
   EMA 50 ...": la configuracion precisa que el usuario pidio.

   Ejemplo: VWAP (banda superior, central e inferior) + EMA 50. Son cuatro lineas de
   precio. Se ordenan por valor en la vela marcada y se guardan las distancias en %
   entre cada par contiguo. La alerta salta cuando esas MISMAS distancias (mismo
   orden, mismo %) se repiten dentro de la tolerancia.

   Los OSCILADORES (RSI, MACD, estocastico, ADX, etc.) conservan el motor de ESTADOS
   de v6 (lado + fuerza/magnitud): para ellos lo que importa es sobre/bajo su neutro
   y con que dinamica, no una distancia en % del precio.

   RENDIMIENTO: los mapas de busqueda (linea por id, rasgo por id) se precalculan UNA
   vez en construirRasgos y el escaneo resuelve los arrays ANTES del bucle de velas,
   asi el barrido es O(velas x condiciones) sin reconstruir nada por vela. Por eso ya
   no se congela con muchos indicadores. La UI (institutional.js) lo consume igual:
   mismas funciones exportadas. */

import { ema, sma, wma, hma, dema, tema, vwma, alma, zlema, kama, vwapBands,
  bollinger, donchian, keltner, envelopes, psar, supertrend, rsi, macd, ppo,
  stochastic, stochRsi, atr, cci, williams, obv, roc, adx, mfi, awesome,
  momentum, stddev, ultimate, cmf, trix, vortex, aroon, fisher, cmo } from './indicadores.js?v=6';

const MA_PER = { EMA9: 9, EMA20: 20, EMA50: 50, EMA100: 100, EMA200: 200, SMA: 20, WMA: 20, HMA: 20, DEMA: 20, TEMA: 20, VWMA: 20, ALMA: 20, ZLEMA: 20, KAMA: 10 };
const NM = { EMA9: 'EMA 9', EMA20: 'EMA 20', EMA50: 'EMA 50', EMA100: 'EMA 100', EMA200: 'EMA 200', SMA: 'SMA 20', WMA: 'WMA 20', HMA: 'HMA 20', DEMA: 'DEMA 20', TEMA: 'TEMA 20', VWMA: 'VWMA 20', ALMA: 'ALMA 20', ZLEMA: 'ZLEMA 20', KAMA: 'KAMA 10', VWAP: 'VWAP', RSI: 'RSI', MACD: 'MACD', PPO: 'PPO', STOCH: 'Stochastic', STOCHRSI: 'Stoch RSI', CCI: 'CCI', WILL: 'Williams %R', MFI: 'MFI', UO: 'Ultimate Osc.', ROC: 'ROC', MOM: 'Momentum', CMO: 'CMO', CMF: 'Chaikin MF', TRIX: 'TRIX', AO: 'Awesome Osc.', OBV: 'OBV', ATR: 'ATR', STDDEV: 'Std Dev', ADX: 'ADX', PSAR: 'Parabolic SAR', ST: 'Supertrend', BOLL: 'Bollinger', DONCH: 'Donchian', KELT: 'Keltner', ENV: 'Envelopes', VORTEX: 'Vortex', AROON: 'Aroon', FISHER: 'Fisher' };
const nmDe = (k) => NM[k] || k;
const _SOP = new Set(Object.keys(NM));
export function soportado(k) { return _SOP.has(k); }

/* Lineas de precio de cada indicador de BANDA (3 lineas: superior, central,
   inferior). El VWAP tiene sus tres medias; Bollinger/Donchian/Keltner/Envelopes
   tambien. Se devuelven ya como {upper, middle, lower} en series {time,value}. */
function _bandas(k, V) {
  switch (k) {
    case 'VWAP': { const b = vwapBands(V, 2); return { upper: b.up, middle: b.mid, lower: b.lo }; }
    case 'BOLL': return bollinger(V, 20, 2);
    case 'DONCH': return donchian(V, 20);
    case 'KELT': return keltner(V, 20, 2);
    case 'ENV': return envelopes(V, 20, 2.5);
    default: return null;
  }
}
const _ES_BANDA = (k) => k === 'VWAP' || k === 'BOLL' || k === 'DONCH' || k === 'KELT' || k === 'ENV';

function _serieMA(k, V) {
  switch (k) {
    case 'EMA9': return ema(V, 9); case 'EMA20': return ema(V, 20); case 'EMA50': return ema(V, 50);
    case 'EMA100': return ema(V, 100); case 'EMA200': return ema(V, 200);
    case 'SMA': return sma(V, 20); case 'WMA': return wma(V, 20); case 'HMA': return hma(V, 20);
    case 'DEMA': return dema(V, 20); case 'TEMA': return tema(V, 20);
    case 'VWMA': return vwma(V, 20); case 'ALMA': return alma(V, 20); case 'ZLEMA': return zlema(V, 20); case 'KAMA': return kama(V, 10);
    default: return [];
  }
}
/* Mediana de los valores finitos (neutro de los niveles sin umbral natural). */
function _median(vals) {
  const xs = []; for (let i = 0; i < vals.length; i++) if (isFinite(vals[i])) xs.push(vals[i]);
  if (!xs.length) return 0; xs.sort((a, b) => a - b); return xs[xs.length >> 1];
}
/* Neutro (linea media) de cada indicador de NIVEL. Para una confluencia no importa
   el valor exacto sino de que LADO esta: alcista vs bajista. Los que no tienen
   umbral natural (ATR, Std Dev) usan su propia mediana. */
const NEUTRAL = { 'lvl:RSI': 50, 'lvl:STOCH': 50, 'lvl:STOCHRSI': 50, 'lvl:CCI': 0, 'lvl:WILL': -50, 'lvl:MFI': 50, 'lvl:UO': 50, 'lvl:ROC': 0, 'lvl:CMO': 0, 'lvl:CMF': 0, 'lvl:ADX': 25 };

/* Tolerancia de una distancia en % del precio: 30% de la distancia marcada, con un
   suelo de 0.10% para que distancias casi cero no exijan precision imposible. */
const _DIST_REL = 0.30;
const _DIST_ABS = 0.10;
const _tolDist = (d0) => Math.max(_DIST_ABS, Math.abs(d0) * _DIST_REL);

/* ESTADO de un rasgo oscilador en una vela: +1 (alcista / sobre el neutro) o −1
   (bajista / bajo el neutro). 0 = sin dato. */
function _estado(f, i) {
  const v = f.vals[i];
  if (!isFinite(v)) return 0;
  if (f.kind === 'dir') return v >= 0 ? 1 : -1;
  const neu = (f.neutral == null ? 0 : f.neutral);
  return v >= neu ? 1 : -1;
}

/* Banco de rasgos de los indicadores ACTIVOS.
   - LINEAS de precio (ras.lines): medias + 3 bandas de VWAP/Bollinger/etc. Entre
     ellas se mide la GEOMETRIA (distancias en % del precio).
   - RASGOS osciladores (ras.feats): 'par' dos lineas propias (MACD/senal, %K/%D,
     DI±...), 'level' un nivel (RSI, CCI...), 'hist' histograma, 'dir' direccion. */
export function construirRasgos(activeKeys, V) {
  const n = V.length;
  const close = new Float64Array(n); for (let i = 0; i < n; i++) close[i] = V[i].close;
  const timeIdx = new Map(); for (let i = 0; i < n; i++) timeIdx.set(V[i].time, i);
  const alinear = (serie) => { const a = new Float64Array(n).fill(NaN); if (serie) for (const p of serie) { const i = timeIdx.get(p.time); if (i != null && p && p.value != null && isFinite(p.value)) a[i] = p.value; } return a; };
  const resta = (aA, bA) => { const o = new Float64Array(n).fill(NaN); for (let i = 0; i < n; i++) if (isFinite(aA[i]) && isFinite(bA[i])) o[i] = aA[i] - bA[i]; return o; };
  const restaPct = (aA, bA) => { const o = new Float64Array(n).fill(NaN); for (let i = 0; i < n; i++) if (isFinite(aA[i]) && isFinite(bA[i]) && close[i]) o[i] = (aA[i] - bA[i]) / close[i] * 100; return o; };
  const pct = (aA) => { const o = new Float64Array(n).fill(NaN); for (let i = 0; i < n; i++) if (isFinite(aA[i]) && close[i]) o[i] = aA[i] / close[i] * 100; return o; };

  // ── LINEAS DE PRECIO ──
  const lines = [];
  const addLine = (id, key, nm, serie) => { lines.push({ id, key, nm, arr: alinear(serie) }); };
  for (const k of activeKeys) {
    try {
      if (_ES_BANDA(k)) {
        const b = _bandas(k, V); if (!b) continue;
        addLine('ln:' + k + ':up', k, nmDe(k) + ' upper', b.upper);
        addLine('ln:' + k + ':mid', k, nmDe(k) + (k === 'VWAP' ? '' : ' mid'), b.middle);
        addLine('ln:' + k + ':lo', k, nmDe(k) + ' lower', b.lower);
      } else if (MA_PER[k] != null) {
        addLine('ln:' + k, k, nmDe(k), _serieMA(k, V));
      }
    } catch (_) {}
  }

  // ── RASGOS OSCILADORES ──
  const feats = [];
  const addPar = (id, keys, vals, nm, nm2, unit) => feats.push({ id, keys, kind: 'par', vals, neutral: 0, nm, nm2, unit: unit || '%' });
  const addLvl = (id, keys, vals, nm, unit) => feats.push({ id, keys, kind: 'level', vals, neutral: (NEUTRAL[id] != null ? NEUTRAL[id] : _median(vals)), nm, unit: unit || '' });
  const addHist = (id, keys, vals, nm) => feats.push({ id, keys, kind: 'hist', vals, neutral: 0, nm });
  const addDir = (id, keys, vals, nm) => feats.push({ id, keys, kind: 'dir', vals, neutral: 0, nm });
  for (const k of activeKeys) {
    if (_ES_BANDA(k) || MA_PER[k] != null) continue;   // esas ya son lineas de precio
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
        default: break;
      }
    } catch (_) {}
  }

  const lineById = new Map(); for (const ln of lines) lineById.set(ln.id, ln);
  const featById = new Map(); for (const f of feats) featById.set(f.id, f);
  return { V, n, close, lines, feats, timeIdx, _lineById: lineById, _featById: featById };
}

/* Captura la CONFIGURACION del punto marcado:
   - GEOMETRIA de las lineas de precio: se ordenan por valor en esa vela y se guarda
     la distancia en % del precio entre cada par CONTIGUO (el apilado exacto). Con
     una sola linea se guarda la distancia del PRECIO a esa linea.
   - ESTADO de cada oscilador (lado + fuerza/magnitud), como en v6. */
export function capturarRasgos(ras, barIdx) {
  const cap = [];
  const close = ras.close[barIdx] || 0;
  // ── Geometria de lineas de precio ──
  const pres = [];
  for (const ln of ras.lines) { const v = ln.arr[barIdx]; if (isFinite(v)) pres.push({ ln, v }); }
  if (pres.length >= 2 && close) {
    pres.sort((a, b) => b.v - a.v);   // de mayor a menor (apilado de arriba abajo)
    for (let p = 0; p < pres.length - 1; p++) {
      const A = pres[p], B = pres[p + 1];
      const d0 = (A.v - B.v) / close * 100;
      cap.push({ id: 'dist:' + A.ln.id + '|' + B.ln.id, kind: 'dist', keys: _keysDe(A.ln, B.ln), aId: A.ln.id, bId: B.ln.id, nmA: A.ln.nm, nmB: B.ln.nm, d0, tol: _tolDist(d0) });
    }
  } else if (pres.length === 1 && close) {
    const A = pres[0], d0 = (close - A.v) / close * 100;
    cap.push({ id: 'dist:price|' + A.ln.id, kind: 'dist', keys: [A.ln.key], aId: null, bId: A.ln.id, nmA: 'Price', nmB: A.ln.nm, d0, tol: _tolDist(d0) });
  }
  // ── Estado de osciladores ──
  for (const f of ras.feats) {
    const st = _estado(f, barIdx);
    if (st === 0) continue;
    const neu = f.neutral == null ? 0 : f.neutral;
    const val = f.vals[barIdx];
    const mag = isFinite(val) ? Math.abs(val - neu) : 0;
    cap.push({ id: f.id, keys: f.keys.slice(), kind: f.kind, side: st, mag, nm: f.nm, nm2: f.nm2, unit: f.unit });
  }
  return cap;
}
function _keysDe(a, b) { const s = new Set(); if (a.key) s.add(a.key); if (b.key) s.add(b.key); return Array.from(s); }

/* Cuantos indicadores DISTINTOS siguen activos dentro de una regla capturada
   (sus lineas/rasgos aun existen en ras). <1 → regla invalida (faltan indicadores). */
export function rasgosActivos(ras, cap) {
  const act = new Set();
  for (const c of cap) {
    if (c.kind === 'dist') {
      const okA = (c.aId == null) || ras._lineById.has(c.aId);
      const okB = (c.bId == null) || ras._lineById.has(c.bId);
      if (okA && okB) c.keys.forEach((k) => act.add(k));
    } else if (ras._featById.has(c.id)) {
      c.keys.forEach((k) => act.add(k));
    }
  }
  return act.size;
}

function _cumpleEstado(f, c, barIdx) {
  const st = _estado(f, barIdx);
  if (st === 0 || st !== c.side) return false;
  if (c.kind === 'dir' || !(c.mag > 0)) return true;
  const neu = f.neutral == null ? 0 : f.neutral;
  const v = f.vals[barIdx]; if (!isFinite(v)) return false;
  return Math.abs(v - neu) >= _MAG_FRAC * c.mag;
}
const _CONF_FRAC = 1.0;    // TODAS las condiciones a la vez
const _MAG_FRAC = 0.6;     // osciladores: misma fuerza (≥60% de la magnitud marcada)

/* ¿La condicion c se cumple en la vela barIdx?
   true ✓ · false ○ (no se cumple) · null ✕ (indicador quitado). */
export function cumpleRasgo(ras, c, barIdx) {
  if (c.kind === 'dist') {
    let av, bv;
    if (c.aId == null) { av = ras.close[barIdx]; } else { const a = ras._lineById.get(c.aId); if (!a) return null; av = a.arr[barIdx]; }
    if (c.bId == null) { bv = ras.close[barIdx]; } else { const b = ras._lineById.get(c.bId); if (!b) return null; bv = b.arr[barIdx]; }
    const close = ras.close[barIdx];
    if (!isFinite(av) || !isFinite(bv) || !close) return false;
    const d = (av - bv) / close * 100;
    return Math.abs(d - c.d0) <= c.tol;
  }
  const f = ras._featById.get(c.id); if (!f) return null;
  return _cumpleEstado(f, c, barIdx);
}

/* ¿La vela barIdx reproduce la confluencia ENTERA? Se exigen TODAS las condiciones
   presentes (las de indicadores quitados no cuentan). */
export function coincideRasgos(ras, cap, barIdx) {
  const act = new Set(); let total = 0, ok = 0;
  for (const c of cap) {
    const r = cumpleRasgo(ras, c, barIdx);
    if (r === null) continue;
    c.keys.forEach((k) => act.add(k));
    total++; if (r) ok++;
  }
  if (act.size < 1 || total === 0) return false;
  return ok >= Math.max(1, Math.ceil(total * _CONF_FRAC));
}

/* Barrido de toda la serie. Resuelve los arrays de cada condicion UNA vez y luego
   recorre las velas con pura aritmetica de arrays: rapido aun con muchos
   indicadores (no reconstruye mapas por vela). */
export function escanearRasgos(ras, cap, soloInicios = true) {
  const R = [];
  for (const c of cap) {
    if (c.kind === 'dist') {
      let aArr = null, bArr = null;
      if (c.aId != null) { const a = ras._lineById.get(c.aId); if (!a) continue; aArr = a.arr; }
      if (c.bId != null) { const b = ras._lineById.get(c.bId); if (!b) continue; bArr = b.arr; }
      R.push({ dist: true, aArr, bArr, d0: c.d0, tol: c.tol });
    } else {
      const f = ras._featById.get(c.id); if (!f) continue;
      R.push({ dist: false, f, side: c.side, mag: c.mag, kind: c.kind });
    }
  }
  if (!R.length) return [];
  const close = ras.close, n = ras.n, out = []; let prev = false;
  for (let i = 0; i < n; i++) {
    let ok = true;
    for (let j = 0; j < R.length; j++) {
      const r = R[j];
      if (r.dist) {
        const cl = close[i]; if (!cl) { ok = false; break; }
        const av = r.aArr ? r.aArr[i] : cl, bv = r.bArr ? r.bArr[i] : cl;
        if (!isFinite(av) || !isFinite(bv)) { ok = false; break; }
        if (Math.abs((av - bv) / cl * 100 - r.d0) > r.tol) { ok = false; break; }
      } else if (!_cumpleEstado(r.f, r, i)) { ok = false; break; }
    }
    if (ok && (!soloInicios || !prev)) out.push(ras.V[i].time);
    prev = ok;
  }
  return out;
}

/* ── Texto legible (EN/ES) de una condicion ── */
function _fmtPct(x) { const a = Math.abs(x); return (a < 1 ? a.toFixed(2) : a.toFixed(1)) + '%'; }
export function rasgoLabel(c, lang) {
  const es = lang === 'es';
  if (c.kind === 'dist') {
    const arriba = c.d0 >= 0;
    const rel = es ? (arriba ? 'sobre' : 'bajo') : (arriba ? 'above' : 'below');
    return `${c.nmA} ${_fmtPct(c.d0)} ${rel} ${c.nmB}`;
  }
  const up = c.side > 0;
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
      return es ? `${c.nm} ${up ? 'alcista' : 'bajista'}` : `${c.nm} ${up ? 'bullish' : 'bearish'}`;
  }
}

try { console.log('%cDecFreedom', 'color:#E8B84B;font-weight:700', 'Confluence engine · geometria v8 · 2026-11-03'); } catch (_) {}
