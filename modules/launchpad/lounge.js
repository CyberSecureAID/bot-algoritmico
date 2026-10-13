/* launchpad/lounge.js. "Lounge", el robotito del launchpad.
   Cinco caras (img/lounge/lounge-1.webp a lounge-5.webp) superpuestas en el mismo sitio;
   se funden de una a otra al azar y cada gesto dura un tiempo distinto cada vez, para que
   nunca sea predecible. Flota todo el rato. Tiene dos sitios: "grande" (mientras se configura
   el token: arriba a la derecha en escritorio, arriba al centro en movil) y "rincon" (cuando
   el usuario termina: pequeno, en la esquina superior derecha, sin molestar). */

const CARAS = 5;
const RUTA = (i) => `./img/lounge/lounge-${i}.webp`;

let _el = null, _timer = null, _cara = 1, _listas = 0;

function _azar(min, max) { return min + Math.random() * (max - min); }

/* Duracion del gesto: casi siempre entre 2.5 y 7 s, a veces un parpadeo corto (0.9 a 1.6 s). */
function _duracion() { return Math.random() < 0.22 ? _azar(900, 1600) : _azar(2500, 7000); }

function _siguiente() {
  let n = _cara;
  while (n === _cara) n = 1 + Math.floor(Math.random() * CARAS);
  return n;
}

function _programar() {
  clearTimeout(_timer);
  _timer = setTimeout(() => {
    if (!_el) return;
    const n = _siguiente();
    _el.querySelectorAll('img').forEach((im) => im.classList.toggle('on', Number(im.dataset.i) === n));
    _cara = n;
    _programar();
  }, _duracion());
}

/* Monta el robot una sola vez. Si faltan las imagenes (aun no subidas), no se muestra nada. */
export function montarLounge() {
  if (_el) return _el;
  _el = document.createElement('div');
  _el.id = 'lp-lounge';
  _el.className = 'lp-lounge oculto';
  _el.setAttribute('aria-hidden', 'true');
  _el.innerHTML = Array.from({ length: CARAS }, (_, k) => `<img data-i="${k + 1}" src="${RUTA(k + 1)}" alt="" class="${k === 0 ? 'on' : ''}" decoding="async">`).join('');
  document.body.appendChild(_el);
  _el.querySelectorAll('img').forEach((im) => {
    im.onload = () => { _listas++; if (_listas === 1) { _el.classList.remove('oculto'); _programar(); } };
    im.onerror = () => { im.remove(); };
  });
  return _el;
}

/* "grande" en la portada; "junto" pegado a la tarjeta del asistente; "rincon" cuando termina. */
export function loungeModo(modo) {
  if (!_el) montarLounge();
  _el.classList.toggle('rincon', modo === 'rincon');
  _el.classList.toggle('junto', modo === 'junto');
}

export function loungeOcultar(si) { if (_el) _el.classList.toggle('fuera', !!si); }
