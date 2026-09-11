/* ══════════════════════════════════════════════════════════════════════════
   PORTADA · comportamiento
   ══════════════════════════════════════════════════════════════════════════

   Lo que hace, por orden de importancia:

     1. Abre las ventanas de la app AQUÍ MISMO (swap, market, liquidity,
        tools, academy, prize pool, perfil). No se copia ni se reescribe
        nada: se importan los módulos que ya funcionan dentro.
     2. Pinta la ficha de wallet con el MISMO markup de la app, así que
        sale el logo de tu wallet y las cuatro últimas cifras, exactamente
        igual que dentro.
     3. Cabecera, aparición al bajar, precios reales, motas, inercia,
        buscador y botón de instalar.

   Cada bloque va en su propio try/catch: si uno falla, los demás siguen.
   Antes bastaba con que algo reventara temprano para que se cayera todo
   lo que venía detrás (por eso no aparecían las motas).
   ══════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════
   LA RUTA, BIEN CALCULADA
   Este archivo vive en /assets/portada/. Un import relativo como
   './assets/js/wallet.js' se resuelve respecto AL ARCHIVO, no a la
   página: buscaba /assets/portada/assets/js/wallet.js, que no existe.
   Por eso fallaban TODOS los imports y cada clic acababa saltando a
   app.html. Se calcula desde la raíz del sitio y se acabó el problema.
   ══════════════════════════════════════════════════════════════════════ */
const J = new URL('assets/js/', document.baseURI).href;
import { brasas } from './chispas.js?v=200';
const $ = (id) => document.getElementById(id);
const quieto = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;


/* ══════════════════════════════════════════════════════════════════════
   1 · LAS VENTANAS DE LA APP, AQUÍ FUERA
   ══════════════════════════════════════════════════════════════════════

   POR QUÉ FUNCIONA
   Ninguno de estos módulos necesita el contenedor de los bots: cada uno
   inyecta sus propios estilos y cuelga su ventana de <body>. Lo único que
   les faltaba aquí era la hoja base (gridbot/estilos.js), que va colgada
   de #colmena-app; por eso a <body> se le pone ese id. Esa hoja solo
   define variables de color y toca <input> y <select>, así que no puede
   desordenar la portada, que vive aislada dentro de #pt.

   SI ALGO FALLA
   Cada enlace conserva su href real a app.html?abrir=… El clic solo se
   intercepta cuando la ventana se ha podido abrir de verdad.
   ══════════════════════════════════════════════════════════════════════ */

let baseLista = false;
let W = null;

/* Carga de logos y precios desde CoinGecko, para que el swap y las listas
   muestren los iconos reales en vez de la inicial de la moneda. Es la misma
   lógica de gridbot-ui.js (cargarLogosPrecios), reescrita para la portada:
   rellena el MISMO objeto LOGOS de gridbot/estado.js que consume el swap. */
let _logosOK = false, _logosEnCurso = false;
async function cargarLogosPrecios() {
  if (_logosOK || _logosEnCurso) return;
  _logosEnCurso = true;
  try {
    const [{ LOGOS }, { moneda }, { BASES, QUOTES }] = await Promise.all([
      import(J + 'gridbot/estado.js?v=1'),
      import(J + 'gridbot/util.js?v=1'),
      import(J + 'gridbot/config.js?v=1')
    ]);
    const ids = [...new Set([...BASES, ...QUOTES].map((id) => moneda(id) && moneda(id).cg).filter(Boolean))];
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids='
              + ids.join(',') + '&per_page=250&price_change_percentage=24h';
    const r = await fetch(url);
    if (!r.ok) throw new Error('cg ' + r.status);
    const arr = await r.json();
    const byCg = {}; arr.forEach((c) => { byCg[c.id] = c; });
    [...BASES, ...QUOTES].forEach((id) => {
      const c = byCg[moneda(id) && moneda(id).cg];
      if (c) LOGOS[id] = { img: c.image, price: c.current_price, chg: c.price_change_percentage_24h };
    });
    _logosOK = true;
  } catch (e) { console.warn('[portada] logos:', e); }
  finally { _logosEnCurso = false; }
}

async function estiloBase() {
  if (baseLista) return;
  const [est, util] = await Promise.all([
    import(J + 'gridbot/estilos.js?v=201'),
    import(J + 'gridbot/util.js?v=1')
  ]);
  // NO se toca el body. Antes se le ponía id='colmena-app' y eso aplicaba
  // los estilos de la app a TODA la portada, colapsando el hero y montando
  // la interfaz de bots encima. La hoja se inyecta igual; el ámbito
  // colmena-app se añade a un contenedor oculto para que las ventanas
  // modales (swap, wallet) tengan su contexto sin afectar a la portada.
  est.inyectarEstilo(util.tipoNum);
  if (!document.getElementById('cco-scope')) {
    const sc = document.createElement('div');
    sc.id = 'cco-scope';
    sc.className = 'colmena-app-scope';
    document.body.appendChild(sc);
  }
  baseLista = true;
}

async function wallet() {
  if (!W) W = await import(J + 'wallet.js?v=125');
  return W;
}

const PUERTAS = {
  swap: async () => {
    const m = await import(J + 'gridbot/swap.js?v=4');
    m.initSwap(conectar, cargarLogosPrecios);
    await cargarLogosPrecios();          // rellena los logos antes de abrir
    m.abrirSwap();
  },
  market:  async () => (await import(J + 'market.js?v=125')).abrirMarket(),
  liq:     async () => (await import(J + 'liquidity.js?v=126')).abrirLiquidity(),
  pools:   async () => (await import(J + 'liquidity.js?v=126')).abrirPools(),
  heat:    async () => (await import(J + 'muros.js?v=126')).abrirMuros(),
  levels:  async () => (await import(J + 'niveles.js?v=126')).abrirNiveles(),
  tools:   async (tid) => (await import(J + 'tools.js?v=128')).abrirTools(tid),
  academy: async () => (await import(J + 'academy.js?v=126')).abrirAcademy(),
  prize:   async () => (await import(J + 'prizepool.js?v=126')).abrirPrizePool(),
  aportar: async () => (await import(J + 'aportar.js?v=1')).abrirAportar(),
  perfil:  async () => (await import(J + 'perfil.js?v=125')).abrirPerfil()
};

/* Aviso visible. Sin esto un fallo se traga en la consola y desde fuera
   parece que la página simplemente no hace nada. */
function aviso(txt) {
  let c = document.getElementById('pt-aviso');
  if (!c) {
    c = document.createElement('div');
    c.id = 'pt-aviso';
    document.body.appendChild(c);
  }
  c.textContent = txt;
  c.classList.add('on');
  clearTimeout(aviso._t);
  aviso._t = setTimeout(() => c.classList.remove('on'), 7000);
}

let abriendo = false;

async function abrir(destino, enlace) {
  const puerta = PUERTAS[destino];
  if (!puerta) return false;
  if (abriendo) return true;
  abriendo = true;

  // Si el enlace apunta a una herramienta concreta de Tools, se pasa su id.
  const extra = enlace && enlace.getAttribute ? enlace.getAttribute('data-tool') : null;

  const antes = enlace ? enlace.style.opacity : '';
  if (enlace) enlace.style.opacity = '.55';

  // La hoja base va aparte: si fallara, la ventana se abre igual, solo
  // que con menos adorno. Vale más eso que no abrir nada.
  try { await estiloBase(); }
  catch (e) { console.warn('[portada] hoja base:', e); }

  try {
    await puerta(extra || undefined);
    return true;
  } catch (e) {
    console.error('[portada] no se pudo abrir "' + destino + '":', e);
    aviso('No se pudo abrir ' + destino + ': ' + (e && e.message ? e.message : e));
    return false;
  } finally {
    abriendo = false;
    if (enlace) enlace.style.opacity = antes;
  }
}

document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-abrir]');
  if (!a) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // pestaña nueva
  e.preventDefault();
  await abrir(a.getAttribute('data-abrir'), a);
});


/* ══════════════════════════════════════════════════════════════════════
   2 · LA FICHA DE WALLET
   ══════════════════════════════════════════════════════════════════════

   Se reutiliza el markup EXACTO de la app: <button class="dir"> con el
   logo de la wallet dentro y las cuatro últimas cifras de la dirección.
   Lo estiliza gridbot/estilos.js, la misma hoja que dentro, así que se ve
   idéntico. El logo se pide varias veces seguidas porque algunas wallets
   tardan en decir cuáles son: con un solo intento se perdía.
   ══════════════════════════════════════════════════════════════════════ */

const GENERICO = '<svg class="dir-logo" viewBox="0 0 24 24" width="14" height="14" fill="none"'
  + ' stroke="currentColor" stroke-width="1.9"><rect x="2" y="6" width="20" height="13" rx="3"/>'
  + '<path d="M16 12h.01"/></svg>';

let LOGOS = null;
try {
  ({ LOGOS_WALLET: LOGOS } = await import(J + 'gridbot/config.js?v=1'));
} catch (e) { console.warn('[portada] logos de wallet:', e); }

function iconoWallet(w) {
  try {
    const info = w.walletInfo ? w.walletInfo() : null;
    if (info && info.icon) return '<img class="dir-logo" src="' + info.icon + '" alt="">';
    if (info && info.clave && LOGOS && LOGOS[info.clave]) return LOGOS[info.clave];

    // Con MetaMask en escritorio walletInfo() suele venir vacío porque no
    // llega por EIP-6963. Se mira el proveedor, que siempre está.
    const p = window.ethereum;
    if (p && LOGOS) {
      const cual = p.isTrust || p.isTrustWallet ? 'trust'
                 : p.isPhantom            ? 'phantom'
                 : p.isCoinbaseWallet     ? 'coinbase'
                 : p.isBinance            ? 'binance'
                 : p.isRabby              ? 'rabby'
                 : p.isMetaMask           ? 'metamask'
                 : null;
      if (cual && LOGOS[cual]) return LOGOS[cual];
    }
  } catch (_) {}
  return GENERICO;
}

async function conectar() {
  try {
    const w = await wallet();
    await w.conectar();
  } catch (_) {}
  pintarWallet();
}

/* Desplegable de wallets: es el de gridbot-ui.js, copiado con su markup y
   sus clases. Se apoya en walletsDisponibles() y conectarCon(), que ya
   estaban exportadas. Reconstruirlo a mano fue el error anterior: por eso
   se perdía el listado de wallets del navegador y cuál estaba activa. */
const escT = (t) => String(t ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const QR_SVG = '<svg viewBox="0 0 32 32" width="18" height="18" fill="currentColor"><path d="M8.4 11.7c4.2-4.1 11-4.1 15.2 0l.5.5c.2.2.2.5 0 .7l-1.7 1.7c-.1.1-.3.1-.4 0l-.7-.7c-2.9-2.9-7.7-2.9-10.6 0l-.8.7c-.1.1-.3.1-.4 0L7.8 12.9c-.2-.2-.2-.5 0-.7l.6-.5zm18.8 3.5 1.5 1.5c.2.2.2.5 0 .7l-6.8 6.7c-.2.2-.5.2-.7 0L16.4 19c0-.1-.1-.1-.2 0l-4.8 4.8c-.2.2-.5.2-.7 0l-6.8-6.7c-.2-.2-.2-.5 0-.7l1.5-1.5c.2-.2.5-.2.7 0l4.8 4.8c.1.1.2.1.2 0l4.8-4.8c.2-.2.5-.2.7 0l4.8 4.8c.1.1.2.1.2 0l4.8-4.8c.2-.2.5-.2.7 0z"/></svg>';

async function selectorWallet(ancla) {
  const prev = $('wsel'); if (prev) { prev.remove(); return; }
  const w = await wallet();
  try { await estiloBase(); } catch (_) {}

  let lista = [];
  try { lista = w.walletsDisponibles ? w.walletsDisponibles() : []; } catch (_) {}

  const d = document.createElement('div');
  d.id = 'wsel';
  d.innerHTML = '<div class="wsel-bg"></div><div class="wsel-p"><div class="wsel-t">Tus wallets</div>'
    + lista.map((x) => '<button class="wsel-b ' + (x.activa ? 'on' : '') + '" data-w="' + escT(x.id) + '">'
        + (x.icono ? '<img src="' + escT(x.icono) + '" alt="">' : '<span class="wsel-i"></span>')
        + '<b>' + escT(x.nombre) + '</b>'
        + (x.activa ? '<span class="wsel-ok">Conectada</span>' : '') + '</button>').join('')
    + '<button class="wsel-b" data-wc="1"><span class="wsel-i wc">' + QR_SVG + '</span><b>Otra wallet (QR)</b></button>'
    + (lista.length === 0 ? '<div class="wsel-v">No hay wallets en este navegador. Usa la opción de arriba para conectar desde tu teléfono.</div>' : '')
    + '</div>';
  document.body.appendChild(d);

  const r = ancla.getBoundingClientRect();
  const pnl = d.querySelector('.wsel-p');
  pnl.style.top = (r.bottom + 8) + 'px';
  pnl.style.right = Math.max(10, window.innerWidth - r.right) + 'px';

  const cerrar = () => d.remove();
  d.querySelector('.wsel-bg').onclick = cerrar;
  const bwc = d.querySelector('[data-wc]');
  if (bwc) bwc.onclick = () => { cerrar(); w.conectarWalletConnect().then(pintarWallet).catch((e) => aviso(String((e && e.message) || e))); };
  d.querySelectorAll('[data-w]').forEach((b) => (b.onclick = () => {
    const id = b.getAttribute('data-w'); cerrar();
    Promise.resolve().then(() => w.conectarCon(id)).then(pintarWallet)
      .catch((e) => { console.warn('[portada] wallet:', e); aviso(String((e && e.message) || e)); });
  }));
}

async function pintarWallet() {
  const caja = $('wbox');
  if (!caja) return;

  let w;
  try { w = await wallet(); } catch (_) { return; }
  const cta = w.cuentaActual();

  if (!cta) {
    caja.innerHTML = '<button class="pt-btn pt-ghost" type="button">Conectar wallet</button>';
    caja.firstChild.onclick = conectar;
    return;
  }

  // La hoja base hace falta para que .dir se vea como dentro de la app.
  try { await estiloBase(); } catch (_) {}

  if (!w.esRedCorrecta()) {
    caja.innerHTML = '<button class="pt-wbad" type="button">Red incorrecta</button>';
    caja.firstChild.onclick = () => w.cambiarARedCorrecta().catch(() => {});
    return;
  }

  /* La cápsula se envuelve en un ámbito colmena-app LOCAL (un div con ese
     id) para heredar los estilos de la app SIN volver el body entero
     colmena-app, que rompía la portada. */
  caja.innerHTML = '<div id="colmena-app" style="display:contents"><div class="c-hdr-r">'
    + '<button class="c-perfil" id="c-perfil" type="button" aria-label="Mi perfil">'
    + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.6-3.4 3.2-5 6.5-5s5.9 1.6 6.5 5"/></svg></button>'
    + '<button class="dir" id="c-dir" type="button" title="Cambiar de wallet">'
    + iconoWallet(w) + '<span class="dir-tx">' + String(cta).slice(-4) + '</span>'
    + '<span class="dir-ch"></span></button></div></div>';

  $('c-perfil').onclick = () => abrir('perfil', null);
  $('c-dir').onclick = (e) => { e.stopPropagation(); selectorWallet($('c-dir')); };

  // Reintentos del logo, igual que hace la app.
  [200, 700, 1500, 3000].forEach((ms) => setTimeout(() => {
    const d = $('c-dir'); if (!d) return;
    const viejo = d.querySelector('.dir-logo') || d.firstElementChild;
    if (!viejo || viejo.classList.contains('dir-tx')) return;
    const tmp = document.createElement('span');
    tmp.innerHTML = iconoWallet(w);
    const nuevo = tmp.firstElementChild;
    if (nuevo && nuevo.outerHTML !== viejo.outerHTML) viejo.replaceWith(nuevo);
  }, ms));
}

/* Los botones grandes marcados data-cta cambian segun haya sesion o no.
   Sin wallet: Conectar wallet. Con wallet: pasan a promocionar una funcion
   real (Swap), ya que conectar ya no hace falta. */
async function pintarCtas() {
  let hay = false;
  try { const w = await wallet(); hay = !!(w.cuentaActual && w.cuentaActual()); } catch (_) {}
  const es = document.documentElement.lang === 'es';
  document.querySelectorAll('[data-cta="wallet"]').forEach((b) => {
    const ico = b.querySelector('svg');
    const icoHtml = ico ? ico.outerHTML : '';
    if (hay) {
      b.innerHTML = icoHtml + (es ? 'Ir al Swap' : 'Go to Swap');
      b.removeAttribute('data-conectar');
      b.dataset.abrir = 'swap';
    } else {
      b.innerHTML = icoHtml + (es ? 'Conectar wallet' : 'Connect wallet');
      b.setAttribute('data-conectar', '');
      delete b.dataset.abrir;
    }
  });
}

/* Panel de administracion: se activa el disparador oculto (5 clics en la
   esquina inferior izquierda). El modulo comprueba on-chain si la wallet
   conectada es owner; si no, no abre nada. Igual que en la app. */
let _adminOK = false;
async function activarAdmin() {
  if (_adminOK) return;
  try {
    await estiloBase();
    const ad = await import(J + 'admin.js?v=125');
    if (ad.iniciarPanelOculto) { ad.iniciarPanelOculto(); _adminOK = true; }
  } catch (e) { console.warn('[portada] admin:', e); }
}

(async () => {
  try {
    const w = await wallet();
    w.alCambiar(() => { pintarWallet(); pintarCtas(); });
    await w.reconectarSiProcede();
    pintarWallet();
    pintarCtas();
    activarAdmin();
  } catch (e) { console.warn('[portada] wallet:', e); }
})();

document.querySelectorAll('[data-conectar]').forEach((b) => b.addEventListener('click', conectar));


/* ══════════════════════════════════════════════════════════════════════
   3 · CABECERA
   ══════════════════════════════════════════════════════════════════════ */
try {
  const h = $('hdr');
  let pegada = false, oculta = false, pendiente = false;

  /* Cuándo se ve la barra:
       · en lo alto de la página (los primeros 120 px), y
       · cuando el cursor sube a la franja de arriba a buscarla.
     En cualquier otro momento se retira, tanto bajando como subiendo.
     Antes volvía al subir y molestaba a media página. */
  const ARRIBA = 120;
  let cursorArriba = false;

  const aplicar = () => {
    pendiente = false;
    const y = Math.max(0, window.scrollY);

    const debePegada = y > 10;
    if (debePegada !== pegada) { pegada = debePegada; h.classList.toggle('pt-stuck', debePegada); }

    const debeOculta = y > ARRIBA && !cursorArriba;
    if (debeOculta !== oculta) { oculta = debeOculta; h.classList.toggle('pt-oculta', debeOculta); }
  };

  const pedir = () => { if (pendiente) return; pendiente = true; requestAnimationFrame(aplicar); };

  window.addEventListener('scroll', pedir, { passive: true });

  /* Franja sensible de 80 px arriba. Una vez visible, se mantiene mientras
     el cursor siga dentro de la propia barra: si no, desaparecería justo
     al ir a pulsar un botón. */
  window.addEventListener('mousemove', (e) => {
    const dentro = e.clientY < 80 || (h.contains(e.target));
    if (dentro !== cursorArriba) { cursorArriba = dentro; pedir(); }
  }, { passive: true });

  /* Con el teclado tampoco puede irse mientras se navega el menú. */
  h.addEventListener('focusin', () => { cursorArriba = true; pedir(); });
  h.addEventListener('focusout', () => {
    setTimeout(() => { if (!h.contains(document.activeElement)) { cursorArriba = false; pedir(); } }, 60);
  });

  aplicar();
} catch (e) { console.warn('[portada] cabecera:', e); }


/* ══════════════════════════════════════════════════════════════════════
   4 · APARICIÓN AL BAJAR
   Si el navegador no puede o el sistema pide menos movimiento, se muestra
   todo de golpe. Nunca se queda contenido invisible por culpa del efecto.
   ══════════════════════════════════════════════════════════════════════ */
try {
  const rs = document.querySelectorAll('#pt .pt-rise');
  if (quieto || !('IntersectionObserver' in window)) {
    rs.forEach((r) => r.classList.add('in'));
  } else {
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
    rs.forEach((r) => io.observe(r));
  }
} catch (e) { console.warn('[portada] aparición:', e); }


/* ══════════════════════════════════════════════════════════════════════
   5 · BRASAS
   ══════════════════════════════════════════════════════════════════════

   Ambiente, no confeti. Ceniza encendida que sube muy despacio y se
   balancea, como en una caverna: es lo que hace que la foto de fondo deje
   de ser un cartel y se convierta en un sitio.

   Tres planos de profundidad. Las del fondo son diminutas, lentas y
   apagadas; las de delante, más grandes, más rápidas y con halo. Esa
   diferencia es la que da sensación de espacio: sin ella parecen pegatinas
   sobre un cristal.

   Va en <canvas> y no con divs: con puntos de HTML el navegador tiene que
   recalcular la página en cada fotograma y solo aguanta unos pocos. Aquí
   caben ciento y pico sin despeinarse.

   Se detiene cuando la sección no está en pantalla, y no se enciende
   siquiera si el sistema pide menos movimiento.
   ══════════════════════════════════════════════════════════════════════ */
try {
  const lienzo = $('pt-chispas');
  if (!quieto && lienzo) brasas(lienzo);
} catch (e) { console.warn('[portada] chispas:', e); }


/* ══════════════════════════════════════════════════════════════════════
   6 · LUZ QUE SIGUE AL CURSOR SOBRE LAS MONEDAS
   El JavaScript solo escribe dos variables CSS por ficha; el degradado lo
   pinta el compositor del navegador. Como todas reciben la misma posición
   del ratón, la que tienes debajo se enciende del todo y las de al lado se
   insinúan: el efecto de cercanía sale solo, sin calcular distancias.
   ══════════════════════════════════════════════════════════════════════ */
try {
  const rejilla = $('px');
  if (rejilla && window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    const fichas = rejilla.querySelectorAll('.pt-coin');
    let pedido = false, ex = 0, ey = 0;
    const pintar = () => {
      pedido = false;
      fichas.forEach((f) => {
        const r = f.getBoundingClientRect();
        f.style.setProperty('--mx', (ex - r.left) + 'px');
        f.style.setProperty('--my', (ey - r.top) + 'px');
      });
    };
    rejilla.addEventListener('pointermove', (e) => {
      ex = e.clientX; ey = e.clientY;
      if (!pedido) { pedido = true; requestAnimationFrame(pintar); }
    }, { passive: true });
    rejilla.addEventListener('pointerenter', () => rejilla.classList.add('lit'));
    rejilla.addEventListener('pointerleave', () => rejilla.classList.remove('lit'));
  }
} catch (e) { console.warn('[portada] luz de monedas:', e); }





/* ══════════════════════════════════════════════════════════════════════
   7 · INSTALAR
   ══════════════════════════════════════════════════════════════════════ */
/* Instalar: dispara la instalación de la PWA directamente, sin ventana
   intermedia. Se usa extras.iniciarInstalacion(), que captura el evento
   beforeinstallprompt del navegador, y luego extras.instalarAhora(), que
   llama a prompt(). Si el navegador todavía no ofrece instalar (o ya está
   instalada), comparte el enlace, igual que hace la app en el móvil. */
(function () {
  // El evento beforeinstallprompt llega una sola vez y temprano. Se captura
  // aqui mismo para no perderlo, y se le pasa a extras cuando cargue.
  let guardado = null, ex = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    guardado = e;
    if (ex && ex.registrarInstalador) ex.registrarInstalador(e);
  });

  (async () => {
    try {
      await estiloBase();                    // el panel usa los estilos base
      ex = await import(J + 'extras.js?v=200');
      if (ex.iniciarInstalacion) ex.iniciarInstalacion();
      if (guardado && ex.registrarInstalador) ex.registrarInstalador(guardado);
    } catch (e) { console.warn('[portada] init instalar:', e); }
  })();

  // El boton INSTALA directamente: dispara el prompt nativo del navegador.
  // Nada de panel con QR (eso era lo viejo). instalarAhora() usa el evento
  // beforeinstallprompt capturado; requiere que el service worker este
  // registrado (ya lo esta en index.html), sin el cual el navegador nunca
  // ofrece instalar.
  document.querySelectorAll('[data-inst]').forEach((b) => {
    b.addEventListener('click', async (evt) => {
      evt.preventDefault();
      try {
        if (!ex) ex = await import(J + 'extras.js?v=200');
        if (guardado && ex.registrarInstalador) ex.registrarInstalador(guardado);
        if (ex.instalarAhora) await ex.instalarAhora();
      } catch (err) { console.warn('[portada] instalar:', err); }
    });
  });
})();


/* ══════════════════════════════════════════════════════════════════════
   BLOQUEO DE SCROLL MIENTRAS HAY UNA VENTANA ABIERTA
   ══════════════════════════════════════════════════════════════════════
   Las ventanas de la app se montan en <body> y muchas NO se destruyen al
   cerrar: se ocultan quitando la clase .show o con display:none. Por eso
   contar nodos añadidos/quitados dejaba el scroll bloqueado para siempre.

   Aquí no se cuenta nada: se comprueba en cada cambio del DOM si hay ALGÚN
   overlay realmente visible. Si lo hay, se bloquea el fondo; si no queda
   ninguno, se libera. Es imposible que quede bloqueado sin ventana abierta.
*/
(function () {
  const SEL = [
    '[id$="-overlay"]', '#swap-modal', '#inst-panel', '#inst-pre', '#inst-guia',
    '#wsel', '#pp-overlay', '#mk-overlay', '#pro-overlay', '#lqp-overlay',
    '#ord-modal', '#w-overlay', '#tl-overlay', '#pv-overlay', '#al-overlay'
  ].join(',');

  const visible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    // Un overlay a pantalla completa siempre tiene tamaño; si es 0, está oculto.
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };

  let bloqueado = false;
  const revisar = () => {
    let hay = false;
    document.querySelectorAll(SEL).forEach((el) => { if (visible(el)) hay = true; });
    if (hay === bloqueado) return;
    bloqueado = hay;
    document.documentElement.style.overflow = hay ? 'hidden' : '';
    document.body.style.overflow = hay ? 'hidden' : '';
  };

  const obs = new MutationObserver(() => { requestAnimationFrame(revisar); });
  obs.observe(document.body, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['class', 'style']
  });
  // Red de seguridad: si algo se escapa, cada segundo se recomprueba.
  setInterval(revisar, 1000);
})();

/* Si se llega con ?abrir=… se abre esa ventana al entrar. */
try {
  const q = new URLSearchParams(location.search);
  const pedido = q.get('abrir');
  if (pedido && PUERTAS[pedido]) {
    const tid = q.get('tool');
    abrir(pedido, tid ? { getAttribute: () => tid } : null);
  }
} catch (_) {}


/* ══════════════════════════════════════════════════════════════════════
   8 · IDIOMA
   ══════════════════════════════════════════════════════════════════════

   Lo gestiona idioma.js, el módulo que ya existía. Aquí NO hay ningún
   sistema paralelo: solo se arranca el suyo y se engancha el botón.

   Por qué importa: cambiarIdioma('es') hace location.reload() a propósito,
   porque el texto original ya se sustituyó y recargar es la forma limpia
   de volver atrás. En la versión anterior yo llamaba a esa función en
   CADA carga; con español guardado recargaba, volvía a leer español y
   recargaba otra vez. De ahí el parpadeo sin fin.

   Ahora al cargar solo se llama a arrancarIdioma(), que no recarga nunca:
   si el idioma guardado es español se sale de inmediato, y si no, traduce.
   cambiarIdioma() se llama únicamente cuando el visitante pulsa el botón.

   Por defecto el módulo arranca en inglés, así que la página sale en
   inglés sin hacer nada.
   ══════════════════════════════════════════════════════════════════════ */
(async () => {
  let idi;
  try {
    idi = await import(J + 'idioma.js?v=146');
    idi.arrancarIdioma();
  } catch (e) {
    console.warn('[portada] idioma:', e);
    return;                       // sin traducción la página sigue viéndose
  }

  const bot = $('pt-lang');
  const tx = $('pt-lang-tx');
  if (!bot) return;

  const pintar = () => {
    if (tx) tx.textContent = idi.idiomaActual() === 'es' ? 'English' : 'Español';
  };
  pintar();

  bot.addEventListener('click', () => {
    const ahora = idi.idiomaActual();
    idi.cambiarIdioma(ahora === 'es' ? 'en' : 'es');
    pintar();                     // al pasar a español recarga él solo
  });
})();
