// muros.js — Lógica Estructural Avanzada
//
// EL PROBLEMA QUE RESUELVE
//
// El libro de órdenes miente. La mayoría de los muros grandes que ve
// todo el mundo son falsos: órdenes puestas para asustar que se retiran
// justo cuando el precio llega. Un trader que persigue esos muros
// pierde dinero de forma sistemática.
//
// Esta herramienta no muestra el libro. Muestra CUÁLES DE ESOS MUROS
// SON DE VERDAD, y para eso hace lo único que los delata: vigilarlos
// en el tiempo.
//
//   · Un muro REAL aguanta. Sigue ahí minuto tras minuto y, cuando el
//     precio se acerca, se va consumiendo: alguien ejecuta de verdad.
//
//   · Un muro FALSO aparece de golpe y se desvanece antes de que el
//     precio lo toque. Nunca se ejecuta nada.
//
//   · Un muro RECARGABLE se consume y vuelve a aparecer al mismo
//     precio. Es alguien grande partiendo su orden para no mover el
//     mercado. Es la señal más fuerte que existe en el libro.

import * as ethers from './vendor/ethers-6.13.4.min.js?v=126';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const PARES = [
  { id: 'BTC',   s: 'BTCUSDT',   n: 'Bitcoin',    cg: 'bitcoin' },
  { id: 'ETH',   s: 'ETHUSDT',   n: 'Ethereum',   cg: 'ethereum' },
  { id: 'BNB',   s: 'BNBUSDT',   n: 'BNB',        cg: 'binancecoin' },
  { id: 'SOL',   s: 'SOLUSDT',   n: 'Solana',     cg: 'solana' },
  { id: 'XRP',   s: 'XRPUSDT',   n: 'XRP',        cg: 'ripple' },
  { id: 'DOGE',  s: 'DOGEUSDT',  n: 'Dogecoin',   cg: 'dogecoin' },
  { id: 'ADA',   s: 'ADAUSDT',   n: 'Cardano',    cg: 'cardano' },
  { id: 'AVAX',  s: 'AVAXUSDT',  n: 'Avalanche',  cg: 'avalanche-2' },
  { id: 'LINK',  s: 'LINKUSDT',  n: 'Chainlink',  cg: 'chainlink' },
  { id: 'DOT',   s: 'DOTUSDT',   n: 'Polkadot',   cg: 'polkadot' },
  { id: 'POL',   s: 'POLUSDT',   n: 'Polygon',    cg: 'matic-network' },
  { id: 'LTC',   s: 'LTCUSDT',   n: 'Litecoin',   cg: 'litecoin' },
  { id: 'TRX',   s: 'TRXUSDT',   n: 'TRON',       cg: 'tron' },
  { id: 'SHIB',  s: 'SHIBUSDT',  n: 'Shiba Inu',  cg: 'shiba-inu' },
  { id: 'PEPE',  s: 'PEPEUSDT',  n: 'Pepe',       cg: 'pepe' },
  { id: 'NEAR',  s: 'NEARUSDT',  n: 'NEAR',       cg: 'near' },
  { id: 'SUI',   s: 'SUIUSDT',   n: 'Sui',        cg: 'sui' },
  { id: 'ARB',   s: 'ARBUSDT',   n: 'Arbitrum',   cg: 'arbitrum' },
  { id: 'OP',    s: 'OPUSDT',    n: 'Optimism',   cg: 'optimism' },
  { id: 'ATOM',  s: 'ATOMUSDT',  n: 'Cosmos',     cg: 'cosmos' },
  { id: 'UNI',   s: 'UNIUSDT',   n: 'Uniswap',    cg: 'uniswap' },
  { id: 'INJ',   s: 'INJUSDT',   n: 'Injective',  cg: 'injective-protocol' },
  { id: 'TON',   s: 'TONUSDT',   n: 'Toncoin',    cg: 'the-open-network' },
  { id: 'APT',   s: 'APTUSDT',   n: 'Aptos',      cg: 'aptos' },
  { id: 'FIL',   s: 'FILUSDT',   n: 'Filecoin',   cg: 'filecoin' },
  { id: 'ETC',   s: 'ETCUSDT',   n: 'Ethereum Classic', cg: 'ethereum-classic' },
  { id: 'HBAR',  s: 'HBARUSDT',  n: 'Hedera',     cg: 'hedera-hashgraph' },
  { id: 'ICP',   s: 'ICPUSDT',   n: 'Internet Computer', cg: 'internet-computer' },
  { id: 'IMX',   s: 'IMXUSDT',   n: 'Immutable',  cg: 'immutable-x' },
  { id: 'RENDER',s: 'RENDERUSDT',n: 'Render',     cg: 'render-token' },
  { id: 'STX',   s: 'STXUSDT',   n: 'Stacks',     cg: 'blockstack' },
  { id: 'TIA',   s: 'TIAUSDT',   n: 'Celestia',   cg: 'celestia' },
  { id: 'SEI',   s: 'SEIUSDT',   n: 'Sei',        cg: 'sei-network' },
  { id: 'ALGO',  s: 'ALGOUSDT',  n: 'Algorand',   cg: 'algorand' },
  { id: 'VET',   s: 'VETUSDT',   n: 'VeChain',    cg: 'vechain' },
  { id: 'GALA',  s: 'GALAUSDT',  n: 'Gala',       cg: 'gala' },
  { id: 'SAND',  s: 'SANDUSDT',  n: 'The Sandbox',cg: 'the-sandbox' },
  { id: 'MANA',  s: 'MANAUSDT',  n: 'Decentraland', cg: 'decentraland' },
  { id: 'AXS',   s: 'AXSUSDT',   n: 'Axie Infinity', cg: 'axie-infinity' },
  { id: 'AAVE',  s: 'AAVEUSDT',  n: 'Aave',       cg: 'aave' },
  { id: 'MKR',   s: 'MKRUSDT',   n: 'Maker',      cg: 'maker' },
  { id: 'GRT',   s: 'GRTUSDT',   n: 'The Graph',  cg: 'the-graph' },
  { id: 'LDO',   s: 'LDOUSDT',   n: 'Lido DAO',   cg: 'lido-dao' },
  { id: 'CRV',   s: 'CRVUSDT',   n: 'Curve',      cg: 'curve-dao-token' },
  { id: 'SNX',   s: 'SNXUSDT',   n: 'Synthetix',  cg: 'havven' },
  { id: 'RUNE',  s: 'RUNEUSDT',  n: 'THORChain',  cg: 'thorchain' },
  { id: 'FLOW',  s: 'FLOWUSDT',  n: 'Flow',       cg: 'flow' },
  { id: 'CHZ',   s: 'CHZUSDT',   n: 'Chiliz',     cg: 'chiliz' },
  { id: 'THETA', s: 'THETAUSDT', n: 'Theta',      cg: 'theta-token' },
  { id: 'XLM',   s: 'XLMUSDT',   n: 'Stellar',    cg: 'stellar' },
  { id: 'XTZ',   s: 'XTZUSDT',   n: 'Tezos',      cg: 'tezos' },
  { id: 'EOS',   s: 'EOSUSDT',   n: 'EOS',        cg: 'eos' },
  { id: 'IOTA',  s: 'IOTAUSDT',  n: 'IOTA',       cg: 'iota' },
  { id: 'CAKE',  s: 'CAKEUSDT',  n: 'PancakeSwap',cg: 'pancakeswap-token' },
  { id: 'DYDX',  s: 'DYDXUSDT',  n: 'dYdX',       cg: 'dydx-chain' },
  { id: 'JUP',   s: 'JUPUSDT',   n: 'Jupiter',    cg: 'jupiter-exchange-solana' },
  { id: 'PYTH',  s: 'PYTHUSDT',  n: 'Pyth',       cg: 'pyth-network' },
  { id: 'WIF',   s: 'WIFUSDT',   n: 'dogwifhat',  cg: 'dogwifcoin' },
  { id: 'BONK',  s: 'BONKUSDT',  n: 'Bonk',       cg: 'bonk' },
  { id: 'FLOKI', s: 'FLOKIUSDT', n: 'Floki',      cg: 'floki' },
  { id: 'JASMY', s: 'JASMYUSDT', n: 'JasmyCoin',  cg: 'jasmycoin' },
  { id: 'ENA',   s: 'ENAUSDT',   n: 'Ethena',     cg: 'ethena' },
  { id: 'W',     s: 'WUSDT',     n: 'Wormhole',   cg: 'wormhole' },
  { id: 'STRK',  s: 'STRKUSDT',  n: 'Starknet',   cg: 'starknet' },
  { id: 'PENDLE',s: 'PENDLEUSDT',n: 'Pendle',     cg: 'pendle' },
  { id: 'ENS',   s: 'ENSUSDT',   n: 'ENS',        cg: 'ethereum-name-service' },
  { id: 'COMP',  s: 'COMPUSDT',  n: 'Compound',   cg: 'compound-governance-token' },
  { id: 'DASH',  s: 'DASHUSDT',  n: 'Dash',       cg: 'dash' },
  { id: 'ZEC',   s: 'ZECUSDT',   n: 'Zcash',      cg: 'zcash' },
  { id: 'KAVA',  s: 'KAVAUSDT',  n: 'Kava',       cg: 'kava' },
  { id: 'MINA',  s: 'MINAUSDT',  n: 'Mina',       cg: 'mina-protocol' },
  { id: 'ROSE',  s: 'ROSEUSDT',  n: 'Oasis',      cg: 'oasis-network' },
  { id: 'ZIL',   s: 'ZILUSDT',   n: 'Zilliqa',    cg: 'zilliqa' },
  { id: 'QNT',   s: 'QNTUSDT',   n: 'Quant',      cg: 'quant-network' },
  { id: 'GMT',   s: 'GMTUSDT',   n: 'GMT',        cg: 'stepn' },
  { id: 'APE',   s: 'APEUSDT',   n: 'ApeCoin',    cg: 'apecoin' },
  { id: 'LRC',   s: 'LRCUSDT',   n: 'Loopring',   cg: 'loopring' },
  { id: 'ANKR',  s: 'ANKRUSDT',  n: 'Ankr',       cg: 'ankr' },
  { id: 'WLD',   s: 'WLDUSDT',   n: 'Worldcoin',  cg: 'worldcoin-wld' },
  { id: 'NOT',   s: 'NOTUSDT',   n: 'Notcoin',    cg: 'notcoin' }
];

let _par = 'BNB';
/* Nombre/dominio de la web en UN solo sitio: si cambia, se cambia aquí y se
   actualiza en todas las imágenes y textos que lo usan. */
const WEB_DOMINIO = 'CriptoCubaOficial.com';
let _od = null;              // módulo de órdenes
let _zonasOd = [];           // dónde pulsar para cancelar

/* ══════════════════════════════════════════════════════════════
   LAS VELAS — el contexto que faltaba
   Sin gráfico, los muros son números sueltos. Con él se ve dónde
   está el precio respecto a cada nivel.
   ══════════════════════════════════════════════════════════════ */
const TFS = [
  { id: '1m',  n: '1m' },
  { id: '3m',  n: '3m' },
  { id: '5m',  n: '5m' },
  { id: '15m', n: '15m' },
  { id: '30m', n: '30m' },
  { id: '1h',  n: '1H' },
  { id: '2h',  n: '2H' },
  { id: '4h',  n: '4H' },
  { id: '6h',  n: '6H' },
  { id: '12h', n: '12H' },
  { id: '1d',  n: '1D' },
  { id: '1w',  n: '1W' }
];

async function traerVelas(simbolo, tf, n = 120) {
  const r = await muFetch(`/api/v3/klines?symbol=${simbolo}&interval=${tf}&limit=${n}`);
  if (!r.ok) throw new Error('no candles');
  const j = await r.json();
  return j.map((x) => ({
    t: Math.floor(x[0] / 1000),
    o: Number(x[1]), h: Number(x[2]), l: Number(x[3]), c: Number(x[4]),
    vol: Number(x[7]) || Number(x[5]) || 0,      // volumen en dólares (quote)
    volC: Number(x[10]) || 0                      // parte COMPRADORA (taker buy, en dólares)
  }));
}

/* ══════════════════════════════════════════════════════════════
   DATOS con RESPALDO. El radar necesita el libro (api/v3/depth). Binance ha
   ido geo-bloqueando api.binance.com en algunas regiones; cuando pasa, el
   libro deja de llegar y el radar se queda "sin órdenes" (aunque antes
   funcionara). Probamos varios hosts EQUIVALENTES de datos públicos —mismo
   formato, misma API, sin clave— empezando por el que funcionó la última vez.
   Incluye data-api.binance.vision (el espejo de datos de Binance), que suele
   responder donde el principal está bloqueado. Cada intento con límite de
   tiempo para no colgarse. Es ADITIVO: si api.binance.com responde, no cambia
   nada. ══════════════════════════════════════════════════════════════ */
const MU_HOSTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api-gcp.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com'
];
let _muHost = 0;
async function muFetch(path) {
  const orden = [_muHost, ...MU_HOSTS.map((_, i) => i).filter((i) => i !== _muHost)];
  let err;
  for (const i of orden) {
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(MU_HOSTS[i] + path, { signal: ctl.signal });
      clearTimeout(to);
      if (r.ok) { _muHost = i; return r; }
      err = new Error('HTTP ' + r.status);
    } catch (e) { err = e; }
  }
  throw err || new Error('sin datos');
}

/** Rectángulo con esquinas redondeadas. */
function redondeado(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

/* ══════════════════════════════════════════════════════════════
   ESTADO
   ══════════════════════════════════════════════════════════════ */
const M = {
  fotos: [],          // historial del libro: hasta 220 tomas
  precio: 0,
  niveles: new Map(), // precio → seguimiento de ese nivel
  muros: [],          // los detectados, ya juzgados
  seleccionado: null,
  cargando: true,
  error: null,
  zoom: 1,
  cruzY: -1,
  velas: [],          // las velas del gráfico
  zonas: [],          // zonas de acumulación (demanda/oferta) desde las velas
  perfil: null,       // perfil de volumen (para el histograma lateral)
  zonasHTF: [],       // zonas de la temporalidad superior (confluencia)
  mercado: null,      // VWAP, VAH/VAL, sesión, sesgo, backtest
  delta: null,        // order-flow real (aggTrades): agresor comprador vs vendedor
  contexto: null,     // contexto multi-símbolo (BTC/ETH en demanda/oferta)
  tema: (() => { try { return localStorage.getItem('mu_tema') === 'claro' ? 'claro' : 'oscuro'; } catch (_) { return 'oscuro'; } })(),
  tf: '1h',           // temporalidad por defecto del radar
  ancho: window.innerWidth < 760 ? 65 : 100,  // cuántas velas se ven
  filtro: 'todos',
  maxMuro: 1,
  zoomY: 1,           // estirar/contraer la escala de precios
  desplaz: 0          // cuántas velas se ha movido la vista
};

const CADA = 1500;          // una foto cada 1,5 segundos
const MAX_FOTOS = 220;      // ~5,5 minutos de historia
const MIN_TOMAS = 2;        // en cuanto hay un par de fotos, ya se muestran los muros

/* ══════════════════════════════════════════════════════════════
   LOS DATOS — profundidad del libro, API pública sin clave
   ══════════════════════════════════════════════════════════════ */
async function traerLibro(simbolo) {
  /* limit=100 (no 500): el libro pesado (peso 25) es justo el que Binance
     tiende a limitar/bloquear —sobre todo con IPs compartidas—, que es por lo
     que las velas cargaban pero las órdenes no. Con 100 niveles por lado (peso
     5) el radar sigue viendo los muros que importan (los cercanos al precio) y
     deja de chocar con el límite. */
  const r = await muFetch(`/api/v3/depth?symbol=${simbolo}&limit=100`);
  if (!r.ok) throw new Error('sin datos');
  const j = await r.json();
  return {
    t: Date.now(),
    compras: j.bids.map((x) => ({ p: Number(x[0]), q: Number(x[1]) })),
    ventas: j.asks.map((x) => ({ p: Number(x[0]), q: Number(x[1]) }))
  };
}

/* ══════════════════════════════════════════════════════════════
   EL SEGUIMIENTO — aquí está todo el valor

   De cada nivel destacado se guarda su vida: cuándo apareció, cuánto
   ha aguantado, cuántas veces se fue y volvió, y qué le pasó cuando
   el precio se le acercó.
   ══════════════════════════════════════════════════════════════ */
function procesar(foto) {
  M.fotos.push(foto);
  if (M.fotos.length > MAX_FOTOS) M.fotos.shift();

  const mejorC = foto.compras[0]?.p || 0;
  const mejorV = foto.ventas[0]?.p || 0;
  M.precio = (mejorC + mejorV) / 2;
  if (!M.precio) return;

  /* [CORREGIDO — este era el fallo de fondo]

     Los niveles se agrupan en cubos, y la clave del cubo se usa para
     seguirlos entre fotos. Pero el paso se calculaba con el precio
     ACTUAL, que cambia en cada toma. Resultado: el mismo nivel caía en
     un cubo con un número ligeramente distinto cada vez, se creaba un
     seguimiento nuevo, y ninguno llegaba a acumular historia.

     Por eso el panel decía siempre "libro tranquilo" aunque el mapa
     mostrara muros bien claros.

     Ahora el paso se fija en la primera foto y no cambia. */
  if (!M.paso) M.paso = Math.max(1e-8, M.precio * 0.0005);
  const paso = M.paso;

  const agrupar = (lista, lado) => {
    const mapa = new Map();
    lista.forEach(({ p, q }) => {
      const k = Math.round(p / paso);          // entero: clave estable
      mapa.set(k, (mapa.get(k) || 0) + p * q);
    });
    return [...mapa].map(([k, v]) => ({ p: k * paso, v, lado, k }));
  };

  const todos = [...agrupar(foto.compras, 'compra'), ...agrupar(foto.ventas, 'venta')];
  if (!todos.length) return;

  // ¿Qué es "grande" AQUÍ? Se compara con el propio libro, no con un
  // número fijo: así funciona igual en BTC que en PEPE. Umbral relativo a la
  // mediana, un poco más permisivo que antes para no quedarse en "libro
  // tranquilo", pero sin forzar candidatos: solo entra lo que de verdad
  // destaca sobre el resto del libro.
  const vals = todos.map((x) => x.v).sort((a, b) => a - b);
  const base = vals[Math.floor(vals.length * 0.55)] || 1;
  const umbral = Math.max(1e-9, base * 1.9);

  const ahora = foto.t;
  const clave = (x) => x.lado + ':' + x.k;   // entero estable entre fotos

  // Marcar los que se ven en esta foto
  const vistos = new Set();
  todos.forEach((x) => {
    if (x.v < umbral) return;
    const k = clave(x);
    vistos.add(k);

    let nv = M.niveles.get(k);
    if (!nv) {
      nv = {
        p: x.p, lado: x.lado,
        nacio: ahora, visto: ahora,
        vMax: x.v, vAhora: x.v, vInicial: x.v,
        tomas: 1,
        desapariciones: 0,     // veces que se fue del libro
        recargas: 0,           // veces que volvió tras consumirse
        consumido: 0,          // cuánto se ha comido en total
        huyo: false,           // ¿se fue al acercarse el precio?
        aguanto: false,        // ¿aguantó una visita del precio?
        ausente: 0
      };
      M.niveles.set(k, nv);
    } else {
      /* Si volvió tras haber desaparecido y el precio había llegado
         cerca, eso es una RECARGA: alguien repone su orden. Es la
         señal más valiosa del libro. */
      if (nv.ausente > 0) {
        const cerca = Math.abs(M.precio - nv.p) / M.precio < 0.0015;
        if (cerca || nv.consumido > nv.vInicial * 0.3) nv.recargas++;
        nv.ausente = 0;
      }
      // Lo que ha menguado desde su máximo es lo que se han comido
      if (x.v < nv.vAhora) nv.consumido += (nv.vAhora - x.v);
      nv.vAhora = x.v;
      if (x.v > nv.vMax) nv.vMax = x.v;
      nv.visto = ahora;
      nv.tomas++;
    }

    /* ¿El precio le pasó por encima y aguantó? Eso lo convierte en un
       nivel probado, que es lo que un trader quiere saber. */
    const dist = Math.abs(M.precio - nv.p) / M.precio;
    if (dist < 0.0008) nv.aguanto = true;
  });

  // Los que no se ven: ¿se fueron o los consumieron?
  M.niveles.forEach((nv, k) => {
    if (vistos.has(k)) return;
    nv.ausente++;
    if (nv.ausente === 1) {
      nv.desapariciones++;
      /* Se fue mientras el precio se acercaba y sin apenas ejecutarse:
         es la firma de un muro falso. */
      const dist = Math.abs(M.precio - nv.p) / M.precio;
      if (dist < 0.004 && nv.consumido < nv.vInicial * 0.25) nv.huyo = true;
    }
    // Olvidar los que llevan mucho sin aparecer
    if (nv.ausente > 40) M.niveles.delete(k);
  });

  juzgar();
}

/* ══════════════════════════════════════════════════════════════
   EL VEREDICTO
   ══════════════════════════════════════════════════════════════ */
function juzgar() {
  const ahora = Date.now();
  const fuera = [];

  M.niveles.forEach((nv) => {
    if (nv.tomas < 2) return;
    const vivo = nv.ausente === 0;
    const segundos = (nv.visto - nv.nacio) / 1000;
    const consumidoPct = nv.vInicial > 0 ? nv.consumido / nv.vInicial : 0;

    let tipo, titulo, nota, prioridad;

    if (nv.recargas >= 2) {
      tipo = 'recargable';
      titulo = 'Orden blindada';
      nota = 'Alguien está reponiendo su orden cada vez que se la comen. Es un jugador grande defendiendo este precio sin querer llamar la atención.';
      prioridad = 100;

    } else if (nv.huyo && nv.desapariciones >= 2) {
      tipo = 'falso';
      titulo = 'Orden falsa';
      nota = 'Esta orden se retira cuando el precio se acerca y vuelve cuando se aleja. Está puesta para asustar, no para ejecutarse.';
      prioridad = 70;

    } else if (nv.aguanto && consumidoPct > 0.2) {
      tipo = 'probado';
      titulo = 'Nivel probado';
      nota = 'El precio llegó hasta aquí y esta orden lo frenó, comiéndose lo que venía. Hay defensa real en este nivel.';
      prioridad = 90;

    } else if (vivo && segundos > 90 && nv.desapariciones === 0) {
      tipo = 'real';
      titulo = 'Orden firme';
      nota = 'Esta orden lleva ahí sin moverse desde que empezamos a vigilar. Todavía no ha llegado el precio a probarla.';
      prioridad = 80;

    } else if (vivo) {
      /* Muro grande recién visto: se muestra YA como "en observación" (un
         muro de millones es real desde que aparece; no hay que esperar 10-20 s
         para dibujarlo). Su veredicto se afina solo con los segundos: si
         aguanta pasa a firme/probado, si huye pasa a falso. El filtro de zonas
         de más abajo evita que esto sea un chorro. */
      tipo = 'vigilando';
      titulo = 'En observación';
      nota = 'Orden nueva. Aún no sabemos si aguantará: hay que ver qué hace cuando el precio se acerque.';
      prioridad = 40;

    } else {
      return;
    }

    fuera.push({
      p: nv.p, lado: nv.lado, v: nv.vAhora, vMax: nv.vMax,
      tipo, titulo, nota, prioridad,
      segundos, recargas: nv.recargas, desapariciones: nv.desapariciones,
      consumidoPct, vivo,
      dist: M.precio > 0 ? (nv.p - M.precio) / M.precio : 0
    });
  });

  /* Se ordenan por importancia y cercanía: un muro enorme a un 8% del
     precio importa menos que uno mediano a un 0,3%. */
  fuera.sort((a, b) => {
    const pa = a.prioridad - Math.abs(a.dist) * 900;
    const pb = b.prioridad - Math.abs(b.dist) * 900;
    return pb - pa;
  });

  /* [CORREGIDO] Antes la lista se reemplazaba entera en cada foto. Si
     un muro dejaba de cumplir el mínimo por un momento, su tarjeta
     desaparecía de golpe — que es lo que viste. Ahora los que ya
     estaban se mantienen unos segundos y, si de verdad se han ido, se
     avisa antes de quitarlos: un muro que desaparece ES información. */
  /* ══ CALIBRACIÓN — de "chorro de muros" a ZONAS estratégicas ══
     El libro real tiene decenas de órdenes pegadas; mostrarlas todas es ruido
     inoperable. Un trader quiere las ZONAS que importan, no cada nivel suelto. */

  /* 1) FUSIÓN. Muros del mismo lado a menos de ~0,25% entre sí son la MISMA
        zona de liquidez. Como 'fuera' ya viene ordenado por importancia, el
        primero del racimo es el líder (conserva precio y veredicto) y le
        sumamos la liquidez de sus vecinos: la tarjeta muestra el peso REAL de
        toda la zona, no el de una orden suelta. */
  const DIST_ZONA = 0.0025;
  const zonas = [];
  fuera.forEach((m) => {
    const z = zonas.find((x) => x.lado === m.lado && Math.abs(x.p - m.p) / Math.max(1e-9, M.precio) < DIST_ZONA);
    if (z) { z.v += m.v; z.vMax = Math.max(z.vMax, m.vMax); z.enZona = (z.enZona || 1) + 1; }
    else zonas.push({ ...m, enZona: 1 });
  });

  /* 2) SIGNIFICANCIA. Se muestran las zonas con veredicto fuerte
        (blindada/probada/falsa) SIEMPRE —son las estratégicas—, y del resto
        solo las que pesan de verdad frente a la mayor de la pantalla. Así no
        se cuela liquidez menor que solo estorba. */
  const maxV = Math.max(1, ...zonas.map((x) => x.v));
  const esFuerte = (m) => m.tipo === 'recargable' || m.tipo === 'probado' || m.tipo === 'falso';
  const sig = zonas.filter((m) => esFuerte(m) || m.v >= maxV * 0.30);

  /* 3) TOPE BAJO. Como mucho 6 zonas: suficiente para leer el mapa de un
        vistazo y tomar una decisión. */
  const nuevos = sig.slice(0, 6);
  const antes = M.muros || [];

  antes.forEach((v) => {
    if (nuevos.some((x) => Math.abs(x.p - v.p) / Math.max(1e-9, v.p) < 0.0004)) return;
    // Ya no está: se marca y se deja un rato para que se lea
    const desde = v.seVaDesde || ahora;
    if (ahora - desde < 12000) {
      nuevos.push({
        ...v,
        seVaDesde: desde,
        tipo: 'ido',
        titulo: 'Ha desaparecido',
        nota: v.tipo === 'falso'
          ? 'Confirmed: it was pulled from the book without executing. It was fake.'
          : 'This wall is no longer in the book. Either it was fully consumed, or whoever placed it pulled it.',
        prioridad: 30, vivo: false
      });
    }
  });

  nuevos.sort((a, b) => {
    const pa = a.prioridad - Math.abs(a.dist) * 900;
    const pb = b.prioridad - Math.abs(b.dist) * 900;
    return pb - pa;
  });
  M.muros = nuevos.slice(0, 8);
}

/* Utilidades de formato */
const dinero = (v) => {
  const a = Math.abs(v);
  if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
  return '$' + v.toFixed(0);
};

const fmt = (p) => {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(8);
};

const tiempo = (s) => {
  if (s < 60) return Math.round(s) + 's';
  const m = Math.floor(s / 60);
  return m + ' min' + (m > 1 ? '' : '');
};

/* ══════════════════════════════════════════════════════════════
   DETECTOR DE ZONAS DE ACUMULACIÓN  (desde las VELAS)

   Dónde el precio LATERALIZÓ y se acumuló volumen = dónde los grandes
   construyeron posición. Esas zonas actúan como DEMANDA (si están debajo del
   precio) o como OFERTA (si están encima), y son los mejores puntos de
   RETESTEO. Se construye un PERFIL DE VOLUMEN: se reparte el volumen (en $) de
   cada vela por su rango, y las franjas con mucho más volumen que la media son
   las zonas. Se fusionan las contiguas, se puntúa su fuerza y se cuentan los
   TOQUES (cuántas velas volvieron a ella).

   Todo sale de las velas (klines), que llegan siempre y rápido: por eso las
   tarjetas se llenan en 1-2 s, sin depender del libro de órdenes.
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   ESTRUCTURAS DE ACUMULACIÓN / DISTRIBUCIÓN (cajas de rango)
   Detecta los tramos donde el precio OSCILA lateralmente dentro de un
   canal (acumulación o distribución), separados por impulsos. Estas cajas
   son las verdaderas zonas de reacción: el precio respeta sus bordes. Se
   dibujan como rectángulos y la herramienta de posición se ancla a ellos.
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   ZONAS SWING (ORDER BLOCKS) — lógica estructural
   Una zona válida es una ACUMULACIÓN / OSCILACIÓN en rango que precede a un
   IMPULSO que rompe la estructura previa. El impulso debe ser claramente mayor
   que el rango (2–3×). Según la dirección del impulso:
     · impulso ALCISTA  → zona de DEMANDA (soporte). Sirve para LARGOS.
     · impulso BAJISTA  → zona de OFERTA  (resistencia). Sirve para CORTOS.
   Solo se conservan las zonas RELEVANTES al precio actual (demanda por debajo,
   oferta por encima) y NO MITIGADAS (el precio no las ha perforado todavía).
   Se proyectan hacia la derecha (niveles vigentes).
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   TENDENCIA (Fase 1) — portado de Smart Levels (motor.js), que la detecta
   muy bien por ESTRUCTURA (máximos/mínimos crecientes o decrecientes).
   · pivotesLEA: giros locales (swing highs/lows) con respaldo por tramos.
   · tendenciaLEA: alcista si máximos y mínimos suben; bajista si bajan.
   ══════════════════════════════════════════════════════════════ */
function pivotesLEA(velas, lado = 3) {
  const altos = [], bajos = [];
  for (let i = lado; i < velas.length - lado; i++) {
    const v = velas[i];
    let esAlto = true, esBajo = true;
    for (let j = i - lado; j <= i + lado; j++) {
      if (j === i) continue;
      if (velas[j].h > v.h) esAlto = false;
      if (velas[j].l < v.l) esBajo = false;
    }
    if (esAlto && velas[i - 1].h < v.h && velas[i + 1].h < v.h) altos.push({ i, p: v.h, t: v.t });
    if (esBajo && velas[i - 1].l > v.l && velas[i + 1].l > v.l) bajos.push({ i, p: v.l, t: v.t });
  }
  // Respaldo para tendencias sostenidas (sin pivotes locales): extremos por tramos.
  if (altos.length < 2 || bajos.length < 2) {
    const bloques = 8, paso = Math.max(6, Math.floor(velas.length / bloques));
    for (let ini = 0; ini + paso <= velas.length; ini += paso) {
      const tramo = velas.slice(ini, ini + paso);
      let iA = 0, iB = 0;
      tramo.forEach((v, k) => { if (v.h > tramo[iA].h) iA = k; if (v.l < tramo[iB].l) iB = k; });
      const gA = ini + iA, gB = ini + iB;
      if (!altos.some((x) => Math.abs(x.i - gA) < 3)) altos.push({ i: gA, p: velas[gA].h, t: velas[gA].t });
      if (!bajos.some((x) => Math.abs(x.i - gB) < 3)) bajos.push({ i: gB, p: velas[gB].l, t: velas[gB].t });
    }
    altos.sort((a, b) => a.i - b.i); bajos.sort((a, b) => a.i - b.i);
  }
  return { altos, bajos };
}
function tendenciaLEA(velas, piv) {
  const ua = piv.altos.slice(-3), ub = piv.bajos.slice(-3);
  if (ua.length < 2 || ub.length < 2) {
    const n0 = Math.min(50, velas.length), tr = velas.slice(-n0);
    const mv = ((tr[tr.length - 1].c - tr[0].c) / tr[0].c) * 100;
    if (mv > 1.5) return { dir: 'alcista', fuerza: Math.min(100, mv * 10) };
    if (mv < -1.5) return { dir: 'bajista', fuerza: Math.min(100, -mv * 10) };
    return { dir: 'lateral', fuerza: 0 };
  }
  const altosSuben = ua[ua.length - 1].p > ua[ua.length - 2].p;
  const bajosSuben = ub[ub.length - 1].p > ub[ub.length - 2].p;
  const altosBajan = ua[ua.length - 1].p < ua[ua.length - 2].p;
  const bajosBajan = ub[ub.length - 1].p < ub[ub.length - 2].p;
  const n = Math.min(60, velas.length), tramo = velas.slice(-n);
  const mov = ((tramo[tramo.length - 1].c - tramo[0].c) / tramo[0].c) * 100;
  if (altosSuben && bajosSuben) return { dir: 'alcista', fuerza: Math.min(100, Math.abs(mov) * 12) };
  if (altosBajan && bajosBajan) return { dir: 'bajista', fuerza: Math.min(100, Math.abs(mov) * 12) };
  return { dir: 'lateral', fuerza: 0 };
}
/* Tendencia de CORTO PLAZO por CANAL DE REGRESIÓN (filtra el ruido, como el
   canal paralelo que traza el trader). Se ancla al último SWING significativo:
   si el mínimo mayor es más antiguo que el máximo mayor, el tramo es alcista
   (desde ese mínimo); si es al revés, bajista. Sobre ese tramo se ajusta una
   recta de regresión (la tendencia limpia) y un canal ±desviación. */
function _regresion(seg) {
  const n = seg.length; if (n < 3) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { const y = seg[i].c; sx += i; sy += y; sxy += i * y; sxx += i * i; }
  const den = n * sxx - sx * sx; if (Math.abs(den) < 1e-9) return null;
  const m = (n * sxy - sx * sy) / den;         // pendiente (precio por vela)
  const b = (sy - m * sx) / n;                  // intercepto
  let arriba = 0, abajo = 0, ss = 0;
  for (let i = 0; i < n; i++) {
    const yLin = m * i + b;
    arriba = Math.max(arriba, seg[i].h - yLin);  // cuánto sobresale por encima
    abajo = Math.max(abajo, yLin - seg[i].l);    // cuánto por debajo
    const d = seg[i].c - yLin; ss += d * d;
  }
  return { m, b, n, arriba, abajo, sd: Math.sqrt(ss / n) };
}
/* ══════════════════════════════════════════════════════════════
   FASE 3 · CONFLUENCIA + EVENTO DE ENTRADA
   1) Confluencia: dónde se cruzan el riel operativo del corto plazo y la línea
      central jerárquica (el vértice del triángulo).
   2) Ruptura con impulso: cerca de la confluencia, el precio rompe la línea de
      corto plazo con cuerpo de vela y 2-3 velas largas.
   3) Retesteo: tras la ruptura, el precio vuelve a la línea rota → gatillo de
      entrada, a favor de la dirección de la ruptura.
   ══════════════════════════════════════════════════════════════ */
function calcEvento() {
  const velas = M.velas;
  if (!velas || velas.length < 40) return null;
  const n = velas.length;
  const K = 8;                                        // ventana reciente donde se busca la ruptura
  // Línea de referencia: la tendencia de corto plazo tal como estaba ANTES de la
  // ventana de ruptura (para que la ruptura sea un evento y no se auto-borre al
  // reajustarse la recta).
  const ref = _canalTendencia(velas.slice(0, n - K), 90);
  if (!ref || !ref.canal || ref.dir === 'lateral') return null;
  const C = ref.canal, dtC = C.t1 - C.t0;
  if (!dtC) return null;
  const mC = (C.p1 - C.p0) / dtC;                      // pendiente del centro (precio/ms)
  const alc = ref.dir === 'alcista';
  const offOp = alc ? -C.abajo : C.arriba;             // riel operativo (el que da la cara)
  const opA = C.p0 + offOp - mC * C.t0;                // intercepto absoluto del riel
  const lineaOp = (t) => opA + mC * t;                 // precio del riel en el tiempo t
  const tNow = velas[n - 1].t;
  const tfMs = M._geo ? M._geo.tfMs : (velas.length > 1 ? velas[1].t - velas[0].t : 1);
  const ev = { confluencia: null, ruptura: null, senal: null, dir: null, lineaOp: { opA, mC } };

  // 1) CONFLUENCIA con la línea central jerárquica.
  const TJ = M._tendJerar;
  if (TJ && TJ.canal && TJ.dir !== 'lateral') {
    const J = TJ.canal, dtJ = J.t1 - J.t0;
    if (dtJ) {
      const mJ = (J.p1 - J.p0) / dtJ, jA = J.p0 - mJ * J.t0;
      if (Math.abs(mC - mJ) > 1e-18) {
        const tX = (jA - opA) / (mC - mJ);
        const pX = opA + mC * tX;
        if (tX > tNow - 25 * tfMs && tX < tNow + 90 * tfMs) ev.confluencia = { t: tX, precio: pX };
      }
    }
  }

  // 2) RUPTURA del riel operativo con IMPULSO (contra el corto: si el corto sube,
  //    la ruptura relevante es hacia abajo, y viceversa).
  const rupturaAbajo = alc;
  let sumaCuerpo = 0, cnt = 0;
  for (let k = Math.max(1, n - 70); k < n - K; k++) { sumaCuerpo += Math.abs(velas[k].c - velas[k].o); cnt++; }
  const cuerpoMed = cnt ? sumaCuerpo / cnt : 0;
  for (let k = n - K; k < n; k++) {
    const v = velas[k], pL = lineaOp(v.t), pLprev = lineaOp(velas[k - 1].t);
    const rompe = rupturaAbajo ? (v.c < pL && velas[k - 1].c >= pLprev)
                               : (v.c > pL && velas[k - 1].c <= pLprev);
    if (!rompe) continue;
    let largas = 0;
    for (let j = k; j < Math.min(n, k + 3); j++) {
      const cuerpo = velas[j].c - velas[j].o;
      const enDir = rupturaAbajo ? cuerpo < 0 : cuerpo > 0;
      if (enDir && Math.abs(cuerpo) > cuerpoMed * 1.3) largas++;
    }
    if (largas >= 2) {
      ev.ruptura = { i: k, t: v.t, precio: pL, dir: rupturaAbajo ? 'bajista' : 'alcista' };
      ev.dir = rupturaAbajo ? 'short' : 'long';
      break;
    }
  }

  // 3) RETESTEO tras la ruptura: el precio se aleja (impulso) y regresa a la línea.
  if (ev.ruptura) {
    const r = ev.ruptura, tol = (velas[n - 1].c || 1) * 0.0015;
    let alejo = false, retesteo = false;
    for (let k = r.i + 1; k < n; k++) {
      const pL = lineaOp(velas[k].t), dist = Math.abs(velas[k].c - pL);
      if (!alejo && dist > tol * 3) alejo = true;
      if (alejo && dist <= tol) { retesteo = true; break; }
    }
    ev.senal = { tipo: ev.dir, estado: retesteo ? 'retesteo' : 'esperando_retesteo',
                 precioEntrada: lineaOp(tNow) };
  }
  // 4) ZONA SWING (Fase 4): la ACUMULACIÓN que hubo justo antes de la ruptura.
  //    Se proyecta como rectángulo y de ella salen las entradas.
  if (ev.ruptura) {
    const kR = ev.ruptura.i, baj = ev.ruptura.dir === 'bajista';
    // Impulso: cuánto recorrió el precio tras la ruptura (para el R:R y el ancho).
    let ext = baj ? velas[kR].l : velas[kR].h;
    for (let k = kR; k < Math.min(n, kR + 8); k++) ext = baj ? Math.min(ext, velas[k].l) : Math.max(ext, velas[k].h);
    const impulso = Math.abs(ext - ev.ruptura.precio);
    // Rango de acumulación: se extiende hacia atrás desde la vela previa a la
    // ruptura mientras el rango se mantenga estrecho respecto al impulso.
    let a = kR - 1;
    if (a > 4 && impulso > 0) {
      // Semilla: las últimas ~4 velas antes de la ruptura definen la banda inicial.
      let seed = Math.max(0, a - 3);
      let hi = velas[seed].h, lo = velas[seed].l, cHi = velas[seed].c, cLo = velas[seed].c;
      for (let k = seed; k <= a; k++) { hi = Math.max(hi, velas[k].h); lo = Math.min(lo, velas[k].l); cHi = Math.max(cHi, velas[k].c); cLo = Math.min(cLo, velas[k].c); }
      a = seed;
      const tope = Math.max(2, a - 20);
      // Se extiende hacia atrás mientras siga siendo OSCILACIÓN. Se corta cuando:
      //  · un cierre se sale de la banda (holgura fija ligada al impulso), o
      //  · aparecen 3 cierres seguidos en deriva monótona (el tramo tendencial
      //    que entró a la acumulación).
      const tol = impulso * 0.15;
      let mono = 0, prevC = velas[a].c;
      while (a > tope) {
        const cPrev = velas[a - 1].c;
        if (cPrev > cHi + tol || cPrev < cLo - tol) break;
        // deriva monótona hacia el mismo lado (yendo hacia atrás = subiendo hacia la acumulación)
        if (cPrev < prevC - tol * 0.4) mono++; else if (cPrev > prevC + tol * 0.4) mono++; else mono = 0;
        if (mono >= 3) break;
        const nHi = Math.max(hi, velas[a - 1].h), nLo = Math.min(lo, velas[a - 1].l);
        if ((nHi - nLo) > impulso * 1.1) break;
        hi = nHi; lo = nLo; cHi = Math.max(cHi, cPrev); cLo = Math.min(cLo, cPrev); prevC = cPrev; a--;
      }
      const ancho = hi - lo;
      if (ancho > 0 && (kR - a) >= 3) {
        const ratio = ancho / impulso;
        // Regla de la zona ancha: <50% → 1:2 ; 50-70% → 1:1 ; >70% → no operar.
        let rr = 2;
        if (ratio > 0.7) rr = 0;
        else if (ratio >= 0.5) rr = 1;
        let plan = null;
        if (rr > 0) {
          const margen = ancho * 0.15, riesgo = ancho;
          if (baj) {
            // corto: entrada 1 en la línea INFERIOR, entrada 2 en la SUPERIOR (donde va el SL de la 1)
            const e1 = lo, e2 = hi, sl = hi, tp = e1 - rr * riesgo;
            plan = { rr, short: true, e1, e2, sl, slE2: hi + margen, tp };
          } else {
            // largo: entrada 1 en la línea SUPERIOR, entrada 2 en la INFERIOR (donde va el SL de la 1)
            const e1 = hi, e2 = lo, sl = lo, tp = e1 + rr * riesgo;
            plan = { rr, short: false, e1, e2, sl, slE2: lo - margen, tp };
          }
        }
        ev.zona = { hi, lo, t0: velas[a].t, ancho, impulso, ratio, plan };
      }
    }
  }
  return ev;
}

function calcTendenciaCorto() { return _canalTendencia(M.velas, 90); }   // ventana FIJA: no cambia con el zoom
/* Tendencia JERÁRQUICA: mismo canal por regresión, pero sobre las velas de la
   temporalidad grande y vistas "de lejos" (ventana amplia) para filtrar ruido. */
function calcTendenciaJerar() {
  const v = M._velasJerar;
  if (!v || v.length < 30) return null;
  return _canalTendencia(v, Math.min(v.length, 180));
}
/* Canal por regresión genérico: se ancla al swing vigente y ajusta una recta
   (tendencia limpia) con rieles ±desviación (el canal que filtra el ruido). */
function _canalTendencia(velas, N) {
  if (!velas || velas.length < 24) return null;
  N = Math.min(velas.length, Math.max(40, N));
  const win = velas.slice(-N);
  let iLo = 0, iHi = 0;
  for (let k = 1; k < win.length; k++) { if (win[k].l < win[iLo].l) iLo = k; if (win[k].h > win[iHi].h) iHi = k; }
  const reciente = Math.max(iLo, iHi), antiguo = Math.min(iLo, iHi);
  const legLen = win.length - reciente;
  const esReversion = (reciente <= win.length - 8) && (legLen >= win.length * 0.25);
  let ini = esReversion ? reciente : antiguo;
  ini = Math.max(0, Math.min(ini, win.length - 8));
  const seg = win.slice(ini);
  if (seg.length < 5) return { dir: 'lateral', canal: null };
  const R = _regresion(seg);
  if (!R) return { dir: 'lateral', canal: null };
  const precio = velas[velas.length - 1].c || 1;
  const subeTramo = R.m * R.n;
  const umbral = precio * 0.004;
  let dir = 'lateral';
  if (subeTramo > umbral) dir = 'alcista';
  else if (subeTramo < -umbral) dir = 'bajista';
  const t0 = win[ini].t, t1 = win[win.length - 1].t;
  return { dir, canal: { m: R.m, b: R.b, n: R.n, arriba: R.arriba, abajo: R.abajo, sd: R.sd,
                         t0, t1, p0: R.b, p1: R.m * (R.n - 1) + R.b } };
}

/* ══════════════════════════════════════════════════════════════
   MAPA DE CALOR DE LA ZONA SWING
   Paleta IDÉNTICA a la de Liquidity Pools (mismos escalones), pero dibujada
   DENTRO de cada zona, de izquierda a derecha (desde que nace el rectángulo).
   Cada zona tiene su banda "caliente" (roja) como área de interés, en una
   posición y con una textura que varían por zona (semilla estable), para que
   se vea real. Las velas se dibujan DESPUÉS, así la acumulación no se tapa.
   ══════════════════════════════════════════════════════════════ */
const _ESCALONES = [
  { hasta: 0.20, c: [10, 36, 92] },     // azul oscuro
  { hasta: 0.40, c: [30, 74, 168] },    // azul
  { hasta: 0.58, c: [56, 130, 220] },   // azul claro
  { hasta: 0.76, c: [8, 190, 12] },     // verde
  { hasta: 0.89, c: [228, 229, 5] },    // amarillo
  { hasta: 0.96, c: [255, 132, 0] },    // naranja (solo junto al rojo)
  { hasta: 1.01, c: [255, 0, 0] }       // rojo
];
function _calor(v) {
  if (v <= 0) return null;
  const p = Math.max(0, Math.min(1, v));
  for (const e of _ESCALONES) if (p <= e.hasta) return e.c;
  return _ESCALONES[_ESCALONES.length - 1].c;
}
function dibujarCalorZona(g, Z, xAcumIni, xR, yTop, yBot, mXt, paso) {
  const H = yBot - yTop;
  if (xR - xAcumIni < 4 || H < 4) return;
  const nRows = Math.max(14, Math.min(60, Math.floor(H / 2.5)));
  const seed = ((Math.abs(Math.floor(Z.t0 / 1000)) % 997) / 997);
  const cl = (x, a, b) => Math.max(a, Math.min(b, x));
  const rango = Z.hi - Z.lo || 1;
  // NODOS calientes: ROJO con MUCHO cuerpo, amarillo ancho alrededor.
  const baseFrac = Z.dir === 'demanda' ? 0.66 : 0.34;
  const cen = cl(baseFrac + (seed - 0.5) * 0.24, 0.2, 0.8);
  const nodos = [
    { f: cen, s: 1.8 }, { f: cl(cen + 0.09 + seed * 0.04, 0.1, 0.9), s: 1.5 },
    { f: cl(cen - 0.10 - seed * 0.03, 0.1, 0.9), s: 1.45 },
    { f: cl(cen + 0.20, 0.1, 0.9), s: 1.05 }, { f: cl(cen - 0.22, 0.1, 0.9), s: 1.0 }
  ];
  const spread = 0.11 + seed * 0.03;
  const rowHot = Math.round((1 - cen) * nRows - 0.5);
  const velas = Z.velasAnc || Z.velas || [];
  const medio = paso ? paso / 2 : 3;
  const xIzq = Z.t0 != null ? mXt(Z.t0) + medio : xAcumIni;   // límite izquierdo: inicio de la zona (no se pasa de ahí)
  for (let r = 0; r < nRows; r++) {
    const frac = 1 - (r + 0.5) / nRows;                 // 1 arriba, 0 abajo
    const pRow = Z.lo + frac * rango;
    let base = 0;
    for (const nd of nodos) { const d = (frac - nd.f) / spread; base = Math.max(base, nd.s * Math.exp(-d * d)); }
    if (r === rowHot) base = Math.max(base, 1.3);       // rojo garantizado, con cuerpo
    base = Math.max(0.16, base * 0.97 + 0.06);          // SIEMPRE se pinta (rellena todo el rectángulo)
    // ESCALONADO: cada fila nace en el borde DERECHO de la vela MÁS RECIENTE que
    // tocó ese nivel de precio (adaptado a la estructura). Acotado entre el
    // inicio de la zona y el borde derecho, así no sale con corte recto ni se va
    // más allá de la estructura.
    let xIni = xAcumIni;
    for (let k = velas.length - 1; k >= 0; k--) {
      const v = velas[k];
      if (pRow <= v.h && pRow >= v.l) { xIni = mXt(v.t) + medio; break; }
    }
    xIni = cl(xIni, xIzq, xR - 2);
    const y = yTop + (r / nRows) * H, hh = Math.max(1, H / nRows + 0.7);
    // Gradiente SOPLETE: rojo con cuerpo → amarillo → verde → azul al final.
    const grad = g.createLinearGradient(xIni, 0, xR, 0);
    const stops = 8;
    for (let s2 = 0; s2 <= stops; s2++) {
      const t = s2 / stops;
      const v = base * Math.pow(1 - t, 1.05);           // el rojo aguanta más antes de enfriar
      const rgb = _calor(Math.max(0.05, v));
      if (rgb) grad.addColorStop(t, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.66 * (1 - 0.22 * t)})`);
    }
    g.fillStyle = grad;
    g.fillRect(xIni, y, xR - xIni, hh);
  }
}

function detectarEstructuras(velas) {
  const n = velas ? velas.length : 0;
  if (n < 30) return [];
  const precio = velas[n - 1].c || velas[n - 1].o || 1;
  // Volatilidad reciente (ATR simple): todo se mide relativo a ella, así el
  // detector funciona igual en 5m que en diario o semanal (donde los rangos y
  // los impulsos son mucho más grandes).
  let sumR = 0, cR = 0;
  for (let k = Math.max(1, n - 60); k < n; k++) { sumR += Math.abs(velas[k].h - velas[k].l); cR++; }
  const atr = cR ? sumR / cR : precio * 0.005;
  const K = 6;                          // ventana del impulso
  const MINIMP = Math.max(precio * 0.0025, atr * 1.6);   // impulso mínimo relativo a la volatilidad (más permisivo → más zonas)
  const brutas = [];
  let i = 8;
  // 1) IMPULSO + la OSCILACIÓN (acumulación) que lo precede.
  while (i < n - 3) {
    const desde = velas[i - 1].c;
    let hasta = desde;
    for (let k = i; k < Math.min(n, i + K); k++) hasta = velas[k].c;
    const mov = hasta - desde;
    if (Math.abs(mov) < MINIMP) { i++; continue; }
    const imp = Math.abs(mov);
    // Rango de acumulación CEÑIDO: se extiende hacia atrás solo mientras el precio
    // siga oscilando en la misma banda. Se corta cuando un cierre se sale de la
    // banda (holgura fija) o aparece deriva monótona (el tramo tendencial que
    // entró a la acumulación). Así la zona no se infla hacia atrás.
    let a = i - 1;
    let hi = velas[a].h, lo = velas[a].l, cHi = velas[a].c, cLo = velas[a].c;
    const tol = imp * 0.18, tope2 = Math.max(0, a - 18);
    let prevC = velas[a].c, mono = 0;
    while (a > tope2) {
      const cP = velas[a - 1].c;
      if (cP > cHi + tol || cP < cLo - tol) break;
      if (cP < prevC - tol * 0.5) mono++; else if (cP > prevC + tol * 0.5) mono++; else mono = 0;
      if (mono >= 3) break;
      const nHi = Math.max(hi, velas[a - 1].h), nLo = Math.min(lo, velas[a - 1].l);
      if ((nHi - nLo) > imp * 0.55) break;
      hi = nHi; lo = nLo; cHi = Math.max(cHi, cP); cLo = Math.min(cLo, cP); prevC = cP; a--;
    }
    const len = i - a, alt = hi - lo;
    // OSCILACIÓN real: el cierre cruza la media del rango varias veces (zigzag).
    let cruces = 0, lado = null; const mid = (hi + lo) / 2;
    for (let k = a; k <= i - 1; k++) { const l2 = velas[k].c >= mid ? 1 : 0; if (lado !== null && l2 !== lado) cruces++; lado = l2; }
    // La zona tiene que ser un rango real (al menos ~0.4 ATR de alto). El máximo
    // ya lo limita el impulso, así que se adapta solo a cada temporalidad.
    if (len >= 3 && cruces >= 2 && alt >= atr * 0.35) {
      const dir = mov > 0 ? 'demanda' : 'oferta';   // impulso alcista → demanda; bajista → oferta
      const _vz = velas.slice(a, i);
      const liq = _vz.reduce((s, v) => s + (v.vol || 0), 0);
      const liqC = _vz.reduce((s, v) => s + (v.volC || 0), 0);
      // Se guardan también las velas del IMPULSO (hasta i+K): son las que cubren
      // los niveles más recientes y permiten que el color nazca escalonado del
      // borde derecho de la vela correcta, sin cortes rectos.
      const velasAnc = velas.slice(a, Math.min(n, i + K));
      brutas.push({ i0: a, i1: i - 1, hi, lo, t0: velas[a].t, t1: velas[i - 1].t, dir, imp, velas: _vz, velasAnc, liq, liqC });
      i += K; continue;
    }
    i++;
  }
  // 2) RELEVANCIA + NO MITIGADA + CERCANÍA respecto al precio actual.
  const holgura = precio * 0.0006;
  const maxDist = Math.max(precio * 0.05, atr * 9);   // más cerca: zonas realmente operables (nada de 30-48%)
  const validas = brutas.filter((z) => {
    const margen = (z.hi - z.lo) * 0.35;   // el precio puede asomar sin invalidar la zona (solo un cierre decidido la rompe)
    if (z.dir === 'demanda') {
      if (z.lo >= precio) return false;                            // quedó detrás
      if (precio - z.hi > maxDist) return false;                   // demasiado lejos
      for (let k = z.i1 + 1; k < n; k++) if (velas[k].c < z.lo - margen) return false;  // perforada de verdad
      return true;
    }
    if (z.hi <= precio) return false;                              // quedó detrás
    if (z.lo - precio > maxDist) return false;                     // demasiado lejos
    for (let k = z.i1 + 1; k < n; k++) if (velas[k].c > z.hi + margen) return false;    // perforada de verdad
    return true;
  });
  // 3) Plan de cada zona (entradas + R:R con la regla de la zona ancha).
  validas.forEach((z) => {
    const ancho = z.hi - z.lo, ratio = z.imp > 0 ? ancho / z.imp : 1;
    let rr = 2; if (ratio > 0.7) rr = 0; else if (ratio >= 0.5) rr = 1;
    z.ratio = ratio; z.rr = rr;
    if (rr > 0) {
      const margen = ancho * 0.15;
      if (z.dir === 'oferta') { z.e1 = z.lo; z.e2 = z.hi; z.sl = z.hi; z.slE2 = z.hi + margen; z.tp = z.lo - rr * ancho; }
      else { z.e1 = z.hi; z.e2 = z.lo; z.sl = z.lo; z.slE2 = z.lo - margen; z.tp = z.hi + rr * ancho; }
    }
  });
  // Varias zonas a cada lado, de la más cercana al precio a la más lejana.
  const dem = validas.filter((z) => z.dir === 'demanda').sort((a, b) => b.hi - a.hi).slice(0, 4);
  const ofe = validas.filter((z) => z.dir === 'oferta').sort((a, b) => a.lo - b.lo).slice(0, 4);
  return dem.concat(ofe);
}

function detectarZonas(velas, precio, opts) {
  opts = opts || {};
  if (!velas || velas.length < 24 || !(precio > 0)) return { zonas: [], perfil: null };
  const vis = velas.slice(-260);
  let lo = Infinity, hi = -Infinity;
  vis.forEach((v) => { if (v.l < lo) lo = v.l; if (v.h > hi) hi = v.h; });
  if (!(hi > lo)) return { zonas: [], perfil: null };
  const N = 90;
  const paso = (hi - lo) / N;
  const vol = new Array(N).fill(0);
  const volC = new Array(N).fill(0);        // parte compradora
  const toca = new Array(N).fill(0);
  vis.forEach((v) => {
    const b0 = Math.max(0, Math.floor((v.l - lo) / paso));
    const b1 = Math.min(N - 1, Math.floor((v.h - lo) / paso));
    const spread = (b1 - b0 + 1) || 1;
    const cuota = (v.vol || 1) / spread;
    // Si no hay taker-buy, se estima por el color de la vela (verde=más compra).
    const compra = v.volC > 0 ? v.volC : (v.vol || 1) * (v.c >= v.o ? 0.55 : 0.45);
    const cuotaC = compra / spread;
    for (let b = b0; b <= b1; b++) { vol[b] += cuota; volC[b] += cuotaC; toca[b]++; }
  });
  const maxBin = Math.max(...vol, 1);
  const media = vol.reduce((a, b) => a + b, 0) / N || 1;
  const umbral = media * 1.4;
  /* PICOS del perfil = nodos de alto volumen. Cada pico se expande a zona
     mientras el volumen siga alto (>=45% del pico) y sin pasarse de ancho. */
  const picos = [];
  for (let b = 0; b < N; b++) {
    const izq = b === 0 ? -Infinity : vol[b - 1];
    const der = b === N - 1 ? -Infinity : vol[b + 1];
    if (vol[b] >= umbral && vol[b] >= izq && vol[b] >= der) picos.push(b);
  }
  picos.sort((a, b) => vol[b] - vol[a]);
  const usados = new Array(N).fill(false);
  const maxW = Math.max(2, Math.round(N * 0.06));
  const brutas = [];
  picos.forEach((pk) => {
    if (usados[pk]) return;
    let b0 = pk, b1 = pk;
    const piso = vol[pk] * 0.5;
    while (b0 > 0 && !usados[b0 - 1] && vol[b0 - 1] >= piso && (pk - (b0 - 1)) <= maxW) b0--;
    while (b1 < N - 1 && !usados[b1 + 1] && vol[b1 + 1] >= piso && ((b1 + 1) - pk) <= maxW) b1++;
    let v = 0, vc = 0, t = 0;
    for (let b = b0; b <= b1; b++) { v += vol[b]; vc += volC[b]; t += toca[b]; usados[b] = true; }
    brutas.push({ b0, b1, v, vc, t, pk });
  });
  const perfil = { vol, lo, hi, N, max: maxBin };
  if (!brutas.length) return { zonas: [], perfil };
  const maxV = Math.max(...brutas.map((z) => z.v), 1);
  const ult = vis[vis.length - 1];
  const cierre = ult ? ult.c : precio;
  const htf = opts.htf || [];
  const libro = opts.libro || null;
  const margen = (hi - lo) * 0.01;

  const zonas = brutas.map((z) => {
    const pLow = lo + z.b0 * paso;
    const pHigh = lo + (z.b1 + 1) * paso;
    const p = (pLow + pHigh) / 2;
    const pPoc = lo + (z.pk + 0.5) * paso;              // punto de control (máx volumen)
    const dentro = precio >= pLow && precio <= pHigh;
    const lado = p < precio ? 'demanda' : 'oferta';
    const dist = (p - precio) / precio;
    const retest = !dentro && Math.abs(dist) < 0.0035;

    // 1) VOLUMEN FIRMADO
    const compradorPct = z.v > 0 ? Math.max(0, Math.min(1, z.vc / z.v)) : 0.5;
    const alineado = lado === 'demanda' ? compradorPct >= 0.5 : compradorPct <= 0.5;

    // 2) REACCIONES (rechazos reales): mecha dentro de la zona, cuerpo fuera
    let reacciones = 0;
    vis.forEach((v) => {
      if (lado === 'demanda') {
        if (v.l <= pHigh && v.l >= pLow - paso && Math.min(v.o, v.c) > pHigh) reacciones++;
      } else {
        if (v.h >= pLow && v.h <= pHigh + paso && Math.max(v.o, v.c) < pLow) reacciones++;
      }
    });

    // 4) RUPTURA / FLIP: el precio estaba en/junto a la zona y la perforó hace poco
    const recientes = vis.slice(-16);
    const antes = recientes.length ? recientes[0].c : cierre;
    let rota = false;
    if (antes >= pLow && cierre < pLow - margen * 0.5) rota = true;   // rompió hacia abajo
    if (antes <= pHigh && cierre > pHigh + margen * 0.5) rota = true; // rompió hacia arriba

    // 5) CONFLUENCIA MULTI-TEMPORALIDAD
    const confluencia = htf.some((h) => h.pHigh >= pLow && h.pLow <= pHigh);

    // 6) CONFIRMACIÓN CON EL LIBRO EN VIVO
    let libroConf = false;
    if (libro && libro.muros) libroConf = libro.muros.some((m) => m >= pLow && m <= pHigh);

    // CONFIANZA combinada (0..100)
    let conf = (z.v / maxV) * 34;
    conf += Math.min(20, reacciones * 6);
    conf += alineado ? 16 : 0;
    conf += confluencia ? 16 : 0;
    conf += libroConf ? 10 : 0;
    conf += Math.min(4, z.t / 20);
    if (rota) conf *= 0.35;
    conf = Math.max(0, Math.min(100, Math.round(conf)));
    const fuerza = Math.max(1, Math.min(5, Math.round(conf / 20)));

    return {
      pLow, pHigh, p, pPoc, v: z.v, volRel: z.v / maxV,
      compradorPct, reacciones, confluencia, libro: libroConf, rota, alineado,
      confianza: conf, fuerza, toques: z.t, lado, dist, retest, dentro
    };
  });

  /* FUSIÓN de zonas apiladas: cuando dos zonas del MISMO lado quedan pegadas
     (rango casi tocándose), son un solo nivel fragmentado y se unen. PERO con
     TOPE DE ANCHO: nunca se encadenan tantas que formen una banda gigante
     (eso confunde más que ayuda). Si la zona resultante superaría el ancho
     máximo, se dejan separadas. */
  const anchoMax = Math.max((hi - lo) * 0.10, precio * 0.012);   // tope de ancho de una zona fusionada
  const fusionar = (lista) => {
    const orden = lista.slice().sort((a, b) => a.pLow - b.pLow);
    const out = [];
    orden.forEach((z) => {
      const prev = out[out.length - 1];
      const gap = prev ? (z.pLow - prev.pHigh) / (precio || 1) : Infinity;
      const anchoUnido = prev ? (Math.max(prev.pHigh, z.pHigh) - Math.min(prev.pLow, z.pLow)) : Infinity;
      if (prev && prev.lado === z.lado && gap <= 0.004 && anchoUnido <= anchoMax) {
        const vTot = prev.v + z.v;
        prev.pPoc = prev.v >= z.v ? prev.pPoc : z.pPoc;      // POC del sub-nodo mayor
        prev.pLow = Math.min(prev.pLow, z.pLow);
        prev.pHigh = Math.max(prev.pHigh, z.pHigh);
        prev.p = (prev.pLow + prev.pHigh) / 2;
        prev.compradorPct = (prev.compradorPct * prev.v + z.compradorPct * z.v) / vTot;
        prev.v = vTot;
        prev.reacciones += z.reacciones;
        prev.toques += z.toques;
        prev.confluencia = prev.confluencia || z.confluencia;
        prev.libro = prev.libro || z.libro;
        prev.alineado = prev.compradorPct >= 0.5 ? prev.lado === 'demanda' : prev.lado === 'oferta';
        prev.confianza = Math.min(100, Math.max(prev.confianza, z.confianza) + 4);
        prev.fuerza = Math.max(1, Math.min(5, Math.round(prev.confianza / 20)));
        prev.rota = prev.rota && z.rota;
        prev.dentro = prev.dentro || z.dentro;
        prev.dist = (prev.p - precio) / precio;
        prev.retest = !prev.dentro && Math.abs(prev.dist) < 0.0035;
      } else {
        out.push(Object.assign({}, z));
      }
    });
    return out;
  };
  const zonasF = fusionar(zonas);
  zonas.length = 0; Array.prototype.push.apply(zonas, zonasF);

  /* SOLO ZONAS OPERABLES. El mayor volumen se acumula en el CENTRO de la
     oscilación (donde el precio pasó más tiempo), pero eso NO es soporte ni
     resistencia: es trayectoria, no ubicación. Las zonas de reacción reales
     están en los EXTREMOS del rango (máximos = resistencia, mínimos = soporte)
     o donde el precio RECHAZÓ (mechas). Se descartan los nodos del medio sin
     rechazos: son ruido y confunden al trader. */
  {
    const rec = vis.slice(-90);
    const recHi = rec.length ? Math.max.apply(null, rec.map((v) => v.h)) : hi;
    const recLo = rec.length ? Math.min.apply(null, rec.map((v) => v.l)) : lo;
    const recRango = Math.max(1e-9, recHi - recLo);
    const posRel = (z) => (z.pPoc - recLo) / recRango;            // 0 = mínimo, 1 = máximo
    const operable = (z) => {
      if (z.dentro) return true;                                  // el precio está aquí ahora
      const pr = posRel(z);
      if (pr >= 0.66 || pr <= 0.34) return true;                  // tercio superior (R) o inferior (S)
      if (z.reacciones >= 3) return true;                         // rechazos fuertes en cualquier nivel
      return false;                                               // nodo del centro sin rechazos → ruido
    };
    const filtradas = zonas.filter(operable);
    if (filtradas.length >= 2) { zonas.length = 0; Array.prototype.push.apply(zonas, filtradas); }
  }

  /* ANCLAJE: si es la moneda/temporalidad activa, se pegan las zonas a su sitio
     estable (no saltan ni cambian de ancho de golpe). */
  if (opts.ancla) anclarZonas(zonas, precio, opts.ancla);

  /* El alcance útil de una zona depende de la temporalidad: en 15m un 8% ya es
     lejos, pero en 1D los movimientos son mucho mayores y hay que abrir el
     rango, o el diario aparece vacío. Aun así, nunca tan lejos que sea ruido. */
  const CAP = { '1m': 0.05, '3m': 0.055, '5m': 0.06, '15m': 0.08, '30m': 0.10, '1h': 0.12, '2h': 0.16, '4h': 0.20, '6h': 0.24, '12h': 0.28, '1d': 0.30, '1w': 0.45 };
  const cerca = CAP[M.tf] || 0.12;
  const lejos = cerca * 1.5;
  let usar = zonas.filter((z) => z.dentro || Math.abs(z.dist) <= cerca);
  if (usar.length < 2) {
    const extra = zonas
      .filter((z) => usar.indexOf(z) < 0 && Math.abs(z.dist) <= lejos)
      .sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))
      .slice(0, 3 - usar.length);
    usar = usar.concat(extra);
  }
  usar.sort((a, b) => (b.confianza - Math.min(30, Math.abs(b.dist) * 900)) - (a.confianza - Math.min(30, Math.abs(a.dist) * 900)));
  return { zonas: usar.slice(0, 6), perfil };
}

/* Paleta del GRÁFICO según el tema. Solo cambia el "chrome" neutro (fondo,
   rejilla, ejes, velas); los colores semánticos (verde/rojo/dorado/azul de las
   zonas y niveles) se mantienen para que el significado no cambie. */
function pal() {
  return M.tema === 'claro'
    ? { fondo: '#eef1f5', rejilla: 'rgba(0,0,0,.05)', ejeBg: 'rgba(236,239,244,.96)', ejeBorde: 'rgba(0,0,0,.10)', ejeTxt: '#6b7480', velaUp: '#0a9e86', velaDown: '#e0424f' }
    : { fondo: '#0a0e14', rejilla: 'rgba(255,255,255,.03)', ejeBg: 'rgba(10,14,20,.94)', ejeBorde: 'rgba(255,255,255,.06)', ejeTxt: '#4a525c', velaUp: '#26a69a', velaDown: '#ef5350' };
}

/* De 15m sube a 1h, de 5m a 30m, etc. — para la confluencia multi-temporalidad. */
const TF_SUPERIOR = { '1m': '15m', '3m': '15m', '5m': '30m', '15m': '1h', '30m': '2h', '1h': '4h', '2h': '6h', '4h': '1d', '6h': '1d', '12h': '1w', '1d': '1w', '1w': '1w' };
/* Temporalidad JERÁRQUICA (largo plazo), con el salto grande que usa la
   estrategia: operar 15m→4h, 1h→diario, 5m→1h, 4h→diario, 1d→semanal. */
const TF_JERARQUICO = { '1m': '1h', '3m': '1h', '5m': '1h', '15m': '4h', '30m': '4h', '1h': '1d', '2h': '1d', '4h': '1d', '6h': '1w', '12h': '1w', '1d': '1w', '1w': '1w' };

/* ══════════════════════════════════════════════════════════════
   ANÁLISIS DE MERCADO — niveles institucionales + backtest

   Calcula, todo desde las velas (fiable e instantáneo):
   · VWAP anclado al inicio de la ventana (el precio medio ponderado por
     volumen: la referencia que miran las mesas).
   · ÁREA DE VALOR (VAH/VAL) y POC del perfil: el rango donde se negoció el
     70% del volumen.
   · MÁXIMO/MÍNIMO de sesión (~24 h).
   · SESGO del mercado por volumen firmado (comprador/vendedor).
   · BACKTEST: recorre el histórico y mide cuántas veces el precio, al llegar
     a un nodo de alto volumen, REBOTÓ de verdad (reacción ≥ 0,4%). Da una
     tasa de acierto con su muestra: números, no promesas.
   ══════════════════════════════════════════════════════════════ */
function analizarMercado(velas, precio, perfil) {
  if (!velas || velas.length < 30) return null;
  const vis = velas.slice(-260);
  // VWAP anclado
  let pv = 0, vv = 0;
  vis.forEach((v) => { const tp = (v.h + v.l + v.c) / 3; pv += tp * (v.vol || 0); vv += (v.vol || 0); });
  const vwap = vv > 0 ? pv / vv : precio;
  // Sesión ~24h (según nº de velas que caben)
  const ses = velas.slice(-96);
  let sHi = -Infinity, sLo = Infinity;
  ses.forEach((v) => { if (v.h > sHi) sHi = v.h; if (v.l < sLo) sLo = v.l; });
  // Sesgo por volumen firmado
  let vc = 0, vt = 0;
  vis.forEach((v) => { const comp = v.volC > 0 ? v.volC : (v.vol || 0) * (v.c >= v.o ? 0.55 : 0.45); vc += comp; vt += (v.vol || 0); });
  const compradorPct = vt > 0 ? vc / vt : 0.5;
  const sesgo = compradorPct >= 0.56 ? 'comprador' : compradorPct <= 0.44 ? 'vendedor' : 'neutral';

  // Área de valor (VAH/VAL) a partir del perfil: 70% del volumen alrededor del POC
  let vah = null, val = null, poc = null;
  if (perfil && perfil.vol) {
    const pf = perfil; const N = pf.N; const paso = (pf.hi - pf.lo) / N;
    let pocB = 0; for (let b = 1; b < N; b++) if (pf.vol[b] > pf.vol[pocB]) pocB = b;
    poc = pf.lo + (pocB + 0.5) * paso;
    const total = pf.vol.reduce((a, b) => a + b, 0);
    let acum = pf.vol[pocB], lo = pocB, hi = pocB;
    while (acum < total * 0.7 && (lo > 0 || hi < N - 1)) {
      const izq = lo > 0 ? pf.vol[lo - 1] : -1;
      const der = hi < N - 1 ? pf.vol[hi + 1] : -1;
      if (der >= izq) { hi++; acum += pf.vol[hi]; } else { lo--; acum += pf.vol[lo]; }
    }
    val = pf.lo + lo * paso; vah = pf.lo + (hi + 1) * paso;
  }

  // BACKTEST: reacciones históricas en nodos de alto volumen
  let aciertos = 0, muestra = 0;
  if (perfil && perfil.vol) {
    const pf = perfil; const N = pf.N; const paso = (pf.hi - pf.lo) / N;
    const media = pf.vol.reduce((a, b) => a + b, 0) / N || 1;
    for (let b = 0; b < N; b++) {
      if (pf.vol[b] < media * 1.5) continue;
      const nivel = pf.lo + (b + 0.5) * paso;
      // buscar toques históricos y ver si el precio reaccionó ≥0,4%
      for (let i = 5; i < vis.length - 5; i++) {
        const v = vis[i];
        const toca = v.l <= nivel + paso && v.h >= nivel - paso;
        if (!toca) continue;
        const desde = vis[i].c;
        let maxReac = 0;
        for (let j = i + 1; j <= Math.min(vis.length - 1, i + 6); j++) {
          maxReac = Math.max(maxReac, Math.abs(vis[j].c - desde) / desde);
        }
        muestra++;
        if (maxReac >= 0.004) aciertos++;
        i += 3; // no contar el mismo toque varias veces
      }
    }
  }
  const winRate = muestra >= 8 ? Math.round((aciertos / muestra) * 100) : null;

  return { vwap, vah, val, poc, sHi, sLo, sesgo, compradorPct, winRate, muestra };
}



/* Lazy-loader del módulo de noticias: si news.js no está cargado (por ejemplo,
   si no se subió el index.html actualizado), lo carga al vuelo y luego abre. */
function abrirNoticiasSeguro(cual) {
  const fn = () => { try { window.abrirCalendario && window.abrirCalendario(); } catch (_) {} };
  if (typeof window.abrirCalendario === 'function') { fn(); return; }
  if (document.getElementById('news-js-lazy')) { setTimeout(() => abrirNoticiasSeguro(cual), 300); return; }
  const s = document.createElement('script'); s.id = 'news-js-lazy'; s.src = 'assets/js/news.js?v=10';
  s.onload = fn;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════
   ABRIR
   ══════════════════════════════════════════════════════════════ */
export async function abrirMuros() {
  estilos();
  const prev = $('mu-overlay'); if (prev) prev.remove();

  // Estado limpio: cada apertura empieza de cero
  M.fotos = []; M.niveles = new Map(); M.muros = [];
  M.cargando = true; M.error = null; M.seleccionado = null; M.paso = 0;

  const d = document.createElement('div');
  d.id = 'mu-overlay';
  if (M.tema === 'claro') d.classList.add('mu-claro');
  d.innerHTML = `<div class="mu-bg"></div>
    <div class="mu-c">
      <div class="mu-barra">
        <button class="mu-sel" id="mu-sel">
          <i class="mu-logo" data-cg="${esc((PARES.find((p) => p.id === _par) || {}).cg || '')}"></i>
          <b>${esc(_par)}</b>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>

        <div class="mu-tfs">
          ${TFS.map((t) => `<button class="mu-tf ${t.id === M.tf ? 'on' : ''}" data-tf="${t.id}">${t.n}</button>`).join('')}
        </div>
        <button class="mu-tfchip" id="mu-tfchip" type="button" aria-label="Temporalidad">
          <b id="mu-tfchip-t">${esc((TFS.find((t) => t.id === M.tf) || TFS[0]).n)}</b>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>

        <div class="mu-px">
          <span>Precio ahora</span>
          <b id="mu-px-v">—</b>
        </div>

        <span id="mu-estado" class="mu-estado-err"></span>

        <div class="mu-der">
          <div class="mu-pos-split" id="mu-pos-split" title="Positions">
            <button class="mu-pos-half" id="mu-pos-single">Single</button>
            <button class="mu-pos-half" id="mu-pos-double">Double</button>
          </div>
          <button class="mu-share" id="mu-share" title="Share signal" disabled>Share signal</button>
          <button class="mu-ico" id="mu-cal" title="Economic calendar">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/></svg>
          </button>
          <button class="mu-ico" id="mu-tema" title="Tema claro/oscuro">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          </button>
          <button class="mu-ico" id="mu-foto" title="Compartir imagen">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.5"/></svg>
          </button>
          <button class="mu-ico mu-comofunciona" id="mu-ayuda" title="Cómo funciona">
            <span class="mu-cf-txt">Cómo funciona</span>
            <span class="mu-cf-sig">?</span>
          </button>
          <button class="mu-ico" id="mu-x" aria-label="Cerrar">✕</button>
        </div>
      </div>

      <div class="mu-mtabs" id="mu-mtabs">
        <button class="mu-mtab on" data-vista="graf" type="button">Gr\u00e1fica</button>
        <button class="mu-mtab" data-vista="ord" type="button">\u00d3rdenes <i id="mu-mtab-n">0</i></button>
      </div>

      <div class="mu-cuerpo m-graf" id="mu-cuerpo">
        <div class="mu-graf" id="mu-graf">
          <canvas class="mu-cv" id="mu-cv"></canvas>
          <div class="mu-esperando" id="mu-esperando">
            <div class="mu-spin"></div>
            <b>Analizando el libro de órdenes</b>
            <span>Necesitamos unos segundos de observación para distinguir el dinero real del humo.</span>
            <div class="mu-progreso"><i id="mu-prog"></i></div>
          </div>
          <img class="mu-marca" src="assets/img/cco-marca.webp" alt="">
        </div>
      </div>
      <div class="mu-alerta" id="mu-alerta"></div>
    </div>`;
  document.body.appendChild(d);

  const cerrar = () => {
    clearInterval(_reloj); clearInterval(_relojVelas); clearInterval(_relojPulso);
    cerrarWSLibro();
    M._pos = null; M._tend = null; M._posList = null; quitarPager(); quitarGuiaSVG();  // las herramientas viven DENTRO del radar
    if (_planFuera) { document.removeEventListener('pointerdown', _planFuera, true); _planFuera = null; }
    document.querySelectorAll('#mu-picker, #mu-tfmenu, #mu-plan, #mu-tend, #mu-poscfg, #mu-tendcfg').forEach((x) => x.remove());
    const e = $('mu-overlay'); if (e) e.remove();
    /* Al cerrar se vuelve a la portada de Liquidity, no se sale. */
    try { if (window.__lqpVolver) window.__lqpVolver(); } catch (_) {}
  };
  d.querySelector('.mu-bg').onclick = cerrar;
  $('mu-x').onclick = cerrar;
  $('mu-ayuda').onclick = () => ayuda();
  $('mu-sel').onclick = (e) => { e.stopPropagation(); menuPares(); };

  $('mu-foto').onclick = () => guardarImagen();
  { const bc = $('mu-cal'); if (bc) bc.onclick = () => abrirNoticiasSeguro('calendario'); }
  { const _an = $('mu-analista'); if (_an) _an.onclick = () => abrirAnalista(); }
  {
    const bS = $('mu-pos-single'), bD = $('mu-pos-double');
    const set = (modo) => {
      M._modoPos = (M._modoPos === modo) ? null : modo;   // volver a tocar lo apaga
      bS.classList.toggle('on', M._modoPos === 'single');
      bD.classList.toggle('on', M._modoPos === 'double');
      const sh = $('mu-share'); if (sh) sh.disabled = !M._modoPos;   // Share solo con Single/Double
      dibujar();
    };
    if (bS) bS.onclick = () => set('single');
    if (bD) bD.onclick = () => set('double');
    { const sh = $('mu-share'); if (sh) sh.onclick = () => compartirSenal(); }
  }
  $('mu-tema').onclick = () => {
    M.tema = M.tema === 'claro' ? 'oscuro' : 'claro';
    try { localStorage.setItem('mu_tema', M.tema); } catch (_) {}
    const ov = $('mu-overlay'); if (ov) ov.classList.toggle('mu-claro', M.tema === 'claro');
    dibujar();
  };

  /* ONBOARDING: la primera vez que se abre el radar, se muestra el tutorial
     solo (una sola vez por navegador). */
  /* La tarjeta de ayuda ya NO se abre sola al entrar: el usuario la abre cuando
     quiera con el botón de ayuda. */

  d.querySelectorAll('[data-tf]').forEach((b) => b.onclick = () => {
    M.tf = b.dataset.tf;
    M._pos = null; M._tend = null; M._posList = null; quitarPager(); cerrarPosCfg(); cerrarTendCfg();
    _htfTs = 0; _jerTs = 0; M._velasJerar = null; M._tendJerar = null;   // fuerza recálculo de la jerárquica en la nueva TF
    reiniciarAlertas();
    d.querySelectorAll('[data-tf]').forEach((x) => x.classList.toggle('on', x.dataset.tf === M.tf));
    const ch = $('mu-tfchip-t'); if (ch) ch.textContent = b.textContent;   // refleja en el chip móvil
    cargarVelas();
  });

  /* Temporalidad en móvil: el chip muestra solo la activa y despliega una
     lista con TODAS. Reutiliza los botones reales .mu-tf (dispara su click),
     así no duplicamos la lógica de carga. */
  const chip = $('mu-tfchip');
  if (chip) chip.onclick = (e) => {
    e.stopPropagation();
    const ya = $('mu-tfmenu'); if (ya) { ya.remove(); return; }
    const menu = document.createElement('div'); menu.id = 'mu-tfmenu';
    menu.innerHTML = TFS.map((t) => `<button type="button" class="mu-tfmenu-it ${t.id === M.tf ? 'on' : ''}" data-mtf="${t.id}">${t.n}</button>`).join('');
    document.body.appendChild(menu);
    const r = chip.getBoundingClientRect();
    const w = menu.offsetWidth || 200;
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    menu.querySelectorAll('.mu-tfmenu-it').forEach((it) => it.onclick = () => {
      const real = d.querySelector(`.mu-tf[data-tf="${it.dataset.mtf}"]`);
      if (real) real.click();                 // dispara el handler real (carga la vela)
      menu.remove();
    });
    const cerrarM = (ev) => { if (!menu.contains(ev.target) && ev.target !== chip && !chip.contains(ev.target)) { menu.remove(); document.removeEventListener('click', cerrarM); } };
    setTimeout(() => document.addEventListener('click', cerrarM), 10);
  };

  /* Pestañas de móvil: Gráfica / Órdenes. Le dan al panel de órdenes TODO el
     alto de la pantalla, para que las tarjetas se vean cómodas. En escritorio
     estas pestañas están ocultas y se ve todo a la vez. */
  d.querySelectorAll('.mu-mtab').forEach((b) => b.onclick = () => {
    const vista = b.dataset.vista;
    d.querySelectorAll('.mu-mtab').forEach((x) => x.classList.toggle('on', x === b));
    const cuerpo = $('mu-cuerpo');
    if (cuerpo) { cuerpo.classList.toggle('m-graf', vista === 'graf'); cuerpo.classList.toggle('m-ord', vista === 'ord'); }
    if (vista === 'graf') { requestAnimationFrame(() => { if ($('mu-cv')) dibujar(); }); }
  });
  /* Los filtros se apagan al volver a pulsarlos: sin ninguno activo
     se ven todas las órdenes, que es lo natural. */
  d.querySelectorAll('[data-filtro]').forEach((b) => b.onclick = () => {
    M.filtro = (M.filtro === b.dataset.filtro) ? 'todos' : b.dataset.filtro;
    d.querySelectorAll('[data-filtro]').forEach((x) => x.classList.toggle('on', x.dataset.filtro === M.filtro));
    pintarPanel();
  });

  ponerLogos();
  arrancar();
  cargarVelas();
  /* Pulso: redibuja suave (~8 fps) solo si hay una zona activa (retesteo/dentro),
     para que la animación sea fluida aunque el WebSocket no esté. */
  clearInterval(_relojPulso);
  _relojPulso = setInterval(() => {
    if (!$('mu-cv')) { clearInterval(_relojPulso); return; }
    if (M.zonas.some((z) => (z.dentro || z.retest) && !z.rota)) dibujar();
  }, 130);

  let _t = null;
  window.addEventListener('resize', () => {
    clearTimeout(_t);
    _t = setTimeout(() => { if ($('mu-cv')) dibujar(); }, 250);
  });
}

/* ══════════════════════════════════════════════════════════════
   EL RELOJ — una foto cada 1,5 s
   ══════════════════════════════════════════════════════════════ */
let _reloj = null, _relojVelas = null, _relojPulso = null;
let _htfTs = 0;                        // última vez que se pidió la temporalidad superior
let _jerTs = 0;                        // última vez que se pidió la temporalidad jerárquica
let _delTs = 0;                        // última vez que se pidió el order-flow (aggTrades)
let _ultLibro = null;                  // último libro bueno (REST o WS) para confirmar zonas
let _fallos = 0;
let _wsL = null, _wsLibro = null, _wsPar = null;   // libro por WebSocket (respaldo)
let _ultDibujoWS = 0;                              // throttle del redibujo en vivo
let _huella = '';
let _ultPintado = 0;

/** Actualiza solo los números que cambian, sin rehacer las tarjetas.
 *  Así no parpadean. */
function refrescarNumeros() {
  M.zonas.forEach((z) => {
    const b = document.querySelector(`[data-mp="${z.p}"]`);
    if (!b) return;
    const card = b.closest('.mu-card');
    if (!card) return;
    const dem = z.lado === 'demanda';
    const pon = (sel, txt) => {
      const e = card.querySelector(sel);
      if (e && e.textContent !== txt) e.textContent = txt;
    };
    pon('.mu-imp', dinero(z.v));
    pon('.mu-dist2', z.dentro ? 'AQU\u00cd' : (Math.abs(z.dist) * 100).toFixed(2) + '% ' + (dem ? '\u2193' : '\u2191'));
  });
}

/** Las velas se refrescan cada 12 s: el precio no cambia tan rápido
 *  como el libro, y no hace falta pedirlas cada segundo y medio. */
async function cargarVelas() {
  clearInterval(_relojVelas);
  const traer = async () => {
    if (!$('mu-cv')) { clearInterval(_relojVelas); return; }
    try {
      const par = PARES.find((p) => p.id === _par) || PARES[0];
      M.velas = await traerVelas(par.s, M.tf, 1000);
      const px = (M.precio > 0) ? M.precio : (M.velas.length ? M.velas[M.velas.length - 1].c : 0);
      /* CONFLUENCIA MULTI-TEMPORALIDAD: se traen las zonas de la temporalidad
         superior (15m→1h, etc.) cada ~60 s y se usan para validar. */
      const sup = TF_SUPERIOR[M.tf];
      if (sup && px > 0 && Date.now() - _htfTs > 60000) {
        try {
          const vh = await traerVelas(par.s, sup, 300);
          M.zonasHTF = detectarZonas(vh, px, {}).zonas;
          _htfTs = Date.now();
        } catch (_) {}
      }
      /* TENDENCIA JERÁRQUICA (largo plazo): velas de la temporalidad grande,
         vistas "de lejos", para el canal paralelo que filtra el ruido. */
      const jer = TF_JERARQUICO[M.tf];
      if (jer && Date.now() - _jerTs > 60000) {
        try { M._velasJerar = await traerVelas(par.s, jer, 300); M._jerTf = jer; _jerTs = Date.now(); } catch (_) {}
      }
      /* Las zonas salen de las VELAS: se llenan en ~1 s, sin depender del libro. */
      const r = detectarZonas(M.velas, px, { htf: M.zonasHTF, libro: murosDelLibro(), ancla: _par + "|" + M.tf });
      M.zonas = r.zonas; M.perfil = r.perfil;
      M._tendCorto = calcTendenciaCorto();
      M._tendJerar = calcTendenciaJerar();
      M.estructuras = detectarEstructuras(M.velas);
      /* NIVELES INSTITUCIONALES + BACKTEST, y boost de confianza cuando una
         zona coincide con VWAP / borde del área de valor / POC. */
      M.mercado = analizarMercado(M.velas, px, M.perfil);
      aplicarReferencias(M.zonas, M.mercado, px);
      seguirVida(M.zonas);
      /* ORDER-FLOW real (aggTrades), cada ~8 s. */
      if (Date.now() - _delTs > 8000) { _delTs = Date.now(); traerDelta(par.s).then((d) => { if (d) M.delta = d; }); }
      /* CONTEXTO multi-símbolo (BTC/ETH), cacheado 90 s. */
      traerContexto().then((c) => { M.contexto = c; });
      if (M.velas.length) { M.cargando = false; M.error = null; }
      pintarPanel();
      dibujar();
    } catch (_) {}
  };
  await traer();
  _relojVelas = setInterval(traer, 12000);
}

/* Sube la confianza de una zona cuando coincide con un nivel institucional
   (VWAP, VAH, VAL o POC): son imanes de precio que las mesas vigilan. */
function aplicarReferencias(zonas, mercado, precio) {
  if (!mercado) return;
  const refs = [mercado.vwap, mercado.vah, mercado.val, mercado.poc].filter((x) => x > 0);
  zonas.forEach((z) => {
    const coincide = refs.some((rp) => rp >= z.pLow && rp <= z.pHigh);
    z.ref = coincide;
    if (coincide && !z.rota) {
      z.confianza = Math.min(100, z.confianza + 10);
      z.fuerza = Math.max(1, Math.min(5, Math.round(z.confianza / 20)));
    }
  });
}

/* Extrae los MUROS reales del libro en vivo (niveles con tamaño >= 4× la
   mediana) para confirmar zonas: acumulación + muro real = alta convicción. */
function murosDelLibro() {
  const L = _wsLibro || _ultLibro;
  if (!L) return null;
  const todos = [...(L.compras || []), ...(L.ventas || [])]
    .map((o) => ({ p: o.p, d: o.p * o.q })).filter((o) => o.d > 0);
  if (todos.length < 6) return null;
  const ds = todos.map((o) => o.d).sort((a, b) => a - b);
  const med = ds[Math.floor(ds.length / 2)] || 0;
  if (!(med > 0)) return null;
  return { muros: todos.filter((o) => o.d >= med * 4).map((o) => o.p) };
}

/* ORDER-FLOW REAL: los aggTrades traen cada operación con la marca de si el
   comprador fue el agresor. Sumamos el volumen agresor comprador vs vendedor
   (delta) de los últimos ~1000 trades: es lo que mueve el precio de verdad. */
async function traerDelta(simbolo) {
  try {
    const r = await muFetch(`/api/v3/aggTrades?symbol=${simbolo}&limit=1000`);
    if (!r.ok) return null;
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) return null;
    let comp = 0, vend = 0;
    j.forEach((t) => {
      const q = Number(t.q) * Number(t.p);            // $ de la operación
      if (t.m) vend += q; else comp += q;             // m=true → comprador es maker → agresor vendedor
    });
    const total = comp + vend || 1;
    return { comp, vend, delta: comp - vend, ratio: comp / total, t: Date.now() };
  } catch (_) { return null; }
}

/* CONTEXTO MULTI-SÍMBOLO: mira si BTC y ETH están en zona de demanda/oferta
   cerca de su precio. Una zona en una alt es más fiable si BTC acompaña. */
let _ctxTs = 0, _ctxCache = null;
async function traerContexto() {
  if (Date.now() - _ctxTs < 90000 && _ctxCache) return _ctxCache;
  const guias = [{ id: 'BTC', s: 'BTCUSDT' }, { id: 'ETH', s: 'ETHUSDT' }];
  const out = [];
  for (const g of guias) {
    try {
      const v = await traerVelas(g.s, M.tf, 260);
      if (!v.length) continue;
      const px = v[v.length - 1].c;
      const r = detectarZonas(v, px, {});
      const cerca = r.zonas.find((z) => z.dentro || Math.abs(z.dist) < 0.004);
      out.push({ id: g.id, estado: cerca ? cerca.lado : 'neutral', px });
    } catch (_) {}
  }
  _ctxCache = out.length ? out : null; _ctxTs = Date.now();
  return _ctxCache;
}

/* CICLO DE VIDA de cada zona + ALERTAS. Se sigue por precio redondeado:
   nace → se testea → se confirma → se rompe, con marcas de tiempo. Y avisa
   (banner + pitido corto) cuando el precio entra en una zona fuerte o una
   zona se rompe. */
const _vidaZonas = new Map();

/* ══════════════════════════════════════════════════════════════
   ANCLAJE DE ZONAS — que un nivel real no salte ni cambie de ancho

   Los niveles de soporte/resistencia NO se mueven de sitio. Pero la detección,
   al recalcular con el precio vivo, puede reubicar/redimensionar una zona un
   poco cada vez y eso "baila". Aquí cada zona detectada se EMPAREJA con su
   ancla previa (mismo lado, POC cercano) y se PEGA a esa geometría estable,
   que solo deriva muy despacio. Las anclas viejas con muchos toques ganan
   prioridad (son S/R reales donde el precio ha reaccionado muchas veces).
   La DETECCIÓN real no cambia: esto solo estabiliza posición y tamaño.
   ══════════════════════════════════════════════════════════════ */
const _anclas = new Map();       // clave 'PAR|TF' -> lista de anclas estables
function anclarZonas(zonas, precio, clave) {
  if (!clave) return;
  const ahora = Date.now();
  let anc = _anclas.get(clave);
  if (!anc) { anc = []; _anclas.set(clave, anc); }
  anc.forEach((a) => { a._m = false; });
  const tol = 0.005;             // POC dentro del 0,5% se considera la misma zona
  const k = 0.08;                // suavizado fuerte: la geometría se mueve muy poco
  zonas.forEach((z) => {
    let mejor = null, mejorD = Infinity;
    anc.forEach((a) => {
      if (a._m || a.lado !== z.lado) return;
      const d = Math.abs(a.pPoc - z.pPoc) / (precio || 1);
      if (d < tol && d < mejorD) { mejorD = d; mejor = a; }
    });
    if (mejor) {
      mejor._m = true; mejor.visto = ahora;
      mejor.pLow = mejor.pLow * (1 - k) + z.pLow * k;
      mejor.pHigh = mejor.pHigh * (1 - k) + z.pHigh * k;
      mejor.pPoc = mejor.pPoc * (1 - k) + z.pPoc * k;
      if (z.dentro || z.retest) mejor.toques = (mejor.toques || 0) + 1;
      // pegar la zona a la geometría estable del ancla
      z.pLow = mejor.pLow; z.pHigh = mejor.pHigh; z.pPoc = mejor.pPoc;
      z.p = (z.pLow + z.pHigh) / 2;
      z.dist = (z.p - precio) / precio;
      z.dentro = precio >= z.pLow && precio <= z.pHigh;
      z.retest = !z.dentro && Math.abs(z.dist) < 0.0035;
      // prioridad a niveles longevos y muy reaccionados (S/R reales)
      const edadMin = (ahora - (mejor.nace || ahora)) / 60000;
      const bono = Math.min(14, (mejor.toques || 0) * 1.5 + Math.min(6, edadMin / 5));
      z.confianza = Math.min(100, Math.round(z.confianza + bono));
      z.fuerza = Math.max(1, Math.min(5, Math.round(z.confianza / 20)));
      z.anclada = edadMin > 3;   // lleva un rato fija: es un nivel de referencia
    } else {
      anc.push({ lado: z.lado, pLow: z.pLow, pHigh: z.pHigh, pPoc: z.pPoc, nace: ahora, visto: ahora, toques: 0, _m: true });
    }
  });
  // conservar las anclas no vistas un rato (para que no parpadeen), podar las viejas
  const vivos = anc.filter((a) => ahora - a.visto < 300000);
  _anclas.set(clave, vivos);
}
let _alerta = null, _alertaTs = 0, _alertaDesde = 0;
/* Al abrir o cambiar de par/temporalidad, se silencian las alertas unos
   segundos y se limpia el ciclo de vida, para no lanzar un aviso de golpe. */
function reiniciarAlertas() { _vidaZonas.clear(); _alertaDesde = Date.now() + 4000; }
function seguirVida(zonas) {
  const ahora = Date.now();
  const usadas = new Set();
  zonas.forEach((z) => {
    /* IDENTIDAD ESTABLE: el precio de una zona deriva un poco entre recálculos.
       Si usáramos el precio exacto como clave, cada tick crearía una zona
       "nueva" y la alerta se repetiría en bucle. Por eso emparejamos cada zona
       con la entrada existente más cercana del mismo lado (tolerancia ~0,6%). */
    let mejorK = null, mejorD = Infinity;
    _vidaZonas.forEach((v, k) => {
      if (usadas.has(k) || v.lado !== z.lado) return;
      const d = Math.abs(v.p - z.p) / (z.p || 1);
      if (d < 0.006 && d < mejorD) { mejorD = d; mejorK = k; }
    });
    let v = mejorK ? _vidaZonas.get(mejorK) : null;
    if (!v) {
      // Nace: se guarda si YA contenía el precio, para no alertar solo por empezar a seguirla.
      v = { lado: z.lado, p: z.p, nace: ahora, tests: 0, confirmada: false, rota: false, dentroAntes: (z.dentro || z.retest), reaccion: 0 };
      _vidaZonas.set(z.lado + ':' + ahora + ':' + Math.random().toString(36).slice(2, 6), v);
    }
    const claveActual = mejorK || [..._vidaZonas.keys()].find((k) => _vidaZonas.get(k) === v);
    usadas.add(claveActual);
    v.p = z.p; v.ultVisto = ahora;

    // test: el precio entró/tocó (transición fuera → dentro)
    if ((z.dentro || z.retest) && !v.dentroAntes) { v.tests++; v.ultTest = ahora; }
    // confirmada: fuerte y con reacciones
    if (z.fuerza >= 4 && z.reacciones >= 2) v.confirmada = true;
    // ALERTAS: solo en la transición real (no mientras el precio sigue dentro)
    if (z.dentro && !v.dentroAntes && z.fuerza >= 4) lanzarAlerta('entra', z);
    if (z.rota && !v.rota) { v.rota = true; v.rotaTs = ahora; lanzarAlerta('rompe', z); }
    v.dentroAntes = z.dentro || z.retest;
    z.vida = v;
  });
  // limpiar las que llevan mucho sin verse
  _vidaZonas.forEach((v, k) => { if (ahora - (v.ultVisto || v.nace) > 600000) _vidaZonas.delete(k); });
}
function lanzarAlerta(tipo, z) {
  if (Date.now() < _alertaDesde) return;        // silencio al abrir/cambiar
  if (Date.now() - _alertaTs < 4000) return;   // no spamear
  _alertaTs = Date.now();
  const dem = z.lado === 'demanda';
  _alerta = tipo === 'entra'
    ? { txt: `Precio en zona ${dem ? 'de demanda' : 'de oferta'} fuerte · ${dinero(z.v)}`, col: dem ? '#2ee86a' : '#f6465d' }
    : { txt: `Zona ${dem ? 'de demanda' : 'de oferta'} ROTA · ${fmt(z.p)}`, col: '#E8B84B' };
  pitar();
  const b = $('mu-alerta');
  if (b) {
    b.textContent = _alerta.txt;
    b.style.setProperty('--ac', _alerta.col);
    b.classList.add('on');
    clearTimeout(_alertaT);
    _alertaT = setTimeout(() => b.classList.remove('on'), 9000);   // se lee con calma
    b.onclick = () => { b.classList.remove('on'); clearTimeout(_alertaT); };   // o se cierra al tocar
  }
}
let _alertaT = null, _audio = null;
function pitar() {
  try {
    _audio = _audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = _audio.createOscillator(), g = _audio.createGain();
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.04;
    o.connect(g); g.connect(_audio.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, _audio.currentTime + 0.25);
    o.stop(_audio.currentTime + 0.26);
  } catch (_) {}
}

function arrancar() {
  clearInterval(_reloj);
  _fallos = 0;
  reiniciarAlertas();
  const par0 = PARES.find((p) => p.id === _par) || PARES[0];
  conectarWSLibro(par0.s);              // libro en vivo por WebSocket (respaldo)
  const tomar = async () => {
    if (!$('mu-cv')) { clearInterval(_reloj); return; }
    const par = PARES.find((p) => p.id === _par) || PARES[0];
    /* El libro solo sirve para el PRECIO en vivo (marcador + vela). Las zonas
       salen de las velas, así que aunque el libro falle, el radar funciona. */
    let foto = null;
    try {
      const f = await traerLibro(par.s);
      if (f && f.compras && f.compras.length && f.ventas && f.ventas.length) foto = f;
    } catch (_) {}
    if (!foto && _wsLibro && (Date.now() - _wsLibro.t) < 6000) foto = _wsLibro;
    if (foto) procesar(foto);                       // actualiza M.precio
    if (foto) _ultLibro = foto;
    if (!(M.precio > 0) && M.velas.length) M.precio = M.velas[M.velas.length - 1].c;

    if (M.velas.length && M.precio > 0) {
      const r = detectarZonas(M.velas, M.precio, { htf: M.zonasHTF, libro: murosDelLibro(), ancla: _par + "|" + M.tf });
      M.zonas = r.zonas; M.perfil = r.perfil; M._tendCorto = calcTendenciaCorto(); M._tendJerar = calcTendenciaJerar(); M.estructuras = detectarEstructuras(M.velas);
      M.mercado = analizarMercado(M.velas, M.precio, M.perfil);
      aplicarReferencias(M.zonas, M.mercado, M.precio);
      seguirVida(M.zonas);
      M.cargando = false; M.error = null;
    }
    const px = $('mu-px-v'); if (px && M.precio > 0) px.textContent = fmt(M.precio);
    dibujar();

    /* El panel se reconstruye solo si cambian las zonas (para no parpadear). */
    const huella = M.zonas.map((z) => `${z.p.toFixed(6)}|${z.lado}|${z.fuerza}|${z.rota ? 1 : 0}|${z.confluencia ? 1 : 0}|${z.libro ? 1 : 0}`).sort().join(',');
    const ahora2 = Date.now();
    if (huella !== _huella && ahora2 - _ultPintado > 2500) { _huella = huella; _ultPintado = ahora2; pintarPanel(); }
    else refrescarNumeros();
  };
  tomar();
  _reloj = setInterval(tomar, CADA);
}

/* ══════════════════════════════════════════════════════════════
   LIBRO EN VIVO POR WEBSOCKET — respaldo con la misma fuente que Trade
   (stream.binance.com). Mantiene los 20 niveles por lado más cercanos al
   precio; se usa solo si el REST del libro no llega.
   ══════════════════════════════════════════════════════════════ */
function conectarWSLibro(sym) {
  cerrarWSLibro();
  _wsPar = sym;
  try {
    _wsL = new WebSocket(`wss://stream.binance.com:9443/ws/${sym.toLowerCase()}@depth20@100ms`);
    _wsL.onmessage = (ev) => {
      try {
        const j = JSON.parse(ev.data);
        const b = j.bids || j.b, a = j.asks || j.a;
        if (!b || !a) return;
        _wsLibro = {
          t: Date.now(),
          compras: b.map((x) => ({ p: Number(x[0]), q: Number(x[1]) })).filter((x) => x.q > 0),
          ventas: a.map((x) => ({ p: Number(x[0]), q: Number(x[1]) })).filter((x) => x.q > 0)
        };
        /* PRECIO EN TIEMPO REAL. El libro (REST) solo llega cada 1,5 s, y por
           eso la vela y la línea de precio se veían "atrasadas". El WebSocket
           llega ~10 veces/segundo: con él movemos el precio y la última vela al
           instante (redibujo suave, máx ~6/seg) para que vayan siempre pegados
           al mercado. */
        const mb = _wsLibro.compras[0], ms = _wsLibro.ventas[0];
        if (mb && ms) {
          M.precio = (mb.p + ms.p) / 2;
          const px = $('mu-px-v'); if (px) px.textContent = fmt(M.precio);
          const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          if (now - _ultDibujoWS > 160 && $('mu-cv') && !M.cargando) { _ultDibujoWS = now; dibujar(); }
        }
      } catch (_) {}
    };
  } catch (_) {}
}
function cerrarWSLibro() { if (_wsL) { try { _wsL.close(); } catch (_) {} _wsL = null; } _wsLibro = null; }

/* ══════════════════════════════════════════════════════════════
   EL DIBUJO — mapa de profundidad en el tiempo

   Eje horizontal: el tiempo (izquierda pasado, derecha ahora).
   Eje vertical: el precio.
   El color: cuánto dinero hay en el libro a ese precio.

   Encima, los muros detectados con su etiqueta.
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   EL DIBUJO — una escalera de precios, no un mapa de rayas

   [REPLANTEADO] El mapa de calor mostraba el PROCESO (cómo cambia el
   libro con el tiempo) y eso solo lo entiende quien ya sabe qué está
   mirando. Un trader no necesita ver el proceso: necesita ver el
   RESULTADO.

   Ahora es una escalera vertical, igual que el libro de cualquier
   exchange, que todo el mundo sabe leer de un vistazo:

     · Cada fila es un precio
     · La barra dice cuánto dinero hay puesto ahí
     · Verde = compras (soportes) · Rojo = ventas (resistencias)
     · Los muros vigilados llevan su sello de veredicto

   Y en el centro, el precio actual con la distancia a cada muro.
   ══════════════════════════════════════════════════════════════ */
function dibujar() {
  const cv = $('mu-cv'); const zona = $('mu-graf');
  if (!cv || !zona) return;
  const W = zona.clientWidth, H = zona.clientHeight;
  if (W < 50 || H < 50) return;

  if (!cv.dataset.listo) {
    engancharGestos(cv);
    cv.dataset.listo = '1';
    /* Órdenes desde el gráfico: clic derecho o toque largo. */
    import('./orden.js?v=126').then((od) => {
      od.conectar({
        canvas: cv,
        precioEn: (y) => {
          if (!M._geo) return 0;
          const { pMin, pMax, y1 } = M._geo;
          return pMin + (pMax - pMin) * ((y1 - y) / y1);
        },
        precioActual: () => {
          /* El precio del libro puede tardar en llegar. Si aún no
             está, se usa el cierre de la última vela: así el menú
             de órdenes funciona desde el primer momento. */
          if (M.precio > 0) return M.precio;
          const v = M.velas || [];
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
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr)) {
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = pal();
  g.fillStyle = P.fondo;
  g.fillRect(0, 0, W, H);

  const esp = $('mu-esperando');
  /* En cuanto hay velas se aparta del todo, aunque el libro siga
     acumulando tomas: el gráfico ya se puede usar. */
  if (esp && M.velas.length && !M.cargando) esp.style.display = 'none';
  if (M.cargando || !M.velas.length) {
    if (esp) {
      esp.style.display = '';
      const pr = $('mu-prog');
      if (pr) pr.style.width = Math.min(100, (M.fotos.length / MIN_TOMAS) * 100) + '%';
    }
    return;
  }
  if (esp) esp.style.display = 'none';

  const mDer = 66, mAba = 22;
  const x1 = W - mDer, y1 = H - mAba;
  const xVelas = x1;             // las velas llegan HASTA el eje de precios (sin banda muerta)

  /* La ventana visible: el ancho es el zoom y el desplazamiento el
     arrastre. Muestra SIEMPRE `ancho` velas completas (sin aplastar ni
     dejar telón), con un respiro del 15% a la derecha. */
  const ancho = Math.min(M.velas.length, M.ancho || 70);
  const huecoMax = Math.floor(ancho * 0.45);
  const desp = Math.max(-huecoMax, Math.min(M.desplaz || 0, Math.max(0, M.velas.length - ancho)));
  M.desplaz = desp;
  const fin = M.velas.length - desp;
  const vis = M.velas.slice(Math.max(0, fin - ancho), Math.min(M.velas.length, fin));
  if (!vis.length) return;

  /* ══════════════════════════════════════════════════════════
     [CORREGIDO] La línea del precio se separaba de las velas.

     Causa: el precio venía del LIBRO (se refresca cada 1,5 s) y las
     velas del histórico (cada 12 s). En 1m y 5m eso basta para que
     se despeguen a la vista.

     Ahora la última vela se estira con el precio real del libro: son
     el mismo dato, así que van juntas siempre.
     ══════════════════════════════════════════════════════════ */
  if (desp <= 0 && M.precio > 0) {
    const u = vis[vis.length - 1];
    u.c = M.precio;
    if (M.precio > u.h) u.h = M.precio;
    if (M.precio < u.l) u.l = M.precio;
  }

  /* La escala encuadra las VELAS y el precio (las zonas y niveles se retiraron
     de la gráfica, así que ya no estiran la escala). */
  let pAlto = Math.max(...vis.map((v) => v.h));
  let pBajo = Math.min(...vis.map((v) => v.l));
  if (M.precio > 0) { pAlto = Math.max(pAlto, M.precio); pBajo = Math.min(pBajo, M.precio); }
  /* La escala también ABRE un poco para que las zonas swing cercanas (arriba y
     abajo) entren en pantalla sin tener que alejar a mano. Con tope: nunca se
     abre más de un 45% del rango de las velas, para no descuadrar el gráfico. */
  if (M.estructuras && M.estructuras.length) {
    const rV = (pAlto - pBajo) || 1;
    const capHi = pAlto + rV * 0.45, capLo = pBajo - rV * 0.45;
    M.estructuras.forEach((z) => {
      if (z.hi <= capHi && z.hi >= pBajo) pAlto = Math.max(pAlto, z.hi);
      if (z.lo >= capLo && z.lo <= pAlto) pBajo = Math.min(pBajo, z.lo);
    });
  }
  /* El zoom vertical estira o comprime la escala de precios, como al
     arrastrar el borde derecho en TradingView. */
  /* El arrastre vertical desplaza el rango de precios. */
  const rangoB = (pAlto - pBajo) || 1;
  const despY = ((M.offsetY || 0) / Math.max(1, y1)) * rangoB;
  const centro = (pAlto + pBajo) / 2 + despY;
  const semi = (rangoB / 2) * (M.zoomY || 1);
  const pad = semi * 0.14 || 1;
  const pMax = centro + semi + pad, pMin = centro - semi - pad;
  const Y = (p) => y1 - y1 * ((p - pMin) / Math.max(1e-12, pMax - pMin));
  /* Se guarda para que el módulo de órdenes sepa qué precio hay a
     cada altura del gráfico. */
  M._geo = { pMin, pMax, y1, xVelas, n: vis.length, vis,
             paso: xVelas / (ancho || vis.length), pri: fin - ancho, fin, ancho,
             tfMs: (M.velas.length > 1 ? (M.velas[1].t - M.velas[0].t) : 60000), t0: M.velas[0].t };

  /* Tus órdenes y alertas, con el estilo común de las tres. */
  if (_od) {
    _zonasOd = _od.pintar(g, {
      x1, Y, pMin, pMax,
      simbolo: (PARES.find((p) => p.id === _par) || {}).s || ''
    });
  }

  /* ── Rejilla ── */
  g.strokeStyle = P.rejilla;
  g.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const y = (y1 / 6) * i;
    g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke();
  }

  /* (El perfil de volumen se ha eliminado por completo: no se dibuja ni el
     mapa de calor de fondo ni la silueta lateral. Solo se conserva el cálculo
     interno de VAH/VAL/POC para el análisis, que no se pinta.) */

  /* (Los niveles institucionales VWAP/VAH/VAL se dibujan MÁS ABAJO, después
     del eje, con la línea a todo el ancho y la denominación en el eje derecho.) */

  /* ══════════════════════════════════════════════════════════
     ZONAS DE ACUMULACIÓN

     Banda LIMPIA a todo el ancho (muy sutil, para no tapar las velas) que
     marca el rango de la zona, con sus bordes finos y la línea POC. A la
     derecha, un PANEL de proyección sólido y redondeado = la zona de retesteo,
     con el importe y las insignias. Verde = demanda · Rojo = oferta.
     ══════════════════════════════════════════════════════════ */
  const pulso = 0.5 + 0.5 * Math.sin(Date.now() / 450);
  /* PASE 1 (detrás de las velas): solo las BANDAS y bordes de cada zona, muy
     sutiles, para no tapar el precio. Las líneas de entrada, etiquetas y el
     perfil van DESPUÉS (encima de las velas) para que no queden troceados.

     CLAVE: cuando dos zonas están cerca, sus bandas se SOLAPARÍAN en un bloque
     ilegible. Por eso cada banda se recorta hasta el punto medio con su vecina
     (dejando un hueco): las zonas lejanas conservan su altura, las juntas se
     estrechan, y todo se sigue rigiendo por la línea punteada central. */
  /* ── ESTRUCTURAS DE ACUMULACIÓN / DISTRIBUCIÓN (cajas de rango) ──
     En vez de decenas de franjas de volumen (ruido), se dibujan las CAJAS
     donde el precio oscila: sus bordes son respetados por el precio. El
     rango más reciente (el actual) se resalta; ahí es donde se opera. */
  /* ── FASE 2 · TENDENCIA JERÁRQUICA (canal paralelo, temporalidad grande) ──
     Se lee "de lejos" en la temporalidad superior y se dibuja como CANAL
     paralelo dorado (centro punteado + dos rieles) que filtra el ruido, igual
     que lo trazas a mano. Marca el ciclo mayor con el que hay que fluir. */
  const TJ = M._tendJerar;
  if (M._verTendencias && TJ && TJ.canal && TJ.dir !== 'lateral') {
    const C = TJ.canal;
    const x0 = mXt(C.t0), x1r = mXt(C.t1);
    if (x1r !== x0) {
      const mPx = (C.p1 - C.p0) / (x1r - x0);
      const centro = (x) => C.p0 + mPx * (x - x0);
      const xIni = 0, xFin = x1;
      const oro = '232,184,75';
      g.save();
      // LÍNEA CENTRAL = la tendencia jerárquica (la que confluye). Sin canal que
      // envuelva el precio: solo la línea, para no saturar ni "meter el precio dentro".
      g.strokeStyle = `rgba(${oro},1)`; g.lineWidth = 2.4; g.setLineDash([]);
      g.beginPath(); g.moveTo(xIni, Y(centro(xIni))); g.lineTo(xFin, Y(centro(xFin))); g.stroke();
      // etiqueta
      g.font = 'bold 10px ui-monospace,monospace'; g.textAlign = 'left';
      g.fillStyle = `rgba(${oro},1)`;
      const tf = M._jerTf ? M._jerTf.toUpperCase() : '';
      g.fillText(`JERÁRQUICA ${TJ.dir === 'alcista' ? 'ALCISTA' : 'BAJISTA'}${tf ? ' · ' + tf : ''}`, 8, Y(centro(8)) - 8);
      g.restore();
    }
  }

  /* ── FASE 1 · TENDENCIA DE CORTO PLAZO (canal por regresión) ──
     La recta central es la tendencia LIMPIA (filtrada de ruido, igual que el
     canal paralelo que traza el trader). El riel que da la cara al precio
     (abajo si sube, arriba si baja) es la línea tendencial operativa. Todo se
     proyecta hacia la derecha. */
  const TC = M._tendCorto;
  if (M._verTendencias && TC && TC.canal && TC.dir !== 'lateral') {
    const C = TC.canal;
    const x0 = mXt(C.t0), x1r = mXt(C.t1);
    if (x1r !== x0) {
      // precio de la recta central en función de x (píxeles), vía interpolación de anclas
      const mPx = (C.p1 - C.p0) / (x1r - x0);
      const centro = (x) => C.p0 + mPx * (x - x0);
      const alc = TC.dir === 'alcista';
      const col = alc ? '46,232,106' : '246,70,93';
      const xIni = Math.max(0, x0), xFin = x1;
      // canal: rieles a ±(sobresalto) de la recta central
      const rielSup = (x) => centro(x) + C.arriba;
      const rielInf = (x) => centro(x) - C.abajo;
      g.save();
      // relleno tenue del canal
      g.beginPath();
      g.moveTo(xIni, Y(rielSup(xIni))); g.lineTo(xFin, Y(rielSup(xFin)));
      g.lineTo(xFin, Y(rielInf(xFin))); g.lineTo(xIni, Y(rielInf(xIni))); g.closePath();
      g.fillStyle = `rgba(${col},0.05)`; g.fill();
      // rieles del canal (finos, tenues)
      g.strokeStyle = `rgba(${col},0.35)`; g.lineWidth = 1; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(xIni, Y(rielSup(xIni))); g.lineTo(xFin, Y(rielSup(xFin))); g.stroke();
      g.beginPath(); g.moveTo(xIni, Y(rielInf(xIni))); g.lineTo(xFin, Y(rielInf(xFin))); g.stroke();
      g.setLineDash([]);
      // línea tendencial OPERATIVA: el riel que da la cara al precio
      const riel = alc ? rielInf : rielSup;
      g.strokeStyle = `rgba(${col},1)`; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(xIni, Y(riel(xIni))); g.lineTo(xFin, Y(riel(xFin))); g.stroke();
      // etiqueta
      g.font = 'bold 10px ui-monospace,monospace'; g.textAlign = 'right';
      g.fillStyle = `rgba(${col},1)`;
      g.fillText(alc ? 'TENDENCIA ALCISTA' : 'TENDENCIA BAJISTA', xFin - 6, Y(riel(xFin)) + (alc ? 16 : -8));
      g.textAlign = 'left'; g.restore();
    }
  }
  let bandaSolo = null;   // (compatibilidad con el resto del dibujo)

  const paso = xVelas / (ancho || vis.length);   // separación entre velas (se usa aquí y en el dibujo de velas)

  /* ── ZONAS SWING (con mapa de calor dentro) ──
     La estrategia real va disfrazada: dentro de cada zona, de izquierda a
     derecha, se pinta un mapa de calor (misma paleta que Liquidity Pools) con
     una banda roja de "interés". Las líneas de entrada explícitas no se
     muestran. Las velas se dibujan después, así la acumulación queda visible. */
  const _zs = M.estructuras || [];
  M._zonaBtns = [];
  _zs.forEach((Z) => {
    if (Z.hi < pMin || Z.lo > pMax) return;
    const baj = Z.dir === 'oferta';
    const col = baj ? '246,70,93' : '46,232,106';
    const xCal = Math.max(0, Math.min(x1, mXt(Z.t1) + paso / 2));   // el color NACE en el borde derecho de la última vela (el impulso)
    const xR = x1;
    const yT = Y(Math.min(pMax, Z.hi)), yB = Y(Math.max(pMin, Z.lo));
    g.save();
    dibujarCalorZona(g, Z, xCal, xR, yT, yB, mXt, paso);
    g.restore();
    // ── Pastilla "Liq" clicable al extremo derecho (muestra la liquidez real) ──
    const bw = 34, bh = 16, bx = x1 - bw - 6, by = (yT + yB) / 2 - bh / 2;
    if (by > 2 && by + bh < y1 - 2) {
      g.save();
      g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 5; g.shadowOffsetY = 1.5;
      const gb = g.createLinearGradient(bx, by, bx, by + bh);
      gb.addColorStop(0, `rgba(${col},0.98)`); gb.addColorStop(1, `rgba(${col},0.62)`);
      g.fillStyle = gb; redondeado(g, bx, by, bw, bh, 5); g.fill();
      g.shadowColor = 'transparent';
      g.fillStyle = '#0b0e12'; g.font = '800 10px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('Liq ⌄', bx + bw / 2, by + bh / 2 + .5);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.restore();
      M._zonaBtns.push({ x: bx, y: by, w: bw, h: bh, zona: Z });
    }
  });

  /* (El tooltip de liquidez se dibuja al FINAL de dibujar(), para que quede por
     encima de las velas y no lo tapen.) */


  /* ── LAS VELAS ── */
  const cuerpo = Math.max(1.6, paso * 0.6);
  vis.forEach((v, i) => {
    const x = i * paso + paso / 2;
    const col = v.c >= v.o ? P.velaUp : P.velaDown;
    g.strokeStyle = col; g.fillStyle = col;
    g.lineWidth = Math.max(1, paso * 0.12);
    g.beginPath(); g.moveTo(x, Y(v.h)); g.lineTo(x, Y(v.l)); g.stroke();
    const yA = Y(Math.max(v.o, v.c)), yB = Y(Math.min(v.o, v.c));
    g.fillRect(x - cuerpo / 2, yA, cuerpo, Math.max(1.4, yB - yA));
  });

  /* (PERFIL DE VOLUMEN eliminado: la silueta lateral ya no se dibuja.) */

  /* ── PASE 2 ── (Se retiró TODO el dibujo de liquidez sobre la gráfica: las
     píldoras de importe ($…M), los hilos y los chips de estado. El usuario los
     quiere solo en las tarjetas del lado derecho, no rayando el gráfico. En la
     gráfica mandan las CAJAS de acumulación/distribución y los niveles clave. */

  /* ── El precio actual ── */
  const yP = Y(M.precio);
  g.strokeStyle = 'rgba(232,184,75,.9)';
  g.setLineDash([6, 4]); g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(0, yP); g.lineTo(x1, yP); g.stroke();
  g.setLineDash([]);

  /* ── NIVELES INSTITUCIONALES: la LÍNEA en el gráfico con protagonismo (la
     denominación va como tachuela alargada en el eje, conectada a la línea). ── */
  if (M.mercado) {
    const mk = M.mercado;
    const refLinea = (p, col, patron, ancho, glow, halo) => {
      if (!(p > 0) || p < pMin || p > pMax) return;
      const y = Y(p);
      if (halo) { g.strokeStyle = halo; g.lineWidth = ancho + 4; g.setLineDash([]); g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); }
      g.save();
      if (glow) { g.shadowColor = col; g.shadowBlur = 9; }
      g.strokeStyle = col; g.lineWidth = ancho; if (patron.length) g.setLineDash(patron);
      g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke();
      g.restore(); g.setLineDash([]);
    };
  /* ── (VWAP / VAH / VAL retirados de la gráfica a petición: lienzo limpio) ── */
  }

  /* ── La escala, con los niveles marcados ── */
  g.fillStyle = P.ejeBg;
  g.fillRect(x1, 0, mDer, H);
  g.strokeStyle = P.ejeBorde;
  g.beginPath(); g.moveTo(x1 + .5, 0); g.lineTo(x1 + .5, H); g.stroke();

  g.font = '10px ui-monospace,monospace';
  g.textAlign = 'left';
  for (let i = 0; i <= 6; i++) {
    const p = pMin + (pMax - pMin) * (i / 6);
    const y = Y(p);
    if (Math.abs(y - yP) < 15) continue;
    g.fillStyle = P.ejeTxt;
    g.fillText(fmt(p), x1 + 7, y + 3.5);
  }
  /* (Tachuelas de precio de las zonas retiradas: la gráfica quedó limpia.) */
  g.fillStyle = '#E8B84B';
  redondeado(g, x1 + 2, yP - 11, mDer - 5, 22, 5); g.fill();
  g.fillStyle = '#2a1c00';
  g.font = 'bold 12px ui-monospace,monospace';
  g.fillText(fmt(M.precio), x1 + 7, yP + 4);

  /* Tachuela ALARGADA de los niveles institucionales en el eje (como las
     demás), conectada a su línea: denominación + precio. Se reparten sin
     solaparse entre sí, con el precio ni con las zonas. */
  if (M.mercado) {
    const mk = M.mercado;
    const usadas = [yP];
    M.zonas.forEach((z) => { if (z.p >= pMin && z.p <= pMax) usadas.push(Y(z.p)); });
    const refTag = (p, txt, col, txtcol) => {
      if (!(p > 0) || p < pMin || p > pMax) return;
      let y = Y(p);
      let guard = 0;
      while (usadas.some((u) => Math.abs(u - y) < 15) && guard++ < 20) y -= 15;
      usadas.push(y);
      // hilo de conexión desde la línea real al centro de la tachuela
      if (Math.abs(y - Y(p)) > 3) { g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x1 + 1, Y(p)); g.lineTo(x1 + 8, y); g.stroke(); }
      g.fillStyle = col;
      redondeado(g, x1 + 2, y - 9, mDer - 5, 18, 4); g.fill();
      g.fillStyle = txtcol; g.textAlign = 'left';
      g.font = 'bold 9px ui-monospace,monospace';
      g.fillText(txt, x1 + 7, y + 3.2);
      g.textAlign = 'right';
      g.font = '8.5px ui-monospace,monospace';
      g.fillText(fmt(p), W - 5, y + 3.2);
      g.textAlign = 'left';
    };
    void refTag;   // VAH / VAL / VWAP retirados de la gráfica (lienzo limpio).
  }

  /* ── Las horas ── */
  g.fillStyle = P.ejeBg;
  g.fillRect(0, y1, W, mAba);
  g.font = '9px ui-monospace,monospace';
  g.fillStyle = P.ejeTxt;
  const cada = Math.max(1, Math.floor(vis.length / 5));
  g.textAlign = 'center';
  vis.forEach((v, i) => {
    if (i % cada !== 0) return;
    const x = i * paso + paso / 2;
    if (x > xVelas - 12) return;
    const d = new Date(v.t * 1000);
    g.fillText(d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }), x, y1 + 14);
  });
  g.textAlign = 'left';

  /* ── Herramienta de posición y línea de tendencia (viven en el radar) ── */
  M._guiaDst = null;
  if (M._tend) dibujarTendencia(g);
  if (M._pos) dibujarPosicion(g);
  // Posiciones automáticas por zona (botón "Positions"): single o double.
  // Se persisten (M._posAuto) y solo se regeneran si cambia el modo o las zonas,
  // así el clic/manito funcionan y el estado expandido no se pierde cada frame.
  if (M._modoPos) {
    const sig = M._modoPos + '|' + (M.estructuras || []).map((z) => (z.t0 | 0) + z.dir).join(',');
    if (!M._posAuto || M._posSig !== sig) { M._posAuto = posicionesDeZonas(); M._posSig = sig; }
    M._posAuto.forEach((P) => dibujarPosicion(g, P));
  } else { M._posAuto = null; M._posSig = null; }
  pintarGuiaSVG();

  /* ── CROSSHAIR: cruz + precio del cursor en el eje ── */
  if (M._cursor && M._cursor.x < x1 && M._cursor.y < y1 && M._cursor.x > 0 && M._cursor.y > 0) {
    const cx = M._cursor.x, cy = M._cursor.y;
    const pCur = pMin + (pMax - pMin) * ((y1 - cy) / y1);
    g.save();
    g.strokeStyle = M.tema === 'claro' ? 'rgba(40,50,62,.5)' : 'rgba(200,210,224,.42)';
    g.lineWidth = 1; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, y1); g.stroke();          // vertical
    g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke();          // horizontal
    g.restore(); g.setLineDash([]);
    // tachuela de precio del cursor en el eje
    g.fillStyle = M.tema === 'claro' ? '#2a323d' : '#e8ecf2';
    redondeado(g, x1 + 2, cy - 9, mDer - 5, 18, 4); g.fill();
    g.fillStyle = M.tema === 'claro' ? '#eef2f7' : '#0b0e12';
    g.font = 'bold 10px ui-monospace,monospace'; g.textAlign = 'left';
    g.fillText(fmt(pCur), x1 + 7, cy + 3.5);
    // tachuela de la hora del cursor abajo
    const idx = Math.floor(cx / paso);
    if (idx >= 0 && idx < vis.length) {
      const d = new Date(vis[idx].t * 1000);
      const ht = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      g.font = 'bold 9px ui-monospace,monospace';
      const hw = g.measureText(ht).width + 12;
      g.fillStyle = M.tema === 'claro' ? '#2a323d' : '#e8ecf2';
      redondeado(g, Math.max(2, Math.min(x1 - hw, cx - hw / 2)), y1 + 3, hw, 15, 4); g.fill();
      g.fillStyle = M.tema === 'claro' ? '#eef2f7' : '#0b0e12'; g.textAlign = 'center';
      g.fillText(ht, Math.max(2 + hw / 2, Math.min(x1 - hw / 2, cx)), y1 + 13.5);
      g.textAlign = 'left';
    }
  }

  /* ── Tooltip de LIQUIDEZ REAL del periodo (encima de todo, al pulsar "Liq") ── */
  if (M._zonaTip && M._zonaTip.zona) {
    const Z = M._zonaTip.zona;
    const baj = Z.dir === 'oferta';
    const col = baj ? '246,70,93' : '46,232,106';
    const liq = Z.liq || 0, liqC = Z.liqC || 0, liqV = Math.max(0, liq - liqC);
    const pComp = liq > 0 ? Math.round((liqC / liq) * 100) : 50;
    const lineas = [
      ['Liquidez del rango', dinero(liq)],
      ['Compradora', dinero(liqC) + '  (' + pComp + '%)'],
      ['Vendedora', dinero(liqV) + '  (' + (100 - pComp) + '%)'],
      ['Candles in range', String((Z.velas || []).length)]
    ];
    g.save();
    g.font = '10px ui-monospace,monospace';
    let wTip = 0; lineas.forEach((l) => { wTip = Math.max(wTip, g.measureText(l[0] + '     ' + l[1]).width); });
    wTip = Math.min(x1 - 12, wTip + 22); const hTip = 14 * lineas.length + 26;
    let tx = M._zonaTip.x - wTip - 8, ty = Math.max(4, Math.min(y1 - hTip - 4, M._zonaTip.y - 6));
    if (tx < 4) tx = Math.min(x1 - wTip - 4, M._zonaTip.x + 40);
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 14; g.shadowOffsetY = 4;
    g.fillStyle = 'rgba(14,18,24,.98)'; redondeado(g, tx, ty, wTip, hTip, 8); g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = `rgba(${col},.55)`; g.lineWidth = 1; redondeado(g, tx + .5, ty + .5, wTip - 1, hTip - 1, 8); g.stroke();
    g.textAlign = 'left'; g.font = 'bold 10px ui-monospace,monospace'; g.fillStyle = `rgba(${col},1)`;
    g.fillText(baj ? 'ZONA DE OFERTA' : 'ZONA DE DEMANDA', tx + 11, ty + 16);
    lineas.forEach((l, i) => {
      const yy = ty + 34 + i * 14;
      g.font = '10px ui-monospace,monospace'; g.fillStyle = '#93a0ad'; g.textAlign = 'left';
      g.fillText(l[0], tx + 11, yy);
      g.fillStyle = '#e8ecf2'; g.textAlign = 'right';
      g.fillText(l[1], tx + wTip - 11, yy);
    });
    g.textAlign = 'left'; g.restore();
  }
}

/* ══════════════════════════════════════════════════════════════
   GESTOS — acercar y alejar

   El libro es estrecho: sin poder acercarse, los muros próximos al
   precio se amontonan. La rueda y el pellizco cambian el rango que
   se muestra; el doble clic vuelve a verlo todo.
   ══════════════════════════════════════════════════════════════ */
/* Arrastres de la herramienta de posición (misma dinámica que Smart Levels).
   Todo se convierte a tiempo/precio para que quede pegado al gráfico. */
function arrastrarLinea(e, cual) {
  const cv = $('mu-cv'); const r = cv.getBoundingClientRect();
  const mover = (ev) => { const p = mPy(ev.clientY - r.top); const P = M._pos; if (!P) return;
    if (cual === 'entry') P.pe = p; else if (cual === 'target') P.pTarget = p; else P.pStop = p; dibujar(); posPosCfg(); };
  const soltar = () => { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); };
  window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
}
function arrastrarBorde(e, lado) {
  const cv = $('mu-cv'); const r = cv.getBoundingClientRect();
  const mover = (ev) => { const t = mTx(ev.clientX - r.left); const P = M._pos; if (!P) return;
    if (lado === 'izq') P.t0 = t; else P.t1 = t; dibujar(); posPosCfg(); };
  const soltar = () => { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); };
  window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
}
function arrastrarPosEntera(e) {
  const cv = $('mu-cv'); const r = cv.getBoundingClientRect();
  let ax = e.clientX - r.left, ay = e.clientY - r.top;
  const mover = (ev) => { const P = M._pos; if (!P) return;
    const nx = ev.clientX - r.left, ny = ev.clientY - r.top;
    const dt = mTx(nx) - mTx(ax), dp = mPy(ny) - mPy(ay);
    P.t0 += dt; P.t1 += dt; P.pe += dp; P.pTarget += dp; P.pStop += dp;
    ax = nx; ay = ny; dibujar(); posPosCfg(); };
  const soltar = () => { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); };
  window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
}
function arrastrarTend(e) {
  const cv = $('mu-cv'); const r = cv.getBoundingClientRect(); let ay = e.clientY - r.top;
  const mover = (ev) => { const T = M._tend; if (!T) return; const ny = ev.clientY - r.top;
    const dp = mPy(ny) - mPy(ay); T.segs.forEach((s) => { s.p0 += dp; s.p1 += dp; }); ay = ny; dibujar(); posTendCfg(); };
  const soltar = () => { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); };
  window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
}

function engancharGestos(cv) {
  const zoom = (f) => {
    const maxA = Math.max(60, (M.velas.length || 1000) - 2);   // alejar hasta ver casi TODA la historia cargada
    M.ancho = Math.max(12, Math.min(maxA, Math.round((M.ancho || 70) * f)));   // acercar hasta 12 velas
    dibujar();
  };

  /* [MEJORADO] El arrastre solo movía en el tiempo y no se podía
     despegar del borde. Ahora es igual que en Smart Levels: se
     agarra el gráfico y se lleva en los dos ejes. */
  let ax = 0, ay = 0, arr = false, modoG = 'libre';
  const enEscalaM = (x) => x > cv.clientWidth - 95;

  cv.addEventListener('mousedown', (e) => {
    const r = cv.getBoundingClientRect();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    const dentroR = (rc) => rc && lx >= rc.x - 8 && lx <= rc.x + rc.w + 8 && ly >= rc.y - 8 && ly <= rc.y + rc.h + 8;

    // Al primer toque en el gráfico, la línea guía de sugerencia se retira.
    if (M._pos && M._pos.guia) { M._pos.guia = false; dibujar(); }
    if (M._tend && M._tend.guia) { M._tend.guia = false; dibujar(); }

    // ── Posiciones automáticas (botón Positions): expandir/minimizar/mover su tarjeta ──
    for (const P of (M._posAuto || [])) {
      if (P.oculto && P._miniBtn && dentroR(P._miniBtn)) { P.oculto = false; dibujar(); return; }
      if (!P.oculto) {
        if (P._hideBtn && dentroR(P._hideBtn)) { P.oculto = true; dibujar(); return; }
        const ORD = ['der', 'abajo', 'izq', 'arriba'];
        if (P._arrL && dentroR(P._arrL)) { P.cardPos = ORD[(ORD.indexOf(P.cardPos || 'der') + 3) % 4]; dibujar(); return; }
        if (P._arrR && dentroR(P._arrR)) { P.cardPos = ORD[(ORD.indexOf(P.cardPos || 'der') + 1) % 4]; dibujar(); return; }
      }
    }

    // ── Pastilla "Liq" de una zona: muestra/oculta la liquidez real del periodo ──
    for (const b of (M._zonaBtns || [])) {
      if (lx >= b.x - 3 && lx <= b.x + b.w + 3 && ly >= b.y - 3 && ly <= b.y + b.h + 3) {
        M._zonaTip = (M._zonaTip && M._zonaTip.zona === b.zona) ? null : { zona: b.zona, x: b.x, y: b.y };
        dibujar(); return;
      }
    }
    if (M._zonaTip) { M._zonaTip = null; dibujar(); }

    // ── Herramienta de posición (misma dinámica que Smart Levels) ──
    if (M._pos) {
      const P = M._pos;
      // 1) botones de la tarjeta (ocultar / mini / flechas)
      if (P.oculto && dentroR(P._miniBtn)) { P.oculto = false; cerrarPosCfg(); dibujar(); return; }
      if (!P.oculto && dentroR(P._hideBtn)) { P.oculto = true; cerrarPosCfg(); dibujar(); return; }
      const ORD = ['der', 'abajo', 'izq', 'arriba'];
      if (!P.oculto && dentroR(P._arrL)) { P.cardPos = ORD[(ORD.indexOf(P.cardPos || 'der') + 3) % 4]; dibujar(); return; }
      if (!P.oculto && dentroR(P._arrR)) { P.cardPos = ORD[(ORD.indexOf(P.cardPos || 'der') + 1) % 4]; dibujar(); return; }
      const G = P._pos;
      if (G) {
        const dentroX = lx >= G.x - 7 && lx <= G.x + G.w + 7;
        // 2) borde izq/der → redimensionar (cambia t0/t1)
        if (dentroX && ly >= Math.min(G.yt, G.ye, G.ys) - 6 && ly <= Math.max(G.yt, G.ye, G.ys) + 6) {
          if (Math.abs(lx - G.x) < 7) { mostrarPosCfg(); return arrastrarBorde(e, 'izq'); }
          if (Math.abs(lx - (G.x + G.w)) < 7) { mostrarPosCfg(); return arrastrarBorde(e, 'der'); }
          // 3) sobre una de las 3 líneas → arrastrar esa línea
          if (Math.abs(ly - G.yt) < 7) { mostrarPosCfg(); return arrastrarLinea(e, 'target'); }
          if (Math.abs(ly - G.ye) < 7) { mostrarPosCfg(); return arrastrarLinea(e, 'entry'); }
          if (Math.abs(ly - G.ys) < 7) { mostrarPosCfg(); return arrastrarLinea(e, 'stop'); }
          // 4) dentro de la franja → arrastrar toda la posición + mostrar config
          mostrarPosCfg(); return arrastrarPosEntera(e);
        }
      }
    }
    // ── Tendencia ──
    if (M._tend && cercaTend(lx, ly)) { mostrarTendCfg(); return arrastrarTend(e); }

    cerrarPosCfg(); cerrarTendCfg();
    modoG = enEscalaM(lx) ? 'y' : 'libre';
    arr = true; ax = e.clientX; ay = e.clientY;
    cv.style.cursor = modoG === 'y' ? 'ns-resize' : 'grabbing';
  });
  window.addEventListener('mousemove', (e) => {
    if (!arr) return;
    const rC = cv.getBoundingClientRect();
    M._cursor = { x: e.clientX - rC.left, y: e.clientY - rC.top };   // la cruz sigue al cursor durante el arrastre
    if (modoG === 'y') {
      const dy = e.clientY - ay;
      if (Math.abs(dy) > 2) {
        M.zoomY = Math.max(0.2, Math.min(6, (M.zoomY || 1) * (1 + dy * 0.004)));
        ay = e.clientY;
      }
      dibujar(); return;
    }
    let cambio = false;
    const paso = (cv.clientWidth - 84) / (M.ancho || 70);   // paneo 1:1 a lo ancho (como Smart Levels)
    const mov = Math.round((e.clientX - ax) / Math.max(1, paso));
    if (mov !== 0) {
      const tope = Math.max(0, M.velas.length - (M.ancho || 70));
      const suelo = -Math.floor((M.ancho || 70) * 0.5);   // respiro a la derecha
      M.desplaz = Math.max(suelo, Math.min(tope, (M.desplaz || 0) + mov));
      ax = e.clientX; cambio = true;
    }
    const dy = e.clientY - ay;
    if (Math.abs(dy) > 1) {
      M.offsetY = (M.offsetY || 0) + dy;
      ay = e.clientY; cambio = true;
    }
    dibujar();   // siempre redibuja durante el arrastre (para que la cruz siga al cursor)
  });
  window.addEventListener('mouseup', () => { arr = false; cv.style.cursor = 'crosshair'; });

  /* CROSSHAIR estilo TradingView: al mover el cursor por el gráfico se dibuja
     una cruz y el precio exacto aparece en el eje derecho. */
  // Cursor de la herramienta sobre el radar. Se decide aquí y se RE-APLICA a
  // nivel window (más abajo) porque orden.js engancha su propio mousemove al
  // canvas y repone 'crosshair', pisando la manito. Igual que en Smart Levels.
  const cursorHerramienta = (lx, ly) => {
    const dRp = (rc, p) => rc && lx >= rc.x - p && lx <= rc.x + rc.w + p && ly >= rc.y - p && ly <= rc.y + rc.h + p;
    if (M._pos) {
      const P = M._pos;
      if ((!P.oculto && (dRp(P._hideBtn, 8) || dRp(P._arrL, 8) || dRp(P._arrR, 8))) || (P.oculto && dRp(P._miniBtn, 8))) return 'pointer';  // manita en botones
      const G = P._pos;
      if (G && lx >= G.x - 8 && lx <= G.x + G.w + 8 && ly >= Math.min(G.yt, G.ye, G.ys) - 8 && ly <= Math.max(G.yt, G.ye, G.ys) + 8) {
        if (Math.abs(lx - G.x) < 9 || Math.abs(lx - (G.x + G.w)) < 9) return 'ew-resize';   // bordes → estirar
        if (Math.abs(ly - G.yt) < 9 || Math.abs(ly - G.ye) < 9 || Math.abs(ly - G.ys) < 9) return 'ns-resize';  // líneas → subir/bajar
        return 'grab';                                                                       // cuerpo → mover
      }
    }
    if (M._tend && cercaTend(lx, ly)) return 'grab';
    for (const P of (M._posAuto || [])) {
      if (P.oculto) { if (dRp(P._miniBtn, 6)) return 'pointer'; }
      else if (dRp(P._hideBtn, 6) || dRp(P._arrL, 6) || dRp(P._arrR, 6)) return 'pointer';   // −, ‹ y ›
    }
    for (const b of (M._zonaBtns || [])) {
      if (lx >= b.x - 3 && lx <= b.x + b.w + 3 && ly >= b.y - 3 && ly <= b.y + b.h + 3) return 'pointer';  // manita en la pastilla Liq
    }
    return '';
  };

  cv.addEventListener('mousemove', (e) => {
    if (arr) return;                    // durante el arrastre no se dibuja la cruz
    const r = cv.getBoundingClientRect();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    M._cursor = { x: lx, y: ly };
    const cur = cursorHerramienta(lx, ly);
    cv.style.cursor = cur || (enEscalaM(lx) ? 'ns-resize' : 'crosshair');
    dibujar();
  });
  /* orden.js registra DESPUÉS su propio mousemove sobre el canvas y repone
     'crosshair', comiéndose la manito. Este handler a nivel window corre en la
     fase de burbujeo (después del canvas) y re-impone el cursor correcto cuando
     estamos sobre la herramienta. Copiado tal cual de Smart Levels. */
  window.addEventListener('mousemove', (e) => {
    if (arr) return;
    const cvv = $('mu-cv'); if (!cvv) return;
    const r = cvv.getBoundingClientRect();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    if (lx < 0 || ly < 0 || lx > r.width || ly > r.height) return;
    const cur = cursorHerramienta(lx, ly);
    if (cur) cvv.style.cursor = cur;
  });
  cv.addEventListener('mouseleave', () => { if (M._cursor) { M._cursor = null; cv.style.cursor = 'default'; dibujar(); } });

  cv.addEventListener('dblclick', () => {
    M.ancho = window.innerWidth < 760 ? 65 : 100; M.desplaz = 0; M.zoomY = 1; M.offsetY = 0;
    dibujar();
  });
  cv.style.cursor = 'crosshair';

  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    /* Sobre la escala de precios (el borde derecho) la rueda estira o
       comprime en vertical. En el resto, zoom de tiempo. Igual que
       en TradingView. */
    if (e.clientX - r.left > r.width - 95) {
      M.zoomY = Math.max(0.2, Math.min(6, (M.zoomY || 1) * (e.deltaY > 0 ? 1.12 : 0.9)));
      dibujar();
    } else {
      zoom(e.deltaY > 0 ? 1.28 : 0.78);
    }
  }, { passive: false });

  // Doble clic: volver al encuadre inicial
  cv.addEventListener('dblclick', () => {
    M.ancho = window.innerWidth < 760 ? 65 : 100;
    M.desplaz = 0;
    M.zoomY = 1;
    dibujar();
  });

  /* Táctil: un dedo mueve, dos hacen zoom. */
  let d0 = 0, tx = 0;
  cv.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const r = cv.getBoundingClientRect();
      const lx = e.touches[0].clientX - r.left, ly = e.touches[0].clientY - r.top;
      if (M._pos && M._pos.guia) { M._pos.guia = false; dibujar(); }
      if (M._tend && M._tend.guia) { M._tend.guia = false; dibujar(); }
      const dR = (rc) => rc && lx >= rc.x - 8 && lx <= rc.x + rc.w + 8 && ly >= rc.y - 8 && ly <= rc.y + rc.h + 8;
      if (M._pos) {
        const P = M._pos, ORD = ['der', 'abajo', 'izq', 'arriba'];
        if (P.oculto && dR(P._miniBtn)) { P.oculto = false; cerrarPosCfg(); dibujar(); return; }
        if (!P.oculto && dR(P._hideBtn)) { P.oculto = true; cerrarPosCfg(); dibujar(); return; }
        if (!P.oculto && dR(P._arrL)) { P.cardPos = ORD[(ORD.indexOf(P.cardPos || 'der') + 3) % 4]; dibujar(); return; }
        if (!P.oculto && dR(P._arrR)) { P.cardPos = ORD[(ORD.indexOf(P.cardPos || 'der') + 1) % 4]; dibujar(); return; }
        const G = P._pos;
        if (G && lx >= G.x - 9 && lx <= G.x + G.w + 9 && ly >= Math.min(G.yt, G.ye, G.ys) - 9 && ly <= Math.max(G.yt, G.ye, G.ys) + 9) {
          let act;
          if (Math.abs(lx - G.x) < 10) act = { k: 'borde', lado: 'izq' };
          else if (Math.abs(lx - (G.x + G.w)) < 10) act = { k: 'borde', lado: 'der' };
          else if (Math.abs(ly - G.yt) < 10) act = { k: 'linea', cual: 'target' };
          else if (Math.abs(ly - G.ye) < 10) act = { k: 'linea', cual: 'entry' };
          else if (Math.abs(ly - G.ys) < 10) act = { k: 'linea', cual: 'stop' };
          else act = { k: 'entera', lx, ly };
          M._touchArr = act; mostrarPosCfg(); return;
        }
      }
      if (M._tend && cercaTend(lx, ly)) { M._touchArr = { k: 'tend', ly }; mostrarTendCfg(); return; }
      cerrarPosCfg(); cerrarTendCfg();
      tx = e.touches[0].clientX; arr = true;
    }
    else if (e.touches.length === 2) {
      arr = false;
      d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                      e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && M._touchArr) {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const lx = e.touches[0].clientX - r.left, ly = e.touches[0].clientY - r.top;
      const A = M._touchArr, P = M._pos, T = M._tend;
      if (A.k === 'linea' && P) { const p = mPy(ly); if (A.cual === 'entry') P.pe = p; else if (A.cual === 'target') P.pTarget = p; else P.pStop = p; posPosCfg(); }
      else if (A.k === 'borde' && P) { const t = mTx(lx); if (A.lado === 'izq') P.t0 = t; else P.t1 = t; posPosCfg(); }
      else if (A.k === 'entera' && P) { const dt = mTx(lx) - mTx(A.lx), dp = mPy(ly) - mPy(A.ly); P.t0 += dt; P.t1 += dt; P.pe += dp; P.pTarget += dp; P.pStop += dp; A.lx = lx; A.ly = ly; posPosCfg(); }
      else if (A.k === 'tend' && T) { const dp = mPy(ly) - mPy(A.ly); T.segs.forEach((s) => { s.p0 += dp; s.p1 += dp; }); A.ly = ly; posTendCfg(); }
      dibujar(); return;
    }
    if (e.touches.length === 1 && arr) {
      e.preventDefault();
      const paso = (cv.clientWidth - 84) / (M.ancho || 70);
      const mov = Math.round((e.touches[0].clientX - tx) / Math.max(1, paso));
      if (mov !== 0) {
        const tope = Math.max(0, M.velas.length - (M.ancho || 70));
        const sueloT = -Math.floor((M.ancho || 70) * 0.5);
        M.desplaz = Math.max(sueloT, Math.min(tope, (M.desplaz || 0) + mov));
        tx = e.touches[0].clientX;
        dibujar();
      }
    } else if (e.touches.length === 2 && d0 > 0) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                           e.touches[0].clientY - e.touches[1].clientY);
      if (Math.abs(d - d0) > 8) { zoom(d0 / d); d0 = d; }
    }
  }, { passive: false });
  cv.addEventListener('touchend', () => { arr = false; d0 = 0; M._touchArr = null; });

  cv.style.cursor = 'grab';
}

const COLORES = {
  recargable: { linea: '#E8B84B', texto: '#3a2800', icono: '★', clase: 'oro' },
  probado:    { linea: '#2ee86a', texto: '#04210f', icono: '✓', clase: 'verde' },
  real:       { linea: '#4d9fff', texto: '#04121f', icono: '●', clase: 'azul' },
  falso:      { linea: '#f6465d', texto: '#2a0509', icono: '✕', clase: 'rojo' },
  vigilando:  { linea: '#8b96a3', texto: '#0b0e12', icono: '?', clase: 'gris' },
  ido:        { linea: '#6b7681', texto: '#0b0e12', icono: '·', clase: 'ido' }
};

/* La paleta va de tenue a intenso: lo poco destacable apenas se ve, y
   lo grande grita. Así el mapa se lee de un vistazo. */
function calor(v) {
  const paradas = [
    [0.00, [22, 46, 88]],      // azul apagado — apenas destaca
    [0.30, [34, 96, 176]],     // azul
    [0.55, [30, 170, 190]],    // turquesa
    [0.75, [90, 205, 90]],     // verde
    [0.90, [235, 205, 50]],    // amarillo
    [1.00, [255, 120, 30]]     // naranja — los muros gordos
  ];
  for (let i = 1; i < paradas.length; i++) {
    if (v <= paradas[i][0]) {
      const [a, ca] = paradas[i - 1], [b, cb] = paradas[i];
      const t = (v - a) / Math.max(1e-9, b - a);
      return [
        Math.round(ca[0] + (cb[0] - ca[0]) * t),
        Math.round(ca[1] + (cb[1] - ca[1]) * t),
        Math.round(ca[2] + (cb[2] - ca[2]) * t)
      ];
    }
  }
  return paradas[paradas.length - 1][1];
}

/* ══════════════════════════════════════════════════════════════
   EL PANEL — los veredictos, en lenguaje claro

   Aquí está la diferencia entre una herramienta que se usa y una que
   se abre una vez. No son números: es qué significa cada muro y qué
   hacer con él.
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   EL NARRADOR
   El texto cuenta lo que pasa AHORA, no un estado fijo. Cambia con
   la distancia del precio y sube la tensión cuando se acerca.
   ══════════════════════════════════════════════════════════════ */
function narrar(m, esVenta, dist) {
  /* 'muyCerca' = el precio está de verdad ENCIMA del nivel (a ~0,015%). Antes
     estaba en 0,05% y por eso decía "tocando este nivel" cuando el precio aún
     estaba lejos: una mentira que un trader detecta al instante. */
  const cerca = dist < 0.12, muyCerca = dist < 0.015;

  if (m.tipo === 'falso') {
    return 'It pulls back every time the price approaches. <b>It is smoke</b>: do not count on this level.';
  }
  if (m.tipo === 'ido') {
    return 'The order <b>is gone</b>. That level was left undefended: the price may go straight through.';
  }
  if (m.consumidoPct > 0.75 && cerca) {
    return `<b>It is executing right now.</b> ${Math.round(m.consumidoPct * 100)}% of the order has already been eaten. ` +
           (esVenta ? 'If it finishes, the ceiling falls.' : 'Si termina, el suelo cede.');
  }
  if (muyCerca) {
    return `<b>The price is touching this level.</b> ${dinero(m.v)} ${esVenta ? 'selling' : 'buying'} waiting. ` +
           (esVenta ? 'Aquí se decide si rompe o rebota.' : 'Aquí se decide si aguanta o cede.');
  }
  if (cerca) {
    return `The price is approaching: only <b>${dist.toFixed(2)}%</b> ${esVenta ? 'below' : 'above'}. Atento a lo que pase al llegar.`;
  }
  if (m.recargas >= 2) {
    return `It has been eaten <b>${m.recargas} times</b> and put back again. Someone big insists on defending ${fmt(m.p)}.`;
  }
  const fuerte = m.tipo === 'recargable' || m.tipo === 'probado' || (m.tipo === 'real' && m.segundos > 240);
  if (fuerte) {
    return esVenta
      ? `Has been defending ${fmt(m.p)} for ${tiempo(m.segundos)}. High probability of <b>rejection</b> if the price rises there.`
      : `Has been holding ${fmt(m.p)} for ${tiempo(m.segundos)}. High probability of a <b>bounce</b> if the price drops there.`;
  }
  if (m.tipo === 'real') {
    return `${dinero(m.v)} ${esVenta ? 'selling' : 'buying'} waiting. Untested yet: we will see when the price gets there.`;
  }
  return `Order just placed ${tiempo(m.segundos)} ago. We do not know yet if it is serious.`;
}

/* Narrador de ZONAS de acumulación: dice qué es y qué esperar, con la verdad
   de la distancia (nada de "tocando" cuando no lo está). */
function narrarZona(z, dem, dist) {
  if (z.dentro) {
    return dem
      ? '<b>The price is INSIDE the demand zone.</b> This is where it is decided whether it bounces or loses it.'
      : '<b>The price is INSIDE the supply zone.</b> This is where it is decided whether it rejects or breaks it.';
  }
  if (z.retest) {
    return dem
      ? `The price is <b>${dist.toFixed(2)}%</b> away from retesting this demand. Watch for a possible bounce.`
      : `The price is <b>${dist.toFixed(2)}%</b> away from retesting this supply. Watch for a possible rejection.`;
  }
  const f = z.fuerza >= 4 ? 'Zona <b>fuerte</b>' : 'Zona';
  return dem
    ? `${f} of demand: ${dinero(z.v)} accumulated over ${z.toques} candles. Usually holds up the drops.`
    : `${f} of supply: ${dinero(z.v)} accumulated over ${z.toques} candles. Usually stops the rises.`;
}

/* ══════════════════════════════════════════════════════════════
   COCKPIT — el resumen que un gestor lee en 2 segundos
   ══════════════════════════════════════════════════════════════ */
function pintarCockpit() {
  const c = $('mu-cockpit'); if (!c) return;
  const m = M.mercado;
  const zs = M.zonas || [];
  const cercana = zs.slice().sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))[0];
  const fuerteProx = zs.filter((z) => z.fuerza >= 4 && !z.rota).sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))[0];
  const sesgo = m ? m.sesgo : 'neutral';
  const sesgoCol = sesgo === 'comprador' ? '#2ee86a' : sesgo === 'vendedor' ? '#f6465d' : '#8b96a3';
  let deltaTxt = '\u2014', deltaCol = '#8b96a3';
  if (M.delta) {
    const r = M.delta.ratio;
    deltaTxt = (r >= 0.5 ? '+' : '') + Math.round((r - 0.5) * 200) + '%';
    deltaCol = r >= 0.55 ? '#2ee86a' : r <= 0.45 ? '#f6465d' : '#8b96a3';
  }
  const ctx = (M.contexto || []).map((g) => {
    const col = g.estado === 'demanda' ? '#2ee86a' : g.estado === 'oferta' ? '#f6465d' : '#6b7681';
    const ic = g.estado === 'demanda' ? '\u25b2' : g.estado === 'oferta' ? '\u25bc' : '\u00b7';
    return `<span style="color:${col}">${g.id} ${ic}</span>`;
  }).join(' ');
  const celda = (val, lbl, col) => `<div class="mu-ck"><b style="color:${col || 'var(--mu-tx)'}">${val}</b><span>${lbl}</span></div>`;
  c.innerHTML =
    celda(`<span style="color:${sesgoCol};text-transform:capitalize">${sesgo}</span>`, 'market bias') +
    celda(m && m.winRate != null ? m.winRate + '%' : '\u2014', m && m.muestra ? 'acierto \u00b7 ' + m.muestra : 'acierto', m && m.winRate >= 60 ? '#2ee86a' : (m && m.winRate != null ? '#E8B84B' : '#8b96a3')) +
    celda(deltaTxt, 'flujo agresor', deltaCol) +
    celda(cercana ? (cercana.dentro ? 'AQU\u00cd' : (Math.abs(cercana.dist) * 100).toFixed(2) + '%') : '\u2014', 'zona cercana', cercana && cercana.dentro ? '#E8B84B' : 'var(--mu-tx)') +
    celda(fuerteProx ? fmt(fuerteProx.p) : '\u2014', 'pr\u00f3x. fuerte', fuerteProx ? (fuerteProx.lado === 'demanda' ? '#2ee86a' : '#f6465d') : '#8b96a3') +
    (ctx ? `<div class="mu-ck mu-ck-ctx"><b>${ctx}</b><span>BTC \u00b7 ETH</span></div>` : '');
}

function pintarPanel() {
  if (!document.getElementById('mu-panel')) return;   // panel retirado: nada que pintar
  const lista = $('mu-lista'); if (!lista) return;
  const estado = $('mu-estado');
  pintarCockpit();

  /* Las cuentas de cada filtro (ahora sobre las ZONAS). */
  const cuenta = (id, f) => {
    const el = $('mu-n-' + id);
    if (el) el.textContent = M.zonas.filter(f).length;
  };
  cuenta('compra', (z) => z.lado === 'demanda');
  cuenta('venta', (z) => z.lado === 'oferta');
  cuenta('fuertes', (z) => z.fuerza >= 4);
  cuenta('falsos', (z) => z.retest || z.dentro);
  const mtn = $('mu-mtab-n'); if (mtn) mtn.textContent = M.zonas.length;

  if (M.error) { if (estado) estado.textContent = M.error; return; }

  if (M.cargando || !M.zonas.length && !M.velas.length) {
    if (estado) estado.textContent = '';
    lista.innerHTML = `<div class="mu-esperar">Leyendo el mercado…</div>`;
    return;
  }
  if (estado) estado.textContent = '';

  /* El filtro. Sin ninguno activo se ven todas. */
  let lst = M.zonas.slice();
  if (M.filtro === 'fuertes') lst = lst.filter((z) => z.fuerza >= 4);
  else if (M.filtro === 'compra') lst = lst.filter((z) => z.lado === 'demanda');
  else if (M.filtro === 'venta') lst = lst.filter((z) => z.lado === 'oferta');
  else if (M.filtro === 'falsos') lst = lst.filter((z) => z.retest || z.dentro);

  if (!lst.length) {
    lista.innerHTML = `<div class="mu-esperar">
      <b>${M.filtro === 'todos' ? 'Sin zonas claras' : 'Nada de ese tipo'}</b>
      ${M.filtro === 'todos'
        ? 'No hay acumulación destacable en ' + esc(_par) + ' en este rango.'
        : 'Prueba con otro filtro o quítalo para ver todas.'}
    </div>`;
    return;
  }

  const tarjeta = (z, id) => {
    const dem = z.lado === 'demanda';
    const pct = (Math.abs(z.dist) * 100).toFixed(2);
    const fuerza = z.fuerza;                          // 1..5
    const clase = z.rota ? 'gris' : (dem ? 'verde' : 'rojo');
    const abierta = M.seleccionado === z.p;
    const conse = narrarZona(z, dem, Math.abs(z.dist) * 100);
    const compPct = Math.round(z.compradorPct * 100);
    const flujo = dem
      ? `${compPct}% comprador`
      : `${100 - compPct}% vendedor`;
    const queHacer = z.rota
      ? '<b>Broken</b> zone: the price pierced it. It could act in reverse (flip) if it comes back.'
      : dem
        ? '<b>Demand</b> zone: possible bounce / long entry on a retest of the level.'
        : '<b>Supply</b> zone: possible rejection / short entry on a retest of the level.';

    // Insignias
    const badges = [
      z.ref ? '<i class="mu-b ref">\u25c7 VWAP/VA</i>' : '',
      z.confluencia ? '<i class="mu-b conf">\u25c8 ' + (TF_SUPERIOR[M.tf] || 'HTF') + '</i>' : '',
      z.libro ? '<i class="mu-b libro">\u25a3 libro</i>' : '',
      z.alineado && !z.rota ? '<i class="mu-b flujo">\u2713 flujo</i>' : '',
      z.rota ? '<i class="mu-b rota">\u2715 rota</i>' : ''
    ].join('');

    // Línea de tiempo del ciclo de vida
    const v = z.vida;
    const hace = (t) => { if (!t) return ''; const s = Math.round((Date.now() - t) / 1000); if (s < 60) return s + 's'; if (s < 3600) return Math.round(s / 60) + 'min'; if (s < 86400) return Math.round(s / 3600) + 'h'; return Math.round(s / 86400) + 'd'; };
    const timeline = v ? `
        <div class="mu-timeline">
          <span class="tl on"><i></i>formada<b>hace ${hace(v.nace)}</b></span>
          <span class="tl ${v.tests > 0 ? 'on' : ''}"><i></i>testeada<b>${v.tests}\u00d7</b></span>
          <span class="tl ${v.confirmada ? 'on' : ''}"><i></i>${v.confirmada ? 'confirmada' : 'sin confirmar'}<b>${v.confirmada ? '\u2713' : '\u2026'}</b></span>
          <span class="tl ${z.rota ? 'rota' : ''}"><i></i>${z.rota ? 'ROTA' : 'vigente'}<b>${z.rota ? hace(v.rotaTs) : '\u2713'}</b></span>
        </div>` : '';

    return `
    <div class="mu-card ${clase} f${fuerza >= 4 ? 3 : fuerza >= 2 ? 2 : 1} ${abierta ? 'sel' : ''} ${z.rota ? 'es-rota' : ''}"
         data-id="${id}" data-lado="${dem ? 'compra' : 'venta'}">
      <button class="mu-cab-card" data-mp="${z.p}">
        <div class="mu-l1">
          <span class="mu-lado">${z.rota ? (dem ? 'DEMANDA ROTA' : 'OFERTA ROTA') : (dem ? 'DEMANDA' : 'OFERTA')}</span>
          ${fuerza >= 4 && !z.rota ? '<i class="mu-fuerte">\u2605 FUERTE</i>' : ''}
          <span class="mu-imp">${dinero(z.v)}</span>
        </div>
        <div class="mu-l2">
          <span class="mu-nivel">${fmt(z.pLow)}\u2013${fmt(z.pHigh)}</span>
          <span class="mu-dist2 ${z.dentro ? 'urge' : z.retest ? 'cerca' : ''}">${z.dentro ? 'AQU\u00cd' : pct + '% ' + (dem ? '\u2193' : '\u2191')}</span>
          <span class="mu-fl">${abierta ? '\u25b2' : '\u25bc'}</span>
        </div>
        <div class="mu-conf"><i class="mu-conf-bar" style="width:${Math.round(z.confianza)}%"></i><em>${Math.round(z.confianza)}<span>conf.</span></em></div>
        ${badges ? `<div class="mu-badges">${badges}</div>` : ''}
        ${z.dentro || z.retest ? `<div class="mu-aviso-vivo">\u27f3 ${z.dentro ? 'El precio est\u00e1 en la zona ahora' : 'El precio est\u00e1 por retestear esta zona'}</div>` : ''}
      </button>
      ${abierta ? `<div class="mu-detalle">
        <div class="mu-conse mu-escribe">${conse}</div>${timeline}
        <div class="mu-metricas">
          <div><b>${fmt(z.pPoc)}</b><span>POC (entrada)</span></div>
          <div><b>${flujo}</b><span>flujo firmado</span></div>
          <div><b>${z.reacciones}</b><span>reacciones</span></div>
          <div><b>${z.toques}</b><span>toques</span></div>
          <div><b>${z.confluencia ? 'S\u00ed' : 'No'}</b><span>confluencia ${TF_SUPERIOR[M.tf] || ''}</span></div>
          <div><b>${'\u25cf'.repeat(fuerza)}${'\u25cb'.repeat(5 - fuerza)}</b><span>fuerza</span></div>
        </div>
        <div class="mu-hacer">${queHacer}</div>
      </div>` : ''}
    </div>`;
  };

  /* [CORREGIDO a fondo] `innerHTML = ...` destruye y recrea TODOS los
     nodos, y eso es lo que produce el parpadeo por mucho que se
     controle cuándo llamar.

     Ahora se compara con lo que ya está pintado: las tarjetas que
     siguen igual NO se tocan, solo se añaden las nuevas y se quitan
     las que se fueron. */
  /* ══════════════════════════════════════════════════════════
     [RESUELTO A FONDO] EL PARPADEO

     `innerHTML = ...` destruye y recrea TODOS los nodos del panel.
     Da igual cuándo se llame: cada repintado hace parpadear la lista
     entera. Controlar la frecuencia no lo arregla, solo lo espacia.

     La solución de verdad es no recrear nada:

       · Cada tarjeta lleva su precio como identidad (data-id).
       · Las que ya están se REUTILIZAN: solo se actualizan los
         textos que cambiaron, uno a uno.
       · Solo se crean las tarjetas nuevas y se borran las que
         desaparecieron.

     Resultado: los nodos sobreviven entre refrescos y la lista no
     parpadea nunca.
     ══════════════════════════════════════════════════════════ */
  const vistos = new Set();

  lst.forEach((m, idx) => {
    const id = 'w' + m.p.toFixed(6);
    vistos.add(id);
    let card = lista.querySelector(`[data-id="${id}"]`);

    if (!card) {
      // Tarjeta nueva: se crea y se coloca en su sitio
      const tmp = document.createElement('div');
      tmp.innerHTML = tarjeta(m, id);
      card = tmp.firstElementChild;
      const enPos = lista.children[idx];
      if (enPos) lista.insertBefore(card, enPos); else lista.appendChild(card);
      enganchar(card);
    } else {
      /* Si cambia el estado abierto/cerrado hay que rehacer ESA
         tarjeta (aparece o desaparece el bloque de detalle), pero
         solo esa: las demás siguen intactas. */
      const abiertaAhora = M.seleccionado === m.p;
      const estabaAbierta = !!card.querySelector('.mu-detalle');
      if (abiertaAhora !== estabaAbierta) {
        const tmp = document.createElement('div');
        tmp.innerHTML = tarjeta(m, id);
        const nueva = tmp.firstElementChild;
        card.replaceWith(nueva);
        card = nueva;
        enganchar(card);
      } else {
        actualizar(card, m);
      }
      // Y se recoloca solo si cambió de orden
      if (lista.children[idx] !== card) {
        const enPos = lista.children[idx];
        if (enPos) lista.insertBefore(card, enPos); else lista.appendChild(card);
      }
    }
  });

  // Fuera las que ya no están
  [...lista.children].forEach((el) => {
    if (!vistos.has(el.dataset.id)) el.remove();
  });

  function enganchar(card) {
    const b = card.querySelector('[data-mp]');
    if (!b) return;
    b.onclick = () => {
      const p = Number(b.dataset.mp);
      M.seleccionado = M.seleccionado === p ? null : p;
      pintarPanel(); dibujar();
    };
  }
}

/** Actualiza una tarjeta sin recrearla: solo lo que cambió. */
function actualizar(card, z) {
  const dem = z.lado === 'demanda';
  const dist = Math.abs(z.dist) * 100;
  const fuerza = z.fuerza;

  const pon = (sel, txt) => {
    const e = card.querySelector(sel);
    if (e && e.textContent !== txt) e.textContent = txt;
  };
  const clase = (sel, cl, si) => {
    const e = card.querySelector(sel);
    if (e) e.classList.toggle(cl, si);
  };

  pon('.mu-imp', dinero(z.v));
  pon('.mu-nivel', fmt(z.pLow) + '\u2013' + fmt(z.pHigh));
  pon('.mu-dist2', z.dentro ? 'AQU\u00cd' : dist.toFixed(2) + '% ' + (dem ? '\u2193' : '\u2191'));
  pon('.mu-lado', z.rota ? (dem ? 'DEMANDA ROTA' : 'OFERTA ROTA') : (dem ? 'DEMANDA' : 'OFERTA'));

  // Barra de confianza
  const barra = card.querySelector('.mu-conf-bar');
  if (barra) barra.style.width = Math.round(z.confianza) + '%';
  const cn2 = card.querySelector('.mu-conf em');
  if (cn2) { const t = Math.round(z.confianza) + ''; if (cn2.firstChild && cn2.firstChild.textContent !== t) cn2.firstChild.textContent = t; }

  const claseCol = z.rota ? 'gris' : (dem ? 'verde' : 'rojo');
  ['oro', 'verde', 'azul', 'rojo', 'gris', 'ido'].forEach((k) => {
    card.classList.toggle(k, k === claseCol);
  });
  // Clase de fuerza (f1/f2/f3) y chip "FUERTE" en vivo
  const fClass = fuerza >= 4 ? 'f3' : fuerza >= 2 ? 'f2' : 'f1';
  ['f1', 'f2', 'f3'].forEach((k) => card.classList.toggle(k, k === fClass));
  const l1 = card.querySelector('.mu-l1');
  let chip = card.querySelector('.mu-fuerte');
  if (fuerza >= 4 && !z.rota && !chip && l1) {
    chip = document.createElement('i'); chip.className = 'mu-fuerte'; chip.textContent = '\u2605 FUERTE';
    l1.insertBefore(chip, l1.querySelector('.mu-imp'));
  } else if ((fuerza < 4 || z.rota) && chip) { chip.remove(); }
  card.classList.toggle('es-rota', !!z.rota);
  card.dataset.lado = dem ? 'compra' : 'venta';

  clase('.mu-dist2', 'cerca', z.retest && !z.dentro);
  clase('.mu-dist2', 'urge', z.dentro);

  const det = card.querySelector('.mu-detalle');
  if (det) {
    const cn = card.querySelector('.mu-conse');
    const txt = narrarZona(z, dem, dist);
    if (cn && cn.innerHTML !== txt) {
      cn.innerHTML = txt;
      cn.classList.remove('mu-escribe');
      void cn.offsetWidth;
      cn.classList.add('mu-escribe');
    }
  }
}



/* ══════════════════════════════════════════════════════════════
   SELECTOR DE MONEDA
   ══════════════════════════════════════════════════════════════ */
function menuPares() {
  const prev = document.getElementById('mu-picker');
  if (prev) { prev.remove(); return; }

  const anc = $('mu-sel');
  const m = document.createElement('div');
  m.id = 'mu-picker';
  m.innerHTML = `
    <input class="mu-buscar" id="mu-buscar" placeholder="Buscar…" autocomplete="off">
    <div class="mu-lista-mon">
      ${PARES.map((p) => `
        <button class="mu-op ${p.id === _par ? 'on' : ''}" data-mv="${p.id}"
                data-busca="${esc((p.id + ' ' + p.n).toLowerCase())}">
          <i class="mu-logo" data-cg="${esc(p.cg)}"></i>
          <b>${esc(p.id)}</b><span>${esc(p.n)}</span>
          ${p.id === _par ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="m20 6-11 11-5-5"/></svg>' : ''}
        </button>`).join('')}
    </div>`;
  document.body.appendChild(m);

  const r = anc.getBoundingClientRect();
  const ancho = m.offsetWidth || 232;
  m.style.left = Math.max(8, Math.min(window.innerWidth - ancho - 8, r.left)) + 'px';
  m.style.top = (r.bottom + 6) + 'px';
  setTimeout(ponerLogos, 30);

  m.addEventListener('click', (e) => e.stopPropagation());
  $('mu-buscar').oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    m.querySelectorAll('[data-mv]').forEach((x) => {
      x.style.display = !q || x.dataset.busca.includes(q) ? '' : 'none';
    });
  };
  setTimeout(() => { try { $('mu-buscar').focus(); } catch (_) {} }, 60);

  m.querySelectorAll('[data-mv]').forEach((b) => b.onclick = () => {
    _par = b.dataset.mv;
    M._pos = null; M._tend = null; M._posList = null; quitarPager(); cerrarPosCfg(); cerrarTendCfg();
    /* Una ficha de otra moneda no puede quedarse abierta. */
    try { if (_od && _od.cerrarFichas) _od.cerrarFichas(); } catch (_) {}
    const bb = anc.querySelector('b'); if (bb) bb.textContent = _par;
    const lg = anc.querySelector('.mu-logo');
    if (lg) {
      lg.dataset.cg = (PARES.find((x) => x.id === _par) || {}).cg || '';
      lg.classList.remove('con'); lg.style.backgroundImage = '';
    }
    m.remove();
    // Cambiar de moneda es empezar de cero: el historial no vale
    M.fotos = []; M.niveles = new Map(); M.muros = [];
    _htfTs = 0; _jerTs = 0; M._velasJerar = null; M._tendJerar = null;   // recalcular jerárquica del nuevo par
    M.cargando = true; M.seleccionado = null; M.paso = 0;
    ponerLogos();
    pintarPanel();
    arrancar();
    cargarVelas();
  });
  setTimeout(() => document.addEventListener('click', () => {
    const x = document.getElementById('mu-picker'); if (x) x.remove();
  }, { once: true }), 10);
}

const CLAVE_LOGOS = 'aurex-logos-v2';   // versionada: al ampliar la lista, se recargan todos los logos
let _logos = null;
async function ponerLogos() {
  if (!_logos) {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_LOGOS) || 'null');
      if (g && Date.now() - g.cuando < 86400000) _logos = g.datos;
    } catch (_) {}
  }
  if (!_logos) {
    try {
      const ids = PARES.map((p) => p.cg).join(',');
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=250`);
      const j = await r.json();
      _logos = {};
      j.forEach((x) => { _logos[x.id] = x.image; });
      try { localStorage.setItem(CLAVE_LOGOS, JSON.stringify({ cuando: Date.now(), datos: _logos })); } catch (_) {}
    } catch (_) { _logos = {}; }
  }
  document.querySelectorAll('.mu-logo[data-cg]').forEach((el) => {
    const url = _logos && _logos[el.dataset.cg];
    if (url) { el.style.backgroundImage = `url(${url})`; el.classList.add('con'); }
  });
}

/* ══════════════════════════════════════════════════════════════
   LA GUÍA
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   LA GUÍA — paso a paso, como en Prize Pool y Market

   Nadie lee un muro de texto. Un paso por pantalla, con su idea
   clara, y el usuario avanza a su ritmo.
   ══════════════════════════════════════════════════════════════ */
const PASOS_MU = [
  {
    t: 'Qué es Heat Pools',
    d: 'Heat Pools es una herramienta de <b>high performance</b> que revela <b>dónde se concentra el volumen de negociación</b> en los niveles más exactos del mercado. Analiza los datos en <b>tiempo real</b> (precio, niveles de negociación y liquidez) y los pinta como un <b>mapa de calor</b> sobre las zonas donde el dinero de verdad se ha estado acumulando.',
    x: 'It is the first tool of its kind on the platform: it shows you at a glance where the real market interest is.'
  },
  {
    t: 'What it is for',
    d: 'Sobre cada zona de interés, Heat Pools proyecta el mapa de calor y te ofrece <b>entradas listas para operar</b>, con su <b>stop</b> y su <b>objetivo</b> ya calculados. No tienes que ser un experto en análisis técnico: el sistema hace el trabajo y te señala los niveles.',
    x: 'The idea is for you to see clearly where to buy and where to sell, without racking your brain.'
  },
  {
    t: 'Step 1 · Open Heat Pools and choose a coin',
    d: 'Abre la sección <b>Heat Pools</b> y arriba selecciona la <b>criptomoneda</b> que quieras analizar. Tienes una amplia gama de monedas disponibles para hacer análisis técnico.',
    x: 'You can switch coins whenever you want to look for opportunities in several at once.'
  },
  {
    t: 'Step 2 · Choose the timeframe',
    d: 'Selecciona la <b>temporalidad</b> en la que deseas operar. Se recomienda <b>de 5 minutos en adelante</b>: las temporalidades más pequeñas también funcionan, pero cuanto <b>más grande</b> es la temporalidad, <b>mejor</b> suele ser la lectura. No quedan invalidadas las demás; simplemente las mayores dan señales más sólidas.',
    x: 'Rule of thumb: if in doubt, go up a timeframe. Bigger, more reliable.'
  },
  {
    t: 'Step 3 · Enable entries (Single or Double)',
    d: 'Cuando tengas clara tu dinámica, toca <b>Single</b> o <b>Double</b> para habilitar las entradas disponibles. <b>Single</b> pone una posición por zona; <b>Double</b> pone dos: la segunda entra donde iría el stop de la primera, de modo que una operación doble puede <b>salvar el stop</b> de una simple y darte mayor probabilidad de éxito.',
    x: 'Double is recommended when you want to spread the risk and protect the trade better.'
  },
  {
    t: 'ALWAYS trade with the trend',
    d: 'Aunque el sistema marque buenas zonas, opera <b>a favor de la tendencia predominante</b>. No tiene sentido entrar en contra del rumbo grande del mercado: aunque la zona sea válida, la probabilidad de éxito baja y el resultado puede no ser el esperado.',
    x: 'Primero mira hacia dónde va el mercado en general; después usa las zonas para entrar en esa dirección.'
  },
  {
    t: 'Manage risk wisely',
    d: 'Las entradas vienen con una relación <b>riesgo/beneficio de 1:2</b>. Cuando lleves ganado el equivalente a lo que arriesgaste, un buen hábito es: en <b>futuros</b>, mover el stop al <b>precio de entrada</b> (así ya no puedes perder); en <b>spot</b>, no necesitas stop, porque <b>no hay precio de liquidación</b>: compras y vendes de forma orgánica con paciencia.',
    x: 'In spot there is no liquidation, so trading calmly with adequate capital you can manage without stress.'
  },
  {
    t: 'Share your signals and analysis',
    d: 'Con <b>Share signal</b> generas una imagen y un texto con las entradas, stops y objetivos, ideal si quieres crear tu propio <b>grupo de señales</b> y cobrar por ese servicio: la plataforma te lo permite. Con <b>compartir imagen</b> envías el escenario actual del mercado a amigos o clientes.',
    x: 'Many users turn this into income: they set up signal or analysis groups using the platform.'
  },
  {
    t: 'Extra tools',
    d: 'Puedes cambiar entre <b>tema claro y oscuro</b>, consultar el <b>calendario económico</b> actualizado de hoy en tiempo real, y analizar una <b>amplia variedad de criptomonedas</b> en múltiples temporalidades para encontrar más oportunidades.',
    x: 'Everything is on the same screen, one tap away, so you never lose sight of an opportunity.'
  },
  {
    t: 'An honest recommendation',
    d: 'Esto es <b>trading en los mercados financieros</b>. Aunque operes en spot, <b>arriesga solo lo que estés dispuesto a perder</b>: nunca inviertas tus ahorros personales ni dinero que necesites. Con paciencia, disciplina y el capital adecuado, Heat Pools es una herramienta poderosa para operar de forma más inteligente.',
    x: 'Consistency is worth more than haste. Trade responsibly and let the tool work for you.'
  }
];

let _pasoMu = 0;

function ayuda() {
  _pasoMu = 0;
  const d = document.createElement('div');
  d.id = 'mu-ayuda-box';
  d.innerHTML = `<div class="mu-bg"></div>
    <div class="mua-c">
      <button class="mua-x" id="mua-x" aria-label="Cerrar">✕</button>
      <div class="mua-eyebrow">Heat Pools</div>
      <div id="mua-cuerpo"></div>
    </div>`;
  document.body.appendChild(d);

  const q = () => d.remove();
  d.querySelector('.mu-bg').onclick = q;
  $('mua-x').onclick = q;
  pintarPaso();
}

function pintarPaso() {
  const c = $('mua-cuerpo'); if (!c) return;
  const p = PASOS_MU[_pasoMu];
  const ultimo = _pasoMu === PASOS_MU.length - 1;

  c.innerHTML = `
    <div class="mua-card">
      <div class="mua-n">${_pasoMu + 1} <em>de ${PASOS_MU.length}</em></div>
      <div class="mua-t">${p.t}</div>
      <div class="mua-d">${p.d}</div>
      <div class="mua-x2">${p.x}</div>
    </div>

    <div class="mua-puntos">
      ${PASOS_MU.map((_, i) => `<i class="${i === _pasoMu ? 'on' : ''}" data-paso="${i}"></i>`).join('')}
    </div>

    <div class="mua-acts">
      ${_pasoMu > 0 ? '<button class="mua-atras" id="mua-atras">Atrás</button>' : ''}
      <button class="mua-b" id="mua-sig">${ultimo ? 'Entendido' : 'Saber más'}</button>
    </div>`;

  $('mua-sig').onclick = () => {
    if (_pasoMu >= PASOS_MU.length - 1) { document.getElementById('mu-ayuda-box')?.remove(); return; }
    _pasoMu++; pintarPaso();
  };
  const at = $('mua-atras');
  if (at) at.onclick = () => { _pasoMu = Math.max(0, _pasoMu - 1); pintarPaso(); };
  c.querySelectorAll('[data-paso]').forEach((b) => b.onclick = () => {
    _pasoMu = Number(b.dataset.paso); pintarPaso();
  });
}

/* ══════════════════════════════════════════════════════════════
   ESTILOS
   ══════════════════════════════════════════════════════════════ */
function estilos() {
  if ($('mu-css')) return;
  const s = document.createElement('style'); s.id = 'mu-css';
  s.textContent = `
  #mu-overlay{--mu-tx:#eaecef;position:fixed;inset:0;z-index:9740;display:flex;align-items:center;justify-content:center}
  #mu-overlay .mu-bg{position:absolute;inset:0;background:rgba(3,5,8,.94)}
  #mu-overlay .mu-c{position:relative;width:100%;height:100vh;height:100dvh;
    display:flex;flex-direction:column;background:#080b10}

  /* ── Barra ── */
  #mu-overlay .mu-barra{display:flex;align-items:center;gap:12px;flex:0 0 auto;position:relative;
    padding:9px 136px 9px 12px;background:#0b0e12;border-bottom:1px solid #1c2128}
  #mu-overlay .mu-sel{display:inline-flex;align-items:center;gap:9px;flex:0 0 auto;min-height:36px;
    padding:0 12px;border-radius:10px;background:#12161c;border:1px solid #2b3139;color:#eaecef;
    cursor:pointer;font-family:var(--mono,monospace);font-size:12.5px}
  #mu-overlay .mu-sel:hover{border-color:var(--gold-soft,#C9A84B)}
  #mu-overlay .mu-sel b{font-weight:700}
  #mu-overlay .mu-sel svg{width:13px;height:13px;opacity:.6}
  .mu-logo{width:20px;height:20px;border-radius:50%;flex:0 0 auto;display:block;
    background:rgba(255,255,255,.06) center/cover no-repeat;border:1px solid #2b3139}
  .mu-logo.con{background-color:transparent;border-color:transparent}
  #mu-overlay .mu-estado-err{align-self:center;font-family:var(--mono,monospace);font-size:10px;color:#f6465d;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
  #mu-overlay .mu-vivo{display:flex;align-items:center;gap:7px;min-width:0;
    font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;
    text-transform:uppercase;letter-spacing:.7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #mu-overlay .mu-vivo i{width:7px;height:7px;border-radius:50%;background:#2ee86a;flex:0 0 auto;
    animation:muLat 1.8s ease-in-out infinite}
  @keyframes muLat{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(46,232,106,.5)}50%{opacity:.55;box-shadow:0 0 0 5px rgba(46,232,106,0)}}
  /* Temporalidad y precio en la barra */
  #mu-overlay .mu-tfs{display:none;gap:2px;flex:0 0 auto;padding:3px;background:#12161c;border-radius:9px}
  #mu-overlay .mu-tf{min-height:30px;padding:0 11px;border-radius:7px;border:none;background:transparent;
    color:#7d8794;font-family:var(--mono,monospace);font-size:11px;font-weight:700;cursor:pointer}
  #mu-overlay .mu-tf.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800}

  /* Chip de temporalidad (solo móvil) + su desplegable. En escritorio se ve la
     fila .mu-tfs completa y el chip está oculto. */
  #mu-overlay .mu-tfchip{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;
    border-radius:11px;background:#12161c;border:1px solid #2b3139;color:#eaecef;cursor:pointer;
    font-family:var(--mono,monospace);font-weight:800;font-size:13.5px;flex:0 0 auto}
  #mu-overlay .mu-tfchip svg{width:14px;height:14px;opacity:.65}
  #mu-tfmenu{position:fixed;z-index:12000;background:#12161c;border:1px solid #2b3139;border-radius:14px;
    padding:6px;box-shadow:0 18px 44px rgba(0,0,0,.6);display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;
    min-width:210px;max-height:60vh;overflow-y:auto;animation:muMenu .16s ease}
  @keyframes muMenu{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
  #mu-tfmenu .mu-tfmenu-it{min-height:42px;border-radius:10px;border:1px solid transparent;
    background:rgba(255,255,255,.04);color:#c7cdd6;font-family:var(--mono,monospace);font-weight:700;
    font-size:13px;cursor:pointer}
  #mu-tfmenu .mu-tfmenu-it:hover{border-color:#3a424c;color:#eaecef}
  #mu-tfmenu .mu-tfmenu-it.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);
    color:#3a2800;border-color:var(--gold,#E8B84B)}

  /* Pestañas móvil Gráfica/Órdenes (ocultas en escritorio) */
  #mu-overlay .mu-mtabs{display:none;flex:0 0 auto;gap:6px;padding:8px 10px;background:#0b0e12;
    border-bottom:1px solid #1c2128}
  #mu-overlay .mu-mtab{flex:1;min-height:40px;border-radius:11px;border:1px solid #232a33;
    background:rgba(255,255,255,.03);color:#8b96a3;font-family:var(--display,sans-serif);font-weight:800;
    font-size:13.5px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px}
  #mu-overlay .mu-mtab i{font-style:normal;min-width:20px;height:20px;padding:0 5px;border-radius:20px;
    display:inline-grid;place-items:center;background:rgba(255,255,255,.08);color:#c7cdd6;
    font-family:var(--mono,monospace);font-size:11px;font-weight:700}
  #mu-overlay .mu-mtab.on{background:linear-gradient(180deg,rgba(232,184,75,.16),rgba(232,184,75,.06));
    border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #mu-overlay .mu-mtab.on i{background:rgba(232,184,75,.2);color:var(--gold,#E8B84B)}
  #mu-overlay .mu-px{display:flex;flex-direction:column;gap:1px;flex:0 0 auto;padding-left:6px}
  #mu-overlay .mu-px span{font-family:var(--mono,monospace);font-size:8.5px;color:#5c6672;
    text-transform:uppercase;letter-spacing:1.1px}
  #mu-overlay .mu-px b{font-family:var(--display,sans-serif);font-weight:800;font-size:19px;
    color:var(--gold,#E8B84B);line-height:1}
  /* Filtros del panel */
  #mu-overlay .mu-chips{display:flex;gap:5px;flex-wrap:wrap;padding:9px 14px 11px}
  #mu-overlay .mu-fchip{min-height:30px;padding:0 11px;border-radius:20px;cursor:pointer;
    background:rgba(255,255,255,.04);border:1px solid #232a33;color:#7d8794;
    font-family:var(--mono,monospace);font-size:10.5px;font-weight:700;white-space:nowrap}
  #mu-overlay .mu-fchip:hover{border-color:#3a424c;color:#b7bdc6}
  #mu-overlay .mu-fchip.on{background:rgba(232,184,75,.14);border-color:var(--gold-soft,#C9A84B);
    color:var(--gold,#E8B84B)}
  #mu-overlay .mu-der{position:absolute;right:10px;top:50%;transform:translateY(-50%);
    display:flex;gap:6px;background:transparent;padding-left:8px}
  #mu-overlay .mu-ico{width:36px;height:36px;min-height:36px;flex:0 0 auto;border-radius:10px;
    display:grid;place-items:center;padding:0;cursor:pointer;
    background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,.03));border:1px solid #2b3139;color:#8b96a3;
    box-shadow:0 2px 5px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.06);
    font-family:var(--mono,monospace);font-size:14px;font-weight:700;transition:transform .1s ease,border-color .15s ease}
  #mu-overlay .mu-ico:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #mu-overlay .mu-ico:active{transform:translateY(1px);box-shadow:0 1px 3px rgba(0,0,0,.4)}
  #mu-overlay .mu-news{position:relative}
  #mu-overlay .mu-news .mu-news-dot{position:absolute;top:5px;right:5px;width:7px;height:7px;border-radius:50%;background:#f6465d;box-shadow:0 0 0 0 rgba(246,70,93,.6);animation:muNewsPulse 2.2s infinite}
  @keyframes muNewsPulse{0%{box-shadow:0 0 0 0 rgba(246,70,93,.55)}70%{box-shadow:0 0 0 6px rgba(246,70,93,0)}100%{box-shadow:0 0 0 0 rgba(246,70,93,0)}}
  /* "Cómo funciona" con texto en escritorio, solo el signo en móvil. */
  #mu-overlay .mu-comofunciona{width:auto;padding:0 14px;gap:0;
    border-color:rgba(232,184,75,.4);color:var(--gold,#E8B84B)}
  #mu-overlay .mu-cf-txt{font-family:var(--display,sans-serif);font-weight:700;font-size:12.5px;
    white-space:nowrap;letter-spacing:.2px}
  #mu-overlay .mu-cf-sig{display:none}
  @media(max-width:860px){
    #mu-overlay .mu-comofunciona{width:36px;padding:0}
    #mu-overlay .mu-cf-txt{display:none}
    #mu-overlay .mu-cf-sig{display:block;font-size:14px;font-weight:700}
  }
  /* Avisos del narrador */
  #mu-overlay .mu-dist2.cerca{background:rgba(232,184,75,.2);color:#E8B84B}
  #mu-overlay .mu-dist2.urge{background:rgba(246,70,93,.25);color:#ff8a95;
    animation:muPulso 1.3s ease-in-out infinite}
  @keyframes muPulso{0%,100%{opacity:1}50%{opacity:.55}}
  #mu-overlay .mu-aviso-vivo{margin-top:7px;padding:5px 9px;border-radius:7px;
    background:rgba(246,70,93,.14);border:1px solid rgba(246,70,93,.3);
    font-family:var(--mono,monospace);font-size:10px;color:#ff8a95;letter-spacing:.4px}

  /* ── Cuerpo: gráfico + panel ── */
  #mu-overlay .mu-cuerpo{flex:1;min-height:0;display:flex}
  #mu-overlay .mu-graf{flex:1;min-width:0;position:relative;background:#080b10}
  #mu-overlay .mu-cv{display:block}
  /* El logo, corrido a la derecha: en la izquierda tapaba la columna
     de precios. */
  #mu-overlay .mu-marca{position:absolute;left:14px;bottom:30px;height:38px;width:auto;opacity:.75;pointer-events:none;filter:drop-shadow(0 2px 8px rgba(0,0,0,.95))}

  /* Pantalla de espera */
  /* [CORREGIDO] Esta capa tapaba el lienzo y se comía el clic
     derecho: por eso no salía el menú de órdenes en el Radar.
     Mientras informa no necesita recibir clics. */
  #mu-overlay .mu-esperando{pointer-events:none;
    position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:12px;text-align:center;padding:30px;
    background:rgba(8,11,16,.96)}
  #mu-overlay .mu-spin{width:38px;height:38px;border-radius:50%;
    border:2.5px solid rgba(232,184,75,.16);border-top-color:var(--gold,#E8B84B);
    animation:muGira .85s linear infinite}
  @keyframes muGira{to{transform:rotate(360deg)}}
  #mu-overlay .mu-esperando b{font-family:var(--display,sans-serif);font-weight:800;
    font-size:17px;color:#eaecef}
  #mu-overlay .mu-esperando span{font-family:var(--sans,sans-serif);font-size:13px;
    color:#7d8794;max-width:36ch;line-height:1.6}
  #mu-overlay .mu-progreso{width:190px;height:4px;border-radius:20px;background:#1c2128;overflow:hidden}
  #mu-overlay .mu-progreso i{display:block;height:100%;width:0;border-radius:20px;
    background:var(--gold,#E8B84B);transition:width .4s ease}

  /* ── Panel de veredictos ── */
  #mu-overlay .mu-panel{width:352px;flex:0 0 auto;display:flex;flex-direction:column;
    background:#0b0e12;border-left:1px solid #1c2128}
  #mu-overlay .mu-panel-t{flex:0 0 auto;padding:13px 16px 2px;text-align:center;
    font-family:var(--mono,monospace);font-size:10px;color:#5c6672;
    text-transform:uppercase;letter-spacing:1.8px}
  #mu-overlay .mu-panel-t em{font-style:normal;color:var(--gold,#E8B84B);font-weight:700}
  /* Cockpit institucional */
  #mu-overlay .mu-cockpit{flex:0 0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;
    padding:10px 14px 4px}
  #mu-overlay .mu-ck{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));
    border:1px solid rgba(255,255,255,.06);border-radius:9px;padding:7px 8px;text-align:center;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
  #mu-overlay .mu-ck b{display:block;font-family:var(--mono,monospace);font-weight:800;font-size:13px;
    line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #mu-overlay .mu-ck span{font-family:var(--mono,monospace);font-size:7.5px;color:#5c6672;
    text-transform:uppercase;letter-spacing:.4px}
  #mu-overlay .mu-ck-ctx b span{margin:0 3px;font-weight:800}
  /* Banner de alerta */
  #mu-overlay .mu-alerta{position:absolute;left:50%;top:60px;transform:translate(-50%,-14px);
    z-index:60;padding:9px 15px 9px 14px;border-radius:11px;pointer-events:none;opacity:0;cursor:pointer;
    font-family:var(--display,sans-serif);font-weight:700;font-size:12.5px;color:#eef2f7;
    background:linear-gradient(180deg,rgba(22,28,36,.98),rgba(12,16,22,.98));
    border:1px solid var(--ac,#E8B84B);
    box-shadow:0 10px 30px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04), inset 0 0 18px color-mix(in srgb, var(--ac,#E8B84B) 14%, transparent);
    transition:opacity .3s ease,transform .3s ease}
  #mu-overlay .mu-alerta.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}
  #mu-overlay .mu-alerta::before{content:'\\25C9';color:var(--ac,#E8B84B);margin-right:8px;font-size:11px}
  #mu-overlay .mu-lista{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:10px}
  #mu-overlay .mu-grupo{font-family:var(--mono,monospace);font-size:9.5px;color:#5c6672;
    text-transform:uppercase;letter-spacing:1.2px;margin:12px 4px 8px}
  #mu-overlay .mu-grupo:first-child{margin-top:2px}
  #mu-overlay .mu-esperar{padding:22px 16px;text-align:center;font-family:var(--sans,sans-serif);
    font-size:12.5px;color:#7d8794;line-height:1.7}
  #mu-overlay .mu-esperar b{display:block;font-family:var(--display,sans-serif);
    font-size:14px;color:#b7bdc6;margin-bottom:5px}

  /* ══════════════════════════════════════════════════════════
     LAS TARJETAS — compactas y desplegables

     Lo esencial en dos líneas: cuánto, de qué lado, a qué precio y a
     qué distancia. El detalle se abre al tocar. Así caben 10 en
     pantalla en vez de 3.
     ══════════════════════════════════════════════════════════ */
  #mu-overlay .mu-card{display:flex;flex-direction:column;margin-bottom:7px;border-radius:12px;overflow:hidden;
    border:1px solid #232a33;border-left-width:3px;
    background:linear-gradient(145deg,rgba(255,255,255,.03),rgba(255,255,255,.01))}
  #mu-overlay .mu-cab-card{display:block;width:100%;box-sizing:border-box;text-align:left;
    padding:11px 13px;background:transparent;border:none;cursor:pointer}
  #mu-overlay .mu-l1{display:flex;align-items:baseline;gap:9px;margin-bottom:4px}
  #mu-overlay .mu-lado{font-family:var(--display,sans-serif);font-weight:800;font-size:15px;
    letter-spacing:.3px}
  #mu-overlay .mu-card[data-lado="venta"] .mu-lado{color:#ff6b7a}
  #mu-overlay .mu-card[data-lado="compra"] .mu-lado{color:#3ee88a}
  #mu-overlay .mu-imp{margin-left:auto;font-family:var(--display,sans-serif);font-weight:800;
    font-size:20px;color:var(--gold,#E8B84B);line-height:1}
  #mu-overlay .mu-l2{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  /* El precio y la distancia: la información clave, con su peso. */
  #mu-overlay .mu-nivel{font-family:var(--mono,monospace);font-weight:700;font-size:14px;color:#eaecef}
  #mu-overlay .mu-dist2{font-family:var(--mono,monospace);font-weight:700;font-size:12px;
    padding:2px 7px;border-radius:6px;background:rgba(255,255,255,.06);color:#b7bdc6}
  #mu-overlay .mu-sello{font-family:var(--mono,monospace);font-size:9.5px;font-weight:700;
    text-transform:uppercase;letter-spacing:.6px;padding:3px 8px;border-radius:20px}
  #mu-overlay .oro .mu-sello{background:rgba(232,184,75,.16);color:#E8B84B}
  #mu-overlay .verde .mu-sello{background:rgba(46,232,106,.14);color:#2ee86a}
  #mu-overlay .azul .mu-sello{background:rgba(77,159,255,.14);color:#4d9fff}
  #mu-overlay .rojo .mu-sello{background:rgba(246,70,93,.16);color:#f6465d}
  #mu-overlay .gris .mu-sello,#mu-overlay .ido .mu-sello{background:rgba(139,150,163,.12);color:#8b96a3}
  #mu-overlay .mu-fl{margin-left:auto;font-size:9px;color:#5c6672}

  /* La tarjeta de venta se tiñe de rojo; la de compra, de verde. */
  #mu-overlay .mu-card[data-lado="venta"]{border-left-color:#f6465d}
  #mu-overlay .mu-card[data-lado="compra"]{border-left-color:#2ee86a}
  /* FUERTE (f3): el lado manda el fondo, pero el borde y el glow son DORADOS
     — compra fuerte = verde con dorado, venta fuerte = rojo con dorado. */
  #mu-overlay .mu-card[data-lado="venta"].f3{
    background:linear-gradient(145deg,rgba(120,20,32,.5),rgba(60,10,18,.22));
    border-color:rgba(232,184,75,.55);border-left-color:#E8B84B;
    box-shadow:0 4px 18px rgba(0,0,0,.5), 0 0 0 1px rgba(232,184,75,.18), inset 0 0 22px rgba(232,184,75,.08)}
  #mu-overlay .mu-card[data-lado="compra"].f3{
    background:linear-gradient(145deg,rgba(12,90,50,.42),rgba(6,44,26,.2));
    border-color:rgba(232,184,75,.55);border-left-color:#E8B84B;
    box-shadow:0 4px 18px rgba(0,0,0,.5), 0 0 0 1px rgba(232,184,75,.18), inset 0 0 22px rgba(232,184,75,.08)}
  #mu-overlay .mu-card[data-lado="venta"].f2{background:linear-gradient(145deg,rgba(120,20,32,.22),rgba(255,255,255,.012))}
  #mu-overlay .mu-card[data-lado="compra"].f2{background:linear-gradient(145deg,rgba(12,90,50,.2),rgba(255,255,255,.012))}
  #mu-overlay .mu-card.f0{opacity:.66}
  #mu-overlay .mu-card.sel{border-color:var(--gold-soft,#C9A84B)}
  /* Chip "FUERTE" dorado dentro de la tarjeta */
  #mu-overlay .mu-fuerte{font-style:normal;font-family:var(--mono,monospace);font-size:9px;font-weight:800;
    letter-spacing:.5px;padding:2px 7px;border-radius:20px;color:#3a2800;
    background:linear-gradient(180deg,#ffe89a,#E8B84B);box-shadow:0 1px 4px rgba(232,184,75,.4)}

  /* El detalle desplegado */
  #mu-overlay .mu-detalle{display:block;width:100%;padding:0 13px 12px;animation:muAbre .16s ease}
  @keyframes muAbre{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
  /* El texto entra escribiéndose: da la sensación de que alguien
     está narrando lo que pasa en directo. */
  /* [CORREGIDO] clip-path recortaba el texto cuando ocupaba varias
     líneas y lo dejaba a medias. Un barrido de opacidad da la misma
     sensación de "se está escribiendo" sin cortar nada. */
  #mu-overlay .mu-escribe{animation:muEscribe .55s ease both}
  @keyframes muEscribe{
    from{opacity:0;transform:translateY(-3px);filter:blur(1.5px)}
    to{opacity:1;transform:none;filter:none}
  }
  #mu-overlay .mu-conse{font-family:var(--sans,sans-serif);font-size:12.5px;color:#c8cfd8;
    line-height:1.55;margin-bottom:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07)}
  #mu-overlay .mu-conse b{color:#fff;font-weight:700}
  #mu-overlay .mu-metricas{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:9px}
  #mu-overlay .mu-metricas div{text-align:center;padding:7px 3px;border-radius:8px;
    background:rgba(255,255,255,.035)}
  #mu-overlay .mu-metricas b{display:block;font-family:var(--mono,monospace);font-weight:700;
    font-size:12px;color:#eaecef}
  #mu-overlay .mu-metricas span{font-family:var(--mono,monospace);font-size:8px;color:#5c6672;
    text-transform:uppercase;letter-spacing:.4px}

  /* Barra de CONFIANZA — jerarquía visual del score combinado */
  #mu-overlay .mu-conf{display:flex;align-items:center;gap:8px;margin-top:8px}
  #mu-overlay .mu-conf-bar{height:5px;border-radius:20px;flex:1;min-width:0;
    background:linear-gradient(90deg,#f6465d,#E8B84B,#2ee86a);transition:width .4s ease;
    box-shadow:0 0 8px rgba(232,184,75,.25)}
  #mu-overlay .verde .mu-conf-bar{background:linear-gradient(90deg,#1a7a44,#2ee86a)}
  #mu-overlay .rojo .mu-conf-bar{background:linear-gradient(90deg,#7a1a28,#f6465d)}
  #mu-overlay .gris .mu-conf-bar{background:linear-gradient(90deg,#3a424c,#8b96a3)}
  #mu-overlay .mu-conf em{font-style:normal;font-family:var(--mono,monospace);font-weight:800;
    font-size:13px;color:var(--mu-tx);display:flex;align-items:baseline;gap:3px}
  #mu-overlay .mu-conf em span{font-size:8px;color:#5c6672;text-transform:uppercase;letter-spacing:.4px}
  /* Insignias de validación */
  #mu-overlay .mu-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
  #mu-overlay .mu-b{font-style:normal;font-family:var(--mono,monospace);font-size:9px;font-weight:700;
    padding:2px 7px;border-radius:20px;letter-spacing:.3px;
    background:rgba(255,255,255,.05);color:#aeb6c0;border:1px solid rgba(255,255,255,.08)}
  #mu-overlay .mu-b.conf{background:rgba(77,159,255,.14);color:#7fbaff;border-color:rgba(77,159,255,.3)}
  #mu-overlay .mu-b.libro{background:rgba(232,184,75,.14);color:#E8B84B;border-color:rgba(232,184,75,.3)}
  #mu-overlay .mu-b.flujo{background:rgba(46,232,106,.13);color:#3ee88a;border-color:rgba(46,232,106,.28)}
  #mu-overlay .mu-b.rota{background:rgba(139,150,163,.14);color:#b7bdc6;border-color:rgba(139,150,163,.3)}
  #mu-overlay .mu-b.ref{background:rgba(120,170,255,.14);color:#9cc4ff;border-color:rgba(120,170,255,.3)}
  /* Línea de tiempo del ciclo de vida de la zona */
  #mu-overlay .mu-timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:2px 0 10px}
  #mu-overlay .mu-timeline .tl{position:relative;display:flex;flex-direction:column;align-items:center;
    gap:2px;padding-top:12px;font-family:var(--mono,monospace);font-size:8px;color:#5c6672;
    text-transform:uppercase;letter-spacing:.3px;text-align:center}
  #mu-overlay .mu-timeline .tl i{position:absolute;top:3px;left:50%;transform:translateX(-50%);
    width:8px;height:8px;border-radius:50%;background:#2b3139;border:1px solid #3a424c}
  #mu-overlay .mu-timeline .tl::before{content:'';position:absolute;top:6px;left:-50%;width:100%;height:1px;background:#2b3139}
  #mu-overlay .mu-timeline .tl:first-child::before{display:none}
  #mu-overlay .mu-timeline .tl.on i{background:#2ee86a;border-color:#2ee86a;box-shadow:0 0 6px rgba(46,232,106,.5)}
  #mu-overlay .mu-timeline .tl.rota i{background:#E8B84B;border-color:#E8B84B;box-shadow:0 0 6px rgba(232,184,75,.5)}
  #mu-overlay .mu-timeline .tl b{font-weight:800;color:#c8cfd8;font-size:9px}
  /* Zona rota: se ve apagada y con una línea diagonal sutil */
  #mu-overlay .mu-card.es-rota{opacity:.72;border-left-color:#6b7681!important}
  #mu-overlay .mu-card.es-rota .mu-lado{color:#8b96a3!important}
  #mu-overlay .mu-card{transition:border-color .2s ease, box-shadow .2s ease, opacity .2s ease}

  /* Los cuatro botones de filtro */
  #mu-overlay .mu-fbtn{flex:1;min-width:calc(50% - 4px);min-height:46px;padding:0 12px;
    border-radius:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
    background:linear-gradient(180deg,#1c232e,#11161e);border:1px solid #2b3541;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.07), 0 3px 9px rgba(0,0,0,.45), 0 1px 0 rgba(0,0,0,.6);
    font-family:var(--display,sans-serif);font-weight:800;font-size:12.5px;color:#aeb6c0;letter-spacing:.2px;
    transition:transform .12s ease, box-shadow .12s ease, filter .12s ease}
  #mu-overlay .mu-fbtn:hover{transform:translateY(-1.5px);filter:brightness(1.13);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.1), 0 6px 16px rgba(0,0,0,.55)}
  #mu-overlay .mu-fbtn:active{transform:translateY(1px);box-shadow:inset 0 2px 6px rgba(0,0,0,.55)}
  #mu-overlay .mu-fbtn .mu-cuenta{font-family:var(--mono,monospace);font-size:10.5px;font-style:normal;font-weight:700;
    min-width:20px;padding:2px 6px;border-radius:20px;background:rgba(0,0,0,.38);color:#e4e9ef;
    box-shadow:inset 0 1px 2px rgba(0,0,0,.45)}
  #mu-overlay .mu-fbtn.verde{color:#4dffa0;border-color:rgba(46,232,106,.4)}
  #mu-overlay .mu-fbtn.rojo{color:#ff7885;border-color:rgba(246,70,93,.4)}
  #mu-overlay .mu-fbtn.oro{color:#f0c860;border-color:rgba(232,184,75,.42)}
  #mu-overlay .mu-fbtn.gris{color:#aeb6c0;border-color:#38424f}
  /* El filtro activo: relieve 3D encendido, se hunde un pelín como pulsado. */
  #mu-overlay .mu-fbtn.on{font-weight:800;transform:translateY(0)}
  #mu-overlay .mu-fbtn.verde.on{background:linear-gradient(180deg,#5cffab,#17c268);
    border-color:#2ee86a;color:#04210f;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.5), 0 4px 16px rgba(46,232,106,.4)}
  #mu-overlay .mu-fbtn.verde.on .mu-cuenta{background:rgba(0,0,0,.28);color:#04210f}
  #mu-overlay .mu-fbtn.rojo.on{background:linear-gradient(180deg,#ff8a95,#dd2f41);
    border-color:#f6465d;color:#2a0509;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.4), 0 4px 16px rgba(246,70,93,.4)}
  #mu-overlay .mu-fbtn.rojo.on .mu-cuenta{background:rgba(0,0,0,.28);color:#2a0509}
  #mu-overlay .mu-fbtn.oro.on{background:linear-gradient(180deg,#ffe89a,#e0ad3c);
    border-color:#E8B84B;color:#3a2800;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.5), 0 4px 16px rgba(232,184,75,.4)}
  #mu-overlay .mu-fbtn.oro.on .mu-cuenta{background:rgba(0,0,0,.24);color:#3a2800}
  #mu-overlay .mu-fbtn.gris.on{background:linear-gradient(180deg,#c6ccd4,#8b96a3);
    border-color:#c6ccd4;color:#0b0e12;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.5), 0 4px 14px rgba(0,0,0,.4)}
  #mu-overlay .mu-fbtn.gris.on .mu-cuenta{background:rgba(0,0,0,.22);color:#0b0e12}

  #mu-overlay .mu-card-viejo{display:block;width:100%;text-align:left;margin-bottom:9px;padding:13px 14px;
    border-radius:13px;cursor:pointer;background:rgba(255,255,255,.022);
    border:1px solid #232a33;border-left-width:3px;transition:background .15s,border-color .15s}
  #mu-overlay .mu-card:hover{background:rgba(255,255,255,.045)}
  #mu-overlay .mu-card.sel{background:rgba(255,255,255,.06)}
  #mu-overlay .mu-card.oro{border-left-color:#E8B84B}
  #mu-overlay .mu-card.verde{border-left-color:#2ee86a}
  #mu-overlay .mu-card.azul{border-left-color:#4d9fff}
  #mu-overlay .mu-card.rojo{border-left-color:#f6465d}
  #mu-overlay .mu-card.gris{border-left-color:#5c6672}
  #mu-overlay .mu-card.ido{border-left-color:#6b7681;opacity:.62}
  #mu-overlay .ido .mu-chip{background:rgba(139,150,163,.14);color:#8b96a3}
  #mu-overlay .ido .mu-hacer{border-left-color:rgba(139,150,163,.35)}
  /* La línea que explica QUÉ es cada muro: sin ella el usuario ve un
     precio y una cifra y no sabe qué está mirando. */
  #mu-overlay .mu-quees{font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;
    line-height:1.5;margin-bottom:9px}
  #mu-overlay .mu-quees b{color:#eaecef;font-weight:700}
  #mu-overlay .mu-quees em{display:block;font-style:normal;margin-top:3px;
    font-family:var(--mono,monospace);font-size:9.5px;color:#5c6672;
    text-transform:uppercase;letter-spacing:.7px}
  /* ══════════════════════════════════════════════════════════
     LA TARJETA — que se lea sola
     Lo primero y más grande: cuánto dinero y de qué lado. Todo lo
     demás es contexto.
     ══════════════════════════════════════════════════════════ */
  #mu-overlay .mu-titular{display:flex;align-items:baseline;gap:9px;margin-bottom:2px}
  #mu-overlay .mu-accion{font-family:var(--mono,monospace);font-size:10px;font-weight:700;
    letter-spacing:1.4px;padding:3px 8px;border-radius:6px}
  /* La etiqueta del lado tiene que gritar: es lo primero que se mira. */
  #mu-overlay .mu-card[data-lado="venta"] .mu-accion{background:rgba(246,70,93,.22);color:#ff8a95}
  #mu-overlay .mu-card[data-lado="compra"] .mu-accion{background:rgba(46,232,106,.2);color:#5affab}
  #mu-overlay .mu-monto{font-family:var(--display,sans-serif);font-weight:800;
    font-size:27px;color:#eaecef;line-height:1}
  #mu-overlay .mu-en{font-family:var(--sans,sans-serif);font-size:12px;color:#7d8794;margin-bottom:11px}
  #mu-overlay .mu-en b{color:#b7bdc6;font-family:var(--mono,monospace);font-size:13px}
  #mu-overlay .mu-veredicto{display:flex;align-items:center;justify-content:space-between;
    gap:8px;margin-bottom:10px}
  #mu-overlay .mu-fuerza{font-size:9px;letter-spacing:2px;color:currentColor}
  #mu-overlay .mu-fuerza i{opacity:.22;font-style:normal}
  #mu-overlay .oro .mu-fuerza{color:#E8B84B}
  #mu-overlay .verde .mu-fuerza{color:#2ee86a}
  #mu-overlay .azul .mu-fuerza{color:#4d9fff}
  #mu-overlay .mu-conse{font-family:var(--sans,sans-serif);font-size:13px;color:#c8cfd8;
    line-height:1.55;margin-bottom:11px}
  #mu-overlay .mu-conse b{color:#fff;font-weight:700}

  /* Cuanto más fuerte el muro, más presencia tiene la tarjeta. */
  #mu-overlay .mu-card.f3{background:linear-gradient(150deg,rgba(232,184,75,.10),rgba(255,255,255,.02) 60%);
    border-color:rgba(232,184,75,.32);box-shadow:0 4px 18px rgba(0,0,0,.4)}
  #mu-overlay .mu-card.f3.verde{background:linear-gradient(150deg,rgba(46,232,106,.10),rgba(255,255,255,.02) 60%);
    border-color:rgba(46,232,106,.3)}
  #mu-overlay .mu-card.f2{background:rgba(255,255,255,.035)}
  #mu-overlay .mu-card.f0{opacity:.72}

  #mu-overlay .mu-grupo.rojo{color:#ff7b88}
  #mu-overlay .mu-grupo.verde{color:#4dffa0}

  #mu-overlay .mu-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
  #mu-overlay .mu-chip{font-family:var(--mono,monospace);font-size:9.5px;font-weight:700;
    text-transform:uppercase;letter-spacing:.7px;padding:3px 8px;border-radius:20px}
  #mu-overlay .oro .mu-chip{background:rgba(232,184,75,.16);color:#E8B84B}
  #mu-overlay .verde .mu-chip{background:rgba(46,232,106,.14);color:#2ee86a}
  #mu-overlay .azul .mu-chip{background:rgba(77,159,255,.14);color:#4d9fff}
  #mu-overlay .rojo .mu-chip{background:rgba(246,70,93,.14);color:#f6465d}
  #mu-overlay .gris .mu-chip{background:rgba(139,150,163,.12);color:#8b96a3}
  #mu-overlay .mu-dist{font-family:var(--mono,monospace);font-size:10px;color:#5c6672;white-space:nowrap}
  #mu-overlay .mu-precio{font-family:var(--display,sans-serif);font-weight:800;
    font-size:21px;color:#eaecef;line-height:1.1;margin-bottom:7px}
  #mu-overlay .mu-datos{display:flex;flex-wrap:wrap;gap:4px 14px;margin-bottom:8px}
  #mu-overlay .mu-datos span{font-family:var(--mono,monospace);font-size:10px;color:#5c6672}
  #mu-overlay .mu-datos b{color:#b7bdc6;font-weight:700;margin-right:4px}
  #mu-overlay .mu-nota{font-family:var(--sans,sans-serif);font-size:12px;color:#8b96a3;
    line-height:1.55;margin-bottom:8px}
  #mu-overlay .mu-hacer{font-family:var(--sans,sans-serif);font-size:11.5px;color:#b7bdc6;
    line-height:1.5;padding:8px 11px;border-radius:9px;background:rgba(255,255,255,.03);
    border-left:2px solid currentColor}
  #mu-overlay .oro .mu-hacer{border-left-color:rgba(232,184,75,.55)}
  #mu-overlay .verde .mu-hacer{border-left-color:rgba(46,232,106,.5)}
  #mu-overlay .azul .mu-hacer{border-left-color:rgba(77,159,255,.5)}
  #mu-overlay .rojo .mu-hacer{border-left-color:rgba(246,70,93,.5)}
  #mu-overlay .gris .mu-hacer{border-left-color:rgba(139,150,163,.4)}

  /* ── Selector ── */
  #mu-picker{position:fixed;z-index:9790;min-width:236px;max-height:340px;overflow:hidden;
    display:flex;flex-direction:column;background:linear-gradient(180deg,#1b2027,#0d1117);
    border:1px solid var(--gold-soft,#C9A84B);border-radius:13px;padding:6px;
    box-shadow:0 16px 44px rgba(0,0,0,.72)}
  #mu-picker .mu-buscar{width:100%;box-sizing:border-box;padding:9px 11px;margin-bottom:6px;
    border-radius:9px;border:1px solid #2b3139;background:#0b0e12;color:#eaecef;
    font-family:var(--sans,sans-serif);font-size:13px;min-height:38px}
  #mu-picker .mu-buscar:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  #mu-picker .mu-lista-mon{overflow-y:auto;display:flex;flex-direction:column;gap:2px}
  #mu-picker .mu-op{display:flex;align-items:center;gap:9px;width:100%;padding:9px 11px;
    border-radius:9px;background:transparent;border:none;color:#b7bdc6;cursor:pointer;
    text-align:left;min-height:42px}
  #mu-picker .mu-op:hover{background:rgba(255,255,255,.05)}
  #mu-picker .mu-op.on{background:rgba(232,184,75,.1);color:var(--gold,#E8B84B)}
  #mu-picker .mu-op b{font-family:var(--mono,monospace);font-size:12px;font-weight:700;min-width:46px}
  #mu-picker .mu-op span{flex:1;font-family:var(--sans,sans-serif);font-size:12px;color:#7d8794;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #mu-picker .mu-op svg{width:14px;height:14px;flex:0 0 auto;color:var(--gold,#E8B84B)}

  /* ── Ayuda ── */
  /* Modal de validación de volumen */
  #mu-val-box{position:fixed;inset:0;z-index:9780;display:flex;align-items:center;justify-content:center;padding:16px}
  #mu-val-box .mu-bg{position:absolute;inset:0;background:rgba(3,5,8,.9)}
  #mu-val-box .mv-c{position:relative;width:100%;max-width:520px;background:linear-gradient(180deg,#12171f,#0b0e12);
    border:1px solid #232b35;border-radius:18px;padding:26px 22px 22px;box-shadow:0 24px 70px rgba(0,0,0,.65)}
  #mu-val-box .mv-x{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:10px;
    background:#1a212b;border:1px solid #2b3540;color:#aeb6c0;font-size:14px;cursor:pointer}
  #mu-val-box .mv-eyebrow{font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
  #mu-val-box .mv-t{font-family:var(--display,sans-serif);font-weight:800;font-size:20px;color:#f2f5f9;margin:0 0 10px}
  #mu-val-box .mv-d{font-family:var(--sans,sans-serif);font-size:13.5px;line-height:1.6;color:#c2c9d2;margin:0 0 14px}
  #mu-val-box .mv-d b{color:#fff} #mu-val-box code{font-family:var(--mono,monospace);font-size:12px;
    background:rgba(232,184,75,.12);color:#E8B84B;padding:1px 6px;border-radius:5px}
  #mu-val-box .mv-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
  #mu-val-box .mv-nums div{text-align:center;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);
    border-radius:10px;padding:10px 6px}
  #mu-val-box .mv-nums b{display:block;font-family:var(--mono,monospace);font-weight:800;font-size:15px;color:#eaecef}
  #mu-val-box .mv-nums span{font-family:var(--mono,monospace);font-size:8px;color:#5c6672;text-transform:uppercase;letter-spacing:.4px}
  /* Píldora Analista + su modal */
  #mu-overlay .mu-analista{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;height:36px;
    padding:0 12px 0 4px;border-radius:999px;cursor:pointer;
    background:linear-gradient(180deg,rgba(232,184,75,.18),rgba(232,184,75,.06));
    border:1px solid rgba(232,184,75,.45);color:var(--gold,#E8B84B);
    box-shadow:0 2px 6px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08);
    font-family:var(--display,sans-serif);font-weight:700;font-size:12px;white-space:nowrap;
    transition:transform .1s ease,filter .15s ease}
  #mu-overlay .mu-analista:hover{filter:brightness(1.12)}
  #mu-overlay .mu-pos-split{display:inline-flex;flex:0 0 auto;height:36px;border-radius:9px;overflow:hidden;
    border:1px solid rgba(232,184,75,.55);background:rgba(232,184,75,.06)}
  #mu-overlay .mu-pos-half{background:transparent;border:0;color:#d8b24a;font:700 12px system-ui,sans-serif;
    padding:0 12px;cursor:pointer;letter-spacing:.2px;transition:background .15s,color .15s}
  #mu-overlay .mu-pos-half+.mu-pos-half{border-left:1px solid rgba(232,184,75,.35)}
  #mu-overlay .mu-pos-half:hover{background:rgba(232,184,75,.14)}
  #mu-overlay .mu-pos-half.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800}
  #mu-overlay .mu-share{height:36px;border-radius:9px;border:1px solid rgba(46,232,106,.55);
    background:rgba(46,232,106,.08);color:#39e07a;font:700 12px system-ui,sans-serif;padding:0 14px;cursor:pointer;transition:filter .15s,opacity .15s}
  #mu-overlay .mu-share:hover{filter:brightness(1.15)}
  #mu-overlay .mu-share:disabled{opacity:.4;cursor:not-allowed;filter:none}
  #mu-overlay .mu-analista:active{transform:translateY(1px)}
  #mu-overlay .mu-analista img{width:28px;height:28px;border-radius:50%;object-fit:cover;flex:0 0 auto;
    border:1px solid rgba(232,184,75,.55)}
  #mu-overlay.mu-claro .mu-analista{color:#9a7a1e;border-color:rgba(232,184,75,.6)}
  @media(max-width:860px){
    #mu-overlay .mu-analista{padding:0;width:32px;height:32px;justify-content:center}
    #mu-overlay .mu-analista img{width:26px;height:26px}
    #mu-overlay .mu-an-txt{display:none}
    #mu-overlay .mu-der{gap:4px;padding-left:4px}
    #mu-overlay .mu-der .mu-ico{width:32px;height:32px;min-height:32px}
  }
  #mu-ana-box{position:fixed;inset:0;z-index:9785;display:flex;align-items:center;justify-content:center;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}
  #mu-ana-box .mu-bg{position:absolute;inset:0;background:rgba(3,5,8,.9)}
  #mu-ana-box .an-c{position:relative;width:100%;max-width:440px;height:min(560px,82vh);display:flex;flex-direction:column;
    background:linear-gradient(180deg,#12171f,#0b0e12);border:1px solid #232b35;border-radius:18px;overflow:hidden;
    box-shadow:0 24px 70px rgba(0,0,0,.65)}
  #mu-ana-box .an-top{display:flex;align-items:center;gap:11px;padding:13px 14px;border-bottom:1px solid #1c232c;
    background:linear-gradient(180deg,rgba(255,255,255,.04),transparent)}
  #mu-ana-box .an-ava{width:40px;height:40px;border-radius:50%;object-fit:cover;flex:0 0 auto;
    border:2px solid var(--an,#E8B84B);box-shadow:0 0 12px color-mix(in srgb,var(--an,#E8B84B) 40%,transparent)}
  #mu-ana-box .an-top-t{flex:1;min-width:0}
  #mu-ana-box .an-nombre{font-family:var(--display,sans-serif);font-weight:800;font-size:15px;color:#f2f5f9}
  #mu-ana-box .an-estado{font-family:var(--mono,monospace);font-size:10px;color:var(--an,#E8B84B);margin-top:1px}
  #mu-ana-box .mv-x{width:30px;height:30px;border-radius:8px;background:#1a212b;border:1px solid #2b3540;color:#aeb6c0;font-size:12px;cursor:pointer;flex:0 0 auto}
  #mu-ana-box .an-chat{flex:1;overflow-y:auto;padding:14px;padding-bottom:18px;display:flex;flex-direction:column;gap:9px;min-height:120px}
  #mu-ana-box .an-burb{align-self:flex-start;max-width:92%;background:#1a212b;border:1px solid #262f3a;
    border-radius:13px 13px 13px 4px;padding:9px 12px;font-family:var(--sans,sans-serif);font-size:13.5px;
    line-height:1.55;color:#d3d9e0}
  #mu-ana-box .an-burb b{color:#fff}
  #mu-overlay.mu-claro ~ #mu-ana-box .an-burb{background:#eef1f5;border-color:rgba(0,0,0,.1);color:#1a2028}

  /* 4 botones iguales del analista (rejilla 2x2, sin desbordar en móvil) */
  #mu-ana-box .an-acc{padding:12px 14px calc(14px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid rgba(255,255,255,.06);background:linear-gradient(180deg,transparent,rgba(0,0,0,.15))}
  #mu-ana-box .an-b{padding:11px 6px;border:1px solid #2b3540;border-radius:11px;cursor:pointer;
    font-family:var(--display,sans-serif);font-weight:800;font-size:12.5px;color:#e7ecf2;background:#1a212b;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:transform .1s ease,filter .15s ease}
  #mu-ana-box .an-b:active{transform:translateY(1px)}
  #mu-ana-box .an-b:disabled{opacity:.4;cursor:not-allowed}
  #mu-ana-box .an-b em{font-style:normal;display:inline-grid;place-items:center;min-width:16px;height:16px;padding:0 3px;margin-left:3px;border-radius:8px;background:rgba(0,0,0,.35);font-size:10.5px;vertical-align:middle}
  #mu-overlay #mu-pager{display:inline-flex;align-items:center;gap:5px;height:32px;margin-left:6px;padding:0 4px 0 9px;border-radius:9px;
    background:#12171f;border:1px solid rgba(232,184,75,.5);color:#f2d488;font-family:var(--mono,ui-monospace,monospace);font-weight:800;font-size:12px;flex:0 0 auto}
  #mu-overlay #mu-pager button{width:24px;height:24px;border-radius:7px;border:1px solid rgba(232,184,75,.4);background:rgba(232,184,75,.12);color:#f2d488;font-size:15px;cursor:pointer;display:grid;place-items:center;line-height:1}
  #mu-overlay #mu-pager button:active{transform:translateY(1px)}
  @media(max-width:860px){#mu-overlay #mu-pager span{display:none}}
  #mu-ana-box .an-b-l{background:linear-gradient(180deg,rgba(46,232,106,.22),rgba(46,232,106,.08));border-color:rgba(46,232,106,.5);color:#7cffb0}
  #mu-ana-box .an-b-s{background:linear-gradient(180deg,rgba(246,70,93,.22),rgba(246,70,93,.08));border-color:rgba(246,70,93,.5);color:#ff97a4}
  #mu-ana-box .an-b-t{background:linear-gradient(180deg,rgba(232,184,75,.2),rgba(232,184,75,.07));border-color:rgba(232,184,75,.5);color:#f2d488}

  /* Config flotante de la herramienta de posición / tendencia (hijo del radar) */
  #mu-poscfg,#mu-tendcfg{position:absolute;z-index:40;display:flex;align-items:center;gap:4px;padding:4px 5px;border-radius:10px;
    background:#12171f;border:1px solid #2b3540;box-shadow:0 8px 22px rgba(0,0,0,.6)}
  #mu-poscfg .pc-et,#mu-tendcfg .pc-et{font-family:var(--mono,monospace);font-weight:800;font-size:9.5px;color:#c8cfd8;padding:0 5px;white-space:nowrap}
  #mu-poscfg button,#mu-tendcfg button{width:26px;height:26px;border-radius:6px;border:1px solid #2b3540;background:#1a212b;
    color:#c8cfd8;font-size:12px;cursor:pointer;display:grid;place-items:center}
  #mu-poscfg button[data-a="del"],#mu-tendcfg button[data-a="del"]{color:#f6465d}
  #mu-poscfg button:active,#mu-tendcfg button:active{transform:translateY(1px)}

  #mu-val-box .mv-note{font-family:var(--sans,sans-serif);font-size:12px;line-height:1.55;color:#9aa3ad;margin:0 0 12px}
  #mu-val-box .mv-note b{color:#c2c9d2}
  #mu-val-box .mv-links{display:flex;flex-wrap:wrap;gap:8px}
  #mu-val-box .mv-copy{flex:1;text-align:center;cursor:pointer;
    font-family:var(--display,sans-serif);font-weight:700;font-size:12.5px;color:#0b0e12;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B));padding:11px 8px;border:none;border-radius:10px;
    box-shadow:0 3px 0 #8f6a1a}
  #mu-val-box .mv-copy:active{transform:translateY(2px);box-shadow:0 1px 0 #8f6a1a}

  #mu-ayuda-box{position:fixed;inset:0;z-index:10300;display:flex;align-items:center;justify-content:center;padding:16px}
  #mu-ayuda-box .mu-bg{position:absolute;inset:0;background:rgba(3,5,8,.93)}
  #mu-ayuda-box .mua-c{position:relative;width:100%;max-width:560px;max-height:88vh;
    overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);
    border:1px solid var(--gold-soft,#C9A84B);border-radius:20px;padding:24px 20px}
  #mu-ayuda-box .mua-x{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:10px;
    display:grid;place-items:center;padding:0;cursor:pointer;font-size:15px;z-index:5;
    background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6}
  #mu-ayuda-box .mua-eyebrow{font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:2px;text-align:center;margin-bottom:18px}
  #mu-ayuda-box .mua-card{padding:24px 20px;border-radius:16px;text-align:center;margin-bottom:18px;
    background:linear-gradient(165deg,rgba(232,184,75,.08),rgba(255,255,255,.015));
    border:1px solid rgba(232,184,75,.26)}
  #mu-ayuda-box .mua-n{font-family:var(--mono,monospace);font-size:11px;color:var(--gold,#E8B84B);
    font-weight:700;margin-bottom:10px}
  #mu-ayuda-box .mua-n em{font-style:normal;color:#5c6672;font-weight:400}
  #mu-ayuda-box .mua-t{font-family:var(--display,sans-serif);font-weight:800;font-size:21px;
    color:#eaecef;margin-bottom:12px;line-height:1.25}
  #mu-ayuda-box .mua-d{font-family:var(--sans,sans-serif);font-size:14px;color:#b7bdc6;
    line-height:1.65;margin-bottom:14px}
  #mu-ayuda-box .mua-d b{color:var(--gold,#E8B84B);font-weight:700}
  #mu-ayuda-box .mua-x2{padding:12px 14px;border-radius:11px;background:rgba(255,255,255,.035);
    border-left:2px solid var(--gold-soft,#C9A84B);font-family:var(--sans,sans-serif);
    font-size:12.5px;color:#8b96a3;line-height:1.55;text-align:left}
  #mu-ayuda-box .mua-puntos{display:flex;gap:5px;justify-content:center;margin-bottom:18px;flex-wrap:wrap}
  #mu-ayuda-box .mua-puntos i{width:7px;height:7px;border-radius:50%;background:#2b3139;cursor:pointer;
    transition:background .18s,transform .18s}
  #mu-ayuda-box .mua-puntos i.on{background:var(--gold,#E8B84B);transform:scale(1.35)}
  #mu-ayuda-box .mua-acts{display:flex;gap:9px}
  #mu-ayuda-box .mua-atras{flex:0 0 auto;min-height:48px;padding:0 20px;border-radius:12px;
    background:transparent;border:1px solid #2b3139;color:#8b96a3;cursor:pointer;
    font-family:var(--display,sans-serif);font-weight:700;font-size:13px}
  #mu-ayuda-box .mua-atras:hover{border-color:#3a424c;color:#b7bdc6}
  #mu-ayuda-box .mua-tabs{display:flex;gap:4px;padding:4px;margin:0 44px 18px 0;
    background:#0b0e12;border:1px solid #2b3139;border-radius:12px}
  #mu-ayuda-box .mua-tab{flex:1;min-height:40px;padding:0 10px;border-radius:9px;border:none;
    background:transparent;color:#7d8794;font-family:var(--display,sans-serif);
    font-weight:700;font-size:12.5px;cursor:pointer;line-height:1.25}
  #mu-ayuda-box .mua-tab.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800}
  #mu-ayuda-box .mua-pane{display:none}
  #mu-ayuda-box .mua-pane.on{display:block}
  #mu-ayuda-box .mua-intro{padding:15px 17px;border-radius:13px;margin-bottom:18px;
    background:linear-gradient(180deg,rgba(232,184,75,.09),rgba(232,184,75,.02));
    border:1px solid rgba(232,184,75,.3);font-family:var(--sans,sans-serif);
    font-size:13.5px;color:#b7bdc6;line-height:1.65}
  #mu-ayuda-box .mua-intro b{color:var(--gold,#E8B84B)}
  #mu-ayuda-box .mua-p{margin-bottom:15px;font-family:var(--sans,sans-serif);
    font-size:13px;color:#8b96a3;line-height:1.65}
  #mu-ayuda-box .mua-p > b:first-child{display:block;font-family:var(--display,sans-serif);
    font-size:14px;color:#eaecef;margin-bottom:5px}
  #mu-ayuda-box .mua-p b{color:#eaecef}
  #mu-ayuda-box .mua-p i{display:block;margin-top:8px;padding:9px 12px;border-radius:9px;
    font-style:normal;background:rgba(255,255,255,.03);
    border-left:2px solid var(--gold-soft,#C9A84B);font-size:12.5px;color:#8b96a3;line-height:1.55}
  #mu-ayuda-box .mua-col{display:flex;align-items:center;gap:10px;margin-top:9px;font-size:12.5px}
  #mu-ayuda-box .mua-col i{width:22px;height:22px;border-radius:6px;flex:0 0 auto;
    display:grid;place-items:center;font-style:normal;font-weight:800;font-size:11px;
    font-family:system-ui,sans-serif}
  #mu-ayuda-box .mua-aviso{padding:12px 14px;border-radius:11px;background:rgba(232,184,75,.07);
    border-left:2px solid var(--gold-soft,#C9A84B);font-family:var(--sans,sans-serif);
    font-size:12px;color:#b7bdc6;line-height:1.6;margin-bottom:18px}
  #mu-ayuda-box .mua-aviso b{color:var(--gold,#E8B84B)}
  #mu-ayuda-box .mua-b{flex:1;min-height:48px;border-radius:12px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:14px;cursor:pointer;
    box-shadow:0 4px 0 #8f6a1a}

  /* ══ TEMA CLARO ══ (solo el chrome; los colores semánticos se mantienen) */
  #mu-overlay.mu-claro{--mu-tx:#1a2028}
  #mu-overlay.mu-claro .mu-c{background:#eef1f5}
  #mu-overlay.mu-claro .mu-bg{background:rgba(230,234,240,.6)}
  #mu-overlay.mu-claro .mu-barra{background:#e4e8ee;border-bottom-color:rgba(0,0,0,.08)}
  #mu-overlay.mu-claro .mu-panel{background:#e9edf2;border-left-color:rgba(0,0,0,.08)}
  #mu-overlay.mu-claro .mu-mtabs{background:#e4e8ee}
  #mu-overlay.mu-claro .mu-vivo span,
  #mu-overlay.mu-claro .mu-px b,
  #mu-overlay.mu-claro .mu-precio,
  #mu-overlay.mu-claro .mu-nivel,
  #mu-overlay.mu-claro .mu-conse,
  #mu-overlay.mu-claro .mu-conse b,
  #mu-overlay.mu-claro .mu-ck b{color:#1a2028}
  #mu-overlay.mu-claro .mu-px span,
  #mu-overlay.mu-claro .mu-ck span,
  #mu-overlay.mu-claro .mu-metricas span,
  #mu-overlay.mu-claro .mu-timeline .tl{color:#6b7480}
  #mu-overlay.mu-claro .mu-der{background:transparent}
  #mu-overlay.mu-claro .mu-ico{background:linear-gradient(180deg,#ffffff,#e7ebf1);border-color:rgba(0,0,0,.14);color:#3a424c;
    box-shadow:0 2px 5px rgba(60,72,90,.22), inset 0 1px 0 rgba(255,255,255,.9)}
  #mu-overlay.mu-claro .mu-ico:hover{border-color:var(--gold,#E8B84B);color:#9a7a1e}
  #mu-overlay.mu-claro .mu-sel,#mu-overlay.mu-claro .mu-tfchip{background:#dfe4ec;border-color:rgba(0,0,0,.12);color:#1a2028}
  #mu-overlay.mu-claro .mu-ck{background:linear-gradient(180deg,#fff,#eef1f5);border-color:rgba(0,0,0,.08)}
  #mu-overlay.mu-claro .mu-card{background:linear-gradient(145deg,#fff,#f2f5f9);border-color:rgba(0,0,0,.1)}
  #mu-overlay.mu-claro .mu-card .mu-nivel{color:#1a2028}
  #mu-overlay.mu-claro .mu-card[data-lado="compra"].f3{background:linear-gradient(145deg,#e9f9f0,#f2f5f9)}
  #mu-overlay.mu-claro .mu-card[data-lado="venta"].f3{background:linear-gradient(145deg,#fdeef0,#f2f5f9)}
  #mu-overlay.mu-claro .mu-metricas div{background:rgba(0,0,0,.04)}
  #mu-overlay.mu-claro .mu-metricas b{color:#1a2028}
  #mu-overlay.mu-claro .mu-fbtn{background:linear-gradient(180deg,#fff,#e6eaf0);border-color:rgba(0,0,0,.12);
    color:#5c6672;box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 2px 6px rgba(0,0,0,.12)}
  #mu-overlay.mu-claro .mu-fbtn .mu-cuenta{background:rgba(0,0,0,.1);color:#3a424c}
  #mu-overlay.mu-claro .mu-dist2{background:rgba(0,0,0,.06);color:#3a424c}
  #mu-overlay.mu-claro .mu-hacer{background:rgba(0,0,0,.04);color:#3a424c}
  #mu-overlay.mu-claro .mu-timeline .tl b{color:#3a424c}
  #mu-overlay.mu-claro .mu-esperar{color:#5c6672}
  #mu-overlay.mu-claro .mu-esperar b{color:#3a424c}

  /* ── Móvil: temporalidad en chip + pestañas Gráfica/Órdenes ── */
  @media(max-width:860px){
    #mu-overlay .mu-cuerpo{flex-direction:column}
    #mu-overlay .mu-tfs{display:none}          /* la fila se reemplaza por el chip */
    #mu-overlay .mu-tfchip{display:inline-flex}
    #mu-overlay .mu-mtabs{display:none}   /* fuera: Heat Pools va directo al gráfico */
    /* La barra ya NO desborda. El "Precio ahora" se oculta (ya está grande en
       la gráfica). */
    /* La barra ya NO desborda ni se amontona. En móvil, la fila de acciones
       (analista, news, iconos, cerrar) fluye en su PROPIA línea, alineada a la
       derecha y con salto si hiciera falta, en vez de superponerse. */
    #mu-overlay .mu-barra{flex-wrap:wrap;gap:8px;padding:8px 52px 8px 10px;align-items:center}
    /* La X SIEMPRE arriba a la derecha, fuera del flujo (antes caía abajo). */
    #mu-overlay .mu-x{position:absolute;top:8px;right:8px;z-index:3;margin:0}
    #mu-overlay .mu-der{position:static;transform:none;order:5;width:100%;justify-content:flex-start;
      flex-wrap:wrap;gap:6px;padding-left:0;margin-top:2px}
    #mu-overlay .mu-sel{order:1}
    #mu-overlay .mu-tfchip{order:2}
    #mu-overlay #mu-estado{order:3;flex:0 0 auto}
    #mu-overlay .mu-px{display:none}
    #mu-overlay .mu-vivo{flex:0 0 auto}
    #mu-overlay .mu-vivo span{display:none}
    /* Una vista a la vez, a pantalla completa: así las tarjetas de órdenes
       tienen TODO el alto para verse cómodas. */
    #mu-overlay .mu-cuerpo.m-graf .mu-graf{display:block;flex:1 1 auto;height:auto;min-height:0}
    #mu-overlay .mu-cuerpo.m-graf .mu-panel{display:none}
    #mu-overlay .mu-cuerpo.m-ord .mu-graf{display:none}
    #mu-overlay .mu-cuerpo.m-ord .mu-panel{display:flex;flex:1 1 auto;width:100%;border-left:none;min-height:0}
    #mu-overlay .mu-panel{width:100%;border-left:none;border-top:none}
    #mu-overlay .mu-chips{padding:11px 12px}
    #mu-overlay .mu-cockpit{padding:9px 12px 3px;gap:5px}
    #mu-overlay .mu-ck{padding:6px 4px}
    #mu-overlay .mu-ck b{font-size:12px}
    #mu-overlay .mu-ck span{font-size:7px}
    /* La lista SÍ hace scroll (min-height:0 en toda la cadena) y deja hueco
       abajo para que el nav de la app no tape la última tarjeta. */
    #mu-overlay .mu-cuerpo.m-ord .mu-lista{min-height:0;-webkit-overflow-scrolling:touch;
      padding:10px 12px calc(84px + env(safe-area-inset-bottom, 0px))}
    #mu-overlay .mu-marca{height:24px;left:10px;bottom:26px}
    #mu-overlay .mu-precio{font-size:19px}
    #mu-ayuda-box .mua-c{padding:20px 14px}
    #mu-ayuda-box .mua-tabs{margin-right:46px;flex-direction:column}
  }`;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════════════
   ANALISTA — chatbot que lee la estructura y dice qué hacer

   Interpreta lo que el sistema YA muestra (zonas reales ancladas, VWAP,
   sesgo, dónde está el precio) y lo explica como si lo escribiera un analista.
   Devuelve además un PLAN operativo (entrada/SL/TP con R:R 1:1) para la
   herramienta «Muéstrame». Si no hay entrada limpia, lo dice con honestidad.
   ══════════════════════════════════════════════════════════════ */
function analizarRadar() {
  const par = PARES.find((p) => p.id === _par) || PARES[0];
  const base = par.s.replace(/USDT$|USDC$|FDUSD$|BUSD$/, '');
  const px = M.precio || (M.velas.length ? M.velas[M.velas.length - 1].c : 0);
  const mk = M.mercado;
  const zonas = (M.zonas || []).filter((z) => !z.rota);
  const vwapTxt = mk && mk.vwap ? (px >= mk.vwap ? 'The price is **above the VWAP**, which favors buyers.' : 'El precio está **por debajo del VWAP**, lo que favorece a los vendedores.') : '';

  // Variación estable por moneda (misma moneda → misma redacción; monedas distintas → distinta).
  const _h = base.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const V = (arr) => arr[_h % arr.length];
  const intro = V([`Miremos **${base}** en **${M.tf}**.`, `Let us go with **${base} · ${M.tf}**.`,
    `Esto es lo que leo en **${base} · ${M.tf}**.`, `Repasemos **${base}** en **${M.tf}**.`]);
  // Contexto REAL del mercado de esta moneda (cambia según datos, no es genérico).
  const cprB = mk && mk.compradorPct != null ? Math.round(mk.compradorPct) : null;
  const posVA = (mk && mk.vah && mk.val)
    ? (px > mk.vah ? 'cotiza **por encima del valor** (extendido al alza)'
      : px < mk.val ? 'cotiza **por debajo del valor** (extendido a la baja)'
      : 'cotiza **dentro del área de valor**')
    : '';
  const ctxMercado = mk ? `En **${base}** el sesgo es **${mk.sesgo || 'neutral'}**`
    + (cprB != null ? ` with **${cprB}%** ${cprB >= 50 ? 'buying' : 'selling'} pressure` : '')
    + (mk.winRate != null ? ` and a historical hit rate of **${Math.round(mk.winRate)}%**` : '')
    + (posVA ? `; ${posVA}` : '') + '.' : '';

  if (!px || !zonas.length) {
    return { titulo: 'No clear read', tono: 'espera', base,
      parrafos: [`Right now I see no reliable nearby accumulation zones on **${base} · ${M.tf}**.`, `Without a reference volume level, the prudent thing is to **wait**. There is no edge entry here.`],
      op: null };
  }

  const dentro = zonas.find((z) => z.dentro);
  const dem = zonas.filter((z) => z.lado === 'demanda').sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))[0];
  const ofe = zonas.filter((z) => z.lado === 'oferta').sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))[0];

  /* Construye un plan R:R 1:1 acotando el riesgo: el stop se apoya en el borde
     de la zona, pero se limita a un máximo sensato (no un stop gigantesco si el
     rango es enorme). */
  const planLong = (z) => {
    const entrada = z.pPoc;
    const rango = z.pHigh - z.pLow;
    const riesgoMax = px * 0.02;                       // tope de riesgo: 2% del precio
    const riesgo = Math.min(Math.max(entrada - z.pLow, px * 0.003) + px * 0.001, riesgoMax);
    const sl = entrada - riesgo;
    const tp = entrada + riesgo;                        // R:R 1:1
    return { tipo: 'long', zona: z, entrada, sl, tp, ancho: rango / z.p };
  };
  const planShort = (z) => {
    const entrada = z.pPoc;
    const rango = z.pHigh - z.pLow;
    const riesgoMax = px * 0.02;
    const riesgo = Math.min(Math.max(z.pHigh - entrada, px * 0.003) + px * 0.001, riesgoMax);
    const sl = entrada + riesgo;
    const tp = entrada - riesgo;
    return { tipo: 'short', zona: z, entrada, sl, tp, ancho: rango / z.p };
  };
  const avisoAncho = (op) => op.ancho > 0.02
    ? 'Ojo: el rango de esta zona es amplio, así que el stop queda ancho. Arriesga poco capital y no entres todo de golpe.'
    : 'Sé prudente con el tamaño de la posición: arriesga solo una parte pequeña de tu capital.';
  const notaSpot = 'Si operas en **spot**, no necesitas stop loss (compras y mantienes). Si usas **apalancamiento**, respeta estos niveles al pie de la letra.';

  let titulo, tono, parrafos, op;

  if (dentro && dentro.lado === 'demanda' && dentro.fuerza >= 3) {
    op = planLong(dentro); titulo = 'Zona de alta demanda'; tono = 'compra';
    parrafos = [
      `${intro} ${ctxMercado} The price is **inside a strong demand zone** at **${fmt(dentro.pPoc)}** (rango ${fmt(dentro.pLow)}–${fmt(dentro.pHigh)}), con **${dinero(dentro.v)}** acumulados.`,
      `It is a level with a lot of buying volume. Scenario of a possible **buy (long)** supported by this demand.` + (vwapTxt ? ' ' + vwapTxt : ''),
      `Plan: entry near **${fmt(op.entrada)}**, stop at **${fmt(op.sl)}** and target at **${fmt(op.tp)}** (risk/rewario 1:1).`,
      avisoAncho(op), notaSpot
    ];
  } else if (dentro && dentro.lado === 'oferta' && dentro.fuerza >= 3) {
    op = planShort(dentro); titulo = 'Zona de alta oferta'; tono = 'venta';
    parrafos = [
      `${intro} ${ctxMercado} The price is **inside a strong supply zone** at **${fmt(dentro.pPoc)}** (rango ${fmt(dentro.pLow)}–${fmt(dentro.pHigh)}), con **${dinero(dentro.v)}** acumulados.`,
      `There is a lot of selling volume here. If you are long, **careful**: it is a zone of possible **profit taking or sell (short)**.` + (vwapTxt ? ' ' + vwapTxt : ''),
      `Plan: short entry near **${fmt(op.entrada)}**, stop at **${fmt(op.sl)}** and target at **${fmt(op.tp)}** (1:1).`,
      avisoAncho(op), notaSpot
    ];
  } else if ((dem && dem.fuerza >= 3) || (ofe && ofe.fuerza >= 3)) {
    const cDem = dem && dem.fuerza >= 3 ? dem : null;
    const cOfe = ofe && ofe.fuerza >= 3 ? ofe : null;
    // primaria = la de MAYOR relevancia (confianza), no solo la más cercana
    let prim, sec;
    if (cDem && cOfe) { if (cDem.confianza >= cOfe.confianza) { prim = cDem; sec = cOfe; } else { prim = cOfe; sec = cDem; } }
    else { prim = cDem || cOfe; sec = null; }
    const primLong = prim.lado === 'demanda';
    op = primLong ? planLong(prim) : planShort(prim);
    tono = primLong ? 'compra' : 'venta';
    titulo = primLong ? 'Demanda debajo del precio' : 'Oferta encima del precio';
    const ladoTxt = primLong ? 'demanda' : 'oferta';
    const posTxt = primLong ? 'debajo' : 'encima';
    parrafos = [
      `${intro} ${ctxMercado} La zona más relevante ahora es una **${ladoTxt}** en **${fmt(prim.pPoc)}** (rango ${fmt(prim.pLow)}–${fmt(prim.pHigh)}) con **${dinero(prim.v)}**, a un **${(Math.abs(prim.dist) * 100).toFixed(2)}%** por ${posTxt}.`,
      (primLong
        ? `The price pushed above it, so it acts as support. If it **retests it** and holds, it is a possible **entrada en largo**.`
        : `It acts as resistance. If the price rises and stalls there, it is a possible **short entry**.`) + (vwapTxt ? ' ' + vwapTxt : ''),
      `Plan: entry near **${fmt(op.entrada)}**, stop at **${fmt(op.sl)}** and target at **${fmt(op.tp)}** (risk/rewario 1:1).`
    ];
    if (sec) {
      const secLong = sec.lado === 'demanda';
      parrafos.push(`También hay una **${secLong ? 'demanda' : 'oferta'}** relevante en **${fmt(sec.pPoc)}** (${dinero(sec.v)}), ${secLong ? 'por debajo' : 'por encima'}. Segunda opción: ${secLong ? 'largo si el precio cae y la respeta' : 'corto si el precio sube y la respeta'}. No operes las dos a la vez sin plan.`);
    }
    parrafos.push(avisoAncho(op), notaSpot);
  } else {
    titulo = 'Sin entrada limpia'; tono = 'espera'; op = null;
    parrafos = [
      `${intro} ${ctxMercado} El precio está **en medio del rango**, sin una zona fuerte lo bastante cerca para dar una entrada con ventaja.`,
      `Lo profesional aquí es **esperar**. Deja que el precio busque una de las zonas marcadas (demanda debajo u oferta encima) y opera la reacción en ese nivel.`,
      `Forzar una entrada en el medio es donde se pierde dinero.`
    ];
  }
  return { titulo, tono, base, parrafos, op };
}

function abrirAnalista() {
  const clave = _par + '|' + M.tf;
  let a, alInstante = false;
  if (_anaCache && _anaCache.clave === clave) { a = _anaCache.a; alInstante = true; }   // ya lo dijo: sale cargado
  else { a = analizarRadar(); if (a && (a.op || (M.zonas && M.zonas.filter((z) => !z.rota).length))) _anaCache = { clave, a }; }
  _analisis = a;
  document.getElementById('mu-ana-box')?.remove();
  const col = a.tono === 'compra' ? '#2ee86a' : a.tono === 'venta' ? '#f6465d' : '#E8B84B';
  const saludo = 'Le he echado un ojo a la gráfica. Esto es lo que veo ahora mismo:';
  const guion = [saludo].concat(a.parrafos);
  const d = document.createElement('div');
  d.id = 'mu-ana-box';
  d.innerHTML = `<div class="mu-bg"></div>
    <div class="an-c" style="--an:${col}">
      <div class="an-top">
        <img class="an-ava" src="assets/img/jesus-avatar.webp" alt="">
        <div class="an-top-t">
          <div class="an-nombre">Analyst</div>
          <div class="an-estado" id="an-estado">en línea</div>
        </div>
        <button class="mv-x" aria-label="Cerrar">\u2715</button>
      </div>
      <div class="an-chat" id="an-chat"></div>
      <div class="an-acc" id="an-acc"></div>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => { clearTimeout(_anaT); d.remove(); };
  d.querySelector('.mu-bg').onclick = cerrar;
  d.querySelector('.mv-x').onclick = cerrar;

  const chat = d.querySelector('#an-chat');
  const estado = d.querySelector('#an-estado');
  const acc = d.querySelector('#an-acc');
  const parseB = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const burbuja = (txt) => { const b = document.createElement('div'); b.className = 'an-burb'; b.innerHTML = parseB(txt); chat.appendChild(b); chat.scrollTop = chat.scrollHeight; };
  const acciones = () => {
    estado.textContent = 'en línea';
    const nL = contarOps('long'), nS = contarOps('short');
    acc.innerHTML =
      `<button class="an-b an-b-l" id="an-long" ${nL ? '' : 'disabled'}>\u25b2 Largo${nL > 1 ? ' <em>' + nL + '</em>' : ''}</button>` +
      `<button class="an-b an-b-s" id="an-short" ${nS ? '' : 'disabled'}>\u25bc Corto${nS > 1 ? ' <em>' + nS + '</em>' : ''}</button>` +
      `<button class="an-b an-b-t" id="an-tend">\u2197 Tendencia</button>` +
      `<button class="an-b an-b-x" id="an-exportar">\u2913 Exportar</button>`;
    if (nL) acc.querySelector('#an-long').onclick = () => { cerrar(); mostrarPlan(a, 'long'); };
    if (nS) acc.querySelector('#an-short').onclick = () => { cerrar(); mostrarPlan(a, 'short'); };
    acc.querySelector('#an-tend').onclick = () => { cerrar(); mostrarTendencia(); };
    acc.querySelector('#an-exportar').onclick = () => exportarAnalisis(a);
  };

  // Siempre INSTANTÁNEO: al tocar el analista, el análisis ya está escrito
  // (actualizado a la moneda/temporalidad/estructura actual). Sin máquina de escribir.
  estado.textContent = 'en línea';
  guion.forEach(burbuja);
  acciones();
  return;
}
let _anaT = null, _analisis = null, _planFuera = null, _anaCache = null;

/* «Muéstrame»: dibuja una línea discontinua curva DESDE el ícono del analista
   hasta el nivel de entrada, y proyecta una herramienta de posición (long/short)
   con R:R 1:1 (entrada, stop y objetivo), POR ENCIMA de toda la interfaz. Se
   cierra con un clic fuera. */
function _hex2rgb(hex) { const n = parseInt((hex || '#22d3ee').slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }
/* tiempo/precio <-> pantalla (mismo mapeo que Smart Levels: anclado a TIMESTAMP,
   por eso las herramientas se PEGAN al gráfico al moverlo o hacer zoom). */
function mXt(t) { const g = M._geo; if (!g) return 0; const i = (t - g.t0) / g.tfMs; return (i - g.pri) * g.paso + g.paso / 2; }
function mTx(x) { const g = M._geo; if (!g) return 0; const iF = (x - g.paso / 2) / g.paso + g.pri; return g.t0 + iF * g.tfMs; }
function mYp(p) { const g = M._geo; if (!g) return 0; return g.y1 - g.y1 * ((p - g.pMin) / Math.max(1e-9, g.pMax - g.pMin)); }
function mPy(y) { const g = M._geo; if (!g) return 0; return g.pMin + (g.pMax - g.pMin) * ((g.y1 - y) / g.y1); }
/* Guía SVG (hija del radar): sale de la píldora Analyst y llega a la herramienta.
   Un SVG puede dibujarse por encima de la cabecera y el lienzo, cosa que el
   lienzo no puede (queda recortado). Se quita al primer toque / al cerrar. */
function pintarGuiaSVG() {
  const ov = document.getElementById('mu-overlay');
  let svg = document.getElementById('mu-guia');
  const dst = M._guiaDst;
  if (!ov || !dst) { if (svg) svg.remove(); return; }
  const pill = document.getElementById('mu-analista'), cv = document.getElementById('mu-cv');
  if (!pill || !cv) { if (svg) svg.remove(); return; }
  const ovr = ov.getBoundingClientRect(), pr = pill.getBoundingClientRect(), cr = cv.getBoundingClientRect();
  const x0 = pr.left + pr.width / 2 - ovr.left, y0 = pr.bottom - ovr.top;
  const x1 = cr.left - ovr.left + dst.x, y1 = cr.top - ovr.top + dst.y;
  const mx = (x0 + x1) / 2, my = y0 + (y1 - y0) * 0.28;
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mu-guia';
    svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:26');
    svg.innerHTML = '<path fill="none" stroke-dasharray="6 5" stroke-width="1.8"/><circle r="3.5"/>';
    ov.appendChild(svg);
  }
  const path = svg.querySelector('path'), dot = svg.querySelector('circle');
  path.setAttribute('d', `M ${x0} ${y0} Q ${mx} ${my} ${x1} ${y1}`);
  path.setAttribute('stroke', dst.col);
  dot.setAttribute('cx', x0); dot.setAttribute('cy', y0); dot.setAttribute('fill', dst.col);
}
function quitarGuiaSVG() { document.getElementById('mu-guia')?.remove(); }

/* Lista TODAS las operaciones de alta probabilidad de un lado, ordenadas de
   mejor a peor (confianza, y a igualdad, cercanía). Sirve para el contador y el
   paginador del analista. */
/* Las operaciones salen de las ZONAS SWING, respetando la estructura:
   · LARGO  → solo en zonas de DEMANDA (soporte, por debajo del precio).
   · CORTO  → solo en zonas de OFERTA  (resistencia, por encima del precio).
   Entrada en el borde de la zona que da la cara al precio, stop al otro lado de
   la zona (su altura) y objetivo 1:1. Nunca se ofrece un largo en resistencia ni
   un corto en soporte. */
function zonasOp(tipo) {
  const zs = M.estructuras || [];
  if (tipo === 'long') return zs.filter((z) => z.dir === 'demanda');
  return zs.filter((z) => z.dir === 'oferta');
}
function opDeZona(tipo, z) {
  if (!z) return null;
  const alt = Math.max(1e-9, z.hi - z.lo);
  const centro = (z.hi + z.lo) / 2;
  if (tipo === 'long') {
    // Demanda: se compra en el TECHO de la zona (primer toque), stop bajo el piso.
    const entrada = z.hi;
    return { tipo, entrada, sl: z.lo, tp: entrada + alt, zonaPoc: centro, caja: z };
  }
  // Oferta: se vende en el PISO de la zona (primer toque), stop sobre el techo.
  const entrada = z.lo;
  return { tipo, entrada, sl: z.hi, tp: entrada - alt, zonaPoc: centro, caja: z };
}
function construirOp(tipo) { const zs = zonasOp(tipo); return zs.length ? opDeZona(tipo, zs[0]) : null; }
function hayOp(tipo) { return zonasOp(tipo).length > 0; }
function contarOps(tipo) { return zonasOp(tipo).length; }

/* Proyecta la MISMA herramienta de posición de Smart Levels (poslarga/poscorta).
   Con un lado forzado (botón Largo/Corto) arma la LISTA de operaciones y muestra
   la primera; el paginador junto a Analyst permite recorrerlas una a una. */
function mostrarPlan(a, tipoForzado) {
  if (tipoForzado) {
    const zs = zonasOp(tipoForzado); if (!zs.length) return;
    M._posList = { tipo: tipoForzado, zonas: zs, idx: 0 };
    proyectarDeLista();
  } else {
    const op = a && a.op; if (!op) return;
    M._posList = null; quitarPager(); ponerPos(op);
  }
  const tabChart = [...document.querySelectorAll('.mu-mtab')].find((x) => /hart|r\u00e1fic|gr\u00e1fic/i.test(x.textContent));
  if (tabChart && !tabChart.classList.contains('on')) tabChart.click();
}
function proyectarDeLista() {
  const L = M._posList; if (!L || !L.zonas.length) return;
  L.idx = ((L.idx % L.zonas.length) + L.zonas.length) % L.zonas.length;
  const op = opDeZona(L.tipo, L.zonas[L.idx]); if (!op) return;
  ponerPos(op); pintarPager();
}
function ponerPos(op) {
  const g = M._geo; if (!g || !g.vis.length) return;
  const vis = g.vis;
  // Anclar la herramienta al RANGO (la caja): así la entrada cae en su borde.
  let t0 = vis[Math.max(0, vis.length - 20)].t;
  if (op.caja && op.caja.t0) t0 = op.caja.t0;
  const t1 = vis[vis.length - 1].t + 8 * g.tfMs;
  M._pos = { tipo: op.tipo === 'long' ? 'poslarga' : 'poscorta',
    pe: op.entrada, pTarget: op.tp, pStop: op.sl, t0, t1, zonaPoc: op.zonaPoc != null ? op.zonaPoc : op.entrada,
    cTarget: '#2ee86a', cEntry: '#eaecef', cStop: '#ff3b52', grosor: 2, intensidad: 1,
    cardPos: 'der', oculto: false, guia: true };
  cerrarPosCfg(); dibujar();
}

/* Paginador «1/N ›» junto a la píldora Analyst para recorrer las operaciones. */
function pintarPager() {
  const L = M._posList; const cab = document.querySelector('#mu-overlay .mu-der'); if (!cab) return;
  quitarPager();
  if (!L || L.zonas.length < 2) return;
  const p = document.createElement('div'); p.id = 'mu-pager';
  p.innerHTML = `<span>${L.idx + 1}/${L.zonas.length}</span><button title="Siguiente">\u203a</button>`;
  const pill = document.getElementById('mu-analista') || document.getElementById('mu-pos-split');
  if (!pill) return;
  pill.insertAdjacentElement('afterend', p);
  p.querySelector('button').onclick = () => { L.idx++; proyectarDeLista(); };
}
function quitarPager() { document.getElementById('mu-pager')?.remove(); }

/* Exporta TODO el análisis del analista como imagen (foto + título en inglés). */
function exportarAnalisis(a) {
  a = a || (_anaCache && _anaCache.a) || analizarRadar();
  if (!a) return;
  const par = PARES.find((p) => p.id === _par) || { id: _par };
  const limpio = (s) => String(s).replace(/\*\*/g, '');
  const parrafos = (a.parrafos || []).map(limpio);
  const DPR = 2, Wd = 620, pad = 34;
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  const anchoTxt = Wd - pad * 2;
  // pre-medir para calcular la altura
  g.font = '15px system-ui,sans-serif';
  const envolver = (txt) => {
    const pals = txt.split(' '); const li = []; let ln = '';
    pals.forEach((w) => { const t = ln ? ln + ' ' + w : w; if (g.measureText(t).width > anchoTxt && ln) { li.push(ln); ln = w; } else ln = t; });
    if (ln) li.push(ln); return li;
  };
  const bloques = parrafos.map(envolver);
  let alto = 150;                                   // cabecera
  bloques.forEach((li) => { alto += li.length * 23 + 16; });
  alto += 60;                                       // pie
  cv.width = Wd * DPR; cv.height = alto * DPR; g.scale(DPR, DPR);
  // fondo
  const grad = g.createLinearGradient(0, 0, 0, alto);
  grad.addColorStop(0, '#12171f'); grad.addColorStop(1, '#0a0d12');
  g.fillStyle = grad; g.fillRect(0, 0, Wd, alto);
  g.strokeStyle = 'rgba(232,184,75,.5)'; g.lineWidth = 2; g.strokeRect(1, 1, Wd - 2, alto - 2);
  const pintar = () => {
    // título
    g.textAlign = 'left';
    g.fillStyle = '#E8B84B'; g.font = '800 20px system-ui,sans-serif';
    g.fillText('Jesus: Technical Analysis', 108, 52);
    g.fillStyle = '#8b95a1'; g.font = '600 13px ui-monospace,monospace';
    g.fillText(`${par.id} · ${M.tf} · ${new Date().toLocaleDateString('en-GB')}`, 108, 74);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(pad, 104); g.lineTo(Wd - pad, 104); g.stroke();
    // párrafos
    let y = 138; g.textAlign = 'left';
    bloques.forEach((li) => {
      g.fillStyle = '#dfe5ec'; g.font = '15px system-ui,sans-serif';
      li.forEach((ln) => { g.fillText(ln, pad, y); y += 23; });
      y += 16;
    });
    // pie
    g.fillStyle = '#6b7681'; g.font = '600 11px ui-monospace,monospace';
    g.textAlign = 'center';
    g.fillText(WEB_DOMINIO + ' \u00b7 Heat Pools', Wd / 2, alto - 26);
    // descargar
    cv.toBlob((b) => {
      const url = URL.createObjectURL(b); const enl = document.createElement('a');
      enl.href = url; enl.download = `analysis-${par.id}-${M.tf}.png`; enl.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  };
  // avatar circular
  const img = new Image();
  img.onload = () => { g.save(); g.beginPath(); g.arc(66, 58, 30, 0, 6.283); g.clip(); g.drawImage(img, 36, 28, 60, 60); g.restore();
    g.strokeStyle = 'rgba(232,184,75,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(66, 58, 30, 0, 6.283); g.stroke(); pintar(); };
  img.onerror = () => { g.fillStyle = '#E8B84B'; g.beginPath(); g.arc(66, 58, 30, 0, 6.283); g.fill(); pintar(); };
  img.src = 'assets/img/jesus-avatar.webp';
}

/* Ancla de la tarjeta (idéntica a Smart Levels). */
function _anclaTarjetaMu(pos, x, w, yt, ye, ys, cw, ch, x1, y1) {
  const yTop = Math.min(yt, ye, ys), yBot = Math.max(yt, ye, ys), cyMid = (yTop + yBot) / 2;
  let cx, cy; pos = pos || 'der';
  if (pos === 'izq') { cx = x - cw - 12; cy = cyMid - ch / 2; }
  else if (pos === 'arriba') { cx = x + w / 2 - cw / 2; cy = yTop - ch - 10; }
  else if (pos === 'abajo') { cx = x + w / 2 - cw / 2; cy = yBot + 10; }
  else { cx = x + w + 12; cy = cyMid - ch / 2; }
  cx = Math.max(4, Math.min(x1 - cw - 4, cx)); cy = Math.max(4, Math.min(y1 - ch - 4, cy));
  return { cx, cy };
}

/* Dibujo FIEL de la herramienta de posición de Smart Levels. */
/* Posiciones automáticas a partir de las zonas swing (botón "Positions").
   Single: una posición por zona relevante (1:2). Double: dos por zona (la 2ª
   entra en el stop de la 1ª, mismo diámetro, 1:2). Se escalonan en el tiempo
   para NO pisarse. Tarjeta minimizada por defecto. */
/* Comparte la señal: copia un texto limpio al portapapeles y genera una imagen
   PROFESIONAL (gráfico arriba + señal abajo, mismo fondo, logo de la moneda y
   pie con la marca). Crece proporcional según la cantidad de señales. */
function compartirSenal() {
  const pos = M._posAuto || posicionesDeZonas();
  const sh = $('mu-share');
  const flash = (m) => { if (sh) { const t = sh.dataset.base || sh.textContent; sh.dataset.base = t; sh.textContent = m; setTimeout(() => { sh.textContent = t; }, 1500); } };
  if (!pos.length) { flash('No signals'); return; }
  const par = PARES.find((p) => p.id === _par) || { id: _par };
  const dec = (v) => { const a = Math.abs(v); return a >= 1000 ? v.toFixed(1) : a >= 1 ? v.toFixed(3) : v.toFixed(5); };
  const hora = new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
  const precio = M.precio ? dec(M.precio) : '\u2014';
  const ents = pos.map((p) => dec(p.pe)), sls = pos.map((p) => dec(p.pStop)), tps = pos.map((p) => dec(p.pTarget));
  const n = ents.length;
  const lista = (arr) => arr.map((v, i) => `${i + 1}: ${v}`).join('\n');
  const txt =
`HEAT POOLS \u2014 SIGNAL

${par.id} \u00b7 ${M.tf} \u00b7 ${hora} UTC \u00b7 Price ${precio}

ENTRY
${lista(ents)}

STOP LOSS
${lista(sls)}

TAKE PROFIT
${lista(tps)}

RISK : REWARD \u2014 1:2

${WEB_DOMINIO} \u00b7 Heat Pools`;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => flash('Copied \u2713')).catch(() => {});

  // ── Imagen ──
  const chart = $('mu-cv');
  const W = 1180, BG = '#0a0d12';
  const chartH = chart && chart.width ? Math.round(W * (chart.height / chart.width)) : 0;
  const padX = 54, headH = 156, rowH = 56, rrH = 92, footH = 84;
  const H = chartH + headH + n * rowH + rrH + footH;
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  cv.width = W; cv.height = H;

  const cargar = (src, cors) => new Promise((res) => { if (!src) return res(null); const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

  // Logo de la moneda: igual que los bots, se carga desde githubusercontent
  // (permite CORS -> se puede dibujar en canvas). Primario: repo de iconos por
  // símbolo; respaldo: CoinGecko (_logos). Si todo falla, círculo con el ticker.
  const prep = (async () => {
    const sym = par.id.toLowerCase();
    const iconoRepo = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym}.png`;
    let coin = await cargar(iconoRepo, true);
    if (!coin) {
      if (!(_logos && _logos[par.cg]) && typeof ponerLogos === 'function') { try { await ponerLogos(); } catch (_) {} }
      if (_logos && _logos[par.cg]) coin = await cargar(_logos[par.cg], true);
    }
    const marca = await cargar('assets/img/cco-marca.png', false);
    return [coin, marca];
  })();

  prep.then(([coin, marca]) => {
    g.fillStyle = BG; g.fillRect(0, 0, W, H);                  // fondo continuo (una pieza)
    if (chart && chart.width) g.drawImage(chart, 0, 0, W, chartH);
    const y0 = chartH;
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y0 + 0.5); g.lineTo(W, y0 + 0.5); g.stroke();

    // Cabecera: logo de la moneda + título grande + subtítulo
    const ls = 72, lx = padX, ly = y0 + 30;
    g.save(); g.beginPath(); g.arc(lx + ls / 2, ly + ls / 2, ls / 2, 0, 6.2832); g.closePath();
    g.fillStyle = coin ? '#ffffff' : '#141b25'; g.fill();
    if (coin) { g.clip(); g.drawImage(coin, lx, ly, ls, ls); }
    else { g.fillStyle = '#E8B84B'; g.font = '800 24px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(par.id.slice(0, 4), lx + ls / 2, ly + ls / 2 + 1); }
    g.restore();
    if (coin) { g.strokeStyle = 'rgba(232,184,75,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(lx + ls / 2, ly + ls / 2, ls / 2, 0, 6.2832); g.stroke(); }

    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const tx = lx + ls + 24;
    g.fillStyle = '#2ee86a'; g.font = '800 40px system-ui,sans-serif';
    g.fillText('Heat Pools', tx, y0 + 56);
    const hw = g.measureText('Heat Pools').width;
    g.fillStyle = '#e8ecf2'; g.font = '800 40px system-ui,sans-serif';
    g.fillText(' Signal', tx + hw, y0 + 56);
    g.fillStyle = '#8b95a1'; g.font = '600 18px ui-monospace,monospace';
    g.fillText(`${par.id}    \u00b7    ${M.tf}    \u00b7    ${hora} UTC    \u00b7    Price ${precio}`, tx, y0 + 88);

    // Tres columnas repartidas a lo ANCHO (izquierda, centro, derecha)
    const colBlock = 250;
    const xs = [padX, Math.round(W / 2 - colBlock / 2), W - padX - colBlock];
    const cols = [['ENTRY', ents, '#e8ecf2'], ['STOP LOSS', sls, '#ff5b6e'], ['TARGET', tps, '#2ee86a']];
    const colY = y0 + headH;
    cols.forEach((c, ci) => {
      const cx = xs[ci];
      g.textAlign = 'left';
      g.fillStyle = c[2]; g.font = '800 20px system-ui,sans-serif'; g.fillText(c[0], cx, colY);
      g.strokeStyle = c[2]; g.globalAlpha = .3; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, colY + 13); g.lineTo(cx + colBlock, colY + 13); g.stroke(); g.globalAlpha = 1;
      c[1].forEach((v, i) => {
        const ry = colY + 46 + i * rowH;
        g.fillStyle = '#5a6570'; g.font = '700 17px ui-monospace,monospace'; g.fillText(String(i + 1), cx, ry);
        g.fillStyle = '#eef2f6'; g.font = '800 27px ui-monospace,monospace'; g.fillText(v, cx + 32, ry + 2);
      });
    });

    // Risk : Reward centrado
    const rry = colY + 46 + n * rowH + 40;
    g.textAlign = 'center';
    g.fillStyle = '#8b95a1'; g.font = '700 18px system-ui,sans-serif'; g.fillText('RISK : REWARD', W / 2 - 60, rry);
    g.fillStyle = '#E8B84B'; g.font = '800 26px system-ui,sans-serif'; g.fillText('1 : 2', W / 2 + 90, rry + 1);

    // Pie: logo de la web GRANDE + dominio, y Heat Pools a la derecha
    const fy = H - footH;
    g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(0, fy, W, footH);
    g.strokeStyle = 'rgba(232,184,75,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, fy + 0.5); g.lineTo(W, fy + 0.5); g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'middle';
    let dx = padX;
    if (marca) { const mh = 46, mw = marca.width * (mh / marca.height); g.drawImage(marca, padX, fy + (footH - mh) / 2, mw, mh); dx = padX + mw + 18; }
    g.fillStyle = '#dfe5ec'; g.font = '700 19px system-ui,sans-serif'; g.fillText(WEB_DOMINIO, dx, fy + footH / 2 + 1);
    g.fillStyle = '#E8B84B'; g.font = '800 19px system-ui,sans-serif'; g.textAlign = 'right'; g.fillText('Heat Pools', W - padX, fy + footH / 2 + 1);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';

    try {
      cv.toBlob((b) => { if (!b) return; const url = URL.createObjectURL(b), a = document.createElement('a'); a.href = url; a.download = `heatpools-${par.id}-${M.tf}-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); }, 'image/png');
    } catch (e) { flash('Copied \u2713'); }
  });
}

function posicionesDeZonas() {
  const geo = M._geo; if (!geo || !M.estructuras) return [];
  const vis = geo.vis; if (!vis || !vis.length) return [];
  const tfMs = geo.tfMs || 60000;
  const tBase = vis[vis.length - 1].t;
  const W = 12 * tfMs, GAP = 5 * tfMs;    // un poco más anchas; hueco para no pisarse
  const out = [];
  let slot = 0;
  const nuevaRanura = () => { const t0 = tBase + 3 * tfMs + slot * (W + GAP); slot++; return t0; };
  M.estructuras.forEach((z) => {
    if (!(z.rr > 0)) return;                        // zona ancha → no operar
    const corto = z.dir === 'oferta';
    const rango = Math.abs(z.hi - z.lo) || 1;
    const tipo = corto ? 'poscorta' : 'poslarga';
    const mk = (pe, sl, t0) => {
      const tp = corto ? pe - 2 * Math.abs(sl - pe) : pe + 2 * Math.abs(sl - pe);
      return { tipo, pe, pStop: sl, pTarget: tp, t0, t1: t0 + W, zonaPoc: pe,
        cTarget: '#2ee86a', cEntry: '#eaecef', cStop: '#ff3b52', grosor: 2, intensidad: 1,
        cardPos: 'der', oculto: true, guia: false };
    };
    out.push(mk(z.e1, z.sl, nuevaRanura()));         // Posición 1
    if (M._modoPos === 'double') {
      const pe2 = z.slE2 != null ? z.slE2 : (corto ? z.sl + rango * 0.15 : z.sl - rango * 0.15);
      const sl2 = corto ? pe2 + rango : pe2 - rango;
      out.push(mk(pe2, sl2, nuevaRanura()));         // Posición 2 (entra en el stop de la 1ª, mismo diámetro)
    }
  });
  return out;
}

function dibujarPosicion(g, P0) {
  const P = P0 || M._pos, geo = M._geo; if (!P || !geo) return;
  const largo = P.tipo === 'poslarga';
  const x1 = geo.xVelas, y1 = geo.y1;
  const Ax = mXt(P.t0), Bx = mXt(P.t1);
  const pe = P.pe, pT = P.pTarget, pS = P.pStop;
  const ye = mYp(pe), yt = mYp(pT), ys = mYp(pS);
  const x = Math.min(Ax, Bx), w = Math.abs(Bx - Ax) || 130;
  const gr = P.grosor || 2, inten = P.intensidad != null ? P.intensidad : 1;
  const cT = P.cTarget || '#2ee86a', cE = P.cEntry || '#eaecef', cS = P.cStop || '#ff3b52';
  const rgbT = _hex2rgb(cT), rgbS = _hex2rgb(cS);
  const acc = largo ? '#2ee86a' : '#ff3b52', accRGB = largo ? '46,232,106' : '255,59,82';

  // Puntico destino de la entrada; la línea guía la traza un SVG que SÍ sale de la píldora.
  if (P.guia) { g.save(); g.fillStyle = acc; g.beginPath(); g.arc(x + w, ye, 4, 0, 6.283); g.fill(); g.restore(); }
  M._guiaDst = P.guia ? { x: x + w, y: ye, col: acc } : (M._tend && M._tend.guia ? M._guiaDst : null);

  // zonas ganancia / riesgo (tinte suave para no saturar el radar)
  g.fillStyle = `rgba(${rgbT},${(0.10 * inten).toFixed(3)})`; g.fillRect(x, Math.min(ye, yt), w, Math.abs(yt - ye));
  g.fillStyle = `rgba(${rgbS},${(0.10 * inten).toFixed(3)})`; g.fillRect(x, Math.min(ye, ys), w, Math.abs(ys - ye));
  // 3 líneas objetivo / entrada / stop
  [[cT, yt], [cE, ye], [cS, ys]].forEach((r) => {
    g.strokeStyle = r[0]; g.lineWidth = gr; g.beginPath(); g.moveTo(x, r[1]); g.lineTo(x + w, r[1]); g.stroke();
  });
  // Punticos en los extremos editables (como Smart Levels): en cada punta de cada línea.
  if (!P.oculto) {
    g.save();
    [[cT, yt], [cE, ye], [cS, ys]].forEach((r) => {
      [x, x + w].forEach((xx) => {
        g.fillStyle = '#0b0e12'; g.beginPath(); g.arc(xx, r[1], 3.6, 0, 6.283); g.fill();
        g.fillStyle = r[0]; g.beginPath(); g.arc(xx, r[1], 2.4, 0, 6.283); g.fill();
      });
    });
    g.restore();
  }
  P._pos = { x, w, yt, ye, ys };
  const gPct = ((pT - pe) / pe) * 100, rPct = ((pS - pe) / pe) * 100;
  const rr = Math.abs(rPct) > 0 ? Math.abs(gPct / rPct) : 0;

  if (P.oculto) {
    const bw = 26, bh = 16;
    // DENTRO de la posición: centrado en horizontal, en la zona del Take Profit
    // un poco por debajo del centro, acercándose a la entrada SIN tocarla.
    const bcx = x + w / 2, bcy = ye + (yt - ye) * 0.35;
    const mp = { cx: bcx - bw / 2, cy: bcy - bh / 2 };
    const hover = M._cursor && M._cursor.x >= mp.cx - 3 && M._cursor.x <= mp.cx + bw + 3 && M._cursor.y >= mp.cy - 3 && M._cursor.y <= mp.cy + bh + 3;
    g.save(); g.globalAlpha = hover ? 1 : 0;         // totalmente invisible; solo aparece al pasar el cursor
    if (hover) { g.shadowColor = `rgba(${accRGB},.55)`; g.shadowBlur = 9; }
    g.fillStyle = acc; redondeado(g, mp.cx, mp.cy, bw, bh, 5); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = '#0b0f16'; g.font = '800 10px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(largo ? 'L' : 'S', mp.cx + 9, mp.cy + bh / 2 + .5);
    g.font = '800 8px system-ui,sans-serif'; g.fillText('⌄', mp.cx + 19, mp.cy + bh / 2 - .5);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.restore();
    P._miniBtn = { x: mp.cx, y: mp.cy, w: bw, h: bh }; P._hideBtn = P._arrL = P._arrR = null;
    return;
  }
  P._miniBtn = null;

  // ── Tarjeta de presentación (a escala, OPACA) ──
  const Sc = 0.7;                       // escala: más pequeña, todo proporcional
  const cw = 226, ch = 140;
  const ap = _anclaTarjetaMu(P.cardPos, x, w, yt, ye, ys, cw * Sc, ch * Sc, x1, y1);
  const cx = ap.cx, cy = ap.cy;
  const hbL = { x: cw - 34, y: 9, w: 24, h: 19 };
  const rxL = cw - 42, divXL = cw - 78, ay2L = ch - 18;
  const alL = { x: rxL - 27, y: ay2L - 11, w: 22, h: 22 }, arL = { x: rxL + 5, y: ay2L - 11, w: 22, h: 22 };
  const rrTxt = Math.abs(rr - Math.round(rr)) < 0.06 ? String(Math.round(rr)) : rr.toFixed(1);
  g.save();
  g.translate(cx, cy); g.scale(Sc, Sc);              // todo lo de dentro va en coords locales 0..cw / 0..ch
  g.shadowColor = 'rgba(0,0,0,.62)'; g.shadowBlur = 22;
  g.fillStyle = 'rgba(12,16,23,1)'; redondeado(g, 0, 0, cw, ch, 16); g.fill();   // OPACA (no se ve lo de atrás)
  g.shadowColor = 'transparent';
  g.strokeStyle = `rgba(${accRGB},.55)`; g.lineWidth = 1.2; redondeado(g, 0, 0, cw, ch, 16); g.stroke();
  g.fillStyle = acc; redondeado(g, 0, 14, 4, ch - 28, 2); g.fill();
  g.textAlign = 'left';
  g.fillStyle = acc; g.font = '800 11px system-ui,sans-serif';
  g.fillText(largo ? 'POSICI\u00d3N LARGA' : 'POSICI\u00d3N CORTA', 16, 23);
  g.fillStyle = 'rgba(255,255,255,.1)'; redondeado(g, hbL.x, hbL.y, hbL.w, hbL.h, 6); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; redondeado(g, hbL.x, hbL.y, hbL.w, hbL.h, 6); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(hbL.x + 6, hbL.y + 9.5); g.lineTo(hbL.x + 18, hbL.y + 9.5); g.stroke();
  const colX = 16;
  g.fillStyle = '#79838f'; g.font = 'bold 9px system-ui,sans-serif'; g.fillText('TAKE PROFIT', colX, 46);
  g.save(); g.shadowColor = 'rgba(46,232,106,.65)'; g.shadowBlur = 14;
  g.fillStyle = cT; g.font = '800 29px system-ui,sans-serif';
  g.fillText(`+${Math.abs(gPct).toFixed(2)}%`, colX, 75); g.restore();
  g.fillStyle = '#79838f'; g.font = 'bold 9px system-ui,sans-serif'; g.fillText('STOP LOSS', colX, 99);
  g.save(); g.shadowColor = `rgba(${rgbS},.65)`; g.shadowBlur = 14;
  g.fillStyle = cS; g.font = '800 25px system-ui,sans-serif';
  g.fillText(`\u2212${Math.abs(rPct).toFixed(2)}%`, colX, 125); g.restore();
  g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(divXL, 40); g.lineTo(divXL, ch - 34); g.stroke();
  g.textAlign = 'center';
  g.fillStyle = '#79838f'; g.font = 'bold 9px system-ui,sans-serif'; g.fillText('R : R', rxL, 56);
  g.save(); g.shadowColor = 'rgba(232,184,75,.55)'; g.shadowBlur = 12;
  g.fillStyle = '#E8B84B'; g.font = '800 24px system-ui,sans-serif';
  g.fillText(`1:${rrTxt}`, rxL, 84); g.restore();
  [[alL, -1], [arL, 1]].forEach((f) => {
    g.fillStyle = 'rgba(255,255,255,.09)'; redondeado(g, f[0].x, f[0].y, 22, 22, 6); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1; redondeado(g, f[0].x, f[0].y, 22, 22, 6); g.stroke();
    g.strokeStyle = '#c3cad2'; g.lineWidth = 1.8; g.beginPath();
    const mx = f[0].x + 11, my = f[0].y + 11;
    if (f[1] < 0) { g.moveTo(mx + 3, my - 4); g.lineTo(mx - 3, my); g.lineTo(mx + 3, my + 4); }
    else { g.moveTo(mx - 3, my - 4); g.lineTo(mx + 3, my); g.lineTo(mx - 3, my + 4); }
    g.stroke();
  });
  g.restore();                                       // fin de la escala
  // Hitboxes en coordenadas de pantalla (translate + scale)
  P._hideBtn = { x: cx + hbL.x * Sc, y: cy + hbL.y * Sc, w: hbL.w * Sc, h: hbL.h * Sc };
  P._arrL = { x: cx + alL.x * Sc, y: cy + alL.y * Sc, w: 22 * Sc, h: 22 * Sc };
  P._arrR = { x: cx + arL.x * Sc, y: cy + arL.y * Sc, w: 22 * Sc, h: 22 * Sc };
  g.textAlign = 'left';
}

/* ══ TENDENCIA (Faro) anclada a timestamps: se PEGA al gráfico ══
   Une los MÍNIMOS si es alcista o los MÁXIMOS si es bajista, por tramos. */
function mostrarTendencia() {
  const geo = M._geo; if (!geo || !M.velas.length) return;
  // Ventana amplia para que la tendencia salga COMPLETA desde la esquina:
  // usamos las últimas ~150 velas (o las visibles si hay menos), no solo el trozo visible.
  const N = Math.min(M.velas.length, Math.max(geo.vis.length, 150));
  const win = M.velas.slice(M.velas.length - N);
  const n = win.length; if (n < 6) return;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  win.forEach((v, i) => { sx += i; sy += v.c; sxy += i * v.c; sxx += i * i; });
  const m = (n * sxy - sx * sy) / Math.max(1e-9, n * sxx - sx * sx);
  const alcista = m >= 0;
  const pts = win.map((v) => ({ t: v.t, p: alcista ? v.l : v.h }));
  // Envolvente adaptativa (cadena monótona): toca TODOS los mínimos si es
  // alcista o TODOS los máximos si es bajista, re-pivotando en cada separación.
  const hull = [];
  const giro = (o, a, b) => (a.t - o.t) * (b.p - o.p) - (a.p - o.p) * (b.t - o.t);
  for (const pt of pts) {
    while (hull.length >= 2) { const c = giro(hull[hull.length - 2], hull[hull.length - 1], pt); if (alcista ? c <= 0 : c >= 0) hull.pop(); else break; }
    hull.push(pt);
  }
  // Asegurar que arranca en la primera vela (la esquina) y llega a la última.
  if (hull.length && hull[0].t !== pts[0].t) hull.unshift(pts[0]);
  if (hull.length && hull[hull.length - 1].t !== pts[n - 1].t) hull.push(pts[n - 1]);
  const segs = [];
  for (let k = 0; k < hull.length - 1; k++) segs.push({ t0: hull[k].t, p0: hull[k].p, t1: hull[k + 1].t, p1: hull[k + 1].p });
  if (!segs.length) return;
  M._tend = { segs, dir: alcista ? 'alcista' : 'bajista', color: alcista ? '#2ee86a' : '#f6465d', grosor: 2, guia: true };
  const tabChart = [...document.querySelectorAll('.mu-mtab')].find((x) => /hart|r\u00e1fic|gr\u00e1fic/i.test(x.textContent));
  if (tabChart && !tabChart.classList.contains('on')) tabChart.click();
  cerrarTendCfg(); dibujar();
}
function dibujarTendencia(g) {
  const T = M._tend, geo = M._geo; if (!T || !T.segs.length || !geo) return;
  const ult0 = T.segs[T.segs.length - 1];
  const px2 = mXt(ult0.t1), py2 = mYp(ult0.p1);
  // La línea guía la traza el SVG (sale de la píldora). Aquí solo el puntico destino.
  if (T.guia) { g.save(); g.fillStyle = T.color; g.beginPath(); g.arc(px2, py2, 4, 0, 6.283); g.fill(); g.restore();
    M._guiaDst = { x: px2, y: py2, col: T.color }; }
  g.save(); g.strokeStyle = T.color; g.lineWidth = T.grosor; g.lineJoin = 'round'; g.shadowColor = T.color; g.shadowBlur = 5;
  g.beginPath();
  T.segs.forEach((s, k) => { const x0 = mXt(s.t0), yy0 = mYp(s.p0), x1p = mXt(s.t1), yy1 = mYp(s.p1); if (k === 0) g.moveTo(x0, yy0); g.lineTo(x1p, yy1); });
  g.stroke(); g.shadowBlur = 0; g.fillStyle = T.color;
  const pts = [{ t: T.segs[0].t0, p: T.segs[0].p0 }].concat(T.segs.map((s) => ({ t: s.t1, p: s.p1 })));
  pts.forEach((pt) => { g.beginPath(); g.arc(mXt(pt.t), mYp(pt.p), 3, 0, 7); g.fill(); });
  g.restore();
  // La tachuela de dirección SOLO se ve mientras no se ha tocado la gráfica (con la guía).
  if (T.guia) {
    const ult = T.segs[T.segs.length - 1];
    const tx = mXt(ult.t1), ty = mYp(ult.p1);
    const txt = T.dir === 'alcista' ? '\u2197 Tendencia adaptativa alcista' : '\u2198 Tendencia adaptativa bajista';
    g.font = 'bold 9.5px ui-monospace,monospace';
    const w = g.measureText(txt).width + 14;
    const bx = Math.max(4, Math.min(tx - w / 2, geo.xVelas - w - 4)), by = ty - (T.dir === 'alcista' ? 22 : -8);
    g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.fillStyle = T.color; redondeado(g, bx, by, w, 16, 5); g.fill(); g.restore();
    g.fillStyle = T.dir === 'alcista' ? '#04210f' : '#2a0509'; g.textAlign = 'left'; g.fillText(txt, bx + 7, by + 11); g.textAlign = 'left';
  }
}
function cercaTend(lx, ly) {
  const T = M._tend, g = M._geo; if (!T || !g) return false;
  return T.segs.some((s) => {
    const x0 = mXt(s.t0), y0 = mYp(s.p0), x1 = mXt(s.t1), y1 = mYp(s.p1);
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    let t = L2 ? ((lx - x0) * dx + (ly - y0) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(lx - (x0 + t * dx), ly - (y0 + t * dy)) < 8;
  });
}
function cerrarPosCfg() { document.getElementById('mu-poscfg')?.remove(); }
function cerrarTendCfg() { document.getElementById('mu-tendcfg')?.remove(); }

/* Config de la tendencia: dirección + color + grosor + eliminar (hija del radar). */
function mostrarTendCfg() {
  cerrarTendCfg(); const ov = $('mu-overlay'); if (!ov || !M._tend) return;
  const c = document.createElement('div'); c.id = 'mu-tendcfg';
  c.innerHTML = `<span class="pc-et">${M._tend.dir === 'alcista' ? '\u2197 alcista' : '\u2198 bajista'}</span>
    <button data-a="color" title="Color">\u25c9</button><button data-a="grosor" title="Grosor">\u2261</button><button data-a="del" title="Eliminar">\u{1F5D1}</button>`;
  ov.appendChild(c); posTendCfg();
  const paleta = ['#2ee86a', '#f6465d', '#E8B84B', '#7fbaff', '#c58bff'], grosores = [1.5, 2.5, 3.5];
  c.querySelector('[data-a="color"]').onclick = () => { const i = (paleta.indexOf(M._tend.color) + 1) % paleta.length; M._tend.color = paleta[i]; dibujar(); };
  c.querySelector('[data-a="grosor"]').onclick = () => { let i = grosores.indexOf(M._tend.grosor); i = (i + 1) % grosores.length; M._tend.grosor = grosores[i < 0 ? 0 : i]; dibujar(); };
  c.querySelector('[data-a="del"]').onclick = () => { M._tend = null; cerrarTendCfg(); dibujar(); };
}
function posTendCfg() {
  const c = $('mu-tendcfg'), cv = $('mu-cv'), ov = $('mu-overlay'), g = M._geo, T = M._tend; if (!c || !cv || !ov || !g || !T) return;
  const or = ov.getBoundingClientRect(), cr = cv.getBoundingClientRect(); const ox = cr.left - or.left, oy = cr.top - or.top;
  const s = T.segs[T.segs.length - 1]; const x = mXt(s.t1), y = mYp(s.p1);
  c.style.left = (ox + Math.max(6, Math.min(cv.clientWidth - 150, x - 60))) + 'px';
  c.style.top = (oy + Math.max(6, y - 44)) + 'px';
}
/* Config de la posición: eliminar (hija del radar). */
function mostrarPosCfg() {
  cerrarPosCfg(); const ov = $('mu-overlay'); if (!ov || !M._pos) return;
  const P = M._pos;
  const c = document.createElement('div'); c.id = 'mu-poscfg';
  c.innerHTML = `<span class="pc-et">${P.tipo === 'poslarga' ? '\u25b2 LARGA' : '\u25bc CORTA'}</span>` +
    `<button data-a="color" title="Color">\u25c9</button>` +
    `<button data-a="grosor" title="Grosor">\u2261</button>` +
    `<button data-a="del" title="Eliminar">\u{1F5D1}</button>`;
  ov.appendChild(c); posPosCfg();
  const paleta = ['#eaecef', '#2ee86a', '#f6465d', '#E8B84B', '#7fbaff', '#c58bff'];
  const grosores = [1.5, 2.5, 3.5];
  c.querySelector('[data-a="color"]').onclick = () => { const i = (paleta.indexOf(P.cEntry) + 1) % paleta.length; P.cEntry = paleta[i]; dibujar(); };
  c.querySelector('[data-a="grosor"]').onclick = () => { let i = grosores.indexOf(P.grosor); i = (i + 1) % grosores.length; P.grosor = grosores[i < 0 ? 1 : i]; dibujar(); };
  c.querySelector('[data-a="del"]').onclick = () => { M._pos = null; M._posList = null; quitarPager(); cerrarPosCfg(); dibujar(); };
}
function posPosCfg() {
  const c = $('mu-poscfg'), cv = $('mu-cv'), ov = $('mu-overlay'), P = M._pos; if (!c || !cv || !ov || !P || !P._pos) return;
  const or = ov.getBoundingClientRect(), cr = cv.getBoundingClientRect(); const ox = cr.left - or.left, oy = cr.top - or.top;
  c.style.left = (ox + Math.max(6, Math.min(cv.clientWidth - 120, P._pos.x))) + 'px';
  c.style.top = (oy + Math.max(6, Math.min(P._pos.yt, P._pos.ye, P._pos.ys) - 34)) + 'px';
}

/* ══════════════════════════════════════════════════════════════
   RESUMEN DE VOLUMEN

   Muestra las cifras de volumen real que sostienen las zonas, sin revelar
   proveedores ni fuentes: es parte del valor.
   ══════════════════════════════════════════════════════════════ */
function validarVolumen() {
  const par = PARES.find((p) => p.id === _par) || PARES[0];
  const base = par.s.replace(/USDT$|USDC$|FDUSD$|BUSD$/, '');
  const mk = M.mercado;
  const zTot = (M.velas || []).reduce((s, v) => s + (v.vol || 0), 0);
  const zFuerte = (M.zonas || []).slice().sort((a, b) => b.v - a.v)[0];
  const hora = new Date().toLocaleString('es', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  document.getElementById('mu-val-box')?.remove();
  const d = document.createElement('div');
  d.id = 'mu-val-box';
  d.innerHTML = `<div class="mu-bg"></div>
    <div class="mv-c">
      <button class="mv-x" aria-label="Cerrar">\u2715</button>
      <div class="mv-eyebrow">Volumen \u00b7 ${esc(base)} \u00b7 ${esc(M.tf)}</div>
      <h3 class="mv-t">Volumen negociado en tiempo real</h3>
      <p class="mv-d">Estas son las cifras de <b>volumen real en d\u00f3lares</b> que sostienen las zonas detectadas. Cada zona muestra el capital acumulado que ha pasado por ese rango de precio.</p>
      <div class="mv-nums">
        <div><b>${dinero(zTot)}</b><span>volumen circundante</span></div>
        <div><b>${zFuerte ? dinero(zFuerte.v) : '\u2014'}</b><span>volume of the strongest zone</span></div>
        <div><b>${mk && mk.vwap ? fmt(mk.vwap) : '\u2014'}</b><span>VWAP anclado</span></div>
      </div>
      <div class="mv-links">
        <button class="mv-copy" id="mv-copy">Copiar alerta</button>
      </div>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => d.remove();
  d.querySelector('.mu-bg').onclick = cerrar;
  d.querySelector('.mv-x').onclick = cerrar;
  d.querySelector('#mv-copy').onclick = () => {
    // Alerta pro: líneas cortas (seguras en móvil), emojis serios, fácil de leer.
    // Negrita real (Unicode) para los títulos: se ve en WhatsApp, Telegram y notas.
    const neg = (s) => s.replace(/[A-Za-z0-9]/g, (c) => {
      const cc = c.charCodeAt(0);
      if (cc >= 65 && cc <= 90) return String.fromCodePoint(0x1D5D4 + (cc - 65));
      if (cc >= 97 && cc <= 122) return String.fromCodePoint(0x1D5EE + (cc - 97));
      if (cc >= 48 && cc <= 57) return String.fromCodePoint(0x1D7EC + (cc - 48));
      return c;
    });
    const icono = (z) => z.rota ? '\u26aa' : (z.lado === 'demanda' ? '\u{1F7E2}' : '\u{1F534}');
    const tipo = (z) => z.rota ? 'ROTA   ' : (z.lado === 'demanda' ? 'DEMANDA' : 'OFERTA ');
    const aqui = (z) => z.dentro ? '  \u25c0 AQU\u00cd' : '';
    const niveles = (M.zonas || []).slice(0, 6).map((z) => `${icono(z)} ${tipo(z)} ${fmt(z.pLow)}\u2013${fmt(z.pHigh)}  ${dinero(z.v)}${aqui(z)}`).join('\n');
    const sesgo = mk ? (mk.sesgo === 'comprador' ? 'Comprador' : mk.sesgo === 'vendedor' ? 'Vendedor' : 'Neutral') : 'Neutral';
    const alerta =
`\u{1F537} ${neg('ADVANCED STRUCTURAL LOGIC')}

${esc(base)} \u00b7 ${esc(M.tf)} \u00b7 ${hora}


\u{1F4B5} Precio actual: ${fmt(M.precio)}
\u{1F4C8} VWAP: ${mk && mk.vwap ? fmt(mk.vwap) : '\u2014'}
\u{1F4CA} Volumen circundante: ${dinero(zTot)}


\u{1F3AF} ${neg('KEY ZONES')}

${niveles || 'Sin zonas cercanas'}


\u{1F9ED} ${neg('Sesgo')}: ${sesgo}`;
    const btn = d.querySelector('#mv-copy');
    const ok = () => { btn.textContent = '\u2713 Alert copied'; setTimeout(() => { btn.textContent = 'Copiar alerta'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(alerta).then(ok).catch(ok);
    else { try { const ta = document.createElement('textarea'); ta.value = alerta; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch (_) {} ok(); }
  };
}

/* ══════════════════════════════════════════════════════════════
   COMPARTIR — con la marca, para que circule
   ══════════════════════════════════════════════════════════════ */
function guardarImagen() {
  const cv = $('mu-cv'); if (!cv) return;
  const marca = document.querySelector('.mu-marca');
  const antes = marca ? marca.style.display : null;
  if (marca) marca.style.display = 'none';
  const devolver = () => { if (marca) marca.style.display = antes || ''; };

  try {
    const e2 = cv.width / cv.clientWidth;
    const barra = 78 * e2;
    const out = document.createElement('canvas');
    out.width = cv.width; out.height = cv.height + barra;
    const g = out.getContext('2d');
    g.fillStyle = '#0a0e14'; g.fillRect(0, 0, out.width, out.height);
    g.drawImage(cv, 0, 0);

    const yB = cv.height;
    g.fillStyle = '#0b0e12'; g.fillRect(0, yB, out.width, barra);
    g.fillStyle = 'rgba(232,184,75,.35)'; g.fillRect(0, yB, out.width, 2 * e2);

    const textos = (x) => {
      g.textAlign = 'left';
      g.fillStyle = '#E8B84B';
      g.font = `800 ${19 * e2}px system-ui,sans-serif`;
      g.fillText('Lógica Estructural Avanzada', x, yB + 34 * e2);
      g.font = `700 ${14 * e2}px ui-monospace,monospace`;
      g.fillStyle = '#C9A84B';
      g.fillText(WEB_DOMINIO, x, yB + 56 * e2);
      g.textAlign = 'right';
      g.fillStyle = '#8b96a3';
      g.font = `700 ${14 * e2}px ui-monospace,monospace`;
      g.fillText(`${_par} · ${M.tf}`, out.width - 20 * e2, yB + 34 * e2);
      g.font = `${11 * e2}px ui-monospace,monospace`;
      g.fillStyle = '#6b7681';
      g.fillText(new Date().toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        out.width - 20 * e2, yB + 56 * e2);
      g.textAlign = 'left';
    };

    const bajar = () => out.toBlob((blob) => {
      devolver();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `criptocuba-radar-${_par}-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');

    const logo = new Image();
    let hecho = false;
    const una = (w) => { if (hecho) return; hecho = true; textos(w ? 20 * e2 + w + 18 * e2 : 20 * e2); bajar(); };
    logo.onload = () => {
      try {
        const alto = 52 * e2;
        const ancho = Math.round(logo.width * (alto / logo.height));
        g.drawImage(logo, 20 * e2, yB + (barra - alto) / 2, ancho, alto);
        una(ancho);
      } catch (_) { una(0); }
    };
    logo.onerror = () => una(0);
    setTimeout(() => una(0), 1500);
    logo.src = 'assets/img/cco-marca.png';
  } catch (_) { devolver(); }
}
