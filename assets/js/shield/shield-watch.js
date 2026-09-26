/* shield-watch.js — Wallet Watcher.
   Ve TODOS los tokens de cualquier wallet con precio, símbolo, decimales y logo,
   su balance total, y su historial de operaciones con hash. Fuente principal:
   Ankr Advanced API (ankr_getAccountBalance / ankr_getTokenTransfers), que da
   todo en una llamada y funciona desde el navegador. La key de Ankr es GRATIS
   (registro en ankr.com/rpc/advanced-api). El seguimiento se guarda localmente. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';

const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io'];
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// Ankr Advanced API. Pega tu key gratuita (de ankr.com) entre las comillas.
const ANKR_KEY = 'ANKR_KEY';
const ANKR = 'https://rpc.ankr.com/multichain/' + ANKR_KEY;

let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
export function esDireccion(s) { return /^0x[0-9a-fA-F]{40}$/.test((s || '').trim()); }

async function ankr(method, params) {
  const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
  const r = await fetch(ANKR, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: ctrl.signal });
  clearTimeout(to);
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'ankr error');
  return d.result;
}

/* ── Todos los tokens de una wallet (Ankr, con precio y logo) ── */
export async function tokensDe(addr, onProgreso) {
  if (!esDireccion(addr)) return { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  if (onProgreso) onProgreso(0.2);
  const out = { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  try {
    const res = await ankr('ankr_getAccountBalance', { walletAddress: addr, blockchain: ['bsc'], onlyWhitelisted: false });
    if (res && Array.isArray(res.assets)) {
      for (const a of res.assets) {
        const usd = Number(a.balanceUsd || 0);
        const bal = Number(a.balance || 0);
        if (String(a.tokenType).toUpperCase() === 'NATIVE') { out.nativo = bal; out.nativoUSD = usd; out.totalUSD += usd; continue; }
        out.tokens.push({ address: (a.contractAddress || '').toLowerCase(), symbol: a.tokenSymbol || '?', name: a.tokenName || '', decimals: Number(a.tokenDecimals) || 18, balance: bal, usd, precio: Number(a.tokenPrice || 0), logo: a.thumbnail || null });
        out.totalUSD += usd;
      }
    }
  } catch (e) { out._error = (e && e.message) || 'error'; }
  // si Ankr no dio el nativo, leerlo del RPC + precio DeFiLlama
  if (out.nativo === 0) {
    try { out.nativo = Number(ethers.formatEther(await lector().getBalance(addr))); } catch (_) {}
    if (out.nativoUSD === 0 && out.nativo > 0) {
      try { const pr = await fetch('https://coins.llama.fi/prices/current/bsc:' + WBNB); const pd = await pr.json(); const p = pd.coins && pd.coins['bsc:' + WBNB]; if (p && p.price) { out.nativoUSD = out.nativo * p.price; out.totalUSD += out.nativoUSD; } } catch (_) {}
    }
  }
  out.tokens.sort((a, b) => (b.usd - a.usd) || (b.balance - a.balance));
  if (onProgreso) onProgreso(1);
  return out;
}

/* ── Historial de operaciones (Ankr getTokenTransfers) con hash ── */
export async function historialDe(addr) {
  if (!esDireccion(addr)) return [];
  try {
    const res = await ankr('ankr_getTokenTransfers', { address: [addr], blockchain: ['bsc'], pageSize: 30, descOrder: true });
    if (res && Array.isArray(res.transfers)) {
      return res.transfers.map(function (t) {
        const entra = (t.toAddress || '').toLowerCase() === addr.toLowerCase();
        return { hash: t.transactionHash, tipo: entra ? 'in' : 'out', symbol: t.tokenSymbol || '?', cantidad: Number(t.value || 0), contraparte: entra ? (t.fromAddress || '') : (t.toAddress || ''), ts: Number(t.timestamp || 0) * 1000 };
      });
    }
  } catch (_) {}
  return [];
}

export function logoBNB() { return 'https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png'; }

/* ── Seguidas (local por ahora, contrato al final) ── */
const KEY = 'aurex-shield-watch';
export function listaSeguidas() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
export function seguir(addr, etiqueta) { const l = listaSeguidas(); const a = addr.toLowerCase(); if (!l.find(function (x) { return x.addr === a; })) { l.push({ addr: a, etiqueta: etiqueta || '', desde: Date.now() }); guardar(l); } return l; }
export function dejarSeguir(addr) { const l = listaSeguidas().filter(function (x) { return x.addr !== addr.toLowerCase(); }); guardar(l); return l; }
export function estaSiguiendo(addr) { return !!listaSeguidas().find(function (x) { return x.addr === (addr || '').toLowerCase(); }); }
function guardar(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} }
