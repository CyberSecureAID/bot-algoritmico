/* niveles/i18n.js — Traducción de los textos del asistente.
   Los textos se escriben letra a letra, así que el traductor global no los
   alcanza; aquí se traducen antes de mostrarlos. Extraído de niveles.js. */

let _tr = null;
try {
  import('../idioma.js?v=127').then((m) => { _tr = m; }).catch(() => {});
} catch (_) {}

export const T = (txt) => {
  if (!_tr || !txt) return txt;
  try { return _tr.t(txt); } catch (_) { return txt; }
};
