// liquidity.js — Liquidity Pools 2.0
//
// Traducción a JavaScript del indicador Pine Script de Jesús.
// Detecta bloques de órdenes (order blocks) y reparte el volumen dentro
// de cada uno en rejillas, para ver DÓNDE se concentró la liquidez.
//
// COLORES ORIGINALES DEL INDICADOR (respetados tal cual):
//   #ff0000  volumen alto        (rojo)
//   #fbff00  volumen medio       (amarillo)
//   #15ff00  volumen bajo        (verde)
//   #0037ff  bloque bajista      (azul)

import * as ethers from './vendor/ethers-6.13.4.min.js?v=126';
import * as wallet from './wallet.js?v=125';

/* ══════════════════════════════════════════════════════════════
   SUSCRIPCIÓN A LAS HERRAMIENTAS PRO

   El acceso va ligado a la WALLET: quien paga entra al momento, sin
   que nadie tenga que aprobar nada a mano. Se comprueba contra el
   contrato cada vez que se abre la herramienta.

   [PENDIENTE] Poner aquí la dirección cuando se despliegue el
   contrato CriptoCubaPro.sol. Mientras esté vacío, el acceso queda
   abierto para todos: así se puede seguir probando la herramienta.
   ══════════════════════════════════════════════════════════════ */
const PRO = '';   // ← dirección del contrato

const ABI_PRO = [
  'function planes(uint8) view returns (uint32 dias, uint32 precioUsd, bool activo)',
  'function costeEnBnb(uint8) view returns (uint256)',
  'function costeEnUsdt(uint8) view returns (uint256)',
  'function comprarConBnb(uint8 plan) payable',
  'function comprarConUsdt(uint8 plan)',
  'function tieneAcceso(address) view returns (bool)',
  'function estadoDe(address) view returns (uint64 hasta, uint256 quedan)',
  'function pausado() view returns (bool)'
];



const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ══════════════════════════════════════════════════════════════
   LOS COLORES DEL INDICADOR
   Salen del Pine Script original, con su transparencia:
     obHighVolumeColor   = color.new(#ff0000, 23)
     obMediumVolumeColor = color.new(#fbff00, 36)
     obLowVolumeColor    = color.new(#15ff00, 75)
     bearish             = color.new(#0037ff, 50)
   En Pine la transparencia va de 0 (opaco) a 100 (invisible),
   así que la opacidad CSS es (100 - t) / 100.
   ══════════════════════════════════════════════════════════════ */
const COL = {
  /* Las transparencias del Pine original, rebajadas un poco: en
     TradingView el gráfico es más grande y aguanta más carga de color.
     Aquí, con las velas debajo, hay que poder verlas. */
  alto:  { hex: '#ff0000', op: 0.46 },   // original 0.77
  medio: { hex: '#fbff00', op: 0.38 },   // original 0.64
  bajo:  { hex: '#15ff00', op: 0.20 },   // original 0.25
  bear:  { hex: '#0037ff', op: 0.50 }
};
const rgba = (c) => {
  const n = parseInt(c.hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${c.op})`;
};

/* Monedas disponibles, con su par en Binance. */
/* El campo `cg` es el identificador en CoinGecko, para el logo. */
const PARES = [
  { id: 'BTC',   s: 'BTCUSDT',   n: 'Bitcoin',   cg: 'bitcoin' },
  { id: 'ETH',   s: 'ETHUSDT',   n: 'Ethereum',  cg: 'ethereum' },
  { id: 'BNB',   s: 'BNBUSDT',   n: 'BNB',       cg: 'binancecoin' },
  { id: 'SOL',   s: 'SOLUSDT',   n: 'Solana',    cg: 'solana' },
  { id: 'XRP',   s: 'XRPUSDT',   n: 'XRP',       cg: 'ripple' },
  { id: 'DOGE',  s: 'DOGEUSDT',  n: 'Dogecoin',  cg: 'dogecoin' },
  { id: 'ADA',   s: 'ADAUSDT',   n: 'Cardano',   cg: 'cardano' },
  { id: 'AVAX',  s: 'AVAXUSDT',  n: 'Avalanche', cg: 'avalanche-2' },
  { id: 'LINK',  s: 'LINKUSDT',  n: 'Chainlink', cg: 'chainlink' },
  { id: 'DOT',   s: 'DOTUSDT',   n: 'Polkadot',  cg: 'polkadot' },
  { id: 'MATIC', s: 'MATICUSDT', n: 'Polygon',   cg: 'matic-network' },
  { id: 'LTC',   s: 'LTCUSDT',   n: 'Litecoin',  cg: 'litecoin' },
  { id: 'TRX',   s: 'TRXUSDT',   n: 'TRON',      cg: 'tron' },
  { id: 'SHIB',  s: 'SHIBUSDT',  n: 'Shiba Inu', cg: 'shiba-inu' },
  { id: 'PEPE',  s: 'PEPEUSDT',  n: 'Pepe',      cg: 'pepe' },
  { id: 'NEAR',  s: 'NEARUSDT',  n: 'NEAR',      cg: 'near' },
  { id: 'APT',   s: 'APTUSDT',   n: 'Aptos',     cg: 'aptos' },
  { id: 'ARB',   s: 'ARBUSDT',   n: 'Arbitrum',  cg: 'arbitrum' },
  { id: 'OP',    s: 'OPUSDT',    n: 'Optimism',  cg: 'optimism' },
  { id: 'INJ',   s: 'INJUSDT',   n: 'Injective', cg: 'injective-protocol' },
  { id: 'SUI',   s: 'SUIUSDT',   n: 'Sui',       cg: 'sui' },
  { id: 'ATOM',  s: 'ATOMUSDT',  n: 'Cosmos',    cg: 'cosmos' },
  { id: 'FIL',   s: 'FILUSDT',   n: 'Filecoin',  cg: 'filecoin' },
  { id: 'UNI',   s: 'UNIUSDT',   n: 'Uniswap',   cg: 'uniswap' },
  { id: 'WIF',   s: 'WIFUSDT',   n: 'dogwifhat', cg: 'dogwifcoin' },
  { id: 'TIA',   s: 'TIAUSDT',   n: 'Celestia',  cg: 'celestia' }
];
const TFS = [
  { id: '5m',  n: '5m' },
  { id: '15m', n: '15m' },
  { id: '30m', n: '30m' },
  { id: '1h',  n: '1H' },
  { id: '2h',  n: '2H' },
  { id: '4h',  n: '4H' },
  { id: '12h', n: '12H' },
  { id: '1d',  n: '1D' },
  { id: '1w',  n: '1S' }
];

let _od = null;              // módulo de órdenes
let _zonasOd = [];           // dónde pulsar para cancelar
let _par = 'BNB';
let _tf = '1h';

/* ══════════════════════════════════════════════════════════════
   ESTADO DE LA VISTA

   El gráfico no se dibuja entero: se dibuja una VENTANA sobre los
   datos. Arrastrar mueve esa ventana; el zoom la ensancha o la
   estrecha. Como el mapa de liquidaciones se pinta con las mismas
   coordenadas que las velas, queda pegado a ellas pase lo que pase.
   ══════════════════════════════════════════════════════════════ */
const V = {
  velas: [],          // todos los datos descargados
  mapa: null,         // el mapa ya calculado
  desde: 0,           // primera vela visible
  ancho: 150,         // cuántas velas caben
  yMin: 0, yMax: 0,   // rango de precio visible
  autoY: true,        // ¿la escala vertical se ajusta sola?
  apal: 'todos',      // filtro de apalancamiento
  intensidad: 0.55,       // al mínimo: así se parece más a la referencia
  verPerfil: false,       // el perfil de volumen, apagado por defecto
  verMapa: true,
  arrastrando: false,
  x0: 0, y0: 0,
  cruzX: -1, cruzY: -1,    // dónde está el puntero, para la cruz

  /* Tachuelas de zonas de alta liquidez (banda del perfil) */
  tachuelas: [],           // hitboxes recalculados en cada dibujo
  tachAbierta: null,       // índice de la tachuela desplegada, o null
  tachCerrar: null,        // hitbox de la X de la tarjeta abierta
  tachPanel: null,         // hitbox de la tarjeta abierta (para consumir clics)

  /* ── DIBUJO ──
     Las líneas se guardan en PRECIO y TIEMPO, no en píxeles. Así se
     quedan pegadas al gráfico cuando se hace zoom o se arrastra, que
     es lo que se espera de una herramienta de análisis. */
  herramienta: null,       // null | 'linea' | 'horizontal' | 'fibo'
  dibujos: [],
  enCurso: null
};

/* Los niveles de Fibonacci de siempre. */
const FIBO = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/* ══════════════════════════════════════════════════════════════
   EL MOTOR — MAPA DE LIQUIDACIONES

   Así es como funcionan estas herramientas de verdad (CoinGlass,
   TradingDifferent y las demás):

   1. Por cada vela se asume que se abrieron posiciones a ese precio.
      El tamaño se estima con el volumen de esa vela.

   2. Esas posiciones llevan apalancamiento. Se reparten según lo que
      se usa de verdad en el mercado: x10 y x25 son lo más común, x100
      es minoría pero deja los niveles más cercanos al precio.

   3. Se calcula dónde saltaría cada una:
        LARGO  → entrada × (1 − 1/apalancamiento)
        CORTO  → entrada × (1 + 1/apalancamiento)

   4. Todo eso se acumula en una rejilla de precio × tiempo. Cada celda
      suma cuánto dinero se liquidaría ahí.

   5. Las posiciones cuyo nivel ya fue tocado por el precio DESAPARECEN:
      ya se liquidaron. Eso es lo que hace que el mapa "se consuma" por
      donde pasa el precio, igual que en las herramientas de pago.

   IMPORTANTE: son estimaciones a partir de precio y volumen, no datos
   del motor de liquidación de ningún exchange. Nadie publica eso.
   ══════════════════════════════════════════════════════════════ */

/* Reparto de apalancamiento. Suma 1. */
const APALANCAMIENTOS = [
  { x: 10,  peso: 0.34 },
  { x: 25,  peso: 0.29 },
  { x: 50,  peso: 0.21 },
  { x: 100, peso: 0.16 }
];

const FILAS = 260;      // resolución vertical del mapa

/* El mapa se calcula UNA vez sobre todos los datos, guardando cada
   nivel por separado. Así, al mover o hacer zoom, no hay que volver a
   calcular nada: solo se vuelve a pintar lo que entra en pantalla. */
/* ══════════════════════════════════════════════════════════════
   DÓNDE ESTÁ LA LIQUIDEZ DE VERDAD

   La liquidez no está repartida por igual: se concentra en sitios
   concretos, y son estos:

   1. MÁXIMOS Y MÍNIMOS (swing highs/lows)
      Encima de un máximo visible están los stops de los cortos y las
      órdenes de quien espera la ruptura. Debajo de un mínimo, igual
      con los largos. Cuanto más obvio el nivel, mayor el montón.

   2. NIVELES TOCADOS VARIAS VECES
      Un techo probado tres veces acumula el triple de órdenes que uno
      tocado una sola vez. Ahí es donde se forman los muros.

   3. LA BASE DE LOS IMPULSOS
      Cuando arranca un movimiento fuerte, en su origen quedan órdenes
      sin ejecutar. El precio suele volver a buscarlas.

   4. VACÍOS DE LIQUIDEZ (velas de cuerpo grande)
      Una vela enorme deja un hueco que el mercado no negoció bien.
      Esos huecos actúan como imán: el precio vuelve a rellenarlos.

   5. LIQUIDACIONES POR APALANCAMIENTO
      Y encima de todo eso, los niveles donde saltan las posiciones
      apalancadas.
   ══════════════════════════════════════════════════════════════ */



/** Encuentra los máximos y mínimos relevantes del gráfico. */
function pivotes(velas, radio) {
  const altos = [], bajos = [];
  for (let i = radio; i < velas.length - radio; i++) {
    let esAlto = true, esBajo = true;
    for (let j = i - radio; j <= i + radio; j++) {
      if (j === i) continue;
      if (velas[j].h >= velas[i].h) esAlto = false;
      if (velas[j].l <= velas[i].l) esBajo = false;
      if (!esAlto && !esBajo) break;
    }
    if (esAlto) altos.push({ i, p: velas[i].h, t: velas[i].t });
    if (esBajo) bajos.push({ i, p: velas[i].l, t: velas[i].t });
  }
  return { altos, bajos };
}

function construirMapa(velas) {
  if (velas.length < 40) return null;

  const his = velas.map((v) => v.h), los = velas.map((v) => v.l);
  const pAlto = Math.max(...his), pBajo = Math.min(...los);
  const margen = (pAlto - pBajo) * 0.22;
  const yMax = pAlto + margen, yMin = Math.max(0, pBajo - margen);
  const alturaFila = (yMax - yMin) / FILAS;
  const filaDe = (p) => Math.floor((p - yMin) / alturaFila);
  const rango = pAlto - pBajo;

  const niveles = {};
  APALANCAMIENTOS.forEach(({ x }) => {
    niveles[x] = Array.from({ length: velas.length }, () => new Float32Array(FILAS));
  });

  /* ══════════════════════════════════════════════════════════════
     REFUERZO POR ESTRUCTURA

     No se dibuja nada aparte. Lo que se hace es un MULTIPLICADOR por
     altura: las filas que coinciden con máximos y mínimos donde el
     precio rebotó valen más. Así, cuando una liquidación cae ahí, sube
     a naranja o rojo, y el dibujo sigue saliendo de las velas.

     Cuantas más veces se tocó un nivel, más pesa: un techo probado
     tres veces acumula muchísimo más que uno tocado una vez.
     ══════════════════════════════════════════════════════════════ */
  const refuerzo = new Float32Array(FILAS).fill(1);
  const { altos, bajos } = pivotes(velas, 3);
  const tol = (pAlto - pBajo) * 0.006;

  /* Cada pivote aporta según lo importante que sea:
       · cuántas veces se tocó ese nivel
       · el tamaño de la mecha (una mecha larga = mucha liquidez barrida)
       · el volumen de esa vela
     Los extremos absolutos del gráfico —el máximo y el mínimo de todo
     el rango— reciben un extra: son los niveles que todo el mundo mira. */
  /* ══════════════════════════════════════════════════════════════
     SOLO LOS NIVELES QUE IMPORTAN

     Antes se marcaba CADA pivote, y en 500 velas hay decenas. Salían
     bandas rojas por todas partes y el gráfico dejaba de informar: si
     todo es importante, nada lo es.

     Ahora se puntúa cada nivel y se quedan SOLO LOS 6 MEJORES. Un
     trader puede leer seis niveles; sesenta, no.
     ══════════════════════════════════════════════════════════════ */
  const candidatos = [];

  const puntuar = (piv, lista) => {
    const toques = lista.filter((o) => Math.abs(o.p - piv.p) <= tol).length;
    const v = velas[piv.i];
    const esAlto = lista === altos;
    const mecha = esAlto ? (v.h - Math.max(v.o, v.c)) : (Math.min(v.o, v.c) - v.l);
    const relMecha = Math.min(1, mecha / ((pAlto - pBajo) * 0.022));

    // Volumen de esa vela comparado con el normal
    const volMedio = velas.reduce((a, x) => a + x.v, 0) / velas.length;
    const relVol = Math.min(2.2, v.v / Math.max(1e-9, volMedio));

    const extremo = (esAlto && Math.abs(piv.p - pAlto) < tol * 3) ||
                    (!esAlto && Math.abs(piv.p - pBajo) < tol * 3);

    /* La puntuación combina lo que de verdad hace un nivel importante:
       cuántas veces se tocó, qué mecha dejó, cuánto volumen movió y si
       es un extremo del rango. */
    let pts = toques * 2.4 + relMecha * 2.0 + relVol * 1.3;
    if (extremo) pts += 2.6;

    candidatos.push({ p: piv.p, pts, f: filaDe(piv.p) });
  };
  altos.forEach((p) => puntuar(p, altos));
  bajos.forEach((p) => puntuar(p, bajos));

  /* ══════════════════════════════════════════════════════════════
     MECHAS GRANDES — zonas de reacción fuerte

     Una mecha del 0,8% o más en una hora significa que el precio llegó
     ahí, encontró órdenes y fue rechazado con fuerza. Eso es una zona
     de liquidez, y va marcada aunque el nivel no sea de los seis
     mejores por otros motivos.

     Se mide en PORCENTAJE sobre el precio, no en valor absoluto: así
     funciona igual en BTC a 90.000 que en DOGE a 0,15.
     ══════════════════════════════════════════════════════════════ */
  /* El umbral es relativo al propio gráfico: la mecha tiene que ser
     grande COMPARADA CON LAS DEMÁS, no solo pasar de un porcentaje.
     En un mercado tranquilo el 0,8% es enorme; en uno volátil, normal. */
  const todasMechas = [];
  velas.forEach((v) => {
    const cA = Math.max(v.o, v.c), cB = Math.min(v.o, v.c);
    todasMechas.push((v.h - cA) / v.h, (cB - v.l) / Math.max(1e-9, v.l));
  });
  todasMechas.sort((a, b) => a - b);
  // El 6% más grande: son las que de verdad destacan
  const UMBRAL_MECHA = Math.max(0.008, todasMechas[Math.floor(todasMechas.length * 0.975)] || 0.008);

  /* [CORREGIDO] Las mechas se marcaban en un solo punto y luego el
     filtro de "9 niveles" las descartaba. Dos fallos:

     1. Una mecha del 743 al 717 es un RANGO entero de rechazo, no una
        línea. Se pinta toda la extensión de la mecha.
     2. Van directas al refuerzo, sin pasar por el filtro de niveles.
        Una mecha grande siempre es zona de liquidez: está comprobado
        que cuando el precio vuelve, reacciona. */
  velas.forEach((v) => {
    const cuerpoAlto = Math.max(v.o, v.c), cuerpoBajo = Math.min(v.o, v.c);

    [[(v.h - cuerpoAlto) / v.h, cuerpoAlto, v.h],
     [(cuerpoBajo - v.l) / Math.max(1e-9, v.l), v.l, cuerpoBajo]
    ].forEach(([rel, pA, pB]) => {
      if (rel < UMBRAL_MECHA) return;

      // Fuerza según el tamaño: al 2,5% ya es máxima
      const fuerza = 0.5 + Math.min(1, rel / (UMBRAL_MECHA * 2.4)) * 1.9;
      const fA = filaDe(Math.min(pA, pB));
      const fB = filaDe(Math.max(pA, pB));

      // TODA la mecha se marca, no solo su extremo
      for (let f = fA - 1; f <= fB + 1; f++) {
        if (f < 0 || f >= FILAS) continue;
        // El extremo de la mecha es lo más fuerte; la base, algo menos
        const pos = (f - fA) / Math.max(1, fB - fA);
        const peso = 0.62 + pos * 0.38;
        refuerzo[f] = Math.max(refuerzo[f], 1 + fuerza * peso);
      }
    });
  });

  // Los mejores, sin repetir niveles que estén pegados
  candidatos.sort((a, b) => b.pts - a.pts);
  const elegidos = [];
  for (const c of candidatos) {
    if (elegidos.length >= 9) break;
    if (elegidos.some((e) => Math.abs(e.f - c.f) < 9)) continue;
    elegidos.push(c);
  }

  // Y se marcan, con fuerza proporcional a su puntuación
  const ptsMax = elegidos.length ? elegidos[0].pts : 1;
  elegidos.forEach((c) => {
    const rel = c.pts / ptsMax;                 // 0 a 1
    const fuerza = 1.5 + rel * 4.5;             // el mejor llega al rojo
    for (let d = -3; d <= 3; d++) {
      const f = c.f + d;
      if (f < 0 || f >= FILAS) continue;
      const caida = Math.exp(-(d * d) / 3.2);
      refuerzo[f] = Math.max(refuerzo[f], 1 + fuerza * caida);
    }
  });

  /* ── 5. LIQUIDACIONES POR APALANCAMIENTO ── */
  velas.forEach((v, ci) => {
    const medio = (v.h + v.l + v.c) / 3;
    const dinero = v.v * medio;
    if (!(dinero > 0)) return;
    const partLargo = v.c >= v.o ? 0.58 : 0.42;

    APALANCAMIENTOS.forEach(({ x, peso }) => {
      const base = dinero * peso;
      const rej = niveles[x];
      [[medio * (1 - 1 / x), base * partLargo],
       [medio * (1 + 1 / x), base * (1 - partLargo)]].forEach(([precio, monto]) => {
        const f = filaDe(precio);
        if (f < 0 || f >= FILAS) return;
        for (let cj = ci; cj < velas.length; cj++) {
          const w = velas[cj];
          if (precio <= w.h && precio >= w.l) break;
          rej[cj][f] += monto;
        }
      });
    });
  });

  return { niveles, velas, yMin, yMax, alturaFila, refuerzo };
}

/** Suma los niveles según el filtro de apalancamiento activo. */
/* ══════════════════════════════════════════════════════════════
   [CORREGIDO] Aquí estaba el fallo. Los pools estructurales generan
   cifras muchísimo mayores que las liquidaciones, así que al sumarlos
   directamente aplastaban todo lo demás: el mapa denso desaparecía y
   solo quedaban cuatro bandas sueltas.

   La solución: cada capa se normaliza POR SEPARADO a 0-1 y luego se
   mezclan. Así conviven las dos:
     · las liquidaciones dan el mapa de fondo, denso, que llena la
       pantalla (azules y verdes)
     · los pools estructurales suben por encima y son los que llegan
       a rojo, porque es donde de verdad está la liquidez
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   [CORREGIDO] Los pools estructurales se pintaban como rectángulos
   horizontales sueltos y eso rompía el aspecto. Las barras de liquidez
   se forman DESDE CADA VELA hacia la derecha, no como bloques.

   Vuelve el motor de liquidaciones, que daba el dibujo correcto. Lo
   que aportan ahora los máximos y mínimos es solo PESO: si un nivel de
   liquidación cae donde el precio rebotó varias veces, se refuerza y
   sube a rojo. El rojo sale donde debe, sin romper el dibujo.
   ══════════════════════════════════════════════════════════════ */
function columnaDe(mapa, c, sinRefuerzo) {
  const out = new Float32Array(FILAS);
  const lista = V.apal === 'todos'
    ? APALANCAMIENTOS.map((a) => a.x)
    : [Number(V.apal)];
  lista.forEach((x) => {
    const col = mapa.niveles[x] && mapa.niveles[x][c];
    if (!col) return;
    for (let f = 0; f < FILAS; f++) out[f] += col[f];
  });
  /* El refuerzo por estructura se aplica AQUÍ, antes de que se calcule
     el máximo. Si se aplicaba al pintar, el máximo ya estaba fijado sin
     él y el efecto se perdía: por eso los picos no salían en rojo. */
  const r = mapa.refuerzo;
  if (r && !sinRefuerzo) for (let f = 0; f < FILAS; f++) out[f] *= r[f];
  return out;
}

/* ══════════════════════════════════════════════════════════════
   EN VIVO
   La última vela se refresca cada 10 segundos con datos reales de
   Binance. El mapa se recalcula y se vuelve a pintar sin mover la
   vista del usuario.
   ══════════════════════════════════════════════════════════════ */
let _vivo = null;
function arrancarVivo() {
  clearInterval(_vivo);
  const idVivo = _cargaId;
  _vivo = setInterval(async () => {
    // Si ya se cambió de temporalidad, este reloj es de la carga vieja
    if (idVivo !== _cargaId) { clearInterval(_vivo); return; }
    if (!$('lq-caja') || V.arrastrando || !V.mapa) return;
    try {
      const par = PARES.find((p) => p.id === _par) || PARES[0];
      const nuevas = await traerVelas(par.s, _tf, 3);
      if (!nuevas.length) return;

      /* [CORREGIDO] El precio salía desfasado unos céntimos porque se
         usaba el cierre de la vela en curso, que solo cambia cuando
         llega una vela nueva. El precio de VERDAD es el último operado,
         y ese lo da otro punto de la API. */
      try {
        const rp = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${par.s}`);
        const jp = await rp.json();
        const px = Number(jp.price);
        if (px > 0) {
          const u = nuevas[nuevas.length - 1];
          u.c = px;
          if (px > u.h) u.h = px;
          if (px < u.l) u.l = px;
        }
      } catch (_) {}

      let cambio = false;
      nuevas.forEach((nv) => {
        const i = V.velas.findIndex((x) => x.t === nv.t);
        if (i >= 0) { V.velas[i] = nv; cambio = true; }
        else if (nv.t > V.velas[V.velas.length - 1].t) { V.velas.push(nv); cambio = true; }
      });
      if (!cambio) return;

      if (V.velas.length > 520) V.velas = V.velas.slice(-500);
      const m2 = construirMapa(V.velas);
      // Solo se sustituye si el mapa nuevo es válido
      if (m2 && idVivo === _cargaId) { V.mapa = m2; dibujar(); }
    } catch (_) {}
  }, 3000);   // 3 s: el precio tiene que verse moverse
}

/* ══════════════════════════════════════════════════════════════
   DATOS — velas de Binance, que es pública y no pide clave
   ══════════════════════════════════════════════════════════════ */
async function traerVelas(simbolo, tf, n = 300) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${simbolo}&interval=${tf}&limit=${n}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('sin datos');
  const j = await r.json();
  return j.map((x) => ({
    t: Math.floor(x[0] / 1000),
    o: Number(x[1]), h: Number(x[2]), l: Number(x[3]), c: Number(x[4]),
    v: Number(x[5])
  }));
}

/* ══════════════════════════════════════════════════════════════
   ABRIR
   ══════════════════════════════════════════════════════════════ */
/** ¿Tiene esta wallet la suscripción al día? */
/* Wallet del OWNER (en minúsculas). Mientras esté vacío, seguimos en modo
   desarrollo (todos entran, como hasta ahora). Cuando pongas tu dirección aquí,
   solo TÚ entras directo a las herramientas; los demás verán los planes. */
const OWNER = '';

async function tieneAccesoPro() {
  const cuenta = ((wallet.cuentaActual && wallet.cuentaActual()) || '').toLowerCase();
  if (OWNER && cuenta === OWNER.toLowerCase()) return { ok: true, owner: true };
  // Sin OWNER definido: modo desarrollo (comportamiento actual).
  if (!OWNER && !PRO) return { ok: true, prueba: true };
  // OWNER definido pero aún sin contrato: los que no son owner ven los planes.
  if (!PRO) return { ok: false, sinPlan: true };
  try {
    if (!cuenta) return { ok: false, sinWallet: true };
    const prov = await wallet.proveedor();
    const c = new ethers.Contract(PRO, ABI_PRO, prov);
    const [hasta, quedan] = await c.estadoDe(cuenta);
    return { ok: Number(quedan) > 0, hasta: Number(hasta), quedan: Number(quedan) };
  } catch (_) {
    /* Si la blockchain no responde NO se cierra la puerta: sería
       injusto dejar fuera a quien ya pagó por un fallo de red. */
    return { ok: true, sinComprobar: true };
  }
}

/* ══════════════════════════════════════════════════════════════
   PORTADA DE LIQUIDITY

   Al entrar no se abre nada: se muestran los tres servicios y, debajo,
   los planes de acceso. Así el menú principal queda limpio (un solo
   botón) y el usuario ve de un vistazo qué hay y cuánto cuesta.
   ══════════════════════════════════════════════════════════════ */
const SERVICIOS = [
  {
    id: 'pools',
    nombre: 'Liquidity Pools',
    lema: 'Dónde está el dinero atrapado',
    desc: 'El mapa de liquidaciones: los precios donde hay posiciones esperando a ser barridas. El precio va a buscarlas.',
    img: 'assets/img/serv-pools.webp',
    listo: true
  },
  {
    id: 'libro',
    nombre: 'Heat Pools',
    lema: 'Vea lo que hacen los grandes',
    desc: 'El libro de órdenes miente: la mayoría de las órdenes grandes son falsas. Vigilamos cada una y le decimos cuáles tienen dinero real detrás.',
    img: 'assets/img/serv-libro.webp',
    listo: true
  },
  {
    id: 'tercero',
    nombre: 'Smart Levels',
    lema: 'Dónde comprar y dónde vender',
    desc: 'Analiza la estructura del mercado y dibuja los niveles exactos de entrada y salida sobre la gráfica, explicándole por qué en cada momento.',
    img: 'assets/img/serv-tres.webp',
    listo: true
  }
];

const PLANES_PRO = [
  { id: 0, nombre: 'Una semana', dias: 7,  usd: 3,  etiqueta: 'para probarlo',  destacado: false },
  { id: 1, nombre: 'Un mes',     dias: 30, usd: 10, etiqueta: 'sale a cuenta',  destacado: false },
  { id: 2, nombre: 'Tres meses', dias: 90, usd: 20, etiqueta: 'recomendado',    destacado: true  }
];

export async function abrirLiquidity(par) {
  if (par) _par = par;
  estilos();
  portada();
}

/** La pantalla que se ve al entrar: servicios arriba, planes abajo. */
async function portada() {
  const prev = $('lqp-overlay'); if (prev) prev.remove();

  const acc = await tieneAccesoPro();

  const d = document.createElement('div');
  d.id = 'lqp-overlay';
  d.innerHTML = `<div class="lq-bg"></div>
    <div class="lqp-c">
      <button class="lqp-x" id="lqp-x" aria-label="Cerrar">✕</button>

      <div class="lqp-eyebrow">Herramientas Pro</div>
      <h2 class="lqp-t">Análisis profesional</h2>
      <p class="lqp-s">Tres herramientas para ver lo que el gráfico esconde</p>

      ${acc.ok && !acc.prueba ? `<div class="lqp-activo">
        <b>Tu acceso está activo</b>
        ${acc.quedan ? 'Te quedan ' + Math.ceil(acc.quedan / 86400) + ' días.' : ''}
      </div>` : ''}

      <div class="lqp-servs">
        ${SERVICIOS.map((sv) => `
          <button class="lqp-serv ${sv.listo ? '' : 'pronto'}" data-serv="${sv.id}" ${sv.listo ? '' : 'disabled'}>
            <div class="lqp-img" data-img="${esc(sv.img)}">
              <span class="lqp-ini">${esc(sv.nombre[0])}</span>
            </div>
            <div class="lqp-nom">${esc(sv.nombre)}</div>
            <div class="lqp-lema">${esc(sv.lema)}</div>
            ${sv.listo ? '<span class="lqp-abrir">Abrir</span>' : '<span class="lqp-pronto">Próximamente</span>'}
          </button>`).join('')}
      </div>

      <div class="lqp-sep"><span>Acceso a las tres</span></div>

      <div class="lqp-planes">
        ${PLANES_PRO.map((p) => {
          // Cuánto costaría ese mismo tiempo pagando por semanas
          const semanas = p.dias / 7;
          const suelto = semanas * 3;
          const ahorro = Math.max(0, Math.round((suelto - p.usd) / suelto * 100));
          return `
          <div class="lqp-plan ${p.destacado ? 'top' : ''}">
            ${p.destacado ? '<div class="lqp-badge">Recomendado</div>' : ''}
            <div class="lqp-plan-n">${p.nombre}</div>
            <div class="lqp-precio"><b>${p.usd}</b><span>USD</span></div>
            ${ahorro > 4
              ? `<div class="lqp-ahorro">ahorras un ${ahorro}%</div>`
              : `<div class="lqp-ahorro-x">${p.etiqueta}</div>`}
            <button class="lqp-b" data-plan="${p.id}">Suscribirme</button>
            <div class="lqp-dias">${p.dias} días</div>
          </div>`;
        }).join('')}
      </div>

      <div class="lqp-pago">Se paga en <b>BNB</b> o <b>USDT</b> desde tu wallet. Si renuevas antes de que caduque, los días que te quedan se suman.</div>
    </div>`;
  document.body.appendChild(d);

  const cerrar = () => { const e = $('lqp-overlay'); if (e) e.remove(); };
  d.querySelector('.lq-bg').onclick = cerrar;
  $('lqp-x').onclick = cerrar;

  // Las imágenes se ponen si existen; si no, queda la inicial y su color
  d.querySelectorAll('[data-img]').forEach((el) => {
    const img = new Image();
    img.onload = () => { el.style.backgroundImage = `url(${el.dataset.img})`; el.classList.add('con'); };
    img.src = el.dataset.img;
  });

  d.querySelectorAll('[data-serv]').forEach((b) => b.onclick = async () => {
    if (b._abriendo) return;            // evita que 70 clics apilen la apertura mientras se verifica el acceso
    b._abriendo = true;
    setTimeout(() => { b._abriendo = false; }, 2500);
    const sv = SERVICIOS.find((x) => x.id === b.dataset.serv);
    if (!sv || !sv.listo) { b._abriendo = false; return; }
    const a = await tieneAccesoPro();
    if (!a.ok) {
      // No es owner / no tiene plan: mostramos los planes de suscripción.
      d.classList.add('lqp-verplanes');
      const pl = d.querySelector('.lqp-planes') || d.querySelector('.lqp-sep');
      if (pl) pl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    /* [CORREGIDO] Antes se destruía la portada, así que al cerrar la
       herramienta se salía de Liquidity entero. Ahora solo se oculta
       y vuelve cuando el usuario cierra la herramienta. */
    window.__lqpVolver = () => {
      const p = $('lqp-overlay');
      if (p) p.style.display = '';
      else portada();
    };
    /* [CORREGIDO] El parpadeo: antes se ocultaba la portada ANTES de
       cargar el módulo, así que durante el `import` se veía por un
       instante la página inicial. Ahora la portada se oculta SOLO
       después de que el overlay de la herramienta ya está montado y la
       cubre: la transición es limpia, sin destello. */
    const ocultarPortada = () => { d.style.display = 'none'; };
    if (sv.id === 'pools') { abrirPools(); ocultarPortada(); return; }
    if (sv.id === 'libro') {
      try {
        const mu = await import('./muros.js?v=126');
        mu.abrirMuros(); ocultarPortada();
      } catch (er) { console.warn('[CCO] radar:', er); }
      return;
    }
    if (sv.id === 'tercero') {
      try {
        const sl = await import('./niveles.js?v=126');
        sl.abrirNiveles(); ocultarPortada();
      } catch (er) { console.warn('[CCO] niveles:', er); }
    }

  });

  d.querySelectorAll('[data-plan]').forEach((b) => b.onclick = () => comprarPro(Number(b.dataset.plan)));
}

/** Aviso al intentar entrar sin suscripción. */
function avisoSinAcceso() {
  const p = document.querySelector('.lqp-planes');
  if (!p) return;
  const prev = document.querySelector('.lqp-msg');
  if (prev) prev.remove();
  p.insertAdjacentHTML('beforebegin',
    '<div class="lqp-msg">Elige un plan para entrar a las herramientas.</div>');
  p.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** El mapa de liquidaciones. */
export async function abrirPools() {
  estilos();
  const prev = $('lq-overlay'); if (prev) prev.remove();

  const d = document.createElement('div');
  d.id = 'lq-overlay';
  d.innerHTML = `<div class="lq-bg"></div>
    <div class="lq-c">
      <!-- Todo en una sola barra, como TradingView: el gráfico manda. -->
      <div class="lq-barra">
        <!-- Moneda y temporalidad como desplegables: con 26 monedas
             una fila de botones no cabe en ningún sitio. -->
        <button class="lq-sel" id="lq-sel-par">
          <b>${_par}</b>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <button class="lq-sel" id="lq-sel-tf">
          <b>${(TFS.find((t) => t.id === _tf) || TFS[3]).n}</b>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="lq-grupo" title="Filtrar por apalancamiento">
          ${['todos', '10', '25', '50', '100'].map((a) =>
            `<button class="lq-b ${a === V.apal ? 'on' : ''}" data-apal="${a}">${a === 'todos' ? 'Todo' : 'x' + a}</button>`).join('')}
        </div>
        <div class="lq-grupo lq-slider">
          <span>Filtro</span>
          <input type="range" id="lq-int" min="55" max="260" value="55">
        </div>
        <!-- En el móvil, todo esto se recoge en un menú: en la barra
             solo quedan moneda, temporalidad, foto, ayuda y cerrar. -->
        <div class="lq-der">
          <button class="lq-ayuda solo-movil" id="lq-mas" title="Más opciones">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <button class="lq-ayuda" id="lq-foto" title="Guardar imagen">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.5"/></svg>
          </button>
          <button class="lq-ayuda" id="lq-cal" title="Calendario económico">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4M7.5 13h2M11 13h2M14.5 13h2"/></svg>
          </button>
          <button class="lq-ayuda apagado" id="lq-perfil" title="Perfil de volumen">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M21 6H9M21 11H5M21 16H12M21 21H8"/></svg>
          </button>
          <button class="lq-ayuda" id="lq-ver" title="Mostrar u ocultar el mapa">◉</button>
          <button class="lq-ayuda" id="lq-fit" title="Reencuadrar">⤢</button>
          <button class="lq-ayuda" id="lq-ayuda" title="Cómo funciona">?</button>
          <button class="lq-x" aria-label="Cerrar">✕</button>
        </div>
      </div>

      <div class="lq-caja" id="lq-caja">
        <div class="lq-cargando">Calculando el mapa de liquidaciones…</div>
      </div>

      <div class="lq-escala">
        <span>menos liquidez</span>
        <i class="lq-gr"></i>
        <span>muros de liquidación</span>
      </div>
    </div>`;
  document.body.appendChild(d);

  const cerrar = () => {
    cerrarMenus();
    clearInterval(_vivo);
    const e = $('lq-overlay'); if (e) e.remove();
    /* Al cerrar se vuelve a la portada de Liquidity, no se sale. */
    try { if (window.__lqpVolver) window.__lqpVolver(); } catch (_) {}
  };
  d.querySelector('.lq-bg').onclick = cerrar;
  d.querySelector('.lq-x').onclick = cerrar;

  $('lq-sel-par').onclick = (e) => { e.stopPropagation(); menuPares(); };
  $('lq-sel-tf').onclick  = (e) => { e.stopPropagation(); menuTfs(); };
  $('lq-ayuda').onclick = () => ayuda();

  // Filtro por apalancamiento: no recalcula nada, solo cambia qué suma.
  d.querySelectorAll('[data-apal]').forEach((b) => b.onclick = () => {
    V.apal = b.dataset.apal;
    d.querySelectorAll('[data-apal]').forEach((x) => x.classList.toggle('on', x.dataset.apal === V.apal));
    dibujar();
  });

  // Intensidad: realza las zonas débiles o deja solo las fuertes.
  $('lq-int').oninput = (e) => { V.intensidad = Number(e.target.value) / 100; dibujar(); };
  $('lq-int').value = Math.round(V.intensidad * 100);

  // Mostrar u ocultar el mapa, para ver las velas limpias.
  $('lq-ver').onclick = () => {
    V.verMapa = !V.verMapa;
    $('lq-ver').classList.toggle('apagado', !V.verMapa);
    dibujar();
  };

  $('lq-fit').onclick = () => encuadrar();
  /* El menú del móvil: recoge apalancamiento, filtro, perfil, mapa y
     reencuadrar. En la barra solo se quedan los controles del día a
     día, que es lo que cabe en un teléfono. */
  const bMas = $('lq-mas');
  if (bMas) bMas.onclick = (e) => {
    e.stopPropagation();
    const prev = document.getElementById('lq-mas-menu');
    if (prev) { prev.remove(); return; }

    const m = document.createElement('div');
    m.id = 'lq-mas-menu';
    m.className = 'lq-menu lq-mas-menu';
    m.innerHTML = `
      <div class="lqm-tit">Apalancamiento</div>
      <div class="lqm-fila">
        ${['todos', '10', '25', '50', '100'].map((a) =>
          `<button class="lqm-chip ${a === V.apal ? 'on' : ''}" data-mapal="${a}">${a === 'todos' ? 'Todo' : 'x' + a}</button>`).join('')}
      </div>

      <div class="lqm-tit">Filtro de ruido</div>
      <input type="range" class="lqm-range" id="lqm-int" min="55" max="260" value="${Math.round(V.intensidad * 100)}">

      <div class="lqm-tit">Mostrar</div>
      <button class="lqm-op" data-mtog="perfil">
        <span>Perfil de volumen</span><i class="${V.verPerfil ? 'on' : ''}"></i>
      </button>
      <button class="lqm-op" data-mtog="mapa">
        <span>Mapa de liquidez</span><i class="${V.verMapa ? 'on' : ''}"></i>
      </button>
      <button class="lqm-op" data-mtog="fit">
        <span>Reencuadrar</span>
      </button>`;
    document.body.appendChild(m);

    const r = bMas.getBoundingClientRect();
    m.style.top = (r.bottom + 6) + 'px';
    m.style.right = '10px';
    m.style.left = 'auto';

    m.addEventListener('click', (ev) => ev.stopPropagation());
    m.querySelectorAll('[data-mapal]').forEach((b) => b.onclick = () => {
      V.apal = b.dataset.mapal;
      m.querySelectorAll('[data-mapal]').forEach((x) => x.classList.toggle('on', x.dataset.mapal === V.apal));
      document.querySelectorAll('[data-apal]').forEach((x) => x.classList.toggle('on', x.dataset.apal === V.apal));
      dibujar();
    });
    m.querySelector('#lqm-int').oninput = (ev) => {
      V.intensidad = Number(ev.target.value) / 100;
      const otro = $('lq-int'); if (otro) otro.value = ev.target.value;
      dibujar();
    };
    m.querySelectorAll('[data-mtog]').forEach((b) => b.onclick = () => {
      const q = b.dataset.mtog;
      if (q === 'fit') { encuadrar(); m.remove(); return; }
      if (q === 'perfil') { V.verPerfil = !V.verPerfil; $('lq-perfil')?.classList.toggle('apagado', !V.verPerfil); }
      if (q === 'mapa') { V.verMapa = !V.verMapa; $('lq-ver')?.classList.toggle('apagado', !V.verMapa); }
      const i = b.querySelector('i');
      if (i) i.classList.toggle('on', q === 'perfil' ? V.verPerfil : V.verMapa);
      dibujar();
    });
    setTimeout(() => document.addEventListener('click', () => {
      const x = document.getElementById('lq-mas-menu'); if (x) x.remove();
    }, { once: true }), 10);
  };

  $('lq-perfil').onclick = () => {
    V.verPerfil = !V.verPerfil;
    $('lq-perfil').classList.toggle('apagado', !V.verPerfil);
    dibujar();
  };

  $('lq-foto').onclick = () => guardarImagen();
  { const bc = $('lq-cal'); if (bc) bc.onclick = () => { try { window.abrirCalendario && window.abrirCalendario(); } catch (_) {} }; }

  pintar();
  // Al girar el móvil o cambiar de tamaño, se vuelve a dibujar.
  let _t = null;
  window.addEventListener('resize', () => {
    clearTimeout(_t);
    _t = setTimeout(() => { if ($('lq-caja')) pintar(); }, 250);
  });
}

/* Cada carga lleva su número. Si el usuario cambia de temporalidad
   mientras una petición está en vuelo, la vieja se descarta al volver:
   así no puede pisar los datos de la nueva. */
let _cargaId = 0;

async function pintar() {
  const caja = $('lq-caja'); if (!caja) return;
  const miId = ++_cargaId;

  /* Se limpia el estado ANTES de pedir nada. Antes, si la carga fallaba,
     V.mapa se quedaba con los datos de la temporalidad anterior y el
     dibujo mezclaba las dos: el mapa desaparecía y solo quedaba la
     gráfica, que es justo lo que viste. */
  clearInterval(_vivo);
  V.mapa = null;
  V.velas = [];
  caja.innerHTML = `<div class="lq-cargando">Calculando zonas de liquidez…</div>`;

  try {
    const par = PARES.find((p) => p.id === _par) || PARES[0];
    const velas = await traerVelas(par.s, _tf, 500);
    if (miId !== _cargaId) return;              // llegó tarde: se descarta
    if (velas.length < 30) throw new Error('vacío');

    /* [CORREGIDO] El precio salía desfasado porque la última vela trae
       su cierre, que solo cambia cuando termina el periodo. El precio
       de verdad se pide aparte, y ahora YA AL ABRIR, no a los 4
       segundos. Es lo mismo que se ve en la tarjeta de los bots. */
    try {
      const rp = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${par.s}`);
      const jp = await rp.json();
      const px = Number(jp.price);
      if (px > 0) {
        const u = velas[velas.length - 1];
        u.c = px;
        if (px > u.h) u.h = px;
        if (px < u.l) u.l = px;
      }
    } catch (_) {}

    if (miId !== _cargaId) return;
    V.velas = velas;
    V.tfLargo = (_tf === '1d' || _tf === '4h');

    const mapa = construirMapa(velas);
    if (!mapa) throw new Error('pocos datos');
    if (miId !== _cargaId) return;
    V.mapa = mapa;

    encuadrar();
    arrancarVivo();
  } catch (_) {
    if (miId !== _cargaId) return;
    /* Con el estado limpio, un fallo deja un mensaje claro y un botón
       para reintentar. Nunca media pantalla con datos viejos. */
    V.mapa = null;
    caja.innerHTML = `<div class="lq-vacio">
      No se pudieron cargar los datos de ${esc(_par)} en ${esc(_tf)}.<br>
      Revisa tu conexión.
      <button class="lq-reintentar" id="lq-reintentar">Reintentar</button>
    </div>`;
    const b = $('lq-reintentar');
    if (b) b.onclick = () => pintar();
  }
}

/* ══════════════════════════════════════════════════════════════
   DIBUJO — el mapa de calor

   Gradiente de frío a caliente, como en las herramientas de pago:
   morado oscuro (poca liquidez) → azul → verde → amarillo → naranja
   → rojo → blanco (muros de liquidación).

   Se pinta en un canvas, no en SVG: son 33.000 celdas y el SVG no
   aguantaría eso sin ir a tirones.
   ══════════════════════════════════════════════════════════════ */

/** Paleta de calor. v va de 0 a 1. */
/* ══════════════════════════════════════════════════════════════
   LOS COLORES — POR ESCALONES, NO EN DEGRADADO

   Antes era un degradado continuo de 8 paradas: entre azul y verde
   salían turquesas, entre verde y amarillo salían limas… y el
   resultado era un revoltijo donde nada se distinguía.

   Ahora son SEIS escalones cerrados. Cada franja de intensidad tiene
   UN color, y punto:

     azul oscuro / azul / azul claro  → poca liquidez
     verde                            → media
     amarillo                         → alta
     naranja + rojo                   → los muros

   Y una regla que pediste y tiene sentido: el naranja SOLO aparece
   acompañando al rojo. Nunca suelto, porque solo sirve para dar
   gradación al muro, no para marcar nada por sí mismo.
   ══════════════════════════════════════════════════════════════ */
const ESCALONES = [
  { hasta: 0.20, c: [10, 36, 92] },     // azul oscuro
  { hasta: 0.40, c: [30, 74, 168] },    // azul
  { hasta: 0.58, c: [56, 130, 220] },   // azul claro
  { hasta: 0.76, c: [8, 190, 12] },     // VERDE
  { hasta: 0.89, c: [228, 229, 5] },    // AMARILLO
  { hasta: 0.96, c: [255, 132, 0] },    // naranja (solo junto al rojo)
  { hasta: 1.01, c: [255, 0, 0] }       // ROJO
];

function calor(v) {
  if (v <= 0) return null;
  const p = Math.max(0, Math.min(1, v));
  for (const e of ESCALONES) if (p <= e.hasta) return e.c;
  return ESCALONES[ESCALONES.length - 1].c;
}

function calorViejo(v) {
  if (v <= 0) return null;
  /* Curva 0,72 en vez de 0,42: antes casi todo saltaba a verde y
     amarillo y no había jerarquía. Ahora la base se queda en azul y
     solo lo que de verdad acumula llega a rojo. Es lo que hace legible
     el mapa: el ojo va directo a los muros. */
  /* Curva 0,52: con 0,62 el amarillo llegaba demasiado pronto y el
     rojo casi no aparecía. Ahora la mayoría se queda en azul y verde,
     y el rojo se reserva para los picos reales. */
  const p = Math.pow(v, 0.85);
  /* ══════════════════════════════════════════════════════════════
     PALETA — sacada píxel a píxel de la herramienta de referencia.

     Seis tonos PUROS y saturados, sin blanco ni morado ni naranja.
     El blanco no informaba de nada y encima ensuciaba el rojo, que es
     el color que de verdad tiene que gritar "aquí está el muro".

     El verde ocupa el tramo medio (es el dominante en su gráfico), el
     amarillo marca lo alto, y el rojo se reserva para lo máximo.
     ══════════════════════════════════════════════════════════════ */
  const paradas = [
    [0.00, [6, 30, 96]],      // azul profundo — poca liquidez
    [0.20, [34, 70, 167]],    // azul — base
    [0.38, [8, 150, 150]],    // turquesa
    [0.56, [8, 190, 12]],     // VERDE puro — el tono dominante
    [0.74, [140, 210, 8]],    // verde lima
    [0.86, [228, 229, 5]],    // AMARILLO puro — zona alta
    [0.92, [255, 120, 10]],   // naranja, transición corta
    [1.00, [255, 0, 0]]       // #FF0000 — ROJO ABSOLUTO: los muros
  ];
  for (let i = 1; i < paradas.length; i++) {
    if (p <= paradas[i][0]) {
      const [a, ca] = paradas[i - 1], [b, cb] = paradas[i];
      const t = (p - a) / Math.max(1e-9, b - a);
      return [
        Math.round(ca[0] + (cb[0] - ca[0]) * t),
        Math.round(ca[1] + (cb[1] - ca[1]) * t),
        Math.round(ca[2] + (cb[2] - ca[2]) * t)
      ];
    }
  }
  return paradas[paradas.length - 1][1];
}

/** Ajusta la escala vertical a lo que se ve, si está en automático. */
function ajustarY() {
  if (!V.autoY || !V.velas.length) return;
  const vis = V.velas.slice(V.desde, V.desde + V.ancho);
  if (!vis.length) return;
  const alto = Math.max(...vis.map((v) => v.h));
  const bajo = Math.min(...vis.map((v) => v.l));
  const m = (alto - bajo) * 0.28 || 1;
  V.yMax = alto + m;
  V.yMin = Math.max(0, bajo - m);
}

function dibujar() {
  const caja = $('lq-caja');
  // Sin mapa no se dibuja nada: evita mezclar datos de dos cargas.
  if (!caja || !V.mapa || !V.mapa.velas || !V.mapa.velas.length) return;

  const W = caja.clientWidth || 900;
  const H = caja.clientHeight || 500;
  if (W < 50 || H < 50) return;

  let cv = caja.querySelector('.lq-cv');
  if (!cv) {
    caja.innerHTML = `<canvas class="lq-cv"></canvas>
      <img class="lq-marca" src="assets/img/cco-marca.webp" alt="">`;
    cv = caja.querySelector('.lq-cv');
    engancharGestos(cv);
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr)) {
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  /* Órdenes desde el gráfico: clic derecho o toque largo. */
  if (!cv.dataset.ordenOk) {
    cv.dataset.ordenOk = '1';
    import('./orden.js?v=126').then((od) => {
      od.conectar({
        canvas: cv,
        precioEn: (yy) => {
          if (!V._geo) return 0;
          const { pMin, pMax, y1: h } = V._geo;
          return pMin + (pMax - pMin) * ((h - yy) / h);
        },
        precioActual: () => {
          const v = V.velas || [];
          return v.length ? v[v.length - 1].c : 0;
        },
        par: () => _par,
        simbolo: () => (PARES.find((p) => p.id === _par) || {}).s || '',
        repintar: () => dibujar()
      });
      _od = od;
      od.clicCancelar(cv, () => _zonasOd, () => dibujar());
      dibujar();
    }).catch(() => {});
  }

  const mDer = 56, mAba = 20;
  const x1 = W - mDer;                 // donde empieza la escala
  /* Las velas al 78%: el perfil de la derecha se ha quitado (estaba
     invertido y no aportaba), así que el gráfico recupera ese sitio.
     Queda un margen para ver hacia dónde apuntan los muros. */
  const xVelas = x1 * 0.78;
  const y1 = H - mAba;

  ajustarY();
  const { yMin, yMax } = V;
  const Y = (p) => y1 - y1 * ((p - yMin) / Math.max(1e-12, yMax - yMin));
  /* Se guarda para que el módulo de órdenes traduzca altura a precio. */
  V._geo = { pMin: yMin, pMax: yMax, y1 };

  /* Tus órdenes y alertas se dibujan AL FINAL de dibujar() (así no las tapa el
     fondo ni las velas). Aquí solo se deja el hueco. */

  g.fillStyle = '#0a0d12';
  g.fillRect(0, 0, W, H);

  const desde = Math.max(0, Math.floor(V.desde));
  const hasta = Math.min(V.mapa.velas.length, desde + V.ancho);
  const vis = V.mapa.velas.slice(desde, hasta);
  if (!vis.length) return;

  const paso = xVelas / V.ancho;
  const altoFila = y1 / FILAS;

  /* Zonas de alta liquidez (acumulación de muros rojos), para las
     tachuelas del perfil. Se rellenan con datos REALES del mapa. */
  let zonasLiq = [];

  /* ── EL MAPA DE CALOR ── */
  if (V.verMapa) {
    /* Los valores ya vienen normalizados de 0 a 1 desde columnaDe(),
       con cada capa en su escala. No hay que volver a normalizar. */
    /* El máximo de lo VISIBLE, no el global. Con el global, al hacer
       zoom sobre una zona tranquila todo quedaba del mismo color. */
    /* El máximo se toma de la BASE, sin el refuerzo. Si se incluyera,
       el propio refuerzo subiría el techo y se anularía a sí mismo:
       por eso los picos nunca llegaban a rojo. */
    /* El techo del color se toma de la MEDIANA alta de la base, no del
       máximo. Con el máximo, una sola celda enorme aplastaba todas las
       demás y nada llegaba a rojo. Con este techo, las celdas reforzadas
       superan el 1 y se van al rojo, que es lo que se busca. */
    const cols = [];
    const muestras = [];
    for (let c = desde; c < hasta; c++) {
      cols.push(columnaDe(V.mapa, c));
      const base = columnaDe(V.mapa, c, true);
      for (const v of base) if (v > 0) muestras.push(v);
    }
    muestras.sort((a, b) => a - b);
    const max = muestras.length
      ? muestras[Math.floor(muestras.length * 0.985)] || muestras[muestras.length - 1]
      : 1;
    if (max > 0) {
      const fMin = Math.max(0, Math.floor((yMin - V.mapa.yMin) / V.mapa.alturaFila));
      const fMax = Math.min(FILAS, Math.ceil((yMax - V.mapa.yMin) / V.mapa.alturaFila));

      /* ══════════════════════════════════════════════════════════
         CELDAS, NO BARRAS

         Antes se pintaban franjas que cruzaban toda la pantalla y
         quedaba una masa de color sin lectura. Ahora cada celda es un
         cuadrito con su hueco alrededor, como en las herramientas de
         referencia: se ve la rejilla y cada zona se distingue.

         Y el mapa TERMINA donde terminan las velas. Solo la última
         columna se prolonga un poco: son las zonas que siguen vivas.
         ══════════════════════════════════════════════════════════ */
      const hueco = paso > 6 ? 1 : 0.35;        // separación entre celdas
      const huecoV = altoFila > 5 ? 0.9 : 0.25;

      /* ══════════════════════════════════════════════════════════
         MAPA DE CALOR LIMPIO (sin tocar los rojos)

         El "collage" venía de colorear cada celda por su valor CRUDO:
         como la acumulación es picuda, salían celdas sueltas verdes o
         amarillas entre azules, y despuntes de color en los bordes de
         una línea roja. Aquí los tonos INTERMEDIOS (azul→amarillo) se
         colorean por un valor SUAVIZADO (promedio de su entorno), así
         forman zonas coherentes en vez de ruido. El ROJO real (los muros
         confirmados) se colorea por su valor crudo, intacto: ni se mueve
         ni se apaga. */
      const ROJO_DESDE = 0.96;
      const suave = (i, f) => {
        let s = 0, w = 0;
        for (let di = -1; di <= 1; di++) {
          const cc = cols[i + di]; if (!cc) continue;
          for (let df = -2; df <= 2; df++) {
            const ff = f + df; if (ff < 0 || ff >= FILAS) continue;
            const wt = (3 - Math.abs(df)) * (di === 0 ? 2 : 1);
            s += cc[ff] * wt; w += wt;
          }
        }
        return w ? s / w : 0;
      };

      cols.forEach((col, i) => {
        const x = i * paso;
        /* El mapa TERMINA donde terminan las velas. Antes la última
           columna se estiraba hasta la escala y se comía la zona del
           perfil de liquidez, que es lo que dejaba el gráfico saturado
           por la derecha. */
        const ancho = Math.max(1, paso - hueco);

        for (let f = fMin; f < fMax; f++) {
          const v = col[f];
          if (v <= 0) continue;
          const rel = Math.min(1, v / max);
          const umbral = 0.03 + (V.intensidad - 0.55) * 0.30;
          let relC;
          if (rel >= ROJO_DESDE) {
            relC = rel;                          // muro real: color crudo, intacto
          } else {
            // tono intermedio: color por el promedio del entorno, sin
            // permitir que un suavizado se cuele al rojo
            relC = Math.min(0.95, Math.min(1, suave(i, f) / max));
          }
          if (relC < umbral) continue;
          const rgb = calor(relC);
          if (!rgb) continue;
          const pF = V.mapa.yMin + f * V.mapa.alturaFila;
          const y = Y(pF + V.mapa.alturaFila);
          const h = Math.max(1, Y(pF) - y - huecoV);
          g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
          g.fillRect(x, y, ancho, h);
        }
      });

      /* ══════════════════════════════════════════════════════════
         ZONAS DE ALTA LIQUIDEZ (datos reales del mapa)

         Se busca dónde se ACUMULAN varios muros rojos: filas de precio
         que salen en ROJO a lo largo de muchas columnas (tiempo). Donde
         eso pasa hay una pared de liquidez real, y el precio suele
         reaccionar al llegar. Se agrupan las filas rojas contiguas en
         zonas y se guardan las más fuertes para marcarlas con tachuela. */
      const redCount = new Float32Array(FILAS);
      for (const col of cols) {
        for (let f = fMin; f < fMax; f++) {
          if (col[f] / max >= ROJO_DESDE) redCount[f]++;
        }
      }
      const minCols = Math.max(2, Math.floor((hasta - desde) * 0.10)); // rojo en ≥10% del tiempo
      let f = fMin;
      while (f < fMax) {
        if (redCount[f] >= minCols) {
          let f0 = f, fuerza = 0, filas = 0;
          while (f < fMax && redCount[f] >= minCols * 0.6) { fuerza += redCount[f]; filas++; f++; }
          const fc = (f0 + f - 1) / 2;
          const precio = V.mapa.yMin + (fc + 0.5) * V.mapa.alturaFila;
          const pLow = V.mapa.yMin + f0 * V.mapa.alturaFila;
          const pHigh = V.mapa.yMin + f * V.mapa.alturaFila;
          zonasLiq.push({ precio, pLow, pHigh, fuerza, filas });
        } else f++;
      }
      // las más fuertes primero; nos quedamos con unas pocas separadas
      zonasLiq.sort((a, b) => b.fuerza - a.fuerza);
      const elegidas = [];
      for (const z of zonasLiq) {
        if (elegidas.length >= 4) break;
        if (elegidas.every((e) => Math.abs(Y(e.precio) - Y(z.precio)) > 30)) elegidas.push(z);
      }
      zonasLiq = elegidas;
    }
  }

  /* ── LAS VELAS, con los colores de siempre ── */
  const VERDE = '#26a69a', ROJO = '#ef5350';
  const cuerpo = Math.max(1, paso * 0.68);
  vis.forEach((v, i) => {
    const x = i * paso + paso / 2;
    const col = v.c >= v.o ? VERDE : ROJO;
    g.strokeStyle = col; g.fillStyle = col;
    g.lineWidth = Math.max(0.8, paso * 0.12);
    g.beginPath(); g.moveTo(x, Y(v.h)); g.lineTo(x, Y(v.l)); g.stroke();
    const yA = Y(Math.max(v.o, v.c)), yB = Y(Math.min(v.o, v.c));
    g.fillRect(x - cuerpo / 2, yA, cuerpo, Math.max(1.2, yB - yA));
  });

  /* ── LA LÍNEA DEL PRECIO, de borde a borde ── */
  const ult = V.mapa.velas[V.mapa.velas.length - 1];
  const yU = Y(ult.c);
  if (yU > 0 && yU < y1) {
    g.strokeStyle = 'rgba(232,184,75,.8)';
    g.setLineDash([5, 4]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, yU); g.lineTo(x1, yU); g.stroke();
    g.setLineDash([]);
  }

  /* ══════════════════════════════════════════════════════════════
     PERFIL DE VOLUMEN — como debe ser

     Nace en el borde derecho y crece HACIA LA IZQUIERDA. Es así en
     todas las plataformas serias: el eje de referencia es la escala de
     precios, y las barras se alejan de ella.

     Y no invade las velas: vive en el 22% que queda libre a la derecha.
     ══════════════════════════════════════════════════════════════ */
  if (V.verPerfil) {
    /* ══════════════════════════════════════════════════════════════
       PERFIL DE VOLUMEN — con información de verdad

       Antes eran barras grises sin criterio. Ahora dice tres cosas
       que un trader usa a diario:

       · COMPRA vs VENTA. Cada barra se parte en dos: verde el volumen
         que entró con velas alcistas, rojo el de las bajistas. De un
         vistazo se ve quién manda a cada precio.

       · EL PUNTO DE CONTROL (POC). El precio donde más se negoció.
         Va en dorado y con su línea: es el imán del rango.

       · EL ÁREA DE VALOR. Donde ocurrió el 70% del negocio. Fuera de
         ella el precio suele moverse rápido; dentro, se atasca.
       ══════════════════════════════════════════════════════════════ */
    const FP = 74;
    const compras = new Float64Array(FP);
    const ventas = new Float64Array(FP);
    const altoP = (yMax - yMin) / FP;

    vis.forEach((v) => {
      const f1 = Math.max(0, Math.floor((v.l - yMin) / altoP));
      const f2 = Math.min(FP - 1, Math.floor((v.h - yMin) / altoP));
      const n = Math.max(1, f2 - f1 + 1);
      // La vela reparte su volumen, y se apunta de qué lado vino
      const sube = v.c >= v.o;
      for (let f = f1; f <= f2; f++) {
        if (sube) compras[f] += v.v / n; else ventas[f] += v.v / n;
      }
    });

    const total = new Float64Array(FP);
    let pocMax = 0, pocIdx = 0, suma = 0;
    for (let f = 0; f < FP; f++) {
      total[f] = compras[f] + ventas[f];
      suma += total[f];
      if (total[f] > pocMax) { pocMax = total[f]; pocIdx = f; }
    }

    if (pocMax > 0) {
      /* El área de valor: se crece desde el POC hacia los lados
         tomando siempre la franja más gruesa, hasta juntar el 70%. */
      let acum = total[pocIdx], arriba = pocIdx, abajo = pocIdx;
      const meta = suma * 0.70;
      while (acum < meta && (abajo > 0 || arriba < FP - 1)) {
        const vA = arriba < FP - 1 ? total[arriba + 1] : -1;
        const vB = abajo > 0 ? total[abajo - 1] : -1;
        if (vA >= vB) { arriba++; acum += Math.max(0, vA); }
        else { abajo--; acum += Math.max(0, vB); }
      }

      const xBorde = x1 - 3;
      const anchoMax = (x1 - xVelas) * 0.90;

      // El fondo del área de valor, muy sutil
      const yVA1 = Y(yMin + (arriba + 1) * altoP), yVA2 = Y(yMin + abajo * altoP);
      g.fillStyle = 'rgba(232,184,75,.045)';
      g.fillRect(xVelas + 4, yVA1, x1 - xVelas - 4, yVA2 - yVA1);

      for (let f = 0; f < FP; f++) {
        if (total[f] <= 0) continue;
        const p1 = yMin + f * altoP;
        const yA = Y(p1 + altoP), yB = Y(p1);
        if (yB < -10 || yA > y1 + 10) continue;
        const h = Math.max(1.5, yB - yA - 1);
        const w = anchoMax * (total[f] / pocMax);
        const dentroVA = f >= abajo && f <= arriba;

        if (f === pocIdx) {
          // El punto de control: dorado y entero
          g.fillStyle = 'rgba(240,200,90,.98)';
          g.fillRect(xBorde - w, yA, w, h);
        } else {
          // Compra y venta, cada una su trozo — colores vivos, no apagados
          const wC = w * (compras[f] / Math.max(1e-9, total[f]));
          const wV = w - wC;
          const op = dentroVA ? 0.95 : 0.6;
          g.fillStyle = `rgba(46,232,106,${op})`;      // verde vivo: compras
          g.fillRect(xBorde - wC, yA, wC, h);
          g.fillStyle = `rgba(255,70,90,${op})`;       // rojo vivo: ventas
          g.fillRect(xBorde - w, yA, wV, h);
        }
      }

      // La línea del POC, cruzando el gráfico
      const pPoc = yMin + (pocIdx + 0.5) * altoP;
      const yPoc = Y(pPoc);
      if (yPoc > 0 && yPoc < y1) {
        g.strokeStyle = 'rgba(232,184,75,.55)';
        g.setLineDash([3, 4]); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(0, yPoc); g.lineTo(x1, yPoc); g.stroke();
        g.setLineDash([]);
        g.font = 'bold 9px ui-monospace,monospace';
        g.fillStyle = 'rgba(232,184,75,.9)';
        g.textAlign = 'left';
        g.fillText('POC', xVelas + 8, yPoc - 4);
      }

      // Los bordes del área de valor
      [[yVA1, 'VAH'], [yVA2, 'VAL']].forEach(([yy, et]) => {
        if (yy < 0 || yy > y1) return;
        g.strokeStyle = 'rgba(232,184,75,.22)';
        g.setLineDash([2, 5]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(xVelas + 4, yy); g.lineTo(x1, yy); g.stroke();
        g.setLineDash([]);
        g.font = '8px ui-monospace,monospace';
        g.fillStyle = 'rgba(232,184,75,.5)';
        g.fillText(et, xVelas + 8, yy - 3);
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════
     TACHUELAS DE ALTA LIQUIDEZ

     En la banda del perfil (donde acaban las barras), una tachuelita con
     bordes redondeados y una colita de globo abajo-izquierda marca cada
     zona donde se acumulan muros rojos. Lleva un puntico latente y una
     flecha que apunta al nivel. Al tocar el desplegable, explica que ahí
     hay alta probabilidad de reacción y muestra DATOS REALES: cuántos
     muros se acumulan y el volumen realmente negociado en ese nivel,
     partido en compra y venta. Nada de placeholders.
     ══════════════════════════════════════════════════════════════ */
  V.tachuelas = [];
  V.tachCerrar = null; V.tachPanel = null;
  /* Las tachuelas se ESCONDEN cuando el perfil de volumen está activo
     (comparten la misma banda derecha) y reaparecen al apagarlo. */
  if (zonasLiq.length && !V.verPerfil) {
    const fmtVol = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B'
      : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
      : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n).toString();
    const precioAhora = ult.c;
    let carta = null;   // la tarjeta abierta se dibuja al final, encima de todo

    zonasLiq.forEach((z, idx) => {
      const yN = Y(z.precio);
      if (yN < 8 || yN > y1 - 10) return;
      // volumen REAL negociado dentro de la zona, partido compra/venta
      let volC = 0, volV = 0;
      for (const v of vis) {
        if (v.h >= z.pLow && v.l <= z.pHigh) { if (v.c >= v.o) volC += v.v; else volV += v.v; }
      }

      /* Color por posición: las de DEBAJO del precio (soportes) en VERDE,
         las de ENCIMA (resistencias) en ROJO. Colores vivos. */
      const alcista = z.precio < precioAhora;
      const col = alcista ? '#2ee86a' : '#ff3b52';
      const cRGB = alcista ? '46,232,106' : '255,59,82';

      const w = 84, h = 20, r = 7;
      // Pegadas al ÁREA que señalan (lado izq. de la banda). Ya NO llevan
      // guía punteada ni flecha.
      const x = Math.max(6, Math.min(x1 - w - 4, xVelas + 8));
      const y = Math.max(4, Math.min(y1 - h - 6, yN - h / 2));

      // cuerpo redondeado, fondo oscuro
      g.fillStyle = 'rgba(13,17,24,.94)';
      redondeadoLq(g, x, y, w, h, r); g.fill();

      /* RESPLANDOR INTERNO (hacia adentro, no hacia afuera): un trazo
         grueso del color, recortado al cuerpo, deja un halo suave pegado
         al borde por dentro. Nada de brillos hacia fuera. */
      g.save();
      redondeadoLq(g, x, y, w, h, r); g.clip();
      g.strokeStyle = `rgba(${cRGB},.5)`; g.lineWidth = 6;
      g.shadowColor = `rgba(${cRGB},.75)`; g.shadowBlur = 6;
      redondeadoLq(g, x, y, w, h, r); g.stroke();
      g.restore();

      // borde nítido encima
      g.strokeStyle = col; g.lineWidth = 1.4;
      redondeadoLq(g, x, y, w, h, r); g.stroke();

      // puntico latente (dot + anillo) del color de la tachuela
      const dx = x + 12, dy = y + h / 2;
      g.fillStyle = col; g.beginPath(); g.arc(dx, dy, 2.8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(${cRGB},.5)`; g.lineWidth = 1.3;
      g.beginPath(); g.arc(dx, dy, 5.6, 0, Math.PI * 2); g.stroke();

      // precio
      g.fillStyle = '#eef1f4'; g.font = 'bold 9.5px ui-monospace,monospace'; g.textAlign = 'left';
      g.fillText(fmt(z.precio), x + 22, y + h / 2 + 3.3);

      // chevron desplegable, del MISMO color de la tachuela
      const abierta = V.tachAbierta === idx;
      const cx = x + w - 11, cy = y + h / 2;
      g.strokeStyle = col; g.lineWidth = 1.7; g.lineCap = 'round';
      g.beginPath();
      if (abierta) { g.moveTo(cx - 3.5, cy + 2); g.lineTo(cx, cy - 2); g.lineTo(cx + 3.5, cy + 2); }
      else { g.moveTo(cx - 3.5, cy - 2); g.lineTo(cx, cy + 2); g.lineTo(cx + 3.5, cy - 2); }
      g.stroke(); g.lineCap = 'butt';

      V.tachuelas.push({ x, y, w, h, idx });

      // Si está abierta, guardamos sus datos para pintarla AL FINAL (así la
      // tarjeta queda por encima de las demás tachuelas, no debajo).
      if (abierta) carta = { z, idx, alcista, col, cRGB, volC, volV, x, y, h };
    });

    // ── TARJETA DESPLEGABLE (encima de todo) ──
    if (carta) {
      const { z, alcista, col, cRGB, volC, volV } = carta;
      const fmtV = fmtVol;
      const volT = volC + volV || 1;
      const pctC = Math.round((volC / volT) * 100);
      const pctV = 100 - pctC;
      const dist = ((z.precio - precioAhora) / precioAhora) * 100;
      const signo = dist >= 0 ? '+' : '';

      const pw = Math.min(236, x1 - 12);
      const ph = 188;
      const px = Math.max(6, Math.min(x1 - pw - 6, carta.x));
      let py = carta.y + carta.h + 8;
      if (py + ph > y1 - 4) py = Math.max(4, carta.y - ph - 8);

      // sombra + cuerpo
      g.save();
      g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
      g.fillStyle = 'rgba(17,21,28,.995)';
      redondeadoLq(g, px, py, pw, ph, 14); g.fill();
      g.restore();

      // recorte al cuerpo (nada se desborda)
      g.save();
      redondeadoLq(g, px, py, pw, ph, 14); g.clip();

      // ── CABECERA con degradado del color del rol ──
      const hb = 28;
      const gh = g.createLinearGradient(px, py, px, py + hb);
      gh.addColorStop(0, `rgba(${cRGB},.30)`);
      gh.addColorStop(1, `rgba(${cRGB},.05)`);
      g.fillStyle = gh; g.fillRect(px, py, pw, hb);
      g.strokeStyle = `rgba(${cRGB},.45)`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(px, py + hb + .5); g.lineTo(px + pw, py + hb + .5); g.stroke();

      const tx = px + 13;
      g.textAlign = 'left';
      g.fillStyle = col; g.font = 'bold 10.5px ui-monospace,monospace';
      g.fillText(alcista ? '\u25b2 SOPORTE \u00b7 DEMANDA'
                         : '\u25bc RESISTENCIA \u00b7 OFERTA', tx, py + 18);

      // ── PRECIO (hero) + píldora de distancia al precio actual ──
      g.fillStyle = '#f2f5f8'; g.font = 'bold 16px ui-monospace,monospace';
      g.fillText(fmt(z.precio), tx, py + hb + 22);
      g.font = 'bold 9px ui-monospace,monospace';
      const dtxt = signo + dist.toFixed(2) + '%';
      const dpw = g.measureText(dtxt).width + 16;
      const dpx = px + pw - dpw - 12, dpy = py + hb + 8;
      g.fillStyle = `rgba(${cRGB},.16)`; redondeadoLq(g, dpx, dpy, dpw, 17, 8); g.fill();
      g.strokeStyle = `rgba(${cRGB},.5)`; g.lineWidth = 1; redondeadoLq(g, dpx, dpy, dpw, 17, 8); g.stroke();
      g.fillStyle = col; g.textAlign = 'center';
      g.fillText(dtxt, dpx + dpw / 2, dpy + 12);
      g.textAlign = 'left';

      // ── RANGO de la zona (izq) + medidor de FUERZA en puntos (der) ──
      g.fillStyle = '#8b95a1'; g.font = '9px ui-monospace,monospace'; g.textAlign = 'left';
      const rango = (z.pLow && z.pHigh && Math.abs(z.pHigh - z.pLow) > 1e-9)
        ? 'Zona ' + fmt(z.pLow) + '\u2013' + fmt(z.pHigh)
        : 'Muro de liquidez';
      g.fillText(rango, tx, py + hb + 40);
      const nf = Math.max(1, Math.min(5, z.filas || 1));   // fuerza = nº de muros (1..5)
      const dgap = 7, dr = 2.3, dyC = py + hb + 37, dxEnd = px + pw - 14;
      for (let i = 0; i < 5; i++) {
        g.beginPath(); g.arc(dxEnd - (4 - i) * dgap, dyC, dr, 0, Math.PI * 2);
        g.fillStyle = i < nf ? col : 'rgba(255,255,255,.18)'; g.fill();
      }

      // ── QUÉ ES (lógica correcta: encima=venta/oferta, debajo=compra/demanda) ──
      g.fillStyle = '#c8d0d8'; g.font = '9.5px ui-monospace,monospace';
      if (alcista) {
        g.fillText('Compra acumulada DEBAJO del precio.', tx, py + hb + 58);
        g.fillText('Piso que sostiene las ca\u00eddas.', tx, py + hb + 71);
      } else {
        g.fillText('Venta acumulada ENCIMA del precio.', tx, py + hb + 58);
        g.fillText('Techo que frena las subidas.', tx, py + hb + 71);
      }

      // ── FLUJO en la zona, con % (velas verdes vs rojas que pasaron por ella).
      //    Si la zona NO tuvo actividad (volC=volV=0) no inventamos nada: barra
      //    neutra y aviso honesto, en vez de pintarla toda roja. ──
      const sinFlujo = (volC + volV) <= 0;
      g.fillStyle = '#8b95a1'; g.font = '8.5px ui-monospace,monospace'; g.textAlign = 'left';
      g.fillText('Flujo en la zona', tx, py + hb + 90);
      if (!sinFlujo) { g.textAlign = 'right'; g.fillText('Total ' + fmtV(volT), px + pw - 13, py + hb + 90); g.textAlign = 'left'; }
      const bx = tx, by = py + hb + 96, bw = pw - 26, bh = 10;
      g.save(); redondeadoLq(g, bx, by, bw, bh, 5); g.clip();
      if (sinFlujo) {
        g.fillStyle = 'rgba(150,160,172,.30)'; g.fillRect(bx, by, bw, bh);
      } else {
        const wc = Math.max(0, Math.min(bw, bw * (volC / volT)));
        g.fillStyle = 'rgba(46,232,106,.95)'; g.fillRect(bx, by, wc, bh);
        g.fillStyle = 'rgba(255,70,90,.95)'; g.fillRect(bx + wc, by, bw - wc, bh);
      }
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1; redondeadoLq(g, bx, by, bw, bh, 5); g.stroke();
      if (sinFlujo) {
        g.fillStyle = '#8b95a1'; g.font = '8.5px ui-monospace,monospace'; g.textAlign = 'center';
        g.fillText('Sin actividad reciente en la zona', bx + bw / 2, by + bh + 13);
        g.textAlign = 'left';
      } else {
        g.font = 'bold 8.5px ui-monospace,monospace';
        g.fillStyle = '#2ee86a'; g.textAlign = 'left';
        g.fillText('\u25b2 ' + fmtV(volC) + '  ' + pctC + '%', bx, by + bh + 13);
        g.fillStyle = '#ff6b7a'; g.textAlign = 'right';
        g.fillText(pctV + '%  ' + fmtV(volV) + ' \u25bc', bx + bw, by + bh + 13);
        g.textAlign = 'left';
      }

      /* ── CHIP de lectura. Correcta para SPOT (aquí no hay cortos): en una
         resistencia, si predominó la COMPRA es que compraron caro y el precio
         los dejó abajo → oferta al recuperar ("atrapados arriba"). En un
         soporte, si predominó la VENTA pero el piso aguantó → esa venta fue
         ABSORBIDA por la demanda (no "vendedor atrapado", que en spot no
         existe). Sin dominio claro = zona en disputa. Sin flujo = solo un
         nivel de liquidez. Nada de frases vacías. ── */
      let dom;
      if (sinFlujo) {
        dom = [alcista ? 'Piso de liquidez' : 'Techo de liquidez', '150,160,172'];
      } else if (!alcista) {                 // RESISTENCIA (techo · oferta)
        dom = volV > volC * 1.25 ? ['Oferta firme: techo s\u00f3lido', '255,107,122']
            : volC > volV * 1.25 ? ['Compradores atrapados arriba', '245,183,74']
            : ['Techo en disputa', '196,204,212'];
      } else {                               // SOPORTE (piso · demanda)
        dom = volC > volV * 1.25 ? ['Demanda firme: piso s\u00f3lido', '46,232,106']
            : volV > volC * 1.25 ? ['Ventas absorbidas: piso probado', '245,183,74']
            : ['Piso en disputa', '196,204,212'];
      }
      const chy = py + ph - 26, chh = 18, chx = px + 10, chw = pw - 20;
      g.fillStyle = `rgba(${dom[1]},.14)`; redondeadoLq(g, chx, chy, chw, chh, 7); g.fill();
      g.strokeStyle = `rgba(${dom[1]},.42)`; g.lineWidth = 1; redondeadoLq(g, chx, chy, chw, chh, 7); g.stroke();
      g.fillStyle = `rgb(${dom[1]})`;
      g.beginPath(); g.arc(chx + 11, chy + chh / 2, 2.6, 0, Math.PI * 2); g.fill();
      g.font = 'bold 9px ui-monospace,monospace'; g.textAlign = 'left';
      g.fillText(dom[0], chx + 19, chy + chh / 2 + 3.2);

      g.restore();   // fin recorte

      // ── X para cerrar (en la cabecera) ──
      const xw = 15, xx = px + pw - xw - 8, xy = py + 7;
      g.strokeStyle = 'rgba(220,226,232,.85)'; g.lineWidth = 1.5; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(xx + 3, xy + 3); g.lineTo(xx + xw - 3, xy + xw - 3);
      g.moveTo(xx + xw - 3, xy + 3); g.lineTo(xx + 3, xy + xw - 3);
      g.stroke(); g.lineCap = 'butt';

      V.tachCerrar = { x: xx - 5, y: xy - 5, w: xw + 10, h: xw + 10 };
      V.tachPanel = { x: px, y: py, w: pw, h: ph };
    }
  }

  /* ── LA ESCALA DE PRECIOS ── */
  g.fillStyle = '#0b0e12';
  g.fillRect(x1, 0, mDer, H);
  g.strokeStyle = 'rgba(255,255,255,.07)';
  g.beginPath(); g.moveTo(x1 + .5, 0); g.lineTo(x1 + .5, H); g.stroke();
  g.font = '10px ui-monospace,monospace';
  g.textAlign = 'left';
  for (let i = 0; i <= 8; i++) {
    const p = yMin + (yMax - yMin) * (i / 8);
    const y = Y(p);
    g.strokeStyle = 'rgba(255,255,255,.05)';
    g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke();
    g.fillStyle = '#6b7681';
    g.fillText(fmt(p), x1 + 6, y + 3.5);
  }
  if (yU > 0 && yU < y1) {
    g.fillStyle = '#E8B84B';
    g.fillRect(x1 + 1, yU - 9, mDer - 3, 18);
    g.fillStyle = '#3a2800';
    g.font = 'bold 11px ui-monospace,monospace';
    g.fillText(fmt(ult.c), x1 + 6, yU + 4);
    /* El par, junto al precio. Si alguien cambió de moneda y no se dio
       cuenta, aquí lo ve: evita pensar que el precio está mal cuando
       lo que pasa es que se está mirando otra cripto. */
    g.font = '8px ui-monospace,monospace';
    g.fillStyle = 'rgba(58,40,0,.75)';
    g.fillText(_par, x1 + 6, yU + 13);
  }

  /* ── LAS FECHAS, abajo ── */
  g.fillStyle = '#0b0e12';
  g.fillRect(0, y1, W, mAba);
  g.font = '9px ui-monospace,monospace';
  g.fillStyle = '#6b7681';
  const cada = Math.max(1, Math.floor(vis.length / 6));
  vis.forEach((v, i) => {
    if (i % cada !== 0) return;
    const x = i * paso + paso / 2;
    if (x > xVelas) return;
    const d = new Date(v.t * 1000);
    const et = V.tfLargo
      ? d.toLocaleDateString('es', { day: '2-digit', month: 'short' })
      : d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    g.textAlign = 'center';
    g.fillText(et, x, y1 + 13);
  });
  g.textAlign = 'left';

  /* ══════════════════════════════════════════════════════════════
     LOS DIBUJOS DEL USUARIO

     Se guardan en precio y tiempo, así que al hacer zoom o arrastrar
     se mueven CON el gráfico. Es lo que distingue una herramienta de
     análisis de un simple dibujo encima.
     ══════════════════════════════════════════════════════════════ */
  const Xt = (t) => {
    const i = V.mapa.velas.findIndex((v) => v.t >= t);
    const idx = i < 0 ? V.mapa.velas.length - 1 : i;
    return (idx - desde) * paso + paso / 2;
  };

  const pintarDibujo = (d, enCurso) => {
    const op = enCurso ? 0.65 : 1;
    if (d.tipo === 'horizontal') {
      const y = Y(d.p1);
      if (y < -20 || y > y1 + 20) return;
      g.strokeStyle = `rgba(77,159,255,${op})`;
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke();
      g.fillStyle = '#4d9fff';
      g.fillRect(x1 + 1, y - 8, mDer - 3, 16);
      g.fillStyle = '#04121f';
      g.font = 'bold 10px ui-monospace,monospace';
      g.textAlign = 'left';
      g.fillText(fmt(d.p1), x1 + 6, y + 3.5);
      return;
    }

    const xa = Xt(d.t1), xb = Xt(d.t2);
    const ya = Y(d.p1), yb = Y(d.p2);

    if (d.tipo === 'linea') {
      g.strokeStyle = `rgba(77,159,255,${op})`;
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(xa, ya); g.lineTo(xb, yb); g.stroke();
      if (!enCurso) {
        g.fillStyle = '#4d9fff';
        [[xa, ya], [xb, yb]].forEach(([px, py]) => {
          g.beginPath(); g.arc(px, py, 3.5, 0, Math.PI * 2); g.fill();
        });
      }
      return;
    }

    if (d.tipo === 'fibo') {
      const alto = d.p2 - d.p1;
      const izq = Math.min(xa, xb), der = Math.max(xa, xb);
      const cols = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#787b86'];
      FIBO.forEach((niv, i) => {
        const p = d.p1 + alto * niv;
        const y = Y(p);
        if (y < -20 || y > y1 + 20) return;
        g.strokeStyle = cols[i] + (enCurso ? '99' : 'dd');
        g.lineWidth = (niv === 0.618 || niv === 0.5) ? 1.6 : 1;
        g.beginPath(); g.moveTo(izq, y); g.lineTo(Math.max(der, x1), y); g.stroke();
        g.fillStyle = cols[i];
        g.font = '9px ui-monospace,monospace';
        g.textAlign = 'left';
        g.fillText(`${(niv * 100).toFixed(1)}%  ${fmt(p)}`, izq + 5, y - 3);
      });
    }
  };

  V.dibujos.forEach((d) => pintarDibujo(d, false));
  if (V.enCurso) pintarDibujo(V.enCurso, true);

  /* ══════════════════════════════════════════════════════════════
     LA CRUZ — precio y hora bajo el puntero
     ══════════════════════════════════════════════════════════════ */
  if (V.cruzX >= 0 && V.cruzX < x1 && V.cruzY >= 0 && V.cruzY < y1) {
    g.strokeStyle = 'rgba(255,255,255,.28)';
    g.setLineDash([3, 3]); g.lineWidth = 1;
    g.beginPath();
    g.moveTo(V.cruzX, 0); g.lineTo(V.cruzX, y1);
    g.moveTo(0, V.cruzY); g.lineTo(x1, V.cruzY);
    g.stroke();
    g.setLineDash([]);

    // El precio, en la escala
    const pCruz = yMin + (yMax - yMin) * ((y1 - V.cruzY) / y1);
    g.fillStyle = '#2b3139';
    g.fillRect(x1 + 1, V.cruzY - 9, mDer - 3, 18);
    g.fillStyle = '#eaecef';
    g.font = 'bold 10px ui-monospace,monospace';
    g.textAlign = 'left';
    g.fillText(fmt(pCruz), x1 + 6, V.cruzY + 4);

    // La hora, abajo
    const iv = Math.floor(V.cruzX / paso);
    if (iv >= 0 && iv < vis.length) {
      const d = new Date(vis[iv].t * 1000);
      const et = d.toLocaleDateString('es', { day: '2-digit', month: 'short' }) + ' ' +
                 d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      g.font = '9px ui-monospace,monospace';
      const w = g.measureText(et).width + 14;
      g.fillStyle = '#2b3139';
      g.fillRect(Math.min(x1 - w, Math.max(0, V.cruzX - w / 2)), y1 + 2, w, 16);
      g.fillStyle = '#eaecef';
      g.textAlign = 'center';
      g.fillText(et, Math.min(x1 - w / 2, Math.max(w / 2, V.cruzX)), y1 + 13);
      g.textAlign = 'left';
    }
  }

  /* ── Tus órdenes y alertas (clic derecho): AL FINAL, encima de todo ── */
  if (_od) {
    _zonasOd = _od.pintar(g, {
      x1, Y, pMin: yMin, pMax: yMax,
      simbolo: (PARES.find((p) => p.id === _par) || {}).s || ''
    });
  }

}

/* ══════════════════════════════════════════════════════════════
   GESTOS — arrastrar y zoom

   El mapa NO se recalcula al mover: se vuelve a pintar con las
   coordenadas nuevas. Por eso queda pegado a las velas siempre.
   ══════════════════════════════════════════════════════════════ */
function engancharGestos(cv) {
  const total = () => V.mapa ? V.mapa.velas.length : 0;

  const mover = (dx, dy) => {
    const W = cv.clientWidth || 900;
    const paso = (W * 0.70) / V.ancho;
    const velasMovidas = dx / Math.max(0.5, paso);
    /* [CORREGIDO] El tope de "total - 20" cortaba el gráfico al llegar
       a la derecha. Ahora se puede seguir hasta dejar las velas atrás,
       que es lo normal en cualquier gráfico de trading: así se ve el
       espacio de proyección hacia delante. */
    const topeDer = total() - Math.round(V.ancho * 0.25);
    V.desde = Math.max(-V.ancho * 0.15, Math.min(topeDer, V.desde - velasMovidas));
    if (dy !== 0) {
      // Mover en vertical desactiva el ajuste automático
      V.autoY = false;
      const H = cv.clientHeight || 500;
      const rango = V.yMax - V.yMin;
      const d = (dy / H) * rango;
      V.yMin += d; V.yMax += d;
    }
    dibujar();
  };

  const zoom = (factor, centroX) => {
    const W = cv.clientWidth || 900;
    const rel = Math.max(0, Math.min(1, centroX / (W * 0.70)));
    const anclaje = V.desde + V.ancho * rel;
    V.ancho = Math.max(25, Math.min(total(), Math.round(V.ancho * factor)));
    const topeDer = total() - Math.round(V.ancho * 0.25);
    V.desde = Math.max(-V.ancho * 0.15, Math.min(topeDer, anclaje - V.ancho * rel));
    V.autoY = true;
    dibujar();
  };

  /* Traduce un punto de la pantalla a precio y tiempo. Guardar así
     los dibujos es lo que hace que se peguen al gráfico. */
  const aDatos = (px, py) => {
    const W = cv.clientWidth || 900, H = cv.clientHeight || 500;
    const x1 = W - 56, y1 = H - 20;
    const paso = (x1 * 0.70) / V.ancho;
    const i = Math.max(0, Math.min(V.mapa.velas.length - 1,
      Math.round(V.desde + px / Math.max(0.5, paso))));
    return {
      t: V.mapa.velas[i].t,
      p: V.yMin + (V.yMax - V.yMin) * ((y1 - py) / y1)
    };
  };

  // ── Ratón ──
  cv.addEventListener('mousedown', (e) => {
    const r = cv.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;

    // ¿Se tocó una tachuela de liquidez? Abre/cierra su desplegable.
    if (clicTachuela(px, py)) return;

    // Si hay una herramienta activa, se dibuja en vez de arrastrar.
    if (V.herramienta) {
      const d = aDatos(px, py);
      if (V.herramienta === 'horizontal') {
        V.dibujos.push({ tipo: 'horizontal', p1: d.p });
        V.herramienta = null;
        marcarHerramienta();
        dibujar();
        return;
      }
      V.enCurso = { tipo: V.herramienta, t1: d.t, p1: d.p, t2: d.t, p2: d.p };
      return;
    }

    V.arrastrando = true; V.x0 = e.clientX; V.y0 = e.clientY;
    cv.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', (e) => {
    if (V.enCurso) {
      const r = cv.getBoundingClientRect();
      const d = aDatos(e.clientX - r.left, e.clientY - r.top);
      V.enCurso.t2 = d.t; V.enCurso.p2 = d.p;
      dibujar();
      return;
    }
    if (!V.arrastrando) return;
    mover(e.clientX - V.x0, e.clientY - V.y0);
    V.x0 = e.clientX; V.y0 = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    if (V.enCurso) {
      // Un clic sin arrastrar no cuenta como línea
      const movido = V.enCurso.t1 !== V.enCurso.t2 || V.enCurso.p1 !== V.enCurso.p2;
      if (movido) V.dibujos.push(V.enCurso);
      V.enCurso = null;
      V.herramienta = null;
      marcarHerramienta();
      dibujar();
      return;
    }
    V.arrastrando = false;
    cv.style.cursor = V.herramienta ? 'crosshair' : 'grab';
  });
  // La cruz sigue al puntero. Se redibuja solo si de verdad se movió.
  cv.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect();
    const nx = Math.round(e.clientX - r.left), ny = Math.round(e.clientY - r.top);
    if (nx === V.cruzX && ny === V.cruzY) return;
    V.cruzX = nx; V.cruzY = ny;
    if (!V.arrastrando) dibujar();
  });
  cv.addEventListener('mouseleave', () => { V.cruzX = -1; V.cruzY = -1; dibujar(); });

  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    zoom(e.deltaY > 0 ? 1.14 : 0.88, e.clientX - r.left);
  }, { passive: false });

  // ── Táctil: un dedo mueve, dos dedos hacen zoom ──
  let d0 = 0;
  cv.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const r = cv.getBoundingClientRect();
      if (clicTachuela(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top)) return;
      V.arrastrando = true;
      V.x0 = e.touches[0].clientX; V.y0 = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      V.arrastrando = false;
      d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                      e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });

  cv.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && V.arrastrando) {
      e.preventDefault();
      mover(e.touches[0].clientX - V.x0, e.touches[0].clientY - V.y0);
      V.x0 = e.touches[0].clientX; V.y0 = e.touches[0].clientY;
    } else if (e.touches.length === 2 && d0 > 0) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                           e.touches[0].clientY - e.touches[1].clientY);
      if (Math.abs(d - d0) > 6) {
        const r = cv.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
        zoom(d0 / d, cx);
        d0 = d;
      }
    }
  }, { passive: false });

  cv.addEventListener('touchend', () => { V.arrastrando = false; d0 = 0; });

  // Doble toque o doble clic: volver al encuadre inicial
  cv.addEventListener('dblclick', () => encuadrar());
  cv.style.cursor = 'grab';
}


/** Elegir moneda y pagar. */
function comprarPro(plan) {
  const p = PLANES_PRO.find((x) => x.id === plan) || PLANES_PRO[0];
  const prev = document.querySelector('.lqp-msg');
  if (prev) prev.remove();

  const zona = document.querySelector('.lqp-planes');
  if (!zona) return;

  zona.insertAdjacentHTML('beforebegin', `
    <div class="lqp-msg" id="lqp-pago">
      <b>${p.nombre} · ${p.usd} USD</b>
      ¿Con qué quieres pagar?
      <div class="lqp-mon">
        <button data-pago="bnb">BNB</button>
        <button data-pago="usdt">USDT</button>
      </div>
    </div>`);

  document.querySelectorAll('[data-pago]').forEach((b) => b.onclick = () => pagar(plan, b.dataset.pago));
}

async function pagar(plan, moneda) {
  const caja = $('lqp-pago'); if (!caja) return;
  const decir = (t) => { caja.innerHTML = `<b>Pago</b>${t}`; };

  if (!PRO) {
    decir('El cobro todavía no está activo. Estás en fase de pruebas: puedes usar las herramientas libremente.');
    return;
  }
  try {
    decir('Confirma en tu wallet…');
    const firm = await wallet.firmante();
    const c = new ethers.Contract(PRO, ABI_PRO, firm);

    if (moneda === 'bnb') {
      const coste = await c.costeEnBnb(plan);
      const tx = await c.comprarConBnb(plan, { value: coste });
      await tx.wait();
    } else {
      /* Con USDT hacen falta dos firmas: primero el permiso por la
         cantidad exacta, después el pago. Se avisa para que nadie se
         extrañe de que la wallet pregunte dos veces. */
      const coste = await c.costeEnUsdt(plan);
      const USDT = '0x55d398326f99059fF775485246999027B3197955';
      const erc = new ethers.Contract(USDT, ['function approve(address,uint256) returns (bool)'], firm);
      decir('Primera firma: dar permiso por la cantidad exacta…');
      await (await erc.approve(PRO, coste)).wait();
      decir('Segunda firma: el pago…');
      await (await c.comprarConUsdt(plan)).wait();
    }
    decir('¡Listo! Ya tienes acceso.');
    setTimeout(() => portada(), 1200);
  } catch (err) {
    const m = String(err?.shortMessage || err?.reason || err?.message || err);
    decir(/reject|denied/i.test(m) ? 'Cancelaste la firma.' : 'No se pudo completar el pago. Inténtalo de nuevo.');
  }
}

/* ══════════════════════════════════════════════════════════════
   DESPLEGABLES
   Con 26 monedas y 9 temporalidades, las filas de botones no caben.
   Un desplegable con buscador es más rápido y ocupa nada.
   ══════════════════════════════════════════════════════════════ */
function cerrarMenus() {
  document.querySelectorAll('.lq-menu').forEach((x) => x.remove());
}

function abrirMenu(anclaje, html, alSeleccionar, conBuscador) {
  cerrarMenus();
  const r = anclaje.getBoundingClientRect();
  const m = document.createElement('div');
  m.className = 'lq-menu';
  m.innerHTML = (conBuscador
    ? `<input class="lq-buscar" id="lq-buscar" placeholder="Buscar…" autocomplete="off">`
    : '') + `<div class="lq-menu-lista">${html}</div>`;
  document.body.appendChild(m);

  // Se coloca bajo el botón, pero sin salirse de la pantalla
  const ancho = m.offsetWidth || 220;
  m.style.left = Math.max(8, Math.min(window.innerWidth - ancho - 8, r.left)) + 'px';
  m.style.top = (r.bottom + 6) + 'px';
  const alto = m.offsetHeight;
  if (r.bottom + 6 + alto > window.innerHeight - 8) {
    m.style.maxHeight = (window.innerHeight - r.bottom - 18) + 'px';
  }

  m.addEventListener('click', (e) => e.stopPropagation());
  m.querySelectorAll('[data-val]').forEach((b) => b.onclick = () => {
    alSeleccionar(b.dataset.val);
    cerrarMenus();
  });

  const bus = m.querySelector('#lq-buscar');
  if (bus) {
    bus.oninput = () => {
      const q = bus.value.toLowerCase().trim();
      m.querySelectorAll('[data-val]').forEach((x) => {
        x.style.display = !q || x.dataset.busca.includes(q) ? '' : 'none';
      });
    };
    setTimeout(() => { try { bus.focus(); } catch (_) {} }, 60);
  }
  setTimeout(() => document.addEventListener('click', cerrarMenus, { once: true }), 10);
}

/* ══════════════════════════════════════════════════════════════
   LOGOS DE LAS MONEDAS
   Vienen de CoinGecko y se guardan un día en el navegador. Si no
   llegan, queda la inicial: nunca un hueco vacío.
   ══════════════════════════════════════════════════════════════ */
const CLAVE_LOGOS_LQ = 'aurex-logos';
let _logosLq = null;

async function ponerLogosLq() {
  if (!_logosLq) {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_LOGOS_LQ) || 'null');
      if (g && Date.now() - g.cuando < 86400000) _logosLq = g.datos;
    } catch (_) {}
  }
  if (!_logosLq) {
    try {
      const ids = PARES.map((p) => p.cg).filter(Boolean).join(',');
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=250`);
      const j = await r.json();
      _logosLq = {};
      j.forEach((x) => { _logosLq[x.id] = x.image; });
      try { localStorage.setItem(CLAVE_LOGOS_LQ, JSON.stringify({ cuando: Date.now(), datos: _logosLq })); } catch (_) {}
    } catch (_) { _logosLq = {}; }
  }
  document.querySelectorAll('.lq-logo[data-cg]').forEach((el) => {
    const url = _logosLq && _logosLq[el.dataset.cg];
    if (url) { el.style.backgroundImage = `url(${url})`; el.classList.add('con'); }
  });
}

function menuPares() {
  const html = PARES.map((p) => `
    <button data-val="${p.id}" data-busca="${(p.id + ' ' + p.n).toLowerCase()}"
            class="lq-op ${p.id === _par ? 'on' : ''}">
      <i class="lq-logo" data-cg="${esc(p.cg || '')}"></i>
      <b>${p.id}</b><span>${esc(p.n)}</span>
      ${p.id === _par ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="m20 6-11 11-5-5"/></svg>' : ''}
    </button>`).join('');
  setTimeout(ponerLogosLq, 40);
  abrirMenu($('lq-sel-par'), html, (v) => {
    _par = v;
    /* Una ficha de otra moneda no puede quedarse abierta. */
    try { if (_od && _od.cerrarFichas) _od.cerrarFichas(); } catch (_) {}
    const b = $('lq-sel-par').querySelector('b');
    if (b) b.textContent = v;
    V.dibujos = [];          // los dibujos son de la moneda anterior
    pintar();
  }, true);
}

function menuTfs() {
  const html = TFS.map((t) => `
    <button data-val="${t.id}" data-busca="${t.n.toLowerCase()}"
            class="lq-op ${t.id === _tf ? 'on' : ''}">
      <b>${t.id}</b><span>${esc(t.n)}</span>
      ${t.id === _tf ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="m20 6-11 11-5-5"/></svg>' : ''}
    </button>`).join('');
  abrirMenu($('lq-sel-tf'), html, (v) => {
    _tf = v;
    const b = $('lq-sel-tf').querySelector('b');
    if (b) b.textContent = (TFS.find((t) => t.id === v) || {}).n || v;
    V.dibujos = [];
    pintar();
  }, false);
}

/* ══════════════════════════════════════════════════════════════
   GUARDAR IMAGEN

   Se copia el gráfico a un lienzo nuevo y se le añade NUESTRA marca:
   el nombre y el par abajo. Así, cuando alguien comparte su análisis,
   va firmado. Es publicidad que se reparte sola.
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   GUARDAR IMAGEN

   La imagen que se comparte lleva su propia franja de marca abajo:
   el logo grande y nítido, y a su derecha los dos textos en dorado.

   IMPORTANTE: la marca de agua de la interfaz NO sale aquí. Son dos
   cosas distintas, y duplicarlas quedaría mal. Por eso se oculta
   mientras se hace la captura y se devuelve después.
   ══════════════════════════════════════════════════════════════ */
function guardarImagen() {
  const cv = document.querySelector('.lq-cv');
  if (!cv) return;

  // Fuera la marca de la interfaz durante la captura
  const marca = document.querySelector('.lq-marca');
  const antes = marca ? marca.style.display : null;
  if (marca) marca.style.display = 'none';
  const devolver = () => { if (marca) marca.style.display = antes || ''; };

  try {
    const esc2 = cv.width / cv.clientWidth;
    const barra = 78 * esc2;
    const out = document.createElement('canvas');
    out.width = cv.width;
    out.height = cv.height + barra;
    const g = out.getContext('2d');

    g.fillStyle = '#0a0d12';
    g.fillRect(0, 0, out.width, out.height);
    g.drawImage(cv, 0, 0);

    const yB = cv.height;
    g.fillStyle = '#0b0e12';
    g.fillRect(0, yB, out.width, barra);
    g.fillStyle = 'rgba(232,184,75,.35)';
    g.fillRect(0, yB, out.width, 2 * esc2);

    /* Los textos y la fecha se pintan siempre; el logo se añade cuando
       carga. Si tardara o fallara, la imagen sale igual con su marca
       de texto: nunca se queda el usuario sin su captura. */
    const pintarTextos = (xTexto) => {
      g.textAlign = 'left';
      g.fillStyle = '#E8B84B';
      g.font = `800 ${19 * esc2}px system-ui,sans-serif`;
      g.fillText('Mapa de Liquidaciones', xTexto, yB + 34 * esc2);

      g.font = `700 ${14 * esc2}px ui-monospace,monospace`;
      g.fillStyle = '#C9A84B';
      g.fillText('CriptoCubaOficial.com', xTexto, yB + 56 * esc2);

      // A la derecha, el par y la fecha
      g.textAlign = 'right';
      g.fillStyle = '#8b96a3';
      g.font = `700 ${14 * esc2}px ui-monospace,monospace`;
      g.fillText(`${_par} · ${_tf}`, out.width - 20 * esc2, yB + 34 * esc2);
      g.font = `${11 * esc2}px ui-monospace,monospace`;
      g.fillStyle = '#6b7681';
      g.fillText(new Date().toLocaleString('es',
        { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        out.width - 20 * esc2, yB + 56 * esc2);
      g.textAlign = 'left';
    };

    const bajar = () => out.toBlob((blob) => {
      devolver();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `criptocuba-${_par}-${_tf}-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');

    const logo = new Image();
    let hecho = false;
    const una = (conLogo) => {
      if (hecho) return; hecho = true;
      pintarTextos(conLogo ? 20 * esc2 + conLogo + 18 * esc2 : 20 * esc2);
      bajar();
    };
    logo.onload = () => {
      try {
        // Nítido y grande: es la firma de la imagen
        const alto = 52 * esc2;
        const ancho = Math.round(logo.width * (alto / logo.height));
        g.drawImage(logo, 20 * esc2, yB + (barra - alto) / 2, ancho, alto);
        una(ancho);
      } catch (_) { una(0); }
    };
    logo.onerror = () => una(0);
    setTimeout(() => una(0), 1500);
    logo.src = 'assets/img/cco-marca.png';
  } catch (_) { devolver(); }
}

/** Refleja en los botones qué herramienta está activa. */
function marcarHerramienta() {
  document.querySelectorAll('[data-tool-lq]').forEach((b) => {
    b.classList.toggle('on', b.dataset.toolLq === V.herramienta);
  });
  const cv = document.querySelector('.lq-cv');
  if (cv) cv.style.cursor = V.herramienta ? 'crosshair' : 'grab';
}

/** Deja la vista en su posición natural: lo último, a la derecha. */
function encuadrar() {
  const n = V.mapa ? V.mapa.velas.length : 0;
  V.ancho = Math.min(n, window.innerWidth < 700 ? 90 : 150);
  V.desde = Math.max(0, n - V.ancho);
  V.autoY = true;
  dibujar();
}

const fmt = (p) => {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(6);
};

function redondeadoLq(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* ¿El punto (px,py) cayó sobre una tachuela, su X de cierre o su
   tarjeta? Actúa en consecuencia y devuelve true si consumió el toque. */
function clicTachuela(px, py) {
  const dentro = (b) => b && px >= b.x - 4 && px <= b.x + b.w + 4 && py >= b.y - 4 && py <= b.y + b.h + 4;
  // 1) la X cierra la tarjeta
  if (dentro(V.tachCerrar)) { V.tachAbierta = null; dibujar(); return true; }
  // 2) tocar dentro de la tarjeta no hace nada (no arrastra ni cierra)
  if (dentro(V.tachPanel)) return true;
  // 3) tocar una tachuela abre/cierra su tarjeta
  for (const b of (V.tachuelas || [])) {
    if (dentro(b)) { V.tachAbierta = (V.tachAbierta === b.idx) ? null : b.idx; dibujar(); return true; }
  }
  // 4) tocar fuera cierra cualquier tarjeta abierta
  if (V.tachAbierta != null) { V.tachAbierta = null; dibujar(); }
  return false;
}

/** Qué significa cada cosa. */
/* ══════════════════════════════════════════════════════════════
   LA GUÍA — dos partes

   1. CÓMO OPERAR CON ESTO. Lo primero que ve el usuario: qué hacer
      con la información, no qué significan los colores.
   2. CÓMO SE LEE EL MAPA. La referencia técnica, para consultar.

   El orden importa: quien paga por una herramienta quiere saber cómo
   sacarle partido, no un glosario.
   ══════════════════════════════════════════════════════════════ */
function ayuda() {
  const d = document.createElement('div');
  d.id = 'lq-ayuda-box';
  d.innerHTML = `<div class="lq-bg"></div>
    <div class="lqa-c">
      <button class="lqa-x" id="lqa-x" aria-label="Cerrar">✕</button>

      <div class="lqa-tabs">
        <button class="lqa-tab on" data-gtab="operar">Cómo operar con esto</button>
        <button class="lqa-tab" data-gtab="leer">Cómo se lee el mapa</button>
      </div>

      <div class="lqa-pane on" id="gp-operar">
        <div class="lqa-intro">
          Lo que tienes delante es <b>el mapa de dónde está el dinero atrapado</b>.
          Esos niveles no son opiniones ni predicciones: son posiciones reales
          esperando a ser cerradas. Y el precio tiende a ir a buscarlas.
        </div>

        <div class="lqa-p">
          <b>1 · Los muros rojos son imanes</b>
          Donde el mapa se pone rojo hay una concentración de posiciones que se
          liquidarían a ese precio. Cuando el mercado se acerca, esas
          liquidaciones se disparan en cadena y <b>aceleran el movimiento</b>
          en esa dirección.
          <i>Qué hacer: si estás dentro y ves un muro rojo cerca en tu contra, ese es un buen sitio para tener cuidado. Si estás fuera, es donde el precio suele ir antes de girar.</i>
        </div>

        <div class="lqa-p">
          <b>2 · El precio va a por la liquidez, no a por tu análisis</b>
          Un techo con muchas órdenes acumuladas encima raramente se respeta
          para siempre. El mercado suele <b>barrer esa zona</b>, recoger las
          liquidaciones, y solo entonces decidir hacia dónde va.
          <i>Qué hacer: desconfía de las rupturas justo antes de un muro. Muchas veces es el barrido, no el movimiento de verdad.</i>
        </div>

        <div class="lqa-p">
          <b>3 · Las zonas vacías se cruzan rápido</b>
          Donde el mapa está oscuro no hay nada que frene al precio. Son
          tramos que el mercado <b>atraviesa en minutos</b>.
          <i>Qué hacer: si tu objetivo está al otro lado de una zona vacía, es alcanzable. Si está detrás de un muro rojo, cuesta mucho más.</i>
        </div>

        <div class="lqa-p">
          <b>4 · Cambia el apalancamiento para ver quién sostiene</b>
          El filtro x10 muestra dónde están las posiciones más conservadoras;
          x100, las más agresivas. <b>Las de x100 saltan primero</b> y son las
          que provocan los movimientos bruscos.
          <i>Qué hacer: si el x100 muestra un muro cerca del precio, espera volatilidad pronto.</i>
        </div>

        <div class="lqa-p">
          <b>5 · Súbelo de temporalidad para ver el cuadro grande</b>
          En 15 minutos ves lo que va a pasar hoy. En diario, dónde está el
          dinero de verdad. <b>Los niveles del diario mandan sobre los del
          intradía.</b>
          <i>Qué hacer: mira primero en 4h o diario para saber hacia dónde sopla el viento, y luego baja a buscar tu entrada.</i>
        </div>

        <div class="lqa-aviso">
          Esto es <b>información, no una señal</b>. No te decimos cuándo comprar
          ni cuándo vender: te enseñamos dónde está la liquidez para que decidas
          tú con más contexto del que tenías antes.
        </div>
      </div>

      <div class="lqa-pane" id="gp-leer">
        <div class="lqa-p">
          <b>De dónde salen estos datos</b>
          Por cada vela se estima qué posiciones se abrieron y con cuánto
          apalancamiento. Con eso se calcula a qué precio saltaría cada una, y
          todo se acumula en el mapa. Cuando el precio toca un nivel, esas
          posiciones <b>ya se liquidaron</b> y desaparecen: por eso el mapa se
          va consumiendo por donde pasa el precio.
        </div>

        <div class="lqa-p">
          <b>Los colores</b>
          <span class="lqa-col"><i style="background:rgb(34,70,167)"></i>Azul — liquidez de fondo</span>
          <span class="lqa-col"><i style="background:rgb(8,190,12)"></i>Verde — acumulación media</span>
          <span class="lqa-col"><i style="background:rgb(228,229,5)"></i>Amarillo — zona importante</span>
          <span class="lqa-col"><i style="background:rgb(255,0,0)"></i>Rojo — <b>zona de liquidación</b></span>
        </div>

        <div class="lqa-p">
          <b>El perfil de volumen</b>
          A la derecha, cuánto se negoció a cada precio.
          <span class="lqa-col"><i style="background:rgb(38,166,154)"></i>Verde — volumen comprador</span>
          <span class="lqa-col"><i style="background:rgb(239,83,80)"></i>Rojo — volumen vendedor</span>
          <span class="lqa-col"><i style="background:rgb(232,184,75)"></i>Dorado (POC) — donde más se negoció</span>
          <b>VAH</b> y <b>VAL</b> marcan el área de valor: donde ocurrió el 70%
          del negocio. Dentro, el precio se atasca; fuera, corre.
        </div>

        <div class="lqa-p">
          <b>El filtro de ruido</b>
          Súbelo para quedarte solo con las zonas fuertes. Bájalo para ver el
          mapa completo. No cambia los datos: cambia cuánto se muestra.
        </div>

        <div class="lqa-aviso">
          Son <b>estimaciones</b> a partir de precio y volumen público. Ningún
          exchange publica su motor de liquidación: ninguna herramienta del
          mercado, ni la más cara, tiene ese dato.
        </div>
      </div>

      <button class="lqa-b" id="lqa-cerrar">Entendido</button>
    </div>`;
  document.body.appendChild(d);

  const q = () => d.remove();
  d.querySelector('.lq-bg').onclick = q;
  $('lqa-x').onclick = q;
  $('lqa-cerrar').onclick = q;

  d.querySelectorAll('[data-gtab]').forEach((b) => b.onclick = () => {
    d.querySelectorAll('.lqa-tab').forEach((x) => x.classList.toggle('on', x === b));
    d.querySelectorAll('.lqa-pane').forEach((p) => p.classList.remove('on'));
    const p = $('gp-' + b.dataset.gtab);
    if (p) p.classList.add('on');
    d.querySelector('.lqa-c').scrollTop = 0;
  });
}

/* ══════════════════════════════════════════════════════════════
   ESTILOS
   ══════════════════════════════════════════════════════════════ */
function estilos() {
  if ($('lq-css')) return;
  const s = document.createElement('style'); s.id = 'lq-css';
  s.textContent = `
  #lq-overlay{position:fixed;inset:0;z-index:9740;display:flex;align-items:center;justify-content:center;padding:0}
  #lq-overlay .lq-bg{position:absolute;inset:0;background:rgba(3,5,8,.94)}
  #lq-overlay .lq-c{position:relative;width:100%;height:100vh;height:100dvh;display:flex;flex-direction:column;
    background:#07090c;padding:0}

  /* Una sola barra arriba: monedas, temporalidad y botones. El resto
     es gráfico, que es a lo que viene el usuario. */
  /* La barra: los selectores se deslizan, pero cerrar y ayuda quedan
     SIEMPRE a la vista. Si se van con el scroll, no puedes salir. */
  #lq-overlay .lq-barra{display:flex;align-items:center;gap:8px;flex:0 0 auto;position:relative;
    padding:8px 190px 8px 10px;background:#0b0e12;border-bottom:1px solid #1c2128;
    overflow-x:auto;scrollbar-width:none}
  #lq-overlay .lq-barra::-webkit-scrollbar{display:none}
  #lq-overlay .lq-grupo{display:flex;gap:2px;flex:0 0 auto;padding:3px;background:#12161c;border-radius:9px}
  #lq-overlay .lq-b{min-height:32px;padding:0 12px;border-radius:7px;border:none;background:transparent;color:#7d8794;
    font-family:var(--mono,monospace);font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap}
  #lq-overlay .lq-b.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800}
  #lq-overlay .lq-b:not(.on):hover{background:rgba(255,255,255,.05);color:#b7bdc6}
  #lq-overlay .lq-der{position:absolute;right:8px;top:50%;transform:translateY(-50%);
    display:flex;gap:5px;z-index:6;background:#0b0e12;padding-left:8px}
  #lq-overlay .lq-ayuda.apagado{opacity:.4}
  /* Selectores desplegables */
  #lq-overlay .lq-sel{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;
    min-height:34px;padding:0 11px;border-radius:9px;background:#12161c;border:1px solid #2b3139;
    color:#eaecef;cursor:pointer;font-family:var(--mono,monospace);font-size:12px;white-space:nowrap}
  #lq-overlay .lq-sel:hover{border-color:var(--gold-soft,#C9A84B)}
  #lq-overlay .lq-sel b{font-weight:700}
  #lq-overlay .lq-sel svg{width:13px;height:13px;opacity:.6}
  .lq-menu{position:fixed;z-index:9780;min-width:212px;max-height:340px;overflow:hidden;
    display:flex;flex-direction:column;
    background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid var(--gold-soft,#C9A84B);
    border-radius:13px;padding:6px;box-shadow:0 16px 44px rgba(0,0,0,.7)}
  .lq-menu-lista{overflow-y:auto;display:flex;flex-direction:column;gap:2px}
  .lq-buscar{width:100%;box-sizing:border-box;padding:9px 11px;margin-bottom:6px;border-radius:9px;
    border:1px solid #2b3139;background:#0b0e12;color:#eaecef;
    font-family:var(--sans,sans-serif);font-size:13px;min-height:38px}
  .lq-buscar:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  .lq-op{display:flex;align-items:center;gap:9px;width:100%;padding:9px 11px;border-radius:9px;
    background:transparent;border:none;color:#b7bdc6;cursor:pointer;text-align:left;min-height:40px}
  .lq-op:hover{background:rgba(255,255,255,.05)}
  .lq-op.on{background:rgba(232,184,75,.1);color:var(--gold,#E8B84B)}
  .lq-logo{width:22px;height:22px;border-radius:50%;flex:0 0 auto;
    background:rgba(255,255,255,.06) center/cover no-repeat;border:1px solid #2b3139}
  .lq-logo.con{background-color:transparent;border-color:transparent}
  .lq-op b{font-family:var(--mono,monospace);font-size:12px;font-weight:700;min-width:44px}
  .lq-op span{flex:1;font-family:var(--sans,sans-serif);font-size:12px;color:#7d8794;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .lq-op.on span{color:#b7bdc6}
  .lq-op svg{width:14px;height:14px;flex:0 0 auto;color:var(--gold,#E8B84B)}
  /* Botones de herramienta: solo el icono, cuadrados. */
  #lq-overlay .lq-ico{width:32px;padding:0;display:grid;place-items:center}
  #lq-overlay .lq-ico svg{width:15px;height:15px}
  #lq-overlay .lq-ico.on{background:linear-gradient(180deg,#8fc4ff,#4d9fff 55%,#2b7fe0);color:#04121f}
  /* El deslizador de intensidad */
  #lq-overlay .lq-slider{align-items:center;gap:8px;padding:3px 10px 3px 8px}
  #lq-overlay .lq-slider span{font-family:var(--mono,monospace);font-size:9px;color:#6b7681;
    text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
  #lq-overlay .lq-slider input{-webkit-appearance:none;appearance:none;width:74px;height:4px;
    border-radius:20px;background:#2b3139;outline:none}
  #lq-overlay .lq-slider input::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;
    border-radius:50%;background:var(--gold,#E8B84B);cursor:pointer;border:none}
  #lq-overlay .lq-slider input::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:var(--gold,#E8B84B);cursor:pointer;border:none}
  /* La marca de agua: nuestra, en la esquina, discreta */
  /* La marca de agua: se tiene que ver quiénes somos. Al 28% de
     opacidad prácticamente desaparecía sobre el mapa. */
  #lq-overlay .lq-marca{position:absolute;left:14px;bottom:30px;pointer-events:none;
    height:40px;width:auto;opacity:.72;user-select:none;
    filter:drop-shadow(0 2px 6px rgba(0,0,0,.85))}
  @media(max-width:760px){
    #lq-overlay .lq-marca{height:30px;left:10px;bottom:26px}
  }
  #lq-overlay .lq-ayuda,#lq-overlay .lq-x{width:34px;height:34px;min-height:34px;flex:0 0 auto;border-radius:9px;display:grid;place-items:center;
    padding:0;cursor:pointer;background:rgba(255,255,255,.05);border:1px solid #2b3139;color:#8b96a3;
    font-family:var(--mono,monospace);font-size:14px;font-weight:700}
  #lq-overlay .lq-ayuda:hover,#lq-overlay .lq-x:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #lq-overlay .lq-news{position:relative}
  #lq-overlay .lq-news .lq-news-dot{position:absolute;top:4px;right:4px;width:7px;height:7px;border-radius:50%;background:#f6465d;box-shadow:0 0 0 0 rgba(246,70,93,.6);animation:lqNewsPulse 2.2s infinite}
  @keyframes lqNewsPulse{0%{box-shadow:0 0 0 0 rgba(246,70,93,.55)}70%{box-shadow:0 0 0 6px rgba(246,70,93,0)}100%{box-shadow:0 0 0 0 rgba(246,70,93,0)}}

  /* El gráfico se lo come todo. */
  #lq-overlay .lq-caja{flex:1;min-height:0;position:relative;background:#07090c;
    display:flex;align-items:center;justify-content:center;overflow:hidden}
  #lq-overlay .lq-cv{display:block}
  #lq-overlay .lq-info{position:absolute;left:9px;top:8px;font-family:var(--mono,monospace);font-size:10px;
    color:#6b7681;background:rgba(7,9,12,.75);padding:3px 8px;border-radius:20px;pointer-events:none}
  #lq-overlay .lq-reintentar{display:block;margin:14px auto 0;min-height:42px;padding:0 22px;
    border-radius:11px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:13px;cursor:pointer}
  #lq-overlay .lq-cargando,#lq-overlay .lq-vacio{font-family:var(--mono,monospace);font-size:12px;
    color:#7d8794;text-align:center;padding:30px;line-height:1.7}

  /* La escala de color, fina y abajo. */
  #lq-overlay .lq-escala{flex:0 0 auto;display:flex;align-items:center;gap:9px;
    padding:7px 12px;background:#0b0e12;border-top:1px solid #1c2128}
  #lq-overlay .lq-escala span{font-family:var(--mono,monospace);font-size:9px;color:#6b7681;
    text-transform:uppercase;letter-spacing:.6px;white-space:nowrap}
  /* La escala refleja la paleta real del mapa. */
  /* La escala refleja los escalones exactos del mapa, sin degradados
     intermedios: lo que se ve abajo es lo que se ve arriba. */
  #lq-overlay .lq-gr{flex:1;height:8px;border-radius:20px;
    background:linear-gradient(90deg,
      rgb(10,36,92) 0 20%, rgb(30,74,168) 20% 40%, rgb(56,130,220) 40% 58%,
      rgb(8,190,12) 58% 76%, rgb(228,229,5) 76% 89%,
      rgb(255,132,0) 89% 96%, rgb(255,0,0) 96% 100%)}

  /* ── Planes Pro ── */
  #pro-overlay{position:fixed;inset:0;z-index:9750;display:flex;align-items:center;justify-content:center;padding:16px}
  #pro-overlay .lq-bg{position:absolute;inset:0;background:rgba(3,5,8,.93);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  #pro-overlay .pro-c{position:relative;width:100%;max-width:640px;max-height:calc(100vh - 32px);overflow-y:auto;
    background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);
    border-radius:20px;padding:28px 22px;text-align:center}
  #pro-overlay .lq-x{position:absolute;top:14px;right:14px}
  #pro-overlay .pro-eyebrow{font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:2px;margin-bottom:8px}
  #pro-overlay .pro-t{font-family:var(--display,sans-serif);font-weight:800;font-size:24px;color:#eaecef;margin:0 0 6px}
  #pro-overlay .pro-s{font-family:var(--sans,sans-serif);font-size:13px;color:#7d8794;margin:0 0 20px}
  #pro-overlay .pro-lista{display:flex;flex-direction:column;gap:9px;margin-bottom:22px;text-align:left}
  #pro-overlay .pro-item{padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid #2b3139}
  #pro-overlay .pro-item b{display:block;font-family:var(--display,sans-serif);font-size:14px;color:var(--gold,#E8B84B);margin-bottom:3px}
  #pro-overlay .pro-item span{font-family:var(--sans,sans-serif);font-size:12.5px;color:#8b96a3;line-height:1.5}
  #pro-overlay .pro-planes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
  #pro-overlay .pro-plan{position:relative;padding:20px 12px 16px;border-radius:14px;
    background:rgba(255,255,255,.025);border:1px solid #2b3139;display:flex;flex-direction:column;gap:7px}
  #pro-overlay .pro-plan.top{border-color:var(--gold,#E8B84B);background:rgba(232,184,75,.07)}
  #pro-overlay .pro-badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);white-space:nowrap;
    padding:3px 10px;border-radius:20px;background:var(--gold,#E8B84B);color:#3a2800;
    font-family:var(--mono,monospace);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  #pro-overlay .pro-nom{font-family:var(--display,sans-serif);font-weight:700;font-size:14px;color:#eaecef}
  #pro-overlay .pro-precio b{font-family:var(--display,sans-serif);font-weight:800;font-size:30px;color:var(--gold,#E8B84B)}
  #pro-overlay .pro-precio span{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;margin-left:3px}
  #pro-overlay .pro-ahorro{font-family:var(--mono,monospace);font-size:10px;color:var(--neon-lit,#2ee86a)}
  #pro-overlay .pro-ahorro-x{font-family:var(--mono,monospace);font-size:10px;color:#6b7681}
  #pro-overlay .pro-b{min-height:44px;border-radius:11px;border:1px solid #c79426;margin-top:4px;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 3px 0 #8f6a1a}
  #pro-overlay .pro-b:active{transform:translateY(2px)}
  #pro-overlay .pro-dias{font-family:var(--mono,monospace);font-size:9.5px;color:#6b7681}
  #pro-overlay .pro-aviso{padding:12px 14px;border-radius:11px;background:rgba(232,184,75,.06);
    border-left:2px solid var(--gold-soft,#C9A84B);font-family:var(--sans,sans-serif);
    font-size:12px;color:#b7bdc6;line-height:1.6;text-align:left}
  #pro-overlay .pro-msg{grid-column:1/-1;padding:10px;border-radius:10px;background:rgba(232,184,75,.1);
    font-family:var(--mono,monospace);font-size:11.5px;color:var(--gold,#E8B84B)}
  @media(max-width:620px){
    #pro-overlay .pro-c{padding:22px 15px}
    #pro-overlay .pro-t{font-size:20px}
    #pro-overlay .pro-planes{grid-template-columns:1fr;gap:12px}
    #pro-overlay .pro-plan{flex-direction:row;align-items:center;flex-wrap:wrap;text-align:left;padding:16px 14px}
    #pro-overlay .pro-nom{flex:1;min-width:80px}
    #pro-overlay .pro-b{width:100%;order:9}
    #pro-overlay .pro-dias{width:100%;order:10}
  }

  /* ══════════════ PORTADA DE LIQUIDITY ══════════════ */
  #lqp-overlay{position:fixed;inset:0;z-index:9745;display:flex;align-items:center;justify-content:center;padding:16px}
  #lqp-overlay .lq-bg{position:absolute;inset:0;background:rgba(3,5,8,.93);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  #lqp-overlay .lqp-c{position:relative;width:100%;max-width:820px;max-height:calc(100vh - 32px);overflow-y:auto;
    background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);
    border-radius:20px;padding:28px 22px;text-align:center}
  #lqp-overlay .lqp-x{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:10px;
    display:grid;place-items:center;padding:0;cursor:pointer;font-size:15px;z-index:5;
    background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6}
  #lqp-overlay .lqp-x:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #lqp-overlay .lqp-eyebrow{font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:2px;margin-bottom:8px}
  #lqp-overlay .lqp-t{font-family:var(--display,sans-serif);font-weight:800;font-size:26px;color:#eaecef;margin:0 0 5px}
  #lqp-overlay .lqp-s{font-family:var(--sans,sans-serif);font-size:13px;color:#7d8794;margin:0 0 22px}
  #lqp-overlay .lqp-activo{padding:11px 15px;border-radius:12px;margin-bottom:20px;
    background:rgba(46,232,106,.08);border:1px solid rgba(46,232,106,.3);
    font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6}
  #lqp-overlay .lqp-activo b{display:block;color:var(--neon-lit,#2ee86a);
    font-family:var(--display,sans-serif);font-size:13.5px;margin-bottom:2px}

  #lqp-overlay .lqp-servs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
  #lqp-overlay .lqp-serv{display:flex;flex-direction:column;align-items:center;gap:6px;
    padding:16px 13px 14px;border-radius:16px;cursor:pointer;text-align:center;
    background:rgba(255,255,255,.025);border:1px solid #2b3139;transition:border-color .16s,transform .1s}
  #lqp-overlay .lqp-serv:not(.pronto):hover{border-color:var(--gold,#E8B84B);transform:translateY(-2px)}
  #lqp-overlay .lqp-serv.pronto{opacity:.5;cursor:default}
  #lqp-overlay .lqp-img{width:100%;aspect-ratio:16/10;border-radius:12px;margin-bottom:6px;
    background:linear-gradient(140deg,#1b2230,#0d1117) center/cover no-repeat;
    border:1px solid #2b3139;display:grid;place-items:center}
  #lqp-overlay .lqp-img.con{border-color:transparent}
  #lqp-overlay .lqp-img.con .lqp-ini{display:none}
  #lqp-overlay .lqp-ini{font-family:var(--display,sans-serif);font-weight:800;font-size:32px;
    color:rgba(232,184,75,.3)}
  #lqp-overlay .lqp-nom{font-family:var(--display,sans-serif);font-weight:800;font-size:15px;color:#eaecef}
  #lqp-overlay .lqp-lema{font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:.7px}
  #lqp-overlay .lqp-desc{font-family:var(--sans,sans-serif);font-size:12px;color:#7d8794;line-height:1.5;flex:1}
  #lqp-overlay .lqp-abrir{font-family:var(--mono,monospace);font-size:11px;color:var(--gold,#E8B84B);margin-top:4px}
  #lqp-overlay .lqp-pronto{font-family:var(--mono,monospace);font-size:10px;color:#6b7681;margin-top:4px}

  #lqp-overlay .lqp-sep{display:flex;align-items:center;gap:12px;margin:0 0 16px}
  #lqp-overlay .lqp-sep:before,#lqp-overlay .lqp-sep:after{content:'';flex:1;height:1px;background:#2b3139}
  #lqp-overlay .lqp-sep span{font-family:var(--mono,monospace);font-size:10px;color:#6b7681;
    text-transform:uppercase;letter-spacing:1.4px}

  #lqp-overlay .lqp-planes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
  #lqp-overlay .lqp-plan{position:relative;padding:20px 12px 14px;border-radius:14px;
    background:rgba(255,255,255,.025);border:1px solid #2b3139;display:flex;flex-direction:column;gap:6px}
  #lqp-overlay .lqp-plan.top{border-color:var(--gold,#E8B84B);background:rgba(232,184,75,.08)}
  #lqp-overlay .lqp-badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);white-space:nowrap;
    padding:3px 11px;border-radius:20px;background:var(--gold,#E8B84B);color:#3a2800;
    font-family:var(--mono,monospace);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px}
  #lqp-overlay .lqp-plan-n{font-family:var(--display,sans-serif);font-weight:700;font-size:14px;color:#eaecef}
  #lqp-overlay .lqp-precio b{font-family:var(--display,sans-serif);font-weight:800;font-size:30px;color:var(--gold,#E8B84B)}
  #lqp-overlay .lqp-precio span{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;margin-left:3px}
  #lqp-overlay .lqp-ahorro{font-family:var(--mono,monospace);font-size:10px;color:var(--neon-lit,#2ee86a)}
  #lqp-overlay .lqp-ahorro-x{font-family:var(--mono,monospace);font-size:10px;color:#6b7681}
  #lqp-overlay .lqp-b{min-height:44px;border-radius:11px;border:1px solid #c79426;margin-top:3px;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 3px 0 #8f6a1a}
  #lqp-overlay .lqp-b:active{transform:translateY(2px)}
  #lqp-overlay .lqp-dias{font-family:var(--mono,monospace);font-size:9.5px;color:#6b7681}
  #lqp-overlay .lqp-pago{font-family:var(--sans,sans-serif);font-size:11.5px;color:#7d8794;line-height:1.6}
  #lqp-overlay .lqp-pago b{color:var(--gold,#E8B84B)}
  #lqp-overlay .lqp-msg{padding:14px 16px;border-radius:12px;margin-bottom:14px;
    background:rgba(232,184,75,.1);border:1px solid rgba(232,184,75,.32);
    font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;line-height:1.6}
  #lqp-overlay .lqp-msg b{display:block;color:var(--gold,#E8B84B);
    font-family:var(--display,sans-serif);font-size:14px;margin-bottom:3px}
  #lqp-overlay .lqp-mon{display:flex;gap:8px;justify-content:center;margin-top:10px}
  #lqp-overlay .lqp-mon button{min-width:96px;min-height:42px;border-radius:11px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:13px;cursor:pointer}

  @media(max-width:720px){
    #lqp-overlay{padding:9px}
    #lqp-overlay .lqp-c{padding:22px 14px;border-radius:17px}
    #lqp-overlay .lqp-t{font-size:21px}
    #lqp-overlay .lqp-servs{grid-template-columns:1fr;gap:10px}
    /* En fila, pero con el texto en su propia columna: si no, los
       hijos empujan y la tarjeta se sale de la pantalla. */
    #lqp-overlay .lqp-serv{position:relative;display:grid;
      grid-template-columns:72px minmax(0,1fr);gap:4px 12px;
      align-items:center;text-align:left;padding:12px}
    #lqp-overlay .lqp-img{width:72px;flex:0 0 auto;aspect-ratio:1;margin:0;grid-row:1/span 3}
    #lqp-overlay .lqp-nom,#lqp-overlay .lqp-lema,#lqp-overlay .lqp-desc{
      grid-column:2;min-width:0;overflow-wrap:anywhere}
    #lqp-overlay .lqp-desc{font-size:11.5px;line-height:1.45}
    #lqp-overlay .lqp-abrir,#lqp-overlay .lqp-pronto{grid-column:2;justify-self:start;margin-top:2px}
    #lqp-overlay .lqp-planes{grid-template-columns:1fr;gap:12px}
    #lqp-overlay .lqp-plan{flex-direction:row;align-items:center;flex-wrap:wrap;text-align:left;padding:16px 14px}
    #lqp-overlay .lqp-plan-n{flex:1;min-width:86px}
    #lqp-overlay .lqp-b{width:100%;order:9}
    #lqp-overlay .lqp-dias{width:100%;order:10}
  }

  /* Ayuda */
  #lq-ayuda-box{position:fixed;inset:0;z-index:9760;display:flex;align-items:center;justify-content:center;padding:16px}
  #lq-ayuda-box .lq-bg{position:absolute;inset:0;background:rgba(3,5,8,.93)}
  #lq-ayuda-box .lqa-c{position:relative;width:100%;max-width:540px;max-height:calc(100vh - 32px);overflow-y:auto;
    background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:20px;padding:24px 20px}
  #lq-ayuda-box .lqa-x{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:10px;
    display:grid;place-items:center;padding:0;cursor:pointer;font-size:15px;z-index:5;
    background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6}
  #lq-ayuda-box .lqa-x:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #lq-ayuda-box .lqa-tabs{display:flex;gap:4px;padding:4px;margin:0 42px 18px 0;
    background:#0b0e12;border:1px solid #2b3139;border-radius:12px}
  #lq-ayuda-box .lqa-tab{flex:1;min-height:40px;padding:0 10px;border-radius:9px;border:none;background:transparent;
    color:#7d8794;font-family:var(--display,sans-serif);font-weight:700;font-size:12.5px;cursor:pointer;line-height:1.25}
  #lq-ayuda-box .lqa-tab.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800}
  #lq-ayuda-box .lqa-pane{display:none}
  #lq-ayuda-box .lqa-pane.on{display:block}
  #lq-ayuda-box .lqa-intro{padding:14px 16px;border-radius:13px;margin-bottom:18px;
    background:linear-gradient(180deg,rgba(232,184,75,.09),rgba(232,184,75,.02));
    border:1px solid rgba(232,184,75,.3);
    font-family:var(--sans,sans-serif);font-size:13.5px;color:#b7bdc6;line-height:1.65}
  #lq-ayuda-box .lqa-intro b{color:var(--gold,#E8B84B)}
  #lq-ayuda-box .lqa-p i{display:block;margin-top:8px;padding:9px 12px;border-radius:9px;font-style:normal;
    background:rgba(255,255,255,.03);border-left:2px solid var(--gold-soft,#C9A84B);
    font-size:12.5px;color:#8b96a3;line-height:1.55}
  #lq-ayuda-box .lqa-t{font-family:var(--display,sans-serif);font-weight:800;font-size:20px;color:var(--gold,#E8B84B);
    text-align:center;margin-bottom:18px}
  #lq-ayuda-box .lqa-p{margin-bottom:15px;font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.65}
  #lq-ayuda-box .lqa-p > b:first-child{display:block;font-family:var(--display,sans-serif);font-size:14px;
    color:#eaecef;margin-bottom:5px}
  #lq-ayuda-box .lqa-p b{color:#eaecef}
  #lq-ayuda-box .lqa-col{display:flex;align-items:center;gap:9px;margin-top:7px;font-size:12.5px}
  #lq-ayuda-box .lqa-col i{width:16px;height:11px;border-radius:3px;flex:0 0 auto}
  #lq-ayuda-box .lqa-aviso{padding:12px 14px;border-radius:11px;background:rgba(232,184,75,.07);
    border-left:2px solid var(--gold-soft,#C9A84B);font-family:var(--sans,sans-serif);
    font-size:12px;color:#b7bdc6;line-height:1.6;margin-bottom:18px}
  #lq-ayuda-box .lqa-aviso b{color:var(--gold,#E8B84B)}
  #lq-ayuda-box .lqa-b{width:100%;min-height:48px;border-radius:12px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 0 #8f6a1a}

  /* El botón de "más" solo existe en el móvil. */
  #lq-overlay .solo-movil{display:none}

  /* ── Menú de opciones del móvil ── */
  .lq-mas-menu{min-width:252px;max-width:calc(100vw - 20px);padding:12px}
  .lq-mas-menu .lqm-tit{font-family:var(--mono,monospace);font-size:9px;color:#6b7681;
    text-transform:uppercase;letter-spacing:1px;margin:12px 0 7px}
  .lq-mas-menu .lqm-tit:first-child{margin-top:0}
  .lq-mas-menu .lqm-fila{display:flex;gap:5px;flex-wrap:wrap}
  .lq-mas-menu .lqm-chip{flex:1;min-width:46px;min-height:36px;padding:0 8px;border-radius:9px;border:1px solid #2b3139;
    background:#12161c;color:#8b96a3;font-family:var(--mono,monospace);font-size:11px;font-weight:700;cursor:pointer}
  .lq-mas-menu .lqm-chip.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);
    color:#3a2800;border-color:#c79426}
  .lq-mas-menu .lqm-range{-webkit-appearance:none;appearance:none;width:100%;height:5px;
    border-radius:20px;background:#2b3139;outline:none;margin:2px 0}
  .lq-mas-menu .lqm-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;
    border-radius:50%;background:var(--gold,#E8B84B);cursor:pointer;border:none}
  .lq-mas-menu .lqm-range::-moz-range-thumb{width:18px;height:18px;border-radius:50%;
    background:var(--gold,#E8B84B);cursor:pointer;border:none}
  .lq-mas-menu .lqm-op{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;
    padding:11px 12px;border-radius:10px;background:transparent;border:none;color:#b7bdc6;cursor:pointer;
    min-height:44px;font-family:var(--sans,sans-serif);font-size:13px;text-align:left}
  .lq-mas-menu .lqm-op:hover{background:rgba(255,255,255,.05)}
  .lq-mas-menu .lqm-op i{width:34px;height:19px;border-radius:20px;background:#2b3139;
    flex:0 0 auto;position:relative;transition:background .18s}
  .lq-mas-menu .lqm-op i:after{content:'';position:absolute;top:2.5px;left:2.5px;width:14px;height:14px;
    border-radius:50%;background:#6b7681;transition:transform .18s,background .18s}
  .lq-mas-menu .lqm-op i.on{background:rgba(232,184,75,.3)}
  .lq-mas-menu .lqm-op i.on:after{transform:translateX(15px);background:var(--gold,#E8B84B)}

  @media(max-width:760px){
    /* En el móvil la barra deja SOLO lo del día a día: moneda,
       temporalidad, foto, ayuda y cerrar. El resto vive en el menú. */
    #lq-overlay .solo-movil{display:grid}
    #lq-overlay .lq-barra > .lq-grupo,
    #lq-overlay .lq-slider,
    #lq-overlay #lq-cal,
    #lq-overlay #lq-perfil,
    #lq-overlay #lq-ver,
    #lq-overlay #lq-fit{display:none}
    #lq-overlay .lq-barra{padding:7px 8px;gap:6px;padding-right:150px}
    #lq-overlay .lq-sel{min-height:34px;font-size:12.5px}
    #lq-overlay .lq-b{padding:0 10px;font-size:11px;min-height:34px}
    #lq-overlay .lq-marca{font-size:11px;bottom:24px}
    #lq-overlay .lq-escala{padding:6px 10px;gap:7px}
    #lq-overlay .lq-escala span{font-size:8px}
    #lq-ayuda-box .lqa-c{padding:20px 14px}
    #lq-ayuda-box .lqa-tabs{margin-right:44px;flex-direction:column}
    #lq-ayuda-box .lqa-tab{font-size:12px;min-height:38px}
    #lq-ayuda-box .lqa-intro{font-size:12.5px;padding:12px 13px}
  }`;
  document.head.appendChild(s);
}
