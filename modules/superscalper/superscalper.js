/* modules/superscalper/superscalper.js — "Whale Trades" (nombre de cara al usuario).
   El archivo NO se renombra (la carpeta queda como superscalper), igual que "VWAP Pro"
   vive en modules/institutional/ y "Footprint" en modules/footprint/.

   Servicio de Analysis. MISMO chrome y dinámica que Footprint / VWAP Pro / las pools:
   barra superior idéntica (Back · moneda+lista · temporalidad · precio+máx/mín · export
   con marca de agua · ayuda), gráfica de canvas propia con zoom/pan (rueda, arrastre del
   eje de precios = estira vertical, arrastre del eje de tiempo = estira horizontal, doble
   clic = reset), barra de dibujo compartida (barra.js), órdenes/alertas con clic derecho
   (orden.js) y catálogo único de monedas (config.js).

   La gráfica es a secas: velas (desde 1 segundo hasta 1 día, 2H incluido) SIN indicadores.
   Lo único que se pinta encima es WHALE TRADES: cada orden de mercado grande es una
   burbuja en su precio y su tiempo. Verde = compra agresiva (barre la oferta), roja =
   venta agresiva (barre la demanda), tamaño = valor en USD. El umbral es dinámico para que
   toda moneda muestre sus ballenas. Datos: operaciones reales de Binance SPOT (aggTrades)
   y velas (klines), en vivo por WebSocket. Sin futuros (regla de CLAUDE.md). */

import { montarBarra } from '../../assets/js/niveles/barra.js?v=6';
import { PARES, pintarIcono, TFS } from '../../assets/js/niveles/config.js?v=1';
import { N } from '../../assets/js/niveles/estado.js?v=1';
import { cargarDib } from '../../assets/js/niveles/dibujo.js?v=3';

const WEB = 'decfreedom.com';
/* Ruta del logo resuelta contra la URL del script (no del documento): así
   /assets/img/cco-marca.png carga igual aunque la página se sirva desde
   /modules/analysis/. Es la marca de agua del lienzo y del export. */
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const DISC_IMG = new URL('../../assets/portada/red/disclaimer.webp', import.meta.url).href;   // sello del disclaimer, el mismo de toda la plataforma
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let _par = 'BTC';

const M = {
  tf: '1s', velas: [], precio: 0, dispC: null,        // dispC = cierre en formación SUAVIZADO (easing)
  trades: [],                                         // buffer de operaciones individuales (whale trades)
  ancho: window.innerWidth < 760 ? 46 : 70, desplaz: 0, zoomY: 1, offsetY: 0,
  _geo: null, _cursor: null,
  cargando: true, error: null
};
const WH_CAP = 3000;                 // tope del buffer de operaciones (higiene de memoria)
const WH_RMIN = 5, WH_RMAX = 42;     // radio de burbuja en px (mín/máx)
// Temporalidades: 1s y segundos AGREGADOS desde klines de 1s (Binance solo da 1s nativo
// por debajo del minuto), más las nativas hasta diario (2H incluida).
const SS_TFS = [
  { id: '1s', n: '1s', sec: 1 }, { id: '2s', n: '2s', sec: 2 }, { id: '5s', n: '5s', sec: 5 },
  { id: '10s', n: '10s', sec: 10 }, { id: '30s', n: '30s', sec: 30 },
  { id: '1m', n: '1m' }, { id: '5m', n: '5m' }, { id: '15m', n: '15m' },
  { id: '1h', n: '1H' }, { id: '2h', n: '2H' }, { id: '4h', n: '4H' }, { id: '1d', n: '1D' }
];
const tfDef = (id) => SS_TFS.find((t) => t.id === id) || SS_TFS[0];
// Agrega velas de 1s en cubos de `sec` segundos (para 2s..30s).
function agregar(velas, sec) {
  const out = []; let cur = null;
  for (const v of velas) { const bt = Math.floor(v.t / sec) * sec;
    if (!cur || cur.t !== bt) { if (cur) out.push(cur); cur = { t: bt, o: v.o, h: v.h, l: v.l, c: v.c, v: v.v }; }
    else { if (v.h > cur.h) cur.h = v.h; if (v.l < cur.l) cur.l = v.l; cur.c = v.c; cur.v += v.v; } }
  if (cur) out.push(cur); return out;
}
async function traerVelasTF(simbolo, tf) {
  const d = tfDef(tf);
  if (d.sec && d.sec > 1) { const base = await traerVelas(simbolo, '1s', 1000); return agregar(base, d.sec); }
  return traerVelas(simbolo, tf, 700);
}
const streamTF = () => { const d = tfDef(M.tf); return (d.sec && d.sec > 1) ? '1s' : M.tf; };
let _barra = null, _od = null, _zonasOd = null, _reloj = null, _pulso = null;

/* ── Datos (Binance klines con respaldo de hosts, igual que las pools) ── */
const HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision', 'https://api-gcp.binance.com', 'https://api1.binance.com'];
let _host = 0;
async function rzFetch(path) {
  const orden = [_host, ...HOSTS.map((_, i) => i).filter((i) => i !== _host)];
  let err;
  for (const i of orden) {
    try { const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4500); const r = await fetch(HOSTS[i] + path, { signal: ctl.signal }); clearTimeout(to); if (r.ok) { _host = i; return r; } err = new Error('HTTP ' + r.status); }
    catch (e) { err = e; }
  }
  throw err || new Error('sin datos');
}
async function traerVelas(simbolo, tf, n = 700) {
  const r = await rzFetch(`/api/v3/klines?symbol=${simbolo}&interval=${tf}&limit=${n}`);
  const j = await r.json();
  return j.map((x) => ({ t: Math.floor(x[0] / 1000), o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: (+x[7] || +x[5] || 0) }));
}

/* ── Velas EN VIVO por WebSocket de Binance ──
   La vela en formación se ve al instante (el bucle de 33 ms ya repinta). `t` en SEGUNDOS
   y `v` en volumen quote, igual que traerVelas. El sondeo de 15 s sigue como resync. ── */
let _ssStream = null, _ssStreamKey = '';
function streamVelasRz(simbolo, tf, onK) {
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
function conectarStreamRz() {
  const p = PARES.find((x) => x.id === _par) || {};
  if (!p.s) return;
  const stf = streamTF(), key = p.s + '|' + stf;
  if (_ssStreamKey === key && _ssStream) return;
  if (_ssStream) { try { _ssStream.cerrar(); } catch (_) {} _ssStream = null; }
  _ssStreamKey = key;
  try { _ssStream = streamVelasRz(p.s, stf, onKlineRz); } catch (_) { _ssStream = null; }
}
function onKlineRz(k) {
  if (!k || !M.velas || !M.velas.length) return;
  const raw = { t: Math.floor(k.t / 1000), o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: (+k.q || +k.v || 0) };
  if (!(raw.c > 0)) return;
  const d = tfDef(M.tf), sec = (d.sec && d.sec > 1) ? d.sec : 0;
  const last = M.velas[M.velas.length - 1];
  if (sec) {   // sub-minuto: agrega el kline de 1s en su cubeta de `sec` segundos
    const bt = Math.floor(raw.t / sec) * sec;
    if (last && last.t === bt) { if (raw.h > last.h) last.h = raw.h; if (raw.l < last.l) last.l = raw.l; last.c = raw.c; M.precio = raw.c; return; }
    if (!last || bt > last.t) { M.velas.push({ t: bt, o: raw.o, h: raw.h, l: raw.l, c: raw.c, v: raw.v }); M.precio = raw.c; }
    return;
  }
  if (raw.t === last.t) M.velas[M.velas.length - 1] = raw;
  else if (raw.t > last.t) M.velas.push(raw);
  else return;
  M.precio = raw.c;
}

/* ── WHALE TRADES: operaciones individuales (aggTrades), semilla REST + vivo por WS ──
   Cada trade: precio p, cantidad q, tiempo t (ms), lado agresor (buy) y valor usd = p·q.
   buy === true  → el agresor compra (barre la oferta); buy === false → el agresor vende.
   Se escribe api.binance.com / stream.binance.com y el feed-shim enruta al espejo. */
async function traerTrades(simbolo, n = 1000) {
  const r = await rzFetch(`/api/v3/aggTrades?symbol=${simbolo}&limit=${n}`);
  const j = await r.json();
  return j.map((a) => ({ t: a.T, p: +a.p, q: +a.q, buy: a.m === false, usd: (+a.p) * (+a.q) }));
}
let _whStream = null, _whKey = '';
function streamTradesRz(simbolo, onT) {
  const url = `wss://stream.binance.com:9443/ws/${String(simbolo).toLowerCase()}@aggTrade`;
  let ws = null, cerrado = false, tmr = null;
  const abrir = () => {
    if (cerrado) return;
    try { ws = new WebSocket(url); } catch (_) { tmr = setTimeout(abrir, 2500); return; }
    ws.onmessage = (ev) => { try { const d = JSON.parse(ev.data); if (d && d.p) onT({ t: d.T, p: +d.p, q: +d.q, buy: d.m === false, usd: (+d.p) * (+d.q) }); } catch (_) {} };
    ws.onclose = () => { if (!cerrado) { clearTimeout(tmr); tmr = setTimeout(abrir, 2500); } };
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  };
  abrir();
  return { cerrar: () => { cerrado = true; clearTimeout(tmr); try { if (ws) ws.close(); } catch (_) {} } };
}
function conectarWhales() {
  const p = PARES.find((x) => x.id === _par) || {};
  if (!p.s) return;
  if (_whKey === p.s && _whStream) return;
  if (_whStream) { try { _whStream.cerrar(); } catch (_) {} _whStream = null; }
  _whKey = p.s;
  try {
    _whStream = streamTradesRz(p.s, (t) => {
      M.trades.push(t);
      if (M.trades.length > WH_CAP) M.trades.splice(0, M.trades.length - WH_CAP);
      if (t.p > 0) M.precio = t.p;   // el tape da precio más fino que el cierre de la vela
    });
  } catch (_) { _whStream = null; }
}

const fmt = (p) => {
  if (!(p > 0)) return '·';
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(8);
};
/* Valor en USD compacto para las etiquetas de burbuja. */
function fmtUsd(u) {
  if (u >= 1e9) return '$' + (u / 1e9).toFixed(2) + 'B';
  if (u >= 1e6) return '$' + (u / 1e6).toFixed(2) + 'M';
  if (u >= 1e3) return '$' + (u / 1e3).toFixed(u >= 1e5 ? 0 : 1) + 'K';
  return '$' + Math.round(u);
}
/* Etiqueta del eje de tiempo: en segundos, hora con SEGUNDOS. */
function fmtFecha(tsSec) {
  const d = new Date(tsSec * 1000);
  if (tfDef(M.tf).sec) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const intradia = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h'].includes(M.tf);
  return intradia
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/* ══════════════════ APERTURA ══════════════════ */
export async function abrirSuperScalper() {
  estilos();
  const prev = $('ss-overlay'); if (prev) prev.remove();
  M.velas = []; M.trades = []; M.cargando = true; M.error = null;

  const p0 = PARES.find((p) => p.id === _par) || PARES[0]; _par = p0.id;
  const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
  const d = document.createElement('div');
  d.id = 'ss-overlay';
  d.innerHTML = `<div class="ss-bg"></div>
    <div class="ss-c">
      <div class="ss-barra">
        <button class="ss-back" id="ss-back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>Back</button>
        <button class="ss-sel" id="ss-sel"><i class="ss-logo" id="ss-logo" data-cg="${esc(p0.cg || '')}" data-ico="${esc(p0.ico || '')}"></i><b id="ss-par">${esc(_par)}</b><span id="ss-nm">${esc(p0.n || '')}</span>${chev}</button>
        <button class="ss-tfchip" id="ss-tfchip" type="button" title="Timeframe"><b id="ss-tfchip-t">${esc(tfDef(M.tf).n)}</b>${chev}</button>
        <div class="ss-px"><div class="ss-px-v" id="ss-px">·</div><div class="ss-hl"><span>H <b id="ss-hi">·</b></span><span>L <b id="ss-lo">·</b></span></div></div>
        <span id="ss-estado" class="ss-estado"></span>
        <div class="ss-der">
          <button class="ss-ico" id="ss-foto" title="Share image"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.5"/></svg></button>
          <button class="ss-ico" id="ss-ayuda" title="How it works">?</button>
        </div>
      </div>
      <div class="ss-graf" id="ss-graf">
        <canvas class="ss-cv" id="ss-cv"></canvas>
        <div class="ss-esperando" id="ss-esperando"><div class="ss-spin"></div><b>Loading the 1 second chart…</b><span>Streaming the live tape. Big market orders appear as bubbles.</span></div>
        <img class="ss-marca" id="ss-marca" src="${LOGO}" alt="">
      </div>
    </div>`;
  document.body.appendChild(d);

  d.querySelector('.ss-bg').onclick = cerrar;
  $('ss-back').onclick = cerrar;
  $('ss-sel').onclick = (e) => { e.stopPropagation(); menuPares(); };
  $('ss-ayuda').onclick = ayuda;
  $('ss-foto').onclick = guardarImagen;
  $('ss-tfchip').onclick = (e) => { e.stopPropagation(); menuTf(); };

  ponerLogos();
  cargarVelas();
  clearInterval(_pulso);
  _pulso = setInterval(() => {
    if (!$('ss-cv')) return;
    if (M.precio > 0) { if (M.dispC == null) M.dispC = M.precio; else M.dispC += (M.precio - M.dispC) * 0.22; }   // easing: la vela en formación se MUEVE suave, no a saltos
    dibujar();
  }, 33);   // ~30fps
  let _t = null; M._onResize = () => { clearTimeout(_t); _t = setTimeout(() => { if ($('ss-cv')) dibujar(); }, 200); };
  window.addEventListener('resize', M._onResize);
  discWhales(false);   // disclaimer oficial de entrada (sello + aceptación obligatoria)
}

/* Disclaimer de entrada, MISMO patrón del resto de la plataforma: sello en la esquina,
   exoneración total, y ACEPTACIÓN OBLIGATORIA (casilla + botón, tocar fuera no cierra).
   Es una herramienta de DATOS de mercado, no consejo. reView: reabierto desde la ayuda. */
function discWhales(reView) {
  if (!reView) { try { if (localStorage.getItem('ss-disc-wh1') === '1') return; } catch (_) {} }
  const vieja = $('ss-disc'); if (vieja) vieja.remove();
  const d = document.createElement('div'); d.id = 'ss-disc'; d.className = 'ss-disc' + (reView ? ' rev' : '');
  d.innerHTML = `<div class="ss-disc-bg"></div><div class="ss-disc-c">
    ${reView ? '<button class="ss-disc-x" id="ss-disc-x" aria-label="Close">✕</button>' : ''}
    <img class="ss-disc-sello" src="${DISC_IMG}" alt="">
    <h4>Before you start</h4>
    <p>Whale Trades is a <b>market data tool</b> that draws the live executed tape of a market on a 1 second chart, for informational and educational purposes only. It shows trades that already happened. Nothing here is financial, investment, legal or tax advice, we make no recommendation to buy or sell, and we do not guarantee any result, profit or performance. A large trade is not a prediction of where price goes next. Trading digital assets carries a very high risk and you can lose part or all of your capital fast.</p>
    <p>Every entry, exit and the size of every trade are your own decision and your sole responsibility. The tools are provided as is, without warranty of any kind, and the data comes from third parties (Binance) and may be delayed or incomplete. To the maximum extent permitted by law, DecFreedom, its owners and affiliates accept no liability for any loss or damage arising from the use of this section. By continuing you accept this notice and our Terms and Conditions.</p>
    ${reView ? '' : '<label class="ss-disc-chk"><input type="checkbox" id="ss-disc-agree"><span>I have read and I accept this notice and the Terms and Conditions. I understand this is a market data tool for information only, not financial advice, that it guarantees no result, and that I trade entirely at my own risk.</span></label>'}
    <button class="ss-disc-ok" id="ss-disc-ok"${reView ? '' : ' disabled'}>${reView ? 'Close' : 'Accept'}</button></div>`;
  document.body.appendChild(d);
  const cerrarD = () => d.remove();
  if (reView) { $('ss-disc-x').onclick = cerrarD; d.querySelector('.ss-disc-bg').onclick = cerrarD; }
  else {
    d.querySelector('.ss-disc-bg').onclick = (e) => { e.preventDefault(); e.stopPropagation(); };   // bloqueante
    const chk = $('ss-disc-agree'), ok = $('ss-disc-ok');
    chk.addEventListener('change', () => { if (chk.checked) ok.removeAttribute('disabled'); else ok.setAttribute('disabled', ''); });
  }
  $('ss-disc-ok').onclick = () => {
    if (!reView) { const chk = $('ss-disc-agree'); if (!chk || !chk.checked) return; try { localStorage.setItem('ss-disc-wh1', '1'); } catch (_) {} }
    cerrarD();
  };
}

function cerrar() {
  clearInterval(_reloj); clearInterval(_pulso);
  if (_ssStream) { try { _ssStream.cerrar(); } catch (_) {} _ssStream = null; _ssStreamKey = ''; }   // cierra el WebSocket de velas
  if (_whStream) { try { _whStream.cerrar(); } catch (_) {} _whStream = null; _whKey = ''; }         // cierra el WebSocket del tape
  if (M._onResize) window.removeEventListener('resize', M._onResize);
  if (_barra) { try { _barra.desmontar(); } catch (_) {} _barra = null; }
  document.querySelectorAll('#ss-picker, #ss-tfmenu, #ss-ayuda-box, #ss-disc').forEach((x) => x.remove());
  const e = $('ss-overlay'); if (e) e.remove();
  const sel = $('an-sel'); if (sel) sel.style.display = '';   // vuelve al selector de Analysis
}

async function cargarVelas() {
  M.cargando = true;
  M.dispC = null; M.trades = [];                               // moneda/temporalidad nueva: limpia el tape
  if (_ssStream) { try { _ssStream.cerrar(); } catch (_) {} _ssStream = null; _ssStreamKey = ''; }
  if (_whStream) { try { _whStream.cerrar(); } catch (_) {} _whStream = null; _whKey = ''; }
  const p = PARES.find((x) => x.id === _par) || {};
  try {
    M.velas = await traerVelasTF(p.s, M.tf);
    M.cargando = false;
    if (M.velas.length) M.precio = M.velas[M.velas.length - 1].c;
    const est = $('ss-estado'); if (est) est.textContent = '';
  } catch (e) { M.cargando = false; M.error = 'feed'; const est = $('ss-estado'); if (est) est.textContent = 'Market data unavailable.'; }
  // semilla del tape (últimas operaciones) + stream en vivo
  try { traerTrades(p.s).then((ts) => { M.trades = ts; }).catch(() => {}); } catch (_) {}
  dibujar();
  clearInterval(_reloj);
  _reloj = setInterval(async () => {
    try { const v = await traerVelasTF(p.s, M.tf); M.velas = v; if (v.length) M.precio = v[v.length - 1].c; dibujar(); } catch (_) {}
  }, 15000);
  conectarStreamRz();          // velas EN VIVO por WebSocket (el sondeo de 15 s queda de resync)
  conectarWhales();            // tape EN VIVO (aggTrades) para las burbujas
}

function refrescarCabecera() {
  const px = $('ss-px'), hi = $('ss-hi'), lo = $('ss-lo');
  if (!M.velas.length) return;
  const u = M.velas[M.velas.length - 1];
  let dH = u.h, dL = u.l; const back = Math.min(M.velas.length, tfPorDia(M.tf));
  for (let k = M.velas.length - back; k < M.velas.length; k++) { if (M.velas[k].h > dH) dH = M.velas[k].h; if (M.velas[k].l < dL) dL = M.velas[k].l; }
  if (px) { px.textContent = fmt(M.precio); px.className = 'ss-px-v ' + (u.c >= u.o ? 'up' : 'down'); }
  if (hi) hi.textContent = fmt(dH); if (lo) lo.textContent = fmt(dL);
}
function tfPorDia(tf) { if (tfDef(tf).sec) return 700; const m = { '1m': 1440, '5m': 288, '15m': 96, '1h': 24, '2h': 12, '4h': 6, '1d': 1 }; return m[tf] || 120; }

/* ══════════════════ RENDER ══════════════════ */
function pal() { return { fondo: '#0a0e14', rejilla: 'rgba(255,255,255,.04)', ink: '#e7ebf0', dim: '#7d8794' }; }

function dibujar() {
  const cv = $('ss-cv'), zona = $('ss-graf'); if (!cv || !zona) return;
  const W = zona.clientWidth, H = zona.clientHeight; if (W < 50 || H < 50) return;

  if (!cv.dataset.listo) {
    engancharGestos(cv);
    cv.dataset.listo = '1';
    _barra = montarBarra(zona);
    try { N.seccion = 'superscalper'; N.par = _par; cargarDib(); } catch (_) { N.dibujos = N.dibujos || []; }
    import('../../assets/js/orden.js?v=126').then((od) => {
      od.conectar({
        canvas: cv,
        precioEn: (y) => { if (!M._geo) return 0; const { pMin, pMax, y1 } = M._geo; return pMin + (pMax - pMin) * ((y1 - y) / y1); },
        precioActual: () => M.precio > 0 ? M.precio : (M.velas.length ? M.velas[M.velas.length - 1].c : 0),
        par: () => _par,
        simbolo: () => (PARES.find((p) => p.id === _par) || {}).s || '',
        repintar: () => dibujar()
      });
      _od = od; od.clicCancelar(cv, () => _zonasOd, () => dibujar()); dibujar();
    }).catch(() => {});
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = pal(); g.fillStyle = P.fondo; g.fillRect(0, 0, W, H);

  const esp = $('ss-esperando');
  if (M.cargando || !M.velas.length) { if (esp) esp.style.display = ''; return; }
  if (esp) esp.style.display = 'none';

  const mDer = 66, mAba = 22;
  const yTime = H - mAba;
  const x1 = W - mDer, y1 = yTime, xVelas = x1;         // el precio ocupa todo el alto (gráfica a secas, sin panel inferior)
  const ancho = Math.min(M.velas.length, M.ancho || 100);
  const huecoMax = Math.floor(ancho * 0.45);
  let desp = Math.max(-huecoMax, Math.min(M.desplaz || 0, Math.max(0, M.velas.length - ancho)));
  M.desplaz = desp;
  const fin = M.velas.length - desp;
  const vis = M.velas.slice(Math.max(0, fin - ancho), Math.min(M.velas.length, fin));
  if (!vis.length) return;
  const pc = (M.dispC != null && M.dispC > 0) ? M.dispC : M.precio;   // precio MOSTRADO, suavizado (easing)
  if (desp <= 0 && pc > 0) { const u = vis[vis.length - 1]; u.c = pc; if (pc > u.h) u.h = pc; if (pc < u.l) u.l = pc; }

  let pAlto = Math.max(...vis.map((v) => v.h)), pBajo = Math.min(...vis.map((v) => v.l));
  if (pc > 0) { pAlto = Math.max(pAlto, pc); pBajo = Math.min(pBajo, pc); }
  const rangoB = (pAlto - pBajo) || 1;
  const despY = ((M.offsetY || 0) / Math.max(1, y1)) * rangoB;
  const centro = (pAlto + pBajo) / 2 + despY;
  const semi = (rangoB / 2) * (M.zoomY || 1);
  const pad = semi * 0.14 || 1;
  const pMax = centro + semi + pad, pMin = centro - semi - pad;
  const Y = (p) => y1 - y1 * ((p - pMin) / Math.max(1e-12, pMax - pMin));
  const paso = xVelas / (ancho || vis.length);
  const pri = fin - ancho;
  const Xbar = (barIdx) => (barIdx - pri) * paso + paso / 2;
  const tfMs = (M.velas.length > 1 ? (M.velas[1].t - M.velas[0].t) * 1000 : 1000);
  M._geo = { pMin, pMax, y1, xVelas, n: vis.length, vis, paso, pri, fin, ancho, tfMs, t0: M.velas[0].t };

  // órdenes/alertas del usuario (mismo estilo que las pools)
  if (_od) _zonasOd = _od.pintar(g, { x1, Y, pMin, pMax, simbolo: (PARES.find((p) => p.id === _par) || {}).s || '' });

  // rejilla
  g.strokeStyle = P.rejilla; g.lineWidth = 1;
  for (let i = 1; i < 6; i++) { const y = (y1 / 6) * i; g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); }

  const now = Date.now();

  // ── VELAS ──
  dibujarVelas(g, vis, Y, paso);

  // ── WHALE TRADES: burbujas de órdenes grandes sobre el precio ──
  dibujarWhales(g, Y, M._geo, now);

  // línea del precio (suavizada)
  if (pc > 0) {
    const yp = Y(pc); g.strokeStyle = 'rgba(232,184,75,.55)'; g.lineWidth = 1; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(0, yp); g.lineTo(x1, yp); g.stroke(); g.setLineDash([]);
    const u = M.velas[M.velas.length - 1]; const col = pc >= u.o ? '#2ee86a' : '#ff5b6e';
    g.fillStyle = col; redondeado(g, x1 + 2, yp - 9, mDer - 4, 18, 4); g.fill();
    g.fillStyle = '#071018'; g.font = 'bold 10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(fmt(pc), x1 + 6, yp + 3.5);
  }

  // eje de precios (marcas)
  g.fillStyle = pal().dim; g.font = '10px ui-monospace,monospace'; g.textAlign = 'left';
  for (let i = 0; i <= 5; i++) { const y = (y1 / 5) * i; const pr = pMax - (pMax - pMin) * (i / 5); g.fillText(fmt(pr), x1 + 6, y + (i === 0 ? 10 : i === 5 ? -3 : 3)); }

  // eje de TIEMPO (abajo)
  g.fillStyle = '#0b0e12'; g.fillRect(0, yTime, W, mAba);
  g.fillStyle = pal().dim; g.font = '9px ui-monospace,monospace'; g.textAlign = 'center';
  const cadaX = Math.max(1, Math.floor(vis.length / 7));
  vis.forEach((v, i) => { if (i % cadaX !== 0) return; const x = i * paso + paso / 2; if (x > xVelas - 14) return; g.fillText(fmtFecha(v.t), x, yTime + 14); });
  g.textAlign = 'left';

  // leyenda del servicio (arriba-izquierda), discreta
  dibujarLeyenda(g);

  // crosshair + tachuelas de precio (der) y hora (abajo)
  if (M._cursor && M._cursor.x < x1 && M._cursor.y < y1 && M._cursor.x > 0 && M._cursor.y > 0) {
    const cx = M._cursor.x, cy = M._cursor.y, pCur = pMin + (pMax - pMin) * ((y1 - cy) / y1);
    g.save(); g.strokeStyle = 'rgba(200,210,224,.4)'; g.lineWidth = 1; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, yTime); g.stroke();
    g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke(); g.restore(); g.setLineDash([]);
    g.fillStyle = '#e8ecf2'; redondeado(g, x1 + 2, cy - 9, mDer - 4, 18, 4); g.fill();
    g.fillStyle = '#0b0e12'; g.font = 'bold 10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(fmt(pCur), x1 + 6, cy + 3.5);
    const idx = Math.floor(cx / paso);
    if (idx >= 0 && idx < vis.length) {
      const ht = fmtFecha(vis[idx].t); g.font = 'bold 9px ui-monospace,monospace';
      const hw = g.measureText(ht).width + 12;
      g.fillStyle = '#e8ecf2'; redondeado(g, Math.max(2, Math.min(x1 - hw, cx - hw / 2)), yTime + 3, hw, 15, 4); g.fill();
      g.fillStyle = '#0b0e12'; g.textAlign = 'center'; g.fillText(ht, Math.max(2 + hw / 2, Math.min(x1 - hw / 2, cx)), yTime + 13.5); g.textAlign = 'left';
    }
  }

  refrescarCabecera();

  // barra de dibujo compartida
  if (_barra && M._geo) _barra.redibujar({ W, H, x1: xVelas, y1, pMin, pMax, Y, ancho, paso, fin }, M.velas, _par);
}

function dibujarVelas(g, vis, Y, paso) {
  const w = Math.max(1, paso * 0.62);
  for (let i = 0; i < vis.length; i++) {
    const c = vis[i], x = i * paso + paso / 2;
    const sube = c.c >= c.o;
    const col = sube ? '#26d46a' : '#ff5162';
    g.strokeStyle = col; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, Y(c.h)); g.lineTo(x, Y(c.l)); g.stroke();
    const yO = Y(c.o), yC = Y(c.c); const top = Math.min(yO, yC), hgt = Math.max(1, Math.abs(yC - yO));
    g.fillStyle = col; g.fillRect(x - w / 2, top, w, hgt);
  }
}

/* WHALE TRADES: cada orden de mercado grande es un círculo en su precio y su tiempo.
   Verde = compra agresiva, roja = venta agresiva, radio ∝ valor en USD. El umbral es
   DINÁMICO (relativo a la mayor del tramo visible) para que toda moneda muestre sus
   ballenas sin saturar. La mayor del tramo lleva un anillo que late (viva). */
function dibujarWhales(g, Y, geo, now) {
  if (!geo || !M.trades.length) return;
  const { paso, vis, xVelas, y1, tfMs } = geo;
  if (!vis.length || !(tfMs > 0)) return;
  const t0ms = vis[0].t * 1000;
  const tEndms = t0ms + vis.length * tfMs;
  const xForT = (ms) => ((ms - t0ms) / tfMs) * paso;
  // ventana visible + mayor operación del tramo (para el umbral dinámico)
  let mx = 0; const win = [];
  for (let i = M.trades.length - 1; i >= 0; i--) {
    const tr = M.trades[i]; if (tr.t < t0ms) break;      // buffer ordenado por tiempo ascendente
    if (tr.t > tEndms) continue;
    win.push(tr); if (tr.usd > mx) mx = tr.usd;
  }
  if (!(mx > 0)) return;
  const thr = mx * 0.10, span = Math.max(1e-9, mx - thr);
  let big = null;
  g.save();
  g.beginPath(); g.rect(0, 0, xVelas, y1); g.clip();         // las burbujas viven dentro del panel de precio
  for (const tr of win) {
    if (tr.usd < thr) continue;
    const x = xForT(tr.t); if (x < -WH_RMAX || x > xVelas + WH_RMAX) continue;
    const y = Y(tr.p);
    const f = Math.sqrt((tr.usd - thr) / span);             // 0..1
    const r = WH_RMIN + (WH_RMAX - WH_RMIN) * f;
    const rgb = tr.buy ? '46,232,106' : '255,74,90';
    g.beginPath(); g.arc(x, y, r, 0, 6.2832);
    g.fillStyle = `rgba(${rgb},${(0.12 + 0.22 * f).toFixed(3)})`; g.fill();
    g.save(); g.lineWidth = 1.4; g.strokeStyle = `rgba(${rgb},${(0.5 + 0.4 * f).toFixed(3)})`;
    g.shadowColor = `rgba(${rgb},.9)`; g.shadowBlur = 6 + 14 * f; g.stroke(); g.restore();
    if (f > 0.55) { g.fillStyle = `rgb(${rgb})`; g.font = '800 10px ui-monospace,monospace'; g.textAlign = 'center'; g.fillText(fmtUsd(tr.usd), x, y - r - 4); }
    if (!big || tr.usd > big.usd) big = { x, y, r, rgb, usd: tr.usd };
  }
  // anillo pulsante en la mayor ballena del tramo
  if (big) { const p = (now % 1400) / 1400; const rr = big.r + 4 + p * 16; g.save(); g.globalAlpha = (1 - p) * 0.6; g.lineWidth = 2; g.strokeStyle = `rgb(${big.rgb})`; g.beginPath(); g.arc(big.x, big.y, rr, 0, 6.2832); g.stroke(); g.restore(); }
  g.restore();
  g.textAlign = 'left';
}

/* Leyenda discreta (arriba-izquierda): qué es cada burbuja. */
function dibujarLeyenda(g) {
  const bx = 12, by = 12, bw = 186, bh = 56;
  g.save(); g.textAlign = 'left';
  g.fillStyle = 'rgba(13,17,24,.9)'; redondeado(g, bx, by, bw, bh, 11); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; redondeado(g, bx, by, bw, bh, 11); g.stroke();
  g.fillStyle = '#E8B84B'; g.font = '900 11px system-ui,sans-serif'; g.fillText('WHALE TRADES', bx + 12, by + 19);
  g.fillStyle = '#2ee86a'; g.beginPath(); g.arc(bx + 16, by + 34, 4, 0, 6.2832); g.fill();
  g.fillStyle = '#c3cbd4'; g.font = '700 10px system-ui,sans-serif'; g.fillText('Aggressive buy', bx + 26, by + 37);
  g.fillStyle = '#ff5162'; g.beginPath(); g.arc(bx + 16, by + 48, 4, 0, 6.2832); g.fill();
  g.fillStyle = '#c3cbd4'; g.fillText('Aggressive sell', bx + 26, by + 51);
  g.fillStyle = '#7d8794'; g.font = '600 9px system-ui,sans-serif'; g.textAlign = 'right'; g.fillText('size = USD', bx + bw - 12, by + 19);
  g.restore(); g.textAlign = 'left';
}

function redondeado(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ══════════════════ GESTOS (zoom/pan) ══════════════════ */
function engancharGestos(cv) {
  const zoom = (f) => { const maxA = Math.max(60, (M.velas.length || 700) - 2); M.ancho = Math.max(14, Math.min(maxA, Math.round((M.ancho || 100) * f))); dibujar(); };
  let ax = 0, ay = 0, arr = false, dragEsc = false, dragX = false;
  const enEscala = (x) => x > cv.clientWidth - 66;              // eje de PRECIOS (derecha)
  const enEjeX = (x, y) => y > cv.clientHeight - 24 && x < cv.clientWidth - 66;   // eje de FECHAS (abajo)
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  cv.addEventListener('mousedown', (e) => {
    const r = cv.getBoundingClientRect(); const lx = e.clientX - r.left, ly = e.clientY - r.top;
    ax = lx; ay = ly; dragEsc = enEscala(lx); dragX = !dragEsc && enEjeX(lx, ly); arr = true;
    cv.style.cursor = dragX ? 'ew-resize' : (dragEsc ? 'ns-resize' : 'grabbing');
  });
  window.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    M._cursor = { x, y };
    if (!arr) {
      cv.style.cursor = enEscala(x) ? 'ns-resize' : (enEjeX(x, y) ? 'ew-resize' : 'crosshair');
      return;
    }
    if (dragEsc) {
      const dy = y - ay;
      if (Math.abs(dy) > 1) { M.zoomY = Math.max(0.2, Math.min(6, (M.zoomY || 1) * (1 + dy * 0.004))); ay = y; dibujar(); }
      return;
    }
    if (dragX) {
      const dxx = x - ax;
      if (Math.abs(dxx) > 2) { const maxA = Math.max(60, (M.velas.length || 700) - 2); M.ancho = Math.max(14, Math.min(maxA, Math.round((M.ancho || 100) * (1 + dxx * 0.006)))); ax = x; dibujar(); }
      return;
    }
    const paso = M._geo ? M._geo.paso : 8; const dx = x - ax, dy = y - ay;
    if (Math.abs(dx) > paso) { M.desplaz = (M.desplaz || 0) + Math.round(dx / paso); ax = x; }
    M.offsetY = (M.offsetY || 0) + dy; ay = y; dibujar();
  });
  window.addEventListener('mouseup', () => { arr = false; dragEsc = false; dragX = false; cv.style.cursor = 'crosshair'; });
  cv.addEventListener('mouseleave', () => { M._cursor = null; dibujar(); });
  cv.addEventListener('dblclick', () => { M.ancho = window.innerWidth < 760 ? 34 : 52; M.desplaz = 0; M.zoomY = 1; M.offsetY = 0; dibujar(); });
}

/* ══════════════════ SELECTOR DE MONEDAS / TF ══════════════════ */
const grupoNm = { cripto: 'Crypto', divisa: 'Forex', materia: 'Commodities' };
function menuPares() {
  if ($('ss-picker')) { $('ss-picker').remove(); return; }
  const ancla = $('ss-sel'); const m = document.createElement('div'); m.id = 'ss-picker'; m.className = 'ss-pop';
  const grupos = {}; PARES.forEach((p) => { (grupos[p.grupo || 'cripto'] = grupos[p.grupo || 'cripto'] || []).push(p); });
  let html = '<div class="ss-cm-top"><input id="ss-cm-q" placeholder="Filter…" autocomplete="off"></div><div class="ss-cm-list">';
  ['cripto', 'divisa', 'materia'].forEach((gr) => { if (!grupos[gr]) return; html += `<div class="ss-cm-cat">${grupoNm[gr]}</div>` + grupos[gr].map((p) => `<button class="ss-cm-it ${p.id === _par ? 'on' : ''}" data-id="${esc(p.id)}" data-b="${esc((p.id + ' ' + (p.n || '')).toLowerCase())}"><i class="ss-mini" data-cg="${esc(p.cg || '')}" data-ico="${esc(p.ico || '')}"></i><b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`).join(''); });
  html += '</div>'; m.innerHTML = html; document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, r.left) + 'px';
  ponerLogos(m);
  m.querySelectorAll('.ss-cm-it').forEach((b) => b.onclick = () => { const id = b.dataset.id; m.remove(); if (id !== _par) { _par = id; const p = PARES.find((x) => x.id === id) || {}; const lg = $('ss-logo'); if (lg) { lg.dataset.cg = p.cg || ''; lg.dataset.ico = p.ico || ''; } $('ss-par').textContent = id; $('ss-nm').textContent = p.n || ''; ponerLogos(); cargarVelas(); } });
  const q = m.querySelector('#ss-cm-q'); q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); m.querySelectorAll('.ss-cm-it').forEach((b) => b.style.display = (!v || b.dataset.b.includes(v)) ? '' : 'none'); });
  setTimeout(() => q.focus(), 30);
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function menuTf() {
  if ($('ss-tfmenu')) { $('ss-tfmenu').remove(); return; }
  const ancla = $('ss-tfchip'); const m = document.createElement('div'); m.id = 'ss-tfmenu'; m.className = 'ss-pop ss-tfpop';
  m.innerHTML = SS_TFS.map((t) => `<button class="ss-tf-it ${t.id === M.tf ? 'on' : ''}" data-tf="${t.id}">${esc(t.n)}</button>`).join('');
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); const w = m.offsetWidth || 210;
  m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
  m.querySelectorAll('.ss-tf-it').forEach((b) => b.onclick = () => { M.tf = b.dataset.tf; $('ss-tfchip-t').textContent = (SS_TFS.find((t) => t.id === M.tf) || {}).n || M.tf; m.remove(); cargarVelas(); });
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function ponerLogos(root) {
  (root || document).querySelectorAll('.ss-logo, .ss-mini').forEach((el) => {
    const cg = el.dataset.cg, ico = el.dataset.ico;
    el.style.backgroundImage = '';
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
function cargarLogosCache(root) {
  asegurarLogos().then(() => aplicarLogos(root));
}
function aplicarLogos(root) {
  if (!window.__aurexLogos) return;
  (root || document).querySelectorAll('.ss-logo, .ss-mini').forEach((el) => { if (el.dataset.ico) return; const cg = el.dataset.cg; const url = cg && window.__aurexLogos[cg]; if (url) { el.style.backgroundImage = `url(${url})`; el.classList.add('con'); el.textContent = ''; } });
}

/* ══════════════════ EXPORT (con marca de agua = logo en el pie) ══════════════════ */
function guardarImagen() {
  const cv = $('ss-cv'); if (!cv) return;
  const marca = $('ss-marca'); const antes = marca ? marca.style.display : null; if (marca) marca.style.display = 'none';
  const devolver = () => { if (marca) marca.style.display = antes || ''; };
  try {
    const e2 = cv.width / cv.clientWidth, barra = 78 * e2;
    const out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height + barra;
    const g = out.getContext('2d'); g.fillStyle = '#0a0e14'; g.fillRect(0, 0, out.width, out.height); g.drawImage(cv, 0, 0);
    const yB = cv.height; g.fillStyle = '#0b0e12'; g.fillRect(0, yB, out.width, barra);
    g.fillStyle = 'rgba(232,184,75,.35)'; g.fillRect(0, yB, out.width, 2 * e2);
    const textos = (x) => {
      g.textAlign = 'left'; g.fillStyle = '#E8B84B'; g.font = `800 ${19 * e2}px system-ui,sans-serif`; g.fillText('Whale Trades', x, yB + 34 * e2);
      g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillStyle = '#C9A84B'; g.fillText(WEB, x, yB + 56 * e2);
      g.textAlign = 'right'; g.fillStyle = '#8b96a3'; g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillText(`${_par} · ${M.tf}`, out.width - 20 * e2, yB + 34 * e2);
      g.font = `${11 * e2}px ui-monospace,monospace`; g.fillStyle = '#6b7681'; g.fillText(new Date().toLocaleString('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), out.width - 20 * e2, yB + 56 * e2);
      g.textAlign = 'left';
    };
    const bajar = () => out.toBlob((blob) => { devolver(); if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `decfreedom-whaletrades-${_par}-${Date.now()}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }, 'image/png');
    const logo = new Image(); let hecho = false;
    const una = (w) => { if (hecho) return; hecho = true; textos(w ? 20 * e2 + w + 18 * e2 : 20 * e2); bajar(); };
    logo.onload = () => { try { const alto = 52 * e2, ancho = Math.round(logo.width * (alto / logo.height)); g.drawImage(logo, 20 * e2, yB + (barra - alto) / 2, ancho, alto); una(ancho); } catch (_) { una(0); } };
    logo.onerror = () => una(0); setTimeout(() => una(0), 1500); logo.src = LOGO;
  } catch (_) { devolver(); }
}

/* ══════════════════ AYUDA (stepper experto, igual que Footprint / Heat Pools) ══════════════════ */
const PASOS_RZ = [
  {
    t: 'What Whale Trades is',
    d: 'Whale Trades draws the <b>live executed tape</b> of the market straight onto a 1 second chart. Every <b>big market order</b> that prints becomes a <b>bubble</b> at the exact price and second it happened. It is not an opinion and there is no analyst: it is the real flow of money, the trades that actually went through, so you can see the <b>size</b> moving the market instead of guessing.',
    x: 'A normal candle hides who did the work. A bubble shows you the single order that pushed the price.'
  },
  {
    t: 'Green is buying, red is selling',
    d: 'A <b>green bubble</b> is an <b>aggressive buy</b>: someone crossed the spread and lifted the offer, paying up to get filled now. A <b>red bubble</b> is an <b>aggressive sell</b>: someone hit the bid to get out now. The colour tells you which side was <b>impatient</b>, and the impatient side is usually the one moving price.',
    x: 'Passive limit orders do not show here. Only market orders, the ones that actually move the tape, become bubbles.'
  },
  {
    t: 'Size is the whole point',
    d: 'The <b>bigger the bubble, the bigger the trade</b> in US dollars. The size is scaled to each market, so even smaller coins show their own whales, and the <b>largest trade on screen</b> gets a soft ring that pulses so it is impossible to miss. The dollar value is printed on the biggest ones.',
    x: 'One giant lone bubble is a single player stepping in. A cluster of them is a crowd, a program, or a liquidation cascade.'
  },
  {
    t: 'Read the flow',
    d: 'Watch where the big bubbles land. A stack of <b>green</b> into a level that holds is <b>aggressive buying being absorbed</b>, often fuel for a move up. A stack of <b>red</b> that fails to break a level is selling getting eaten. A sudden <b>burst</b> of one colour is momentum or a liquidation. You are reading intent, in real time, at the tick.',
    x: 'Context matters more than any single bubble. Ask who is being aggressive and whether price is actually moving for them.'
  },
  {
    t: 'The 1 second edge and the timeframes',
    d: 'On the <b>1 second</b> chart you see the exact instant size hits, which is impossible on a 1 minute candle. When you want the bigger picture, switch the timeframe chip: <b>2s to 30s</b> for fast scalps, up to <b>1m, 5m, 15m, 1H, 2H, 4H, 1D</b> for context. Use the <b>drawing tools</b> on the left to mark your levels and right click to set an order or alert.',
    x: 'Whales matter most up close. The low timeframes are where the tape tells you something a candle never could.'
  },
  {
    t: 'This is data, not a signal',
    d: 'Whale Trades shows what already happened: it is <b>market data for information and education</b>, not a buy or sell signal and not financial advice. A big trade is not a promise of direction, price can keep going the other way, and the feed can be delayed. Decide every trade yourself, risk only a <b>small fixed percentage</b>, and carry your own risk.',
    x: 'It guarantees no result. The tape is a lens on who is active, nothing more. You own every decision you make with it.'
  }
];
let _pasoRZ = 0;
function ayuda() {
  if ($('ss-ayuda-box')) { $('ss-ayuda-box').remove(); return; }
  _pasoRZ = 0;
  const d = document.createElement('div'); d.id = 'ss-ayuda-box';
  d.innerHTML = `<div class="ss-ab-bg"></div>
    <div class="ss-ab-c">
      <button class="ss-ab-x" aria-label="Close">✕</button>
      <div class="ss-ab-eyebrow">Whale Trades</div>
      <div id="ss-ab-cuerpo"></div>
      <div class="ss-ab-legal"><button class="ss-disc-link" id="ss-disc-link" type="button">Disclaimer</button></div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  d.querySelector('.ss-ab-bg').onclick = q; d.querySelector('.ss-ab-x').onclick = q;
  $('ss-disc-link').onclick = () => discWhales(true);
  pintarPasoRZ();
}
function pintarPasoRZ() {
  const c = $('ss-ab-cuerpo'); if (!c) return;
  const p = PASOS_RZ[_pasoRZ]; const ultimo = _pasoRZ === PASOS_RZ.length - 1;
  c.innerHTML = `
    <div class="ss-ab-card">
      <div class="ss-ab-n">${_pasoRZ + 1} <em>of ${PASOS_RZ.length}</em></div>
      <div class="ss-ab-t">${p.t}</div>
      <div class="ss-ab-d">${p.d}</div>
      <div class="ss-ab-x2">${p.x}</div>
    </div>
    <div class="ss-ab-dots">${PASOS_RZ.map((_, i) => `<i class="${i === _pasoRZ ? 'on' : ''}" data-paso="${i}"></i>`).join('')}</div>
    <div class="ss-ab-acts">
      ${_pasoRZ > 0 ? '<button class="ss-ab-back" id="ss-ab-back">Back</button>' : ''}
      <button class="ss-ab-next" id="ss-ab-next">${ultimo ? 'Got it' : 'Learn more'}</button>
    </div>`;
  $('ss-ab-next').onclick = () => { if (_pasoRZ >= PASOS_RZ.length - 1) { $('ss-ayuda-box')?.remove(); return; } _pasoRZ++; pintarPasoRZ(); };
  const at = $('ss-ab-back'); if (at) at.onclick = () => { _pasoRZ = Math.max(0, _pasoRZ - 1); pintarPasoRZ(); };
  c.querySelectorAll('[data-paso]').forEach((b) => b.onclick = () => { _pasoRZ = Number(b.dataset.paso); pintarPasoRZ(); });
}

/* ══════════════════ ESTILOS ══════════════════ */
let _css = false;
function estilos() {
  if (_css || $('ss-css')) { _css = true; return; } _css = true;
  const s = document.createElement('style'); s.id = 'ss-css'; s.textContent = CSS; document.head.appendChild(s);
}
const CSS = `
#ss-overlay{position:fixed;inset:0;z-index:9740;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#e7ebf0;
  --g:#28d26a; --r:#ff4a5a; --gold:#E8B84B; --line:#1d2630; --mono:"Chakra Petch",ui-monospace,monospace}
#ss-overlay *{box-sizing:border-box}
.ss-bg{position:absolute;inset:0;background:radial-gradient(1100px 560px at 80% -10%,rgba(232,184,75,.04),transparent 60%),#070b10}
.ss-c{position:relative;width:100%;height:100%;display:flex;flex-direction:column}
.ss-barra{display:flex;align-items:center;gap:10px;height:54px;flex:0 0 auto;padding:0 12px;background:linear-gradient(180deg,#0e141b,#090d12);border-bottom:1px solid var(--line)}
.ss-back{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px 0 10px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#c3cad3;cursor:pointer;font-weight:700;font-size:13px}
.ss-back svg{width:14px;height:14px}
.ss-back:hover{border-color:var(--gold);color:var(--gold)}
.ss-sel{display:inline-flex;align-items:center;gap:9px;height:38px;padding:0 11px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#e7ebf0;cursor:pointer}
.ss-sel:hover{border-color:var(--gold)}
.ss-sel b{font-family:var(--mono);font-weight:800;font-size:14px}
.ss-sel span{color:#7d8794;font-size:12.5px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-sel svg{width:11px;height:11px;color:#7d8794}
.ss-logo,.ss-mini{flex:0 0 auto;border-radius:50%;background:#1b222c center/cover no-repeat;display:grid;place-items:center;font-family:var(--mono);font-weight:800;color:var(--gold);border:1px solid #2a333f;overflow:hidden}
.ss-logo{width:24px;height:24px;font-size:11px}
.ss-mini{width:19px;height:19px;font-size:9px}
.ss-logo.con,.ss-mini.con{border-color:transparent;color:transparent}
.ss-logo.con-svg,.ss-mini.con-svg{background:none;border:none}
.ss-logo.con-svg svg,.ss-mini.con-svg svg{width:100%;height:100%}
.ss-tfchip{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:11px;background:#12161c;border:1px solid #2b3139;color:#eaecef;cursor:pointer;font-family:var(--mono);font-weight:800;font-size:13.5px}
.ss-tfchip svg{width:12px;height:12px;color:#8b96a3}
.ss-tfchip:hover{border-color:var(--gold)}
.ss-px{display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:84px}
.ss-px-v{font-family:var(--mono);font-weight:800;font-size:18px;line-height:1}
.ss-px-v.up{color:var(--g)} .ss-px-v.down{color:var(--r)}
.ss-hl{display:flex;gap:10px;font-family:var(--mono);font-size:10px;color:#7d8794}
.ss-hl b{font-weight:800} .ss-hl span:first-child b{color:var(--g)} .ss-hl span:last-child b{color:var(--r)}
.ss-estado{font-family:var(--mono);font-size:11px;color:var(--r)}
.ss-der{display:flex;align-items:center;gap:9px;margin-left:auto}
.ss-ico{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#9aa4af;font-weight:800}
.ss-ico:hover{border-color:var(--gold);color:var(--gold)}
.ss-graf{flex:1 1 auto;min-height:0;position:relative;background:#0a0e14}
.ss-cv{display:block;position:absolute;inset:0}
/* Marca de agua: MISMA ubicación/tamaño/iluminación que VWAP Pro (.it-wm). left:64px la
   deja a la DERECHA de la barra de dibujo (no la tapa), bottom:40px, 42px, opacity .82. */
.ss-marca{position:absolute;left:64px;bottom:40px;z-index:4;height:42px;width:auto;opacity:.82;pointer-events:none;display:flex;align-items:center;filter:drop-shadow(0 2px 9px rgba(0,0,0,.95))}
@media(max-width:620px){ .ss-marca{left:58px;bottom:30px;height:32px} }
.ss-esperando{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:30px;background:rgba(10,14,20,.6);z-index:2}
.ss-esperando b{font-family:var(--mono);font-size:14px;color:#cbd3dc}
.ss-esperando span{font-size:12px;color:#7d8794;max-width:280px}
.ss-spin{width:30px;height:30px;border:2.5px solid rgba(232,184,75,.2);border-top-color:var(--gold);border-radius:50%;animation:ss-sp .8s linear infinite}
@keyframes ss-sp{to{transform:rotate(360deg)}}
.ss-pop{position:fixed;z-index:10050;background:#0c1016;border:1px solid #2a333f;border-radius:12px;box-shadow:0 20px 55px rgba(0,0,0,.65);font-family:var(--mono);color:#e7ebf0}
#ss-picker{width:300px;max-height:70vh;display:flex;flex-direction:column;overflow:hidden}
.ss-cm-top{padding:8px;border-bottom:1px solid var(--line)}
.ss-cm-top input{width:100%;height:32px;border-radius:8px;border:1px solid #2a333f;background:#0a0d12;color:#e7ebf0;padding:0 11px;font-size:12.5px;font-family:var(--mono);outline:none}
.ss-cm-top input:focus{border-color:var(--gold)}
.ss-cm-list{overflow-y:auto;padding:6px}
.ss-cm-cat{font-size:9px;letter-spacing:.14em;color:var(--gold);text-transform:uppercase;padding:8px 8px 4px}
.ss-cm-it{display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 9px;border-radius:8px;border:0;background:transparent;color:#e7ebf0;cursor:pointer;text-align:left;font-size:13px}
.ss-cm-it:hover{background:rgba(232,184,75,.1)} .ss-cm-it.on{background:rgba(232,184,75,.16)}
.ss-cm-it b{font-family:var(--mono);min-width:50px;color:var(--gold);font-weight:800}
.ss-cm-it span{color:#7d8794;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ss-tfpop{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:6px;min-width:210px;background:#12161c;border-color:#2b3139;border-radius:14px}
.ss-tf-it{min-height:42px;border-radius:10px;border:1px solid transparent;background:rgba(255,255,255,.04);color:#c7cdd6;cursor:pointer;font-family:var(--mono);font-size:13px;font-weight:700}
.ss-tf-it:hover{border-color:#3a424c;color:#eaecef}
.ss-tf-it.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;border-color:var(--gold)}
/* ── Ayuda: stepper experto (igual que Footprint / Heat Pools) ── */
#ss-ayuda-box{position:fixed;inset:0;z-index:10300;display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Plus Jakarta Sans",system-ui,sans-serif}
.ss-ab-bg{position:absolute;inset:0;background:rgba(3,5,8,.93)}
.ss-ab-c{position:relative;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid #C9A84B;border-radius:20px;padding:24px 20px}
.ss-ab-x{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;padding:0;cursor:pointer;font-size:15px;z-index:5;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6}
.ss-ab-eyebrow{font-family:var(--mono);font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:2px;text-align:center;margin-bottom:18px}
.ss-ab-card{padding:24px 20px;border-radius:16px;text-align:center;margin-bottom:18px;background:linear-gradient(165deg,rgba(232,184,75,.08),rgba(255,255,255,.015));border:1px solid rgba(232,184,75,.26)}
.ss-ab-n{font-family:var(--mono);font-size:11px;color:var(--gold);font-weight:700;margin-bottom:10px}
.ss-ab-n em{font-style:normal;color:#5c6672;font-weight:400}
.ss-ab-t{font-weight:800;font-size:21px;color:#eaecef;margin-bottom:12px;line-height:1.25}
.ss-ab-d{font-size:14px;color:#b7bdc6;line-height:1.65;margin-bottom:14px}
.ss-ab-d b{color:var(--gold);font-weight:700}
.ss-ab-x2{padding:12px 14px;border-radius:11px;background:rgba(255,255,255,.035);border-left:2px solid #C9A84B;font-size:12.5px;color:#8b96a3;line-height:1.55;text-align:left}
.ss-ab-dots{display:flex;gap:5px;justify-content:center;margin-bottom:18px;flex-wrap:wrap}
.ss-ab-dots i{width:7px;height:7px;border-radius:50%;background:#2b3139;cursor:pointer;transition:background .18s,transform .18s}
.ss-ab-dots i.on{background:var(--gold);transform:scale(1.35)}
.ss-ab-acts{display:flex;gap:9px}
.ss-ab-back{flex:0 0 auto;min-height:48px;padding:0 20px;border-radius:12px;background:transparent;border:1px solid #2b3139;color:#8b96a3;cursor:pointer;font-weight:700;font-size:13px}
.ss-ab-back:hover{border-color:#3a424c;color:#b7bdc6}
.ss-ab-next{flex:1;min-height:48px;border-radius:12px;border:0;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;font-weight:800;font-size:14px;cursor:pointer}
/* Disclaimer oficial (sello + casilla obligatoria), patrón del sitio */
.ss-disc{position:fixed;inset:0;z-index:10400;display:flex;align-items:center;justify-content:center;padding:20px;font-family:"Plus Jakarta Sans",system-ui,sans-serif}
.ss-disc-bg{position:absolute;inset:0;background:rgba(4,6,10,.9);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.ss-disc-c{position:relative;width:100%;max-width:560px;border-radius:18px;padding:24px 26px 22px;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid #C9A84B;box-shadow:0 24px 60px rgba(0,0,0,.7);text-align:left;display:flow-root;max-height:88vh;overflow:auto}
.ss-disc-sello{float:right;width:116px;height:116px;margin:0 0 10px 18px;shape-outside:margin-box;filter:drop-shadow(0 8px 18px rgba(0,0,0,.5))}
.ss-disc-c h4{margin:2px 0 12px;font-size:20px;color:var(--gold)}
.ss-disc-c p{font-size:12.8px;line-height:1.65;color:#c4ccd4;margin:0 0 12px}
.ss-disc-c p b{color:#eaecef}
.ss-disc-chk{display:flex;align-items:flex-start;gap:10px;clear:both;margin:6px 0 16px;cursor:pointer;font-size:12.5px;line-height:1.5;color:#d4dae1}
.ss-disc-chk input{flex:none;width:18px;height:18px;margin:1px 0 0;accent-color:var(--gold);cursor:pointer}
.ss-disc-ok{clear:both;width:100%;min-height:46px;border-radius:11px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold) 45%,#c79426);color:#3a2800;font-weight:800;font-size:14px;cursor:pointer}
.ss-disc-ok[disabled]{opacity:.45;cursor:not-allowed}
.ss-disc-x{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:9px;border:1px solid #232b36;background:rgba(255,255,255,.05);color:#c7ccd4;font-size:13px;cursor:pointer;z-index:2}
.ss-ab-legal{margin-top:16px;text-align:center}
.ss-disc-link{display:inline-flex;align-items:center;height:32px;padding:0 16px;border-radius:9px;border:1px solid #2b3139;background:rgba(255,255,255,.03);color:#C9A84B;font-size:12px;font-weight:700;cursor:pointer}
.ss-disc-link:hover{color:#f4d089;border-color:rgba(232,184,75,.5)}
@media(max-width:560px){ .ss-disc-sello{float:none;display:block;width:92px;height:92px;margin:0 auto 10px} .ss-disc-c{text-align:center} .ss-disc-c p,.ss-disc-chk{text-align:left} }
@media(max-width:900px){ .ss-sel span,.ss-px{display:none} }
`;
