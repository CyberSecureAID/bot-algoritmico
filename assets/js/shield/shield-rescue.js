/* shield-rescue.js — Emergency Kill Switch.
   En una emergencia (wallet comprometida o migración), mueve TODOS los tokens
   con saldo a una wallet segura que el usuario designa. NO custodia claves ni
   fondos: cada transferencia la firma el usuario en su wallet. Reserva gas para
   que las transacciones puedan ejecutarse. Muestra token, monto y destino antes
   de firmar (nada oculto). */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';

const BSCSCAN = 'https://api.bscscan.com/api';
const BSCSCAN_KEY = 'YourApiKeyToken';
const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io', 'https://bsc-dataseed1.ninicoin.io'];
const ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];
// reservar ~0.001 BNB para gas (no vaciar el nativo del todo)
const RESERVA_GAS = ethers.parseEther('0.0015');

let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
function inyectado() { try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); if (p) return p; } catch (_) {} if (window.ethereum) return window.ethereum; throw new Error('no wallet'); }
async function firmante() { return new ethers.BrowserProvider(inyectado()).getSigner(); }

export function esDireccion(s) { return /^0x[0-9a-fA-F]{40}$/.test((s || '').trim()); }

/* Detecta TODOS los tokens con saldo > 0 en la wallet (via BscScan tokentx +
   verificación on-chain del balance real), más el BNB nativo. */
export async function detectarActivos(cuenta, onProgreso) {
  if (!cuenta) return { nativo: 0n, tokens: [] };
  const prov = lector();
  // 1. BNB nativo
  let nativo = 0n;
  try { nativo = await prov.getBalance(cuenta); } catch (_) {}
  if (onProgreso) onProgreso(0.2);

  // 2. lista de tokens que ha tocado la wallet (BscScan tokentx)
  const url = `${BSCSCAN}?module=account&action=tokentx&address=${cuenta}&startblock=0&endblock=latest&sort=desc&apikey=${BSCSCAN_KEY}`;
  let toks = new Map();
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
    const d = await r.json();
    if (d.status === '1' && Array.isArray(d.result)) {
      for (const t of d.result) {
        const a = (t.contractAddress || '').toLowerCase();
        if (a && !toks.has(a)) toks.set(a, { address: a, symbol: t.tokenSymbol || '?', decimals: Number(t.tokenDecimal) || 18 });
      }
    }
  } catch (_) {}
  if (onProgreso) onProgreso(0.5);

  // 3. verificar el balance ACTUAL de cada token (en tandas)
  const lista = [...toks.values()];
  const conSaldo = [];
  for (let i = 0; i < lista.length; i += 8) {
    const tanda = lista.slice(i, i + 8);
    const res = await Promise.all(tanda.map(async (t) => {
      try {
        const c = new ethers.Contract(t.address, ABI, prov);
        const bal = await c.balanceOf(cuenta);
        if (bal === 0n) return null;
        return { ...t, balance: bal, balanceFmt: ethers.formatUnits(bal, t.decimals) };
      } catch (_) { return null; }
    }));
    conSaldo.push(...res.filter(Boolean));
    if (onProgreso) onProgreso(0.5 + 0.5 * ((i + 8) / Math.max(lista.length, 1)));
  }
  if (onProgreso) onProgreso(1);
  return { nativo, tokens: conSaldo };
}

/* Transfiere UN token al destino. La firma el usuario. */
export async function moverToken(tokenAddr, destino, monto) {
  const c = new ethers.Contract(tokenAddr, ABI, await firmante());
  const tx = await c.transfer(destino, monto);
  return tx.wait();
}

/* Transfiere el BNB nativo (dejando reserva de gas). La firma el usuario. */
export async function moverNativo(destino, saldoNativo) {
  const enviar = saldoNativo - RESERVA_GAS;
  if (enviar <= 0n) throw new Error('saldo insuficiente tras reservar gas');
  const s = await firmante();
  const tx = await s.sendTransaction({ to: destino, value: enviar });
  return tx.wait();
}

export const reservaGasFmt = ethers.formatEther(RESERVA_GAS);
