/* gridbot/config.js — Constantes estáticas de la app de bots.
   Datos que no cambian: id del contenedor, listas de monedas base y quote. */

export const APP = 'colmena-app';
export const QUOTES = ['USDT', 'USDC'];
export const BASES = ['BNB', 'BTCB', 'ETH', 'SOL', 'XRP', 'ADA', 'DOT', 'LTC', 'AVAX', 'MATIC', 'ATOM', 'NEAR', 'FIL', 'BCH', 'ETC', 'EOS', 'LINK', 'CAKE', 'UNI', 'AAVE', 'XVS', 'INJ', 'TWT', 'DOGE', 'SHIB', 'FLOKI'];

/* ── Constantes de datos movidas desde gridbot-ui.js ── */
export const INFO = {
  par: 'Elige qué moneda quieres comprar y vender, y contra cuál (lo normal es una estable como USDT). El bot comprará barato y venderá caro entre esas dos, solo.',
  rango: 'El precio más bajo y el más alto donde quieres que el bot trabaje. Para que funcione, el precio de ahora debe quedar DENTRO del rango. ¿No sabes qué poner? Dale a "Sugerir".',
  cuadriculas: 'En cuántos escalones parte el rango. Más cuadrículas = muchas operaciones pequeñas y seguidas. Menos = operaciones más grandes y espaciadas.',
  inversion: 'Cuánto dinero pones a trabajar. El bot lo reparte entre las cuadrículas para ir comprando por partes cuando el precio baja.',
  proteccion: 'Cuánta diferencia de precio aceptas al operar. Si el precio salta más que esto justo al operar, el bot no opera para no comprarte caro. Si no sabes, deja 1%.',
  ritmo: 'Tiempo mínimo entre una operación y otra. Déjalo en 0 y operará cada vez que pueda.',
  reparto: 'Cuántas cuadrículas quedan por ENCIMA de tu precio de entrada (que se venden) y cuántas por DEBAJO (que compran). El bot compra a mercado el inventario de las de arriba al encender, y deja las de abajo esperando bajadas. El reparto del dinero es proporcional a cada lado, no mitad y mitad.',
  separacion: 'La distancia, en porcentaje, entre una cuadrícula y la siguiente. Es igual en todas (por eso el bot compra y vende parejo). La calcula el sistema con tu rango y tu número de cuadrículas: más cuadrículas = menos distancia; más rango = más distancia.',
  estrategia: 'Configuraciones listas según lo que buscas. "Tranquilo": rango amplio y pocas cuadrículas grandes — opera menos pero cada operación rinde y aguanta meses sin salirse; ideal con poco capital. "Equilibrado": punto medio. "Activo": rango más ceñido y más cuadrículas — opera más seguido, pero necesita más capital para que cada cuadrícula sea rentable. Puedes ajustar el rango a mano después.',
  asesor: 'Estimación aproximada de cuántas operaciones haría el bot al día y cuánto rendiría al mes, según la volatilidad típica de la moneda. NO es una promesa: si el mercado se mueve más, gana más; si se queda quieto, gana menos. Sirve para comparar configuraciones entre sí.',
  tp: 'Opcional. Si el precio sube hasta aquí, el bot vende todo y termina, dejándote la ganancia.',
  sl: 'Opcional. Si el precio baja hasta aquí, el bot vende todo para no seguir perdiendo. Un freno de emergencia.',
  gas: 'La red cobra unos centavos por cada operación (el "gas", no es nuestra comisión). Deja aquí ~2 USD en BNB y el bot se encarga solo. Es tuyo: lo retiras cuando quieras.',
  ganancia: 'Lo que ya ganaste de verdad, con la comisión y el gas descontados. Es dinero que ya está en tu wallet.',
  porcuad: 'Lo que ganas cada vez que el bot completa una vuelta (compra abajo y vende arriba), ya con la comisión descontada.',
  margenmodo: 'Cuando fijas "Ganancia por cuadrícula", elige qué prioriza el sistema. "Ajustar cuadrículas": mantiene tu rango y calcula cuántas cuadrículas caben. "Ampliar rango": mantiene tu número de cuadrículas y te ofrece ampliar el rango (el bot será menos sensible, pero cada cuadrícula gana ese %). Así puedes operar con poco capital sin que la comisión se coma la ganancia.',
  margen: 'Opcional. Si lo pones, cada cuadrícula se venderá SOLO cuando gane al menos ese % por encima de la comisión — nunca a pérdida. Y el sistema recalcula solo cuántas cuadrículas caben en tu rango para que la separación sea ese %. Déjalo en "auto" para el reparto normal.',
  tipobot: 'Cuatro formas de trabajar. SMART GRID: compra y vende en cada nivel, muchas operaciones pequeñas. ACCUMULATOR: compra en la caída y vende TODO junto al ganar el % que elijas. CASH OUT: vende la cripto que YA tienes cuando suba al precio o % que elijas. DCA: compra un monto fijo cada cierto tiempo, sin mirar el precio.',
  dcamonto: 'Cuánto de tu estable (USDT/USDC) se gasta en CADA compra. Por ejemplo, 10 USDT: el bot comprará 10 USDT de tu moneda en cada ciclo. Ten esa estable cargada y aprobada en tu wallet.',
  dcafrec: 'Cada cuánto compra el bot. Semanal o mensual rinden mejor que diario con montos chicos, porque el gas pesa menos por compra. La primera compra se hace al encender.',
  dcanum: 'Cuántas compras hará en total. Elige un número (ej. 52 = un año comprando cada semana) o "Infinito" para que siga hasta que lo suspendas o se acabe tu estable.',
  cashcant: 'Cuánta cripto de la que YA tienes en tu wallet quieres vender. No la compra el bot: es tuya. Solo le das permiso para venderla cuando llegue tu objetivo. Toca "Máx" para vender todo tu saldo.',
  cashobj: 'Cuándo vender. Por % : vende cuando el precio suba ese porcentaje desde ahora. Por precio: vende cuando llegue exactamente a ese precio. En ambos casos, recibes tu estable (USDT/USDC) en tu wallet.',
  acmin: 'El precio más bajo hasta donde el bot seguirá comprando. Cuanto más abajo, más aguanta una caída sin quedarse sin comprar. Pon un mínimo realista para tu moneda.',
  acniv: 'En cuántas compras separadas se reparte tu dinero desde el precio de ahora hasta el mínimo. Más compras = más suave el promediado.',
  acini: 'Qué parte de tu dinero se compra YA, a precio de mercado, al encender. El resto se reserva para comprar más barato si baja. Ej: 30% ahora, 70% esperando caídas.',
  acfactor: 'Cuánto MÁS compra en cada nivel según baja. Ej: 20% significa que cada escalón hacia abajo compra 20% más volumen que el anterior. Así, si cae fuerte, promedias mucho mejor.',
  acobj: 'La ganancia a la que vende TODO de golpe. El bot no vende hasta que tu posición completa esté en ese +% de beneficio. Si está en negativo, espera. Al vender, vuelve a empezar.',
  promedio: 'El precio promedio al que compraste (tu coste ÷ lo que tienes). Si el mercado sube por encima de este precio, tu posición está en ganancia.',
  vueltas: 'Una VUELTA ENTERA es una operación completa: el bot compró en una cuadrícula y luego vendió en otra (o al revés). Ahí se concreta la ganancia de rejilla. "Operaciones" cuenta cada compra o cada venta por separado; una vuelta son dos operaciones. Si el precio cruzó una cuadrícula pero aún no ves la vuelta, es que el keeper todavía no ejecutó esa venta on-chain.'
};
export const FEE_CICLO = 0.0015; // V3: 0.05%×2 PancakeSwap + nuestra comisión en 0
export const GAS_OP_USD = 0.012; // ~coste de gas por operación en BSC hoy (~0.05 gwei)
export const VOL_DIARIA = { BNB: 0.04, BTCB: 0.025, ETH: 0.035, SOL: 0.06, DOGE: 0.08, XRP: 0.06, CAKE: 0.07, LINK: 0.06, ADA: 0.06, BABYDOGE: 0.10 }; // volatilidad diaria típica (estimada)
export const PRESETS = {
  tranquilo:   { rango: 0.40, grids: 24, sep: 3.59, ops: 'pocas', desc: 'Rango muy amplio. Opera menos veces, pero cada vuelta deja bastante y aguanta meses sin salirse del rango.' },
  equilibrado: { rango: 0.28, grids: 20, sep: 2.92, ops: 'medias', desc: 'El término medio. Buen número de operaciones y cada una con ganancia holgada. Si no sabes cuál elegir, esta.' },
  activo:      { rango: 0.16, grids: 14, sep: 2.33, ops: 'muchas', desc: 'Rango ceñido al precio de hoy. Opera más seguido, pero si el mercado se va lejos puede salirse del rango.' },
  volatil:     { rango: 0.60, grids: 30, sep: 4.73, ops: 'pocas', desc: 'Para monedas que se mueven mucho. Rango enorme para que no se le escape el precio.' }
};
export const NOMBRE_PRESET = { tranquilo: 'Tranquilo', equilibrado: 'Equilibrado', activo: 'Activo', volatil: 'Volátil' };
export const GAS_VUELTA_USD = 0.025;
export const COM_DEX = 0.001;          // 0,05% por swap, ida y vuelta
export const LOGOS_WALLET = {
  metamask: `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><path fill="#E17726" d="M28.6 3.4 17.8 11.4l2-4.7z"/><path fill="#E27625" d="m3.4 3.4 10.7 8.1-1.9-4.8zM24.4 21.7l-2.9 4.4 6.2 1.7 1.8-6z"/><path fill="#E27625" d="m2.6 21.8 1.7 6 6.2-1.7-2.9-4.4z"/><path fill="#E27625" d="m10.1 14.5-1.7 2.6 6.1.3-.2-6.6zM21.9 14.5l-4.3-3.8-.1 6.7 6.1-.3zM10.5 26.1l3.7-1.8-3.2-2.5zM17.8 24.3l3.7 1.8-.5-4.3z"/><path fill="#D5BFB2" d="m21.5 26.1-3.7-1.8.3 2.4v1zM10.5 26.1l3.4.6v-1l.3-2.4z"/><path fill="#233447" d="m14 20.3-3.1-.9 2.2-1zM18 20.3l.9-1.9 2.2 1z"/><path fill="#CC6228" d="m10.5 26.1.5-4.4-3.4.1zM21 21.7l.5 4.4 2.9-4.3zM23.6 17.1l-6.1.3.6 3.1.9-1.9 2.2 1zM10.9 19.6l2.2-1 .9 1.9.6-3.1-6.2-.3z"/><path fill="#E27525" d="m8.4 17.1 2.6 5-.1-2.5zM21.2 19.6l-.1 2.5 2.6-5zM14.6 17.4l-.6 3.1.8 4 .2-5.3zM17.5 17.4l-.4 1.8.1 5.3.8-4z"/><path fill="#F5841F" d="m18 20.3-.8 4 .6.4 3.2-2.5.1-2.5zM10.9 19.6l.1 2.5 3.2 2.5.6-.4-.8-4z"/><path fill="#C0AC9D" d="m18.1 27.5v-1l-.3-.2h-3.6l-.3.2v1l-3.4-.6 1.2 1 2.4 1.7h3.7l2.5-1.7 1.2-1z"/><path fill="#161616" d="m17.8 24.3-.6-.4h-2.4l-.6.4-.3 2.4.3-.2h3.6l.3.2z"/><path fill="#763E1A" d="m29.1 11.9.9-4.4-1.4-4.1-11 8.1 4.3 3.6 6 1.8 1.3-1.5-.6-.4 1-.9-.7-.6 1-.7zM2 7.5l.9 4.4-.6.4 1 .7-.7.6.9.9-.6.4 1.3 1.5 6-1.8 4.3-3.6-11-8.1z"/><path fill="#F5841F" d="m28 15.1-6-1.8 1.8 2.7-2.6 5 3.5-.1h5.1zM10.1 13.3l-6 1.8-1.8 5.8h5.1l3.5.1-2.6-5zM17.5 17.4l.4-6.6 1.7-4.6h-7.3l1.7 4.6.4 6.6.2 2.1v5.2h2.4l.1-5.2z"/></svg>`,
  trust:    `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><path fill="#3375BB" d="M16 2 5 6.3v8.4c0 6.9 4.6 13.3 11 15.3 6.4-2 11-8.4 11-15.3V6.3z"/><path fill="#fff" d="M16 6.6v18.9c4.6-1.6 8-6.5 8-11.6V8.6z"/></svg>`,
  binance:  `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><path fill="#F0B90B" d="m16 4 3 3-6 6-3-3zM22 10l3 3-9 9-3-3zM10 10l3 3-3 3-3-3zM16 19l3 3-3 3-3-3z"/></svg>`,
  coinbase: `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><circle cx="16" cy="16" r="14" fill="#0052FF"/><rect x="11" y="11" width="10" height="10" rx="2" fill="#fff"/></svg>`,
  phantom:  `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><circle cx="16" cy="16" r="14" fill="#AB9FF2"/><ellipse cx="12" cy="15" rx="2" ry="3" fill="#fff"/><ellipse cx="20" cy="15" rx="2" ry="3" fill="#fff"/></svg>`,
  rabby:    `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><circle cx="16" cy="16" r="14" fill="#7084F5"/><path fill="#fff" d="M9 18c3-5 11-7 14-4-2 4-9 7-14 4z"/></svg>`
};
export const KEEPER_URL = 'https://bolita-keeper-bot.yamicelanvivesqui.workers.dev';
export const CONF_BOTS = {
  acum: {
    titulo: 'Configuraciones del Accumulator',
    porque: `<p><b>Qué hace, en simple.</b> Imagina que quieres comprar una moneda pero no sabes si va a bajar más. En vez de gastar todo tu dinero de golpe, el bot lo va soltando poco a poco cada vez que el precio baja. Y cuanto más barato está, más compra.</p>
      <p><b>Por qué eso ayuda.</b> Si compras 10 monedas a 100 y luego 10 a 80, no necesitas que vuelva a 100 para recuperar: tu precio medio es 90. El bot hace eso solo. A esto se le llama <b>bajar tu precio medio</b>, y es lo único que hace este bot.</p>
      <p><b>Cuándo vende.</b> No vende por partes. Espera a que <b>todo lo que compró</b> valga el porcentaje que tú fijaste (por ejemplo un 10% más de lo que te costó) y ahí vende de una vez. Como vende una sola vez, paga comisiones una sola vez.</p>
      <p><b>Qué puede salir mal, sin adornos:</b><br>
      · Si el precio <b>sigue bajando y no vuelve a subir</b>, el bot no vende y te quedas con la moneda comprada, valiendo menos de lo que pagaste. No pierdes el dinero de golpe, pero está ahí abajo esperando.<br>
      · Si el precio <b>cae por debajo del mínimo que pusiste</b>, deja de comprar y no puede seguir bajando tu promedio.<br>
      · <b>Nada garantiza que el precio suba.</b> Este bot ordena tus compras y espera con paciencia; no adivina el mercado.</p>
      <p><b>Tres consejos concretos:</b><br>· Un objetivo del <b>8-12%</b> se alcanza con bastante frecuencia. Por encima del 25% puedes esperar mucho tiempo.<br>· Pon el precio mínimo <b>bien abajo</b>, para que tenga margen de compra si hay una caída fuerte.<br>· Úsalo con monedas grandes y conocidas, que tienen más probabilidad de recuperarse que una moneda pequeña.</p>`,
    ops: [
      { id: 'prudente', n: 'Prudente', d: 'Objetivo cercano, sale rápido y repite. Ideal para empezar.', c: { obj: 5, niv: 6, ini: 25, factor: 30, caida: 20 }, r: 'Vende con +5%. Cierra ciclos a menudo.' },
      { id: 'medio', n: 'Equilibrado', d: 'El punto dulce entre frecuencia y ganancia. Recomendado.', c: { obj: 10, niv: 8, ini: 20, factor: 40, caida: 30 }, r: 'Vende con +10%. Buen equilibrio.' },
      { id: 'paciente', n: 'Paciente', d: 'Objetivo alto y mucho margen para comprar en caídas grandes.', c: { obj: 18, niv: 10, ini: 15, factor: 55, caida: 45 }, r: 'Vende con +18%. Menos ciclos, más ganancia cada uno.' }
    ]
  },
  cash: {
    titulo: 'Configuraciones del Cash Out',
    porque: `<p><b>Qué hace, en simple.</b> Tú dices "cuando esta moneda llegue a este precio, véndemela". El bot se queda vigilando el mercado día y noche, y en cuanto lo toca, vende y te manda el dinero a tu wallet.</p>
      <p><b>Por qué es útil.</b> No hace falta que estés pendiente del móvil ni que te despiertes de madrugada. El precio puede tocarse a las 4 de la mañana y el bot lo hará igual.</p>
      <p><b>Por qué apenas cuesta.</b> Solo hace <b>una operación</b>, así que paga comisiones una sola vez: unos <b>0,03 USDT</b> entre la red y el exchange. Todo lo que suba por encima de eso queda para ti.</p>
      <p><b>Qué puede salir mal, sin adornos:</b><br>
      · <b>El precio puede no llegar nunca.</b> Entonces el bot no hace nada y tu moneda sigue siendo tuya, ni más ni menos.<br>
      · Si el mercado <b>sube mucho más</b> de tu objetivo, ya habrás vendido y te habrás quedado sin esa subida extra.<br>
      · Si el precio <b>baja</b>, el bot no te protege: solo vende hacia arriba. Para eso está el stop loss, si lo activas.</p>
      <p><b>Tres consejos concretos:</b><br>· Entre <b>+3% y +10%</b> suele tocarse en días.<br>· Por encima del <b>+25%</b> puedes esperar semanas, o no llegar.<br>· Piensa a qué precio estarías contento vendiendo, y pon ese. No busques el máximo perfecto: nadie lo acierta.</p>`,
    ops: [
      { id: 'rapido', n: 'Rápido', d: 'Un objetivo cercano que el mercado suele tocar en pocos días.', c: { obj: 3 }, r: 'Vende con +3% de subida.' },
      { id: 'normal', n: 'Equilibrado', d: 'El más usado: buena ganancia sin esperar demasiado.', c: { obj: 7 }, r: 'Vende con +7% de subida.' },
      { id: 'ambicioso', n: 'Ambicioso', d: 'Para quien no tiene prisa y busca una subida fuerte.', c: { obj: 15 }, r: 'Vende con +15% de subida.' }
    ]
  },
  dca: {
    titulo: 'Configuraciones del DCA',
    porque: `<p><b>Qué hace, en simple.</b> Compra la misma cantidad cada cierto tiempo (por ejemplo 20 USDT todos los lunes), sin mirar si el precio está alto o bajo. Siempre igual, pase lo que pase.</p>
      <p><b>Por qué eso ayuda.</b> Nadie sabe cuándo es el mejor momento para comprar, ni los profesionales. Comprando siempre un poco, unas veces te tocará caro y otras barato, y acabas con un <b>precio medio razonable</b> en vez de haberlo apostado todo a un solo día.</p>
      <p><b>Lo que evita.</b> El error más caro que comete la gente: meter todos sus ahorros justo antes de una caída. Con esto es imposible que te pase.</p>
      <p><b>Qué puede salir mal, sin adornos:</b><br>
      · <b>No es magia.</b> Si la moneda baja durante años, tu precio medio bajará también, pero seguirás en pérdida.<br>
      · <b>Si el mercado solo sube</b>, habrías ganado más comprando todo al principio. Esto reduce el riesgo, y a cambio reduce el máximo posible.<br>
      · Este bot <b>solo compra, no vende</b>. Tú decides cuándo salir.</p>
      <p><b>Tres consejos concretos:</b><br>· <b>Semanal o mensual, no diario.</b> Cada compra paga gas de la red; comprando a diario ese coste se come la ventaja.<br>· Que cada compra sea de <b>10 USDT o más</b>, para que la comisión pese poco.<br>· Su fuerza está en el tiempo. Esto se piensa en <b>meses</b>, no en días.</p>`,
    ops: [
      { id: 'semanal', n: 'Semanal', d: 'Una compra por semana. El mejor equilibrio entre coste y suavizado.', c: { frec: 604800, num: 52 }, r: 'Un año comprando cada semana.' },
      { id: 'quincenal', n: 'Quincenal', d: 'Cada dos semanas. Menos comisiones, buen promedio.', c: { frec: 1209600, num: 26 }, r: 'Un año comprando cada 15 días.' },
      { id: 'mensual', n: 'Mensual', d: 'Una vez al mes. El más barato en comisiones.', c: { frec: 2592000, num: 24 }, r: 'Dos años comprando cada mes.' }
    ]
  }
};
export const CLAVE_AVISO = 'aurex-riesgo-visto';
export const CUPO_TOTAL = 8;
export const CUPO_POR_TIPO = 2;
export const NOMBRE_TIPO = { grid: 'Smart Grid', acum: 'Accumulator', cash: 'Cash Out', dca: 'DCA' };
export const CAT_NOMBRES = { l1: 'Layer 1', defi: 'DeFi', meme: 'Memes' };
export const BOTMETA = {
  grid: { nom: 'Smart Grid',  img: './img/bot-grid.webp',       des: 'Compra y vende en niveles; solo cierra cada cuadrícula en ganancia.' },
  acum: { nom: 'Accumulator', img: './img/bot-acumulador.webp', des: 'Compra en la caída y vende todo junto al llegar a tu ganancia.' },
  cash: { nom: 'Cash Out',    img: './img/bot-cashout.webp',    des: 'Vende la cripto que ya tienes, al precio o % que elijas.' },
  dca:  { nom: 'DCA',         img: './img/bot-dca.webp',        des: 'Compra un poco cada cierto tiempo, sin estar pendiente del precio.' }
};
export const RESERVA_BNB = 0.0015;  // se deja un poco de BNB nativo para el gas de las firmas (~$1)
