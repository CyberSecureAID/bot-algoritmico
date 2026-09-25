/* shield-watch.js — Wallet Watcher.
   Ve TODOS los tokens de cualquier wallet (incluso basura, incluso saldo 0),
   su balance total, y su historial de operaciones (compras, transferencias)
   con hash para rastrear en BscScan. El seguimiento se guarda localmente
   (y en el contrato al final) para que persista entre sesiones. La blockchain
   es el registro permanente: al reabrir, se ve todo lo que pasó. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';

const BSCSCAN = 'https://api.bscscan.com/api';
const BSCSCAN_KEY = 'YourApiKeyToken';
const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io'];
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }

export function esDireccion(s) { return /^0x[0-9a-fA-F]{40}$/.test((s || '').trim()); }

/* ── Todos los tokens que ha tocado una wallet (con saldo actual y logo) ── */
export async function tokensDe(addr, onProgreso) {
  if (!esDireccion(addr)) return { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  const prov = lector();
  // 1. BNB nativo
  let nativo = 0; try { nativo = Number(ethers.formatEther(await prov.getBalance(addr))); } catch (_) {}
  if (onProgreso) onProgreso(0.2);
  // 2. lista de tokens tocados (tokentx)
  const url = `${BSCSCAN}?module=account&action=tokentx&address=${addr}&startblock=0&endblock=latest&sort=desc&apikey=${BSCSCAN_KEY}`;
  const toks = new Map();
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 18000);
    const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
    const d = await r.json();
    if (d.status === '1' && Array.isArray(d.result)) for (const t of d.result) {
      const a = (t.contractAddress || '').toLowerCase();
      if (a && !toks.has(a)) toks.set(a, { address: a, symbol: t.tokenSymbol || '?', name: t.tokenName || '', decimals: Number(t.tokenDecimal) || 18 });
    }
  } catch (_) {}
  if (onProgreso) onProgreso(0.5);
  // 3. balance actual de cada token (tandas)
  const lista = [...toks.values()];
  const ABIb = ['function balanceOf(address) view returns (uint256)'];
  const conTok = [];
  for (let i = 0; i < lista.length; i += 10) {
    const res = await Promise.all(lista.slice(i, i + 10).map(async (t) => {
      try { const c = new ethers.Contract(t.address, ABIb, prov); const b = await c.balanceOf(addr); return { ...t, balance: Number(ethers.formatUnits(b, t.decimals)) }; }
      catch (_) { return { ...t, balance: 0 }; }
    }));
    conTok.push(...res);
    if (onProgreso) onProgreso(0.5 + 0.35 * ((i + 10) / Math.max(lista.length, 1)));
  }
  // 4. precios (DeFiLlama) para el total y ordenar
  const ids = conTok.map(t => 'bsc:' + t.address); ids.push('bsc:' + WBNB);
  let precios = {};
  try { const pr = await fetch('https://coins.llama.fi/prices/current/' + ids.join(',')); const pd = await pr.json(); precios = pd.coins || {}; } catch (_) {}
  let totalUSD = 0; const pBNB = precios['bsc:' + WBNB]; const nativoUSD = pBNB && pBNB.price ? nativo * pBNB.price : 0; totalUSD += nativoUSD;
  for (const t of conTok) { const pk = precios['bsc:' + t.address]; t.precio = pk && pk.price ? pk.price : 0; t.usd = t.balance * t.precio; totalUSD += t.usd; t.logo = pk && pk.symbol ? null : null; }
  // ordenar por valor USD (los con saldo/valor primero, basura al final)
  conTok.sort((a, b) => (b.usd - a.usd) || (b.balance - a.balance));
  if (onProgreso) onProgreso(1);
  return { nativo, nativoUSD, tokens: conTok, totalUSD };
}

/* ── Historial de operaciones de una wallet (compras/ventas/transferencias) ── */
export async function historialDe(addr, desdeBloque) {
  if (!esDireccion(addr)) return [];
  const desde = desdeBloque || 0;
  const url = `${BSCSCAN}?module=account&action=tokentx&address=${addr}&startblock=${desde}&endblock=latest&sort=desc&page=1&offset=40&apikey=${BSCSCAN_KEY}`;
  const ops = [];
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 18000);
    const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
    const d = await r.json();
    if (d.status === '1' && Array.isArray(d.result)) {
      for (const t of d.result) {
        const entra = (t.to || '').toLowerCase() === addr.toLowerCase();
        ops.push({
          hash: t.hash,
          tipo: entra ? 'in' : 'out',
          symbol: t.tokenSymbol || '?',
          cantidad: Number(ethers.formatUnits(t.value || '0', Number(t.tokenDecimal) || 18)),
          contraparte: entra ? (t.from || '') : (t.to || ''),
          ts: Number(t.timeStamp) * 1000,
          bloque: Number(t.blockNumber)
        });
      }
    }
  } catch (_) {}
  return ops;
}

/* ── Guardar/leer la lista de wallets seguidas (local por ahora, contrato al final) ── */
const KEY = 'aurex-shield-watch';
export function listaSeguidas() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
export function seguir(addr, etiqueta) {
  const l = listaSeguidas();
  const a = addr.toLowerCase();
  if (!l.find(x => x.addr === a)) { l.push({ addr: a, etiqueta: etiqueta || '', desde: Date.now(), ultBloque: 0 }); guardar(l); }
  return l;
}
export function dejarSeguir(addr) { const l = listaSeguidas().filter(x => x.addr !== addr.toLowerCase()); guardar(l); return l; }
export function estaSiguiendo(addr) { return !!listaSeguidas().find(x => x.addr === (addr || '').toLowerCase()); }
function guardar(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} }
