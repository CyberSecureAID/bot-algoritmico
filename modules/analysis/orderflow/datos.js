/* ══════════════════════════════════════════════════════════════
   orderflow/datos.js — Capa de datos EN VIVO (Binance USD-M Futures).

   Todo es informacion publica y real:
     - klines (OHLC + volumen + volumen comprador tomador)  -> REST (con paginacion)
     - ticker 24h (cambio, maximo, minimo)                   -> REST
     - aggTrade (cada operacion: precio, tamano, agresor)    -> WebSocket
     - depth20 (libro de ordenes, 20 niveles cada 100ms)     -> WebSocket
     - logos de moneda                                       -> CoinGecko (misma cache que el resto del sitio)

   Sin claves, sin backend.
   ══════════════════════════════════════════════════════════════ */

const REST = 'https://fapi.binance.com';
const WSS  = 'wss://fstream.binance.com';

/* Temporalidades, de 1 minuto a 1 semana (id Binance, etiqueta, ms). */
export const TFS = [
  ['1m', '1m', 60000], ['5m', '5m', 300000], ['15m', '15m', 900000], ['30m', '30m', 1800000],
  ['1h', '1H', 3600000], ['4h', '4H', 14400000], ['1d', '1D', 86400000], ['1w', '1W', 604800000]
];

function nice(bruto) {
  if (!(bruto > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const n = bruto / mag;
  const paso = n >= 5 ? 5 : n >= 2.5 ? 2.5 : n >= 2 ? 2 : 1;
  return +(paso * mag).toPrecision(2);
}
export function tickDe(precio) { return nice((precio > 0 ? precio : 1) * 0.00035); }
/* Tick adaptado al RANGO visible: ~75 niveles, densidad fina en cualquier temporalidad. */
export function tickPorRango(rango, precio) {
  return Math.max(nice((rango > 0 ? rango : 1) / 75), nice(tickDe(precio) / 3));
}

const num = (x) => +x;

/* Velas reales. endTime (opcional) permite paginar hacia atras (historia). */
export async function traerKlines(sym, tf, limite, endTime) {
  let u = `${REST}/fapi/v1/klines?symbol=${sym}&interval=${tf}&limit=${limite}`;
  if (endTime) u += `&endTime=${endTime}`;
  const r = await fetch(u, { cache: 'no-store' });
  if (!r.ok) throw new Error('klines ' + r.status);
  const raw = await r.json();
  return raw.map((k) => {
    const vol = num(k[5]), buy = num(k[9]), sell = Math.max(0, vol - buy);
    return { t: k[0], o: num(k[1]), h: num(k[2]), l: num(k[3]), c: num(k[4]), vol, buy, sell, delta: buy - sell, cerrada: true };
  });
}

export async function traer24h(sym) {
  try {
    const r = await fetch(`${REST}/fapi/v1/ticker/24hr?symbol=${sym}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    return { chg: num(d.priceChangePercent), last: num(d.lastPrice), high: num(d.highPrice), low: num(d.lowPrice) };
  } catch (_) { return null; }
}

/* Semilla del footprint de la vela en curso: operaciones recientes reales. */
export async function traerTapeReciente(sym, desdeT) {
  try {
    const r = await fetch(`${REST}/fapi/v1/aggTrades?symbol=${sym}&limit=1000`, { cache: 'no-store' });
    if (!r.ok) return [];
    return (await r.json()).filter((t) => t.T >= desdeT).map((t) => ({ p: num(t.p), q: num(t.q), venta: t.m === true, T: t.T }));
  } catch (_) { return []; }
}

/* Logo de moneda desde CoinGecko, con la MISMA cache que usa el resto del sitio. */
function cgCache() { try { const j = JSON.parse(localStorage.getItem('mv-cg') || '{}'); return j.d || {}; } catch (_) { return {}; } }
export async function logoDe(cg) {
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

/* Flujos en vivo: un unico websocket combinado (tape + libro) con reconexion. */
export function abrirFlujos(sym, { onTrade, onDepth, onEstado }) {
  const low = sym.toLowerCase();
  const streams = `${low}@aggTrade/${low}@depth20@100ms`;
  let ws = null, vivo = true, intento = 0, latido = 0;
  const estado = (s) => { try { onEstado && onEstado(s); } catch (_) {} };

  function conectar() {
    if (!vivo) return;
    try { ws = new WebSocket(`${WSS}/stream?streams=${streams}`); } catch (_) { return reintento(); }
    ws.onopen = () => { intento = 0; estado('live'); };
    ws.onmessage = (ev) => {
      latido = Date.now();
      let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
      const d = m && m.data; if (!d) return;
      if (d.e === 'aggTrade') onTrade && onTrade({ p: num(d.p), q: num(d.q), venta: d.m === true, T: d.T });
      else if (d.b && d.a) {
        const bids = d.b.map((x) => [num(x[0]), num(x[1])]).filter((x) => x[1] > 0);
        const asks = d.a.map((x) => [num(x[0]), num(x[1])]).filter((x) => x[1] > 0);
        onDepth && onDepth(bids, asks);
      }
    };
    ws.onclose = () => { if (vivo) reintento(); };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }
  function reintento() { estado('off'); intento = Math.min(intento + 1, 6); setTimeout(() => { if (vivo) conectar(); }, Math.min(1000 * Math.pow(1.6, intento), 12000)); }
  const guardia = setInterval(() => { if (vivo && latido && Date.now() - latido > 12000) { try { ws && ws.close(); } catch (_) {} } }, 5000);
  conectar();
  return { cerrar() { vivo = false; clearInterval(guardia); try { ws && ws.close(); } catch (_) {} } };
}
