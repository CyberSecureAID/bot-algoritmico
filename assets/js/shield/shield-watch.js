/* shield-watch.js — Wallet Watcher (datos reales via Alchemy demo, sin API key).
   Ve TODOS los tokens de cualquier wallet, su balance total, su historial de
   operaciones con hash, y logos. Usa el endpoint público de Alchemy (docs-demo)
   que no requiere registro. Precios y logos de DeFiLlama como refuerzo. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';

const ALCHEMY = 'https://bnb-mainnet.g.alchemy.com/v2/docs-demo';   // demo público, sin key
const BSCSCAN = 'https://api.etherscan.io/v2/api';
const CHAIN = 56;   // BSC
const BSCSCAN_KEY = 'BUS6DPJ84DWQ1N9XCN8PIUHTNFM5TXE2HU';   // key real (gratuita)
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
export async function tokensDe(addr, onProgreso) {
  if (!esDireccion(addr)) return { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  const prov = lector();
  let nativo = 0; try { nativo = Number(ethers.formatEther(await prov.getBalance(addr))); } catch (_) {}
  if (onProgreso) onProgreso(0.15);

  const encontrados = new Map();  // addr -> {symbol,name,decimals,balance}

  // FUENTE 1: Etherscan V2 addresstokenbalance → todos los tokens con balance (1 llamada)
  try {
    const url = `${BSCSCAN}?chainid=${CHAIN}&module=account&action=addresstokenbalance&address=${addr}&page=1&offset=200&apikey=${BSCSCAN_KEY}`;
    const r = await fetch(url, { cache: 'no-store' });
    const d = await r.json();
    if (Array.isArray(d.result)) for (const t of d.result) {
      const a = (t.TokenAddress || '').toLowerCase();
      const dec = Number(t.TokenDivisor) || 18;
      const bal = Number(t.TokenQuantity || '0') / Math.pow(10, dec);
      if (a && bal > 0) encontrados.set(a, { address: a, symbol: t.TokenSymbol || '?', name: t.TokenName || '', decimals: dec, balance: bal, logo: null });
    }
  } catch (_) {}
  if (onProgreso) onProgreso(0.4);

  // FUENTE 2 (refuerzo): tokentx → tokens que tocó, por si el balance no salió
  if (encontrados.size === 0) {
    try {
      const url = `${BSCSCAN}?chainid=${CHAIN}&module=account&action=tokentx&address=${addr}&startblock=0&endblock=latest&page=1&offset=1000&sort=desc&apikey=${BSCSCAN_KEY}`;
      const r = await fetch(url, { cache: 'no-store' });
      const d = await r.json();
      const vistos = new Map();
      if (Array.isArray(d.result)) for (const t of d.result) {
        const a = (t.contractAddress || '').toLowerCase();
        if (a && !vistos.has(a)) vistos.set(a, { symbol: t.tokenSymbol || '?', name: t.tokenName || '', decimals: Number(t.tokenDecimal) || 18 });
      }
      // balance on-chain de cada uno
      const lista = [...vistos.entries()];
      for (let i = 0; i < lista.length; i += 12) {
        const res = await Promise.all(lista.slice(i, i+12).map(async ([a, info]) => {
          try { const c = new ethers.Contract(a, ABI_ERC, prov); const b = await c.balanceOf(addr); if (b === 0n) return null; return { address: a, ...info, balance: Number(ethers.formatUnits(b, info.decimals)), logo: null }; } catch (_) { return null; }
        }));
        res.filter(Boolean).forEach(t => encontrados.set(t.address, t));
      }
    } catch (_) {}
  }
  if (onProgreso) onProgreso(0.65);

  const tokens = [...encontrados.values()];
  // precios + logos (DeFiLlama)
  const ids = tokens.map(t => 'bsc:' + t.address); ids.push('bsc:' + WBNB);
  let precios = {};
  try { const pr = await fetch('https://coins.llama.fi/prices/current/' + ids.join(',')); const pd = await pr.json(); precios = pd.coins || {}; } catch (_) {}
  let totalUSD = 0; const pBNB = precios['bsc:' + WBNB]; const nativoUSD = pBNB && pBNB.price ? nativo * pBNB.price : 0; totalUSD += nativoUSD;
  for (const t of tokens) { const pk = precios['bsc:' + t.address]; t.precio = pk && pk.price ? pk.price : 0; t.usd = t.balance * t.precio; totalUSD += t.usd; }
  // logos via Alchemy metadata (refuerzo)
  await Promise.all(tokens.slice(0, 40).map(async (t) => { try { const m = await metadata(t.address); if (m.logo) t.logo = m.logo; } catch (_) {} }));
  tokens.sort((a, b) => (b.usd - a.usd) || (b.balance - a.balance));
  if (onProgreso) onProgreso(1);
  return { nativo, nativoUSD, tokens, totalUSD };
}

/* ── Logo de BNB y de tokens (DeFiLlama / Alchemy) ── */
export function logoBNB() { return 'https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png'; }

/* ── Historial de operaciones (Etherscan V2: tokentx + txlist) con hash ── */
export async function historialDe(addr) {
  if (!esDireccion(addr)) return [];
  const ops = [];
  // transferencias de tokens
  try {
    const url = `${BSCSCAN}?chainid=${CHAIN}&module=account&action=tokentx&address=${addr}&startblock=0&endblock=latest&page=1&offset=25&sort=desc&apikey=${BSCSCAN_KEY}`;
    const r = await fetch(url, { cache: 'no-store' });
    const d = await r.json();
    if (Array.isArray(d.result)) for (const t of d.result) {
      const entra = (t.to || '').toLowerCase() === addr.toLowerCase();
      ops.push({ hash: t.hash, tipo: entra ? 'in' : 'out', symbol: t.tokenSymbol || '?', cantidad: Number(ethers.formatUnits(t.value || '0', Number(t.tokenDecimal) || 18)), contraparte: entra ? (t.from || '') : (t.to || ''), ts: Number(t.timeStamp) * 1000 });
    }
  } catch (_) {}
  // transacciones normales (BNB)
  try {
    const url = `${BSCSCAN}?chainid=${CHAIN}&module=account&action=txlist&address=${addr}&startblock=0&endblock=latest&page=1&offset=15&sort=desc&apikey=${BSCSCAN_KEY}`;
    const r = await fetch(url, { cache: 'no-store' });
    const d = await r.json();
    if (Array.isArray(d.result)) for (const t of d.result) {
      if (t.value === '0') continue;
      const entra = (t.to || '').toLowerCase() === addr.toLowerCase();
      ops.push({ hash: t.hash, tipo: entra ? 'in' : 'out', symbol: 'BNB', cantidad: Number(ethers.formatEther(t.value || '0')), contraparte: entra ? (t.from || '') : (t.to || ''), ts: Number(t.timeStamp) * 1000 });
    }
  } catch (_) {}
  ops.sort((a, b) => b.ts - a.ts);
  return ops.slice(0, 30);
}

/* ── Seguidas (local por ahora, contrato al final) ── */
const KEY = 'aurex-shield-watch';
export function listaSeguidas() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
export function seguir(addr, etiqueta) { const l = listaSeguidas(); const a = addr.toLowerCase(); if (!l.find(x => x.addr === a)) { l.push({ addr: a, etiqueta: etiqueta || '', desde: Date.now() }); guardar(l); } return l; }
export function dejarSeguir(addr) { const l = listaSeguidas().filter(x => x.addr !== addr.toLowerCase()); guardar(l); return l; }
export function estaSiguiendo(addr) { return !!listaSeguidas().find(x => x.addr === (addr || '').toLowerCase()); }
function guardar(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} }
