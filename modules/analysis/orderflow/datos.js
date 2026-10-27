/* ══════════════════════════════════════════════════════════════
   orderflow/datos.js — Capa de datos EN VIVO (Binance USD-M Futures).

   Todo es informacion publica y real:
     - klines 1H (OHLC + volumen + volumen comprador tomador)  -> REST
     - ticker 24h (cambio, maximo, minimo)                      -> REST
     - aggTrade (cada operacion: precio, tamano, agresor)       -> WebSocket
     - depth20 (libro de ordenes, 20 niveles cada 100ms)        -> WebSocket

   El tape (aggTrade) alimenta la vela en formacion en tiempo real;
   el libro (depth) alimenta el DOM. Sin claves, sin backend.
   ══════════════════════════════════════════════════════════════ */

const REST = 'https://fapi.binance.com';
const WSS  = 'wss://fstream.binance.com';

/* Pares disponibles en el selector (mismos que el resto del sitio). */
export const PARES = [
  { s: 'BTCUSDT', n: 'Bitcoin',  c: 'btc' },
  { s: 'ETHUSDT', n: 'Ethereum', c: 'eth' },
  { s: 'SOLUSDT', n: 'Solana',   c: 'sol' },
  { s: 'BNBUSDT', n: 'BNB',      c: 'bnb' }
];

function nice(bruto) {
  if (!(bruto > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const n = bruto / mag;
  const paso = n >= 5 ? 5 : n >= 2.5 ? 2.5 : n >= 2 ? 2 : 1;
  return +(paso * mag).toPrecision(2);
}
/* Tamano de celda del footprint (bucket de precio) adaptado al precio. */
export function tickDe(precio) { return nice((precio > 0 ? precio : 1) * 0.00035); }

/* Tick adaptado al RANGO visible: ~75 niveles, para una densidad de siluetas
   fina e igual en cualquier temporalidad (como el mockup aprobado). */
export function tickPorRango(rango, precio) {
  const porRango = nice((rango > 0 ? rango : 1) / 75);
  const minTick = tickDe(precio) / 3;               // no bajar de algo sensato para el activo
  return Math.max(porRango, nice(minTick));
}

const num = (x) => +x;

/* Velas reales. Cada vela trae volumen total y volumen comprador (tomador),
   de donde sale el delta real a nivel de vela. */
export async function traerKlines(sym, tf, limite) {
  const u = `${REST}/fapi/v1/klines?symbol=${sym}&interval=${tf}&limit=${limite}`;
  const r = await fetch(u, { cache: 'no-store' });
  if (!r.ok) throw new Error('klines ' + r.status);
  const raw = await r.json();
  return raw.map((k) => {
    const vol = num(k[5]);                 // volumen base total
    const buy = num(k[9]);                 // volumen comprador tomador (base)
    const sell = Math.max(0, vol - buy);
    return {
      t: k[0], o: num(k[1]), h: num(k[2]), l: num(k[3]), c: num(k[4]),
      vol, buy, sell, delta: buy - sell, cerrada: true
    };
  });
}

/* Cambio 24h, maximo y minimo del dia. */
export async function traer24h(sym) {
  try {
    const r = await fetch(`${REST}/fapi/v1/ticker/24hr?symbol=${sym}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    return { chg: num(d.priceChangePercent), last: num(d.lastPrice), high: num(d.highPrice), low: num(d.lowPrice) };
  } catch (_) { return null; }
}

/* Semilla del footprint de la vela en curso: las operaciones recientes reales.
   Una sola llamada acotada (1000 agg-trades, los mas recientes). */
export async function traerTapeReciente(sym, desdeT) {
  try {
    const r = await fetch(`${REST}/fapi/v1/aggTrades?symbol=${sym}&limit=1000`, { cache: 'no-store' });
    if (!r.ok) return [];
    const raw = await r.json();
    return raw
      .filter((t) => t.T >= desdeT)
      .map((t) => ({ p: num(t.p), q: num(t.q), venta: t.m === true, T: t.T }));
    // m === true  -> el comprador es maker  -> el agresor VENDE (hit the bid)
    // m === false -> el vendedor es maker   -> el agresor COMPRA (lift the offer)
  } catch (_) { return []; }
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
      if (d.e === 'aggTrade') {
        onTrade && onTrade({ p: num(d.p), q: num(d.q), venta: d.m === true, T: d.T });
      } else if (d.b && d.a) {                       // depthUpdate parcial (20 niveles)
        const bids = d.b.map((x) => [num(x[0]), num(x[1])]).filter((x) => x[1] > 0);
        const asks = d.a.map((x) => [num(x[0]), num(x[1])]).filter((x) => x[1] > 0);
        onDepth && onDepth(bids, asks);
      }
    };
    ws.onclose = () => { if (vivo) reintento(); };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }

  function reintento() {
    estado('off');
    intento = Math.min(intento + 1, 6);
    const espera = Math.min(1000 * Math.pow(1.6, intento), 12000);
    setTimeout(() => { if (vivo) conectar(); }, espera);
  }

  // Vigilante: si el socket queda mudo mas de 12s, lo reinicia.
  const guardia = setInterval(() => {
    if (vivo && latido && Date.now() - latido > 12000) { try { ws && ws.close(); } catch (_) {} }
  }, 5000);

  conectar();

  return {
    cerrar() { vivo = false; clearInterval(guardia); try { ws && ws.close(); } catch (_) {} }
  };
}
