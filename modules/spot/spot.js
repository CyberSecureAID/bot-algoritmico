/* modules/spot/spot.js — "Spot".

   Módulo clonado de Trading Demo y convertido a SPOT real (no custodial). Misma
   gráfica (LightweightCharts), mismas órdenes limit, alertas, TP/SL arrastrables,
   operación abierta y tarjeta por operación. Diferencias del spot:
   · Sin apalancamiento y sin precio de liquidación.
   · El saldo es el REAL de la wallet conectada (total + desglose por activo),
     leído con saldosTodas() de la plataforma. Nada se custodia.
   · LONG gana en USDT; SHORT vende la moneda base y gana en la MONEDA al bajar.
   · Sin marca "demo". How It Works es un stepper para principiantes.
   Cableado no custodial listo para el futuro smart contract (los disparos de
   onPrecio() reproducen lo que ejecutará el contrato, anti gap). Datos de Binance
   SPOT por el espejo (feed-shim en spot.html), según CLAUDE.md.

   Autónomo: datos, motor y gráfica propios en modules/spot/. Reutiliza sin
   modificar lo compartido: catálogo de monedas, logos, barra de dibujo y wallet. */

import { estilos } from './estilos.js?v=21';
import * as D from './datos.js?v=12';
import * as M from './motor.js?v=15';
import { montarBarra } from '../../assets/js/niveles/barra.js?v=7';
import { N as NIV } from '../../assets/js/niveles/estado.js?v=1';
import { cuentaActual, saldosTodas, alCambiar, reconectarSiProcede } from '../../assets/js/wallet.js?v=129';
import { MONEDAS } from '../../assets/js/tokens.js';
import { LOGOS_SPOT } from './logos.js?v=1';

const LIB = new URL('./vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const LOGO_ALT = new URL('../../assets/img/cco-full.webp', import.meta.url).href;
const SELLO = new URL('../../assets/img/cco-sello.webp', import.meta.url).href;      // marca de agua grande (como futuros)
const IMG_LONG = new URL('../../assets/portada/img/long.webp', import.meta.url).href;  // fondo tarjeta long (el de futuros)
const IMG_SHORT = new URL('../../assets/portada/img/short.webp', import.meta.url).href; // fondo tarjeta short

const S = {
  par: null, tf: '1d', velas: [], velasDib: [], chart: null, serieVela: null,
  mark: 0, open24: 0, high24: 0, low24: 0, vol24: 0, chgPct: 0,
  side: null, pagar: 'USDT',
  lev: 1, cap: 0, tam: 0, modo: 'market', limitPx: 0, histPage: 0,
  tpUnit: 'px', slUnit: 'px', sumOpen: false, alertas: [], _alMark: 0,
  stream: null, barra: null, dibMontada: false, lineaLimit: null, tab: 'pos',
  uiRAF: null, onResize: null, cvObs: null, marks: {}, logos: {},
  drag: null, hoverH: null, ac: null, expand: false,
  saldos: {}, precios: {}, walletOn: false, cuenta: null
};

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* URL segura para un CSS url(): solo http(s) y sin caracteres que rompan el parentesis
   (comillas, parentesis, espacios, backslash, <>). Evita inyeccion de CSS por logos de
   tokens que vienen de fuera (lista BSC de PancakeSwap o GeckoTerminal). */
const urlCssSeguro = (u) => { u = String(u || ''); return (/^https?:\/\//i.test(u) && !/["'()\\\s<>]/.test(u)) ? u : ''; };
const dec = (x) => { const a = Math.abs(x); if (!(a > 0)) return 2; if (a >= 1) return 2; if (a >= 0.1) return 3; if (a >= 0.001) return 5; if (a >= 1e-6) return 8; const ceros = Math.floor(-Math.log10(a)); return Math.min(18, ceros + 4); };
const SUBS = '₀₁₂₃₄₅₆₇₈₉';
/* Notación compacta para precios con muchos ceros, estilo DexScreener: 0.0₉2954 (el
   subíndice dice cuántos ceros hay tras el punto antes de la primera cifra). null si no aplica. */
function fmtSub(x) {
  const a = Math.abs(x); if (!(a > 0)) return null;
  const e = Math.floor(Math.log10(a)); const ceros = -e - 1;
  if (ceros < 4) return null;
  const sig = (a / Math.pow(10, e)).toFixed(3).replace('.', '');
  const sub = String(ceros).replace(/\d/g, (d) => SUBS[+d]);
  return (x < 0 ? '−' : '') + '0.0' + sub + sig;
}
const fmtP = (x) => { if (!(isFinite(x) && x > 0)) return '—'; const s = fmtSub(x); return s != null ? s : x.toLocaleString('en-US', { minimumFractionDigits: dec(x), maximumFractionDigits: dec(x) }); };
/* Igual que fmtP pero para el eje de la gráfica (nunca devuelve guión). */
function fmtPChart(p) { const n = Number(p); if (!isFinite(n) || n <= 0) return '0'; const s = fmtSub(n); if (s != null) return s; const d = dec(n); return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtMoney(x) { if (!isFinite(x)) x = 0; const n = Math.round(x * 100) / 100; const ent = Number.isInteger(n); return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: ent ? 0 : 2, maximumFractionDigits: 2 }); }
const fmtPct = (x) => (x >= 0 ? '+' : '') + (isFinite(x) ? x : 0).toFixed(2) + '%';
const cls = (x) => x > 0 ? 'up' : x < 0 ? 'down' : '';
/* Formato de una cantidad de MONEDA (no USD): decimales según el tamaño. */
const fmtCoin = (x) => { if (!isFinite(x) || x === 0) return '0'; const a = Math.abs(x); const d = a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8; return x.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d }); };
/* PnL con su moneda: USDT se muestra como dinero; una moneda base, como cantidad. */
const fmtPnL = (v, denom) => (v >= 0 ? '+' : '−') + (denom === 'USDT' ? fmtMoney(Math.abs(v)) : (fmtCoin(Math.abs(v)) + ' ' + denom));
/* Porcentaje de la posición (congruente con el movimiento del precio desde la entrada). */
const pctTxt = (v) => (isFinite(v) ? (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + '%' : '—');
/* Texto del fee: 1% de la ganancia (lo cobra el contrato en BNB, solo si ganas). */
const comisionTxt = () => String(M.comisionPct()).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') + '% of profit';

const IC = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.2 9.2a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2.2-2.6 4"/><path d="M12 17.5v.01"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  cert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.2 13.5 7 22l5-3 5 3-1.2-8.5"/></svg>'
};

export async function abrirSpot() {
  estilos();
  const prev = $('sp-overlay'); if (prev) prev.remove();
  S.par = (D.PARES.find((p) => p.id === 'BTC') || D.PARES[0]);
  const ov = document.createElement('div'); ov.id = 'sp-overlay';
  ov.innerHTML = plantilla();
  document.body.appendChild(ov);
  cablear(ov);
  S.cap = 0; S.tam = 0; sincronCap();
  renderTf(); cargarLogos();
  try { await cargarLib(); } catch (_) { toast('Chart engine failed to load. Reload.', 'bad'); return; }
  await cargarDatos();
  montarBarraDemo();
  wireDrag();
  S.onResize = () => { sincronizarDib(); ajustarTira(); };
  window.addEventListener('resize', S.onResize);
  arrancarUI();
  arrancarWallet();
}

function plantilla() {
  return `
  <div class="sp-top">
    <button class="sp-back" id="sp-back" aria-label="Back">${IC.back}Back</button>
    <button class="sp-coin" id="sp-coin"><i id="sp-coin-ico">B</i><b id="sp-coin-id">BTC</b>${IC.chev}</button>
    <div class="sp-tf" id="sp-tf"><button class="cur" id="sp-tfcur">1m <span class="cv">▾</span></button><div class="menu" id="sp-tfmenu"></div></div>
    <div class="sp-px"><div class="sp-px-big" id="sp-mark">—</div><div class="sp-px-sub">Mark · <span id="sp-pair">BTCUSDT</span></div></div>
    <button class="sp-vol" id="sp-vol" title="High volatility movers (24h)"><svg class="sp-vol-f" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg><b>Movers</b><span class="sp-vol-cv">▾</span></button>
    <div class="sp-wallet" id="sp-wallet">
      <div class="sp-bal-boxes" id="sp-bal-boxes"></div>
      <button class="sp-coinsbtn" id="sp-coinsbtn" title="All your coins"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg><b id="sp-coinsn">0</b><span class="cv">▾</span></button>
      <div class="sp-bal-total"><span class="lbl">Total balance</span><b id="sp-eq">—</b></div>
    </div>
    <button class="sp-icobtn" id="sp-help-btn" title="How it works">${IC.help}<span class="sp-dot" id="sp-help-dot"></span></button>
    <button class="sp-icobtn" id="sp-export" title="Export chart image">${IC.cam}</button>
    <button class="sp-icobtn" id="sp-reset" title="Clear positions and history">${IC.reset}</button>
  </div>
  <div class="sp-body" id="sp-body">
    <div class="sp-main" id="sp-main">
      <div class="sp-chart" id="sp-chart">
        <div class="sp-cv" id="sp-cv"></div>
        <canvas class="sp-fx" id="sp-fx"></canvas>
        <div class="sp-wm"><img src="${LOGO}" onerror="this.onerror=null;this.src='${LOGO_ALT}'" alt=""></div>
        <div class="sp-spin" id="sp-spin"><i></i></div>
        <div class="sp-nochart" id="sp-nochart" style="display:none"></div>
      </div>
      <div class="sp-entry">
        <div class="sp-side" id="sp-side">
          <button class="sp-side-b long" data-side="long" id="sp-side-long">Long<small>buy the coin</small></button>
          <button class="sp-side-b short" data-side="short" id="sp-side-short">Short<small>profit if it drops</small></button>
        </div>
        <div class="sp-side-hint" id="sp-side-hint">Pick <b>Long</b> or <b>Short</b> above to set up your trade.</div>
        <div class="sp-modes"><button class="sp-mode on" data-modo="market">Market</button><button class="sp-mode" data-modo="limit">Limit (mark)</button></div>
        <div class="sp-fld" id="sp-limitwrap" style="display:none">
          <div class="sp-fld-l"><span>Entry price</span><span>click the chart</span></div>
          <div class="sp-in"><input type="number" id="sp-limit" placeholder="0.00" step="any"><em>USDT</em></div>
        </div>
        <div class="sp-sld">
          <div class="sp-sld-top"><span class="lbl">Amount</span><span class="val sp-capedit"><input id="sp-capv" type="number" step="any" inputmode="decimal" placeholder="0"><button type="button" class="sp-amtunit" id="sp-amtunit">USDT</button></span></div>
          <input type="range" class="sp-range" id="sp-capr" min="0" max="100" step="1" value="0">
          <div class="sp-pcts"><button class="sp-pct" data-pct="25">25%</button><button class="sp-pct" data-pct="50">50%</button><button class="sp-pct" data-pct="75">75%</button><button class="sp-pct" data-pct="100">Max</button></div>
        </div>
        <div class="sp-fld sp-avail-row"><div class="sp-fld-l"><span id="sp-avail-l">Available</span><span id="sp-avail">—</span></div></div>
        <div class="sp-tpsl">
          <div class="sp-in"><em>TP</em><input type="number" id="sp-tp" placeholder="price" step="any"><button type="button" class="sp-unit" id="sp-tpunit" title="Toggle price / percent">$</button></div>
          <div class="sp-in"><em>SL</em><input type="number" id="sp-sl" placeholder="price" step="any"><button type="button" class="sp-unit" id="sp-slunit" title="Toggle price / percent">$</button></div>
        </div>
        <div class="sp-proj" id="sp-proj">
          <div class="sp-proj-c tp"><span>If TP hits</span><b id="sp-proj-tp">—</b><i id="sp-proj-tpr"></i></div>
          <div class="sp-proj-c sl"><span>If SL hits</span><b id="sp-proj-sl">—</b><i id="sp-proj-slr"></i></div>
        </div>
        <div class="sp-cost"><span id="sp-qtylbl">You buy</span><b id="sp-qtyprev">—</b></div>
        <div class="sp-summary" id="sp-summary">
          <button type="button" class="sp-sum-h" id="sp-sum-toggle">Order summary<span class="cv" id="sp-sum-cv">▾</span></button>
          <div class="sp-sum-body" id="sp-sum-body" hidden>
            <div class="sp-sum-row"><span>Order value</span><b id="sp-sum-val">—</b></div>
            <div class="sp-sum-row"><span>Platform fee</span><b id="sp-sum-fee">—</b></div>
            <div class="sp-sum-row"><span>Breakeven</span><b id="sp-sum-be">—</b></div>
            <div class="sp-sum-note">Spot order. Long spends USDT; short sells the coin you hold. No leverage and no liquidation. We charge <b>nothing to open</b> and <b>1% of your profit</b> (in BNB) only when you close a winning trade. If you do not profit, there is no platform fee.</div>
          </div>
        </div>
        <div class="sp-ops"><button class="sp-op long" id="sp-long">Long</button><button class="sp-op short" id="sp-short">Short</button></div>
      </div>
    </div>
    <div class="sp-pos">
      <div class="sp-pos-hint">${IC.down} Positions · Marked orders · History ${IC.down}</div>
      <div class="sp-pos-tabs">
        <button class="sp-pos-tab on" data-tab="pos">Positions <b id="sp-npos">0</b></button>
        <button class="sp-pos-tab" data-tab="ord">Marked orders <b id="sp-nord">0</b></button>
        <button class="sp-pos-tab" data-tab="hist">History <b id="sp-nhist">0</b></button>
        <div class="sp-pos-r" id="sp-pos-r"></div>
      </div>
      <div class="sp-pos-body" id="sp-pos-body"></div>
    </div>
  </div>`;
}

function cablear(ov) {
  $('sp-back').onclick = cerrar;
  $('sp-coin').onclick = (e) => { e.stopPropagation(); menuMonedas(); };
  { const v = $('sp-vol'); if (v) { v.onclick = (e) => { e.stopPropagation(); menuMovers(); }; v.addEventListener('mouseenter', precargarMovers, { once: true }); } }
  setTimeout(precargarMovers, 1800);   // precarga en segundo plano tras montar la UI
  { const cb = $('sp-coinsbtn'); if (cb) cb.onclick = (e) => { e.stopPropagation(); menuMonedasWallet(); }; }
  $('sp-export').onclick = exportarChart;
  $('sp-help-btn').onclick = (e) => { e.stopPropagation(); ayuda(); };
  $('sp-reset').onclick = () => { if (confirm('Clear all your Spot positions, marked orders and history on this device? Your wallet is not touched.')) { M.reset(); sincronCap(); renderTodo(); toast('Spot positions and history cleared.', 'ok'); } };
  $('sp-tfcur').onclick = (e) => { e.stopPropagation(); $('sp-tf').classList.toggle('open'); };
  document.addEventListener('click', () => $('sp-tf') && $('sp-tf').classList.remove('open'));
  // Selector de LADO (arriba): define toda la sección (long = comprar con USDT;
  // short = vender una moneda que tienes). Marca el botón de abajo que corresponde.
  ov.querySelectorAll('.sp-side-b').forEach((b) => b.onclick = () => setSide(b.dataset.side));
  // Importe (barra progresiva) + atajos de porcentaje (contra el saldo del activo del lado)
  $('sp-capr').oninput = () => setCapPct(+$('sp-capr').value);
  ov.querySelectorAll('.sp-pct').forEach((b) => b.onclick = () => setCapPct(+b.dataset.pct));
  // Unidad del importe: para short abre el selector de moneda que tienes disponible.
  $('sp-amtunit').onclick = (e) => { e.stopPropagation(); menuPagar(); };
  $('sp-limit').oninput = () => { S.limitPx = Math.max(0, +$('sp-limit').value || 0); dibujarLimit(); renderEntry(); };
  ov.querySelectorAll('.sp-mode').forEach((b) => b.onclick = () => { S.modo = b.dataset.modo; ov.querySelectorAll('.sp-mode').forEach((x) => x.classList.toggle('on', x === b)); $('sp-limitwrap').style.display = S.modo === 'limit' ? 'flex' : 'none'; dibujarLimit(); renderEntry(); });
  $('sp-long').onclick = () => operar('long');
  $('sp-short').onclick = () => operar('short');
  $('sp-long').disabled = true; $('sp-short').disabled = true;   // hasta marcar un lado arriba
  ov.querySelectorAll('.sp-pos-tab').forEach((b) => b.onclick = () => { S.tab = b.dataset.tab; ov.querySelectorAll('.sp-pos-tab').forEach((x) => x.classList.toggle('on', x === b)); renderPos(); });
  // Capital editable a mano (ademas del slider y los atajos de %)
  const capv = $('sp-capv'); if (capv) capv.oninput = () => setCap(+capv.value || 0);
  // TP y SL por precio ($) o por porcentaje (%)
  const alternarUnidad = (idBtn, idInp, clave) => {
    const btn = $(idBtn), inp = $(idInp); if (!btn || !inp) return;
    btn.onclick = () => { S[clave] = S[clave] === 'px' ? 'pct' : 'px'; btn.textContent = S[clave] === 'px' ? '$' : '%'; inp.placeholder = S[clave] === 'px' ? 'price' : '%'; renderEntry(); };
    inp.oninput = renderEntry;
  };
  alternarUnidad('sp-tpunit', 'sp-tp', 'tpUnit');
  alternarUnidad('sp-slunit', 'sp-sl', 'slUnit');
  // Resumen de la orden plegable
  const sumT = $('sp-sum-toggle'); if (sumT) sumT.onclick = () => { S.sumOpen = !S.sumOpen; const bd = $('sp-sum-body'); if (bd) bd.hidden = !S.sumOpen; const cv = $('sp-sum-cv'); if (cv) cv.style.transform = S.sumOpen ? 'rotate(180deg)' : ''; };
  // Clic derecho en la gráfica: menú con Copy price / Set alert
  const chartHost = $('sp-chart');
  if (chartHost) chartHost.addEventListener('contextmenu', (e) => {
    if (!S.serieVela) return;
    e.preventDefault();
    const r = ($('sp-cv') || chartHost).getBoundingClientRect();
    let px; try { px = S.serieVela.coordinateToPrice(e.clientY - r.top); } catch (_) { px = null; }
    if (px > 0) abrirCtxDemo(e.clientX, e.clientY, +(+px).toFixed(dec(px)));
  });
}

/* ── SPOT: sin apalancamiento. Importe en la unidad del lado ──
   long = USDT a gastar; short = cantidad de la moneda que vendes. El slider es un
   PORCENTAJE del saldo disponible, así vale igual para USDT y para monedas
   fraccionarias. S.cap = importe absoluto; S.tam = S.cap. */
function parIdDeToken(id) { if (!id) return null; if (id === 'BTCB') return 'BTC'; return D.PARES.some((p) => p.id === id) ? id : null; }
/* Estables de $1 reales (USDT.z NO lo es: es un token con precio propio, va por DEX). */
const ESTABLES = ['USDT', 'USDC'];
/* Un token es operable si tiene gráfica en Binance (par) o, si no, un contrato en BSC
   del que sacarla de PancakeSwap vía GeckoTerminal. */
function tokenOperable(id) { return !!(parIdDeToken(id) || (MONEDAS[id] && MONEDAS[id].address)); }
function esDex(p) { return !!(p && p.fuente === 'dex'); }
/* Objeto de par para CUALQUIER moneda: Binance si existe el par, si no DEX por contrato. */
function parDeMoneda(coinId) {
  if (!coinId) return null;
  const pid = parIdDeToken(coinId);
  if (pid) { const p = D.PARES.find((x) => x.id === pid); if (p) return Object.assign({}, p, { fuente: 'binance', coin: coinId }); }
  const m = MONEDAS[coinId];
  if (m && m.address) return { id: coinId, coin: coinId, s: null, addr: m.address, fuente: 'dex', n: m.nombre || coinId, cg: null, simbolo: m.simbolo || coinId, disp: (m.simbolo || coinId) + '/USD' };
  return null;
}
/* Etiqueta del par para exportar/mostrar: XXXUSDT en Binance, Símbolo/USD en DEX. */
function etqPar(id) { const m = MONEDAS[id]; if (m && m.address && !parIdDeToken(id)) return (m.simbolo || id) + '/USD'; return (id || '') + 'USDT'; }
/* Con que fondeas la operacion (USDT o BNB): disponible y unidad siguen esa eleccion.
   El short ya NO vende "una moneda que tienes": shorteas la moneda EN PANTALLA usando
   USDT o BNB como colateral (el contrato convierte), igual que el long. */
function disponibleActual() { return (S.pagar === 'BNB') ? (S.saldos.BNB || 0) : (S.saldos.USDT != null ? S.saldos.USDT : M.balance()); }
function unidadActual() { return S.pagar === 'BNB' ? 'BNB' : 'USDT'; }
/* Monedas con las que se puede fondear (solo las que el usuario pueda tener para pagar). */
const PAGABLES = ['USDT', 'BNB'];
function setCap(c) {
  /* Blindaje de monto: nada de NaN, negativos ni numeros infinitos (ej. 1e999 -> Infinity).
     Y nunca por encima de lo que el usuario tiene de verdad. */
  let v = +c; if (!isFinite(v) || v < 0) v = 0;
  const av = disponibleActual();
  if (av > 0 && v > av) v = av;
  S.cap = v; S.tam = S.cap; sincronCap(); renderEntry();
}
function setCapPct(pct) { setCap(disponibleActual() * Math.max(0, Math.min(100, +pct || 0)) / 100); }
function setTam(t) { setCap(t); }
function sincronCap() {
  const av = disponibleActual();
  const capr = $('sp-capr'); if (capr) { const pct = av > 0 ? Math.min(100, S.cap / av * 100) : 0; capr.value = Math.round(pct); capr.style.setProperty('--f', Math.round(pct) + '%'); }
  const capv = $('sp-capv'); if (capv && document.activeElement !== capv) capv.value = S.cap ? +S.cap.toFixed(unidadActual() === 'USDT' ? 2 : 8) : '';
  const au = $('sp-amtunit'); if (au) { au.textContent = unidadActual(); au.classList.add('pick'); }
}
/* El usuario marca LONG o SHORT arriba: define toda la sección (incluido qué saldos
   puede usar y qué botón de abajo queda activo). */
function setSide(side) {
  S.side = side;
  const ov = $('sp-overlay'); if (!ov) return;
  ov.querySelectorAll('.sp-side-b').forEach((b) => b.classList.toggle('on', b.dataset.side === side));
  const hint = $('sp-side-hint'); if (hint) hint.style.display = 'none';
  const bl = $('sp-long'), bs = $('sp-short');
  if (bl) bl.disabled = side !== 'long'; if (bs) bs.disabled = side !== 'short';
  // Long y Short operan la moneda EN PANTALLA. No se cambia de gráfica.
  S.cap = 0; S.tam = 0; sincronCap(); renderEntry();
}
/* Carga CUALQUIER moneda en la gráfica y el panel (Binance o DEX), reutilizando la
   carga de velas. Punto ÚNICO por el que pasan el selector de pares, las tarjetas de
   saldo de la wallet y la elección de moneda para short. */
async function seleccionarMoneda(coinId) {
  const p = parDeMoneda(coinId);
  if (!p) { toast('No chart available for this coin yet.', 'bad'); return; }
  if (S.par && p.id === S.par.id && (p.addr || '') === (S.par.addr || '')) { cerrarPops(); return; }
  S.par = p; S._posAuto = null;
  cerrarPops();
  await cargarDatos();
}
/* Alias histórico: acepta un id de par (Binance) o de moneda (wallet/DEX). */
function cambiarPar(parId) { return seleccionarMoneda(parId); }
/* Carga CUALQUIER token por su contrato (como el buscador de Terminal): lo resuelve en
   cadena y lo grafica (GeckoTerminal o, si no, on-chain por los eventos Sync del par). */
async function cargarContrato(addr) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(addr || '').trim())) return;
  cerrarPops();
  const spin = $('sp-spin'); if (spin) spin.style.display = 'grid';
  let info = null; try { info = await D.resolverToken(addr); } catch (_) {}
  if (!info || !info.address) { if (spin) spin.style.display = 'none'; toast('Token not found or without a pool to chart.', 'bad'); return; }
  S.par = { id: info.address, coin: info.address, s: null, addr: info.address, fuente: 'dex', n: info.nombre, cg: null, simbolo: info.simbolo, disp: (info.simbolo || 'Token') + '/USD' };
  S._posAuto = null;
  await cargarDatos();
}
/* Menú para elegir con qué pagas la operación: USDT o BNB. Vale para long y short. */
function menuPagar() {
  cerrarPops();
  const ancla = $('sp-amtunit'); if (!ancla) return;
  const m = document.createElement('div'); m.id = 'sp-shortmenu'; m.className = 'sp-shortmenu';
  m.innerHTML = PAGABLES.map((id) => { const bal = S.saldos[id] || 0; return `<button data-pay="${esc(id)}" class="${id === S.pagar ? 'on' : ''}"><span class="sym">${esc(id)}</span><b>${esc(fmtCoin(bal))}</b></button>`; }).join('');
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  m.querySelectorAll('[data-pay]').forEach((b) => b.onclick = () => { S.pagar = b.dataset.pay; S.cap = 0; S.tam = 0; sincronCap(); renderEntry(); cerrarPops(); });
  setTimeout(() => document.addEventListener('mousedown', cierraPopFuera), 10);
}

function renderTf() {
  const cur = $('sp-tfcur'), menu = $('sp-tfmenu'); if (!cur || !menu) return;
  cur.firstChild.nodeValue = (D.TFS.find((t) => t.id === S.tf) || { n: S.tf }).n + ' ';
  const lista = D.TFS || [{ id: '1m', n: '1m' }];
  menu.innerHTML = lista.map((t) => `<button data-tf="${t.id}" class="${t.id === S.tf ? 'on' : ''}">${esc(t.n)}</button>`).join('');
  menu.querySelectorAll('button').forEach((b) => b.onclick = async (e) => { e.stopPropagation(); $('sp-tf').classList.remove('open'); if (b.dataset.tf === S.tf) return; S.tf = b.dataset.tf; renderTf(); await cargarDatos(); });
}

async function cargarLogos() { try { S.logos = await D.logos() || {}; aplicarLogo($('sp-coin-ico'), S.par); } catch (_) {} }
function aplicarLogo(el, par) {
  if (!el || !par) return;
  const id = par.coin || par.id;
  const url = par.logo || (par.cg && S.logos[par.cg]) || LOGOS_SPOT[id] || (S._logoDex && S._logoDex[id]) || '';
  const safe = urlCssSeguro(url);
  if (safe) { el.style.backgroundImage = `url("${safe}")`; el.classList.add('con'); el.textContent = ''; return; }
  el.style.backgroundImage = ''; el.classList.remove('con');
  const ic = MONEDAS[id] && MONEDAS[id].icono;                 // emoji como respaldo mientras carga
  el.textContent = (ic && !/^[A-Za-z0-9]$/.test(ic)) ? ic : (id || '?')[0];
  if (esDex(par)) cargarLogoDex(par);
}
/* Busca el logo REAL de un token DEX (local embebido o por contrato) y lo aplica al icono. */
async function cargarLogoDex(par) {
  const id = par && (par.coin || par.id); if (!id) return;
  if (LOGOS_SPOT[id]) return;                                   // ya lo pinta aplicarLogo
  S._logoDex = S._logoDex || {};
  if (S._logoDex[id] != null) return;                          // ya intentado
  let u = ''; try { u = await D.logoDex(par.addr) || ''; } catch (_) {}
  S._logoDex[id] = u;
  const safe = urlCssSeguro(u);
  if (safe && S.par && (S.par.coin || S.par.id) === id) { const el = $('sp-coin-ico'); if (el) { el.style.backgroundImage = `url("${safe}")`; el.classList.add('con'); el.textContent = ''; } }
}

function cargarLib() { return new Promise((res, rej) => { if (window.LightweightCharts) return res(); let sc = $('sp-lwc'); if (sc) { sc.addEventListener('load', () => res()); sc.addEventListener('error', () => rej(new Error('lib'))); return; } sc = document.createElement('script'); sc.id = 'sp-lwc'; sc.src = LIB; sc.onload = () => res(); sc.onerror = () => rej(new Error('lib')); document.head.appendChild(sc); }); }

/* Token de secuencia: solo la ÚLTIMA selección aplica sus datos. Sin esto, una carga
   lenta (token DEX, red) resuelve tarde y pisa la gráfica de una selección más nueva,
   dejando cabecera y gráfica en monedas distintas. Causa raíz de la incongruencia. */
let _cargaSeq = 0;
async function cargarDatos() {
  const mi = ++_cargaSeq;
  const spin = $('sp-spin'); if (spin) spin.style.display = 'grid';
  const dex = esDex(S.par), par = S.par;
  $('sp-coin-id').textContent = dex ? (par.simbolo || par.coin || par.id) : (par.coin || par.id); $('sp-pair').textContent = dex ? (par.disp || par.id) : par.s; aplicarLogo($('sp-coin-ico'), par);
  sincronActiva();
  try {
    const [v, t] = dex
      ? await Promise.all([D.velasDex(par.addr, S.tf, 1000), D.tickerDex(par.addr).catch(() => null)])
      : await Promise.all([D.velas(par.s, S.tf, 1000), D.ticker(par.s).catch(() => null)]);
    if (mi !== _cargaSeq) return;                 // una selección más nueva ya tomó el control
    S.velas = v || [];
    if (!S.velas.length) { limpiarChart(); mostrarNoChart(true, par.coin || par.id); conectarStream(); renderTodo(); return; }
    mostrarNoChart(false);
    if (!dex && t) { S.mark = t.last; S.open24 = t.open; S.high24 = t.high; S.low24 = t.low; S.vol24 = t.volQuote; S.chgPct = t.chgPct; }
    else if (dex && t && t.last > 0) { S.mark = t.last; }
    else if (S.velas.length) S.mark = S.velas[S.velas.length - 1].close;
    if (dex) { const lc = S.velas[S.velas.length - 1]; if (lc) { S.chgPct = lc.open > 0 ? (S.mark - lc.open) / lc.open * 100 : 0; S.high24 = lc.high; S.low24 = lc.low; S.vol24 = 0; } else { S.chgPct = 0; } }
    S.marks[par.id] = S.mark;
    pintarChart(); conectarStream(); renderTodo();
  } catch (_) {
    if (mi !== _cargaSeq) return;                 // no mostrar el error de una selección vieja
    S.velas = []; limpiarChart(); mostrarNoChart(true, par.coin || par.id);   // no dejar la gráfica anterior
    toast(dex ? 'Could not load this coin chart yet.' : 'Could not load market data.', 'bad');
  } finally {
    if (mi === _cargaSeq && spin) spin.style.display = 'none';
  }
}
/* Marca como activa, en la tira de saldos, la moneda que se está graficando. */
function sincronActiva() {
  const cur = S.par && (S.par.coin || S.par.id), c = $('sp-bal-boxes');
  if (c) c.querySelectorAll('.sp-bal-box').forEach((b) => b.classList.toggle('on', b.dataset.coin === cur));
}
/* Muestra en la tira SOLO las monedas que caben enteras (nunca una cortada ni por
   detrás del botón); el resto queda en el botón "All your coins". */
function ajustarTira() {
  const c = $('sp-bal-boxes'); if (!c) return;
  const hijos = [...c.children]; if (!hijos.length) return;
  hijos.forEach((b) => { b.style.display = ''; });
  const cr = c.getBoundingClientRect(); let corte = false;
  for (const b of hijos) {                     // mide posiciones REALES ya renderizadas
    if (corte) { b.style.display = 'none'; continue; }
    const r = b.getBoundingClientRect();
    if (r.right > cr.right + 0.5) { b.style.display = 'none'; corte = true; }
  }
}

/* Quita la gráfica actual y limpia el overlay. Evita que, al fallar la carga de una
   moneda, se quede a la vista la gráfica de la ANTERIOR (incongruencia cabecera/gráfica). */
function limpiarChart() {
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  S.chart = null; S.serieVela = null; S.velasDib = [];
  try { const fx = $('sp-fx'); if (fx && fx.getContext) fx.getContext('2d').clearRect(0, 0, fx.width, fx.height); } catch (_) {}
}
function mostrarNoChart(on, coin) {
  const n = $('sp-nochart'); if (!n) return;
  n.innerHTML = on ? `No chart for <b>${esc(coin || '')}</b> yet. It has no indexed pool and no readable PancakeSwap pair.` : '';
  n.style.display = on ? 'grid' : 'none';
}
function pintarChart() {
  const LC = window.LightweightCharts; const cv = $('sp-cv'); if (!cv || !S.velas.length) return;
  if (!LC) { clearTimeout(S._lcTmr); S._lcTmr = setTimeout(pintarChart, 120); return; }   // la librería aún cargaba: reintenta (evita gráfica en negro al entrar)
  try { if (S.chart) S.chart.remove(); } catch (_) {}
  S.chart = null; S.lineaLimit = null;
  const chart = LC.createChart(cv, {
    autoSize: true, localization: { locale: 'en', priceFormatter: fmtPChart },
    layout: { background: { color: 'transparent' }, textColor: '#7d8794', fontFamily: '"Chakra Petch", ui-monospace, monospace', attributionLogo: false },
    grid: { vertLines: { color: 'rgba(35,43,53,.4)' }, horzLines: { color: 'rgba(35,43,53,.4)' } },
    rightPriceScale: { borderColor: '#232b35', scaleMargins: { top: 0.08, bottom: 0.08 } },
    timeScale: { borderColor: '#232b35', timeVisible: true, secondsVisible: false, barSpacing: 9, rightOffset: 10, minBarSpacing: 1 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  S.chart = chart;
  const V = S.velas;
  const pRef = (V[V.length - 1] || {}).close || S.mark || 1; const pd = dec(pRef);
  const vela = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e', priceFormat: { type: 'price', precision: pd, minMove: Math.pow(10, -pd) } });
  vela.setData(V.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))); S.serieVela = vela;
  S.velasDib = V.map((c) => ({ t: c.time, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume }));
  try { const ts = chart.timeScale(); ts.setVisibleLogicalRange({ from: V.length - 90, to: V.length + 6 }); ts.subscribeVisibleLogicalRangeChange((range) => { sincronizarDib(); if (range && range.from < 15) cargarMasVelas(); }); } catch (_) {}
  try { chart.subscribeClick((p) => { if (S._ctxCerradoEn && Date.now() - S._ctxCerradoEn < 400) return; if (!p || !p.point || S.drag || !sinHerramienta() || _indBajoCursor()) return; const px = S.serieVela.coordinateToPrice(p.point.y); if (!(px > 0)) return; if (S.modo !== 'limit') { S.modo = 'limit'; const ov = $('sp-overlay'); if (ov) ov.querySelectorAll('.sp-mode').forEach((x) => x.classList.toggle('on', x.dataset.modo === 'limit')); const lw = $('sp-limitwrap'); if (lw) lw.style.display = 'flex'; } S.limitPx = +px.toFixed(dec(px)); const li = $('sp-limit'); if (li) li.value = S.limitPx; dibujarLimit(); renderEntry(); }); } catch (_) {}
  dibujarLimit();
  cargarIndicadores();   // botón "Indicators" + redibuja los indicadores activos sobre la gráfica nueva
}

/* Carga perezosa de velas MÁS VIEJAS al llegar al borde izquierdo (ir al pasado). */
let _cargandoMas = false;
async function cargarMasVelas() {
  if (_cargandoMas || !S.velas.length || !S.serieVela) return;
  _cargandoMas = true;
  try {
    const first = S.velas[0].time;
    const older = esDex(S.par)
      ? await D.velasDexAntes(S.par.addr, S.tf, first - 1, 1000)
      : await D.velasAntes(S.par.s, S.tf, first * 1000 - 1, 1000);
    const nuevos = (older || []).filter((c) => c.time < first);
    if (nuevos.length) {
      S.velas = nuevos.concat(S.velas);
      if (S.velas.length > 6000) S.velas = S.velas.slice(-6000);
      try { S.serieVela.setData(S.velas.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))); } catch (_) {}
      S.velasDib = S.velas.map((c) => ({ t: c.time, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume }));
      sincronizarDib();
    }
  } catch (_) {} finally { _cargandoMas = false; }
}

let _streamKey = '';
/* En vivo: Binance por WebSocket; tokens DEX por sondeo a GeckoTerminal (no hay WS),
   cada ~22s, suficiente para el precio y dentro del límite público. */
function conectarStream() {
  const dex = esDex(S.par);
  const key = (dex ? S.par.addr : S.par.s) + '|' + S.tf + '|' + (dex ? 'dex' : 'bin');
  if (_streamKey === key && (S.stream || S.poll)) return;
  pararStream();
  _streamKey = key;
  if (dex) {
    const addr = S.par.addr, tf = S.tf;
    S.poll = setInterval(async () => {
      if (!esDex(S.par) || S.par.addr !== addr || S.tf !== tf) return;
      try { const t = await D.tickerDex(addr); const px = t && t.last; const last = S.velas[S.velas.length - 1];
        if (px > 0 && last) empujarVela({ time: last.time, open: last.open, high: Math.max(last.high, px), low: Math.min(last.low, px), close: px, volume: last.volume }, false);
      } catch (_) {}
    }, 22000);
  } else {
    try { S.stream = D.streamVelas(S.par.s, S.tf, (k) => onKline(k)); } catch (_) { S.stream = null; }
  }
}
function pararStream() {
  if (S.stream) { try { S.stream.cerrar(); } catch (_) {} S.stream = null; }
  if (S.poll) { try { clearInterval(S.poll); } catch (_) {} S.poll = null; }
}

/* Mete una vela (en formación o cerrada) en el estado y la gráfica, y dispara el motor
   (fills de limit, TP y SL). La usan el WebSocket (Binance) y el sondeo (DEX). */
function empujarVela(c, cerrada) {
  if (!S.serieVela || !(c.close > 0)) return;
  const last = S.velas[S.velas.length - 1];
  if (last && c.time === last.time) S.velas[S.velas.length - 1] = c;
  else if (!last || c.time > last.time) { S.velas.push(c); if (S.velas.length > 1500) S.velas.shift(); }
  else return;
  try { S.serieVela.update({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }); } catch (_) {}
  refrescarIndicadores();   // mantiene los indicadores al día con la vela en vivo
  nuevoPrecio(c.close, c.high, c.low);
  if (cerrada) { S.velasDib = S.velas.map((v) => ({ t: v.time, o: v.open, h: v.high, l: v.low, c: v.close, v: v.volume })); sincronizarDib(); }
}
function onKline(k) {
  const c = { time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v };
  empujarVela(c, k.x === true);
}

function nuevoPrecio(px, hi, lo) {
  S.mark = px; S.marks[S.par.id] = px;
  if (S.open24 > 0) S.chgPct = ((px - S.open24) / S.open24) * 100;
  const ev = M.onPrecio(S.par.id, px, hi, lo); let cambio = false; _reconKeeperThrottle();
  if (ev.fills.length) { ev.fills.forEach((p) => { flash(p.entrada, p.lado, (p.lado === 'long' ? 'LONG' : 'SHORT') + ' filled'); toast(`Marked ${p.lado} filled at ${fmtP(p.entrada)}`, 'ok'); snd('open'); }); cambio = true; }
  if (ev.tp.length) { ev.tp.forEach((r) => { flash(r.salida, r.pos.lado, 'TAKE PROFIT'); toast(`Take profit hit · ${fmtPnL(r.pnl, r.denom)}`, 'ok'); snd('tp'); }); cambio = true; }
  if (ev.sl.length) { ev.sl.forEach((r) => { flash(r.salida, r.pos.lado, 'STOP LOSS'); toast(`Stop loss hit · ${fmtPnL(r.pnl, r.denom)}`, 'bad'); snd('sl'); }); cambio = true; }
  if (cambio) renderPos();
}

/* ── Bucle de UI (≈16 fps): precio, equity, PnL y overlay de posiciones ── */
function arrancarUI() {
  let last = 0;
  const loop = (ts) => { S.uiRAF = requestAnimationFrame(loop); if (ts - last < 60) return; last = ts; try { pintarPrecio(); revisarAlertas(); refrescarPnL(); pintarFx(); } catch (_) {} };
  S.uiRAF = requestAnimationFrame(loop);
}
function pintarPrecio() {
  const m = $('sp-mark'); if (m) { m.textContent = fmtP(S.mark); m.className = 'sp-px-big ' + cls(S.chgPct); }
  // El saldo total de la wallet lo pinta renderWallet() (no en cada frame).
}
function renderEntry() {
  const unidad = unidadActual(), disp = disponibleActual();
  const av = $('sp-avail'); if (av) av.textContent = !S.walletOn ? 'No wallet detected' : (fmtCoin(disp) + ' ' + unidad);
  const cv = $('sp-capv'); if (cv && document.activeElement !== cv) cv.value = S.cap > 0 ? +S.cap.toFixed(unidad === 'USDT' ? 2 : 8) : '';
  const px = entradaRef();
  const base = S.par ? S.par.id : 'COIN';
  const ql = $('sp-qtylbl'), qp = $('sp-qtyprev');
  // El importe va en la moneda con la que pagas (USDT o BNB). El valor comprometido en USDT
  // y la cantidad de moneda que abres salen de ahí; el contrato hace la conversión solo.
  const bnbPx = (S.precios && S.precios.BNB) ? S.precios.BNB : 0;
  const amountUsdt = S.pagar === 'BNB' ? S.cap * bnbPx : S.cap;
  const coins = px > 0 ? amountUsdt / px : 0;
  if (ql) ql.textContent = S.side === 'short' ? 'You short' : 'You buy';
  if (qp) qp.textContent = coins > 0 ? (fmtCoin(coins) + ' ' + base) : '—';
  S._amountUsdt = amountUsdt;
  const sv = $('sp-sum-val'); if (sv) sv.textContent = fmtMoney(amountUsdt);
  const sf = $('sp-sum-fee'); if (sf) sf.textContent = comisionTxt();   // 0.2% solo de la ganancia
  const sb = $('sp-sum-be'); if (sb) sb.textContent = px > 0 ? fmtP(px) : '—';   // sin fee de apertura: punto de equilibrio = entrada
  proyeccionPnL();
}

/* Precio de entrada de referencia para la proyeccion y para convertir % a precio. */
function entradaRef() { return S.modo === 'limit' && S.limitPx > 0 ? S.limitPx : S.mark; }
/* Sin herramienta de dibujo activa (modo cursor): solo entonces el clic izquierdo marca la entry.
   Con una herramienta activa (posición larga/corta, líneas, etc.) la entry se desactiva para no estorbar. */
function sinHerramienta() { return NIV.herr === 'cursor' || NIV.herr == null; }
/* Fraccion de movimiento del precio hasta TP o SL (desde % o desde precio escrito). */
function movFrac(cual) {
  const raw = +$(cual === 'tp' ? 'sp-tp' : 'sp-sl').value || 0; if (!(raw > 0)) return null;
  const unidad = cual === 'tp' ? S.tpUnit : S.slUnit;
  if (unidad === 'pct') return raw / 100;
  const e = entradaRef(); if (!(e > 0)) return null;
  return Math.abs(raw - e) / e;
}
/* Precio real de TP o SL segun el lado, convirtiendo desde % cuando toca. */
function tpslPrecioReal(cual, lado) {
  const raw = +$(cual === 'tp' ? 'sp-tp' : 'sp-sl').value || 0; if (!(raw > 0)) return 0;
  const unidad = cual === 'tp' ? S.tpUnit : S.slUnit;
  if (unidad === 'px') return raw;
  const e = entradaRef(); if (!(e > 0)) return 0;
  const f = raw / 100;
  if (cual === 'tp') return +(lado === 'short' ? e * (1 - f) : e * (1 + f)).toFixed(dec(e));
  return +(lado === 'short' ? e * (1 + f) : e * (1 - f)).toFixed(dec(e));
}
/* Proyeccion visible: cuanto se gana en TP y cuanto se pierde en SL (dinero + ROE). */
function proyeccionPnL() {
  const amt = S._amountUsdt || 0, activo = amt > 0;
  const movTp = movFrac('tp'), movSl = movFrac('sl');
  const bTp = $('sp-proj-tp'), bSl = $('sp-proj-sl'), iTp = $('sp-proj-tpr'), iSl = $('sp-proj-slr');
  if (bTp) { if (activo && movTp != null) { const g = amt * movTp; bTp.textContent = '+' + fmtMoney(g); iTp.textContent = fmtPct(g / amt * 100); } else { bTp.textContent = '—'; iTp.textContent = ''; } }
  if (bSl) { if (activo && movSl != null) { const l = amt * movSl; bSl.textContent = '−' + fmtMoney(l); iSl.textContent = fmtPct(-(l / amt * 100)); } else { bSl.textContent = '—'; iSl.textContent = ''; } }
}


/* ── SALDO REAL de la wallet conectada (no custodial, solo lectura) ──
   Total en USD + cuadritos por activo con saldo. Reutiliza saldosTodas() y
   tokens.js del resto de la plataforma; nada se inventa aquí. */
const BINSYM = {
  BNB: 'BNBUSDT', BTCB: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT', XRP: 'XRPUSDT',
  DOGE: 'DOGEUSDT', CAKE: 'CAKEUSDT', LINK: 'LINKUSDT', ADA: 'ADAUSDT', DOT: 'DOTUSDT',
  LTC: 'LTCUSDT', AVAX: 'AVAXUSDT', ATOM: 'ATOMUSDT', NEAR: 'NEARUSDT', FIL: 'FILUSDT',
  BCH: 'BCHUSDT', ETC: 'ETCUSDT', EOS: 'EOSUSDT', UNI: 'UNIUSDT', AAVE: 'AAVEUSDT',
  XVS: 'XVSUSDT', INJ: 'INJUSDT', TWT: 'TWTUSDT', SHIB: 'SHIBUSDT', MATIC: 'POLUSDT', FLOKI: 'FLOKIUSDT'
};
async function preciosUSD(ids) {
  const out = { USDT: 1, USDC: 1 };
  const pedir = (ids && ids.length) ? ids.filter((id) => BINSYM[id]) : Object.keys(BINSYM);
  const syms = [...new Set(pedir.map((id) => BINSYM[id]))];
  if (syms.length) {
    try {
      const map = await D.tickerPrecios(syms);   // con fallback por región (mismo que la gráfica)
      for (const [id, s] of Object.entries(BINSYM)) if (map[s] > 0) out[id] = map[s];
    } catch (_) {}
  }
  // Tokens DEX que el usuario tiene (BabyDoge, USDT.z, EXT…): precio USD por contrato.
  const dexIds = (ids || []).filter((id) => !BINSYM[id] && !ESTABLES.includes(id) && MONEDAS[id] && MONEDAS[id].address);
  if (dexIds.length) {
    try {
      const mapa = await D.preciosDex(dexIds.map((id) => MONEDAS[id].address));
      dexIds.forEach((id) => { const v = mapa[String(MONEDAS[id].address).toLowerCase()]; if (v > 0) out[id] = v; });
    } catch (_) {}
  }
  return out;
}
/* Una tarjeta de saldo (clicable si la moneda se puede graficar/operar). */
function cajaSaldo(f) {
  return `<div class="sp-bal-box${f.op ? ' op' : ''}${f.id === (S.par && S.par.coin) ? ' on' : ''}"${f.op ? ` data-coin="${esc(f.id)}"` : ''} title="${esc(f.m.nombre || f.id)}${f.op ? ' · tap to trade' : ''}"><div class="sp-bal-top"><span class="sym" style="color:${esc(f.m.color || '#cdd4dc')}">${esc(f.m.simbolo || f.id)}</span><b>${esc(fmtCoin(f.bal))}</b></div>${f.usd > 0 ? `<i>$${f.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</i>` : ''}</div>`;
}
let _walletTimer = null;
async function renderWallet() {
  const cuenta = (typeof window !== 'undefined' && window.__spotMockCuenta) || (cuentaActual && cuentaActual());
  const boxes = $('sp-bal-boxes'), eqEl = $('sp-eq'), cn = $('sp-coinsn');
  if (!cuenta) { S.walletOn = false; S.saldos = {}; S._filasWallet = []; M.setDisponible(0); if (boxes) boxes.innerHTML = '<div class="sp-bal-box sp-bal-empty">No wallet detected</div>'; if (eqEl) eqEl.textContent = '—'; if (cn) cn.textContent = '0'; try { renderEntry(); } catch (_) {} return; }
  S.walletOn = true; S.cuenta = cuenta;
  // Precalienta el cableado on chain (ethers + provider) al conectar, para que al tocar
  // Long/Short la wallet salte casi al instante en vez de cargar todo en ese momento.
  try { _contratoSpot().then((C) => C.precalentar && C.precalentar()).catch(() => {}); } catch (_) {}
  let saldos = {};
  if (typeof window !== 'undefined' && window.__spotMockSaldos) saldos = window.__spotMockSaldos;
  else { try { saldos = await saldosTodas(cuenta); } catch (_) { saldos = {}; } }
  S.saldos = saldos;
  M.setDisponible(saldos.USDT || 0);
  const ids = Object.keys(saldos).filter((id) => (saldos[id] || 0) > 1e-12);
  const precios = await preciosUSD(ids); S.precios = precios;
  let total = 0;
  const filas = ids.map((id) => {
    const m = MONEDAS[id] || { simbolo: id, color: '#8b95a1' };
    const bal = saldos[id] || 0, p = (precios[id] != null) ? precios[id] : (m.precioUSD || 0), usd = bal * p; total += usd;
    return { id, m, bal, usd, op: tokenOperable(id) && !ESTABLES.includes(id), addr: (m.address || null), nativo: (m.address === null) };
  });
  // Monedas recién compradas on chain (ej. ZKC) que NO están en la lista fija: se consultan
  // por su contrato con el lector y se añaden al balance y a "All your coins".
  try {
    const C = await _contratoSpot();
    const extra = await C.saldosVistos(cuenta);
    const vistos = new Set(ids.map((x) => String(x).toUpperCase()));
    extra.forEach((t) => {
      const sU = String(t.sim || '').toUpperCase();
      if (!(t.bal > 1e-12) || vistos.has(sU)) return;
      vistos.add(sU);
      S.saldos[t.sim] = t.bal; precios[t.sim] = t.px || 0;
      filas.push({ id: t.sim, m: { simbolo: t.sim, color: '#c3a0ff' }, bal: t.bal, usd: t.usd || 0, op: false, addr: t.addr || null, nativo: false });
      total += t.usd || 0;
    });
  } catch (_) {}
  filas.sort((a, b) => b.usd - a.usd);
  S._filasWallet = filas;
  if (boxes) { boxes.innerHTML = filas.length ? filas.map(cajaSaldo).join('') : '<div class="sp-bal-box sp-bal-empty">No balances yet</div>'; boxes.querySelectorAll('[data-coin]').forEach((b) => b.onclick = () => seleccionarMoneda(b.dataset.coin)); ajustarTira(); requestAnimationFrame(ajustarTira); }
  if (cn) cn.textContent = String(filas.length);
  S.balanceUsd = total;   // saldo real de la cuenta (para el certificado)
  if (eqEl) eqEl.textContent = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  try { renderEntry(); } catch (_) {}
}
/* ── Colector de polvo (Dust collector) dentro del popup "All your coins" ── */
let _dustOn = false, _dustSel = new Set(), _dustDest = 'USDT', _dustBusy = false, _dustMod = null;
async function _dustSpot() { if (!_dustMod) _dustMod = await import('./dust.js?v=1'); return _dustMod; }
/* Monedas que se pueden recolectar: BNB nativo o con direccion on chain, y con saldo. */
function _filasDust() { return (S._filasWallet || []).filter((f) => (f.nativo || f.addr) && f.bal > 1e-12); }
function _usdSel() { let n = 0, usd = 0; const by = {}; (S._filasWallet || []).forEach((f) => by[f.id] = f); _dustSel.forEach((id) => { const f = by[id]; if (f) { n++; usd += f.usd || 0; } }); return { n, usd }; }

/* Popup con TODAS las monedas de la wallet (botón junto a Total balance). */
function menuMonedasWallet() {
  cerrarPops(); _dustCSS();
  const ancla = $('sp-coinsbtn'); if (!ancla) return;
  _dustOn = false; _dustBusy = false; _dustSel = new Set(); _dustDest = 'USDT';
  const m = document.createElement('div'); m.id = 'sp-walletmenu'; m.className = 'sp-walletmenu';
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  _pintarWallet();
  setTimeout(() => document.addEventListener('mousedown', cierraPopFuera), 10);
}
function _entrarDust() {
  _dustOn = true;
  const dust = _filasDust();
  _dustSel = new Set(dust.filter((f) => f.id !== _dustDest && f.id !== 'BNB').map((f) => f.id));   // BNB fuera por defecto
  _pintarWallet();
}
function _salirDust() { if (_dustBusy) return; _dustOn = false; _pintarWallet(); }
function _pintarWallet() {
  const m = $('sp-walletmenu'); if (!m) return;
  m.classList.toggle('dustmode', _dustOn);
  const filas = S._filasWallet || [];
  const dust = _filasDust();
  const puede = dust.length >= 2;
  const btnDust = puede ? `<button class="sp-wm-dust${_dustOn ? ' on' : ''}" id="sp-wm-dust">${_dustOn ? 'Done' : 'Dust'}</button>` : '';
  if (!_dustOn) {
    m.innerHTML = `<div class="sp-wm-h"><span>Your coins · tap one to trade it</span>${btnDust}</div>` + (filas.length
      ? filas.map((f) => `<button ${f.op ? `data-coin="${esc(f.id)}"` : 'disabled'} class="${f.id === (S.par && S.par.coin) ? 'on' : ''}${f.op ? '' : ' nop'}" title="${esc(f.m.nombre || f.id)}"><span class="sym" style="color:${esc(f.m.color || '#cdd4dc')}">${esc(f.m.simbolo || f.id)}</span><span class="am"><b>${esc(fmtCoin(f.bal))}</b>${f.usd > 0 ? `<i>$${f.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</i>` : ''}</span></button>`).join('')
      : '<div class="sp-cm-empty">No coins in your wallet yet.</div>');
    m.querySelectorAll('[data-coin]').forEach((b) => b.onclick = () => { seleccionarMoneda(b.dataset.coin); cerrarPops(); });
    const bd = $('sp-wm-dust'); if (bd) bd.onclick = (e) => { e.stopPropagation(); _entrarDust(); };
    return;
  }
  // ── modo Dust ──
  const dests = ['USDT', 'BNB'].map((d) => `<button class="sp-dd${_dustDest === d ? ' on' : ''}" data-dest="${d}" ${_dustBusy ? 'disabled' : ''}>${d}</button>`).join('');
  const rows = dust.map((f) => {
    const esDest = f.id === _dustDest, sel = _dustSel.has(f.id);
    return `<label class="sp-dust-row${esDest ? ' dest' : ''}"><input type="checkbox" data-id="${esc(f.id)}" ${esDest || _dustBusy ? 'disabled' : ''} ${sel && !esDest ? 'checked' : ''}><span class="sym" style="color:${esc(f.m.color || '#cdd4dc')}">${esc(f.m.simbolo || f.id)}</span><span class="am"><b>${esc(fmtCoin(f.bal))}</b>${f.usd > 0 ? `<i>$${f.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</i>` : ''}</span></label>`;
  }).join('');
  m.innerHTML = `<div class="sp-wm-h"><span>Dust collector · merge into one coin</span>${btnDust}</div>
    <div class="sp-dust-dest"><span>Send everything to</span><div class="sp-dd-opts">${dests}</div></div>
    <div class="sp-dust-list">${rows}</div>
    <div class="sp-dust-foot">
      <div class="sp-dust-sum" id="sp-dust-sum"></div>
      <button class="sp-dust-go" id="sp-dust-go">Collect to ${esc(_dustDest)}</button>
      <div class="sp-dust-gas">We always keep about $1 in BNB for gas.</div>
      <div class="sp-dust-msg" id="sp-dust-msg"></div>
    </div>`;
  const bd = $('sp-wm-dust'); if (bd) bd.onclick = (e) => { e.stopPropagation(); _salirDust(); };
  m.querySelectorAll('.sp-dd[data-dest]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); if (_dustBusy) return; _dustDest = b.dataset.dest; _dustSel.delete(_dustDest); _pintarWallet(); });
  m.querySelectorAll('.sp-dust-row input[data-id]').forEach((c) => c.onchange = () => { if (c.checked) _dustSel.add(c.dataset.id); else _dustSel.delete(c.dataset.id); _sumDust(); });
  $('sp-dust-go').onclick = (e) => { e.stopPropagation(); _recolectarDust(); };
  _sumDust();
}
function _sumDust() {
  const { n, usd } = _usdSel(); const s = $('sp-dust-sum'), go = $('sp-dust-go');
  if (s) s.innerHTML = n ? `Merging <b>${n}</b> coin${n > 1 ? 's' : ''} · about <b>$${usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</b>` : '<span class="vac">Pick at least one coin</span>';
  if (go) go.disabled = !n || _dustBusy;
}
async function _recolectarDust() {
  if (_dustBusy) return;
  const sel = [..._dustSel]; if (!sel.length) return;
  const setMsg = (t, c) => { const e = $('sp-dust-msg'); if (e) { e.className = 'sp-dust-msg ' + (c || ''); e.innerHTML = t; } };
  _dustBusy = true; _pintarWallet(); setMsg('Checking gas…', 'info');
  try {
    const D2 = await _dustSpot();
    const cuenta = S.cuenta || (typeof window !== 'undefined' && window.__spotMockCuenta) || (cuentaActual && cuentaActual());
    const gas = await D2.revisarGas(cuenta);
    if (!gas.ok) { setMsg('You need a little BNB first to pay gas.', 'mal'); _dustBusy = false; _sumDust(); return; }
    const by = {}; (S._filasWallet || []).forEach((f) => by[f.id] = f);
    const fuentes = sel.map((id) => by[id]).filter(Boolean).map((f) => ({ addr: f.addr, nativo: f.nativo, sim: f.m.simbolo || f.id }));
    const destino = _dustDest === 'BNB' ? { nativo: true, sim: 'BNB' } : { addr: (MONEDAS.USDT && MONEDAS.USDT.address) || null, nativo: false, sim: 'USDT' };
    const r = await D2.recolectar({ fuentes, destino, cuenta, onPaso: (ev) => { if (ev.fase === 'swap') setMsg(`Swapping <b>${esc(ev.sim)}</b> (${ev.i}/${ev.n})… sign in your wallet`, 'info'); } });
    let s = `Done: <b>${r.hechos}</b> coin${r.hechos !== 1 ? 's' : ''} moved to ${esc(_dustDest)}.`;
    if (r.fallos.length) s += ` Could not: ${r.fallos.map((x) => esc(x.sim)).join(', ')} (no market).`;
    if (r.saltadas.some((x) => x.motivo === 'reserva de gas')) s += ` Kept your BNB for gas.`;
    if (r.cancelado) s += ` You cancelled; what is done stays.`;
    setMsg(s, r.fallos.length ? 'mal' : 'ok');
  } catch (e) {
    setMsg('Could not collect: ' + esc(String((e && (e.shortMessage || e.message)) || e)).slice(0, 80), 'mal');
  }
  _dustBusy = false;
  setTimeout(() => { try { renderWallet().then(() => { if ($('sp-walletmenu') && _dustOn) { _dustSel = new Set(); _pintarWallet(); } }); } catch (_) {} }, 2500);
}
function _dustCSS() {
  if (document.getElementById('sp-dust-css')) return;
  const st = document.createElement('style'); st.id = 'sp-dust-css';
  st.textContent = `
  .sp-walletmenu .sp-wm-h{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .sp-walletmenu.dustmode{display:flex;flex-direction:column;overflow:hidden}
  .sp-walletmenu.dustmode .sp-wm-h,.sp-walletmenu.dustmode .sp-dust-dest{flex:none}
  .sp-wm-dust{flex:none;min-height:0!important;width:auto!important;padding:3px 9px!important;border-radius:7px!important;border:1px solid var(--sp-gold-soft,#C9A84B)!important;background:rgba(232,184,75,.08)!important;color:var(--sp-gold,#E8B84B)!important;font-family:var(--sp-mono);font-size:9.5px!important;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
  .sp-wm-dust.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426)!important;border-color:#c79426!important;color:#3a2800!important}
  .sp-dust-dest{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;margin:2px 2px 6px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid var(--sp-line2,#2b3139)}
  .sp-dust-dest>span{font-family:var(--sp-mono);font-size:10.5px;color:var(--sp-ink3,#8b96a3)}
  .sp-dd-opts{display:flex;gap:5px}
  .sp-dd{min-height:0!important;width:auto!important;padding:6px 13px!important;border-radius:8px!important;border:1px solid #3a424c!important;background:transparent!important;color:var(--sp-ink2,#b7bdc6)!important;font-family:var(--sp-mono);font-weight:800;font-size:11px!important;cursor:pointer}
  .sp-dd.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426)!important;border-color:#c79426!important;color:#3a2800!important}
  .sp-dd:disabled{opacity:.5;cursor:default}
  .sp-dust-list{display:flex;flex-direction:column;gap:4px;flex:1 1 auto;min-height:0;overflow-y:auto}
  .sp-dust-row{display:flex!important;align-items:center;gap:10px;width:100%;min-height:40px;padding:0 11px;border-radius:9px;border:1px solid transparent;background:rgba(255,255,255,.02);cursor:pointer}
  .sp-dust-row:hover{border-color:#3a424c;background:rgba(255,255,255,.045)}
  .sp-dust-row.dest{opacity:.45;cursor:default}
  .sp-dust-row input{width:17px;height:17px;flex:none;accent-color:var(--sp-gold,#E8B84B);cursor:pointer}
  .sp-dust-row input:disabled{cursor:default}
  .sp-dust-row .sym{flex:none;font-weight:800;font-size:13px;letter-spacing:.03em}
  .sp-dust-row .am{flex:1;display:flex;flex-direction:column;align-items:flex-end;line-height:1.15}
  .sp-dust-row .am b{font-size:12px;color:var(--sp-ink,#eaecef);font-weight:800}
  .sp-dust-row .am i{font-style:normal;font-size:9px;color:var(--sp-ink3,#8b96a3)}
  .sp-dust-foot{flex:none;margin-top:6px;padding:9px 2px 2px;background:#141b24;border-top:1px solid var(--sp-line2,#2b3139)}
  .sp-dust-sum{text-align:center;font-family:var(--sp-mono);font-size:11px;color:var(--sp-ink2,#b7bdc6);margin-bottom:7px}
  .sp-dust-sum b{color:var(--sp-gold,#E8B84B)} .sp-dust-sum .vac{color:var(--sp-ink3,#8b96a3)}
  .sp-walletmenu .sp-dust-go{display:block;width:100%;min-height:42px!important;padding:11px!important;border-radius:11px!important;border:1px solid #c79426!important;background:linear-gradient(180deg,#f7db8d,#E8B84B 45%,#c79426)!important;color:#3a2800!important;font-family:var(--sp-display,inherit);font-weight:800;font-size:13px!important;cursor:pointer}
  .sp-walletmenu .sp-dust-go:disabled{opacity:.4;cursor:default}
  .sp-dust-gas{text-align:center;font-family:var(--sp-mono);font-size:9.5px;color:var(--sp-ink3,#8b96a3);margin-top:7px;line-height:1.5}
  .sp-dust-msg{text-align:center;font-family:var(--sp-mono);font-size:10.5px;line-height:1.5;margin-top:6px;min-height:14px}
  .sp-dust-msg.info{color:var(--sp-gold,#E8B84B)} .sp-dust-msg.ok{color:#2ee86a} .sp-dust-msg.mal{color:#f6465d}`;
  document.head.appendChild(st);
}
async function arrancarWallet() {
  // Reconecta la wallet que YA está autorizada en la página (igual que el resto del
  // sitio): así el saldo aparece solo, sin que el usuario pulse "conectar".
  try { if (reconectarSiProcede) await reconectarSiProcede(); } catch (_) {}
  try { renderWallet(); } catch (_) {}
  try { if (alCambiar) alCambiar(() => renderWallet()); } catch (_) {}
  clearInterval(_walletTimer); _walletTimer = setInterval(() => { try { renderWallet(); } catch (_) {} }, 25000);
}

/* Carga perezosa del cableado on chain (no trae ethers hasta que de verdad se opera). */
let _spC = null;
async function _contratoSpot() { if (!_spC) _spC = await import('./contrato.js?v=9'); return _spC; }

/* ── Puente al KEEPER (Worker de Cloudflare) para TP/SL/limite automaticos ── */
let _spK = null;
async function _keeperSpot() { if (!_spK) _spK = await import('./keeper-spot.js?v=3'); return _spK; }
/* Registra (o actualiza/cancela) el TP/SL de una posicion REAL en el keeper. Firma del
   dueno, sin gas. Si ya no hay ni TP ni SL, cancela la orden automatica. */
/* La salida automatica (keeper) vigila el precio en Binance, asi que SOLO funciona con pares
   listados en Binance. Los 86 de la lista lo estan; un token DEX pegado por contrato no. */
function _tieneBinance(par) { try { return !!(D.PARES && D.PARES.find((x) => x.id === par && x.s)); } catch (_) { return false; } }
async function _armarKeeper(id) {
  try {
    const p = M.posiciones().find((x) => x.id === id);
    if (!p || p.chainId == null) return;                 // solo posiciones reales
    const K = await _keeperSpot();
    // Si ya no hay TP ni SL ni trailing, se CANCELA la orden del keeper. Esto NO puede fallar en
    // silencio: quitar un stop que en realidad sigue activo es peligroso.
    if (p.tp == null && p.sl == null && !(p.trailing && p.trailing.pct > 0)) {
      try { await K.cancelarOrden(p.chainId); toast('Automatic order cancelled.', 'ok'); }
      catch (_) { toast('Could not cancel the automatic order; it may still be active. Try again.', 'bad'); }
      return;
    }
    // Par fuera de Binance: NO se puede vigilar su precio. En vez de dar un error, se avisa claro
    // (la proteccion no debe estorbar: simplemente no hay salida automatica para esa moneda).
    if (!_tieneBinance(p.par)) { toast('Automatic TP/SL runs on Binance-listed coins only; for this coin, close it manually.', 'warn'); return; }
    toast('Sign to arm your auto order (no gas)…', 'warn');
    await K.armarOrden(p);
    toast('Auto TP/SL armed. The keeper will fire it even with the app closed.', 'ok');
  } catch (e) { toast('Could not arm the auto order: ' + _errSpot(e), 'bad'); }
}
async function _cancelarKeeper(chainId) {
  if (chainId == null) return;
  try { const K = await _keeperSpot(); await K.cancelarOrden(chainId); } catch (_) {}
}
/* Reconcilia el registro local con el keeper: cierra aqui una posicion real SOLO cuando el
   keeper la marca 'cerrada' (ya CONFIRMADA cerrada on chain), no con solo 'disparada' (la tx
   pudo revertir): asi la vista nunca se desfasa mostrando cerrada una que sigue abierta. El
   nivel mostrado es aproximado; el resultado real esta on chain. No es un bucle: se llama con
   throttle solo mientras la vista esta abierta. */
let _reconKT = 0;
function _reconKeeperThrottle() { if (Date.now() - _reconKT < 30000) return; _reconKT = Date.now(); _reconciliarKeeper(); }
async function _reconciliarKeeper() {
  try {
    if (!S.walletOn) return;
    const cuenta = S.cuenta || (cuentaActual && cuentaActual());
    if (!cuenta) return;
    const K = await _keeperSpot();
    const est = await K.estadoKeeper(cuenta);
    if (!est || !Array.isArray(est.ordenes)) return;
    let cambio = false;
    for (const o of est.ordenes) {
      if (o.estado !== 'cerrada') continue;
      const p = M.posiciones().find((x) => x.chainId != null && Number(x.chainId) === Number(o.id));
      if (!p) continue;
      const nivel = (p.tp && p.sl) ? (S.marks[p.par] || S.mark) : (p.tp || p.sl || S.marks[p.par] || S.mark);
      M.cerrar(p.id, nivel, 'auto'); cambio = true;
    }
    if (cambio) renderPos();
  } catch (_) {}
}

/* Indicadores (botón "Indicators" en la gráfica). Módulo aparte, carga perezosa. */
let _indMod = null, _indInit = false;
async function cargarIndicadores() {
  try {
    if (!_indMod) _indMod = await import('./indicadores-spot.js?v=5');
    if (!_indInit) { _indMod.initIndSpot({ chart: () => S.chart, velas: () => S.velas, lc: () => window.LightweightCharts, host: () => $('sp-chart'), serie: () => S.serieVela }); _indInit = true; }
    _indMod.reaplicarInd();
  } catch (_) {}
}
function refrescarIndicadores() { try { if (_indMod && _indInit) _indMod.refrescarInd(); } catch (_) {} }
/* ¿El cursor está sobre un indicador? Si sí, el clic en la gráfica abre su config, no marca entry. */
function _indBajoCursor() { try { return _indMod && _indMod.bajoCursor && _indMod.bajoCursor(); } catch (_) { return null; } }
function _errSpot(e) {
  const m = String((e && (e.reason || e.shortMessage || e.message)) || e);
  if (/user rejected|rejected the request|denied/i.test(m)) return 'You cancelled the transaction.';
  if (/insufficient/i.test(m)) return 'Not enough balance or allowance for that amount.';
  return m.slice(0, 140);
}

async function operar(lado) {
  if (!S.side) { toast('Pick Long or Short above first.', 'warn'); return; }
  if (lado !== S.side) return;   // el botón contrario está deshabilitado
  if (!(S.cap > 0)) { toast('Enter an amount first.', 'warn'); return; }
  arranqueAudio();
  const base = S.par.id;
  const pxRef = S.modo === 'limit' ? S.limitPx : S.mark;
  if (!(pxRef > 0)) { toast('No price yet.', 'bad'); return; }
  // SPOT (long y short) sobre la moneda EN PANTALLA. El capital se compromete en USDT;
  // si fondeas con BNB, se valora con el precio de BNB. El contrato convierte solo.
  const bnbPx = (S.precios && S.precios.BNB) ? S.precios.BNB : 0;
  const capUsdt = S.pagar === 'BNB' ? S.cap * bnbPx : S.cap;
  if (!(capUsdt > 0)) { toast(S.pagar === 'BNB' ? 'No BNB price yet to value the order.' : 'Enter an amount first.', 'warn'); return; }
  const markClic = S.mark;   // precio EN EL MOMENTO DEL CLIC: la entrada se graba aquí, no tras minar (minutos después el precio ya se movió).
  const tp = tpslPrecioReal('tp', lado), sl = tpslPrecioReal('sl', lado);

  // ── LIMIT: por ahora queda marcada en el registro; se disparará cuando conectemos el keeper. ──
  if (S.modo === 'limit') {
    if (!(S.limitPx > 0)) { toast('Select Limit, then click the chart to mark the entry.', 'warn'); return; }
    const r = M.colocarOrden(S.par.id, base, lado, capUsdt, S.limitPx, S.mark, tp, sl);
    if (!r.ok) { toast('Could not mark the order.', 'bad'); return; }
    toast(`Marked ${lado} at ${fmtP(S.limitPx)}. It will fire once the automatic executor is connected.`, 'ok');
    S.limitPx = 0; $('sp-limit').value = ''; dibujarLimit();
    $('sp-tp').value = ''; $('sp-sl').value = ''; S.cap = 0; S.tam = 0; sincronCap(); renderPos(); renderEntry();
    return;
  }

  // ── MARKET ── Con wallet conectada y moneda operable en BSC: transacción real (no custodial).
  let operable = false;
  try { const C = await _contratoSpot(); operable = C.operableOnchain(S.par); } catch (_) {}

  if (S.walletOn && operable) {
    const btnL = $('sp-long'), btnS = $('sp-short');
    if (btnL) btnL.disabled = true; if (btnS) btnS.disabled = true;
    toast('Confirm the transaction in your wallet…', 'warn');
    try {
      const C = await _contratoSpot();
      const env = await C.abrirMercadoSpot({ par: S.par, lado, pagar: S.pagar, monto: S.cap, slippageBps: 100, floorOut: 0, refPrice: markClic });
      // La tx YA SE ENVIÓ. No esperamos a minar: registramos la posición al INSTANTE como
      // pendiente, liberamos la interfaz y confirmamos el minado en segundo plano. La entrada
      // se graba al precio del CLIC (markClic).
      const r = M.abrirMercado(S.par.id, base, lado, (env.costoUsdt > 0 ? env.costoUsdt : capUsdt), markClic, tp, sl, null, true);
      if (r.ok) flash(r.pos.entrada, lado, (lado === 'long' ? 'LONG' : 'SHORT') + ' sent');
      toast(`${lado === 'long' ? 'Long' : 'Short'} sent · confirming on-chain…`, 'ok'); snd('open');
      setSide(S.side);   // libera los botones YA, sin esperar al minado
      $('sp-tp').value = ''; $('sp-sl').value = ''; S.cap = 0; S.tam = 0; sincronCap(); renderPos(); renderEntry();
      const posId = r.ok ? r.pos.id : null;
      (async () => {
        try {
          const rec = await env.tx.wait();
          if (rec && Number(rec.status) === 0) throw new Error('reverted');
          let cid = null; try { cid = await (await _contratoSpot()).idDeRecibo(rec); } catch (_) {}
          if (posId) {
            if (cid != null) {
              M.setChainId(posId, cid); _armarKeeper(posId);   // confirma y arma el TP/SL en el keeper
              toast(`${lado === 'long' ? 'Long' : 'Short'} confirmed on-chain`, 'ok');
            } else {
              // Mino, pero no se pudo leer el id on chain. NO se confirma (se queda 'pend' para que
              // onPrecio no la simule ni la cierre en falso) y se avisa que la salida automatica no
              // quedo armada. Al reabrir Spot se podra reconciliar contra la cadena.
              toast('Opened on-chain, but its id could not be read to arm automatic TP/SL. Reopen Spot to sync.', 'warn');
            }
          }
          renderPos();
        } catch (err) {
          // Solo se BORRA si de verdad revirtio. Un fallo de red al confirmar NO significa que la
          // apertura fallara: borrarla dejaria una posicion real huerfana on chain. Se deja 'pend'.
          if (posId) {
            if (err && err.message === 'reverted') { M.eliminar(posId); toast('The on-chain open reverted; the position was removed.', 'bad'); }
            else { toast('Could not confirm the open on-chain; it stays pending and will sync. Your funds are safe.', 'warn'); }
          }
          renderPos();
        }
      })();
      return;
    } catch (e) {
      if (e && e.message === 'POOL_MALO') {
        // El pool on chain está mal valorado respecto al precio real: se BLOQUEA para no perder dinero.
        const px = e.pxOnchain > 0 ? fmtP(e.pxOnchain) : '?', ref = e.pxRef > 0 ? fmtP(e.pxRef) : '?';
        toast(`Blocked: ${esc(S.par.simbolo || base)} has an illiquid/mispriced on-chain pool (${px} vs ${ref} market). Trading it would lose you money.`, 'bad');
        setSide(S.side);
        return;
      }
      if (e && e.message === 'NO_POOL') {
        // La moneda no tiene pool en PancakeSwap: no se puede operar on chain. Abrir vista previa local.
        const r = M.abrirMercado(S.par.id, base, lado, capUsdt, markClic, tp, sl);
        if (r.ok) { flash(r.pos.entrada, lado, (lado === 'long' ? 'LONG' : 'SHORT') + ' opened'); toast(`${esc(S.par.simbolo || base)} has no PancakeSwap pool; opened as a local preview only.`, 'warn'); snd('open'); }
        else toast('This coin has no on-chain pool to trade.', 'bad');
        setSide(S.side); $('sp-tp').value = ''; $('sp-sl').value = ''; S.cap = 0; S.tam = 0; sincronCap(); renderPos(); renderEntry();
        return;
      }
      toast(_errSpot(e), 'bad');
      setSide(S.side);   // rehabilita los botones
      return;
    }
  } else {
    // Sin wallet (vista previa) o moneda aún no operable on chain: queda en el registro local.
    const r = M.abrirMercado(S.par.id, base, lado, capUsdt, markClic, tp, sl);
    if (!r.ok) { toast('Could not open the position.', 'bad'); return; }
    flash(r.pos.entrada, lado, (lado === 'long' ? 'LONG' : 'SHORT') + ' opened');
    toast(S.walletOn ? `${lado} opened (this coin is not on-chain yet; tracked locally).` : `${lado} opened at ${fmtP(r.pos.entrada)} (preview · connect your wallet to trade for real).`, S.walletOn ? 'warn' : 'ok');
    snd('open');
  }
  $('sp-tp').value = ''; $('sp-sl').value = '';
  S.cap = 0; S.tam = 0; sincronCap();
  renderPos(); renderEntry();
}

/* Cerrar una posición. Si se abrió on chain (tiene chainId) y hay wallet conectada, el
   cierre TAMBIÉN es on chain: pide firma, hace el swap y devuelve el resultado a tu wallet
   (1% de comisión solo si cierra en ganancia). Si es local (vista previa o moneda no
   operable), cierra solo en el registro. */
async function cerrarPosicion(id, btn, forzar) {
  const p = M.posiciones().find((x) => x.id === id); if (!p) return;
  if (p.pend) { toast('Still confirming the open on-chain; try again in a moment.', 'warn'); return; }
  if (p.cerrando) { toast('Already closing on-chain…', 'warn'); return; }
  const mk = S.marks[p.par] || S.mark;
  const feeTxt = (x) => x.fee > 0 ? ' · fee ' + (x.denom === 'USDT' ? fmtMoney(x.fee) : fmtCoin(x.fee) + ' ' + x.denom) : '';
  if (p.chainId != null) {
    // Posicion REAL: SOLO se cierra on chain. Sin wallet NO se cierra en local, porque eso la
    // sacaria de la pantalla mientras sigue ABIERTA on chain (fondos atrapados).
    if (!S.walletOn) { toast('Reconnect your wallet to close this on-chain position.', 'warn'); return; }
    // Seguro SINCRONO contra doble cierre (Close en la tabla + la X del grafico casi a la vez):
    // se marca "cerrando" ANTES de cualquier await; se revierte si el envio no llega a salir.
    M.marcarCerrando(id, true); if (btn) btn.disabled = true; renderPos();
    toast('Confirm the close in your wallet…', 'warn');
    let env;
    try { const C = await _contratoSpot(); env = await C.cerrarMercadoSpot({ id: p.chainId, slippageBps: 100, refPrice: mk, forzar: !!forzar }); }
    catch (e) {
      M.marcarCerrando(id, false); if (btn) btn.disabled = false;
      const msg = String((e && (e.reason || e.shortMessage || e.message)) || e);
      if (/already closed|no esta abierta|not open/i.test(msg)) {
        // Ya estaba cerrada on chain (p.ej. el keeper gano la carrera): finalizar aqui tambien,
        // en vez de dejar la posicion fantasma en pantalla.
        const x = M.cerrar(id, mk, 'auto'); if (x) toast('This position was already closed on-chain.', 'ok'); renderPos(); return;
      }
      if (e && e.message === 'POOL_MALO_SALIDA') {
        // Salida a mal precio por pool iliquido/podrido: NO cerrar en silencio. Avisar con las
        // cifras y dejar que el usuario decida (nunca atrapar a quien de verdad necesita salir).
        const pct = (e.desvPct != null) ? Math.round(e.desvPct) : '?';
        confirmarSheet({ titulo: 'Bad exit price', tono: 'sl', okLabel: 'Close anyway',
          sub: `This coin's on-chain pool looks illiquid: it would close about ${pct}% worse than the real market price. Close anyway?`,
          ok: () => cerrarPosicion(id, null, true) });
        renderPos(); return;
      }
      toast(_errSpot(e), 'bad'); renderPos(); return;
    }
    toast('Close sent · confirming on-chain…', 'ok'); renderPos();
    (async () => {
      try {
        const rec = await env.tx.wait();
        if (rec && Number(rec.status) === 0) throw new Error('reverted');
        _cancelarKeeper(p.chainId);   // cancelar el keeper SOLO con el cierre ya CONFIRMADO (si revierte, su TP/SL debe seguir)
        const x = M.cerrar(id, S.marks[p.par] || S.mark, 'manual');
        if (x) toast(`Closed ${x.pos.lado} · ${fmtPnL(x.pnl, x.denom)}${feeTxt(x)}`, x.pnl >= 0 ? 'ok' : 'bad');
        renderPos();
      } catch (err) {
        // No se confirmo. Sigue abierta y el keeper NO se cancelo, asi que su TP/SL sigue protegiendo.
        M.marcarCerrando(id, false);
        toast('The close did not confirm; the position stays open and still protected.', 'warn'); renderPos();
      }
    })();
    return;
  }
  // Local (vista previa o moneda no operable): cierre inmediato en el registro.
  const x = M.cerrar(id, mk, 'manual');
  if (x) { toast(`Closed ${x.pos.lado} · ${fmtPnL(x.pnl, x.denom)}${feeTxt(x)}`, x.pnl >= 0 ? 'ok' : 'bad'); renderPos(); }
}

/* ── Panel inferior ── */
function renderPos() {
  const pos = M.posiciones(), ord = M.ordenes(), hist = M.historial();
  $('sp-npos').textContent = pos.length; $('sp-nord').textContent = ord.length; $('sp-nhist').textContent = hist.length;
  const r = $('sp-pos-r'); if (r) r.innerHTML = '';
  const body = $('sp-pos-body'); if (!body) return;
  if (S.tab === 'pos') {
    if (!pos.length) { body.innerHTML = '<div class="sp-empty">No open positions. Open a Market trade, or mark a Limit entry on the chart.</div>'; return; }
    body.innerHTML = `<table class="sp-tbl"><thead><tr><th>Symbol</th><th>Coins</th><th>Entry</th><th>Mark</th><th>Amount</th><th>TP</th><th>SL</th><th>PnL</th><th></th></tr></thead><tbody>${pos.map(filaPos).join('')}</tbody></table>`;
    body.querySelectorAll('[data-cerrar]').forEach((b) => b.onclick = () => cerrarPosicion(b.dataset.cerrar, b));
    body.querySelectorAll('[data-trail]').forEach((b) => b.onclick = () => editarTrailing(b.dataset.trail));
    body.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => editarTPSL(b.dataset.edit, b.dataset.k));
    body.querySelectorAll('[data-share]').forEach((b) => b.onclick = () => { const p = pos.find((x) => x.id === b.dataset.share); if (p) tarjetaPnL(cerradoDesde(p)); });
  } else if (S.tab === 'ord') {
    if (!ord.length) { body.innerHTML = '<div class="sp-empty">No marked orders. In Limit mode, click the chart to mark where you want to enter.</div>'; return; }
    body.innerHTML = `<table class="sp-tbl"><thead><tr><th>Symbol</th><th>Side</th><th>Size</th><th>Mark-in</th><th>Current</th><th>TP</th><th>SL</th><th></th></tr></thead><tbody>${ord.map(filaOrd).join('')}</tbody></table>`;
    body.querySelectorAll('[data-cancel]').forEach((b) => b.onclick = () => { if (M.cancelarOrden(b.dataset.cancel)) renderPos(); });
    body.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => editarTPSL(b.dataset.edit, b.dataset.k));
  } else {
    const st = M.stats(30);
    const PP = 60, tot = hist.length, pags = Math.max(1, Math.ceil(tot / PP));
    if (S.histPage >= pags) S.histPage = pags - 1; if (S.histPage < 0) S.histPage = 0;
    const pag = hist.slice(S.histPage * PP, S.histPage * PP + PP);
    if (r) r.innerHTML = `<span class="sp-stat-chip">Win rate <b>${st.winRate}%</b></span><span class="sp-stat-chip">Trades <b>${st.n}</b></span>${tot > PP ? `<span class="sp-pager"><button class="sp-x" id="sp-prev"${S.histPage === 0 ? ' disabled' : ''}>‹</button><span>${S.histPage + 1}/${pags}</span><button class="sp-x" id="sp-next"${S.histPage >= pags - 1 ? ' disabled' : ''}>›</button></span>` : ''}`;
    if ($('sp-prev')) $('sp-prev').onclick = () => { S.histPage--; renderPos(); };
    if ($('sp-next')) $('sp-next').onclick = () => { S.histPage++; renderPos(); };
    if (!tot) { body.innerHTML = '<div class="sp-empty">No closed trades yet. Your track record builds here as you open and close trades.</div>'; return; }
    const cta = `<div class="sp-cert-cta"><button class="sp-cert-btn" id="sp-cert"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v3a5 5 0 0 1-10 0V4z"/><path d="M5 5H3v1a3 3 0 0 0 3 3M19 5h2v1a3 3 0 0 1-3 3M12 12v4M8 20h8M10 20v-1a2 2 0 0 1 4 0v1"/></svg> Download track record</button></div>`;
    body.innerHTML = cta + `<table class="sp-tbl"><thead><tr><th>Closed</th><th>Symbol</th><th>Side</th><th>Entry</th><th>Exit</th><th>PnL</th><th></th></tr></thead><tbody>${pag.map((h) => { const c = h.pnl >= 0 ? 'up' : 'down'; const d = new Date(h.cerrado); const f = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); const mo = h.motivo === 'tp' ? ' · TP' : h.motivo === 'sl' ? ' · SL' : ''; return `<tr><td>${f}</td><td><span class="sp-sym">${logoChip(h.par)} ${esc(h.par)}</span></td><td><span class="sp-tag ${h.lado}">${h.lado.toUpperCase()}</span></td><td>${fmtP(h.entrada)}</td><td>${fmtP(h.salida)}</td><td class="sp-pnl ${c}">${fmtPnL(h.pnl, h.denom || 'USDT')}${mo}</td><td><button class="sp-share" data-shareh="${h.id}" title="Export trade card">${IC.share}</button></td></tr>`; }).join('')}</tbody></table>`;
    body.querySelectorAll('[data-shareh]').forEach((b) => b.onclick = () => { const h = hist.find((x) => x.id === b.dataset.shareh); if (h) tarjetaPnL(h); });
    if ($('sp-cert')) $('sp-cert').onclick = pedirNombreCert;
  }
}
function celdaTPSL(obj, k, col) {
  return `<span class="sp-tpsl-c"><em style="color:${col}">${obj[k] ? fmtP(obj[k]) : '—'}</em><button class="sp-edit" data-edit="${obj.id}" data-k="${k}" title="Edit ${k.toUpperCase()}">${IC.edit}</button></span>`;
}
function filaPos(p) {
  const info = M.pnlDe(p, S.marks[p.par] || S.mark); const c = info.pnl >= 0 ? 'up' : 'down';
  const qty = p.qty != null ? p.qty : (p.entrada > 0 ? p.amount / p.entrada : 0);
  const est = (p.pend || p.cerrando) ? `<span style="color:#E8B84B;font-size:10px;font-weight:700;margin-left:5px;letter-spacing:.03em">${p.cerrando ? 'closing…' : 'confirming…'}</span>` : '';
  // Posicion LOCAL (vista previa): no se abrio on chain, no mueve fondos. Se marca claro para que
  // no se confunda con una real (no tiene salida automatica ni cierre on chain).
  const badgePrev = (p.chainId == null && !p.pend) ? `<span title="Local preview: not opened on-chain, no real funds" style="color:#8aa0b5;font-size:9px;font-weight:700;margin-left:5px;letter-spacing:.04em;border:1px solid #2a3542;border-radius:4px;padding:0 4px">PREVIEW</span>` : '';
  const btnCerrar = (p.pend || p.cerrando)
    ? `<button class="sp-x" disabled style="opacity:.55;cursor:default">${p.cerrando ? 'Closing…' : 'Confirming…'}</button>`
    : `<button class="sp-x" data-cerrar="${esc(p.id)}" data-par="${esc(p.par)}">Close</button>`;
  // Trailing stop (stop movil): solo en posiciones REALES (las dispara el keeper).
  const btnTrail = (p.chainId != null && !p.pend && !p.cerrando)
    ? `<button class="sp-x" data-trail="${esc(p.id)}" title="Trailing stop (automatico)" style="${p.trailing ? 'background:linear-gradient(180deg,#f0a93a,#c9781a);border-color:#ffcf7a;color:#241503' : ''}">${p.trailing ? 'Trail ' + p.trailing.pct + '%' : 'Trail'}</button>`
    : '';
  return `<tr><td><span class="sp-sym">${logoChip(p.par)} ${esc(etqPar(p.par))} <span class="sp-tag ${p.lado}">${p.lado.toUpperCase()}</span>${est}${badgePrev}</span></td>
    <td>${fmtCoin(qty)} ${esc(p.base || p.par)}</td><td>${fmtP(p.entrada)}</td><td data-mark="${p.id}">${fmtP(S.marks[p.par] || S.mark)}</td>
    <td>${fmtMoney(p.amount)}</td>
    <td>${celdaTPSL(p, 'tp', '#2ee86a')}</td><td>${celdaTPSL(p, 'sl', '#ff5b6e')}</td>
    <td class="sp-pnl ${c}" data-pnl="${p.id}">${fmtPnL(info.pnl, info.denom)}<span class="sp-pct">${pctTxt(info.pct)}</span></td>
    <td><span class="sp-acts"><button class="sp-share" data-share="${p.id}" title="Export trade card">${IC.share}</button>${btnTrail}${btnCerrar}</span></td></tr>`;
}
function filaOrd(o) {
  return `<tr><td><span class="sp-sym">${logoChip(o.par)} ${esc(etqPar(o.par))}</span></td>
    <td><span class="sp-tag ${o.lado}">${o.lado.toUpperCase()}</span></td>
    <td>${fmtMoney(o.amount)}</td><td>${fmtP(o.precio)}</td><td>${fmtP(S.marks[o.par] || S.mark)}</td>
    <td>${celdaTPSL(o, 'tp', '#2ee86a')}</td><td>${celdaTPSL(o, 'sl', '#ff5b6e')}</td>
    <td><button class="sp-x" data-cancel="${o.id}">Cancel</button></td></tr>`;
}
function logoChip(parId) { const p = D.PARES.find((x) => x.id === parId); const url = urlCssSeguro(p && p.cg && S.logos[p.cg]); return url ? `<i class="con" style="background-image:url(${esc(url)})"></i>` : `<i>${esc((parId || '?')[0])}</i>`; }
function refrescarPnL() {
  if (S.tab !== 'pos') return;
  M.posiciones().forEach((p) => {
    const mk = document.querySelector(`[data-mark="${p.id}"]`); if (mk) mk.textContent = fmtP(S.marks[p.par] || S.mark);
    const pe = document.querySelector(`[data-pnl="${p.id}"]`); if (pe) { const info = M.pnlDe(p, S.marks[p.par] || S.mark); pe.innerHTML = fmtPnL(info.pnl, info.denom) + `<span class="sp-pct">${pctTxt(info.pct)}</span>`; pe.className = 'sp-pnl ' + (info.pnl >= 0 ? 'up' : 'down'); }
  });
}
/* Tarjeta de una posición ABIERTA: usa el PnL EN VIVO (bruto), idéntico a lo que
   muestra la posición en pantalla (no resta comisiones de cierre). */
function cerradoDesde(p) { const mk = S.marks[p.par] || S.mark; const info = M.pnlDe(p, mk); return { par: p.par, base: p.base, lado: p.lado, amount: p.amount, qty: p.qty, entrada: p.entrada, salida: mk, pnl: info.pnl, denom: info.denom, cerrado: Date.now() }; }

/* Editar TP o SL de una posición o de una orden marcada (como en futuros). El
   SL no puede pasar el precio de liquidación: si lo pasa, se retira. Dejar el
   campo vacío (0) retira ese TP/SL. */
function editarTPSL(id, k) {
  const p = M.posiciones().find((x) => x.id === id) || M.ordenes().find((x) => x.id === id);
  if (!p) return;
  const esTP = k === 'tp';
  modalValor({
    titulo: esTP ? 'Take Profit' : 'Stop Loss',
    sub: `${esc(etqPar(p.par))} · ${p.lado === 'long' ? 'Long' : 'Short'}`,
    valor: p[k] || '', unidad: 'USDT', tono: esTP ? 'tp' : 'sl',
    ok: (v) => {
      let tp = p.tp || 0, sl = p.sl || 0;
      if (esTP) tp = v > 0 ? v : 0; else sl = v > 0 ? v : 0;
      M.setTPSL(p.id, tp, sl); renderPos(); _armarKeeper(p.id);   // propaga el TP/SL al keeper
    }
  });
}
/* Trailing stop: el usuario fija un porcentaje; el keeper hace que el stop siga al mejor
   precio sin retroceder. Solo en posiciones reales (las dispara el keeper). */
function editarTrailing(id) {
  const p = M.posiciones().find((x) => x.id === id);
  if (!p) return;
  if (p.chainId == null) { toast('Confirm the position on-chain first.', 'warn'); return; }
  modalValor({
    titulo: 'Trailing stop',
    sub: `${esc(etqPar(p.par))} · ${p.lado === 'long' ? 'Long' : 'Short'} · % from the best price`,
    valor: p.trailing ? p.trailing.pct : '', unidad: '%', tono: 'sl',
    ok: (v) => { M.setTrailing(p.id, v > 0 ? v : 0); renderPos(); _armarKeeper(p.id); }
  });
}
/* Confirmacion simple (si/no). Reutiliza el estilo de la hoja de modalValor, sin campo. */
function confirmarSheet(o) {
  const old = $('sp-sheet'); if (old) old.remove();
  const m = document.createElement('div'); m.className = 'sp-sheet'; m.id = 'sp-sheet';
  m.innerHTML = `<div class="bx"><h5>${esc(o.titulo || '')}</h5><div class="sub">${esc(o.sub || '')}</div>
    <div class="btns"><button id="sp-sheet-x">Cancel</button><button class="ok ${o.tono || ''}" id="sp-sheet-ok">${esc(o.okLabel || 'Confirm')}</button></div></div>`;
  document.body.appendChild(m);
  const cerrarS = () => { try { m.remove(); } catch (_) {} };
  m.querySelector('#sp-sheet-x').onclick = cerrarS;
  m.onclick = (e) => { if (e.target === m) cerrarS(); };
  m.querySelector('#sp-sheet-ok').onclick = () => { cerrarS(); try { o.ok && o.ok(); } catch (_) {} };
}
function modalValor(o) {
  const old = $('sp-sheet'); if (old) old.remove();
  const m = document.createElement('div'); m.className = 'sp-sheet'; m.id = 'sp-sheet';
  m.innerHTML = `<div class="bx"><h5>${esc(o.titulo)}</h5><div class="sub">${esc(o.sub || '')}</div>
    <div class="fld"><input type="number" id="sp-sheet-in" step="any" value="${o.valor ? o.valor : ''}" placeholder="0.00"><span class="u">${esc(o.unidad || '')}</span></div>
    <div class="btns"><button id="sp-sheet-x">Cancel</button><button class="ok ${o.tono || ''}" id="sp-sheet-ok">Confirm</button></div></div>`;
  document.body.appendChild(m);
  const cerrarS = () => { try { m.remove(); } catch (_) {} };
  const inp = m.querySelector('#sp-sheet-in'); setTimeout(() => { try { inp.focus(); inp.select(); } catch (_) {} }, 40);
  m.querySelector('#sp-sheet-x').onclick = cerrarS;
  m.onclick = (e) => { if (e.target === m) cerrarS(); };
  const confirmar = () => { const v = +inp.value || 0; cerrarS(); o.ok(v); };
  m.querySelector('#sp-sheet-ok').onclick = confirmar;
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') confirmar(); else if (e.key === 'Escape') cerrarS(); });
}

/* ── Línea de la orden limit en preparación ── */
function dibujarLimit() {
  if (!S.serieVela) return;
  if (S.lineaLimit) { try { S.serieVela.removePriceLine(S.lineaLimit); } catch (_) {} S.lineaLimit = null; }
  if (S.modo === 'limit' && S.limitPx > 0 && sinHerramienta()) { try { S.lineaLimit = S.serieVela.createPriceLine({ price: S.limitPx, color: '#C9A84B', lineWidth: 1, lineStyle: 3, axisLabelVisible: true }); } catch (_) {} }
}

/* ── Overlay de posiciones: entrada + PnL, liq, y controles TP/SL estilo
   TradingView (tiradores cuadrados junto a la tachuela, arrastrables). ── */
function ejeAncho() { try { const tw = S.chart.timeScale().width(); const cw = $('sp-cv').clientWidth; if (tw > 0 && cw > tw) return Math.max(44, Math.min(92, cw - tw)); } catch (_) {} return 66; }
function pintarFx() {
  const fx = $('sp-fx'), cv = $('sp-cv'); if (!fx || !cv || !S.serieVela) return;
  const _sh = sinHerramienta(); if (_sh !== S._sinHerr) { S._sinHerr = _sh; dibujarLimit(); }   // al activar/soltar una herramienta, oculta o restaura la línea entry
  const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (fx.width !== Math.round(W * dpr)) { fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); fx.style.width = W + 'px'; fx.style.height = H + 'px'; }
  const g = fx.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const Y = (p) => { try { const c = S.serieVela.priceToCoordinate(p); return c == null ? null : c; } catch (_) { return null; } };
  S._handles = [];
  const plotR = W - ejeAncho();
  const markY = Y(S.mark);
  // órdenes marcadas: línea dorada pulsante
  const pulso = 0.5 + 0.5 * Math.sin(performance.now() / 320);
  const gp = 0.5 + 0.5 * Math.sin(performance.now() / 600);   // iluminacion suave (glow) de las posiciones
  M.ordenes().filter((o) => o.par === S.par.id).forEach((o) => { const y = Y(o.precio); if (y == null) return; g.save(); g.setLineDash([6, 5]); g.strokeStyle = `rgba(232,184,75,${0.5 + 0.4 * pulso})`; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); etiqueta(g, plotR, y, (o.lado === 'long' ? 'LONG' : 'SHORT') + ' mark ' + fmtP(o.precio), '#E8B84B', '#2a1d00'); g.restore(); });
  // posiciones abiertas
  M.posiciones().filter((p) => p.par === S.par.id).forEach((p) => {
    const ey = Y(p.entrada); if (ey == null) return;
    const info = M.pnlDe(p, S.mark); const pnl = info.pnl, verde = pnl >= 0;
    const colPos = verde ? '#2ee86a' : '#ff5b6e';
    if (markY != null) { g.fillStyle = verde ? 'rgba(46,232,106,.08)' : 'rgba(255,91,110,.08)'; const a = Math.min(ey, markY), b = Math.max(ey, markY); g.fillRect(0, a, W, b - a); }
    // línea de entrada (verde en ganancia, roja en pérdida). En spot no hay liquidación.
    g.save(); g.strokeStyle = colPos; g.lineWidth = 1.8; g.shadowColor = verde ? 'rgba(46,232,106,.95)' : 'rgba(255,91,110,.95)'; g.shadowBlur = 5 + 9 * gp; g.beginPath(); g.moveTo(0, ey); g.lineTo(W, ey); g.stroke(); g.restore();
    // PRECIO DE ENTRADA en el eje derecho (para verlo siempre, como el precio actual)
    etiquetaEje(g, plotR, W, ey, fmtP(p.entrada), colPos, '#04210f');
    // X para cerrar la posición (extremo derecho, pegada al eje)
    const xbw = 18, xbx = plotR - xbw - 2;
    botonAspa(g, xbx, ey - 9, xbw, 18, 'rgba(255,107,122,.75)', '#ff6b7a');
    S._handles.push({ cerrarPos: p.id, par: p.par, x0: xbx - 5, x1: plotR, y0: ey - 11, y1: ey + 11 });
    // tachuela de la posición, con el PnL y su PORCENTAJE, a la izquierda de la X de cerrar
    const estTxt = p.pend ? '  · confirming…' : (p.cerrando ? '  · closing…' : '');
    const etqLeft = etiqueta(g, xbx - 5, ey, `${p.lado === 'long' ? 'LONG' : 'SHORT'}  ${fmtPnL(pnl, info.denom)}  ${pctTxt(info.pct)}${estTxt}`, colPos, '#04210f');
    // botones para crear TP/SL (solo los NO fijados), a la IZQUIERDA de la tachuela: orden TP · SL · LONG
    let rx = etqLeft - 6;
    if (!p.sl) { const bw = 30, bx = rx - bw; botonCuadro(g, bx, ey - 9, bw, 18, '#ff5b6e', 'SL', true); S._handles.push({ id: p.id, cual: 'sl', creating: true, x0: bx - 4, x1: bx + bw + 4, y0: ey - 11, y1: ey + 11 }); rx = bx - 6; }
    if (!p.tp) { const bw = 30, bx = rx - bw; botonCuadro(g, bx, ey - 9, bw, 18, '#2ee86a', 'TP', true); S._handles.push({ id: p.id, cual: 'tp', creating: true, x0: bx - 4, x1: bx + bw + 4, y0: ey - 11, y1: ey + 11 }); rx = bx - 6; }
    // TP/SL ya fijados: línea a su nivel con tirador arrastrable
    if (p.tp) ctrlTPSLfijo(g, p, 'tp', '#2ee86a', plotR, Y, gp);
    if (p.sl) ctrlTPSLfijo(g, p, 'sl', '#ff5b6e', plotR, Y, gp);
  });
  // alertas de precio: línea punteada cian + etiqueta con X para quitarla
  (S.alertas || []).forEach((al) => {
    const y = Y(al.px); if (y == null) return;
    g.save(); g.setLineDash([2, 3]); g.strokeStyle = 'rgba(94,200,232,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, y); g.lineTo(plotR, y); g.stroke(); g.setLineDash([]); g.restore();
    const aLeft = etiqueta(g, plotR, y, 'ALERT ' + fmtP(al.px), '#5ec8e8', '#042028');
    const abw = 16, abx = aLeft - 6 - abw;
    botonAspa(g, abx, y - 8, abw, 16, 'rgba(94,200,232,.7)', '#5ec8e8');
    S._handles.push({ alertaX: al.id, x0: abx - 4, x1: abx + abw + 4, y0: y - 10, y1: y + 10 });
  });
  // Entrada limit en preparación: etiqueta "entry" + X a su izquierda; la propia línea se arrastra
  if (S.modo === 'limit' && S.limitPx > 0 && sinHerramienta()) {
    const ey = Y(S.limitPx);
    if (ey != null) {
      const etqLeft = etiqueta(g, plotR, ey, 'entry', '#E8B84B', '#2a1d00');
      const xbw = 18, xbx = etqLeft - 6 - xbw;
      botonAspa(g, xbx, ey - 9, xbw, 18, '#C9A84B', '#E8B84B');
      S._handles.push({ entryX: true, x0: xbx - 4, x1: xbx + xbw + 4, y0: ey - 11, y1: ey + 11 });
      S._handles.push({ entryLine: true, x0: 0, x1: plotR, y0: ey - 6, y1: ey + 6 });
    }
  }
}
/* TP o SL ya fijado: línea punteada a su nivel + etiqueta + tirador arrastrable. */
function ctrlTPSLfijo(g, p, cual, col, plotR, Y, gp) {
  const set = cual === 'tp' ? p.tp : p.sl; const y = Y(set); if (y == null) return;
  const bw = 30, bh = 18, bx = plotR - bw - 2;
  g.save(); g.setLineDash([7, 4]); g.strokeStyle = col; g.lineWidth = 1.5; g.shadowColor = col; g.shadowBlur = 3 + 7 * (gp || 0); g.beginPath(); g.moveTo(0, y); g.lineTo(bx - 4, y); g.stroke(); g.setLineDash([]); g.restore();
  botonCuadro(g, bx, y - bh / 2, bw, bh, col, cual.toUpperCase(), false);
  const etqLeft = etiqueta(g, bx - 4, y, (cual === 'tp' ? 'TP ' : 'SL ') + fmtP(set), col, '#04210f');
  // X para QUITAR el TP/SL (a la izquierda de la etiqueta)
  const xbw = 16, xbx = etqLeft - 6 - xbw;
  botonAspa(g, xbx, y - 8, xbw, 16, 'rgba(255,107,122,.7)', '#ff6b7a');
  S._handles.push({ quitarTPSL: p.id, cual, x0: xbx - 4, x1: xbx + xbw + 4, y0: y - 10, y1: y + 10 });
  // Un TP/SL YA fijado NO se re-arrastra (eso obligaba a re-armar el keeper y era fuente de
  // errores). Se arrastra UNA sola vez al crearlo; para cambiarlo, se quita con la X y se vuelve
  // a arrastrar desde cero. Por eso aqui ya no se registra ninguna zona de arrastre, solo la X.
}
/* Recuadro con aspa (X): cancelar la entry, cerrar una posición o quitar una alerta. */
function botonAspa(g, x, y, w, h, colBorde, colAspa) {
  g.save();
  g.fillStyle = 'rgba(10,14,20,.92)'; redondea(g, x, y, w, h, 4); g.fill();
  g.strokeStyle = colBorde; g.lineWidth = 1.2; redondea(g, x + .7, y + .7, w - 1.4, h - 1.4, 4); g.stroke();
  g.strokeStyle = colAspa; g.lineWidth = 1.7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x + 6, y + 5); g.lineTo(x + w - 6, y + h - 5); g.moveTo(x + w - 6, y + 5); g.lineTo(x + 6, y + h - 5); g.stroke();
  g.restore();
}
function botonCuadro(g, x, y, w, h, col, txt, hueco) {
  g.save();
  if (hueco) { g.fillStyle = 'rgba(10,14,20,.92)'; redondea(g, x, y, w, h, 4); g.fill(); g.strokeStyle = col; g.lineWidth = 1.3; redondea(g, x + .7, y + .7, w - 1.4, h - 1.4, 4); g.stroke(); g.fillStyle = col; }
  else { g.fillStyle = col; redondea(g, x, y, w, h, 4); g.fill(); g.fillStyle = '#04210f'; }
  g.font = '800 10px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(txt, x + w / 2, y + h / 2 + .5);
  g.restore();
}
function etiqueta(g, xRight, y, txt, bg, fg) { g.save(); g.font = '700 10.5px "IBM Plex Mono", monospace'; const w = g.measureText(txt).width + 14; const x = xRight - w - 8; g.fillStyle = bg; redondea(g, x, y - 9, w, 18, 4); g.fill(); g.fillStyle = fg; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, x + 7, y + 0.5); g.restore(); return x; }
/* Etiqueta del PRECIO en el eje derecho (gutter), a la altura de una línea. Así el precio de
   entrada se ve siempre en el eje, igual que el precio actual de la moneda. */
function etiquetaEje(g, plotR, W, y, txt, bg, fg) {
  g.save(); g.font = '700 10px "IBM Plex Mono", monospace';
  const x = plotR + 1, w = Math.max(30, W - plotR - 2), h = 16;
  g.fillStyle = bg; redondea(g, x, y - h / 2, w, h, 3); g.fill();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x + w / 2, y + 0.5);
  g.restore();
}
function redondea(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ── Arrastre y creación de TP/SL (tiradores cuadrados del overlay) ── */
function wireDrag() {
  const host = $('sp-chart'), fx = $('sp-fx'); if (!host || !fx) return;
  const handleEn = (e) => {
    if (!(NIV.herr === 'cursor' || NIV.herr == null) || !S._handles || !S._handles.length) return null;
    const r = host.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    for (const h of S._handles) if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h;
    return null;
  };
  /* La capa fx deja pasar TODO a la gráfica (pan, zoom, arrastre de ejes,
     crosshair y clic). Solo "despierta" (pointer-events:auto) sobre un tirador. */
  host.addEventListener('mousemove', (e) => {
    if (S.drag) return;
    const h = handleEn(e);
    fx.style.pointerEvents = h ? 'auto' : 'none';
    fx.style.cursor = h ? (h.entryLine ? 'grab' : (h.entryX || h.cerrarPos || h.alertaX || h.quitarTPSL ? 'pointer' : 'ns-resize')) : '';
  });
  fx.addEventListener('mousedown', (e) => {
    const h = handleEn(e); if (!h) return;
    e.stopPropagation(); e.preventDefault();
    if (h.entryX) { S.limitPx = 0; const li = $('sp-limit'); if (li) li.value = ''; dibujarLimit(); renderEntry(); fx.style.pointerEvents = 'none'; return; }
    if (h.cerrarPos) { cerrarPosicion(h.cerrarPos); fx.style.pointerEvents = 'none'; return; }
    if (h.quitarTPSL) { const p = M.posiciones().find((x) => x.id === h.quitarTPSL); if (p) { M.setTPSL(p.id, h.cual === 'tp' ? 0 : (p.tp || 0), h.cual === 'sl' ? 0 : (p.sl || 0)); toast(`${h.cual.toUpperCase()} removed.`, 'ok'); renderPos(); _armarKeeper(p.id); } fx.style.pointerEvents = 'none'; return; }
    if (h.alertaX) { S.alertas = (S.alertas || []).filter((a) => a.id !== h.alertaX); toast('Alert removed.', 'ok'); fx.style.pointerEvents = 'none'; return; }
    if (h.entryLine) { S.drag = { entryLine: true }; fx.style.cursor = 'grabbing'; return; }
    const p = M.posiciones().find((x) => x.id === h.id); if (!p) return;
    if (h.creating) {
      const r = host.getBoundingClientRect(); let px; try { px = S.serieVela.coordinateToPrice(e.clientY - r.top); } catch (_) { px = null; }
      if (!(px > 0)) px = p.entrada * (h.cual === 'tp' ? (p.lado === 'long' ? 1.01 : 0.99) : (p.lado === 'long' ? 0.99 : 1.01));
      fijarTPSL(p, h.cual, px);
    }
    S.drag = { id: h.id, cual: h.cual };
  });
  window.addEventListener('mousemove', (e) => {
    if (!S.drag || !S.serieVela) return;
    const r = host.getBoundingClientRect(); const y = e.clientY - r.top;
    let px; try { px = S.serieVela.coordinateToPrice(y); } catch (_) { px = null; }
    if (!(px > 0)) return;
    if (S.drag.entryLine) { S.limitPx = +px.toFixed(dec(px)); const li = $('sp-limit'); if (li) li.value = S.limitPx; dibujarLimit(); renderEntry(); return; }
    const p = M.posiciones().find((x) => x.id === S.drag.id); if (p) fijarTPSL(p, S.drag.cual, px);
  });
  window.addEventListener('mouseup', () => {
    if (!S.drag) return;
    const line = S.drag.entryLine; const did = S.drag.id;
    S.drag = null; fx.style.pointerEvents = 'none';
    // Re-armar el keeper UNA sola vez, al SOLTAR (no en cada movimiento del arrastre, que pediria
    // una firma por pixel). Durante el arrastre solo se actualiza el nivel local para la linea.
    if (!line) { renderPos(); if (did != null) _armarKeeper(did); }
  });
}
/* Fija TP o SL al precio arrastrado (solo registro local; el keeper se re-arma al soltar).
   En spot no hay liquidación que respetar. */
function fijarTPSL(p, cual, px) {
  px = +(+px).toFixed(dec(px));
  M.setTPSL(p.id, cual === 'tp' ? px : (p.tp || 0), cual === 'sl' ? px : (p.sl || 0));
}

/* ── Animación + sonido ── */
function flash(price, lado, texto) {
  const host = $('sp-chart'); if (!host || !S.serieVela) return;
  let y; try { y = S.serieVela.priceToCoordinate(price); } catch (_) { y = null; } if (y == null) return;
  const tk = document.createElement('div'); tk.className = 'sp-ticket ' + (lado === 'long' ? 'long' : lado === 'short' ? 'short' : 'gold'); tk.style.top = y + 'px'; tk.textContent = texto;
  host.appendChild(tk); setTimeout(() => { try { tk.remove(); } catch (_) {} }, 2400);
}
function arranqueAudio() { try { if (!S.ac) S.ac = new (window.AudioContext || window.webkitAudioContext)(); if (S.ac.state === 'suspended') S.ac.resume(); } catch (_) {} }
function snd(tipo) {
  try {
    if (!S.ac) return; const ac = S.ac; let t = ac.currentTime;
    const seqs = { open: [[660, .07, .1], [880, .09, .1]], tp: [[784, .09, .13], [988, .09, .13], [1319, .16, .13]], sl: [[320, .11, .13], [240, .16, .13]], liq: [[180, .22, .16], [130, .3, .16]], alert: [[988, .12, .16], [1319, .12, .16], [988, .17, .16]] };
    (seqs[tipo] || []).forEach(([f, d, gg]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = (tipo === 'tp' || tipo === 'alert') ? 'sine' : 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.min(.6, gg * 2.7), t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d); t += d * .9; });
  } catch (_) {}
}

/* ── Alertas de precio (menú con clic derecho sobre la gráfica) ── */
function crearAlertaDemo(px) {
  if (!(px > 0) || !S.par) return;
  arranqueAudio();   // el gesto del usuario desbloquea el sonido del navegador
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); } catch (_) {}
  S.alertas = S.alertas || [];
  S.alertas.push({ id: 'al' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), px: +(+px).toFixed(dec(px)), dir: px >= S.mark ? 'up' : 'down' });
  S._alMark = S.mark;
  toast(`Alert set at ${fmtP(px)}. You'll hear it when price gets there.`, 'ok');
}
function revisarAlertas() {
  if (!S.alertas || !S.alertas.length || !(S.mark > 0)) return;
  const prev = S._alMark; S._alMark = S.mark;
  if (!(prev > 0)) return;
  for (let i = S.alertas.length - 1; i >= 0; i--) {
    const al = S.alertas[i];
    const cruzo = al.dir === 'up' ? (prev < al.px && S.mark >= al.px) : (prev > al.px && S.mark <= al.px);
    if (cruzo) { dispararAlerta(al); S.alertas.splice(i, 1); }
  }
}
function dispararAlerta(al) {
  try { arranqueAudio(); snd('alert'); } catch (_) {}
  try { toast(`Alert hit · ${S.par.id} at ${fmtP(al.px)}`, 'ok'); } catch (_) {}
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const opts = { body: `${S.par.id} reached ${fmtP(al.px)}`, tag: 'sp-alert', renotify: true };
      if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then((reg) => { try { (reg && reg.showNotification) ? reg.showNotification('Price alert', opts) : new Notification('Price alert', opts); } catch (_) {} }).catch(() => {});
      } else { new Notification('Price alert', opts); }
    }
  } catch (_) {}
}
function abrirCtxDemo(clientX, clientY, px) {
  cerrarCtxDemo();
  const up = px >= S.mark; const diff = S.mark > 0 ? (px - S.mark) / S.mark * 100 : 0;
  const el = document.createElement('div'); el.className = 'sp-ctx'; el.id = 'sp-ctx';
  el.innerHTML = `<div class="sp-ctx-px">${fmtP(px)}</div>` +
    `<div class="sp-ctx-sub ${up ? 'up' : 'down'}">${S.mark > 0 ? (up ? '+' : '') + diff.toFixed(2) + '% vs mark' : 'price'}</div>` +
    `<button class="sp-ctx-b" type="button" data-a="copy">Copy price</button>` +
    `<button class="sp-ctx-b" type="button" data-a="setpos">Set position</button>` +
    `<button class="sp-ctx-b alert" type="button" data-a="alert">Set alert</button>`;
  document.body.appendChild(el);
  const w = el.offsetWidth || 190, h = el.offsetHeight || 120;
  let left = clientX + 6, top = clientY + 6;
  if (left + w > window.innerWidth) left = clientX - w - 6;
  if (top + h > window.innerHeight) top = clientY - h - 6;
  el.style.left = Math.max(6, left) + 'px'; el.style.top = Math.max(6, top) + 'px';
  el.querySelector('[data-a="copy"]').onclick = () => { try { navigator.clipboard && navigator.clipboard.writeText(String(px)); } catch (_) {} toast('Price copied.', 'ok'); cerrarCtxDemo(); };
  el.querySelector('[data-a="alert"]').onclick = () => { crearAlertaDemo(px); cerrarCtxDemo(); };
  el.querySelector('[data-a="setpos"]').onclick = () => { abrirSetPosDemo(px, clientX, clientY); cerrarCtxDemo(); };
  setTimeout(() => { document.addEventListener('mousedown', ctxFueraDemo, true); document.addEventListener('keydown', ctxEscDemo, true); }, 0);
}
/* Set position en Spot: conserva ESTE menu propio (Copy price / Set position / Set
   alert) y, al tocar Set position, abre la MISMA ficha de orden.js que analisis, con
   el cfg de la grafica de Spot. Asi hereda toda la logica multimoneda: comprar o
   vender cualquier moneda con lo que ya tienes (BNB/USDT), sin duplicar lo ya tenido. */
let _odSpot = null;
async function abrirSetPosDemo(px, cx, cy) {
  try {
    if (!_odSpot) _odSpot = await import(new URL('../../assets/js/orden.js?v=139', import.meta.url).href);
    const cfg = {
      canvas: $('sp-cv'),
      par: () => (S.par && (S.par.coin || S.par.id)) || '',
      simbolo: () => (S.par && S.par.s) || '',
      precioActual: () => S.mark || ((S.velas && S.velas.length) ? S.velas[S.velas.length - 1].close : 0),
      precioEn: () => px,
      repintar: () => { try { renderTodo(); } catch (_) {} }
    };
    const act = cfg.precioActual();
    const vender = px >= (act || px);     // por encima del precio actual = vender (short)
    _odSpot.establecerPosicion(cfg, px, vender, cx, cy);
  } catch (_) { toast('Could not open Set position.', 'bad'); }
}
function ctxFueraDemo(e) { const el = $('sp-ctx'); if (el && !el.contains(e.target)) cerrarCtxDemo(); }
function ctxEscDemo(e) { if (e.key === 'Escape') cerrarCtxDemo(); }
function cerrarCtxDemo() { S._ctxCerradoEn = Date.now(); const el = $('sp-ctx'); if (el) { try { el.remove(); } catch (_) {} } document.removeEventListener('mousedown', ctxFueraDemo, true); document.removeEventListener('keydown', ctxEscDemo, true); }

/* ── Exportaciones ── */
function descargar(blob, nombre) { if (!blob) return; const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); }
function cargarImg(url, cross) { return new Promise((res) => { if (!url) return res(null); const im = new Image(); if (cross) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }); }
async function exportarChart() {
  if (!S.chart) { toast('Chart is not ready yet.', 'warn'); return; }
  let ch; try { ch = S.chart.takeScreenshot(); } catch (_) { toast('Could not export the chart.', 'bad'); return; }
  const W = ch.width, H = ch.height, top = 64;
  // Logo de la moneda: igual que Heat Pool (Share signal) → spothq en GitHub (con
  // CORS), respaldo CoinGecko. Así SÍ aparece el logo en la imagen exportada.
  const sym = ((S.par && S.par.id) || '').toLowerCase();
  const coinRepo = sym ? 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/' + sym + '.png' : null;
  const coinCg = S.par && S.par.cg && S.logos[S.par.cg];
  const [imgRepo, wm1] = await Promise.all([cargarImg(coinRepo, true), cargarImg(LOGO, false)]);
  const imgCoin = imgRepo || await cargarImg(coinCg, true);
  const imgWm = wm1 || await cargarImg(LOGO_ALT, false);
  const out = document.createElement('canvas'); out.width = W; out.height = H + top; const g = out.getContext('2d');
  g.fillStyle = '#0a0d12'; g.fillRect(0, 0, out.width, out.height);
  // Franja superior
  g.fillStyle = '#0e141c'; g.fillRect(0, 0, out.width, top);
  g.fillStyle = 'rgba(232,184,75,.28)'; g.fillRect(0, top - 1, out.width, 1);
  // Izquierda: la moneda (logo, nombre, precio) y debajo temporalidad y hora
  const r = 15, cx = 18 + r, cy = 27;
  if (imgCoin) { g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.closePath(); g.clip(); g.drawImage(imgCoin, cx - r, cy - r, r * 2, r * 2); g.restore(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
  else { g.fillStyle = '#232b36'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.fillStyle = '#c9d1d9'; g.font = '800 14px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((S.par.id || '?')[0], cx, cy + 1); }
  const tx = cx + r + 12;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '800 18px "Chakra Petch", sans-serif'; g.fillStyle = '#eaecef'; g.fillText(etqPar(S.par.id), tx, 27);
  const nameW = g.measureText(etqPar(S.par.id)).width;
  g.font = '700 16px "IBM Plex Mono", monospace'; g.fillStyle = S.chgPct >= 0 ? '#3ee88a' : '#ff6b7a'; g.fillText(fmtP(S.mark), tx + nameW + 12, 27);
  g.font = '700 11px "IBM Plex Mono", monospace'; g.fillStyle = '#8b96a3'; g.fillText(S.tf + '  ·  ' + new Date().toLocaleString('en-US'), tx, 48);
  // Derecha: rótulo Spot y nuestro dominio
  g.textAlign = 'right';
  g.font = '800 17px "Chakra Petch", sans-serif'; g.fillStyle = '#E8B84B'; g.fillText('Spot', out.width - 16, 27);
  g.font = '700 11.5px "IBM Plex Mono", monospace'; g.fillStyle = '#8b96a3'; g.fillText('decfreedom.com', out.width - 16, 48);
  // Grafica
  g.drawImage(ch, 0, top);
  // Posiciones activas: componer el overlay (sp-fx) encima de la gráfica exportada
  try { const fx = $('sp-fx'); if (fx && fx.width) g.drawImage(fx, 0, top, W, H); } catch (_) {}
  // Marca de agua: el logo (imagen) abajo a la izquierda, por encima del eje de tiempo
  if (imgWm && imgWm.width) { const wmH = 30, wmW = imgWm.width * (wmH / imgWm.height); g.save(); g.globalAlpha = .8; g.drawImage(imgWm, 18, out.height - wmH - 34, wmW, wmH); g.restore(); }
  try { out.toBlob((b) => { descargar(b, `spot-${S.par.id}-${S.tf}.png`); toast('Chart image exported.', 'ok'); }); } catch (_) { toast('Could not export the chart.', 'bad'); }
}
/* Tarjeta de operación: MISMA dinámica que el área de futuros (fondo long/short
   de portada/img, sello cco-sello, logo de la moneda). Spot real: SIN marca demo. */
async function tarjetaPnL(tr) {
  const esLong = tr.lado === 'long', gana = tr.pnl >= 0;
  const vcol = gana ? '#16c784' : '#f6465d', col = esLong ? '#16c784' : '#f6465d';
  const oro = '#E8B84B', blanco = '#ffffff';
  const logoUrl = tr.par ? 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/' + String(tr.par).toLowerCase() + '.png' : null;
  const [fondo, logo, sello] = await Promise.all([
    cargarImg(esLong ? IMG_LONG : IMG_SHORT, false),
    cargarImg(logoUrl, true),
    cargarImg(SELLO, false)
  ]);
  const W = 1670, H = 941;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  if (fondo) g.drawImage(fondo, 0, 0, W, H); else { g.fillStyle = '#0b0e12'; g.fillRect(0, 0, W, H); }
  const grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, 'rgba(5,7,10,.82)'); grad.addColorStop(.5, 'rgba(5,7,10,.42)'); grad.addColorStop(1, 'rgba(5,7,10,.05)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // Spot: sin marca de agua "demo".
  const X = 70; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  let topY = 132;
  g.save(); g.beginPath(); g.arc(X + 30, topY, 32, 0, 6.28); g.closePath(); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill(); g.clip();
  if (logo) g.drawImage(logo, X - 2, topY - 32, 64, 64); else { g.fillStyle = oro; g.font = '800 34px "Plus Jakarta Sans", sans-serif'; g.textAlign = 'center'; g.fillText((tr.par || '?')[0], X + 30, topY + 12); g.textAlign = 'left'; }
  g.restore();
  g.strokeStyle = 'rgba(232,184,75,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(X + 30, topY, 32, 0, 6.28); g.stroke();
  g.fillStyle = blanco; g.font = '800 46px "Plus Jakarta Sans", sans-serif'; g.fillText(etqPar(tr.par || ''), X + 80, topY + 16);
  topY += 86; g.fillStyle = col; g.font = '800 28px "IBM Plex Mono", monospace'; g.fillText((esLong ? 'LONG' : 'SHORT') + '  ·  SPOT', X, topY);
  topY += 50; const d = new Date(tr.cerrado || Date.now()); g.fillStyle = blanco; g.font = '500 24px "IBM Plex Mono", monospace';
  g.fillText(d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) + '  ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), X, topY);
  const pct = tr.entrada > 0 ? (esLong ? ((tr.salida - tr.entrada) / tr.entrada) : ((tr.entrada - tr.salida) / tr.entrada)) * 100 : 0;
  let cy = H * 0.42; g.fillStyle = vcol; g.font = '800 120px "IBM Plex Mono", monospace';
  g.fillText((pct >= 0 ? '+' : '') + pct.toFixed(2) + '%', X, cy);
  g.font = '800 52px "IBM Plex Mono", monospace';
  const pnlTxt = (tr.pnl >= 0 ? '+' : '−') + (tr.denom === 'USDT' ? (Math.abs(tr.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT') : (fmtCoin(Math.abs(tr.pnl)) + ' ' + (tr.denom || tr.base || '')));
  g.fillText(pnlTxt, X + 10, cy + 70);
  let iy = H * 0.62; g.fillStyle = oro; g.font = '700 22px "IBM Plex Mono", monospace'; g.fillText('ENTRY PRICE', X, iy); g.fillText('EXIT PRICE', X + 330, iy);
  g.fillStyle = blanco; g.font = '800 34px "IBM Plex Mono", monospace'; g.fillText(fmtP(tr.entrada), X, iy + 42); g.fillText(fmtP(tr.salida), X + 330, iy + 42);
  iy += 112; g.fillStyle = oro; g.font = '700 22px "IBM Plex Mono", monospace'; g.fillText('SPOT · decfreedom.com', X, iy);
  if (sello) { const lw = 150, lh = sello.height * (lw / sello.width); g.save(); g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = 18; g.shadowOffsetY = 5; g.drawImage(sello, X, H - lh - 44, lw, lh); g.restore(); }
  mostrarTarjeta(cv, `DecFreedom-${tr.par}.png`);
}
function mostrarTarjeta(cv, nombre) {
  const old = $('sp-modal'); if (old) old.remove();
  const m = document.createElement('div'); m.id = 'sp-modal'; m.innerHTML = `<div class="card"></div>`;
  m.querySelector('.card').appendChild(cv);
  const acts = document.createElement('div'); acts.className = 'acts'; acts.innerHTML = `<button class="dl">Download image</button><button class="cl">Close</button>`;
  m.querySelector('.card').appendChild(acts); document.body.appendChild(m);
  const ce = () => m.remove(); m.querySelector('.cl').onclick = ce; m.onclick = (e) => { if (e.target === m) ce(); };
  m.querySelector('.dl').onclick = () => { try { cv.toBlob((b) => descargar(b, nombre), 'image/png', 0.95); } catch (_) { toast('Could not export the image.', 'bad'); } };
}

/* ── Track record descargable (Spot) ───────────────────────────────────────
   Imagen (PNG) / PDF / CSV del historial. Marca SPOT, sin texto ni marca de
   agua "Demo". El total y la curva en $ agregan SOLO lo liquidado en USDT (los
   long); un short gana en su propia moneda y no se mezcla en el total en
   dólares, pero sí cuenta para el nº de trades y el win rate. */
function certStats() {
  const histN = M.historial();                     // mas reciente primero
  const hist = histN.slice().reverse();            // cronologico (todos)
  const n = hist.length;
  const wins = hist.filter((h) => h.pnl > 0).length;
  // PnL EN USD de cada cierre: los long ya están en USDT; los short están en la moneda,
  // así que se valoran con el precio de salida (coins · precio = USD). No se pierde ninguno.
  const pnlUsd = (h) => (h.denom || 'USDT') === 'USDT' ? (+h.pnl || 0) : ((+h.pnl || 0) * (+h.salida || 0));
  const total = hist.reduce((a, h) => a + pnlUsd(h), 0);
  let eq = 0; const curva = [0];                    // curva de PnL ACUMULADO real en USD (desde 0)
  hist.forEach((h) => { eq += pnlUsd(h); curva.push(eq); });
  const best = hist.length ? Math.max(0, ...hist.map(pnlUsd)) : 0;
  const saldo = (typeof S !== 'undefined' && S.balanceUsd > 0) ? S.balanceUsd : 0;   // saldo real de la cuenta
  const desde = n ? new Date(hist[0].cerrado) : null, hasta = n ? new Date(hist[n - 1].cerrado) : null;
  return { n, wins, losses: n - wins, winRate: n ? Math.round(wins / n * 100) : 0, total, best, saldo, curva, desde, hasta };
}
function wrapTexto(g, txt, x, y, maxW, lh) {
  const ws = txt.split(' '); let linea = '', yy = y;
  ws.forEach((p) => { const t = linea ? linea + ' ' + p : p; if (g.measureText(t).width > maxW && linea) { g.fillText(linea, x, yy); linea = p; yy += lh; } else linea = t; });
  if (linea) g.fillText(linea, x, yy);
}
function pedirNombreCert() {
  const old = $('sp-sheet'); if (old) old.remove();
  let prev = ''; try { prev = localStorage.getItem('sp-cert-name') || ''; } catch (_) {}
  const m = document.createElement('div'); m.className = 'sp-sheet'; m.id = 'sp-sheet';
  m.innerHTML = `<div class="bx"><h5>Spot track record</h5><div class="sub">Your name appears on the document.</div>
    <div class="fld"><input type="text" id="sp-cert-in" maxlength="46" placeholder="Your name" value="${esc(prev)}"></div>
    <div class="btns"><button id="sp-cert-x">Cancel</button><button class="ok" id="sp-cert-ok">Generate</button></div></div>`;
  document.body.appendChild(m);
  const cerrarS = () => { try { m.remove(); } catch (_) {} };
  const inp = m.querySelector('#sp-cert-in'); setTimeout(() => { try { inp.focus(); inp.select(); } catch (_) {} }, 40);
  m.querySelector('#sp-cert-x').onclick = cerrarS;
  m.onclick = (e) => { if (e.target === m) cerrarS(); };
  const go = () => { const nom = (inp.value || '').trim().slice(0, 46) || 'Spot Trader'; try { localStorage.setItem('sp-cert-name', nom); } catch (_) {} cerrarS(); generarCert(nom); };
  m.querySelector('#sp-cert-ok').onclick = go;
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); else if (e.key === 'Escape') cerrarS(); });
}
async function generarCert(nombre) {
  const st = certStats();
  const sello = await cargarImg(SELLO, false);
  const W = 1240, H = 1754; const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H; const g = cvs.getContext('2d');
  const oro = '#E8B84B', up = '#2ee86a', dn = '#ff5b6e', ink = '#eaecef', ink2 = '#9aa4af', ink3 = '#6b7580';
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b111a'); bg.addColorStop(1, '#070a0f'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = oro; g.fillRect(0, 0, W, 10);
  g.strokeStyle = 'rgba(232,184,75,.22)'; g.lineWidth = 2; g.strokeRect(22, 22, W - 44, H - 44);
  const M0 = 74;
  let domY = 92;
  if (sello) { const lw = 200, lh = sello.height * (lw / sello.width); g.drawImage(sello, W - M0 - lw, 54, lw, lh); domY = 54 + lh + 30; }
  g.textAlign = 'right'; g.fillStyle = ink3; g.font = '700 18px "IBM Plex Mono", monospace'; g.fillText('decfreedom.com', W - M0, domY);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = ink; g.font = '800 54px "Chakra Petch", sans-serif'; g.fillText('Trading', M0, 132);
  g.fillStyle = oro; g.font = '800 54px "Chakra Petch", sans-serif'; g.fillText('Certificate', M0, 196);
  g.fillStyle = ink3; g.font = '700 17px "IBM Plex Mono", monospace'; g.fillText('DECFREEDOM SPOT · TRACK RECORD', M0, 230);
  g.fillStyle = ink2; g.font = '600 19px "IBM Plex Mono", monospace'; g.fillText('Issued to', M0, 306);
  g.fillStyle = '#fff'; g.font = '800 42px "Plus Jakarta Sans", sans-serif'; g.fillText(nombre, M0, 352);
  g.fillStyle = '#c3cbd4'; g.font = '400 19px "Plus Jakarta Sans", sans-serif';
  wrapTexto(g, 'This document certifies the DecFreedom Spot track record of the closed trades over the period shown.', M0, 398, W - M0 * 2, 27);
  const periodo = st.desde ? (st.desde.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }) + '  →  ' + st.hasta.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' })) : '—';
  const tiles = [
    ['Trades', String(st.n), ink],
    ['Win rate', st.winRate + '%', st.winRate >= 50 ? up : ink],
    ['Net PnL', (st.total >= 0 ? '+' : '−') + '$' + Math.abs(st.total).toLocaleString('en-US', { maximumFractionDigits: 0 }), st.total >= 0 ? up : dn],
    ['Wins', String(st.wins), up],
    ['Losses', String(st.losses), dn],
    ['Account balance', st.saldo > 0 ? '$' + st.saldo.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—', ink]
  ];
  const tY = 480, tW = (W - M0 * 2 - 2 * 18) / 3, tH = 112;
  tiles.forEach((t, i) => {
    const x = M0 + (i % 3) * (tW + 18), y = tY + ((i / 3) | 0) * (tH + 16);
    g.fillStyle = 'rgba(255,255,255,.035)'; redondea(g, x, y, tW, tH, 12); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; redondea(g, x + .5, y + .5, tW - 1, tH - 1, 12); g.stroke();
    g.fillStyle = ink3; g.font = '700 14px "IBM Plex Mono", monospace'; g.textAlign = 'left'; g.fillText(t[0].toUpperCase(), x + 18, y + 33);
    g.fillStyle = t[2]; g.font = '800 33px "Chakra Petch", sans-serif'; g.fillText(t[1], x + 18, y + 78);
  });
  g.fillStyle = ink2; g.font = '600 18px "IBM Plex Mono", monospace'; g.textAlign = 'left'; g.fillText('Period:  ' + periodo, M0, tY + 2 * (tH + 16) + 36);
  const chY = 820, chH = 360, chW = W - M0 * 2;
  g.fillStyle = ink; g.font = '800 24px "Chakra Petch", sans-serif'; g.fillText('Cumulative PnL', M0, chY - 16);
  dibChartLinea(g, M0, chY, chW, chH, st.curva, oro);
  const bY = chY + chH + 78, bH = 240;
  g.fillStyle = ink; g.font = '800 24px "Chakra Petch", sans-serif'; g.fillText('Wins vs losses', M0, bY - 16);
  dibBarras(g, M0, bY, chW, bH, [['Wins', st.wins, up], ['Losses', st.losses, dn]]);
  const fY = H - 150;
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(M0, fY); g.lineTo(W - M0, fY); g.stroke();
  g.fillStyle = ink3; g.font = '600 16px "IBM Plex Mono", monospace'; g.textAlign = 'left'; g.fillText('Issued ' + new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · DecFreedom Spot', M0, fY + 34);
  g.textAlign = 'right'; g.fillText('Record generated from your DecFreedom Spot trade history.', W - M0, fY + 34); g.textAlign = 'left';
  mostrarCert(cvs, nombre);
}
function dibChartLinea(g, x, y, w, h, datos, col) {
  g.save();
  g.fillStyle = 'rgba(255,255,255,.02)'; redondea(g, x, y, w, h, 12); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; redondea(g, x + .5, y + .5, w - 1, h - 1, 12); g.stroke();
  if (!datos || datos.length < 2) { g.fillStyle = '#6b7580'; g.font = '600 18px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Not enough trades yet', x + w / 2, y + h / 2); g.restore(); return; }
  const padX = 20, padT = 24, padB = 24;
  let min = Math.min(...datos), max = Math.max(...datos);
  const base = (max - min) || (max * 0.02) || 1; min -= base * 0.14; max += base * 0.14; const rng = max - min;
  const px = (i) => x + padX + (w - padX * 2) * (datos.length === 1 ? 0.5 : i / (datos.length - 1));
  const py = (v) => y + padT + (h - padT - padB) * (1 - (v - min) / rng);
  g.textAlign = 'right'; g.textBaseline = 'middle'; g.font = '600 13px "IBM Plex Mono", monospace';
  for (let k = 0; k <= 3; k++) { const v = min + rng * k / 3, yy = py(v); g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + padX, yy); g.lineTo(x + w - padX, yy); g.stroke(); g.fillStyle = '#5a636e'; g.fillText('$' + Math.round(v).toLocaleString('en-US'), x + w - 10, yy); }
  if (min <= 0 && max >= 0) { const yb = py(0); g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + padX, yb); g.lineTo(x + w - padX, yb); g.stroke(); g.setLineDash([]); }
  const pts = datos.map((v, i) => ({ x: px(i), y: py(v) }));
  const trazo = () => { g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2; g.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y); } };
  const grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, 'rgba(232,184,75,.26)'); grd.addColorStop(1, 'rgba(232,184,75,0)');
  trazo(); g.lineTo(pts[pts.length - 1].x, y + h - padB); g.lineTo(pts[0].x, y + h - padB); g.closePath(); g.fillStyle = grd; g.fill();
  g.save(); g.shadowColor = 'rgba(232,184,75,.45)'; g.shadowBlur = 8; trazo(); g.strokeStyle = col; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke(); g.restore();
  pts.forEach((p, i) => { const last = i === pts.length - 1; g.beginPath(); g.arc(p.x, p.y, (i === 0 || last) ? 5 : 3.5, 0, 7); g.fillStyle = last ? '#fff' : col; g.fill(); if (last) { g.strokeStyle = col; g.lineWidth = 2; g.stroke(); } });
  g.restore();
}
function dibBarras(g, x, y, w, h, series) {
  g.save();
  const maxV = Math.max(1, ...series.map((s) => s[1]));
  const bw = 160, gap = 80; let bx = x + 30;
  series.forEach((s) => {
    const bh = Math.max(2, (h - 60) * (s[1] / maxV)); const by = y + (h - 34) - bh;
    g.fillStyle = s[2]; redondea(g, bx, by, bw, bh, 8); g.fill();
    g.fillStyle = '#eaecef'; g.font = '800 28px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.fillText(String(s[1]), bx + bw / 2, by - 12);
    g.fillStyle = '#9aa4af'; g.font = '700 16px "IBM Plex Mono", monospace'; g.fillText(s[0], bx + bw / 2, y + h - 4);
    bx += bw + gap;
  });
  g.restore();
}
function mostrarCert(cvs, nombre) {
  const old = $('sp-modal'); if (old) old.remove();
  const m = document.createElement('div'); m.id = 'sp-modal'; m.innerHTML = `<div class="card"></div>`;
  m.querySelector('.card').appendChild(cvs);
  const acts = document.createElement('div'); acts.className = 'acts';
  acts.innerHTML = `<button class="dl" id="cert-png">Image (PNG)</button><button id="cert-pdf">PDF</button><button id="cert-csv">Excel (CSV)</button><button class="cl">Close</button>`;
  m.querySelector('.card').appendChild(acts); document.body.appendChild(m);
  const ce = () => m.remove(); m.querySelector('.cl').onclick = ce; m.onclick = (e) => { if (e.target === m) ce(); };
  const base = 'DecFreedom-track-record-' + String(nombre).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  m.querySelector('#cert-png').onclick = () => { try { cvs.toBlob((b) => descargar(b, base + '.png'), 'image/png'); } catch (_) { toast('Could not export PNG.', 'bad'); } };
  m.querySelector('#cert-pdf').onclick = () => { try { const jpg = cvs.toDataURL('image/jpeg', 0.92); const bin = atob(jpg.split(',')[1]); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); descargar(pdfDeImagen(bytes, cvs.width, cvs.height), base + '.pdf'); toast('PDF exported.', 'ok'); } catch (_) { toast('Could not export PDF.', 'bad'); } };
  m.querySelector('#cert-csv').onclick = exportarCSV;
}
function pdfDeImagen(jpg, Wpx, Hpx) {
  const enc = new TextEncoder(); const parts = []; let len = 0; const off = [];
  const push = (d) => { const b = (typeof d === 'string') ? enc.encode(d) : d; parts.push(b); len += b.length; };
  const mark = () => off.push(len);
  const pageW = 595, pageH = Math.round(595 * Hpx / Wpx);
  push('%PDF-1.3\n');
  mark(); push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  mark(); push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  mark(); push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
  mark(); push('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + Wpx + ' /Height ' + Hpx + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'); push(jpg); push('\nendstream\nendobj\n');
  const content = 'q\n' + pageW + ' 0 0 ' + pageH + ' 0 0 cm\n/Im0 Do\nQ\n';
  mark(); push('5 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + 'endstream\nendobj\n');
  const xs = len; let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 0; i < 5; i++) xref += String(off[i]).padStart(10, '0') + ' 00000 n \n';
  push(xref); push('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xs + '\n%%EOF');
  return new Blob(parts, { type: 'application/pdf' });
}
function exportarCSV() {
  try {
    let nombre = ''; try { nombre = localStorage.getItem('sp-cert-name') || ''; } catch (_) {}
    const st = certStats();
    const pre = [
      'DecFreedom - Spot track record',
      'Trader,' + (nombre || 'Spot Trader'),
      'Issued,' + new Date().toISOString(),
      'Trades,' + st.n,
      'Wins,' + st.wins,
      'Losses,' + st.losses,
      'Win rate %,' + st.winRate,
      'Net PnL USD,' + st.total.toFixed(2),
      'Account balance USD,' + (st.saldo || 0).toFixed(2),
      'decfreedom.com', '', M.csv()
    ].join('\n');
    descargar(new Blob([pre], { type: 'text/csv' }), 'DecFreedom-track-record.csv'); toast('History exported (CSV).', 'ok');
  } catch (_) { toast('Could not export the history.', 'bad'); }
}

function renderTodo() { sincronCap(); pintarPrecio(); renderEntry(); renderPos(); }

/* ── How It Works (stepper, explicado para principiantes) ── */
const PASOS_SP = [
  {
    audio: true,
    t: 'Listen first',
    tEs: 'Escúchalo primero',
    d: 'In this short audio we explain all the benefits you can get inside the DecFreedom <b>Spot</b> section. Press play and let it walk you through it before you read the steps.',
    dEs: 'En este audio te explicamos todos los beneficios que puedes tener dentro de nuestra sección de <b>Spot</b> de DecFreedom. Dale a reproducir y deja que te lo cuente antes de leer los pasos.',
    x: 'Prefer to read? Use the arrows below to go through the guide step by step.',
    xEs: '¿Prefieres leer? Usa las flechas de abajo para recorrer la guía paso a paso.'
  },
  {
    t: 'What Spot is',
    d: 'Spot means you trade the <b>real coin</b>, not a contract. You own what you buy. There is <b>no leverage and no liquidation</b> here, so a position is never force closed. You can profit in <b>two</b> ways, whether the price goes up or down, and this short guide walks you through both.',
    x: 'What you see is what you hold. It is the safest way to learn to trade.'
  },
  {
    t: 'Start here: pick a direction',
    d: 'The very <b>first thing</b> you do is choose <b>Long</b> or <b>Short</b> at the <b>top</b> of the panel. That single choice sets up everything below it. Pick <b>Long</b> if you believe the price will go <b>up</b>. Pick <b>Short</b> if you believe it will go <b>down</b>. Until you pick one, nothing else is active, on purpose.',
    x: 'Long means buy the coin. Short means sell a coin you already hold.'
  },
  {
    t: 'Why Long and Short appear twice',
    d: 'This confuses everyone at first, so here it is plainly. The pair at the <b>top</b> is where you <b>choose</b> your direction and set the trade up. The pair at the <b>bottom</b> is the <b>button that actually opens</b> the position once your amount is ready. When you pick a side at the top, the <b>opposite</b> button at the bottom is <b>locked</b>, so you can never open the wrong way by accident.',
    x: 'Top = decide. Bottom = the real button that fires the order.'
  },
  {
    t: 'Long: you think it goes up',
    d: 'Going <b>long</b> is the one everyone knows. You spend <b>USDT</b> to buy the coin, betting the price rises. When you close, you sell it back. If the price went up, you get back <b>more USDT</b> than you spent. Your profit is in <b>USDT</b>.',
    x: 'Buy low, sell higher. The gain is money (USDT).'
  },
  {
    t: 'Short: sell high, buy back cheaper',
    d: 'This is the part no other exchange teaches on spot, and it is our favorite. Say you hold <b>1,000 BNB</b> and you think the price will drop. You <b>sell</b> them now and receive USDT. The tool <b>marks your sell point</b> on the chart and remembers the exact USDT you got. If the price <b>falls</b> and you buy back with that same USDT, you get <b>more than 1,000 BNB</b>. Those extra coins are your profit, no contract and nothing borrowed.',
    x: 'In plain words: sell 1,000 coins high, buy back 1,100 coins low. You gained 100 coins.'
  },
  {
    t: 'Watch your short, live',
    d: 'Once the short is open, the chart shows your <b>sell line</b> and the panel shows, second by second, <b>how much more coin</b> you would gain if you closed right now, and the <b>USDT</b> that sale gave you. If the price drops, your position turns <b>green and grows</b>, measured in coins. If it rises, it turns red. You never guess: you see your exact result before you act. We built this on purpose, it is the heart of Spot.',
    x: 'Your profit shows in the coin itself (for example +83 BNB), not in dollars.'
  },
  {
    t: 'Closing a short is just buying',
    d: 'To <b>close</b> a short you simply <b>buy the coin back</b> with the USDT you received when you sold. You do not feel it as buying, you feel it as <b>closing your position</b>, even if your wallet asks you to sign a step or two. Changed your mind and do not want to buy back? <b>Cancel</b> the position with the <b>X</b> or the <b>Close</b> button and nothing else happens.',
    x: 'Close = buy back with that same USDT. Cancel = walk away, no buy back.'
  },
  {
    t: 'Set your amount',
    d: 'Type or slide the <b>Amount</b>. For a long it is the <b>USDT</b> you spend. For a short it is how much of your <b>coin</b> you sell, and you choose which held coin from the unit button right next to the amount. The panel always shows exactly what you are committing before you open.',
    x: 'The % buttons size it against the balance you truly hold in your wallet.'
  },
  {
    t: 'Market or Limit, with TP and SL',
    d: '<b>Market</b> fills now at the mark price. <b>Limit</b> lets you mark your entry at any price. The fastest way: <b>right click the chart</b> and choose <b>Set position</b> to open the panel already pointed at that price, or pick a coin and set it by hand. A limit order fills when price reaches your mark. On an open position you set a <b>Take Profit</b> and a <b>Stop Loss</b> by dragging the small green and red squares, or with the pencil on each row.',
    x: 'Right click the chart → Set position to trade at the exact price you want.'
  },
  {
    t: 'Your wallet, your coins',
    d: 'The top shows your <b>real wallet balance</b>: the total plus a box for each coin you hold. Your open positions, marked orders and full history live at the bottom. It is <b>non custodial</b>, so your coins never leave your wallet.',
    x: 'Nothing leaves your wallet. This is real spot, built to operate.'
  },
  {
    t: 'What it costs: only if you win',
    d: 'Opening a trade is <b>free</b> on our side. We charge a small <b>1% of your profit</b>, in <b>BNB</b>, and <b>only when you close a trade in profit</b>. If a trade closes flat or at a loss, the platform fee is <b>zero</b>. That is how the service keeps running without charging you to simply operate, so it is always in our interest that you win.',
    x: 'Free to open. 1% of profit on a winning close. Nothing when you do not profit.'
  }
];
let _pasoSP = 0;
let _spLang = 'en';   // idioma del audio de la guia (en por defecto, es si el usuario lo cambia)
const AUDIO_SP = {
  en: new URL('../audio/spot/spot-en.MP3', import.meta.url).href,
  es: new URL('../audio/spot/spot-es.MP3', import.meta.url).href
};
function ayuda() {
  cerrarPops(); marcarAyudaVista();
  const old = $('sp-help'); if (old) old.remove();
  _pasoSP = 0;
  const m = document.createElement('div'); m.id = 'sp-help';
  m.innerHTML = `<div class="sp-hlp-bg"></div>
    <div class="sp-hlp-c">
      <div class="sp-hlp-head">
        <div class="sp-hlp-eyebrow">Spot</div>
        <div class="sp-hlp-top">
          <button class="sp-hlp-lang" id="sp-hlp-lang" type="button" title="Audio language">${_spLang.toUpperCase()}</button>
          <button class="sp-hlp-x" id="sp-help-x" type="button" aria-label="Close">✕</button>
        </div>
      </div>
      <div id="sp-hlp-body"></div>
    </div>`;
  document.body.appendChild(m);
  const ce = () => m.remove();
  m.querySelector('.sp-hlp-bg').onclick = ce; $('sp-help-x').onclick = ce;
  $('sp-hlp-lang').onclick = () => {
    _spLang = _spLang === 'en' ? 'es' : 'en';
    $('sp-hlp-lang').textContent = _spLang.toUpperCase();
    pintarPasoSP();   // si estamos en el paso de audio, recarga pista e idioma del texto
  };
  pintarPasoSP();
}
function pintarPasoSP() {
  const c = $('sp-hlp-body'); if (!c) return;
  const p = PASOS_SP[_pasoSP], ultimo = _pasoSP === PASOS_SP.length - 1;
  const es = _spLang === 'es';
  const tit = (es && p.tEs) ? p.tEs : p.t;
  const des = (es && p.dEs) ? p.dEs : p.d;
  const xtr = (es && p.xEs) ? p.xEs : p.x;
  const cuerpo = p.audio
    ? `<div class="sp-hlp-audio">
         <button class="sp-hlp-play" id="sp-hlp-play" type="button" aria-label="Play audio"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
         <div class="sp-hlp-audio-tx">
           <b>${es ? 'Guía en audio' : 'Audio guide'}</b>
           <span id="sp-hlp-audio-sub">${(es ? 'Español' : 'English')} · ${es ? 'toca para reproducir' : 'tap to play'}</span>
         </div>
         <audio id="sp-hlp-audio-el" preload="none" src="${es ? AUDIO_SP.es : AUDIO_SP.en}"></audio>
       </div>
       <div class="sp-hlp-d">${des}</div>`
    : `<div class="sp-hlp-d">${des}</div>`;
  c.innerHTML = `
    <div class="sp-hlp-card">
      <div class="sp-hlp-n">${_pasoSP + 1} <em>of ${PASOS_SP.length}</em></div>
      <div class="sp-hlp-t">${tit}</div>
      ${cuerpo}
      <div class="sp-hlp-x2">${xtr}</div>
    </div>
    <div class="sp-hlp-dots">${PASOS_SP.map((_, i) => `<i class="${i === _pasoSP ? 'on' : ''}" data-paso="${i}"></i>`).join('')}</div>
    <div class="sp-hlp-acts">
      ${_pasoSP > 0 ? `<button class="sp-hlp-back" id="sp-hlp-back">${es ? 'Atrás' : 'Back'}</button>` : ''}
      <button class="sp-hlp-next" id="sp-hlp-next">${ultimo ? (es ? 'Listo' : 'Got it') : (es ? 'Ver más' : 'Learn more')}</button>
    </div>`;
  const play = $('sp-hlp-play');
  if (play) {
    const el = $('sp-hlp-audio-el'), sub = $('sp-hlp-audio-sub');
    play.onclick = () => {
      if (!el) return;
      if (el.paused) {
        el.play().then(() => {
          play.classList.add('on');
          play.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
          if (sub) sub.textContent = es ? 'Reproduciendo…' : 'Playing…';
        }).catch(() => { if (sub) sub.textContent = es ? 'Audio no disponible' : 'Audio unavailable'; });
      } else {
        el.pause();
        play.classList.remove('on');
        play.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        if (sub) sub.textContent = (es ? 'Español' : 'English') + ' · ' + (es ? 'toca para reproducir' : 'tap to play');
      }
    };
    el.onended = () => {
      play.classList.remove('on');
      play.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      if (sub) sub.textContent = (es ? 'Español' : 'English') + ' · ' + (es ? 'toca para reproducir' : 'tap to play');
    };
  }
  $('sp-hlp-next').onclick = () => { if (_pasoSP >= PASOS_SP.length - 1) { const h = $('sp-help'); if (h) h.remove(); return; } _pasoSP++; pintarPasoSP(); };
  const bk = $('sp-hlp-back'); if (bk) bk.onclick = () => { _pasoSP = Math.max(0, _pasoSP - 1); pintarPasoSP(); };
  c.querySelectorAll('[data-paso]').forEach((b) => b.onclick = () => { _pasoSP = Number(b.dataset.paso); pintarPasoSP(); });
}
/* El punto rojo queda SIEMPRE: la operación short en spot es lo novedoso de la sección
   y queremos que todos abran la explicación. */
function marcarAyudaVista() {}

/* ── Barra de dibujo compartida ── */
function geoDib() {
  const cv = $('sp-cv'); if (!S.chart || !S.serieVela || !cv) return null;
  let ts; try { ts = S.chart.timeScale(); } catch (_) { return null; }
  const W = cv.clientWidth, H = cv.clientHeight;
  let x1; try { x1 = ts.width(); } catch (_) { x1 = W; } if (!(x1 > 0)) x1 = W;
  let y1 = H; try { const pn = S.chart.panes(); y1 = (pn && pn[0]) ? pn[0].getHeight() : H; } catch (_) { y1 = H; } if (!(y1 > 0)) y1 = H;
  let vr; try { vr = ts.getVisibleLogicalRange(); } catch (_) { vr = null; } if (!vr) return null;
  const nV = S.velas.length;
  const iA = Math.max(0, Math.min(nV - 1, Math.ceil(vr.from))), iB = Math.max(0, Math.min(nV - 1, iA + 1));
  let paso, b; const xA = ts.logicalToCoordinate(iA), xB = ts.logicalToCoordinate(iB);
  if (xA == null || xB == null || iB === iA) { paso = (ts.options().barSpacing) || 9; b = (xA != null) ? xA - paso * iA : 0; }
  else { paso = (xB - xA) / (iB - iA); b = xA - paso * iA; }
  if (!(paso > 0)) paso = 9;
  const pri = 0.5 - b / paso, ancho = x1 / paso, fin = pri + ancho;
  const pMax = S.serieVela.coordinateToPrice(0), pMin = S.serieVela.coordinateToPrice(y1);
  if (pMax == null || pMin == null) return null;
  const Y = (p) => { const c = S.serieVela.priceToCoordinate(p); return (c == null) ? (y1 * (pMax - p) / ((pMax - pMin) || 1)) : c; };
  return { W, H, x1, y1, pMin, pMax, Y, ancho, paso, fin };
}
let _syncPend = false;
function sincronizarDib() { if (!S.barra) return; if (_syncPend) return; _syncPend = true; requestAnimationFrame(() => { _syncPend = false; const g = geoDib(); if (g) { try { S.barra.redibujar(g, S.velasDib, S.par.id); } catch (_) {} } }); }
function montarBarraDemo() {
  const host = $('sp-chart'); if (!host || S.dibMontada) { sincronizarDib(); return; }
  try { NIV.seccion = 'demo'; S.barra = montarBarra(host); if (S.barra && S.barra._tools) S.barra._tools.classList.add('nv-oculta'); S.dibMontada = true; if (window.ResizeObserver && !S.cvObs) { S.cvObs = new ResizeObserver(() => sincronizarDib()); S.cvObs.observe($('sp-cv')); } sincronizarDib(); } catch (_) { S.barra = null; }
}

/* ── Menú de monedas ── */
function menuMonedas() {
  cerrarPops();
  const anc = $('sp-coin'), r = anc.getBoundingClientRect();
  const m = document.createElement('div'); m.className = 'sp-pop'; m.id = 'sp-coinmenu';
  m.style.left = Math.max(8, r.left) + 'px'; m.style.top = (r.bottom + 6) + 'px';
  const lista = D.PARES.filter((p) => p.grupo !== 'divisa' && p.grupo !== 'materia');
  const esCT = (s) => /^0x[0-9a-fA-F]{40}$/.test(String(s || '').trim());
  const pintar = (q) => {
    const lst = m.querySelector('.sp-lst');
    if (esCT(q)) {   // pegó un contrato: ofrecer abrirlo (como en Terminal)
      lst.innerHTML = `<button class="it it-ct" data-ct="${esc(q)}"><i>⤵</i><b>Open contract</b><span>${esc(q.slice(0, 6))}…${esc(q.slice(-4))}</span></button>`;
      const b = lst.querySelector('[data-ct]'); if (b) b.onclick = () => cargarContrato(q);
      return;
    }
    const f = !q ? lista : lista.filter((p) => (p.id + ' ' + (p.n || '')).toLowerCase().includes(q.toLowerCase()));
    lst.innerHTML = f.slice(0, 60).map((p) => { const url = urlCssSeguro(p.cg && S.logos[p.cg]); return `<button class="it ${p.id === S.par.id ? 'on' : ''}" data-id="${esc(p.id)}">${url ? `<i class="con" style="background-image:url(${esc(url)})"></i>` : `<i>${esc(p.id[0])}</i>`}<b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`; }).join('');
    lst.querySelectorAll('.it').forEach((b) => b.onclick = async () => { await seleccionarMoneda(b.dataset.id); montarBarraDemo(); });
  };
  m.innerHTML = `<input type="text" placeholder="Paste contract or search symbol" id="sp-cm-q"><div class="sp-lst"></div>`;
  document.body.appendChild(m); pintar('');
  const inp = m.querySelector('#sp-cm-q'); inp.oninput = () => pintar(inp.value.trim());
  inp.onkeydown = (e) => { if (e.key === 'Enter' && esCT(inp.value.trim())) cargarContrato(inp.value.trim()); };
  setTimeout(() => inp.focus(), 0);
  m.onclick = (e) => e.stopPropagation();
  setTimeout(() => document.addEventListener('mousedown', cierraPopFuera), 0);
}
/* Precio legible para la lista de movers: caras con 2 decimales, baratas con los
   decimales que hagan falta (ej. PEPE 0.0000123). */
function fmtPrecioMv(p) {
  if (!(p > 0)) return '—';
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  if (p >= 0.0001) return p.toFixed(6);
  return p.toPrecision(2);
}
/* Carga en la grafica CUALQUIER par USDT de Binance (los movers no estan en D.PARES).
   Son pares reales de Binance, asi que la gráfica, el ticker y el stream funcionan por
   par.s = BASE+USDT, igual que una moneda normal. */
function cargarParBinance(base, logo, addr) {
  if (!base) return;
  const p = { id: base, coin: base, s: base + 'USDT', fuente: 'binance', n: base, cg: null, simbolo: base, disp: base + '/USDT', logo: logo || '', address: (typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr)) ? addr : '' };
  cerrarPops();
  if (S.par && S.par.id === p.id && S.par.fuente === 'binance') return;
  S.par = p; S._posAuto = null;
  cargarDatos();
}
/* Selector de ALTA VOLATILIDAD: los que mas se mueven hoy (Binance 24h), con liquidez,
   para operar porcentajes grandes. Reusa el pop; cada fila: logo+nombre | precio | %. */
let _moversCache = null, _moversT = 0, _moversProm = null;
/* Lista blanca de monedas LIQUIDAS de verdad en PancakeSwap/BSC: Binance-Peg con pool
   profunda que sigue el precio de Binance, o nativas de BSC. Evita que se cuelen pools
   trampa (tipo ZKC) que tienen volatilidad y volumen en Binance pero pool mala en BSC,
   donde el swap sale robado. Solo RESTRINGE: una moneda solo aparece si ya venia con
   direccion de la lista BSC. El guardia de precio (contrato.js) es el respaldo. */
const MOVERS_OK = new Set([
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'DOT', 'LTC', 'AVAX', 'UNI', 'AAVE', 'CAKE', 'TWT',
  'SHIB', 'FLOKI', 'PEPE'
]);
/* Una sola fuente de datos con cache de 60s y sin pedir dos veces a la vez. */
function traerMovers() {
  const now = Date.now();
  if (_moversCache && (now - _moversT) < 60000) return Promise.resolve(_moversCache);
  if (_moversProm) return _moversProm;
  // Sin reja de volatilidad: la lista blanca MOVERS_OK es el unico filtro (las monedas
  // liquidas rara vez pasan el 7% de amplitud, y las que lo pasan son las trampa). Tope
  // alto para que el corte interno no deje fuera a ninguna. Vienen ordenadas por amplitud
  // (la que mas se mueve hoy, arriba).
  _moversProm = D.movers24h({ minAmp: 0, factorBTC: 0, minVol: 5e5, max: 1000 }).then((r) => { _moversCache = Array.isArray(r) ? r.filter((d) => d && MOVERS_OK.has(d.base)) : []; _moversT = Date.now(); _moversProm = null; return _moversCache; })
    .catch((e) => { _moversProm = null; throw e; });
  return _moversProm;
}
/* Precarga en segundo plano: al abrir Spot se va trayendo, asi el selector abre al
   instante en vez de dejar la ventana vacia esperando. */
function precargarMovers() { try { traerMovers().catch(() => {}); } catch (_) {} }
async function menuMovers() {
  cerrarPops();
  const anc = $('sp-vol') || $('sp-coin'); const r = anc.getBoundingClientRect();
  const m = document.createElement('div'); m.className = 'sp-pop sp-pop-mv'; m.id = 'sp-movermenu';
  m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 348)) + 'px';
  m.style.top = (r.bottom + 6) + 'px';
  m.innerHTML = `
    <div class="sp-mv-head"><b>Top movers</b><span>24h · high volatility</span></div>
    <input type="text" class="sp-mv-q" id="sp-mv-q" placeholder="Filter by symbol" autocomplete="off">
    <div class="sp-lst sp-mv-lst" id="sp-mv-lst"><div class="sp-mv-msg">Loading movers…</div></div>`;
  document.body.appendChild(m);
  m.onclick = (e) => e.stopPropagation();
  setTimeout(() => document.addEventListener('mousedown', cierraPopFuera), 0);
  const q = m.querySelector('#sp-mv-q');
  let datos = [];
  const pintar = () => {
    const lst = $('sp-mv-lst'); if (!lst) return;
    const txt = (q.value || '').trim().toUpperCase();
    const f = txt ? datos.filter((d) => d.base.includes(txt)) : datos;
    if (!f.length) { lst.innerHTML = `<div class="sp-mv-msg">${datos.length ? 'No match.' : 'No high volatility movers right now.'}</div>`; return; }
    lst.innerHTML = f.map((d) => {
      const up = d.chgPct >= 0;
      const img = d.logo ? `<img src="${esc(d.logo)}" alt="" loading="lazy" onerror="this.remove()">` : '';
      return `<button class="mv${(S.par && S.par.id === d.base) ? ' on' : ''}" data-base="${esc(d.base)}" data-logo="${esc(d.logo || '')}" data-addr="${esc(d.address || '')}">
        <span class="mv-l"><i class="mv-ic">${esc((d.base[0] || '?'))}${img}</i><b>${esc(d.base)}</b><small>USDT</small></span>
        <span class="mv-p">${esc(fmtPrecioMv(d.price))}</span>
        <span class="mv-c ${up ? 'up' : 'dn'}">${up ? '+' : ''}${d.chgPct.toFixed(2)}%</span>
      </button>`;
    }).join('');
    lst.querySelectorAll('.mv').forEach((b) => b.onclick = () => cargarParBinance(b.dataset.base, b.dataset.logo, b.dataset.addr));
  };
  q.oninput = pintar;
  q.onkeydown = (e) => e.stopPropagation();
  setTimeout(() => { try { q.focus(); } catch (_) {} }, 0);
  if (_moversCache) { datos = _moversCache; pintar(); }   // si ya estaba precargado, instantaneo
  try {
    datos = await traerMovers();
    if ($('sp-movermenu')) pintar();
  } catch (_) {
    const lst = $('sp-mv-lst'); if (lst && !datos.length) lst.innerHTML = `<div class="sp-mv-msg">Could not load movers. Try again.</div>`;
  }
}
function cierraPopFuera(e) { if (_dustBusy) return; const ids = ['sp-coinmenu', 'sp-shortmenu', 'sp-walletmenu', 'sp-movermenu']; const anc = ['sp-coin', 'sp-amtunit', 'sp-coinsbtn', 'sp-vol']; const hit = ids.some((id) => { const m = $(id); return m && m.contains(e.target); }) || anc.some((id) => { const a = $(id); return a && a.contains(e.target); }); if (!hit) cerrarPops(); }
function cerrarPops() { ['sp-coinmenu', 'sp-shortmenu', 'sp-walletmenu', 'sp-movermenu'].forEach((id) => { const m = $(id); if (m) m.remove(); }); document.removeEventListener('mousedown', cierraPopFuera); }

function toast(msg, tipo) { const old = document.querySelector('.sp-toast'); if (old) old.remove(); const t = document.createElement('div'); t.className = 'sp-toast ' + (tipo || ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => { try { t.remove(); } catch (_) {} }, 320); }, 2600); }

function cerrar() {
  try { clearInterval(_walletTimer); } catch (_) {} _walletTimer = null;
  try { if (S.uiRAF) cancelAnimationFrame(S.uiRAF); } catch (_) {} S.uiRAF = null;
  try { pararStream(); } catch (_) {} _streamKey = '';
  try { if (S.cvObs) S.cvObs.disconnect(); } catch (_) {} S.cvObs = null;
  if (S.onResize) { window.removeEventListener('resize', S.onResize); S.onResize = null; }
  try { if (S.barra && S.barra.desmontar) S.barra.desmontar(); } catch (_) {} S.barra = null; S.dibMontada = false;
  try { if (S.chart) S.chart.remove(); } catch (_) {} S.chart = null; S.serieVela = null;
  try { if (S.ac) S.ac.close(); } catch (_) {} S.ac = null;
  cerrarPops(); cerrarCtxDemo();
  ['sp-modal', 'sp-sheet', 'sp-help'].forEach((id) => { const el = $(id); if (el) el.remove(); });
  S.alertas = []; S._alMark = 0;
  S.expand = false; S.drag = null;
  const ov = $('sp-overlay'); if (ov) ov.remove();
}
