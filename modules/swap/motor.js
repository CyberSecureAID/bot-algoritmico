/**
 * MOTOR DEL SWAP (modules/swap/motor.js)
 * Solo lo que el swap necesita de la antigua assets/js/gridbot.js. Nada de bots aqui.
 * Este archivo pertenece al modulo swap y NO se importa desde ningun otro modulo.
 */
import * as ethers from './ethers.min.js';
import * as wallet from './wallet.js';


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


const ERC20 = [
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

const QUOTER_V3 = '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997';

const QUOTER_ABI = ['function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)'];

const FEE_TIERS = [500, 2500, 100, 10000];


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

/* Lecturas resistentes: si un RPC falla o limita, rota al siguiente. */
let _rpcIdx = 0;

const _provCache = {};

function provRPC(i) { const u = RPCS[i % RPCS.length]; if (!_provCache[u]) _provCache[u] = new ethers.JsonRpcProvider(u, 56, { staticNetwork: true }); return _provCache[u]; }


/* Gas seguro para un approve de token. Un approve normal gasta ~46k, pero si la wallet
   es una smart account (EIP-7702) MetaMask enruta la transacción por el Delegation
   Manager, que necesita mucho más gas; con el límite fijo bajo de antes se quedaba sin
   gas y la revocación o aprobación fallaba. Estimamos con margen y, si la wallet tiene
   código desplegado (smart account), garantizamos un mínimo holgado. Las wallets
   normales (EOA sin código) no se ven afectadas. */
/* Estima el gas con 35% de margen sobre el MISMO contrato que recibe (WBNB, token, swap).
   Si la estimacion falla por un hipo de red, se envia sin gasLimit y la wallet estima ella.
   Si la tx revierte de verdad, se lanza el motivo y no se envia (no se gasta gas en balde).
   Smart account (EIP-7702): la tx va por el Delegation Manager y gasta unos 100-150k mas.
   NO se dobla el gas: MetaMask comprueba el costo MAXIMO (valor + gasLimit x precio), y con
   el doble exigia el doble de BNB libre y deshabilitaba el boton aunque el costo real cupiera. */
async function gasMargen(contrato, metodo, args = [], overrides = {}) {
  let est = null;
  try { est = await contrato[metodo].estimateGas(...args, overrides); }
  catch (e) {
    const esRevert = !!(e && (e.code === 'CALL_EXCEPTION' || e.revert || e.reason ||
      /execution reverted/i.test(e.shortMessage || e.message || '')));
    if (esRevert) throw e;
    est = null;
  }
  if (est == null) return contrato[metodo](...args, overrides);
  let gasLimit = est * 135n / 100n;
  if (await _esSmartAccount(contrato.runner)) gasLimit = est * 135n / 100n + 150000n;
  return contrato[metodo](...args, { ...overrides, gasLimit });
}

async function gasAprobar(t, spender, monto) {
  let gasLimit;
  try { const est = await t.approve.estimateGas(spender, monto); gasLimit = est * 160n / 100n; }
  catch (_) { gasLimit = 120000n; }
  if ((await _esSmartAccount(t.runner)) && gasLimit < 600000n) gasLimit = 600000n;
  return t.approve(spender, monto, { gasLimit });
}


/* ¿La wallet (EOA) tiene código desplegado? Señal de smart account (EIP-7702 / MetaMask
   Smart Account): MetaMask enruta la transacción por el Delegation Manager, que gasta
   bastante más que una tx normal, y por eso la estimación justa se quedaba sin gas. */
async function _esSmartAccount(runner) {
  try { const addr = await runner.getAddress(); const code = await lector().getCode(addr); return !!(code && code !== '0x'); }
  catch (_) { return false; }
}

/* Igual que _esSmartAccount pero para la wallet conectada ahora, con cache de 1 min
   por direccion: se consulta en la cotizacion del swap (en cada tecleo) y en el
   pre-vuelo de los bots, y no hace falta pedir getCode cada vez. */
let _saCache = { addr: '', val: false, t: 0 };

async function _esSmartActual() {
  try {
    const s = await firmante(); const addr = (await s.getAddress()).toLowerCase();
    if (_saCache.addr === addr && Date.now() - _saCache.t < 60000) return _saCache.val;
    const v = await _esSmartAccount(s); _saCache = { addr, val: v, t: Date.now() }; return v;
  } catch (_) { return false; }
}

export async function esSmartAccountActual() { return _esSmartActual(); }

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

export async function balanceToken(tokenAddr, duenio) {
  let err;
  for (let i = 0; i < RPCS.length; i++) {
    try { const t = new ethers.Contract(tokenAddr, ERC20, provRPC(_rpcIdx)); const r = await t.balanceOf(duenio); return r; }
    catch (e) { err = e; _rpcIdx = (_rpcIdx + 1) % RPCS.length; await new Promise(r => setTimeout(r, 160)); }
  }
  throw err;
}

/** ¿Esta dirección es el WBNB (o sea, la moneda es BNB)? */
export function esBNB(tokenAddr) { return (tokenAddr || '').toLowerCase() === WBNB.toLowerCase(); }

/** Saldo NATIVO de BNB (no WBNB). */
export async function saldoNativoBNB(duenio) {
  let err;
  for (let i = 0; i < RPCS.length; i++) {
    try { const r = await provRPC(_rpcIdx).getBalance(duenio); return r; }
    catch (e) { err = e; _rpcIdx = (_rpcIdx + 1) % RPCS.length; await new Promise(r => setTimeout(r, 160)); }
  }
  throw err;
}

/** Envuelve BNB nativo -> WBNB (para que el bot pueda venderlo). */
export async function envolverBNB(montoWei) {
  const abi = ['function deposit() payable'];
  const c = new ethers.Contract(WBNB, abi, await firmante());
  const tx = await gasMargen(c, 'deposit', [], { value: montoWei });
  return esperar(tx);
}

/** Desenvuelve WBNB -> BNB nativo (al suspender, devuelve el BNB tal cual). */
export async function desenvolverBNB(montoWei) {
  const abi = ['function withdraw(uint256) external'];
  const c = new ethers.Contract(WBNB, abi, await firmante());
  const tx = await gasMargen(c, 'withdraw', [montoWei]);
  return esperar(tx);
}


/* ================================================================== */
/* Utilidades de formato para la UI                                    */
/* ================================================================== */

export const fmt = ethers.formatUnits;

export const parse = ethers.parseUnits;


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
  const tx = await gasAprobar(t, SWAP, monto);
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
  // Colchón de holgura: subido a 1.0% (antes 0.3%). En smart account EIP-7702 la confirmación
  // lleva varios segundos (revisar alerta, soy consciente, confirmar) y el precio del BNB se mueve
  // en ese rato; con el colchón viejo la salida rozaba el mínimo → cartel "probable que falle" y
  // fallos intermitentes. Con 1.0% la salida queda cómodamente por encima del mínimo.
  /* Smart account: la confirmacion tarda varios segundos (revisar alerta, soy consciente,
     confirmar) y el precio del BNB se mueve en ese rato. Con 1% la salida rozaba el minimo
     y el swap revertia por slippage de forma intermitente. Para smart account se usa 2%. */
  let colchon = 100n;
  try { if (await _esSmartActual()) colchon = 200n; } catch (_) {}
  const minOut = outNeto - (outNeto * (BigInt(slippageBps) + colchon) / 10000n);
  return { amountOut: outNeto, minOut, fee: best };
}


/** Ejecuta el swap. inAddr/outAddr: null o address(0) = BNB nativo.
 *  El contrato cobra la tarifa fija en BNB al owner y hace el intercambio. */
export async function ejecutarSwap({ inAddr, outAddr, amountInBI, minOut, fee }) {
  const c = new ethers.Contract(SWAP, SWAP_ABI, await firmante());
  const tokenIn  = esNativoSwap(inAddr)  ? NATIVO : inAddr;
  const tokenOut = esNativoSwap(outAddr) ? NATIVO : outAddr;
  const value = esNativoSwap(inAddr) ? amountInBI : 0n;
  // estimateGas revela el MOTIVO del revert antes de firmar. Si la tx fuera a revertir,
  // lanza ese motivo (y NO mandamos una tx condenada que gastaria gas en fallar). Asi el
  // usuario ve el error real en pantalla, no el generico "es probable que falle".
  const est = await c.swap.estimateGas(tokenIn, tokenOut, fee, amountInBI, minOut, { value });
  let gasLimit = est + (est * 35n / 100n);
  // Smart account (EIP-7702): MetaMask enruta por su Delegation Manager y gasta mas gas.
  if (await _esSmartAccount(c.runner)) gasLimit = est * 135n / 100n + 150000n;   // sin doble: solo la sobrecarga real del Delegation Manager
  const tx = await c.swap(tokenIn, tokenOut, fee, amountInBI, minOut, { value, gasLimit });
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

