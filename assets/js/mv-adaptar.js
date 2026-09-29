/* mv-adaptar.js — Adaptación universal de la interfaz móvil al dispositivo.

   Archivo INDEPENDIENTE: no modifica ningún módulo existente. Se limita a medir
   el área realmente visible del navegador donde se abre la página (sea Trust
   Wallet, MetaMask, Safari, Chrome o cualquier otro) y a colocar el contenedor
   y la barra inferior dentro de ella.

   Cómo mide, sin adivinar:
   · Usa visualViewport, que informa del alto y del desplazamiento reales tras
     descontar las barras del navegador.
   · La barra inferior se ancla al fondo de esa área visible, midiéndola.
   · No usa números fijos por wallet: si un navegador cambia sus barras (o las
     quita el día de mañana), la medida se recalcula sola y todo se reajusta.

   Se recalcula cuando el navegador muestra u oculta sus barras, al girar el
   teléfono, al cambiar de pantalla y varias veces durante los primeros segundos,
   porque algunos navegadores ajustan su interfaz con retraso. */

(function () {
  if (window.__mvAdaptar) return;
  window.__mvAdaptar = true;

  function medir() {
    try {
      var vv = window.visualViewport;
      var alto   = Math.round(vv && vv.height    ? vv.height    : window.innerHeight);
      var arriba = Math.round(vv && vv.offsetTop  ? vv.offsetTop  : 0);
      var de = document.documentElement;
      de.style.setProperty('--mv-alto', alto + 'px');
      de.style.setProperty('--mv-top', arriba + 'px');

      var app = document.getElementById('mv-app');
      var nav = document.getElementById('mv-nav');
      var sc  = document.getElementById('mv-scroll');
      var altoNav = nav ? Math.round(nav.getBoundingClientRect().height) : 0;

      if (app) {
        app.style.position  = 'fixed';
        app.style.left = '0'; app.style.right = '0';
        app.style.top = arriba + 'px';
        app.style.bottom = 'auto';
        app.style.height = alto + 'px';
        app.style.maxHeight = alto + 'px';
        app.style.overflow = 'hidden';
      }
      if (nav) {
        // la barra se pega al fondo REAL del área visible, medido, no supuesto
        nav.style.position = 'fixed';
        nav.style.left = '0'; nav.style.right = '0';
        nav.style.top = (arriba + alto - altoNav) + 'px';
        nav.style.bottom = 'auto';
      }
      if (sc && altoNav) {
        // el contenido ocupa desde arriba hasta justo encima de la barra
        sc.style.position = 'absolute';
        sc.style.top = '0'; sc.style.left = '0'; sc.style.right = '0';
        sc.style.bottom = altoNav + 'px';
        sc.style.height = 'auto';
        sc.style.overflowY = 'auto';
      }
    } catch (_) {}
  }

  // expuesta por si algún módulo quiere forzar un recálculo tras repintar
  window.__mvMedir = medir;

  function arrancar() {
  // Inyectamos las reglas del compactado una sola vez. Usan la variable
  // --mv-compact (entre 0.7 y 1) para encoger separaciones proporcionalmente.
  (function () {
    if (document.getElementById('mv-compact-css')) return;
    var st = document.createElement('style');
    st.id = 'mv-compact-css';
    st.textContent = [
      ':root{--mv-compact:1}',
      '@media(max-width:900px){',
      '  #mv-scroll .mv-top{padding-top:calc((8px + env(safe-area-inset-top,0px)) * var(--mv-compact));padding-bottom:calc(6px * var(--mv-compact))}',
      '  #mv-scroll .mv-bal-lbl{margin:calc(8px * var(--mv-compact)) 0 calc(3px * var(--mv-compact))}',
      '  #mv-scroll .mv-cta{margin:calc(16px * var(--mv-compact)) 0 calc(4px * var(--mv-compact))}',
      '  #mv-scroll .mv-cta button{height:calc(52px * var(--mv-compact));min-height:42px}',
      '  #mv-scroll .mv-quick{margin:calc(6px * var(--mv-compact)) 0 calc(2px * var(--mv-compact));padding:calc(12px * var(--mv-compact)) 0 2px}',
      '  #mv-scroll .mv-strip{margin:calc(12px * var(--mv-compact)) 0 0;padding:calc(12px * var(--mv-compact)) 13px}',
      '  #mv-scroll .mv-sec-h{margin:calc(12px * var(--mv-compact)) 0 calc(7px * var(--mv-compact))}',
      '  #mv-scroll .mv-svc-card{height:calc(104px * var(--mv-compact));min-height:84px}',
      '  #mv-scroll .mv-qi .mv-qbox{width:calc(56px * var(--mv-compact));height:calc(56px * var(--mv-compact));min-width:44px;min-height:44px}',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  })();
  
    medir();
    addEventListener('resize', medir, { passive: true });
    addEventListener('orientationchange', function () { setTimeout(medir, 300); });
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', medir, { passive: true });
      visualViewport.addEventListener('scroll', medir, { passive: true });
    }
    // reintentos: los navegadores de wallet ajustan sus barras con retraso
    [100, 300, 700, 1400, 2500, 4000].forEach(function (t) { setTimeout(medir, t); });
    // el contenido del home tarda en aparecer; reintentamos el compactado
    [500, 1000, 1800, 3000].forEach(function (t) { setTimeout(compactarInicio, t); });
    // y cada vez que aparezca la barra por primera vez (la crea el módulo móvil)
    var intentos = 0;
    var iv = setInterval(function () {
      intentos++;
      if (document.getElementById('mv-nav')) { medir(); }
      if (intentos > 40) clearInterval(iv);
    }, 250);
  }


  /* ── Compactado del inicio para que quepa sin desplazarse ──────────────────
     Si el contenido del home es más alto que el área visible, encogemos las
     separaciones (no el tamaño de letra) por pasos, hasta que quepa o hasta un
     mínimo razonable. Solo actúa en el home y solo si hace falta; si el usuario
     está en otra pantalla, no toca nada. */
  function compactarInicio() {
    try {
      var sc = document.getElementById('mv-scroll');
      if (!sc) return;
      var esHome = !!sc.querySelector('.mv-bal, .mv-cta');
      if (!esHome) {
        // restaurar si veníamos de escalar
        if (sc.__envoltura) { desenvolver(sc); }
        sc.style.overflowY = '';
        return;
      }
      // Envolvemos TODO el contenido del scroll en un solo contenedor, una vez,
      // para poder escalarlo como bloque. Los hijos sueltos no se pueden escalar
      // juntos de otra forma.
      var env = sc.__envoltura;
      if (!env) {
        env = document.createElement('div');
        env.className = 'mv-esc-env';
        env.style.transformOrigin = 'top center';
        while (sc.firstChild) env.appendChild(sc.firstChild);
        sc.appendChild(env);
        sc.__envoltura = env;
      }
      env.style.transform = 'none';
      env.style.width = '100%';
      var hVis = sc.clientHeight;
      var hCont = env.scrollHeight;
      if (!hVis || !hCont) return;
      if (hCont > hVis + 1) {
        var esc = Math.max(0.70, hVis / hCont);
        env.style.transform = 'scale(' + esc.toFixed(3) + ')';
        env.style.width = (100 / esc).toFixed(2) + '%';
        sc.style.overflowY = 'hidden';
      } else {
        env.style.transform = '';
        env.style.width = '';
        sc.style.overflowY = 'auto';
      }
    } catch (_) {}
  }
  function desenvolver(sc) {
    try {
      var env = sc.__envoltura; if (!env) return;
      while (env.firstChild) sc.insertBefore(env.firstChild, env);
      sc.removeChild(env); sc.__envoltura = null;
    } catch (_) {}
  }
  // se recalcula junto con la medida del área
  var _medirBase = window.__mvMedir;
  window.__mvMedir = function () {
    if (_medirBase) _medirBase();
    compactarInicio();
  };
  
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
