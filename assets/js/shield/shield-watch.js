/* shield-watch.js — Wallet Watcher.
   Ve TODOS los tokens de cualquier wallet con balance, precio USD y logo, su
   balance total, y su historial de operaciones con hash. Fuente principal:
   NodeReal (endpoint Covalent), que tiene free tier real para BSC en 2026 tras
   la deprecación de BscScan. La key de NodeReal es GRATIS (registro en
   nodereal.io, sin tarjeta). El seguimiento se guarda localmente. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';

const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io'];
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// NodeReal API key (GRATIS en nodereal.io, sin tarjeta). Pégala entre las comillas.
const NR_KEY = '0b80831c8c694568a11b6d72a580b81b';
const NR_HOST = 'https://open-platform.nodereal.io/' + NR_KEY + '/covalenthq/v1';
const NR_CHAINS = ['56', 'bsc-mainnet'];   // NodeReal/Covalent: BSC como chain id 56 (con fallback al nombre)

let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
export function esDireccion(s) { return /^0x[0-9a-fA-F]{40}$/.test((s || '').trim()); }

/* ── Todos los tokens de una wallet (NodeReal/Covalent, con precio y logo) ── */
export async function tokensDe(addr, onProgreso) {
  if (!esDireccion(addr)) return { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  if (onProgreso) onProgreso(0.2);
  const out = { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  let items = [];
  out._dg = { chain56: '', chainName: '', http: '' };
  for (const chain of NR_CHAINS) {
    try {
      const url = NR_HOST + '/' + chain + '/address/' + addr + '/balances_v2/?quote-currency=USD&nft=false';
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      out._dg.http = 'HTTP ' + r.status;
      const d = await r.json();
      const info = d && d.data && Array.isArray(d.data.items) ? (d.data.items.length + ' items') : (d && d.error ? ('err:' + JSON.stringify(d.error_message||d.error).slice(0,60)) : ('raw:' + JSON.stringify(d).slice(0,80)));
      if (chain === '56') out._dg.chain56 = info; else out._dg.chainName = info;
      if (d && d.data && Array.isArray(d.data.items) && d.data.items.length) { items = d.data.items; break; }
    } catch (e) { out._dg.http = 'FETCH FAIL: ' + ((e && e.message)||'').slice(0,50); }
  }
  {
    if (onProgreso) onProgreso(0.7);
    for (const it of items) {
      const dec = Number(it.contract_decimals) || 18;
      const bal = Number(it.balance || '0') / Math.pow(10, dec);
      if (bal <= 0) continue;
      const usd = Number(it.quote || 0);
      const esNativo = it.native_token === true || (it.contract_ticker_symbol === 'BNB' && !it.contract_address);
      if (esNativo) { out.nativo = bal; out.nativoUSD = usd; out.totalUSD += usd; continue; }
      out.tokens.push({
        address: (it.contract_address || '').toLowerCase(),
        symbol: it.contract_ticker_symbol || '?',
        name: it.contract_name || '',
        decimals: dec, balance: bal, usd,
        precio: Number(it.quote_rate || 0),
        logo: it.logo_url || null
      });
      out.totalUSD += usd;
    }
  }
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
  let items = [];
  for (const chain of NR_CHAINS) {
    try {
      const url = NR_HOST + '/' + chain + '/address/' + addr + '/transfers_v2/?quote-currency=USD&page-size=30';
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      const d = await r.json();
      if (d && d.data && Array.isArray(d.data.items) && d.data.items.length) { items = d.data.items; break; }
    } catch (_) {}
  }
  {
    for (const it of items) {
      const transfers = Array.isArray(it.transfers) ? it.transfers : [];
      for (const t of transfers) {
        const entra = String(t.transfer_type).toLowerCase() === 'in';
        const dec = Number(t.contract_decimals) || 18;
        ops.push({
          hash: t.tx_hash || it.tx_hash,
          tipo: entra ? 'in' : 'out',
          symbol: t.contract_ticker_symbol || '?',
          cantidad: Number(t.delta || '0') / Math.pow(10, dec),
          contraparte: entra ? (t.from_address || '') : (t.to_address || ''),
          ts: t.block_signed_at ? new Date(t.block_signed_at).getTime() : (it.block_signed_at ? new Date(it.block_signed_at).getTime() : 0)
        });
      }
    }
  }
  ops.sort(function (a, b) { return b.ts - a.ts; });
  return ops.slice(0, 30);
}

export function logoBNB() { return 'https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png'; }

/* ── Seguidas (local por ahora, contrato al final) ── */
const KEY = 'aurex-shield-watch';
export function listaSeguidas() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
export function seguir(addr, etiqueta) { const l = listaSeguidas(); const a = addr.toLowerCase(); if (!l.find(function (x) { return x.addr === a; })) { l.push({ addr: a, etiqueta: etiqueta || '', desde: Date.now() }); guardar(l); } return l; }
export function dejarSeguir(addr) { const l = listaSeguidas().filter(function (x) { return x.addr !== addr.toLowerCase(); }); guardar(l); return l; }
export function estaSiguiendo(addr) { return !!listaSeguidas().find(function (x) { return x.addr === (addr || '').toLowerCase(); }); }
function guardar(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} }
