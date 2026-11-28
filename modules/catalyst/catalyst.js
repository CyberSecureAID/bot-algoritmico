/* catalyst.js — Servicio "Catalyst" de Análisis.
 *
 * Un solo gráfico que carga las 6 estrategias de opciones (put/call) de a una.
 * Datos de ACCIONES de EE.UU. (como TC2000) vía datos.js. Mismo motor de velas
 * que el resto de la plataforma (lightweight-charts) para que las velas fluyan
 * igual de bien. Indicadores: medias 20/40/100/200, Bollinger y Worden Stochastics.
 *
 * Abre como overlay dentro de la página de Análisis; Back vuelve al catálogo.
 * Alertas por correo (Web3Forms) cuando una entrada está cerca: ver alertas.js.
 */

import { ESTRATEGIAS, porId } from './estrategias.js?v=1';
import { sma, bollinger, worden, tendenciaCruce } from './indicadores.js?v=1';
import * as D from './datos.js?v=1';

const LIB = new URL('../trading-demo/vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
const $ = (id) => document.getElementById(id);
function lib() { return window.LightweightCharts ? Promise.resolve(window.LightweightCharts) : new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.onload = () => res(window.LightweightCharts); s.onerror = rej; document.head.appendChild(s); }); }

const IC = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
};

const S = { tf: '1h', estr: ESTRATEGIAS[0], activo: D.ACTIVOS[0], chart: null, serie: null, ind: {}, demo: true };

/* ───────────────────────── abrir / cerrar ───────────────────────── */
export async function abrirCatalyst() {
  if ($('cat-overlay')) return;
  estilos();
  const ov = document.createElement('div'); ov.id = 'cat-overlay';
  ov.innerHTML = `
    <div class="cat-top">
      <button class="cat-back" id="cat-back">${IC.back} Back</button>
      <button class="cat-sym" id="cat-sym"><img id="cat-sym-logo" alt="" onerror="this.style.visibility='hidden'"><b id="cat-sym-t">${S.activo.s}</b>${IC.chev}</button>
      <div class="cat-tfs" id="cat-tfs"></div>
      <div class="cat-top-r">
        <span class="cat-badge" id="cat-badge"></span>
        <button class="cat-gear" id="cat-gear" title="Data & alert keys">${IC.gear}</button>
        <button class="cat-alert" id="cat-alert">${IC.bell}<span>Alerts</span></button>
      </div>
    </div>
    <div class="cat-main">
      <div class="cat-chartwrap"><div class="cat-cv" id="cat-cv"></div><div class="cat-spin" id="cat-spin">Loading…</div></div>
      <aside class="cat-side" id="cat-side"></aside>
    </div>
    <div class="cat-strip" id="cat-strip"></div>`;
  document.body.appendChild(ov);
  $('cat-back').onclick = cerrar;
  $('cat-alert').onclick = abrirAlertas;
  $('cat-gear').onclick = ajustes;
  $('cat-sym').onclick = menuActivos;
  pintarTfs(); pintarStrip(); pintarSide();
  await montarChart();
  await cargar();
}
function cerrar() { try { S.chart && S.chart.remove(); } catch (_) {} S.chart = null; const ov = $('cat-overlay'); if (ov) ov.remove(); }

/* ───────────────────────── barra de temporalidades ───────────────────────── */
function pintarTfs() {
  const tfs = [['1D', 'Day'], ['1h', '1 hour'], ['15m', '15 min']];
  $('cat-tfs').innerHTML = tfs.map(([k, l]) => `<button class="cat-tf ${k === S.tf ? 'on' : ''}" data-tf="${k}">${l}</button>`).join('');
  $('cat-tfs').querySelectorAll('.cat-tf').forEach((b) => b.onclick = () => { S.tf = b.getAttribute('data-tf'); pintarTfs(); cargar(); });
}

/* ───────────────────────── tira de estrategias (abajo) ───────────────────────── */
function pintarStrip() {
  $('cat-strip').innerHTML = ESTRATEGIAS.map((e) => {
    const on = e.id === S.estr.id;
    return `<button class="cat-sb ${on ? 'on' : ''} ${e.lado}" data-id="${e.id}">
      <i class="cat-sbn">${e.n}</i><span><b>${e.nombre}</b><em>${e.lado === 'call' ? 'CALL' : 'PUT'}</em></span></button>`;
  }).join('');
  $('cat-strip').querySelectorAll('.cat-sb').forEach((b) => b.onclick = () => {
    S.estr = porId(b.getAttribute('data-id'));
    if (S.estr.tfEntrada) S.tf = S.estr.tfEntrada;
    pintarStrip(); pintarTfs(); pintarSide(); cargar();
  });
}

/* ───────────────────────── panel de la estrategia (derecha) ───────────────────────── */
function pintarSide() {
  const e = S.estr;
  $('cat-side').innerHTML = `
    <div class="cat-s-head ${e.lado}">
      <span class="cat-s-tag">${e.lado === 'call' ? 'CALL · al alza' : 'PUT · a la baja'}</span>
      <h3>${e.nombre}</h3>
      <p class="cat-s-base">${e.base}</p>
    </div>
    <p class="cat-s-res">${e.resumen}</p>
    ${e.revisar ? `<div class="cat-s-warn">⚠ Reconstruida como espejo de la versión a la baja. Falta la diapositiva original para confirmarla.</div>` : ''}
    <div class="cat-s-steps">
      ${e.pasos.map((p, i) => `<div class="cat-step"><i>${i + 1}</i><span>${p.t}</span></div>`).join('')}
    </div>
    <button class="cat-s-alert" id="cat-s-alert">${IC.bell} Avísame cuando esté cerca</button>`;
  $('cat-s-alert').onclick = abrirAlertas;
}

/* ───────────────────────── gráfico ───────────────────────── */
async function montarChart() {
  const LC = await lib(); S.LC = LC;
  const mount = $('cat-cv');
  const chart = LC.createChart(mount, {
    autoSize: true, localization: { locale: 'en' },
    layout: { background: { type: 'solid', color: '#05070a' }, textColor: '#8b95a1', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, attributionLogo: false },
    grid: { vertLines: { color: 'rgba(255,255,255,.028)' }, horzLines: { color: 'rgba(255,255,255,.028)' } },
    rightPriceScale: { borderColor: '#222b35', scaleMargins: { top: 0.08, bottom: 0.22 } },
    timeScale: { borderColor: '#222b35', timeVisible: S.tf !== '1D', secondsVisible: false, rightOffset: 5, barSpacing: 7 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  S.chart = chart;
  S.serie = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e' });
  // Medias (corto: 20/40 — largo: 100/200)
  const linea = (color, w) => chart.addSeries(LC.LineSeries, { color, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  S.ind.ma20 = linea('#E8B84B', 2); S.ind.ma40 = linea('#C9A84B', 1);
  S.ind.ma100 = linea('#4D97E8', 1); S.ind.ma200 = linea('#7a66d8', 1);
  // Bollinger
  S.ind.bbA = linea('rgba(120,150,200,.55)', 1); S.ind.bbM = linea('rgba(120,150,200,.35)', 1); S.ind.bbB = linea('rgba(120,150,200,.55)', 1);
  // Volumen (histograma, panel propio pequeño)
  S.ind.vol = chart.addSeries(LC.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
  // Worden Stochastics en panel aparte
  try {
    S.ind.wK = chart.addSeries(LC.LineSeries, { color: '#2ee86a', lineWidth: 2, priceScaleId: 'w', lastValueVisible: false }, 1);
    S.ind.wS = chart.addSeries(LC.LineSeries, { color: '#ff5b6e', lineWidth: 2, priceScaleId: 'w', lastValueVisible: false }, 1);
  } catch (_) {
    S.ind.wK = chart.addSeries(LC.LineSeries, { color: '#2ee86a', lineWidth: 2, priceScaleId: 'w' });
    S.ind.wS = chart.addSeries(LC.LineSeries, { color: '#ff5b6e', lineWidth: 2, priceScaleId: 'w' });
  }
}

async function cargar() {
  const sp = $('cat-spin'); if (sp) sp.style.display = 'grid';
  const gen = (S.gen = (S.gen || 0) + 1);
  try {
    const { velas, demo } = await D.velas(S.activo.s, S.tf, 500);
    if (gen !== S.gen) return;
    S.velas = velas; S.demo = demo;
    S.serie.setData(velas.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    recalc();
    const t = await D.ticker(S.activo.s).catch(() => null);
    pintarBadge(t);
    if (S.chart) S.chart.timeScale().applyOptions({ timeVisible: S.tf !== '1D' });
    if (S.chart) S.chart.timeScale().fitContent();
  } catch (_) {}
  if (gen === S.gen && sp) sp.style.display = 'none';
}

function recalc() {
  const v = S.velas; if (!v || !v.length) return;
  const clean = (arr) => arr.filter((p) => p.value != null);
  S.ind.ma20.setData(clean(sma(v, 20))); S.ind.ma40.setData(clean(sma(v, 40)));
  S.ind.ma100.setData(clean(sma(v, 100))); S.ind.ma200.setData(clean(sma(v, 200)));
  const bb = bollinger(v, 20, 2);
  S.ind.bbA.setData(clean(bb.alta)); S.ind.bbM.setData(clean(bb.media)); S.ind.bbB.setData(clean(bb.baja));
  S.ind.vol.setData(v.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(46,232,106,.28)' : 'rgba(255,91,110,.28)' })));
  const w = worden(v, 14, 3, 3);
  S.ind.wK.setData(clean(w.k)); S.ind.wS.setData(clean(w.señal));
}

function pintarBadge(t) {
  const b = $('cat-badge'); if (!b) return;
  const corto = tendenciaCruce(S.velas, 20, 40), largo = tendenciaCruce(S.velas, 100, 200);
  const px = t ? t.last : (S.velas.length ? S.velas[S.velas.length - 1].close : 0);
  b.innerHTML = `${S.demo ? '<i class="cat-demo">demo</i>' : ''}<em>$${px.toFixed(2)}</em>
    <span class="cat-tr ${corto}">20/40 ${corto}</span><span class="cat-tr ${largo}">100/200 ${largo}</span>`;
}

/* ───────────────────────── menú de activos ───────────────────────── */
function menuActivos() {
  const prev = $('cat-menu'); if (prev) { prev.remove(); return; }
  const m = document.createElement('div'); m.id = 'cat-menu';
  m.innerHTML = D.ACTIVOS.map((a) => `<button data-s="${a.s}"><img src="${D.logoDe(a)}" alt="" onerror="this.style.visibility='hidden'"><b>${a.s}</b><span>${a.n}</span></button>`).join('');
  $('cat-sym').parentNode.appendChild(m);
  m.querySelectorAll('button').forEach((b) => b.onclick = () => {
    S.activo = D.ACTIVOS.find((a) => a.s === b.getAttribute('data-s')) || D.ACTIVOS[0];
    $('cat-sym-t').textContent = S.activo.s; $('cat-sym-logo').src = D.logoDe(S.activo);
    m.remove(); cargar();
  });
  setTimeout(() => document.addEventListener('click', function cl(e) { if (!m.contains(e.target) && e.target.id !== 'cat-sym') { m.remove(); document.removeEventListener('click', cl); } }), 0);
}

/* ───────────────────────── alertas (Web3Forms) ───────────────────────── */
function abrirAlertas() { import('./alertas.js?v=1').then((A) => A.abrirAlertas(S)).catch((e) => console.warn('[catalyst] alertas:', e)); }

/* ───────────────────────── ajustes (claves de datos y de alertas) ───────────────────────── */
function ajustes() {
  if ($('cat-set')) return;
  const g = (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
  const b = document.createElement('div'); b.id = 'cat-set';
  b.innerHTML = `
    <div class="cat-set-card" role="dialog" aria-modal="true">
      <button class="cat-set-x" id="cat-set-x" aria-label="Close">×</button>
      <h3>Connect your data</h3>
      <label>Twelve Data API key <span>— stock prices (free at twelvedata.com)</span>
        <input id="cat-set-td" value="${g('catalyst_td_key').replace(/"/g, '&quot;')}" placeholder="paste your key"></label>
      <label>Web3Forms access key <span>— email alerts (free at web3forms.com)</span>
        <input id="cat-set-w3" value="${g('catalyst_w3f_key').replace(/"/g, '&quot;')}" placeholder="paste your key"></label>
      <button class="cat-set-go" id="cat-set-go">Save</button>
      <p class="cat-set-note">Las claves se guardan solo en este navegador. Sin la de Twelve Data, el gráfico usa datos demo.</p>
    </div>`;
  document.body.appendChild(b);
  const cerrarS = () => b.remove();
  $('cat-set-x').onclick = cerrarS;
  b.addEventListener('click', (e) => { if (e.target === b) cerrarS(); });
  $('cat-set-go').onclick = () => {
    D.setKey($('cat-set-td').value);
    try { localStorage.setItem('catalyst_w3f_key', $('cat-set-w3').value.trim()); } catch (_) {}
    cerrarS(); cargar();
  };
}

/* set logo inicial */
setTimeout(() => { const l = $('cat-sym-logo'); if (l) l.src = D.logoDe(S.activo); }, 50);

/* ───────────────────────── estilos ───────────────────────── */
let _css = false;
function estilos() {
  if (_css) return; _css = true;
  const st = document.createElement('style'); st.id = 'cat-css';
  st.textContent = `
  #cat-overlay{position:fixed;inset:0;z-index:9400;background:#05070a;color:#eaecef;display:flex;flex-direction:column;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
  #cat-overlay *{box-sizing:border-box}
  .cat-top{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #1a2029;background:#070a0e;flex:none}
  .cat-back{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px 0 9px;border-radius:9px;font-family:inherit;font-size:13px;font-weight:600;color:#a7b0bb;background:rgba(255,255,255,.05);border:1px solid #29313b;cursor:pointer}
  .cat-back svg{width:13px;height:13px}.cat-back:hover{border-color:#C9A84B;color:#E8B84B}
  .cat-sym{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 10px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #29313b;color:#eaecef;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;position:relative}
  .cat-sym img{width:18px;height:18px;border-radius:4px;object-fit:contain;background:#fff}.cat-sym svg{width:13px;height:13px;color:#7c868f}
  .cat-tfs{display:flex;gap:4px;background:#0b0e12;border:1px solid #222b35;border-radius:10px;padding:4px}
  .cat-tf{min-height:28px;padding:5px 11px;border:0;border-radius:7px;background:transparent;color:#a7b0bb;font-family:inherit;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}
  .cat-tf.on{color:#241900;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426)}
  .cat-top-r{margin-left:auto;display:flex;align-items:center;gap:10px}
  .cat-badge{display:flex;align-items:center;gap:7px;font-family:'IBM Plex Mono',monospace;font-size:12px}
  .cat-badge em{color:#eaecef;font-style:normal;font-weight:600;font-size:14px}
  .cat-demo{background:#5c4a1e;color:#f7db8d;border-radius:5px;padding:2px 6px;font-size:10px;font-style:normal;letter-spacing:.05em}
  .cat-tr{font-size:10.5px;padding:2px 7px;border-radius:6px;border:1px solid #29313b}
  .cat-tr.alcista{color:#2ee86a;border-color:rgba(46,232,106,.4)}.cat-tr.bajista{color:#ff5b6e;border-color:rgba(255,91,110,.4)}.cat-tr.plana{color:#7c868f}
  .cat-alert{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px;border-radius:9px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#241900;font-family:inherit;font-weight:700;font-size:12.5px;cursor:pointer}
  .cat-alert svg{width:15px;height:15px}
  .cat-gear{width:36px;height:36px;display:grid;place-items:center;border-radius:9px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;cursor:pointer}
  .cat-gear svg{width:16px;height:16px}.cat-gear:hover{border-color:#C9A84B;color:#E8B84B}
  #cat-set{position:fixed;inset:0;z-index:9600;display:grid;place-items:center;padding:18px;background:rgba(5,7,10,.72);backdrop-filter:blur(3px)}
  .cat-set-card{position:relative;width:min(400px,100%);background:linear-gradient(180deg,#12161d,#0a0e13);border:1px solid #29313b;border-radius:16px;padding:24px;color:#eaecef}
  .cat-set-x{position:absolute;top:12px;right:14px;width:30px;height:30px;border-radius:8px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;font-size:18px;cursor:pointer}
  .cat-set-card h3{font-family:'Chakra Petch',system-ui,sans-serif;font-size:19px;margin:0 0 16px}
  .cat-set-card label{display:block;font-size:12.5px;color:#c4ccd4;margin-bottom:14px}
  .cat-set-card label span{color:#7c868f;font-size:11px}
  .cat-set-card input{width:100%;margin-top:6px;height:42px;border-radius:10px;border:1px solid #29313b;background:#0b0e12;color:#eaecef;padding:0 12px;font-family:'IBM Plex Mono',monospace;font-size:12.5px}
  .cat-set-card input:focus{outline:none;border-color:#C9A84B}
  .cat-set-go{width:100%;height:46px;border-radius:12px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#241900;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:14px;cursor:pointer}
  .cat-set-note{font-size:11px;line-height:1.5;color:#7c868f;margin:12px 0 0}
  .cat-main{flex:1;display:flex;min-height:0}
  .cat-chartwrap{flex:1;position:relative;min-width:0}
  .cat-cv{position:absolute;inset:0}
  .cat-spin{position:absolute;inset:0;display:grid;place-items:center;color:#7c868f;font-family:'IBM Plex Mono',monospace;font-size:12px;background:rgba(5,7,10,.6);pointer-events:none}
  .cat-side{width:340px;flex:none;border-left:1px solid #1a2029;background:#070a0e;overflow:auto;padding:18px}
  @media(max-width:860px){.cat-side{width:280px}}
  @media(max-width:680px){.cat-main{flex-direction:column}.cat-side{width:auto;border-left:0;border-top:1px solid #1a2029;max-height:42%}}
  .cat-s-head{border-left:3px solid #29313b;padding-left:12px;margin-bottom:13px}
  .cat-s-head.call{border-color:#2ee86a}.cat-s-head.put{border-color:#ff5b6e}
  .cat-s-tag{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase}
  .cat-s-head.call .cat-s-tag{color:#2ee86a}.cat-s-head.put .cat-s-tag{color:#ff5b6e}
  .cat-s-head h3{font-family:'Chakra Petch',system-ui,sans-serif;font-size:19px;margin:4px 0 2px;line-height:1.1}
  .cat-s-base{font-size:11.5px;color:#7c868f;margin:0;font-family:'IBM Plex Mono',monospace}
  .cat-s-res{font-size:13px;line-height:1.5;color:#c4ccd4;margin:0 0 14px}
  .cat-s-warn{font-size:11.5px;line-height:1.45;color:#f7db8d;background:rgba(92,74,30,.3);border:1px solid #5c4a1e;border-radius:9px;padding:9px 11px;margin-bottom:14px}
  .cat-s-steps{display:flex;flex-direction:column;gap:9px;margin-bottom:16px}
  .cat-step{display:flex;gap:10px;align-items:flex-start}
  .cat-step i{flex:none;width:22px;height:22px;border-radius:7px;background:rgba(232,184,75,.12);border:1px solid rgba(232,184,75,.35);color:#E8B84B;font-family:'IBM Plex Mono',monospace;font-style:normal;font-size:11px;font-weight:600;display:grid;place-items:center}
  .cat-step span{font-size:12.5px;line-height:1.5;color:#c4ccd4}
  .cat-s-alert{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:11px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#E8B84B;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
  .cat-s-alert svg{width:15px;height:15px}.cat-s-alert:hover{border-color:#C9A84B}
  .cat-strip{flex:none;display:flex;gap:8px;padding:10px 14px;border-top:1px solid #1a2029;background:#070a0e;overflow-x:auto;scrollbar-width:thin}
  .cat-sb{flex:0 0 auto;display:flex;align-items:center;gap:9px;padding:8px 13px 8px 9px;border-radius:11px;border:1px solid #222b35;background:#0b0e12;color:#c4ccd4;cursor:pointer;text-align:left}
  .cat-sb:hover{border-color:#3a424c}
  .cat-sbn{flex:none;width:24px;height:24px;border-radius:7px;background:#161b22;color:#7c868f;font-family:'IBM Plex Mono',monospace;font-style:normal;font-weight:600;font-size:12px;display:grid;place-items:center}
  .cat-sb span{display:flex;flex-direction:column;line-height:1.15}
  .cat-sb b{font-family:'Chakra Petch',system-ui,sans-serif;font-size:12.5px;white-space:nowrap}
  .cat-sb em{font-style:normal;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.1em}
  .cat-sb.call em{color:#2ee86a}.cat-sb.put em{color:#ff5b6e}
  .cat-sb.on{border-color:#C9A84B;background:#12161d}.cat-sb.on .cat-sbn{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#241900}
  #cat-menu{position:absolute;top:44px;left:0;z-index:9500;width:230px;max-height:340px;overflow:auto;background:#0b0e12;border:1px solid #2b3139;border-radius:12px;padding:6px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
  #cat-menu button{display:flex;align-items:center;gap:9px;width:100%;padding:8px 9px;border:0;border-radius:8px;background:transparent;color:#eaecef;cursor:pointer;text-align:left;font-family:inherit}
  #cat-menu button:hover{background:rgba(255,255,255,.05)}
  #cat-menu img{width:20px;height:20px;border-radius:5px;object-fit:contain;background:#fff;flex:none}
  #cat-menu b{font-size:13px;font-weight:700}#cat-menu span{font-size:11px;color:#7c868f;margin-left:auto}`;
  document.head.appendChild(st);
}
