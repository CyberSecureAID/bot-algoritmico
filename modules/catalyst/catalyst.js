/* catalyst.js — Servicio "Catalyst" de Analisis.
 *
 * Grafica de acciones de EE.UU. (como TC2000) con las 6 estrategias de opciones.
 * NO reinventa la grafica: reusa la MISMA dinamica del resto de Analisis
 * (lightweight-charts, cruceta, logo watermark cco-marca, y la MISMA barra de
 * dibujo de Smart Pools / Multichart via montarBarra, con la que el usuario traza
 * la linea de tendencia que piden las estrategias). El analista Jesus da soporte
 * en vivo, sin revelar la estrategia. Terminologia LONG/SHORT.
 */

import { ESTRATEGIAS, porId } from './estrategias.js?v=2';
import { sma, bollinger, worden } from './indicadores.js?v=1';
import { leerCatalyst } from './analista.js?v=2';
import * as D from './datos.js?v=6';
import { montarBarra } from '../../assets/js/niveles/barra.js?v=8';
import { N as NIV } from '../../assets/js/niveles/estado.js?v=1';

const LIB = new URL('../trading-demo/vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;   // watermark DecFreedom (como Multichart)
const AVATAR = new URL('../../assets/img/jesus-avatar.webp', import.meta.url).href;
const DISC_IMG = new URL('../../assets/portada/red/disclaimer.webp', import.meta.url).href;   // MISMA imagen del disclaimer de la plataforma
const $ = (id) => document.getElementById(id);
function lib() { return window.LightweightCharts ? Promise.resolve(window.LightweightCharts) : new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.onload = () => res(window.LightweightCharts); s.onerror = rej; document.head.appendChild(s); }); }

const IC = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  chev: '▾',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  present: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>'
};

/* Temporalidades servidas como en Liquidity Pools: un boton con la TF actual que
   abre un menu en rejilla de 3 columnas con todas. */
const TFS = [{ id: '1m', n: '1m' }, { id: '5m', n: '5m' }, { id: '15m', n: '15m' }, { id: '30m', n: '30m' }, { id: '1h', n: '1H' }, { id: '2h', n: '2H' }, { id: '4h', n: '4H' }, { id: '1D', n: '1D' }, { id: '1W', n: '1W' }];
const S = { tf: '15m', estr: ESTRATEGIAS[0], activo: D.ACTIVOS[0], lang: 'en', anOpen: true, chart: null, serie: null, ind: {}, feed: [], seq: 0, lastKey: '', velas: [], pin: null, barra: null, _raf: null };

/* Cada FAMILIA de estrategia mira indicadores distintos: por eso la grafica cambia
   de verdad al pasar de una a otra. */
const GRUPO_IND = {
  'Cambio de tendencia':   { ma20: 1, ma40: 1, ma100: 0, ma200: 0, bb: 0, pm: 0 },
  'Efecto imán':           { ma20: 1, ma40: 0, ma100: 0, ma200: 0, bb: 1, pm: 0 },
  'Rebote en punto medio': { ma20: 1, ma40: 0, ma100: 1, ma200: 1, bb: 1, pm: 1 }
};
const LADO_TXT = { call: { en: 'LONG', es: 'LONG' }, put: { en: 'SHORT', es: 'SHORT' } };
const fmtPx = (x) => '$' + Number(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ───────── disclaimer de entrada (una vez por navegador) ───────── */
function discOK() { try { return localStorage.getItem('catalyst_disc_ok') === '1'; } catch (_) { return false; } }
/* MISMA dinámica que el disclaimer de la plataforma (mostrarDisclaimer de
   analisis.js): mismas clases .an-modal / .an-disc, en inglés, con la imagen de
   marca (no la foto del analista). Solo cambia el texto, específico de Catalyst. */
function mostrarDisc() {
  const host = $('cat-overlay') || document.body;
  if (host.querySelector('#cat-disc')) return;
  const m = document.createElement('div'); m.className = 'an-modal'; m.id = 'cat-disc';
  m.innerHTML = `
    <div class="an-modal-bg"></div>
    <div class="an-modal-card an-disc-card">
      <div class="an-disc-box">
        <img class="an-disc-fl" src="${DISC_IMG}" alt="" onerror="this.style.display='none'">
        <p>Catalyst shows US stocks with indicators for informational and educational purposes only. Nothing here is financial, investment, legal or tax advice, and we do not guarantee any result, profit or performance. Trading carries substantial risk and you may lose part or all of your capital. Every decision is your own and you are solely responsible for it.</p>
        <p>This section includes an <b>analyst</b>, Jesús. He is here only to <b>support you</b>, with a live read of the market so you do not mis execute the strategy you are applying at that moment. He never tells you what to buy or sell and guarantees no result. Treat it as support, never as a recommendation.</p>
        <label class="an-disc-chk"><input type="checkbox" id="cat-disc-agree"><span>I have read and I accept this notice and the <b>Terms and Conditions</b>. I understand these tools do not guarantee any result and that I use them entirely at my own risk.</span></label>
        <button class="an-pay gold an-disc-ok" id="cat-disc-ok" disabled style="opacity:.45;cursor:not-allowed">Accept</button>
      </div>
    </div>`;
  host.appendChild(m);
  requestAnimationFrame(() => m.classList.add('on'));
  const bg = m.querySelector('.an-modal-bg'); if (bg) bg.onclick = (e) => { e.preventDefault(); e.stopPropagation(); };
  const chk = $('cat-disc-agree'), ok = $('cat-disc-ok');
  chk.addEventListener('change', () => { if (chk.checked) { ok.removeAttribute('disabled'); ok.style.opacity = ''; ok.style.cursor = ''; } else { ok.setAttribute('disabled', ''); ok.style.opacity = '.45'; ok.style.cursor = 'not-allowed'; } });
  ok.onclick = () => { if (!chk.checked) return; try { localStorage.setItem('catalyst_disc_ok', '1'); } catch (_) {} m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 180); };
}

export async function abrirCatalyst() {
  if ($('cat-overlay')) return;
  estilos();
  const ov = document.createElement('div'); ov.id = 'cat-overlay';
  ov.innerHTML = `
    <div class="cat-top">
      <button class="cat-back" id="cat-back">${IC.back}Back</button>
      <div class="cat-sep"></div>
      <button class="cat-coin" id="cat-coin"><i class="cat-coin-lg" id="cat-coin-lg"></i><b id="cat-coin-id"></b><span id="cat-coin-nm"></span><em class="cat-chev">${IC.chev}</em></button>
      <button class="cat-tfsel" id="cat-tfsel"><b id="cat-tfsel-n">15m</b><em>${IC.chev}</em></button>
      <div class="cat-pxbox"><b class="cat-px" id="cat-px">—</b><span class="cat-chg" id="cat-chg"></span></div>
      <div class="cat-strat" id="cat-strat"></div>
      <div class="cat-top-r">
        <button class="cat-ico cat-anbtn" id="cat-anbtn" title="Jesús (analyst)"><span class="cat-anbtn-ph"><img src="${AVATAR}" alt="" onerror="this.style.display='none'"></span></button>
        <button class="cat-ico" id="cat-gear" title="Alert email">${IC.gear}</button>
      </div>
    </div>
    <div class="cat-stage">
      <div class="cat-cvwrap" id="cat-cvwrap">
        <div class="cat-cv" id="cat-cv"></div>
        <div class="cat-wm"><img src="${LOGO}" alt=""></div>
        <div class="cat-leg" id="cat-leg"></div>
        <div class="cat-pin" id="cat-pin" style="display:none"></div>
        <div class="cat-osclabel" id="cat-osclabel">Worden Stochastics</div>
        <button class="cat-present" id="cat-present" title="Back to the latest price" style="display:none">${IC.present}</button>
        <div class="cat-spin" id="cat-spin">Loading…</div>
      </div>
      <aside class="cat-an-col" id="cat-an-col"></aside>
    </div>`;
  document.body.appendChild(ov);
  $('cat-back').onclick = cerrar;
  $('cat-gear').onclick = ajustes;
  $('cat-anbtn').onclick = () => { S.anOpen = !S.anOpen; pintarAnalista(); };
  $('cat-coin').onclick = (e) => { e.stopPropagation(); menuActivos(); };
  $('cat-tfsel').onclick = (e) => { e.stopPropagation(); menuTfs(); };
  $('cat-present').onclick = vistaDefecto;
  pintarCoin(); pintarTfs(); pintarStrat(); pintarAnalista();
  await montarChart();
  if (!S._timer) S._timer = setInterval(tic, 12000);
  S._raf = requestAnimationFrame(rafLoop);
  cargar();                        // asincrona: el spinner se encarga, NO bloquea la apertura
  if (!discOK()) mostrarDisc();    // disclaimer ENCIMA del overlay, sin bloquear la carga
}
function cerrar() {
  try { clearInterval(S._timer); } catch (_) {} S._timer = null;
  try { cancelAnimationFrame(S._raf); } catch (_) {} S._raf = null;
  try { S.barra && S.barra.desmontar && S.barra.desmontar(); } catch (_) {} S.barra = null;
  try { S.chart && S.chart.remove(); } catch (_) {} S.chart = null;
  const ov = $('cat-overlay'); if (ov) ov.remove();
}
function tic() {
  if (S._fetchAt && Date.now() - S._fetchAt > 150000) { cargar(); return; }
  precioEnVivo();                                  // mueve la ultima vela (como un stream)
  empujarFeed(); pintarAnalista(); actualizarEntrada();
}

/* ───────── top bar ───────── */
function pintarCoin() {
  $('cat-coin-id').textContent = S.activo.s;
  $('cat-coin-nm').textContent = S.activo.n;
  logoEn($('cat-coin-lg'), S.activo);
}
/* Logo con cadena de respaldo FMP -> Parqet -> monograma, y object-fit:contain
   para que SIEMPRE quepa en su caja (no se desborde). */
function logoEn(el, a) {
  if (!el) return;
  el.classList.remove('mono');
  el.innerHTML = `<img src="${D.logoDe(a)}" alt="" data-alt="${D.logoAlt(a)}" onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';}else{this.style.display='none';this.parentNode.classList.add('mono');}"><span>${a.s.slice(0, 2)}</span>`;
}
function pintarTfs() { const el = $('cat-tfsel-n'); if (el) el.textContent = (TFS.find((t) => t.id === S.tf) || TFS[2]).n; }
function menuTfs() {
  if ($('cat-tfmenu')) { cerrarMenus(); return; }
  cerrarMenus();
  const m = document.createElement('div'); m.className = 'cat-menu cat-tfmenu'; m.id = 'cat-tfmenu';
  m.innerHTML = TFS.map((t) => `<button class="cat-tfm-it ${t.id === S.tf ? 'on' : ''}" data-tf="${t.id}">${t.n}</button>`).join('');
  document.body.appendChild(m);
  const r = $('cat-tfsel').getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = (r.bottom + 6) + 'px';
  m.querySelectorAll('.cat-tfm-it').forEach((b) => b.onclick = () => { S.tf = b.getAttribute('data-tf'); pintarTfs(); cerrarMenus(); cargar(); });
  setTimeout(() => document.addEventListener('click', function cl(ev) { const sel = $('cat-tfsel'); if (!m.contains(ev.target) && sel && ev.target !== sel && !sel.contains(ev.target)) { cerrarMenus(); document.removeEventListener('click', cl); } }), 0);
}
/* Boton por estrategia: el ACTIVO muestra su NOMBRE (1-2 palabras) para que
   siempre sepas en cual estas; los demas, solo el numero (con el nombre en title). */
function pintarStrat() {
  $('cat-strat').innerHTML = ESTRATEGIAS.map((e) => {
    const on = e.id === S.estr.id;
    return `<button class="cat-sx ${e.lado} ${on ? 'on' : ''}" data-id="${e.id}" title="${e.n}. ${e.corto} (${e.grupo})"><i>${e.n}</i>${on ? `<b>${e.corto}</b>` : ''}</button>`;
  }).join('');
  $('cat-strat').querySelectorAll('.cat-sx').forEach((b) => b.onclick = () => {
    S.estr = porId(b.getAttribute('data-id'));
    if (S.estr.tfEntrada) { S.tf = S.estr.tfEntrada; pintarTfs(); }
    S.feed = []; S.lastKey = ''; pintarStrat(); cargar();
  });
}

/* ───────── chart ───────── */
async function montarChart() {
  const LC = await lib(); S.LC = LC;
  const chart = LC.createChart($('cat-cv'), {
    autoSize: true, localization: { locale: 'en' },
    layout: { background: { type: 'solid', color: '#05070a' }, textColor: '#8b95a1', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, attributionLogo: false },
    grid: { vertLines: { color: 'rgba(255,255,255,.028)' }, horzLines: { color: 'rgba(255,255,255,.028)' } },
    rightPriceScale: { borderColor: '#222b35', scaleMargins: { top: 0.08, bottom: 0.08 } },
    timeScale: { borderColor: '#222b35', timeVisible: S.tf !== '1D' && S.tf !== '1W', secondsVisible: false, rightOffset: 4, barSpacing: 7, minBarSpacing: 0.5 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  S.chart = chart;
  S.serie = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e', priceLineVisible: true, lastValueVisible: true });
  const linea = (color, w) => chart.addSeries(LC.LineSeries, { color, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  S.ind.ma20 = linea('#E8B84B', 2); S.ind.ma40 = linea('#49b6ff', 2);
  S.ind.ma100 = linea('rgba(122,102,216,.8)', 1); S.ind.ma200 = linea('rgba(255,143,191,.65)', 1);
  S.ind.bbA = linea('rgba(120,150,200,.5)', 1); S.ind.bbM = linea('rgba(120,150,200,.3)', 1); S.ind.bbB = linea('rgba(120,150,200,.5)', 1);
  // Worden en su PROPIO panel: escala 0..100, lineas 20/50/80, etiqueta. (Sin volumen: estorbaba.)
  S.ind.wK = chart.addSeries(LC.LineSeries, { color: '#2ee86a', lineWidth: 2, priceLineVisible: false, lastValueVisible: true }, 1);
  S.ind.wS = chart.addSeries(LC.LineSeries, { color: '#ff5b6e', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 1);
  try { S.ind.wK.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) }); } catch (_) {}
  [20, 50, 80].forEach((lv) => { try { S.ind.wK.createPriceLine({ price: lv, color: 'rgba(255,255,255,.18)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true }); } catch (_) {} });
  try { const ps = chart.panes(); if (ps[1]) ps[1].setHeight(140); } catch (_) {}
  // cruceta: leyenda OHLC en vivo (reacciona al tocar, como Multichart)
  try { chart.subscribeCrosshairMove((p) => pintarLeg(p)); } catch (_) {}
  // boton "volver al presente"
  try { chart.timeScale().subscribeVisibleLogicalRangeChange((r) => { const b = $('cat-present'); if (!b || !r) return; const n = S.velas.length; b.style.display = (r.to < n - 2) ? 'grid' : 'none'; }); } catch (_) {}
  // barra de dibujo de Smart Pools / Multichart (traza la linea de tendencia de las estrategias)
  NIV.seccion = 'catalyst';
  try {
    S.barra = montarBarra($('cat-cvwrap'));
    // La barra viene en modo auto-ocultar (nv-oculta), cuyo CSS de mostrar esta
    // atado a #nv-overlay; aqui la queremos SIEMPRE visible a la derecha.
    const tb = $('cat-cvwrap').querySelector('.nv-tools'); if (tb) tb.classList.remove('nv-oculta');
    const tab = $('cat-cvwrap').querySelector('.nv-tools-tab'); if (tab) tab.remove();
  } catch (_) { S.barra = null; }
}

function rafLoop() {
  if (!$('cat-overlay')) { S._raf = null; return; }
  pintarBarra(); posicionarPin();
  S._raf = requestAnimationFrame(rafLoop);
}
function vistaDefecto() { try { const n = S.velas.length; if (n > 3 && S.chart) S.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 130), to: n + 3 }); } catch (_) {} }

async function cargar() {
  const sp = $('cat-spin'); if (sp) sp.style.display = 'grid';
  const gen = (S.gen = (S.gen || 0) + 1);
  try {
    const { velas } = await D.velas(S.activo.s, S.tf, 500);
    if (gen !== S.gen) return;
    S.velas = velas; S._fetchAt = Date.now();
    S.serie.setData(velas.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    recalc();
    if (S.chart) S.chart.timeScale().applyOptions({ timeVisible: S.tf !== '1D' && S.tf !== '1W' });
    vistaDefecto();
    const t = await D.ticker(S.activo.s).catch(() => null);
    pintarPx(t);
    empujarFeed(); pintarAnalista(); actualizarEntrada();
  } catch (_) {}
  if (gen === S.gen && sp) sp.style.display = 'none';
}

function recalc() {
  const v = S.velas; if (!v || !v.length) return;
  const cl = (a) => a.filter((p) => p.value != null);
  const m20 = cl(sma(v, 20));
  S.ind.ma20.setData(m20); S.ind.ma40.setData(cl(sma(v, 40)));
  S.ind.ma100.setData(cl(sma(v, 100))); S.ind.ma200.setData(cl(sma(v, 200)));
  S._ma20 = m20.length ? m20[m20.length - 1].value : null;
  const bb = bollinger(v, 20, 2);
  S.ind.bbA.setData(cl(bb.alta)); S.ind.bbM.setData(cl(bb.media)); S.ind.bbB.setData(cl(bb.baja));
  const w = worden(v, 14, 3, 3);
  S.ind.wK.setData(cl(w.k)); S.ind.wS.setData(cl(w.señal));
  aplicarVisibilidad();
}
function aplicarVisibilidad() {
  const cfg = GRUPO_IND[S.estr.grupo] || GRUPO_IND['Cambio de tendencia'];
  const set = (s, on) => { try { s && s.applyOptions({ visible: !!on }); } catch (_) {} };
  set(S.ind.ma20, cfg.ma20); set(S.ind.ma40, cfg.ma40);
  set(S.ind.ma100, cfg.ma100); set(S.ind.ma200, cfg.ma200);
  set(S.ind.bbA, cfg.bb); set(S.ind.bbM, cfg.bb); set(S.ind.bbB, cfg.bb);
  try { if (S.ind.pmLine) { S.serie.removePriceLine(S.ind.pmLine); S.ind.pmLine = null; } } catch (_) {}
  if (cfg.pm && S._ma20 != null) {
    try { S.ind.pmLine = S.serie.createPriceLine({ price: S._ma20, color: 'rgba(232,184,75,.55)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Midpoint' }); } catch (_) {}
  }
}

/* precio en vivo: mueve la ULTIMA vela con el ultimo precio (stream simulado;
   las acciones no tienen WS gratis, pero asi la vela respira como en los demas). */
async function precioEnVivo() {
  if (!S.velas.length) return;
  const t = await D.ticker(S.activo.s).catch(() => null);
  if (!t || !S.velas.length) return;
  const u = S.velas[S.velas.length - 1];
  u.close = t.last; if (t.last > u.high) u.high = t.last; if (t.last < u.low) u.low = t.last;
  try { S.serie.update({ time: u.time, open: u.open, high: u.high, low: u.low, close: u.close }); } catch (_) {}
  pintarPx(t);
}
function pintarPx(t) {
  const px = t ? t.last : (S.velas.length ? S.velas[S.velas.length - 1].close : 0);
  const chg = t ? t.chgPct : null;
  const pe = $('cat-px'); if (pe) pe.textContent = fmtPx(px);
  const ce = $('cat-chg'); if (ce) { if (chg != null) { ce.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'; ce.className = 'cat-chg ' + (chg >= 0 ? 'up' : 'dn'); } else ce.textContent = ''; }
}
/* leyenda OHLC al pasar el cursor (la grafica reacciona, como Multichart) */
function pintarLeg(p) {
  const el = $('cat-leg'); if (!el) return;
  if (!p || !p.time || !p.seriesData || !S.serie) { el.classList.remove('on'); return; }
  const d = p.seriesData.get(S.serie); if (!d || d.open == null) { el.classList.remove('on'); return; }
  const up = d.close >= d.open;
  el.innerHTML = `<b>${S.activo.s}</b> <span class="${up ? 'u' : 'd'}">O ${fmtPx(d.open)}  H ${fmtPx(d.high)}  L ${fmtPx(d.low)}  C ${fmtPx(d.close)}</span>`;
  el.classList.add('on');
}

/* ───────── analista: feed en vivo ───────── */
function hhmm() { const d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
function empujarFeed() {
  const e = S.estr; e._sym = S.activo.s;
  const m = leerCatalyst(S.velas, e, S.seq);
  if (!m) return;
  const key = e.id + ':' + m.escena;
  if (key === S.lastKey && S.feed.length) return;
  S.lastKey = key; S.seq++;
  S.feed.unshift({ seq: S.seq, ts: hhmm(), ...m });
  S.feed = S.feed.slice(0, 4);
}

function pintarAnalista() {
  const col = $('cat-an-col'), btn = $('cat-anbtn');
  if (btn) btn.classList.toggle('on', S.anOpen);
  if (!col) return;
  if (!S.anOpen) { col.style.display = 'none'; return; }
  col.style.display = 'flex';
  const lang = S.lang, e = S.estr;
  const dis = lang === 'es' ? 'No es asesoría financiera. Jesús solo da soporte para que no ejecutes mal la estrategia. Operar conlleva riesgo.' : 'Not financial advice. Jesús only supports you so you do not mis execute the strategy. Trading carries risk.';
  const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const TAG = { lejos: ['WAIT', 'ESPERA'], vigilar: ['WATCH', 'VIGILA'], cerca: ['CLOSE', 'CERCA'], listo: ['READY', 'LISTO'], entra: ['GO', 'ENTRA'], invalida: ['OFF', 'FUERA'] };
  const cards = S.feed.map((m, i) => {
    const tg = (TAG[m.escena] || ['', ''])[lang === 'es' ? 1 : 0];
    const prox = Math.round((m.prox || 0) * 100);
    return `<div class="cat-msg e-${m.escena} ${i === 0 ? 'top' : ''}">
      <div class="cat-msg-h"><span class="cat-msg-n">#${m.seq}</span><em class="cat-msg-tg">${tg}</em><span class="cat-msg-ts">${m.ts}</span>${i === 0 ? `<span class="cat-msg-new">${lang === 'es' ? 'NUEVO' : 'NEW'}</span>` : ''}</div>
      <div class="cat-msg-t">${esc(m.titulo[lang])}</div>
      <p class="cat-msg-x">${esc(m.txt[lang])}</p>
      <div class="cat-msg-do"><i style="width:${prox}%"></i><b>${esc(m.hacer[lang])}</b></div>
    </div>`;
  }).join('');
  col.innerHTML = `
    <div class="cat-anc-head">
      <img class="cat-anc-ava" src="${AVATAR}" alt="Jesús" onerror="this.style.display='none'">
      <div class="cat-anc-id"><b>Jesús</b><span>${lang === 'es' ? 'Soporte, no consejo' : 'Support, not advice'}</span></div>
      <button class="cat-anc-lang" id="cat-anc-lang">${lang === 'en' ? 'ES' : 'EN'}</button>
      <button class="cat-anc-min" id="cat-anc-min" title="${lang === 'es' ? 'Ocultar' : 'Hide'}">${IC.close}</button>
    </div>
    <div class="cat-anc-sub"><i class="cat-anc-dot"></i><span>${lang === 'es' ? 'EN VIVO' : 'LIVE'}</span><em>${esc(e.corto)} · ${LADO_TXT[e.lado][lang]}</em></div>
    <div class="cat-feed">${cards || `<div class="cat-anc-wait">${lang === 'es' ? 'Leyendo el precio…' : 'Reading the tape…'}</div>`}</div>
    <p class="cat-anc-dis">${dis}</p>`;
  const lb = $('cat-anc-lang'); if (lb) lb.onclick = () => { S.lang = S.lang === 'en' ? 'es' : 'en'; pintarAnalista(); };
  const mb = $('cat-anc-min'); if (mb) mb.onclick = () => { S.anOpen = false; pintarAnalista(); };
}

/* ───────── tachuela de entrada: punto en la vela + linea punteada + etiqueta
   alejada (long por ABAJO, short por ARRIBA) con sombra 3D ───────── */
function actualizarEntrada() {
  const top = S.feed[0];
  const live = top && top.escena === 'entra';
  const pin = $('cat-pin');
  try { if (S.ind.entryLine) { S.serie.removePriceLine(S.ind.entryLine); S.ind.entryLine = null; } } catch (_) {}
  if (!live || !S.velas.length) { S.pin = null; if (pin) { pin.style.display = 'none'; pin.innerHTML = ''; } return; }
  const long = top.lado === 'call';
  const ult = S.velas[S.velas.length - 1];
  const px = ult.close;
  try { S.ind.entryLine = S.serie.createPriceLine({ price: px, color: long ? '#2ee86a' : '#ff5b6e', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: long ? 'LONG' : 'SHORT' }); } catch (_) {}
  S.pin = { long, price: px, time: ult.time, txt: long ? 'LONG' : 'SHORT' };
  const box = `<div class="cat-pin-box"><i class="cat-pin-tip"></i><b>${S.pin.txt}</b><span>${fmtPx(px)}</span></div>`;
  const dot = `<span class="cat-pin-dot"></span>`, line = `<span class="cat-pin-line"></span>`;
  if (pin) { pin.className = 'cat-pin ' + (long ? 'long' : 'short'); pin.innerHTML = long ? dot + line + box : box + line + dot; }
  posicionarPin();
}
function posicionarPin() {
  const pin = $('cat-pin'); const p = S.pin;
  if (!pin || !p || !S.chart || !S.serie) { if (pin) pin.style.display = 'none'; return; }
  let x = null, y = null;
  try { x = S.chart.timeScale().timeToCoordinate(p.time); } catch (_) {}
  try { y = S.serie.priceToCoordinate(p.price); } catch (_) {}
  if (x == null || y == null) { pin.style.display = 'none'; return; }
  const cv = $('cat-cv'); const W = cv ? cv.clientWidth : 800;
  x = Math.max(66, Math.min(W - 66, x));
  pin.style.left = Math.round(x) + 'px';
  pin.style.top = Math.round(y) + 'px';
  pin.style.display = 'flex';
}

/* ───────── geometria para la barra de dibujo (igual que Multichart) ───────── */
function geoBar() {
  const chart = S.chart, serie = S.serie, body = $('cat-cvwrap');
  if (!chart || !serie || !body || !S.velas.length) return null;
  let ts; try { ts = chart.timeScale(); } catch (_) { return null; }
  const W = body.clientWidth, H = body.clientHeight;
  let x1; try { x1 = ts.width(); } catch (_) { x1 = W; } if (!(x1 > 0)) x1 = W;
  let y1 = H; try { const pn = chart.panes(); y1 = (pn && pn[0]) ? pn[0].getHeight() : H; } catch (_) { y1 = H; } if (!(y1 > 0)) y1 = H;
  let vr; try { vr = ts.getVisibleLogicalRange(); } catch (_) { vr = null; } if (!vr) return null;
  const nV = S.velas.length;
  const iA = Math.max(0, Math.min(nV - 1, Math.ceil(vr.from))), iB = Math.max(0, Math.min(nV - 1, iA + 1));
  let paso, b; const xA = ts.logicalToCoordinate(iA), xB = ts.logicalToCoordinate(iB);
  if (xA == null || xB == null || iB === iA) { paso = (ts.options().barSpacing) || 7; b = (xA != null) ? xA - paso * iA : 0; }
  else { paso = (xB - xA) / (iB - iA); b = xA - paso * iA; }
  if (!(paso > 0)) paso = 7;
  const pri = 0.5 - b / paso, ancho = x1 / paso, fin = pri + ancho;
  const pMax = serie.coordinateToPrice(0), pMin = serie.coordinateToPrice(y1);
  if (pMax == null || pMin == null) return null;
  const Y = (pp) => { const c = serie.priceToCoordinate(pp); return (c == null) ? (y1 * (pMax - pp) / ((pMax - pMin) || 1)) : c; };
  return { W, H, x1, y1, pMin, pMax, Y, ancho, paso, fin };
}
function pintarBarra() {
  if (!S.barra) return;
  const g = geoBar(); if (!g) return;
  try { S.barra.redibujar(g, S.velas.map((v) => ({ t: v.time, o: v.open, h: v.high, l: v.low, c: v.close, v: v.volume })), S.activo.s); } catch (_) {}
}

/* ───────── menu de acciones ───────── */
function cerrarMenus() { document.querySelectorAll('.cat-menu').forEach((m) => m.remove()); }
function menuActivos() {
  if (document.querySelector('.cat-menu')) { cerrarMenus(); return; }
  const m = document.createElement('div'); m.className = 'cat-menu';
  m.innerHTML = D.ACTIVOS.map((a) => `<button data-s="${a.s}"><i class="cat-mlg"><img src="${D.logoDe(a)}" alt="" data-alt="${D.logoAlt(a)}" onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';}else{this.style.display='none';this.parentNode.classList.add('mono');}"><span>${a.s.slice(0, 2)}</span></i><b>${a.s}</b><em>${a.n}</em></button>`).join('');
  document.body.appendChild(m);
  const r = $('cat-coin').getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = (r.bottom + 6) + 'px';
  m.querySelectorAll('button').forEach((b) => b.onclick = () => { S.activo = D.ACTIVOS.find((a) => a.s === b.getAttribute('data-s')) || D.ACTIVOS[0]; S.feed = []; S.lastKey = ''; pintarCoin(); cerrarMenus(); cargar(); });
  setTimeout(() => document.addEventListener('click', function cl(ev) { if (!m.contains(ev.target) && ev.target.id !== 'cat-coin') { cerrarMenus(); document.removeEventListener('click', cl); } }), 0);
}

/* ───────── ajustes (correo de alerta) ───────── */
function ajustes() {
  if ($('cat-set')) return;
  const g = (k) => { try { return (localStorage.getItem(k) || '').replace(/"/g, '&quot;'); } catch (_) { return ''; } };
  const b = document.createElement('div'); b.id = 'cat-set';
  b.innerHTML = `
    <div class="cat-set-card" role="dialog" aria-modal="true">
      <button class="cat-set-x" id="cat-set-x" aria-label="Close">${IC.close}</button>
      <h3>Email alerts</h3>
      <p class="cat-set-note">Get an email the moment a setup is about to trigger. Enter the address where you want the alerts.</p>
      <label>Your email<input id="cat-set-mail" type="email" value="${g('catalyst_email')}" placeholder="you@email.com"></label>
      <button class="cat-set-go" id="cat-set-go">Save</button>
      <p class="cat-set-foot">Email sending is set up by the platform. Your address stays on this browser.</p>
    </div>`;
  document.body.appendChild(b);
  const cerrarS = () => b.remove();
  $('cat-set-x').onclick = cerrarS;
  b.addEventListener('click', (e) => { if (e.target === b) cerrarS(); });
  $('cat-set-go').onclick = () => { try { localStorage.setItem('catalyst_email', $('cat-set-mail').value.trim()); } catch (_) {} cerrarS(); };
}

/* ───────── estilos ───────── */
let _css = false;
function estilos() {
  if (_css) return; _css = true;
  const st = document.createElement('style'); st.id = 'cat-css';
  st.textContent = `
  #cat-overlay{position:fixed;inset:0;z-index:9400;background:#05070a;color:#eaecef;display:flex;flex-direction:column;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
  #cat-overlay *{box-sizing:border-box}
  .cat-top{display:flex;align-items:center;gap:9px;padding:9px 13px;border-bottom:1px solid #1a2029;background:#070a0e;flex:none;overflow-x:auto;scrollbar-width:none}
  .cat-top::-webkit-scrollbar{display:none}
  .cat-sep{width:1px;height:24px;background:#222b35;flex:none}
  .cat-back{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 9px;border-radius:9px;font-family:inherit;font-size:13px;font-weight:600;color:#a7b0bb;background:rgba(255,255,255,.05);border:1px solid #29313b;cursor:pointer;flex:none}
  .cat-back svg{width:13px;height:13px}.cat-back:hover{border-color:#C9A84B;color:#E8B84B}
  .cat-coin{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 10px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #29313b;color:#eaecef;font-family:inherit;cursor:pointer;flex:none}
  .cat-coin b{font-weight:700;font-size:13.5px}.cat-coin span{color:#7c868f;font-size:12px}.cat-chev{color:#7c868f;font-style:normal;font-size:11px}
  .cat-coin-lg,.cat-mlg{position:relative;width:22px;height:22px;border-radius:6px;overflow:hidden;background:#fff;display:grid;place-items:center;flex:none}
  .cat-coin-lg img,.cat-mlg img{width:86%;height:86%;object-fit:contain}
  .cat-coin-lg span,.cat-mlg span{position:absolute;inset:0;display:none;place-items:center;font-size:9px;font-weight:800;color:#0b0e12;font-family:'IBM Plex Mono',monospace}
  .cat-coin-lg.mono,.cat-mlg.mono{background:linear-gradient(160deg,#f7db8d,#E8B84B 60%,#c79426)}.cat-coin-lg.mono span,.cat-mlg.mono span{display:grid}
  .cat-coin-lg.mono img,.cat-mlg.mono img{display:none}
  .cat-tfsel{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 11px;border-radius:9px;background:#0b0e12;border:1px solid #222b35;color:#eaecef;font-family:'IBM Plex Mono',monospace;cursor:pointer;flex:none}
  .cat-tfsel b{font-weight:700;font-size:13px;min-width:24px;text-align:left}.cat-tfsel em{font-style:normal;color:#7c868f;font-size:11px}
  .cat-tfsel:hover{border-color:#C9A84B}
  .cat-tfmenu{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;min-width:172px;padding:7px}
  .cat-tfm-it{display:grid;place-items:center;height:32px;border:1px solid #222b35;border-radius:8px;background:#0b0e12;color:#c4ccd4;font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:12px;cursor:pointer}
  .cat-tfm-it:hover{border-color:#3a424c;color:#fff}
  .cat-tfm-it.on{border-color:#C9A84B;background:#15181f;color:#E8B84B}
  .cat-pxbox{display:flex;flex-direction:column;justify-content:center;line-height:1.1;margin-left:2px;flex:none}
  .cat-px{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:15px}
  .cat-chg{font-family:'IBM Plex Mono',monospace;font-size:11px}.cat-chg.up{color:#2ee86a}.cat-chg.dn{color:#ff5b6e}
  .cat-strat{display:flex;gap:5px;margin-left:8px;flex:none}
  .cat-sx{position:relative;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 8px;border-radius:9px;border:1px solid #222b35;background:#0b0e12;color:#c4ccd4;font-family:'Chakra Petch',system-ui,sans-serif;cursor:pointer}
  .cat-sx i{font-style:normal;font-weight:700;font-size:14px;width:16px;text-align:center}
  .cat-sx b{font-weight:700;font-size:12.5px;white-space:nowrap;padding-right:2px}
  .cat-sx::after{content:"";position:absolute;left:7px;right:7px;bottom:4px;height:2px;border-radius:2px}
  .cat-sx.call::after{background:#2ee86a}.cat-sx.put::after{background:#ff5b6e}
  .cat-sx:hover{border-color:#3a424c}.cat-sx.on{border-color:#C9A84B;background:#15181f;color:#fff}
  .cat-top-r{margin-left:auto;display:flex;gap:7px;flex:none;padding-left:8px}
  .cat-ico{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;cursor:pointer;overflow:hidden}
  .cat-ico svg{width:16px;height:16px}.cat-ico:hover{border-color:#C9A84B;color:#E8B84B}
  .cat-anbtn-ph{width:26px;height:26px;border-radius:50%;overflow:hidden;display:block;flex:none;background:#0b0e12}
  .cat-anbtn-ph img{width:100%;height:100%;object-fit:cover;object-position:center}
  .cat-anbtn.on{border-color:#C9A84B;box-shadow:0 0 0 2px rgba(201,168,75,.2)}
  .cat-stage{flex:1;display:flex;min-height:0}
  .cat-cvwrap{flex:1;position:relative;min-width:0}
  .cat-cv{position:absolute;inset:0}
  .cat-wm{position:absolute;left:60px;bottom:205px;z-index:3;opacity:.7;pointer-events:none}
  .cat-wm img{height:19px;width:auto;filter:drop-shadow(0 2px 8px rgba(0,0,0,.98))}
  .cat-leg{position:absolute;left:60px;top:10px;z-index:4;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#c4ccd4;background:rgba(5,7,10,.72);border:1px solid #1c232c;border-radius:7px;padding:4px 9px;pointer-events:none;opacity:0;transition:opacity .12s}
  .cat-leg.on{opacity:1}.cat-leg b{color:#fff}.cat-leg .u{color:#2ee86a}.cat-leg .d{color:#ff5b6e}
  .cat-osclabel{position:absolute;left:60px;bottom:140px;transform:translateY(-6px);font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#7c868f;background:rgba(5,7,10,.7);padding:2px 7px;border-radius:6px;pointer-events:none;z-index:3}
  .cat-present{position:absolute;right:66px;bottom:160px;width:34px;height:34px;border-radius:50%;border:1px solid #29313b;background:rgba(11,14,18,.9);color:#E8B84B;cursor:pointer;place-items:center;z-index:8}.cat-present svg{width:15px;height:15px}
  .cat-spin{position:absolute;inset:0;display:grid;place-items:center;color:#7c868f;font-family:'IBM Plex Mono',monospace;font-size:12px;background:rgba(5,7,10,.5);pointer-events:none;z-index:7}
  /* tachuela: punto + linea punteada + etiqueta alejada */
  .cat-pin{position:absolute;z-index:6;pointer-events:none;display:flex;flex-direction:column;align-items:center}
  .cat-pin.long{transform:translate(-50%,0)}
  .cat-pin.short{transform:translate(-50%,-100%)}
  .cat-pin-dot{width:9px;height:9px;border-radius:50%;flex:none}
  .cat-pin-line{width:0;height:52px;flex:none}
  .cat-pin.long .cat-pin-dot{background:#2ee86a;box-shadow:0 0 9px rgba(46,232,106,.9)}
  .cat-pin.short .cat-pin-dot{background:#ff5b6e;box-shadow:0 0 9px rgba(255,91,110,.9)}
  .cat-pin.long .cat-pin-line{border-left:2px dotted rgba(46,232,106,.6)}
  .cat-pin.short .cat-pin-line{border-left:2px dotted rgba(255,91,110,.6)}
  .cat-pin-box{position:relative;display:flex;flex-direction:column;align-items:center;padding:5px 13px;border-radius:11px;line-height:1}
  .cat-pin-box b{font-family:'Chakra Petch',system-ui,sans-serif;font-size:12.5px;font-weight:800;letter-spacing:.11em}
  .cat-pin-box span{font-family:'IBM Plex Mono',monospace;font-size:10px;margin-top:3px}
  .cat-pin-tip{position:absolute;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent}
  .cat-pin.long .cat-pin-tip{top:-7px;border-bottom:8px solid #16a34a}
  .cat-pin.long .cat-pin-box{background:linear-gradient(180deg,#2ee86a,#16a34a);color:#fff;box-shadow:0 10px 20px rgba(0,0,0,.6),0 0 16px rgba(46,232,106,.5)}
  .cat-pin.short .cat-pin-tip{bottom:-7px;border-top:8px solid #e11d48}
  .cat-pin.short .cat-pin-box{background:linear-gradient(180deg,#ff5b6e,#e11d48);color:#ffe24a;box-shadow:0 10px 20px rgba(0,0,0,.6),0 0 16px rgba(255,91,110,.5)}
  .cat-an-col{width:330px;flex:none;border-left:1px solid #1a2029;background:#070a0e;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
  @media(max-width:900px){.cat-an-col{width:280px}}
  @media(max-width:680px){.cat-stage{flex-direction:column}.cat-an-col{width:auto;border-left:0;border-top:1px solid #1a2029;max-height:46%}}
  .cat-anc-head{display:flex;align-items:center;gap:10px}
  .cat-anc-ava{width:40px;height:40px;border-radius:50%;object-fit:cover;flex:none;border:2px solid #C9A84B}
  .cat-anc-id{display:flex;flex-direction:column;line-height:1.15}.cat-anc-id b{font-family:'Chakra Petch',system-ui,sans-serif;font-size:15px}.cat-anc-id span{font-size:10.5px;color:#7c868f}
  .cat-anc-lang{margin-left:auto;height:26px;padding:0 10px;border-radius:7px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;cursor:pointer}
  .cat-anc-lang:hover{border-color:#C9A84B;color:#E8B84B}
  .cat-anc-min{width:26px;height:26px;display:grid;place-items:center;border-radius:7px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;cursor:pointer}.cat-anc-min svg{width:13px;height:13px}
  .cat-anc-sub{display:flex;align-items:center;gap:7px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#7c868f}
  .cat-anc-dot{width:7px;height:7px;border-radius:50%;background:#2ee86a;box-shadow:0 0 8px #2ee86a;animation:catpulse 1.6s infinite}
  @keyframes catpulse{0%,100%{opacity:1}50%{opacity:.35}}
  .cat-anc-sub em{font-style:normal;margin-left:auto;color:#a7b0bb}
  .cat-anc-wait{color:#7c868f;font-size:12.5px;padding:10px 0}
  .cat-feed{display:flex;flex-direction:column;gap:9px}
  .cat-msg{border:1px solid #1c232c;border-radius:12px;padding:12px 13px;background:#0a0e13;transition:opacity .3s}
  .cat-msg:not(.top){opacity:.62}
  .cat-msg-h{display:flex;align-items:center;gap:8px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#7c868f;margin-bottom:6px}
  .cat-msg-n{color:#a7b0bb}
  .cat-msg-tg{font-style:normal;font-weight:700;padding:1px 7px;border-radius:5px;letter-spacing:.06em}
  .cat-msg-ts{margin-left:auto}
  .cat-msg-new{font-style:normal;background:rgba(46,232,106,.18);color:#2ee86a;padding:1px 6px;border-radius:5px;letter-spacing:.06em}
  .e-lejos .cat-msg-tg,.e-invalida .cat-msg-tg{background:rgba(124,134,143,.18);color:#9aa4ad}
  .e-vigilar .cat-msg-tg,.e-cerca .cat-msg-tg{background:rgba(232,184,75,.16);color:#E8B84B}
  .e-listo .cat-msg-tg{background:rgba(232,184,75,.26);color:#f7db8d}
  .e-entra .cat-msg-tg{background:rgba(46,232,106,.2);color:#2ee86a}
  .cat-msg-t{font-family:'Chakra Petch',system-ui,sans-serif;font-size:16px;line-height:1.15;color:#fff;margin-bottom:5px}
  .cat-msg-x{font-size:12.8px;line-height:1.5;color:#c4ccd4;margin:0 0 9px}
  .cat-msg-do{position:relative;font-size:12.5px;font-weight:700;color:#eaecef;padding:9px 11px;border-radius:9px;background:rgba(255,255,255,.03);border:1px solid #1c232c;overflow:hidden}
  .cat-msg-do i{position:absolute;left:0;top:0;bottom:0;background:rgba(201,168,75,.12);border-right:2px solid rgba(201,168,75,.4);z-index:0}
  .e-entra .cat-msg-do i{background:rgba(46,232,106,.12);border-right-color:#2ee86a}
  .cat-msg-do b{position:relative;z-index:1;font-weight:700}
  .cat-anc-dis{font-size:10.5px;line-height:1.5;color:#5f6872;margin:2px 0 0}
  .cat-menu{position:fixed;z-index:9550;background:#0b0e12;border:1px solid #2b3139;border-radius:12px;padding:6px;box-shadow:0 20px 60px rgba(0,0,0,.6);min-width:230px;max-height:380px;overflow:auto}
  .cat-menu button{display:flex;align-items:center;gap:9px;width:100%;padding:8px 9px;border:0;border-radius:8px;background:transparent;color:#eaecef;cursor:pointer;text-align:left;font-family:inherit}
  .cat-menu button:hover{background:rgba(255,255,255,.06)}
  .cat-menu b{font-size:13px;font-weight:700}.cat-menu em{font-style:normal;font-size:11px;color:#7c868f;margin-left:auto}
  /* barra de dibujo (Smart Pools / Multichart) montada a la DERECHA */
  #cat-overlay .nv-tools{position:absolute;left:8px;right:auto;top:50%;transform:translateY(-50%);z-index:9;display:flex;flex-direction:column;gap:3px;padding:5px;border-radius:13px;background:rgba(13,17,24,.86);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.08);box-shadow:0 10px 34px rgba(0,0,0,.55);max-height:calc(100% - 20px);overflow-y:auto;scrollbar-width:none}
  #cat-overlay .nv-tools::-webkit-scrollbar{display:none}
  #cat-overlay .nv-tool{position:relative;width:32px;height:32px;flex:0 0 auto;border-radius:9px;border:none;padding:0;background:transparent;color:#98a2ad;cursor:pointer;display:grid;place-items:center;transition:background .14s,color .14s}
  #cat-overlay .nv-tool svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  #cat-overlay .nv-tool:hover{background:rgba(255,255,255,.07);color:#eaecef}
  #cat-overlay .nv-tool.on{background:rgba(232,184,75,.16);color:#E8B84B;box-shadow:inset 0 0 0 1px rgba(232,184,75,.4)}
  #cat-overlay .nv-tool-tg.on{background:rgba(232,184,75,.16);color:#E8B84B;box-shadow:inset 0 0 0 1px rgba(232,184,75,.4)}
  #cat-overlay .nv-tool-sep{height:1px;background:rgba(255,255,255,.1);margin:3px 5px;flex:0 0 auto}
  #cat-overlay .nv-tools.nv-oculta{opacity:1 !important;transform:translateY(-50%) !important;pointer-events:auto !important}
  #cat-overlay .nv-tools-tab{display:none !important}
  /* disclaimer de entrada: MISMO estilo que el de la plataforma (an-disc), re-scopeado a #cat-overlay */
  #cat-overlay .an-modal{position:fixed;inset:0;z-index:9700;display:grid;place-items:center;opacity:0;transition:opacity .18s;padding:20px}
  #cat-overlay .an-modal.on{opacity:1}
  #cat-overlay .an-modal-bg{position:absolute;inset:0;background:rgba(3,5,8,.72);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
  #cat-overlay .an-modal-card{position:relative;z-index:1;width:100%;max-width:600px;max-height:88vh;overflow-y:auto;scrollbar-width:none;background:linear-gradient(180deg,#121820,#0b0e12);border:1px solid #2a333f;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.05);transform:translateY(8px) scale(.98);transition:transform .18s}
  #cat-overlay .an-modal-card::-webkit-scrollbar{display:none}
  #cat-overlay .an-modal.on .an-modal-card{transform:none}
  #cat-overlay .an-disc-card{padding:0}
  #cat-overlay .an-disc-box{display:flow-root;padding:24px 26px 22px;text-align:left}
  #cat-overlay .an-disc-fl{float:right;width:120px;height:120px;margin:2px 0 8px 20px;shape-outside:margin-box;border-radius:14px;filter:drop-shadow(0 8px 18px rgba(0,0,0,.5))}
  #cat-overlay .an-disc-box p{font-size:12.8px;line-height:1.65;color:#c4ccd4;margin:0 0 12px}
  #cat-overlay .an-disc-chk{display:flex;align-items:flex-start;gap:10px;margin:2px 0 14px;cursor:pointer;font-size:12.5px;line-height:1.5;color:#d4dae1}
  #cat-overlay .an-disc-chk input{flex:none;width:18px;height:18px;margin:1px 0 0;accent-color:#E8B84B;cursor:pointer}
  #cat-overlay .an-disc-chk b{color:#e9eef3}
  #cat-overlay .an-pay{display:inline-flex;align-items:center;justify-content:center;height:46px;border-radius:12px;border:1px solid #2a333f;background:linear-gradient(180deg,#1b2027,#0d1117);color:#eaecef;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:13.5px;cursor:pointer;box-shadow:0 3px 0 #060809}
  #cat-overlay .an-pay.gold{border-color:#cf9f2e;background:linear-gradient(180deg,#f4d089,#E8B84B 55%,#cf9f2e);color:#241900;box-shadow:0 3px 0 #8f6a1a}
  #cat-overlay .an-disc-ok{clear:both;width:100%;margin-top:4px}
  #cat-set{position:fixed;inset:0;z-index:9600;display:grid;place-items:center;padding:18px;background:rgba(5,7,10,.72);backdrop-filter:blur(3px)}
  .cat-set-card{position:relative;width:min(400px,100%);background:linear-gradient(180deg,#12161d,#0a0e13);border:1px solid #29313b;border-radius:16px;padding:24px;color:#eaecef}
  .cat-set-x{position:absolute;top:12px;right:14px;width:30px;height:30px;border-radius:8px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;cursor:pointer;display:grid;place-items:center}.cat-set-x svg{width:14px;height:14px}
  .cat-set-card h3{font-family:'Chakra Petch',system-ui,sans-serif;font-size:19px;margin:0 0 8px}
  .cat-set-note{font-size:12.5px;line-height:1.5;color:#c4ccd4;margin:0 0 16px}
  .cat-set-card label{display:block;font-size:12.5px;color:#c4ccd4;margin-bottom:16px}
  .cat-set-card input{width:100%;margin-top:6px;height:44px;border-radius:10px;border:1px solid #29313b;background:#0b0e12;color:#eaecef;padding:0 12px;font-family:inherit;font-size:14px}
  .cat-set-card input:focus{outline:none;border-color:#C9A84B}
  .cat-set-foot{font-size:11px;line-height:1.5;color:#7c868f;margin:14px 0 0}
  .cat-set-go{width:100%;height:46px;border-radius:12px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#241900;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:14px;cursor:pointer}`;
  document.head.appendChild(st);
}
