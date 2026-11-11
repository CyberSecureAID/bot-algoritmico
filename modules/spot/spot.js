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

import { estilos } from './estilos.js?v=15';
import * as D from './datos.js?v=8';
import * as M from './motor.js?v=7';
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
  side: null, shortCoin: null,
  lev: 1, cap: 0, tam: 0, modo: 'market', limitPx: 0, histPage: 0,
  tpUnit: 'px', slUnit: 'px', sumOpen: false, alertas: [], _alMark: 0,
  stream: null, barra: null, dibMontada: false, lineaLimit: null, tab: 'pos',
  uiRAF: null, onResize: null, cvObs: null, marks: {}, logos: {},
  drag: null, hoverH: null, ac: null, expand: false,
  saldos: {}, precios: {}, walletOn: false, cuenta: null
};

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
/* Texto del fee: 0.2% de la ganancia (lo cobra el contrato en BNB, solo si ganas). */
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
    <button class="sp-back" id="sp-back">${IC.back} Back</button>
    <span class="sp-brand">Spot</span>
    <button class="sp-coin" id="sp-coin"><i id="sp-coin-ico">B</i><b id="sp-coin-id">BTC</b>${IC.chev}</button>
    <div class="sp-tf" id="sp-tf"><button class="cur" id="sp-tfcur">1m <span class="cv">▾</span></button><div class="menu" id="sp-tfmenu"></div></div>
    <div class="sp-px"><div class="sp-px-big" id="sp-mark">—</div><div class="sp-px-sub">Mark · <span id="sp-pair">BTCUSDT</span></div></div>
    <div class="sp-wallet" id="sp-wallet">
      <div class="sp-bal-boxes" id="sp-bal-boxes"></div>
      <button class="sp-coinsbtn" id="sp-coinsbtn" title="All your coins"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg><b id="sp-coinsn">0</b><span class="cv">▾</span></button>
      <div class="sp-bal-total"><span class="lbl">Total balance</span><b id="sp-eq">—</b></div>
    </div>
    <button class="sp-icobtn" id="sp-expand" title="Expand chart">${IC.expand}</button>
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
        <button class="sp-icobtn sp-exit" id="sp-exit" title="Exit full chart">${IC.shrink} Exit</button>
        <div class="sp-spin" id="sp-spin"><i></i></div>
        <div class="sp-nochart" id="sp-nochart" style="display:none"></div>
      </div>
      <div class="sp-entry">
        <div class="sp-side" id="sp-side">
          <button class="sp-side-b long" data-side="long" id="sp-side-long">Long<small>buy the coin</small></button>
          <button class="sp-side-b short" data-side="short" id="sp-side-short">Short<small>sell a coin you hold</small></button>
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
            <div class="sp-sum-note">Spot order. Long spends USDT; short sells the coin you hold. No leverage and no liquidation. We charge <b>nothing to open</b> and <b>0.2% of your profit</b> (in BNB) only when you close a winning trade. If you do not profit, there is no platform fee.</div>
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
  { const cb = $('sp-coinsbtn'); if (cb) cb.onclick = (e) => { e.stopPropagation(); menuMonedasWallet(); }; }
  $('sp-export').onclick = exportarChart;
  $('sp-expand').onclick = toggleExpand;
  $('sp-exit').onclick = toggleExpand;
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
  $('sp-amtunit').onclick = (e) => { e.stopPropagation(); if (S.side === 'short') menuMonedasShort(); };
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
function disponibleActual() { return (S.side === 'short' && S.shortCoin) ? (S.saldos[S.shortCoin] || 0) : M.balance(); }
function unidadActual() { if (S.side === 'short' && S.shortCoin) { const m = MONEDAS[S.shortCoin]; return (m && m.simbolo) || parIdDeToken(S.shortCoin) || S.shortCoin; } return 'USDT'; }
/* Monedas que el usuario TIENE y puede usar para abrir un short (saldo > 0, operable y
   sin estables de $1). Incluye tokens DEX como BabyDoge, USDT.z o EXT. */
function monedasShort() {
  const s = S.saldos || {};
  return Object.keys(s).filter((id) => (s[id] || 0) > 1e-12 && !ESTABLES.includes(id) && tokenOperable(id));
}
function setCap(c) { S.cap = Math.max(0, +c || 0); S.tam = S.cap; sincronCap(); renderEntry(); }
function setCapPct(pct) { setCap(disponibleActual() * Math.max(0, Math.min(100, +pct || 0)) / 100); }
function setTam(t) { setCap(t); }
function sincronCap() {
  const av = disponibleActual();
  const capr = $('sp-capr'); if (capr) { const pct = av > 0 ? Math.min(100, S.cap / av * 100) : 0; capr.value = Math.round(pct); capr.style.setProperty('--f', Math.round(pct) + '%'); }
  const capv = $('sp-capv'); if (capv && document.activeElement !== capv) capv.value = S.cap ? +S.cap.toFixed(unidadActual() === 'USDT' ? 2 : 8) : '';
  const au = $('sp-amtunit'); if (au) { au.textContent = unidadActual(); au.classList.toggle('pick', S.side === 'short'); }
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
  if (side === 'short') {
    const disp = monedasShort();
    if (!S.shortCoin || !disp.includes(S.shortCoin)) S.shortCoin = disp[0] || null;
    if (S.shortCoin && S.shortCoin !== (S.par && S.par.coin)) { seleccionarMoneda(S.shortCoin); }
  }
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
  if (S.side === 'short') S.shortCoin = coinId;
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
/* Menú de las monedas que tienes para abrir un short. */
function menuMonedasShort() {
  cerrarPops();
  const disp = monedasShort(), ancla = $('sp-amtunit'); if (!ancla) return;
  const m = document.createElement('div'); m.id = 'sp-shortmenu'; m.className = 'sp-shortmenu';
  m.innerHTML = disp.length
    ? disp.map((id) => { const mo = MONEDAS[id] || { simbolo: id }; const bal = S.saldos[id] || 0; return `<button data-coin="${esc(id)}" class="${id === S.shortCoin ? 'on' : ''}"><span class="sym">${esc(mo.simbolo || id)}</span><b>${esc(fmtCoin(bal))}</b></button>`; }).join('')
    : '<div class="sp-cm-empty">You hold no coins that can be shorted.</div>';
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  m.querySelectorAll('[data-coin]').forEach((b) => b.onclick = () => { S.shortCoin = b.dataset.coin; seleccionarMoneda(S.shortCoin); S.cap = 0; S.tam = 0; sincronCap(); renderEntry(); cerrarPops(); });
  setTimeout(() => document.addEventListener('mousedown', cierraPopFuera), 10);
}

function toggleExpand() {
  S.expand = !S.expand;
  const ov = $('sp-overlay'); if (ov) ov.classList.toggle('sp-expand', S.expand);
  const b = $('sp-expand'); if (b) { b.classList.toggle('on', S.expand); b.innerHTML = S.expand ? IC.shrink : IC.expand; b.title = S.expand ? 'Exit full chart' : 'Full chart'; }
  // la grafica (autoSize) se reajusta sola; forzamos un par de sincronizaciones
  try { window.dispatchEvent(new Event('resize')); } catch (_) {}
  setTimeout(() => { try { window.dispatchEvent(new Event('resize')); sincronizarDib(); } catch (_) {} }, 80);
  setTimeout(() => { try { sincronizarDib(); } catch (_) {} }, 240);
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
  const url = (par.cg && S.logos[par.cg]) || LOGOS_SPOT[id] || (S._logoDex && S._logoDex[id]) || '';
  if (url) { el.style.backgroundImage = `url(${url})`; el.classList.add('con'); el.textContent = ''; return; }
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
  if (u && S.par && (S.par.coin || S.par.id) === id) { const el = $('sp-coin-ico'); if (el) { el.style.backgroundImage = `url(${u})`; el.classList.add('con'); el.textContent = ''; } }
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
  try { chart.subscribeClick((p) => { if (!p || !p.point || S.drag || !sinHerramienta()) return; const px = S.serieVela.coordinateToPrice(p.point.y); if (!(px > 0)) return; if (S.modo !== 'limit') { S.modo = 'limit'; const ov = $('sp-overlay'); if (ov) ov.querySelectorAll('.sp-mode').forEach((x) => x.classList.toggle('on', x.dataset.modo === 'limit')); const lw = $('sp-limitwrap'); if (lw) lw.style.display = 'flex'; } S.limitPx = +px.toFixed(dec(px)); const li = $('sp-limit'); if (li) li.value = S.limitPx; dibujarLimit(); renderEntry(); }); } catch (_) {}
  dibujarLimit();
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
  const ev = M.onPrecio(S.par.id, px, hi, lo); let cambio = false;
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
  let amountUsdt;
  if (S.side === 'short') {
    amountUsdt = S.cap * (px || 0);            // vendes S.cap monedas; su valor en USDT
    if (ql) ql.textContent = 'You sell, value';
    if (qp) qp.textContent = (S.cap > 0 && px > 0) ? fmtMoney(amountUsdt) : '—';
  } else {
    amountUsdt = S.cap;                          // gastas S.cap USDT para comprar la moneda
    const coins = px > 0 ? S.cap / px : 0;
    if (ql) ql.textContent = 'You buy';
    if (qp) qp.textContent = coins > 0 ? (fmtCoin(coins) + ' ' + base) : '—';
  }
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
    return { id, m, bal, usd, op: tokenOperable(id) && !ESTABLES.includes(id) };
  }).sort((a, b) => b.usd - a.usd);
  S._filasWallet = filas;
  if (boxes) { boxes.innerHTML = filas.length ? filas.map(cajaSaldo).join('') : '<div class="sp-bal-box sp-bal-empty">No balances yet</div>'; boxes.querySelectorAll('[data-coin]').forEach((b) => b.onclick = () => seleccionarMoneda(b.dataset.coin)); ajustarTira(); requestAnimationFrame(ajustarTira); }
  if (cn) cn.textContent = String(filas.length);
  if (eqEl) eqEl.textContent = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  try { renderEntry(); } catch (_) {}
}
/* Popup con TODAS las monedas de la wallet (botón junto a Total balance). */
function menuMonedasWallet() {
  cerrarPops();
  const filas = S._filasWallet || [], ancla = $('sp-coinsbtn'); if (!ancla) return;
  const m = document.createElement('div'); m.id = 'sp-walletmenu'; m.className = 'sp-walletmenu';
  m.innerHTML = filas.length
    ? '<div class="sp-wm-h">Your coins · tap one to trade it</div>' + filas.map((f) => `<button ${f.op ? `data-coin="${esc(f.id)}"` : 'disabled'} class="${f.id === (S.par && S.par.coin) ? 'on' : ''}${f.op ? '' : ' nop'}" title="${esc(f.m.nombre || f.id)}"><span class="sym" style="color:${esc(f.m.color || '#cdd4dc')}">${esc(f.m.simbolo || f.id)}</span><span class="am"><b>${esc(fmtCoin(f.bal))}</b>${f.usd > 0 ? `<i>$${f.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}</i>` : ''}</span></button>`).join('')
    : '<div class="sp-cm-empty">No coins in your wallet yet.</div>';
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  m.querySelectorAll('[data-coin]').forEach((b) => b.onclick = () => { seleccionarMoneda(b.dataset.coin); cerrarPops(); });
  setTimeout(() => document.addEventListener('mousedown', cierraPopFuera), 10);
}
async function arrancarWallet() {
  // Reconecta la wallet que YA está autorizada en la página (igual que el resto del
  // sitio): así el saldo aparece solo, sin que el usuario pulse "conectar".
  try { if (reconectarSiProcede) await reconectarSiProcede(); } catch (_) {}
  try { renderWallet(); } catch (_) {}
  try { if (alCambiar) alCambiar(() => renderWallet()); } catch (_) {}
  clearInterval(_walletTimer); _walletTimer = setInterval(() => { try { renderWallet(); } catch (_) {} }, 25000);
}

function operar(lado) {
  if (!S.side) { toast('Pick Long or Short above first.', 'warn'); return; }
  if (lado !== S.side) return;   // el botón contrario está deshabilitado
  if (!(S.cap > 0)) { toast('Enter an amount first.', 'warn'); return; }
  arranqueAudio();
  const base = S.par.id;
  const pxRef = S.modo === 'limit' ? S.limitPx : S.mark;
  if (!(pxRef > 0)) { toast('No price yet.', 'bad'); return; }
  // SPOT: long gasta USDT (amount = S.cap USDT). short vende S.cap monedas base;
  // su valor en USDT = S.cap · precio. Validación no custodial contra la wallet.
  const amountUsdt = lado === 'short' ? S.cap * pxRef : S.cap;
  if (S.walletOn) {
    if (lado === 'long' && (S.saldos.USDT || 0) + 1e-9 < amountUsdt) { toast('Not enough USDT in your wallet for that amount.', 'bad'); return; }
    if (lado === 'short') { const have = (S.saldos[S.shortCoin] || 0); if (have + 1e-9 < S.cap) { toast(`Not enough ${unidadActual()} in your wallet to sell that amount.`, 'bad'); return; } }
  }
  const tp = tpslPrecioReal('tp', lado), sl = tpslPrecioReal('sl', lado);
  let r;
  if (S.modo === 'limit') {
    if (!(S.limitPx > 0)) { toast('Select Limit, then click the chart to mark the entry.', 'warn'); return; }
    r = M.colocarOrden(S.par.id, base, lado, amountUsdt, S.limitPx, S.mark, tp, sl);
    if (r.ok) { toast(`Marked ${lado} at ${fmtP(S.limitPx)}. The price decides when it fills.`, 'ok'); S.limitPx = 0; $('sp-limit').value = ''; dibujarLimit(); }
  } else {
    r = M.abrirMercado(S.par.id, base, lado, amountUsdt, S.mark, tp, sl);
    if (r.ok) { flash(r.pos.entrada, lado, (lado === 'long' ? 'LONG' : 'SHORT') + ' opened'); toast(`${lado === 'long' ? 'Long' : 'Short'} opened at ${fmtP(r.pos.entrada)}`, 'ok'); snd('open'); }
  }
  if (!r.ok) { toast('Could not place the order.', 'bad'); return; }
  $('sp-tp').value = ''; $('sp-sl').value = '';
  S.cap = 0; S.tam = 0; sincronCap();
  renderPos(); renderEntry();
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
    body.querySelectorAll('[data-cerrar]').forEach((b) => b.onclick = () => { const x = M.cerrar(b.dataset.cerrar, S.marks[b.dataset.par] || S.mark, 'manual'); if (x) { toast(`Closed ${x.pos.lado} · ${fmtPnL(x.pnl, x.denom)}`, x.pnl >= 0 ? 'ok' : 'bad'); renderPos(); } });
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
  return `<tr><td><span class="sp-sym">${logoChip(p.par)} ${esc(etqPar(p.par))} <span class="sp-tag ${p.lado}">${p.lado.toUpperCase()}</span></span></td>
    <td>${fmtCoin(qty)} ${esc(p.base || p.par)}</td><td>${fmtP(p.entrada)}</td><td data-mark="${p.id}">${fmtP(S.marks[p.par] || S.mark)}</td>
    <td>${fmtMoney(p.amount)}</td>
    <td>${celdaTPSL(p, 'tp', '#2ee86a')}</td><td>${celdaTPSL(p, 'sl', '#ff5b6e')}</td>
    <td class="sp-pnl ${c}" data-pnl="${p.id}">${fmtPnL(info.pnl, info.denom)}<span class="sp-pct">${pctTxt(info.pct)}</span></td>
    <td><span class="sp-acts"><button class="sp-share" data-share="${p.id}" title="Export trade card">${IC.share}</button><button class="sp-x" data-cerrar="${p.id}" data-par="${p.par}">Close</button></span></td></tr>`;
}
function filaOrd(o) {
  return `<tr><td><span class="sp-sym">${logoChip(o.par)} ${esc(etqPar(o.par))}</span></td>
    <td><span class="sp-tag ${o.lado}">${o.lado.toUpperCase()}</span></td>
    <td>${fmtMoney(o.amount)}</td><td>${fmtP(o.precio)}</td><td>${fmtP(S.marks[o.par] || S.mark)}</td>
    <td>${celdaTPSL(o, 'tp', '#2ee86a')}</td><td>${celdaTPSL(o, 'sl', '#ff5b6e')}</td>
    <td><button class="sp-x" data-cancel="${o.id}">Cancel</button></td></tr>`;
}
function logoChip(parId) { const p = D.PARES.find((x) => x.id === parId); const url = p && p.cg && S.logos[p.cg]; return url ? `<i class="con" style="background-image:url(${esc(url)})"></i>` : `<i>${esc((parId || '?')[0])}</i>`; }
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
      M.setTPSL(p.id, tp, sl); renderPos();
    }
  });
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
    // X para cerrar la posición (extremo derecho, pegada al eje)
    const xbw = 18, xbx = plotR - xbw - 2;
    botonAspa(g, xbx, ey - 9, xbw, 18, 'rgba(255,107,122,.75)', '#ff6b7a');
    S._handles.push({ cerrarPos: p.id, par: p.par, x0: xbx - 5, x1: plotR, y0: ey - 11, y1: ey + 11 });
    // tachuela de la posición, a la izquierda de la X de cerrar
    const etqLeft = etiqueta(g, xbx - 5, ey, `${p.lado === 'long' ? 'LONG' : 'SHORT'}  ${fmtPnL(pnl, info.denom)}`, colPos, '#04210f');
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
  etiqueta(g, bx - 4, y, (cual === 'tp' ? 'TP ' : 'SL ') + fmtP(set), col, '#04210f');
  botonCuadro(g, bx, y - bh / 2, bw, bh, col, cual.toUpperCase(), false);
  S._handles.push({ id: p.id, cual, x0: bx - 6, x1: plotR, y0: y - 10, y1: y + 10 });
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
    fx.style.cursor = h ? (h.entryLine ? 'grab' : (h.entryX || h.cerrarPos || h.alertaX ? 'pointer' : 'ns-resize')) : '';
  });
  fx.addEventListener('mousedown', (e) => {
    const h = handleEn(e); if (!h) return;
    e.stopPropagation(); e.preventDefault();
    if (h.entryX) { S.limitPx = 0; const li = $('sp-limit'); if (li) li.value = ''; dibujarLimit(); renderEntry(); fx.style.pointerEvents = 'none'; return; }
    if (h.cerrarPos) { const x = M.cerrar(h.cerrarPos, S.marks[h.par] || S.mark, 'manual'); if (x) { const fee = x.fee > 0 ? ' · fee ' + (x.denom === 'USDT' ? fmtMoney(x.fee) : fmtCoin(x.fee) + ' ' + x.denom) : ''; toast(`Closed ${x.pos.lado} · ${fmtPnL(x.pnl, x.denom)}${fee}`, x.pnl >= 0 ? 'ok' : 'bad'); renderPos(); } fx.style.pointerEvents = 'none'; return; }
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
  window.addEventListener('mouseup', () => { if (S.drag) { const line = S.drag.entryLine; S.drag = null; fx.style.pointerEvents = 'none'; if (!line) renderPos(); } });
}
/* Fija TP o SL al precio arrastrado. En spot no hay liquidación que respetar. */
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
    `<button class="sp-ctx-b alert" type="button" data-a="alert">Set alert</button>`;
  document.body.appendChild(el);
  const w = el.offsetWidth || 190, h = el.offsetHeight || 120;
  let left = clientX + 6, top = clientY + 6;
  if (left + w > window.innerWidth) left = clientX - w - 6;
  if (top + h > window.innerHeight) top = clientY - h - 6;
  el.style.left = Math.max(6, left) + 'px'; el.style.top = Math.max(6, top) + 'px';
  el.querySelector('[data-a="copy"]').onclick = () => { try { navigator.clipboard && navigator.clipboard.writeText(String(px)); } catch (_) {} toast('Price copied.', 'ok'); cerrarCtxDemo(); };
  el.querySelector('[data-a="alert"]').onclick = () => { crearAlertaDemo(px); cerrarCtxDemo(); };
  setTimeout(() => { document.addEventListener('mousedown', ctxFueraDemo, true); document.addEventListener('keydown', ctxEscDemo, true); }, 0);
}
function ctxFueraDemo(e) { const el = $('sp-ctx'); if (el && !el.contains(e.target)) cerrarCtxDemo(); }
function ctxEscDemo(e) { if (e.key === 'Escape') cerrarCtxDemo(); }
function cerrarCtxDemo() { const el = $('sp-ctx'); if (el) { try { el.remove(); } catch (_) {} } document.removeEventListener('mousedown', ctxFueraDemo, true); document.removeEventListener('keydown', ctxEscDemo, true); }

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
  const usd = hist.filter((h) => (h.denom || 'USDT') === 'USDT');   // solo USDT para el $
  const n = hist.length;
  const wins = hist.filter((h) => h.pnl > 0).length;
  const total = usd.reduce((a, h) => a + h.pnl, 0);
  let eq = 10000; const curva = [10000];
  usd.forEach((h) => { eq += h.pnl; curva.push(eq); });
  const desde = n ? new Date(hist[0].cerrado) : null, hasta = n ? new Date(hist[n - 1].cerrado) : null;
  return { n, wins, losses: n - wins, winRate: n ? Math.round(wins / n * 100) : 0, total, startBal: 10000, endBal: 10000 + total, curva, desde, hasta };
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
  g.save(); g.translate(W / 2, H * .52); g.rotate(-Math.PI / 10); g.font = '800 300px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,.033)'; g.fillText('SPOT', 0, 0); g.restore();
  const M0 = 74;
  let domY = 92;
  if (sello) { const lw = 200, lh = sello.height * (lw / sello.width); g.drawImage(sello, W - M0 - lw, 54, lw, lh); domY = 54 + lh + 30; }
  g.textAlign = 'right'; g.fillStyle = ink3; g.font = '700 18px "IBM Plex Mono", monospace'; g.fillText('decfreedom.com', W - M0, domY);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = ink; g.font = '800 54px "Chakra Petch", sans-serif'; g.fillText('Trading Performance', M0, 132);
  g.fillStyle = oro; g.font = '800 54px "Chakra Petch", sans-serif'; g.fillText('Certificate', M0, 196);
  g.fillStyle = ink3; g.font = '700 17px "IBM Plex Mono", monospace'; g.fillText('DECFREEDOM SPOT · TRACK RECORD', M0, 230);
  g.fillStyle = ink2; g.font = '600 19px "IBM Plex Mono", monospace'; g.fillText('Issued to', M0, 306);
  g.fillStyle = '#fff'; g.font = '800 42px "Plus Jakarta Sans", sans-serif'; g.fillText(nombre, M0, 352);
  g.fillStyle = '#c3cbd4'; g.font = '400 19px "Plus Jakarta Sans", sans-serif';
  wrapTexto(g, 'This document certifies the DecFreedom Spot track record achieved over the period shown, normalized to a $10,000 reference balance.', M0, 398, W - M0 * 2, 27);
  const periodo = st.desde ? (st.desde.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' }) + '  →  ' + st.hasta.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' })) : '—';
  const roi = st.total / st.startBal * 100;
  const tiles = [
    ['Trades', String(st.n), ink],
    ['Win rate', st.winRate + '%', st.winRate >= 50 ? up : ink],
    ['Net PnL', (st.total >= 0 ? '+' : '−') + '$' + Math.abs(st.total).toLocaleString('en-US', { maximumFractionDigits: 0 }), st.total >= 0 ? up : dn],
    ['ROI', (roi >= 0 ? '+' : '−') + Math.abs(roi).toFixed(1) + '%', roi >= 0 ? up : dn],
    ['Reference', '$10,000', ink],
    ['End balance', '$' + st.endBal.toLocaleString('en-US', { maximumFractionDigits: 0 }), st.endBal >= 10000 ? up : dn]
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
  g.fillStyle = ink; g.font = '800 24px "Chakra Petch", sans-serif'; g.fillText('Equity curve', M0, chY - 16);
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
  if (min <= 10000 && max >= 10000) { const yb = py(10000); g.setLineDash([5, 5]); g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + padX, yb); g.lineTo(x + w - padX, yb); g.stroke(); g.setLineDash([]); }
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
      'Reference balance,10000',
      'Trades,' + st.n,
      'Win rate %,' + st.winRate,
      'Net PnL USDT,' + st.total.toFixed(2),
      'End balance,' + st.endBal.toFixed(2),
      'decfreedom.com', '', M.csv()
    ].join('\n');
    descargar(new Blob([pre], { type: 'text/csv' }), 'DecFreedom-track-record.csv'); toast('History exported (CSV).', 'ok');
  } catch (_) { toast('Could not export the history.', 'bad'); }
}

function renderTodo() { sincronCap(); pintarPrecio(); renderEntry(); renderPos(); }

/* ── How It Works (stepper, explicado para principiantes) ── */
const PASOS_SP = [
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
    d: '<b>Market</b> fills now at the mark price. <b>Limit</b> lets you click the chart to mark your entry, and it fills when price reaches it. On an open position you set a <b>Take Profit</b> and a <b>Stop Loss</b> by dragging the small green and red squares, or with the pencil on each row.',
    x: 'On a short, Take Profit sits below your entry (you win when price falls) and Stop Loss above.'
  },
  {
    t: 'Your wallet, your coins',
    d: 'The top shows your <b>real wallet balance</b>: the total plus a box for each coin you hold. Your open positions, marked orders and full history live at the bottom. It is <b>non custodial</b>, so your coins never leave your wallet.',
    x: 'Nothing leaves your wallet. This is real spot, built to operate.'
  },
  {
    t: 'What it costs: only if you win',
    d: 'Opening a trade is <b>free</b> on our side. We charge a small <b>0.2% of your profit</b>, in <b>BNB</b>, and <b>only when you close a trade in profit</b>. If a trade closes flat or at a loss, the platform fee is <b>zero</b>. That is how the service keeps running without charging you to simply operate, so it is always in our interest that you win.',
    x: 'Free to open. 0.2% of profit on a winning close. Nothing when you do not profit.'
  }
];
let _pasoSP = 0;
function ayuda() {
  cerrarPops(); marcarAyudaVista();
  const old = $('sp-help'); if (old) old.remove();
  _pasoSP = 0;
  const m = document.createElement('div'); m.id = 'sp-help';
  m.innerHTML = `<div class="sp-hlp-bg"></div>
    <div class="sp-hlp-c">
      <button class="sp-hlp-x" id="sp-help-x" aria-label="Close">✕</button>
      <div class="sp-hlp-eyebrow">Spot</div>
      <div id="sp-hlp-body"></div>
    </div>`;
  document.body.appendChild(m);
  const ce = () => m.remove();
  m.querySelector('.sp-hlp-bg').onclick = ce; $('sp-help-x').onclick = ce;
  pintarPasoSP();
}
function pintarPasoSP() {
  const c = $('sp-hlp-body'); if (!c) return;
  const p = PASOS_SP[_pasoSP], ultimo = _pasoSP === PASOS_SP.length - 1;
  c.innerHTML = `
    <div class="sp-hlp-card">
      <div class="sp-hlp-n">${_pasoSP + 1} <em>of ${PASOS_SP.length}</em></div>
      <div class="sp-hlp-t">${p.t}</div>
      <div class="sp-hlp-d">${p.d}</div>
      <div class="sp-hlp-x2">${p.x}</div>
    </div>
    <div class="sp-hlp-dots">${PASOS_SP.map((_, i) => `<i class="${i === _pasoSP ? 'on' : ''}" data-paso="${i}"></i>`).join('')}</div>
    <div class="sp-hlp-acts">
      ${_pasoSP > 0 ? '<button class="sp-hlp-back" id="sp-hlp-back">Back</button>' : ''}
      <button class="sp-hlp-next" id="sp-hlp-next">${ultimo ? 'Got it' : 'Learn more'}</button>
    </div>`;
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
    lst.innerHTML = f.slice(0, 60).map((p) => { const url = p.cg && S.logos[p.cg]; return `<button class="it ${p.id === S.par.id ? 'on' : ''}" data-id="${esc(p.id)}">${url ? `<i class="con" style="background-image:url(${esc(url)})"></i>` : `<i>${esc(p.id[0])}</i>`}<b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`; }).join('');
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
function cierraPopFuera(e) { const ids = ['sp-coinmenu', 'sp-shortmenu', 'sp-walletmenu']; const anc = ['sp-coin', 'sp-amtunit', 'sp-coinsbtn']; const hit = ids.some((id) => { const m = $(id); return m && m.contains(e.target); }) || anc.some((id) => { const a = $(id); return a && a.contains(e.target); }); if (!hit) cerrarPops(); }
function cerrarPops() { ['sp-coinmenu', 'sp-shortmenu', 'sp-walletmenu'].forEach((id) => { const m = $(id); if (m) m.remove(); }); document.removeEventListener('mousedown', cierraPopFuera); }

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
