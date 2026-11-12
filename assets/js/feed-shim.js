/* ══════════════════════════════════════════════════════════════════════════
   feed-shim.js  (v2 — failover a Binance.US)

   PROBLEMA: Binance bloquea por región las IP de EE. UU. y responde HTTP 451 en
   api.binance.com y stream.binance.com. El espejo público data-api/
   data-stream.binance.vision resuelve MUCHOS casos... pero se ha CONFIRMADO en
   producción (dos IP residenciales de EE. UU., dos estados distintos, en
   incógnito y con caché borrada) que desde una IP residencial de EE. UU. el
   espejo .vision TAMBIÉN puede quedar bloqueado. Lo que SÍ responde desde EE. UU.
   es Binance.US (api.binance.us / stream.binance.us:9443), que sirve el MISMO
   formato de API para los pares principales. (Spot ya lo demostró: con ese
   respaldo, Spot funciona perfecto desde EE. UU.)

   SOLUCIÓN: este shim intercepta fetch / WebSocket / XMLHttpRequest y, SOLO para
   las llamadas de datos de Binance (hosts *.binance.com), aplica un FAILOVER en
   cascada:
       1) data-api / data-stream . binance.vision   (espejo público, lo normal)
       2) api / stream . binance.us                 (respaldo que funciona en EE. UU.)
   Si el paso 1 da 451/403 o no conecta, salta al paso 2 y RECUERDA la preferencia
   en sessionStorage para el resto de la sesión (así no se reintenta el espejo en
   cada llamada). El formato es idéntico, así que NINGÚN módulo ni parser cambia.

   IMPORTANTE — alcance quirúrgico:
   · Solo se tocan los hosts *.binance.com (REST api.binance.com y WS
     stream.binance.com). Todo lo demás pasa intacto: blockchain/RPC, CoinGecko,
     WalletConnect, y los módulos que YA usan hosts .vision/.us directos (como
     modules/spot/datos.js, que trae su propio failover). A esos no se los toca.
   · Los FUTUROS (fapi/fstream.binance.com) no se enrutan aquí (no tienen espejo
     ni equivalente en .us). El patrón de host evita tocarlos.

   Se carga como primer <script> de cada página, antes que los módulos, para que
   el parcheo ya esté puesto cuando pidan datos.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  try {
    var KEY = 'cco_bin_region';          // '' = espejo .vision ; 'us' = Binance.US
    var _us = false;
    try { _us = sessionStorage.getItem(KEY) === 'us'; } catch (e) {}
    function prefUS() { try { return sessionStorage.getItem(KEY) === 'us'; } catch (e) { return _us; } }
    function setUS() { _us = true; try { sessionStorage.setItem(KEY, 'us'); } catch (e) {} }

    /* ── REST: ¿es datos de Binance spot (solo *.binance.com)? ── */
    var reCom = /^(?:https?:)?\/\/(?:api|api1|api2|api3|api-gcp)\.binance\.com(\/.*)?$/i;
    function esRest(u) { return reCom.test(String(u)); }
    function restPath(u) { var m = reCom.exec(String(u)); return m ? (m[1] || '') : ''; }
    function toVision(u) { return 'https://data-api.binance.vision' + restPath(u); }
    function toUS(u) { return 'https://api.binance.us' + restPath(u); }

    /* ── WebSocket: ¿es stream de Binance spot? ── */
    var reWs = /^wss?:\/\/stream\.binance\.com(?::\d+)?(\/.*)?$/i;
    function esWs(u) { return reWs.test(String(u)); }
    function wsPath(u) { var m = reWs.exec(String(u)); return m ? (m[1] || '') : ''; }
    function toVisionWs(u) { return 'wss://data-stream.binance.vision' + wsPath(u); }
    function toUSWs(u) { return 'wss://stream.binance.us:9443' + wsPath(u); }

    /* 1) fetch con failover TRANSPARENTE (.vision -> .us en 451/403 o fallo de red) */
    if (typeof window.fetch === 'function') {
      var _fetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        try {
          var url = (typeof input === 'string') ? input : (input && input.url);
          if (url && esRest(url)) {
            if (prefUS()) return _fetch(toUS(url), init);
            return _fetch(toVision(url), init).then(function (r) {
              if (r && (r.status === 451 || r.status === 403)) { setUS(); return _fetch(toUS(url), init); }
              return r;
            }, function () { setUS(); return _fetch(toUS(url), init); });
          }
        } catch (e) {}
        return _fetch(input, init);
      };
    }

    /* 2) WebSocket: host según preferencia + detector de fallo del espejo.
       No se proxyean los handlers del módulo; se añade un detector propio con
       addEventListener. Si el socket al espejo .vision se cierra/da error ANTES
       de abrir, se marca la preferencia a Binance.US. Como TODOS los módulos de
       gráfica reconectan en onclose, su siguiente intento ya sale por .us. */
    if (typeof window.WebSocket === 'function') {
      var _WS = window.WebSocket;
      var WS = function (url, protocols) {
        var target = url;
        try { if (esWs(url)) target = prefUS() ? toUSWs(url) : toVisionWs(url); } catch (e) {}
        var sock = (protocols === undefined) ? new _WS(target) : new _WS(target, protocols);
        try {
          if (esWs(url) && !prefUS()) {
            var abierto = false;
            sock.addEventListener('open', function () { abierto = true; });
            var fallo = function () { if (!abierto) setUS(); };   // el módulo reconecta solo -> saldrá por .us
            sock.addEventListener('error', fallo);
            sock.addEventListener('close', fallo);
          }
        } catch (e) {}
        return sock;
      };
      WS.prototype = _WS.prototype;
      WS.CONNECTING = _WS.CONNECTING; WS.OPEN = _WS.OPEN; WS.CLOSING = _WS.CLOSING; WS.CLOSED = _WS.CLOSED;
      try { window.WebSocket = WS; } catch (e) {}
    }

    /* 3) XMLHttpRequest (por si algún módulo no usa fetch): enruta al host
       preferido. Best effort, sin reintento (los módulos de datos usan fetch). */
    if (window.XMLHttpRequest && XMLHttpRequest.prototype && XMLHttpRequest.prototype.open) {
      var _open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url) {
        try { if (typeof url === 'string' && esRest(url)) { arguments[1] = prefUS() ? toUS(url) : toVision(url); } } catch (e) {}
        return _open.apply(this, arguments);
      };
    }
  } catch (e) { /* si algo falla, no rompe la página: sigue el comportamiento normal */ }
})();
