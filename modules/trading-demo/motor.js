/* modules/trading-demo/motor.js — Motor del Trading Demo.

   Simulador de futuros 100% del lado del cliente: balance de práctica,
   posiciones, PnL en vivo, precio de liquidación aproximado, órdenes
   "marcadas" que entran cuando el precio las toca, e historial de operaciones
   cerradas (track record). Sin órdenes reales, sin contrato, sin backend. Todo
   se guarda en localStorage (solo este navegador; es práctica, no dinero real).

   Notación: `tam` = tamaño en USDT (nominal). cantidad base = tam / entrada.
   margen = tam / apalancamiento. PnL long = (precio − entrada) * cantidad;
   short = (entrada − precio) * cantidad. ROE = PnL / margen. */

const LS = 'td-demo-v1';
const BAL0 = 10000;
const MMR = 0.004;
const FEE = 0.0004;

let _id = 1;
const nid = () => 'o' + (Date.now().toString(36)) + (_id++);

function cargar() {
  try { const s = JSON.parse(localStorage.getItem(LS)); if (s && typeof s.balance === 'number') { s.pos = s.pos || []; s.ord = s.ord || []; s.hist = s.hist || []; return s; } } catch (_) {}
  return { balance: BAL0, pos: [], ord: [], hist: [], realizado: 0 };
}
let ST = cargar();
function guardar() { try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (_) {} }

export function estado() { return ST; }
export function balance() { return redondear(ST.balance); }
export function posiciones() { return ST.pos; }
export function ordenes() { return ST.ord; }
export function historial() { return ST.hist; }
export function reset() { ST = { balance: BAL0, pos: [], ord: [], hist: [], realizado: 0 }; guardar(); return ST; }

const redondear = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
function liqDe(lado, entrada, lev) { const f = 1 / lev - MMR; return lado === 'long' ? entrada * (1 - f) : entrada * (1 + f); }

export function pnlDe(p, mark) {
  const qty = p.tam / p.entrada;
  const bruto = p.lado === 'long' ? (mark - p.entrada) * qty : (p.entrada - mark) * qty;
  const pnl = bruto - p.tam * FEE * 2;
  const roe = p.margen > 0 ? (pnl / p.margen) * 100 : 0;
  return { pnl, roe, qty };
}

/* Equity en vivo = balance + PnL no realizado de las posiciones abiertas.
   `marks` es un mapa { par: precioActual } que mantiene la UI. */
export function equity(marks) {
  let e = ST.balance;
  ST.pos.forEach((p) => { const m = (marks && marks[p.par]) || p.entrada; e += pnlDe(p, m).pnl + p.margen; });
  return redondear(e);
}

export function abrirMercado(par, lado, tam, lev, mark) {
  if (!(mark > 0) || !(tam > 0)) return { ok: false, motivo: 'precio' };
  const margen = tam / lev;
  if (margen > ST.balance + 1e-9) return { ok: false, motivo: 'saldo' };
  const pos = { id: nid(), par, lado, entrada: mark, tam, lev, margen, liq: liqDe(lado, mark, lev), t: Date.now() };
  ST.balance = redondear(ST.balance - margen);
  ST.pos.push(pos); guardar();
  return { ok: true, pos };
}

export function colocarOrden(par, lado, tam, lev, precio, mark) {
  if (!(precio > 0) || !(tam > 0)) return { ok: false, motivo: 'precio' };
  const margen = tam / lev;
  if (margen > ST.balance + 1e-9) return { ok: false, motivo: 'saldo' };
  const desde = mark >= precio ? 'arriba' : 'abajo';
  const ord = { id: nid(), par, lado, tam, lev, precio, desde, t: Date.now() };
  ST.ord.push(ord); guardar();
  return { ok: true, ord };
}

export function cancelarOrden(id) {
  const i = ST.ord.findIndex((o) => o.id === id);
  if (i >= 0) { ST.ord.splice(i, 1); guardar(); return true; }
  return false;
}

function registrar(p, salida, pnl, motivo) {
  const { roe } = pnlDe(p, salida);
  ST.hist.unshift({ id: p.id, par: p.par, lado: p.lado, lev: p.lev, tam: p.tam, entrada: p.entrada, salida, pnl: redondear(pnl), roe, motivo, abierto: p.t, cerrado: Date.now() });
  if (ST.hist.length > 300) ST.hist.length = 300;
}

export function cerrar(id, mark) {
  const i = ST.pos.findIndex((p) => p.id === id);
  if (i < 0) return null;
  const p = ST.pos[i];
  const { pnl } = pnlDe(p, mark);
  ST.balance = redondear(ST.balance + p.margen + pnl);
  ST.realizado = redondear(ST.realizado + pnl);
  registrar(p, mark, pnl, 'manual');
  ST.pos.splice(i, 1); guardar();
  return { pos: p, pnl, salida: mark };
}

/* Nuevo precio: dispara órdenes marcadas que el precio toca y liquida
   posiciones cuyo precio de liquidación se alcanza. Devuelve los eventos. */
export function onPrecio(par, mark) {
  const ev = { fills: [], liqs: [] };
  if (!(mark > 0)) return ev;
  for (let i = ST.ord.length - 1; i >= 0; i--) {
    const o = ST.ord[i];
    if (o.par !== par) continue;
    const toca = o.desde === 'arriba' ? mark <= o.precio : mark >= o.precio;
    if (toca) { const r = abrirMercado(par, o.lado, o.tam, o.lev, o.precio); ST.ord.splice(i, 1); if (r.ok) ev.fills.push(r.pos); }
  }
  for (let i = ST.pos.length - 1; i >= 0; i--) {
    const p = ST.pos[i];
    if (p.par !== par) continue;
    const liquidado = p.lado === 'long' ? mark <= p.liq : mark >= p.liq;
    if (liquidado) { registrar(p, p.liq, -p.margen, 'liq'); ST.pos.splice(i, 1); ST.realizado = redondear(ST.realizado - p.margen); ev.liqs.push(p); }
  }
  if (ev.fills.length || ev.liqs.length) guardar();
  return ev;
}

/* Resumen del track record de los últimos `dias` días. */
export function stats(dias = 30) {
  const desde = Date.now() - dias * 86400000;
  const h = ST.hist.filter((x) => x.cerrado >= desde);
  const total = h.reduce((a, x) => a + x.pnl, 0);
  const wins = h.filter((x) => x.pnl > 0).length;
  const n = h.length;
  return { n, total: redondear(total), wins, losses: n - wins, winRate: n ? Math.round((wins / n) * 100) : 0 };
}

/* Historial en CSV para exportar. */
export function csv() {
  const cab = 'Closed,Pair,Side,Leverage,Size USDT,Entry,Exit,PnL USDT,ROE %,Result';
  const fila = (x) => [new Date(x.cerrado).toISOString(), x.par + 'USDT', x.lado, x.lev + 'x', x.tam.toFixed(2), x.entrada, x.salida, x.pnl.toFixed(2), x.roe.toFixed(2), x.motivo].join(',');
  return [cab].concat(ST.hist.map(fila)).join('\n');
}
