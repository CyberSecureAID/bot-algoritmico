/* terminal/rpc.js. Un solo punto de acceso a los RPC publicos para todo el modulo (motor, auditoria, compra).
   Antes cada archivo creaba sus proveedores con los valores por defecto de ethers: sin tope de tiempo real
   (300 s) y con hasta 12 reintentos crecientes cuando el RPC devuelve 429. Con la lista, los filtros y la ficha
   leyendo a la vez, un RPC saturado dejaba una lectura colgada minutos y la ficha se quedaba en "Checking".
   Aqui: tope de 8 s por peticion, 2 intentos como mucho, rotacion al siguiente RPC si falla, y un limite de
   tiempo explicito para cualquier lectura compuesta (conTiempo). */

import * as ethers from './ethers.min.js';
import { RPCS } from './config.js';

const TOPE_MS = 8000;
let _idx = 0; const _prov = {};

export function provRPC(i) {
  const u = RPCS[((i % RPCS.length) + RPCS.length) % RPCS.length];
  if (!_prov[u]) {
    const req = new ethers.FetchRequest(u);
    req.timeout = TOPE_MS;
    req.setThrottleParams(2, 400);   // 429: dos intentos y fuera (el siguiente RPC toma el relevo)
    _prov[u] = new ethers.JsonRpcProvider(req, 56, { staticNetwork: true, batchMaxCount: 1 });
  }
  return _prov[u];
}

/* Ejecuta fn(proveedor) probando cada RPC una vez, empezando por el que funciono la ultima vez. */
export async function conRotacion(fn) {
  let err;
  for (let k = 0; k < RPCS.length; k++) {
    const i = _idx + k;
    try { return await conTiempo(fn(provRPC(i)), TOPE_MS + 1000); }
    catch (e) { err = e; _idx = (i + 1) % RPCS.length; }
  }
  throw err;
}

/* Promesa con limite de tiempo: nunca deja una lectura colgada. */
export function conTiempo(p, ms, etiqueta = 'timeout') {
  let t;
  const tope = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(etiqueta)), ms); });
  return Promise.race([p, tope]).finally(() => clearTimeout(t));
}

export const bloqueActual = () => conRotacion((p) => p.getBlockNumber());
