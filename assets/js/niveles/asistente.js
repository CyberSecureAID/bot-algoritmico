/* niveles/asistente.js — Los tres analistas de Smart Pools.

   [T4·motor] Reescrito con ROLES distintos, para que cada uno aporte algo
   que el usuario no ve a simple vista y no se repitan entre monedas:

     1. SETUP     — ¿hay ventaja real AHORA? Solo propone entrada si el
                    riesgo/beneficio medido contra un objetivo ESTRUCTURAL es
                    ≥ 1,5. Si no la hay, dice exactamente qué la crearía.
     2. CONTEXTO  — tendencia MAYOR (línea sobre ~240 velas) + tendencia
                    CORTA + últimas 24h. Es la que dice si el corto plazo es
                    un retroceso dentro de la de fondo o va en su contra.
     3. NIVELES   — soportes/resistencias reales (toques, fuerza) y qué
                    significa perderlos o romperlos.

   Textos bilingües { en, es } (el botón ES/EN de cada popup elige). Las
   frases se eligen con la semilla por moneda (util.js): mismas condiciones
   en dos monedas → palabras distintas. Nada inventado: cada cifra sale del
   motor. */

import { N } from './estado.js?v=1';
import { elegir, fmt } from './util.js?v=1';
import { pivotes, swings, tendencia, detectarRango, calcularNiveles, detectarImpulso, detectarEstructuras, calcularTendencia, calcularTendenciaMayor, detectarDobles, marea, calcularATR, construirPlan } from './motor.js?v=1';

const dos = (en, es) => ({ en, es });
const pc = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d) + '%';
const apc = (x, d = 1) => Math.abs(x).toFixed(d) + '%';

/* Cuántas horas cubre una temporalidad (para traducir velas → tiempo) */
const HORAS_TF = { '1m': 1 / 60, '3m': 0.05, '5m': 1 / 12, '15m': 0.25, '30m': 0.5, '1h': 1, '2h': 2, '4h': 4, '6h': 6, '12h': 12, '1d': 24, '1w': 168 };
function duracion(velas, tf) {
  const h = (HORAS_TF[tf] || 1) * velas;
  if (h < 48) return dos(`${Math.round(h)} hours`, `${Math.round(h)} horas`);
  if (h < 24 * 21) return dos(`${Math.round(h / 24)} days`, `${Math.round(h / 24)} días`);
  return dos(`${Math.round(h / 24 / 7)} weeks`, `${Math.round(h / 24 / 7)} semanas`);
}

export function analizar(par) {
  const v = N.velas;
  if (v.length < 40) { N.mensajes = []; return; }

  const piv = pivotes(v);                 // micro-pivotes: para niveles (toques) y dobles
  N.atr = calcularATR(v);
  const zz = swings(v, N.atr);            // swings reales (ZigZag por ATR): tendencia, líneas, estructura
  N.swings = zz;
  N.tendencia = tendencia(v, zz);
  N.rango = detectarRango(v);
  N.impulso = detectarImpulso(v);
  N.estructuras = detectarEstructuras(v, zz);
  N.linea = calcularTendencia(v, zz, N.tendencia);
  N.lineaMayor = calcularTendenciaMayor(v, zz);
  /* REGLA: no se muestran dos líneas en la misma dirección (ruido redundante).
     La mayor (punteada, de fondo) solo aparece si APORTA algo distinto a la
     corta: dirección contraria (un retroceso dentro de la tendencia de fondo).
     Si ambas coinciden, basta con la corta (la línea fina). */
  if (N.linea && N.lineaMayor && N.linea.tipo === N.lineaMayor.tipo) N.lineaMayor = null;
  N.precio = v[v.length - 1].c;
  N.dobles = detectarDobles(v, piv, N.precio);
  N.marea = marea(v, N.atr);
  N.niveles = calcularNiveles(v, piv, N.precio);
  if (N.rango) {
    N.niveles = N.niveles.filter((x) =>
      Math.abs(x.p - N.rango.alto) / N.precio < 0.008 ||
      Math.abs(x.p - N.rango.bajo) / N.precio < 0.008).slice(0, 2);
  }

  const tf = N.tf, precio = N.precio;
  const atrPct = N.atr > 0 ? (N.atr / precio) * 100 : 0;

  /* Últimas 24h reales */
  const desde24 = v[v.length - 1].t - 24 * 3600 * 1000;
  let h24 = -Infinity, l24 = Infinity, c24 = null;
  for (let i = v.length - 1; i >= 0; i--) { const x = v[i]; if (x.t < desde24) break; if (x.h > h24) h24 = x.h; if (x.l < l24) l24 = x.l; c24 = x.o; }
  const chg24 = c24 ? ((precio - c24) / c24) * 100 : 0;
  const pos24 = h24 > l24 ? ((precio - l24) / (h24 - l24)) * 100 : 50;

  const soportes = N.niveles.filter((x) => x.tipo === 'soporte' && x.p < precio);
  const resist = N.niveles.filter((x) => x.tipo === 'resistencia' && x.p > precio);
  const sCerca = soportes[0];
  const rCerca = resist[resist.length - 1];

  const mayor = N.lineaMayor, corta = N.tendencia;
  const dirM = mayor ? mayor.tipo : null;
  const dirC = corta.dir;
  const alcM = dirM === 'alcista', bajM = dirM === 'bajista';
  const alcC = dirC === 'alcista', bajC = dirC === 'bajista';

  /* ══════════════════ 2. CONTEXTO ══════════════════ */
  const durM = mayor ? duracion(mayor.velas, tf) : null;
  let tituloC, txtC, hacerC;
  if (alcM && alcC) {
    tituloC = elegir([dos('Uptrend on both horizons', 'Alcista en los dos horizontes'), dos('Trend and pullbacks agree: up', 'Fondo y corto plazo coinciden: arriba'), dos('Rising structure, long and short term', 'Estructura al alza en largo y corto plazo')]);
    hacerC = elegir([dos('Everything lines up for longs. Shorting here is fighting both horizons at once.', 'Todo alinea para largos. Ponerse corto aquí es pelear contra los dos horizontes a la vez.'),
                     dos('Buy pullbacks, not breakouts: the trend gives you cheaper entries if you wait.', 'Compra retrocesos, no rupturas: la tendencia te da entradas más baratas si esperas.')]);
  } else if (alcM && !alcC) {
    tituloC = elegir([dos('Pullback inside a larger uptrend', 'Retroceso dentro de una tendencia mayor alcista'), dos('Short term dips, the big trend still rises', 'El corto plazo cae, la de fondo sigue subiendo'), dos('Correction, not a reversal (so far)', 'Corrección, no giro (por ahora)')]);
    hacerC = elegir([dos('Treat this as a discount inside the trend unless the major line breaks with a close. Look for the floor, not the exit.', 'Trátalo como descuento dentro de la tendencia mientras la línea mayor no se pierda con un cierre. Busca el suelo, no la salida.'),
                     dos('Do not short a dip inside an uptrend. Wait for the short-term structure to turn up again and buy that.', 'No vendas en corto una caída dentro de una tendencia alcista. Espera a que la estructura corta vuelva a girar arriba y compra eso.')]);
  } else if (bajM && bajC) {
    tituloC = elegir([dos('Downtrend on both horizons', 'Bajista en los dos horizontes'), dos('Trend and bounces agree: down', 'Fondo y corto plazo coinciden: abajo'), dos('Falling structure, long and short term', 'Estructura a la baja en largo y corto plazo')]);
    hacerC = elegir([dos('Everything lines up for shorts. Catching the bottom here means fighting both horizons.', 'Todo alinea para cortos. Buscar el suelo aquí es pelear contra los dos horizontes.'),
                     dos('Sell bounces into resistance, not breakdowns: the trend gives you better prices if you wait.', 'Vende rebotes contra resistencia, no rupturas: la tendencia te da mejores precios si esperas.')]);
  } else if (bajM && !bajC) {
    tituloC = elegir([dos('Bounce inside a larger downtrend', 'Rebote dentro de una tendencia mayor bajista'), dos('Short term rises, the big trend still falls', 'El corto plazo sube, la de fondo sigue cayendo'), dos('Relief rally, not a reversal (so far)', 'Rebote de alivio, no giro (por ahora)')]);
    hacerC = elegir([dos('Bounces inside a downtrend are selling opportunities until the major line is reclaimed with a close.', 'Los rebotes dentro de una tendencia bajista son oportunidades de venta hasta que la línea mayor se recupere con un cierre.'),
                     dos('Do not chase this bounce long. If you buy, it is a quick trade against the trend, with a tight stop.', 'No persigas este rebote en largo. Si compras, es un trade rápido contra tendencia, con stop ajustado.')]);
  } else {
    tituloC = elegir([dos('No dominant trend', 'Sin tendencia dominante'), dos('The big picture is undecided', 'El fondo está indeciso'), dos('No clean major structure', 'Sin estructura mayor clara')]);
    hacerC = elegir([dos(`Without a major trend, only trade the levels: buy support, sell resistance, and keep targets short.`, `Sin tendencia mayor, opera solo los niveles: compra soporte, vende resistencia, y objetivos cortos.`),
                     dos(`No trend to lean on. Here the edge is in the extremes, not in the middle of the range.`, `No hay tendencia donde apoyarse. Aquí la ventaja está en los extremos, no en medio del rango.`)]);
  }
  const fraseMayor = mayor
    ? elegir([dos(`Over the last ${durM.en} price moved ${pc(mayor.movPct)} along a ${alcM ? 'rising' : 'falling'} line that touches ${mayor.pts.length} ${alcM ? 'lows' : 'highs'}.`,
                  `En las últimas ${durM.es} el precio se movió ${pc(mayor.movPct)} sobre una línea ${alcM ? 'ascendente' : 'descendente'} que toca ${mayor.pts.length} ${alcM ? 'mínimos' : 'máximos'}.`),
              dos(`The major line connects ${mayor.pts.length} ${alcM ? 'lows' : 'highs'} and has carried price ${pc(mayor.movPct)} over ${durM.en}.`,
                  `La línea mayor une ${mayor.pts.length} ${alcM ? 'mínimos' : 'máximos'} y ha llevado el precio ${pc(mayor.movPct)} en ${durM.es}.`)])
    : elegir([dos('No major trend line fits the last weeks of pivots.', 'Ninguna línea mayor ajusta los pivotes de las últimas semanas.'),
              dos('The longer structure has no clean direction.', 'La estructura larga no tiene dirección limpia.')]);
  const fraseCorta = elegir([
    dos(`Short term on the ${tf}: the last swings make ${alcC ? 'higher highs and higher lows' : bajC ? 'lower highs and lower lows' : 'mixed highs and lows'}; net move over the last 60 candles ${pc(corta.mov)}.`,
        `Corto plazo en ${tf}: los últimos giros hacen ${alcC ? 'máximos y mínimos crecientes' : bajC ? 'máximos y mínimos decrecientes' : 'máximos y mínimos mezclados'}; movimiento neto en las últimas 60 velas ${pc(corta.mov)}.`),
    dos(`On the ${tf} the swing structure is ${alcC ? 'rising' : bajC ? 'falling' : 'flat'} (net ${pc(corta.mov)} over 60 candles).`,
        `En ${tf} la estructura de giros es ${alcC ? 'ascendente' : bajC ? 'descendente' : 'plana'} (neto ${pc(corta.mov)} en 60 velas).`)
  ]);
  const frase24 = elegir([
    dos(`Last 24h: ${pc(chg24, 2)}, now at ${Math.round(pos24)}% of the day's range (${fmt(l24)}–${fmt(h24)}). Typical candle: ${atrPct.toFixed(2)}%.`,
        `Últimas 24h: ${pc(chg24, 2)}, ahora en el ${Math.round(pos24)}% del rango del día (${fmt(l24)}–${fmt(h24)}). Vela típica: ${atrPct.toFixed(2)}%.`),
    dos(`24h change ${pc(chg24, 2)}; price sits ${pos24 > 66 ? 'near the day high' : pos24 < 34 ? 'near the day low' : 'mid-range'} (${fmt(l24)}–${fmt(h24)}). Volatility ${atrPct.toFixed(2)}% per candle.`,
        `Cambio 24h ${pc(chg24, 2)}; el precio está ${pos24 > 66 ? 'cerca del máximo del día' : pos24 < 34 ? 'cerca del mínimo del día' : 'a media banda'} (${fmt(l24)}–${fmt(h24)}). Volatilidad ${atrPct.toFixed(2)}% por vela.`)
  ]);
  /* Último swing: qué acaba de hacer el precio (ruptura de mínimo/máximo, rebote…) */
  const L2 = zz.bajos.slice(-2), H2 = zz.altos.slice(-2);
  let fraseSwing = dos('', '');
  const recienteL = L2.length === 2 && (v.length - 1 - L2[1].i) <= 40;
  const recienteH = H2.length === 2 && (v.length - 1 - H2[1].i) <= 40;
  if (recienteL && L2[1].p < L2[0].p && (!recienteH || L2[1].i > H2[1].i || H2[1].p < H2[0].p)) {
    const hPrev = zz.altos.filter((h) => h.i < L2[1].i).slice(-1)[0];
    const topeAntes = hPrev ? hPrev.p : L2[0].p;   // último máximo swing antes del nuevo mínimo: de ahí arranca la pierna
    const caida = ((L2[1].p - topeAntes) / topeAntes) * 100;
    const reb = ((precio - L2[1].p) / L2[1].p) * 100;
    fraseSwing = dos(` Latest move: price broke the previous low (${fmt(L2[0].p)}) and printed a new low at ${fmt(L2[1].p)} (${pc(caida)} leg); it has since bounced ${pc(reb)} — a retest, not a reversal, until ${fmt(L2[0].p)} is reclaimed with a close.`,
                     ` Último movimiento: el precio rompió el mínimo previo (${fmt(L2[0].p)}) y marcó un nuevo mínimo en ${fmt(L2[1].p)} (pierna de ${pc(caida)}); desde ahí rebota ${pc(reb)} — un retesteo, no un giro, mientras no recupere ${fmt(L2[0].p)} con un cierre.`);
  } else if (recienteH && H2[1].p > H2[0].p && (!recienteL || H2[1].i > L2[1].i || L2[1].p > L2[0].p)) {
    const lPrev = zz.bajos.filter((l) => l.i < H2[1].i).slice(-1)[0];
    const sueloAntes = lPrev ? lPrev.p : H2[0].p;
    const subida = ((H2[1].p - sueloAntes) / sueloAntes) * 100;
    const ret = ((precio - H2[1].p) / H2[1].p) * 100;
    fraseSwing = dos(` Latest move: price broke the previous high (${fmt(H2[0].p)}) and printed a new high at ${fmt(H2[1].p)} (${pc(subida)} leg); it has since pulled back ${pc(ret)} — a retest, not a reversal, until ${fmt(H2[0].p)} is lost with a close.`,
                     ` Último movimiento: el precio rompió el máximo previo (${fmt(H2[0].p)}) y marcó un nuevo máximo en ${fmt(H2[1].p)} (pierna de ${pc(subida)}); desde ahí retrocede ${pc(ret)} — un retesteo, no un giro, mientras no pierda ${fmt(H2[0].p)} con un cierre.`);
  }

  const contexto = {
    tipo: 'tendencia', p: precio, prioridad: 5,
    iAncla: mayor ? mayor.pts[Math.floor(mayor.pts.length / 2)].i : (N.linea ? N.linea.pts[0].i : null),
    titulo: tituloC,
    txt: dos(`${fraseMayor.en} ${fraseCorta.en}${fraseSwing.en} ${frase24.en}`, `${fraseMayor.es} ${fraseCorta.es}${fraseSwing.es} ${frase24.es}`),
    hacer: hacerC,
    detalle: [
      dos(`Major trend: ${mayor ? (alcM ? 'bullish' : 'bearish') + ' · ' + pc(mayor.movPct) + ' over ' + durM.en : 'none'}`, `Tendencia mayor: ${mayor ? (alcM ? 'alcista' : 'bajista') + ' · ' + pc(mayor.movPct) + ' en ' + durM.es : 'ninguna'}`),
      dos(`Short-term trend (${tf}): ${alcC ? 'bullish' : bajC ? 'bearish' : 'sideways'} · ${pc(corta.mov)}`, `Tendencia corta (${tf}): ${alcC ? 'alcista' : bajC ? 'bajista' : 'lateral'} · ${pc(corta.mov)}`),
      dos(`24h: ${pc(chg24, 2)} · high ${fmt(h24)} · low ${fmt(l24)}`, `24h: ${pc(chg24, 2)} · máximo ${fmt(h24)} · mínimo ${fmt(l24)}`),
      dos(`Average true range: ${fmt(N.atr)} (${atrPct.toFixed(2)}%)`, `Rango medio real: ${fmt(N.atr)} (${atrPct.toFixed(2)}%)`),
      dos('Drawn by connecting real swing extremes, not on indicators', 'Trazada uniendo extremos reales de los giros, no sobre indicadores')
    ]
  };

  /* ══════════════════ 3. NIVELES ══════════════════ */
  const dS = sCerca ? Math.abs(sCerca.dist) : null, dR = rCerca ? Math.abs(rCerca.dist) : null;
  let tituloN, txtN, hacerN;
  if (sCerca && rCerca) {
    tituloN = elegir([dos(`Boxed between ${fmt(sCerca.p)} and ${fmt(rCerca.p)}`, `Encajonado entre ${fmt(sCerca.p)} y ${fmt(rCerca.p)}`), dos('The two levels that matter now', 'Los dos niveles que importan ahora'), dos(`Support ${apc(dS)} below, resistance ${apc(dR)} above`, `Soporte a ${apc(dS)} abajo, resistencia a ${apc(dR)} arriba`)]);
    txtN = elegir([
      dos(`Support at ${fmt(sCerca.p)} held ${sCerca.toques} times (strength ${sCerca.fuerza}/100), ${apc(dS, 2)} below. Resistance at ${fmt(rCerca.p)} rejected price ${rCerca.toques} times (strength ${rCerca.fuerza}/100), ${apc(dR, 2)} above. Room to the upside ${(dR / Math.max(0.01, dS)).toFixed(1)}x the room to the downside.`,
          `Soporte en ${fmt(sCerca.p)} aguantó ${sCerca.toques} veces (fuerza ${sCerca.fuerza}/100), a ${apc(dS, 2)} abajo. Resistencia en ${fmt(rCerca.p)} rechazó el precio ${rCerca.toques} veces (fuerza ${rCerca.fuerza}/100), a ${apc(dR, 2)} arriba. Recorrido arriba ${(dR / Math.max(0.01, dS)).toFixed(1)}x el recorrido abajo.`),
      dos(`Nearest floor: ${fmt(sCerca.p)} (${sCerca.toques} touches, ${apc(dS, 2)} away). Nearest ceiling: ${fmt(rCerca.p)} (${rCerca.toques} rejections, ${apc(dR, 2)} away). Between them there is no reliable reference.`,
          `Suelo más cercano: ${fmt(sCerca.p)} (${sCerca.toques} toques, a ${apc(dS, 2)}). Techo más cercano: ${fmt(rCerca.p)} (${rCerca.toques} rechazos, a ${apc(dR, 2)}). Entre ambos no hay referencia fiable.`)
    ]);
    hacerN = elegir([
      dos(`A close below ${fmt(sCerca.p)} opens the way down; a close above ${fmt(rCerca.p)} opens the way up. Inside, buy near the floor and sell near the ceiling, nothing in the middle.`,
          `Un cierre bajo ${fmt(sCerca.p)} abre el camino abajo; un cierre sobre ${fmt(rCerca.p)} abre el camino arriba. Dentro, compra cerca del suelo y vende cerca del techo, nada en el medio.`),
      dos(`Put alerts on both: ${fmt(sCerca.p)} and ${fmt(rCerca.p)}. The next real decision happens at one of them, not here.`,
          `Pon alertas en los dos: ${fmt(sCerca.p)} y ${fmt(rCerca.p)}. La próxima decisión real ocurre en uno de ellos, no aquí.`)
    ]);
  } else if (sCerca) {
    tituloN = elegir([dos(`Support at ${fmt(sCerca.p)}, no ceiling above`, `Soporte en ${fmt(sCerca.p)}, sin techo arriba`), dos('Only a floor is defined', 'Solo hay suelo definido')]);
    txtN = dos(`The only tested level nearby is support at ${fmt(sCerca.p)} (${sCerca.toques} touches, strength ${sCerca.fuerza}/100), ${apc(dS, 2)} below. Above, the reference is the 24h high at ${fmt(h24)}.`,
               `El único nivel probado cerca es el soporte en ${fmt(sCerca.p)} (${sCerca.toques} toques, fuerza ${sCerca.fuerza}/100), a ${apc(dS, 2)} abajo. Arriba, la referencia es el máximo de 24h en ${fmt(h24)}.`);
    hacerN = dos(`Keep ${fmt(sCerca.p)} as the line in the sand: while it holds, dips are buyable; a close below it and the structure is gone.`,
                 `Toma ${fmt(sCerca.p)} como línea roja: mientras aguante, las caídas son comprables; un cierre debajo y la estructura se fue.`);
  } else if (rCerca) {
    tituloN = elegir([dos(`Resistance at ${fmt(rCerca.p)}, no floor below`, `Resistencia en ${fmt(rCerca.p)}, sin suelo abajo`), dos('Only a ceiling is defined', 'Solo hay techo definido')]);
    txtN = dos(`The only tested level nearby is resistance at ${fmt(rCerca.p)} (${rCerca.toques} rejections, strength ${rCerca.fuerza}/100), ${apc(dR, 2)} above. Below, the reference is the 24h low at ${fmt(l24)}.`,
               `El único nivel probado cerca es la resistencia en ${fmt(rCerca.p)} (${rCerca.toques} rechazos, fuerza ${rCerca.fuerza}/100), a ${apc(dR, 2)} arriba. Abajo, la referencia es el mínimo de 24h en ${fmt(l24)}.`);
    hacerN = dos(`Keep ${fmt(rCerca.p)} as the line in the sand: while it holds, bounces are sellable; a close above it and the bears lose control.`,
                 `Toma ${fmt(rCerca.p)} como línea roja: mientras aguante, los rebotes son vendibles; un cierre encima y los bajistas pierden el control.`);
  } else {
    tituloN = elegir([dos('No tested levels nearby', 'Sin niveles probados cerca'), dos('Price in open territory', 'Precio en terreno abierto')]);
    txtN = dos(`No support or resistance with real touches within 12% on the ${tf}. The only references are the 24h extremes: ${fmt(l24)} and ${fmt(h24)}.`,
               `No hay soporte ni resistencia con toques reales a menos de 12% en ${tf}. Las únicas referencias son los extremos de 24h: ${fmt(l24)} y ${fmt(h24)}.`);
    hacerN = dos('Without tested levels there is nowhere to put a logical stop. Use the 24h extremes or move up a timeframe.',
                 'Sin niveles probados no hay dónde poner un stop con lógica. Usa los extremos de 24h o sube de temporalidad.');
  }
  const niveles = {
    tipo: 'vigilar', p: sCerca ? sCerca.p : (rCerca ? rCerca.p : precio), prioridad: 4, nivel: sCerca || rCerca || null,
    titulo: tituloN, txt: txtN, hacer: hacerN,
    detalle: [
      ...(sCerca ? [dos(`Support ${fmt(sCerca.p)} · ${sCerca.toques} touches · strength ${sCerca.fuerza}/100 · volume share ${sCerca.volPct.toFixed(1)}%`, `Soporte ${fmt(sCerca.p)} · ${sCerca.toques} toques · fuerza ${sCerca.fuerza}/100 · volumen ${sCerca.volPct.toFixed(1)}%`)] : []),
      ...(rCerca ? [dos(`Resistance ${fmt(rCerca.p)} · ${rCerca.toques} rejections · strength ${rCerca.fuerza}/100 · volume share ${rCerca.volPct.toFixed(1)}%`, `Resistencia ${fmt(rCerca.p)} · ${rCerca.toques} rechazos · fuerza ${rCerca.fuerza}/100 · volumen ${rCerca.volPct.toFixed(1)}%`)] : []),
      dos(`24h high ${fmt(h24)} · 24h low ${fmt(l24)}`, `Máximo 24h ${fmt(h24)} · mínimo 24h ${fmt(l24)}`),
      dos(`Levels found with real touches: ${N.niveles.length}`, `Niveles encontrados con toques reales: ${N.niveles.length}`),
      dos('A level counts only with ≥3 touches, or 2 touches with volume behind', 'Un nivel cuenta solo con ≥3 toques, o 2 toques con volumen detrás')
    ]
  };

  /* ══════════════════ 1. SETUP ══════════════════ */
  const sesgo = dirM || (alcC ? 'alcista' : bajC ? 'bajista' : null);   // la mayor manda; si no hay, la corta

  /* [T4·motor] Zonas institucionales (order block) y barridos SOLO a favor
     del sesgo. Con tendencia bajista clara, pintar una "DEMAND" verde debajo
     es una incongruencia que confunde: el Faro refuerza el análisis, no lo
     contradice. BOS/CHoCH se mantienen: son avisos de estructura. */
  if (sesgo) {
    N.estructuras = (N.estructuras || []).filter((e) =>
      (e.tipo !== 'ob' && e.tipo !== 'barrido') || e.dir === sesgo);
  }
  const imp = N.impulso;
  const candidatos = [];

  /* a) Retesteo de impulso A FAVOR del sesgo */
  if (imp && !imp.invalidado && (imp.enZona || imp.acercandose) && sesgo === imp.dir) {
    const largo = imp.dir === 'alcista';
    const entrada = imp.zonaMedia;
    const base = largo ? imp.zonaBaja * 0.994 : imp.zonaAlta * 1.006;
    /* Objetivo estructural: el extremo del impulso, o el nivel/24h antes si está más cerca */
    let objetivo = imp.precioFin;
    if (largo && rCerca && rCerca.p < objetivo && rCerca.p > entrada) objetivo = rCerca.p;
    if (!largo && sCerca && sCerca.p > objetivo && sCerca.p < entrada) objetivo = sCerca.p;
    const plan = construirPlan(largo ? 'compra' : 'venta', entrada, base, N.atr, objetivo);
    if (plan) candidatos.push({ clave: 'impulso', largo, plan, imp, puntos: 30 + (imp.enZona ? 10 : 0) + Math.min(20, plan.rr * 5) });
  }
  /* b) Nivel con el sesgo a favor */
  if (sesgo === 'alcista' && sCerca && dS < 2.5 && (rCerca || h24 > precio)) {
    const objetivo = rCerca ? rCerca.p : h24;
    const plan = construirPlan('compra', sCerca.p, sCerca.p * 0.994, N.atr, objetivo);
    if (plan) candidatos.push({ clave: 'nivel', largo: true, plan, nivel: sCerca, puntos: 25 + sCerca.toques * 3 + Math.min(20, plan.rr * 5) });
  }
  if (sesgo === 'bajista' && rCerca && dR < 2.5 && (sCerca || l24 < precio)) {
    const objetivo = sCerca ? sCerca.p : l24;
    const plan = construirPlan('venta', rCerca.p, rCerca.p * 1.006, N.atr, objetivo);
    if (plan) candidatos.push({ clave: 'nivel', largo: false, plan, nivel: rCerca, puntos: 25 + rCerca.toques * 3 + Math.min(20, plan.rr * 5) });
  }
  /* d) RETESTEO DEL NIVEL ROTO: rompió el mínimo (o máximo) previo con fuerza y
     vuelve a él por el otro lado. Es el escenario de continuación más limpio. */
  if (L2.length === 2 && L2[1].p < L2[0].p && sesgo === 'bajista') {
    const roto = L2[0].p, distR = ((roto - precio) / precio) * 100;         // cuánto falta para volver al nivel roto (desde abajo)
    if (distR > -0.8 && distR < 3.5) {
      const objetivo = Math.min(L2[1].p, sCerca && sCerca.p < precio ? sCerca.p : L2[1].p);
      const plan = construirPlan('venta', roto, roto * 1.006, N.atr, objetivo);
      if (plan) candidatos.push({ clave: 'retesteo', largo: false, plan, roto, nuevo: L2[1].p, puntos: 35 + Math.min(20, plan.rr * 5) });
    }
  }
  if (H2.length === 2 && H2[1].p > H2[0].p && sesgo === 'alcista') {
    const roto = H2[0].p, distR = ((precio - roto) / precio) * 100;
    if (distR > -0.8 && distR < 3.5) {
      const objetivo = Math.max(H2[1].p, rCerca && rCerca.p > precio ? rCerca.p : H2[1].p);
      const plan = construirPlan('compra', roto, roto * 0.994, N.atr, objetivo);
      if (plan) candidatos.push({ clave: 'retesteo', largo: true, plan, roto, nuevo: H2[1].p, puntos: 35 + Math.min(20, plan.rr * 5) });
    }
  }
  /* c) Doble suelo/techo confirmado */
  (N.dobles || []).filter((d) => d.confirmado).forEach((d) => {
    const largo = d.tipo === 'dobleSuelo';
    const plan = construirPlan(largo ? 'compra' : 'venta', precio, largo ? d.nivel * 0.994 : d.nivel * 1.006, N.atr, d.objetivo);
    if (plan) candidatos.push({ clave: 'doble', largo, plan, doble: d, puntos: 28 + Math.min(20, plan.rr * 5) });
  });

  const validos = candidatos.filter((c) => c.plan.rr >= 1.5).sort((a, b) => b.puntos - a.puntos);
  const mejor = validos[0] || null;
  const estrRec = (N.estructuras || []).filter((e) => e.tipo === 'bos' || e.tipo === 'choch').sort((a, b) => b.iRot - a.iRot)[0] || null;

  let setup;
  if (mejor) {
    const { largo, plan } = mejor;
    const lado = largo ? 'compra' : 'venta';
    const rr = plan.rr.toFixed(1);
    const conMayor = dirM ? dos(`with the major trend`, `a favor de la tendencia mayor`) : dos(`with the short-term trend`, `a favor de la tendencia corta`);
    let titulo, txt, hacer, p, marca, iAncla;
    if (mejor.clave === 'impulso') {
      const i = mejor.imp;
      p = i.zonaMedia; iAncla = i.iniIdx;
      titulo = elegir([dos(largo ? 'Buy the retest of the impulse origin' : 'Sell the retest of the impulse origin', largo ? 'Comprar el retesteo del origen del impulso' : 'Vender el retesteo del origen del impulso'),
                       dos(`${largo ? 'Long' : 'Short'} setup, ${rr}:1`, `Setup ${largo ? 'largo' : 'corto'}, ${rr}:1`),
                       dos(largo ? 'Demand zone being retested' : 'Supply zone being retested', largo ? 'Zona de demanda en retesteo' : 'Zona de oferta en retesteo')]);
      txt = elegir([
        dos(`A ${largo ? 'bullish' : 'bearish'} impulse of ${i.pct.toFixed(1)}% in ${i.velas} candles started at ${fmt(i.zonaBaja)}–${fmt(i.zonaAlta)}. Price has come back ${Math.round(i.retroceso)}% of that move and is ${i.enZona ? 'inside' : apc(i.distZona) + ' from'} the origin, ${conMayor.en}. Target ${fmt(plan.objetivo)}, stop ${fmt(plan.stop)}: ${rr} to 1.`,
            `Un impulso ${largo ? 'alcista' : 'bajista'} del ${i.pct.toFixed(1)}% en ${i.velas} velas arrancó en ${fmt(i.zonaBaja)}–${fmt(i.zonaAlta)}. El precio ha devuelto el ${Math.round(i.retroceso)}% de ese movimiento y está ${i.enZona ? 'dentro de' : 'a ' + apc(i.distZona) + ' de'} el origen, ${conMayor.es}. Objetivo ${fmt(plan.objetivo)}, stop ${fmt(plan.stop)}: ${rr} a 1.`),
        dos(`The money that pushed price ${i.pct.toFixed(1)}% ${largo ? 'up' : 'down'} entered at ${fmt(i.zonaBaja)}–${fmt(i.zonaAlta)}; price is ${i.enZona ? 'back in that zone' : 'approaching it (' + apc(i.distZona) + ' away)'} after giving back ${Math.round(i.retroceso)}% of the move. Reward ${fmt(plan.objetivo)} vs risk ${fmt(plan.stop)} = ${rr}:1, ${conMayor.en}.`,
            `El dinero que empujó el precio ${i.pct.toFixed(1)}% ${largo ? 'arriba' : 'abajo'} entró en ${fmt(i.zonaBaja)}–${fmt(i.zonaAlta)}; el precio ${i.enZona ? 'volvió a esa zona' : 'se acerca (a ' + apc(i.distZona) + ')'} tras devolver el ${Math.round(i.retroceso)}% del movimiento. Beneficio ${fmt(plan.objetivo)} vs riesgo ${fmt(plan.stop)} = ${rr}:1, ${conMayor.es}.`)
      ]);
      hacer = i.enZona
        ? elegir([dos(`${largo ? 'Buy' : 'Sell'} here with the stop at ${fmt(plan.stop)}. Take part at ${fmt(plan.obj[0].p)}, the rest toward ${fmt(plan.objetivo)}. If a candle closes ${largo ? 'below' : 'above'} ${fmt(plan.stop)}, the idea is dead.`, `${largo ? 'Compra' : 'Vende'} aquí con stop en ${fmt(plan.stop)}. Toma parte en ${fmt(plan.obj[0].p)}, el resto hacia ${fmt(plan.objetivo)}. Si una vela cierra ${largo ? 'debajo de' : 'encima de'} ${fmt(plan.stop)}, la idea murió.`),
                  dos(`Entry is now, not later: the zone is being tested. Stop ${fmt(plan.stop)}, first target ${fmt(plan.obj[0].p)}, main target ${fmt(plan.objetivo)}.`, `La entrada es ahora, no después: la zona se está probando. Stop ${fmt(plan.stop)}, primer objetivo ${fmt(plan.obj[0].p)}, objetivo principal ${fmt(plan.objetivo)}.`)])
        : elegir([dos(`Not yet: set an alert at ${fmt(p)}. Enter only when price tags the zone and holds it; entering ${apc(i.distZona)} early turns a ${rr}:1 trade into a coin flip.`, `Todavía no: pon una alerta en ${fmt(p)}. Entra solo cuando el precio toque la zona y la aguante; entrar ${apc(i.distZona)} antes convierte un ${rr}:1 en cara o cruz.`),
                  dos(`Prepare the order at ${fmt(p)} with stop ${fmt(plan.stop)} and let price come to you.`, `Prepara la orden en ${fmt(p)} con stop ${fmt(plan.stop)} y deja que el precio venga a ti.`)]);
    } else if (mejor.clave === 'retesteo') {
      p = mejor.roto; marca = null;
      titulo = elegir([dos(largo ? `Breakout retest: buy ${fmt(mejor.roto)}` : `Breakdown retest: sell ${fmt(mejor.roto)}`, largo ? `Retesteo de ruptura: comprar ${fmt(mejor.roto)}` : `Retesteo de ruptura: vender ${fmt(mejor.roto)}`),
                       dos(largo ? 'Old resistance turned support' : 'Old support turned resistance', largo ? 'Resistencia que ahora es soporte' : 'Soporte que ahora es resistencia'),
                       dos(`Continuation ${largo ? 'long' : 'short'}, ${rr}:1`, `Continuación ${largo ? 'larga' : 'corta'}, ${rr}:1`)]);
      txt = elegir([
        dos(`Price broke the previous ${largo ? 'high' : 'low'} at ${fmt(mejor.roto)} and made a new ${largo ? 'high' : 'low'} at ${fmt(mejor.nuevo)}. Now it is coming back to ${fmt(mejor.roto)} from the ${largo ? 'top' : 'bottom'}: the broken level should act as ${largo ? 'support' : 'resistance'}, ${conMayor.en}. Stop ${fmt(plan.stop)}, target ${fmt(plan.objetivo)}: ${rr} to 1.`,
            `El precio rompió el ${largo ? 'máximo' : 'mínimo'} previo en ${fmt(mejor.roto)} e hizo un nuevo ${largo ? 'máximo' : 'mínimo'} en ${fmt(mejor.nuevo)}. Ahora vuelve a ${fmt(mejor.roto)} por ${largo ? 'arriba' : 'abajo'}: el nivel roto debe actuar como ${largo ? 'soporte' : 'resistencia'}, ${conMayor.es}. Stop ${fmt(plan.stop)}, objetivo ${fmt(plan.objetivo)}: ${rr} a 1.`),
        dos(`Classic continuation: ${largo ? 'breakout' : 'breakdown'} of ${fmt(mejor.roto)}, new ${largo ? 'high' : 'low'} at ${fmt(mejor.nuevo)}, and a pullback into the broken level. ${largo ? 'Buy' : 'Sell'} the retest with stop ${fmt(plan.stop)} and target ${fmt(plan.objetivo)} (${rr}:1).`,
            `Continuación de libro: ${largo ? 'ruptura' : 'rotura'} de ${fmt(mejor.roto)}, nuevo ${largo ? 'máximo' : 'mínimo'} en ${fmt(mejor.nuevo)}, y retroceso al nivel roto. ${largo ? 'Compra' : 'Vende'} el retesteo con stop ${fmt(plan.stop)} y objetivo ${fmt(plan.objetivo)} (${rr}:1).`)
      ]);
      hacer = elegir([dos(`Wait for price to reach ${fmt(mejor.roto)} and get rejected there (a ${largo ? 'bullish' : 'bearish'} close). Entry at the rejection, stop ${fmt(plan.stop)}. If price closes ${largo ? 'below' : 'above'} ${fmt(plan.stop)}, the ${largo ? 'breakout' : 'breakdown'} failed: stand aside.`,
                          `Espera a que el precio llegue a ${fmt(mejor.roto)} y sea rechazado ahí (un cierre ${largo ? 'alcista' : 'bajista'}). Entrada en el rechazo, stop ${fmt(plan.stop)}. Si cierra ${largo ? 'debajo de' : 'encima de'} ${fmt(plan.stop)}, la ruptura falló: fuera.`),
                      dos(`Do not ${largo ? 'buy' : 'sell'} here mid-air: the edge is at ${fmt(mejor.roto)}. Order there, stop ${fmt(plan.stop)}, first target ${fmt(plan.obj[0].p)}, main target ${fmt(plan.objetivo)}.`,
                          `No ${largo ? 'compres' : 'vendas'} aquí en el aire: la ventaja está en ${fmt(mejor.roto)}. Orden ahí, stop ${fmt(plan.stop)}, primer objetivo ${fmt(plan.obj[0].p)}, objetivo principal ${fmt(plan.objetivo)}.`)]);
    } else if (mejor.clave === 'nivel') {
      const n = mejor.nivel; p = n.p; marca = null;
      titulo = elegir([dos(largo ? `Buy zone at ${fmt(n.p)}` : `Sell zone at ${fmt(n.p)}`, largo ? `Zona de compra en ${fmt(n.p)}` : `Zona de venta en ${fmt(n.p)}`),
                       dos(largo ? 'Support + trend: a real long' : 'Resistance + trend: a real short', largo ? 'Soporte + tendencia: un largo real' : 'Resistencia + tendencia: un corto real'),
                       dos(`${largo ? 'Long' : 'Short'} at the level, ${rr}:1`, `${largo ? 'Largo' : 'Corto'} en el nivel, ${rr}:1`)]);
      txt = elegir([
        dos(`${largo ? 'Support' : 'Resistance'} at ${fmt(n.p)} held ${n.toques} times and sits ${conMayor.en}. Risk to ${fmt(plan.stop)} (${plan.riesgoPct.toFixed(2)}%), reward to ${fmt(plan.objetivo)}: ${rr} to 1. That is the confluence that pays.`,
            `${largo ? 'Soporte' : 'Resistencia'} en ${fmt(n.p)} aguantó ${n.toques} veces y está ${conMayor.es}. Riesgo hasta ${fmt(plan.stop)} (${plan.riesgoPct.toFixed(2)}%), beneficio hasta ${fmt(plan.objetivo)}: ${rr} a 1. Esa es la confluencia que paga.`),
        dos(`A level with ${n.toques} touches (${fmt(n.p)}) in the direction of the trend, ${apc(largo ? dS : dR, 2)} from price. Stop ${fmt(plan.stop)}, target ${fmt(plan.objetivo)}, ${rr}:1.`,
            `Un nivel con ${n.toques} toques (${fmt(n.p)}) en la dirección de la tendencia, a ${apc(largo ? dS : dR, 2)} del precio. Stop ${fmt(plan.stop)}, objetivo ${fmt(plan.objetivo)}, ${rr}:1.`)
      ]);
      hacer = elegir([dos(`Wait for price to touch ${fmt(n.p)} and print a ${largo ? 'bullish' : 'bearish'} candle there, then enter. Stop ${fmt(plan.stop)}, target ${fmt(plan.objetivo)}.`, `Espera a que el precio toque ${fmt(n.p)} y haga una vela ${largo ? 'alcista' : 'bajista'} ahí, entonces entra. Stop ${fmt(plan.stop)}, objetivo ${fmt(plan.objetivo)}.`),
                      dos(`Do not enter mid-way. The trade exists only at ${fmt(n.p)}; a close ${largo ? 'below' : 'above'} ${fmt(plan.stop)} cancels it.`, `No entres a medio camino. El trade existe solo en ${fmt(n.p)}; un cierre ${largo ? 'debajo de' : 'encima de'} ${fmt(plan.stop)} lo cancela.`)]);
    } else {
      const d = mejor.doble; p = d.cuello; iAncla = d.p2.i;
      titulo = dos(largo ? 'Confirmed double bottom' : 'Confirmed double top', largo ? 'Doble suelo confirmado' : 'Doble techo confirmado');
      txt = dos(`Two ${largo ? 'lows' : 'highs'} at ${fmt(d.nivel)} and a close through the neckline at ${fmt(d.cuello)}. Measured target ${fmt(d.objetivo)}, stop ${fmt(plan.stop)}: ${rr} to 1.`,
                `Dos ${largo ? 'mínimos' : 'máximos'} en ${fmt(d.nivel)} y un cierre a través del cuello en ${fmt(d.cuello)}. Objetivo medido ${fmt(d.objetivo)}, stop ${fmt(plan.stop)}: ${rr} a 1.`);
      hacer = dos(`Enter on the retest of ${fmt(d.cuello)}, stop ${fmt(plan.stop)}, target ${fmt(d.objetivo)}.`, `Entra en el retesteo de ${fmt(d.cuello)}, stop ${fmt(plan.stop)}, objetivo ${fmt(d.objetivo)}.`);
    }
    setup = {
      tipo: lado, p, prioridad: 10, esPlan: true, plan, iAncla, marca,
      titulo, txt, hacer,
      detalle: [
        dos(`Entry ${fmt(plan.entrada)} · stop ${fmt(plan.stop)} (${plan.riesgoPct.toFixed(2)}%)`, `Entrada ${fmt(plan.entrada)} · stop ${fmt(plan.stop)} (${plan.riesgoPct.toFixed(2)}%)`),
        dos(`Structural target ${fmt(plan.objetivo)} · reward/risk ${rr}:1`, `Objetivo estructural ${fmt(plan.objetivo)} · beneficio/riesgo ${rr}:1`),
        dos(`Targets by R: ${fmt(plan.obj[0].p)} (1R) · ${fmt(plan.obj[1].p)} (2R) · ${fmt(plan.obj[2].p)} (3R)`, `Objetivos por R: ${fmt(plan.obj[0].p)} (1R) · ${fmt(plan.obj[1].p)} (2R) · ${fmt(plan.obj[2].p)} (3R)`),
        dos(`Bias from: ${dirM ? 'major trend line' : 'short-term structure'}`, `Sesgo desde: ${dirM ? 'línea de tendencia mayor' : 'estructura de corto plazo'}`),
        dos('Only setups with reward/risk ≥ 1.5 are proposed; the rest are discarded', 'Solo se proponen setups con beneficio/riesgo ≥ 1,5; el resto se descartan')
      ]
    };
  } else {
    /* NO HAY VENTAJA: decir por qué y qué la crearía, con precios. */
    const descartados = candidatos.length;
    const gatilloL = sCerca ? dos(`a pullback to ${fmt(sCerca.p)} that holds`, `un retroceso a ${fmt(sCerca.p)} que aguante`) : dos(`a tested floor (none within 12% now)`, `un suelo probado (no hay a menos de 12%)`);
    const gatilloS = rCerca ? dos(`a rejection at ${fmt(rCerca.p)}`, `un rechazo en ${fmt(rCerca.p)}`) : dos(`a tested ceiling (none within 12% now)`, `un techo probado (no hay a menos de 12%)`);
    const motivo = descartados
      ? dos(`${descartados} candidate${descartados > 1 ? 's' : ''} found but none reaches 1.5:1 reward/risk, so none is worth the risk.`, `${descartados} candidato${descartados > 1 ? 's' : ''} encontrado${descartados > 1 ? 's' : ''} pero ninguno llega a 1,5:1 de beneficio/riesgo, así que ninguno vale el riesgo.`)
      : (sesgo ? dos(`Price is ${sCerca || rCerca ? 'between levels' : 'away from any tested level'}: the trend is ${sesgo === 'alcista' ? 'up' : 'down'} but there is no cheap place to join it right now.`, `El precio está ${sCerca || rCerca ? 'entre niveles' : 'lejos de cualquier nivel probado'}: la tendencia es ${sesgo === 'alcista' ? 'alcista' : 'bajista'} pero no hay un sitio barato para sumarse ahora.`)
               : dos(`No trend on either horizon and no level being tested: there is nothing to lean on.`, `Sin tendencia en ningún horizonte y sin nivel en prueba: no hay dónde apoyarse.`));
    const estrTxt = estrRec
      ? dos(` Latest structure event: ${estrRec.tipo === 'bos' ? 'break of structure' : 'change of character'} ${estrRec.dir === 'alcista' ? 'up' : 'down'} at ${fmt(estrRec.nivel)}.`, ` Último evento de estructura: ${estrRec.tipo === 'bos' ? 'ruptura de estructura' : 'cambio de carácter'} ${estrRec.dir === 'alcista' ? 'al alza' : 'a la baja'} en ${fmt(estrRec.nivel)}.`)
      : dos('', '');
    setup = {
      tipo: 'aviso', p: sCerca ? sCerca.p : (rCerca ? rCerca.p : precio), prioridad: 10, esPlan: true, marca: estrRec || null,
      titulo: elegir([dos('No edge right now', 'Sin ventaja ahora mismo'), dos('Nothing worth the risk here', 'Nada que valga el riesgo aquí'), dos('Wait: the trade is not here yet', 'Espera: el trade todavía no está')]),
      txt: dos(`${motivo.en}${estrTxt.en}`, `${motivo.es}${estrTxt.es}`),
      hacer: elegir([
        dos(`What would create an edge: for a long, ${gatilloL.en}; for a short, ${gatilloS.en}. Until one of those happens, do nothing: sitting out is a position too.`,
            `Qué crearía una ventaja: para un largo, ${gatilloL.es}; para un corto, ${gatilloS.es}. Hasta que pase una de esas dos cosas, no hagas nada: quedarse fuera también es una posición.`),
        dos(`Set alerts, not orders: ${sCerca ? fmt(sCerca.p) : fmt(l24)} below and ${rCerca ? fmt(rCerca.p) : fmt(h24)} above. The decision happens there.`,
            `Pon alertas, no órdenes: ${sCerca ? fmt(sCerca.p) : fmt(l24)} abajo y ${rCerca ? fmt(rCerca.p) : fmt(h24)} arriba. La decisión ocurre ahí.`)
      ]),
      detalle: [
        dos(`Candidates evaluated: ${candidatos.length} · with reward/risk ≥ 1.5: 0`, `Candidatos evaluados: ${candidatos.length} · con beneficio/riesgo ≥ 1,5: 0`),
        ...candidatos.map((c) => dos(`${c.clave} ${c.largo ? 'long' : 'short'}: ${c.plan.rr.toFixed(1)}:1 (target ${fmt(c.plan.objetivo)}, stop ${fmt(c.plan.stop)})`, `${c.clave} ${c.largo ? 'largo' : 'corto'}: ${c.plan.rr.toFixed(1)}:1 (objetivo ${fmt(c.plan.objetivo)}, stop ${fmt(c.plan.stop)})`)),
        dos(`Bias: ${sesgo ? (sesgo === 'alcista' ? 'bullish' : 'bearish') : 'none'} (${dirM ? 'major trend' : 'short-term structure'})`, `Sesgo: ${sesgo ? (sesgo === 'alcista' ? 'alcista' : 'bajista') : 'ninguno'} (${dirM ? 'tendencia mayor' : 'estructura corta'})`),
        dos('A setup is proposed only when a real level or zone gives ≥ 1.5:1', 'Solo se propone un setup cuando un nivel o zona real da ≥ 1,5:1')
      ]
    };
  }

  N.plan = {
    lado: mejor ? (mejor.largo ? 'compra' : 'venta') : 'esperar',
    conf: mejor ? Math.min(95, Math.round(50 + mejor.plan.rr * 12)) : 0,
    disputado: false
  };
  N.mensajes = [setup, contexto, niveles];
}
