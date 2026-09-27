/* shield-datos.js — Capa de datos de Wallet Shield.
   Lee los approvals (permisos) de la wallet conectada desde BscScan, verifica
   el allowance actual on-chain, y prepara las transacciones de revoke.
   NO custodia claves: el revoke lo firma el usuario en su wallet. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';

const BSCSCAN = 'https://api.bscscan.com/api';
// API key pública de BscScan (solo lectura). Se puede rotar desde aquí.
const BSCSCAN_KEY = 'BUS6DPJ84DWQ1N9XCN8PIUHTNFM5TXE2HU';  // BscScan permite lecturas básicas sin key con límite
const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io', 'https://bsc-dataseed1.ninicoin.io'];
const NR_KEY = '0b80831c8c694568a11b6d72a580b81b';
const NR_RPC = 'https://bsc-mainnet.nodereal.io/v1/' + NR_KEY;
async function nrCall(method, params) {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
  const r = await fetch(NR_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctrl.signal });
  clearTimeout(to);
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'nr error');
  return d.result;
}

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
const RPCS_LOG = ['https://bsc-dataseed.binance.org','https://bsc-dataseed1.defibit.io','https://bsc.publicnode.com','https://binance.llamarpc.com'];
async function rpcLogs(params) {
  for (const url of RPCS_LOG) {
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getLogs', params: [params] }), signal: ctrl.signal });
      clearTimeout(to);
      const d = await r.json();
      if (Array.isArray(d.result)) return d.result;
    } catch (_) {}
  }
  return [];
}

let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
function inyectado() { try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); if (p) return p; } catch (_) {} if (window.ethereum) return window.ethereum; throw new Error('no wallet'); }
async function firmante() { return new ethers.BrowserProvider(inyectado()).getSigner(); }

/* ── Escanear los approvals de una wallet ──
   Lee los eventos Approval de BscScan, deduplica por (token, spender),
   y verifica el allowance ACTUAL on-chain (solo muestra los activos). */
export async function escanearApprovals(cuenta, onProgreso) {
  if (!cuenta) return [];
  const topicApproval = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
  const ownerTopic = '0x000000000000000000000000' + cuenta.slice(2).toLowerCase();
  if (onProgreso) onProgreso(0.15);
  let diag = { fuente: '', crudos: 0 };

  // eth_getLogs al RPC de NodeReal (con key): los nodos premium SÍ permiten rangos
  // amplios para logs filtrados por topic. Es la vía fiable tras la muerte de BscScan.
  let logs = [];
  try {
    // bloque actual
    let actual = 0;
    try { const bn = await nrCall('eth_blockNumber', []); actual = parseInt(bn, 16); } catch (_) {}
    if (actual) {
      diag.fuente = 'nodereal-logs'; diag.bloqueActual = actual;
      // Detectar el tamaño de ventana que NodeReal acepta: probar de mayor a menor.
      // Muchos planes limitan a 50000, 10000 o 5000 bloques por eth_getLogs.
      const TAMANOS = [50000, 10000, 5000];
      let VENT = 0;
      for (const t of TAMANOS) {
        try {
          const prueba = await nrCall('eth_getLogs', [{ fromBlock: '0x' + (actual - t).toString(16), toBlock: '0x' + actual.toString(16), topics: [topicApproval, ownerTopic] }]);
          VENT = t; diag.ventana = t;
          if (Array.isArray(prueba) && prueba.length) logs = logs.concat(prueba);
          break;
        } catch (e) { diag.errPrueba = ((e&&e.message)||'').slice(0,60); }
      }
      if (!VENT) { diag.fuente = 'all-windows-failed'; }
      else {
        // recorrer hacia atrás con la ventana que funcionó (limitado para no tardar)
        const MAXV = Math.min(200, Math.ceil(4000000 / VENT));
        for (let k = 1; k < MAXV; k++) {
          const hasta = actual - k * VENT; const desde = Math.max(0, hasta - VENT);
          try {
            const parte = await nrCall('eth_getLogs', [{ fromBlock: '0x' + desde.toString(16), toBlock: '0x' + hasta.toString(16), topics: [topicApproval, ownerTopic] }]);
            if (Array.isArray(parte) && parte.length) logs = logs.concat(parte);
          } catch (_) {}
          if (desde === 0) break;
          if (logs.length > 300) break;
        }
      }
    } else { diag.fuente = 'no-block'; }
  } catch (e) { diag.fuente = 'fail:' + ((e&&e.message)||'').slice(0,40); }
  diag.crudos = logs.length;
  if (onProgreso) onProgreso(0.5);

  // deduplicar por (token, spender)
  const pares = new Map();
  for (const log of logs) {
    const token = (log.address || '').toLowerCase();
    const spender = log.topics && log.topics[2] ? ('0x' + log.topics[2].slice(26)).toLowerCase() : null;
    if (!token || !spender) continue;
    pares.set(token + ':' + spender, { token, spender });
  }
  if (onProgreso) onProgreso(0.6);

  // verificar el allowance ACTUAL on-chain
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
        if (allow === 0n) return null;
        return {
          token: p.token, spender: p.spender, symbol: String(sym), decimals: Number(dec),
          allowance: allow, ilimitado: allow > (MAX_UINT / 2n),
          nuestro: !!NUESTROS[p.spender], nombreNuestro: NUESTROS[p.spender] || null
        };
      } catch (_) { return null; }
    }));
    activos.push(...res.filter(Boolean));
    if (onProgreso) onProgreso(0.6 + 0.35 * ((i + 8) / Math.max(lista.length, 1)));
  }
  if (onProgreso) onProgreso(1);
  diag.permisosActivos = activos.length;
  try { window._scanDiag = diag; } catch(_){}
  activos.sort((a, b) => {
    if (a.nuestro !== b.nuestro) return a.nuestro ? 1 : -1;
    if (a.ilimitado !== b.ilimitado) return a.ilimitado ? -1 : 1;
    return 0;
  });
  return activos;
}

export async function revocar(token, spender) {
  const c = new ethers.Contract(token, ABI_ERC20, await firmante());
  const tx = await c.approve(spender, 0);
  return tx.wait();
}

/* ── Logos de wallets (SVG, sin servidores externos) ── */
const LOGOS = {
  metamask: '<svg viewBox="0 0 32 32" width="24" height="24"><path fill="#E17726" d="M28.6 3.4 17.8 11.4l2-4.7z"/><path fill="#E27625" d="m3.4 3.4 10.7 8.1-1.9-4.8zM24.4 21.7l-2.9 4.4 6.2 1.7 1.8-6zM2.6 21.8l1.7 6 6.2-1.7-2.9-4.4z"/><path fill="#E27625" d="m10.1 14.5-1.7 2.6 6.1.3-.2-6.6zM21.9 14.5l-4.3-3.8-.1 6.7 6.1-.3zM10.5 26.1l3.7-1.8-3.2-2.5zM17.8 24.3l3.7 1.8-.5-4.3z"/></svg>',
  trust: '<svg viewBox="0 0 32 32" width="24" height="24"><path fill="#3375BB" d="M16 2 5 6.3v8.4c0 6.9 4.6 13.3 11 15.3 6.4-2 11-8.4 11-15.3V6.3z"/><path fill="#fff" d="M16 6.6v18.9c4.6-1.6 8-6.5 8-11.6V8.6z"/></svg>',
  binance: '<svg viewBox="0 0 32 32" width="24" height="24"><path fill="#F0B90B" d="m16 4 3 3-6 6-3-3zM22 10l3 3-9 9-3-3zM10 10l3 3-3 3-3-3zM16 19l3 3-3 3-3-3z"/></svg>',
  coinbase: '<svg viewBox="0 0 32 32" width="24" height="24"><circle cx="16" cy="16" r="14" fill="#0052FF"/><rect x="11" y="11" width="10" height="10" rx="2" fill="#fff"/></svg>',
  phantom: '<svg viewBox="0 0 32 32" width="24" height="24"><circle cx="16" cy="16" r="14" fill="#AB9FF2"/><ellipse cx="12" cy="15" rx="2" ry="3" fill="#fff"/><ellipse cx="20" cy="15" rx="2" ry="3" fill="#fff"/></svg>',
  rabby: '<svg viewBox="0 0 32 32" width="24" height="24"><circle cx="16" cy="16" r="14" fill="#7084F5"/><path fill="#fff" d="M9 18c3-5 11-7 14-4-2 4-9 7-14 4z"/></svg>'
};

/* ── Info de la wallet conectada (nombre + icono/logo real) ──
   Detecta el logo igual que la app: primero el icono que envía la wallet,
   si no, mira window.ethereum (MetaMask en escritorio no siempre lo envía). */
export function infoWallet() {
  let info = null;
  try { info = wallet.walletInfo ? wallet.walletInfo() : null; } catch (_) {}
  const cuenta = (wallet.cuentaActual && wallet.cuentaActual()) || (info && info.cuenta) || null;
  // icono que trae la wallet
  if (info && info.icon) return { nombre: info.name || 'Wallet', iconoHTML: `<img src="${info.icon}" alt="" style="width:100%;height:100%;object-fit:cover">`, cuenta };
  // detectar por el proveedor
  try {
    const p = window.ethereum;
    if (p) {
      const cual = p.isTrust || p.isTrustWallet ? 'trust' : p.isPhantom ? 'phantom' : p.isCoinbaseWallet ? 'coinbase' : p.isBinance ? 'binance' : p.isRabby ? 'rabby' : p.isMetaMask ? 'metamask' : null;
      if (cual && LOGOS[cual]) return { nombre: cual.charAt(0).toUpperCase() + cual.slice(1), iconoHTML: LOGOS[cual], cuenta };
    }
  } catch (_) {}
  return { nombre: (info && info.name) || 'Wallet', iconoHTML: '', cuenta };
}

/* ── Saldo TOTAL de la wallet en USD (BNB + todos los tokens) ──
   Usa los balances on-chain y los precios de DeFiLlama (gratis, sin API key). */
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
export async function saldoTotalUSD(cuenta) {
  if (!cuenta) return '—';
  const prov = lector();
  try {
    // 1. detectar tokens con saldo (BscScan tokentx + balance real)
    const url = `${BSCSCAN}?module=account&action=tokentx&address=${cuenta}&startblock=0&endblock=latest&sort=desc&apikey=${BSCSCAN_KEY}`;
    let toks = new Map();
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
      const d = await r.json();
      if (d.status === '1' && Array.isArray(d.result)) for (const t of d.result) { const a = (t.contractAddress||'').toLowerCase(); if (a && !toks.has(a)) toks.set(a, { address: a, decimals: Number(t.tokenDecimal)||18 }); }
    } catch (_) {}
    // 2. balances reales (tandas)
    const lista = [...toks.values()]; const conSaldo = [];
    const ABIb = ['function balanceOf(address) view returns (uint256)'];
    for (let i = 0; i < lista.length; i += 10) {
      const res = await Promise.all(lista.slice(i, i+10).map(async (t) => {
        try { const c = new ethers.Contract(t.address, ABIb, prov); const b = await c.balanceOf(cuenta); if (b === 0n) return null; return { ...t, balance: Number(ethers.formatUnits(b, t.decimals)) }; } catch (_) { return null; }
      }));
      conSaldo.push(...res.filter(Boolean));
    }
    // 3. BNB nativo
    let bnb = 0; try { bnb = Number(ethers.formatEther(await prov.getBalance(cuenta))); } catch (_) {}
    // 4. precios de DeFiLlama (una llamada con todas las direcciones)
    const ids = conSaldo.map(t => 'bsc:' + t.address); ids.push('bsc:' + WBNB);
    let precios = {};
    try {
      const pr = await fetch('https://coins.llama.fi/prices/current/' + ids.join(','));
      const pd = await pr.json(); precios = pd.coins || {};
    } catch (_) {}
    // 5. sumar
    let totalUSD = 0;
    const pBNB = precios['bsc:' + WBNB]; if (pBNB && pBNB.price) totalUSD += bnb * pBNB.price;
    for (const t of conSaldo) { const pk = precios['bsc:' + t.address]; if (pk && pk.price) totalUSD += t.balance * pk.price; }
    return '$' + totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch (_) { return '—'; }
}
/* ── Copiar al portapapeles ── */
export async function copiar(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch (_) { return false; }
}
