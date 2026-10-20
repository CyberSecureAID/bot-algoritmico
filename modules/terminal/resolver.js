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
  let par = await parDe(token, WBNB), quote = WBNB, moneda = 'BNB';
  if (!par) { par = await parDe(token, USDT); quote = USDT; moneda = 'USDT'; }
  if (!par) return null;
  let meta = { nombre: '', simbolo: '', decimales: 18 };
  try { meta = await metaToken(token); } catch (_) {}
  const dec = meta.decimales || 18;
  let r = { liquidez: 0, precio: 0 };
  try { r = await reservasPar(par, token, dec); } catch (_) {}
  return {
    token, par, quote, moneda,
    simbolo: meta.simbolo || '?',
    nombre: meta.nombre || meta.simbolo || 'Token',
    decimales: dec,
    liquidez: r.liquidez || 0,
    precio: r.precio || 0,
    fuente: 'pancake', tiempo: 0, creador: '', resuelto: true
  };
}
