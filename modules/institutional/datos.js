/* modules/institutional/datos.js
   Capa de datos del terminal de Análisis Institucional.

   TODO es del lado del cliente y sobre fuentes públicas CON CORS (las mismas
   que ya usa la plataforma): Binance (velas, ticker 24h), CoinGecko (board y
   dominancia) y alternative.me (índice miedo/codicia). El backend de
   OpenTerminal (Yahoo, RSS, FRED, SEC…) necesita servidor propio y no corre en
   un hosting estático: esos paneles se conectan en el "entorno conectado" que
   describe el disclaimer. Cada llamada lleva timeout y cadena de respaldo. */

import { PARES, TFS } from '../../assets/js/niveles/config.js?v=1';

export { PARES, TFS };   // MISMAS temporalidades clásicas que el resto de secciones

const BINANCE = 'https://api.binance.com/api/v3';
const COINGECKO = 'https://api.coingecko.com/api/v3';
const FNG = 'https://api.alternative.me/fng/?limit=1';

async function traer(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(url + ' → ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* Velas OHLCV. `time` en SEGUNDOS para lightweight-charts. El intervalo es una
   temporalidad clásica de Binance (1m, 5m, 1h, 4h, 1d, 1w…), la misma lista que
   usan las demás secciones (config.js TFS).

   Binance topa en 1000 velas por llamada. Si se piden más (backtesting), se
   PAGINA hacia atrás con `endTime` en varias llamadas y se unen. Para `limit`
   ≤ 1000 el comportamiento es idéntico al de antes (una sola llamada). */
const mapK = (k) => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] });
export async function velas(simbolo, interval = '1h', limit = 500) {
  const MAX = 1000;
  if (limit <= MAX) {
    const j = await traer(`${BINANCE}/klines?symbol=${encodeURIComponent(simbolo)}&interval=${interval}&limit=${limit}`);
    return j.map(mapK);
  }
  let restante = limit, endTime = null; const lotes = [];
  for (let i = 0; i < 12 && restante > 0; i++) {           // tope de seguridad: 12 llamadas
    const n = Math.min(MAX, restante);
    const u = `${BINANCE}/klines?symbol=${encodeURIComponent(simbolo)}&interval=${interval}&limit=${n}` + (endTime != null ? `&endTime=${endTime}` : '');
    let j; try { j = await traer(u); } catch (_) { break; }
    if (!j || !j.length) break;
    lotes.unshift(j);
    endTime = j[0][0] - 1;                                  // justo antes de la vela más antigua recibida
    restante -= j.length;
    if (j.length < n) break;                                // no hay más historia disponible
  }
  const vistos = new Set(); const out = [];
  for (const lote of lotes) for (const k of lote) { const t = Math.floor(k[0] / 1000); if (!vistos.has(t)) { vistos.add(t); out.push(mapK(k)); } }
  out.sort((a, b) => a.time - b.time);
  return out;
}

/* Ticker 24h de un símbolo: último, cambio %, OHLC del día, volumen. */
export async function ticker(simbolo) {
  const t = await traer(`${BINANCE}/ticker/24hr?symbol=${encodeURIComponent(simbolo)}`);
  return {
    simbolo,
    last: +t.lastPrice,
    bid: +t.bidPrice, ask: +t.askPrice,
    open: +t.openPrice, high: +t.highPrice, low: +t.lowPrice,
    prevClose: +t.prevClosePrice,
    chg: +t.priceChange, chgPct: +t.priceChangePercent,
    volBase: +t.volume, volQuote: +t.quoteVolume
  };
}

/* Varios tickers de una sola llamada (para la watchlist). */
export async function tickers(simbolos) {
  if (!simbolos.length) return [];
  const url = `${BINANCE}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(simbolos))}`;
  const j = await traer(url);
  return j.map((t) => ({ simbolo: t.symbol, last: +t.lastPrice, chgPct: +t.priceChangePercent, volQuote: +t.quoteVolume, high: +t.highPrice, low: +t.lowPrice }));
}

/* Board de mercado: top por capitalización, con cambio 24h/7d y sparkline.
   Fuente principal CoinGecko; respaldo = tickers de Binance sobre el catálogo. */
export async function board() {
  // PRIMARIO: Binance 24h en TIEMPO REAL sobre todo el catálogo cripto. El heatmap
  // dimensiona por |cambio 24h| (no por capitalización), así que esto basta y va
  // siempre fresco (CoinGecko puede ir con retraso y dar colores desfasados).
  try {
    const pares = PARES.filter((p) => p.grupo !== 'divisa' && p.grupo !== 'materia');
    const map = {}; PARES.forEach((p) => { map[p.s] = p; });
    const ts = await tickers(pares.map((p) => p.s));
    const out = ts.map((t) => {
      const p = map[t.simbolo] || {};
      return { id: p.cg || t.simbolo, simbolo: p.id || t.simbolo.replace('USDT', ''), nombre: p.n || t.simbolo, img: '', price: t.last, chg24: t.chgPct, chg7: null, mcap: t.volQuote, spark: [] };
    }).filter((c) => c.price != null && isFinite(c.chg24)).sort((a, b) => (b.mcap || 0) - (a.mcap || 0));
    if (out.length) return out;
    throw new Error('empty');
  } catch (_) {
    // RESPALDO: CoinGecko (capitalización real, pero posible retraso).
    try {
      const ids = PARES.filter((p) => p.cg).map((p) => p.cg).slice(0, 60).join(',');
      const j = await traer(`${COINGECKO}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=60&page=1&price_change_percentage=24h`);
      return j.map((c) => ({
        id: c.id, simbolo: (c.symbol || '').toUpperCase(), nombre: c.name, img: c.image,
        price: c.current_price, chg24: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h,
        chg7: null, mcap: c.market_cap, spark: []
      })).filter((c) => c.price != null);
    } catch (e) { return []; }
  }
}

/* Macro cripto: capitalización total, dominancia BTC/ETH, cambio 24h. */
export async function global() {
  const j = await traer(`${COINGECKO}/global`);
  const d = j && j.data ? j.data : {};
  return {
    totalMcap: d.total_market_cap ? d.total_market_cap.usd : null,
    totalVol: d.total_volume ? d.total_volume.usd : null,
    btcDom: d.market_cap_percentage ? d.market_cap_percentage.btc : null,
    ethDom: d.market_cap_percentage ? d.market_cap_percentage.eth : null,
    mcapChg: d.market_cap_change_percentage_24h_usd ?? null,
    activas: d.active_cryptocurrencies ?? null
  };
}

/* Índice miedo/codicia (0–100). */
export async function fearGreed() {
  try {
    const j = await traer(FNG, 6000);
    const d = j && j.data && j.data[0];
    if (!d) return null;
    return { valor: +d.value, etiqueta: d.value_classification };
  } catch (_) { return null; }
}

/* Logos de las monedas (cg → url). Reutiliza la MISMA caché del sitio
   ('aurex-logos', la que llena ponerLogos de las otras secciones) para no
   volver a pedir; si no está, los trae de CoinGecko y la deja cacheada. */
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
