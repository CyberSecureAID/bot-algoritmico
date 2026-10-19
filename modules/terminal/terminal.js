/* terminal/terminal.js. Interfaz de la Terminal (modulo sellado: solo ./motor.js y ./config.js).
   Fase 2: feed en vivo de tokens recien nacidos en BNB Chain (pares nuevos de PancakeSwap contra BNB
   o USDT, y monedas creadas en el Launchpad de DecFreedom). Misma tabla y estetica que New Tokens. */

import * as ethers from './ethers.min.js';
import * as gb from './motor.js';
import { auditar, PASOS, PASOS_TXT } from './auditoria.js';
import { abrirCompra } from './compra.js';
import { comoFunciona } from './aviso.js';
import { abrirFiltros } from './filtros.js';
import { velasDeToken, montarGrafico, destruirGrafico } from './grafico.js';
import * as wallet from './wallet.js';
import { listaDe, enVivo, olvidar } from './posiciones.js';
import { FEED, SCAN_URL, FOURMEME_URL } from './config.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const corto = (a) => a ? '…' + String(a).slice(-4) : '';

const ICO_BSC = '<svg class="tm-bsc" viewBox="0 0 126.61 126.61" fill="#F3BA2F"><path d="M38.73 53.2 63.3 28.63l24.6 24.6 14.3-14.31L63.3 0 24.42 38.89z"/><path d="M0 63.3l14.3-14.3 14.31 14.3-14.31 14.3z"/><path d="M38.73 73.41 63.3 97.98l24.59-24.58 14.31 14.29-38.9 38.91L24.42 87.7z"/><path d="M98 63.3l14.3-14.3 14.31 14.3-14.31 14.31z"/><path d="M77.83 63.3 63.3 48.77 52.56 59.51l-1.24 1.23-2.54 2.55 14.52 14.53z"/></svg>';
const ICO_COPY = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const ICO_BOLT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h8l-1 8 10-12h-8z"/></svg>';

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
        <div class="tm-sec-tt"><span class="tm-sec-ico">${ICO_BOLT}</span><div class="tm-sec-txt"><b>New pairs</b></div></div>
        <div class="tm-sec-r"><button class="tm-b sec" id="tm-pos" type="button">Positions</button><button class="tm-b sec tm-fil-b" id="tm-filtros" type="button">Filters</button><div class="tm-live" id="tm-live"><span>Connecting…</span></div></div>
      </div>
      <div id="tm-feed">${skeleton()}</div>
    </section>`;
  const fb = $('tm-filtros'); if (fb) fb.onclick = () => abrirFiltros({ items: () => _items.slice(), fila, thead, abrirFicha, auditarCache, auditoriaDe, bnbUsd: () => _bnbUsd });
  const how = $('tm-how'); if (how) how.onclick = () => { try { comoFunciona(); } catch (e) { console.warn('[TERM] how', e); } };
  const bpos = $('tm-pos'); if (bpos) bpos.onclick = () => { try { abrirPosiciones(); } catch (e) { console.warn('[TERM] pos', e); } };
  gb.precioBNBUSDT().then((v) => { _bnbUsd = v || 0; pintar(); }).catch(() => {});
  setInterval(() => { document.querySelectorAll('#tm-feed .tm-age').forEach((td) => { td.textContent = hace(Number(td.dataset.t)); }); }, 1000);
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
}

const COLS = ['#', 'Token', 'Symbol', 'Age', 'Liquidity', 'Price', 'Contract', 'Chain'];
const CLS = { '#': 'tm-c-num', 'Symbol': 'tm-c-sym', 'Age': 'tm-c-age', 'Liquidity': 'tm-c-liq', 'Price': 'tm-c-price', 'Contract': 'tm-c-cre', 'Chain': 'tm-c-chain' };
// En movil 'Liquidity' no cabe en su columna (se cortaba a 'LIQUIDIT'): se muestra 'Liq'. El resto de
// cabeceras son cortas y caben. tm-lg = solo escritorio, tm-sm = solo movil (reglas en terminal.css).
const LBL = (c) => c === 'Liquidity' ? '<span class="tm-lg">Liquidity</span><span class="tm-sm">Liq</span>' : c;
const thead = (extra = '') => `<thead><tr>${COLS.map((c) => (c === 'Chain' ? extra : '') + `<th class="${CLS[c] || ''}">${LBL(c)}</th>`).join('')}</tr></thead>`;
function skeleton() {
  const bar = (w) => `<span class="tm-sk" style="width:${w}px"></span>`;
  const filas = [96, 120, 84, 108, 92].map((w) => `<tr class="tm-skrow" aria-hidden="true"><td class="tm-num">${bar(12)}</td><td><span class="tm-tok-in"><span class="tm-sk tm-sk-dot"></span>${bar(w)}</span></td><td class="tm-sym">${bar(40)}</td><td class="tm-age">${bar(28)}</td><td class="tm-liq">${bar(60)}</td><td class="tm-price">${bar(52)}</td><td class="tm-cre">${bar(70)}</td><td class="tm-chain">${bar(20)}</td></tr>`).join('');
  return `<table class="tm-table">${thead()}<tbody>${filas}</tbody></table>`;
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
/* Auditoria continua de la lista principal: cada token una vez (cache), de 2 en 2, y repinta al llegar cada resultado. */
const _colaAud = []; const _enColaAud = new Set(); let _audArrancada = false, _repintar = null;
function encolarAuditoria(it) { const k = it.token.toLowerCase(); if (_enColaAud.has(k) || auditoriaDe(it)) return; _enColaAud.add(k); _colaAud.push(it); arrancarAuditorias(); }
function arrancarAuditorias() {
  if (_audArrancada) return; _audArrancada = true;
  const worker = async () => { for (;;) { const it = _colaAud.shift(); if (!it) { await new Promise((r) => setTimeout(r, 500)); continue; } try { await auditarCache(it); } catch (_) {} _enColaAud.delete(it.token.toLowerCase()); clearTimeout(_repintar); _repintar = setTimeout(pintar, 300); await new Promise((r) => setTimeout(r, 250)); } };
  worker();
}
function pintar() {
  const host = $('tm-feed'); if (!host) return;
  if (!_items.length) return;   // sigue el esqueleto hasta el primer token
  const esRojo = (it) => { const r = auditoriaDe(it); return !!(r && r.nivel === 'bad'); };
  const vis = _verRojos ? _items : _items.filter((it) => !esRojo(it));
  const ocultos = _items.length - vis.length;
  // (it, i): nunca pasar el 3er argumento de map (el array) a fila, cuyo tercer parametro `extra` es la celda Check.
  host.innerHTML = `<table class="tm-table">${thead('<th class="tm-c-chk"><span class="tm-lg">Check</span><span class="tm-sm">Chk</span></th>')}<tbody>${vis.map((it, i) => fila(it, i, celdaCheck(it))).join('')}</tbody></table>`
    + (ocultos || _verRojos ? `<div class="tm-ocultos">${ocultos ? ocultos + ' token' + (ocultos > 1 ? 's' : '') + ' hidden: Do not buy' : 'Showing Do not buy tokens'} <button type="button" id="tm-ver-rojos">${_verRojos ? 'Hide' : 'Show'}</button></div>` : '');
  const vr = $('tm-ver-rojos'); if (vr) vr.onclick = () => { _verRojos = !_verRojos; pintar(); };
  host.querySelectorAll('.tm-copyc').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); try { navigator.clipboard.writeText(b.dataset.copy); const o = b.innerHTML; b.innerHTML = 'copied ' + ICO_COPY; setTimeout(() => { if (b.isConnected) b.innerHTML = o; }, 1200); } catch (_) {} }; });
  host.querySelectorAll('.tm-row').forEach((r) => { r.onclick = () => { const it = _items.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (it) abrirFicha(it); }; });
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
export function abrirFicha(it) {
  _creadorFicha = it.creador || '';
  const prev = $('tm-ov'); if (prev) prev.remove();
  const liqUsd = it.moneda === 'USDT' ? it.liquidez : it.liquidez * _bnbUsd;
  const precioUsd = it.moneda === 'USDT' ? it.precio : it.precio * _bnbUsd;
  const ov = document.createElement('div'); ov.id = 'tm-ov'; ov.className = 'tm-ov';
  ov.innerHTML = `<div class="tm-ficha" role="dialog" aria-modal="true">
    <div class="tm-f-head">
      <div class="tm-f-tt">${logo(it.simbolo, it.token)}<div class="tm-f-tx"><b title="${esc(it.nombre)}">${esc(it.nombre || 'Token')}</b><span>${esc(it.simbolo || '?')} · <i class="tm-age" data-t="${it.tiempo || 0}">${hace(it.tiempo)}</i> ago · ${it.fuente === 'launchpad' ? 'DecFreedom Launchpad' : it.fuente === 'fourmeme' ? 'four.meme bonding curve' : it.moneda + ' pair'}</span></div></div>
      <button class="tm-f-x" type="button" aria-label="Close">✕</button>
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
function itDePos(d) {
  return { token: d.token, par: d.par, quote: d.quote, moneda: d.moneda || 'BNB', simbolo: d.simbolo, nombre: d.nombre || d.simbolo, decimales: d.decimales || 18, fuente: 'pancake', tiempo: d.abierta || 0, liquidez: 0, precio: d.moneda === 'USDT' ? d.precioUsd : (_bnbUsd > 0 ? d.precioUsd / _bnbUsd : 0), creador: '' };
}
export async function abrirPosiciones() {
  const prev = $('tm-pos-ov'); if (prev) prev.remove();
  const ov = document.createElement('div'); ov.id = 'tm-pos-ov'; ov.className = 'tm-ov';
  ov.innerHTML = `<div class="tm-ficha tm-pos-card" role="dialog" aria-modal="true">
    <div class="tm-f-head"><div class="tm-f-tx"><b>My positions</b><span>Opened from the Terminal · your wallet, your keys</span></div><button class="tm-f-x" type="button" aria-label="Close">✕</button></div>
    <div class="tm-pos-tot" id="tm-pos-tot" hidden></div>
    <div class="tm-pos-body" id="tm-pos-body"><div class="tm-pos-msg"><span class="tm-anillo"></span></div></div>
    <p class="tm-f-note">Value and profit are read live from the chain. Entry cost is based on your buys made here. Not a recommendation.</p>
  </div>`;
  document.body.appendChild(ov);
  const cerrar = () => { try { ov.remove(); } catch (_) {} };
  ov.querySelector('.tm-f-x').onclick = cerrar;
  ov.addEventListener('click', (e) => { if (e.target === ov) cerrar(); });
  const body = $('tm-pos-body'), tot = $('tm-pos-tot');
  const cuenta = wallet.cuentaActual();
  if (!cuenta) {
    body.innerHTML = `<div class="tm-pos-empty"><b>Connect your wallet</b><span>Your Terminal positions and live profit will show here.</span><button class="tm-b" id="tm-pos-conn" type="button">Connect wallet</button></div>`;
    const bc = $('tm-pos-conn'); if (bc) bc.onclick = async () => { try { await wallet.conectar(); } catch (_) {} if (ov.isConnected) { cerrar(); abrirPosiciones(); } };
    return;
  }
  const lista = listaDe(cuenta);
  if (!lista.length) { body.innerHTML = `<div class="tm-pos-empty"><b>No positions yet</b><span>Buy a token from the Terminal and it shows here with your live profit.</span></div>`; return; }
  const datos = await Promise.all(lista.map((p) => enVivo(cuenta, p, _bnbUsd).catch(() => null)));
  if (!ov.isConnected) return;
  const vivas = datos.filter((d) => d && d.cant > 0);
  if (!vivas.length) { body.innerHTML = `<div class="tm-pos-empty"><b>No open positions</b><span>You are not holding any token bought here right now.</span></div>`; return; }
  vivas.sort((a, b) => b.valorUsd - a.valorUsd);
  const totVal = vivas.reduce((s, d) => s + d.valorUsd, 0), totCost = vivas.reduce((s, d) => s + d.costoUsd, 0);
  const totPnl = totVal - totCost, totPct = totCost > 0 ? totPnl / totCost * 100 : 0;
  const sg = (v) => (v >= 0 ? '+' : '-'), cl = (v) => (v >= 0 ? 'up' : 'down');
  tot.hidden = false;
  tot.innerHTML = `<div class="tm-pos-tv"><span>Total value</span><b>${money(totVal)}</b></div>
    <div class="tm-pos-tp ${cl(totPnl)}"><span>Profit / loss</span><b>${sg(totPnl)}${money(Math.abs(totPnl))}</b><em>${sg(totPct)}${pct(Math.abs(totPct))}</em></div>`;
  body.innerHTML = vivas.map((d) => `<div class="tm-pos-row ${cl(d.pnlUsd)}" data-a="${esc(d.token)}">
      <div class="tm-pos-tk">${logo(d.simbolo, d.token)}<div class="tm-pos-nm"><b>${esc(d.simbolo || '?')}</b><span>${numC(d.cant)} · in $${fmtP(d.entradaUsd)}</span></div></div>
      <div class="tm-pos-val"><b>${money(d.valorUsd)}</b><span class="tm-pos-pnl ${cl(d.pnlUsd)}">${sg(d.pnlUsd)}${money(Math.abs(d.pnlUsd))} · ${sg(d.pnlPct)}${pct(Math.abs(d.pnlPct))}</span></div>
      <button class="tm-pos-x" type="button" data-f="${esc(d.token)}" title="Remove from list">✕</button>
    </div>`).join('');
  body.querySelectorAll('.tm-pos-row').forEach((r) => { r.onclick = (e) => { if (e.target.closest('.tm-pos-x')) return; const d = vivas.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (d) { cerrar(); abrirFicha(itDePos(d)); } }; });
  body.querySelectorAll('.tm-pos-x').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); olvidar(cuenta, b.dataset.f); cerrar(); abrirPosiciones(); }; });
}
