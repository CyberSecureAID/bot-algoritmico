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

/* ───────── Fuente ALTERNA para tokens de PancakeSwap/Uniswap/BSC que NO están en
   Binance (BabyDoge, USDT.z, EXT y cualquier token con pool en una DEX). A diferencia
   de Binance, estas fuentes NO geobloquean EE. UU. Devuelven velas en el MISMO formato
   que velas() de arriba, por lo que la gráfica no distingue el origen.

   RESPALDO EN CASCADA (si una fuente limita por ritmo o cae, la siguiente cubre), el
   mismo patrón ya probado en modules/terminal/gecko.js y terminal/precio.js:
     1) GeckoTerminal  (api.geckoterminal.com)         velas + precio
     2) CoinGecko on-chain (api.coingecko.com/.../onchain)  MISMO dataset, otro CDN
     3) DexScreener    (api.dexscreener.com)           precio del par de MÁS liquidez
        (elige solo la DEX con mejor liquidez: Pancake o Uniswap)
   GeckoTerminal pide atribución (se muestra bajo la gráfica en estos tokens). Red BSC. */
const GT_BASES = ['https://api.geckoterminal.com/api/v2', 'https://api.coingecko.com/api/v3/onchain'];
const DEXSCREENER_TOK = 'https://api.dexscreener.com/latest/dex/tokens/';
const RED_GT = 'bsc';
/* temporalidad del sitio -> [timeframe, aggregate] de GeckoTerminal */
const TF_GT = { '1m': ['minute', 1], '5m': ['minute', 5], '15m': ['minute', 15], '1h': ['hour', 1], '4h': ['hour', 4], '1d': ['day', 1] };
const _poolCache = {};

/* Pide la MISMA ruta a los dos orígenes on-chain en cascada: el primero que responda
   OK gana (si GeckoTerminal limita por ritmo o cae, cubre el espejo de CoinGecko).
   path empieza por '/'. */
async function jgetGT(path, ms = 10000) {
  let err = null;
  for (const base of GT_BASES) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(base + path, { signal: c.signal, headers: { accept: 'application/json' } }); clearTimeout(t); if (r.ok) return await r.json(); err = new Error('HTTP ' + r.status); }
    catch (e) { clearTimeout(t); err = e; }
  }
  throw err || new Error('gecko');
}

/* Mejor pool (más liquidez) de un token por su contrato. Se cachea por sesión. */
export async function poolDe(address) {
  const k = String(address || '').toLowerCase(); if (!k) return null;
  if (_poolCache[k]) return _poolCache[k];
  let pool = null;
  try {
    const j = await jgetGT(`/networks/${RED_GT}/tokens/${k}/pools?page=1`);
    const arr = (j && j.data) || []; let best = null, mejor = -1;
    for (const p of arr) { const liq = +(((p.attributes || {}).reserve_in_usd) || 0); if (liq > mejor) { mejor = liq; best = p; } }
    pool = best && best.attributes && best.attributes.address;
  } catch (_) {}
  if (pool) _poolCache[k] = pool;
  return pool || null;
}

const mapGT = (r) => ({ time: Math.floor(+r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] });
async function ohlcvGT(address, interval, limit, beforeSec) {
  const pool = await poolDe(address); if (!pool) throw new Error('sin pool DEX para ' + address);
  const [tf, agg] = TF_GT[interval] || TF_GT['1d'];
  let p = `/networks/${RED_GT}/pools/${pool}/ohlcv/${tf}?aggregate=${agg}&limit=${Math.min(1000, limit)}&currency=usd&token=base`;
  if (beforeSec) p += `&before_timestamp=${Math.floor(beforeSec)}`;
  const j = await jgetGT(p);
  const list = (((j || {}).data || {}).attributes || {}).ohlcv_list || [];
  return list.map(mapGT).filter((c) => c.close > 0).sort((a, b) => a.time - b.time);
}
/* Velas de un token DEX (más reciente al final), mismo shape que velas(). */
export async function velasDex(address, interval = '1d', limit = 1000) { return ohlcvGT(address, interval, limit, 0); }
/* Velas MÁS VIEJAS de un token DEX (scroll al pasado). */
export async function velasDexAntes(address, interval, endSec, limit = 1000) { return ohlcvGT(address, interval, limit, endSec); }

/* Precio USD por contrato desde DexScreener (par de MÁS liquidez, cualquier DEX de BSC:
   Pancake o Uniswap). Respaldo independiente de GeckoTerminal. */
export async function precioDexScreener(address) {
  try {
    const low = (s) => String(s || '').toLowerCase();
    const r = await fetch(DEXSCREENER_TOK + address); const j = await r.json();
    const ps = ((j && j.pairs) || []).filter((p) => p && p.chainId === 'bsc' && p.baseToken && low(p.baseToken.address) === low(address));
    if (!ps.length) return 0;
    ps.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
    return Number(ps[0].priceUsd) || 0;
  } catch (_) { return 0; }
}

/* Precio USD de uno o varios tokens por contrato (GeckoTerminal en una sola llamada);
   lo que falte se completa con DexScreener. */
export async function preciosDex(addresses) {
  const lista = [...new Set((addresses || []).map((a) => String(a || '').toLowerCase()).filter(Boolean))];
  if (!lista.length) return {};
  const out = {};
  try {
    const j = await jgetGT(`/simple/networks/${RED_GT}/token_price/${lista.join(',')}`);
    const mapa = (((j || {}).data || {}).attributes || {}).token_prices || {};
    for (const a of lista) { const v = +mapa[a]; if (v > 0) out[a] = v; }
  } catch (_) {}
  const faltan = lista.filter((a) => !(out[a] > 0));
  if (faltan.length) { const res = await Promise.all(faltan.map((a) => precioDexScreener(a))); faltan.forEach((a, i) => { if (res[i] > 0) out[a] = res[i]; }); }
  return out;
}

/* Ticker mínimo (solo precio) de un token DEX, con respaldo en cascada:
   GeckoTerminal -> DexScreener -> último cierre de velas. */
export async function tickerDex(address) {
  try { const p = await preciosDex([address]); const px = p[String(address).toLowerCase()]; if (px > 0) return { last: px }; } catch (_) {}
  try { const px = await precioDexScreener(address); if (px > 0) return { last: px }; } catch (_) {}
  try { const v = await velasDex(address, '1d', 2); const c = v[v.length - 1]; return { last: c ? c.close : 0 }; } catch (_) { return { last: 0 }; }
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
