/* market/ui.js — Base de ventanas del Marketplace: el contenedor overlay,
   su cierre y el diálogo de confirmación (Promise). Extraído de market.js. */

const $ = (id) => document.getElementById(id);

export function overlay() {
  let o = $('mk-overlay');
  if (o) return o;
  o = document.createElement('div'); o.id = 'mk-overlay';
  o.innerHTML = `<div class="mk-card" id="mk-card"></div>`;
  document.body.appendChild(o);
  o.addEventListener('click', (e) => { if (e.target === o) cerrar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  return o;
}
export function cerrar() { const o = $('mk-overlay'); if (o) o.classList.remove('show'); }

export function dialogo({ titulo, texto, ok = 'Continuar', cancelar = 'Ahora no', soloOk = false }) {
  return new Promise((res) => {
    const d = document.createElement('div');
    d.className = 'mk-dlg-bg';
    d.innerHTML = `<div class="mk-dlg">
      <div class="mk-dlg-t">${titulo}</div>
      <div class="mk-dlg-d">${texto}</div>
      <div class="mk-dlg-b">
        ${soloOk ? '' : `<button class="mk-b gris" data-no>${cancelar}</button>`}
        <button class="mk-b" data-si>${ok}</button>
      </div>
    </div>`;
    document.body.appendChild(d);
    const cerrar = (v) => { d.remove(); res(v); };
    d.querySelector('[data-si]').onclick = () => cerrar(true);
    const no = d.querySelector('[data-no]'); if (no) no.onclick = () => cerrar(false);
    d.onclick = (e) => { if (e.target === d) cerrar(false); };
  });
}

/* ── Marco del asistente (wizard): cabecera con paso, cuerpo y cierre ── */
export function cerrarWiz() { const e = $('mk-wiz'); if (e) e.remove(); }

export function marco(paso, total, titulo, sub, cuerpo, { atras = true, seguir = 'Continue', puedeSeguir = true } = {}) {
  cerrarWiz();
  const d = document.createElement('div');
  d.id = 'mk-wiz'; d.className = 'mk-wiz-bg';
  d.innerHTML = `<div class="mk-wiz-c">
    <button class="mk-wiz-x" id="wz-x">✕</button>
    <div class="mk-wiz-top">
      <div class="mk-wiz-pasos">${Array.from({ length: total }, (_, i) =>
        `<span class="mk-wiz-d ${i + 1 < paso ? 'ok' : (i + 1 === paso ? 'now' : '')}"></span>`).join('')}</div>
      <div class="mk-wiz-n">Step ${paso} of ${total}</div>
    </div>
    <div class="mk-wiz-t">${titulo}</div>
    ${sub ? `<div class="mk-wiz-s">${sub}</div>` : ''}
    <div class="mk-wiz-b">${cuerpo}</div>
    <div class="mk-wiz-acts">
      ${atras ? `<button class="mk-b gris" id="wz-atras">Back</button>` : ''}
      <button class="mk-b" id="wz-ok" ${puedeSeguir ? '' : 'disabled'}>${seguir}</button>
    </div>
    <div class="mk-msg info" id="wz-msg"></div>
  </div>`;
  document.body.appendChild(d);
  $('wz-x').onclick = cerrarWiz;
  d.onclick = (e) => { if (e.target === d) cerrarWiz(); };
  return d;
}
export function wmsg(t, c) { const m = $('wz-msg'); if (m) { m.className = 'mk-msg ' + (c || 'info'); m.textContent = t; } }

/* Mensaje de estado del panel (la banda #mk-msg). */
export function msg(t, c) { const m = $('mk-msg'); if (m) { m.className = 'mk-msg ' + (c || 'info'); m.textContent = t; } }
