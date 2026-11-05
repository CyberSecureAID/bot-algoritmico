/* modules/trading-demo/motor.js — Motor del Trading Demo.

   Simulador de futuros 100% del lado del cliente: balance de práctica,
   posiciones con PnL en vivo, Stop Loss / Take Profit, precio de liquidación,
   órdenes marcadas (limit) que entran cuando el precio las toca, comisiones
   estilo Binance e historial (track record). Sin órdenes reales ni backend.
   Todo en localStorage (solo este navegador; es práctica, no dinero real).

   PnL EN VIVO = movimiento puro del precio (igual que Binance: el PnL no
   realizado NO lleva comisiones; por eso un long por encima de la entrada va
   en verde). Las comisiones (taker 0,04% por lado, ida y vuelta) se cobran al
   CERRAR, sobre el nominal. Notación: `tam` = nominal en USDT; cantidad base =
   tam/entrada; margen = tam/apalancamiento; ROE = PnL/margen. */

const LS = 'td-demo-v1';
const BAL0 = 10000;
const FEE = 0.0004;         // taker por lado (Binance ~0,04%)

let _id = 1;
const nid = () => 'o' + (Date.now().toString(36)) + (_id++);
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

function cargar() {
  try { const s = JSON.parse(localStorage.getItem(LS)); if (s && typeof s.balance === 'number') { s.pos = s.pos || []; s.ord = s.ord || []; s.hist = s.hist || []; return s; } } catch (_) {}
  return { balance: BAL0, pos: [], ord: [], hist: [], realizado: 0 };
}
let ST = cargar();
function guardar() { try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (_) {} }

export function estado() { return ST; }
export function balance() { return r2(ST.balance); }
export function posiciones() { return ST.pos; }
export function ordenes() { return ST.ord; }
export function historial() { return ST.hist; }
export function reset() { ST = { balance: BAL0, pos: [], ord: [], hist: [], realizado: 0 }; guardar(); return ST; }
export const comisionPct = () => FEE * 2 * 100;   // ida y vuelta, en %

/* Precio de liquidacion. Igual criterio que el area de futuros: umbral de ROE
   dividido por el apalancamiento. El umbral varia con el apalancamiento: bajo
   (<=10x) aguanta hasta ~80% de ROE en contra antes de saltar; alto (>=25x)
   salta antes, ~75%. Al tocar ese precio la posicion se liquida y se pierde el
   100% del margen de ESA posicion (no la cuenta entera). */
function umbralLiq(lev) { return lev <= 10 ? 0.80 : lev >= 25 ? 0.75 : 0.80 - (lev - 10) * (0.05 / 15); }
function liqDe(lado, entrada, lev) { const u = umbralLiq(lev); return lado === 'long' ? entrada * (1 - u / lev) : entrada * (1 + u / lev); }
export function liqPrecio(lado, entrada, lev) { return liqDe(lado, entrada, lev); }

/* PnL no realizado PURO (sin comisiones), como el de Binance. */
export function pnlDe(p, mark) {
  const qty = p.tam / p.entrada;
  const pnl = p.lado === 'long' ? (mark - p.entrada) * qty : (p.entrada - mark) * qty;
  const roe = p.margen > 0 ? (pnl / p.margen) * 100 : 0;
  return { pnl, roe, qty };
}
export function feeRueda(tam) { return tam * FEE * 2; }   // comisión total estimada (ida y vuelta)

/* Equity en vivo = balance + (margen + PnL no realizado) de cada posicion, pero
   el aporte de una posicion nunca baja de 0: en margen aislado no puedes perder
   mas que tu margen, asi que el equity nunca es negativo. */
export function equity(marks) {
  let e = ST.balance;
  ST.pos.forEach((p) => { const m = (marks && marks[p.par]) || p.entrada; e += Math.max(0, p.margen + pnlDe(p, m).pnl); });
  return r2(e);
}

export function abrirMercado(par, lado, tam, lev, mark, tp, sl) {
  if (!(mark > 0) || !(tam > 0)) return { ok: false, motivo: 'precio' };
  const margen = tam / lev;
  if (margen > ST.balance + 1e-9) return { ok: false, motivo: 'saldo' };
  const pos = { id: nid(), par, lado, entrada: mark, tam, lev, margen, liq: liqDe(lado, mark, lev), tp: tp || null, sl: sl || null, t: Date.now() };
  ST.balance = r2(ST.balance - margen);
  ST.pos.push(pos); guardar();
  return { ok: true, pos };
}

export function colocarOrden(par, lado, tam, lev, precio, mark, tp, sl) {
  if (!(precio > 0) || !(tam > 0)) return { ok: false, motivo: 'precio' };
  const margen = tam / lev;
  if (margen > ST.balance + 1e-9) return { ok: false, motivo: 'saldo' };
  const desde = mark >= precio ? 'arriba' : 'abajo';
  const ord = { id: nid(), par, lado, tam, lev, precio, desde, tp: tp || null, sl: sl || null, t: Date.now() };
  ST.ord.push(ord); guardar();
  return { ok: true, ord };
}

export function cancelarOrden(id) { const i = ST.ord.findIndex((o) => o.id === id); if (i >= 0) { ST.ord.splice(i, 1); guardar(); return true; } return false; }

export function setTPSL(id, tp, sl) {
  const p = ST.pos.find((x) => x.id === id) || ST.ord.find((x) => x.id === id);
  if (!p) return false;
  p.tp = (tp > 0) ? tp : null; p.sl = (sl > 0) ? sl : null; guardar(); return true;
}

/* `neto` ya es el PnL neto (con comisión aplicada y limitado al margen). */
function registrar(p, salida, neto, fee, motivo) {
  neto = r2(neto); const roe = p.margen > 0 ? (neto / p.margen) * 100 : 0;
  ST.hist.unshift({ id: p.id, par: p.par, lado: p.lado, lev: p.lev, tam: p.tam, entrada: p.entrada, salida, pnl: neto, fee: r2(fee), roe, motivo, abierto: p.t, cerrado: Date.now() });
  if (ST.hist.length > 1000) ST.hist.length = 1000;   // historial largo (scroll/paginado en la UI)
}

/* Cerrar al precio `mark`. Comisión ida y vuelta sobre el nominal. La pérdida
   NUNCA supera el margen (margen aislado): así el balance no se vuelve negativo. */
export function cerrar(id, mark, motivo) {
  const i = ST.pos.findIndex((p) => p.id === id); if (i < 0) return null;
  const p = ST.pos[i];
  const gross = pnlDe(p, mark).pnl, fee = feeRueda(p.tam);
  let neto = gross - fee;
  if (neto < -p.margen) neto = -p.margen;    // tope: no pierdes mas que tu margen
  ST.balance = r2(ST.balance + p.margen + neto);
  ST.realizado = r2(ST.realizado + neto);
  registrar(p, mark, neto, fee, motivo || 'manual');
  ST.pos.splice(i, 1); guardar();
  return { pos: p, pnl: neto, gross, fee, salida: mark, motivo: motivo || 'manual' };
}

/* Nuevo precio: fills de órdenes marcadas, TP/SL y liquidaciones. */
export function onPrecio(par, mark) {
  const ev = { fills: [], tp: [], sl: [], liqs: [] };
  if (!(mark > 0)) return ev;
  for (let i = ST.ord.length - 1; i >= 0; i--) {
    const o = ST.ord[i]; if (o.par !== par) continue;
    const toca = o.desde === 'arriba' ? mark <= o.precio : mark >= o.precio;
    if (toca) { const r = abrirMercado(par, o.lado, o.tam, o.lev, o.precio, o.tp, o.sl); ST.ord.splice(i, 1); if (r.ok) ev.fills.push(r.pos); }
  }
  for (let i = ST.pos.length - 1; i >= 0; i--) {
    const p = ST.pos[i]; if (p.par !== par) continue;
    const liq = p.lado === 'long' ? mark <= p.liq : mark >= p.liq;
    const slHit = p.sl && (p.lado === 'long' ? mark <= p.sl : mark >= p.sl);
    const tpHit = p.tp && (p.lado === 'long' ? mark >= p.tp : mark <= p.tp);
    if (liq) { registrar(p, p.liq, -p.margen, 0, 'liq'); ST.pos.splice(i, 1); ST.realizado = r2(ST.realizado - p.margen); ev.liqs.push(p); }
    else if (slHit) { const r = cerrar(p.id, p.sl, 'sl'); if (r) ev.sl.push(r); }
    else if (tpHit) { const r = cerrar(p.id, p.tp, 'tp'); if (r) ev.tp.push(r); }
  }
  if (ev.fills.length || ev.liqs.length) guardar();
  return ev;
}

export function stats(dias = 30) {
  const desde = Date.now() - dias * 86400000;
  const h = ST.hist.filter((x) => x.cerrado >= desde);
  const total = h.reduce((a, x) => a + x.pnl, 0), wins = h.filter((x) => x.pnl > 0).length, n = h.length;
  return { n, total: r2(total), wins, losses: n - wins, winRate: n ? Math.round((wins / n) * 100) : 0 };
}

export function csv() {
  const cab = 'Closed,Pair,Side,Leverage,Size USDT,Entry,Exit,PnL USDT,Fee USDT,ROE %,Result';
  const fila = (x) => [new Date(x.cerrado).toISOString(), x.par + 'USDT', x.lado, x.lev + 'x', x.tam.toFixed(2), x.entrada, x.salida, x.pnl.toFixed(2), (x.fee || 0).toFixed(2), x.roe.toFixed(2), x.motivo].join(',');
  return [cab].concat(ST.hist.map(fila)).join('\n');
}
