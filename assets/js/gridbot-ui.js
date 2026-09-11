/**
 * LA COLMENA — app del bot de rejilla (página propia, pantalla completa)
 * =====================================================================
 * Se dibuja dentro de <div id="colmena-app"> de colmena.html. Lenguaje simple,
 * botones (i), gráfica viva con las cuadrículas, e inversión total en una cifra.
 */

import * as gb from './gridbot.js?v=125';
import * as wallet from './wallet.js?v=125';
import { MONEDAS, LISTA_TODAS } from './tokens.js?v=125';
import * as perfil from './perfil.js?v=125';
import * as prizepool from './prizepool.js?v=126';
import * as tutorial from './tutorial.js?v=125';
import * as market from './market.js?v=125';
import * as avisos from './avisos.js?v=125';
import * as grafica from './grafica.js?v=125';
import * as extras from './extras.js?v=200';
import * as gestos from './gestos.js?v=125';
import { inyectarEstilo } from './gridbot/estilos.js?v=201';
import { moneda, num, _movil, tipoNum, escT, enCristiano, fmtPrecioUSD, icoInner, limpiarBusy, modalBusy, modalBusyTexto, modalError, modalClose } from './gridbot/util.js?v=1';
import { LOGOS, LOGO_ST } from './gridbot/estado.js?v=1';
import { APP, BASES, QUOTES, INFO, FEE_CICLO, GAS_OP_USD, VOL_DIARIA, PRESETS, NOMBRE_PRESET, GAS_VUELTA_USD, COM_DEX, LOGOS_WALLET, KEEPER_URL, CONF_BOTS, CLAVE_AVISO, CUPO_TOTAL, CUPO_POR_TIPO, NOMBRE_TIPO, CAT_NOMBRES, BOTMETA, RESERVA_BNB } from './gridbot/config.js?v=1';
import { abrirSwap, initSwap } from './gridbot/swap.js?v=4';

const $ = (id) => document.getElementById(id);
// Lo que se OPERA (base). Las estables no pueden ser base.
// Contra qué se mide (quote): estables.


const F = { baseId: 'BNB', quoteId: 'USDT', modo: 'geo', precio: null, rutas: null, avanzado: false, saldoQuote: null, preset: 'equilibrado', tipo: 'grid', margenModo: 'cuadriculas' };

/* En móvil se muestra la cáscara tipo exchange (assets/js/movil). Para que NO
   se vea un parpadeo de la web antes de que monte, ocultamos su contenedor
   desde ya con una regla que la propia cáscara desactiva al abrir "bots". */
try {
  if (window.matchMedia('(max-width: 760px)').matches && !window._mvHideWeb) {
    const _st = document.createElement('style');
    _st.textContent = '#colmena-app{visibility:hidden}#swap-modal,#coin-modal{visibility:visible!important}'
      + '#np-fab-previo,#npFab{display:none!important}';
    (document.head || document.documentElement).appendChild(_st);
    window._mvHideWeb = _st;
  }
} catch (_) {}
/* Configuraciones auditadas: cada cuadrícula deja beneficio REAL después de
   pagar el gas de la red y la comisión del exchange, incluso con 50 USDT.
   Antes "Activo" (40 cuadrículas en ±12%) perdía dinero en cada vuelta: las
   cuadrículas quedaban al 0,6% y las comisiones se comían la ganancia. */
/* Coste real de una vuelta (comprar + vender) medido en la red. */

/* ================================================================== */
/* Estilos                                                             */
/* ================================================================== */

/* ================================================================== */
/* Utilidades                                                          */
/* ================================================================== */
function precioFmt(n) {
  if (n === null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a === 0) return '0';
  if (a >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (a >= 0.01) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (a >= 0.0001) return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
  const dec = Math.min(18, -Math.floor(Math.log10(a)) + 3);
  return n.toFixed(dec).replace(/0+$/, '').replace(/\.$/, '');
}
function animarNumero(el) {
  const to = parseFloat(el.dataset.to); if (!isFinite(to)) return;
  // Solo la primera vez y solo si el valor cambió: si no, cada refresco
  // volvería a contar desde cero y resultaría mareante.
  if (el.dataset.hecho === String(to)) return;
  el.dataset.hecho = String(to);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dec = parseInt(el.dataset.dec || '0', 10), pre = el.dataset.pre || '', suf = el.dataset.suf || '';
  const dur = 800, t0 = performance.now();
  const step = (t) => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3);
    el.textContent = pre + num(to * e, dec) + suf; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function activarContadores() { document.querySelectorAll(`#${APP} .numgo`).forEach(animarNumero); }

/* ---- Modal de la página (reemplaza confirm/alert del navegador) ---- */
function modalConfirm(o) {
  return new Promise((resolve) => {
    const m = $('colmena-modal'); if (!m) return resolve(false);
    $('cm-title').textContent = o.titulo || '';
    $('cm-body').innerHTML = o.cuerpo || '';
    const btns = m.querySelector('.m-btns'); btns.style.display = 'flex';
    const ok = $('cm-ok'), cancel = $('cm-cancel');
    cancel.style.display = ''; cancel.textContent = o.cancelar || 'Cancelar';
    ok.textContent = o.ok || 'Confirmar'; ok.className = 'btn ' + (o.peligro ? 'btn-rojo' : 'btn-oro');
    m.classList.add('show');
    const fin = (v) => { ok.onclick = null; cancel.onclick = null; m.onclick = null; resolve(v); };
    ok.onclick = () => fin(true);
    cancel.onclick = () => { m.classList.remove('show'); fin(false); };
    m.onclick = (e) => { if (e.target === m) { m.classList.remove('show'); fin(false); } };
  });
}
/** Pausa el flujo antes de una firma y espera un toque del usuario.
 *  Clave en móvil: tras cada firma la wallet te devuelve a su pantalla; este
 *  "Continuar" hace que la siguiente firma la inicie un toque fresco (con la
 *  dApp enfocada), evitando que la wallet te bote entre transacción y transacción. */
function pasoWallet(titulo, texto) {
  return new Promise((resolve) => {
    const m = $('colmena-modal'); if (!m) return resolve();
    limpiarBusy();
    $('cm-title').textContent = titulo || '';
    $('cm-body').innerHTML = texto || '';
    m.querySelector('.m-btns').style.display = 'flex';
    const ok = $('cm-ok'), cancel = $('cm-cancel');
    if (cancel) cancel.style.display = 'none';
    ok.textContent = 'Continuar'; ok.className = 'btn btn-oro';
    m.onclick = null;
    m.classList.add('show');
    ok.onclick = () => { ok.onclick = null; resolve(); };
  });
}
function modalDone(titulo, txt) {
  const m = $('colmena-modal'); if (!m) return;
  limpiarBusy(); $('cm-title').textContent = titulo; $('cm-body').innerHTML = txt;
  const btns = m.querySelector('.m-btns'); btns.style.display = 'flex';
  $('cm-cancel').style.display = 'none'; const ok = $('cm-ok');
  ok.textContent = '¡Listo!'; ok.className = 'btn btn-oro'; ok.onclick = () => m.classList.remove('show');
  m.classList.add('show');
}

/* ---- Logo de la moneda (Trust Wallet) con respaldo a monograma ---- */
function logoDe(addr, simbolo) {
  const ini = (simbolo || '?').slice(0, 3);
  let url = null; try { url = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${gb.checksum(addr)}/logo.png`; } catch (_) {}
  return url ? `<img class="pio-logo" src="${url}" alt="${simbolo}" onerror="window.__botLogoFail(this,'${ini}')">` : `<div class="pio-mono">${ini}</div>`;
}

/* ---- Tiempo activo (Xd Yh Zm) ---- */
function tiempoActivo(seg) {
  let s = Math.floor(Date.now() / 1000 - Number(seg)); if (!(s > 0)) s = 0;
  const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const mm = Math.floor(s / 60); const ss = s - mm * 60;
  return `${d}d ${h}h ${mm}m ${ss}s`;
}
let RELOJ = null;
function iniciarReloj() {
  if (RELOJ) return;
  RELOJ = setInterval(() => {
    document.querySelectorAll(`#${APP} .pio-time`).forEach((el) => { const s = Number(el.dataset.since); if (s) el.textContent = tiempoActivo(s); });
  }, 1000);
}

/* ---- Animación: recorrido de un bot de rejilla (para el hero) ---- */
function animacionRecorrido() {
  const W = 560, H = 250, padL = 18, padR = 18;
  const ys = [55, 90, 125, 160, 195], mid = 125;
  const lines = ys.map((y) => `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="${y < mid ? 'var(--rojo)' : 'var(--neon)'}" stroke-width="1.3" stroke-dasharray="7 7" opacity=".5"/>`).join('');
  const etq = `<text x="${padL}" y="46" fill="var(--rojo)" font-family="IBM Plex Mono" font-size="10">vende</text><text x="${padL}" y="220" fill="var(--neon-lit)" font-family="IBM Plex Mono" font-size="10">compra</text>`;
  const d = `M ${padL} 125 C 110 55, 175 195, 255 90 S 395 200, 460 105 S 545 160, ${W - padR} 125`;
  const path = `<path d="${d}" fill="none" stroke="rgba(228,245,239,.22)" stroke-width="1.5"/>`;
  const dot = `<circle r="6" fill="#E4F5EF"><animateMotion dur="7s" repeatCount="indefinite" path="${d}"/><animate attributeName="r" values="5;8;5" dur="1.3s" repeatCount="indefinite"/></circle>`;
  const pops = [[150, 3], [305, 5], [455, 4]].map(([x, val], i) => `<text x="${x}" y="120" fill="var(--neon-lit)" font-family="IBM Plex Mono" font-size="13" font-weight="700" opacity="0">+$${val}<animate attributeName="opacity" values="0;1;0" dur="7s" begin="${i * 2.2}s" repeatCount="indefinite"/><animate attributeName="y" values="120;78" dur="7s" begin="${i * 2.2}s" repeatCount="indefinite"/></text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">${lines}${etq}${path}${pops}${dot}</svg>`;
}
function dias(seg) { const s = Number(seg); return s ? Math.max(0, Math.floor((Date.now()/1000 - s)/86400)).toString() : '0'; }
const _avT = new WeakMap();
function aviso(el, tipo, msg, ms = 5000) {
  if (!el) return;
  el.innerHTML = `<div class="aviso ${tipo}">${msg}</div>`;
  const t = _avT.get(el); if (t) clearTimeout(t);
  if (ms > 0) _avT.set(el, setTimeout(() => { el.innerHTML = ''; }, ms));
}
function iBtn(k) { return `<button class="i-btn" data-info="${k}" type="button">i</button>`; }
function abrirPop(btn) {
  const pop = $('colmena-pop'); pop.textContent = INFO[btn.dataset.info] || '';
  const r = btn.getBoundingClientRect(); pop.style.display = 'block';
  pop.style.left = Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - 300) + 'px';
  pop.style.top = (window.scrollY + r.bottom + 6) + 'px';
}
function wirePops(root) { (root || document).querySelectorAll('.i-btn').forEach((b) => b.onclick = (e) => { e.stopPropagation(); abrirPop(b); }); }

/* Campo numérico con flechas propias (con estilo) y tope en el mínimo. */
function campoNum(id, o = {}) {
  const min = o.min ?? 0;
  const attrs = [
    `id="${id}"`, 'type="${tipoNum()}"', 'inputmode="decimal"',
    o.placeholder != null ? `placeholder="${o.placeholder}"` : '',
    o.value != null ? `value="${o.value}"` : '',
    `min="${min}"`, o.max != null ? `max="${o.max}"` : '',
    `step="${o.int ? 1 : (o.step ?? 'any')}"`,
    `data-min="${min}"`, o.max != null ? `data-max="${o.max}"` : '',
    o.pct != null ? `data-pct="${o.pct}"` : `data-step="${o.step ?? 1}"`,
    o.int ? 'data-int="1"' : ''
  ].filter(Boolean).join(' ');
  return `<div class="stepper${o.suffix ? ' has-suffix' : ''}"><input ${attrs}>${o.suffix ? `<span class="cash-eq" id="${o.suffix}"></span>` : ''}<span class="stepper-btns"><button type="button" class="st-up" tabindex="-1">▲</button><button type="button" class="st-dn" tabindex="-1">▼</button></span></div>`;
}
function wireSteppers(root) {
  (root || document).querySelectorAll(`#${APP} .stepper`).forEach((wr) => {
    const inp = wr.querySelector('input'); if (!inp) return;
    const isInt = inp.dataset.int === '1', pct = inp.dataset.pct ? parseFloat(inp.dataset.pct) : null;
    const lims = () => ({ min: parseFloat(inp.dataset.min), max: inp.dataset.max != null && inp.dataset.max !== '' ? parseFloat(inp.dataset.max) : Infinity });
    const paso = (dir) => {
      const { min, max } = lims();
      let v = parseFloat(inp.value); if (!isFinite(v)) v = isFinite(min) ? min : 0;
      const delta = pct ? Math.max(v * pct, 0.000001) : parseFloat(inp.dataset.step || '1');
      let nv = (pct && v === 0) ? min + (dir > 0 ? delta : 0) : v + dir * delta;
      if (nv < min) nv = min; if (nv > max) nv = max;
      inp.value = isInt ? Math.round(nv) : Number(nv.toPrecision(8));
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    };
    wr.querySelector('.st-up').onclick = () => paso(1);
    wr.querySelector('.st-dn').onclick = () => paso(-1);
    inp.addEventListener('change', () => {
      const { min, max } = lims(); const v = parseFloat(inp.value); if (!isFinite(v)) return;
      const c = v < min ? min : v > max ? max : v;
      if (c !== v) { inp.value = isInt ? Math.round(c) : Number(c.toPrecision(8)); inp.dispatchEvent(new Event('input', { bubbles: true })); }
    });
  });
}

/* ================================================================== */
/* Gráficas                                                            */
/* ================================================================== */
function nivelesPreview(pMin, pMax, n, modo) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    out.push(modo === 'geo' ? pMin * Math.pow(pMax / pMin, t) : pMin + (pMax - pMin) * t);
  }
  return out;
}
/** Dibuja una rejilla. `precios` = array de {p, tipo} donde tipo: 'compra'|'venta'|'off'. */
function dibujar(precios, precio, pMin, pMax, samples, ops) {
  const W = 560, H = 320, padL = 70, padR = 16, padT = 16, padB = 26;
  if (!(pMin > 0 && pMax > pMin)) return svgVacio(W, H, 'Pon un rango para ver la rejilla');
  const y = (p) => padT + (H - padT - padB) * (1 - (Math.max(pMin, Math.min(pMax, p)) - pMin) / (pMax - pMin));
  const partes = [];
  if (precio && precio >= pMin && precio <= pMax) {
    const yp = y(precio);
    partes.push(`<rect x="${padL}" y="${yp}" width="${W-padR-padL}" height="${(H-padB-yp).toFixed(1)}" fill="#2EE86A" opacity=".05"/>`);
    partes.push(`<rect x="${padL}" y="${padT}" width="${W-padR-padL}" height="${(yp-padT).toFixed(1)}" fill="#FF6B6B" opacity=".05"/>`);
  }
  for (const nv of precios) {
    if (nv.p < pMin || nv.p > pMax) continue;
    const yy = y(nv.p).toFixed(1);
    const col = nv.tipo === 'compra' ? 'var(--neon)' : nv.tipo === 'venta' ? 'var(--rojo)' : 'var(--ink-3)';
    const op = nv.tipo === 'off' ? '.35' : '.8';
    partes.push(`<line x1="${padL}" y1="${yy}" x2="${W-padR}" y2="${yy}" stroke="${col}" stroke-width="1.4" opacity="${op}"/>`);
  }
  const dentro = precio && precio >= pMin && precio <= pMax;
  const yp = precio ? (precio > pMax ? padT : precio < pMin ? H - padB : y(precio)) : null;
  const hayOps = ops && ops.length > 0;
  const hayTrail = !hayOps && samples && samples.length > 1;

  if (hayOps) {
    // RASTRO REAL: trayectoria de las operaciones ejecutadas (compra verde / venta roja)
    const n = ops.length, x0 = padL, x1 = W - padR;
    const xi = (i) => n === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * (i / (n - 1));
    if (n > 1) {
      const pts = ops.map((o, i) => `${xi(i).toFixed(1)},${y(o.precio).toFixed(1)}`);
      partes.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="rgba(228,245,239,.45)" stroke-width="1.6" stroke-linejoin="round"/>`);
    }
    ops.forEach((o, i) => {
      const c = o.compra ? '#4DFF7A' : '#FF6B6B';
      partes.push(`<circle cx="${xi(i).toFixed(1)}" cy="${y(o.precio).toFixed(1)}" r="4.2" fill="${c}" stroke="#020C08" stroke-width="1"/>`);
    });
  }
  if (hayTrail) {
    const n = samples.length, x0 = padL, x1 = W - padR;
    const pts = samples.map((p, i) => `${(x0 + (x1 - x0) * (i / (n - 1))).toFixed(1)},${y(p).toFixed(1)}`);
    partes.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#4DFF7A" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/>`);
    partes.push(`<circle cx="${x1.toFixed(1)}" cy="${y(samples[n-1]).toFixed(1)}" r="4.5" fill="#E4F5EF"><animate attributeName="r" values="4;8;4" dur="1.3s" repeatCount="indefinite"/></circle>`);
  }
  if (precio) {
    const suave = hayOps || hayTrail;
    partes.push(`<line x1="${padL}" y1="${yp.toFixed(1)}" x2="${W-padR}" y2="${yp.toFixed(1)}" stroke="#E4F5EF" stroke-width="${suave ? 1 : 2}" stroke-dasharray="5 4" opacity="${suave ? '.4' : '1'}"/>`);
    if (!suave) partes.push(`<circle cx="${padL}" cy="${yp.toFixed(1)}" r="4" fill="#E4F5EF"><animate attributeName="r" values="3;7;3" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.3;1" dur="1.4s" repeatCount="indefinite"/></circle>`);
    partes.push(`<text x="${W-padR}" y="${(yp - 6).toFixed(1)}" fill="#E4F5EF" font-family="IBM Plex Mono" font-size="11" text-anchor="end">precio ${precioFmt(precio)}${dentro ? '' : ' (fuera)'}</text>`);
  }
  partes.push(`<text x="8" y="${padT+9}" fill="#9DBDB2" font-family="IBM Plex Mono" font-size="10">${precioFmt(pMax)}</text>`);
  partes.push(`<text x="8" y="${H-padB+4}" fill="#9DBDB2" font-family="IBM Plex Mono" font-size="10">${precioFmt(pMin)}</text>`);
  if (!hayOps && !hayTrail) partes.push(`<line x1="${padL}" x2="${W-padR}" y1="${padT}" y2="${padT}" stroke="#4DFF7A" stroke-width="1.5"><animate attributeName="y1" values="${padT};${H-padB};${padT}" dur="5s" repeatCount="indefinite"/><animate attributeName="y2" values="${padT};${H-padB};${padT}" dur="5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;.45;0" dur="5s" repeatCount="indefinite"/></line>`);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${partes.join('')}</svg>`;
}
function svgVacio(W, H, txt) {
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><text x="${W/2}" y="${H/2}" fill="#64857A" font-family="IBM Plex Mono" font-size="13" text-anchor="middle">${txt}</text></svg>`;
}
function graficaPreview() {
  const pMin = parseFloat($('f-min')?.value), pMax = parseFloat($('f-max')?.value), n = parseInt($('f-niv')?.value, 10);
  if (!(pMin > 0 && pMax > pMin && n >= 2)) return svgVacio(560, 320, 'Pon un rango para ver la rejilla');
  const ps = nivelesPreview(pMin, pMax, n, F.modo).map((p) => ({ p, tipo: F.precio ? (p < F.precio ? 'compra' : 'venta') : 'compra' }));
  return dibujar(ps, F.precio, pMin, pMax);
}

/* ================================================================== */
/* Encabezado                                                          */
/* ================================================================== */
function headerHTML() {
  const cuenta = wallet.cuentaActual();
  let right;
  if (!cuenta) right = `<button class="btn btn-oro hdr-btn" id="c-conectar">Conectar wallet</button>`;
  else if (!wallet.esRedCorrecta()) right = `<button class="btn btn-rojo hdr-btn" id="c-red">Cambiar a BNB Chain</button>`;
  else right = `<span class="c-sep"></span><button class="c-perfil" id="c-perfil" type="button" aria-label="Mi perfil"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.6-3.4 3.2-5 6.5-5s5.9 1.6 6.5 5"/></svg></button><button class="dir" id="c-dir" type="button" title="Cambiar de wallet">${iconoWallet()}<span class="dir-tx">${String(cuenta).slice(-4)}</span><span class="dir-ch"></span></button>`;
  return `<header class="c-hdr">
    <a class="c-brand" href="./"><img class="c-logo" src="assets/img/cco-logo.png" alt="" width="30" height="30"><img class="c-logo-full" src="assets/img/cco-full.webp" alt="Cripto Cuba Oficial" width="152" height="40" loading="eager"></a>
    <span class="c-estado" id="c-estado" title="Estado de tu wallet"><i></i><b>Sin conectar</b></span>
    <img class="c-logo-mov" src="assets/img/cco-movil.webp" alt="CriptoCuba Oficial" width="140" height="91" loading="eager" decoding="async">
    <button class="c-ticker" id="c-ticker" type="button" aria-label="Prize Pool"><img class="c-ticker-img" src="assets/img/cinta-prize.webp" alt="Prize Pool" loading="lazy"></button>
    <div class="c-hdr-r">

      <button class="c-swap" id="c-swap" type="button" aria-label="Intercambiar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10 3 6l4-4"/><path d="M3 6h14"/><path d="m17 14 4 4-4 4"/><path d="M21 18H7"/></svg><span class="c-swap-tx">Swap</span></button>
      <button class="c-swap c-academy" id="c-academy" type="button" aria-label="Academy"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 9 12 4 2 9l10 5 10-5z"/><path d="M6 11.5V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5"/><path d="M22 9v5"/></svg><span class="c-swap-tx">Academy</span></button>
      <button class="c-swap c-tools" id="c-tools" type="button" aria-label="Herramientas"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg><span class="c-swap-tx">Tools</span></button>
      <button class="c-swap c-liq" id="c-liq" type="button" aria-label="Liquidity Pools"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h4V10H3zM10 20h4V4h-4zM17 20h4v-7h-4z"/></svg><span class="c-swap-tx">Liquidity</span></button>
      <button class="c-prize" id="c-prize" type="button" aria-label="Prize Pool"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg><span class="c-prize-tx">Prize Pool</span></button>
      <button class="c-market" id="c-market" type="button" aria-label="Marketplace"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18l-1.5 10.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 9z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/></svg><span class="c-market-tx">Market</span></button>
      <button class="c-loteria" id="c-instalar" type="button" aria-label="Instalar la app"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg><span class="c-lot-tx"><span class="lbl-pc">Install</span><span class="lbl-mov">Compartir</span></span></button>
      ${right}
    </div>
    <button class="c-menu-btn" id="c-menu-btn" type="button" aria-label="Menú"><span></span><span></span><span></span></button>
  </header>`;
}
/* En el móvil, algunos navegadores pintan unas flechitas en los campos
   numéricos que no hay forma de quitar con CSS. Con type=text más
   inputmode=decimal sale el mismo teclado y ninguna flecha. */

/* Logo de la wallet conectada (lo envía la propia wallet, sin servidores externos) */
/* ══════════════════════════════════════════════════════════════
   EL LOGO DE LA WALLET

   Antes salía un rectangulito gris: la wallet informa de su marca
   (metamask, trust…) pero no siempre trae su icono, y el código solo
   miraba el icono. Ahora, si no lo trae, se dibuja el logo a mano.
   Se reconocen al vuelo y quedan mucho mejor que un cuadrado.
   ══════════════════════════════════════════════════════════════ */

function iconoWallet() {
  try {
    const info = wallet.walletInfo ? wallet.walletInfo() : null;
    if (info?.icon) return `<img class="dir-logo" src="${info.icon}" alt="">`;
    if (info?.clave && LOGOS_WALLET[info.clave]) return LOGOS_WALLET[info.clave];

    /* [CORREGIDO] walletInfo() devuelve null si la wallet no llegó por
       el canal moderno (EIP-6963), que es lo habitual con MetaMask en
       escritorio. Por eso salía el cuadradito genérico.
       Se mira el proveedor directamente, que siempre está. */
    const p = window.ethereum;
    if (p) {
      const cual = p.isTrust || p.isTrustWallet ? 'trust'
                 : p.isPhantom ? 'phantom'
                 : p.isCoinbaseWallet ? 'coinbase'
                 : p.isBinance ? 'binance'
                 : p.isRabby ? 'rabby'
                 : p.isMetaMask ? 'metamask'
                 : null;
      if (cual && LOGOS_WALLET[cual]) return LOGOS_WALLET[cual];
    }
  } catch (_) {}
  return `<svg class="dir-logo" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="2" y="6" width="20" height="13" rx="3"/><path d="M16 12h.01"/></svg>`;
}

/* Desplegable para cambiar de wallet */
function abrirSelectorWallet(ancla) {
  const prev = $('wsel'); if (prev) { prev.remove(); return; }
  let lista = [];
  try { lista = wallet.walletsDisponibles ? wallet.walletsDisponibles() : []; } catch (_) {}

  const d = document.createElement('div');
  d.id = 'wsel';
  d.innerHTML = `<div class="wsel-bg"></div>
    <div class="wsel-p">
      <div class="wsel-t">Tus wallets</div>
      ${lista.map((w) => `
        <button class="wsel-b ${w.activa ? 'on' : ''}" data-w="${escT(w.id)}">
          ${w.icono ? `<img src="${escT(w.icono)}" alt="">` : '<span class="wsel-i"></span>'}
          <b>${escT(w.nombre)}</b>
          ${w.activa ? '<span class="wsel-ok">Conectada</span>' : ''}
        </button>`).join('')}
      <button class="wsel-b" data-wc="1">
        <span class="wsel-i wc"><svg viewBox="0 0 32 32" width="18" height="18" fill="currentColor"><path d="M8.4 11.7c4.2-4.1 11-4.1 15.2 0l.5.5c.2.2.2.5 0 .7l-1.7 1.7c-.1.1-.3.1-.4 0l-.7-.7c-2.9-2.9-7.7-2.9-10.6 0l-.8.7c-.1.1-.3.1-.4 0L7.8 12.9c-.2-.2-.2-.5 0-.7l.6-.5zm18.8 3.5 1.5 1.5c.2.2.2.5 0 .7l-6.8 6.7c-.2.2-.5.2-.7 0L16.4 19c0-.1-.1-.1-.2 0l-4.8 4.8c-.2.2-.5.2-.7 0l-6.8-6.7c-.2-.2-.2-.5 0-.7l1.5-1.5c.2-.2.5-.2.7 0l4.8 4.8c.1.1.2.1.2 0l4.8-4.8c.2-.2.5-.2.7 0l4.8 4.8c.1.1.2.1.2 0l4.8-4.8c.2-.2.5-.2.7 0z"/></svg></span>
        <b>Otra wallet (QR)</b>
      </button>
      ${lista.length === 0 ? '<div class="wsel-v">No hay wallets en este navegador. Usa la opción de arriba para conectar desde tu teléfono.</div>' : ''}
    </div>`;
  document.body.appendChild(d);
  // colocar justo debajo de la cápsula
  const r = ancla.getBoundingClientRect();
  const p = d.querySelector('.wsel-p');
  p.style.top = (r.bottom + 8) + 'px';
  p.style.right = Math.max(10, window.innerWidth - r.right) + 'px';

  const cerrar = () => d.remove();
  d.querySelector('.wsel-bg').onclick = cerrar;
  const bwc = d.querySelector('[data-wc]');
  if (bwc) bwc.onclick = () => { cerrar(); hacerConexion(() => wallet.conectarWalletConnect()); };
  d.querySelectorAll('[data-w]').forEach((b) => b.onclick = () => {
    const id = b.getAttribute('data-w'); cerrar();
    Promise.resolve().then(() => wallet.conectarCon(id)).catch((e) => {
      const el = $('c-hero-msg') || $('c-msg');
      console.warn('[Aurex] detalle técnico:', e);
      if (el) aviso(el, 'err', enCristiano(e), 7000);
    });
  });
}

/** Convierte los errores técnicos en algo que se entiende. */

/** Avisa al keeper que vigile esta cuenta (así ejecuta sus bots).
 *  Si falla, no pasa nada: el bot queda creado igual. */
function avisarKeeper(cuenta) {
  if (!cuenta) return;
  try { fetch(`${KEEPER_URL}/registrar?u=${cuenta}`, { mode: 'cors' }).catch(() => {}); } catch (_) {}
}

function hacerConexion(fn) {
  Promise.resolve().then(fn).catch((e) => {
    const el = $('c-hero-msg') || $('c-msg');
    console.warn('[Aurex] detalle técnico:', e);
    if (el) aviso(el, 'err', enCristiano(e), 8000);
  });
}

function conectarWallet() {
  try {
    if (wallet.necesitaWalletConnect && wallet.necesitaWalletConnect()) {
      // En el móvil damos DOS caminos: abrir la web dentro de la wallet (nunca
      // falla) o WalletConnect. Antes solo había WalletConnect y si fallaba,
      // el usuario se quedaba sin poder conectar.
      if (wallet.esMovil && wallet.esMovil()) { opcionesMovil(); return; }
      hacerConexion(() => wallet.conectarWalletConnect());
      return;
    }
  } catch (_) {}
  hacerConexion(() => wallet.conectar());
}

/* Ventana con las dos vías para conectar desde el teléfono */
function opcionesMovil() {
  const prev = $('cmov'); if (prev) prev.remove();
  const d = document.createElement('div');
  d.id = 'cmov';
  d.innerHTML = `<div class="cm-bg"></div>
    <div class="cm-c">
      <button class="cm-x" aria-label="Cerrar">✕</button>
      <div class="cm-t">Conecta tu wallet</div>
      <div class="cm-s">Elige cómo quieres hacerlo.</div>

      <div class="cm-eti">Lo más sencillo</div>
      <button class="cm-b oro" data-abrir="metamask">Abrir en MetaMask</button>
      <button class="cm-b" data-abrir="trust">Abrir en Trust Wallet</button>
      <button class="cm-b" data-abrir="safepal">Abrir en SafePal</button>
      <div class="cm-n">Se abre CriptoCuba dentro de tu wallet y conecta solo.</div>

      <div class="cm-eti">O sin salir de aquí</div>
      <button class="cm-b" data-wc="1">Conectar con WalletConnect</button>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => { const e = $('cmov'); if (e) e.remove(); };
  d.querySelector('.cm-bg').onclick = cerrar;
  d.querySelector('.cm-x').onclick = cerrar;
  d.querySelectorAll('[data-abrir]').forEach((b) => b.onclick = () => {
    wallet.abrirEnWalletMovil(b.getAttribute('data-abrir'));
  });
  d.querySelector('[data-wc]').onclick = () => { cerrar(); hacerConexion(() => wallet.conectarWalletConnect()); };
}

function wireHeader() {
  if ($('c-swap')) $('c-swap').onclick = abrirSwap;
  // La academia se carga solo cuando alguien la pide: no pesa al entrar.
  // Herramientas: se cargan solo al pedirlas.
  /* ══════════════════════════════════════════════════════════════
     ENLACES DIRECTOS A UNA SECCIÓN

     Permite que el bot de Telegram (o cualquier enlace compartido)
     abra la sección concreta en vez de la portada:

       criptocubaoficial.com/#academia
       criptocubaoficial.com/#liquidity
       criptocubaoficial.com/#market

     Se espera un momento a que la wallet se conecte, porque algunas
     secciones la necesitan para pintarse bien.
     ══════════════════════════════════════════════════════════════ */
  const RUTAS = {
    academia: 'c-academy', academy: 'c-academy', planes: 'c-academy',
    liquidity: 'c-liq', liquidez: 'c-liq', pro: 'c-liq',
    market: 'c-market', mercado: 'c-market', p2p: 'c-market',
    sorteo: 'c-prize', prize: 'c-prize',
    tools: 'c-tools', herramientas: 'c-tools'
  };

  const abrirRuta = () => {
    const r = (location.hash || '').replace('#', '').toLowerCase().trim();
    if (!r || !RUTAS[r]) return;
    const b = $(RUTAS[r]);
    if (b) {
      b.click();
      // Se limpia para que al recargar no vuelva a abrirse sola
      history.replaceState(null, '', location.pathname);
    }
  };
  setTimeout(abrirRuta, 1200);
  window.addEventListener('hashchange', abrirRuta);

  // Liquidity Pools: se carga solo al pedirlo.
  if ($('c-liq')) $('c-liq').onclick = async () => {
    try {
      const lq = await import('./liquidity.js?v=126');
      lq.abrirLiquidity();
    } catch (e) { console.warn('[Aurex] liquidity:', e); }
  };

  if ($('c-tools')) $('c-tools').onclick = async () => {
    try {
      const t = await import('./tools.js?v=127');
      t.abrirTools();
      t.vigilar();                    // arranca la vigilancia de alertas
    } catch (e) { console.warn('[Aurex] tools:', e); }
  };

  /* El punto verde: conectado o no, de un vistazo. */
  const pintarEstado = () => {
    const e = $('c-estado'); if (!e) return;
    const hay = !!(wallet.cuentaActual && wallet.cuentaActual());
    e.classList.toggle('on', hay);
    const t = e.querySelector('b');
    if (t) t.textContent = hay ? 'Activo' : 'Sin conectar';
  };
  pintarEstado();
  /* [CORREGIDO] El logo de la wallet se dibujaba UNA vez, al montar la
     cabecera, cuando todavía no se sabía qué wallet era: salía el icono
     genérico y ahí se quedaba. Ahora se vuelve a pintar al conectar. */
  /* [CORREGIDO] Buscaba un elemento con clase .dir-logo, pero el icono
     genérico que se pinta al arrancar no siempre la lleva. Al no
     encontrarlo, no repintaba nada y se quedaba el cuadradito.
     Ahora se busca el primer hijo, sea lo que sea. */
  const pintarLogoWallet = () => {
    const d = $('c-dir'); if (!d) return;
    const viejo = d.querySelector('.dir-logo') || d.firstElementChild;
    if (!viejo || viejo.classList.contains('dir-tx')) return;
    const tmp = document.createElement('span');
    tmp.innerHTML = iconoWallet();
    const nuevo = tmp.firstElementChild;
    if (nuevo && nuevo.outerHTML !== viejo.outerHTML) viejo.replaceWith(nuevo);
  };
  /* Se reintenta varias veces: algunas wallets tardan en decir cuáles
     son, y con un solo intento a los 400ms se perdía. */
  [200, 700, 1500, 3000].forEach((ms) => setTimeout(pintarLogoWallet, ms));
  try {
    wallet.alCambiar(() => { pintarEstado(); setTimeout(pintarLogoWallet, 250); });
  } catch (_) {}

  if ($('c-academy')) $('c-academy').onclick = async () => {
    try {
      const ac = await import('./academy.js?v=126');
      ac.abrirAcademy();
    } catch (e) { console.warn('[Aurex] academy:', e); }
  };
  if ($('c-conectar')) $('c-conectar').onclick = conectarWallet;
  if ($('c-dir')) $('c-dir').onclick = (e) => { e.stopPropagation(); abrirSelectorWallet($('c-dir')); };
  if ($('c-red')) $('c-red').onclick = () => wallet.cambiarARedCorrecta().catch(() => {});
  if ($('c-off')) $('c-off').onclick = () => wallet.desconectar().catch(() => {});
  if ($('c-perfil')) $('c-perfil').onclick = () => perfil.abrirPerfil();
  if ($('c-prize')) $('c-prize').onclick = () => prizepool.abrirPrizePool();
  if ($('c-ticker')) $('c-ticker').onclick = () => prizepool.abrirPrizePool();
  tutorial.wireFila(document);
  if ($('c-market')) $('c-market').onclick = () => { avisos.limpiarPunto(); market.abrirMarket(); };
  /* Si el usuario ya eligió idioma en otra visita, se aplica. Va en
     try por si el módulo no carga: sin él, todo sigue en español. */
  (async () => {
    try {
      const idi = await import('./idioma.js?v=132');
      idi.arrancarIdioma();
      const tx = $('c-idioma-tx');
      if (tx) tx.textContent = idi.idiomaActual().toUpperCase();
    } catch (_) {}
  })();

  if ($('c-instalar')) $('c-instalar').onclick = (e) => { e.stopPropagation(); extras.panelInstalar($('c-instalar')); };
  try { avisos.iniciar(); } catch (_) {}
  try { extras.iniciarInstalacion(); } catch (_) {}
  // El panel de control (57 KB) solo lo usa el dueño. Se carga al detectar
  // los cinco clics en la esquina, no al entrar. Un visitante normal no
  // descarga nunca ese peso.
  try { prepararPanelOculto(); } catch (_) {}
  // Gestos del móvil: deslizar entre bots y tirar para actualizar.
  try {
    gestos.iniciarDeslizar();
    gestos.iniciarTirarParaActualizar(async () => {
      await Promise.all([
        cargarPrecio(),
        refrescarGas(),
        refrescarSaldoInversion(),
        refrescarRejillas()
      ].map((p) => Promise.resolve(p).catch(() => {})));
    });
  } catch (_) {}
  const hdr = document.querySelector('#colmena-app .c-hdr');
  if ($('c-menu-btn') && hdr) $('c-menu-btn').onclick = (e) => { e.stopPropagation(); hdr.classList.toggle('open'); };
  if (hdr) { const hr = hdr.querySelector('.c-hdr-r'); if (hr) hr.addEventListener('click', () => hdr.classList.remove('open')); }
  if (!window._menuDocWired) {
    window._menuDocWired = true;
    document.addEventListener('click', (e) => {
      const h = document.querySelector('#colmena-app .c-hdr');
      if (h && h.classList.contains('open') && !h.contains(e.target)) h.classList.remove('open');
    });
  }
}
function footerHTML() {
  const faqs = [
    ['¿Cómo retiro mis ganancias?', 'No hay nada que retirar. Tus ganancias caen solas en tu wallet cada vez que el bot vende. El dinero siempre está en tu poder, nunca en el nuestro.'],
    ['¿Qué hace el bot exactamente?', 'Compra barato y vende caro por ti, solo, mientras el precio sube y baja dentro del rango que elijas. Repite ese ciclo una y otra vez.'],
    ['¿Qué es un bot de cuadrícula?', 'Divide un rango de precios en niveles (cuadrículas). Cuando el precio baja a un nivel compra, cuando sube al siguiente vende. Gana con cada subida y bajada.'],
    ['¿Qué es el Bot Acumulador?', 'Compra en la caída (más volumen mientras más baja) y vende TODO junto cuando el total gana el porcentaje que elijas. Hace menos operaciones, ideal para acumular.'],
    ['¿Es seguro mi dinero?', 'Sí. Tus monedas nunca salen de tu wallet a manos de nadie. Le das un permiso limitado que puedes quitar cuando quieras.'],
    ['¿Necesito cuenta o KYC?', 'No. Solo tu wallet. Sin registros, sin papeleo y sin exchange.'],
    ['¿Cuánto cuesta usar la plataforma?', 'Una activación de aproximadamente 1 dólar al mes, que te deja crear todos los bots que quieras. Aparte pagas el gas de la red (unos centavos por operación).'],
    ['¿Qué es el gas?', 'Es el costo que cobra la red BNB por cada operación (comprar o vender). Es de unos centavos y sale del tanque de gas que cargas en cada bot.'],
    ['¿Por qué tengo que cargar gas?', 'Porque el bot paga a la red cada vez que compra o vende. Sin gas, el bot no puede operar. Cárgale un poco de BNB en la sección de gas del bot.'],
    ['¿Puedo perder dinero?', 'Sí. El trading tiene riesgo. Si el precio se sale del rango, el bot espera. Invierte solo lo que puedas permitirte perder. Esto no es consejo financiero.'],
    ['¿Qué pasa si el precio se sale del rango?', 'El bot deja de operar y espera a que el precio vuelva a entrar. Por eso conviene elegir un rango amplio.'],
    ['¿Qué es la Ganancia por cuadrícula?', 'El beneficio mínimo que exiges por cada cuadrícula, por encima de la comisión. El sistema ajusta las cuadrículas para que cada venta deje ganancia limpia.'],
    ['¿Qué es la separación entre cuadrículas?', 'La distancia de precio entre un nivel y el siguiente. Más separación significa menos operaciones pero cada una más rentable.'],
    ['¿Por qué con poco capital gano poco?', 'Porque el gas por operación es fijo. Con poco dinero cada cuadrícula es pequeña y la ganancia por vuelta es de centavos. La ganancia escala con el capital.'],
    ['¿Cuánto capital me conviene poner?', 'Cuanto más, mejor rinde en proporción. Con más capital cada cuadrícula es mayor y la ganancia por vuelta crece.'],
    ['¿Qué es Grid profit?', 'La ganancia ya realizada: dinero que el bot ya ganó cerrando cuadrículas completas y que ya está en tu wallet.'],
    ['¿Qué es el Flotante?', 'La ganancia o pérdida no realizada: cuánto vale ahora lo que el bot tiene comprado, comparado con lo que pagó. Sube y baja con el mercado.'],
    ['¿Qué son las Vueltas?', 'Una vuelta entera es una operación completa: el bot compró y luego vendió. Ahí se concreta la ganancia de rejilla.'],
    ['¿Qué es el precio medio?', 'El precio promedio al que compraste. Si el mercado sube por encima de ese precio, tu posición está en ganancia.'],
    ['¿Cómo activo un bot?', 'Elige el tipo de bot, la moneda, el rango y cuánto inviertes. Firma la activación y la creación en tu wallet, y listo.'],
    ['¿Puedo tener varios bots a la vez?', 'Sí. Con la activación mensual puedes crear todos los bots que quieras, en distintas monedas.'],
    ['¿Cómo cierro un bot?', 'Con el botón Cerrar y vender. Vende todo a estable y el dinero queda en tu wallet.'],
    ['¿Qué monedas puedo usar?', 'Pares con buena liquidez en PancakeSwap: BNB, BTCB, ETH y varias más, contra USDT o USDC.'],
    ['¿En qué red funciona?', 'En BNB Smart Chain (BSC), donde hay liquidez profunda y el gas es barato.'],
    ['¿Quién ejecuta las operaciones?', 'Un servicio automático vigila el precio y dispara las compras y ventas por ti, sin que tengas que hacer nada.'],
    ['¿Por qué mi wallet muestra un aviso?', 'Porque el contrato es nuevo y aún no tiene reputación. El permiso que otorgas es limitado y revocable.'],
    ['¿El bot trabaja si cierro la página?', 'Sí. El bot vive en la blockchain y se opera solo las 24 horas, aunque cierres el navegador.'],
    ['¿Qué es el slippage?', 'La pequeña diferencia entre el precio esperado y el real al operar. En pares líquidos es mínimo.'],
    ['¿Puedo confiar en los números que veo?', 'Sí. Todo lo que ves (ganancia, vueltas, precio medio) sale directo del contrato en la blockchain. No hay datos inventados.']
  ];
  const card = ([q, a], i) => `<div class="c-faq" data-faq="${(q + ' ' + a).toLowerCase().replace(/["<>]/g, '')}" data-q="${q.replace(/"/g, '&quot;')}" data-a="${a.replace(/"/g, '&quot;')}"${i >= 6 ? ' style="display:none"' : ''}><h5>${q}</h5><p>${a}</p></div>`;
  return `<footer class="c-foot">
    <details class="c-faq-wrap">
      <summary><span class="faq-long">¿Tienes dudas sobre cómo funciona la plataforma?</span><span class="faq-short">¿Tienes dudas? Toca aquí</span></summary>
      <div style="padding:16px">
        ${tutorial.filaBots()}
        <input class="faq-search" id="faq-search" type="text" autocomplete="off" placeholder="Escribe aquí sobre lo que quieres saber…">
        <div class="c-foot-grid" id="faq-grid">${faqs.map(card).join('')}</div>
        <div class="faq-empty" id="faq-empty" style="display:none">No encontramos nada con esa palabra. Prueba con otra.</div>
      </div>
    </details>
    <div class="c-foot-bottom">Cripto Cuba Oficial · Opera bajo tu propio riesgo</div>
  </footer>`;
}
function wireFaq() {
  const inp = document.getElementById('faq-search'); if (!inp) return;
  const grid = document.getElementById('faq-grid'), empty = document.getElementById('faq-empty');
  if (!grid) return;
  const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const hl = (t, q) => {
    if (!q) return esc(t);
    const low = t.toLowerCase(); let out = '', i = 0, idx;
    while ((idx = low.indexOf(q, i)) >= 0) { out += esc(t.slice(i, idx)) + '<mark class="faq-hl">' + esc(t.slice(idx, idx + q.length)) + '</mark>'; i = idx + q.length; }
    return out + esc(t.slice(i));
  };
  inp.oninput = () => {
    const q = inp.value.trim().toLowerCase();
    let shown = 0;
    grid.querySelectorAll('.c-faq').forEach((c, i) => {
      const show = q ? c.dataset.faq.includes(q) : i < 6;
      c.style.display = show ? '' : 'none'; if (show) shown++;
      const h5 = c.querySelector('h5'), p = c.querySelector('p');
      if (h5) h5.innerHTML = hl(c.dataset.q || h5.textContent, q);
      if (p) p.innerHTML = hl(c.dataset.a || p.textContent, q);
    });
    if (empty) empty.style.display = (q && shown === 0) ? '' : 'none';
  };
}

/* ================================================================== */
/* Render                                                              */
/* ================================================================== */
function render() {
  const host = $(APP); if (!host) return;
  inyectarEstilo(tipoNum);
  const cuenta = wallet.cuentaActual();

  if (!cuenta) {
    host.innerHTML = headerHTML() + `<div class="wrap">
      <div class="conectar-box">
        <h2>Cripto Cuba Oficial</h2>
        <p>Bots que compran barato y venden caro por ti, en tu propia wallet. Sin custodia y sin KYC.</p>
        <button class="btn btn-oro" id="c-conectar2">Conectar wallet</button>
        <div id="c-hero-msg" style="margin-top:12px"></div>
      </div>
      ${footerHTML()}</div>`;
    wireHeader(); wireFaq();
    if ($('c-conectar2')) $('c-conectar2').onclick = conectarWallet;
    return;
  }

  const optHTML = (ids, val) => ids.map((id) => `<option value="${id}" ${id === val ? 'selected' : ''}>${moneda(id).simbolo}</option>`).join('');

  host.innerHTML = headerHTML() + `<div class="wrap">
    <div class="cols">
      <div class="card">
        <h3>Arma tu bot</h3>
        <div class="bot-tabs" id="f-tipo">
          <button type="button" data-tipo="grid" class="bot-tab ${F.tipo==='grid'?'on':''}"><span class="bt-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></span><span class="bt-nom">Smart Grid</span></button>
          <button type="button" data-tipo="acum" class="bot-tab ${F.tipo==='acum'?'on':''}"><span class="bt-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg></span><span class="bt-nom">Accumulator</span></button>
          <button type="button" data-tipo="cash" class="bot-tab ${F.tipo==='cash'?'on':''}"><span class="bt-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span><span class="bt-nom">Cash Out</span></button>
          <button type="button" data-tipo="dca" class="bot-tab ${F.tipo==='dca'?'on':''}"><span class="bt-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg></span><span class="bt-nom">DCA</span></button>
        </div>
        <div class="bot-foto" id="f-foto">
          <img id="f-foto-img" alt="" src="${BOTMETA[F.tipo].img}" onerror="this.classList.add('nocarga')">
          <div class="bot-foto-cap"><b id="f-foto-tit">${BOTMETA[F.tipo].nom}</b><span id="f-foto-des">${BOTMETA[F.tipo].des}</span></div>
        </div>
        <div class="lab">Moneda ${iBtn('par')}</div>
        <div class="fila fila-coins">
          <button type="button" class="coin-sel" id="f-base-btn">
            <span class="coin-sel-l"><span class="coin-sel-ico" id="fb-ico"></span><span class="coin-sel-tx"><b id="fb-sim">—</b><i id="fb-nom"></i></span></span>
            <span class="coin-chev"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
          </button>
          <button type="button" class="coin-sel" id="f-quote-btn">
            <span class="coin-sel-l"><span class="coin-sel-ico" id="fq-ico"></span><span class="coin-sel-tx"><b id="fq-sim">—</b><i id="fq-nom"></i></span></span>
            <span class="coin-chev"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
          </button>
        </div>
        <div id="f-grid" style="${F.tipo!=='grid'?'display:none':''}">
          <button type="button" class="btn-conf" id="f-abrir-conf">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>
            <span class="v-l">Configuraciones rentables</span><span class="v-s">Configuración</span>
            <span class="bc-sel" id="f-conf-sel">${F.preset ? NOMBRE_PRESET[F.preset] : 'elegir'}</span>
          </button>
          <div class="lab">Rango de precio ${iBtn('rango')}</div>
          <div class="fila">${campoNum('f-min',{placeholder:'precio bajo',pct:0.005})}${campoNum('f-max',{placeholder:'precio alto',pct:0.005})}</div>
          <div class="fila">
            <div><div class="lab">Cuadrículas ${iBtn('cuadriculas')}</div>${campoNum('f-niv',{value:20,min:2,max:100,step:1,int:true})}</div>
            <div><div class="lab" style="gap:10px"><span style="display:flex;align-items:center;gap:6px"><span class="inv-lbl">Inv. <span id="f-total-sym">(${moneda(F.quoteId).simbolo})</span></span> ${iBtn('inversion')}</span><span id="f-total-saldo" class="saldo-chip">—</span></div>${campoNum('f-total',{placeholder:'0.00',step:1,min:0})}</div>
          </div>
          <div class="lab"><span class="v-l">Gan. cuadrícula %</span><span class="v-s">Ganancia %</span> ${iBtn('margen')} <span style="color:var(--ink-3);font-size:11px;font-family:var(--mono)">opcional</span></div>
          ${campoNum('f-margen',{placeholder:'auto',min:0,max:20,step:0.5})}
          <div id="f-margen-nota"></div>
          <div class="paso-box"><span>Separación ${iBtn('separacion')}</span><b id="pv-paso">—</b></div>
        </div>
        <div id="f-acum" style="${F.tipo==='acum'?'':'display:none'}">
          <button type="button" class="btn-conf" data-conf-bot="acum"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg><span class="v-l">Configuraciones rentables</span><span class="v-s">Configuración</span><span class="bc-sel" id="conf-sel-acum">elegir</span></button>
          <div class="lab"><span class="v-l">Precio mínimo (hasta dónde compra)</span><span class="v-s">Precio mínimo</span> ${iBtn('acmin')}</div>
          ${campoNum('fa-min',{placeholder:'precio más bajo',pct:0.01})}
          <div class="fila">
            <div><div class="lab"><span class="v-l">Nº de compras</span><span class="v-s">Nº compras</span> ${iBtn('acniv')}</div>${campoNum('fa-niv',{value:15,min:2,max:100,step:1,int:true})}</div>
            <div><div class="lab">Inv. (${moneda(F.quoteId).simbolo}) ${iBtn('inversion')}</div>${campoNum('fa-total',{placeholder:'0.00',step:1,min:0})}</div>
          </div>
          <div class="fila">
            <div><div class="lab"><span class="v-l">Compra inicial %</span><span class="v-s">Inicial %</span> ${iBtn('acini')}</div>${campoNum('fa-ini',{value:30,min:0,max:100,step:5})}</div>
            <div><div class="lab"><span class="v-l">Comprar abajo %</span><span class="v-s">Abajo %</span> ${iBtn('acfactor')}</div>${campoNum('fa-factor',{value:20,min:0,max:200,step:5})}</div>
          </div>
          <div class="lab"><span class="v-l">Vender cuando gane</span><span class="v-s">Vender al %</span> ${iBtn('acobj')}</div>
          <div class="seg presets" id="fa-obj" style="grid-template-columns:repeat(5,1fr)">
            <button type="button" data-obj="3">3%</button><button type="button" data-obj="5">5%</button>
            <button type="button" data-obj="10" class="on">10%</button><button type="button" data-obj="15">15%</button><button type="button" data-obj="20">20%</button>
          </div>
          ${campoNum('fa-obj-val',{value:10,min:0.5,max:100,step:0.5})}
          <div class="asesor as-marco" id="fa-prev">
            <div class="as-top"><b>Resumen del acumulador</b></div>
            <div class="as-grid">
              <div><span>Compra inicial (a mercado)</span><b id="fa-p-ini">—</b></div>
              <div><span>Precio promedio estimado</span><b id="fa-p-prom">—</b></div>
            </div>
            <div class="as-nota"><span class="nota-larga">Compra más cuanto más baja el precio. Cuando el conjunto gana el % que elijas, <b>vende todo de golpe</b>.</span><span class="nota-corta">Compra en las caídas y <b>vende todo junto</b> al llegar a tu objetivo.</span></div>
          </div>
        </div>
        <div id="f-cash" style="${F.tipo==='cash'?'':'display:none'}">
          <button type="button" class="btn-conf" data-conf-bot="cash"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg><span class="v-l">Configuraciones rentables</span><span class="v-s">Configuración</span><span class="bc-sel" id="conf-sel-cash">elegir</span></button>
          <div class="cash-note">Vendes <b id="cn-b">${moneda(F.baseId).simbolo}</b> y recibes <b id="cn-q">${moneda(F.quoteId).simbolo}</b> en tu wallet.</div>
          <div class="cash-cant-head">
            <div class="lab" style="margin:0"><span class="v-l">Cantidad a vender</span><span class="v-s">Cantidad</span> ${iBtn('cashcant')}</div>
            <div class="cash-bal"><span id="fc-saldo">—</span><button type="button" class="cash-max" id="fc-max">Máx</button></div>
          </div>
          ${campoNum('fc-cant',{placeholder:'0.00',step:0.01,min:0,suffix:'fc-cant-usd'})}
          <input type="range" id="fc-slider" class="cash-slider" min="0" max="100" value="0" step="1">
          <div class="seg presets" id="fc-pctamt" style="grid-template-columns:repeat(6,1fr);margin-top:2px">
            <button type="button" data-pa="5">5%</button><button type="button" data-pa="10">10%</button><button type="button" data-pa="25">25%</button><button type="button" data-pa="50">50%</button><button type="button" data-pa="75">75%</button><button type="button" data-pa="100">100%</button>
          </div>
          <div class="lab" style="margin-top:16px">Vender cuando ${iBtn('cashobj')}</div>
          <div class="seg presets" id="fc-modo" style="grid-template-columns:1fr 1fr">
            <button type="button" data-cm="pct" class="on">Suba un %</button>
            <button type="button" data-cm="precio">Llegue a un precio</button>
          </div>
          <div id="fc-pct-wrap">
            <div class="seg presets" id="fc-pctpreset" style="grid-template-columns:repeat(4,1fr);margin-top:8px">
              <button type="button" data-p="5">+5%</button><button type="button" data-p="10" class="on">+10%</button><button type="button" data-p="20">+20%</button><button type="button" data-p="50">+50%</button>
            </div>
            ${campoNum('fc-pct',{value:10,min:0.5,max:2000,step:1})}
          </div>
          <div id="fc-precio-wrap" style="display:none;margin-top:8px">${campoNum('fc-precio',{placeholder:'precio objetivo',pct:0.05})}</div>
          <div class="cash-resumen" id="fc-prev">
            <div class="cr-top">Resumen del Cash Out</div>
            <div class="cr-rows">
              <div class="cr-row"><span>Vendes</span><b id="fc-p-cant">—</b></div>
              <div class="cr-row"><span>Valor ahora</span><b id="fc-p-valor">—</b></div>
              <div class="cr-row"><span>Recibirás al objetivo</span><b id="fc-p-recibe">—</b></div>
              <div class="cr-row"><span>Comisión de la venta</span><b id="fc-p-com">—</b></div>
              <div class="cr-row cr-gan"><span>Ganancia estimada</span><b id="fc-p-gan" class="pos">—</b></div>
            </div>
            <div class="cr-note">
              <span class="nota-larga">Vende solo cuando el precio llegue a tu objetivo y recibe <b id="fc-p-est">${moneda(F.quoteId).simbolo}</b> en tu wallet.<br><span style="opacity:.75">Ten esa moneda agregada en tu wallet para verla: llega igual.</span></span>
              <span class="nota-corta">Vende al llegar a tu objetivo y recibes <b>${moneda(F.quoteId).simbolo}</b> en tu wallet.</span>
            </div>
          </div>
        </div>
        <div id="f-dca" style="${F.tipo==='dca'?'':'display:none'}">
          <button type="button" class="btn-conf" data-conf-bot="dca"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg><span class="v-l">Configuraciones rentables</span><span class="v-s">Configuración</span><span class="bc-sel" id="conf-sel-dca">elegir</span></button>
          <div class="cash-note">Compras <b id="dn-b">${moneda(F.baseId).simbolo}</b> con tu <b id="dn-q">${moneda(F.quoteId).simbolo}</b>, un poco cada cierto tiempo.</div>
          <div class="cash-cant-head">
            <div class="lab" style="margin:0"><span class="v-l">Monto por compra</span><span class="v-s">Monto</span> ${iBtn('dcamonto')}</div>
            <div class="cash-bal"><span id="fd-saldo">—</span></div>
          </div>
          ${campoNum('fd-monto',{placeholder:'0.00',step:1,min:0,suffix:'fd-monto-eq'})}
          <div class="lab" style="margin-top:16px"><span class="v-l">¿Cada cuánto compra?</span><span class="v-s">Cada cuánto</span> ${iBtn('dcafrec')}</div>
          <div class="seg presets" id="fd-frec" style="grid-template-columns:repeat(4,1fr)">
            <button type="button" data-int="86400">Diario</button>
            <button type="button" data-int="604800" class="on">Semanal</button>
            <button type="button" data-int="1209600">Quincenal</button>
            <button type="button" data-int="2592000">Mensual</button>
          </div>
          <div class="lab" style="margin-top:16px"><span class="v-l">¿Cuántas compras?</span><span class="v-s">Nº compras</span> ${iBtn('dcanum')}</div>
          <div class="seg presets" id="fd-num" style="grid-template-columns:repeat(4,1fr)">
            <button type="button" data-n="10">10</button>
            <button type="button" data-n="25">25</button>
            <button type="button" data-n="52">52</button>
            <button type="button" data-n="0" class="on">Infinito</button>
          </div>
          <div class="cash-resumen" id="fd-prev">
            <div class="cr-top">Resumen del DCA</div>
            <div class="cr-rows">
              <div class="cr-row"><span>Compras</span><b id="fd-p-cada">—</b></div>
              <div class="cr-row"><span>Primera compra</span><b id="fd-p-primera">al encender</b></div>
              <div class="cr-row"><span>Total a invertir</span><b id="fd-p-total">—</b></div>
              <div class="cr-row"><span>Precio ahora</span><b id="fd-p-precio">—</b></div>
            </div>
            <div class="cr-note">
              <span class="nota-larga">La primera compra se hace al encender. Ten <b>${moneda(F.quoteId).simbolo}</b> cargado en tu wallet para las siguientes.</span>
              <span class="nota-corta">La primera compra es al encender. Ten <b>${moneda(F.quoteId).simbolo}</b> cargado para las siguientes.</span>
            </div>
          </div>
        </div>
        <div style="text-align:right"><button class="btn-avz" id="f-toggleavz">${F.avanzado ? '− Opciones avanzadas' : '+ Opciones avanzadas'}</button></div>
        <div class="avz" id="f-avz" style="${F.avanzado ? '' : 'display:none'}">
          <div class="fila">
            <div><div class="lab"><span class="v-l">Protección precio %</span><span class="v-s">Protección %</span> ${iBtn('proteccion')}</div>${campoNum('f-slip',{value:1,step:0.5,min:0,max:10})}</div>
            <div><div class="lab"><span class="v-l">Ritmo mín (s)</span><span class="v-s">Ritmo (s)</span> ${iBtn('ritmo')}</div>${campoNum('f-cd',{value:0,step:5,min:0,int:true})}</div>
          </div>
          <div class="lab"><span class="v-l">Con "Ganancia por cuadrícula"</span><span class="v-s">Ganancia %</span> ${iBtn('margenmodo')}</div>
          <div class="seg presets" id="f-margenmodo" style="grid-template-columns:1fr 1fr;margin-bottom:10px">
            <button type="button" data-mm="cuadriculas" class="${F.margenModo!=='rango'?'on':''}">Ajustar cuadrículas</button>
            <button type="button" data-mm="rango" class="${F.margenModo==='rango'?'on':''}">Ampliar rango</button>
          </div>
          <div class="fila" id="f-avz-tpsl">
            <div><div class="lab"><span class="v-l">Cerrar con ganancia</span><span class="v-s">Cerrar al %</span> ${iBtn('tp')}</div>${campoNum('f-tp',{placeholder:'off',pct:0.01,min:0})}</div>
            <div><div class="lab"><span class="v-l">Protegerme de caídas</span><span class="v-s">Protección</span> ${iBtn('sl')}</div>${campoNum('f-sl',{placeholder:'off',pct:0.01,min:0})}</div>
          </div>
        </div>
        <button class="btn btn-verde mt" id="f-crear">Encender el bot</button>
        <div id="c-msg"></div>
      </div>
      <div>
        <div class="card">
          <div id="c-chart">${graficaPreview()}</div>
          <div id="c-acum-side" style="display:none">
            <div class="bot-panel-wrap">
              <img class="bot-panel" src="assets/img/panel-acum.webp" alt="Accumulator" loading="lazy">
              <span class="rec-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.6 1.4 6.8L12 17.1 5.9 20.5l1.4-6.8L2.2 9.1l6.9-.8L12 2z"/></svg>Recomendado</span>
            </div>
          </div>
          <div id="c-cash-side" style="display:none">
            <img class="bot-panel" src="assets/img/panel-cash.webp" alt="Cash Out" loading="lazy">
          </div>
          <div id="c-dca-side" style="display:none">
            <img class="bot-panel" src="assets/img/panel-dca.webp" alt="DCA Compra Automática" loading="lazy">
          </div>
          <div id="c-hint"></div>
          <div class="prev vacio">
            <div class="p"><b>Precio</b><span id="pv-precio">—</span></div>
            <div class="p prep"><span id="pv-compras" class="rep-wrap">—</span></div>
            <div class="p"><b>Por compra</b><span id="pv-orden">—</span></div>
            <div class="p"><b>Ganancia ${iBtn('porcuad')}</b><span id="pv-gan" class="pos">—</span></div>
          </div>
          <div class="asesor" id="c-asesor" style="display:none">
            <div class="as-top"><b>Estimación</b> ${iBtn('asesor')}</div>
            <div class="as-grid">
              <div><span>Operaciones/día (est.)</span><b id="as-ops">—</b></div>
            </div>
            <div class="as-nota" id="as-nota"></div>
          </div>
          <div class="gasbox">
            <div class="gas-row">
              <div class="stepper gas-stepper">
                <input id="f-gas" type="${tipoNum()}" inputmode="decimal" placeholder="0.01 BNB" min="0" step="0.005" data-min="0" data-step="0.005">
                <span class="gas-hint">Gas del bot <button class="i-btn gas-ibtn" data-info="gas" type="button">i</button></span>
                <span class="stepper-btns"><button type="button" class="st-up" tabindex="-1">▲</button><button type="button" class="st-dn" tabindex="-1">▼</button></span>
              </div>
              <button class="btn btn-oro" id="f-gasdep">Recargar</button>
            </div>
            <div class="gas-sep"><button class="btn btn-linea btn-max" id="f-gasret"><span class="gas-rtx">Retirar <span id="c-gas"><span class="skel">0.00000</span> BNB</span></span></button></div>
          </div>
          <div id="c-gasmsg"></div>
          <div id="c-cash-price" class="cash-price" style="display:none;margin-top:16px;margin-bottom:0">
            <div class="cp-lab" id="cash-price-pair">BNB / USDT</div>
            <div class="cp-val" id="cash-price-val">—</div>
            <div class="cp-src">precio del mercado</div>
          </div>
        </div>
      </div>
    </div>
    <div class="colmenas card"><div class="mb-cab"><h3>Mis bots</h3><div class="mb-der"><span class="c-cupo" id="c-cupo"><b>—</b><span class="cupo-tx">bots activos</span></span><button class="c-cupo" id="c-ver-ord" type="button" title="Ver tus órdenes limit pendientes"><span class="cupo-tx">Mis órdenes</span><b id="c-ord-n" style="display:none">0</b></button><button class="btn-cerrar-todos" id="c-cerrar-todos" type="button" title="Cerrar todos tus bots"><span class="cerrar-largo">Cerrar todos</span><span class="cerrar-corto">Cerrar</span></button></div></div><div id="c-rejillas"><div class="skel" style="height:120px;width:100%;border-radius:14px"></div></div></div>
    ${footerHTML()}
  </div>`;

  wireHeader(); wireFaq();
  if ($('f-base-btn')) $('f-base-btn').onclick = () => abrirCoinModal('base');
  if ($('f-quote-btn')) $('f-quote-btn').onclick = () => abrirCoinModal('quote');
  actualizarBotonesCoin();
  cargarLogosPrecios();
  $('f-toggleavz').onclick = () => {
    F.avanzado = !F.avanzado; const a = $('f-avz'); if (a) a.style.display = F.avanzado ? '' : 'none';
    $('f-toggleavz').textContent = F.avanzado ? '− Opciones avanzadas' : '+ Opciones avanzadas';
  };
  { const e = $('f-total'); if (e) e.oninput = () => { asegurarRentable(); actualizarVista(); }; }
  { const e = $('f-niv'); if (e) e.oninput = () => { asegurarRentable(); actualizarVista(); }; }
  document.querySelectorAll(`#${APP} #f-margenmodo button`).forEach((b) => b.onclick = () => {
    F.margenModo = b.dataset.mm;
    document.querySelectorAll(`#${APP} #f-margenmodo button`).forEach((x) => x.classList.remove('on')); b.classList.add('on');
    recomputarPorMargen(); actualizarVista();
  });
  ['f-min','f-max','f-margen'].forEach((id) => { const e = $(id); if (e) e.oninput = () => { asegurarRentable(); actualizarVista(); }; });
  if ($('f-sug')) $('f-sug').onclick = sugerirRango;   // ya no está en el formulario, vive en la ventana de configuraciones
  if ($('f-abrir-conf')) $('f-abrir-conf').onclick = ventanaConfiguraciones;
  document.querySelectorAll(`#${APP} [data-conf-bot]`).forEach((b) => b.onclick = () => ventanaConfBot(b.dataset.confBot));
  document.querySelectorAll(`#${APP} #f-tipo button`).forEach((b) => b.onclick = () => { F.tipo = b.dataset.tipo; pintarTipo(); });
  document.querySelectorAll(`#${APP} #fa-obj button`).forEach((b) => b.onclick = () => {
    document.querySelectorAll(`#${APP} #fa-obj button`).forEach((x) => x.classList.remove('on')); b.classList.add('on');
    const v = $('fa-obj-val'); if (v) { v.value = b.dataset.obj; previewAcum(); }
  });
  ['fa-min','fa-niv','fa-total','fa-ini','fa-factor','fa-obj-val'].forEach((id) => { const e = $(id); if (e) e.oninput = previewAcum; });
  if ($('fa-sug')) $('fa-sug').onclick = sugerirAcum;
  // Cash Out
  if (!F.cashModo) F.cashModo = 'pct';
  document.querySelectorAll(`#${APP} #fc-modo button`).forEach((b) => b.onclick = () => {
    document.querySelectorAll(`#${APP} #fc-modo button`).forEach((x) => x.classList.remove('on')); b.classList.add('on');
    F.cashModo = b.dataset.cm;
    const pw = $('fc-pct-wrap'), rw = $('fc-precio-wrap');
    if (pw) pw.style.display = F.cashModo === 'pct' ? '' : 'none';
    if (rw) rw.style.display = F.cashModo === 'precio' ? '' : 'none';
    if (F.cashModo === 'precio' && $('fc-precio') && !$('fc-precio').value && F.precio) $('fc-precio').value = Number((F.precio * 1.1).toPrecision(6));
    previewCash();
  });
  document.querySelectorAll(`#${APP} #fc-pctpreset button`).forEach((b) => b.onclick = () => {
    document.querySelectorAll(`#${APP} #fc-pctpreset button`).forEach((x) => x.classList.remove('on')); b.classList.add('on');
    const v = $('fc-pct'); if (v) { v.value = b.dataset.p; previewCash(); }
  });
  ['fc-cant', 'fc-pct', 'fc-precio'].forEach((id) => { const e = $(id); if (e) e.oninput = previewCash; });
  if ($('fc-slider')) $('fc-slider').oninput = () => { const pct = parseFloat($('fc-slider').value) || 0; setCantCash(maxCash() * pct / 100); };
  if ($('fc-max')) $('fc-max').onclick = () => setCantCash(maxCash());
  document.querySelectorAll(`#${APP} #fc-pctamt button`).forEach((b) => b.onclick = () => setCantCash(maxCash() * (parseFloat(b.dataset.pa) || 0) / 100));
  if ($('fd-monto')) $('fd-monto').addEventListener('input', previewDCA);
  document.querySelectorAll(`#${APP} #fd-frec button`).forEach((b) => b.onclick = () => { F.dcaFrec = parseInt(b.dataset.int, 10); document.querySelectorAll(`#${APP} #fd-frec button`).forEach((x) => x.classList.toggle('on', x === b)); previewDCA(); });
  document.querySelectorAll(`#${APP} #fd-num button`).forEach((b) => b.onclick = () => { F.dcaNum = parseInt(b.dataset.n, 10); document.querySelectorAll(`#${APP} #fd-num button`).forEach((x) => x.classList.toggle('on', x === b)); previewDCA(); });
  refrescarSaldoCash();
  pintarTipo();
  $('f-crear').onclick = onCrear;
  $('f-gasdep').onclick = onDepositarGas;
  $('f-gasret').onclick = onRetirarGas;
  wirePops(host);
  wireSteppers(host);

  cargarPrecio(); refrescarGas(); refrescarSaldoInversion(); refrescarRejillas();
  // Los datos se refrescan solos: el keeper opera en segundo plano y antes
  // había que recargar la página para ver el gas y los bots actualizados.
  if (window._refrescoAuto) clearInterval(window._refrescoAuto);
  window._refrescoAuto = setInterval(() => {
    if (document.hidden) return;                        // no gastamos si no miras
    if (!wallet.cuentaActual()) return;
    // Solo el gas, que es un número suelto. NUNCA redibujamos la lista de bots:
    // eso cerraba la gráfica abierta y provocaba el parpadeo de la página.
    refrescarGas();
  }, 45000);
}

/* ================================================================== */
/* Precio + vista viva                                                 */
/* ================================================================== */
async function cargarPrecio() {
  const base = moneda(F.baseId), quote = moneda(F.quoteId);
  try { const r = await gb.precioPar(gb.dirDe(base), gb.dirDe(quote), base.decimals, quote.decimals); F.precio = r.precio; F.rutas = r.rutas; }
  catch { F.precio = null; }
  pintarPrecioAhora();                    // la tarjeta del precio, en los cuatro bots
  if (F.tipo === 'cash') previewCash();
  if (F.tipo === 'dca') previewDCA();
  if (F.tipo === 'acum' && typeof previewAcum === 'function') previewAcum();
  actualizarVista();
}
function actualizarVista() {
  pintarPrecioAhora();
  if ($('c-chart')) $('c-chart').innerHTML = graficaPreview();
  if ($('pv-precio')) $('pv-precio').textContent = precioFmt(F.precio);
  const pMin = parseFloat($('f-min')?.value), pMax = parseFloat($('f-max')?.value);
  const n = parseInt($('f-niv')?.value, 10), total = parseFloat($('f-total')?.value);
  const valido = F.precio && pMin > 0 && pMax > pMin && n >= 2;
  const _prev = document.querySelector(`#${APP} .prev`); if (_prev) _prev.classList.toggle('vacio', !valido);
  const pasoPct = valido ? (Math.pow(pMax / pMin, 1 / (n - 1)) - 1) : null;
  if ($('pv-paso')) $('pv-paso').textContent = pasoPct != null ? num(pasoPct * 100, 2) + '%' : '—';

  const hint = $('c-hint');
  let aviso1 = '';
  if (NOTA_GAS) aviso1 += `<div class="hint">${NOTA_GAS}</div>`;
  if (F.precio && pMin > 0 && pMax > pMin && (F.precio < pMin || F.precio > pMax))
    aviso1 = `<div class="hint">El precio (${precioFmt(F.precio)}) está fuera de tu rango. El bot esperará. Ajusta el rango si quieres que opere ya.</div>`;
  if (hint) hint.innerHTML = aviso1;

  if (valido) {
    const ps = nivelesPreview(pMin, pMax, n, 'geo');
    const nSell = ps.filter((p) => p >= F.precio).length, nBuy = n - nSell;
    if ($('pv-compras')) $('pv-compras').innerHTML = `<span class="rep-pill rep-v">${nSell} venden</span><span class="rep-pill rep-c">${nBuy} compran</span>`;
    const ordenQuote = total > 0 ? total / n : 0;
    if ($('pv-orden')) $('pv-orden').textContent = ordenQuote ? num(ordenQuote, 2) : '—';
    const net = ordenQuote * (pasoPct - FEE_CICLO) - 2 * GAS_OP_USD;   // tras comisiones Y gas
    const gEl = $('pv-gan');
    if (gEl) { gEl.textContent = ordenQuote ? (net >= 0 ? '+' + num(net, 3) : '−' + num(Math.abs(net), 3)) : '—'; gEl.className = net >= 0 ? 'pos' : 'neg'; }
    asesorar(total, n, pasoPct, ordenQuote, net);
  } else {
    ['pv-compras','pv-orden','pv-gan'].forEach((id) => { if ($(id)) $(id).textContent = '—'; });
    const a = $('c-asesor'); if (a) a.style.display = 'none';
  }
}
/** Estimación honesta: operaciones/día y rendimiento/mes según volatilidad típica. */
function asesorar(total, n, pasoPct, ordenQuote, netPorVuelta) {
  const box = $('c-asesor'); if (!box) return;
  if (!(total > 0 && pasoPct > 0)) { box.style.display = 'none'; return; }
  const vol = VOL_DIARIA[F.baseId] || 0.03;
  const gasCiclo = 2 * GAS_OP_USD;                       // dos operaciones por vuelta (estable ≈ USD)
  const netCiclo = ordenQuote * (pasoPct - FEE_CICLO) - gasCiclo;
  const vueltasDia = vol / (2 * pasoPct);                // cruces de ida y vuelta por día (aprox)
  const netDia = vueltasDia * netCiclo;
  const pctMes = total > 0 ? (netDia * 30 / total) * 100 : 0;
  box.style.display = '';
  $('as-ops').textContent = (vueltasDia * 2).toFixed(vueltasDia * 2 < 1 ? 1 : 0);
  let nota = '';
  if (netCiclo <= 0) nota = 'Con esta configuración cada vuelta apenas cubre el gas. Prueba la estrategia "Tranquilo" o sube el capital: cada cuadrícula rinde cuando mueve varios dólares.';
  else if (vueltasDia < 0.3) nota = 'Rinde, pero opera poco (mercado tranquilo para este rango). Para más movimiento, prueba "Activo".';
  else nota = 'Configuración equilibrada para este capital. La estimación depende de cuánto se mueva el mercado.';
  $('as-nota').textContent = nota;
}
/* Configuraciones para los otros tres bots, con su porqué económico. */

/** Ventana de configuraciones para acumulador, cash out y DCA. */
function ventanaConfBot(tipo) {
  const CB = CONF_BOTS[tipo]; if (!CB) return;
  const prev = $('conf-box'); if (prev) prev.remove();
  const d = document.createElement('div');
  d.id = 'conf-box';
  d.className = 'tema-' + tipo;
  d.innerHTML = `<div class="cf-bg"></div>
    <div class="cf-c">
      <button class="cf-x" aria-label="Cerrar">✕</button>
      <div class="cf-t">${CB.titulo}</div>
      <div class="cf-s">Elige una y seguimos. Después puedes ajustar lo que quieras.</div>
      <div class="cf-lista">
        ${CB.ops.map((o) => `<button class="cf-op" data-cb="${o.id}">
          <div class="cf-cab"><b>${o.n}</b></div>
          <div class="cf-d">${o.d}</div>
          <div class="cf-gana">${o.r}</div>
        </button>`).join('')}
      </div>
      <details class="cf-saber"><summary>¿Por qué este bot da ganancia?</summary><div class="cf-txt">${CB.porque}</div></details>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => { const e = $('conf-box'); if (e) e.remove(); };
  d.querySelector('.cf-bg').onclick = cerrar;
  d.querySelector('.cf-x').onclick = cerrar;
  d.querySelectorAll('[data-cb]').forEach((b) => b.onclick = () => {
    const op = CB.ops.find((x) => x.id === b.dataset.cb);
    if (op) aplicarConfBot(tipo, op);
    cerrar();
  });
}

/** Vuelca la configuración elegida en los campos del formulario. */
function aplicarConfBot(tipo, op) {
  const set = (id, v) => { const e = $(id); if (e) { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); } };
  if (tipo === 'acum') {
    set('fa-obj-val', op.c.obj); set('fa-niv', op.c.niv);
    set('fa-ini', op.c.ini); set('fa-factor', op.c.factor);
    if (F.precio > 0) set('fa-min', +(F.precio * (1 - op.c.caida / 100)).toPrecision(6));
    document.querySelectorAll(`#${APP} #fa-obj button`).forEach((b) => b.classList.toggle('on', Number(b.dataset.obj) === op.c.obj));
    if (typeof previewAcum === 'function') previewAcum();
  } else if (tipo === 'cash') {
    const b = document.querySelector(`#${APP} [data-cobj="${op.c.obj}"]`);
    if (b) b.click(); else set('fc-obj-val', op.c.obj);
    if (typeof previewCash === 'function') previewCash();
  } else if (tipo === 'dca') {
    set('fd-frec', op.c.frec); set('fd-num', op.c.num);
    const sel = $('fd-frec'); if (sel && sel.tagName === 'SELECT') { sel.value = String(op.c.frec); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    if (typeof previewDCA === 'function') previewDCA();
  }
  const sel = $('conf-sel-' + tipo); if (sel) sel.textContent = op.n;
}

/** Ventana con las configuraciones auditadas y lo que rinde cada una. */
function ventanaConfiguraciones() {
  const prev = $('conf-box'); if (prev) prev.remove();
  const inv = Math.max(0, Number(String($('f-total')?.value || '').replace(',', '.')) || 0);
  const usada = inv > 0 ? inv : 200;

  const cuenta = (p) => {
    const orden = usada / p.grids;
    const bruto = orden * (p.sep / 100);
    const neto = bruto - (GAS_VUELTA_USD + orden * COM_DEX);
    return { orden, neto, ok: neto > 0 };
  };

  const tarjeta = (id) => {
    const p = PRESETS[id], c = cuenta(p);
    return `<button class="cf-op ${F.preset === id ? 'on' : ''}" data-conf="${id}">
      <div class="cf-cab"><b>${NOMBRE_PRESET[id]}</b><span class="cf-ops">${p.ops} operaciones</span></div>
      <div class="cf-d">${p.desc}</div>
      <div class="cf-nums">
        <span><i>rango</i>±${(p.rango * 100).toFixed(0)}%</span>
        <span><i>cuadrículas</i>${p.grids}</span>
        <span><i>separación</i>${p.sep.toFixed(2)}%</span>
      </div>
      <div class="cf-gana ${c.ok ? '' : 'mal'}">
        ${c.ok ? `Cada vuelta te deja ≈ <b>${c.neto.toFixed(3)} USDT</b> ya libres de comisiones` : `Con ${usada.toFixed(0)} USDT las comisiones se comen la ganancia. Sube la inversión.`}
      </div>
    </button>`;
  };

  const d = document.createElement('div');
  d.id = 'conf-box';
  d.innerHTML = `<div class="cf-bg"></div>
    <div class="cf-c">
      <button class="cf-x" aria-label="Cerrar">✕</button>
      <div class="cf-t">Configuraciones rentables</div>
      <div class="cf-s">Calculado con <b>${usada.toFixed(0)} USDT</b>${inv > 0 ? '' : ' (pon tu inversión para afinar)'}. Elige una y seguimos.</div>
      <div class="cf-lista">${['tranquilo', 'equilibrado', 'activo', 'volatil'].map(tarjeta).join('')}</div>
      <button class="cf-sug" id="cf-sug">Sugerir según el precio de ahora</button>
      <div class="cf-sim">
        <div class="cf-sim-t">Prueba con tu cantidad</div>
        <div class="cf-sim-in">
          <input type="${tipoNum()}" id="cf-monto" value="${usada.toFixed(0)}" min="20" max="100000" step="10" inputmode="decimal">
          <span>USDT</span>
        </div>
        <div class="cf-sim-out" id="cf-sim-out"></div>
        <div class="cf-sim-n">Son cuentas con las comisiones reales ya restadas. <b>Cuántas vueltas dé al día lo decide el mercado</b>, no el bot: hay días de varias y días de ninguna.</div>
      </div>

      <details class="cf-saber">
        <summary>¿Por qué este bot da ganancia?</summary>
        <div class="cf-txt">
          <p><b>Qué es una cuadrícula.</b> Imagina una escalera de precios. Pones el escalón más bajo (por ejemplo 500) y el más alto (700), y el bot reparte escalones entre medias. Cada escalón es una <b>cuadrícula</b>.</p>
          <p><b>Qué hace el bot.</b> Muy sencillo: <b>cuando el precio baja a un escalón, compra. Cuando sube al siguiente, vende.</b> Y vuelta a empezar. Nada más. Compra barato, vende un poquito más caro, una y otra vez.</p>
          <p><b>De dónde sale la ganancia.</b> De la diferencia entre un escalón y el siguiente. Si compra a 600 y vende a 615, esos 15 son tuyos (menos comisiones). El precio de una moneda sube y baja muchas veces al día, así que puede repetirlo varias veces en la misma jornada. <b>No necesita que el precio suba en general</b>: le basta con que se mueva arriba y abajo.</p>
          <p><b>La clave: la separación entre escalones.</b> Cada compra-venta paga el gas de la red (unos 0,025 USDT) y la comisión del exchange. Si los escalones están demasiado juntos, esa ganancia no cubre las comisiones. Cuando eso pasa, <b>el bot no vende</b>: está programado para no vender con pérdida. Por eso las configuraciones de arriba ya vienen con la separación calculada.</p>
          <p><b>Qué puede salir mal, sin adornos:</b><br>
          · <b>Si el precio se sale del rango por abajo</b>, el bot habrá comprado en todos los escalones y se queda quieto con la moneda, que vale menos de lo que pagaste. Tu dinero sigue ahí, en forma de moneda, pero en pérdida hasta que vuelva.<br>
          · <b>Si se sale por arriba</b>, habrá vendido todo y dejará de operar. Ganaste, pero te quedas fuera de la subida.<br>
          · <b>Si el mercado se queda plano</b> y no toca ningún escalón, el bot no hace nada y no gana nada.<br>
          · <b>Nada garantiza ganancias.</b> Esta estrategia funciona bien cuando el precio se mueve dentro de un rango, y funciona mal cuando se va en una sola dirección y no vuelve.</p>
          <p><b>Tres consejos concretos:</b><br>
          · <b>Cuanto más dinero por cuadrícula, mejor.</b> El gas cuesta lo mismo tanto si mueves 2 USDT como 20, así que con órdenes pequeñas se lo come todo.<br>
          · <b>El precio de ahora debe quedar dentro del rango</b>, y a poder ser por el medio. Si no, el bot no tiene dónde operar.<br>
          · <b>Rango amplio para dormir tranquilo</b>, rango estrecho para operar más. Lo primero es más seguro; lo segundo, más activo pero se sale antes.</p>
        </div>
      </details>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => { const e = $('conf-box'); if (e) e.remove(); };
  d.querySelector('.cf-bg').onclick = cerrar;
  d.querySelector('.cf-x').onclick = cerrar;
  d.querySelectorAll('[data-conf]').forEach((b) => b.onclick = () => { aplicarPreset(b.dataset.conf); cerrar(); });
  const sug = $('cf-sug');
  if (sug) sug.onclick = () => { cerrar(); sugerirRango(); };

  /* Simulador: la pregunta que más se hace es "¿cuánto ganaría con X?".
     Mejor que se lo enseñemos con SU cantidad antes de decidir, en vez de
     que lo descubra después. Sin prometer nada: se dice claramente que la
     frecuencia la pone el mercado. */
  const pintarSim = () => {
    const out = $('cf-sim-out'); if (!out) return;
    const m = Math.max(0, Number($('cf-monto')?.value) || 0);
    if (m < 20) { out.innerHTML = `<div class="cf-sim-mal">Escribe al menos 20 USDT.</div>`; return; }
    const filas = ['tranquilo', 'equilibrado', 'activo', 'volatil'].map((id) => {
      const p = PRESETS[id];
      const orden = m / p.grids;
      const bruto = orden * (p.sep / 100);
      const neto = bruto - (GAS_VUELTA_USD + orden * COM_DEX);
      const ok = neto > 0;
      return `<div class="cf-sim-f ${ok ? '' : 'mal'}">
        <span class="s1">${NOMBRE_PRESET[id]}</span>
        <span class="s2">${orden.toFixed(2)} <i>por cuadrícula</i></span>
        <span class="s3">${ok ? '+' + neto.toFixed(3) : 'no cubre'} <i>${ok ? 'cada vuelta' : 'comisiones'}</i></span>
      </div>`;
    }).join('');
    const p = PRESETS[F.preset || 'equilibrado'];
    const orden = m / p.grids;
    const neto = orden * (p.sep / 100) - (GAS_VUELTA_USD + orden * COM_DEX);
    const dia = neto > 0 ? neto * 3 : 0;
    out.innerHTML = filas + (neto > 0
      ? `<div class="cf-sim-res">Con <b>${NOMBRE_PRESET[F.preset || 'equilibrado']}</b>, si el mercado da <b>3 vueltas en un día</b> serían unos <b>${dia.toFixed(2)} USDT</b>. Si está plano, cero.</div>`
      : `<div class="cf-sim-res mal">Con esa cantidad las comisiones se comen la ganancia. Sube el importe o elige una configuración con menos cuadrículas.</div>`);
  };
  const inp = $('cf-monto');
  if (inp) { inp.oninput = pintarSim; pintarSim(); }
}

function aplicarPreset(id) {
  if (!F.precio) { aviso($('c-msg'), 'err', 'Espera a que cargue el precio y vuelve a intentar.'); return; }
  const p = PRESETS[id]; if (!p) return;
  F.preset = id;
  const sel = $('f-conf-sel'); if (sel) sel.textContent = NOMBRE_PRESET[id] || 'elegir';
  $('f-min').value = Number((F.precio * (1 - p.rango)).toPrecision(6));
  $('f-max').value = Number((F.precio * (1 + p.rango)).toPrecision(6));
  $('f-niv').value = p.grids;
  asegurarRentable();
  actualizarVista();
}
let NOTA_GAS = '';
function maxGridsRentable(pMin, pMax, total) {
  for (let n = 2; n <= 100; n++) {
    const spacing = Math.pow(pMax / pMin, 1 / (n - 1)) - 1;
    const net = (total / n) * (spacing - FEE_CICLO) - 2 * GAS_OP_USD;
    if (net < 0) return Math.max(2, n - 1);
  }
  return 100;
}
// Garantiza que "Neto por vuelta" sea SIEMPRE positivo: capa las cuadrículas al máximo rentable.
function asegurarRentable() {
  NOTA_GAS = '';
  const margen = parseFloat($('f-margen')?.value) || 0;
  if (margen > 0) { recomputarPorMargen(); return; }   // el modo margen ya se capa solo
  const total = parseFloat($('f-total')?.value) || 0;
  const pMin = parseFloat($('f-min')?.value) || 0, pMax = parseFloat($('f-max')?.value) || 0;
  const niv = $('f-niv');
  if (!(total > 0 && pMin > 0 && pMax > pMin && niv)) return;
  const maxN = maxGridsRentable(pMin, pMax, total);
  const cur = parseInt(niv.value, 10) || 0;
  if (cur > maxN) { niv.value = maxN; NOTA_GAS = `Ajustado a ${maxN} cuadrículas: así cada vuelta te deja ganancia neta con tu capital.`; }
}
function rangoNecesario(n, margen) {
  const s = margen / 100 + FEE_CICLO;
  const ratio = Math.pow(1 + s, n - 1);
  const price = F.precio;
  return { pMin: price / Math.sqrt(ratio), pMax: price * Math.sqrt(ratio) };
}
async function ampliarRango(pMin, pMax, n, margen) {
  const ok = await modalConfirm({
    titulo: 'Ampliar el rango',
    cuerpo: `Para que tus <b>${n} cuadrículas</b> ganen <b>${num(margen, 1)}%</b> cada una (por encima de la comisión), el rango debe ampliarse a:<br><br><b>${precioFmt(pMin)} – ${precioFmt(pMax)}</b><br><br>Un rango más amplio hace el bot <b>menos sensible</b>: opera menos seguido, pero cada operación deja tu ganancia limpia, sin que la comisión se la coma. Así puedes operar con el capital que quieras.<br><br>¿Aplicar este rango?`,
    ok: 'Sí, ampliar'
  });
  if (!ok) return;
  modalClose();   // FIX: cerrar el modal al confirmar (antes se quedaba pegado)
  $('f-min').value = Number(pMin.toPrecision(6));
  $('f-max').value = Number(pMax.toPrecision(6));
  recomputarPorMargen(); actualizarVista();
}
function recomputarPorMargen() {
  const margen = parseFloat($('f-margen')?.value) || 0;
  const niv = $('f-niv'); const nota = $('f-margen-nota');
  if (nota) nota.innerHTML = '';
  if (!(margen > 0)) {   // "auto": modo manual normal
    if (niv) { niv.readOnly = false; niv.style.opacity = ''; niv.title = ''; }
    return;
  }
  const total = parseFloat($('f-total')?.value) || 0;
  const simQ = moneda(F.quoteId).simbolo;
  // Máximo de cuadrículas que el capital soporta al % dado (cada una debe cubrir su gas).
  const maxViable = total > 0 ? Math.max(2, Math.floor(total * (margen / 100) / (2 * GAS_OP_USD))) : 100;
  const sepObj = margen + FEE_CICLO * 100;   // separación objetivo en %

  if (F.margenModo === 'rango') {
    // El usuario fija N; calculamos el rango y avisamos si el gas no da.
    if (niv) { niv.readOnly = false; niv.style.opacity = ''; niv.title = ''; }
    const n = parseInt($('f-niv')?.value, 10) || 0;
    if (!(n >= 2 && F.precio && nota)) return;
    if (total > 0 && n > maxViable) {
      nota.innerHTML = `<div class="hint" style="color:var(--rojo)">⚠ Con ${num(total, 0)} ${simQ} en ${n} cuadrículas, cada una es muy pequeña: el gas se comería la ganancia. Con este capital lo rentable es <b>máximo ~${maxViable} cuadrículas</b>. Sube el capital, sube el % o baja las cuadrículas.</div>`;
      return;
    }
    const { pMin, pMax } = rangoNecesario(n, margen);
    const aMin = parseFloat($('f-min')?.value) || 0, aMax = parseFloat($('f-max')?.value) || 0;
    const yaOk = aMin > 0 && aMax > 0 && Math.abs(aMin - pMin) / pMin < 0.02 && Math.abs(aMax - pMax) / pMax < 0.02;
    if (!yaOk) {
      nota.innerHTML = `<div class="hint">Para <b>${n} cuadrículas</b> al ${num(margen, 1)}% cada una (separación ≈ <b>${num(sepObj, 2)}%</b>), el rango debe ser <b>${precioFmt(pMin)} – ${precioFmt(pMax)}</b> (bot menos sensible). <button class="sug" id="f-ampliar" type="button">Aplicar rango</button></div>`;
      if ($('f-ampliar')) $('f-ampliar').onclick = () => ampliarRango(pMin, pMax, n, margen);
    } else {
      nota.innerHTML = `<div class="hint" style="color:var(--neon-lit)">✓ Rango ajustado: ${n} cuadrículas al ${num(margen, 1)}% cada una (separación ≈ ${num(sepObj, 2)}%).</div>`;
    }
    return;
  }
  // Modo por defecto: derivar cuadrículas del rango (campo bloqueado), con tope de gas.
  const pMin = parseFloat($('f-min')?.value) || 0, pMax = parseFloat($('f-max')?.value) || 0;
  if (!(pMin > 0 && pMax > pMin)) return;
  const spacing = margen / 100 + FEE_CICLO;
  let n = Math.round(Math.log(pMax / pMin) / Math.log(1 + spacing));
  n = Math.max(2, Math.min(100, n));
  if (total > 0 && n > maxViable) n = maxViable;   // tope de gas
  if (niv) { niv.value = n; niv.readOnly = true; niv.style.opacity = '0.6'; niv.title = 'Calculado por tu % de ganancia y tu capital'; }
  if (nota && total > 0 && n <= maxViable && maxViable <= 3) {
    nota.innerHTML = `<div class="hint">Con ${num(total, 0)} ${simQ} y ${num(margen, 1)}% por cuadrícula, tu capital solo da para pocas cuadrículas rentables (el gas manda). Sube el capital o el % para tener más.</div>`;
  }
}
function sugerirRango() {
  aplicarPreset('equilibrado');
}

/* ================================================================== */
/* Permisos (limitados, dentro de "Encender")                          */
/* ================================================================== */
// Convierte un número humano a unidades del token (recorta decimales para parseUnits).
function mBI(human, dec) { return gb.parse(Number(human).toFixed(Math.min(dec, 8)), dec); }

/* ================================================================== */
/* Gas                                                                 */
/* ================================================================== */
async function refrescarGas() {
  const cuenta = wallet.cuentaActual(); const el = $('c-gas'); if (!cuenta || !el) return;
  try { const s = await gb.gasSaldo(cuenta); el.textContent = `${Number(gb.fmtBNB(s)).toFixed(5)} BNB`; } catch { el.textContent = '—'; }
}
async function refrescarSaldoInversion() {
  const cuenta = wallet.cuentaActual(); const el = $('f-total-saldo'), inp = $('f-total'); if (!el || !cuenta) return;
  el.textContent = '…';
  try {
    const quote = moneda(F.quoteId);
    const bal = await gb.balanceToken(gb.dirDe(quote), cuenta);
    const balH = Number(gb.fmt(bal, quote.decimals)); F.saldoQuote = balH;
    el.innerHTML = `${num(balH, 2)} · <b>Máx</b>`;
    if (inp) inp.dataset.max = balH;                 // el stepper y el clamp respetan este tope
    if (inp && parseFloat(inp.value) > balH) { inp.value = Number(balH.toPrecision(8)); inp.dispatchEvent(new Event('input', { bubbles: true })); }
    el.onclick = () => { if (F.saldoQuote > 0 && inp) { inp.value = Number(F.saldoQuote.toPrecision(8)); inp.dispatchEvent(new Event('input', { bubbles: true })); } };
  } catch { el.textContent = ''; F.saldoQuote = null; }
}
async function refrescarSaldoCash() {
  const el = $('fc-saldo'); const cuenta = wallet.cuentaActual(); if (!el || !cuenta) return;
  el.textContent = '…';
  try {
    const base = moneda(F.baseId);
    const bal = await gb.saldoCashDisponible(gb.dirDe(base), cuenta);
    const balH = Number(gb.fmt(bal, base.decimals));
    F.saldoBase = balH;
    el.textContent = `Tienes ${num(balH, 4)} ${base.simbolo}`;
    const inp = $('fc-cant'); if (inp && !inp.value && balH > 0) setCantCash(maxCash());
    else previewCash();
  } catch { el.textContent = ''; }
}
async function onDepositarGas() {
  const v = parseFloat($('f-gas').value); const m = $('c-gasmsg');
  if (!(v > 0)) { aviso(m, 'err', 'Escribe cuánto BNB quieres poner.'); return; }
  aviso(m, 'info', 'Recargando… confirma en tu wallet.');
  try { await gb.depositarGas(v); aviso(m, 'info', 'Gas recargado.'); refrescarGas(); }
  catch (e) { aviso(m, 'err', 'No se pudo: ' + (e?.shortMessage || e?.message || e)); }
}
async function onRetirarGas() {
  const cuenta = wallet.cuentaActual(); const m = $('c-gasmsg');
  try {
    const s = await gb.gasSaldo(cuenta);
    if (s <= 0n) { aviso(m, 'err', 'No tienes gas para retirar.'); return; }
    aviso(m, 'info', 'Retirando… confirma en tu wallet.');
    await gb.retirarGas(gb.fmtBNB(s)); aviso(m, 'info', 'Gas retirado.'); refrescarGas();
  } catch (e) { aviso(m, 'err', 'No se pudo: ' + (e?.shortMessage || e?.message || e)); }
}

/* ================================================================== */
/* Crear                                                               */
/* ================================================================== */
async function asegurarSuscripcion(cuenta) {
  let act = false;
  try { act = await gb.estaActivo(cuenta); } catch (_) {}
  if (act) return true;
  const precio = await gb.precioSub();
  if (!(precio > 0n)) { modalError('La activación del bot aún no está configurada. Avísame para revisarlo.'); return false; }
  const precioBNB = Number(gb.fmtBNB(precio));
  const ok = await modalConfirm({
    titulo: 'Activar tu bot (30 días)',
    cuerpo: `Para encender tu bot hay que activarlo por 30 días. Es un pago único de <b>${num(precioBNB, 5)} BNB</b> (≈ $1) que firmas desde tu wallet. Con eso puedes tener <b>todos los bots que quieras</b> este mes.<br><br>¿Activar ahora?`,
    ok: 'Sí, activar'
  });
  if (!ok) return false;
  modalBusy('Activando tu bot (firma el pago en tu wallet)…');
  await gb.suscribir();
  return true;
}
/** Cierra todos los bots del usuario, uno a uno, con aviso claro antes. */
async function cerrarTodosLosBots(cuenta) {
  // Aviso inmediato: leer los bots tarda unos segundos y el botón parecía roto.
  const btn = $('c-cerrar-todos');
  const txtOrig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Buscando tus bots…'; btn.classList.add('cargando'); }
  const soltar = () => { if (btn) { btn.disabled = false; btn.textContent = txtOrig; btn.classList.remove('cargando'); } };

  let claves = [];
  try { claves = await gb.misRejillas(cuenta); } catch (_) {}
  const vivos = [];
  // Todos a la vez, no uno detrás de otro.
  const _res = await enLotes(claves, (k) =>
    gb.resumenK(k).then((R) => ({ k, R })).catch(() => null)
  );
  for (const x of _res) {
    try { if (x && x.R && x.R.activa) vivos.push(x); } catch (_) {}
  }
  soltar();
  if (vivos.length === 0) { modalError('No tienes bots activos que cerrar.'); return; }

  const d = document.createElement('div');
  d.id = 'ct-box';
  d.innerHTML = `<div class="ct-bg"></div>
    <div class="ct-c">
      <div class="ct-t">¿Cerrar tus ${vivos.length} bots?</div>
      <div class="ct-s">
        Se cancelan <b>todos</b> a la vez y <b>todo tu dinero vuelve a tu wallet</b>: lo que esté en monedas se vende al precio de ahora, y lo que esté sin usar se devuelve tal cual.<br><br>
        Si algún bot compró y el precio bajó, esa parte se venderá <b>en pérdida</b>. Esto no se puede deshacer.<br><br>
        Tendrás que firmar <b>una transacción por bot</b> (${vivos.length} en total).
      </div>
      <div class="ct-acts">
        <button class="ct-b gris" id="ct-no">Mejor no</button>
        <button class="ct-b rojo" id="ct-si">Sí, cerrar los ${vivos.length}</button>
      </div>
      <div class="ct-prog" id="ct-prog"></div>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => { const e = $('ct-box'); if (e) e.remove(); };
  d.querySelector('.ct-bg').onclick = cerrar;
  $('ct-no').onclick = cerrar;
  $('ct-si').onclick = async () => {
    const prog = $('ct-prog'), si = $('ct-si'), no = $('ct-no');
    si.disabled = true; no.disabled = true;
    let ok = 0, fallos = 0;
    for (let i = 0; i < vivos.length; i++) {
      prog.textContent = `Cerrando ${i + 1} de ${vivos.length}… confirma en tu wallet`;
      try { await gb.cancelarRejillaK(vivos[i].k); ok++; }
      catch (e) { fallos++; console.warn('[Aurex] cerrar bot:', e); }
    }
    prog.textContent = fallos === 0
      ? `Listo: ${ok} bots cerrados y tu dinero de vuelta.`
      : `${ok} cerrados · ${fallos} no se pudieron (quizá cancelaste la firma).`;
    setTimeout(() => { cerrar(); refrescarRejillas(); refrescarGas(); }, 2200);
  };
}

/** Vigila la esquina inferior izquierda. A los 5 clics, y solo entonces,
 *  descarga el panel de control y le pasa el testigo. */
function prepararPanelOculto() {
  const z = document.createElement('div');
  z.id = 'adm-zona-previa';
  z.setAttribute('aria-hidden', 'true');
  z.style.cssText = 'position:fixed;left:0;bottom:0;width:54px;height:54px;z-index:9999;background:transparent';
  document.body.appendChild(z);
  let clics = 0, t = null, cargando = false;
  const golpe = async () => {
    clics++; clearTimeout(t); t = setTimeout(() => { clics = 0; }, 2500);
    if (clics < 5 || cargando) return;
    clics = 0; cargando = true;
    try {
      const admin = await import('./admin.js?v=125');
      z.remove();                          // el panel pone la suya
      admin.iniciarPanelOculto();
      // Se acaba de cargar: hay que darle los 5 clics otra vez, así que
      // los simulamos para que se abra al momento.
      const nueva = document.getElementById('adm-zona');
      if (nueva) for (let i = 0; i < 5; i++) nueva.click();
    } catch (_) { cargando = false; }
  };
  z.addEventListener('click', golpe);
  z.addEventListener('touchend', (e) => { e.preventDefault(); golpe(); }, { passive: false });
}

/** Pide en lotes pequeños en vez de todo a la vez.
 *  Los servidores públicos de BSC rechazan las ráfagas: 30 peticiones
 *  simultáneas devuelven la mitad vacías. De cuatro en cuatro responden
 *  todas, y no tarda apenas más. */
async function enLotes(lista, fn, tam = 4) {
  const out = [];
  for (let i = 0; i < lista.length; i += tam) {
    const res = await Promise.all(lista.slice(i, i + tam).map(fn));
    out.push(...res);
  }
  return out;
}

/* ── AVISO DE RIESGO ANTES DEL PRIMER BOT ─────────────────────────────
   Alguien puede llegar, poner sus ahorros y crear un bot sin que nadie le
   haya dicho nunca, claramente, que puede perder dinero. Lo contamos en las
   explicaciones, pero solo lo lee quien va a leerlas.
   Esto se enseña UNA vez, la primera. Después no vuelve a molestar. */

function yaVioElAviso() {
  try { return localStorage.getItem(CLAVE_AVISO) === '1'; } catch (_) { return false; }
}

/** Devuelve true si puede seguir; false si canceló. */
function avisoDeRiesgo() {
  return new Promise((resolve) => {
    if (yaVioElAviso()) { resolve(true); return; }
    const d = document.createElement('div');
    d.id = 'riesgo-box';
    d.innerHTML = `<div class="rg-bg"></div>
      <div class="rg-c">
        <div class="rg-t">Antes de empezar, léelo</div>
        <div class="rg-s">Es la única vez que te lo enseño, y prefiero decírtelo yo antes de que lo descubras tú.</div>

        <div class="rg-p"><span>1</span><div><b>Puedes perder dinero.</b> Estos bots funcionan bien cuando el precio sube y baja dentro de un rango, y funcionan mal cuando el mercado se va en una dirección y no vuelve.</div></div>
        <div class="rg-p"><span>2</span><div><b>Nadie puede prometerte ganancias.</b> Ni yo, ni ninguna plataforma. Si alguien te promete un porcentaje fijo al mes, desconfía.</div></div>
        <div class="rg-p"><span>3</span><div><b>Usa solo dinero que puedas dejar quieto.</b> Meses, no días. Si lo vas a necesitar pronto, esto no es para ese dinero.</div></div>
        <div class="rg-p"><span>4</span><div><b>Tu dinero sigue en tu wallet.</b> No lo custodiamos. Pero eso también significa que <b>tú eres responsable de tus claves</b>.</div></div>

        <div class="rg-frase">
          <div class="rg-frase-t">Tu frase de recuperación</div>
          <p>Son las <b>12 palabras</b> que te dio tu wallet al crearla. Es la llave de todo tu dinero.</p>
          <p><b>Escríbelas en papel</b> y guárdalas en un sitio seguro. No en el móvil, no en una foto, no en el correo.</p>
          <p class="rg-frase-x">Si las pierdes, <b>nadie puede recuperarlas</b>: ni nosotros, ni tu wallet, ni nadie. Y si alguien te las pide —quien sea, incluso diciendo que es de CriptoCuba— <b>es una estafa</b>. Nosotros no te las pediremos jamás.</p>
        </div>

        <label class="rg-ok"><input type="checkbox" id="rg-check"> <span>Lo he leído y lo entiendo</span></label>
        <div class="rg-acts">
          <button class="rg-b gris" id="rg-no">Mejor no</button>
          <button class="rg-b" id="rg-si" disabled>Entiendo, continuar</button>
        </div>
      </div>`;
    document.body.appendChild(d);
    estilosRiesgo();
    const cerrar = (v) => { d.remove(); resolve(v); };
    $('rg-check').onchange = (e) => { $('rg-si').disabled = !e.target.checked; };
    $('rg-no').onclick = () => cerrar(false);
    $('rg-si').onclick = () => {
      try { localStorage.setItem(CLAVE_AVISO, '1'); } catch (_) {}
      cerrar(true);
    };
  });
}

function estilosRiesgo() {
  if ($('riesgo-css')) return;
  const s = document.createElement('style'); s.id = 'riesgo-css';
  s.textContent = `
  #riesgo-box{position:fixed;inset:0;z-index:9950;display:flex;align-items:center;justify-content:center;padding:16px}
  #riesgo-box .rg-bg{position:absolute;inset:0;background:rgba(3,5,8,.9);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}
  #riesgo-box .rg-c{position:relative;width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft);border-radius:20px;padding:26px 22px}
  #riesgo-box .rg-t{font-family:var(--display);font-weight:800;font-size:21px;color:var(--gold);text-align:center}
  #riesgo-box .rg-s{font-family:var(--sans);font-size:12.5px;color:var(--ink-3);text-align:center;margin:8px 0 20px;line-height:1.55}
  #riesgo-box .rg-p{display:flex;gap:12px;align-items:flex-start;margin-bottom:15px}
  #riesgo-box .rg-p span{flex:0 0 auto;width:24px;height:24px;border-radius:8px;display:grid;place-items:center;background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426);color:#3a2800;font-family:var(--display);font-weight:800;font-size:12px}
  #riesgo-box .rg-p div{font-family:var(--sans);font-size:13px;color:var(--ink-2);line-height:1.6}
  #riesgo-box .rg-p b{color:var(--ink)}
  #riesgo-box .rg-frase{margin:16px 0 4px;padding:14px;border-radius:12px;background:rgba(246,70,93,.06);border:1px solid rgba(246,70,93,.3)}
  #riesgo-box .rg-frase-t{font-family:var(--display);font-weight:800;font-size:14px;color:var(--rojo);margin-bottom:8px}
  #riesgo-box .rg-frase p{font-family:var(--sans);font-size:12.5px;color:var(--ink-2);line-height:1.6;margin:0 0 8px}
  #riesgo-box .rg-frase p:last-child{margin-bottom:0}
  #riesgo-box .rg-frase b{color:var(--ink)}
  #riesgo-box .rg-frase-x{padding-top:8px;border-top:1px solid rgba(246,70,93,.22)}
  #riesgo-box .rg-frase-x b{color:#ffc2ca}
  #riesgo-box .rg-ok{display:flex;align-items:center;gap:10px;padding:13px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--line);margin:18px 0 14px;cursor:pointer}
  #riesgo-box .rg-ok input{width:19px;height:19px;flex:0 0 auto;accent-color:var(--gold);cursor:pointer}
  #riesgo-box .rg-ok span{font-family:var(--sans);font-size:13px;color:var(--ink)}
  #riesgo-box .rg-acts{display:flex;gap:9px}
  #riesgo-box .rg-b{flex:1;min-height:47px;padding:13px;border-radius:12px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold) 45%,#c79426);color:#3a2800;font-family:var(--display);font-weight:800;font-size:13.5px;cursor:pointer;box-shadow:0 4px 0 #8f6a1a}
  #riesgo-box .rg-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:var(--ink-2);box-shadow:0 3px 0 rgba(0,0,0,.4)}
  #riesgo-box .rg-b:disabled{opacity:.4;cursor:default;box-shadow:none}
  #riesgo-box .rg-b:active:not(:disabled){transform:translateY(2px)}
  @media(max-width:560px){#riesgo-box .rg-c{padding:22px 16px}#riesgo-box .rg-t{font-size:19px}#riesgo-box .rg-p div{font-size:12.5px}}`;
  document.head.appendChild(s);
}

/* ── Cupo de bots ──────────────────────────────────────────────────────────
   Ocho bots por persona: dos de cada estrategia. Es un límite generoso para
   el usuario y sostenible para el sistema (el keeper revisa TODOS los bots
   de TODOS los usuarios cada minuto). */

/** Cuenta los bots activos del usuario, por tipo. */
/* Claves de las ÓRDENES LIMIT (creadas desde Liquidity/Institutional/Smart
   Levels). Se guardan en 'cco-ordenes-grafico' con su botId; un Cash Out creado
   desde la sección de Bots NO deja ese registro. Regla del producto: una orden
   limit NO se muestra ni se cuenta como bot (se ve en "Mis órdenes"). */
function clavesOrdenLimit(cuenta) {
  const set = new Set();
  try {
    const ords = JSON.parse(localStorage.getItem('cco-ordenes-grafico') || '[]');
    for (const o of ords) {
      if (o && o.base && o.quote && o.botId != null) {
        try { set.add(String(gb.claveBot(cuenta, o.base, o.quote, o.botId)).toLowerCase()); } catch (_) {}
      }
    }
  } catch (_) {}
  return set;
}

async function contarBots(cuenta) {
  const r = { total: 0, grid: 0, acum: 0, cash: 0, dca: 0 };
  try {
    const todas = await gb.misRejillas(cuenta);
    const _limit = clavesOrdenLimit(cuenta);
    // Las órdenes limit no cuentan como bots (regla del producto).
    const claves = todas.filter((c) => !_limit.has(String(c).toLowerCase()));
    /* Antes se preguntaba por cada bot ESPERANDO la respuesta del anterior.
       Con 8 bots eran 16 viajes en fila: en una conexión lenta, eterno, y
       el usuario veía "cargando" sin fin. Ahora se preguntan todos a la vez
       y se espera una sola tanda. */
    const datos = await enLotes(claves, async (k) => {
      try {
        const [R, md] = await Promise.all([
          gb.resumenK(k),
          gb.modoDe(k).catch(() => [0])
        ]);
        return { R, m: Number(Array.isArray(md) ? md[0] : 0) };
      } catch (_) { return null; }
    });
    for (const d of datos) {
      if (!d || !d.R || !d.R.activa) continue;
      r.total++;
      const t = d.m === 1 ? 'acum' : d.m === 2 ? 'cash' : d.m === 3 ? 'dca' : 'grid';
      r[t]++;
    }
  } catch (_) {}
  return r;
}

/** ¿Puede crear otro bot de este tipo? Devuelve el motivo si no. */
async function cupoLibre(cuenta, tipo) {
  const c = await contarBots(cuenta);
  if (c.total >= CUPO_TOTAL) {
    return { ok: false, motivo: `Has llegado al máximo de ${CUPO_TOTAL} bots a la vez. Cancela alguno para crear otro.`, c };
  }
  if ((c[tipo] || 0) >= CUPO_POR_TIPO) {
    return { ok: false, motivo: `Ya tienes ${CUPO_POR_TIPO} bots ${NOMBRE_TIPO[tipo]}. Cancela uno para crear otro de este tipo.`, c };
  }
  return { ok: true, c };
}

/** Cápsula "3 de 8" en la cabecera de tus bots. */
async function pintarCupo(cuenta) {
  const el = $('c-cupo');
  if (!el || !cuenta) return;
  const c = await contarBots(cuenta);
  const lleno = c.total >= CUPO_TOTAL;
  el.className = 'c-cupo' + (lleno ? ' lleno' : '');
  /* [CORREGIDO] Aquí se reescribía el contenido SIN la clase cupo-tx,
     así que el CSS que oculta el texto en el móvil no lo encontraba. Se
     veía "1/8 bots activos /8": el número, el texto que debía estar
     oculto, y encima el /8 que añadía el CSS. Ahora la clase va puesta
     y el CSS ya no necesita añadir nada. */
  el.innerHTML = lleno
    ? `<b>${c.total}/${CUPO_TOTAL}</b><span class="cupo-tx">máximo alcanzado</span>`
    : `<b>${c.total}/${CUPO_TOTAL}</b><span class="cupo-tx">bots activos</span>`;
  el.title = `Smart Grid ${c.grid}/${CUPO_POR_TIPO} · Accumulator ${c.acum}/${CUPO_POR_TIPO} · Cash Out ${c.cash}/${CUPO_POR_TIPO} · DCA ${c.dca}/${CUPO_POR_TIPO}`;
}

async function onCrear() {
  /* El aviso de riesgo va LO PRIMERO, antes de pedir ninguna firma.
     Enseñarlo después de que el usuario ya haya aprobado permisos en su
     wallet no sirve de nada: ya se comprometió. Solo sale la 1ª vez. */
  if (!(await avisoDeRiesgo())) return;
  if (F.tipo === 'acum') return onCrearAcum();
  if (F.tipo === 'cash') return onCrearCashOut();
  if (F.tipo === 'dca') return onCrearDCA();
  const m = $('c-msg'); const base = moneda(F.baseId), quote = moneda(F.quoteId);
  const cuenta = wallet.cuentaActual();
  const p = {
    base: gb.dirDe(base), quote: gb.dirDe(quote), decBase: base.decimals, decQuote: quote.decimals,
    pMin: parseFloat($('f-min').value), pMax: parseFloat($('f-max').value),
    niveles: parseInt($('f-niv').value, 10), modo: F.modo, totalQuoteHumano: parseFloat($('f-total').value),
    slippageBps: Math.round((parseFloat($('f-slip')?.value) || 1) * 100),
    cooldownSeg: parseInt($('f-cd')?.value, 10) || 0,
    tpPrecio: parseFloat($('f-tp')?.value) || 0, slPrecio: parseFloat($('f-sl')?.value) || 0,
    margenPct: (parseFloat($('f-margen')?.value) || 0) / 100, margenModo: F.margenModo, rutas: F.rutas
  };
  if (!(p.pMin > 0 && p.pMax > p.pMin)) { aviso(m, 'err', 'Revisa el rango: el precio alto debe ser mayor que el bajo. Prueba "Sugerir".'); return; }
  if (!(p.niveles >= 2)) { aviso(m, 'err', 'Pon al menos 2 cuadrículas.'); return; }
  if (!(p.totalQuoteHumano > 0)) { aviso(m, 'err', '¿Cuánto quieres invertir?'); return; }
  const total = p.totalQuoteHumano;

  const n1 = F.precio && (F.precio < p.pMin || F.precio > p.pMax);
  const ok = await modalConfirm({
    titulo: 'Encender el bot',
    cuerpo: `Vas a poner a trabajar <b>${num(total, 2)} ${quote.simbolo}</b> en ${simboloDe(p.base)}/${quote.simbolo}.<br><br>Te pediré firmar <b>varias veces</b> en tu wallet y te explicaré cada paso. Tu dinero sigue en tu wallet; solo le das permiso al bot para intercambiar dentro de este par.${n1 ? '<br><br>⚠ El precio de ahora está fuera de tu rango: el bot esperará a que entre.' : ''}`,
    ok: 'Sí, encender'
  });
  if (!ok) return;

  try {
    // 0) Verificar saldo real ANTES de firmar nada
    modalBusy('Comprobando tu saldo…');
    const balBI = await gb.balanceToken(p.quote, cuenta);
    const balH = Number(gb.fmt(balBI, quote.decimals)); F.saldoQuote = balH;
    if (total > balH + 1e-9) { modalError(`No tienes suficiente ${quote.simbolo}. En tu wallet hay ${num(balH, 4)} ${quote.simbolo} y quieres invertir ${num(total, 2)}. Baja la cantidad o usa "Máx".`); return; }
    if (!(await asegurarSuscripcion(cuenta))) { modalClose(); return; }

    modalBusy('Calculando tu rejilla con el precio real…');
    const botId = Date.now();
    const config = await gb.construirConfig(p); config.botId = botId;
    const netV = (config._ordenQuoteHumano || 0) * ((config._pasoPct || 0) - FEE_CICLO) - 2 * GAS_OP_USD;
    if (netV < 0) { modalError('Con esta configuración el gas se comería la ganancia de cada vuelta (daría pérdida). Sube el capital, sube la "ganancia por cuadrícula" o usa menos cuadrículas.'); return; }
    const price = config._Pnow || F.precio || 1;
    const topeQuote = total * 20, topeBase = (total / price) * 20;
    const quoteNeed = mBI(topeQuote, quote.decimals), baseNeed = mBI(topeBase, base.decimals);
    const [aQ, aB] = await Promise.all([gb.allowance(p.quote, cuenta), gb.allowance(p.base, cuenta)]);

    const pasos = (aQ < quoteNeed ? 1 : 0) + (aB < baseNeed ? 1 : 0) + 1;
    let i = 0;
    if (aQ < quoteNeed) {
      i++; modalBusy(`<b>Paso ${i} de ${pasos} — Permiso de ${quote.simbolo}.</b><br>Le das permiso al bot para usar tu ${quote.simbolo} y comprar cuando el precio baje (hasta ${num(topeQuote, 2)} ${quote.simbolo}, límite que puedes revocar cuando quieras).<br><br>Confirma en tu wallet.`);
      await gb.aprobarToken(p.quote, quoteNeed);
    }
    if (aB < baseNeed) {
      i++; modalBusy(`<b>Paso ${i} de ${pasos} — Permiso de ${base.simbolo}.</b><br>Para que el bot pueda vender lo que vaya comprando y dejarte la ganancia.<br><br>Confirma en tu wallet.`);
      await gb.aprobarToken(p.base, baseNeed);
    }
    i++; modalBusy(`<b>Paso ${i} de ${pasos} — Encender.</b><br>Se crea tu bot con tu configuración y empieza a vigilar el mercado.<br><br>Confirma en tu wallet.`);
    // Cupo: máximo {CUPO_TOTAL} bots y {CUPO_POR_TIPO} de cada tipo.
    const _cupo = await cupoLibre(cuenta, 'grid');
    if (!_cupo.ok) { modalError(_cupo.motivo); return; }
    await gb.crearRejilla(config);
    avisarKeeper(wallet.cuentaActual());

    recordarPar(cuenta, config.base, config.quote, { decQuote: quote.decimals, decBase: base.decimals, simBase: base.simbolo, simQuote: quote.simbolo, total, entry: config._Pnow, creadoLocal: Date.now(), botId });
    modalDone('¡Bot encendido!', `Tu bot ya está trabajando en ${simboloDe(p.base)}/${quote.simbolo}. Recuerda tener <b>gas</b> cargado para que pueda operar. Lo verás abajo en "Mis bots".`);
    refrescarRejillas(); refrescarSaldoInversion();
  } catch (e) {
    if (esRechazo(e)) { modalClose(); }   // canceló la firma: cerrar sin drama
    else modalError(e?.shortMessage || e?.message || String(e));
  }
}

/* ================================================================== */
/* Panel                                                               */
/* ================================================================== */
async function cargarLogosPrecios() {
  if (LOGO_ST.cargando) return; LOGO_ST.cargando = true;
  try {
    const ids = [...new Set([...BASES, ...QUOTES].map((id) => moneda(id)?.cg).filter(Boolean))];
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&per_page=250&price_change_percentage=24h`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('cg ' + r.status);
    const arr = await r.json();
    const byCg = {}; arr.forEach((c) => { byCg[c.id] = c; });
    [...BASES, ...QUOTES].forEach((id) => { const c = byCg[moneda(id)?.cg]; if (c) LOGOS[id] = { img: c.image, price: c.current_price, chg: c.price_change_percentage_24h }; });
    LOGO_ST.ok = true;
    actualizarBotonesCoin();
    if (window._cmRepintar) window._cmRepintar();
  } catch (_) {} finally { LOGO_ST.cargando = false; }
}
function actualizarBotonesCoin() {
  const b = moneda(F.baseId), q = moneda(F.quoteId);
  const set = (icoId, simId, nomId, mo) => {
    const ico = $(icoId), sim = $(simId), nom = $(nomId);
    if (sim) sim.textContent = mo.simbolo;
    if (nom) nom.textContent = mo.nombre;
    if (ico) { ico.innerHTML = icoInner(mo); ico.style.color = mo.color || 'var(--gold)'; }
  };
  set('fb-ico', 'fb-sim', 'fb-nom', b);
  set('fq-ico', 'fq-sim', 'fq-nom', q);
}
function abrirCoinModal(sel) {
  const esBase = sel === 'base';
  const ids = esBase ? BASES : QUOTES;
  const host = $(APP) || document.body;
  const viejo = $('coin-modal'); if (viejo) viejo.remove();
  const cats = esBase ? [['todas', 'Todas'], ['l1', 'Layer 1'], ['defi', 'DeFi'], ['meme', 'Memes']] : [];
  const el = document.createElement('div');
  el.innerHTML = `<div class="coin-modal" id="coin-modal">
    <div class="coin-modal-bg" id="cm-bg"></div>
    <div class="coin-modal-box">
      <div class="cm-head"><span class="cm-title">${esBase ? 'Elige la moneda' : 'Elige tu estable'}</span><button class="cm-x" id="cm-x" aria-label="Cerrar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="cm-search"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input id="cm-search" placeholder="Buscar por nombre o símbolo…" autocomplete="off"></div>
      ${esBase ? `<div class="cm-cats" id="cm-cats">${cats.map(([c, n], i) => `<button type="button" data-cat="${c}" class="${i === 0 ? 'on' : ''}">${n}</button>`).join('')}</div>` : ''}
      <div class="cm-list" id="cm-list"></div>
    </div>
  </div>`;
  host.appendChild(el.firstElementChild);
  let fcat = 'todas', ftxt = '';
  const selId = () => esBase ? F.baseId : F.quoteId;
  const pintar = () => {
    const q = ftxt.trim().toLowerCase();
    const monedas = ids.map((id) => MONEDAS[id]).filter(Boolean).filter((mo) => {
      const cat = mo.categoria || 'l1';
      if (esBase && fcat !== 'todas' && cat !== fcat) return false;
      if (q && !((mo.simbolo || '').toLowerCase().includes(q) || (mo.nombre || '').toLowerCase().includes(q))) return false;
      return true;
    });
    const list = $('cm-list');
    if (!monedas.length) { list.innerHTML = `<div class="cm-empty">Sin resultados para "${ftxt}"</div>`; return; }
    list.innerHTML = monedas.map((mo) => {
      const on = selId() === mo.id;
      const L = LOGOS[mo.id];
      const chg = L && L.chg != null ? L.chg : null;
      return `<button type="button" class="cm-coin${on ? ' on' : ''}" data-id="${mo.id}">
        <span class="cm-coin-ico" style="color:${mo.color || '#e8b84b'}">${icoInner(mo)}</span>
        <span class="cm-coin-tx"><b>${escT(mo.simbolo)}</b><i>${escT(mo.nombre)}</i></span>
        <span class="cm-coin-right">
          <span class="cm-coin-price">${L ? fmtPrecioUSD(L.price) : '<span class="cm-price-skel"></span>'}</span>
          ${chg != null ? `<span class="cm-coin-chg ${chg >= 0 ? 'pos' : 'neg'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span>` : ''}
        </span>
      </button>`;
    }).join('');
    list.querySelectorAll('.cm-coin').forEach((b) => b.onclick = () => elegirCoin(sel, b.dataset.id));
  };
  window._cmRepintar = pintar;
  pintar();
  if (!LOGO_ST.ok) cargarLogosPrecios();
  $('cm-search').addEventListener('input', (e) => { ftxt = e.target.value; pintar(); });
  setTimeout(() => { const s = $('cm-search'); if (s) s.focus(); }, 60);
  document.querySelectorAll(`#${APP} #cm-cats button`).forEach((b) => b.onclick = () => { fcat = b.dataset.cat; document.querySelectorAll(`#${APP} #cm-cats button`).forEach((x) => x.classList.toggle('on', x === b)); pintar(); });
  const cerrar = () => { window._cmRepintar = null; const mm = $('coin-modal'); if (mm) mm.remove(); };
  $('cm-x').onclick = cerrar; $('cm-bg').onclick = cerrar;
}
function elegirCoin(sel, id) {
  const mm = $('coin-modal'); if (mm) mm.remove();
  if (sel === 'base') { if (id === F.quoteId) return; F.baseId = id; }
  else { if (id === F.baseId) return; F.quoteId = id; }
  actualizarBotonesCoin();
  F.precio = null; F.rutas = null;
  (async () => {
    const sy = $('f-total-sym'); if (sy) sy.textContent = '(' + moneda(F.quoteId).simbolo + ')';
    await cargarPrecio();
    if (F.precio) aplicarPreset(F.preset || 'equilibrado');
    refrescarSaldoInversion(); refrescarSaldoCash();
    if (F.tipo === 'cash') previewCash();
    else if (F.tipo === 'dca') refrescarSaldoDCA();
    else if (F.tipo === 'acum') previewAcum();
  })();
}
function pintarTipo() {
  const t = F.tipo, noGrid = t !== 'grid';
  if ($('f-grid')) $('f-grid').style.display = t === 'grid' ? '' : 'none';
  if ($('f-acum')) $('f-acum').style.display = t === 'acum' ? '' : 'none';
  if ($('f-cash')) $('f-cash').style.display = t === 'cash' ? '' : 'none';
  if ($('f-dca')) $('f-dca').style.display = t === 'dca' ? '' : 'none';
  // Panel derecho (gráfica/reparto/neto) es solo del Smart Grid.
  ['c-chart', 'c-hint', 'c-asesor'].forEach((id) => { const e = $(id); if (e) e.style.display = noGrid ? 'none' : ''; });
  { const as = $('c-acum-side'); if (as) as.style.display = t === 'acum' ? '' : 'none'; }
  { const cs = $('c-cash-side'); if (cs) cs.style.display = t === 'cash' ? '' : 'none'; }
  { const ds = $('c-dca-side'); if (ds) ds.style.display = t === 'dca' ? '' : 'none'; }
  { const cp = $('c-cash-price'); if (cp) cp.style.display = ''; }   // el precio de ahora sirve en los cuatro bots
  pintarPrecioAhora();
  { const av = $('f-toggleavz'); if (av && av.parentElement) av.parentElement.style.display = t === 'dca' ? 'none' : ''; }
  const prev = document.querySelector(`#${APP} .prev`); if (prev) prev.style.display = noGrid ? 'none' : '';
  const tpsl = $('f-avz-tpsl'); if (tpsl) tpsl.style.display = noGrid ? 'none' : '';
  document.querySelectorAll(`#${APP} #f-tipo button`).forEach((b) => b.classList.toggle('on', b.dataset.tipo === t));
  { const meta = BOTMETA[t]; if (meta) { const img = $('f-foto-img'), tit = $('f-foto-tit'), des = $('f-foto-des'); if (img) { img.classList.remove('nocarga'); img.src = meta.img; } if (tit) tit.textContent = meta.nom; if (des) des.textContent = meta.des; } }
  { const ac = { grid: 'var(--az)', acum: 'var(--mo)', cash: 'var(--gold)', dca: 'var(--ve)' }[t] || 'var(--gold)'; const h = $(APP); if (h) h.style.setProperty('--acento', ac);
    const th = { grid:['#a9d4ff','#4d9fff','#2b7fe0','#1a5bb0','#04213f'], acum:['#dcc0ff','#b47cff','#8f4de0','#6a2fb0','#23064a'], cash:['#f7db8d','#E8B84B','#c79426','#8f6a1a','#3a2800'], dca:['#8ff0bd','#34d97b','#1fae5c','#158043','#05230f'] }[t] || ['#f7db8d','#E8B84B','#c79426','#8f6a1a','#3a2800'];
    if (h) { h.style.setProperty('--ac-l', th[0]); h.style.setProperty('--ac-m', th[1]); h.style.setProperty('--ac-d', th[2]); h.style.setProperty('--ac-s', th[3]); h.style.setProperty('--ac-t', th[4]); } }
  if (t === 'cash') refrescarSaldoCash();
  if (t === 'dca') refrescarSaldoDCA();
  if (t === 'acum') previewAcum(); else if (t === 'cash') previewCash(); else if (t === 'dca') previewDCA(); else actualizarVista();
}
function sugerirAcum() {
  if (!F.precio) { aviso($('c-msg'), 'err', 'Espera a que cargue el precio y vuelve a intentar.'); return; }
  $('fa-min').value = Number((F.precio * 0.6).toPrecision(6));   // compra hasta ~-40%
  previewAcum();
}
function previewAcum() {
  const total = parseFloat($('fa-total')?.value) || 0;
  const ini = (parseFloat($('fa-ini')?.value) || 0) / 100;
  const n = parseInt($('fa-niv')?.value, 10) || 0;
  const factor = (parseFloat($('fa-factor')?.value) || 0) / 100;
  const pMin = parseFloat($('fa-min')?.value) || 0;
  if ($('fa-p-ini')) $('fa-p-ini').textContent = total > 0 ? num(total * ini, 2) + ' ' + moneda(F.quoteId).simbolo : '—';
  const prom = $('fa-p-prom'); if (!prom) return;
  if (total > 0 && n >= 1 && F.precio && pMin > 0 && pMin < F.precio) {
    const pTop = F.precio * 0.999;
    let sumBase = 0, sumQuote = 0;
    const ci = total * ini; sumQuote += ci; sumBase += ci / F.precio;
    const rest = total * (1 - ini);
    let sw = 0; for (let d = 0; d < n; d++) sw += (1 + factor * d);
    const oq = sw > 0 ? rest / sw : 0;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 1 : i / (n - 1); const Pi = pMin * Math.pow(pTop / pMin, t);
      const depth = n - 1 - i; const mc = oq * (1 + factor * depth);
      sumQuote += mc; sumBase += mc / Pi;
    }
    const promedio = sumBase > 0 ? sumQuote / sumBase : 0;
    prom.textContent = promedio > 0 ? precioFmt(promedio) : '—';
  } else prom.textContent = '—';
}
async function onCrearAcum() {
  /* El aviso de riesgo va LO PRIMERO, antes de pedir ninguna firma.
     Enseñarlo después de que el usuario ya haya aprobado permisos en su
     wallet no sirve de nada: ya se comprometió. Solo sale la 1ª vez. */
  if (!(await avisoDeRiesgo())) return;
  const m = $('c-msg'); const base = moneda(F.baseId), quote = moneda(F.quoteId);
  const cuenta = wallet.cuentaActual();
  const p = {
    base: gb.dirDe(base), quote: gb.dirDe(quote), decBase: base.decimals, decQuote: quote.decimals,
    pMin: parseFloat($('fa-min').value),
    niveles: parseInt($('fa-niv').value, 10),
    totalQuoteHumano: parseFloat($('fa-total').value),
    iniPct: (parseFloat($('fa-ini').value) || 0) / 100,
    factorPct: (parseFloat($('fa-factor').value) || 0) / 100,
    objetivoPct: (parseFloat($('fa-obj-val').value) || 0) / 100,
    slippageBps: Math.round((parseFloat($('f-slip')?.value) || 1) * 100),
    cooldownSeg: parseInt($('f-cd')?.value, 10) || 0, rutas: F.rutas
  };
  if (!(p.totalQuoteHumano > 0)) { aviso(m, 'err', '¿Cuánto quieres invertir?'); return; }
  if (!(p.pMin > 0 && F.precio && p.pMin < F.precio)) { aviso(m, 'err', 'El precio mínimo debe ser MENOR que el precio de ahora. Prueba "Sugerir".'); return; }
  if (!(p.niveles >= 2)) { aviso(m, 'err', 'Pon al menos 2 compras.'); return; }
  if (!(p.objetivoPct >= 0.005)) { aviso(m, 'err', 'Elige a qué % de ganancia vender.'); return; }
  const total = p.totalQuoteHumano;
  const ok = await modalConfirm({
    titulo: 'Encender el acumulador',
    cuerpo: `Vas a poner <b>${num(total, 2)} ${quote.simbolo}</b> en ${base.simbolo}. Compra en la caída (más volumen mientras más baja) y vende TODO cuando ganes <b>${num(p.objetivoPct * 100, 1)}%</b>. Luego repite.<br><br>Te pediré firmar varias veces; tu dinero sigue en tu wallet.`,
    ok: 'Sí, encender'
  });
  if (!ok) return;
  try {
    modalBusy('Comprobando tu saldo…');
    const balBI = await gb.balanceToken(p.quote, cuenta);
    const balH = Number(gb.fmt(balBI, quote.decimals)); F.saldoQuote = balH;
    if (total > balH + 1e-9) { modalError(`No tienes suficiente ${quote.simbolo}. Hay ${num(balH, 4)} y quieres invertir ${num(total, 2)}.`); return; }
    if (!(await asegurarSuscripcion(cuenta))) { modalClose(); return; }
    modalBusy('Calculando tu acumulador con el precio real…');
    const botId = Date.now();
    const config = await gb.construirConfigAcumulador(p); config.botId = botId;
    const price = config._Pnow || F.precio || 1;
    const topeQuote = total * 20, topeBase = (total / price) * 20;
    const quoteNeed = mBI(topeQuote, quote.decimals), baseNeed = mBI(topeBase, base.decimals);
    const [aQ, aB] = await Promise.all([gb.allowance(p.quote, cuenta), gb.allowance(p.base, cuenta)]);
    const pasos = (aQ < quoteNeed ? 1 : 0) + (aB < baseNeed ? 1 : 0) + 1; let i = 0;
    if (aQ < quoteNeed) { i++; modalBusy(`<b>Paso ${i} de ${pasos} — Permiso de ${quote.simbolo}.</b><br>Para que el bot compre cuando el precio baje.<br><br>Confirma en tu wallet.`); await gb.aprobarToken(p.quote, quoteNeed); }
    if (aB < baseNeed) { i++; modalBusy(`<b>Paso ${i} de ${pasos} — Permiso de ${base.simbolo}.</b><br>Para que pueda vender todo lo acumulado.<br><br>Confirma en tu wallet.`); await gb.aprobarToken(p.base, baseNeed); }
    i++; modalBusy(`<b>Paso ${i} de ${pasos} — Encender.</b><br>Se crea tu acumulador y hace la compra inicial.<br><br>Confirma en tu wallet.`);
    // Cupo: máximo {CUPO_TOTAL} bots y {CUPO_POR_TIPO} de cada tipo.
    const _cupo = await cupoLibre(cuenta, 'acum');
    if (!_cupo.ok) { modalError(_cupo.motivo); return; }
    await gb.crearRejilla(config);
    avisarKeeper(wallet.cuentaActual());
    recordarPar(cuenta, config.base, config.quote, { decQuote: quote.decimals, decBase: base.decimals, simBase: base.simbolo, simQuote: quote.simbolo, total, entry: config._Pnow, creadoLocal: Date.now(), tipo: 'acum', objetivo: p.objetivoPct, botId,
      pMin: p.pMin, nivelesAcum: p.niveles, factorAcum: p.factorPct });
    modalDone('¡Acumulador encendido!', `Ya está comprando en la caída en ${base.simbolo}. Venderá todo al llegar a <b>+${num(p.objetivoPct * 100, 1)}%</b>. Ten <b>gas</b> cargado para que opere. Lo verás en "Mis bots".`);
    refrescarRejillas(); refrescarSaldoInversion();
  } catch (e) {
    if (esRechazo(e)) { modalClose(); } else modalError(e?.shortMessage || e?.message || String(e));
  }
}
function maxCash() {
  const bal = F.saldoBase || 0;
  return gb.esBNB(gb.dirDe(moneda(F.baseId))) ? Math.max(0, bal - RESERVA_BNB) : bal;
}
function pintarSlider(pct) {
  const sl = $('fc-slider'); if (!sl) return;
  const p = Math.max(0, Math.min(100, pct));
  sl.value = p;
  sl.style.setProperty('--fill', p + '%');
}
function setCantCash(v) {
  const inp = $('fc-cant'); if (!inp) return;
  const mx = maxCash(); if (v > mx) v = mx;
  inp.value = v > 0 ? Number(v.toPrecision(8)) : '';
  previewCash();
}
/** Rellena la tarjeta de "precio ahora". Vale para los cuatro bots.
 *  Antes solo la rellenaban Cash Out y DCA: en Smart Grid y Acumulador
 *  la tarjeta salía, pero vacía. */
function pintarPrecioAhora() {
  const cpv = $('cash-price-val'), cpp = $('cash-price-pair');
  if (!cpv && !cpp) return;
  const simB = moneda(F.baseId).simbolo, simQ = moneda(F.quoteId).simbolo;
  if (cpp) cpp.textContent = simB + ' / ' + simQ;
  if (cpv) cpv.textContent = F.precio > 0 ? precioFmt(F.precio) + ' ' + simQ : '—';
}

function previewCash() {
  const cant = parseFloat($('fc-cant')?.value) || 0;
  const modoObj = F.cashModo || 'pct';
  let targetPrice = 0;
  if (modoObj === 'precio') targetPrice = parseFloat($('fc-precio')?.value) || 0;
  else { const pct = parseFloat($('fc-pct')?.value) || 0; if (F.precio && pct > 0) targetPrice = F.precio * (1 + pct / 100); }
  const simB = moneda(F.baseId).simbolo, simQ = moneda(F.quoteId).simbolo;
  const est = $('fc-p-est'); if (est) est.textContent = simQ;
  const cnb = $('cn-b'), cnq = $('cn-q'); if (cnb) cnb.textContent = simB; if (cnq) cnq.textContent = simQ;
  const cpv = $('cash-price-val'), cpp = $('cash-price-pair');
  if (cpp) cpp.textContent = simB + ' / ' + simQ;
  if (cpv) cpv.textContent = F.precio ? precioFmt(F.precio) + ' ' + simQ : '—';
  const usd = $('fc-cant-usd'); if (usd) usd.textContent = (cant > 0 && F.precio) ? '≈ ' + num(cant * F.precio, 2) + ' ' + simQ : '';
  const mx = maxCash(); pintarSlider(mx > 0 ? (cant / mx * 100) : 0);
  const setT = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  if (cant > 0 && targetPrice > 0 && F.precio) {
    const valor = cant * F.precio, proceeds = cant * targetPrice, g = proceeds - valor;
    setT('fc-p-cant', num(cant, 6) + ' ' + simB);
    setT('fc-p-valor', num(valor, 2) + ' ' + simQ);
    setT('fc-p-recibe', num(proceeds, 2) + ' ' + simQ);
    // Lo que se lleva la red y el exchange al vender, para que no sorprenda.
    const comision = proceeds * 0.0005 + GAS_VUELTA_USD / 2;
    setT('fc-p-com', '≈ ' + num(comision, 3) + ' ' + simQ);
    const neto = g - comision;
    const gan = $('fc-p-gan');
    if (gan) { gan.textContent = (neto >= 0 ? '+' : '') + num(neto, 2) + ' ' + simQ; gan.className = neto >= 0 ? 'pos' : 'neg'; }
  } else {
    setT('fc-p-com', '—');
    setT('fc-p-cant', cant > 0 ? num(cant, 6) + ' ' + simB : '—');
    setT('fc-p-valor', (cant > 0 && F.precio) ? num(cant * F.precio, 2) + ' ' + simQ : '—');
    setT('fc-p-recibe', '—');
    const gan = $('fc-p-gan'); if (gan) { gan.textContent = '—'; gan.className = 'pos'; }
  }
}
async function onCrearCashOut() {
  /* El aviso de riesgo va LO PRIMERO, antes de pedir ninguna firma. */
  if (!(await avisoDeRiesgo())) return;
  const m = $('c-msg'); const base = moneda(F.baseId), quote = moneda(F.quoteId);
  const cuenta = wallet.cuentaActual();
  const cantidad = parseFloat($('fc-cant')?.value) || 0;
  if (!(cantidad > 0)) { aviso(m, 'err', '¿Cuánto quieres vender?'); return; }
  if (!F.precio) { aviso(m, 'err', 'Espera a que cargue el precio y vuelve a intentar.'); return; }
  const modoObj = F.cashModo || 'pct';
  let targetPrice;
  if (modoObj === 'precio') {
    targetPrice = parseFloat($('fc-precio')?.value) || 0;
    if (!(targetPrice > F.precio)) { aviso(m, 'err', `El precio objetivo debe estar por encima del precio actual (${precioFmt(F.precio)}).`); return; }
  } else {
    const pct = parseFloat($('fc-pct')?.value) || 0;
    if (!(pct > 0)) { aviso(m, 'err', 'Elige a qué % quieres vender.'); return; }
    targetPrice = F.precio * (1 + pct / 100);
  }
  const p = {
    base: gb.dirDe(base), quote: gb.dirDe(quote), decBase: base.decimals, decQuote: quote.decimals,
    cantidadBase: cantidad, targetPrice,
    slippageBps: Math.round((parseFloat($('f-slip')?.value) || 1) * 100), rutas: F.rutas
  };
  const proceeds = cantidad * targetPrice, gan = cantidad * (targetPrice - F.precio);
  const ok = await modalConfirm({
    titulo: 'Encender Cash Out',
    cuerpo: `Cuando <b>${base.simbolo}</b> llegue a <b>${precioFmt(targetPrice)} ${quote.simbolo}</b>, el bot venderá tus <b>${num(cantidad, 6)} ${base.simbolo}</b> y recibirás <b>~${num(proceeds, 2)} ${quote.simbolo}</b> (ganancia ~${num(gan, 2)}).<br><br>Tu cripto sigue en tu wallet; solo le das permiso para venderla al llegar el objetivo. Ten <b>${quote.simbolo}</b> agregada en tu wallet para verla.`,
    ok: 'Sí, encender'
  });
  if (!ok) return;
  try {
    modalBusy('Comprobando tu saldo…');
    const balBI = await gb.saldoCashDisponible(p.base, cuenta);
    const balH = Number(gb.fmt(balBI, base.decimals));
    if (cantidad > balH + 1e-9) { modalError(`No tienes suficiente ${base.simbolo}. En tu wallet hay ${num(balH, 6)} ${base.simbolo} y quieres vender ${num(cantidad, 6)}.`); return; }
    if (!(await asegurarSuscripcion(cuenta))) { modalClose(); return; }
    modalBusy('Preparando tu Cash Out con el precio real…');
    const botId = Date.now();
    const config = await gb.construirConfigCashOut(p); config.botId = botId;
    const baseNeed = mBI(cantidad * 3, base.decimals);
    // Paso: convertir BNB -> WBNB si hace falta (firma aparte)
    if (gb.esBNB(p.base)) {
      const wbnbBal = await gb.balanceToken(p.base, cuenta);
      const wbnbH = Number(gb.fmt(wbnbBal, base.decimals));
      if (cantidad > wbnbH + 1e-12) {
        const falta = cantidad - wbnbH;
        await pasoWallet('Preparar tu BNB', `Se convierte <b>${num(falta, 6)} BNB</b> a WBNB para poder venderlo (sigue siendo tuyo).<br><br>Toca <b>Continuar</b> y firma en tu wallet.`);
        modalBusy('Convirtiendo tu BNB… firma en tu wallet.');
        await gb.envolverBNB(mBI(falta * 1.001, base.decimals));
      }
    }
    // Paso: permiso si hace falta (firma aparte)
    const aB = await gb.allowance(p.base, cuenta);
    if (aB < baseNeed) {
      await pasoWallet('Dar permiso', `Le das permiso al bot para vender tus <b>${base.simbolo}</b> cuando llegue el objetivo (puedes revocarlo cuando quieras).<br><br>Toca <b>Continuar</b> y firma en tu wallet.`);
      modalBusy('Registrando el permiso… firma en tu wallet.');
      await gb.aprobarToken(p.base, baseNeed);
    }
    // Paso final: encender (firma aparte)
    await pasoWallet('Encender el bot', 'Última firma: se crea tu Cash Out y queda vigilando el precio.<br><br>Toca <b>Continuar</b> y confirma en tu wallet.');
    modalBusy('Encendiendo tu bot… firma en tu wallet.');
    // Cupo: máximo {CUPO_TOTAL} bots y {CUPO_POR_TIPO} de cada tipo.
    const _cupo = await cupoLibre(cuenta, 'cash');
    if (!_cupo.ok) { modalError(_cupo.motivo); return; }
    await gb.crearRejilla(config);
    avisarKeeper(wallet.cuentaActual());
    recordarPar(cuenta, config.base, config.quote, { decQuote: quote.decimals, decBase: base.decimals, simBase: base.simbolo, simQuote: quote.simbolo, total: config._valorActual, cantBase: cantidad, entry: config._Pnow, creadoLocal: Date.now(), tipo: 'cash', targetPrice, botId });
    modalDone('¡Cash Out encendido!', `Cuando ${base.simbolo} llegue a <b>${precioFmt(targetPrice)}</b>, venderá y recibirás ${quote.simbolo} en tu wallet. Ten <b>gas</b> cargado para que pueda operar. Lo verás en "Mis bots".`);
    refrescarRejillas();
  } catch (e) {
    if (esRechazo(e)) { modalClose(); } else modalError(e?.shortMessage || e?.message || String(e));
  }
}
function frecNombre(s) {
  return s <= 86400 ? 'cada día' : s <= 604800 ? 'cada semana' : s <= 1209600 ? 'cada 15 días' : 'cada mes';
}
async function refrescarSaldoDCA() {
  const el = $('fd-saldo'); if (!el) return;
  const cuenta = wallet.cuentaActual(); if (!cuenta) { el.textContent = ''; return; }
  const quote = moneda(F.quoteId);
  try {
    const bal = await gb.balanceToken(gb.dirDe(quote), cuenta);
    el.textContent = `Tienes ${num(Number(gb.fmt(bal, quote.decimals)), 2)} ${quote.simbolo}`;
  } catch { el.textContent = ''; }
  previewDCA();
}
function previewDCA() {
  const simB = moneda(F.baseId).simbolo, simQ = moneda(F.quoteId).simbolo;
  const dnb = $('dn-b'), dnq = $('dn-q'); if (dnb) dnb.textContent = simB; if (dnq) dnq.textContent = simQ;
  const est = $('fd-p-est'); if (est) est.textContent = simQ;
  const monto = parseFloat($('fd-monto')?.value) || 0;
  const intervalo = F.dcaFrec || 604800, comprasMax = F.dcaNum || 0;
  const eq = $('fd-monto-eq'); if (eq) eq.textContent = (monto > 0 && F.precio) ? '≈ ' + num(monto / F.precio, 6) + ' ' + simB : '';
  const cada = $('fd-p-cada'); if (cada) cada.textContent = monto > 0 ? `${num(monto, 2)} ${simQ} ${frecNombre(intervalo)}` : '—';
  const tot = $('fd-p-total'); if (tot) tot.textContent = monto > 0 ? (comprasMax > 0 ? `${num(monto * comprasMax, 2)} ${simQ} (${comprasMax} compras)` : 'Sin límite') : '—';
  const pr = $('fd-p-precio'); if (pr) pr.textContent = F.precio ? precioFmt(F.precio) + ' ' + simQ : '—';
  const cpv = $('cash-price-val'), cpp = $('cash-price-pair');
  if (cpp) cpp.textContent = simB + ' / ' + simQ;
  if (cpv) cpv.textContent = F.precio ? precioFmt(F.precio) + ' ' + simQ : '—';
}
async function onCrearDCA() {
  /* El aviso de riesgo va LO PRIMERO, antes de pedir ninguna firma.
     Enseñarlo después de que el usuario ya haya aprobado permisos en su
     wallet no sirve de nada: ya se comprometió. Solo sale la 1ª vez. */
  if (!(await avisoDeRiesgo())) return;
  const m = $('c-msg'); const base = moneda(F.baseId), quote = moneda(F.quoteId);
  const cuenta = wallet.cuentaActual();
  const monto = parseFloat($('fd-monto')?.value) || 0;
  if (!(monto > 0)) { aviso(m, 'err', '¿Cuánto quieres comprar en cada compra?'); return; }
  if (!F.precio) { aviso(m, 'err', 'Espera a que cargue el precio y vuelve a intentar.'); return; }
  const intervalo = F.dcaFrec || 604800, comprasMax = F.dcaNum || 0;
  const p = {
    base: gb.dirDe(base), quote: gb.dirDe(quote), decBase: base.decimals, decQuote: quote.decimals,
    montoQuote: monto, intervalo, comprasMax, slippageBps: 0, rutas: F.rutas
  };
  const totalTxt = comprasMax > 0 ? `${num(monto * comprasMax, 2)} ${quote.simbolo} en ${comprasMax} compras` : `sin límite (según el ${quote.simbolo} que tengas)`;
  const ok = await modalConfirm({
    titulo: 'Encender DCA',
    cuerpo: `El bot comprará <b>${num(monto, 2)} ${quote.simbolo}</b> de <b>${base.simbolo}</b> <b>${frecNombre(intervalo)}</b>. La primera compra se hace ahora mismo.<br><br>Total: <b>${totalTxt}</b>. Ten <b>${quote.simbolo}</b> cargado en tu wallet para las siguientes.`,
    ok: 'Sí, encender'
  });
  if (!ok) return;
  try {
    modalBusy('Comprobando tu saldo…');
    const balH = Number(gb.fmt(await gb.balanceToken(p.quote, cuenta), quote.decimals));
    if (monto > balH + 1e-9) { modalError(`No tienes suficiente ${quote.simbolo} para la primera compra. En tu wallet hay ${num(balH, 2)} ${quote.simbolo}.`); return; }
    if (!(await asegurarSuscripcion(cuenta))) { modalClose(); return; }
    modalBusy('Preparando tu DCA con el precio real…');
    const botId = Date.now();
    const config = await gb.construirConfigDCA(p); config.botId = botId;
    const nAprob = comprasMax > 0 ? comprasMax : 60;
    const quoteNeed = mBI(monto * nAprob, quote.decimals);
    const aQ = await gb.allowance(p.quote, cuenta);
    const pasos = (aQ < quoteNeed ? 1 : 0) + 1; let i = 0;
    if (aQ < quoteNeed) { i++; modalBusy(`<b>Paso ${i} de ${pasos} — Permiso de ${quote.simbolo}.</b><br>Le das permiso al bot para comprar con tus ${quote.simbolo} en cada ciclo (puedes revocarlo cuando quieras).<br><br>Confirma en tu wallet.`); await gb.aprobarToken(p.quote, quoteNeed); }
    i++; modalBusy(`<b>Paso ${i} de ${pasos} — Encender.</b><br>Se crea tu DCA y hace la primera compra ahora.<br><br>Confirma en tu wallet.`);
    // Cupo: máximo {CUPO_TOTAL} bots y {CUPO_POR_TIPO} de cada tipo.
    const _cupo = await cupoLibre(cuenta, 'dca');
    if (!_cupo.ok) { modalError(_cupo.motivo); return; }
    await gb.crearRejilla(config);
    avisarKeeper(wallet.cuentaActual());
    recordarPar(cuenta, config.base, config.quote, { decQuote: quote.decimals, decBase: base.decimals, simBase: base.simbolo, simQuote: quote.simbolo, total: monto, entry: config._Pnow, creadoLocal: Date.now(), tipo: 'dca', intervalo, comprasMax, botId });
    modalDone('¡DCA encendido!', `Comprará ${num(monto, 2)} ${quote.simbolo} de ${base.simbolo} ${frecNombre(intervalo)}. La primera compra ya se hizo. Ten <b>gas</b> cargado y <b>${quote.simbolo}</b> en tu wallet. Lo verás en "Mis bots".`);
    refrescarRejillas();
  } catch (e) {
    if (esRechazo(e)) { modalClose(); } else modalError(e?.shortMessage || e?.message || String(e));
  }
}
function ccl(cuenta, base, quote) { return `${(cuenta || '').toLowerCase()}|${base.toLowerCase()}|${quote.toLowerCase()}`; }
function recordarPar(cuenta, base, quote, extra) {
  const botId = (extra && extra.botId) || 0;
  const k = gb.claveBot(cuenta, base, quote, botId);
  const m = JSON.parse(localStorage.getItem('bot-pares') || '{}');
  m[k] = { base, quote, ...(extra || {}) }; localStorage.setItem('bot-pares', JSON.stringify(m));
  // al (re)crear, quitar ESTA clave de las cerradas para que se muestre
  const c = JSON.parse(localStorage.getItem('bot-cerradas') || '{}'); delete c[k]; localStorage.setItem('bot-cerradas', JSON.stringify(c));
}
function olvidarPar(cuenta, clave) {
  const m = JSON.parse(localStorage.getItem('bot-pares') || '{}');
  delete m[clave]; localStorage.setItem('bot-pares', JSON.stringify(m));
  // marcar ESA clave como cerrada (no toca los demás bots del mismo par)
  const c = JSON.parse(localStorage.getItem('bot-cerradas') || '{}'); c[clave] = 1; localStorage.setItem('bot-cerradas', JSON.stringify(c));
}
function simboloDe(addr) {
  if (!addr) return '—';
  if (addr.toLowerCase() === gb.WBNB.toLowerCase()) return 'BNB';
  const m = LISTA_TODAS.find((x) => (x.address || '').toLowerCase() === addr.toLowerCase());
  return m ? m.simbolo : addr.slice(0, 6);
}
function monedaPorDir(addr) {
  const a = (addr || '').toLowerCase();
  return LISTA_TODAS.find((x) => (x.address || '').toLowerCase() === a)
    || (a === gb.WBNB.toLowerCase() ? { simbolo: 'BNB', decimals: 18, address: gb.WBNB } : null);
}

/* ---- Estela (trail): muestrea el precio mientras la gráfica está abierta ---- */
const TRAILS = new Map();
function pararTrails() { for (const t of TRAILS.values()) if (t.timer) clearInterval(t.timer); TRAILS.clear(); }
async function arrancarTrail(clave, par, pmin, pmax, decB, decQ, cuenta) {
  if (TRAILS.has(clave)) return;
  const st = { samples: [], timer: null, ops: [] }; TRAILS.set(clave, st);
  const muestrear = async () => {
    let precio = null; try { const pr = await gb.precioPar(par.base, par.quote, decB, decQ); precio = pr.precio; } catch {}
    if (precio) { st.samples.push(precio); if (st.samples.length > 40) st.samples.shift(); }
    const c = document.querySelector(`.pio-panel[data-clave="${clave}"] .trail-chart`);
    if (c && st.niveles) c.innerHTML = dibujar(st.niveles, precio, pmin, pmax, st.samples, st.ops);
  };
  try {
    const nv = await gb.nivelesDe(clave); const R = await gb.resumen(cuenta, par.base, par.quote);
    const ob = Number(gb.fmt(R.ordenBase, decB)) || 1;
    st.niveles = nv.map((x) => { const p = Number(gb.fmt(x.minOutVenta, decQ)) / ob; const e = Number(x.estado); return { p, tipo: e === 1 ? 'compra' : e === 2 ? 'venta' : 'off' }; }).filter((x) => isFinite(x.p) && x.p > 0);
  } catch { st.niveles = []; }
  try { const r = await gb.operacionesDe(cuenta, par.base, par.quote, decB, decQ); st.ops = r.ops || r || []; } catch { st.ops = []; }
  await muestrear();
  st.timer = setInterval(muestrear, 6000);
}

/* ═══════════════════════════════════════════════════════════════════
   VENTANA "MIS ÓRDENES" — órdenes limit puestas desde el gráfico.
   Botón fijo en "Mis bots". Muestra la lista o un estado vacío bonito.
   ═══════════════════════════════════════════════════════════════════ */
async function abrirMisOrdenes(cuenta) {
  document.getElementById('ord-modal')?.remove();
  const d = document.createElement('div');
  d.id = 'ord-modal';
  d.innerHTML = `<div class="ord-bg"></div>
    <div class="ord-c">
      <div class="ord-head">
        <div class="ord-tit"><span class="ord-dot"></span>Mis órdenes</div>
        <button class="ord-x" id="ord-x" aria-label="Cerrar">✕</button>
      </div>
      <div class="ord-sub">Órdenes limit que pusiste a mano desde el gráfico.</div>
      <div class="ord-body" id="ord-body"><div class="ord-cargando">Cargando tus órdenes…</div></div>
    </div>`;
  document.body.appendChild(d);
  if (!document.getElementById('ord-modal-css')) {
    const s = document.createElement('style'); s.id = 'ord-modal-css';
    s.textContent = `
    #ord-modal{position:fixed;inset:0;z-index:9970;display:flex;align-items:center;justify-content:center;padding:16px}
    #ord-modal .ord-bg{position:absolute;inset:0;background:rgba(3,5,8,.82);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
    #ord-modal .ord-c{position:relative;width:100%;max-width:460px;max-height:calc(100vh - 32px);overflow:hidden;display:flex;flex-direction:column;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,rgba(232,184,75,.35));border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.55)}
    #ord-modal .ord-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 4px}
    #ord-modal .ord-tit{display:flex;align-items:center;gap:9px;font:800 18px var(--display,system-ui);color:var(--gold,#E8B84B)}
    #ord-modal .ord-dot{width:8px;height:8px;border-radius:50%;background:#2ee86a;box-shadow:0 0 8px #2ee86a}
    #ord-modal .ord-x{background:rgba(255,255,255,.06);border:0;color:#c7ced6;width:30px;height:30px;border-radius:9px;cursor:pointer;font-size:14px}
    #ord-modal .ord-x:hover{background:rgba(255,255,255,.12)}
    #ord-modal .ord-sub{padding:0 20px 12px;font:400 12.5px var(--sans,system-ui);color:var(--ink-3,#8b95a1)}
    #ord-modal .ord-body{overflow-y:auto;padding:4px 16px 18px}
    #ord-modal .ord-cargando{padding:30px;text-align:center;color:var(--ink-3,#8b95a1);font:400 13px var(--sans,system-ui)}
    #ord-modal .ord-row{display:flex;align-items:center;gap:12px;padding:13px 14px;margin:8px 0;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}
    #ord-modal .ord-tag{flex:0 0 auto;font:800 11px var(--display,system-ui);letter-spacing:.4px;padding:5px 10px;border-radius:8px}
    #ord-modal .ord-tag.v{background:rgba(246,70,93,.14);color:#ff6b7d;border:1px solid rgba(246,70,93,.4)}
    #ord-modal .ord-tag.c{background:rgba(46,232,106,.14);color:#39e07a;border:1px solid rgba(46,232,106,.4)}
    #ord-modal .ord-info{flex:1;min-width:0}
    #ord-modal .ord-par{font:800 15px var(--display,system-ui);color:#eef2f6}
    #ord-modal .ord-meta{font:400 12px ui-monospace,monospace;color:var(--ink-3,#8b95a1);margin-top:2px}
    #ord-modal .ord-meta b{color:#dfe5ec;font-weight:700}
    #ord-modal .ord-cancel{flex:0 0 auto;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#c7ced6;font:700 12px var(--sans,system-ui);padding:8px 12px;border-radius:9px;cursor:pointer}
    #ord-modal .ord-cancel:hover{background:rgba(246,70,93,.14);border-color:rgba(246,70,93,.4);color:#ff6b7d}
    #ord-modal .ord-vacio{text-align:center;padding:36px 20px}
    #ord-modal .ord-vacio-ic{width:52px;height:52px;margin:0 auto 14px;border-radius:14px;background:rgba(232,184,75,.1);display:flex;align-items:center;justify-content:center;color:var(--gold,#E8B84B)}
    #ord-modal .ord-vacio-t{font:800 16px var(--display,system-ui);color:#eef2f6}
    #ord-modal .ord-vacio-d{font:400 13px var(--sans,system-ui);color:var(--ink-3,#8b95a1);margin-top:6px;line-height:1.5}`;
    document.head.appendChild(s);
  }
  const cerrar = () => d.remove();
  d.querySelector('.ord-bg').onclick = cerrar;
  d.querySelector('#ord-x').onclick = cerrar;

  const body = d.querySelector('#ord-body');
  let od;
  try { od = await import('./orden.js?v=125'); } catch (_) { body.innerHTML = `<div class="ord-vacio"><div class="ord-vacio-t">No se pudo cargar</div></div>`; return; }
  try { if (od.sincronizarOrdenes) await od.sincronizarOrdenes(cuenta); } catch (_) {}
  const lista = (od.ordenesPuestas ? od.ordenesPuestas() : []).filter((o) => o.modo !== 'aviso');

  const vacio = `<div class="ord-vacio">
      <div class="ord-vacio-ic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg></div>
      <div class="ord-vacio-t">No tienes órdenes pendientes</div>
      <div class="ord-vacio-d">Pon una orden con clic derecho en cualquier gráfica y aparecerá aquí, esperando su precio.</div>
    </div>`;
  if (!lista.length) { body.innerHTML = vacio; return; }

  body.innerHTML = lista.map((o) => {
    const vender = !!o.vender;
    const cant = o.cant != null ? o.cant : '';
    return `<div class="ord-row" data-id="${o.id}">
      <span class="ord-tag ${vender ? 'v' : 'c'}">${vender ? 'VENTA' : 'COMPRA'}</span>
      <div class="ord-info">
        <div class="ord-par">${o.par || o.simbolo || ''}</div>
        <div class="ord-meta">Precio <b>${precioFmt(Number(o.precio))}</b>${cant !== '' ? ` · Cantidad <b>${cant}</b>` : ''}</div>
      </div>
      <button class="ord-cancel" data-cancel="${o.id}">Cancelar</button>
    </div>`;
  }).join('');

  body.querySelectorAll('[data-cancel]').forEach((b) => {
    b.onclick = () => {
      b.disabled = true; b.textContent = '…';
      try { if (od.cancelar) od.cancelar(b.dataset.cancel); } catch (_) {}
      const row = b.closest('.ord-row'); if (row) row.remove();
      if (!body.querySelector('.ord-row')) body.innerHTML = vacio;
    };
  });
}

function tarjetaMinima(clave, par, err, R) {
  const pair = (R && R.base) ? `${simboloDe(R.base)}/${simboloDe(R.quote)}` : ((par && par.base) ? `${par.simBase}/${par.simQuote}` : '');
  const estado = R ? (R.activa ? 'activo' : 'inactivo') : 'sin resumen';
  const emsg = err ? (err.shortMessage || err.message || String(err)) : (R ? '' : 'resumenK falló');
  const diag = `estado: ${estado} · ${clave ? clave.slice(0, 10) + '…' : ''}${emsg ? ' · ' + emsg.slice(0, 100) : ''}`;
  return `<div class="rej" style="padding:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="min-width:0">
        <div style="font-family:var(--display);color:var(--gold);font-size:15px;font-weight:700">Bot${pair ? ' · ' + pair : ''}</div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--ink-3);margin-top:5px;line-height:1.4">No se pudieron leer todos sus detalles. Puedes cerrarlo aquí; tu cripto queda en tu wallet.</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--ink-3);opacity:.7;margin-top:6px;word-break:break-all">${diag}</div>
      </div>
      <button class="btn btn-rojo" style="width:auto;padding:11px 16px;white-space:nowrap" data-min-cancel="${clave}">Cerrar bot</button>
    </div>
  </div>`;
}
function wireMinCancel(cont) {
  cont.querySelectorAll('[data-min-cancel]').forEach((btn) => btn.onclick = async () => {
    const clave = btn.dataset.minCancel;
    const ok = await modalConfirm({ titulo: 'Cerrar bot', cuerpo: 'Se cerrará este bot y se quita el permiso. <b>Tu cripto se queda en tu wallet.</b>', ok: 'Sí, cerrar', peligro: true });
    if (!ok) return;
    try { modalBusy('Cerrando el bot… confirma en tu wallet.'); await gb.cancelarRejillaK(clave); modalClose(); refrescarRejillas(); }
    catch (e) { modalError(esRechazo(e) ? 'Cancelaste la firma.' : (e?.shortMessage || e?.message || String(e))); }
  });
}

async function refrescarRejillas() {
  const cuenta = wallet.cuentaActual(); const cont = $('c-rejillas'); if (!cuenta || !cont) return;
  try { const _o = await import('./orden.js?v=125'); if (_o.sincronizarOrdenes) await _o.sincronizarOrdenes(cuenta); } catch (_) {}
  pararTrails();
  try {
    const claves = await gb.misRejillas(cuenta);
    const store = JSON.parse(localStorage.getItem('bot-pares') || '{}');
    const cerradas = JSON.parse(localStorage.getItem('bot-cerradas') || '{}');
    let _limpiarCerradas = false;
    /* ══════════════════════════════════════════════════════════════
       CÓMO SE CARGAN LOS BOTS (y por qué así)

       La lista de claves incluye TODOS los bots que has creado alguna
       vez, también los cancelados. Para saber cuáles siguen vivos hay
       que preguntar por cada uno.

       [FALLO GRAVE CORREGIDO] Antes se preguntaba por los 30 a la vez.
       El servidor rechazaba la mayoría por exceso de peticiones, y cada
       fallo pintaba una tarjeta rota con "no se pudieron leer sus
       detalles" y un botón rojo. Resultado: 30 rectángulos negros de
       bots que llevaban meses cerrados.

       Ahora: en lotes pequeños, con un reintento, y si aun así no se
       puede leer un bot NO se pinta nada. Un bot que no se puede leer
       no es un bot roto: es una respuesta que no llegó.
       ══════════════════════════════════════════════════════════════ */
    /* ══════════════════════════════════════════════════════════════
       [MALA PRÁCTICA CORREGIDA] Esta lista ocultaba bots según lo que
       dijera ESTE navegador. Dos problemas graves:

       · Ocultaba en un dispositivo un bot que seguía VIVO en la cadena.
         El usuario lo daba por cerrado y su dinero seguía dentro.
       · Y al revés: en otro dispositivo aparecía "resucitado".

       Ahora la lista local solo sirve para no parpadear mientras la
       cancelación se confirma. Quien decide si un bot existe es el
       CONTRATO, siempre: más abajo se comprueba R.activa.
       ══════════════════════════════════════════════════════════════ */
    const _limit = clavesOrdenLimit(cuenta);
    const _visibles = claves.filter((c) => !_limit.has(String(c).toLowerCase()));
    const LOTE = 4;
    const _cards = [];
    const _ordenes = [];   // órdenes limit puestas desde el gráfico (sección aparte)
    let _sinLeer = 0;

    for (let i = 0; i < _visibles.length; i += LOTE) {
      const lote = _visibles.slice(i, i + LOTE);
      const res = await Promise.all(lote.map(async (clave) => {
        // Un intento, y si falla, otro tras una pausa corta.
        let R = null, fallo = false;
        try { R = await gb.resumenK(clave); }
        catch (_) {
          await new Promise((r) => setTimeout(r, 350));
          try { R = await gb.resumenK(clave); } catch (_) { fallo = true; }
        }

        if (fallo || !R) return { sinLeer: true };      // no se pudo leer → NO se pinta
        if (R.activa === false) {
          // El contrato manda: si está cancelado, se limpia también la
          // marca local para que no quede basura acumulándose.
          if (cerradas[clave]) { delete cerradas[clave]; _limpiarCerradas = true; }
          return null;
        }
        // Marcado como cerrado aquí pero VIVO en la cadena: se muestra.
        // Su dinero sigue dentro y el usuario tiene que poder sacarlo.
        if (cerradas[clave]) { delete cerradas[clave]; _limpiarCerradas = true; }

        /* [BOTS FANTASMA CORREGIDOS] Un bot de verdad tiene niveles y
           dinero dentro. Si el contrato dice que está "activo" pero no
           tiene ni cuadrículas ni posición ni saldo, es un resto de una
           creación que no llegó a completarse. Antes se pintaba igual,
           con el rango mínimo y el máximo iguales y datos sin sentido.
           Ahora no se muestra: no hay nada que gestionar ahí. */
        try {
          const _niv = Number(R.niveles || 0);
          const _pos = BigInt(R.posicionBase || 0n);
          const _cos = BigInt(R.costeQuote || 0n);
          const _ord = BigInt(R.ordenQuote || 0n);
          const _ops = Number(R.totalOps || 0);
          if (_niv === 0 && _pos === 0n && _cos === 0n && _ord === 0n && _ops === 0) return null;
        } catch (_) {}

        let par = store[clave];
        if (!par) {
          /* ══════════════════════════════════════════════════════════
             [FALLO GRAVE CORREGIDO] Aquí ponía `tipo: 'grid'` por
             defecto. Resultado: si el navegador no tenía guardado el
             bot (creado en otro dispositivo, caché limpiada), TU CASH
             OUT SE MOSTRABA COMO SMART GRID. Se estaba adivinando el
             tipo en vez de preguntarlo.

             El contrato lo sabe: modoDe() devuelve 0=Grid, 1=Acumulador,
             2=Cash Out, 3=DCA. Se pregunta y se acabó el adivinar.
             ══════════════════════════════════════════════════════════ */
          let _t = 'grid';
          try {
            const md = await gb.modoDe(clave);
            const m = Number(Array.isArray(md) ? md[0] : (md?.modo ?? md ?? 0));
            _t = m === 1 ? 'acum' : m === 2 ? 'cash' : m === 3 ? 'dca' : 'grid';
          } catch (_) {}
          par = { tipo: _t, reconstruido: true };
        }
        par.__cuenta = cuenta;
        const _esG = !!par.desdeGrafico;
        try { return { html: await tarjeta(cuenta, clave, par, R), esGrafico: _esG }; }
        catch (e) { return { html: tarjetaMinima(clave, par, e, R), esGrafico: _esG }; }
      }));

      for (const x of res) {
        if (!x) continue;
        if (x.sinLeer) { _sinLeer++; continue; }
        if (x.html) { x.esGrafico ? _ordenes.push(x.html) : _cards.push(x.html); }
      }
    }

    // Si hubo marcas locales que ya no valían, se guardan limpias.
    if (_limpiarCerradas) {
      try { localStorage.setItem('bot-cerradas', JSON.stringify(cerradas)); } catch (_) {}
    }

    const cards = _cards;
    // Si hubo bots que no se pudieron leer, UN solo aviso discreto.
    // Nunca treinta tarjetas rotas.
    if (_sinLeer > 0 && cards.length > 0) {
      cards.push(`<div class="sinleer">No pudimos leer ${_sinLeer} bot${_sinLeer > 1 ? 's' : ''} ahora mismo. La red va lenta; se mostrarán al refrescar.</div>`);
    }
    const _cabSec = (t, n, id) => `<div ${id ? `id="${id}"` : ''} style="display:flex;align-items:center;gap:8px;margin:18px 4px 10px;font:800 13px var(--display,system-ui);color:var(--gold,#E8B84B);letter-spacing:.4px;text-transform:uppercase;scroll-margin-top:80px">${t}<span style="font-weight:700;color:var(--ink-3,#8b95a1);background:rgba(255,255,255,.06);border-radius:20px;padding:1px 9px;font-size:11px">${n}</span></div>`;
    const _secOrd = _ordenes.length ? _cabSec('Tus órdenes', _ordenes.length, 'sec-ordenes') + _ordenes.join('') : '';
    const _secBot = cards.length ? _cabSec('Tus bots', cards.length - (_sinLeer > 0 ? 1 : 0)) + cards.join('') : '';
    cont.innerHTML = (_ordenes.length || cards.length) ? (_secOrd + _secBot)
      : `<div class="vacio-ok">
          <div class="vacio-ico"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></div>
          <div class="vacio-t">Todavía no tienes bots</div>
          <div class="vacio-d">Cuando enciendas uno, aparecerá aquí con su marcha y sus resultados.</div>
          <button class="vacio-b" id="c-ir-crear">Crear mi primer bot</button>
          <div class="vacio-p">¿Tenías bots creados? Puede que estén con otra cuenta: revisa cuál tienes activa en tu wallet.</div>
        </div>`;
    const irC = $('c-ir-crear');
    if (irC) irC.onclick = () => { const t = document.querySelector('#colmena-app .bot-tab'); if (t) { t.click(); t.scrollIntoView({ behavior: 'smooth', block: 'center' }); } };
    pintarCupo(cuenta);
    /* Botón "Mis órdenes": SIEMPRE visible, con el número REAL de órdenes
       pendientes (leído del almacenamiento, sincronizado on-chain). */
    {
      const bOrd = $('c-ver-ord'), nOrd = $('c-ord-n');
      if (bOrd && nOrd) {
        bOrd.onclick = () => abrirMisOrdenes(cuenta);
        (async () => {
          try {
            const od = await import('./orden.js?v=125');
            try { if (od.sincronizarOrdenes) await od.sincronizarOrdenes(cuenta); } catch (_) {}
            const n = (od.ordenesPuestas ? od.ordenesPuestas() : []).filter((o) => o.modo !== 'aviso').length;
            if (n > 0) { nOrd.textContent = String(n); nOrd.style.display = ''; }
            else { nOrd.style.display = 'none'; }
          } catch (_) {}
        })();
      }
    }
    const bct = $('c-cerrar-todos');
    if (bct) bct.onclick = () => cerrarTodosLosBots(cuenta);
    enganchar(cuenta);
    wireMinCancel(cont);
    activarContadores();
  } catch (e) {
    console.warn('[Aurex] detalle técnico:', e);
    cont.innerHTML = `<div class="vacio-ok"><div class="vacio-t">No pudimos leer tus bots ahora mismo</div><div class="vacio-d">La red está lenta o hubo un corte momentáneo. Tus bots y tu dinero siguen intactos en la blockchain.</div><button class="vacio-b" onclick="location.reload()">Reintentar</button></div>`;
  }
  if (PNL_TIMER) clearInterval(PNL_TIMER);
  PNL_TIMER = setInterval(refrescarPnls, 10000);
}

let PNL_TIMER = null;
/** Refresca en vivo los números de cada bot (P&L, vueltas) sin recargar la página ni reiniciar la gráfica. */
async function refrescarPnls() {
  const cuenta = wallet.cuentaActual(); if (!cuenta) return;
  const cards = document.querySelectorAll(`#${APP} .rej`);
  for (const card of cards) {
    const base = card.dataset.b, quote = card.dataset.q;
    if (!base || !quote) continue;
    const clave = card.dataset.clave;
    const decB = Number(card.dataset.decb) || 18, decQ = Number(card.dataset.decq) || 18;
    const invertido = Number(card.dataset.total) || 0;
    try {
      const R = await gb.resumenK(clave);
      let precio = null; try { const pr = await gb.precioPar(base, quote, decB, decQ); precio = pr.precio; } catch {}
      const costeQ = Number(gb.fmt(R.costeQuote, decQ));
      const posBase = Number(gb.fmt(R.posicionBase, decB));
      const realizado = Number(gb.fmt(R.gananciaQuote, decQ));
      const noRealizado = precio ? (posBase * precio - costeQ) : 0;
      const totalG = realizado + noRealizado;
      const baseInv = invertido > 0 ? invertido : costeQ;
      const P = (x) => baseInv > 0 ? (x / baseInv * 100) : 0;
      const sg = (x) => (x < 0 ? '−' : '+'), cls = (x) => (x < 0 ? 'neg' : 'pos');
      const r = card.querySelector('.pio-band .r');
      if (r) {
        r.classList.toggle('neg', totalG < 0);
        const v = r.querySelector('.v'); if (v) v.textContent = sg(totalG) + num(Math.abs(totalG), 4);
        const pc = r.querySelector('.pct'); if (pc) pc.textContent = '(' + sg(P(totalG)) + num(Math.abs(P(totalG)), 2) + '%)';
      }
      const qbox = (name) => card.querySelector(`.pio-grid .pio-box[data-box="${name}"]`);
      const upd = (box, val, pctVal) => {
        if (!box) return;
        const v = box.querySelector('.v'), v2 = box.querySelector('.v2');
        if (v) { v.classList.remove('pos', 'neg'); v.classList.add(cls(val)); v.textContent = sg(val) + num(Math.abs(val), 4); }
        if (v2 && pctVal !== undefined) { v2.classList.remove('pos', 'neg'); v2.classList.add(cls(val)); v2.textContent = sg(pctVal) + num(Math.abs(pctVal), 2) + '%'; }
      };
      upd(qbox('realizado'), realizado, P(realizado));
      upd(qbox('flotante'), noRealizado, P(noRealizado));
      /* [CORREGIDO] Este refresco pintaba "— → 600.08": una flecha desde
         un dato que no existe. Y además con un formato distinto al que
         usa la tarjeta al dibujarse, así que el cartel cambiaba solo a
         los pocos segundos. Ahora respeta el mismo formato, y si no hay
         precio de entrada no inventa ninguna flecha. */
      const entry = Number(card.dataset.entry) || null;
      const ea = qbox('entrada');
      if (ea && precio) {
        const v = ea.querySelector('.v');
        const v2 = ea.querySelector('.v2');
        if (entry > 0) {
          if (v) v.textContent = precioFmt(entry);
          const mkt = (precio - entry) / entry * 100;
          if (v2) {
            v2.classList.remove('pos', 'neg');
            v2.classList.add(cls(mkt));
            /* Solo el precio. El porcentaje ya sale en "Ganancia" y en
               "Flotante": repetirlo tres veces no aporta y alarga la
               casilla hasta romperla en el móvil. */
            v2.textContent = 'ahora ' + precioFmt(precio);
          }
        } else {
          // Sin precio de entrada, la casilla enseña el de mercado. Igual
          // que al dibujarse: un solo dato, claro, sin flechas huérfanas.
          if (v) v.textContent = precioFmt(precio);
          if (v2) { v2.classList.remove('pos', 'neg'); v2.style.color = 'var(--ink-3)'; v2.textContent = 'ahora mismo'; }
        }
      }
      const vu = qbox('vueltas');
      if (vu) { const v = vu.querySelector('.v'); const v2 = vu.querySelector('.v2');
        if (v) v.textContent = String(R.ciclos); if (v2) v2.textContent = R.totalOps + ' operaciones'; }
      const pm = qbox('medio');
      if (pm) { const v = pm.querySelector('.v'); if (v) v.textContent = posBase > 0 ? precioFmt(costeQ / posBase) : '—'; }
    } catch (_) {}
  }
}
let GASMIN = null;
function idDe(addr) {
  if (!addr) return null;
  if (addr.toLowerCase() === gb.WBNB.toLowerCase()) return 'BNB';
  const e = Object.entries(MONEDAS).find(([, v]) => (v.address || '').toLowerCase() === addr.toLowerCase());
  return e ? e[0] : null;
}
async function tarjeta(cuenta, clave, par, R) {
  if (!R) R = await gb.resumenK(clave);
  const bAddr = par.base || R.base, qAddr = par.quote || R.quote;
  const mbT = monedaPorDir(bAddr), mqT = monedaPorDir(qAddr);
  const decQ = par.decQuote ?? mqT?.decimals ?? 18, decB = par.decBase ?? mbT?.decimals ?? 18;
  const simB = (par.simBase && par.simBase !== '?') ? par.simBase : (mbT?.simbolo || simboloDe(bAddr));
  const simQ = (par.simQuote && par.simQuote !== '?') ? par.simQuote : (mqT?.simbolo || simboloDe(qAddr));
  if (GASMIN === null) { try { GASMIN = await gb.gasMinOp(); } catch { GASMIN = 0n; } }

  // Niveles (órdenes) + precio
  let precio = null, pmin = 0, pmax = 0, ps = [];
  const ordenBaseH = Number(gb.fmt(R.ordenBase, decB)) || 1;
  const ordenQuoteH = Number(gb.fmt(R.ordenQuote, decQ)) || 0;
  try {
    const niveles = await gb.nivelesDe(clave);
    ps = niveles.map((nv) => {
      const est = Number(nv.estado);
      // El precio sale del dato de VENTA o, si no lo hay (cuadrículas de compra
      // del Acumulador), del dato de COMPRA. Antes solo se miraba el de venta,
      // y por eso el Acumulador no mostraba ninguna cuadrícula.
      let p = Number(gb.fmt(nv.minOutVenta, decQ)) / ordenBaseH;
      if (!(p > 0) && ordenQuoteH > 0) {
        const outC = Number(gb.fmt(nv.minOutCompra, decB));
        if (outC > 0) p = ordenQuoteH / outC;
      }
      return { p, tipo: est === 1 ? 'compra' : est === 2 ? 'venta' : 'off' };
    }).filter((x) => isFinite(x.p) && x.p > 0);

    // ACUMULADOR: cada cuadrícula gasta una cantidad distinta, así que el precio
    // no se puede deducir del contrato. Lo reconstruimos con la configuración
    // que guardamos al crearlo: reparto geométrico entre el mínimo y la entrada.
    // Si es un acumulador antiguo (sin esa configuración), preferimos no pintar
    // cuadrículas a pintarlas mal: se verán solo la entrada y la salida.
    if (par.tipo === 'acum' && !(par.pMin > 0 && par.nivelesAcum >= 1)) ps = [];
    // DCA: compra por TIEMPO, no por precio. No tiene cuadrículas que dibujar;
    // lo útil es ver a qué precios ya compró y su precio medio.
    if (par.tipo === 'dca') ps = [];
    if ((par.tipo === 'acum') && par.pMin > 0 && par.entry > 0 && par.nivelesAcum >= 1) {
      const nA = Number(par.nivelesAcum), pTop = Number(par.entry) * 0.999, pM = Number(par.pMin);
      if (pTop > pM) {
        const hechos = Number(R.comprasHechas || 0);
        ps = Array.from({ length: nA }, (_, i) => {
          const t = nA === 1 ? 1 : i / (nA - 1);
          return { p: pM * Math.pow(pTop / pM, t), tipo: i >= nA - hechos ? 'off' : 'compra' };
        });
      }
    }
    /* [FALLO HISTÓRICO CORREGIDO] Aquí había un `catch {}` vacío: si la
       primera consulta fallaba, el precio se quedaba en nulo y la tarjeta
       mostraba un guion. Y como los servidores públicos fallan a menudo,
       pasaba casi siempre. Ahora se reintenta y, si aun así no llega, se
       usa el precio en dólares de CoinGecko, que ya tenemos cargado. */
    for (let _i = 0; _i < 3 && precio == null; _i++) {
      try {
        const pr = await gb.precioPar(bAddr, qAddr, decB, decQ);
        if (pr && pr.precio > 0) precio = pr.precio;
      } catch (_) {}
      if (precio == null) await new Promise((r) => setTimeout(r, 400));
    }
    // Último recurso: calcularlo con los precios en dólares que ya tenemos.
    if (precio == null) {
      try {
        const lb = LOGOS[simboloDe(bAddr)], lq = LOGOS[simboloDe(qAddr)];
        if (lb && lq && lb.price > 0 && lq.price > 0) precio = lb.price / lq.price;
      } catch (_) {}
    }
    if (ps.length) { pmin = Math.min(...ps.map((x) => x.p)); pmax = Math.max(...ps.map((x) => x.p)); }
    /* [RANGO IGUAL CORREGIDO] Estos límites salen de las cuadrículas que
       QUEDAN VIVAS. Si solo queda una, el mínimo y el máximo son el mismo
       número, y la tarjeta mostraba "600 – 600", que no dice nada.
       El rango de verdad es el que se fijó al crear el bot: si lo tenemos
       guardado, ese manda. */
    if (par.pMin > 0 && par.pMax > par.pMin) { pmin = Number(par.pMin); pmax = Number(par.pMax); }

    /* ══════════════════════════════════════════════════════════════
       EL RANGO, SIN DEPENDER DEL NAVEGADOR
       Si no lo tenemos guardado, se reconstruye de las cuadrículas que
       el CONTRATO devuelve: la más baja y la más alta son el rango. Un
       bot creado en el móvil se ve igual de bien desde el ordenador.
       ══════════════════════════════════════════════════════════════ */
    if (!(pmin > 0 && pmax > pmin)) {
      try {
        const nv = await gb.nivelesDe(clave);
        const ob = Number(gb.fmt(R.ordenBase || 0n, decB)) || 1;
        const precios = nv
          .map((x) => Number(gb.fmt(x.minOutVenta, decQ)) / ob)
          .filter((p) => isFinite(p) && p > 0);
        if (precios.length >= 2) { pmin = Math.min(...precios); pmax = Math.max(...precios); }
      } catch (_) {}
    }
  } catch {}
  // Objetivo de salida del Acumulador (el % al que vende todo de golpe)
  let objBps = 0;
  try { const md = await gb.modoDe(clave); objBps = Number(Array.isArray(md) ? md[1] : 0) || 0; } catch (_) {}
  /* ══════════════════════════════════════════════════════════════
     [LENTITUD CORREGIDA] Aquí se pedía el historial de operaciones con
     eth_getLogs, que es la consulta MÁS LENTA de todas y la que más
     falla en los servidores públicos. Con 30 bots, eran 30 consultas
     lentas encadenadas: por eso la lista tardaba una eternidad.

     La tarjeta no lo necesita para pintarse: solo sirve para dibujar
     las flechitas de compra/venta sobre la gráfica. Así que la tarjeta
     sale YA, y las marcas se añaden después, sin bloquear a nadie. */
  let ops = [], sinHistorial = false;
  const chart = ps.length ? dibujar(ps, precio, pmin, pmax, null, ops) : svgVacio(560, 300, 'este bot ya no tiene órdenes');

  // Números
  const invertido = (par.total != null) ? Number(par.total) : Number(gb.fmt(R.costeQuote, decQ));
  const costeQ = Number(gb.fmt(R.costeQuote, decQ));
  const posBase = Number(gb.fmt(R.posicionBase, decB));
  const realizado = Number(gb.fmt(R.gananciaQuote, decQ));
  const noRealizado = precio ? (posBase * precio - costeQ) : 0;
  const totalG = realizado + noRealizado;
  const baseInv = invertido > 0 ? invertido : costeQ;
  const pct = (x) => baseInv > 0 ? (x / baseInv * 100) : 0;
  const sg = (x) => (x < 0 ? '−' : '+'), cls = (x) => (x < 0 ? 'neg' : 'pos');
  /* ══════════════════════════════════════════════════════════════
     EL PRECIO DE ENTRADA — [FALLO HISTÓRICO CORREGIDO]

     Salía un guion casi siempre porque se leía de `store`, que es la
     memoria de ESTE navegador. Si el bot se creó en el móvil y lo miras
     en el ordenador, o si se limpió la caché, ahí no había nada.

     Pero el contrato SÍ lo sabe: guarda `costeQuote` (lo que gastaste)
     y `posicionBase` (lo que compraste). El precio medio de entrada es
     dividir uno entre otro. Ese dato es fijo, está en la blockchain y
     no depende de ningún navegador.
     ══════════════════════════════════════════════════════════════ */
  /* El objetivo del Cash Out también sale del contrato: modoDe()
     devuelve el modo Y el objetivo en puntos básicos. Antes solo se
     leía del navegador, y al cambiar de dispositivo desaparecía. */
  let objetivo = par.targetPrice;
  if (!(objetivo > 0)) {
    try {
      const md = await gb.modoDe(clave);
      const bps = Number(Array.isArray(md) ? md[1] : 0);
      if (bps > 0 && precio > 0) objetivo = precio * (1 + bps / 10000);
    } catch (_) {}
  }

  let entrada = par.entry;
  if (!(entrada > 0) && R) {
    try {
      const pos = Number(gb.fmt(R.posicionBase || 0n, decB));
      const cos = Number(gb.fmt(R.costeQuote || 0n, decQ));
      if (pos > 0 && cos > 0) entrada = cos / pos;
    } catch (_) {}
  }
  const mkt = (entrada && precio) ? (precio - entrada) / entrada * 100 : null;
  const sinPos = posBase <= 0 && Number(R.comprasHechas) === 0;
  const gas = Number(gb.fmtBNB(R.gasSaldoWei)).toFixed(5);   // 5 decimales: con 4, 0.00396 salía 0.0040 y parecía que no cambiaba
  const gasLow = R.gasSaldoWei < (GASMIN || 0n);
  const creadoSeg = par.creadoLocal ? Math.floor(par.creadoLocal / 1000) : Number(R.creadaEn);

  const obMid = precio || pmin;
  const obAmt = num(Number(gb.fmt(R.ordenBase, decB)), 4);
  const obW = (p) => obMid > 0 ? Math.max(22, Math.min(94, 22 + Math.abs(p - obMid) / obMid * 700)) : 45;
  const obRow = (o, side) => `<div class="ob-row ob-${side}"><span class="ob-bar" style="width:${obW(o.p).toFixed(0)}%"></span><span class="ob-p">${precioFmt(o.p)}</span><span class="ob-a">${obAmt}</span></div>`;
  const obSells = ps.filter((o) => o.tipo === 'venta').sort((a, b) => b.p - a.p);
  const obBuys = ps.filter((o) => o.tipo === 'compra').sort((a, b) => b.p - a.p);
  const ordRows = `
    <div class="ob-head"><span>Precio (${simQ})</span><span>Cantidad (${simB})</span></div>
    <div class="ob-side ob-sells">${obSells.map((o) => obRow(o, 'venta')).join('') || '<div class="ob-empty">sin ventas armadas</div>'}</div>
    <div class="ob-mid"><span>${precioFmt(obMid)}</span><span class="ob-mid-lbl">precio ahora</span></div>
    <div class="ob-side ob-buys">${obBuys.map((o) => obRow(o, 'compra')).join('') || '<div class="ob-empty">sin compras armadas</div>'}</div>`;

  const tipo = par.tipo || 'grid';
  /* Las órdenes puestas desde el gráfico (clic derecho) NO son bots: son
     órdenes limit manuales. Se nombran como tales para no confundirlas con un
     Cash Out o un DCA configurados a mano. */
  const _esGrafico = !!par.desdeGrafico;
  const nombreBot = _esGrafico
    ? (tipo === 'cash' ? 'Orden de venta' : 'Orden de compra')
    : (tipo === 'cash' ? 'Bot Cash Out' : tipo === 'acum' ? 'Bot Accumulator' : tipo === 'dca' ? 'Bot DCA' : 'Bot Smart Grid');
  const invLabel = tipo === 'cash' ? simB : simQ;
  const invValue = tipo === 'cash' ? num((par.cantBase != null ? Number(par.cantBase) : posBase), 6) : num(invertido, 2);
  const _entValida = entrada != null && entrada > 0 && precioFmt(entrada) !== '—';
  // Se guarda en la tarjeta para que el refresco automático lo tenga.
  // Antes solo se guardaba el del navegador: por eso al refrescar
  // aparecía el guion aunque la tarjeta lo hubiera calculado bien.
  par.__entryCalc = _entValida ? entrada : null;
  // Dos datos distintos, cada uno con su nombre claro. Antes ponía
  // "Entrada → Ahora" y, si no había precio de entrada, cambiaba a "Precio
  // ahora": el cartel bailaba y no se entendía qué era cada número.
  // Una sola casilla: el precio al que entraste y cuánto se ha movido desde
  // entonces. Tener otra con el precio de mercado repetía el mismo dato.
  /* ══════════════════════════════════════════════════════════════
     PRECIO DE ENTRADA — POR QUÉ FALLABA TRES VECES

     No era un fallo de lectura. Es que el dato NO EXISTE hasta que el
     bot compra algo: sin compras no hay precio medio de entrada. La
     tarjeta enseñaba un guion y parecía que la web estaba rota.

     Lo que sí tiene sentido en ese momento es decir a qué precio está
     ESPERANDO comprar, que es la cuadrícula de compra más alta. Ese
     dato sí existe desde el primer segundo.
     ══════════════════════════════════════════════════════════════ */
  const _esperaEn = (() => {
    if (_entValida) return null;
    try {
      const compras = ps.filter((x) => x.tipo === 'compra' && x.p > 0).map((x) => x.p);
      if (compras.length) return Math.max(...compras);
      if (tipo === 'cash' && objetivo > 0) return null;   // el Cash Out no compra
    } catch (_) {}
    return null;
  })();

  const _boxEntrada = _entValida
    ? `<div class="pio-box" data-box="entrada"><div class="k"><span class="k-l">Precio de entrada</span><span class="k-s">Entrada</span></div><div class="v" style="font-size:15px">${precioFmt(entrada)}</div><div class="v2 ${mkt == null ? '' : cls(mkt)}" style="${mkt == null ? 'color:var(--ink-3)' : ''}">${mkt == null ? 'al crear el bot' : 'ahora ' + precioFmt(precio)}</div></div>`
    : _esperaEn
      ? `<div class="pio-box" data-box="entrada"><div class="k"><span class="k-l">Compra al llegar a</span><span class="k-s">Compra a</span></div><div class="v" style="font-size:15px">${precioFmt(_esperaEn)}</div><div class="v2" style="color:var(--ink-3)">ahora ${precioFmt(precio)}${precio > 0 ? ' · falta ' + num(Math.abs((precio - _esperaEn) / precio * 100), 2) + '%' : ''}</div></div>`
      : `<div class="pio-box" data-box="entrada"><div class="k"><span class="k-l">Precio del mercado</span><span class="k-s">Mercado</span></div><div class="v" style="font-size:15px">${precioFmt(precio)}</div><div class="v2" style="color:var(--ink-3)">${sinPos ? 'aún no ha comprado' : 'ahora mismo'}</div></div>`;
  const _boxFlotante = `<div class="pio-box" data-box="flotante"><div class="k">Flotante ${iBtn('ganancia')}</div><div class="v ${cls(noRealizado)} numgo" data-to="${Math.abs(noRealizado)}" data-dec="4" data-pre="${sg(noRealizado)}">${sg(noRealizado)}${num(Math.abs(noRealizado), 4)}</div><div class="v2 ${cls(noRealizado)}">${sg(pct(noRealizado))}${num(Math.abs(pct(noRealizado)), 2)}%</div></div>`;
  const _boxGas = `<div class="pio-box" data-box="gas"><div class="k">Gas (BNB)</div><div class="v ${gasLow ? 'neg' : ''}">${gas}</div><div class="v2" style="color:var(--ink-3)">para operar</div></div>`;
  const _boxGrid = `<div class="pio-box" data-box="realizado"><div class="k">Grid profit ${iBtn('porcuad')}</div><div class="v ${cls(realizado)} numgo" data-to="${Math.abs(realizado)}" data-dec="4" data-pre="${sg(realizado)}">${sg(realizado)}${num(Math.abs(realizado), 4)}</div><div class="v2 ${cls(realizado)}">${sg(pct(realizado))}${num(Math.abs(pct(realizado)), 2)}%</div></div>`;
  /* Un rango con el mismo número arriba y abajo no es un rango: es un
     dato que no tenemos. Mejor decirlo que enseñar "600 – 600". */
  const _rangoOk = pmin > 0 && pmax > pmin;
  const _boxRango = `<div class="pio-box"><div class="k">Rango (${simQ})</div>` +
    (_rangoOk
      ? `<div class="v" style="font-size:13px">${precioFmt(pmin)} – ${precioFmt(pmax)}</div>`
      : `<div class="v" style="font-size:13px;color:var(--ink-3)">—</div>`) +
    `<div class="v2" style="color:var(--ink-3)">${R.niveles} cuadrícula${Number(R.niveles) === 1 ? '' : 's'}${_rangoOk ? '' : ' activa' + (Number(R.niveles) === 1 ? '' : 's')}</div></div>`;
  const _boxVueltas = `<div class="pio-box" data-box="vueltas"><div class="k">Vueltas / Ops ${iBtn('vueltas')}</div><div class="v numgo" data-to="${Number(R.ciclos)}" data-dec="0">${R.ciclos}</div><div class="v2" style="color:var(--ink-3)">${R.totalOps} operaciones</div></div>`;
  const _boxMedio = `<div class="pio-box" data-box="medio"><div class="k">Precio medio ${iBtn('promedio')}</div><div class="v" style="font-size:14px">${posBase > 0 ? precioFmt(costeQ / posBase) : '—'}</div><div class="v2" style="color:var(--ink-3)">tu coste</div></div>`;
  /* [CORREGIDO] Aquí leía `par.targetPrice`, o sea del navegador, en vez
     de la variable `objetivo` que ya se calcula del contrato unas líneas
     más arriba. Por eso salía un guion aunque el dato existiera. */
  const _objOk = objetivo > 0 && precioFmt(objetivo) !== '—';
  /* Si la orden se puso desde la gráfica (clic derecho), se identifica como
     tal en vez de mostrarse como un Cash Out configurado a mano. */
  const _subObj = par.desdeGrafico ? 'orden desde gráfico' : 'precio de venta';
  const _boxObjetivo = `<div class="pio-box"><div class="k">Objetivo</div>` +
    (_objOk
      ? `<div class="v" style="font-size:14px">${precioFmt(objetivo)}</div>
         <div class="v2" style="color:var(--ink-3)">${_subObj}</div>`
      : `<div class="v" style="font-size:14px;color:var(--ink-3)">sin fijar</div>
         <div class="v2" style="color:var(--ink-3)">vende manualmente</div>`) +
    `</div>`;
  const _interv = Number(par.intervalo || R.intervalo || 0);
  const _restante = (Number(R.ultimaOpEn) || 0) + _interv - Math.floor(Date.now() / 1000);
  const _proxTxt = _interv <= 0 ? '—' : _restante <= 0 ? 'pronto' : _restante < 3600 ? 'en ' + Math.ceil(_restante / 60) + ' min' : _restante < 86400 ? 'en ' + Math.ceil(_restante / 3600) + ' h' : 'en ' + Math.ceil(_restante / 86400) + ' días';
  const _cmax = Number(par.comprasMax || R.comprasMax || 0);
  const _boxProxima = `<div class="pio-box"><div class="k">Próxima compra</div><div class="v" style="font-size:15px">${_proxTxt}</div><div class="v2" style="color:var(--ink-3)">${frecNombre(_interv)}</div></div>`;
  const _boxCompras = `<div class="pio-box"><div class="k">Compras hechas</div><div class="v">${Number(R.comprasHechas)}${_cmax > 0 ? ' / ' + _cmax : ''}</div><div class="v2" style="color:var(--ink-3)">${_cmax > 0 ? 'de tu plan' : 'sin límite'}</div></div>`;
  const _boxPosicion = `<div class="pio-box"><div class="k">Posición (${simB})</div><div class="v" style="font-size:15px">${num(posBase, 6)}</div><div class="v2" style="color:var(--ink-3)">acumulado</div></div>`;
  let _boxes;
  if (_esGrafico) _boxes = _boxEntrada + _boxObjetivo + _boxGas;   // orden limit: precio, objetivo y gas
  else if (tipo === 'cash') _boxes = _boxEntrada + _boxObjetivo;
  else if (tipo === 'dca') _boxes = _boxProxima + _boxCompras + _boxMedio + _boxPosicion + _boxFlotante + _boxGas;
  else if (tipo === 'acum') _boxes = _boxGrid + _boxFlotante + _boxEntrada + _boxMedio + _boxVueltas + _boxGas;
  else _boxes = _boxGrid + _boxFlotante + _boxEntrada + _boxRango + _boxVueltas + _boxGas;
  const _compartir = `<button class="pio-img" data-acc="historial" title="Descargar todas las operaciones del bot">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg><span>Historial</span></button>`;
  const _panel = `<div class="pio-acciones"><button class="pio-toggle" data-acc="toggle-panel">Ver el bot trabajando ▾</button>${_compartir}</div>
    <div class="pio-panel" data-clave="${clave}" data-gan="${(realizado + noRealizado).toFixed(6)}" data-pct="${baseInv > 0 ? (((realizado + noRealizado) / baseInv) * 100).toFixed(2) : 0}" data-dias="${Math.max(1, Math.floor(creadoSeg / 86400))}" data-vueltas="${Number(R.ciclos)}" data-inv="${baseInv}" data-nombre="${nombreBot}" data-creado="${creadoSeg}" data-tipo="${tipo}" data-ciclos="${Number(R.ciclos)}">
      <div class="pio-tabs"><button data-tab="grafica" class="on">Gráfica</button><button data-tab="ordenes">Órdenes (${ps.length})</button></div>
      <div class="tab-grafica">
        ${grafica.bloqueGrafica({
          simB, simQ, pmin, pmax, precio, decQ, tipo,
          precioMedio: (posBase > 0 && costeQ > 0) ? (costeQ / posBase) : 0,
          objetivoBps: objBps,
          compras: (tipo === 'dca')
            ? [...new Set(ops.filter((o) => o.compra).map((o) => Number(o.precio.toFixed(8))))].slice(-12)
            : [],
          niveles: ps.map((x) => ({ precio: x.p, estado: x.tipo === 'compra' ? 1 : (x.tipo === 'venta' ? 2 : 0) })),
          // Las operaciones YA ejecutadas, para pintarlas sobre su vela
          operaciones: ops.filter((o) => o.tiempo > 0),
          creado: creadoSeg
        })}
        ${sinHistorial ? '<div class="graf-aviso">No pudimos leer el historial de operaciones ahora mismo. Las líneas y el rango sí son reales; las flechas de compra y venta aparecerán cuando la red responda.</div>' : ''}

        <div class="leg">
          <span><svg class="lg-i" viewBox="0 0 12 12"><path d="M6 1.5 10.5 8H1.5z" fill="#2ee86a"/></svg>compró</span>
          <span><svg class="lg-i" viewBox="0 0 12 12"><path d="M6 10.5 1.5 4h9z" fill="#f6465d"/></svg>vendió</span>
          <span><svg class="lg-i" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="#E8B84B"/></svg>tu entrada</span>
          <span><svg class="lg-i" viewBox="0 0 12 12"><circle cx="6" cy="6" r="3.2" fill="#2ee86a"/></svg><svg class="lg-i" viewBox="0 0 12 12" style="margin-left:-3px"><circle cx="6" cy="6" r="3.2" fill="#f6465d"/></svg>precio exacto</span>
          <span><svg class="lg-i" viewBox="0 0 14 12"><path d="M0 6h14" stroke="#2ee86a" stroke-width="1.6" stroke-dasharray="3 2"/></svg>espera comprar</span>
          <span><svg class="lg-i" viewBox="0 0 14 12"><path d="M0 6h14" stroke="#f6465d" stroke-width="1.6" stroke-dasharray="3 2"/></svg>espera vender</span>
        </div></div>
      <div class="tab-ordenes" style="display:none"><div class="ord-list">${ordRows}</div></div>
    </div>`;

  return `<div class="rej" data-b="${bAddr}" data-q="${qAddr}" data-sq="${simQ}" data-sb="${simB}"
     data-bid="${idDe(bAddr) || ''}" data-qid="${idDe(qAddr) || ''}" data-pmin="${pmin}" data-pmax="${pmax}"
     data-niv="${R.niveles}" data-total="${invertido}" data-decb="${decB}" data-decq="${decQ}" data-entry="${entrada > 0 ? entrada : ''}" data-tipo="${tipo}" data-cant="${par.cantBase != null ? par.cantBase : ''}" data-clave="${clave}">
    <div class="pio-head">
      ${logoDe(bAddr, simB)}
      <div class="pio-titles">
        <div class="pio-pair">${simB}/${simQ}</div>
        <div class="pio-sub"><span class="pio-time" data-since="${creadoSeg}">${tiempoActivo(creadoSeg)}</span><span class="pio-op"> · ${R.activa ? '<span class="dot"></span>operando' : 'detenido'}</span></div>
      </div>
      <div class="pio-tags"><span class="pio-tag share" data-share>↗<span class="lbl"> Compartir</span></span><span class="pio-tag">${_esGrafico ? 'LIMIT' : 'LONG'}</span><span class="pio-tag grey">Spot</span></div>
    </div>
    <div class="pio-nombre">${nombreBot}${_esGrafico ? ' <span style="font-size:11px;font-weight:600;color:var(--ink-3,#8b95a1)">· orden limit desde el gráfico</span>' : ''}</div>

    <div class="pio-band">
      <div class="l"><div class="k">Inversión <span class="cur">(${invLabel})</span></div><div class="v">${invValue}</div></div>
      <div class="r ${totalG < 0 ? 'neg' : ''}"><div class="k">Ganancia <span class="tot">total </span><span class="cur">(${simQ})</span></div>
        <div class="v numgo" data-to="${Math.abs(totalG)}" data-dec="4" data-pre="${sg(totalG)}">${sg(totalG)}${num(Math.abs(totalG), 4)}</div>
        <div class="pct">(${sg(pct(totalG))}${num(Math.abs(pct(totalG)), 2)}%)</div></div>
    </div>

    <div class="pio-grid"${tipo === 'cash' ? ' style="grid-template-columns:repeat(2,1fr)"' : ''}>${_boxes}</div>
    ${gasLow ? `<div class="gaswarn">⚠ Gas insuficiente: el bot no puede operar. Recarga BNB en el gas (arriba) para que empiece a comprar y vender.</div>` : ''}
    ${(() => {
      /* AVISO DE FUERA DE RANGO. Si el precio se va del rango, el bot deja de
         operar y se queda quieto. Antes nadie se enteraba: podías tener un bot
         parado meses sin saberlo. Ahora se dice, y se dice qué significa. */
      if (gasLow || !(precio > 0) || !(pmin > 0) || !(pmax > pmin) || tipo !== 'grid') return '';
      if (precio < pmin) {
        const fuera = ((pmin - precio) / pmin * 100).toFixed(1);
        return `<div class="rangowarn abajo">
          <b>El precio se salió de tu rango, por abajo</b>
          Está un ${fuera}% por debajo de tu mínimo, así que el bot <b>ya no opera</b>: compró en todas sus cuadrículas y ahora espera con la moneda.
          <i>No has perdido el dinero: lo tienes en forma de moneda. Si el precio vuelve al rango, seguirá operando solo. Si crees que no volverá, puedes cancelar el bot y recuperar lo que haya.</i>
        </div>`;
      }
      if (precio > pmax) {
        const fuera = ((precio - pmax) / pmax * 100).toFixed(1);
        return `<div class="rangowarn arriba">
          <b>El precio se salió de tu rango, por arriba</b>
          Está un ${fuera}% por encima de tu máximo. El bot <b>vendió todo</b> y ya no tiene nada que hacer.
          <i>Buena noticia: vendiste en la parte alta. Si quieres seguir operando, cancela este bot y crea uno nuevo con el rango puesto en el precio de ahora.</i>
        </div>`;
      }
      // Cerca del borde: avisamos antes de que pase.
      const margen = (pmax - pmin) * 0.08;
      if (precio < pmin + margen || precio > pmax - margen) {
        const lado = precio < pmin + margen ? 'mínimo' : 'máximo';
        return `<div class="rangowarn cerca">
          <b>El precio se acerca a tu ${lado}</b>
          Si lo cruza, el bot dejará de operar hasta que vuelva al rango. Nada urgente, pero conviene que lo sepas.
        </div>`;
      }
      return '';
    })()}
    ${sinPos && !gasLow ? `<div class="gaswarn" style="background:rgba(232,184,75,.08);border-color:var(--gold-soft);color:var(--gold)"><svg class="gw-i" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".35"/><path d="M7 2.6a4.4 4.4 0 0 1 4.4 4.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 7 7" to="360 7 7" dur="1.1s" repeatCount="indefinite"/></path></svg>Tomando posición inicial… El bot está comprando su primera parte a mercado (el keeper la ejecuta en 1–2 min). En cuanto compre, verás aquí la ganancia moverse con el mercado.</div>` : ''}

    ${_panel}

    <div class="rej-btns" style="grid-template-columns:1fr">
      <button class="btn-oro3d" data-acc="terminar">${(tipo === 'cash' || tipo === 'dca') ? 'Suspender' : 'Cerrar y vender'}</button>
    </div>
    <div class="rej-msg"></div>
  </div>`;
}
function esRechazo(e) { return e?.code === 'ACTION_REJECTED' || /reject|denied|user\s*rejected/i.test(e?.message || ''); }
function editarBot(el) {
  const bid = el.dataset.bid, qid = el.dataset.qid;
  if (bid && MONEDAS[bid]) F.baseId = bid;
  if (qid && MONEDAS[qid]) F.quoteId = qid;
  F.avanzado = false; render();
  // rellenar el formulario con la config actual
  if ($('f-min')) $('f-min').value = Number(parseFloat(el.dataset.pmin).toPrecision(6));
  if ($('f-max')) $('f-max').value = Number(parseFloat(el.dataset.pmax).toPrecision(6));
  if ($('f-niv')) $('f-niv').value = el.dataset.niv;
  if ($('f-total') && el.dataset.total && el.dataset.total !== 'undefined') $('f-total').value = el.dataset.total;
  cargarPrecio();
  aviso($('c-msg'), 'info', `Editando ${el.dataset.sb}/${el.dataset.sq}: cambia lo que quieras (por ejemplo las cuadrículas) y pulsa "Encender el bot" para guardar los cambios.`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function compartirBot(card) {
  try { await document.fonts.ready; } catch (_) {}
  const tipo = card.dataset.tipo || 'grid';
  const meta = BOTMETA[tipo] || BOTMETA.grid;
  const txt = (sel) => card.querySelector(sel)?.textContent?.trim() || '';
  const sb = card.dataset.sb || '', sq = card.dataset.sq || '';
  const pair = (sb && sq) ? `${sb}/${sq}` : 'MI BOT';
  const nombre = txt('.pio-nombre') || meta.nom;
  const invLab = txt('.pio-band .l .k') || 'Inversión';
  const inv = txt('.pio-band .l .v') || '—';
  const ganEl = card.querySelector('.pio-band .r');
  const gan = ganEl?.querySelector('.v')?.textContent?.trim() || '—';
  const pct = ganEl?.querySelector('.pct')?.textContent?.trim() || '';
  const neg = ganEl?.classList.contains('neg');
  const bid = card.dataset.bid || '';
  const fecha = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const _since = Number(card.querySelector('.pio-time')?.dataset.since || 0);
  let activo = '';
  if (_since > 0) { let s = Math.floor(Date.now() / 1000 - _since); if (s < 0) s = 0; const d = Math.floor(s / 86400); s -= d * 86400; const h = Math.floor(s / 3600); s -= h * 3600; const mm = Math.floor(s / 60); activo = (d > 0 ? d + 'd ' : '') + (d > 0 || h > 0 ? h + 'h ' : '') + mm + 'm'; }
  const acento = { grid: '#4d9fff', acum: '#b47cff', cash: '#e8b84b', dca: '#34d97b' }[tipo] || '#e8b84b';
  const DISPLAY = '"Chakra Petch", "Trebuchet MS", sans-serif', MONO = '"IBM Plex Mono", ui-monospace, monospace';

  const loadImg = (src, cross) => new Promise((res) => { if (!src) return res(null); const im = new Image(); if (cross) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  // Logo oficial: Trust Wallet (permite CORS -> dibujable en canvas); si falla, CoinGecko.
  const addr = moneda(bid)?.address;
  const twBase = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain';
  const twUrl = addr ? `${twBase}/assets/${addr}/logo.png` : `${twBase}/info/logo.png`;
  let coinImg = await loadImg(twUrl, true);
  if (!coinImg && LOGOS[bid]?.img) coinImg = await loadImg(LOGOS[bid].img, true);
  const botImg = await loadImg(meta.img, false);

  const W = 1080, H = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const shadow = (b = 16, oy = 3) => { g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = b; g.shadowOffsetY = oy; };
  const noShadow = () => { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0; };

  // Puntas doradas con efecto biselado (bicolor, tipo punta de flecha): cada esquina se
  // parte en diagonal — una cara clara y una oscura — para que no se vea plana.
  g.fillStyle = '#c79426'; g.fillRect(0, 0, W, H);
  const RB = 60, claro = '#fbe8a8', oscuro = '#9a6d18', filo = '#6f4f12';
  const bisel = (cx, cy, dx, dy) => {
    g.fillStyle = claro; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dx * RB, cy); g.lineTo(cx + dx * RB, cy + dy * RB); g.closePath(); g.fill();
    g.fillStyle = oscuro; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + dy * RB); g.lineTo(cx + dx * RB, cy + dy * RB); g.closePath(); g.fill();
    g.strokeStyle = filo; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dx * RB, cy + dy * RB); g.stroke();
  };
  bisel(0, 0, 1, 1); bisel(W, 0, -1, 1); bisel(0, H, 1, -1); bisel(W, H, -1, -1);

  rr(0, 0, W, H, 48); g.clip();   // esquinas redondeadas de TODA la imagen

  if (botImg) {
    const ir = botImg.width / botImg.height, cr = W / H; let dw, dh, dx, dy;
    if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; } else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
    g.drawImage(botImg, dx, dy, dw, dh);
  } else { const bgg = g.createLinearGradient(0, 0, W, H); bgg.addColorStop(0, '#20262f'); bgg.addColorStop(1, '#0b0e11'); g.fillStyle = bgg; g.fillRect(0, 0, W, H); }
  const ov = g.createLinearGradient(0, 0, 0, H);
  ov.addColorStop(0, 'rgba(4,6,9,.62)'); ov.addColorStop(.34, 'rgba(4,6,9,.1)'); ov.addColorStop(.58, 'rgba(4,6,9,.34)'); ov.addColorStop(1, 'rgba(4,6,9,.94)');
  g.fillStyle = ov; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(232,184,75,.6)'; g.lineWidth = 5; rr(16, 16, W - 32, H - 32, 38); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1.5; rr(20, 20, W - 40, H - 40, 34); g.stroke();
  g.textBaseline = 'alphabetic';

  // ── Arriba-izquierda: logo + nombre + par · fecha ──
  const lx = 66, ly = 62, lr = 44;
  shadow(18, 4);
  if (coinImg) { g.beginPath(); g.arc(lx + lr, ly + lr, lr, 0, 7); g.fillStyle = '#fff'; g.fill(); noShadow(); g.save(); g.beginPath(); g.arc(lx + lr, ly + lr, lr, 0, 7); g.closePath(); g.clip(); g.drawImage(coinImg, lx, ly, lr * 2, lr * 2); g.restore(); g.strokeStyle = 'rgba(232,184,75,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(lx + lr, ly + lr, lr, 0, 7); g.stroke(); }
  else { g.fillStyle = acento; g.beginPath(); g.arc(lx + lr, ly + lr, lr, 0, 7); g.fill(); noShadow(); g.fillStyle = '#08121f'; g.font = `800 38px ${DISPLAY}`; g.textAlign = 'center'; g.fillText(sb[0] || '?', lx + lr, ly + lr + 14); g.textAlign = 'left'; }
  noShadow();
  shadow(18, 3);
  g.fillStyle = acento; g.font = `700 52px ${DISPLAY}`; g.fillText(nombre, lx + lr * 2 + 28, ly + 34);
  g.fillStyle = '#eaecef'; g.font = `500 26px ${MONO}`; g.fillText(`${pair} · ${fecha}`, lx + lr * 2 + 30, ly + 70);
  if (activo) { g.fillStyle = '#e8b84b'; g.font = `600 22px ${MONO}`; g.fillText(`Activo  ${activo}`, lx + lr * 2 + 30, ly + 102); }
  noShadow();

  // ── Abajo: banda Inversión ↔ Ganancia (chaflán + verde de la página + 3D dorado) ──
  const bX = 54, bW = W - 108, bH = 172, bY = H - 66 - bH;
  g.fillStyle = '#8a6518'; rr(bX, bY + 8, bW, bH, 28); g.fill();                 // borde inferior 3D dorado
  g.fillStyle = 'rgba(9,12,17,.96)'; rr(bX, bY, bW, bH, 28); g.fill();           // cuerpo oscuro
  g.save(); rr(bX, bY, bW, bH, 28); g.clip();
  const grW = bW * 0.58, grX = bX + bW - grW, topOff = grW * 0.20;
  const gg = g.createLinearGradient(grX, bY, bX + bW, bY);
  if (neg) { gg.addColorStop(0, '#a83636'); gg.addColorStop(1, '#f6465d'); }
  else { gg.addColorStop(0, 'rgba(14,203,129,.5)'); gg.addColorStop(1, '#12d18e'); }
  g.fillStyle = gg; g.beginPath(); g.moveTo(grX + topOff, bY); g.lineTo(bX + bW, bY); g.lineTo(bX + bW, bY + bH); g.lineTo(grX, bY + bH); g.closePath(); g.fill();
  g.restore();
  g.strokeStyle = '#e8b84b'; g.lineWidth = 2.5; rr(bX, bY, bW, bH, 28); g.stroke();                    // borde dorado
  g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1; rr(bX + 2.5, bY + 2.5, bW - 5, bH - 5, 26); g.stroke();
  // izquierda: Inversión (etiqueta dorada, valor blanco)
  g.fillStyle = '#e8b84b'; g.font = `600 22px ${MONO}`; g.fillText(('Inversión (' + sq + ')').toUpperCase(), bX + 36, bY + 60);
  g.fillStyle = '#eaecef'; g.font = `700 50px ${DISPLAY}`; g.fillText(inv, bX + 34, bY + 120);
  // derecha: Ganancia total (texto OSCURO sobre verde, como la página)
  g.textAlign = 'right';
  const gtxt = neg ? '#2a0808' : '#03210f';
  g.globalAlpha = .82; g.fillStyle = gtxt; g.font = `600 22px ${MONO}`; g.fillText('GANANCIA TOTAL', bX + bW - 36, bY + 56); g.globalAlpha = 1;
  g.fillStyle = gtxt; g.font = `800 50px ${DISPLAY}`; g.fillText(gan, bX + bW - 36, bY + 112);
  if (pct) { g.font = `800 27px ${MONO}`; g.fillText(pct, bX + bW - 36, bY + 148); }
  g.textAlign = 'left';

  // Pie: la web primero, que es lo que queremos que se recuerde.
  shadow(12, 2);
  g.fillStyle = 'rgba(232,184,75,.95)'; g.font = `700 25px ${MONO}`; g.textAlign = 'center';
  g.fillText('CRIPTOCUBAOFICIAL.COM   ·   SIN CUSTODIA   ·   SIN KYC', W / 2, H - 32);
  g.textAlign = 'left'; noShadow();

  /* El logo, arriba a la derecha con su margen. Se dibuja al final para
     que quede por encima de todo, y si no carga la imagen no se rompe
     nada: la tarjeta sale igual, solo que sin logo. */
  const _pintar = () => cv.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
    a.download = `bot-${tipo}-${sb}${sq}.png`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, 'image/png');

  /* El logo va arriba a la derecha, con margen para que no se pegue al
     borde. Si tarda o falla, la imagen sale igual sin él: nunca se deja
     al usuario sin su tarjeta por un logo que no cargó. */
  const _logo = new Image();
  _logo.crossOrigin = 'anonymous';
  let _hecho = false;
  const _una = () => { if (_hecho) return; _hecho = true; _pintar(); };
  _logo.onload = () => {
    try {
      const alto = 74;
      const ancho = Math.round(_logo.width * (alto / _logo.height));
      g.drawImage(_logo, W - ancho - 46, 40, ancho, alto);
    } catch (_) {}
    _una();
  };
  _logo.onerror = _una;
  setTimeout(_una, 1400);          // por si la imagen se atasca
  _logo.src = 'assets/img/cco-192.png';
}
function enganchar(cuenta) {
  document.querySelectorAll(`#${APP} .rej`).forEach((el) => {
    const b = el.dataset.b, q = el.dataset.q, sq = el.dataset.sq, sb = el.dataset.sb;
    wirePops(el);
    const shareBtn = el.querySelector('[data-share]');
    if (shareBtn) shareBtn.onclick = () => compartirBot(el);
    el.querySelectorAll('[data-acc]').forEach((btn) => btn.onclick = async () => {
      const acc = btn.dataset.acc;
      if (acc === 'historial') {
        const r = el.querySelector('[data-nombre]') || el;   // los datos viven en el panel
        extras.avisoHistorial(async () => {
          let ops = [];
          try {
            const mb = MONEDAS[sb], mq = MONEDAS[sq];
            const r = await gb.operacionesDe(cuenta, b, q, mb?.decimals ?? 18, mq?.decimals ?? 18);
            ops = r.ops || r || [];
          } catch (e) { console.warn('[Aurex] historial:', e); }
          extras.descargarHistorial({
            par: `${sb}/${sq}`,
            tipo: r.dataset.nombre || 'Bot CriptoCuba',
            claseBot: r.dataset.tipo || '',
            moneda: sq || '',
            base: sb || '',
            creado: Number(r.dataset.creado) || 0,
            ciclos: Number(r.dataset.ciclos) || 0,
            ganancia: Number(r.dataset.gan) || 0,
            invertido: Number(r.dataset.inv) || 0,
            operaciones: ops
          });
        });
        return;
      }
      if (acc === 'toggle-panel') {
        const panel = el.querySelector('.pio-panel'); const abrir = !panel.classList.contains('open');
        panel.classList.toggle('open', abrir); btn.textContent = abrir ? 'Ocultar ▴' : 'Ver el bot trabajando ▾';
        if (abrir) { try { grafica.pintar(panel); } catch (_) {} }
        if (abrir) arrancarTrail(panel.dataset.clave, { base: b, quote: q }, parseFloat(el.dataset.pmin), parseFloat(el.dataset.pmax), Number(el.dataset.decb), Number(el.dataset.decq), cuenta);
        else { const t = TRAILS.get(panel.dataset.clave); if (t?.timer) { clearInterval(t.timer); TRAILS.delete(panel.dataset.clave); } }
        return;
      }
      if (acc === 'tab-noop') return;
      if (acc === 'editar') { editarBot(el); return; }
      if (acc === 'terminar') {
        const esCash = el.dataset.tipo === 'cash';
        const esDca = el.dataset.tipo === 'dca';
        const soloCancelar = esCash || esDca;   // no vende: solo detiene
        const ok = await modalConfirm({
          titulo: esDca ? 'Suspender DCA' : (esCash ? 'Cerrar Cash Out' : 'Cerrar y vender'),
          cuerpo: esDca ? `Se detiene el DCA y se quita el permiso. <b>La cripto que ya compraste se queda en tu wallet.</b>` : (esCash ? `Se cancelará este Cash Out y se quita el permiso. <b>Tu cripto se queda en tu wallet</b>, no se vende nada.` : `Se venderá todo a <b>${sq}</b> y el bot se cerrará. El dinero queda en tu wallet.`),
          ok: soloCancelar ? 'Sí, suspender' : 'Sí, cerrar'
        });
        if (!ok) return;
        try {
          if (!soloCancelar) {
            try { modalBusy('Vendiendo a estable… confirma en tu wallet.'); await gb.cerrarAhoraK(el.dataset.clave); }
            catch (e) { if (esRechazo(e)) { modalError('Cancelaste la firma. No se hizo ningún cambio.'); return; } }
          }
          modalBusy('Cerrando el bot… confirma en tu wallet.'); await gb.cancelarRejillaK(el.dataset.clave);
          if (esCash && gb.esBNB(b)) {
            try {
              const wbnbBal = await gb.balanceToken(b, cuenta);
              const cant = parseFloat(el.dataset.cant) || 0; const dcb = Number(el.dataset.decb) || 18;
              let unwrap = wbnbBal;
              if (cant > 0) { const cantWei = mBI(cant, dcb); if (unwrap > cantWei) unwrap = cantWei; }
              if (unwrap > 0n) { modalBusy('Devolviendo tu BNB… confirma en tu wallet.'); await gb.desenvolverBNB(unwrap); }
            } catch (_) {}
          }
          olvidarPar(cuenta, el.dataset.clave); modalClose(); refrescarRejillas();
        } catch (e) {
          if (!esRechazo(e)) { olvidarPar(cuenta, el.dataset.clave); refrescarRejillas(); }
          modalError(esRechazo(e) ? 'Cancelaste la firma.' : (e?.shortMessage || e?.message || String(e)));
        }
      } else if (acc === 'desconectar') {
        const ok = await modalConfirm({ titulo: 'Desconectar bot', cuerpo: `Se cerrará este bot y se <b>quitará el permiso</b> que le diste sobre tu ${sq} y ${sb}. No podrá operar hasta que lo actives de nuevo.`, ok: 'Desconectar', peligro: true });
        if (!ok) return;
        try {
          modalBusy('Cerrando el bot… confirma en tu wallet.'); await gb.cancelarRejillaK(el.dataset.clave);
          modalBusy(`Quitando el permiso de ${sq}… confirma.`); await gb.revocarToken(q);
          modalBusy(`Quitando el permiso de ${sb}… confirma.`); await gb.revocarToken(b);
          olvidarPar(cuenta, el.dataset.clave); modalClose(); refrescarRejillas();
        } catch (e) {
          if (!esRechazo(e)) { olvidarPar(cuenta, el.dataset.clave); refrescarRejillas(); }
          modalError(esRechazo(e) ? 'Cancelaste una firma.' : (e?.shortMessage || e?.message || String(e)));
        }
      }
    });
    // pestañas del panel
    el.querySelectorAll('.pio-tabs button').forEach((tb) => tb.onclick = () => {
      el.querySelectorAll('.pio-tabs button').forEach((x) => x.classList.remove('on')); tb.classList.add('on');
      const g = el.querySelector('.tab-grafica'), o = el.querySelector('.tab-ordenes');
      if (tb.dataset.tab === 'grafica') { g.style.display = ''; o.style.display = 'none'; }
      else { g.style.display = 'none'; o.style.display = ''; }
    });
  });
}

/* ================================================================== */
/* Arranque                                                            */
/* ================================================================== */
async function arrancar() {
  if (!$(APP)) return;
  initSwap(conectarWallet, cargarLogosPrecios);
  const host = $(APP);
  // Splash neutro mientras se resuelve si hay wallet conectada (evita el pestañeo del hero).
  // Sin pantalla de carga: dejamos el fondo negro y ya. Si la wallet responde
  // rápido (lo normal), el usuario no ve ningún parpadeo. El círculo solo
  // aparece si de verdad tarda más de medio segundo.
  host.innerHTML = `<div id="c-boot" style="min-height:64vh"></div>`;
  const _tBoot = setTimeout(() => {
    const bx = $('c-boot');
    if (bx) bx.innerHTML = `<div style="min-height:64vh;display:flex;align-items:center;justify-content:center"><span style="width:22px;height:22px;border-radius:50%;border:2px solid rgba(232,184,75,.25);border-top-color:#E8B84B;display:inline-block;animation:spin .7s linear infinite"></span></div>`;
  }, 500);
  // Ojo: durante el arranque NO dibujamos al conectar la wallet. Si lo hacemos,
  // la página se dibuja dos veces seguidas (una al conectar y otra al terminar)
  // y se ve un parpadeo feo. Dejamos el aviso activo solo cuando ya arrancó.
  let _arrancando = true;
  wallet.alCambiar(() => { if (!_arrancando) render(); });
  // La página se dibuja SIEMPRE. Si una extensión de wallet no contesta
  // (pasa cuando MetaMask u otra wallet queda en mal estado tras actualizarse),
  // seguimos adelante: nunca un "Cargando…" eterno.
  let walletMuda = false;
  try {
    await Promise.race([
      wallet.reconectarSiProcede(),
      new Promise((r) => setTimeout(() => { walletMuda = true; r(); }, 2500))
    ]);
  } catch (_) {}
  clearTimeout(_tBoot);
  _arrancando = false;
  render(); iniciarReloj();
  if (_movil()) { import('./movil/movil.js?v=1').then((m) => m.montarMovil({ conectarWallet })).catch(() => {}); }
  if (walletMuda && !wallet.cuentaActual()) {
    setTimeout(() => {
      const el = $('c-hero-msg') || $('c-msg');
      if (el) aviso(el, 'err', 'Tu extensión de wallet no está respondiendo. Abre MetaMask desde la barra del navegador y desbloquéala, o reinicia el navegador. Puedes seguir usando la página mientras tanto.', 12000);
    }, 400);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
else arrancar();


/* ================================================================== */
/* SWAP — panel de intercambio (estilo PancakeSwap, estética propia)   */
/* ================================================================== */
