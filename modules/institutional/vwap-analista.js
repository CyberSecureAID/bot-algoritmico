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
    'Price is trading ABOVE the +2σ band, stretched well beyond fair value. This is the premium extreme: the zone where profit taking and mean reversion sellers show up. Chasing longs here is the worst reward to risk of the whole map.',
    'El precio cotiza POR ENCIMA de la banda +2σ, muy estirado sobre el valor justo. Es el extremo premium: la zona donde aparecen la toma de ganancias y los vendedores de reversión. Perseguir largos aquí es el peor beneficio por riesgo de todo el mapa.'),
  tocaSup: dos(
    'Price is testing the upper deviation band (+2σ). This is a reaction zone: either it gets rejected and reverts toward the VWAP, or it is accepted and the move continues. The next candle decides which.',
    'El precio está probando la banda superior de desviación (+2σ). Es zona de reacción: o lo rechazan y revierte hacia el VWAP, o lo aceptan y el movimiento continúa. La próxima vela decide cuál.'),
  premium: dos(
    'Price sits on the premium side, above the VWAP but not yet extended. Buyers are in control and in profit on the session. Here value is above you: the clean long is a pullback to the VWAP, not a chase up here.',
    'El precio está en el lado premium, por encima del VWAP pero aún sin estirarse. El comprador tiene el control y va en ganancia en la sesión. Aquí el valor queda por debajo: el largo limpio es un retroceso al VWAP, no perseguir arriba.'),
  centro: dos(
    'Price is sitting right on the VWAP, the institutional line of decision. This is fair value: above it the session is bullish, below it bearish. The highest probability entries of the day happen here, where the big desks benchmark their fills.',
    'El precio está justo sobre el VWAP, la línea de decisión institucional. Esto es valor justo: por encima la sesión es alcista, por debajo bajista. Las entradas de mayor probabilidad del día ocurren aquí, donde las grandes mesas referencian sus ejecuciones.'),
  descuento: dos(
    'Price sits on the discount side, below the VWAP but not yet extended. Sellers are in control and buyers are underwater on the session. Value is above you: the clean short is a bounce back to the VWAP, not a chase down here.',
    'El precio está en el lado descuento, por debajo del VWAP pero aún sin estirarse. El vendedor tiene el control y el comprador va en pérdida en la sesión. El valor queda por encima: el corto limpio es un rebote de vuelta al VWAP, no perseguir abajo.'),
  tocaInf: dos(
    'Price is testing the lower deviation band (−2σ). This is a reaction zone: either it gets rejected and bounces toward the VWAP, or it is accepted and the drop continues. The next candle decides which.',
    'El precio está probando la banda inferior de desviación (−2σ). Es zona de reacción: o lo rechazan y rebota hacia el VWAP, o lo aceptan y la caída continúa. La próxima vela decide cuál.'),
  sobreInf: dos(
    'Price is trading BELOW the −2σ band, stretched well beyond fair value. This is the discount extreme: the zone where bargain buyers and mean reversion show up. Chasing shorts here is the worst reward to risk of the whole map.',
    'El precio cotiza POR DEBAJO de la banda −2σ, muy estirado bajo el valor justo. Es el extremo descuento: la zona donde aparecen los compradores de oportunidad y la reversión. Perseguir cortos aquí es el peor beneficio por riesgo de todo el mapa.')
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
        `Highest probability long zone of the day: price is at the VWAP (${vwap}) with a bullish bias. If the VWAP holds as support (a bullish rejection candle), enter long here with the stop just below it; first target the upper band at ${sup}. This is the entry professionals wait for.`,
        `Zona de largo de mayor probabilidad del día: el precio está en el VWAP (${vwap}) con sesgo alcista. Si el VWAP aguanta como soporte (una vela de rechazo al alza), entra en largo aquí con el stop justo por debajo; primer objetivo la banda superior en ${sup}. Esta es la entrada que esperan los profesionales.`);
      if (baja) return dos(
        `Highest probability short zone of the day: price is at the VWAP (${vwap}) with a bearish bias. If the VWAP caps as resistance (a bearish rejection candle), enter short here with the stop just above it; first target the lower band at ${inf}.`,
        `Zona de corto de mayor probabilidad del día: el precio está en el VWAP (${vwap}) con sesgo bajista. Si el VWAP tapa como resistencia (una vela de rechazo a la baja), entra en corto aquí con el stop justo por encima; primer objetivo la banda inferior en ${inf}.`);
      return dos(
        `No clear side at the VWAP (${vwap}): trade the edges, not the middle. Buy near the lower band ${inf} and sell near the upper band ${sup}, using the VWAP as the pivot. Wait for a reaction at a band, do not force it here.`,
        `Sin lado claro en el VWAP (${vwap}): opera los extremos, no el medio. Compra cerca de la banda inferior ${inf} y vende cerca de la superior ${sup}, usando el VWAP como pivote. Espera la reacción en una banda, no lo fuerces aquí.`);
    case 'premium':
      if (alza) return dos(
        `Do not chase up here. With price in premium and a rising VWAP, the clean long is a pullback into the VWAP at ${vwap}; set an alert there. Only ride higher if the bands are opening and you already hold a position.`,
        `No persigas aquí arriba. Con el precio en premium y el VWAP subiendo, el largo limpio es un retroceso al VWAP en ${vwap}; pon una alerta ahí. Solo acompaña más arriba si las bandas se abren y ya tienes posición.`);
      if (baja) return dos(
        `Price is above a falling VWAP: this is a bounce into resistance, not strength. Favor fading toward the VWAP at ${vwap}; a rejection here is a short back to value. Do not buy a bounce against a falling VWAP.`,
        `El precio está por encima de un VWAP que baja: esto es un rebote contra resistencia, no fuerza. Favorece ir hacia el VWAP en ${vwap}; un rechazo aquí es un corto de vuelta al valor. No compres un rebote contra un VWAP que baja.`);
      return dos(
        `Premium side with a flat VWAP: price is rich. The edge is a reversion toward the VWAP at ${vwap} or a tag of the upper band ${sup} to fade. Buying here, in the middle, pays the worst price.`,
        `Lado premium con VWAP plano: el precio está caro. La ventaja es una reversión hacia el VWAP en ${vwap} o un toque de la banda superior ${sup} para desvanecer. Comprar aquí, en el medio, paga el peor precio.`);
    case 'tocaSup':
      if (alza && ancho === 'abre') return dos(
        `Trend day: price is riding the upper band with opening bands and a rising VWAP. Do not short this. Either hold a long you already have, or buy the next pullback to the VWAP at ${vwap}; the band is a magnet, not a ceiling, while it keeps expanding.`,
        `Día de tendencia: el precio cabalga la banda superior con bandas que se abren y VWAP al alza. No pongas corto a esto. O mantienes un largo que ya tengas, o compras el próximo retroceso al VWAP en ${vwap}; la banda es un imán, no un techo, mientras siga expandiendo.`);
      return dos(
        `Price is at the upper band (${sup}): reaction zone. The high reward play is the reversion: a clear rejection candle here is a short back toward the VWAP at ${vwap}, stop above the band. Only flip bullish if a candle closes and holds above the band.`,
        `El precio está en la banda superior (${sup}): zona de reacción. La jugada de buen beneficio es la reversión: una vela de rechazo clara aquí es un corto de vuelta al VWAP en ${vwap}, stop por encima de la banda. Solo cambia a alcista si una vela cierra y aguanta por encima de la banda.`);
    case 'sobreSup':
      if (alza && ancho === 'abre') return dos(
        `Price broke above the +2σ band in a strong, expanding uptrend: this is strength, not a signal to short. Do not fade it blindly. Wait for price to lose the upper band ${sup} and close back inside before fading toward the VWAP at ${vwap}.`,
        `El precio rompió por encima de la banda +2σ en una tendencia alcista fuerte y en expansión: esto es fuerza, no una señal para vender. No lo desvanezcas a ciegas. Espera a que el precio pierda la banda superior ${sup} y cierre de vuelta dentro antes de buscar la reversión hacia el VWAP en ${vwap}.`);
      return dos(
        `Price is stretched beyond the +2σ band and the trend is not expanding to justify it: this is overextension. Favor the reversion: a close back inside the band is a short toward the VWAP at ${vwap}. Take profit on longs here; do not add.`,
        `El precio está estirado más allá de la banda +2σ y la tendencia no se expande para justificarlo: esto es sobreextensión. Favorece la reversión: un cierre de vuelta dentro de la banda es un corto hacia el VWAP en ${vwap}. Toma ganancias de los largos aquí; no sumes.`);
    case 'descuento':
      if (baja) return dos(
        `Do not chase down here. With price at a discount and a falling VWAP, the clean short is a bounce into the VWAP at ${vwap}; set an alert there. Only ride lower if the bands are opening and you already hold a short.`,
        `No persigas aquí abajo. Con el precio en descuento y el VWAP bajando, el corto limpio es un rebote hacia el VWAP en ${vwap}; pon una alerta ahí. Solo acompaña más abajo si las bandas se abren y ya tienes un corto.`);
      if (alza) return dos(
        `Price is below a rising VWAP: this is a discount inside an uptrend, an accumulation zone. The play is a long as price reclaims the VWAP at ${vwap}, not a short. Buying the dip toward the lower band ${inf} with a tight stop is the aggressive version.`,
        `El precio está por debajo de un VWAP que sube: esto es un descuento dentro de una tendencia alcista, una zona de acumulación. La jugada es un largo cuando el precio recupere el VWAP en ${vwap}, no un corto. Comprar la caída hacia la banda inferior ${inf} con stop ajustado es la versión agresiva.`);
      return dos(
        `Discount side with a flat VWAP: price is cheap. The edge is a reversion toward the VWAP at ${vwap} or a tag of the lower band ${inf} to buy. Selling here, in the middle, pays the worst price.`,
        `Lado descuento con VWAP plano: el precio está barato. La ventaja es una reversión hacia el VWAP en ${vwap} o un toque de la banda inferior ${inf} para comprar. Vender aquí, en el medio, paga el peor precio.`);
    case 'tocaInf':
      if (baja && ancho === 'abre') return dos(
        `Trend day down: price is riding the lower band with opening bands and a falling VWAP. Do not buy this. Either hold a short you already have, or sell the next bounce to the VWAP at ${vwap}; the band is a magnet, not a floor, while it keeps expanding.`,
        `Día de tendencia bajista: el precio cabalga la banda inferior con bandas que se abren y VWAP a la baja. No compres esto. O mantienes un corto que ya tengas, o vendes el próximo rebote al VWAP en ${vwap}; la banda es un imán, no un suelo, mientras siga expandiendo.`);
      return dos(
        `Price is at the lower band (${inf}): reaction zone. The high reward play is the bounce: a clear rejection candle here (a hammer) is a long back toward the VWAP at ${vwap}, stop below the band. Only stay bearish if a candle closes and holds below the band.`,
        `El precio está en la banda inferior (${inf}): zona de reacción. La jugada de buen beneficio es el rebote: una vela de rechazo clara aquí (un martillo) es un largo de vuelta al VWAP en ${vwap}, stop por debajo de la banda. Solo sigue bajista si una vela cierra y aguanta por debajo de la banda.`);
    case 'sobreInf':
      if (baja && ancho === 'abre') return dos(
        `Price broke below the −2σ band in a strong, expanding downtrend: this is weakness, not a signal to buy. Do not catch it blindly. Wait for price to reclaim the lower band ${inf} and close back inside before playing the bounce toward the VWAP at ${vwap}.`,
        `El precio rompió por debajo de la banda −2σ en una tendencia bajista fuerte y en expansión: esto es debilidad, no una señal para comprar. No lo atrapes a ciegas. Espera a que el precio recupere la banda inferior ${inf} y cierre de vuelta dentro antes de jugar el rebote hacia el VWAP en ${vwap}.`);
      return dos(
        `Price is stretched beyond the −2σ band and the trend is not expanding to justify it: this is overextension down. Favor the bounce: a close back inside the band is a long toward the VWAP at ${vwap}. Take profit on shorts here; do not add.`,
        `El precio está estirado más allá de la banda −2σ y la tendencia no se expande para justificarlo: esto es sobreextensión a la baja. Favorece el rebote: un cierre de vuelta dentro de la banda es un largo hacia el VWAP en ${vwap}. Toma ganancias de los cortos aquí; no sumes.`);
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
