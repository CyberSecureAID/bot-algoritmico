/* modules/multichart/multichart.js — Servicio Multichart.

   Varias gráficas en vivo a la vez (2×2 por defecto: BTC, ETH, BNB, SOL),
   cada una independiente, redimensionable (como VWAP Pro), con selector de
   moneda con búsqueda, temporalidad, indicadores con la MISMA iluminación
   (glow) del área VWAP, pantalla completa, exportar imagen y cierre.

   Reutiliza, sin tocarlos, los recursos que ya tiene la plataforma: la capa de
   datos (Binance en vivo por WebSocket), el catálogo de monedas y SUS logos, la
   librería de velas (lightweight-charts) y la MISMA barra de dibujo de Smart
   Pools / Trading Demo (barra.js). Nada de widgets externos. */

import { estilos } from './estilos.js?v=19';
import * as D from '../trading-demo/datos.js?v=2';
import { montarBarra } from '../../assets/js/niveles/barra.js?v=8';
import { dibujarHerramientas } from '../../assets/js/niveles/dibujo.js?v=4';
import { N as NIV } from '../../assets/js/niveles/estado.js?v=1';
import { INDICADORES, calcular, nombreInd as nomInd, cfgInicial, buscarInd, transformar } from '../indicadores/libreria.js?v=7';
import { abrirBarraInd, cerrarBarraInd } from '../indicadores/ui.js?v=7';
/* Instancias: la clave puede ser 'ema' o 'ema#2' (duplicados). baseId saca el id real. */
const baseId = (k) => String(k).split('#')[0];
const instN = (k) => { const m = String(k).split('#')[1]; return m ? +m : 1; };
/* Suma la escultura (warp) de la Transformacion Libre a una serie ya calculada.
   Fuera del rango esculpido mantiene el ultimo delta (asi las velas nuevas siguen
   la forma). Es lo que hace que lo moldeado se quede y siga vivo. */
function aplicarWarp(data, w) { if (!data || !w || !w.length) return data; const out = data.slice(), L = w.length; for (let i = 0; i < out.length; i++) { if (out[i] == null) continue; out[i] += (i < L ? (w[i] || 0) : (w[L - 1] || 0)); } return out; }

const LIB = new URL('../trading-demo/vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const ICONO = (s) => 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/' + String(s).toLowerCase() + '.png';
/* Carga una imagen para dibujarla en el canvas de export. Con cross=true usa
   CORS (los logos spothq/CoinGecko lo sirven), asi el canvas no se "contamina"
   y toBlob sigue funcionando. Si falla, devuelve null y se omite ese logo. */
function cargarImg(url, cross) { return new Promise((res) => { if (!url) return res(null); const im = new Image(); if (cross) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }); }

const $ = (id) => document.getElementById(id);
const DEF = ['BTC', 'ETH', 'BNB', 'SOL'];
const S = {
  paneles: [], seq: 0, raf: null, logos: {}, menu: null, menuAnc: null,
  focus: null, sync: false, tool: null, vlines: [], hlines: [], preview: null, syncing: false, _lastHerr: null, lineset: null
};
let LC = null;
let _od = null;
/* Operar desde la grafica: clic derecho → Set Position / Alerta (mismo orden.js
   del resto del area de analisis). Las posiciones se registran en el ledger de Spot. */
try { import(new URL('../../assets/js/orden.js?v=138', import.meta.url).href).then((m) => { _od = m; }).catch(() => {}); } catch (_) {}

/* ── Temporalidades: las normales (D.TFS) + SEGUNDOS agregados desde 1s ──
   Binance solo da 1s nativo por debajo del minuto; 2s/5s/10s/30s se arman agregando
   klines de 1s. El default de cada panel SIGUE siendo 1m. Todo contenido aquí (no toca
   datos.js) para no afectar a Trading Demo. */
const MC_SEG = [{ id: '1s', n: '1s', sec: 1 }, { id: '2s', n: '2s', sec: 2 }, { id: '5s', n: '5s', sec: 5 }, { id: '10s', n: '10s', sec: 10 }, { id: '30s', n: '30s', sec: 30 }];
/* Temporalidades que Binance NO sirve nativas: se arman agrupando una base nativa.
   8H SI es nativa en Binance (interval=8h), asi que esa se pide directo, sin agregar. */
const MC_AGREG = [
  { id: '3h',  n: '3H',  base: '1h', sec: 3 * 3600 },
  { id: '48h', n: '48H', base: '1d', sec: 48 * 3600 }
];
const MC_NAT_EXTRA = [{ id: '8h', n: '8H' }];
/* Lista final del selector, en orden: primero los segundos, luego las estandar
   con 3H tras 2H, 8H tras 6H y 48H tras 1D intercaladas. */
const MC_TFS = (() => {
  const out = [...MC_SEG];
  D.TFS.filter((t) => !MC_SEG.some((s) => s.id === t.id)).forEach((t) => {
    out.push(t);
    if (t.id === '2h') out.push(MC_AGREG[0]);       // 3H
    if (t.id === '6h') out.push(MC_NAT_EXTRA[0]);   // 8H (nativa)
    if (t.id === '1d') out.push(MC_AGREG[1]);       // 48H
  });
  return out;
})();
/* Si la TF hay que agregarla, devuelve { base, sec }; si es nativa, null. */
function aggDe(tf) {
  const s = MC_SEG.find((t) => t.id === tf); if (s && s.sec > 1) return { base: '1s', sec: s.sec };
  const a = MC_AGREG.find((t) => t.id === tf); if (a) return { base: a.base, sec: a.sec };
  return null;
}
function agregarVelas(base, sec) {
  const out = []; let cur = null;
  for (const v of base) { const bt = Math.floor(v.time / sec) * sec;
    if (!cur || cur.time !== bt) { if (cur) out.push(cur); cur = { time: bt, open: v.open, high: v.high, low: v.low, close: v.close, volume: v.volume }; }
    else { if (v.high > cur.high) cur.high = v.high; if (v.low < cur.low) cur.low = v.low; cur.close = v.close; cur.volume += v.volume; } }
  if (cur) out.push(cur); return out;
}
async function mcVelas(simbolo, tf, limit) {
  const a = aggDe(tf);
  if (a) { const base = await D.velas(simbolo, a.base, 1000); return agregarVelas(base, a.sec); }
  return D.velas(simbolo, tf, limit);
}
function mcStream(simbolo, tf, onKline) {
  const a = aggDe(tf);
  if (!a) return D.streamVelas(simbolo, tf, onKline);
  const sec = a.sec;
  let buck = null;   // vela agregada en formación; el volumen se suma solo al CERRAR de cada vela base (sin doble conteo)
  return D.streamVelas(simbolo, a.base, (k) => {
    const bt = Math.floor(Math.floor(k.t / 1000) / sec) * sec, btMs = bt * 1000;
    const o = +k.o, h = +k.h, l = +k.l, c = +k.c, v = +k.v;
    if (!buck || buck.t !== btMs) buck = { t: btMs, o, h, l, c, v: 0 };
    else { if (h > buck.h) buck.h = h; if (l < buck.l) buck.l = l; buck.c = c; }
    if (k.x === true) buck.v += v;
    onKline({ t: buck.t, o: buck.o, h: buck.h, l: buck.l, c: buck.c, v: buck.v, x: false });
  });
}

/* ── Indicadores ──
   La libreria (formulas + catalogo) y la barra de config viven en
   modules/indicadores/. Aqui solo se guarda la config por panel, se calcula
   con la libreria y se dibuja. Overlays activos: pane.ovl (Set de ids).
   Oscilador: pane.oscK (uno a la vez). Estilo y parametros: pane.cfg[id]. */
/* Acepta un def o una clave de instancia ('ema', 'ema#2'). La config se guarda por INSTANCIA. */
function cfgDe(pane, x) { const key = (typeof x === 'string') ? x : x.id; const def = defDe(pane, key); if (!pane.cfg) pane.cfg = {}; if (!pane.cfg[key] && def) pane.cfg[key] = cfgInicial(def); return pane.cfg[key]; }

const IC = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  signal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 16.1a10 10 0 0 1 0-8.2M19.1 7.9a10 10 0 0 1 0 8.2M7.9 13.2a6 6 0 0 1 0-2.4M16.1 10.8a6 6 0 0 1 0 2.4"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.4"/></svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a8 8 0 0 1 13-2.5L20 7"/><path d="M20 17a8 8 0 0 1-13 2.5L4 17"/><path d="M20 3v4h-4M4 21v-4h4"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a2.7 2.7 0 0 1 5.2 1c0 1.8-2.7 2.3-2.7 4"/><path d="M12 17.3v.01"/></svg>',
  vline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 3v18"/><circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>',
  hline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M3 12h18"/><circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
  shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14 4.5L20 16"/><path d="M20 20v-4h-4"/></svg>',
  goright: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5l7 7-7 7"/><path d="M16 5v14"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5Z"/><path d="M3 13l9 5 9-5"/></svg>',
  hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V6.2a1.4 1.4 0 0 1 2.8 0V11m0-.8V5a1.4 1.4 0 0 1 2.8 0v5.6m0-.6V6.4a1.4 1.4 0 0 1 2.8 0V13c0 3.5-2.3 6-5.6 6-2 0-3.3-.8-4.4-2.2l-2.1-2.8c-.6-.8-.3-1.7.5-2.2.7-.4 1.4-.2 1.9.3L8 13"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c2-4.5 4-4.5 6 0s4 4.5 6 0 4-4.5 6 0"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3 4.5V9h4.5"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5l4 4M4 20l4.6-1.1 9.9-9.9a1.8 1.8 0 0 0 0-2.5l-1.5-1.5a1.8 1.8 0 0 0-2.5 0L4.5 15.4 4 20z"/></svg>',
  dock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M13 12h5v5.5"/><path d="M3 12h10v7.5"/></svg>'
};

function lib() { return window.LightweightCharts ? Promise.resolve(window.LightweightCharts) : new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.onload = () => res(window.LightweightCharts); s.onerror = rej; document.head.appendChild(s); }); }

export async function abrirMulti() {
  if ($('mc-overlay')) return;
  estilos();
  const ov = document.createElement('div'); ov.id = 'mc-overlay';
  ov.innerHTML = `
    <div class="mc-top">
      <button class="mc-back" id="mc-back">${IC.back} Back</button>
      <button class="mc-allcoin" id="mc-allcoin" title="Pick one coin for all charts at once">${IC.layers}<b>All charts</b>${IC.chev}</button>
      <div class="mc-top-r">
        <button class="mc-hw" id="mc-hw" title="How it works">${IC.help}<span>How it works</span></button>
        <button class="mc-tool" id="mc-sync" title="Sync all charts: crosshair, zoom and scroll move together (any timeframe)">${IC.sync}<span>Sync</span></button>
        <button class="mc-icobtn mc-off" id="mc-dock" title="Dock the floating chart into the grid">${IC.dock}</button>
        <button class="mc-tool" id="mc-vline" title="Vertical line: mark the same time on every chart">${IC.vline}<span>V-line</span></button>
        <button class="mc-tool" id="mc-hline" title="Horizontal line: mark a price level">${IC.hline}<span>H-line</span></button>
        <span class="mc-sep"></span>
        <button class="mc-icobtn" id="mc-reset" title="Reset layout (restore the 4 default charts)">${IC.refresh}</button>
        <button class="mc-icobtn" id="mc-save" title="Save image of all charts">${IC.cam}</button>
        <button class="mc-add" id="mc-addbtn">${IC.plus}<span>Add chart</span></button>
      </div>
    </div>
    <div class="mc-grid" id="mc-grid"></div>`;
  document.body.appendChild(ov);
  $('mc-back').onclick = cerrarMulti;
  $('mc-allcoin').onclick = (e) => { e.stopPropagation(); alternarMenu($('mc-allcoin'), () => menuMonedasMulti($('mc-allcoin'))); };
  $('mc-addbtn').onclick = () => addFloat();
  $('mc-dock').onclick = acoplar;
  $('mc-reset').onclick = reorganizar;
  $('mc-save').onclick = guardarImagenTodas;
  $('mc-hw').onclick = ayudaMC;
  $('mc-sync').onclick = () => toggleSync();
  $('mc-vline').onclick = () => toggleTool('vline');
  $('mc-hline').onclick = () => toggleTool('hline');
  document.addEventListener('mousedown', fueraMenu, true);
  try { LC = await lib(); } catch (_) { toast('Could not load the chart library.'); return; }
  await Promise.all(DEF.map((id) => crearPanel(id, '1m')));   // los 4 en paralelo (antes iban uno tras otro y tardaba)
  ajustarGrid();
  if (S.paneles[0]) enfocar(S.paneles[0]);
  D.logos().then((l) => { S.logos = l || {}; S.paneles.forEach(pintarLogoHead); });
  arrancarRAF();
  window.addEventListener('resize', onResize);
  window.addEventListener('mouseup', onUpSig);   // al soltar un dibujo: actualiza el boton Share Signal
}

function cerrarMulti() {
  if (S.raf) cancelAnimationFrame(S.raf);
  document.removeEventListener('mousedown', fueraMenu, true);
  window.removeEventListener('resize', onResize);
  window.removeEventListener('mouseup', onUpSig);
  S.paneles.forEach((p) => { try { p.stream && p.stream.cerrar(); } catch (_) {} try { p.barra && p.barra.desmontar && p.barra.desmontar(); } catch (_) {} try { p.chart.remove(); } catch (_) {} });
  S.paneles = []; S.focus = null; S.vlines = []; S.hlines = []; S.tool = null;   // las líneas no deben sobrevivir a salir/entrar
  cerrarMenu(); cerrarLineset();
  const m = $('mc-modal'); if (m) m.remove();
  const ov = $('mc-overlay'); if (ov) ov.remove();
  if (window.__ANALISIS_PAGINA__ && !document.getElementById('an-root')) { try { location.href = new URL('../../index.html', import.meta.url).href; } catch (_) {} }
}
function onResize() { S.paneles.forEach((p) => { try { p.chart.applyOptions({}); } catch (_) {} }); if (S.focus) sincronizarFocus(); }
function onUpSig() { setTimeout(refrescarShareSigTodas, 0); }   // tras soltar/borrar un dibujo, revisa si hay posicion

/* ── Panel ── */
async function crearPanel(parId, tf, flotante, pos) {
  const par = D.PARES.find((p) => p.id === parId) || D.PARES[0];
  const id = 'mcp' + (++S.seq);
  const pane = {
    id, par, tf, chart: null, serie: null, velas: [], velasMs: [], stream: null,
    flotante: !!flotante, max: false, ovl: new Set(), oscK: null, oscSeries: null, oscRefs: [], cfg: {}, ind: {},
    dibCache: [], barra: null, streamGen: 0, loadGen: 0, _hit: null
  };
  const el = document.createElement('div'); el.className = flotante ? 'mc-float' : 'mc-pane'; el.id = id;
  el.innerHTML = `
    <div class="mc-head">
      <button class="mc-fsback" data-fsback title="Back to all charts">${IC.back} Back</button>
      <button class="mc-coin" data-coin><span class="ic"></span><b class="nm">${par.id}</b><span class="q">/USDT</span><span class="cv">▾</span></button>
      <button class="mc-tf" data-tf>${tf}</button>
      <span class="mc-px" data-px>—</span>
      <span class="mc-hsp"></span>
      <button class="mc-indbtn" data-ind title="Indicators">Indicator ${IC.chev}</button>
      <button class="mc-ftbtn" data-ft title="Free Transform: sculpt your indicators right on the chart">${IC.hand}Free Transform</button>
      <button class="mc-sharesig" data-sharesig title="Share Signal: export this position as a clean card (coin logo, entry, stop, target)" disabled>${IC.signal}Share Signal</button>
      <button class="mc-hb" data-share title="Share image">${IC.cam}</button>
      <button class="mc-hb" data-full title="Fullscreen">${IC.full}</button>
      <button class="mc-hb mc-close" data-close title="Close">${IC.x}</button>
    </div>
    <div class="mc-body">
      <div class="mc-cv"></div>
      <canvas class="mc-fx"></canvas>
      <canvas class="mc-ux"></canvas>
      <div class="mc-wm"><img src="${LOGO}" alt=""></div>
      <div class="mc-cap"></div>
      <button class="mc-goright" data-goright title="Go to current price">${IC.goright}</button>
      <div class="mc-grip"></div>
      <div class="mc-hint">Click to draw</div>
      <div class="mc-spin"><i></i></div>
    </div>`;
  if (flotante) { el.style.left = ((pos && pos.x) || 130 + S.paneles.length * 22) + 'px'; el.style.top = ((pos && pos.y) || 86 + S.paneles.length * 20) + 'px'; $('mc-overlay').appendChild(el); }
  else $('mc-grid').appendChild(el);
  pane.el = el;
  pane.body = el.querySelector('.mc-body');
  pane.fx = el.querySelector('.mc-fx');
  pane.ux = el.querySelector('.mc-ux');
  const mount = el.querySelector('.mc-cv');
  const chart = LC.createChart(mount, {
    autoSize: true, localization: { locale: 'en' },
    layout: { background: { type: 'solid', color: '#05070a' }, textColor: '#8b95a1', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, attributionLogo: false },
    grid: { vertLines: { color: 'rgba(255,255,255,.028)' }, horzLines: { color: 'rgba(255,255,255,.028)' } },
    rightPriceScale: { borderColor: '#222b35', scaleMargins: { top: 0.08, bottom: 0.08 } },
    timeScale: { borderColor: '#222b35', timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 6, minBarSpacing: 0.4 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  const serie = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e', priceLineVisible: true, lastValueVisible: true });
  pane.chart = chart; pane.serie = serie;
  S.paneles.push(pane);
  pintarLogoHead(pane);
  wirePane(pane);
  // barra de dibujo (la MISMA de Smart Pools / Demo), una por panel
  try { pane.barra = montarBarra(pane.body); } catch (_) { pane.barra = null; }
  // SYNC por TIEMPO real: funciona aunque cada gráfica tenga distinta temporalidad
  // y moneda. (El rango lógico fallaba: alineaba por índice de vela, no por fecha.)
  try {
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => { if (pane === S.focus) sincronizarFocus(); });
    chart.timeScale().subscribeVisibleTimeRangeChange((rango) => {
      if (!S.sync || S.syncing || !rango) return;
      S.syncing = true;
      S.paneles.forEach((o) => { if (o !== pane) aplicarRango(o, rango); });
      requestAnimationFrame(() => { S.syncing = false; });   // absorbe los ecos antes de soltar el candado
    });
    chart.subscribeCrosshairMove((param) => {
      if (!S.sync) return;
      if (!param.point || param.time == null) { S.paneles.forEach((o) => { if (o !== pane) try { o.chart.clearCrosshairPosition(); } catch (_) {} }); return; }
      S.paneles.forEach((o) => { if (o === pane) return; const vt = valorEnTiempo(o, param.time); if (vt) { try { o.chart.setCrosshairPosition(vt.price, vt.time, o.serie); } catch (_) {} } });
    });
  } catch (_) {}
  await cargarPanel(pane);
  return pane;
}

async function cargarPanel(pane) {
  const myGen = ++pane.loadGen;                 // cada carga invalida a las anteriores (cambios rápidos de moneda/TF)
  const sp = pane.el.querySelector('.mc-spin'); if (sp) sp.style.display = 'grid';
  try {
    const [v, t] = await Promise.all([mcVelas(pane.par.s, pane.tf, 1000), D.ticker(pane.par.s).catch(() => null)]);
    if (myGen !== pane.loadGen) return;         // otra carga más reciente ya ganó: no pisamos sus datos
    pane.velas = v;
    pane.velasMs = v.map((c) => ({ t: c.time * 1000, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume }));
    pane.serie.setData(v.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    pane.formT = null; pane.formReal = null; pane.realC = null; pane.dispC = null;   // reinicia el easing de la vela en formación
    recalc(pane);
    if (t) pintarPx(pane, t.last, t.chgPct); else if (v.length) pintarPx(pane, v[v.length - 1].close);
    vistaDefecto(pane);
    if (pane === S.focus) sincronizarFocus();
  } catch (_) { if (myGen === pane.loadGen) toast('Could not load ' + pane.par.id + '.'); }
  if (myGen !== pane.loadGen) return;
  if (sp) sp.style.display = 'none';
  iniciarStream(pane);
}
function iniciarStream(pane) {
  try { pane.stream && pane.stream.cerrar(); } catch (_) {}
  const gen = ++pane.streamGen;                 // invalida los mensajes del stream anterior (otra moneda)
  try { pane.stream = mcStream(pane.par.s, pane.tf, (k) => { if (gen === pane.streamGen) onKline(pane, k); }); } catch (_) { pane.stream = null; }
}
function onKline(pane, k) {
  if (!pane.serie) return;
  const c = { time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v };
  if (!(c.close > 0)) return;
  const last = pane.velas[pane.velas.length - 1];
  const cm = { t: c.time * 1000, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume };
  if (last && c.time === last.time) { pane.velas[pane.velas.length - 1] = c; pane.velasMs[pane.velasMs.length - 1] = cm; }
  else if (!last || c.time > last.time) {
    // cierra la vela anterior en su precio REAL (no la deja a medio camino del easing)
    if (pane.formT != null && pane.formReal) { try { pane.serie.update({ time: pane.formT, open: pane.formReal.open, high: pane.formReal.high, low: pane.formReal.low, close: pane.formReal.close }); } catch (_) {} }
    pane.velas.push(c); pane.velasMs.push(cm);
    if (pane.velas.length > 1200) { pane.velas.shift(); pane.velasMs.shift(); }
    pane.dispC = c.open;   // la vela nueva nace en su apertura y se mueve desde ahí
    try { pane.serie.update({ time: c.time, open: c.open, high: c.open, low: c.open, close: c.open }); } catch (_) {}
  } else return;
  // estado de la vela en formación: el bucle a 30fps mueve el cierre MOSTRADO hacia el real
  pane.formT = c.time;
  pane.formReal = { open: c.open, high: c.high, low: c.low, close: c.close };
  pane.realC = c.close;
  if (pane.dispC == null) pane.dispC = c.close;
  recalc(pane);
  pintarPx(pane, c.close);
  if (pane === S.focus) sincronizarFocus();
}
function pintarPx(pane, px, chg) {
  const e = pane.el.querySelector('[data-px]'); if (!e) return;
  const d = decimales(px);
  e.innerHTML = Number(px).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + (chg != null ? ` <small class="${chg >= 0 ? 'up' : 'down'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</small>` : '');
}
function pintarLogoHead(pane) {
  const ic = pane.el.querySelector('.mc-coin .ic'); if (!ic) return;
  const url = (S.logos && pane.par.cg && S.logos[pane.par.cg]) || ICONO(pane.par.id);
  const im = new Image(); im.onload = () => { ic.style.backgroundImage = `url(${url})`; ic.textContent = ''; }; im.onerror = () => { ic.textContent = pane.par.id[0]; }; im.src = url;
}

/* ── Indicadores: cálculo cacheado + trazo limpio con animación cometa ── */
function recalc(pane) {
  const v = pane.velas;
  const ind = { ovl: [], nubes: [] };
  if (v.length) pane.ovl.forEach((key) => {
    const def = defDe(pane, key); if (!def || def.tipo !== 'ovl') return;
    const c = cfgDe(pane, key); const r = calcular(def, v, c);
    const op = (c.op != null ? c.op : 100) / 100;
    (r.lineas || []).forEach((ln, li) => { let data = transformar(ln.data, c); if (c.warp && c.warp[li]) data = aplicarWarp(data, c.warp[li]);
      ind.ovl.push({ id: key, li, col: ln.col || c.col, gr: ln.gr || c.gr, dash: ln.dash != null ? ln.dash : c.dash, ls: c.ls || (c.dash ? 'dashed' : 'solid'), a: (ln.a != null ? ln.a : 1) * op, glow: c.glow || 0, dyn: !!c.dyn, fill: c.fill || 0, tag: !!c.tag, data, shift: (ln.shift || 0) + (c.desp || 0), dots: !!ln.dots, dir: ln.dir || null, pins: c.pins, tam: c.tam }); });
    (r.nubes || []).forEach((nb) => ind.nubes.push(nb));
  });
  pane.ind = ind;
  // Oscilador: PANEL NATIVO de la libreria (como TradingView), nunca una banda encima.
  if (v.length && pane.oscK) {
    const def = buscarInd(baseId(pane.oscK));
    if (def && def.tipo === 'osc') { const c = cfgDe(pane, pane.oscK); sincronizarOsc(pane, def, c, calcular(def, v, c)); }
    else desmontarOsc(pane);
  } else desmontarOsc(pane);
  sincronizarFT(pane);
  actualizarLeyenda(pane);
}
/* Mira si algun indicador tiene la Transformacion Libre activa y deja lista la
   escultura: solo uno a la vez por panel. Pone el cursor de manita. */
function sincronizarFT(pane) {
  // La Transformacion Libre es ahora una HERRAMIENTA global del panel (boton dorado),
  // no una opcion de cada indicador. Solo refleja el cursor de manita cuando esta activa.
  if (pane.body) pane.body.classList.toggle('ftmode', !!pane.ftTool);
}
/* ── Oscilador en su PROPIO panel nativo (LightweightCharts v5 panes).
   Es un panel de verdad: con su eje de precios a la derecha y su separador
   arrastrable (agranda o achica como TradingView). Es OPACO, no deja ver las
   velas ni la rejilla detras, y no es una banda pegada encima del grafico. ── */
function serieOsc(pane, arr, shift) { shift = shift || 0; const v = pane.velas, o = []; for (let i = 0; i < arr.length; i++) { if (arr[i] == null) continue; const j = i + shift; const t = v[j] && v[j].time; if (t == null) continue; o.push({ time: t, value: arr[i] }); } return o; }
function crearOsc(pane, def, c, r) {
  const chart = pane.chart, S2 = {};
  if (r.hist) S2.hist = chart.addSeries(LC.HistogramSeries, { priceLineVisible: false, lastValueVisible: r.serie == null, base: 0 }, 1);
  if (r.serie3 != null) S2.s3 = chart.addSeries(LC.LineSeries, { color: r.col3 || '#49b6ff', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 1);
  if (r.serie2 != null) S2.s2 = chart.addSeries(LC.LineSeries, { color: r.col2 || '#ff8fbf', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 1);
  if (r.serie != null) S2.main = chart.addSeries(LC.LineSeries, { color: c.col, lineWidth: c.gr || 2, priceLineVisible: false, lastValueVisible: true }, 1);
  const ref = S2.main || S2.hist;   // los indicadores de solo histograma (AO) cuelgan de la serie del histograma
  if (def.rango && ref) { try { ref.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: def.rango[0], maxValue: def.rango[1] } }) }); } catch (_) {} }
  pane.oscSeries = S2; pane.oscRefs = [];
  if (ref) (def.ref || []).forEach((rv) => { try { pane.oscRefs.push(ref.createPriceLine({ price: rv, color: 'rgba(255,255,255,.22)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true })); } catch (_) {} });
  try { const ps = chart.panes(); if (ps[1]) ps[1].setHeight(Math.max(90, Math.round((pane.body.clientHeight || 300) * 0.28))); } catch (_) {}
}
function sincronizarOsc(pane, def, c, r) {
  // La FORMA del oscilador (cuantas series/histograma) puede cambiar con las
  // opciones propias (media de senal, ±DI de ADX, modo de AO, Aroon oscilador):
  // si cambia, se remonta el panel para crear o quitar las series que toquen.
  const forma = def.id + ':' + (r.serie != null ? '1' : '0') + (r.serie2 != null ? '2' : '0') + (r.serie3 != null ? '3' : '0') + (r.hist ? 'h' : '0');
  if (pane._oscMounted !== forma) { desmontarOsc(pane); crearOsc(pane, def, c, r); pane._oscMounted = forma; }
  const S2 = pane.oscSeries; if (!S2) return;
  const op = (c.op != null ? c.op : 100) / 100, lsN = c.ls === 'dotted' ? 1 : c.ls === 'dashed' ? 2 : 0;
  if (S2.hist && r.hist) {
    const v = pane.velas, h = []; let prev = null;
    for (let i = 0; i < r.hist.length; i++) { const hv = r.hist[i]; if (hv == null) continue; const j = i + (c.desp || 0); const t = v[j] && v[j].time; if (t == null) continue; const col = r.histMom ? ((prev == null || hv >= prev) ? 'rgba(46,232,106,.62)' : 'rgba(255,91,110,.62)') : (hv >= 0 ? 'rgba(46,232,106,.55)' : 'rgba(255,91,110,.55)'); prev = hv; h.push({ time: t, value: hv, color: col }); }
    try { S2.hist.setData(h); } catch (_) {}
  }
  const wrp = (s, li) => { let d = transformar(s, c); if (c.warp && c.warp[li]) d = aplicarWarp(d, c.warp[li]); return d; };
  const dsp = c.desp || 0;
  if (S2.s3 && r.serie3) { try { S2.s3.applyOptions({ color: hexA(r.col3 || '#49b6ff', op), lineWidth: c.gr || 2, lineStyle: lsN }); S2.s3.setData(serieOsc(pane, wrp(r.serie3, 2), dsp)); } catch (_) {} }
  if (S2.s2 && r.serie2) { try { S2.s2.applyOptions({ color: hexA(r.col2 || '#ff8fbf', op), lineWidth: c.gr || 2, lineStyle: lsN }); S2.s2.setData(serieOsc(pane, wrp(r.serie2, 1), dsp)); } catch (_) {} }
  if (S2.main && r.serie) { try { S2.main.applyOptions({ color: hexA(c.col, op), lineWidth: c.gr || 2, lineStyle: lsN, priceLineVisible: !!c.tag }); S2.main.setData(serieOsc(pane, wrp(r.serie, 0), dsp)); } catch (_) {} }
  // guardo las series YA transformadas (con warp) para el hit-test y el arrastre de la Transformacion Libre
  pane._oscData = { serie: r.serie ? wrp(r.serie, 0) : null, serie2: r.serie2 ? wrp(r.serie2, 1) : null, serie3: r.serie3 ? wrp(r.serie3, 2) : null };
  let last = null; const src = r.serie || r.hist; if (src) for (let i = src.length - 1; i >= 0; i--) { if (src[i] != null) { last = src[i]; break; } }
  pane._oscLast = last;
}
function desmontarOsc(pane) {
  if (pane.oscSeries) { Object.keys(pane.oscSeries).forEach((k) => { try { pane.chart.removeSeries(pane.oscSeries[k]); } catch (_) {} }); pane.oscSeries = null; }
  pane.oscRefs = []; pane._oscMounted = null; pane._oscLast = null; pane._oscData = null;
  if (pane.oscLeg) { pane.oscLeg.style.display = 'none'; pane.oscLeg._nom = null; }
}
function arrancarRAF() {
  let last = 0;
  const tick = (ts) => {
    S.raf = requestAnimationFrame(tick);
    if (ts - last < 33) return;            // ~30fps: suave y barato (como el VWAP Pro)
    last = ts;
    if (NIV.herr !== S._lastHerr) { S._lastHerr = NIV.herr; sincronizarStrips(); }
    S.paneles.forEach((p) => { mover(p); dibujarInds(p); dibujarUX(p); });
  };
  S.raf = requestAnimationFrame(tick);
}
/* Movimiento FLUIDO de la vela en formación (igual que Footprint): el cierre MOSTRADO
   persigue al precio real con easing y se repinta cada frame, en vez de saltar por mensaje.
   La vela sube y baja de forma orgánica mientras está vigente; al cerrar queda en su real. */
function mover(p) {
  if (!p.serie || p.formT == null || p.realC == null || !p.formReal) return;
  if (p.dispC == null) p.dispC = p.realC;
  p.dispC += (p.realC - p.dispC) * 0.22;
  if (Math.abs(p.realC - p.dispC) < Math.max(1e-8, Math.abs(p.realC) * 2e-6)) p.dispC = p.realC;
  const hi = Math.max(p.formReal.high, p.dispC), lo = Math.min(p.formReal.low, p.dispC);
  try { p.serie.update({ time: p.formT, open: p.formReal.open, high: hi, low: lo, close: p.dispC }); } catch (_) {}
}

function dibujarInds(pane) {
  const fx = pane.fx, body = pane.body; if (!fx || !body || !pane.serie) return;
  const W = body.clientWidth, H = body.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (fx.width !== Math.round(W * dpr)) { fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); fx.style.width = W + 'px'; fx.style.height = H + 'px'; }
  const g = fx.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const ind = pane.ind; if (!ind) return;
  const ts = pane.chart.timeScale();
  const X = (t) => { try { const c = ts.timeToCoordinate(t); return c == null ? null : c; } catch (_) { return null; } };
  const Yp = (p) => { try { const c = pane.serie.priceToCoordinate(p); return c == null ? null : c; } catch (_) { return null; } };
  const now = performance.now();
  const v = pane.velas;
  // Recorta al area de ploteo: el indicador NUNCA se dibuja sobre el eje de precios (derecha).
  let psW = 0; try { psW = pane.chart.priceScale('right').width() || 0; } catch (_) {}
  const plotW = Math.max(10, W - psW);
  // Posicion por INDICE logico: sirve para lineas desplazadas y para la nube adelantada al futuro.
  const XL = (idx) => { try { const c = ts.logicalToCoordinate(idx); return c == null ? null : c; } catch (_) { return null; } };
  g.save(); g.beginPath(); g.rect(0, 0, plotW, H); g.clip();
  (ind.nubes || []).forEach((nb) => dibujarNube(g, v, nb, XL, Yp));
  (ind.ovl || []).forEach((o, i) => {
    if (o.dots) dibujarDots(g, v, o, XL, Yp);
    else if (o.dir) { lineaSeg(g, v, o, XL, Yp); if (baseId(o.id) === 'supertrend' && o.pins !== false) tachuelasST(g, v, o, XL, Yp); }
    else lineaComet(g, v, o, XL, Yp, W, H, now, i);
  });
  g.restore();
}
/* Convierte #rrggbb a rgba con alpha (para rellenos con gradiente). */
function hexA(h, a) { if (!h || h[0] !== '#') return h; h = h.slice(1); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
/* Traza una polilinea respetando los cortes (saltos de indice). */
function trazaRun(g, pts) { g.beginPath(); let prev = null; for (let k = 0; k < pts.length; k++) { const p = pts[k]; if (prev && p[2] === prev[2] + 1) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); prev = p; } g.stroke(); }
/* Etiqueta de precio en vivo al final de la linea. */
function etiquetaPrecio(g, x, y, val, col) { if (val == null) return; const txt = Number(val).toFixed(decimales(val)); g.save(); g.setLineDash([]); g.font = '700 10px "IBM Plex Mono",monospace'; const tw = g.measureText(txt).width + 12; g.globalAlpha = 1; redondea(g, x + 6, y - 9, tw, 18, 5); g.fillStyle = col; g.fill(); g.fillStyle = '#06100b'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(txt, x + 12, y + 0.5); g.textBaseline = 'alphabetic'; g.restore(); }
/* Indicador: trazo LIMPIO con opciones (opacidad, estilo, glow, color dinamico,
   relleno, etiqueta) + una luz (cometa) que lo recorre, igual que VWAP Pro. */
function lineaComet(g, velas, o, XL, Yp, W, H, now, idx) {
  const data = o.data; if (!data) return;
  const col = o.col, gr = o.gr || 1.5, ls = o.ls || 'solid', base = o.a != null ? o.a : 1, sh = o.shift || 0, glow = o.glow || 0, dyn = !!o.dyn, fill = o.fill || 0, tag = !!o.tag;
  const UP = '#2ee86a', DN = '#ff5b6e';
  const pts = [];
  for (let i = 0; i < velas.length; i++) { const val = data[i]; if (val == null) continue; const x = XL(i + sh); if (x == null) continue; const y = Yp(val); if (y == null) continue; pts.push([x, y, i]); }
  if (pts.length < 2) return;
  const dashPat = ls === 'dashed' ? [6, 5] : ls === 'dotted' ? [2, 4] : [];
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.shadowBlur = 0; g.globalAlpha = base;
  // relleno hacia la base (gradiente que se desvanece)
  if (fill > 0) {
    g.save(); g.setLineDash([]); g.globalAlpha = base * (fill / 100);
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, hexA(col, 0.5)); grd.addColorStop(1, hexA(col, 0)); g.fillStyle = grd;
    let prev = null, run0 = null;
    const cerrar = (last) => { if (run0 && last) { g.lineTo(last[0], H); g.lineTo(run0[0], H); g.closePath(); g.fill(); } };
    for (let k = 0; k < pts.length; k++) { const p = pts[k]; if (prev && p[2] === prev[2] + 1) g.lineTo(p[0], p[1]); else { cerrar(prev); g.beginPath(); g.moveTo(p[0], H); g.lineTo(p[0], p[1]); run0 = p; } prev = p; }
    cerrar(prev); g.restore();
  }
  // glow opcional (neon alrededor de la linea)
  if (glow > 0) { g.save(); g.setLineDash(dashPat); g.shadowColor = col; g.shadowBlur = glow / 100 * 18; g.strokeStyle = col; g.lineWidth = gr + 1; g.globalAlpha = base * 0.9; trazaRun(g, pts); g.restore(); }
  // linea base (color unico o dinamico por pendiente)
  g.setLineDash(dashPat); g.lineWidth = gr;
  if (dyn) { let prev = null; for (let k = 0; k < pts.length; k++) { const p = pts[k]; if (prev && p[2] === prev[2] + 1) { g.strokeStyle = (p[1] <= prev[1] ? UP : DN); g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke(); } prev = p; } }
  else { g.strokeStyle = col; trazaRun(g, pts); }
  g.setLineDash([]);
  // cometa (luz que recorre), cuando el color no es dinamico
  if (!dyn) {
    const period = 4600, headX = (((now + idx * 760) % period) / period) * (W + 260) - 130, tail = 130; let prev = null;
    for (let k = 0; k < pts.length; k++) { const p = pts[k];
      if (prev && p[2] === prev[2] + 1) { const mx = (prev[0] + p[0]) / 2, d = Math.abs(mx - headX);
        if (d <= tail) { const a = 1 - d / tail;
          g.shadowColor = col; g.shadowBlur = 6; g.strokeStyle = col; g.lineWidth = 2; g.globalAlpha = base * 0.5 * a; g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke();
          g.shadowBlur = 0; g.strokeStyle = '#ffffff'; g.lineWidth = 1.1; g.globalAlpha = base * 0.42 * a * a; g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(p[0], p[1]); g.stroke(); } }
      prev = p; }
  }
  g.globalAlpha = base; if (tag) { const lp = pts[pts.length - 1]; etiquetaPrecio(g, lp[0], lp[1], data[lp[2]], col); }
  g.globalAlpha = 1; g.restore();
}
/* SUPERTREND: tachuela LONG donde la media pasa a verde (alcista) y tachuela
   SHORT donde pasa a rojo (bajista). Una por cada cambio de color. */
function tachuelasST(g, velas, o, XL, Yp) {
  const dir = o.dir || [], sh = o.shift || 0;
  for (let i = 1; i < velas.length; i++) {
    const d = dir[i], pd = dir[i - 1]; if (d == null || pd == null) continue;
    const alc = d >= 0, antes = pd >= 0; if (alc === antes) continue;
    const x = XL(i + sh); if (x == null) continue;
    const y = Yp(alc ? velas[i].low : velas[i].high); if (y == null) continue;
    pinST(g, x, y, alc);
  }
}
/* Tachuela estilo TradingView: rectangulo con bordes redondeados y piquito
   triangular. LONG va debajo de la vela, pico ARRIBA, verde radioactivo con texto
   blanco. SHORT va encima, pico ABAJO, rojo tipo YouTube con texto amarillo. */
function pinST(g, x, yEdge, long) {
  const label = long ? 'LONG' : 'SHORT';
  const fill = long ? '#2ee86a' : '#ff0000';
  const txtCol = long ? '#ffffff' : '#E8B84B';
  g.save();
  g.font = '800 9px "IBM Plex Mono", monospace';
  const tw = g.measureText(label).width, padX = 6, h = 16, w = Math.ceil(tw) + padX * 2, rx = 4.5, tri = 5, gap = 5;
  const cx = x, top = long ? (yEdge + gap + tri) : (yEdge - gap - tri - h), left = cx - w / 2;
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 6; g.shadowOffsetY = long ? 2 : -2;
  g.fillStyle = fill; g.beginPath(); roundRectPath(g, left, top, w, h, rx); g.fill();
  g.beginPath();
  if (long) { const ty = top; g.moveTo(cx - tri, ty); g.lineTo(cx + tri, ty); g.lineTo(cx, ty - tri); }
  else { const ty = top + h; g.moveTo(cx - tri, ty); g.lineTo(cx + tri, ty); g.lineTo(cx, ty + tri); }
  g.closePath(); g.fill();
  g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.fillStyle = txtCol; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, cx, top + h / 2 + 0.5);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.restore();
}
function roundRectPath(g, x, y, w, h, r) { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); }
/* Linea con color por TRAMO segun la direccion (SuperTrend, PSAR): verde en
   tendencia alcista, rojo en bajista. Sin cometa. */
function lineaSeg(g, velas, o, XL, Yp) {
  const data = o.data, dir = o.dir || [], sh = o.shift || 0, up = '#2ee86a', dn = '#ff5b6e';
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.lineWidth = o.gr || 2; g.globalAlpha = o.a != null ? o.a : 1;
  let px = null, py = null, pi = -2;
  for (let i = 0; i < velas.length; i++) {
    const val = data[i]; if (val == null) { px = null; continue; }
    const x = XL(i + sh); if (x == null) { px = null; continue; }
    const y = Yp(val); if (y == null) { px = null; continue; }
    if (px != null && i === pi + 1) { g.strokeStyle = (dir[i] >= 0 ? up : dn); g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke(); }
    px = x; py = y; pi = i;
  }
  g.restore();
}
/* Puntos (Parabolic SAR): un punto por vela, coloreado por tendencia si hay dir. */
function dibujarDots(g, velas, o, XL, Yp) {
  const data = o.data, dir = o.dir, sh = o.shift || 0, r = Math.max(1.4, o.tam != null ? o.tam : (o.gr || 2) * 0.9), up = '#2ee86a', dn = '#ff5b6e';
  g.save(); g.globalAlpha = o.a != null ? o.a : 1;
  for (let i = 0; i < velas.length; i++) {
    const val = data[i]; if (val == null) continue; const x = XL(i + sh); if (x == null) continue; const y = Yp(val); if (y == null) continue;
    g.fillStyle = dir ? (dir[i] >= 0 ? up : dn) : o.col;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}
/* Nube (Ichimoku): relleno entre dos lineas (A y B), verde si A>=B, rojo si A<B,
   por tramos. Puede ir desplazada al futuro con shift. */
function dibujarNube(g, velas, nb, XL, Yp) {
  const a = nb.a, b = nb.b, sh = nb.shift || 0, cu = nb.colUp || 'rgba(46,232,106,.13)', cd = nb.colDn || 'rgba(255,91,110,.13)';
  g.save();
  let seg = [], signo = null;
  const flush = () => { if (seg.length >= 2) { g.beginPath(); g.moveTo(seg[0].x, seg[0].ya); for (let k = 1; k < seg.length; k++) g.lineTo(seg[k].x, seg[k].ya); for (let k = seg.length - 1; k >= 0; k--) g.lineTo(seg[k].x, seg[k].yb); g.closePath(); g.fillStyle = seg[0].av >= seg[0].bv ? cu : cd; g.fill(); } seg = []; };
  for (let i = 0; i < velas.length; i++) {
    const av = a[i], bv = b[i]; if (av == null || bv == null) { flush(); signo = null; continue; }
    const x = XL(i + sh); if (x == null) { flush(); signo = null; continue; }
    const ya = Yp(av), yb = Yp(bv); if (ya == null || yb == null) { flush(); signo = null; continue; }
    const s = av >= bv ? 1 : -1;
    const punto = { x, ya, yb, av, bv };
    if (signo != null && s !== signo) { seg.push(punto); flush(); }
    seg.push(punto); signo = s;
  }
  flush();
  g.restore();
}
/* Etiqueta del oscilador (nombre + ultimo valor), arriba a la izquierda de SU
   panel nativo, como en TradingView. Con sombra para que lea sobre la linea. */
function fmtOsc(v) { const a = Math.abs(v); return a >= 1000 ? v.toFixed(0) : a >= 1 ? v.toFixed(2) : v.toFixed(4); }
/* Etiqueta del oscilador en SU panel (abajo): ahora es un chip DOM con el MISMO
   estilo que los de arriba (incluida su X bien alineada), no texto pintado a mano.
   Se posiciona en la cabecera del sub panel y se cierra desde ahi tambien. */
function actualizarOscLeg(pane) {
  if (!pane.body) return;
  let el = pane.oscLeg;
  if (!pane.oscK || !pane._oscMounted) { if (el) el.style.display = 'none'; return; }
  let h0 = null; try { h0 = pane.chart.panes()[0].getHeight(); } catch (_) {}
  if (h0 == null) { if (el) el.style.display = 'none'; return; }
  const def = buscarInd(pane.oscK); if (!def) { if (el) el.style.display = 'none'; return; }
  const c = cfgDe(pane, pane.oscK), nom = nomInd(def, c);
  if (!el) { el = document.createElement('div'); el.className = 'mc-chip mc-oscleg'; pane.body.appendChild(el); pane.oscLeg = el; }
  if (el._nom !== nom) {
    el._nom = nom; el.style.color = c.col;
    el.innerHTML = `<i style="background:${c.col}"></i><span class="mc-oscnm">${nom}</span><span class="mc-oscval"></span><button class="mc-chipx" title="Quitar indicador">${IC.x}</button>`;
    const bx = el.querySelector('.mc-chipx'); if (bx) bx.onclick = (e) => { e.stopPropagation(); quitarInd(pane, pane.oscK); };
    el.onclick = (e) => { if (e.target.closest('.mc-chipx')) return; abrirBarraDe(pane, pane.oscK); };
  }
  const vspan = el.querySelector('.mc-oscval'); if (vspan) vspan.textContent = (pane._oscLast != null ? '  ' + fmtOsc(pane._oscLast) : '');
  el.style.left = '8px'; el.style.top = (h0 + 6) + 'px'; el.style.display = '';
}

/* ── Capa UX: trazos (solo lectura en no enfocados) + líneas cruzadas ── */
function dibujarUX(pane) {
  const ux = pane.ux, body = pane.body; if (!ux || !body) return;
  const W = body.clientWidth, H = body.clientHeight; if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (ux.width !== Math.round(W * dpr)) { ux.width = Math.round(W * dpr); ux.height = Math.round(H * dpr); ux.style.width = W + 'px'; ux.style.height = H + 'px'; }
  const g = ux.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (pane !== S.focus) dibujosRO(pane, g);
  const now = performance.now();
  S.vlines.forEach((vl) => { const x = safeX(pane, vl.time); if (x == null) return; const a = vl.t0 ? Math.min(1, (now - vl.t0) / 360) : 1; lineaVert(g, x, W, H, a, false, fmtFecha(vl.time), vl.col, vl.gr); });
  S.hlines.forEach((hl) => { const y = hl.frac * H; const a = hl.t0 ? Math.min(1, (now - hl.t0) / 360) : 1; lineaHorz(g, y, W, a, priceAt(pane, y), false, hl.col, hl.gr); });
  if (S.tool === 'vline' && S.preview && S.preview.time != null) { const x = safeX(pane, S.preview.time); if (x != null) lineaVert(g, x, W, H, 0.65, true, fmtFecha(S.preview.time), '#E8B84B', 2); }
  if (S.tool === 'hline' && S.preview && S.preview.frac != null) { const y = S.preview.frac * H; lineaHorz(g, y, W, 0.6, priceAt(pane, y), true, '#2ee8c6', 2); }
  // Ordenes/alertas/posiciones del usuario sobre esta gráfica (mismo estilo que el resto del área)
  if (_od) { const gd = geoDibPane(pane); if (gd) { try { pane._zonasOd = _od.pintar(g, { x1: gd.x1, y1: gd.y1, Y: gd.Y, pMin: gd.pMin, pMax: gd.pMax, simbolo: (pane.par.s || pane.par.id + 'USDT') }) || []; } catch (_) { pane._zonasOd = []; } } else pane._zonasOd = []; }
  if (pane._draw) dibujarTrazo(g, pane._draw);     // trazo del lapiz en curso
  actualizarOscLeg(pane);                          // etiqueta (chip) del oscilador abajo, con su X
}
function dibujosRO(pane, g) {
  const lista = pane.dibCache; if (!lista || !lista.length) return;
  const geo = geoDibPane(pane); if (!geo) return;
  const s = { geo: NIV._geo, velas: NIV.velas, dib: NIV.dibujos, sel: NIV.sel, cur: NIV.dib, goma: NIV.gomaBox };
  NIV._geo = geo; NIV.velas = pane.velasMs; NIV.dibujos = lista; NIV.sel = -1; NIV.dib = null; NIV.gomaBox = null;
  try { dibujarHerramientas(g, geo.x1, geo.y1); } catch (_) {}
  NIV._geo = s.geo; NIV.velas = s.velas; NIV.dibujos = s.dib; NIV.sel = s.sel; NIV.dib = s.cur; NIV.gomaBox = s.goma;
}
function lineaVert(g, x, W, H, a, preview, label, col, gr) {
  col = col || '#E8B84B';
  g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = preview ? 1 : (gr || 2); g.shadowColor = col; g.shadowBlur = preview ? 4 : 8;
  if (preview) g.setLineDash([5, 5]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  g.setLineDash([]); g.shadowBlur = 0;
  if (label) {   // etiqueta con la FECHA/hora exacta (para situarla, p. ej. "28 Nov 15:00")
    g.font = '700 10px "IBM Plex Mono", monospace';
    const tw = g.measureText(label).width + 12; let lx = x - tw / 2; lx = Math.max(2, Math.min(lx, W - tw - 2)); const ly = H - 32;
    g.globalAlpha = Math.min(1, a + 0.2); redondea(g, lx, ly, tw, 17, 5); g.fillStyle = 'rgba(12,14,18,.96)'; g.fill(); g.strokeStyle = col; g.lineWidth = 1; g.stroke();
    g.fillStyle = col; g.textAlign = 'left'; g.fillText(label, lx + 6, ly + 12);
  }
  g.restore();
}
function lineaHorz(g, y, W, a, price, preview, col, gr) {
  col = col || '#2ee8c6';
  g.save(); g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = preview ? 1 : (gr || 2); g.shadowColor = col; g.shadowBlur = preview ? 4 : 8;
  if (preview) g.setLineDash([5, 5]); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  if (price != null) { const t = fmtNum(price); g.setLineDash([]); g.shadowBlur = 0; g.font = '700 10px "IBM Plex Mono", monospace'; const tw = g.measureText(t).width + 10; g.fillStyle = 'rgba(12,14,18,.95)'; g.fillRect(W - tw - 4, y - 8, tw, 16); g.fillStyle = col; g.textAlign = 'left'; g.fillText(t, W - tw + 1, y + 3); }
  g.restore();
}
function safeX(pane, timeSec) {
  try {
    const ts = pane.chart.timeScale();
    let c = ts.timeToCoordinate(timeSec);
    if (c != null) return c;
    const vt = valorEnTiempo(pane, timeSec); if (!vt) return null;   // otra temporalidad: cae en la vela más cercana
    c = ts.timeToCoordinate(vt.time); return c == null ? null : c;
  } catch (_) { return null; }
}
// vela más cercana en el TIEMPO (sirve para sincronizar entre temporalidades distintas)
function valorEnTiempo(pane, t) {
  const v = pane.velas; if (!v || !v.length) return null;
  if (t <= v[0].time) return { time: v[0].time, price: v[0].close };
  if (t >= v[v.length - 1].time) return { time: v[v.length - 1].time, price: v[v.length - 1].close };
  let lo = 0, hi = v.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (v[m].time === t) return { time: v[m].time, price: v[m].close }; if (v[m].time < t) lo = m + 1; else hi = m - 1; }
  const a = v[Math.max(0, hi)], b = v[Math.min(v.length - 1, lo)];
  const pick = (Math.abs(a.time - t) <= Math.abs(b.time - t)) ? a : b;
  return { time: pick.time, price: pick.close };
}
// aplica a 'o' el mismo RANGO DE TIEMPO visible, recortado a sus datos (si no solapan, no toca: evita el colapso a pocas velas)
function aplicarRango(o, rango) {
  try {
    const v = o.velas; if (!v || v.length < 2) return;
    const min = v[0].time, max = v[v.length - 1].time;
    let from = rango.from, to = rango.to;
    if (!(to > from) || to < min || from > max) return;
    from = Math.max(from, min); to = Math.min(to, max);
    if (to - from < 1) return;
    o.chart.timeScale().setVisibleRange({ from, to });
  } catch (_) {}
}

/* ── Geometría para la barra de dibujo (igual que el Trading Demo) ── */
function geoDibPane(pane) {
  const chart = pane.chart, serie = pane.serie, body = pane.body;
  if (!chart || !serie || !body || !pane.velas.length) return null;
  let ts; try { ts = chart.timeScale(); } catch (_) { return null; }
  const W = body.clientWidth, H = body.clientHeight;
  let x1; try { x1 = ts.width(); } catch (_) { x1 = W; } if (!(x1 > 0)) x1 = W;
  let y1 = H; try { const pn = chart.panes(); y1 = (pn && pn[0]) ? pn[0].getHeight() : H; } catch (_) { y1 = H; } if (!(y1 > 0)) y1 = H;
  let vr; try { vr = ts.getVisibleLogicalRange(); } catch (_) { vr = null; } if (!vr) return null;
  const nV = pane.velas.length;
  const iA = Math.max(0, Math.min(nV - 1, Math.ceil(vr.from))), iB = Math.max(0, Math.min(nV - 1, iA + 1));
  let paso, b; const xA = ts.logicalToCoordinate(iA), xB = ts.logicalToCoordinate(iB);
  if (xA == null || xB == null || iB === iA) { paso = (ts.options().barSpacing) || 6; b = (xA != null) ? xA - paso * iA : 0; }
  else { paso = (xB - xA) / (iB - iA); b = xA - paso * iA; }
  if (!(paso > 0)) paso = 6;
  const pri = 0.5 - b / paso, ancho = x1 / paso, fin = pri + ancho;
  const pMax = serie.coordinateToPrice(0), pMin = serie.coordinateToPrice(y1);
  if (pMax == null || pMin == null) return null;
  const Y = (p) => { const c = serie.priceToCoordinate(p); return (c == null) ? (y1 * (pMax - p) / ((pMax - pMin) || 1)) : c; };
  return { W, H, x1, y1, pMin, pMax, Y, ancho, paso, fin };
}
let _focusPend = false;
function sincronizarFocus() {
  if (!S.focus || !S.focus.barra) return;
  if (_focusPend) return; _focusPend = true;
  requestAnimationFrame(() => { _focusPend = false; refrescarShareSigTodas(); const p = S.focus; if (!p || !p.barra) return; const g = geoDibPane(p); if (g) { try { p.barra.redibujar(g, p.velas.map((v) => ({ t: v.time, o: v.open, h: v.high, l: v.low, c: v.close, v: v.volume })), p.par.id); } catch (_) {} } });
}
function sincronizarStrips() {
  S.paneles.forEach((p) => { const st = p.body.querySelector('.nv-tools'); if (st) st.querySelectorAll('.nv-tool[data-h]').forEach((o) => o.classList.toggle('on', o.dataset.h === NIV.herr)); });
}

/* ── Enfoque: la barra de dibujo VIVA actúa sobre el panel enfocado ── */
function enfocar(pane) {
  if (S.focus === pane) return;
  const prev = S.focus;
  S.focus = pane;
  S.paneles.forEach((p) => p.el.classList.toggle('mc-focus', p === pane));
  if (prev) { const cvh = prev.body.querySelector('.nv-cvh'); if (cvh) { const g = cvh.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cvh.width, cvh.height); } prev.dibCache = cargarDibDe(prev.par.id); }
  NIV.seccion = 'multi'; NIV.par = pane.par.id;
  sincronizarFocus();
}
function cargarDibDe(coin) { try { const m = JSON.parse(localStorage.getItem('cco-dibujos') || '{}'); const a = m['multi|' + coin]; return Array.isArray(a) ? a : []; } catch (_) { return []; } }

/* ── Controles del panel ── */
function wirePane(pane) {
  const q = (s) => pane.el.querySelector(s);
  q('[data-coin]').onclick = (e) => { e.stopPropagation(); alternarMenu(q('[data-coin]'), () => menuMonedas(pane, q('[data-coin]'))); };
  q('[data-tf]').onclick = (e) => { e.stopPropagation(); alternarMenu(q('[data-tf]'), () => menuTf(pane, q('[data-tf]'))); };
  q('[data-ind]').onclick = (e) => { e.stopPropagation(); menuInd(pane); };
  const ftBtn = q('[data-ft]'); pane._ftBtn = ftBtn; ftBtn.onclick = (e) => { e.stopPropagation(); menuFT(pane, ftBtn); };
  q('[data-share]').onclick = () => guardarImagenPanel(pane);
  const shBtn = q('[data-sharesig]'); pane._shareSigBtn = shBtn || null;
  if (shBtn) shBtn.onclick = (e) => { e.stopPropagation(); compartirSenalMC(pane); };
  q('[data-full]').onclick = () => fullPane(pane);
  q('[data-fsback]').onclick = () => { if (pane.max) fullPane(pane); };   // Back solo sale en fullscreen: vuelve a la rejilla
  q('[data-goright]').onclick = () => irAlPresente(pane);
  q('[data-close]').onclick = () => { if (pane.max) fullPane(pane); else cerrarPane(pane); };   // en full screen la X vuelve al tamano pequeno; solo elimina estando chico
  // enfocar al interactuar con el cuerpo (si no hay herramienta cruzada armada)
  pane.body.addEventListener('mousedown', () => { if (!S.tool) enfocar(pane); }, true);
  const cap = pane.body.querySelector('.mc-cap');
  cap.addEventListener('mousemove', (e) => {
    const r = cap.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (S.tool === 'vline') S.preview = { time: timeAt(pane, x) };
    else if (S.tool === 'hline') S.preview = { frac: y / ((pane.body.clientHeight) || 1) };
  });
  cap.addEventListener('mouseleave', () => { S.preview = null; });
  cap.addEventListener('click', (e) => {
    const r = cap.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    // al COLOCAR una línea: se desarma la herramienta y sale la MISMA ventanita de ajustes
    // (color, grosor, papelera) igual que en la barra de dibujo. Nada de "clic para quitar".
    if (S.tool === 'vline') { colocarVLine(pane, x); desarmarTool(); abrirAjustesLinea(pane, { tipo: 'v', idx: S.vlines.length - 1 }, e.clientX, e.clientY); }
    else if (S.tool === 'hline') { colocarHLine(pane, y); desarmarTool(); abrirAjustesLinea(pane, { tipo: 'h', idx: S.hlines.length - 1 }, e.clientX, e.clientY); }
    else if (pane._hit) abrirAjustesLinea(pane, pane._hit, e.clientX, e.clientY);   // clic sobre una línea puesta → su ventanita
    else if (pane._hitInd) abrirBarraDe(pane, pane._hitInd);                        // clic sobre la linea de un indicador → su barra
  });
  // sin herramienta armada: detecta el cursor sobre una línea ya colocada (manita + clic)
  pane.body.addEventListener('mousemove', (e) => {
    if (S.tool || NIV.herr !== 'cursor') { cap.classList.remove('hit', 'ftover', 'ftdraw'); pane._hit = null; pane._hitInd = null; return; }
    const r = pane.body.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (pane.ftTool === 'draw') { cap.classList.add('ftdraw'); cap.classList.remove('ftover', 'hit'); pane._hit = null; pane._hitInd = null; return; }
    cap.classList.remove('ftdraw');
    if (pane.ftTool) { const g = hitReshape(pane, x, y); cap.classList.toggle('ftover', !!g); cap.classList.remove('hit'); pane._hit = null; pane._hitInd = null; return; }
    cap.classList.remove('ftover');
    const hit = hitLine(pane, x, y);
    pane._hit = hit;
    pane._hitInd = hit ? null : hitInd(pane, x, y);          // manita tambien sobre la propia linea del indicador
    cap.classList.toggle('hit', !!(hit || pane._hitInd));
  });
  // Free Transform (herramienta global). 'draw' = dibujas y se monta el indicador
  // real mas parecido. 'reshape' = escultura LIBRE: agarras la linea y la llevas a
  // donde quieras (en cualquier direccion); la forma persiste con las velas y el
  // numero (periodo) se reajusta en vivo. 'smooth' = ajusta el suavizado.
  let ftDrag = null;
  pane.body.addEventListener('mousedown', (e) => {
    if (!pane.ftTool || S.tool) return;
    const r = pane.body.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (pane.ftTool === 'draw') { e.preventDefault(); e.stopPropagation(); pane._draw = { pts: [{ x, y }], badge: null, _t: 0 }; cap.classList.add('ftgrab'); return; }
    const grab = hitReshape(pane, x, y); if (!grab) return;
    e.preventDefault(); e.stopPropagation();
    const c0 = cfgDe(pane, grab.key);
    // Capturo la curva SIN el warp actual (ref) y el warp ya existente (base). Asi,
    // al arrastrar, muevo un BULTO de masa en 2D sobre esa base (plastilina).
    let ref = null, base = null, shift = 0;
    if (!grab.osc) { const o = ((pane.ind && pane.ind.ovl) || []).find((z) => z.id === grab.key && (z.li || 0) === grab.li); if (o && o.data) { shift = o.shift || 0; const bw = (c0.warp && c0.warp[grab.li]) || []; ref = o.data.map((v, i) => v == null ? null : v - (bw[i] || 0)); base = o.data.map((_, i) => bw[i] || 0); } }
    else { const od = pane._oscData, arr = od ? (grab.li === 0 ? od.serie : grab.li === 1 ? od.serie2 : od.serie3) : null; if (arr) { const bw = (c0.warp && c0.warp[grab.li]) || []; ref = arr.map((v, i) => v == null ? null : v - (bw[i] || 0)); base = arr.map((_, i) => bw[i] || 0); } }
    const ab = ftBarIdx(pane, x);                       // barra EXACTA que se agarra: queda anclada
    const anchor = (ab == null) ? null : Math.max(0, Math.round(ab) - (grab.osc ? 0 : shift));
    ftDrag = { key: grab.key, li: grab.li, osc: grab.osc, tool: pane.ftTool, gy: y, suave0: (c0.suave || 0), ref, base, shift, anchor };
    cap.classList.add('ftgrab');
  }, true);
  window.addEventListener('mousemove', (e) => {
    const r = pane.body.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    if (pane._draw) {
      const last = pane._draw.pts[pane._draw.pts.length - 1];
      if (!last || Math.hypot(x - last.x, y - last.y) >= 2) pane._draw.pts.push({ x, y });
      return;
    }
    if (!ftDrag) return;
    aplicarReshape(pane, ftDrag, x, y); recalc(pane);
  });
  window.addEventListener('mouseup', () => {
    if (pane._draw) { const pts = pane._draw.pts; pane._draw = null; cap.classList.remove('ftgrab'); if (pts.length > 4) { try { montarTrazo(pane, pts); } catch (_) {} } return; }
    if (ftDrag) { ftDrag = null; cap.classList.remove('ftgrab'); }
  });
  if (pane.flotante) arrastrar(pane);
  cablearOrdenPane(pane);
}
/* Clic derecho sobre la gráfica del panel: Set Position / Alerta. Si orden.js aún
   no cargó, reintenta. conectar marca el body para no cablear dos veces. */
function cablearOrdenPane(pane) {
  if (!pane || !pane.body) return;
  if (!_od) { setTimeout(() => cablearOrdenPane(pane), 200); return; }
  if (pane.body.dataset.ordenLista) return;
  _od.conectar({
    canvas: pane.body,
    capturaDoc: true,
    precioEn: (y) => { const p = priceAt(pane, y); return (p != null && p > 0) ? p : 0; },
    precioActual: () => (pane.velas && pane.velas.length) ? pane.velas[pane.velas.length - 1].close : 0,
    par: () => pane.par.id,
    simbolo: () => pane.par.s || (pane.par.id + 'USDT'),
    repintar: () => {}
  });
  _od.clicCancelar(pane.body, () => pane._zonasOd || [], () => {});
}
// ¿el cursor está sobre una línea V u H de esta gráfica?
function hitLine(pane, x, y) {
  const H = pane.body.clientHeight || 1;
  for (let i = 0; i < S.vlines.length; i++) { const lx = safeX(pane, S.vlines[i].time); if (lx != null && Math.abs(lx - x) < 6) return { tipo: 'v', idx: i }; }
  for (let i = 0; i < S.hlines.length; i++) { const ly = S.hlines[i].frac * H; if (Math.abs(ly - y) < 6) return { tipo: 'h', idx: i }; }
  return null;
}
/* ¿el cursor está sobre la LÍNEA de un indicador? Devuelve su id (para abrir su barra). */
function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy; if (!l2) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function hitInd(pane, x, y) {
  const ind = pane.ind; if (!ind) return null;
  const H = pane.body.clientHeight || 1, v = pane.velas;
  // oscilador: SOLO su linea es tocable (manito), no todo el panel; asi sus ejes
  // conservan los cursores de resize (ns-resize / ew-resize) de la libreria.
  if (pane.oscK && pane._oscMounted && pane.oscSeries && pane._oscData) {
    let h0 = null; try { h0 = pane.chart.panes()[0].getHeight(); } catch (_) {}
    if (h0 != null && y >= h0) {
      const ts2 = pane.chart.timeScale();
      const XL2 = (idx) => { try { const cc = ts2.logicalToCoordinate(idx); return cc == null ? null : cc; } catch (_) { return null; } };
      const pares = [[pane._oscData.serie, pane.oscSeries.main], [pane._oscData.serie2, pane.oscSeries.s2], [pane._oscData.serie3, pane.oscSeries.s3]];
      for (const par of pares) {
        const arr = par[0], ser = par[1]; if (!arr || !ser) continue;
        let px = null, py = null;
        for (let i = 0; i < v.length; i++) { const val = arr[i]; if (val == null) { px = null; continue; } const cx = XL2(i); if (cx == null) { px = null; continue; } let cy; try { cy = ser.priceToCoordinate(val); } catch (_) { cy = null; } if (cy == null) { px = null; continue; } cy += h0; if (px != null) { const a = Math.min(px, cx) - 3, b = Math.max(px, cx) + 3; if (x >= a && x <= b && distSeg(x, y, px, py, cx, cy) < 5) return pane.oscK; } px = cx; py = cy; }
      }
      return null;
    }
  }
  // overlays: cerca de alguna de sus polilineas
  const ts = pane.chart.timeScale();
  const XL = (idx) => { try { const c = ts.logicalToCoordinate(idx); return c == null ? null : c; } catch (_) { return null; } };
  const Yp = (p) => { try { const c = pane.serie.priceToCoordinate(p); return c == null ? null : c; } catch (_) { return null; } };
  for (const o of (ind.ovl || [])) {
    if (!o.data) continue;
    const sh = o.shift || 0; let px = null, py = null;
    for (let i = 0; i < v.length; i++) {
      const val = o.data[i]; if (val == null) { px = null; continue; }
      const cx = XL(i + sh); if (cx == null) { px = null; continue; }
      const cy = Yp(val); if (cy == null) { px = null; continue; }
      if (o.dots) { if (Math.hypot(x - cx, y - cy) < 6) return o.id; }
      else if (px != null) { const a = Math.min(px, cx) - 3, b = Math.max(px, cx) + 3; if (x >= a && x <= b && distSeg(x, y, px, py, cx, cy) < 5) return o.id; }
      px = cx; py = cy;
    }
  }
  return null;
}
/* ── TRANSFORMACION LIBRE: esculpir la linea del indicador sobre la grafica ──
   Agarras la linea y la moldeas; la escultura (warp) se guarda en la config y se
   sigue aplicando en vivo (recalc la vuelve a sumar cada frame, incluidas las velas
   nuevas). Novedad real: no la trae ningun otro indicador. */
function hitFT(pane, x, y) {
  const fk = pane.ftKey; if (!fk) return null; const v = pane.velas; if (!v || !v.length) return null;
  const ts = pane.chart.timeScale();
  const XL = (idx) => { try { const c = ts.logicalToCoordinate(idx); return c == null ? null : c; } catch (_) { return null; } };
  if (!fk.osc) {
    const Yp = (p) => { try { const c = pane.serie.priceToCoordinate(p); return c == null ? null : c; } catch (_) { return null; } };
    for (const o of ((pane.ind && pane.ind.ovl) || [])) { if (o.id !== fk.key || !o.data) continue;
      const sh = o.shift || 0; let px = null, py = null;
      for (let i = 0; i < v.length; i++) { const val = o.data[i]; if (val == null) { px = null; continue; } const cx = XL(i + sh); if (cx == null) { px = null; continue; } const cy = Yp(val); if (cy == null) { px = null; continue; }
        if (px != null) { const a = Math.min(px, cx) - 3, b = Math.max(px, cx) + 3; if (x >= a && x <= b && distSeg(x, y, px, py, cx, cy) < 8) return { li: o.li || 0, osc: false }; } px = cx; py = cy; } }
    return null;
  }
  let h0 = null; try { h0 = pane.chart.panes()[0].getHeight(); } catch (_) {}
  if (h0 == null || y < h0 || !pane.oscSeries || !pane._oscData) return null;
  const pares = [[pane._oscData.serie, pane.oscSeries.main, 0], [pane._oscData.serie2, pane.oscSeries.s2, 1], [pane._oscData.serie3, pane.oscSeries.s3, 2]];
  for (const par of pares) { const arr = par[0], ser = par[1]; if (!arr || !ser) continue; let px = null, py = null;
    for (let i = 0; i < v.length; i++) { const val = arr[i]; if (val == null) { px = null; continue; } const cx = XL(i); if (cx == null) { px = null; continue; } let cy; try { cy = ser.priceToCoordinate(val); } catch (_) { cy = null; } if (cy == null) { px = null; continue; } cy += h0;
      if (px != null) { const a = Math.min(px, cx) - 3, b = Math.max(px, cx) + 3; if (x >= a && x <= b && distSeg(x, y, px, py, cx, cy) < 8) return { li: par[2], osc: true }; } px = cx; py = cy; } }
  return null;
}
function ftBarIdx(pane, x) { try { const lg = pane.chart.timeScale().coordinateToLogical(x); if (lg == null) return null; return Math.max(0, Math.min(pane.velas.length - 1, Math.round(lg))); } catch (_) { return null; } }
function ftPrecio(pane, osc, y) {
  if (!osc) return priceAt(pane, y);
  let h0 = null; try { h0 = pane.chart.panes()[0].getHeight(); } catch (_) {}
  const ser = pane.oscSeries && pane.oscSeries.main; if (!ser || h0 == null) return null;
  try { const p = ser.coordinateToPrice(y - h0); return p == null ? null : p; } catch (_) { return null; }
}
function ftBrush(pane, fk, li, bar, dd) {
  const c = pane.cfg[fk.key]; if (!c) return; if (!c.warp) c.warp = {};
  const n = pane.velas.length, R = Math.max(2, Math.round(n * 0.025));
  let w = c.warp[li]; if (!w || w.length !== n) { const nw = new Array(n).fill(0); if (w) for (let i = 0; i < n; i++) nw[i] = (i < w.length ? w[i] : w[w.length - 1]) || 0; w = c.warp[li] = nw; }
  for (let j = Math.max(0, bar - R); j <= Math.min(n - 1, bar + R); j++) { const t = (j - bar) / R; w[j] += dd * Math.exp(-t * t * 3.2); }
}
/* ── FREE TRANSFORM como sistema global ──────────────────────────────────────
   Reshape: agarras la linea de un indicador y, al moverla, sus PARAMETROS reales
   cambian en vivo (vertical -> periodo, horizontal -> desplazamiento), se re
   etiqueta y PERSISTE con las velas (no es un dibujo encima). Smooth: ajusta el
   suavizado. Omnidireccional. */
function hitReshape(pane, x, y) {
  const v = pane.velas; if (!v || !v.length) return null;
  const ts = pane.chart.timeScale();
  const XL = (idx) => { try { const c = ts.logicalToCoordinate(idx); return c == null ? null : c; } catch (_) { return null; } };
  const Yp = (p) => { try { const c = pane.serie.priceToCoordinate(p); return c == null ? null : c; } catch (_) { return null; } };
  for (const o of ((pane.ind && pane.ind.ovl) || [])) { if (!o.data) continue;
    const sh = o.shift || 0; let px = null, py = null;
    for (let i = 0; i < v.length; i++) { const val = o.data[i]; if (val == null) { px = null; continue; } const cx = XL(i + sh); if (cx == null) { px = null; continue; } const cy = Yp(val); if (cy == null) { px = null; continue; }
      if (o.dots) { if (Math.hypot(x - cx, y - cy) < 7) return { key: o.id, li: o.li || 0, osc: false }; }
      else if (px != null) { const a = Math.min(px, cx) - 3, b = Math.max(px, cx) + 3; if (x >= a && x <= b && distSeg(x, y, px, py, cx, cy) < 8) return { key: o.id, li: o.li || 0, osc: false }; }
      px = cx; py = cy; } }
  let h0 = null; try { h0 = pane.chart.panes()[0].getHeight(); } catch (_) {}
  if (h0 != null && y >= h0 && pane.oscK && pane.oscSeries && pane._oscData) {
    const pares = [[pane._oscData.serie, pane.oscSeries.main, 0], [pane._oscData.serie2, pane.oscSeries.s2, 1], [pane._oscData.serie3, pane.oscSeries.s3, 2]];
    for (const par of pares) { const arr = par[0], ser = par[1]; if (!arr || !ser) continue; let px = null, py = null;
      for (let i = 0; i < v.length; i++) { const val = arr[i]; if (val == null) { px = null; continue; } const cx = XL(i); if (cx == null) { px = null; continue; } let cy; try { cy = ser.priceToCoordinate(val); } catch (_) { cy = null; } if (cy == null) { px = null; continue; } cy += h0;
        if (px != null) { const a = Math.min(px, cx) - 3, b = Math.max(px, cx) + 3; if (x >= a && x <= b && distSeg(x, y, px, py, cx, cy) < 8) return { key: pane.oscK, li: par[2], osc: true }; } px = cx; py = cy; } }
  }
  return null;
}
/* El parametro que gobierna la FORMA del indicador (el que cambia al modular). */
function paramPrincipal(def) {
  if (!def.params || !def.params.length) return null;
  const p = def.params.find((x) => x.k === 'periodo'); if (p) return p;
  return def.params.find((x) => x.max != null && x.min != null) || def.params[0];
}
/* Valor del indicador en una barra, recalculando con un parametro candidato. */
function valorEnIdx(def, velas, cc, li, osc, idx) {
  let r; try { r = def.calc(velas, cc); } catch (_) { return null; }
  let data;
  if (!osc) data = (r.lineas && r.lineas[li]) ? r.lineas[li].data : (r.lineas && r.lineas[0] ? r.lineas[0].data : null);
  else data = li === 0 ? r.serie : li === 1 ? r.serie2 : r.serie3;
  if (!data) return null; const vv = data[idx]; return (vv == null) ? null : vv;
}
/* Busca el valor del parametro principal para que la linea pase por el cursor. */
function ajustarParametro(pane, def, c, li, osc, idx, target) {
  const pd = paramPrincipal(def); if (!pd) return false;
  const lo = pd.min != null ? pd.min : 1, hi = pd.max != null ? pd.max : 400, step = pd.step || 1;
  const cc = Object.assign({}, c);
  let best = c[pd.k], bestErr = Infinity;
  const probar = (p) => { if (p < lo || p > hi) return; cc[pd.k] = p; const val = valorEnIdx(def, pane.velas, cc, li, osc, idx); if (val == null) return; const e = Math.abs(val - target); if (e < bestErr) { bestErr = e; best = p; } };
  const coarse = Math.max(step, (hi - lo) / 48);
  for (let p = lo; p <= hi; p += coarse) probar(p);
  for (let p = best - coarse; p <= best + coarse; p += step) probar(p);
  c[pd.k] = step >= 1 ? Math.round(best) : Math.round(best / step) * step;
  return true;
}
function aplicarReshape(pane, d, x, y) {
  const c = cfgDe(pane, d.key), def = defDe(pane, d.key); if (!def) return;
  if (d.tool === 'smooth') {
    let s = (d.suave0 || 0) + (d.gy - y) * 0.14; s = Math.max(0, Math.min(50, s)); c.suave = Math.round(s); return;
  }
  // RESHAPE = agarrar un PUNTO y jalarlo. El punto que agarraste sigue a tu cursor
  // (arriba o abajo) y la linea se curva suave SOLO a su alrededor. Queda ANCLADO donde
  // lo agarraste: nada de montes que se estiran. Para dar forma a todo, agarras varios
  // puntos, uno por uno. Se guarda (config del indicador) y PERSISTE hacia delante.
  const curP = ftPrecio(pane, d.osc, y);
  if (curP == null || d.anchor == null) return;
  tirarPunto(pane, d, curP);
}
/* Jala el punto anclado (d.anchor) hasta el precio del cursor y curva su vecindad con
   una campana suave y pequeña. Recalcula SIEMPRE desde la base capturada: una sola
   deformacion limpia, sin acumular y sin monte. El ancho va atado al zoom = local. */
function tirarPunto(pane, d, target) {
  const c = cfgDe(pane, d.key), n = pane.velas.length; if (!n || !d.ref || !d.base) return;
  const b0 = d.anchor; if (b0 < 0 || b0 >= n) return;
  const ref0 = d.ref[b0]; if (ref0 == null) return;
  const delta = target - (ref0 + (d.base[b0] || 0));          // cuanto sube o baja el punto agarrado
  let vis = 130; try { const lr = pane.chart.timeScale().getVisibleLogicalRange(); if (lr) vis = Math.max(24, lr.to - lr.from); } catch (_) {}
  const R = Math.max(2.5, Math.min(11, vis * 0.03));          // ancho de la campana, atado al zoom
  const reach = Math.max(3, Math.round(R * 2.8));
  if (!c.warp) c.warp = {};
  let w = c.warp[d.li]; if (!w || w.length !== n) { w = new Array(n); c.warp[d.li] = w; }
  for (let j = 0; j < n; j++) w[j] = d.base[j] || 0;          // parte de la base: UNA sola campana limpia
  const lo = Math.max(0, b0 - reach), hi = Math.min(n - 1, b0 + reach);
  for (let j = lo; j <= hi; j++) { if (d.ref[j] == null) continue; const t = (j - b0) / R; w[j] = (d.base[j] || 0) + delta * Math.exp(-t * t * 0.5); }
}
/* Reparte la forma esculpida entre el periodo base (para que la etiqueta cambie) y
   un warp residual (para que lo que ves NO se altere). Asi recuperamos la libertad
   total de antes y, de paso, el numero se mueve segun la compresion. */
function rebalancear(pane, key, def, li, osc) {
  const pd = paramPrincipal(def); if (!pd) return;
  const c = cfgDe(pane, key), w = c.warp && c.warp[li]; if (!w) return;
  let r; try { r = def.calc(pane.velas, c); } catch (_) { return; }
  const base = osc ? (li === 0 ? r.serie : li === 1 ? r.serie2 : r.serie3) : (r.lineas && r.lineas[li] && r.lineas[li].data);
  if (!base) return;
  const L = w.length;
  const total = base.map((v, i) => v == null ? null : v + (i < L ? (w[i] || 0) : (w[L - 1] || 0)));
  const idxs = []; for (let i = 0; i < L; i++) if (Math.abs(w[i]) > 1e-9) idxs.push(i);
  if (idxs.length < 3) return;
  const lo = pd.min != null ? pd.min : 1, hi = pd.max != null ? pd.max : 400, step = pd.step || 1;
  const cc = Object.assign({}, c); cc.warp = null;
  const valP = (p) => { cc[pd.k] = p; let rr; try { rr = def.calc(pane.velas, cc); } catch (_) { return null; } return osc ? (li === 0 ? rr.serie : li === 1 ? rr.serie2 : rr.serie3) : (rr.lineas && rr.lineas[li] && rr.lineas[li].data); };
  let best = c[pd.k], bestErr = Infinity;
  const probar = (p) => { if (p < lo || p > hi) return; const bd = valP(p); if (!bd) return; let e = 0, n = 0; for (const i of idxs) { const a = bd[i], t = total[i]; if (a == null || t == null) continue; const dd = (a - t) / (Math.abs(t) || 1); e += dd * dd; n++; } if (n < 3) return; e /= n; if (e < bestErr) { bestErr = e; best = p; } };
  const coarse = Math.max(step, (hi - lo) / 40);
  for (let p = lo; p <= hi; p += coarse) probar(p);
  for (let p = best - coarse; p <= best + coarse; p += step) probar(p);
  const np = step >= 1 ? Math.round(best) : Math.round(best / step) * step;
  if (np === c[pd.k]) return;
  const nb = valP(np); if (!nb) return;
  const nw = new Array(L).fill(0);
  for (let i = 0; i < L; i++) { const t = total[i], b = nb[i]; nw[i] = (t == null || b == null) ? 0 : (t - b); }
  c[pd.k] = np; c.warp[li] = nw;
}
function resetShapes(pane) {
  if (pane.cfg) Object.keys(pane.cfg).forEach((k) => { const c = pane.cfg[k]; if (c) { c.desp = 0; c.suave = 0; c.warp = null; } });
  recalc(pane);
}
/* ── LAPIZ: dibujas un trazo y el sistema monta el indicador REAL mas parecido ──
   No "adivina a ciegas": mide el error de tu trazo contra indicadores reales y
   escoge el que mejor encaja (con su periodo). El resultado es un indicador de
   verdad (persiste, se forma con las velas y al clicarlo abre su config). */
function trazoPorBarra(pane, pts) {
  const ts = pane.chart.timeScale();
  const cb = pts.map((p) => { let lg; try { lg = ts.coordinateToLogical(p.x); } catch (_) { lg = null; } return { b: lg, y: p.y }; }).filter((o) => o.b != null);
  if (cb.length < 2) return null;
  cb.sort((a, b) => a.b - b.b);
  const b0 = Math.ceil(cb[0].b), b1 = Math.floor(cb[cb.length - 1].b);
  if (b1 - b0 < 2) return null;
  const bars = [], ys = [];
  for (let b = b0; b <= b1; b++) {
    if (b < 0 || b >= pane.velas.length) continue;
    let y; if (b <= cb[0].b) y = cb[0].y; else if (b >= cb[cb.length - 1].b) y = cb[cb.length - 1].y;
    else { let k = 0; while (k < cb.length - 1 && cb[k + 1].b < b) k++; const a = cb[k], c = cb[k + 1]; const t = (b - a.b) / ((c.b - a.b) || 1); y = a.y + (c.y - a.y) * t; }
    bars.push(b); ys.push(y);
  }
  return bars.length >= 3 ? { bars, ys } : null;
}
function esZonaOsc(pane, pts) {
  let h0 = null; try { h0 = pane.chart.panes()[0].getHeight(); } catch (_) {}
  const ys = pts.map((p) => p.y), yMin = Math.min(...ys), yAvg = ys.reduce((a, b) => a + b, 0) / ys.length;
  if (h0 != null && pane.oscK && yAvg >= h0) return true;                 // dibujado dentro del sub panel existente
  try { let yLow = -1; for (const v of pane.velas) { const yy = pane.serie.priceToCoordinate(v.low); if (yy != null && yy > yLow) yLow = yy; } if (yLow > 0 && yMin > yLow + 8) return true; } catch (_) {}
  return false;                                                          // por defecto, overlay (sobre el precio)
}
function normaliza(arr) { let mn = Infinity, mx = -Infinity; for (const v of arr) { if (v == null) continue; if (v < mn) mn = v; if (v > mx) mx = v; } const rg = (mx - mn) || 1; return arr.map((v) => v == null ? null : (v - mn) / rg); }
function ajustarOverlay(pane, m) {
  const cands = ['ema', 'sma', 'wma', 'hma'];
  const obj = m.ys.map((y) => priceAt(pane, y));
  let best = null;
  for (const id of cands) {
    const def = buscarInd(id); if (!def) continue; const base = cfgInicial(def);
    for (let per = 4; per <= 300; per += (per < 40 ? 3 : 8)) {
      const c = Object.assign({}, base, { periodo: per }); let r; try { r = def.calc(pane.velas, c); } catch (_) { continue; }
      const data = r.lineas && r.lineas[0] && r.lineas[0].data; if (!data) continue;
      let e = 0, n = 0; for (let k = 0; k < m.bars.length; k++) { const val = data[m.bars[k]], o = obj[k]; if (val == null || o == null) continue; const d = (val - o) / (Math.abs(o) || 1); e += d * d; n++; }
      if (n < 3) continue; e = Math.sqrt(e / n); if (!best || e < best.err) best = { id, periodo: per, err: e };
    }
  }
  return best;
}
function ajustarOsc(pane, m) {
  const trazoN = normaliza(m.ys.map((y) => -y));                         // y grande = valor bajo
  const cands = ['rsi', 'cci', 'willr', 'cmo', 'mfi', 'stochrsi', 'roc', 'mom'];
  let best = null;
  for (const id of cands) {
    const def = buscarInd(id); if (!def) continue; const base = cfgInicial(def);
    const pd = (def.params || []).find((p) => p.k === 'periodo'); const pers = pd ? [7, 10, 14, 20, 30] : [null];
    for (const per of pers) {
      const c = Object.assign({}, base); if (per != null) c.periodo = per; let r; try { r = def.calc(pane.velas, c); } catch (_) { continue; }
      const serie = r.serie; if (!serie) continue;
      const sN = normaliza(m.bars.map((b) => serie[b]));
      let e = 0, n = 0; for (let k = 0; k < trazoN.length; k++) { const a = trazoN[k], b = sN[k]; if (a == null || b == null) continue; const d = a - b; e += d * d; n++; }
      if (n < 3) continue; e = Math.sqrt(e / n); if (!best || e < best.err) best = { id, periodo: (per != null ? per : (base.periodo || 14)), err: e };
    }
  }
  return best;
}
function reconocerTrazo(pane, pts) {
  const m = trazoPorBarra(pane, pts); if (!m) return null;
  if (esZonaOsc(pane, pts)) { const o = ajustarOsc(pane, m); return o ? { tipo: 'osc', id: o.id, periodo: o.periodo } : null; }
  const v = ajustarOverlay(pane, m); return v ? { tipo: 'ovl', id: v.id, periodo: v.periodo } : null;
}
function etiquetaRec(rec) { const def = buscarInd(rec.id); if (!def) return null; return def.nom + (rec.periodo ? ' ' + rec.periodo : ''); }
/* def de un indicador: real (libreria) o DIBUJADO (creado con el lapiz). */
function defDe(pane, key) { return (pane.drawDefs && pane.drawDefs[baseId(key)]) || buscarInd(baseId(key)); }
/* def sintetico de un indicador dibujado: su calc DEVUELVE el trazo guardado y lo
   continua hacia el futuro (hold last), asi es un indicador de verdad que persiste
   y se sigue formando con las velas, manteniendo la estructura que dibujaste. */
function emaArr(src, p) { const out = new Array(src.length).fill(null); const k = 2 / (p + 1); let e = null; for (let i = 0; i < src.length; i++) { const x = src[i]; if (x == null) continue; e = (e == null) ? x : x * k + e * (1 - k); out[i] = e; } return out; }
function emaCierre(v, p) { return emaArr(v.map((k) => k.close), p); }
/* Indicador DIBUJADO: el pasado es tu trazo EXACTO; hacia adelante CONTINUA con la
   logica que dibujaste. Se ancla a la media del precio que mejor encaja con tu trazo
   y le suma el 'offset' que dibujaste encima; si ese offset es ciclico, repite el
   ciclo. Asi mantiene la distancia con las velas y sigue detectando los ciclos. */
function defDibujado(key, nom, estilo) {
  return { id: key, nom, grupo: 'Drawn', tipo: 'ovl', estilo, params: [], op: [], _drawn: true,
    calc: (v, c) => {
      const n = v.length, dr = c.drawn || [], out = new Array(n).fill(null);
      const bFirst = c.drawFirst || 0, bLast = (c.drawLast != null ? c.drawLast : dr.length - 1);
      for (let i = bFirst; i <= bLast && i < n; i++) out[i] = (i < dr.length ? dr[i] : null);
      if (c.drawBase != null && n > bLast + 1) {
        const em = emaCierre(v, c.drawBase), w = c.drawW || 0, c1 = c.drawC1 || 0, c2 = c.drawC2 || 0, K = c.drawK || 0;
        const dL = dr[bLast], slope = (dL != null && dr[bLast - 3] != null) ? (dL - dr[bLast - 3]) / 3 : 0;
        const blendT = Math.min(16, Math.max(4, Math.round((w ? (2 * Math.PI / w) : 10) / 2)));
        for (let i = bLast + 1; i < n; i++) {
          const base = em[i]; if (base == null) { out[i] = dL; continue; }
          const model = base + K + (w ? (c1 * Math.cos(w * i) + c2 * Math.sin(w * i)) : 0), k = i - bLast;
          out[i] = (k <= blendT && dL != null) ? ((dL + slope * k) * (1 - k / blendT) + model * (k / blendT)) : model;   // crossfade tangente en la union
        }
      } else { const last = dr[bLast]; for (let i = bLast + 1; i < n; i++) out[i] = last; }
      return { lineas: [{ data: out }] };
    } };
}
/* Detecta el periodo del CICLO de un segmento (autocorrelacion tras quitar su tendencia). */
function periodoCicloSeg(seg) {
  const L = seg.length; if (L < 14) return 0;
  const tr = emaArr(seg, Math.max(8, Math.round(L / 4)));
  const a = seg.map((v, i) => (v != null && tr[i] != null) ? v - tr[i] : 0);
  let den = 0; for (const x of a) den += x * x; if (den < 1e-9) return 0;
  let best = 0, bestC = 0; const maxLag = Math.floor(L / 2);
  for (let lag = 4; lag <= maxLag; lag++) { let num = 0; for (let i = 0; i + lag < L; i++) num += a[i] * a[i + lag]; const c = num / den; if (c > bestC) { bestC = c; best = lag; } }
  return bestC > 0.3 ? best : 0;
}
/* El LAPIZ: tu trazo se vuelve un indicador real que ademas APRENDE su logica para
   seguir hacia adelante (ancla al precio + offset + ciclo). */
function montarTrazo(pane, pts) {
  const m = trazoPorBarra(pane, pts); if (!m) { try { toast('Draw a longer line on the chart.'); } catch (_) {} return; }
  const n = pane.velas.length, drawn = new Array(n).fill(null);
  const bFirst = m.bars[0], bLast = m.bars[m.bars.length - 1];
  for (let k = 0; k < m.bars.length; k++) { const b = m.bars[k], price = priceAt(pane, m.ys[k]); if (b >= 0 && b < n && price != null) drawn[b] = price; }
  let lastV = null, lastI = -1;                       // interpola huecos internos
  for (let i = bFirst; i <= bLast; i++) { if (drawn[i] != null) { if (lastI >= 0 && i - lastI > 1) for (let j = lastI + 1; j < i; j++) { const t = (j - lastI) / (i - lastI); drawn[j] = lastV + (drawn[i] - lastV) * t; } lastV = drawn[i]; lastI = i; } }
  // aprende la logica para continuar: tendencia suave de la linea + ciclo (sinusoide) + anclaje al precio
  const Loff = bLast - bFirst + 1, seg = [];
  for (let i = bFirst; i <= bLast; i++) seg.push(drawn[i]);
  const per = periodoCicloSeg(seg);
  const trend = emaArr(seg, Math.max(8, Math.round((per || 16) * 1.4)));
  const offs = seg.map((v, i) => (v != null && trend[i] != null) ? v - trend[i] : 0);
  let w = 0, c1 = 0, c2 = 0;
  if (per >= 2) { w = 2 * Math.PI / per; let Scc = 0, Sss = 0, Scs = 0, Syc = 0, Sys = 0; for (let k = 0; k < Loff; k++) { const i = bFirst + k, ci = Math.cos(w * i), si = Math.sin(w * i); Scc += ci * ci; Sss += si * si; Scs += ci * si; Syc += offs[k] * ci; Sys += offs[k] * si; } const det = Scc * Sss - Scs * Scs; if (Math.abs(det) > 1e-9) { c1 = (Syc * Sss - Sys * Scs) / det; c2 = (Scc * Sys - Scs * Syc) / det; } }
  const baseP = Math.min(120, Math.max(16, Math.round((per || 16) * 1.6)));
  const emaC = emaCierre(pane.velas, baseP);
  const K = (trend[Loff - 1] != null && emaC[bLast] != null) ? trend[Loff - 1] - emaC[bLast] : 0;
  if (!pane.drawDefs) pane.drawDefs = {};
  let num = 1; while (pane.ovl.has('draw' + num)) num++;
  const key = 'draw' + num;
  pane.drawDefs[key] = defDibujado(key, 'Drawn ' + num, { col: '#E8B84B', gr: 2, dash: false });
  if (!pane.cfg) pane.cfg = {};
  const c = cfgInicial(pane.drawDefs[key]);
  c.drawn = drawn; c.drawFirst = bFirst; c.drawLast = bLast; c.drawBase = baseP; c.drawK = K; c.drawW = w; c.drawC1 = c1; c.drawC2 = c2;
  pane.cfg[key] = c; pane.ovl.add(key);
  recalc(pane); marcarBtnInd(pane);
  try { toast(per ? ('Drawn indicator · cycle ~' + per + ' bars, keeps going') : 'Drawn indicator · follows the price forward'); } catch (_) {}
}
function montarReconocido(pane, rec) {
  if (!rec) { try { toast('Draw a clearer shape to recognise an indicator.'); } catch (_) {} return; }
  const def = buscarInd(rec.id); if (!def) return;
  if (rec.tipo === 'ovl') {
    let key = rec.id; if (pane.ovl.has(key)) { let n = 2; while (pane.ovl.has(rec.id + '#' + n)) n++; key = rec.id + '#' + n; }
    pane.ovl.add(key); const c = cfgDe(pane, key); if (rec.periodo) c.periodo = rec.periodo;
    recalc(pane); marcarBtnInd(pane); try { toast('Mounted ' + nombreInst(def, c, key)); } catch (_) {}
  } else {
    pane.oscK = rec.id; const c = cfgDe(pane, pane.oscK); if (rec.periodo) c.periodo = rec.periodo;
    recalc(pane); marcarBtnInd(pane); try { toast('Mounted ' + nomInd(def, c)); } catch (_) {}
  }
}
function dibujarTrazo(g, draw) {
  const pts = draw.pts; if (!pts || pts.length < 2) return;
  g.save(); g.strokeStyle = 'rgba(232,184,75,.95)'; g.lineWidth = 2.2; g.lineJoin = 'round'; g.lineCap = 'round'; g.shadowColor = 'rgba(232,184,75,.55)'; g.shadowBlur = 7;
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y); g.stroke(); g.shadowBlur = 0;
  if (draw.badge) { const last = pts[pts.length - 1], tx = last.x + 12, ty = last.y - 12;
    g.font = '800 11px "IBM Plex Mono", monospace'; const w = g.measureText(draw.badge).width + 16;
    g.fillStyle = 'rgba(16,21,28,.96)'; g.strokeStyle = 'rgba(232,184,75,.6)'; g.lineWidth = 1;
    g.beginPath(); roundRectPath(g, tx, ty - 11, w, 22, 6); g.fill(); g.stroke();
    g.fillStyle = '#E8B84B'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(draw.badge, tx + 8, ty + 0.5);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }
  g.restore();
}
/* Pildora flotante que muestra la herramienta activa con una X para APAGARLA sin
   tener que volver a abrir el menu Free Transform. */
function actualizarPildoraFT(pane) {
  let pill = pane.ftPill;
  if (!pane.ftTool) { if (pill) { pill.remove(); pane.ftPill = null; } return; }
  const btn = pane._ftBtn; if (!btn) return;
  const info = { draw: [IC.pencil, 'Draw'], reshape: [IC.hand, 'Reshape'], smooth: [IC.wave, 'Smooth'] }[pane.ftTool] || ['', 'Tool'];
  if (!pill) { pill = document.createElement('div'); pill.className = 'mc-ftpill'; document.body.appendChild(pill); pane.ftPill = pill; }
  pill.innerHTML = `<span class="mc-ftpill-ic">${info[0]}</span><b>${info[1]}</b><span class="mc-ftpill-t">on</span><button class="mc-ftpill-x" title="Turn off">${IC.x}</button>`;
  pill.querySelector('.mc-ftpill-x').onclick = () => { pane.ftTool = null; btn.classList.remove('on'); sincronizarFT(pane); actualizarPildoraFT(pane); };
  const r = btn.getBoundingClientRect();
  pill.style.left = Math.max(8, Math.min(innerWidth - 150, r.left)) + 'px';
  pill.style.top = (r.bottom + 7) + 'px';
}
/* ── "How it works": presentacion de lo que hace poderosa a Multichart ── */
const PASOS_MC = [
  {
    t: 'Infinite charts on one screen',
    d: 'Add as many charts as you want with <b>Add chart</b>. As many screens as you have, that many charts you get. Every chart is independent, with its own coin, timeframe, indicators and tools, all live at the same time.',
    x: 'Build a full trading desk in one view instead of flipping between tabs.'
  },
  {
    t: 'One coin, every timeframe at once',
    d: '<b>All charts</b> drops a single coin onto every chart in one tap. Then set a different timeframe on each, so you read the same asset from one second to two days in a single glance. The real multi timeframe picture, with nothing to switch.',
    x: 'Line up 1m, 15m, 1h and 4h of the same coin to see where trend and noise disagree.'
  },
  {
    t: 'Twenty timeframes, from one second',
    d: 'We ship <b>20 timeframes</b>: 1s, 2s, 5s, 10s, 30s and all the way up to 48h. Second level charts that most platforms lock behind paid plans are open here for everyone, scalper or swing trader alike.',
    x: 'Second charts time an entry to the tick; the 48h chart keeps the big structure in frame.'
  },
  {
    t: 'Move every chart together',
    d: '<b>Sync all charts</b> ties crosshair, zoom and scroll across every chart, so dragging or zooming one moves them all. <b>Global vertical line</b> marks the same moment on every chart, <b>global horizontal line</b> drops the same price across all of them, and <b>Reset layout</b> brings the clean grid back whenever you need it.',
    x: 'Mark one event with the vertical line and watch how each timeframe reacted to it.'
  },
  {
    t: 'Around fifty indicators, and growing',
    d: 'About <b>50 indicators</b> are ready to drop on any chart, each with deep styling. And it stays open: if you need a specific or special indicator that is not here yet, just ask and we add it for you.',
    x: 'Your toolkit is never frozen. The list grows with what traders actually need.'
  },
  {
    t: 'Free Transform, your own indicator',
    d: 'This one is ours alone. <b>Draw Indicator</b> lets you draw the indicator you want straight on the candles; it keeps the exact structure you gave it and <b>keeps forming forward</b>, holding its distance and rhythm against price for as long as you keep it. <b>Reshape</b> molds any indicator like clay, in any direction, and it holds that shape. <b>Smooth</b> turns a rough drawing into a clean line.',
    x: 'Draw a line today, come back a week later and it still respects the same logic against price. Your own indicator, no code.'
  },
  {
    t: 'Pro tools and one tap sharing',
    d: 'A right side toolbar gives you a <b>ruler</b> that reads a price move as a percentage the clear way, and <b>long and short position</b> tools with risk and reward laid out. <b>Full screen</b> opens one chart edge to edge, <b>Save image</b> exports all charts at once, and <b>Share Signal</b> turns your position into a clean card with the coin logo, entry, stop and target, ready to post.',
    x: 'Everything you mark can leave as a clean image, watermark and coin logo included.'
  }
];
let _pasoMC = 0;
function ayudaMC() {
  if ($('mc-hw-box')) { $('mc-hw-box').remove(); return; }
  _pasoMC = 0;
  const d = document.createElement('div'); d.id = 'mc-hw-box';
  d.innerHTML = `<div class="mc-hw-bg"></div>
    <div class="mc-hw-c">
      <button class="mc-hw-x" aria-label="Close">${IC.x}</button>
      <div class="mc-hw-eyebrow">Multichart</div>
      <div id="mc-hw-cuerpo"></div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  d.querySelector('.mc-hw-bg').onclick = q; d.querySelector('.mc-hw-x').onclick = q;
  pintarPasoMC();
}
function pintarPasoMC() {
  const c = $('mc-hw-cuerpo'); if (!c) return;
  const p = PASOS_MC[_pasoMC], ultimo = _pasoMC === PASOS_MC.length - 1;
  c.innerHTML = `
    <div class="mc-hw-card">
      <div class="mc-hw-n">${_pasoMC + 1} <em>of ${PASOS_MC.length}</em></div>
      <div class="mc-hw-t">${p.t}</div>
      <div class="mc-hw-d">${p.d}</div>
      <div class="mc-hw-x2">${p.x}</div>
    </div>
    <div class="mc-hw-dots">${PASOS_MC.map((_, i) => `<i class="${i === _pasoMC ? 'on' : ''}" data-paso="${i}"></i>`).join('')}</div>
    <div class="mc-hw-acts">
      ${_pasoMC > 0 ? '<button class="mc-hw-back" id="mc-hw-back">Back</button>' : ''}
      <button class="mc-hw-next" id="mc-hw-next">${ultimo ? 'Got it' : 'Learn more'}</button>
    </div>`;
  $('mc-hw-next').onclick = () => { if (_pasoMC >= PASOS_MC.length - 1) { const b = $('mc-hw-box'); if (b) b.remove(); return; } _pasoMC++; pintarPasoMC(); };
  const at = $('mc-hw-back'); if (at) at.onclick = () => { _pasoMC = Math.max(0, _pasoMC - 1); pintarPasoMC(); };
  c.querySelectorAll('[data-paso]').forEach((b) => b.onclick = () => { _pasoMC = Number(b.dataset.paso); pintarPasoMC(); });
}
/* Apaga toda herramienta de Free Transform del panel y quita su pildora. */
function desactivarFT(pane) {
  if (!pane) return;
  pane.ftTool = null; pane._draw = null;
  if (pane._ftBtn) pane._ftBtn.classList.remove('on');
  sincronizarFT(pane); actualizarPildoraFT(pane);
}
/* Menu del boton dorado Free Transform (mismo estilo visual que la config). */
function menuFT(pane, anchor) {
  const prev = document.querySelector('.mc-ftmenu'); if (prev) { prev.remove(); if (prev._anchor === anchor) return; }
  try { cerrarMenu(); } catch (_) {}
  const rows = [
    { t: 'draw', ic: IC.pencil, nom: 'Draw indicator', sub: 'Sketch a shape on the chart; it mounts the closest real indicator.' },
    { t: 'reshape', ic: IC.hand, nom: 'Reshape', sub: 'Grab a line and mold it. Its real settings change and stay.' },
    { t: 'smooth', ic: IC.wave, nom: 'Smooth', sub: 'Drag over a line to soften or sharpen it.' }
  ];
  const menu = document.createElement('div'); menu.className = 'mc-ftmenu'; menu._anchor = anchor;
  menu.innerHTML = `<div class="mc-ftmenu-h">Free Transform</div>`
    + rows.map((r) => `<button class="mc-ftrow ${pane.ftTool === r.t ? 'on' : ''}" data-t="${r.t}">${r.ic}<span class="tx">${r.nom}<span class="sub">${r.sub}</span></span></button>`).join('')
    + `<button class="mc-ftrow danger" data-t="reset">${IC.reset}<span class="tx">Reset shapes<span class="sub">Clear offsets and smoothing on this chart.</span></span></button>`;
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, r.left)) + 'px';
  menu.style.top = (r.bottom + 7) + 'px';
  const cerrar = () => { menu.remove(); document.removeEventListener('mousedown', doc, true); };
  const doc = (ev) => { if (!menu.contains(ev.target) && ev.target !== anchor && !anchor.contains(ev.target)) cerrar(); };
  setTimeout(() => document.addEventListener('mousedown', doc, true), 0);
  menu.querySelectorAll('.mc-ftrow').forEach((b) => b.onclick = () => {
    const t = b.dataset.t;
    if (t === 'reset') { resetShapes(pane); cerrar(); return; }
    pane.ftTool = (pane.ftTool === t) ? null : t;
    anchor.classList.toggle('on', !!pane.ftTool);
    sincronizarFT(pane); actualizarPildoraFT(pane); cerrar();
  });
}
function desarmarTool() {
  S.tool = null; S.preview = null;
  const bv = $('mc-vline'), bh = $('mc-hline'); if (bv) bv.classList.remove('on'); if (bh) bh.classList.remove('on');
  S.paneles.forEach((p) => { const c = p.body.querySelector('.mc-cap'); if (c) c.classList.remove('on'); });
}
function timeAt(pane, x) { try { const lg = pane.chart.timeScale().coordinateToLogical(x); if (lg == null) return null; const i = Math.max(0, Math.min(pane.velas.length - 1, Math.round(lg))); const v = pane.velas[i]; return v ? v.time : null; } catch (_) { return null; } }
function priceAt(pane, y) { try { const p = pane.serie.coordinateToPrice(y); return p == null ? null : p; } catch (_) { return null; } }
function colocarVLine(pane, x) {   // marca un TIEMPO: sale en todas las gráficas a esa fecha
  const t = timeAt(pane, x); if (t == null) return;
  S.vlines.push({ time: t, t0: performance.now(), col: '#E8B84B', gr: 2 });
}
function colocarHLine(pane, y) {   // marca una ALTURA: sale en todas las gráficas a la misma altura (se ve aunque sean monedas distintas)
  const H = pane.body.clientHeight || 1;
  S.hlines.push({ frac: Math.max(0, Math.min(1, y / H)), t0: performance.now(), col: '#2ee8c6', gr: 2 });
}
function fullPane(pane) {
  desactivarFT(pane);                 // al entrar o salir de fullscreen se apagan las herramientas de Free Transform (no dejar pildoras colgadas)
  pane.max = !pane.max;
  const ov = $('mc-overlay');
  if (pane.max) {
    pane._inline = pane.el.getAttribute('style') || '';   // guarda left/top/width/height (del flotante o de un resize)
    pane.el.removeAttribute('style');                      // si no, los estilos inline impiden que .mc-max ocupe toda la pantalla
    pane.el.classList.add('mc-max');
    if (ov) ov.classList.add('mc-hasmax');
  } else {
    pane.el.classList.remove('mc-max');
    if (ov) ov.classList.remove('mc-hasmax');
    if (pane._inline) pane.el.setAttribute('style', pane._inline); else pane.el.removeAttribute('style');
  }
  pane.el.querySelector('[data-full]').innerHTML = pane.max ? IC.shrink : IC.full;
  pane.el.querySelector('[data-full]').classList.toggle('on', pane.max);
  // reajusta la gráfica al nuevo tamaño con una vista cercana (si no, solo se veía un pedacito)
  setTimeout(() => { vistaDefecto(pane); if (pane === S.focus) sincronizarFocus(); }, 90);
}
/* Vista por defecto: muestra las ~130 velas más recientes (velas de buen tamaño,
   no las 1000 diminutas), dejando TODO el historial disponible al arrastrar. */
function vistaDefecto(pane) { try { const n = pane.velas.length; if (n > 3) pane.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 130), to: n + 3 }); } catch (_) {} }
function irAlPresente(pane) { vistaDefecto(pane); if (pane === S.focus) sincronizarFocus(); }
/* Reset: restablece las 4 gráficas por defecto (BTC/ETH/BNB/SOL), recreando las
   que se hayan cerrado y descartando flotantes. Rescate total de la distribución. */
async function reorganizar() {
  const ov = $('mc-overlay'); if (ov) ov.classList.remove('mc-hasmax');
  cerrarMenu();
  S.paneles.slice().forEach((p) => {
    try { p.stream && p.stream.cerrar(); } catch (_) {}
    try { p.barra && p.barra.desmontar && p.barra.desmontar(); } catch (_) {}
    try { p.chart.remove(); } catch (_) {}
    if (p.el) p.el.remove();
  });
  S.paneles = []; S.focus = null; S.vlines = [];
  await Promise.all(DEF.map((id) => crearPanel(id, '1m')));
  ajustarGrid();
  if (S.paneles[0]) enfocar(S.paneles[0]);
  D.logos().then((l) => { if (l) S.logos = l; S.paneles.forEach(pintarLogoHead); });
  actualizarDock();
  toast('Layout reset · 4 default charts');
}
function cerrarPane(pane) {
  const docked = S.paneles.filter((p) => !p.flotante);
  if (!pane.flotante && docked.length <= 1) { toast('Keep at least one chart.'); return; }
  desactivarFT(pane);                 // quita herramientas y pildora de Free Transform de este panel
  if (pane.max) { const ov = $('mc-overlay'); if (ov) ov.classList.remove('mc-hasmax'); }   // si estaba en fullscreen, libera el modo (si no, los demás quedan ocultos)
  try { pane.stream && pane.stream.cerrar(); } catch (_) {}
  try { pane.barra && pane.barra.desmontar && pane.barra.desmontar(); } catch (_) {}
  try { pane.chart.remove(); } catch (_) {}
  pane.el.remove();
  S.paneles = S.paneles.filter((p) => p !== pane);
  if (S.focus === pane) { S.focus = null; const n = S.paneles.find((p) => !p.flotante) || S.paneles[0]; if (n) enfocar(n); }
  ajustarGrid();
  actualizarDock();
}
/* Acopla la gráfica flotante (la de Add chart) a la rejilla: rellena el hueco de
   una que se cerró, o se añade debajo si ya están las cuatro. */
function acoplar() {
  const flt = S.paneles.find((p) => p.flotante);
  if (!flt) { toast('Add a chart first, then dock it'); return; }
  if (flt.max) fullPane(flt);
  flt.flotante = false;
  flt.el.classList.remove('mc-float'); flt.el.classList.add('mc-pane');
  flt.el.removeAttribute('style'); flt._inline = '';
  $('mc-grid').appendChild(flt.el);   // flex-wrap lo coloca en el hueco libre, o en una fila nueva si están las 4
  ajustarGrid();
  actualizarDock();
  setTimeout(() => { try { flt.chart.applyOptions({}); } catch (_) {} vistaDefecto(flt); }, 80);
  toast('Chart docked');
}
function actualizarDock() { const b = $('mc-dock'); if (b) b.classList.toggle('mc-off', !S.paneles.some((p) => p.flotante)); }
function ajustarGrid() {
  const grid = $('mc-grid'); if (!grid) return;
  const n = S.paneles.filter((p) => !p.flotante).length;
  grid.classList.toggle('mc-uno', n === 1);
}
function arrastrar(pane) {
  const head = pane.el.querySelector('.mc-head'); let sx, sy, ox, oy, mov = false;
  head.addEventListener('mousedown', (e) => {
    if (!pane.flotante) return;                 // una vez acoplada a la rejilla ya no se arrastra
    if (e.target.closest('button')) return;
    mov = true; sx = e.clientX; sy = e.clientY; ox = parseInt(pane.el.style.left) || 0; oy = parseInt(pane.el.style.top) || 0;
    head.style.cursor = 'grabbing'; pane.el.style.zIndex = 58; e.preventDefault();
    const mm = (ev) => { if (!mov) return; pane.el.style.left = Math.max(0, ox + ev.clientX - sx) + 'px'; pane.el.style.top = Math.max(52, oy + ev.clientY - sy) + 'px'; };
    const mu = () => { mov = false; head.style.cursor = 'grab'; window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
  });
}
function addFloat() { crearPanel('BTC', '1m', true).then((p) => { if (p) { D.logos().then(() => pintarLogoHead(p)); } actualizarDock(); }); ajustarGrid(); }

/* ── Herramientas de la barra superior (actúan en TODAS las gráficas) ── */
function toggleSync() {
  S.sync = !S.sync;
  $('mc-sync').classList.toggle('on', S.sync);
  if (!S.sync) S.paneles.forEach((o) => { try { o.chart.clearCrosshairPosition(); } catch (_) {} });
  toast(S.sync ? 'Sync ON · move one chart, all follow' : 'Sync OFF');
}
function toggleTool(t) {
  S.tool = (S.tool === t) ? null : t;
  S.preview = null;
  $('mc-vline').classList.toggle('on', S.tool === 'vline');
  $('mc-hline').classList.toggle('on', S.tool === 'hline');
  S.paneles.forEach((p) => { const cap = p.body.querySelector('.mc-cap'); if (cap) cap.classList.toggle('on', !!S.tool); });
  if (S.tool === 'vline') toast('Vertical line · click any chart to mark the same time on all');
  else if (S.tool === 'hline') toast('Horizontal line · click a chart to mark a price');
}

/* ── Menús ── */
function cerrarMenu() { if (S.menu) { S.menu.remove(); S.menu = null; } S.menuAnc = null; }
function fueraMenu(e) {
  // No cerrar si el mousedown cae sobre el propio boton que abrio el menu:
  // asi su onclick puede ALTERNAR (cerrarlo) en vez de que esto lo cierre y el click lo reabra.
  if (S.menu && !S.menu.contains(e.target) && !(S.menuAnc && S.menuAnc.contains(e.target))) cerrarMenu();
  if (S.lineset && !S.lineset.contains(e.target) && !(e.target.closest && e.target.closest('.mc-lcol'))) cerrarLineset();
}
/* Ventanita de ajustes de una línea V/H: misma dinámica que la de la barra de
   dibujo (cambiar color, grosor y borrar con la papelera). */
const LINE_COLS = ['#E8B84B', '#2ee8c6', '#49b6ff', '#ff5b6e', '#2ee86a', '#b07cff', '#ff8fbf', '#eaecef', '#ff9e3d', '#8b95a1'];
function cerrarLineset() { if (S.lineset) { S.lineset.remove(); S.lineset = null; } const c = document.querySelector('.mc-lcol'); if (c) c.remove(); }
function abrirAjustesLinea(pane, hit, cx, cy) {
  cerrarLineset();
  const arr = hit.tipo === 'v' ? S.vlines : S.hlines;
  const ln = arr[hit.idx]; if (!ln) return;
  const el = document.createElement('div'); el.className = 'mc-lineset';
  el.innerHTML =
    `<button class="b col" title="Color"><span class="sw" style="background:${ln.col}"></span></button>` +
    `<span class="sep"></span>` +
    [1, 2, 3, 4].map((w) => `<button class="b gr ${(ln.gr || 2) === w ? 'on' : ''}" data-gr="${w}" title="Thickness"><i style="height:${w + 1}px"></i></button>`).join('') +
    `<span class="sep"></span>` +
    `<button class="b del" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>`;
  ($('mc-overlay') || document.body).appendChild(el);
  const mw = el.offsetWidth, mh = el.offsetHeight;
  let left = cx - mw / 2; left = Math.max(8, Math.min(left, innerWidth - mw - 8));
  let top = cy - mh - 14; if (top < 56) top = cy + 16;
  el.style.left = left + 'px'; el.style.top = top + 'px';
  el.onmousedown = (e) => e.stopPropagation();
  el.querySelector('.col').onclick = (e) => { e.stopPropagation(); abrirColorLinea(ln, el.querySelector('.col')); };
  el.querySelectorAll('[data-gr]').forEach((b) => b.onclick = () => { ln.gr = +b.dataset.gr; el.querySelectorAll('[data-gr]').forEach((x) => x.classList.toggle('on', x === b)); });
  el.querySelector('.del').onclick = () => { const k = arr.indexOf(ln); if (k >= 0) arr.splice(k, 1); cerrarLineset(); };
  S.lineset = el;
}
function abrirColorLinea(ln, anchor) {
  const old = document.querySelector('.mc-lcol'); if (old) { old.remove(); return; }
  const pop = document.createElement('div'); pop.className = 'mc-lcol';
  pop.innerHTML = LINE_COLS.map((c) => `<button class="c ${c === ln.col ? 'on' : ''}" style="background:${c}" data-c="${c}"></button>`).join('');
  ($('mc-overlay') || document.body).appendChild(pop);
  const r = anchor.getBoundingClientRect();
  let left = r.left, top = r.bottom + 6; if (left + pop.offsetWidth > innerWidth - 8) left = innerWidth - pop.offsetWidth - 8;
  pop.style.left = Math.max(8, left) + 'px'; pop.style.top = top + 'px';
  pop.onmousedown = (e) => e.stopPropagation();
  pop.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => { ln.col = b.dataset.c; const sw = anchor.querySelector('.sw'); if (sw) sw.style.background = ln.col; pop.remove(); });
}
function pop(anc, html, w) {
  cerrarMenu();
  const m = document.createElement('div'); m.className = 'mc-pop'; m.innerHTML = html;
  if (w) m.style.width = w + 'px';
  ($('mc-overlay') || document.body).appendChild(m);
  const r = anc.getBoundingClientRect();
  let left = r.left, top = r.bottom + 6;
  const mw = m.offsetWidth, mh = m.offsetHeight;
  if (left + mw > innerWidth - 8) left = innerWidth - mw - 8;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  m.style.left = Math.max(8, left) + 'px'; m.style.top = top + 'px';
  m.onmousedown = (e) => e.stopPropagation();
  S.menu = m; S.menuAnc = anc; return m;
}
/* Alterna un menu: si ya esta abierto DESDE este mismo boton, lo cierra; si no, lo abre. */
function alternarMenu(anc, abrir) { if (S.menu && S.menuAnc === anc) cerrarMenu(); else abrir(); }
function menuMonedas(pane, anc) {
  const m = pop(anc, `<input class="mc-search" placeholder="Search coin (USDT pairs)…"><div class="mc-list" id="mc-coinlist"></div>`, 260);
  const list = m.querySelector('#mc-coinlist'), inp = m.querySelector('.mc-search');
  const base = D.PARES.filter((p) => p.grupo !== 'divisa' && p.grupo !== 'materia');   // solo pares USDT (cripto), como el resto de la sección
  const render = (f) => {
    const t = (f || '').trim().toLowerCase();
    const arr = base.filter((p) => !t || p.id.toLowerCase().includes(t) || (p.n || '').toLowerCase().includes(t)).slice(0, 140);
    list.innerHTML = arr.map((p) => `<div class="mc-opt${p.id === pane.par.id ? ' on' : ''}" data-id="${p.id}"><span class="ic" data-cg="${p.cg || ''}" data-id2="${p.id}">${p.id[0]}</span><b>${p.id}</b><span>${esc(p.n || '')}</span></div>`).join('') || `<div class="mc-opt" style="opacity:.6">No matches</div>`;
    list.querySelectorAll('.mc-opt[data-id]').forEach((o) => o.onclick = () => { cambiarMoneda(pane, o.dataset.id); cerrarMenu(); });
    list.querySelectorAll('.ic[data-cg]').forEach((ic) => { const url = (S.logos && ic.dataset.cg && S.logos[ic.dataset.cg]) || ICONO(ic.dataset.id2); const im = new Image(); im.onload = () => { ic.style.backgroundImage = `url(${url})`; ic.textContent = ''; }; im.src = url; });
  };
  render(''); setTimeout(() => inp.focus(), 30);
  inp.oninput = () => render(inp.value);
}
function limpiarWarp(pane) { if (pane.cfg) Object.keys(pane.cfg).forEach((k) => { if (pane.cfg[k]) pane.cfg[k].warp = null; }); }
async function cambiarMoneda(pane, id) {
  const par = D.PARES.find((p) => p.id === id); if (!par) return;
  limpiarWarp(pane);   // la escultura era para esa moneda: con otra moneda ya no aplica
  pane.par = par;
  pane.el.querySelector('.mc-coin .nm').textContent = par.id;
  pintarLogoHead(pane);
  if (pane === S.focus) NIV.par = par.id;
  pane.dibCache = cargarDibDe(par.id);
  await cargarPanel(pane);
}
/* Selector múltiple de la barra superior: MISMO selector, pero la moneda elegida
   se pone en TODAS las gráficas de la rejilla a la vez. No toca los selectores
   propios de cada gráfica (esos siguen cambiando solo la suya). */
function menuMonedasMulti(anc) {
  const m = pop(anc, `<input class="mc-search" placeholder="Search coin · applies to ALL charts…"><div class="mc-list" id="mc-coinlist"></div>`, 280);
  const list = m.querySelector('#mc-coinlist'), inp = m.querySelector('.mc-search');
  const base = D.PARES.filter((p) => p.grupo !== 'divisa' && p.grupo !== 'materia');
  const render = (f) => {
    const t = (f || '').trim().toLowerCase();
    const arr = base.filter((p) => !t || p.id.toLowerCase().includes(t) || (p.n || '').toLowerCase().includes(t)).slice(0, 140);
    list.innerHTML = arr.map((p) => `<div class="mc-opt" data-id="${p.id}"><span class="ic" data-cg="${p.cg || ''}" data-id2="${p.id}">${p.id[0]}</span><b>${p.id}</b><span>${esc(p.n || '')}</span></div>`).join('') || `<div class="mc-opt" style="opacity:.6">No matches</div>`;
    list.querySelectorAll('.mc-opt[data-id]').forEach((o) => o.onclick = () => { aplicarMonedaTodas(o.dataset.id); cerrarMenu(); });
    list.querySelectorAll('.ic[data-cg]').forEach((ic) => { const url = (S.logos && ic.dataset.cg && S.logos[ic.dataset.cg]) || ICONO(ic.dataset.id2); const im = new Image(); im.onload = () => { ic.style.backgroundImage = `url(${url})`; ic.textContent = ''; }; im.src = url; });
  };
  render(''); setTimeout(() => inp.focus(), 30);
  inp.oninput = () => render(inp.value);
}
function aplicarMonedaTodas(id) {
  const par = D.PARES.find((p) => p.id === id); if (!par) return;
  S.paneles.filter((p) => !p.flotante).forEach((p) => cambiarMoneda(p, id));
  toast(par.id + ' on all charts');
}
function menuTf(pane, anc) {
  const m = pop(anc, `<div class="mc-indhead">Timeframe</div><div class="mc-tfgrid">${MC_TFS.map((t) => `<button class="${t.id === pane.tf ? 'on' : ''}" data-tf="${t.id}">${t.n}</button>`).join('')}</div>`, 220);
  m.querySelectorAll('[data-tf]').forEach((b) => b.onclick = async () => { pane.tf = b.dataset.tf; pane.el.querySelector('[data-tf]').textContent = pane.tf; limpiarWarp(pane); cerrarMenu(); await cargarPanel(pane); });
}
/* Lista para anadir indicadores: por grupos, se toca para encender o apagar.
   Varios overlays a la vez (Set); un solo oscilador (oscK). Al encender uno,
   sale su barra de herramientas pegada a la etiqueta. */
/* Menu de indicadores: ventana CENTRADA, con buscador y por grupos (como
   TradingView, pero sin tanta informacion). Scrollea; nada de columna vertical. */
const CATS_IND = [['all', 'Todos'], ['Trend', 'Medias / Tendencia'], ['Volume', 'Volumen'], ['Volatility', 'Volatilidad'], ['Momentum', 'Osciladores']];
function menuInd(pane) {
  cerrarMenu();
  const activo = (d) => d.tipo === 'ovl' ? [...pane.ovl].some((k) => baseId(k) === d.id) : (pane.oscK && baseId(pane.oscK) === d.id);
  const rows = INDICADORES.map((d) => { const c = (pane.cfg && pane.cfg[d.id]) || d.estilo; return `<button class="mc-irow${activo(d) ? ' on' : ''}" data-id="${d.id}" data-tipo="${d.tipo}" data-grp="${d.grupo}"><i class="dot" style="background:${c.col}"></i><span class="nm">${d.nom}</span><span class="tag">${d.tipo === 'ovl' ? 'Precio' : 'Panel'}</span><span class="ck">✓</span></button>`; }).join('');
  const sidebar = CATS_IND.map(([k, lbl], i) => `<button class="mc-cat${i === 0 ? ' on' : ''}" data-cat="${k}">${lbl}</button>`).join('');
  const m = modal('Indicadores', `<div class="mc-isearch-wrap"><input class="mc-isearch" placeholder="Buscar indicador..."><span class="mc-icount"></span></div><div class="mc-ind-wrap"><div class="mc-ind-cats">${sidebar}</div><div class="bxc mc-ibody">${rows}</div></div>`);
  const body = m.querySelector('.mc-ibody'), search = m.querySelector('.mc-isearch'), count = m.querySelector('.mc-icount');
  let cat = 'all';
  const filtrar = () => {
    const q = search.value.trim().toLowerCase(); let n = 0;
    body.querySelectorAll('.mc-irow').forEach((b) => { const def = buscarInd(b.dataset.id); const okc = cat === 'all' || b.dataset.grp === cat; const okq = !q || (def && def.nom.toLowerCase().indexOf(q) >= 0); const show = okc && okq; b.style.display = show ? '' : 'none'; if (show) n++; });
    if (count) count.textContent = n + ' indicadores';
  };
  m.querySelectorAll('.mc-cat').forEach((btn) => btn.onclick = () => { cat = btn.dataset.cat; m.querySelectorAll('.mc-cat').forEach((x) => x.classList.toggle('on', x === btn)); filtrar(); });
  search.oninput = filtrar; filtrar(); setTimeout(() => { try { search.focus(); } catch (_) {} }, 40);
  body.querySelectorAll('.mc-irow').forEach((row) => row.onclick = () => {
    const id = row.dataset.id, def = buscarInd(id); if (!def) return;
    let encendido;
    if (def.tipo === 'ovl') { const has = [...pane.ovl].some((k) => baseId(k) === id); if (has) { [...pane.ovl].forEach((k) => { if (baseId(k) === id) { pane.ovl.delete(k); if (pane.cfg) delete pane.cfg[k]; } }); encendido = false; } else { pane.ovl.add(id); encendido = true; } row.classList.toggle('on', encendido); }
    else { encendido = baseId(pane.oscK || '') !== id || !pane.oscK; pane.oscK = encendido ? id : null; body.querySelectorAll('.mc-irow[data-tipo="osc"]').forEach((x) => x.classList.toggle('on', pane.oscK && x.dataset.id === baseId(pane.oscK))); }
    recalc(pane); marcarBtnInd(pane);
    if (encendido) { m.remove(); setTimeout(() => abrirBarraDe(pane, id), 30); }
  });
}
/* El boton Indicator se enciende si hay al menos un indicador activo. */
function marcarBtnInd(pane) { const b = pane.el.querySelector('[data-ind]'); if (b) b.classList.toggle('on', indActivo(pane)); }
/* Etiquetas tocables sobre la grafica (una por indicador activo, en su color).
   Al tocar una, reaparece su barra de herramientas anclada a ella. */
function nombreInst(def, c, key) { return nomInd(def, c) + (instN(key) > 1 ? ' (' + instN(key) + ')' : ''); }
function indsActivos(pane) {
  const items = [];
  pane.ovl.forEach((key) => { const def = defDe(pane, key); if (def) items.push({ key, def }); });
  if (pane.oscK) { const def = buscarInd(baseId(pane.oscK)); if (def) items.push({ key: pane.oscK, def }); }
  return items;
}
function actualizarLeyenda(pane) {
  if (!pane.body) return;
  let leg = pane.body.querySelector('.mc-leg');
  if (!leg) { leg = document.createElement('div'); leg.className = 'mc-leg'; pane.body.appendChild(leg); }
  const items = indsActivos(pane);
  if (!items.length) { leg.innerHTML = ''; cerrarLegPop(pane); return; }
  const MAXVIS = 2;                                   // mas de dos -> se colapsa en un boton +N
  const vis = items.slice(0, MAXVIS), resto = items.length - vis.length;
  let html = vis.map(({ key, def }) => { const c = cfgDe(pane, key); return `<span class="mc-chip" data-id="${key}" style="color:${c.col}"><i style="background:${c.col}"></i>${nombreInst(def, c, key)}<button class="mc-chipx" data-x="${key}" title="Quitar indicador">${IC.x}</button></span>`; }).join('');
  if (resto > 0) html += `<button class="mc-chip mc-chip-mas" data-mas="1" title="Ver indicadores">+${resto}</button>`;
  leg.innerHTML = html;
  leg.querySelectorAll('.mc-chip[data-id]').forEach((ch) => ch.onclick = (e) => { e.stopPropagation(); abrirBarraDe(pane, ch.dataset.id); });
  leg.querySelectorAll('.mc-chipx').forEach((b) => b.onclick = (e) => { e.stopPropagation(); quitarInd(pane, b.dataset.x); });
  const mas = leg.querySelector('[data-mas]'); if (mas) mas.onclick = (e) => { e.stopPropagation(); abrirGestorLeyenda(pane, mas); };
}
/* Ventanita para gestionar TODOS los indicadores activos: lista con scroll y
   papelera para eliminar cada uno. Tocar el nombre abre su barra. */
function abrirGestorLeyenda(pane, anc) {
  cerrarLegPop(pane);
  const pop = document.createElement('div'); pop.className = 'mc-legpop';
  pop.innerHTML = `<div class="mc-legpop-h">Indicadores</div><div class="mc-legpop-list"></div>`;
  pane.body.appendChild(pop);
  const rb = pane.body.getBoundingClientRect(), ra = anc.getBoundingClientRect();
  pop.style.left = Math.max(6, ra.left - rb.left) + 'px'; pop.style.top = (ra.bottom - rb.top + 6) + 'px';
  llenarGestor(pane, pop);
  pane._legPopDoc = (ev) => { if (!pop.contains(ev.target) && ev.target !== anc) cerrarLegPop(pane); };
  setTimeout(() => document.addEventListener('mousedown', pane._legPopDoc, true), 0);
}
function llenarGestor(pane, pop) {
  const list = pop.querySelector('.mc-legpop-list'); if (!list) return;
  const items = indsActivos(pane);
  if (!items.length) { cerrarLegPop(pane); return; }
  list.innerHTML = items.map(({ key, def }) => { const c = cfgDe(pane, key); return `<div class="mc-legrow" data-id="${key}"><i style="background:${c.col}"></i><span class="nm">${nombreInst(def, c, key)}</span><button class="mc-legdel" data-del="${key}" title="Eliminar">${IC.x}</button></div>`; }).join('');
  list.querySelectorAll('.mc-legrow .nm').forEach((n) => n.onclick = () => { const id = n.parentElement.dataset.id; cerrarLegPop(pane); abrirBarraDe(pane, id); });
  list.querySelectorAll('.mc-legdel').forEach((btn) => btn.onclick = (e) => { e.stopPropagation(); quitarInd(pane, btn.dataset.del); llenarGestor(pane, pop); });
}
function cerrarLegPop(pane) { const p = pane.body && pane.body.querySelector('.mc-legpop'); if (p) p.remove(); if (pane._legPopDoc) { document.removeEventListener('mousedown', pane._legPopDoc, true); pane._legPopDoc = null; } }
/* Abre la barra de herramientas de un indicador, anclada a su etiqueta. */
function abrirBarraDe(pane, id) {   // id es una clave de instancia ('ema' o 'ema#2')
  const def = defDe(pane, id); if (!def) return;
  const c = cfgDe(pane, id);
  const r = pane.body.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + 8;   // SIEMPRE centrada arriba de la grafica, para que no moleste
  abrirBarraInd({
    cfg: c, params: def.params || [], opc: def.op || [], tipo: def.tipo, nombre: nombreInst(def, c, id), nombreDe: () => nombreInst(def, c, id), cx, cy,
    onCambio: () => recalc(pane),
    onEliminar: () => quitarInd(pane, id),
    onDuplicar: (def.tipo === 'ovl' && !def._drawn) ? () => duplicarInd(pane, id) : null   // duplicar solo en overlays reales (no dibujados)
  });
}
/* Duplica un indicador overlay: nueva instancia con su propio numero y su propia config. */
function duplicarInd(pane, id) {
  const base = baseId(id); let n = 2; while (pane.ovl.has(base + '#' + n)) n++;
  const key = base + '#' + n; pane.ovl.add(key);
  if (pane.cfg && pane.cfg[id]) { pane.cfg[key] = Object.assign({}, pane.cfg[id]); pane.cfg[key].warp = null; pane.cfg[key].ft = false; }
  recalc(pane); marcarBtnInd(pane); setTimeout(() => abrirBarraDe(pane, key), 30);
}
/* Quita un indicador (desde la papelera de su barra). */
function quitarInd(pane, id) {
  pane.ovl.delete(id);
  if (pane.oscK === id || baseId(pane.oscK || '') === baseId(id)) pane.oscK = null;
  if (pane.cfg) delete pane.cfg[id];
  if (pane.drawDefs) delete pane.drawDefs[id];     // limpia el def sintetico del dibujado
  recalc(pane); marcarBtnInd(pane);
}
function indActivo(pane) { return pane.ovl.size > 0 || !!pane.oscK; }

/* ── Guardar imagen ── */
/* ── Share Signal ─────────────────────────────────────────────────────────
   Detecta la posicion (larga/corta) dibujada en el panel y exporta una tarjeta
   limpia, al estilo de Reaction Zones: logo de la moneda SIEMPRE, el grafico, el
   nombre de la seccion "Multichart", entrada / stop loss / objetivo, y nuestro
   logo + dominio. El boton solo esta activo cuando hay una posicion puesta. */
function posDePane(pane) {
  const lista = (pane === S.focus) ? NIV.dibujos : pane.dibCache;
  return (lista || []).filter((d) => d && (d.tipo === 'poslarga' || d.tipo === 'poscorta') && d.pts && d.pts[0]);
}
function refrescarShareSig(pane) {
  const b = pane && pane._shareSigBtn; if (!b) return;
  const hay = posDePane(pane).length > 0;
  b.disabled = !hay; b.classList.toggle('lista', hay);
}
function refrescarShareSigTodas() { try { S.paneles.forEach(refrescarShareSig); } catch (_) {} }

/* El grafico + sus capas (indicadores, overlay, dibujos) en un solo lienzo, a
   resolucion nativa: asi la posicion dibujada sale dentro de la imagen. */
function _chartComposite(pane) {
  let shot; try { shot = pane.chart.takeScreenshot(); } catch (_) { return null; }
  if (!shot || !shot.width) return null;
  const W = shot.width, H = shot.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.drawImage(shot, 0, 0);
  try {
    if (pane.fx && pane.fx.width) g.drawImage(pane.fx, 0, 0, W, H);
    if (pane.ux && pane.ux.width) g.drawImage(pane.ux, 0, 0, W, H);
    const cvh = pane.body.querySelector('.nv-cvh'); if (cvh && cvh.width) g.drawImage(cvh, 0, 0, W, H);
  } catch (_) {}
  return c;
}
async function compartirSenalMC(pane) {
  const pos = posDePane(pane);
  if (!pos.length) { try { toast('Place a long or short position first.'); } catch (_) {} return; }
  const chart = _chartComposite(pane);
  if (!chart) { try { toast('Could not capture the chart.'); } catch (_) {} return; }
  const par = pane.par || {}, tf = pane.tf || '', WEB = 'decfreedom.com';

  const datos = pos.map((d) => {
    const largo = d.tipo === 'poslarga', pe = d.pts[0].p;
    const pT = (d.pTarget != null) ? d.pTarget : pe * (largo ? 1.01 : 0.99);
    const pS = (d.pStop != null) ? d.pStop : pe - (pT - pe) * 0.5;
    const rr = Math.abs(pe - pS) > 0 ? Math.abs((pT - pe) / (pe - pS)) : 0;
    return { largo, pe, pS, pT, rr };
  });
  const n = datos.length;
  const dc = (v) => { const d = decimales(v); return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };
  const px = (pane.velas && pane.velas.length) ? pane.velas[pane.velas.length - 1].close : null;
  const hora = new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });

  // Texto al portapapeles, por si lo quiere pegar en un chat
  const lineas = (f) => datos.map((d, i) => `${i + 1}: ${f(d)}`).join('\n');
  const txt = `MULTICHART — SIGNAL\n\n${par.id || ''} · ${tf} · ${hora} UTC${px != null ? ' · Price ' + dc(px) : ''}\n${datos.map((d) => d.largo ? 'LONG' : 'SHORT').join(' / ')}\n\nENTRY\n${lineas((d) => dc(d.pe))}\n\nSTOP LOSS\n${lineas((d) => dc(d.pS))}\n\nTARGET\n${lineas((d) => dc(d.pT))}\n\n${WEB} · Multichart`;
  try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(() => {}); } catch (_) {}

  // Logo de la moneda SIEMPRE: spothq (GitHub, CORS) y respaldo CoinGecko; si no, iniciales.
  const coinRepo = par.id ? ICONO(par.id) : null;
  const coinCg = par.cg && S.logos && S.logos[par.cg];
  const [imgRepo, imgWm] = await Promise.all([cargarImg(coinRepo, true), cargarImg(LOGO, false)]);
  const coin = imgRepo || (coinCg ? await cargarImg(coinCg, true) : null);

  const W = 1180, BG = '#0a0d12';
  const chartH = Math.round(W * (chart.height / chart.width));
  const padX = 54, headH = 150, rowH = 54, rrH = 86, footH = 84;
  const H = chartH + headH + n * rowH + rrH + footH;
  const cv = document.createElement('canvas'), g = cv.getContext('2d'); cv.width = W; cv.height = H;
  g.fillStyle = BG; g.fillRect(0, 0, W, H);
  g.drawImage(chart, 0, 0, W, chartH);
  const y0 = chartH;
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y0 + 0.5); g.lineTo(W, y0 + 0.5); g.stroke();

  // Logo moneda (circulo) + "Multichart" + chip LONG/SHORT + meta
  const ls = 70, lx = padX, ly = y0 + 26;
  g.save(); g.beginPath(); g.arc(lx + ls / 2, ly + ls / 2, ls / 2, 0, 6.2832); g.closePath();
  g.fillStyle = coin ? '#ffffff' : '#141b25'; g.fill();
  if (coin) { g.clip(); g.drawImage(coin, lx, ly, ls, ls); }
  else { g.fillStyle = '#E8B84B'; g.font = '800 24px "Chakra Petch", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(par.id || '?').slice(0, 4), lx + ls / 2, ly + ls / 2 + 1); }
  g.restore();
  g.strokeStyle = 'rgba(232,184,75,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(lx + ls / 2, ly + ls / 2, ls / 2, 0, 6.2832); g.stroke();
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const tx = lx + ls + 24;
  g.fillStyle = '#E8B84B'; g.font = '800 38px "Chakra Petch", system-ui, sans-serif'; g.fillText('Multichart', tx, y0 + 52);
  const twM = g.measureText('Multichart').width;
  const side = datos.every((d) => d.largo) ? 'LONG' : datos.every((d) => !d.largo) ? 'SHORT' : 'LONG / SHORT';
  const sCol = side === 'LONG' ? '#2ee86a' : side === 'SHORT' ? '#ff5b6e' : '#E8B84B';
  g.font = '800 15px "Chakra Petch", system-ui, sans-serif';
  const pw = g.measureText(side).width + 24, ph = 26, ppx = tx + twM + 16, ppy = y0 + 52 - 20;
  g.save(); g.globalAlpha = .16; g.fillStyle = sCol; redondea(g, ppx, ppy, pw, ph, 7); g.fill(); g.restore();
  g.strokeStyle = sCol; g.globalAlpha = .5; g.lineWidth = 1; redondea(g, ppx, ppy, pw, ph, 7); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = sCol; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(side, ppx + pw / 2, ppy + ph / 2 + 1);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#8b95a1'; g.font = '600 17px "IBM Plex Mono", ui-monospace, monospace';
  g.fillText(`${par.id || ''}    ·    ${tf}    ·    ${hora} UTC${px != null ? '    ·    Price ' + dc(px) : ''}`, tx, y0 + 82);

  // Columnas ENTRY / STOP LOSS / TARGET
  const colBlock = 250;
  const xs = [padX, Math.round(W / 2 - colBlock / 2), W - padX - colBlock];
  const cols = [['ENTRY', datos.map((d) => dc(d.pe)), '#e8ecf2'], ['STOP LOSS', datos.map((d) => dc(d.pS)), '#ff5b6e'], ['TARGET', datos.map((d) => dc(d.pT)), '#2ee86a']];
  const colY = y0 + headH;
  cols.forEach((c, ci) => {
    const cx = xs[ci]; g.textAlign = 'left';
    g.fillStyle = c[2]; g.font = '800 20px system-ui, sans-serif'; g.fillText(c[0], cx, colY);
    g.strokeStyle = c[2]; g.globalAlpha = .3; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, colY + 13); g.lineTo(cx + colBlock, colY + 13); g.stroke(); g.globalAlpha = 1;
    c[1].forEach((v, i) => {
      const ry = colY + 44 + i * rowH;
      g.fillStyle = '#5a6570'; g.font = '700 16px "IBM Plex Mono", ui-monospace, monospace'; g.fillText(String(i + 1), cx, ry);
      g.fillStyle = '#eef2f6'; g.font = '800 26px "IBM Plex Mono", ui-monospace, monospace'; g.fillText(v, cx + 30, ry + 2);
    });
  });

  // RISK : REWARD
  const rry = colY + 44 + n * rowH + 38;
  const rrTxt = (n === 1) ? ('1 : ' + datos[0].rr.toFixed(1)) : '1 : 2';
  g.textAlign = 'center';
  g.fillStyle = '#8b95a1'; g.font = '700 18px system-ui, sans-serif'; g.fillText('RISK : REWARD', W / 2 - 72, rry);
  g.fillStyle = '#E8B84B'; g.font = '800 26px system-ui, sans-serif'; g.fillText(rrTxt, W / 2 + 98, rry + 1);

  // Footer: logo + dominio + Multichart
  const fy = H - footH;
  g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(0, fy, W, footH);
  g.strokeStyle = 'rgba(232,184,75,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, fy + 0.5); g.lineTo(W, fy + 0.5); g.stroke();
  g.textAlign = 'left'; g.textBaseline = 'middle';
  let dx = padX;
  if (imgWm && imgWm.width) { const mh = 44, mw = imgWm.width * (mh / imgWm.height); g.drawImage(imgWm, padX, fy + (footH - mh) / 2, mw, mh); dx = padX + mw + 18; }
  g.fillStyle = '#dfe5ec'; g.font = '700 19px system-ui, sans-serif'; g.fillText(WEB, dx, fy + footH / 2 + 1);
  g.fillStyle = '#E8B84B'; g.font = '800 19px system-ui, sans-serif'; g.textAlign = 'right'; g.fillText('Multichart', W - padX, fy + footH / 2 + 1);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';

  try { modalImg(cv, `decfreedom-multichart-${par.id || 'signal'}-${tf}-${Date.now()}.png`, (par.id || '') + 'USDT · ' + tf + ' · Signal'); } catch (_) {}
}

async function guardarImagenPanel(pane) {
  let shot; try { shot = pane.chart.takeScreenshot(); } catch (_) { toast('Could not export ' + pane.par.id + '.'); return; }
  // Logo de la moneda: spothq en GitHub (con CORS), respaldo CoinGecko. Asi SI
  // aparece el logo arriba y el canvas queda limpio para descargar.
  const coinRepo = pane.par.id ? ICONO(pane.par.id) : null;
  const coinCg = pane.par.cg && S.logos && S.logos[pane.par.cg];
  const [imgRepo, imgWm] = await Promise.all([cargarImg(coinRepo, true), cargarImg(LOGO, false)]);
  const imgCoin = imgRepo || await cargarImg(coinCg, true);
  const cv = componerPanel(pane, shot, imgCoin, imgWm); if (!cv) return;
  modalImg(cv, 'DecFreedom-' + pane.par.id + '-' + pane.tf + '.png', pane.par.id + 'USDT · ' + pane.tf);
}
/* Compone la imagen de export a RESOLUCION NATIVA del chart (sin estirar = nitida),
   con el logo de la moneda arriba y la marca de agua por ENCIMA del eje de tiempo. */
function componerPanel(pane, ch, imgCoin, imgWm) {
  if (!ch || !ch.width) return null;
  const W = ch.width, H = ch.height, top = 60;
  const out = document.createElement('canvas'); out.width = W; out.height = H + top; const g = out.getContext('2d');
  g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H + top);
  g.fillStyle = '#0b1118'; g.fillRect(0, 0, W, top);
  g.fillStyle = '#E8B84B'; g.fillRect(0, 0, W, 3);
  g.fillStyle = 'rgba(232,184,75,.22)'; g.fillRect(0, top - 1, W, 1);
  // logo de la moneda (circulo), o la inicial si no cargo
  const r = 15, cx = 20 + r, cy = 30;
  if (imgCoin && imgCoin.width) { g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.closePath(); g.clip(); g.drawImage(imgCoin, cx - r, cy - r, r * 2, r * 2); g.restore(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
  else { g.fillStyle = '#232b36'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.fillStyle = '#c9d1d9'; g.font = '800 14px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((pane.par.id || '?')[0], cx, cy + 1); g.textBaseline = 'alphabetic'; }
  const tx = cx + r + 12;
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '800 18px "Chakra Petch", sans-serif'; g.fillStyle = '#eaecef'; g.fillText(pane.par.id + 'USDT', tx, 27);
  const nameW = g.measureText(pane.par.id + 'USDT').width;
  const px = (pane.velas && pane.velas.length) ? pane.velas[pane.velas.length - 1].close : null;
  if (px != null) { const d = decimales(px); g.font = '700 15px "IBM Plex Mono", monospace'; g.fillStyle = '#cfd6de'; g.fillText(Number(px).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }), tx + nameW + 12, 27); }
  g.font = '700 11px "IBM Plex Mono", monospace'; g.fillStyle = '#8b96a3'; g.fillText(pane.tf + '  ·  ' + new Date().toLocaleString('en-US'), tx, 47);
  g.textAlign = 'right'; g.font = '800 15px "Chakra Petch", sans-serif'; g.fillStyle = '#E8B84B'; g.fillText('Multichart', W - 18, 27);
  g.font = '700 11px "IBM Plex Mono", monospace'; g.fillStyle = '#8b96a3'; g.fillText('decfreedom.com', W - 18, 47);
  // la grafica, a su resolucion nativa
  try {
    g.drawImage(ch, 0, top);
    if (pane.fx && pane.fx.width) g.drawImage(pane.fx, 0, top, W, H);
    if (pane.ux && pane.ux.width) g.drawImage(pane.ux, 0, top, W, H);
    const cvh = pane.body.querySelector('.nv-cvh'); if (cvh && cvh.width) g.drawImage(cvh, 0, top, W, H);
  } catch (_) {}
  // marca de agua abajo a la izquierda, POR ENCIMA del eje de tiempo
  if (imgWm && imgWm.width) { const wmH = 26, wmW = imgWm.width * (wmH / imgWm.height); g.save(); g.globalAlpha = .8; g.drawImage(imgWm, 18, out.height - wmH - 34, wmW, wmH); g.restore(); }
  return out;
}
async function guardarImagenTodas() {
  const ps = S.paneles.filter((p) => !p.flotante); if (!ps.length) return;
  const cols = ps.length <= 1 ? 1 : 2, filas = Math.ceil(ps.length / cols);
  const cw = 760, ch = 460, gap = 10, pad = 14, top = 52;
  const W = pad * 2 + cols * cw + (cols - 1) * gap, H = top + pad * 2 + filas * ch + (filas - 1) * gap;
  const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d');
  g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H); g.fillStyle = '#E8B84B'; g.fillRect(0, 0, W, 4);
  g.fillStyle = '#eaecef'; g.font = '800 22px "Chakra Petch", sans-serif'; g.textAlign = 'left'; g.fillText('Multichart', pad, 38);
  g.fillStyle = '#6b7580'; g.font = '700 13px "IBM Plex Mono", monospace'; g.textAlign = 'right'; g.fillText('decfreedom.com', W - pad, 36);
  ps.forEach((p, i) => {
    const cx = pad + (i % cols) * (cw + gap), cy = top + pad + ((i / cols) | 0) * (ch + gap);
    g.fillStyle = '#0b0f15'; redondea(g, cx, cy, cw, ch, 10); g.fill();
    try { const shot = p.chart.takeScreenshot(); g.save(); redondea(g, cx + 1, cy + 30, cw - 2, ch - 31, 8); g.clip(); g.drawImage(shot, cx + 1, cy + 30, cw - 2, ch - 31); if (p.fx && p.fx.width) g.drawImage(p.fx, cx + 1, cy + 30, cw - 2, ch - 31); if (p.ux && p.ux.width) g.drawImage(p.ux, cx + 1, cy + 30, cw - 2, ch - 31); const cvh = p.body.querySelector('.nv-cvh'); if (cvh && cvh.width) g.drawImage(cvh, cx + 1, cy + 30, cw - 2, ch - 31); g.restore(); } catch (_) {}
    g.textAlign = 'left'; g.fillStyle = '#eaecef'; g.font = '800 14px "Chakra Petch", sans-serif'; g.fillText(p.par.id + 'USDT', cx + 12, cy + 21);
    g.fillStyle = '#6b7580'; g.font = '700 11px "IBM Plex Mono", monospace'; g.fillText(p.tf, cx + 14 + g.measureText(p.par.id + 'USDT').width, cy + 20);
  });
  modalImg(out, 'DecFreedom-multichart.png', 'Multichart');
}
function modal(titulo, innerHTML) {
  const old = $('mc-modal'); if (old) old.remove();
  const m = document.createElement('div'); m.className = 'mc-modal'; m.id = 'mc-modal';
  m.innerHTML = `<div class="bx"><div class="bxh"><b>${esc(titulo)}</b><button class="mc-icobtn x" id="mc-mx">${IC.x}</button></div>${innerHTML}</div>`;
  ($('mc-overlay') || document.body).appendChild(m);
  const ce = () => m.remove(); m.querySelector('#mc-mx').onclick = ce; m.onclick = (e) => { if (e.target === m) ce(); };
  return m;
}
function modalImg(cv, fname, titulo) {
  const m = modal(titulo || 'Chart image', `<div class="bxc"></div><div class="bxf"><button class="dl" id="mc-dl">Download image</button><button id="mc-cl">Close</button></div>`);
  m.querySelector('.bxc').appendChild(cv);
  m.querySelector('#mc-cl').onclick = () => m.remove();
  m.querySelector('#mc-dl').onclick = () => { try { cv.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname || 'DecFreedom.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); } catch (_) {} };
}

/* ── Utilidades ── */
function decimales(p) { p = Math.abs(+p || 0); if (p >= 1000) return 2; if (p >= 1) return 2; if (p >= 0.01) return 4; if (p >= 0.0001) return 6; return 8; }
function fmtNum(p) { const d = decimales(p); return Number(p).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
const _MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtFecha(t) { try { const d = new Date(t * 1000); const p = (n) => (n < 10 ? '0' + n : '' + n); return p(d.getDate()) + ' ' + _MESES[d.getMonth()] + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); } catch (_) { return ''; } }
function redondea(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
let tmrToast = null;
function toast(msg) { let t = $('mc-toast'); if (!t) { t = document.createElement('div'); t.id = 'mc-toast'; t.className = 'mc-toast'; ($('mc-overlay') || document.body).appendChild(t); } t.textContent = msg; requestAnimationFrame(() => t.classList.add('on')); clearTimeout(tmrToast); tmrToast = setTimeout(() => t.classList.remove('on'), 2600); }
