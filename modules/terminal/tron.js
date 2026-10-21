/* terminal/tron.js. Red Tron en SOLO LECTURA para la Terminal: resolver un contrato TRC20, su precio y datos
   de seguridad, via TronScan. Tron NO es operable aqui (no hay swap compatible con Tron en la plataforma):
   el token aparece, se ve su info y su Security Check, y se le pueden poner ALERTAS de precio. El area Market
   queda bloqueada. Mismo patron de TronScan que WalletShield (acceso publico + proxies CORS en cascada; la
   key queda declarada para cuando se mueva a un proxy propio). Modulo sellado: solo ./ dentro de terminal. */
const TRON_API = 'https://apilist.tronscanapi.com/api';
export const TRON_KEY = 'a9e2c8f6-b952-42ac-9127-3a2e11c7e271';   // para un proxy propio en el futuro

/* Direccion Tron valida: T + 33 Base58. */
export function esTron(v) { return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(String(v || '').trim()); }
/* Red por formato: 0x..40 = BSC, T.. = Tron. */
export function redDe(v) { const s = String(v == null ? '' : v).trim(); if (/^0x[0-9a-fA-F]{40}$/.test(s)) return 'bsc'; if (esTron(s)) return 'tron'; return null; }

const _PROXIES = [
  (u) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
  (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  (u) => 'https://thingproxy.freeboard.io/fetch/' + u
];
async function _json(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
/* TronScan bloquea CORS: intento directo y, si falla, proxies CORS en cascada (el primero que responda gana). */
async function tronApi(endpoint, params) {
  const qs = new URLSearchParams(params || {}).toString();
  const directo = TRON_API + '/' + endpoint + (qs ? ('?' + qs) : '');
  try { return await _json(directo); } catch (_) {}
  for (let i = 0; i < _PROXIES.length; i++) { try { return await _json(_PROXIES[i](directo)); } catch (_) {} }
  throw new Error('TronScan unreachable');
}
function tokOf(j) { const a = j && (j.trc20_tokens || j.data || j.tokens); return (Array.isArray(a) && a[0]) || null; }
const precioDe = (t) => Number((t && t.market_info && t.market_info.priceInUsd) || (t && t.priceInUsd) || 0) || 0;

/* Resuelve un contrato TRC20 a un item de la Terminal (no operable; solo info + alertas). null si no existe. */
export async function resolverTron(addr) {
  const token = String(addr || '').trim(); if (!esTron(token)) return null;
  let t; try { t = tokOf(await tronApi('token_trc20', { contract: token, limit: 1, start: 0 })); } catch (_) { return null; }
  if (!t) return null;
  return {
    token, par: null, quote: null, moneda: 'USDT', simbolo: t.symbol || '?', nombre: t.name || t.symbol || 'Token',
    decimales: Number(t.decimals) || 6, precio: 0, precioUsd: precioDe(t), liquidez: 0,
    holders: Number(t.holders_count) || 0, creador: t.issue_address || '', verificado: !!(t.verify_status || t.vip),
    fuente: 'tron', fuentePrecio: 'tron', graficable: false, operable: false, red: 'tron',
    logoUrl: t.icon_url || t.tokenLogo || null, tiempo: 0, resuelto: true
  };
}
/* Precio en USD en vivo (para el vigilante de alertas). */
export async function precioTron(token) {
  try { return precioDe(tokOf(await tronApi('token_trc20', { contract: String(token).trim(), limit: 1, start: 0 }))); } catch (_) { return 0; }
}
/* Datos para el Security Check de un token Tron (holders, verificado, precio). */
export async function seguridadTron(token) {
  try { const t = tokOf(await tronApi('token_trc20', { contract: String(token).trim(), limit: 1, start: 0 })); if (!t) return null;
    return { holders: Number(t.holders_count) || 0, verificado: !!(t.verify_status || t.vip), precioUsd: precioDe(t), creador: t.issue_address || '', simbolo: t.symbol || '?' };
  } catch (_) { return null; }
}
/* TronGrid (nodo PUBLICO de Tron, sin API key, CORS abierto: es lo que usa TronLink/TronWeb desde el navegador).
   Es la CAPA ON-CHAIN de Tron — el respaldo deterministico para que un token de Tron SIEMPRE de un veredicto
   real aunque GoPlus-tron y TronScan no respondan: confirma que el contrato EXISTE en cadena, y lee su creador
   y si trae ABI (codigo publico/verificado). Defensivo: devuelve null si algo falla, nunca rompe el analisis. */
export async function tronGridContrato(token) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 8000);
    const r = await fetch('https://api.trongrid.io/wallet/getcontract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: String(token).trim(), visible: true }), signal: c.signal });
    clearTimeout(t); if (!r.ok) return null;
    const j = await r.json(); if (!j || (!j.bytecode && !j.contract_address)) return null;   // sin bytecode no es un contrato
    return { existe: true, creador: j.origin_address || '', verificado: !!(j.abi && j.abi.entrys && j.abi.entrys.length), nombre: j.name || '' };
  } catch (_) { return null; }
}
