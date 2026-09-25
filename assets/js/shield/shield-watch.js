/* shield-watch.js — Wallet Watcher (datos reales via Alchemy demo, sin API key).
   Ve TODOS los tokens de cualquier wallet, su balance total, su historial de
   operaciones con hash, y logos. Usa el endpoint público de Alchemy (docs-demo)
   que no requiere registro. Precios y logos de DeFiLlama como refuerzo. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';

const ALCHEMY = 'https://bnb-mainnet.g.alchemy.com/v2/docs-demo';   // demo público, sin key
const BSCSCAN = 'https://api.bscscan.com/api';
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

/* ── Todos los tokens de una wallet (con saldo, logo y valor USD) ── */
export async function tokensDe(addr, onProgreso) {
  if (!esDireccion(addr)) return { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  const prov = lector();
  let nativo = 0; try { nativo = Number(ethers.formatEther(await prov.getBalance(addr))); } catch (_) {}
  if (onProgreso) onProgreso(0.15);

  // 1. balances de TODOS los ERC20 (Alchemy)
  let balances = [];
  try {
    const res = await alchemy('alchemy_getTokenBalances', [addr, 'erc20']);
    balances = (res && res.tokenBalances) ? res.tokenBalances : [];
  } catch (_) {}
  // filtrar los que tienen balance != 0 en hex, pero guardamos también algunos con 0 (spam)
  const noVacios = balances.filter(b => b.tokenBalance && b.tokenBalance !== '0x' && !/^0x0+$/.test(b.tokenBalance));
  if (onProgreso) onProgreso(0.4);

  // 2. metadata (logo, símbolo, decimales) de cada uno (en tandas)
  const tokens = [];
  for (let i = 0; i < noVacios.length; i += 8) {
    const tanda = noVacios.slice(i, i + 8);
    const res = await Promise.all(tanda.map(async (b) => {
      const meta = await metadata(b.contractAddress);
      let bal = 0;
      try { bal = Number(ethers.formatUnits(BigInt(b.tokenBalance), meta.decimals)); } catch (_) {}
      return { address: b.contractAddress.toLowerCase(), symbol: meta.symbol, name: meta.name, decimals: meta.decimals, logo: meta.logo, balance: bal };
    }));
    tokens.push(...res);
    if (onProgreso) onProgreso(0.4 + 0.4 * ((i + 8) / Math.max(noVacios.length, 1)));
  }

  // 3. precios (DeFiLlama) para el total + logo de refuerzo
  const ids = tokens.map(t => 'bsc:' + t.address); ids.push('bsc:' + WBNB);
  let precios = {};
  try { const pr = await fetch('https://coins.llama.fi/prices/current/' + ids.join(',')); const pd = await pr.json(); precios = pd.coins || {}; } catch (_) {}
  let totalUSD = 0; const pBNB = precios['bsc:' + WBNB]; const nativoUSD = pBNB && pBNB.price ? nativo * pBNB.price : 0; totalUSD += nativoUSD;
  for (const t of tokens) { const pk = precios['bsc:' + t.address]; t.precio = pk && pk.price ? pk.price : 0; t.usd = t.balance * t.precio; totalUSD += t.usd; }
  tokens.sort((a, b) => (b.usd - a.usd) || (b.balance - a.balance));
  if (onProgreso) onProgreso(1);
  return { nativo, nativoUSD, tokens, totalUSD };
}

/* ── Logo de BNB y de tokens (DeFiLlama / Alchemy) ── */
export function logoBNB() { return 'https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png'; }

/* ── Historial de operaciones (BscScan con key + fallback Alchemy) con hash ── */
export async function historialDe(addr) {
  if (!esDireccion(addr)) return [];
  // 1. BscScan tokentx (transferencias de tokens) — la key real lo hace fiable
  try {
    const url = `${BSCSCAN}?module=account&action=tokentx&address=${addr}&startblock=0&endblock=latest&page=1&offset=30&sort=desc&apikey=${BSCSCAN_KEY}`;
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 18000);
    const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
    const d = await r.json();
    if (d.status === '1' && Array.isArray(d.result) && d.result.length) {
      return d.result.map(t => {
        const entra = (t.to || '').toLowerCase() === addr.toLowerCase();
        return {
          hash: t.hash, tipo: entra ? 'in' : 'out',
          symbol: t.tokenSymbol || '?',
          cantidad: Number(ethers.formatUnits(t.value || '0', Number(t.tokenDecimal) || 18)),
          contraparte: entra ? (t.from || '') : (t.to || ''),
          ts: Number(t.timeStamp) * 1000
        };
      });
    }
  } catch (_) {}
  // 2. fallback: Alchemy getAssetTransfers
  try {
    const base = { fromBlock: '0x0', toBlock: 'latest', category: ['erc20', 'external'], withMetadata: true, maxCount: '0x14', order: 'desc' };
    const [out, inc] = await Promise.all([
      alchemy('alchemy_getAssetTransfers', [{ ...base, fromAddress: addr }]).catch(() => ({ transfers: [] })),
      alchemy('alchemy_getAssetTransfers', [{ ...base, toAddress: addr }]).catch(() => ({ transfers: [] }))
    ]);
    const ops = [];
    const proc = (arr, tipo) => (arr.transfers || []).forEach(t => ops.push({ hash: t.hash, tipo, symbol: t.asset || 'BNB', cantidad: t.value != null ? Number(t.value) : 0, contraparte: tipo === 'in' ? (t.from || '') : (t.to || ''), ts: t.metadata && t.metadata.blockTimestamp ? new Date(t.metadata.blockTimestamp).getTime() : 0 }));
    proc(out, 'out'); proc(inc, 'in');
    ops.sort((a, b) => b.ts - a.ts);
    return ops.slice(0, 30);
  } catch (_) { return []; }
}

/* ── Seguidas (local por ahora, contrato al final) ── */
const KEY = 'aurex-shield-watch';
export function listaSeguidas() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
export function seguir(addr, etiqueta) { const l = listaSeguidas(); const a = addr.toLowerCase(); if (!l.find(x => x.addr === a)) { l.push({ addr: a, etiqueta: etiqueta || '', desde: Date.now() }); guardar(l); } return l; }
export function dejarSeguir(addr) { const l = listaSeguidas().filter(x => x.addr !== addr.toLowerCase()); guardar(l); return l; }
export function estaSiguiendo(addr) { return !!listaSeguidas().find(x => x.addr === (addr || '').toLowerCase()); }
function guardar(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} }
