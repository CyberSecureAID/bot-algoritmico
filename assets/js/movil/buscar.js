/* movil/buscar.js — Búsqueda global del móvil. Indexa TODOS los servicios y
   TODAS las monedas de la plataforma; filtra por nombre al escribir y abre lo
   que elijas. No inventa: solo enruta a lo que ya existe. */

import { IC } from './iconos.js?v=2';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SERVICIOS = [
  { t: 'Bots', k: 'bots', ic: 'bot', d: 'Crear bots de trading' },
  { t: 'Swap', k: 'swap', ic: 'swap', d: 'Intercambiar cripto' },
  { t: 'P2P Market', k: 'market', ic: 'market', d: 'Buy and sell peer to peer' },
  { t: 'Wallet Shield', k: 'shield', ic: 'shield', d: 'Check permissions and protect your funds' },
  { t: 'Smart Levels', k: 'niveles', ic: 'chart', d: 'Análisis y operar en gráfica' },
  { t: 'Lógica Estructural Avanzada', k: 'muros', ic: 'candles', d: 'Flujo de órdenes' },
  { t: 'Liquidity Pools', k: 'liquidity', ic: 'pool', d: 'Profundidad y liquidez' },
  { t: 'Herramientas', k: 'tools', ic: 'tools', d: 'Utilidades de trading' },
  { t: 'Academia', k: 'academy', ic: 'book', d: 'Aprende a operar' },
  { t: 'Prize Pool', k: 'prize', ic: 'trophy', d: 'Fondo comunitario' },
  { t: 'Perfil', k: 'perfil', ic: 'user', d: 'Tu cuenta' },
  { t: 'Soporte', k: 'soporte', ic: 'support', d: 'Chatbot de ayuda' },
];

let _pares = [];

export async function abrirBuscar(api) {
  if (!_pares.length) { try { const c = await import('../niveles/config.js?v=1'); _pares = (c.PARES || []).slice(); } catch (_) { _pares = []; } }

  let m = document.getElementById('mv-buscar'); if (m) m.remove();
  m = document.createElement('div');
  m.id = 'mv-buscar';
  m.innerHTML = `
    <div class="mv-bs-top">
      <div class="mv-search" style="flex:1"><span class="mv-search-ic">${IC.search}</span><input id="mv-bs-input" placeholder="Busca servicios, ofertas, monedas…" autocomplete="off"></div>
      <button class="mv-bs-cancel" id="mv-bs-cancel">Cancelar</button>
    </div>
    <div id="mv-bs-res" class="mv-bs-res"></div>`;
  document.body.appendChild(m);

  const inp = document.getElementById('mv-bs-input');
  const res = document.getElementById('mv-bs-res');
  const cerrar = () => m.remove();
  document.getElementById('mv-bs-cancel').onclick = cerrar;

  const pintar = () => {
    const q = inp.value.trim().toLowerCase();
    const servs = SERVICIOS.filter((s) => !q || (s.t + ' ' + s.d).toLowerCase().includes(q));
    const coins = q ? _pares.filter((p) => (p.id + ' ' + p.n + ' ' + p.s).toLowerCase().includes(q)).slice(0, 20) : [];
    let html = '';
    if (servs.length) {
      html += `<div class="mv-bs-sub">Servicios</div>` + servs.map((s) => `
        <button class="mv-bs-item" data-serv="${s.k}"><span class="mv-bs-ic">${IC[s.ic] || ''}</span><div><b>${esc(s.t)}</b><small>${esc(s.d)}</small></div></button>`).join('');
    }
    if (coins.length) {
      html += `<div class="mv-bs-sub">Monedas</div>` + coins.map((p) => `
        <button class="mv-bs-item" data-coin="${esc(p.id)}"><span class="mv-bs-ic">${IC.candles}</span><div><b>${esc(p.s)}</b><small>${esc(p.n)}</small></div></button>`).join('');
    }
    if (!servs.length && !coins.length) html = `<div class="mv-empty">Sin resultados para “${esc(q)}”.</div>`;
    res.innerHTML = html;
    res.querySelectorAll('[data-serv]').forEach((b) => b.onclick = () => { cerrar(); api.abrir(b.getAttribute('data-serv')); });
    res.querySelectorAll('[data-coin]').forEach((b) => b.onclick = () => { cerrar(); if (api.abrirGrafica) api.abrirGrafica('niveles', _pares.find((x) => x.id === b.getAttribute('data-coin'))); else api.abrir('niveles'); });
  };
  inp.oninput = pintar;
  pintar();
  setTimeout(() => inp.focus(), 60);
}
