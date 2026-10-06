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
  // 1. Descubrir tokens via Etherscan API V2 (BSC, chainid=56). NodeReal fallaba y
  //    por eso el saldo solo mostraba BNB. Las conocidas se leen igual de respaldo.
  const BSCSCAN_KEY = 'TZQ4M8PRW6J794MWDB1D2WM3FPVVC6NKB6';
  const CONOCIDAS = [
    { a: '0x55d398326f99059fF775485246999027B3197955', sym: 'USDT', dec: 18 },
    { a: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', sym: 'USDC', dec: 18 },
    { a: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', sym: 'BUSD', dec: 18 },
    { a: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', sym: 'CAKE', dec: 18 }
  ];
  let lista = CONOCIDAS.slice();
  try {
    const url = 'https://api.etherscan.io/v2/api?chainid=56&module=account&action=tokentx&address=' + addr + '&page=1&offset=1000&sort=desc&apikey=' + BSCSCAN_KEY;
    const ctrl = new AbortController(); const to = setTimeout(function () { ctrl.abort(); }, 8000);
    const r = await fetch(url, { signal: ctrl.signal }); clearTimeout(to);
    const d = await r.json();
    if (d.status === '1' && Array.isArray(d.result)) {
      const vistos = new Set(lista.map(function (m) { return m.a.toLowerCase(); }));
      d.result.forEach(function (t) { const a = (t.contractAddress || '').toLowerCase(); if (a && !vistos.has(a)) { vistos.add(a); lista.push({ a: t.contractAddress, sym: t.tokenSymbol || '?', dec: Number(t.tokenDecimal) || 18 }); } });
      DG.holdings = lista.length + ' tokens (etherscan)';
    } else { DG.holdings = 'etherscan: ' + (d.message || d.status || '?'); }
  } catch (e) { DG.holdings = 'ERR etherscan: ' + ((e && e.message) || '').slice(0, 50); }
  // Descubrir TODOS los tokens (incl. basura) por transferencias recibidas (NodeReal, fiable).
  //  Cada transferencia trae el contrato, el símbolo y los decimales, así que no hacen falta
  //  llamadas extra. Es la misma API que ya usa el historial.
  try {
    const vistos = new Set(lista.map(function (m) { return m.a.toLowerCase(); }));
    for (const campo of ['toAddress', 'fromAddress']) {
      let pageKey = null; let vueltas = 0;
      do {
        const params = { category: ['20'], order: 'desc', maxCount: '0x64', excludeZeroValue: false, withMetadata: true };
        params[campo] = addr;
        if (pageKey) params.pageKey = pageKey;
        let res;
        try { res = await nrCall('nr_getAssetTransfers', [params]); } catch (_) { break; }
        const trans = (res && res.transfers) ? res.transfers : [];
        for (const t of trans) {
          const rc = t.rawContract || {};
          const c = rc.address || t.contractAddress;
          if (!c) continue;
          const a2 = c.toLowerCase();
          if (vistos.has(a2)) continue;
          vistos.add(a2);
          let dec = null;
          if (rc.decimal != null) { try { dec = parseInt(rc.decimal, 16); } catch (_) {} }
          else if (t.decimal != null) dec = Number(t.decimal);
          lista.push({ a: c, sym: t.asset || '?', dec: dec });
        }
        pageKey = (res && res.pageKey) ? res.pageKey : null;
        vueltas++;
      } while (pageKey && vueltas < 12);
    }
    DG.holdings = lista.length + ' tokens (nodereal)';
  } catch (_) {}
  if (onProgreso) onProgreso(0.55);

  // 2. leer balanceOf de cada token on-chain, en lotes de 5.
  // Balances: Multicall3 (rápido). Si falla o no cuadra, balanceOf por lotes (seguro).
  const ercI = new ethers.Interface(['function balanceOf(address) view returns (uint256)']);
  let balances = [];
  try {
    const mc = new ethers.Contract('0xcA11bde05977b3631167028862bE2a173976CA11', ['function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[] ret)'], prov);
    const calls = lista.map(function (m) { return { target: m.a, allowFailure: true, callData: ercI.encodeFunctionData('balanceOf', [addr]) }; });
    for (let i = 0; i < calls.length; i += 300) {
      const part = await mc.aggregate3(calls.slice(i, i + 300));
      for (let k = 0; k < part.length; k++) { let v = 0n; try { if (part[k].success) v = ercI.decodeFunctionResult('balanceOf', part[k].returnData)[0]; } catch (_) {} balances.push(v); }
    }
  } catch (_) { balances = []; }
  if (balances.length !== lista.length) {
    balances = [];
    const ERC = ['function balanceOf(address) view returns (uint256)'];
    for (let i = 0; i < lista.length; i += 8) {
      const lote = lista.slice(i, i + 8);
      const res = await Promise.all(lote.map(async function (m) { try { const c = new ethers.Contract(m.a, ERC, prov); return await c.balanceOf(addr); } catch (_) { return 0n; } }));
      for (const bb of res) balances.push(bb);
    }
  }
  const tokens = [];
  for (let i = 0; i < lista.length; i++) {
    const m = lista[i]; const raw = balances[i];
    if (!raw || raw === 0n) continue;
    let dec = m.dec; if (dec == null || isNaN(dec)) dec = 18;
    const bal = Number(ethers.formatUnits(raw, dec));
    if (bal > 0) tokens.push({ address: m.a.toLowerCase(), symbol: m.sym || '?', name: '', decimals: dec, balance: bal, balanceRaw: '0x' + raw.toString(16), usd: 0, precio: 0, logo: null });
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


/* ── Historial AMPLIO (para el detector de poisoning) ──
   Trae muchas transferencias de tokens, incluidas las de valor cero (el vector
   del envenenamiento), usando nr_getTokenTransfers de NodeReal (paginado). */
export async function historialAmplio(addr) {
  if (!esDireccion(addr)) return [];
  const ops = [];
  // nr_getTokenTransfers: transferencias ERC20 de/hacia una address, con paginación
  for (const campo of ['fromAddress', 'toAddress']) {
    let pageKey = null; let vueltas = 0;
    do {
      try {
        const params = { category: ['20'], order: 'desc', maxCount: '0x64', excludeZeroValue: false, withMetadata: true };
        params[campo] = addr;
        if (pageKey) params.pageKey = pageKey;
        const res = await nrCall('nr_getAssetTransfers', [params]);
        const trs = res && res.transfers ? res.transfers : [];
        for (const t of trs) {
          const entra = campo === 'toAddress';
          // decimales del token
          let dec = 18;
          if (t.rawContract && t.rawContract.decimal != null) { try { dec = parseInt(t.rawContract.decimal, 16); } catch (_) {} }
          else if (t.decimal != null) { dec = Number(t.decimal); }
          if (dec == null || isNaN(dec)) dec = 18;
          // NodeReal nr_getAssetTransfers devuelve 'value' YA en decimal (p.ej. 3.53).
          // Preferimos value; solo si no viene, dividimos el raw por los decimales.
          let cant = 0;
          if (t.value != null && t.value !== '') {
            cant = Number(t.value);
          } else {
            const raw = (t.rawContract && t.rawContract.rawValue) ? t.rawContract.rawValue : (t.rawValue || null);
            if (raw) { try { cant = Number(ethers.formatUnits(BigInt(raw), dec)); } catch (_) { cant = 0; } }
          }
          // salvavidas: si el número es absurdamente grande (no se dividió), corregir con decimales
          if (cant > 1e12) {
            const raw2 = (t.rawContract && t.rawContract.rawValue) ? t.rawContract.rawValue : (t.rawValue || null);
            if (raw2) { try { cant = Number(ethers.formatUnits(BigInt(raw2), dec)); } catch (_) {} }
            else { cant = cant / Math.pow(10, dec); }
          }
          let logo = null;
          const rawCA = t.rawContract && t.rawContract.address ? t.rawContract.address : (t.contractAddress || null);
          if (rawCA) { try { logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/' + ethers.getAddress(rawCA) + '/logo.png'; } catch (_) {} }
          ops.push({ hash: t.hash, tipo: entra ? 'in' : 'out', symbol: t.asset || '?', cantidad: cant, contraparte: entra ? (t.from || '') : (t.to || ''), tokenLogo: logo, _tokenAddr: rawCA ? rawCA.toLowerCase() : null, ts: (t.metadata && t.metadata.blockTimestamp) ? new Date(t.metadata.blockTimestamp).getTime() : 0 });
        }
        pageKey = res && res.pageKey ? res.pageKey : null;
      } catch (_) { pageKey = null; }
      vueltas++;
    } while (pageKey && vueltas < 5);   // hasta 5 páginas por dirección (500 transfers)
  }
  // precios USD de los tokens que aparecen (DeFiLlama, para mostrar el valor)
  try {
    const dirsTok = {};
    for (const op of ops) { if (op._tokenAddr) dirsTok['bsc:' + op._tokenAddr] = true; }
    dirsTok['bsc:' + WBNB] = true;
    const ids = Object.keys(dirsTok);
    if (ids.length) {
      const precios = {};
      for (let i = 0; i < ids.length; i += 100) { try { const r = await fetch('https://coins.llama.fi/prices/current/' + ids.slice(i, i+100).join(',')); const d = await r.json(); Object.assign(precios, d.coins || {}); } catch (_) {} }
      for (const op of ops) {
        const key = op._tokenAddr ? ('bsc:' + op._tokenAddr) : (op.symbol === 'BNB' ? ('bsc:' + WBNB) : null);
        if (key && precios[key] && precios[key].price) op.usd = op.cantidad * precios[key].price;
      }
    }
  } catch (_) {}
  return ops;
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


/* ── Marca qué tokens son "nuevos" (adquiridos recientemente) ──
   Cruza los tokens con el historial de entradas para ver la última vez que entró
   cada uno. Devuelve un mapa address -> timestamp de la entrada más reciente. */
export async function marcarRecientes(addr, tokens, historial) {
  const mapa = {};
  // cruzar el historial de ENTRADAS con los tokens, por símbolo (lo que trae el historial)
  if (Array.isArray(historial)) {
    for (const op of historial) {
      if (op.tipo === 'in' && op.symbol && op.ts > 0) {
        const k = op.symbol.toUpperCase();
        if (!mapa[k] || op.ts > mapa[k]) mapa[k] = op.ts;
      }
    }
  }
  // asignar a cada token si tiene entrada reciente
  const ahora = Date.now();
  for (const t of (tokens || [])) {
    const ts = mapa[(t.symbol || '').toUpperCase()] || 0;
    t.adquiridoTs = ts;
    if (ts > 0) {
      const dias = (ahora - ts) / 86400000;
      t.reciente = dias <= 7;        // adquirido en la última semana
      t.hoy = dias <= 1;             // en 24h
      t.diasDesde = Math.floor(dias);
    }
  }
  return tokens;
}

/* ── Seguidas (local por ahora, contrato al final) ── */
const KEY = 'aurex-shield-watch';
export function listaSeguidas() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } }
export function seguir(addr, etiqueta) { const l = listaSeguidas(); const a = addr.toLowerCase(); if (!l.find(function (x) { return x.addr === a; })) { l.push({ addr: a, etiqueta: etiqueta || '', desde: Date.now() }); guardar(l); } return l; }
export function dejarSeguir(addr) { const l = listaSeguidas().filter(function (x) { return x.addr !== addr.toLowerCase(); }); guardar(l); return l; }
export function estaSiguiendo(addr) { return !!listaSeguidas().find(function (x) { return x.addr === (addr || '').toLowerCase(); }); }
function guardar(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (_) {} }
