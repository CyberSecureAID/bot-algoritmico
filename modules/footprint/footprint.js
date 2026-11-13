/* modules/footprint/footprint.js — Footprint Pro (flujo de órdenes institucional).

   Servicio NUEVO del área de Análisis. Réplica de un footprint profesional
   (estilo ATAS / Sierra Chart) con datos públicos de Binance spot.

   REUTILIZA del resto de la plataforma (no recrea):
     · Mecanismo y fuente de datos (datos-trades.js → api.binance.com vía shim).
     · Catálogo de monedas + logos (config.js PARES, caché aurex-logos).
     · Temporalidades (config.js TFS).
     · Loader, tema, marca y la exportación con logo (cco-marca.png).
     · El analista "Jesús", igual que VWAP Pro.
   NUEVO: motor de footprint (worker), render en canvas, 3 modos, imbalances
   apilados como S/R, CVD con divergencias, absorción y su analista propio. */

import { PARES, TFS, velas, ticker, tickSize, aggTradesHist, streamTrades, logos, tfMs, subVelas } from './datos-trades.js?v=5';
import { crearRender } from './render.js?v=5';
import { leerFootprint } from './analista.js?v=5';
import { estilosFootprint } from './estilos.js?v=5';
import { ICONOS } from '../../assets/js/niveles/config.js?v=1';   // monedas SVG de EUR/GBP, mismas que Liquidity Pools

const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const LOGO_ALT = new URL('../../assets/img/cco-full.webp', import.meta.url).href;
const AVATAR = new URL('../../assets/img/jesus-avatar.webp', import.meta.url).href;
/* Marcadores de absorción (opcionales): si subes estas imágenes se usan encima
   de la vela; si no existen, se dibuja un triángulo. Súbelas a assets/img/. */
const IMG_BULL = new URL('../../assets/img/fp-alcista.webp', import.meta.url).href;
const IMG_BEAR = new URL('../../assets/img/fp-bajista.webp', import.meta.url).href;
const IMG_WARUP = new URL('../../assets/img/fp-flecha-verde.webp', import.meta.url).href;   // compradores (verde, abajo)
const IMG_WARDN = new URL('../../assets/img/fp-flecha-roja.webp', import.meta.url).href;    // vendedores (rojo, arriba)
const OPTS_RENDER = () => ({ onHover: tooltip, imgBull: IMG_BULL, imgBear: IMG_BEAR, imgWarUp: IMG_WARUP, imgWarDown: IMG_WARDN });

/* Iconos SVG propios, centrados (nada de glifos sueltos descuadrados). */
const IC = {
  back: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  help: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.3"/><path d="M9.3 9.2a2.7 2.7 0 1 1 3.9 2.6c-.9.5-1.2 1-1.2 1.9"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>',
  reset: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/></svg>',
  set: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="10" cy="8" r="2.4" fill="#12161c"/><circle cx="15" cy="16" r="2.4" fill="#12161c"/></svg>',
  exp: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>',
  sndOff: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
  sndOn: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.6a5 5 0 0 1 0 6.8"/><path d="M18.6 5.5a9 9 0 0 1 0 13"/></svg>'
};

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const S = {
  par: PARES[0], tf: '1m', trades: [], velas: [], subk: [], agg: null, meta: {}, live: null,
  render: null, worker: null, stream: null, logos: {}, tick: 0, binSize: 0, imb: 300,
  reqId: 0, rebuildT: null, velasT: null, timerT: null, an: null, alertadas: new Set(), modo: 'bidask',
  sound: false, audioCtx: null
};

/* Sonido de alerta (cling corto, generado, sin assets). Solo si está activado;
   por defecto apagado. El botón vive junto al temporizador. */
function ping() {
  if (!S.sound) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    if (!S.audioCtx) S.audioCtx = new AC();
    const ac = S.audioCtx; if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.36);
  } catch (_) {}
}
function toggleSound() {
  S.sound = !S.sound;
  try { localStorage.setItem('fp-sound', S.sound ? '1' : '0'); } catch (_) {}
  const b = $('fp-sound'); if (b) { b.innerHTML = S.sound ? IC.sndOn : IC.sndOff; b.title = 'Alert sound (' + (S.sound ? 'on' : 'off') + ')'; b.classList.toggle('on', S.sound); }
  if (S.sound) ping();   // confirma al activar y desbloquea el audio del navegador
}

/* Temporizador de la vela ACTUAL: cuenta regresiva según la temporalidad,
   alineada al nacimiento de la vela (openTime + duración). Al llegar a 0 nace
   la siguiente. Se ve grande en la barra, al lado del analista. */
function tickTimer() {
  const el = document.getElementById('fp-timer'); if (!el) return;
  if (!S.live) { el.textContent = '—'; el.classList.remove('urge'); return; }
  const paso = tfMs(S.tf), ahora = Date.now();
  // ── ROLLOVER POR TIEMPO: si el reloj ya cruzó el borde, la vela nueva nace YA
  //    (sin esperar a que llegue un trade). Esto elimina el retraso del segundero
  //    quedándose en 0 y la vela saliendo tarde. ──
  if (ahora >= S.live.t + paso) {
    const px = (S.meta && S.meta.last) || S.live.c;
    while (ahora >= S.live.t + paso) S.live = { t: S.live.t + paso, o: px, h: px, l: px, c: px, niveles: [], map: new Map(), poc: null, total: 0, delta: 0, bin: S.live.bin };
    if (S.render) S.render.setLive(S.live);
    if (S.rebuildT) { clearTimeout(S.rebuildT); S.rebuildT = null; }
    rebuild(false);
  }
  const restante = Math.max(0, S.live.t + paso - ahora);
  let s = Math.round(restante / 1000); const m = Math.floor(s / 60); s = s % 60;
  el.textContent = m > 0 ? (m + ':' + String(s).padStart(2, '0')) : (s + 's');
  el.classList.toggle('urge', restante < 10000);
}

/* Disclaimer una sola vez por navegador: el analista no da consejo financiero. */
function disclaimerUnaVez() {
  try { if (localStorage.getItem('fp-disclaimer') === '1') return; } catch (_) {}
  const d = document.createElement('div'); d.className = 'fp-disc';
  d.innerHTML = `<div class="fp-disc-bg"></div><div class="fp-disc-c">
    <h4>Before you start</h4>
    <p>Footprint Pro shows the live order flow and <b>Jesús, the analyst, shares his personal read of what the market is doing right now</b>. It is a live picture and an opinion, <b>not financial advice</b> and not a recommendation to buy or sell. You decide your own trades.</p>
    <button class="fp-disc-ok" id="fp-disc-ok">I understand</button></div>`;
  document.body.appendChild(d);
  const cerrarD = () => { try { localStorage.setItem('fp-disclaimer', '1'); } catch (_) {} d.remove(); };
  d.querySelector('#fp-disc-ok').onclick = cerrarD;
  d.querySelector('.fp-disc-bg').onclick = cerrarD;
}
const MAX_TRADES = 30000;

export async function abrirFootprint() {
  estilosFootprint();
  const prev = $('fp-overlay'); if (prev) prev.remove();
  const ov = document.createElement('div');
  ov.id = 'fp-overlay';
  ov.innerHTML = plantilla();
  document.body.appendChild(ov);

  S.render = crearRender($('fp-cv'), OPTS_RENDER());
  window.addEventListener('resize', onResize);
  S.timerT = setInterval(tickTimer, 1000); tickTimer();
  disclaimerUnaVez();
  S.an = { lang: idiomaIni(), abierto: false, clave: '', msg: null, det: false };
  try { S.sound = localStorage.getItem('fp-sound') === '1'; } catch (_) {}

  wire(ov);
  arrancarWorker();
  logos().then((m) => { S.logos = m || {}; pintarCoin(); }).catch(() => {});
  requestAnimationFrame(() => { try { S.render.resize(); posMarca(); } catch (_) {} });
  cargar();
}

function plantilla() {
  return `
  <div class="fp-bg"></div>
  <div class="fp-wrap">
    <div class="fp-top">
      <button class="fp-back" id="fp-back" aria-label="Back">${IC.back}Back</button>
      <div class="fp-sep"></div>
      <button class="fp-coin" id="fp-coin"><i class="fp-coin-lg" id="fp-coin-lg"></i><b id="fp-coin-id">BTC</b><span id="fp-coin-nm">Bitcoin</span><em class="fp-chev">▾</em></button>
      <button class="fp-chip" id="fp-tf">1m <em class="fp-chev">▾</em></button>
      <div class="fp-pxbox"><b class="fp-px" id="fp-px">—</b><span class="fp-chg" id="fp-chg">—</span></div>

      <div class="fp-timer" id="fp-timer" title="Time left in this candle">—</div>
      <button class="fp-ico fp-snd" id="fp-sound" title="Alert sound (off)">${IC.sndOff}</button>

      <div class="fp-modes" id="fp-modes">
        <button data-mode="bidask" class="on" title="Buy x Sell in every cell">Bid×Ask</button>
        <button data-mode="delta" title="Net delta in every cell">Delta</button>
        <button data-mode="profile" title="Volume bars per candle">Profile</button>
      </div>
      <div class="fp-top-r">
        <button class="fp-ico" id="fp-help" title="How it works">${IC.help}</button>
        <button class="fp-ico" id="fp-reset" title="Reset view">${IC.reset}</button>
        <button class="fp-ico" id="fp-settings" title="Bin size and imbalance">${IC.set}</button>
        <button class="fp-ico" id="fp-export" title="Export image">${IC.exp}</button>
      </div>
    </div>

    <div class="fp-stage">
      <div class="fp-cvwrap">
        <div class="fp-cv" id="fp-cv"></div>
        <div class="fp-wm"><img src="${LOGO}" onerror="this.onerror=null;this.src='${LOGO_ALT}'" alt=""></div>
        <div class="fp-alerts" id="fp-alerts"></div>
        <div class="fp-tip" id="fp-tip" style="display:none"></div>
        <div class="fp-loading" id="fp-loading">${loader()}</div>
      </div>
      <aside class="fp-an-col" id="fp-an-col"></aside>
    </div>
  </div>

  <div class="fp-pop" id="fp-settings-pop" style="display:none">
    <div class="fp-pop-row"><label>Bin size</label><input id="fp-bin" type="text" inputmode="decimal" placeholder="auto"></div>
    <div class="fp-pop-row"><label>Imbalance %</label><input id="fp-imb" type="text" inputmode="numeric" value="300"></div>
    <button class="fp-pop-apply" id="fp-apply">Apply</button>
    <div class="fp-pop-note">Bin empty = automatic. Imbalance = diagonal buy vs sell ratio to flag a cell.</div>
  </div>

  ${helpHTML()}`;
}

/* Carga UNIFORME con el resto de Análisis: un spinner simple centrado, sin logo
   ni inventos (mismo patrón que it-empty / it-spin de VWAP Pro). */
function loader() { return '<div class="fp-empty"><div class="fp-spin"></div><span>Loading…</span></div>'; }
function mostrarCarga(b) { const el = $('fp-loading'); if (el) el.classList.toggle('hide', !b); }
/* Coloca la marca de agua en la esquina inferior IZQUIERDA de la gráfica, por
   ENCIMA de los paneles de delta y CVD (nunca sobre ellos). */
function posMarca() {
  const wm = document.querySelector('#fp-overlay .fp-wm');
  if (wm && S.render && S.render.panelBottomPx) { try { wm.style.bottom = (S.render.panelBottomPx() + 8) + 'px'; } catch (_) {} }
}

/* Guía de uso (How it works). Diagramas propios (SVG), nada de imágenes de
   terceros. Aquí vive también la nota de la fuente de datos. */
function helpHTML() {
  const dCelda = `<svg viewBox="0 0 120 54" class="fp-h-svg"><rect x="2" y="2" width="56" height="50" rx="3" fill="rgba(232,68,93,.18)" stroke="#e8445d"/><rect x="62" y="2" width="56" height="50" rx="3" fill="rgba(38,194,129,.18)" stroke="#26c281"/><text x="30" y="24" fill="#ff8a9a" font-family="monospace" font-size="14" text-anchor="middle">1.2</text><text x="90" y="24" fill="#7ff0b0" font-family="monospace" font-size="14" text-anchor="middle">3.4</text><text x="30" y="44" fill="#ff8a9a" font-family="monospace" font-size="9" text-anchor="middle">sold</text><text x="90" y="44" fill="#7ff0b0" font-family="monospace" font-size="9" text-anchor="middle">bought</text></svg>`;
  const dFooter = `<svg viewBox="0 0 120 54" class="fp-h-svg"><rect x="2" y="2" width="116" height="50" rx="3" fill="rgba(38,194,129,.1)"/><text x="60" y="22" fill="#26c281" font-family="system-ui" font-size="15" text-anchor="middle">▲ +9.3</text><text x="60" y="40" fill="#8b96a3" font-family="monospace" font-size="11" text-anchor="middle">VOL 21  +49%</text></svg>`;
  const dPOC = `<svg viewBox="0 0 120 54" class="fp-h-svg"><rect x="34" y="6" width="52" height="42" fill="rgba(232,184,75,.08)"/><rect x="40" y="10" width="40" height="7" fill="rgba(255,255,255,.06)"/><rect x="40" y="33" width="40" height="7" fill="rgba(255,255,255,.06)"/><rect x="30" y="21" width="60" height="10" fill="rgba(232,184,75,.16)" stroke="#E8B84B" stroke-width="2"/><text x="100" y="29" fill="#E8B84B" font-family="monospace" font-size="9">POC</text></svg>`;
  const dImb = `<svg viewBox="0 0 120 54" class="fp-h-svg"><rect x="60" y="4" width="54" height="14" rx="2" fill="rgba(47,240,192,.15)" stroke="#2ff0c0" stroke-width="1.5"/><rect x="60" y="20" width="54" height="14" rx="2" fill="rgba(47,240,192,.15)" stroke="#2ff0c0" stroke-width="1.5"/><rect x="60" y="36" width="54" height="14" rx="2" fill="rgba(47,240,192,.15)" stroke="#2ff0c0" stroke-width="1.5"/><text x="26" y="31" fill="#7d8794" font-family="monospace" font-size="10" text-anchor="middle">3+ in<tspan x="26" dy="12">a row</tspan></text></svg>`;
  const dCVD = `<svg viewBox="0 0 120 54" class="fp-h-svg"><line x1="2" y1="46" x2="118" y2="46" stroke="rgba(255,255,255,.12)" stroke-dasharray="3 3"/><polyline points="4,46 30,40 54,42 78,24 116,10" fill="none" stroke="#8ea2ff" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  const dAn = `<svg viewBox="0 0 120 54" class="fp-h-svg"><defs><clipPath id="fpAnClip"><circle cx="30" cy="27" r="15"/></clipPath></defs><image href="${AVATAR}" x="15" y="12" width="30" height="30" clip-path="url(#fpAnClip)" preserveAspectRatio="xMidYMid slice"/><circle cx="30" cy="27" r="15" fill="none" stroke="#C9A84B" stroke-width="1.5"/><rect x="56" y="19" width="48" height="17" rx="8" fill="rgba(38,194,129,.2)"/><text x="80" y="31" fill="#26c281" font-family="monospace" font-size="11" text-anchor="middle" font-weight="700">BUY</text></svg>`;
  const dViews = `<svg viewBox="0 0 120 54" class="fp-h-svg"><rect x="4" y="14" width="34" height="26" rx="3" fill="rgba(255,255,255,.05)"/><text x="21" y="31" fill="#b7bdc6" font-size="11" text-anchor="middle" font-family="monospace">1 × 2</text><rect x="43" y="14" width="34" height="26" rx="3" fill="rgba(38,194,129,.12)"/><text x="60" y="32" fill="#26c281" font-size="13" text-anchor="middle" font-family="monospace">Δ</text><rect x="82" y="14" width="34" height="26" rx="3" fill="rgba(255,255,255,.05)"/><rect x="87" y="20" width="12" height="4" fill="#26c281"/><rect x="87" y="27" width="22" height="4" fill="#e8445d"/><rect x="87" y="34" width="8" height="4" fill="#26c281"/></svg>`;
  const dSet = `<svg viewBox="0 0 120 54" class="fp-h-svg"><line x1="14" y1="18" x2="106" y2="18" stroke="#3a424c" stroke-width="2"/><circle cx="46" cy="18" r="5.5" fill="#12161c" stroke="#C9A84B" stroke-width="2"/><line x1="14" y1="38" x2="106" y2="38" stroke="#3a424c" stroke-width="2"/><circle cx="78" cy="38" r="5.5" fill="#12161c" stroke="#C9A84B" stroke-width="2"/></svg>`;
  const fila = (svg, t, d) => `<div class="fp-h-row"><div class="fp-h-ic">${svg}</div><div class="fp-h-tx"><b>${t}</b><span>${d}</span></div></div>`;
  return `
  <div class="fp-help" id="fp-help-ov" style="display:none">
    <div class="fp-help-bg" id="fp-help-bg"></div>
    <div class="fp-help-c">
      <div class="fp-help-cab"><h3>How Footprint Pro works</h3><button class="fp-help-x" id="fp-help-x" aria-label="Close">✕</button></div>
      <p class="fp-help-lead">A normal candle only tells you where price opened and closed. A footprint shows something no candle can: <b>exactly how much was bought and sold at each price</b> inside that candle. So you can see WHO pushed the price, the buyers or the sellers.</p>
      <div class="fp-help-disc"><b>Not financial advice.</b> The analyst gives a live read and a personal opinion of the order flow, never a recommendation to buy or sell. You decide your own trades.</div>
      ${fila(dCelda, 'The two numbers in each box', 'Each candle is a stack of price rows. Every row has two numbers: the left one (red) is how much was SOLD at that price, the right one (green) is how much was BOUGHT. Brighter color = more trading there.')}
      ${fila(dFooter, 'Who won the candle', 'Right under each candle there is an arrow and a number. Green ▲ = buyers won that candle, red ▼ = sellers won. The number is how much more was bought than sold. This is the fastest way to read the fight.')}
      ${fila(dPOC, 'The price everyone agreed on', 'The gold box marks the price where the MOST was traded in that candle, the level the market cared about most. The faint band around it is where 70% of the trading happened, the "fair" zone.')}
      ${fila(dImb, 'When one side overpowers the other', 'If buyers (or sellers) are much stronger than the other side at a price, that box gets a bright outline. When three or more stack up, it marks a strong zone that often becomes a floor or a ceiling later.')}
      ${fila(dCVD, 'The pressure line (CVD)', 'The line at the bottom adds up the fight over time. It goes UP when buyers are winning overall and DOWN when sellers are. If price climbs but this line falls, nobody is really buying the move, it is weak.')}
      ${fila(dAn, 'Your analyst (right side)', 'You do not need to read all of this yourself. Jesús, in the column on the right, reads it live and says it in plain words, like "buyers are in control" or "a big seller is blocking here". He stays on the whole time with the live buy and sell numbers, and you switch English / Spanish there.')}
      ${fila(dViews, 'The three views and moving around', 'Bid×Ask shows the two numbers. Delta shows only the net (who won each price). Profile shows it as bars. Roll the mouse wheel over the chart to zoom time, drag the price scale on the right to stretch price, and drag the chart itself to move around, back in time or up and down.')}
      ${fila(dSet, 'Settings (the ⚙ button)', 'Bin size is how tall each price box is: a bigger bin groups more prices into one box (cleaner), a smaller one shows finer detail. Imbalance % is how much stronger one side must be to light up a box (300% = three times the other side). Leave bin on "auto" and 300% until you want to fine tune.')}
      <div class="fp-help-note"><b>Where the numbers come from.</b> The order flow is live from Binance, the biggest crypto exchange. It is a large part of the market but not every exchange on earth, so use the volume to read the pressure, not as the total of the whole market.</div>
    </div>
  </div>`;
}
function abrirHelp() { const o = $('fp-help-ov'); if (o) o.style.display = 'flex'; }
function cerrarHelp() { const o = $('fp-help-ov'); if (o) o.style.display = 'none'; }

// ── Cableado ─────────────────────────────────────────────────────────
function wire(ov) {
  $('fp-back').onclick = cerrar;
  ov.querySelector('.fp-bg').onclick = cerrar;
  $('fp-coin').onclick = (e) => { e.stopPropagation(); menuCoin($('fp-coin')); };
  $('fp-tf').onclick = (e) => { e.stopPropagation(); menuTF($('fp-tf')); };
  $('fp-export').onclick = exportar;
  $('fp-settings').onclick = (e) => { e.stopPropagation(); const p = $('fp-settings-pop'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; posPop(p, $('fp-settings')); };
  $('fp-apply').onclick = () => {
    const b = parseFloat(($('fp-bin').value || '').replace(',', '.')); S.binSize = isFinite(b) && b > 0 ? b : 0;
    const im = parseInt($('fp-imb').value, 10); S.imb = isFinite(im) && im >= 110 ? im : 300;
    $('fp-settings-pop').style.display = 'none'; rebuild(true);
  };
  $('fp-modes').querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => {
    S.modo = b.dataset.mode;
    $('fp-modes').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    if (S.render) S.render.setMode(S.modo);
  });
  $('fp-reset').onclick = () => { if (S.render) S.render.resetView(); };
  const sb = $('fp-sound'); if (sb) { sb.onclick = toggleSound; sb.innerHTML = S.sound ? IC.sndOn : IC.sndOff; sb.classList.toggle('on', S.sound); sb.title = 'Alert sound (' + (S.sound ? 'on' : 'off') + ')'; }
  $('fp-help').onclick = (e) => { e.stopPropagation(); abrirHelp(); };
  const hx = $('fp-help-x'); if (hx) hx.onclick = cerrarHelp;
  const hb = $('fp-help-bg'); if (hb) hb.onclick = cerrarHelp;
  renderAnalistaCol();
}

// ── Datos ────────────────────────────────────────────────────────────
async function cargar() {
  if (S.stream) { try { S.stream.cerrar(); } catch (_) {} S.stream = null; }
  if (S.velasT) { clearInterval(S.velasT); S.velasT = null; }
  S.trades = []; S.alertadas = new Set(); S.agg = null;
  mostrarCarga(true);

  const sym = S.par.s;
  let tk = 0, tkr = null, vls = [], hist = [], subk = [];
  try {
    [vls, tk, tkr, hist, subk] = await Promise.all([
      velas(sym, S.tf, 80).catch(() => []),
      tickSize(sym).catch(() => 0),
      ticker(sym).catch(() => null),
      aggTradesHist(sym, 6).catch(() => []),
      subVelas(sym, S.tf, 1000).catch(() => [])
    ]);
  } catch (_) {}
  S.velas = vls; S.tick = tk; S.trades = hist.slice(-MAX_TRADES); S.subk = subk;
  S.meta = { par: S.par.id, tf: S.tf, last: tkr ? tkr.last : (vls.length ? vls[vls.length - 1].c : 0), binSize: S.binSize };
  if (tkr) pintarPrecio(tkr);
  // recrea el canvas limpio
  const host = $('fp-cv'); if (host) { host.innerHTML = ''; S.render = crearRender(host, OPTS_RENDER()); S.render.setMode(S.modo); requestAnimationFrame(() => { S.render.resize(); posMarca(); }); }

  rebuild(true);
  S.stream = streamTrades(sym, onTrade);
  S.velasT = setInterval(refrescarVelas, 20000);
}

async function refrescarVelas() {
  try {
    const [v, sk] = await Promise.all([velas(S.par.s, S.tf, 80).catch(() => null), subVelas(S.par.s, S.tf, 1000).catch(() => null)]);
    if (v && v.length) S.velas = v; if (sk && sk.length) S.subk = sk;
    rebuild(false);
  } catch (_) {}
}

/* Copia de la vela EN FORMACIÓN (la última del worker) que iremos actualizando
   trade a trade, sin esperar al worker, para que siga al precio en vivo. */
function snapLast(agg) {
  if (!agg || !agg.candles || !agg.candles.length) return null;
  const c = agg.candles[agg.candles.length - 1], bin = agg.binSize || 1;
  const niveles = (c.niveles || []).map((n) => ({ price: n.price, buy: n.buy, sell: n.sell }));
  const map = new Map(niveles.map((n) => [Math.round(n.price / bin), n]));
  return { t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, niveles, map, poc: c.poc, total: c.total, delta: c.delta, bin };
}

function onTrade(tr) {
  S.trades.push(tr);
  if (S.trades.length > MAX_TRADES) S.trades.splice(0, S.trades.length - MAX_TRADES);
  S.meta.last = tr.p;
  const pxEl = document.getElementById('fp-px'); if (pxEl) pxEl.textContent = Number(tr.p).toLocaleString('en-US', { minimumFractionDigits: decPar(), maximumFractionDigits: decPar() });
  if (S.live) {
    const paso = tfMs(S.tf); let nacio = false;
    while (tr.t >= S.live.t + paso) { S.live = { t: S.live.t + paso, o: tr.p, h: tr.p, l: tr.p, c: tr.p, niveles: [], map: new Map(), poc: null, total: 0, delta: 0, bin: S.live.bin }; nacio = true; }
    if (nacio) { if (S.rebuildT) { clearTimeout(S.rebuildT); S.rebuildT = null; } rebuild(false); }   // vela nueva: reconstruye YA para verla nacer (no detrás del eje)
    const bin = S.live.bin || 1, k = Math.round(tr.p / bin);
    let lv = S.live.map.get(k);
    if (!lv) { lv = { price: k * bin, buy: 0, sell: 0 }; S.live.map.set(k, lv); S.live.niveles.push(lv); }
    if (tr.buy) lv.buy += tr.q; else lv.sell += tr.q;
    if (S.live.o == null) S.live.o = tr.p;
    S.live.c = tr.p; if (tr.p > S.live.h) S.live.h = tr.p; if (tr.p < S.live.l) S.live.l = tr.p;
    if (S.render) S.render.setLive(S.live);
    actualizarLiveStats();
  } else if (S.render) S.render.setMeta({ last: tr.p });
  if (!S.rebuildT) S.rebuildT = setTimeout(() => { S.rebuildT = null; rebuild(false); }, 500);
}

function arrancarWorker() {
  try {
    S.worker = new Worker(new URL('./motor.worker.js?v=5', import.meta.url));
    S.worker.onmessage = (ev) => {
      const r = ev.data || {};
      if (!r.ok) return;
      if (r.reqId !== S.reqId) return;      // descarta resultados viejos
      S.agg = r;
      S.meta.binSize = r.binSize;
      const nv = snapLast(r);               // vela viva del worker; onTrade sigue sumando encima
      if (nv && (!S.live || nv.t >= S.live.t)) S.live = nv;   // nunca retrocede la vela viva (evita saltos atrás)
      if (r.candles && r.candles.length) mostrarCarga(false);
      if (S.render) { S.render.setData(r, S.meta); if (S.live) S.render.setLive(S.live); }
      actualizarAnalista();
      actualizarLiveStats();
      revisarAlertas(r);
    };
    S.worker.onerror = () => {};
  } catch (_) { S.worker = null; }
}

function rebuild(force) {
  if (!S.worker) return;
  S.reqId++;
  S.worker.postMessage({ type: 'build', reqId: S.reqId, trades: S.trades, velas: S.velas, subklines: S.subk, tfMs: tfMs(S.tf), binSize: S.binSize, imbThreshold: S.imb, tick: S.tick, nowT: Date.now() });
}

// ── Precio / moneda en la barra ─────────────────────────────────────
function pintarPrecio(t) {
  const px = $('fp-px'), chg = $('fp-chg'); if (!px) return;
  const dec = decPar();
  px.textContent = Number(t.last).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (chg) { const p = t.chgPct; chg.textContent = (p >= 0 ? '+' : '−') + Math.abs(p).toFixed(2) + '%'; chg.className = 'fp-chg ' + (p >= 0 ? 'up' : 'down'); }
}
function decPar() { const b = S.binSize || S.tick || 0; if (b > 0) return Math.max(0, Math.min(8, Math.ceil(-Math.log10(b)))); const p = S.meta.last || 1; return p >= 1000 ? 2 : p >= 1 ? 2 : p >= 0.01 ? 4 : 6; }

function pintarCoin() {
  const lg = $('fp-coin-lg'), id = $('fp-coin-id'), nm = $('fp-coin-nm'); if (!id) return;
  id.textContent = S.par.id; if (nm) nm.textContent = S.par.n || '';
  if (lg) pintarLogo(lg, S.par);
}
/* Logo de un par, igual que en Liquidity Pools: imagen de CoinGecko (cripto y
   oro), o la moneda SVG de ICONOS para EUR/GBP, o la inicial como último respaldo.
   Nada inventado: misma fuente que el resto del sitio. */
function pintarLogo(el, p) {
  const u = p.cg && S.logos[p.cg];
  if (u) { el.style.backgroundImage = `url(${u})`; el.classList.add('con'); el.classList.remove('con-svg'); el.innerHTML = ''; return; }
  el.style.backgroundImage = ''; el.classList.remove('con');
  const svg = ICONOS[p.ico || ''];
  if (svg) { el.innerHTML = svg; el.classList.add('con-svg'); return; }
  el.classList.remove('con-svg'); el.textContent = (p.ico || p.id || '?')[0];
}

// ── Menús moneda / temporalidad ─────────────────────────────────────
function cerrarPops() { document.querySelectorAll('.fp-menu').forEach((m) => m.remove()); }
function posPop(m, ancla) { const r = ancla.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(window.innerWidth - 270, r.left)) + 'px'; m.style.top = (r.bottom + 6) + 'px'; }

function menuCoin(ancla) {
  cerrarPops();
  const m = document.createElement('div'); m.className = 'fp-menu fp-coinmenu';
  const li = (p) => {
    const u = p.cg && S.logos[p.cg];
    const svg = !u ? ICONOS[p.ico || ''] : null;
    const inner = u ? '' : (svg || esc((p.ico || p.id || '?')[0]));
    return `<button class="fp-mi ${p.id === S.par.id ? 'on' : ''}" data-id="${esc(p.id)}" data-b="${esc((p.id + ' ' + (p.n || '')).toLowerCase())}"><i class="fp-mi-lg ${u ? 'con' : ''} ${svg ? 'con-svg' : ''}" style="${u ? `background-image:url(${u})` : ''}">${inner}</i><b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`;
  };
  m.innerHTML = `<input class="fp-mbuscar" id="fp-mbuscar" placeholder="Search symbol" autocomplete="off"><div class="fp-mlista" id="fp-mlista">${PARES.map(li).join('')}</div>`;
  document.body.appendChild(m); posPop(m, ancla);
  const q = $('fp-mbuscar'); if (q) { q.focus(); q.oninput = () => { const t = q.value.toLowerCase().trim(); m.querySelectorAll('.fp-mi').forEach((b) => b.style.display = !t || b.dataset.b.includes(t) ? '' : 'none'); }; }
  m.querySelectorAll('[data-id]').forEach((b) => b.onclick = () => { const p = PARES.find((x) => x.id === b.dataset.id); if (p) { S.par = p; pintarCoin(); cerrarPops(); cargar(); } });
  setTimeout(() => document.addEventListener('click', cerrarAlClic), 0);
}
function menuTF(ancla) {
  cerrarPops();
  const m = document.createElement('div'); m.className = 'fp-menu fp-tfmenu';
  m.innerHTML = TFS.map((t) => `<button class="fp-tfi ${t.id === S.tf ? 'on' : ''}" data-tf="${esc(t.id)}">${esc(t.n)}</button>`).join('');
  document.body.appendChild(m); posPop(m, ancla);
  m.querySelectorAll('[data-tf]').forEach((b) => b.onclick = () => { S.tf = b.dataset.tf; const c = $('fp-tf'); if (c) c.childNodes[0].nodeValue = ((TFS.find((t) => t.id === S.tf) || {}).n || S.tf) + ' '; cerrarPops(); cargar(); });
  setTimeout(() => document.addEventListener('click', cerrarAlClic), 0);
}
function cerrarAlClic(e) { if (!e.target.closest('.fp-menu') && !e.target.closest('.fp-coin') && !e.target.closest('.fp-chip')) { cerrarPops(); document.removeEventListener('click', cerrarAlClic); } }

// ── Tooltip por celda ───────────────────────────────────────────────
function tooltip(hit, cx, cy) {
  const tip = $('fp-tip'); if (!tip) return;
  if (!hit || !hit.lv) { tip.style.display = 'none'; return; }
  const d = hit.lv.buy - hit.lv.sell;
  const dec = decPar();
  const tot = hit.lv.buy + hit.lv.sell;
  tip.innerHTML = `<div class="fp-tip-p">${Number(hit.price).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}</div>
    <div class="fp-tip-r"><span class="s">Sold</span><b>${fmt(hit.lv.sell)}</b></div>
    <div class="fp-tip-r"><span class="b">Bought</span><b>${fmt(hit.lv.buy)}</b></div>
    <div class="fp-tip-r"><span>Total</span><b>${fmt(tot)}</b></div>
    <div class="fp-tip-won ${d >= 0 ? 'up' : 'down'}">${Math.abs(d) < tot * 0.02 ? 'Even fight' : (d >= 0 ? 'Buyers won by ' : 'Sellers won by ') + fmt(Math.abs(d))}</div>`;
  tip.style.display = 'block';
  const r = $('fp-overlay').getBoundingClientRect();
  tip.style.left = Math.min(cx - r.left + 14, r.width - 150) + 'px';
  tip.style.top = (cy - r.top + 14) + 'px';
}
function fmt(v) { const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v.toFixed(2); }

// ── Alertas (divergencia / absorción nuevas) ────────────────────────
function revisarAlertas(agg) {
  if (!agg.candles || !agg.candles.length) return;
  const recientes = new Set(agg.candles.slice(-3).map((c) => c.t));   // la absorción es de velas cerradas: avisa cuando acaba de salir
  let sono = false;
  (agg.divergences || []).filter((d) => recientes.has(d.t)).forEach((d) => {
    const k = 'div' + d.kind + d.t; if (S.alertadas.has(k)) return; S.alertadas.add(k);
    toast(d.kind === 'bull' ? 'up' : 'down', d.kind === 'bull' ? 'Bullish divergence' : 'Bearish divergence', `${S.par.id} · CVD vs price ${S.tf}`);
    if (!sono) { ping(); sono = true; }
  });
  (agg.absorciones || []).filter((a) => recientes.has(a.t)).forEach((a) => {
    const k = 'abs' + a.side + a.t; if (S.alertadas.has(k)) return; S.alertadas.add(k);
    const comprador = a.side === 'sell';
    const pStr = a.price != null ? Number(a.price).toLocaleString('en-US', { minimumFractionDigits: decPar(), maximumFractionDigits: decPar() }) : '';
    toast(comprador ? 'up' : 'down', comprador ? 'Buyer absorption' : 'Seller absorption', `${S.par.id} · ${pStr}`);
    if (!sono) { ping(); sono = true; }
  });
}
function toast(tipo, titulo, sub) {
  const box = $('fp-alerts'); if (!box) return;
  const d = document.createElement('div'); d.className = 'fp-toast t-' + tipo;
  d.innerHTML = `<b>${esc(titulo)}</b><span>${esc(sub)}</span>`;
  box.appendChild(d);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 350); }, 9000);
  while (box.children.length > 4) box.removeChild(box.firstChild);
}

// ── Analista (píldora, mismo patrón que VWAP Pro) ───────────────────
const AN_UI = { en: { live: 'live footprint', why: 'Why', hide: 'Hide', flow: 'FLOW' }, es: { live: 'footprint en vivo', why: 'Por qué', hide: 'Ocultar', flow: 'FLUJO' } };
const TAG = { compra: { en: 'BUY', es: 'COMPRA' }, venta: { en: 'SELL', es: 'VENTA' }, tendencia: { en: 'TREND', es: 'TENDENCIA' }, vigilar: { en: 'WATCH', es: 'VIGILAR' }, aviso: { en: 'CAUTION', es: 'AVISO' } };
function idiomaIni() { return 'en'; }   // la plataforma es inglés por defecto; el usuario puede cambiar a ES en la píldora
const anL = (o, l) => (o && (o[l] != null ? o[l] : o.en)) || '';

/* El analista vive en una COLUMNA vertical a la derecha de la gráfica, activo en
   vivo: reescribe su lectura según cambia el flujo y muestra las cifras del
   momento (compra / venta / delta / CVD de la vela actual). */
function renderAnalistaCol() {
  const col = $('fp-an-col'); if (!col) return;
  const lang = S.an.lang, m = S.an.msg;
  if (!m) {
    col.className = 'fp-an-col';
    col.innerHTML = `
      <div class="fp-anc-head"><img class="fp-anc-ava" src="${AVATAR}" alt="Jesús" onerror="this.style.display='none'">
        <div class="fp-anc-id"><b>Jesús</b><span>${lang === 'es' ? 'No es consejo financiero' : 'Not financial advice'}</span></div></div>
      <div class="fp-anc-wait"><i class="fp-anc-dot"></i>${lang === 'es' ? 'Leyendo el flujo de órdenes…' : 'Reading the order flow…'}</div>`;
    return;
  }
  col.className = 'fp-an-col t-' + m.tipo;
  col.innerHTML = `
    <div class="fp-anc-head">
      <img class="fp-anc-ava" src="${AVATAR}" alt="Jesús" onerror="this.style.display='none'">
      <div class="fp-anc-id"><b>Jesús</b><span>${lang === 'es' ? 'No es consejo financiero' : 'Not financial advice'}</span></div>
      <button class="fp-anc-lang" type="button">${lang === 'en' ? 'ES' : 'EN'}</button>
    </div>
    <div class="fp-anc-live"><i class="fp-anc-dot"></i><span>${lang === 'es' ? 'EN VIVO' : 'LIVE'}</span><em class="fp-anc-tag c-${m.tipo}">${esc(anL(TAG[m.tipo] || { en: 'FLOW', es: 'FLUJO' }, lang))}</em></div>
    <div class="fp-anc-stats" id="fp-anc-stats"></div>
    <div class="fp-anc-title">${esc(anL(m.titulo, lang))}</div>
    <div class="fp-anc-tx" data-esc="${esc(anL(m.txt, lang))}"></div>
    <div class="fp-anc-do"><span>${lang === 'es' ? 'Qué vigilar' : 'What to watch'}</span>${esc(anL(m.hacer, lang))}</div>
    <div class="fp-anc-why">${(m.detalle || []).map((x) => `<div class="fp-anc-li">${esc(anL(x, lang))}</div>`).join('')}</div>
    <div class="fp-anc-disc">${lang === 'es' ? 'Flujo de órdenes de Binance en vivo' : 'Live Binance order flow'}</div>`;
  const lng = col.querySelector('.fp-anc-lang'); if (lng) lng.onclick = (e) => { e.stopPropagation(); S.an.lang = S.an.lang === 'es' ? 'en' : 'es'; renderAnalistaCol(); };
  escribir(col.querySelector('[data-esc]'));
  actualizarLiveStats();
}
function actualizarAnalista() {
  if (!S.an || !S.agg) return;
  let m; try { m = leerFootprint(S.agg, S.meta); } catch (_) { m = null; }
  if (!m) return;
  const cambio = m.clave !== S.an.clave; S.an.msg = m; S.an.clave = m.clave;
  if (cambio) renderAnalistaCol();
  else {
    const tx = document.querySelector('.fp-anc-tx'); if (tx && tx.dataset.hecho) tx.textContent = anL(m.txt, S.an.lang);
    const hz = document.querySelector('.fp-anc-do'); if (hz) hz.innerHTML = `<span>${S.an.lang === 'es' ? 'Qué vigilar' : 'What to watch'}</span>${esc(anL(m.hacer, S.an.lang))}`;
  }
}
/* Cifras del momento (vela en formación): compra vs venta, delta y CVD. Datos
   reales, se actualizan trade a trade: el analista "habla" en tiempo real. */
function actualizarLiveStats() {
  const el = $('fp-anc-stats'); if (!el) return;
  const live = S.live; let b = 0, s = 0;
  if (live && live.niveles) for (const n of live.niveles) { b += n.buy; s += n.sell; }
  const delta = b - s;
  const cvd = (S.agg && S.agg.cvd) || []; const cvdNow = cvd.length ? cvd[cvd.length - 1].v : 0;
  const lang = S.an ? S.an.lang : 'en';
  const cell = (k, v, cls) => `<div class="fp-anc-st"><span>${k}</span><b class="${cls || ''}">${v}</b></div>`;
  el.innerHTML =
    cell(lang === 'es' ? 'Compra' : 'Buyers', fmt(b), 'up') +
    cell(lang === 'es' ? 'Venta' : 'Sellers', fmt(s), 'down') +
    cell('Delta', (delta >= 0 ? '+' : '−') + fmt(Math.abs(delta)), delta >= 0 ? 'up' : 'down') +
    cell('CVD', (cvdNow >= 0 ? '+' : '−') + fmt(Math.abs(cvdNow)), cvdNow >= 0 ? 'up' : 'down');
}
function escribir(el) { if (!el || el.dataset.hecho) return; const txt = el.dataset.esc || ''; el.dataset.hecho = '1'; let n = 0; const t = setInterval(() => { n += 2; el.textContent = txt.slice(0, n); if (n >= txt.length) { el.textContent = txt; clearInterval(t); } }, 12); }

// ── Exportar imagen con cabecera + pie de marca (mismo estilo del sitio) ──
function exportar() {
  const src = S.render && S.render.snapshot(); if (!src) return;
  const e2 = Math.min(2, window.devicePixelRatio || 1);
  const Hh = Math.round(46 * e2), barra = Math.round(78 * e2);
  const out = document.createElement('canvas');
  out.width = src.width; out.height = Hh + src.height + barra;
  const g = out.getContext('2d');
  g.fillStyle = '#0a0e14'; g.fillRect(0, 0, out.width, out.height);
  const tf = (TFS.find((t) => t.id === S.tf) || {}).n || S.tf;
  g.textAlign = 'left'; g.fillStyle = '#E8B84B'; g.font = `800 ${18 * e2}px "Chakra Petch",system-ui,monospace`;
  g.fillText(S.par.id + 'USD · ' + tf + ' · Footprint', 16 * e2, 30 * e2);
  g.textAlign = 'right'; g.fillStyle = '#eaecef'; g.font = `700 ${15 * e2}px ui-monospace,monospace`;
  g.fillText(($('fp-px') ? $('fp-px').textContent : ''), out.width - 16 * e2, 30 * e2);
  g.drawImage(src, 0, Hh, src.width, src.height);
  const yB = Hh + src.height;
  g.fillStyle = '#0b0e12'; g.fillRect(0, yB, out.width, barra);
  g.fillStyle = 'rgba(232,184,75,.35)'; g.fillRect(0, yB, out.width, 2 * e2);
  const textos = (x) => {
    // Pie: SOLO nuestra marca (logo + dominio) a la izquierda; a la derecha par·tf + fecha. Sin texto de fuente.
    g.textAlign = 'left'; g.fillStyle = '#C9A84B'; g.font = `700 ${15 * e2}px ui-monospace,monospace`; g.fillText('decfreedom.com', x, yB + 48 * e2);
    g.textAlign = 'right'; g.fillStyle = '#8b96a3'; g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillText(`${S.par.id} · ${tf} · Footprint`, out.width - 20 * e2, yB + 34 * e2);
    g.font = `${11 * e2}px ui-monospace,monospace`; g.fillStyle = '#6b7681';
    g.fillText(new Date().toLocaleString('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), out.width - 20 * e2, yB + 56 * e2);
    g.textAlign = 'left';
  };
  const bajar = () => out.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `decfreedom-footprint-${S.par.id}-${S.tf}-${Date.now()}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }, 'image/png');
  const logo = new Image(); let hecho = false;
  const una = (w) => { if (hecho) return; hecho = true; textos(w ? 20 * e2 + w + 18 * e2 : 20 * e2); bajar(); };
  logo.onload = () => { try { const alto = 52 * e2, ancho = Math.round(logo.width * (alto / logo.height)); g.drawImage(logo, 20 * e2, yB + (barra - alto) / 2, ancho, alto); una(ancho); } catch (_) { una(0); } };
  logo.onerror = () => { const l2 = new Image(); l2.onload = () => { try { const alto = 46 * e2, ancho = Math.round(l2.width * (alto / l2.height)); g.drawImage(l2, 20 * e2, yB + (barra - alto) / 2, ancho, alto); una(ancho); } catch (_) { una(0); } }; l2.onerror = () => una(0); l2.src = LOGO_ALT; };
  setTimeout(() => una(0), 1800);
  logo.src = LOGO;
}

// ── Ciclo de vida ────────────────────────────────────────────────────
function onResize() { if (S.render) try { S.render.resize(); posMarca(); } catch (_) {} }
function cerrar() {
  try { if (S.stream) S.stream.cerrar(); } catch (_) {}
  try { if (S.worker) S.worker.terminate(); } catch (_) {}
  if (S.rebuildT) clearTimeout(S.rebuildT); if (S.velasT) clearInterval(S.velasT); if (S.timerT) clearInterval(S.timerT);
  window.removeEventListener('resize', onResize);
  cerrarPops();
  const ov = $('fp-overlay'); if (ov) ov.remove();
  S.worker = null; S.stream = null; S.render = null; S.agg = null; S.trades = [];
}
