// idioma.js — cambio de idioma
//
// CÓMO FUNCIONA
//
// No hay páginas duplicadas ni archivos por idioma. Los textos siguen
// escritos en español en el código, y aquí vive un diccionario que los
// traduce sobre la marcha cuando el usuario elige otro idioma.
//
// REGLA DE ORO: esto NUNCA puede romper la web.
//
// Si el diccionario falla, si falta una traducción, si el navegador no
// soporta algo — la página sigue funcionando en español como siempre.
// Cada punto delicado está protegido, y el español es el respaldo
// permanente: si un texto no está traducido, se queda como estaba.

const CLAVE = 'cco-idioma';

export const IDIOMAS = [
  { id: 'en', nombre: 'English',   bandera: '🇺🇸' },
  { id: 'es', nombre: 'Español',   bandera: '🇲🇽' },
  { id: 'pt', nombre: 'Português', bandera: '🇵🇹' }
];

/* ══════════════════════════════════════════════════════════════
   EL DICCIONARIO

   Solo lo que ve el usuario. La clave es el texto español tal cual
   está escrito en el código, así no hay que tocar nada más.
   ══════════════════════════════════════════════════════════════ */
const DIC = {
  en: {

    /* ══════════════════════════════════════════════════════════════
       BOTS — configuraciones y explicaciones (gridbot/config.js)
       Añadido en la Fase 1/2 de la traducción a inglés.
       ══════════════════════════════════════════════════════════════ */
    'Configuraciones del Accumulator': 'Accumulator settings',
    'Configuraciones del Cash Out': 'Cash Out settings',
    'Configuraciones del DCA': 'DCA settings',
    'Lo que ganas cada vez que el bot completa una vuelta (compra abajo y vende arriba), ya con la comisión descontada.': 'What you earn each time the bot completes a cycle (buy low, sell high), with the fee already deducted.',
    'Rango muy amplio. Opera menos veces, pero cada vuelta deja bastante y aguanta meses sin salirse del rango.': 'Very wide range. Trades less often, but each cycle earns well and holds for months without leaving the range.',
    'El término medio. Buen número de operaciones y cada una con ganancia holgada. Si no sabes cuál elegir, esta.': 'The middle ground. A good number of trades, each with comfortable profit. If unsure, pick this one.',
    'Rango ceñido al precio de hoy. Opera más seguido, pero si el mercado se va lejos puede salirse del rango.': 'Range tight to today\'s price. Trades more often, but if the market moves far it may leave the range.',
    'Para monedas que se mueven mucho. Rango enorme para que no se le escape el precio.': 'For coins that move a lot. Huge range so the price never escapes it.',
    'Objetivo cercano, sale rápido y repite. Ideal para empezar.': 'Close target, exits fast and repeats. Ideal to start.',
    'El punto dulce entre frecuencia y ganancia. Recomendado.': 'The sweet spot between frequency and profit. Recommended.',
    'Objetivo alto y mucho margen para comprar en caídas grandes.': 'High target and plenty of room to buy on big dips.',
    'Un objetivo cercano que el mercado suele tocar en pocos días.': 'A close target the market usually reaches within days.',
    'El más usado: buena ganancia sin esperar demasiado.': 'The most used: good profit without waiting too long.',
    'Para quien no tiene prisa y busca una subida fuerte.': 'For those in no hurry, looking for a strong rise.',
    'Una compra por semana. El mejor equilibrio entre coste y suavizado.': 'One buy per week. The best balance between cost and smoothing.',
    'Cada dos semanas. Menos comisiones, buen promedio.': 'Every two weeks. Fewer fees, good average.',
    'Una vez al mes. El más barato en comisiones.': 'Once a month. The cheapest in fees.',
    'Compra y vende en niveles; solo cierra cada cuadrícula en ganancia.': 'Buys and sells in levels; only closes each grid in profit.',
    'Compra en la caída y vende todo junto al llegar a tu ganancia.': 'Buys the dip and sells all at once when it hits your target.',
    'Vende la cripto que ya tienes, al precio o % que elijas.': 'Sells the crypto you already hold, at the price or % you choose.',
    'Compra un poco cada cierto tiempo, sin estar pendiente del precio.': 'Buys a little every so often, without watching the price.',
    'prudente': 'cautious',
    'paciente': 'patient',
    'ambicioso': 'ambitious',
    'quincenal': 'biweekly',

    /* ══════════════════════════════════════════════════════════════
       PORTADA (index.html)
       La portada se escribe en español, como el resto del sitio, y se
       traduce aquí. Se añaden SOLO a 'en': el español es el original y
       el portugués se queda como estaba, sin regresión.
       ══════════════════════════════════════════════════════════════ */
    'Análisis profesional': 'Pro Analysis',
    'Herramientas': 'Tools',
    'Colector de polvo': 'Dust collector',
    'Junta los restos de monedas en una sola': 'Sweeps leftover coins into one',
    'Alertas de precio': 'Price alerts',
    'Te avisa cuando una moneda llega a tu precio': 'Pings you when a coin hits your price',
    'Miedo y codicia': 'Fear & Greed',
    'El humor del mercado en un número': 'Market mood in one number',
    'Análisis técnico': 'Technical analysis',
    'Comprar, vender o esperar, ahora mismo': 'Buy, sell or wait, right now',
    'Mapa del mercado': 'Market map',
    'Todas las monedas por tamaño y color': 'Every coin by size and colour',
    'Gráfica en directo': 'Live chart',
    'Velas y herramientas de dibujo': 'Candles and drawing tools',
    'Academia': 'Academy',
    'Eventos': 'Events',
    'Instalar app': 'Install app',
    'Conectar wallet': 'Connect wallet',
    'Compra y vende en niveles': 'Buys and sells in levels',
    'Compra en la caída y vende junto': 'Buys the dip, sells all at once',
    'Vende al precio que elijas': 'Sells at the price you choose',
    'Compra un poco cada cierto tiempo': 'Buys a little every so often',
    'Dónde está el dinero atrapado': 'Where the trapped money is',
    'Vea lo que hacen los grandes': 'See what the big players do',
    'Dónde comprar y dónde vender': 'Where to buy and where to sell',
    'Tu puerta al mercado global': 'Your gateway to the global market',
    'Trading sin límites,': 'Trading without limits,',
    'desde': 'from',
    'tu propia wallet.': 'your own wallet.',
    'Opera, invierte y haz crecer tus activos digitales en una plataforma no custodial sobre BNB Smart Chain. Tu dinero nunca cambia de dueño: los bots trabajan con un permiso de monto exacto que puedes revocar cuando quieras.': 'Trade, invest and grow your digital assets on a non-custodial platform built on BNB Smart Chain. Your money never changes hands: the bots work with an exact-amount allowance that you can revoke whenever you want.',
    'No custodial': 'Non-custodial',
    'Tus fondos no salen de tu wallet': 'Your funds never leave your wallet',
    'Permiso por monto exacto': 'Exact-amount allowance',
    'Nunca ilimitado, y lo revocas tú': 'Never unlimited, and you revoke it',
    'Sin porcentaje nuestro': 'No cut of your trades',
    'Solo el gas y la comisión del DEX': 'Only network gas and the DEX fee',
    'Sin cuenta ni KYC': 'No account, no KYC',
    'Tu wallet es tu único registro': 'Your wallet is your only sign-up',
    'Trading profesional': 'Professional trading',
    'Herramientas de alta frecuencia': 'High-frequency tools',
    'que enseñan el mercado real.': 'that show the real market.',
    'El precio no se mueve solo: lo mueve la liquidez. Nuestras herramientas leen el volumen dentro de cada bloque de órdenes y el libro en vivo para mostrar dónde hay dinero atrapado, qué órdenes grandes son reales y cuáles son humo.': 'Price does not move on its own: liquidity moves it. Our tools read the volume inside every order block and the live book to show where money is trapped, which large orders are real and which are smoke.',
    'Todo se calcula en tu navegador sobre velas y profundidad reales, sin intermediarios y sin retrasos añadidos.': 'Everything is computed in your browser from real candles and real depth, with no middlemen and no added delay.',
    'Abrir Liquidity': 'Open Liquidity',
    'dónde está el dinero atrapado': 'where the trapped money is',
    'vea lo que hacen los grandes': 'see what the big players do',
    'dónde comprar y dónde vender': 'where to buy and where to sell',
    'El mapa de liquidaciones: los precios donde hay posiciones esperando a ser barridas. El precio va a buscarlas.': 'The liquidation map: the prices where positions sit waiting to be swept. Price goes looking for them.',
    'El libro de órdenes miente: la mayoría de las órdenes grandes son falsas. Vigilamos cada una y le decimos cuáles tienen dinero real detrás.': 'The order book lies: most large orders are fake. We watch every one and tell you which have real money behind them.',
    'Analiza la estructura del mercado y dibuja los niveles exactos de entrada y salida sobre la gráfica, explicándole por qué en cada momento.': 'Reads market structure and draws the exact entry and exit levels on the chart, explaining why at every step.',
    'Ejecución automática': 'Automatic execution',
    'Un servicio vigila el precio y dispara tus órdenes aunque tengas el teléfono apagado.': 'A service watches the price and fires your orders even with your phone switched off.',
    'Sin custodia, de verdad': 'Truly non-custodial',
    'No hay depósito ni saldo en cuenta. El contrato solo mueve lo que autorizaste.': 'No deposits, no account balance. The contract can only move what you authorised.',
    'Acceso sin fronteras': 'Borderless access',
    'Sin registro, sin documentos y sin aprobación. Conectas tu wallet y estás dentro.': 'No sign-up, no documents, no approval. Connect your wallet and you are in.',
    'Web y móvil': 'Web and mobile',
    'La misma plataforma en el ordenador y en el teléfono, instalable como aplicación.': 'The same platform on desktop and phone, installable as an app.',
    'Activos digitales': 'Digital assets',
    'para un mundo sin fronteras.': 'for a world without borders.',
    'Desde las principales criptomonedas hasta los tokens del ecosistema BNB Chain: 26 activos operables contra USDT y USDC, con liquidez de PancakeSwap V3.': 'From the major cryptocurrencies to the BNB Chain ecosystem tokens: 26 tradable assets against USDT and USDC, with PancakeSwap V3 liquidity.',
    'Ver todos los mercados': 'View all markets',
    'Más que bots,': 'More than bots,',
    'es tu ecosistema cripto.': 'your whole crypto ecosystem.',
    'Opera, analiza, intercambia y aprende.': 'Trade, analyse, swap and learn.',
    'Todo en una sola plataforma, sin salir de tu wallet.': 'All in one platform, without leaving your wallet.',
    'Bots automáticos': 'Automated bots',
    'Smart Grid, Accumulator,': 'Smart Grid, Accumulator,',
    'Cash Out y DCA': 'Cash Out and DCA',
    'Swap integrado': 'Built-in swap',
    'Intercambia entre activos': 'Exchange between assets',
    'sin salir de la plataforma': 'without leaving the platform',
    'Marketplace P2P': 'P2P marketplace',
    'Compra y vende con confianza,': 'Buy and sell with escrow,',
    'tramos y disputas': 'tranches and dispute handling',
    'Herramientas de análisis': 'Analysis tools',
    'Smart Levels, Lógica Estructural': 'Smart Levels, Structural Logic',
    'y Liquidity Pools': 'and Liquidity Pools',
    'Formación con acceso': 'Training with access',
    'gestionado por contrato': 'managed by contract',
    'Acceder a los bots': 'Go to the bots',
    'Transparencia': 'Transparency',
    'Confianza que': 'Trust you',
    'se puede verificar.': 'can verify yourself.',
    'Todo lo que hace la plataforma está escrito en contratos públicos sobre BNB Smart Chain. Puedes leerlos y comprobar tú mismo qué pueden y qué no pueden hacer.': 'Everything the platform does is written in public contracts on BNB Smart Chain. You can read them and check for yourself what they can and cannot do.',
    'Las direcciones oficiales se muestran': 'The official addresses are shown',
    'dentro de la aplicación': 'inside the app',
    ', con tu wallet ya conectada. Nunca las publicamos sueltas ni te las enviaremos por mensaje: si alguien te pasa una dirección diciendo que es nuestra, desconfía.': ', with your wallet already connected. We never post them loose and we will never send them by message: if someone hands you an address claiming it is ours, do not trust it.',
    'Ver los contratos en la app': 'View the contracts in the app',
    'Lógica Estructural': 'Structural Logic',
    'Contratos públicos verificables': 'Public verifiable contracts',
    'Activos operables': 'Tradable assets',
    'Swap para intercambiar monedas': 'Built-in swap to exchange coins',
    'Fondos bajo nuestra custodia': 'Funds held in our custody',
    'Empieza en minutos': 'Start in minutes',
    'Conecta tu wallet y': 'Connect your wallet and',
    'mira la plataforma por dentro.': 'look inside the platform.',
    'No hay registro ni formulario. Conectas, lo ves todo, y decides después. Puedes desconectarte en cualquier momento.': 'No sign-up, no forms. Connect, see everything, decide afterwards. You can disconnect at any time.',
    'Trading automático en tu propia wallet. Tú controlas tus activos.': 'Automated trading in your own wallet. You stay in control of your assets.',
    'Producto': 'Product',
    'Plataforma': 'Platform',
    'Soporte': 'Support',
    'Dudas, incidencias y novedades en el canal de Telegram.': 'Questions, issues and news on our Telegram channel.',
    'Abrir Telegram': 'Open Telegram',
    'Operar con criptomonedas conlleva riesgo. Un bot ordena y ejecuta tus operaciones, pero no predice el mercado y no garantiza ganancias. Puedes perder parte o la totalidad de lo que inviertas. Opera solo con dinero que puedas permitirte perder. Esta plataforma es no custodial: tú eres el único responsable de la custodia de tu wallet y de tus claves.': 'Trading crypto carries risk. A bot organises and executes your trades, but it does not predict the market and guarantees no profit. You can lose part or all of what you invest. Only trade with money you can afford to lose. This platform is non-custodial: you are solely responsible for the custody of your wallet and your keys.',
    'Plataforma no custodial · BNB Smart Chain': 'Non-custodial platform · BNB Smart Chain',
    /* ── App MÓVIL: barra inferior + ventana de Inicio ──
       Estos textos van escritos en español en la cáscara móvil (assets/js/movil/)
       y se traducen aquí, igual que el resto de la web. Solo se añaden a 'en': el
       español y el portugués se quedan como estaban (sin regresión). */
    'Inicio': 'Home',
    'Mercados': 'Markets',
    'Operar': 'Trade',
    'Activos': 'Assets',
    'Busca servicios, ofertas, monedas…': 'Search services, offers, coins…',
    'Balance total': 'Total balance',
    'Conecta tu wallet para ver tu saldo': 'Connect your wallet to see your balance',
    'Agregar fondos': 'Add funds',
    'Exchange no custodial.': 'Non-custodial exchange.',
    'Tú controlas tus fondos siempre. Conecta tu wallet para operar, crear bots e intercambiar.': 'You always control your funds. Connect your wallet to trade, create bots and swap.',
    'Ver': 'View',
    'Ver →': 'See →',
    'Ver todo →': 'See all →',
    'Todos los servicios': 'All services',
    'Ver balance en': 'View balance in',
    'Participa y gana del pozo acumulado': 'Join and win from the accrued pool',
    'Academia CriptoCuba': 'CriptoCuba Academy',
    'Aprende a operar y multiplica tu ventaja': 'Learn to trade and multiply your edge',
    'Prize Pool comunitario': 'Community Prize Pool',
    'Participa y gana del fondo común': 'Join and win from the shared pool',
    'Bots que operan por ti': 'Bots that trade for you',
    'Compran abajo y venden arriba, en tu wallet': 'They buy low and sell high, in your wallet',
    'Calculadoras y utilidades para operar mejor': 'Calculators and utilities to trade better',
    'Acumulador': 'Accumulator',

    /* ── Menú principal ── */
    'Bots': 'Bots',
    'Market': 'Market',
    'Academia': 'Academy',
    'Tools': 'Tools',
    'Prize Pool': 'Prize Pool',
    'Liquidity': 'Liquidity',
    'Perfil': 'Profile',
    'Install': 'Install',
    'Compartir': 'Share',

    /* ── Portada de Liquidity ── */
    'Herramientas Pro': 'Pro Tools',
    'Análisis profesional': 'Professional Analysis',
    'Tres herramientas para ver lo que el gráfico esconde': 'Three tools to see what the chart hides',
    'Liquidity Pools': 'Liquidity Pools',
    'Dónde está el dinero atrapado': 'Where the money is trapped',
    'El mapa de liquidaciones: los precios donde hay posiciones esperando a ser barridas. El precio va a buscarlas.':
      'The liquidation map: prices where positions wait to be swept. Price goes looking for them.',
    'Lógica Estructural Avanzada': 'Advanced Structural Logic',
    'Vea lo que hacen los grandes': 'See what the big players do',
    'Próximamente': 'Coming soon',
    'En desarrollo': 'In development',
    'La tercera herramienta del paquete. Muy pronto.': 'The third tool in the package. Very soon.',
    'Abrir →': 'Open →',
    'Acceso a las tres': 'Access to all three',
    'Una semana': 'One week',
    'Un mes': 'One month',
    'Tres meses': 'Three months',
    'Recomendado': 'Recommended',
    'Suscribirme': 'Subscribe',
    'para probarlo': 'to try it out',
    'sale a cuenta': 'good value',
    'días': 'days',

    /* ── Liquidity Pools ── */
    'Filtro': 'Filter',
    'Todo': 'All',
    'Menos liquidez': 'Less liquidity',
    'Muros de liquidación': 'Liquidation walls',
    'Cómo funciona': 'How it works',
    'Cerrar': 'Close',
    'Reintentar': 'Retry',
    'Calculando zonas de liquidez…': 'Calculating liquidity zones…',
    'Cómo operar con esto': 'How to trade with this',
    'Cómo se lee el mapa': 'How to read the map',
    'Entendido': 'Got it',
    'Saber más': 'Learn more',
    'Atrás': 'Back',

    /* ── Radar Institucional ── */
    'Precio ahora': 'Price now',
    'En directo': 'Live',
    'Órdenes detectadas': 'Detected orders',
    'Soporte': 'Support',
    'Resistencia': 'Resistance',
    'Fuertes': 'Strong',
    'Falsas': 'Fake',
    'EN VENTA': 'SELLING',
    'EN COMPRA': 'BUYING',
    'Orden blindada': 'Shielded order',
    'Nivel probado': 'Tested level',
    'Orden firme': 'Firm order',
    'Orden falsa': 'Fake order',
    'En observación': 'Under watch',
    'Ha desaparecido': 'Gone',
    'Libro tranquilo': 'Quiet book',
    'Analizando el libro de órdenes': 'Analyzing the order book',
    'firme': 'firm',
    'repuesta': 'refilled',
    'ejecutado': 'executed',
    'fuerza': 'strength',
    'arriba': 'above',
    'abajo': 'below',

    /* ── Frases largas de la portada ── */
    'El libro de órdenes miente: la mayoría de las órdenes grandes son falsas. Vigilamos cada una y le decimos cuáles tienen dinero real detrás.':
      'The order book lies: most large orders are fake. We watch every one and tell you which have real money behind them.',
    'La tercera herramienta del paquete. Muy pronto.': 'The third tool in the package. Coming very soon.',
    'ahorras un 22%': 'save 22%',
    'ahorras un 48%': 'save 48%',
    '7 días': '7 days',
    '30 días': '30 days',
    '90 días': '90 days',
    'Se paga en': 'Paid in',
    'desde tu wallet. Si renuevas antes de que caduque, los días que te quedan se suman.':
      'from your wallet. If you renew before it expires, remaining days carry over.',
    'Tu acceso está activo': 'Your access is active',
    'Elige un plan para entrar a las herramientas.': 'Choose a plan to access the tools.',
    'Conecta tu wallet para poder suscribirte.': 'Connect your wallet to subscribe.',
    'El acceso queda ligado a tu wallet. Si renuevas antes de que caduque, los días que te quedan se suman.':
      'Access is tied to your wallet. If you renew before it expires, remaining days carry over.',
    '¿Con qué quieres pagar?': 'How would you like to pay?',
    'Confirma en tu wallet…': 'Confirm in your wallet…',
    '¡Listo! Ya tienes acceso.': 'Done! You now have access.',
    'Cancelaste la firma.': 'You cancelled the signature.',

    /* ── Comunes ── */
    'Buscar…': 'Search…',
    'Cargando…': 'Loading…',
    'Conectar wallet': 'Connect wallet',
    'Guardar imagen': 'Save image',
    'Aplicar': 'Apply',
    'Cancelar': 'Cancel',
    'Aceptar': 'Accept',
    'Volver': 'Back',
    'Siguiente': 'Next',

    /* ══════════════ BOTS ══════════════ */
    'Arma tu bot': 'Build your bot',
    'Bots activos': 'Active bots',
    'Bots creados (total)': 'Bots created (total)',
    'Bot creado el': 'Bot created on',
    'Smart Grid': 'Smart Grid',
    'Accumulator': 'Accumulator',
    'Cash Out': 'Cash Out',
    'Elige la moneda': 'Choose the coin',
    'Cantidad': 'Amount',
    'Cantidad a vender': 'Amount to sell',
    'Precio de entrada': 'Entry price',
    'Entrada': 'Entry',
    'Mercado': 'Market price',
    'Compra a': 'Buys at',
    'Separación': 'Spacing',
    'Ganancia': 'Profit',
    'Ganancia %': 'Profit %',
    'Flotante': 'Floating',
    'Nº compras': 'Buys',
    'Cerrar bot': 'Close bot',
    'Cerrar con ganancia': 'Close with profit',
    'Cerrar al %': 'Close at %',
    'Ajustar cuadrículas': 'Adjust grids',
    'Ampliar rango': 'Widen range',
    'Aplicar rango': 'Apply range',
    'Cada cuánto': 'How often',
    'Configuración': 'Settings',
    'Configuraciones rentables': 'Profitable setups',
    'Apalancamiento': 'Leverage',
    'Actualizar datos': 'Refresh data',
    'Actividad': 'Activity',
    'Operaciones': 'Trades',
    'Ciclos completados': 'Completed cycles',
    'Compras / ventas': 'Buys / sells',
    'Miembro desde': 'Member since',
    'Resultado': 'Result',
    'Volumen': 'Volume',
    'Rango': 'Range',
    'Mínimo': 'Minimum',
    'Máximo': 'Maximum',
    'Gas disponible': 'Gas available',
    'Gas gastado (total)': 'Gas spent (total)',
    'Cuota mensual': 'Monthly fee',
    'Suscripción y gas': 'Subscription and gas',
    'Tus bots por estrategia': 'Your bots by strategy',
    'Activa': 'Active',
    'Inactiva': 'Inactive',
    'Crear bot': 'Create bot',
    'Continuar': 'Continue',
    'Confirmar': 'Confirm',
    'Añadir gas': 'Add gas',
    'Retirar': 'Withdraw',
    'Retirar todo': 'Withdraw all',
    'Depositar': 'Deposit',
    'Caja fuerte': 'Vault',
    'Saldo': 'Balance',

    /* ══════════════ WALLET ══════════════ */
    'Conecta tu wallet': 'Connect your wallet',
    'Conectar wallet': 'Connect wallet',
    'Cambiar de wallet': 'Change wallet',
    'Cambiar a BNB Chain': 'Switch to BNB Chain',
    'Abrir en MetaMask': 'Open in MetaMask',
    'Abrir en Trust Wallet': 'Open in Trust Wallet',
    'Abrir en SafePal': 'Open in SafePal',
    'Buscando en BNB Chain…': 'Searching on BNB Chain…',
    'Abriendo tu panel…': 'Opening your panel…',
    'Tu nombre o alias': 'Your name or alias',
    'Ponle un nombre a tu cuenta': 'Give your account a name',
    'Ponle un nombre': 'Set a name',
    'Editar nombre': 'Edit name',
    'Tu cuenta': 'Your account',

    /* ══════════════ MARKET ══════════════ */
    'Marketplace': 'Marketplace',
    'Ofertas': 'Offers',
    'Vender': 'Sell',
    'Comprar': 'Buy',
    'Terminadas': 'Completed',
    'Disputas': 'Disputes',
    'Abrir disputa': 'Open dispute',
    'Cancelar pedido': 'Cancel order',
    'Cancelar y recuperar': 'Cancel and recover',
    'Acepta que le paguen': 'Accepts payment',
    'Cargando marketplace…': 'Loading marketplace…',
    'Cargando ofertas…': 'Loading offers…',
    'Avisos del Marketplace': 'Marketplace alerts',
    'Ocultar': 'Hide',
    'Ver todas': 'View all',
    'Nuevo': 'New',
    'Precio': 'Price',
    'Pagar': 'Pay',
    'Ya pagué': 'I paid',
    'Confirmar pago': 'Confirm payment',
    'Liberar fondos': 'Release funds',

    /* ══════════════ ACADEMIA ══════════════ */
    'Academy': 'Academy',
    'Abrir la Academia': 'Open the Academy',
    'Un mes': 'One month',
    'Tres meses': 'Three months',
    'Un año': 'One year',
    'para probar': 'to try it',
    'el más elegido': 'most chosen',
    'el que sale a cuenta': 'best value',
    'Ahora toca practicar.': 'Now it is time to practise.',
    'Tu usuario de Telegram': 'Your Telegram username',
    'Suscripción activa': 'Active subscription',
    'Te quedan': 'You have left',

    /* ══════════════ PRIZE POOL ══════════════ */
    'Cargando Prize Pool…': 'Loading Prize Pool…',
    'Participar': 'Enter',
    'Premio': 'Prize',
    'Participantes': 'Participants',
    'Sorteo': 'Draw',
    'Próximo sorteo': 'Next draw',
    'Ganador': 'Winner',
    'Historial': 'History',

    /* ══════════════ TOOLS ══════════════ */
    'Herramientas': 'Tools',
    'Alerta de precio': 'Price alert',
    'Alertas de precio': 'Price alerts',
    'Miedo y codicia': 'Fear and greed',
    'Análisis técnico': 'Technical analysis',
    'Mapa del mercado': 'Market map',
    'Gráfica en directo': 'Live chart',
    'Colector de polvo': 'Dust collector',
    'Consultando el índice…': 'Checking the index…',
    'Qué es esto': 'What is this',
    'sube a': 'rises to',
    'baja a': 'falls to',
    'Crear alerta': 'Create alert',
    'Mis alertas': 'My alerts',

    /* ══════════════ COMUNES ══════════════ */
    'Cerrar': 'Close',
    'Cancelar': 'Cancel',
    'Continuar': 'Continue',
    'Volver': 'Back',
    'Atrás': 'Back',
    'Ahora no': 'Not now',
    'Buscar…': 'Search…',
    'Cargando…': 'Loading…',
    'Aplicar': 'Apply',
    'Guardar': 'Save',
    'Borrar': 'Delete',
    'Editar': 'Edit',
    'Copiar': 'Copy',
    'Copiado': 'Copied',
    'Sí': 'Yes',
    'No': 'No',
    'Hoy': 'Today',
    'Ayer': 'Yesterday',
    'Tengo un problema': 'I have a problem',
    'opcional': 'optional',
    'cambiar': 'change',
    'elegir': 'choose',
    'gas': 'gas',

    /* ── Frases de cabecera de cada sección ── */
    'Compra y vende con caja fuerte': 'Buy and sell with escrow',
    'Cosas útiles para el día a día con tus bots.': 'Useful things for your day to day with bots.',
    'Junta los restos de monedas que te van quedando': 'Collect the leftover crumbs of coins',
    'De cero a operar con criterio': 'From zero to trading with judgement',
    'Una ruta ordenada, con exámenes para avanzar. No es una carpeta de vídeos.':
      'An ordered path, with exams to progress. Not a folder of videos.',
    'No se pudo cargar el Prize Pool ahora mismo.': 'Could not load the Prize Pool right now.',
    'Revisa tu conexión y vuelve a intentar.': 'Check your connection and try again.',
    'No se pudieron cargar los datos.': 'Could not load the data.',
    'Revisa tu conexión.': 'Check your connection.',
    'Cripto Cuba Academy': 'Cripto Cuba Academy',

    /* ══════════════ WALLET Y CONEXIÓN ══════════════ */
    'Sin conectar': 'Not connected',
    'Conectada': 'Connected',
    'Tus wallets': 'Your wallets',
    'Otra wallet (QR)': 'Other wallet (QR)',
    'Elige cómo quieres hacerlo.': 'Choose how you want to do it.',
    'Lo más sencillo': 'The simplest way',
    'Se abre CriptoCuba dentro de tu wallet y conecta solo.': 'CriptoCuba opens inside your wallet and connects on its own.',
    'Es una sola firma.': 'It is a single signature.',
    'Instalar': 'Install',
    'Usar': 'Use',
    'Mejor no': 'Not now',
    'Swap': 'Swap',

    /* ══════════════ BOTS ══════════════ */
    'Qué hace, en simple.': 'What it does, in plain terms.',
    'Por qué eso ayuda.': 'Why that helps.',
    '¿Por qué este bot da ganancia?': 'Why does this bot make a profit?',
    'Qué puede salir mal, sin adornos:': 'What can go wrong, no sugar-coating:',
    'Tres consejos concretos:': 'Three concrete tips:',
    'Lógica Estructural Avanzada': 'Advanced Structural Logic',
    'bots activos': 'active bots',
    'Compras': 'Buys',
    'Vendes': 'Sells',
    'compra': 'buy',
    'vende': 'sell',
    'Máx': 'Max',
    'Mín': 'Min',
    'Más': 'More',
    'Toca': 'Tap',
    'ya casi': 'almost there',
    'Tu dinero en la caja fuerte': 'Your money in the vault',
    '¿Cuál moneda?': 'Which coin?',
    '¿Cuántos': 'How many',
    'Escríbela tú': 'Type it yourself',
    'Otra': 'Other',
    'Tether · la más usada': 'Tether · the most used',
    'USD Coin': 'USD Coin',

    /* ══════════════ MARKET ══════════════ */
    'Quiero vender': 'I want to sell',
    'Quiero comprar': 'I want to buy',
    'Disputa': 'Dispute',
    'Razón al COMPRADOR': 'In favour of the BUYER',
    'Razón al VENDEDOR': 'In favour of the SELLER',
    'Anular · devolver todo': 'Void · return everything',
    'No hay publicaciones abiertas ahora mismo.': 'No open listings right now.',
    'No se pudo cargar.': 'Could not load.',
    'no se entrega de golpe': 'not delivered all at once',
    'Problema': 'Problem',

    /* ══════════════ PRIZE POOL ══════════════ */
    'más ganadores hay': 'the more winners there are',
    'Cómo funciona el sorteo': 'How the draw works',
    'Tus números': 'Your numbers',
    'Comprar número': 'Buy number',

    /* ══════════════ COMUNES ══════════════ */
    'Aviso': 'Notice',
    'Error': 'Error',
    'Listo': 'Done',
    'Espera': 'Wait',
    'Firmando…': 'Signing…',
    'Confirmando…': 'Confirming…',
    'Hecho': 'Done',
    'Ver más': 'See more',
    'Ver menos': 'See less',
    'Detalles': 'Details',
    'Ayuda': 'Help',
    'Siguiente paso': 'Next step',
    'Paso': 'Step',
    'de': 'of',
    'Total': 'Total',
    'Disponible': 'Available',
    'Pendiente': 'Pending',
    'Completado': 'Completed',
    'Cancelado': 'Cancelled',
    'En curso': 'In progress',
    'Sin datos': 'No data',
    'Actualizado': 'Updated',
    'hace': 'ago',
    'minutos': 'minutes',
    'horas': 'hours',
    'segundos': 'seconds',

    /* ══════════════ PERFIL ══════════════ */
    'Conecta tu wallet para ver tu panel:': 'Connect your wallet to see your panel:',
    'suscripción, rendimiento, bots y gas.': 'subscription, performance, bots and gas.',
    'Ver en BscScan ↗': 'View on BscScan ↗',
    'BscScan ↗': 'BscScan ↗',
    'Coste por operación': 'Cost per trade',
    'Cada compra o venta que hace un bot': 'Each buy or sell a bot makes',
    'Se descuenta de tu gas, no de tu inversión.': 'Deducted from your gas, not your investment.',
    'Permisos de gasto': 'Spending approvals',
    'No tienes permisos que revisar.': 'You have no approvals to review.',
    'quítaselo': 'revoke it',
    'quitar': 'revoke',
    'Notificaciones': 'Notifications',
    'Renovación automática': 'Auto-renewal',
    'Pronto': 'Soon',
    'Suscripción y gas': 'Subscription and gas',
    'Actividad': 'Activity',
    'Tus bots por estrategia': 'Your bots by strategy',
    'Los datos se leen directamente de la blockchain.': 'Data is read directly from the blockchain.',

    /* ══════════════ BOTS · CREACIÓN Y PANEL ══════════════ */
    'Mis bots': 'My bots',
    'Crear mi primer bot': 'Create my first bot',
    'Encender el bot': 'Start the bot',
    'Cerrar todos': 'Close all',
    'Antes de empezar, léelo': 'Read this before you start',
    'Lo he leído y lo entiendo': 'I have read and understand this',
    'Entiendo, continuar': 'I understand, continue',
    'Bots que compran barato y venden caro por ti, en tu propia wallet. Sin custodia y sin KYC.':
      'Bots that buy low and sell high for you, in your own wallet. Non-custodial and no KYC.',
    'Cuando enciendas uno, aparecerá aquí con su marcha y sus resultados.':
      'When you start one, it will appear here with its progress and results.',
    'Elige una y seguimos. Después puedes ajustar lo que quieras.':
      'Pick one and we continue. You can adjust anything afterwards.',
    'Es la única vez que te lo enseño, y prefiero decírtelo yo antes de que lo descubras tú.':
      'This is the only time I will show you, and I would rather tell you before you find out yourself.',
    'No pudimos leer tus bots ahora mismo': 'We could not read your bots right now',
    'Buscando token en BNB Chain…': 'Searching for token on BNB Chain…',
    'No encontramos nada con esa palabra. Prueba con otra.': 'We found nothing with that word. Try another.',
    'Escribe al menos 20 USDT.': 'Enter at least 20 USDT.',
    'Escríbelas en papel': 'Write them down on paper',
    'O sin salir de aquí': 'Or without leaving here',
    'Conectar con WalletConnect': 'Connect with WalletConnect',
    'No hay wallets en este navegador. Usa la opción de arriba para conectar desde tu teléfono.':
      'No wallets in this browser. Use the option above to connect from your phone.',

    /* ── Parámetros del bot ── */
    'Inversión': 'Investment',
    'Inv.': 'Inv.',
    'Monto': 'Amount',
    'Monto por compra': 'Amount per buy',
    'Nº de compras': 'Number of buys',
    'Compras hechas': 'Buys made',
    'Compra inicial %': 'Initial buy %',
    'Compra inicial (a mercado)': 'Initial buy (at market)',
    'Inicial %': 'Initial %',
    'Comprar abajo %': 'Buy below %',
    'Abajo %': 'Below %',
    'Gan. cuadrícula %': 'Grid profit %',
    'Ganancia estimada': 'Estimated profit',
    'Estimación': 'Estimate',
    'Objetivo': 'Target',
    'Gas (BNB)': 'Gas (BNB)',
    'Gas del bot': 'Bot gas',
    'Gráfica': 'Chart',
    'Infinito': 'Infinite',
    'Diario': 'Daily',
    'Mensual': 'Monthly',
    'Comisión de la venta': 'Sale fee',
    'Calculado con': 'Calculated with',
    'Compra al llegar a': 'Buys on reaching',
    'Llegue a un precio': 'Reaches a price',
    'Intercambiar': 'Swap',
    'Intercambio': 'Swap',
    'Cambiaste': 'You changed',

    /* ── Explicaciones de estrategia ── */
    'Qué hace, en simple.': 'What it does, in plain terms.',
    'De dónde sale la ganancia.': 'Where the profit comes from.',
    'Cuándo vende.': 'When it sells.',
    'Lo que evita.': 'What it avoids.',
    'La clave: la separación entre escalones.': 'The key: the spacing between steps.',
    'Cuanto más dinero por cuadrícula, mejor.': 'The more money per grid, the better.',
    'Con "Ganancia por cuadrícula"': 'With "Grid profit"',
    'Compra en las caídas y': 'Buys the dips and',
    'Compra más cuanto más baja el precio. Cuando el conjunto gana el % que elijas,':
      'Buys more as the price falls. When the whole position gains the % you choose,',
    'La primera compra es al encender. Ten': 'The first buy happens on start. Have',
    'La primera compra se hace al encender. Ten': 'The first buy is made on start. Have',
    'La cripto que ya compraste se queda en tu wallet.': 'The crypto you already bought stays in your wallet.',
    'Cuántas vueltas dé al día lo decide el mercado': 'How many cycles per day is decided by the market',
    'No necesita que el precio suba en general': 'It does not need the price to rise overall',

    /* ── Avisos honestos ── */
    'No es magia.': 'It is not magic.',
    'Nada garantiza ganancias.': 'Nothing guarantees profits.',
    'Nada garantiza que el precio suba.': 'Nothing guarantees the price will rise.',
    'Nadie puede prometerte ganancias.': 'Nobody can promise you profits.',
    'El precio puede no llegar nunca.': 'The price may never get there.',
    'El precio de ahora debe quedar dentro del rango': 'The current price must fall inside the range',
    'El precio se salió de tu rango, por abajo': 'The price left your range, below',
    'El precio se salió de tu rango, por arriba': 'The price left your range, above',
    'Cripto Cuba Oficial': 'Cripto Cuba Oficial',
    'Cripto Cuba Oficial · Opera bajo tu propio riesgo': 'Cripto Cuba Oficial · Trade at your own risk',

    /* ══════════════ MARKETPLACE ══════════════ */
    'Compra y vende': 'Buy and sell',
    'Conecta tu wallet.': 'Connect your wallet.',
    'Conecta tu wallet para publicar una oferta.': 'Connect your wallet to post an offer.',
    'Conecta tu wallet para publicar que quieres comprar.': 'Connect your wallet to post that you want to buy.',
    'Conecta tu wallet para ver tus operaciones.': 'Connect your wallet to see your trades.',
    'Consultando tu saldo…': 'Checking your balance…',
    'No se pudieron cargar las ofertas.': 'Could not load the offers.',
    'No se pudo cargar. Revisa tu conexión.': 'Could not load. Check your connection.',
    'Paso 1 · Crea tu perfil': 'Step 1 · Create your profile',
    'Necesitamos saber quién eres y cómo contactarte. Se guarda una sola vez.':
      'We need to know who you are and how to reach you. Saved only once.',
    'Guardar perfil': 'Save profile',
    'Guardar y continuar': 'Save and continue',
    'Contacto (Telegram)': 'Contact (Telegram)',
    'Cómo contactarlo': 'How to contact them',
    'No dejó datos de contacto.': 'They left no contact details.',
    'No dejó explicación.': 'They left no explanation.',
    'Moneda habitual': 'Usual currency',
    'Horario:': 'Hours:',
    'Comprador:': 'Buyer:',
    'Nota para quien te compre': 'Note for your buyer',
    'Nuevo · sin historial': 'New · no history',
    'Elige uno…': 'Choose one…',
    'Duró': 'Lasted',
    'Dónde está': 'Where they are',
    'Guardamos tu posición': 'We save your location',
    'Necesitas dar permiso de ubicación para ver la distancia.': 'You need to allow location access to see the distance.',
    'Esta persona no comparte su ubicación. Puedes pedírsela por el contacto:':
      'This person does not share their location. You can ask them via contact:',
    'En Android:': 'On Android:',
    'En iPhone:': 'On iPhone:',
    'En Windows:': 'On Windows:',

    /* ── Operaciones ── */
    'Antes de reservar': 'Before reserving',
    'Cómo funciona esta compra': 'How this purchase works',
    'Depositar fianza': 'Deposit collateral',
    'Cancelar mi publicación': 'Cancel my listing',
    'Devolver al listado': 'Return to listing',
    'Devolver mi oferta al listado': 'Return my offer to the listing',
    'Me arrepentí · cancelar pedido': 'Changed my mind · cancel order',
    'No llegó · disputa': 'Did not arrive · dispute',
    'No me llegó · abrir disputa': 'It never arrived · open dispute',
    'No, ahora no': 'No, not now',
    'La reserva ya venció': 'The reservation has expired',
    'Enviar calificación': 'Send rating',
    'Comprueba en tu banco/Zelle que el dinero llegó de verdad.':
      'Check in your bank/Zelle that the money really arrived.',
    'Ese dinero es tuyo': 'That money is yours',
    'Es tuyo. Vuelve a tu wallet en cuanto canceles la publicación o termine la operación.':
      'It is yours. It returns to your wallet as soon as you cancel the listing or the trade ends.',
    'Ahora mismo el contrato no retiene nada tuyo.': 'Right now the contract holds nothing of yours.',
    'A cambio:': 'In return:',
    'Al abrirla,': 'On opening it,',

    /* ── Disputas ── */
    'No hay disputas pendientes.': 'No pending disputes.',
    'La salida segura es la disputa.': 'The safe way out is a dispute.',
    'Lo que dice quien abrió la disputa:': 'What the person who opened the dispute says:',
    'Eres el árbitro. Revisa los comprobantes antes de decidir.':
      'You are the arbiter. Review the evidence before deciding.',
    'Cuéntalo en pocas palabras. Esto lo lee el árbitro para poder decidir, así que':
      'Explain it briefly. The arbiter reads this to decide, so',
    'No se borra nada': 'Nothing is deleted',
    'Lo que ya esté a mitad de una operación (con un pago declarado)':
      'Anything already mid-trade (with a declared payment)',

    /* ══════════════ ACADEMIA ══════════════ */
    'Cómo funciona esto': 'How this works',
    'De cero a cien. Cada clase, su examen.': 'From zero to a hundred. Every class, its exam.',
    'La hoja de ruta': 'The roadmap',
    'La estrategia': 'The strategy',
    'Las 17 clases': 'The 17 classes',
    'Cada clase tiene su examen': 'Every class has its exam',
    'Haces el examen': 'You take the exam',
    'Examen': 'Exam',
    'Al aprobar, tu certificado.': 'On passing, your certificate.',
    'Antes de cualquier clase, esto.': 'Before any class, this.',
    'Aquí encaja todo lo anterior.': 'This is where everything before fits together.',
    'El orden exacto en que hay que estudiarlo. Cada bloque se apoya en el anterior.':
      'The exact order to study it. Each block builds on the previous one.',
    'Elige un plan y tendrás la ruta completa.': 'Choose a plan and you get the full path.',
    'Ejemplos sobre operaciones reales': 'Examples on real trades',
    'Herramientas y repaso general.': 'Tools and general review.',
    'Has recorrido las cinco etapas.': 'You have completed the five stages.',
    'En la primera vuelta': 'On the first pass',
    'Consultando precios…': 'Checking prices…',
    'Entrar': 'Enter',
    'Entrar al grupo': 'Join the group',
    'Entra al grupo con el botón de abajo': 'Join the group with the button below',
    'Es el que usaremos para dejarte entrar': 'This is what we will use to let you in',
    'Es con este nombre con el que te dejaremos entrar.': 'This is the name we will use to let you in.',
    'Cuando lo tengas, pasa a': 'Once you have it, move on to',
    'He comprobado que': 'I have checked that',
    'Elegir': 'Choose',

    /* ══════════════ PRIZE POOL ══════════════ */
    'Quiero participar': 'I want to enter',
    'Confirmar participación': 'Confirm entry',
    'Ya estás participando': 'You are already entered',
    'Cobrar mi premio': 'Claim my prize',
    'Cierra en': 'Closes in',
    'Estado': 'Status',
    'Evento': 'Event',
    'Ganadores': 'Winners',
    'Ganan': 'They win',
    'Pones': 'You put in',
    'Tienes': 'You have',
    'Se reparte': 'It is shared out',
    'Si entran': 'If there are',
    'Fondo comunitario': 'Community fund',
    'Fondo total de premios': 'Total prize fund',
    'fondo común de premios': 'shared prize fund',
    'Distribución estimada de premios': 'Estimated prize distribution',
    'Funcionamiento económico': 'How the economics work',
    'El sorteo está esperando': 'The draw is waiting',
    'Nadie pierde nada': 'Nobody loses anything',
    'Multiplicas tu entrada': 'You multiply your entry',
    'Podrás salirte durante': 'You can withdraw during',
    'Si no ganas, lo único que arriesgaste fue': 'If you do not win, all you risked was',
    'devuelve tu aporte': 'returns your contribution',
    'directo a tu wallet': 'straight to your wallet',
    'Gas del sorteo (solo lo ves tú)': 'Draw gas (only you see this)',

    /* ══════════════ TOOLS ══════════════ */
    'Empezar': 'Start',
    'Tus alertas': 'Your alerts',
    'Avísame cuando el precio…': 'Notify me when the price…',
    'Te avisamos cuando una moneda llegue al precio que marques.':
      'We notify you when a coin reaches the price you set.',
    'El precio': 'The price',
    'avisada': 'notified',
    'en este navegador': 'in this browser',
    'Revisando tu wallet': 'Checking your wallet',
    'Buscando monedas con saldo…': 'Looking for coins with balance…',
    'No encontramos monedas en tu wallet en esta red.': 'We found no coins in your wallet on this network.',
    'Estos son los restos que tienes repartidos. Elige a qué moneda quieres pasarlos todos.':
      'These are the leftovers you have scattered. Choose which coin to convert them all to.',
    'Juntar lo marcado': 'Combine selected',
    'No has marcado nada': 'You have not selected anything',
    'Pasarlo todo a': 'Convert everything to',
    'Se cambiarán todas a': 'They will all be swapped to',
    'un intercambio por moneda': 'one swap per coin',
    'No se pudo cargar el gráfico.': 'Could not load the chart.',
    'Revisa tu conexión y vuelve a abrirlo.': 'Check your connection and open it again.',
    'No se pudo consultar el índice ahora mismo.': 'Could not check the index right now.',
    'Inténtalo en un momento.': 'Try again in a moment.',

    /* ══════════════ EXTRAS ══════════════ */
    'Instalar CriptoCuba': 'Install CriptoCuba',
    'Instalar CriptoCuba en tu equipo': 'Install CriptoCuba on your computer',
    'Cómo instalarla': 'How to install it',
    'Descargar': 'Download',
    'Descargar tu historial': 'Download your history',
    'Informe generado': 'Report generated',
    'Operaciones cerradas': 'Closed trades',
    'Invertido': 'Invested',
    'Tipo': 'Type',
    'Bloque': 'Block',
    'Abrir…': 'Open…',
    'Estás usando': 'You are using',
    'Cripto Cuba': 'Cripto Cuba',
    'Bots de trading en tu wallet': 'Trading bots in your wallet',
    'Bots de trading en tu propia wallet · sin custodia': 'Trading bots in your own wallet · non-custodial',
    'Este bot todavía no ha cerrado ninguna operación.': 'This bot has not closed any trade yet.',
    'En cuanto el precio alcance una de tus cuadrículas, aparecerá aquí.':
      'As soon as the price reaches one of your grids, it will appear here.',
    'Se guarda una hoja de cálculo con': 'A spreadsheet is saved with',
    'Si aún no ha cerrado ninguna, el archivo se descargará vacío, indicándolo.':
      'If none have closed yet, the file downloads empty, saying so.',
    'Se abrirá CriptoCuba como una aplicación, en su propia ventana.':
      'CriptoCuba will open as an app, in its own window.',
    'Se abre al instante, con su icono y a pantalla completa.':
      'It opens instantly, with its icon and full screen.',
    'Déjala fija en la barra de tareas': 'Pin it to the taskbar',
    'Haz clic ahí': 'Click there',
    'Mira arriba, a la derecha de la barra de búsqueda': 'Look up top, to the right of the search bar',
    'Si no ves ese icono, es que CriptoCuba ya está instalada. Búscala en tu menú de inicio.':
      'If you do not see that icon, CriptoCuba is already installed. Look for it in your start menu.',

    /* ══════════════ BOTS · RESTO ══════════════ */
    'Todavía no tienes bots': 'You have no bots yet',
    'Ver el bot trabajando ▾': 'See the bot working ▾',
    'Resumen del Cash Out': 'Cash Out summary',
    'Resumen del DCA': 'DCA summary',
    'Resumen del acumulador': 'Accumulator summary',
    'Precio del mercado': 'Market price',
    'Precio mínimo': 'Minimum price',
    'Precio mínimo (hasta dónde compra)': 'Minimum price (how far down it buys)',
    'Precio promedio estimado': 'Estimated average price',
    'Primera compra': 'First buy',
    'al encender': 'on start',
    'cargado en tu wallet para las siguientes.': 'loaded in your wallet for the next ones.',
    'cargado para las siguientes.': 'loaded for the next ones.',
    'La primera compra se hace ahora mismo.': 'The first buy is made on start.',
    'Próxima compra': 'Next buy',
    'Por compra': 'Per buy',
    'Total a invertir': 'Total to invest',
    'Total:': 'Total:',
    'Valor ahora': 'Current value',
    'Recibes (estimado)': 'You receive (estimated)',
    'Recibirás al objetivo': 'You will receive at target',
    'Operaciones/día (est.)': 'Trades/day (est.)',
    'Ritmo (s)': 'Interval (s)',
    'Ritmo mín (s)': 'Min interval (s)',
    'Protección': 'Protection',
    'Protección %': 'Protection %',
    'Protección precio %': 'Price protection %',
    'Protegerme de caídas': 'Protect me from drops',
    'Vender al %': 'Sell at %',
    'Vender cuando gane': 'Sell when it gains',
    'Suba un %': 'Rises by %',
    'Recargar': 'Reload',
    'Pagas': 'You pay',
    'Para': 'For',
    'Spot': 'Spot',
    'Semanal': 'Weekly',
    'Quincenal': 'Fortnightly',
    'acumulado': 'accumulated',
    'ahora mismo': 'right now',
    'baja': 'falls',
    'Son las': 'They are',
    'Sugerir según el precio de ahora': 'Suggest based on the current price',
    'Prueba con tu cantidad': 'Try it with your amount',
    'Rango amplio para dormir tranquilo': 'Wide range to sleep easy',
    'Un rango más amplio hace el bot': 'A wider range makes the bot',
    'Sin resultados. Prueba con otro nombre o pega su dirección.':
      'No results. Try another name or paste its address.',

    /* ── Explicaciones ── */
    'Qué hace el bot.': 'What the bot does.',
    'Qué es una cuadrícula.': 'What a grid is.',
    'Por qué es útil.': 'Why it is useful.',
    'Por qué apenas cuesta.': 'Why it costs almost nothing.',
    'bajar tu precio medio': 'lower your average price',
    'Semanal o mensual, no diario.': 'Weekly or monthly, not daily.',
    'Si el mercado se queda plano': 'If the market goes flat',
    'Si el mercado solo sube': 'If the market only goes up',
    'Si el precio se sale del rango por abajo': 'If the price leaves the range below',
    'Si se sale por arriba': 'If it leaves above',
    'Son cuentas con las comisiones reales ya restadas.': 'These figures already have real fees deducted.',
    'Para que el bot compre cuando el precio baje.': 'So the bot buys when the price falls.',
    'Para que el bot pueda vender lo que vaya comprando y dejarte la ganancia.':
      'So the bot can sell what it buys and leave you the profit.',
    'Para que pueda vender todo lo acumulado.': 'So it can sell everything accumulated.',
    'Se crea tu bot con tu configuración y empieza a vigilar el mercado.':
      'Your bot is created with your settings and starts watching the market.',
    'Se crea tu DCA y hace la primera compra ahora.': 'Your DCA is created and makes the first buy now.',
    'Se crea tu acumulador y hace la compra inicial.': 'Your accumulator is created and makes the initial buy.',
    'Vende al llegar a tu objetivo y recibes': 'Sells on reaching your target and you receive',
    'Vende solo cuando el precio llegue a tu objetivo y recibe':
      'Sells only when the price reaches your target and receives',
    'Paso 2 de 2 — Confirma el intercambio.': 'Step 2 of 2 — Confirm the swap.',
    'Te pediré firmar': 'I will ask you to sign',
    'Ten esa moneda agregada en tu wallet para verla: llega igual.':
      'Add that coin to your wallet to see it: it arrives either way.',

    /* ── Avisos ── */
    'Puedes perder dinero.': 'You can lose money.',
    'Usa solo dinero que puedas dejar quieto.': 'Only use money you can leave untouched.',
    'Tu dinero sigue en tu wallet.': 'Your money stays in your wallet.',
    'Tu cripto se queda en tu wallet': 'Your crypto stays in your wallet',
    'Tu cripto se queda en tu wallet.': 'Your crypto stays in your wallet.',
    'Ya está en tu wallet.': 'It is already in your wallet.',
    'Tu cripto sigue en tu wallet; solo le das permiso para venderla al llegar el objetivo. Ten':
      'Your crypto stays in your wallet; you only grant permission to sell it at target. Have',
    'Tu frase de recuperación': 'Your recovery phrase',
    'Si las pierdes,': 'If you lose it,',
    'La red está lenta o hubo un corte momentáneo. Tus bots y tu dinero siguen intactos en la blockchain.':
      'The network is slow or there was a brief outage. Your bots and your money are intact on the blockchain.',
    'No se pudieron leer todos sus detalles. Puedes cerrarlo aquí; tu cripto queda en tu wallet.':
      'We could not read all its details. You can close it here; your crypto stays in your wallet.',

    /* ══════════════ MARKET · RESTO ══════════════ */
    'Publicar oferta': 'Post offer',
    'Mis publicaciones': 'My listings',
    'Reservar': 'Reserve',
    'Reservado': 'Reserved',
    'Ya pagué, avisar': 'I have paid, notify',
    'Confirmar recepción': 'Confirm receipt',
    'Marcar como pagado': 'Mark as paid',
    'Esperando pago': 'Awaiting payment',
    'Esperando confirmación': 'Awaiting confirmation',
    'Pago declarado': 'Payment declared',
    'Operación completada': 'Trade completed',
    'Operación cancelada': 'Trade cancelled',
    'En disputa': 'In dispute',
    'Tiempo restante': 'Time remaining',
    'Vendedor': 'Seller',
    'Comprador': 'Buyer',
    'Método de pago': 'Payment method',
    'Efectivo': 'Cash',
    'Transferencia': 'Bank transfer',
    'Cantidad mínima': 'Minimum amount',
    'Cantidad máxima': 'Maximum amount',
    'Tu oferta': 'Your offer',
    'Ver perfil': 'View profile',
    'Calificación': 'Rating',
    'Operaciones completadas': 'Completed trades',
    'Sin calificaciones aún': 'No ratings yet',
    'Escribe un mensaje': 'Write a message',
    'Adjuntar comprobante': 'Attach receipt',
    'Ver comprobante': 'View receipt',
    'Cómo funciona el marketplace': 'How the marketplace works',
    'Tu dinero queda en la caja fuerte hasta que ambos confirmen.':
      'Your money stays in escrow until both parties confirm.',

    /* ══════════════ ACADEMIA · RESTO ══════════════ */
    'Empezar el curso': 'Start the course',
    'Continuar donde lo dejé': 'Continue where I left off',
    'Clase': 'Class',
    'Módulo': 'Module',
    'Lección': 'Lesson',
    'Completada': 'Completed',
    'Bloqueada': 'Locked',
    'Aprobado': 'Passed',
    'No aprobado': 'Not passed',
    'Repetir examen': 'Retake exam',
    'Ver certificado': 'View certificate',
    'Tu progreso': 'Your progress',
    'Siguiente clase': 'Next class',
    'Clase anterior': 'Previous class',
    'Preguntas': 'Questions',
    'Respuesta correcta': 'Correct answer',
    'Respuesta incorrecta': 'Incorrect answer',
    'Tu suscripción': 'Your subscription',
    'Renovar': 'Renew',
    'Renovar ahora': 'Renew now',
    'Ver los planes': 'View the plans',
    'Elegir plan': 'Choose plan',
    'Pagar con BNB': 'Pay with BNB',
    'Pagar con USDT': 'Pay with USDT',
    'Tu acceso caduca en': 'Your access expires in',
    'Acceso caducado': 'Access expired',

    /* ══════════════ PRIZE POOL · RESTO ══════════════ */
    'Salirme del sorteo': 'Leave the draw',
    'Ver ganadores': 'View winners',
    'Sorteo en curso': 'Draw in progress',
    'Sorteo cerrado': 'Draw closed',
    'Tu aporte': 'Your contribution',
    'Premio estimado': 'Estimated prize',
    'Número de participantes': 'Number of participants',
    'Se sortea': 'Drawn on',

    /* ══════════════ COMUNES · RESTO ══════════════ */
    'Reintentar': 'Retry',
    'Actualizar': 'Refresh',
    'Cerrar sesión': 'Sign out',
    'Configurar': 'Configure',
    'Avanzado': 'Advanced',
    'Básico': 'Basic',
    'Opciones': 'Options',
    'Resumen': 'Summary',
    'Historial': 'History',
    'Sin actividad': 'No activity',
    'Cargando datos…': 'Loading data…',
    'Algo salió mal': 'Something went wrong',
    'Inténtalo de nuevo': 'Try again',
    'Copiar dirección': 'Copy address',
    'Dirección copiada': 'Address copied',
    'Red': 'Network',
    'Comisión': 'Fee',
    'Estimado': 'Estimated',
    'Confirmado': 'Confirmed',
    'Fallido': 'Failed',

    /* ══════════════ ASISTENTE ══════════════ */
    'Escribe tu pregunta…': 'Type your question…',
    'Asistente': 'Assistant',
    'Escribiendo…': 'Typing…',
    '¿Te aclaro algo más?': 'Anything else I can clear up?',
    'Abrir la herramienta': 'Open the tool',
    'Abrirla': 'Open it',
    'Algo más simple': 'Something simpler',
    'Con números': 'With numbers',
    'Conectar wallet': 'Connect wallet',
    'Consejos': 'Tips',
    'Cuánto cuesta': 'How much it costs',
    'Cuánto necesito': 'How much do I need',
    'Cuéntame más': 'Tell me more',
    'Cómo empiezo': 'How do I start',
    'Cómo lo uso': 'How do I use it',
    'Cómo se usa': 'How it is used',
    'El Marketplace': 'The Marketplace',
    'El gas': 'Gas',
    'El precio medio': 'The average price',
    'El sorteo': 'The draw',
    'Enséñame a usarlo': 'Teach me to use it',
    'Fuera de rango': 'Out of range',
    'Guíame': 'Guide me',
    'Guíame a comprar': 'Guide me to buy',
    'Guíame a vender': 'Guide me to sell',
    'Hablar con alguien': 'Talk to someone',
    'La Academia': 'The Academy',
    'Los bots': 'The bots',
    'Los colores': 'The colours',
    'Los planes': 'The plans',
    'Qué es': 'What it is',
    'Qué significa': 'What it means',
    'Ver ejemplo': 'See example',
    'Volver al inicio': 'Back to start',
    'Otra cosa': 'Something else',
    'Tengo un problema': 'I have a problem',
    'Problema con la academia': 'Problem with the academy',
    'Problema con los bots': 'Problem with the bots',
    'Problema con el marketplace': 'Problem with the marketplace',
    'No entiendo': 'I do not understand',
    'Gracias': 'Thanks',
    'Sí, por favor': 'Yes, please',
    'No, gracias': 'No, thanks',

    /* ══════════════ FRAGMENTOS Y ETIQUETAS ══════════════ */
    '¿Tienes dudas sobre cómo funciona la plataforma?': 'Questions about how the platform works?',
    '¿Tienes dudas? Toca aquí': 'Got questions? Tap here',
    '¿Cada cuánto compra?': 'How often does it buy?',
    '¿Cuántas compras?': 'How many buys?',
    'vende todo de golpe': 'sells everything at once',
    'vende todo junto': 'sells it all together',
    'precio del mercado': 'market price',
    'todo lo que compró': 'everything it bought',
    'sigue bajando y no vuelve a subir': 'keeps falling and never comes back up',
    'cae por debajo del mínimo que pusiste': 'falls below the minimum you set',
    'bien abajo': 'well below',
    'una operación': 'one trade',
    'sube mucho más': 'rises much further',
    'precio medio razonable': 'reasonable average price',
    'solo compra, no vende': 'only buys, does not sell',
    'meses': 'months',
    'rango': 'range',
    'cuadrículas': 'grids',
    'cuadrícula': 'grid',
    'separación': 'spacing',
    'cuando el precio baja a un escalón, compra. Cuando sube al siguiente, vende.':
      'when the price drops to a step, it buys. When it rises to the next, it sells.',
    'el bot no vende': 'the bot does not sell',
    'por cuadrícula': 'per grid',
    'menos sensible': 'less sensitive',
    'todos los bots que quieras': 'as many bots as you want',
    'todos': 'all',
    'todo tu dinero vuelve a tu wallet': 'all your money returns to your wallet',
    'en pérdida': 'at a loss',
    'una transacción por bot': 'one transaction per bot',
    'tú eres responsable de tus claves': 'you are responsible for your keys',
    'nadie puede recuperarlas': 'nobody can recover them',
    'es una estafa': 'it is a scam',
    'máximo alcanzado': 'maximum reached',
    'varias veces': 'several times',
    '¿Tenías bots creados? Puede que estén con otra cuenta: revisa cuál tienes activa en tu wallet.':
      'Had bots created? They may be under another account: check which one is active in your wallet.',
    'sin ventas armadas': 'no sells set up',
    'sin compras armadas': 'no buys set up',
    'precio ahora': 'price now',
    'para operar': 'to trade',
    'tu coste': 'your cost',
    'precio de venta': 'sale price',
    'sin fijar': 'not set',
    'vende manualmente': 'sells manually',
    'compró': 'bought',
    'vendió': 'sold',
    'tu entrada': 'your entry',
    'precio exacto': 'exact price',
    'espera comprar': 'waiting to buy',
    'espera vender': 'waiting to sell',
    'total': 'total',
    'restante': 'remaining',
    'disponible': 'available',
    'invertido': 'invested',
    'ganado': 'earned',
    'perdido': 'lost',
    'activo': 'active',
    'pausado': 'paused',
    'cerrado': 'closed',
    'pendiente': 'pending',
    'confirmado': 'confirmed',
    'aproximadamente': 'approximately',
    'por ahora': 'for now',
    'más tarde': 'later',
    'nunca': 'never',
    'siempre': 'always',
    'a veces': 'sometimes',

    /* ══════════════ MARKET · FRAGMENTOS ══════════════ */
    'vender y comprar cripto entre personas': 'buying and selling crypto between people',
    '¿quién manda primero?': 'who sends first?',
    'Ya no la tiene él': 'He no longer has it',
    'en la blockchain, y nadie lo puede borrar ni falsificar':
      'on the blockchain, and nobody can erase or forge it',
    'nadie puede desaparecer con él': 'nobody can disappear with it',
    'no le gusta nada': 'nobody likes it',
    'Todavía no hay ofertas publicadas.': 'No offers posted yet.',
    'Sé el primero: pasa a "Vender".': 'Be the first: go to "Sell".',
    'Todavía no tienes operaciones.': 'You have no trades yet.',
    'Publica una oferta o reserva una de otra persona.': 'Post an offer or reserve one from someone else.',
    'trabados aquí': 'locked here',
    'Zona:': 'Area:',
    'Vendedor:': 'Seller:',
    'Ver distancia hasta mí': 'See distance from me',
    'si se niega, tú decides si sigues': 'if they refuse, you decide whether to continue',
    'Reservar esta compra': 'Reserve this purchase',
    'Queda apartada para ti': 'It is held for you',
    'Tu Telegram o WhatsApp': 'Your Telegram or WhatsApp',
    'País': 'Country',
    'Paso 2 · Deposita tu fianza': 'Step 2 · Deposit your collateral',
    'tuya': 'yours',
    'Todo listo para vender': 'All set to sell',
    'Todo listo para comprar': 'All set to buy',
    'Unas preguntas cortas y tu oferta queda publicada.': 'A few short questions and your offer is posted.',
    'Unas preguntas cortas y tu anuncio queda publicado.': 'A few short questions and your listing is posted.',
    'redondeada a 1 km aprox.': 'rounded to about 1 km.',
    'nunca tu dirección exacta': 'never your exact address',
    'tu sistema tiene la ubicación desactivada': 'your system has location turned off',
    'Ubicación': 'Location',
    'Permitir': 'Allow',
    'Sí, compartir mi zona': 'Yes, share my area',
    'Se guarda redondeada, sin tu dirección exacta': 'Saved rounded, without your exact address',
    'Puedes activarlo después': 'You can enable it later',
    'Vender todo': 'Sell everything',
    'solo alcanza una parte': 'only covers part of it',
    'la mayor cantidad de partes posible': 'as many parts as possible',
    '¿En qué horario prefieres que te escriban?': 'What hours do you prefer to be contacted?',
    'Una aclaración o sugerencia para la persona que te vaya a comprar.':
      'A note or suggestion for whoever buys from you.',
    '¿Cómo funciona esto?': 'How does this work?',
    'Retirar todos mis fondos': 'Withdraw all my funds',
    'Retirar fondos': 'Withdraw funds',
    'todo tu dinero': 'all your money',
    'todas tus publicaciones se cancelan al instante': 'all your listings are cancelled instantly',
    'no se toca': 'is not touched',
    '¿Retiraste y sigue apareciendo saldo?': 'Withdrew and still see a balance?',
    'nuevo': 'new',
    'Ya me llegó · liberar': 'It arrived · release',
    'contactarlo': 'contact them',
    'solo entonces': 'only then',
    'Publicada': 'Posted',
    'Tomada': 'Taken',
    'solo si ya enviaste el dinero': 'only if you already sent the money',
    'la cripto sale de la caja fuerte y va al comprador': 'the crypto leaves escrow and goes to the buyer',
    'se cierra': 'it closes',
    'vuelve a tu wallet': 'returns to your wallet',
    'desaparece del listado': 'disappears from the listing',
    'vuelve a estar visible': 'becomes visible again',
    'devolverte la cripto que quede': 'return whatever crypto is left',
    'pasado el plazo de espera': 'once the waiting period has passed',
    'la cripto trabada vuelve al vendedor': 'the locked crypto returns to the seller',
    'tu cripto vuelve a tu wallet': 'your crypto returns to your wallet',
    '¿Qué pasó?': 'What happened?',
    'sé concreto': 'be specific',
    'la operación se detiene': 'the trade is halted',
    '¿Cómo te fue con esta persona?': 'How did it go with this person?',

    /* ══════════════ ACADEMIA · FRAGMENTOS ══════════════ */
    'gestión de riesgo': 'risk management',
    'software': 'software',
    'masterclass de economía': 'economics masterclass',
    'cómo identificar la dirección del mercado': 'how to identify market direction',
    'repaso especial': 'special review',
    'Una ruta ordenada, con exámenes para avanzar. No es una carpeta de vídeos sueltos.':
      'An ordered path, with exams to progress. Not a folder of loose videos.',
    'clases': 'classes',
    'con examen': 'with exam',

    /* ══════════════ BOTS · FRAGMENTOS ══════════════ */
    'ya no opera': 'no longer trades',
    'vendió todo': 'sold everything',
    'quitará el permiso': 'will revoke the approval',
    '¡Intercambio hecho!': 'Swap done!',
    'Última firma para completar.': 'One last signature to complete.',
    'Todo tranquilo.': 'All quiet.',

    /* ══════════════ ÚLTIMOS ══════════════ */
    'candado 🔒': 'padlock 🔒',
    'audiolibros': 'audiobooks',
    'uno a uno': 'one to one',
    'fases': 'phases',
    'de la estrategia': 'of the strategy',
    'preguntas': 'questions',
    'examen final': 'final exam',
    'Solo para miembros': 'Members only',
    '¿Ya eres miembro?': 'Already a member?',
    'No se pudo cargar el panel. Recarga la página.': 'Could not load the panel. Reload the page.',
    'Tu panel de aprendizaje': 'Your learning panel',
    'Ves la clase': 'You watch the class',
    'Sacas': 'You score',
    'responde aunque no lo sepas': 'answer even if you do not know',
    'Vuelve siempre aquí': 'Always come back here',
    'Sé sincero contigo mismo.': 'Be honest with yourself.',
    'sé sincero contigo mismo.': 'be honest with yourself.',
    'Terminadas las 17, sigue con': 'Once the 17 are done, continue with',
    'Y después, en este orden': 'And then, in this order',
    'Y recuerda:': 'And remember:',
    'No pudimos consultar los precios ahora mismo.': 'We could not check prices right now.',
    'Revisa tu conexión y vuelve a abrir.': 'Check your connection and open it again.',
    'usuario': 'username',
    'Tendrás acceso al grupo durante': 'You will have access to the group for',
    'Sin la arroba. Lo encuentras en Telegram → Ajustes → Nombre de usuario.':
      'Without the @. Find it in Telegram → Settings → Username.',
    'El pago va directo al contrato. Si pagas en BNB y el precio se mueve, lo que sobre se te devuelve en el acto.':
      'Payment goes straight to the contract. If you pay in BNB and the price moves, any excess is returned instantly.',
    'Revisa tu usuario': 'Check your username',
    'Si está mal, no podremos reconocerte.': 'If it is wrong, we will not be able to recognise you.',
    'ese es exactamente': 'that is exactly',
    'Sin reembolso.': 'Non-refundable.',
    '¿Cómo comprobarlo? En Telegram: Ajustes → Nombre de usuario. O abre':
      'How to check? In Telegram: Settings → Username. Or open',
    'Volver y corregir': 'Go back and fix it',
    'Paso 1 de 2 — Permiso.': 'Step 1 of 2 — Approval.',
    'Paso 2 de 2 — Pago.': 'Step 2 of 2 — Payment.',
    'Ya está': 'Done',
    'Pide unirte con': 'Request to join with',
    'esa misma cuenta': 'that same account',
    'Se te acepta solo, en menos de un minuto': 'You are accepted automatically, in under a minute',
    'Si te acercas al final, renueva desde aquí:': 'If you are near the end, renew from here:',
    'los días que te queden se suman': 'your remaining days carry over',

    /* ── Prize Pool ── */
    'premio grande': 'big prize',
    'muchos ganadores': 'many winners',
    'oportunidad con reglas claras': 'an opportunity with clear rules',
    'siempre está en tu wallet': 'is always in your wallet',
    'si ganas': 'if you win',
    'más gente entra, más grande es el premio': 'the more people enter, the bigger the prize',
    'verificable en la blockchain': 'verifiable on the blockchain',
    'salirte y recuperar tu aporte': 'leave and recover your contribution',
    'real y se reparte': 'real and shared out',
    'recuperas eso y varias veces más': 'you get that back and several times more',
    'gana 1 de cada 5 participantes': '1 in every 5 participants wins',
    'participantes gana': 'participants win',
    'se te devuelve tu aporte': 'your contribution is returned',
    '¡Ganaste!': 'You won!',
    'Ganado · listo para cobrar': 'Won · ready to claim',
    'Cobrar': 'Claim',
    'El mínimo es': 'The minimum is',
    'Todavía no hay resultados oficiales.': 'No official results yet.',

    /* ── Extras ── */
    'Y en tu teléfono: escanea este código.': 'And on your phone: scan this code.',
    'Se abrirá en su propia ventana, con su icono, sin barras del navegador y arranca al instante.':
      'It will open in its own window, with its icon, no browser bars, and starts instantly.',
    'Tu navegador te pedirá una confirmación final.': 'Your browser will ask for one final confirmation.',
    'clic derecho': 'right-click',
    'Tipo de bot': 'Bot type',
    'Vueltas completas': 'Completed cycles',
    'todas las operaciones que el bot ha cerrado': 'every trade the bot has closed',
    'Datos leídos directamente de la blockchain (BNB Smart Chain). CriptoCuba no custodia fondos.':
      'Data read directly from the blockchain (BNB Smart Chain). CriptoCuba does not custody funds.',
    'Los bots necesitan permiso para mover tus monedas. Cuando dejes de usarlos,':
      'Bots need approval to move your coins. When you stop using them,',
    'Te avisamos cuando alguien tome tu oferta, marque un pago o libere un tramo.':
      'We notify you when someone takes your offer, marks a payment or releases a portion.',
    'Los datos se leen directamente de la blockchain. Tu nombre se guarda solo en este dispositivo.':
      'Data is read directly from the blockchain. Your name is stored only on this device.',
    'Datos leídos de la blockchain. Tu nombre solo se guarda en este dispositivo.':
      'Data read from the blockchain. Your name is stored only on this device.',
    'Copiar enlace': 'Copy link',
    'No se pudo dibujar el código. Usa "Copiar enlace" y pégalo en tu wallet.':
      'Could not draw the code. Use "Copy link" and paste it in your wallet.',
    'El precio final puede variar un poco mientras se ejecuta. Es normal en cualquier intercambio.':
      'The final price may vary slightly while executing. This is normal in any swap.',
    'Con CriptoCuba ya abierta, busca su icono abajo en la barra de tareas de Windows, haz':
      'With CriptoCuba open, find its icon in the Windows taskbar below and',
    'Junta los restos de monedas que te van quedando': 'Collects the leftover crumbs of coins you accumulate',

    /* ══════════════ LIQUIDITY POOLS ══════════════ */
    'Calculando el mapa de liquidaciones…': 'Calculating the liquidation map…',
    'menos liquidez': 'less liquidity',
    'muros de liquidación': 'liquidation walls',
    'Filtro de ruido': 'Noise filter',
    'Mostrar': 'Show',
    'Perfil de volumen': 'Volume profile',
    'Mapa de liquidez': 'Liquidity map',
    'Reencuadrar': 'Reframe',
    'Pago': 'Payment',
    'el mapa de dónde está el dinero atrapado': 'the map of where the money is trapped',
    'aceleran el movimiento': 'accelerate the move',
    'barrer esa zona': 'sweep that zone',
    'atraviesa en minutos': 'crosses in minutes',
    'Las de x100 saltan primero': 'The x100 ones blow up first',
    'Qué hacer: si el x100 muestra un muro cerca del precio, espera volatilidad pronto.':
      'What to do: if x100 shows a wall near the price, expect volatility soon.',
    'información, no una señal': 'information, not a signal',
    'De dónde salen estos datos': 'Where this data comes from',
    'ya se liquidaron': 'have already been liquidated',
    'Azul — liquidez de fondo': 'Blue — background liquidity',
    'Verde — acumulación media': 'Green — medium accumulation',
    'Amarillo — zona importante': 'Yellow — important zone',
    'Rojo — muro de liquidación': 'Red — liquidation wall',

    /* ══════════════ RADAR INSTITUCIONAL ══════════════ */
    'Observando…': 'Watching…',
    'Necesitamos unos segundos de observación para distinguir el dinero real del humo.':
      'We need a few seconds of observation to tell real money from smoke.',
    'Analizando el libro de órdenes…': 'Analyzing the order book…',
    'Es humo': 'It is smoke',
    'ya no está': 'is gone',
    'Se está ejecutando ahora mismo.': 'It is being executed right now.',
    'El precio está tocando este nivel.': 'The price is touching this level.',
    'rechazo': 'rejection',
    'rebote': 'bounce',
    'la mayoría de las grandes son falsas': 'most of the large ones are fake',
    'cada segundo y medio': 'every second and a half',
    'cuánto dinero hay': 'how much money there is',
    'a qué precio': 'at what price',
    'a qué distancia': 'how far away',
    'se consume y vuelve a aparecer': 'is consumed and reappears',
    'la orden lo frenó': 'the order stopped it',
    'el precio todavía no lo ha puesto a prueba': 'the price has not tested it yet',
    'huir cuando el precio se acerca': 'flee when the price approaches',
    'El mercado cambia y el veredicto también.': 'The market changes and so does the verdict.',
    'cambia sola': 'changes on its own',

    /* ══════════════ TUTORIAL ══════════════ */
    'Ver guía': 'View guide',
    'Guía de los bots ·': 'Bot guide ·',
    'toca uno para aprender': 'tap one to learn',
    'Cómo trabaja, paso a paso': 'How it works, step by step',
    'Por qué funciona': 'Why it works',
    'Qué te garantiza la blockchain': 'What the blockchain guarantees you',
    'es exactamente de dónde sale la ganancia': 'is exactly where the profit comes from',
    'nunca salen de tu control': 'never leave your control',
    'compra más': 'buys more',
    'baja tu precio promedio': 'lowers your average price',
    'el bot compra más barato y en mayor cantidad': 'the bot buys cheaper and in larger amounts',
    'no necesitas que el mercado vuelva a la cima': 'you do not need the market to return to its peak',
    'paga menos comisiones': 'pays fewer fees',
    'no vender cuando había que vender': 'not selling when you should have sold',
    'sigue vigente': 'still applies',
    'el promedio te acerca al precio justo': 'averaging brings you closer to a fair price',

    /* ══════════════ COMPRAR CRIPTO ══════════════ */
    'Con tarjeta': 'With card',
    'Intercambiar cripto': 'Swap crypto',
    'Desde Cuba': 'From Cuba',
    'Tarjeta · Apple/Google Pay · PayPal': 'Card · Apple/Google Pay · PayPal',
    'Tarjeta · transferencia bancaria': 'Card · bank transfer',
    'Tarjeta · Apple/Google Pay': 'Card · Apple/Google Pay',
    'Intercambiar en PancakeSwap': 'Swap on PancakeSwap',
    'USDT con CUP/MLC · Transfermóvil · EnZona': 'USDT with CUP/MLC · Transfermóvil · EnZona',
    'elige por dónde, te llevamos a una plataforma segura':
      'choose how, and we take you to a secure platform',

    /* ══════════════ GRÁFICA ══════════════ */
    'Cargando gráfica…': 'Loading chart…',
    'Velas reales de': 'Real candles from',
    'tus cuadrículas': 'your grids',
    'Tus cuadrículas salen del contrato: son las de verdad':
      'Your grids come from the contract: they are the real ones',
    'No se pudo cargar la gráfica.': 'Could not load the chart.',
    'Vuelve a intentarlo en un momento.': 'Try again in a moment.',

    /* ══════════════ ASISTENTE Y OTROS ══════════════ */
    'En línea': 'Online',
    'Temas': 'Topics',
    'Entrar a la comunidad': 'Join the community',
    'gente que ya usa CriptoCuba': 'people already using CriptoCuba',
    'Tira para actualizar': 'Pull to refresh',

    /* ══════════════ AUDITORÍA · FRASES FINALES ══════════════ */
    'Plan de risk management, con software para aplicarlo': 'Risk management plan, with software to apply it',
    '17 clases de cero a cien, con examen cada una': '17 classes from zero to a hundred, each with an exam',
    '20 audiolibros escogidos por un trader con 10 años de oficio':
      '20 audiobooks chosen by a trader with 10 years in the business',
    'Tutoriales de las herramientas de verdad': 'Tutorials on the tools that matter',
    'Acceso al grupo mientras dure tu plan': 'Group access for as long as your plan lasts',
    'Cómo repartir tu dinero y cuánto arriesgar. Hecho a medida de nuestra estrategia, no es un plan genérico.':
      'How to allocate your money and how much to risk. Tailored to our strategy, not a generic plan.',
    'Antes de operar un solo dólar. Cómo repartir tu dinero, cuánto arriesgar por operación y cuándo parar.':
      'Before trading a single dollar. How to allocate your money, how much to risk per trade and when to stop.',
    'No pasa nada: sirve para ver dónde flojeas.': 'No problem: it shows where you are weak.',
    'Baja hasta el final del examen y encontrarás': 'Scroll to the end of the exam and you will find',
    'para pasar de una clase a otra.': 'to move from one class to another.',
    'Puedes saltarte un examen o copiar las respuestas, y nadie se enterará.':
      'You can skip an exam or copy the answers, and nobody will know.',
    'Van en orden por una razón: cada una se apoya en la anterior.':
      'They are in order for a reason: each builds on the one before.',

    /* ── Tools ── */
    'Junta los restos de monedas que te van quedando y los pasa todos a una sola.':
      'Collects the leftover crumbs of coins and converts them all into one.',
    'Te avisa cuando una moneda llega al precio que marques.':
      'Alerts you when a coin reaches the price you set.',
    'El humor del mercado en un número. Sirve para saber si la gente está comprando por euforia o vendiendo por pánico.':
      'Market sentiment in a single number. Tells you whether people are buying on euphoria or selling on panic.',
    'Qué dicen los indicadores de una moneda ahora mismo: comprar, vender o esperar.':
      'What the indicators say about a coin right now: buy, sell or wait.',
    'Qué dicen los indicadores más usados, en un solo medidor':
      'What the most used indicators say, in a single gauge',
    'Todas las monedas de un vistazo, por tamaño y color. Verde sube, rojo baja.':
      'All coins at a glance, by size and colour. Green rises, red falls.',
    'El gráfico completo, con velas y herramientas de dibujo.':
      'The full chart, with candles and drawing tools.',
    'Sirve para ver de un vistazo si el mercado entero se mueve o solo una moneda.':
      'Useful to see at a glance whether the whole market is moving or just one coin.',
    'Esto no es un consejo: es lo que dicen los indicadores ahora mismo. Úsalo como una opinión más, no como una orden.':
      'This is not advice: it is what the indicators say right now. Treat it as one more opinion, not an order.',

    /* ── Perfil ── */
    'es la forma más segura de dejarlo todo cerrado.': 'is the safest way to leave everything closed.',
    'Vendrá activada: tu suscripción se renovará sola y no tendrás que acordarte cada mes. Podrás desactivarla cuando quieras (se firmará en la blockchain).':
      'It will come enabled: your subscription renews itself and you will not have to remember each month. You can disable it whenever you want (signed on the blockchain).',

    /* Fragmentos partidos por etiquetas <b> dentro del texto */
    'de cero a cien, con examen cada una': 'from zero to a hundred, each with an exam',
    'escogidos por un trader con': 'chosen by a trader with',
    'de oficio': 'in the business',
    '10 años': '10 years',
    '17 clases': '17 classes',
    '20 audiolibros': '20 audiobooks',
    'Plan de risk management, con software para aplicarlo': 'Risk management plan, with software to apply it',
    'No pasa nada: sirve para ver dónde flojeas. Al terminar la clase, repítelo.':
      'No problem: it shows where you are weak. After the class, retake it.',
    'sirve para ver dónde flojeas': 'it shows where you are weak',
    'Te avisa por correo cuando esté listo.': 'It emails you when it is ready.',
    'para pasar de una clase a otra. Si te quedas en el grupo bajando de una a otra, te perderás.':
      'to move from one class to another. If you stay in the group scrolling between them, you will get lost.',
    'Puedes saltarte un examen o copiar las respuestas, y nadie se enterará. Pero el examen no es para nosotros: es para ti.':
      'You can skip an exam or copy the answers, and nobody will know. But the exam is not for us: it is for you.',
    'Van en orden por una razón: cada una se apoya en la anterior.':
      'They are in order for a reason: each builds on the one before.',
    '20 audiolibros escogidos uno a uno por alguien con más de 10 años en trading y criptomonedas. No los escribí yo: los elegí por lo que me sirvieron a mí.':
      '20 audiobooks chosen one by one by someone with over 10 years in trading and crypto. I did not write them: I picked them for what they did for me.',
    '20 audiolibros seleccionados': '20 selected audiobooks',
    'es la forma más segura de dejarlo todo cerrado': 'is the safest way to leave everything closed',

    /* Fragmentos exactos que quedan sueltos entre etiquetas.
       Se guardan con su puntuación tal cual aparece en pantalla,
       porque el motor compara el nodo de texto completo. */
    ', con software para aplicarlo': ', with software to apply it',
    'que te lo explica. Luego repites.': 'explaining it. Then you retake it.',
    'en la materia que acabas de estudiar.': 'on the material you have just studied.',
    '. Van en orden por una razón: cada una se apoya en la anterior.':
      '. They are in order for a reason: each builds on the one before.',
    ': es la forma más eficaz de proteger tu dinero.': ': it is the most effective way to protect your money.',
    '. No pasa nada: sirve para ver dónde flojeas. Al terminar tienes la lista de lo que fallaste y un botón':
      '. No problem: it shows where you are weak. When you finish you get the list of what you got wrong and a button',
    'para pasar de una clase a otra. Si te quedas en el grupo bajando de una a otra, pierdes el hilo y no queda constancia de tu avance.':
      'to move from one class to another. If you stay in the group scrolling between them, you lose the thread and no record of your progress is kept.',
    'Puedes saltarte un examen o copiar las respuestas, y nadie se enterará. Pero el día que operes con tu dinero, el mercado no acepta certificados: acepta lo que de verdad sabes.':
      'You can skip an exam or copy the answers, and nobody will know. But the day you trade with your own money, the market does not accept certificates: it accepts what you actually know.',

    /* ══════════════ LIQUIDATION PRESSURE ══════════════ */
    'Liquidation Pressure': 'Liquidation Pressure',
    'Cuándo el mercado va a purgar': 'When the market is about to purge',
    'Mide la tensión acumulada en los futuros: funding, apalancamiento y posicionamiento. Le avisa antes de que el mercado limpie posiciones.':
      'Measures built-up tension in futures: funding, leverage and positioning. It warns you before the market flushes positions.',
    'Midiendo la presión del mercado': 'Measuring market pressure',
    'Leyendo funding, interés abierto y posicionamiento de todo el mercado.':
      'Reading funding, open interest and positioning across the whole market.',
    'Riesgo extremo de purga': 'Extreme purge risk',
    'Tensión alta': 'High tension',
    'Tensión moderada': 'Moderate tension',
    'Mercado equilibrado': 'Balanced market',
    'Qué hacer': 'What to do',
    'Por qué lo decimos': 'Why we say this',
    'Funding': 'Funding',
    'Posicionamiento': 'Positioning',
    'Apalancamiento': 'Leverage',
    'Próximo cobro': 'Next payment',
    'Los largos pagan': 'Longs are paying',
    'Los cortos pagan': 'Shorts are paying',
    'largos': 'long',
    'cortos': 'short',
    'de su máximo de 48h': 'of its 48h high',
    'se paga el funding': 'funding is charged',
    'Sin señales de tensión': 'No tension signals',
    'Ninguno de los cuatro indicadores está en zona de riesgo ahora mismo.':
      'None of the four indicators is in the risk zone right now.',
    'Datos del mercado de futuros de Binance · se actualizan cada 45 segundos':
      'Binance futures market data · updated every 45 seconds',
    'No se pudieron cargar los datos del mercado.': 'Could not load market data.',
    'Los alcistas pagan una fortuna': 'Bulls are paying a fortune',
    'Los bajistas pagan una fortuna': 'Bears are paying a fortune',
    'Sesgo alcista caro': 'Expensive bullish bias',
    'Sesgo bajista caro': 'Expensive bearish bias',
    'Récord de dinero apalancado': 'Record leveraged money',
    'Entrada rápida de apalancamiento': 'Rapid leverage inflow',
    'Casi todos están largos': 'Almost everyone is long',
    'Casi todos están cortos': 'Almost everyone is short',
    'Desequilibrio en el posicionamiento': 'Positioning imbalance',
    'Combinación de purga': 'Purge combination',
    'Combinación de rebote': 'Bounce combination',

    /* ══════════════ BOTONES Y AVISOS DE LOS BOTS ══════════════ */
    'Pon un rango para ver la rejilla': 'Set a range to see the grid',
    'Cerrar y vender': 'Close and sell',
    'Sí, cerrar': 'Yes, close',
    'Sí, cerrar y vender': 'Yes, close and sell',
    'No, seguir': 'No, keep going',
    'Compra y vende a niveles': 'Buys and sells at levels',
    'compra y vende a niveles': 'buys and sells at levels',
    'Con el botón Cerrar y vender. Vende todo a estable y el dinero queda en tu wallet.':
      'With the Close and sell button. It sells everything to stablecoin and the money stays in your wallet.',
    '¿Cerrar este bot?': 'Close this bot?',
    '¿Cerrar todos los bots?': 'Close all bots?',
    'Se venderá todo lo comprado y el dinero volverá a tu wallet.':
      'Everything bought will be sold and the money returns to your wallet.',
    'Vender todo y cerrar': 'Sell everything and close',
    'Solo cerrar': 'Close only',
    'Cerrando…': 'Closing…',
    'Vendiendo…': 'Selling…',
    'Bot cerrado': 'Bot closed',
    'Creando tu bot…': 'Creating your bot…',
    'Bot creado': 'Bot created',
    'Firma en tu wallet': 'Sign in your wallet',
    'Confirma en tu wallet': 'Confirm in your wallet',
    'Esperando confirmación de la red…': 'Waiting for network confirmation…',
    'Siguiente': 'Next',
    'Anterior': 'Previous',
    'Empezar de nuevo': 'Start over',
    'Ver mis bots': 'View my bots',
    'Entendido, cerrar': 'Got it, close',
    'Saltar': 'Skip',
    'Saltar guía': 'Skip guide',
    'Vender': 'Sell',
    'Cerrar': 'Close',
    'Rejilla': 'Grid',
    'la rejilla': 'the grid',
    'Nivel': 'Level',
    'Niveles': 'Levels',
    'Sin rango': 'No range',
    'Rango no válido': 'Invalid range',
    'Elige un rango válido': 'Choose a valid range',
    'Rango de precio': 'Price range',
    'Rango de precios': 'Price range',
    'Cambiar idioma': 'Change language',
    'Idioma': 'Language'
  },

  pt: {
    /* ── Menu principal ── */
    'Bots': 'Bots',
    'Market': 'Market',
    'Academia': 'Academia',
    'Tools': 'Ferramentas',
    'Prize Pool': 'Prize Pool',
    'Liquidity': 'Liquidity',
    'Perfil': 'Perfil',
    'Install': 'Instalar',
    'Compartir': 'Partilhar',

    /* ── Portada de Liquidity ── */
    'Herramientas Pro': 'Ferramentas Pro',
    'Análisis profesional': 'Análise profissional',
    'Tres herramientas para ver lo que el gráfico esconde': 'Três ferramentas para ver o que o gráfico esconde',
    'Liquidity Pools': 'Liquidity Pools',
    'Dónde está el dinero atrapado': 'Onde está o dinheiro preso',
    'El mapa de liquidaciones: los precios donde hay posiciones esperando a ser barridas. El precio va a buscarlas.':
      'O mapa de liquidações: os preços onde há posições à espera de serem varridas. O preço vai procurá-las.',
    'Radar Institucional': 'Radar Institucional',
    'Vea lo que hacen los grandes': 'Veja o que fazem os grandes',
    'El libro de órdenes miente: la mayoría de las órdenes grandes son falsas. Vigilamos cada una y le decimos cuáles tienen dinero real detrás.':
      'O livro de ordens mente: a maioria das ordens grandes são falsas. Vigiamos cada uma e dizemos-lhe quais têm dinheiro real por trás.',
    'Próximamente': 'Em breve',
    'En desarrollo': 'Em desenvolvimento',
    'La tercera herramienta del paquete. Muy pronto.': 'A terceira ferramenta do pacote. Muito em breve.',
    'Abrir →': 'Abrir →',
    'Acceso a las tres': 'Acesso às três',
    'Una semana': 'Uma semana',
    'Un mes': 'Um mês',
    'Tres meses': 'Três meses',
    'Recomendado': 'Recomendado',
    'Suscribirme': 'Subscrever',
    'para probarlo': 'para experimentar',
    'sale a cuenta': 'boa relação',
    'días': 'dias',
    'ahorras un 22%': 'poupa 22%',
    'ahorras un 48%': 'poupa 48%',
    '7 días': '7 dias',
    '30 días': '30 dias',
    '90 días': '90 dias',
    'Se paga en': 'Pago em',
    'desde tu wallet. Si renuevas antes de que caduque, los días que te quedan se suman.':
      'a partir da sua carteira. Se renovar antes de expirar, os dias restantes acumulam.',
    'Tu acceso está activo': 'O seu acesso está ativo',
    'Elige un plan para entrar a las herramientas.': 'Escolha um plano para aceder às ferramentas.',
    'Conecta tu wallet para poder suscribirte.': 'Ligue a sua carteira para subscrever.',
    'El acceso queda ligado a tu wallet. Si renuevas antes de que caduque, los días que te quedan se suman.':
      'O acesso fica ligado à sua carteira. Se renovar antes de expirar, os dias restantes acumulam.',
    '¿Con qué quieres pagar?': 'Como quer pagar?',
    'Confirma en tu wallet…': 'Confirme na sua carteira…',
    '¡Listo! Ya tienes acceso.': 'Pronto! Já tem acesso.',
    'Cancelaste la firma.': 'Cancelou a assinatura.',

    /* ── Liquidity Pools ── */
    'Filtro': 'Filtro',
    'Todo': 'Tudo',
    'Menos liquidez': 'Menos liquidez',
    'Muros de liquidación': 'Muros de liquidação',
    'Cómo funciona': 'Como funciona',
    'Cerrar': 'Fechar',
    'Reintentar': 'Tentar de novo',
    'Calculando zonas de liquidez…': 'A calcular zonas de liquidez…',
    'Cómo operar con esto': 'Como operar com isto',
    'Cómo se lee el mapa': 'Como ler o mapa',
    'Entendido': 'Entendido',
    'Saber más': 'Saber mais',
    'Atrás': 'Voltar',

    /* ── Radar Institucional ── */
    'Precio ahora': 'Preço agora',
    'En directo': 'Ao vivo',
    'Órdenes detectadas': 'Ordens detetadas',
    'Soporte': 'Suporte',
    'Resistencia': 'Resistência',
    'Fuertes': 'Fortes',
    'Falsas': 'Falsas',
    'EN VENTA': 'À VENDA',
    'EN COMPRA': 'EM COMPRA',
    'Orden blindada': 'Ordem blindada',
    'Nivel probado': 'Nível testado',
    'Orden firme': 'Ordem firme',
    'Orden falsa': 'Ordem falsa',
    'En observación': 'Em observação',
    'Ha desaparecido': 'Desapareceu',
    'Libro tranquilo': 'Livro tranquilo',
    'Analizando el libro de órdenes': 'A analisar o livro de ordens',
    'firme': 'firme',
    'repuesta': 'reposta',
    'ejecutado': 'executado',
    'fuerza': 'força',
    'arriba': 'acima',
    'abajo': 'abaixo',

    /* ── Comuns ── */
    'Buscar…': 'Procurar…',
    'Cargando…': 'A carregar…',
    'Conectar wallet': 'Ligar carteira',
    'Guardar imagen': 'Guardar imagem',
    'Aplicar': 'Aplicar',
    'Cancelar': 'Cancelar',
    'Aceptar': 'Aceitar',
    'Volver': 'Voltar',
    'Siguiente': 'Seguinte',

    /* ══════════════ BOTS ══════════════ */
    'Arma tu bot': 'Monte o seu bot',
    'Bots activos': 'Bots ativos',
    'Bots creados (total)': 'Bots criados (total)',
    'Bot creado el': 'Bot criado em',
    'Elige la moneda': 'Escolha a moeda',
    'Cantidad': 'Quantidade',
    'Cantidad a vender': 'Quantidade a vender',
    'Precio de entrada': 'Preço de entrada',
    'Entrada': 'Entrada',
    'Mercado': 'Mercado',
    'Compra a': 'Compra a',
    'Separación': 'Separação',
    'Ganancia': 'Lucro',
    'Ganancia %': 'Lucro %',
    'Flotante': 'Flutuante',
    'Nº compras': 'Nº compras',
    'Cerrar bot': 'Fechar bot',
    'Cerrar con ganancia': 'Fechar com lucro',
    'Ajustar cuadrículas': 'Ajustar grelhas',
    'Ampliar rango': 'Alargar intervalo',
    'Aplicar rango': 'Aplicar intervalo',
    'Cada cuánto': 'De quanto em quanto',
    'Configuración': 'Configuração',
    'Configuraciones rentables': 'Configurações rentáveis',
    'Apalancamiento': 'Alavancagem',
    'Actualizar datos': 'Atualizar dados',
    'Actividad': 'Atividade',
    'Operaciones': 'Operações',
    'Ciclos completados': 'Ciclos concluídos',
    'Compras / ventas': 'Compras / vendas',
    'Miembro desde': 'Membro desde',
    'Resultado': 'Resultado',
    'Volumen': 'Volume',
    'Rango': 'Intervalo',
    'Mínimo': 'Mínimo',
    'Máximo': 'Máximo',
    'Gas disponible': 'Gás disponível',
    'Gas gastado (total)': 'Gás gasto (total)',
    'Cuota mensual': 'Mensalidade',
    'Suscripción y gas': 'Subscrição e gás',
    'Tus bots por estrategia': 'Os seus bots por estratégia',
    'Activa': 'Ativa',
    'Inactiva': 'Inativa',
    'Crear bot': 'Criar bot',
    'Continuar': 'Continuar',
    'Confirmar': 'Confirmar',
    'Añadir gas': 'Adicionar gás',
    'Retirar': 'Levantar',
    'Retirar todo': 'Levantar tudo',
    'Depositar': 'Depositar',
    'Caja fuerte': 'Cofre',
    'Saldo': 'Saldo',

    /* ══════════════ WALLET ══════════════ */
    'Conecta tu wallet': 'Ligue a sua carteira',
    'Conectar wallet': 'Ligar carteira',
    'Cambiar de wallet': 'Mudar de carteira',
    'Cambiar a BNB Chain': 'Mudar para BNB Chain',
    'Buscando en BNB Chain…': 'A procurar na BNB Chain…',
    'Abriendo tu panel…': 'A abrir o seu painel…',
    'Tu nombre o alias': 'O seu nome ou alcunha',
    'Ponle un nombre a tu cuenta': 'Dê um nome à sua conta',
    'Ponle un nombre': 'Dar um nome',
    'Editar nombre': 'Editar nome',
    'Tu cuenta': 'A sua conta',

    /* ══════════════ MARKET ══════════════ */
    'Marketplace': 'Marketplace',
    'Ofertas': 'Ofertas',
    'Vender': 'Vender',
    'Comprar': 'Comprar',
    'Terminadas': 'Concluídas',
    'Disputas': 'Disputas',
    'Abrir disputa': 'Abrir disputa',
    'Cancelar pedido': 'Cancelar pedido',
    'Cancelar y recuperar': 'Cancelar e recuperar',
    'Cargando marketplace…': 'A carregar marketplace…',
    'Cargando ofertas…': 'A carregar ofertas…',
    'Avisos del Marketplace': 'Avisos do Marketplace',
    'Ocultar': 'Ocultar',
    'Ver todas': 'Ver todas',
    'Nuevo': 'Novo',
    'Precio': 'Preço',
    'Pagar': 'Pagar',
    'Ya pagué': 'Já paguei',
    'Confirmar pago': 'Confirmar pagamento',
    'Liberar fondos': 'Libertar fundos',

    /* ══════════════ ACADEMIA ══════════════ */
    'Academy': 'Academia',
    'Abrir la Academia': 'Abrir a Academia',
    'Un mes': 'Um mês',
    'Tres meses': 'Três meses',
    'Un año': 'Um ano',
    'para probar': 'para experimentar',
    'el más elegido': 'o mais escolhido',
    'Tu usuario de Telegram': 'O seu utilizador do Telegram',
    'Suscripción activa': 'Subscrição ativa',
    'Te quedan': 'Faltam-lhe',

    /* ══════════════ PRIZE POOL ══════════════ */
    'Cargando Prize Pool…': 'A carregar Prize Pool…',
    'Participar': 'Participar',
    'Premio': 'Prémio',
    'Participantes': 'Participantes',
    'Sorteo': 'Sorteio',
    'Próximo sorteo': 'Próximo sorteio',
    'Ganador': 'Vencedor',
    'Historial': 'Histórico',

    /* ══════════════ TOOLS ══════════════ */
    'Herramientas': 'Ferramentas',
    'Alerta de precio': 'Alerta de preço',
    'Alertas de precio': 'Alertas de preço',
    'Miedo y codicia': 'Medo e ganância',
    'Análisis técnico': 'Análise técnica',
    'Mapa del mercado': 'Mapa do mercado',
    'Gráfica en directo': 'Gráfico ao vivo',
    'Colector de polvo': 'Coletor de pó',
    'Consultando el índice…': 'A consultar o índice…',
    'Qué es esto': 'O que é isto',
    'sube a': 'sobe a',
    'baja a': 'desce a',
    'Crear alerta': 'Criar alerta',
    'Mis alertas': 'Os meus alertas',

    /* ══════════════ COMUNS ══════════════ */
    'Continuar': 'Continuar',
    'Volver': 'Voltar',
    'Ahora no': 'Agora não',
    'Guardar': 'Guardar',
    'Borrar': 'Apagar',
    'Editar': 'Editar',
    'Copiar': 'Copiar',
    'Copiado': 'Copiado',
    'Sí': 'Sim',
    'No': 'Não',
    'Hoy': 'Hoje',
    'Ayer': 'Ontem',
    'Tengo un problema': 'Tenho um problema',
    'opcional': 'opcional',
    'cambiar': 'mudar',
    'elegir': 'escolher',
    'gas': 'gás',

    /* ── Frases de cabeçalho de cada secção ── */
    'Compra y vende con caja fuerte': 'Compre e venda com cofre',
    'Cosas útiles para el día a día con tus bots.': 'Coisas úteis para o dia a dia com os seus bots.',
    'Junta los restos de monedas que te van quedando': 'Junta os restos de moedas que vão sobrando',
    'De cero a operar con criterio': 'Do zero a operar com critério',
    'Una ruta ordenada, con exámenes para avanzar. No es una carpeta de vídeos.':
      'Um percurso ordenado, com exames para avançar. Não é uma pasta de vídeos.',
    'No se pudo cargar el Prize Pool ahora mismo.': 'Não foi possível carregar o Prize Pool agora.',
    'Revisa tu conexión y vuelve a intentar.': 'Verifique a sua ligação e tente de novo.',
    'No se pudieron cargar los datos.': 'Não foi possível carregar os dados.',
    'Revisa tu conexión.': 'Verifique a sua ligação.',

    /* ══════════════ CARTEIRA ══════════════ */
    'Sin conectar': 'Não ligado',
    'Conectada': 'Ligada',
    'Tus wallets': 'As suas carteiras',
    'Otra wallet (QR)': 'Outra carteira (QR)',
    'Elige cómo quieres hacerlo.': 'Escolha como quer fazer.',
    'Lo más sencillo': 'O mais simples',
    'Es una sola firma.': 'É uma única assinatura.',
    'Instalar': 'Instalar',
    'Usar': 'Usar',
    'Mejor no': 'Agora não',
    'Swap': 'Swap',

    /* ══════════════ BOTS ══════════════ */
    'Qué hace, en simple.': 'O que faz, em simples.',
    'Por qué eso ayuda.': 'Porque isso ajuda.',
    '¿Por qué este bot da ganancia?': 'Porque é que este bot dá lucro?',
    'Qué puede salir mal, sin adornos:': 'O que pode correr mal, sem rodeios:',
    'Tres consejos concretos:': 'Três conselhos concretos:',
    'Lógica Estructural Avanzada': 'Lógica Estrutural Avançada',
    'bots activos': 'bots ativos',
    'Compras': 'Compras',
    'Vendes': 'Vendas',
    'compra': 'compra',
    'vende': 'venda',
    'Máx': 'Máx',
    'Mín': 'Mín',
    'Más': 'Mais',
    'Toca': 'Toque',
    'Tu dinero en la caja fuerte': 'O seu dinheiro no cofre',
    '¿Cuál moneda?': 'Qual moeda?',
    'Escríbela tú': 'Escreva você',
    'Otra': 'Outra',

    /* ══════════════ MARKET ══════════════ */
    'Quiero vender': 'Quero vender',
    'Quiero comprar': 'Quero comprar',
    'Disputa': 'Disputa',
    'Razón al COMPRADOR': 'A favor do COMPRADOR',
    'Razón al VENDEDOR': 'A favor do VENDEDOR',
    'No hay publicaciones abiertas ahora mismo.': 'Não há publicações abertas neste momento.',
    'No se pudo cargar.': 'Não foi possível carregar.',
    'Problema': 'Problema',

    /* ══════════════ COMUNS ══════════════ */
    'Aviso': 'Aviso',
    'Error': 'Erro',
    'Listo': 'Pronto',
    'Espera': 'Aguarde',
    'Firmando…': 'A assinar…',
    'Confirmando…': 'A confirmar…',
    'Hecho': 'Feito',
    'Ver más': 'Ver mais',
    'Ver menos': 'Ver menos',
    'Detalles': 'Detalhes',
    'Ayuda': 'Ajuda',
    'Paso': 'Passo',
    'de': 'de',
    'Total': 'Total',
    'Disponible': 'Disponível',
    'Pendiente': 'Pendente',
    'Completado': 'Concluído',
    'Cancelado': 'Cancelado',
    'En curso': 'Em curso',
    'Sin datos': 'Sem dados',
    'Actualizado': 'Atualizado',
    'hace': 'há',
    'minutos': 'minutos',
    'horas': 'horas',
    'segundos': 'segundos',

    /* ══════════════ PERFIL ══════════════ */
    'Conecta tu wallet para ver tu panel:': 'Ligue a sua carteira para ver o seu painel:',
    'suscripción, rendimiento, bots y gas.': 'subscrição, desempenho, bots e gás.',
    'Ver en BscScan ↗': 'Ver no BscScan ↗',
    'Coste por operación': 'Custo por operação',
    'Cada compra o venta que hace un bot': 'Cada compra ou venda que um bot faz',
    'Se descuenta de tu gas, no de tu inversión.': 'É descontado do seu gás, não do investimento.',
    'Permisos de gasto': 'Permissões de gasto',
    'No tienes permisos que revisar.': 'Não tem permissões para rever.',
    'quítaselo': 'remover',
    'quitar': 'remover',
    'Notificaciones': 'Notificações',
    'Renovación automática': 'Renovação automática',
    'Pronto': 'Em breve',
    'Los datos se leen directamente de la blockchain.': 'Os dados são lidos diretamente da blockchain.',

    /* ══════════════ BOTS ══════════════ */
    'Mis bots': 'Os meus bots',
    'Crear mi primer bot': 'Criar o meu primeiro bot',
    'Encender el bot': 'Ligar o bot',
    'Cerrar todos': 'Fechar todos',
    'Antes de empezar, léelo': 'Antes de começar, leia',
    'Lo he leído y lo entiendo': 'Li e compreendo',
    'Entiendo, continuar': 'Compreendo, continuar',
    'Bots que compran barato y venden caro por ti, en tu propia wallet. Sin custodia y sin KYC.':
      'Bots que compram barato e vendem caro por si, na sua própria carteira. Sem custódia e sem KYC.',
    'Cuando enciendas uno, aparecerá aquí con su marcha y sus resultados.':
      'Quando ligar um, aparecerá aqui com o seu andamento e resultados.',
    'No pudimos leer tus bots ahora mismo': 'Não conseguimos ler os seus bots agora',
    'Buscando token en BNB Chain…': 'A procurar token na BNB Chain…',
    'Escribe al menos 20 USDT.': 'Escreva pelo menos 20 USDT.',
    'Inversión': 'Investimento',
    'Monto': 'Montante',
    'Monto por compra': 'Montante por compra',
    'Nº de compras': 'Nº de compras',
    'Compras hechas': 'Compras feitas',
    'Compra inicial %': 'Compra inicial %',
    'Comprar abajo %': 'Comprar abaixo %',
    'Ganancia estimada': 'Lucro estimado',
    'Estimación': 'Estimativa',
    'Objetivo': 'Objetivo',
    'Gráfica': 'Gráfico',
    'Infinito': 'Infinito',
    'Diario': 'Diário',
    'Mensual': 'Mensal',
    'Comisión de la venta': 'Comissão da venda',
    'Intercambiar': 'Trocar',
    'Qué hace, en simple.': 'O que faz, em simples.',
    'De dónde sale la ganancia.': 'De onde vem o lucro.',
    'Cuándo vende.': 'Quando vende.',
    'Lo que evita.': 'O que evita.',
    'No es magia.': 'Não é magia.',
    'Nada garantiza ganancias.': 'Nada garante lucros.',
    'Nadie puede prometerte ganancias.': 'Ninguém lhe pode prometer lucros.',
    'El precio puede no llegar nunca.': 'O preço pode nunca chegar lá.',
    'Cripto Cuba Oficial · Opera bajo tu propio riesgo': 'Cripto Cuba Oficial · Opere por sua conta e risco',

    /* ══════════════ MARKETPLACE ══════════════ */
    'Compra y vende': 'Compre e venda',
    'Conecta tu wallet.': 'Ligue a sua carteira.',
    'Consultando tu saldo…': 'A consultar o seu saldo…',
    'No se pudieron cargar las ofertas.': 'Não foi possível carregar as ofertas.',
    'No se pudo cargar. Revisa tu conexión.': 'Não foi possível carregar. Verifique a ligação.',
    'Paso 1 · Crea tu perfil': 'Passo 1 · Crie o seu perfil',
    'Guardar perfil': 'Guardar perfil',
    'Guardar y continuar': 'Guardar e continuar',
    'Contacto (Telegram)': 'Contacto (Telegram)',
    'Cómo contactarlo': 'Como contactá-lo',
    'Moneda habitual': 'Moeda habitual',
    'Horario:': 'Horário:',
    'Comprador:': 'Comprador:',
    'Nuevo · sin historial': 'Novo · sem histórico',
    'Elige uno…': 'Escolha um…',
    'Dónde está': 'Onde está',
    'Antes de reservar': 'Antes de reservar',
    'Cómo funciona esta compra': 'Como funciona esta compra',
    'Depositar fianza': 'Depositar caução',
    'Cancelar mi publicación': 'Cancelar a minha publicação',
    'No, ahora no': 'Não, agora não',
    'La reserva ya venció': 'A reserva já expirou',
    'Enviar calificación': 'Enviar avaliação',
    'Ese dinero es tuyo': 'Esse dinheiro é seu',
    'No hay disputas pendientes.': 'Não há disputas pendentes.',
    'La salida segura es la disputa.': 'A saída segura é a disputa.',

    /* ══════════════ ACADEMIA ══════════════ */
    'Cómo funciona esto': 'Como isto funciona',
    'La hoja de ruta': 'O roteiro',
    'La estrategia': 'A estratégia',
    'Las 17 clases': 'As 17 aulas',
    'Examen': 'Exame',
    'Consultando precios…': 'A consultar preços…',
    'Entrar': 'Entrar',
    'Entrar al grupo': 'Entrar no grupo',
    'Elegir': 'Escolher',

    /* ══════════════ PRIZE POOL ══════════════ */
    'Quiero participar': 'Quero participar',
    'Confirmar participación': 'Confirmar participação',
    'Ya estás participando': 'Já está a participar',
    'Cobrar mi premio': 'Receber o meu prémio',
    'Cierra en': 'Fecha em',
    'Estado': 'Estado',
    'Evento': 'Evento',
    'Ganadores': 'Vencedores',
    'Fondo total de premios': 'Fundo total de prémios',
    'Nadie pierde nada': 'Ninguém perde nada',

    /* ══════════════ TOOLS ══════════════ */
    'Empezar': 'Começar',
    'Tus alertas': 'Os seus alertas',
    'El precio': 'O preço',
    'Revisando tu wallet': 'A verificar a sua carteira',
    'Juntar lo marcado': 'Juntar o selecionado',
    'Pasarlo todo a': 'Converter tudo para',
    'No se pudo cargar el gráfico.': 'Não foi possível carregar o gráfico.',
    'Inténtalo en un momento.': 'Tente daqui a pouco.',

    /* ══════════════ EXTRAS ══════════════ */
    'Instalar CriptoCuba': 'Instalar CriptoCuba',
    'Cómo instalarla': 'Como instalar',
    'Descargar': 'Descarregar',
    'Descargar tu historial': 'Descarregar o seu histórico',
    'Operaciones cerradas': 'Operações fechadas',
    'Invertido': 'Investido',
    'Tipo': 'Tipo',
    'Bloque': 'Bloco',
    'Abrir…': 'Abrir…',
    'Bots de trading en tu wallet': 'Bots de trading na sua carteira',

    /* ══════════════ BOTS · RESTO ══════════════ */
    'Todavía no tienes bots': 'Ainda não tem bots',
    'Resumen del Cash Out': 'Resumo do Cash Out',
    'Resumen del DCA': 'Resumo do DCA',
    'Precio del mercado': 'Preço de mercado',
    'Precio mínimo': 'Preço mínimo',
    'Precio promedio estimado': 'Preço médio estimado',
    'Primera compra': 'Primeira compra',
    'Próxima compra': 'Próxima compra',
    'Por compra': 'Por compra',
    'Total a invertir': 'Total a investir',
    'Valor ahora': 'Valor agora',
    'Protección': 'Proteção',
    'Vender al %': 'Vender ao %',
    'Recargar': 'Recarregar',
    'Pagas': 'Paga',
    'Semanal': 'Semanal',
    'Quincenal': 'Quinzenal',
    'ahora mismo': 'agora mesmo',
    'Qué hace el bot.': 'O que faz o bot.',
    'Por qué es útil.': 'Porque é útil.',
    'Puedes perder dinero.': 'Pode perder dinheiro.',
    'Usa solo dinero que puedas dejar quieto.': 'Use apenas dinheiro que possa deixar parado.',
    'Tu dinero sigue en tu wallet.': 'O seu dinheiro fica na sua carteira.',
    'Tu cripto se queda en tu wallet.': 'A sua cripto fica na sua carteira.',
    'Tu frase de recuperación': 'A sua frase de recuperação',

    /* ══════════════ MARKET · RESTO ══════════════ */
    'Publicar oferta': 'Publicar oferta',
    'Mis publicaciones': 'As minhas publicações',
    'Reservar': 'Reservar',
    'Reservado': 'Reservado',
    'Confirmar recepción': 'Confirmar receção',
    'Esperando pago': 'A aguardar pagamento',
    'Operación completada': 'Operação concluída',
    'Operación cancelada': 'Operação cancelada',
    'En disputa': 'Em disputa',
    'Tiempo restante': 'Tempo restante',
    'Vendedor': 'Vendedor',
    'Comprador': 'Comprador',
    'Método de pago': 'Método de pagamento',
    'Efectivo': 'Dinheiro',
    'Transferencia': 'Transferência',
    'Cantidad mínima': 'Quantidade mínima',
    'Cantidad máxima': 'Quantidade máxima',
    'Ver perfil': 'Ver perfil',
    'Calificación': 'Avaliação',

    /* ══════════════ ACADEMIA · RESTO ══════════════ */
    'Empezar el curso': 'Começar o curso',
    'Clase': 'Aula',
    'Módulo': 'Módulo',
    'Lección': 'Lição',
    'Completada': 'Concluída',
    'Bloqueada': 'Bloqueada',
    'Aprobado': 'Aprovado',
    'Tu progreso': 'O seu progresso',
    'Siguiente clase': 'Aula seguinte',
    'Renovar': 'Renovar',
    'Ver los planes': 'Ver os planos',
    'Pagar con BNB': 'Pagar com BNB',
    'Pagar con USDT': 'Pagar com USDT',

    /* ══════════════ COMUNS · RESTO ══════════════ */
    'Reintentar': 'Tentar de novo',
    'Actualizar': 'Atualizar',
    'Configurar': 'Configurar',
    'Avanzado': 'Avançado',
    'Básico': 'Básico',
    'Opciones': 'Opções',
    'Resumen': 'Resumo',
    'Sin actividad': 'Sem atividade',
    'Algo salió mal': 'Algo correu mal',
    'Inténtalo de nuevo': 'Tente de novo',
    'Copiar dirección': 'Copiar endereço',
    'Red': 'Rede',
    'Comisión': 'Comissão',
    'Confirmado': 'Confirmado',
    'Fallido': 'Falhou',

    /* ══════════════ ASSISTENTE ══════════════ */
    'Escribe tu pregunta…': 'Escreva a sua pergunta…',
    'Asistente': 'Assistente',
    'Escribiendo…': 'A escrever…',
    'Abrir la herramienta': 'Abrir a ferramenta',
    'Abrirla': 'Abri-la',
    'Con números': 'Com números',
    'Consejos': 'Conselhos',
    'Cuánto cuesta': 'Quanto custa',
    'Cuéntame más': 'Conte-me mais',
    'Cómo empiezo': 'Como começo',
    'Cómo lo uso': 'Como o uso',
    'El Marketplace': 'O Marketplace',
    'El gas': 'O gás',
    'El sorteo': 'O sorteio',
    'Guíame': 'Guie-me',
    'La Academia': 'A Academia',
    'Los bots': 'Os bots',
    'Los colores': 'As cores',
    'Los planes': 'Os planos',
    'Qué es': 'O que é',
    'Otra cosa': 'Outra coisa',
    'Tengo un problema': 'Tenho um problema',
    'No entiendo': 'Não entendo',
    'Gracias': 'Obrigado',
    'Sí, por favor': 'Sim, por favor',
    'No, gracias': 'Não, obrigado',

    /* ══════════════ FRAGMENTOS ══════════════ */
    '¿Tienes dudas? Toca aquí': 'Tem dúvidas? Toque aqui',
    '¿Cada cuánto compra?': 'De quanto em quanto compra?',
    '¿Cuántas compras?': 'Quantas compras?',
    'precio del mercado': 'preço de mercado',
    'meses': 'meses',
    'rango': 'intervalo',
    'cuadrículas': 'grelhas',
    'cuadrícula': 'grelha',
    'separación': 'separação',
    'todos': 'todos',
    'en pérdida': 'em perda',
    'varias veces': 'várias vezes',
    'precio ahora': 'preço agora',
    'tu coste': 'o seu custo',
    'precio de venta': 'preço de venda',
    'compró': 'comprou',
    'vendió': 'vendeu',
    'total': 'total',
    'restante': 'restante',
    'disponible': 'disponível',
    'invertido': 'investido',
    'ganado': 'ganho',
    'perdido': 'perdido',
    'activo': 'ativo',
    'pausado': 'pausado',
    'cerrado': 'fechado',
    'pendiente': 'pendente',
    'confirmado': 'confirmado',
    'aproximadamente': 'aproximadamente',
    'nunca': 'nunca',
    'siempre': 'sempre',

    /* ══════════════ MARKET · FRAGMENTOS ══════════════ */
    'Todavía no hay ofertas publicadas.': 'Ainda não há ofertas publicadas.',
    'Todavía no tienes operaciones.': 'Ainda não tem operações.',
    'Zona:': 'Zona:',
    'Vendedor:': 'Vendedor:',
    'Reservar esta compra': 'Reservar esta compra',
    'Tu Telegram o WhatsApp': 'O seu Telegram ou WhatsApp',
    'País': 'País',
    'Todo listo para vender': 'Tudo pronto para vender',
    'Todo listo para comprar': 'Tudo pronto para comprar',
    'Ubicación': 'Localização',
    'Permitir': 'Permitir',
    'Vender todo': 'Vender tudo',
    '¿Cómo funciona esto?': 'Como funciona isto?',
    'Retirar fondos': 'Levantar fundos',
    'nuevo': 'novo',
    'Publicada': 'Publicada',
    'Tomada': 'Tomada',
    '¿Qué pasó?': 'O que aconteceu?',
    'clases': 'aulas',
    'con examen': 'com exame',
    'ya no opera': 'já não opera',
    'vendió todo': 'vendeu tudo',
    'Todo tranquilo.': 'Tudo tranquilo.',

    /* ══════════════ ÚLTIMOS ══════════════ */
    'audiolibros': 'audiolivros',
    'uno a uno': 'um a um',
    'fases': 'fases',
    'preguntas': 'perguntas',
    'examen final': 'exame final',
    'Solo para miembros': 'Apenas para membros',
    '¿Ya eres miembro?': 'Já é membro?',
    'Tu panel de aprendizaje': 'O seu painel de aprendizagem',
    'usuario': 'utilizador',
    'Sin reembolso.': 'Sem reembolso.',
    'Ya está': 'Pronto',
    'premio grande': 'prémio grande',
    'muchos ganadores': 'muitos vencedores',
    'si ganas': 'se ganhar',
    '¡Ganaste!': 'Ganhou!',
    'Cobrar': 'Receber',
    'El mínimo es': 'O mínimo é',
    'Copiar enlace': 'Copiar ligação',
    'Tipo de bot': 'Tipo de bot',
    'Vueltas completas': 'Ciclos completos',

    /* ══════════════ LIQUIDITY POOLS ══════════════ */
    'Calculando el mapa de liquidaciones…': 'A calcular o mapa de liquidações…',
    'menos liquidez': 'menos liquidez',
    'Filtro de ruido': 'Filtro de ruído',
    'Mostrar': 'Mostrar',
    'Perfil de volumen': 'Perfil de volume',
    'Mapa de liquidez': 'Mapa de liquidez',
    'Reencuadrar': 'Reenquadrar',
    'Pago': 'Pagamento',
    'información, no una señal': 'informação, não um sinal',

    /* ══════════════ RADAR ══════════════ */
    'Observando…': 'A observar…',
    'Analizando el libro de órdenes…': 'A analisar o livro de ordens…',
    'Es humo': 'É fumo',
    'ya no está': 'já não está',
    'rechazo': 'rejeição',
    'rebote': 'ressalto',

    /* ══════════════ TUTORIAL ══════════════ */
    'Ver guía': 'Ver guia',
    'Por qué funciona': 'Porque funciona',
    'compra más': 'compra mais',
    'baja tu precio promedio': 'baixa o seu preço médio',

    /* ══════════════ COMPRAR ══════════════ */
    'Con tarjeta': 'Com cartão',
    'Intercambiar cripto': 'Trocar cripto',
    'Desde Cuba': 'Desde Cuba',

    /* ══════════════ GRÁFICO ══════════════ */
    'Cargando gráfica…': 'A carregar gráfico…',
    'Velas reales de': 'Velas reais de',
    'No se pudo cargar la gráfica.': 'Não foi possível carregar o gráfico.',
    'En línea': 'Online',
    'Temas': 'Temas',
    'Tira para actualizar': 'Puxe para atualizar',

    /* ══════════════ FRASES FINAIS ══════════════ */
    '17 clases de cero a cien, con examen cada una': '17 aulas do zero a cem, com exame em cada uma',
    'Tutoriales de las herramientas de verdad': 'Tutoriais das ferramentas a sério',
    'Acceso al grupo mientras dure tu plan': 'Acesso ao grupo enquanto durar o seu plano',
    'Junta los restos de monedas que te van quedando y los pasa todos a una sola.':
      'Junta os restos de moedas que vão sobrando e converte-os todos numa só.',
    'Te avisa cuando una moneda llega al precio que marques.':
      'Avisa-o quando uma moeda chega ao preço que definir.',
    'El gráfico completo, con velas y herramientas de dibujo.':
      'O gráfico completo, com velas e ferramentas de desenho.',

    ', con software para aplicarlo': ', com software para o aplicar',
    'que te lo explica. Luego repites.': 'que lho explica. Depois repete.',
    'en la materia que acabas de estudiar.': 'sobre a matéria que acabou de estudar.',
    ': es la forma más eficaz de proteger tu dinero.': ': é a forma mais eficaz de proteger o seu dinheiro.',

    /* ══════════════ LIQUIDATION PRESSURE ══════════════ */
    'Cuándo el mercado va a purgar': 'Quando o mercado vai purgar',
    'Midiendo la presión del mercado': 'A medir a pressão do mercado',
    'Riesgo extremo de purga': 'Risco extremo de purga',
    'Tensión alta': 'Tensão alta',
    'Tensión moderada': 'Tensão moderada',
    'Mercado equilibrado': 'Mercado equilibrado',
    'Qué hacer': 'O que fazer',
    'Por qué lo decimos': 'Porque o dizemos',
    'Posicionamiento': 'Posicionamento',
    'Apalancamiento': 'Alavancagem',
    'Próximo cobro': 'Próxima cobrança',
    'Los largos pagan': 'Os longos pagam',
    'Los cortos pagan': 'Os curtos pagam',
    'Casi todos están largos': 'Quase todos estão longos',
    'Casi todos están cortos': 'Quase todos estão curtos',

    /* ══════════════ BOTÕES E AVISOS DOS BOTS ══════════════ */
    'Pon un rango para ver la rejilla': 'Defina um intervalo para ver a grelha',
    'Cerrar y vender': 'Fechar e vender',
    'Sí, cerrar': 'Sim, fechar',
    'No, seguir': 'Não, continuar',
    'Compra y vende a niveles': 'Compra e vende por níveis',
    '¿Cerrar este bot?': 'Fechar este bot?',
    '¿Cerrar todos los bots?': 'Fechar todos os bots?',
    'Vender todo y cerrar': 'Vender tudo e fechar',
    'Solo cerrar': 'Apenas fechar',
    'Cerrando…': 'A fechar…',
    'Vendiendo…': 'A vender…',
    'Bot cerrado': 'Bot fechado',
    'Bot creado': 'Bot criado',
    'Firma en tu wallet': 'Assine na sua carteira',
    'Siguiente': 'Seguinte',
    'Anterior': 'Anterior',
    'Ver mis bots': 'Ver os meus bots',
    'Saltar': 'Saltar',
    'Vender': 'Vender',
    'Rejilla': 'Grelha',
    'Nivel': 'Nível',
    'Niveles': 'Níveis',
    'Rango de precio': 'Intervalo de preço',
    'Cambiar idioma': 'Mudar idioma',
    'Idioma': 'Idioma'
  }
};

/* ══════════════════════════════════════════════════════════════
   ESTADO
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   QUÉ IDIOMA MOSTRAR

   1. Si el usuario ya eligió uno, ese manda siempre.
   2. Si no, se mira el idioma del navegador: quien entra desde
      Estados Unidos con Chrome en inglés ve la web en inglés sin
      tocar nada, y quien entra desde México la ve en español.
   3. Si no reconocemos el idioma, español.

   Así se capta el público de fuera sin obligar a nadie a buscar el
   selector, y el de casa no nota ningún cambio.
   ══════════════════════════════════════════════════════════════ */
/* INGLÉS POR DEFECTO.

   El producto se presenta en inglés a todo el mundo. Quien prefiera
   español o portugués lo cambia desde su perfil, y esa elección se
   guarda para las siguientes visitas. */
let _idioma = 'en';
let _autodetectado = false;

try {
  const g = localStorage.getItem(CLAVE);
  if (g && (g === 'es' || DIC[g])) _idioma = g;   // el usuario ya decidió
} catch (_) {
  /* Si el navegador bloquea el almacenamiento, se queda en inglés.
     No es motivo para romper nada. */
}

/** ¿El idioma lo elegimos nosotros o el usuario? */
export const esAutodetectado = () => _autodetectado;

export const idiomaActual = () => _idioma;

/** Traduce un texto. Si no está en el diccionario, se devuelve igual. */
export function t(texto) {
  if (_idioma === 'es' || !texto) return texto;
  const d = DIC[_idioma];
  if (!d) return texto;
  return d[texto] || texto;
}

/* ══════════════════════════════════════════════════════════════
   TRADUCIR LO QUE YA ESTÁ EN PANTALLA

   Se recorren los nodos de texto y se sustituyen los que estén en el
   diccionario. Se deja intacto todo lo que no reconozcamos: números,
   precios, direcciones de wallet y cualquier texto sin traducción.
   ══════════════════════════════════════════════════════════════ */
function traducirNodo(raiz) {
  if (_idioma === 'es') return;
  const d = DIC[_idioma];
  if (!d || !raiz) return;

  try {
    const paseo = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        // Ni scripts ni estilos: ahí no hay nada que traducir
        const p = n.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        /* El canvas se dibuja, no lleva texto en el árbol. Los SVG SÍ
           llevan <text> y hay que traducirlos: ahí viven los avisos
           de las gráficas de los bots. */
        const et = p.tagName;
        if (et === 'SCRIPT' || et === 'STYLE' || et === 'CANVAS') return NodeFilter.FILTER_REJECT;
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const pendientes = [];
    let n;
    while ((n = paseo.nextNode())) pendientes.push(n);

    pendientes.forEach((nodo) => {
      const original = nodo.nodeValue;
      const limpio = original.trim();
      /* Se busca tal cual y, si no, en minúsculas: muchos títulos van
         en mayúsculas por CSS pero en el código están normales. */
      let trad = d[limpio];
      if (!trad) {
        const clave = Object.keys(d).find((k) => k.toLowerCase() === limpio.toLowerCase());
        if (clave) trad = d[clave];
      }
      if (trad && trad !== limpio) {
        // Se conserva el espaciado original alrededor del texto
        nodo.nodeValue = original.replace(limpio, trad);
      }
    });

    // Los marcadores de posición y los títulos emergentes
    raiz.querySelectorAll('[placeholder]').forEach((el) => {
      const v = d[el.placeholder];
      if (v) el.placeholder = v;
    });
    raiz.querySelectorAll('[title]').forEach((el) => {
      const v = d[el.title];
      if (v) el.title = v;
    });
  } catch (_) {
    /* Si algo falla al recorrer el árbol, se abandona en silencio:
       la página se queda en español, que es perfectamente usable. */
  }
}

/** Traduce toda la página. */
export function traducirTodo() {
  traducirNodo(document.body);
}

/* Las ventanas se crean después de cargar la página (bots, market,
   liquidity…). Un observador las traduce en cuanto aparecen. */
let _observador = null;

function vigilar() {
  if (_observador || _idioma === 'es') return;
  try {
    _observador = new MutationObserver((cambios) => {
      cambios.forEach((c) => {
        c.addedNodes.forEach((n) => {
          if (n.nodeType === 1) traducirNodo(n);
          /* [CORREGIDO] También los nodos de texto sueltos. Antes solo
             se miraban los elementos, y los textos que se inyectan
             directamente (dentro de SVG, o al reescribir un innerHTML
             parcial) se quedaban sin traducir. */
          else if (n.nodeType === 3 && n.parentElement) traducirNodo(n.parentElement);
        });
        // Y cuando cambia el texto de un nodo que ya existía
        if (c.type === 'characterData' && c.target && c.target.parentElement) {
          traducirNodo(c.target.parentElement);
        }
      });
    });
    _observador.observe(document.body, {
      childList: true, subtree: true, characterData: true
    });
  } catch (_) {}
}

function dejarDeVigilar() {
  try { if (_observador) { _observador.disconnect(); _observador = null; } } catch (_) {}
}

/* ══════════════════════════════════════════════════════════════
   CAMBIAR DE IDIOMA
   ══════════════════════════════════════════════════════════════ */
export function cambiarIdioma(id) {
  if (id !== 'es' && !DIC[id]) return;
  _idioma = id;
  _autodetectado = false;
  try { localStorage.setItem(CLAVE, id); } catch (_) {}

  /* Volver al español obliga a recargar: el texto original ya se
     sustituyó y no hay forma limpia de deshacerlo. Es un instante y
     garantiza que la página queda exactamente como estaba. */
  if (id === 'es') {
    dejarDeVigilar();
    location.reload();
    return;
  }

  document.documentElement.lang = id;
  traducirTodo();
  vigilar();
}

/** Arranca al cargar la página, si había un idioma guardado. */
export function arrancarIdioma() {
  if (_idioma === 'es') return;
  /* Si el idioma vino del navegador, se guarda para que la próxima
     visita no tenga que volver a detectarlo. */
  if (_autodetectado) { try { localStorage.setItem(CLAVE, _idioma); } catch (_) {} }
  document.documentElement.lang = _idioma;
  traducirTodo();
  vigilar();
}
