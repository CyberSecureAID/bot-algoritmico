/* ══════════════════════════════════════════════════════════════
   sp500/motor.js — El motor de la estrategia Dawn Breakout (SP500)

   Cálculo puro sobre las velas: no toca el DOM ni la interfaz.
   Recibe velas {t,o,h,l,c,v} (t en ms) y devuelve datos.

   LA ESTRATEGIA (como la definió Jesús)

   El mercado de EE.UU. abre a las 9:30 (hora de Nueva York, ET).
   Durante la primera parte de la sesión se forma una CAJA con el
   máximo y el mínimo de ese arranque. La caja se cierra a una hora
   (por defecto las 10:00; opción primera hora, 10:30). En ese
   instante se mira DÓNDE quedó el precio dentro de la caja, partida
   en tres franjas iguales:

     · franja BAJA  → día bajista. El techo de la caja ya es el
                      máximo del día. Señal de VENTA.
     · franja ALTA  → día alcista. El piso de la caja ya es el
                      mínimo del día. Señal de COMPRA.
     · franja MEDIA → lateralización. No hay señal.

   Relación riesgo beneficio 1 a 2.

   HONESTIDAD

   La regla de los tercios NO es una estrategia documentada con
   respaldo publicado: es una variante. Por eso aquí se codifica tal
   cual y el propio motor la COMPRUEBA con un backtest sobre las
   velas reales que entrega el feed. La tasa de acierto la dicen los
   datos, no el rumor.
   ══════════════════════════════════════════════════════════════ */

/* Horas en hora de Nueva York (ET), robusto ante horario de verano
   y ante la zona horaria del usuario, vía Intl. */
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
/** Identificador de día ET (AAAAMMDD). */
export function etDay(ms) { const q = _parts(ms); return q.y * 10000 + q.mo * 100 + q.d; }
/** Minutos desde medianoche ET. */
export function etMin(ms) { const q = _parts(ms); return q.h * 60 + q.mi; }
/** ¿Es fin de semana en ET? */
export function etFinde(ms) { const w = _parts(ms).wd; return w === 'Sat' || w === 'Sun'; }
/** Etiqueta de hora ET "HH:MM". */
export function etHora(ms) { const q = _parts(ms); return String(q.h).padStart(2, '0') + ':' + String(q.mi).padStart(2, '0'); }
/** Etiqueta de fecha ET "DD mmm". */
export function etFecha(ms) {
  const q = _parts(ms);
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][q.mo - 1];
  return String(q.d).padStart(2, '0') + ' ' + m;
}

/* Sesión regular de EE.UU. (cash), en minutos ET. */
export const APERTURA = 570;   // 9:30
export const CIERRE = 960;     // 16:00
/* Fin de la caja según la ventana elegida. */
export const VENTANAS = { '30': 600, '60': 630 };   // 10:00 y 10:30
export const VENTANA_ET = { '30': '10:00', '60': '10:30' };

/** Deja solo las velas de la sesión regular (9:30 a 16:00 ET), de lunes
 *  a viernes. Así cada día es una sesión limpia y el eje comprime los
 *  huecos de la noche, como en TradingView. */
export function soloRTH(velas) {
  return velas.filter((v) => {
    const m = etMin(v.t);
    return m >= APERTURA && m < CIERRE && !etFinde(v.t);
  });
}

const minTF = (tf) => (tf === '1m' ? 1 : 5);

/** En qué franja de la caja cae un precio: 'baja', 'media' o 'alta'. */
export function franja(precio, lo, hi) {
  const R = hi - lo;
  if (!(R > 0)) return 'media';
  const t1 = lo + R / 3, t2 = lo + (2 * R) / 3;
  if (precio <= t1) return 'baja';
  if (precio >= t2) return 'alta';
  return 'media';
}

/** La señal del día a partir de la franja. Riesgo beneficio 1 a 2. */
export function senalDe(fr, lo, hi, precio) {
  if (fr === 'baja') {
    const stop = hi, riesgo = stop - precio;
    if (!(riesgo > 0)) return null;
    return { lado: 'venta', entrada: precio, stop, objetivo: precio - 2 * riesgo, riesgo, rr: 2 };
  }
  if (fr === 'alta') {
    const stop = lo, riesgo = precio - stop;
    if (!(riesgo > 0)) return null;
    return { lado: 'compra', entrada: precio, stop, objetivo: precio + 2 * riesgo, riesgo, rr: 2 };
  }
  return null;   // franja media: sin señal
}

/** Resultado de una señal recorriendo las velas posteriores del día.
 *  'ganada' si llega al objetivo antes que al stop, 'perdida' si no, y
 *  'abierta' si no se resuelve antes del cierre. Si una misma vela toca
 *  ambos, cuenta como perdida (criterio conservador, no infla el acierto). */
export function resultado(despues, s) {
  for (const v of despues) {
    if (s.lado === 'venta') {
      if (v.h >= s.stop) return 'perdida';
      if (v.l <= s.objetivo) return 'ganada';
    } else {
      if (v.l <= s.stop) return 'perdida';
      if (v.h >= s.objetivo) return 'ganada';
    }
  }
  return 'abierta';
}

/** Analiza todas las sesiones de las velas (ya filtradas a RTH) para una
 *  ventana dada. Devuelve un objeto por día con los índices (sobre el
 *  array recibido), la caja, la franja, la señal y el resultado. */
export function analizarDias(rth, finMin, tf) {
  const tfm = minTF(tf);
  const dias = [];
  let i = 0;
  const n = rth.length;
  while (i < n) {
    const dia = etDay(rth[i].t);
    const i0 = i;
    while (i < n && etDay(rth[i].t) === dia) i++;
    const iFin = i - 1;                 // última vela de la sesión
    // Velas de la caja: desde apertura hasta el fin de la ventana
    let iBox = -1, hi = -Infinity, lo = Infinity;
    for (let k = i0; k <= iFin; k++) {
      const m = etMin(rth[k].t);
      if (m < finMin) {
        if (rth[k].h > hi) hi = rth[k].h;
        if (rth[k].l < lo) lo = rth[k].l;
        iBox = k;
      }
    }
    if (iBox < 0) { continue; }         // sin datos de caja ese día
    // La caja está completa si la última vela de la caja cierra en finMin
    const completa = etMin(rth[iBox].t) >= finMin - tfm;
    const iRead = iBox;
    const precio = rth[iRead].c;
    const fr = franja(precio, lo, hi);
    const s = completa ? senalDe(fr, lo, hi, precio) : null;
    let res = 'abierta';
    if (s) res = resultado(rth.slice(iRead + 1, iFin + 1), s);
    dias.push({
      dia, i0, iFin, iBox, iRead,
      caja: { hi, lo, R: hi - lo },
      franja: fr, completa,
      senal: s, resultado: res,
      t0: rth[i0].t, tRead: rth[iRead].t, tFin: rth[iFin].t
    });
  }
  return dias;
}

/** Backtest honesto: recorre los días completos (excluye el día en curso)
 *  y cuenta el acierto real de la regla para esa ventana. */
export function backtest(rth, finMin, tf, diaHoy) {
  const dias = analizarDias(rth, finMin, tf);
  let g = 0, p = 0, ab = 0, comp = 0, vend = 0, cerrShort = 0;
  for (const d of dias) {
    if (diaHoy && d.dia === diaHoy) continue;   // el día en curso no cuenta
    if (!d.senal) continue;
    if (d.senal.lado === 'compra') comp++; else vend++;
    if (d.resultado === 'ganada') g++;
    else if (d.resultado === 'perdida') p++;
    else ab++;
  }
  const res = g + p;
  const winrate = res > 0 ? (g / res) * 100 : 0;
  // Esperanza en R con riesgo beneficio 1 a 2: gana 2R, pierde 1R
  const expR = res > 0 ? (g * 2 - p * 1) / res : 0;
  return {
    sesiones: dias.length, senales: g + p + ab,
    ganadas: g, perdidas: p, abiertas: ab,
    compras: comp, ventas: vend,
    winrate, expR, muestra: res
  };
}

/** Compara las dos ventanas sobre los mismos datos, para que los datos
 *  decidan cuál conviene por defecto. */
export function compararVentanas(rth, tf, diaHoy) {
  return {
    '30': backtest(rth, VENTANAS['30'], tf, diaHoy),
    '60': backtest(rth, VENTANAS['60'], tf, diaHoy)
  };
}
