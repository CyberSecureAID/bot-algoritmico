/* ══════════════════════════════════════════════════════════════
   structural/datos.js — Datos multimoneda para "Structural Logic",
   con VARIAS fuentes y RELEVO automático (como el SP500 que ya jala).

   - Cripto  → Binance directo (CORS abierto, sin proxy) → Yahoo (respaldo).
   - Índices → Twelve Data con el ETF (SPY/QQQ/DIA/IWM, clave gratis que ya
               usa el sitio) → Yahoo → Stooq (diario).
   Todo se normaliza a {t,o,h,l,c,v} en ms, ascendente. SP500 por defecto.
   Hay un hook de simulación (window.__SL_MOCK__) para verificar sin red.
   ══════════════════════════════════════════════════════════════ */

export const CLAVES = {
  twelvedata: 'bdeb2354693b4596a38c6e6f35e544f9',   // clave gratis de Twelve Data (la misma del SP500). Rotable en twelvedata.com.
  fmp: ''
};

/* Símbolos. Índices servidos por su ETF (lo que da gratis y fiable). */
export const SIMBOLOS = [
  { id: 'spx', n: 'S&P 500',      corto: 'SPX',  tipo: 'Index',  td: 'SPY', yh: 'SPY', stq: 'spy.us' },
  { id: 'ndx', n: 'Nasdaq 100',   corto: 'NDX',  tipo: 'Index',  td: 'QQQ', yh: 'QQQ', stq: 'qqq.us' },
  { id: 'dji', n: 'Dow Jones',    corto: 'DJIA', tipo: 'Index',  td: 'DIA', yh: 'DIA', stq: 'dia.us' },
  { id: 'rut', n: 'Russell 2000', corto: 'RUT',  tipo: 'Index',  td: 'IWM', yh: 'IWM', stq: 'iwm.us' },
  { id: 'btc', n: 'Bitcoin',      corto: 'BTC',  tipo: 'Crypto', bn: 'BTCUSDT', yh: 'BTC-USD', cg: 'bitcoin' },
  { id: 'eth', n: 'Ethereum',     corto: 'ETH',  tipo: 'Crypto', bn: 'ETHUSDT', yh: 'ETH-USD', cg: 'ethereum' },
  { id: 'bnb', n: 'BNB',          corto: 'BNB',  tipo: 'Crypto', bn: 'BNBUSDT', yh: 'BNB-USD', cg: 'binancecoin' },
  { id: 'sol', n: 'Solana',       corto: 'SOL',  tipo: 'Crypto', bn: 'SOLUSDT', yh: 'SOL-USD', cg: 'solana' },
  { id: 'xrp', n: 'XRP',          corto: 'XRP',  tipo: 'Crypto', bn: 'XRPUSDT', yh: 'XRP-USD', cg: 'ripple' }
];
export const POR_DEFECTO = 'spx';

/* Temporalidades: [id, etiqueta, intervalo Yahoo, rango Yahoo]. 1m..1W. */
export const TFS = [
  ['1m', '1m', '1m', '7d'],
  ['5m', '5m', '5m', '1mo'],
  ['15m', '15m', '15m', '3mo'],
  ['30m', '30m', '30m', '3mo'],
  ['1h', '1H', '60m', '2y'],
  ['1d', '1D', '1d', '10y'],
  ['1w', '1W', '1wk', '10y']
];
const TF_BN = { '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '1d': '1d', '1w': '1w' };
const TF_TD = { '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min', '1h': '1h', '1d': '1day', '1w': '1week' };
export const simuladoActivo = () => typeof window !== 'undefined' && typeof window.__SL_MOCK__ === 'function';

/* ── utilidades ── */
const limpiar = (velas) => {
  const vistos = new Set();
  return velas
    .filter((v) => v && isFinite(v.t) && isFinite(v.o) && isFinite(v.h) && isFinite(v.l) && isFinite(v.c))
    .filter((v) => v.o > 0 && v.h > 0 && v.l > 0 && v.c > 0 && v.h >= v.l)
    .filter((v) => { if (vistos.has(v.t)) return false; vistos.add(v.t); return true; })
    .sort((a, b) => a.t - b.t);
};
async function pedir(url, ms = 12000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
/* Proxies CORS (para Yahoo y Stooq, que no permiten fetch directo). */
const PROXIES = [
  { make: (u) => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u), wrap: false },
  { make: (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u), wrap: true },
  { make: (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u), wrap: false }
];
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

/* ── 1) Binance (cripto, directo con CORS abierto) ──
   Se pagina hacia atrás con endTime para traer MUCHA más historia
   (hasta ~3000 velas intradía): así el usuario puede retroceder en el
   gráfico y verificar todas las señales del pasado, no solo un tramo corto. */
async function feedBinance(sym, tf) {
  const iv = TF_BN[tf]; if (!iv) throw new Error('binance tf');
  const PAG = (tf === '1d' || tf === '1w') ? 1 : 3;
  let all = [], endTime = null;
  for (let p = 0; p < PAG; p++) {
    const u = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${iv}&limit=1000` + (endTime ? `&endTime=${endTime}` : '');
    const j = await pedir(u);
    if (!Array.isArray(j) || !j.length) break;
    all = j.concat(all);
    endTime = j[0][0] - 1;          // justo antes de la vela más antigua del lote
    if (j.length < 1000) break;     // ya no hay más historia disponible
  }
  if (!all.length) throw new Error('binance sin datos');
  return limpiar(all.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] })));
}

/* ── 2) Twelve Data (índices vía ETF, clave gratis) ── */
async function feedTwelveData(sym, tf) {
  const iv = TF_TD[tf]; if (!iv || !CLAVES.twelvedata) throw new Error('td no disponible');
  const j = await pedir(`https://api.twelvedata.com/time_series?symbol=${sym}&interval=${iv}&outputsize=5000&timezone=UTC&apikey=${CLAVES.twelvedata}`);
  if (!j || j.status === 'error' || !Array.isArray(j.values)) throw new Error(j && j.message ? j.message : 'td sin datos');
  return limpiar(j.values.map((x) => ({
    t: Date.parse(x.datetime.includes(' ') ? x.datetime.replace(' ', 'T') + 'Z' : x.datetime + 'T00:00:00Z'),
    o: +x.open, h: +x.high, l: +x.low, c: +x.close, v: +(x.volume || 0)
  })));
}

/* ── 3) Yahoo (universal, vía proxy) ── */
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
async function feedYahoo(sym, tf) {
  const T = TFS.find((t) => t[0] === tf) || TFS[5];
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${T[2]}&range=${T[3]}&includePrePost=false`;
  return parseYahoo(JSON.parse(await viaProxy(target)));
}

/* ── 4) Stooq (índices vía ETF, diario, último recurso) ── */
async function feedStooq(stq) {
  const txt = await viaProxy(`https://stooq.com/q/d/l/?s=${stq}&i=d`);
  if (/^\s*</.test(txt) || /html/i.test(txt.slice(0, 40))) throw new Error('stooq html');
  const lineas = txt.trim().split(/\r?\n/); if (lineas.length < 3) throw new Error('stooq sin datos');
  const velas = [];
  for (let i = 1; i < lineas.length; i++) {
    const c = lineas[i].split(','); if (c.length < 5) continue;
    const o = +c[1], h = +c[2], l = +c[3], cl = +c[4], v = +(c[5] || 0);
    if (isFinite(o) && isFinite(cl)) velas.push({ t: Date.parse(c[0] + 'T00:00:00Z'), o, h, l, c: cl, v });
  }
  return limpiar(velas);
}

/* Trae velas de un símbolo probando sus fuentes en orden. Devuelve {velas, fuente}. */
export async function traerVelas(sim, tf) {
  if (simuladoActivo()) return { velas: limpiar(window.__SL_MOCK__(sim, tf) || []), fuente: 'simulado' };
  const vias = [];
  if (sim.tipo === 'Crypto') {
    if (sim.bn) vias.push(['Binance', () => feedBinance(sim.bn, tf)]);
    if (sim.yh) vias.push(['Yahoo', () => feedYahoo(sim.yh, tf)]);
  } else {
    if (sim.td && CLAVES.twelvedata && TF_TD[tf]) vias.push(['Twelve Data', () => feedTwelveData(sim.td, tf)]);
    if (sim.yh) vias.push(['Yahoo', () => feedYahoo(sim.yh, tf)]);
    if (tf === '1d' && sim.stq) vias.push(['Stooq', () => feedStooq(sim.stq)]);
  }
  let ultimo;
  for (const [nombre, fn] of vias) {
    try { const velas = await fn(); if (velas && velas.length > 30) return { velas, fuente: nombre }; }
    catch (e) { ultimo = e; }
  }
  throw ultimo || new Error('sin datos de ninguna fuente');
}

/* Logo de cripto desde CoinGecko, con la MISMA cache que el resto del sitio. */
function cgCache() { try { const j = JSON.parse(localStorage.getItem('mv-cg') || '{}'); return j.d || {}; } catch (_) { return {}; } }
export async function logoCripto(cg) {
  if (!cg) return null;
  const d = cgCache();
  if (d[cg] && d[cg].img) return d[cg].img;
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + cg);
    if (r.ok) { const j = await r.json(); if (j[0] && j[0].image) {
      d[cg] = { img: j[0].image, price: j[0].current_price, chg: j[0].price_change_percentage_24h };
      try { localStorage.setItem('mv-cg', JSON.stringify({ t: Date.now(), d })); } catch (_) {}
      return j[0].image;
    } }
  } catch (_) {}
  return null;
}
