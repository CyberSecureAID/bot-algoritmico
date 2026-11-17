/* modules/cycles/cycles.js — "Cycles".
   Sistema de analisis de CICLOS de Bitcoin. Mismo chasis que el resto de Analysis
   (barra superior: Back · selector de moneda · temporalidad · precio · How it works ·
   idioma · descargar imagen), grafica de velas EN VIVO por stream de Binance (via el
   espejo data-api.binance.vision que resuelve el bloqueo de EE. UU.), y VARIOS
   indicadores de ciclo CONMUTABLES. Todo real y calculado (no una foto rigida): las
   bandas son una funcion del tiempo, asi que se proyectan solas hacia delante.

   Indicadores:
     · rainbow  — Bandas de regresion logaritmica (Rainbow).   [Fase 1, por defecto]
     · cycles   — Halvings y ciclos.                            [proximo]
     · roadmap  — Canal macro y hoja de ruta.                   [proximo]
*/

import { PARES, TFS } from '../../assets/js/niveles/config.js?v=1';

const WEB = 'decfreedom.com';
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Libreria de velas (la misma que Multichart / Trading Demo). */
const LIB = new URL('../trading-demo/vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
let LC = null;
function lib() { return window.LightweightCharts ? Promise.resolve(window.LightweightCharts) : new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.onload = () => res(window.LightweightCharts); s.onerror = rej; document.head.appendChild(s); }); }

/* ── Estado ── */
let _par = 'BTC', _tf = '1w', _ind = 'rainbow', _lang = 'en';
const C = { chart: null, serie: null, scaffT: null, scaffB: null, velas: [], precio: 0, fx: null, body: null, cargando: true, logo: {} };
let _stream = null, _streamKey = '';

/* ── Idioma (por defecto ingles; el usuario puede pasar a espanol) ── */
const T = {
  en: { analysis: 'ANALYSIS', spot: 'SPOT', back: 'Back', how: 'How it works', lang: 'ES', langTitle: 'Español', dl: 'Save image', loading: 'Loading market data…',
        indRainbow: 'Rainbow', indCycles: 'Cycles', indRoadmap: 'Roadmap', soon: 'Coming in the next update', soonSub: 'This cycle tool is on the way. Rainbow is live now.',
        price: 'Price', band: 'Band', fair: 'Fair value', hint: 'Log regression over Bitcoin’s whole history. The band grows with time, so it keeps projecting forward.' },
  es: { analysis: 'ANÁLISIS', spot: 'SPOT', back: 'Atrás', how: 'Cómo funciona', lang: 'EN', langTitle: 'English', dl: 'Guardar imagen', loading: 'Cargando datos de mercado…',
        indRainbow: 'Rainbow', indCycles: 'Ciclos', indRoadmap: 'Hoja de ruta', soon: 'Llega en la próxima actualización', soonSub: 'Esta herramienta de ciclo está en camino. Rainbow ya está activo.',
        price: 'Precio', band: 'Banda', fair: 'Valor justo', hint: 'Regresión logarítmica sobre toda la historia de Bitcoin. La banda crece con el tiempo, así que se proyecta sola hacia delante.' }
};
const t = (k) => (T[_lang] && T[_lang][k]) || T.en[k] || k;

/* ── Rainbow: regresion log ajustada a datos reales (centro de tendencia). ──
   d = dias desde 2010-07-17. log10(precio) = A*ln(d) + B. Las 9 zonas son
   desplazamientos fijos en log10 sobre ese centro. Como depende del tiempo, la
   banda sube sola: nunca se queda "congelada" en una foto. */
const RB_ORIG = Date.UTC(2010, 6, 17);
const RB_A = 1.49423, RB_B = -8.11429;
const rbDias = (tsSec) => Math.max(1, (tsSec * 1000 - RB_ORIG) / 86400000);
const rbCentro = (tsSec) => Math.pow(10, RB_A * Math.log(rbDias(tsSec)) + RB_B);
/* 10 limites (de abajo a arriba) → 9 zonas de color. Calibrado para que los techos
   historicos caigan en rojo y los suelos en azul. */
const RB_OFF = [-0.46, -0.345, -0.23, -0.115, 0.0, 0.115, 0.23, 0.345, 0.46, 0.60];
const rbBanda = (tsSec, k) => Math.pow(10, RB_A * Math.log(rbDias(tsSec)) + RB_B + RB_OFF[k]);
/* Zonas (abajo→arriba): color + nombre EN/ES. */
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

/* ── Datos: Binance klines con respaldo de hosts (el shim reescribe al espejo
   data-api.binance.vision para que EE. UU. tambien vea la grafica). ── */
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

/* ── Stream en vivo ── */
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
  const p = PARES.find((x) => x.id === _par) || {};
  if (!p.s) return;
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

/* ══════════════════ APERTURA ══════════════════ */
export async function abrirCycles() {
  estilos();
  const prev = $('cy-overlay'); if (prev) prev.remove();
  C.velas = []; C.cargando = true;
  const p0 = PARES.find((p) => p.id === _par) || PARES[0]; _par = p0.id;
  const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';

  const d = document.createElement('div');
  d.id = 'cy-overlay';
  d.innerHTML = `<div class="cy-bg"></div>
    <div class="cy-c">
      <div class="cy-barra">
        <button class="cy-back" id="cy-back" aria-label="${esc(t('back'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg><span>${esc(t('back'))}</span></button>
        <button class="cy-sel" id="cy-sel"><i class="cy-logo" id="cy-logo"></i><b id="cy-par">${esc(_par)}</b><span id="cy-nm">${esc(p0.n || '')}</span>${chev}</button>
        <button class="cy-tfchip" id="cy-tfchip" type="button"><b id="cy-tf-t">${esc(tfNom(_tf))}</b>${chev}</button>
        <div class="cy-px"><div class="cy-px-v" id="cy-px">—</div><div class="cy-sub" id="cy-sub">—</div></div>
        <span class="cy-badge">${esc(t('analysis'))}</span><span class="cy-badge cy-spot">${esc(t('spot'))}</span>
        <div class="cy-switch" id="cy-switch">
          <button class="cy-tab on" data-ind="rainbow">${esc(t('indRainbow'))}</button>
          <button class="cy-tab" data-ind="cycles">${esc(t('indCycles'))}</button>
          <button class="cy-tab" data-ind="roadmap">${esc(t('indRoadmap'))}</button>
        </div>
        <div class="cy-der">
          <button class="cy-ico" id="cy-how" title="${esc(t('how'))}">?</button>
          <button class="cy-lang" id="cy-lang" title="${esc(t('langTitle'))}">${esc(t('lang'))}</button>
          <button class="cy-ico" id="cy-dl" title="${esc(t('dl'))}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.5"/></svg></button>
        </div>
      </div>
      <div class="cy-graf" id="cy-graf">
        <div class="cy-mount" id="cy-mount"></div>
        <canvas class="cy-fx" id="cy-fx"></canvas>
        <div class="cy-leyenda" id="cy-leyenda"></div>
        <div class="cy-esperando" id="cy-esperando"><div class="cy-spin"></div><b id="cy-esperando-t">${esc(t('loading'))}</b></div>
        <img class="cy-marca" src="${LOGO}" alt="">
        <div class="cy-dom">${WEB}</div>
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

  ponerLogo();
  try { LC = await lib(); } catch (_) { return; }
  montarChart();
  cargarVelas();
  window.addEventListener('resize', onResize);
}

function tfNom(tf) { const o = TFS.find((x) => x.id === tf); return o ? o.n : tf.toUpperCase(); }

function cerrar() {
  try { if (_stream) _stream.cerrar(); } catch (_) {} _stream = null; _streamKey = '';
  window.removeEventListener('resize', onResize);
  try { if (C.chart) C.chart.remove(); } catch (_) {} C.chart = null; C.serie = null;
  const b = $('cy-hw-box'); if (b) b.remove();
  const ov = $('cy-overlay'); if (ov) ov.remove();
  if (window.__ANALISIS_PAGINA__ && !document.getElementById('an-root')) { try { location.href = new URL('../../index.html', import.meta.url).href; } catch (_) {} }
}

/* ── Chart (LightweightCharts, escala de precio LOGARITMICA) ── */
function montarChart() {
  const mount = $('cy-mount'); if (!mount) return;
  const chart = LC.createChart(mount, {
    autoSize: true, localization: { locale: _lang === 'es' ? 'es' : 'en' },
    layout: { background: { type: 'solid', color: '#06080c' }, textColor: '#8b95a1', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, attributionLogo: false },
    grid: { vertLines: { color: 'rgba(255,255,255,.03)' }, horzLines: { color: 'rgba(255,255,255,.03)' } },
    rightPriceScale: { borderColor: '#222b35', mode: (LC.PriceScaleMode ? LC.PriceScaleMode.Logarithmic : 1), scaleMargins: { top: 0.06, bottom: 0.06 }, entireTextOnly: true },
    timeScale: { borderColor: '#222b35', timeVisible: false, secondsVisible: false, rightOffset: 6, barSpacing: 7, fixLeftEdge: false },
    crosshair: { mode: LC.CrosshairMode ? LC.CrosshairMode.Normal : 0, vertLine: { color: '#C9A84B', width: 1, style: 3, labelBackgroundColor: '#8f6a1a' }, horzLine: { color: '#C9A84B', labelBackgroundColor: '#8f6a1a' } }
  });
  C.chart = chart;
  // Andamios transparentes: fijan el rango del eje (toda la gama del rainbow) y
  // extienden el tiempo al pasado y al futuro, para que las bandas se dibujen enteras.
  C.scaffT = chart.addSeries(LC.LineSeries, { color: 'rgba(0,0,0,0)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  C.scaffB = chart.addSeries(LC.LineSeries, { color: 'rgba(0,0,0,0)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
  C.serie = chart.addSeries(LC.CandlestickSeries, { upColor: '#2ee86a', downColor: '#ff5b6e', borderVisible: false, wickUpColor: '#2ee86a', wickDownColor: '#ff5b6e', priceLineVisible: true, lastValueVisible: true });
  C.fx = $('cy-fx');
  C.body = $('cy-graf');
  chart.timeScale().subscribeVisibleLogicalRangeChange(() => dibujarFx());
  chart.subscribeCrosshairMove((p) => onCross(p));
  // andamio temporal (puntos semanales 2013→2029) para el eje y las bandas
  construirAndamio();
}

/* Puntos semanales desde 2013 hasta ~2029 con los valores de la banda superior e
   inferior: asi el eje log abarca todo el rainbow y el tiempo llega al futuro. */
function construirAndamio() {
  const ini = Math.floor(Date.UTC(2013, 0, 7) / 1000), fin = Math.floor(Date.UTC(2029, 11, 31) / 1000), semana = 7 * 86400;
  const top = [], bot = [], tiempos = [];
  for (let ts = ini; ts <= fin; ts += semana) { top.push({ time: ts, value: rbBanda(ts, RB_OFF.length - 1) }); bot.push({ time: ts, value: rbBanda(ts, 0) }); tiempos.push(ts); }
  C.tiempos = tiempos;
  try { C.scaffT.setData(top); C.scaffB.setData(bot); } catch (_) {}
}

async function cargarVelas() {
  const p = PARES.find((x) => x.id === _par) || {}; if (!p.s) return;
  C.cargando = true; mostrarEspera(true);
  try {
    const v = await traerVelas(p.s, _tf, 1000);
    if (!v.length) throw new Error('vacio');
    C.velas = v; C.precio = v[v.length - 1].close;
    C.serie.setData(v);
    C.chart.timeScale().fitContent();
    C.cargando = false; mostrarEspera(false);
    pintarPrecio(); dibujarFx();
    conectarStream();
  } catch (_) {
    C.cargando = false;
    const e = $('cy-esperando-t'); if (e) e.textContent = _lang === 'es' ? 'No se pudo cargar. Reintenta.' : 'Could not load. Try again.';
  }
}

function mostrarEspera(v) { const e = $('cy-esperando'); if (e) e.style.display = v ? '' : 'none'; }

function pintarPrecio() {
  const px = $('cy-px'); if (px) px.textContent = fmt(C.precio);
  const sub = $('cy-sub');
  if (sub) {
    if (_ind === 'rainbow' && C.precio > 0) {
      const now = Math.floor(Date.now() / 1000), centro = rbCentro(now);
      const rel = C.precio / centro;
      const zi = zonaDe(now, C.precio);
      const z = RB_ZONAS[zi] || RB_ZONAS[4];
      sub.innerHTML = `<i style="background:${z.c}"></i>${esc(z[_lang] || z.en)} · ${rel >= 1 ? '+' : ''}${((rel - 1) * 100).toFixed(0)}% ${_lang === 'es' ? 'vs valor justo' : 'vs fair value'}`;
    } else sub.textContent = '';
  }
}
/* En que zona (0..8) cae un precio en una fecha. */
function zonaDe(tsSec, precio) {
  for (let k = RB_OFF.length - 1; k >= 1; k--) { if (precio >= rbBanda(tsSec, k - 1)) return Math.min(RB_ZONAS.length - 1, k - 1); }
  return 0;
}

/* ── Overlay: dibuja las bandas del indicador activo sobre la grafica ── */
function dibujarFx() {
  const fx = C.fx, body = C.body, serie = C.serie, chart = C.chart;
  if (!fx || !body || !serie || !chart) return;
  const W = body.clientWidth, H = body.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (fx.width !== Math.round(W * dpr) || fx.height !== Math.round(H * dpr)) { fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr); }
  fx.style.width = W + 'px'; fx.style.height = H + 'px';
  const g = fx.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (C.cargando) return;
  if (_ind === 'rainbow') dibujarRainbow(g, W, H);
  else dibujarProximo(g, W, H);
}

function dibujarRainbow(g, W, H) {
  const ts = C.chart.timeScale(), serie = C.serie;
  const Yp = (p) => { try { const c = serie.priceToCoordinate(p); return c == null ? null : c; } catch (_) { return null; } };
  const Tc = (tm) => { try { const c = ts.timeToCoordinate(tm); return c == null ? null : c; } catch (_) { return null; } };
  // Iteramos sobre las FECHAS exactas (semanales) y pedimos su x con timeToCoordinate.
  // Asi cada banda se calcula con su fecha real (nada de coordinateToTime, que el
  // andamio futuro desalineaba). Solo columnas dentro de pantalla, con un margen.
  const tiempos = C.tiempos || [], cols = [];
  for (let i = 0; i < tiempos.length; i++) {
    const tsec = tiempos[i], x = Tc(tsec);
    if (x == null || x < -40 || x > W + 40) continue;
    const ys = [];
    for (let k = 0; k < RB_OFF.length; k++) ys.push(Yp(rbBanda(tsec, k)));
    cols.push({ x, ys });
  }
  // rellena cada zona entre limites consecutivos
  for (let z = 0; z < RB_ZONAS.length; z++) {
    g.beginPath(); let abierto = false;
    for (let i = 0; i < cols.length; i++) { const c = cols[i]; if (!c || c.ys[z] == null) { abierto = false; continue; } if (!abierto) { g.moveTo(c.x, c.ys[z]); abierto = true; } else g.lineTo(c.x, c.ys[z]); }
    for (let i = cols.length - 1; i >= 0; i--) { const c = cols[i]; if (!c || c.ys[z + 1] == null) continue; g.lineTo(c.x, c.ys[z + 1]); }
    g.closePath();
    g.fillStyle = hexA(RB_ZONAS[z].c, 0.5); g.fill();
  }
  // lineas finas en cada limite
  for (let k = 0; k < RB_OFF.length; k++) {
    g.beginPath(); let abierto = false;
    for (let i = 0; i < cols.length; i++) { const c = cols[i]; if (!c || c.ys[k] == null) { abierto = false; continue; } if (!abierto) { g.moveTo(c.x, c.ys[k]); abierto = true; } else g.lineTo(c.x, c.ys[k]); }
    const zc = RB_ZONAS[Math.min(RB_ZONAS.length - 1, k)];
    g.strokeStyle = hexA(zc.c, 0.55); g.lineWidth = 1; g.stroke();
  }
  pintarLeyenda(true);
}

function dibujarProximo(g, W, H) {
  pintarLeyenda(false);
  g.save();
  g.fillStyle = 'rgba(6,8,12,.55)'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.fillStyle = '#E8B84B'; g.font = '800 20px "Chakra Petch", system-ui, sans-serif';
  g.fillText(t('soon'), W / 2, H / 2 - 6);
  g.fillStyle = '#8b95a1'; g.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
  g.fillText(t('soonSub'), W / 2, H / 2 + 20);
  g.restore();
}

/* Leyenda de zonas (arriba del grafico), como el chart original pero en oscuro. */
function pintarLeyenda(show) {
  const l = $('cy-leyenda'); if (!l) return;
  if (!show) { l.style.display = 'none'; return; }
  l.style.display = '';
  if (l.dataset.lang === _lang && l.childElementCount) return;
  l.dataset.lang = _lang;
  l.innerHTML = RB_ZONAS.slice().reverse().map((z) => `<span class="cy-lz"><i style="background:${z.c}"></i>${esc(z[_lang] || z.en)}</span>`).join('');
}

function onCross(p) {
  // (reservado para lectura de banda bajo el cursor; el precio vive en la barra)
}

function setInd(ind) {
  if (_ind === ind) return;
  _ind = ind;
  $('cy-switch').querySelectorAll('.cy-tab').forEach((b) => b.classList.toggle('on', b.dataset.ind === ind));
  pintarPrecio(); dibujarFx();
}

function cambiarIdioma() {
  _lang = _lang === 'en' ? 'es' : 'en';
  // re-render de los textos de la barra
  const setTxt = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const lb = $('cy-lang'); if (lb) { lb.textContent = t('lang'); lb.title = t('langTitle'); }
  const bk = $('cy-back'); if (bk) { const s = bk.querySelector('span'); if (s) s.textContent = t('back'); }
  const how = $('cy-how'); if (how) how.title = t('how');
  const dl = $('cy-dl'); if (dl) dl.title = t('dl');
  const badges = document.querySelectorAll('#cy-overlay .cy-badge'); if (badges[0]) badges[0].textContent = t('analysis'); if (badges[1]) badges[1].textContent = t('spot');
  const tabs = { rainbow: 'indRainbow', cycles: 'indCycles', roadmap: 'indRoadmap' };
  document.querySelectorAll('#cy-switch .cy-tab').forEach((b) => { b.textContent = t(tabs[b.dataset.ind]); });
  const esp = $('cy-esperando-t'); if (esp && C.cargando) esp.textContent = t('loading');
  pintarPrecio();
  const l = $('cy-leyenda'); if (l) l.dataset.lang = ''; dibujarFx();
  if ($('cy-hw-box')) { $('cy-hw-box').remove(); ayuda(); }
}

function onResize() { if (C.chart) { try { C.chart.applyOptions({}); } catch (_) {} } dibujarFx(); }

/* ── Selector de moneda y temporalidad ── */
function ponerLogo() {
  const el = $('cy-logo'); if (!el) return;
  const p = PARES.find((x) => x.id === _par) || {};
  const cg = p.cg;
  if (cg && window.__aurexLogos && window.__aurexLogos[cg]) { el.style.backgroundImage = `url(${window.__aurexLogos[cg]})`; el.classList.add('con'); el.textContent = ''; return; }
  el.textContent = (p.id || '?').slice(0, 1);
}
function cerrarMenus() { document.querySelectorAll('.cy-menu').forEach((m) => m.remove()); }
function menuPares() {
  cerrarMenus();
  const anc = $('cy-sel'); const r = anc.getBoundingClientRect();
  const m = document.createElement('div'); m.className = 'cy-menu';
  m.style.left = r.left + 'px'; m.style.top = (r.bottom + 6) + 'px';
  m.innerHTML = PARES.slice(0, 40).map((p) => `<button class="cy-mi" data-id="${esc(p.id)}"><b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`).join('');
  document.body.appendChild(m);
  m.querySelectorAll('.cy-mi').forEach((b) => b.onclick = () => { const id = b.dataset.id; cerrarMenus(); if (id !== _par) { _par = id; const p = PARES.find((x) => x.id === id) || {}; $('cy-par').textContent = id; $('cy-nm').textContent = p.n || ''; ponerLogo(); cargarVelas(); } });
  const fuera = (ev) => { if (!m.contains(ev.target) && !anc.contains(ev.target)) { cerrarMenus(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 0);
}
function menuTf() {
  cerrarMenus();
  const anc = $('cy-tfchip'); const r = anc.getBoundingClientRect();
  const opciones = ['1d', '1w', '1M'];
  const m = document.createElement('div'); m.className = 'cy-menu cy-menu-tf';
  m.style.left = r.left + 'px'; m.style.top = (r.bottom + 6) + 'px';
  m.innerHTML = opciones.map((id) => `<button class="cy-mi" data-tf="${id}">${esc(tfNom(id))}</button>`).join('');
  document.body.appendChild(m);
  m.querySelectorAll('.cy-mi').forEach((b) => b.onclick = () => { const tf = b.dataset.tf; cerrarMenus(); if (tf !== _tf) { _tf = tf; $('cy-tf-t').textContent = tfNom(tf); cargarVelas(); } });
  const fuera = (ev) => { if (!m.contains(ev.target) && !anc.contains(ev.target)) { cerrarMenus(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 0);
}

/* ── Utilidad de color ── */
function hexA(hex, a) {
  const h = hex.replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ── How it works (modal centrado con flex + colores literales, como Reaction) ── */
const PASOS = {
  en: [
    { t: 'What Cycles is', d: 'A home for Bitcoin’s big-picture cycle tools, all on one live chart. Pick a coin, pick an indicator, and read where price sits in the cycle. Everything is computed from real data and keeps updating, candle by candle.' },
    { t: 'Rainbow', d: 'A logarithmic regression over Bitcoin’s whole history. The colored bands run from deep value at the bottom to bubble territory at the top. Because the bands are a function of time, they rise on their own, so the chart never freezes into an old picture.' },
    { t: 'More tools soon', d: 'Cycles (halvings and intermediate cycles) and Roadmap (a clean macro channel with projection) are on the way, switchable from the top. Same live chart, same style.' }
  ],
  es: [
    { t: 'Qué es Cycles', d: 'Un hogar para las herramientas de ciclo de Bitcoin, todas sobre una misma gráfica en vivo. Eliges moneda, eliges indicador, y lees en qué punto del ciclo está el precio. Todo se calcula con datos reales y se actualiza vela a vela.' },
    { t: 'Rainbow', d: 'Una regresión logarítmica sobre toda la historia de Bitcoin. Las bandas de color van del valor profundo abajo a la zona de burbuja arriba. Como las bandas dependen del tiempo, suben solas, así que la gráfica nunca se queda en una foto vieja.' },
    { t: 'Más herramientas pronto', d: 'Ciclos (halvings y ciclos intermedios) y Hoja de ruta (un canal macro limpio con proyección) están en camino, conmutables desde arriba. Misma gráfica en vivo, mismo estilo.' }
  ]
};
let _paso = 0;
function ayuda() {
  if ($('cy-hw-box')) { $('cy-hw-box').remove(); return; }
  _paso = 0;
  const d = document.createElement('div'); d.id = 'cy-hw-box';
  const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  d.innerHTML = `<div class="cy-hw-bg"></div>
    <div class="cy-hw-c">
      <button class="cy-hw-x" aria-label="Close">${X}</button>
      <div class="cy-hw-eyebrow">Cycles</div>
      <div id="cy-hw-cuerpo"></div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  d.querySelector('.cy-hw-bg').onclick = q; d.querySelector('.cy-hw-x').onclick = q;
  pintarPaso();
}
function pintarPaso() {
  const c = $('cy-hw-cuerpo'); if (!c) return;
  const pasos = PASOS[_lang] || PASOS.en, p = pasos[_paso], ultimo = _paso === pasos.length - 1;
  c.innerHTML = `
    <div class="cy-hw-card">
      <div class="cy-hw-n">${_paso + 1} <em>${_lang === 'es' ? 'de' : 'of'} ${pasos.length}</em></div>
      <div class="cy-hw-t">${esc(p.t)}</div>
      <div class="cy-hw-d">${p.d}</div>
    </div>
    <div class="cy-hw-dots">${pasos.map((_, i) => `<i class="${i === _paso ? 'on' : ''}" data-paso="${i}"></i>`).join('')}</div>
    <div class="cy-hw-acts">
      ${_paso > 0 ? `<button class="cy-hw-back" id="cy-hw-back">${_lang === 'es' ? 'Atrás' : 'Back'}</button>` : ''}
      <button class="cy-hw-next" id="cy-hw-next">${ultimo ? (_lang === 'es' ? 'Entendido' : 'Got it') : (_lang === 'es' ? 'Siguiente' : 'Next')}</button>
    </div>`;
  $('cy-hw-next').onclick = () => { if (_paso >= pasos.length - 1) { const b = $('cy-hw-box'); if (b) b.remove(); return; } _paso++; pintarPaso(); };
  const at = $('cy-hw-back'); if (at) at.onclick = () => { _paso = Math.max(0, _paso - 1); pintarPaso(); };
  c.querySelectorAll('[data-paso]').forEach((b) => b.onclick = () => { _paso = Number(b.dataset.paso); pintarPaso(); });
}

/* ── Descargar imagen (grafico + bandas + logo moneda + marca + dominio) ── */
async function guardarImagen() {
  if (!C.chart || C.cargando) return;
  let shot; try { shot = C.chart.takeScreenshot(); } catch (_) { return; }
  if (!shot || !shot.width) return;
  const W = shot.width, H = shot.height, top = 58;
  const out = document.createElement('canvas'); out.width = W; out.height = H + top; const g = out.getContext('2d');
  g.fillStyle = '#06080c'; g.fillRect(0, 0, W, H + top);
  g.fillStyle = '#0b1118'; g.fillRect(0, 0, W, top);
  g.fillStyle = '#E8B84B'; g.fillRect(0, 0, W, 3);
  const cargar = (src, cors) => new Promise((res) => { if (!src) return res(null); const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const p = PARES.find((x) => x.id === _par) || {};
  const coinUrl = p.id ? ('https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/' + String(p.id).toLowerCase() + '.png') : null;
  const [coin, marca] = await Promise.all([cargar(coinUrl, true), cargar(LOGO, false)]);
  const r = 15, cx = 20 + r, cy = 29;
  if (coin && coin.width) { g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip(); g.drawImage(coin, cx - r, cy - r, r * 2, r * 2); g.restore(); }
  else { g.fillStyle = '#232b36'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#eaecef'; g.font = '800 17px "Chakra Petch", sans-serif'; g.fillText(_par + ' · ' + t('indRainbow'), cx + r + 12, 26);
  g.fillStyle = '#8b96a3'; g.font = '700 11px "IBM Plex Mono", monospace'; g.fillText(tfNom(_tf) + '  ·  ' + fmt(C.precio) + ' USD', cx + r + 12, 45);
  g.textAlign = 'right'; g.fillStyle = '#E8B84B'; g.font = '800 15px "Chakra Petch", sans-serif'; g.fillText('Cycles', W - 18, 26);
  g.fillStyle = '#8b96a3'; g.font = '700 11px "IBM Plex Mono", monospace'; g.fillText(WEB, W - 18, 45);
  try {
    g.drawImage(shot, 0, top);
    if (C.fx && C.fx.width) g.drawImage(C.fx, 0, top, W, H);
  } catch (_) {}
  if (marca && marca.width) { const mh = 24, mw = marca.width * (mh / marca.height); g.save(); g.globalAlpha = .85; g.drawImage(marca, 16, out.height - mh - 14, mw, mh); g.restore(); }
  modalImagen(out, `decfreedom-cycles-${_par}-${Date.now()}.png`);
}
function modalImagen(cv, fname) {
  cerrarMenus();
  const m = document.createElement('div'); m.className = 'cy-menu cy-img-modal'; m.style.inset = '0';
  m.innerHTML = `<div class="cy-img-bg"></div><div class="cy-img-c"><div class="cy-img-cv"></div><div class="cy-img-acts"><button class="cy-img-dl">${esc(t('dl'))}</button><button class="cy-img-cl">✕</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('.cy-img-cv').appendChild(cv); cv.style.maxWidth = '100%'; cv.style.borderRadius = '10px';
  const cerrar2 = () => m.remove();
  m.querySelector('.cy-img-bg').onclick = cerrar2; m.querySelector('.cy-img-cl').onclick = cerrar2;
  m.querySelector('.cy-img-dl').onclick = () => { try { cv.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }); } catch (_) {} };
}

/* ── Estilos ── */
let _cssPuesto = false;
function estilos() {
  if (_cssPuesto || document.getElementById('cy-css')) { _cssPuesto = true; return; }
  _cssPuesto = true;
  const s = document.createElement('style'); s.id = 'cy-css'; s.textContent = CSS; document.head.appendChild(s);
}
const CSS = `
  #cy-overlay{position:fixed; inset:0; z-index:9000; font-family:'Plus Jakarta Sans',system-ui,sans-serif; color:#eaecef}
  #cy-overlay *{box-sizing:border-box}
  .cy-bg{position:absolute; inset:0; background:#06080c}
  .cy-c{position:absolute; inset:0; display:flex; flex-direction:column}
  .cy-barra{flex:0 0 auto; height:54px; display:flex; align-items:center; gap:10px; padding:0 14px; background:#0b0f15; border-bottom:1px solid #1a212b; overflow:visible}
  .cy-back{display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 12px; border-radius:10px; border:1px solid #232c38; background:rgba(255,255,255,.03); color:#eaecef; font-weight:700; font-size:13px; cursor:pointer}
  .cy-back:hover{border-color:#C9A84B; color:#E8B84B} .cy-back svg{width:15px; height:15px}
  .cy-sel{display:inline-flex; align-items:center; gap:8px; height:34px; padding:0 11px; border-radius:10px; border:1px solid #232c38; background:rgba(255,255,255,.03); color:#eaecef; font-weight:700; font-size:13px; cursor:pointer}
  .cy-sel:hover{border-color:#C9A84B} .cy-sel svg{width:13px; height:13px; opacity:.7}
  .cy-logo{width:20px; height:20px; border-radius:50%; background:#1b222c center/cover no-repeat; display:grid; place-items:center; font-size:11px; font-weight:800; color:#E8B84B; border:1px solid #2a333f; overflow:hidden}
  .cy-sel #cy-nm{color:#8b95a1; font-weight:600; font-size:12px}
  .cy-tfchip{display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 11px; border-radius:10px; border:1px solid #232c38; background:rgba(255,255,255,.03); color:#eaecef; font-weight:700; font-size:12.5px; cursor:pointer}
  .cy-tfchip:hover{border-color:#C9A84B} .cy-tfchip svg{width:12px; height:12px; opacity:.7}
  .cy-px{display:flex; flex-direction:column; justify-content:center; line-height:1.1; margin-left:2px}
  .cy-px-v{font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:15px; color:#eaecef}
  .cy-sub{font-size:10.5px; color:#8b95a1; display:flex; align-items:center; gap:5px; margin-top:2px}
  .cy-sub i{width:8px; height:8px; border-radius:2px; display:inline-block}
  .cy-badge{font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:.12em; padding:3px 7px; border-radius:6px; border:1px solid #2a333f; color:#8b95a1}
  .cy-spot{color:#2ee86a; border-color:rgba(46,232,106,.35)}
  .cy-switch{display:inline-flex; gap:3px; margin-left:auto; padding:3px; border-radius:11px; background:rgba(255,255,255,.03); border:1px solid #1e2631}
  .cy-tab{height:28px; padding:0 13px; border-radius:8px; border:0; background:transparent; color:#8b95a1; font-weight:700; font-size:12.5px; cursor:pointer; white-space:nowrap}
  .cy-tab:hover{color:#eaecef}
  .cy-tab.on{background:linear-gradient(180deg,rgba(232,184,75,.22),rgba(232,184,75,.08)); color:#E8B84B; box-shadow:inset 0 0 0 1px rgba(232,184,75,.4)}
  .cy-der{display:inline-flex; align-items:center; gap:7px}
  .cy-ico{width:34px; height:34px; display:grid; place-items:center; border-radius:9px; border:1px solid #232c38; background:rgba(255,255,255,.03); color:#9aa4af; font-weight:800; cursor:pointer}
  .cy-ico:hover{border-color:#C9A84B; color:#E8B84B}
  .cy-lang{height:34px; min-width:40px; padding:0 11px; border-radius:9px; border:1px solid #232c38; background:rgba(255,255,255,.03); color:#9aa4af; font-weight:800; font-size:12.5px; cursor:pointer}
  .cy-lang:hover{border-color:#C9A84B; color:#E8B84B}
  .cy-graf{position:relative; flex:1 1 auto; min-height:0; overflow:hidden}
  .cy-mount{position:absolute; inset:0}
  .cy-fx{position:absolute; inset:0; pointer-events:none; z-index:3}
  .cy-leyenda{position:absolute; left:14px; top:12px; z-index:4; display:flex; flex-wrap:wrap; gap:6px 12px; max-width:68%; pointer-events:none}
  .cy-lz{display:inline-flex; align-items:center; gap:6px; font-size:11px; color:#c3cbd4; font-weight:600; text-shadow:0 1px 3px rgba(0,0,0,.8)}
  .cy-lz i{width:11px; height:11px; border-radius:3px; display:inline-block}
  .cy-marca{position:absolute; left:16px; bottom:12px; height:22px; opacity:.8; z-index:4; pointer-events:none}
  .cy-dom{position:absolute; right:68px; bottom:14px; z-index:4; font-family:'IBM Plex Mono',monospace; font-size:11px; color:#5a6570; pointer-events:none}
  .cy-esperando{position:absolute; inset:0; z-index:5; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; background:rgba(6,8,12,.85); color:#c3cbd4; font-weight:700}
  .cy-spin{width:30px; height:30px; border-radius:50%; border:3px solid rgba(232,184,75,.22); border-top-color:#E8B84B; animation:cyspin .7s linear infinite}
  @keyframes cyspin{to{transform:rotate(360deg)}}
  .cy-menu{position:fixed; z-index:10050; min-width:180px; max-height:62vh; overflow:auto; padding:6px; border-radius:12px; background:linear-gradient(180deg,#141a22,#0c1016); border:1px solid #2a333f; box-shadow:0 16px 44px rgba(0,0,0,.6)}
  .cy-menu-tf{min-width:120px}
  .cy-mi{display:flex; align-items:center; gap:8px; width:100%; text-align:left; padding:8px 10px; border-radius:8px; border:0; background:transparent; color:#d5dbe2; font-weight:700; font-size:13px; cursor:pointer}
  .cy-mi:hover{background:rgba(232,184,75,.1); color:#E8B84B}
  .cy-mi span{color:#8b95a1; font-weight:600; font-size:11px}
  /* Modal How it works: flex + colores literales (se cuelga de body, fuera de #cy-overlay) */
  #cy-hw-box{position:fixed; inset:0; z-index:10300; display:flex; align-items:center; justify-content:center; padding:16px; font-family:'Chakra Petch','Plus Jakarta Sans',system-ui,sans-serif; color:#eaecef}
  .cy-hw-bg{position:absolute; inset:0; background:rgba(3,6,10,.8); -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px)}
  .cy-hw-c{position:relative; width:100%; max-width:440px; max-height:88vh; overflow-y:auto; background:linear-gradient(180deg,#0e141b,#0a0e14); border:1px solid #232c38; border-radius:18px; padding:22px; box-shadow:0 30px 80px rgba(0,0,0,.6); animation:cyin .16s ease both}
  @keyframes cyin{from{opacity:0; transform:translateY(-6px)} to{opacity:1; transform:none}}
  .cy-hw-x{position:absolute; top:14px; right:14px; width:30px; height:30px; display:grid; place-items:center; border-radius:9px; border:1px solid #232c38; background:rgba(255,255,255,.03); color:#a9b2bd; cursor:pointer}
  .cy-hw-x:hover{border-color:#ff5b6e; color:#ff6b7a} .cy-hw-x svg{width:12px; height:12px}
  .cy-hw-eyebrow{font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:#E8B84B; font-weight:800; margin-bottom:14px}
  .cy-hw-card{min-height:150px}
  .cy-hw-n{font-family:'IBM Plex Mono',monospace; font-size:11px; color:#6b7580; font-weight:700; margin-bottom:8px}
  .cy-hw-n em{font-style:normal; opacity:.6}
  .cy-hw-t{font-size:20px; font-weight:800; line-height:1.2; margin-bottom:10px; color:#eaecef}
  .cy-hw-d{font-size:13.5px; line-height:1.6; color:#a9b2bd}
  .cy-hw-dots{display:flex; gap:6px; justify-content:center; margin:18px 0 14px}
  .cy-hw-dots i{width:7px; height:7px; border-radius:50%; background:#232c38; cursor:pointer; transition:background .15s,width .15s}
  .cy-hw-dots i.on{background:#E8B84B; width:18px; border-radius:4px}
  .cy-hw-acts{display:flex; gap:9px; justify-content:flex-end}
  .cy-hw-back{height:38px; padding:0 16px; border-radius:10px; border:1px solid #232c38; background:rgba(255,255,255,.03); color:#a9b2bd; font-weight:700; font-size:13px; cursor:pointer}
  .cy-hw-back:hover{border-color:#C9A84B; color:#E8B84B}
  .cy-hw-next{height:38px; padding:0 18px; border-radius:10px; border:1px solid #c79426; background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426); color:#2a1d00; font-weight:800; font-size:13px; cursor:pointer}
  .cy-hw-next:hover{filter:brightness(1.05)}
  .cy-img-modal{inset:0; z-index:10400; display:flex; align-items:center; justify-content:center; padding:20px}
  .cy-img-bg{position:absolute; inset:0; background:rgba(3,6,10,.86)}
  .cy-img-c{position:relative; max-width:min(1000px,94vw); max-height:90vh; overflow:auto; display:flex; flex-direction:column; gap:12px}
  .cy-img-acts{display:flex; gap:10px; justify-content:flex-end}
  .cy-img-dl{height:40px; padding:0 18px; border-radius:10px; border:1px solid #c79426; background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426); color:#2a1d00; font-weight:800; cursor:pointer}
  .cy-img-cl{height:40px; width:44px; border-radius:10px; border:1px solid #232c38; background:rgba(255,255,255,.04); color:#c3cbd4; cursor:pointer}
  @media (max-width:760px){ .cy-switch{order:9; margin:0} .cy-sub{display:none} .cy-leyenda{max-width:100%; font-size:10px} }
`;
