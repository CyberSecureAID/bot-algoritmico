/* niveles/asistente.js — Genera la lectura del asistente: toma las velas,
   corre el motor y traduce los datos a mensajes y a un plan operativo.
   No dibuja nada; solo escribe en N. La LÓGICA (motor, condiciones,
   prioridades, votación) es intacta: solo cambió el idioma de los textos
   a inglés y se quitaron estadísticas inventadas. */

import { N } from './estado.js?v=1';
import { elegir, fmt } from './util.js?v=1';
import { pivotes, tendencia, detectarRango, calcularNiveles, detectarImpulso, detectarEstructuras, calcularTendencia, detectarDobles, marea, calcularATR, construirPlan } from './motor.js?v=1';

const nombreTend = (d) => ({ alcista: 'bullish', bajista: 'bearish', lateral: 'sideways', indefinida: 'undefined' }[d] || d);
const dirEn = (d) => (d === 'alcista' ? 'bullish' : d === 'bajista' ? 'bearish' : 'sideways');

export function analizar(par) {
  const v = N.velas;
  if (v.length < 40) { N.mensajes = []; return; }

  const piv = pivotes(v);
  N.tendencia = tendencia(v, piv);
  N.rango = detectarRango(v);
  N.impulso = detectarImpulso(v);
  N.estructuras = detectarEstructuras(v, piv);
  N.linea = calcularTendencia(v, piv, N.tendencia);
  N.dobles = detectarDobles(v, piv, N.precio);
  N.atr = calcularATR(v);
  N.marea = marea(v, N.atr);
  N.precio = v[v.length - 1].c;
  N.niveles = calcularNiveles(v, piv, N.precio);

  /* Si el mercado está en rango, el asistente dice "no entres", así que
     dibujar seis niveles de compra sería contradictorio. En rango solo se
     marcan los bordes de la banda, que es lo único operable ahí. */
  if (N.rango) {
    N.niveles = N.niveles.filter((x) =>
      Math.abs(x.p - N.rango.alto) / N.precio < 0.008 ||
      Math.abs(x.p - N.rango.bajo) / N.precio < 0.008
    ).slice(0, 2);
  }

  const msgs = [];

  /* ══ IMPULSO + RETESTEO (el escenario más operable) ══ */
  const imp = N.impulso;
  if (imp && imp.invalidado) {
    msgs.push({
      tipo: 'aviso', p: N.precio, prioridad: 7,
      titulo: elegir(['Broken structure', 'The impulse ran out', 'No setup here anymore']),
      txt: elegir([
        `Price pushed past the zone that started the last ${dirEn(imp.dir)} impulse. When that happens, the structure stops working as a reference.`,
        `The ${dirEn(imp.dir)} move has fully unwound. The origin zone no longer holds.`,
        `The pullback went beyond the impulse's starting point, so that structure is invalidated.`
      ]),
      hacer: elegir([
        'Wait for a fresh structure to form. Trading a broken one is what costs the most.',
        'There is no valid reference right now. Let the market build a new impulse.',
        'Switch timeframe or coin: there is nothing left to trade here.'
      ]),
      detalle: [
        `${nombreTend(imp.dir)} impulse of ${imp.pct.toFixed(2)}%`,
        `Pullback: ${Math.round(imp.retrocesoReal)}% (above 100% = invalidated)`,
        `Origin zone: ${fmt(imp.zonaBaja)} – ${fmt(imp.zonaAlta)}`,
        `${imp.velasDesde} candles since it ended`
      ]
    });
  } else if (imp && (imp.enZona || imp.acercandose)) {
    const alcista = imp.dir === 'alcista';
    const zA = imp.zonaAlta, zB = imp.zonaBaja;
    const stop = alcista ? zB * 0.993 : zA * 1.007;
    const objetivo = imp.precioFin;
    const riesgo = Math.abs(N.precio - stop);
    const premio = Math.abs(objetivo - N.precio);
    const rr = riesgo > 0 ? premio / riesgo : 0;

    msgs.push({
      tipo: alcista ? 'compra' : 'venta',
      p: imp.zonaMedia,
      prioridad: 10,
      titulo: imp.enZona
        ? elegir([
            alcista ? 'Retest in a buy zone' : 'Retest in a sell zone',
            alcista ? 'Price came back to the bullish origin' : 'Price came back to the bearish origin',
            'Impulse retest'
          ])
        : elegir([
            'Price is approaching the zone',
            alcista ? 'Pullback toward the bullish origin' : 'Pullback toward the bearish origin',
            'Get ready: retest on the way'
          ]),
      txt: imp.enZona
        ? elegir([
            `There was a ${alcista ? 'bullish' : 'bearish'} impulse of ${imp.pct.toFixed(1)}% over ${imp.velas} candles, and price has returned to the zone where it started (${fmt(zB)}–${fmt(zA)}). It is inside it right now.`,
            `Price has retraced ${Math.round(imp.retroceso)}% of the ${alcista ? 'bullish' : 'bearish'} impulse and is tagging its origin zone. That is where the money that moved it stepped in.`,
            `${alcista ? 'Bullish' : 'Bearish'} impulse of ${imp.pct.toFixed(1)}% and a full retest: price is at ${fmt(zB)}–${fmt(zA)}, right where the move began.`
          ])
        : elegir([
            `There was a ${alcista ? 'bullish' : 'bearish'} impulse of ${imp.pct.toFixed(1)}% and price is pulling back toward its origin. About ${Math.abs(imp.distZona).toFixed(1)}% to reach ${fmt(zB)}–${fmt(zA)}.`,
            `Price has given back ${Math.round(imp.retroceso)}% of the impulse. The origin zone is about ${Math.abs(imp.distZona).toFixed(1)}% away.`,
            `Pullback underway toward ${fmt(zB)}–${fmt(zA)}, the zone that started the last ${alcista ? 'bullish' : 'bearish'} impulse.`
          ]),
      hacer: imp.enZona
        ? elegir([
            `${alcista ? 'Buy' : 'Sell'} in this zone with a stop ${alcista ? 'below' : 'above'} ${fmt(stop)}. Target the impulse high: ${fmt(objetivo)}. Risk/reward ${rr.toFixed(1)}:1.`,
            `Entry with the impulse. Stop at ${fmt(stop)}, target ${fmt(objetivo)}. If the zone is lost, the structure breaks and you exit.`,
            `This is the entry a structure trader looks for: tight stop at ${fmt(stop)} and room to ${fmt(objetivo)}. Risk/reward about ${rr.toFixed(1)} to 1.`
          ])
        : elegir([
            `It is not there yet. Set an alert at ${fmt(imp.zonaMedia)} and wait for price to enter the zone before trading.`,
            `Prepare the entry but do not take it yet: wait for it to tag ${fmt(zB)}–${fmt(zA)} and react there.`,
            `About ${Math.abs(imp.distZona).toFixed(1)}% to go. Entering early is what spoils this trade.`
          ]),
      detalle: [
        `${alcista ? 'Bullish' : 'Bearish'} impulse of ${imp.pct.toFixed(2)}% over ${imp.velas} candles`,
        `Origin zone: ${fmt(zB)} – ${fmt(zA)}`,
        `Current pullback: ${Math.round(imp.retroceso)}% of the move`,
        `Suggested stop: ${fmt(stop)}`,
        `Target: ${fmt(objetivo)} · risk/reward ${rr.toFixed(1)}:1`,
        `${imp.velasDesde} candles since the impulse ended`,
        `Valid while price does not close ${alcista ? 'below' : 'above'} ${fmt(stop)}`
      ]
    });
  }

  /* ══ ESTRUCTURA ══ cada patrón detectado tiene su lectura. Todo de datos. */
  (N.estructuras || []).forEach((e) => {
    const alc = e.dir === 'alcista';

    if (e.tipo === 'bos') {
      msgs.push({
        tipo: alc ? 'compra' : 'venta', p: e.nivel, prioridad: 8, marca: e,
        titulo: elegir([e.nombre, alc ? 'Structure broken up' : 'Structure broken down',
                        alc ? 'Bullish continuation' : 'Bearish continuation']),
        txt: elegir([
          `Price closed ${alc ? 'above' : 'below'} ${fmt(e.nivel)}, breaking the last structure ${alc ? 'high' : 'low'}. The ${alc ? 'uptrend' : 'downtrend'} continues.`,
          `Break confirmed at ${fmt(e.nivel)}: the close went past that level, not just a wick. That validates the continuation.`,
          `${alc ? 'Buyers' : 'Sellers'} broke ${fmt(e.nivel)} with a body close. Structure stays ${alc ? 'up' : 'down'}.`
        ]),
        hacer: elegir([
          `After a break, what works is waiting for the pullback to ${fmt(e.nivel)}: a broken level often turns into ${alc ? 'support' : 'resistance'}.`,
          `Do not chase the move. Wait for price to come back to ${fmt(e.nivel)} and react there: it is the lower-risk entry.`,
          `Trade with the break, but on the pullback. Entering now means entering at the worst price of the move.`
        ]),
        detalle: [
          `Level broken: ${fmt(e.nivel)}`,
          `Break confirmed by a body close, not a wick`,
          `Type: break of structure (BOS) ${alc ? 'bullish' : 'bearish'}`,
          `What usually follows: the broken level becomes ${alc ? 'support' : 'resistance'}`,
          `Valid until price closes back on the other side`
        ]
      });
    }

    if (e.tipo === 'choch') {
      msgs.push({
        tipo: 'vigilar', p: e.nivel, prioridad: 9, marca: e,
        titulo: elegir([e.nombre, 'Possible cycle shift', 'The market changes character']),
        txt: elegir([
          `Price closed ${alc ? 'above' : 'below'} ${fmt(e.nivel)}, breaking the prior structure for the first time in the opposite direction. It is the first sign of a turn.`,
          `Change of character at ${fmt(e.nivel)}: the pattern the market was following has broken. It may be turning.`,
          `First sign of exhaustion: ${fmt(e.nivel)} gave way, and that breaks the sequence that had been holding.`
        ]),
        hacer: elegir([
          `A change of character is a heads-up, not an entry. Wait for price to pull back to a ${alc ? 'demand' : 'supply'} zone and react there.`,
          `Do not enter on this alone. Mark the level and wait for confirmation: the first break often fails without a pullback.`,
          `Trim exposure in the previous direction. The cycle may be shifting, but it is not confirmed yet.`
        ]),
        detalle: [
          `Reference level: ${fmt(e.nivel)}`,
          `Type: change of character (CHoCH) ${alc ? 'bullish' : 'bearish'}`,
          `This is the FIRST turn against the trend, not a confirmation`,
          `The right move: wait for a pullback to a key zone before entering`,
          `Invalidated if price reclaims the previous side`
        ]
      });
    }

    if (e.tipo === 'ob') {
      const dist = ((e.nivel - N.precio) / N.precio) * 100;
      msgs.push({
        tipo: alc ? 'compra' : 'venta', p: e.nivel, prioridad: Math.abs(dist) < 2 ? 9 : 6, marca: e,
        titulo: elegir([e.nombre, alc ? 'Zone where big money bought' : 'Zone where big money sold',
                        alc ? 'Bullish order block' : 'Bearish order block']),
        txt: elegir([
          `Before the last impulse there was a ${alc ? 'bearish' : 'bullish'} candle at ${fmt(e.zonaB)}–${fmt(e.zonaA)}: that is where the orders that moved price were loaded. It is about ${Math.abs(dist).toFixed(1)}% away.`,
          `The zone ${fmt(e.zonaB)}–${fmt(e.zonaA)} started the impulse. It is where larger volume stepped in, and it tends to be defended when price returns.`,
          `Key zone marked at ${fmt(e.zonaB)}–${fmt(e.zonaA)}. Price left it with force, which is why it matters.`
        ]),
        hacer: Math.abs(dist) < 2
          ? elegir([
              `Price is in the zone. ${alc ? 'Long' : 'Short'} entry with a stop ${alc ? 'below' : 'above'} ${fmt(alc ? e.zonaB * 0.994 : e.zonaA * 1.006)}.`,
              `This is the moment: reaction in a key zone. Tight stop just on the other side of the block.`,
              `Zone active right now. If price reacts here, it is the entry; if it closes through, it is invalidated.`
            ])
          : elegir([
              `Set an alert at ${fmt(e.nivel)}. When price reaches the zone, that is where it is decided.`,
              `Not there yet: about ${Math.abs(dist).toFixed(1)}% to go. Prepare the entry but do not take it.`,
              `Mark this zone and wait. Entering before price tags it is getting ahead of yourself for no reason.`
            ]),
        detalle: [
          `Zone: ${fmt(e.zonaB)} – ${fmt(e.zonaA)}`,
          `It is the last ${alc ? 'bearish' : 'bullish'} candle before the impulse`,
          `Distance to price: ${Math.abs(dist).toFixed(2)}%`,
          `Invalidated if price closes on the other side of the zone`,
          `Concept: order block, where larger volume was loaded`
        ]
      });
    }

    if (e.tipo === 'barrido') {
      msgs.push({
        tipo: alc ? 'compra' : 'venta', p: e.nivel, prioridad: 7, marca: e,
        titulo: elegir([e.nombre, 'Liquidity trap', alc ? 'Stops hunted below' : 'Stops hunted above']),
        txt: elegir([
          `Price pushed past ${fmt(e.nivel)} with the wick but closed back inside. The stops of whoever was ${alc ? 'long' : 'short'} were taken and price was pushed back.`,
          `Sweep at ${fmt(e.nivel)}: the wick pierced the extreme but the body closed within. A classic trap.`,
          `False move at ${fmt(e.nivel)}. The liquidity sitting there was taken and price came back.`
        ]),
        hacer: elegir([
          `After a sweep, price tends to go ${alc ? 'up' : 'down'}. Entry with the move, stop ${alc ? 'below' : 'above'} ${fmt(e.nivel)}.`,
          `Trade against the sweep: whoever placed stops there is already out. Stop on the other side of the wick.`,
          `One of the more reliable signals when it lines up with a key zone. Tight stop past the wick's extreme.`
        ]),
        detalle: [
          `Swept extreme: ${fmt(e.nivel)}`,
          `The wick cleared the level but the body closed back`,
          `It means stops were triggered and price reversed`,
          `Suggested stop: on the other side of the wick extreme`,
          `Concept: liquidity sweep`
        ]
      });
    }
  });

  /* ══ MAREA (tide) ══ solo habla si está encendida y tiene algo real. */
  if (N.verMarea && N.marea) {
    const MA = N.marea;

    if (MA.finde) {
      msgs.push({
        tipo: 'aviso', p: N.precio, prioridad: 6,
        titulo: elegir(['Weekend', 'Tide at rest', 'Weekend market']),
        txt: elegir([
          'On Saturday and Sunday volume drops sharply and cycle-change signals fail far more often. The tool does not trade today.',
          'It is the weekend: fewer participants, exaggerated moves, and breaks that do not hold into Monday.',
          'Tide only works Monday to Friday. On weekends the market is deceptive.'
        ]),
        hacer: elegir([
          'Wait for Monday. What breaks on the weekend tends to unwind when real volume returns.',
          'Do not open new positions based on what happens today or tomorrow.',
          'Use these days to prepare levels, not to enter.'
        ]),
        detalle: [
          'Tide trades Monday to Friday',
          'On weekends volume drops by roughly 40% to 60%',
          'Weekend breaks reverse frequently'
        ]
      });
    } else if (MA.lateral) {
      const porADX = MA.motivoLateral !== 'banda';
      msgs.push({
        tipo: 'aviso', p: N.precio, prioridad: 6,
        titulo: elegir(['Range market', 'No defined cycle', 'Tide waiting']),
        txt: porADX
          ? elegir([
              `There is no measurable trend strength: ADX is at ${MA.panel.adx.toFixed(0)}, below 20. Price drifts back and forth and any turn is noise.`,
              'Price has no clear direction. Here a change of color means nothing.',
              'There is no cycle to follow: price is ranging and signals here fail.'
            ])
          : elegir([
              `Price has run out of room: the recent band is only ${MA.anchoAhora.toFixed(1)}%. Even if it came from a strong leg, it is flat now and no signal is worth taking.`,
              `No range in the last candles (band ${MA.anchoAhora.toFixed(1)}%). Tide waits for price to start moving again.`,
              'The move has stalled. Until there is range again, do not trade.'
            ]),
        hacer: elegir([
          'Wait for price to break out with volume. That is when a signal is worth taking.',
          'In a range, what pays is trading the edges, not following a trend.',
          'Tide speaks again when there is a move with range.'
        ]),
        detalle: [
          `Trend strength (ADX): ${MA.panel.adx.toFixed(0)} · tradable from 20`,
          `Recent band: ${MA.anchoAhora.toFixed(2)}% · tradable from 2%`,
          'Cycle signals without range perform the worst'
        ]
      });
    } else if (MA.ultima && MA.velasDesde != null && MA.velasDesde < 25) {
      const sg = MA.ultima;
      const alc = sg.dir === 'compra';
      msgs.push({
        tipo: alc ? 'compra' : 'venta', p: sg.precio, prioridad: 10,
        iAncla: sg.i,
        titulo: elegir([
          alc ? 'Tide flagged LONG' : 'Tide flagged SHORT',
          alc ? 'The tide turned to buyers' : 'The tide turned to sellers',
          'Cycle change confirmed'
        ]),
        txt: elegir([
          `The cycle changed hands at ${fmt(sg.precio)}, ${MA.velasDesde} ${MA.velasDesde === 1 ? 'candle' : 'candles'} ago. The Heikin Ashi turn was confirmed by a structure break, volume and real trend strength.`,
          `There was a confirmed turn at ${fmt(sg.precio)}: the market tide flipped and the next candle confirmed it, so it does not repaint.`,
          `Tide caught the change at ${fmt(sg.precio)}. Not just any cross: it passed every filter (strength, volume and break).`
        ]),
        hacer: alc
          ? elegir([
              'Buyers took control. Look for entries on pullbacks, do not chase price up here.',
              'Trade with it while the tide stays on the buy side.',
              'Keep the long bias until the tide changes again.'
            ])
          : elegir([
              'Sellers took control. Look for sells on bounces, do not chase the drop.',
              'Trade with it while the tide stays on the sell side.',
              'Keep the short bias until the tide changes again.'
            ]),
        detalle: [
          `Signal at ${fmt(sg.precio)}`,
          `Trend strength (ADX): ${sg.adx.toFixed(0)}`,
          `Confirmations met: ${sg.cumplidos} of 5`,
          'Heikin Ashi turn confirmed by the next candle (no repaint)',
          `Signals discarded by the filters: ${MA.señales.length - MA.validas.length}`
        ]
      });
    }
  }

  /* ══ LÍNEA DE TENDENCIA ══ */
  if (N.linea) {
    const alc = N.linea.tipo === 'alcista';
    const ajuste = Math.round(N.linea.r2 * 100);
    msgs.push({
      tipo: 'tendencia', p: N.linea.m * (v.length - 1) + N.linea.b, prioridad: 5,
      iAncla: N.linea.pts[Math.floor(N.linea.pts.length / 2)].i,
      titulo: elegir([
        alc ? 'Bullish trendline' : 'Bearish trendline',
        alc ? 'Price rising with support' : 'Price falling with a ceiling',
        'Trendline drawn'
      ]),
      txt: elegir([
        `I drew the line joining the last ${N.linea.pts.length} ${alc ? 'lows' : 'highs'}. It fits at ${ajuste}%, so it is a reliable guide while price respects it.`,
        `The ${alc ? 'lows' : 'highs'} line up into a straight line with a ${ajuste}% fit. That line is the reference for the ${alc ? 'uptrend' : 'downtrend'}.`,
        `${alc ? 'Bullish' : 'Bearish'} trendline drawn over ${N.linea.pts.length} points, with a ${ajuste}% fit.`
      ]),
      hacer: elegir([
        alc ? 'While price does not close below the line, the trend is alive. Buys at touches of the line are the lower-risk ones.'
            : 'While price does not close above the line, the drop continues. Sells at touches of the line are the lower-risk ones.',
        alc ? 'Buy on the touches of the line, not mid-leg. If it is lost with a close, the trend is over.'
            : 'Sell on the rejections against the line. If it breaks with a close, the drop is over.',
        'Use the line as a filter: trade only with it while it holds, and step aside if price closes through it.'
      ]),
      detalle: [
        `Drawn over ${N.linea.pts.length} real pivots`,
        `Statistical fit (R²): ${ajuste}%`,
        `Invalidated by a close on the other side, not a wick`,
        `Direction: ${alc ? 'bullish' : 'bearish'}`
      ]
    });
  }

  /* ══ DOBLE SUELO / DOBLE TECHO ══ */
  (N.dobles || []).forEach((d) => {
    const suelo = d.tipo === 'dobleSuelo';
    msgs.push({
      tipo: suelo ? 'compra' : 'venta', p: d.nivel, prioridad: d.confirmado ? 9 : 6,
      iAncla: d.p2.i,
      titulo: elegir([
        suelo ? 'Double bottom' : 'Double top',
        suelo ? 'Floor tested twice' : 'Ceiling rejected twice',
        d.confirmado ? (suelo ? 'Double bottom confirmed' : 'Double top confirmed') : (suelo ? 'Double bottom forming' : 'Double top forming')
      ]),
      txt: elegir([
        `Price made two nearly equal ${suelo ? 'lows' : 'highs'} at ${fmt(d.nivel)}. ${d.confirmado ? `It already broke the neckline at ${fmt(d.cuello)}, so the pattern is confirmed.` : `It still needs to break the neckline at ${fmt(d.cuello)} to confirm.`}`,
        `Two ${suelo ? 'bottoms' : 'tops'} at ${fmt(d.nivel)} and a neckline at ${fmt(d.cuello)}. ${d.confirmado ? 'Confirmed.' : 'Not confirmed yet.'}`,
        `${suelo ? 'Double bottom' : 'Double top'} pattern formed at ${fmt(d.nivel)}. ${d.confirmado ? 'The neckline has given way.' : 'Waiting for the neckline to give way.'}`
      ]),
      hacer: d.confirmado
        ? elegir([
            `Pattern target: ${fmt(d.objetivo)}, the height projected from the neckline. Stop ${suelo ? 'below' : 'above'} ${fmt(d.nivel)}.`,
            `Entry after the confirmation, with a target at ${fmt(d.objetivo)} and a stop on the other side of ${fmt(d.nivel)}.`,
            `Pattern active. Projection to ${fmt(d.objetivo)}; invalidated if it returns to ${fmt(d.nivel)}.`
          ])
        : elegir([
            `Do not enter yet. The pattern only counts when price closes ${suelo ? 'above' : 'below'} the neckline at ${fmt(d.cuello)}.`,
            `Wait for the close beyond ${fmt(d.cuello)}. Without it there is no pattern: just two touches.`,
            `Mark ${fmt(d.cuello)} and wait. Jumping ahead of the confirmation is the most common mistake with this pattern.`
          ]),
      detalle: [
        `Pattern level: ${fmt(d.nivel)}`,
        `Neckline: ${fmt(d.cuello)}`,
        `Projected target: ${fmt(d.objetivo)}`,
        `State: ${d.confirmado ? 'confirmed by close' : 'pending confirmation'}`,
        'Only the body close counts, not the wicks'
      ]
    });
  });

  const soportes = N.niveles.filter((x) => x.tipo === 'soporte' && x.p < N.precio);
  const resist = N.niveles.filter((x) => x.tipo === 'resistencia' && x.p > N.precio);
  const sCerca = soportes[0];
  const rCerca = resist[resist.length - 1];

  /* ── Precio en rango ── */
  if (N.rango) {
    msgs.push({
      tipo: 'aviso',
      p: N.precio,
      titulo: elegir(['Range market', 'No clear direction', 'Price is trapped']),
      txt: elegir([
        `${par} has spent ${Math.round(N.rango.pctDentro)}% of the time inside a ${N.rango.amplitud.toFixed(1)}% band. There is no trend to follow.`,
        `Price swings between ${fmt(N.rango.bajo)} and ${fmt(N.rango.alto)} without committing. Width of only ${N.rango.amplitud.toFixed(1)}%.`,
        `Narrow ${N.rango.amplitud.toFixed(1)}% band: price has gone nowhere over the last ${Math.min(50, v.length)} candles.`
      ]),
      hacer: elegir([
        'In a range, trend entries fail. Wait for the band to break, or look for another coin with a defined direction.',
        'Do not force an entry here. Either wait for the range to break, or switch coin: some markets are clearer right now.',
        'What pays in a range is buying the low and selling the high of the band, with little room. If you want a trend, this is not the coin.'
      ]),
      detalle: [
        `Band ceiling: ${fmt(N.rango.alto)}`,
        `Band floor: ${fmt(N.rango.bajo)}`,
        `Price closed inside the central zone in ${Math.round(N.rango.pctDentro)}% of the candles`,
        `A band under 6% is considered a range for this timeframe`
      ]
    });
  }

  /* ── Soporte cerca con tendencia a favor ── */
  if (sCerca && !N.rango) {
    const d = Math.abs(sCerca.dist);
    const alcista = N.tendencia.dir === 'alcista';
    const stop = sCerca.p * 0.994;

    if (d < 6) {
      msgs.push({
        tipo: alcista ? 'compra' : 'vigilar',
        p: sCerca.p,
        nivel: sCerca,
        titulo: alcista
          ? elegir(['Buy zone', 'Support with the trend', 'Entry to the upside'])
          : elegir(['Support nearby', 'Level that already held', 'Reaction zone']),
        txt: elegir([
          `Support at ${fmt(sCerca.p)} that price respected ${sCerca.toques} times. It is ${d.toFixed(2)}% below.`,
          `Price turned ${sCerca.toques} times at ${fmt(sCerca.p)}. Now it is approaching again: ${d.toFixed(2)}% to go.`,
          `${fmt(sCerca.p)} has stopped the drop ${sCerca.toques} times. Price is about ${d.toFixed(2)}% away.`
        ]),
        hacer: alcista
          ? elegir([
              `With the uptrend and this support nearby, an entry at ${fmt(sCerca.p)} has the structure behind it. Stop below ${fmt(stop)}.`,
              `Buy at ${fmt(sCerca.p)} with a stop at ${fmt(stop)}. The trend helps and the level has ${sCerca.toques} touches behind it.`,
              `If price reaches ${fmt(sCerca.p)} and reacts, it is an entry. Protect below ${fmt(stop)}${rCerca ? ` and look for an exit toward ${fmt(rCerca.p)}` : ''}.`
            ])
          : elegir([
              `The trend does not help, so it is not a clear buy. If price loses ${fmt(sCerca.p)}, the way down opens up.`,
              `Careful: the level is real but the trend is against it. Wait for confirmation before buying here.`,
              `Watch ${fmt(sCerca.p)}. If it holds there could be a bounce, but against the trend the risk is higher.`
            ]),
        detalle: [
          `Confirmed touches: ${sCerca.toques}`,
          `Volume traded in the zone: ${sCerca.volPct.toFixed(1)}% of the total`,
          `Level strength: ${sCerca.fuerza}/100`,
          `Current trend: ${nombreTend(N.tendencia.dir)}`,
          `Suggested stop: ${fmt(stop)} (0.6% below the level)`
        ]
      });
    }
  }

  /* ── Resistencia cerca ── */
  if (rCerca && !N.rango) {
    const d = Math.abs(rCerca.dist);
    const bajista = N.tendencia.dir === 'bajista';
    if (d < 6) {
      msgs.push({
        tipo: bajista ? 'venta' : 'vigilar',
        p: rCerca.p,
        nivel: rCerca,
        titulo: bajista
          ? elegir(['Sell zone', 'Resistance with the trend', 'Entry to the downside'])
          : elegir(['Resistance nearby', 'Ceiling that already rejected', 'Rejection zone']),
        txt: elegir([
          `Resistance at ${fmt(rCerca.p)} that rejected price ${rCerca.toques} times. It is ${d.toFixed(2)}% away.`,
          `Price turned down ${rCerca.toques} times at ${fmt(rCerca.p)}. It is approaching again.`,
          `${fmt(rCerca.p)} has stopped ${rCerca.toques} rallies. About ${d.toFixed(2)}% to reach it.`
        ]),
        hacer: bajista
          ? elegir([
              `With a downtrend, selling at ${fmt(rCerca.p)} has the structure behind it. Stop above ${fmt(rCerca.p * 1.006)}.`,
              `If price rises to ${fmt(rCerca.p)} and stalls, it is a short entry. Protect above ${fmt(rCerca.p * 1.006)}.`,
              `Sell zone at ${fmt(rCerca.p)}. The trend helps and the level has ${rCerca.toques} rejections.`
            ])
          : elegir([
              `If you are long, consider taking profit before ${fmt(rCerca.p)}. That is where price has stalled before.`,
              `${fmt(rCerca.p)} is the obstacle. If it breaks with volume, the way up opens; if not, wait for a rejection.`,
              `Do not buy just under this resistance. Wait for it to break, or for a bounce from lower.`
            ]),
        detalle: [
          `Confirmed rejections: ${rCerca.toques}`,
          `Volume traded in the zone: ${rCerca.volPct.toFixed(1)}% of the total`,
          `Level strength: ${rCerca.fuerza}/100`,
          `Current trend: ${nombreTend(N.tendencia.dir)}`
        ]
      });
    }
  }

  /* ── Precio en tierra de nadie (solo si no hay nada más) ── */
  if (!msgs.length) {
    const haciaS = sCerca ? Math.abs(sCerca.dist) : null;
    const haciaR = rCerca ? Math.abs(rCerca.dist) : null;
    msgs.push({
      prioridad: 1,
      tipo: 'aviso',
      p: N.precio,
      titulo: elegir(['No clear entry', 'Price is in the middle', 'Nothing to do now']),
      txt: elegir([
        `${par} is not near any important level. ${haciaS ? `The nearest support is ${haciaS.toFixed(1)}% away` : 'No nearby support'}${haciaR ? ` and resistance is ${haciaR.toFixed(1)}% away` : ''}.`,
        `Price is drifting between levels, tagging none. Entering here is entering blind.`,
        `There is no confluence right now: price is far from the zones where it has reacted before.`
      ]),
      hacer: elegir([
        'Wait. The best entries come when price reaches a tested level, not mid-way.',
        'With no level nearby there is nowhere to place a stop with logic. Better to wait until price approaches a zone.',
        'Patience: entering without a reference is what costs the most. Let price come to a level.'
      ]),
      detalle: [
        haciaS ? `Nearest support: ${fmt(sCerca.p)} (${haciaS.toFixed(2)}% below)` : 'No support in the analyzed range',
        haciaR ? `Nearest resistance: ${fmt(rCerca.p)} (${haciaR.toFixed(2)}% above)` : 'No resistance in the analyzed range',
        `Trend: ${nombreTend(N.tendencia.dir)}`,
        `Valid levels detected: ${N.niveles.length}`
      ]
    });
  }

  /* ── Aviso de tendencia, siempre que haya una clara ── */
  if (N.tendencia.dir !== 'lateral' && N.tendencia.dir !== 'indefinida' && !N.rango) {
    const alc = N.tendencia.dir === 'alcista';
    msgs.push({
      tipo: 'tendencia',
      p: N.precio,
      titulo: alc
        ? elegir(['Uptrend', 'Structure to the upside', 'The market is rising'])
        : elegir(['Downtrend', 'Structure to the downside', 'The market is falling']),
      txt: elegir([
        alc ? `Higher highs and higher lows over the last candles. A ${N.tendencia.mov.toFixed(1)}% move on this leg.`
            : `Lower highs and lower lows. A ${N.tendencia.mov.toFixed(1)}% move on this leg.`,
        alc ? `The structure is bullish: each pullback has made a higher low than the previous one.`
            : `The structure is bearish: each bounce has stayed lower than the previous one.`,
        alc ? `Price is building steps to the upside. It has ${N.tendencia.mov.toFixed(1)}% on this leg.`
            : `Price is building steps to the downside. It has ${N.tendencia.mov.toFixed(1)}% on this leg.`
      ]),
      hacer: alc
        ? elegir([
            'Trade with it: look for buys on pullbacks to support, do not sell against the trend.',
            'Buys at supports have the edge here. Shorting goes against the current.',
            'Prioritize long entries on pullbacks. The trend is your ally while the lows keep rising.'
          ])
        : elegir([
            'Trade with it: look for sells on bounces to resistance, do not buy against the trend.',
            'Sells at resistance have the edge here. Buying goes against the current.',
            'Prioritize short entries on bounces. The trend rules while the highs keep falling.'
          ]),
      detalle: [
        `Direction: ${nombreTend(N.tendencia.dir)}`,
        `Leg move: ${N.tendencia.mov.toFixed(2)}%`,
        `Measured by the structure of highs and lows, not by indicators`,
        `Valid supports: ${soportes.length} · resistances: ${resist.length}`
      ]
    });
  }

  /* ══ EL PLAN ÚNICO ══ todo se pondera y sale UN plan. */
  msgs.sort((a, b) => (b.prioridad || 0) - (a.prioridad || 0));
  N.mensajes = unificar(msgs);
}

/* ══════════════════════════════════════════════════════════════
   UNIFICAR: de varias lecturas a un plan
   ══════════════════════════════════════════════════════════════ */
function unificar(msgs) {
  if (!msgs.length) return [];

  /* Cada señal vota. El peso sale de su prioridad. */
  let votoC = 0, votoV = 0, votoE = 0;
  msgs.forEach((m) => {
    const p = (m.prioridad || 5);
    if (m.tipo === 'compra') votoC += p;
    else if (m.tipo === 'venta') votoV += p;
    else votoE += p * 0.55;      // esperar pesa menos: no es una postura activa
  });

  const total = votoC + votoV + votoE || 1;
  let lado, conf;
  if (votoC > votoV && votoC > votoE) { lado = 'compra'; conf = votoC / total; }
  else if (votoV > votoC && votoV > votoE) { lado = 'venta'; conf = votoV / total; }
  else { lado = 'esperar'; conf = votoE / total; }

  /* La tendencia decide el sesgo: señales a favor cuentan entero, en contra la mitad. */
  const dirT = N.tendencia ? N.tendencia.dir : 'lateral';
  if (dirT === 'alcista') { votoC *= 1.6; votoV *= 0.5; }
  else if (dirT === 'bajista') { votoV *= 1.6; votoC *= 0.5; }

  const tot2 = votoC + votoV + votoE || 1;
  if (votoC > votoV && votoC > 0) { lado = 'compra'; conf = votoC / tot2; }
  else if (votoV > votoC && votoV > 0) { lado = 'venta'; conf = votoV / tot2; }
  else { lado = 'esperar'; conf = votoE / tot2; }

  const sinRumbo = dirT === 'lateral' || dirT === 'indefinida';
  const disputado = sinRumbo && votoC > 0 && votoV > 0 &&
                    Math.abs(votoC - votoV) < Math.max(votoC, votoV) * 0.2;
  if (disputado) { lado = 'esperar'; conf = 0.4; }

  N.plan = {
    lado, conf: Math.round(conf * 100), disputado,
    votoC: Math.round(votoC), votoV: Math.round(votoV), votoE: Math.round(votoE)
  };

  let principal;
  if (disputado) {
    const arriba = msgs.filter((m) => m.tipo === 'venta')[0];
    const abajo = msgs.filter((m) => m.tipo === 'compra')[0];
    principal = {
      tipo: 'aviso', p: N.precio, prioridad: 99, esPlan: true,
      titulo: elegir(['Signals at odds', 'The market cannot decide', 'No clear direction']),
      txt: elegir([
        `I found arguments for both sides: ${abajo ? abajo.titulo.toLowerCase() : 'a buy'} below and ${arriba ? arriba.titulo.toLowerCase() : 'a sell'} above. When the structure contradicts itself, the likely path is that price stays undecided.`,
        `There are conflicting signals on this timeframe. Neither buyers nor sellers are clearly in control right now.`,
        `The read is split: ${Math.round(votoC)} of bullish weight against ${Math.round(votoV)} bearish. Too even to trade with an edge.`
      ]),
      hacer: elegir([
        'Do not trade this coin now. Wait for one of the two forces to win with a clean close, or switch to a timeframe where the read is clean.',
        'When signals contradict each other, what pays is staying out. Come back when there is a defined direction.',
        'Move up a timeframe to see who is really in control, or find another coin with clear structure.'
      ]),
      detalle: [
        `Bullish weight: ${Math.round(votoC)}`,
        `Bearish weight: ${Math.round(votoV)}`,
        `Difference too small to give a direction`,
        `Readings analyzed: ${msgs.length}`,
        `Recommendation: wait for definition or switch coin`
      ]
    };
  } else {
    const delLado = msgs.filter((m) => m.tipo === lado)
      .sort((a, b) => (b.prioridad || 0) - (a.prioridad || 0));
    const conFondo = msgs.filter((m) => (m.prioridad || 0) >= 5)
      .sort((a, b) => (b.prioridad || 0) - (a.prioridad || 0));
    principal = delLado[0] || conFondo[0] || msgs[0];
    principal = { ...principal, esPlan: true, prioridad: 99 };

    if ((lado === 'compra' || lado === 'venta') && principal.p > 0 && N.atr > 0) {
      const entrada = principal.p;
      const base = lado === 'compra' ? entrada * 0.994 : entrada * 1.006;
      const plan = construirPlan(lado, entrada, base, N.atr);
      if (plan) {
        principal.plan = plan;
        principal.detalle = [
          `Entry: ${fmt(plan.entrada)}`,
          `Stop: ${fmt(plan.stop)} (${plan.riesgoPct.toFixed(2)}% risk)`,
          `Target 1: ${fmt(plan.obj[0].p)} · secures the trade`,
          `Target 2: ${fmt(plan.obj[1].p)} · the main one, 2R`,
          `Target 3: ${fmt(plan.obj[2].p)} · if the move keeps going`,
          `Stop set to 1.2x the average volatility (${fmt(N.atr)})`,
          ...(principal.detalle || [])
        ];
      }
    }
    principal.detalle = [
      `Plan confidence: ${Math.round(conf * 100)}% of the total weight`,
      ...(principal.detalle || [])
    ];
  }

  const apoyo = msgs
    .filter((m) => m !== principal && m.titulo !== principal.titulo)
    .slice(0, 2)
    .map((m) => ({ ...m, esApoyo: true, tipo: m.tipo === lado ? m.tipo : 'contexto' }));

  return [principal, ...apoyo];
}
