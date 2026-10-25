/* terminal/terminal.js. Interfaz de la Terminal (modulo sellado: solo ./motor.js y ./config.js).
   Fase 2: feed en vivo de tokens recien nacidos en BNB Chain (pares nuevos de PancakeSwap contra BNB
   o USDT, y monedas creadas en el Launchpad de DecFreedom). Misma tabla y estetica que New Tokens. */

import * as ethers from './ethers.min.js';
import * as gb from './motor.js';
import { auditar, PASOS, PASOS_TXT } from './auditoria.js';
import { abrirCompra, saldoBNB, saldoToken } from './compra.js';
import { comoFunciona } from './aviso.js';
import { abrirFiltros } from './filtros.js';
import { velasDeToken, montarGrafico, destruirGrafico, precioActual, tradesRecientes } from './grafico.js';
import * as wallet from './wallet.js';
import { listaDe, enVivo, olvidar, historialDe } from './posiciones.js';
import { listaWatch, enWatch, alternarWatch, quitarWatch, listaAlertas, alertasDe, crearAlerta, quitarAlerta, arrancarVigilante, marcarVistas } from './alertas.js';
import { abrirGrande, refrescarAlertasOFC, tarjetaPos, ajustarPct, css as cssOFC } from './panel-grande.js';
import { esOwner, estadoSuscripcion, bloquearZona, activoEnCache } from './candado.js';
import { resolverContrato, esContrato } from './resolver.js';
import { mercadoDe, mercadoListo, cargarMercado } from './mercado.js';
import { FEED, SCAN_URL, FOURMEME_URL, USDT } from './config.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const corto = (a) => a ? '…' + String(a).slice(-4) : '';
/* Precio del token en USDT: si el par ya es contra USDT, es directo; si es contra BNB, se multiplica por el precio de BNB. */
// Precio en USD para el lobby. Prefiere el precio FRESCO de DexScreener (el mismo que ya alimenta el 24h %)
// en vez del precio CONGELADO que se leyo una sola vez al entrar el token al feed: asi el lobby no muestra un
// precio viejo mientras el Full Chart muestra el vivo (era una incongruencia visible en todos los tokens).
const usdDe = (it) => {
  if (!it) return 0;
  const m = mercadoDe(it.token); if (m && m.precioUsd > 0) return m.precioUsd;
  return it.precioUsd > 0 ? it.precioUsd : (it.moneda === 'USDT' ? it.precio : it.precio * _bnbUsd);
};

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
const ICO_CHEV = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
const ICO_CHECK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>';
const ICO_VERIF = '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10" fill="#2ebd85"/><path d="m7.8 12 2.6 2.6L16.2 9" fill="none" stroke="#06231a" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/* Logo de BNB oficial (imagen de CoinGecko, la misma que usamos en toda la pagina). Si no carga, cae al glifo BSC. */
const LOGO_BNB = 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png';
const LOGO_USDT = 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png';
const bnbCoin = () => `<span class="tm-bnbimg">${ICO_BSC}<img src="${LOGO_BNB}" alt="" loading="lazy" onload="this.parentElement.classList.add('on')" onerror="this.remove()"></span>`;
const usdtCoin = () => `<span class="tm-bnbimg tm-usdtimg"><span class="tm-usdt-fb">$</span><img src="${LOGO_USDT}" alt="" loading="lazy" onload="this.parentElement.classList.add('on')" onerror="this.remove()"></span>`;
const monedaCoin = (c) => (c === 'USDT' ? usdtCoin() : bnbCoin());

/* Precio: cifras significativas, con subindice para los muy pequenos (igual que el launchpad). */
function fmtP(p, sig = 4) {
  if (!(p > 0) || !isFinite(p)) return '0';
  if (p >= 0.001) return Number(p.toPrecision(sig)).toString();
  const e = Math.floor(Math.log10(p));
  let dig = Math.round(p / Math.pow(10, e - sig + 1)), ceros = -e - 1;
  if (dig >= Math.pow(10, sig)) { dig = Math.floor(dig / 10); ceros -= 1; }   // el redondeo cruzo una potencia de 10: un cero menos
  return `0.0<sub>${Math.max(0, ceros)}</sub>${String(dig).slice(0, sig)}`;
}
function money(v) { if (!(v > 0)) return '$0'; if (v >= 1e12) return '$' + (v / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T'; if (v >= 1e9) return '$' + (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B'; if (v >= 1e6) return '$' + (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'; if (v >= 1e3) return '$' + (v / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K'; return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
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
// Campanita del topbar: numero de alertas armadas; se pone en rojo cuando alguna se dispara y aun no la has visto.
function pintarBell() {
  const b = $('tm-bell-badge'); if (!b) return;
  let l = []; try { l = listaAlertas(); } catch (_) {}
  const activas = l.filter((a) => !a.disparada).length;
  const nuevas = l.filter((a) => a.disparada && !a.visto).length;
  if (nuevas > 0) { b.hidden = false; b.className = 'tm-bell-badge fired'; b.textContent = nuevas > 9 ? '9+' : String(nuevas); }
  else if (activas > 0) { b.hidden = false; b.className = 'tm-bell-badge'; b.textContent = activas > 9 ? '9+' : String(activas); }
  else { b.hidden = true; b.className = 'tm-bell-badge'; b.textContent = ''; }
}
function hace(ms) { if (!ms) return '0s'; const s = Math.max(0, Math.floor((Date.now() - ms) / 1000)); if (s < 60) return s + 's'; const m = Math.floor(s / 60); if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; }
function abreviar(n) { const s = String(n || '').trim(); if (!s) return 'Token'; const p = s.split(/\s+/)[0]; return p.length > 12 ? p.slice(0, 11) + '…' : (s.length > p.length ? p + '…' : p); }
/* Logo del token: se intenta el de Trust Wallet (repositorio publico, sin servidor propio). Un token recien
   nacido casi nunca lo tiene; entonces queda el rombo de BNB Chain como marca de la red, nunca un hueco. */
const LOGO_TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/';
const ICO_TRON = '<svg class="tm-tron" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#EC0928"/><path fill="#fff" d="M24 11.5 8.7 8.8l8 16.4 9-12.1-1.7-1.6zm-1.9 1.3.9.9-2.4 3.2.3-3.8 1.2-.3zm-2.7.2-.4 4.3-3.4-7 3.8.7-.1 2zm-4.9-.8 3 6.2-5-10.3 2 4.1z"/></svg>';
const logo = (sim, addr, red, logoUrl) => {
  if (red === 'tron') {
    const img = logoUrl ? `<img class="tm-logo-img" src="${esc(logoUrl)}" alt="" loading="lazy" onload="this.classList.add('on')" onerror="this.remove()">` : '';
    return `<span class="tm-logo"><span class="tm-logo-fb"></span>${img}</span>`;
  }
  let a = ''; try { a = ethers.getAddress(String(addr || '')); } catch (_) {}
  const src = logoUrl || (a ? LOGO_TW + a + '/logo.png' : '');
  const img = src ? `<img class="tm-logo-img" src="${esc(src)}" alt="" loading="lazy" onload="this.classList.add('on')" onerror="this.remove()">` : '';
  return `<span class="tm-logo"><span class="tm-logo-fb"></span>${img}</span>`;
};

let _items = [];          // mas nuevo primero
let _bnbUsd = 0;
let _parar = null;

// En PC (pantalla ancha) al tocar un token o Positions se abre la vista grande; en movil, la ficha / el panel.
const esGrande = () => { try { return window.innerWidth >= 860; } catch (_) { return false; } };
const ctxGrande = () => ({ items: () => _items.slice(), bnbUsd: () => _bnbUsd, abrirFicha, auditarCache, auditoriaDe,
  // Velas YA cargadas del token seleccionado en el lobby: el OFC las reutiliza para que la MISMA moneda que
  // tiene grafico abajo lo tenga tambien al abrir Open Full Chart (antes el OFC volvia a descargar por su
  // cuenta y a veces fallaba donde el lobby si tenia datos -> grafico vacio por esa via. Esa era la causa).
  velasDe: (tok) => ((_cpFuente === 'v2' && _cpTok && tok && String(_cpTok).toLowerCase() === String(tok).toLowerCase() && Array.isArray(_velasRaw) && _velasRaw.length) ? _velasRaw.slice() : null) });

/* ─── Ticker de actividad del lobby: UNA operacion a la vez con un token REAL del area de trading.
   REAL y monitorizado en vivo: el token, su logo, el PRECIO ACTUAL (precioActual on-chain, el MISMO que
   usa Open Full Chart), el % y el $ del P&L (se derivan del precio real) y la grafica (puntos reales segun
   va entrando el precio). SIMULADO (lo UNICO): la inversion, la cantidad y el precio de ENTRADA.
   Todo es coherente por construccion: entrada fija, %=(precioReal-entrada)/entrada y $=inv*%/100, asi que
   cantidad*precioReal - inversion = $ exacto. El % inicial y la inversion van ACOPLADOS para que el $ nunca
   sea absurdo (mayoria ganancias, variadas). Al cruzar a NEGATIVO toda la tarjeta se pone roja y al volver,
   verde. Se puede TOCAR -> abre esa misma moneda real en Open Full Chart; el icono ↗ abre el scanner.
   Dura 3-8 min, rota sin repetir token. Reutiliza la tarjeta de posiciones del OFC (tarjetaPos). ─── */
let _tkTO = null, _tkPoll = null, _tkRAF = 0, _tkRec = [], _tkE = null, _tkGen = 0;
const TK_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>';
const TK_DN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 7l10 10"/><path d="M16 17H7V8"/></svg>';
/* Solo monedas SANAS para el ejemplo motivador: en verde (cambio24>0) y sin desplome. Si hay pocas en verde,
   respaldo a las que al menos NO se estan desplomando (cambio24>-8). Nunca rugs/colapsadas (-100%). */
function _tkPool() {
  const base = _items.filter((x) => x.par && usdDe(x) > 0 && mercadoDe(x.token) && mercadoDe(x.token).cambio24 != null);
  const verde = base.filter((x) => mercadoDe(x.token).cambio24 > 0);
  return verde.length >= 3 ? verde : base.filter((x) => mercadoDe(x.token).cambio24 > -8);
}
function _tkPickTok() {
  const pool = _tkPool(); if (!pool.length) return null;
  let cand = pool.filter((p) => !_tkRec.includes(p.token.toLowerCase()));
  if (!cand.length) { _tkRec = []; cand = pool; }                       // agotados: se reinicia el ciclo
  const it = cand[(Math.random() * cand.length) | 0];
  _tkRec.push(it.token.toLowerCase()); const tope = Math.max(1, Math.min(50, pool.length - 1)); while (_tkRec.length > tope) _tkRec.shift();
  return it;
}
/* % compacto IGUAL que la tarjeta (pctCompact): <1000 -> entero sin decimales (8%, 319%); desde mil -> K/M/B/T
   con <=1 decimal. El usuario lo pidio asi: ni 8.41% ni 34.1%, y nunca se sale del recuadro. */
const TK_SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];
function _tkPct(v) {
  if (v == null || !isFinite(v)) return '0%';
  const sg = v < 0 ? '-' : '+'; let a = Math.abs(v);
  if (a < 1000) return sg + Math.round(a) + '%';
  let u = 0; while (a >= 1000 && u < TK_SUF.length - 1) { a /= 1000; u++; }
  let s = a < 10 ? (Math.round(a * 10) / 10).toFixed(1).replace(/\.0$/, '') : String(Math.round(a));
  if (s === '1000') { s = '1'; u++; }
  return sg + s + (TK_SUF[u] || '') + '%';
}
function _tkUsd(v) { const a = Math.abs(v), s = v < 0 ? '-' : '+'; return s + (a < 1000 ? '$' + a.toFixed(2) : money(a)); }
/* Operacion CREIBLE: % inicial e inversion ACOPLADOS para que el $ nunca sea absurdo (mayoria ganancias,
   variadas). A mas % -> stake mas pequeno (como en la realidad). El precio real luego mueve %/$ de verdad. */
function _tkPlan() {
  const r = Math.random(), pick = (a) => a[(Math.random() * a.length) | 0];
  if (r < 0.14) return { pct: -(3 + Math.random() * 15), inv: pick([50, 80, 120, 200, 350, 500, 800]) };          // ~14% perdida PEQUENA (-3% a -18%), nunca un desastre
  if (r < 0.62) return { pct: 18 + Math.random() * 360, inv: pick([80, 120, 200, 350, 500, 800, 1200, 2000]) };   // ganancia modesta
  if (r < 0.88) return { pct: 380 + Math.random() * 2600, inv: pick([40, 60, 100, 160, 250, 400]) };              // ganancia grande
  return { pct: 3000 + Math.random() * 24000, inv: pick([20, 30, 50, 80, 120]) };                                 // "leyenda" (stake pequeno)
}
/* Datos de la tarjeta: TODO coherente. entrada fija (simulada), precio actual REAL, %=(real-entrada)/entrada,
   $=inv*%/100, cantidad=inv/entrada  =>  cantidad*real - inv === $ exacto. */
function _tkCardData(e) {
  const it = e.it, pct = (e.cur - e.entry) / e.entry * 100;
  return { token: it.token, red: it.red || 'bsc', simbolo: it.simbolo, nombre: it.nombre, moneda: it.moneda || 'BNB', entradaUsd: e.entry, precioUsd: e.cur, cant: e.inv / e.entry, costoUsd: e.inv, pnlUsd: e.inv * pct / 100, pnlPct: pct, abierta: e.abierta, logoUrl: it.logoUrl || '' };
}
/* Historial "de mentiritas" SOLO para darle cuerpo a la grafica: ~36 puntos desde la entrada hasta el precio
   real de arranque (organico). De ahi en adelante son puntos REALES del precio segun van entrando. */
function _tkPrefix(entry, cur, n) {
  const out = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); const base = entry + (cur - entry) * Math.pow(t, 1.35); const wob = (cur - entry) * 0.06 * (Math.sin(i * 0.7) + Math.sin(i * 1.9 + 1) * 0.5) * (1 - t); out.push(Math.max(1e-30, base + wob)); }
  out[n - 1] = cur; return out;
}
/* Precio REAL on-chain (el MISMO que usa Open Full Chart / las posiciones). Si falla, cae al precio de cache. */
async function _tkRealPrice(it) {
  try { const p = await precioActual({ par: it.par, token: it.token, decToken: it.decimales || 18, decQuote: 18, bnbUsd: _bnbUsd, quoteEsUSDT: it.moneda === 'USDT' }); if (p > 0 && isFinite(p)) return p; } catch (_) {}
  const u = usdDe(it); return u > 0 ? u : 0;
}
async function _tkStart() {
  const host = $('tm-ticker'); if (!host || !host.isConnected) { montarTickerStop(); return; }
  const gen = ++_tkGen;
  const it = _tkPickTok();
  if (!it) { host.innerHTML = ''; _tkTO = setTimeout(_tkStart, 5000); return; }     // aun sin tokens reales con datos
  const cur0 = await _tkRealPrice(it);                                              // precio REAL de arranque (on-chain)
  if (gen !== _tkGen) return;                                                       // se reinicio durante el await
  if (!(cur0 > 0)) { _tkTO = setTimeout(_tkStart, 3000); return; }
  const plan = _tkPlan();                                                           // SIMULADO: % inicial + inversion (acoplados)
  const entry = cur0 / (1 + plan.pct / 100);                                        // SIMULADO: entrada plausible por la que paso
  const abierta = it.tiempo || (Date.now() - (5 + Math.random() * 1400) * 60000);   // Token Age REAL (it.tiempo YA viene en ms)
  const dur = 180000 + Math.random() * 300000;                                      // 3-8 min, variado
  _tkE = { it, entry, inv: plan.inv, cur: cur0, target: cur0, abierta, t0: Date.now(), dur, hist: _tkPrefix(entry, cur0, 36), sign: plan.pct >= 0, gen };
  host.innerHTML = `<div class="tm-tk-op">${tarjetaPos(_tkCardData(_tkE))}</div>`;
  const op = host.querySelector('.tm-tk-op'), card = host.querySelector('.pcd');
  if (!card) { _tkTO = setTimeout(_tkStart, 5000); return; }
  _tkE.card = card;
  const ch = card.querySelector('.pcd-chart'); if (ch) ch.innerHTML = '<svg class="tk-live" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>';
  if (op) {   // tocar la tarjeta -> abrir ESA moneda real en OFC; el icono ↗ (scanner) no propaga
    op.addEventListener('click', () => { const t = _tkE && _tkE.it; if (!t) return; try { if (esGrande()) { seleccionarCP(t); verGrande(t); } else abrirFicha(t); } catch (_) {} });
    const ext = op.querySelector('.pcd-ext'); if (ext) ext.addEventListener('click', (ev) => ev.stopPropagation());
  }
  requestAnimationFrame(() => { if (gen === _tkGen && op) op.classList.add('on'); });   // fade-in suave
  try { ajustarPct(card); } catch (_) {}                                            // el % arranca al tamano maximo que cabe
  if (_tkPoll) clearInterval(_tkPoll);
  _tkPoll = setInterval(async () => { const e = _tkE; if (!e || e.gen !== _tkGen) return; const p = await _tkRealPrice(e.it); if (!_tkE || _tkE.gen !== gen) return; if (p > 0) { if ((p - e.entry) / e.entry * 100 < -25) { _tkNext(); return; } e.target = p; e.hist.push(p); if (e.hist.length > 80) e.hist.shift(); } }, 9000);  // precio REAL cada 9s; si se desploma (-25%) corta y pasa a otra moneda -> jamas se muestra un -100%
  if (_tkRAF) cancelAnimationFrame(_tkRAF); _tkRAF = requestAnimationFrame(_tkFrame);
  if (_tkTO) clearTimeout(_tkTO); _tkTO = setTimeout(_tkNext, dur);
}
/* Render por frame: el precio MOSTRADO se acerca suavemente al ultimo precio REAL (interpola entre medidas
   reales, nunca inventa mas alla). Recalcula %/$ coherentes, el color y la grafica. */
function _tkFrame() {
  const e = _tkE, host = $('tm-ticker'); if (!e || !host || !host.isConnected) { montarTickerStop(); return; }
  e.cur += (e.target - e.cur) * 0.08;                                               // easing hacia el precio real
  const pct = (e.cur - e.entry) / e.entry * 100, up = pct >= 0;
  if (up !== e.sign) { e.sign = up; e.card.classList.toggle('up', up); e.card.classList.toggle('down', !up);
    const h = e.card.querySelector('.pcd-pnl-h'); if (h) h.innerHTML = (up ? TK_UP : TK_DN) + 'P&L'; }
  const pctEl = e.card.querySelector('.pcd-pnl-pct'); if (pctEl) { const t = _tkPct(pct); if (pctEl.textContent !== t) { pctEl.textContent = t; ajustarPct(e.card); } }
  const usdEl = e.card.querySelector('.pcd-pnl-usd'); if (usdEl) usdEl.textContent = _tkUsd(e.inv * pct / 100);
  const curEl = e.card.querySelector('.pcd-cur'); if (curEl) curEl.innerHTML = '$' + fmtP(e.cur);
  _tkDraw(up);
  _tkRAF = requestAnimationFrame(_tkFrame);
}
/* Grafica en vivo: linea suave del PRECIO (prefijo de cuerpo + puntos reales) con la punta en el precio actual. */
function _tkDraw(up) {
  const e = _tkE; if (!e || !e.card) return;
  const svg = e.card.querySelector('.tk-live'); if (!svg) return;
  const pts = e.hist.concat(e.cur), n = pts.length; if (n < 2) return;
  let lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts); if (hi - lo < 1e-30) { hi = hi * 1.001 + 1e-30; lo = lo * 0.999 - 1e-30; } const pad = (hi - lo) * 0.2; lo -= pad; hi += pad;
  const X = (i) => i / (n - 1) * 100, Y = (v) => 100 - (v - lo) / (hi - lo) * 100;
  let d = 'M0,' + Y(pts[0]).toFixed(2);                                            // curva suave (midpoints cuadraticos)
  for (let i = 1; i < n; i++) { const mx = (X(i - 1) + X(i)) / 2, my = (Y(pts[i - 1]) + Y(pts[i])) / 2; d += ' Q' + X(i - 1).toFixed(2) + ',' + Y(pts[i - 1]).toFixed(2) + ' ' + mx.toFixed(2) + ',' + my.toFixed(2); }
  d += ' L100,' + Y(pts[n - 1]).toFixed(2);
  const c = up ? '#00F5C0' : '#FF385F', area = d + ' L100,100 L0,100 Z';
  svg.innerHTML = `<defs><linearGradient id="tkg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".34"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#tkg)"/><path d="${d}" fill="none" stroke="${c}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 2px ${c})"/>`;
  const dot = e.card.querySelector('.pcd-dot-end'); if (dot) { dot.style.top = Y(pts[n - 1]).toFixed(1) + '%'; dot.style.background = `radial-gradient(circle at 40% 36%,#fff,${c})`; dot.style.boxShadow = `0 0 11px 2px ${up ? 'rgba(0,245,192,.9)' : 'rgba(255,56,95,.9)'}`; }
}
/* Fin de la operacion: se desvanece y entra otra (token distinto) sin brincos. */
function _tkNext() {
  const host = $('tm-ticker'); if (!host || !host.isConnected) { montarTickerStop(); return; }
  _tkGen++;                                                                         // invalida polls/awaits en curso
  if (_tkPoll) { clearInterval(_tkPoll); _tkPoll = null; }
 
  if (_tkRAF) { cancelAnimationFrame(_tkRAF); _tkRAF = 0; }
  const o = host.querySelector('.tm-tk-op'); if (o) o.classList.remove('on');
  _tkTO = setTimeout(_tkStart, 650);                                               // tras el fade-out, nueva operacion
}
function montarTickerStop() { _tkGen++; if (_tkTO) { clearTimeout(_tkTO); _tkTO = null; } if (_tkPoll) { clearInterval(_tkPoll); _tkPoll = null; } if (_tkRAF) { cancelAnimationFrame(_tkRAF); _tkRAF = 0; } _tkE = null; }
function montarTicker() {
  montarTickerStop();
  const host = $('tm-ticker'); if (!host) return;
  try { cssOFC(); } catch (_) {}                                                   // asegura el CSS de .pcd en el lobby
  host.innerHTML = '';
  _tkStart();
}

export function arrancar() {
  const host = $('tm-app'); if (!host) return;
  host.innerHTML = `
    <div class="tm-head"><div class="tm-head-bg"></div><div class="tm-ticker" id="tm-ticker" aria-hidden="true"></div></div>
    <div class="tm-topbar">
      <span class="tm-topbar-sp"></span>
      <div class="tm-search"><span class="tm-search-ico">${ICO_SEARCH}</span><input id="tm-search" type="text" autocomplete="off" spellcheck="false" placeholder="Search token, contract or address…"></div>
      <div class="tm-topbar-r"><button class="tm-bell" id="tm-bell" type="button" aria-label="Price alerts">${ICO_BELL}<span class="tm-bell-badge" id="tm-bell-badge" hidden></span></button><button class="tm-poswidget empty" id="tm-poswidget" type="button" disabled><span class="tm-pw-dot"></span>No active positions</button></div>
    </div>
    <div class="tm-lobby">
      <aside class="tm-side">
        <div class="tm-winner" id="tm-winner" role="button" tabindex="0"><span class="tm-winner-ico">${bnbCoin()}</span><div class="tm-winner-main"><div class="tm-winner-top"><span class="tm-winner-lbl">Prime mover</span><b class="tm-winner-price"></b></div><div class="tm-winner-nm"><b>Scanning…</b></div><em class="tm-winner-chg muted">Finding the top gainer right now</em></div></div>
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
      </aside>
      <main class="tm-center">
        <section class="tm-panel">
          <div class="tm-sec-head">
            <div class="tm-sec-tt"><span class="tm-sec-ico">${ICO_BOLT}</span><div class="tm-sec-txt"><b>New pairs</b><span>Newest tokens on BNB Chain</span></div></div>
            <div class="tm-sec-r"><button class="tm-b sec tm-fil-b" id="tm-filtros" type="button">Filters</button><div class="tm-live" id="tm-live"><span>Connecting…</span></div></div>
          </div>
          <div class="tm-tabrow"><div class="tm-tabs3" id="tm-tabs3"><button data-tab="vol" class="on" type="button">Volume</button><button data-tab="trend" type="button">Trending</button><button data-tab="buyers" type="button">Buyers</button><button data-tab="all" type="button">All</button></div></div>
          <div id="tm-feed" class="tm-feed-scroll">${skeleton()}</div>
        </section>
        <section class="tm-cp" id="tm-cp">
          <div class="tm-cp-head">
            <div class="tm-cp-tt" id="tm-cp-tt"><span class="tm-cp-ph">${ICO_BOLT}<b>Chart</b><span>Pick a token below to load its live chart</span></span></div>
            <div class="tm-cp-right"><div class="tm-tf" id="tm-cp-tf"><button data-sec="60" type="button">1m</button><button data-sec="300" type="button">5m</button><button data-sec="900" class="on" type="button">15m</button><button data-sec="3600" type="button">1h</button><button data-sec="14400" type="button">4h</button><button data-sec="86400" type="button">1d</button></div><button class="tm-cp-all" id="tm-cp-all" type="button" aria-label="View full chart" disabled>${ICO_EXPAND}</button></div>
          </div>
          <div class="tm-chart tm-cp-chart"><div class="tm-chart-cv" id="tm-cp-cv"></div><img class="tm-wm" src="../../branding/decfreedomlogohorizontal.webp" onerror="this.onerror=null;this.src='../../assets/img/cco-full.webp'" alt=""><div class="tm-chart-msg" id="tm-cp-msg">Pick a token below</div></div>
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
  const bus = $('tm-search'); if (bus) bus.oninput = () => {
    const raw = (bus.value || '').trim(); _busqueda = raw.toLowerCase();
    if (esContrato(raw) && !_items.some((it) => it.token.toLowerCase() === raw.toLowerCase())) {
      _lobResolQ = raw.toLowerCase(); _lobResuelto = 'load'; const mine = ++_lobResolN; pintar();
      resolverContrato(raw).then((it) => { if (mine !== _lobResolN) return; _lobResuelto = it || 'none'; pintar(); }).catch(() => { if (mine === _lobResolN) { _lobResuelto = 'none'; pintar(); } });
    } else { _lobResuelto = null; _lobResolQ = ''; pintar(); }
  };
  const bell = $('tm-bell'); if (bell) bell.onclick = () => { try { abrirGrande(_sel || null, ctxGrande(), { alerta: true }); } catch (_) {} };
  try { pintarBell(); } catch (_) {}
  try { montarTicker(); } catch (_) {}
  const tabs3 = $('tm-tabs3');
  if (tabs3) tabs3.querySelectorAll('button').forEach((b) => { b.onclick = () => { _tab = b.dataset.tab; tabs3.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); pintar(); }; });
  // Grafico inline (Modulo 4): timeframes, refrescar y View All.
  const cptf = $('tm-cp-tf');
  if (cptf) cptf.querySelectorAll('button').forEach((b) => { b.onclick = () => { _tfSec = Number(b.dataset.sec) || 900; cptf.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); if (_cpFuente === 'gecko' && _sel) cargarCPGecko(_sel); else renderCP(); }; });
  const cpall = $('tm-cp-all'); if (cpall) cpall.onclick = () => { if (_sel) verGrande(_sel); };
  const nav = $('tm-nav');
  if (nav) nav.querySelectorAll('.tm-nav-b').forEach((b) => { b.onclick = () => { const n = b.dataset.nav; try {
    if (n === 'mine') abrirPanel('positions');
    else if (n === 'history') abrirPanel('history');
    else if (n === 'alerts') { try { abrirGrande(_sel || null, ctxGrande(), { alerta: true }); } catch (_) {} }
    else if (n === 'checks') abrirPanel('verif');
  } catch (_) {} }; });
  gb.precioBNBUSDT().then((v) => { _bnbUsd = v || 0; pintar(); try { pintarPosWidget(); } catch (_) {} }).catch(() => {});
  setInterval(() => { document.querySelectorAll('#tm-feed .tm-age').forEach((td) => { td.textContent = hace(Number(td.dataset.t)); }); }, 1000);
  try { pintarPosWidget(); setInterval(() => { try { pintarPosWidget(); } catch (_) {} }, 15000); } catch (_) {}
  // Vigilante de alertas: avisa (notificacion + aviso en la app) cuando el precio toca el objetivo. Solo mientras el Terminal este abierto.
  try { arrancarVigilante(() => _bnbUsd, (a, p) => { tmAviso(a, p); try { pintarBell(); } catch (_) {} try { refrescarAlertasOFC(); } catch (_) {} }); } catch (_) {}
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
let _lobResuelto = null, _lobResolN = 0, _lobResolQ = '';   // contrato pegado que no esta en el feed: se resuelve en cadena
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
let _tab = 'vol', _repM = null;
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
  const mostrarRes = !base.length && esContrato(_busqueda) && _busqueda === _lobResolQ && !!_lobResuelto;
  if (mostrarRes) {
    host.innerHTML = bannerContrato();
    const ob = $('tm-res-open'); if (ob) ob.onclick = () => { const it = _lobResuelto; if (it && typeof it === 'object') { if (esGrande()) { seleccionarCP(it); verGrande(it); } else abrirFicha(it); } };
  } else {
    host.innerHTML = `<table class="tm-table tm-table-l">${theadLobby()}<tbody>${vis.map((it, i) => filaLobby(it, i)).join('')}</tbody></table>`
      + (ocultos || _verRojos ? `<div class="tm-ocultos">${ocultos ? ocultos + ' token' + (ocultos > 1 ? 's' : '') + ' hidden: Do not buy' : 'Showing Do not buy tokens'} <button type="button" id="tm-ver-rojos">${_verRojos ? 'Hide' : 'Show'}</button></div>` : '');
    const vr = $('tm-ver-rojos'); if (vr) vr.onclick = () => { _verRojos = !_verRojos; pintar(); };
    host.querySelectorAll('.tm-buybtn').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); const it = _items.find((x) => x.token.toLowerCase() === b.dataset.buy.toLowerCase()); if (it) { try { abrirCompra(it, auditoriaDe(it)); } catch (_) {} } }; });
    host.querySelectorAll('.tm-row').forEach((r) => { r.onclick = () => { const it = _items.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (!it) return; if (esGrande()) { seleccionarCP(it); verGrande(it); } else abrirFicha(it); }; });
    if (_sel) { const ar = host.querySelector(`.tm-row[data-a="${_sel.token}"]`); if (ar) ar.classList.add('sel'); }
  }
  cueReaplica(host);
  const faltan = vis.filter((x) => x.par).map((x) => x.token).filter((t) => !mercadoListo(t));
  if (faltan.length) cargarMercado(faltan).then(() => { clearTimeout(_repM); _repM = setTimeout(pintar, 60); }).catch(() => {});
  pintarWinner();
  pintarMovers();
  asegurarSelCP();
}
/* Resultado de buscar un CONTRATO que no esta en el feed: tarjeta con el token resuelto en cadena (o aviso). */
function bannerContrato() {
  const r = _lobResuelto;
  if (r === 'load') return `<div class="tm-res"><div class="tm-res-load"><i></i>Looking up this contract on-chain…</div></div>`;
  if (r === 'none' || !r || typeof r !== 'object') return `<div class="tm-res"><div class="tm-res-none"><b>No token found</b><span>Could not resolve this contract. Double-check the address (BSC 0x… or Tron T…).</span></div></div>`;
  const pu = usdDe(r); const liq = r.red === 'tron' ? 0 : (r.moneda === 'USDT' ? r.liquidez : r.liquidez * _bnbUsd);
  const redTxt = r.red === 'tron' ? 'Tron network' : (r.moneda || 'BNB') + ' pair';
  return `<div class="tm-res"><div class="tm-res-card">
      <div class="tm-res-tk">${logo(r.simbolo, r.token, r.red, r.logoUrl)}<div class="tm-res-id"><b title="${esc(r.nombre || '')}">${esc(abreviar(r.nombre || r.simbolo || 'Token'))} <i>(${esc(r.simbolo || '?')})</i></b><span>${esc(corto2(r.token))} · ${redTxt}</span></div></div>
      <div class="tm-res-m"><div><b>${pu > 0 ? '$' + fmtP(pu) : '—'}</b><span>Price</span></div><div><b>${liq > 0 ? money(liq) : '—'}</b><span>Liquidity</span></div></div>
      <button class="tm-b tm-res-open" id="tm-res-open" type="button">Open ${esc(r.simbolo || 'token')}</button>
    </div></div>`;
}
/* Tarjeta "Top movers" del lateral: los 3 tokens que mas suben (24h, datos reales); si aun no hay datos de
   mercado, los 3 de mayor liquidez. Rellena el hueco del lateral con algo util y clicable. */
/* El token que MAS sube ahora mismo, destacado arriba del lateral (sustituye al relleno "Terminal"). Toca -> Full
   Chart. Solo promociona ganadores reales (cambio24 > 0); si aun no hay datos, deja el texto "Scanning…". */
function winnerTok() {
  const con = _items.filter((x) => x.par && mercadoDe(x.token) && mercadoDe(x.token).cambio24 != null);
  if (!con.length) return null;
  const top = con.reduce((a, b) => (mercadoDe(b.token).cambio24 > mercadoDe(a.token).cambio24 ? b : a));
  return (mercadoDe(top.token).cambio24 > 0) ? top : null;
}
function pintarWinner() {
  const host = $('tm-winner'); if (!host) return;
  let w = null; try { w = wallet.cuentaActual(); } catch (_) {}
  if (!(esOwner(w) || activoEnCache(w))) {   // bloqueado: borroso + Unlock + precio + info (una sola vez; el bus lo abre al pagar en cualquier zona)
    if (!host.classList.contains('tg-zlk-host')) { bloquearZona(host, { bnbUsd: _bnbUsd, decoy: primeDecoy(), info: INFO_PRIME, onDesbloquear: pintarWinner }); estadoSuscripcion(w).then((s) => { if (s && s.activa) pintarWinner(); }).catch(() => {}); }
    return;
  }
  const recienAbierto = host.classList.contains('tg-zlk-host'); if (recienAbierto) host.classList.remove('tg-zlk-host');
  const it = winnerTok();
  if (!it) { if (recienAbierto) host.innerHTML = `<span class="tm-winner-ico">${bnbCoin()}</span><div class="tm-winner-main"><div class="tm-winner-top"><span class="tm-winner-lbl">Prime mover</span><b class="tm-winner-price"></b></div><div class="tm-winner-nm"><b>Scanning…</b></div><em class="tm-winner-chg muted">Finding the top gainer right now</em></div>`; return; }   // mantiene el placeholder hasta tener un ganador real
  const m = mercadoDe(it.token), chg = m.cambio24, pu = usdDe(it);
  const chgTxt = `${chg >= 0 ? '+' : ''}${Math.abs(chg) >= 100 ? chg.toFixed(0) : chg.toFixed(1)}%`;
  host.dataset.a = it.token;
  host.innerHTML = `<span class="tm-winner-ico">${logo(it.simbolo, it.token, it.red, it.logoUrl)}</span><div class="tm-winner-main"><div class="tm-winner-top"><span class="tm-winner-lbl">Prime mover</span><b class="tm-winner-price">${pu > 0 ? '$' + fmtP(pu) : '$0'}</b></div><div class="tm-winner-nm"><b title="${esc(it.nombre)}">${esc(abreviar(it.nombre))}</b><span>${esc(it.simbolo || '?')}</span></div><em class="tm-winner-chg tm-chg up">+${Math.abs(chg) >= 100 ? chg.toFixed(0) : chg.toFixed(1)}%</em></div>`;
  host.onclick = () => { const t = _items.find((x) => x.token.toLowerCase() === String(host.dataset.a || '').toLowerCase()); if (!t) return; try { esGrande() ? verGrande(t) : abrirFicha(t); } catch (_) {} };
}
/* Top movers: los 5 que mas suben (24h). El #1 ya sale arriba como "Prime mover", asi que aqui empieza en el #2
   y no se repite. Cantidad FIJA (5): llena el hueco que dejaba stats sin empujar ni deformar el resto. */
function pintarMovers() {
  const host = $('tm-movers'); if (!host) return;
  let wacc = null; try { wacc = wallet.cuentaActual(); } catch (_) {}
  if (!(esOwner(wacc) || activoEnCache(wacc))) {   // bloqueado: borroso + Unlock + precio + info (una sola vez)
    if (!host.classList.contains('tg-zlk-host')) { bloquearZona(host, { bnbUsd: _bnbUsd, decoy: moversDecoy(), info: INFO_MOVERS, onDesbloquear: pintarMovers }); estadoSuscripcion(wacc).then((s) => { if (s && s.activa) pintarMovers(); }).catch(() => {}); }
    return;
  }
  if (host.classList.contains('tg-zlk-host')) host.classList.remove('tg-zlk-host');
  const conDatos = _items.filter((x) => x.par && mercadoDe(x.token) && mercadoDe(x.token).cambio24 != null);
  let orden;
  if (conDatos.length >= 2) orden = conDatos.slice().sort((a, b) => mercadoDe(b.token).cambio24 - mercadoDe(a.token).cambio24);
  else orden = _items.filter((x) => x.par && x.liquidez > 0).sort((a, b) => b.liquidez - a.liquidez);
  const w = winnerTok(); const wkey = w ? w.token.toLowerCase() : null;
  const top = orden.filter((it) => !wkey || it.token.toLowerCase() !== wkey).slice(0, 5);
  if (!top.length) { host.innerHTML = ''; return; }
  host.innerHTML = `<div class="tm-movers-h">${ICO_TREND}<b>Top movers</b></div>` + top.map((it) => {
    const m = mercadoDe(it.token); const chg = m && m.cambio24 != null ? m.cambio24 : null; const pu = usdDe(it);
    const chgTxt = chg != null ? `<em class="tm-chg ${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '+' : ''}${Math.abs(chg) >= 100 ? chg.toFixed(0) : chg.toFixed(1)}%</em>` : '';
    return `<button class="tm-mover" type="button" data-a="${esc(it.token)}">${logo(it.simbolo, it.token)}<span class="tm-mover-id"><b title="${esc(it.nombre)}">${esc(abreviar(it.nombre))}</b><span>${esc(it.simbolo || '?')}</span></span><span class="tm-mover-px"><b>${pu > 0 ? '$' + fmtP(pu) : '$0'}</b>${chgTxt}</span></button>`;
  }).join('');
  host.querySelectorAll('.tm-mover').forEach((b) => { b.onclick = () => { const it = _items.find((x) => x.token.toLowerCase() === b.dataset.a.toLowerCase()); if (it) (esGrande() ? seleccionarCP(it) : abrirFicha(it)); }; });
}
/* Resumen de posicion activa junto a la campanita. Si hay posiciones, muestra la primera (simbolo + PnL% +
   valor) y al tocarla abre la grafica grande de ese token (donde se ven todas). Si no, "No active positions". */
function pintarPosWidget() {
  const host = $('tm-poswidget'); if (!host) return;
  const vacio = (txt) => { host.className = 'tm-poswidget empty'; host.disabled = true; host.onclick = null; host.innerHTML = `<span class="tm-pw-dot"></span>${txt || 'No active positions'}`; };
  let cuenta = null; try { cuenta = wallet.cuentaActual(); } catch (_) {}
  if (!cuenta) { vacio(); return; }
  let lista = []; try { lista = listaDe(cuenta) || []; } catch (_) {}
  if (!lista.length) { vacio(); return; }
  const pos = lista[0];
  enVivo(cuenta, pos, _bnbUsd).then((v) => {
    if (!v) { vacio(); return; }
    const pnl = Number(v.pnlPct) || 0, up = pnl >= 0;
    host.className = 'tm-poswidget'; host.disabled = false;
    host.innerHTML = `${logo(v.simbolo || pos.simbolo, v.token || pos.token)}<span class="tm-pw-id"><b>${esc(v.simbolo || pos.simbolo || '?')}</b><span>${lista.length > 1 ? lista.length + ' positions' : 'Position'}</span></span><span class="tm-pw-pnl ${up ? 'up' : 'down'}"><b>${up ? '+' : ''}${pnl.toFixed(1)}%</b><span>$${fmtP(v.valorUsd || 0)}</span></span>`;
    host.onclick = () => { const t = v.token || pos.token; const it = _items.find((x) => x.token.toLowerCase() === String(t).toLowerCase()) || { token: t, simbolo: v.simbolo || pos.simbolo, nombre: v.simbolo || pos.simbolo, decimales: 18, moneda: 'BNB', par: null, precio: 0 }; try { verGrande(it); } catch (_) {} };
  }).catch(() => vacio());
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
let _sel = null, _tfSec = 900, _velasRaw = null, _cpTok = '', _cpObs = null, _t0 = 0, _cpFuente = 'v2';
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
  const velas = _cpFuente === 'gecko' ? (_velasRaw || []) : agrupar(_velasRaw, _tfSec);   // gecko ya viene al timeframe pedido
  if (velas.length) { if (msg) msg.hidden = true; montarGrafico(cv, velas); }
  else { try { destruirGrafico(); } catch (_) {} if (msg) { msg.hidden = false; msg.textContent = _cpFuente === 'gecko' ? 'No chart data yet' : 'No trades yet'; } }
}
/* Lee las velas reales del par (una por operacion) y las guarda para reagrupar sin re-llamar.
   Si el par no da velas on-chain (V3 / otra DEX / sin Sync util), cae a GeckoTerminal -> casi cualquier
   token con par muestra grafico, igual que DexScreener. */
function cargarCP(it) {
  _cpTok = it.token; _velasRaw = null; _cpFuente = 'v2'; renderCP();
  if (!it.par) return;
  velasDeToken({ par: it.par, token: it.token, decToken: it.decimales || 18, decQuote: 18, bloque: it.bloque, bnbUsd: _bnbUsd, quoteEsUSDT: it.moneda === 'USDT' })
    .then((velas) => { if (_cpTok !== it.token) return; if (velas && velas.length) { _cpFuente = 'v2'; _velasRaw = velas; renderCP(); } else cargarCPGecko(it); })
    .catch(() => { if (_cpTok !== it.token) return; cargarCPGecko(it); });
}
/* Respaldo del grafico inline: GeckoTerminal (mismo formato de velas). Cubre lo que el metodo on-chain no alcanza. */
function cargarCPGecko(it) {
  import('./gecko.js').then(({ velasGecko }) => velasGecko(it.token, it.red, _tfSec))
    .then((velas) => { if (_cpTok !== it.token) return; _cpFuente = 'gecko'; _velasRaw = (velas && velas.length) ? velas : []; renderCP(); })
    .catch(() => { if (_cpTok !== it.token) return; _cpFuente = 'gecko'; _velasRaw = []; renderCP(); });
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
  const cand = _items.filter((x) => x.par && x.liquidez > 0);
  if (!cand.length) return;
  const vol = (x) => mNum(x.token, 'vol24') || 0;
  const conVol = cand.filter((x) => vol(x) > 0);
  // Por defecto el #1 por volumen (siempre tiene grafico y datos que mostrar); si aun no hay volumen, el mas liquido.
  const best = conVol.length ? conVol.reduce((a, b) => (vol(b) > vol(a) ? b : a)) : cand.reduce((a, b) => ((b.liquidez || 0) > (a.liquidez || 0) ? b : a));
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
let _railTok = '', _railMode = 'buy', _ccy = 'BNB', _bal = 0;
const fmtAmt = (n) => { n = Number(n) || 0; if (n <= 0) return '0'; return (n < 1 ? n.toFixed(6) : n.toFixed(4)).replace(/\.?0+$/, ''); };
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
      <div class="tm-trade-buytok" id="tm-trade-buytok">
        <div class="tm-trade-bt-cur" id="tm-trade-bt-cur">${logo(it.simbolo, it.token)}<span class="tm-trade-bt-tx"><em id="tm-trade-verb">Buying</em> <b title="${esc(it.nombre)}">${esc(abreviar(it.nombre))}</b> · ${esc(it.simbolo || '?')}</span><button class="tm-trade-change" id="tm-trade-change" type="button" title="Pick another token">${ICO_SEARCH}<span>Change</span></button></div>
        <div class="tm-trade-bt-find" id="tm-trade-bt-find" hidden><div class="tm-trade-bt-in"><span class="tm-trade-bt-ico">${ICO_SEARCH}</span><input id="tm-trade-ct" type="text" autocomplete="off" spellcheck="false" placeholder="Paste token contract (0x… or T…)"><button class="tm-trade-bt-x" id="tm-trade-ct-x" type="button" aria-label="Cancel">✕</button></div><div class="tm-trade-ct-res" id="tm-trade-ct-res"></div></div>
      </div>
      <div class="tm-trade-top"><span class="tm-trade-lbl">Amount</span><span class="tm-trade-bal" id="tm-bal">Balance: …</span></div>
      <div class="tm-trade-in"><input id="tm-amt" type="text" inputmode="decimal" autocomplete="off" value="0"><button class="tm-ccy" id="tm-ccy" type="button">${monedaCoin('BNB')}<b id="tm-ccy-t">BNB</b>${ICO_CHEV}</button></div>
      <div class="tm-slider"><input type="range" id="tm-slider" min="0" max="100" step="1" value="0"><div class="tm-slider-l"><span>0%</span><b id="tm-slider-v">0%</b><span>100%</span></div></div>
      <button class="tm-trade-go" id="tm-trade-go" type="button">Buy now</button>
      <div class="tm-trade-est">
        <div><span>Est. tokens</span><b id="tm-est-tok">~ …</b></div>
        <div><span>Est. price</span><b>${precioTxt}</b></div>
      </div>
    </div>
    <div class="tm-checks" id="tm-checks">
      <div class="tm-checks-h">${ICO_SHIELD}<b>Security checks</b></div>
      <div class="tm-checks-list" id="tm-checks-list">${checksSkeleton()}</div>
    </div>
    <div class="tm-acts">
      <div class="tm-acts-h"><b>Recent activity</b></div>
      <div class="tm-acts-list" id="tm-acts-list">${actsSkeleton()}</div>
    </div>`;
  const openb = $('tm-tc-open'); if (openb) openb.onclick = () => { try { verGrande(it); } catch (_) {} };
  // Cambiar la moneda del swap: barrita de busqueda INLINE por contrato. No abre el Full Chart ni borra el rail:
  // al elegir el token resuelto, re-monta este mismo panel (tarjeta + swap + checks + actividad) para esa moneda.
  const btCur = $('tm-trade-bt-cur'), btFind = $('tm-trade-bt-find'), btChg = $('tm-trade-change'), btIn = $('tm-trade-ct'), btX = $('tm-trade-ct-x'), btRes = $('tm-trade-ct-res');
  const abrirBtFind = () => { if (btCur) btCur.hidden = true; if (btFind) btFind.hidden = false; if (btRes) btRes.innerHTML = ''; if (btIn) { btIn.value = ''; btIn.focus(); } };
  const cerrarBtFind = () => { if (btFind) btFind.hidden = true; if (btCur) btCur.hidden = false; if (btRes) btRes.innerHTML = ''; };
  if (btChg) btChg.onclick = abrirBtFind;
  if (btX) btX.onclick = cerrarBtFind;
  if (btIn) {
    let nR = 0;
    const buscarTok = () => {
      const raw = (btIn.value || '').trim();
      if (!esContrato(raw)) { if (btRes) btRes.innerHTML = ''; return; }
      const mine = ++nR;
      if (btRes) btRes.innerHTML = `<div class="tm-trade-ct-load"><i></i>Looking up this contract…</div>`;
      resolverContrato(raw).then((nit) => {
        if (mine !== nR || _railTok !== it.token) return;
        if (!nit || typeof nit !== 'object') { if (btRes) btRes.innerHTML = `<div class="tm-trade-ct-none">No token found. Check the address (BSC 0x… or Tron T…).</div>`; return; }
        const pux = usdDe(nit); const redTxt = nit.red === 'tron' ? 'Tron' : (nit.moneda || 'BNB') + ' pair';
        btRes.innerHTML = `<button class="tm-trade-ct-tk" type="button">${logo(nit.simbolo, nit.token, nit.red, nit.logoUrl)}<span class="tm-trade-ct-id"><b title="${esc(nit.nombre || '')}">${esc(abreviar(nit.nombre || nit.simbolo || 'Token'))}</b><span>${esc(nit.simbolo || '?')} · ${redTxt}</span></span><span class="tm-trade-ct-px"><b>${pux > 0 ? '$' + fmtP(pux) : '—'}</b><em>Select</em></span></button>`;
        const pick = btRes.querySelector('.tm-trade-ct-tk'); if (pick) pick.onclick = () => { try { esGrande() ? seleccionarCP(nit) : abrirFicha(nit); } catch (_) {} };
      }).catch(() => { if (mine === nR && btRes) btRes.innerHTML = `<div class="tm-trade-ct-none">Could not resolve this contract. Try again.</div>`; });
    };
    btIn.oninput = buscarTok;
    btIn.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); buscarTok(); } else if (e.key === 'Escape') cerrarBtFind(); };
  }
  const amt = $('tm-amt'), estTok = $('tm-est-tok'), go = $('tm-trade-go'), tabs = $('tm-trade-tabs'), ccyBtn = $('tm-ccy'), slider = $('tm-slider'), sliderV = $('tm-slider-v'), balEl = $('tm-bal');
  // Importe tecleado -> USD (para estimar tokens o lo que recibes).
  const montoUsd = (v) => (_railMode === 'sell' ? v * usdDe(it) : (_ccy === 'USDT' ? v : v * _bnbUsd));
  const recalc = () => {
    const v = parseFloat((amt && amt.value) || '0') || 0;
    if (!estTok) return; const pu = usdDe(it);
    if (_railMode === 'buy') estTok.textContent = (v > 0 && pu > 0) ? '~ ' + numC(montoUsd(v) / pu) + ' ' + (it.simbolo || '') : '~ …';
    else estTok.textContent = (v > 0 && _bnbUsd > 0) ? '~ ' + fmtAmt(montoUsd(v) / (_ccy === 'USDT' ? 1 : _bnbUsd)) + ' ' + _ccy : '~ …';
  };
  // La barra 0-100% mueve el importe segun el saldo.
  const fillSlider = (pct) => { if (slider) slider.style.background = 'linear-gradient(90deg,#E8B84B ' + pct + '%,rgba(232,184,75,.15) ' + pct + '%)'; };
  const porPct = (pct) => { if (sliderV) sliderV.textContent = pct + '%'; fillSlider(pct); if (amt && _bal > 0) amt.value = fmtAmt(_bal * pct / 100); recalc(); };
  const syncSlider = () => { if (!slider) return; const v = parseFloat((amt && amt.value) || '0') || 0; const pct = _bal > 0 ? Math.max(0, Math.min(100, Math.round(v / _bal * 100))) : 0; slider.value = pct; if (sliderV) sliderV.textContent = pct + '%'; fillSlider(pct); };
  // Saldo real de la wallet (BNB, USDT, o el token si se vende). Si no hay wallet, lo dice.
  const cargarBalance = () => {
    if (!balEl) return;
    let cuenta = null; try { cuenta = wallet.cuentaActual(); } catch (_) {}
    if (!cuenta) { _bal = 0; balEl.textContent = 'Connect wallet'; return; }
    balEl.textContent = 'Balance: …';
    const quien = _railMode === 'sell' ? 'tok' : _ccy;
    const prom = _railMode === 'sell' ? saldoToken(it.token, cuenta) : (_ccy === 'USDT' ? saldoToken(USDT, cuenta) : saldoBNB(cuenta));
    prom.then((w) => {
      if (_railTok !== it.token) return;
      const dec = _railMode === 'sell' ? (it.decimales || 18) : 18;
      _bal = Number(ethers.formatUnits(w, dec));
      const unidad = _railMode === 'sell' ? (it.simbolo || '') : _ccy;
      balEl.textContent = 'Balance: ' + fmtAmt(_bal) + ' ' + unidad;
      syncSlider();
    }).catch(() => { if (_railTok === it.token) { _bal = 0; balEl.textContent = 'Balance: —'; } });
  };
  const pintarCcy = () => {
    if (!ccyBtn) return;
    if (_railMode === 'sell') { ccyBtn.innerHTML = `${logo(it.simbolo, it.token)}<b>${esc(it.simbolo || '?')}</b>`; ccyBtn.classList.add('fixed'); }
    else { ccyBtn.innerHTML = `${monedaCoin(_ccy)}<b id="tm-ccy-t">${_ccy}</b>${ICO_CHEV}`; ccyBtn.classList.remove('fixed'); }
  };
  if (amt) amt.oninput = () => { recalc(); syncSlider(); };
  if (slider) slider.oninput = () => porPct(Number(slider.value) || 0);
  if (ccyBtn) ccyBtn.onclick = () => { if (_railMode !== 'buy') return; _ccy = _ccy === 'BNB' ? 'USDT' : 'BNB'; pintarCcy(); if (amt) amt.value = '0'; if (slider) slider.value = 0; cargarBalance(); recalc(); };
  if (tabs) tabs.querySelectorAll('button').forEach((b) => { b.onclick = () => {
    _railMode = b.dataset.m; tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    const verb = $('tm-trade-verb'); if (verb) verb.textContent = _railMode === 'sell' ? 'Selling' : 'Buying';
    if (go) { go.textContent = _railMode === 'sell' ? 'Sell now' : 'Buy now'; go.classList.toggle('sell', _railMode === 'sell'); }
    pintarCcy(); if (amt) amt.value = '0'; if (slider) slider.value = 0; if (sliderV) sliderV.textContent = '0%'; cargarBalance(); recalc();
  }; });
  if (go) go.onclick = () => { try {
    abrirCompra(it, auditoriaDe(it), _railMode === 'sell' ? 'sell' : 'buy');
    const v = parseFloat((amt && amt.value) || '0') || 0;
    let pre = v; if (_railMode === 'buy' && _ccy === 'USDT' && _bnbUsd > 0) pre = v / _bnbUsd;   // la ventana paga en BNB
    if (pre > 0) setTimeout(() => { const mi = document.getElementById('tmc-amt'); if (mi) { mi.value = fmtAmt(pre); mi.dispatchEvent(new Event('input', { bubbles: true })); } }, 80);
  } catch (_) {} };
  pintarCcy(); cargarBalance(); recalc();
  try { cargarMercado([it.token]).then(() => updateRailStats(it)).catch(() => {}); } catch (_) {}
  montarChecksRail(it);
  montarActsRail(it);
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
  const d = (r && r.datos) ? r.datos : {};
  const c = d.checks || null;
  const fila = (estado, label, val) => `<div class="tm-check ${estado}"><span class="tm-check-l"><i>${estado === 'ok' ? ICO_CHECK : estado === 'no' ? '✕' : '○'}</i>${label}</span><b>${val}</b></div>`;
  if (c) {
    // GoPlus indexo el token: verdictos completos (incluye honeypot e impuestos simulados).
    const lp = d.lpAsegurada != null ? Math.round(d.lpAsegurada) + '%' : (c.lpSecured ? 'Yes' : 'No');
    const t10 = d.top10Pct != null ? 'Top10 ' + Math.round(d.top10Pct) + '%' : null;
    host.innerHTML =
      fila(c.sellable ? 'ok' : 'no', 'No honeypot', c.sellable ? 'Sellable' : 'Risky') +
      fila(c.lpSecured ? 'ok' : 'no', 'Liquidity burned', lp) +
      fila(c.renounced ? 'ok' : 'no', 'Ownership renounced', c.renounced ? 'Yes' : 'No') +
      fila(c.notConcentrated ? 'ok' : 'no', 'Token distribution', t10 || (c.notConcentrated ? 'Healthy' : 'Concentrated'));
  } else {
    // GoPlus AUN no indexo el token: NO inventar fallos. Antes aqui salian 4 X falsas ("No honeypot -> Risky",
    // "Ownership renounced -> No") para un token que nunca se escaneo, justo lo CONTRARIO a lo que muestra el
    // Full Chart del mismo token. Mostramos lo que SI se lee en cadena y dejamos honeypot/impuestos "Scan pending".
    const hall = (r && r.hallazgos) || [];
    const ren = hall.some((h) => h.t === 'Ownership renounced') ? 'ok' : (hall.some((h) => h.n === 'warn' && /owner/i.test(h.t)) ? 'no' : 'pend');
    const lpv = d.lpAsegurada != null ? Math.round(d.lpAsegurada) : null;
    const t10v = d.top10Pct != null ? Math.round(d.top10Pct) : null;
    host.innerHTML =
      fila('pend', 'No honeypot', 'Scan pending') +
      fila(lpv != null ? (lpv >= 90 ? 'ok' : 'no') : 'pend', 'Liquidity burned', lpv != null ? lpv + '%' : 'Scan pending') +
      fila(ren, 'Ownership renounced', ren === 'ok' ? 'Yes' : ren === 'no' ? 'No' : 'Scan pending') +
      fila(t10v != null ? (t10v >= 70 ? 'no' : 'ok') : 'pend', 'Token distribution', t10v != null ? 'Top10 ' + t10v + '%' : 'Scan pending');
  }
  const bdg = verifBadge(r); const vb = $('tm-tc-verif'); if (vb) vb.innerHTML = bdg; const vc = $('tm-cp-verif'); if (vc) vc.innerHTML = bdg;
}
/* Security Check del lobby con candado de suscripcion. Por defecto BLOQUEADO: borroso + candado + boton Unlock
   (el MISMO de candado.js), montado dentro de la lista; la cabecera "Security checks" del rail se mantiene.
   La auditoria real NO corre bloqueada -> los datos reales NUNCA entran al DOM (quitar el blur por F12 solo
   revela el señuelo). Owner o suscrito: se abre y corre la auditoria real. Via el bus de candado.js, pagar en
   CUALQUIER sitio lo abre al instante SIN recargar; y como el pago queda en cache, al elegir otro token sigue
   desbloqueado (sin parpadeo). */
const INFO_CHECKS = 'The full security report: live honeypot and tax simulation, liquidity lock, ownership and holder distribution. Hidden until you unlock the plan.';
const INFO_ACTS = 'Recent real buys and sells on this pair, so you can read momentum and who is trading before you ape in.';
const INFO_PRIME = 'Prime Mover is the single biggest gainer on BNB Chain at this exact moment, updated live — the one coin moving hardest right now, so you can see it before everyone else does. Unlocking the Terminal plan ($2.50/month) turns on this and the whole Terminal: live scanner, security checks, charts and price alerts. We promise no gains — only the information, early.';
const INFO_MOVERS = 'Top Movers ranks the coins pumping hardest over the last 24 hours, refreshed live, so you spot momentum early instead of chasing it late. It is part of the Terminal plan: $2.50/month unlocks everything in the Terminal. No profit is promised — just a faster, clearer read of the market.';
/* Señuelo del Security Check: 4 filas de ejemplo con el mismo formato (NUNCA datos reales). */
const checksDecoy = () => {
  const f = (estado, label, val) => `<div class="tm-check ${estado}"><span class="tm-check-l"><i>${estado === 'ok' ? ICO_CHECK : '✕'}</i>${label}</span><b>${val}</b></div>`;
  return f('ok', 'No honeypot', 'Sellable') + f('ok', 'Liquidity burned', '100%') + f('ok', 'Ownership renounced', 'Yes') + f('ok', 'Token distribution', 'Healthy');
};
/* Señuelo de Recent Activity: 5 operaciones de ejemplo (NUNCA datos reales). */
const actsDecoy = () => {
  const rows = [['buy', '0x7a…9b', 'Bought', '1.2', 'BNB', '2m'], ['buy', '0x18…0f', 'Bought', '850', 'USDT', '4m'], ['sell', '0x3c…e5', 'Sold', '0.4', 'BNB', '6m'], ['buy', '0x9d…71', 'Bought', '3.1', 'BNB', '9m'], ['buy', '0xa2…c4', 'Bought', '420', 'USDT', '12m']];
  return rows.map(([tipo, who, verbo, amt, mon, t]) => `<div class="tm-act"><span class="tm-act-who"><i class="tm-act-dot ${tipo}"></i>${who}</span><span class="tm-act-mid ${tipo}">${verbo} ${amt} ${mon}</span><span class="tm-act-t">${t}</span></div>`).join('');
};
/* Señuelos (borrosos) para Prime Mover y Top Movers: NUNCA datos reales, solo para que se vea que hay algo
   valioso detras del candado. Mismas clases que el contenido real para que el blur luzca autentico. */
const primeDecoy = () => `<span class="tm-winner-ico">${bnbCoin()}</span><div class="tm-winner-main"><div class="tm-winner-top"><span class="tm-winner-lbl">Prime mover</span><b class="tm-winner-price">$0.0<sub>4</sub>2471</b></div><div class="tm-winner-nm"><b>Top Gainer</b><span>WINR</span></div><em class="tm-winner-chg tm-chg up">+312%</em></div>`;
const moversDecoy = () => `<div class="tm-movers-h">${ICO_TREND}<b>Top movers</b></div>` + [['Alpha', 'ALPHA', '+248%'], ['Rocket', 'RKT', '+176%'], ['Nova', 'NOVA', '+131%'], ['Pulse', 'PLS', '+98%'], ['Vertex', 'VRTX', '+72%']].map(([nm, s, c]) => `<div class="tm-mover"><span class="tm-mover-ico"></span><span class="tm-mover-id"><b>${nm}</b><span>${s}</span></span><span class="tm-mover-px"><b>$0.0<sub>3</sub>84</b><em class="tm-chg up">${c}</em></span></div>`).join('');
/* Security Check del lobby con candado LIGERO: MANTIENE el tamaño de la ventana (borroso + boton + info); no
   estira el layout. La auditoria real NO corre bloqueada -> datos reales nunca entran al DOM. Owner/suscrito:
   real. Conectado al bus: pagar en cualquier sitio lo abre al instante, sin recargar. */
function desbloquearChecksRail(it) {
  const host = $('tm-checks-list'); if (!host || !host.isConnected || _railTok !== it.token) return;
  host.classList.remove('tg-zlk-host'); host.innerHTML = checksSkeleton();
  cargarChecks(it);
}
function montarChecksRail(it) {
  const host = $('tm-checks-list'); if (!host) return;
  let w = null; try { w = wallet.cuentaActual(); } catch (_) {}
  if (esOwner(w) || activoEnCache(w)) { desbloquearChecksRail(it); return; }
  bloquearZona(host, { bnbUsd: _bnbUsd, decoy: checksDecoy(), info: INFO_CHECKS, onDesbloquear: () => desbloquearChecksRail(it) });
  estadoSuscripcion(w).then((sub) => { if (sub && sub.activa) desbloquearChecksRail(it); }).catch(() => {});
}
/* Recent Activity del lobby con el MISMO candado ligero + boton de info. Mismo bus de desbloqueo. */
function desbloquearActsRail(it) {
  const host = $('tm-acts-list'); if (!host || !host.isConnected || _railTok !== it.token) return;
  host.classList.remove('tg-zlk-host'); host.innerHTML = actsSkeleton();
  cargarActividad(it);
}
function montarActsRail(it) {
  const host = $('tm-acts-list'); if (!host) return;
  let w = null; try { w = wallet.cuentaActual(); } catch (_) {}
  if (esOwner(w) || activoEnCache(w)) { desbloquearActsRail(it); return; }
  bloquearZona(host, { bnbUsd: _bnbUsd, decoy: actsDecoy(), info: INFO_ACTS, onDesbloquear: () => desbloquearActsRail(it) });
  estadoSuscripcion(w).then((sub) => { if (sub && sub.activa) desbloquearActsRail(it); }).catch(() => {});
}
function cargarChecks(it) {
  const yo = auditoriaDe(it);
  // Solo reusa cache COMPLETA: con la rapida los datos de holders/concentracion llegan vacios y marcaba X
  // en todo (era la incongruencia entre este panel y el de Full Chart). Pide auditoria completa, como alla.
  if (yo && yo.nivel !== 'pend' && yo.completo) { pintaChecks(it, yo); return; }
  auditarCache(it, null, true).then((r) => pintaChecks(it, r)).catch(() => { if (_railTok === it.token) { const h = $('tm-checks-list'); if (h) h.innerHTML = `<div class="tm-check pend"><span class="tm-check-l">Checks unavailable</span><b></b></div>`; } });
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
    const gecko = () => import('./gecko.js').then(({ velasGecko }) => velasGecko(it.token, it.red, _tfSec))
      .then((velas) => { if (!ov.isConnected) return; if (velas && velas.length && cv) { if (msg) msg.hidden = true; montarGrafico(cv, velas); } else if (msg) { msg.innerHTML = 'No chart data yet'; } })
      .catch(() => { if (msg && ov.isConnected) msg.innerHTML = 'Chart unavailable'; });
    velasDeToken({ par: it.par, token: it.token, decToken: it.decimales || 18, decQuote: 18, bloque: it.bloque, bnbUsd: _bnbUsd, quoteEsUSDT: it.moneda === 'USDT' })
      .then((velas) => {
        if (!ov.isConnected) return;
        if (velas && velas.length && cv) { if (msg) msg.hidden = true; montarGrafico(cv, velas); }
        else gecko();
      })
      .catch(() => gecko());
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
    host.querySelectorAll('.tm-al-x').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); quitarAlerta(b.dataset.id); pintarAlertas(); try { pintarBell(); } catch (_) {} }; });
  };
  const alIn = $('tm-al-in'), alAdd = $('tm-al-add');
  if (alAdd && alIn) {
    pintarAlertas();
    const poner = () => {
      const v = parseFloat(String(alIn.value).replace(/[, $]/g, '')); if (!(v > 0)) { alIn.focus(); return; }
      const ref = precioUsd > 0 ? precioUsd : 0;
      const dir = ref > 0 ? (v >= ref ? 'up' : 'down') : 'up';
      crearAlerta(it, v, dir); alIn.value = ''; pintarAlertas(); try { pintarBell(); } catch (_) {}
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
  sem.innerHTML = `<span class="tm-sem-ico">${ICO_N[r.nivel]}</span><div><b>${sinCadena ? 'Analyzing…' : sinDatos ? 'Live diagnosis' : TXT_NIVEL[r.nivel]}</b><span>${sinCadena ? 'No source answered yet. Reopen the token to retry.' : sinDatos ? 'Read live from the chain below.' : sub}</span></div>` + (sinCadena && reintentar ? '<button class="tm-sem-retry" type="button" id="tm-sem-retry">Retry</button>' : '');
  const rb = $('tm-sem-retry'); if (rb && reintentar) rb.onclick = reintentar;
  const d = r.datos || {};
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  // Terminada la comprobacion, lo que no se sabe se muestra como 0 (nunca un guion ni un hueco).
  set('tm-k-hold', (d.holders != null ? (d.holdersEstimado ? '~' : '') + Number(d.holders).toLocaleString('en-US') : '0') + (d.txs != null ? ' (' + Number(d.txs).toLocaleString('en-US') + ' txs)' : ''));
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
  // Quita la nota 'info' ("Scanner data not available yet"): la cabecera ya dice que el escaner esta pendiente,
  // y mostrarla DENTRO de la lista junto a hallazgos reales era la contradiccion "muestra datos pero dice que
  // no hay datos" (igual que ya hace el Full Chart, que la filtra).
  ul.innerHTML = (r.hallazgos || []).filter((x) => x.n !== 'info').map((x) => `<li class="${x.n}"><span class="tm-h-ico">${ICO_N[x.n] || ICO_INFO}</span><div><b>${esc(x.t)}</b><span>${esc(x.d || '')}</span></div></li>`).join('');
}

/* ───────── Mis posiciones (no custodial: registradas en el navegador al comprar por el Terminal) ───────── */
const sg = (v) => (v >= 0 ? '+' : '-'), cl = (v) => (v >= 0 ? 'up' : 'down');
const cargando = '<div class="tm-pos-msg"><span class="tm-anillo"></span></div>';
export async function abrirPanel(tab = 'positions') {
  const prev = $('tm-pos-ov'); if (prev) prev.remove();
  const ov = document.createElement('div'); ov.id = 'tm-pos-ov'; ov.className = 'tm-ov';
  ov.innerHTML = `<div class="tm-ficha tm-pos-card" role="dialog" aria-modal="true">
    <div class="tm-f-head"><div class="tm-f-tx"><b>My Terminal</b><span>Your tokens, verifications, alerts and history · your wallet, your keys</span></div><button class="tm-f-x" type="button" aria-label="Close">✕</button></div>
    <div class="tm-tabs" id="tm-tabs"><button type="button" data-t="positions">My tokens</button><button type="button" data-t="verif">Verifications</button><button type="button" data-t="alerts">Alerts</button><button type="button" data-t="history">History</button><button type="button" data-t="watch">Watchlist</button></div>
    <div class="tm-pos-body" id="tm-pos-body">${cargando}</div>
    <p class="tm-f-note" id="tm-pos-note"></p>
  </div>`;
  document.body.appendChild(ov);
  const cerrar = () => { try { ov.remove(); } catch (_) {} };
  ov.querySelector('.tm-f-x').onclick = cerrar;
  ov.addEventListener('click', (e) => { if (e.target === ov) cerrar(); });
  const body = $('tm-pos-body'), note = $('tm-pos-note'), tabs = $('tm-tabs');
  const vivo = () => ov.isConnected;
  let _alSel = null;
  const abrirDe = (o) => { cerrar(); abrirFicha(itMin(o)); };
  const ir = (t) => { tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); body.innerHTML = cargando; if (t === 'watch') renderWatch(); else if (t === 'alerts') renderAlertas(); else if (t === 'verif') renderVerif(); else if (t === 'history') renderHistory(); else renderPositions(); };
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

  function renderAlertas() {
    note.textContent = 'Alerts watch the price while the Terminal is open and notify you when your target is hit. They are not orders and never touch your funds.';
    try { marcarVistas(); } catch (_) {}
    try { pintarBell(); } catch (_) {}
    _alSel = null;
    body.innerHTML = `<div class="tm-alnew">
        <div class="tm-alnew-h">New price alert</div>
        <div class="tm-alnew-ctl">
          <div class="tm-alnew-pick"><input id="tm-alnew-q" class="tm-alnew-q" type="text" placeholder="Name or paste a contract…" autocomplete="off" spellcheck="false"><div class="tm-alnew-drop" id="tm-alnew-drop" hidden></div></div>
          <input id="tm-alnew-px" class="tm-alnew-px" type="text" inputmode="decimal" placeholder="Target $" disabled>
          <button id="tm-alnew-add" class="tm-b sec tm-alnew-add" type="button" disabled>Set</button>
        </div>
        <div class="tm-alnew-hint" id="tm-alnew-hint">A token is its contract, not its name. Paste the contract to pick the exact one.</div>
      </div>
      <div id="tm-al-listwrap" class="tm-al-listwrap">${cargando}</div>`;
    const q = $('tm-alnew-q'), drop = $('tm-alnew-drop'), pxIn = $('tm-alnew-px'), addB = $('tm-alnew-add'), hint = $('tm-alnew-hint');
    const fuente = () => { const seen = new Set(), out = []; for (const it of _items) { if (!it.par) continue; const k = it.token.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(it); } return out; };
    const cerrarDrop = () => { if (drop) drop.hidden = true; };
    let _alResolN = 0;
    const optHTML = (it) => { const pu = usdDe(it); return `<button class="tm-alnew-opt" type="button" data-a="${esc(it.token)}">${logo(it.simbolo, it.token)}<span class="tm-alnew-oid"><b>${esc(it.simbolo || '?')}</b><span>${esc(abreviar(it.nombre || ''))} · ${esc(corto2(it.token))}</span></span><span class="tm-alnew-opx">${pu > 0 ? '$' + fmtP(pu) : '—'}</span></button>`; };
    const wireOpts = (resuelto) => { drop.querySelectorAll('.tm-alnew-opt').forEach((b) => { b.onclick = () => { const a = b.dataset.a; let it = _items.find((x) => x.token.toLowerCase() === a.toLowerCase()); if (!it && resuelto && resuelto.token.toLowerCase() === a.toLowerCase()) it = resuelto; if (it) elegir(it); }; }); };
    const pintarDrop = (txt) => {
      const raw = (txt || '').trim();
      if (esContrato(raw)) {
        const enFeed = fuente().find((it) => it.token.toLowerCase() === raw.toLowerCase());
        if (enFeed) { drop.innerHTML = optHTML(enFeed); drop.hidden = false; wireOpts(); return; }
        const mine = ++_alResolN;
        drop.innerHTML = `<div class="tm-alnew-none">Looking up contract…</div>`; drop.hidden = false;
        resolverContrato(raw).then((it) => {
          if (mine !== _alResolN || !drop.isConnected) return;
          if (!it) { drop.innerHTML = `<div class="tm-alnew-none">No PancakeSwap pair found for this contract.</div>`; drop.hidden = false; return; }
          drop.innerHTML = optHTML(it); drop.hidden = false; wireOpts(it);
        }).catch(() => { if (mine === _alResolN && drop.isConnected) { drop.innerHTML = `<div class="tm-alnew-none">Could not look up this contract.</div>`; drop.hidden = false; } });
        return;
      }
      const t = raw.toLowerCase();
      let arr = fuente();
      if (t) arr = arr.filter((it) => (it.simbolo || '').toLowerCase().includes(t) || (it.nombre || '').toLowerCase().includes(t) || (it.token || '').toLowerCase().includes(t));
      arr = arr.slice(0, 7);
      if (!arr.length) { drop.innerHTML = `<div class="tm-alnew-none">No tokens match. Paste a contract to search any token.</div>`; drop.hidden = false; return; }
      drop.innerHTML = arr.map((it) => optHTML(it)).join('');
      drop.hidden = false; wireOpts();
    };
    const refDir = () => {
      if (!_alSel) { addB.disabled = true; return; }
      const pu = usdDe(_alSel); const v = parseFloat(String(pxIn.value || '').replace(/,/g, '')) || 0;
      addB.disabled = !(v > 0);
      if (v > 0 && pu > 0) { const dir = v >= pu ? 'up' : 'down'; hint.innerHTML = `Now <b>$${fmtP(pu)}</b> · fires when price goes ${dir === 'up' ? '≥' : '≤'} <b>$${fmtP(v)}</b>.`; }
    };
    const elegir = (it) => {
      _alSel = it; const pu = usdDe(it);
      q.value = it.simbolo || '?'; cerrarDrop();
      pxIn.disabled = false; pxIn.value = pu > 0 ? String(fmtP(pu)).replace(/0\.0<sub>(\d+)<\/sub>/, (m, z) => '0.' + '0'.repeat(+z)) : '';
      hint.innerHTML = pu > 0 ? `Now <b>$${fmtP(pu)}</b>. Set a target above or below.` : 'Type the target price for this token.';
      refDir(); try { pxIn.focus(); pxIn.select(); } catch (_) {}
    };
    const crear = () => {
      if (!_alSel) return;
      const pu = usdDe(_alSel); const v = parseFloat(String(pxIn.value || '').replace(/,/g, '')) || 0;
      if (!(v > 0)) { try { pxIn.focus(); } catch (_) {} return; }
      const dir = v >= pu ? 'up' : 'down';
      try { crearAlerta(_alSel, v, dir); } catch (_) {}
      _alSel = null; q.value = ''; pxIn.value = ''; pxIn.disabled = true; addB.disabled = true;
      hint.textContent = 'Alert set. It fires while the Terminal is open.';
      pintarListaAl(); try { pintarBell(); } catch (_) {}
    };
    if (q) { q.oninput = () => { _alSel = null; pxIn.disabled = true; pxIn.value = ''; addB.disabled = true; pintarDrop(q.value); }; q.onfocus = () => { if (!_alSel) pintarDrop(q.value); }; q.onblur = () => setTimeout(cerrarDrop, 160); }
    if (pxIn) { pxIn.oninput = refDir; pxIn.onkeydown = (e) => { if (e.key === 'Enter') crear(); }; }
    if (addB) addB.onclick = crear;
    pintarListaAl();
  }

  async function pintarListaAl() {
    const wrap = $('tm-al-listwrap'); if (!wrap) return;
    const l = listaAlertas();
    if (!l.length) { wrap.innerHTML = `<div class="tm-al-empty"><span>No alerts yet. Pick a token above, or set one from any token's chart.</span></div>`; return; }
    const activas = l.filter((a) => !a.disparada), disp = l.filter((a) => a.disparada);
    const fila = (a, now) => `<div class="tm-pos-row tm-al-row ${a.disparada ? 'done' : ''}" data-a="${esc(a.token)}">
        <div class="tm-pos-tk">${logo(a.simbolo, a.token)}<div class="tm-pos-nm"><b>${esc(a.simbolo || '?')}</b><span>${a.disparada ? 'hit' : 'fires'} ${a.dir === 'up' ? '≥' : '≤'} $${fmtP(a.objetivo)}</span></div></div>
        <div class="tm-pos-val"><b>${now > 0 ? '$' + fmtP(now) : '—'}</b><span class="tm-al-when ${a.disparada ? 'done' : ''}">${a.disparada ? 'hit ' + hace(a.cuando || a.creada) + ' ago' : 'now'}</span></div>
        <button class="tm-pos-x" type="button" data-f="${esc(a.id)}" title="Remove alert">✕</button></div>`;
    let html = '';
    if (activas.length) html += `<div class="tm-al-sec"><span>Active</span></div>` + activas.map((a) => fila(a, 0)).join('');
    if (disp.length) html += `<div class="tm-al-sec"><span>Triggered</span><button class="tm-al-clear" id="tm-al-clear" type="button">Clear</button></div>` + disp.map((a) => fila(a, a.precioDisparo || 0)).join('');
    wrap.innerHTML = html;
    wrap.querySelectorAll('.tm-pos-x').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); quitarAlerta(b.dataset.f); pintarListaAl(); try { pintarBell(); } catch (_) {} }; });
    wrap.querySelectorAll('.tm-al-row').forEach((r) => { r.onclick = (e) => { if (e.target.closest('.tm-pos-x')) return; const a = l.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (a) abrirDe(a); }; });
    const clr = $('tm-al-clear'); if (clr) clr.onclick = () => { listaAlertas().filter((a) => a.disparada).forEach((a) => quitarAlerta(a.id)); pintarListaAl(); try { pintarBell(); } catch (_) {} };
    const act = activas.filter((a) => a.par);
    if (act.length) {
      const porToken = {}; for (const a of act) porToken[a.token.toLowerCase()] = a;
      const precios = {};
      await Promise.all(Object.values(porToken).map(async (a) => { precios[a.token.toLowerCase()] = await precioActual({ par: a.par, token: a.token, decToken: a.decimales || 18, decQuote: 18, bnbUsd: _bnbUsd, quoteEsUSDT: a.moneda === 'USDT' }).catch(() => 0); }));
      if (!vivo() || !wrap.isConnected) return;
      wrap.querySelectorAll('.tm-al-row').forEach((r) => { if (r.classList.contains('done')) return; const a = activas.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (!a) return; const now = precios[a.token.toLowerCase()] || 0; const bEl = r.querySelector('.tm-pos-val b'); if (bEl) bEl.innerHTML = now > 0 ? '$' + fmtP(now) : '—'; });   // innerHTML: fmtP trae <sub> para precios diminutos; con textContent salian las etiquetas literales
    }
  }

  function renderVerif() {
    note.textContent = 'Tokens in the current feed that cleared every security check. Checks read live from the chain; always do your own research.';
    const items = _items.slice();
    const ok = items.map((it) => ({ it, r: auditoriaDe(it) })).filter((x) => x.r && x.r.nivel === 'ok');
    if (!ok.length) { const pend = items.some((it) => !auditoriaDe(it)); body.innerHTML = `<div class="tm-pos-empty"><b>No verified tokens yet</b><span>${pend ? 'Security checks are still running on the current pairs. Give it a moment.' : 'None of the current pairs cleared every check.'}</span></div>`; return; }
    ok.sort((a, b) => (b.it.liquidez || 0) - (a.it.liquidez || 0));
    body.innerHTML = ok.map(({ it, r }) => { const c = (r.datos && r.datos.checks) || {}; const keys = Object.keys(c); const passed = keys.filter((k) => c[k]).length; const total = keys.length || 10; const pu = usdDe(it); return `<div class="tm-pos-row tm-verif-row" data-a="${esc(it.token)}">
        <div class="tm-vrow-tk">${logo(it.simbolo, it.token)}<span class="tm-vrow-nm"><b>${esc(abreviar(it.nombre || ''))}</b><i>(${esc(it.simbolo || '?')})</i></span></div>
        <span class="tm-vchk">${ICO_VERIF} ${passed}/${total} checks</span>
        <b class="tm-vrow-px">${pu > 0 ? '$' + fmtP(pu) : '$0'}</b></div>`; }).join('');
    body.querySelectorAll('.tm-pos-row').forEach((row) => { row.onclick = () => { const x = ok.find((o) => o.it.token.toLowerCase() === row.dataset.a.toLowerCase()); if (!x) return; cerrar(); try { if (esGrande()) { seleccionarCP(x.it); verGrande(x.it); } else abrirFicha(x.it); } catch (_) {} }; });
  }

  async function renderHistory() {
    note.textContent = 'Every buy and sell you make through the Terminal, kept in your browser only. It never leaves your device.';
    const cuenta = wallet.cuentaActual();
    if (!cuenta) { body.innerHTML = `<div class="tm-pos-empty"><b>Connect your wallet</b><span>Your Terminal trade history will show here.</span><button class="tm-b" id="tm-pos-conn" type="button">Connect wallet</button></div>`; const bc = $('tm-pos-conn'); if (bc) bc.onclick = async () => { try { await wallet.conectar(); } catch (_) {} if (vivo()) ir('history'); }; return; }
    const l = historialDe(cuenta);
    if (!l.length) { body.innerHTML = `<div class="tm-pos-empty"><b>No operations yet</b><span>Buy or sell a token from the Terminal and it shows up here with the time and amount.</span></div>`; return; }
    body.innerHTML = l.map((h) => `<div class="tm-pos-row tm-hist-row ${h.side === 'sell' ? 'sell' : 'buy'}" data-a="${esc(h.token)}">
        <div class="tm-pos-tk">${logo(h.simbolo, h.token)}<div class="tm-pos-nm"><b>${esc(h.simbolo || '?')}</b><span><em class="tm-hist-side ${h.side === 'sell' ? 'sell' : 'buy'}">${h.side === 'sell' ? 'Sold' : 'Bought'}</em> ${numC(h.cant)}</span></div></div>
        <div class="tm-pos-val"><b>${h.side === 'buy' && h.usd > 0 ? money(h.usd) : ''}</b><span>${hace(h.ts)} ago</span></div></div>`).join('');
    body.querySelectorAll('.tm-pos-row').forEach((r) => { r.onclick = () => { const h = l.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (h) abrirDe(h); }; });
  }

  ir(tab);
}
