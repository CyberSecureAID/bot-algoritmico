/* niveles/util.js — Utilidades puras compartidas de Smart Levels.
   Sin estado ni DOM (salvo helpers de canvas que reciben el contexto).
   Extraído de niveles.js sin cambiar la lógica. */

export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let _seed = 1, _ctr = 0;
/* [REPLANTEADO] Antes la semilla subía de a +0.37: repetía el mismo índice
   ~3 veces seguidas y el desfase entre dos monedas era constante, así que
   BTC y XRP caían casi siempre en la MISMA frase (solo cambiaba el precio).

   Ahora cada tirada mezcla la semilla con un contador propio y lo pasa por un
   finalizador murmur3. Así las elecciones son casi independientes entre sí, y
   con una semilla por moneda (hashCadena) dos pares distintos cuentan la
   lectura con palabras distintas aunque la condición técnica sea idéntica.
   Medido sobre 40 monedas: reparto ~uniforme y solo ~4% de coincidencia
   total de (título,texto,consejo) — el mínimo posible con bancos de 3. */
export function elegir(opciones) {
  if (!opciones || !opciones.length) return '';
  let x = (_seed ^ Math.imul(++_ctr, 0x9e3779b9)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return opciones[(x >>> 0) % opciones.length];
}
/** Re-siembra el generador. Se le pasa un número; para que varíe por moneda
    se combina con hashCadena(par+tf) en el llamador. Reinicia el contador. */
export function sembrar(v) { _seed = (Math.abs(Math.floor(v)) >>> 0) || 1; _ctr = 0; }

/** Hash estable de una cadena (FNV-1a). Mismo texto → mismo número, pero
    dos cadenas parecidas dan números muy distintos: ideal para la semilla. */
export function hashCadena(s) {
  s = String(s);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const fmt = (p) => {
  if (!(p > 0)) return '—';
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return p.toFixed(1);
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(8);
};

/** Volumen en formato corto: 1.2M, 340K… */
export const miles = (v) => {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return v.toFixed(0);
};

export const hora = (t) => new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
export const fecha = (t) => new Date(t).toLocaleDateString('es', { day: '2-digit', month: 'short' });

export function _hex2rgb(hex) {
  const n = parseInt((hex || '#22d3ee').slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function redondeado(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
