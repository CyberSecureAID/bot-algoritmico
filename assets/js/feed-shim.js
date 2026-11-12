/* ══════════════════════════════════════════════════════════════════════════
   feed-shim.js  (v3 — failover a Binance.US SOLO ante geobloqueo real, con auto cura)

   PROBLEMA: Binance responde HTTP 451 por región en api.binance.com y
   stream.binance.com desde EE. UU. El espejo público data-api/
   data-stream.binance.vision resuelve muchos casos pero puede quedar bloqueado
   desde una IP residencial de EE. UU. El respaldo que SÍ responde desde EE. UU.
   es Binance.US (api/stream.binance.us).

   OJO (corregido en v3): Binance.US está pensado para EE. UU. y puede NO servir
   a usuarios de otros países (o no listar ciertos símbolos). Por eso saltar a
   Binance.US "a la primera" era un error: un simple hipo del WebSocket o un error
   de red transitorio hacía saltar a Binance.US a un usuario que NO está en EE. UU.
   y le rompía TODAS las gráficas (y quedaba pegado en sessionStorage).

   REGLA v3:
   · Solo se salta a Binance.US cuando .vision devuelve 451/403 (geobloqueo REAL,
     que en la práctica solo ve EE. UU.). Un error de red o un cierre de WebSocket
     NUNCA cambian de host.
   · AUTO CURA: si por lo que sea la preferencia quedó en Binance.US y una llamada
     a .us falla (porque el usuario no está en EE. UU.), se borra la preferencia y
     se vuelve a .vision. Así una sesión mal marcada se recupera sola.
   · El WebSocket solo SIGUE la preferencia que fijó el REST; no la cambia por su
     cuenta.

   Alcance quirúrgico: solo hosts *.binance.com. RPC/blockchain, CoinGecko,
   WalletConnect y los módulos con hosts .vision/.us directos (Spot) pasan intactos.
   Futuros (fapi/fstream) no se enrutan aquí.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  try {
    var KEY = 'cco_bin_region';          // '' = espejo .vision ; 'us' = Binance.US
    var _us = false;
    try { _us = sessionStorage.getItem(KEY) === 'us'; } catch (e) {}
    function prefUS() { try { return sessionStorage.getItem(KEY) === 'us'; } catch (e) { return _us; } }
    function setUS() { _us = true; try { sessionStorage.setItem(KEY, 'us'); } catch (e) {} }
    function clearUS() { _us = false; try { sessionStorage.removeItem(KEY); } catch (e) {} }

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

    /* 1) fetch con failover PRUDENTE (.vision <-> .us) */
    if (typeof window.fetch === 'function') {
      var _fetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        try {
          var url = (typeof input === 'string') ? input : (input && input.url);
          if (url && esRest(url)) {
            if (prefUS()) {
              /* Preferimos Binance.US (hubo 451 de .vision antes). Pero si .us
                 falla —p. ej. el usuario NO está en EE. UU. y .us lo bloquea o no
                 tiene el símbolo— se REVIERTE a .vision para no romper nada. */
              return _fetch(toUS(url), init).then(function (r) {
                if (r && (r.status === 451 || r.status === 403 || r.status === 400 || r.status === 404 || r.status >= 500)) { clearUS(); return _fetch(toVision(url), init); }
                return r;
              }, function () { clearUS(); return _fetch(toVision(url), init); });
            }
            /* Normal: .vision. SOLO si da 451/403 (geobloqueo REAL, EE. UU.) se
               salta a .us. Un error de red transitorio NO cambia de host. */
            return _fetch(toVision(url), init).then(function (r) {
              if (r && (r.status === 451 || r.status === 403)) { setUS(); return _fetch(toUS(url), init); }
              return r;
            });
          }
        } catch (e) {}
        return _fetch(input, init);
      };
    }

    /* 2) WebSocket: SOLO sigue la preferencia que fijó el REST. No la cambia por
       su cuenta (un hipo del WS ya no rompe nada ni manda a Binance.US). */
    if (typeof window.WebSocket === 'function') {
      var _WS = window.WebSocket;
      var WS = function (url, protocols) {
        var target = url;
        try { if (esWs(url)) target = prefUS() ? toUSWs(url) : toVisionWs(url); } catch (e) {}
        return (protocols === undefined) ? new _WS(target) : new _WS(target, protocols);
      };
      WS.prototype = _WS.prototype;
      WS.CONNECTING = _WS.CONNECTING; WS.OPEN = _WS.OPEN; WS.CLOSING = _WS.CLOSING; WS.CLOSED = _WS.CLOSED;
      try { window.WebSocket = WS; } catch (e) {}
    }

    /* 3) XMLHttpRequest: enruta al host preferido (best effort). */
    if (window.XMLHttpRequest && XMLHttpRequest.prototype && XMLHttpRequest.prototype.open) {
      var _open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url) {
        try { if (typeof url === 'string' && esRest(url)) { arguments[1] = prefUS() ? toUS(url) : toVision(url); } } catch (e) {}
        return _open.apply(this, arguments);
      };
    }
  } catch (e) { /* si algo falla, no rompe la página */ }
})();
