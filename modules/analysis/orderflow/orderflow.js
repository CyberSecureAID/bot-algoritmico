/* ══════════════════════════════════════════════════════════════
   orderflow/orderflow.js — Order Flow. Herramienta completa, en vivo.

   Grafica de footprint interactiva (zoom, desplazar, historia) con la
   vela en curso formandose en vivo, cabecera uniforme estilo SP500,
   selector de moneda con buscador (lista central del sitio, logos de
   CoinGecko), temporalidades de 1m a 1W, y panel lateral con un
   analizador del flujo + libro de ordenes compacto en vivo.
   Datos reales de Binance USD-M Futures. Autocontenida.
   ══════════════════════════════════════════════════════════════ */

import { crearChart } from './grafica.js?v=2';
import { tickPorRango, TFS, traerKlines, traer24h, traerTapeReciente, abrirFlujos, logoDe } from './datos.js?v=2';
import { velaViva, acumular, metricasLibro, analizarFlujo } from './motor.js?v=2';

const ICO = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  how: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 0 1 4.6 1.2c0 1.7-2.1 2-2.1 3.3"/><path d="M12 17h.01"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>'
};
const MAXV = 320;                        // tope de velas en memoria (historia incluida)
const UP = String.fromCharCode(9650), DN = String.fromCharCode(9660), MID = String.fromCharCode(183);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kfmt = (n) => { const a = Math.abs(n); return a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1000 ? (a / 1000).toFixed(a >= 1e4 ? 0 : 1) + 'K' : '' + Math.round(a); };
const sfmt = (n) => (n >= 0 ? UP : DN) + kfmt(n);
const fmtP = (p, tick) => p == null ? '...' : (tick < 1 ? p.toFixed(tick < 0.01 ? 4 : 2) : p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const lget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } };
const lset = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

const PARES_FB = [{ id: 'BTC', s: 'BTCUSDT', n: 'Bitcoin', cg: 'bitcoin' }, { id: 'ETH', s: 'ETHUSDT', n: 'Ethereum', cg: 'ethereum' }, { id: 'SOL', s: 'SOLUSDT', n: 'Solana', cg: 'solana' }, { id: 'BNB', s: 'BNBUSDT', n: 'BNB', cg: 'binancecoin' }];
const MARCA = new URL('../../../assets/img/cco-marca.webp', import.meta.url).href;   // ruta absoluta de la marca

export async function abrirOrderFlow() {
  inyectarCSS();
  const prev = document.getElementById('of-overlay'); if (prev) prev.remove();

  let PARES = PARES_FB;
  try { const cfg = await import(new URL('../../../assets/js/niveles/config.js', import.meta.url).href); if (cfg && cfg.PARES && cfg.PARES.length) PARES = cfg.PARES; } catch (_) {}

  const ov = document.createElement('div'); ov.id = 'of-overlay';
  let sym = lget('of-sym', 'BTCUSDT'); if (!PARES.some((p) => p.s === sym)) sym = 'BTCUSDT';
  let tf = lget('of-tf', '1h'); if (!TFS.some((t) => t[0] === tf)) tf = '1h';
  const par = () => PARES.find((p) => p.s === sym) || PARES[0];
  const tfObj = () => TFS.find((t) => t[0] === tf) || TFS[4];

  ov.innerHTML = `
    <header class="of-bar">
      <button class="of-bk" id="of-back" aria-label="Back">${ICO.back}</button>
      <div class="of-coin" id="of-coin">
        <span class="of-ico" id="of-ico">${esc(par().id)}</span>
        <div class="of-nm"><b id="of-sym">${esc(sym)}</b><span id="of-name">${esc(par().n)} ${MID} Binance</span></div>
        <i class="of-cv">${DN}</i>
        <div class="of-menu" id="of-menu">
          <div class="of-srch">${ICO.search}<input id="of-q" placeholder="Search coin" autocomplete="off"></div>
          <div class="of-list" id="of-list"></div>
        </div>
      </div>
      <span class="of-px" id="of-px">...</span>
      <b class="of-chg" id="of-chg">...</b>
      <div class="of-dd" id="of-tf">
        <button class="cur" id="of-tfcur">${esc(tfObj()[1])} <i>${DN}</i></button>
        <div class="menu">${TFS.map((t) => `<button data-tf="${t[0]}"${t[0] === tf ? ' class="on"' : ''}>${esc(t[1])}</button>`).join('')}</div>
      </div>
      <div class="of-col"><span class="l">Delta</span><b class="v" id="of-cdelta">...</b></div>
      <div class="of-col hide-sm"><span class="l">Session</span><b class="v" id="of-cvd">...</b></div>
      <div class="of-col hide-sm"><span class="l">Book OBI</span><b class="v" id="of-obi">...</b></div>
      <div class="of-tool"><b>ORDER FLOW</b><span>FOOTPRINT ${MID} IMBALANCE ${MID} DOM</span></div>
      <div class="of-right">
        <div class="of-live" id="of-live"><i></i><b>LIVE</b><em>BINANCE</em></div>
        <button class="of-ib" id="of-how" title="How it works">${ICO.how}</button>
      </div>
    </header>
    <div class="of-main">
      <div class="of-graf" id="of-graf">
        <canvas id="of-cv"></canvas>
        <img class="of-marca" src="${MARCA}" alt="">
        <div class="of-hint" id="of-hint">Scroll to zoom ${MID} drag to move ${MID} double click to reset</div>
        <div class="of-wait" id="of-wait"><div class="of-spin"></div><b>Connecting to the live tape</b></div>
      </div>
      <aside class="of-side">
        <section class="of-card" id="of-ana">
          <div class="of-ana-top"><span class="of-chip of-chip-neu" id="of-ana-chip">Neutral</span><h3 class="of-h" id="of-ana-title">Reading the flow…</h3></div>
          <p class="of-read" id="of-ana-read">Waiting for live data.</p>
          <div class="of-bar2"><i id="of-ana-bar" style="width:0%"></i></div>
          <div class="of-grid" id="of-ana-grid"></div>
          <p class="of-note">This is not investment advice. It is a logical read of what the order flow is doing right now, built from public exchange data.</p>
        </section>
        <section class="of-card of-bookc">
          <h3 class="of-h">Order book <span class="of-live2" id="of-book-live">LIVE</span></h3>
          <div class="of-bk-head"><span>BID SIZE</span><span>PRICE</span><span>ASK SIZE</span></div>
          <div id="of-book" class="of-bk"></div>
        </section>
      </aside>
    </div>`;
  document.body.appendChild(ov);

  const $ = (s) => ov.querySelector(s);
  const cv = $('#of-cv'), cont = $('#of-graf'), wait = $('#of-wait');
  const chart = crearChart(cv, cont);

  let flujo = null, tape = [], met = { obi: 50, vpin: 0, spoof: 0, net: 0 }, destruido = false;
  let intervalMs = tfObj()[2], relojBar = 0, relojAna = 0, relojBook = 0;

  function toast(m) { let t = ov.querySelector('.of-toast'); if (!t) { t = document.createElement('div'); t.className = 'of-toast'; cont.appendChild(t); } t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }

  function aplicarLogo(el, p) { if (!el) return; el.textContent = p.id; el.style.backgroundImage = ''; logoDe(p.cg).then((u) => { if (u && !destruido) { el.style.backgroundImage = `url(${u})`; el.textContent = ''; } }); }

  function pintarBar() {
    const t = chart.S.tick, px = $('#of-px'); px.textContent = fmtP(chart.S.precio, t); px.className = 'of-px ' + (chart.S.chg >= 0 ? 'up' : 'dn');
    const ch = $('#of-chg'); ch.textContent = (chart.S.chg >= 0 ? UP : DN) + ' ' + Math.abs(chart.S.chg).toFixed(2) + '%'; ch.className = 'of-chg ' + (chart.S.chg >= 0 ? 'up' : 'dn');
    const vs = chart.S.velas, v = vs[vs.length - 1];
    if (v) { const cd = $('#of-cdelta'); cd.textContent = sfmt(v.delta); cd.className = 'v ' + (v.delta >= 0 ? 'up' : 'dn');
      const sess = vs.reduce((s, x) => s + x.delta, 0); const cv2 = $('#of-cvd'); cv2.textContent = sfmt(sess); cv2.className = 'v ' + (sess >= 0 ? 'up' : 'dn'); }
    const ob = $('#of-obi'); ob.textContent = Math.round(met.obi) + '%'; ob.className = 'v ' + (met.obi >= 50 ? 'up' : 'dn');
  }
  function estadoLive(s) { const el = $('#of-live'); if (!el) return; el.classList.toggle('off', s !== 'live'); el.querySelector('b').textContent = s === 'live' ? 'LIVE' : 'RECONNECTING'; const bl = $('#of-book-live'); if (bl) bl.classList.toggle('off', s !== 'live'); }

  function pintarAnalizador() {
    const a = analizarFlujo(chart.S.velas, met, chart.S.tick); if (!a) return;
    $('#of-ana-title').textContent = a.titulo;
    $('#of-ana-read').textContent = a.lectura;
    const chip = $('#of-ana-chip'); chip.className = 'of-chip of-chip-' + a.sesgo; chip.textContent = a.sesgo === 'bull' ? 'Bullish' : a.sesgo === 'bear' ? 'Bearish' : 'Neutral';
    $('#of-ana-bar').style.width = a.fuerza + '%'; $('#of-ana-bar').className = 'f-' + a.sesgo;
    $('#of-ana-grid').innerHTML = a.puntos.map((p) => `<div class="of-gr"><span>${esc(p[0])}</span><b>${esc(p[1])}</b></div>`).join('');
  }

  function pintarLibro(bids, asks) {
    const t = chart.S.tick, px = chart.S.precio;
    const a = asks.filter((x) => x[0] >= px).sort((x, y) => x[0] - y[0]).slice(0, 8).reverse();
    const b = bids.filter((x) => x[0] <= px).sort((x, y) => y[0] - x[0]).slice(0, 8);
    let MX = 1; a.concat(b).forEach((x) => { MX = Math.max(MX, x[0] * x[1]); });
    const fila = (x, side) => { const no = x[0] * x[1], w = Math.max(3, (no / MX) * 100), rgb = side === 'ask' ? '246,70,93' : '46,189,133';
      return `<div class="of-brow ${side}"><span class="bs">${side === 'bid' ? kfmt(no) : ''}</span><span class="bp">${x[0].toFixed(t < 1 ? 2 : 1)}</span><span class="bs r">${side === 'ask' ? kfmt(no) : ''}</span><i class="bbar" style="width:${w}%;background:rgba(${rgb},.3)"></i></div>`; };
    $('#of-book').innerHTML = a.map((x) => fila(x, 'ask')).join('') + `<div class="of-bmid">${fmtP(px, t)} ${MID} ${Math.round(met.obi)}% bid</div>` + b.map((x) => fila(x, 'bid')).join('');
  }

  // ---- lista de monedas (con buscador) ----
  function pintarLista(q) {
    q = (q || '').trim().toUpperCase();
    const fil = PARES.filter((p) => !q || p.s.indexOf(q) >= 0 || (p.n || '').toUpperCase().indexOf(q) >= 0 || p.id.indexOf(q) >= 0);
    $('#of-list').innerHTML = fil.map((p) => `<button class="of-it${p.s === sym ? ' on' : ''}" data-sym="${p.s}"><span class="of-ib2">${esc(p.id)}</span><b>${esc(p.s)}</b><span class="of-in">${esc(p.n)}</span></button>`).join('') || `<div class="of-empty">No match</div>`;
    $('#of-list').querySelectorAll('.of-it').forEach((btn) => btn.onclick = (e) => { e.stopPropagation(); const ns = btn.dataset.sym; cerrarMenus(); if (ns === sym) return; sym = ns; lset('of-sym', sym); const p = par(); $('#of-sym').textContent = sym; $('#of-name').innerHTML = esc(p.n) + ' ' + MID + ' Binance'; aplicarLogo($('#of-ico'), p); tape = []; cargar(true); });
  }

  async function cargar(inicial) {
    try {
      if (inicial) { wait.style.display = 'flex'; }
      intervalMs = tfObj()[2];
      const [kl, d24] = await Promise.all([traerKlines(sym, tf, 120), traer24h(sym)]);
      if (!kl || kl.length < 3) throw new Error('sin klines');
      const rango = Math.max(...kl.map((k) => k.h)) - Math.min(...kl.map((k) => k.l));
      const tick = tickPorRango(rango, kl[kl.length - 1].c);
      const velas = kl.map((k, i) => i === kl.length - 1 ? { ...k, cerrada: false, mapa: new Map() } : { ...k, _filas: null });
      const viva = velas[velas.length - 1];
      chart.S.velas = velas; chart.S.tick = tick; chart.S.sym = sym; chart.S.nombre = par().n; chart.S.tf = tf; chart.S.tfLabel = tfObj()[1];
      chart.S.precio = kl[kl.length - 1].c; chart.S.chg = d24 ? d24.chg : 0; chart.S.view = { n: 42, off: 0 }; chart.S.cargandoHist = false;
      chart.S.onHistoria = cargarHistoria;
      try { const seed = await traerTapeReciente(sym, viva.t); seed.forEach((tr) => { const lv = Math.round(tr.p / tick) * tick; const e = viva.mapa.get(lv) || { bid: 0, ask: 0 }; if (tr.venta) e.bid += tr.q; else e.ask += tr.q; viva.mapa.set(lv, e); }); } catch (_) {}
      wait.style.display = 'none';
      pintarBar(); pintarAnalizador(); chart.arrancar(); abrirStream();
    } catch (e) {
      if (!inicial && chart.S.velas.length) { toast('Could not refresh. Showing last data.'); return; }
      wait.style.display = 'flex';
      wait.innerHTML = `<b>Could not reach Binance right now.</b><span>The feed may be busy or blocked by the network. Check the connection and retry.</span><button class="of-retry" id="of-retry">Retry</button>`;
      const b = $('#of-retry'); if (b) b.onclick = () => { wait.innerHTML = `<div class="of-spin"></div><b>Connecting to the live tape</b>`; cargar(true); };
    }
  }

  async function cargarHistoria(oldestT) {
    try {
      const mas = await traerKlines(sym, tf, 120, oldestT - 1);
      if (!mas || !mas.length) return;
      const ya = new Set(chart.S.velas.map((v) => v.t));
      const nuevas = mas.filter((k) => !ya.has(k.t)).map((k) => ({ ...k, _filas: null }));
      if (!nuevas.length) return;
      chart.S.velas = nuevas.concat(chart.S.velas);
      if (chart.S.velas.length > MAXV + 160) chart.S.velas = chart.S.velas.slice(0, MAXV + 160);  // tope por el lado viejo
    } catch (_) {}
  }

  function abrirStream() {
    try { flujo && flujo.cerrar(); } catch (_) {}
    flujo = abrirFlujos(sym, {
      onTrade: (tr) => {
        if (destruido) return; const vs = chart.S.velas; let viva = vs[vs.length - 1];
        while (tr.T >= viva.t + intervalMs) { viva.cerrada = true; viva._filas = null; viva = { ...velaViva(viva.t + intervalMs, tr.p) }; vs.push(viva); if (vs.length > MAXV + 160) vs.shift(); }
        acumular(viva, tr, chart.S.tick); chart.S.precio = tr.p;
        tape.push(tr); if (tape.length > 800) tape.splice(0, tape.length - 800);
        const now = Date.now();
        if (now - relojBar > 150) { relojBar = now; pintarBar(); }
        if (now - relojAna > 700) { relojAna = now; pintarAnalizador(); }
      },
      onDepth: (bids, asks) => {
        if (destruido) return; met = metricasLibro(bids, asks, tape.slice(-600));
        const now = Date.now(); if (now - relojBook > 160) { relojBook = now; pintarLibro(bids, asks); }
      },
      onEstado: estadoLive
    });
  }

  // ---- controles ----
  const coin = $('#of-coin'), menu = $('#of-menu');
  coin.addEventListener('click', (e) => { if (e.target.closest('.of-menu')) return; e.stopPropagation(); const open = menu.classList.toggle('open'); if (open) { pintarLista(''); const q = $('#of-q'); if (q) { q.value = ''; setTimeout(() => q.focus(), 30); } } });
  $('#of-q').addEventListener('input', (e) => pintarLista(e.target.value));
  $('#of-q').addEventListener('click', (e) => e.stopPropagation());

  const tfdd = $('#of-tf');
  $('#of-tfcur').onclick = (e) => { e.stopPropagation(); tfdd.classList.toggle('open'); };
  tfdd.querySelector('.menu').addEventListener('click', (e) => { const b = e.target.closest('[data-tf]'); if (!b) return; tfdd.classList.remove('open'); if (b.dataset.tf === tf) return; tf = b.dataset.tf; lset('of-tf', tf); tfdd.querySelectorAll('[data-tf]').forEach((x) => x.classList.toggle('on', x === b)); $('#of-tfcur').childNodes[0].nodeValue = tfObj()[1] + ' '; tape = []; cargar(true); });
  document.addEventListener('click', cerrarMenus);
  function cerrarMenus() { menu.classList.remove('open'); tfdd.classList.remove('open'); }

  function cerrar() { destruido = true; try { flujo && flujo.cerrar(); } catch (_) {} try { chart.destruir(); } catch (_) {} document.removeEventListener('click', cerrarMenus); try { ov.remove(); } catch (_) {} }
  $('#of-back').onclick = cerrar;
  $('#of-how').onclick = abrirComo;
  const hint = $('#of-hint'); if (hint) setTimeout(() => hint.classList.add('off'), 4200);

  function abrirComo() {
    const old = ov.querySelector('#of-modal'); if (old) old.remove();
    const m = document.createElement('div'); m.className = 'of-modal'; m.id = 'of-modal';
    m.innerHTML = `
      <div class="of-modal-bg"></div>
      <div class="of-modal-card">
        <button class="of-modal-x" aria-label="Close">${ICO.x}</button>
        <h2>Order flow, in plain words</h2>
        <p>Each candle carries, to its right, the volume profile of what actually traded at every price: long bars where there was more negotiation, short where there was less. Blue is where buyers dominated, red where sellers did. The candle in progress is outlined and builds in real time from the live tape.</p>
        <ul>
          <li><b>Zoom and move:</b> scroll to zoom, drag to move, double click to reset. The further in you zoom, the more detail each candle shows.</li>
          <li><b>Imbalances:</b> the diagonal gaps that did not resolve. When one side is at least three times the opposite one tick away, the level is outlined.</li>
          <li><b>Value area and POC:</b> the band that holds 70% of the candle volume, and the single most traded level, outlined in gold.</li>
          <li><b>Order book and analyzer:</b> on the right, the live book and a plain read of what the flow is doing now, with a suggested lean.</li>
        </ul>
        <p class="of-note">Live public data from Binance. This is a logical read, not investment advice.</p>
      </div>`;
    ov.appendChild(m); requestAnimationFrame(() => m.classList.add('on'));
    const q = () => { m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 160); };
    m.querySelector('.of-modal-x').onclick = q; m.querySelector('.of-modal-bg').onclick = q;
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('of-overlay')) chart.dibujar(); });
  aplicarLogo($('#of-ico'), par());
  await cargar(true);
}

function inyectarCSS() {
  if (document.getElementById('of-css')) return;
  const st = document.createElement('style'); st.id = 'of-css';
  st.textContent = `
#of-overlay{position:fixed;inset:0;z-index:40050;display:flex;flex-direction:column;background:#070a0f;color:#eaecef;
  --gold:#E8B84B;--line:#1c232b;--up:#2ebd85;--dn:#f6465d;
  font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#of-overlay *{box-sizing:border-box}
.of-bar{display:flex;align-items:center;gap:11px;padding:0 12px;height:52px;flex:none;position:relative;background:linear-gradient(180deg,#0c111a,#070a0e);border-bottom:1px solid var(--line);overflow:visible;z-index:20}
.of-bar::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,184,75,.5),transparent)}
.of-bk{width:34px;height:32px;flex:none;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:linear-gradient(180deg,#141a22,#0d1117);color:#cfd6df;cursor:pointer;padding:0}
.of-bk svg{width:17px;height:17px}.of-bk:hover{border-color:rgba(232,184,75,.5);color:var(--gold)}
.of-coin{position:relative;display:flex;align-items:center;gap:8px;flex:none;cursor:pointer;padding:3px 7px;border-radius:10px}
.of-coin:hover{background:rgba(255,255,255,.04)}
.of-ico{width:28px;height:28px;border-radius:50%;background:#1b2230 center/cover no-repeat;border:1px solid #2a3647;flex:none;display:grid;place-items:center;font-family:"IBM Plex Mono",monospace;font-size:9px;font-weight:700;color:var(--gold)}
.of-nm{display:flex;flex-direction:column;line-height:1.12}
.of-nm b{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:800;font-size:15px}
.of-nm span{font-size:9px;color:#79838f;font-family:"IBM Plex Mono",monospace}
.of-cv{font-style:normal;color:#79838f;font-size:9px}
.of-menu{position:absolute;top:44px;left:0;z-index:60;width:264px;display:none;background:rgba(14,18,24,.98);backdrop-filter:blur(16px);border:1px solid #29313b;border-radius:13px;padding:7px;box-shadow:0 22px 56px rgba(0,0,0,.7)}
.of-coin .of-menu.open{display:block}
.of-srch{display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid var(--line);border-radius:9px;background:#0b0f15;margin-bottom:6px}
.of-srch svg{width:14px;height:14px;color:#79838f;flex:none}
.of-srch input{flex:1;background:none;border:0;outline:none;color:#eaecef;font-size:13px;font-family:inherit}
.of-list{max-height:320px;overflow:auto}
.of-it{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:none;border:0;color:#cfd6df;padding:7px 8px;border-radius:9px;cursor:pointer}
.of-it:hover{background:rgba(255,255,255,.05)}.of-it.on{background:rgba(232,184,75,.08)}
.of-ib2{width:24px;height:24px;border-radius:50%;background:#1b2230;border:1px solid #2a3647;flex:none;display:grid;place-items:center;font-family:"IBM Plex Mono",monospace;font-size:7.5px;font-weight:700;color:var(--gold)}
.of-it b{font-size:12.5px;font-weight:700}.of-it .of-in{font-size:10px;color:#79838f;margin-left:auto;font-family:"IBM Plex Mono",monospace}
.of-empty{padding:14px;text-align:center;color:#79838f;font-size:12px}
.of-px{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:800;font-size:19px;color:var(--up);flex:none}.of-px.dn{color:var(--dn)}
.of-chg{font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:700;color:var(--up);flex:none}.of-chg.dn{color:var(--dn)}
.of-dd{position:relative;flex:none}
.of-dd .cur{display:flex;align-items:center;gap:5px;background:#0d1117;border:1px solid var(--line);border-radius:9px;color:#eaecef;font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:700;padding:7px 10px;cursor:pointer;min-height:32px}
.of-dd .cur i{font-style:normal;color:#79838f;font-size:9px}.of-dd .cur:hover{border-color:rgba(232,184,75,.5)}
.of-dd .menu{position:absolute;top:38px;left:0;z-index:60;min-width:78px;display:none;background:rgba(16,20,26,.96);backdrop-filter:blur(14px);border:1px solid #29313b;border-radius:12px;padding:5px;box-shadow:0 22px 56px rgba(0,0,0,.7)}
.of-dd.open .menu{display:block}
.of-dd .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:#aeb6c0;font-weight:600;font-size:12.5px;padding:7px 11px;border-radius:9px;cursor:pointer}
.of-dd .menu button:hover{background:rgba(232,184,75,.1);color:#eaecef}.of-dd .menu button.on{color:var(--gold);background:rgba(232,184,75,.08)}
.of-col{flex:none;display:flex;flex-direction:column;line-height:1.25;white-space:nowrap}
.of-col .l{font-family:"IBM Plex Mono",monospace;font-size:9px;color:#79838f;margin-bottom:2px}
.of-col .v{font-family:"IBM Plex Mono",monospace;font-size:12px;color:#eaecef;font-weight:600}
.of-col .v.up{color:var(--up)}.of-col .v.dn{color:var(--dn)}
.of-tool{display:flex;flex-direction:column;line-height:1.1;padding-left:12px;margin-left:2px;border-left:1px solid var(--line)}
.of-tool b{font-size:12px;font-weight:800;letter-spacing:1.2px}.of-tool span{font-size:7.5px;letter-spacing:1.1px;color:#4a5561;font-weight:700;margin-top:2px}
.of-right{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none}
.of-live{display:flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid var(--line);border-radius:999px;background:#0d1117;font-size:10px;font-family:"IBM Plex Mono",monospace}
.of-live i{width:7px;height:7px;border-radius:50%;background:#2ee86a;animation:of-pulse 1.8s infinite}
.of-live b{color:#2ee86a;letter-spacing:.5px}.of-live em{color:#79838f;font-style:normal;border-left:1px solid var(--line);padding-left:6px}
.of-live.off i{background:#f6465d;animation:none}.of-live.off b{color:#ff8b96}
@keyframes of-pulse{0%{box-shadow:0 0 0 0 rgba(46,232,106,.5)}70%{box-shadow:0 0 0 7px rgba(46,232,106,0)}100%{box-shadow:0 0 0 0 rgba(46,232,106,0)}}
.of-ib{width:34px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:linear-gradient(180deg,#141a22,#0d1117);color:#cfd6df;cursor:pointer;padding:0}
.of-ib svg{width:17px;height:17px}.of-ib:hover{border-color:rgba(232,184,75,.5);color:var(--gold)}
.of-main{flex:1;display:flex;min-height:0}
.of-graf{flex:1;position:relative;min-width:0;background:#070a0f}
#of-cv{display:block;width:100%;height:100%;touch-action:none}
.of-marca{position:absolute;left:14px;top:12px;pointer-events:none;height:22px;width:auto;opacity:.32;filter:drop-shadow(0 2px 6px rgba(0,0,0,.85));z-index:2;user-select:none}
.of-hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:3;pointer-events:none;background:rgba(16,20,26,.9);border:1px solid var(--line);color:#aeb6c0;font-size:10.5px;font-family:"IBM Plex Mono",monospace;padding:6px 12px;border-radius:999px;transition:opacity .4s}
.of-hint.off{opacity:0}
.of-wait{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(7,10,15,.82);text-align:center;padding:24px;z-index:5}
.of-wait b{font-size:14px}.of-wait span{font-size:12px;color:#79838f;max-width:340px;line-height:1.5}
.of-spin{width:34px;height:34px;border:3px solid rgba(232,184,75,.2);border-top-color:var(--gold);border-radius:50%;animation:of-spin .9s linear infinite}
@keyframes of-spin{to{transform:rotate(360deg)}}
.of-retry{margin-top:4px;padding:8px 18px;border:1px solid rgba(232,184,75,.5);border-radius:10px;background:rgba(232,184,75,.12);color:var(--gold);font-weight:700;cursor:pointer}
.of-toast{position:absolute;left:50%;bottom:52px;transform:translateX(-50%) translateY(10px);z-index:6;pointer-events:none;background:rgba(16,20,26,.96);border:1px solid var(--line);color:#eaecef;font-size:12px;padding:9px 14px;border-radius:10px;opacity:0;transition:opacity .18s,transform .18s;max-width:84%;text-align:center}
.of-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
.of-side{width:320px;flex:none;border-left:1px solid var(--line);background:#080b10;overflow:auto;padding:13px;display:flex;flex-direction:column;gap:12px}
.of-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:linear-gradient(180deg,#0c111a,#0a0d13)}
.of-h{margin:0 0 10px;font-family:"Chakra Petch",system-ui,sans-serif;font-size:12.5px;letter-spacing:.4px;text-transform:uppercase;color:#cfd6df;display:flex;align-items:center;gap:8px}
.of-ana-top{display:flex;align-items:center;gap:9px;margin-bottom:8px}
.of-chip{font-size:10px;font-weight:800;letter-spacing:.3px;padding:4px 9px;border-radius:999px;font-family:"IBM Plex Mono",monospace;flex:none}
.of-chip-bull{background:rgba(46,232,106,.16);color:#2ee86a}.of-chip-bear{background:rgba(255,91,110,.16);color:#ff6b7a}.of-chip-neu{background:rgba(255,255,255,.08);color:#aeb6c0}
#of-ana-title{margin:0;font-size:13.5px;font-family:"Plus Jakarta Sans",sans-serif;font-weight:800;text-transform:none;letter-spacing:0;color:#eaecef}
.of-read{font-size:12.5px;line-height:1.55;color:#c2cad3;margin:0 0 11px}
.of-bar2{height:6px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden;margin-bottom:12px}
.of-bar2 i{display:block;height:100%;border-radius:999px;transition:width .5s}
.of-bar2 i.f-bull{background:linear-gradient(90deg,#1f8f5c,#2ee86a)}.of-bar2 i.f-bear{background:linear-gradient(90deg,#9c3442,#ff6b7a)}.of-bar2 i.f-neu{background:linear-gradient(90deg,#4a5561,#8a94a0)}
.of-grid{display:flex;flex-direction:column;gap:1px;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.of-gr{display:flex;justify-content:space-between;align-items:center;padding:7px 11px;background:#0a0e14;font-family:"IBM Plex Mono",monospace}
.of-gr span{font-size:11px;color:#8a94a0}.of-gr b{font-size:11.5px;color:#eaecef;font-weight:700}
.of-note{font-size:10.5px;line-height:1.5;color:#6f7985;margin:10px 0 0;border-top:1px solid rgba(255,255,255,.05);padding-top:9px}
.of-live2{margin-left:auto;font-family:"IBM Plex Mono",monospace;font-size:8.5px;color:#2ee86a;letter-spacing:.8px;background:rgba(46,232,106,.12);padding:2px 7px;border-radius:6px}
.of-live2.off{color:#ff8b96;background:rgba(255,91,110,.12)}
.of-bk-head{display:grid;grid-template-columns:1fr 1fr 1fr;font-family:"IBM Plex Mono",monospace;font-size:8px;color:#4a5561;font-weight:700;padding:0 2px 6px}
.of-bk-head span:nth-child(2){text-align:center}.of-bk-head span:last-child{text-align:right}
.of-bk{display:flex;flex-direction:column;gap:1px}
.of-brow{position:relative;display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;padding:3px 2px;font-family:"IBM Plex Mono",monospace;font-size:10.5px;overflow:hidden}
.of-brow .bbar{position:absolute;top:1px;bottom:1px;z-index:0;border-radius:3px}
.of-brow.ask .bbar{right:0}.of-brow.bid .bbar{left:0}
.of-brow .bs,.of-brow .bp{position:relative;z-index:1}
.of-brow .bs{color:#c2cad3}.of-brow .bs.r{text-align:right}
.of-brow .bp{text-align:center;font-weight:600}
.of-brow.ask .bp{color:#ff8b96}.of-brow.bid .bp{color:#8ce8be}
.of-bmid{text-align:center;font-family:"IBM Plex Mono",monospace;font-size:9.5px;color:var(--gold);padding:5px 0;border-top:1px solid rgba(232,184,75,.18);border-bottom:1px solid rgba(232,184,75,.18);margin:3px 0}
.of-modal{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .16s}.of-modal.on{opacity:1}
.of-modal-bg{position:absolute;inset:0;background:rgba(5,7,10,.72);backdrop-filter:blur(3px)}
.of-modal-card{position:relative;max-width:540px;width:100%;max-height:86vh;overflow:auto;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,#0e131c,#0a0d13);padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.of-modal-x{position:absolute;top:12px;right:12px;width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:#0d1117;color:#cfd6df;cursor:pointer}
.of-modal-card h2{font-family:"Chakra Petch",system-ui,sans-serif;font-size:19px;margin:0 0 12px;color:var(--gold)}
.of-modal-card p{font-size:13px;line-height:1.6;color:#c2cad3;margin:0 0 10px}
.of-modal-card ul{margin:0 0 10px;padding-left:4px;list-style:none;display:flex;flex-direction:column;gap:7px}
.of-modal-card li{font-size:12.5px;line-height:1.5;color:#c2cad3;padding-left:14px;position:relative}
.of-modal-card li::before{content:"";position:absolute;left:0;top:7px;width:6px;height:6px;border-radius:50%;background:var(--gold)}
@media(max-width:1050px){.of-col.hide-sm{display:none}.of-tool{display:none}}
@media(max-width:900px){.of-main{flex-direction:column}.of-graf{height:56vh;flex:none}.of-side{width:auto;border-left:none;border-top:1px solid var(--line)}.of-bar{flex-wrap:wrap;height:auto;padding:8px 10px;gap:9px}.of-right{order:5}}
@media(max-width:560px){.of-nm span{display:none}.of-px{font-size:17px}.of-col{display:none}}`;
  document.head.appendChild(st);
}
