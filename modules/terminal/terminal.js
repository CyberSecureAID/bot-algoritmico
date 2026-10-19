/* terminal/terminal.js. Interfaz de la Terminal (modulo sellado: solo ./motor.js y ./config.js).
   Fase 2: feed en vivo de tokens recien nacidos en BNB Chain (pares nuevos de PancakeSwap contra BNB
   o USDT, y monedas creadas en el Launchpad de DecFreedom). Misma tabla y estetica que New Tokens. */

import * as ethers from './ethers.min.js';
import * as gb from './motor.js';
import { auditar } from './auditoria.js';
import { abrirCompra } from './compra.js';
import { comoFunciona } from './aviso.js';
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

export function arrancar() {
  const host = $('tm-app'); if (!host) return;
  host.innerHTML = `
    <section class="tm-hero">
      <h1 class="tm-h1">Terminal</h1>
      <p class="tm-sub">New tokens on BNB Chain, the second they are born. Checked by Wallet Shield before you buy. Your wallet, your keys.</p>
      <div class="tm-hero-acts"><button class="tm-b sec" id="tm-how" type="button">How it works</button></div>
    </section>
    <section class="tm-panel">
      <div class="tm-sec-head">
        <div class="tm-sec-tt"><span class="tm-sec-ico">${ICO_BOLT}</span><div class="tm-sec-txt"><b>New pairs</b><span>PancakeSwap and DecFreedom Launchpad, live from the chain</span></div></div>
        <div class="tm-live" id="tm-live"><i></i><span>Connecting…</span></div>
      </div>
      <div id="tm-feed">${skeleton()}</div>
    </section>`;
  const how = $('tm-how'); if (how) how.onclick = () => { try { comoFunciona(); } catch (e) { console.warn('[TERM] how', e); } };
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
    <td class="tm-tok"><span class="tm-tok-in">${logo(it.simbolo, it.token)}<span class="tm-tok-nom" title="${esc(it.nombre)}">${esc(abreviar(it.nombre))}</span>${fuente}</span></td>
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
  host.querySelectorAll('.tm-row').forEach((r) => { r.onclick = () => { const it = _items.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (it) abrirFicha(it); }; });
}

/* ───────── Ficha del token: datos + auditoria de seguridad en semaforo ───────── */
const ICO_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>';
const ICO_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
const ICO_BAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const ICO_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
const ICO_N = { ok: ICO_OK, warn: ICO_WARN, bad: ICO_BAD, info: ICO_INFO, pend: ICO_INFO };
const TXT_NIVEL = { ok: 'Safe to trade', warn: 'Trade with caution', bad: 'Do not buy', pend: 'Checking security' };
const pct = (v) => (v == null || !isFinite(v)) ? '—' : (Math.round(v * 10) / 10) + '%';

export function abrirFicha(it) {
  const prev = $('tm-ov'); if (prev) prev.remove();
  const liqUsd = it.moneda === 'USDT' ? it.liquidez : it.liquidez * _bnbUsd;
  const precioUsd = it.moneda === 'USDT' ? it.precio : it.precio * _bnbUsd;
  const ov = document.createElement('div'); ov.id = 'tm-ov'; ov.className = 'tm-ov';
  ov.innerHTML = `<div class="tm-ficha" role="dialog" aria-modal="true">
    <div class="tm-f-head">
      <div class="tm-f-tt">${logo(it.simbolo, it.token)}<div class="tm-f-tx"><b title="${esc(it.nombre)}">${esc(it.nombre || 'Token')}</b><span>${esc(it.simbolo || '?')} · <i class="tm-age" data-t="${it.tiempo || 0}">${hace(it.tiempo)}</i> ago · ${it.fuente === 'launchpad' ? 'DecFreedom Launchpad' : 'PancakeSwap ' + it.moneda + ' pair'}</span></div></div>
      <button class="tm-f-x" type="button" aria-label="Close">✕</button>
    </div>
    <div class="tm-sem pend" id="tm-sem"><span class="tm-sem-ico">${ICO_INFO}</span><div><b>${TXT_NIVEL.pend}</b><span>Reading the contract and the security scanner…</span></div></div>
    <div class="tm-kv">
      <div><span>Liquidity</span><b>${liqUsd > 0 ? money(liqUsd) : (it.par ? '—' : 'Launchpad pool')}</b></div>
      <div><span>Price</span><b>${precioUsd > 0 ? '$' + fmtP(precioUsd) : '—'}</b></div>
      <div><span>Holders</span><b id="tm-k-hold">—</b></div>
      <div><span>Top 10</span><b id="tm-k-top">—</b></div>
      <div><span>Creator</span><b id="tm-k-cre">—</b></div>
      <div><span>Buy / Sell tax</span><b id="tm-k-tax">—</b></div>
      <div><span>LP secured</span><b id="tm-k-lp">—</b></div>
      <div><span>Contract</span><b><button class="tm-copyc" type="button" data-copy="${esc(it.token)}">${corto(it.token)} ${ICO_COPY}</button></b></div>
    </div>
    <ul class="tm-hall" id="tm-hall"><li class="tm-h-sk"><span class="tm-sk" style="width:60%"></span></li><li class="tm-h-sk"><span class="tm-sk" style="width:45%"></span></li><li class="tm-h-sk"><span class="tm-sk" style="width:70%"></span></li></ul>
    <div class="tm-f-acts">
      <a class="tm-b sec" href="${SCAN_URL}/token/${esc(it.token)}" target="_blank" rel="noopener">BscScan</a>
      ${it.fuente === 'launchpad' ? `<a class="tm-b" href="../launchpad/launchpad.html">Launchpad</a>` : `<button class="tm-b" id="tm-f-swap" type="button">Swap</button>`}
    </div>
    <p class="tm-f-note">This check reads what the contract allows today. It does not predict price and it is not a recommendation. Anyone can lose money on a new token.</p>
  </div>`;
  document.body.appendChild(ov);
  const cerrar = () => { try { ov.remove(); } catch (_) {} };
  let _aud = null;
  const bSwap = $('tm-f-swap'); if (bSwap) bSwap.onclick = () => abrirCompra(it, _aud);
  ov.querySelector('.tm-f-x').onclick = cerrar;
  ov.addEventListener('click', (e) => { if (e.target === ov) cerrar(); });
  const cb = ov.querySelector('.tm-copyc'); cb.onclick = () => { try { navigator.clipboard.writeText(cb.dataset.copy); const o = cb.innerHTML; cb.innerHTML = 'copied ' + ICO_COPY; setTimeout(() => { if (cb.isConnected) cb.innerHTML = o; }, 1200); } catch (_) {} };
  auditar(it.token, it.par).then((r) => { _aud = r; if (ov.isConnected) pintarAuditoria(r); }).catch((e) => { try { console.warn('[TERM-AUDIT] fallo', e); } catch (_) {} if (ov.isConnected) pintarAuditoria({ nivel: 'pend', titulo: 'Checking', hallazgos: [{ n: 'info', t: 'Security check unavailable', d: 'Could not reach the scanner. Try again.' }], datos: {} }); });
}
function pintarAuditoria(r) {
  const sem = $('tm-sem'); if (!sem) return;
  sem.className = 'tm-sem ' + r.nivel;
  const bS = $('tm-f-swap'); if (bS) { if (r.nivel === 'bad') { bS.disabled = true; bS.textContent = 'Do not buy'; } else { bS.disabled = false; bS.textContent = 'Swap'; } }
  const nb = (r.hallazgos || []).filter((x) => x.n === 'bad').length, nw = (r.hallazgos || []).filter((x) => x.n === 'warn').length;
  const sub = r.nivel === 'pend' ? esc(r.titulo) : r.nivel === 'ok' ? 'No red flags found in the contract'
    : (nb ? nb + ' critical issue' + (nb > 1 ? 's' : '') : '') + (nb && nw ? ' and ' : '') + (nw ? nw + ' warning' + (nw > 1 ? 's' : '') : '');
  sem.innerHTML = `<span class="tm-sem-ico">${ICO_N[r.nivel]}</span><div><b>${TXT_NIVEL[r.nivel]}</b><span>${sub}</span></div>`;
  const d = r.datos || {};
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('tm-k-hold', d.holders != null ? Number(d.holders).toLocaleString('en-US') : '—');
  set('tm-k-top', pct(d.top10Pct));
  set('tm-k-cre', pct(d.creadorPct));
  set('tm-k-tax', (d.buyTax != null || d.sellTax != null) ? pct(d.buyTax || 0) + ' / ' + pct(d.sellTax || 0) : '—');
  set('tm-k-lp', pct(d.lpAsegurada));
  const ul = $('tm-hall'); if (!ul) return;
  ul.innerHTML = r.hallazgos.map((x) => `<li class="${x.n}"><span class="tm-h-ico">${ICO_N[x.n] || ICO_INFO}</span><div><b>${esc(x.t)}</b><span>${esc(x.d || '')}</span></div></li>`).join('');
}
