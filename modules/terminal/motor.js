/* terminal/motor.js. Lectura de la cadena para la Terminal (modulo sellado: solo ./config.js y ./ethers.min.js).
   Fuentes del feed, todas leidas por RPC publico desde el navegador, sin servidor propio:
     1) PancakeSwap V2: evento PairCreated de la fabrica, solo pares contra WBNB o USDT.
     2) Launchpad DecFreedom: evento TokenCreado.
   Por cada token nuevo se leen nombre, simbolo, decimales, supply y las reservas del par (liquidez y precio).
   Todo lo que pasa se registra en consola con prefijo [TERM]. */

import * as ethers from './ethers.min.js';
import { RPCS, FACTORY, WBNB, USDT, LAUNCHPAD, COINGECKO_BNB, FEED } from './config.js';

const log = (...a) => { try { console.info('[TERM]', ...a); } catch (_) {} };

/* ── RPC con rotacion: si uno falla, se prueba el siguiente ── */
let _rpcIdx = 0; const _prov = {};
function provRPC(i) { const u = RPCS[((i % RPCS.length) + RPCS.length) % RPCS.length]; if (!_prov[u]) _prov[u] = new ethers.JsonRpcProvider(u, 56, { staticNetwork: true }); return _prov[u]; }
async function conRotacion(fn) {
  let err;
  for (let k = 0; k < RPCS.length; k++) {
    const i = _rpcIdx + k;
    try { return await fn(provRPC(i)); }
    catch (e) { err = e; _rpcIdx = (i + 1) % RPCS.length; }
  }
  throw err;
}

/* ── ABIs minimos ── */
const IFACE_FACTORY = new ethers.Interface(['event PairCreated(address indexed token0,address indexed token1,address pair,uint256)']);
const IFACE_LP = new ethers.Interface(['event TokenCreado(address indexed token,address indexed creador,string nombre,string simbolo,uint256 supply,uint16 sueloBps,uint256 vestTotal,uint64 vestDuracion,bool antibot)']);
const ERC20_ABI = ['function name() view returns (string)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function totalSupply() view returns (uint256)'];
const PAIR_ABI = ['function getReserves() view returns (uint112,uint112,uint32)', 'function token0() view returns (address)'];
const TOPIC_PAIR = IFACE_FACTORY.getEvent('PairCreated').topicHash;
const TOPIC_TOKEN = IFACE_LP.getEvent('TokenCreado').topicHash;
const esQuote = (a) => { const x = String(a).toLowerCase(); return x === WBNB.toLowerCase() || x === USDT.toLowerCase(); };

export const bloqueActual = () => conRotacion((p) => p.getBlockNumber());

/* Decodifica un log de la fabrica o del launchpad a un item del feed. Funcion pura (se prueba sin red). */
export function decodificar(l) {
  const addr = String(l.address).toLowerCase();
  if (addr === FACTORY.toLowerCase() && l.topics && l.topics[0] === TOPIC_PAIR) {
    const ev = IFACE_FACTORY.parseLog({ topics: l.topics, data: l.data }); if (!ev) return null;
    const t0 = String(ev.args.token0), t1 = String(ev.args.token1);
    const q0 = esQuote(t0), q1 = esQuote(t1);
    if (q0 === q1) return null;                       // par sin BNB/USDT, o BNB/USDT entre si: fuera
    const token = q0 ? t1 : t0, quote = q0 ? t0 : t1;
    return { token, quote, moneda: quote.toLowerCase() === USDT.toLowerCase() ? 'USDT' : 'BNB', par: String(ev.args.pair), fuente: 'pancake', bloque: Number(l.blockNumber), tx: l.transactionHash };
  }
  if (addr === LAUNCHPAD.toLowerCase() && l.topics && l.topics[0] === TOPIC_TOKEN) {
    const ev = IFACE_LP.parseLog({ topics: l.topics, data: l.data }); if (!ev) return null;
    return { token: String(ev.args.token), quote: null, moneda: 'BNB', par: null, fuente: 'launchpad', nombre: String(ev.args.nombre), simbolo: String(ev.args.simbolo), supply: ev.args.supply, creador: String(ev.args.creador), bloque: Number(l.blockNumber), tx: l.transactionHash };
  }
  return null;
}

/* Logs de ambas fuentes en un rango de bloques (en paralelo, cada una con rotacion de RPC). */
export async function logsRango(desde, hasta) {
  const [a, b] = await Promise.all([
    conRotacion((p) => p.getLogs({ address: FACTORY, topics: [TOPIC_PAIR], fromBlock: desde, toBlock: hasta })).catch((e) => { log('getLogs pancake fallo', desde, hasta, e && e.shortMessage || e); return []; }),
    conRotacion((p) => p.getLogs({ address: LAUNCHPAD, topics: [TOPIC_TOKEN], fromBlock: desde, toBlock: hasta })).catch((e) => { log('getLogs launchpad fallo', desde, hasta, e && e.shortMessage || e); return []; })
  ]);
  return a.concat(b).map(decodificar).filter(Boolean);
}

/* Metadatos del token (nombre, simbolo, decimales, supply). Tolerante: lo que falle queda vacio. */
export async function metaToken(token) {
  const c = (p) => new ethers.Contract(token, ERC20_ABI, p);
  const [nombre, simbolo, decimales, supply] = await Promise.all([
    conRotacion((p) => c(p).name()).catch(() => ''),
    conRotacion((p) => c(p).symbol()).catch(() => ''),
    conRotacion((p) => c(p).decimals()).then(Number).catch(() => 18),
    conRotacion((p) => c(p).totalSupply()).catch(() => 0n)
  ]);
  return { nombre: String(nombre || ''), simbolo: String(simbolo || ''), decimales: decimales || 18, supply };
}

/* Reservas del par: liquidez en la moneda del par y precio por token. */
export async function reservasPar(par, token, decimales) {
  const c = (p) => new ethers.Contract(par, PAIR_ABI, p);
  const [r, t0] = await Promise.all([conRotacion((p) => c(p).getReserves()), conRotacion((p) => c(p).token0())]);
  const tokenEs0 = String(t0).toLowerCase() === String(token).toLowerCase();
  const rTok = tokenEs0 ? r[0] : r[1], rQuote = tokenEs0 ? r[1] : r[0];
  const liq = Number(ethers.formatEther(rQuote));
  const tok = Number(ethers.formatUnits(rTok, decimales || 18));
  return { liquidez: liq, precio: tok > 0 ? liq / tok : 0 };
}

/* Hora de un bloque, con cache (muchos tokens nacen en el mismo bloque). */
const _tiempos = new Map();
export async function tiempoBloque(n) {
  if (_tiempos.has(n)) return _tiempos.get(n);
  const t = await conRotacion(async (p) => Number((await p.getBlock(n)).timestamp) * 1000).catch(() => 0);
  if (t) _tiempos.set(n, t);
  return t;
}

/* Precio BNB/USD con cache de 60 s y respaldo en localStorage (mismo patron que el launchpad). */
let _bnbUsd = { v: 0, t: 0 };
export async function precioBNBUSDT() {
  const ahora = Date.now();
  if (_bnbUsd.v > 0 && ahora - _bnbUsd.t < 60000) return _bnbUsd.v;
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(COINGECKO_BNB, { signal: ctrl.signal }); clearTimeout(to);
    const j = await r.json(); const v = j && j.binancecoin && Number(j.binancecoin.usd);
    if (v > 0) { _bnbUsd = { v, t: ahora }; try { localStorage.setItem('df-bnbusd', JSON.stringify(_bnbUsd)); } catch (_) {} return v; }
  } catch (_) {}
  if (_bnbUsd.v > 0) return _bnbUsd.v;
  try { const s = JSON.parse(localStorage.getItem('df-bnbusd') || 'null'); if (s && s.v > 0) { _bnbUsd = s; return s.v; } } catch (_) {}
  return 0;
}

/* ── El feed: carga inicial hacia atras por tramos y luego sondeo de bloques nuevos ──
   alNuevo(item) se llama por cada token nuevo ya enriquecido; alEstado({bloque, vivo, error}) informa.
   Devuelve una funcion para detenerlo. */
export function arrancarFeed({ alNuevo, alEstado }) {
  let parado = false, ultimo = 0, timer = null;
  const vistos = new Set();
  const estado = (x) => { try { alEstado && alEstado(x); } catch (_) {} };

  async function enriquecer(it) {
    const meta = it.fuente === 'launchpad' && it.nombre ? { nombre: it.nombre, simbolo: it.simbolo, decimales: 18, supply: it.supply } : await metaToken(it.token);
    Object.assign(it, meta);
    it.tiempo = await tiempoBloque(it.bloque);
    if (it.par) { try { Object.assign(it, await reservasPar(it.par, it.token, it.decimales)); } catch (e) { it.liquidez = 0; it.precio = 0; } }
    else { it.liquidez = 0; it.precio = 0; }
    return it;
  }
  async function procesar(items) {
    // mas nuevo primero; sin repetir token
    items.sort((a, b) => b.bloque - a.bloque);
    for (const it of items) {
      if (parado) return;
      const k = it.token.toLowerCase(); if (vistos.has(k)) continue; vistos.add(k);
      try { alNuevo(await enriquecer(it)); } catch (e) { log('item fallo', it.token, e && e.message); }
    }
  }
  async function inicial() {
    const hasta = await bloqueActual(); ultimo = hasta;
    estado({ bloque: hasta, vivo: true });
    const desde = Math.max(0, hasta - FEED.bloquesInicio);
    // tramos del mas reciente al mas antiguo, para que lo nuevo aparezca primero
    for (let fin = hasta; fin > desde && !parado; fin -= FEED.bloquesPorConsulta) {
      const ini = Math.max(desde, fin - FEED.bloquesPorConsulta + 1);
      const items = await logsRango(ini, fin);
      log('tramo', ini, fin, items.length, 'tokens');
      await procesar(items);
    }
  }
  async function sondear() {
    if (parado) return;
    try {
      const b = await bloqueActual();
      if (b > ultimo) {
        const items = await logsRango(ultimo + 1, b);
        ultimo = b; estado({ bloque: b, vivo: true });
        if (items.length) { log('nuevos', items.length, 'en bloque', b); await procesar(items); }
      }
    } catch (e) { estado({ bloque: ultimo, vivo: false, error: String(e && e.shortMessage || e && e.message || e) }); }
    if (!parado) timer = setTimeout(sondear, FEED.sondeoMs);
  }
  inicial().catch((e) => { log('inicial fallo', e); estado({ bloque: 0, vivo: false, error: String(e && e.message || e) }); }).finally(() => { if (!parado) timer = setTimeout(sondear, FEED.sondeoMs); });
  return () => { parado = true; if (timer) clearTimeout(timer); };
}
