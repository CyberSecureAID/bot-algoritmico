/* modules/trading-demo/motor.js — Motor del Trading Demo.

   Simulador de futuros 100% del lado del cliente: balance de práctica,
   posiciones, PnL en vivo, precio de liquidación aproximado y órdenes
   "marcadas" que entran cuando el precio las toca. Sin órdenes reales, sin
   contrato, sin backend. El balance se guarda en localStorage (solo para este
   navegador; es práctica, no dinero real). Cada lectura va en try/catch por si
   el almacenamiento está bloqueado.

   Notación: `tam` = tamaño en USDT (nominal de la posición). cantidad base =
   tam / entrada. margen = tam / apalancamiento. PnL long = (precio − entrada) *
   cantidad; short = (entrada − precio) * cantidad. ROE = PnL / margen. */

const LS = 'td-demo-v1';
const BAL0 = 10000;          // balance demo inicial (USDT)
const MMR = 0.004;           // margen de mantenimiento aproximado (para la liquidación)
const FEE = 0.0004;          // comisión taker aproximada, por lado

let _id = 1;
const nid = () => 'o' + (Date.now().toString(36)) + (_id++);

function cargar() {
  try { const s = JSON.parse(localStorage.getItem(LS)); if (s && typeof s.balance === 'number') return s; } catch (_) {}
  return { balance: BAL0, pos: [], ord: [], realizado: 0 };
}
let ST = cargar();
function guardar() { try { localStorage.setItem(LS, JSON.stringify(ST)); } catch (_) {} }

export function estado() { return ST; }
export function balance() { return ST.balance; }
export function posiciones() { return ST.pos; }
export function ordenes() { return ST.ord; }

export function reset() { ST = { balance: BAL0, pos: [], ord: [], realizado: 0 }; guardar(); return ST; }

function liqDe(lado, entrada, lev) {
  const f = 1 / lev - MMR;
  return lado === 'long' ? entrada * (1 - f) : entrada * (1 + f);
}

/* PnL y ROE de una posición al precio `mark`. */
export function pnlDe(p, mark) {
  const qty = p.tam / p.entrada;
  const bruto = p.lado === 'long' ? (mark - p.entrada) * qty : (p.entrada - mark) * qty;
  const comision = p.tam * FEE * 2;                 // entrada + salida estimadas
  const pnl = bruto - comision;
  const roe = p.margen > 0 ? (pnl / p.margen) * 100 : 0;
  return { pnl, roe, qty };
}

/* Abrir a MERCADO al precio `mark`. Devuelve { ok, pos } o { ok:false, motivo }. */
export function abrirMercado(par, lado, tam, lev, mark) {
  if (!(mark > 0) || !(tam > 0)) return { ok: false, motivo: 'precio' };
  const margen = tam / lev;
  if (margen > ST.balance + 1e-9) return { ok: false, motivo: 'saldo' };
  const pos = { id: nid(), par, lado, entrada: mark, tam, lev, margen, liq: liqDe(lado, mark, lev), t: Date.now() };
  ST.balance -= margen;
  ST.pos.push(pos);
  guardar();
  return { ok: true, pos };
}

/* Colocar una orden MARCADA (entra cuando el precio toca `precio`). */
export function colocarOrden(par, lado, tam, lev, precio, mark) {
  if (!(precio > 0) || !(tam > 0)) return { ok: false, motivo: 'precio' };
  const margen = tam / lev;
  if (margen > ST.balance + 1e-9) return { ok: false, motivo: 'saldo' };
  // lado de cruce: si la marca se coloca por encima del precio actual, entra al bajar hasta ella y viceversa
  const desde = mark >= precio ? 'arriba' : 'abajo';
  const ord = { id: nid(), par, lado, tam, lev, precio, desde, t: Date.now() };
  ST.ord.push(ord);
  guardar();
  return { ok: true, ord };
}

export function cancelarOrden(id) {
  const i = ST.ord.findIndex((o) => o.id === id);
  if (i >= 0) { ST.ord.splice(i, 1); guardar(); return true; }
  return false;
}

/* Cerrar una posición al precio `mark`: realiza el PnL al balance. */
export function cerrar(id, mark) {
  const i = ST.pos.findIndex((p) => p.id === id);
  if (i < 0) return null;
  const p = ST.pos[i];
  const { pnl } = pnlDe(p, mark);
  ST.balance += p.margen + pnl;
  ST.realizado += pnl;
  ST.pos.splice(i, 1);
  guardar();
  return { pos: p, pnl, salida: mark };
}

/* Procesar un nuevo precio: dispara órdenes marcadas que el precio toca y
   liquida posiciones cuyo precio de liquidación se alcanza. Devuelve los
   eventos ocurridos para que la UI avise. */
export function onPrecio(par, mark) {
  const ev = { fills: [], liqs: [] };
  if (!(mark > 0)) return ev;
  // órdenes marcadas de esta moneda
  for (let i = ST.ord.length - 1; i >= 0; i--) {
    const o = ST.ord[i];
    if (o.par !== par) continue;
    const toca = o.desde === 'arriba' ? mark <= o.precio : mark >= o.precio;
    if (toca) {
      const r = abrirMercado(par, o.lado, o.tam, o.lev, o.precio);   // entra al precio marcado
      ST.ord.splice(i, 1);
      if (r.ok) ev.fills.push(r.pos);
    }
  }
  // liquidaciones
  for (let i = ST.pos.length - 1; i >= 0; i--) {
    const p = ST.pos[i];
    if (p.par !== par) continue;
    const liquidado = p.lado === 'long' ? mark <= p.liq : mark >= p.liq;
    if (liquidado) {
      ST.pos.splice(i, 1);             // margen perdido (ya se había descontado del balance)
      ST.realizado -= p.margen;
      ev.liqs.push(p);
    }
  }
  if (ev.fills.length || ev.liqs.length) guardar();
  return ev;
}
