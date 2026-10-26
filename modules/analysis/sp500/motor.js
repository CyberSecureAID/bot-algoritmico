/* ══════════════════════════════════════════════════════════════
   sp500/motor.js — TD SEQUENTIAL (DeMark) para el S&P 500.

   Calculo puro sobre las velas {t,o,h,l,c,v}: no toca el DOM.

   QUE ES

   El TD Sequential de Tom DeMark es el indicador de agotamiento mas
   cotizado del mundo profesional: lo licencia Bloomberg y lo usan
   fondos. No persigue la tendencia: cuenta cuando un movimiento se
   esta agotando y es probable que gire.

   Resuelve de raiz el problema del "standby": la cuenta se ve subir
   vela por vela (1 a 9 el Setup, luego 1 a 13 el Countdown), y en
   todo momento se sabe el PRECIO EXACTO que la proxima vela debe
   cerrar para avanzar la cuenta. El usuario ve la senal acercarse.

   REGLAS (estandar DeMark, objetivas y codificables)

   TD Setup (la cuenta a 9)
     · Compra: 9 cierres seguidos por DEBAJO del cierre de 4 velas
       antes. Venta: 9 cierres seguidos por ENCIMA. Si una vela rompe
       la racha, la cuenta se reinicia.
     · Perfeccion (compra): el minimo de la vela 8 o 9 es menor o
       igual que los minimos de la 6 y la 7. (Venta: con los maximos.)
     · TDST: al cerrar un Setup de compra se traza una RESISTENCIA en
       el maximo del tramo; al cerrar uno de venta, un SOPORTE en el
       minimo. Son los umbrales que, de romperse, invalidan el giro.

   TD Countdown (la cuenta a 13)
     · Empieza tras un Setup completo. Compra: se cuentan velas (no
       seguidas) cuyo cierre es menor o igual que el MINIMO de 2 velas
       antes, hasta 13. Venta: cierre mayor o igual que el MAXIMO de 2
       velas antes.
     · Regla de la barra 13: ademas de cumplir la condicion, en compra
       el minimo de la vela 13 debe ser menor o igual que el cierre de
       la vela 8 del propio Countdown (en venta, con el maximo). Si no,
       se aplaza hasta que una vela lo cumpla.
     · Un Setup opuesto completo cancela el Countdown en curso.

   SENALES: un 9 de compra es posible suelo; un 9 de venta, posible
   techo; un 13 es la version fuerte. El acierto NO se promete: el
   motor hace un BACKTEST real y ensena la tasa sobre el SPY.
   ══════════════════════════════════════════════════════════════ */

const _ET = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false
});
function _parts(ms) {
  const p = {};
  for (const x of _ET.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = x.value;
  let h = +p.hour; if (h === 24) h = 0;
  return { y: +p.year, mo: +p.month, d: +p.day, h, mi: +p.minute, wd: p.weekday };
}
export function etDay(ms) { const q = _parts(ms); return q.y * 10000 + q.mo * 100 + q.d; }
export function etMin(ms) { const q = _parts(ms); return q.h * 60 + q.mi; }
export function etFinde(ms) { const w = _parts(ms).wd; return w === 'Sat' || w === 'Sun'; }
export function etHora(ms) { const q = _parts(ms); return String(q.h).padStart(2, '0') + ':' + String(q.mi).padStart(2, '0'); }
export function etFecha(ms) {
  const q = _parts(ms);
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][q.mo - 1];
  return String(q.d).padStart(2, '0') + ' ' + m;
}

export const APERTURA = 570;   // 9:30 ET
export const CIERRE = 960;     // 16:00 ET

/* Solo sesion regular (para intradia). Las velas diarias pasan sin filtrar. */
export function soloRTH(velas) {
  return velas.filter((v) => { const m = etMin(v.t); return m >= APERTURA && m < CIERRE && !etFinde(v.t); });
}

/* ══ EL MOTOR TD SEQUENTIAL ══
   Devuelve, por vela, la cuenta de Setup (1 a 9) y de Countdown (1 a 13),
   las senales (9 y 13), las lineas TDST, y el estado EN VIVO con el umbral
   que la proxima vela debe cerrar para avanzar la cuenta. */
export function computeTD(velas) {
  const n = velas.length;
  const bars = [];
  for (let k = 0; k < n; k++) bars.push({ setup: null, countdown: null, nine: false, thirteen: false, perfected: false });
  const signals = [];
  const tdstLineas = [];   // {i, nivel, tipo:'res'|'sup'}

  // ── 1) TD SETUP ──
  let buy = 0, sell = 0;
  for (let i = 0; i < n; i++) {
    if (i < 4) continue;
    const c4 = velas[i - 4].c;
    if (velas[i].c < c4) { buy++; sell = 0; }
    else if (velas[i].c > c4) { sell++; buy = 0; }
    else { buy = 0; sell = 0; }

    if (buy > 0 && buy <= 9) bars[i].setup = { dir: 'buy', n: buy };
    if (sell > 0 && sell <= 9) bars[i].setup = { dir: 'sell', n: sell };

    if (buy === 9) {
      let lo = Infinity, hi = -Infinity;
      for (let k = i - 8; k <= i; k++) { if (velas[k].l < lo) lo = velas[k].l; if (velas[k].h > hi) hi = velas[k].h; }
      bars[i].nine = true;
      bars[i].perfected = Math.min(velas[i - 1].l, velas[i].l) <= Math.min(velas[i - 3].l, velas[i - 2].l);
      signals.push({ i, tipo: 'buy9', precio: velas[i].c, lo, hi, perfected: bars[i].perfected });
      tdstLineas.push({ i, nivel: hi, tipo: 'res' });
      buy = 0;
    }
    if (sell === 9) {
      let lo = Infinity, hi = -Infinity;
      for (let k = i - 8; k <= i; k++) { if (velas[k].l < lo) lo = velas[k].l; if (velas[k].h > hi) hi = velas[k].h; }
      bars[i].nine = true;
      bars[i].perfected = Math.max(velas[i - 1].h, velas[i].h) >= Math.max(velas[i - 3].h, velas[i - 2].h);
      signals.push({ i, tipo: 'sell9', precio: velas[i].c, lo, hi, perfected: bars[i].perfected });
      tdstLineas.push({ i, nivel: lo, tipo: 'sup' });
      sell = 0;
    }
  }

  // ── 2) TD COUNTDOWN ──
  let cd = null;   // {dir, count, bar8close}
  for (let i = 0; i < n; i++) {
    if (bars[i].nine && bars[i].setup) {
      const d9 = bars[i].setup.dir;
      // Un Setup opuesto cancela y reinicia; uno del mismo lado NO reinicia (deja avanzar el Countdown).
      if (!cd || cd.dir !== d9) { cd = { dir: d9, count: 0, bar8close: null }; continue; }
    }
    if (!cd || i < 2) continue;
    const dir = cd.dir;
    const qual = dir === 'buy' ? (velas[i].c <= velas[i - 2].l) : (velas[i].c >= velas[i - 2].h);
    if (!qual) continue;
    const next = cd.count + 1;
    if (next === 8) cd.bar8close = velas[i].c;
    if (next === 13) {
      const ok = dir === 'buy' ? (cd.bar8close == null || velas[i].l <= cd.bar8close)
                               : (cd.bar8close == null || velas[i].h >= cd.bar8close);
      if (!ok) { cd.count = 12; bars[i].countdown = { dir, n: 12, deferred: true }; continue; }
    }
    cd.count = next;
    bars[i].countdown = { dir, n: cd.count };
    if (cd.count === 13) { bars[i].thirteen = true; signals.push({ i, tipo: dir === 'buy' ? 'buy13' : 'sell13', precio: velas[i].c }); cd = null; }
  }

  // ── 3) ESTADO EN VIVO (umbral de la proxima vela) ──
  let tdstRes = null, tdstSup = null;
  for (const l of tdstLineas) { if (l.tipo === 'res') tdstRes = l.nivel; else tdstSup = l.nivel; }
  const liveSetup = n > 0 ? bars[n - 1].setup : null;
  const liveCD = cd && cd.count > 0 ? { dir: cd.dir, n: cd.count } : null;

  let siguiente = null;
  if (liveCD) {
    const dir = liveCD.dir;
    siguiente = {
      que: 'countdown', dir, n: liveCD.n, faltan: 13 - liveCD.n,
      umbral: dir === 'buy' ? velas[n - 2].l : velas[n - 2].h,
      relacion: dir === 'buy' ? 'close_leq_low' : 'close_geq_high'
    };
  } else if (liveSetup && liveSetup.n < 9) {
    const dir = liveSetup.dir;
    siguiente = {
      que: 'setup', dir, n: liveSetup.n, faltan: 9 - liveSetup.n,
      umbral: velas[n - 4].c,
      relacion: dir === 'buy' ? 'close_below' : 'close_above'
    };
  } else if (n >= 4) {
    // sin cuenta activa: que vela iniciaria un setup
    const umbral = velas[n - 4].c;
    siguiente = { que: 'flip', dir: null, n: 0, faltan: 9, umbral, relacion: 'flip' };
  }

  return { bars, signals, tdstLineas, vivo: { setup: liveSetup, countdown: liveCD, siguiente, tdstRes, tdstSup } };
}

/* ══ BACKTEST honesto por REACCION ══
   La forma fiel de medir TD: tras un 9, se mira la ventana de reaccion
   (las siguientes NR velas, 4 por defecto, que es cuando DeMark espera
   el giro). Acierto = el recorrido a favor del 9 supera al adverso en
   esa ventana. Se reporta tambien el movimiento medio favorable y
   adverso. Sin R:R inventado: numeros reales sobre el SPY. */
export function backtestTD(velas, NR) {
  const n = velas.length;
  const { signals } = computeTD(velas);
  NR = NR || 4;
  let win = 0, los = 0, nueves = 0, treces = 0, compras = 0, ventas = 0, favSum = 0, advSum = 0, cnt = 0;
  for (const s of signals) {
    if (s.tipo === 'buy13' || s.tipo === 'sell13') { treces++; continue; }
    nueves++;
    const compra = s.tipo === 'buy9';
    if (compra) compras++; else ventas++;
    const entrada = s.precio;
    const fin = Math.min(n - 1, s.i + NR);
    if (fin <= s.i) continue;
    let hiMax = -Infinity, loMin = Infinity;
    for (let k = s.i + 1; k <= fin; k++) { if (velas[k].h > hiMax) hiMax = velas[k].h; if (velas[k].l < loMin) loMin = velas[k].l; }
    const up = hiMax - entrada, dn = entrada - loMin;
    const fav = compra ? up : dn, adv = compra ? dn : up;
    if (entrada > 0) { favSum += (Math.max(0, fav) / entrada) * 100; advSum += (Math.max(0, adv) / entrada) * 100; cnt++; }
    if (fav > adv) win++; else los++;
  }
  const muestra = win + los;
  const winrate = muestra > 0 ? (win / muestra) * 100 : 0;
  const favAvg = cnt > 0 ? favSum / cnt : 0;
  const advAvg = cnt > 0 ? advSum / cnt : 0;
  return { nueves, treces, win, los, compras, ventas, winrate, muestra, favAvg, advAvg, NR };
}
