/* movil/activos.js — Pantalla 4 (Activos). Tarjeta de balance + lista de
   monedas de la wallet (con logo), Recibir (QR), y herramientas repartidas:
   Colector de polvo y Alertas de precio. */

import { IC } from './iconos.js?v=1';
import * as wallet from '../wallet.js?v=125';
import { money, cantidad, logoDe } from './fmt.js?v=1';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const APP_NOMBRE = 'CriptoCuba Oficial';
const LOGO_ESP = { EUR: 'https://flagcdn.com/w80/eu.png', GBP: 'https://flagcdn.com/w80/gb.png' };
let _ojo = (() => { try { return localStorage.getItem('mv-ojo') === '1'; } catch (_) { return false; } })();
let _tab = 'spot';
let _cg = {};   // id -> cg
let _img = {};  // cg -> img url

export function pintarActivos(host, api) {
  const con = api.estaConectado();
  const b = api.balance();

  host.innerHTML = `
    <div class="mv-top" style="padding-left:0;padding-right:0">
      <b style="font-size:20px;font-weight:800">Activos</b>
      <div style="flex:1"></div>
      <button class="mv-ico-btn" id="ac-support" title="Soporte">${IC.support}</button>
      <button class="mv-ico-btn" id="ac-alert" title="Alertas de precio">${IC.bell}</button>
    </div>

    <div class="ac-card">
      <div class="ac-card-top">
        <span class="ac-lbl" id="ac-eye">Balance total ${IC.eye}</span>
        <span class="ac-brand">${esc(APP_NOMBRE)}</span>
      </div>
      <div class="ac-bal" id="ac-bal">—</div>
      <div class="ac-sub" id="ac-sub"></div>
      <div class="ac-acts">
        <button class="ac-act" id="ac-recv"><span>${IC.arrowDown}</span>Recibir</button>
        <button class="ac-act" id="ac-market"><span>${IC.market}</span>P2P</button>
        <button class="ac-act" id="ac-swap"><span>${IC.swap}</span>Swap</button>
        <button class="ac-act" id="ac-liq"><span>${IC.market}</span>Add liquidity</button>
      </div>
    </div>

    <div class="ac-tabs" id="ac-tabs">
      <button data-t="spot" class="${_tab === 'spot' ? 'on' : ''}">Spot</button>
      <button data-t="nfts" class="${_tab === 'nfts' ? 'on' : ''}">NFTs</button>
      <button data-t="activity" class="${_tab === 'activity' ? 'on' : ''}">Actividad</button>
      <div style="flex:1"></div>
      <button class="ac-dust" data-t="polvo">${IC.bolt} Polvo</button>
    </div>
    <div id="ac-list"></div>
  `;

  $('ac-support').onclick = () => api.abrir('soporte');
  $('ac-alert').onclick = () => api.abrir('alertasTool');
  $('ac-recv').onclick = () => api.abrir('recibir');
  $('ac-market').onclick = () => api.abrir('sell');
  $('ac-swap').onclick = () => api.abrir('swap');
  $('ac-liq').onclick = () => api.abrir('aportar');
  $('ac-eye').onclick = () => { _ojo = !_ojo; try { localStorage.setItem('mv-ojo', _ojo ? '1' : '0'); } catch (_) {} pintar(); };
  host.querySelectorAll('#ac-tabs button').forEach((btn) => btn.onclick = () => {
    const t = btn.getAttribute('data-t');
    if (t === 'polvo') { api.abrir('polvo'); return; }               // colector de polvo (tools)
    _tab = t; host.querySelectorAll('#ac-tabs button[data-t="spot"],#ac-tabs button[data-t="nfts"],#ac-tabs button[data-t="activity"]').forEach((x) => x.classList.toggle('on', x === btn)); pintar();
  });

  cargarCg();
  const pintar = () => {
    const bal = $('ac-bal'), sub = $('ac-sub'), list = $('ac-list');
    if (!con || !b || !b.conectado) { bal.textContent = '—'; sub.textContent = ''; list.innerHTML = `<div class="mv-empty">Conecta tu wallet para ver tus activos.</div>`; return; }
    bal.textContent = _ojo ? '••••••' : money(b.totalUSD);
    sub.textContent = _ojo ? '' : 'Capital disponible en tu wallet';
    if (_tab === 'nfts') { pintarNFTs(list); return; }
    if (_tab === 'activity') { pintarActividad(list); return; }
    const act = (b.activos || []).slice().sort((x, y) => y.usd - x.usd);
    if (!act.length) { list.innerHTML = `<div class="mv-empty">Tu wallet no tiene saldo todavía.</div>`; return; }
    list.innerHTML = act.map((a) => {
      const logo = logoDe(a.id, a.cg || _cg[a.id], _img && Object.keys(_img).length ? Object.fromEntries(Object.entries(_img).map(([k, v]) => [k, { img: v }])) : {});
      return `<div class="ac-row">
        <div class="ac-ci" style="${logo ? `background-image:url(${logo});background-size:cover` : ''}">${logo ? '' : esc(a.id.slice(0, 3))}</div>
        <div class="ac-nm"><b>${esc(a.id)}</b><small>${_ojo ? '••••' : cantidad(a.bal)}</small></div>
        <div class="ac-am"><b>${_ojo ? '••••' : money(a.usd)}</b></div>
      </div>`;
    }).join('');
  };
  pintar();
  host._pintarBal = pintar;
}

let _nftCache = null, _actCache = null;
async function pintarNFTs(list) {
  const c = wallet.cuentaActual && wallet.cuentaActual();
  if (!c) { list.innerHTML = `<div class="mv-empty">Conecta tu wallet para ver tus NFTs.</div>`; return; }
  if (_nftCache) { if (_nftCache.length) renderNFTs(list, _nftCache); else list.innerHTML = `<div class="mv-empty">No encontramos NFTs en tu wallet.</div>`; return; }
  list.innerHTML = `<div class="op-loading" style="padding:34px"><span class="op-spin"></span>Buscando tus NFTs en la red…</div>`;
  try {
    const m = await import('./nfts.js?v=1');
    const nfts = await m.leerNFTs(c, (parcial) => { if (_tab === 'nfts' && parcial.length) renderNFTs(list, parcial); });
    _nftCache = nfts;
    if (!nfts.length) { list.innerHTML = `<div class="mv-empty">No encontramos NFTs en tu wallet en BSC.</div>`; return; }
    renderNFTs(list, nfts);
  } catch (_) { list.innerHTML = `<div class="mv-empty">No se pudo leer los NFTs ahora. Intenta de nuevo.</div>`; }
}
function renderNFTs(list, nfts) {
  list.innerHTML = `<div class="ac-nft-grid">${nfts.map((n) => `
    <div class="ac-nft">
      <div class="ac-nft-img" style="${n.image ? `background-image:url(${n.image})` : ''}">${n.image ? '' : '🖼️'}</div>
      <div class="ac-nft-nm">${esc(n.name)}</div>
    </div>`).join('')}</div>`;
}
async function pintarActividad(list) {
  const c = wallet.cuentaActual && wallet.cuentaActual();
  if (!c) { list.innerHTML = `<div class="mv-empty">Conecta tu wallet para ver tu actividad.</div>`; return; }
  if (_actCache) { renderAct(list, _actCache); return; }
  list.innerHTML = `<div class="op-loading" style="padding:34px"><span class="op-spin"></span>Cargando tu actividad…</div>`;
  try {
    const m = await import('./nfts.js?v=1');
    const ev = await m.leerActividad(c);
    _actCache = ev;
    if (!ev.length) { list.innerHTML = `<div class="mv-empty">Sin actividad reciente de tokens.</div>`; return; }
    renderAct(list, ev);
  } catch (_) { list.innerHTML = `<div class="mv-empty">No se pudo leer la actividad ahora.</div>`; }
}
function renderAct(list, ev) {
  list.innerHTML = ev.map((e) => `<div class="ac-row">
    <div class="ac-ci" style="color:${e.dir === 'in' ? 'var(--mv-up)' : 'var(--mv-down)'}">${e.dir === 'in' ? '↓' : '↑'}</div>
    <div class="ac-nm"><b>${e.dir === 'in' ? 'Recibido' : 'Enviado'}${e.erc721 ? ' · NFT' : ''}</b><small>Bloque ${e.bloque}</small></div>
    <div class="ac-am"><small style="color:var(--mv-mut)">${esc(e.addr.slice(0, 6))}…${esc(e.addr.slice(-4))}</small></div>
  </div>`).join('');
}

async function cargarCg() {
  try { const tk = await import('../tokens.js?v=125'); Object.values(tk.MONEDAS || {}).forEach((m) => { if (m.cg) _cg[m.id] = m.cg; }); } catch (_) {}
  try { const c = JSON.parse(localStorage.getItem('mv-cg') || 'null'); if (c && c.d) Object.keys(c.d).forEach((k) => { if (c.d[k] && c.d[k].img) _img[k] = c.d[k].img; }); } catch (_) {}
  // completa logos que falten desde CoinGecko
  try {
    const faltan = Object.values(_cg).filter((cg) => !_img[cg]);
    if (faltan.length) {
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${[...new Set(faltan)].join(',')}&per_page=250`);
      if (r.ok) { const j = await r.json(); j.forEach((x) => { _img[x.id] = x.image; }); const list = $('ac-list'); const host = $('mv-scroll'); if (host && host._pintarBal) host._pintarBal(); }
    }
  } catch (_) {}
}

/* Genera una imagen (canvas) de la tarjeta de balance y la comparte/descarga.
   Sin librerías ni backend. */
async function compartirBalance(api) {
  const b = api.balance();
  const total = (b && b.conectado) ? money(b.totalUSD) : '$0.00';
  const W = 1080, H = 1080, s = 1;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  // Fondo degradado
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1c2530'); g.addColorStop(.5, '#141a22'); g.addColorStop(1, '#0b0e11');
  x.fillStyle = g; roundRect(x, 0, 0, W, H, 0); x.fill();
  // Glow dorado
  const rg = x.createRadialGradient(W, 0, 40, W, 0, 620);
  rg.addColorStop(0, 'rgba(232,184,75,.22)'); rg.addColorStop(1, 'rgba(232,184,75,0)');
  x.fillStyle = rg; x.fillRect(0, 0, W, H);
  // Tarjeta interior
  x.fillStyle = 'rgba(255,255,255,.03)'; roundRect(x, 70, 150, W - 140, H - 380, 44); x.fill();
  x.strokeStyle = 'rgba(232,184,75,.35)'; x.lineWidth = 2; roundRect(x, 70, 150, W - 140, H - 380, 44); x.stroke();
  // Marca
  x.fillStyle = '#E8B84B'; x.font = '700 40px "Plus Jakarta Sans", system-ui, sans-serif';
  x.fillText('CriptoCuba Oficial', 120, 250);
  // Etiqueta
  x.fillStyle = '#8b96a3'; x.font = '400 34px system-ui, sans-serif';
  x.fillText('Balance total', 120, 470);
  // Monto
  x.fillStyle = '#ffffff'; x.font = '800 130px "Plus Jakarta Sans", system-ui, sans-serif';
  x.fillText(total, 118, 610);
  // Pie
  x.fillStyle = '#5b6572'; x.font = '400 30px system-ui, sans-serif';
  x.fillText('Exchange no custodial · BNB Smart Chain', 120, H - 320 + 40);
  x.fillStyle = '#E8B84B'; x.font = '700 32px system-ui, sans-serif';
  x.fillText('criptocubaoficial.com', 120, H - 200);

  cv.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], 'balance-criptocuba.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Mi balance en CriptoCuba Oficial' });
        return;
      }
    } catch (_) {}
    // Fallback: descargar
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'balance-criptocuba.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}
function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }

function fmt(v) { const n = Number(v); return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'; }
function fmtAmt(v) { v = Number(v) || 0; return v >= 1 ? v.toLocaleString('en-US', { maximumFractionDigits: 4 }) : v.toLocaleString('en-US', { maximumFractionDigits: 8 }); }
