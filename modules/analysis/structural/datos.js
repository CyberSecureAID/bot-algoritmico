/* ══════════════════════════════════════════════════════════════
   structural/datos.js — Datos multimoneda para "Structural Logic".

   Una sola vía universal: Yahoo Finance (sin clave) vía proxy CORS,
   que sirve IGUAL índices (^GSPC, ^NDX, ^DJI, ^RUT) y cripto
   (BTC-USD, ETH-USD, …). Se normaliza a {t,o,h,l,c,v} en ms, ascendente.

   SP500 sale por defecto. Hay un hook de simulación (window.__SL_MOCK__)
   para poder verificar el render sin red.
   ══════════════════════════════════════════════════════════════ */

/* Símbolos ofrecidos. 'logo' = id de logo propio (índices, SVG en el overlay);
   'cg' = id de CoinGecko para el logo (cripto, misma fuente que el resto del sitio). */
export const SIMBOLOS = [
  { id: 'spx', y: '^GSPC', n: 'S&P 500',      corto: 'SPX',  tipo: 'Index',  logo: 'spx' },
  { id: 'ndx', y: '^NDX',  n: 'Nasdaq 100',   corto: 'NDX',  tipo: 'Index',  logo: 'ndx' },
  { id: 'dji', y: '^DJI',  n: 'Dow Jones',    corto: 'DJIA', tipo: 'Index',  logo: 'dji' },
  { id: 'rut', y: '^RUT',  n: 'Russell 2000', corto: 'RUT',  tipo: 'Index',  logo: 'rut' },
  { id: 'btc', y: 'BTC-USD', n: 'Bitcoin',    corto: 'BTC',  tipo: 'Crypto', cg: 'bitcoin' },
  { id: 'eth', y: 'ETH-USD', n: 'Ethereum',   corto: 'ETH',  tipo: 'Crypto', cg: 'ethereum' },
  { id: 'bnb', y: 'BNB-USD', n: 'BNB',        corto: 'BNB',  tipo: 'Crypto', cg: 'binancecoin' },
  { id: 'sol', y: 'SOL-USD', n: 'Solana',     corto: 'SOL',  tipo: 'Crypto', cg: 'solana' },
  { id: 'xrp', y: 'XRP-USD', n: 'XRP',        corto: 'XRP',  tipo: 'Crypto', cg: 'ripple' }
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
export const simuladoActivo = () => typeof window !== 'undefined' && typeof window.__SL_MOCK__ === 'function';

/* Proxies CORS para Yahoo (se prueban en orden). */
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

const limpiar = (velas) => {
  const vistos = new Set();
  return velas
    .filter((v) => v && isFinite(v.t) && isFinite(v.o) && isFinite(v.h) && isFinite(v.l) && isFinite(v.c))
    .filter((v) => v.o > 0 && v.h > 0 && v.l > 0 && v.c > 0 && v.h >= v.l)
    .filter((v) => { if (vistos.has(v.t)) return false; vistos.add(v.t); return true; })
    .sort((a, b) => a.t - b.t);
};

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

/* Trae velas de un símbolo Yahoo en una temporalidad. */
export async function traerVelas(simY, tf) {
  if (simuladoActivo()) return limpiar(window.__SL_MOCK__(simY, tf) || []);
  const T = TFS.find((t) => t[0] === tf) || TFS[5];
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simY)}?interval=${T[2]}&range=${T[3]}&includePrePost=false`;
  const txt = await viaProxy(target);
  return parseYahoo(JSON.parse(txt));
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
