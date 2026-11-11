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
