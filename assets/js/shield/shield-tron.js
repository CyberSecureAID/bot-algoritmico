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

/* Llamada base a la API de TronScan (GET con la cabecera de la key). */
async function tronApi(endpoint, params) {
  const qs = new URLSearchParams(params || {}).toString();
  const url = TRON_API + '/' + endpoint + (qs ? ('?' + qs) : '');
  const ctrl = new AbortController();
  const to = setTimeout(function () { ctrl.abort(); }, 20000);
  try {
    const r = await fetch(url, { headers: { 'TRON-PRO-API-KEY': TRON_KEY }, signal: ctrl.signal });
    clearTimeout(to);
    return await r.json();
  } catch (e) { clearTimeout(to); throw e; }
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
  const d = await tronApi('account/approve/list', { address: wallet, type: 'token', start: 0, limit: 200 });
  try { window._tronDiag = d; } catch (_) {}   // respuesta cruda, para afinar campos en vivo
  const data = (d && Array.isArray(d.data)) ? d.data : [];
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

/* Detalle de una transacción Tron por hash. Para Hash lookup. */
export async function tronTx(hash) {
  try { return await tronApi('transaction-info', { hash: hash }); } catch (_) { return null; }
}
