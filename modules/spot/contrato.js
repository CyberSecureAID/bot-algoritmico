/* modules/spot/contrato.js — Cableado on chain de la seccion Spot al contrato SpotDF.
   ──────────────────────────────────────────────────────────────────────────────
   NO custodial: los fondos salen de la wallet del usuario y vuelven a su wallet en la
   misma transaccion. El usuario aprueba (approve) el token una vez; con eso abre/cierra.

   Seguridad de este front: el contrato SpotDF valida minOut (anti slippage) y los
   extremos de cada ruta, asi que un ruteo mal calculado aqui hace REVERTIR la tx, no
   pierde fondos. El unico riesgo real seria operar una direccion de token equivocada,
   por eso resolverToken() SOLO usa direcciones verificadas (MONEDAS o la lista BSC de
   los movers) y devuelve null cuando no puede resolverla (ahi el on chain se deshabilita).

   Fase actual: abrir y cerrar a MERCADO (long y short), firmado por el usuario. Las
   ordenes limit y los TP/SL automaticos se activan cuando conectemos el keeper. */

import { MONEDAS } from '../../assets/js/tokens.js';
import { cuentaActual, proveedorActivo } from '../../assets/js/wallet.js?v=129';

export const SPOT_ADDR = '0xfC3c9516665Ab36D8E56e0797F4392FbFc073c11';   // proxy SpotDF (verificado)
const USDT = '0x55d398326f99059fF775485246999027B3197955';              // USDT BSC (18 dec)
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';            // PancakeSwap V2

const ABI_SPOT = [
  'function abrirLong(tuple(address coin, address input, uint256 pagar, address[] rutaAUsdt, uint256 minUsdt, address[] rutaCoin, uint256 minCoin, uint256 floorOut, uint256 deadline) q) payable returns (uint256)',
  'function abrirShort(tuple(address coin, address input, uint256 pagar, address[] rutaAUsdt, uint256 minUsdt, address[] rutaCoin, uint256 minCoin, uint256 floorOut, uint256 deadline) q) payable returns (uint256)',
  'function cerrar(uint256 id, address[] ruta, uint256 minOut, uint256 deadline)',
  'function posicionInfo(uint256 id) view returns (tuple(address user, address coin, bool esShort, uint256 qty, uint256 costo, uint256 refQty, uint256 floorOut, uint40 t, bool abierta))',
  'function posicionesDe(address w) view returns (uint256[])',
  'function setFloor(uint256 id, uint256 floorOut)',
  'event Abierta(uint256 indexed id, address indexed user, address indexed coin, bool esShort, uint256 costoUsdt, uint256 qty, uint256 refQty)'
];
const ABI_ROUTER = ['function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])'];
const ABI_ERC20 = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];

let _ethers = null;
async function E() {
  if (!_ethers) _ethers = await import('../../assets/js/vendor/ethers-6.13.4.min.js?v=126');
  return _ethers;
}
/* Provider y signer FRESCOS en cada operación (ligados a la cuenta y la red del momento:
   nunca quedan viejos si cambias de cuenta o de cadena). */
async function _signer() {
  const ethers = await E();
  const prov = new ethers.BrowserProvider(proveedorActivo ? (proveedorActivo() || window.ethereum) : window.ethereum);
  return prov.getSigner();
}
/* Precalentar: adelanta la carga de ethers (el archivo pesado) al conectar la wallet, que es
   lo que antes tardaba segundos al tocar Long/Short. Así la firma salta casi al instante. */
export async function precalentar() { try { await E(); } catch (_) {} }

/* coin de la grafica -> { address, decimals } en BSC, SOLO si es una direccion verificada. */
export function resolverToken(par) {
  if (!par) return null;
  const esDir = (x) => typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x);
  if (esDir(par.addr)) return { address: par.addr, decimals: +par.decimals || 18 };
  if (esDir(par.address)) return { address: par.address, decimals: +par.decimals || 18 };
  const coin = par.coin || par.id;
  const alias = coin === 'BTC' ? 'BTCB' : coin;           // en BSC, BTC es BTCB
  const m = MONEDAS[alias] || MONEDAS[coin];
  if (m && esDir(m.address)) return { address: m.address, decimals: +m.decimals || 18 };
  if (m && m.address === null) return { address: WBNB, decimals: 18 };   // BNB nativo -> WBNB on chain
  return null;
}
export function operableOnchain(par) { return !!resolverToken(par); }

/* Mejor ruta entre dos tokens (directa, via USDT o via WBNB) y su salida estimada. */
async function mejorRuta(router, from, to, amountIn) {
  if (from.toLowerCase() === to.toLowerCase()) return null;
  const cand = [[from, to]];
  if (![from, to].map(a => a.toLowerCase()).includes(USDT.toLowerCase())) cand.push([from, USDT, to]);
  if (![from, to].map(a => a.toLowerCase()).includes(WBNB.toLowerCase())) cand.push([from, WBNB, to]);
  // Las rutas candidatas se cotizan EN PARALELO (antes era en serie: 3 viajes de red → 1).
  const res = await Promise.all(cand.map(async (path) => {
    try { const a = await router.getAmountsOut(amountIn, path); return { path, out: a[a.length - 1] }; } catch (_) { return null; }
  }));
  let best = null;
  for (const r of res) if (r && (!best || r.out > best.out)) best = r;
  return best;
}
const conSlippage = (out, bps) => out - (out * BigInt(Math.max(0, Math.min(5000, bps | 0))) / 10000n);

/* Approve por monto MÁXIMO la primera vez que haga falta: así las siguientes operaciones
   con esa misma moneda ya NO piden approve (una sola firma de antelación, como se pidió).
   Es el contrato propio y no custodial; el estándar de los dapps (Pancake, Uniswap). */
async function _aprobarSiHace(ethers, tokenAddr, monto, cuenta, signer) {
  const t = new ethers.Contract(tokenAddr, ABI_ERC20, signer);
  const act = await t.allowance(cuenta, SPOT_ADDR);
  if (act < monto) { const tx = await t.approve(SPOT_ADDR, ethers.MaxUint256); await tx.wait(); }
}

/* ── Abrir a mercado (long o short) sobre el par EN PANTALLA. No cambia de moneda.
   pagar: con que fondeas, 'USDT' o 'BNB' (ambos soportados por el contrato: USDT por
   approve+transferFrom; BNB nativo por msg.value, el contrato lo convierte a USDT).
   monto: cantidad en esa moneda. Devuelve { hash, id, costoUsdt }. El id es el de la
   posicion on chain (del evento Abierta): hace falta para poder cerrarla luego. ── */
export async function abrirMercadoSpot({ par, lado, pagar = 'USDT', monto, slippageBps = 100, floorOut = 0, deadlineSeg = 300 }) {
  const ethers = await E();
  const cuenta = cuentaActual && cuentaActual();
  if (!cuenta) throw new Error('Connect your wallet first.');
  const tok = resolverToken(par);
  if (!tok) throw new Error('This coin is not tradeable on-chain yet.');
  if (!(monto > 0)) throw new Error('Enter an amount first.');
  const signer = await _signer();
  const router = new ethers.Contract(ROUTER, ABI_ROUTER, signer);
  const spot = new ethers.Contract(SPOT_ADDR, ABI_SPOT, signer);
  const dl = BigInt(Math.floor(Date.now() / 1000) + Math.max(60, deadlineSeg));
  const floorWei = floorOut > 0 ? ethers.parseUnits(Number(floorOut).toFixed(8), lado === 'short' ? tok.decimals : 18) : 0n;

  let q, overrides = {}, enUsdtEst;
  if (pagar === 'BNB') {
    // BNB nativo: input = address(0), el contrato swapea BNB -> USDT con rutaAUsdt y msg.value.
    const valueWei = ethers.parseUnits(Number(monto).toFixed(18), 18);
    let outUsdt = 0n; try { const a = await router.getAmountsOut(valueWei, [WBNB, USDT]); outUsdt = a[a.length - 1]; } catch (_) {}
    if (!(outUsdt > 0n)) throw new Error('No BNB to USDT route right now.');
    enUsdtEst = outUsdt;
    const r = await mejorRuta(router, USDT, tok.address, outUsdt);
    if (!r) throw new Error('No liquidity route for this coin.');
    q = {
      coin: tok.address, input: ethers.ZeroAddress, pagar: 0n,
      rutaAUsdt: [WBNB, USDT], minUsdt: conSlippage(outUsdt, slippageBps),
      rutaCoin: r.path, minCoin: lado === 'short' ? 0n : conSlippage(r.out, slippageBps),
      floorOut: floorWei, deadline: dl
    };
    overrides = { value: valueWei };
  } else {
    // USDT: approve una vez + transferFrom. input = USDT, sin ruta de entrada.
    const pagarWei = ethers.parseUnits(Number(monto).toFixed(8), 18);     // USDT 18 dec en BSC
    await _aprobarSiHace(ethers, USDT, pagarWei, cuenta, signer);
    const r = await mejorRuta(router, USDT, tok.address, pagarWei);
    if (!r) throw new Error('No liquidity route for this coin.');
    enUsdtEst = pagarWei;
    q = {
      coin: tok.address, input: USDT, pagar: pagarWei,
      rutaAUsdt: [], minUsdt: pagarWei,
      rutaCoin: r.path, minCoin: lado === 'short' ? 0n : conSlippage(r.out, slippageBps),
      floorOut: floorWei, deadline: dl
    };
  }

  const tx = lado === 'short' ? await spot.abrirShort(q, overrides) : await spot.abrirLong(q, overrides);
  const rec = await tx.wait();
  let id = null;
  try {
    const iface = new ethers.Interface(ABI_SPOT);
    for (const lg of rec.logs) { try { const pl = iface.parseLog(lg); if (pl && pl.name === 'Abierta') { id = Number(pl.args.id); break; } } catch (_) {} }
  } catch (_) {}
  return { hash: rec.hash, id, costoUsdt: Number(ethers.formatUnits(enUsdtEst, 18)) };
}

/* ── Cerrar a mercado una posicion on chain (la firma el usuario). Lee la posicion,
   aprueba el activo que hay que entregar y llama a cerrar con minOut anti slippage. ── */
export async function cerrarMercadoSpot({ id, slippageBps = 100, deadlineSeg = 300 }) {
  const ethers = await E();
  const cuenta = cuentaActual && cuentaActual();
  if (!cuenta) throw new Error('Connect your wallet first.');
  const signer = await _signer();
  const router = new ethers.Contract(ROUTER, ABI_ROUTER, signer);
  const spot = new ethers.Contract(SPOT_ADDR, ABI_SPOT, signer);
  const p = await spot.posicionInfo(id);
  if (!p.abierta) throw new Error('Position already closed.');

  const dl = BigInt(Math.floor(Date.now() / 1000) + Math.max(60, deadlineSeg));
  let ruta, minOut;
  if (!p.esShort) {
    // Long: entregar la moneda, recibir USDT. Aprobar la moneda.
    await _aprobarSiHace(ethers, p.coin, p.qty, cuenta, signer);
    const r = await mejorRuta(router, p.coin, USDT, p.qty);
    if (!r) throw new Error('No liquidity route to close.');
    ruta = r.path; minOut = conSlippage(r.out, slippageBps);
  } else {
    // Short: entregar el USDT colateral, recibir la moneda. Aprobar USDT.
    await _aprobarSiHace(ethers, USDT, p.costo, cuenta, signer);
    const r = await mejorRuta(router, USDT, p.coin, p.costo);
    if (!r) throw new Error('No liquidity route to close.');
    ruta = r.path; minOut = conSlippage(r.out, slippageBps);
  }
  const tx = await spot.cerrar(id, ruta, minOut, dl);
  const rec = await tx.wait();
  return { hash: rec.hash };
}

/* Posiciones on chain del usuario (ids). */
export async function misPosicionesSpot() {
  try {
    const ethers = await E();
    const cuenta = cuentaActual && cuentaActual();
    if (!cuenta) return [];
    const spot = new ethers.Contract(SPOT_ADDR, ABI_SPOT, await _signer());
    const ids = await spot.posicionesDe(cuenta);
    return ids.map((x) => Number(x));
  } catch (_) { return []; }
}
