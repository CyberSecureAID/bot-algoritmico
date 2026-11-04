/* modules/institutional/confluencia.js — MOTOR DE CONFLUENCIA (v9, CRUCES + GEOMETRIA).

   v9 sobre v8: distingue CRUCE de DISTANCIA y respeta la DIRECCION.
   - CRUCE: si en el punto marcado dos lineas de precio se estan cruzando (gap casi
     cero y cambio de signo cerca), se guarda un CRUCE CON DIRECCION, p.ej. "EMA 9
     cruza hacia abajo EMA 200". La alerta solo salta en cruces de ESA misma
     direccion (un cruce alcista NO dispara una regla de cruce bajista). Eso quita el
     ruido de v8, que con el suelo de tolerancia disparaba en cruces de los dos lados
     y hasta cuando una linea solo se "pegaba" sin cruzar.
   - DISTANCIA: si las lineas estan claramente separadas, se guarda la distancia en %
     del precio pero EXIGIENDO EL MISMO LADO (la tolerancia nunca cruza el cero): si
     se marco la rapida 2.8% POR ENCIMA de la lenta, solo coincide por encima.
   - Se capturan TODOS los pares de lineas (no solo contiguos), para que un par
     concreto como 9 contra 200 exista aunque haya otras medias en medio.
   - Los OSCILADORES (RSI, estocastico, MACD, ADX...) confirman por LADO (alcista /
     bajista), sin exigir magnitud: asi las confluencias reales si disparan en vez de
     "colapsar" sin alertas.

   RENDIMIENTO: los mapas (linea/rasgo por id) se precalculan una vez y el escaneo
   resuelve los arrays antes del bucle de velas. Instantaneo con muchos indicadores.
   La UI (institutional.js) lo consume igual: mismas funciones exportadas. */

import { ema, sma, wma, hma, dema, tema, vwma, alma, zlema, kama, vwapBands,
  bollinger, donchian, keltner, envelopes, psar, supertrend, rsi, macd, ppo,
  stochastic, stochRsi, atr, cci, williams, obv, roc, adx, mfi, awesome,
  momentum, stddev, ultimate, cmf, trix, vortex, aroon, fisher, cmo } from './indicadores.js?v=6';

const MA_PER = { EMA9: 9, EMA20: 20, EMA50: 50, EMA100: 100, EMA200: 200, SMA: 20, WMA: 20, HMA: 20, DEMA: 20, TEMA: 20, VWMA: 20, ALMA: 20, ZLEMA: 20, KAMA: 10 };
const NM = { EMA9: 'EMA 9', EMA20: 'EMA 20', EMA50: 'EMA 50', EMA100: 'EMA 100', EMA200: 'EMA 200', SMA: 'SMA 20', WMA: 'WMA 20', HMA: 'HMA 20', DEMA: 'DEMA 20', TEMA: 'TEMA 20', VWMA: 'VWMA 20', ALMA: 'ALMA 20', ZLEMA: 'ZLEMA 20', KAMA: 'KAMA 10', VWAP: 'VWAP', RSI: 'RSI', MACD: 'MACD', PPO: 'PPO', STOCH: 'Stochastic', STOCHRSI: 'Stoch RSI', CCI: 'CCI', WILL: 'Williams %R', MFI: 'MFI', UO: 'Ultimate Osc.', ROC: 'ROC', MOM: 'Momentum', CMO: 'CMO', CMF: 'Chaikin MF', TRIX: 'TRIX', AO: 'Awesome Osc.', OBV: 'OBV', ATR: 'ATR', STDDEV: 'Std Dev', ADX: 'ADX', PSAR: 'Parabolic SAR', ST: 'Supertrend', BOLL: 'Bollinger', DONCH: 'Donchian', KELT: 'Keltner', ENV: 'Envelopes', VORTEX: 'Vortex', AROON: 'Aroon', FISHER: 'Fisher' };
const nmDe = (k) => NM[k] || k;
const _SOP = new Set(Object.keys(NM));
export function soportado(k) { return _SOP.has(k); }

/* Bandas (3 lineas) de VWAP / Bollinger / Donchian / Keltner / Envelopes. */
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
function _median(vals) {
  const xs = []; for (let i = 0; i < vals.length; i++) if (isFinite(vals[i])) xs.push(vals[i]);
  if (!xs.length) return 0; xs.sort((a, b) => a - b); return xs[xs.length >> 1];
}
const NEUTRAL = { 'lvl:RSI': 50, 'lvl:STOCH': 50, 'lvl:STOCHRSI': 50, 'lvl:CCI': 0, 'lvl:WILL': -50, 'lvl:MFI': 50, 'lvl:UO': 50, 'lvl:ROC': 0, 'lvl:CMO': 0, 'lvl:CMF': 0, 'lvl:ADX': 25 };

/* Distancia en % del precio: tolerancia 33% de la marcada, suelo 0.10%. El MISMO
   lado se exige aparte (la tolerancia por si sola podria cruzar el cero). */
const _DIST_REL = 0.33;
const _DIST_ABS = 0.10;
const _tolDist = (d0) => Math.max(_DIST_ABS, Math.abs(d0) * _DIST_REL);
/* Un par se considera CRUCE si en el punto marcado el gap es <= _CROSS_GAP (% del
   precio) y hay un cambio de signo a <= _CROSS_W velas. */
const _CROSS_GAP = 0.35;
const _CROSS_W = 5;

function _estado(f, i) {
  const v = f.vals[i];
  if (!isFinite(v)) return 0;
  if (f.kind === 'dir') return v >= 0 ? 1 : -1;
  const neu = (f.neutral == null ? 0 : f.neutral);
  return v >= neu ? 1 : -1;
}

/* Banco de rasgos de los indicadores ACTIVOS.
   - ras.lines: lineas de precio (medias + 3 bandas de VWAP/Bollinger/etc.), cada una
     con su 'rank' (periodo de la media; las bandas al final) para etiquetar cruces.
   - ras.feats: osciladores ('par' dos lineas propias, 'level', 'hist', 'dir'). */
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
  const addLine = (id, key, nm, serie, rank) => { lines.push({ id, key, nm, arr: alinear(serie), rank }); };
  for (const k of activeKeys) {
    try {
      if (_ES_BANDA(k)) {
        const b = _bandas(k, V); if (!b) continue;
        addLine('ln:' + k + ':up', k, nmDe(k) + ' upper', b.upper, 1000);
        addLine('ln:' + k + ':mid', k, nmDe(k) + (k === 'VWAP' ? '' : ' mid'), b.middle, 1001);
        addLine('ln:' + k + ':lo', k, nmDe(k) + ' lower', b.lower, 1002);
      } else if (MA_PER[k] != null) {
        addLine('ln:' + k, k, nmDe(k), _serieMA(k, V), MA_PER[k]);
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
    if (_ES_BANDA(k) || MA_PER[k] != null) continue;
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

/* Distancia en % del precio entre dos lineas (null = precio) en la vela i. */
function _dEn(aArr, bArr, close, i) {
  if (i < 0 || !close[i]) return NaN;
  const av = aArr ? aArr[i] : close[i], bv = bArr ? bArr[i] : close[i];
  if (!isFinite(av) || !isFinite(bv)) return NaN;
  return (av - bv) / close[i] * 100;
}
/* Cambio de signo (cruce) mas cercano a bi dentro de ±W. Devuelve {i, dir} o null.
   dir = +1 si A pasa de debajo a encima de B (alcista), −1 si de encima a debajo. */
function _cruceEn(aArr, bArr, close, bi, W, n) {
  let best = null, bestDist = 1e9;
  const lo = Math.max(1, bi - W), hi = Math.min(n - 1, bi + W);
  for (let i = lo; i <= hi; i++) {
    const dPrev = _dEn(aArr, bArr, close, i - 1), dCur = _dEn(aArr, bArr, close, i);
    if (!isFinite(dPrev) || !isFinite(dCur)) continue;
    if ((dPrev > 0 && dCur <= 0) || (dPrev < 0 && dCur >= 0)) {
      const dd = Math.abs(i - bi);
      if (dd < bestDist) { bestDist = dd; best = { i, dir: (dCur - dPrev) >= 0 ? 1 : -1 }; }
    }
  }
  return best;
}
/* ¿En la vela i ocurre un cruce de la direccion pedida? (evento de una vela) */
function _cruzaEn(aArr, bArr, close, i, dir) {
  if (i < 1) return false;
  const dPrev = _dEn(aArr, bArr, close, i - 1), dCur = _dEn(aArr, bArr, close, i);
  if (!isFinite(dPrev) || !isFinite(dCur)) return false;
  return dir < 0 ? (dPrev > 0 && dCur <= 0) : (dPrev < 0 && dCur >= 0);
}
function _keysDe(a, b) { const s = new Set(); if (a && a.key) s.add(a.key); if (b && b.key) s.add(b.key); return Array.from(s); }

/* Decide, para un par de lineas, si en el punto marcado hay CRUCE o DISTANCIA y lo
   mete en la regla. aId/bId null = precio. */
function _addGeom(cap, ras, bi, p) {
  const close = ras.close;
  const aArr = p.aId == null ? null : (ras._lineById.get(p.aId) || {}).arr || null;
  const bArr = p.bId == null ? null : (ras._lineById.get(p.bId) || {}).arr || null;
  const d0 = _dEn(aArr, bArr, close, bi);
  if (!isFinite(d0)) return;
  const cruce = (Math.abs(d0) <= _CROSS_GAP) ? _cruceEn(aArr, bArr, close, bi, _CROSS_W, ras.n) : null;
  if (cruce) {
    cap.push({ id: 'x:' + (p.aId || 'price') + '|' + (p.bId || 'price'), kind: 'cross', keys: p.keys, aId: p.aId, bId: p.bId, nmA: p.nmA, nmB: p.nmB, dir: cruce.dir });
  } else {
    // A = la linea MAS ALTA en el punto (d0 > 0) para etiquetar "A X% sobre B".
    let aId = p.aId, bId = p.bId, nmA = p.nmA, nmB = p.nmB, dd = d0;
    if (d0 < 0) { aId = p.bId; bId = p.aId; nmA = p.nmB; nmB = p.nmA; dd = -d0; }
    cap.push({ id: 'd:' + (aId || 'price') + '|' + (bId || 'price'), kind: 'dist', keys: p.keys, aId, bId, nmA, nmB, d0: dd, tol: _tolDist(dd) });
  }
}

/* Captura la CONFIGURACION del punto marcado: geometria de TODOS los pares de
   lineas de precio (cruce con direccion o distancia con mismo lado) + lado de cada
   oscilador. */
export function capturarRasgos(ras, barIdx) {
  const cap = [];
  const cl = ras.close[barIdx] || 0;
  const P = [];
  for (const ln of ras.lines) { if (isFinite(ln.arr[barIdx])) P.push(ln); }
  if (cl) {
    if (P.length === 1) {
      _addGeom(cap, ras, barIdx, { aId: null, bId: P[0].id, nmA: 'Price', nmB: P[0].nm, keys: [P[0].key] });
    } else {
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const A = (P[i].rank <= P[j].rank) ? P[i] : P[j], B = (A === P[i]) ? P[j] : P[i];   // A = mas rapida
        _addGeom(cap, ras, barIdx, { aId: A.id, bId: B.id, nmA: A.nm, nmB: B.nm, keys: _keysDe(A, B) });
      }
    }
  }
  for (const f of ras.feats) {
    const st = _estado(f, barIdx);
    if (st === 0) continue;
    cap.push({ id: f.id, keys: f.keys.slice(), kind: f.kind, side: st, nm: f.nm, nm2: f.nm2, unit: f.unit });
  }
  return cap;
}

export function rasgosActivos(ras, cap) {
  const act = new Set();
  for (const c of cap) {
    if (c.kind === 'cross' || c.kind === 'dist') {
      const okA = (c.aId == null) || ras._lineById.has(c.aId);
      const okB = (c.bId == null) || ras._lineById.has(c.bId);
      if (okA && okB) c.keys.forEach((k) => act.add(k));
    } else if (ras._featById.has(c.id)) {
      c.keys.forEach((k) => act.add(k));
    }
  }
  return act.size;
}

/* ¿La condicion c se cumple en la vela barIdx?
   true ✓ · false ○ · null ✕ (indicador quitado). */
export function cumpleRasgo(ras, c, barIdx) {
  if (c.kind === 'cross' || c.kind === 'dist') {
    let aArr = null, bArr = null;
    if (c.aId != null) { const a = ras._lineById.get(c.aId); if (!a) return null; aArr = a.arr; }
    if (c.bId != null) { const b = ras._lineById.get(c.bId); if (!b) return null; bArr = b.arr; }
    if (c.kind === 'cross') return _cruzaEn(aArr, bArr, ras.close, barIdx, c.dir);
    const d = _dEn(aArr, bArr, ras.close, barIdx);
    if (!isFinite(d)) return false;
    if (c.d0 >= 0 ? d < 0 : d > 0) return false;             // mismo lado (sin cruzar el cero)
    return Math.abs(d - c.d0) <= c.tol;
  }
  const f = ras._featById.get(c.id); if (!f) return null;
  const st = _estado(f, barIdx);
  return st !== 0 && st === c.side;                          // mismo lado del oscilador
}

const _CONF_FRAC = 1.0;    // TODAS las condiciones a la vez
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

/* Barrido de toda la serie: resuelve arrays una vez y recorre velas con aritmetica
   pura. Rapido aun con muchos indicadores. */
export function escanearRasgos(ras, cap, soloInicios = true) {
  const R = [];
  for (const c of cap) {
    if (c.kind === 'cross' || c.kind === 'dist') {
      let aArr = null, bArr = null, miss = false;
      if (c.aId != null) { const a = ras._lineById.get(c.aId); if (!a) miss = true; else aArr = a.arr; }
      if (c.bId != null) { const b = ras._lineById.get(c.bId); if (!b) miss = true; else bArr = b.arr; }
      if (miss) continue;
      if (c.kind === 'cross') R.push({ t: 'x', aArr, bArr, dir: c.dir });
      else R.push({ t: 'd', aArr, bArr, d0: c.d0, tol: c.tol });
    } else {
      const f = ras._featById.get(c.id); if (!f) continue;
      R.push({ t: 'o', f, side: c.side });
    }
  }
  if (!R.length) return [];
  const close = ras.close, n = ras.n, out = []; let prev = false;
  for (let i = 0; i < n; i++) {
    let ok = true;
    for (let j = 0; j < R.length; j++) {
      const r = R[j];
      if (r.t === 'x') { if (!_cruzaEn(r.aArr, r.bArr, close, i, r.dir)) { ok = false; break; } }
      else if (r.t === 'd') {
        const d = _dEn(r.aArr, r.bArr, close, i);
        if (!isFinite(d) || (r.d0 >= 0 ? d < 0 : d > 0) || Math.abs(d - r.d0) > r.tol) { ok = false; break; }
      } else { const st = _estado(r.f, i); if (st === 0 || st !== r.side) { ok = false; break; } }
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
  if (c.kind === 'cross') {
    const abajo = c.dir < 0;
    if (es) return `${c.nmA} cruza hacia ${abajo ? 'abajo' : 'arriba'} ${c.nmB}`;
    return `${c.nmA} crosses ${abajo ? 'down' : 'up'} through ${c.nmB}`;
  }
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

try { console.log('%cDecFreedom', 'color:#E8B84B;font-weight:700', 'Confluence engine · cruces v9 · 2026-11-04'); } catch (_) {}
