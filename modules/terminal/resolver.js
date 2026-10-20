/* terminal/resolver.js. Resuelve un CONTRATO (lo unico que identifica de verdad a un token) a un item
   usable por la Terminal. Un nombre o un simbolo pueden repetirse en miles de tokens; la direccion no.
   Busca el par real en PancakeSwap (getPair con WBNB y, si no, con USDT), lee metadatos y reservas EN
   CADENA y devuelve un item con el mismo formato que el feed. Sin servidor, sin datos inventados: si el
   contrato no tiene par, devuelve null. Modulo sellado: solo importa de ./ dentro del propio modulo. */
import * as ethers from './ethers.min.js';
import { conRotacion } from './rpc.js';
import { FACTORY, WBNB, USDT } from './config.js';
import { metaToken, reservasPar } from './motor.js';

const ABI_FACTORY = ['function getPair(address,address) view returns (address)'];
const CERO = '0x0000000000000000000000000000000000000000';

/* True si el texto es una direccion 0x valida (40 hex). */
export function esContrato(txt) {
  const s = String(txt || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return false;
  try { ethers.getAddress(s); return true; } catch (_) { return false; }
}

async function parDe(token, quote) {
  try { const p = await conRotacion((pr) => new ethers.Contract(FACTORY, ABI_FACTORY, pr).getPair(token, quote)); return (p && String(p).toLowerCase() !== CERO) ? p : null; } catch (_) { return null; }
}

/* Resuelve un contrato a un item {token,par,quote,moneda,simbolo,nombre,decimales,liquidez,precio,...} o null. */
export async function resolverContrato(addr) {
  let token; try { token = ethers.getAddress(String(addr || '').trim()); } catch (_) { return null; }
  // Busca el par con WBNB y con USDT A LA VEZ y se queda con el de MAS liquidez real (mas token bloqueado en
  // la pool). Hay tokens (p.ej. USDT.z) cuyo par con WBNB existe pero esta muerto, mientras el bueno es contra
  // USDT: quedarse con el primero que existiera tomaba el par muerto -> precio raro y grafica vacia en el OFC.
  const [pBNB, pU] = await Promise.all([parDe(token, WBNB), parDe(token, USDT)]);
  const cand = [];
  if (pBNB) cand.push({ par: pBNB, quote: WBNB, moneda: 'BNB' });
  if (pU) cand.push({ par: pU, quote: USDT, moneda: 'USDT' });
  if (!cand.length) return null;
  let meta = { nombre: '', simbolo: '', decimales: 18 };
  try { meta = await metaToken(token); } catch (_) {}
  const dec = meta.decimales || 18;
  // Reservas de cada candidato. Se compara por reserva de TOKEN (= liquidez/precio): es el MISMO token en
  // ambos pares, asi que se puede comparar sin convertir BNB a USD. Si una lectura falla, cuenta como 0.
  const infos = await Promise.all(cand.map(async (c) => {
    let r = { liquidez: 0, precio: 0 }; try { r = await reservasPar(c.par, token, dec); } catch (_) {}
    return { ...c, r, tok: (r.precio > 0 ? r.liquidez / r.precio : 0) };
  }));
  let sel = infos[0]; for (const i of infos) if (i.tok > sel.tok) sel = i;
  return {
    token, par: sel.par, quote: sel.quote, moneda: sel.moneda,
    simbolo: meta.simbolo || '?',
    nombre: meta.nombre || meta.simbolo || 'Token',
    decimales: dec,
    liquidez: sel.r.liquidez || 0,
    precio: sel.r.precio || 0,
    fuente: 'pancake', tiempo: 0, creador: '', resuelto: true
  };
}
