/* ══════════════════════════════════════════════════════════════
   sp500/datos.js — Datos del S&P 500 (SPY) intradía, con DOBLE VÍA
   GRATIS y RELEVO automático.

   Todo gratis, como pidió Jesús. Se prueban las fuentes en orden; si
   una falla o no devuelve datos, entra la siguiente sin que el usuario
   note nada. Todas se normalizan a la MISMA forma que el resto del
   sitio: {t,o,h,l,c,v} con t en milisegundos, ascendente.

     1) Twelve Data   — clave gratis (800 peticiones al día). Horas en
                        UTC, sin ambigüedad.
     2) Financial Modeling Prep (FMP) — clave gratis. Horas en ET.
     3) Yahoo Finance — SIN clave, vía proxy público (último recurso,
                        para que la herramienta funcione de inmediato).

   Para activar las vías con clave, pega tu clave GRATIS abajo. Sin
   claves, funciona igual con Yahoo.
   ══════════════════════════════════════════════════════════════ */

export const CLAVES = {
  twelvedata: '',   // ← clave gratis de https://twelvedata.com (opcional, recomendada)
  fmp: ''           // ← clave gratis de https://financialmodelingprep.com (opcional)
};

const SIMBOLO = 'SPY';   // el ETF del S&P 500: abre justo a las 9:30 ET y es el que dan gratis

/* Proxies públicos para Yahoo (CORS). Se prueban en orden. */
const PROXIES = [
  (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u)
];

const TF_TD = { '1m': '1min', '5m': '5min' };
const TF_FMP = { '1m': '1min', '5m': '5min' };
const TF_YH = { '1m': '1m', '5m': '5m' };
const RANGO_YH = { '1m': '5d', '5m': '1mo' };

async function pedir(url, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

const limpiar = (velas) => {
  const vistos = new Set();
  return velas
    .filter((v) => v && isFinite(v.t) && isFinite(v.o) && isFinite(v.h) && isFinite(v.l) && isFinite(v.c))
    .filter((v) => { if (vistos.has(v.t)) return false; vistos.add(v.t); return true; })
    .sort((a, b) => a.t - b.t);
};

/* ── 1) Twelve Data (UTC) ── */
async function feedTwelveData(tf) {
  const url = `https://api.twelvedata.com/time_series?symbol=${SIMBOLO}&interval=${TF_TD[tf]}&outputsize=5000&timezone=UTC&apikey=${CLAVES.twelvedata}`;
  const j = await pedir(url);
  if (!j || j.status === 'error' || !Array.isArray(j.values)) throw new Error(j && j.message ? j.message : 'twelvedata sin datos');
  const velas = j.values.map((x) => ({
    t: Date.parse(x.datetime.replace(' ', 'T') + 'Z'),
    o: +x.open, h: +x.high, l: +x.low, c: +x.close, v: +(x.volume || 0)
  }));
  return limpiar(velas);
}

/* ── 2) FMP (hora de Nueva York) ── */
const _etOff = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
function etOffsetMin(ms) {
  const d = new Date(ms);
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
  const p = {}; for (const x of _etOff.formatToParts(d)) if (x.type !== 'literal') p[x.type] = x.value;
  let h = +p.hour; if (h === 24) h = 0;
  const et = Date.UTC(+p.year, +p.month - 1, +p.day, h, +p.minute);
  return Math.round((et - utc) / 60000);
}
function etWallToMs(str) {
  const [d, t] = str.split(' ');
  const [Y, Mo, D] = d.split('-').map(Number);
  const [H, Mi, S] = (t || '0:0:0').split(':').map(Number);
  const asUTC = Date.UTC(Y, Mo - 1, D, H, Mi, S || 0);
  return asUTC - etOffsetMin(asUTC) * 60000;
}
async function feedFMP(tf) {
  const url = `https://financialmodelingprep.com/api/v3/historical-chart/${TF_FMP[tf]}/${SIMBOLO}?apikey=${CLAVES.fmp}`;
  const j = await pedir(url);
  if (!Array.isArray(j)) throw new Error(j && j['Error Message'] ? j['Error Message'] : 'fmp sin datos');
  const velas = j.map((x) => ({
    t: etWallToMs(x.date), o: +x.open, h: +x.high, l: +x.low, c: +x.close, v: +(x.volume || 0)
  }));
  return limpiar(velas);
}

/* ── 3) Yahoo (sin clave, vía proxy, UTC) ── */
function parseYahoo(j) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r || !r.timestamp) throw new Error('yahoo sin datos');
  const q = r.indicators.quote[0];
  const velas = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
    if (o == null || h == null || l == null || c == null) continue;
    velas.push({ t: r.timestamp[i] * 1000, o: +o, h: +h, l: +l, c: +c, v: +(q.volume[i] || 0) });
  }
  return limpiar(velas);
}
async function feedYahoo(tf) {
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${SIMBOLO}?interval=${TF_YH[tf]}&range=${RANGO_YH[tf]}&includePrePost=false`;
  let ultimo;
  for (const envolver of PROXIES) {
    try {
      const j = await pedir(envolver(target), 14000);
      const velas = parseYahoo(j);
      if (velas.length > 20) return velas;
    } catch (e) { ultimo = e; }
  }
  throw ultimo || new Error('yahoo sin datos');
}

/** Trae las velas de SPY probando las fuentes en orden, con relevo. Devuelve
 *  { velas, fuente }. Lanza error solo si fallan todas. */
export async function traerVelasSP(tf) {
  if (typeof window !== 'undefined' && typeof window.__SP500_MOCK__ === 'function') {
    return { velas: limpiar(window.__SP500_MOCK__(tf) || []), fuente: 'simulado' };
  }
  const vias = [];
  if (CLAVES.twelvedata) vias.push(['Twelve Data', () => feedTwelveData(tf)]);
  if (CLAVES.fmp) vias.push(['FMP', () => feedFMP(tf)]);
  vias.push(['Yahoo', () => feedYahoo(tf)]);
  let ultimo;
  for (const [nombre, fn] of vias) {
    try {
      const velas = await fn();
      if (velas && velas.length > 20) return { velas, fuente: nombre };
    } catch (e) { ultimo = e; }
  }
  throw ultimo || new Error('sin datos de ninguna fuente');
}
