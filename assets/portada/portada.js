/* ══════════════════════════════════════════════════════════════════════════
   PORTADA · comportamiento
   ══════════════════════════════════════════════════════════════════════════

   Todo lo que hace este archivo, en orden:
     1. Cabecera: aparece la línea inferior al hacer scroll.
     2. Aparición suave de las secciones al entrar en pantalla.
     3. Precios reales de CoinGecko, solo cuando esa sección se ve.
     4. Botón "Instalar app": usa el aviso nativo del navegador si existe.
     5. Menús del teclado: cerrar con Escape.

   NO hace nada de esto:
     · no toca la wallet;
     · no llama a ningún contrato;
     · no escribe en localStorage;
     · no registra el service worker (de eso ya se encarga index.html).

   Sin librerías. Sin dependencias. Unos 4 KB.
   ══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var raiz = document.getElementById('pt');
  if (!raiz) return;

  var menosMovimiento = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;


  /* ── 0 · Apagar los fondos provisionales ───────────────────────────
     Cada hueco de imagen trae un degradado de reserva para que la portada
     se vea terminada aunque falten las fotos. En cuanto una imagen real
     esta puesta, ese degradado sobra: si se quedara, taparia la foto.
     Aqui se comprueba si la variable CSS resolvio a una imagen y se marca
     el elemento. Es la unica forma fiable de saberlo desde JS. */

  var conFondo = [
    ['.pt-hero__art', 'backgroundImage'],
    ['.pt-sec__art',  'backgroundImage']
  ];

  conFondo.forEach(function (par) {
    Array.prototype.forEach.call(raiz.querySelectorAll(par[0]), function (el) {
      var v = getComputedStyle(el)[par[1]];
      if (v && v !== 'none') el.classList.add('has-img');
    });
  });

  // El telefono lleva las capturas en capas hijas, no en el propio marco.
  Array.prototype.forEach.call(raiz.querySelectorAll('.pt-phone__scr'), function (el) {
    var capa = el.querySelector('.pt-phone__img--a');
    if (!capa) return;
    var v = getComputedStyle(capa).backgroundImage;
    if (v && v !== 'none') el.classList.add('has-img');
  });


  /* ── 1 · Cabecera ──────────────────────────────────────────────────
     Al pasar de 12px de scroll la cabecera se asienta: fondo más opaco y
     línea inferior. Se usa un flag para no tocar el DOM en cada evento. */

  var hdr = document.getElementById('pt-hdr');
  if (hdr) {
    var pegada = false;
    var mirarScroll = function () {
      var debe = window.scrollY > 12;
      if (debe !== pegada) {
        pegada = debe;
        hdr.classList.toggle('is-stuck', debe);
      }
    };
    window.addEventListener('scroll', mirarScroll, { passive: true });
    mirarScroll();
  }


  /* ── 2 · Aparición al entrar en pantalla ───────────────────────────
     Si el sistema pide menos movimiento, todo se muestra de golpe y ya.
     Si el navegador no tiene IntersectionObserver, igual: se muestra todo.
     Nunca se queda contenido invisible por un fallo del efecto. */

  var subir = raiz.querySelectorAll('.pt-rise');

  if (menosMovimiento || !('IntersectionObserver' in window)) {
    for (var i = 0; i < subir.length; i++) subir[i].classList.add('is-in');
  } else {
    var ojo = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        ojo.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    for (var j = 0; j < subir.length; j++) ojo.observe(subir[j]);
  }


  /* ── 3 · Precios reales ────────────────────────────────────────────
     Se piden a CoinGecko UNA sola vez, y solo cuando la sección de activos
     entra en pantalla. Así no se gasta una petición en quien no baja hasta
     ahí, y no se retrasa el pintado inicial.

     Si la petición falla (CoinGecko está bloqueado dentro de algunas
     wallets y a veces limita por IP), se quedan los guiones. No se inventa
     ningún número ni se muestra un error en pantalla. */

  var caja = document.getElementById('pt-precios');

  var monedas = function () {
    var url = 'https://api.coingecko.com/api/v3/simple/price'
            + '?ids=bitcoin,ethereum,binancecoin,solana,ripple'
            + '&vs_currencies=usd&include_24hr_change=true';

    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;

        Array.prototype.forEach.call(caja.querySelectorAll('[data-px]'), function (el) {
          var m = d[el.getAttribute('data-px')];
          if (!m || typeof m.usd !== 'number') return;
          el.textContent = '$' + m.usd.toLocaleString('en-US', {
            minimumFractionDigits: m.usd < 10 ? 4 : 2,
            maximumFractionDigits: m.usd < 10 ? 4 : 2
          });
        });

        Array.prototype.forEach.call(caja.querySelectorAll('[data-ch]'), function (el) {
          var m = d[el.getAttribute('data-ch')];
          var c = m && m.usd_24h_change;
          if (typeof c !== 'number') return;
          el.textContent = (c >= 0 ? '+' : '−') + Math.abs(c).toFixed(2) + '%';
          el.classList.add(c >= 0 ? 'pt-up' : 'pt-down');
        });
      })
      .catch(function () { /* se quedan los guiones */ });
  };

  if (caja) {
    if ('IntersectionObserver' in window) {
      var ojoPx = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        ojoPx.disconnect();
        monedas();
      }, { rootMargin: '260px' });
      ojoPx.observe(caja);
    } else {
      monedas();
    }
  }


  /* ── 4 · Instalar app ──────────────────────────────────────────────
     Si el navegador ofrece el aviso nativo de instalación, lo guardamos y
     lo usamos. Si no lo ofrece (Safari, o ya está instalada), el enlace
     sigue funcionando y lleva a la app, que tiene su propio tutorial de
     instalación. Nunca queda un botón que no hace nada. */

  var avisoInstalar = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    avisoInstalar = e;
  });

  Array.prototype.forEach.call(raiz.querySelectorAll('[data-pt-install]'), function (b) {
    b.addEventListener('click', function (ev) {
      if (!avisoInstalar) return;          // deja seguir el enlace normal
      ev.preventDefault();
      avisoInstalar.prompt();
      avisoInstalar.userChoice.finally(function () { avisoInstalar = null; });
    });
  });


  /* ── 5 · Teclado ───────────────────────────────────────────────────
     Los menús se abren por :hover y por :focus-within, que ya funciona con
     tabulador. Esto solo añade Escape para salir de un menú abierto. */

  raiz.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var a = document.activeElement;
    if (a && a.closest && a.closest('.pt-nav__item')) a.blur();
  });

})();
