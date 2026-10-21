/* terminal/resolver.js. Resuelve un CONTRATO (lo unico que identifica de verdad a un token) a un item
   usable por la Terminal. Un nombre o un simbolo pueden repetirse en miles de tokens; la direccion no.
   Busca el par real en PancakeSwap (getPair con WBNB y, si no, con USDT), lee metadatos y reservas EN
   CADENA y devuelve un item con el mismo formato que el feed. Sin servidor, sin datos inventados: si el
   contrato no tiene par, devuelve null. Modulo sellado: solo importa de ./ dentro del propio modulo. */
import * as ethers from './ethers.min.js';
import { conRotacion } from './rpc.js';
import { FACTORY, WBNB, USDT, DEXSCREENER_TOK } from './config.js';
import { metaToken, reservasPar } from './motor.js';

const ABI_FACTORY = ['function getPair(address,address) view returns (address)'];
const CERO = '0x0000000000000000000000000000000000000000';
const low = (s) => String(s || '').toLowerCase();

/* Busca el token en DexScreener (TODAS las DEX de BSC: V2, V3, Biswap, etc.). Devuelve el par de MAS liquidez
   con su precio en USD. Asi aparecen tokens que no tienen par PancakeSwap V2 (Launchpad, V3, verificados) que
   antes no salian en la busqueda. Si el mejor par es PancakeSwap V2 contra WBNB/USDT, ademas es graficable. */
async function dexScreenerBSC(token) {
  let j; try { const r = await fetch(DEXSCREENER_TOK + token); j = await r.json(); } catch (_) { return null; }
  const pares = (j && j.pairs) || [];
  const bsc = pares.filter((p) => p && p.chainId === 'bsc' && p.baseToken && low(p.baseToken.address) === low(token));
  if (!bsc.length) return null;
  bsc.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
  const best = bsc[0];
  const qAddr = (best.quoteToken && best.quoteToken.address) || null;
  const esWbnb = qAddr && low(qAddr) === low(WBNB), esUsdt = qAddr && low(qAddr) === low(USDT);
  const v2 = best.dexId === 'pancakeswap' && (best.labels || []).map(low).includes('v2') && (esWbnb || esUsdt);
  return {
    par: best.pairAddress || null, quoteAddr: qAddr,
    moneda: esUsdt ? 'USDT' : (esWbnb ? 'BNB' : ((best.quoteToken && best.quoteToken.symbol) || 'BNB')),
    precioUsd: Number(best.priceUsd) || 0,
    liquidezUsd: (best.liquidity && best.liquidity.usd) || 0,
    simbolo: (best.baseToken && best.baseToken.symbol) || '',
    nombre: (best.baseToken && best.baseToken.name) || '',
    dex: best.dexId || 'dex', chartableV2: !!v2
  };
}

/* True si el texto es un contrato valido: 0x..40 (BSC) o T + 33 Base58 (Tron). La busqueda es GLOBAL y
   multicadena: BSC es operable; Tron aparece para info + alertas (no operable). */
export function esContrato(txt) {
  const s = String(txt || '').trim();
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s)) return true;   // Tron (TRC20)
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return false;
  try { ethers.getAddress(s); return true; } catch (_) { return false; }
}

async function parDe(token, quote) {
  try { const p = await conRotacion((pr) => new ethers.Contract(FACTORY, ABI_FACTORY, pr).getPair(token, quote)); return (p && String(p).toLowerCase() !== CERO) ? p : null; } catch (_) { return null; }
}

/* Resuelve un contrato a un item {token,par,quote,moneda,simbolo,nombre,decimales,liquidez,precio,...} o null. */
export async function resolverContrato(addr) {
  const s = String(addr || '').trim();
  // Tron (T...): red no operable -> info + alertas via TronScan (tron.js). Carga perezosa para no pesar en BSC.
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s)) { try { const { resolverTron } = await import('./tron.js'); return await resolverTron(s); } catch (_) { return null; } }
  let token; try { token = ethers.getAddress(s); } catch (_) { return null; }
  // Busca el par con WBNB y con USDT A LA VEZ y se queda con el de MAS liquidez real (mas token bloqueado en
  // la pool). Hay tokens (p.ej. USDT.z) cuyo par con WBNB existe pero esta muerto, mientras el bueno es contra
  // USDT: quedarse con el primero que existiera tomaba el par muerto -> precio raro y grafica vacia en el OFC.
  const [pBNB, pU] = await Promise.all([parDe(token, WBNB), parDe(token, USDT)]);
  const cand = [];
  if (pBNB) cand.push({ par: pBNB, quote: WBNB, moneda: 'BNB' });
  if (pU) cand.push({ par: pU, quote: USDT, moneda: 'USDT' });
  let meta = { nombre: '', simbolo: '', decimales: 18 };
  try { meta = await metaToken(token); } catch (_) {}
  const dec = meta.decimales || 18;
  if (cand.length) {
    // Hay par V2 (WBNB/USDT): precio por reservas y GRAFICABLE (eventos Sync). Se elige el de mas token
    // bloqueado (= liquidez/precio): es el MISMO token en ambos, comparable sin convertir divisas.
    const infos = await Promise.all(cand.map(async (c) => {
      let r = { liquidez: 0, precio: 0 }; try { r = await reservasPar(c.par, token, dec); } catch (_) {}
      return { ...c, r, tok: (r.precio > 0 ? r.liquidez / r.precio : 0) };
    }));
    let sel = infos[0]; for (const i of infos) if (i.tok > sel.tok) sel = i;
    return {
      token, par: sel.par, quote: sel.quote, moneda: sel.moneda,
      simbolo: meta.simbolo || '?', nombre: meta.nombre || meta.simbolo || 'Token', decimales: dec,
      liquidez: sel.r.liquidez || 0, precio: sel.r.precio || 0,
      fuente: 'pancake', fuentePrecio: 'v2', graficable: true, operable: true, red: 'bsc',
      tiempo: 0, creador: '', resuelto: true
    };
  }
  // Sin par V2: buscar GLOBAL en DexScreener (cualquier DEX de BSC). Asi aparecen Launchpad, V3 y verificados.
  const dx = await dexScreenerBSC(token);
  if (dx) {
    return {
      token, par: dx.par, quote: dx.quoteAddr || null, moneda: dx.moneda,
      simbolo: meta.simbolo || dx.simbolo || '?', nombre: meta.nombre || dx.nombre || meta.simbolo || 'Token', decimales: dec,
      liquidez: 0, liquidezUsd: dx.liquidezUsd || 0, precio: 0, precioUsd: dx.precioUsd || 0,
      // precio en USD directo de DexScreener; graficable solo si el mejor par es PancakeSwap V2 WBNB/USDT.
      fuente: dx.dex || 'dex', fuentePrecio: dx.chartableV2 ? 'v2' : 'dex', graficable: !!dx.chartableV2, operable: true, red: 'bsc',
      tiempo: 0, creador: '', resuelto: true
    };
  }
  // Sin par ni en DexScreener (token de Launchpad pre-graduacion, o un contrato sin pool todavia): en vez de
  // devolver null y que salga "no hay nada", se devuelve un item MINIMO. Asi al menos el ANALIZADOR se dispara
  // (lee codigo, owner, holders en cadena) y la grafica intenta GeckoTerminal. No operable ni graficable por V2.
  if (meta.simbolo || meta.nombre) {
    return {
      token, par: null, quote: null, moneda: 'BNB',
      simbolo: meta.simbolo || '?', nombre: meta.nombre || meta.simbolo || 'Token', decimales: dec,
      liquidez: 0, precio: 0, precioUsd: 0,
      fuente: 'onchain', fuentePrecio: 'dex', graficable: false, operable: false, red: 'bsc',
      soloAnalisis: true, tiempo: 0, creador: '', resuelto: true
    };
  }
  return null;
}
