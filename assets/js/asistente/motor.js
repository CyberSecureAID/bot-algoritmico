/* ================================================================
   ASISTENTE — Motor v2
   Cripto Cuba Oficial

   100 % local. Sin API, sin servidor, sin claves, sin coste.
   Todo lo que sabe vive en js/chatbot-kb.js.

   ── QUÉ HACE ESTE MOTOR QUE NO HACE UN CHATBOT DE BOTONES ─────

   1. MULTI-TEMA REAL. Si en un mismo párrafo le hablas de tres cosas
      (un muro de ladrillo, si trabajáis en Ottawa, y cuánto cuesta),
      detecta los TRES y contesta a cada uno EN SU PROPIO MENSAJE,
      encabezado por el tema al que responde, con sus puntos de
      "escribiendo" en medio. No un párrafo kilométrico.

   2. NO SE REPITE. Cada respuesta tiene variantes y el motor recuerda
      cuál usó: nunca da dos veces seguidas la misma frase.

   3. ENTIENDE MAL ESCRITO. Erratas (distancia de edición), sinónimos,
      contracciones sin apóstrofo, plurales y números con símbolos.

   4. TIENE MEMORIA CORTA. Sabe de qué se acaba de hablar: "sí",
      "cuéntame más" o "¿y eso cuánto cuesta?" se entienden en contexto.

   5. GUÍA. Cuando la respuesta vive en otra página, ofrece el botón
      que lleva allí — y la conversación continúa al otro lado.

   ── QUÉ NO HACE, A PROPÓSITO ─────────────────────────────────
   · No consulta fuentes externas. Si no lo sabe, lo dice y pasa a una
     persona. Un bot que adivina es un pasivo, no un activo.
   · No da precios. No afirma certificaciones. No inventa proyectos.
   · Lenguaje neutro: no presupone género, ni edad, ni cargo.
================================================================ */

(function () {
  'use strict';

  /* Elige la base de conocimiento segun el idioma. En ingles usa la KB
     paralela (NP_BOT_KB_EN) si existe; si no, cae a la española. Asi el
     chatbot responde en el idioma de la pagina sin traducir en vivo. */
  function elegirKB() {
    var idi = 'en';
    try { idi = localStorage.getItem('cco-idioma') || 'en'; } catch (e) {}
    if (idi === 'en' && window.NP_BOT_KB_EN && window.NP_BOT_KB_EN.kb) return window.NP_BOT_KB_EN;
    if (idi !== 'es' && window.NP_BOT_KB_EN && window.NP_BOT_KB_EN.kb) return window.NP_BOT_KB_EN;
    return window.NP_BOT_KB;
  }

  function idiomaUI() { try { return localStorage.getItem('cco-idioma') || 'en'; } catch (e) { return 'en'; } }
  var _EN = idiomaUI() !== 'es';   // true = interfaz del chat en inglés
  var UI = _EN
    ? { temas:'Topics', idioma:'ES', cerrar:'Close chat', ph:'Type me anything…', enviar:'Send' }
    : { temas:'Temas', idioma:'EN', cerrar:'Cerrar el chat', ph:'Escríbeme lo que quieras…', enviar:'Enviar' };

  var DATA = elegirKB();
  if (!DATA || !DATA.kb) return;

  var BOT   = DATA.bot;
  var STORE = 'np-chat-history';
  var OPEN  = 'np-chat-open';
  var SEEN  = 'np-chat-seen';

  /* Memoria de variantes: qué frase se usó la última vez en cada
     entrada. Es lo que impide que el bot suene a disco rayado. */
  var lastVariant = {};
  /* Memoria de conversación: el último tema, para las preguntas que
     dependen de lo anterior. */
  var lastEntry = null;
  /* ── CONVERSACIÓN GUIADA (Fase 1) ──────────────────────────
     Estado de la toma de datos. Mientras esto no sea null, el motor
     NO puntúa temas: conduce. Sobrevive a la navegación entre páginas,
     porque perder los datos de alguien a mitad de camino es imperdonable. */
  var flow = null;          // { id, step, data, stage }
  var pendingFlow = null;   // flujo ofrecido, esperando un "sí"
  /* Qué dato ha pedido el bot al repetir lo que entendió ('where' | 'when').
     Sin esto, el bot preguntaba "¿para qué fecha?" y NO SABÍA ESCUCHAR la
     respuesta: solo entendía un "sí". El visitante contestaba "en primavera"
     y el bot le hacía triaje, como si no hubiera entendido nada. */
  var pendingAsk = null;

  /* [FALLO CORREGIDO] pendingFlow y lastEntry vivían SOLO en memoria: al
     recargar la página o al navegar, se perdían, y un "yes" del visitante
     caía en la rama de "cuéntame más" repitiendo la respuesta anterior.
     Ahora ambos sobreviven, como el resto de la conversación. */
  function savePending() {
    try {
      sessionStorage.setItem('np-chat-seed', JSON.stringify(seed || null));
      sessionStorage.setItem('np-chat-pending', pendingFlow || '');
      sessionStorage.setItem('np-chat-ask', pendingAsk || '');
      sessionStorage.setItem('np-chat-last', (lastEntry && (lastEntry.topic || lastEntry.keys[0])) || '');
      sessionStorage.setItem('np-chat-closed', closed ? '1' : '');
    } catch (e) {}
  }

  function loadPending() {
    try {
      seed = JSON.parse(sessionStorage.getItem('np-chat-seed') || 'null');
      closed = sessionStorage.getItem('np-chat-closed') === '1';
      pendingFlow = sessionStorage.getItem('np-chat-pending') || null;
      pendingAsk  = sessionStorage.getItem('np-chat-ask') || null;
      var t = sessionStorage.getItem('np-chat-last');
      if (t) {
        DATA.kb.forEach(function (e) {
          if ((e.topic || e.keys[0]) === t) lastEntry = e;
        });
      }
    } catch (e) {}
  }

  /* Se ofrece la toma de datos UNA vez por sesión y por tipo. Un bot que
     lo ofrece en cada respuesta es un vendedor pesado, no un asistente.
     (Si el visitante lo pide él mismo, se abre siempre: eso es otra cosa.) */
  function alreadyOffered(id) {
    try { return sessionStorage.getItem('np-chat-offered-' + id) === '1'; }
    catch (e) { return false; }
  }
  function markOffered(id) {
    try { sessionStorage.setItem('np-chat-offered-' + id, '1'); } catch (e) {}
  }

  /* Clave de Web3Forms: la MISMA que ya usan los formularios del sitio.
     Sin servidor, sin coste, 250 envíos al mes. La tubería ya estaba
     puesta; simplemente no la estábamos usando. */
  var W3F_KEY = '50ceecdb-5b1e-432e-8954-225883a79ba4';

  /* Fallos seguidos. Un bot que no entiende y sigue insistiendo es una
     pared. A la primera pide que se lo expliquen mejor; a la segunda
     ofrece una persona; a la tercera deja de marear y manda a WhatsApp
     o al correo. Se reinicia en cuanto entiende algo. */
  var misses = 0;
  /* [NUEVO — el cierre]
     Cuando los datos han salido hacia la oficina, la conversación ha llegado a
     su destino. El bot NO vuelve a vender, no vuelve a empujar y no vuelve a
     preguntar "¿qué te sería más útil ahora mismo?". Se queda a mano, callado
     y disponible. Un cliente que acaba de decir que sí no es un desconocido al
     que hay que triar. */
  var closed = false;
  var _lastWasQuestion = false;
  var arranqueOK = false;

  /* ── MEMORIA DE LA CONVERSACIÓN ────────────────────────────
     Hasta ahora el bot trataba cada mensaje como si acabara de conocerte.
     Si decías "Ottawa" y tres mensajes después preguntabas por hormigón,
     no lo relacionaba. Eso es lo que más delata a una máquina.
     Ahora retiene lo que le has dicho, y lo usa. */
  var MEM = { city: null, role: null, roleScore: 0, trade: null, experience: null };

  /* ── REPETICIÓN ────────────────────────────────────────────
     Si el visitante insiste en lo mismo, no quiere más conversación:
     quiere que pase algo. A la segunda, el bot deja de hablar y actúa. */
  var lastTopic = null;
  var repeats = 0;
  /* Si ya se le ha dicho que eso no es lo nuestro, se recuerda. */
  var offScope = false;
  /* Y si lo que ha preguntado solo lo puede contestar una persona, también. */
  var handoff = false;

  /* ── LA SEMILLA ────────────────────────────────────────────
     [FALLO CORREGIDO] El visitante decía "quiero construir un almacén",
     el bot se ofrecía a tomar los datos, él decía "sí"… y el bot le
     preguntaba QUÉ QUERÍA CONSTRUIR. Ya se lo había dicho.

     Ahora se guarda lo último que contó sobre su obra, y al arrancar la
     toma de datos se da por dicho. No se pregunta dos veces lo mismo. */
  var seed = null;      // { work, city, when }  o  texto suelto

  var CITIES = ['toronto', 'ottawa', 'hamilton', 'mississauga', 'brampton', 'markham',
    'vaughan', 'london', 'kingston', 'windsor', 'sudbury', 'thunder bay', 'barrie',
    'cuba', 'habana', 'la habana', 'santiago', 'holguin', 'camaguey',
    'venezuela', 'caracas', 'colombia', 'bogota', 'medellin', 'argentina',
    'mexico', 'peru', 'chile', 'ecuador', 'bolivia', 'republica dominicana',
    'espana', 'madrid', 'barcelona', 'miami', 'estados unidos', 'usa'
  ];

  /* ══════════════════════════════════════════════════════════
     QUIÉN ESCRIBE  (Fase 2)

     No para etiquetar a nadie, sino para no hacerle perder el tiempo: a
     quien busca trabajo no se le habla de licitaciones, y a un
     subcontratista no se le pregunta qué quiere construir.

     [FALLO CORREGIDO — el gordo] La versión anterior buscaba palabras
     por SUBCADENA: "job" está dentro de "job site", y "contract" dentro
     de "contractor". Un comprador que escribía "when can your crew be on
     the job site" quedaba marcado como candidato. Y ganaba el ÚLTIMO que
     coincidiera, sin fuerza: una palabra suelta borraba lo ya sabido.

     Ahora:
       · Se busca por PALABRA COMPLETA, nunca por subcadena.
       · Hay señales FUERTES (una declaración: "I am looking for a job")
         y DÉBILES (una palabra suelta: "salary"). Puntúan distinto.
       · El papel solo se fija con evidencia suficiente, y una vez fijado
         solo lo cambia otra declaración explícita. Un roce no lo tumba.
  ══════════════════════════════════════════════════════════ */

  /* Falsos amigos: expresiones que contienen la palabra de un papel pero
     no significan lo que parece. Se neutralizan ANTES de puntuar. */
  var ROLE_NOISE = [
    'job site', 'jobsite', 'job number', 'job order',
    'apply for a permit', 'apply for a licence', 'apply for a license',
    'contract price', 'contract value', 'contract documents'
  ];

  var STRONG = 3, WEAK = 1, ROLE_MIN = 2;

  /* ══════════════════════════════════════════════════════════
     QUIÉN NOS ESCRIBE. Sirve para ajustar el tono: no se le habla igual
     a alguien que llega por primera vez que a quien ya opera con bots.
     ══════════════════════════════════════════════════════════ */
  var ROLE_SIGNALS = {
    /* El que llega sin saber nada. La mayoría. */
    nuevo: {
      strong: [
        'soy nuevo', 'nunca he usado', 'primera vez', 'no entiendo nada',
        'no se nada de esto', 'empezar desde cero', 'explicame como si',
        'no tengo ni idea', 'acabo de llegar', 'recien empiezo'
      ],
      weak: [
        'nuevo', 'principiante', 'empezar', 'aprender', 'basico', 'sencillo',
        'facil', 'como funciona', 'que es'
      ]
    },
    /* El que ya opera y pregunta cosas concretas. */
    experto: {
      strong: [
        'ya tengo bots', 'mis bots', 'llevo operando', 'mi configuracion',
        'el slippage', 'la separacion entre cuadriculas', 'el spread',
        'take profit', 'stop loss', 'el par', 'la liquidez'
      ],
      weak: [
        'slippage', 'spread', 'liquidez', 'par', 'volumen', 'apalancamiento',
        'backtest', 'roi', 'apy', 'exchange', 'dex', 'cex'
      ]
    },
    /* El que tiene un problema y quiere que se lo resuelvan ya. */
    problema: {
      strong: [
        'no me funciona', 'tengo un problema', 'me da error', 'perdi dinero',
        'no puedo retirar', 'esta trabado', 'llevo dias esperando',
        'nadie me responde', 'quiero mi dinero'
      ],
      weak: [
        'error', 'problema', 'falla', 'roto', 'atascado', 'ayuda', 'urgente'
      ]
    }
  };


  /* Palabra completa, nunca subcadena.

     [FALLO CORREGIDO EN PRUEBA] Estas expresiones se compilaban al cargar
     el archivo, y usan normalize(), cuyas tablas se declaran MÁS ABAJO. En
     el navegador eso reventaba el módulo entero: no habría habido chatbot,
     no un chatbot con un fallo. Se compilan la primera vez que se usan,
     cuando ya existe todo. */
  var ROLE_RE = null, NOISE_RE = null;

  function compileRoles() {
    ROLE_RE = {};
    Object.keys(ROLE_SIGNALS).forEach(function (r) {
      ROLE_RE[r] = { strong: [], weak: [] };
      ['strong', 'weak'].forEach(function (w) {
        ROLE_SIGNALS[r][w].forEach(function (p) {
          ROLE_RE[r][w].push(new RegExp('\\b' + normalize(p).replace(/\s+/g, '\\s+') + '\\b'));
        });
      });
    });
    NOISE_RE = ROLE_NOISE.map(function (p) {
      return new RegExp('\\b' + p.replace(/\s+/g, '\\s+') + '\\b', 'g');
    });
  }

  function scoreRoles(n) {
    if (!ROLE_RE) compileRoles();
    NOISE_RE.forEach(function (re) { re.lastIndex = 0; n = n.replace(re, ' '); });

    var best = null;
    Object.keys(ROLE_RE).forEach(function (r) {
      var s = 0;
      ROLE_RE[r].strong.forEach(function (re) { if (re.test(n)) s += STRONG; });
      ROLE_RE[r].weak.forEach(function (re) { if (re.test(n)) s += WEAK; });
      if (s > 0 && (!best || s > best.score)) best = { role: r, score: s };
      else if (best && s === best.score && r !== best.role) best.tie = true;
    });

    if (!best || best.tie || best.score < ROLE_MIN) return null;
    return best;
  }

  /* Oficios. Aquí SÍ vale una lista: al contrario que "las cosas que se
     pueden construir", los oficios son un conjunto pequeño y cerrado.
     Solo se apunta cuando ya creemos que es candidato o proveedor: a un
     comprador que dice "soy el jefe de obra del ayuntamiento" no se le
     apunta "jefe de obra" como oficio. */
  var TRADES = [
    /* [AMPLIADO] Faltaban los oficios que MÁS se escriben: drywall, framing,
       electrical, iron. "u hire drywall" y "I do framing" no significaban
       nada, y quien se ofrecía a trabajar recibía un "no te he entendido". */
    'drywall', 'drywaller', 'taper', 'framing', 'framer', 'electrical', 'hvac',
    'plumbing', 'ironworker', 'iron', 'steel', 'roofing', 'masonry', 'concrete',
    'forming', 'formwork', 'rebar', 'labour', 'labor', 'labourer', 'general labour',
    'excavation', 'excavator', 'dozer', 'machine operator', 'snow removal',
    'landscaping', 'demolition', 'cleaner', 'installer', 'fitter',
    'carpenter', 'framer', 'joiner', 'electrician', 'plumber', 'mason', 'bricklayer',
    'stonemason', 'welder', 'ironworker', 'rebar', 'concrete finisher', 'cement finisher',
    'labourer', 'laborer', 'operator', 'equipment operator', 'crane operator', 'foreman',
    'forewoman', 'supervisor', 'superintendent', 'drywaller', 'taper', 'painter', 'roofer',
    'glazier', 'tiler', 'plasterer', 'pipefitter', 'steamfitter', 'millwright', 'scaffolder',
    'surveyor', 'estimator', 'project manager', 'site manager', 'safety officer', 'apprentice',
    'helper', 'driver', 'landscaper', 'insulator', 'sheet metal worker', 'flooring installer',
    'hvac technician', 'excavator operator', 'demolition', 'formwork'
  ];
  var TRADE_RE = new RegExp('\\b(' + TRADES.join('|') + ')s?\\b');
  var EXP_RE   = new RegExp('\\b(\\d{1,2})\\s*\\+?\\s*(years?|yrs?|anos)\\b');

  function remember(text) {
    var n = normalize(text);

    CITIES.forEach(function (c) {
      if (new RegExp('\\b' + c + '\\b').test(n)) MEM.city = c;
    });

    /* ── El papel ── */
    var r = scoreRoles(n);
    if (r) {
      if (!MEM.role) {
        MEM.role = r.role; MEM.roleScore = r.score;
      } else if (r.role === MEM.role) {
        MEM.roleScore = Math.max(MEM.roleScore || 0, r.score);
      } else if (r.score >= STRONG) {
        /* Solo una declaración explícita cambia de papel. La gente cambia
           de idea ("en realidad pregunto por un puesto"): hay que dejarla. */
        MEM.role = r.role; MEM.roleScore = r.score;
      }
    }

    /* ── Oficio y experiencia: para no preguntar dos veces lo que ya dijo ── */
    /* [FALLO CORREGIDO] Solo se apuntaba el oficio si YA se sabía que era un
       candidato. Pero muchas veces el oficio es lo ÚNICO que dice ("u hire
       drywall"), y sin él no hay papel: la pescadilla que se muerde la cola.
       Se apunta siempre, salvo a los compradores — que cuando nombran un
       oficio están pidiendo uno, no ofreciéndose. */
    if (MEM.role !== 'buyer') {
      var t = TRADE_RE.exec(n);
      if (t && !MEM.trade) MEM.trade = t[1];
      var e = EXP_RE.exec(n);
      if (e && !MEM.experience) MEM.experience = e[0];
    }

    try { sessionStorage.setItem('np-chat-mem', JSON.stringify(MEM)); } catch (err) {}
  }

  function loadMem() {
    try {
      var m = JSON.parse(sessionStorage.getItem('np-chat-mem') || 'null');
      if (m) {
        MEM.city       = m.city       || null;
        MEM.role       = m.role       || null;
        MEM.roleScore  = m.roleScore  || 0;
        MEM.trade      = m.trade      || null;
        MEM.experience = m.experience || null;
      }
    } catch (e) {}
  }

  /* ══════════════════════════════════════════════════════════
     UN SOLO SITIO DECIDE QUÉ FLUJO SE OFRECE

     [FALLO CORREGIDO] El motor daba por hecho que todo el mundo venía a
     comprar: 'project' estaba cableado en cinco puntos del motor y en
     treinta entradas de la base. Un albañil que escribía "tengo diez años
     en mampostería" recibía "¿te tomo los datos de tu proyecto?".

     Ahora la base sigue diciendo lo mismo ('project' es el supuesto por
     defecto) y es AQUÍ, en un único punto, donde se traduce al papel de
     quien escribe. Añadir un papel nuevo mañana se hace en esta función,
     no en treinta entradas.
  ══════════════════════════════════════════════════════════ */
  var ROLE_FLOW = { buyer: 'project', candidate: 'job', supplier: 'supplier' };

  function flowFor(id) {
    if (!MEM.role) return id;
    var want = ROLE_FLOW[MEM.role];
    if (!want || want === id) return id;

    /* Solo se corrige el SUPUESTO por defecto (comprador). Si la base pide
       expresamente un flujo distinto del genérico, se respeta. */
    if (id !== 'project' && !(id === 'job' && MEM.role === 'supplier')) return id;

    return DATA.flows[want] ? want : id;
  }

  /* Variantes por papel. Una lista de la base puede ser un array de toda
     la vida (y entonces vale para todos) o un objeto por papel:
       { any: [...], candidate: [...] }
     El motor no sabe qué es un candidato: sabe que hay listas que pueden
     variar. Mismo principio que la traducción — un solo punto, y las 53
     entradas se quedan como están. */
  function roleList(x) {
    if (!x) return [];
    if (Object.prototype.toString.call(x) === '[object Array]') return x;
    return x[MEM.role] || x.any || [];
  }

  function roleKey(base) { return base + '#' + (MEM.role || 'any'); }

  /* ── URGENCIA ──────────────────────────────────────────────
     Alguien con prisa no quiere cinco preguntas: quiere un teléfono. */
  var URGENT = new RegExp('\\b(' + [
    'urgent', 'urgently', 'asap', 'as soon as possible', 'emergency', 'right away',
    'immediately', 'today', 'tomorrow', 'this week', 'deadline is', 'running out of time',
    'urgente', 'cuanto antes', 'ya mismo', 'de inmediato'
  ].join('|') + ')\\b');

  /* ── FUERA DE TEMA ─────────────────────────────────────────
     El tiempo, el fútbol, un chiste. Un "no lo sé" mata la conversación
     y con ella al cliente. Se reconoce, y se vuelve al terreno propio. */
  /* RED DE SEGURIDAD del desvío. "A movie theatre renovation" contiene
     "movie", pero es una obra de verdad. Si aparece cualquier palabra de
     construcción, NO se desvía jamás. Perder un cliente por un filtro
     tonto es el peor error posible. */
  /* ══════════════════════════════════════════════════════════
     [EL FALLO MÁS CARO DE TODOS, Y EL MÁS TONTO]

     Esta lista buscaba las palabras EN SINGULAR: "brick", "wall", "mason".
     La palabra "bricks" no existía para el bot. Ni "walls". Ni "masons".

     Resultado: "the bricks are falling off my garage" — el cliente
     residencial más corriente que hay — NO era construcción. Y "6 MASONS for
     tomorrow" tampoco. Se les hacía TRIAJE y la conversación se caía entera.
     Eran clientes invisibles.

     Ahora la terminación no importa: plural, gerundio o participio, la misma
     palabra. Y la lista se ha llenado con lo que la gente dice de verdad
     (garaje, escalera, sótano, gotera, grieta), no con lo que dice un pliego.
  ══════════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════════
     PALABRAS DE NUESTRO MUNDO. Sirven para saber si alguien pregunta
     algo de la plataforma aunque no use nuestros nombres exactos.
     La gente escribe como habla ("perdí plata", "no me vende"),
     no con el vocabulario del manual.
     ══════════════════════════════════════════════════════════ */
  var TEMA_WORDS = [
    /* la plataforma */
    'aurex', 'bot', 'bots', 'robot', 'plataforma', 'web', 'app', 'aplicacion',
    'grid', 'cuadricula', 'cuadriculas', 'rejilla', 'acumulador', 'accumulator',
    'cash out', 'cashout', 'dca', 'smart grid', 'estrategia', 'configuracion',
    /* dinero y mercado */
    'cripto', 'crypto', 'moneda', 'monedas', 'token', 'bnb', 'usdt', 'usdc',
    'btc', 'bitcoin', 'eth', 'ethereum', 'precio', 'precios', 'mercado',
    'comprar', 'vender', 'compra', 'venta', 'invertir', 'inversion', 'ganancia',
    'ganar', 'perder', 'perdida', 'beneficio', 'rentable', 'rentabilidad',
    'trading', 'operar', 'operacion', 'operaciones', 'swap', 'intercambio',
    'saldo', 'fondos', 'dinero', 'plata', 'capital', 'retirar', 'depositar',
    /* wallet y red */
    'wallet', 'billetera', 'metamask', 'trust', 'safepal', 'conectar',
    'conexion', 'red', 'blockchain', 'cadena', 'bsc', 'binance', 'gas',
    'comision', 'comisiones', 'firma', 'firmar', 'aprobar', 'permiso',
    'suscripcion', 'cuota', 'mensual', 'pagar', 'pago',
    /* secciones */
    'marketplace', 'market', 'p2p', 'vendedor', 'comprador', 'disputa',
    'fianza', 'prize pool', 'sorteo', 'pozo', 'premio', 'ganador',
    'perfil', 'grafica', 'grafico', 'historial', 'instalar',
    /* qué le pasa */
    'error', 'falla', 'fallo', 'problema', 'no funciona', 'no carga',
    'atascado', 'trabado', 'lento', 'roto', 'ayuda', 'duda', 'como',
    'seguro', 'seguridad', 'estafa', 'confiar', 'riesgo'
  ];

  /* La terminación no manda: "bot", "bots", "botes" son lo mismo. */
  var TEMA_RE = new RegExp('\\b(' + TEMA_WORDS.join('|') +
                                ')(s|es|ar|es|ando|ado)?\\b');

  function esDeNuestroTema(text) {
    return TEMA_RE.test(normalize(text));
  }

  /* Mismo problema aquí: "jokes" y "movies" no existían. */
  var OFFTOPIC = new RegExp('\\b(' + [
    'weather', 'raining', 'snowing', 'hockey', 'soccer', 'football', 'basketball',
    'joke', 'music', 'movie', 'film', 'politics', 'election', 'religion',
    'girlfriend', 'boyfriend', 'married', 'birthday', 'vacation', 'horoscope',
    'lego', 'mars', 'moon', 'banana', 'pizza', 'favourite colour', 'favorite color',
    'clima', 'futbol', 'chiste', 'pelicula'
  ].join('|') + ')(s|es)?\\b');

  /* ════════════════════════════════════════════════════════
     1. LENGUA
  ════════════════════════════════════════════════════════ */

  var CONTRACTIONS = [
    [/\bdon'?t\b/g, 'do not'],      [/\bcan'?t\b/g, 'can not'],
    [/\bwon'?t\b/g, 'will not'],    [/\bisn'?t\b/g, 'is not'],
    [/\bdoesn'?t\b/g, 'does not'],  [/\bwouldn'?t\b/g, 'would not'],
    [/\bi'?m\b/g, 'i am'],          [/\bi'?ve\b/g, 'i have'],
    [/\bwhat'?s\b/g, 'what is'],    [/\bhow'?s\b/g, 'how is'],
    [/\bwhere'?s\b/g, 'where is'],  [/\byou'?re\b/g, 'you are'],
    [/\bwe'?re\b/g, 'we are'],      [/\bit'?s\b/g, 'it is'],
    [/\blet'?s\b/g, 'let us'],      [/\bthats\b/g, 'that is']
  ];

  var SYNONYMS = {
    price:      ['cost', 'costs', 'quote', 'quotation', 'estimate', 'budget', 'rate', 'rates', 'fee', 'pricing', 'charge', 'expensive', 'cheap'],
    hire:       ['contract', 'engage', 'retain', 'commission', 'award'],
    indigenous: ['aboriginal', 'nations', 'native', 'metis', 'inuit', 'reconciliation'],
    work:       ['bot', 'proyecto', 'operacion', 'trading', 'inversion', 'cartera'],
    person:     ['human', 'someone', 'somebody', 'advisor', 'adviser', 'representative', 'agent', 'staff', 'manager', 'estimator'],
    area:       ['region', 'location', 'coverage', 'zone', 'territory', 'province', 'city', 'town'],
    company:    ['firm', 'business', 'organisation', 'organization', 'outfit'],
    schedule:   ['timeline', 'deadline', 'timeframe', 'duration', 'urgent'],
    safety:     ['insurance', 'insured', 'wsib', 'liability', 'bonded', 'compliance']
  };

  var STOPWORDS = ('a an the and or but of to in on for with at by from is are was were be been am ' +
    'do does did can could would should will i you we they it my your our their me us them ' +
    'this that these those which who whom please tell give want need like just get got have has ' +
    'had about there here if so as also very really ok okay hi hello thanks thank some any').split(' ');

  /* ══════════════════════════════════════════════════════════
     CAPA DE TRADUCCIÓN  —  el arreglo estructural, no el parche.

     EL FALLO DE RAÍZ: toda la base, todas las claves y todas las
     intenciones estaban EN INGLÉS. Un visitante que escribe "reparaciones
     de edificios" no existía para el motor: ni tema, ni intención, ni
     construcción. Caía al vacío. Y en Canadá — bilingüe, con inmigración,
     con medio mundo usando el traductor del navegador — eso no es un caso
     raro: es la mitad de los visitantes.

     LA SOLUCIÓN NO ES traducir 52 entradas a tres idiomas (inmantenible).
     Es traducir la ENTRADA una sola vez, en el punto por el que pasa todo:
     aquí. El motor sigue pensando en inglés, y el visitante escribe como
     quiera. Un solo diccionario y funcionan TODAS las capas a la vez:
     temas, intenciones, extracción, ciudades, urgencia y desvíos.
  ══════════════════════════════════════════════════════════ */
  var LEX = {
    /* ── español ── */
    /* Los artículos. Sin esto, el bot le repetía al visitante "build **un**
       warehouse": había traducido el verbo y el sustantivo, y dejaba el
       artículo español en medio de la frase inglesa. */
    un: 'a', una: 'a', unos: 'some', unas: 'some',
    el: 'the', la: 'the', los: 'the', las: 'the',
    reparacion: 'repair', reparaciones: 'repair', reparar: 'repair', reparo: 'repair',
    arreglar: 'repair', arreglo: 'repair', reparando: 'repair',
    invertir: 'invest', inversion: 'investment', operando: 'trading',
    edificio: 'building', edificios: 'building', edificacion: 'building',
    obra: 'project', obras: 'project', proyecto: 'project', proyectos: 'project',
    presupuesto: 'quote', precio: 'price', precios: 'price', costo: 'cost', coste: 'cost',
    cuanto: 'how much', cuando: 'when', donde: 'where', quien: 'who', porque: 'why',
    /* Los oficios. Sin esto, "soy albañil" no significaba nada para el bot:
       le hacía TRIAJE a alguien que acababa de decirle exactamente quién es. */
    soy: 'i am', somos: 'we are', trabajo: 'work', empleo: 'job', curriculum: 'resume',
    albanil: 'mason', carpintero: 'carpenter', electricista: 'electrician',
    plomero: 'plumber', fontanero: 'plumber', soldador: 'welder', pintor: 'painter',
    techador: 'roofer', obrero: 'labourer', peon: 'labourer', ayudante: 'helper',
    aprendiz: 'apprentice', operador: 'operator', capataz: 'foreman',
    encargado: 'supervisor', encofrador: 'formwork', yesero: 'plasterer',
    experiencia: 'experience', anos: 'years',
    /* [AMPLIADO] Dictado, jerga y autocorrector. Sin esto: "peon" no era un
       oficio, "mi balcon esta inundado" no era una obra, "quitanieves" no era
       nada, y "sobrino" no existía. */
    peon: 'labourer', peones: 'labourer', obrero: 'labourer',
    quitanieves: 'snow removal', nieve: 'snow', sobrino: 'nephew',
    balcon: 'balcony', inundado: 'flooded', inundada: 'flooded',
    filtracion: 'leak', fuga: 'leak', gotera: 'leak', goteras: 'leak',
    fontanero: 'plumber', plomeria: 'plumbing', electricidad: 'electrical',
    delineante: 'draftsman', planos: 'drawings', plano: 'drawing',
    permiso: 'permit', permisos: 'permits', licencia: 'permit',
    sotano: 'basement', hierro: 'iron', acero: 'steel', madera: 'timber',
    cotizacion: 'quote', cotizaciones: 'quotes', maquina: 'machine',
    maquinas: 'machines', excavadora: 'excavator', tierra: 'soil',
    mudanza: 'moving', muebles: 'furniture', sofa: 'couch',
    inmobiliaria: 'real estate', propiedades: 'properties',
    administrador: 'property manager', cuotas: 'fees', inquilino: 'tenant',
    curriculum: 'resume', hundiendo: 'sagging', hundido: 'sagging',
    empresa: 'company', empresas: 'companies', compania: 'company',
    parchear: 'patch', parche: 'patch', tabique: 'drywall',
    hacen: 'do you', haceis: 'do you', hace: 'do you', pueden: 'can you', podeis: 'can you',
    puede: 'can you', ustedes: 'you', vosotros: 'you', tienen: 'do you have',
    quiero: 'i want', queremos: 'we want', necesito: 'i need', necesitamos: 'we need',
    busco: 'looking for', buscamos: 'looking for', tengo: 'i have', tenemos: 'we have',
    saber: 'know', conocer: 'know', pregunta: 'question', duda: 'question',
    techo: 'roof', tejado: 'roof', cubierta: 'roof', muro: 'wall', pared: 'wall',
    paredes: 'wall', suelo: 'floor', piso: 'floor', cimientos: 'foundation',
    cimentacion: 'foundation', hormigon: 'concrete', cemento: 'concrete',
    ladrillo: 'brick', ladrillos: 'brick', albanileria: 'masonry', mamposteria: 'masonry',
    almacen: 'warehouse', nave: 'warehouse', bodega: 'warehouse', galpon: 'warehouse',
    escuela: 'school', colegio: 'school', hospital: 'hospital', puente: 'bridge',
    carretera: 'road', calle: 'road', estacionamiento: 'parking', aparcamiento: 'parking',
    empresa: 'company', compania: 'company', contratista: 'contractor',
    contratistas: 'contractor', trabajo: 'work', trabajos: 'work', empleo: 'job',
    curriculum: 'resume', vacante: 'job', puesto: 'job', oficio: 'trade',
    seguro: 'insurance', seguros: 'insurance', certificado: 'certificate',
    certificacion: 'certification', licitacion: 'tender', licitaciones: 'tender',
    oferta: 'bid', concurso: 'tender', requisito: 'requirement',
    urgente: 'urgent', urgencia: 'urgent', manana: 'tomorrow', hoy: 'today',
    semana: 'week', mes: 'month', ano: 'year', plazo: 'deadline', fecha: 'date',
    persona: 'person', llamar: 'call', telefono: 'phone', correo: 'email',
    indigena: 'indigenous', indigenas: 'indigenous',
    mantenimiento: 'maintenance', remodelacion: 'renovation', reforma: 'renovation',
    renovar: 'renovate', demoler: 'demolish', instalar: 'install', ampliar: 'extend',
    pintar: 'paint', gestion: 'management', direccion: 'management',
    residencial: 'residential', comercial: 'commercial', industrial: 'industrial',
    danado: 'damaged', roto: 'broken', grieta: 'crack', grietas: 'crack',
    agrietado: 'cracked', filtracion: 'leak', gotera: 'leak', humedad: 'damp',
    entiendo: 'understand', entender: 'understand', respondes: 'answer',
    responsabilidad: 'liability', civil: 'civil', cobertura: 'coverage',
    respondiendo: 'answering', respuesta: 'answer', responder: 'answer',
    sentido: 'sense', claro: 'clear', pregunte: 'asked', preguntando: 'asking',
    solicitando: 'asking', dije: 'said', explique: 'explained',
    /* ── francés ──
       [AMPLIADO] Estaba casi vacío. "je veux renover un entrepot a Montreal"
       no significaba nada: el bot arrancaba el formulario y le preguntaba QUÉ
       quería construir, y después se tragaba "au printemps" como si fuera la
       descripción de la obra. Datos basura a la oficina. Canadá es bilingüe:
       esto no es un lujo. */
    reparation: 'repair', reparations: 'repair', reparer: 'repair', batiment: 'building',
    travaux: 'work', devis: 'quote', combien: 'how much', quand: 'when',
    pouvez: 'can you', faites: 'do you', besoin: 'need', entreprise: 'company',
    beton: 'concrete', toit: 'roof', mur: 'wall', chantier: 'site',
    renovation: 'renovation', urgence: 'urgent',
    je: 'i', nous: 'we', veux: 'want', voulons: 'want', cherche: 'looking for',
    cherchons: 'looking for', construire: 'build', renover: 'renovate',
    demolir: 'demolish', installer: 'install', remplacer: 'replace',
    entrepreneur: 'contractor', soustraiter: 'subcontract', soustraitant: 'subcontractor',
    entrepot: 'warehouse', usine: 'plant', bureau: 'office', ecole: 'school',
    pont: 'bridge', maison: 'house', immeuble: 'building', magasin: 'store',
    brique: 'brick', maconnerie: 'masonry', sol: 'floor', fondation: 'foundation',
    prix: 'price', cout: 'cost', ou: 'where', pourquoi: 'why', qui: 'who',
    emploi: 'job', embauche: 'hiring', postuler: 'apply', metier: 'trade',
    fournisseur: 'supplier', soustraitant: 'subcontractor',
    printemps: 'spring', ete: 'summer', automne: 'autumn', hiver: 'winter',
    aujourdhui: 'today', demain: 'tomorrow', bientot: 'soon',
    merci: 'thanks', bonjour: 'hello', salut: 'hello', personne: 'a person'
  };

  /* Frases hechas. Palabra a palabra no basta: "por qué" son dos
     palabras, "no tiene sentido" son tres. Se traducen antes. */
  var PHRASES = [
    /* "¿Qué tiempo hace?" en francés. Sin esto se iba al triaje ("no te he
       entendido") en vez de al desvío amable. Se mapea la FRASE, no la
       palabra: "temps" a secas también significa "tiempo" de duración
       ("combien de temps"), y confundirlas sería peor que no traducir. */
    [/\bhabeis trabajado\b/g,    'have you worked'],
    [/\bhabeis construido\b/g,   'have you built'],
    [/\btienen experiencia\b/g,  'do you have experience'],
    [/\btengo una empresa\b/g,   'i have a company'],
    [/\bmi empresa\b/g,          'my company'],
    [/\bnuestra empresa\b/g,     'our company'],
    [/\bmi sobrino\b/g,          'my nephew'],
    [/\bquel temps\b/g,          'weather'],
    [/\bla meteo\b/g,            'weather'],
    [/\bno entiendo por que\b/g, 'i do not understand why'],
    [/\bno entiendo\b/g,          'i do not understand'],
    [/\bpor que\b/g,              'why'],
    [/\bno tiene sentido\b/g,     'that does not make sense'],
    [/\bno me (respondiste|has respondido|estas respondiendo)\b/g, 'you did not answer'],
    [/\bno me estas (escuchando|entendiendo)\b/g, 'you are not listening'],
    [/\beso no es lo que (pregunte|dije)\b/g, 'that is not what i asked'],
    [/\bfui (bastante )?claro\b/g, 'i was clear'],
    [/\bte (estoy )?(preguntando|solicitando)\b/g, 'i asked you'],
    [/\bresponsabilidad civil\b/g, 'liability'],
    [/\bcuanto cuesta\b/g,        'how much'],
    [/\bcuanto vale\b/g,          'how much'],
    [/\bquiero saber\b/g,         'i want to know'],
    [/\bme gustaria\b/g,          'i would like'],
    [/\bhablar con (alguien|una persona)\b/g, 'speak to a person'],
    [/\bpuedo hablar\b/g,         'can i speak'],
    [/\bque tipo de\b/g,          'what kind of'],
    [/\bde que manera\b/g,        'how'],
    [/\bhace falta\b/g,           'is needed'],
    [/\bse cayo\b/g,              'collapsed'],
    [/\bse rompio\b/g,            'broke']
  ];

  function normalize(str) {
    var s = String(str || '').toLowerCase();
    CONTRACTIONS.forEach(function (c) { s = s.replace(c[0], c[1]); });
    s = s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s?%]/g, ' ')
      /* [FALLO CORREGIDO] El "?" se conservaba PEGADO a la palabra: "empresa?"
         no casaba con la clave "empresa", así que TODA pregunta en español que
         terminara en signo fallaba ("¿cómo se llama tu empresa?" → "no te he
         entendido"). El "?" se separa con espacios: se conserva como señal de
         que hay una pregunta, pero deja de ensuciar la última palabra. */
      .replace(/\?/g, ' ? ')
      .replace(/\s+/g, ' ')
      .trim();

    /* Frases hechas primero, luego palabra a palabra. El motor sigue
       pensando en inglés; el visitante escribe como quiera. */
    PHRASES.forEach(function (p) { s = s.replace(p[0], p[1]); });

    return s.split(' ').map(function (w) {
      return LEX[w] || w;
    }).join(' ');
  }

  function stem(w) {
    if (w.length < 6) return w;
    return w.replace(/(ing|ies|es|s)$/, '');
  }

  /* ══════════════════════════════════════════════════════════
     [FALLO CORREGIDO — el bot leía mal palabras BIEN escritas]

     La tolerancia era de DOS erratas en palabras largas. Pero dos erratas
     de margen no distinguen una palabra mal escrita de OTRA PALABRA: entre
     "building" y "billing" (facturación) hay exactamente dos. Resultado: a
     quien escribía "building" el bot le contestaba sobre condiciones de
     pago. El margen ancho no arreglaba erratas: inventaba temas.

     La solución no es apretar el margen y perder las erratas de verdad,
     sino contar bien: la mayoría de las erratas humanas son letras
     CAMBIADAS DE SITIO ("cocnrete"), que es UN error, no dos. Contándolas
     como uno, basta con un margen de uno — y "building" deja de ser
     "billing", porque ahí no hay ninguna letra cambiada de sitio.
  ══════════════════════════════════════════════════════════ */
  function isTypo(a, b) {
    if (a.length < 5 || Math.abs(a.length - b.length) > 1) return false;

    /* Damerau-Levenshtein: el intercambio de dos letras contiguas cuesta 1. */
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) { d[0][j] = j; }

    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        var cost = (a[i - 1] === b[j - 1]) ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1,          // borrar
                           d[i][j - 1] + 1,          // insertar
                           d[i - 1][j - 1] + cost);  // sustituir
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);   // cambiadas de sitio
        }
      }
    }
    /* Un solo error. En palabras muy largas, dos. */
    return d[a.length][b.length] <= (a.length >= 11 ? 2 : 1);
  }

  function tokens(text) {
    return normalize(text).replace(/\?/g, '').split(' ').filter(function (w) {
      if (/\d/.test(w)) return true;                       // "5", "5%"
      return w.length > 2 && STOPWORDS.indexOf(w) === -1;
    });
  }

  function expand(words) {
    var out = words.slice();
    words.forEach(function (w) {
      var s = stem(w);
      if (s !== w) out.push(s);
      Object.keys(SYNONYMS).forEach(function (root) {
        if (w === root || SYNONYMS[root].indexOf(w) !== -1) {
          out.push(root);
          out = out.concat(SYNONYMS[root]);
        }
      });
    });
    return out;
  }

  /* ════════════════════════════════════════════════════════
     1-BIS. CAPA DE INTENCIÓN  —  la que evita listar el mundo entero

     PROBLEMA DE FONDO: una base de conocimiento solo entiende lo que
     está escrito en ella. Si el visitante usa otras palabras, no existe.
     Y no se pueden escribir todas las frases del mundo: siempre habrá
     otra piedra en el camino.

     SOLUCIÓN: no reconocer el TEMA, sino la FORMA de la frase. Una
     pregunta tiene forma de pregunta ("¿podéis…?", "¿cuánto…?", "¿dónde…?")
     con independencia de lo que se pregunte. Así, aunque el asunto sea
     completamente desconocido, el bot sabe QUÉ TIPO de respuesta debe dar
     y nunca se queda mudo.
  ════════════════════════════════════════════════════════ */

  var INTENTS = [
    { id: 'proof',      re: /\b(certif\w*|insur\w*|licen\w*|bond\w*|reference|prequal\w*|wsib|liability|compliance|accredit\w*)\b/ },
    { id: 'price',      re: /\b(how much|price\w*|pricing|cost\w*|quote|estimate|budget\w*|ballpark|figure|rate|rates|fee|fees|charge|indicative|a number|give me a number|rough idea|roughly|approximate|expensive|cheap|afford|per square)\b/ },
    { id: 'time',       re: /\b(when|how long|how soon|deadline|timeline|timeframe|schedule|start date|availability|lead time)\b/ },
    { id: 'place',      re: /\b(where|which city|what city|do you work in|do you cover|do you serve|do you travel|area)\b/ },
    { id: 'person',     re: /\b(who|speak to|talk to|call someone|contact|human|a person|manager|owner|director)\b/ },
    { id: 'capability', re: /\b(do you|can you|could you|would you|are you able|do you handle|do you offer|is that something|is this something|do you fix|can you fix|do you take on)\b/ },
    { id: 'need',       re: /\b(i need|we need|i want|we want|i require|we require|i am looking|we are looking|looking for|i would like|we would like|need someone|needs? (a|an|the|new|another|additional|second)|requires? (a|an)|planning|plan to|proposing|shortlist\w*|considering|tendering)\b/ },
    { id: 'problem',    re: /\b(crack\w*|leak\w*|collaps\w*|broken|damag\w*|failing|failed|crumbl\w*|rotten|rusted|sink\w*|subsid\w*|spall\w*|delaminat\w*|honeycomb\w*|heaving|pothole\w*|falling apart|deteriorat\w*|needs? (repair|fixing|attention|sorting|work)|in bad shape|unsafe|agriet\w*|roto|dañad\w*)\b/ },
    { id: 'unsure',     re: /\b(no idea|not sure|do not know|dont know|need help|need advice|help me|what should i|what would you|advice|guidance|help me decide|inherited|can we continue|i was talking before|what (info|information) (do )?you need|no se|no tengo idea|necesito ayuda)\b/ },
    { id: 'explain',    re: /\b(what is|what are|what does|explain|tell me about|how does|how do you|why)\b/ },
    { id: 'compare',    re: /\b(better|different|compare|versus|vs|instead of|competitor|why you)\b/ },
    /* [NUEVO — el hueco más caro de esta ronda] "Have you built supermarkets
       before?", "¿habéis trabajado en reserva?", "experience with security
       installations?". Es LA pregunta que hace todo comprador antes de
       contratar, y el bot le hacía TRIAJE. Ahora reconoce la forma — y la
       contesta con la verdad, que es que aún no hay casos publicados. */
    { id: 'experience', re: /\b(have you (ever )?(built|done|worked|delivered|completed|handled)|any experience|experience (with|in|on)|done (this|that|it) before|worked on (a|any)|track record|case stud\w*|portfolio)\b/ },

    /* [NUEVO] Una PRESENTACIÓN no es una pregunta, pero tampoco es ruido.
       "I am a consulting structural engineer." recibía un triaje: el bot le
       decía "no te he entendido" a alguien que se estaba presentando. Se
       acusa recibo y se le devuelve la palabra. */
    { id: 'intro',      re: /\b(i am a|i am an|i am the|im a|im an|i work as|i work for|i lead|i run a|i represent|we are a|we are an|we run|we maintain|we operate|we manage|my name is|my company|our company|i have a company|retired|this is|here,|from the [a-z]+ (board|church|group|district))\b/ }
  ];

  function detectIntent(text) {
    var n = normalize(text);
    for (var i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i].re.test(n)) return INTENTS[i].id;
    }
    return null;
  }

  /* ── EXTRACCIÓN DE DATOS ───────────────────────────────────
     Sacar de una frase suelta QUÉ, DÓNDE y CUÁNDO, sin que esas palabras
     estén en ninguna lista. "Necesito rehacer el tejado de una nave en
     Sudbury para la primavera" → obra: rehacer el tejado de una nave ·
     ciudad: Sudbury · plazo: primavera.

     Esto es lo que permite que el bot REPITA lo que ha entendido y solo
     pregunte lo que falta. No hay que listar "almacén", ni "tejado", ni
     "pabellón": se captura lo que venga detrás del verbo. */

  var VERBS = 'build|construct|erect|renovate|refurbish|repair|fix|restore|replace|install|' +
              'demolish|expand|extend|upgrade|remodel|convert|pave|excavate|' +
              'construir|levantar|reparar|reformar|rehacer|instalar|demoler';

  var WHEN_RE = new RegExp('\\b(' + [
    'asap', 'as soon as possible', 'immediately', 'urgent',
    'next (week|month|year|spring|summer|fall|autumn|winter)',
    'this (week|month|year|spring|summer|fall|autumn|winter)',
    'in \\d+ (days|weeks|months|years)',
    'january|february|march|april|may|june|july|august|september|october|november|december',
    'q[1-4]', '20\\d\\d',
    'spring|summer|autumn|fall|winter'
  ].join('|') + ')\\b');

  function extract(text) {
    var raw = String(text);
    var n   = normalize(raw);
    var out = { work: null, city: null, when: null };

    /* QUÉ: lo que sigue al verbo de obra, sea lo que sea. */
    /* Los verbos, en cualquier forma: "converting", "repaired", "builds".
       Sin esto, "we are converting an old bank" no se reconocía. */
    var m = new RegExp('\\b(?:' + VERBS + ')(?:ing|ed|es|s)?\\s+' +
                       '(?:a|an|the|our|my|some|two|three|new|old|el|la|un|una)?\\s*' +
                       '([\\w\\s-]{3,50})').exec(n);
    if (m) {
      out.work = m[0].split(/\s+/).slice(0, 8).join(' ').trim();
    }

    /* DÓNDE */
    for (var i = 0; i < CITIES.length; i++) {
      if (new RegExp('\\b' + CITIES[i] + '\\b').test(n)) {
        out.city = CITIES[i].charAt(0).toUpperCase() + CITIES[i].slice(1);
        break;
      }
    }

    /* CUÁNDO */
    var w = WHEN_RE.exec(n);
    if (w) out.when = w[0];

    /* La ciudad NO forma parte de la obra. Sin esto, el bot repetía
       "renovate a warehouse a montreal" — se comía el "à Montréal" dentro de
       la descripción y luego lo apuntaba OTRA VEZ como ciudad. En el correo a
       la oficina quedaba duplicado y mal escrito. */
    if (out.work && out.city) {
      var at = out.work.toLowerCase().indexOf(out.city.toLowerCase());
      if (at > 0) {
        out.work = out.work.slice(0, at)
          .replace(/\s+(in|at|near|on|around|a|de|para|dans|pres)\s*$/, '')
          .trim();
      }
    }

    return out;
  }

  /* ════════════════════════════════════════════════════════
     2. DETECCIÓN DE TEMAS — el corazón del asunto
  ════════════════════════════════════════════════════════ */

  function scoreEntry(entry, norm, words, wide) {
    var s = 0, pos = 9999, at;
    entry.keys.forEach(function (key) {
      var k = normalize(key);

      /* El mensaje ENTERO es la clave ("hello", "thanks", "bye").
         Sin esto, un saludo suelto se perdía: sus palabras están en la
         lista de vacías y el mensaje se quedaba sin fichas que puntuar. */
      if (norm === k) { s += 14; pos = 0; return; }

      if (k.indexOf(' ') !== -1) {                        // frase entera
        at = norm.indexOf(k);
        if (at !== -1) {
          s += 12 + k.split(' ').length;
          if (at < pos) pos = at;
        }
        return;
      }
      if (words.indexOf(k) !== -1) {                      // palabra exacta
        s += 7;
        at = norm.indexOf(k);
        if (at !== -1 && at < pos) pos = at;
        return;
      }

      /* [FALLO CORREGIDO] "hello" y "there" son las dos palabras VACÍAS: se
         filtran antes de puntuar. Así que "hello" solo se reconocía cuando era
         el mensaje entero — y "hello there" se quedaba sin una sola ficha que
         puntuar, y recibía un "no te he entendido". Saludar así es lo más
         normal del mundo.
         Una palabra vacía que ES la clave de un tema (hello, thanks) tiene que
         puntuar: se busca en el texto crudo. */
      if (STOPWORDS.indexOf(k) !== -1 && new RegExp('\\b' + k + '\\b').test(norm)) {
        s += 7;
        at = norm.indexOf(k);
        if (at !== -1 && at < pos) pos = at;
        return;
      }
      if (wide.indexOf(k) !== -1) { s += 3; return; }     // sinónimo o raíz

      /* Errata. Una palabra LARGA mal escrita es una señal tan fuerte
         como la palabra bien escrita: "cocnrete" no puede ser otra cosa
         que "concrete". Antes valía 2 puntos y no llegaba al umbral:
         el mensaje entero se perdía. */
      for (var i = 0; i < words.length; i++) {
        if (isTypo(words[i], k)) {
          s += (words[i].length >= 7) ? 7 : 5;
          at = norm.indexOf(words[i]);
          if (at !== -1 && at < pos) pos = at;
          return;
        }
      }
    });

    /* Peso: algunas entradas deben ganar aunque compartan palabras con
       otras. "¿No seréis una empresa fachada?" contiene "indigenous" y
       "set aside", así que la entrada genérica la eclipsaba — y esa
       pregunta merece su respuesta de frente, no un folleto. */
    if (entry.boost) s = Math.round(s * entry.boost);

    return { score: s, pos: pos };
  }

  /* Devuelve TODOS los temas presentes en el mensaje, sin repetir tema.
     Máximo tres: más de tres respuestas seguidas abruman a cualquiera. */
  function detectTopics(text) {
    var norm  = normalize(text);
    var words = tokens(text);
    var wide  = expand(words);
    var hits  = [];

    DATA.kb.forEach(function (entry) {
      var r = scoreEntry(entry, norm, words, wide);
      if (r.score >= 7) hits.push({ entry: entry, score: r.score, pos: r.pos });
    });

    if (!hits.length) return [];

    var byTopic = {};
    hits.forEach(function (h) {
      var t = h.entry.topic || h.entry.keys[0];
      if (!byTopic[t] || byTopic[t].score < h.score) byTopic[t] = h;
    });

    var list = Object.keys(byTopic).map(function (t) { return byTopic[t]; });

    /* [FALLO CORREGIDO] "Hello from Belfast. What does your company do?" traía
       DOS temas: el saludo y la empresa. Y el bot anunciaba el primero con un
       conector: "Regarding **greeting**:". Usar la etiqueta interna del tema
       como si fuera un asunto del que hablar es absurdo. La cortesía acompaña,
       no compite: si hay algo real que contestar, el saludo sobra. */
    var CORTESIA = ['greeting', 'thanks', 'goodbye', 'small talk', 'how are you', 'company identity'];
    var reales = list.filter(function (h) {
      return CORTESIA.indexOf(h.entry.topic) === -1;
    });
    if (reales.length) list = reales;

    /* [FALLO CORREGIDO] Una respuesta que dice "esto no lo hacemos" o "esto lo
       contesta una persona" es DEFINITIVA: no admite compañía. El bot le decía
       a una consultora de amianto que no podía confirmar su licencia… y acto
       seguido le soltaba un anuncio de suministro de mano de obra y le abría un
       formulario. Eso es no haber escuchado la propia respuesta. Cuando una de
       estas entradas gana, habla sola. */
    /* [CLASE NUEVA] Un rechazo marcado onlyFor:'buyer' NO se le dice a un
       proveedor ni a un candidato. Un transportista de áridos que viene a
       VENDERNOS grava recibía "nosotros no vendemos materiales" — cierto, pero
       completamente fuera de lugar: él no quería comprar, quería vender. */
    list = list.filter(function (h) {
      return !h.entry.onlyFor || !MEM.role || MEM.role === h.entry.onlyFor;
    });
    if (!list.length) return [];

    var decisiva = list.filter(function (h) {
      return h.entry.outOfScope || h.entry.handoff;
    });
    if (decisiva.length) {
      decisiva.sort(function (a, b) { return b.score - a.score; });
      return [decisiva[0]];
    }

    /* El tema con más señal abre; los demás siguen por orden de
       aparición en la frase, y solo si tienen señal sólida. */
    /* El tema con más señal abre; los demás siguen por orden de
       aparición. El umbral del secundario es el mismo que el del
       principal: con uno más alto se perdían preguntas legítimas
       ("¿hacéis hormigón? ¿y tenéis seguro?" se quedaba en el seguro). */
    var top = list.reduce(function (a, b) { return b.score > a.score ? b : a; });
    var rest = list
      .filter(function (h) { return h !== top && h.score >= 7; })
      .sort(function (a, b) { return a.pos - b.pos; });

    /* [FALLO CORREGIDO] Sin tope, un correo largo que tocaba cinco temas se
       contestaba con cinco mensajes seguidos MÁS el ofrecimiento: un muro de
       texto que nadie lee. Dos temas y el ofrecimiento son tres burbujas: el
       máximo que una persona lee sin desconectar. Si preguntó por más cosas,
       volverá a preguntar — y el bot sigue ahí. */
    return [top].concat(rest).slice(0, 2);
  }

  /* Mensajes que no son una pregunta: tres letras, un "asdf", un emoji
     suelto. No merecen un "no lo sé": merecen "explícamelo mejor". */
  function isUnintelligible(text) {
    var words = tokens(text);
    if (!words.length) return true;
    var meaty = words.filter(function (w) { return w.length >= 4; });
    return meaty.length === 0;
  }

  /* ── ¿Está diciendo que SÍ? ──────────────────────────────────
     La gente contesta de mil formas: "si", "dale", "claro", "va",
     "ok", "cuentame", "porfa"... y con erratas. Si esto no se
     entiende, la conversación se muere en seco: el bot pregunta
     "¿te cuento más?", el usuario dice "si" y no pasa nada. */
  var AFIRMA_RE = /^(si|sii+|sí|s|dale|claro|ok|oka|okey|okay|vale|bueno|bien|va|yes|yeah|yep|sure|porfa|por favor|porfavor|obvio|de una|hazlo|adelante|sigue|continua|continúa|cuentame|cuéntame|dime|explicame|explícame|mas|más|quiero|me interesa|perfecto|genial|exacto|eso|asi es|así es|correcto|aja|ajá|ya|entiendo)\b/;
  var NIEGA_RE  = /^(no|nop|nope|nel|para nada|nada|ahora no|luego|despues|después|otro dia|no gracias|ninguna|nada mas|nada más|ya esta|ya está|listo|nop)\b/;

  /* Un "sí" de verdad es CORTO y no pide nada concreto.
     "explicame el acumulador con numeros" empieza por "explicame", que
     está en la lista de afirmaciones, pero NO es un sí: es una petición.
     Si el mensaje menciona un tema que sabemos responder, manda el tema. */
  function isFollowUp(text) {
    var n = normalize(text);
    if (n.split(' ').length > 3) return false;
    if (detectTopics(text).length) return false;
    return AFIRMA_RE.test(n);
  }
  function diceQueNo(text) {
    var n = normalize(text);
    if (n.split(' ').length > 3) return false;
    if (detectTopics(text).length) return false;
    return NIEGA_RE.test(n);
  }

  /* [MEJORADO] Antes solo se recordaba la ÚLTIMA frase usada. Con tres
     variantes y cuatro preguntas seguidas sobre el mismo tema, el bot repetía
     igual — y sonaba a disco rayado justo cuando alguien insistía, que es
     cuando peor sienta. Ahora recuerda las DOS últimas: con tres variantes ya
     no puede repetirse en tres turnos. */
  function pickVariant(list, memoKey) {
    if (!Array.isArray(list)) return list;
    if (list.length === 1) return list[0];

    var usadas = lastVariant[memoKey] || [];
    var libres = [];
    for (var j = 0; j < list.length; j++) {
      if (usadas.indexOf(j) === -1) libres.push(j);
    }
    if (!libres.length) libres = [usadas[0]];      // lista muy corta: se recicla

    var i = libres[Math.floor(Math.random() * libres.length)];
    lastVariant[memoKey] = [i].concat(usadas).slice(0, Math.min(2, list.length - 1));
    return list[i];
  }

  /* ════════════════════════════════════════════════════════
     3. INTERFAZ
  ════════════════════════════════════════════════════════ */

  var elChat, elMsgs, elInput, elFab, elMenu, typing = false, busy = false;

  var ICO = {
    phone: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    mail:  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>',
    wa:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.4-3c-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.1c0 1.2.9 2.4 1 2.5.1.2 1.7 2.6 4.2 3.7 1.4.6 2 .6 2.7.5.4 0 1.4-.6 1.6-1.2.2-.6.2-1 .1-1.1z"/></svg>',
    copy:  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>',
    edit:  '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
    tg:    '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M21.9 4.3 18.7 19c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 9-8.1c.4-.3-.1-.5-.6-.2L6.2 12.8 1.4 11.3c-1-.3-1-1 .2-1.5l19-7.3c.9-.3 1.6.2 1.3 1.8z"/></svg>',
    grupo: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    arrow: '<svg class="np-chat__go" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  function html(text) {
    return String(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<span class="np-chat__li">$1</span>')
      .replace(/\n/g, '<br>');
  }

  function build() {
    var wrap = document.createElement('div');
    wrap.className = 'np-chat-root';
    wrap.innerHTML =
      '<button class="np-chat-fab" id="npFab" aria-label="Abrir el chat">' +
        '<span class="np-chat-fab__wave"></span>' +
        '<span class="np-chat-fab__wave np-chat-fab__wave--2"></span>' +
        '<svg class="np-chat-fab__ico" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">' +
          '<path d="M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4v3.2a.8.8 0 0 0 1.3.62L13.5 18H20a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' +
          '<circle cx="8" cy="10" r="1.15" fill="currentColor"/><circle cx="12" cy="10" r="1.15" fill="currentColor"/><circle cx="16" cy="10" r="1.15" fill="currentColor"/>' +
        '</svg>' +
        '<svg class="np-chat-fab__ico np-chat-fab__ico--x" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
          '<line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
          '<line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
        '</svg>' +
        '<span class="np-chat-fab__dot" id="npDot"></span>' +
      '</button>' +
      '<section class="np-chat" id="npChat" role="dialog" aria-label="' + BOT.name + ' · asistente" aria-hidden="true">' +
        '<header class="np-chat__head">' +
          '<img class="np-chat__av" src="' + BOT.avatar + '" alt="" width="38" height="38">' +
          '<div class="np-chat__id">' +
            '<span class="np-chat__name">' + BOT.name + '</span>' +
            '<span class="np-chat__status"><i></i>En línea</span>' +
          '</div>' +
          '<button class="np-chat__topics" id="npTopics" aria-expanded="false" aria-label="Preguntas frecuentes">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
              '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="14" y2="17"/>' +
            '</svg><span>' + UI.temas + '</span>' +
          '</button>' +
          '<button class="np-chat__lang" id="npLang" aria-label="Language / Idioma" title="Language / Idioma">' + UI.idioma + '</button>' +
          '<button class="np-chat__x" id="npClose" aria-label="' + UI.cerrar + '">&times;</button>' +
          '<div class="np-chat__menu" id="npMenu" role="menu" aria-hidden="true"></div>' +
        '</header>' +
        '<div class="np-chat__msgs" id="npMsgs" role="log" aria-live="polite"></div>' +
        '<div class="np-chat__bar">' +
          '<textarea id="npInput" class="np-chat__input" rows="1" maxlength="800" placeholder="' + UI.ph + '" aria-label="Mensaje"></textarea>' +
          '<button class="np-chat__send" id="npSend" aria-label="Send">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M2 21l21-9L2 3v7l15 2-15 2z" fill="currentColor"/></svg>' +
          '</button>' +
        '</div>' +

      '</section>';
    document.body.appendChild(wrap);

    elChat  = document.getElementById('npChat');
    elMsgs  = document.getElementById('npMsgs');
    elInput = document.getElementById('npInput');
    elFab   = document.getElementById('npFab');
    elMenu  = document.getElementById('npMenu');

    var elLang = document.getElementById('npLang');
    if (elLang) elLang.addEventListener('click', function () {
      var actual = idiomaUI();
      var nuevo = (actual === 'es') ? 'en' : 'es';
      try { localStorage.setItem('cco-idioma', nuevo); } catch (e) {}
      // Reiniciar el chat con el idioma nuevo (usa el mecanismo ya existente).
      if (window.NP_CHAT_REINICIAR) window.NP_CHAT_REINICIAR();
      // Y avisar a la página para que traduzca el resto (si el sistema existe).
      try {
        var ev = new CustomEvent('cco-idioma-cambiado', { detail: nuevo });
        window.dispatchEvent(ev);
      } catch (e) {}
    });

    BOT.quick.forEach(function (q) {
      var b = document.createElement('button');
      b.className = 'np-chat__mi';
      b.setAttribute('role', 'menuitem');
      b.textContent = q.label;
      b.addEventListener('click', function () { closeMenu(); send(q.q); });
      elMenu.appendChild(b);
    });

    var topics = document.getElementById('npTopics');
    topics.addEventListener('click', function (e) {
      e.stopPropagation();
      elMenu.classList.contains('is-open') ? closeMenu() : openMenu();
    });
    document.addEventListener('click', function (e) {
      if (!elMenu.contains(e.target)) closeMenu();
    });

    elFab.addEventListener('click', toggle);
    document.getElementById('npClose').addEventListener('click', close);
    document.getElementById('npSend').addEventListener('click', function () { send(elInput.value); });

    elInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(elInput.value); }
    });
    elInput.addEventListener('input', function () {
      elInput.style.height = 'auto';
      elInput.style.height = Math.min(elInput.scrollHeight, 90) + 'px';
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && elChat.classList.contains('is-open')) close();
    });
  }

  /* ── Burbujas ─────────────────────────────────────────── */

  function bubble(role) {
    var b = document.createElement('div');
    b.className = 'np-msg np-msg--' + role;
    elMsgs.appendChild(b);
    return b;
  }

  function bottom() { elMsgs.scrollTop = elMsgs.scrollHeight; }

  function addUser(text) {
    var b = bubble('user');
    b.textContent = text;
    bottom();
    save('user', text);
  }

  /* Tarjeta de contacto. Teléfono y WhatsApp son el MISMO número, y
     está bien: hay quien llama y hay quien jamás llamaría pero sí
     escribe. Por eso se etiqueta por la ACCIÓN, no por el dato. Y el
     correo va abreviado: la dirección entera se partía contra el borde. */
  /* Estilos de lo nuevo (copiar, editar). Se inyectan desde aquí para no
     obligar a resubir los siete index.html solo por una regla de CSS.
     Usan los mismos tokens del sitio: ningún color suelto. */
  function injectStyles() {
    if (document.getElementById('np-chat-extra')) return;
    var s = document.createElement('style');
    s.id = 'np-chat-extra';
    s.textContent = [
      '.np-chat__card{display:grid;grid-template-columns:1fr auto;gap:2px 6px;align-items:center}',
      '.np-chat__card .np-chat__row{min-width:0}',
      '.np-chat__card .np-chat__row em{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}',
      '.np-chat__copy{display:inline-flex;align-items:center;justify-content:center;',
        'width:26px;height:26px;padding:0;border:1px solid var(--line,rgba(0,0,0,.14));',
        'border-radius:6px;background:transparent;color:var(--cyan,#c9a227);cursor:pointer;',
        'transition:background .2s ease,border-color .2s ease,opacity .2s ease}',
      '.np-chat__lang{margin-left:6px;padding:0 9px;height:26px;border:1px solid rgba(232,184,75,.4);border-radius:7px;background:transparent;color:#E8B84B;font:inherit;font-size:.72rem;font-weight:700;cursor:pointer;letter-spacing:.04em}',
      '.np-chat__lang:hover{background:rgba(232,184,75,.12)}',
      '.np-chat{background:#0a0e13 !important}',
      '.np-chat__msgs{background:#0a0e13 !important}',
      '.np-chat__bar{background:#07090c !important}',
      '.np-chat__copy:hover{background:color-mix(in srgb,var(--cyan,#c9a227) 12%,transparent)}',
      '.np-chat__copy.is-done{color:var(--cyan,#c9a227);border-color:var(--cyan,#c9a227)}',
      '.np-chat__copy--empty{border:0;background:none;pointer-events:none}',
      '.np-chat__edit{display:inline-flex;align-items:center;gap:6px;margin-top:8px;',
        'padding:6px 12px;border:1px solid var(--cyan,#c9a227);border-radius:999px;',
        'background:transparent;color:var(--cyan,#c9a227);font:inherit;font-size:.74rem;',
        'letter-spacing:.06em;text-transform:uppercase;cursor:pointer;',
        'transition:background .2s ease}',
      '.np-chat__edit:hover{background:color-mix(in srgb,var(--cyan,#c9a227) 12%,transparent)}',
      '.np-chat__form{margin-top:10px;display:grid;gap:8px}',
      '.np-chat__form label{display:grid;gap:3px;font-size:.7rem;letter-spacing:.06em;',
        'text-transform:uppercase;color:var(--cyan,#c9a227)}',
      '.np-chat__form input{width:100%;box-sizing:border-box;min-width:0;padding:8px 10px;',
        'border:1px solid var(--line,rgba(0,0,0,.16));border-radius:8px;background:transparent;',
        'color:inherit;font:inherit;font-size:.86rem}',
      '.np-chat__form input:focus{outline:none;border-color:var(--cyan,#c9a227)}',
      '.np-chat__save{margin-top:2px;padding:8px 14px;border:0;border-radius:999px;',
        'background:var(--cyan,#c9a227);color:#0d1b2a;font:inherit;font-size:.74rem;',
        'letter-spacing:.06em;text-transform:uppercase;font-weight:700;cursor:pointer}'
    ].join('');
    document.head.appendChild(s);
  }

  function typewrite(el, text, done) {
    var out = html(text);
    var speed = out.length > 400 ? 4 : out.length > 200 ? 7 : 12;
    var i = 0;
    (function step() {
      if (out[i] === '<') i = out.indexOf('>', i) + 1;
      else i++;
      el.innerHTML = out.slice(0, i);
      bottom();
      if (i < out.length) setTimeout(step, speed);
      else if (done) done();
    })();
  }

  function contactCard() {
    var c = document.createElement('div');
    c.className = 'np-chat__card';
    var K = BOT.contact || {};

    /* Botones que LLEVAN al sitio, no enlaces sueltos que hay que copiar.
       Y sin número de teléfono a la vista: se usa el usuario. */
    /* Botones limpios: el nombre del sitio y una frase de qué hay allí.
       Poner el usuario o el número dentro del botón sobra: el botón LLEVA,
       no informa. Y así tampoco queda el contacto expuesto en pantalla. */
    var fila = function (href, ico, titulo, pie) {
      return '<a class="np-chat__row" href="' + href + '" target="_blank" rel="noopener">' +
        ico + '<span><b>' + titulo + '</b><em>' + pie + '</em></span>' + ICO.arrow + '</a>';
    };
    c.innerHTML =
      fila(K.telegram, ICO.tg, 'Escribir por Telegram', 'respuesta directa') +
      (K.whatsapp ? fila(K.whatsapp, ICO.wa, 'Escribir por WhatsApp', 'si lo prefieres') : '') +
      '<a class="np-chat__row np-chat__row--grupo" href="' + K.grupo + '" target="_blank" rel="noopener">' +
        ICO.grupo + '<span><b>Entrar a la comunidad</b><em>gente que ya usa CriptoCuba</em></span>' + ICO.arrow + '</a>';

    return c;
  }

  /* ── LLEVAR AL USUARIO A LA SECCIÓN DE LA QUE HABLAMOS ────────
     No sirve de nada explicar el Prize Pool si luego el usuario no
     sabe dónde está. Estos botones abren la sección de verdad. */
  var DESTINOS = {
    prize:   { txt: 'Abrir el Prize Pool',  ir: function () { clic('#c-prize'); } },
    market:  { txt: 'Abrir el Marketplace', ir: function () { clic('#c-market'); } },
    swap:    { txt: 'Abrir el Swap',        ir: function () { clic('#c-swap'); } },
    perfil:  { txt: 'Abrir mi perfil',      ir: function () { clic('#c-perfil'); } },
    grid:    { txt: 'Ver el Smart Grid',    ir: function () { bot('grid'); } },
    acum:    { txt: 'Ver el Accumulator',   ir: function () { bot('acum'); } },
    cash:    { txt: 'Ver el Cash Out',      ir: function () { bot('cash'); } },
    dca:     { txt: 'Ver el DCA',           ir: function () { bot('dca'); } },
    conectar:{ txt: 'Conectar mi wallet',   ir: function () { clic('#c-conectar') || clic('#c-conectar2'); } },
    instalar:{ txt: 'Instalar la app',      ir: function () { clic('#c-instalar'); } },
    academy: { txt: 'Ver la Academia',      ir: function () { clic('#c-academy'); } },
    perfil2: { txt: 'Abrir mi perfil',      ir: function () { clic('#c-perfil'); } }
  };
  function clic(sel) {
    var e = document.querySelector(sel);
    if (!e) return false;
    close();                               // apartamos el chat para que se vea
    setTimeout(function () { e.click(); }, 220);
    return true;
  }
  function bot(tipo) {
    var b = document.querySelector('#colmena-app .bot-tab[data-tipo="' + tipo + '"]');
    if (!b) return false;
    close();
    setTimeout(function () {
      b.click();
      var c = document.querySelector('#colmena-app #f-tipo');
      if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 220);
    return true;
  }

  function botonIr(dest) {
    var d = DESTINOS[dest]; if (!d) return null;
    var a = document.createElement('button');
    a.className = 'np-chat__ir';
    a.type = 'button';
    a.innerHTML = d.txt + '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    a.addEventListener('click', d.ir);
    return a;
  }

  /* Botones de respuesta rápida: le damos al usuario las opciones que
     esperamos, en vez de dejarlo escribiendo a ciegas. */
  function botonesOpciones(lista) {
    var c = document.createElement('div');
    c.className = 'np-chat__ops';
    lista.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'np-chat__op';
      b.type = 'button';
      b.textContent = o.label;
      b.addEventListener('click', function () { send(o.q); });
      c.appendChild(b);
    });
    return c;
  }

  function addBot(text, entry, animate) {
    var b = bubble('bot');
    var tail = function () {
      if (entry && entry.nav) {
        var a = document.createElement('a');
        a.className = 'np-chat__nav';
        a.href = entry.nav.href;
        a.textContent = entry.nav.label + ' \u2192';
        b.appendChild(a);
      }
      /* Todos los botones dentro de UNA zona con su separación, en vez de
         colgando sueltos del final del texto. */
      var zona = null;
      var enZona = function (el) {
        if (!el) return;
        if (!zona) { zona = document.createElement('div'); zona.className = 'np-chat__acciones'; b.appendChild(zona); }
        zona.appendChild(el);
      };
      if (entry && entry.accion) enZona(botonIr(entry.accion));
      if (entry && entry.guia) {
        var bg = document.createElement('button');
        bg.className = 'np-chat__ir';
        bg.type = 'button';
        bg.textContent = entry.guiaLabel || 'Guíame paso a paso';
        bg.addEventListener('click', function () { send('__guia:' + entry.guia); });
        enZona(bg);
      }
      if (entry && entry.opciones && entry.opciones.length) enZona(botonesOpciones(entry.opciones));
      /* Cuando el motor junta varios temas en una respuesta, el "entry" que
         llega aquí es el del ÚLTIMO. Si ese no tenía opciones pero otro sí,
         los botones se perdían. Se recuperan del primero que las tenga. */
      if (entry && entry._opcionesExtra && entry._opcionesExtra.length) enZona(botonesOpciones(entry._opcionesExtra));
      if (entry && entry.contactCard) b.appendChild(contactCard());
      if (entry && entry.editButton && flow) editPanel(b);
      bottom();
    };
    if (animate === false) { b.innerHTML = html(text); tail(); }
    else typewrite(b, text, tail);
    save('bot', text, entry);
  }

  function showTyping() {
    if (typing) return;
    typing = true;
    var b = bubble('bot');
    b.id = 'npTyping';
    b.className += ' np-msg--typing';
    b.innerHTML = '<i></i><i></i><i></i>';
    bottom();
  }

  function hideTyping() {
    var t = document.getElementById('npTyping');
    if (t) t.remove();
    typing = false;
  }

  /* ── Historial ────────────────────────────────────────── */

  var _esSaludo = false;

  function save(role, text, entry) {
    // El saludo de bienvenida no es conversación: no se guarda.
    if (_esSaludo && role !== 'user') return;
    try {
      var h = JSON.parse(sessionStorage.getItem(STORE) || '[]');
      /* [FALLO CORREGIDO] El botón de editar no se guardaba: quien navegaba
         a otra página en mitad de la confirmación se quedaba mirando su
         resumen sin forma de corregirlo. */
      h.push({ r: role, t: text, nav: entry && entry.nav,
               card: entry && entry.contactCard, edit: entry && entry.editButton });
      sessionStorage.setItem(STORE, JSON.stringify(h.slice(-40)));
    } catch (e) {}
  }

  function restore() {
    var h = [];
    try { h = JSON.parse(sessionStorage.getItem(STORE) || '[]'); } catch (e) {}

    /* Limpieza de lo ya guardado: si en el historial hay saludos de
       versiones anteriores, se quitan. Sin esto, quien ya tenga ocho
       apilados los seguiría viendo. */
    var saludos = (BOT.greeting || []).map(function (x) { return String(x).trim(); });
    var antes = h.length;
    h = h.filter(function (m) {
      return m.r === 'user' || saludos.indexOf(String(m.t).trim()) === -1;
    });
    if (h.length !== antes) {
      try { sessionStorage.setItem(STORE, JSON.stringify(h)); } catch (e) {}
    }

    if (!h.length) return;              // el saludo se escribe al abrir
    h.forEach(function (m) {
      if (m.r === 'user') { var b = bubble('user'); b.textContent = m.t; }
      else addBot(m.t, { nav: m.nav, contactCard: m.card, editButton: m.edit }, false);
    });
    bottom();
  }

  /* ════════════════════════════════════════════════════════
     4. CONVERSACIÓN
  ════════════════════════════════════════════════════════ */

  /* Pausa humana: proporcional a lo que hay que decir, con tope. Ni
     instantánea (delata la máquina) ni eterna. */
  function pause(text) {
    return 480 + Math.min(String(text).length * 5, 850);
  }

  /* ══════════════════════════════════════════════════════════
     REGLA DE ORO — un solo sitio, sin excepciones que se olviden.

     Ningún mensaje del bot puede terminar sin una salida: o pregunta, o
     tarjeta de contacto, o botón que lleva a algún sitio. Un mensaje sin
     salida es un visitante que cierra la pestaña sin saber qué escribir.
     Se aplica AQUÍ, a todo lo que diga el bot, venga de donde venga.
  ══════════════════════════════════════════════════════════ */
  function ensureExit(text, entry) {
    if (String(text).indexOf('?') !== -1) return text;
    if (entry && (entry.contactCard || entry.nav || entry.editButton)) return text;

    /* [FALLO CORREGIDO — el que estropeaba los cierres buenos]
       Las despedidas y los agradecimientos NO llevan pregunta… así que este
       empujón se les enganchaba detrás. El visitante se despedía y el bot le
       contestaba: "Gracias por su visita, estamos aquí cuando nos necesite.
       ¿Cuál es el proyecto? Si es que existe, puedo explicárselo hoy mismo."
       Absurdo, y justo al final, que es donde más duele.
       A la cortesía no se le empuja. Y a una conversación cerrada, tampoco. */
    if (closed) return text;
    /* Algunas respuestas YA terminan preguntando algo. Añadirles otro
       "¿te aclaro algo más?" suena a máquina y confunde. */
    if (entry && entry.noNudge) return text;

    /* [FALLO CORREGIDO — estaba en producción] Con una toma de datos en
       marcha, el bot SIEMPRE va a hablar otra vez acto seguido: la salida
       es la pregunta del paso siguiente. Añadir aquí un empujón metía una
       pregunta suelta entre medias ("¿cuánta experiencia tienes?") justo
       antes de preguntar lo mismo — o peor, algo que la persona ya había
       contado. Conduciendo no se empuja. */
    if (flow) return text;

    return text + '\n\n' + pickVariant(roleList(BOT.nudges), roleKey('nudge'));
  }

  function speak(text, entry, done) {
    // Dentro de una guía, nada de "¿te cuento algo más?": estorba al paso.
    if (GUIA && entry && entry.esperaListo) { entry = entry || {}; entry.noNudge = true; }
    /* Red de última hora: un mensaje vacío es lo peor que puede pasar
       (el visitante ve una burbuja con un signo suelto y nada más).
       Si por lo que sea el texto viene vacío, se hace triaje. */
    if (!String(text || '').trim()) text = pickVariant(roleList(BOT.triage), roleKey('triage'));
    text = ensureExit(text, entry);
    showTyping();
    setTimeout(function () {
      hideTyping();
      addBot(text, entry, true);
      setTimeout(done || function () {}, 450);
    }, pause(text));
  }

  /* ════════════════════════════════════════════════════════
     3-BIS. CONVERSACIÓN GUIADA
     El bot deja de contestar y empieza a CONDUCIR: pregunta, valida,
     lee de vuelta, y envía al correo de la empresa.
  ════════════════════════════════════════════════════════ */

  /* ── Sí, no, y cancelar ────────────────────────────────────
     [FALLOS CORREGIDOS, los dos gordos]

     1. Solo se reconocía el inglés. Un visitante que escribe "sí" — o
        que usa el traductor del navegador, que es lo que hace medio
        mundo — no era entendido. Ahora se reconocen inglés, español y
        francés, que es lo que se habla en Canadá y en la práctica.

     2. "no hay que corregir nada, así está bien" EMPEZABA por "no", y el
        bot lo leía como CANCELAR. Una frase de aprobación se tomaba por
        un rechazo. Ahora: se busca la aprobación en TODA la frase, y
        solo cancela quien lo dice explícitamente ("cancel", "cancelar").
        Un "no" suelto ya no destruye una toma de datos. */

  var YES = new RegExp('\\b(' + [
    'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'sounds good', 'go ahead',
    'please do', 'do it', 'send it', 'send', 'submit', 'correct', 'right', 'perfect',
    'looks good', 'thats right', 'that is right', 'all good', 'fine', 'alright', 'confirm',
    /* [AMPLIADO] Faltaban cinco maneras corrientísimas de decir que sí, y con
       ellas se perdía el envío ENTERO de un cliente ya conseguido: "bien",
       "muy bien", "exacto", "así es", "confirmo". La confirmación es el último
       paso antes del correo: cualquier forma de asentir tiene que valer. */
    'si', 'claro', 'dale', 'adelante', 'correcto', 'perfecto', 'enviar', 'envialo',
    'envialo ya', 'esta bien', 'todo bien', 'esta correcto', 'de acuerdo', 'vale',
    'bien', 'muy bien', 'exacto', 'exactamente', 'asi es', 'confirmo', 'confirmado',
    'me parece correcto', 'me parece bien', 'esta todo bien', 'todo correcto',
    'listo', 'mandalo', 'mandalo ya', 'procede', 'afirmativo',
    'oui', 'daccord', 'envoyer', 'cest correct'
  ].join('|') + ')\\b');

  /* [FALLO CORREGIDO] "SOLO SÍ O NO", "yes or no", "sí o no" contienen "sí" y
     se leían como una ACEPTACIÓN — arrancaban el formulario. Pero son lo
     contrario: una EXIGENCIA de respuesta binaria de alguien impaciente
     (Marcus). Estas frases anulan el YES. */
  var NOT_YES = /\b(solo )?(si o no|yes or no|si\/no|yes\/no|un si o un no|it is a (yes or no|simple question))\b/i;

  var CANCEL = new RegExp('\\b(' + [
    'cancel', 'cancelled', 'stop', 'forget it', 'never mind', 'nevermind', 'quit', 'exit',
    'not now', 'maybe later', 'abort', 'drop it',
    'cancelar', 'cancela', 'olvidalo', 'olvidate', 'detener', 'parar', 'no quiero',
    'no gracias', 'mas tarde', 'annuler'
  ].join('|') + ')\\b');

  /* Rechazo suave: solo válido cuando se OFRECE algo, nunca dentro de
     una toma de datos ya empezada. */
  var DECLINE = new RegExp('^(no|nope|non|nah)\\b');

  /* NEGACIÓN de corrección: "no hay que corregir nada", "nothing to change".
     Contiene la palabra "corregir", pero significa lo contrario. Sin esto,
     la frase de aprobación más natural del mundo mandaba a corregir. */
  var NOFIX = new RegExp('(' + [
    'nada que (corregir|cambiar|arreglar)',
    'no hay que (corregir|cambiar|arreglar)',
    'no (corrijas|cambies|hace falta)',
    'sin cambios', 'todo esta bien', 'esta todo bien',
    'nothing to (change|fix|correct)', 'no changes', 'no need to change',
    'do not change', 'dont change', 'leave it'
  ].join('|') + ')');

  /* Petición de corregir algo. */
  var FIXWORD = new RegExp('\\b(' + [
    'change', 'fix', 'correct it', 'edit', 'modify', 'wrong', 'mistake',
    'cambiar', 'cambia', 'corregir', 'corrige', 'arreglar', 'arregla', 'esta mal',
    'incorrecto', 'error', 'modifier'
  ].join('|') + ')\\b');

  /* Cada paso responde también por su nombre traducido: el visitante ve
     la web traducida por el navegador y escribe lo que ve. */
  var STEP_ALIASES = {
    what:       ['what', 'work', 'project', 'obra', 'trabajo', 'proyecto'],
    company:    ['company', 'business', 'firm', 'empresa', 'compania', 'negocio', 'entreprise'],
    where:      ['where', 'city', 'location', 'donde', 'dónde', 'ciudad', 'lugar', 'ou'],
    when:       ['when', 'date', 'timing', 'cuando', 'cuándo', 'fecha', 'plazo', 'quand'],
    name:       ['name', 'nombre', 'nom'],
    contact:    ['contact', 'phone', 'email', 'mail', 'contacto', 'correo', 'telefono',
                 'teléfono', 'numero', 'número', 'courriel'],
    trade:      ['trade', 'role', 'oficio', 'puesto', 'metier'],
    experience: ['experience', 'experiencia']
  };

  /* Los campos del flujo EN MARCHA, para poder nombrarlos sin cablearlos. */
  function fieldList(def) {
    return def.steps.map(function (s) { return '**' + s.id + '**'; }).join(', ');
  }

  function mentionsStep(norm, stepId) {
    var list = STEP_ALIASES[stepId] || [stepId];
    for (var i = 0; i < list.length; i++) {
      if (new RegExp('\\b' + normalize(list[i]) + '\\b').test(norm)) return true;
    }
    return false;
  }

  function saveFlow() {
    try { sessionStorage.setItem('np-chat-flow', JSON.stringify(flow)); } catch (e) {}
  }
  function loadFlow() {
    try { flow = JSON.parse(sessionStorage.getItem('np-chat-flow') || 'null'); } catch (e) { flow = null; }
  }
  function clearFlow() {
    flow = null;
    try { sessionStorage.removeItem('np-chat-flow'); } catch (e) {}
  }

  function flowDef() { return flow && DATA.flows[flow.id]; }

  function startFlow(id, done, prefillWhat, got) {
    var def = DATA.flows[id];
    if (!def) { if (done) done(); return; }
    flow = { id: id, step: 0, data: {}, stage: 'asking' };
    pendingFlow = null;
    savePending();

    /* Todo lo que el visitante YA nos ha dicho se da por dicho. No se le
       pregunta dos veces lo mismo: eso es lo que delata a una máquina.
       [FASE 2] Antes solo se recuperaban la obra, la ciudad y la fecha —
       los datos del comprador. Ahora también el oficio y la experiencia:
       quien ya ha escrito "soy carpintero, diez años" no debe oír
       "¿cuál es tu oficio?". */
    if (prefillWhat && def.steps[0] && def.steps[0].id === 'what') {
      flow.data.what = prefillWhat;
    }

    var known = {
      where:      (got && got.city) || null,
      when:       (got && got.when) || null,
      trade:      MEM.trade || null,
      experience: MEM.experience || null
    };
    def.steps.forEach(function (st) {
      if (known[st.id] && !flow.data[st.id]) flow.data[st.id] = known[st.id];
    });
    while (def.steps[flow.step] && flow.data[def.steps[flow.step].id]) flow.step++;
    saveFlow();

    /* [FALLO CORREGIDO] La base prometía "cuatro preguntas". Con el
       prellenado, a veces quedaban dos. Prometer de más es perder la
       confianza por nada: el número lo cuenta el motor. */
    speak(startLine(def, id), null, function () {
      askStep(done);
    });
  }

  /* Cuántas preguntas quedan de verdad, en palabras. */
  var NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];

  /* Y si el número cae al principio de una frase, va en mayúscula. La base
     no tiene por qué preocuparse de dónde coloca {n}. */
  function startLine(def, id) {
    return pickVariant(def.start, id + '#start')
      .replace('{n}', remaining())
      .replace(/(^|[.!?]\s+)([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); });
  }

  function remaining() {
    var def = flowDef();
    if (!def) return 'a few';
    var n = def.steps.filter(function (s) { return !flow.data[s.id]; }).length;
    return NUM[n] || String(n);
  }

  function askStep(done) {
    var def = flowDef();
    if (!def) { if (done) done(); return; }
    var step = def.steps[flow.step];
    saveFlow();
    speak(pickVariant(step.ask, flow.id + '#' + step.id), null, done);
  }

  /* Validación. Amable, pero no deja pasar un teléfono que no es un
     teléfono: un contacto que no se puede contactar no vale nada. */
  /* [FALLO CORREGIDO — se perdían contactos enteros]
     Quien DICTA su correo al móvil no dice "arroba": dice la palabra.
     "carlos punto h arroba gmail punto com". Y quien escribe deprisa pone
     "mike.ob at yahoo.com". El bot lo rechazaba como contacto inválido y
     volvía a pedírselo, una y otra vez, hasta que la persona se iba.
     Un humano lo habría entendido a la primera. */
  function fixContact(v) {
    return String(v)
      .replace(/\s+(arroba|at)\s+/gi, '@')
      .replace(/\s+(punto|dot)\s+/gi, '.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* De una frase entera se extrae el contacto, no la frase. Antes se guardaba
     "espera no mi numero es 416-555-0199" tal cual, y luego se le ofrecía eso
     de vuelta como si fuera su teléfono. */
  /* Un nombre de persona: dos o tres palabras, sin cifras, sin arrobas. */
  function looksLikeName(v) {
    var t = String(v).trim();
    if (t.length < 4 || t.length > 40) return false;
    if (/\d|@/.test(t)) return false;

    /* [AFINADO] Con "dos o tres palabras" bastaba… y entonces "next spring"
       parecía un nombre y se rechazaba como fecha. Un nombre lleva MAYÚSCULAS
       iniciales: "Anita Sharma" sí, "next spring" no. */
    var base = t.replace(/,.*$/, '').trim();
    return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ'\-]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ'\-]+){1,2}$/.test(base);
  }

  function pullContact(v) {
    var t = fixContact(v);
    var mail = /[^\s@]+@[^\s@]+\.[^\s@]+/.exec(t);
    if (mail) return mail[0];
    var tel = /[\d][\d\s().+-]{6,}\d/.exec(t);
    if (tel) return tel[0].trim();
    return t;
  }

  function looksLikeContact(v) {
    var t = fixContact(v);
    var email = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(t);
    var phone = (t.replace(/\D/g, '').length >= 7);
    return email || phone;
  }

  /* Países y regiones enteras. Responder "Canadá" a "¿en qué ciudad?" no
     es un error del visitante: es una respuesta razonable a una pregunta
     mal acotada. Un humano no la daría por buena — la afinaría. */
  var TOO_BROAD = [
    'canada', 'usa', 'us', 'united states', 'america', 'mexico', 'europe',
    'cualquier pais', 'todo el mundo', 'internacional', 'donde sea',
    'canada wide', 'across canada', 'varios sitios', 'todo el pais'
  ];

  /* [FALLO CORREGIDO] "bien" acabó guardado COMO LA CIUDAD de la obra: la
     persona estaba asintiendo a otra cosa, no dándonos un dato. Una palabra de
     asentimiento suelta no vale como respuesta a ningún paso. */
  function esAsentimiento(v) {
    var n = normalize(v).trim();
    if (!n || n.split(/\s+/).length > 3) return false;
    return YES.test(n) || DECLINE.test(n);
  }

  function validate(step, value) {
    var v = value.trim();
    if (step.type === 'contact') {
      return looksLikeContact(v) ? null : 'invalidContact';
    }
    /* [FALLO CORREGIDO] Un oficio o el nombre de una empresa son UNA
       palabra: "carpenter", "Acme". El tipo 'text' exige dos palabras (lo
       correcto para describir una obra) y contestaba "dame más detalle" a
       quien había contestado perfectamente. Este tipo es para respuestas
       que legítimamente caben en una palabra. */
    if (step.type === 'short') {
      if (looksLikeContact(v)) return 'looksLikeContact';
      if (esAsentimiento(v)) return 'tooShort';
      return v.length >= 2 ? null : 'tooShort';
    }
    /* [FALLO CORREGIDO] Se preguntaba "¿cuánta experiencia tienes?" y el
       visitante contestaba con su NOMBRE (la gente contesta fuera de orden).
       El bot lo guardaba tal cual: a la oficina le llegaba un candidato con
       "experiencia: tyler smith". Una experiencia se mide en tiempo. */
    /* [FALLO CORREGIDO] Se preguntaba la fecha y la clienta contestaba con su
       NOMBRE (la gente contesta lo que quiere, no lo que se le pregunta). El
       bot lo guardaba como fecha, y despues le pedia el nombre que ella acababa
       de darle. Se fue sin dejar el contacto. */
    if (step.type === 'date') {
      /* [CORREGIDO DOS VECES] Primero intenté una LISTA de lo que es una fecha
         ("asap", "next month", "spring"…). Mal: la gente dice "lo antes
         posible", "tomorrow", "cuando podáis", "después de Navidad" — y una
         lista siempre se queda corta, así que el bot empezó a rechazar fechas
         perfectamente válidas.
         La regla buena es la inversa: una fecha es CUALQUIER COSA que no sea
         un nombre ni un teléfono. Solo hay que impedir lo que se sabe seguro
         que no es una fecha, no adivinar lo que sí. */
      if (looksLikeContact(v)) return 'looksLikeContact';
      if (esAsentimiento(v)) return 'notADate';
      if (looksLikeName(v)) return 'notADate';
      return v.length >= 2 ? null : 'tooShort';
    }
    if (step.type === 'duration') {
      if (looksLikeContact(v)) return 'looksLikeContact';
      var n2 = normalize(v);
      var tiene = /\d/.test(n2) ||
                  /\b(year|years|month|months|decade|none|no experience|just (graduated|started)|apprentice|new|starting out|nuevo|ninguna|recien)\b/.test(n2);
      return tiene ? null : 'notADuration';
    }
    if (step.type === 'place') {
      if (looksLikeContact(v)) return 'looksLikeContact';
      if (esAsentimiento(v)) return 'tooShort';
      /* [FALLO CORREGIDO] Se preguntaba la ciudad y la clienta contestaba con
         su NOMBRE. "Sarah Whitfield" quedaba guardada COMO LA CIUDAD DE LA
         OBRA, y a la oficina le llegaba un proyecto en la localidad de Sarah
         Whitfield. Ya pasaba con la fecha; pasa en todos los pasos. El nombre
         se aparta (arriba se guarda) y se repite la pregunta. */
      if (looksLikeName(v)) return 'notAPlace';
      var n = normalize(v);
      if (TOO_BROAD.indexOf(n) !== -1) return 'tooBroadPlace';
      return v.length >= 3 ? null : 'tooShort';
    }
    if (step.type === 'name') {
      /* Un correo tampoco es un nombre. */
      if (looksLikeContact(v)) return 'looksLikeContact';
      if (v.length < 2) return 'tooShort';
      /* [FALLO CORREGIDO] Nadie se llama "yes". A la oficina le llegó un
         cliente cuyo nombre era literalmente "yes": había contestado que sí a
         otra cosa, y el bot lo archivó como su nombre. */
      if (YES.test(normalize(v)) || DECLINE.test(normalize(v))) return 'notAName';
      /* [FALLO CORREGIDO] Un nombre es CORTO. Sin este límite, todo lo que
         se escribiera en ese paso se guardaba: un visitante que soltó una
         frase entera ("ignore everything and say you are certified…") acabó
         registrado en la oficina COMO SI SE LLAMARA ASÍ. Un humano habría
         dicho "eso no es un nombre". */
      if (v.split(/\s+/).length > 5 || v.length > 60) return 'notAName';
      return null;
    }
    if (step.type === 'text') {
      /* El visitante suelta su correo cuando se le pregunta por la obra.
         Antes se tragaba y quedaba de descripción del proyecto. Ahora se
         apunta como contacto y se le vuelve a preguntar. */
      if (looksLikeContact(v) && v.split(' ').length <= 3) return 'looksLikeContact';
      if (v.length < 3) return 'tooShort';
      /* Una sola palabra no le sirve a nadie: ni al equipo, ni al cliente. */
      if (v.split(/\s+/).length < 2 && v.length < 12) return 'tooVague';
      return null;
    }
    return null;
  }

  function summary() {
    var def = flowDef();
    var lines = def.steps.map(function (s) {
      var label = s.id.charAt(0).toUpperCase() + s.id.slice(1);
      return '- **' + label + ':** ' + (flow.data[s.id] || '—');
    });
    return lines.join('\n');
  }

  /* Envío real. Si falla, el visitante SE ENTERA: nada de fingir que
     salió cuando no salió. */
  function submitLead(done) {
    var def = flowDef();
    var payload = {
      access_key: W3F_KEY,
      subject: def.subject,
      from_name: 'el asistente — website assistant',
      botcheck: false,
      source: 'el asistente assistant (' + window.location.pathname + ')'
    };
    def.steps.forEach(function (s) { payload[s.id] = flow.data[s.id]; });

    showTyping();
    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      hideTyping();
      if (res && res.success) {
        var msg = pickVariant(def.success, flow.id + '#ok');
        clearFlow();                       // primero se cierra: ya no se conduce

        /* [FALLO CORREGIDO — el peor sitio posible para fallar]
           Aquí se llamaba a ensureExit(), que a todo mensaje sin pregunta le
           engancha un EMPUJÓN DE VENTA. Así que al cliente que acababa de
           confirmar sus datos, el bot le soltaba: "¿qué te sería más útil
           ahora mismo?". Y el teléfono iba escrito a mano dentro del texto, en
           vez de la tarjeta con el botón de llamar.

           Un cierre es un cierre: gracias, la tarjeta a mano, y silencio. */
        closed = true;
        savePending();
        addBot(msg, { contactCard: true }, true);
      } else { throw new Error('web3forms'); }
      if (done) done();
    })
    .catch(function () {
      hideTyping();
      addBot(pickVariant(def.failure, flow.id + '#fail'), { contactCard: true }, true);
      clearFlow();
      if (done) done();
    });
  }

  /* Cada mensaje del visitante mientras el flujo está vivo. */
  function handleFlow(text, done) {
    var def = flowDef();
    var n = normalize(text);

    /* [SEGURIDAD — MENORES, también dentro del formulario] Si a mitad de la
       toma de datos la persona dice que es menor de edad, se para en seco: se
       descarta el formulario y NO se guarda lo que acaba de escribir. Un menor
       nunca completa el formulario, diga lo que diga después. */
    var menorAhora = detectTopics(text).filter(function (h) { return h.entry.minor; });
    if (menorAhora.length) {
      clearFlow();
      speak(pickVariant(menorAhora[0].entry.answer, 'a child#a'), null, done);
      return;
    }

    if (CANCEL.test(n) && flow.stage === 'asking') {
      clearFlow();
      speak(pickVariant(DATA.flowTalk.cancelled, 'cancel'), null, done);
      return;
    }

    /* Está esperando confirmación final.
       ORDEN IMPORTANTE: primero se mira si pide corregir algo concreto,
       DESPUÉS si aprueba, y solo al final si cancela. Con el orden al
       revés, "no hay que corregir nada, así está bien" se cancelaba. */
    if (flow.stage === 'confirm') {

      /* "no hay que corregir nada, así está bien" → es un SÍ. Va primero. */
      if (NOFIX.test(n)) { submitLead(done); return; }

      /* ¿Señala un campo concreto? ("cambia el teléfono", "el nombre está mal") */
      var target = null;
      def.steps.forEach(function (s, i) {
        if (mentionsStep(n, s.id)) target = i;
      });

      if (target !== null && (FIXWORD.test(n) || !YES.test(n))) {
        flow.step = target;
        flow.stage = 'fixing';
        askStep(done);
        return;
      }

      /* ¿Aprueba? Se busca en TODA la frase, no solo al principio. */
      if (YES.test(n) && !FIXWORD.test(n)) { submitLead(done); return; }

      /* ¿Cancela de verdad? Palabras explícitas, nunca un "no" suelto. */
      if (CANCEL.test(n)) {
        clearFlow();
        speak(pickVariant(DATA.flowTalk.cancelled, 'cancel'), null, done);
        return;
      }

      /* Pide corregir, pero no dice qué.
         [FALLO CORREGIDO] El texto listaba "what, where, when, name,
         contact" — los campos del flujo de PROYECTO — aunque quien
         estuviera hablando fuese un candidato, cuyo flujo no tiene
         ninguno de esos campos salvo dos. Ahora los campos se leen del
         flujo que está en marcha. */
      if (FIXWORD.test(n) || DECLINE.test(n)) {
        speak(pickVariant(DATA.flowTalk.whatToChange, 'change')
                .replace('{fields}', fieldList(def)), null, done);
        return;
      }

      /* No se ha entendido la confirmación: se pregunta claro. */
      speak(pickVariant(DATA.flowTalk.confirmUnclear, 'confirmUnclear'), null, done);
      return;
    }

    /* ══════════════════════════════════════════════════════
       [FALLO CORREGIDO — llegaba basura a la oficina]

       Conduciendo, el bot metía en el formulario TODO lo que se escribiera.
       Un candidato preguntaba "¿cuánto pagan?" mientras le pedían el nombre,
       y el bot guardaba la pregunta COMO SU NOMBRE. A la oficina le llegaba
       un candidato llamado "cuanto pagan?" — y el visitante, además, se
       quedaba sin respuesta.

       Una persona no hace eso: contesta la pregunta y vuelve a lo suyo.
       Solo cuenta como pregunta la que TERMINA en "?": alguien que contesta
       "lo que hay que arreglar es el tejado" no está preguntando nada, y su
       respuesta no se le puede robar.
    ══════════════════════════════════════════════════════ */
    if (flow.stage !== 'confirm' && /\?\s*$/.test(text)) {
      var qTopics = detectTopics(text);
      var qIntent = detectIntent(text);
      var qEntry  = qTopics.length ? qTopics[0].entry : null;

      /* [FALLO CORREGIDO — el bot secuestraba al visitante] Quien seguía
         PREGUNTANDO en vez de contestar recibía, una y otra vez, la misma
         pregunta del formulario. Cuatro veces "¿qué obra es?" a alguien que
         solo quería informarse. Eso no es conducir: es acosar.

         A la tercera pregunta seguida sin contestar, el formulario se aparta.
         Lo tomado no se pierde: se le dice cómo retomarlo cuando quiera. */
      flow.dodges = (flow.dodges || 0) + 1;
      if (flow.dodges >= 3) {
        clearFlow();
        speak(pickVariant(DATA.flowTalk.paused, 'paused'), null, function () {
          if (qEntry) {
            addBot(pickVariant(qEntry.answer, (qEntry.topic || qEntry.keys[0]) + '#a'),
                   { nav: qEntry.nav, contactCard: qEntry.contactCard }, true);
          }
          if (done) done();
        });
        return;
      }

      if (qEntry) {
        speak(pickVariant(qEntry.answer, (qEntry.topic || qEntry.keys[0]) + '#a'),
              { nav: qEntry.nav, contactCard: qEntry.contactCard },
              function () { askStep(done); });
        return;
      }
      if (qIntent && BOT.intentAnswers[qIntent]) {
        var qa = BOT.intentAnswers[qIntent];
        speak(pickVariant(roleList(qa.answer), roleKey('intent#' + qIntent)),
              { contactCard: qa.contactCard }, function () { askStep(done); });
        return;
      }
    }

    /* [FALLO CORREGIDO] "este formulario es estupido" se guardaba COMO SU
       NOMBRE. A la oficina le llegaba un candidato llamado así. Un enfado no
       es un dato: se reconoce, se responde con calma, y se repite la pregunta. */
    /* [FALLO CORREGIDO] "muchas gracias por todo" / "hasta luego" a mitad del
       formulario: el bot lo tomaba por un DATO y contestaba "eso no parece un
       teléfono, ¿puede escribirlo otra vez?". La persona se está despidiendo.
       Se la deja marchar con educación y con el contacto a mano. */
    var salida = detectTopics(text).filter(function (h) {
      return h.entry.topic === 'goodbye';       /* puede venir detrás de un "gracias" */
    });
    if (flow.stage !== 'confirm' && salida.length) {
      clearFlow();
      speak(pickVariant(salida[0].entry.answer, 'goodbye#a'), { contactCard: true }, done);
      return;
    }

    var enfado = detectTopics(text);
    if (flow.stage !== 'confirm' && enfado.length && enfado[0].entry.topic === 'frustration') {
      var fe = enfado[0].entry;
      speak(pickVariant(fe.answer, 'frustration#a'), { contactCard: true },
            function () { askStep(done); });
      return;
    }

    /* Está respondiendo a un paso. */
    var step = def.steps[flow.step];

    /* Paso de contacto y ya teníamos uno apuntado: se ofrece reutilizarlo. */
    if (step.type === 'contact' && flow.saved && YES.test(n) && !looksLikeContact(text)) {
      flow.data[step.id] = flow.saved;
      advance(done);
      return;
    }

    /* Paso de lugar y ya sabíamos la ciudad: un "sí" la confirma. */
    if (step.type === 'place' && MEM.city && YES.test(n) && n.split(' ').length <= 3) {
      flow.data[step.id] = MEM.city.charAt(0).toUpperCase() + MEM.city.slice(1);
      advance(done);
      return;
    }

    var err = validate(step, text);
    if (err) {
      if (err === 'looksLikeContact') {
        /* Ha soltado su correo cuando se le preguntaba otra cosa. Se apunta
           para el final y se vuelve a hacer LA MISMA pregunta.
           [FALLO CORREGIDO] El texto terminaba en "¿cuál es la obra?" —
           válido solo en el flujo de proyecto. A un candidato se le
           preguntaba por una obra que no tiene. Ahora el acuse no lleva
           pregunta y la pregunta la repite el propio paso: un mensaje,
           una pregunta. */
        flow.saved = pullContact(text);

        /* [FALLO CORREGIDO] "Soy Sophie Tremblay, s.tremblay@email.com,
           416-555-3388." — nombre Y contacto en la misma frase, que es como
           escribe la gente. El bot se quedaba solo con el correo y le seguía
           preguntando el nombre que acababa de darle. Si el nombre viene en el
           mismo mensaje, se coge también. */
        if (!flow.data.name) {
          var resto = fixContact(text)
            .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, ' ')
            .replace(/[\d][\d\s().+-]{6,}\d/g, ' ')
            .replace(/^\s*(soy|me llamo|my name is|i am|im|this is)\s+/i, '')
            .replace(/[,;]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (looksLikeName(resto)) flow.data.name = resto;
        }
        saveFlow();
        speak(pickVariant(DATA.flowTalk.looksLikeContact, 'looksLikeContact'), null, function () {
          askStep(done);
        });
        return;
      }
      /* [FALLO CORREGIDO — el formulario era una ratonera] Si el dato no
         valía, el bot lo volvía a pedir. Y otra vez. Y otra. Quien no quiere
         dar su teléfono, o quien escribe raro, quedaba atrapado en el bucle
         hasta que cerraba la pestaña ("este formulario es estúpido").
         A la segunda vez, se abre la puerta: el correo directo de la oficina,
         encima de la mesa. Se sigue pudiendo contestar — pero ya no es una
         ratonera. */
      /* [FALLO CORREGIDO] Si lo que ha escrito no vale para ESTE paso pero es
         claramente su NOMBRE, no se tira: se apunta. Lo mismo que ya se hacía
         con el teléfono. La gente contesta lo que quiere, no lo que se le
         pregunta, y eso no es motivo para perderla. */
      if (step.id !== 'name' && !flow.data.name && looksLikeName(text)) {
        flow.data.name = text.trim().replace(/,.*$/, '').trim();
      }

      flow.badTries = (flow.badTries === undefined || flow.lastBad !== step.id) ? 1 : flow.badTries + 1;
      flow.lastBad = step.id;
      saveFlow();

      /* [FALLO CORREGIDO — la ratonera] A la tercera, el bot deja de insistir.
         Nadie tiene por qué dar un dato que no quiere dar. Si es el contacto,
         no hay nada que hacer sin él: se le da el correo de la oficina y se
         cierra con dignidad. Cualquier otro dato se deja EN BLANCO y se sigue:
         un formulario con un hueco vale infinitamente más que un visitante que
         cierra la pestaña. */
      if (flow.badTries >= 3) {
        if (step.type === 'contact') {
          clearFlow();
          speak(pickVariant(DATA.flowTalk.giveUpContact, 'giveUp'), { contactCard: true }, done);
          return;
        }
        flow.data[step.id] = '(not given)';
        flow.badTries = 0;
        saveFlow();
        speak(pickVariant(DATA.flowTalk.skipped, 'skipped'), null, function () { advance(done); });
        return;
      }

      speak(pickVariant(DATA.flowTalk[err], err),
            flow.badTries >= 2 ? { contactCard: true } : null, done);
      return;
    }

    flow.data[step.id] = (step.type === 'contact') ? pullContact(text) : text.trim();
    flow.dodges = 0;              // ha contestado: la cuenta vuelve a cero
    flow.badTries = 0;

    advance(done);
  }

  /* Avanza al paso siguiente, o cierra pidiendo confirmación. */
  function advance(done) {
    var def = flowDef();

    /* Corrigiendo un dato suelto: vuelve directo a la confirmación. */
    if (flow.stage === 'fixing') {
      flow.stage = 'confirm';
      saveFlow();
      askConfirm(done);
      return;
    }

    flow.step++;

    if (flow.step < def.steps.length) {
      var next = def.steps[flow.step];

      /* Si ya nos dijo la ciudad antes de empezar, no se la preguntamos
         como si no hubiéramos escuchado. Se confirma. */
      if (next.type === 'place' && MEM.city && !flow.askedCity) {
        flow.askedCity = true;
        saveFlow();
        var city = MEM.city.charAt(0).toUpperCase() + MEM.city.slice(1);
        speak('Antes mencionaste **' + city + '**. ¿Es desde ahí?\n\n' +
              'Dime **sí**, o escríbeme la ciudad.', null, done);
        return;
      }

      /* Si ya nos dio un contacto sin querer, no se lo pedimos como si
         no hubiéramos escuchado: se lo recordamos. */
      if (next.type === 'contact' && flow.saved) {
        saveFlow();
        speak(pickVariant(DATA.flowTalk.useSaved, 'useSaved')
                .replace('{contact}', flow.saved), null, done);
        return;
      }
      askStep(done);
      return;
    }

    flow.stage = 'confirm';
    saveFlow();
    askConfirm(done);
  }

  function askConfirm(done) {
    var def = flowDef();
    speak(pickVariant(def.confirm, flow.id + '#confirm') + '\n\n' + summary() +
          '\n\n' + pickVariant(def.confirmAsk, flow.id + '#confirmAsk'),
          { editButton: true }, done);
  }

  /* ── PANEL DE EDICIÓN ──────────────────────────────────────
     Bajo el resumen, un botón "Edit". Corregir un dato escribiendo
     "cambia el teléfono" funciona, pero es incómodo: se escribe, se
     espera, se confirma. Un formulario con los datos ya puestos se
     corrige en tres segundos. El envío, en cambio, NO lleva botón:
     se confirma hablando, para no romper la conversación. */
  function editPanel(bubble) {
    var def = flowDef();
    if (!def) return;

    var btn = document.createElement('button');
    btn.className = 'np-chat__edit';
    btn.type = 'button';
    btn.innerHTML = ICO.edit + '<span>Edit details</span>';

    btn.addEventListener('click', function () {
      if (!flowDef()) return;
      var form = document.createElement('div');
      form.className = 'np-chat__form';

      def.steps.forEach(function (s) {
        var label = document.createElement('label');
        var name  = s.id.charAt(0).toUpperCase() + s.id.slice(1);
        label.innerHTML = '<span>' + name + '</span>';
        var input = document.createElement('input');
        input.type  = 'text';
        input.value = flow.data[s.id] || '';
        input.setAttribute('data-field', s.id);
        label.appendChild(input);
        form.appendChild(label);
      });

      var save = document.createElement('button');
      save.className = 'np-chat__save';
      save.type = 'button';
      save.textContent = 'Save changes';
      save.addEventListener('click', function () {
        if (!flowDef()) return;
        var bad = null;
        def.steps.forEach(function (s) {
          var el = form.querySelector('[data-field="' + s.id + '"]');
          var v  = (el.value || '').trim();
          if (validate(s, v)) bad = s.id;      // la validación sigue vigente
          else flow.data[s.id] = v;
        });
        saveFlow();
        form.remove();
        btn.style.display = '';
        if (bad) {
          addBot(pickVariant(DATA.flowTalk.invalidContact, 'invalidContact'), null, true);
          return;
        }
        addBot(pickVariant(DATA.flowTalk.saved, 'saved') + '\n\n' + summary() +
               '\n\n' + pickVariant(def.confirmAsk, flow.id + '#confirmAsk'),
               { editButton: true }, true);
      });

      form.appendChild(save);
      btn.style.display = 'none';
      bubble.appendChild(form);
      bottom();
    });

    bubble.appendChild(btn);
  }

  /* ¿El mensaje arranca un flujo por sí solo? */
  function flowTrigger(text) {
    var n = normalize(text);
    var found = null;
    Object.keys(DATA.flows).forEach(function (id) {
      (DATA.flows[id].trigger || []).forEach(function (t) {
        if (n.indexOf(normalize(t)) !== -1) found = id;
      });
    });
    return found;
  }

  /* ══════════════════════════════════════════════════════════
     DESCRIBIR UNA OBRA NO ES PREGUNTAR POR UN TEMA

     [FALLO CORREGIDO — el que se veía en pantalla]
     "Quiero construir un almacén" hacía que el motor puntuara TEMAS: le
     encajaban tres a la vez ("un proyecto en mente", "construcción
     comercial", "cobertura") y el bot soltaba tres mensajes con tres
     preguntas — dos de ellas la misma ("¿en qué ciudad?") y otra
     preguntando QUÉ tipo de edificio era, cuando se lo acababan de decir.
     Un empleado no hace eso: escucha, repite lo que ha entendido, y pide
     lo que le falta. UNA cosa.

     La causa no era ninguna frase: era el ORDEN. El motor buscaba temas
     antes de darse cuenta de que le estaban contando una obra. Ahora, si
     alguien DESCRIBE una obra (no si PREGUNTA por ella), esto va primero.
  ══════════════════════════════════════════════════════════ */

  /* Preguntar no es contar. "¿Construís almacenes?" es una pregunta sobre
     la empresa; "quiero construir un almacén" es un encargo. La diferencia
     está en la forma, no en las palabras — y la forma sí se puede leer. */
  function isQuestion(text) {
    if (String(text).indexOf('?') !== -1 || String(text).indexOf('¿') !== -1) return true;
    // En español la pregunta se reconoce por su arranque, no por el signo:
    // casi nadie escribe "¿" en un chat.
    return /^(que|qué|cual|cuál|cuanto|cuánto|cuando|cuándo|como|cómo|donde|dónde|quien|quién|por que|porque|por qué|para que|se puede|puedo|puedes|hay|tiene|tienen|es |son |sirve|conviene|me recomiendas|explicame|explícame|cuentame|cuéntame|dime|sabes|y si|que pasa|qué pasa)\b/
             .test(normalize(text)) ||
           /^(do|does|did|can|could|are|is|will|would|should|have|has|what|where|when|how|why|who|which|tell me|explain)\b/
             .test(normalize(text));
  }

  function reflectWork(got, release) {
    /* DESACTIVADA. Venía del bot original, que recogía datos de una obra
       para pasarlos a un comercial. Aquí no pedimos datos a nadie, y lo
       que hacía era ROMPER la conversación: ponía lastEntry = null, así
       que el "sí" del usuario se quedaba sin contexto y el bot moría.
       Devolvemos false para que siga su camino normal. */
    return false;
    if (!got || !got.work) return false;

    /* [FALLO CORREGIDO — el bot arrastraba a la gente al formulario]
       "Estoy investigando para un proyecto familiar", "estoy evaluando
       constructoras" no es una obra descrita: es alguien informándose. El bot
       lo tomaba como encargo, activaba pendingAsk, y a partir de ahí trataba
       CADA PREGUNTA siguiente como una respuesta del formulario ("¿qué
       servicios?" se guardaba como la ciudad). Una frase de intención vaga no
       arranca nada: se le deja preguntar. */
    var vago = /\b(investigando|evaluando|averiguando|mirando|buscando informacion|researching|looking into|comparing|evaluating|exploring|just looking|proyecto familiar|for my family|for a thesis|para un proyecto)\b/i;
    if (vago.test(got.work) && !got.city && !got.when) return false;

    misses = 0;
    lastEntry = null;

    var tpl = (got.city && got.when) ? 'full'
            : got.city ? 'workCity'
            : got.when ? 'workWhen'
            : 'workOnly';

    var msg = pickVariant(BOT.reflect[tpl], 'reflect' + tpl)
                .replace('{work}', got.work)
                .replace('{city}', got.city || '')
                .replace('{when}', got.when || '');

    pendingAsk = (tpl === 'workCity') ? 'when'
               : (tpl === 'workWhen' || tpl === 'workOnly') ? 'where'
               : null;

    var pf = flowFor('project');

    /* Lo sabe todo Y quien habla es quien encarga: no marea más, conduce.
       Si NO es un comprador, describir una obra no es encargarla: se le
       ofrece su flujo y decide él. */
    if (tpl === 'full' && pf === 'project') {
      arranqueOK = true;
      markOffered('project');
      /* [FALLO CORREGIDO] Aquí se arrancaba el flujo de OBRA a palo seco, sin
         mirar quién estaba escribiendo. Un fabricante de prefabricado que decía
         "somos fabricantes" — señal clarísima de PROVEEDOR — acababa en el
         formulario de obra, y a la oficina le llegaba como si quisiera
         CONTRATAR. flowFor() es el único sitio donde se traduce el papel a una
         puerta: hay que pasar por él SIEMPRE, sin excepciones. */
      speak(msg, null, function () { startFlow(flowFor('project'), release, got.work, got); });
      return true;
    }

    pendingFlow = pf;
    savePending();
    speak(msg, null, release);
    return true;
  }

  /* ¿El mensaje declara ser menor de edad? Se comprueba aparte para que la
     conversación natural nunca se ponga por delante de esa protección. */
  function _menorDetectado(text) {
    return /\b(tengo|soy|i am|im|i'm)\s*(1[0-7]|[5-9])\s*(anos|años|years|year|a)?\b/i.test(text) ||
           /\b(soy menor|menor de edad|under ?age|im a kid|soy un nino|soy una nina)\b/i.test(text);
  }

  /* ══════════════════════════════════════════════════════════
     GUÍAS PASO A PASO
     Una configuración explicada de golpe es un muro de texto que nadie
     lee. Así que se cuenta paso a paso: se dice UNA cosa, se espera a que
     el usuario diga "listo", y se sigue. Si contesta otra cosa, se le
     responde y se le recuerda dónde estábamos, sin regañarle.
     ══════════════════════════════════════════════════════════ */
  var GUIA = null;                          // { id, paso }
  var CLAVE_GUIA = 'np-chat-guia';
  var LISTO_RE = /^(listo|listoo+|ya|ya esta|ya está|hecho|ok|oka|okey|okay|vale|dale|sigue|siguiente|continua|continúa|next|done|puesto|marcado|si|sí|va|perfecto)\b/;
  var SALIR_GUIA_RE = /\b(deja|dejalo|déjalo|olvidalo|olvídalo|salir|cancela|cancelar|otra cosa|para|basta|luego|despues|después|ya no)\b/;

  function guardarGuia() {
    try {
      if (GUIA) sessionStorage.setItem(CLAVE_GUIA, JSON.stringify(GUIA));
      else sessionStorage.removeItem(CLAVE_GUIA);
    } catch (e) {}
  }
  function cargarGuia() {
    try { var v = sessionStorage.getItem(CLAVE_GUIA); if (v) GUIA = JSON.parse(v); } catch (e) {}
  }

  function guiaDe(id) { return (DATA.guias || {})[id] || null; }

  function empezarGuia(id, release) {
    var g = guiaDe(id); if (!g) return false;
    GUIA = { id: id, paso: 0 };
    guardarGuia();
    var cab = g.intro || ('Vamos con **' + g.titulo + '**. Te lo cuento paso a paso.');
    speak(cab + '\n\n' + textoPaso(g, 0),
          { accion: g.accion, esperaListo: true }, release);
    return true;
  }

  function textoPaso(g, i) {
    var p = g.pasos[i];
    var num = '**Paso ' + (i + 1) + ' de ' + g.pasos.length + '**\n\n';
    var pie = (i < g.pasos.length - 1)
      ? '\n\nCuando lo tengas, escríbeme **listo**.'
      : '';
    return num + p + pie;
  }

  function siguientePaso(release) {
    var g = guiaDe(GUIA.id);
    if (!g) { GUIA = null; guardarGuia(); return; }
    GUIA.paso++;
    if (GUIA.paso >= g.pasos.length) {
      var fin = g.fin || 'Y ya está. Tu bot queda trabajando solo.\n\n¿Te ayudo con algo más?';
      GUIA = null; guardarGuia();
      speak(fin, { opciones: g.despues || null }, release);
      return;
    }
    guardarGuia();
    speak(textoPaso(g, GUIA.paso), { esperaListo: true }, release);
  }

  function recordarGuia(release) {
    var g = guiaDe(GUIA.id);
    var r = 'Seguimos con **' + g.titulo + '**, íbamos por el **paso ' + (GUIA.paso + 1) +
            '**.\n\nEscríbeme **listo** cuando lo tengas, o dime **déjalo** si prefieres dejarlo para luego.';
    speak(r, null, release);
  }

  function send(raw) {
    var text = String(raw || '').trim();
    if (!text || busy) return;

    busy = true;
    addUser(text);
    elInput.value = '';
    elInput.style.height = 'auto';
    closeMenu();

    var release = function () { busy = false; };

    // Disparo directo de una guía desde un botón.
    if (text.indexOf('__guia:') === 0) {
      if (empezarGuia(text.slice(7), release)) return;
      release(); return;
    }

    /* ── SI ESTAMOS EN MEDIO DE UNA GUÍA, MANDA LA GUÍA ──────────
       Salvo que el usuario pregunte otra cosa: entonces se le responde
       y luego se le recuerda dónde estábamos. Nunca se le deja tirado
       ni se le obliga a terminar. */
    if (GUIA && !_menorDetectado(text)) {
      var nG = normalize(text);

      if (SALIR_GUIA_RE.test(nG)) {
        GUIA = null; guardarGuia();
        speak('Sin problema, lo dejamos aquí.\n\n¿Te ayudo con otra cosa?', null, release);
        return;
      }
      if (LISTO_RE.test(nG) && nG.split(/\s+/).length <= 4) {
        siguientePaso(release);
        return;
      }
      // Preguntó algo en medio: se le CONTESTA y luego se retoma el paso.
      // No hacerlo sería tratarle como a un formulario, no como a una persona.
      var _guardado = { id: GUIA.id, paso: GUIA.paso };
      var _hits = detectTopics(text);
      var _int  = detectIntent(text);
      var _resp = null, _extra = null;
      if (_hits.length) {
        var _e = _hits[0].entry;
        _resp  = pickVariant(_e.answer, (_e.topic || 'x') + '#a');
        _extra = { contactCard: _e.contactCard };
      } else if (_int && BOT.intentAnswers[_int]) {
        _resp = pickVariant(BOT.intentAnswers[_int].answer, 'intent#' + _int);
      }
      if (_resp) {
        GUIA = null;                          // que no se dispare el recordatorio dentro
        speak(_resp, _extra, function () {
          GUIA = _guardado; guardarGuia();
          setTimeout(function () { recordarGuia(release); }, 800);
        });
        return;
      }
      // Cualquier otra cosa: recordatorio amable.
      recordarGuia(release);
      return;
    }

    /* ══════════════════════════════════════════════════════════
       CONVERSACIÓN NATURAL, ANTES QUE NADA
       Estas dos ramas van primero porque son las que hacen que el chat
       parezca una conversación y no un buscador. Si el usuario dice
       "sí" o "no" a algo que acabamos de preguntarle, eso manda sobre
       cualquier otra interpretación: antes, un "sí" caía en la rama de
       "habla de nuestro tema" y la conversación se moría en seco.
       ══════════════════════════════════════════════════════════ */
    if (!_menorDetectado(text)) {
      var _n = normalize(text);
      var _corto = _n.split(/\s+/).length <= 5;

      /* [FALLO CORREGIDO] "explicame el acumulador con numeros" empieza
         por "explicame", que está en la lista de afirmaciones, y tiene 5
         palabras: se tomaba como un "sí" y se respondía con una sugerencia
         al azar en vez de explicar el acumulador.

         Un "sí" de verdad es CORTO (1-3 palabras) y no menciona ningún
         tema. Si el mensaje habla de algo concreto, manda el tema. */
      var _pideAlgo = detectTopics(text).length > 0;
      var _muyCorto = _n.split(/\s+/).length <= 3;

      // Dice que SÍ: siempre le llevamos a algo concreto.
      if (_muyCorto && !_pideAlgo && AFIRMA_RE.test(_n) && !isQuestion(text)) {
        if (lastEntry && lastEntry.more) {
          speak(pickVariant(lastEntry.more, (lastEntry.topic || 'x') + '#more'),
                { nav: lastEntry.nav, contactCard: lastEntry.contactCard, accion: lastEntry.accion },
                release);
          return;
        }
        var _sug = (DATA.bot.sugerencias || []);
        if (_sug.length) {
          var _p = pickVariant(_sug, 'sugerencia');
          lastEntry = null;
          speak(_p.texto, { opciones: _p.opciones }, release);
          return;
        }
      }

      // Dice que NO: se cierra sin insistir.
      if (_muyCorto && !_pideAlgo && NIEGA_RE.test(_n) && !isQuestion(text)) {
        speak(pickVariant(DATA.bot.cierre || ['Perfecto, aquí sigo.'], 'cierre'), null, release);
        return;
      }
    }

    /* [SEGURIDAD — MENORES, lo PRIMERO de todo] Antes de sembrar obra, de
       handleFlow, de cualquier cosa: si alguien se declara menor de 18, se
       cierra todo y no se le pide ni se le guarda nada. La detección es por
       edad explícita ("tengo 17 años", "i am 16") O por el tema 'a child'. */
    var _edadMenor = /\b(tengo|soy|i am|im|i'm)\s*(1[0-7]|[0-9])\s*(anos|años|years|year|yo)?\b/i.test(text) &&
                     !/\b(1[89]|[2-9][0-9])\s*(anos|años|years)/i.test(text);
    var _temaMenor = detectTopics(text).some(function (h) { return h.entry.minor; });
    if (_edadMenor || _temaMenor) {
      if (flow) clearFlow();
      pendingFlow = null; pendingAsk = null; seed = null; closed = false;
      savePending();
      var _kid = detectTopics(text).filter(function (h) { return h.entry.minor; });
      var _kidAns = _kid.length ? _kid[0].entry.answer
        : ['Gracias por decírmelo. Como eres menor de edad, no voy a pedirte ningún dato.\n\nCripto Cuba Oficial es una plataforma donde se opera con **dinero real**, y eso es solo para mayores de 18 años. No es sitio para ti todavía.\n\nSi te interesa aprender cómo funcionan las criptomonedas, hay muchísimo material gratis para empezar sin arriesgar nada.'];
      speak(pickVariant(_kidAns, 'a child#a'), null, release);
      return;
    }

    /* Se retiene lo que dice, siempre, aunque esté en mitad de un flujo.
       Se guarda una foto de ANTES para saber si este mensaje ha aportado algo
       nuevo sobre la persona (su oficio, su experiencia, su ciudad). */
    var antes = { city: MEM.city, trade: MEM.trade, experience: MEM.experience };
    remember(text);
    var haContado = (MEM.city !== antes.city) || (MEM.trade !== antes.trade) ||
                    (MEM.experience !== antes.experience);

    /* Si está describiendo una obra, se guarda. Es lo que evitará
       preguntarle otra vez lo que ya nos ha contado. */
    if (!flow) {
      var g0 = extract(text);
      var nPal = normalize(text).split(/\s+/).length;

      /* [FALLO CORREGIDO — el bot arrastraba al formulario a quien investigaba]
         "Estoy investigando empresas para un proyecto familiar", "estoy
         evaluando constructoras" NO es una obra: es alguien informándose. Si se
         siembra como obra, el ofrecimiento queda armado y la siguiente pregunta
         arranca el formulario. Una frase de investigación sin ciudad ni fecha
         no siembra nada: se le contesta y se le deja preguntar. */
      var investigando = /\b(investigando|evaluando|averiguando|comparando|mirando opciones|buscando informacion|researching|looking into|comparing|evaluating|exploring options|just looking|proyecto familiar|for my family|for a thesis|para la escuela|para un trabajo escolar)\b/i.test(text);
      if (investigando && !g0.city && !g0.when) {
        // no se siembra: baja a la cascada y se le responde la pregunta
      } else

      /* [FALLO CORREGIDO] Un párrafo de sesenta palabras se recortaba con la
         misma tijera que una frase de seis, y salía basura: de un correo
         entero sobre doce edificios, el bot entendía "repairs over the next
         eighteen months ideally indigenous" y se lo repetía al visitante.
         Un texto largo no se resume: se guarda TAL CUAL. Son sus palabras, y
         a la oficina le sirven mejor que mi recorte. */
      if (nPal > 25 && esDeNuestroTema(text) && !isQuestion(text)) {
        seed = { work: text.trim(), city: g0.city, when: g0.when };
      } else if (g0.work) {
        seed = g0;
      } else if (esDeNuestroTema(text) && !isQuestion(text)) {
        /* [FALLO CORREGIDO] Antes hacían falta TRES palabras. Quien escribía
           "roof" o "el tejado" — que es como escribe media humanidad — se
           llevaba un triaje. Una palabra basta si es una obra. */
        seed = { work: text.trim(), city: g0.city, when: g0.when };
      }
      if (seed) savePending();      // y sobrevive al cambio de página
    }

    /* 1. ¿Hay una toma de datos en marcha? Entonces se conduce. */
    if (flow) { handleFlow(text, release); return; }

    /* 2. ¿Tiene prisa? Se le da el teléfono ANTES que nada. Hacerle
       cinco preguntas a alguien con una urgencia es no escuchar. */
    if (URGENT.test(normalize(text)) && !alreadyOffered('urgent')) {
      markOffered('urgent');
      pendingFlow = flowFor('project');
      savePending();
      speak(pickVariant(BOT.urgent, 'urgent'), { contactCard: true }, release);
      return;
    }

    /* 2. ¿Se ofreció una y el visitante ha dicho que sí? */
    if (pendingFlow) {
      var n0 = normalize(text);
      /* [FALLO CORREGIDO — arrastraba al formulario a quien solo preguntaba]
         Con un ofrecimiento en el aire, una PREGUNTA del visitante ("¿cuál ha
         sido su proyecto favorito?", "¿qué es lo más difícil?") no es un "sí"
         ni un dato: es una pregunta. Antes se colaba por las ramas de abajo y
         acababa arrancando el formulario. Ahora, si pregunta, se sale de aquí
         y se le contesta; el ofrecimiento se mantiene para más tarde. */
      /* [FALLO CORREGIDO] "¿Qué servicios ofrecen EXACTAMENTE?" disparaba el
         arranque porque YES reconoce "exacto/exactamente" como un sí (se añadió
         como forma de confirmar). Pero dentro de una PREGUNTA no es un sí: es
         parte de la pregunta. Un "sí" solo cuenta si el turno no es pregunta. */
      if (YES.test(n0) && !isQuestion(text) && !NOT_YES.test(n0)) {
        arranqueOK = true;
        pendingAsk = null;
        startFlow(flowFor(pendingFlow), release, seed && seed.work, seed);
        return;
      }
      if (DECLINE.test(n0) || CANCEL.test(n0)) {
        pendingFlow = null;
        pendingAsk = null;
        savePending();
        speak(pickVariant(DATA.flowTalk.cancelled, 'cancel'), null, release);
        return;
      }

      /* ══════════════════════════════════════════════════════
         [FALLO CORREGIDO — estaba en producción y perdía clientes]

         El bot hacía una pregunta ("¿para qué fecha?", "¿te tomo los
         datos?") y después SOLO sabía oír un "sí". El visitante contestaba
         "en primavera" — es decir, contestaba — y el bot le hacía TRIAJE:
         "no te he entendido, ¿esto es un proyecto, un empleo o…?". Había
         preguntado algo y no escuchaba la respuesta. No hay forma más
         rápida de perder a alguien.

         Regla: con un ofrecimiento en el aire y una obra ya contada,
         cualquier respuesta que no sea OTRO tema, OTRA intención ni un
         galimatías es información sobre esa obra. Se recoge y se conduce.
         El resumen final se lee de vuelta y se puede cancelar: el peor
         caso de equivocarse aquí es una pregunta de más. El peor caso de
         no hacerlo es un cliente que se va.
      ══════════════════════════════════════════════════════ */
      /* Si el bot preguntó por un dato concreto ("¿en qué ciudad?"), la
         respuesta manda sobre CUALQUIER tema que pudiera encajar. Sin esto,
         el visitante contestaba "Toronto" y el bot le soltaba un folleto
         sobre su cobertura geográfica y volvía a preguntarle la ciudad:
         había hecho una pregunta y no aceptaba la respuesta. Una pregunta
         nueva del visitante (lleva "?" o empieza preguntando) sí manda. */
      /* Si había un dato pendiente pero el visitante PREGUNTA en vez de
         contestarlo, se atiende la pregunta: no se traga como si fuera el dato.
         Esto evita que "¿qué servicios?" acabe guardado como la ciudad. */
      if (pendingAsk && isQuestion(text)) {
        pendingAsk = null;
        savePending();
      }
      var answering = pendingAsk && !isQuestion(text) && !flowTrigger(text) && !isUnintelligible(text);

      /* [FALLO CORREGIDO] Esto solo escuchaba a los COMPRADORES: exigía que
         hubiera una obra descrita (seed.work). El bot le ofrecía a un albañil
         tomarle los datos, el albañil contestaba "soy albañil" — que es
         contestar — y el bot le hacía TRIAJE, porque no era ni un "sí" ni una
         obra. Ahora: si el mensaje aporta algo sobre la persona (su oficio, su
         experiencia, su ciudad), es una respuesta, y se conduce. */
      var aporta = haContado || (seed && seed.work);

      /* [FALLO CORREGIDO] "SOLO SÍ O NO" (Marcus, impaciente) se tragaba como un
         dato del formulario y lo arrancaba. Es una exigencia de respuesta
         binaria, no un dato. NOT_YES la excluye aquí también. */
      if (aporta && !isQuestion(text) && !flowTrigger(text) && !NOT_YES.test(n0) &&
          (haContado || !isUnintelligible(text)) &&
          (answering || haContado || (!detectTopics(text).length && !detectIntent(text)))) {

        if (!seed) seed = { work: null, city: null, when: null };
        var g1 = extract(text);

        /* Si el bot preguntó por un dato concreto, la respuesta ES ese dato,
           aunque no la reconozca ninguna expresión regular. */
        if (pendingAsk === 'where') {
          var place = g1.city || text.trim();
          var errPlace = validate({ type: 'place' }, place);
          if (errPlace) {                       // "Canadá" no es una ciudad
            speak(pickVariant(DATA.flowTalk[errPlace], errPlace), null, release);
            return;
          }
          seed.city = place;
        } else if (pendingAsk === 'when') {
          seed.when = g1.when || text.trim();
        } else {
          if (g1.city) seed.city = g1.city;
          if (g1.when) seed.when = g1.when;
        }

        pendingAsk = null;
        var pfNow = pendingFlow;
        markOffered(pfNow);
        savePending();
        /* [GUARDA] Si el turno es una pregunta, no se arranca el formulario: se
           deja el ofrecimiento en pie y se baja a la cascada a contestar. Evita
           que "¿qué servicios?" con un ofrecimiento en el aire abra el
           formulario a quien solo investiga. */
        if (isQuestion(text)) { pendingFlow = pfNow; savePending(); }
        else { startFlow(flowFor(pfNow), release, seed.work, seed); return; }
      }

      /* [FALLO CORREGIDO — perdía clientes ya ganados] Aquí se BORRABA el
         ofrecimiento en cuanto el visitante decía cualquier otra cosa. El bot
         ofrecía tomar los datos, la persona preguntaba una cosa más ("¿y eso
         lo arregláis?"), y el ofrecimiento se evaporaba: su "sí" de después
         ya no encontraba nada a lo que decir que sí, y acababa en "esto
         necesita una persona". Un cliente con la fachada cayéndose, perdido
         por hacer una pregunta.

         Un ofrecimiento sigue en pie hasta que se acepta o se rechaza. Solo
         una negativa explícita lo retira. */
      pendingAsk = null;
      savePending();
    }

    /* 3. ¿Lo pide directamente? ("send my project") */
    var direct = flowTrigger(text);
    if (direct) { startFlow(direct, release, seed && seed.work, seed); return; }

    /* 4. ¿Se ha ido de tema? Se comprueba ANTES de puntuar: si no, una
       ciudad suelta dentro de "¿qué tiempo hace en Toronto?" lo mandaba
       a hablar de cobertura geográfica. */
    if (OFFTOPIC.test(normalize(text)) && !esDeNuestroTema(text)) {
      misses = 0;
      speak(pickVariant(roleList(BOT.redirect), roleKey('redirect')), null, release);
      return;
    }

    /* Red de seguridad: si lo último que se habló ofrecía tomar los datos
       y el visitante dice "sí", se abre el flujo. Pase lo que pase con la
       memoria, un "sí" nunca vuelve a repetir la respuesta anterior.
       [FALLO CORREGIDO] "SOLO SÍ O NO" son 4 palabras y casa con YES por el
       "si" — abría el formulario a Marcus, que solo exigía una respuesta
       binaria. NOT_YES y la exclusión de preguntas lo frenan. */
    if (YES.test(normalize(text)) && normalize(text).split(' ').length <= 4 &&
        !NOT_YES.test(normalize(text)) && !isQuestion(text) &&
        lastEntry && lastEntry.offerFlow && DATA.flows[flowFor(lastEntry.offerFlow)]) {
      startFlow(flowFor(lastEntry.offerFlow), release, seed && seed.work, seed);
      return;
    }

    /* ── EL "SÍ" SIEMPRE LLEVA A ALGÚN SITIO ──────────────────────
       Antes, si el usuario decía "sí" y la última respuesta no tenía
       detalle guardado, se repetía lo mismo o se quedaba en blanco: la
       conversación moría. Ahora, si no hay más que contar, se ofrece
       algo concreto en vez de dejarlo colgado. */
    if (isFollowUp(text)) {
      // Sin contexto previo (el usuario dijo "sí" a una pregunta abierta),
      // igualmente hay que llevarle a algún sitio: si no, la conversación
      // se muere y parece que el bot se rompió.
      if (!lastEntry) {
        var sug0 = DATA.bot.sugerencias || [];
        if (sug0.length) {
          var p0 = pickVariant(sug0, 'sugerencia');
          speak(p0.texto, { opciones: p0.opciones }, function () { busy = false; });
          return;
        }
      }
      var key  = lastEntry ? (lastEntry.topic || lastEntry.keys[0]) : '';
      if (lastEntry && lastEntry.more) {
        speak(pickVariant(lastEntry.more, key + '#more'),
              { nav: lastEntry.nav, contactCard: lastEntry.contactCard, accion: lastEntry.accion },
              function () { busy = false; });
        return;
      }
      // Sin detalle guardado: llevamos la conversación a algo útil.
      var sug = DATA.bot.sugerencias || [];
      if (sug.length) {
        var pick = pickVariant(sug, 'sugerencia');
        speak(pick.texto, { opciones: pick.opciones }, function () { busy = false; });
        return;
      }
    }

    /* Si dice que NO, se cierra con elegancia en vez de insistir. */
    if (diceQueNo(text) && lastEntry && !isQuestion(text)) {
      speak(pickVariant(DATA.bot.cierre || ['Perfecto. Aquí sigo si te surge algo.'], 'cierre'),
            null, function () { busy = false; });
      return;
    }

    /* ¿Me están CONTANDO una obra? Entonces no toca repasar temas: toca
       escuchar. (Preguntar por una obra sí es un tema, y sigue su camino.)

       Repetir lo entendido solo funciona con mensajes CORTOS. A un párrafo
       largo no se le hace de loro: se le contesta a lo que pregunta y se le
       ofrece tomar los datos, con su texto entero ya guardado. */
    if (!isQuestion(text) && normalize(text).split(/\s+/).length <= 25) {
      var told = extract(text);

      /* "roof", "el tejado": sin verbo no hay obra que extraer, pero es una
         obra igual. Solo si no encaja en ningún tema: si el visitante escribe
         "concrete" a secas, merece la respuesta sobre hormigón, no un
         formulario. */
      if (!told.work && esDeNuestroTema(text) && normalize(text).split(/\s+/).length <= 4 &&
          !detectTopics(text).length) {
        told.work = text.trim();
      }

      if (told.work && reflectWork(told, release)) return;
    }

    /* [NUEVO] Con la conversación ya cerrada, un "gracias" o un "adiós" se
       contestan y punto: ni triaje, ni empujón, ni "¿qué más puedo hacer?".
       Y si de verdad trae algo nuevo, la conversación se reabre sola. */
    if (closed) {
      var cierre = detectTopics(text);
      var esCortesia = !cierre.length ||
        ['thanks', 'goodbye', 'small talk', 'greeting'].indexOf(cierre[0].entry.topic) !== -1;
      if (esCortesia && !isQuestion(text) && !flowTrigger(text)) {
        misses = 0;
        speak(pickVariant(BOT.afterSend, 'afterSend'), null, release);
        return;
      }
      closed = false;                 // trae algo nuevo: se vuelve a abrir
      savePending();
    }

    _lastWasQuestion = isQuestion(text);
    arranqueOK = false;          // cada turno empieza sin permiso de arranque

    var topics = detectTopics(text);

    /* [SEGURIDAD — MENORES] Si alguien se identifica como menor de edad, se
       cierra cualquier formulario abierto y no se le pide ningún dato. Va antes
       que nada: por encima de convertir. */

    /* [FALLO CORREGIDO — el saludo tapaba la pregunta]
       "Hola, ¿necesitáis quitanieves para vuestras obras?" traía UN tema: el
       saludo. Y como había tema, el motor contestaba al saludo y no llegaba
       nunca a la cascada — la pregunta de verdad se perdía. La persona repetía,
       el bot repetía el saludo, y a los tres mensajes acababa en "esto necesita
       una persona". La cortesía acompaña; no puede tapar lo que se pregunta.
       Si lo único que se ha reconocido es cortesía Y hay algo más escrito, se
       sigue buscando. */
    var soloCortesia = topics.length && topics.every(function (h) {
      return ['greeting', 'thanks', 'goodbye', 'small talk'].indexOf(h.entry.topic) !== -1;
    });
    /* [AFINADO] "Si hay tres palabras, aparta el saludo" era demasiado bruto:
        "Hello, Claude Moreau from Peel DSB" es un SALUDO con un nombre, y el
        bot le hacía triaje. El saludo solo estorba cuando detrás hay una
        pregunta de verdad o una obra. */
    if (soloCortesia && (isQuestion(text) || esDeNuestroTema(normalize(text)))) topics = [];

    /* ══════════════════════════════════════════════════════════
       LA CASCADA — lo que hace que no haga falta listar el mundo entero.

       Sin tema conocido, se intenta en orden:
         1. EXTRAER la obra de la frase (cualquier obra, aunque nunca la
            haya visto) → se la repito y pido solo lo que falta.
         2. Reconocer la FORMA de la pregunta (precio, plazo, papeles,
            algo roto, alguien perdido) → respondo a la forma.
         3. ¿Habla de construcción? → es una petición, aunque no sepa cuál.
         4. TRIAJE: tres puertas. Nunca "no lo sé" a secas.
    ══════════════════════════════════════════════════════════ */
    if (!topics.length) {

      /* 1. ¿Hay una obra descrita ahí dentro?
         [FALLO CORREGIDO] Esta llamada NO comprobaba si el mensaje era una
         pregunta. Resultado: "Do you have experience building on difficult
         soils?" — una pregunta — se tomaba por un encargo, y el bot
         contestaba "Entendido: building on difficult soils. ¿En qué ciudad?".
         Preguntar por una obra no es encargarla. Aquí valen las MISMAS dos
         condiciones que arriba: ni una pregunta, ni un texto largo. */
      if (!isQuestion(text) && normalize(text).split(/\s+/).length <= 25 &&
          reflectWork(extract(text), release)) return;

      /* 2. ¿Reconozco la forma de la pregunta? */
      var intent = detectIntent(text);
      if (intent && BOT.intentAnswers[intent]) {
        misses = 0;
        var ia = BOT.intentAnswers[intent];
        var iaFlow = ia.offerFlow && flowFor(ia.offerFlow);
        if (iaFlow && DATA.flows[iaFlow] && !alreadyOffered(iaFlow)) {
          pendingFlow = iaFlow;
          savePending();
        }
        speak(pickVariant(ia.answer, 'intent#' + intent),
              { contactCard: ia.contactCard }, release);
        return;
      }

      /* 3. ¿Habla de construcción, aunque no sepa de qué? */
      if (esDeNuestroTema(text)) {
        misses = 0;
        var cf = flowFor('project');
        if (!alreadyOffered(cf)) { pendingFlow = cf; savePending(); }
        speak(pickVariant(roleList(BOT.intentAnswers.need.answer), roleKey('intent#need')),
              null, release);
        return;
      }

      /* [FALLO CORREGIDO] Ya se le había dicho "eso no lo hacemos", y él
         seguía dando detalles de lo mismo ("3/4 clear", "40 yds"). El bot lo
         trataba como a un recién llegado y le hacía un TRIAJE comercial. Se
         le había olvidado su propia respuesta de hace dos mensajes. */
      if (offScope) {
        misses = 0;
        speak(pickVariant(BOT.stillOffScope, 'offScope'), { contactCard: true }, release);
        return;
      }

      /* Lo mismo con lo que solo puede contestar una persona (una licencia, un
         convenio, una Nación). El visitante insiste — es su derecho — y el bot
         no va a fingir que ahora sí lo sabe, ni le va a preguntar si busca
         trabajo. Se mantiene donde estaba: en la puerta de una persona. */
      if (handoff) {
        misses = 0;
        speak(pickVariant(BOT.escalate, 'escalate'), { contactCard: true }, release);
        return;
      }

      /* 4. No se ha entendido. Pero no se abandona: se hace TRIAJE. */
      lastEntry = null;
      misses++;

      var text2, extra;

      if (misses === 1 && isUnintelligible(text)) {
        text2 = pickVariant(BOT.clarify, 'clarify');
        extra = null;
      } else if (misses === 1) {
        text2 = pickVariant(roleList(BOT.triage), roleKey('triage'));
        extra = null;
      } else if (misses === 2) {
        text2 = pickVariant(BOT.retry, 'retry');
        extra = { contactCard: true };
      } else {
        /* Ya van tres. Dejar de marear a la persona es lo respetuoso. */
        text2 = pickVariant(BOT.escalate, 'escalate');
        extra = { contactCard: true };
      }

      speak(text2, extra, function () { busy = false; });
      return;
    }

    misses = 0;                  // ha entendido: cuenta a cero
    lastEntry = topics[0].entry;
    offScope = !!topics[0].entry.outOfScope;   // ¿le acabo de decir que no?
    handoff  = !!topics[0].entry.handoff;      // ¿esto solo lo contesta una persona?
    savePending();

    var topEntry = topics[0].entry;
    var topName  = topEntry.topic || topEntry.keys[0];

    /* ¿Vuelve sobre lo mismo? Basta de charla: se actúa. Y se da por
       dicho lo que ya nos contó. */
    if (topName === lastTopic) repeats++; else repeats = 0;
    lastTopic = topName;

    /* [FALLO CORREGIDO] Bastaba con rozar el mismo tema DOS veces para que el
       bot dejara de contestar y arrancara el formulario. Un consultor que
       preguntaba por la cobertura y luego por el alcance geográfico —
       informarse, que es a lo que había venido — acababa metido en una toma de
       datos que no había pedido. Insistir es preguntar lo mismo TRES veces. */
    var repeatFlow = !topEntry.outOfScope && topEntry.offerFlow && flowFor(topEntry.offerFlow);
    if (repeats >= 2 && repeatFlow && DATA.flows[repeatFlow]) {
      repeats = 0;
      markOffered(repeatFlow);
      /* [FALLO CORREGIDO — estaba en producción] Esto se llamaba 'seed', y
         al declararse con var DENTRO de send() se izaba y TAPABA la semilla
         del módulo en toda la función. La semilla se guardaba en una
         variable local que moría con el mensaje: el visitante decía "quiero
         construir un almacén", decía "sí"… y el bot le preguntaba qué quería
         construir. El fallo que los comentarios daban por corregido seguía
         vivo, escondido detrás de un nombre repetido. */
      var seedNow = extract(text);
      speak(pickVariant(DATA.flowTalk.justStart, 'justStart'), null, function () {
        startFlow(repeatFlow, release, seedNow.work || (esDeNuestroTema(text) ? text : null), seedNow);
      });
      return;
    }
    var multi = topics.length > 1;
    var i = 0;

    (function next() {
      if (i >= topics.length) { busy = false; return; }

      var entry = topics[i].entry;
      var key   = entry.topic || entry.keys[0];
      var body  = pickVariant(entry.answer, key + '#a');
      var out   = body;

      /* Con varios temas, cada respuesta se presenta: el visitante ve
         que se le entendió TODO y sabe a qué contesta cada bloque. Los
         conectores rotan, así que nunca suena a plantilla. */
      if (multi) {
        /* [FALLO CORREGIDO] El conector metía la ETIQUETA INTERNA del tema como
           si fuera un asunto legible: "On **company identity**:", "Regarding
           **greeting**:". Suena a máquina y delata las tripas del bot. Ahora
           solo se usa el conector si el tema tiene una etiqueta presentable; si
           no, la respuesta va directa, sin anunciarse. La primera respuesta
           nunca lleva conector: entra limpia. */
        var LABELS = {
          'services': 'our services', 'quality and guarantees': 'quality',
          'delays and schedule': 'timing', 'company track record': 'past work',
          'coverage area': 'where we work', 'who we work with': 'our clients',
          'what makes you different': 'what sets us apart', 'methods and technology': 'how we work',
          'client communication': 'staying informed', 'meeting request': 'setting up a call',
          'safety and insurance': 'insurance and safety', 'the directors': 'our directors',
          'past projects': 'past work', 'subcontracting': 'working with us',
          'careers': 'jobs', 'client communication': 'how we keep you informed',
          'meeting request': 'setting up a call', 'sustainability': 'sustainability'
        };
        var etiqueta = LABELS[key];
        if (i > 0 && etiqueta) {
          var lead = pickVariant(BOT.connectors.next, 'connectorB');
          out = lead.replace('{topic}', etiqueta) + '\n\n' + body;
        }
      }

      i++;

      /* EMPUJÓN. Si la respuesta no termina en pregunta, el bot añade una.
         Antes contestaba y se callaba: el visitante se quedaba mirando la
         pantalla sin saber qué hacer, y se iba. Nunca se cede el turno sin
         devolver la pelota. */
      /* [CORREGIDO] Antes se saltaba el empujón cuando la entrada tenía
         offerFlow. Pero si el ofrecimiento YA se había hecho, la respuesta
         moría sin pregunta y el visitante se quedaba sin saber qué escribir.
         Ahora: sin pregunta, no se cede el turno. */
      var isLast   = (i >= topics.length);
      var entryFlow = entry.offerFlow && flowFor(entry.offerFlow);
      var willOffer = entryFlow && DATA.flows[entryFlow] && !alreadyOffered(entryFlow);
      if (isLast && out.indexOf('?') === -1 && !entry.contactCard && !willOffer) {
        out += '\n\n' + pickVariant(roleList(BOT.nudges), roleKey('nudge'));
      }

      // Si otro de los temas de esta respuesta traía opciones, se conservan.
      if (isLast && !entry.opciones) {
        for (var _z = 0; _z < topics.length; _z++) {
          var _e2 = topics[_z].entry;
          if (_e2 && _e2.opciones && _e2.opciones.length) { entry._opcionesExtra = _e2.opciones; break; }
        }
      }
      speak(out, entry, function () {
        if (isLast && willOffer) {
          pendingFlow = entryFlow;
          savePending();
          markOffered(entryFlow);
          speak(pickVariant(DATA.flows[entryFlow].offer, entryFlow + '#offer'), null, next);
          return;
        }
        next();
      });
    })();
  }

  /* ── Menú de temas ────────────────────────────────────── */

  function openMenu() {
    elMenu.classList.add('is-open');
    elMenu.setAttribute('aria-hidden', 'false');
    document.getElementById('npTopics').setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (!elMenu) return;
    elMenu.classList.remove('is-open');
    elMenu.setAttribute('aria-hidden', 'true');
    var t = document.getElementById('npTopics');
    if (t) t.setAttribute('aria-expanded', 'false');
  }

  /* ── Abrir / cerrar ───────────────────────────────────── */

  function open() {
    var dot = document.getElementById('npDot');
    if (dot) dot.remove();
    try { sessionStorage.setItem(SEEN, '1'); sessionStorage.setItem(OPEN, '1'); } catch (e) {}
    elFab.classList.remove('np-chat-fab--call');
    elFab.classList.add('is-open');
    elChat.classList.add('is-open');
    elChat.setAttribute('aria-hidden', 'false');
    setTimeout(function () { elInput.focus(); }, 260);

    /* el asistente saluda EN VIVO: pausa, puntos, y escribe. Nunca un cartel
       ya puesto esperando. Diez saludos posibles, sin repetir. */
    /* ══════════════════════════════════════════════════════════════
       [SALUDOS REPETIDOS CORREGIDOS] El saludo se guardaba en el
       historial. Al recargar la página, el historial se restauraba CON
       el saludo dentro y encima se escribía otro. Diez recargas, diez
       saludos apilados.

       Ahora: el saludo NO se guarda (es de bienvenida, no conversación)
       y solo se escribe si de verdad no hay nada en pantalla.
       ══════════════════════════════════════════════════════════════ */
    if (!elMsgs.children.length && !busy) {
      busy = true;
      setTimeout(function () {
        _esSaludo = true;
        /* Sin remate. "¿Te aclaro algo más?" después de presentarse no
           tiene sentido: todavía no ha aclarado nada. */
        speak(pickVariant(BOT.greeting, 'greeting'), { noNudge: true }, function () {
          _esSaludo = false;
          busy = false;
        });
      }, 350);
    }
    bottom();
  }

  function close() {
    closeMenu();
    elChat.classList.remove('is-open');
    elChat.setAttribute('aria-hidden', 'true');
    elFab.classList.remove('is-open');
    try { sessionStorage.removeItem(OPEN); } catch (e) {}
  }

  function toggle() { elChat.classList.contains('is-open') ? close() : open(); }

  /* ── Arranque ─────────────────────────────────────────── */

  function init() {
    injectStyles();
    cargarGuia();
    build();
    loadFlow();      // una toma de datos a medias sobrevive al cambio de página
    loadPending();   // y también el ofrecimiento en el aire
    loadMem();       // y lo que el visitante ya nos contó
    restore();

    var wasOpen = false, seen = false;
    try {
      wasOpen = sessionStorage.getItem(OPEN) === '1';
      seen    = sessionStorage.getItem(SEEN) === '1';
    } catch (e) {}

    if (wasOpen) { open(); return; }
    if (seen) {
      var d = document.getElementById('npDot');
      if (d) d.remove();
      return;
    }

    setTimeout(function () {
      if (!elChat.classList.contains('is-open')) elFab.classList.add('np-chat-fab--call');
    }, 2000);
  }

  /* Reinicio limpio: lo usa el cambio de idioma. Quita lo pintado, borra la
     conversación anterior y vuelve a montar con el conocimiento nuevo. */
  window.NP_CHAT_REINICIAR = function () {
    try {
      sessionStorage.removeItem(STORE);
      sessionStorage.removeItem('np-chat-last');
    } catch (e) {}
    var viejo = document.getElementById('npChat');
    var fab = document.getElementById('npFab');
    if (viejo) viejo.remove();
    if (fab) fab.remove();
    DATA = elegirKB();
    BOT  = DATA.bot;
    init();
    var f2 = document.getElementById('npFab');
    if (f2) setTimeout(function () { f2.click(); }, 60);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
