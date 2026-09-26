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
    const res = await nrCall('nr_getTokenHoldings', [addr, '0x1', '0x64']);
    // el formato puede variar: probar varios campos
    const det = (res && res.details) ? res.details : ((res && res.tokens) ? res.tokens : (Array.isArray(res) ? res : []));
    holdings = det || [];
    DG.holdings = holdings.length + ' tokens';
    DG.raw = JSON.stringify(res).slice(0, 200);   // ver la respuesta cruda
  } catch (e) { DG.holdings = 'ERR: ' + ((e && e.message)||'').slice(0,60); }
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
  for (const t of tokens) {
    const pk = precios['bsc:' + t.address];
    if (pk) { t.precio = pk.price || 0; t.usd = t.balance * t.precio; }
    // logo de Trust Wallet por checksum (si no existe, la UI muestra iniciales con onerror)
    try { const cs = ethers.getAddress(t.address); t.logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/' + cs + '/logo.png'; } catch (_) { t.logo = null; }
    out.totalUSD += t.usd;
  }
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
  // nr_getAssetTransfers requiere rango <=1000 bloques si se especifica; mejor recorrer
  // los últimos N bloques en tandas. Traemos el bloque actual y miramos hacia atrás.
  let actual = 0;
  try { const bn = await lector().getBlockNumber(); actual = bn; } catch (_) {}
  if (!actual) return [];
  const VENTANA = 1000; const TANDAS = 12;   // ~12000 bloques (unas 10h en BSC)
  for (const dir of ['fromAddress', 'toAddress']) {
    for (let i = 0; i < TANDAS && ops.length < 60; i++) {
      const hasta = actual - i * VENTANA;
      const desde = hasta - VENTANA;
      if (desde < 0) break;
      try {
        const params = { fromBlock: '0x' + desde.toString(16), toBlock: '0x' + hasta.toString(16), category: ['external', '20'], order: 'desc', excludeZeroValue: false, maxCount: '0x32' };
        params[dir] = addr;
        const res = await nrCall('nr_getAssetTransfers', [params]);
        const trs = res && res.transfers ? res.transfers : [];
        for (const t of trs) {
          const entra = dir === 'toAddress';
          let cant = 0;
          if (t.value != null) cant = Number(t.value);
          else if (t.rawValue) { try { cant = Number(ethers.formatUnits(BigInt(t.rawValue), Number(t.decimal) || 18)); } catch (_) {} }
          ops.push({ hash: t.hash || t.transactionHash, tipo: entra ? 'in' : 'out', symbol: t.asset || t.symbol || 'BNB', cantidad: cant, contraparte: entra ? (t.from || '') : (t.to || ''), ts: 0, bloque: t.blockNum ? parseInt(t.blockNum, 16) : 0 });
        }
      } catch (_) {}
    }
  }
  const vistos = new Set(); const uni = [];
  for (const o of ops) { if (o.hash && !vistos.has(o.hash)) { vistos.add(o.hash); uni.push(o); } }
  uni.sort(function (a, b) { return (b.bloque || 0) - (a.bloque || 0); });
  return uni.slice(0, 30);
}

export function logoBNB() { return 'https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png'; }


/* ── Estadísticas de la wallet (edad, nº tx, actividad) ── */
export async function estadisticas(addr) {
  const out = { txCount: 0, primeraTx: 0, edadDias: 0 };
  if (!esDireccion(addr)) return out;
  try { out.txCount = await lector().getTransactionCount(addr); } catch (_) {}
  // primera tx: nr_getAssetTransfers desde el bloque 0, orden asc, 1 resultado
  try {
    const res = await nrCall('nr_getAssetTransfers', [{ fromBlock: '0x0', toBlock: 'latest', category: ['external', '20'], order: 'asc', maxCount: '0x1', fromAddress: addr }]);
    const t = res && res.transfers && res.transfers[0];
    if (t && t.blockNum) {
      const b = await lector().getBlock(parseInt(t.blockNum, 16));
      if (b && b.timestamp) { out.primeraTx = b.timestamp * 1000; out.edadDias = Math.floor((Date.now() - out.primeraTx) / 86400000); }
    }
  } catch (_) {}
  return out;
}

/* ── PnL aproximado de la wallet (con el historial de transfers de tokens con precio) ── */
export async function pnlAprox(addr, tokensActuales) {
  // Estimación: valor actual de las posiciones (ya lo tenemos) es el "unrealized".
  // Para un PnL realizado exacto haría falta el precio histórico de cada compra/venta,
  // que las APIs gratis no dan con fiabilidad. Damos señales honestas:
  //   - valor actual del portfolio
  //   - nº de tokens con valor real (>$1)
  //   - token de mayor posición
  const conValor = (tokensActuales || []).filter(function (t) { return t.usd > 1; });
  let mayor = null;
  for (const t of conValor) { if (!mayor || t.usd > mayor.usd) mayor = t; }
  const valorTotal = conValor.reduce(function (a, t) { return a + t.usd; }, 0);
  const concentracion = (mayor && valorTotal > 0) ? (mayor.usd / valorTotal * 100) : 0;
  return { tokensConValor: conValor.length, mayorPosicion: mayor, concentracion: concentracion };
}

/* ── Datos de un token: holders + info de mercado (DexScreener, gratis) ── */
export async function datosToken(tokenAddr) {
  const out = { holders: 0, precio: 0, liquidez: 0, volumen24h: 0, dex: '', par: '', creado: 0 };
  if (!esDireccion(tokenAddr)) return out;
  // holders (NodeReal)
  try { const h = await nrCall('nr_getTokenHolderCount', [tokenAddr]); out.holders = parseInt(h, 16) || Number(h) || 0; } catch (_) {}
  // mercado (DexScreener, sin key, con CORS)
  try {
    const r = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + tokenAddr);
    const d = await r.json();
    const pares = (d && d.pairs) ? d.pairs.filter(function (p) { return p.chainId === 'bsc'; }) : [];
    if (pares.length) {
      pares.sort(function (a, b) { return (b.liquidity && b.liquidity.usd || 0) - (a.liquidity && a.liquidity.usd || 0); });
      const p = pares[0];
      out.precio = Number(p.priceUsd || 0);
      out.liquidez = p.liquidity && p.liquidity.usd ? p.liquidity.usd : 0;
      out.volumen24h = p.volume && p.volume.h24 ? p.volume.h24 : 0;
      out.dex = p.dexId || '';
      out.par = p.pairAddress || '';
      out.creado = p.pairCreatedAt || 0;
    }
  } catch (_) {}
  return out;
}

/* ── Seguidas (local por ahora, contrato al final) ── */
const KEY = 'aurex-shield-watch';
export function listaSeguidas() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
export function seguir(addr, etiqueta) { const l = listaSeguidas(); const a = addr.toLowerCase(); if (!l.find(function (x) { return x.addr === a; })) { l.push({ addr: a, etiqueta: etiqueta || '', desde: Date.now() }); guardar(l); } return l; }
export function dejarSeguir(addr) { const l = listaSeguidas().filter(function (x) { return x.addr !== addr.toLowerCase(); }); guardar(l); return l; }
export function estaSiguiendo(addr) { return !!listaSeguidas().find(function (x) { return x.addr === (addr || '').toLowerCase(); }); }
function guardar(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} }
