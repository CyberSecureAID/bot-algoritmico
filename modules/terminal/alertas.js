/* terminal/alertas.js. Watchlist y alertas de precio (modulo sellado). NO custodial, SIN servidor.
   La alerta NO es una orden ni toca fondos: solo AVISA (notificacion del navegador y aviso dentro de la
   app) cuando el precio toca tu objetivo, mientras el Terminal este abierto. Tu vendes a mano. Si el
   aviso falla, nadie pierde nada: se revisa a mano. Todo vive en el navegador (localStorage). */
import { precioUsdVivo } from './precio.js';

const KEY_A = 'df_terminal_alert_v1';
const KEY_W = 'df_terminal_watch_v1';
const low = (s) => String(s || '').toLowerCase();
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (_) { return []; } };
const esc = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

/* ───── Watchlist ───── */
export function listaWatch() { return leer(KEY_W); }
export function enWatch(token) { return leer(KEY_W).some((w) => low(w.token) === low(token)); }
export function alternarWatch(it) {
  const l = leer(KEY_W); const k = low(it.token); const i = l.findIndex((w) => low(w.token) === k);
  if (i >= 0) { l.splice(i, 1); esc(KEY_W, l); return false; }
  l.unshift({ token: it.token, simbolo: it.simbolo || '?', nombre: it.nombre || '', par: it.par || null, quote: it.quote || null, moneda: it.moneda || 'BNB', decimales: it.decimales || 18, ts: Date.now() });
  esc(KEY_W, l); return true;
}
export function quitarWatch(token) { esc(KEY_W, leer(KEY_W).filter((w) => low(w.token) !== low(token))); }

/* ───── Alertas ───── */
export function listaAlertas() { return leer(KEY_A); }
export function alertasDe(token) { return leer(KEY_A).filter((a) => low(a.token) === low(token)); }
export function crearAlerta(it, objetivoUsd, dir) {
  if (!(objetivoUsd > 0) || (dir !== 'up' && dir !== 'down')) return null;
  const l = leer(KEY_A);
  const a = { id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), token: it.token, simbolo: it.simbolo || '?', par: it.par || null, moneda: it.moneda || 'BNB', decimales: it.decimales || 18, fuentePrecio: it.fuentePrecio || 'v2', red: it.red || 'bsc', objetivo: objetivoUsd, dir, creada: Date.now(), disparada: false };
  l.unshift(a); esc(KEY_A, l);
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (_) {}
  return a;
}
export function quitarAlerta(id) { esc(KEY_A, leer(KEY_A).filter((a) => a.id !== id)); }
/* Marca como vistas las alertas ya disparadas (apaga el aviso rojo de la campanita). */
export function marcarVistas() { const l = leer(KEY_A); let c = false; for (const a of l) if (a.disparada && !a.visto) { a.visto = true; c = true; } if (c) esc(KEY_A, l); return c; }

/* ───── Vigilante: corre mientras el Terminal este abierto ───── */
let _timer = null;
export function arrancarVigilante(bnbUsdFn, onDisparo, cadaMs) {
  detenerVigilante();
  const ms = cadaMs || (typeof window !== 'undefined' && window.__alertMs) || 20000;
  const tic = async () => {
    try {
      // Vigila toda alerta cuyo precio sepamos leer: V2 necesita par; DexScreener y Tron NO (precioUsdVivo
      // usa el token). Antes el filtro exigia a.par, asi que las alertas de Tron (par=null) y de tokens sin
      // par V2 se creaban pero NUNCA se disparaban. Esa era una incongruencia real del feature multicadena.
      const vigilable = (a) => !!(a.par || a.fuentePrecio === 'dex' || a.fuentePrecio === 'tron');
      const activas = leer(KEY_A).filter((a) => !a.disparada && vigilable(a));
      if (activas.length) {
        const bnbUsd = (bnbUsdFn && bnbUsdFn()) || 0;
        const porToken = {};
        for (const a of activas) porToken[low(a.token)] = a;           // un precio por token
        const precios = {};
        await Promise.all(Object.values(porToken).map(async (a) => {
          precios[low(a.token)] = await precioUsdVivo(a, bnbUsd).catch(() => 0);
        }));
        const l = leer(KEY_A); let cambio = false;
        for (const a of l) {
          if (a.disparada || !vigilable(a)) continue;
          const p = precios[low(a.token)]; if (!(p > 0)) continue;
          const toca = a.dir === 'up' ? p >= a.objetivo : p <= a.objetivo;
          if (toca) { a.disparada = true; a.precioDisparo = p; a.cuando = Date.now(); cambio = true; notificar(a, p); if (onDisparo) try { onDisparo(a, p); } catch (_) {} }
        }
        if (cambio) esc(KEY_A, l);
      }
    } catch (_) {}
    _timer = setTimeout(tic, ms);
  };
  _timer = setTimeout(tic, Math.min(3000, ms));
}
export function detenerVigilante() { if (_timer) { clearTimeout(_timer); _timer = null; } }

/* Precio para el TEXTO de la notificacion (sin HTML, sin subindices). Decimal plano legible en vez de notacion
   exponencial fea (1.73e-4): para precios diminutos expande los ceros a mano con 4 cifras significativas. */
function fmtP(p) {
  if (!(p > 0) || !isFinite(p)) return '0';
  if (p >= 1) return String(Number(p.toPrecision(6)));
  if (p >= 0.001) return String(Number(p.toPrecision(4)));
  const e = Math.floor(Math.log10(p));
  let dig = Math.round(p / Math.pow(10, e - 3)), ceros = -e - 1;
  if (dig >= 1e4) { dig = Math.floor(dig / 10); ceros -= 1; }   // el redondeo cruzo una potencia de 10
  return '0.' + '0'.repeat(Math.max(0, ceros)) + String(dig).slice(0, 4);
}
let _icono; try { _icono = new URL('../../assets/img/cco-192.png', import.meta.url).href; } catch (_) { _icono = undefined; }
/* Muestra el aviso. En movil (Android/Chrome) el constructor new Notification() NO funciona: hay que usar
   el service worker (registration.showNotification). Si hay SW controlando la pagina lo usamos; si no (p.ej.
   escritorio sin SW), caemos al constructor clasico. Nunca lanza: si falla, nadie pierde nada. */
function notificar(a, p) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const titulo = 'DecFreedom Alerts';
    const opts = { body: a.simbolo + ' hit $' + fmtP(p) + ' (target $' + fmtP(a.objetivo) + '). Sell manually if you want.', tag: a.id, icon: _icono };
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(titulo, opts)).catch(() => directo(titulo, opts));
      return;
    }
    directo(titulo, opts);
  } catch (_) {}
}
function directo(titulo, opts) { try { const n = new Notification(titulo, opts); n.onclick = () => { try { window.focus(); } catch (_) {} }; } catch (_) {} }
