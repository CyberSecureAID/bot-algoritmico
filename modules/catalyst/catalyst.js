/* catalyst.js — Servicio "Catalyst" de Analisis.
 *
 * Grafico de acciones de EE.UU. (como TC2000) con las 6 estrategias de opciones,
 * seleccionables arriba (1 a 6). Mismo motor y misma dinamica que Multichart
 * (lightweight-charts): cruceta, zoom, scroll, escala de precio a la DERECHA,
 * oscilador en panel propio con su escala y lineas de referencia. El analista
 * Jesus escribe en VIVO como un feed: hasta 4 mensajes apilados, el mas nuevo
 * arriba, numerado y con la hora. No revela la estrategia, da instrucciones.
 */

import { ESTRATEGIAS, porId } from './estrategias.js?v=2';
import { sma, bollinger, worden, tendenciaCruce } from './indicadores.js?v=1';
import { leerCatalyst } from './analista.js?v=1';
import * as D from './datos.js?v=4';

const LIB = new URL('../trading-demo/vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
const AVATAR = new URL('../../assets/img/jesus-avatar.webp', import.meta.url).href;
const $ = (id) => document.getElementById(id);
function lib() { return window.LightweightCharts ? Promise.resolve(window.LightweightCharts) : new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.onload = () => res(window.LightweightCharts); s.onerror = rej; document.head.appendChild(s); }); }

const IC = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  chev: '▾',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  present: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>'
};

const TFS = [{ id: '15m', n: '15m' }, { id: '1h', n: '1H' }, { id: '1D', n: '1D' }];
const S = { tf: '15m', estr: ESTRATEGIAS[0], activo: D.ACTIVOS[0], lang: 'en', anOpen: true, chart: null, serie: null, ind: {}, feed: [], seq: 0, lastKey: '', velas: [] };

export async function abrirCatalyst() {
  if ($('cat-overlay')) return;
  estilos();
  const ov = document.createElement('div'); ov.id = 'cat-overlay';
  ov.innerHTML = `
    <div class="cat-top">
      <button class="cat-back" id="cat-back">${IC.back}Back</button>
      <div class="cat-sep"></div>
      <button class="cat-coin" id="cat-coin"><i class="cat-coin-lg" id="cat-coin-lg"></i><b id="cat-coin-id"></b><span id="cat-coin-nm"></span><em class="cat-chev">${IC.chev}</em></button>
      <div class="cat-tfs" id="cat-tfs"></div>
      <div class="cat-pxbox"><b class="cat-px" id="cat-px">—</b><span class="cat-chg" id="cat-chg"></span></div>
      <div class="cat-strat" id="cat-strat"></div>
      <div class="cat-top-r"><button class="cat-ico" id="cat-gear" title="Alert email">${IC.gear}</button></div>
    </div>
    <div class="cat-stage">
      <div class="cat-cvwrap">
        <div class="cat-cv" id="cat-cv"></div>
        <div class="cat-osclabel" id="cat-osclabel">Worden Stochastics</div>
        <button class="cat-present" id="cat-present" title="Back to the latest price" style="display:none">${IC.present}</button>
        <div class="cat-spin" id="cat-spin">Loading…</div>
        <button class="cat-an-open" id="cat-an-open" title="Open Jesús" style="display:none"><img src="${AVATAR}" alt="Jesús" onerror="this.style.display='none'"></button>
      </div>
      <aside class="cat-an-col" id="cat-an-col"></aside>
    </div>`;
  document.body.appendChild(ov);
  $('cat-back').onclick = cerrar;
  $('cat-gear').onclick = ajustes;
  $('cat-coin').onclick = (e) => { e.stopPropagation(); menuActivos(); };
  $('cat-an-open').onclick = abrirAn;
  $('cat-present').onclick = vistaDefecto;
  pintarCoin(); pintarTfs(); pintarStrat(); pintarAnalista();
  await montarChart();
  await cargar();
  if (!S._timer) S._timer = setInterval(tic, 20000);
}
function cerrar() { try { clearInterval(S._timer); } catch (_) {} S._timer = null; try { S.chart && S.chart.remove(); } catch (_) {} S.chart = null; const ov = $('cat-overlay'); if (ov) ov.remove(); }
function tic() { if (S._fetchAt && Date.now() - S._fetchAt > 150000) cargar(); else { empujarFeed(); pintarAnalista(); } }

/* ───────── top bar ───────── */
function pintarCoin() {
  $('cat-coin-id').textContent = S.activo.s;
  $('cat-coin-nm').textContent = S.activo.n;
  monograma($('cat-coin-lg'), S.activo);
}
function monograma(el, a) { if (el) el.innerHTML = `<img src="${D.logoDe(a)}" alt="" onerror="this.style.display='none';this.parentNode.classList.add('mono')"><span>${a.s.slice(0, 2)}</span>`; }
function pintarTfs() {
  $('cat-tfs').innerHTML = TFS.map((t) => `<button class="cat-tf ${t.id === S.tf ? 'on' : ''}" data-tf="${t.id}">${t.n}</button>`).join('');
  $('cat-tfs').querySelectorAll('.cat-tf').forEach((b) => b.onclick = () => { S.tf = b.getAttribute('data-tf'); pintarTfs(); cargar(); });
}
function pintarStrat() {
  $('cat-strat').innerHTML = ESTRATEGIAS.map((e) => `<button class="cat-sx ${e.lado} ${e.id === S.estr.id ? 'on' : ''}" data-id="${e.id}" title="${e.corto}">${e.n}</button>`).join('');
  $('cat-strat').querySelectorAll('.cat-sx').forEach((b) => b.onclick = () => {
    S.estr = porId(b.getAttribute('data-id'));
    if (S.estr.tfEntrada) { S.tf = S.estr.tfEntrada; pintarTfs(); }
    S.feed = []; S.lastKey = ''; pintarStrat(); cargar();
  });
}

/* ───────── chart (dinamica de Multichart) ───────── */
async function montarChart() {
  const LC = await lib(); S.LC = LC;
  const chart = LC.createChart($('cat-cv'), {
    autoSize: true, localization: { locale: 'en' },
    layout: { background: { type: 'solid', color: '#05070a' }, textColor: '#8b95a1', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, attributionLogo: false },
    grid: { vertLines: { color: 'rgba(255,255,255,.028)' }, horzLines: { color: 'rgba(255,255,255,.028)' } },
    rightPriceScale: { borderColor: '#222b35', scaleMargins: { top: 0.08, bottom: 0.08 } },
    timeScale: { borderColor: '#222b35', timeVisible: S.tf !== '1D', secondsVisible: false, rightOffset: 4, barSpacing: 7, minBarSpacing: 0.5 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  S.chart = chart;
  S.serie = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e', priceLineVisible: true, lastValueVisible: true });
  const linea = (color, w) => chart.addSeries(LC.LineSeries, { color, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  S.ind.ma20 = linea('#E8B84B', 2); S.ind.ma40 = linea('#49b6ff', 2);
  S.ind.ma100 = linea('rgba(122,102,216,.75)', 1); S.ind.ma200 = linea('rgba(255,143,191,.6)', 1);
  S.ind.bbA = linea('rgba(120,150,200,.45)', 1); S.ind.bbM = linea('rgba(120,150,200,.25)', 1); S.ind.bbB = linea('rgba(120,150,200,.45)', 1);
  S.ind.vol = chart.addSeries(LC.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol', lastValueVisible: false });
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
  // Oscilador Worden en su PROPIO panel (como Multichart): escala 0..100, lineas 20/50/80.
  S.ind.wK = chart.addSeries(LC.LineSeries, { color: '#2ee86a', lineWidth: 2, priceLineVisible: false, lastValueVisible: true }, 1);
  S.ind.wS = chart.addSeries(LC.LineSeries, { color: '#ff5b6e', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 1);
  try { S.ind.wK.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) }); } catch (_) {}
  [20, 50, 80].forEach((lv) => { try { S.ind.wK.createPriceLine({ price: lv, color: 'rgba(255,255,255,.18)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true }); } catch (_) {} });
  try { const ps = chart.panes(); if (ps[1]) ps[1].setHeight(150); } catch (_) {}
  // presente: si te alejas del ultimo, aparece el boton de volver
  try { chart.timeScale().subscribeVisibleLogicalRangeChange((r) => { const b = $('cat-present'); if (!b || !r) return; const n = S.velas.length; b.style.display = (r.to < n - 2) ? 'grid' : 'none'; }); } catch (_) {}
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
    if (S.chart) S.chart.timeScale().applyOptions({ timeVisible: S.tf !== '1D' });
    vistaDefecto();
    const t = await D.ticker(S.activo.s).catch(() => null);
    pintarPx(t);
    empujarFeed(); pintarAnalista();
  } catch (_) {}
  if (gen === S.gen && sp) sp.style.display = 'none';
}

function recalc() {
  const v = S.velas; if (!v || !v.length) return;
  const cl = (a) => a.filter((p) => p.value != null);
  S.ind.ma20.setData(cl(sma(v, 20))); S.ind.ma40.setData(cl(sma(v, 40)));
  S.ind.ma100.setData(cl(sma(v, 100))); S.ind.ma200.setData(cl(sma(v, 200)));
  const bb = bollinger(v, 20, 2);
  S.ind.bbA.setData(cl(bb.alta)); S.ind.bbM.setData(cl(bb.media)); S.ind.bbB.setData(cl(bb.baja));
  S.ind.vol.setData(v.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(46,232,106,.26)' : 'rgba(255,91,110,.26)' })));
  const w = worden(v, 14, 3, 3);
  S.ind.wK.setData(cl(w.k)); S.ind.wS.setData(cl(w.señal));
}

function pintarPx(t) {
  const px = t ? t.last : (S.velas.length ? S.velas[S.velas.length - 1].close : 0);
  const chg = t ? t.chgPct : null;
  const pe = $('cat-px'); if (pe) pe.textContent = '$' + Number(px).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ce = $('cat-chg'); if (ce) { if (chg != null) { ce.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'; ce.className = 'cat-chg ' + (chg >= 0 ? 'up' : 'dn'); } else ce.textContent = ''; }
}

/* ───────── analista: feed en vivo ───────── */
function hhmm() { const d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
function empujarFeed() {
  const e = S.estr; e._sym = S.activo.s;
  const m = leerCatalyst(S.velas, e, S.seq);
  if (!m) return;
  const key = e.id + ':' + m.escena;             // un mensaje nuevo solo cuando CAMBIA la escena
  if (key === S.lastKey && S.feed.length) return;
  S.lastKey = key; S.seq++;
  S.feed.unshift({ seq: S.seq, ts: hhmm(), ...m });
  S.feed = S.feed.slice(0, 4);                    // hasta 4, el mas nuevo arriba
}
function abrirAn() { S.anOpen = true; pintarAnalista(); resize(); }
function resize() { try { S.chart && S.chart.resize && S.chart.resize($('cat-cv').clientWidth, $('cat-cv').clientHeight); } catch (_) {} }

function pintarAnalista() {
  const col = $('cat-an-col'), ob = $('cat-an-open');
  if (ob) ob.style.display = S.anOpen ? 'none' : 'flex';
  if (!col) return;
  if (!S.anOpen) { col.style.display = 'none'; setTimeout(resize, 30); return; }
  col.style.display = 'flex';
  const lang = S.lang, e = S.estr;
  const dis = lang === 'es' ? 'Esto no es asesoría financiera. Operar conlleva riesgo y puedes perder tu capital. La decisión es tuya.' : 'This is not financial advice. Trading carries risk and you can lose your capital. The decision is yours.';
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
      <div class="cat-anc-id"><b>Jesús</b><span>${lang === 'es' ? 'No es consejo financiero' : 'Not financial advice'}</span></div>
      <button class="cat-anc-lang" id="cat-anc-lang">${lang === 'en' ? 'ES' : 'EN'}</button>
      <button class="cat-anc-min" id="cat-anc-min" title="${lang === 'es' ? 'Ocultar' : 'Hide'}">${IC.close}</button>
    </div>
    <div class="cat-anc-sub"><i class="cat-anc-dot"></i><span>${lang === 'es' ? 'EN VIVO' : 'LIVE'}</span><em>${esc(e.corto)} · ${e.lado === 'call' ? 'CALL' : 'PUT'}</em></div>
    <div class="cat-feed">${cards || `<div class="cat-anc-wait">${lang === 'es' ? 'Leyendo el precio…' : 'Reading the tape…'}</div>`}</div>
    <p class="cat-anc-dis">${dis}</p>`;
  const lb = $('cat-anc-lang'); if (lb) lb.onclick = () => { S.lang = S.lang === 'en' ? 'es' : 'en'; pintarAnalista(); };
  const mb = $('cat-anc-min'); if (mb) mb.onclick = () => { S.anOpen = false; pintarAnalista(); resize(); };
}

/* ───────── menu de acciones ───────── */
function cerrarMenus() { document.querySelectorAll('.cat-menu').forEach((m) => m.remove()); }
function menuActivos() {
  if (document.querySelector('.cat-menu')) { cerrarMenus(); return; }
  const m = document.createElement('div'); m.className = 'cat-menu';
  m.innerHTML = D.ACTIVOS.map((a) => `<button data-s="${a.s}"><i class="cat-mlg"><img src="${D.logoDe(a)}" alt="" onerror="this.style.display='none';this.parentNode.classList.add('mono')"><span>${a.s.slice(0, 2)}</span></i><b>${a.s}</b><em>${a.n}</em></button>`).join('');
  document.body.appendChild(m);
  const r = $('cat-coin').getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = (r.bottom + 6) + 'px';
  m.querySelectorAll('button').forEach((b) => b.onclick = () => { S.activo = D.ACTIVOS.find((a) => a.s === b.getAttribute('data-s')) || D.ACTIVOS[0]; S.feed = []; S.lastKey = ''; pintarCoin(); cerrarMenus(); cargar(); });
  setTimeout(() => document.addEventListener('click', function cl(ev) { if (!m.contains(ev.target) && ev.target.id !== 'cat-coin') { cerrarMenus(); document.removeEventListener('click', cl); } }), 0);
}

/* ───────── ajustes (correo de alerta, claro) ───────── */
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
  .cat-coin-lg,.cat-mlg{position:relative;width:20px;height:20px;border-radius:5px;overflow:hidden;background:#fff;display:grid;place-items:center;flex:none}
  .cat-coin-lg img,.cat-mlg img{width:100%;height:100%;object-fit:contain}
  .cat-coin-lg span,.cat-mlg span{position:absolute;inset:0;display:none;place-items:center;font-size:9px;font-weight:800;color:#0b0e12;font-family:'IBM Plex Mono',monospace}
  .cat-coin-lg.mono,.cat-mlg.mono{background:linear-gradient(160deg,#f7db8d,#E8B84B 60%,#c79426)}.cat-coin-lg.mono span,.cat-mlg.mono span{display:grid}
  .cat-tfs{display:flex;gap:3px;background:#0b0e12;border:1px solid #222b35;border-radius:9px;padding:3px;flex:none}
  .cat-tf{height:28px;min-width:38px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:#a7b0bb;font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:12px;cursor:pointer}
  .cat-tf.on{color:#241900;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426)}
  .cat-pxbox{display:flex;flex-direction:column;justify-content:center;line-height:1.1;margin-left:2px;flex:none}
  .cat-px{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:15px}
  .cat-chg{font-family:'IBM Plex Mono',monospace;font-size:11px}.cat-chg.up{color:#2ee86a}.cat-chg.dn{color:#ff5b6e}
  .cat-strat{display:flex;gap:5px;margin-left:8px;flex:none}
  .cat-sx{position:relative;width:34px;height:34px;border-radius:9px;border:1px solid #222b35;background:#0b0e12;color:#c4ccd4;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:14px;cursor:pointer}
  .cat-sx::after{content:"";position:absolute;left:7px;right:7px;bottom:5px;height:2px;border-radius:2px}
  .cat-sx.call::after{background:#2ee86a}.cat-sx.put::after{background:#ff5b6e}
  .cat-sx:hover{border-color:#3a424c}.cat-sx.on{border-color:#C9A84B;background:#15181f;color:#fff}
  .cat-top-r{margin-left:auto;display:flex;gap:7px;flex:none;padding-left:8px}
  .cat-ico{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;cursor:pointer}
  .cat-ico svg{width:16px;height:16px}.cat-ico:hover{border-color:#C9A84B;color:#E8B84B}
  .cat-stage{flex:1;display:flex;min-height:0}
  .cat-cvwrap{flex:1;position:relative;min-width:0}
  .cat-cv{position:absolute;inset:0}
  .cat-osclabel{position:absolute;left:10px;bottom:150px;transform:translateY(-6px);font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#7c868f;background:rgba(5,7,10,.7);padding:2px 7px;border-radius:6px;pointer-events:none;z-index:3}
  .cat-present{position:absolute;right:76px;bottom:170px;width:34px;height:34px;border-radius:50%;border:1px solid #29313b;background:rgba(11,14,18,.9);color:#E8B84B;cursor:pointer;place-items:center;z-index:4}.cat-present svg{width:15px;height:15px}
  .cat-spin{position:absolute;inset:0;display:grid;place-items:center;color:#7c868f;font-family:'IBM Plex Mono',monospace;font-size:12px;background:rgba(5,7,10,.5);pointer-events:none}
  .cat-an-open{position:absolute;top:14px;right:14px;width:48px;height:48px;border-radius:50%;border:2px solid #C9A84B;background:#0b0e12;cursor:pointer;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.5),0 0 0 4px rgba(201,168,75,.12);z-index:5}
  .cat-an-open img{width:100%;height:100%;object-fit:cover}
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
