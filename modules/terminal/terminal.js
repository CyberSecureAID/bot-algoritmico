/* terminal/terminal.js. Interfaz de la Terminal (modulo sellado: solo ./motor.js y ./config.js).
   Fase 2: feed en vivo de tokens recien nacidos en BNB Chain (pares nuevos de PancakeSwap contra BNB
   o USDT, y monedas creadas en el Launchpad de DecFreedom). Misma tabla y estetica que New Tokens. */

import * as gb from './motor.js';
import { FEED, SCAN_URL } from './config.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const corto = (a) => a ? '…' + String(a).slice(-4) : '';

const ICO_BSC = '<svg class="tm-bsc" viewBox="0 0 126.61 126.61" fill="#F3BA2F"><path d="M38.73 53.2 63.3 28.63l24.6 24.6 14.3-14.31L63.3 0 24.42 38.89z"/><path d="M0 63.3l14.3-14.3 14.31 14.3-14.31 14.3z"/><path d="M38.73 73.41 63.3 97.98l24.59-24.58 14.31 14.29-38.9 38.91L24.42 87.7z"/><path d="M98 63.3l14.3-14.3 14.31 14.3-14.31 14.31z"/><path d="M77.83 63.3 63.3 48.77 52.56 59.51l-1.24 1.23-2.54 2.55 14.52 14.53z"/></svg>';
const ICO_COPY = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const ICO_BOLT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h8l-1 8 10-12h-8z"/></svg>';

/* Precio: cifras significativas, con subindice para los muy pequenos (igual que el launchpad). */
function fmtP(p, sig = 4) {
  if (!(p > 0) || !isFinite(p)) return '—';
  if (p >= 0.001) return Number(p.toPrecision(sig)).toString();
  const e = Math.floor(Math.log10(p)); const ceros = -e - 1;
  const dig = Math.round(p / Math.pow(10, e - sig + 1)).toString().slice(0, sig);
  return `0.0<sub>${ceros}</sub>${dig}`;
}
function money(v) { if (!(v > 0)) return '—'; if (v >= 1e6) return '$' + (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'; if (v >= 1e3) return '$' + (v / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K'; return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function hace(ms) { if (!ms) return '—'; const s = Math.max(0, Math.floor((Date.now() - ms) / 1000)); if (s < 60) return s + 's'; const m = Math.floor(s / 60); if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; }
function abreviar(n) { const s = String(n || '').trim(); if (!s) return 'Token'; const p = s.split(/\s+/)[0]; return p.length > 12 ? p.slice(0, 11) + '…' : (s.length > p.length ? p + '…' : p); }
const logo = (sim) => `<span class="tm-logo"><span class="tm-logo-fb">${esc((String(sim || '?'))[0].toUpperCase())}</span></span>`;

let _items = [];          // mas nuevo primero
let _bnbUsd = 0;
let _parar = null;

export function arrancar() {
  const host = $('tm-app'); if (!host) return;
  host.innerHTML = `
    <section class="tm-hero">
      <h1 class="tm-h1">Terminal</h1>
      <p class="tm-sub">New tokens on BNB Chain, the second they are born. Checked by Wallet Shield before you buy. Your wallet, your keys.</p>
    </section>
    <section class="tm-panel">
      <div class="tm-sec-head">
        <div class="tm-sec-tt"><span class="tm-sec-ico">${ICO_BOLT}</span><div class="tm-sec-txt"><b>New pairs</b><span>PancakeSwap and DecFreedom Launchpad, live from the chain</span></div></div>
        <div class="tm-live" id="tm-live"><i></i><span>Connecting…</span></div>
      </div>
      <div id="tm-feed">${skeleton()}</div>
    </section>`;
  gb.precioBNBUSDT().then((v) => { _bnbUsd = v || 0; pintar(); }).catch(() => {});
  setInterval(() => { document.querySelectorAll('#tm-feed .tm-age').forEach((td) => { td.textContent = hace(Number(td.dataset.t)); }); }, 1000);
  if (_parar) _parar();
  _parar = gb.arrancarFeed({
    alNuevo: (it) => { _items.push(it); _items.sort((a, b) => b.bloque - a.bloque); if (_items.length > FEED.maxFilas) _items.length = FEED.maxFilas; pintar(); },
    alEstado: ({ bloque, vivo, error }) => {
      const el = $('tm-live'); if (!el) return;
      el.classList.toggle('off', !vivo);
      el.querySelector('span').textContent = vivo ? 'Live · block ' + bloque.toLocaleString('en-US') : 'Reconnecting…';
      if (error) try { console.warn('[TERM] estado', error); } catch (_) {}
    }
  });
}

const COLS = ['#', 'Token', 'Symbol', 'Age', 'Liquidity', 'Price', 'Contract', 'Chain'];
const CLS = { '#': 'tm-c-num', 'Symbol': 'tm-c-sym', 'Age': 'tm-c-age', 'Liquidity': 'tm-c-liq', 'Price': 'tm-c-price', 'Contract': 'tm-c-cre', 'Chain': 'tm-c-chain' };
const thead = () => `<thead><tr>${COLS.map((c) => `<th class="${CLS[c] || ''}">${c}</th>`).join('')}</tr></thead>`;
function skeleton() {
  const bar = (w) => `<span class="tm-sk" style="width:${w}px"></span>`;
  const filas = [96, 120, 84, 108, 92].map((w) => `<tr class="tm-skrow" aria-hidden="true"><td class="tm-num">${bar(12)}</td><td><span class="tm-tok-in"><span class="tm-sk tm-sk-dot"></span>${bar(w)}</span></td><td class="tm-sym">${bar(40)}</td><td class="tm-age">${bar(28)}</td><td class="tm-liq">${bar(60)}</td><td class="tm-price">${bar(52)}</td><td class="tm-cre">${bar(70)}</td><td class="tm-chain">${bar(20)}</td></tr>`).join('');
  return `<table class="tm-table">${thead()}<tbody>${filas}</tbody></table>`;
}
function fila(it, i) {
  const liqUsd = it.moneda === 'USDT' ? it.liquidez : it.liquidez * _bnbUsd;
  const precioUsd = it.moneda === 'USDT' ? it.precio : it.precio * _bnbUsd;
  const liqTxt = it.par ? (liqUsd > 0 ? money(liqUsd) : (it.liquidez > 0 ? fmtP(it.liquidez, 3) + ' ' + it.moneda : '—')) : '<span class="tm-badge lp">Launchpad</span>';
  const fuente = it.fuente === 'launchpad' ? '<span class="tm-badge lp">LP</span>' : (it.moneda === 'USDT' ? '<span class="tm-badge">USDT</span>' : '');
  return `<tr class="tm-row" data-a="${esc(it.token)}">
    <td class="tm-num">${i + 1}</td>
    <td class="tm-tok"><span class="tm-tok-in">${logo(it.simbolo)}<span class="tm-tok-nom" title="${esc(it.nombre)}">${esc(abreviar(it.nombre))}</span>${fuente}</span></td>
    <td class="tm-sym">${esc(it.simbolo || '?')}</td>
    <td class="tm-age" data-t="${it.tiempo || 0}">${hace(it.tiempo)}</td>
    <td class="tm-liq">${liqTxt}</td>
    <td class="tm-price">${precioUsd > 0 ? fmtP(precioUsd) : '—'}</td>
    <td class="tm-cre"><button class="tm-copyc" type="button" data-copy="${esc(it.token)}" title="${esc(it.token)}">${corto(it.token)} ${ICO_COPY}</button></td>
    <td class="tm-chain">${ICO_BSC}</td>
  </tr>`;
}
function pintar() {
  const host = $('tm-feed'); if (!host) return;
  if (!_items.length) return;   // sigue el esqueleto hasta el primer token
  host.innerHTML = `<table class="tm-table">${thead()}<tbody>${_items.map(fila).join('')}</tbody></table>`;
  host.querySelectorAll('.tm-copyc').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); try { navigator.clipboard.writeText(b.dataset.copy); const o = b.innerHTML; b.innerHTML = 'copied ' + ICO_COPY; setTimeout(() => { if (b.isConnected) b.innerHTML = o; }, 1200); } catch (_) {} }; });
  // Por ahora la fila abre el token en BscScan; la fase siguiente abre la ficha con Shield y compra.
  host.querySelectorAll('.tm-row').forEach((r) => { r.onclick = () => window.open(SCAN_URL + '/token/' + r.dataset.a, '_blank', 'noopener'); });
}
