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

/* ── Todos los tokens de una wallet (MÚLTIPLES fuentes) ──
   Fuente 1: BscScan tokentx (con key) → lista de todos los tokens que tocó.
   Fuente 2: Alchemy getTokenBalances → refuerzo.
   Balance real on-chain de cada uno. Precios/logos de DeFiLlama + metadata. */
const ABI_ERC = ['function balanceOf(address) view returns (uint256)','function symbol() view returns (string)','function decimals() view returns (uint8)','function name() view returns (string)'];
export async function tokensDe(addr, onProgreso) {
  if (!esDireccion(addr)) return { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  const prov = lector();
  let nativo = 0; try { nativo = Number(ethers.formatEther(await prov.getBalance(addr))); } catch (_) {}
  if (onProgreso) onProgreso(0.15);

  // ── reunir direcciones de tokens de VARIAS fuentes ──
  const dirs = new Map();  // addr -> {symbol,decimals,name} (lo que sepamos)

  // Fuente 1: BscScan tokentx (con tu key) — la más completa
  try {
    const url = `${BSCSCAN}?module=account&action=tokentx&address=${addr}&startblock=0&endblock=latest&page=1&offset=1000&sort=desc&apikey=${BSCSCAN_KEY}`;
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 18000);
    const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
    const d = await r.json();
    if (d.status === '1' && Array.isArray(d.result)) for (const t of d.result) {
      const a = (t.contractAddress || '').toLowerCase();
      if (a && !dirs.has(a)) dirs.set(a, { symbol: t.tokenSymbol || '?', decimals: Number(t.tokenDecimal) || 18, name: t.tokenName || '' });
    }
  } catch (_) {}
  if (onProgreso) onProgreso(0.35);

  // Fuente 2: Alchemy getTokenBalances (refuerzo, por si BscScan se saltó alguno)
  try {
    const res = await alchemy('alchemy_getTokenBalances', [addr, 'erc20']);
    const bals = (res && res.tokenBalances) ? res.tokenBalances : [];
    for (const b of bals) { const a = (b.contractAddress || '').toLowerCase(); if (a && b.tokenBalance && !/^0x0*$/.test(b.tokenBalance) && !dirs.has(a)) dirs.set(a, null); }
  } catch (_) {}
  if (onProgreso) onProgreso(0.5);

  // ── balance real on-chain de cada token (tandas) ──
  const lista = [...dirs.entries()];
  const tokens = [];
  for (let i = 0; i < lista.length; i += 10) {
    const tanda = lista.slice(i, i + 10);
    const res = await Promise.all(tanda.map(async ([a, info]) => {
      try {
        const c = new ethers.Contract(a, ABI_ERC, prov);
        const bal = await c.balanceOf(addr);
        if (bal === 0n) return null;  // sin saldo actual: no mostrar
        let dec = info && info.decimals != null ? info.decimals : 18;
        let sym = info && info.symbol && info.symbol !== '?' ? info.symbol : null;
        let nom = info && info.name ? info.name : '';
        if (!sym) { try { sym = await c.symbol(); } catch (_) { sym = '?'; } try { dec = Number(await c.decimals()); } catch (_) {} }
        return { address: a, symbol: sym, name: nom, decimals: dec, balance: Number(ethers.formatUnits(bal, dec)), logo: null };
      } catch (_) { return null; }
    }));
    tokens.push(...res.filter(Boolean));
    if (onProgreso) onProgreso(0.5 + 0.35 * ((i + 10) / Math.max(lista.length, 1)));
  }

  // ── precios + logos (DeFiLlama) ──
  const ids = tokens.map(t => 'bsc:' + t.address); ids.push('bsc:' + WBNB);
  let precios = {};
  try { const pr = await fetch('https://coins.llama.fi/prices/current/' + ids.join(',')); const pd = await pr.json(); precios = pd.coins || {}; } catch (_) {}
  let totalUSD = 0; const pBNB = precios['bsc:' + WBNB]; const nativoUSD = pBNB && pBNB.price ? nativo * pBNB.price : 0; totalUSD += nativoUSD;
  for (const t of tokens) { const pk = precios['bsc:' + t.address]; t.precio = pk && pk.price ? pk.price : 0; t.usd = t.balance * t.precio; totalUSD += t.usd;
    // logo: DeFiLlama no da logo directo; usar el de metadata de Alchemy como refuerzo async abajo
  }
  // logos via Alchemy metadata (en paralelo, no bloquea si falla)
  await Promise.all(tokens.slice(0, 30).map(async (t) => { try { const m = await metadata(t.address); if (m.logo) t.logo = m.logo; if ((!t.symbol || t.symbol === '?') && m.symbol) t.symbol = m.symbol; } catch (_) {} }));
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
