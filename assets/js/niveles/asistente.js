/* niveles/asistente.js — Genera la lectura del asistente: toma las velas,
   corre el motor y traduce los datos a mensajes y a un plan operativo.
   No dibuja nada; solo escribe en N.

   [T4] Los textos son BILINGÜES: cada título/texto/consejo/detalle es un
   objeto { en, es }. burbujas.js muestra inglés por defecto y el botón "ES"
   de cada analista cambia ESE popup a español. La LÓGICA (motor, condiciones,
   prioridades, votación) es intacta. La variedad real entre monedas la da la
   semilla por moneda (ver util.js/niveles.js): dos pares distintos ya no
   cuentan la misma lectura con las mismas palabras. */

import { N } from './estado.js?v=2';
import { elegir, fmt } from './util.js?v=2';
import { pivotes, tendencia, detectarRango, calcularNiveles, detectarImpulso, detectarEstructuras, calcularTendencia, detectarDobles, marea, calcularATR, construirPlan } from './motor.js?v=2';

/* Par bilingüe: { en, es }. elegir() escoge uno de la lista igual que antes. */
const dos = (en, es) => ({ en, es });
const nombreTend = (d) => ({ alcista: 'bullish', bajista: 'bearish', lateral: 'sideways', indefinida: 'undefined' }[d] || d);
const nombreTendEs = (d) => ({ alcista: 'alcista', bajista: 'bajista', lateral: 'lateral', indefinida: 'indefinida' }[d] || d);
const dirEn = (d) => (d === 'alcista' ? 'bullish' : d === 'bajista' ? 'bearish' : 'sideways');
const dirEs = (d) => (d === 'alcista' ? 'alcista' : d === 'bajista' ? 'bajista' : 'lateral');

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

  const tf = N.tf;  /* timeframe en curso: ancla cada lectura a lo que el usuario mira */

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
      titulo: elegir([
        dos('Broken structure', 'Estructura rota'),
        dos('The impulse ran out', 'El impulso se agotó'),
        dos('No setup here anymore', 'Aquí ya no hay entrada')
      ]),
      txt: elegir([
        dos(`On the ${tf}, price pushed past the zone that started the last ${dirEn(imp.dir)} impulse. When that happens, the structure stops working as a reference.`,
            `En ${tf}, el precio traspasó la zona que originó el último impulso ${dirEs(imp.dir)}. Cuando eso pasa, la estructura deja de servir como referencia.`),
        dos(`The ${dirEn(imp.dir)} move has fully unwound — the pullback is ${Math.round(imp.retrocesoReal)}% of it. The origin zone no longer holds.`,
            `El movimiento ${dirEs(imp.dir)} se deshizo del todo: el retroceso es del ${Math.round(imp.retrocesoReal)}%. La zona de origen ya no aguanta.`),
        dos(`The pullback went beyond the impulse's starting point (${fmt(imp.zonaBaja)}–${fmt(imp.zonaAlta)}), so that structure is invalidated.`,
            `El retroceso pasó por detrás del punto de partida del impulso (${fmt(imp.zonaBaja)}–${fmt(imp.zonaAlta)}), así que esa estructura queda invalidada.`)
      ]),
      hacer: elegir([
        dos('Wait for a fresh structure to form. Trading a broken one is what costs the most.',
            'Espera a que se forme una estructura nueva. Operar una rota es lo que más cuesta.'),
        dos('There is no valid reference right now. Let the market build a new impulse.',
            'Ahora mismo no hay referencia válida. Deja que el mercado arme un impulso nuevo.'),
        dos('Switch timeframe or coin: there is nothing left to trade here.',
            'Cambia de temporalidad o de moneda: aquí ya no queda nada que operar.')
      ]),
      detalle: [
        dos(`${nombreTend(imp.dir)} impulse of ${imp.pct.toFixed(2)}%`, `Impulso ${nombreTendEs(imp.dir)} de ${imp.pct.toFixed(2)}%`),
        dos(`Pullback: ${Math.round(imp.retrocesoReal)}% (above 100% = invalidated)`, `Retroceso: ${Math.round(imp.retrocesoReal)}% (más de 100% = invalidado)`),
        dos(`Origin zone: ${fmt(imp.zonaBaja)} – ${fmt(imp.zonaAlta)}`, `Zona de origen: ${fmt(imp.zonaBaja)} – ${fmt(imp.zonaAlta)}`),
        dos(`${imp.velasDesde} candles since it ended`, `${imp.velasDesde} velas desde que terminó`)
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
            alcista ? dos('Retest in a buy zone', 'Retesteo en zona de compra') : dos('Retest in a sell zone', 'Retesteo en zona de venta'),
            alcista ? dos('Price came back to the bullish origin', 'El precio volvió al origen alcista') : dos('Price came back to the bearish origin', 'El precio volvió al origen bajista'),
            dos('Impulse retest', 'Retesteo del impulso')
          ])
        : elegir([
            dos('Price is approaching the zone', 'El precio se acerca a la zona'),
            alcista ? dos('Pullback toward the bullish origin', 'Retroceso hacia el origen alcista') : dos('Pullback toward the bearish origin', 'Retroceso hacia el origen bajista'),
            dos('Get ready: retest on the way', 'Prepárate: retesteo en camino')
          ]),
      txt: imp.enZona
        ? elegir([
            dos(`There was a ${alcista ? 'bullish' : 'bearish'} impulse of ${imp.pct.toFixed(1)}% over ${imp.velas} candles on the ${tf}, and price has returned to the zone where it started (${fmt(zB)}–${fmt(zA)}). It is inside it right now.`,
                `Hubo un impulso ${alcista ? 'alcista' : 'bajista'} del ${imp.pct.toFixed(1)}% en ${imp.velas} velas del ${tf}, y el precio volvió a la zona donde arrancó (${fmt(zB)}–${fmt(zA)}). Ahora mismo está dentro.`),
            dos(`Price has retraced ${Math.round(imp.retroceso)}% of the ${alcista ? 'bullish' : 'bearish'} impulse and is tagging its origin at ${fmt(zB)}–${fmt(zA)}. That is where the money that moved it stepped in.`,
                `El precio retrocedió el ${Math.round(imp.retroceso)}% del impulso ${alcista ? 'alcista' : 'bajista'} y está tocando su origen en ${fmt(zB)}–${fmt(zA)}. Ahí es donde entró el dinero que lo movió.`),
            dos(`${alcista ? 'Bullish' : 'Bearish'} impulse of ${imp.pct.toFixed(1)}% and a full retest: price is at ${fmt(zB)}–${fmt(zA)}, right where the move began.`,
                `Impulso ${alcista ? 'alcista' : 'bajista'} del ${imp.pct.toFixed(1)}% y retesteo completo: el precio está en ${fmt(zB)}–${fmt(zA)}, justo donde empezó el movimiento.`)
          ])
        : elegir([
            dos(`There was a ${alcista ? 'bullish' : 'bearish'} impulse of ${imp.pct.toFixed(1)}% and price is pulling back toward its origin. About ${Math.abs(imp.distZona).toFixed(1)}% left to reach ${fmt(zB)}–${fmt(zA)}.`,
                `Hubo un impulso ${alcista ? 'alcista' : 'bajista'} del ${imp.pct.toFixed(1)}% y el precio retrocede hacia su origen. Faltan ~${Math.abs(imp.distZona).toFixed(1)}% para llegar a ${fmt(zB)}–${fmt(zA)}.`),
            dos(`Price has given back ${Math.round(imp.retroceso)}% of the impulse. The origin zone (${fmt(zB)}–${fmt(zA)}) is about ${Math.abs(imp.distZona).toFixed(1)}% away.`,
                `El precio devolvió el ${Math.round(imp.retroceso)}% del impulso. La zona de origen (${fmt(zB)}–${fmt(zA)}) está a ~${Math.abs(imp.distZona).toFixed(1)}%.`),
            dos(`Pullback underway toward ${fmt(zB)}–${fmt(zA)}, the zone that started the last ${alcista ? 'bullish' : 'bearish'} impulse.`,
                `Retroceso en marcha hacia ${fmt(zB)}–${fmt(zA)}, la zona que originó el último impulso ${alcista ? 'alcista' : 'bajista'}.`)
          ]),
      hacer: imp.enZona
        ? elegir([
            dos(`${alcista ? 'Buy' : 'Sell'} in this zone with a stop ${alcista ? 'below' : 'above'} ${fmt(stop)}. Target the impulse high: ${fmt(objetivo)}. Risk/reward ${rr.toFixed(1)}:1.`,
                `${alcista ? 'Compra' : 'Vende'} en esta zona con stop ${alcista ? 'debajo de' : 'encima de'} ${fmt(stop)}. Objetivo, el extremo del impulso: ${fmt(objetivo)}. Riesgo/beneficio ${rr.toFixed(1)}:1.`),
            dos(`Entry with the impulse. Stop at ${fmt(stop)}, target ${fmt(objetivo)}. If the zone is lost, the structure breaks and you exit.`,
                `Entrada a favor del impulso. Stop en ${fmt(stop)}, objetivo ${fmt(objetivo)}. Si pierde la zona, la estructura se rompe y sales.`),
            dos(`This is the entry a structure trader looks for: tight stop at ${fmt(stop)} and room to ${fmt(objetivo)}. Risk/reward about ${rr.toFixed(1)} to 1.`,
                `Esta es la entrada que busca un trader de estructura: stop ajustado en ${fmt(stop)} y recorrido hasta ${fmt(objetivo)}. Riesgo/beneficio ~${rr.toFixed(1)} a 1.`)
          ])
        : elegir([
            dos(`Not there yet. Set an alert at ${fmt(imp.zonaMedia)} and wait for price to enter the zone before trading.`,
                `Todavía no llega. Pon una alerta en ${fmt(imp.zonaMedia)} y espera a que el precio entre en la zona antes de operar.`),
            dos(`Prepare the entry but do not take it yet: wait for it to tag ${fmt(zB)}–${fmt(zA)} and react there.`,
                `Prepara la entrada pero no la tomes aún: espera a que toque ${fmt(zB)}–${fmt(zA)} y reaccione ahí.`),
            dos(`About ${Math.abs(imp.distZona).toFixed(1)}% to go. Entering early is what spoils this trade.`,
                `Faltan ~${Math.abs(imp.distZona).toFixed(1)}%. Entrar antes de tiempo es lo que arruina este trade.`)
          ]),
      detalle: [
        dos(`${alcista ? 'Bullish' : 'Bearish'} impulse of ${imp.pct.toFixed(2)}% over ${imp.velas} candles`, `Impulso ${alcista ? 'alcista' : 'bajista'} del ${imp.pct.toFixed(2)}% en ${imp.velas} velas`),
        dos(`Origin zone: ${fmt(zB)} – ${fmt(zA)}`, `Zona de origen: ${fmt(zB)} – ${fmt(zA)}`),
        dos(`Current pullback: ${Math.round(imp.retroceso)}% of the move`, `Retroceso actual: ${Math.round(imp.retroceso)}% del movimiento`),
        dos(`Suggested stop: ${fmt(stop)}`, `Stop sugerido: ${fmt(stop)}`),
        dos(`Target: ${fmt(objetivo)} · risk/reward ${rr.toFixed(1)}:1`, `Objetivo: ${fmt(objetivo)} · riesgo/beneficio ${rr.toFixed(1)}:1`),
        dos(`${imp.velasDesde} candles since the impulse ended`, `${imp.velasDesde} velas desde que terminó el impulso`),
        dos(`Valid while price does not close ${alcista ? 'below' : 'above'} ${fmt(stop)}`, `Válido mientras el precio no cierre ${alcista ? 'debajo de' : 'encima de'} ${fmt(stop)}`)
      ]
    });
  }

  /* ══ ESTRUCTURA ══ cada patrón detectado tiene su lectura. Todo de datos. */
  (N.estructuras || []).forEach((e) => {
    const alc = e.dir === 'alcista';

    if (e.tipo === 'bos') {
      msgs.push({
        tipo: alc ? 'compra' : 'venta', p: e.nivel, prioridad: 8, marca: e,
        titulo: elegir([
          dos(alc ? 'Structure broken up' : 'Structure broken down', alc ? 'Estructura rota al alza' : 'Estructura rota a la baja'),
          dos(alc ? 'Bullish continuation' : 'Bearish continuation', alc ? 'Continuación alcista' : 'Continuación bajista'),
          dos(alc ? 'Buyers broke the high' : 'Sellers broke the low', alc ? 'Los compradores rompieron el máximo' : 'Los vendedores rompieron el mínimo')
        ]),
        txt: elegir([
          dos(`Price closed ${alc ? 'above' : 'below'} ${fmt(e.nivel)} on the ${tf}, breaking the last structure ${alc ? 'high' : 'low'}. The ${alc ? 'uptrend' : 'downtrend'} continues.`,
              `El precio cerró ${alc ? 'por encima de' : 'por debajo de'} ${fmt(e.nivel)} en ${tf}, rompiendo el último ${alc ? 'máximo' : 'mínimo'} de estructura. La tendencia ${alc ? 'alcista' : 'bajista'} continúa.`),
          dos(`Break confirmed at ${fmt(e.nivel)}: the close went past that level, not just a wick. That validates the continuation.`,
              `Ruptura confirmada en ${fmt(e.nivel)}: el cierre pasó ese nivel, no solo la mecha. Eso valida la continuación.`),
          dos(`${alc ? 'Buyers' : 'Sellers'} broke ${fmt(e.nivel)} with a body close. Structure stays ${alc ? 'up' : 'down'}.`,
              `Los ${alc ? 'compradores' : 'vendedores'} rompieron ${fmt(e.nivel)} con cierre de cuerpo. La estructura sigue ${alc ? 'al alza' : 'a la baja'}.`)
        ]),
        hacer: elegir([
          dos(`After a break, what works is waiting for the pullback to ${fmt(e.nivel)}: a broken level often turns into ${alc ? 'support' : 'resistance'}.`,
              `Tras una ruptura, lo que funciona es esperar el retroceso a ${fmt(e.nivel)}: un nivel roto suele volverse ${alc ? 'soporte' : 'resistencia'}.`),
          dos(`Do not chase the move. Wait for price to come back to ${fmt(e.nivel)} and react there: it is the lower-risk entry.`,
              `No persigas el movimiento. Espera a que el precio vuelva a ${fmt(e.nivel)} y reaccione ahí: es la entrada de menor riesgo.`),
          dos('Trade with the break, but on the pullback. Entering now means entering at the worst price of the move.',
              'Opera a favor de la ruptura, pero en el retroceso. Entrar ahora es entrar al peor precio del movimiento.')
        ]),
        detalle: [
          dos(`Level broken: ${fmt(e.nivel)}`, `Nivel roto: ${fmt(e.nivel)}`),
          dos('Break confirmed by a body close, not a wick', 'Ruptura confirmada por cierre de cuerpo, no por mecha'),
          dos(`Type: break of structure (BOS) ${alc ? 'bullish' : 'bearish'}`, `Tipo: ruptura de estructura (BOS) ${alc ? 'alcista' : 'bajista'}`),
          dos(`What usually follows: the broken level becomes ${alc ? 'support' : 'resistance'}`, `Lo que suele seguir: el nivel roto se vuelve ${alc ? 'soporte' : 'resistencia'}`),
          dos('Valid until price closes back on the other side', 'Válido hasta que el precio cierre de vuelta al otro lado')
        ]
      });
    }

    if (e.tipo === 'choch') {
      msgs.push({
        tipo: 'vigilar', p: e.nivel, prioridad: 9, marca: e,
        titulo: elegir([
          dos('Possible cycle shift', 'Posible cambio de ciclo'),
          dos('The market changes character', 'El mercado cambia de carácter'),
          dos(alc ? 'First turn up' : 'First turn down', alc ? 'Primer giro al alza' : 'Primer giro a la baja')
        ]),
        txt: elegir([
          dos(`Price closed ${alc ? 'above' : 'below'} ${fmt(e.nivel)} on the ${tf}, breaking the prior structure for the first time in the opposite direction. It is the first sign of a turn.`,
              `El precio cerró ${alc ? 'por encima de' : 'por debajo de'} ${fmt(e.nivel)} en ${tf}, rompiendo la estructura previa por primera vez en sentido contrario. Es el primer aviso de giro.`),
          dos(`Change of character at ${fmt(e.nivel)}: the pattern the market was following has broken. It may be turning.`,
              `Cambio de carácter en ${fmt(e.nivel)}: el patrón que el mercado venía siguiendo se rompió. Podría estar girando.`),
          dos(`First sign of exhaustion: ${fmt(e.nivel)} gave way, and that breaks the sequence that had been holding.`,
              `Primer signo de agotamiento: ${fmt(e.nivel)} cedió, y eso rompe la secuencia que se venía manteniendo.`)
        ]),
        hacer: elegir([
          dos(`A change of character is a heads-up, not an entry. Wait for price to pull back to a ${alc ? 'demand' : 'supply'} zone and react there.`,
              `Un cambio de carácter es un aviso, no una entrada. Espera a que el precio retroceda a una zona de ${alc ? 'demanda' : 'oferta'} y reaccione ahí.`),
          dos('Do not enter on this alone. Mark the level and wait for confirmation: the first break often fails without a pullback.',
              'No entres solo por esto. Marca el nivel y espera confirmación: la primera ruptura falla a menudo sin retroceso.'),
          dos('Trim exposure in the previous direction. The cycle may be shifting, but it is not confirmed yet.',
              'Reduce exposición en la dirección previa. El ciclo podría estar cambiando, pero aún no está confirmado.')
        ]),
        detalle: [
          dos(`Reference level: ${fmt(e.nivel)}`, `Nivel de referencia: ${fmt(e.nivel)}`),
          dos(`Type: change of character (CHoCH) ${alc ? 'bullish' : 'bearish'}`, `Tipo: cambio de carácter (CHoCH) ${alc ? 'alcista' : 'bajista'}`),
          dos('This is the FIRST turn against the trend, not a confirmation', 'Este es el PRIMER giro contra la tendencia, no una confirmación'),
          dos('The right move: wait for a pullback to a key zone before entering', 'Lo correcto: esperar un retroceso a una zona clave antes de entrar'),
          dos('Invalidated if price reclaims the previous side', 'Invalidado si el precio recupera el lado previo')
        ]
      });
    }

    if (e.tipo === 'ob') {
      const dist = ((e.nivel - N.precio) / N.precio) * 100;
      msgs.push({
        tipo: alc ? 'compra' : 'venta', p: e.nivel, prioridad: Math.abs(dist) < 2 ? 9 : 6, marca: e,
        titulo: elegir([
          dos(alc ? 'Zone where big money bought' : 'Zone where big money sold', alc ? 'Zona donde compró el dinero grande' : 'Zona donde vendió el dinero grande'),
          dos(alc ? 'Bullish order block' : 'Bearish order block', alc ? 'Bloque de órdenes alcista' : 'Bloque de órdenes bajista'),
          dos('Key zone ahead', 'Zona clave por delante')
        ]),
        txt: elegir([
          dos(`Before the last impulse there was a ${alc ? 'bearish' : 'bullish'} candle at ${fmt(e.zonaB)}–${fmt(e.zonaA)}: that is where the orders that moved price were loaded. It is about ${Math.abs(dist).toFixed(1)}% away.`,
              `Antes del último impulso hubo una vela ${alc ? 'bajista' : 'alcista'} en ${fmt(e.zonaB)}–${fmt(e.zonaA)}: ahí se cargaron las órdenes que movieron el precio. Está a ~${Math.abs(dist).toFixed(1)}%.`),
          dos(`The zone ${fmt(e.zonaB)}–${fmt(e.zonaA)} started the impulse. It is where larger volume stepped in, and it tends to be defended when price returns.`,
              `La zona ${fmt(e.zonaB)}–${fmt(e.zonaA)} originó el impulso. Ahí entró el volumen grande, y suele defenderse cuando el precio vuelve.`),
          dos(`Key zone marked at ${fmt(e.zonaB)}–${fmt(e.zonaA)}. Price left it with force, which is why it matters.`,
              `Zona clave marcada en ${fmt(e.zonaB)}–${fmt(e.zonaA)}. El precio salió de ahí con fuerza, por eso importa.`)
        ]),
        hacer: Math.abs(dist) < 2
          ? elegir([
              dos(`Price is in the zone. ${alc ? 'Long' : 'Short'} entry with a stop ${alc ? 'below' : 'above'} ${fmt(alc ? e.zonaB * 0.994 : e.zonaA * 1.006)}.`,
                  `El precio está en la zona. Entrada ${alc ? 'en largo' : 'en corto'} con stop ${alc ? 'debajo de' : 'encima de'} ${fmt(alc ? e.zonaB * 0.994 : e.zonaA * 1.006)}.`),
              dos('This is the moment: reaction in a key zone. Tight stop just on the other side of the block.',
                  'Este es el momento: reacción en una zona clave. Stop ajustado justo al otro lado del bloque.'),
              dos('Zone active right now. If price reacts here, it is the entry; if it closes through, it is invalidated.',
                  'Zona activa ahora mismo. Si el precio reacciona aquí, es la entrada; si cierra atravesándola, queda invalidada.')
            ])
          : elegir([
              dos(`Set an alert at ${fmt(e.nivel)}. When price reaches the zone, that is where it is decided.`,
                  `Pon una alerta en ${fmt(e.nivel)}. Cuando el precio llegue a la zona, ahí se decide.`),
              dos(`Not there yet: about ${Math.abs(dist).toFixed(1)}% to go. Prepare the entry but do not take it.`,
                  `Todavía no llega: faltan ~${Math.abs(dist).toFixed(1)}%. Prepara la entrada pero no la tomes.`),
              dos('Mark this zone and wait. Entering before price tags it is getting ahead of yourself for no reason.',
                  'Marca esta zona y espera. Entrar antes de que el precio la toque es adelantarte sin motivo.')
            ]),
        detalle: [
          dos(`Zone: ${fmt(e.zonaB)} – ${fmt(e.zonaA)}`, `Zona: ${fmt(e.zonaB)} – ${fmt(e.zonaA)}`),
          dos(`It is the last ${alc ? 'bearish' : 'bullish'} candle before the impulse`, `Es la última vela ${alc ? 'bajista' : 'alcista'} antes del impulso`),
          dos(`Distance to price: ${Math.abs(dist).toFixed(2)}%`, `Distancia al precio: ${Math.abs(dist).toFixed(2)}%`),
          dos('Invalidated if price closes on the other side of the zone', 'Invalidado si el precio cierra al otro lado de la zona'),
          dos('Concept: order block, where larger volume was loaded', 'Concepto: order block, donde se cargó el volumen grande')
        ]
      });
    }

    if (e.tipo === 'barrido') {
      msgs.push({
        tipo: alc ? 'compra' : 'venta', p: e.nivel, prioridad: 7, marca: e,
        titulo: elegir([
          dos('Liquidity trap', 'Trampa de liquidez'),
          dos(alc ? 'Stops hunted below' : 'Stops hunted above', alc ? 'Cazaron stops abajo' : 'Cazaron stops arriba'),
          dos('Liquidity sweep', 'Barrido de liquidez')
        ]),
        txt: elegir([
          dos(`Price pushed past ${fmt(e.nivel)} with the wick but closed back inside. The stops of whoever was ${alc ? 'long' : 'short'} were taken and price was pushed back.`,
              `El precio traspasó ${fmt(e.nivel)} con la mecha pero cerró de vuelta adentro. Se llevaron los stops de quien estaba ${alc ? 'largo' : 'corto'} y el precio se devolvió.`),
          dos(`Sweep at ${fmt(e.nivel)}: the wick pierced the extreme but the body closed within. A classic trap.`,
              `Barrido en ${fmt(e.nivel)}: la mecha perforó el extremo pero el cuerpo cerró adentro. Una trampa clásica.`),
          dos(`False move at ${fmt(e.nivel)}. The liquidity sitting there was taken and price came back.`,
              `Movimiento falso en ${fmt(e.nivel)}. Se tomó la liquidez que había ahí y el precio regresó.`)
        ]),
        hacer: elegir([
          dos(`After a sweep, price tends to go ${alc ? 'up' : 'down'}. Entry with the move, stop ${alc ? 'below' : 'above'} ${fmt(e.nivel)}.`,
              `Tras un barrido, el precio suele irse ${alc ? 'arriba' : 'abajo'}. Entrada a favor del movimiento, stop ${alc ? 'debajo de' : 'encima de'} ${fmt(e.nivel)}.`),
          dos('Trade against the sweep: whoever placed stops there is already out. Stop on the other side of the wick.',
              'Opera en contra del barrido: quien puso stops ahí ya quedó fuera. Stop al otro lado de la mecha.'),
          dos('One of the more reliable signals when it lines up with a key zone. Tight stop past the wick\'s extreme.',
              'Una de las señales más fiables cuando coincide con una zona clave. Stop ajustado pasando el extremo de la mecha.')
        ]),
        detalle: [
          dos(`Swept extreme: ${fmt(e.nivel)}`, `Extremo barrido: ${fmt(e.nivel)}`),
          dos('The wick cleared the level but the body closed back', 'La mecha superó el nivel pero el cuerpo cerró de vuelta'),
          dos('It means stops were triggered and price reversed', 'Significa que se activaron stops y el precio revirtió'),
          dos('Suggested stop: on the other side of the wick extreme', 'Stop sugerido: al otro lado del extremo de la mecha'),
          dos('Concept: liquidity sweep', 'Concepto: barrido de liquidez')
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
        titulo: elegir([
          dos('Weekend', 'Fin de semana'),
          dos('Tide at rest', 'Marea en reposo'),
          dos('Weekend market', 'Mercado de fin de semana')
        ]),
        txt: elegir([
          dos('On Saturday and Sunday volume drops sharply and cycle-change signals fail far more often. The tool does not trade today.',
              'Sábado y domingo el volumen cae en picado y las señales de cambio de ciclo fallan mucho más. La herramienta no opera hoy.'),
          dos('It is the weekend: fewer participants, exaggerated moves, and breaks that do not hold into Monday.',
              'Es fin de semana: menos participantes, movimientos exagerados y rupturas que no aguantan hasta el lunes.'),
          dos('Tide only works Monday to Friday. On weekends the market is deceptive.',
              'La marea solo funciona de lunes a viernes. En fin de semana el mercado engaña.')
        ]),
        hacer: elegir([
          dos('Wait for Monday. What breaks on the weekend tends to unwind when real volume returns.',
              'Espera al lunes. Lo que rompe en fin de semana suele deshacerse cuando vuelve el volumen real.'),
          dos('Do not open new positions based on what happens today or tomorrow.',
              'No abras posiciones nuevas por lo que pase hoy o mañana.'),
          dos('Use these days to prepare levels, not to enter.',
              'Usa estos días para preparar niveles, no para entrar.')
        ]),
        detalle: [
          dos('Tide trades Monday to Friday', 'La marea opera de lunes a viernes'),
          dos('On weekends volume drops by roughly 40% to 60%', 'En fin de semana el volumen baja ~40% a 60%'),
          dos('Weekend breaks reverse frequently', 'Las rupturas de fin de semana revierten con frecuencia')
        ]
      });
    } else if (MA.lateral) {
      const porADX = MA.motivoLateral !== 'banda';
      msgs.push({
        tipo: 'aviso', p: N.precio, prioridad: 6,
        titulo: elegir([
          dos('Range market', 'Mercado en rango'),
          dos('No defined cycle', 'Sin ciclo definido'),
          dos('Tide waiting', 'Marea en espera')
        ]),
        txt: porADX
          ? elegir([
              dos(`There is no measurable trend strength: ADX is at ${MA.panel.adx.toFixed(0)}, below 20. Price drifts back and forth and any turn is noise.`,
                  `No hay fuerza de tendencia medible: el ADX está en ${MA.panel.adx.toFixed(0)}, por debajo de 20. El precio va y viene y cualquier giro es ruido.`),
              dos('Price has no clear direction. Here a change of color means nothing.',
                  'El precio no tiene dirección clara. Aquí un cambio de color no significa nada.'),
              dos('There is no cycle to follow: price is ranging and signals here fail.',
                  'No hay ciclo que seguir: el precio está en rango y las señales aquí fallan.')
            ])
          : elegir([
              dos(`Price has run out of room: the recent band is only ${MA.anchoAhora.toFixed(1)}%. Even if it came from a strong leg, it is flat now and no signal is worth taking.`,
                  `El precio se quedó sin recorrido: la banda reciente es de solo ${MA.anchoAhora.toFixed(1)}%. Aunque venga de una pierna fuerte, ahora está plano y ninguna señal vale.`),
              dos(`No range in the last candles (band ${MA.anchoAhora.toFixed(1)}%). Tide waits for price to start moving again.`,
                  `Sin recorrido en las últimas velas (banda ${MA.anchoAhora.toFixed(1)}%). La marea espera a que el precio vuelva a moverse.`),
              dos('The move has stalled. Until there is range again, do not trade.',
                  'El movimiento se estancó. Hasta que no haya recorrido otra vez, no operes.')
            ]),
        hacer: elegir([
          dos('Wait for price to break out with volume. That is when a signal is worth taking.',
              'Espera a que el precio rompa con volumen. Ahí sí vale la pena tomar una señal.'),
          dos('In a range, what pays is trading the edges, not following a trend.',
              'En rango, lo que paga es operar los bordes, no seguir una tendencia.'),
          dos('Tide speaks again when there is a move with range.',
              'La marea vuelve a hablar cuando hay movimiento con recorrido.')
        ]),
        detalle: [
          dos(`Trend strength (ADX): ${MA.panel.adx.toFixed(0)} · tradable from 20`, `Fuerza de tendencia (ADX): ${MA.panel.adx.toFixed(0)} · operable desde 20`),
          dos(`Recent band: ${MA.anchoAhora.toFixed(2)}% · tradable from 2%`, `Banda reciente: ${MA.anchoAhora.toFixed(2)}% · operable desde 2%`),
          dos('Cycle signals without range perform the worst', 'Las señales de ciclo sin recorrido son las que peor rinden')
        ]
      });
    } else if (MA.ultima && MA.velasDesde != null && MA.velasDesde < 25) {
      const sg = MA.ultima;
      const alc = sg.dir === 'compra';
      msgs.push({
        tipo: alc ? 'compra' : 'venta', p: sg.precio, prioridad: 10,
        iAncla: sg.i,
        titulo: elegir([
          dos(alc ? 'Tide flagged LONG' : 'Tide flagged SHORT', alc ? 'La marea marcó LARGO' : 'La marea marcó CORTO'),
          dos(alc ? 'The tide turned to buyers' : 'The tide turned to sellers', alc ? 'La marea giró a compradores' : 'La marea giró a vendedores'),
          dos('Cycle change confirmed', 'Cambio de ciclo confirmado')
        ]),
        txt: elegir([
          dos(`The cycle changed hands at ${fmt(sg.precio)}, ${MA.velasDesde} ${MA.velasDesde === 1 ? 'candle' : 'candles'} ago. The Heikin Ashi turn was confirmed by a structure break, volume and real trend strength.`,
              `El ciclo cambió de manos en ${fmt(sg.precio)}, hace ${MA.velasDesde} ${MA.velasDesde === 1 ? 'vela' : 'velas'}. El giro Heikin Ashi se confirmó con ruptura de estructura, volumen y fuerza de tendencia real.`),
          dos(`There was a confirmed turn at ${fmt(sg.precio)}: the market tide flipped and the next candle confirmed it, so it does not repaint.`,
              `Hubo un giro confirmado en ${fmt(sg.precio)}: la marea del mercado se volteó y la vela siguiente lo confirmó, así que no repinta.`),
          dos(`Tide caught the change at ${fmt(sg.precio)}. Not just any cross: it passed every filter (strength, volume and break).`,
              `La marea atrapó el cambio en ${fmt(sg.precio)}. No un cruce cualquiera: pasó todos los filtros (fuerza, volumen y ruptura).`)
        ]),
        hacer: alc
          ? elegir([
              dos('Buyers took control. Look for entries on pullbacks, do not chase price up here.',
                  'Los compradores tomaron el control. Busca entradas en los retrocesos, no persigas el precio aquí arriba.'),
              dos('Trade with it while the tide stays on the buy side.',
                  'Opera a favor mientras la marea siga del lado comprador.'),
              dos('Keep the long bias until the tide changes again.',
                  'Mantén el sesgo largo hasta que la marea vuelva a cambiar.')
            ])
          : elegir([
              dos('Sellers took control. Look for sells on bounces, do not chase the drop.',
                  'Los vendedores tomaron el control. Busca ventas en los rebotes, no persigas la caída.'),
              dos('Trade with it while the tide stays on the sell side.',
                  'Opera a favor mientras la marea siga del lado vendedor.'),
              dos('Keep the short bias until the tide changes again.',
                  'Mantén el sesgo corto hasta que la marea vuelva a cambiar.')
            ]),
        detalle: [
          dos(`Signal at ${fmt(sg.precio)}`, `Señal en ${fmt(sg.precio)}`),
          dos(`Trend strength (ADX): ${sg.adx.toFixed(0)}`, `Fuerza de tendencia (ADX): ${sg.adx.toFixed(0)}`),
          dos(`Confirmations met: ${sg.cumplidos} of 5`, `Confirmaciones cumplidas: ${sg.cumplidos} de 5`),
          dos('Heikin Ashi turn confirmed by the next candle (no repaint)', 'Giro Heikin Ashi confirmado por la vela siguiente (no repinta)'),
          dos(`Signals discarded by the filters: ${MA.señales.length - MA.validas.length}`, `Señales descartadas por los filtros: ${MA.señales.length - MA.validas.length}`)
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
        dos(alc ? 'Bullish trendline' : 'Bearish trendline', alc ? 'Línea de tendencia alcista' : 'Línea de tendencia bajista'),
        dos(alc ? 'Price rising with support' : 'Price falling with a ceiling', alc ? 'El precio sube con soporte' : 'El precio baja con techo'),
        dos('Trendline drawn', 'Línea de tendencia trazada')
      ]),
      txt: elegir([
        dos(`I drew the line joining the last ${N.linea.pts.length} ${alc ? 'lows' : 'highs'} on the ${tf}. It fits at ${ajuste}%, so it is a reliable guide while price respects it.`,
            `Tracé la línea uniendo los últimos ${N.linea.pts.length} ${alc ? 'mínimos' : 'máximos'} en ${tf}. Ajusta al ${ajuste}%, así que es una guía fiable mientras el precio la respete.`),
        dos(`The ${alc ? 'lows' : 'highs'} line up into a straight line with a ${ajuste}% fit. That line is the reference for the ${alc ? 'uptrend' : 'downtrend'}.`,
            `Los ${alc ? 'mínimos' : 'máximos'} se alinean en una recta con un ajuste del ${ajuste}%. Esa línea es la referencia de la tendencia ${alc ? 'alcista' : 'bajista'}.`),
        dos(`${alc ? 'Bullish' : 'Bearish'} trendline drawn over ${N.linea.pts.length} points, with a ${ajuste}% fit.`,
            `Línea de tendencia ${alc ? 'alcista' : 'bajista'} trazada sobre ${N.linea.pts.length} puntos, con un ajuste del ${ajuste}%.`)
      ]),
      hacer: elegir([
        dos(alc ? 'While price does not close below the line, the trend is alive. Buys at touches of the line are the lower-risk ones.'
                : 'While price does not close above the line, the drop continues. Sells at touches of the line are the lower-risk ones.',
            alc ? 'Mientras el precio no cierre por debajo de la línea, la tendencia sigue viva. Las compras en los toques de la línea son las de menor riesgo.'
                : 'Mientras el precio no cierre por encima de la línea, la caída continúa. Las ventas en los toques de la línea son las de menor riesgo.'),
        dos(alc ? 'Buy on the touches of the line, not mid-leg. If it is lost with a close, the trend is over.'
                : 'Sell on the rejections against the line. If it breaks with a close, the drop is over.',
            alc ? 'Compra en los toques de la línea, no a media pierna. Si se pierde con un cierre, la tendencia terminó.'
                : 'Vende en los rechazos contra la línea. Si rompe con un cierre, la caída terminó.'),
        dos('Use the line as a filter: trade only with it while it holds, and step aside if price closes through it.',
            'Usa la línea como filtro: opera solo a favor mientras aguante, y hazte a un lado si el precio la cierra.')
      ]),
      detalle: [
        dos(`Drawn over ${N.linea.pts.length} real pivots`, `Trazada sobre ${N.linea.pts.length} pivotes reales`),
        dos(`Statistical fit (R²): ${ajuste}%`, `Ajuste estadístico (R²): ${ajuste}%`),
        dos('Invalidated by a close on the other side, not a wick', 'Invalidada por un cierre al otro lado, no por una mecha'),
        dos(`Direction: ${alc ? 'bullish' : 'bearish'}`, `Dirección: ${alc ? 'alcista' : 'bajista'}`)
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
        dos(suelo ? 'Double bottom' : 'Double top', suelo ? 'Doble suelo' : 'Doble techo'),
        dos(suelo ? 'Floor tested twice' : 'Ceiling rejected twice', suelo ? 'Suelo probado dos veces' : 'Techo rechazado dos veces'),
        dos(d.confirmado ? (suelo ? 'Double bottom confirmed' : 'Double top confirmed') : (suelo ? 'Double bottom forming' : 'Double top forming'),
            d.confirmado ? (suelo ? 'Doble suelo confirmado' : 'Doble techo confirmado') : (suelo ? 'Doble suelo formándose' : 'Doble techo formándose'))
      ]),
      txt: elegir([
        dos(`Price made two nearly equal ${suelo ? 'lows' : 'highs'} at ${fmt(d.nivel)}. ${d.confirmado ? `It already broke the neckline at ${fmt(d.cuello)}, so the pattern is confirmed.` : `It still needs to break the neckline at ${fmt(d.cuello)} to confirm.`}`,
            `El precio hizo dos ${suelo ? 'mínimos' : 'máximos'} casi iguales en ${fmt(d.nivel)}. ${d.confirmado ? `Ya rompió el cuello en ${fmt(d.cuello)}, así que el patrón está confirmado.` : `Todavía necesita romper el cuello en ${fmt(d.cuello)} para confirmar.`}`),
        dos(`Two ${suelo ? 'bottoms' : 'tops'} at ${fmt(d.nivel)} and a neckline at ${fmt(d.cuello)}. ${d.confirmado ? 'Confirmed.' : 'Not confirmed yet.'}`,
            `Dos ${suelo ? 'suelos' : 'techos'} en ${fmt(d.nivel)} y un cuello en ${fmt(d.cuello)}. ${d.confirmado ? 'Confirmado.' : 'Aún sin confirmar.'}`),
        dos(`${suelo ? 'Double bottom' : 'Double top'} pattern formed at ${fmt(d.nivel)}. ${d.confirmado ? 'The neckline has given way.' : 'Waiting for the neckline to give way.'}`,
            `Patrón de ${suelo ? 'doble suelo' : 'doble techo'} formado en ${fmt(d.nivel)}. ${d.confirmado ? 'El cuello ya cedió.' : 'A la espera de que ceda el cuello.'}`)
      ]),
      hacer: d.confirmado
        ? elegir([
            dos(`Pattern target: ${fmt(d.objetivo)}, the height projected from the neckline. Stop ${suelo ? 'below' : 'above'} ${fmt(d.nivel)}.`,
                `Objetivo del patrón: ${fmt(d.objetivo)}, la altura proyectada desde el cuello. Stop ${suelo ? 'debajo de' : 'encima de'} ${fmt(d.nivel)}.`),
            dos(`Entry after the confirmation, with a target at ${fmt(d.objetivo)} and a stop on the other side of ${fmt(d.nivel)}.`,
                `Entrada tras la confirmación, con objetivo en ${fmt(d.objetivo)} y stop al otro lado de ${fmt(d.nivel)}.`),
            dos(`Pattern active. Projection to ${fmt(d.objetivo)}; invalidated if it returns to ${fmt(d.nivel)}.`,
                `Patrón activo. Proyección a ${fmt(d.objetivo)}; invalidado si vuelve a ${fmt(d.nivel)}.`)
          ])
        : elegir([
            dos(`Do not enter yet. The pattern only counts when price closes ${suelo ? 'above' : 'below'} the neckline at ${fmt(d.cuello)}.`,
                `No entres aún. El patrón solo cuenta cuando el precio cierra ${suelo ? 'por encima' : 'por debajo'} del cuello en ${fmt(d.cuello)}.`),
            dos(`Wait for the close beyond ${fmt(d.cuello)}. Without it there is no pattern: just two touches.`,
                `Espera el cierre más allá de ${fmt(d.cuello)}. Sin eso no hay patrón: solo dos toques.`),
            dos(`Mark ${fmt(d.cuello)} and wait. Jumping ahead of the confirmation is the most common mistake with this pattern.`,
                `Marca ${fmt(d.cuello)} y espera. Adelantarse a la confirmación es el error más común con este patrón.`)
          ]),
      detalle: [
        dos(`Pattern level: ${fmt(d.nivel)}`, `Nivel del patrón: ${fmt(d.nivel)}`),
        dos(`Neckline: ${fmt(d.cuello)}`, `Cuello: ${fmt(d.cuello)}`),
        dos(`Projected target: ${fmt(d.objetivo)}`, `Objetivo proyectado: ${fmt(d.objetivo)}`),
        dos(`State: ${d.confirmado ? 'confirmed by close' : 'pending confirmation'}`, `Estado: ${d.confirmado ? 'confirmado por cierre' : 'pendiente de confirmación'}`),
        dos('Only the body close counts, not the wicks', 'Solo cuenta el cierre de cuerpo, no las mechas')
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
      titulo: elegir([
        dos('Range market', 'Mercado en rango'),
        dos('No clear direction', 'Sin dirección clara'),
        dos('Price is trapped', 'El precio está atrapado')
      ]),
      txt: elegir([
        dos(`${par} has spent ${Math.round(N.rango.pctDentro)}% of the time inside a ${N.rango.amplitud.toFixed(1)}% band on the ${tf}. There is no trend to follow.`,
            `${par} pasó el ${Math.round(N.rango.pctDentro)}% del tiempo dentro de una banda del ${N.rango.amplitud.toFixed(1)}% en ${tf}. No hay tendencia que seguir.`),
        dos(`Price swings between ${fmt(N.rango.bajo)} and ${fmt(N.rango.alto)} without committing. Width of only ${N.rango.amplitud.toFixed(1)}%.`,
            `El precio oscila entre ${fmt(N.rango.bajo)} y ${fmt(N.rango.alto)} sin decidirse. Amplitud de solo ${N.rango.amplitud.toFixed(1)}%.`),
        dos(`Narrow ${N.rango.amplitud.toFixed(1)}% band: price has gone nowhere over the last ${Math.min(50, v.length)} candles.`,
            `Banda estrecha del ${N.rango.amplitud.toFixed(1)}%: el precio no ha ido a ningún lado en las últimas ${Math.min(50, v.length)} velas.`)
      ]),
      hacer: elegir([
        dos('In a range, trend entries fail. Wait for the band to break, or look for another coin with a defined direction.',
            'En rango, las entradas de tendencia fallan. Espera a que rompa la banda, o busca otra moneda con dirección definida.'),
        dos('Do not force an entry here. Either wait for the range to break, or switch coin: some markets are clearer right now.',
            'No fuerces una entrada aquí. O esperas a que rompa el rango, o cambias de moneda: hay mercados más claros ahora mismo.'),
        dos('What pays in a range is buying the low and selling the high of the band, with little room. If you want a trend, this is not the coin.',
            'Lo que paga en rango es comprar el mínimo y vender el máximo de la banda, con poco recorrido. Si quieres tendencia, esta no es la moneda.')
      ]),
      detalle: [
        dos(`Band ceiling: ${fmt(N.rango.alto)}`, `Techo de la banda: ${fmt(N.rango.alto)}`),
        dos(`Band floor: ${fmt(N.rango.bajo)}`, `Suelo de la banda: ${fmt(N.rango.bajo)}`),
        dos(`Price closed inside the central zone in ${Math.round(N.rango.pctDentro)}% of the candles`, `El precio cerró dentro de la zona central en el ${Math.round(N.rango.pctDentro)}% de las velas`),
        dos('A band under 6% is considered a range for this timeframe', 'Una banda de menos del 6% se considera rango para esta temporalidad')
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
          ? elegir([dos('Buy zone', 'Zona de compra'), dos('Support with the trend', 'Soporte a favor de la tendencia'), dos('Entry to the upside', 'Entrada al alza')])
          : elegir([dos('Support nearby', 'Soporte cercano'), dos('Level that already held', 'Nivel que ya aguantó'), dos('Reaction zone', 'Zona de reacción')]),
        txt: elegir([
          dos(`Support at ${fmt(sCerca.p)} that price respected ${sCerca.toques} times. It is ${d.toFixed(2)}% below.`,
              `Soporte en ${fmt(sCerca.p)} que el precio respetó ${sCerca.toques} veces. Está un ${d.toFixed(2)}% más abajo.`),
          dos(`Price turned ${sCerca.toques} times at ${fmt(sCerca.p)}. Now it is approaching again: ${d.toFixed(2)}% to go.`,
              `El precio giró ${sCerca.toques} veces en ${fmt(sCerca.p)}. Ahora se acerca de nuevo: faltan ${d.toFixed(2)}%.`),
          dos(`${fmt(sCerca.p)} has stopped the drop ${sCerca.toques} times. Price is about ${d.toFixed(2)}% away.`,
              `${fmt(sCerca.p)} ha frenado la caída ${sCerca.toques} veces. El precio está a ~${d.toFixed(2)}%.`)
        ]),
        hacer: alcista
          ? elegir([
              dos(`With the uptrend and this support nearby, an entry at ${fmt(sCerca.p)} has the structure behind it. Stop below ${fmt(stop)}.`,
                  `Con la tendencia alcista y este soporte cerca, una entrada en ${fmt(sCerca.p)} tiene la estructura a favor. Stop debajo de ${fmt(stop)}.`),
              dos(`Buy at ${fmt(sCerca.p)} with a stop at ${fmt(stop)}. The trend helps and the level has ${sCerca.toques} touches behind it.`,
                  `Compra en ${fmt(sCerca.p)} con stop en ${fmt(stop)}. La tendencia ayuda y el nivel tiene ${sCerca.toques} toques detrás.`),
              dos(`If price reaches ${fmt(sCerca.p)} and reacts, it is an entry. Protect below ${fmt(stop)}${rCerca ? ` and look for an exit toward ${fmt(rCerca.p)}` : ''}.`,
                  `Si el precio llega a ${fmt(sCerca.p)} y reacciona, es entrada. Protege debajo de ${fmt(stop)}${rCerca ? ` y busca salida hacia ${fmt(rCerca.p)}` : ''}.`)
            ])
          : elegir([
              dos(`The trend does not help, so it is not a clear buy. If price loses ${fmt(sCerca.p)}, the way down opens up.`,
                  `La tendencia no ayuda, así que no es compra clara. Si el precio pierde ${fmt(sCerca.p)}, se abre el camino abajo.`),
              dos('Careful: the level is real but the trend is against it. Wait for confirmation before buying here.',
                  'Cuidado: el nivel es real pero la tendencia está en contra. Espera confirmación antes de comprar aquí.'),
              dos(`Watch ${fmt(sCerca.p)}. If it holds there could be a bounce, but against the trend the risk is higher.`,
                  `Vigila ${fmt(sCerca.p)}. Si aguanta podría haber rebote, pero contra la tendencia el riesgo es mayor.`)
            ]),
        detalle: [
          dos(`Confirmed touches: ${sCerca.toques}`, `Toques confirmados: ${sCerca.toques}`),
          dos(`Volume traded in the zone: ${sCerca.volPct.toFixed(1)}% of the total`, `Volumen operado en la zona: ${sCerca.volPct.toFixed(1)}% del total`),
          dos(`Level strength: ${sCerca.fuerza}/100`, `Fuerza del nivel: ${sCerca.fuerza}/100`),
          dos(`Current trend: ${nombreTend(N.tendencia.dir)}`, `Tendencia actual: ${nombreTendEs(N.tendencia.dir)}`),
          dos(`Suggested stop: ${fmt(stop)} (0.6% below the level)`, `Stop sugerido: ${fmt(stop)} (0.6% debajo del nivel)`)
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
          ? elegir([dos('Sell zone', 'Zona de venta'), dos('Resistance with the trend', 'Resistencia a favor de la tendencia'), dos('Entry to the downside', 'Entrada a la baja')])
          : elegir([dos('Resistance nearby', 'Resistencia cercana'), dos('Ceiling that already rejected', 'Techo que ya rechazó'), dos('Rejection zone', 'Zona de rechazo')]),
        txt: elegir([
          dos(`Resistance at ${fmt(rCerca.p)} that rejected price ${rCerca.toques} times. It is ${d.toFixed(2)}% away.`,
              `Resistencia en ${fmt(rCerca.p)} que rechazó el precio ${rCerca.toques} veces. Está a ${d.toFixed(2)}%.`),
          dos(`Price turned down ${rCerca.toques} times at ${fmt(rCerca.p)}. It is approaching again.`,
              `El precio giró a la baja ${rCerca.toques} veces en ${fmt(rCerca.p)}. Se acerca de nuevo.`),
          dos(`${fmt(rCerca.p)} has stopped ${rCerca.toques} rallies. About ${d.toFixed(2)}% to reach it.`,
              `${fmt(rCerca.p)} ha frenado ${rCerca.toques} subidas. Faltan ~${d.toFixed(2)}% para llegar.`)
        ]),
        hacer: bajista
          ? elegir([
              dos(`With a downtrend, selling at ${fmt(rCerca.p)} has the structure behind it. Stop above ${fmt(rCerca.p * 1.006)}.`,
                  `Con tendencia bajista, vender en ${fmt(rCerca.p)} tiene la estructura a favor. Stop encima de ${fmt(rCerca.p * 1.006)}.`),
              dos(`If price rises to ${fmt(rCerca.p)} and stalls, it is a short entry. Protect above ${fmt(rCerca.p * 1.006)}.`,
                  `Si el precio sube a ${fmt(rCerca.p)} y se frena, es entrada corta. Protege encima de ${fmt(rCerca.p * 1.006)}.`),
              dos(`Sell zone at ${fmt(rCerca.p)}. The trend helps and the level has ${rCerca.toques} rejections.`,
                  `Zona de venta en ${fmt(rCerca.p)}. La tendencia ayuda y el nivel tiene ${rCerca.toques} rechazos.`)
            ])
          : elegir([
              dos(`If you are long, consider taking profit before ${fmt(rCerca.p)}. That is where price has stalled before.`,
                  `Si estás largo, piensa en tomar ganancia antes de ${fmt(rCerca.p)}. Ahí es donde el precio se ha frenado antes.`),
              dos(`${fmt(rCerca.p)} is the obstacle. If it breaks with volume, the way up opens; if not, wait for a rejection.`,
                  `${fmt(rCerca.p)} es el obstáculo. Si rompe con volumen, se abre el camino arriba; si no, espera un rechazo.`),
              dos('Do not buy just under this resistance. Wait for it to break, or for a bounce from lower.',
                  'No compres justo debajo de esta resistencia. Espera a que rompa, o un rebote desde más abajo.')
            ]),
        detalle: [
          dos(`Confirmed rejections: ${rCerca.toques}`, `Rechazos confirmados: ${rCerca.toques}`),
          dos(`Volume traded in the zone: ${rCerca.volPct.toFixed(1)}% of the total`, `Volumen operado en la zona: ${rCerca.volPct.toFixed(1)}% del total`),
          dos(`Level strength: ${rCerca.fuerza}/100`, `Fuerza del nivel: ${rCerca.fuerza}/100`),
          dos(`Current trend: ${nombreTend(N.tendencia.dir)}`, `Tendencia actual: ${nombreTendEs(N.tendencia.dir)}`)
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
      titulo: elegir([
        dos('No clear entry', 'Sin entrada clara'),
        dos('Price is in the middle', 'El precio está en medio'),
        dos('Nothing to do now', 'Nada que hacer ahora')
      ]),
      txt: elegir([
        dos(`${par} is not near any important level. ${haciaS ? `The nearest support is ${haciaS.toFixed(1)}% away` : 'No nearby support'}${haciaR ? ` and resistance is ${haciaR.toFixed(1)}% away` : ''}.`,
            `${par} no está cerca de ningún nivel importante. ${haciaS ? `El soporte más cercano está a ${haciaS.toFixed(1)}%` : 'Sin soporte cerca'}${haciaR ? ` y la resistencia a ${haciaR.toFixed(1)}%` : ''}.`),
        dos('Price is drifting between levels, tagging none. Entering here is entering blind.',
            'El precio deambula entre niveles sin tocar ninguno. Entrar aquí es entrar a ciegas.'),
        dos('There is no confluence right now: price is far from the zones where it has reacted before.',
            'Ahora mismo no hay confluencia: el precio está lejos de las zonas donde ha reaccionado antes.')
      ]),
      hacer: elegir([
        dos('Wait. The best entries come when price reaches a tested level, not mid-way.',
            'Espera. Las mejores entradas llegan cuando el precio alcanza un nivel probado, no a medio camino.'),
        dos('With no level nearby there is nowhere to place a stop with logic. Better to wait until price approaches a zone.',
            'Sin un nivel cerca no hay dónde poner un stop con lógica. Mejor esperar a que el precio se acerque a una zona.'),
        dos('Patience: entering without a reference is what costs the most. Let price come to a level.',
            'Paciencia: entrar sin referencia es lo que más cuesta. Deja que el precio llegue a un nivel.')
      ]),
      detalle: [
        haciaS ? dos(`Nearest support: ${fmt(sCerca.p)} (${haciaS.toFixed(2)}% below)`, `Soporte más cercano: ${fmt(sCerca.p)} (${haciaS.toFixed(2)}% abajo)`) : dos('No support in the analyzed range', 'Sin soporte en el rango analizado'),
        haciaR ? dos(`Nearest resistance: ${fmt(rCerca.p)} (${haciaR.toFixed(2)}% above)`, `Resistencia más cercana: ${fmt(rCerca.p)} (${haciaR.toFixed(2)}% arriba)`) : dos('No resistance in the analyzed range', 'Sin resistencia en el rango analizado'),
        dos(`Trend: ${nombreTend(N.tendencia.dir)}`, `Tendencia: ${nombreTendEs(N.tendencia.dir)}`),
        dos(`Valid levels detected: ${N.niveles.length}`, `Niveles válidos detectados: ${N.niveles.length}`)
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
        ? elegir([dos('Uptrend', 'Tendencia alcista'), dos('Structure to the upside', 'Estructura al alza'), dos('Higher highs, higher lows', 'Máximos y mínimos crecientes')])
        : elegir([dos('Downtrend', 'Tendencia bajista'), dos('Structure to the downside', 'Estructura a la baja'), dos('Lower highs, lower lows', 'Máximos y mínimos decrecientes')]),
      txt: elegir([
        dos(alc ? `Higher highs and higher lows over the last candles on the ${tf}. A ${N.tendencia.mov.toFixed(1)}% move on this leg.`
                : `Lower highs and lower lows on the ${tf}. A ${N.tendencia.mov.toFixed(1)}% move on this leg.`,
            alc ? `Máximos y mínimos crecientes en las últimas velas del ${tf}. Un movimiento del ${N.tendencia.mov.toFixed(1)}% en esta pierna.`
                : `Máximos y mínimos decrecientes en el ${tf}. Un movimiento del ${N.tendencia.mov.toFixed(1)}% en esta pierna.`),
        dos(alc ? 'The structure is bullish: each pullback has made a higher low than the previous one.'
                : 'The structure is bearish: each bounce has stayed lower than the previous one.',
            alc ? 'La estructura es alcista: cada retroceso hizo un mínimo más alto que el anterior.'
                : 'La estructura es bajista: cada rebote se quedó más abajo que el anterior.'),
        dos(alc ? `Price is building steps to the upside. It has ${N.tendencia.mov.toFixed(1)}% on this leg.`
                : `Price is building steps to the downside. It has ${N.tendencia.mov.toFixed(1)}% on this leg.`,
            alc ? `El precio construye escalones al alza. Lleva ${N.tendencia.mov.toFixed(1)}% en esta pierna.`
                : `El precio construye escalones a la baja. Lleva ${N.tendencia.mov.toFixed(1)}% en esta pierna.`)
      ]),
      hacer: alc
        ? elegir([
            dos('Trade with it: look for buys on pullbacks to support, do not sell against the trend.',
                'Opera a favor: busca compras en los retrocesos a soporte, no vendas contra la tendencia.'),
            dos('Buys at supports have the edge here. Shorting goes against the current.',
                'Las compras en soportes tienen la ventaja aquí. Ponerse corto es ir contra corriente.'),
            dos('Prioritize long entries on pullbacks. The trend is your ally while the lows keep rising.',
                'Prioriza entradas largas en los retrocesos. La tendencia es tu aliada mientras los mínimos sigan subiendo.')
          ])
        : elegir([
            dos('Trade with it: look for sells on bounces to resistance, do not buy against the trend.',
                'Opera a favor: busca ventas en los rebotes a resistencia, no compres contra la tendencia.'),
            dos('Sells at resistance have the edge here. Buying goes against the current.',
                'Las ventas en resistencia tienen la ventaja aquí. Comprar es ir contra corriente.'),
            dos('Prioritize short entries on bounces. The trend rules while the highs keep falling.',
                'Prioriza entradas cortas en los rebotes. La tendencia manda mientras los máximos sigan cayendo.')
          ]),
      detalle: [
        dos(`Direction: ${nombreTend(N.tendencia.dir)}`, `Dirección: ${nombreTendEs(N.tendencia.dir)}`),
        dos(`Leg move: ${N.tendencia.mov.toFixed(2)}%`, `Movimiento de la pierna: ${N.tendencia.mov.toFixed(2)}%`),
        dos('Measured by the structure of highs and lows, not by indicators', 'Medido por la estructura de máximos y mínimos, no por indicadores'),
        dos(`Valid supports: ${soportes.length} · resistances: ${resist.length}`, `Soportes válidos: ${soportes.length} · resistencias: ${resist.length}`)
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
    const tV = arriba ? arriba.titulo : dos('a sell', 'una venta');
    const tC = abajo ? abajo.titulo : dos('a buy', 'una compra');
    principal = {
      tipo: 'aviso', p: N.precio, prioridad: 99, esPlan: true,
      titulo: elegir([
        dos('Signals at odds', 'Señales enfrentadas'),
        dos('The market cannot decide', 'El mercado no se decide'),
        dos('No clear direction', 'Sin dirección clara')
      ]),
      txt: elegir([
        dos(`I found arguments for both sides: ${tC.en.toLowerCase()} below and ${tV.en.toLowerCase()} above. When the structure contradicts itself, the likely path is that price stays undecided.`,
            `Encontré argumentos para los dos lados: ${tC.es.toLowerCase()} abajo y ${tV.es.toLowerCase()} arriba. Cuando la estructura se contradice, lo probable es que el precio siga indeciso.`),
        dos('There are conflicting signals on this timeframe. Neither buyers nor sellers are clearly in control right now.',
            'Hay señales en conflicto en esta temporalidad. Ni compradores ni vendedores tienen el control claro ahora mismo.'),
        dos(`The read is split: ${Math.round(votoC)} of bullish weight against ${Math.round(votoV)} bearish. Too even to trade with an edge.`,
            `La lectura está dividida: ${Math.round(votoC)} de peso alcista contra ${Math.round(votoV)} bajista. Demasiado parejo para operar con ventaja.`)
      ]),
      hacer: elegir([
        dos('Do not trade this coin now. Wait for one of the two forces to win with a clean close, or switch to a timeframe where the read is clean.',
            'No operes esta moneda ahora. Espera a que una de las dos fuerzas gane con un cierre limpio, o cambia a una temporalidad donde la lectura sea clara.'),
        dos('When signals contradict each other, what pays is staying out. Come back when there is a defined direction.',
            'Cuando las señales se contradicen, lo que paga es quedarse fuera. Vuelve cuando haya una dirección definida.'),
        dos('Move up a timeframe to see who is really in control, or find another coin with clear structure.',
            'Sube una temporalidad para ver quién manda de verdad, o busca otra moneda con estructura clara.')
      ]),
      detalle: [
        dos(`Bullish weight: ${Math.round(votoC)}`, `Peso alcista: ${Math.round(votoC)}`),
        dos(`Bearish weight: ${Math.round(votoV)}`, `Peso bajista: ${Math.round(votoV)}`),
        dos('Difference too small to give a direction', 'Diferencia demasiado pequeña para dar una dirección'),
        dos(`Readings analyzed: ${msgs.length}`, `Lecturas analizadas: ${msgs.length}`),
        dos('Recommendation: wait for definition or switch coin', 'Recomendación: esperar definición o cambiar de moneda')
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
          dos(`Entry: ${fmt(plan.entrada)}`, `Entrada: ${fmt(plan.entrada)}`),
          dos(`Stop: ${fmt(plan.stop)} (${plan.riesgoPct.toFixed(2)}% risk)`, `Stop: ${fmt(plan.stop)} (${plan.riesgoPct.toFixed(2)}% de riesgo)`),
          dos(`Target 1: ${fmt(plan.obj[0].p)} · secures the trade`, `Objetivo 1: ${fmt(plan.obj[0].p)} · asegura el trade`),
          dos(`Target 2: ${fmt(plan.obj[1].p)} · the main one, 2R`, `Objetivo 2: ${fmt(plan.obj[1].p)} · el principal, 2R`),
          dos(`Target 3: ${fmt(plan.obj[2].p)} · if the move keeps going`, `Objetivo 3: ${fmt(plan.obj[2].p)} · si el movimiento sigue`),
          dos(`Stop set to 1.2x the average volatility (${fmt(N.atr)})`, `Stop fijado a 1.2x la volatilidad media (${fmt(N.atr)})`),
          ...(principal.detalle || [])
        ];
      }
    }
    principal.detalle = [
      dos(`Plan confidence: ${Math.round(conf * 100)}% of the total weight`, `Confianza del plan: ${Math.round(conf * 100)}% del peso total`),
      ...(principal.detalle || [])
    ];
  }

  const apoyo = msgs
    .filter((m) => m !== principal && m.titulo !== principal.titulo)
    .slice(0, 2)
    .map((m) => ({ ...m, esApoyo: true, tipo: m.tipo === lado ? m.tipo : 'contexto' }));

  return [principal, ...apoyo];
}
