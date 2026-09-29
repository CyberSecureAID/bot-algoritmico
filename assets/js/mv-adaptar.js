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
    medir();
    addEventListener('resize', medir, { passive: true });
    addEventListener('orientationchange', function () { setTimeout(medir, 300); });
    if (window.visualViewport) {
      visualViewport.addEventListener('resize', medir, { passive: true });
      visualViewport.addEventListener('scroll', medir, { passive: true });
    }
    // reintentos: los navegadores de wallet ajustan sus barras con retraso
    [100, 300, 700, 1400, 2500, 4000].forEach(function (t) { setTimeout(medir, t); });
    // y cada vez que aparezca la barra por primera vez (la crea el módulo móvil)
    var intentos = 0;
    var iv = setInterval(function () {
      intentos++;
      if (document.getElementById('mv-nav')) { medir(); }
      if (intentos > 40) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
