// muros.js — Detector de Lógica Estructural Avanzada
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
  { id: 'MATIC', s: 'MATICUSDT', n: 'Polygon',    cg: 'matic-network' },
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
  { id: 'INJ',   s: 'INJUSDT',   n: 'Injective',  cg: 'injective-protocol' }
];

let _par = 'BNB';
let _od = null;              // módulo de órdenes
let _zonasOd = [];           // dónde pulsar para cancelar

/* ══════════════════════════════════════════════════════════════
   LAS VELAS — el contexto que faltaba
   Sin gráfico, los muros son números sueltos. Con él se ve dónde
   está el precio respecto a cada nivel.
   ══════════════════════════════════════════════════════════════ */
const TFS = [
  { id: '1m',  n: '1m' },
  { id: '5m',  n: '5m' },
  { id: '15m', n: '15m' },
  { id: '1h',  n: '1H' },
  { id: '4h',  n: '4H' },
  { id: '1d',  n: '1D' }
];

async function traerVelas(simbolo, tf, n = 120) {
  const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${simbolo}&interval=${tf}&limit=${n}`);
  if (!r.ok) throw new Error('sin velas');
  const j = await r.json();
  return j.map((x) => ({
    t: Math.floor(x[0] / 1000),
    o: Number(x[1]), h: Number(x[2]), l: Number(x[3]), c: Number(x[4])
  }));
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
  tf: '5m',           // temporalidad
  ancho: window.innerWidth < 760 ? 65 : 100,  // cuántas velas se ven
  filtro: 'todos',
  maxMuro: 1,
  zoomY: 1,           // estirar/contraer la escala de precios
  desplaz: 0          // cuántas velas se ha movido la vista
};

const CADA = 1500;          // una foto cada 1,5 segundos
const MAX_FOTOS = 220;      // ~5,5 minutos de historia
const MIN_TOMAS = 6;        // antes de juzgar, hay que mirar un rato

/* ══════════════════════════════════════════════════════════════
   LOS DATOS — profundidad del libro, API pública sin clave
   ══════════════════════════════════════════════════════════════ */
async function traerLibro(simbolo) {
  const r = await fetch(`https://api.binance.com/api/v3/depth?symbol=${simbolo}&limit=500`);
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
  // número fijo: así funciona igual en BTC que en PEPE.
  /* El umbral se calcula sobre el percentil 90, no la mediana. Con la
     mediana, en libros muy poblados el corte quedaba tan alto que ni
     los muros grandes lo pasaban. */
  /* [UNIFICADO] El umbral del panel era mucho más exigente que el del
     dibujo: se veían muros en el mapa pero el panel decía "libro
     tranquilo". Ahora usan la misma referencia. */
  const vals = todos.map((x) => x.v).sort((a, b) => a - b);
  const base = vals[Math.floor(vals.length * 0.55)] || 1;
  const umbral = base * 2.2;

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
    if (nv.tomas < 3) return;
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

    } else if (vivo && segundos > 6) {
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
  const nuevos = fuera.slice(0, 10);
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
          ? 'Confirmado: se retiró del libro sin llegar a ejecutarse. Era falso.'
          : 'Este muro ya no está en el libro. O se consumió del todo, o quien lo puso lo retiró.',
        prioridad: 30, vivo: false
      });
    }
  });

  nuevos.sort((a, b) => {
    const pa = a.prioridad - Math.abs(a.dist) * 900;
    const pb = b.prioridad - Math.abs(b.dist) * 900;
    return pb - pa;
  });
  M.muros = nuevos.slice(0, 12);
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
   ABRIR
   ══════════════════════════════════════════════════════════════ */
export async function abrirMuros(par) {
  if (par) _par = par;
  estilos();
  const prev = $('mu-overlay'); if (prev) prev.remove();

  // Estado limpio: cada apertura empieza de cero
  M.fotos = []; M.niveles = new Map(); M.muros = [];
  M.cargando = true; M.error = null; M.seleccionado = null; M.paso = 0;

  const d = document.createElement('div');
  d.id = 'mu-overlay';
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

        <div class="mu-px">
          <span>Precio ahora</span>
          <b id="mu-px-v">—</b>
        </div>

        <div class="mu-vivo"><i></i><span id="mu-estado">Observando…</span></div>

        <div class="mu-der">
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

      <div class="mu-cuerpo">
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

        <aside class="mu-panel" id="mu-panel">
          <div class="mu-panel-t">Órdenes detectadas</div>
          <div class="mu-chips">
            <button class="mu-fbtn verde" data-filtro="compra">
              <b>Soporte</b><i class="mu-cuenta" id="mu-n-compra">0</i>
            </button>
            <button class="mu-fbtn rojo" data-filtro="venta">
              <b>Resistencia</b><i class="mu-cuenta" id="mu-n-venta">0</i>
            </button>
            <button class="mu-fbtn oro" data-filtro="fuertes">
              <b>★ Fuertes</b><i class="mu-cuenta" id="mu-n-fuertes">0</i>
            </button>
            <button class="mu-fbtn gris" data-filtro="falsos">
              <b>✕ Falsas</b><i class="mu-cuenta" id="mu-n-falsos">0</i>
            </button>
          </div>
          <div class="mu-lista" id="mu-lista"></div>
        </aside>
      </div>
    </div>`;
  document.body.appendChild(d);

  const cerrar = () => {
    clearInterval(_reloj); clearInterval(_relojVelas);
    document.querySelectorAll('#mu-picker').forEach((x) => x.remove());
    const e = $('mu-overlay'); if (e) e.remove();
    /* Al cerrar se vuelve a la portada de Liquidity, no se sale. */
    try { if (window.__lqpVolver) window.__lqpVolver(); } catch (_) {}
  };
  d.querySelector('.mu-bg').onclick = cerrar;
  $('mu-x').onclick = cerrar;
  $('mu-ayuda').onclick = () => ayuda();
  $('mu-sel').onclick = (e) => { e.stopPropagation(); menuPares(); };

  $('mu-foto').onclick = () => guardarImagen();

  d.querySelectorAll('[data-tf]').forEach((b) => b.onclick = () => {
    M.tf = b.dataset.tf;
    d.querySelectorAll('[data-tf]').forEach((x) => x.classList.toggle('on', x.dataset.tf === M.tf));
    cargarVelas();
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

  let _t = null;
  window.addEventListener('resize', () => {
    clearTimeout(_t);
    _t = setTimeout(() => { if ($('mu-cv')) dibujar(); }, 250);
  });
}

/* ══════════════════════════════════════════════════════════════
   EL RELOJ — una foto cada 1,5 s
   ══════════════════════════════════════════════════════════════ */
let _reloj = null, _relojVelas = null;
let _fallos = 0;
let _huella = '';
let _ultPintado = 0;

/** Actualiza solo los números que cambian, sin rehacer las tarjetas.
 *  Así no parpadean. */
function refrescarNumeros() {
  M.muros.forEach((m) => {
    const b = document.querySelector(`[data-mp="${m.p}"]`);
    if (!b) return;
    const card = b.closest('.mu-card');
    if (!card) return;
    const pon = (sel, txt) => {
      const e = card.querySelector(sel);
      if (e && e.textContent !== txt) e.textContent = txt;
    };
    const esVenta = m.p > M.precio;
    pon('.mu-imp', dinero(m.v));
    pon('.mu-firme', tiempo(m.segundos));
    pon('.mu-dist2', (Math.abs(m.dist) * 100).toFixed(2) + '% ' + (esVenta ? '↑' : '↓'));
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
      M.velas = await traerVelas(par.s, M.tf, 400);
      dibujar();
    } catch (_) {}
  };
  await traer();
  _relojVelas = setInterval(traer, 12000);
}

function arrancar() {
  clearInterval(_reloj);
  _fallos = 0;
  const tomar = async () => {
    if (!$('mu-cv')) { clearInterval(_reloj); return; }
    try {
      const par = PARES.find((p) => p.id === _par) || PARES[0];
      const foto = await traerLibro(par.s);
      procesar(foto);
      _fallos = 0;
      M.cargando = M.fotos.length < MIN_TOMAS;
      M.error = null;
      M.maxMuro = Math.max(1, ...M.muros.map((x) => x.v));
      const px = $('mu-px-v');
      if (px) px.textContent = fmt(M.precio);
      dibujar();

      /* [CORREGIDO] El panel se repintaba entero en cada toma, y por
         eso las tarjetas parpadeaban. Ahora solo se reconstruye si de
         verdad cambió algo relevante: qué muros hay y en qué estado. */
      /* [CORREGIDO] La huella incluía el importe, que cambia en cada
         foto: por eso el panel se repintaba siempre y las tarjetas
         parpadeaban. Ahora solo cuenta QUÉ muros hay y en qué estado.
         Los números se actualizan sin tocar el HTML. */
      /* [CORREGIDO de nuevo] Aún parpadeaba: la huella cambiaba porque
         el orden de la lista bailaba entre tomas. Ahora se ordena
         antes de comparar, y además hay una espera mínima de 3
         segundos entre repintados: si un muro entra y sale, el panel
         no se reconstruye a cada segundo. */
      const huella = M.muros.map((m) => `${m.p.toFixed(6)}|${m.tipo}`).sort().join(',');
      const ahora2 = Date.now();
      if (huella !== _huella && ahora2 - _ultPintado > 3000) {
        _huella = huella; _ultPintado = ahora2;
        pintarPanel();
      } else {
        refrescarNumeros();
      }
    } catch (_) {
      /* Un fallo suelto no rompe nada: se sigue con lo que hay. Solo
         tras varios seguidos se avisa, porque entonces sí pasa algo. */
      _fallos++;
      if (_fallos >= 4) {
        M.error = 'Sin conexión con el mercado. Reintentando…';
        pintarPanel();
      }
    }
  };
  tomar();
  _reloj = setInterval(tomar, CADA);
}

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
        repintar: () => pintar()
      });
      _od = od;
      od.clicCancelar(cv, () => _zonasOd, () => pintar());
      pintar();
    }).catch(() => {});
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr)) {
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#0a0e14';
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

  const mDer = 88, mAba = 22;
  const x1 = W - mDer, y1 = H - mAba;
  const xVelas = x1 * 0.82;      // las velas ocupan casi todo

  /* La ventana visible: el ancho es el zoom y el desplazamiento el
     arrastre. Muestra SIEMPRE `ancho` velas completas (sin aplastar ni
     dejar telón), con un respiro del 15% a la derecha. */
  const ancho = Math.min(M.velas.length, M.ancho || 70);
  const huecoMax = Math.floor(ancho * 0.15);
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
  if (desp === 0 && M.precio > 0) {
    const u = vis[vis.length - 1];
    u.c = M.precio;
    if (M.precio > u.h) u.h = M.precio;
    if (M.precio < u.l) u.l = M.precio;
  }

  /* El rango abarca velas Y muros: si un muro queda fuera de pantalla,
     el usuario no puede usarlo. */
  let pAlto = Math.max(...vis.map((v) => v.h));
  let pBajo = Math.min(...vis.map((v) => v.l));
  M.muros.forEach((m) => { if (m.p > pAlto) pAlto = m.p; if (m.p < pBajo) pBajo = m.p; });
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
  M._geo = { pMin, pMax, y1 };

  /* Tus órdenes y alertas, con el estilo común de las tres. */
  if (_od) {
    _zonasOd = _od.pintar(g, {
      x1, Y, pMin, pMax,
      simbolo: (PARES.find((p) => p.id === _par) || {}).s || ''
    });
  }

  /* ── Rejilla ── */
  g.strokeStyle = 'rgba(255,255,255,.03)';
  g.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const y = (y1 / 6) * i;
    g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke();
  }

  /* ══════════════════════════════════════════════════════════
     LOS MUROS — cada uno con su línea y su importe

     Esto es lo que convierte el gráfico en herramienta: ver la
     cantidad escrita al nivel exacto donde está puesta.
     ══════════════════════════════════════════════════════════ */
  M.muros.forEach((m) => {
    if (m.p < pMin || m.p > pMax) return;
    const y = Y(m.p);
    const c = COLORES[m.tipo];
    const sel = M.seleccionado === m.p;

    /* [CORREGIDO] El color venía del veredicto, y por eso todas salían
       azules. En el gráfico manda el LADO: rojo si es venta, verde si
       es compra. Sin confirmar quedan grises, como en las tarjetas. */
    const sinProbar = m.tipo === 'vigilando' || m.tipo === 'ido';
    const col = sinProbar ? '#6b7681' : (m.p > M.precio ? '#f6465d' : '#2ee86a');

    // La banda: su grosor dice cuánto dinero hay
    const alto = Math.max(4, Math.min(18, (m.v / (M.maxMuro || m.v)) * 18));
    g.fillStyle = col + (sel ? '3a' : '1e');
    g.fillRect(0, y - alto / 2, x1, alto);

    g.strokeStyle = col;
    g.lineWidth = sel ? 2.2 : 1.4;
    if (m.tipo === 'falso' || m.tipo === 'vigilando' || m.tipo === 'ido') g.setLineDash([7, 5]);
    g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke();
    g.setLineDash([]);

    // La etiqueta con el importe
    const et = dinero(m.v);
    g.font = 'bold 11px ui-monospace,monospace';
    const wCaja = g.measureText(et).width + 32;
    g.fillStyle = col;
    redondeado(g, xVelas + 12, y - 10, wCaja, 20, 5); g.fill();
    g.fillStyle = sinProbar ? '#0b0e12' : (m.p > M.precio ? '#2a0509' : '#04210f');
    g.font = 'bold 10px system-ui,sans-serif';
    g.textAlign = 'center';
    g.fillText(c.icono, xVelas + 23, y + 3.5);
    g.font = 'bold 11px ui-monospace,monospace';
    g.textAlign = 'left';
    g.fillText(et, xVelas + 33, y + 4);
  });

  /* ── LAS VELAS ── */
  const paso = xVelas / vis.length;
  const cuerpo = Math.max(1.6, paso * 0.6);
  vis.forEach((v, i) => {
    const x = i * paso + paso / 2;
    const col = v.c >= v.o ? '#26a69a' : '#ef5350';
    g.strokeStyle = col; g.fillStyle = col;
    g.lineWidth = Math.max(1, paso * 0.12);
    g.beginPath(); g.moveTo(x, Y(v.h)); g.lineTo(x, Y(v.l)); g.stroke();
    const yA = Y(Math.max(v.o, v.c)), yB = Y(Math.min(v.o, v.c));
    g.fillRect(x - cuerpo / 2, yA, cuerpo, Math.max(1.4, yB - yA));
  });

  /* ── El precio actual ── */
  const yP = Y(M.precio);
  g.strokeStyle = 'rgba(232,184,75,.9)';
  g.setLineDash([6, 4]); g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(0, yP); g.lineTo(x1, yP); g.stroke();
  g.setLineDash([]);

  /* ── La escala, con los niveles marcados ── */
  g.fillStyle = 'rgba(10,14,20,.94)';
  g.fillRect(x1, 0, mDer, H);
  g.strokeStyle = 'rgba(255,255,255,.06)';
  g.beginPath(); g.moveTo(x1 + .5, 0); g.lineTo(x1 + .5, H); g.stroke();

  g.font = '10px ui-monospace,monospace';
  g.textAlign = 'left';
  for (let i = 0; i <= 6; i++) {
    const p = pMin + (pMax - pMin) * (i / 6);
    const y = Y(p);
    if (Math.abs(y - yP) < 15) continue;
    if (M.muros.some((m) => Math.abs(Y(m.p) - y) < 15)) continue;
    g.fillStyle = '#4a525c';
    g.fillText(fmt(p), x1 + 7, y + 3.5);
  }
  M.muros.forEach((m) => {
    if (m.p < pMin || m.p > pMax) return;
    const y = Y(m.p);
    const sinProbar = m.tipo === 'vigilando' || m.tipo === 'ido';
    const col = sinProbar ? '#6b7681' : (m.p > M.precio ? '#f6465d' : '#2ee86a');
    g.fillStyle = col;
    redondeado(g, x1 + 2, y - 9, mDer - 5, 18, 4); g.fill();
    g.fillStyle = sinProbar ? '#0b0e12' : (m.p > M.precio ? '#2a0509' : '#04210f');
    g.font = 'bold 10px ui-monospace,monospace';
    g.fillText(fmt(m.p), x1 + 7, y + 3.5);
  });
  g.fillStyle = '#E8B84B';
  redondeado(g, x1 + 2, yP - 11, mDer - 5, 22, 5); g.fill();
  g.fillStyle = '#2a1c00';
  g.font = 'bold 12px ui-monospace,monospace';
  g.fillText(fmt(M.precio), x1 + 7, yP + 4);

  /* ── Las horas ── */
  g.fillStyle = 'rgba(10,14,20,.94)';
  g.fillRect(0, y1, W, mAba);
  g.font = '9px ui-monospace,monospace';
  g.fillStyle = '#4a525c';
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
}

/* ══════════════════════════════════════════════════════════════
   GESTOS — acercar y alejar

   El libro es estrecho: sin poder acercarse, los muros próximos al
   precio se amontonan. La rueda y el pellizco cambian el rango que
   se muestra; el doble clic vuelve a verlo todo.
   ══════════════════════════════════════════════════════════════ */
function engancharGestos(cv) {
  const zoom = (f) => {
    M.ancho = Math.max(20, Math.min(140, Math.round((M.ancho || 70) * f)));
    dibujar();
  };

  /* [MEJORADO] El arrastre solo movía en el tiempo y no se podía
     despegar del borde. Ahora es igual que en Smart Levels: se
     agarra el gráfico y se lleva en los dos ejes. */
  let ax = 0, ay = 0, arr = false, modoG = 'libre';
  const enEscalaM = (x) => x > cv.clientWidth - 95;

  cv.addEventListener('mousedown', (e) => {
    const r = cv.getBoundingClientRect();
    modoG = enEscalaM(e.clientX - r.left) ? 'y' : 'libre';
    arr = true; ax = e.clientX; ay = e.clientY;
    cv.style.cursor = modoG === 'y' ? 'ns-resize' : 'grabbing';
  });
  window.addEventListener('mousemove', (e) => {
    if (!arr) return;
    if (modoG === 'y') {
      const dy = e.clientY - ay;
      if (Math.abs(dy) > 2) {
        M.zoomY = Math.max(0.25, Math.min(4, (M.zoomY || 1) * (1 + dy * 0.004)));
        ay = e.clientY; dibujar();
      }
      return;
    }
    let cambio = false;
    const paso = (cv.clientWidth * 0.7) / (M.ancho || 70);
    const mov = Math.round((e.clientX - ax) / Math.max(1, paso));
    if (mov !== 0) {
      const tope = Math.max(0, M.velas.length - (M.ancho || 70));
      const suelo = -Math.floor((M.ancho || 70) * 0.15);   // respiro a la derecha
      M.desplaz = Math.max(suelo, Math.min(tope, (M.desplaz || 0) + mov));
      ax = e.clientX; cambio = true;
    }
    const dy = e.clientY - ay;
    if (Math.abs(dy) > 1) {
      M.offsetY = (M.offsetY || 0) + dy;
      ay = e.clientY; cambio = true;
    }
    if (cambio) dibujar();
  });
  window.addEventListener('mouseup', () => { arr = false; cv.style.cursor = 'crosshair'; });

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
      M.zoomY = Math.max(0.25, Math.min(4, (M.zoomY || 1) * (e.deltaY > 0 ? 1.12 : 0.9)));
      dibujar();
    } else {
      zoom(e.deltaY > 0 ? 1.14 : 0.88);
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
    if (e.touches.length === 1) { tx = e.touches[0].clientX; arr = true; }
    else if (e.touches.length === 2) {
      arr = false;
      d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                      e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && arr) {
      e.preventDefault();
      const paso = (cv.clientWidth * 0.7) / (M.ancho || 70);
      const mov = Math.round((e.touches[0].clientX - tx) / Math.max(1, paso));
      if (mov !== 0) {
        const tope = Math.max(0, M.velas.length - (M.ancho || 70));
        const sueloT = -Math.floor((M.ancho || 70) * 0.15);
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
  cv.addEventListener('touchend', () => { arr = false; d0 = 0; });

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
  const cerca = dist < 0.12, muyCerca = dist < 0.05;

  if (m.tipo === 'falso') {
    return 'Se retira cada vez que el precio se acerca. <b>Es humo</b>: no cuente con este nivel.';
  }
  if (m.tipo === 'ido') {
    return 'La orden <b>ya no está</b>. Ese nivel quedó sin defensa: el precio puede pasar de largo.';
  }
  if (m.consumidoPct > 0.75 && cerca) {
    return `<b>Se está ejecutando ahora mismo.</b> Ya se ha comido el ${Math.round(m.consumidoPct * 100)}% de la orden. ` +
           (esVenta ? 'Si termina, el techo cae.' : 'Si termina, el suelo cede.');
  }
  if (muyCerca) {
    return `<b>El precio está tocando este nivel.</b> ${dinero(m.v)} ${esVenta ? 'en venta' : 'en compra'} esperando. ` +
           (esVenta ? 'Aquí se decide si rompe o rebota.' : 'Aquí se decide si aguanta o cede.');
  }
  if (cerca) {
    return `El precio se está acercando: solo un <b>${dist.toFixed(2)}%</b> ${esVenta ? 'por debajo' : 'por encima'}. Atento a lo que pase al llegar.`;
  }
  if (m.recargas >= 2) {
    return `Ya se la han comido <b>${m.recargas} veces</b> y la han vuelto a poner. Alguien grande insiste en defender ${fmt(m.p)}.`;
  }
  const fuerte = m.tipo === 'recargable' || m.tipo === 'probado' || (m.tipo === 'real' && m.segundos > 240);
  if (fuerte) {
    return esVenta
      ? `Lleva ${tiempo(m.segundos)} defendiendo ${fmt(m.p)}. Alta probabilidad de <b>rechazo</b> si el precio sube ahí.`
      : `Lleva ${tiempo(m.segundos)} sosteniendo ${fmt(m.p)}. Alta probabilidad de <b>rebote</b> si el precio cae ahí.`;
  }
  if (m.tipo === 'real') {
    return `${dinero(m.v)} ${esVenta ? 'en venta' : 'en compra'} esperando. Aún sin probar: veremos cuando el precio llegue.`;
  }
  return `Orden recién puesta hace ${tiempo(m.segundos)}. Todavía no sabemos si va en serio.`;
}

function pintarPanel() {
  const lista = $('mu-lista'); if (!lista) return;
  const estado = $('mu-estado');

  /* Las cuentas de cada filtro, siempre visibles. */
  const cuenta = (id, f) => {
    const el = $('mu-n-' + id);
    if (el) el.textContent = M.muros.filter(f).length;
  };
  cuenta('compra', (m) => m.p <= M.precio);
  cuenta('venta', (m) => m.p > M.precio);
  cuenta('fuertes', (m) => m.tipo === 'recargable' || m.tipo === 'probado');
  cuenta('falsos', (m) => m.tipo === 'falso' || m.tipo === 'ido');

  if (M.error) { if (estado) estado.textContent = M.error; return; }

  if (M.cargando) {
    if (estado) estado.textContent = `${M.fotos.length}/${MIN_TOMAS}`;
    lista.innerHTML = `<div class="mu-esperar">Analizando el libro de órdenes…</div>`;
    return;
  }
  if (estado) estado.textContent = 'En directo';

  /* El filtro. Sin ninguno activo se ven todas. */
  let lst = M.muros.slice();
  if (M.filtro === 'fuertes') lst = lst.filter((m) => m.tipo === 'recargable' || m.tipo === 'probado');
  else if (M.filtro === 'compra') lst = lst.filter((m) => m.p <= M.precio);
  else if (M.filtro === 'venta') lst = lst.filter((m) => m.p > M.precio);
  else if (M.filtro === 'falsos') lst = lst.filter((m) => m.tipo === 'falso' || m.tipo === 'ido');

  if (!lst.length) {
    lista.innerHTML = `<div class="mu-esperar">
      <b>${M.filtro === 'todos' ? 'Libro tranquilo' : 'Nada de ese tipo'}</b>
      ${M.filtro === 'todos'
        ? 'Nadie está poniendo órdenes grandes en ' + esc(_par) + ' ahora mismo.'
        : 'Pruebe con otro filtro o quítelo para ver todas.'}
    </div>`;
    return;
  }

  const tarjeta = (m, id) => {
    const c = COLORES[m.tipo];
    const esVenta = m.p > M.precio;
    const pct = (Math.abs(m.dist) * 100).toFixed(2);

    let fuerza = 0;
    if (m.tipo === 'recargable' || m.tipo === 'probado') fuerza = 3;
    else if (m.tipo === 'real') fuerza = m.segundos > 240 ? 3 : 2;
    else if (m.tipo === 'vigilando') fuerza = 1;

    /* ══════════════════════════════════════════════════════════
       EL NARRADOR

       El texto no describe un estado fijo: cuenta lo que está
       pasando AHORA. Cambia según la distancia del precio, y cuando
       se acerca sube la tensión, como un comentarista.
       ══════════════════════════════════════════════════════════ */
    const dist = Math.abs(m.dist) * 100;
    const cerca = dist < 0.12;
    const muyCerca = dist < 0.05;
    const conse = narrar(m, esVenta, dist);

    const queHacer = (m.tipo === 'recargable' || m.tipo === 'probado')
      ? (esVenta ? 'Buen sitio para recoger beneficios si va largo.' : 'Buen sitio para colocar su stop justo por debajo.')
      : m.tipo === 'falso' ? 'Si su plan dependía de este nivel, revíselo.'
      : 'Déle unos minutos más para tener veredicto.';

    /* La tarjeta: lo esencial en dos líneas, el resto se despliega. */
    const abierta = M.seleccionado === m.p;
    return `
    <div class="mu-card ${c.clase} f${fuerza} ${abierta ? 'sel' : ''}"
         data-id="${id}" data-lado="${esVenta ? 'venta' : 'compra'}">
      <button class="mu-cab-card" data-mp="${m.p}">
        <div class="mu-l1">
          <span class="mu-lado">${esVenta ? 'EN VENTA' : 'EN COMPRA'}</span>
          <span class="mu-imp">${dinero(m.v)}</span>
        </div>
        <div class="mu-l2">
          <span class="mu-nivel">${fmt(m.p)}</span>
          <span class="mu-dist2 ${muyCerca ? 'urge' : cerca ? 'cerca' : ''}">${pct}% ${esVenta ? '↑' : '↓'}</span>
          <span class="mu-sello">${c.icono} ${esc(c.nom || '')}</span>
          <span class="mu-fl">${abierta ? '▲' : '▼'}</span>
        </div>
        ${muyCerca ? '<div class="mu-aviso-vivo">● El precio está tocando este nivel</div>' : ''}
      </button>
      ${abierta ? `<div class="mu-detalle">
        <div class="mu-conse mu-escribe">${conse}</div>
        <div class="mu-metricas">
          <div><b class="mu-firme">${tiempo(m.segundos)}</b><span>firme</span></div>
          <div><b class="mu-rec-n">${m.recargas || 0}×</b><span>repuesta</span></div>
          <div><b class="mu-eje-n">${Math.round(Math.min(100, m.consumidoPct * 100))}%</b><span>ejecutado</span></div>
          <div><b>${'●'.repeat(fuerza)}${'○'.repeat(3 - fuerza)}</b><span>fuerza</span></div>
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
function actualizar(card, m) {
  const c = COLORES[m.tipo];
  const esVenta = m.p > M.precio;
  const dist = Math.abs(m.dist) * 100;

  const pon = (sel, txt) => {
    const e = card.querySelector(sel);
    if (e && e.textContent !== txt) e.textContent = txt;
  };
  const clase = (sel, cl, si) => {
    const e = card.querySelector(sel);
    if (e) e.classList.toggle(cl, si);
  };

  pon('.mu-imp', dinero(m.v));
  pon('.mu-nivel', fmt(m.p));
  pon('.mu-dist2', dist.toFixed(2) + '% ' + (esVenta ? '↑' : '↓'));
  pon('.mu-sello', c.icono + ' ' + (c.nom || ''));
  pon('.mu-lado', esVenta ? 'EN VENTA' : 'EN COMPRA');

  // El veredicto puede cambiar: la tarjeta cambia de color con él
  ['oro', 'verde', 'azul', 'rojo', 'gris', 'ido'].forEach((k) => {
    card.classList.toggle(k, k === c.clase);
  });
  card.dataset.lado = esVenta ? 'venta' : 'compra';

  clase('.mu-dist2', 'cerca', dist < 0.12 && dist >= 0.05);
  clase('.mu-dist2', 'urge', dist < 0.05);

  // El detalle, si está abierto
  const det = card.querySelector('.mu-detalle');
  if (det) {
    pon('.mu-firme', tiempo(m.segundos));
    const rec = card.querySelector('.mu-rec-n');
    if (rec) rec.textContent = (m.recargas || 0) + '×';
    const eje = card.querySelector('.mu-eje-n');
    if (eje) eje.textContent = Math.round(Math.min(100, m.consumidoPct * 100)) + '%';

    /* El narrador: solo se reescribe si el mensaje cambió, y entonces
       se reanima. Así el efecto de escritura marca los momentos que
       importan en vez de repetirse cada segundo. */
    const cn = card.querySelector('.mu-conse');
    const txt = narrar(m, esVenta, dist);
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

const CLAVE_LOGOS = 'aurex-logos';
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
    t: 'El libro de órdenes miente',
    d: 'En cualquier exchange puede ver las órdenes de compra y venta esperando. Lo que no le dicen es que <b>la mayoría de las grandes son falsas</b>: se ponen para asustar y se retiran justo cuando el precio se acerca.',
    x: 'Un trader que persigue esas órdenes pierde dinero de forma sistemática.'
  },
  {
    t: 'Nosotros las vigilamos',
    d: 'Tomamos una foto del libro <b>cada segundo y medio</b> y seguimos la vida de cada orden grande: cuánto lleva puesta, si se ha ejecutado, si desapareció y volvió.',
    x: 'Ningún exchange guarda esa historia. Ahí está la diferencia.'
  },
  {
    t: 'La tarjeta le dice qué es',
    d: 'Cada orden grande genera una tarjeta con <b>cuánto dinero hay</b>, <b>a qué precio</b> y <b>a qué distancia</b> del precio actual. Roja si es venta, verde si es compra.',
    x: 'Toque la tarjeta para desplegar el detalle completo.'
  },
  {
    t: '★ Orden blindada',
    d: 'La señal más fuerte que existe. La orden <b>se consume y vuelve a aparecer</b> al mismo precio, una y otra vez.',
    x: 'Es alguien grande reponiendo su posición para no mover el mercado. Ese nivel casi siempre aguanta: buen sitio para su stop.'
  },
  {
    t: '✓ Nivel probado',
    d: 'El precio ya llegó hasta ahí y <b>la orden lo frenó</b>, comiéndose parte del flujo que venía.',
    x: 'Tiene defensa demostrada. Si vuelve, es probable que reaccione igual.'
  },
  {
    t: '● Orden firme',
    d: 'Lleva mucho tiempo sin moverse, pero <b>el precio todavía no lo ha puesto a prueba</b>.',
    x: 'La constancia es buena señal, pero espere a ver qué pasa cuando llegue.'
  },
  {
    t: '✕ Orden falsa',
    d: 'Lo hemos visto <b>huir cuando el precio se acerca</b> y volver cuando se aleja. Esa orden nunca se ejecuta.',
    x: 'No la use como referencia. Si su plan dependía de ese nivel, revíselo.'
  },
  {
    t: 'Por qué cambian de estado',
    d: 'Una orden puede pasar de falsa a fiable, o al revés. <b>El mercado cambia y el veredicto también.</b>',
    x: 'Si una orden que huía empieza a reponerse, sube de categoría. Es información viva, no una etiqueta fija.'
  },
  {
    t: 'El texto le cuenta qué pasa',
    d: 'La descripción de cada tarjeta <b>cambia sola</b> según lo que ocurre: le avisa cuando el precio se acerca, cuando está tocando el nivel y cuando la orden se está ejecutando.',
    x: 'Como un comentarista: no tiene que estar mirando los números.'
  },
  {
    t: 'Cómo sacarle partido',
    d: 'Busque <b>desequilibrios</b>: si hay tres muros fuertes debajo y ninguno arriba, el camino de menor resistencia es hacia arriba.',
    x: 'Opere a favor del lado vacío, no contra el lado defendido.'
  },
  {
    t: 'Combínelo con Liquidity Pools',
    d: 'El mapa de liquidaciones dice <b>hacia dónde</b> quiere ir el precio. Esta herramienta dice <b>qué lo está frenando ahora</b>.',
    x: 'Un muro falso justo delante de un imán de liquidez es de las señales más claras que va a encontrar.'
  },
  {
    t: 'Una última cosa',
    d: 'Esto es <b>información, no una señal</b>. Le decimos qué es real y qué es humo, con datos del libro de Binance.',
    x: 'La decisión de entrar o salir sigue siendo suya. Nosotros le quitamos la venda.'
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
      <div class="mua-eyebrow">Lógica Estructural Avanzada</div>
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
  #mu-overlay{position:fixed;inset:0;z-index:9740;display:flex;align-items:center;justify-content:center}
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
  #mu-overlay .mu-vivo{display:flex;align-items:center;gap:7px;min-width:0;
    font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;
    text-transform:uppercase;letter-spacing:.7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #mu-overlay .mu-vivo i{width:7px;height:7px;border-radius:50%;background:#2ee86a;flex:0 0 auto;
    animation:muLat 1.8s ease-in-out infinite}
  @keyframes muLat{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(46,232,106,.5)}50%{opacity:.55;box-shadow:0 0 0 5px rgba(46,232,106,0)}}
  /* Temporalidad y precio en la barra */
  #mu-overlay .mu-tfs{display:flex;gap:2px;flex:0 0 auto;padding:3px;background:#12161c;border-radius:9px}
  #mu-overlay .mu-tf{min-height:30px;padding:0 11px;border-radius:7px;border:none;background:transparent;
    color:#7d8794;font-family:var(--mono,monospace);font-size:11px;font-weight:700;cursor:pointer}
  #mu-overlay .mu-tf.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800}
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
    display:flex;gap:6px;background:#0b0e12;padding-left:8px}
  #mu-overlay .mu-ico{width:36px;height:36px;min-height:36px;flex:0 0 auto;border-radius:10px;
    display:grid;place-items:center;padding:0;cursor:pointer;
    background:rgba(255,255,255,.05);border:1px solid #2b3139;color:#8b96a3;
    font-family:var(--mono,monospace);font-size:14px;font-weight:700}
  #mu-overlay .mu-ico:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
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
    font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:1.8px}
  #mu-overlay .mu-lista{flex:1;overflow-y:auto;padding:10px}
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

  /* La tarjeta de venta se tiñe de rojo oscuro: contraste con el
     dorado del importe. */
  #mu-overlay .mu-card[data-lado="venta"]{border-left-color:#f6465d}
  #mu-overlay .mu-card[data-lado="compra"]{border-left-color:#2ee86a}
  #mu-overlay .mu-card[data-lado="venta"].f3{
    background:linear-gradient(145deg,rgba(120,20,32,.5),rgba(60,10,18,.22));
    border-color:rgba(246,70,93,.42);box-shadow:0 4px 16px rgba(0,0,0,.45)}
  #mu-overlay .mu-card[data-lado="compra"].f3{
    background:linear-gradient(145deg,rgba(12,90,50,.42),rgba(6,44,26,.2));
    border-color:rgba(46,232,106,.4);box-shadow:0 4px 16px rgba(0,0,0,.45)}
  #mu-overlay .mu-card[data-lado="venta"].f2{background:linear-gradient(145deg,rgba(120,20,32,.22),rgba(255,255,255,.012))}
  #mu-overlay .mu-card[data-lado="compra"].f2{background:linear-gradient(145deg,rgba(12,90,50,.2),rgba(255,255,255,.012))}
  #mu-overlay .mu-card.f0{opacity:.66}
  #mu-overlay .mu-card.sel{border-color:var(--gold-soft,#C9A84B)}

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
  #mu-overlay .mu-metricas{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:9px}
  #mu-overlay .mu-metricas div{text-align:center;padding:7px 3px;border-radius:8px;
    background:rgba(255,255,255,.035)}
  #mu-overlay .mu-metricas b{display:block;font-family:var(--mono,monospace);font-weight:700;
    font-size:12px;color:#eaecef}
  #mu-overlay .mu-metricas span{font-family:var(--mono,monospace);font-size:8.5px;color:#5c6672;
    text-transform:uppercase;letter-spacing:.5px}

  /* Los cuatro botones de filtro */
  #mu-overlay .mu-fbtn{flex:1;min-width:calc(50% - 4px);min-height:40px;padding:0 12px;
    border-radius:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;
    background:rgba(255,255,255,.035);border:1px solid #232a33;
    font-family:var(--display,sans-serif);font-weight:700;font-size:12.5px;color:#8b96a3}
  #mu-overlay .mu-fbtn .mu-cuenta{font-family:var(--mono,monospace);font-size:10px;font-style:normal;
    min-width:19px;padding:1px 5px;border-radius:20px;background:rgba(255,255,255,.08);color:#b7bdc6}
  #mu-overlay .mu-fbtn.verde{border-color:rgba(46,232,106,.28);color:#3ee88a}
  #mu-overlay .mu-fbtn.rojo{border-color:rgba(246,70,93,.28);color:#ff6b7a}
  #mu-overlay .mu-fbtn.oro{border-color:rgba(232,184,75,.28);color:#E8B84B}
  #mu-overlay .mu-fbtn.gris{border-color:#2b3139;color:#8b96a3}
  /* El filtro activo tiene que verse a la primera. */
  #mu-overlay .mu-fbtn.on{border-width:2px;font-weight:800;transform:translateY(-1px)}
  #mu-overlay .mu-fbtn.verde.on{background:linear-gradient(180deg,#4dffa0,#1fc96e);
    border-color:#2ee86a;color:#04210f;box-shadow:0 3px 12px rgba(46,232,106,.3)}
  #mu-overlay .mu-fbtn.verde.on .mu-cuenta{background:rgba(0,0,0,.25);color:#04210f}
  #mu-overlay .mu-fbtn.rojo.on{background:linear-gradient(180deg,#ff8a95,#e03546);
    border-color:#f6465d;color:#2a0509;box-shadow:0 3px 12px rgba(246,70,93,.3)}
  #mu-overlay .mu-fbtn.rojo.on .mu-cuenta{background:rgba(0,0,0,.25);color:#2a0509}
  #mu-overlay .mu-fbtn.oro.on{background:linear-gradient(180deg,#f7db8d,#E8B84B);
    border-color:#E8B84B;color:#3a2800;box-shadow:0 3px 12px rgba(232,184,75,.3)}
  #mu-overlay .mu-fbtn.oro.on .mu-cuenta{background:rgba(0,0,0,.22);color:#3a2800}
  #mu-overlay .mu-fbtn.gris.on{background:linear-gradient(180deg,#b7bdc6,#8b96a3);
    border-color:#b7bdc6;color:#0b0e12}
  #mu-overlay .mu-fbtn.gris.on .mu-cuenta{background:rgba(0,0,0,.2);color:#0b0e12}

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
  #mu-ayuda-box{position:fixed;inset:0;z-index:9770;display:flex;align-items:center;justify-content:center;padding:16px}
  #mu-ayuda-box .mu-bg{position:absolute;inset:0;background:rgba(3,5,8,.93)}
  #mu-ayuda-box .mua-c{position:relative;width:100%;max-width:560px;max-height:calc(100vh - 32px);
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

  /* ── Móvil: el panel pasa abajo ── */
  @media(max-width:860px){
    #mu-overlay .mu-cuerpo{flex-direction:column}
    #mu-overlay .mu-graf{flex:0 0 auto;height:46vh;min-height:230px}
    #mu-overlay .mu-panel{width:100%;flex:1;min-height:0;border-left:none;border-top:1px solid #1c2128}
    #mu-overlay .mu-barra{padding:8px 92px 8px 10px;gap:9px}
    #mu-overlay .mu-vivo span{display:none}
    #mu-overlay .mu-marca{height:24px;left:10px;bottom:26px}
    #mu-overlay .mu-precio{font-size:19px}
    #mu-ayuda-box .mua-c{padding:20px 14px}
    #mu-ayuda-box .mua-tabs{margin-right:46px;flex-direction:column}
  }`;
  document.head.appendChild(s);
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
      g.fillText('Lógica Estructural Avanzada · Flujo de Órdenes', x, yB + 34 * e2);
      g.font = `700 ${14 * e2}px ui-monospace,monospace`;
      g.fillStyle = '#C9A84B';
      g.fillText('DecFreedom.com', x, yB + 56 * e2);
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
