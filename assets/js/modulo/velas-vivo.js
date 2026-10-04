/* velas-vivo.js — Mueve la última vela en TIEMPO REAL con el WebSocket de Binance.
   ──────────────────────────────────────────────────────────────────────────
   Problema que resuelve: la gráfica se refrescaba cada 30s por REST (una foto),
   así que la vela en formación NO se movía: parecía congelada hasta que salía la
   siguiente. Crítico para Sprint Scalper (el precio quedaba "congelado" y operar
   por tiempo era como operar siempre al mismo precio).
   Solución: el stream @kline de Binance empuja CADA tick de la vela abierta.
   · k.x === false → vela en formación: reemplazamos la última vela y redibujamos.
   · k.x === true  → vela cerrada: la fijamos y empezamos la siguiente.
   Así la vela se mueve orgánica (cuerpo y mechas cambiando), como IQ Option.

   Uso:
     import { velasVivoConectar, velasVivoCerrar } from './modulo/velas-vivo.js';
     velasVivoConectar(simbolo, tf, N, redibujar);   // al abrir/cambiar par o tf
     velasVivoCerrar();                               // al salir o antes de reconectar
*/

let _ws = null;
let _simbolo = '', _tf = '';

// mapea la temporalidad del frontend al intervalo de Binance
function intervaloBinance(tf) {
  // Binance soporta: 1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d,3d,1w,1M
  const ok = ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w'];
  return ok.includes(tf) ? tf : '1m';
}

export function velasVivoCerrar() {
  if (_ws) {
    try { _ws.onopen = _ws.onmessage = _ws.onerror = _ws.onclose = null; _ws.close(); } catch (_) {}
    _ws = null;
  }
}

export function velasVivoConectar(simbolo, tf, N, redibujar) {
  velasVivoCerrar();
  _simbolo = (simbolo || '').toLowerCase();
  _tf = intervaloBinance(tf);
  if (!_simbolo) return;

  const url = `wss://stream.binance.com:9443/ws/${_simbolo}@kline_${_tf}`;
  let ws;
  try { ws = new WebSocket(url); } catch (_) { return; }
  _ws = ws;

  ws.onmessage = (ev) => {
    if (ws !== _ws) return;   // conexión vieja: ignorar
    let m;
    try { m = JSON.parse(ev.data); } catch (_) { return; }
    const k = m.k; if (!k) return;

    const vela = {
      t: k.t,
      o: Number(k.o), h: Number(k.h), l: Number(k.l), c: Number(k.c),
      v: Number(k.v)
    };
    if (!N.velas || !N.velas.length) return;

    const ult = N.velas[N.velas.length - 1];
    if (ult && ult.t === vela.t) {
      // misma vela (en formación): reemplazar la última con los valores en vivo
      N.velas[N.velas.length - 1] = vela;
    } else if (!ult || vela.t > ult.t) {
      // vela nueva: añadir (y mantener la ventana acotada para no crecer sin fin)
      N.velas.push(vela);
      if (N.velas.length > 1200) N.velas.shift();
    } else {
      return; // vela vieja fuera de orden: ignorar
    }
    // precio en vivo para el resto de la UI
    N.precio = vela.c;
    // redibujar la gráfica (ligero: solo canvas)
    try { redibujar(); } catch (_) {}
  };

  ws.onerror = () => { /* silencioso: si el WS falla, el REST de respaldo sigue */ };
  ws.onclose = () => { if (ws === _ws) _ws = null; };
}
