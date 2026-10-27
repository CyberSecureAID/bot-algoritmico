/* ══════════════════════════════════════════════════════════════
   orderflow/orderflow.js — Order Flow. Herramienta completa, en vivo.

   Footprint (vela + perfil de volumen), DOM espejo y tabla de delta,
   alimentados en tiempo real por Binance USD-M Futures (klines 1H +
   tape aggTrade + libro depth20). Cabecera uniforme estilo Futuros.
   Autocontenida en su carpeta. No es placeholder: el tape mueve la
   vela en curso y el libro mueve el DOM, operacion a operacion.
   ══════════════════════════════════════════════════════════════ */

import { crearChart } from './grafica.js?v=1';
import { PARES, tickDe, tickPorRango, traerKlines, traer24h, traerTapeReciente, abrirFlujos } from './datos.js?v=1';
import { velaViva, acumular, metricasLibro } from './motor.js?v=1';

const ICO = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  how: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 0 1 4.6 1.2c0 1.7-2.1 2-2.1 3.3"/><path d="M12 17h.01"/></svg>'
};
const TFS = [['15m', '15m', 900000], ['1h', '1H', 3600000], ['4h', '4H', 14400000]];
const MAXV = 20;
const UP = String.fromCharCode(9650), DN = String.fromCharCode(9660), MID = String.fromCharCode(183);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtP = (p, tick) => p == null ? '...' : (tick < 1 ? p.toFixed(2) : p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const logoURL = (c) => 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/' + c + '.png';
const lget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } };
const lset = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

export async function abrirOrderFlow() {
  inyectarCSS();
  const prev = document.getElementById('of-overlay'); if (prev) prev.remove();
  const ov = document.createElement('div'); ov.id = 'of-overlay';

  let sym = lget('of-sym', 'BTCUSDT'); if (!PARES.some((p) => p.s === sym)) sym = 'BTCUSDT';
  let tf = lget('of-tf', '1h'); if (!TFS.some((t) => t[0] === tf)) tf = '1h';
  const par0 = PARES.find((p) => p.s === sym);

  ov.innerHTML = `
    <header class="of-bar">
      <button class="of-bk" id="of-back" aria-label="Back">${ICO.back}</button>
      <div class="of-coin" id="of-coin">
        <span class="of-ico" id="of-ico" style="background-image:url('${logoURL(par0.c)}')"></span>
        <div class="of-nm"><b id="of-sym">${esc(sym)}</b><span id="of-name">${esc(par0.n)} ${MID} Binance</span></div>
        <i class="of-cv">${DN}</i>
        <div class="of-menu" id="of-menu">
          <div class="of-grp">BINANCE ${MID} PERP</div>
          ${PARES.map((p) => `<button class="of-it${p.s === sym ? ' on' : ''}" data-sym="${p.s}" data-c="${p.c}" data-n="${esc(p.n)}"><span class="of-ico2" style="background-image:url('${logoURL(p.c)}')"></span><b>${p.s}</b></button>`).join('')}
        </div>
      </div>
      <span class="of-px" id="of-px">...</span>
      <b class="of-chg" id="of-chg">...</b>
      <div class="of-dd" id="of-tf">
        <button class="cur" id="of-tfcur">${(TFS.find((t) => t[0] === tf) || TFS[1])[1]} <i>${DN}</i></button>
        <div class="menu">${TFS.map((t) => `<button data-tf="${t[0]}"${t[0] === tf ? ' class="on"' : ''}>${t[1]}</button>`).join('')}</div>
      </div>
      <div class="of-tool"><b>ORDER FLOW</b><span>FOOTPRINT ${MID} IMBALANCE ${MID} DOM</span></div>
      <div class="of-right">
        <div class="of-live" id="of-live"><i></i><b>LIVE</b><em>BINANCE</em></div>
        <button class="of-ib" id="of-how" title="How it works">${ICO.how}</button>
      </div>
    </header>
    <div class="of-graf" id="of-graf">
      <canvas id="of-cv"></canvas>
      <img class="of-marca" src="assets/img/cco-marca.webp" alt="">
      <div class="of-wait" id="of-wait"><div class="of-spin"></div><b>Connecting to the live tape</b></div>
    </div>`;
  document.body.appendChild(ov);

  const $ = (s) => ov.querySelector(s);
  const cv = $('#of-cv'), cont = $('#of-graf'), wait = $('#of-wait');
  const chart = crearChart(cv, cont);

  let flujo = null, tape = [], intervalMs = (TFS.find((t) => t[0] === tf) || TFS[1])[2];
  let destruido = false, reloj = 0;

  function toast(msg) { let t = ov.querySelector('.of-toast'); if (!t) { t = document.createElement('div'); t.className = 'of-toast'; cont.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }

  function pintarBar() {
    const px = $('#of-px'); px.textContent = fmtP(chart.S.precio, chart.S.tick); px.className = 'of-px ' + (chart.S.chg >= 0 ? 'up' : 'dn');
    const ch = $('#of-chg'); ch.textContent = (chart.S.chg >= 0 ? UP : DN) + ' ' + Math.abs(chart.S.chg).toFixed(2) + '%'; ch.className = 'of-chg ' + (chart.S.chg >= 0 ? 'up' : 'dn');
  }
  function estadoLive(s) { const el = $('#of-live'); if (!el) return; el.classList.toggle('off', s !== 'live'); el.querySelector('b').textContent = s === 'live' ? 'LIVE' : 'RECONNECTING'; }

  async function cargar(inicial) {
    try {
      if (inicial) { wait.style.display = 'flex'; }
      intervalMs = (TFS.find((t) => t[0] === tf) || TFS[1])[2];
      const [kl, d24] = await Promise.all([traerKlines(sym, tf, MAXV), traer24h(sym)]);
      if (!kl || kl.length < 3) throw new Error('sin klines');
      const rango = Math.max(...kl.map((k) => k.h)) - Math.min(...kl.map((k) => k.l));
      const tick = tickPorRango(rango, kl[kl.length - 1].c);
      // la ultima vela de Binance es la que se esta formando: la hacemos "viva"
      const velas = kl.map((k, i) => i === kl.length - 1
        ? { ...k, cerrada: false, mapa: new Map() }
        : { ...k, _filas: null });
      const viva = velas[velas.length - 1];
      chart.S.velas = velas; chart.S.tick = tick; chart.S.sym = sym; chart.S.nombre = par0name(sym);
      chart.S.precio = kl[kl.length - 1].c; chart.S.tf = (TFS.find((t) => t[0] === tf) || TFS[1])[1];
      chart.S.chg = d24 ? d24.chg : 0; chart.S.dom = { bids: [], asks: [] }; chart.S.met = { obi: 50, vpin: 0, spoof: 0, net: 0 };
      // sembrar la forma del footprint de la vela viva con el tape reciente real (solo forma)
      try { const seed = await traerTapeReciente(sym, viva.t); seed.forEach((tr) => { const lv = Math.round(tr.p / tick) * tick; const e = viva.mapa.get(lv) || { bid: 0, ask: 0 }; if (tr.venta) e.bid += tr.q; else e.ask += tr.q; viva.mapa.set(lv, e); }); } catch (_) {}
      wait.style.display = 'none';
      pintarBar(); chart.arrancar();
      abrirStream();
    } catch (e) {
      if (!inicial && chart.S.velas.length) { toast('Could not refresh. Showing last data.'); return; }
      wait.style.display = 'flex';
      wait.innerHTML = `<b>Could not reach Binance right now.</b><span>The feed may be busy or blocked by the network. Check the connection and retry.</span><button class="of-retry" id="of-retry">Retry</button>`;
      const b = $('#of-retry'); if (b) b.onclick = () => { wait.innerHTML = `<div class="of-spin"></div><b>Connecting to the live tape</b>`; cargar(true); };
    }
  }

  function abrirStream() {
    try { flujo && flujo.cerrar(); } catch (_) {}
    flujo = abrirFlujos(sym, {
      onTrade: (tr) => {
        if (destruido) return;
        const velas = chart.S.velas; let viva = velas[velas.length - 1];
        // rodar de vela si el tape cruzo al siguiente periodo
        while (tr.T >= viva.t + intervalMs) {
          viva.cerrada = true; viva._filas = null;              // se recalcula una vez al cerrarse
          const nt = viva.t + intervalMs;
          viva = { ...velaViva(nt, tr.p) };
          velas.push(viva); if (velas.length > MAXV) velas.shift();
        }
        acumular(viva, tr, chart.S.tick);
        chart.S.precio = tr.p;
        tape.push(tr); if (tape.length > 800) tape.splice(0, tape.length - 800);
        // refresco ligero de cabecera (no cada tick)
        if (!reloj || Date.now() - reloj > 120) { reloj = Date.now(); pintarBar(); }
      },
      onDepth: (bids, asks) => {
        if (destruido) return;
        chart.S.dom = { bids, asks };
        chart.S.met = metricasLibro(bids, asks, tape.slice(-600));
      },
      onEstado: estadoLive
    });
  }

  function par0name(s) { const p = PARES.find((x) => x.s === s); return p ? p.n : s; }

  // ---- controles ----
  const coin = $('#of-coin'), menu = $('#of-menu');
  coin.addEventListener('click', (e) => { if (e.target.closest('.of-it')) return; e.stopPropagation(); menu.classList.toggle('open'); });
  menu.querySelectorAll('.of-it').forEach((b) => b.onclick = (e) => {
    e.stopPropagation(); menu.classList.remove('open'); const ns = b.dataset.sym; if (ns === sym) return;
    sym = ns; lset('of-sym', sym); const p = PARES.find((x) => x.s === sym);
    $('#of-sym').textContent = sym; $('#of-name').innerHTML = esc(p.n) + ' ' + MID + ' Binance'; $('#of-ico').style.backgroundImage = `url('${logoURL(p.c)}')`;
    menu.querySelectorAll('.of-it').forEach((x) => x.classList.toggle('on', x === b));
    tape = []; cargar(true);
  });

  const tfdd = $('#of-tf');
  $('#of-tfcur').onclick = (e) => { e.stopPropagation(); tfdd.classList.toggle('open'); };
  tfdd.querySelector('.menu').addEventListener('click', (e) => { const b = e.target.closest('[data-tf]'); if (!b) return; tfdd.classList.remove('open'); if (b.dataset.tf === tf) return; tf = b.dataset.tf; lset('of-tf', tf); tfdd.querySelectorAll('[data-tf]').forEach((x) => x.classList.toggle('on', x === b)); $('#of-tfcur').childNodes[0].nodeValue = (TFS.find((t) => t[0] === tf) || TFS[1])[1] + ' '; tape = []; cargar(true); });
  document.addEventListener('click', cerrarMenus);
  function cerrarMenus(e) { if (!coin.contains(e.target)) menu.classList.remove('open'); if (!tfdd.contains(e.target)) tfdd.classList.remove('open'); }

  function cerrar() { destruido = true; try { flujo && flujo.cerrar(); } catch (_) {} try { chart.destruir(); } catch (_) {} document.removeEventListener('click', cerrarMenus); try { ov.remove(); } catch (_) {} }
  $('#of-back').onclick = cerrar;
  $('#of-how').onclick = abrirComo;

  function abrirComo() {
    const old = ov.querySelector('#of-modal'); if (old) old.remove();
    const m = document.createElement('div'); m.className = 'of-modal'; m.id = 'of-modal';
    m.innerHTML = `
      <div class="of-modal-bg"></div>
      <div class="of-modal-card">
        <button class="of-modal-x" aria-label="Close">${ICO.x}</button>
        <h2>Order flow, in plain words</h2>
        <p>The chart lives. Every candle shows, to its right, the volume profile of what actually traded at each price: long bars where there was more negotiation, short where there was less. Blue is where buyers dominated, red where sellers did.</p>
        <ul>
          <li><b>Imbalances:</b> the diagonal gaps that did not resolve. When one side is at least three times the opposite one tick away, it is outlined; stacked, it becomes a zone that extends right until price trades back.</li>
          <li><b>Value area and POC:</b> the band holding 70% of the candle volume and the single most traded level.</li>
          <li><b>DOM:</b> the live order book, ask on the right, bid on the left, with its resting walls. OBI, VPIN and spoof pressure are read from it in real time.</li>
          <li><b>Delta table:</b> volume, delta, delta percent and session delta, candle by candle.</li>
        </ul>
        <p class="of-note">Live public data from Binance. Educational tool, not financial advice.</p>
      </div>`;
    ov.appendChild(m); requestAnimationFrame(() => m.classList.add('on'));
    const q = () => { m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 160); };
    m.querySelector('.of-modal-x').onclick = q; m.querySelector('.of-modal-bg').onclick = q;
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('of-overlay')) chart.dibujar(); });
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
.of-bar{display:flex;align-items:center;gap:12px;padding:0 12px;height:52px;flex:none;position:relative;background:linear-gradient(180deg,#0c111a,#070a0e);border-bottom:1px solid var(--line);overflow:visible}
.of-bar::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,184,75,.5),transparent)}
.of-bk{width:34px;height:32px;flex:none;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:linear-gradient(180deg,#141a22,#0d1117);color:#cfd6df;cursor:pointer;padding:0}
.of-bk svg{width:17px;height:17px}.of-bk:hover{border-color:rgba(232,184,75,.5);color:var(--gold)}
.of-coin{position:relative;display:flex;align-items:center;gap:8px;flex:none;cursor:pointer;padding:3px 7px;border-radius:10px}
.of-coin:hover{background:rgba(255,255,255,.04)}
.of-ico{width:28px;height:28px;border-radius:50%;background:#1b2230 center/cover no-repeat;border:1px solid #2a3647;flex:none}
.of-nm{display:flex;flex-direction:column;line-height:1.12}
.of-nm b{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:800;font-size:15px}
.of-nm span{font-size:9px;color:#79838f;font-family:"IBM Plex Mono",monospace}
.of-cv{font-style:normal;color:#79838f;font-size:9px}
.of-menu{position:absolute;top:44px;left:0;z-index:60;min-width:210px;display:none;background:rgba(14,18,24,.98);backdrop-filter:blur(16px);border:1px solid #29313b;border-radius:13px;padding:6px;box-shadow:0 22px 56px rgba(0,0,0,.7)}
.of-coin .of-menu.open{display:block}
.of-grp{font-size:8.5px;letter-spacing:1.6px;color:#4a5561;font-weight:700;padding:7px 9px 5px}
.of-it{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:none;border:0;color:#cfd6df;padding:8px 9px;border-radius:9px;cursor:pointer;font-weight:700;font-size:12.5px}
.of-it:hover{background:rgba(255,255,255,.05)}.of-it.on{background:rgba(232,184,75,.08);color:#eaecef}
.of-ico2{width:22px;height:22px;border-radius:50%;background:#1b2230 center/cover no-repeat;border:1px solid #2a3647;flex:none}
.of-px{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:800;font-size:19px;color:var(--up);flex:none}
.of-px.dn{color:var(--dn)}
.of-chg{font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:700;color:var(--up);flex:none}.of-chg.dn{color:var(--dn)}
.of-dd{position:relative;flex:none}
.of-dd .cur{display:flex;align-items:center;gap:5px;background:#0d1117;border:1px solid var(--line);border-radius:9px;color:#eaecef;font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:700;padding:7px 11px;cursor:pointer;min-height:32px}
.of-dd .cur i{font-style:normal;color:#79838f;font-size:9px}.of-dd .cur:hover{border-color:rgba(232,184,75,.5)}
.of-dd .menu{position:absolute;top:38px;left:0;z-index:60;min-width:90px;display:none;background:rgba(16,20,26,.96);backdrop-filter:blur(14px);border:1px solid #29313b;border-radius:12px;padding:5px;box-shadow:0 22px 56px rgba(0,0,0,.7)}
.of-dd.open .menu{display:block}
.of-dd .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:#aeb6c0;font-weight:600;font-size:13px;padding:8px 11px;border-radius:9px;cursor:pointer}
.of-dd .menu button:hover{background:rgba(232,184,75,.1);color:#eaecef}.of-dd .menu button.on{color:var(--gold);background:rgba(232,184,75,.08)}
.of-tool{display:flex;flex-direction:column;line-height:1.1;padding-left:12px;margin-left:2px;border-left:1px solid var(--line)}
.of-tool b{font-size:12.5px;font-weight:800;letter-spacing:1.3px}
.of-tool span{font-size:8px;letter-spacing:1.2px;color:#4a5561;font-weight:700;margin-top:2px}
.of-right{margin-left:auto;display:flex;align-items:center;gap:8px;flex:none}
.of-live{display:flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid var(--line);border-radius:999px;background:#0d1117;font-size:10px;font-family:"IBM Plex Mono",monospace}
.of-live i{width:7px;height:7px;border-radius:50%;background:#2ee86a;animation:of-pulse 1.8s infinite}
.of-live b{color:#2ee86a;letter-spacing:.5px}.of-live em{color:#79838f;font-style:normal;border-left:1px solid var(--line);padding-left:6px}
.of-live.off i{background:#f6465d;animation:none}.of-live.off b{color:#ff8b96}
@keyframes of-pulse{0%{box-shadow:0 0 0 0 rgba(46,232,106,.5)}70%{box-shadow:0 0 0 7px rgba(46,232,106,0)}100%{box-shadow:0 0 0 0 rgba(46,232,106,0)}}
.of-ib{width:34px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:linear-gradient(180deg,#141a22,#0d1117);color:#cfd6df;cursor:pointer;padding:0}
.of-ib svg{width:17px;height:17px}.of-ib:hover{border-color:rgba(232,184,75,.5);color:var(--gold)}
.of-graf{flex:1;position:relative;min-height:0;background:#070a0f}
#of-cv{display:block;width:100%;height:100%;touch-action:none}
.of-marca{position:absolute;left:14px;bottom:30px;pointer-events:none;height:30px;width:auto;opacity:.5;filter:drop-shadow(0 2px 6px rgba(0,0,0,.85));z-index:2;user-select:none}
.of-wait{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(7,10,15,.78);text-align:center;padding:24px}
.of-wait b{font-size:14px}.of-wait span{font-size:12px;color:#79838f;max-width:340px;line-height:1.5}
.of-spin{width:34px;height:34px;border:3px solid rgba(232,184,75,.2);border-top-color:var(--gold);border-radius:50%;animation:of-spin .9s linear infinite}
@keyframes of-spin{to{transform:rotate(360deg)}}
.of-retry{margin-top:4px;padding:8px 18px;border:1px solid rgba(232,184,75,.5);border-radius:10px;background:rgba(232,184,75,.12);color:var(--gold);font-weight:700;cursor:pointer}
.of-toast{position:absolute;left:50%;bottom:16px;transform:translateX(-50%) translateY(10px);z-index:6;pointer-events:none;background:rgba(16,20,26,.96);border:1px solid var(--line);color:#eaecef;font-size:12px;padding:9px 14px;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.5);opacity:0;transition:opacity .18s,transform .18s;max-width:84%;text-align:center}
.of-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
.of-modal{position:absolute;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .16s}.of-modal.on{opacity:1}
.of-modal-bg{position:absolute;inset:0;background:rgba(5,7,10,.72);backdrop-filter:blur(3px)}
.of-modal-card{position:relative;max-width:540px;width:100%;max-height:86vh;overflow:auto;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,#0e131c,#0a0d13);padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.6);transform:translateY(8px);transition:transform .16s}
.of-modal.on .of-modal-card{transform:none}
.of-modal-x{position:absolute;top:12px;right:12px;width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:#0d1117;color:#cfd6df;cursor:pointer}
.of-modal-card h2{font-family:"Chakra Petch",system-ui,sans-serif;font-size:19px;margin:0 0 12px;color:var(--gold)}
.of-modal-card p{font-size:13px;line-height:1.6;color:#c2cad3;margin:0 0 10px}
.of-modal-card ul{margin:0 0 10px;padding-left:4px;list-style:none;display:flex;flex-direction:column;gap:7px}
.of-modal-card li{font-size:12.5px;line-height:1.5;color:#c2cad3;padding-left:14px;position:relative}
.of-modal-card li::before{content:"";position:absolute;left:0;top:7px;width:6px;height:6px;border-radius:50%;background:var(--gold)}
.of-note{font-size:11px;color:#6f7985;border-top:1px solid rgba(255,255,255,.05);padding-top:8px;margin-top:4px}
@media(max-width:900px){.of-bar{flex-wrap:wrap;height:auto;padding:8px 10px;gap:9px}.of-tool{display:none}.of-right{order:5}}
@media(max-width:560px){.of-nm span{display:none}.of-px{font-size:17px}.of-marca{height:24px;left:10px;bottom:24px}}`;
  document.head.appendChild(st);
}
