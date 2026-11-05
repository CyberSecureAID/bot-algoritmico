/* modules/trading-demo/datos.js — Capa de datos del Trading Demo.

   TODO del lado del cliente, sobre fuentes públicas de Binance con CORS (las
   mismas que ya usa el resto de la plataforma). Sin servidor propio, sin
   Cloudflare: velas por REST y, en vivo, un stream COMBINADO por WebSocket
   (velas + libro + trades) para que la gráfica y el libro vayan de alta
   frecuencia. El módulo es autónomo: no importa nada de otras secciones salvo
   el catálogo de monedas y las temporalidades (compartidos a propósito). */

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

/* Velas OHLCV. `time` en SEGUNDOS para lightweight-charts. */
const mapK = (k) => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] });
export async function velas(simbolo, interval = '1m', limit = 500) {
  const n = Math.min(1000, limit);
  const j = await traer(`${BINANCE}/klines?symbol=${encodeURIComponent(simbolo)}&interval=${interval}&limit=${n}`);
  return j.map(mapK);
}

/* Ticker 24h: último precio, cambio %, OHLC del día, volumen. */
export async function ticker(simbolo) {
  const t = await traer(`${BINANCE}/ticker/24hr?symbol=${encodeURIComponent(simbolo)}`);
  return {
    simbolo, last: +t.lastPrice, open: +t.openPrice, high: +t.highPrice, low: +t.lowPrice,
    chg: +t.priceChange, chgPct: +t.priceChangePercent, volBase: +t.volume, volQuote: +t.quoteVolume
  };
}

/* STREAM COMBINADO en vivo: velas (@kline), libro (@depth20@100ms) y trades
   (@aggTrade) en una sola conexión. Reconecta solo si se cae. Devuelve { cerrar }.
   cbs = { onKline, onDepth, onTrade }. */
export function streamMercado(simbolo, interval, cbs) {
  const s = String(simbolo).toLowerCase();
  const streams = [`${s}@kline_${interval}`, `${s}@depth20@100ms`, `${s}@aggTrade`].join('/');
  const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
  let ws = null, cerrado = false, tmr = null;
  const abrir = () => {
    if (cerrado) return;
    try { ws = new WebSocket(url); } catch (_) { reintentar(); return; }
    ws.onmessage = (ev) => {
      let d; try { d = JSON.parse(ev.data); } catch (_) { return; }
      const data = d && d.data; if (!data) return;
      const str = d.stream || '';
      try {
        if (str.includes('@kline') && data.k) { cbs.onKline && cbs.onKline(data.k); }
        else if (str.includes('@depth') && data.bids) { cbs.onDepth && cbs.onDepth(data); }
        else if (str.includes('@aggTrade')) { cbs.onTrade && cbs.onTrade(data); }
      } catch (_) {}
    };
    ws.onclose = () => { if (!cerrado) reintentar(); };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  };
  const reintentar = () => { clearTimeout(tmr); tmr = setTimeout(abrir, 2500); };
  abrir();
  return { cerrar: () => { cerrado = true; clearTimeout(tmr); try { if (ws) ws.close(); } catch (_) {} ws = null; } };
}
