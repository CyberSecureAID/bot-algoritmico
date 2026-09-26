/* shield-watch.js — Wallet Watcher (datos reales via Alchemy demo, sin API key).
   Ve TODOS los tokens de cualquier wallet, su balance total, su historial de
   operaciones con hash, y logos. Usa el endpoint público de Alchemy (docs-demo)
   que no requiere registro. Precios y logos de DeFiLlama como refuerzo. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';

const ALCHEMY = 'https://bnb-mainnet.g.alchemy.com/v2/docs-demo';   // demo público, sin key
const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io'];
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
export function esDireccion(s) { return /^0x[0-9a-fA-F]{40}$/.test((s || '').trim()); }

async function alchemy(method, params) {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 18000);
  const r = await fetch(ALCHEMY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctrl.signal });
  clearTimeout(to);
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'alchemy error');
  return d.result;
}

const _metaCache = {};
async function metadata(addr) {
  if (_metaCache[addr]) return _metaCache[addr];
  try {
    const m = await alchemy('alchemy_getTokenMetadata', [addr]);
    const info = { symbol: m.symbol || '?', name: m.name || '', decimals: (m.decimals != null ? m.decimals : 18), logo: m.logo || null };
    _metaCache[addr] = info; return info;
  } catch (_) { return { symbol: '?', name: '', decimals: 18, logo: null }; }
}

/* ── Todos los tokens de una wallet (MÚLTIPLES fuentes) ──
   Fuente 1: BscScan tokentx (con key) → lista de todos los tokens que tocó.
   Fuente 2: Alchemy getTokenBalances → refuerzo.
   Balance real on-chain de cada uno. Precios/logos de DeFiLlama + metadata. */
const ABI_ERC = ['function balanceOf(address) view returns (uint256)','function symbol() view returns (string)','function decimals() view returns (uint8)'];
const RPCS_ALL = ['https://bsc-dataseed.binance.org','https://bsc-dataseed1.defibit.io','https://bsc.publicnode.com','https://binance.llamarpc.com'];
const ALCHEMY_BNB = 'https://bnb-mainnet.g.alchemy.com/v2/docs-demo';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

async function rpcCall(method, params) {
  for (const url of RPCS_ALL) {
    try {
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctrl.signal });
      clearTimeout(to);
      const d = await r.json();
      if (d.result !== undefined) return d.result;
    } catch (_) {}
  }
  return null;
}

export async function tokensDe(addr, onProgreso) {
  if (!esDireccion(addr)) return { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  const prov = lector();
  let nativo = 0; try { nativo = Number(ethers.formatEther(await prov.getBalance(addr))); } catch (_) {}
  if (onProgreso) onProgreso(0.15);

  const encontrados = new Set();
  const DG = { alchemy: 'no probado', getlogs: 'no probado', rpcBalance: 'no probado', descubiertos: 0, conSaldo: 0, err: '' };

  // FUENTE 1: Alchemy getTokenBalances (sin key, demo)
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(ALCHEMY_BNB, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'alchemy_getTokenBalances', params: [addr, 'erc20'] }), signal: ctrl.signal });
    clearTimeout(to);
    const d = await r.json();
    if (d.error) { DG.alchemy = 'ERROR: ' + (d.error.message||'').slice(0,50); }
    else if (d.result && d.result.tokenBalances) { let n=0; for (const b of d.result.tokenBalances) { if (b.tokenBalance && !/^0x0*$/.test(b.tokenBalance)) { encontrados.add((b.contractAddress || '').toLowerCase()); n++; } } DG.alchemy = n + ' tokens'; }
    else DG.alchemy = 'sin tokenBalances';
  } catch (e) { DG.alchemy = 'FALLO: ' + ((e&&e.message)||'').slice(0,40); }
  if (onProgreso) onProgreso(0.35);

  // FUENTE 2: eth_getLogs — eventos Transfer HACIA la wallet
  try {
    const bloqueActual = await rpcCall('eth_blockNumber', []);
    const topicTo = '0x000000000000000000000000' + addr.slice(2).toLowerCase();
    const logs = await rpcCall('eth_getLogs', [{ fromBlock: '0x0', toBlock: bloqueActual || 'latest', topics: [TRANSFER_TOPIC, null, topicTo] }]);
    if (Array.isArray(logs)) { const antes = encontrados.size; for (const lg of logs) { if (lg.address) encontrados.add(lg.address.toLowerCase()); } DG.getlogs = logs.length + ' logs'; }
    else DG.getlogs = 'null (RPC no soporta o limitó)';
  } catch (e) { DG.getlogs = 'FALLO: ' + ((e&&e.message)||'').slice(0,40); }
  DG.descubiertos = encontrados.size;
  if (onProgreso) onProgreso(0.55);

  // balance on-chain + metadata de cada token descubierto
  const lista = [...encontrados];
  const tokens = [];
  for (let i = 0; i < lista.length; i += 12) {
    const tanda = lista.slice(i, i + 12);
    const res = await Promise.all(tanda.map(async (a) => {
      try {
        const c = new ethers.Contract(a, ABI_ERC, prov);
        const b = await c.balanceOf(addr);
        if (b === 0n) return null;
        let dec = 18, sym = '?';
        try { dec = Number(await c.decimals()); } catch (_) {}
        try { sym = await c.symbol(); } catch (_) {}
        return { address: a, symbol: sym, name: '', decimals: dec, balance: Number(ethers.formatUnits(b, dec)), logo: null };
      } catch (_) { return null; }
    }));
    tokens.push(...res.filter(Boolean));
    if (onProgreso) onProgreso(0.55 + 0.3 * ((i + 12) / Math.max(lista.length, 1)));
  }

  // precios + logos
  const ids = tokens.map(t => 'bsc:' + t.address); ids.push('bsc:' + WBNB);
  let precios = {};
  try { for (let i = 0; i < ids.length; i += 100) { const pr = await fetch('https://coins.llama.fi/prices/current/' + ids.slice(i, i+100).join(',')); const pd = await pr.json(); Object.assign(precios, pd.coins || {}); } } catch (_) {}
  let totalUSD = 0; const pBNB = precios['bsc:' + WBNB]; const nativoUSD = pBNB && pBNB.price ? nativo * pBNB.price : 0; totalUSD += nativoUSD;
  for (const t of tokens) { const pk = precios['bsc:' + t.address]; t.precio = pk && pk.price ? pk.price : 0; t.usd = t.balance * t.precio; totalUSD += t.usd; }
  await Promise.all(tokens.slice(0, 40).map(async (t) => { try { const m = await metadata(t.address); if (m.logo) t.logo = m.logo; if ((!t.symbol||t.symbol==='?')&&m.symbol) t.symbol=m.symbol; } catch (_) {} }));
  tokens.sort((a, b) => (b.usd - a.usd) || (b.balance - a.balance));
  DG.conSaldo = tokens.length;
  if (onProgreso) onProgreso(1);
  return { nativo, nativoUSD, tokens, totalUSD, _dg: DG };
}

/* ── Logo de BNB y de tokens (DeFiLlama / Alchemy) ── */
export function logoBNB() { return 'https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png'; }

/* ── Historial (Alchemy getAssetTransfers sin key + eth_getLogs) con hash ── */
export async function historialDe(addr) {
  if (!esDireccion(addr)) return [];
  const ops = [];
  // Alchemy getAssetTransfers (sin key)
  try {
    const base = { fromBlock: '0x0', toBlock: 'latest', category: ['erc20', 'external'], withMetadata: true, maxCount: '0x19', order: 'desc' };
    for (const dir of ['from', 'to']) {
      const params = dir === 'from' ? { ...base, fromAddress: addr } : { ...base, toAddress: addr };
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
        const r = await fetch(ALCHEMY_BNB, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'alchemy_getAssetTransfers', params: [params] }), signal: ctrl.signal });
        clearTimeout(to);
        const d = await r.json();
        if (d.result && d.result.transfers) for (const t of d.result.transfers) {
          ops.push({ hash: t.hash, tipo: dir === 'to' ? 'in' : 'out', symbol: t.asset || 'BNB', cantidad: t.value != null ? Number(t.value) : 0, contraparte: dir === 'to' ? (t.from || '') : (t.to || ''), ts: t.metadata && t.metadata.blockTimestamp ? new Date(t.metadata.blockTimestamp).getTime() : 0 });
        }
      } catch (_) {}
    }
  } catch (_) {}
  // dedup por hash
  const vistos = new Set(); const unicas = [];
  for (const o of ops) { if (!vistos.has(o.hash)) { vistos.add(o.hash); unicas.push(o); } }
  unicas.sort((a, b) => b.ts - a.ts);
  return unicas.slice(0, 30);
}

/* ── Seguidas (local por ahora, contrato al final) ── */
const KEY = 'aurex-shield-watch';
export function listaSeguidas() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
export function seguir(addr, etiqueta) { const l = listaSeguidas(); const a = addr.toLowerCase(); if (!l.find(x => x.addr === a)) { l.push({ addr: a, etiqueta: etiqueta || '', desde: Date.now() }); guardar(l); } return l; }
export function dejarSeguir(addr) { const l = listaSeguidas().filter(x => x.addr !== addr.toLowerCase()); guardar(l); return l; }
export function estaSiguiendo(addr) { return !!listaSeguidas().find(x => x.addr === (addr || '').toLowerCase()); }
function guardar(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} }
