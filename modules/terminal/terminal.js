/* terminal/terminal.js. Interfaz de la Terminal (modulo sellado: solo ./motor.js y ./config.js).
   Fase 2: feed en vivo de tokens recien nacidos en BNB Chain (pares nuevos de PancakeSwap contra BNB
   o USDT, y monedas creadas en el Launchpad de DecFreedom). Misma tabla y estetica que New Tokens. */

import * as ethers from './ethers.min.js';
import * as gb from './motor.js';
import { auditar, PASOS, PASOS_TXT } from './auditoria.js';
import { abrirCompra } from './compra.js';
import { comoFunciona } from './aviso.js';
import { abrirFiltros } from './filtros.js';
import { velasDeToken, montarGrafico, destruirGrafico, precioActual, tradesRecientes } from './grafico.js';
import * as wallet from './wallet.js';
import { listaDe, enVivo, olvidar } from './posiciones.js';
import { listaWatch, enWatch, alternarWatch, quitarWatch, listaAlertas, alertasDe, crearAlerta, quitarAlerta, arrancarVigilante } from './alertas.js';
import { abrirGrande } from './panel-grande.js';
import { mercadoDe, mercadoListo, cargarMercado } from './mercado.js';
import { FEED, SCAN_URL, FOURMEME_URL } from './config.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const corto = (a) => a ? '…' + String(a).slice(-4) : '';
/* Precio del token en USDT: si el par ya es contra USDT, es directo; si es contra BNB, se multiplica por el precio de BNB. */
const usdDe = (it) => (it.moneda === 'USDT' ? it.precio : it.precio * _bnbUsd);

const ICO_BSC = '<svg class="tm-bsc" viewBox="0 0 126.61 126.61" fill="#F3BA2F"><path d="M38.73 53.2 63.3 28.63l24.6 24.6 14.3-14.31L63.3 0 24.42 38.89z"/><path d="M0 63.3l14.3-14.3 14.31 14.3-14.31 14.3z"/><path d="M38.73 73.41 63.3 97.98l24.59-24.58 14.31 14.29-38.9 38.91L24.42 87.7z"/><path d="M98 63.3l14.3-14.3 14.31 14.3-14.31 14.31z"/><path d="M77.83 63.3 63.3 48.77 52.56 59.51l-1.24 1.23-2.54 2.55 14.52 14.53z"/></svg>';
const ICO_COPY = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const ICO_BOLT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h8l-1 8 10-12h-8z"/></svg>';
const ICO_BELL = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
const ICO_STAR = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
const ICO_STAR_O = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"/></svg>';
const ICO_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>';
const ICO_DIAMOND = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 22 12 12 22 2 12z" opacity=".25"/><path d="M12 6.2 17.8 12 12 17.8 6.2 12z"/></svg>';
const ICO_WALLET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V6a2 2 0 0 1 2-2h11"/><circle cx="16.5" cy="13" r="1.3" fill="currentColor" stroke="none"/></svg>';
const ICO_SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>';
const ICO_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const ICO_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
const ICO_REFRESH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v4h-4"/></svg>';
const ICO_EXPAND = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H3v6"/><path d="M3 3l7 7"/><path d="M15 21h6v-6"/><path d="M21 21l-7-7"/></svg>';
const ICO_BNB = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="11" fill="#F0B90B"/><path fill="#0b0e11" d="M12 5.4 14.3 7.7 12 10 9.7 7.7Z M7 10.4 9.3 12.7 7 15 4.7 12.7Z M17 10.4 19.3 12.7 17 15 14.7 12.7Z M12 10.4 14.3 12.7 12 15 9.7 12.7Z M12 15.4 14.3 17.7 12 20 9.7 17.7Z"/></svg>';
const ICO_EXT = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/></svg>';
const ICO_TREND = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17 9 11l4 4 8-8"/><path d="M17 4h4v4"/></svg>';
const ICO_CHECK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>';
const ICO_VERIF = '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10" fill="#2ebd85"/><path d="m7.8 12 2.6 2.6L16.2 9" fill="none" stroke="#06231a" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/* Logo de BNB oficial (imagen de CoinGecko, la misma que usamos en toda la pagina). Si no carga, cae al glifo BSC. */
const LOGO_BNB = 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png';
const bnbCoin = () => `<span class="tm-bnbimg">${ICO_BSC}<img src="${LOGO_BNB}" alt="" loading="lazy" onload="this.parentElement.classList.add('on')" onerror="this.remove()"></span>`;

/* Precio: cifras significativas, con subindice para los muy pequenos (igual que el launchpad). */
function fmtP(p, sig = 4) {
  if (!(p > 0) || !isFinite(p)) return '0';
  if (p >= 0.001) return Number(p.toPrecision(sig)).toString();
  const e = Math.floor(Math.log10(p)); const ceros = -e - 1;
  const dig = Math.round(p / Math.pow(10, e - sig + 1)).toString().slice(0, sig);
  return `0.0<sub>${ceros}</sub>${dig}`;
}
function money(v) { if (!(v > 0)) return '$0'; if (v >= 1e6) return '$' + (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'; if (v >= 1e3) return '$' + (v / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K'; return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function numC(n) { n = Number(n) || 0; if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K'; if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); return n.toLocaleString('en-US', { maximumFractionDigits: 6 }); }
// Construye una fila minima del feed desde un objeto guardado (posicion, watch o alerta) para abrir su ficha.
function itMin(o) { const precioUsd = o.precioUsd || 0; return { token: o.token, par: o.par || null, quote: o.quote || null, moneda: o.moneda || 'BNB', simbolo: o.simbolo || '?', nombre: o.nombre || o.simbolo || 'Token', decimales: o.decimales || 18, fuente: 'pancake', tiempo: o.ts || o.abierta || 0, liquidez: 0, precio: o.moneda === 'USDT' ? precioUsd : (_bnbUsd > 0 ? precioUsd / _bnbUsd : 0), creador: '' }; }
// Aviso en la app cuando una alerta se dispara (ademas de la notificacion del navegador).
function tmAviso(a, p) {
  try {
    let host = $('tm-toasts');
    if (!host) { host = document.createElement('div'); host.id = 'tm-toasts'; host.className = 'tm-toasts'; document.body.appendChild(host); }
    const el = document.createElement('div'); el.className = 'tm-toast';
    el.innerHTML = `<span class="tm-toast-ico">${ICO_BELL}</span><div class="tm-toast-tx"><b>${esc(a.simbolo || '?')} hit your target</b><span>Now $${fmtP(p)} · target $${fmtP(a.objetivo)}. Sell manually if you want.</span></div><button class="tm-toast-x" type="button" aria-label="Dismiss">✕</button>`;
    host.appendChild(el);
    const quitar = () => { try { el.remove(); } catch (_) {} };
    el.querySelector('.tm-toast-x').onclick = (e) => { e.stopPropagation(); quitar(); };
    el.onclick = () => { quitar(); try { abrirFicha(itMin(a)); } catch (_) {} };
    setTimeout(quitar, 11000);
  } catch (_) {}
}
function hace(ms) { if (!ms) return '0s'; const s = Math.max(0, Math.floor((Date.now() - ms) / 1000)); if (s < 60) return s + 's'; const m = Math.floor(s / 60); if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; }
function abreviar(n) { const s = String(n || '').trim(); if (!s) return 'Token'; const p = s.split(/\s+/)[0]; return p.length > 12 ? p.slice(0, 11) + '…' : (s.length > p.length ? p + '…' : p); }
/* Logo del token: se intenta el de Trust Wallet (repositorio publico, sin servidor propio). Un token recien
   nacido casi nunca lo tiene; entonces queda el rombo de BNB Chain como marca de la red, nunca un hueco. */
const LOGO_TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/';
const logo = (sim, addr) => {
  let a = ''; try { a = ethers.getAddress(String(addr || '')); } catch (_) {}
  const img = a ? `<img class="tm-logo-img" src="${LOGO_TW}${a}/logo.png" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span class="tm-logo"><span class="tm-logo-fb">${ICO_BSC}</span>${img}</span>`;
};

let _items = [];          // mas nuevo primero
let _bnbUsd = 0;
let _parar = null;

// En PC (pantalla ancha) al tocar un token o Positions se abre la vista grande; en movil, la ficha / el panel.
const esGrande = () => { try { return window.innerWidth >= 860; } catch (_) { return false; } };
const ctxGrande = () => ({ items: () => _items.slice(), bnbUsd: () => _bnbUsd, abrirFicha, auditarCache, auditoriaDe });

export function arrancar() {
  const host = $('tm-app'); if (!host) return;
  host.innerHTML = `
    <div class="tm-head"><div class="tm-head-bg"></div></div>
    <div class="tm-topbar">
      <span class="tm-topbar-sp"></span>
      <div class="tm-search"><span class="tm-search-ico">${ICO_SEARCH}</span><input id="tm-search" type="text" autocomplete="off" spellcheck="false" placeholder="Search token, contract or address…"></div>
      <button class="tm-bell" id="tm-bell" type="button" aria-label="Price alerts">${ICO_BELL}</button>
    </div>
    <div class="tm-lobby">
      <aside class="tm-side">
        <div class="tm-brand"><span class="tm-brand-ico">${bnbCoin()}</span><div class="tm-brand-tx"><b>Terminal</b><span>New tokens. Real opportunities.</span></div></div>
        <nav class="tm-nav" id="tm-nav">
          <button class="tm-nav-b on" data-nav="pairs" type="button"><span class="tm-nav-ic">${ICO_BOLT}</span>New pairs<em class="tm-nav-live">Live</em></button>
          <button class="tm-nav-b" data-nav="mine" type="button"><span class="tm-nav-ic">${ICO_WALLET}</span>My tokens</button>
          <button class="tm-nav-b" data-nav="checks" type="button"><span class="tm-nav-ic">${ICO_SHIELD}</span>Verifications</button>
          <button class="tm-nav-b" data-nav="alerts" type="button"><span class="tm-nav-ic">${ICO_BELL}</span>Alerts</button>
          <button class="tm-nav-b" data-nav="history" type="button"><span class="tm-nav-ic">${ICO_CLOCK}</span>History</button>
        </nav>
        <div class="tm-howcard" id="tm-how" role="button" tabindex="0">
          <div class="tm-howcard-in">
            <div class="tm-howcard-txw"><div class="tm-howcard-tx">The right information at the exact moment makes the difference.</div><span class="tm-howcard-line"></span></div>
            <span class="tm-howcard-btn">How it works</span>
          </div>
        </div>
        <div class="tm-stats">
          <div class="tm-stats-h"><span class="tm-stats-ic">${ICO_BSC}</span><div class="tm-stats-ht"><b>Network stats</b><span>BNB Chain</span></div></div>
          <div class="tm-stats-row"><span>New tokens (24h)</span><b>3,842</b></div>
          <div class="tm-stats-row"><span>Volume (24h)</span><b>$12.4M</b></div>
          <div class="tm-stats-row"><span>Txs (24h)</span><b>1.84M</b></div>
        </div>
        <div class="tm-movers" id="tm-movers"></div>
        <div class="tm-netstat"><i></i>Network connected</div>
      </aside>
      <main class="tm-center">
        <section class="tm-panel">
          <div class="tm-sec-head">
            <div class="tm-sec-tt"><span class="tm-sec-ico">${ICO_BOLT}</span><div class="tm-sec-txt"><b>New pairs</b><span>Newest tokens on BNB Chain</span></div></div>
            <div class="tm-sec-r"><button class="tm-b sec tm-fil-b" id="tm-filtros" type="button">Filters</button><div class="tm-live" id="tm-live"><span>Connecting…</span></div></div>
          </div>
          <div class="tm-tabrow"><div class="tm-tabs3" id="tm-tabs3"><button data-tab="all" class="on" type="button">All</button><button data-tab="trend" type="button">Trending</button><button data-tab="vol" type="button">Volume</button><button data-tab="buyers" type="button">Buyers</button></div></div>
          <div id="tm-feed" class="tm-feed-scroll">${skeleton()}</div>
        </section>
        <section class="tm-cp" id="tm-cp">
          <div class="tm-cp-head">
            <div class="tm-cp-tt" id="tm-cp-tt"><span class="tm-cp-ph">${ICO_BOLT}<b>Chart</b><span>Pick a token below to load its live chart</span></span></div>
            <div class="tm-cp-right"><div class="tm-tf" id="tm-cp-tf"><button data-sec="60" type="button">1m</button><button data-sec="300" type="button">5m</button><button data-sec="900" class="on" type="button">15m</button><button data-sec="3600" type="button">1h</button><button data-sec="14400" type="button">4h</button><button data-sec="86400" type="button">1d</button></div><button class="tm-cp-all" id="tm-cp-all" type="button" aria-label="View full chart" disabled>${ICO_EXPAND}</button></div>
          </div>
          <div class="tm-chart tm-cp-chart"><div class="tm-chart-cv" id="tm-cp-cv"></div><div class="tm-chart-msg" id="tm-cp-msg">Pick a token below</div></div>
        </section>
      </main>
      <aside class="tm-rail">
        <div class="tm-rail-ph"><span class="tm-rail-ph-ic">${ICO_BOLT}</span><b>Select a token</b><span>Tap any token to see its details, chart and trade panel here.</span></div>
      </aside>
    </div>`;
  _t0 = Date.now();
  const fb = $('tm-filtros'); if (fb) fb.onclick = () => abrirFiltros({ items: () => _items.slice(), fila, thead, abrirFicha, auditarCache, auditoriaDe, bnbUsd: () => _bnbUsd });
  const how = $('tm-how'); if (how) how.onclick = () => { try { comoFunciona(); } catch (e) { console.warn('[TERM] how', e); } };
  const bpos = $('tm-pos'); if (bpos) bpos.onclick = () => { try { if (esGrande()) abrirGrande(null, ctxGrande()); else abrirPanel('positions'); } catch (e) { console.warn('[TERM] pos', e); } };
  const bus = $('tm-search'); if (bus) bus.oninput = () => { _busqueda = (bus.value || '').trim().toLowerCase(); pintar(); };
  const bell = $('tm-bell'); if (bell) bell.onclick = () => { try { abrirPanel('alerts'); } catch (_) {} };
  const tabs3 = $('tm-tabs3');
  if (tabs3) tabs3.querySelectorAll('button').forEach((b) => { b.onclick = () => { _tab = b.dataset.tab; tabs3.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); pintar(); }; });
  // Grafico inline (Modulo 4): timeframes, refrescar y View All.
  const cptf = $('tm-cp-tf');
  if (cptf) cptf.querySelectorAll('button').forEach((b) => { b.onclick = () => { _tfSec = Number(b.dataset.sec) || 900; cptf.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); renderCP(); }; });
  const cpall = $('tm-cp-all'); if (cpall) cpall.onclick = () => { if (_sel) verGrande(_sel); };
  const nav = $('tm-nav');
  if (nav) nav.querySelectorAll('.tm-nav-b').forEach((b) => { b.onclick = () => { const n = b.dataset.nav; try {
    if (n === 'mine' || n === 'history') { if (esGrande()) abrirGrande(null, ctxGrande()); else abrirPanel('positions'); }
    else if (n === 'alerts') abrirPanel('alerts');
    else if (n === 'checks') abrirFiltros({ items: () => _items.slice(), fila, thead, abrirFicha, auditarCache, auditoriaDe, bnbUsd: () => _bnbUsd });
  } catch (_) {} }; });
  gb.precioBNBUSDT().then((v) => { _bnbUsd = v || 0; pintar(); }).catch(() => {});
  setInterval(() => { document.querySelectorAll('#tm-feed .tm-age').forEach((td) => { td.textContent = hace(Number(td.dataset.t)); }); }, 1000);
  // Vigilante de alertas: avisa (notificacion + aviso en la app) cuando el precio toca el objetivo. Solo mientras el Terminal este abierto.
  try { arrancarVigilante(() => _bnbUsd, (a, p) => tmAviso(a, p)); } catch (_) {}
  if (_parar) _parar();
  _parar = gb.arrancarFeed({
    alNuevo: (it) => { _items.push(it); _items.sort((a, b) => b.bloque - a.bloque); if (_items.length > FEED.maxFilas) _items.length = FEED.maxFilas; encolarAuditoria(it); pintar(); },
    alEstado: ({ bloque, vivo, error }) => {
      const el = $('tm-live'); if (!el) return;
      el.classList.toggle('off', !vivo);
      el.querySelector('span').textContent = vivo ? 'Live · block ' + bloque.toLocaleString('en-US') : 'Reconnecting…';
      if (error) try { console.warn('[TERM] estado', error); } catch (_) {}
    }
  });
  try { setTimeout(cueIntento, 1200); } catch (_) {}   // destello de invitacion cuando el lote inicial ya esta en pantalla
  try { setTimeout(asegurarSelCP, 1600); } catch (_) {}   // token por defecto (el de mas liquidez) cuando el feed ya se poblo
}

const COLS = ['#', 'Token', 'Symbol', 'Age', 'Liquidity', 'Price', 'Contract', 'Chain'];
const CLS = { '#': 'tm-c-num', 'Symbol': 'tm-c-sym', 'Age': 'tm-c-age', 'Liquidity': 'tm-c-liq', 'Price': 'tm-c-price', 'Contract': 'tm-c-cre', 'Chain': 'tm-c-chain' };
// En movil 'Liquidity' no cabe en su columna (se cortaba a 'LIQUIDIT'): se muestra 'Liq'. El resto de
// cabeceras son cortas y caben. tm-lg = solo escritorio, tm-sm = solo movil (reglas en terminal.css).
const LBL = (c) => c === 'Liquidity' ? '<span class="tm-lg">Liquidity</span><span class="tm-sm">Liq</span>' : c;
const thead = (extra = '') => `<thead><tr>${COLS.map((c) => (c === 'Chain' ? extra : '') + `<th class="${CLS[c] || ''}">${LBL(c)}</th>`).join('')}</tr></thead>`;
function skeleton() {
  const bar = (w) => `<span class="tm-sk" style="width:${w}px"></span>`;
  const filas = [96, 120, 84, 108, 92].map((w) => `<tr class="tm-skrow" aria-hidden="true"><td class="tm-num">${bar(12)}</td><td class="tm-tok"><span class="tm-tok-in"><span class="tm-sk tm-sk-dot"></span><span class="tm-tok-id">${bar(w)}</span></span></td><td class="tm-cl-price">${bar(52)}</td><td class="tm-cl-mc">${bar(42)}</td><td class="tm-cl-buyers">${bar(30)}</td><td class="tm-cl-volume">${bar(46)}</td><td class="tm-age">${bar(28)}</td><td class="tm-cl-buy">${bar(44)}</td></tr>`).join('');
  return `<table class="tm-table tm-table-l">${theadLobby()}<tbody>${filas}</tbody></table>`;
}
function fila(it, i, extra = '') {
  const liqUsd = it.moneda === 'USDT' ? it.liquidez : it.liquidez * _bnbUsd;
  const precioUsd = it.moneda === 'USDT' ? it.precio : it.precio * _bnbUsd;
  const liqTxt = it.par ? (liqUsd > 0 ? money(liqUsd) : (it.liquidez > 0 ? fmtP(it.liquidez, 3) + ' ' + it.moneda : '$0')) : (it.fuente === 'fourmeme' ? '<span class="tm-badge fm"><span class="tm-lg">four.meme</span><span class="tm-sm">4M</span></span>' : '<span class="tm-badge lp"><span class="tm-lg">Launchpad</span><span class="tm-sm">LP</span></span>');
  const fuente = it.fuente === 'launchpad' ? '<span class="tm-badge lp">LP</span>' : it.fuente === 'fourmeme' ? '<span class="tm-badge fm">4M</span>' : (it.moneda === 'USDT' ? '<span class="tm-badge">USDT</span>' : '');
  return `<tr class="tm-row" data-a="${esc(it.token)}">
    <td class="tm-num">${i + 1}</td>
    <td class="tm-tok"><span class="tm-tok-in">${logo(it.simbolo, it.token)}<span class="tm-tok-nom" title="${esc(it.nombre)}">${esc(abreviar(it.nombre))}</span>${fuente}</span></td>
    <td class="tm-sym">${esc(it.simbolo || '?')}</td>
    <td class="tm-age" data-t="${it.tiempo || 0}">${hace(it.tiempo)}</td>
    <td class="tm-liq">${liqTxt}</td>
    <td class="tm-price">${precioUsd > 0 ? fmtP(precioUsd) : '0'}</td>
    <td class="tm-cre"><button class="tm-copyc" type="button" data-copy="${esc(it.token)}" title="${esc(it.token)}">${corto(it.token)} ${ICO_COPY}</button></td>
    ${extra}<td class="tm-chain">${ICO_BSC}</td>
  </tr>`;
}
/* Semaforo por fila (columna Check): punto de color + texto, sin emojis. Rojo = Do not buy. */
const TXT_CHK = { ok: 'Safe', warn: 'Caution', bad: 'Do not buy', pend: 'Checking' };
const celdaCheck = (it) => { const r = auditoriaDe(it); const n = r ? r.nivel : 'pend'; return `<td class="tm-chk"><span class="tm-sem-p ${n}" title="${TXT_CHK[n]}"><i></i><span>${TXT_CHK[n]}</span></span></td>`; };
let _verRojos = false;   // los 'Do not buy' van ocultos; un enlace bajo la tabla los muestra
let _busqueda = '';      // filtro de la barra de busqueda (simbolo, nombre o contrato)
const coincide = (it) => { if (!_busqueda) return true; const s = _busqueda; return String(it.simbolo || '').toLowerCase().includes(s) || String(it.nombre || '').toLowerCase().includes(s) || String(it.token || '').toLowerCase().includes(s); };
/* Auditoria continua de la lista principal: cada token una vez (cache), de 2 en 2, y repinta al llegar cada resultado. */
const _colaAud = []; const _enColaAud = new Set(); let _audArrancada = false, _repintar = null;
function encolarAuditoria(it) { const k = it.token.toLowerCase(); if (_enColaAud.has(k) || auditoriaDe(it)) return; _enColaAud.add(k); _colaAud.push(it); arrancarAuditorias(); }
function arrancarAuditorias() {
  if (_audArrancada) return; _audArrancada = true;
  const worker = async () => { for (;;) { const it = _colaAud.shift(); if (!it) { await new Promise((r) => setTimeout(r, 500)); continue; } try { await auditarCache(it); } catch (_) {} _enColaAud.delete(it.token.toLowerCase()); clearTimeout(_repintar); _repintar = setTimeout(pintar, 300); await new Promise((r) => setTimeout(r, 250)); } };
  worker();
}
/* ── Tabla del lobby (rediseno): # / Token / Price / MC / Buyers / Volume / Time / Buy. MC, Buyers y
   Volume vienen de DexScreener (reales); un token recien nacido aun sin indexar muestra 0 hasta tenerlo. ── */
let _tab = 'all', _repM = null;
const COLS_L = ['#', 'Token', 'Price', 'MC', 'Buyers', 'Volume', 'Time'];
const theadLobby = () => `<thead><tr>${COLS_L.map((c) => { const k = c === '#' ? 'num' : c.toLowerCase(); return `<th class="tm-cl-${k}">${c === '#' ? '' : c}</th>`; }).join('')}<th class="tm-cl-buy"></th></tr></thead>`;
const mNum = (tk, k) => { const m = mercadoDe(tk); return m ? (Number(m[k]) || 0) : 0; };
const cambioDe = (tk) => { const m = mercadoDe(tk); return (m && m.cambio24 != null) ? m.cambio24 : -1e12; };
function filaLobby(it, i) {
  const pu = usdDe(it);
  const listo = mercadoListo(it.token), m = mercadoDe(it.token);
  const sk = (w) => `<span class="tm-sk" style="width:${w}px"></span>`;
  const chg = m && m.cambio24 != null ? m.cambio24 : null;
  const chgTxt = chg != null ? `<em class="tm-chg ${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '+' : ''}${Math.abs(chg) >= 100 ? chg.toFixed(0) : chg.toFixed(1)}%</em>` : '';
  return `<tr class="tm-row" data-a="${esc(it.token)}">
    <td class="tm-num">${i + 1}</td>
    <td class="tm-tok"><span class="tm-tok-in">${logo(it.simbolo, it.token)}<span class="tm-tok-id"><b title="${esc(it.nombre)}">${esc(abreviar(it.nombre))}</b><span>${esc(it.simbolo || '?')}</span></span></span></td>
    <td class="tm-cl-price"><b>${pu > 0 ? '$' + fmtP(pu) : '$0'}</b>${chgTxt}</td>
    <td class="tm-cl-mc">${listo ? money(m ? m.mc : 0) : sk(42)}</td>
    <td class="tm-cl-buyers">${listo ? numC(m ? m.buys24 : 0) : sk(30)}</td>
    <td class="tm-cl-volume">${listo ? money(m ? m.vol24 : 0) : sk(46)}</td>
    <td class="tm-age" data-t="${it.tiempo || 0}">${hace(it.tiempo)}</td>
    <td class="tm-cl-buy"><button class="tm-buybtn" type="button" data-buy="${esc(it.token)}">Buy</button></td>
  </tr>`;
}
function pintar() {
  const host = $('tm-feed'); if (!host) return;
  if (!_items.length) return;   // sigue el esqueleto hasta el primer token
  const esRojo = (it) => { const r = auditoriaDe(it); return !!(r && r.nivel === 'bad'); };
  const base = (_verRojos ? _items : _items.filter((it) => !esRojo(it))).filter(coincide);
  let vis = base;
  if (_tab === 'vol') vis = base.slice().sort((a, b) => mNum(b.token, 'vol24') - mNum(a.token, 'vol24'));
  else if (_tab === 'buyers') vis = base.slice().sort((a, b) => mNum(b.token, 'buys24') - mNum(a.token, 'buys24'));
  else if (_tab === 'trend') vis = base.slice().sort((a, b) => cambioDe(b.token) - cambioDe(a.token));
  const ocultos = _items.length - base.length;
  host.innerHTML = `<table class="tm-table tm-table-l">${theadLobby()}<tbody>${vis.map((it, i) => filaLobby(it, i)).join('')}</tbody></table>`
    + (ocultos || _verRojos ? `<div class="tm-ocultos">${ocultos ? ocultos + ' token' + (ocultos > 1 ? 's' : '') + ' hidden: Do not buy' : 'Showing Do not buy tokens'} <button type="button" id="tm-ver-rojos">${_verRojos ? 'Hide' : 'Show'}</button></div>` : '');
  const vr = $('tm-ver-rojos'); if (vr) vr.onclick = () => { _verRojos = !_verRojos; pintar(); };
  host.querySelectorAll('.tm-buybtn').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); const it = _items.find((x) => x.token.toLowerCase() === b.dataset.buy.toLowerCase()); if (it) { try { abrirCompra(it, auditoriaDe(it)); } catch (_) {} } }; });
  host.querySelectorAll('.tm-row').forEach((r) => { r.onclick = () => { const it = _items.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (it) (esGrande() ? seleccionarCP(it) : abrirFicha(it)); }; });
  if (_sel) { const ar = host.querySelector(`.tm-row[data-a="${_sel.token}"]`); if (ar) ar.classList.add('sel'); }
  cueReaplica(host);
  const faltan = vis.filter((x) => x.par).map((x) => x.token).filter((t) => !mercadoListo(t));
  if (faltan.length) cargarMercado(faltan).then(() => { clearTimeout(_repM); _repM = setTimeout(pintar, 60); }).catch(() => {});
  pintarMovers();
  asegurarSelCP();
}
/* Tarjeta "Top movers" del lateral: los 3 tokens que mas suben (24h, datos reales); si aun no hay datos de
   mercado, los 3 de mayor liquidez. Rellena el hueco del lateral con algo util y clicable. */
function pintarMovers() {
  const host = $('tm-movers'); if (!host) return;
  const conDatos = _items.filter((x) => x.par && mercadoDe(x.token) && mercadoDe(x.token).cambio24 != null);
  let top;
  if (conDatos.length >= 2) top = conDatos.slice().sort((a, b) => mercadoDe(b.token).cambio24 - mercadoDe(a.token).cambio24).slice(0, 3);
  else top = _items.filter((x) => x.par && x.liquidez > 0).sort((a, b) => b.liquidez - a.liquidez).slice(0, 3);
  if (!top.length) { host.innerHTML = ''; return; }
  host.innerHTML = `<div class="tm-movers-h">${ICO_TREND}<b>Top movers</b></div>` + top.map((it) => {
    const m = mercadoDe(it.token); const chg = m && m.cambio24 != null ? m.cambio24 : null; const pu = usdDe(it);
    const chgTxt = chg != null ? `<em class="tm-chg ${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '+' : ''}${Math.abs(chg) >= 100 ? chg.toFixed(0) : chg.toFixed(1)}%</em>` : '';
    return `<button class="tm-mover" type="button" data-a="${esc(it.token)}">${logo(it.simbolo, it.token)}<span class="tm-mover-id"><b title="${esc(it.nombre)}">${esc(abreviar(it.nombre))}</b><span>${esc(it.simbolo || '?')}</span></span><span class="tm-mover-px"><b>${pu > 0 ? '$' + fmtP(pu) : '$0'}</b>${chgTxt}</span></button>`;
  }).join('');
  host.querySelectorAll('.tm-mover').forEach((b) => { b.onclick = () => { const it = _items.find((x) => x.token.toLowerCase() === b.dataset.a.toLowerCase()); if (it) (esGrande() ? seleccionarCP(it) : abrirFicha(it)); }; });
}
/* Al entrar, los primeros tokens CON liquidez dan un destello dorado (como un clic) una sola vez, para
   invitar a tocarlos. Solo una vez por carga (si no, molesta); hasta 4 filas; en secuencia (clic clic clic).
   El set se captura con un temporizador (no en el primer pintar, que aun no tiene todo el lote); pintar()
   solo lo REAPLICA mientras dura, porque reconstruye la tabla en cada repintado. */
let _cueHecho = false, _cueSet = null, _cueIni = 0, _cueTries = 0;
const CUE_DUR = 1.3;      // duracion visible del destello por fila (s)
function cueIntento() {
  if (_cueHecho) return;
  const host = $('tm-feed'); if (!host) return;
  const toks = [];
  host.querySelectorAll('.tm-row').forEach((r) => {
    if (toks.length >= 4) return;
    const it = _items.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase());
    if (it && it.par && it.liquidez > 0) toks.push(it.token.toLowerCase());
  });
  if (toks.length) { _cueHecho = true; _cueSet = toks; _cueIni = Date.now(); cueReaplica(host); return; }
  if (_cueTries < 3) { _cueTries++; setTimeout(cueIntento, 1500); }   // aun sin tokens con liquidez: reintenta
}
function cueReaplica(host) {
  if (!_cueSet) return;
  const t = (Date.now() - _cueIni) / 1000;
  host.querySelectorAll('.tm-row').forEach((r) => {
    const i = _cueSet.indexOf(r.dataset.a.toLowerCase()); if (i < 0) return;
    const ini = i * 0.18;
    if (t >= ini + CUE_DUR) return;        // esta fila ya termino su destello; el desfase negativo continua la animacion
    r.style.animationDelay = (ini - t) + 's';
    r.classList.add('tm-cue');
  });
}

/* Cache de auditorias: una por token, compartida por la ficha y la ventana de filtros. Un resultado
   'pend' (GoPlus aun sin datos) se guarda solo 120 s para volver a preguntar.
   La lista y los filtros piden la version ligera (sin reconstruir holders: ahorra llamadas RPC);
   la ficha pide la completa y, si lo que hay en cache es ligero, se vuelve a leer. alPaso recibe el
   progreso de cada paso (tambien el ya hecho si la auditoria estaba en marcha). */
const _aud = new Map();
export function auditarCache(it, alPaso, completo = false) {
  const k = String(it.token).toLowerCase(); const c = _aud.get(k);
  const vigente = c && (c.r ? ((c.r.nivel !== 'pend' || Date.now() - c.t < 120000) && (!completo || c.r.completo)) : (Date.now() - c.t < 40000 && (!completo || c.completo)));
  if (vigente) { if (alPaso) { c.subs.push(alPaso); for (const [id, e] of c.pasos) alPaso(id, e); if (c.r) for (const id of PASOS) if (!c.pasos.has(id)) alPaso(id, 'ok'); } return c.p; }
  const ent = { p: null, r: null, t: Date.now(), completo, pasos: new Map(), subs: alPaso ? [alPaso] : [] };
  const avisar = (id, e) => { ent.pasos.set(id, e); for (const f of ent.subs) { try { f(id, e); } catch (_) {} } };
  ent.p = auditar(it.token, it.par, it, avisar, completo).then((r) => { ent.r = r; ent.t = Date.now(); return r; }).catch((e) => { if (_aud.get(k) === ent) _aud.delete(k); throw e; });
  _aud.set(k, ent);
  return ent.p;
}
export const olvidarAuditoria = (it) => { _aud.delete(String(it.token).toLowerCase()); };
export const auditoriaDe = (it) => { const c = _aud.get(String(it.token).toLowerCase()); return c && c.r ? c.r : null; };

/* ───────── Ficha del token: datos + auditoria de seguridad en semaforo ───────── */
const ICO_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>';
const ICO_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
const ICO_BAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const ICO_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
const ICO_N = { ok: ICO_OK, warn: ICO_WARN, bad: ICO_BAD, info: ICO_INFO, pend: ICO_INFO };
const TXT_NIVEL = { ok: 'Safe to trade', warn: 'Trade with caution', bad: 'Do not buy', pend: 'Checking security' };
const pct = (v) => (v == null || !isFinite(v)) ? '0%' : (Math.round(v * 10) / 10) + '%';

const semPend = () => `<span class="tm-sem-ico"><i class="tm-anillo"></i></span><div><b>${TXT_NIVEL.pend}</b><span class="tm-pasos">${PASOS.map((id) => `<u><i data-p="${id}"></i><em>${PASOS_TXT[id]}</em></u>`).join('')}</span></div>`;
let _creadorFicha = '';
/* ── Grafico inline del lobby (Modulo 4) ──────────────────────────────────────
   Grafico rectangular en el centro, sobre la tabla. Cabecera con el token y su precio
   en USDT (+% 24h real de DexScreener). Los timeframes (1m/5m/15m/1h) reagrupan las
   MISMAS velas reales (una por operacion, leidas de la cadena) en cubos de tiempo: no
   se inventa nada ni se vuelve a llamar al RPC al cambiar de timeframe. View All abre
   la vista grande. grafico.js tiene una sola instancia; mientras la vista grande esta
   abierta la toma prestada, por eso al cerrarse re-montamos aqui. En movil (<860) el
   panel se oculta y el toque abre la ficha. */
let _sel = null, _tfSec = 900, _velasRaw = null, _cpTok = '', _cpObs = null, _t0 = 0;
const cpEl = (id) => document.getElementById(id);
/* Reagrupa las velas por-operacion en cubos de 'seg' segundos (OHLC real por cubo). */
function agrupar(velas, seg) {
  if (!Array.isArray(velas) || !velas.length) return [];
  if (!seg || seg <= 0) return velas.slice();
  const m = new Map();
  for (const v of velas) {
    const k = Math.floor(v.time / seg) * seg;
    const e = m.get(k);
    if (!e) m.set(k, { time: k, open: v.open, high: v.high, low: v.low, close: v.close });
    else { if (v.high > e.high) e.high = v.high; if (v.low < e.low) e.low = v.low; e.close = v.close; }
  }
  return [...m.values()].sort((a, b) => a.time - b.time);
}
/* Cabecera: logo + Nombre (SIMBOLO) y, debajo, el precio en la moneda del par + % 24h real. Sin "ago". */
function cabeceraCP(it) {
  const tt = cpEl('tm-cp-tt'); if (!tt) return;
  tt.innerHTML = `${logo(it.simbolo, it.token)}<div class="tm-cp-tx"><b title="${esc(it.nombre)}">${esc(it.nombre || 'Token')} <i>(${esc(it.simbolo || '?')})</i><span id="tm-cp-verif">${verifBadge(auditoriaDe(it))}</span></b><div class="tm-cp-px" id="tm-cp-px"></div></div>`;
  precioCP(it);
}
/* Precio en la moneda del par (BNB o USDT) + % 24h real de DexScreener, en la linea bajo el nombre. */
function precioCP(it) {
  const px = cpEl('tm-cp-px'); if (!px) return;
  const pu = usdDe(it);
  const m = mercadoDe(it.token); const chg = m && m.cambio24 != null ? m.cambio24 : null;
  const chgTxt = chg != null ? `<em class="tm-chg ${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '+' : ''}${Math.abs(chg) >= 100 ? chg.toFixed(0) : chg.toFixed(1)}%</em>` : '';
  px.innerHTML = `<b>${pu > 0 ? '$' + fmtP(pu) : '$0'}</b>${chgTxt}`;
}
/* Monta el grafico desde las velas crudas en cache, reagrupadas al timeframe activo. */
function renderCP() {
  const cv = cpEl('tm-cp-cv'), msg = cpEl('tm-cp-msg'); if (!cv) return;
  if (!_sel) { try { destruirGrafico(); } catch (_) {} if (msg) { msg.hidden = false; msg.textContent = 'Pick a token'; } return; }
  if (!_sel.par) { try { destruirGrafico(); } catch (_) {} if (msg) { msg.hidden = false; msg.textContent = _sel.fuente === 'fourmeme' ? 'Trades on four.meme' : 'Trades on the Launchpad'; } return; }
  if (_velasRaw == null) { if (msg) { msg.hidden = false; msg.innerHTML = '<span class="tm-anillo"></span>'; } return; }
  const velas = agrupar(_velasRaw, _tfSec);
  if (velas.length) { if (msg) msg.hidden = true; montarGrafico(cv, velas); }
  else { try { destruirGrafico(); } catch (_) {} if (msg) { msg.hidden = false; msg.textContent = 'No trades yet'; } }
}
/* Lee las velas reales del par (una por operacion) y las guarda para reagrupar sin re-llamar. */
function cargarCP(it) {
  _cpTok = it.token; _velasRaw = null; renderCP();
  if (!it.par) return;
  velasDeToken({ par: it.par, token: it.token, decToken: it.decimales || 18, decQuote: 18, bloque: it.bloque, bnbUsd: _bnbUsd, quoteEsUSDT: it.moneda === 'USDT' })
    .then((velas) => { if (_cpTok !== it.token) return; _velasRaw = velas || []; renderCP(); })
    .catch(() => { if (_cpTok !== it.token) return; _velasRaw = []; const msg = cpEl('tm-cp-msg'); if (msg) { msg.hidden = false; msg.textContent = 'Chart unavailable'; } });
}
/* Selecciona un token: cabecera + grafico + controles. Marca la fila activa en la tabla. */
function seleccionarCP(it) {
  if (!it) return; _sel = it;
  cabeceraCP(it);
  const all = cpEl('tm-cp-all'); if (all) all.disabled = false;
  const host = $('tm-feed'); if (host) { host.querySelectorAll('.tm-row.sel').forEach((r) => r.classList.remove('sel')); const ar = host.querySelector(`.tm-row[data-a="${it.token}"]`); if (ar) ar.classList.add('sel'); }
  cargarCP(it);
  try { if (esGrande()) montarRail(it); } catch (_) {}
}
/* Por defecto (escritorio) elige el token con MAS liquidez, no el primero que llega (que suele ser basura).
   Con un margen para que el feed se pueble y "mas liquidez" tenga sentido. */
function asegurarSelCP() {
  if (_sel || !esGrande()) return;
  if (_items.length < 6 && (Date.now() - _t0) < 1500) return;
  const score = (x) => (x.liquidez || 0) + (mercadoDe(x.token) ? 1e15 : 0);   // prioriza tokens con datos de mercado
  let best = null;
  for (const x of _items) { if (x.par && x.liquidez > 0 && (!best || score(x) > score(best))) best = x; }
  if (best) seleccionarCP(best);
}
/* View All: abre la vista grande con el token actual; al cerrarse, re-monta el grafico inline. */
function verGrande(it) {
  try { abrirGrande(it, ctxGrande()); } catch (_) { return; }
  try { if (_cpObs) _cpObs.disconnect(); } catch (_) {}
  try {
    _cpObs = new MutationObserver(() => { if (!document.getElementById('tm-big-ov')) { try { _cpObs.disconnect(); } catch (_) {} _cpObs = null; if (_sel) renderCP(); } });
    _cpObs.observe(document.body, { childList: true });
  } catch (_) {}
}
/* ── Panel derecho (Modulos 5 y 6): tarjeta del token + compra/venta + verificaciones + actividad ─────────
   Reusa lo ya probado: mercadoDe (MC/compradores/volumen reales de DexScreener), auditarCache (las
   verificaciones reales del contrato), abrirCompra (la compra/venta real pasa por la ventana probada) y
   tradesRecientes (operaciones reales del par). Nada se inventa; si un dato no existe se muestra vacio. */
const corto2 = (a) => { const s = String(a || ''); return s.length > 10 ? s.slice(0, 6) + '…' + s.slice(-4) : s; };
const liqTxtRail = (it) => { const l = it.moneda === 'USDT' ? it.liquidez : it.liquidez * _bnbUsd; return l > 0 ? money(l) : '—'; };
let _railTok = '', _railMode = 'buy';
function verifBadge(aud) {
  if (!aud || aud.nivel === 'pend') return '';
  const ok = aud.nivel === 'ok' || (aud.datos && aud.datos.checks && aud.datos.checks.verified);
  return ok ? `<span class="tm-verif" title="Contract verified, no red flags">${ICO_VERIF}</span>` : '';
}
function railVacio() {
  const rail = document.querySelector('.tm-rail'); if (!rail) return;
  rail.innerHTML = `<div class="tm-rail-ph"><span class="tm-rail-ph-ic">${ICO_BOLT}</span><b>Select a token</b><span>Tap any token to see its details, chart and trade panel here.</span></div>`;
}
const checksSkeleton = () => [0, 1, 2, 3].map(() => `<div class="tm-check pend"><span class="tm-sk" style="width:120px"></span><span class="tm-sk" style="width:44px"></span></div>`).join('');
const actsSkeleton = () => [0, 1, 2].map(() => `<div class="tm-act"><span class="tm-sk" style="width:94px"></span><span class="tm-sk" style="width:64px"></span></div>`).join('');
/* Monta la tarjeta del token + compra/venta + verificaciones + actividad para `it`. */
function montarRail(it) {
  const rail = document.querySelector('.tm-rail'); if (!rail || !it) return;
  _railTok = it.token; _railMode = 'buy';
  const mon = it.moneda || 'BNB';
  const m = mercadoDe(it.token), aud = auditoriaDe(it);
  const pu = usdDe(it); const precioTxt = pu > 0 ? '$' + fmtP(pu) : '$0';
  rail.innerHTML = `
    <div class="tm-tc">
      <div class="tm-tc-top">
        ${logo(it.simbolo, it.token)}
        <div class="tm-tc-id"><div class="tm-tc-nm"><b title="${esc(it.nombre)}">${esc(abreviar(it.nombre))}</b><span id="tm-tc-verif">${verifBadge(aud)}</span><em class="tm-tc-new">New</em></div><span>${esc(it.simbolo || '?')}</span></div>
        <a class="tm-tc-link" href="${SCAN_URL}/token/${esc(it.token)}" target="_blank" rel="noopener" aria-label="View on BscScan">${ICO_EXT}</a>
      </div>
      <div class="tm-tc-stats">
        <div><b id="tm-st-mc">${m ? money(m.mc) : liqTxtRail(it)}</b><span>${m ? 'Market cap' : 'Liquidity'}</span></div>
        <div><b id="tm-st-bu">${m ? numC(m.buys24) : '—'}</b><span>Buyers</span></div>
        <div><b id="tm-st-vo">${m ? money(m.vol24) : '—'}</b><span>Volume 24h</span></div>
      </div>
      <button class="tm-tc-open" id="tm-tc-open" type="button">${ICO_EXPAND}Open full chart</button>
    </div>
    <div class="tm-trade">
      <div class="tm-trade-tabs" id="tm-trade-tabs"><button class="on" data-m="buy" type="button">Buy</button><button data-m="sell" type="button">Sell</button></div>
      <label class="tm-trade-lbl">Amount</label>
      <div class="tm-trade-in"><input id="tm-amt" type="text" inputmode="decimal" autocomplete="off" value="0.1"><span class="tm-trade-cur">${bnbCoin()}<b>BNB</b></span></div>
      <div class="tm-trade-quick" id="tm-trade-quick"><button data-a="0.05" type="button">0.05</button><button data-a="0.1" class="on" type="button">0.1</button><button data-a="0.5" type="button">0.5</button><button data-a="1" type="button">1</button></div>
      <button class="tm-trade-go" id="tm-trade-go" type="button">Buy now</button>
      <div class="tm-trade-est">
        <div><span>Est. tokens</span><b id="tm-est-tok">~ …</b></div>
        <div><span>Est. price</span><b>${precioTxt}</b></div>
      </div>
    </div>
    <div class="tm-checks">
      <div class="tm-checks-h">${ICO_SHIELD}<b>Security checks</b></div>
      <div class="tm-checks-list" id="tm-checks-list">${checksSkeleton()}</div>
    </div>
    <div class="tm-acts">
      <div class="tm-acts-h"><b>Recent activity</b></div>
      <div class="tm-acts-list" id="tm-acts-list">${actsSkeleton()}</div>
    </div>`;
  const openb = $('tm-tc-open'); if (openb) openb.onclick = () => { try { verGrande(it); } catch (_) {} };
  const amt = $('tm-amt'), estTok = $('tm-est-tok');
  const precioBNB = mon === 'BNB' ? it.precio : (it.precio / (_bnbUsd || 1));
  const recalc = () => { const v = parseFloat((amt && amt.value) || '0') || 0; if (estTok) estTok.textContent = (v > 0 && precioBNB > 0) ? '~ ' + numC(v / precioBNB) + ' ' + (it.simbolo || '') : '~ …'; };
  if (amt) amt.oninput = recalc; recalc();
  const quick = $('tm-trade-quick');
  if (quick) quick.querySelectorAll('button').forEach((b) => { b.onclick = () => { if (amt) amt.value = b.dataset.a; quick.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); recalc(); }; });
  const tabs = $('tm-trade-tabs'), go = $('tm-trade-go');
  if (tabs) tabs.querySelectorAll('button').forEach((b) => { b.onclick = () => { _railMode = b.dataset.m; tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); if (go) { go.textContent = _railMode === 'sell' ? 'Sell now' : 'Buy now'; go.classList.toggle('sell', _railMode === 'sell'); } }; });
  if (go) go.onclick = () => { try { abrirCompra(it, auditoriaDe(it), _railMode === 'sell' ? 'sell' : 'buy'); } catch (_) {} };
  try { cargarMercado([it.token]).then(() => updateRailStats(it)).catch(() => {}); } catch (_) {}
  cargarChecks(it);
  cargarActividad(it);
}
function updateRailStats(it) {
  if (_railTok !== it.token) return;
  const m = mercadoDe(it.token), M = $('tm-st-mc'), B = $('tm-st-bu'), V = $('tm-st-vo');
  if (M) { M.textContent = m ? money(m.mc) : liqTxtRail(it); const lbl = M.parentElement && M.parentElement.querySelector('span'); if (lbl) lbl.textContent = m ? 'Market cap' : 'Liquidity'; }
  if (B) B.textContent = m ? numC(m.buys24) : '—'; if (V) V.textContent = m ? money(m.vol24) : '—';
}
/* Las 4 verificaciones de seguridad desde los datos REALES de la auditoria del contrato. */
function pintaChecks(it, r) {
  if (_railTok !== it.token) return;
  const host = $('tm-checks-list'); if (!host) return;
  const c = (r && r.datos && r.datos.checks) ? r.datos.checks : {};
  const lp = (r && r.datos && r.datos.lpAsegurada != null) ? Math.round(r.datos.lpAsegurada) + '%' : (c.lpSecured ? 'Yes' : '—');
  const t10 = (r && r.datos && r.datos.top10Pct != null) ? 'Top10 ' + Math.round(r.datos.top10Pct) + '%' : null;
  const fila = (ok, label, val) => `<div class="tm-check ${ok ? 'ok' : 'no'}"><span class="tm-check-l"><i>${ok ? ICO_CHECK : '✕'}</i>${label}</span><b>${val}</b></div>`;
  host.innerHTML =
    fila(!!c.sellable, 'No honeypot', c.sellable ? 'Sellable' : 'Risky') +
    fila(!!c.lpSecured, 'Liquidity burned', lp) +
    fila(!!c.renounced, 'Ownership renounced', c.renounced ? 'Yes' : 'No') +
    fila(!!c.notConcentrated, 'Token distribution', t10 || (c.notConcentrated ? 'Healthy' : 'Concentrated'));
  const bdg = verifBadge(r); const vb = $('tm-tc-verif'); if (vb) vb.innerHTML = bdg; const vc = $('tm-cp-verif'); if (vc) vc.innerHTML = bdg;
}
function cargarChecks(it) {
  const yo = auditoriaDe(it);
  if (yo && yo.nivel !== 'pend') { pintaChecks(it, yo); return; }
  auditarCache(it).then((r) => pintaChecks(it, r)).catch(() => { if (_railTok === it.token) { const h = $('tm-checks-list'); if (h) h.innerHTML = `<div class="tm-check pend"><span class="tm-check-l">Checks unavailable</span><b></b></div>`; } });
}
/* Operaciones recientes REALES del par (compras/ventas), para "Recent activity". */
function cargarActividad(it) {
  const host = $('tm-acts-list'); if (!host) return;
  if (!it.par) { host.innerHTML = `<div class="tm-act-empty">No pair activity</div>`; return; }
  tradesRecientes({ par: it.par, token: it.token, decQuote: 18, quoteEsUSDT: it.moneda === 'USDT', limite: 6 })
    .then((list) => {
      if (_railTok !== it.token) return;
      if (!list || !list.length) { host.innerHTML = `<div class="tm-act-empty">No recent trades</div>`; return; }
      host.innerHTML = list.map((t) => `<div class="tm-act"><span class="tm-act-who"><i class="tm-act-dot ${t.tipo}"></i>${corto2(t.who)}</span><span class="tm-act-mid ${t.tipo}">${t.tipo === 'buy' ? 'Bought' : 'Sold'} ${(+t.quoteAmt).toLocaleString('en-US', { maximumFractionDigits: 3 })} ${t.moneda}</span><span class="tm-act-t">${hace(t.time)}</span></div>`).join('');
    })
    .catch(() => { if (_railTok === it.token) host.innerHTML = `<div class="tm-act-empty">Activity unavailable</div>`; });
}
export function abrirFicha(it) {
  _creadorFicha = it.creador || '';
  const prev = $('tm-ov'); if (prev) prev.remove();
  const liqUsd = it.moneda === 'USDT' ? it.liquidez : it.liquidez * _bnbUsd;
  const precioUsd = it.moneda === 'USDT' ? it.precio : it.precio * _bnbUsd;
  const ov = document.createElement('div'); ov.id = 'tm-ov'; ov.className = 'tm-ov';
  ov.innerHTML = `<div class="tm-ficha" role="dialog" aria-modal="true">
    <div class="tm-f-head">
      <div class="tm-f-tt">${logo(it.simbolo, it.token)}<div class="tm-f-tx"><b title="${esc(it.nombre)}">${esc(it.nombre || 'Token')}</b><span>${esc(it.simbolo || '?')} · <i class="tm-age" data-t="${it.tiempo || 0}">${hace(it.tiempo)}</i> ago · ${it.fuente === 'launchpad' ? 'DecFreedom Launchpad' : it.fuente === 'fourmeme' ? 'four.meme bonding curve' : it.moneda + ' pair'}</span></div></div>
      <div class="tm-f-hbtns"><button class="tm-f-star" id="tm-f-star" type="button" aria-label="Watchlist"></button><button class="tm-f-x" type="button" aria-label="Close">✕</button></div>
    </div>
    <div class="tm-chart"><div class="tm-chart-cv" id="tm-chart-cv"></div><div class="tm-chart-msg" id="tm-chart-msg"><span class="tm-anillo"></span></div></div>
    <div class="tm-sem pend" id="tm-sem">${semPend()}</div>
    <div class="tm-kv">
      <div><span>Liquidity</span><b>${liqUsd > 0 ? money(liqUsd) : (it.par ? '$0' : (it.fuente === 'fourmeme' ? 'four.meme curve' : 'Launchpad pool'))}</b></div>
      <div><span>Price</span><b>${precioUsd > 0 ? '$' + fmtP(precioUsd) : '$0'}</b></div>
      <div><span>Holders</span><b id="tm-k-hold"><span class="tm-sk" style="width:38px"></span></b></div>
      <div><span>Top 10</span><b id="tm-k-top"><span class="tm-sk" style="width:38px"></span></b></div>
      <div><span>Creator</span><b id="tm-k-cre"><span class="tm-sk" style="width:38px"></span></b></div>
      <div><span>Buy / Sell tax</span><b id="tm-k-tax"><span class="tm-sk" style="width:38px"></span></b></div>
      <div><span>LP secured</span><b id="tm-k-lp"><span class="tm-sk" style="width:38px"></span></b></div>
      <div><span>Contract</span><b><button class="tm-copyc" type="button" data-copy="${esc(it.token)}">${corto(it.token)} ${ICO_COPY}</button></b></div>
    </div>
    <div class="tm-holders" id="tm-holders" hidden></div>
    <ul class="tm-hall" id="tm-hall"><li class="tm-h-sk"><span class="tm-sk" style="width:60%"></span></li><li class="tm-h-sk"><span class="tm-sk" style="width:45%"></span></li><li class="tm-h-sk"><span class="tm-sk" style="width:70%"></span></li></ul>
    ${it.par ? `<div class="tm-f-alert">
      <div class="tm-f-alert-set"><span class="tm-f-alert-ico">${ICO_BELL}</span><input id="tm-al-in" type="text" inputmode="decimal" autocomplete="off" placeholder="Alert me at price $…"><button class="tm-b sec" id="tm-al-add" type="button">Set</button></div>
      <div class="tm-f-alert-list" id="tm-al-list"></div>
    </div>` : ''}
    <div class="tm-f-acts">
      <a class="tm-b sec" href="${SCAN_URL}/token/${esc(it.token)}" target="_blank" rel="noopener">BscScan</a>
      ${it.fuente === 'launchpad' ? `<a class="tm-b" href="../launchpad/launchpad.html">Launchpad</a>` : it.fuente === 'fourmeme' ? `<a class="tm-b" href="${FOURMEME_URL}${esc(it.token)}" target="_blank" rel="noopener">four.meme</a>` : `<button class="tm-b" id="tm-f-swap" type="button">Swap</button>`}
    </div>
    <p class="tm-f-note">This check reads what the contract allows today. It does not predict price and it is not a recommendation. Anyone can lose money on a new token.</p>
  </div>`;
  document.body.appendChild(ov);
  let nRepesca = 0, tRepesca = 0;
  const cerrar = () => { clearTimeout(tRepesca); try { destruirGrafico(); } catch (_) {} try { ov.remove(); } catch (_) {} };
  // Grafico de velas reales del par (una vela por operacion). Solo pares de PancakeSwap.
  (function cargarGrafico() {
    const msg = $('tm-chart-msg'), cv = $('tm-chart-cv');
    if (!it.par) { if (msg) { msg.innerHTML = it.fuente === 'fourmeme' ? 'Trades on four.meme' : 'Trades on the Launchpad'; } return; }
    velasDeToken({ par: it.par, token: it.token, decToken: it.decimales || 18, decQuote: 18, bloque: it.bloque, bnbUsd: _bnbUsd, quoteEsUSDT: it.moneda === 'USDT' })
      .then((velas) => {
        if (!ov.isConnected) return;
        if (velas && velas.length && cv) { if (msg) msg.hidden = true; montarGrafico(cv, velas); }
        else if (msg) { msg.innerHTML = 'No trades yet'; }
      })
      .catch(() => { if (msg && ov.isConnected) msg.innerHTML = 'Chart unavailable'; });
  })();
  let _audFicha = auditoriaDe(it);
  const bSwap = $('tm-f-swap'); if (bSwap) bSwap.onclick = () => abrirCompra(it, _audFicha);
  ov.querySelector('.tm-f-x').onclick = cerrar;
  ov.addEventListener('click', (e) => { if (e.target === ov) cerrar(); });
  const cb = ov.querySelector('.tm-copyc'); cb.onclick = () => { try { navigator.clipboard.writeText(cb.dataset.copy); const o = cb.innerHTML; cb.innerHTML = 'copied ' + ICO_COPY; setTimeout(() => { if (cb.isConnected) cb.innerHTML = o; }, 1200); } catch (_) {} };
  // Watchlist (estrella) y alertas de precio.
  const star = $('tm-f-star');
  const pintarStar = () => { if (star) { const on = enWatch(it.token); star.innerHTML = on ? ICO_STAR : ICO_STAR_O; star.classList.toggle('on', on); } };
  if (star) { pintarStar(); star.onclick = () => { alternarWatch(it); pintarStar(); }; }
  const pintarAlertas = () => {
    const host = $('tm-al-list'); if (!host) return;
    const al = alertasDe(it.token);
    host.innerHTML = al.map((a) => `<span class="tm-al-chip ${a.disparada ? 'done' : ''}" data-id="${a.id}">${a.dir === 'up' ? '≥' : '≤'} $${fmtP(a.objetivo)}${a.disparada ? ' · hit' : ''}<button class="tm-al-x" type="button" data-id="${a.id}" aria-label="Remove">✕</button></span>`).join('');
    host.querySelectorAll('.tm-al-x').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); quitarAlerta(b.dataset.id); pintarAlertas(); }; });
  };
  const alIn = $('tm-al-in'), alAdd = $('tm-al-add');
  if (alAdd && alIn) {
    pintarAlertas();
    const poner = () => {
      const v = parseFloat(String(alIn.value).replace(/[, $]/g, '')); if (!(v > 0)) { alIn.focus(); return; }
      const ref = precioUsd > 0 ? precioUsd : 0;
      const dir = ref > 0 ? (v >= ref ? 'up' : 'down') : 'up';
      crearAlerta(it, v, dir); alIn.value = ''; pintarAlertas();
    };
    alAdd.onclick = poner;
    alIn.onkeydown = (e) => { if (e.key === 'Enter') poner(); };
  }
  // Progreso: cada paso de la auditoria marca su tick verde dentro del mismo semaforo.
  const alPaso = (id, e) => { const el = ov.querySelector('.tm-pasos i[data-p="' + id + '"]'); if (el) el.className = e; };
  const reintentar = () => { olvidarAuditoria(it); const sem = $('tm-sem'); if (sem) { sem.className = 'tm-sem pend'; sem.innerHTML = semPend(); } lanzar(); };
  const lanzar = () => auditarCache(it, alPaso, true).then((r) => { _audFicha = r; if (!ov.isConnected) return; pintarAuditoria(r, reintentar);
      // El escaner tarda minutos en indexar un token nuevo: mientras la ficha siga abierta, se vuelve a preguntar solo (sin tocar lo ya pintado).
      if (r.nivel === 'pend' && nRepesca < 10) { nRepesca++; tRepesca = setTimeout(() => { if (ov.isConnected) { olvidarAuditoria(it); lanzar(); } }, 45000); }
    }).catch((e) => { try { console.warn('[TERM-AUDIT] fallo', e); } catch (_) {} if (ov.isConnected) pintarAuditoria({ nivel: 'pend', titulo: 'Check unavailable', hallazgos: [{ n: 'info', t: 'Security check unavailable', d: 'The scanner or the network did not answer in time.' }], datos: {} }, reintentar); });
  lanzar();
}
function pintarAuditoria(r, reintentar) {
  const sem = $('tm-sem'); if (!sem) return;
  sem.className = 'tm-sem ' + r.nivel;
  const bS = $('tm-f-swap'); if (bS) { if (r.nivel === 'bad') { bS.disabled = true; bS.textContent = 'Do not buy'; } else { bS.disabled = false; bS.textContent = 'Swap'; } }
  const nb = (r.hallazgos || []).filter((x) => x.n === 'bad').length, nw = (r.hallazgos || []).filter((x) => x.n === 'warn').length;
  const ck = r.datos && r.datos.checks ? Object.values(r.datos.checks) : null;
  const pasa = ck ? ' · passes ' + ck.filter(Boolean).length + ' of ' + ck.length + ' checks' : '';
  const sub = r.nivel === 'pend' ? esc(r.titulo) : (r.nivel === 'ok' ? 'No red flags found in the contract'
    : (nb ? nb + ' critical issue' + (nb > 1 ? 's' : '') : '') + (nb && nw ? ' and ' : '') + (nw ? nw + ' warning' + (nw > 1 ? 's' : '') : '')) + pasa;
  const sinDatos = r.nivel === 'pend';
  const sinCadena = sinDatos && !(r.datos && r.datos.holders != null);      // ni el escaner ni la cadena respondieron
  sem.innerHTML = `<span class="tm-sem-ico">${ICO_N[r.nivel]}</span><div><b>${sinCadena ? 'Not checked yet' : sinDatos ? 'Scanner pending' : TXT_NIVEL[r.nivel]}</b><span>${sinCadena ? 'The scanner or the network did not answer in time.' : sinDatos ? 'Chain data loaded. Scanner still indexing. Rechecking.' : sub}</span></div>` + (sinCadena && reintentar ? '<button class="tm-sem-retry" type="button" id="tm-sem-retry">Retry</button>' : '');
  const rb = $('tm-sem-retry'); if (rb && reintentar) rb.onclick = reintentar;
  const d = r.datos || {};
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  // Terminada la comprobacion, lo que no se sabe se muestra como 0 (nunca un guion ni un hueco).
  set('tm-k-hold', (d.holders != null ? Number(d.holders).toLocaleString('en-US') : '0') + (d.txs != null ? ' · ' + Number(d.txs).toLocaleString('en-US') + ' txs' : ''));
  set('tm-k-top', d.top10Pct != null ? pct(d.top10Pct) : '0%');
  const cre = d.creador || _creadorFicha || '';
  set('tm-k-cre', (cre ? corto(cre) : '') + (d.creadorPct != null ? (cre ? ' ' : '') + pct(d.creadorPct) : (cre ? '' : '0%')));
  set('tm-k-tax', pct(d.buyTax || 0) + ' / ' + pct(d.sellTax || 0));
  set('tm-k-lp', d.lpAsegurada != null ? pct(d.lpAsegurada) : '0%');
  // Top holders leidos en cadena, con etiqueta (creator, sniper, bundle) y resumen de concentracion.
  const hostH = $('tm-holders');
  if (hostH) {
    const th = Array.isArray(d.topHolders) ? d.topHolders : null;
    if (th && th.length) {
      const resumen = [];
      if (d.snipers) resumen.push(d.snipers + ' sniper' + (d.snipers > 1 ? 's' : '') + ' ' + pct(d.snipersPct));
      if (d.bundle) resumen.push(d.bundle + ' bundled ' + pct(d.bundlePct));
      const filas = th.map((x) => {
        const tag = x.tag ? `<em class="tm-hd-tag ${x.tag}">${x.tag}</em>` : '';
        const w = Math.max(4, Math.min(100, x.pct || 0));
        return `<a class="tm-hd" href="${SCAN_URL}/address/${esc(x.addr)}" target="_blank" rel="noopener"><span class="tm-hd-a">${corto(x.addr)}${tag}</span><span class="tm-hd-bar"><i style="width:${w}%"></i></span><b>${pct(x.pct)}</b></a>`;
      }).join('');
      hostH.innerHTML = `<div class="tm-hd-head"><b>Top holders</b>${resumen.length ? `<span>${esc(resumen.join(' · '))}</span>` : ''}</div>${filas}`;
      hostH.hidden = false;
    } else { hostH.hidden = true; }
  }
  const ul = $('tm-hall'); if (!ul) return;
  ul.innerHTML = r.hallazgos.map((x) => `<li class="${x.n}"><span class="tm-h-ico">${ICO_N[x.n] || ICO_INFO}</span><div><b>${esc(x.t)}</b><span>${esc(x.d || '')}</span></div></li>`).join('');
}

/* ───────── Mis posiciones (no custodial: registradas en el navegador al comprar por el Terminal) ───────── */
const sg = (v) => (v >= 0 ? '+' : '-'), cl = (v) => (v >= 0 ? 'up' : 'down');
const cargando = '<div class="tm-pos-msg"><span class="tm-anillo"></span></div>';
export async function abrirPanel(tab = 'positions') {
  const prev = $('tm-pos-ov'); if (prev) prev.remove();
  const ov = document.createElement('div'); ov.id = 'tm-pos-ov'; ov.className = 'tm-ov';
  ov.innerHTML = `<div class="tm-ficha tm-pos-card" role="dialog" aria-modal="true">
    <div class="tm-f-head"><div class="tm-f-tx"><b>My Terminal</b><span>Positions, watchlist and alerts · your wallet, your keys</span></div><button class="tm-f-x" type="button" aria-label="Close">✕</button></div>
    <div class="tm-tabs" id="tm-tabs"><button type="button" data-t="positions">Positions</button><button type="button" data-t="watch">Watchlist</button><button type="button" data-t="alerts">Alerts</button></div>
    <div class="tm-pos-body" id="tm-pos-body">${cargando}</div>
    <p class="tm-f-note" id="tm-pos-note"></p>
  </div>`;
  document.body.appendChild(ov);
  const cerrar = () => { try { ov.remove(); } catch (_) {} };
  ov.querySelector('.tm-f-x').onclick = cerrar;
  ov.addEventListener('click', (e) => { if (e.target === ov) cerrar(); });
  const body = $('tm-pos-body'), note = $('tm-pos-note'), tabs = $('tm-tabs');
  const vivo = () => ov.isConnected;
  const abrirDe = (o) => { cerrar(); abrirFicha(itMin(o)); };
  const ir = (t) => { tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); body.innerHTML = cargando; if (t === 'watch') renderWatch(); else if (t === 'alerts') renderAlertas(); else renderPositions(); };
  tabs.querySelectorAll('button').forEach((b) => { b.onclick = () => ir(b.dataset.t); });

  async function renderPositions() {
    note.textContent = 'Value and profit are read live from the chain. Entry cost is based on your buys made here.';
    const cuenta = wallet.cuentaActual();
    if (!cuenta) { body.innerHTML = `<div class="tm-pos-empty"><b>Connect your wallet</b><span>Your Terminal positions and live profit will show here.</span><button class="tm-b" id="tm-pos-conn" type="button">Connect wallet</button></div>`; const bc = $('tm-pos-conn'); if (bc) bc.onclick = async () => { try { await wallet.conectar(); } catch (_) {} if (vivo()) ir('positions'); }; return; }
    const lista = listaDe(cuenta);
    if (!lista.length) { body.innerHTML = `<div class="tm-pos-empty"><b>No positions yet</b><span>Buy a token from the Terminal and it shows here with your live profit.</span></div>`; return; }
    const datos = (await Promise.all(lista.map((p) => enVivo(cuenta, p, _bnbUsd).catch(() => null)))).filter((d) => d && d.cant > 0);
    if (!vivo()) return;
    if (!datos.length) { body.innerHTML = `<div class="tm-pos-empty"><b>No open positions</b><span>You are not holding any token bought here right now.</span></div>`; return; }
    datos.sort((a, b) => b.valorUsd - a.valorUsd);
    const totVal = datos.reduce((s, d) => s + d.valorUsd, 0), totCost = datos.reduce((s, d) => s + d.costoUsd, 0);
    const totPnl = totVal - totCost, totPct = totCost > 0 ? totPnl / totCost * 100 : 0;
    body.innerHTML = `<div class="tm-pos-tot"><div class="tm-pos-tv"><span>Total value</span><b>${money(totVal)}</b></div><div class="tm-pos-tp ${cl(totPnl)}"><span>Profit / loss</span><b>${sg(totPnl)}${money(Math.abs(totPnl))}</b><em>${sg(totPct)}${pct(Math.abs(totPct))}</em></div></div>`
      + datos.map((d) => `<div class="tm-pos-row ${cl(d.pnlUsd)}" data-a="${esc(d.token)}">
        <div class="tm-pos-tk">${logo(d.simbolo, d.token)}<div class="tm-pos-nm"><b>${esc(d.simbolo || '?')}</b><span>${numC(d.cant)} · in $${fmtP(d.entradaUsd)}</span></div></div>
        <div class="tm-pos-val"><b>${money(d.valorUsd)}</b><span class="tm-pos-pnl ${cl(d.pnlUsd)}">${sg(d.pnlUsd)}${money(Math.abs(d.pnlUsd))} · ${sg(d.pnlPct)}${pct(Math.abs(d.pnlPct))}</span></div>
        <button class="tm-pos-x" type="button" data-f="${esc(d.token)}" title="Remove from list">✕</button></div>`).join('');
    body.querySelectorAll('.tm-pos-row').forEach((r) => { r.onclick = (e) => { if (e.target.closest('.tm-pos-x')) return; const d = datos.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (d) abrirDe(d); }; });
    body.querySelectorAll('.tm-pos-x').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); olvidar(cuenta, b.dataset.f); ir('positions'); }; });
  }

  async function renderWatch() {
    note.textContent = 'Live price from the chain. Watching a token costs nothing and never touches your funds.';
    const l = listaWatch();
    if (!l.length) { body.innerHTML = `<div class="tm-pos-empty"><b>Nothing on your watchlist</b><span>Open a token and tap the star to keep an eye on it.</span></div>`; return; }
    const datos = await Promise.all(l.map(async (w) => ({ ...w, precioUsd: await precioActual({ par: w.par, token: w.token, decToken: w.decimales || 18, decQuote: 18, bnbUsd: _bnbUsd, quoteEsUSDT: w.moneda === 'USDT' }).catch(() => 0) })));
    if (!vivo()) return;
    body.innerHTML = datos.map((w) => `<div class="tm-pos-row" data-a="${esc(w.token)}">
        <div class="tm-pos-tk">${logo(w.simbolo, w.token)}<div class="tm-pos-nm"><b>${esc(w.simbolo || '?')}</b><span>${esc(w.nombre || '')}</span></div></div>
        <div class="tm-pos-val"><b>${w.precioUsd > 0 ? '$' + fmtP(w.precioUsd) : '$0'}</b><span>price</span></div>
        <button class="tm-pos-x" type="button" data-f="${esc(w.token)}" title="Remove from watchlist">✕</button></div>`).join('');
    body.querySelectorAll('.tm-pos-row').forEach((r) => { r.onclick = (e) => { if (e.target.closest('.tm-pos-x')) return; const w = datos.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (w) abrirDe(w); }; });
    body.querySelectorAll('.tm-pos-x').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); quitarWatch(b.dataset.f); ir('watch'); }; });
  }

  async function renderAlertas() {
    note.textContent = 'Alerts notify you while the Terminal is open. They are not orders and never touch your funds.';
    const l = listaAlertas();
    if (!l.length) { body.innerHTML = `<div class="tm-pos-empty"><b>No alerts set</b><span>Open a token and set a price alert. You get a notification when it is hit.</span></div>`; return; }
    const porToken = {}; for (const a of l) if (a.par && !(a.token.toLowerCase() in porToken)) porToken[a.token.toLowerCase()] = a;
    const precios = {}; await Promise.all(Object.values(porToken).map(async (a) => { precios[a.token.toLowerCase()] = await precioActual({ par: a.par, token: a.token, decToken: a.decimales || 18, decQuote: 18, bnbUsd: _bnbUsd, quoteEsUSDT: a.moneda === 'USDT' }).catch(() => 0); }));
    if (!vivo()) return;
    body.innerHTML = l.map((a) => { const p = precios[a.token.toLowerCase()] || 0; return `<div class="tm-pos-row ${a.disparada ? 'up' : ''}" data-a="${esc(a.token)}">
        <div class="tm-pos-tk">${logo(a.simbolo, a.token)}<div class="tm-pos-nm"><b>${esc(a.simbolo || '?')}</b><span>when ${a.dir === 'up' ? '≥' : '≤'} $${fmtP(a.objetivo)}${a.disparada ? ' · hit' : ''}</span></div></div>
        <div class="tm-pos-val"><b>${p > 0 ? '$' + fmtP(p) : '$0'}</b><span>now</span></div>
        <button class="tm-pos-x" type="button" data-f="${esc(a.id)}" title="Remove alert">✕</button></div>`; }).join('');
    body.querySelectorAll('.tm-pos-row').forEach((r) => { r.onclick = (e) => { if (e.target.closest('.tm-pos-x')) return; const a = l.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (a) abrirDe(a); }; });
    body.querySelectorAll('.tm-pos-x').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); quitarAlerta(b.dataset.f); ir('alerts'); }; });
  }

  ir(tab);
}
