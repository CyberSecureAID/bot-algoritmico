/* shield-datos.js — Capa de datos de Wallet Shield.
   Lee los approvals (permisos) de la wallet conectada desde BscScan, verifica
   el allowance actual on-chain, y prepara las transacciones de revoke.
   NO custodia claves: el revoke lo firma el usuario en su wallet. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=129';

const BSCSCAN = 'https://api.etherscan.io/v2/api';
// API key pública de BscScan (solo lectura). Se puede rotar desde aquí.
const BSCSCAN_KEY = 'TZQ4M8PRW6J794MWDB1D2WM3FPVVC6NKB6';  // Etherscan V2 (sirve BSC con chainid=56). El viejo api.bscscan.com bloqueaba CORS.
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
      // NodeReal acepta 10000 bloques por eth_getLogs. Recorremos hacia atrás en
      // ventanas de 10k en paralelo (por lotes) para que sea rápido. Cubrimos ~4M
      // bloques (unos 5 meses), suficiente para los approvals vigentes.
      const VENT = 10000; const TOTAL_VENTANAS = 400;   // 4M bloques
      const rangos = [];
      for (let k = 0; k < TOTAL_VENTANAS; k++) {
        const hasta = actual - k * VENT; const desde = hasta - VENT;
        if (desde < 0) break;
        rangos.push({ desde, hasta });
      }
      // ejecutar en lotes de 8 llamadas paralelas
      for (let i = 0; i < rangos.length; i += 8) {
        const lote = rangos.slice(i, i + 8);
        const resultados = await Promise.all(lote.map(function (r) {
          return nrCall('eth_getLogs', [{ fromBlock: '0x' + r.desde.toString(16), toBlock: '0x' + r.hasta.toString(16), topics: [topicApproval, ownerTopic] }]).catch(function () { return []; });
        }));
        for (const parte of resultados) { if (Array.isArray(parte) && parte.length) logs = logs.concat(parte); }
        if (onProgreso) onProgreso(0.15 + 0.3 * (i / rangos.length));
        if (logs.length > 400) break;
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
  metamask: `<svg  viewBox="0 0 32 32" width="24" height="24"><path fill="#E17726" d="M28.6 3.4 17.8 11.4l2-4.7z"/><path fill="#E27625" d="m3.4 3.4 10.7 8.1-1.9-4.8zM24.4 21.7l-2.9 4.4 6.2 1.7 1.8-6z"/><path fill="#E27625" d="m2.6 21.8 1.7 6 6.2-1.7-2.9-4.4z"/><path fill="#E27625" d="m10.1 14.5-1.7 2.6 6.1.3-.2-6.6zM21.9 14.5l-4.3-3.8-.1 6.7 6.1-.3zM10.5 26.1l3.7-1.8-3.2-2.5zM17.8 24.3l3.7 1.8-.5-4.3z"/><path fill="#D5BFB2" d="m21.5 26.1-3.7-1.8.3 2.4v1zM10.5 26.1l3.4.6v-1l.3-2.4z"/><path fill="#233447" d="m14 20.3-3.1-.9 2.2-1zM18 20.3l.9-1.9 2.2 1z"/><path fill="#CC6228" d="m10.5 26.1.5-4.4-3.4.1zM21 21.7l.5 4.4 2.9-4.3zM23.6 17.1l-6.1.3.6 3.1.9-1.9 2.2 1zM10.9 19.6l2.2-1 .9 1.9.6-3.1-6.2-.3z"/><path fill="#E27525" d="m8.4 17.1 2.6 5-.1-2.5zM21.2 19.6l-.1 2.5 2.6-5zM14.6 17.4l-.6 3.1.8 4 .2-5.3zM17.5 17.4l-.4 1.8.1 5.3.8-4z"/><path fill="#F5841F" d="m18 20.3-.8 4 .6.4 3.2-2.5.1-2.5zM10.9 19.6l.1 2.5 3.2 2.5.6-.4-.8-4z"/><path fill="#C0AC9D" d="m18.1 27.5v-1l-.3-.2h-3.6l-.3.2v1l-3.4-.6 1.2 1 2.4 1.7h3.7l2.5-1.7 1.2-1z"/><path fill="#161616" d="m17.8 24.3-.6-.4h-2.4l-.6.4-.3 2.4.3-.2h3.6l.3.2z"/><path fill="#763E1A" d="m29.1 11.9.9-4.4-1.4-4.1-11 8.1 4.3 3.6 6 1.8 1.3-1.5-.6-.4 1-.9-.7-.6 1-.7zM2 7.5l.9 4.4-.6.4 1 .7-.7.6.9.9-.6.4 1.3 1.5 6-1.8 4.3-3.6-11-8.1z"/><path fill="#F5841F" d="m28 15.1-6-1.8 1.8 2.7-2.6 5 3.5-.1h5.1zM10.1 13.3l-6 1.8-1.8 5.8h5.1l3.5.1-2.6-5zM17.5 17.4l.4-6.6 1.7-4.6h-7.3l1.7 4.6.4 6.6.2 2.1v5.2h2.4l.1-5.2z"/></svg>`,
  trust:    `<svg  viewBox="0 0 32 32" width="24" height="24"><path fill="#3375BB" d="M16 2 5 6.3v8.4c0 6.9 4.6 13.3 11 15.3 6.4-2 11-8.4 11-15.3V6.3z"/><path fill="#fff" d="M16 6.6v18.9c4.6-1.6 8-6.5 8-11.6V8.6z"/></svg>`,
  binance:  `<svg  viewBox="0 0 32 32" width="24" height="24"><path fill="#F0B90B" d="m16 4 3 3-6 6-3-3zM22 10l3 3-9 9-3-3zM10 10l3 3-3 3-3-3zM16 19l3 3-3 3-3-3z"/></svg>`,
  coinbase: `<svg  viewBox="0 0 32 32" width="24" height="24"><circle cx="16" cy="16" r="14" fill="#0052FF"/><rect x="11" y="11" width="10" height="10" rx="2" fill="#fff"/></svg>`,
  phantom:  `<svg  viewBox="0 0 32 32" width="24" height="24"><circle cx="16" cy="16" r="14" fill="#AB9FF2"/><ellipse cx="12" cy="15" rx="2" ry="3" fill="#fff"/><ellipse cx="20" cy="15" rx="2" ry="3" fill="#fff"/></svg>`,
  rabby:    `<svg  viewBox="0 0 32 32" width="24" height="24"><circle cx="16" cy="16" r="14" fill="#7084F5"/><path fill="#fff" d="M9 18c3-5 11-7 14-4-2 4-9 7-14 4z"/></svg>`
};

/* ── Info de la wallet conectada (nombre + icono/logo real) ──
   Detecta el logo igual que la app: primero el icono que envía la wallet,
   si no, mira window.ethereum (MetaMask en escritorio no siempre lo envía). */
export function infoWallet() {
  let info = null;
  try { info = wallet.walletInfo ? wallet.walletInfo() : null; } catch (_) {}
  const cuenta = (wallet.cuentaActual && wallet.cuentaActual()) || (info && info.cuenta) || null;
  // 1) icono que trae la propia wallet (EIP-6963)
  if (info && info.icon) return { nombre: info.name || 'Wallet', iconoHTML: `<img src="${info.icon}" alt="" style="width:100%;height:100%;object-fit:cover">`, cuenta };
  // 1.5) icono REAL de la wallet desde la lista EIP-6963 que ella misma anuncia,
  //      aunque la auto-reconexion no haya guardado est.info (ese era el bug).
  try {
    const lista = (wallet.walletsDisponibles && wallet.walletsDisponibles()) || [];
    const conIcono = lista.filter((w) => w && w.icono);
    let d = conIcono.find((w) => w.activa);
    if (!d && info && info.clave) d = conIcono.find((w) => String(w.id || '').includes(info.clave));
    if (!d) {
      const p = window.ethereum;
      const cual = p && (p.isTrust || p.isTrustWallet ? 'trust' : p.isPhantom ? 'phantom' : p.isCoinbaseWallet ? 'coinbase' : p.isRabby ? 'rabby' : p.isMetaMask ? 'metamask' : '');
      if (cual) d = conIcono.find((w) => String(w.id || '').includes(cual));
    }
    if (!d && conIcono.length === 1) d = conIcono[0];
    if (d && d.icono) return { nombre: d.nombre || (info && info.name) || 'Wallet', iconoHTML: `<img src="${d.icono}" alt="" style="width:100%;height:100%;object-fit:cover">`, cuenta };
  } catch (_) {}
  // 2) usar la CLAVE que walletInfo() ya detectó (trust, metamask, etc.). Es más
  //    fiable que leer window.ethereum.isTrust, que en el navegador de la wallet
  //    a veces no está marcado (por eso antes salía el escudo en vez del logo).
  if (info && info.clave && LOGOS[info.clave]) {
    return { nombre: info.name || (info.clave.charAt(0).toUpperCase() + info.clave.slice(1)), iconoHTML: LOGOS[info.clave], cuenta };
  }
  // 3) respaldo: detectar por el proveedor (window.ethereum)
  try {
    const p = window.ethereum;
    if (p) {
      const cual = p.isTrust || p.isTrustWallet ? 'trust' : p.isPhantom ? 'phantom' : p.isCoinbaseWallet ? 'coinbase' : p.isBinance ? 'binance' : p.isRabby ? 'rabby' : p.isMetaMask ? 'metamask' : null;
      if (cual && LOGOS[cual]) return { nombre: cual.charAt(0).toUpperCase() + cual.slice(1), iconoHTML: LOGOS[cual], cuenta };
    }
  } catch (_) {}
  // 4) último recurso: nombre sin icono (shield usará su icono por defecto)
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
    let toks = new Map();
    // Tokens principales de BSC: se revisan SIEMPRE on-chain, aunque Etherscan no responda.
    const COMUNES = {
      '0x55d398326f99059ff775485246999027b3197955': 18, // USDT
      '0xe9e7cea3dedca5984780bafc599bd69add087d56': 18, // BUSD
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 18, // USDC
      '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82': 18, // CAKE
      '0x2170ed0880ac9a755fd29b2688956bd959f933f8': 18, // ETH
      '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c': 18, // BTCB
      '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3': 18  // DAI
    };
    for (const a in COMUNES) toks.set(a, { address: a, decimals: COMUNES[a] });
    // Etherscan tokentx: AÑADE otros tokens que la wallet haya movido (si responde).
    const url = `${BSCSCAN}?chainid=56&module=account&action=tokentx&address=${cuenta}&page=1&offset=1000&sort=desc&apikey=${BSCSCAN_KEY}`;
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
