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
  marketstack: 'a80815ee20262ebb09fd1ed058729046',   // clave gratis de marketstack (EOD = solo DIARIO, 100 peticiones al mes). Puedes rotarla con "Reset Key".
  twelvedata: 'bdeb2354693b4596a38c6e6f35e544f9',   // clave gratis de Twelve Data: da INTRADIA (5m/15m/1h) y diaria, 800 al dia. Rotable en twelvedata.com.
  fmp: ''           // ← clave gratis de https://financialmodelingprep.com (opcional)
};

const SIMBOLO = 'SPY';   // el ETF del S&P 500: abre justo a las 9:30 ET y es el que dan gratis

/* Proxies públicos para Yahoo (CORS). Se prueban en orden. */
/* Proxies CORS para fuentes sin clave (Yahoo, Stooq). Se prueban en orden.
   corsproxy.io se quito: ahora exige registro y devuelve 401. */
const PROXIES = [
  { make: (u) => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u), wrap: false },
  { make: (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u), wrap: true },
  { make: (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u), wrap: false }
];
/* Devuelve el TEXTO de una URL ajena pasando por un proxy CORS, con relevo. */
async function viaProxy(target, ms = 14000) {
  let ultimo;
  for (const px of PROXIES) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(px.make(target), { signal: ctl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (px.wrap) { const j = await r.json(); if (j && typeof j.contents === 'string' && j.contents) return j.contents; throw new Error('wrap vacio'); }
      return await r.text();
    } catch (e) { ultimo = e; } finally { clearTimeout(t); }
  }
  throw ultimo || new Error('proxy sin datos');
}

const TF_TD = { '5m': '5min', '15m': '15min', '1h': '1h', '1d': '1day' };
const TF_FMP = { '5m': '5min', '15m': '15min', '1h': '1hour' };
const TF_YH = { '5m': '5m', '15m': '15m', '1h': '1h', '1d': '1d' };
const RANGO_YH = { '5m': '1mo', '15m': '3mo', '1h': '6mo', '1d': '2y' };
export const ES_DIARIA = (tf) => tf === '1d';

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
    t: Date.parse(x.datetime.includes(' ') ? x.datetime.replace(' ', 'T') + 'Z' : x.datetime + 'T00:00:00Z'),
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
  if (tf === '1d') {
    const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${SIMBOLO}?timeseries=600&apikey=${CLAVES.fmp}`;
    const j = await pedir(url);
    const arr = j && j.historical;
    if (!Array.isArray(arr)) throw new Error('fmp sin datos');
    return limpiar(arr.map((x) => ({ t: etWallToMs(x.date), o: +x.open, h: +x.high, l: +x.low, c: +x.close, v: +(x.volume || 0) })));
  }
  const url = `https://financialmodelingprep.com/api/v3/historical-chart/${TF_FMP[tf]}/${SIMBOLO}?apikey=${CLAVES.fmp}`;
  const j = await pedir(url);
  if (!Array.isArray(j)) throw new Error(j && j['Error Message'] ? j['Error Message'] : 'fmp sin datos');
  const velas = j.map((x) => ({
    t: etWallToMs(x.date), o: +x.open, h: +x.high, l: +x.low, c: +x.close, v: +(x.volume || 0)
  }));
  return limpiar(velas);
}

/* ── 0) marketstack (clave gratis, EOD = solo DIARIO). Fiable para 1d.
   Plan gratis: 100 peticiones al MES, asi que una por carga y SIN sondeo. ── */
async function feedMarketstack(tf) {
  if (tf !== '1d') throw new Error('marketstack free: solo diario');
  const url = `https://api.marketstack.com/v1/eod?access_key=${CLAVES.marketstack}&symbols=SPY&limit=1000`;
  const j = await pedir(url);
  if (!j || !Array.isArray(j.data)) throw new Error(j && j.error ? (j.error.message || 'marketstack error') : 'marketstack sin datos');
  const velas = j.data.map((x) => ({ t: Date.parse(x.date), o: +x.open, h: +x.high, l: +x.low, c: +x.close, v: +(x.volume || 0) }));
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
  const txt = await viaProxy(target);
  return parseYahoo(JSON.parse(txt));
}

/* ── 4) Stooq (sin clave, vía proxy, CSV). Solo diario, ultimo recurso. ── */
function parseStooqCSV(txt) {
  const lineas = txt.trim().split(/\r?\n/);
  if (lineas.length < 3) throw new Error('stooq sin datos');
  const velas = [];
  for (let i = 1; i < lineas.length; i++) {
    const c = lineas[i].split(',');
    if (c.length < 5) continue;
    const o = +c[1], h = +c[2], l = +c[3], cl = +c[4], v = +(c[5] || 0);
    if (isFinite(o) && isFinite(cl)) velas.push({ t: etWallToMs(c[0]), o, h, l, c: cl, v });
  }
  return limpiar(velas);
}
async function feedStooq(tf) {
  if (tf !== '1d') throw new Error('stooq solo diario');
  const txt = await viaProxy('https://stooq.com/q/d/l/?s=spy.us&i=d');
  if (/^\s*</.test(txt) || /html/i.test(txt.slice(0, 40))) throw new Error('stooq html');
  return parseStooqCSV(txt);
}

/** Trae las velas de SPY probando las fuentes en orden, con relevo. Devuelve
 *  { velas, fuente }. Lanza error solo si fallan todas. */
export async function traerVelasSP(tf) {
  if (typeof window !== 'undefined' && typeof window.__SP500_MOCK__ === 'function') {
    return { velas: limpiar(window.__SP500_MOCK__(tf) || []), fuente: 'simulado' };
  }
  const vias = [];
  if (CLAVES.marketstack) vias.push(['marketstack', () => feedMarketstack(tf)]);
  if (CLAVES.twelvedata) vias.push(['Twelve Data', () => feedTwelveData(tf)]);
  if (CLAVES.fmp) vias.push(['FMP', () => feedFMP(tf)]);
  vias.push(['Yahoo', () => feedYahoo(tf)]);
  vias.push(['Stooq', () => feedStooq(tf)]);
  let ultimo;
  for (const [nombre, fn] of vias) {
    try {
      const velas = await fn();
      if (velas && velas.length > 20) return { velas, fuente: nombre };
    } catch (e) { ultimo = e; }
  }
  throw ultimo || new Error('sin datos de ninguna fuente');
}
