/* logos.js — Respaldo automático para los logotipos de las monedas.

   Los logos se piden a un servidor de GitHub. Cuando ese servidor no responde,
   limita las peticiones o no tiene ese token, la imagen queda vacía y no hay
   segunda oportunidad. Este archivo añade esa segunda oportunidad: escucha los
   fallos de carga y reintenta con otros servidores, en orden, hasta dar con uno
   que tenga la imagen. Si ninguno la tiene, deja que actúe el respaldo que ya
   tuviera cada módulo (normalmente las iniciales de la moneda).

   No hay que tocar ningún otro archivo: funciona para cualquier imagen del sitio
   que apunte a un logo de token. */

(function () {
  if (window.__logosRespaldo) return;
  window.__logosRespaldo = true;

  // Servidores alternativos, en el orden en que se prueban.
  const FUENTES = [
    (a) => 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/' + a + '/logo.png',
    (a) => 'https://assets-cdn.trustwallet.com/blockchains/smartchain/assets/' + a + '/logo.png',
    (a) => 'https://tokens.pancakeswap.finance/images/' + a + '.png',
    (a) => 'https://dd.dexscreener.com/ds-data/tokens/bsc/' + a.toLowerCase() + '.png'
  ];

  /* Saca la dirección del token de una URL de logo, venga del servidor que venga. */
  function direccionDe(url) {
    if (!url) return null;
    const m = String(url).match(/(0x[0-9a-fA-F]{40})/);
    return m ? m[1] : null;
  }

  /* Al fallar una imagen de logo, probamos el siguiente servidor de la lista. */
  document.addEventListener('error', function (ev) {
    const img = ev.target;
    if (!img || img.tagName !== 'IMG') return;
    const url = img.getAttribute('src') || '';
    const addr = direccionDe(url);
    if (!addr) return;                      // no es un logo de token

    let paso = parseInt(img.dataset.logoPaso || '0', 10);
    paso++;
    if (paso >= FUENTES.length) return;     // agotadas: que actúe el respaldo propio
    img.dataset.logoPaso = String(paso);
    // evitamos que el fallo siga propagándose mientras reintentamos
    ev.stopImmediatePropagation();
    img.src = FUENTES[paso](addr);
  }, true);   // en captura: llegamos antes que el manejador propio de cada módulo
})();
