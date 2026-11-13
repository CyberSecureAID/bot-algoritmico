/* modules/velaavela/velaavela.js — "Footprint" (nombre de cara al usuario).
   El archivo NO se renombra, igual que "VWAP Pro" vive en modules/institutional/.

   Servicio de Analysis. MISMO chrome y dinámica que Reaction/Smart/Heat/Liquidity
   Pools: barra superior idéntica (Back · moneda+lista · temporalidad · precio+máx/mín
   · export con marca de agua · ayuda), gráfica de canvas propia con zoom/pan (rueda,
   arrastre del eje de precios = estira vertical, arrastre del eje de tiempo = estira
   horizontal, doble clic = reset), barra de dibujo compartida (barra.js),
   órdenes/alertas con clic derecho (orden.js) y catálogo único de monedas (config.js).
   La señal se muestra sola con su ficha (no hay Single/Double). Cambia el MOTOR y la
   presentación: una ficha que dice qué hacer y un panel de flujo grande y legible.

   MOTOR "Footprint" (flujo de órdenes): lee la CINTA ejecutada midiendo, por vela, el
   DELTA = volumen taker comprador menos taker vendedor. Las velas de Binance ya traen
   el volumen taker comprador (índice 10) y el quote (índice 7): delta = 2·takerBuy −
   quote, exacto para todo el histórico y en vivo por el mismo WebSocket de klines (k.Q
   y k.q). Con eso se arma el CVD (delta acumulado) y se detectan TRES señales
   accionables, cada una proyecta entrada/stop/objetivo a 1:2 (ficha con estado, órdenes):
     1) ABSORCIÓN: ola agresiva fuerte contra el movimiento pero el precio no cede →
        hay un pasivo absorbiendo → giro a favor del que absorbe.
     2) DIVERGENCIA CVD/precio: el precio hace extremo nuevo y el CVD no lo acompaña →
        agotamiento → giro.
     3) RUPTURA CONFIRMADA POR DELTA: el precio rompe un nivel con delta fuerte a favor
        → continuación (filtra rupturas falsas).
   Datos solo de Binance SPOT (regla de CLAUDE.md), sin futuros. */

import { montarBarra } from '../../assets/js/niveles/barra.js?v=6';
import { PARES, pintarIcono, TFS } from '../../assets/js/niveles/config.js?v=1';
import { N } from '../../assets/js/niveles/estado.js?v=1';
import { cargarDib } from '../../assets/js/niveles/dibujo.js?v=3';

const WEB = 'decfreedom.com';
/* Ruta del logo resuelta contra la URL del script (no del documento): así
   /assets/img/cco-marca.png carga igual aunque la página se sirva desde
   /modules/analysis/. Es la marca de agua del export y del lienzo. */
const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const DISC_IMG = new URL('../../assets/portada/red/disclaimer.webp', import.meta.url).href;   // sello del disclaimer, el mismo de toda la plataforma
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let _par = 'BTC';

const M = {
  tf: '1s', velas: [], precio: 0, data: { live: [], dead: [], triangles: [] }, sig: null, cvd: [],
  ema: [], rsi: [], cerradas: [],            // EMA50, RSI(2) y operaciones ganadas que quedan de registro
  ancho: window.innerWidth < 760 ? 46 : 70, desplaz: 0, zoomY: 1, offsetY: 0,
  _geo: null, _cursor: null, _modoPos: null, _posAuto: null, _posSig: null,
  cargando: true, error: null
};
const EMA_LEN = 50, RSI_LEN = 2, RSI_HI = 99, RSI_LO = 9, RR = 1.5;   // parámetros EXACTOS de la estrategia
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
  // La kline de Binance trae el volumen TAKER comprador (índice 10, quote) y el
  // volumen quote total (índice 7). El DELTA de flujo de una vela = taker comprador
  // menos taker vendedor = 2·takerBuy − total. Es la cinta ejecutada (los agresores).
  return j.map((x) => {
    const qv = +x[7] || 0, tb = +x[10] || 0;
    return { t: Math.floor(x[0] / 1000), o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: qv || +x[5] || 0, qv, tb, d: 2 * tb - qv };
  });
}

/* ── Velas EN VIVO por WebSocket de Binance ──
   La vela en formación se ve al instante (el bucle de 90 ms ya repinta); al
   cerrar se recalculan las zonas. El sondeo de 15 s sigue como resync/respaldo,
   así que se conserva el fallback de hosts si stream.binance.com estuviera
   bloqueado. `t` en SEGUNDOS y `v` en volumen quote, igual que traerVelas. ── */
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
  const key = p.s + '|' + M.tf;
  if (_ssStreamKey === key && _ssStream) return;
  if (_ssStream) { try { _ssStream.cerrar(); } catch (_) {} _ssStream = null; }
  _ssStreamKey = key;
  try { _ssStream = streamVelasRz(p.s, M.tf, onKlineRz); } catch (_) { _ssStream = null; }
}
function onKlineRz(k) {
  if (!k || !M.velas || !M.velas.length) return;
  // k.q = volumen quote total, k.Q = volumen taker comprador (quote). Delta vivo igual
  // que en el histórico: 2·takerBuy − total. Así el CVD y el delta de la vela en curso
  // se actualizan al instante con el mismo stream, sin pedir aggTrades.
  const qv = +k.q || 0, tb = +k.Q || 0;
  const c = { t: Math.floor(k.t / 1000), o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: qv || +k.v || 0, qv, tb, d: 2 * tb - qv };
  if (!(c.c > 0)) return;
  const last = M.velas[M.velas.length - 1];
  if (c.t === last.t) { M.velas[M.velas.length - 1] = c; }        // misma vela en formación
  else if (c.t > last.t) { M.velas.push(c); }                      // nueva vela
  else return;                                                     // vieja → ignorar
  M.precio = c.c;                                                  // el bucle de 90 ms repinta solo
  if (k.x === true) { try { recalcular(); } catch (_) {} }         // al CERRAR: recalcular zonas de reacción
}

const fmt = (p) => {
  if (!(p > 0)) return '·';
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(5);
  return p.toFixed(8);
};
/* Etiqueta del eje de tiempo: en 1 segundo, hora con SEGUNDOS. */
function fmtFecha(tsSec) {
  const d = new Date(tsSec * 1000);
  if (M.tf === '1s') return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const intradia = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h'].includes(M.tf);
  return intradia
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/* ══════════════════ APERTURA ══════════════════ */
export async function abrirSuperScalper() {
  estilos();
  const prev = $('ss-overlay'); if (prev) prev.remove();
  M.velas = []; M.data = { live: [], dead: [], triangles: [] }; M.cargando = true; M.error = null;
  M._modoPos = null; M._posAuto = null;

  const p0 = PARES.find((p) => p.id === _par) || PARES[0]; _par = p0.id;
  const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
  const d = document.createElement('div');
  d.id = 'ss-overlay';
  d.innerHTML = `<div class="ss-bg"></div>
    <div class="ss-c">
      <div class="ss-barra">
        <button class="ss-back" id="ss-back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>Back</button>
        <button class="ss-sel" id="ss-sel"><i class="ss-logo" id="ss-logo" data-cg="${esc(p0.cg || '')}" data-ico="${esc(p0.ico || '')}"></i><b id="ss-par">${esc(_par)}</b><span id="ss-nm">${esc(p0.n || '')}</span>${chev}</button>
        <button class="ss-tfchip" id="ss-tfchip" type="button" title="Timeframe"><b id="ss-tfchip-t">1s</b></button>
        <div class="ss-px"><div class="ss-px-v" id="ss-px">·</div><div class="ss-hl"><span>H <b id="ss-hi">·</b></span><span>L <b id="ss-lo">·</b></span></div></div>
        <span id="ss-estado" class="ss-estado"></span>
        <div class="ss-der">
          <button class="ss-share" id="ss-share" title="Share signal">Share signal</button>
          <button class="ss-ico" id="ss-foto" title="Share image"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="3.5"/></svg></button>
          <button class="ss-ico" id="ss-ayuda" title="How it works">?</button>
        </div>
      </div>
      <div class="ss-graf" id="ss-graf">
        <canvas class="ss-cv" id="ss-cv"></canvas>
        <div class="ss-esperando" id="ss-esperando"><div class="ss-spin"></div><b>Loading the 1 second chart…</b><span>Streaming live candles, EMA 50 and the RSI 2 trigger.</span></div>
        <img class="ss-marca" id="ss-marca" src="${LOGO}" alt="">
      </div>
    </div>`;
  document.body.appendChild(d);

  d.querySelector('.ss-bg').onclick = cerrar;
  $('ss-back').onclick = cerrar;
  $('ss-sel').onclick = (e) => { e.stopPropagation(); menuPares(); };
  $('ss-ayuda').onclick = ayuda;
  $('ss-foto').onclick = guardarImagen;
  $('ss-share').onclick = () => compartirSenal();
  // La temporalidad está fija en 1 segundo (la estrategia es de 1s). El chip solo informa.

  ponerLogos();
  cargarVelas();
  clearInterval(_pulso);
  _pulso = setInterval(() => { if ($('ss-cv')) { cerrarGanadoras(); dibujar(); } }, 90);   // ~11fps: movimiento fluido + chequeo de objetivo/stop en vivo
  let _t = null; M._onResize = () => { clearTimeout(_t); _t = setTimeout(() => { if ($('ss-cv')) dibujar(); }, 200); };
  window.addEventListener('resize', M._onResize);
  discScalper(false);   // disclaimer oficial de entrada (sello + aceptación obligatoria)
}

/* Disclaimer de entrada, con el MISMO patrón del resto de la plataforma: sello en la
   esquina, exoneración total, y ACEPTACIÓN OBLIGATORIA (casilla + botón, tocar fuera
   no cierra). Es una ESTRATEGIA, no consejo de inversión. reView: reabierto desde la ayuda. */
function discScalper(reView) {
  if (!reView) { try { if (localStorage.getItem('ss-disc-v1') === '1') return; } catch (_) {} }
  const vieja = $('ss-disc'); if (vieja) vieja.remove();
  const d = document.createElement('div'); d.id = 'ss-disc'; d.className = 'ss-disc' + (reView ? ' rev' : '');
  d.innerHTML = `<div class="ss-disc-bg"></div><div class="ss-disc-c">
    ${reView ? '<button class="ss-disc-x" id="ss-disc-x" aria-label="Close">✕</button>' : ''}
    <img class="ss-disc-sello" src="${DISC_IMG}" alt="">
    <h4>Before you start</h4>
    <p>Super Scalper is a <b>mechanical strategy</b> drawn on a live 1 second chart, for informational and educational purposes only. Nothing here is financial, investment, legal or tax advice, and we do not guarantee any result, profit or performance. The signals are the output of a fixed rule set, not a recommendation to buy or sell. Trading digital assets, and scalping in particular, carries a very high risk and you can lose part or all of your capital fast.</p>
    <p>Every entry, exit and the size of every trade are your own decision and your sole responsibility. The tools are provided as is, without warranty of any kind, and part of the data comes from third parties. To the maximum extent permitted by law, DecFreedom, its owners and affiliates accept no liability for any loss or damage arising from the use of this section. By continuing you accept this notice and our Terms and Conditions.</p>
    ${reView ? '' : '<label class="ss-disc-chk"><input type="checkbox" id="ss-disc-agree"><span>I have read and I accept this notice and the Terms and Conditions. I understand this is a strategy and support only, not financial advice, that it guarantees no result, and that I trade entirely at my own risk.</span></label>'}
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
    if (!reView) { const chk = $('ss-disc-agree'); if (!chk || !chk.checked) return; try { localStorage.setItem('ss-disc-v1', '1'); } catch (_) {} }
    cerrarD();
  };
}

function cerrar() {
  clearInterval(_reloj); clearInterval(_pulso);
  if (_ssStream) { try { _ssStream.cerrar(); } catch (_) {} _ssStream = null; _ssStreamKey = ''; }   // cierra el WebSocket de velas en vivo
  if (M._onResize) window.removeEventListener('resize', M._onResize);
  if (_barra) { try { _barra.desmontar(); } catch (_) {} _barra = null; }
  document.querySelectorAll('#ss-picker, #ss-tfmenu, #ss-ayuda-box, #ss-disc').forEach((x) => x.remove());
  const e = $('ss-overlay'); if (e) e.remove();
  const sel = $('an-sel'); if (sel) sel.style.display = '';   // vuelve al selector de Analysis
}

async function cargarVelas() {
  M.cargando = true;
  M.cerradas = []; _resueltos = new Set();   // moneda/temporalidad nueva: limpia el registro de operaciones
  if (_ssStream) { try { _ssStream.cerrar(); } catch (_) {} _ssStream = null; _ssStreamKey = ''; }   // corta el stream anterior antes de recargar otra moneda/temporalidad
  const p = PARES.find((x) => x.id === _par) || {};
  try {
    M.velas = await traerVelas(p.s, M.tf, 700);
    M.cargando = false;
    if (M.velas.length) { M.precio = M.velas[M.velas.length - 1].c; recalcular(); }
    const est = $('ss-estado'); if (est) est.textContent = '';
  } catch (e) { M.cargando = false; M.error = 'feed'; const est = $('ss-estado'); if (est) est.textContent = 'Market data unavailable.'; }
  dibujar();
  clearInterval(_reloj);
  _reloj = setInterval(async () => {
    try { const v = await traerVelas(p.s, M.tf, 700); M.velas = v; if (v.length) M.precio = v[v.length - 1].c; recalcular(); dibujar(); } catch (_) {}
  }, 15000);
  conectarStreamRz();          // velas EN VIVO por WebSocket (el sondeo de 15 s queda de resync)
}
function recalcular() {
  const cl = M.velas.map((v) => v.c);
  M.ema = ema(cl, EMA_LEN);                       // EMA 50 (filtro de tendencia)
  M.rsi = rsi(cl, RSI_LEN);                       // RSI longitud 2 (oscila fuerte)
  M.sig = calcularScalp(M.velas, M.ema, M.rsi);   // señal de la estrategia vigente
  cerrarGanadoras();                              // las que pegaron objetivo quedan de registro
  M._posAuto = null;
  refrescarCabecera();
}

/* ══════════════════ MOTOR — Estrategia RSI(2) + EMA(50) ══════════════════
   Reglas EXACTAS en 1 segundo:
     · EMA 50 sobre el cierre = filtro de tendencia. Precio POR ENCIMA = solo largos;
       precio POR DEBAJO = solo cortos.
     · RSI longitud 2, banda baja 9 (verde) y banda alta 99 (roja).
     · LARGO: precio sobre la EMA y el RSI TOCA la banda baja (<= 9).
     · CORTO: precio bajo la EMA y el RSI TOCA la banda alta (>= 99).
     · Nada en contra de la tendencia (sobre la EMA tocando la banda alta = no operar).
   Cada señal arma entrada, stop por DEBAJO/encima de la EMA (sin tocarla) y objetivo
   a 1:1.5. Las que pegan objetivo quedan como registro (cerrarGanadoras). */
function ema(vals, len) {
  const out = new Array(vals.length).fill(null); if (!vals.length) return out;
  const k = 2 / (len + 1); let e = vals[0];
  for (let i = 0; i < vals.length; i++) { e = i ? vals[i] * k + e * (1 - k) : vals[0]; out[i] = i >= len - 1 ? e : null; }
  return out;
}
function rsi(vals, len) {
  const out = new Array(vals.length).fill(null); if (vals.length <= len) return out;
  let ag = 0, al = 0;
  for (let i = 1; i <= len; i++) { const d = vals[i] - vals[i - 1]; if (d >= 0) ag += d; else al -= d; }
  ag /= len; al /= len;
  out[len] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = len + 1; i < vals.length; i++) {
    const d = vals[i] - vals[i - 1], g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
    ag = (ag * (len - 1) + g) / len; al = (al * (len - 1) + l) / len;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}
function calcAtr(velas, idx, p) {
  let s = 0, c = 0;
  for (let i = Math.max(1, idx - p + 1); i <= idx; i++) {
    const tr = Math.max(velas[i].h - velas[i].l, Math.abs(velas[i].h - velas[i - 1].c), Math.abs(velas[i].l - velas[i - 1].c));
    s += tr; c++;
  }
  return c ? s / c : 0;
}
/* Pivotes locales (k vecinos a cada lado): devuelve [másReciente, previo]. */
function pivotes(velas, last, tipo) {
  const k = 2, out = [];
  for (let i = last - k; i >= Math.max(k, last - 44); i--) {
    const v = velas[i]; let ok = true;
    for (let j = 1; j <= k; j++) {
      if (tipo === 'low') { if (!(v.l < velas[i - j].l && v.l < velas[i + j].l)) { ok = false; break; } }
      else { if (!(v.h > velas[i - j].h && v.h > velas[i + j].h)) { ok = false; break; } }
    }
    if (ok) { out.push(i); if (out.length >= 2) break; }
  }
  return out;
}
/* Arma la señal: entrada, stop (invalidación del flujo) y objetivo a 1:2. */
let _resueltos = new Set();   // tiempos de velas gatillo ya resueltas (ganada/invalidada): no se re-arman
function armarSenal(largo, bar, velas, verdict, opt) {
  opt = opt || {};
  const v = velas[bar];
  const entry = opt.entry != null ? opt.entry : v.c;
  const sl = opt.sl;                                    // SIEMPRE por debajo/encima de la EMA (lo pone calcularScalp)
  const R = Math.abs(entry - sl) || 1e-9;
  const tp = largo ? entry + RR * R : entry - RR * R;   // objetivo a 1:1.5
  return { largo, bar, entry, sl, tp, ema: opt.ema, refHi: v.h, refLo: v.l, verdict, t: v.t };
}
/* Estrategia: filtro de tendencia por EMA 50 + gatillo por toque del RSI(2) en su
   banda del lado de la tendencia. Mira la última CERRADA y hasta 6 atrás para no
   perder un toque de un pestañeo. El stop va SIEMPRE al otro lado de la EMA. */
function calcularScalp(velas, emaArr, rsiArr) {
  const n = velas.length;
  if (n < EMA_LEN + 4) return null;
  const last = n - 2;                                   // última CERRADA (la n-1 está en formación)
  const atr = calcAtr(velas, last, 14) || ((velas[last].h - velas[last].l) || 1e-9);
  for (let i = last; i >= Math.max(EMA_LEN, last - 6); i--) {
    if (_resueltos.has(velas[i].t)) continue;           // ya se resolvió: no re-armar
    const e = emaArr[i], r = rsiArr[i]; if (e == null || r == null) continue;
    const v = velas[i], buf = Math.max(atr * 0.35, e * 0.0004);   // deja el stop al otro lado de la EMA, sin tocarla
    // LARGO: precio SOBRE la EMA (tendencia alcista) y el RSI toca la banda baja (verde)
    if (v.c > e && r <= RSI_LO)
      return armarSenal(true, i, velas, 'Price is above the EMA 50 (uptrend) and the RSI 2 tagged the lower band. A pullback long with the trend.', { entry: velas[last].c, sl: e - buf, ema: e });
    // CORTO: precio BAJO la EMA (tendencia bajista) y el RSI toca la banda alta (roja)
    if (v.c < e && r >= RSI_HI)
      return armarSenal(false, i, velas, 'Price is below the EMA 50 (downtrend) and the RSI 2 tagged the upper band. A pullback short with the trend.', { entry: velas[last].c, sl: e + buf, ema: e });
  }
  return null;
}
/* Cuando la señal pega su objetivo, se guarda como GANADA y queda dibujada de
   registro (la vigencia del éxito). Si toca el stop, se descarta. En ambos casos su
   vela gatillo pasa a "resueltas" para que no se vuelva a armar. */
function cerrarGanadoras() {
  const S = M.sig; if (!S || !(M.precio > 0)) return;
  const hit = S.largo ? M.precio >= S.tp : M.precio <= S.tp;
  const dead = S.largo ? M.precio <= S.sl : M.precio >= S.sl;
  if (hit) {
    if (!M.cerradas.some((c) => c.t === S.t)) {
      M.cerradas.push({ largo: S.largo, entry: S.entry, sl: S.sl, tp: S.tp, bar: S.bar, t: S.t, tEnd: M.velas.length ? M.velas[M.velas.length - 1].t : 0 });
      if (M.cerradas.length > 14) M.cerradas.shift();
    }
    _resueltos.add(S.t); M.sig = null;
  } else if (dead) { _resueltos.add(S.t); M.sig = null; }
}
/* Etiqueta corta de la señal (dirección). */
function etiquetaSig(s) { return !s ? '' : (s.largo ? 'RSI 2 · LONG' : 'RSI 2 · SHORT'); }
/* Estado operativo de la señal según dónde está el precio ahora mismo: dice si la
   entrada sigue siendo tomable, si ya corrió, si pegó objetivo o si se invalidó. */
function estadoSig(S, precio) {
  if (!S || !(precio > 0)) return { t: 'WATCHING', c: '#9aa4b0' };
  const R = Math.abs(S.entry - S.sl) || 1e-9;
  if (S.largo) {
    if (precio <= S.sl) return { t: 'INVALIDATED', c: '#ff5162' };
    if (precio >= S.tp) return { t: 'TARGET HIT', c: '#2ee86a' };
    if (precio <= S.entry + R * 0.3) return { t: 'ENTRY VALID NOW', c: '#2ee86a' };
    return { t: 'ALREADY RUNNING', c: '#E8B84B' };
  }
  if (precio >= S.sl) return { t: 'INVALIDATED', c: '#ff5162' };
  if (precio <= S.tp) return { t: 'TARGET HIT', c: '#2ee86a' };
  if (precio >= S.entry - R * 0.3) return { t: 'ENTRY VALID NOW', c: '#2ee86a' };
  return { t: 'ALREADY RUNNING', c: '#E8B84B' };
}
function refrescarCabecera() {
  const px = $('ss-px'), hi = $('ss-hi'), lo = $('ss-lo');
  if (!M.velas.length) return;
  const u = M.velas[M.velas.length - 1];
  // máx/mín del día (24h): últimas ~24h según TF
  let dH = u.h, dL = u.l; const back = Math.min(M.velas.length, tfPorDia(M.tf));
  for (let k = M.velas.length - back; k < M.velas.length; k++) { if (M.velas[k].h > dH) dH = M.velas[k].h; if (M.velas[k].l < dL) dL = M.velas[k].l; }
  if (px) { px.textContent = fmt(M.precio); px.className = 'ss-px-v ' + (u.c >= u.o ? 'up' : 'down'); }
  if (hi) hi.textContent = fmt(dH); if (lo) lo.textContent = fmt(dL);
}
function tfPorDia(tf) { const m = { '1s': 700, '1m': 1440, '3m': 480, '5m': 288, '15m': 96, '30m': 48, '1h': 24, '2h': 12, '4h': 6, '6h': 4, '12h': 2, '1d': 1, '1w': 1 }; return m[tf] || 24; }

/* ══════════════════ RENDER ══════════════════ */
function pal() { return { fondo: '#0a0e14', rejilla: 'rgba(255,255,255,.04)', ink: '#e7ebf0', dim: '#7d8794' }; }

function dibujar() {
  const cv = $('ss-cv'), zona = $('ss-graf'); if (!cv || !zona) return;
  const W = zona.clientWidth, H = zona.clientHeight; if (W < 50 || H < 50) return;

  if (!cv.dataset.listo) {
    engancharGestos(cv);
    cv.dataset.listo = '1';
    _barra = montarBarra(zona);
    // barra.js solo carga los dibujos cuando el par CAMBIA (par !== N.par). Como
    // N.par arranca en 'BTC' por defecto, al abrir en BTC nunca se cargaban y
    // N.dibujos quedaba undefined → al soltar un trazo, soltarDib() reventaba
    // (push sobre undefined) y la barra quedaba congelada. Lo garantizamos aquí.
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
  // Panel inferior para el flujo (histograma de delta + línea CVD). El área de precio
  // termina en y1; el panel va entre y1+gapP y yTime; el eje de tiempo queda abajo.
  const panelH = Math.max(78, Math.round((H - mAba) * 0.26)), gapP = 8;
  const yTime = H - mAba;
  const x1 = W - mDer, y1 = yTime - panelH - gapP, xVelas = x1;
  const ancho = Math.min(M.velas.length, M.ancho || 100);
  const huecoMax = Math.floor(ancho * 0.45);
  // Reserva hueco a la derecha para PROYECTAR las zonas de la operación (ganancia
  // y riesgo) adelantadas al precio cuando hay señal.
  const futNec = M.sig ? Math.min(huecoMax, 18) : 0;
  let desp = Math.max(-huecoMax, Math.min(M.desplaz || 0, Math.max(0, M.velas.length - ancho)));
  if (futNec && (M.desplaz || 0) <= 0 && desp > -futNec) desp = -futNec;
  M.desplaz = desp;
  const fin = M.velas.length - desp;
  const vis = M.velas.slice(Math.max(0, fin - ancho), Math.min(M.velas.length, fin));
  if (!vis.length) return;
  if (desp <= 0 && M.precio > 0) { const u = vis[vis.length - 1]; u.c = M.precio; if (M.precio > u.h) u.h = M.precio; if (M.precio < u.l) u.l = M.precio; }

  let pAlto = Math.max(...vis.map((v) => v.h)), pBajo = Math.min(...vis.map((v) => v.l));
  if (M.precio > 0) { pAlto = Math.max(pAlto, M.precio); pBajo = Math.min(pBajo, M.precio); }
  // abre la escala para que entren el stop y el take profit de la señal (tope 45%)
  const rV0 = (pAlto - pBajo) || 1, capHi = pAlto + rV0 * 0.45, capLo = pBajo - rV0 * 0.45;
  if (M.sig) { [M.sig.sl, M.sig.tp, M.sig.entry].forEach((p) => { if (p <= capHi && p >= capLo) { pAlto = Math.max(pAlto, p); pBajo = Math.min(pBajo, p); } }); }
  const rangoB = (pAlto - pBajo) || 1;
  const despY = ((M.offsetY || 0) / Math.max(1, y1)) * rangoB;
  const centro = (pAlto + pBajo) / 2 + despY;
  const semi = (rangoB / 2) * (M.zoomY || 1);
  const pad = semi * 0.14 || 1;
  const pMax = centro + semi + pad, pMin = centro - semi - pad;
  const Y = (p) => y1 - y1 * ((p - pMin) / Math.max(1e-12, pMax - pMin));
  const paso = xVelas / (ancho || vis.length);
  const pri = fin - ancho;
  const Xbar = (barIdx) => (barIdx - pri) * paso + paso / 2;   // índice de vela → x
  M._geo = { pMin, pMax, y1, xVelas, n: vis.length, vis, paso, pri, fin, ancho, tfMs: (M.velas.length > 1 ? (M.velas[1].t - M.velas[0].t) * 1000 : 3600000), t0: M.velas[0].t };

  // órdenes/alertas del usuario (mismo estilo que las pools)
  if (_od) _zonasOd = _od.pintar(g, { x1, Y, pMin, pMax, simbolo: (PARES.find((p) => p.id === _par) || {}).s || '' });

  // rejilla
  g.strokeStyle = P.rejilla; g.lineWidth = 1;
  for (let i = 1; i < 6; i++) { const y = (y1 / 6) * i; g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); }

  const now = Date.now();
  const pulso = 0.5 + 0.5 * Math.sin(now / 420);          // latido lento de zonas

  // ── VELAS ──
  dibujarVelas(g, vis, Y, paso);

  // ── OPERACIONES GANADAS: quedan dibujadas de registro (vigencia del éxito) ──
  dibujarGanadoras(g, Y, paso);

  // ── EMA 50 (filtro de tendencia) con glow iluminado, como el VWAP de VWAP Pro ──
  dibujarEMA(g, Y, paso, now);

  // ── SEÑAL: vela gatillo + zona de entrada / SL / TP + ficha ──
  dibujarFootprint(g, x1, Y, pMin, pMax, Xbar, pulso, now);

  // línea del precio
  if (M.precio > 0) {
    const yp = Y(M.precio); g.strokeStyle = 'rgba(232,184,75,.55)'; g.lineWidth = 1; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(0, yp); g.lineTo(x1, yp); g.stroke(); g.setLineDash([]);
    const u = M.velas[M.velas.length - 1]; const col = u.c >= u.o ? '#2ee86a' : '#ff5b6e';
    g.fillStyle = col; redondeado(g, x1 + 2, yp - 9, mDer - 4, 18, 4); g.fill();
    g.fillStyle = '#071018'; g.font = 'bold 10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(fmt(M.precio), x1 + 6, yp + 3.5);
  }

  // La operación de la señal (zonas, niveles y ficha) ya la dibuja dibujarFootprint.
  M._posAuto = null;

  // eje de precios (marcas)
  g.fillStyle = pal().dim; g.font = '10px ui-monospace,monospace'; g.textAlign = 'left';
  for (let i = 0; i <= 5; i++) { const y = (y1 / 5) * i; const pr = pMax - (pMax - pMin) * (i / 5); g.fillText(fmt(pr), x1 + 6, y + (i === 0 ? 10 : i === 5 ? -3 : 3)); }

  // ── PANEL RSI(2): oscilador con bandas 9 (verde) y 99 (roja) y línea amarilla ──
  dibujarPanelRSI(g, x1, y1 + gapP, yTime, paso);

  // eje de TIEMPO (abajo): fechas/horas, igual que las demás secciones
  g.fillStyle = '#0b0e12'; g.fillRect(0, yTime, W, mAba);
  g.fillStyle = pal().dim; g.font = '9px ui-monospace,monospace'; g.textAlign = 'center';
  const cadaX = Math.max(1, Math.floor(vis.length / 7));
  vis.forEach((v, i) => { if (i % cadaX !== 0) return; const x = i * paso + paso / 2; if (x > xVelas - 14) return; g.fillText(fmtFecha(v.t), x, yTime + 14); });
  g.textAlign = 'left';

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

/* Parte un texto en varias líneas que caben en maxW (para la lectura de la ficha). */
function envolver(g, text, maxW, max) {
  const words = String(text).split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines.slice(0, max || 3);
}
/* FICHA DE OPERACIÓN (arriba-izquierda): dice qué hacer. Con señal: tipo, dirección,
   estado (si la entrada es tomable ahora), lectura en claro y los tres niveles con
   R:R 1:2. Sin señal: escaneando + quién manda el flujo. Sin sombra, sin guiones. */
function dibujarFicha(g, S, precio) {
  const bx = 12, by = 12, bw = 224;
  g.save(); g.textAlign = 'left';
  if (!S) {
    const n = M.velas.length, e = n ? M.ema[n - 1] : null, px = M.precio || (n ? M.velas[n - 1].c : 0);
    const up = e != null ? px >= e : true;              // tendencia por la EMA 50
    const r = M.rsi.length ? M.rsi[M.rsi.length - 2] : null;
    const bh = 78;
    g.fillStyle = 'rgba(13,17,24,.92)'; redondeado(g, bx, by, bw, bh, 12); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; redondeado(g, bx, by, bw, bh, 12); g.stroke();
    g.fillStyle = '#E8B84B'; g.beginPath(); g.arc(bx + 18, by + 22, 3.4, 0, 6.283); g.fill();
    g.fillStyle = '#e7ebf0'; g.font = '900 13px system-ui,sans-serif'; g.fillText('SCANNING', bx + 28, by + 26);
    const c = up ? '#2ee86a' : '#ff5162';
    g.fillStyle = c; g.beginPath(); g.arc(bx + 18, by + 46, 3.2, 0, 6.283); g.fill();
    g.fillStyle = '#c3cbd4'; g.font = '700 11px system-ui,sans-serif'; g.fillText(up ? 'Above EMA 50 — looking for longs' : 'Below EMA 50 — looking for shorts', bx + 28, by + 49);
    g.fillStyle = '#7d8794'; g.font = '600 10px system-ui,sans-serif'; g.fillText(r != null ? `Waiting for RSI 2 to tag ${up ? '9' : '99'} · now ${r.toFixed(0)}` : 'Waiting for the RSI tag.', bx + 16, by + 68);
    g.restore(); return;
  }
  const largo = S.largo, rgb = largo ? '46,232,106' : '255,74,90';
  const st = estadoSig(S, precio);
  const crgb = _hex2rgb(st.c);
  const ago = Math.max(0, (M.velas.length - 2) - S.bar), fresh = ago === 0 ? 'new' : (ago === 1 ? '1 bar ago' : ago + ' bars ago');
  const lins = envolver(g, S.verdict, bw - 30, 2);
  const dy = by + 74 + lins.length * 14 + 2;   // divisoria (debajo de la lectura)
  const bh = (dy - by) + 88;                     // la caja llega hasta debajo del R:R
  g.fillStyle = 'rgba(13,17,24,.95)'; redondeado(g, bx, by, bw, bh, 13); g.fill();
  g.strokeStyle = `rgba(${rgb},.5)`; g.lineWidth = 1.2; redondeado(g, bx, by, bw, bh, 13); g.stroke();
  g.fillStyle = `rgb(${rgb})`; redondeado(g, bx, by + 12, 3, bh - 24, 2); g.fill();
  // dirección + tipo + frescura
  g.fillStyle = `rgb(${rgb})`; g.font = '900 17px system-ui,sans-serif'; g.fillText(largo ? 'LONG' : 'SHORT', bx + 16, by + 28);
  const dw = g.measureText(largo ? 'LONG' : 'SHORT').width;
  g.fillStyle = '#8b95a1'; g.font = '700 9px ui-monospace,monospace'; g.fillText(etiquetaSig(S), bx + 22 + dw, by + 27);
  g.textAlign = 'right'; g.fillStyle = '#6b7681'; g.font = '600 9px ui-monospace,monospace'; g.fillText(fresh, bx + bw - 14, by + 27); g.textAlign = 'left';
  // estado (pastilla)
  g.font = '800 10px system-ui,sans-serif'; const sw = g.measureText(st.t).width + 18;
  g.fillStyle = `rgba(${crgb},.16)`; redondeado(g, bx + 16, by + 38, sw, 19, 7); g.fill();
  g.strokeStyle = `rgba(${crgb},.55)`; g.lineWidth = 1; redondeado(g, bx + 16, by + 38, sw, 19, 7); g.stroke();
  g.fillStyle = st.c; g.fillText(st.t, bx + 25, by + 51);
  // lectura en claro
  g.fillStyle = '#aab3bf'; g.font = '600 11px system-ui,sans-serif';
  let ly = by + 74; lins.forEach((l) => { g.fillText(l, bx + 16, ly); ly += 14; });
  // divisoria (dy ya calculado arriba para dimensionar la caja)
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx + 16, dy); g.lineTo(bx + bw - 16, dy); g.stroke();
  // niveles
  const row = (lab, val, c, yy) => {
    g.fillStyle = '#7d8794'; g.font = '700 10px system-ui,sans-serif'; g.textAlign = 'left'; g.fillText(lab, bx + 16, yy);
    g.fillStyle = c; g.font = '800 12px ui-monospace,monospace'; g.textAlign = 'right'; g.fillText(fmt(val), bx + bw - 16, yy); g.textAlign = 'left';
  };
  row('Entry', S.entry, '#eef2f6', dy + 20);
  row('Stop', S.sl, '#ff6b78', dy + 39);
  row('Target', S.tp, '#38d46a', dy + 58);
  g.fillStyle = '#7d8794'; g.font = '700 10px system-ui,sans-serif'; g.fillText('Risk : Reward', bx + 16, dy + 79);
  g.fillStyle = '#E8B84B'; g.font = '900 12px system-ui,sans-serif'; g.textAlign = 'right'; g.fillText('1 : 1.5', bx + bw - 16, dy + 79); g.textAlign = 'left';
  g.restore();
}
/* SEÑAL FOOTPRINT en el precio: zonas R:R rellenas (ganancia/riesgo) proyectadas al
   frente, EN/SL/TP con etiqueta, triángulo en la vela gatillo, y la ficha. */
function dibujarFootprint(g, x1, Y, pMin, pMax, Xbar, pulso, now) {
  const S = M.sig, geo = M._geo; if (!geo) return;
  if (!S) { dibujarFicha(g, null, M.precio); return; }
  const rgbHi = S.largo ? '150,255,195' : '255,150,165';
  const paso = geo.paso || 8;
  const xc = Xbar(S.bar), xa = Math.max(0, xc - paso * 0.6), xR = x1;
  const yE = Y(S.entry), yS = Y(S.sl), yT = Y(S.tp);
  // zonas de ganancia (verde) y de riesgo (roja) proyectadas desde el precio
  const xBox = Math.min(xR - 2, Xbar(M.velas.length - 1) + paso * 0.5);
  if (xR > xBox) {
    g.fillStyle = 'rgba(46,232,106,.13)'; g.fillRect(xBox, Math.min(yE, yT), xR - xBox, Math.abs(yT - yE));
    g.fillStyle = 'rgba(255,74,90,.14)'; g.fillRect(xBox, Math.min(yE, yS), xR - xBox, Math.abs(yS - yE));
    const sweep = (now % 2600) / 2600, grd = g.createLinearGradient(xBox, 0, xR, 0);
    for (let k = 0; k <= 10; k++) { const p = k / 10, b = 0.5 + 0.5 * Math.cos((p - sweep) * Math.PI * 4); grd.addColorStop(p, `rgba(${rgbHi},${(0.015 + 0.05 * b).toFixed(3)})`); }
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grd; g.fillRect(xBox, Math.min(yE, yT), xR - xBox, Math.abs(yT - yE)); g.restore();
  }
  // triángulo en la vela gatillo
  { const v = M.velas[S.bar];
    if (v) { const yy = S.largo ? Y(v.l) + 12 : Y(v.h) - 12, s = 6, rgb = S.largo ? '46,232,106' : '255,74,90';
      g.save(); g.fillStyle = `rgb(${rgb})`; g.beginPath();
      if (S.largo) { g.moveTo(xc, yy - s); g.lineTo(xc - s, yy + s); g.lineTo(xc + s, yy + s); }
      else { g.moveTo(xc, yy + s); g.lineTo(xc - s, yy - s); g.lineTo(xc + s, yy - s); }
      g.closePath(); g.fill(); g.restore(); } }
  // niveles entrada / stop / objetivo
  const linea = (lab, p, c, dash, lw) => {
    if (p > pMax || p < pMin) return; const y = Y(p);
    g.save(); if (dash) g.setLineDash(dash); g.strokeStyle = c; g.lineWidth = lw || 1.5; g.globalAlpha = 0.95;
    g.beginPath(); g.moveTo(xa, y); g.lineTo(xR, y); g.stroke(); g.restore(); g.setLineDash([]);
    g.font = '800 9px ui-monospace,monospace'; const t = lab + ' ' + fmt(p), tw = g.measureText(t).width, bw = Math.max(54, tw + 12);
    g.fillStyle = c; redondeado(g, xR - bw - 2, y - 8, bw, 16, 4); g.fill();
    g.fillStyle = '#06110a'; g.textAlign = 'left'; g.fillText(t, xR - bw + 4, y + 3.3);
  };
  linea('TP', S.tp, '#2ee86a', [5, 4], 1.4);
  linea('EN', S.entry, `rgb(${rgbHi})`, null, 2);
  linea('SL', S.sl, '#ff5162', [5, 4], 1.4);
  g.textAlign = 'left';
  dibujarFicha(g, S, M.precio);
}

/* EMA 50 sobre el precio, con el mismo efecto iluminado del VWAP de VWAP Pro:
   línea morada con glow + un cometa que la recorre a ~11 fps. */
function dibujarEMA(g, Y, paso, now) {
  const geo = M._geo; if (!geo || !M.ema.length) return;
  const pri = geo.pri, vis = geo.vis, pts = [];
  for (let i = 0; i < vis.length; i++) { const e = M.ema[pri + i]; if (e == null) continue; pts.push([i * paso + paso / 2, Y(e)]); }
  if (pts.length < 2) return;
  g.save();
  g.strokeStyle = 'rgba(198,120,221,.92)'; g.lineWidth = 2; g.shadowColor = 'rgba(198,120,221,.85)'; g.shadowBlur = 12;
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  g.globalCompositeOperation = 'lighter'; g.shadowBlur = 16;
  const L = pts.length, head = (now / 22) % L, span = Math.max(6, L * 0.16);
  for (let i = 1; i < L; i++) { let dd = i - head; if (dd < 0) dd += L; const a = dd < span ? 1 - dd / span : 0; if (a <= 0.03) continue;
    g.strokeStyle = `rgba(242,214,255,${(a * 0.9).toFixed(3)})`; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke(); }
  g.restore();
  const last = pts[pts.length - 1];
  g.fillStyle = 'rgba(198,120,221,.95)'; g.font = '800 9px ui-monospace,monospace'; g.textAlign = 'right';
  g.fillText('EMA 50', Math.max(66, last[0]), last[1] - 6); g.textAlign = 'left';
}
/* Operaciones GANADAS: quedan dibujadas como registro, una zona verde tenue de la
   entrada al objetivo con un check en la vela gatillo. Se mapean por tiempo. */
function dibujarGanadoras(g, Y, paso) {
  const geo = M._geo; if (!geo || !M.cerradas.length) return;
  const vis = geo.vis;
  for (const c of M.cerradas) {
    const idx = vis.findIndex((v) => v.t === c.t); if (idx < 0) continue;
    const x = idx * paso + paso / 2, yE = Y(c.entry), yT = Y(c.tp), w = Math.max(10, paso * 1.5);
    g.save();
    g.fillStyle = 'rgba(46,232,106,.07)'; g.fillRect(x, Math.min(yE, yT), w, Math.abs(yT - yE));
    g.strokeStyle = 'rgba(46,232,106,.5)'; g.setLineDash([3, 3]); g.lineWidth = 1; g.beginPath(); g.moveTo(x, yT); g.lineTo(x + w, yT); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#2ee86a'; g.font = '800 10px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('✓', x, c.largo ? yE + 12 : yE - 5);
    g.restore();
  }
  g.textAlign = 'left';
}
/* PANEL RSI(2): oscilador 0-100 con la banda baja 9 (verde), la banda alta 99 (roja)
   y la guía 50. La línea del RSI va en amarillo brillante. Es el gatillo de la estrategia. */
function dibujarPanelRSI(g, x1, yTop, yBot, paso) {
  const geo = M._geo, H = yBot - yTop; if (!geo || H < 36) return;
  const vis = geo.vis, pri = geo.pri;
  g.fillStyle = 'rgba(255,255,255,.02)'; g.fillRect(0, yTop, x1, H);
  g.strokeStyle = 'rgba(232,184,75,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, yTop + 0.5); g.lineTo(x1, yTop + 0.5); g.stroke();
  const h0 = yTop + 20, h1 = yBot - 8;
  const yR = (v) => h1 - (h1 - h0) * (Math.max(0, Math.min(100, v)) / 100);
  g.save(); g.strokeStyle = 'rgba(255,255,255,.08)'; g.setLineDash([3, 3]); const y50 = yR(50); g.beginPath(); g.moveTo(0, y50); g.lineTo(x1, y50); g.stroke(); g.restore();
  const banda = (v, col) => { const y = yR(v); g.save(); g.strokeStyle = col; g.lineWidth = 1.2; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); g.restore();
    g.fillStyle = col; g.font = '800 9px ui-monospace,monospace'; g.textAlign = 'right'; g.fillText(String(v), x1 - 4, y - 2); g.textAlign = 'left'; };
  banda(RSI_HI, '#ff5162');   // 99 roja
  banda(RSI_LO, '#26d46a');   // 9 verde
  const pts = [];
  for (let i = 0; i < vis.length; i++) { const r = M.rsi[pri + i]; if (r == null) continue; pts.push([i * paso + paso / 2, yR(r)]); }
  if (pts.length > 1) {
    g.save(); g.strokeStyle = '#ffe11a'; g.lineWidth = 2; g.shadowColor = 'rgba(255,225,26,.55)'; g.shadowBlur = 6;
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.restore();
    const last = pts[pts.length - 1]; g.fillStyle = '#ffe11a'; g.beginPath(); g.arc(last[0], last[1], 3, 0, 6.283); g.fill();
  }
  g.textAlign = 'left'; g.fillStyle = '#ffe11a'; g.font = '900 10px system-ui,sans-serif'; g.fillText('RSI 2', 10, yTop + 14);
  const rNow = M.rsi.length ? M.rsi[M.rsi.length - 2] : null;
  if (rNow != null) { g.fillStyle = '#8b95a1'; g.font = '800 10px ui-monospace,monospace'; g.fillText(rNow.toFixed(0), 52, yTop + 14); }
}

function redondeado(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ══════════════════ OPERACIÓN DE LA SEÑAL (para el export) ══════════════════ */
function _hex2rgb(hex) { const n = parseInt((hex || '#2ee86a').slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; }

/* La operación de la señal, para el export (Share). Una sola entrada con su stop y
   su objetivo a 1:2. */
function posicionesDeNiveles() {
  const S = M.sig; if (!S) return [];
  const tipo = S.largo ? 'largo' : 'corto';
  return [{ tipo, pe: S.entry, pStop: S.sl, pTarget: S.tp, rr: 1.5 }];
}

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
      cv.style.cursor = enEscala(x) ? 'ns-resize' : (enEjeX(x, y) ? 'ew-resize' : 'crosshair');   // precios: estira vertical; fechas: estira horizontal
      if (M._geo) dibujar(); return;
    }
    if (dragEsc) {   // arrastre sobre el eje de precios → estira/contrae la escala vertical (como TradingView)
      const dy = y - ay;
      if (Math.abs(dy) > 1) { M.zoomY = Math.max(0.2, Math.min(6, (M.zoomY || 1) * (1 + dy * 0.004))); ay = y; dibujar(); }
      return;
    }
    if (dragX) {   // arrastre sobre el eje de FECHAS → estira/contrae el tiempo (↔, como TradingView)
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
  m.querySelectorAll('.ss-cm-it').forEach((b) => b.onclick = () => { const id = b.dataset.id; m.remove(); if (id !== _par) { _par = id; const p = PARES.find((x) => x.id === id) || {}; const lg = $('ss-logo'); if (lg) { lg.dataset.cg = p.cg || ''; lg.dataset.ico = p.ico || ''; } $('ss-par').textContent = id; $('ss-nm').textContent = p.n || ''; ponerLogos(); M._posAuto = null; cargarVelas(); } });
  const q = m.querySelector('#ss-cm-q'); q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); m.querySelectorAll('.ss-cm-it').forEach((b) => b.style.display = (!v || b.dataset.b.includes(v)) ? '' : 'none'); });
  setTimeout(() => q.focus(), 30);
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function menuTf() {
  if ($('ss-tfmenu')) { $('ss-tfmenu').remove(); return; }
  const ancla = $('ss-tfchip'); const m = document.createElement('div'); m.id = 'ss-tfmenu'; m.className = 'ss-pop ss-tfpop';
  m.innerHTML = TFS.map((t) => `<button class="ss-tf-it ${t.id === M.tf ? 'on' : ''}" data-tf="${t.id}">${esc(t.n)}</button>`).join('');
  document.body.appendChild(m);
  const r = ancla.getBoundingClientRect(); const w = m.offsetWidth || 210;
  m.style.top = (r.bottom + 6) + 'px'; m.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
  m.querySelectorAll('.ss-tf-it').forEach((b) => b.onclick = () => { M.tf = b.dataset.tf; $('ss-tfchip-t').textContent = (TFS.find((t) => t.id === M.tf) || {}).n || M.tf; m.remove(); M._posAuto = null; cargarVelas(); });
  const fuera = (ev) => { if (!m.contains(ev.target) && !ancla.contains(ev.target)) { m.remove(); document.removeEventListener('mousedown', fuera); } };
  setTimeout(() => document.addEventListener('mousedown', fuera), 10);
}
function ponerLogos(root) {
  (root || document).querySelectorAll('.ss-logo, .ss-mini').forEach((el) => {
    const cg = el.dataset.cg, ico = el.dataset.ico;
    el.style.backgroundImage = '';
    if (ico) { pintarIcono(el); return; }   // divisas (EUR €, GBP £) → moneda SVG
    if (cg && window.__aurexLogos && window.__aurexLogos[cg]) { el.style.backgroundImage = `url(${window.__aurexLogos[cg]})`; el.classList.add('con'); el.textContent = ''; return; }
    el.textContent = (el.closest('[data-id]')?.dataset.id || _par || '?')[0];
  });
  cargarLogosCache(root);
}
let _logosFetch = null;
/* Garantiza que window.__aurexLogos esté cargado (caché local o CoinGecko) y
   DEVUELVE una promesa esperable. Lo usan tanto los logos de la interfaz como
   el export de señal: así, igual que Heat Pools espera a ponerLogos() antes de
   dibujar, aquí se espera a tener el logo antes de pintarlo en la imagen. */
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
      g.textAlign = 'left'; g.fillStyle = '#E8B84B'; g.font = `800 ${19 * e2}px system-ui,sans-serif`; g.fillText('Super Scalper', x, yB + 34 * e2);
      g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillStyle = '#C9A84B'; g.fillText(WEB, x, yB + 56 * e2);
      g.textAlign = 'right'; g.fillStyle = '#8b96a3'; g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillText(`${_par} · ${M.tf}`, out.width - 20 * e2, yB + 34 * e2);
      g.font = `${11 * e2}px ui-monospace,monospace`; g.fillStyle = '#6b7681'; g.fillText(new Date().toLocaleString('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), out.width - 20 * e2, yB + 56 * e2);
      g.textAlign = 'left';
    };
    const bajar = () => out.toBlob((blob) => { devolver(); if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `decfreedom-superscalper-${_par}-${Date.now()}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }, 'image/png');
    const logo = new Image(); let hecho = false;
    const una = (w) => { if (hecho) return; hecho = true; textos(w ? 20 * e2 + w + 18 * e2 : 20 * e2); bajar(); };
    logo.onload = () => { try { const alto = 52 * e2, ancho = Math.round(logo.width * (alto / logo.height)); g.drawImage(logo, 20 * e2, yB + (barra - alto) / 2, ancho, alto); una(ancho); } catch (_) { una(0); } };
    logo.onerror = () => una(0); setTimeout(() => una(0), 1500); logo.src = LOGO;
  } catch (_) { devolver(); }
}

/* ══════════════════ SHARE SIGNAL (misma dinámica que Heat Pools, adaptada) ══════════
   Copia un texto y genera una IMAGEN: gráfico + columnas ENTRY/STOP/TARGET de las
   posiciones (single/double), R:R 1:2, logo de la moneda, sección, fecha, precio y
   temporalidad. Usa la señal vigente. */
function compartirSenal() {
  const pos = M._posAuto || posicionesDeNiveles();
  const sh = $('ss-share');
  const flash = (m) => { if (sh) { const t = sh.dataset.base || sh.textContent; sh.dataset.base = t; sh.textContent = m; setTimeout(() => { sh.textContent = t; }, 1500); } };
  if (!pos.length) { flash('No signals'); return; }
  const par = PARES.find((p) => p.id === _par) || { id: _par };
  const dec = (v) => { const a = Math.abs(v); return a >= 1000 ? v.toFixed(1) : a >= 1 ? v.toFixed(3) : v.toFixed(5); };
  const hora = new Date().toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
  const precio = M.precio ? dec(M.precio) : '·';
  const ents = pos.map((p) => dec(p.pe)), sls = pos.map((p) => dec(p.pStop)), tps = pos.map((p) => dec(p.pTarget));
  const n = ents.length;
  const lista = (arr) => arr.map((v, i) => `${i + 1}: ${v}`).join('\n');
  const tipoTxt = M.sig ? `${etiquetaSig(M.sig)} · ${M.sig.largo ? 'LONG' : 'SHORT'}\n` : '';
  const txt = `SUPER SCALPER SIGNAL\n${tipoTxt}\n${par.id} · ${M.tf} · ${hora} UTC · Price ${precio}\n\nENTRY\n${lista(ents)}\n\nSTOP LOSS\n${lista(sls)}\n\nTAKE PROFIT\n${lista(tps)}\n\nRISK : REWARD   1:1.5\n\n${WEB} · Super Scalper`;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => flash('Copied ✓')).catch(() => {});

  const chart = $('ss-cv');
  const W = 1180, BG = '#0a0d12';
  const chartH = chart && chart.width ? Math.round(W * (chart.height / chart.width)) : 0;
  const padX = 54, headH = 156, rowH = 56, rrH = 92, footH = 84;
  const H = chartH + headH + n * rowH + rrH + footH;
  const cv = document.createElement('canvas'), g = cv.getContext('2d'); cv.width = W; cv.height = H;
  const cargar = (src, cors) => new Promise((res) => { if (!src) return res(null); const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const prep = (async () => {
    const sym = par.id.toLowerCase();
    let coin = await cargar(`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${sym}.png`, true);
    if (!coin && par.cg) {                                   // spothq no tiene monedas nuevas (p.ej. JUP) → respaldo CoinGecko
      if (!(window.__aurexLogos && window.__aurexLogos[par.cg])) { try { await asegurarLogos(); } catch (_) {} }
      if (window.__aurexLogos && window.__aurexLogos[par.cg]) coin = await cargar(window.__aurexLogos[par.cg], true);
    }
    const marca = await cargar(LOGO, false);
    return [coin, marca];
  })();
  prep.then(([coin, marca]) => {
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    if (chart && chart.width) g.drawImage(chart, 0, 0, W, chartH);
    const y0 = chartH;
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y0 + 0.5); g.lineTo(W, y0 + 0.5); g.stroke();
    const ls = 72, lx = padX, ly = y0 + 30;
    g.save(); g.beginPath(); g.arc(lx + ls / 2, ly + ls / 2, ls / 2, 0, 6.2832); g.closePath();
    g.fillStyle = coin ? '#ffffff' : '#141b25'; g.fill();
    if (coin) { g.clip(); g.drawImage(coin, lx, ly, ls, ls); }
    else { g.fillStyle = '#E8B84B'; g.font = '800 24px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(par.id.slice(0, 4), lx + ls / 2, ly + ls / 2 + 1); }
    g.restore();
    if (coin) { g.strokeStyle = 'rgba(232,184,75,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(lx + ls / 2, ly + ls / 2, ls / 2, 0, 6.2832); g.stroke(); }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const tx = lx + ls + 24;
    g.fillStyle = '#E8B84B'; g.font = '800 40px system-ui,sans-serif'; g.fillText('Super', tx, y0 + 56);
    const hw = g.measureText('Super').width;
    g.fillStyle = '#e8ecf2'; g.font = '800 40px system-ui,sans-serif'; g.fillText(' Scalper', tx + hw, y0 + 56);
    g.fillStyle = '#8b95a1'; g.font = '600 18px ui-monospace,monospace';
    g.fillText(`${par.id}    ·    ${M.tf}    ·    ${hora} UTC    ·    Price ${precio}`, tx, y0 + 88);
    const colBlock = 250;
    const xs = [padX, Math.round(W / 2 - colBlock / 2), W - padX - colBlock];
    const cols = [['ENTRY', ents, '#e8ecf2'], ['STOP LOSS', sls, '#ff5b6e'], ['TARGET', tps, '#2ee86a']];
    const colY = y0 + headH;
    cols.forEach((c, ci) => {
      const cx = xs[ci]; g.textAlign = 'left';
      g.fillStyle = c[2]; g.font = '800 20px system-ui,sans-serif'; g.fillText(c[0], cx, colY);
      g.strokeStyle = c[2]; g.globalAlpha = .3; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, colY + 13); g.lineTo(cx + colBlock, colY + 13); g.stroke(); g.globalAlpha = 1;
      c[1].forEach((v, i) => {
        const ry = colY + 46 + i * rowH;
        g.fillStyle = '#5a6570'; g.font = '700 17px ui-monospace,monospace'; g.fillText(String(i + 1), cx, ry);
        g.fillStyle = '#eef2f6'; g.font = '800 27px ui-monospace,monospace'; g.fillText(v, cx + 32, ry + 2);
      });
    });
    const rry = colY + 46 + n * rowH + 40;
    g.textAlign = 'center';
    g.fillStyle = '#8b95a1'; g.font = '700 18px system-ui,sans-serif'; g.fillText('RISK : REWARD', W / 2 - 60, rry);
    g.fillStyle = '#E8B84B'; g.font = '800 26px system-ui,sans-serif'; g.fillText('1 : 1.5', W / 2 + 90, rry + 1);
    const fy = H - footH;
    g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(0, fy, W, footH);
    g.strokeStyle = 'rgba(232,184,75,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, fy + 0.5); g.lineTo(W, fy + 0.5); g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'middle';
    let dx = padX;
    if (marca) { const mh = 46, mw = marca.width * (mh / marca.height); g.drawImage(marca, padX, fy + (footH - mh) / 2, mw, mh); dx = padX + mw + 18; }
    g.fillStyle = '#dfe5ec'; g.font = '700 19px system-ui,sans-serif'; g.fillText(WEB, dx, fy + footH / 2 + 1);
    g.fillStyle = '#E8B84B'; g.font = '800 19px system-ui,sans-serif'; g.textAlign = 'right'; g.fillText('Super Scalper', W - padX, fy + footH / 2 + 1);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    try { cv.toBlob((b) => { if (!b) return; const url = URL.createObjectURL(b), a = document.createElement('a'); a.href = url; a.download = `decfreedom-superscalper-${par.id}-${M.tf}-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); }, 'image/png'); } catch (e) { flash('Copied ✓'); }
  });
}

/* ══════════════════ AYUDA (stepper experto, igual que Heat Pools) ══════════════════ */
const PASOS_RZ = [
  {
    t: 'What Super Scalper is',
    d: 'Super Scalper is a <b>mechanical scalping strategy</b> drawn live on a <b>1 second</b> chart. It is not an opinion and there is no analyst: it is a fixed rule set built from two tools, an <b>EMA 50</b> that defines the trend and an <b>RSI 2</b> that times the entry. You watch the 1 second candles form and act only when both rules line up. Built for surgical entries at the open or close of the candle.',
    x: 'The 1 second chart is a cockpit for timing. You read it to click at the exact instant, not to stare at it.'
  },
  {
    t: 'The EMA 50 is the trend filter',
    d: 'The <b>glowing purple line</b> on the price is the <b>EMA 50</b> (a 50 period exponential moving average). It is the only thing that decides the side you are allowed to take. When price is <b>above</b> the EMA the trend is up, so you <b>only look for longs</b>. When price is <b>below</b> the EMA the trend is down, so you <b>only look for shorts</b>. You never trade against this line.',
    x: 'Above the line you ignore every short signal. Below the line you ignore every long signal. No exceptions.'
  },
  {
    t: 'The RSI 2 is the trigger',
    d: 'The panel under the price is the <b>RSI with length 2</b>. Length 2 is the whole point: it is so fast it swings all the way to the <b>extremes</b>, which is what gives you the entry. The <b>green band at 9</b> is the lower band and the <b>red band at 99</b> is the upper band. The <b>bright yellow line</b> is the RSI itself. The trade is armed only when that yellow line <b>tags</b> a band, a real touch, not almost.',
    x: 'A normal RSI sits at length 14 and barely reaches 30 or 70. At length 2 it slams into 9 and 99, and that is the signal.'
  },
  {
    t: 'The long setup',
    d: 'Two things must be true at the same time: price is <b>above the EMA 50</b> (uptrend) and the yellow RSI line <b>tags the green 9 band</b>. That is a pullback inside an uptrend, the pocket where you buy. The tool fires a <b>LONG</b>: it draws the entry, puts the <b>stop below the EMA</b> (below the line, never on it) and the <b>target at 1:1.5</b> above the entry.',
    x: 'If price is above the EMA and the RSI tags the top 99 band instead, you do nothing. That is a short signal and you never short an uptrend.'
  },
  {
    t: 'The short setup',
    d: 'The mirror: price is <b>below the EMA 50</b> (downtrend) and the yellow RSI line <b>tags the red 99 band</b>. That is a pullback inside a downtrend, where you sell. The tool fires a <b>SHORT</b>: entry drawn, <b>stop above the EMA</b> (above the line, not touching it) and <b>target at 1:1.5</b> below the entry. Below the EMA you only ever take shorts, so a tag of the green 9 band down there is ignored.',
    x: 'The stop living on the far side of the EMA is deliberate: if the trend flips through the line, the idea is already wrong.'
  },
  {
    t: 'The position and the record',
    d: 'When a setup fires, the <b>position tool</b> appears next to the pin with the three levels and a <b>status</b>: <b>ENTRY VALID NOW</b> means take it, <b>ALREADY RUNNING</b> means price left without you, and <b>TARGET HIT</b> or <b>INVALIDATED</b> once it is over. A trade that reaches its target <b>stays drawn</b> as a green record, so you can see the setups that worked. With no setup the ticket shows <b>SCANNING</b> and which side the EMA allows.',
    x: 'You never guess the timing. The status answers whether the entry is still takeable right now.'
  },
  {
    t: 'Manage your own risk',
    d: 'The target here is drawn at <b>1:1.5</b> (risk 10 to make 15), a balanced default. You are free to close earlier at <b>1:1</b> if you want it safer, or let it run to <b>1:2</b> if you are managing for bigger moves. That choice is yours and depends on how you manage your capital. Risk a <b>small fixed percentage</b> per trade and only take the side the EMA allows.',
    x: 'This is a strategy and support only, not financial advice, and it guarantees no result. You decide every trade and you carry the risk.'
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
      <div class="ss-ab-eyebrow">Super Scalper</div>
      <div id="ss-ab-cuerpo"></div>
      <div class="ss-ab-legal"><button class="ss-disc-link" id="ss-disc-link" type="button">Disclaimer</button></div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  d.querySelector('.ss-ab-bg').onclick = q; d.querySelector('.ss-ab-x').onclick = q;
  $('ss-disc-link').onclick = () => discScalper(true);
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
/* z-index a la PAR de las pools (9740): el menú de clic derecho de orden.js vive
   en 9860, así que con 10030 el menú salía DETRÁS de la gráfica y parecía que el
   clic derecho "no hacía nada". A 9740 el menú/ficha/alerta se ven por encima,
   igual que en Liquidity/Heat/Smart. Los popups propios (ss-pop 10050, ayuda
   10300) siguen por encima porque son fixed con su propio z-index. */
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
.ss-share{height:36px;border-radius:9px;border:1px solid rgba(46,232,106,.55);background:rgba(46,232,106,.08);color:#39e07a;font:700 12px system-ui,sans-serif;padding:0 14px;cursor:pointer;white-space:nowrap;transition:filter .15s,opacity .15s}
.ss-share:hover{filter:brightness(1.15)}
.ss-share:disabled{opacity:.4;cursor:not-allowed;filter:none}
.ss-ico{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid #2a333f;color:#9aa4af;font-weight:800}
.ss-ico:hover{border-color:var(--gold);color:var(--gold)}
.ss-graf{flex:1 1 auto;min-height:0;position:relative;background:#0a0e14}
.ss-cv{display:block;position:absolute;inset:0}
.ss-marca{position:absolute;left:64px;bottom:40px;height:42px;width:auto;opacity:.8;pointer-events:none;filter:drop-shadow(0 2px 9px rgba(0,0,0,.95))}
.ss-esperando{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:30px;background:rgba(10,14,20,.6);z-index:2}
.ss-esperando b{font-family:var(--mono);font-size:14px;color:#cbd3dc}
.ss-esperando span{font-size:12px;color:#7d8794;max-width:280px}
.ss-spin{width:30px;height:30px;border:2.5px solid rgba(232,184,75,.2);border-top-color:var(--gold);border-radius:50%;animation:ss-sp .8s linear infinite}
@keyframes ss-sp{to{transform:rotate(360deg)}}
.ss-pop{position:fixed;z-index:10050;background:#0c1016;border:1px solid #2a333f;border-radius:12px;box-shadow:0 20px 55px rgba(0,0,0,.65);font-family:var(--mono);color:#e7ebf0}
.ss-picker,.ss-pop.ss-tfpop{}
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
/* ── Ayuda: stepper experto (igual que Heat Pools) ── */
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
