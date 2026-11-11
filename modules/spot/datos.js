/* modules/trading-demo/datos.js — Capa de datos del Trading Demo.

   Todo del lado del cliente, sobre fuentes públicas de Binance/CoinGecko con
   CORS (las mismas que ya usa la plataforma). Sin servidor, sin Cloudflare.
   Velas por REST y, en vivo, el stream de velas por WebSocket (actualiza la
   vela en formación en cada tick: movimiento en tiempo real). Logos de las
   monedas desde CoinGecko, con la MISMA caché que el resto de secciones. */

import { PARES, TFS } from '../../assets/js/niveles/config.js?v=1';
export { PARES, TFS };

const BINANCE = 'https://api.binance.com/api/v3';

async function traer(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(url + ' → ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

const mapK = (k) => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] });
export async function velas(simbolo, interval = '1m', limit = 500) {
  const n = Math.min(1000, limit);
  const j = await traer(`${BINANCE}/klines?symbol=${encodeURIComponent(simbolo)}&interval=${interval}&limit=${n}`);
  return j.map(mapK);
}

/* Velas MÁS ANTIGUAS que un instante dado (endTime, en ms). Sirve para ir hacia el
   pasado al hacer scroll a la izquierda: se piden lotes previos y se anteponen. */
export async function velasAntes(simbolo, interval, endTimeMs, limit = 1000) {
  const n = Math.min(1000, limit);
  const j = await traer(`${BINANCE}/klines?symbol=${encodeURIComponent(simbolo)}&interval=${interval}&endTime=${Math.floor(endTimeMs)}&limit=${n}`);
  return j.map(mapK);
}

/* ───────── Fuente ALTERNA para tokens de PancakeSwap/BSC que NO están en Binance
   (BabyDoge, USDT.z, EXT y cualquier token con pool en PancakeSwap/Uniswap). Usa la
   API pública y SIN llave de GeckoTerminal (CoinGecko on-chain). A diferencia de
   Binance, GeckoTerminal NO geobloquea EE. UU., así que sirve de respaldo para la
   gráfica de tokens que la fuente tradicional no lista. Devuelve velas en el MISMO
   formato que velas() de arriba, por lo que la gráfica no distingue el origen.
   La API pide atribución a GeckoTerminal (se muestra bajo la gráfica en estos tokens).
   Red BSC = 'bsc'. Verificado contra la documentación oficial de CoinGecko on-chain. */
const GECKO = 'https://api.geckoterminal.com/api/v2';
const RED_GT = 'bsc';
/* temporalidad del sitio -> [timeframe, aggregate] de GeckoTerminal */
const TF_GT = { '1m': ['minute', 1], '5m': ['minute', 5], '15m': ['minute', 15], '1h': ['hour', 1], '4h': ['hour', 4], '1d': ['day', 1] };
const _poolCache = {};

/* Mejor pool (más liquidez) de un token por su contrato. Se cachea por sesión. */
export async function poolDe(address) {
  const k = String(address || '').toLowerCase(); if (!k) return null;
  if (_poolCache[k]) return _poolCache[k];
  const j = await traer(`${GECKO}/networks/${RED_GT}/tokens/${k}/pools?page=1`);
  const arr = (j && j.data) || [];
  let best = null, mejor = -1;
  for (const p of arr) { const liq = +(((p.attributes || {}).reserve_in_usd) || 0); if (liq > mejor) { mejor = liq; best = p; } }
  const pool = best && best.attributes && best.attributes.address;
  if (pool) _poolCache[k] = pool;
  return pool || null;
}

const mapGT = (r) => ({ time: Math.floor(+r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] });
async function ohlcvGT(address, interval, limit, beforeSec) {
  const pool = await poolDe(address); if (!pool) throw new Error('sin pool DEX para ' + address);
  const [tf, agg] = TF_GT[interval] || TF_GT['1d'];
  let u = `${GECKO}/networks/${RED_GT}/pools/${pool}/ohlcv/${tf}?aggregate=${agg}&limit=${Math.min(1000, limit)}&currency=usd&token=base`;
  if (beforeSec) u += `&before_timestamp=${Math.floor(beforeSec)}`;
  const j = await traer(u, 10000);
  const list = (((j || {}).data || {}).attributes || {}).ohlcv_list || [];
  return list.map(mapGT).filter((c) => c.close > 0).sort((a, b) => a.time - b.time);
}
/* Velas de un token DEX (más reciente al final), mismo shape que velas(). */
export async function velasDex(address, interval = '1d', limit = 1000) { return ohlcvGT(address, interval, limit, 0); }
/* Velas MÁS VIEJAS de un token DEX (scroll al pasado). */
export async function velasDexAntes(address, interval, endSec, limit = 1000) { return ohlcvGT(address, interval, limit, endSec); }

/* Precio USD actual de uno o varios tokens por contrato, en UNA sola llamada. */
export async function preciosDex(addresses) {
  const lista = [...new Set((addresses || []).map((a) => String(a || '').toLowerCase()).filter(Boolean))];
  if (!lista.length) return {};
  const j = await traer(`${GECKO}/simple/networks/${RED_GT}/token_price/${lista.join(',')}`);
  const mapa = (((j || {}).data || {}).attributes || {}).token_prices || {};
  const out = {}; for (const a of lista) { const v = +mapa[a]; if (v > 0) out[a] = v; } return out;
}
/* Ticker mínimo (solo precio) de un token DEX. */
export async function tickerDex(address) {
  try { const p = await preciosDex([address]); const px = p[String(address).toLowerCase()]; if (px > 0) return { last: px }; } catch (_) {}
  const v = await velasDex(address, '1d', 2); const c = v[v.length - 1]; return { last: c ? c.close : 0 };
}

export async function ticker(simbolo) {
  const t = await traer(`${BINANCE}/ticker/24hr?symbol=${encodeURIComponent(simbolo)}`);
  return {
    simbolo, last: +t.lastPrice, open: +t.openPrice, high: +t.highPrice, low: +t.lowPrice,
    chg: +t.priceChange, chgPct: +t.priceChangePercent, volBase: +t.volume, volQuote: +t.quoteVolume
  };
}

/* Stream de velas EN VIVO (@kline): la vela en formación llega en cada tick, y
   al cerrar con k.x === true. Reconecta solo si se cae. Devuelve { cerrar }. */
export function streamVelas(simbolo, interval, onKline) {
  const url = `wss://stream.binance.com:9443/ws/${String(simbolo).toLowerCase()}@kline_${interval}`;
  let ws = null, cerrado = false, tmr = null;
  const abrir = () => {
    if (cerrado) return;
    try { ws = new WebSocket(url); } catch (_) { reintentar(); return; }
    ws.onmessage = (ev) => { try { const d = JSON.parse(ev.data); if (d && d.k) onKline(d.k); } catch (_) {} };
    ws.onclose = () => { if (!cerrado) reintentar(); };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  };
  const reintentar = () => { clearTimeout(tmr); tmr = setTimeout(abrir, 2500); };
  abrir();
  return { cerrar: () => { cerrado = true; clearTimeout(tmr); try { if (ws) ws.close(); } catch (_) {} ws = null; } };
}

/* Mapa { cg-id: urlDelLogo } desde CoinGecko, con la MISMA caché de 24h que
   usa el resto del sitio (localStorage 'aurex-logos-v2'), para no repetir
   descargas. Si falla, devuelve {} y la UI usa la inicial de la moneda. */
const CLAVE_LOGOS = 'aurex-logos-v2';
let _logos = null;
export async function logos() {
  if (_logos) return _logos;
  try { const g = JSON.parse(localStorage.getItem(CLAVE_LOGOS)); if (g && Date.now() - g.cuando < 86400000) { _logos = g.datos; return _logos; } } catch (_) {}
  try {
    const ids = PARES.filter((p) => p.cg).map((p) => p.cg).slice(0, 250).join(',');
    const j = await traer(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=250`);
    _logos = {}; j.forEach((x) => { _logos[x.id] = x.image; });
    try { localStorage.setItem(CLAVE_LOGOS, JSON.stringify({ cuando: Date.now(), datos: _logos })); } catch (_) {}
  } catch (_) { _logos = _logos || {}; }
  return _logos;
}
