/* movil/alerta.js — Alerta de precio DIRECTA (no abre Tools). Elige moneda
   (si no viene dada) y precio; guarda en el mismo sistema que Smart Levels. */

import { abrirPicker } from './picker.js?v=1';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let _pares = [];

export async function abrirAlerta(par) {
  if (!_pares.length) { try { const c = await import('../niveles/config.js?v=1'); _pares = (c.PARES || []).slice(); } catch (_) { _pares = []; } }
  if (par && par.id) return dialogo(par);
  abrirPicker('Alerta de precio', _pares, (id) => { const p = _pares.find((x) => x.id === id); if (p) dialogo(p); });
}

function dialogo(par) {
  let sh = document.getElementById('mv-sheet'); if (sh) sh.remove();
  sh = document.createElement('div'); sh.id = 'mv-sheet';
  sh.innerHTML = `<div class="mv-sheet-bg"></div><div class="mv-sheet-card al-card">
    <button class="mv-sheet-x">✕</button>
    <div class="al-h"><b>Alerta · ${esc(par.id)}</b><span>We'll notify you when it reaches the price</span></div>
    <div class="op-field al-field"><span>Precio</span><input id="al-price" inputmode="decimal" placeholder="0.00"><b>USDT</b></div>
    <button class="al-ok" id="al-ok">Crear alerta</button>
    <button class="al-cancel">Cancelar</button></div>`;
  document.body.appendChild(sh);
  const cerrar = () => sh.remove();
  sh.querySelector('.mv-sheet-bg').onclick = cerrar;
  sh.querySelector('.mv-sheet-x').onclick = cerrar;
  sh.querySelector('.al-cancel').onclick = cerrar;
  sh.querySelector('#al-ok').onclick = async () => {
    const val = parseFloat(String((document.getElementById('al-price') || {}).value).replace(',', '.')) || 0;
    if (!(val > 0)) return;
    let actual = 0;
    try { const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${par.s}`); if (r.ok) actual = +(await r.json()).price; } catch (_) {}
    try {
      const K = 'cco-ordenes-aviso';
      const l = JSON.parse(localStorage.getItem(K) || '[]');
      l.push({ par: par.id, simbolo: par.s, precio: val, cant: 0, vender: actual ? val > actual : false, sl: 0, cuando: Date.now(), id: Date.now() + '-' + Math.random().toString(36).slice(2, 7) });
      localStorage.setItem(K, JSON.stringify(l.slice(-40)));
    } catch (_) {}
    cerrar();
    toast('Alerta creada', `Te avisaremos cuando ${par.id} llegue a ${val} USDT.`);
  };
  setTimeout(() => { const i = document.getElementById('al-price'); if (i) i.focus(); }, 60);
}

function toast(t, s) {
  let d = document.getElementById('mv-toast');
  if (!d) { d = document.createElement('div'); d.id = 'mv-toast'; document.body.appendChild(d); }
  d.innerHTML = `<b>${esc(t)}</b><br><span>${esc(s)}</span>`;
  d.classList.add('show'); clearTimeout(d._t); d._t = setTimeout(() => d.classList.remove('show'), 3000);
}
