/* shield-pago.js — Puente con los contratos de Wallet Shield (cobro de acceso).
   Verifica si la wallet tiene acceso pagado, muestra el precio en BNB, y ejecuta
   la compra ($5/30 días) llamando a comprarAcceso. También expone el gas faucet. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';

// Contratos desplegados (proxy)
export const WALLETSHIELD = '0x24E34b95dBd7786b0d11E00e7FA256A8763B6D05';
export const GASFAUCET    = '0x71763E9Ad60d3D2Baa833496F8b4f8eeD497B65F';
const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io'];

const ABI_SHIELD = [
  'function tieneAcceso(address) view returns (bool)',
  'function precioBNB() view returns (uint256)',
  'function precioUSD_() view returns (uint256)',
  'function expiraEn(address) view returns (uint40)',
  'function esOwner(address) view returns (bool)',
  'function comprarAcceso() payable'
];
const ABI_FAUCET = [
  'function puedeReclamar(address) view returns (bool)',
  'function proximoReclamo(address) view returns (uint256)',
  'function montoFaucetWei() view returns (uint256)',
  'function saldoPozo() view returns (uint256)',
  'function reclamarFaucet()'
];

let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
function inyectado() { try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); if (p) return p; } catch (_) {} if (window.ethereum) return window.ethereum; throw new Error('no wallet'); }
async function firmante() { return new ethers.BrowserProvider(inyectado()).getSigner(); }

/* ── ¿La wallet tiene acceso activo? (owners siempre sí) ── */
export async function tieneAcceso(cuenta) {
  if (!cuenta) return false;
  try { const c = new ethers.Contract(WALLETSHIELD, ABI_SHIELD, lector()); return await c.tieneAcceso(cuenta); }
  catch (_) { return false; }
}

/* ── Info para la pantalla de pago: precio en BNB y USD, si es owner, cuándo expira ── */
export async function infoAcceso(cuenta) {
  const out = { precioBNB: 0n, precioBNBtxt: '—', precioUSD: '5', esOwner: false, expira: 0, tiene: false };
  try {
    const c = new ethers.Contract(WALLETSHIELD, ABI_SHIELD, lector());
    const [pBNB, pUSD, owner, exp, tiene] = await Promise.all([
      c.precioBNB().catch(() => 0n),
      c.precioUSD_().catch(() => 500n),
      c.esOwner(cuenta).catch(() => false),
      c.expiraEn(cuenta).catch(() => 0),
      c.tieneAcceso(cuenta).catch(() => false)
    ]);
    out.precioBNB = pBNB;
    out.precioBNBtxt = pBNB > 0n ? Number(ethers.formatEther(pBNB)).toLocaleString(undefined, { maximumFractionDigits: 5 }) : '—';
    out.precioUSD = (Number(pUSD) / 100).toFixed(2);
    out.esOwner = owner;
    out.expira = Number(exp) * 1000;
    out.tiene = tiene;
  } catch (_) {}
  return out;
}

/* ── Comprar 30 días de acceso (paga en BNB). La firma el usuario. ── */
export async function comprarAcceso() {
  const c = new ethers.Contract(WALLETSHIELD, ABI_SHIELD, await firmante());
  const precio = await c.precioBNB();
  const tx = await c.comprarAcceso({ value: precio });
  return tx.wait();
}

/* ── Gas Faucet: info y reclamo ── */
export async function infoFaucet(cuenta) {
  const out = { puede: false, proximo: 0, monto: '0', montoWei: 0n, pozo: '0' };
  try {
    const c = new ethers.Contract(GASFAUCET, ABI_FAUCET, lector());
    const [puede, prox, monto, pozo] = await Promise.all([
      c.puedeReclamar(cuenta).catch(() => false),
      c.proximoReclamo(cuenta).catch(() => 0),
      c.montoFaucetWei().catch(() => 0n),
      c.saldoPozo().catch(() => 0n)
    ]);
    out.puede = puede;
    out.proximo = Number(prox) * 1000;
    out.montoWei = monto;
    out.monto = Number(ethers.formatEther(monto)).toLocaleString(undefined, { maximumFractionDigits: 6 });
    out.pozo = Number(ethers.formatEther(pozo)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch (_) {}
  return out;
}

export async function reclamarFaucet() {
  const c = new ethers.Contract(GASFAUCET, ABI_FAUCET, await firmante());
  const tx = await c.reclamarFaucet();
  return tx.wait();
}
