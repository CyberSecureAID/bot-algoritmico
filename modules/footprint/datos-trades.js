/* modules/footprint/datos-trades.js — Capa de datos de Footprint Pro.

   REUTILIZA el mismo mecanismo de datos que el resto de Análisis (ver
   modules/institutional/datos.js): se escribe api.binance.com / stream.binance.com
   y el feed-shim los enruta al vuelo (para EE. UU. resuelve Binance.US). NO se
   escribe el host del espejo a mano ni se usa otra región.

   El footprint necesita OPERACIONES individuales, no solo velas. Fuente:
     · REST  https://api.binance.com/api/v3/aggTrades  (trades agregados)
     · WS    wss://stream.binance.com:9443/ws/<par>@aggTrade  (en vivo)
   Cada trade se clasifica comprador/vendedor por `m` (isBuyerMaker):
     m === true  → el comprador es maker → el AGRESOR es el vendedor → venta
     m === false → el AGRESOR es el comprador → compra

   La misma lista de monedas (PARES) y temporalidades (TFS) del catálogo único
   del sitio, y la misma caché de logos (aurex-logos). */

import { PARES, TFS } from '../../assets/js/niveles/config.js?v=1';
export { PARES, TFS };

const BINANCE = 'https://api.binance.com/api/v3';
const COINGECKO = 'https://api.coingecko.com/api/v3';

async function traer(url, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(url + ' → ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* Milisegundos de una temporalidad clásica de Binance (1m, 5m, 1h, 4h, 1d, 1w). */
export function tfMs(interval) {
  const n = parseInt(interval, 10) || 1;
  const u = String(interval).replace(/[0-9]/g, '');
  const M = { m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return n * (M[u] || 60000);
}

/* Velas OHLCV para el esqueleto de columnas (tiempo y máximos/mínimos). `time`
   en MILISEGUNDOS de apertura, que es como alinea Binance los trades. */
const mapK = (k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], tc: k[6], tb: +k[9] });
export async function velas(simbolo, interval = '1m', limit = 60) {
  const j = await traer(`${BINANCE}/klines?symbol=${encodeURIComponent(simbolo)}&interval=${interval}&limit=${limit}`);
  return j.map(mapK);
}

/* Ticker 24h: último precio, cambio %, máx/mín del día. */
export async function ticker(simbolo) {
  const t = await traer(`${BINANCE}/ticker/24hr?symbol=${encodeURIComponent(simbolo)}`);
  return { simbolo, last: +t.lastPrice, open: +t.openPrice, high: +t.highPrice, low: +t.lowPrice, chg: +t.priceChange, chgPct: +t.priceChangePercent, volBase: +t.volume, volQuote: +t.quoteVolume };
}

/* exchangeInfo: filtro de precio (tickSize) de un par, para dimensionar el bin
   por defecto de forma sensata (un múltiplo del tick real del mercado). */
export async function tickSize(simbolo) {
  try {
    const j = await traer(`${BINANCE}/exchangeInfo?symbol=${encodeURIComponent(simbolo)}`);
    const s = j && j.symbols && j.symbols[0];
    const f = s && s.filters && s.filters.find((x) => x.filterType === 'PRICE_FILTER');
    const ts = f ? +f.tickSize : 0;
    return ts > 0 ? ts : 0;
  } catch (_) { return 0; }
}

/* Un trade normalizado: precio, cantidad, tiempo (ms) y lado agresor.
   buy === true  → agresor comprador (lifts the ask)
   buy === false → agresor vendedor (hits the bid) */
const mapT = (a) => ({ p: +a.p, q: +a.q, t: a.T, buy: a.m === false, id: a.a });

/* Histórico de trades agregados, hacia atrás desde ahora, en varias páginas
   (Binance topa en 1000 por llamada). Se usa para SEMBRAR las velas recientes;
   el grueso del footprint se llena luego en vivo por WebSocket.
   `paginas` controla el presupuesto de llamadas (cada una ~1000 trades). */
export async function aggTradesHist(simbolo, paginas = 6) {
  const out = [];
  let fromId = null;
  // Primera página: las más recientes (sin fromId trae las últimas 1000).
  for (let i = 0; i < paginas; i++) {
    let url = `${BINANCE}/aggTrades?symbol=${encodeURIComponent(simbolo)}&limit=1000`;
    if (fromId != null) url += `&fromId=${Math.max(0, fromId - 1000)}`;
    let j;
    try { j = await traer(url); } catch (_) { break; }
    if (!j || !j.length) break;
    for (const a of j) out.push(mapT(a));
    fromId = j[0].a;                 // id del más antiguo recibido; seguimos hacia atrás
    if (fromId <= 0) break;
    if (j.length < 1000) break;
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/* Stream de trades EN VIVO (navegador → Binance, sin servidor). Emite cada
   trade ya clasificado. Reconecta solo si la conexión se cae. Devuelve {cerrar}. */
export function streamTrades(simbolo, onTrade) {
  const url = `wss://stream.binance.com:9443/ws/${String(simbolo).toLowerCase()}@aggTrade`;
  let ws = null, cerrado = false, tmr = null;
  const abrir = () => {
    if (cerrado) return;
    try { ws = new WebSocket(url); } catch (_) { reintentar(); return; }
    ws.onmessage = (ev) => {
      try { const d = JSON.parse(ev.data); if (d && d.p) onTrade({ p: +d.p, q: +d.q, t: d.T, buy: d.m === false, id: d.a }); } catch (_) {}
    };
    ws.onclose = () => { if (!cerrado) reintentar(); };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  };
  const reintentar = () => { clearTimeout(tmr); tmr = setTimeout(abrir, 2500); };
  abrir();
  return { cerrar: () => { cerrado = true; clearTimeout(tmr); try { if (ws) ws.close(); } catch (_) {} ws = null; } };
}

/* Logos de las monedas (cg → url). Reutiliza la MISMA caché del sitio
   ('aurex-logos'), igual que datos.js y ponerLogos de las otras secciones. */
const CLAVE_LOGOS = 'aurex-logos';
let _logos = null;
export async function logos() {
  if (_logos) return _logos;
  try { const g = JSON.parse(localStorage.getItem(CLAVE_LOGOS) || 'null'); if (g && g.datos) { _logos = g.datos; return _logos; } } catch (_) {}
  try {
    const ids = PARES.filter((p) => p.cg).map((p) => p.cg).join(',');
    const j = await traer(`${COINGECKO}/coins/markets?vs_currency=usd&ids=${ids}&per_page=250&page=1`);
    _logos = {}; j.forEach((x) => { _logos[x.id] = x.image; });
    try { localStorage.setItem(CLAVE_LOGOS, JSON.stringify({ cuando: Date.now(), datos: _logos })); } catch (_) {}
  } catch (_) { _logos = {}; }
  return _logos;
}
