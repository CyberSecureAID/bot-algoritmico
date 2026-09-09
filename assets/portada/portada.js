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
  const m = await import(J + 'gridbot/estilos.js?v=1');
  document.body.id = 'colmena-app';        // el ámbito que espera esa hoja
  m.inyectarEstilo();
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
  tools:   async () => (await import(J + 'tools.js?v=125')).abrirTools(),
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

  const antes = enlace ? enlace.style.opacity : '';
  if (enlace) enlace.style.opacity = '.55';

  // La hoja base va aparte: si fallara, la ventana se abre igual, solo
  // que con menos adorno. Vale más eso que no abrir nada.
  try { await estiloBase(); }
  catch (e) { console.warn('[portada] hoja base:', e); }

  try {
    await puerta();
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
    caja.innerHTML = '<button class="btn ghost" type="button">Conectar wallet</button>';
    caja.firstChild.onclick = conectar;
    return;
  }

  // La hoja base hace falta para que .dir se vea como dentro de la app.
  try { await estiloBase(); } catch (_) {}

  if (!w.esRedCorrecta()) {
    caja.innerHTML = '<button class="wbad" type="button">Red incorrecta</button>';
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
  let pegada = false;
  const mirar = () => {
    const debe = window.scrollY > 10;
    if (debe !== pegada) { pegada = debe; h.classList.toggle('stuck', debe); }
  };
  window.addEventListener('scroll', mirar, { passive: true });
  mirar();
} catch (e) { console.warn('[portada] cabecera:', e); }


/* ══════════════════════════════════════════════════════════════════════
   4 · APARICIÓN AL BAJAR
   Si el navegador no puede o el sistema pide menos movimiento, se muestra
   todo de golpe. Nunca se queda contenido invisible por culpa del efecto.
   ══════════════════════════════════════════════════════════════════════ */
try {
  const rs = document.querySelectorAll('#pt .rise');
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
  const g = lienzo.getContext('2d');
  if (!g) return;

  /* ── La idea ──────────────────────────────────────────────────────
     Un campo de puntos no da atmósfera. Lo que la da es LUZ CON POLVO
     DENTRO: en el mundo real un haz se ve porque las partículas en
     suspensión lo dispersan hacia tus ojos. Sin polvo no hay haz, y sin
     haz el polvo son puntitos.

     Así que aquí hay tres cosas trabajando juntas:

       1. HACES. Dos o tres columnas de luz inclinadas, larguísimas y muy
          tenues, que se abren de arriba abajo y respiran despacio.
       2. POLVO EN TRES PROFUNDIDADES. Lo lejano es diminuto, lento y
          apagado; lo cercano es mayor, más rápido y con halo. Esa
          diferencia es la perspectiva del aire.
       3. DISPERSIÓN. Cada mota mira si está dentro de un haz y, si lo
          está, se enciende. Eso es lo que hace que la luz "tenga cuerpo"
          en vez de ser un degradado pegado encima.

     Encima, un puñado de brasas se aviva y se apaga con su propio pulso,
     y el conjunto se desplaza un poco al hacer scroll, más lo cercano que
     lo lejano, para que el fondo tenga volumen.
     ───────────────────────────────────────────────────────────────── */

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const densidad = Number(lienzo.dataset.n || 60);
  const tono = lienzo.dataset.tono || '244,208,137';

  let an = 0, al = 0, motas = [], haces = [], vivo = false, lazo = 0, antes = 0;
  let desliz = 0;

  const entre = (a, b) => a + Math.random() * (b - a);

  // Tres planos: [radio, velocidad, alfa, halo, parallax]
  const PLANOS = [
    { r: [0.5, 1.1], v: [3, 7],   a: [0.06, 0.16], halo: 0,  px: 0.02 },
    { r: [0.9, 1.8], v: [7, 14],  a: [0.14, 0.34], halo: 3,  px: 0.06 },
    { r: [1.5, 3.0], v: [12, 24], a: [0.28, 0.62], halo: 8,  px: 0.12 }
  ];

  function nacer(abajo) {
    const d = Math.random();
    const p = PLANOS[d < 0.5 ? 0 : d < 0.84 ? 1 : 2];
    return {
      x: Math.random() * an,
      y: abajo ? al + 14 : Math.random() * al,
      r: entre(p.r[0], p.r[1]),
      v: entre(p.v[0], p.v[1]),
      a: entre(p.a[0], p.a[1]),
      halo: p.halo,
      px: p.px,
      f: 0.25 + Math.random() * 0.7,      // ritmo del balanceo
      amp: 5 + Math.random() * 22,        // amplitud del balanceo
      pf: 0.5 + Math.random() * 1.6,      // ritmo del parpadeo
      t: Math.random() * 100,
      brasa: Math.random() < 0.14         // unas pocas laten de verdad
    };
  }

  function medir() {
    const c = lienzo.getBoundingClientRect();
    an = Math.max(1, c.width);
    al = Math.max(1, c.height);
    lienzo.width = Math.round(an * dpr);
    lienzo.height = Math.round(al * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const n = Math.round(densidad * Math.min(1.7, an / 900));
    motas = Array.from({ length: n }, () => nacer(false));

    // Los haces: pocos, muy anchos y muy tenues. Si se notan, están mal.
    const cuantos = an < 760 ? 2 : 3;
    haces = Array.from({ length: cuantos }, (_, i) => ({
      x: an * (0.18 + 0.3 * i + Math.random() * 0.1),
      ancho: an * entre(0.14, 0.26),
      incl: entre(-0.30, -0.10),          // inclinación en radianes
      base: entre(0.020, 0.042),          // opacidad máxima
      f: entre(0.05, 0.12),               // respiración
      t: Math.random() * 100
    }));
  }

  // ¿Cuánta luz del haz le llega a este punto? 0 fuera, 1 en el centro.
  function luzEn(x, y) {
    let suma = 0;
    for (let i = 0; i < haces.length; i++) {
      const h = haces[i];
      const cx = h.x + (y - al * 0.5) * Math.tan(h.incl);
      const d = Math.abs(x - cx) / (h.ancho * 0.5);
      if (d < 1) suma += (1 - d) * (1 - d);      // caída suave hacia el borde
    }
    return Math.min(1, suma);
  }

  function pintarHaces(ahora) {
    for (let i = 0; i < haces.length; i++) {
      const h = haces[i];
      // Respiran: la intensidad sube y baja muy lentamente.
      const vida = h.base * (0.72 + 0.28 * Math.sin(ahora * h.f + h.t));
      const arribaX = h.x - al * 0.5 * Math.tan(h.incl);
      const abajoX  = h.x + al * 0.5 * Math.tan(h.incl);

      const grad = g.createLinearGradient(arribaX, 0, abajoX, al);
      grad.addColorStop(0,    'rgba(' + tono + ',' + (vida * 1.0).toFixed(4) + ')');
      grad.addColorStop(0.55, 'rgba(' + tono + ',' + (vida * 0.45).toFixed(4) + ')');
      grad.addColorStop(1,    'rgba(' + tono + ',0)');

      g.save();
      g.beginPath();
      g.moveTo(arribaX - h.ancho * 0.30, 0);
      g.lineTo(arribaX + h.ancho * 0.30, 0);
      g.lineTo(abajoX  + h.ancho * 0.72, al);
      g.lineTo(abajoX  - h.ancho * 0.72, al);
      g.closePath();
      g.filter = 'blur(26px)';             // el haz nunca tiene borde
      g.fillStyle = grad;
      g.fill();
      g.restore();
    }
  }

  function paso(ms) {
    if (!vivo) return;
    const ahora = ms / 1000;
    const dt = Math.min(0.05, ahora - antes || 0.016);
    antes = ahora;

    g.clearRect(0, 0, an, al);
    g.globalCompositeOperation = 'lighter';

    pintarHaces(ahora);

    for (let i = 0; i < motas.length; i++) {
      const m = motas[i];
      m.t += dt;
      m.y -= m.v * dt;
      if (m.y < -16) { motas[i] = nacer(true); continue; }

      const x = m.x + Math.sin(m.t * m.f) * m.amp;
      const y = m.y + desliz * m.px;       // profundidad al hacer scroll
      if (y < -20 || y > al + 20) continue;

      // Nada aparece ni desaparece de golpe.
      const borde = Math.min(1, y / (al * 0.2), (al - y) / (al * 0.12));
      if (borde <= 0) continue;

      // Dispersión: dentro del haz, la mota se enciende.
      const enLuz = luzEn(x, y);
      const pulso = m.brasa ? 0.68 + 0.32 * Math.sin(m.t * m.pf * 3) : 1;
      const alfa = m.a * borde * pulso * (1 + enLuz * 1.9);
      if (alfa <= 0.004) continue;

      const halo = m.halo + enLuz * 7;
      if (halo > 0.5) { g.shadowBlur = halo; g.shadowColor = 'rgba(' + tono + ',.9)'; }
      else g.shadowBlur = 0;

      g.beginPath();
      g.fillStyle = 'rgba(' + tono + ',' + Math.min(0.95, alfa).toFixed(3) + ')';
      g.arc(x, y, m.r * (1 + enLuz * 0.35), 0, 6.2832);
      g.fill();
    }

    g.shadowBlur = 0;
    g.globalCompositeOperation = 'source-over';
    lazo = requestAnimationFrame(paso);
  }

  const arrancar = () => { if (vivo) return; vivo = true; antes = performance.now() / 1000; lazo = requestAnimationFrame(paso); };
  const parar = () => { vivo = false; cancelAnimationFrame(lazo); };

  medir();

  let espera;
  window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(medir, 220); }, { passive: true });

  // Profundidad al hacer scroll: lo cercano se mueve más que lo lejano.
  window.addEventListener('scroll', () => {
    const c = lienzo.getBoundingClientRect();
    desliz = (window.innerHeight * 0.5 - (c.top + c.height * 0.5)) * 0.12;
  }, { passive: true });

  // Solo se anima lo que está a la vista, y nada con la pestaña de fondo.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => (es[0].isIntersecting ? arrancar() : parar()), { threshold: 0 }).observe(lienzo);
  } else arrancar();
  document.addEventListener('visibilitychange', () => (document.hidden ? parar() : arrancar()));
}

try {
  if (!quieto) document.querySelectorAll('#pt .brasas').forEach(brasas);
} catch (e) { console.warn('[portada] brasas:', e); }


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
    const fichas = rejilla.querySelectorAll('.coin');
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
   7 · PRECIOS REALES
   Se piden una sola vez, y solo al llegar a esa sección. Si la petición
   falla se quedan los guiones: nunca se inventa un número.
   ══════════════════════════════════════════════════════════════════════ */
try {
  const caja = $('px');
  const traer = () => {
    fetch('https://api.coingecko.com/api/v3/simple/price'
        + '?ids=bitcoin,ethereum,binancecoin,solana,ripple'
        + '&vs_currencies=usd&include_24hr_change=true', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        caja.querySelectorAll('[data-px]').forEach((el) => {
          const m = d[el.dataset.px];
          if (!m || typeof m.usd !== 'number') return;
          const dec = m.usd < 10 ? 4 : 2;
          el.textContent = '$' + m.usd.toLocaleString('en-US',
            { minimumFractionDigits: dec, maximumFractionDigits: dec });
        });
        caja.querySelectorAll('[data-ch]').forEach((el) => {
          const m = d[el.dataset.ch];
          const c = m && m.usd_24h_change;
          if (typeof c !== 'number') return;
          el.textContent = (c >= 0 ? '+' : '−') + Math.abs(c).toFixed(2) + '%';
          el.className = c >= 0 ? 'up' : 'down';
        });
      })
      .catch(() => {});
  };
  if (caja) {
    if ('IntersectionObserver' in window) {
      const ip = new IntersectionObserver((e) => {
        if (!e[0].isIntersecting) return;
        ip.disconnect(); traer();
      }, { rootMargin: '250px' });
      ip.observe(caja);
    } else traer();
  }
} catch (e) { console.warn('[portada] precios:', e); }



/* ══════════════════════════════════════════════════════════════════════
   8 · BUSCADOR E INSTALAR
   ══════════════════════════════════════════════════════════════════════ */
try {
  const q = $('q');
  if (q) q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const t = q.value.trim();
    location.href = 'app.html' + (t ? '?buscar=' + encodeURIComponent(t) : '');
  });
} catch (_) {}

/* Instalar: se abre el panel de extras.js, el mismo de dentro, con sus
   instrucciones y su código QR. Nada de recrearlo. */
try {
  document.querySelectorAll('[data-inst]').forEach((b) => {
    b.addEventListener('click', async (ev) => {
      ev.preventDefault();
      try {
        await estiloBase();
        const ex = await import(J + 'extras.js?v=125');
        ex.panelInstalar(b);
      } catch (e) {
        console.warn('[portada] instalar:', e);
        aviso('No se pudo abrir el panel de instalación: ' + ((e && e.message) || e));
      }
    });
  });
} catch (_) {}


/* Si se llega con ?abrir=… se abre esa ventana al entrar. */
try {
  const pedido = new URLSearchParams(location.search).get('abrir');
  if (pedido && PUERTAS[pedido]) abrir(pedido, null);
} catch (_) {}
