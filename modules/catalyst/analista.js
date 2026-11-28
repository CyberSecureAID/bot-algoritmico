/* analista.js — El analista de Catalyst (Jesús).
 *
 * Lee el estado REAL del precio frente a la estrategia vigente y le dice al usuario
 * QUÉ HACER, sin revelar la estrategia (es secreta y de pago). No recita la regla:
 * da instrucciones de mesa, firme, en presente, con los frenos puestos para que
 * nadie entre antes de tiempo. Decide, no se lava las manos como los analistas
 * flojos ("tal vez pase o tal vez no"): dice espera, o dice entra.
 *
 * Seis escenas: lejos, vigilar, cerca, listo, entra, invalida. Para cada una hay
 * un pozo de frases (muchas, rotadas) para que NUNCA suene repetitivo.
 *
 * Bilingüe { en, es }. Español SIN guiones (regla del proyecto).
 */

import { sma, bollinger } from './indicadores.js?v=1';

const last = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] && arr[i].value != null) return arr[i].value; return null; };
const P = (x) => (x == null ? '' : '$' + Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/* Evalúa el estado del precio contra la lógica de la estrategia. Devuelve una
   escena y una proximidad 0..1 (qué tan cerca está la entrada). No expone reglas. */
function evaluar(velas, estr) {
  if (!velas || velas.length < 45) return { escena: 'vigilar', prox: 0.3, nivel: null };
  const px = velas[velas.length - 1].close;
  const ma20 = last(sma(velas, 20)), ma40 = last(sma(velas, 40));
  const ma100 = last(sma(velas, 100)), ma200 = last(sma(velas, 200));
  const bb = bollinger(velas, 20, 2);
  const up = last(bb.alta), lo = last(bb.baja);
  const bbPos = (up != null && lo != null && up > lo) ? (px - lo) / (up - lo) : 0.5;
  const dist = ma20 ? (px - ma20) / ma20 : 0;        // + arriba / - abajo de la media central
  const cortoAlza = ma20 != null && ma40 != null ? ma20 >= ma40 : true;
  const largoAlza = ma100 != null && ma200 != null ? ma100 >= ma200 : cortoAlza;
  // momentum: pendiente de los últimos cierres
  const n = velas.length, c0 = velas[n - 1].close, c5 = velas[Math.max(0, n - 6)].close;
  const mom = (c0 - c5) / (c5 || 1);
  const nivel = ma20;
  const g = estr.grupo;

  // helper: clamp
  const cl = (x) => Math.max(0, Math.min(1, x));

  if (g === 'Cambio de tendencia') {
    // put: venía al alza y gira abajo; call: venía abajo y gira arriba
    const put = estr.lado === 'put';
    // "giro" = el precio perdió (put) o recuperó (call) la media central con momentum a favor
    const perdida = put ? dist < 0 : dist > 0;        // ya del lado del giro
    const cercaLinea = Math.abs(dist) < 0.006;
    const momOK = put ? mom < -0.002 : mom > 0.002;
    const teniaTendencia = put ? !cortoAlza === false : cortoAlza === false ? true : cortoAlza; // suave
    if (perdida && momOK && Math.abs(dist) > 0.012) return { escena: 'entra', prox: 0.95, nivel, side: estr.lado };
    if (perdida && Math.abs(dist) <= 0.012) return { escena: 'listo', prox: 0.8, nivel, side: estr.lado };
    if (cercaLinea) return { escena: 'cerca', prox: 0.6, nivel, side: estr.lado };
    const yendoHacia = put ? (mom < 0 && dist > 0 && dist < 0.03) : (mom > 0 && dist < 0 && dist > -0.03);
    if (yendoHacia) return { escena: 'vigilar', prox: 0.4, nivel, side: estr.lado };
    // si ya se fue al otro lado con fuerza, invalidada
    const contra = put ? dist > 0.03 && mom > 0.004 : dist < -0.03 && mom < -0.004;
    if (contra) return { escena: 'invalida', prox: 0.1, nivel, side: estr.lado };
    return { escena: 'lejos', prox: 0.2, nivel, side: estr.lado };
  }

  if (g === 'Efecto imán') {
    // put: muy estirado ARRIBA (vuelve abajo); call: muy estirado ABAJO (vuelve arriba)
    const put = estr.lado === 'put';
    const estirado = put ? dist : -dist;              // qué tan lejos del lado que nos interesa
    const fuera = put ? bbPos > 0.98 : bbPos < 0.02;  // primera vela fuera del oscilador
    if (estirado > 0.07 && fuera) return { escena: 'entra', prox: 0.95, nivel, side: estr.lado };
    if (estirado > 0.05 && fuera) return { escena: 'listo', prox: 0.82, nivel, side: estr.lado };
    if (estirado > 0.035) return { escena: 'cerca', prox: 0.6, nivel, side: estr.lado };
    if (estirado > 0.02) return { escena: 'vigilar', prox: 0.4, nivel, side: estr.lado };
    if (estirado < -0.02) return { escena: 'invalida', prox: 0.1, nivel, side: estr.lado };
    return { escena: 'lejos', prox: 0.2, nivel, side: estr.lado };
  }

  // Rebote en punto medio
  const call = estr.lado === 'call';
  // tendencia de fondo a favor (call: largo alcista; put: largo bajista) y precio
  // acercándose a la media central desde el lado contrario (la corrección)
  const fondoOK = call ? largoAlza : !largoAlza;
  const acerca = call ? (dist > 0 && dist < 0.05) : (dist < 0 && dist > -0.05);
  const enLinea = Math.abs(dist) < 0.008;
  const respeta = call ? (enLinea && mom > -0.001) : (enLinea && mom < 0.001);
  const rebota = call ? (dist > 0 && dist < 0.02 && mom > 0.002) : (dist < 0 && dist > -0.02 && mom < -0.002);
  const rompe = call ? dist < -0.012 : dist > 0.012;  // no respetó el punto medio
  if (!fondoOK) return { escena: 'lejos', prox: 0.15, nivel, side: estr.lado };
  if (rompe) return { escena: 'invalida', prox: 0.1, nivel, side: estr.lado };
  if (rebota) return { escena: 'entra', prox: 0.92, nivel, side: estr.lado };
  if (respeta) return { escena: 'listo', prox: 0.8, nivel, side: estr.lado };
  if (enLinea) return { escena: 'cerca', prox: 0.62, nivel, side: estr.lado };
  if (acerca) return { escena: 'vigilar', prox: 0.42, nivel, side: estr.lado };
  return { escena: 'lejos', prox: 0.2, nivel, side: estr.lado };
}

/* ── Pozos de frases por escena. {t: titulo, x: cuerpo, h: que hacer}. Muchas por
   escena, se rotan. El lado (call/put) y el nivel entran por plantilla. No se
   nombra ninguna regla de la estrategia. ── */
const LADO = { call: { en: 'a long (call)', es: 'un largo (call)' }, put: { en: 'a short (put)', es: 'un corto (put)' } };
const SESGO = { call: { en: 'upside', es: 'al alza' }, put: { en: 'downside', es: 'a la baja' } };

function frases(escena) {
  // cada entrada: en/es con {sym} {lado} {sesgo} {nivel}
  const B = {
    lejos: [
      { t: ['Not your moment', 'No es tu momento'], x: ['{sym} is nowhere near the setup yet. The market is doing its thing and this is not it. Keep the safety on and let price come to you.', '{sym} todavía no está ni cerca del setup. El mercado anda en lo suyo y esto no es. Mantén el freno puesto y deja que el precio venga a ti.'], h: ['Do nothing. Watching for the {sesgo} setup to build.', 'No hagas nada. Vigilando que se arme el setup {sesgo}.'] },
      { t: ['Too early', 'Muy temprano'], x: ['There is no edge here for {sym} right now. Forcing a trade in this spot is how accounts bleed. Patience is the position.', 'Ahora mismo no hay ventaja en {sym}. Forzar una entrada aquí es como se desangran las cuentas. La paciencia es la posición.'], h: ['Stay flat. Nothing to act on.', 'Fuera. No hay nada que ejecutar.'] },
      { t: ['Sit tight', 'Quieto'], x: ['{sym} is far from where this strategy pays. I would rather you miss the first inch than chase thin air.', '{sym} está lejos de donde esta estrategia paga. Prefiero que te pierdas el primer centímetro a que persigas humo.'], h: ['Hold off. Let it set up first.', 'Espera. Que se arme primero.'] },
      { t: ['Not here', 'Aquí no'], x: ['Nothing on {sym} lines up with {sesgo} yet. Keep it on the watchlist, hands off the trigger.', 'Nada en {sym} cuadra todavía con lo {sesgo}. Déjalo en la lista, fuera del gatillo.'], h: ['Wait. No reason to be in.', 'Espera. No hay razón para estar dentro.'] }
    ],
    vigilar: [
      { t: ['Starting to line up', 'Empieza a cuadrar'], x: ['{sym} is beginning to lean the right way. It is not a trade yet, but it is worth your eyes now. Hands off, eyes on.', '{sym} empieza a inclinarse del lado bueno. Todavía no es entrada, pero ya merece tu atención. Manos quietas, ojos puestos.'], h: ['Watch it. Get ready, do not act.', 'Obsérvalo. Prepárate, no actúes.'] },
      { t: ['On the radar', 'En el radar'], x: ['The pieces for a {sesgo} move on {sym} are starting to show. Early still. Let it come closer before you even think about size.', 'Las piezas para un movimiento {sesgo} en {sym} empiezan a verse. Aún es pronto. Deja que se acerque antes de pensar en tamaño.'], h: ['Keep watching. Not yet.', 'Sigue mirando. Todavía no.'] },
      { t: ['Building', 'Se está armando'], x: ['{sym} is heading toward the zone that matters near {nivel}. Momentum is turning your way but it has to earn the entry first.', '{sym} va hacia la zona que importa cerca de {nivel}. El momentum gira a tu favor pero todavía tiene que ganarse la entrada.'], h: ['Prime it. Finger off the trigger.', 'Prepáralo. Dedo fuera del gatillo.'] },
      { t: ['Warming up', 'Calentando'], x: ['Something is forming on {sym}. Do not front run it. The good entries announce themselves, you are not there yet.', 'Algo se forma en {sym}. No te adelantes. Las buenas entradas se anuncian solas, y todavía no llegas.'], h: ['Wait for it. Stand ready.', 'Espérala. Mantente listo.'] }
    ],
    cerca: [
      { t: ['Getting close', 'Ya mero'], x: ['{sym} is right at the zone near {nivel}. This is where people jump early and get punished. Do not. Let it prove itself first.', '{sym} está justo en la zona cerca de {nivel}. Aquí es donde la gente salta antes de tiempo y la castigan. No lo hagas. Deja que se confirme primero.'], h: ['Almost. Wait for the proof before {lado}.', 'Casi. Espera la confirmación antes de {lado}.'] },
      { t: ['At the line', 'En la línea'], x: ['{sym} reached the spot that decides this. One honest confirmation and it is live. Breathe, do not snatch at it.', '{sym} llegó al punto que decide esto. Una confirmación honesta y queda vivo. Respira, no lo arrebates.'], h: ['Hold. The trigger is one step away.', 'Aguanta. El gatillo está a un paso.'] },
      { t: ['Knocking', 'Tocando'], x: ['Price is testing the level on {sym} near {nivel}. Close, but close is not done. I need it to commit before you do.', 'El precio prueba el nivel en {sym} cerca de {nivel}. Cerca, pero cerca no es hecho. Necesito que se comprometa antes que tú.'], h: ['Wait one more beat. Then maybe {lado}.', 'Espera un compás más. Luego quizá {lado}.'] },
      { t: ['Right there', 'Justo ahí'], x: ['{sym} is sitting on the zone. The setup is a hair away. Do not reward it before it does the work.', '{sym} está sentado en la zona. El setup está a un pelo. No lo premies antes de que haga el trabajo.'], h: ['Nearly. Confirmation first, then {lado}.', 'Casi. Confirmación primero, luego {lado}.'] }
    ],
    listo: [
      { t: ['Almost there', 'Ya casi'], x: ['{sym} has almost everything it needs for {lado}. One last thing and this is a clean window. Finger ready, not pressed.', '{sym} ya casi tiene todo lo que necesita para {lado}. Una última cosa y esto es una ventana limpia. Dedo listo, sin apretar.'], h: ['Be ready. The moment it confirms, take {lado}.', 'Prepárate. En cuanto confirme, toma {lado}.'] },
      { t: ['Loaded', 'Cargado'], x: ['This is the last step on {sym}. The {sesgo} read is right there near {nivel}. When it clicks, you move without hesitating.', 'Este es el último paso en {sym}. La lectura {sesgo} está justo ahí cerca de {nivel}. Cuando haga clic, te mueves sin dudar.'], h: ['Hover the trigger. One more tick for {lado}.', 'Dedo sobre el gatillo. Un tick más para {lado}.'] },
      { t: ['One more tick', 'Un tick más'], x: ['{sym} is basically set up. I am not calling it yet because the last confirmation protects you from a fake. Almost.', '{sym} está prácticamente armado. No lo canto todavía porque la última confirmación te cuida de un engaño. Casi.'], h: ['Ready. The next candle could be your {lado}.', 'Listo. La próxima vela puede ser tu {lado}.'] },
      { t: ['On deck', 'En el plato'], x: ['Everything on {sym} points to {sesgo} and the entry is one confirmation out. Do not jump the gun, but be awake.', 'Todo en {sym} apunta a lo {sesgo} y la entrada está a una confirmación. No te adelantes, pero mantente despierto.'], h: ['Stand by for {lado}. Seconds away.', 'En espera de {lado}. A segundos.'] }
    ],
    entra: [
      { t: ['This is it', 'Es ahora'], x: ['The conditions just completed on {sym}. This is your {sesgo} window near {nivel}. Clean setup, act before it runs without you.', 'Las condiciones se acaban de cumplir en {sym}. Esta es tu ventana {sesgo} cerca de {nivel}. Setup limpio, actúa antes de que se vaya sin ti.'], h: ['Take {lado} now. This is the entry.', 'Toma {lado} ahora. Esta es la entrada.'] },
      { t: ['Go', 'Entra'], x: ['{sym} just gave the signal. Everything you were waiting for is on the table right now. This is the window, not a drill.', '{sym} acaba de dar la señal. Todo lo que esperabas está sobre la mesa ahora mismo. Esta es la ventana, no es simulacro.'], h: ['Enter {lado}. Do not overthink it.', 'Entra {lado}. No lo pienses de más.'] },
      { t: ['Green light', 'Luz verde'], x: ['It triggered on {sym}. The {sesgo} setup is live at {nivel}. Windows like this do not stay open, move with it.', 'Se disparó en {sym}. El setup {sesgo} está vivo en {nivel}. Ventanas como esta no se quedan abiertas, muévete con ella.'], h: ['{lado} is on. Execute.', '{lado} activado. Ejecuta.'] },
      { t: ['Now', 'Ahora'], x: ['Setup complete on {sym}. I told you to keep the safety on until this exact moment. This is the moment. {sesgo}.', 'Setup completo en {sym}. Te dije que mantuvieras el freno hasta este momento exacto. Es este. {sesgo}.'], h: ['Pull the trigger on {lado}.', 'Aprieta el gatillo en {lado}.'] }
    ],
    invalida: [
      { t: ['Stand down', 'Abortado'], x: ['{sym} just broke the setup. This one is off. Do not try to save a trade the market already cancelled, wait for the next clean one.', '{sym} acaba de romper el setup. Este queda fuera. No intentes salvar una entrada que el mercado ya canceló, espera la próxima limpia.'], h: ['No trade. Reset and wait.', 'Sin entrada. Reinicia y espera.'] },
      { t: ['Cancelled', 'Cancelado'], x: ['The read flipped on {sym} and the {sesgo} idea lost its footing. Forget it. A broken setup is not a discount, it is a no.', 'La lectura se dio vuelta en {sym} y la idea {sesgo} perdió el piso. Olvídalo. Un setup roto no es un descuento, es un no.'], h: ['Step aside. Nothing to do here.', 'Hazte a un lado. Aquí no hay nada.'] },
      { t: ['Off', 'Fuera'], x: ['{sym} did not respect the level and the setup voided. This is exactly the entry I kept you out of. Good. Next.', '{sym} no respetó el nivel y el setup se anuló. Esta es justo la entrada de la que te mantuve fuera. Bien. Siguiente.'], h: ['Skip it. Watch for a fresh one.', 'Sáltatela. Vigila una nueva.'] }
    ]
  };
  return B[escena] || B.vigilar;
}

/* Devuelve la lectura del analista para la estrategia y los datos actuales. */
export function leerCatalyst(velas, estr, rot) {
  const ev = evaluar(velas, estr);
  const pool = frases(ev.escena);
  const pick = pool[(rot || 0) % pool.length];
  const sym = (estr && estr._sym) || 'this stock';
  const nivel = ev.nivel != null ? P(ev.nivel) : 'the level';
  const fill = (s, lang) => s
    .replace(/\{sym\}/g, sym)
    .replace(/\{nivel\}/g, nivel)
    .replace(/\{lado\}/g, LADO[estr.lado][lang])
    .replace(/\{sesgo\}/g, SESGO[estr.lado][lang]);
  return {
    escena: ev.escena, prox: ev.prox, lado: estr.lado, nivel: ev.nivel,
    titulo: { en: pick.t[0], es: pick.t[1] },
    txt: { en: fill(pick.x[0], 'en'), es: fill(pick.x[1], 'es') },
    hacer: { en: fill(pick.h[0], 'en'), es: fill(pick.h[1], 'es') }
  };
}
