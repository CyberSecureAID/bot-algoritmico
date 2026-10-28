/* ══════════════════════════════════════════════════════════════
   structural/structural.js — Herramienta "Structural Logic".

   Port vivo del indicador Pine [ExagTrader] Structural logic V:1.0.
   Barra superior canónica (igual para todas), selector multimoneda
   (índices + cripto con logos), temporalidades 1m–1W, gráfica con las
   dos líneas de tendencia y las señales LONG/SHORT neón, y un panel
   derecho premium que dice la estructura y QUÉ HACER.
   ══════════════════════════════════════════════════════════════ */

import { crearChart } from './grafica.js?v=6';
import { traerVelas, logoCripto, SIMBOLOS, POR_DEFECTO, TFS } from './datos.js?v=6';
import { analizar, momentoMTF, backtest, LEN } from './motor.js?v=6';

const MARCA = new URL('../../../assets/img/cco-marca.webp', import.meta.url).href;
const ICO = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  how: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 0 1 4.6 1.2c0 1.7-2.1 2-2.1 3.3"/><path d="M12 17h.01"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  exp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M8 8l4-4 4 4"/><path d="M12 4v12"/></svg>'
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
  let tf = lget('sl-tf', '1h'); if (!TFS.some((t) => t[0] === tf)) tf = '1h';

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
      <div class="col"><span class="l">Trend</span><b class="v" id="sl-str">...</b></div>
      <div class="col"><span class="l">Signal</span><b class="v" id="sl-sig">...</b></div>
      <div class="col hide-sm"><span class="l">Conv</span><b class="v" id="sl-rsi">...</b></div>
      <div class="sl-right">
        <div class="sl-live" id="sl-live"><i></i><b>...</b></div>
        <button class="sl-ib" id="sl-export" title="Export as image">${ICO.exp}</button>
        <button class="sl-ib" id="sl-how" title="How it works">${ICO.how}</button>
      </div>
    </header>
    <div class="sl-main">
      <div class="sl-graf" id="sl-graf"><canvas id="sl-cv"></canvas>
        <div class="sl-wait" id="sl-wait"><div class="sl-spin"></div><b>Loading market data</b></div>
      </div>
      <aside class="sl-side">
        <section class="sl-card sl-pos" id="sl-struct"></section>
        <section class="sl-card sl-signal" id="sl-signal"></section>
        <section class="sl-card" id="sl-plan"></section>
        <section class="sl-card" id="sl-perf"></section>
        <section class="sl-card" id="sl-mom"></section>
        <p class="sl-foot">Structural Logic reads live price structure. Educational tool, not investment advice.</p>
      </aside>
    </div>`;
  document.body.appendChild(ov);

  const $ = (s) => ov.querySelector(s);
  const cv = $('#sl-cv'), cont = $('#sl-graf'), wait = $('#sl-wait');
  const chart = crearChart(cv, cont); chart.S.marcaUrl = MARCA;
  let animOn = false, velasActuales = [];

  function toast(msg) { let t = ov.querySelector('.sl-toast'); if (!t) { t = document.createElement('div'); t.className = 'sl-toast'; cont.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2800); }

  /* ── logos: emblema de marca para índices, imagen de CoinGecko para cripto ── */
  const MARCA_IX = { spx: 'S&P', ndx: 'NDX', dji: 'DJ', rut: 'R2K' };
  function ponerLogo(el, s, base) {
    base = base || 'sl-ico';
    el.style.backgroundImage = '';
    if (s.tipo === 'Crypto') {
      el.className = base + ' sl-badge cr'; el.textContent = s.corto.slice(0, 4);
      if (s.cg) logoCripto(s.cg).then((url) => { if (url) { el.textContent = ''; el.className = base + ' sl-img'; el.style.backgroundImage = `url("${url}")`; } }).catch(() => {});
    } else {
      el.className = base + ' sl-ixlogo sl-lg-' + s.id; el.textContent = MARCA_IX[s.id] || s.corto.slice(0, 3);
    }
  }
  const aplicarLogo = (el, s) => ponerLogo(el, s, 'sl-ico');

  /* ── cabecera: precio, cambio, estructura, señal, rsi ── */
  function pintarBar(velas, E) {
    if (!velas.length) return;
    const last = velas[velas.length - 1], prev = velas.length > 1 ? velas[velas.length - 2].c : last.o;
    const chg = prev ? ((last.c - prev) / prev) * 100 : 0;
    const px = $('#sl-px'); px.textContent = fmt(last.c); px.className = 'sl-px ' + (E.trendActual === -1 ? 'dn' : 'up');
    const cE = $('#sl-chg'); cE.textContent = (chg >= 0 ? UP : DN) + ' ' + Math.abs(chg).toFixed(2) + '%'; cE.className = 'v ' + (chg >= 0 ? 'up' : 'dn');
    const st = $('#sl-str'); st.textContent = E.trendActual === 1 ? 'Bullish' : E.trendActual === -1 ? 'Bearish' : 'Neutral'; st.className = 'v ' + (E.trendActual === 1 ? 'up' : E.trendActual === -1 ? 'dn' : '');
    const sg = $('#sl-sig'); const u = E.ultima; sg.textContent = u ? u.tipo : 'FLAT'; sg.className = 'v ' + (u ? (u.tipo === 'LONG' ? 'up' : 'dn') : '');
    const r = $('#sl-rsi'); r.textContent = (E.conviccion || 0) + ''; r.className = 'v ' + (E.trendActual === 1 ? 'up' : E.trendActual === -1 ? 'dn' : '');
  }
  function pintarLive() { const el = $('#sl-live'); if (!el) return; el.innerHTML = `<i></i><b>LIVE</b><em>DecFreedom</em>`; }

  /* ── panel institucional (hoja de mesa, tabular y sobrio, SIN guiones) ── */
  function pintarPanel(E, velas, mtf, bt) {
    const u = E.ultima;
    const bias = E.trendActual === 1 ? ['LONG', 'bull'] : E.trendActual === -1 ? ['SHORT', 'bear'] : ['FLAT', 'flat'];
    const reg = E.regimen === 'risk-on' ? 'Risk On' : E.regimen === 'risk-off' ? 'Risk Off' : 'Neutral';
    const conv = E.conviccion || 0;

    // ── DIRECTIONAL BIAS ──
    const se = $('#sl-struct');
    se.innerHTML = `<div class="sl-ex-hd"><span>Directional bias</span><em>${esc(sim.corto)}</em></div>
      <div class="sl-ex-rows">
        <div class="sl-ex-r"><span>Bias</span><b class="${bias[1]}">${bias[0]}</b></div>
        <div class="sl-ex-r"><span>Regime</span><b>${reg}</b></div>
        <div class="sl-ex-r"><span>Conviction</span><b>${conv} / 100</b></div>
      </div>
      <div class="sl-ex-bar"><span style="width:${conv}%"></span></div>`;

    // ── DESK ASSESSMENT (sin guiones) ──
    const sg = $('#sl-signal');
    let tono = 'neu', texto = '';
    if (u && u.tipo === 'LONG' && E.trendActual === 1) { tono = 'long'; texto = `Long exposure held within a confirmed risk on regime. Conviction supports staying with the position. The book is cut on a regime shift or a reversal in the read.`; }
    else if (u && u.tipo === 'SHORT' && E.trendActual === -1) { tono = 'short'; texto = `Short exposure held within a confirmed risk off regime. Conviction supports staying with the position. The book is cut on a regime shift or a reversal in the read.`; }
    else if (u) { tono = 'neu'; texto = `Last call was ${u.tipo.toLowerCase()}. The read and the broader regime no longer agree, so the desk waits for the next alignment before committing fresh risk.`; }
    else { texto = `No position. The desk commits only when the read and the broader regime agree. One clean call per regime, no chasing.`; }
    sg.className = 'sl-card sl-signal ' + tono;
    sg.innerHTML = `<div class="sl-ex-hd"><span>Desk assessment</span></div>
      <p class="sl-ex-note">${texto}</p>`;

    // ── RISK PARAMETERS (plan 1:2, los niveles de la gráfica) ──
    const pl = $('#sl-plan');
    if (pl) {
      if (u && isFinite(u.entry) && isFinite(u.sl) && isFinite(u.tp)) {
        pl.innerHTML = `<div class="sl-ex-hd"><span>Risk parameters</span><em>1 : 2</em></div>
          <div class="sl-ex-rows">
            <div class="sl-ex-r"><span>Entry</span><b class="gold">${fmt(u.entry)}</b><i>${u.tipo}</i></div>
            <div class="sl-ex-r tp"><span>Target</span><b>${fmt(u.tp)}</b><i>2R</i></div>
            <div class="sl-ex-r sl"><span>Stop</span><b>${fmt(u.sl)}</b><i>1R</i></div>
          </div>
          <p class="sl-ex-fine">Projected on the chart from the last signal: risk one unit (1.5 ATR) to make two. The desk test exits at the opposite signal, which backtests stronger than a fixed target, so treat 1 : 2 as a discipline frame, not a promise.</p>`;
      } else {
        pl.innerHTML = `<div class="sl-ex-hd"><span>Risk parameters</span><em>flat</em></div>
          <p class="sl-ex-fine">No active plan. Levels are drawn the moment a long or short alert fires.</p>`;
      }
    }

    // ── BACKTESTED EDGE ──
    const pf = $('#sl-perf');
    if (pf && bt) {
      const pfv = bt.pf === Infinity ? 'inf' : bt.pf.toFixed(2);
      pf.innerHTML = `<div class="sl-ex-hd"><span>Backtested edge</span><em>no repaint</em></div>
        <div class="sl-ex-rows">
          <div class="sl-ex-r"><span>Win rate</span><b>${bt.n ? bt.winRate.toFixed(0) + '%' : 'n/a'}</b></div>
          <div class="sl-ex-r"><span>Profit factor</span><b class="${bt.pf >= 1 ? 'bull' : 'bear'}">${bt.n ? pfv : 'n/a'}</b></div>
          <div class="sl-ex-r"><span>Expectancy</span><b class="${bt.expectativaR >= 0 ? 'bull' : 'bear'}">${bt.n ? (bt.expectativaR >= 0 ? '+' : '') + bt.expectativaR.toFixed(2) + ' R' : 'n/a'}</b></div>
          <div class="sl-ex-r"><span>Signals</span><b>${bt.n}</b></div>
          <div class="sl-ex-r"><span>Net, 1% risk</span><b class="${bt.retornoTotal >= 0 ? 'bull' : 'bear'}">${bt.n ? (bt.retornoTotal >= 0 ? '+' : '') + bt.retornoTotal.toFixed(1) + '%' : 'n/a'}</b></div>
        </div>
        <p class="sl-ex-fine">Walk forward, no repaint. Enter at each signal, exit at the opposite one, risking a fixed 1% per trade sized by the ATR stop, the way a desk runs it. A small, stable edge, consistent out of sample, not curve fit. Past results do not guarantee future ones.</p>`;
    }

    // ── MOMENTUM across timeframes ──
    const mm = $('#sl-mom');
    const bm = baseMin[tf] || 1;
    const rows = mtf.map((m) => {
      const lab = etiquetaTF(bm * m.factor);
      const re = MOM[m.rsiEstado], ste = MOM[m.stochEstado];
      return `<div class="sl-mtr"><span>${lab}</span>
        <b class="m-${re[1]}">${isFinite(m.rsi) ? m.rsi.toFixed(0) : 'n/a'}</b>
        <b class="m-${ste[1]}">${isFinite(m.stoch) ? m.stoch.toFixed(0) : 'n/a'}</b></div>`;
    }).join('');
    mm.innerHTML = `<div class="sl-ex-hd"><span>Momentum across timeframes</span></div>
      <div class="sl-mtable"><div class="sl-mtr sl-mth"><span>TF</span><b>RSI</b><b>Stoch</b></div>${rows}</div>
      <p class="sl-ex-fine">Green marks oversold with room to rise, red marks overbought with room to fall. RSI 14 and Stochastic 14, read across timeframes for alignment.</p>`;
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
      velasActuales = velas;
      chart.S.velas = velas; chart.S.tf = tf; chart.S.precio = velas[velas.length - 1].c; chart.S.fuente = r.fuente;
      // Par/símbolo para el clic derecho (operar en spot). Solo cripto: los
      // índices no se operan en spot desde aquí, y orden.js lo dice solo.
      if (sim.tipo === 'Crypto') { chart.S.par = sim.corto; chart.S.simbolo = sim.bn || (sim.corto + 'USDT'); }
      else { chart.S.par = ''; chart.S.simbolo = ''; }
      recomputar();
      arrancarAnim();
    } catch (e) {
      wait.style.display = 'flex';
      wait.innerHTML = `<b>Could not load the data right now.</b><span>The feed may be busy. Try again in a moment.</span><button class="sl-retry" id="sl-retry">Retry</button>`;
      const b = $('#sl-retry'); if (b) b.onclick = () => cargar(true);
    }
  }
  function recomputar() {
    const velas = velasActuales; if (!velas.length) return;
    const E = analizar(velas, { len: LEN }); chart.S.ind = E;
    const mtf = momentoMTF(velas, [1, 4, 12]);
    const bt = backtest(velas, { len: LEN });
    chart.dibujar(); pintarBar(velas, E); pintarPanel(E, velas, mtf, bt); pintarLive();
  }

  /* ── exportar toda la gráfica como imagen, con la marca de agua ── */
  function exportar() {
    try {
      const e2 = cv.width / cv.clientWidth || 1, W = cv.width;
      const hCab = 56 * e2, hPie = 54 * e2;
      const out = document.createElement('canvas'); out.width = W; out.height = hCab + cv.height + hPie;
      const g = out.getContext('2d'); g.fillStyle = '#0b0f16'; g.fillRect(0, 0, out.width, out.height);
      g.fillStyle = '#0a0d13'; g.fillRect(0, 0, W, hCab); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, hCab - 1, W, 1);
      g.textAlign = 'left'; g.fillStyle = '#eaecef'; g.font = `800 ${20 * e2}px system-ui,sans-serif`; g.fillText(sim.n, 20 * e2, 25 * e2);
      g.font = `700 ${11 * e2}px ui-monospace,monospace`; g.fillStyle = '#7d8794'; g.fillText(sim.corto + ' · Structural Logic · ' + (TFS.find((t) => t[0] === tf) || TFS[5])[1], 20 * e2, 44 * e2);
      g.textAlign = 'right'; g.fillStyle = '#E8B84B'; g.font = `800 ${20 * e2}px system-ui,sans-serif`; g.fillText(fmt(chart.S.precio), W - 20 * e2, 35 * e2);
      g.drawImage(cv, 0, hCab);
      const yB = hCab + cv.height; g.fillStyle = '#0b0e12'; g.fillRect(0, yB, W, hPie); g.fillStyle = 'rgba(232,184,75,.4)'; g.fillRect(0, yB, W, 2 * e2);
      let done = false;
      const bajar = () => { if (done) return; done = true; try { out.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'structural-logic-' + sim.corto + '-' + Date.now() + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); toast('Chart image downloaded'); }, 'image/png'); } catch (_) { toast('Could not export right now'); } };
      // La marca de agua va SOLO en la gráfica (ya viene incrustada en el
      // lienzo que se copió arriba). El pie lleva texto, sin repetir el logo.
      g.textAlign = 'left'; g.fillStyle = '#E8B84B'; g.font = `800 ${15 * e2}px system-ui,sans-serif`; g.fillText('Structural Logic', 20 * e2, yB + 25 * e2);
      g.font = `700 ${11 * e2}px ui-monospace,monospace`; g.fillStyle = '#C9A84B'; g.fillText('decfreedom.com', 20 * e2, yB + 43 * e2);
      g.textAlign = 'right'; g.fillStyle = '#6b7681'; g.font = `${10 * e2}px ui-monospace,monospace`;
      g.fillText('Not investment advice', W - 20 * e2, yB + 25 * e2);
      g.fillText(new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), W - 20 * e2, yB + 43 * e2);
      g.textAlign = 'left';
      bajar();
    } catch (_) { toast('Could not export right now'); }
  }

  function arrancarAnim() { if (animOn) return; animOn = true; const paso = () => { if (!document.getElementById('sl-overlay')) { animOn = false; return; } if (!document.hidden) chart.dibujar(); setTimeout(() => requestAnimationFrame(paso), 40); }; requestAnimationFrame(paso); }

  /* ── selector de símbolo ── */
  function pintarLista(q) {
    const list = $('#sl-list'); const term = (q || '').trim().toLowerCase();
    const items = SIMBOLOS.filter((s) => !term || s.n.toLowerCase().includes(term) || s.corto.toLowerCase().includes(term));
    const grupo = (tipo) => items.filter((s) => s.tipo === tipo);
    const render = (arr) => arr.map((s) => `<button class="sl-item${s.id === sim.id ? ' on' : ''}" data-id="${s.id}"><span class="sl-ico2" data-ico="${s.id}">${s.corto.slice(0, 4)}</span><span class="sl-it-nm"><b>${esc(s.n)}</b><em>${esc(s.corto)}</em></span></button>`).join('');
    const ix = grupo('Index'), cr = grupo('Crypto');
    list.innerHTML = (ix.length ? `<div class="sl-gh">Indices</div>${render(ix)}` : '') + (cr.length ? `<div class="sl-gh">Crypto</div>${render(cr)}` : '') || `<div class="sl-empty">No match</div>`;
    list.querySelectorAll('.sl-item').forEach((b) => {
      const s = SIMBOLOS.find((x) => x.id === b.dataset.id);
      b.onclick = () => { if (!s) return; sim = s; lset('sl-sim', s.id); try { chart.cerrarOrden && chart.cerrarOrden(); } catch (_) {} cerrarMenu(); cargar(true); };
      const icoEl = b.querySelector('.sl-ico2'); if (s && icoEl) ponerLogo(icoEl, s, 'sl-ico2');
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
  tfdd.querySelector('.menu').addEventListener('click', (e) => { const b = e.target.closest('[data-tf]'); if (!b) return; tfdd.classList.remove('open'); if (b.dataset.tf === tf) return; tf = b.dataset.tf; lset('sl-tf', tf); try { chart.cerrarOrden && chart.cerrarOrden(); } catch (_) {} tfdd.querySelectorAll('[data-tf]').forEach((x) => x.classList.toggle('on', x === b)); $('#sl-tfcur').childNodes[0].nodeValue = (TFS.find((t) => t[0] === tf) || TFS[5])[1] + ' '; cargar(true); });
  document.addEventListener('click', (e) => { if (!tfdd.contains(e.target)) tfdd.classList.remove('open'); if (!coin.contains(e.target)) cerrarMenu(); });

  const cerrar = () => { try { chart.destruir(); } catch (_) {} try { ov.remove(); } catch (_) {} };
  $('#sl-back').onclick = cerrar;
  $('#sl-export').onclick = exportar;
  $('#sl-how').onclick = abrirComo;
  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('sl-overlay')) chart.dibujar(); });

  function abrirComo() {
    const old = ov.querySelector('#sl-modal'); if (old) old.remove();
    const m = document.createElement('div'); m.className = 'sl-modal'; m.id = 'sl-modal';
    m.innerHTML = `<div class="sl-modal-bg"></div><div class="sl-modal-card">
      <button class="sl-modal-x" aria-label="Close">${ICO.x}</button>
      <h2>Structural Logic, in plain words</h2>
      <p>It smooths price into a fast, responsive average (the coloured candles and line on the chart) and measures its slope against volatility. That slope is the <b>momentum</b> in the lower pane.</p>
      <ul>
        <li>Chart and momentum turn <b>green</b> when momentum pushes above the long threshold, <b>red</b> below the short threshold.</li>
        <li>A <b>long</b> fires when it turns green with price above a hidden 200 period baseline. A <b>short</b> fires when it turns red below it. One alert per regime.</li>
        <li>That hidden baseline keeps you with the larger trend, and a cooldown of 40 bars between alerts cuts the chop so signals stay spaced and clean.</li>
        <li>The <b>backtest</b> shows the real, non repainting stats of these signals over the loaded history.</li>
      </ul>
      <p class="sl-note">Signals are context, not a guarantee. Educational only, not investment advice.</p></div>`;
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
.sl-ixlogo{color:#fff;border:1px solid rgba(255,255,255,.18);font-weight:800;letter-spacing:.2px;text-shadow:0 1px 2px rgba(0,0,0,.45)}
.sl-lg-spx{background:radial-gradient(circle at 32% 28%,#ff4255,#c20017)}
.sl-lg-ndx{background:radial-gradient(circle at 32% 28%,#2bb6f2,#0071c5)}
.sl-lg-dji{background:radial-gradient(circle at 32% 28%,#3a5aa8,#13244f)}
.sl-lg-rut{background:radial-gradient(circle at 32% 28%,#a877e0,#5e2fa3)}
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
.sl-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:linear-gradient(180deg,#0c111a,#0a0d13);flex:none}
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
.sl-conv.g{color:#2ee86a}.sl-conv.r{color:#ff6b7a}
.sl-convbar{margin-top:8px;height:6px;border-radius:4px;background:#0a0e14;overflow:hidden;border:1px solid var(--line)}
.sl-convbar span{display:block;height:100%;background:linear-gradient(90deg,#2ebd85,#E8B84B);border-radius:4px;transition:width .5s ease}
/* ── mesa de trading (Positioning) ── */
.sl-pos{background:linear-gradient(180deg,#0e141e,#0a0d13)}
.sl-deskhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px}
.sl-deskl{display:flex;flex-direction:column;gap:5px}
.sl-desklbl{font-family:"IBM Plex Mono",monospace;font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:#6f7985}
.sl-stance{display:flex;align-items:center;gap:8px}
.sl-stance i{width:9px;height:9px;border-radius:50%;flex:none;background:#5a636e}
.sl-stance b{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:800;font-size:24px;letter-spacing:.6px;line-height:1;color:#cfd6df}
.sl-st-long b{color:#2ee86a}.sl-st-long i{background:#2ee86a;box-shadow:0 0 12px rgba(46,232,106,.9);animation:sl-glow 1.6s infinite}
.sl-st-short b{color:#ff5b6e}.sl-st-short i{background:#ff5b6e;box-shadow:0 0 12px rgba(255,91,110,.9);animation:sl-glow 1.6s infinite}
.sl-st-flat b{color:#9aa4af}
.sl-gaugehd{display:flex;align-items:center;justify-content:space-between;margin-top:2px}
.sl-gaugehd span{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#9aa4af}
.sl-convn{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:800;font-size:17px;color:#eaecef}
.sl-convn em{font-style:normal;font-size:10px;color:#6f7985;font-weight:700}
.sl-convn.g{color:#2ee86a}.sl-convn.r{color:#ff6b7a}
.sl-deskgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.sl-dk{border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:#0a0e14}
.sl-dk span{display:block;font-family:"IBM Plex Mono",monospace;font-size:9px;letter-spacing:.4px;text-transform:uppercase;color:#79838f;margin-bottom:3px}
.sl-dk b{font-family:"Chakra Petch",system-ui,sans-serif;font-size:14px;font-weight:800;color:#eaecef}
.sl-dk b.g{color:#2ee86a}.sl-dk b.r{color:#ff6b7a}
/* ── plan de operación ── */
.sl-plan{display:flex;flex-direction:column;gap:6px}
.sl-pl{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:#0a0e14;border-left-width:3px}
.sl-pl span{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.4px;text-transform:uppercase;color:#9aa4af}
.sl-pl b{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:14px;font-weight:700;text-align:right;color:#eaecef}
.sl-pl em{font-style:normal;font-family:"IBM Plex Mono",monospace;font-size:10px;color:#79838f;min-width:30px;text-align:right}
.sl-pl.tp{border-left-color:var(--long)}.sl-pl.tp b{color:#6ff0ad}
.sl-pl.en{border-left-color:var(--gold)}.sl-pl.en b{color:var(--gold)}
.sl-pl.sl{border-left-color:var(--short)}.sl-pl.sl b{color:#ff8a95}
/* ── panel institucional (terminal de mesa) ── */
.sl-ex-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid var(--line)}
.sl-ex-hd>span{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#aeb6c0}
.sl-ex-hd>em{font-style:normal;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.8px;color:#6f7985;text-transform:uppercase}
.sl-ex-rows{display:flex;flex-direction:column}
.sl-ex-r{display:grid;grid-template-columns:1fr auto auto;align-items:baseline;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.045)}
.sl-ex-r:last-child{border-bottom:0}
.sl-ex-r>span{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.3px;color:#8b94a0}
.sl-ex-r>b{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:14.5px;font-weight:600;color:#eaecef;text-align:right;letter-spacing:.2px}
.sl-ex-r>i{font-style:normal;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:9.5px;color:#6f7985;min-width:30px;text-align:right;letter-spacing:.3px}
.sl-ex-r>b.bull{color:#2ebd85}.sl-ex-r>b.bear{color:#f6465d}.sl-ex-r>b.flat{color:#c2cad3}.sl-ex-r>b.gold{color:var(--gold)}
.sl-ex-r.tp>b{color:#6ff0ad}.sl-ex-r.sl>b{color:#ff8a95}
.sl-ex-bar{margin-top:11px;height:4px;border-radius:3px;background:#0a0e14;overflow:hidden;border:1px solid var(--line)}
.sl-ex-bar span{display:block;height:100%;background:linear-gradient(90deg,#2ebd85,#E8B84B);transition:width .5s ease}
.sl-ex-note{font-size:12.5px;line-height:1.65;color:#c6ced6;margin:0}
.sl-ex-fine{font-size:10.5px;line-height:1.55;color:#6f7985;margin:10px 0 0;border-top:1px solid rgba(255,255,255,.045);padding-top:9px}
.sl-signal.long{border-left:2px solid var(--long);background:linear-gradient(180deg,#0c111a,#0a0d13)}
.sl-signal.short{border-left:2px solid var(--short);background:linear-gradient(180deg,#0c111a,#0a0d13)}
.sl-signal.long .sl-ex-hd>span{color:#8ff4bd}.sl-signal.short .sl-ex-hd>span{color:#ff9aa4}
.sl-signal{position:relative}
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
.sl-tog{font-size:9.5px;font-weight:700;font-family:"IBM Plex Mono",monospace;padding:4px 9px;border-radius:999px;border:1px solid var(--line);background:#0a0e14;color:#79838f;cursor:pointer;white-space:nowrap}
.sl-tog.on{border-color:rgba(46,232,106,.5);color:#2ee86a;background:rgba(46,232,106,.1)}
.sl-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sl-stat{border:1px solid var(--line);border-radius:10px;padding:9px 11px;background:#0a0e14}
.sl-stat span{display:block;font-size:9px;color:#79838f;font-family:"IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
.sl-stat b{font-family:"Chakra Petch",system-ui,sans-serif;font-size:17px;font-weight:800;color:#eaecef}
.sl-stat b.g{color:#2ee86a}.sl-stat b.r{color:#ff6b7a}
.sl-eq{display:flex;align-items:center;justify-content:space-between;margin-top:9px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#0a0e14}
.sl-eq span{font-size:11px;color:#9aa4af;font-family:"IBM Plex Mono",monospace}
.sl-eq b{font-family:"Chakra Petch",system-ui,sans-serif;font-size:16px;font-weight:800}.sl-eq b.g{color:#2ee86a}.sl-eq b.r{color:#ff6b7a}
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
