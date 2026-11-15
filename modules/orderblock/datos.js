/* modules/orderblock/datos.js — Capa de datos AISLADA de "Order Block Liquidity".

   Todo del lado del cliente, sobre fuentes públicas de Binance SPOT. El host
   api.binance.com / stream.binance.com lo reescribe assets/js/feed-shim.js al
   espejo de solo datos (data-api / data-stream .binance.vision), así que NO se
   geobloquea en EE. UU. (ver CLAUDE.md). Sin servidor, sin API key.

   Expone:
     universo(max)          -> top pares USDT por volumen 24h (reales)
     streamMini(onTick)     -> !miniTicker@arr: precio/%/volumen en vivo de TODOS
     niveles(symbol)        -> {cur, poc, sup, res, vp[]} por perfil de volumen 4h
     logosPorSimbolo()      -> { SYM: urlLogo } desde CoinGecko (cache 24h)
     SECTOR, nombreSector   -> mapa de sector por moneda
   Esta capa NO dibuja nada: solo provee datos. El motor (orderblock.js) la consume. */

const BINANCE = 'https://api.binance.com/api/v3';

async function traer(url, ms = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(url + ' -> ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* ---- exclusiones: stablecoins, apalancados, wrapped ---- */
const STABLE = new Set(['USDC','TUSD','FDUSD','DAI','USDP','BUSD','USD1','AEUR','EUR','GBP','USDD','PYUSD','EURI','XUSD']);
const esApalancado = (b) => /(UP|DOWN|BULL|BEAR)$/.test(b) && b.length > 4;
const esWrapped = (b) => b === 'WBTC' || b === 'WETH' || b === 'WBETH' || b === 'BETH';
function baseDe(sym) { return sym.endsWith('USDT') ? sym.slice(0, -4) : null; }

/* ---- universo real: top por volumen 24h en USDT ---- */
export async function universo(max = 200) {
  const arr = await traer(`${BINANCE}/ticker/24hr`);           // TODOS los símbolos
  const out = [];
  for (const t of arr) {
    const s = t.symbol;
    if (!s || !s.endsWith('USDT')) continue;
    const b = baseDe(s);
    if (!b || STABLE.has(b) || esApalancado(b) || esWrapped(b)) continue;
    const vq = +t.quoteVolume;
    if (!(vq > 0)) continue;
    const last = +t.lastPrice, open = +t.openPrice;
    if (!(last > 0)) continue;
    out.push({ symbol: s, sym: b, price: last, open, chgPct: +t.priceChangePercent, volQuote: vq });
  }
  out.sort((a, b) => b.volQuote - a.volQuote);
  const top = out.slice(0, max);
  top.forEach((c) => { c.sector = nombreSector(c.sym); c.major = (c.sym === 'BTC' || c.sym === 'ETH' || c.sym === 'SOL' || c.sym === 'BNB'); });
  return top;
}

/* ---- stream en vivo de TODO el mercado (1 WebSocket) ----
   !miniTicker@arr emite cada ~1s un array con c(close) o(open) h l v(base) q(quote)
   de cada símbolo con actividad. Filtra el consumidor por su universo. */
export function streamMini(onTick) {
  const url = 'wss://stream.binance.com:9443/ws/!miniTicker@arr';
  let ws = null, cerrado = false, tmr = null;
  const abrir = () => {
    if (cerrado) return;
    try { ws = new WebSocket(url); } catch (_) { reintentar(); return; }
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (!Array.isArray(d)) return;
        const m = {};
        for (const x of d) {
          if (!x.s || !x.s.endsWith('USDT')) continue;
          const c = +x.c, o = +x.o;
          m[x.s] = { price: c, chgPct: o > 0 ? (c - o) / o * 100 : 0, volQuote: +x.q };
        }
        onTick(m);
      } catch (_) {}
    };
    ws.onclose = () => { if (!cerrado) reintentar(); };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  };
  const reintentar = () => { clearTimeout(tmr); tmr = setTimeout(abrir, 2500); };
  abrir();
  return { cerrar: () => { cerrado = true; clearTimeout(tmr); try { if (ws) ws.close(); } catch (_) {} ws = null; } };
}

/* ---- velas (klines) para el grafico de detalle ---- */
export async function velas(symbol, interval = '1h', limit = 240) {
  const n = Math.min(1000, limit);
  try {
    const j = await traer(`${BINANCE}/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${n}`);
    return (j || []).map((k) => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
  } catch (_) { return []; }
}

/* ---- niveles REALES por perfil de volumen (velas 4h ~ 30 días) ----
   POC = precio de mayor volumen; soporte = HVN más fuerte por debajo del precio;
   resistencia = HVN más fuerte por encima. vp[] = perfil para dibujar la tarjeta.
   Cacheado por símbolo con TTL; no satura la API. */
const NIV_TTL = 5 * 60 * 1000;
const _niv = new Map();
export async function niveles(symbol, tf = '4h') {
  const hit = _niv.get(symbol);
  if (hit && Date.now() - hit.cuando < NIV_TTL) return hit.datos;
  let k;
  try { k = await traer(`${BINANCE}/klines?symbol=${encodeURIComponent(symbol)}&interval=${tf}&limit=180`); }
  catch (_) { return _niv.has(symbol) ? _niv.get(symbol).datos : null; }
  if (!Array.isArray(k) || k.length < 10) return null;
  let lo = Infinity, hi = -Infinity;
  for (const c of k) { const l = +c[3], h = +c[2]; if (l < lo) lo = l; if (h > hi) hi = h; }
  if (!(hi > lo)) return null;
  const N = 48, bins = new Array(N).fill(0), span = hi - lo;
  for (const c of k) {
    const h = +c[2], l = +c[3], v = +c[5], tp = (h + l + +c[4]) / 3;    // precio típico
    let bi = Math.floor((tp - lo) / span * N); bi = bi < 0 ? 0 : bi >= N ? N - 1 : bi;
    bins[bi] += v;
  }
  const cur = +k[k.length - 1][4];
  const curBin = Math.min(N - 1, Math.max(0, Math.floor((cur - lo) / span * N)));
  const precioDe = (bi) => lo + (bi + 0.5) / N * span;
  // POC global
  let poc = 0, pm = -1; bins.forEach((v, i) => { if (v > pm) { pm = v; poc = i; } });
  // HVN más fuerte por encima (resistencia) y por debajo (soporte) del precio actual
  let resB = -1, resV = -1, supB = -1, supV = -1;
  for (let i = 0; i < N; i++) {
    if (i > curBin && bins[i] > resV) { resV = bins[i]; resB = i; }
    if (i < curBin && bins[i] > supV) { supV = bins[i]; supB = i; }
  }
  if (resB < 0) resB = Math.min(N - 1, curBin + 1);
  if (supB < 0) supB = Math.max(0, curBin - 1);
  // perfil normalizado para la tarjeta (de arriba=caro a abajo=barato)
  const maxv = Math.max.apply(null, bins) || 1;
  const vp = [];
  for (let i = N - 1; i >= 0; i--) vp.push({ price: precioDe(i), v: bins[i] / maxv });
  const datos = { cur, poc: precioDe(poc), sup: precioDe(supB), res: precioDe(resB), lo, hi, vp };
  _niv.set(symbol, { cuando: Date.now(), datos });
  return datos;
}

/* ---- logos por símbolo (CoinGecko, cache 24h compartida de forma aislada) ---- */
const CLAVE_LOGOS = 'obliq-logos-v1';
let _logos = null;
export async function logosPorSimbolo() {
  if (_logos) return _logos;
  try { const g = JSON.parse(localStorage.getItem(CLAVE_LOGOS)); if (g && Date.now() - g.cuando < 86400000) { _logos = g.datos; return _logos; } } catch (_) {}
  try {
    const base = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250';
    const [p1, p2] = await Promise.all([traer(base + '&page=1'), traer(base + '&page=2').catch(() => [])]);
    _logos = {};
    [p1, p2].forEach((arr) => { if (Array.isArray(arr)) arr.forEach((x) => { const s = x.symbol && String(x.symbol).toUpperCase(); if (s && !_logos[s]) _logos[s] = x.image; }); });
    try { localStorage.setItem(CLAVE_LOGOS, JSON.stringify({ cuando: Date.now(), datos: _logos })); } catch (_) {}
  } catch (_) { _logos = _logos || {}; }
  return _logos;
}

/* ---- volumen 24h REAL por exchange (CoinGecko) para el panel de fuentes ---- */
let _ex=null;
export async function exchanges() {
  if (_ex) return _ex;
  try {
    const j = await traer('https://api.coingecko.com/api/v3/exchanges?per_page=100&page=1');
    _ex = (j || []).map((x) => ({ id: x.id, name: x.name || '', volBtc: +x.trade_volume_24h_btc || 0, image: x.image || '' }));
  } catch (_) { _ex = []; }
  return _ex;
}

/* ---- mapa de sector por moneda (editable) ---- */
export const SECTOR = {
  BTC:'L1', ETH:'L1', SOL:'L1', BNB:'L1', ADA:'L1', AVAX:'L1', NEAR:'L1', APT:'L1', SUI:'L1', SEI:'L1',
  TIA:'L1', INJ:'L1', TON:'L1', TRX:'L1', DOT:'L1', ATOM:'L1', HBAR:'L1', KAS:'L1', EGLD:'L1', ALGO:'L1', FTM:'L1', XTZ:'L1', FLOW:'L1', KAVA:'L1', MINA:'L1', ICP:'L1',
  ARB:'L2', OP:'L2', MATIC:'L2', POL:'L2', STRK:'L2', ZK:'L2', MANTA:'L2', METIS:'L2', IMX:'L2', LRC:'L2', SKL:'L2', CELO:'L2',
  UNI:'DeFi', AAVE:'DeFi', MKR:'DeFi', LDO:'DeFi', CRV:'DeFi', SNX:'DeFi', COMP:'DeFi', DYDX:'DeFi', GMX:'DeFi', PENDLE:'DeFi', CAKE:'DeFi', RUNE:'DeFi', ENA:'DeFi', MORPHO:'DeFi', SUSHI:'DeFi', '1INCH':'DeFi', JUP:'DeFi', RAY:'DeFi', ETHFI:'DeFi',
  DOGE:'Memes', SHIB:'Memes', PEPE:'Memes', WIF:'Memes', BONK:'Memes', FLOKI:'Memes', BOME:'Memes', MEW:'Memes', POPCAT:'Memes', TURBO:'Memes', BRETT:'Memes', MOG:'Memes', PNUT:'Memes', NEIRO:'Memes', ACT:'Memes', MEME:'Memes',
  FET:'IA', RNDR:'IA', RENDER:'IA', TAO:'IA', AKT:'IA', GRT:'IA', ARKM:'IA', WLD:'IA', AIOZ:'IA', AI16Z:'IA', VIRTUAL:'IA', NMR:'IA', AGIX:'IA', OCEAN:'IA',
  AXS:'Gaming', SAND:'Gaming', MANA:'Gaming', GALA:'Gaming', APE:'Gaming', ILV:'Gaming', PYR:'Gaming', MAGIC:'Gaming', BEAM:'Gaming', PIXEL:'Gaming', GMT:'Gaming', ENJ:'Gaming',
  ONDO:'RWA', POLYX:'RWA', CFG:'RWA', RSR:'RWA', TRU:'RWA', OM:'RWA', USUAL:'RWA',
  LINK:'Infra', PYTH:'Infra', API3:'Infra', BAND:'Infra', TRB:'Infra', ANKR:'Infra', AR:'Infra', FIL:'Infra', HNT:'Infra', JTO:'Infra', W:'Infra', ZRO:'Infra', EIGEN:'Infra',
  OKB:'Exchange', CRO:'Exchange', KCS:'Exchange', GT:'Exchange', WOO:'Exchange', BGB:'Exchange', MX:'Exchange',
  XMR:'Privacy', ZEC:'Privacy', DASH:'Privacy', SCRT:'Privacy', ROSE:'Privacy',
  LTC:'Otros', XRP:'Otros', BCH:'Otros', ETC:'Otros', XLM:'Otros', VET:'Otros', THETA:'Otros', CHZ:'Otros', ENS:'Otros', STX:'Otros', ORDI:'Otros', '1000SATS':'Otros'
};
export function nombreSector(sym) { return SECTOR[sym] || 'Otros'; }
