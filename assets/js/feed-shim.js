/* ══════════════════════════════════════════════════════════════════════════
   feed-shim.js — Datos de mercado accesibles desde cualquier país (incl. EE. UU.)

   PROBLEMA: Binance bloquea por región las IP de Estados Unidos y responde con
   error 451 en api.binance.com y stream.binance.com. Por eso, sin VPN, en EE. UU.
   las graficas mostraban "Could not load market data".

   SOLUCION: Binance publica endpoints OFICIALES de SOLO datos de mercado, sin
   cuenta ni API key y sin ese bloqueo regional:
       REST       api.binance.com        ->  data-api.binance.vision
       WebSocket  stream.binance.com     ->  data-stream.binance.vision
   Sirven exactamente los mismos datos y el MISMO formato. Aqui reescribimos solo
   el host (en fetch, WebSocket y XMLHttpRequest). Nada mas cambia: ningun modulo
   ni ningun parser se toca. Cualquier URL que no sea de Binance se deja intacta.

   Este script es "classic" y se carga lo primero en cada pagina, antes que los
   modulos, para que el parcheo ya este puesto cuando pidan datos.

   NOTA: los RPC de la blockchain (bsc-dataseed, etc.), el swap, el launchpad y
   el oraculo NO pasan por aqui y nunca estuvieron bloqueados: son on-chain.
   NOTA: los FUTUROS (fapi/fstream.binance.com, que usa el order flow) no tienen
   mirror publico; se dejan igual.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  try {
    var mapRest = function (u) {
      try { return String(u).replace(/https?:\/\/(api|api1|api2|api3|api-gcp)\.binance\.com/ig, 'https://data-api.binance.vision'); }
      catch (e) { return u; }
    };
    var mapWs = function (u) {
      try { return String(u).replace(/wss?:\/\/stream\.binance\.com(:\d+)?/ig, 'wss://data-stream.binance.vision'); }
      catch (e) { return u; }
    };

    /* 1) fetch */
    if (typeof window.fetch === 'function') {
      var _fetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        try {
          if (typeof input === 'string') input = mapRest(input);
          else if (input && typeof input.url === 'string') { var r = mapRest(input.url); if (r !== input.url) input = new Request(r, input); }
        } catch (e) {}
        return _fetch(input, init);
      };
    }

    /* 2) WebSocket */
    if (typeof window.WebSocket === 'function') {
      var _WS = window.WebSocket;
      var WS = function (url, protocols) {
        try { url = mapWs(url); } catch (e) {}
        return (protocols === undefined) ? new _WS(url) : new _WS(url, protocols);
      };
      WS.prototype = _WS.prototype;
      WS.CONNECTING = _WS.CONNECTING; WS.OPEN = _WS.OPEN; WS.CLOSING = _WS.CLOSING; WS.CLOSED = _WS.CLOSED;
      try { window.WebSocket = WS; } catch (e) {}
    }

    /* 3) XMLHttpRequest (por si algun modulo no usa fetch) */
    if (window.XMLHttpRequest && XMLHttpRequest.prototype && XMLHttpRequest.prototype.open) {
      var _open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url) {
        try { if (typeof url === 'string') { arguments[1] = mapRest(url); } } catch (e) {}
        return _open.apply(this, arguments);
      };
    }
  } catch (e) { /* si algo falla, no rompe la pagina: sigue el comportamiento normal */ }
})();
