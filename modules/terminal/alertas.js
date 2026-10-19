/* terminal/alertas.js. Watchlist y alertas de precio (modulo sellado). NO custodial, SIN servidor.
   La alerta NO es una orden ni toca fondos: solo AVISA (notificacion del navegador y aviso dentro de la
   app) cuando el precio toca tu objetivo, mientras el Terminal este abierto. Tu vendes a mano. Si el
   aviso falla, nadie pierde nada: se revisa a mano. Todo vive en el navegador (localStorage). */
import { precioActual } from './grafico.js';

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
  const a = { id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), token: it.token, simbolo: it.simbolo || '?', par: it.par || null, moneda: it.moneda || 'BNB', decimales: it.decimales || 18, objetivo: objetivoUsd, dir, creada: Date.now(), disparada: false };
  l.unshift(a); esc(KEY_A, l);
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (_) {}
  return a;
}
export function quitarAlerta(id) { esc(KEY_A, leer(KEY_A).filter((a) => a.id !== id)); }

/* ───── Vigilante: corre mientras el Terminal este abierto ───── */
let _timer = null;
export function arrancarVigilante(bnbUsdFn, onDisparo, cadaMs) {
  detenerVigilante();
  const ms = cadaMs || (typeof window !== 'undefined' && window.__alertMs) || 20000;
  const tic = async () => {
    try {
      const activas = leer(KEY_A).filter((a) => !a.disparada && a.par);
      if (activas.length) {
        const bnbUsd = (bnbUsdFn && bnbUsdFn()) || 0;
        const porToken = {};
        for (const a of activas) porToken[low(a.token)] = a;           // un precio por token
        const precios = {};
        await Promise.all(Object.values(porToken).map(async (a) => {
          precios[low(a.token)] = await precioActual({ par: a.par, token: a.token, decToken: a.decimales || 18, decQuote: 18, bnbUsd, quoteEsUSDT: a.moneda === 'USDT' }).catch(() => 0);
        }));
        const l = leer(KEY_A); let cambio = false;
        for (const a of l) {
          if (a.disparada || !a.par) continue;
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

function fmtP(p) { if (!(p > 0)) return '0'; if (p >= 1) return String(Number(p.toPrecision(6))); if (p >= 0.001) return String(Number(p.toPrecision(4))); return p.toExponential(2); }
function notificar(a, p) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification('DecFreedom Terminal', { body: a.simbolo + ' hit $' + fmtP(p) + ' (target $' + fmtP(a.objetivo) + '). Sell manually if you want.', tag: a.id });
      n.onclick = () => { try { window.focus(); } catch (_) {} };
    }
  } catch (_) {}
}
