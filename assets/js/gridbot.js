/**
 * GRIDBOT — capa de contrato + matemática de rejilla (para la web)
 * ================================================================
 *
 * Habla con el contrato GridBot desplegado en BSC. Usa `ethers` (desde CDN, sin
 * build) SOLO en esta parte, porque `crearRejilla` lleva una estructura con
 * arrays anidados y codificarla a mano es donde se cuelan errores.
 *
 * NO custodia nada: el usuario firma cada acción con su wallet. El capital vive
 * en su wallet; el bot solo tiene el permiso (allowance) para operar el par.
 *
 * Lo que vive en la wallet del usuario: su capital de trading.
 * Lo único que deja en el contrato: un tanque de BNB para gas (retirable).
 */

// La librería vive en ESTE repositorio. Carga directa: sin CDN, sin esperas,
// sin nada externo que pueda quedarse colgado y dejar la app en 'Cargando…'.
import * as ethers from './vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from './wallet.js?v=125';

// ⚠️ IMPORTANTE: cambia esta dirección por la de tu PROXY de GridBotV2 recién desplegado.
// (La de abajo es el contrato V1 viejo; con el V2 ya no sirve.)
export const GRIDBOT = '0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B';
export const WBNB    = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const RPCS = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
  'https://bsc-dataseed2.binance.org'
];

const ABI = [
  // --- bots (V11) ---
  'function crearRejilla((address base,address quote,uint256 ordenQuote,uint256 ordenBase,(uint128 minOutCompra,uint128 minOutVenta,uint8 estado)[] niveles,uint16 slippageBps,uint32 cooldownSeg,uint128 tpUnitOut,uint128 slUnitOut,uint24 feeTier,uint8 modo,uint16 objetivoBps,uint16 factorBps,uint256 compraInicialQuote,uint16 margenBps,uint256 botId,uint256 intervalo,uint32 comprasMax)) payable',
  'function ejecutar(bytes32,uint256)',
  'function cerrarAhora(bytes32)',
  'function claveBot(address,address,address,uint256) pure returns (bytes32)',
  'function misRejillas(address) view returns (bytes32[])',
  'function duenoDe(bytes32) view returns (address)',
  // --- cobro de bots (V11) ---
  'function pagarMes() payable',
  'function costoBotBNB() view returns (uint256)',
  'function costoBotUSD() view returns (uint256)',
  'function alDia(address) view returns (bool)',
  'function botsAbiertos(address) view returns (uint32)',
  'function pagadoHasta(address) view returns (uint40)',
  'function maxBots() view returns (uint256)',
  // --- gas del usuario ---
  'function gasSaldo(address) view returns (uint256)',
  'function gasMinOp() view returns (uint256)',
  'function depositarGas() payable',
  'function retirarGas(uint256)',
  // --- multi-dex (salud) ---
  'function numDexes() view returns (uint256)',
  'function dexes(uint256) view returns (address router,address quoter,string nombre,bool activo,uint32 fallos,uint40 ultimoUso)',
  'event Ejecutado(address indexed usuario, bytes32 indexed clave, uint256 indice, bool compra, uint256 entrada, uint256 salida)',
  'event RejillaCreada(address indexed u, address indexed base, address indexed quote, bytes32 clave, bool nueva, bool cobrada)'
]

const ERC20 = [
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

/* PancakeSwap V2 Factory + par, para leer el precio spot de las reservas. */
const FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const ROUTER_V2 = '0x10ED43C718714eb63d5aA57B78B54704E256024E'; // solo para precios/rutas de referencia; los swaps van por V3
const ROUTER_V2_ABI = ['function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])'];
const QUOTER_V3 = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';
const QUOTER_ABI = ['function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)'];
const FEE_TIERS = [500, 2500, 100, 10000];
// Prueba los pools V3 y devuelve el fee tier con mejor cotización (más profundo). 0 = no hay pool.
export async function mejorFeeTier(tokenIn, tokenOut, amountIn) {
  const q = new ethers.Contract(QUOTER_V3, QUOTER_ABI, lector());
  let best = 0, bestOut = 0n;
  for (const fee of FEE_TIERS) {
    try {
      const r = await q.quoteExactInputSingle.staticCall({ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0 });
      if (r[0] > bestOut) { bestOut = r[0]; best = fee; }
    } catch (_) {}
  }
  return best;
}
const FAC_ABI = ['function getPair(address,address) view returns (address)'];
const PAIR_ABI = ['function getReserves() view returns (uint112,uint112,uint32)', 'function token0() view returns (address)'];

/* ================================================================== */
/* Proveedores y contratos                                             */
/* ================================================================== */

let _rpc = null;
function lector() {
  if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true });
  return _rpc;
}

/** Precio de gas actual de la red (wei). Para estimar el coste real por operación. */
export async function precioGasWei() {
  try { const fd = await lector().getFeeData(); return fd.gasPrice || 0n; } catch (_) { return 0n; }
}

/** Proveedor inyectado (MetaMask u otro). */
function inyectado() {
  // Usa el proveedor con el que el usuario conectó (WalletConnect o inyectado),
  // no window.ethereum directo (que puede ser otra wallet o estar vacío).
  try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); if (p) return p; } catch (_) {}
  if (typeof window !== 'undefined' && window.ethereum) return window.ethereum;
  throw new Error('No hay wallet');
}

async function firmante() {
  const bp = new ethers.BrowserProvider(inyectado());
  return bp.getSigner();
}

function cLee()  { return new ethers.Contract(GRIDBOT, ABI, lector()); }
/* Lecturas resistentes: si un RPC falla o limita, rota al siguiente. */
let _rpcIdx = 0;
const _provCache = {};
function provRPC(i) { const u = RPCS[i % RPCS.length]; if (!_provCache[u]) _provCache[u] = new ethers.JsonRpcProvider(u, 56, { staticNetwork: true }); return _provCache[u]; }
async function leeGB(fnFirma, args) {
  let err;
  for (let k = 0; k < RPCS.length; k++) {
    try {
      const c = new ethers.Contract(GRIDBOT, ABI, provRPC(_rpcIdx));
      return await c[fnFirma](...args);
    } catch (e) { err = e; _rpcIdx = (_rpcIdx + 1) % RPCS.length; await new Promise((r) => setTimeout(r, 220)); }
  }
  throw err;
}
async function cEscribe() { return new ethers.Contract(GRIDBOT, ABI, await firmante()); }
/** Espera el recibo con nuestro RPC fiable; el de MetaMask a veces no lo devuelve. */
async function esperar(tx) {
  try { if (typeof window !== 'undefined' && window._onTxProcesando) window._onTxProcesando(); } catch (_) {}
  const hash = tx.hash;
  for (let intento = 0; intento < 6; intento++) {
    const rpc = RPCS[intento % RPCS.length];
    try {
      const prov = new ethers.JsonRpcProvider(rpc, 56, { staticNetwork: true });
      const rec = await prov.waitForTransaction(hash, 1, 20000);
      if (rec) { if (rec.status === 0) throw new Error('La transacción se envió pero no se completó en la red (revirtió). Revisa el saldo y el gas, e inténtalo de nuevo.'); return rec; }
    } catch (e) { if (e && /revirt/i.test(e.message || '')) throw e; }
    await new Promise((r) => setTimeout(r, 1500));   // pausa entre reintentos (nunca bucle apretado)
  }
  // último recurso: el proveedor de la propia wallet
  try { const rec = await tx.wait(); if (rec && rec.status === 0) throw new Error('La transacción no se completó en la red.'); return rec || null; }
  catch (e) { if (e && /revirt|no se completó/i.test(e.message || '')) throw e; return null; }
}

/** Dirección de un token; si es BNB nativo (address null), usa WBNB. */
export function dirDe(moneda) {
  return moneda.address ?? WBNB;
}

export function claveBot(usuario, base, quote, botId) {
  if (!botId || botId === 0n || botId === 0) return claveDe(usuario, base, quote);
  return ethers.solidityPackedKeccak256(['address', 'address', 'address', 'uint256'], [usuario, base, quote, BigInt(botId)]);
}
export function claveDe(usuario, base, quote) {
  return ethers.solidityPackedKeccak256(['address', 'address', 'address'], [usuario, base, quote]);
}

/* ================================================================== */
/* Lecturas                                                            */
/* ================================================================== */

export async function resumen(usuario, base, quote) { return leeGB('resumen(address,address,address)', [usuario, base, quote]); }
export async function nivelesDe(clave)              { return leeGB('nivelesDe', [clave]); }
export async function pathsDe(clave)                { return leeGB('pathsDe', [clave]); }
export async function misRejillas(usuario)          { return leeGB('misRejillas', [usuario]); }
export async function gasSaldo(usuario)             { return cLee().gasSaldo(usuario); }
export async function gasMinOp()                    { try { return await cLee().gasMinOp(); } catch { return 0n; } }
export async function cotizar(amountIn, path) {
  const r = new ethers.Contract(ROUTER_V2, ROUTER_V2_ABI, lector());
  const o = await r.getAmountsOut(amountIn, path);
  return o[o.length - 1];
}

/** Historial real de operaciones del bot (evento Ejecutado). Devuelve
 *  [{compra, precio, bloque, i}] en orden. Ventana de bloques acotada para RPCs. */
/** Convierte números de bloque en fechas.
 *  Pide UN bloque de referencia y calcula el resto por diferencia. BSC produce
 *  un bloque cada ~0,75 s desde la actualización Maxwell, pero lo medimos en
 *  vivo con dos bloques reales para no depender de suposiciones. */
let _refBloque = null;
export async function tiempoDeBloque(bloques) {
  if (!Array.isArray(bloques) || bloques.length === 0) return {};
  try {
    if (!_refBloque) {
      const p = lector();
      const ahora = await p.getBlockNumber();
      const [b1, b2] = await Promise.all([p.getBlock(ahora), p.getBlock(Math.max(1, ahora - 20000))]);
      if (!b1 || !b2) return {};
      const seg = (Number(b1.timestamp) - Number(b2.timestamp)) / (b1.number - b2.number);
      _refBloque = { n: b1.number, t: Number(b1.timestamp), seg: seg > 0 ? seg : 0.75 };
    }
    const r = {};
    for (const b of bloques) {
      const d = Number(b) - _refBloque.n;
      r[b] = Math.round(_refBloque.t + d * _refBloque.seg);
    }
    return r;
  } catch (_) { return {}; }
}

export async function operacionesDe(usuario, base, quote, decB, decQ, desdeBloques = 45000) {
  const c = cLee();
  let k; try { k = await c.clave(usuario, base, quote); } catch { k = claveDe(usuario, base, quote); }
  let latest = 0; try { latest = await lector().getBlockNumber(); } catch {}
  const from = latest > desdeBloques ? latest - desdeBloques : 0;
  // Los servidores públicos de BSC no siempre admiten leer eventos. Probamos
  // varios y con rangos cada vez más cortos; si ninguno responde, devolvemos
  // vacío y la web lo dice claramente en vez de fingir que no hay operaciones.
  let logs = [];
  let conseguido = false;
  const rangos = [desdeBloques, 10000, 3000];
  for (let i = 0; i < RPCS.length && !conseguido; i++) {
    const cc = new ethers.Contract(GRIDBOT, ABI, provRPC(i));
    for (const r of rangos) {
      const desde = latest > r ? latest - r : 0;
      try {
        logs = await cc.queryFilter(cc.filters.Ejecutado(usuario, k), desde, latest || 'latest');
        conseguido = true;
        break;
      } catch (_) {}
    }
  }
  if (!conseguido) return { error: 'sin-historial', ops: [] };
  const ops = logs.map((l) => {
    const a = l.args, compra = a.compra;
    const inH = Number(ethers.formatUnits(a.entrada, compra ? decQ : decB));
    const outH = Number(ethers.formatUnits(a.salida, compra ? decB : decQ));
    const precio = compra ? (outH > 0 ? inH / outH : NaN) : (inH > 0 ? outH / inH : NaN);
    return { compra, precio, bloque: l.blockNumber, i: Number(a.indice) };
  }).filter((x) => isFinite(x.precio) && x.precio > 0);

  // Le ponemos fecha a cada una para poder pintarla en su vela exacta.
  try {
    const fechas = await tiempoDeBloque([...new Set(ops.map((o) => o.bloque))]);
    ops.forEach((o) => { o.tiempo = fechas[o.bloque] || 0; });
  } catch (_) {}
  return { error: null, ops };
}

export async function allowance(tokenAddr, duenio) {
  const t = new ethers.Contract(tokenAddr, ERC20, lector());
  return t.allowance(duenio, GRIDBOT);
}
export async function balanceToken(tokenAddr, duenio) {
  const t = new ethers.Contract(tokenAddr, ERC20, lector());
  return t.balanceOf(duenio);
}
/** ¿Esta dirección es el WBNB (o sea, la moneda es BNB)? */
export function esBNB(tokenAddr) { return (tokenAddr || '').toLowerCase() === WBNB.toLowerCase(); }
/** Saldo NATIVO de BNB (no WBNB). */
export async function saldoNativoBNB(duenio) { return lector().getBalance(duenio); }
/** Saldo "real" para mostrar: nativo si es BNB, ERC20 si no. */
export async function saldoParaMostrar(tokenAddr, duenio) {
  return esBNB(tokenAddr) ? saldoNativoBNB(duenio) : balanceToken(tokenAddr, duenio);
}
/** Para Cash Out: si es BNB, cuenta NATIVO + WBNB juntos (todo lo que puedes vender). */
export async function saldoCashDisponible(tokenAddr, duenio) {
  if (esBNB(tokenAddr)) {
    const [nat, wr] = await Promise.all([saldoNativoBNB(duenio), balanceToken(WBNB, duenio)]);
    return nat + wr;
  }
  return balanceToken(tokenAddr, duenio);
}
/** Envuelve BNB nativo -> WBNB (para que el bot pueda venderlo). */
export async function envolverBNB(montoWei) {
  const abi = ['function deposit() payable'];
  const c = new ethers.Contract(WBNB, abi, await firmante());
  const tx = await c.deposit({ value: montoWei });
  return esperar(tx);
}
/** Desenvuelve WBNB -> BNB nativo (al suspender, devuelve el BNB tal cual). */
export async function desenvolverBNB(montoWei) {
  const abi = ['function withdraw(uint256) external'];
  const c = new ethers.Contract(WBNB, abi, await firmante());
  const tx = await c.withdraw(montoWei);
  return esperar(tx);
}

/* ================================================================== */
/* Rutas de swap (directa o vía WBNB)                                  */
/* ================================================================== */

async function unaRuta(entra, sale, montoPrueba) {
  const directa = [entra, sale];
  try { if ((await cotizar(montoPrueba, directa)) > 0n) return directa; } catch (_) {}
  const w = WBNB.toLowerCase();
  if (entra.toLowerCase() === w || sale.toLowerCase() === w) return directa;
  return [entra, WBNB, sale];
}

/** Devuelve {compra: [quote..base], venta: [base..quote]} usando sondas de 1 unidad. */
export async function resolverRutas(base, quote, decBase, decQuote) {
  const compra = await unaRuta(quote, base, ethers.parseUnits('1', decQuote));
  const venta  = await unaRuta(base, quote, ethers.parseUnits('1', decBase));
  return { compra, venta };
}

/** Precio spot directo desde las reservas de un pool (sin impacto). */
async function precioDirecto(inTok, outTok, decIn, decOut) {
  const fac = new ethers.Contract(FACTORY, FAC_ABI, lector());
  const pair = await fac.getPair(inTok, outTok);
  if (!pair || pair === ethers.ZeroAddress) return null;
  const pc = new ethers.Contract(pair, PAIR_ABI, lector());
  const [r0, r1] = await pc.getReserves();
  const t0 = (await pc.token0()).toLowerCase();
  const [rIn, rOut] = t0 === inTok.toLowerCase() ? [r0, r1] : [r1, r0];
  if (rIn === 0n) return null;
  const inH = Number(ethers.formatUnits(rIn, decIn));
  const outH = Number(ethers.formatUnits(rOut, decOut));
  return inH > 0 ? outH / inH : null;
}

/** Precio spot del par (quote por 1 base): directo o vía WBNB. Sin impacto. */
export async function precioSpot(base, quote, decBase, decQuote) {
  const d = await precioDirecto(base, quote, decBase, decQuote);
  if (d && isFinite(d) && d > 0) return d;
  const bw = await precioDirecto(base, WBNB, decBase, 18);
  const wq = await precioDirecto(WBNB, quote, 18, decQuote);
  return (bw && wq) ? bw * wq : null;
}

/** Precio actual del par (spot por reservas; respaldo por cotización). */
export async function precioPar(base, quote, decBase, decQuote, rutas) {
  const r = rutas || await resolverRutas(base, quote, decBase, decQuote);
  let precio = null;
  try { precio = await precioSpot(base, quote, decBase, decQuote); } catch (_) {}
  if (!(precio > 0)) {
    try { const q = await cotizar(ethers.parseUnits('1', decBase), r.venta); precio = Number(ethers.formatUnits(q, decQuote)); } catch (_) {}
  }
  return { precio, rutas: r };
}

/* ================================================================== */
/* Matemática de la rejilla                                            */
/* ================================================================== */

/** Precio de cada nivel según el modo (aritmético o geométrico). */
function preciosNiveles(pMin, pMax, n, modo) {
  const out = [];
  if (n === 1) return [pMin];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    out.push(modo === 'geo' ? pMin * Math.pow(pMax / pMin, t) : pMin + (pMax - pMin) * t);
  }
  return out;
}

/** Escala un BigInt por un ratio decimal, con 9 cifras de precisión. */
function porRatio(valor, ratio) {
  const r = BigInt(Math.max(0, Math.round(ratio * 1e9)));
  return (valor * r) / 1_000_000_000n;
}

/** Convierte un número humano a unidades del token (recorta decimales). */
function aBI(numeroHumano, dec) {
  const s = Number(numeroHumano);
  if (!isFinite(s) || s <= 0) return 0n;
  return ethers.parseUnits(s.toFixed(Math.min(dec, 18)), dec);
}

/**
 * Construye el ConfigIn listo para crearRejilla.
 * Acepta `totalQuoteHumano` (inversión total; el bot la reparte) o bien
 * `ordenQuoteHumano`/`ordenBaseHumano` explícitos.
 * @param p.base,p.quote,p.decBase,p.decQuote,p.pMin,p.pMax,p.niveles,p.modo
 * @param p.slippageBps,p.cooldownSeg,p.tpPrecio,p.slPrecio,p.rutas
 */
const FEE_VUELTA = 0.0015;  // comisión aproximada por vuelta en V3 (0.05%x2 + colchón)
const GAS_OP_USD = 0.012;   // ~coste de gas por operación en BSC (para no crear cuadrículas que el gas se coma)
export async function construirConfig(p) {
  const rutas = p.rutas || await resolverRutas(p.base, p.quote, p.decBase, p.decQuote);
  const { precio: Pnow } = await precioPar(p.base, p.quote, p.decBase, p.decQuote, rutas);
  if (!(Pnow > 0)) throw new Error('No se pudo leer el precio del par');

  // Blindaje anti-contradicción: si el usuario fijó "ganancia por cuadrícula",
  // el número de cuadrículas se DERIVA del rango para que la separación sea ese %.
  // Así no puede pedir 10% por cuadrícula Y 500 cuadrículas a la vez.
  let nivObjetivo = p.niveles;
  const margenPct = p.margenPct || 0;
  if (margenPct > 0 && p.margenModo !== 'rango') {
    const sp = margenPct + FEE_VUELTA;
    nivObjetivo = Math.max(2, Math.min(100, Math.round(Math.log(Number(p.pMax) / Number(p.pMin)) / Math.log(1 + sp))));
    // Blindaje gas: cada cuadrícula debe rendir más que el gas de su vuelta.
    // maxGrids = capital * margen / (2 * gasPorOperación)
    const maxPorGas = Math.max(2, Math.floor(Number(p.totalQuoteHumano) * margenPct / (2 * GAS_OP_USD)));
    if (nivObjetivo > maxPorGas) nivObjetivo = maxPorGas;
  }
  // SIEMPRE geométrico: todas las cuadrículas separadas al MISMO % (paso constante).
  const precios = preciosNiveles(Number(p.pMin), Number(p.pMax), nivObjetivo, 'geo');
  const nLevels = precios.length;
  const pasoPct = Math.pow(Number(p.pMax) / Number(p.pMin), 1 / (nLevels - 1)) - 1;

  // Capital por cuadrícula: igual en todas. El REPARTO entre comprar-ahora (ventas de
  // arriba) y reservar (compras de abajo) es PROPORCIONAL a cuántas cuadrículas caen a
  // cada lado de la entrada (lo decide dónde está Pnow), no 50/50.
  let ordenQuoteHumano = p.ordenQuoteHumano;
  let ordenBaseHumano  = p.ordenBaseHumano;
  if (p.totalQuoteHumano) {
    ordenQuoteHumano = Number(p.totalQuoteHumano) / nLevels;
    ordenBaseHumano  = (ordenQuoteHumano / Pnow) * 0.985; // pequeño colchón: el inventario cubre todas las ventas
  }
  if (!(ordenQuoteHumano > 0 && ordenBaseHumano > 0)) throw new Error('Falta el tamaño de orden');

  // Detecta el mejor pool V3 de este par (cada moneda vive en un fee tier distinto).
  const feeTier = await mejorFeeTier(p.quote, p.base, aBI(ordenQuoteHumano, p.decQuote));
  if (!feeTier) throw new Error('Esta moneda no tiene pool en PancakeSwap V3. Prueba con otra.');

  const niveles = precios.map((Pi) => ({
    minOutCompra: aBI(ordenQuoteHumano / Pi, p.decBase),   // dispara COMPRA cuando el precio baja a Pi
    minOutVenta:  aBI(ordenBaseHumano * Pi, p.decQuote),   // dispara VENTA cuando el precio sube a Pi
    estado: Pi < Pnow ? 1 : 2   // ABAJO de la entrada = compra limit · ARRIBA = venta (el contrato compra su inventario al crear)
  }));

  const nSell = precios.filter((Pi) => Pi >= Pnow).length;
  const nBuy  = nLevels - nSell;

  const tpUnitOut = p.tpPrecio > 0 ? aBI(ordenBaseHumano * Number(p.tpPrecio), p.decQuote) : 0n;
  const slUnitOut = p.slPrecio > 0 ? aBI(ordenBaseHumano * Number(p.slPrecio), p.decQuote) : 0n;

  return {
    base: p.base, quote: p.quote,
    ordenQuote: aBI(ordenQuoteHumano, p.decQuote),
    ordenBase:  aBI(ordenBaseHumano, p.decBase),
    niveles,
    slippageBps: p.slippageBps || 0,
    cooldownSeg: p.cooldownSeg || 0,
    tpUnitOut, slUnitOut,
    feeTier,   // pool V3 detectado automáticamente para este par
    modo: 0, objetivoBps: 0, factorBps: 0, compraInicialQuote: 0n,
    margenBps: Math.round((p.margenPct || 0) * 10000),
    _Pnow: Pnow, _pasoPct: pasoPct, _nSell: nSell, _nBuy: nBuy,
    _ordenQuoteHumano: ordenQuoteHumano, _ordenBaseHumano: ordenBaseHumano, _precios: precios
  };
}

/** Config del BOT ACUMULADOR: compra progresiva hacia abajo + venta total en ganancia. */
export async function construirConfigAcumulador(p) {
  const rutas = p.rutas || await resolverRutas(p.base, p.quote, p.decBase, p.decQuote);
  const { precio: Pnow } = await precioPar(p.base, p.quote, p.decBase, p.decQuote, rutas);
  if (!(Pnow > 0)) throw new Error('No se pudo leer el precio del par');

  const total = Number(p.totalQuoteHumano);
  const n = p.niveles;                 // niveles de compra (todos debajo de la entrada)
  const iniPct = p.iniPct;             // 0..1 comprado a mercado al abrir
  const factor = p.factorPct;          // 0.2 = +20% de volumen por nivel al bajar
  if (!(total > 0 && n >= 1)) throw new Error('Revisa capital y número de compras');

  const pTop = Pnow * 0.999;           // primer nivel apenas debajo de la entrada
  const pMin = Number(p.pMin);
  if (!(pMin > 0 && pMin < pTop)) throw new Error('El mínimo debe ser menor que el precio actual');

  const precios = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);        // i=0 abajo (pMin) · i=n-1 arriba (pTop)
    precios.push(pMin * Math.pow(pTop / pMin, t));
  }

  const compraInicial = total * iniPct;
  const restante = total * (1 - iniPct);
  let sumPesos = 0;
  for (let d = 0; d < n; d++) sumPesos += (1 + factor * d);   // depth 0 arriba
  const ordenQuote = restante / sumPesos;                     // unidad base (nivel de arriba)

  const niveles = precios.map((Pi, i) => {
    const depth = n - 1 - i;                                  // arriba depth 0 · abajo depth n-1
    const montoC = ordenQuote * (1 + factor * depth);
    return { minOutCompra: aBI(montoC / Pi, p.decBase), minOutVenta: 0n, estado: 1 };
  });

  const feeTier = await mejorFeeTier(p.quote, p.base, aBI(ordenQuote, p.decQuote));
  if (!feeTier) throw new Error('Esta moneda no tiene pool en PancakeSwap V3. Prueba con otra.');

  let ordenBase = aBI(ordenQuote / Pnow, p.decBase); if (ordenBase <= 0n) ordenBase = 1n;

  return {
    base: p.base, quote: p.quote,
    ordenQuote: aBI(ordenQuote, p.decQuote), ordenBase,
    niveles,
    slippageBps: p.slippageBps || 0, cooldownSeg: p.cooldownSeg || 0,
    tpUnitOut: 0n, slUnitOut: 0n,
    feeTier,
    modo: 1,
    objetivoBps: Math.round(p.objetivoPct * 10000),
    factorBps: Math.round(factor * 10000),
    compraInicialQuote: aBI(compraInicial, p.decQuote), margenBps: 0,
    _Pnow: Pnow, _ordenQuote: ordenQuote, _compraInicial: compraInicial, _precios: precios,
    _promedioEstimado: (compraInicial + restante) / ((compraInicial / Pnow) + niveles.reduce((a, nv, i) => a + (ordenQuote * (1 + factor * (n - 1 - i))) / precios[i], 0))
  };
}

/* ================================================================== */
/* Escrituras (el usuario firma)                                       */
/* ================================================================== */

/** Aprueba al GridBot para gastar un token, por un MONTO LIMITADO (no ilimitado).
 *  `montoBI` es la cantidad en unidades del token (BigInt). Un permiso finito evita
 *  que la wallet muestre el aviso rojo de "permiso ilimitado". */
export async function aprobarToken(tokenAddr, montoBI) {
  const s = await firmante();
  const t = new ethers.Contract(tokenAddr, ERC20, s);
  /* [AUDITORÍA] Si por un fallo alguien llamara sin cantidad, esto pedía
     permiso ILIMITADO sobre el token. Hoy todas las llamadas pasan su
     cantidad, así que nunca ocurre, pero un permiso ilimitado es de las
     cosas que más dinero han costado en cripto: mejor que sea imposible
     por diseño y no por costumbre. */
  if (typeof montoBI !== 'bigint' || montoBI <= 0n) {
    throw new Error('Permiso sin cantidad: no se aprueban permisos ilimitados.');
  }
  const tx = await t.approve(GRIDBOT, montoBI, { gasLimit: 120000n });
  return esperar(tx);
}

/** Revoca el permiso: pone el allowance del token a 0 para el GridBot. */
export async function revocarToken(tokenAddr) {
  const s = await firmante();
  const t = new ethers.Contract(tokenAddr, ERC20, s);
  const tx = await t.approve(GRIDBOT, 0n, { gasLimit: 120000n });
  return esperar(tx);
}

export async function estaActivo(cuenta) {
  try { return await cLee().alDia(cuenta); } catch (_) { return true; }
}
export async function precioSub() {
  try { return await cLee().costoBotBNB(); } catch (_) { return 0n; }
}
export async function suscribir() {
  const bot = await cEscribe();
  const precio = await bot.costoBotBNB();
  const tx = await bot.pagarMes({ value: precio, gasLimit: 220000n });
  return esperar(tx);
}

/* ─────────────────────────────────────────────────────────────────
   COMPRA LÍMITE (basada en PRECIO, no en tiempo).
   Espejo de construirConfigCashOut, pero para comprar: un solo nivel
   de compra (estado 1) al precio objetivo. El keeper lo dispara SOLO
   cuando el precio llega a ese nivel (nada de comprar a mercado).
   ───────────────────────────────────────────────────────────────── */
export async function construirConfigCompraLimit(p) {
  const rutas = p.rutas || await resolverRutas(p.base, p.quote, p.decBase, p.decQuote);
  const { precio: Pnow } = await precioPar(p.base, p.quote, p.decBase, p.decQuote, rutas);
  if (!(Pnow > 0)) throw new Error('No se pudo leer el precio del par');

  const montoQuote = Number(p.montoQuote);          // cuánto gastar (quote)
  if (!(montoQuote > 0)) throw new Error('Indica cuánto quieres comprar');
  const targetPrice = Number(p.targetPrice);        // precio objetivo (humano)
  if (!(targetPrice > 0)) throw new Error('Indica el precio de compra');

  const feeTier = await mejorFeeTier(p.quote, p.base, aBI(montoQuote, p.decQuote));
  if (!feeTier) throw new Error('Esta moneda no tiene pool en PancakeSwap V3. Prueba con otra.');

  // Base que recibiría al gastar montoQuote al precio objetivo EXACTO.
  // El nivel solo se cumple cuando el precio baja a tu objetivo (ni antes ni a
  // mercado). La tolerancia del swap la da slippageBps, no el disparo.
  const baseObjetivo = montoQuote / targetPrice;
  const niveles = [{ minOutCompra: aBI(baseObjetivo, p.decBase), minOutVenta: 0n, estado: 1 }];

  let ordenQuote = aBI(montoQuote, p.decQuote); if (ordenQuote <= 0n) ordenQuote = 1n;

  return {
    base: p.base, quote: p.quote,
    ordenQuote, ordenBase: 0n,
    niveles,
    slippageBps: p.slippageBps || 50, cooldownSeg: 0,   // 0.5% de holgura para el swap
    tpUnitOut: 0n, slUnitOut: 0n,
    feeTier,
    modo: 0,                                          // grid: un solo nivel de compra por precio
    objetivoBps: 0, factorBps: 0,
    compraInicialQuote: 0n,
    margenBps: 0,
    _Pnow: Pnow, _montoQuote: montoQuote, _targetPrice: targetPrice
  };
}

/** Config del BOT CASH OUT (modo 2): vende una cantidad que YA tienes, al objetivo. */
export async function construirConfigDCA(p) {
  const rutas = p.rutas || await resolverRutas(p.base, p.quote, p.decBase, p.decQuote);
  const { precio: Pnow } = await precioPar(p.base, p.quote, p.decBase, p.decQuote, rutas);
  if (!(Pnow > 0)) throw new Error('No se pudo leer el precio del par');

  const montoQuote = Number(p.montoQuote);          // $ (quote) por compra
  if (!(montoQuote > 0)) throw new Error('Indica cuánto comprar en cada compra');
  const intervalo = Math.floor(Number(p.intervalo));// segundos entre compras
  if (!(intervalo > 0)) throw new Error('Indica cada cuánto comprar');
  const comprasMax = Math.floor(Number(p.comprasMax) || 0);   // 0 = infinito

  const feeTier = await mejorFeeTier(p.quote, p.base, aBI(montoQuote, p.decQuote));
  if (!feeTier) throw new Error('Esta moneda no tiene pool en PancakeSwap V3. Prueba con otra.');

  let ordenQuote = aBI(montoQuote, p.decQuote); if (ordenQuote <= 0n) ordenQuote = 1n;

  return {
    base: p.base, quote: p.quote,
    ordenQuote, ordenBase: 0n,
    // El modo 3 (DCA) compra por TIEMPO, no por niveles: no usa ninguno. Pero el contrato
    // exige niveles.length > 0. Metemos un nivel "fantasma" inerte (el keeper del DCA usa
    // comprarDCA, nunca ejecutar, así que este nivel jamás se toca).
    niveles: [{ minOutCompra: 0n, minOutVenta: 0n, estado: 0 }],
    slippageBps: p.slippageBps || 0, cooldownSeg: 0,
    tpUnitOut: 0n, slUnitOut: 0n,
    feeTier,
    modo: 3,
    objetivoBps: 0, factorBps: 0,
    compraInicialQuote: 0n,
    margenBps: 0,
    intervalo, comprasMax,
    _Pnow: Pnow, _montoQuote: montoQuote, _intervalo: intervalo, _comprasMax: comprasMax
  };
}

export async function construirConfigCashOut(p) {
  const rutas = p.rutas || await resolverRutas(p.base, p.quote, p.decBase, p.decQuote);
  const { precio: Pnow } = await precioPar(p.base, p.quote, p.decBase, p.decQuote, rutas);
  if (!(Pnow > 0)) throw new Error('No se pudo leer el precio del par');

  const cantidad = Number(p.cantidadBase);          // cantidad de la cripto a vender (humano)
  if (!(cantidad > 0)) throw new Error('Indica cuánto quieres vender');
  const targetPrice = Number(p.targetPrice);        // precio objetivo (humano)
  if (!(targetPrice > Pnow)) throw new Error('El objetivo debe estar por encima del precio actual');

  const valorActual = cantidad * Pnow;              // valor de referencia (quote) para calcular la ganancia
  const proceeds = cantidad * targetPrice;          // lo que recibirá al vender (quote)

  const feeTier = await mejorFeeTier(p.base, p.quote, aBI(cantidad, p.decBase));
  if (!feeTier) throw new Error('Esta moneda no tiene pool en PancakeSwap V3. Prueba con otra.');

  // Un solo nivel de VENTA al precio objetivo.
  const niveles = [{ minOutCompra: 0n, minOutVenta: aBI(proceeds, p.decQuote), estado: 2 }];

  let ordenBase = aBI(cantidad, p.decBase); if (ordenBase <= 0n) ordenBase = 1n;
  let ordenQuote = aBI(valorActual, p.decQuote); if (ordenQuote <= 0n) ordenQuote = 1n;

  return {
    base: p.base, quote: p.quote,
    ordenQuote, ordenBase,
    niveles,
    slippageBps: p.slippageBps || 0, cooldownSeg: 0,
    tpUnitOut: 0n, slUnitOut: 0n,
    feeTier,
    modo: 2,
    objetivoBps: 0, factorBps: 0,
    compraInicialQuote: aBI(valorActual, p.decQuote),   // valor declarado (para la ganancia)
    margenBps: 0,
    _Pnow: Pnow, _valorActual: valorActual, _proceeds: proceeds, _ganancia: proceeds - valorActual, _targetPrice: targetPrice
  };
}

export async function crearRejilla(config) {
  const c = {
    base: config.base, quote: config.quote,
    ordenQuote: config.ordenQuote, ordenBase: config.ordenBase,
    niveles: config.niveles,
    slippageBps: config.slippageBps, cooldownSeg: config.cooldownSeg,
    tpUnitOut: config.tpUnitOut, slUnitOut: config.slUnitOut,
    feeTier: config.feeTier ?? 500,
    modo: config.modo ?? 0,
    objetivoBps: config.objetivoBps ?? 0,
    factorBps: config.factorBps ?? 0,
    compraInicialQuote: config.compraInicialQuote ?? 0n,
    margenBps: config.margenBps ?? 0,
    botId: config.botId ?? 0,
    intervalo: config.intervalo ?? 0,
    comprasMax: config.comprasMax ?? 0
  };
  const bot = await cEscribe();
  const tx = await bot.crearRejilla(c, { gasLimit: 3000000n });
  return esperar(tx);
}

export async function cerrarAhora(base, quote) {
  const bot = await cEscribe(); const tx = await bot.cerrarAhora(base, quote, { gasLimit: 900000n }); return esperar(tx);
}
export async function resumenK(clave) { return leeGB('resumen(bytes32)', [clave]); }

/* Historial COMPLETO del usuario, leído de la cadena (eventos Ejecutado).
   Devuelve las operaciones de TODOS sus bots y órdenes en una sola consulta,
   ya con par, precio, cantidad y fecha, ordenadas de la más reciente a la más
   antigua y limitadas (sin scroll infinito: el dato completo vive en la cadena).
   Cada op trae `clave` para que la web sepa si fue una orden manual o un bot. */
export async function historialDe(usuario, desdeBloques = 60000, maxOps = 60) {
  let latest = 0; try { latest = await lector().getBlockNumber(); } catch {}
  // 1) Todos los eventos Ejecutado del usuario (sin filtrar por clave).
  //    Algunos RPC públicos devuelven la consulta VACÍA aunque sí hay datos;
  //    por eso probamos varios y nos quedamos con el que SÍ traiga operaciones.
  let logs = [], ok = false;
  const rangos = [desdeBloques, 20000, 6000];
  for (let i = 0; i < RPCS.length; i++) {
    const cc = new ethers.Contract(GRIDBOT, ABI, provRPC(i));
    for (const r of rangos) {
      const desde = latest > r ? latest - r : 0;
      try {
        const res = await cc.queryFilter(cc.filters.Ejecutado(usuario), desde, latest || 'latest');
        ok = true;
        if (res && res.length) { logs = res; break; }   // datos: nos quedamos con estos
      } catch (_) {}
    }
    if (logs.length) break;                              // ya tenemos operaciones
  }
  if (!ok) return { error: 'sin-historial', ops: [] };
  if (!logs.length) return { error: null, ops: [] };

  // 2) Mapa clave -> {base, quote} leyendo el resumen de cada clave distinta.
  const claves = [...new Set(logs.map((l) => String(l.args.clave)))];
  const porClave = {};
  await Promise.all(claves.map(async (k) => {
    try { const R = await resumenK(k); if (R) porClave[k] = { base: R.base, quote: R.quote }; } catch (_) {}
  }));

  // 3) Decimales de cada token que aparece.
  const tokens = [...new Set(Object.values(porClave).flatMap((p) => [String(p.base).toLowerCase(), String(p.quote).toLowerCase()]))];
  const dec = {};
  await Promise.all(tokens.map(async (t) => { try { dec[t] = (await infoToken(t)).decimals; } catch (_) { dec[t] = 18; } }));

  // 4) Fechas de los bloques.
  let fechas = {};
  try { fechas = await tiempoDeBloque([...new Set(logs.map((l) => l.blockNumber))]); } catch (_) {}

  // 5) Construir las operaciones legibles.
  const ops = logs.map((l) => {
    const a = l.args, clave = String(a.clave), compra = a.compra;
    const par = porClave[clave]; if (!par) return null;
    const dB = dec[String(par.base).toLowerCase()] ?? 18, dQ = dec[String(par.quote).toLowerCase()] ?? 18;
    const inH = Number(ethers.formatUnits(a.entrada, compra ? dQ : dB));
    const outH = Number(ethers.formatUnits(a.salida, compra ? dB : dQ));
    const precio = compra ? (outH > 0 ? inH / outH : NaN) : (inH > 0 ? outH / inH : NaN);
    const cantidad = compra ? outH : inH;          // cantidad del activo base movida
    const recibido = compra ? outH : outH;         // lo que recibe (base en compra, quote en venta)
    return { clave, compra, precio, cantidad, quote: compra ? inH : outH, base: par.base, quoteAddr: par.quote, bloque: l.blockNumber, tiempo: fechas[l.blockNumber] || 0 };
  }).filter((x) => x && isFinite(x.precio) && x.precio > 0);

  ops.sort((x, y) => (y.tiempo || y.bloque) - (x.tiempo || x.bloque));
  return { error: null, ops: ops.slice(0, maxOps), total: ops.length };
}
export async function cerrarAhoraK(clave) {
  const bot = await cEscribe(); const tx = await bot['cerrarAhora(bytes32)'](clave, { gasLimit: 900000n }); return esperar(tx);
}
export async function cancelarRejillaK(clave) {
  const bot = await cEscribe(); const tx = await bot['cancelarRejilla(bytes32)'](clave, { gasLimit: 900000n }); return esperar(tx);
}
export async function cancelarRejilla(base, quote) {
  const bot = await cEscribe();
  const cuenta = wallet.cuentaActual();
  const clave = await bot.claveBot(cuenta, base, quote, 0);
  const tx = await bot.cerrarAhora(clave, { gasLimit: 900000n }); return esperar(tx);
}
export async function activarRejilla(base, quote, activa) {
  return true; /* V11: activacion/pausa por pago mensual */
}
export async function setTPSL(base, quote, tpUnitOut, slUnitOut) {
  return true; /* V11: TP/SL se define al crear la rejilla */
}
export async function ajustarSlippage(base, quote, bps) {
  const bot = await cEscribe(); const tx = await bot.ajustarSlippage(base, quote, bps); return esperar(tx);
}
export async function ajustarCooldown(base, quote, seg) {
  const bot = await cEscribe(); const tx = await bot.ajustarCooldown(base, quote, seg); return esperar(tx);
}

/** Recarga el tanque de gas (BNB) del usuario. */
export async function depositarGas(bnbHumano) {
  const bot = await cEscribe();
  const tx = await bot.depositarGas({ value: ethers.parseEther(String(bnbHumano)), gasLimit: 160000n });
  return esperar(tx);
}
export async function retirarGas(bnbHumano) {
  const bot = await cEscribe();
  const tx = await bot.retirarGas(ethers.parseEther(String(bnbHumano)), { gasLimit: 200000n });
  return esperar(tx);
}

/* ================================================================== */
/* Utilidades de formato para la UI                                    */
/* ================================================================== */

export const fmt = ethers.formatUnits;
export const parse = ethers.parseUnits;
export const fmtBNB = ethers.formatEther;
export const checksum = ethers.getAddress;

/* ================================================================== */
/* SWAP — contrato independiente de intercambio (tarifa fija al owner) */
/* ================================================================== */
/* V11: el swap ahora lo hace el GridBot V11 (comisión porcentual 0.10%, multi-DEX
   con fallback automático, envuelve/desenvuelve BNB<->WBNB, reparte 20% al staking). */
export const SWAP = GRIDBOT;  // mismo contrato GridBot V11
const SWAP_ABI = [
  'function swap(address tokenIn,address tokenOut,uint24 feeTier,uint256 amountIn,uint256 minOut) payable returns (uint256)',
  'function feeBps() view returns (uint256)'
];
const NATIVO = '0x0000000000000000000000000000000000000000';

/** ¿Es BNB nativo para el swap? (null o address(0)). */
export function esNativoSwap(addr) { return !addr || addr.toLowerCase() === NATIVO; }

/** Tarifa fija del swap (en wei de BNB). */
export async function tarifaSwap() {
  return 0n;  // V11 no cobra tarifa fija; la comisión es porcentual (0.10%) dentro del swap.
}

/** Permiso del token hacia el contrato de SWAP (distinto al del bot). */
export async function allowanceSwap(tokenAddr, duenio) {
  const t = new ethers.Contract(tokenAddr, ERC20, lector());
  return t.allowance(duenio, SWAP);
}
/** Aprueba el token para el contrato de SWAP con un límite concreto (revocable).
 *  Se aprueba un monto finito (no ilimitado) para evitar el aviso de la wallet. */
export async function aprobarSwap(tokenAddr, montoBI) {
  const t = new ethers.Contract(tokenAddr, ERC20, await firmante());
  const monto = (montoBI && montoBI > 0n) ? montoBI : ethers.parseUnits('200', 18);
  const tx = await t.approve(SWAP, monto, { gasLimit: 120000n });
  return esperar(tx);
}
/** Revoca el permiso del token para el SWAP (allowance a 0). */
export async function revocarSwap(tokenAddr) {
  const t = new ethers.Contract(tokenAddr, ERC20, await firmante());
  const tx = await t.approve(SWAP, 0n, { gasLimit: 120000n });
  return esperar(tx);
}

/** Cotiza el swap por V3 (elige el mejor feeTier). null si no hay pool.
 *  inAddr/outAddr: null o address(0) = BNB nativo (se cotiza con WBNB). */
export async function cotizarSwap({ inAddr, outAddr, amountInBI, slippageBps = 50 }) {
  if (!(amountInBI > 0n)) return null;
  const qIn  = esNativoSwap(inAddr)  ? WBNB : inAddr;
  const qOut = esNativoSwap(outAddr) ? WBNB : outAddr;
  if (qIn.toLowerCase() === qOut.toLowerCase()) return null;
  const q = new ethers.Contract(QUOTER_V3, QUOTER_ABI, lector());
  let best = 0, bestOut = 0n;
  for (const fee of FEE_TIERS) {
    try {
      const r = await q.quoteExactInputSingle.staticCall({ tokenIn: qIn, tokenOut: qOut, amountIn: amountInBI, fee, sqrtPriceLimitX96: 0 });
      if (r[0] > bestOut) { bestOut = r[0]; best = fee; }
    } catch (_) {}
  }
  if (!best || bestOut === 0n) return null;
  // El GridBot V11 cobra ~0.10% de comisión sobre la entrada; la salida real baja otro tanto.
  // Se descuenta la comisión (10 bps) + el slippage elegido, para que el swap no revierta.
  const feeBps = 10n;
  const netFactor = 10000n - feeBps;
  const outNeto = bestOut * netFactor / 10000n;
  // Colchón extra (0.3%) porque el swap puede ejecutarse en otro fee tier con precio algo distinto.
  const colchon = 30n;
  const minOut = outNeto - (outNeto * (BigInt(slippageBps) + colchon) / 10000n);
  return { amountOut: outNeto, minOut, fee: best };
}

/** Ejecuta el swap. inAddr/outAddr: null o address(0) = BNB nativo.
 *  El contrato cobra la tarifa fija en BNB al owner y hace el intercambio. */
export async function ejecutarSwap({ inAddr, outAddr, amountInBI, minOut, fee }) {
  const c = new ethers.Contract(SWAP, SWAP_ABI, await firmante());
  const tokenIn  = esNativoSwap(inAddr)  ? NATIVO : inAddr;
  const tokenOut = esNativoSwap(outAddr) ? NATIVO : outAddr;
  // Si el token de entrada es BNB nativo, se envía como value; si no, value = 0.
  const value = esNativoSwap(inAddr) ? amountInBI : 0n;
  // firma V11: swap(tokenIn, tokenOut, feeTier, amountIn, minOut)
  const tx = await c.swap(tokenIn, tokenOut, fee, amountInBI, minOut, { value, gasLimit: 2500000n });
  return esperar(tx);
}

/* ================================================================== */
/* Importar cualquier token por dirección (estilo PancakeSwap)         */
/* ================================================================== */
const ERC20_META = [
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)'
];
/** ¿Es una dirección EVM válida? (tolerante a mayúsculas/minúsculas) */
const RE_ADDR = /^0x[0-9a-fA-F]{40}$/;
export function esDireccion(s) { return RE_ADDR.test((s || '').trim()); }
/** Lee symbol/name/decimals de un token ERC20 en BSC. Lanza si no es válido. */
export async function infoToken(addr) {
  const a = ethers.getAddress(addr.trim().toLowerCase());
  const t = new ethers.Contract(a, ERC20_META, lector());
  const [sym, dec] = await Promise.all([t.symbol(), t.decimals()]);
  let nom = sym; try { nom = await t.name(); } catch (_) {}
  return { address: a, simbolo: String(sym), nombre: String(nom), decimals: Number(dec) };
}

/** Modo/tipo de un bot: 0=Grid, 1=Acumulador, 2=Cash Out, 3=DCA. */
export async function modoDe(clave) { return leeGB('modoDe(bytes32)', [clave]); }
