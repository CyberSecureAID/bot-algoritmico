/* shield-tron.js — Lectura de la red Tron (TRC20) con la API de TronScan.
   SOLO LECTURA: consulta datos públicos, NO firma ni mueve fondos.
   Normaliza las aprobaciones al MISMO formato que el escáner de BSC
   (escanearApprovals), para que Permission Scan no cambie su interfaz.
   Revocar en Tron necesita TronLink (firmar) y queda para una segunda fase.

   Endpoints verificados del cliente oficial tronscan-client:
   - base:            https://apilist.tronscanapi.com/api
   - cabecera:        TRON-PRO-API-KEY: <key>
   - aprobaciones:    account/approve/list   (address, type=token|project, start, limit)
   - riesgo auth:     security/auth/data      (address)
   - resumen activos: account/token_asset_overview (address)
   - tx por hash:     transaction-info        (hash)
*/

const TRON_API = 'https://apilist.tronscanapi.com/api';
const TRON_KEY = 'a9e2c8f6-b952-42ac-9127-3a2e11c7e271';

/* Detecta la red por el FORMATO de una dirección o un hash. Sin tocar la red.
   BSC:  0x + 40 hex (dirección)  |  0x + 64 hex (hash)
   Tron: T + 33 Base58 (dirección) | 64 hex sin 0x (hash) */
export function redDe(v) {
  const s = String(v == null ? '' : v).trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return 'bsc';
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return 'bsc';
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s)) return 'tron';
  if (/^[0-9a-fA-F]{64}$/.test(s)) return 'tron';
  return null;
}

/* GET a una URL y parsea JSON, con timeout. */
async function _fetchJson(url) {
  const ctrl = new AbortController();
  const to = setTimeout(function () { ctrl.abort(); }, 20000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) { clearTimeout(to); throw e; }
}

/* Llamada base a la API de TronScan. Primero DIRECTO sin cabecera custom (para no
   disparar el preflight de CORS). Si falla (el navegador puede bloquear el origen),
   reintenta por un proxy CORS publico. Guarda la via usada en _tronVia.
   Nota: sin la cabecera de la key se usa el acceso publico (limite mas bajo, pero
   suficiente para un escaneo). Si hiciera falta la key, se mueve a un proxy propio. */
let _tronVia = '';
/* TronScan bloquea CORS desde otros dominios, así que vamos por proxies CORS en
   cascada: el primero que responda gana. Varios = mucho más difícil que fallen todos.
   (Para producción, lo ideal es un proxy propio en el Cloudflare Worker.) */
const _PROXIES = [
  function (u) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); },
  function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
  function (u) { return 'https://corsproxy.io/?url=' + encodeURIComponent(u); },
  function (u) { return 'https://thingproxy.freeboard.io/fetch/' + u; }
];
async function tronApi(endpoint, params) {
  const qs = new URLSearchParams(params || {}).toString();
  const directo = TRON_API + '/' + endpoint + (qs ? ('?' + qs) : '');
  // 1) intento directo (normalmente falla por CORS, pero por si algún día lo permiten)
  try { _tronVia = 'directo'; return await _fetchJson(directo); } catch (_) {}
  // 2) proxies en cascada
  for (let i = 0; i < _PROXIES.length; i++) {
    try { _tronVia = 'proxy' + (i + 1); return await _fetchJson(_PROXIES[i](directo)); } catch (_) {}
  }
  _tronVia = 'fallo';
  throw new Error('No se pudo leer TronScan (CORS/red) por ninguna vía');
}

/* TronGrid: nodo oficial de Tron, CORS abierto (igual que NodeReal en BSC). Directo, sin proxy. */
const TRON_GRID = 'https://api.trongrid.io';
async function tronGrid(path, params) {
  const qs = params ? ('?' + new URLSearchParams(params).toString()) : '';
  return await _fetchJson(TRON_GRID + path + qs);
}

/* Primer valor no vacío de una lista de posibles nombres de campo (defensivo:
   el array de approvals viene tipado como `any`, así que cubrimos variantes). */
function pick(obj, nombres) {
  for (const n of nombres) { if (obj && obj[n] != null && obj[n] !== '') return obj[n]; }
  return null;
}

/* Aprobaciones de una wallet de Tron (Permission Scan en Tron).
   Devuelve el MISMO formato que escanearApprovals de BSC, más dos campos extra
   que da TronScan (tag y riesgo del contrato). SOLO LECTURA. */
export async function tronApprovals(wallet) {
  let d;
  try {
    d = await tronApi('account/approve/list', { address: wallet, type: 'token', start: 0, limit: 200 });
  } catch (e) {
    try { window._tronDiag = { via: _tronVia, error: String((e && e.message) || e) }; } catch (_) {}
    return [];   // no rompemos la pantalla; el motivo queda en window._tronDiag
  }
  const data = (d && Array.isArray(d.data)) ? d.data : [];
  // diagnóstico legible: vía usada, total, claves de la respuesta y el PRIMER item real
  try { window._tronDiag = { via: _tronVia, total: (d && d.total), claves: d ? Object.keys(d) : [], ejemplo: data[0] || null, nContratos: (d && d.contractInfo) ? Object.keys(d.contractInfo).length : 0 }; } catch (_) {}
  const contractInfo = (d && d.contractInfo) || {};
  const riskInfo = (d && d.normalAddressInfo) || {};
  const salida = [];
  for (const it of data) {
    const ti = it.tokenInfo || it.token_info || {};
    const token = String(pick(ti, ['tokenId', 'tokenAddress', 'contractAddress']) || pick(it, ['token_id', 'contract_address', 'tokenAddress']) || '');
    const spender = String(pick(it, ['spender', 'approved_address', 'approvedAddress', 'risk_address', 'contract_address', 'toAddress', 'to_address']) || '');
    const amountRaw = String(pick(it, ['approval_amount', 'approvalAmount', 'amount', 'approved_amount']) || '0');
    const decRaw = pick(ti, ['tokenDecimal', 'decimals']);
    const dec = Number(decRaw != null ? decRaw : 6);
    const sym = String(pick(ti, ['tokenAbbr', 'tokenName', 'symbol', 'name']) || pick(it, ['symbol']) || '?');
    let allow = 0n;
    try { allow = BigInt((amountRaw.split('.')[0]) || '0'); } catch (_) { allow = 0n; }
    // ilimitado: aprobación tipo 2^256-1 (número gigante).
    const ilim = allow > (2n ** 255n) || amountRaw.replace(/[^0-9]/g, '').length >= 40;
    const ci = (spender && contractInfo[spender]) || {};
    const ri = (spender && riskInfo[spender]) || {};
    const tag = (String(pick(ci, ['tag1', 'name', 'tag']) || pick(ri, ['tag1', 'name', 'tag']) || '')) || null;
    const riesgo = !!(pick(ci, ['riskLevel', 'risk']) || pick(ri, ['riskLevel', 'risk']));
    salida.push({
      token: token, spender: spender, symbol: sym, decimals: dec,
      allowance: allow, ilimitado: ilim,
      nuestro: false, nombreNuestro: null,
      red: 'tron', tag: tag, riesgo: riesgo
    });
  }
  // riesgosos/ilimitados primero (mismo criterio que BSC)
  salida.sort(function (a, b) { if (a.ilimitado !== b.ilimitado) return a.ilimitado ? -1 : 1; return 0; });
  return salida;
}

/* Veredicto de seguridad de las autorizaciones (Security Service de TronScan).
   Opcional: enriquece el Score. SOLO LECTURA. */
export async function tronAuthSeguridad(wallet) {
  try { return await tronApi('security/auth/data', { address: wallet }); } catch (_) { return null; }
}

/* Resumen de activos (saldo con precio) de una wallet Tron. Para el Watcher. */
export async function tronResumenActivos(wallet) {
  try { return await tronApi('account/token_asset_overview', { address: wallet }); } catch (_) { return null; }
}

/* Tokens de una wallet Tron para el Watcher (token_asset_overview de TronScan).
   Devuelve el MISMO formato que tokensDe de BSC. SOLO LECTURA. */
export async function tronWatcherTokens(addr) {
  const out = { nativo: 0, nativoUSD: 0, tokens: [], totalUSD: 0 };
  // 1) Balances de TODOS los tokens + TRX, directo de TronGrid (CORS abierto, sin proxy).
  const saldos = {}; let gridOK = false; let gridErr = '';
  try {
    const acc = await tronGrid('/v1/accounts/' + addr);
    const a0 = (acc && acc.data && acc.data[0]) ? acc.data[0] : null;
    if (a0) {
      gridOK = true;
      out.nativo = Number(a0.balance || 0) / 1e6;
      const trc20 = Array.isArray(a0.trc20) ? a0.trc20 : [];
      for (const obj of trc20) { const c = Object.keys(obj)[0]; if (c) saldos[c.toLowerCase()] = { addr: c, raw: obj[c] }; }
    } else { gridErr = 'TronGrid respondió pero sin datos de la cuenta'; }
  } catch (e) { gridErr = String((e && e.message) || e).slice(0, 110); }
  // 2) Nombres y decimales por el historial de transferencias TRC20 de TronGrid (token_info).
  const meta = {};
  try {
    let fp = null; let v = 0;
    do {
      const params = { limit: 200 }; if (fp) params.fingerprint = fp;
      const tr = await tronGrid('/v1/accounts/' + addr + '/transactions/trc20', params);
      const arr = (tr && Array.isArray(tr.data)) ? tr.data : [];
      for (const t of arr) { const ti = t.token_info || {}; const c = String(ti.address || '').toLowerCase(); if (c && !meta[c]) meta[c] = { sym: ti.symbol || '', nombre: ti.name || '', dec: Number(ti.decimals != null ? ti.decimals : 6) }; }
      fp = (tr && tr.meta && tr.meta.fingerprint) ? tr.meta.fingerprint : null;
      v++;
    } while (fp && v < 6);
  } catch (_) {}
  // 3) Precios/logos de TronScan (por proxy, best-effort; solo para el valor en USD).
  const precios = {}; let trxUsd = 0;
  try {
    const d = await tronApi('account/token_asset_overview', { address: addr });
    const data = (d && Array.isArray(d.data)) ? d.data : [];
    for (const it of data) {
      const id = String(pick(it, ['tokenId', 'tokenAddress']) || '').toLowerCase();
      if (id === '_' || String(pick(it, ['tokenAbbr']) || '').toLowerCase() === 'trx') { trxUsd = Number(pick(it, ['assetInUsd']) || 0); }
      else { precios[id] = { precio: Number(pick(it, ['tokenPriceInUsd']) || 0), logo: pick(it, ['tokenLogo']) || null, sym: String(pick(it, ['tokenAbbr']) || ''), nombre: String(pick(it, ['tokenName']) || ''), dec: Number(pick(it, ['tokenDecimal']) != null ? pick(it, ['tokenDecimal']) : NaN) }; }
    }
  } catch (_) {}
  out.nativoUSD = trxUsd;
  // 4) Armar la lista final.
  if (gridOK) {
    for (const key in saldos) {
      const m2 = meta[key] || {};
      const pp = precios[key] || {};
      let dec = m2.dec; if (dec == null || isNaN(dec)) dec = (pp.dec != null && !isNaN(pp.dec)) ? pp.dec : 6;
      const bal = Number(saldos[key].raw || 0) / Math.pow(10, dec);
      const precio = pp.precio || 0;
      const sym = m2.sym || pp.sym || (saldos[key].addr.slice(0, 5) + '\u2026' + saldos[key].addr.slice(-4));
      out.tokens.push({ address: key, symbol: sym, name: m2.nombre || pp.nombre || '', decimals: dec, balance: bal, balanceRaw: '', usd: bal * precio, precio: precio, logo: pp.logo || null, red: 'tron' });
    }
  } else {
    // Respaldo (si TronGrid fallara): TronScan token_asset_overview (solo tokens con valor).
    try {
      const d = await tronApi('account/token_asset_overview', { address: addr });
      const data = (d && Array.isArray(d.data)) ? d.data : [];
      out.totalUSD = Number(d && d.totalAssetInUsd) || 0;
      for (const it of data) {
        const id = String(pick(it, ['tokenId', 'tokenAddress']) || '');
        const sym = String(pick(it, ['tokenAbbr', 'symbol']) || pick(it, ['tokenName']) || '?');
        const dec = Number(pick(it, ['tokenDecimal', 'decimals']) != null ? pick(it, ['tokenDecimal', 'decimals']) : 6);
        const bal = Number(pick(it, ['balance']) || 0) / Math.pow(10, dec);
        const usd = Number(pick(it, ['assetInUsd']) || 0);
        const precio = Number(pick(it, ['tokenPriceInUsd']) || 0);
        if (id === '_' || sym.toLowerCase() === 'trx') { out.nativo = bal; out.nativoUSD = usd; }
        else { out.tokens.push({ address: id.toLowerCase(), symbol: sym, name: String(pick(it, ['tokenName']) || ''), decimals: dec, balance: bal, balanceRaw: '', usd: usd, precio: precio, logo: pick(it, ['tokenLogo']) || null, red: 'tron' }); }
      }
    } catch (_) {}
  }
  if (!out.totalUSD) { out.totalUSD = out.nativoUSD; for (const t of out.tokens) out.totalUSD += (t.usd || 0); }
  out.tokens.sort(function (a, b) { return (b.usd - a.usd) || (b.balance - a.balance); });
  try { window._tronDiag = { grid: gridOK, err: gridErr, nTokens: out.tokens.length, nativo: out.nativo }; } catch (_) {}
  return out;
}

/* Detalle de una transacción Tron por hash. Para Hash lookup. */
export async function tronTx(hash) {
  try { return await tronApi('transaction-info', { hash: hash }); } catch (_) { return null; }
}
