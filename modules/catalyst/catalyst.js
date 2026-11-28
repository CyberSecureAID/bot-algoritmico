/* catalyst.js — Servicio "Catalyst" de Analisis.
 *
 * Un solo grafico sobre acciones de EE.UU. (como TC2000) con las 6 estrategias de
 * opciones del colega, seleccionables por los 6 botones de arriba. El analista
 * Jesus (columna derecha, plegable, EN por defecto con boton ES) le dice al
 * usuario que hacer SIN revelar la estrategia (es secreta y de pago). Mismo motor
 * de velas que el resto de Analisis (lightweight-charts), precio a la izquierda,
 * indicadores reales: medias 20/40/100/200, Bollinger y Worden Stochastics.
 */

import { ESTRATEGIAS, porId } from './estrategias.js?v=1';
import { sma, bollinger, worden, tendenciaCruce } from './indicadores.js?v=1';
import { leerCatalyst } from './analista.js?v=1';
import * as D from './datos.js?v=2';

const LIB = new URL('../trading-demo/vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
const AVATAR = new URL('../../assets/img/jesus-avatar.webp', import.meta.url).href;
const $ = (id) => document.getElementById(id);
function lib() { return window.LightweightCharts ? Promise.resolve(window.LightweightCharts) : new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.onload = () => res(window.LightweightCharts); s.onerror = rej; document.head.appendChild(s); }); }

const IC = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  chev: '▾',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

const TFS = [{ id: '1D', n: 'Day' }, { id: '1h', n: '1 hour' }, { id: '15m', n: '15 min' }];
const S = { tf: '1h', estr: ESTRATEGIAS[0], activo: D.ACTIVOS[0], lang: 'en', anOpen: true, chart: null, serie: null, ind: {}, rot: 0, velas: [] };

/* ───────────── abrir / cerrar ───────────── */
export async function abrirCatalyst() {
  if ($('cat-overlay')) return;
  estilos();
  const ov = document.createElement('div'); ov.id = 'cat-overlay';
  ov.innerHTML = `
    <div class="cat-top">
      <button class="cat-back" id="cat-back">${IC.back}Back</button>
      <div class="cat-sep"></div>
      <button class="cat-coin" id="cat-coin"><i class="cat-coin-lg" id="cat-coin-lg"></i><b id="cat-coin-id"></b><span id="cat-coin-nm"></span><em class="cat-chev">${IC.chev}</em></button>
      <button class="cat-chip" id="cat-tf"></button>
      <div class="cat-pxbox"><b class="cat-px" id="cat-px">—</b><span class="cat-chg" id="cat-chg"></span></div>
      <div class="cat-strat" id="cat-strat"></div>
      <div class="cat-top-r">
        <button class="cat-ico" id="cat-gear" title="Data & alert keys">${IC.gear}</button>
      </div>
    </div>
    <div class="cat-stage">
      <div class="cat-cvwrap">
        <div class="cat-cv" id="cat-cv"></div>
        <div class="cat-spin" id="cat-spin">Loading…</div>
        <button class="cat-an-open" id="cat-an-open" title="Open Jesús" style="display:none"><img src="${AVATAR}" alt="Jesús" onerror="this.style.display='none'"></button>
      </div>
      <aside class="cat-an-col" id="cat-an-col"></aside>
    </div>`;
  document.body.appendChild(ov);
  $('cat-back').onclick = cerrar;
  $('cat-gear').onclick = ajustes;
  $('cat-coin').onclick = (e) => { e.stopPropagation(); menuActivos(); };
  $('cat-tf').onclick = (e) => { e.stopPropagation(); menuTF(); };
  $('cat-an-open').onclick = () => { S.anOpen = true; pintarAnalista(); sync(); };
  pintarCoin(); pintarTf(); pintarStrat();
  await montarChart();
  await cargar();
  if (!S._timer) S._timer = setInterval(tic, 22000);
}
function cerrar() { try { clearInterval(S._timer); } catch (_) {} S._timer = null; try { S.chart && S.chart.remove(); } catch (_) {} S.chart = null; const ov = $('cat-overlay'); if (ov) ov.remove(); }

/* refresco suave: rota la frase del analista; cada ~3 min la caché deja refetch */
function tic() { S.rot++; if (S._fetchAt && Date.now() - S._fetchAt > 170000) cargar(); else { recalcAnalista(); pintarAnalista(); } }

/* ───────────── top bar ───────────── */
function pintarCoin() {
  $('cat-coin-id').textContent = S.activo.s;
  $('cat-coin-nm').textContent = S.activo.n;
  const lg = $('cat-coin-lg'); monograma(lg, S.activo);
}
function monograma(el, a) {
  if (!el) return;
  el.innerHTML = `<img src="${D.logoDe(a)}" alt="" onerror="this.style.display='none';this.parentNode.classList.add('mono')"><span>${a.s.slice(0, 2)}</span>`;
}
function pintarTf() { const c = $('cat-tf'); if (c) c.innerHTML = `${(TFS.find((t) => t.id === S.tf) || {}).n || S.tf} <em class="cat-chev">${IC.chev}</em>`; }
function pintarStrat() {
  $('cat-strat').innerHTML = ESTRATEGIAS.map((e) => `<button class="cat-sx ${e.lado} ${e.id === S.estr.id ? 'on' : ''}" data-id="${e.id}" title="Setup ${e.n}">${e.n}</button>`).join('');
  $('cat-strat').querySelectorAll('.cat-sx').forEach((b) => b.onclick = () => {
    S.estr = porId(b.getAttribute('data-id'));
    if (S.estr.tfEntrada) S.tf = S.estr.tfEntrada;
    pintarStrat(); pintarTf(); S.rot++; cargar();
  });
}

/* ───────────── chart ───────────── */
async function montarChart() {
  const LC = await lib(); S.LC = LC;
  const chart = LC.createChart($('cat-cv'), {
    autoSize: true, localization: { locale: 'en' },
    layout: { background: { type: 'solid', color: '#05070a' }, textColor: '#8b95a1', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, attributionLogo: false },
    grid: { vertLines: { color: 'rgba(255,255,255,.028)' }, horzLines: { color: 'rgba(255,255,255,.028)' } },
    leftPriceScale: { visible: true, borderColor: '#222b35', scaleMargins: { top: 0.08, bottom: 0.22 } },
    rightPriceScale: { visible: false },
    timeScale: { borderColor: '#222b35', timeVisible: S.tf !== '1D', secondsVisible: false, rightOffset: 6, barSpacing: 7, minBarSpacing: 2 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  S.chart = chart;
  const PS = { priceScaleId: 'left' };
  S.serie = chart.addSeries(LC.CandlestickSeries, { ...PS, upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e' });
  const linea = (color, w) => chart.addSeries(LC.LineSeries, { ...PS, color, lineWidth: w, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  S.ind.ma20 = linea('#E8B84B', 2); S.ind.ma40 = linea('#C9A84B', 1);
  S.ind.ma100 = linea('#4D97E8', 1); S.ind.ma200 = linea('#7a66d8', 1);
  S.ind.bbA = linea('rgba(120,150,200,.5)', 1); S.ind.bbM = linea('rgba(120,150,200,.3)', 1); S.ind.bbB = linea('rgba(120,150,200,.5)', 1);
  S.ind.vol = chart.addSeries(LC.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });
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
    const { velas } = await D.velas(S.activo.s, S.tf, 500);
    if (gen !== S.gen) return;
    S.velas = velas; S._fetchAt = Date.now();
    S.serie.setData(velas.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    recalc();
    const t = await D.ticker(S.activo.s).catch(() => null);
    pintarPx(t);
    if (S.chart) { S.chart.timeScale().applyOptions({ timeVisible: S.tf !== '1D' }); S.chart.timeScale().fitContent(); }
    recalcAnalista(); pintarAnalista();
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
  S.ind.vol.setData(v.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(46,232,106,.28)' : 'rgba(255,91,110,.28)' })));
  const w = worden(v, 14, 3, 3);
  S.ind.wK.setData(cl(w.k)); S.ind.wS.setData(cl(w.señal));
}

function pintarPx(t) {
  const px = t ? t.last : (S.velas.length ? S.velas[S.velas.length - 1].close : 0);
  const chg = t ? t.chgPct : null;
  const pe = $('cat-px'); if (pe) pe.textContent = '$' + Number(px).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ce = $('cat-chg'); if (ce && chg != null) { ce.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'; ce.className = 'cat-chg ' + (chg >= 0 ? 'up' : 'dn'); }
  else if (ce) ce.textContent = '';
}

/* ───────────── analista ───────────── */
function recalcAnalista() { const e = S.estr; e._sym = S.activo.s; S.anMsg = leerCatalyst(S.velas, e, S.rot); }
function pintarAnalista() {
  const col = $('cat-an-col'), open = S.anOpen;
  const ob = $('cat-an-open'); if (ob) ob.style.display = open ? 'none' : 'flex';
  if (!col) return;
  if (!open) { col.style.display = 'none'; return; }
  col.style.display = 'flex';
  const m = S.anMsg, lang = S.lang;
  if (!m) { col.innerHTML = `<div class="cat-anc-head"><img class="cat-anc-ava" src="${AVATAR}" alt="Jesús" onerror="this.style.display='none'"><div class="cat-anc-id"><b>Jesús</b><span>${lang === 'es' ? 'No es consejo financiero' : 'Not financial advice'}</span></div></div><div class="cat-anc-wait">${lang === 'es' ? 'Leyendo el precio…' : 'Reading the tape…'}</div>`; return; }
  const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const tag = { lejos: ['WAIT', 'ESPERA'], vigilar: ['WATCH', 'VIGILA'], cerca: ['CLOSE', 'CERCA'], listo: ['READY', 'LISTO'], entra: ['GO', 'ENTRA'], invalida: ['OFF', 'FUERA'] }[m.escena] || ['', ''];
  const prox = Math.round((m.prox || 0) * 100);
  col.className = 'cat-an-col e-' + m.escena;
  col.innerHTML = `
    <div class="cat-anc-head">
      <img class="cat-anc-ava" src="${AVATAR}" alt="Jesús" onerror="this.style.display='none'">
      <div class="cat-anc-id"><b>Jesús</b><span>${lang === 'es' ? 'No es consejo financiero' : 'Not financial advice'}</span></div>
      <button class="cat-anc-lang" id="cat-anc-lang">${lang === 'en' ? 'ES' : 'EN'}</button>
      <button class="cat-anc-min" id="cat-anc-min" title="${lang === 'es' ? 'Ocultar' : 'Hide'}">${IC.close}</button>
    </div>
    <div class="cat-anc-live"><i></i><span>${lang === 'es' ? 'EN VIVO' : 'LIVE'}</span><em class="tg">${tag[lang === 'es' ? 1 : 0]}</em>
      <span class="cat-anc-setup">Setup ${S.estr.n} · ${S.estr.lado === 'call' ? 'CALL' : 'PUT'}</span></div>
    <div class="cat-anc-prox"><div class="cat-anc-bar"><i style="width:${prox}%"></i></div><span>${prox}%</span></div>
    <div class="cat-anc-title">${esc(m.titulo[lang])}</div>
    <p class="cat-anc-txt">${esc(m.txt[lang])}</p>
    <div class="cat-anc-do">${esc(m.hacer[lang])}</div>
    <p class="cat-anc-dis">${lang === 'es' ? 'Esto no es asesoría financiera. Operar conlleva riesgo y puedes perder tu capital. La decisión es tuya.' : 'This is not financial advice. Trading carries risk and you can lose your capital. The decision is yours.'}</p>`;
  const lb = $('cat-anc-lang'); if (lb) lb.onclick = () => { S.lang = S.lang === 'en' ? 'es' : 'en'; pintarAnalista(); };
  const mb = $('cat-anc-min'); if (mb) mb.onclick = () => { S.anOpen = false; pintarAnalista(); sync(); };
}
function sync() { try { S.chart && S.chart.applyOptions({}); } catch (_) {} }

/* ───────────── menús ───────────── */
function cerrarMenus() { document.querySelectorAll('.cat-menu').forEach((m) => m.remove()); }
function menuTF() {
  if (document.querySelector('.cat-menu.tf')) { cerrarMenus(); return; }
  cerrarMenus();
  const m = document.createElement('div'); m.className = 'cat-menu tf';
  m.innerHTML = TFS.map((t) => `<button data-tf="${t.id}" class="${t.id === S.tf ? 'on' : ''}">${t.n}</button>`).join('');
  posiciona(m, $('cat-tf'));
  m.querySelectorAll('button').forEach((b) => b.onclick = () => { S.tf = b.getAttribute('data-tf'); pintarTf(); cerrarMenus(); cargar(); });
}
function menuActivos() {
  if (document.querySelector('.cat-menu.co')) { cerrarMenus(); return; }
  cerrarMenus();
  const m = document.createElement('div'); m.className = 'cat-menu co';
  m.innerHTML = D.ACTIVOS.map((a) => `<button data-s="${a.s}"><i class="cat-mlg"><img src="${D.logoDe(a)}" alt="" onerror="this.style.display='none';this.parentNode.classList.add('mono')"><span>${a.s.slice(0, 2)}</span></i><b>${a.s}</b><em>${a.n}</em></button>`).join('');
  posiciona(m, $('cat-coin'));
  m.querySelectorAll('button').forEach((b) => b.onclick = () => { S.activo = D.ACTIVOS.find((a) => a.s === b.getAttribute('data-s')) || D.ACTIVOS[0]; pintarCoin(); cerrarMenus(); cargar(); });
}
function posiciona(m, ancla) {
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect();
  m.style.left = r.left + 'px'; m.style.top = (r.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('click', function cl(e) { if (!m.contains(e.target)) { cerrarMenus(); document.removeEventListener('click', cl); } }), 0);
}

/* ───────────── ajustes ───────────── */
function ajustes() {
  if ($('cat-set')) return;
  const g = (k) => { try { return (localStorage.getItem(k) || '').replace(/"/g, '&quot;'); } catch (_) { return ''; } };
  const b = document.createElement('div'); b.id = 'cat-set';
  b.innerHTML = `
    <div class="cat-set-card" role="dialog" aria-modal="true">
      <button class="cat-set-x" id="cat-set-x" aria-label="Close">${IC.close}</button>
      <h3>Alert email</h3>
      <label>Web3Forms access key <span>free at web3forms.com, for the alert emails</span>
        <input id="cat-set-w3" value="${g('catalyst_w3f_key')}" placeholder="paste your key"></label>
      <p class="cat-set-note">Stock prices already run on the platform key. These settings stay on this browser only.</p>
      <button class="cat-set-go" id="cat-set-go">Save</button>
    </div>`;
  document.body.appendChild(b);
  const cerrarS = () => b.remove();
  $('cat-set-x').onclick = cerrarS;
  b.addEventListener('click', (e) => { if (e.target === b) cerrarS(); });
  $('cat-set-go').onclick = () => { try { localStorage.setItem('catalyst_w3f_key', $('cat-set-w3').value.trim()); } catch (_) {} cerrarS(); };
}

/* ───────────── estilos ───────────── */
let _css = false;
function estilos() {
  if (_css) return; _css = true;
  const st = document.createElement('style'); st.id = 'cat-css';
  st.textContent = `
  #cat-overlay{position:fixed;inset:0;z-index:9400;background:#05070a;color:#eaecef;display:flex;flex-direction:column;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
  #cat-overlay *{box-sizing:border-box}
  .cat-top{display:flex;align-items:center;gap:9px;padding:9px 13px;border-bottom:1px solid #1a2029;background:#070a0e;flex:none;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
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
  .cat-chip{height:34px;padding:0 11px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #29313b;color:#eaecef;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;flex:none;white-space:nowrap}
  .cat-pxbox{display:flex;flex-direction:column;justify-content:center;line-height:1.1;margin-left:2px;flex:none}
  .cat-px{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:15px}
  .cat-chg{font-family:'IBM Plex Mono',monospace;font-size:11px}.cat-chg.up{color:#2ee86a}.cat-chg.dn{color:#ff5b6e}
  .cat-strat{display:flex;gap:5px;margin-left:8px;flex:none}
  .cat-sx{position:relative;width:34px;height:34px;border-radius:9px;border:1px solid #222b35;background:#0b0e12;color:#c4ccd4;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:14px;cursor:pointer}
  .cat-sx::after{content:"";position:absolute;left:7px;right:7px;bottom:5px;height:2px;border-radius:2px}
  .cat-sx.call::after{background:#2ee86a}.cat-sx.put::after{background:#ff5b6e}
  .cat-sx:hover{border-color:#3a424c}
  .cat-sx.on{border-color:#C9A84B;background:#15181f;color:#fff}
  .cat-top-r{margin-left:auto;display:flex;gap:7px;flex:none;padding-left:8px}
  .cat-ico{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;cursor:pointer}
  .cat-ico svg{width:16px;height:16px}.cat-ico:hover{border-color:#C9A84B;color:#E8B84B}
  .cat-stage{flex:1;display:flex;min-height:0}
  .cat-cvwrap{flex:1;position:relative;min-width:0}
  .cat-cv{position:absolute;inset:0}
  .cat-spin{position:absolute;inset:0;display:grid;place-items:center;color:#7c868f;font-family:'IBM Plex Mono',monospace;font-size:12px;background:rgba(5,7,10,.5);pointer-events:none}
  .cat-an-open{position:absolute;top:14px;right:14px;width:46px;height:46px;border-radius:13px;border:1px solid #C9A84B;background:#0b0e12;cursor:pointer;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.5)}
  .cat-an-open img{width:100%;height:100%;object-fit:cover}
  .cat-an-col{width:320px;flex:none;border-left:1px solid #1a2029;background:#070a0e;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
  @media(max-width:900px){.cat-an-col{width:270px}}
  @media(max-width:680px){.cat-stage{flex-direction:column}.cat-an-col{width:auto;border-left:0;border-top:1px solid #1a2029;max-height:44%}}
  .cat-anc-head{display:flex;align-items:center;gap:9px}
  .cat-anc-ava{width:38px;height:38px;border-radius:11px;object-fit:cover;flex:none;border:1px solid #29313b}
  .cat-anc-id{display:flex;flex-direction:column;line-height:1.15}.cat-anc-id b{font-family:'Chakra Petch',system-ui,sans-serif;font-size:15px}.cat-anc-id span{font-size:10.5px;color:#7c868f}
  .cat-anc-lang{margin-left:auto;height:26px;padding:0 10px;border-radius:7px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;cursor:pointer}
  .cat-anc-lang:hover{border-color:#C9A84B;color:#E8B84B}
  .cat-anc-min{width:26px;height:26px;display:grid;place-items:center;border-radius:7px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;cursor:pointer}.cat-anc-min svg{width:13px;height:13px}
  .cat-anc-wait{color:#7c868f;font-size:12.5px;padding:8px 0}
  .cat-anc-live{display:flex;align-items:center;gap:7px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:#7c868f;flex-wrap:wrap}
  .cat-anc-live i{width:7px;height:7px;border-radius:50%;background:#2ee86a;box-shadow:0 0 8px #2ee86a;animation:catpulse 1.6s infinite}
  @keyframes catpulse{0%,100%{opacity:1}50%{opacity:.35}}
  .cat-anc-live .tg{font-style:normal;font-weight:700;padding:2px 7px;border-radius:6px;letter-spacing:.08em}
  .e-lejos .tg,.e-invalida .tg{background:rgba(124,134,143,.2);color:#9aa4ad}
  .e-vigilar .tg,.e-cerca .tg{background:rgba(232,184,75,.18);color:#E8B84B}
  .e-listo .tg{background:rgba(232,184,75,.28);color:#f7db8d}
  .e-entra .tg{background:rgba(46,232,106,.2);color:#2ee86a}
  .cat-anc-setup{font-style:normal;margin-left:auto;color:#a7b0bb}
  .cat-anc-prox{display:flex;align-items:center;gap:8px}
  .cat-anc-bar{flex:1;height:6px;border-radius:4px;background:#12161d;overflow:hidden}
  .cat-anc-bar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#C9A84B,#2ee86a);transition:width .5s}
  .e-lejos .cat-anc-bar i,.e-invalida .cat-anc-bar i{background:#3a424c}
  .cat-anc-prox span{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#a7b0bb}
  .cat-anc-title{font-family:'Chakra Petch',system-ui,sans-serif;font-size:19px;line-height:1.15;color:#fff}
  .cat-anc-txt{font-size:13.5px;line-height:1.55;color:#c4ccd4;margin:0}
  .cat-anc-do{font-size:13px;font-weight:700;line-height:1.4;color:#eaecef;padding:11px 13px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid #222b35;border-left:3px solid #C9A84B}
  .e-entra .cat-anc-do{border-left-color:#2ee86a;background:rgba(46,232,106,.08)}
  .e-listo .cat-anc-do{border-left-color:#f7db8d}
  .e-lejos .cat-anc-do,.e-invalida .cat-anc-do{border-left-color:#3a424c}
  .cat-anc-dis{font-size:10.5px;line-height:1.5;color:#5f6872;margin:4px 0 0}
  .cat-menu{position:fixed;z-index:9550;background:#0b0e12;border:1px solid #2b3139;border-radius:11px;padding:6px;box-shadow:0 20px 60px rgba(0,0,0,.6);min-width:150px;max-height:360px;overflow:auto}
  .cat-menu.tf button{display:block;width:100%;text-align:left;padding:9px 11px;border:0;border-radius:8px;background:transparent;color:#eaecef;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600}
  .cat-menu.tf button.on,.cat-menu button:hover{background:rgba(255,255,255,.06)}
  .cat-menu.co{min-width:220px}
  .cat-menu.co button{display:flex;align-items:center;gap:9px;width:100%;padding:8px 9px;border:0;border-radius:8px;background:transparent;color:#eaecef;cursor:pointer;text-align:left;font-family:inherit}
  .cat-menu.co b{font-size:13px;font-weight:700}.cat-menu.co em{font-style:normal;font-size:11px;color:#7c868f;margin-left:auto}
  #cat-set{position:fixed;inset:0;z-index:9600;display:grid;place-items:center;padding:18px;background:rgba(5,7,10,.72);backdrop-filter:blur(3px)}
  .cat-set-card{position:relative;width:min(400px,100%);background:linear-gradient(180deg,#12161d,#0a0e13);border:1px solid #29313b;border-radius:16px;padding:24px;color:#eaecef}
  .cat-set-x{position:absolute;top:12px;right:14px;width:30px;height:30px;border-radius:8px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;cursor:pointer;display:grid;place-items:center}.cat-set-x svg{width:14px;height:14px}
  .cat-set-card h3{font-family:'Chakra Petch',system-ui,sans-serif;font-size:19px;margin:0 0 16px}
  .cat-set-card label{display:block;font-size:12.5px;color:#c4ccd4;margin-bottom:8px}.cat-set-card label span{color:#7c868f;font-size:11px;display:block;margin-top:2px}
  .cat-set-card input{width:100%;margin-top:6px;height:42px;border-radius:10px;border:1px solid #29313b;background:#0b0e12;color:#eaecef;padding:0 12px;font-family:'IBM Plex Mono',monospace;font-size:12.5px}
  .cat-set-card input:focus{outline:none;border-color:#C9A84B}
  .cat-set-note{font-size:11px;line-height:1.5;color:#7c868f;margin:2px 0 16px}
  .cat-set-go{width:100%;height:46px;border-radius:12px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#241900;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:14px;cursor:pointer}`;
  document.head.appendChild(st);
}
