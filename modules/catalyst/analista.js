/* analista.js — El analista de Catalyst (Jesús).
 *
 * GUÍA PASO A PASO de la estrategia vigente, tal como las diapositivas del colega.
 * No da frases genéricas: lee el estado real del precio y dice en qué PASO de la
 * estrategia estamos y qué hacer ahora, hasta el "entra". Cada estrategia tiene
 * sus pasos propios (línea de tendencia, ruptura de la MM20, Bollinger, Worden,
 * punto medio...), sacados de las fotos. Es soporte para ejecutar bien, no consejo.
 *
 * Bilingüe { en, es }. Español SIN guiones (regla del proyecto).
 */

import { sma, bollinger, worden } from './indicadores.js?v=1';

const P = (x) => (x == null ? 'the level' : '$' + Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const ult2 = (arr) => { const v = []; for (let i = arr.length - 1; i >= 0 && v.length < 2; i--) if (arr[i] && arr[i].value != null) v.push(arr[i].value); return v; };

/* Todas las señales que necesitan los pasos, calculadas una sola vez. */
function señales(velas) {
  if (!velas || velas.length < 45) return null;
  const n = velas.length, c = velas[n - 1];
  const px = c.close;
  const ma20 = ult2(sma(velas, 20))[0], ma40 = ult2(sma(velas, 40))[0];
  const ma100 = ult2(sma(velas, 100))[0], ma200 = ult2(sma(velas, 200))[0];
  const bb = bollinger(velas, 20, 2);
  const up = ult2(bb.alta)[0], lo = ult2(bb.baja)[0];
  const bbPos = (up != null && lo != null && up > lo) ? (px - lo) / (up - lo) : 0.5;
  const dist = ma20 ? (px - ma20) / ma20 : 0;            // + por encima / - por debajo de la MM20
  const c5 = velas[Math.max(0, n - 6)].close;
  const mom = (px - c5) / (c5 || 1);
  const w = worden(velas, 14, 3, 3);
  const k2 = ult2(w.k), s2 = ult2(w.señal);
  const wK = k2[0], wKp = k2[1] != null ? k2[1] : wK, wS = s2[0], wSp = s2[1] != null ? s2[1] : wS;
  const cruzaAbajo = wKp >= wSp && wK < wS;              // Worden K cruza por DEBAJO de su señal (gatillo PUT)
  const cruzaArriba = wKp <= wSp && wK > wS;             // cruza por ARRIBA (gatillo CALL)
  const cortoAlza = (ma20 != null && ma40 != null) ? ma20 >= ma40 : true;
  const largoAlza = (ma100 != null && ma200 != null) ? ma100 >= ma200 : cortoAlza;
  const velaAlcista = c.close >= c.open;
  return { px, ma20, dist, mom, bbPos, wK, cruzaAbajo, cruzaArriba, cortoAlza, largoAlza, velaAlcista };
}

/* Pasos por estrategia (de las diapositivas). Cada paso: test(s) y textos.
   El analista busca el PRIMER paso sin cumplir: ese es el que toca hacer ahora.
   Si todos se cumplen -> entra. `inval(s)` -> la estrategia se anuló. */
function receta(estr) {
  const g = estr.grupo, call = estr.lado === 'call';
  if (g === 'Cambio de tendencia') {
    return {
      pasos: [
        { test: (s) => call ? (s.mom > 0.0008 && s.dist > -0.015) : (s.mom < -0.0008 && s.dist < 0.015),
          tit: call ? ['Trend line + break', 'Línea de tendencia y ruptura'] : ['Trend line + break', 'Línea de tendencia y ruptura'],
          txt: call ? ['Draw a trend line bordering slightly ABOVE the downtrend and wait for price to BREAK it. It can happen intraday or as a gap.', 'Traza una línea de tendencia bordeando levemente por ENCIMA la tendencia bajista y espera a que el precio la ROMPA. Puede ser en el día o en un salto.']
                     : ['Draw a trend line bordering slightly BELOW the uptrend and wait for price to BREAK it. It can happen intraday or as a gap.', 'Traza una línea de tendencia bordeando levemente por DEBAJO la tendencia alcista y espera a que el precio la ROMPA. Puede ser en el día o en un salto.'],
          do: call ? ['Draw the line and wait for the break.', 'Traza la línea y espera la ruptura.'] : ['Draw the line and wait for the break.', 'Traza la línea y espera la ruptura.'] },
        { test: (s) => call ? (s.dist > 0.001 && s.velaAlcista) : (s.dist < -0.001 && !s.velaAlcista),
          tit: call ? ['Break the MA20', 'Rompe la MM20'] : ['Break the MA20', 'Rompe la MM20'],
          txt: call ? ['Now wait for price to break the 20 moving average and close with a BULLISH confirmation candle.', 'Ahora espera a que el precio rompa la media móvil de 20 y cierre con una vela de confirmación ALCISTA.']
                     : ['Now wait for price to break the 20 moving average and close with a BEARISH confirmation candle.', 'Ahora espera a que el precio rompa la media móvil de 20 y cierre con una vela de confirmación BAJISTA.'],
          do: call ? ['Wait for the bullish confirmation candle.', 'Espera la vela de confirmación alcista.'] : ['Wait for the bearish confirmation candle.', 'Espera la vela de confirmación bajista.'] },
        { test: (s) => call ? (s.cortoAlza && s.dist > 0.006) : (!s.cortoAlza && s.dist < -0.006),
          tit: call ? ['Confirm on 15m', 'Confirma en 15m'] : ['Confirm on 15m', 'Confirma en 15m'],
          txt: call ? ['Switch to the 15 minute chart: the trend must look FULLY BULLISH before you commit.', 'Cambia al gráfico de 15 minutos: la tendencia debe verse TOTALMENTE ALCISTA antes de entrar.']
                     : ['Switch to the 15 minute chart: the trend must look FULLY BEARISH before you commit.', 'Cambia al gráfico de 15 minutos: la tendencia debe verse TOTALMENTE BAJISTA antes de entrar.'],
          do: call ? ['Confirm the bullish trend on 15m.', 'Confirma la tendencia alcista en 15m.'] : ['Confirm the bearish trend on 15m.', 'Confirma la tendencia bajista en 15m.'] }
      ],
      inval: (s) => call ? (s.dist < -0.035 && s.mom < -0.003) : (s.dist > 0.035 && s.mom > 0.003),
      entra: call ? ['Everything lines up. Take the LONG (call) now.', 'Todo cuadra. Toma el LONG (call) ahora.'] : ['Everything lines up. Take the SHORT (put) now.', 'Todo cuadra. Toma el SHORT (put) ahora.'],
      lejos: call ? (s) => s.dist > 0.02 : (s) => s.dist < -0.02   // ya se fue del lado contrario: todavía lejos
    };
  }
  if (g === 'Efecto imán') {
    // call = tendencia BAJISTA sobre-extendida (rebota ARRIBA); put = ALCISTA sobre-extendida (rebota ABAJO)
    const put = !call;
    return {
      pasos: [
        { test: (s) => put ? s.cortoAlza : !s.cortoAlza,
          tit: ['Trend', 'Tendencia'],
          txt: put ? ['In the moving averages we must be in a clearly BULLISH trend, several days going up.', 'En las medias móviles debemos estar en una tendencia claramente ALCISTA, varios días subiendo.']
                   : ['In the moving averages we must be in a clearly BEARISH trend, several days going down.', 'En las medias móviles debemos estar en una tendencia claramente BAJISTA, varios días bajando.'],
          do: ['Confirm the background trend first.', 'Confirma primero la tendencia de fondo.'] },
        { test: (s) => put ? s.dist > 0.045 : s.dist < -0.045,
          tit: ['Overextended jump', 'Salto sobre-extendido'],
          txt: put ? ['Price opens with a strong jump UP and ends up far away from the 20 moving average.', 'El precio abre con un fuerte salto al ALZA y queda muy alejado de la media móvil de 20.']
                   : ['Price opens with a strong jump DOWN and ends up far away from the 20 moving average.', 'El precio abre con un fuerte salto a la BAJA y queda muy alejado de la media móvil de 20.'],
          do: ['Wait for it to stretch far from the MA20.', 'Espera a que se estire lejos de la MM20.'] },
        { test: (s) => put ? s.bbPos > 0.97 : s.bbPos < 0.03,
          tit: ['Outside Bollinger', 'Fuera de Bollinger'],
          txt: ['On Bollinger in 15 minutes, the first candle must end COMPLETELY outside the band.', 'En Bollinger en 15 minutos la primera vela debe quedar COMPLETAMENTE fuera de la banda.'],
          do: ['Wait for the candle fully outside the band.', 'Espera la vela completamente fuera de la banda.'] },
        { test: (s) => put ? s.cruzaAbajo : s.cruzaArriba,
          tit: ['Worden cross', 'Cruce del Worden'],
          txt: put ? ['When the candle starts to form it must cross the RED line of the Worden Stochastics: that is the PUT confirmation.', 'Cuando empiece a formarse la vela deberá cruzar la línea ROJA del Worden Stochastics: esa es la confirmación de PUT.']
                   : ['When the candle starts to form it must cross the RED line of the Worden Stochastics: that is the CALL confirmation.', 'Cuando empiece a formarse la vela deberá cruzar la línea ROJA del Worden Stochastics: esa es la confirmación de CALL.'],
          do: ['Watch the Worden for the cross.', 'Vigila el Worden para el cruce.'] }
      ],
      inval: (s) => put ? !s.cortoAlza : s.cortoAlza,
      entra: put ? ['The Worden crossed. Take the SHORT (put) now.', 'El Worden cruzó. Toma el SHORT (put) ahora.'] : ['The Worden crossed. Take the LONG (call) now.', 'El Worden cruzó. Toma el LONG (call) ahora.'],
      lejos: put ? (s) => !s.cortoAlza : (s) => s.cortoAlza
    };
  }
  // Rebote en punto medio: call = al alza; put = a la baja
  return {
    pasos: [
      { test: (s) => call ? s.largoAlza : !s.largoAlza,
        tit: ['Daily trend', 'Tendencia en Día'],
        txt: call ? ['On the DAILY Bollinger we must be in a clearly BULLISH trend.', 'En Bollinger en temporalidad DÍA debemos estar en una tendencia claramente ALCISTA.']
                  : ['On the DAILY Bollinger we must be in a clearly BEARISH trend.', 'En Bollinger en temporalidad DÍA debemos estar en una tendencia claramente BAJISTA.'],
        do: ['Confirm the daily trend.', 'Confirma la tendencia en Día.'] },
      { test: (s) => call ? (s.dist > 0 && s.dist < 0.05 && s.mom < 0.0015) : (s.dist < 0 && s.dist > -0.05 && s.mom > -0.0015),
        tit: ['Pullback to midpoint', 'Corrección al punto medio'],
        txt: call ? ['On the HOUR it corrects down toward the midpoint, the 20 moving average, which we mark with a line as the bounce reference.', 'En la HORA corrige a la baja acercándose al punto medio, la media móvil de 20, que marcamos con una línea como referencia del rebote.']
                  : ['On the HOUR it corrects up toward the midpoint, the 20 moving average, which we mark with a line as the bounce reference.', 'En la HORA corrige al alza acercándose al punto medio, la media móvil de 20, que marcamos con una línea como referencia del rebote.'],
        do: ['Let it come to the midpoint (MA20).', 'Deja que llegue al punto medio (MM20).'] },
      { test: (s) => call ? (s.dist > -0.006 && s.dist < 0.012) : (s.dist < 0.006 && s.dist > -0.012),
        tit: ['Respect the midpoint', 'Respeta el punto medio'],
        txt: call ? ['When price touches that mark, check it does NOT cross it but RESPECTS it. Switch to 15 minutes and wait for it to start bouncing.', 'Cuando el precio toca esa marca, verifica que NO la cruce sino que la RESPETE. Cambia a 15 minutos y espera que empiece a rebotar.']
                  : ['When price touches that mark, check it does NOT cross it but RESPECTS it. Switch to 15 minutes and wait for it to start bouncing.', 'Cuando el precio toca esa marca, verifica que NO la cruce sino que la RESPETE. Cambia a 15 minutos y espera que empiece a rebotar.'],
        do: ['Make sure it respects the line.', 'Verifica que respete la línea.'] },
      { test: (s) => call ? (s.mom > 0.0015 && s.velaAlcista) : (s.mom < -0.0015 && !s.velaAlcista),
        tit: ['Confirmation candle', 'Vela de confirmación'],
        txt: call ? ['On the HOUR, wait for a BULLISH confirmation candle and take the entry in CALL.', 'En la HORA, espera una vela de confirmación ALCISTA y toma la entrada en CALL.']
                  : ['On the HOUR, wait for a BEARISH confirmation candle and take the entry in PUT.', 'En la HORA, espera una vela de confirmación BAJISTA y toma la entrada en PUT.'],
        do: call ? ['Wait for the bullish candle on the hour.', 'Espera la vela alcista en la hora.'] : ['Wait for the bearish candle on the hour.', 'Espera la vela bajista en la hora.'] }
    ],
    inval: (s) => call ? s.dist < -0.018 : s.dist > 0.018,     // cruzó el punto medio, no lo respetó
    entra: call ? ['It bounced and confirmed. Take the LONG (call) now.', 'Rebotó y confirmó. Toma el LONG (call) ahora.'] : ['It bounced and confirmed. Take the SHORT (put) now.', 'Rebotó y confirmó. Toma el SHORT (put) ahora.'],
    lejos: call ? (s) => !s.largoAlza : (s) => s.largoAlza
  };
}

const L = (a, lang) => a[lang === 'es' ? 1 : 0];

export function leerCatalyst(velas, estr, rot) {
  const s = señales(velas);
  const sym = (estr && estr._sym) || 'this stock';
  if (!s) return { escena: 'vigilar', prox: 0.2, lado: estr.lado, nivel: null,
    titulo: { en: 'Reading the tape', es: 'Leyendo el precio' },
    txt: { en: `Loading enough history on ${sym} to read the setup.`, es: `Cargando suficiente historial de ${sym} para leer el setup.` },
    hacer: { en: 'Hold on a moment.', es: 'Espera un momento.' } };

  const r = receta(estr);
  const total = r.pasos.length;
  const nivel = s.ma20;
  // primer paso sin cumplir
  let hecho = 0; for (let i = 0; i < total; i++) { if (r.pasos[i].test(s)) hecho++; else break; }
  const invalida = r.inval(s);

  // escena a partir del progreso
  let escena, paso = r.pasos[Math.min(hecho, total - 1)];
  if (invalida && hecho < total) escena = 'invalida';
  else if (hecho >= total) escena = 'entra';
  else if (hecho === total - 1) escena = 'listo';
  else if (hecho === total - 2) escena = 'cerca';
  else if (hecho === 0 && r.lejos(s)) escena = 'lejos';
  else escena = 'vigilar';

  const nStr = `${Math.min(hecho + 1, total)}/${total}`;
  let titulo, txt, hacer, prox;
  if (escena === 'entra') {
    titulo = { en: 'This is the entry', es: 'Esta es la entrada' };
    txt = { en: `${sym}: every requirement of the setup is complete near ${P(nivel)}.`, es: `${sym}: todos los requisitos del setup están cumplidos cerca de ${P(nivel)}.` };
    hacer = { en: L(r.entra, 'en'), es: L(r.entra, 'es') };
    prox = 1;
  } else if (escena === 'invalida') {
    titulo = { en: 'Setup cancelled', es: 'Setup cancelado' };
    txt = { en: `${sym} broke the setup before it completed. A broken setup is a no, not a discount.`, es: `${sym} rompió el setup antes de completarse. Un setup roto es un no, no un descuento.` };
    hacer = { en: 'Stand aside. Wait for a fresh one.', es: 'Hazte a un lado. Espera uno nuevo.' };
    prox = 0.1;
  } else if (escena === 'lejos') {
    titulo = { en: 'Not your moment', es: 'No es tu momento' };
    txt = { en: `${sym} is not in this setup yet. Step 1: ${L(paso.txt, 'en')}`, es: `${sym} todavía no está en este setup. Paso 1: ${L(paso.txt, 'es')}` };
    hacer = { en: L(paso.do, 'en'), es: L(paso.do, 'es') };
    prox = 0.15;
  } else {
    titulo = { en: `${nStr} · ${L(paso.tit, 'en')}`, es: `${nStr} · ${L(paso.tit, 'es')}` };
    txt = { en: `${sym} near ${P(nivel)}. ${L(paso.txt, 'en')}`, es: `${sym} cerca de ${P(nivel)}. ${L(paso.txt, 'es')}` };
    hacer = { en: L(paso.do, 'en'), es: L(paso.do, 'es') };
    prox = 0.3 + 0.6 * (hecho / total);
  }
  return { escena, prox, lado: estr.lado, nivel, titulo, txt, hacer };
}
