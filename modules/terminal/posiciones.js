/* terminal/posiciones.js. Mis posiciones del Terminal (modulo sellado). NO custodial, SIN servidor.
   Al comprar un token por el Terminal se guarda la entrada (tokens recibidos y lo pagado) en el
   navegador, por wallet. El panel lee el SALDO y el PRECIO actuales EN CADENA y calcula el valor y la
   ganancia o perdida en vivo. El saldo on-chain manda sobre el monto guardado (si vendiste por fuera,
   se refleja). El coste de entrada es el de tus compras hechas aqui. */
import * as ethers from './ethers.min.js';
import { conRotacion } from './rpc.js';
import { precioActual } from './grafico.js';

const KEY = 'df_terminal_pos_v1';
const KEY_H = 'df_terminal_hist_v1';
const ERC = ['function balanceOf(address) view returns (uint256)'];
const clave = (w) => String(w || '').toLowerCase();

function leerTodo() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { return {}; } }
function guardar(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_) {} }
function leerHist() { try { return JSON.parse(localStorage.getItem(KEY_H) || '{}'); } catch (_) { return {}; } }
function apuntarHist(wallet, e) { try { const all = leerHist(); const w = clave(wallet); const arr = all[w] || (all[w] = []); arr.unshift({ ...e, ts: Date.now() }); if (arr.length > 120) arr.length = 120; localStorage.setItem(KEY_H, JSON.stringify(all)); } catch (_) {} }

/* Historial de operaciones hechas por el Terminal (array, mas reciente primero). */
export function historialDe(wallet) { try { return (leerHist()[clave(wallet)] || []).slice(); } catch (_) { return []; } }

/* Posiciones guardadas de una wallet (array). */
export function listaDe(wallet) { const t = leerTodo()[clave(wallet)] || {}; return Object.values(t); }

/* Registrar una compra hecha por el Terminal: suma tokens y coste. */
export function registrarCompra(wallet, it, tokensRecibidos, bnbWei, bnbUsd) {
  try {
    if (!wallet || !it || !(tokensRecibidos > 0n)) return;
    const all = leerTodo(); const w = clave(wallet); const m = all[w] || (all[w] = {});
    const k = String(it.token).toLowerCase();
    const p = m[k] || (m[k] = { token: it.token, simbolo: it.simbolo || '?', nombre: it.nombre || '', par: it.par || null, quote: it.quote || null, moneda: it.moneda || 'BNB', decimales: it.decimales || 18, cantidad: '0', costoBnb: '0', costoUsd: 0, abierta: Date.now() });
    p.cantidad = (BigInt(p.cantidad) + tokensRecibidos).toString();
    p.costoBnb = (BigInt(p.costoBnb) + BigInt(bnbWei)).toString();
    p.costoUsd = (p.costoUsd || 0) + Number(ethers.formatEther(bnbWei)) * (bnbUsd || 0);
    p.ult = Date.now();
    guardar(all);
    apuntarHist(wallet, { side: 'buy', token: it.token, simbolo: it.simbolo || '?', nombre: it.nombre || '', par: it.par || null, quote: it.quote || null, moneda: it.moneda || 'BNB', decimales: it.decimales || 18, cant: Number(ethers.formatUnits(tokensRecibidos, it.decimales || 18)) || 0, usd: Number(ethers.formatEther(bnbWei)) * (bnbUsd || 0) });
  } catch (_) {}
}

/* Registrar una venta hecha por el Terminal: baja el monto y el coste en proporcion. */
export function registrarVenta(wallet, token, tokensVendidos) {
  try {
    const all = leerTodo(); const m = all[clave(wallet)]; if (!m) return;
    const k = String(token).toLowerCase(); const p = m[k]; if (!p) return;
    const tenia = BigInt(p.cantidad); if (tenia <= 0n) { delete m[k]; guardar(all); return; }
    const vend = tokensVendidos > tenia ? tenia : tokensVendidos;
    const fracBps = vend * 10000n / tenia;
    p.costoBnb = (BigInt(p.costoBnb) - BigInt(p.costoBnb) * fracBps / 10000n).toString();
    p.costoUsd = p.costoUsd - p.costoUsd * (Number(fracBps) / 10000);
    p.cantidad = (tenia - vend).toString();
    if (BigInt(p.cantidad) <= 0n) delete m[k];
    apuntarHist(wallet, { side: 'sell', token: p.token, simbolo: p.simbolo || '?', nombre: p.nombre || '', par: p.par || null, quote: p.quote || null, moneda: p.moneda || 'BNB', decimales: p.decimales || 18, cant: Number(ethers.formatUnits(vend, p.decimales || 18)) || 0 });
    guardar(all);
  } catch (_) {}
}

/* Quitar una posicion de la lista (no mueve fondos; solo deja de mostrarla). */
export function olvidar(wallet, token) { const all = leerTodo(); const m = all[clave(wallet)]; if (m) { delete m[String(token).toLowerCase()]; guardar(all); } }

/* Datos en vivo de una posicion: saldo on-chain (monto real) + precio actual del par. */
export async function enVivo(wallet, pos, bnbUsd) {
  const dec = pos.decimales || 18;
  const out = { ...pos, saldo: 0n, cant: 0, precioUsd: 0, valorUsd: 0, costoUsd: pos.costoUsd || 0, pnlUsd: 0, pnlPct: 0, entradaUsd: 0 };
  try { out.saldo = await conRotacion((p) => new ethers.Contract(pos.token, ERC, p).balanceOf(wallet)); } catch (_) {}
  out.cant = Number(ethers.formatUnits(out.saldo, dec));
  out.precioUsd = await precioActual({ par: pos.par, token: pos.token, decToken: dec, decQuote: 18, bnbUsd, quoteEsUSDT: pos.moneda === 'USDT' });
  out.valorUsd = out.cant * out.precioUsd;
  // Coste proporcional al saldo que QUEDA (por si se vendio parte por fuera del Terminal).
  const cantGuardada = Number(ethers.formatUnits(BigInt(pos.cantidad || '0'), dec)) || 0;
  const factor = cantGuardada > 0 ? Math.min(1, out.cant / cantGuardada) : 1;
  out.costoUsd = (pos.costoUsd || 0) * factor;
  out.entradaUsd = out.cant > 0 && cantGuardada > 0 ? (pos.costoUsd || 0) / cantGuardada : 0;   // precio medio de entrada por token
  out.pnlUsd = out.valorUsd - out.costoUsd;
  out.pnlPct = out.costoUsd > 0 ? (out.pnlUsd / out.costoUsd) * 100 : 0;
  return out;
}
