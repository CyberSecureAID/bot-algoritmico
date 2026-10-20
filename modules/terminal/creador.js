/* terminal/creador.js. Historial del creador (modulo sellado). Defensa de entrada: un dev que ya lanzo
   varias monedas y las dejo morir (sin liquidez) es la senal de rug mas fuerte que hay, y casi ninguna
   plataforma la muestra bien. Aqui se calcula SIN servidor:
     1) BscScan (Etherscan V2): los contratos que ya desplego esa wallet (txs de creacion).
     2) DexScreener: la liquidez viva de cada uno de esos tokens.
   Un token con liquidez por debajo del umbral se cuenta como muerto. NO se promete nada ni se predice:
   solo se informa de lo que la cadena ya registro. Si las APIs no responden, se devuelve null y el panel
   lo dice con claridad (nunca inventa un historial). */
import { BSCSCAN_API, BSCSCAN_V2, DEXSCREENER_TOK } from './config.js';

const _cache = new Map();          // creador -> resultado (evita volver a pedir al reabrir el mismo token)
const UMBRAL_MUERTO = 800;         // liquidez USD por debajo de la cual el token se considera muerto/rugueado
const MAX_TOKENS = 8;              // cuantos de los contratos mas recientes se revisan (limites de las APIs)

async function jget(url, ms = 9000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); return await r.json(); }
  finally { clearTimeout(t); }
}

/* Contratos desplegados por la wallet: en una tx de creacion no hay 'to' y BscScan rellena contractAddress.
   Mas reciente primero; se descartan las creaciones que fallaron. */
async function contratosDe(creador) {
  const url = BSCSCAN_V2 + '?chainid=56&module=account&action=txlist&address=' + creador +
    '&startblock=0&endblock=99999999&page=1&offset=2000&sort=desc&apikey=' + BSCSCAN_API;
  const j = await jget(url).catch(() => null);
  if (!j) return null;                                                   // sin respuesta: NO se pudo comprobar
  if (j.status === '1' && Array.isArray(j.result)) {
    const out = [];
    for (const tx of j.result) {
      if ((tx.to === '' || tx.to == null) && tx.contractAddress) {
        if (String(tx.isError) === '1') continue;
        out.push(String(tx.contractAddress).toLowerCase());
      }
    }
    return [...new Set(out)];
  }
  if (j.status === '0' && /no transactions found/i.test(String(j.message || ''))) return [];   // vacio real
  return null;                                                           // NOTOK / rate limit / formato raro
}

/* Liquidez viva de un token (la mayor de sus pares en BSC) y su simbolo, via DexScreener. */
async function liquidezDe(addr) {
  const j = await jget(DEXSCREENER_TOK + addr).catch(() => null);
  const pares = (j && Array.isArray(j.pairs)) ? j.pairs.filter((p) => p && p.chainId === 'bsc') : [];
  let liq = 0, simbolo = '';
  for (const p of pares) {
    const l = (p.liquidity && p.liquidity.usd) ? Number(p.liquidity.usd) : 0;
    if (l > liq) liq = l;
    if (!simbolo && p.baseToken && String(p.baseToken.address).toLowerCase() === String(addr).toLowerCase()) simbolo = p.baseToken.symbol || '';
  }
  return { liq: (liq > 0 && isFinite(liq)) ? liq : 0, simbolo };
}

/* Historial del creador. Excluye el token que se esta mirando. Devuelve el resumen para el panel de
   seguridad, o null si no se pudo leer (el panel muestra "no disponible", nunca un dato inventado). */
export async function historialCreador(creador, tokenActual) {
  if (!creador) return null;
  const key = String(creador).toLowerCase();
  if (_cache.has(key)) return _cache.get(key);
  let res = null;
  try {
    const actual = String(tokenActual || '').toLowerCase();
    const todos = await contratosDe(creador);
    if (todos == null) { res = null; }                                   // no se pudo comprobar: el panel lo dice
    else {
      const contratos = todos.filter((a) => a !== actual);
      const total = contratos.length;
      const revisar = contratos.slice(0, MAX_TOKENS);
      const infos = await Promise.all(revisar.map((a) =>
        liquidezDe(a).then((d) => ({ addr: a, liq: d.liq, simbolo: d.simbolo, estado: d.liq >= UMBRAL_MUERTO ? 'vivo' : 'muerto' }))
          .catch(() => ({ addr: a, liq: 0, simbolo: '', estado: 'muerto' }))));
      const muertos = infos.filter((t) => t.estado === 'muerto').length;
      const vivos = infos.filter((t) => t.estado === 'vivo').length;
      const muestra = infos.length;
      let nivel, texto;
      if (total === 0) { nivel = 'warn'; texto = 'No earlier tokens from this wallet'; }   // fresca o primeriza: no hay con que avalar
      else if (muertos >= 2 && (muertos / Math.max(1, muestra)) >= 0.6) { nivel = 'bad'; texto = 'Launched ' + total + ' before · ' + muertos + ' of the last ' + muestra + ' are dead'; }
      else if (vivos > 0 && muertos === 0) { nivel = 'ok'; texto = 'Launched ' + total + ' before · all still alive'; }
      else if (vivos > 0) { nivel = 'warn'; texto = 'Launched ' + total + ' before · ' + vivos + ' alive, ' + muertos + ' dead'; }
      else { nivel = 'warn'; texto = 'Launched ' + total + ' before'; }
      res = { creador: key, total, muertos, vivos, muestra, tokens: infos, nivel, texto };
    }
  } catch (_) { res = null; }
  if (res) _cache.set(key, res);
  return res;
}

/* Para pruebas/forzar recarga. */
export function olvidarCreador(creador) { try { _cache.delete(String(creador).toLowerCase()); } catch (_) {} }
