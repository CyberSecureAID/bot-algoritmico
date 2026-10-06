/* shield-poison.js — Address Poisoning Checker.
   Detecta el ataque de "envenenamiento de direcciones": el atacante crea una
   dirección gemela (mismo prefijo y sufijo que una con la que sueles operar,
   pero distinta en el medio) y te envía un dust o transferencia de valor cero,
   para que la copies por error de tu historial y le mandes fondos.
   Este módulo cruza el historial y avisa de esas direcciones trampa.
   Todo con datos públicos del RPC + NodeReal. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';

const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io'];
let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
export function esDireccion(s) { s = (s || '').trim(); return /^0x[0-9a-fA-F]{40}$/.test(s) || /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s); }

/* Cuántos caracteres coinciden al inicio y al final entre dos direcciones. */
function coincidencia(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (a === b) return { pref: 42, suf: 42, iguales: true };
  let pref = 0; while (pref < a.length && a[pref] === b[pref]) pref++;
  let suf = 0; while (suf < a.length && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  return { pref: pref, suf: suf, iguales: false };
}

/* Analiza el historial de una wallet en busca de direcciones envenenadas.
   historial: la lista de operaciones (de historialDe del watcher).
   Devuelve grupos de direcciones sospechosas con su gemela legítima. */
export function analizar(cuenta, historial) {
  const out = { amenazas: [], contrapartesTotales: 0, dustSospechoso: 0 };
  if (!Array.isArray(historial) || !historial.length) return out;
  const mia = (cuenta || '').toLowerCase();

  // recopilar todas las contrapartes con su evidencia (veces, monto, fecha, símbolo)
  const contrapartes = new Map();
  for (const op of historial) {
    const cp = (op.contraparte || '').toLowerCase();
    if (!cp || cp === mia || !esDireccion(cp)) continue;
    if (!contrapartes.has(cp)) contrapartes.set(cp, { addr: cp, vecesReal: 0, vecesDust: 0, montoMax: 0, veces: 0, ultTs: 0, ultSym: '', ultTipo: '', ultMonto: 0 });
    const c = contrapartes.get(cp);
    const monto = Number(op.cantidad) || 0;
    c.veces++;
    if (op.ts && op.ts > c.ultTs) { c.ultTs = op.ts; c.ultSym = op.symbol || ''; c.ultTipo = op.tipo || ''; c.ultMonto = monto; }
    if (!c.ultSym) { c.ultSym = op.symbol || ''; c.ultTipo = op.tipo || ''; c.ultMonto = monto; }
    if (op.tipo === 'in' && monto <= 0.0001) c.vecesDust++;
    else { c.vecesReal++; if (monto > c.montoMax) c.montoMax = monto; }
  }
  out.contrapartesTotales = contrapartes.size;
  // lista completa para mostrar al usuario (ordenada: sospechosas primero, luego por veces)
  out.todasContrapartes = [...contrapartes.values()].map(function (c) {
    return { addr: c.addr, veces: c.veces, esDust: c.vecesReal === 0 && c.vecesDust > 0, symbol: c.ultSym, tipo: c.ultTipo, monto: c.ultMonto, ts: c.ultTs, montoMax: c.montoMax };
  }).sort(function (a, b) { return (b.esDust - a.esDust) || (b.veces - a.veces); });

  const todas = [...contrapartes.values()];
  // las "legítimas" = con las que hubo movimiento real de valor
  const legitimas = todas.filter(function (c) { return c.vecesReal > 0 && c.montoMax > 0; });
  // las "sospechosas" = solo aparecieron por dust/valor cero
  const sospechosas = todas.filter(function (c) { return c.vecesReal === 0 && c.vecesDust > 0; });
  out.dustSospechoso = sospechosas.length;

  // para cada sospechosa, ver si imita a una legítima (mismo prefijo+sufijo)
  for (const susp of sospechosas) {
    for (const leg of legitimas) {
      const m = coincidencia(susp.addr, leg.addr);
      // umbral: prefijo (incluye "0x") >= 6 y sufijo >= 4  → imitación clara
      // (0x + 4 chars reales de prefijo = 6; 4 de sufijo)
      if (m.pref >= 6 && m.suf >= 4) {
        out.amenazas.push({
          falsa: susp.addr,
          real: leg.addr,
          prefijoIguales: m.pref,
          sufijoIguales: m.suf,
          montoReal: leg.montoMax
        });
        break; // una coincidencia basta para marcarla
      }
    }
  }
  return out;
}

/* Comprueba si una dirección concreta que el usuario va a usar es sospechosa
   respecto a su historial (para el modo "verificar antes de enviar"). */
export function comprobarDestino(destino, historial, cuenta) {
  const res = { riesgo: 'ok', gemela: null, coincide: null };
  if (!esDireccion(destino) || !Array.isArray(historial)) return res;
  const mia = (cuenta || '').toLowerCase();
  const d = destino.toLowerCase();
  // recopilar contrapartes legítimas (con valor real)
  const legit = new Map();
  for (const op of historial) {
    const cp = (op.contraparte || '').toLowerCase();
    if (!cp || cp === mia || cp === d) continue;
    const monto = Number(op.cantidad) || 0;
    if (monto > 0.0001) legit.set(cp, true);
  }
  // ¿el destino se parece peligrosamente a alguna legítima (pero no es ella)?
  for (const leg of legit.keys()) {
    const m = coincidencia(d, leg);
    if (!m.iguales && m.pref >= 6 && m.suf >= 4) {
      res.riesgo = 'danger'; res.gemela = leg; res.coincide = m; return res;
    }
  }
  return res;
}
