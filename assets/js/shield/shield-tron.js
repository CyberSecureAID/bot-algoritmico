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

/* POST a TronGrid (para métodos de nodo como getassetissuebyid). CORS abierto. */
async function tronGridPost(path, body) {
  const ctrl = new AbortController(); const to = setTimeout(function () { ctrl.abort(); }, 15000);
  try {
    const r = await fetch(TRON_GRID + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) { clearTimeout(to); throw e; }
}

/* Hex (como usa el nodo de Tron para nombres) -> texto UTF-8. */
function _hex2str(h) {
  try { if (!h) return ''; let s = ''; for (let i = 0; i < h.length; i += 2) s += String.fromCharCode(parseInt(h.substr(i, 2), 16)); try { return decodeURIComponent(escape(s)); } catch (_) { return s; } } catch (_) { return ''; }
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
  // Cuenta en TronGrid (CORS abierto, directo). Trae trc20 Y assetV2 (TRC10).
  let a0 = null, gridErr = '';
  try { const acc = await tronGrid('/v1/accounts/' + addr); a0 = (acc && acc.data && acc.data[0]) ? acc.data[0] : null; if (!a0) gridErr = 'sin datos'; }
  catch (e) { gridErr = String((e && e.message) || e).slice(0, 110); }

  if (!a0) {
    // Respaldo: TronScan token_asset_overview (solo tokens con valor).
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
        if (id === '_' || sym.toLowerCase() === 'trx') { out.nativo = bal; out.nativoUSD = usd; }
        else { out.tokens.push({ address: id.toLowerCase(), symbol: sym, name: String(pick(it, ['tokenName']) || ''), decimals: dec, balance: bal, balanceRaw: '', usd: usd, precio: Number(pick(it, ['tokenPriceInUsd']) || 0), logo: pick(it, ['tokenLogo']) || null, red: 'tron' }); }
      }
    } catch (_) {}
    try { window._tronDiag = { grid: false, err: gridErr, nTokens: out.tokens.length }; } catch (_) {}
    out.tokens.sort(function (a, b) { return (b.usd - a.usd) || (b.balance - a.balance); });
    return out;
  }

  out.nativo = Number(a0.balance || 0) / 1e6;
  // TRC20: {contrato: balance}
  const listaTrc20 = [];
  const trc20 = Array.isArray(a0.trc20) ? a0.trc20 : [];
  for (const obj of trc20) { const c = Object.keys(obj)[0]; if (c) listaTrc20.push({ addr: c, raw: obj[c] }); }
  // TRC10 (la basura): assetV2 = [{value, key(id)}]
  const listaTrc10 = [];
  const assetV2 = Array.isArray(a0.assetV2) ? a0.assetV2 : [];
  for (const as of assetV2) { if (as && as.key != null && as.value != null && Number(as.value) > 0) listaTrc10.push({ id: String(as.key), raw: String(as.value) }); }

  // Metadata TRC20 por el historial de transferencias (token_info).
  const metaT20 = {};
  const movesT = []; const lowA = String(addr).toLowerCase();
  try {
    let fp = null; let v = 0;
    do {
      const params = { limit: 200 }; if (fp) params.fingerprint = fp;
      const tr = await tronGrid('/v1/accounts/' + addr + '/transactions/trc20', params);
      const arr = (tr && Array.isArray(tr.data)) ? tr.data : [];
      for (const t of arr) {
        const ti = t.token_info || {};
        const c = String(ti.address || '').toLowerCase();
        if (c && !metaT20[c]) metaT20[c] = { sym: ti.symbol || '', nombre: ti.name || '', dec: Number(ti.decimals != null ? ti.decimals : 6) };
        const dcs = Number(ti.decimals != null ? ti.decimals : 6);
        const ent = String(t.to || '').toLowerCase() === lowA;
        let cc = 0; try { cc = Number(t.value || 0) / Math.pow(10, dcs); } catch (_) { cc = 0; }
        movesT.push({ hash: t.transaction_id || '', tipo: ent ? 'in' : 'out', symbol: ti.symbol || '?', cantidad: cc, contraparte: ent ? (t.from || '') : (t.to || ''), ts: Number(t.block_timestamp || 0), tokenLogo: null, tokenAddr: c, red: 'tron' });
      }
      fp = (tr && tr.meta && tr.meta.fingerprint) ? tr.meta.fingerprint : null;
      v++;
    } while (fp && v < 8 && movesT.length < 300);
  } catch (_) {}
  // TRX + TRC10 (lo que NO es TRC20) para completar la Activity, igual que el historial de BSC.
  try {
    let fp2 = null; let v2 = 0;
    do {
      const p2 = { limit: 200, only_confirmed: true, visible: true }; if (fp2) p2.fingerprint = fp2;
      const tr2 = await tronGrid('/v1/accounts/' + addr + '/transactions', p2);
      const arr2 = (tr2 && Array.isArray(tr2.data)) ? tr2.data : [];
      for (const tx of arr2) {
        const ct = (tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0]) ? tx.raw_data.contract[0] : null;
        if (!ct) continue;
        const val = (ct.parameter && ct.parameter.value) ? ct.parameter.value : {};
        const ts2 = Number(tx.block_timestamp || 0);
        const hash2 = tx.txID || tx.txid || '';
        if (ct.type === 'TransferContract') {
          const to = String(val.to_address || ''); const from = String(val.owner_address || '');
          const ent = to.toLowerCase() === lowA;
          movesT.push({ hash: hash2, tipo: ent ? 'in' : 'out', symbol: 'TRX', cantidad: Number(val.amount || 0) / 1e6, contraparte: ent ? from : to, ts: ts2, tokenLogo: 'https://static.tronscan.org/production/logo/trx.png', red: 'tron' });
        } else if (ct.type === 'TransferAssetContract') {
          const to = String(val.to_address || ''); const from = String(val.owner_address || '');
          const ent = to.toLowerCase() === lowA;
          movesT.push({ hash: hash2, tipo: ent ? 'in' : 'out', symbol: 'TRC10', cantidad: Number(val.amount || 0), contraparte: ent ? from : to, ts: ts2, tokenLogo: null, red: 'tron' });
        }
      }
      fp2 = (tr2 && tr2.meta && tr2.meta.fingerprint) ? tr2.meta.fingerprint : null;
      v2++;
    } while (fp2 && v2 < 8 && movesT.length < 400);
  } catch (_) {}

  // Metadata TRC10 por getassetissuebyid (nombre/abreviatura/decimales), en paralelo con tope.
  const metaT10 = {};
  try {
    const slice = listaTrc10.slice(0, 80);
    await Promise.all(slice.map(async function (tk) {
      try {
        const r = await tronGridPost('/wallet/getassetissuebyid', { value: Number(tk.id) });
        if (r) { const ab = _hex2str(r.abbr); const nm = _hex2str(r.name); metaT10[tk.id] = { sym: ab || nm || ('#' + tk.id), nombre: nm || '', dec: Number(r.precision || 0) }; }
      } catch (_) {}
    }));
  } catch (_) {}

  // Precios/logos TronScan (best-effort; solo para el valor en USD de los conocidos).
  const precios = {}; let trxUsd = 0;
  try {
    const d = await tronApi('account/token_asset_overview', { address: addr });
    const data = (d && Array.isArray(d.data)) ? d.data : [];
    for (const it of data) {
      const id = String(pick(it, ['tokenId', 'tokenAddress']) || '').toLowerCase();
      if (id === '_' || String(pick(it, ['tokenAbbr']) || '').toLowerCase() === 'trx') { trxUsd = Number(pick(it, ['assetInUsd']) || 0); }
      else precios[id] = { precio: Number(pick(it, ['tokenPriceInUsd']) || 0), logo: pick(it, ['tokenLogo']) || null };
    }
  } catch (_) {}
  out.nativoUSD = trxUsd;
  // Logos en los movimientos: usar el logo del token conocido (USDT, etc.) por su dirección.
  for (const mv of movesT) {
    if (!mv.tokenLogo && mv.tokenAddr && precios[mv.tokenAddr] && precios[mv.tokenAddr].logo) mv.tokenLogo = precios[mv.tokenAddr].logo;
  }
  movesT.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  out.moves = movesT;

  // Armar TRC20
  for (const tk of listaTrc20) {
    const key = tk.addr.toLowerCase();
    const mm = metaT20[key] || {}; const pp = precios[key] || {};
    let dec = (mm.dec != null && !isNaN(mm.dec)) ? mm.dec : 6;
    const bal = Number(tk.raw || 0) / Math.pow(10, dec);
    const precio = pp.precio || 0;
    out.tokens.push({ address: key, symbol: mm.sym || (tk.addr.slice(0, 5) + '\u2026' + tk.addr.slice(-4)), name: mm.nombre || '', decimals: dec, balance: bal, balanceRaw: '', usd: bal * precio, precio: precio, logo: pp.logo || null, red: 'tron' });
  }
  // Armar TRC10 (la basura)
  for (const tk of listaTrc10) {
    const mm = metaT10[tk.id] || {};
    const dec = (mm.dec != null && !isNaN(mm.dec)) ? mm.dec : 0;
    const bal = Number(tk.raw || 0) / Math.pow(10, dec);
    out.tokens.push({ address: 'trc10:' + tk.id, symbol: mm.sym || ('TRC10 #' + tk.id), name: mm.nombre || '', decimals: dec, balance: bal, balanceRaw: '', usd: 0, precio: 0, logo: null, red: 'tron' });
  }
  out.totalUSD = out.nativoUSD; for (const t of out.tokens) out.totalUSD += (t.usd || 0);
  out.tokens.sort(function (a, b) { return (b.usd - a.usd) || (b.balance - a.balance); });
  try { window._tronDiag = { grid: true, nTrc20: listaTrc20.length, nTrc10: listaTrc10.length, total: out.tokens.length }; } catch (_) {}
  return out;
}

/* Movimientos (transferencias TRC20) de una wallet Tron, para la Activity.
   Mismo formato que el historial de BSC (hash, tipo, symbol, cantidad, contraparte, ts). SOLO LECTURA. */
export async function tronWatcherMoves(addr) {
  const ops = [];
  const low = String(addr).toLowerCase();
  try {
    let fp = null; let v = 0;
    do {
      const params = { limit: 50 }; if (fp) params.fingerprint = fp;
      const tr = await tronGrid('/v1/accounts/' + addr + '/transactions/trc20', params);
      const arr = (tr && Array.isArray(tr.data)) ? tr.data : [];
      for (const t of arr) {
        const ti = t.token_info || {};
        const dec = Number(ti.decimals != null ? ti.decimals : 6);
        const entra = String(t.to || '').toLowerCase() === low;
        let cant = 0; try { cant = Number(t.value || 0) / Math.pow(10, dec); } catch (_) { cant = 0; }
        ops.push({ hash: t.transaction_id || '', tipo: entra ? 'in' : 'out', symbol: ti.symbol || '?', cantidad: cant, contraparte: entra ? (t.from || '') : (t.to || ''), ts: Number(t.block_timestamp || 0), tokenLogo: null, red: 'tron' });
      }
      fp = (tr && tr.meta && tr.meta.fingerprint) ? tr.meta.fingerprint : null;
      v++;
    } while (fp && v < 8 && ops.length < 300);
  } catch (_) {}
  ops.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  return ops;
}

/* Detalle de una transacción Tron por hash. Para Hash lookup. */
export async function tronTx(hash) {
  try { return await tronApi('transaction-info', { hash: hash }); } catch (_) { return null; }
}
