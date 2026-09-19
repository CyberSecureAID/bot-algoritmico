/* movil/markets.js — Pantalla 2 (Mercados). Lista TODAS las monedas de la
   plataforma (las de las gráficas), con logo real, precio y % 24h en vivo.
   Búsqueda que FILTRA la lista (no sale de la pantalla), favoritos, categorías,
   y al tocar una moneda un selector para ir a Smart Levels / Radar / Pools.

   Datos: CoinGecko /coins/markets (logo + precio + %24h, una sola llamada,
   cacheado 5 min). Binance de respaldo para precio. Todo defensivo. */

import { IC } from './iconos.js?v=1';
import { logoDe } from './fmt.js?v=2';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const MEMES = new Set(['DOGE', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'SHIB', 'ORDI']);
/* Logos para pares sin CoinGecko (divisas → banderas; oro → icono). */
const LOGO_ESPECIAL = {
  EUR: 'https://flagcdn.com/w80/eu.png',
  GBP: 'https://flagcdn.com/w80/gb.png',
  PAXG: 'https://assets.coingecko.com/coins/images/9519/small/paxgold.png',
};
const CATS = [
  { k: 'todas',   t: 'All' },
  { k: 'cripto',  t: 'Crypto' },
  { k: 'meme',    t: 'Memecoins' },
  { k: 'divisa',  t: 'Forex' },
  { k: 'materia', t: 'Commodities' },
];

let _pares = [];
let _cat = 'todas';
let _tab = 'spot';
let _q = '';
let _fav = cargarFav();
let _datos = {};             // cg -> { img, price, chg }
let _apiRef = null;

function cargarFav() { try { return new Set(JSON.parse(localStorage.getItem('mv-fav') || '[]')); } catch (_) { return new Set(); } }
function guardarFav() { try { localStorage.setItem('mv-fav', JSON.stringify([..._fav])); } catch (_) {} }

export async function pintarMercados(host, api) {
  _apiRef = api;
  if (!_pares.length) {
    try { const c = await import('../niveles/config.js?v=1'); _pares = (c.PARES || []).slice(); } catch (_) { _pares = []; }
  }
  host.innerHTML = `
    <div class="mv-top" style="padding-left:0;padding-right:0">
      <div class="mv-search" style="flex:1;cursor:text">${IC.search}<input id="mv-mk-q" placeholder="Search a coin…" autocomplete="off" value="${esc(_q)}"></div>
      <button class="mv-ico-btn" id="mv-mk-alert">${IC.bell}</button>
    </div>
    <div class="mv-mk-tabs">
      <button data-t="fav" class="${_tab === 'fav' ? 'on' : ''}">Favorites</button>
      <button data-t="spot" class="${_tab === 'spot' ? 'on' : ''}">Spot</button>
      <button data-t="fut" class="${_tab === 'fut' ? 'on' : ''}">Futures</button>
    </div>
    <div class="mv-mk-cats" id="mv-mk-cats">
      ${CATS.map((c) => `<button data-c="${c.k}" class="${c.k === _cat ? 'on' : ''}">${c.t}</button>`).join('')}
    </div>
    <div class="mv-mk-sort"><span>Coin</span><span>Last price / 24h</span></div>
    <div id="mv-mk-list"></div>
  `;

  const inp = $('mv-mk-q');
  inp.oninput = () => { _q = inp.value.trim().toLowerCase(); render(); };
  $('mv-mk-alert').onclick = () => api.abrir && api.abrir('alertasTool');
  host.querySelectorAll('.mv-mk-tabs button').forEach((b) => b.onclick = () => { const t = b.getAttribute('data-t'); if (t === 'fut') { try { api.irA && api.irA('futuros'); } catch (_) {} return; } _tab = t; host.querySelectorAll('.mv-mk-tabs button').forEach((x) => x.classList.toggle('on', x === b)); render(); });
  host.querySelectorAll('.mv-mk-cats button').forEach((b) => b.onclick = () => { _cat = b.getAttribute('data-c'); host.querySelectorAll('.mv-mk-cats button').forEach((x) => x.classList.toggle('on', x === b)); render(); });

  render();
  cargarDatos();          // logos + precios (en vivo, refresca al llegar)
}

function filtrar() {
  let l = _pares.slice();
  if (_tab === 'fav') l = l.filter((p) => _fav.has(p.id));
  if (_cat === 'cripto') l = l.filter((p) => (p.grupo || 'cripto') === 'cripto' && !MEMES.has(p.id));
  else if (_cat === 'meme') l = l.filter((p) => MEMES.has(p.id));
  else if (_cat === 'divisa') l = l.filter((p) => p.grupo === 'divisa');
  else if (_cat === 'materia') l = l.filter((p) => p.grupo === 'materia');
  if (_q) l = l.filter((p) => (p.id + ' ' + p.n + ' ' + p.s).toLowerCase().includes(_q));
  return l;
}

function render() {
  const cont = $('mv-mk-list'); if (!cont) return;
  const l = filtrar();
  if (!l.length) {
    cont.innerHTML = `<div class="mv-empty">${_tab === 'fav' ? 'No favorites yet. Tap the star on a coin.' : (_q ? 'No results for “' + esc(_q) + '”.' : 'No coins in this category.')}</div>`;
    return;
  }
  cont.innerHTML = l.map((p) => {
    const d = _datos[p.cg] || {};
    const chg = d.chg;
    const cls = chg == null ? 'fl' : (chg > 0 ? 'up' : (chg < 0 ? 'dn' : 'fl'));
    const chgTxt = chg == null ? '—' : (chg > 0 ? '+' : '') + Number(chg).toFixed(2) + '%';
    const precio = d.price == null ? '—' : fmtPrecio(d.price);
    const fav = _fav.has(p.id);
    const ini = esc(p.id.slice(0, 1));
    const logo = logoDe(p.id, p.cg, _datos) || d.img || LOGO_ESPECIAL[p.id] || '';
    return `<div class="mv-row" data-id="${esc(p.id)}">
      <button class="mv-favb ${fav ? 'on' : ''}" data-fav="${esc(p.id)}" aria-label="Favorito">${fav ? IC.star : starOutline()}</button>
      <div class="mv-ci" data-cg="${esc(p.cg || '')}"><span class="ico-fb">${ini}</span>${logo ? `<img src="${logo}" alt="" loading="lazy" onload="this.previousElementSibling.style.display='none'" onerror="this.remove()">` : ''}</div>
      <div class="mv-cn"><b>${esc(p.s)}</b><small>${esc(p.n)}</small></div>
      <div class="mv-cp"><b>${precio}</b><small class="${cls}">${chgTxt}</small></div>
    </div>`;
  }).join('');

  cont.querySelectorAll('.mv-row').forEach((row) => {
    row.onclick = (e) => {
      if (e.target.closest('[data-fav]')) return;
      const id = row.getAttribute('data-id');
      const par = _pares.find((x) => x.id === id);
      if (_tab === 'fut') { try { api.irA && api.irA('futuros'); } catch (_) {} return; }
      selectorGrafica(par);
    };
  });
  cont.querySelectorAll('[data-fav]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.getAttribute('data-fav');
      if (_fav.has(id)) _fav.delete(id); else _fav.add(id);
      guardarFav();
      render();                 // re-render seguro (sin recargar datos)
    };
  });
}

function selectorGrafica(par) {
  if (!par) return;
  const api = _apiRef || {};
  let sh = $('mv-sheet'); if (sh) sh.remove();
  sh = document.createElement('div');
  sh.id = 'mv-sheet';
  const OPCIONES = [
    { g: 'grafica',   ic: IC.candles, t: 'Clean Chart',          s: 'Live candles (TradingView), free' },
    { g: 'niveles',   ic: IC.chart,   t: 'Smart Levels',         s: 'Levels and one-tap trading' },
    { g: 'muros',     ic: IC.book2 || IC.candles, t: 'Lógica Estructural Avanzada', s: 'Order flow and walls' },
    { g: 'liquidity', ic: IC.pool,    t: 'Liquidity Pools',      s: 'Depth and liquidity' },
  ];
  const fila = (o) => `<button class="mv-sheet-op" data-g="${o.g}">${o.ic}<div><b>${esc(o.t)}</b><small>${esc(o.s)}</small></div></button>`;
  sh.innerHTML = `
    <div class="mv-sheet-bg"></div>
    <div class="mv-sheet-card">
      <div class="mv-sheet-h"><b>${esc(par.id)} · ${esc(par.n)}</b><span>Choose the chart or indicator</span></div>
      <div class="mv-sheet-search">${IC.search}<input id="mv-ind-q" placeholder="Search indicator by name…" autocomplete="off"></div>
      <div class="mv-sheet-list" id="mv-ind-list">${OPCIONES.map(fila).join('')}</div>
      <button class="mv-sheet-cancel">Cancelar</button>
    </div>`;
  document.body.appendChild(sh);
  const cerrar = () => sh.remove();
  sh.querySelector('.mv-sheet-bg').onclick = cerrar;
  sh.querySelector('.mv-sheet-cancel').onclick = cerrar;
  const lista = $('mv-ind-list');
  const wire = () => sh.querySelectorAll('.mv-sheet-op').forEach((b) => {
    b.onclick = () => { cerrar(); api.abrirGrafica ? api.abrirGrafica(b.getAttribute('data-g'), par) : (api.abrir && api.abrir(b.getAttribute('data-g'))); };
  });
  wire();
  const q = $('mv-ind-q');
  if (q) q.oninput = () => {
    const t = q.value.trim().toLowerCase();
    const f = OPCIONES.filter((o) => o.t.toLowerCase().includes(t) || o.s.toLowerCase().includes(t));
    lista.innerHTML = f.length ? f.map(fila).join('') : `<div class="mv-empty" style="padding:20px">No indicators for “${esc(q.value)}”.</div>`;
    wire();
  };
}

/* ── Datos: logos + precio + %24h ── */
async function cargarDatos() {
  // 1) CoinGecko markets: logo + precio + %24h (crypto). Cache 5 min.
  try {
    const cache = JSON.parse(localStorage.getItem('mv-cg') || 'null');
    if (cache && Date.now() - cache.t < 300000) { _datos = cache.d; render(); }
  } catch (_) {}
  try {
    const ids = [...new Set(_pares.map((p) => p.cg).filter(Boolean))].join(',');
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=250`);
    if (r.ok) {
      const j = await r.json();
      j.forEach((x) => { _datos[x.id] = { img: x.image, price: x.current_price, chg: x.price_change_percentage_24h }; });
      try { localStorage.setItem('mv-cg', JSON.stringify({ t: Date.now(), d: _datos })); } catch (_) {}
      render();
    }
  } catch (_) {}
  // 2) Binance de respaldo para precio/%24h de TODOS los pares (incluye divisas/materias).
  try {
    const syms = _pares.map((p) => p.s).filter(Boolean);
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=' + encodeURIComponent(JSON.stringify(syms)));
    if (r.ok) {
      const arr = await r.json();
      const bySym = {}; arr.forEach((x) => bySym[x.symbol] = x);
      _pares.forEach((p) => {
        const b = bySym[p.s]; if (!b) return;
        const cur = _datos[p.cg] || {};
        _datos[p.cg] = { img: cur.img, price: Number(b.lastPrice), chg: Number(b.priceChangePercent) };
      });
      render();
    }
  } catch (_) {}
}

function fmtPrecio(p) {
  p = Number(p);
  if (!isFinite(p)) return '—';
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 3 });
  return p.toLocaleString('en-US', { maximumFractionDigits: 6 });
}
function starOutline() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>'; }
