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

async function estiloBase() {
  if (baseLista) return;
  const [est, util] = await Promise.all([
    import(J + 'gridbot/estilos.js?v=1'),
    import(J + 'gridbot/util.js?v=1')
  ]);
  document.body.id = 'colmena-app';        // el ámbito que espera esa hoja
  est.inyectarEstilo(util.tipoNum);        // ← lleva argumento, igual que en la app
  baseLista = true;
}

async function wallet() {
  if (!W) W = await import(J + 'wallet.js?v=125');
  return W;
}

const PUERTAS = {
  swap: async () => {
    const m = await import(J + 'gridbot/swap.js?v=1');
    m.initSwap(conectar, () => {});
    m.abrirSwap();
  },
  market:  async () => (await import(J + 'market.js?v=125')).abrirMarket(),
  liq:     async () => (await import(J + 'liquidity.js?v=125')).abrirLiquidity(),
  tools:   async (tid) => (await import(J + 'tools.js?v=126')).abrirTools(tid),
  academy: async () => (await import(J + 'academy.js?v=125')).abrirAcademy(),
  prize:   async () => (await import(J + 'prizepool.js?v=125')).abrirPrizePool(),
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

  /* .c-hdr-r es el contexto que esperan estos elementos: sin él la cápsula
     se descuadraba y el logo salía encima de las cuatro cifras. */
  caja.innerHTML = '<div class="c-hdr-r">'
    + '<button class="c-perfil" id="c-perfil" type="button" aria-label="Mi perfil">'
    + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.6-3.4 3.2-5 6.5-5s5.9 1.6 6.5 5"/></svg></button>'
    + '<button class="dir" id="c-dir" type="button" title="Cambiar de wallet">'
    + iconoWallet(w) + '<span class="dir-tx">' + String(cta).slice(-4) + '</span>'
    + '<span class="dir-ch"></span></button></div>';

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

(async () => {
  try {
    const w = await wallet();
    w.alCambiar(pintarWallet);
    await w.reconectarSiProcede();   // silencioso: no abre ninguna ventana
    pintarWallet();
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
function brasas(lienzo) {
  const g = lienzo.getContext('2d', { alpha: true });
  if (!g) return;

  /* ── Chispas ────────────────────────────────────────────────────────
     Puntos nítidos con un halo corto, subiendo despacio y balanceándose.
     Sin haces de luz: los quité porque ensuciaban las fotos.

     Rápido porque no se desenfoca nada en vivo: la chispa se dibuja UNA
     vez en una miniatura con su halo ya hecho, y en cada fotograma solo
     se copia y se escala. Copiar es baratísimo; desenfocar en cada cuadro
     era lo que hacía el scroll a tirones.
     ─────────────────────────────────────────────────────────────────── */

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const densidad = Number(lienzo.dataset.n || 90);
  const tono = lienzo.dataset.tono || '246,214,150';

  let an = 0, al = 0, chispas = [], vivo = false, lazo = 0, antes = 0;
  let scrAntes = window.scrollY || 0;
  let sprite = null;
  const SP = 24;

  const entre = (a, b) => a + Math.random() * (b - a);

  // Tres profundidades: [radio, velocidad, alfa]
  // [radio, velocidad, alfa, profundidad]
  const PLANOS = [
    { r: [0.45, 0.85], v: [3, 7],   a: [0.16, 0.34], p: 0.12 },
    { r: [0.70, 1.20], v: [7, 14],  a: [0.28, 0.55], p: 0.38 },
    { r: [1.10, 1.80], v: [12, 24], a: [0.45, 0.85], p: 0.85 }
  ];

  function nacer(abajo) {
    const d = Math.random();
    const p = PLANOS[d < 0.48 ? 0 : d < 0.83 ? 1 : 2];
    return {
      x: Math.random() * an,
      y: abajo ? al + 12 : Math.random() * al,
      r: entre(p.r[0], p.r[1]),
      v: entre(p.v[0], p.v[1]),
      a: entre(p.a[0], p.a[1]),
      prof: p.p,
      f: 0.25 + Math.random() * 0.7,
      amp: 5 + Math.random() * 20,
      pf: 0.6 + Math.random() * 1.8,
      t: Math.random() * 100,
      brasa: Math.random() < 0.2
    };
  }

  /* El núcleo ocupa la cuarta parte del sprite: por eso se ve como una
     chispa con brillo y no como una mancha de polvo. */
  function hacerSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = SP * 2;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(SP, SP, 0, SP, SP, SP);
    gr.addColorStop(0.00, 'rgba(255,246,225,1)');
    gr.addColorStop(0.22, 'rgba(' + tono + ',.95)');
    gr.addColorStop(0.34, 'rgba(' + tono + ',.34)');
    gr.addColorStop(0.62, 'rgba(' + tono + ',.07)');
    gr.addColorStop(1.00, 'rgba(' + tono + ',0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, SP * 2, SP * 2);
    sprite = c;
  }

  function medir() {
    const c = lienzo.getBoundingClientRect();
    an = Math.max(1, Math.round(c.width));
    al = Math.max(1, Math.round(c.height));
    lienzo.width = Math.round(an * dpr);
    lienzo.height = Math.round(al * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(densidad * Math.min(1.3, an / 1000));
    chispas = Array.from({ length: n }, () => nacer(false));
    if (!sprite) hacerSprite();
  }

  function paso(ms) {
    if (!vivo) return;
    const ahora = ms / 1000;
    const dt = Math.min(0.05, ahora - antes || 0.016);
    antes = ahora;

    // Cuánto se ha movido la página desde el fotograma anterior.
    const scrAhora = window.scrollY || 0;
    const desliz = scrAhora - scrAntes;
    scrAntes = scrAhora;

    g.clearRect(0, 0, an, al);
    g.globalCompositeOperation = 'lighter';

    for (let i = 0; i < chispas.length; i++) {
      const m = chispas[i];
      m.t += dt;
      m.y -= m.v * dt;
      m.y += desliz * m.prof;            // acompaña al scroll según su plano

      // Al salir por arriba o por abajo, vuelve a entrar por el lado
      // contrario: así el campo nunca se vacía por mucho que subas o bajes.
      if (m.y < -14) { chispas[i] = nacer(true); continue; }
      if (m.y > al + 24) { chispas[i] = nacer(false); chispas[i].y = -12; continue; }

      const x = m.x + Math.sin(m.t * m.f) * m.amp;
      const y = m.y;

      const borde = Math.min(1, y / (al * 0.18), (al - y) / (al * 0.1));
      if (borde <= 0) continue;

      const pulso = m.brasa ? 0.6 + 0.4 * Math.sin(m.t * m.pf * 3) : 1;
      const alfa = m.a * borde * pulso;
      if (alfa <= 0.006) continue;

      // Escala 3.2: halo corto y núcleo bien definido.
      const d = m.r * 3.2;
      g.globalAlpha = Math.min(1, alfa);
      g.drawImage(sprite, x - d, y - d, d * 2, d * 2);
    }

    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    lazo = requestAnimationFrame(paso);
  }

  const arrancar = () => { if (vivo) return; vivo = true; antes = performance.now() / 1000; lazo = requestAnimationFrame(paso); };
  const parar = () => { vivo = false; cancelAnimationFrame(lazo); };

  medir();

  let espera;
  window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(medir, 260); }, { passive: true });

  arrancar();
  document.addEventListener('visibilitychange', () => (document.hidden ? parar() : arrancar()));
}

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
try {
  let ex = null;
  const cargarExtras = async () => {
    if (ex) return ex;
    await estiloBase();
    ex = await import(J + 'extras.js?v=126');
    if (ex.iniciarInstalacion) ex.iniciarInstalacion();
    return ex;
  };
  // Se arranca la captura cuanto antes: el evento del navegador llega solo
  // una vez y hay que estar escuchando desde el principio.
  cargarExtras().catch(() => {});

  document.querySelectorAll('[data-inst]').forEach((b) => {
    b.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        const e = await cargarExtras();
        if (e.instalarAhora) await e.instalarAhora();
        else if (e.compartirEnlace) await e.compartirEnlace();
      } catch (err) {
        console.warn('[portada] instalar:', err);
      }
    });
  });
} catch (_) {}


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
    idi = await import(J + 'idioma.js?v=127');
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
