/* modules/spot/contrato.js — Cableado on chain de la seccion Spot al contrato SpotDF.
   ──────────────────────────────────────────────────────────────────────────────
   NO custodial: los fondos salen de la wallet del usuario y vuelven a su wallet en la
   misma transaccion. El usuario aprueba (approve) el token una vez; con eso abre/cierra.

   VELOCIDAD: todas las LECTURAS (cotizaciones de ruta, allowance, posicionInfo, balance)
   van por un RPC publico de BSC propio (lector), NO por el provider inyectado de MetaMask,
   que es lento. Solo FIRMAR (approve/abrir/cerrar) pasa por MetaMask. Asi la wallet salta
   casi al instante al tocar el boton, en vez de esperar varias lecturas lentas antes.

   Seguridad de este front: el contrato SpotDF valida minOut (anti slippage) y los
   extremos de cada ruta, asi que un ruteo mal calculado aqui hace REVERTIR la tx, no
   pierde fondos. resolverToken() SOLO usa direcciones verificadas y devuelve null cuando
   no puede resolverla (ahi el on chain se deshabilita y se opera en vista previa local). */

import { MONEDAS } from '../../assets/js/tokens.js';
import { cuentaActual, proveedorActivo } from '../../assets/js/wallet.js?v=129';

export const SPOT_ADDR = '0xfC3c9516665Ab36D8E56e0797F4392FbFc073c11';   // proxy SpotDF (verificado)
const USDT = '0x55d398326f99059fF775485246999027B3197955';              // USDT BSC (18 dec)
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';            // PancakeSwap V2
// RPC publicos de BSC (no Binance CEX, no geobloqueados en EE. UU.). Solo lectura.
const RPC = 'https://bsc-rpc.publicnode.com';

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
/* Lector: provider SOLO lectura por RPC publico de BSC (no pasa por MetaMask). staticNetwork
   evita el viaje de deteccion de red. Es lo que hace rapidas las cotizaciones y lecturas. */
let _lector = null;
async function lector() {
  const ethers = await E();
  if (!_lector) _lector = new ethers.JsonRpcProvider(RPC, 56, { staticNetwork: true });
  return _lector;
}
/* Signer FRESCO en cada operacion (ligado a la cuenta y la red del momento: nunca viejo). */
async function _signer() {
  const ethers = await E();
  const prov = new ethers.BrowserProvider(proveedorActivo ? (proveedorActivo() || window.ethereum) : window.ethereum);
  return prov.getSigner();
}
/* Precalentar al conectar la wallet: adelanta la carga de ethers (archivo pesado) y abre el
   lector, que es lo que antes tardaba segundos al tocar Long/Short. */
export async function precalentar() { try { await E(); await lector(); } catch (_) {} }

/* ── Firma para el KEEPER (autorizar ordenes TP/SL/limite sin gas) ──
   El usuario firma un mensaje con su wallet; el keeper verifica que la firma sea del
   dueno real de la posicion on chain antes de aceptar la orden. No mueve fondos. */
export async function firmarMensaje(mensaje) {
  const s = await _signer();
  return s.signMessage(mensaje);
}
export async function cuentaFirmante() {
  const s = await _signer();
  return s.getAddress();
}

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

/* Mejor ruta entre dos tokens (directa, via USDT o via WBNB) y su salida estimada.
   Las candidatas se cotizan EN PARALELO (antes en serie). Devuelve null si no hay pool. */
async function mejorRuta(router, from, to, amountIn) {
  if (from.toLowerCase() === to.toLowerCase()) return null;
  const cand = [[from, to]];
  if (![from, to].map(a => a.toLowerCase()).includes(USDT.toLowerCase())) cand.push([from, USDT, to]);
  if (![from, to].map(a => a.toLowerCase()).includes(WBNB.toLowerCase())) cand.push([from, WBNB, to]);
  const res = await Promise.all(cand.map(async (path) => {
    try { const a = await router.getAmountsOut(amountIn, path); return { path, out: a[a.length - 1] }; } catch (_) { return null; }
  }));
  let best = null;
  for (const r of res) if (r && (!best || r.out > best.out)) best = r;
  return best;
}
const conSlippage = (out, bps) => out - (out * BigInt(Math.max(0, Math.min(5000, bps | 0))) / 10000n);

/* Guardia de precio: compara el precio del POOL on chain (lo que de verdad te daría el swap)
   contra el precio REAL del gráfico (refPrice). Si se alejan demasiado, el pool está ilíquido
   o manipulado y la operación te clavaría (como pasó con ZKC): se BLOQUEA. La anti slippage
   normal no basta porque mide contra el propio pool podrido. */
const DESV_MAX = 0.15;   // 15%: las monedas líquidas quedan < 1%; un pool podrido se dispara.
function _guardPrecio(ethers, r, usdtWei, refPrice, coinDec) {
  if (!(refPrice > 0) || !r) return;
  const coinOut = Number(ethers.formatUnits(r.out, coinDec)); if (!(coinOut > 0)) return;
  const pxOnchain = Number(ethers.formatUnits(usdtWei, 18)) / coinOut;   // USD por moneda según el pool
  const dev = Math.abs(pxOnchain - refPrice) / refPrice;
  if (dev > DESV_MAX) { const e = new Error('POOL_MALO'); e.pxOnchain = pxOnchain; e.pxRef = refPrice; throw e; }
}

/* Error claro cuando una moneda no tiene pool en PancakeSwap (para distinguirlo y abrir
   vista previa en vez de bloquear). */
export const SIN_POOL = 'NO_POOL';

/* allowance se LEE por el lector (rapido); el approve (si hace falta) se FIRMA por MetaMask.
   Approve por monto maximo: la 1a vez pide approve, las siguientes con esa moneda ya no. */
async function _aprobarSiHace(ethers, tokenAddr, monto, cuenta, signer, prov) {
  const read = new ethers.Contract(tokenAddr, ABI_ERC20, prov);
  const act = await read.allowance(cuenta, SPOT_ADDR);
  if (act < monto) { const w = new ethers.Contract(tokenAddr, ABI_ERC20, signer); const tx = await w.approve(SPOT_ADDR, ethers.MaxUint256); await tx.wait(); }
}

/* ── Abrir a mercado (long o short) sobre el par EN PANTALLA. No cambia de moneda.
   pagar: 'USDT' o 'BNB'. monto: cantidad en esa moneda.
   Devuelve { hash, id, costoUsdt, coin, decimals, qty, refQty }. ── */
export async function abrirMercadoSpot({ par, lado, pagar = 'USDT', monto, slippageBps = 100, floorOut = 0, deadlineSeg = 300, refPrice = 0 }) {
  const ethers = await E();
  const cuenta = cuentaActual && cuentaActual();
  if (!cuenta) throw new Error('Connect your wallet first.');
  const tok = resolverToken(par);
  if (!tok) throw new Error('This coin is not tradeable on-chain yet.');
  if (!(monto > 0)) throw new Error('Enter an amount first.');
  const prov = await lector();
  const routerR = new ethers.Contract(ROUTER, ABI_ROUTER, prov);     // cotizaciones por lector (rapido)
  const signer = await _signer();
  const spot = new ethers.Contract(SPOT_ADDR, ABI_SPOT, signer);     // firma por MetaMask
  const dl = BigInt(Math.floor(Date.now() / 1000) + Math.max(60, deadlineSeg));
  const floorWei = floorOut > 0 ? ethers.parseUnits(Number(floorOut).toFixed(8), lado === 'short' ? tok.decimals : 18) : 0n;

  let q, overrides = {}, enUsdtEst;
  if (pagar === 'BNB') {
    const valueWei = ethers.parseUnits(Number(monto).toFixed(18), 18);
    let outUsdt = 0n; try { const a = await routerR.getAmountsOut(valueWei, [WBNB, USDT]); outUsdt = a[a.length - 1]; } catch (_) {}
    if (!(outUsdt > 0n)) throw new Error('No BNB to USDT route right now.');
    enUsdtEst = outUsdt;
    const r = await mejorRuta(routerR, USDT, tok.address, outUsdt);
    if (!r) throw new Error(SIN_POOL);
    _guardPrecio(ethers, r, outUsdt, refPrice, tok.decimals);   // bloquea si el pool está mal valorado
    q = {
      coin: tok.address, input: ethers.ZeroAddress, pagar: 0n,
      rutaAUsdt: [WBNB, USDT], minUsdt: conSlippage(outUsdt, slippageBps),
      rutaCoin: r.path, minCoin: lado === 'short' ? 0n : conSlippage(r.out, slippageBps),
      floorOut: floorWei, deadline: dl
    };
    overrides = { value: valueWei };
  } else {
    const pagarWei = ethers.parseUnits(Number(monto).toFixed(8), 18);     // USDT 18 dec en BSC
    const r = await mejorRuta(routerR, USDT, tok.address, pagarWei);       // cotiza ANTES de approve
    if (!r) throw new Error(SIN_POOL);
    _guardPrecio(ethers, r, pagarWei, refPrice, tok.decimals);             // bloquea si el pool está mal valorado
    await _aprobarSiHace(ethers, USDT, pagarWei, cuenta, signer, prov);
    enUsdtEst = pagarWei;
    q = {
      coin: tok.address, input: USDT, pagar: pagarWei,
      rutaAUsdt: [], minUsdt: pagarWei,
      rutaCoin: r.path, minCoin: lado === 'short' ? 0n : conSlippage(r.out, slippageBps),
      floorOut: floorWei, deadline: dl
    };
  }

  const tx = lado === 'short' ? await spot.abrirShort(q, overrides) : await spot.abrirLong(q, overrides);
  // Se devuelve EN CUANTO la tx se ENVIA (no se espera a minar): la UI registra la posicion al
  // instante y el minado se confirma en segundo plano con env.tx.wait() + idDeRecibo().
  try { registrarTokenVisto(tok.address, par && (par.simbolo || par.coin || par.id), tok.decimals); } catch (_) {}
  return { hash: tx.hash, tx, costoUsdt: Number(ethers.formatUnits(enUsdtEst, 18)), coin: tok.address, decimals: tok.decimals };
}

/* Tras minar la apertura, saca el id de posicion on chain del recibo (evento Abierta). */
export async function idDeRecibo(rec) {
  try {
    const ethers = await E();
    const iface = new ethers.Interface(ABI_SPOT);
    for (const lg of (rec.logs || [])) { try { const pl = iface.parseLog(lg); if (pl && pl.name === 'Abierta') return Number(pl.args.id); } catch (_) {} }
  } catch (_) {}
  return null;
}

/* ── Cerrar a mercado una posicion on chain (la firma el usuario). Lee por el lector,
   aprueba el activo a entregar y llama a cerrar con minOut anti slippage. ── */
export async function cerrarMercadoSpot({ id, slippageBps = 100, deadlineSeg = 300 }) {
  const ethers = await E();
  const cuenta = cuentaActual && cuentaActual();
  if (!cuenta) throw new Error('Connect your wallet first.');
  const prov = await lector();
  const routerR = new ethers.Contract(ROUTER, ABI_ROUTER, prov);
  const spotR = new ethers.Contract(SPOT_ADDR, ABI_SPOT, prov);       // posicionInfo por lector
  const signer = await _signer();
  const spot = new ethers.Contract(SPOT_ADDR, ABI_SPOT, signer);      // cerrar por firma
  const p = await spotR.posicionInfo(id);
  if (!p.abierta) throw new Error('Position already closed.');

  const dl = BigInt(Math.floor(Date.now() / 1000) + Math.max(60, deadlineSeg));
  let ruta, minOut;
  if (!p.esShort) {
    const r = await mejorRuta(routerR, p.coin, USDT, p.qty);
    if (!r) throw new Error('No liquidity route to close.');
    await _aprobarSiHace(ethers, p.coin, p.qty, cuenta, signer, prov);
    ruta = r.path; minOut = conSlippage(r.out, slippageBps);
  } else {
    const r = await mejorRuta(routerR, USDT, p.coin, p.costo);
    if (!r) throw new Error('No liquidity route to close.');
    await _aprobarSiHace(ethers, USDT, p.costo, cuenta, signer, prov);
    ruta = r.path; minOut = conSlippage(r.out, slippageBps);
  }
  const tx = await spot.cerrar(id, ruta, minOut, dl);
  // Se devuelve al ENVIAR la tx; el minado se confirma en segundo plano con env.tx.wait().
  return { hash: tx.hash, tx };
}

/* Posiciones on chain del usuario (ids). Lectura por el lector. */
export async function misPosicionesSpot() {
  try {
    const ethers = await E();
    const cuenta = cuentaActual && cuentaActual();
    if (!cuenta) return [];
    const spot = new ethers.Contract(SPOT_ADDR, ABI_SPOT, await lector());
    const ids = await spot.posicionesDe(cuenta);
    return ids.map((x) => Number(x));
  } catch (_) { return []; }
}

/* ── Tokens vistos (operados): para que el balance reconozca monedas recien compradas que
   no estan en la lista fija (ej. ZKC). Se guardan al abrir y se consultan por el lector. ── */
const LS_TOK = 'sp-tokens-vistos';
export function registrarTokenVisto(addr, simbolo, decimals) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(addr || ''))) return;
  const a = String(addr).toLowerCase();
  if (a === USDT.toLowerCase() || a === WBNB.toLowerCase()) return;      // ya los cuenta el balance base
  try {
    const l = JSON.parse(localStorage.getItem(LS_TOK) || '[]');
    if (!Array.isArray(l) || !l.some((t) => String(t.addr || '').toLowerCase() === a)) {
      const nl = (Array.isArray(l) ? l : []).concat([{ addr, sim: String(simbolo || 'TOKEN').slice(0, 10), dec: +decimals || 18 }]);
      localStorage.setItem(LS_TOK, JSON.stringify(nl.slice(-40)));
    }
  } catch (_) {}
}
export async function saldosVistos(cuenta) {
  try {
    if (!cuenta) return [];
    let l = []; try { l = JSON.parse(localStorage.getItem(LS_TOK) || '[]'); } catch (_) {}
    if (!Array.isArray(l)) l = [];
    // WBNB SIEMPRE se consulta: el usuario puede tener saldo (residuo de swaps) y la wallet lo
    // muestra aparte del BNB nativo; si no lo contamos, el balance no cuadra con MetaMask.
    const lista = [{ addr: WBNB, sim: 'WBNB', dec: 18 }].concat(l);
    const ethers = await E(); const prov = await lector();
    const routerR = new ethers.Contract(ROUTER, ABI_ROUTER, prov);
    const out = [];
    await Promise.all(lista.map(async (t) => {
      try {
        const erc = new ethers.Contract(t.addr, ABI_ERC20, prov);
        const raw = await erc.balanceOf(cuenta);
        if (!(raw > 0n)) return;
        const bal = Number(ethers.formatUnits(raw, t.dec || 18));
        let px = 0; try { const r = await mejorRuta(routerR, t.addr, USDT, ethers.parseUnits('1', t.dec || 18)); if (r) px = Number(ethers.formatUnits(r.out, 18)); } catch (_) {}
        out.push({ sim: t.sim || 'TOKEN', addr: t.addr, bal, usd: bal * px, px });
      } catch (_) {}
    }));
    return out;
  } catch (_) { return []; }
}
