/* ══════════════════════════════════════════════════════════════
   structural/structural.js — Herramienta "Structural Logic".

   Port vivo del indicador Pine [ExagTrader] Structural logic V:1.0.
   Barra superior canónica (igual para todas), selector multimoneda
   (índices + cripto con logos), temporalidades 1m–1W, gráfica con las
   dos líneas de tendencia y las señales LONG/SHORT neón, y un panel
   derecho premium que dice la estructura y QUÉ HACER.
   ══════════════════════════════════════════════════════════════ */

import { crearChart } from './grafica.js?v=1';
import { traerVelas, logoCripto, SIMBOLOS, POR_DEFECTO, TFS } from './datos.js?v=1';
import { analizar, momentoMTF, rsi, PERIODO } from './motor.js?v=1';

const MARCA = new URL('../../../assets/img/cco-marca.webp', import.meta.url).href;
const ICO = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  how: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 0 1 4.6 1.2c0 1.7-2.1 2-2.1 3.3"/><path d="M12 17h.01"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (p) => (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : (p || 0).toFixed(p >= 1 ? 2 : 4));
const UP = String.fromCharCode(9650), DN = String.fromCharCode(9660);
const lget = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } };
const lset = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
const MOM = { sobrecompra: ['Overbought', 'ob'], sobreventa: ['Oversold', 'os'], estable: ['Neutral', 'nu'] };
const baseMin = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '1d': 1440, '1w': 10080 };
function etiquetaTF(min) { if (min < 60) return min + 'm'; if (min < 1440) return (min / 60) + 'h'; if (min < 10080) return Math.round(min / 1440) + 'D'; return Math.round(min / 10080) + 'W'; }

export async function abrirStructural() {
  inyectarCSS();
  const prev = document.getElementById('sl-overlay'); if (prev) prev.remove();
  const ov = document.createElement('div'); ov.id = 'sl-overlay';
  let sim = SIMBOLOS.find((s) => s.id === lget('sl-sim', POR_DEFECTO)) || SIMBOLOS[0];
  let tf = lget('sl-tf', '1d'); if (!TFS.some((t) => t[0] === tf)) tf = '1d';

  ov.innerHTML = `
    <header class="sl-bar">
      <button class="sl-bk" id="sl-back" aria-label="Back">${ICO.back}</button>
      <div class="sl-coin" id="sl-coin" tabindex="0">
        <span class="sl-ico" id="sl-ico"></span>
        <div class="sl-nm"><b id="sl-nm">S&P 500</b><span id="sl-sub">Structural Logic</span></div>
        <i class="sl-ca">${String.fromCharCode(9662)}</i>
        <div class="sl-menu" id="sl-menu">
          <div class="sl-search">${ICO.search}<input id="sl-q" placeholder="Search index or coin" autocomplete="off"></div>
          <div class="sl-list" id="sl-list"></div>
        </div>
      </div>
      <span class="sl-px" id="sl-px">...</span>
      <div class="sl-dd" id="sl-tf">
        <button class="cur" id="sl-tfcur">${(TFS.find((t) => t[0] === tf) || TFS[5])[1]} <i>${String.fromCharCode(9662)}</i></button>
        <div class="menu">${TFS.map((t) => `<button data-tf="${t[0]}"${t[0] === tf ? ' class="on"' : ''}>${t[1]}</button>`).join('')}</div>
      </div>
      <div class="col"><span class="l">Change</span><b class="v" id="sl-chg">...</b></div>
      <div class="col"><span class="l">Structure</span><b class="v" id="sl-str">...</b></div>
      <div class="col"><span class="l">Signal</span><b class="v" id="sl-sig">...</b></div>
      <div class="col hide-sm"><span class="l">RSI</span><b class="v" id="sl-rsi">...</b></div>
      <div class="sl-right">
        <div class="sl-live" id="sl-live"><i></i><b>...</b></div>
        <button class="sl-ib" id="sl-how" title="How it works">${ICO.how}</button>
      </div>
    </header>
    <div class="sl-main">
      <div class="sl-graf" id="sl-graf"><canvas id="sl-cv"></canvas><img class="sl-marca" src="${MARCA}" alt="">
        <div class="sl-wait" id="sl-wait"><div class="sl-spin"></div><b>Loading market data</b></div>
      </div>
      <aside class="sl-side">
        <section class="sl-card" id="sl-struct"></section>
        <section class="sl-card sl-signal" id="sl-signal"></section>
        <section class="sl-card" id="sl-mom"></section>
        <p class="sl-foot">Structural Logic reads live price structure. Educational tool, not investment advice.</p>
      </aside>
    </div>`;
  document.body.appendChild(ov);

  const $ = (s) => ov.querySelector(s);
  const cv = $('#sl-cv'), cont = $('#sl-graf'), wait = $('#sl-wait');
  const chart = crearChart(cv, cont);
  let animOn = false;

  function toast(msg) { let t = ov.querySelector('.sl-toast'); if (!t) { t = document.createElement('div'); t.className = 'sl-toast'; cont.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2800); }

  /* ── logos ── */
  function badge(el, s) { el.className = 'sl-ico sl-badge ' + (s.tipo === 'Crypto' ? 'cr' : 'ix'); el.textContent = s.corto.slice(0, 4); el.style.backgroundImage = ''; }
  function aplicarLogo(el, s) {
    badge(el, s);
    if (s.tipo === 'Crypto' && s.cg) {
      logoCripto(s.cg).then((url) => { if (url) { el.textContent = ''; el.className = 'sl-ico sl-img'; el.style.backgroundImage = `url("${url}")`; } }).catch(() => {});
    }
  }

  /* ── cabecera: precio, cambio, estructura, señal, rsi ── */
  function pintarBar(velas, E, rsiUlt) {
    if (!velas.length) return;
    const last = velas[velas.length - 1], prev = velas.length > 1 ? velas[velas.length - 2].c : last.o;
    const chg = prev ? ((last.c - prev) / prev) * 100 : 0;
    const px = $('#sl-px'); px.textContent = fmt(last.c); px.className = 'sl-px ' + (chg >= 0 ? 'up' : 'dn');
    const cE = $('#sl-chg'); cE.textContent = (chg >= 0 ? UP : DN) + ' ' + Math.abs(chg).toFixed(2) + '%'; cE.className = 'v ' + (chg >= 0 ? 'up' : 'dn');
    const st = $('#sl-str'); const S = E.sesgo; st.textContent = S === 'alcista' ? 'Bullish' : S === 'bajista' ? 'Bearish' : S === 'mixto' ? 'Mixed' : 'Range'; st.className = 'v ' + (S === 'alcista' ? 'up' : S === 'bajista' ? 'dn' : '');
    const sg = $('#sl-sig'); const u = E.ultima; sg.textContent = u ? u.tipo : '—'; sg.className = 'v ' + (u ? (u.tipo === 'LONG' ? 'up' : 'dn') : '');
    const r = $('#sl-rsi'); r.textContent = isFinite(rsiUlt) ? rsiUlt.toFixed(0) : '--'; r.className = 'v ' + (rsiUlt >= 70 ? 'dn' : rsiUlt <= 30 ? 'up' : '');
  }
  function pintarLive() { const el = $('#sl-live'); if (!el) return; el.innerHTML = `<i></i><b>LIVE</b><em>${esc(chart.S.fuente || '')}</em>`; }

  /* ── panel derecho ── */
  function pintarPanel(E, velas, mtf) {
    // estructura
    const se = $('#sl-struct');
    const chip = E.sesgo === 'alcista' ? ['Bullish structure', 'bull'] : E.sesgo === 'bajista' ? ['Bearish structure', 'bear'] : E.sesgo === 'mixto' ? ['Losing structure', 'neu'] : ['Range', 'neu'];
    const px = E.precio;
    // Niveles por POSICIÓN (no por rol): una línea rota se proyecta al lado contrario,
    // así que resistencia = lo más cercano por ARRIBA, soporte = lo más cercano por ABAJO.
    const cand = [];
    if (E.resistenciaHoy) cand.push(E.resistenciaHoy);
    if (E.soporteHoy) cand.push(E.soporteHoy);
    (E.pivotsH || []).slice(-5).forEach((p) => cand.push(p.price));
    (E.pivotsL || []).slice(-5).forEach((p) => cand.push(p.price));
    const overhead = cand.filter((v) => v > px * 1.0004).sort((a, b) => a - b);
    const below = cand.filter((v) => v < px * 0.9996).sort((a, b) => b - a);
    const res = overhead.length ? overhead[0] : null, sop = below.length ? below[0] : null;
    const dRes = res ? ((res - px) / px * 100) : null, dSop = sop ? ((px - sop) / px * 100) : null;
    se.innerHTML = `<div class="sl-readtop"><h3 class="sl-h">Structure</h3><span class="sl-chip sl-chip-${chip[1]}">${chip[0]}</span></div>
      <div class="sl-lv">
        <div class="sl-lvrow res"><span>Resistance</span><b>${res ? fmt(res) : '—'}</b><em>${dRes != null ? (dRes >= 0 ? '+' : '') + dRes.toFixed(2) + '%' : ''}</em></div>
        <div class="sl-lvrow px"><span>Price</span><b>${fmt(px)}</b><em></em></div>
        <div class="sl-lvrow sop"><span>Support</span><b>${sop ? fmt(sop) : '—'}</b><em>${dSop != null ? '−' + Math.abs(dSop).toFixed(2) + '%' : ''}</em></div>
      </div>`;

    // señal + qué hacer
    const sg = $('#sl-signal'); const u = E.ultima;
    let tono = 'neu', titulo = 'No active break', texto = '';
    if (u && E.sesgo === 'alcista') { tono = 'long'; titulo = 'LONG — structure flipped up'; texto = `Price broke the descending resistance at <b>${fmt(u.nivel)}</b>. Bias is long while it holds above that level; a close back below weakens it.`; }
    else if (u && E.sesgo === 'bajista') { tono = 'short'; titulo = 'SHORT — structure flipped down'; texto = `Price broke the ascending support at <b>${fmt(u.nivel)}</b>. Bias is short while it stays below that level; a close back above weakens it.`; }
    else if (u) { tono = 'neu'; titulo = `Last signal: ${u.tipo} at ${fmt(u.nivel)}`; texto = `Price has moved back through the ${u.tipo === 'LONG' ? 'long' : 'short'} level — structure is no longer clean. Wait for the next break of ${res ? 'resistance ' + fmt(res) : 'resistance'} or ${sop ? 'support ' + fmt(sop) : 'support'}.`; }
    else { texto = `No trendline break yet. Price is working between ${sop ? 'support <b>' + fmt(sop) + '</b>' : 'support'} and ${res ? 'resistance <b>' + fmt(res) + '</b>' : 'resistance'}. The signal fires on the break.`; }
    sg.className = 'sl-card sl-signal ' + tono;
    sg.innerHTML = `<div class="sl-sgtop"><span class="sl-dot"></span><h3 class="sl-h">${esc(titulo)}</h3></div>
      <p class="sl-say">${texto}</p>
      <p class="sl-na">This is not investment advice.</p>`;

    // momento multi-temporalidad
    const mm = $('#sl-mom');
    const bm = baseMin[tf] || 1;
    const rows = mtf.map((m) => {
      const lab = etiquetaTF(bm * m.factor);
      const re = MOM[m.rsiEstado], ste = MOM[m.stochEstado];
      return `<div class="sl-mtr"><span>${lab}</span>
        <b class="m-${re[1]}">${isFinite(m.rsi) ? m.rsi.toFixed(0) : '--'}</b>
        <b class="m-${ste[1]}">${isFinite(m.stoch) ? m.stoch.toFixed(0) : '--'}</b></div>`;
    }).join('');
    mm.innerHTML = `<h3 class="sl-h">Momentum ${String.fromCharCode(183)} multi-timeframe</h3>
      <div class="sl-mtable"><div class="sl-mtr sl-mth"><span>TF</span><b>RSI</b><b>Stoch</b></div>${rows}</div>
      <p class="sl-note">Green = oversold (room up), red = overbought (room down). RSI 14 and Stochastic 14, read across timeframes for alignment.</p>`;
  }

  async function cargar(inicial) {
    try {
      if (inicial) { wait.style.display = 'flex'; wait.innerHTML = `<div class="sl-spin"></div><b>Loading ${esc(sim.n)}</b>`; }
      $('#sl-nm').textContent = sim.n; $('#sl-sub').textContent = sim.corto + ' ' + String.fromCharCode(183) + ' Structural Logic';
      aplicarLogo($('#sl-ico'), sim);
      const r = await traerVelas(sim, tf);
      const velas = r.velas;
      if (!velas || velas.length < 40) throw new Error('poca historia');
      wait.style.display = 'none';
      chart.S.velas = velas; chart.S.tf = tf; chart.S.precio = velas[velas.length - 1].c; chart.S.fuente = r.fuente;
      const E = analizar(velas, { period: PERIODO }); chart.S.estructura = E;
      const rl = rsi(velas); const rsiUlt = rl.length ? rl[rl.length - 1] : NaN;
      const mtf = momentoMTF(velas, [1, 4, 12]);
      chart.dibujar(); pintarBar(velas, E, rsiUlt); pintarPanel(E, velas, mtf); pintarLive();
      arrancarAnim();
    } catch (e) {
      wait.style.display = 'flex';
      wait.innerHTML = `<b>Could not load the data right now.</b><span>The feed may be busy. Try again in a moment.</span><button class="sl-retry" id="sl-retry">Retry</button>`;
      const b = $('#sl-retry'); if (b) b.onclick = () => cargar(true);
    }
  }
  function arrancarAnim() { if (animOn) return; animOn = true; const paso = () => { if (!document.getElementById('sl-overlay')) { animOn = false; return; } if (!document.hidden) chart.dibujar(); setTimeout(() => requestAnimationFrame(paso), 80); }; requestAnimationFrame(paso); }

  /* ── selector de símbolo ── */
  function pintarLista(q) {
    const list = $('#sl-list'); const term = (q || '').trim().toLowerCase();
    const items = SIMBOLOS.filter((s) => !term || s.n.toLowerCase().includes(term) || s.corto.toLowerCase().includes(term));
    const grupo = (tipo) => items.filter((s) => s.tipo === tipo);
    const render = (arr) => arr.map((s) => `<button class="sl-item${s.id === sim.id ? ' on' : ''}" data-id="${s.id}"><span class="sl-ico2" data-ico="${s.id}">${s.corto.slice(0, 4)}</span><span class="sl-it-nm"><b>${esc(s.n)}</b><em>${esc(s.corto)}</em></span></button>`).join('');
    const ix = grupo('Index'), cr = grupo('Crypto');
    list.innerHTML = (ix.length ? `<div class="sl-gh">Indices</div>${render(ix)}` : '') + (cr.length ? `<div class="sl-gh">Crypto</div>${render(cr)}` : '') || `<div class="sl-empty">No match</div>`;
    list.querySelectorAll('.sl-item').forEach((b) => {
      b.onclick = () => { const s = SIMBOLOS.find((x) => x.id === b.dataset.id); if (!s) return; sim = s; lset('sl-sim', s.id); cerrarMenu(); cargar(true); };
      const icoEl = b.querySelector('.sl-ico2'); const s = SIMBOLOS.find((x) => x.id === b.dataset.id);
      if (s && s.tipo === 'Crypto' && s.cg) logoCripto(s.cg).then((url) => { if (url) { icoEl.textContent = ''; icoEl.classList.add('img'); icoEl.style.backgroundImage = `url("${url}")`; } }).catch(() => {});
      else if (s) icoEl.classList.add(s.tipo === 'Crypto' ? 'cr' : 'ix');
    });
  }
  const coin = $('#sl-coin'), menu = $('#sl-menu'), q = $('#sl-q');
  function abrirMenu() { coin.classList.add('open'); pintarLista(q.value); setTimeout(() => q.focus(), 30); }
  function cerrarMenu() { coin.classList.remove('open'); }
  coin.addEventListener('click', (e) => { if (e.target.closest('.sl-menu')) return; coin.classList.contains('open') ? cerrarMenu() : abrirMenu(); });
  q.addEventListener('input', () => pintarLista(q.value));
  q.addEventListener('click', (e) => e.stopPropagation());

  /* ── temporalidad ── */
  const tfdd = $('#sl-tf');
  $('#sl-tfcur').onclick = (e) => { e.stopPropagation(); tfdd.classList.toggle('open'); };
  tfdd.querySelector('.menu').addEventListener('click', (e) => { const b = e.target.closest('[data-tf]'); if (!b) return; tfdd.classList.remove('open'); if (b.dataset.tf === tf) return; tf = b.dataset.tf; lset('sl-tf', tf); tfdd.querySelectorAll('[data-tf]').forEach((x) => x.classList.toggle('on', x === b)); $('#sl-tfcur').childNodes[0].nodeValue = (TFS.find((t) => t[0] === tf) || TFS[5])[1] + ' '; cargar(true); });
  document.addEventListener('click', (e) => { if (!tfdd.contains(e.target)) tfdd.classList.remove('open'); if (!coin.contains(e.target)) cerrarMenu(); });

  const cerrar = () => { try { chart.destruir(); } catch (_) {} try { ov.remove(); } catch (_) {} };
  $('#sl-back').onclick = cerrar;
  $('#sl-how').onclick = abrirComo;
  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('sl-overlay')) chart.dibujar(); });

  function abrirComo() {
    const old = ov.querySelector('#sl-modal'); if (old) old.remove();
    const m = document.createElement('div'); m.className = 'sl-modal'; m.id = 'sl-modal';
    m.innerHTML = `<div class="sl-modal-bg"></div><div class="sl-modal-card">
      <button class="sl-modal-x" aria-label="Close">${ICO.x}</button>
      <h2>Structural Logic, in plain words</h2>
      <p>The engine reads the market's own structure: it finds the swing highs and lows, draws the <b>descending resistance</b> and the <b>ascending support</b> that contain price, and projects them forward.</p>
      <ul>
        <li><b>LONG</b> fires when price breaks up through the resistance — structure flips bullish.</li>
        <li><b>SHORT</b> fires when price breaks down through the support — structure flips bearish.</li>
        <li><b>The panel</b> tells you the current structure, the exact level to watch, and what the break means.</li>
        <li><b>Momentum</b> shows RSI and Stochastic across timeframes, so you see when the move is aligned.</li>
      </ul>
      <p class="sl-note">Levels and signals are context, not a guarantee. Educational only, not investment advice.</p></div>`;
    ov.appendChild(m); requestAnimationFrame(() => m.classList.add('on'));
    const close = () => { m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 160); };
    m.querySelector('.sl-modal-x').onclick = close; m.querySelector('.sl-modal-bg').onclick = close;
  }

  await cargar(true);
}

function inyectarCSS() {
  if (document.getElementById('sl-css')) return;
  const st = document.createElement('style'); st.id = 'sl-css';
  st.textContent = `
#sl-overlay{position:fixed;inset:0;z-index:40050;display:flex;flex-direction:column;background:#05070a;color:#eaecef;
  --gold:#E8B84B;--line:#1c232b;--surf:#0b0f16;--up:#2ebd85;--dn:#f6465d;--long:#2ee86a;--short:#ff5b6e;
  font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#sl-overlay *{box-sizing:border-box}
.sl-bar{display:flex;align-items:center;gap:12px;padding:0 12px;height:52px;flex:none;position:relative;background:linear-gradient(180deg,#0c111a,#070a0e);border-bottom:1px solid var(--line);overflow:visible}
.sl-bar::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,184,75,.5),transparent)}
.sl-bk{width:34px;height:32px;flex:none;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:linear-gradient(180deg,#141a22,#0d1117);color:#cfd6df;cursor:pointer;padding:0}
.sl-bk svg{width:17px;height:17px}.sl-bk:hover{border-color:rgba(232,184,75,.5);color:var(--gold)}
.sl-coin{display:flex;align-items:center;gap:8px;flex:none;position:relative;cursor:pointer;padding:3px 8px 3px 3px;border:1px solid transparent;border-radius:10px}
.sl-coin:hover{border-color:var(--line);background:#0c1119}
.sl-ico{width:28px;height:28px;border-radius:50%;flex:none;display:grid;place-items:center;font-family:"IBM Plex Mono",monospace;font-size:8.5px;font-weight:800;background-size:cover;background-position:center}
.sl-badge.ix{color:#0a0d13;background:radial-gradient(circle at 30% 30%,#f2d487,#E8B84B);border:1px solid #caa23f}
.sl-badge.cr{color:var(--gold);background:radial-gradient(circle at 30% 30%,#223049,#121826);border:1px solid #2a3647}
.sl-badge#sl-ico{box-shadow:0 0 0 1px rgba(232,184,75,.25)}
.sl-img{border:1px solid #2a3647}
.sl-coin .sl-nm{display:flex;flex-direction:column;line-height:1.12}
.sl-coin .sl-nm b{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:800;font-size:15px}
.sl-coin .sl-nm span{font-size:9px;color:#79838f;font-family:"IBM Plex Mono",monospace;white-space:nowrap}
.sl-ca{font-style:normal;color:#79838f;font-size:9px}
.sl-menu{position:absolute;top:44px;left:0;z-index:70;width:280px;display:none;background:rgba(14,18,24,.98);backdrop-filter:blur(14px);border:1px solid #29313b;border-radius:13px;padding:8px;box-shadow:0 26px 64px rgba(0,0,0,.72);cursor:default}
.sl-coin.open .sl-menu{display:block}
.sl-search{display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:#0a0e14;margin-bottom:7px}
.sl-search svg{width:15px;height:15px;color:#79838f;flex:none}
.sl-search input{flex:1;background:none;border:0;outline:0;color:#eaecef;font-size:13px;font-family:inherit}
.sl-list{max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:2px}
.sl-gh{font-family:"IBM Plex Mono",monospace;font-size:9px;letter-spacing:.6px;text-transform:uppercase;color:#5f6974;padding:7px 8px 3px}
.sl-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:0;border-radius:9px;padding:8px 9px;cursor:pointer}
.sl-item:hover{background:rgba(232,184,75,.08)}.sl-item.on{background:rgba(232,184,75,.12)}
.sl-ico2{width:24px;height:24px;border-radius:50%;flex:none;display:grid;place-items:center;font-family:"IBM Plex Mono",monospace;font-size:7.5px;font-weight:800;color:#aeb6c0;background:#1a222e;background-size:cover;background-position:center}
.sl-ico2.ix{color:#0a0d13;background:radial-gradient(circle at 30% 30%,#f2d487,#E8B84B)}
.sl-ico2.cr{color:var(--gold);background:radial-gradient(circle at 30% 30%,#223049,#121826)}
.sl-it-nm{display:flex;flex-direction:column;line-height:1.2}
.sl-it-nm b{font-size:13px;color:#eaecef;font-weight:700}.sl-it-nm em{font-style:normal;font-size:10px;color:#79838f;font-family:"IBM Plex Mono",monospace}
.sl-empty{padding:16px;text-align:center;color:#5f6974;font-size:12px}
.sl-px{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:800;font-size:19px;color:var(--up);flex:none}
.sl-px.dn{color:var(--dn)}
.sl-dd{position:relative;flex:none}
.sl-dd .cur{display:flex;align-items:center;gap:5px;background:#0d1117;border:1px solid var(--line);border-radius:9px;color:#eaecef;font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:700;padding:7px 11px;cursor:pointer;min-height:32px}
.sl-dd .cur i{font-style:normal;color:#79838f;font-size:9px}.sl-dd .cur:hover{border-color:rgba(232,184,75,.5)}
.sl-dd .menu{position:absolute;top:38px;left:0;z-index:60;min-width:110px;display:none;background:rgba(16,20,26,.96);backdrop-filter:blur(14px);border:1px solid #29313b;border-radius:12px;padding:5px;box-shadow:0 22px 56px rgba(0,0,0,.7)}
.sl-dd.open .menu{display:block}
.sl-dd .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:#aeb6c0;font-weight:600;font-size:13px;padding:8px 11px;border-radius:9px;cursor:pointer}
.sl-dd .menu button:hover{background:rgba(232,184,75,.1);color:#eaecef}.sl-dd .menu button.on{color:var(--gold);background:rgba(232,184,75,.08)}
.sl-bar .col{flex:none;display:flex;flex-direction:column;line-height:1.25;white-space:nowrap}
.sl-bar .col .l{font-family:"IBM Plex Mono",monospace;font-size:9px;color:#79838f;margin-bottom:2px}
.sl-bar .col .v{font-family:"IBM Plex Mono",monospace;font-size:12px;color:#eaecef;font-weight:600}
.sl-bar .col .v.up{color:var(--up)}.sl-bar .col .v.dn{color:var(--dn)}
.sl-right{margin-left:auto;display:flex;align-items:center;gap:7px;flex:none}
.sl-live{display:flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid var(--line);border-radius:999px;background:#0d1117;font-size:10px;font-family:"IBM Plex Mono",monospace}
.sl-live i{width:7px;height:7px;border-radius:50%;background:#2ee86a;animation:sl-pulse 1.8s infinite}
.sl-live b{color:#2ee86a;letter-spacing:.5px}.sl-live em{color:#79838f;font-style:normal;border-left:1px solid var(--line);padding-left:6px}
@keyframes sl-pulse{0%{box-shadow:0 0 0 0 rgba(46,232,106,.5)}70%{box-shadow:0 0 0 7px rgba(46,232,106,0)}100%{box-shadow:0 0 0 0 rgba(46,232,106,0)}}
.sl-ib{width:34px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:linear-gradient(180deg,#141a22,#0d1117);color:#cfd6df;cursor:pointer;padding:0}
.sl-ib svg{width:17px;height:17px}.sl-ib:hover{border-color:rgba(232,184,75,.5);color:var(--gold)}
.sl-main{flex:1;display:flex;min-height:0}
.sl-graf{flex:1;position:relative;min-width:0;background:var(--surf)}
#sl-cv{display:block;width:100%;height:100%;touch-action:none}
.sl-marca{position:absolute;left:14px;bottom:30px;pointer-events:none;height:32px;width:auto;opacity:.5;filter:drop-shadow(0 2px 6px rgba(0,0,0,.85));z-index:2;user-select:none}
.sl-wait{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(5,7,10,.72);text-align:center;padding:24px}
.sl-wait b{font-size:14px}.sl-wait span{font-size:12px;color:#79838f;max-width:320px;line-height:1.5}
.sl-spin{width:34px;height:34px;border:3px solid rgba(232,184,75,.2);border-top-color:var(--gold);border-radius:50%;animation:sl-spin .9s linear infinite}
@keyframes sl-spin{to{transform:rotate(360deg)}}
.sl-retry{margin-top:4px;padding:8px 18px;border:1px solid rgba(232,184,75,.5);border-radius:10px;background:rgba(232,184,75,.12);color:var(--gold);font-weight:700;cursor:pointer}
.sl-toast{position:absolute;left:50%;bottom:16px;transform:translateX(-50%) translateY(10px);z-index:6;pointer-events:none;background:rgba(16,20,26,.96);border:1px solid var(--line);color:#eaecef;font-size:12px;padding:9px 14px;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.5);opacity:0;transition:opacity .18s,transform .18s;max-width:84%;text-align:center}
.sl-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
.sl-side{width:340px;flex:none;border-left:1px solid var(--line);overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px;background:#080b10}
.sl-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:linear-gradient(180deg,#0c111a,#0a0d13)}
.sl-h{margin:0;font-family:"Chakra Petch",system-ui,sans-serif;font-size:13px;letter-spacing:.4px;text-transform:uppercase;color:#cfd6df}
.sl-readtop{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:11px}
.sl-chip{font-size:10px;font-weight:800;letter-spacing:.3px;padding:4px 9px;border-radius:999px;font-family:"IBM Plex Mono",monospace;flex:none}
.sl-chip-bull{background:rgba(46,232,106,.16);color:#2ee86a}.sl-chip-bear{background:rgba(255,91,110,.16);color:#ff6b7a}.sl-chip-neu{background:rgba(255,255,255,.08);color:#aeb6c0}
.sl-lv{display:flex;flex-direction:column;gap:6px}
.sl-lvrow{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:#0a0e14}
.sl-lvrow span{font-size:11px;color:#9aa4af;font-family:"IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.4px}
.sl-lvrow b{font-family:"Chakra Petch",system-ui,sans-serif;font-size:14px;font-weight:800}
.sl-lvrow em{font-style:normal;font-family:"IBM Plex Mono",monospace;font-size:10px;color:#79838f}
.sl-lvrow.res{border-left:2px solid var(--short)}.sl-lvrow.res b{color:#ff8a95}
.sl-lvrow.sop{border-left:2px solid var(--long)}.sl-lvrow.sop b{color:#6ff0ad}
.sl-lvrow.px{border-left:2px solid var(--gold)}.sl-lvrow.px b{color:var(--gold)}
.sl-signal{position:relative;overflow:hidden}
.sl-sgtop{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.sl-dot{width:9px;height:9px;border-radius:50%;background:#5a636e;flex:none}
.sl-signal.long{border-color:rgba(46,232,106,.4);background:linear-gradient(180deg,rgba(46,232,106,.08),#0a0d13)}
.sl-signal.long .sl-dot{background:var(--long);box-shadow:0 0 10px rgba(46,232,106,.9);animation:sl-glow 1.6s infinite}
.sl-signal.long .sl-h{color:#8ff4bd}
.sl-signal.short{border-color:rgba(255,91,110,.4);background:linear-gradient(180deg,rgba(255,91,110,.08),#0a0d13)}
.sl-signal.short .sl-dot{background:var(--short);box-shadow:0 0 10px rgba(255,91,110,.9);animation:sl-glow 1.6s infinite}
.sl-signal.short .sl-h{color:#ff9aa4}
@keyframes sl-glow{0%,100%{opacity:1}50%{opacity:.4}}
.sl-say{font-size:12.5px;line-height:1.6;color:#c2cad3;margin:0}.sl-say b{color:#fff;font-weight:700}
.sl-na{font-size:10.5px;color:#6f7985;margin:10px 0 0;border-top:1px solid rgba(255,255,255,.05);padding-top:8px}
.sl-mtable{border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-top:11px}
.sl-mtr{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;gap:6px;padding:9px 12px;font-family:"IBM Plex Mono",monospace;font-size:13px;border-top:1px solid rgba(255,255,255,.04)}
.sl-mtr:first-child{border-top:0}
.sl-mtr span{color:#aeb6c0}.sl-mtr b{text-align:right;font-weight:700}
.sl-mth{background:rgba(255,255,255,.03)}.sl-mth span,.sl-mth b{color:#79838f;font-size:10px;font-weight:700;text-transform:uppercase}
.m-ob{color:#ff6b7a}.m-os{color:#2ee86a}.m-nu{color:#c2cad3}
.sl-note{font-size:11px;line-height:1.5;color:#6f7985;margin:8px 0 0}
.sl-foot{font-size:10.5px;color:#5f6974;line-height:1.5;margin:2px 2px 0;text-align:center}
.sl-modal{position:absolute;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .16s}.sl-modal.on{opacity:1}
.sl-modal-bg{position:absolute;inset:0;background:rgba(5,7,10,.72);backdrop-filter:blur(3px)}
.sl-modal-card{position:relative;max-width:540px;width:100%;max-height:86vh;overflow:auto;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,#0e131c,#0a0d13);padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.6);transform:translateY(8px);transition:transform .16s}
.sl-modal.on .sl-modal-card{transform:none}
.sl-modal-x{position:absolute;top:12px;right:12px;width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:#0d1117;color:#cfd6df;cursor:pointer}
.sl-modal-card h2{font-family:"Chakra Petch",system-ui,sans-serif;font-size:19px;margin:0 0 12px;color:var(--gold)}
.sl-modal-card p{font-size:13px;line-height:1.6;color:#c2cad3;margin:0 0 10px}
.sl-modal-card ul{margin:0 0 10px;padding-left:4px;list-style:none;display:flex;flex-direction:column;gap:7px}
.sl-modal-card li{font-size:12.5px;line-height:1.5;color:#c2cad3;padding-left:14px;position:relative}
.sl-modal-card li::before{content:"";position:absolute;left:0;top:7px;width:6px;height:6px;border-radius:50%;background:var(--gold)}
@media(max-width:900px){.sl-main{flex-direction:column}.sl-graf{height:52vh;flex:none}.sl-side{width:auto;border-left:none;border-top:1px solid var(--line)}.sl-bar{flex-wrap:wrap;height:auto;padding:8px 10px;gap:9px}.sl-bar .hide-sm{display:none}.sl-right{order:5}}
@media(max-width:560px){.sl-coin .sl-nm span{display:none}.sl-px{font-size:17px}.sl-graf{height:46vh}.sl-marca{height:26px;left:10px;bottom:24px}}`;
  document.head.appendChild(st);
}
