/* vwap-analista.js — El analista de VWAP Pro (Jesús).

   Lee en tiempo real DÓNDE está el precio respecto al VWAP institucional y sus
   bandas de desviación (±2σ) y devuelve un mensaje profesional: qué significa
   esa posición y cuál es la mejor jugada. Mismo formato bilingüe { en, es } que
   los analistas de Smart Pools (asistente.js), para reutilizar la misma píldora.

   El VWAP (precio medio ponderado por volumen) es el valor que vigilan las
   mesas institucionales: por encima manda el comprador, por debajo el vendedor.
   Las bandas marcan el premium (+2σ) y el descuento (−2σ): tocar una banda es
   zona de reacción (reversión al VWAP o aceptación y continuación). Que las
   bandas se abran = expansión/tendencia; que se cierren = compresión/ruptura
   en preparación. La pendiente del VWAP marca el sesgo.

   Nada inventado: cada cifra sale de vwapBands() sobre las velas reales. El
   analista SIEMPRE da una lectura clara (el precio siempre está en algún sitio
   respecto al VWAP); nunca dice "no hay nada".

   Español SIN guiones (regla del proyecto). */

import { vwapBands } from './indicadores.js?v=6';

const dos = (en, es) => ({ en, es });
const pc = (x, d = 2) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d) + '%';   // signo menos tipográfico, no guion
const ap = (x, d = 2) => Math.abs(x).toFixed(d) + '%';
function fmtN(x) {
  if (!isFinite(x)) return '0';
  const a = Math.abs(x);
  const d = a >= 1000 ? 2 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/* ───────────────────── Núcleo por ZONA ─────────────────────
   Qué significa que el precio esté en esa zona respecto al VWAP. */
const NUCLEO = {
  sobreSup: dos(
    'According to the VWAP, price is stretched ABOVE the +2σ band, far beyond fair value. This is the premium extreme, where profit taking and mean reversion sellers take over. Chasing longs here is the worst reward to risk on the whole map.',
    'Según el VWAP, el precio está estirado POR ENCIMA de la banda +2σ, muy lejos del valor justo. Es el extremo premium, donde toman el control la toma de ganancias y los vendedores de reversión. Perseguir largos aquí es el peor beneficio por riesgo de todo el mapa.'),
  tocaSup: dos(
    'According to the VWAP, price is at the upper deviation band (+2σ), a reaction zone. From here it either gets rejected back toward the VWAP, or it is accepted and runs. Lean on the reaction, this is not a place to chase up.',
    'Según el VWAP, el precio está en la banda superior de desviación (+2σ), una zona de reacción. Desde aquí o lo rechazan de vuelta al VWAP, o lo aceptan y corre. Apóyate en la reacción, no es sitio para perseguir arriba.'),
  premium: dos(
    'According to the VWAP, price is on the premium side, above fair value but not yet stretched. Buyers are in control and in profit on the session. The clean long is a pullback into the VWAP, not a chase up here.',
    'Según el VWAP, el precio está en el lado premium, por encima del valor justo pero aún sin estirarse. El comprador tiene el control y va en ganancia en la sesión. El largo limpio es un retroceso al VWAP, no perseguir aquí arriba.'),
  centro: dos(
    'According to the VWAP, price is sitting right on fair value, the institutional line of decision. Above it the session is bullish, below it bearish. The highest probability entries of the day happen right here.',
    'Según el VWAP, el precio está justo en el valor justo, la línea de decisión institucional. Por encima la sesión es alcista, por debajo bajista. Las entradas de mayor probabilidad del día ocurren justo aquí.'),
  descuento: dos(
    'According to the VWAP, price is on the discount side, below fair value but not yet stretched. Sellers are in control and buyers are underwater on the session. The clean short is a bounce back to the VWAP, not a chase down here.',
    'Según el VWAP, el precio está en el lado descuento, por debajo del valor justo pero aún sin estirarse. El vendedor tiene el control y el comprador va en pérdida en la sesión. El corto limpio es un rebote de vuelta al VWAP, no perseguir aquí abajo.'),
  tocaInf: dos(
    'According to the VWAP, price is at the lower deviation band (−2σ), a reaction zone. From here it either bounces back toward the VWAP, or it is accepted and the drop continues. Lean on the reaction, this is not a place to chase down.',
    'Según el VWAP, el precio está en la banda inferior de desviación (−2σ), una zona de reacción. Desde aquí o rebota de vuelta al VWAP, o lo aceptan y la caída sigue. Apóyate en la reacción, no es sitio para perseguir abajo.'),
  sobreInf: dos(
    'According to the VWAP, price is stretched BELOW the −2σ band, far beyond fair value. This is the discount extreme, where bargain buyers and mean reversion take over. Chasing shorts here is the worst reward to risk on the whole map.',
    'Según el VWAP, el precio está estirado POR DEBAJO de la banda −2σ, muy lejos del valor justo. Es el extremo descuento, donde toman el control los compradores de oportunidad y la reversión. Perseguir cortos aquí es el peor beneficio por riesgo de todo el mapa.')
};

/* Frase de PENDIENTE (sesgo del VWAP). */
function frasePend(est) {
  if (est === 'sube') return dos('VWAP is rising: the institutional bias is up and the VWAP works as support.', 'El VWAP sube: el sesgo institucional es alcista y el VWAP funciona como soporte.');
  if (est === 'baja') return dos('VWAP is falling: the institutional bias is down and the VWAP works as resistance.', 'El VWAP baja: el sesgo institucional es bajista y el VWAP funciona como resistencia.');
  return dos('VWAP is flat: balance, price is rotating around value with no clear side.', 'El VWAP está plano: equilibrio, el precio rota alrededor del valor sin un lado claro.');
}

/* Frase de ANCHO (régimen de bandas). */
function fraseAncho(est) {
  if (est === 'abre') return dos('The bands are opening: volatility is expanding and momentum is in control, so fading the move is dangerous.', 'Las bandas se están abriendo: la volatilidad se expande y manda el movimiento, así que ir contra el impulso es peligroso.');
  if (est === 'cierra') return dos('The bands are tightening: volatility is compressing and the market is coiling for a breakout.', 'Las bandas se están cerrando: la volatilidad se comprime y el mercado se está cargando para una ruptura.');
  return dos('The bands are steady: an orderly range around value, clean for working the edges.', 'Las bandas están estables: un rango ordenado alrededor del valor, limpio para trabajar los extremos.');
}

/* ───────────────────── Recomendación (la mejor jugada) ─────────────────────
   Depende de la ZONA + la PENDIENTE + el ANCHO. Siempre dice una zona de
   entrada concreta y qué vigilar. */
function recomendar(zona, pend, ancho, px) {
  const alza = pend === 'sube', baja = pend === 'baja';
  const V = px.vwap, U = px.up, Lo = px.lo;
  const sup = fmtN(U), inf = fmtN(Lo), vwap = fmtN(V);
  switch (zona) {
    case 'centro':
      if (alza) return dos(
        `By the VWAP, this is the highest probability long of the day. Price is on fair value (${vwap}) with the VWAP rising under it: the bias is up. Long the hold of the VWAP (wait for a bullish rejection candle), stop just below it, first target the upper band at ${sup}. This is the entry the desks wait for.`,
        `Por el VWAP, este es el largo de mayor probabilidad del día. El precio está en el valor justo (${vwap}) con el VWAP subiendo por debajo: el sesgo es alcista. Entra largo al aguante del VWAP (espera una vela de rechazo al alza), stop justo debajo, primer objetivo la banda superior en ${sup}. Esta es la entrada que esperan las mesas.`);
      if (baja) return dos(
        `By the VWAP, this is the highest probability short of the day. Price is on fair value (${vwap}) with the VWAP falling over it: the bias is down. Short the rejection of the VWAP (wait for a bearish candle), stop just above it, first target the lower band at ${inf}.`,
        `Por el VWAP, este es el corto de mayor probabilidad del día. El precio está en el valor justo (${vwap}) con el VWAP bajando por encima: el sesgo es bajista. Entra corto al rechazo del VWAP (espera una vela bajista), stop justo encima, primer objetivo la banda inferior en ${inf}.`);
      return dos(
        `By the VWAP there is no clear side at fair value (${vwap}): work the edges, not the middle. Buy the reaction at the lower band ${inf}, sell the reaction at the upper band ${sup}, with the VWAP as the pivot. Do not force a trade in the middle.`,
        `Por el VWAP no hay lado claro en el valor justo (${vwap}): trabaja los extremos, no el medio. Compra la reacción en la banda inferior ${inf}, vende la reacción en la banda superior ${sup}, con el VWAP como pivote. No fuerces una entrada en el medio.`);
    case 'premium':
      if (alza) return dos(
        `By the VWAP, do not chase up here. Price is in premium over a rising VWAP: the edge is to wait for the pullback into the VWAP at ${vwap} and go long there. Set your alert at the VWAP. Only ride higher if the bands are opening and you already hold the long.`,
        `Por el VWAP, no persigas aquí arriba. El precio está en premium sobre un VWAP que sube: la ventaja es esperar el retroceso al VWAP en ${vwap} y entrar largo ahí. Pon tu alerta en el VWAP. Solo acompaña más arriba si las bandas se abren y ya tienes el largo.`);
      if (baja) return dos(
        `By the VWAP this is a bounce into resistance, not strength: price is above a falling VWAP. Favor the fade toward the VWAP at ${vwap}; a rejection here is a short back to value. Do not buy a bounce against a falling VWAP.`,
        `Por el VWAP esto es un rebote contra resistencia, no fuerza: el precio está sobre un VWAP que baja. Favorece la reversión hacia el VWAP en ${vwap}; un rechazo aquí es un corto de vuelta al valor. No compres un rebote contra un VWAP que baja.`);
      return dos(
        `By the VWAP price is rich on a flat VWAP: the edge is a reversion toward the VWAP at ${vwap}, or a tag of the upper band ${sup} to fade. Buying here, in the middle, pays the worst price.`,
        `Por el VWAP el precio está caro con un VWAP plano: la ventaja es una reversión hacia el VWAP en ${vwap}, o un toque de la banda superior ${sup} para desvanecer. Comprar aquí, en el medio, paga el peor precio.`);
    case 'tocaSup':
      if (alza && ancho === 'abre') return dos(
        `By the VWAP this is a trend day: price is riding the upper band with opening bands and a rising VWAP. Do not short it. Hold the long you have, or buy the next pullback to the VWAP at ${vwap}; while the bands keep opening the band is a magnet, not a ceiling.`,
        `Por el VWAP esto es un día de tendencia: el precio cabalga la banda superior con bandas que se abren y VWAP al alza. No le pongas corto. Mantén el largo que tengas, o compra el próximo retroceso al VWAP en ${vwap}; mientras las bandas sigan abriendo la banda es un imán, no un techo.`);
      return dos(
        `By the VWAP, price is at the upper band (${sup}): the high reward play is the reversion. A clear rejection candle here is a short back toward the VWAP at ${vwap}, stop above the band. Only turn bullish if a candle closes and holds above the band.`,
        `Por el VWAP, el precio está en la banda superior (${sup}): la jugada de buen beneficio es la reversión. Una vela de rechazo clara aquí es un corto de vuelta al VWAP en ${vwap}, stop por encima de la banda. Solo cambia a alcista si una vela cierra y aguanta por encima de la banda.`);
    case 'sobreSup':
      if (alza && ancho === 'abre') return dos(
        `By the VWAP this is strength, not a short: price broke above the +2σ band in a strong, expanding uptrend. Do not fade it blindly. Wait for price to lose the upper band ${sup} and close back inside before fading toward the VWAP at ${vwap}.`,
        `Por el VWAP esto es fuerza, no un corto: el precio rompió por encima de la banda +2σ en una tendencia alcista fuerte y en expansión. No lo desvanezcas a ciegas. Espera a que el precio pierda la banda superior ${sup} y cierre de vuelta dentro antes de buscar la reversión hacia el VWAP en ${vwap}.`);
      return dos(
        `By the VWAP this is overextension: price is beyond the +2σ band and the trend is not expanding to justify it. Favor the reversion, a close back inside the band is a short toward the VWAP at ${vwap}. Take profit on longs here; do not add.`,
        `Por el VWAP esto es sobreextensión: el precio está más allá de la banda +2σ y la tendencia no se expande para justificarlo. Favorece la reversión, un cierre de vuelta dentro de la banda es un corto hacia el VWAP en ${vwap}. Toma ganancias de los largos aquí; no sumes.`);
    case 'descuento':
      if (baja) return dos(
        `By the VWAP, do not chase down here. Price is at a discount under a falling VWAP: the edge is to wait for the bounce into the VWAP at ${vwap} and short there. Set your alert at the VWAP. Only ride lower if the bands are opening and you already hold the short.`,
        `Por el VWAP, no persigas aquí abajo. El precio está en descuento bajo un VWAP que baja: la ventaja es esperar el rebote al VWAP en ${vwap} y entrar corto ahí. Pon tu alerta en el VWAP. Solo acompaña más abajo si las bandas se abren y ya tienes el corto.`);
      if (alza) return dos(
        `By the VWAP this is a discount inside an uptrend, an accumulation zone: price is below a rising VWAP. The play is a long as price reclaims the VWAP at ${vwap}, not a short. Buying the dip toward the lower band ${inf} with a tight stop is the aggressive version.`,
        `Por el VWAP esto es un descuento dentro de una tendencia alcista, una zona de acumulación: el precio está bajo un VWAP que sube. La jugada es un largo cuando el precio recupere el VWAP en ${vwap}, no un corto. Comprar la caída hacia la banda inferior ${inf} con stop ajustado es la versión agresiva.`);
      return dos(
        `By the VWAP price is cheap on a flat VWAP: the edge is a reversion toward the VWAP at ${vwap}, or a tag of the lower band ${inf} to buy. Selling here, in the middle, pays the worst price.`,
        `Por el VWAP el precio está barato con un VWAP plano: la ventaja es una reversión hacia el VWAP en ${vwap}, o un toque de la banda inferior ${inf} para comprar. Vender aquí, en el medio, paga el peor precio.`);
    case 'tocaInf':
      if (baja && ancho === 'abre') return dos(
        `By the VWAP this is a trend day down: price is riding the lower band with opening bands and a falling VWAP. Do not buy it. Hold the short you have, or sell the next bounce to the VWAP at ${vwap}; while the bands keep opening the band is a magnet, not a floor.`,
        `Por el VWAP esto es un día de tendencia bajista: el precio cabalga la banda inferior con bandas que se abren y VWAP a la baja. No lo compres. Mantén el corto que tengas, o vende el próximo rebote al VWAP en ${vwap}; mientras las bandas sigan abriendo la banda es un imán, no un suelo.`);
      return dos(
        `By the VWAP, price is at the lower band (${inf}): the high reward play is the bounce. A clear rejection candle here (a hammer) is a long back toward the VWAP at ${vwap}, stop below the band. Only stay bearish if a candle closes and holds below the band.`,
        `Por el VWAP, el precio está en la banda inferior (${inf}): la jugada de buen beneficio es el rebote. Una vela de rechazo clara aquí (un martillo) es un largo de vuelta al VWAP en ${vwap}, stop por debajo de la banda. Solo sigue bajista si una vela cierra y aguanta por debajo de la banda.`);
    case 'sobreInf':
      if (baja && ancho === 'abre') return dos(
        `By the VWAP this is weakness, not a buy: price broke below the −2σ band in a strong, expanding downtrend. Do not catch it blindly. Wait for price to reclaim the lower band ${inf} and close back inside before playing the bounce toward the VWAP at ${vwap}.`,
        `Por el VWAP esto es debilidad, no una compra: el precio rompió por debajo de la banda −2σ en una tendencia bajista fuerte y en expansión. No lo atrapes a ciegas. Espera a que el precio recupere la banda inferior ${inf} y cierre de vuelta dentro antes de jugar el rebote hacia el VWAP en ${vwap}.`);
      return dos(
        `By the VWAP this is overextension down: price is beyond the −2σ band and the trend is not expanding to justify it. Favor the bounce, a close back inside the band is a long toward the VWAP at ${vwap}. Take profit on shorts here; do not add.`,
        `Por el VWAP esto es sobreextensión a la baja: el precio está más allá de la banda −2σ y la tendencia no se expande para justificarlo. Favorece el rebote, un cierre de vuelta dentro de la banda es un largo hacia el VWAP en ${vwap}. Toma ganancias de los cortos aquí; no sumes.`);
  }
  return dos('', '');
}

/* Título por ZONA + sesgo. */
function titular(zona, pend) {
  const alza = pend === 'sube', baja = pend === 'baja';
  const T = {
    sobreSup: dos('Stretched above the +2σ band', 'Estirado sobre la banda +2σ'),
    tocaSup: dos('Testing the upper band', 'Probando la banda superior'),
    premium: alza ? dos('Premium side, VWAP rising', 'Lado premium, VWAP al alza') : baja ? dos('Above a falling VWAP', 'Sobre un VWAP a la baja') : dos('Premium side of value', 'Lado premium del valor'),
    centro: alza ? dos('At the VWAP, bias up', 'En el VWAP, sesgo al alza') : baja ? dos('At the VWAP, bias down', 'En el VWAP, sesgo a la baja') : dos('At the VWAP, balanced', 'En el VWAP, equilibrado'),
    descuento: baja ? dos('Discount side, VWAP falling', 'Lado descuento, VWAP a la baja') : alza ? dos('Below a rising VWAP', 'Bajo un VWAP al alza') : dos('Discount side of value', 'Lado descuento del valor'),
    tocaInf: dos('Testing the lower band', 'Probando la banda inferior'),
    sobreInf: dos('Stretched below the −2σ band', 'Estirado bajo la banda −2σ')
  };
  return T[zona] || dos('Reading the VWAP', 'Leyendo el VWAP');
}

/* tipo (color/ícono de la píldora). */
function tipoDe(zona, pend, ancho) {
  const alza = pend === 'sube', baja = pend === 'baja';
  if (zona === 'centro') return alza ? 'compra' : baja ? 'venta' : 'vigilar';
  if (zona === 'premium') return alza ? 'tendencia' : baja ? 'venta' : 'vigilar';
  if (zona === 'descuento') return baja ? 'tendencia' : alza ? 'compra' : 'vigilar';
  if (zona === 'tocaSup') return (alza && ancho === 'abre') ? 'tendencia' : 'vigilar';
  if (zona === 'tocaInf') return (baja && ancho === 'abre') ? 'tendencia' : 'vigilar';
  if (zona === 'sobreSup') return (alza && ancho === 'abre') ? 'tendencia' : 'aviso';
  if (zona === 'sobreInf') return (baja && ancho === 'abre') ? 'tendencia' : 'aviso';
  return 'vigilar';
}

/**
 * Lee la posición del precio respecto al VWAP y sus bandas.
 * @param velas  array de velas { time, open, high, low, close, volume }
 * @param precioVivo  precio actual (último tick); si falta, usa el cierre
 * @param meta  { par, tf } para nombrar la moneda y la temporalidad
 * @returns { clave, tipo, titulo, txt, hacer, detalle, vwap, up, lo, z } o null
 */
export function leerVWAP(velas, precioVivo, meta) {
  if (!velas || velas.length < 30) return null;
  let vb;
  try { vb = vwapBands(velas, 2); } catch (_) { return null; }
  const n = vb && vb.mid ? vb.mid.length : 0;
  if (n < 6) return null;

  const mid = vb.mid[n - 1].value, up = vb.up[n - 1].value, lo = vb.lo[n - 1].value;
  const precio = (precioVivo > 0 ? precioVivo : velas[velas.length - 1].close);
  const sigma = Math.max(1e-9, (up - mid) / 2);
  const z = (precio - mid) / sigma;                         // posición en desviaciones
  const distPct = ((precio - mid) / mid) * 100;             // distancia al VWAP en %

  const k = Math.min(n - 1, 8);
  const midPrev = vb.mid[n - 1 - k].value;
  const pendPct = midPrev ? ((mid - midPrev) / midPrev) * 100 : 0;
  // umbral de "plano" proporcional a la volatilidad (sigma relativo)
  const sigRel = (sigma / mid) * 100;
  const epsPend = Math.max(0.03, sigRel * 0.12);
  const pend = pendPct > epsPend ? 'sube' : pendPct < -epsPend ? 'baja' : 'plano';

  const anchoNow = up - lo;
  const upPrev = vb.up[n - 1 - k].value, loPrev = vb.lo[n - 1 - k].value;
  const anchoPrev = Math.max(1e-9, upPrev - loPrev);
  const anchoChg = ((anchoNow - anchoPrev) / anchoPrev) * 100;
  const ancho = anchoChg > 4 ? 'abre' : anchoChg < -4 ? 'cierra' : 'estable';

  let zona;
  if (z > 2) zona = 'sobreSup';
  else if (z > 1.3) zona = 'tocaSup';
  else if (z > 0.35) zona = 'premium';
  else if (z >= -0.35) zona = 'centro';
  else if (z > -1.3) zona = 'descuento';
  else if (z >= -2) zona = 'tocaInf';
  else zona = 'sobreInf';

  const tipo = tipoDe(zona, pend, ancho);
  const titulo = titular(zona, pend);
  const nucleo = NUCLEO[zona];
  const fp = frasePend(pend), fa = fraseAncho(ancho);
  const zTxt = (z >= 0 ? '+' : '−') + Math.abs(z).toFixed(2) + 'σ';
  const dondeEsta = dos(
    `Right now price is ${ap(distPct)} from the VWAP (${zTxt}).`,
    `Ahora mismo el precio está a ${ap(distPct)} del VWAP (${zTxt}).`);
  const txt = dos(
    `${nucleo.en} ${dondeEsta.en} ${fp.en} ${fa.en}`,
    `${nucleo.es} ${dondeEsta.es} ${fp.es} ${fa.es}`);
  const hacer = recomendar(zona, pend, ancho, { vwap: mid, up, lo });

  const par = (meta && meta.par) || '';
  const tf = (meta && meta.tf) || '';
  const detalle = [
    dos(`${par ? par + ' · ' : ''}${tf ? tf + ' · ' : ''}live VWAP read`, `${par ? par + ' · ' : ''}${tf ? tf + ' · ' : ''}lectura del VWAP en vivo`),
    dos(`VWAP (fair value): ${fmtN(mid)}`, `VWAP (valor justo): ${fmtN(mid)}`),
    dos(`Upper band +2σ: ${fmtN(up)} · lower band −2σ: ${fmtN(lo)}`, `Banda superior +2σ: ${fmtN(up)} · banda inferior −2σ: ${fmtN(lo)}`),
    dos(`Price vs VWAP: ${pc(distPct)} (${zTxt})`, `Precio vs VWAP: ${pc(distPct)} (${zTxt})`),
    dos(`VWAP slope: ${pend === 'sube' ? 'rising' : pend === 'baja' ? 'falling' : 'flat'} (${pc(pendPct)} over ${k} candles)`, `Pendiente del VWAP: ${pend === 'sube' ? 'al alza' : pend === 'baja' ? 'a la baja' : 'plana'} (${pc(pendPct)} en ${k} velas)`),
    dos(`Bands: ${ancho === 'abre' ? 'widening' : ancho === 'cierra' ? 'tightening' : 'steady'} (${pc(anchoChg)} width)`, `Bandas: ${ancho === 'abre' ? 'ensanchando' : ancho === 'cierra' ? 'estrechando' : 'estables'} (${pc(anchoChg)} de ancho)`),
    dos('VWAP is the volume weighted average price: the fair value institutions benchmark against.', 'El VWAP es el precio medio ponderado por volumen: el valor justo que las instituciones usan como referencia.')
  ];

  const clave = zona + '|' + pend + '|' + ancho;
  return { clave, tipo, titulo, txt, hacer, detalle, vwap: mid, up, lo, z, zona, pend, ancho };
}
