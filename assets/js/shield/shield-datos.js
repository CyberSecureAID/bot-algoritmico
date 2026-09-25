/* shield-datos.js — Capa de datos de Wallet Shield.
   Lee los approvals (permisos) de la wallet conectada desde BscScan, verifica
   el allowance actual on-chain, y prepara las transacciones de revoke.
   NO custodia claves: el revoke lo firma el usuario en su wallet. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';

const BSCSCAN = 'https://api.bscscan.com/api';
// API key pública de BscScan (solo lectura). Se puede rotar desde aquí.
const BSCSCAN_KEY = 'YourApiKeyToken';  // BscScan permite lecturas básicas sin key con límite
const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io', 'https://bsc-dataseed1.ninicoin.io'];

// NUESTROS contratos: los permisos hacia ellos se marcan como CONFIABLES.
export const NUESTROS = {
  '0x4e86430bc2260fe359d1ea7eef8b595fb241f93b': 'CriptoCuba Bots & Swap',
  '0x39c48394068299aa3e3ab114f16bfc3de11f4112': 'CriptoCuba Token Listing',
  '0x17b47a8fb97f8980b96c94e4b9137182e0bf8025': 'CriptoCuba P2P Market',
  '0xdc4802d8871cef57a34e4e0e3b1a87226a4a84c4': 'CriptoCuba Staking'
};

const ABI_ERC20 = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)'
];
const MAX_UINT = (2n ** 256n) - 1n;

let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
function inyectado() { try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); if (p) return p; } catch (_) {} if (window.ethereum) return window.ethereum; throw new Error('no wallet'); }
async function firmante() { return new ethers.BrowserProvider(inyectado()).getSigner(); }

/* ── Escanear los approvals de una wallet ──
   Lee los eventos Approval de BscScan, deduplica por (token, spender),
   y verifica el allowance ACTUAL on-chain (solo muestra los activos). */
export async function escanearApprovals(cuenta, onProgreso) {
  if (!cuenta) return [];
  // 1. traer los logs de eventos Approval donde owner = cuenta
  //    topic0 = keccak(Approval(address,address,uint256)), topic1 = owner
  const topicApproval = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
  const ownerTopic = '0x000000000000000000000000' + cuenta.slice(2).toLowerCase();
  const url = `${BSCSCAN}?module=logs&action=getLogs&fromBlock=0&toBlock=latest&topic0=${topicApproval}&topic1=${ownerTopic}&apikey=${BSCSCAN_KEY}`;
  let logs = [];
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
    const d = await r.json();
    if (d.status === '1' && Array.isArray(d.result)) logs = d.result;
  } catch (_) {}
  if (onProgreso) onProgreso(0.35);

  // 2. deduplicar por (token, spender) — el último approval manda
  const pares = new Map();
  for (const log of logs) {
    const token = (log.address || '').toLowerCase();
    // spender está en topic2
    const spender = log.topics && log.topics[2] ? ('0x' + log.topics[2].slice(26)).toLowerCase() : null;
    if (!token || !spender) continue;
    pares.set(token + ':' + spender, { token, spender });
  }
  if (onProgreso) onProgreso(0.55);

  // 3. verificar el allowance ACTUAL on-chain (en tandas) y leer símbolo/decimales
  const lista = [...pares.values()];
  const activos = [];
  const prov = lector();
  for (let i = 0; i < lista.length; i += 8) {
    const tanda = lista.slice(i, i + 8);
    const res = await Promise.all(tanda.map(async (p) => {
      try {
        const c = new ethers.Contract(p.token, ABI_ERC20, prov);
        const [allow, sym, dec] = await Promise.all([
          c.allowance(cuenta, p.spender),
          c.symbol().catch(() => '?'),
          c.decimals().catch(() => 18)
        ]);
        if (allow === 0n) return null; // revocado o sin permiso: no mostrar
        return {
          token: p.token, spender: p.spender, symbol: String(sym), decimals: Number(dec),
          allowance: allow, ilimitado: allow > (MAX_UINT / 2n),
          nuestro: !!NUESTROS[p.spender], nombreNuestro: NUESTROS[p.spender] || null
        };
      } catch (_) { return null; }
    }));
    activos.push(...res.filter(Boolean));
    if (onProgreso) onProgreso(0.55 + 0.4 * ((i + 8) / Math.max(lista.length, 1)));
  }
  if (onProgreso) onProgreso(1);
  // ordenar: primero los peligrosos (ilimitados externos), luego el resto, los nuestros al final
  activos.sort((a, b) => {
    if (a.nuestro !== b.nuestro) return a.nuestro ? 1 : -1;
    if (a.ilimitado !== b.ilimitado) return a.ilimitado ? -1 : 1;
    return 0;
  });
  return activos;
}

/* ── Revocar un permiso: approve(spender, 0). Lo firma el usuario. ── */
export async function revocar(token, spender) {
  const c = new ethers.Contract(token, ABI_ERC20, await firmante());
  const tx = await c.approve(spender, 0);
  return tx.wait();
}

/* ── Info de la wallet conectada (nombre + icono real) ── */
export function infoWallet() {
  try { return wallet.walletInfo(); } catch (_) { return { nombre: 'Wallet', icono: '', cuenta: null }; }
}
