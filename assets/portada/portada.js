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

  caja.innerHTML = '<button class="dir" id="c-dir" type="button" title="Mi perfil">'
    + iconoWallet(w)
    + '<span class="dir-tx">' + String(cta).slice(-4) + '</span>'
    + '<span class="dir-ch"></span></button>';
  caja.firstChild.onclick = () => abrir('perfil', null);

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

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const densidad = Number(lienzo.dataset.n || 60);
  let an = 0, al = 0, chispas = [], corriendo = false, lazo = 0;

  // Cada plano: tamaño, velocidad, opacidad y halo propios.
  const PLANOS = [
    { r: [0.6, 1.2], v: [4, 9],   a: [0.10, 0.26], halo: 0 },
    { r: [1.0, 2.0], v: [8, 16],  a: [0.20, 0.45], halo: 4 },
    { r: [1.6, 3.2], v: [14, 26], a: [0.35, 0.72], halo: 9 }
  ];

  const entre = ([a, b]) => a + Math.random() * (b - a);

  function nacer(y) {
    const p = PLANOS[Math.random() < 0.5 ? 0 : (Math.random() < 0.62 ? 1 : 2)];
    return {
      x: Math.random() * an,
      y: y === undefined ? Math.random() * al : al + 12,
      r: entre(p.r),
      v: entre(p.v),
      a: entre(p.a),
      halo: p.halo,
      // Balanceo: cada chispa con su ritmo y su amplitud.
      f: 0.3 + Math.random() * 0.8,
      amp: 6 + Math.random() * 20,
      t: Math.random() * 100
    };
  }

  function medir() {
    const c = lienzo.getBoundingClientRect();
    an = Math.max(1, c.width); al = Math.max(1, c.height);
    lienzo.width = Math.round(an * dpr);
    lienzo.height = Math.round(al * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(densidad * Math.min(1.6, an / 900));
    chispas = Array.from({ length: n }, () => nacer());
  }

  let antes = 0;
  function paso(ahora) {
    if (!corriendo) return;
    const dt = Math.min(0.05, (ahora - antes) / 1000 || 0.016);
    antes = ahora;

    g.clearRect(0, 0, an, al);
    g.globalCompositeOperation = 'lighter';

    for (let i = 0; i < chispas.length; i++) {
      const c = chispas[i];
      c.t += dt;
      c.y -= c.v * dt;
      const x = c.x + Math.sin(c.t * c.f) * c.amp;

      // Se apagan al llegar arriba y vuelven a nacer abajo.
      if (c.y < -14) { chispas[i] = nacer(0); continue; }

      // Desvanecido en los dos extremos: nada aparece ni desaparece de golpe.
      const borde = Math.min(1, c.y / (al * 0.22), (al - c.y) / (al * 0.14));
      const alfa = c.a * Math.max(0, borde);
      if (alfa <= 0.004) continue;

      if (c.halo) { g.shadowBlur = c.halo; g.shadowColor = 'rgba(232,184,75,.85)'; }
      else g.shadowBlur = 0;

      g.beginPath();
      g.fillStyle = 'rgba(244,208,137,' + alfa.toFixed(3) + ')';
      g.arc(x, c.y, c.r, 0, 6.2832);
      g.fill();
    }
    g.shadowBlur = 0;
    g.globalCompositeOperation = 'source-over';
    lazo = requestAnimationFrame(paso);
  }

  function arrancar() { if (corriendo) return; corriendo = true; antes = performance.now(); lazo = requestAnimationFrame(paso); }
  function parar()    { corriendo = false; cancelAnimationFrame(lazo); }

  medir();
  let espera;
  window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(medir, 220); }, { passive: true });

  // Solo se anima lo que está a la vista.
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
   8 · DESPLAZAMIENTO CON INERCIA
   Hecho a mano: el repo aloja todo en local a propósito y meter una
   librería de CDN rompería esa regla. Se apaga en pantallas táctiles y si
   el sistema pide menos movimiento.
   ══════════════════════════════════════════════════════════════════════ */
try {
  const tactil = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (!quieto && !tactil) {
    let destino = window.scrollY, actual = window.scrollY, vivo = false;
    const tope = () => document.documentElement.scrollHeight - window.innerHeight;

    const paso = () => {
      const d = destino - actual;
      if (Math.abs(d) < 0.4) { actual = destino; window.scrollTo(0, actual); vivo = false; return; }
      actual += d * 0.14;
      window.scrollTo(0, actual);
      requestAnimationFrame(paso);
    };

    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.deltaMode !== 0) return;    // zoom y ruedas por líneas, en paz
      // Si hay una ventana de la app abierta, no se toca su scroll.
      if (e.target.closest && e.target.closest('[id$="-overlay"], #swap-modal, #wsel')) return;
      e.preventDefault();
      destino = Math.max(0, Math.min(tope(), destino + e.deltaY));
      if (!vivo) { vivo = true; actual = window.scrollY; requestAnimationFrame(paso); }
    }, { passive: false });

    window.addEventListener('scroll', () => {
      if (!vivo) { destino = actual = window.scrollY; }
    }, { passive: true });
  }
} catch (e) { console.warn('[portada] inercia:', e); }


/* ══════════════════════════════════════════════════════════════════════
   9 · BUSCADOR E INSTALAR
   ══════════════════════════════════════════════════════════════════════ */
try {
  const q = $('q');
  if (q) q.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const t = q.value.trim();
    location.href = 'app.html' + (t ? '?buscar=' + encodeURIComponent(t) : '');
  });
} catch (_) {}

try {
  let aviso = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); aviso = e; });
  document.querySelectorAll('[data-inst]').forEach((b) => {
    b.addEventListener('click', (ev) => {
      if (!aviso) return;                 // deja seguir el enlace normal
      ev.preventDefault();
      aviso.prompt();
      aviso.userChoice.finally(() => { aviso = null; });
    });
  });
} catch (_) {}


/* Si se llega con ?abrir=… se abre esa ventana al entrar. */
try {
  const pedido = new URLSearchParams(location.search).get('abrir');
  if (pedido && PUERTAS[pedido]) abrir(pedido, null);
} catch (_) {}
