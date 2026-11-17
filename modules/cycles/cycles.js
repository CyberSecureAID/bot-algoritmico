/* modules/cycles/cycles.js — "Cycles".
   Sistema de analisis de CICLOS de mercado. Mismo chasis que el resto de Analysis
   (barra superior: Back · selector de moneda · temporalidad · precio · indicadores ·
   idioma · How it works · descargar imagen), grafica de velas EN VIVO por stream de
   Binance (via el espejo data-api.binance.vision que resuelve el bloqueo de EE. UU.).

   Indicadores conmutables (todos reales y calculados, nada de fotos rigidas):
     · rainbow  — Bandas de regresion logaritmica (Rainbow). ADAPTATIVO por moneda.
     · cycles   — Halvings, fases del ciclo y techos/suelos detectados.
     · roadmap  — Canal macro, eventos clave y proyeccion.
   Las velas van POR ENCIMA de los indicadores (fondo del chart transparente, bandas
   detras). Los indicadores NO invaden el eje de precios (se recortan al area util). */

import { PARES, TFS, pintarIcono } from '../../assets/js/niveles/config.js?v=1';

const WEB = 'decfreedom.com';
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const grupoNm = { cripto: 'Crypto', divisa: 'Forex', materia: 'Commodities' };

const LIB = new URL('../trading-demo/vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
let LC = null;
function lib() { return window.LightweightCharts ? Promise.resolve(window.LightweightCharts) : new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.onload = () => res(window.LightweightCharts); s.onerror = rej; document.head.appendChild(s); }); }

/* Temporalidades propias del ciclo (largo plazo), presentadas con el MISMO grid que
   los demas servicios. */
const TFS_CY = [{ id: '1d', n: '1D' }, { id: '1w', n: '1W' }, { id: '1M', n: '1M' }];

let _par = 'BTC', _tf = '1w', _ind = 'rainbow', _lang = 'en';
const C = { chart: null, serie: null, scaffT: null, scaffB: null, velas: [], precio: 0, fx: null, body: null, cargando: true, rb: null, tiempos: [] };
let _stream = null, _streamKey = '', _pulso = null;

/* ── Idioma (por defecto ingles) ── */
const T = {
  en: { analysis: 'ANALYSIS', spot: 'SPOT', back: 'Back', how: 'How it works', langTitle: 'Español', loading: 'Loading market data…', fail: 'Could not load. Try again.',
        indRainbow: 'Rainbow', indCycles: 'Cycles', indRoadmap: 'Roadmap', fair: 'fair value', since: 'day', ofCycle: 'into the cycle', halving: 'Halving',
        top: 'Cycle top', bottom: 'Cycle bottom', center: 'Fair value', upper: 'Upper band', lower: 'Lower band', etf: 'Spot ETF', election: 'US election', covid: 'COVID crash', projTop: 'Projected top', filter: 'Filter…', got: 'Got it', learn: 'Learn more' },
  es: { analysis: 'ANÁLISIS', spot: 'SPOT', back: 'Atrás', how: 'Cómo funciona', langTitle: 'English', loading: 'Cargando datos de mercado…', fail: 'No se pudo cargar. Reintenta.',
        indRainbow: 'Rainbow', indCycles: 'Ciclos', indRoadmap: 'Hoja de ruta', fair: 'valor justo', since: 'día', ofCycle: 'del ciclo', halving: 'Halving',
        top: 'Techo de ciclo', bottom: 'Suelo de ciclo', center: 'Valor justo', upper: 'Banda superior', lower: 'Banda inferior', etf: 'ETF al contado', election: 'Elecciones EE. UU.', covid: 'Caída COVID', projTop: 'Techo proyectado', filter: 'Filtrar…', got: 'Entendido', learn: 'Siguiente' }
};
const t = (k) => (T[_lang] && T[_lang][k]) || T.en[k] || k;

/* ── Halvings de Bitcoin (hechos reales) ── */
const HALVINGS = [
  { ts: Date.UTC(2012, 10, 28) / 1000, n: 1, en: 'Nov 2012', es: 'Nov 2012' },
  { ts: Date.UTC(2016, 6, 9) / 1000, n: 2, en: 'Jul 2016', es: 'Jul 2016' },
  { ts: Date.UTC(2020, 4, 11) / 1000, n: 3, en: 'May 2020', es: 'May 2020' },
  { ts: Date.UTC(2024, 3, 20) / 1000, n: 4, en: 'Apr 2024', es: 'Abr 2024' },
  { ts: Date.UTC(2028, 3, 20) / 1000, n: 5, en: 'Apr 2028', es: 'Abr 2028' }
];
/* Eventos macro (hechos reales) para Roadmap. */
const EVENTOS = [
  { ts: Date.UTC(2020, 2, 12) / 1000, k: 'covid', col: '#ff5b6e' },
  { ts: Date.UTC(2024, 0, 11) / 1000, k: 'etf', col: '#E8B84B' },
  { ts: Date.UTC(2016, 10, 8) / 1000, k: 'election', col: '#8fa4ff' },
  { ts: Date.UTC(2020, 10, 3) / 1000, k: 'election', col: '#8fa4ff' },
  { ts: Date.UTC(2024, 10, 5) / 1000, k: 'election', col: '#8fa4ff' }
];

/* ── Rainbow / regresion logaritmica. Para BTC, formula calibrada al chart clasico.
   Para el resto, ADAPTATIVO: se ajusta a la propia historia de la moneda, con bandas
   segun su volatilidad (z-scores). Asi vale para cualquier moneda sin romperse. ── */
const RB_ORIG = Date.UTC(2010, 6, 17) / 1000;
const RB_A = 1.49423, RB_B = -8.11429;
const RB_OFF = [-0.46, -0.345, -0.23, -0.115, 0.0, 0.115, 0.23, 0.345, 0.46, 0.60];
const RB_ZONAS = [
  { c: '#3a4fb5', en: 'Bitcoin is dead', es: 'Bitcoin ha muerto' },
  { c: '#3f6fe0', en: 'Basically a Fire Sale', es: 'Prácticamente regalado' },
  { c: '#3aa0f2', en: 'BUY!', es: '¡COMPRA!' },
  { c: '#2fb79a', en: 'Accumulate', es: 'Acumula' },
  { c: '#51c457', en: 'Still cheap', es: 'Aún barato' },
  { c: '#d8ce45', en: 'HODL!', es: '¡HODL!' },
  { c: '#e7a436', en: 'Is this a bubble?', es: '¿Es una burbuja?' },
  { c: '#e76a2c', en: 'Sell. Seriously, SELL!', es: 'Vende. En serio, ¡VENDE!' },
  { c: '#e23b3b', en: 'Maximum Bubble Territory', es: 'Zona de burbuja máxima' }
];
function configRainbow() {
  if (_par === 'BTC') {
    C.rb = { a: RB_A, b: RB_B, orig: RB_ORIG, off: RB_OFF.slice(), ini: Date.UTC(2013, 0, 7) / 1000, fin: Date.UTC(2029, 11, 31) / 1000, btc: true };
    return;
  }
  const v = C.velas; if (!v || v.length < 24) { C.rb = null; return; }
  const orig = v[0].time - 180 * 86400;
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const c of v) { if (!(c.close > 0)) continue; const d = Math.max(1, (c.time - orig) / 86400); const x = Math.log(d), y = Math.log10(c.close); n++; sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1), b = (sy - a * sx) / n;
  let ss = 0, cn = 0;
  for (const c of v) { if (!(c.close > 0)) continue; const d = Math.max(1, (c.time - orig) / 86400); const r = Math.log10(c.close) - (a * Math.log(d) + b); ss += r * r; cn++; }
  const sg = Math.max(0.05, Math.sqrt(ss / (cn || 1)));
  const Z = [-2.3, -1.75, -1.2, -0.62, -0.05, 0.52, 1.1, 1.68, 2.25, 2.95];
  C.rb = { a, b, orig, off: Z.map((z) => z * sg), ini: v[0].time, fin: v[v.length - 1].time + 730 * 86400, btc: false };
}
function rbCentro(tsec) { const r = C.rb; if (!r) return 0; return Math.pow(10, r.a * Math.log(Math.max(1, (tsec - r.orig) / 86400)) + r.b); }
function rbBanda(tsec, k) { const r = C.rb; if (!r) return 0; return Math.pow(10, r.a * Math.log(Math.max(1, (tsec - r.orig) / 86400)) + r.b + r.off[k]); }
function zonaDe(tsec, precio) { const r = C.rb; if (!r) return 4; for (let k = r.off.length - 1; k >= 1; k--) { if (precio >= rbBanda(tsec, k - 1)) return Math.min(RB_ZONAS.length - 1, k - 1); } return 0; }

/* ── Datos (Binance con respaldo de hosts; el shim reescribe al espejo para EE. UU.) ── */
const HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision', 'https://api-gcp.binance.com', 'https://api1.binance.com'];
let _host = 0;
async function cyFetch(path) {
  const orden = [_host, ...HOSTS.map((_, i) => i).filter((i) => i !== _host)];
  let err;
  for (const i of orden) {
    try { const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 5000); const r = await fetch(HOSTS[i] + path, { signal: ctl.signal }); clearTimeout(to); if (r.ok) { _host = i; return r; } err = new Error('HTTP ' + r.status); }
    catch (e) { err = e; }
  }
  throw err || new Error('sin datos');
}
async function traerVelas(simbolo, tf, n = 1000) {
  const r = await cyFetch(`/api/v3/klines?symbol=${simbolo}&interval=${tf}&limit=${n}`);
  const j = await r.json();
  return j.map((x) => ({ time: Math.floor(x[0] / 1000), open: +x[1], high: +x[2], low: +x[3], close: +x[4] }));
}
function streamVelas(simbolo, tf, onK) {
  const url = `wss://stream.binance.com:9443/ws/${String(simbolo).toLowerCase()}@kline_${tf}`;
  let ws = null, cerrado = false, tmr = null;
  const abrir = () => {
    if (cerrado) return;
    try { ws = new WebSocket(url); } catch (_) { tmr = setTimeout(abrir, 2500); return; }
    ws.onmessage = (ev) => { try { const d = JSON.parse(ev.data); if (d && d.k) onK(d.k); } catch (_) {} };
    ws.onclose = () => { if (!cerrado) { clearTimeout(tmr); tmr = setTimeout(abrir, 2500); } };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  };
  abrir();
  return { cerrar: () => { cerrado = true; clearTimeout(tmr); try { if (ws) ws.close(); } catch (_) {} } };
}
function conectarStream() {
  const p = PARES.find((x) => x.id === _par) || {}; if (!p.s) return;
  const key = p.s + '|' + _tf;
  if (_streamKey === key && _stream) return;
  if (_stream) { try { _stream.cerrar(); } catch (_) {} _stream = null; }
  _streamKey = key;
  try { _stream = streamVelas(p.s, _tf, onKline); } catch (_) { _stream = null; }
}
function onKline(k) {
  if (!k || !C.velas.length || !C.serie) return;
  const c = { time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c };
  if (!(c.close > 0)) return;
  const last = C.velas[C.velas.length - 1];
  if (c.time === last.time) C.velas[C.velas.length - 1] = c;
  else if (c.time > last.time) C.velas.push(c);
  else return;
  C.precio = c.close;
  try { C.serie.update(c); } catch (_) {}
  pintarPrecio(); dibujarFx();
}

const fmt = (p) => {
  if (!(p > 0)) return '—';
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(8);
};
function tfNom(tf) { const o = TFS_CY.find((x) => x.id === tf) || TFS.find((x) => x.id === tf); return o ? o.n : tf; }

/* ══════════════════ APERTURA ══════════════════ */
export async function abrirCycles() {
  estilos();
  const prev = $('cy-overlay'); if (prev) prev.remove();
  C.velas = []; C.cargando = true;
  const p0 = PARES.find((p) => p.id === _par) || PARES[0]; _par = p0.id;
  const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';

  const d = document.createElement('div'); d.id = 'cy-overlay';
  d.innerHTML = `<div class="cy-bg"></div>
    <div class="cy-c">
      <div class="cy-barra">
        <button class="cy-back" id="cy-back" aria-label="${esc(t('back'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg><span>${esc(t('back'))}</span></button>
        <button class="cy-sel" id="cy-sel"><i class="cy-logo" id="cy-logo" data-cg="${esc(p0.cg || '')}" data-ico="${esc(p0.ico || '')}"></i><b id="cy-par">${esc(_par)}</b><span id="cy-nm">${esc(p0.n || '')}</span>${chev}</button>
        <button class="cy-tfchip" id="cy-tfchip" type="button"><b id="cy-tf-t">${esc(tfNom(_tf))}</b>${chev}</button>
        <div class="cy-px"><div class="cy-px-v" id="cy-px">—</div><div class="cy-sub" id="cy-sub">—</div></div>
        <span class="cy-badge">${esc(t('analysis'))}</span><span class="cy-badge cy-spot">${esc(t('spot'))}</span>
        <div class="cy-switch" id="cy-switch">
          <button class="cy-tab on" data-ind="rainbow">${esc(t('indRainbow'))}</button>
          <button class="cy-tab" data-ind="cycles">${esc(t('indCycles'))}</button>
          <button class="cy-tab" data-ind="roadmap">${esc(t('indRoadmap'))}</button>
        </div>
        <div class="cy-der">
          <button class="cy-lang" id="cy-lang" title="${esc(t('langTitle'))}">${_lang === 'en' ? 'ES' : 'EN'}</button>
          <button class="cy-ico" id="cy-how" title="${esc(t('how'))}">?</button>
          <button class="cy-ico" id="cy-dl" title="Save image"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.5"/></svg></button>
        </div>
      </div>
      <div class="cy-graf" id="cy-graf">
        <canvas class="cy-fx" id="cy-fx"></canvas>
        <div class="cy-mount" id="cy-mount"></div>
        <div class="cy-leyenda" id="cy-leyenda"></div>
        <img class="cy-marca" src="${LOGO}" alt="">
        <div class="cy-esperando" id="cy-esperando"><div class="cy-spin"></div><b id="cy-esperando-t">${esc(t('loading'))}</b></div>
      </div>
    </div>`;
  document.body.appendChild(d);

  d.querySelector('.cy-bg').onclick = cerrar;
  $('cy-back').onclick = cerrar;
  $('cy-sel').onclick = (e) => { e.stopPropagation(); menuPares(); };
  $('cy-tfchip').onclick = (e) => { e.stopPropagation(); menuTf(); };
  $('cy-how').onclick = ayuda;
  $('cy-lang').onclick = cambiarIdioma;
  $('cy-dl').onclick = guardarImagen;
  $('cy-switch').querySelectorAll('.cy-tab').forEach((b) => b.onclick = () => setInd(b.dataset.ind));

  ponerLogos();
  try { LC = await lib(); } catch (_) { return; }
  montarChart();
  cargarVelas();
  window.addEventListener('resize', onResize);
  clearInterval(_pulso); _pulso = setInterval(() => { if ($('cy-fx') && !C.cargando) dibujarFx(); }, 1000);   // repinta la vela viva
}

function cerrar() {
  clearInterval(_pulso);
  try { if (_stream) _stream.cerrar(); } catch (_) {} _stream = null; _streamKey = '';
  window.removeEventListener('resize', onResize);
  try { if (C.chart) C.chart.remove(); } catch (_) {} C.chart = null; C.serie = null;
  ['cy-hw-box', 'cy-picker', 'cy-tfmenu', 'cy-img'].forEach((id) => { const e = $(id); if (e) e.remove(); });
  const ov = $('cy-overlay'); if (ov) ov.remove();
  if (window.__ANALISIS_PAGINA__ && !document.getElementById('an-root')) { try { location.href = new URL('../../index.html', import.meta.url).href; } catch (_) {} }
}

/* ── Chart: velas por ENCIMA del indicador (fondo transparente, rainbow detras) ── */
function montarChart() {
  const mount = $('cy-mount'); if (!mount) return;
  const chart = LC.createChart(mount, {
    autoSize: true, localization: { locale: _lang === 'es' ? 'es' : 'en' },
    layout: { background: { type: 'solid', color: 'rgba(0,0,0,0)' }, textColor: '#8b95a1', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, attributionLogo: false },
    grid: { vertLines: { color: 'rgba(255,255,255,.035)' }, horzLines: { color: 'rgba(255,255,255,.035)' } },
    rightPriceScale: { borderColor: '#222b35', mode: (LC.PriceScaleMode ? LC.PriceScaleMode.Logarithmic : 1), scaleMargins: { top: 0.06, bottom: 0.06 }, entireTextOnly: true },
    timeScale: { borderColor: '#222b35', timeVisible: false, secondsVisible: false, rightOffset: 6, barSpacing: 7 },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  C.chart = chart;
  C.scaffT = chart.addSeries(LC.LineSeries, { color: 'rgba(0,0,0,0)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  C.scaffB = chart.addSeries(LC.LineSeries, { color: 'rgba(0,0,0,0)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  C.serie = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#9ff5c0', wickDownColor: '#ffb0ba', priceLineVisible: true, lastValueVisible: true });
  C.fx = $('cy-fx'); C.body = $('cy-graf');
  chart.timeScale().subscribeVisibleLogicalRangeChange(() => dibujarFx());
}
function construirAndamio() {
  const r = C.rb; if (!r) { C.tiempos = []; try { C.scaffT.setData([]); C.scaffB.setData([]); } catch (_) {} return; }
  const semana = 7 * 86400, top = [], bot = [], tiempos = [];
  for (let ts = Math.floor(r.ini); ts <= r.fin; ts += semana) { top.push({ time: ts, value: rbBanda(ts, r.off.length - 1) }); bot.push({ time: ts, value: rbBanda(ts, 0) }); tiempos.push(ts); }
  C.tiempos = tiempos;
  try { C.scaffT.setData(top); C.scaffB.setData(bot); } catch (_) {}
}

async function cargarVelas() {
  const p = PARES.find((x) => x.id === _par) || {}; if (!p.s) return;
  C.cargando = true; mostrarEspera(true);
  const gen = (C._gen = (C._gen || 0) + 1);
  try {
    const v = await traerVelas(p.s, _tf, 1000);
    if (gen !== C._gen) return;                   // llego una peticion vieja: ignorar
    if (!v.length) throw new Error('vacio');
    C.velas = v; C.precio = v[v.length - 1].close;
    configRainbow(); construirAndamio();
    C.serie.setData(v);
    C.chart.timeScale().fitContent();
    C.cargando = false; mostrarEspera(false);
    pintarPrecio(); dibujarFx();
    conectarStream();
  } catch (_) {
    if (gen !== C._gen) return;
    C.cargando = false;
    const e = $('cy-esperando-t'); if (e) e.textContent = t('fail');
  }
}
function mostrarEspera(v) { const e = $('cy-esperando'); if (e) e.style.display = v ? '' : 'none'; }

function pintarPrecio() {
  const px = $('cy-px'); if (px) px.textContent = fmt(C.precio);
  const sub = $('cy-sub'); if (!sub) return;
  if (C.precio <= 0 || !C.rb) { sub.textContent = ''; return; }
  const now = Math.floor(Date.now() / 1000);
  if (_ind === 'rainbow') {
    const rel = C.precio / rbCentro(now), z = RB_ZONAS[zonaDe(now, C.precio)] || RB_ZONAS[4];
    sub.innerHTML = `<i style="background:${z.c}"></i>${esc(z[_lang] || z.en)} · ${rel >= 1 ? '+' : ''}${((rel - 1) * 100).toFixed(0)}% ${esc(t('fair'))}`;
  } else if (_ind === 'cycles' && _par === 'BTC') {
    const h = HALVINGS.filter((x) => x.ts <= now).slice(-1)[0];
    if (h) { const dias = Math.round((now - h.ts) / 86400); sub.innerHTML = `<i style="background:#E8B84B"></i>${esc(t('since'))} ${dias} ${esc(t('ofCycle'))} · ${esc(t('halving'))} ${h.n}`; }
    else sub.textContent = '';
  } else if (_ind === 'roadmap') {
    const rel = C.precio / rbCentro(now);
    sub.innerHTML = `<i style="background:#E8B84B"></i>${rel >= 1 ? '+' : ''}${((rel - 1) * 100).toFixed(0)}% ${esc(t('fair'))}`;
  } else sub.textContent = '';
}

/* ── Overlay: recorta al area util (no invade el eje de precios) y dibuja el indicador ── */
function ejeAncho() { try { const w = C.chart.priceScale('right').width(); return (w && w > 10) ? w : 64; } catch (_) { return 64; } }
function dibujarFx() {
  const fx = C.fx, body = C.body; if (!fx || !body || !C.serie || !C.chart) return;
  const W = body.clientWidth, H = body.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (fx.width !== Math.round(W * dpr) || fx.height !== Math.round(H * dpr)) { fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); }
  fx.style.width = W + 'px'; fx.style.height = H + 'px';
  const g = fx.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (C.cargando || !C.rb) { pintarLeyenda(false); return; }
  const Wp = Math.max(10, W - ejeAncho());             // area de ploteo (sin el eje)
  g.save(); g.beginPath(); g.rect(0, 0, Wp, H); g.clip();
  if (_ind === 'rainbow') dibujarRainbow(g, Wp, H);
  else if (_ind === 'cycles') dibujarCycles(g, Wp, H);
  else dibujarRoadmap(g, Wp, H);
  g.restore();
}
const Yp = (p) => { try { const c = C.serie.priceToCoordinate(p); return c == null ? null : c; } catch (_) { return null; } };
const Tc = (tsec) => { try { const c = C.chart.timeScale().timeToCoordinate(tsec); return c == null ? null : c; } catch (_) { return null; } };
/* Para fechas sueltas (halvings, eventos) que no caen en una vela/andamio semanal,
   timeToCoordinate devuelve null: ajustamos a la semana mas cercana del andamio. */
function TcNear(tsec) {
  const x = Tc(tsec); if (x != null) return x;
  const ta = C.tiempos; if (!ta || !ta.length) return null;
  let best = ta[0], bd = Infinity; for (const tt of ta) { const dd = Math.abs(tt - tsec); if (dd < bd) { bd = dd; best = tt; } }
  return Tc(best);
}
function hexA(hex, a) { const h = hex.replace('#', ''); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; }

function dibujarRainbow(g, W, H) {
  const cols = [];
  for (let i = 0; i < C.tiempos.length; i++) { const ts = C.tiempos[i], x = Tc(ts); if (x == null || x < -40 || x > W + 40) continue; const ys = []; for (let k = 0; k < C.rb.off.length; k++) ys.push(Yp(rbBanda(ts, k))); cols.push({ x, ys }); }
  for (let z = 0; z < RB_ZONAS.length; z++) {
    g.beginPath(); let ab = false;
    for (let i = 0; i < cols.length; i++) { const c = cols[i]; if (!c || c.ys[z] == null) { ab = false; continue; } if (!ab) { g.moveTo(c.x, c.ys[z]); ab = true; } else g.lineTo(c.x, c.ys[z]); }
    for (let i = cols.length - 1; i >= 0; i--) { const c = cols[i]; if (!c || c.ys[z + 1] == null) continue; g.lineTo(c.x, c.ys[z + 1]); }
    g.closePath(); g.fillStyle = hexA(RB_ZONAS[z].c, 0.62); g.fill();
  }
  pintarLeyenda(true);
}

/* Techos y suelos de ciclo a partir de las velas reales. BTC: un techo por halving
   (el maximo en los ~2 años posteriores, cuando historicamente llega el techo) y un
   suelo entre techos consecutivos (el minimo de la etapa bajista). Otras monedas:
   maximo historico y su suelo posterior (adaptativo). */
function extremosCiclo() {
  const v = C.velas; if (!v || v.length < 10) return { tops: [], bottoms: [] };
  const fin = v[v.length - 1].time;
  const maxHigh = (a, b) => { let hi = -Infinity, t = a; for (const c of v) { if (c.time < a || c.time > b) continue; if (c.high > hi) { hi = c.high; t = c.time; } } return hi > 0 ? { ts: t, p: hi } : null; };
  const minLow = (a, b) => { let lo = Infinity, t = a; for (const c of v) { if (c.time < a || c.time > b) continue; if (c.low < lo) { lo = c.low; t = c.time; } } return lo < Infinity ? { ts: t, p: lo } : null; };
  let tops = [];
  if (_par === 'BTC') { HALVINGS.forEach((h) => { const tp = maxHigh(h.ts + 120 * 86400, h.ts + 790 * 86400); if (tp) tops.push(tp); }); }
  else { const ath = maxHigh(v[0].time, fin); if (ath) tops.push(ath); }
  const topsU = []; tops.sort((a, b) => a.ts - b.ts).forEach((tp) => { if (!topsU.length || tp.ts - topsU[topsU.length - 1].ts > 150 * 86400) topsU.push(tp); });
  const bottoms = [];
  for (let i = 1; i < topsU.length; i++) { const bt = minLow(topsU[i - 1].ts, topsU[i].ts); if (bt) bottoms.push(bt); }
  if (topsU.length) { const last = topsU[topsU.length - 1]; if (fin - last.ts > 90 * 86400) { const bt = minLow(last.ts, fin); if (bt && bt.ts > last.ts) bottoms.push(bt); } }
  return { tops: topsU, bottoms };
}

function dibujarCycles(g, W, H) {
  pintarLeyenda(false);
  const v = C.velas; if (!v || !v.length) return;
  // sombreado de ciclos entre halvings (BTC) y lineas verticales
  if (_par === 'BTC') {
    const bordes = [v[0].time, ...HALVINGS.map((h) => h.ts), v[v.length - 1].time + 730 * 86400];
    for (let i = 0; i < bordes.length - 1; i++) {
      let x0 = TcNear(bordes[i]), x1 = TcNear(bordes[i + 1]); if (x0 == null && x1 == null) continue;
      x0 = Math.max(0, x0 == null ? 0 : x0); x1 = Math.min(W, x1 == null ? W : x1);
      if (x1 > x0) { g.fillStyle = (i % 2 ? 'rgba(232,184,75,.035)' : 'rgba(80,120,255,.03)'); g.fillRect(x0, 0, x1 - x0, H); }
    }
    HALVINGS.forEach((h, i) => {
      const x = TcNear(h.ts); if (x == null || x < 0 || x > W) return;
      g.save(); g.strokeStyle = 'rgba(232,184,75,.5)'; g.lineWidth = 1.3; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(x, 36); g.lineTo(x, H); g.stroke(); g.restore();
      chip(g, Math.min(W - 4, x + 6), 24, `${t('halving')} ${h.n} · ${h[_lang] || h.en}`, '#E8B84B', 'left');
    });
  }
  // linea de valor justo (centro de la regresion)
  lineaTiempo(g, W, (ts) => rbCentro(ts), 'rgba(232,184,75,.85)', 2, [6, 4]);
  // techos (rojo) y suelos (verde) detectados
  const ex = extremosCiclo();
  ex.tops.forEach((s) => { const x = Tc(s.ts), y = Yp(s.p); if (x != null && y != null && x > 0 && x < W) { triangulo(g, x, y - 9, '#e23b3b', true); chip(g, x, y - 32, t('top') + ' · ' + fmt(s.p), '#e23b3b', 'center'); } });
  ex.bottoms.forEach((s) => { const x = Tc(s.ts), y = Yp(s.p); if (x != null && y != null && x > 0 && x < W) { triangulo(g, x, y + 9, '#2ee86a', false); chip(g, x, y + 22, t('bottom') + ' · ' + fmt(s.p), '#2ee86a', 'center'); } });
}

function dibujarRoadmap(g, W, H) {
  pintarLeyenda(false);
  const r = C.rb; if (!r) return;
  // canal: banda superior (resistencia), centro (valor justo), banda inferior (soporte)
  const kUp = r.off.length - 2, kLo = 1;
  rellenoCanal(g, W, kLo, kUp);
  lineaTiempo(g, W, (ts) => rbBanda(ts, kUp), 'rgba(226,59,59,.85)', 2, []);
  lineaTiempo(g, W, (ts) => rbCentro(ts), 'rgba(232,184,75,.85)', 2, [6, 4]);
  lineaTiempo(g, W, (ts) => rbBanda(ts, kLo), 'rgba(46,232,106,.85)', 2, []);
  // halvings suaves (BTC)
  if (_par === 'BTC') HALVINGS.forEach((h) => { const x = TcNear(h.ts); if (x == null || x < 0 || x > W) return; g.save(); g.strokeStyle = 'rgba(255,255,255,.1)'; g.setLineDash([4, 5]); g.beginPath(); g.moveTo(x, 34); g.lineTo(x, H); g.stroke(); g.restore(); });
  // eventos macro (BTC): linea tenue de arriba a abajo + punto + etiqueta escalonada
  if (_par === 'BTC') EVENTOS.forEach((e, i) => {
    const x = TcNear(e.ts); if (x == null || x < 0 || x > W) return;
    const yTop = 62 + (i % 3) * 25;
    g.save(); g.strokeStyle = hexA(e.col, 0.45); g.lineWidth = 1; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(x, yTop + 4); g.lineTo(x, H); g.stroke(); g.restore();
    g.save(); g.shadowColor = hexA(e.col, 0.8); g.shadowBlur = 7; g.fillStyle = e.col; g.beginPath(); g.arc(x, yTop, 4.5, 0, 7); g.fill(); g.restore();
    chip(g, Math.min(W - 4, x + 9), yTop, t(e.k), e.col, 'left');
  });
  // proyeccion: a ~1 año vista, el valor de la banda superior (techo proyectado) y el centro
  const v = C.velas, tProj = (v && v.length ? v[v.length - 1].time : r.fin) + 365 * 86400, xP = TcNear(tProj);
  if (xP != null && xP > 0 && xP < W) {
    g.save(); g.strokeStyle = 'rgba(255,255,255,.14)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(xP, 40); g.lineTo(xP, H); g.stroke(); g.restore();
    const yU = Yp(rbBanda(tProj, kUp)); if (yU != null) chip(g, Math.min(W - 4, xP + 6), yU, `${t('projTop')} · ${fmt(rbBanda(tProj, kUp))}`, '#e23b3b', 'left');
    const yc = Yp(rbCentro(tProj)); if (yc != null) chip(g, Math.min(W - 4, xP + 6), yc, fmt(rbCentro(tProj)), '#E8B84B', 'left');
    const yL = Yp(rbBanda(tProj, kLo)); if (yL != null) chip(g, Math.min(W - 4, xP + 6), yL, fmt(rbBanda(tProj, kLo)), '#2ee86a', 'left');
  }
}

/* Dibuja una curva f(tsec)→precio a lo largo del andamio. */
function lineaTiempo(g, W, f, col, lw, dash) {
  g.save(); g.strokeStyle = col; g.lineWidth = lw; if (dash && dash.length) g.setLineDash(dash); else g.setLineDash([]);
  g.beginPath(); let ab = false;
  for (let i = 0; i < C.tiempos.length; i++) { const ts = C.tiempos[i], x = Tc(ts); if (x == null || x < -40 || x > W + 40) { ab = false; continue; } const y = Yp(f(ts)); if (y == null) { ab = false; continue; } if (!ab) { g.moveTo(x, y); ab = true; } else g.lineTo(x, y); }
  g.stroke(); g.restore();
}
function rellenoCanal(g, W, kLo, kUp) {
  const pts = [];
  for (let i = 0; i < C.tiempos.length; i++) { const ts = C.tiempos[i], x = Tc(ts); if (x == null || x < -40 || x > W + 40) continue; pts.push({ x, yU: Yp(rbBanda(ts, kUp)), yL: Yp(rbBanda(ts, kLo)) }); }
  g.beginPath(); let ab = false;
  for (const p of pts) { if (p.yU == null) { ab = false; continue; } if (!ab) { g.moveTo(p.x, p.yU); ab = true; } else g.lineTo(p.x, p.yU); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; if (p.yL == null) continue; g.lineTo(p.x, p.yL); }
  g.closePath(); g.fillStyle = 'rgba(232,184,75,.05)'; g.fill();
}
function chip(g, x, y, txt, col, align) {
  g.save(); g.font = '700 10.5px "IBM Plex Mono", ui-monospace, monospace';
  const tw = g.measureText(txt).width, pad = 6, w = tw + pad * 2, h = 17;
  let bx = x; if (align === 'center') bx = x - w / 2; else if (align === 'right') bx = x - w;
  g.fillStyle = 'rgba(8,11,16,.82)'; redondea(g, bx, y - h / 2, w, h, 5); g.fill();
  g.strokeStyle = hexA(col, 0.6); g.lineWidth = 1; redondea(g, bx, y - h / 2, w, h, 5); g.stroke();
  g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, bx + pad, y + 0.5);
  g.restore();
}
function triangulo(g, x, y, col, arriba) { g.save(); g.fillStyle = col; g.beginPath(); if (arriba) { g.moveTo(x, y); g.lineTo(x - 6, y - 9); g.lineTo(x + 6, y - 9); } else { g.moveTo(x, y); g.lineTo(x - 6, y + 9); g.lineTo(x + 6, y + 9); } g.closePath(); g.fill(); g.restore(); }
function redondea(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function pintarLeyenda(show) {
  const l = $('cy-leyenda'); if (!l) return;
  if (!show) { l.style.display = 'none'; return; }
  l.style.display = '';
  if (l.dataset.lang === _lang && l.childElementCount) return;
  l.dataset.lang = _lang;
  l.innerHTML = RB_ZONAS.slice().reverse().map((z) => `<span class="cy-lz"><i style="background:${z.c}"></i>${esc(z[_lang] || z.en)}</span>`).join('');
}

function setInd(ind) {
  if (_ind === ind) return; _ind = ind;
  $('cy-switch').querySelectorAll('.cy-tab').forEach((b) => b.classList.toggle('on', b.dataset.ind === ind));
  pintarPrecio(); dibujarFx();
}
function onResize() { if (C.chart) { try { C.chart.applyOptions({}); } catch (_) {} } dibujarFx(); }

function cambiarIdioma() {
  _lang = _lang === 'en' ? 'es' : 'en';
  const lb = $('cy-lang'); if (lb) { lb.textContent = _lang === 'en' ? 'ES' : 'EN'; lb.title = t('langTitle'); }
  const bk = $('cy-back'); if (bk) { const s = bk.querySelector('span'); if (s) s.textContent = t('back'); bk.setAttribute('aria-label', t('back')); }
  const how = $('cy-how'); if (how) how.title = t('how');
  const badges = document.querySelectorAll('#cy-overlay .cy-badge'); if (badges[0]) badges[0].textContent = t('analysis'); if (badges[1]) badges[1].textContent = t('spot');
  const tabs = { rainbow: 'indRainbow', cycles: 'indCycles', roadmap: 'indRoadmap' };
  document.querySelectorAll('#cy-switch .cy-tab').forEach((b) => { b.textContent = t(tabs[b.dataset.ind]); });
  const esp = $('cy-esperando-t'); if (esp && C.cargando) esp.textContent = t('loading');
  pintarPrecio();
  const l = $('cy-leyenda'); if (l) l.dataset.lang = ''; dibujarFx();
  if ($('cy-hw-box')) { $('cy-hw-box').remove(); ayuda(); }
}

/* ── Selector de moneda y temporalidad (EL MISMO que los demas servicios) ── */
function menuPares() {
  if ($('cy-picker')) { $('cy-picker').remove(); return; }
  const ancla = $('cy-sel'); const m = document.createElement('div'); m.id = 'cy-picker'; m.className = 'cy-pop';
  const grupos = {}; PARES.forEach((p) => { (grupos[p.grupo || 'cripto'] = grupos[p.grupo || 'cripto'] || []).push(p); });
  let html = `<div class="cy-cm-top"><input id="cy-cm-q" placeholder="${esc(t('filter'))}" autocomplete="off"></div><div class="cy-cm-list">`;
  ['cripto', 'divisa', 'materia'].forEach((gr) => { if (!grupos[gr]) return; html += `<div class="cy-cm-cat">${grupoNm[gr]}</div>` + grupos[gr].map((p) => `<button class="cy-cm-it ${p.id === _par ? 'on' : ''}" data-id="${esc(p.id)}" data-b="${esc((p.id + ' ' + (p.n || '')).toLowerCase())}"><i class="cy-mini" data-cg="${esc(p.cg || '')}" data-ico="${esc(p.ico || '')}"></i><b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`).join(''); });
  html += '</div>'; m.innerHTML = html; document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, r.left) + 'px';
  ponerLogos(m);
  m.querySelectorAll('.cy-cm-it').forEach((b) => b.onclick = () => { const id = b.dataset.id; m.remove(); if (id !== _par) { _par = id; const p = PARES.find((x) => x.id === id) || {}; const lg = $('cy-logo'); if (lg) { lg.dataset.cg = p.cg || ''; lg.dataset.ico = p.ico || ''; } $('cy-par').textContent = id; $('cy-nm').textContent = p.n || ''; ponerLogos(); cargarVelas(); } });
  const q = m.querySelector('#cy-cm-q'); q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); m.querySelectorAll('.cy-cm-it').forEach((b) => b.style.display = (!v || b.dataset.b.includes(v)) ? '' : 'none'); });
  setTimeout(() => q.focus(), 30);
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function menuTf() {
  if ($('cy-tfmenu')) { $('cy-tfmenu').remove(); return; }
  const ancla = $('cy-tfchip'); const m = document.createElement('div'); m.id = 'cy-tfmenu'; m.className = 'cy-pop cy-tfpop';
  m.innerHTML = TFS_CY.map((x) => `<button class="cy-tf-it ${x.id === _tf ? 'on' : ''}" data-tf="${x.id}">${esc(x.n)}</button>`).join('');
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); const w = m.offsetWidth || 150;
  m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
  m.querySelectorAll('.cy-tf-it').forEach((b) => b.onclick = () => { _tf = b.dataset.tf; $('cy-tf-t').textContent = tfNom(_tf); m.remove(); cargarVelas(); });
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function ponerLogos(root) {
  (root || document).querySelectorAll('.cy-logo, .cy-mini').forEach((el) => {
    const cg = el.dataset.cg, ico = el.dataset.ico; el.style.backgroundImage = '';
    if (ico) { pintarIcono(el); return; }
    if (cg && window.__aurexLogos && window.__aurexLogos[cg]) { el.style.backgroundImage = `url(${window.__aurexLogos[cg]})`; el.classList.add('con'); el.textContent = ''; return; }
    el.textContent = (el.closest('[data-id]')?.dataset.id || _par || '?')[0];
  });
  cargarLogosCache(root);
}
let _logosFetch = null;
function asegurarLogos() {
  if (window.__aurexLogos && Object.keys(window.__aurexLogos).length) return Promise.resolve();
  try { const g = JSON.parse(localStorage.getItem('aurex-logos') || 'null'); if (g && g.datos && Object.keys(g.datos).length) { window.__aurexLogos = g.datos; return Promise.resolve(); } } catch (_) {}
  if (!_logosFetch) {
    const ids = PARES.filter((p) => p.cg).map((p) => p.cg).join(',');
    _logosFetch = fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&per_page=250&page=1`).then((r) => r.json()).then((j) => { const m = {}; j.forEach((x) => { m[x.id] = x.image; }); window.__aurexLogos = m; try { localStorage.setItem('aurex-logos', JSON.stringify({ cuando: Date.now(), datos: m })); } catch (_) {} }).catch(() => { window.__aurexLogos = window.__aurexLogos || {}; });
  }
  return _logosFetch;
}
function cargarLogosCache(root) { asegurarLogos().then(() => aplicarLogos(root)); }
function aplicarLogos(root) {
  if (!window.__aurexLogos) return;
  (root || document).querySelectorAll('.cy-logo, .cy-mini').forEach((el) => { if (el.dataset.ico) return; const cg = el.dataset.cg; const url = cg && window.__aurexLogos[cg]; if (url) { el.style.backgroundImage = `url(${url})`; el.classList.add('con'); el.textContent = ''; } });
}

/* ── How it works (EL MISMO formato que Reaction/Smart Pools) ── */
const PASOS = {
  en: [
    { t: 'What Cycles is', d: 'A home for the big-picture <b>market cycle</b> tools, all on one live chart. Pick a coin, pick an indicator, and read where price sits in its cycle. Everything is computed from real data and keeps updating, candle by candle.', x: 'For Bitcoin, the tools use its real history and halvings. For every other coin they adapt to that coin’s own data.' },
    { t: 'Rainbow', d: 'A <b>logarithmic regression</b> over the whole price history. The colored bands run from deep value at the bottom to bubble territory at the top. Because the bands are a function of time, they rise on their own, so the chart never freezes into an old picture.', x: 'Read the badge: it tells you the band price sits in and how far it is from fair value.' },
    { t: 'Cycles', d: 'Marks the <b>halvings</b> and shades each four year cycle, then reads the real <b>top and bottom</b> of every cycle straight from the candles and counts the days elapsed. It also projects the window where the next top has historically landed.', x: 'The fair value line is the center of the regression. Tops print red, bottoms print green.' },
    { t: 'Roadmap', d: 'A clean <b>macro channel</b>: resistance, fair value and support as one envelope, with the halvings, the key macro events (spot ETF, elections, the COVID crash) and a <b>projection</b> for where the channel points next.', x: 'Built from the same regression, so the projection moves with time instead of being a fixed drawing.' }
  ],
  es: [
    { t: 'Qué es Cycles', d: 'Un hogar para las herramientas de <b>ciclo de mercado</b>, todas sobre una misma gráfica en vivo. Eliges moneda, eliges indicador, y lees en qué punto del ciclo está el precio. Todo se calcula con datos reales y se actualiza vela a vela.', x: 'Para Bitcoin, las herramientas usan su historia real y sus halvings. Para cualquier otra moneda se adaptan a los datos de esa moneda.' },
    { t: 'Rainbow', d: 'Una <b>regresión logarítmica</b> sobre toda la historia del precio. Las bandas de color van del valor profundo abajo a la zona de burbuja arriba. Como dependen del tiempo, suben solas, así que la gráfica nunca se queda en una foto vieja.', x: 'Lee la etiqueta: te dice en qué banda está el precio y a qué distancia del valor justo.' },
    { t: 'Ciclos', d: 'Marca los <b>halvings</b> y sombrea cada ciclo de cuatro años, luego lee el <b>techo y el suelo</b> reales de cada ciclo directo de las velas y cuenta los días transcurridos. Además proyecta la ventana donde el próximo techo ha caído históricamente.', x: 'La línea de valor justo es el centro de la regresión. Los techos salen en rojo, los suelos en verde.' },
    { t: 'Hoja de ruta', d: 'Un <b>canal macro</b> limpio: resistencia, valor justo y soporte como una sola envolvente, con los halvings, los eventos macro clave (ETF al contado, elecciones, la caída del COVID) y una <b>proyección</b> de hacia dónde apunta el canal.', x: 'Construido con la misma regresión, así que la proyección se mueve con el tiempo en vez de ser un dibujo fijo.' }
  ]
};
let _paso = 0;
function ayuda() {
  if ($('cy-hw-box')) { $('cy-hw-box').remove(); return; }
  _paso = 0;
  const d = document.createElement('div'); d.id = 'cy-hw-box';
  d.innerHTML = `<div class="cy-ab-bg"></div>
    <div class="cy-ab-c">
      <button class="cy-ab-x" aria-label="Close">✕</button>
      <div class="cy-ab-eyebrow">Cycles</div>
      <div id="cy-ab-cuerpo"></div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  d.querySelector('.cy-ab-bg').onclick = q; d.querySelector('.cy-ab-x').onclick = q;
  pintarPaso();
}
function pintarPaso() {
  const c = $('cy-ab-cuerpo'); if (!c) return;
  const pasos = PASOS[_lang] || PASOS.en, p = pasos[_paso], ultimo = _paso === pasos.length - 1;
  c.innerHTML = `
    <div class="cy-ab-card">
      <div class="cy-ab-n">${_paso + 1} <em>${_lang === 'es' ? 'de' : 'of'} ${pasos.length}</em></div>
      <div class="cy-ab-t">${esc(p.t)}</div>
      <div class="cy-ab-d">${p.d}</div>
      <div class="cy-ab-x2">${p.x}</div>
    </div>
    <div class="cy-ab-dots">${pasos.map((_, i) => `<i class="${i === _paso ? 'on' : ''}" data-paso="${i}"></i>`).join('')}</div>
    <div class="cy-ab-acts">
      ${_paso > 0 ? `<button class="cy-ab-back" id="cy-ab-back">${esc(_lang === 'es' ? 'Atrás' : 'Back')}</button>` : ''}
      <button class="cy-ab-next" id="cy-ab-next">${ultimo ? esc(t('got')) : esc(t('learn'))}</button>
    </div>`;
  $('cy-ab-next').onclick = () => { if (_paso >= pasos.length - 1) { const b = $('cy-hw-box'); if (b) b.remove(); return; } _paso++; pintarPaso(); };
  const at = $('cy-ab-back'); if (at) at.onclick = () => { _paso = Math.max(0, _paso - 1); pintarPaso(); };
  c.querySelectorAll('[data-paso]').forEach((b) => b.onclick = () => { _paso = Number(b.dataset.paso); pintarPaso(); });
}

/* ── Descargar imagen ── */
async function guardarImagen() {
  if (!C.chart || C.cargando) return;
  let shot; try { shot = C.chart.takeScreenshot(); } catch (_) { return; }
  if (!shot || !shot.width) return;
  const W = shot.width, H = shot.height, top = 58;
  const out = document.createElement('canvas'); out.width = W; out.height = H + top; const g = out.getContext('2d');
  g.fillStyle = '#06080c'; g.fillRect(0, 0, W, H + top);
  g.fillStyle = '#0b1118'; g.fillRect(0, 0, W, top); g.fillStyle = '#E8B84B'; g.fillRect(0, 0, W, 3);
  const cargar = (src, cors) => new Promise((res) => { if (!src) return res(null); const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const p = PARES.find((x) => x.id === _par) || {};
  const coinUrl = p.id ? ('https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/' + String(p.id).toLowerCase() + '.png') : null;
  const [coin, marca] = await Promise.all([cargar(coinUrl, true), cargar(LOGO, false)]);
  const r = 15, cx = 20 + r, cy = 29;
  if (coin && coin.width) { g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip(); g.drawImage(coin, cx - r, cy - r, r * 2, r * 2); g.restore(); }
  else { g.fillStyle = '#232b36'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#eaecef'; g.font = '800 17px "Chakra Petch", sans-serif'; g.fillText(_par + ' · ' + t('ind' + _ind.charAt(0).toUpperCase() + _ind.slice(1)), cx + r + 12, 26);
  g.fillStyle = '#8b96a3'; g.font = '700 11px "IBM Plex Mono", monospace'; g.fillText(tfNom(_tf) + '  ·  ' + fmt(C.precio) + ' USD', cx + r + 12, 45);
  g.textAlign = 'right'; g.fillStyle = '#E8B84B'; g.font = '800 15px "Chakra Petch", sans-serif'; g.fillText('Cycles', W - 18, 26);
  g.fillStyle = '#8b96a3'; g.font = '700 11px "IBM Plex Mono", monospace'; g.fillText(WEB, W - 18, 45);
  try { g.drawImage(shot, 0, top); if (C.fx && C.fx.width) g.drawImage(C.fx, 0, top, W, H); } catch (_) {}
  if (marca && marca.width) { const mh = 26, mw = marca.width * (mh / marca.height); g.save(); g.globalAlpha = .85; g.drawImage(marca, 20, out.height - mh - 20, mw, mh); g.restore(); }
  modalImagen(out, `decfreedom-cycles-${_par}-${_ind}-${Date.now()}.png`);
}
function modalImagen(cv, fname) {
  const m = document.createElement('div'); m.id = 'cy-img'; m.className = 'cy-img';
  m.innerHTML = `<div class="cy-img-bg"></div><div class="cy-img-c"><div class="cy-img-cv"></div><div class="cy-img-acts"><button class="cy-img-dl">Download</button><button class="cy-img-cl">✕</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('.cy-img-cv').appendChild(cv); cv.style.maxWidth = '100%'; cv.style.borderRadius = '10px';
  const cerrar2 = () => m.remove();
  m.querySelector('.cy-img-bg').onclick = cerrar2; m.querySelector('.cy-img-cl').onclick = cerrar2;
  m.querySelector('.cy-img-dl').onclick = () => { try { cv.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); } catch (_) {} };
}

/* ── Estilos (identidad y componentes = Reaction Zones) ── */
let _cssPuesto = false;
function estilos() { if (_cssPuesto || $('cy-css')) { _cssPuesto = true; return; } _cssPuesto = true; const s = document.createElement('style'); s.id = 'cy-css'; s.textContent = CSS; document.head.appendChild(s); }
const CSS = `
  #cy-overlay{position:fixed;inset:0;z-index:9740;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#e7ebf0;--gold:#E8B84B;--line:#1d2630;--mono:"Chakra Petch",ui-monospace,monospace}
  #cy-overlay *{box-sizing:border-box}
  .cy-bg{position:absolute;inset:0;background:radial-gradient(1100px 560px at 80% -10%,rgba(232,184,75,.04),transparent 60%),#070b10}
  .cy-c{position:relative;width:100%;height:100%;display:flex;flex-direction:column}
  .cy-barra{display:flex;align-items:center;gap:10px;height:54px;flex:0 0 auto;padding:0 12px;background:linear-gradient(180deg,#0e141b,#090d12);border-bottom:1px solid var(--line)}
  .cy-back{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px 0 10px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#c3cad3;cursor:pointer;font-weight:700;font-size:13px}
  .cy-back:hover{border-color:var(--gold);color:var(--gold)} .cy-back svg{width:14px;height:14px}
  .cy-sel{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 11px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#e7ebf0;cursor:pointer;font-weight:700;font-size:13px}
  .cy-sel:hover{border-color:var(--gold)} .cy-sel svg{width:13px;height:13px;opacity:.7}
  .cy-sel #cy-nm{color:#7d8794;font-weight:600;font-size:12px}
  .cy-logo,.cy-mini{flex:0 0 auto;border-radius:50%;background:#1b222c center/cover no-repeat;display:grid;place-items:center;font-family:var(--mono);font-weight:800;color:var(--gold);border:1px solid #2a333f;overflow:hidden}
  .cy-logo{width:24px;height:24px;font-size:11px} .cy-mini{width:19px;height:19px;font-size:9px}
  .cy-logo.con,.cy-mini.con{border-color:transparent;color:transparent}
  .cy-tfchip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#e7ebf0;cursor:pointer;font-weight:700;font-size:13px}
  .cy-tfchip:hover{border-color:var(--gold)} .cy-tfchip svg{width:12px;height:12px;opacity:.7}
  .cy-px{display:flex;flex-direction:column;justify-content:center;line-height:1.1;margin-left:2px}
  .cy-px-v{font-family:var(--mono);font-weight:700;font-size:15px;color:#eaecef}
  .cy-sub{font-size:10.5px;color:#8b95a1;display:flex;align-items:center;gap:5px;margin-top:2px}
  .cy-sub i{width:8px;height:8px;border-radius:2px;display:inline-block}
  .cy-badge{font-family:var(--mono);font-size:9px;letter-spacing:.12em;padding:3px 7px;border-radius:6px;border:1px solid #2a333f;color:#8b95a1}
  .cy-spot{color:#2ee86a;border-color:rgba(46,232,106,.35)}
  .cy-switch{display:inline-flex;gap:3px;margin-left:auto;padding:3px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid #1e2631}
  .cy-tab{height:28px;padding:0 14px;border-radius:8px;border:0;background:transparent;color:#8b95a1;font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap;font-family:inherit}
  .cy-tab:hover{color:#eaecef}
  .cy-tab.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;box-shadow:0 2px 10px rgba(232,184,75,.25)}
  .cy-der{display:inline-flex;align-items:center;gap:7px}
  .cy-ico{width:36px;height:36px;display:grid;place-items:center;border-radius:10px;border:1px solid #2a333f;background:rgba(255,255,255,.04);color:#9aa4af;font-weight:800;cursor:pointer}
  .cy-ico:hover{border-color:var(--gold);color:var(--gold)}
  .cy-lang{height:36px;min-width:42px;padding:0 12px;border-radius:10px;border:1px solid #2a333f;background:rgba(255,255,255,.04);color:#9aa4af;font-weight:800;font-size:12.5px;font-family:var(--mono);cursor:pointer}
  .cy-lang:hover{border-color:var(--gold);color:var(--gold)}
  .cy-graf{flex:1 1 auto;min-height:0;position:relative;background:#0a0e14}
  .cy-fx{position:absolute;inset:0;pointer-events:none;z-index:1}
  .cy-mount{position:absolute;inset:0;z-index:2}
  .cy-leyenda{position:absolute;left:16px;top:12px;z-index:4;display:flex;flex-wrap:wrap;gap:6px 12px;max-width:66%;pointer-events:none}
  .cy-lz{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#c3cbd4;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.85)}
  .cy-lz i{width:11px;height:11px;border-radius:3px;display:inline-block}
  .cy-marca{position:absolute;left:64px;bottom:40px;height:42px;width:auto;opacity:.8;pointer-events:none;z-index:4;filter:drop-shadow(0 2px 9px rgba(0,0,0,.95))}
  .cy-esperando{position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(10,14,20,.72);color:#cbd3dc;font-weight:700}
  .cy-spin{width:30px;height:30px;border-radius:50%;border:3px solid rgba(232,184,75,.22);border-top-color:#E8B84B;animation:cyspin .7s linear infinite}
  @keyframes cyspin{to{transform:rotate(360deg)}}
  .cy-pop{position:fixed;z-index:10050;background:#0c1016;border:1px solid #2a333f;border-radius:12px;box-shadow:0 20px 55px rgba(0,0,0,.65);font-family:var(--mono);color:#e7ebf0;max-height:64vh;overflow:auto}
  #cy-picker{width:260px}
  .cy-cm-top{padding:8px;border-bottom:1px solid var(--line)}
  .cy-cm-top input{width:100%;height:32px;border-radius:8px;border:1px solid #2a333f;background:#0a0d12;color:#e7ebf0;padding:0 11px;font-size:12.5px;font-family:var(--mono);outline:none}
  .cy-cm-top input:focus{border-color:var(--gold)}
  .cy-cm-list{overflow-y:auto;padding:6px}
  .cy-cm-cat{font-size:9px;letter-spacing:.14em;color:var(--gold);text-transform:uppercase;padding:8px 8px 4px}
  .cy-cm-it{display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 9px;border-radius:8px;border:0;background:transparent;color:#e7ebf0;cursor:pointer;text-align:left;font-size:13px}
  .cy-cm-it:hover{background:rgba(232,184,75,.1)} .cy-cm-it.on{background:rgba(232,184,75,.16)}
  .cy-cm-it b{font-family:var(--mono);min-width:50px;color:var(--gold);font-weight:800}
  .cy-cm-it span{color:#7d8794;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cy-tfpop{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:6px;min-width:150px;background:#12161c;border-color:#2b3139;border-radius:14px}
  .cy-tf-it{min-height:42px;border-radius:10px;border:1px solid transparent;background:rgba(255,255,255,.04);color:#c7cdd6;cursor:pointer;font-family:var(--mono);font-size:13px;font-weight:700}
  .cy-tf-it:hover{border-color:#3a424c;color:#eaecef}
  .cy-tf-it.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;border-color:var(--gold)}
  #cy-hw-box{position:fixed;inset:0;z-index:10300;display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Plus Jakarta Sans",system-ui,sans-serif}
  .cy-ab-bg{position:absolute;inset:0;background:rgba(3,5,8,.93)}
  .cy-ab-c{position:relative;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid #C9A84B;border-radius:20px;padding:24px 20px}
  .cy-ab-x{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;padding:0;cursor:pointer;font-size:15px;z-index:5;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6}
  .cy-ab-x:hover{border-color:#ff5b6e;color:#ff6b7a}
  .cy-ab-eyebrow{font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:2px;text-align:center;margin-bottom:18px}
  .cy-ab-card{padding:24px 20px;border-radius:16px;text-align:center;margin-bottom:18px;background:linear-gradient(165deg,rgba(232,184,75,.08),rgba(255,255,255,.015));border:1px solid rgba(232,184,75,.26)}
  .cy-ab-n{font-family:var(--mono);font-size:11px;color:var(--gold);font-weight:700;margin-bottom:10px}
  .cy-ab-n em{font-style:normal;color:#5c6672;font-weight:400}
  .cy-ab-t{font-weight:800;font-size:21px;color:#eaecef;margin-bottom:12px;line-height:1.25}
  .cy-ab-d{font-size:14px;color:#b7bdc6;line-height:1.65;margin-bottom:14px}
  .cy-ab-d b{color:var(--gold);font-weight:700}
  .cy-ab-x2{padding:12px 14px;border-radius:11px;background:rgba(255,255,255,.035);border-left:2px solid #C9A84B;font-size:12.5px;color:#8b96a3;line-height:1.55;text-align:left}
  .cy-ab-dots{display:flex;gap:5px;justify-content:center;margin-bottom:18px;flex-wrap:wrap}
  .cy-ab-dots i{width:7px;height:7px;border-radius:50%;background:#2b3139;cursor:pointer;transition:background .18s,transform .18s}
  .cy-ab-dots i.on{background:var(--gold);transform:scale(1.35)}
  .cy-ab-acts{display:flex;gap:9px}
  .cy-ab-back{flex:0 0 auto;min-height:48px;padding:0 20px;border-radius:12px;background:transparent;border:1px solid #2b3139;color:#8b96a3;cursor:pointer;font-weight:700;font-size:13px}
  .cy-ab-back:hover{border-color:#3a424c;color:#b7bdc6}
  .cy-ab-next{flex:1;min-height:48px;border-radius:12px;border:0;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;font-weight:800;font-size:14px;cursor:pointer}
  .cy-img{position:fixed;inset:0;z-index:10400;display:flex;align-items:center;justify-content:center;padding:20px}
  .cy-img-bg{position:absolute;inset:0;background:rgba(3,6,10,.88)}
  .cy-img-c{position:relative;max-width:min(1000px,94vw);max-height:90vh;overflow:auto;display:flex;flex-direction:column;gap:12px}
  .cy-img-acts{display:flex;gap:10px;justify-content:flex-end}
  .cy-img-dl{height:40px;padding:0 18px;border-radius:10px;border:0;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;font-weight:800;cursor:pointer}
  .cy-img-cl{height:40px;width:44px;border-radius:10px;border:1px solid #2a333f;background:rgba(255,255,255,.04);color:#c3cbd4;cursor:pointer}
  @media (max-width:820px){ .cy-switch{order:9;margin:0} .cy-sub{display:none} .cy-leyenda{max-width:100%;font-size:10px} }
`;
