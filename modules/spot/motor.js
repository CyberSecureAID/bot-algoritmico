/* modules/spot/motor.js — Motor del Spot (no custodial, listo para smart contract).

   SPOT REAL, sin apalancamiento, sin margen y sin liquidación. Dos lados:

   · LONG  = comprar la moneda con USDT. Al cerrar se vende. La ganancia o la
     pérdida se mide en USDT.
   · SHORT = vender la moneda base que tienes (ej. BTC) al precio de entrada; el
     sistema marca cuánto y a qué precio. Al cerrar se RECOMPRA esa moneda. Si el
     precio bajó, con el mismo USDT compras MÁS moneda: la ganancia se mide en la
     MONEDA (más BTC). Si subió, recompras menos (pérdida en la moneda).

   Fórmulas (qty = amount/entrada, amount = valor en USDT comprometido):
   · long:  pnl_usdt  = qty * (mark - entrada)
   · short: pnl_moneda = amount/mark - amount/entrada

   Las posiciones, órdenes marcadas (limit) e historial viven en localStorage (este
   navegador). El SALDO real sale de la wallet (lo fija spot.js con setDisponible);
   el motor no custodia nada. Cuando exista el smart contract, él ejecutará los
   disparos (limit, TP, SL) con la misma lógica anti gap de onPrecio(). */

const LS = 'sp-spot-v1';
const FEE = 0.001;                 // taker spot aproximado (~0,1% por lado)

let _id = 1;
const nid = () => 'o' + (Date.now().toString(36)) + (_id++);
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

function cargar() {
  try { const s = JSON.parse(localStorage.getItem(LS)); if (s && Array.isArray(s.pos)) { s.ord = s.ord || []; s.hist = s.hist || []; return s; } } catch (_) {}
  return { pos: [], ord: [], hist: [] };
}
let ST = cargar();
function guardar() { try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (_) {} }

export function estado() { return ST; }
export function posiciones() { return ST.pos; }
export function ordenes() { return ST.ord; }
export function historial() { return ST.hist; }
export function reset() { ST = { pos: [], ord: [], hist: [] }; guardar(); return ST; }
export const comisionPct = () => FEE * 2 * 100;         // ida y vuelta, en %
export function feeRueda(amount) { return (amount || 0) * FEE * 2; }   // comisión estimada en USDT

/* Saldo disponible en USDT para dimensionar (lo fija spot.js desde la wallet real). */
let DISP = 0;
export function setDisponible(v) { DISP = Math.max(0, +v || 0); }
export function balance() { return r2(DISP); }

/* PnL no realizado. Devuelve { pnl, denom, qty, pct }:
   denom = 'USDT' para long, el símbolo de la moneda base para short. */
export function pnlDe(p, mark) {
  const qty = p.entrada > 0 ? p.amount / p.entrada : 0;
  if (p.lado === 'long') {
    const pnl = qty * (mark - p.entrada);
    const pct = p.entrada > 0 ? ((mark - p.entrada) / p.entrada) * 100 : 0;
    return { pnl, denom: 'USDT', qty, pct };
  }
  const pnl = (mark > 0 && p.entrada > 0) ? (p.amount / mark - p.amount / p.entrada) : 0;   // en la moneda base
  const pct = p.entrada > 0 ? ((p.entrada - mark) / p.entrada) * 100 : 0;
  return { pnl, denom: p.base || 'COIN', qty, pct };
}

export function abrirMercado(par, base, lado, amount, mark, tp, sl) {
  if (!(mark > 0) || !(amount > 0)) return { ok: false, motivo: 'precio' };
  const pos = { id: nid(), par, base, lado, entrada: mark, amount, qty: amount / mark, tp: tp || null, sl: sl || null, t: Date.now() };
  ST.pos.push(pos); guardar();
  return { ok: true, pos };
}

export function colocarOrden(par, base, lado, amount, precio, mark, tp, sl) {
  if (!(precio > 0) || !(amount > 0)) return { ok: false, motivo: 'precio' };
  const desde = mark >= precio ? 'arriba' : 'abajo';
  const ord = { id: nid(), par, base, lado, amount, precio, desde, tp: tp || null, sl: sl || null, t: Date.now() };
  ST.ord.push(ord); guardar();
  return { ok: true, ord };
}

export function cancelarOrden(id) { const i = ST.ord.findIndex((o) => o.id === id); if (i >= 0) { ST.ord.splice(i, 1); guardar(); return true; } return false; }

export function setTPSL(id, tp, sl) {
  const p = ST.pos.find((x) => x.id === id) || ST.ord.find((x) => x.id === id);
  if (!p) return false;
  p.tp = (tp > 0) ? tp : null; p.sl = (sl > 0) ? sl : null; guardar(); return true;
}

function registrar(p, salida, pnl, denom, fee, motivo) {
  ST.hist.unshift({ id: p.id, par: p.par, base: p.base, lado: p.lado, amount: p.amount, qty: p.entrada > 0 ? p.amount / p.entrada : 0, entrada: p.entrada, salida, pnl, denom, fee: r2(fee), motivo, abierto: p.t, cerrado: Date.now() });
  if (ST.hist.length > 1000) ST.hist.length = 1000;
}

/* Cerrar al precio `mark`. El PnL queda en su moneda (USDT para long, la base para
   short). La comisión es orientativa (ida y vuelta sobre el valor). */
export function cerrar(id, mark, motivo) {
  const i = ST.pos.findIndex((p) => p.id === id); if (i < 0) return null;
  const p = ST.pos[i];
  const info = pnlDe(p, mark), fee = feeRueda(p.amount);
  registrar(p, mark, info.pnl, info.denom, fee, motivo || 'manual');
  ST.pos.splice(i, 1); guardar();
  return { pos: p, pnl: info.pnl, denom: info.denom, fee, salida: mark, motivo: motivo || 'manual' };
}

/* Nuevo precio: fills de órdenes marcadas y TP/SL. ANTI-GAP: se dispara cuando el
   RANGO de la vela (high/low) TOCA el nivel, no solo al cierre. En short, el TP va
   por DEBAJO (gana al bajar) y el SL por ARRIBA, como en cualquier venta en corto.
   Esta es la misma lógica que ejecutará el smart contract cuando se conecte. */
export function onPrecio(par, mark, hi, lo) {
  const ev = { fills: [], tp: [], sl: [] };
  if (!(mark > 0)) return ev;
  hi = (hi > 0) ? Math.max(hi, mark) : mark;
  lo = (lo > 0) ? Math.min(lo, mark) : mark;
  for (let i = ST.ord.length - 1; i >= 0; i--) {
    const o = ST.ord[i]; if (o.par !== par) continue;
    const toca = o.desde === 'arriba' ? lo <= o.precio : hi >= o.precio;
    if (toca) { const rr = abrirMercado(par, o.base, o.lado, o.amount, o.precio, o.tp, o.sl); ST.ord.splice(i, 1); if (rr.ok) ev.fills.push(rr.pos); }
  }
  for (let i = ST.pos.length - 1; i >= 0; i--) {
    const p = ST.pos[i]; if (p.par !== par) continue;
    const esL = p.lado === 'long';
    const slHit = p.sl && (esL ? lo <= p.sl : hi >= p.sl);
    const tpHit = p.tp && (esL ? hi >= p.tp : lo <= p.tp);
    if (slHit) { const rr = cerrar(p.id, p.sl, 'sl'); if (rr) ev.sl.push(rr); }
    else if (tpHit) { const rr = cerrar(p.id, p.tp, 'tp'); if (rr) ev.tp.push(rr); }
  }
  if (ev.fills.length) guardar();
  return ev;
}

export function stats(dias = 30) {
  const desde = Date.now() - dias * 86400000;
  const h = ST.hist.filter((x) => x.cerrado >= desde);
  const n = h.length, wins = h.filter((x) => x.pnl > 0).length;
  return { n, wins, losses: n - wins, winRate: n ? Math.round((wins / n) * 100) : 0 };
}

export function csv() {
  const cab = 'Closed,Pair,Side,Amount USDT,Qty,Entry,Exit,PnL,Denom,Result';
  const fila = (x) => [new Date(x.cerrado).toISOString(), x.par + 'USDT', x.lado, (x.amount || 0).toFixed(2), (x.qty || 0), x.entrada, x.salida, (x.pnl || 0), x.denom, x.motivo].join(',');
  return [cab].concat(ST.hist.map(fila)).join('\n');
}
