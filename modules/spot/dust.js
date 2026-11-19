/* modules/spot/dust.js — Motor del Colector de polvo de Spot.
   ──────────────────────────────────────────────────────────────────────────────
   Junta los restos de muchas monedas de la wallet y los pasa TODOS a una sola
   (USDT o BNB), con un swap por moneda directo al router de PancakeSwap V2. NO
   custodial: cada swap sale de la wallet del usuario y vuelve a su wallet; el
   usuario firma cada uno. No depende del contrato SpotDF ni de gridbot.

   SEGURIDAD DEL GAS (regla dura): el gas en BSC se paga en BNB. Por eso este motor
   NUNCA cambia el 100% del BNB: siempre deja ~1 USD en BNB para poder firmar. Esa
   reserva se aplica AQUI (en recolectar), no en la interfaz, para que no se pueda
   saltar. Si al BNB solo le queda la reserva, se omite y se avisa.

   Lecturas (balance, cotizacion, allowance) por RPC publico de BSC (rapido). Solo
   FIRMAR (approve/swap) pasa por MetaMask. En tokens con comision de transferencia
   se usan las variantes SupportingFeeOnTransferTokens, que respetan el minimo de
   salida (anti slippage): si el pool da menos del minimo, la tx revierte y no se
   pierde nada. */

import { cuentaActual, proveedorActivo } from '../../assets/js/wallet.js?v=129';

const USDT = '0x55d398326f99059fF775485246999027B3197955';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const RPC = 'https://bsc-rpc.publicnode.com';

export const GAS_RESERVE_USD = 1;           // cuanto BNB se deja SIEMPRE para gas (en USD)
const RESERVA_MIN_BNB = 0.0015;             // suelo: alcanza para unas cuantas firmas
const RESERVA_MAX_BNB = 0.01;               // techo: no reservar de mas

const ABI_ROUTER = [
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable'
];
const ABI_ERC20 = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

let _ethers = null;
async function E() {
  if (!_ethers) _ethers = await import('../../assets/js/vendor/ethers-6.13.4.min.js?v=126');
  return _ethers;
}
let _lector = null;
async function lector() {
  const ethers = await E();
  if (!_lector) _lector = new ethers.JsonRpcProvider(RPC, 56, { staticNetwork: true });
  return _lector;
}
async function _signer() {
  const ethers = await E();
  const prov = new ethers.BrowserProvider(proveedorActivo ? (proveedorActivo() || window.ethereum) : window.ethereum);
  return prov.getSigner();
}

const low = (a) => String(a || '').toLowerCase();
const esNativo = (t) => !t || !!t.nativo;                            // BNB nativo = flag explicito
const dir = (t) => esNativo(t) ? WBNB : t.addr;                      // en la ruta, BNB va como WBNB
const conSlip = (out, bps) => out - (out * BigInt(Math.max(0, Math.min(5000, bps | 0))) / 10000n);

/* Mejor ruta (directa, via WBNB o via USDT) y su salida estimada, para el minimo anti slippage. */
async function mejorRuta(router, from, to, amountIn) {
  const f = low(from), t = low(to);
  const cand = [[from, to]];
  if (![f, t].includes(low(WBNB))) cand.push([from, WBNB, to]);
  if (![f, t].includes(low(USDT))) cand.push([from, USDT, to]);
  const res = await Promise.all(cand.map(async (path) => {
    try { const a = await router.getAmountsOut(amountIn, path); return { path, out: a[a.length - 1] }; } catch (_) { return null; }
  }));
  let best = null;
  for (const r of res) if (r && r.out > 0n && (!best || r.out > best.out)) best = r;
  return best;
}

async function balanceRaw(ethers, prov, cuenta, t) {
  if (esNativo(t)) return prov.getBalance(cuenta);
  return new ethers.Contract(t.addr, ABI_ERC20, prov).balanceOf(cuenta);
}

/* BNB (en wei) que se reserva SIEMPRE para gas: ~GAS_RESERVE_USD en BNB, acotado. */
async function reservaGasWei(ethers, router) {
  let bnbUsd = 0;
  try { const a = await router.getAmountsOut(ethers.parseEther('1'), [WBNB, USDT]); bnbUsd = Number(ethers.formatUnits(a[a.length - 1], 18)); } catch (_) {}
  let bnb = bnbUsd > 0 ? (GAS_RESERVE_USD / bnbUsd) : RESERVA_MAX_BNB;
  bnb = Math.max(RESERVA_MIN_BNB, Math.min(RESERVA_MAX_BNB, bnb));
  return ethers.parseEther(bnb.toFixed(18));
}

/* Preflight: cuanto BNB hay y cuanto se reserva. La UI lo usa para avisar antes de empezar. */
export async function revisarGas(cuenta) {
  cuenta = cuenta || (cuentaActual && cuentaActual());
  const ethers = await E(); const prov = await lector();
  const router = new ethers.Contract(ROUTER, ABI_ROUTER, prov);
  const [bnbWei, reservaWei] = await Promise.all([prov.getBalance(cuenta), reservaGasWei(ethers, router)]);
  return { bnbWei, reservaWei, bnb: Number(ethers.formatEther(bnbWei)), reserva: Number(ethers.formatEther(reservaWei)), ok: bnbWei > reservaWei };
}

/* Un swap: aprueba el router si hace falta (max, 1 sola vez por token) y ejecuta la variante
   correcta segun si entra/sale BNB nativo. Devuelve el hash. amountInRaw ya viene acotado. */
async function swapUno(ethers, prov, signer, cuenta, from, to, amountInRaw, slippageBps) {
  const routerR = new ethers.Contract(ROUTER, ABI_ROUTER, prov);     // cotiza por lector (rapido)
  const r = await mejorRuta(routerR, dir(from), dir(to), amountInRaw);
  if (!r) { const e = new Error('SIN_RUTA'); e.code = 'SIN_RUTA'; throw e; }
  const minOut = conSlip(r.out, slippageBps);
  const deadline = Math.floor(Date.now() / 1000) + 300;
  const routerW = new ethers.Contract(ROUTER, ABI_ROUTER, signer);   // FIRMA por MetaMask
  if (esNativo(from)) {
    const tx = await routerW.swapExactETHForTokensSupportingFeeOnTransferTokens(minOut, r.path, cuenta, deadline, { value: amountInRaw });
    await tx.wait(); return tx.hash;
  }
  // ERC20 de entrada: permiso al router (una vez) y luego swap
  const erc = new ethers.Contract(from.addr, ABI_ERC20, prov);
  const act = await erc.allowance(cuenta, ROUTER);
  if (act < amountInRaw) { const ercW = new ethers.Contract(from.addr, ABI_ERC20, signer); const txA = await ercW.approve(ROUTER, ethers.MaxUint256); await txA.wait(); }
  const tx = esNativo(to)
    ? await routerW.swapExactTokensForETHSupportingFeeOnTransferTokens(amountInRaw, minOut, r.path, cuenta, deadline)
    : await routerW.swapExactTokensForTokensSupportingFeeOnTransferTokens(amountInRaw, minOut, r.path, cuenta, deadline);
  await tx.wait(); return tx.hash;
}

/* Recolecta: cambia cada fuente al destino, una por una. Aplica la reserva de gas al BNB.
   fuentes/destino: { addr, nativo, sim }. onPaso(ev) informa el avance a la UI:
     {fase:'swap', sim, i, n} | {fase:'ok', sim, hash} | {fase:'skip', sim, motivo} | {fase:'fail', sim, msg}
   Devuelve { hechos, saltadas:[{sim,motivo}], fallos:[{sim,msg}], cancelado }. */
export async function recolectar({ fuentes, destino, cuenta, slippageBps = 500, onPaso } = {}) {
  cuenta = cuenta || (cuentaActual && cuentaActual());
  if (!cuenta) throw new Error('Sin wallet.');
  if (!destino || !Array.isArray(fuentes) || !fuentes.length) throw new Error('Nada que recolectar.');
  const ethers = await E(); const prov = await lector(); const signer = await _signer();
  const router = new ethers.Contract(ROUTER, ABI_ROUTER, prov);
  const reservaWei = await reservaGasWei(ethers, router);
  const avisa = (ev) => { try { onPaso && onPaso(ev); } catch (_) {} };

  const hechos = []; const saltadas = []; const fallos = []; let cancelado = false;
  const dest = low(dir(destino));
  const lista = fuentes.filter((f) => low(dir(f)) !== dest);      // nunca cambiar el destino hacia si mismo
  let i = 0;
  for (const f of lista) {
    i++;
    const sim = f.sim || '?';
    try {
      let amountIn = await balanceRaw(ethers, prov, cuenta, f);
      if (!(amountIn > 0n)) { saltadas.push({ sim, motivo: 'sin saldo' }); avisa({ fase: 'skip', sim, motivo: 'sin saldo' }); continue; }
      if (esNativo(f)) {
        // BNB: dejar SIEMPRE la reserva de gas. Nunca el 100%.
        amountIn = amountIn - reservaWei;
        if (!(amountIn > 0n)) { saltadas.push({ sim, motivo: 'reserva de gas' }); avisa({ fase: 'skip', sim, motivo: 'reserva de gas' }); continue; }
      }
      avisa({ fase: 'swap', sim, i, n: lista.length });
      const hash = await swapUno(ethers, prov, signer, cuenta, f, destino, amountIn, slippageBps);
      hechos.push({ sim, hash }); avisa({ fase: 'ok', sim, hash });
    } catch (e) {
      const msg = String((e && (e.shortMessage || e.reason || e.message)) || e);
      if (/reject|denied|cancel|user denied|4001/i.test(msg)) { cancelado = true; avisa({ fase: 'cancel', sim }); break; }
      fallos.push({ sim, msg }); avisa({ fase: 'fail', sim, msg });
    }
  }
  return { hechos: hechos.length, detalleHechos: hechos, saltadas, fallos, cancelado };
}
