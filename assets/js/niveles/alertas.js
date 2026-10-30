/* niveles/alertas.js — Alertas de Marea: sonido, notificaciones del
   sistema y sondeo periódico del mercado. Extraído de niveles.js sin
   cambiar la lógica (solo activarAlertasMarea ahora recibe par y tf). */

import { N } from './estado.js?v=1';
import { fmt } from './util.js?v=1';
import { traerVelas, calcularATR, marea } from './motor.js?v=1';

let _alertaInt = null;
let _audioCtx = null;

function desbloquearAudio() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
  } catch (_) {}
}

function sonarAlerta(alc) {
  try {
    desbloquearAudio();
    if (!_audioCtx) return;
    const t0 = _audioCtx.currentTime;
    // dos tonos: ascendente y claro para LONG, descendente y grave para SHORT
    const notas = alc ? [660, 990] : [494, 330];
    notas.forEach((f, i) => {
      const o = _audioCtx.createOscillator(), gg = _audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = t0 + i * 0.19;
      gg.gain.setValueAtTime(0.0001, t);
      gg.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      o.connect(gg); gg.connect(_audioCtx.destination);
      o.start(t); o.stop(t + 0.19);
    });
  } catch (_) {}
}

async function notificar(titulo, cuerpo) {
  const opts = { body: cuerpo, tag: 'marea', renotify: true, requireInteraction: false };
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    /* En el móvil (Android/Chrome) el constructor Notification NO
       funciona: hay que usar el service worker si lo hay. En escritorio
       vale el constructor directo. */
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) { await reg.showNotification(titulo, opts); return true; }
      } catch (_) {}
    }
    const n = new Notification(titulo, opts);
    setTimeout(() => { try { n.close(); } catch (_) {} }, 12000);
    return true;
  } catch (_) { return false; }
}

function notificarSenal(alc, par, precio) {
  const dir = alc ? 'LONG' : 'SHORT';
  const flecha = alc ? '🟢 ▲' : '🔴 ▼';
  // notificación del sistema (suena y aparece aunque estés en otra app/ventana)
  notificar(
    `${flecha} ${dir} · ${par}`,
    `Marea detectó un cambio de ciclo ${alc ? 'al alza' : 'a la baja'} en ${fmt(precio)}. Indicador: Marea · Par: ${par}.`
  );
  // sonido siempre (mientras la página viva)
  sonarAlerta(alc);
  // y un aviso visible dentro de la app, por si está en primer plano
  avisoMarea(`${dir} en ${par} · ${fmt(precio)}`);
}

/* Aviso breve en pantalla (no hay uno en el proyecto, así que uno mínimo) */
export function avisoMarea(msg) {
  const prev = document.getElementById('nv-aviso-al'); if (prev) prev.remove();
  const a = document.createElement('div');
  a.id = 'nv-aviso-al';
  a.textContent = msg;
  a.style.cssText = 'position:fixed;z-index:10011;left:50%;top:18px;transform:translateX(-50%);' +
    'background:#1b2027;color:#eaecef;border:1px solid #C9A84B;border-radius:10px;' +
    'padding:10px 14px;font:600 12px/1.3 ui-monospace,monospace;max-width:82vw;text-align:center;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.6)';
  document.body.appendChild(a);
  setTimeout(() => a.remove(), 4200);
}

async function sondearMarea() {
  if (!N.alertas) return;
  try {
    const v = await traerVelas(N.alertaPar, N.alertaTf, 300);
    const r = marea(v, calcularATR(v));
    if (!r || !r.ultima) return;
    const sg = r.ultima;
    /* Una señal es NUEVA si su vela es posterior a la última que ya
       avisamos. No se mira "cuántas velas hace": una señal recién
       confirmada ancla su tachuela unas velas atrás (la confirmación
       tarda), así que exigir que fuera de las últimas 1-2 velas se
       comería casi todos los avisos. Al activar las alertas se marca la
       señal vigente como ya vista, de modo que solo avisa de las que
       aparezcan de ahí en adelante. */
    if (sg.t > (N.alertaUltimaTs || 0)) {
      N.alertaUltimaTs = sg.t;
      const alc = sg.dir === 'compra';
      const dir = N.alertaDir || { long: true, short: true };
      // solo avisa de la dirección que el usuario eligió para Marea
      if ((alc && dir.long) || (!alc && dir.short)) {
        notificarSenal(alc, N.alertaPar, sg.precio);
      }
    }
  } catch (_) { /* sin red: se reintenta en el próximo ciclo */ }
}

function arrancarSondeo() {
  pararSondeo();
  _alertaInt = setInterval(sondearMarea, 60000);   // cada minuto
}
function pararSondeo() { if (_alertaInt) { clearInterval(_alertaInt); _alertaInt = null; } }

export async function activarAlertasMarea(dLong, dShort, par, tf) {
  if (!('Notification' in window)) { avisoMarea('Este navegador no admite notificaciones'); return false; }
  let permiso = Notification.permission;
  if (permiso === 'default') {
    try { permiso = await Notification.requestPermission(); } catch (_) { permiso = 'denied'; }
  }
  if (permiso !== 'granted') { avisoMarea('Necesito permiso de notificaciones para avisarte'); return false; }
  desbloquearAudio();                         // el gesto del toque desbloquea el sonido
  N.alertas = true;
  N.alertaIndicador = 'marea';
  N.alertaPar = par;
  N.alertaTf = tf;
  N.alertaDir = { long: !!dLong, short: !!dShort };
  N.alertaUltimaTs = (N.marea && N.marea.ultima) ? N.marea.ultima.t : 0;
  arrancarSondeo();
  const quees = dLong && dShort ? 'LONG y SHORT' : (dLong ? 'LONG' : 'SHORT');
  notificar('Alertas activadas', `Te avisaré de las señales ${quees} de Marea en ${N.alertaPar}.`);
  sonarAlerta(true);
  avisoMarea(`Alertas de Marea (${quees}) activadas para ${N.alertaPar}.`);
  return true;
}

export function desactivarAlertas() {
  N.alertas = false; pararSondeo();
  avisoMarea('Alertas desactivadas');
}
