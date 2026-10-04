/* velas-vivo.js — Velas en TIEMPO REAL con fluidez total (como IQ Option).
   ──────────────────────────────────────────────────────────────────────────
   DOS técnicas combinadas para el movimiento fluido:
   1) @aggTrade: stream de Binance que empuja CADA operación individual (tick por
      tick), mucho más frecuente que @kline. Da el precio real más granular.
   2) @kline: marca los límites de cada vela (apertura/cierre del intervalo) para
      saber cuándo empieza una vela nueva y fijar la anterior.
   3) INTERPOLACIÓN (lerp) con requestAnimationFrame a 60fps: la vela no SALTA del
      precio A al B; se DESLIZA suavemente hacia el último precio real. Esto da la
      fluidez de mantequilla de las binarias. El movimiento SIGUE SIENDO REAL (los
      precios vienen del mercado); la interpolación solo suaviza el trayecto visual
      entre dos ticks reales consecutivos.

   Uso:
     import { velasVivoConectar, velasVivoCerrar } from './modulo/velas-vivo.js';
     velasVivoConectar(simbolo, tf, N, redibujar);
     velasVivoCerrar();
*/

let _wsK = null, _wsT = null;   // kline + aggTrade
let _raf = null;
let _N = null, _redibujar = null;
let _objetivo = null;   // precio real más reciente (destino de la interpolación)
let _tfMsActual = 60000;

const LERP = 0.18;   // velocidad de interpolación por frame (0-1). Más alto = más rápido.

function intervaloBinance(tf) {
  const ok = ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w'];
  return ok.includes(tf) ? tf : '1m';
}
function tfAms(tf) {
  const n = parseInt(tf); 
  if (tf.endsWith('m')) return n * 60000;
  if (tf.endsWith('h')) return n * 3600000;
  if (tf.endsWith('d')) return n * 86400000;
  if (tf.endsWith('w')) return n * 604800000;
  return 60000;
}

export function velasVivoCerrar() {
  for (const ws of [_wsK, _wsT]) {
    if (ws) { try { ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null; ws.close(); } catch (_) {} }
  }
  _wsK = _wsT = null;
  if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
  _objetivo = null;
}

export function velasVivoConectar(simbolo, tf, N, redibujar) {
  velasVivoCerrar();
  const sim = (simbolo || '').toLowerCase();
  const itv = intervaloBinance(tf);
  if (!sim) return;
  _N = N; _redibujar = redibujar; _tfMsActual = tfAms(itv);

  // ── 1) stream @kline: límites de vela (apertura/cierre) ──
  try {
    _wsK = new WebSocket(`wss://stream.binance.com:9443/ws/${sim}@kline_${itv}`);
    _wsK.onmessage = (ev) => {
      if (!_wsK) return;
      let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
      const k = m.k; if (!k || !N.velas || !N.velas.length) return;
      const vela = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v };
      const ult = N.velas[N.velas.length - 1];
      if (ult && ult.t === vela.t) {
        // misma vela: actualizar O/H/L/V del servidor (el cierre lo lleva aggTrade)
        ult.h = Math.max(ult.h, vela.h); ult.l = Math.min(ult.l, vela.l);
        ult.o = vela.o; ult.v = vela.v;
      } else if (!ult || vela.t > ult.t) {
        // vela NUEVA: fijar la anterior en su cierre real y empezar la nueva
        N.velas.push(vela);
        if (N.velas.length > 1200) N.velas.shift();
        _objetivo = vela.c;
      }
    };
    _wsK.onerror = () => {};
    _wsK.onclose = () => {};
  } catch (_) {}

  // ── 2) stream @aggTrade: cada operación real (tick granular) ──
  try {
    _wsT = new WebSocket(`wss://stream.binance.com:9443/ws/${sim}@aggTrade`);
    _wsT.onmessage = (ev) => {
      if (!_wsT) return;
      let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
      const precio = +m.p; if (!precio) return;
      _objetivo = precio;          // nuevo destino real para la interpolación
      N.precio = precio;           // precio en vivo para el resto de la UI
      // asegurar que la última vela existe; su cierre se mueve hacia _objetivo
      const ult = N.velas && N.velas.length ? N.velas[N.velas.length - 1] : null;
      if (ult) { ult.h = Math.max(ult.h, precio); ult.l = Math.min(ult.l, precio); }
    };
    _wsT.onerror = () => {};
    _wsT.onclose = () => {};
  } catch (_) {}

  // ── 3) bucle de interpolación a 60fps: desliza el cierre hacia _objetivo ──
  function frame() {
    _raf = requestAnimationFrame(frame);
    if (_objetivo == null || !_N || !_N.velas || !_N.velas.length) return;
    const ult = _N.velas[_N.velas.length - 1];
    if (!ult) return;
    const dif = _objetivo - ult.c;
    if (Math.abs(dif) < 1e-9) return;   // ya está en el destino: no redibujar
    // lerp: acercar el cierre al objetivo una fracción por frame (movimiento suave)
    ult.c += dif * LERP;
    if (Math.abs(_objetivo - ult.c) < Math.abs(_objetivo) * 1e-6) ult.c = _objetivo;
    // mechas acompañan si el precio interpolado las supera
    if (ult.c > ult.h) ult.h = ult.c;
    if (ult.c < ult.l) ult.l = ult.c;
    try { _redibujar(); } catch (_) {}
  }
  _raf = requestAnimationFrame(frame);
}
