// gestos.js — Gestos táctiles para el móvil. Módulo independiente, sin librerías.
//
// QUÉ APORTA
//   1. Deslizar a los lados para cambiar de bot, como se cambia de foto.
//   2. Tirar hacia abajo para actualizar, como en cualquier app.
//
// POR QUÉ SIN LIBRERÍA
//   El navegador ya trae todo lo necesario (touchstart / touchmove / touchend).
//   Una librería de gestos añadiría 30-60 KB para esto mismo, y con las
//   conexiones de nuestros usuarios cada KB cuenta.
//
// REGLA DE ORO: no estorbar. Si el dedo va sobre la gráfica, un campo, un menú
// o algo que se desplaza a lo ancho, no hacemos nada. El gesto es un extra,
// nunca puede quitarle el control al usuario.

const $ = (id) => document.getElementById(id);
/* La tarjeta donde vive el formulario de los bots: es lo que animamos. */
const tarjetaBots = () => {
  const t = document.querySelector('#colmena-app #f-tipo');
  return t ? t.closest('.card') : null;
};
const esMovil = () => window.matchMedia('(max-width: 760px)').matches || 'ontouchstart' in window;

/* Zonas donde NO metemos mano: ahí el dedo ya tiene su función. */
const PROHIBIDO = [
  '.tv-host', '.tv-wrap', 'canvas',            // la gráfica se arrastra sola
  'input', 'textarea', 'select', 'button', 'a',
  '.c-tabs', '.ad-tabs', '.mk-tabs', '.cm-lista',
  '.ord-list', '.ob-wrap', '[data-no-gesto]'
];
const enZonaProhibida = (el) => {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    for (const sel of PROHIBIDO) { try { if (n.matches && n.matches(sel)) return true; } catch (_) {} }
    // Cualquier cosa que se desplace a lo ancho manda sobre nuestro gesto
    try {
      const cs = getComputedStyle(n);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 4) return true;
    } catch (_) {}
  }
  return false;
};

/* ══════════════ 1) DESLIZAR PARA CAMBIAR DE BOT ══════════════ */
export function iniciarDeslizar({ onCambio } = {}) {
  if (!esMovil()) return;
  let x0 = 0, y0 = 0, t0 = 0, activo = false;

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { activo = false; return; }
    // Con una ventana abierta encima, ni tocarlo
    if (document.querySelector('#colmena-modal[style*="flex"], #adm-panel, #conf-box, .ad-conf, #cmov, #wsel')) { activo = false; return; }
    const t = e.touches[0];
    if (enZonaProhibida(e.target)) { activo = false; return; }
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); activo = true;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!activo) return;
    activo = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0, ms = Date.now() - t0;
    // Tiene que ser claramente horizontal, largo y rápido: así no se dispara
    // cuando alguien solo está desplazando la página.
    if (ms > 600) return;
    if (Math.abs(dx) < 70) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.55) return;
    cambiarBot(dx < 0 ? 1 : -1, onCambio);
  }, { passive: true });
}

function cambiarBot(dir, onCambio) {
  const tabs = [...document.querySelectorAll('#colmena-app .bot-tab')];
  if (tabs.length < 2) return;
  const i = tabs.findIndex((b) => b.classList.contains('on'));
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= tabs.length) { rebote(dir); return; }   // no hay más: rebote
  animarCambio(dir, () => tabs[j].click());
  if (onCambio) onCambio(j);
}

/* Un empujón visual para que se note que el gesto funcionó. */
function animarCambio(dir, hacer) {
  const zona = tarjetaBots();
  if (!zona) { hacer(); return; }
  zona.style.transition = 'transform .13s ease, opacity .13s ease';
  zona.style.transform = `translateX(${dir > 0 ? -22 : 22}px)`;
  zona.style.opacity = '.45';
  setTimeout(() => {
    hacer();
    const z2 = tarjetaBots();
    if (!z2) return;
    z2.style.transition = 'none';
    z2.style.transform = `translateX(${dir > 0 ? 22 : -22}px)`;
    z2.style.opacity = '.45';
    requestAnimationFrame(() => {
      z2.style.transition = 'transform .18s ease, opacity .18s ease';
      z2.style.transform = ''; z2.style.opacity = '';
    });
  }, 130);
}

/* Si ya estás en el primero o el último, un rebote corto lo dice sin palabras. */
function rebote(dir) {
  const zona = tarjetaBots();
  if (!zona) return;
  zona.style.transition = 'transform .12s ease';
  zona.style.transform = `translateX(${dir > 0 ? -10 : 10}px)`;
  setTimeout(() => { zona.style.transform = ''; }, 120);
}

/* ══════════════ 2) TIRAR HACIA ABAJO PARA ACTUALIZAR ══════════════ */
export function iniciarTirarParaActualizar(alSoltar) {
  if (!esMovil() || typeof alSoltar !== 'function') return;
  estilos();

  const UMBRAL = 78;          // cuánto hay que tirar
  const TOPE = 130;           // hasta dónde estira
  let y0 = 0, tirando = false, listo = false, ocupado = false;

  const ind = document.createElement('div');
  ind.id = 'tirar-ind';
  /* Flecha CIRCULAR, la de "recargar" de toda la vida. Antes era una
     flecha recta girando sobre sí misma, que no significa nada y quedaba
     rara. Esta es un arco con su punta: se entiende sola. */
  ind.innerHTML = `<div class="ti-c">
    <svg viewBox="0 0 24 24" class="ti-i" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
      <path d="M21 3v6h-6"/>
    </svg>
    <span class="ti-t">Tira para actualizar</span>
  </div>`;
  document.body.appendChild(ind);

  const poner = (d) => {
    const p = Math.min(d, TOPE);
    ind.style.transform = `translateY(${p}px)`;
    ind.style.opacity = String(Math.min(1, p / UMBRAL));
    const nuevo = p >= UMBRAL;
    if (nuevo !== listo) {
      listo = nuevo;
      ind.classList.toggle('listo', listo);
      ind.querySelector('.ti-t').textContent = listo ? 'Suelta para actualizar' : 'Tira para actualizar';
      if (listo && navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }
    }
  };
  const soltar = () => { ind.style.transform = ''; ind.style.opacity = ''; ind.classList.remove('listo'); };

  document.addEventListener('touchstart', (e) => {
    if (ocupado || e.touches.length !== 1) return;
    if (window.scrollY > 4) return;                        // solo desde arriba del todo
    if (document.querySelector('#adm-panel, #conf-box, .ad-conf, #cmov')) return;
    if (enZonaProhibida(e.target)) return;
    y0 = e.touches[0].clientY; tirando = true; listo = false;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!tirando) return;
    const d = e.touches[0].clientY - y0;
    if (d <= 0 || window.scrollY > 4) { tirando = false; soltar(); return; }
    poner(d * 0.55);                                       // resistencia, como en las apps
  }, { passive: true });

  document.addEventListener('touchend', async () => {
    if (!tirando) return;
    tirando = false;
    if (!listo) { soltar(); return; }
    ocupado = true;
    ind.classList.add('girando');
    ind.querySelector('.ti-t').textContent = 'Actualizando…';

    /* TOPE DE TIEMPO. Si una de las peticiones no responde nunca (pasa con
       la blockchain), el indicador se quedaba girando para siempre. Ahora
       se cierra a los 1,2 s pase lo que pase: la actualización sigue por
       detrás, pero el usuario no se queda mirando una rueda infinita. */
    const cerrar = () => {
      ind.classList.remove('girando');
      soltar();
      ocupado = false;
    };
    const tope = setTimeout(cerrar, 1200);
    try { await alSoltar(); } catch (_) {}
    clearTimeout(tope);
    setTimeout(cerrar, 200);
  }, { passive: true });
}

function estilos() {
  if ($('gestos-css')) return;
  const s = document.createElement('style'); s.id = 'gestos-css';
  s.textContent = `
  #tirar-ind{position:fixed;top:-58px;left:0;right:0;z-index:9600;display:flex;justify-content:center;pointer-events:none;opacity:0;transition:transform .18s ease,opacity .18s ease}
  #tirar-ind .ti-c{display:inline-flex;align-items:center;gap:9px;padding:9px 16px;border-radius:22px;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid #3a424c;box-shadow:0 8px 22px rgba(0,0,0,.55);color:#8b96a3;font-family:var(--sans,sans-serif);font-size:12.5px}
  #tirar-ind.listo .ti-c{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #tirar-ind .ti-i{width:16px;height:16px;flex:0 0 auto;transition:transform .2s ease}
  #tirar-ind.listo .ti-i{transform:rotate(-90deg);color:var(--gold,#E8B84B)}
  #tirar-ind.girando .ti-i{animation:tiGira .8s linear infinite}
  @keyframes tiGira{to{transform:rotate(360deg)}}
  @media(prefers-reduced-motion:reduce){
    #tirar-ind{transition:none}
    #tirar-ind.girando .ti-i{animation:none}
  }`;
  document.head.appendChild(s);
}
