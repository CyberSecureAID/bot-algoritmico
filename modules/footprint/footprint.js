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

import { PARES, TFS, velas, ticker, tickSize, aggTradesHist, streamTrades, logos, tfMs } from './datos-trades.js';
import { crearRender } from './render.js';
import { leerFootprint } from './analista.js';
import { estilosFootprint } from './estilos.js';

const LOGO = new URL('../../assets/img/cco-marca.png', import.meta.url).href;
const LOGO_ALT = new URL('../../assets/img/cco-full.webp', import.meta.url).href;
const AVATAR = new URL('../../assets/img/jesus-avatar.webp', import.meta.url).href;

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const S = {
  par: PARES[0], tf: '1m', trades: [], velas: [], agg: null, meta: {},
  render: null, worker: null, stream: null, logos: {}, tick: 0, binSize: 0, imb: 300,
  reqId: 0, rebuildT: null, velasT: null, an: null, alertadas: new Set(), modo: 'bidask'
};
const MAX_TRADES = 30000;

export async function abrirFootprint() {
  estilosFootprint();
  const prev = $('fp-overlay'); if (prev) prev.remove();
  const ov = document.createElement('div');
  ov.id = 'fp-overlay';
  ov.innerHTML = plantilla();
  document.body.appendChild(ov);

  S.render = crearRender($('fp-cv'), { onHover: tooltip });
  window.addEventListener('resize', onResize);
  S.an = { lang: idiomaIni(), abierto: false, clave: '', msg: null, det: false };

  wire(ov);
  arrancarWorker();
  logos().then((m) => { S.logos = m || {}; pintarCoin(); }).catch(() => {});
  requestAnimationFrame(() => { try { S.render.resize(); } catch (_) {} });
  cargar();
}

function plantilla() {
  return `
  <div class="fp-bg"></div>
  <div class="fp-wrap">
    <div class="fp-top">
      <button class="fp-back" id="fp-back" aria-label="Back">‹ Back</button>
      <div class="fp-sep"></div>
      <button class="fp-coin" id="fp-coin"><i class="fp-coin-lg" id="fp-coin-lg"></i><b id="fp-coin-id">BTC</b><span id="fp-coin-nm">Bitcoin</span><em class="fp-chev">▾</em></button>
      <button class="fp-chip" id="fp-tf">1m <em class="fp-chev">▾</em></button>
      <div class="fp-pxbox"><b class="fp-px" id="fp-px">—</b><span class="fp-chg" id="fp-chg">—</span></div>
      <div class="fp-modes" id="fp-modes">
        <button data-mode="bidask" class="on" title="Buy x Sell per cell">Bid×Ask</button>
        <button data-mode="delta" title="Delta only">Delta</button>
        <button data-mode="profile" title="Volume profile">Profile</button>
      </div>
      <div class="fp-top-r">
        <button class="fp-ico" id="fp-reset" title="Reset zoom">⟲</button>
        <button class="fp-ico" id="fp-settings" title="Bin size and imbalance">⚙</button>
        <button class="fp-ico" id="fp-export" title="Export image">⤓</button>
      </div>
    </div>

    <div class="fp-stage">
      <div class="fp-cvwrap">
        <div class="fp-cv" id="fp-cv">${loader()}</div>

        <div class="fp-an-wrap" id="fp-an-wrap">
          <button class="fp-an-btn vivo" id="fp-an-btn" type="button" title="Jesús · live footprint read">
            <img class="fp-an-ava" src="${AVATAR}" alt="Jesús" onerror="this.style.display='none'">
            <span class="fp-an-tag" id="fp-an-tag">FLOW</span><em>▾</em>
          </button>
          <div class="fp-an-panel" id="fp-an-panel"></div>
        </div>

        <div class="fp-alerts" id="fp-alerts"></div>
        <div class="fp-tip" id="fp-tip" style="display:none"></div>
        <div class="fp-src" id="fp-src">Data: Binance spot (US region). Volume shown is a portion of the total market.</div>
      </div>
    </div>

    <div class="fp-foot">
      <span><b>Footprint Pro</b> · institutional order flow</span>
      <span>Live order flow · not financial advice</span>
    </div>
  </div>

  <div class="fp-pop" id="fp-settings-pop" style="display:none">
    <div class="fp-pop-row"><label>Bin size</label><input id="fp-bin" type="text" inputmode="decimal" placeholder="auto"></div>
    <div class="fp-pop-row"><label>Imbalance %</label><input id="fp-imb" type="text" inputmode="numeric" value="300"></div>
    <button class="fp-pop-apply" id="fp-apply">Apply</button>
    <div class="fp-pop-note">Bin empty = automatic. Imbalance = diagonal buy vs sell ratio to flag a cell.</div>
  </div>`;
}

function loader() { return '<div class="fp-empty"><div class="fp-spin"></div><span>Loading order flow…</span></div>'; }

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
  montarAnalista();
}

// ── Datos ────────────────────────────────────────────────────────────
async function cargar() {
  if (S.stream) { try { S.stream.cerrar(); } catch (_) {} S.stream = null; }
  if (S.velasT) { clearInterval(S.velasT); S.velasT = null; }
  S.trades = []; S.alertadas = new Set(); S.agg = null;
  const cvHost = $('fp-cv'); if (cvHost && !cvHost.querySelector('canvas')) cvHost.innerHTML = loader();

  const sym = S.par.s;
  let tk = 0, tkr = null, vls = [], hist = [];
  try {
    [vls, tk, tkr, hist] = await Promise.all([
      velas(sym, S.tf, 80).catch(() => []),
      tickSize(sym).catch(() => 0),
      ticker(sym).catch(() => null),
      aggTradesHist(sym, 6).catch(() => [])
    ]);
  } catch (_) {}
  S.velas = vls; S.tick = tk; S.trades = hist.slice(-MAX_TRADES);
  S.meta = { par: S.par.id, tf: S.tf, last: tkr ? tkr.last : (vls.length ? vls[vls.length - 1].c : 0), binSize: S.binSize };
  if (tkr) pintarPrecio(tkr);
  // recrea el canvas limpio
  const host = $('fp-cv'); if (host) { host.innerHTML = ''; S.render = crearRender(host, { onHover: tooltip }); S.render.setMode(S.modo); requestAnimationFrame(() => S.render.resize()); }

  rebuild(true);
  S.stream = streamTrades(sym, onTrade);
  S.velasT = setInterval(refrescarVelas, 20000);
}

async function refrescarVelas() {
  try { const v = await velas(S.par.s, S.tf, 80); if (v && v.length) { S.velas = v; rebuild(false); } } catch (_) {}
}

function onTrade(tr) {
  S.trades.push(tr);
  if (S.trades.length > MAX_TRADES) S.trades.splice(0, S.trades.length - MAX_TRADES);
  S.meta.last = tr.p;
  if (S.render) S.render.setMeta({ last: tr.p });
  if (!S.rebuildT) S.rebuildT = setTimeout(() => { S.rebuildT = null; rebuild(false); }, 500);
}

function arrancarWorker() {
  try {
    S.worker = new Worker(new URL('./motor.worker.js', import.meta.url));
    S.worker.onmessage = (ev) => {
      const r = ev.data || {};
      if (!r.ok) return;
      if (r.reqId !== S.reqId) return;      // descarta resultados viejos
      S.agg = r;
      S.meta.binSize = r.binSize;
      if (S.render) S.render.setData(r, S.meta);
      actualizarAnalista();
      revisarAlertas(r);
    };
    S.worker.onerror = () => {};
  } catch (_) { S.worker = null; }
}

function rebuild(force) {
  if (!S.worker) return;
  S.reqId++;
  S.worker.postMessage({ type: 'build', reqId: S.reqId, trades: S.trades, velas: S.velas, tfMs: tfMs(S.tf), binSize: S.binSize, imbThreshold: S.imb, tick: S.tick });
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
  if (lg) { const u = S.par.cg && S.logos[S.par.cg]; if (u) { lg.style.backgroundImage = `url(${u})`; lg.classList.add('con'); } else { lg.style.backgroundImage = ''; lg.classList.remove('con'); lg.textContent = (S.par.id || '?')[0]; } }
}

// ── Menús moneda / temporalidad ─────────────────────────────────────
function cerrarPops() { document.querySelectorAll('.fp-menu').forEach((m) => m.remove()); }
function posPop(m, ancla) { const r = ancla.getBoundingClientRect(); m.style.left = Math.max(8, Math.min(window.innerWidth - 270, r.left)) + 'px'; m.style.top = (r.bottom + 6) + 'px'; }

function menuCoin(ancla) {
  cerrarPops();
  const m = document.createElement('div'); m.className = 'fp-menu fp-coinmenu';
  const li = (p) => { const u = p.cg && S.logos[p.cg]; return `<button class="fp-mi ${p.id === S.par.id ? 'on' : ''}" data-id="${esc(p.id)}" data-b="${esc((p.id + ' ' + (p.n || '')).toLowerCase())}"><i class="fp-mi-lg ${u ? 'con' : ''}" style="${u ? `background-image:url(${u})` : ''}">${u ? '' : esc((p.id || '?')[0])}</i><b>${esc(p.id)}</b><span>${esc(p.n || '')}</span></button>`; };
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
  tip.innerHTML = `<div class="fp-tip-p">${Number(hit.price).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}</div>
    <div class="fp-tip-r"><span class="s">Sell</span><b>${fmt(hit.lv.sell)}</b></div>
    <div class="fp-tip-r"><span class="b">Buy</span><b>${fmt(hit.lv.buy)}</b></div>
    <div class="fp-tip-r"><span>Delta</span><b class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}</b></div>`;
  tip.style.display = 'block';
  const r = $('fp-overlay').getBoundingClientRect();
  tip.style.left = Math.min(cx - r.left + 14, r.width - 150) + 'px';
  tip.style.top = (cy - r.top + 14) + 'px';
}
function fmt(v) { const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v.toFixed(2); }

// ── Alertas (divergencia / absorción nuevas) ────────────────────────
function revisarAlertas(agg) {
  if (!agg.candles || !agg.candles.length) return;
  const ult = agg.candles[agg.candles.length - 1];
  (agg.divergences || []).filter((d) => d.t === ult.t).forEach((d) => {
    const k = 'div' + d.kind + d.t; if (S.alertadas.has(k)) return; S.alertadas.add(k);
    toast(d.kind === 'bull' ? 'up' : 'down', d.kind === 'bull' ? 'Bullish divergence' : 'Bearish divergence', `${S.par.id} · CVD vs price ${S.tf}`);
  });
  (agg.absorciones || []).filter((a) => a.t === ult.t).forEach((a) => {
    const k = 'abs' + a.side + a.t; if (S.alertadas.has(k)) return; S.alertadas.add(k);
    const comprador = a.side === 'sell';
    toast(comprador ? 'up' : 'down', comprador ? 'Buyer absorption' : 'Seller absorption', `${S.par.id} · ${a.price != null ? a.price : ''}`);
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
function idiomaIni() { try { return (navigator.language || 'en').slice(0, 2) === 'es' ? 'es' : 'en'; } catch (_) { return 'en'; } }
const anL = (o, l) => (o && (o[l] != null ? o[l] : o.en)) || '';

function montarAnalista() {
  const wrap = $('fp-an-wrap'), btn = $('fp-an-btn'); if (!wrap || !btn) return;
  btn.onclick = (e) => { e.stopPropagation(); btn.classList.remove('vivo'); S.an.abierto = !S.an.abierto; wrap.classList.toggle('abierto', S.an.abierto); if (S.an.abierto && S.an.msg) { renderPanel(); escribir(wrap.querySelector('[data-esc]')); } };
  document.addEventListener('click', (ev) => { const w = $('fp-an-wrap'); if (!w || !S.an || !S.an.abierto) return; if (!w.contains(ev.target)) { S.an.abierto = false; w.classList.remove('abierto'); } });
}
function actualizarAnalista() {
  if (!S.an || !S.agg) return;
  let m; try { m = leerFootprint(S.agg, S.meta); } catch (_) { m = null; }
  if (!m) return;
  const btn = $('fp-an-btn'), tag = $('fp-an-tag');
  if (btn) btn.className = 'fp-an-btn t-' + m.tipo + (S.an.abierto ? '' : ' vivo');
  if (tag) { tag.textContent = anL(TAG[m.tipo] || { en: 'FLOW', es: 'FLUJO' }, S.an.lang); tag.className = 'fp-an-tag c-' + m.tipo; }
  const cambio = m.clave !== S.an.clave; S.an.msg = m; S.an.clave = m.clave;
  if (S.an.abierto) {
    if (cambio) { renderPanel(); escribir($('fp-an-wrap').querySelector('[data-esc]')); }
    else { const tx = document.querySelector('.fp-an-tx'); if (tx && tx.dataset.hecho) tx.textContent = anL(m.txt, S.an.lang); const hz = document.querySelector('.fp-an-hacer'); if (hz) hz.textContent = anL(m.hacer, S.an.lang); }
  }
}
function renderPanel() {
  const panel = $('fp-an-panel'), wrap = $('fp-an-wrap'); if (!panel || !wrap || !S.an.msg) return;
  const m = S.an.msg, lang = S.an.lang, u = AN_UI[lang] || AN_UI.en;
  panel.className = 'fp-an-panel t-' + m.tipo;
  wrap.classList.toggle('con-detalle', !!S.an.det);
  panel.innerHTML = `
    <div class="fp-an-cab">
      <img class="fp-an-ava2" src="${AVATAR}" alt="Jesús" onerror="this.style.display='none'">
      <div class="fp-an-quien"><b>Jesús · ${esc(u.live)}</b><span>${esc(anL(m.titulo, lang))}</span></div>
      <button class="fp-an-lang" type="button">${lang === 'en' ? 'ES' : 'EN'}</button>
    </div>
    <div class="fp-an-tx" data-esc="${esc(anL(m.txt, lang))}"></div>
    <div class="fp-an-hacer">${esc(anL(m.hacer, lang))}</div>
    <div class="fp-an-acts"><button class="fp-an-mas" type="button">${esc(u.why)} ▾</button></div>
    <div class="fp-an-det">${(m.detalle || []).map((x) => `<div class="fp-an-li">${esc(anL(x, lang))}</div>`).join('')}</div>`;
  const lng = panel.querySelector('.fp-an-lang'); if (lng) lng.onclick = (e) => { e.stopPropagation(); S.an.lang = S.an.lang === 'es' ? 'en' : 'es'; renderPanel(); escribir(panel.querySelector('[data-esc]')); };
  const mas = panel.querySelector('.fp-an-mas'); if (mas) mas.onclick = (e) => { e.stopPropagation(); S.an.det = !S.an.det; wrap.classList.toggle('con-detalle', S.an.det); mas.textContent = S.an.det ? (u.hide + ' ▴') : (u.why + ' ▾'); };
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
    g.textAlign = 'left'; g.fillStyle = '#E8B84B'; g.font = `800 ${19 * e2}px system-ui,sans-serif`; g.fillText('Footprint Pro', x, yB + 34 * e2);
    g.font = `700 ${14 * e2}px ui-monospace,monospace`; g.fillStyle = '#C9A84B'; g.fillText('decfreedom.com', x, yB + 56 * e2);
    g.textAlign = 'right'; g.fillStyle = '#8b96a3'; g.font = `700 ${13 * e2}px ui-monospace,monospace`; g.fillText('Data: Binance spot (US) · partial volume', out.width - 20 * e2, yB + 34 * e2);
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
function onResize() { if (S.render) try { S.render.resize(); } catch (_) {} }
function cerrar() {
  try { if (S.stream) S.stream.cerrar(); } catch (_) {}
  try { if (S.worker) S.worker.terminate(); } catch (_) {}
  if (S.rebuildT) clearTimeout(S.rebuildT); if (S.velasT) clearInterval(S.velasT);
  window.removeEventListener('resize', onResize);
  cerrarPops();
  const ov = $('fp-overlay'); if (ov) ov.remove();
  S.worker = null; S.stream = null; S.render = null; S.agg = null; S.trades = [];
}
