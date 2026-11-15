/* ──────────────────────────────────────────────────────────────────────────
   modules/indicadores/libreria.js — LIBRERIA DE INDICADORES de DecFreedom.

   Definiciones + formulas REALES de cada indicador, con sus parametros
   editables y su estilo por defecto (color, grosor, punteada). Es PURA: no
   toca el DOM ni la grafica, solo calcula, asi que se puede testear aparte y
   la puede usar cualquier seccion (hoy, Multichart).

   Cada indicador aparece UNA sola vez (ninguno repetido): si quieres dos EMAs
   con periodos distintos, se agregan dos instancias del MISMO indicador y a
   cada una se le pone su periodo. Eso lo maneja quien la use (Multichart).

   tipo 'ovl'  -> va encima del precio; calc devuelve { lineas:[{data,a?}] }.
   tipo 'osc'  -> va en su sub-panel; calc devuelve { serie, serie2?, serie3?, hist?, col2?, col3? }.
   ────────────────────────────────────────────────────────────────────────── */

export const cls = (v) => v.map((c) => c.close);
const hl2 = (v) => v.map((c) => (c.high + c.low) / 2);
const tp = (v) => v.map((c) => (c.high + c.low + c.close) / 3);

/* ── Medias y utilidades ── */
export function sma(a, n) { const o = Array(a.length).fill(null); let s = 0; for (let i = 0; i < a.length; i++) { const x = a[i] == null ? 0 : a[i]; s += x; if (i >= n) s -= (a[i - n] == null ? 0 : a[i - n]); if (i >= n - 1) o[i] = s / n; } return o; }
export function ema(a, n) { const o = Array(a.length).fill(null); const k = 2 / (n + 1); let p = null; for (let i = 0; i < a.length; i++) { const x = a[i]; if (x == null) { o[i] = p; continue; } p = p == null ? x : x * k + p * (1 - k); if (i >= n - 1) o[i] = p; } return o; }
export function wma(a, n) { const o = Array(a.length).fill(null); const den = n * (n + 1) / 2; for (let i = n - 1; i < a.length; i++) { let s = 0, ok = true; for (let j = 0; j < n; j++) { const x = a[i - j]; if (x == null) { ok = false; break; } s += x * (n - j); } if (ok) o[i] = s / den; } return o; }
export function rma(a, n) { const o = Array(a.length).fill(null); let p = null, acc = 0, cnt = 0; for (let i = 0; i < a.length; i++) { const x = a[i] == null ? 0 : a[i]; if (p == null) { acc += x; cnt++; if (cnt === n) { p = acc / n; o[i] = p; } } else { p = (p * (n - 1) + x) / n; o[i] = p; } } return o; }
function desv(a, n) { const m = sma(a, n), o = Array(a.length).fill(null); for (let i = 0; i < a.length; i++) { if (m[i] == null) continue; let s = 0; for (let j = i - n + 1; j <= i; j++) s += (a[j] - m[i]) ** 2; o[i] = Math.sqrt(s / n); } return o; }
function trueRange(v) { const o = Array(v.length).fill(null); for (let i = 0; i < v.length; i++) { if (i === 0) { o[i] = v[i].high - v[i].low; continue; } o[i] = Math.max(v[i].high - v[i].low, Math.abs(v[i].high - v[i - 1].close), Math.abs(v[i].low - v[i - 1].close)); } return o; }

/* ── Formulas de los indicadores ── */
function rsi(c, n) { const o = Array(c.length).fill(null); let g = 0, l = 0; for (let i = 1; i < c.length; i++) { const d = c[i] - c[i - 1], up = Math.max(0, d), dn = Math.max(0, -d); if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; o[i] = 100 - 100 / (1 + (l === 0 ? 100 : g / l)); } } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o[i] = 100 - 100 / (1 + (l === 0 ? 100 : g / l)); } } return o; }
function macd(c, rapida, lenta, senal) { const e1 = ema(c, rapida), e2 = ema(c, lenta); const line = c.map((_, i) => (e1[i] != null && e2[i] != null) ? e1[i] - e2[i] : null); const base = line.map((x) => x == null ? 0 : x); const sig = ema(base, senal).map((x, i) => line[i] == null ? null : x); const hist = line.map((x, i) => (x != null && sig[i] != null) ? x - sig[i] : null); return { line, sig, hist }; }
function stoch(v, n, d) { const k = Array(v.length).fill(null); for (let i = 0; i < v.length; i++) { if (i < n - 1) continue; let hi = -1e18, lo = 1e18; for (let j = i - n + 1; j <= i; j++) { hi = Math.max(hi, v[j].high); lo = Math.min(lo, v[j].low); } k[i] = hi === lo ? 50 : (v[i].close - lo) / (hi - lo) * 100; } const dd = sma(k.map((x) => x == null ? 0 : x), d).map((x, i) => k[i] == null ? null : x); return { k, d: dd }; }
function cci(v, n) { const o = Array(v.length).fill(null); const t = tp(v); const ma = sma(t, n); for (let i = 0; i < v.length; i++) { if (ma[i] == null) continue; let md = 0; for (let j = i - n + 1; j <= i; j++) md += Math.abs(t[j] - ma[i]); md /= n; o[i] = md === 0 ? 0 : (t[i] - ma[i]) / (0.015 * md); } return o; }
function vwap(v) { const o = Array(v.length).fill(null); let pv = 0, vv = 0; const t = tp(v); for (let i = 0; i < v.length; i++) { const vol = v[i].volume || 1; pv += t[i] * vol; vv += vol; o[i] = pv / vv; } return o; }
function boll(c, n, k) { const ma = sma(c, n), sd = desv(c, n), up = Array(c.length).fill(null), lo = Array(c.length).fill(null); for (let i = 0; i < c.length; i++) { if (ma[i] == null || sd[i] == null) continue; up[i] = ma[i] + k * sd[i]; lo[i] = ma[i] - k * sd[i]; } return { ma, up, lo }; }
function atr(v, n) { return rma(trueRange(v), n); }
function dema(c, n) { const e1 = ema(c, n), e2 = ema(e1, n); return c.map((_, i) => (e1[i] != null && e2[i] != null) ? 2 * e1[i] - e2[i] : null); }
function tema(c, n) { const e1 = ema(c, n), e2 = ema(e1, n), e3 = ema(e2, n); return c.map((_, i) => (e1[i] != null && e2[i] != null && e3[i] != null) ? 3 * e1[i] - 3 * e2[i] + e3[i] : null); }
function hma(c, n) { const h = Math.max(1, Math.round(n / 2)), s = Math.max(1, Math.round(Math.sqrt(n))); const w1 = wma(c, h), w2 = wma(c, n); const diff = c.map((_, i) => (w1[i] != null && w2[i] != null) ? 2 * w1[i] - w2[i] : null); return wma(diff, s); }
function vwma(v, n) { const o = Array(v.length).fill(null); let sp = 0, sv = 0; for (let i = 0; i < v.length; i++) { const c = v[i].close, vol = v[i].volume || 0; sp += c * vol; sv += vol; if (i >= n) { const b = v[i - n]; sp -= b.close * (b.volume || 0); sv -= (b.volume || 0); } if (i >= n - 1) o[i] = sv > 0 ? sp / sv : null; } return o; }
function donchian(v, n) { const up = Array(v.length).fill(null), lo = Array(v.length).fill(null), mid = Array(v.length).fill(null); for (let i = n - 1; i < v.length; i++) { let hi = -1e18, l = 1e18; for (let j = i - n + 1; j <= i; j++) { hi = Math.max(hi, v[j].high); l = Math.min(l, v[j].low); } up[i] = hi; lo[i] = l; mid[i] = (hi + l) / 2; } return { up, lo, mid }; }
function keltner(v, n, mult) { const mid = ema(cls(v), n), a = atr(v, n), up = Array(v.length).fill(null), lo = Array(v.length).fill(null); for (let i = 0; i < v.length; i++) { if (mid[i] == null || a[i] == null) continue; up[i] = mid[i] + mult * a[i]; lo[i] = mid[i] - mult * a[i]; } return { mid, up, lo }; }
function adx(v, n) { const L = v.length, pdm = Array(L).fill(0), mdm = Array(L).fill(0), tr = Array(L).fill(0); for (let i = 1; i < L; i++) { const up = v[i].high - v[i - 1].high, dn = v[i - 1].low - v[i].low; pdm[i] = (up > dn && up > 0) ? up : 0; mdm[i] = (dn > up && dn > 0) ? dn : 0; tr[i] = Math.max(v[i].high - v[i].low, Math.abs(v[i].high - v[i - 1].close), Math.abs(v[i].low - v[i - 1].close)); } const trS = rma(tr, n), pS = rma(pdm, n), mS = rma(mdm, n); const pdi = Array(L).fill(null), mdi = Array(L).fill(null), dx = Array(L).fill(null); for (let i = 0; i < L; i++) { if (trS[i] == null || trS[i] === 0) continue; pdi[i] = 100 * pS[i] / trS[i]; mdi[i] = 100 * mS[i] / trS[i]; const s = pdi[i] + mdi[i]; dx[i] = s === 0 ? 0 : 100 * Math.abs(pdi[i] - mdi[i]) / s; } const adxL = rma(dx.map((x) => x == null ? 0 : x), n).map((x, i) => dx[i] == null ? null : x); return { adx: adxL, pdi, mdi }; }
function williamsR(v, n) { const o = Array(v.length).fill(null); for (let i = n - 1; i < v.length; i++) { let hi = -1e18, lo = 1e18; for (let j = i - n + 1; j <= i; j++) { hi = Math.max(hi, v[j].high); lo = Math.min(lo, v[j].low); } o[i] = hi === lo ? -50 : -100 * (hi - v[i].close) / (hi - lo); } return o; }
function roc(c, n) { const o = Array(c.length).fill(null); for (let i = n; i < c.length; i++) { if (c[i - n]) o[i] = (c[i] - c[i - n]) / c[i - n] * 100; } return o; }
function momentum(c, n) { const o = Array(c.length).fill(null); for (let i = n; i < c.length; i++) o[i] = c[i] - c[i - n]; return o; }
function mfi(v, n) { const o = Array(v.length).fill(null), t = tp(v), rmf = v.map((c, i) => t[i] * (c.volume || 0)); for (let i = n; i < v.length; i++) { let pos = 0, neg = 0; for (let j = i - n + 1; j <= i; j++) { if (t[j] > t[j - 1]) pos += rmf[j]; else if (t[j] < t[j - 1]) neg += rmf[j]; } o[i] = neg === 0 ? 100 : 100 - 100 / (1 + pos / neg); } return o; }
function obv(v) { const o = Array(v.length).fill(null); let acc = 0; if (v.length) o[0] = 0; for (let i = 1; i < v.length; i++) { const d = v[i].close - v[i - 1].close; if (d > 0) acc += (v[i].volume || 0); else if (d < 0) acc -= (v[i].volume || 0); o[i] = acc; } return o; }

/* ── Catalogo (crece hacia los 50; por ahora los que ya existian, distintos) ── */
export const INDICADORES = [
  { id: 'ema', nom: 'EMA', grupo: 'Trend', tipo: 'ovl', estilo: { col: '#49b6ff', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 9, min: 1, max: 400 }], calc: (v, c) => ({ lineas: [{ data: ema(cls(v), c.periodo) }] }) },
  { id: 'sma', nom: 'SMA', grupo: 'Trend', tipo: 'ovl', estilo: { col: '#ff8fbf', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 200, min: 1, max: 400 }], calc: (v, c) => ({ lineas: [{ data: sma(cls(v), c.periodo) }] }) },
  { id: 'wma', nom: 'WMA', grupo: 'Trend', tipo: 'ovl', estilo: { col: '#b07cff', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 30, min: 1, max: 400 }], calc: (v, c) => ({ lineas: [{ data: wma(cls(v), c.periodo) }] }) },
  { id: 'vwap', nom: 'VWAP', grupo: 'Volume', tipo: 'ovl', estilo: { col: '#2ee8c6', gr: 2, dash: false }, params: [], calc: (v) => ({ lineas: [{ data: vwap(v) }] }) },
  { id: 'boll', nom: 'Bollinger', grupo: 'Volatility', tipo: 'ovl', estilo: { col: '#7aa2ff', gr: 1.6, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 20, min: 2, max: 200 }, { k: 'desv', lbl: 'Dev', def: 2, min: 0.5, max: 5, step: 0.5 }], calc: (v, c) => { const b = boll(cls(v), c.periodo, c.desv); return { lineas: [{ data: b.up }, { data: b.ma, a: 0.5 }, { data: b.lo }] }; } },
  { id: 'rsi', nom: 'RSI', grupo: 'Momentum', tipo: 'osc', rango: [0, 100], ref: [30, 70], estilo: { col: '#E8B84B', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 14, min: 2, max: 100 }], calc: (v, c) => ({ serie: rsi(cls(v), c.periodo) }) },
  { id: 'macd', nom: 'MACD', grupo: 'Momentum', tipo: 'osc', ref: [0], estilo: { col: '#49b6ff', gr: 2, dash: false }, params: [{ k: 'rapida', lbl: 'Fast', def: 12, min: 1, max: 100 }, { k: 'lenta', lbl: 'Slow', def: 26, min: 1, max: 200 }, { k: 'senal', lbl: 'Signal', def: 9, min: 1, max: 100 }], calc: (v, c) => { const m = macd(cls(v), c.rapida, c.lenta, c.senal); return { serie: m.line, serie2: m.sig, col2: '#ff8fbf', hist: m.hist }; } },
  { id: 'stoch', nom: 'Stochastic', grupo: 'Momentum', tipo: 'osc', rango: [0, 100], ref: [20, 80], estilo: { col: '#2ee8c6', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 14, min: 1, max: 100 }, { k: 'suav', lbl: 'Smooth', def: 3, min: 1, max: 20 }], calc: (v, c) => { const s = stoch(v, c.periodo, c.suav); return { serie: s.k, serie2: s.d, col2: '#ff8fbf' }; } },
  { id: 'cci', nom: 'CCI', grupo: 'Momentum', tipo: 'osc', ref: [-100, 100], estilo: { col: '#b07cff', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 20, min: 2, max: 100 }], calc: (v, c) => ({ serie: cci(v, c.periodo) }) },
  { id: 'dema', nom: 'DEMA', grupo: 'Trend', tipo: 'ovl', estilo: { col: '#ff9e3d', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 9, min: 1, max: 400 }], calc: (v, c) => ({ lineas: [{ data: dema(cls(v), c.periodo) }] }) },
  { id: 'tema', nom: 'TEMA', grupo: 'Trend', tipo: 'ovl', estilo: { col: '#43d675', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 9, min: 1, max: 400 }], calc: (v, c) => ({ lineas: [{ data: tema(cls(v), c.periodo) }] }) },
  { id: 'hma', nom: 'HMA', grupo: 'Trend', tipo: 'ovl', estilo: { col: '#ff6b81', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 20, min: 2, max: 400 }], calc: (v, c) => ({ lineas: [{ data: hma(cls(v), c.periodo) }] }) },
  { id: 'vwma', nom: 'VWMA', grupo: 'Volume', tipo: 'ovl', estilo: { col: '#8bd3ff', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 20, min: 1, max: 400 }], calc: (v, c) => ({ lineas: [{ data: vwma(v, c.periodo) }] }) },
  { id: 'keltner', nom: 'Keltner', grupo: 'Volatility', tipo: 'ovl', estilo: { col: '#c6a2ff', gr: 1.6, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 20, min: 2, max: 200 }, { k: 'mult', lbl: 'Mult', def: 2, min: 0.5, max: 5, step: 0.5 }], calc: (v, c) => { const k = keltner(v, c.periodo, c.mult); return { lineas: [{ data: k.up }, { data: k.mid, a: 0.5 }, { data: k.lo }] }; } },
  { id: 'donchian', nom: 'Donchian', grupo: 'Volatility', tipo: 'ovl', estilo: { col: '#7bd389', gr: 1.6, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 20, min: 2, max: 200 }], calc: (v, c) => { const d = donchian(v, c.periodo); return { lineas: [{ data: d.up }, { data: d.mid, a: 0.5 }, { data: d.lo }] }; } },
  { id: 'atr', nom: 'ATR', grupo: 'Volatility', tipo: 'osc', estilo: { col: '#ffb454', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 14, min: 1, max: 100 }], calc: (v, c) => ({ serie: atr(v, c.periodo) }) },
  { id: 'adx', nom: 'ADX', grupo: 'Momentum', tipo: 'osc', ref: [25], estilo: { col: '#49b6ff', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 14, min: 2, max: 100 }], calc: (v, c) => { const a = adx(v, c.periodo); return { serie: a.adx, serie2: a.pdi, col2: '#2ee86a', serie3: a.mdi, col3: '#ff5b6e' }; } },
  { id: 'willr', nom: 'Williams %R', grupo: 'Momentum', tipo: 'osc', rango: [-100, 0], ref: [-20, -80], estilo: { col: '#b07cff', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 14, min: 1, max: 100 }], calc: (v, c) => ({ serie: williamsR(v, c.periodo) }) },
  { id: 'roc', nom: 'ROC', grupo: 'Momentum', tipo: 'osc', ref: [0], estilo: { col: '#2ee8c6', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 9, min: 1, max: 200 }], calc: (v, c) => ({ serie: roc(cls(v), c.periodo) }) },
  { id: 'mom', nom: 'Momentum', grupo: 'Momentum', tipo: 'osc', ref: [0], estilo: { col: '#ff8fbf', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 10, min: 1, max: 200 }], calc: (v, c) => ({ serie: momentum(cls(v), c.periodo) }) },
  { id: 'mfi', nom: 'MFI', grupo: 'Volume', tipo: 'osc', rango: [0, 100], ref: [20, 80], estilo: { col: '#49b6ff', gr: 2, dash: false }, params: [{ k: 'periodo', lbl: 'Length', def: 14, min: 2, max: 100 }], calc: (v, c) => ({ serie: mfi(v, c.periodo) }) },
  { id: 'obv', nom: 'OBV', grupo: 'Volume', tipo: 'osc', estilo: { col: '#E8B84B', gr: 2, dash: false }, params: [], calc: (v) => ({ serie: obv(v) }) }
];

/* ── Helpers para quien la use ── */
export function buscarInd(id) { return INDICADORES.find((d) => d.id === id) || null; }
export function cfgInicial(def) { const c = Object.assign({ col: def.estilo.col, gr: def.estilo.gr, dash: !!def.estilo.dash }, {}); (def.params || []).forEach((p) => { c[p.k] = p.def; }); return c; }
export function nombreInd(def, c) { if (!def.params || !def.params.length) return def.nom; const p0 = def.params.find((p) => p.k === 'periodo'); return p0 ? def.nom + ' ' + c[p0.k] : def.nom; }
export function calcular(def, velas, c) { try { return def.calc(velas, c); } catch (_) { return def.tipo === 'ovl' ? { lineas: [] } : {}; } }
