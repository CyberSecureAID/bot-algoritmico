/* shield-watch.js — Wallet Watcher.
   Ve TODOS los tokens de cualquier wallet con balance, precio USD y logo, su
   balance total, y su historial de operaciones con hash. Fuente principal:
   NodeReal (endpoint Covalent), que tiene free tier real para BSC en 2026 tras
   la deprecación de BscScan. La key de NodeReal es GRATIS (registro en
   nodereal.io, sin tarjeta). El seguimiento se guarda localmente. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';

const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io'];
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// NodeReal API key (GRATIS en nodereal.io). Enhanced API nativo (nr_getTokenHoldings).
const NR_KEY = '0b80831c8c694568a11b6d72a580b81b';
const NR_RPC = 'https://bsc-mainnet.nodereal.io/v1/' + NR_KEY;

let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
export function esDireccion(s) { return /^0x[0-9a-fA-F]{40}$/.test((s || '').trim()); }

async function nrCall(method, params) {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
  const r = await fetch(NR_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctrl.signal });
  clearTimeout(to);
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'nr error');
  return d.result;
}

/* ── Todos los tokens de una wallet (NodeReal/Covalent, con precio y logo) ── */
export async function tokensDe(addr, onProgreso) {
  if (!esDireccion(addr)) return { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  if (onProgreso) onProgreso(0.2);
  const out = { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  const DG = { holdings: '', meta: '' };
  const prov = lector();
  // 1. nr_getTokenHoldings → todos los tokens ERC20 que tiene la wallet (con balance)
  let holdings = [];
  try {
    // params: address, pageNumber(hex), pageSize(hex, <=100)
    const res = await nrCall('nr_getTokenHoldings', [addr, '0x1', '0x64']);
    const det = res && res.details ? res.details : (Array.isArray(res) ? res : []);
    holdings = det || [];
    DG.holdings = holdings.length + ' tokens';
  } catch (e) { DG.holdings = 'ERR: ' + ((e && e.message)||'').slice(0,50); }
  if (onProgreso) onProgreso(0.55);

  // 2. armar tokens con símbolo/decimales/balance (nr_getTokenHoldings ya trae metadata)
  const tokens = [];
  for (const h of holdings) {
    try {
      const dec = parseInt(h.tokenDecimals || '0x12', 16) || 18;
      const raw = h.tokenBalance ? BigInt(h.tokenBalance) : 0n;
      const bal = Number(ethers.formatUnits(raw, dec));
      if (bal <= 0) continue;
      tokens.push({ address: (h.tokenAddress || '').toLowerCase(), symbol: h.tokenSymbol || '?', name: h.tokenName || '', decimals: dec, balance: bal, usd: 0, precio: 0, logo: null });
    } catch (_) {}
  }
  if (onProgreso) onProgreso(0.75);

  // 3. precios + logos (DeFiLlama)
  const ids = tokens.map(function (t) { return 'bsc:' + t.address; }); ids.push('bsc:' + WBNB);
  let precios = {};
  try { for (let i = 0; i < ids.length; i += 100) { const pr = await fetch('https://coins.llama.fi/prices/current/' + ids.slice(i, i+100).join(',')); const pd = await pr.json(); Object.assign(precios, pd.coins || {}); } } catch (_) {}
  for (const t of tokens) { const pk = precios['bsc:' + t.address]; if (pk) { t.precio = pk.price || 0; t.usd = t.balance * t.precio; t.logo = null; } out.totalUSD += t.usd; }
  out.tokens = tokens;
  out._dg = DG;

  // si no vino el nativo, leerlo del RPC + precio DeFiLlama
  if (out.nativo === 0) {
    try { out.nativo = Number(ethers.formatEther(await lector().getBalance(addr))); } catch (_) {}
    if (out.nativoUSD === 0 && out.nativo > 0) {
      try { const pr = await fetch('https://coins.llama.fi/prices/current/bsc:' + WBNB); const pd = await pr.json(); const p = pd.coins && pd.coins['bsc:' + WBNB]; if (p && p.price) { out.nativoUSD = out.nativo * p.price; out.totalUSD += out.nativoUSD; } } catch (_) {}
    }
  }
  out.tokens.sort(function (a, b) { return (b.usd - a.usd) || (b.balance - a.balance); });
  if (onProgreso) onProgreso(1);
  return out;
}

/* ── Historial (NodeReal/Covalent transactions) con hash ── */
export async function historialDe(addr) {
  if (!esDireccion(addr)) return [];
  const ops = [];
  try {
    // nr_getAssetTransfers: transferencias de/hacia la wallet
    const base = { category: ['20', 'external'], addressFilter: { from: null, to: null }, order: 'desc', maxCount: '0x1e' };
    for (const dir of ['from', 'to']) {
      const filt = dir === 'from' ? { fromAddress: addr } : { toAddress: addr };
      try {
        const res = await nrCall('nr_getAssetTransfers', [Object.assign({ fromBlock: '0x0', toBlock: 'latest', maxCount: '0x1e', order: 'desc', category: ['20', 'external'] }, filt)]);
        const trs = res && res.transfers ? res.transfers : [];
        for (const t of trs) {
          const entra = dir === 'to';
          ops.push({ hash: t.hash || t.transactionHash, tipo: entra ? 'in' : 'out', symbol: t.asset || t.tokenSymbol || 'BNB', cantidad: t.value != null ? Number(t.value) : (t.amount ? Number(t.amount) : 0), contraparte: entra ? (t.from || t.fromAddress || '') : (t.to || t.toAddress || ''), ts: t.timestamp ? (Number(t.timestamp) * 1000) : (t.metadata && t.metadata.blockTimestamp ? new Date(t.metadata.blockTimestamp).getTime() : 0) });
        }
      } catch (_) {}
    }
  } catch (_) {}
  const vistos = new Set(); const uni = [];
  for (const o of ops) { if (o.hash && !vistos.has(o.hash)) { vistos.add(o.hash); uni.push(o); } }
  uni.sort(function (a, b) { return b.ts - a.ts; });
  return uni.slice(0, 30);
}

export function logoBNB() { return 'https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png'; }

/* ── Seguidas (local por ahora, contrato al final) ── */
const KEY = 'aurex-shield-watch';
export function listaSeguidas() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
export function seguir(addr, etiqueta) { const l = listaSeguidas(); const a = addr.toLowerCase(); if (!l.find(function (x) { return x.addr === a; })) { l.push({ addr: a, etiqueta: etiqueta || '', desde: Date.now() }); guardar(l); } return l; }
export function dejarSeguir(addr) { const l = listaSeguidas().filter(function (x) { return x.addr !== addr.toLowerCase(); }); guardar(l); return l; }
export function estaSiguiendo(addr) { return !!listaSeguidas().find(function (x) { return x.addr === (addr || '').toLowerCase(); }); }
function guardar(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} }
