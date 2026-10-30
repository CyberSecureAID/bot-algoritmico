/* niveles/util.js — Utilidades puras compartidas de Smart Levels.
   Sin estado ni DOM (salvo helpers de canvas que reciben el contexto).
   Extraído de niveles.js sin cambiar la lógica. */

export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let _semilla = 0;
export function elegir(opciones) {
  const i = Math.abs(Math.floor(_semilla)) % opciones.length;
  _semilla += 0.37;
  return opciones[i];
}
/** Re-siembra el generador (para que las frases varíen por par/hora). */
export function sembrar(v) { _semilla = v; }

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
