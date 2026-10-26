/* ══════════════════════════════════════════════════════════════
   sp500/sp500.js — SP500 Dawn Breakout. Herramienta completa.

   Autocontenida en su propia carpeta (modules/analysis/sp500/), para
   que trabajar aquí no pueda romper Liquidity, Heard ni Smart Pools.
   Se abre como overlay a pantalla completa; al cerrarse, el catálogo
   de Análisis vuelve solo (lo re-muestra abrirTool).

   Piezas:
     · motor.js    — la estrategia y el backtest (puro)
     · datos.js    — SPY intradía, doble vía gratis con relevo
     · grafica.js  — la gráfica (un lienzo; la caja va DENTRO)
   ══════════════════════════════════════════════════════════════ */

import { crearChart } from './grafica.js?v=1';
import { traerVelasSP } from './datos.js?v=1';
import {
  soloRTH, analizarDias, compararVentanas, backtest,
  etDay, etMin, etFinde, etHora, VENTANAS, VENTANA_ET, APERTURA, CIERRE
} from './motor.js?v=1';

const ICO = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  how: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 0 1 4.6 1.2c0 1.7-2.1 2-2.1 3.3"/><path d="M12 17h.01"/></svg>'
};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (p) => (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : (p || 0).toFixed(2));
const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);

export async function abrirSP500() {
  inyectarCSS();
  const prev = document.getElementById('sp-overlay'); if (prev) prev.remove();

  const ov = document.createElement('div');
  ov.id = 'sp-overlay';
  ov.innerHTML = `
    <header class="sp-head">
      <button class="sp-back" id="sp-back" aria-label="Back">${ICO.back}</button>
      <div class="sp-brand">
        <b>SP500 Dawn</b>
        <span>S&P 500 ${String.fromCharCode(183)} SPY</span>
      </div>
      <div class="sp-ctrls">
        <div class="sp-seg" id="sp-tf" role="group" aria-label="Timeframe">
          <button data-tf="1m">1m</button>
          <button data-tf="5m" class="on">5m</button>
        </div>
        <div class="sp-seg" id="sp-win" role="group" aria-label="Opening range">
          <button data-win="30" class="on">30m</button>
          <button data-win="60">1h</button>
        </div>
      </div>
      <div class="sp-right">
        <div class="sp-live" id="sp-live"><i></i><b>...</b></div>
        <button class="sp-ico sp-how" id="sp-how" aria-label="How it works">${ICO.how}</button>
        <button class="sp-ico sp-x" id="sp-x" aria-label="Close">${ICO.x}</button>
      </div>
    </header>
    <div class="sp-main">
      <div class="sp-graf" id="sp-graf">
        <canvas id="sp-cv"></canvas>
        <div class="sp-wait" id="sp-wait"><div class="sp-spin"></div><b>Loading S&P 500</b></div>
      </div>
      <aside class="sp-side">
        <section class="sp-card sp-read" id="sp-read"></section>
        <section class="sp-card sp-bt" id="sp-bt"></section>
        <p class="sp-foot">Educational tool. Not financial advice. Prices from a free feed and may be delayed.</p>
      </aside>
    </div>`;
  document.body.appendChild(ov);

  const $ = (id) => ov.querySelector(id);
  const cv = $('#sp-cv'), cont = $('#sp-graf'), wait = $('#sp-wait');
  const chart = crearChart(cv, cont);

  let rawVelas = [], fuente = '', tf = '5m', win = '30';
  let pollTimer = null, animOn = false;

  const mercadoAbierto = () => { const n = Date.now(); return !etFinde(n) && etMin(n) >= APERTURA && etMin(n) < CIERRE; };

  function recomputar() {
    const rth = soloRTH(rawVelas);
    const hoy = etDay(Date.now());
    chart.S.velas = rth;
    chart.S.tf = tf; chart.S.win = win; chart.S.finMin = VENTANAS[win];
    chart.S.dias = analizarDias(rth, VENTANAS[win], tf);
    chart.S.precio = rth.length ? rth[rth.length - 1].c : 0;
    chart.S.fuente = fuente;
    chart.dibujar();
    pintarPaneles(rth, hoy);
    pintarLive();
  }

  function pintarLive() {
    const el = $('#sp-live'); if (!el) return;
    const abierto = mercadoAbierto();
    el.classList.toggle('off', !abierto);
    el.innerHTML = `<i></i><b>${abierto ? 'LIVE' : 'CLOSED'}</b>${fuente ? `<em>${esc(fuente)}</em>` : ''}`;
  }

  function pintarPaneles(rth, hoy) {
    const read = $('#sp-read'), bt = $('#sp-bt');
    const foco = chart.S.dias.length ? chart.S.dias[chart.S.dias.length - 1] : null;

    /* ── Lectura del día ── */
    if (!foco) { read.innerHTML = `<h3 class="sp-h">Today</h3><p class="sp-muted">No session data yet.</p>`; }
    else if (!foco.completa && foco.dia === hoy) {
      read.innerHTML = `<h3 class="sp-h">Today ${String.fromCharCode(183)} forming</h3>
        <p class="sp-muted">The opening range is still forming. The read happens at <b>${VENTANA_ET[win]} ET</b>.</p>
        <div class="sp-kv"><span>Range high</span><b>${fmt(foco.caja.hi)}</b></div>
        <div class="sp-kv"><span>Range low</span><b>${fmt(foco.caja.lo)}</b></div>`;
    } else if (foco.senal) {
      const s = foco.senal, compra = s.lado === 'compra';
      const acc = compra ? 'buy' : 'sell';
      const res = foco.resultado;
      const enCurso = foco.dia === hoy && res === 'abierta';
      const chip = res === 'ganada' ? ['won', 'Target hit'] : res === 'perdida' ? ['lost', 'Stopped out'] : enCurso ? ['open', 'In progress'] : ['open', 'Unresolved'];
      const donde = compra ? 'upper third' : 'lower third';
      const sesgo = compra ? 'bullish' : 'bearish';
      const ancla = compra ? 'The low of the day is likely in (the box low).' : 'The high of the day is likely in (the box high).';
      read.innerHTML = `
        <div class="sp-readtop">
          <h3 class="sp-h">${foco.dia === hoy ? 'Today' : etFechaLarga(foco.tRead)}</h3>
          <span class="sp-chip sp-chip-${chip[0]}">${chip[1]}</span>
        </div>
        <div class="sp-verd sp-verd-${acc}"><b>${compra ? 'BUY' : 'SELL'}</b><span>R:R 1 to 2</span></div>
        <p class="sp-say">At <b>${etHora(foco.tRead)} ET</b> price sat in the <b>${donde}</b> of the opening range. Bias <b>${sesgo}</b>. ${ancla}</p>
        <div class="sp-kv"><span>Entry</span><b>${fmt(s.entrada)}</b></div>
        <div class="sp-kv"><span>Stop</span><b class="sp-c-sell">${fmt(s.stop)} <em>${Math.abs(pct(s.stop, s.entrada)).toFixed(2)}%</em></b></div>
        <div class="sp-kv"><span>Target</span><b class="sp-c-buy">${fmt(s.objetivo)} <em>${Math.abs(pct(s.objetivo, s.entrada)).toFixed(2)}%</em></b></div>
        <div class="sp-kv"><span>Now</span><b>${fmt(chart.S.precio)}</b></div>`;
    } else {
      read.innerHTML = `<div class="sp-readtop"><h3 class="sp-h">${foco.dia === hoy ? 'Today' : etFechaLarga(foco.tRead)}</h3><span class="sp-chip sp-chip-range">Range</span></div>
        <div class="sp-verd sp-verd-range"><b>NO TRADE</b><span>middle third</span></div>
        <p class="sp-say">At <b>${etHora(foco.tRead)} ET</b> price sat in the <b>middle third</b> of the opening range. That points to chop, so the rule stays out today.</p>
        <div class="sp-kv"><span>Range high</span><b>${fmt(foco.caja.hi)}</b></div>
        <div class="sp-kv"><span>Range low</span><b>${fmt(foco.caja.lo)}</b></div>`;
    }

    /* ── Backtest (los datos deciden) ── */
    const cmp = compararVentanas(rth, tf, hoy);
    const fila = (k, label) => {
      const r = cmp[k];
      const mejor = cmp['30'].winrate >= cmp['60'].winrate ? '30' : '60';
      const act = k === win;
      return `<div class="sp-btrow${act ? ' act' : ''}${k === mejor ? ' best' : ''}">
        <span class="sp-btwin">${label}${k === mejor ? ' <em>top</em>' : ''}${act ? ' <i>in use</i>' : ''}</span>
        <b>${r.muestra ? r.winrate.toFixed(0) + '%' : '--'}</b>
        <span class="sp-btn2">${r.muestra ? r.ganadas + 'W ' + r.perdidas + 'L' : 'no data'} ${String.fromCharCode(183)} ${r.muestra} trades</span>
      </div>`;
    };
    const r = cmp[win];
    bt.innerHTML = `
      <h3 class="sp-h">Backtest <span class="sp-muted2">live history</span></h3>
      ${fila('30', '10:00 window')}
      ${fila('60', '10:30 window')}
      <div class="sp-btexp">${r.muestra ? (r.expR >= 0 ? 'Expectancy +' + r.expR.toFixed(2) + 'R per trade' : 'Expectancy ' + Math.abs(r.expR).toFixed(2) + 'R loss per trade') : 'Waiting for data'} ${String.fromCharCode(183)} ${chart.S.dias.length} sessions on screen</div>
      <p class="sp-note">The thirds rule is a variant, not a documented standard. These numbers come from the recent history the free feed returns, so the sample is small and only indicative.</p>`;
  }

  function etFechaLarga(ms) {
    const d = new Date(ms);
    const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', day: '2-digit', month: 'short' });
    return f.format(d);
  }

  async function cargar() {
    try {
      wait.style.display = 'flex';
      wait.innerHTML = `<div class="sp-spin"></div><b>Loading S&P 500</b>`;
      const r = await traerVelasSP(tf);
      rawVelas = r.velas; fuente = r.fuente;
      if (!rawVelas.length) throw new Error('empty');
      wait.style.display = 'none';
      recomputar();
      arrancarAnim();
    } catch (e) {
      wait.style.display = 'flex';
      wait.innerHTML = `<b>Could not load the data right now.</b>
        <span>The free feeds may be busy, or you can add a free API key in datos.js for a stronger primary source.</span>
        <button class="sp-retry" id="sp-retry">Retry</button>`;
      const b = $('#sp-retry'); if (b) b.onclick = cargar;
    }
  }

  function arrancarAnim() {
    if (animOn) return;
    animOn = true;
    const paso = () => {
      if (!document.getElementById('sp-overlay')) { animOn = false; return; }
      if (mercadoAbierto() && !document.hidden) chart.dibujar();
      setTimeout(() => requestAnimationFrame(paso), 55);
    };
    requestAnimationFrame(paso);
  }

  /* ── Sondeo en vivo (relevo de feed incluido), a ritmo seguro para el plan gratis ── */
  function reprogramarPoll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (!document.getElementById('sp-overlay')) { clearInterval(pollTimer); return; }
      if (!mercadoAbierto() || document.hidden) return;
      try { const r = await traerVelasSP(tf); if (r.velas.length) { rawVelas = r.velas; fuente = r.fuente; recomputar(); } } catch (_) {}
    }, 30000);
  }

  /* ── Controles ── */
  $('#sp-tf').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tf]'); if (!b) return;
    if (b.dataset.tf === tf) return;
    tf = b.dataset.tf;
    $('#sp-tf').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    cargar();
  });
  $('#sp-win').addEventListener('click', (e) => {
    const b = e.target.closest('[data-win]'); if (!b) return;
    if (b.dataset.win === win) return;
    win = b.dataset.win;
    $('#sp-win').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    recomputar();   // sin refetch: mismos datos, otra ventana
  });

  const cerrar = () => { clearInterval(pollTimer); try { chart.destruir(); } catch (_) {} try { ov.remove(); } catch (_) {} };
  $('#sp-back').onclick = cerrar;
  $('#sp-x').onclick = cerrar;
  $('#sp-how').onclick = abrirComo;

  function abrirComo() {
    const old = ov.querySelector('#sp-modal'); if (old) old.remove();
    const m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'sp-modal';
    m.innerHTML = `
      <div class="sp-modal-bg"></div>
      <div class="sp-modal-card">
        <button class="sp-modal-x" aria-label="Close">${ICO.x}</button>
        <h2>How Dawn Breakout works</h2>
        <p>The US market opens at 9:30 ET. During the first part of the session we build a box with the high and the low of that opening range. The box closes at the chosen time (10:00 by default, or the full first hour, 10:30).</p>
        <p>At that moment we look at where price sits inside the box, split into three equal bands:</p>
        <ul>
          <li><b class="sp-c-sell">Lower third</b> ${String.fromCharCode(8594)} bearish day. The box high is the day high. Sell setup.</li>
          <li><b class="sp-c-buy">Upper third</b> ${String.fromCharCode(8594)} bullish day. The box low is the day low. Buy setup.</li>
          <li><b>Middle third</b> ${String.fromCharCode(8594)} chop. No trade.</li>
        </ul>
        <p>Every setup uses a risk to reward of 1 to 2: the stop sits at the opposite edge of the box, the target is twice the risk.</p>
        <p class="sp-note">Honest note: the thirds rule is a variant, not a documented standard strategy. The tool backtests it on the real history the free feed returns so the numbers come from data, not from a rumor. Educational only, not financial advice.</p>
      </div>`;
    ov.appendChild(m);
    requestAnimationFrame(() => m.classList.add('on'));
    const q = () => { m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 160); };
    m.querySelector('.sp-modal-x').onclick = q;
    m.querySelector('.sp-modal-bg').onclick = q;
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('sp-overlay')) chart.dibujar(); });

  await cargar();
  reprogramarPoll();
}

/* ══════════════════════════════════════════════════════════════
   CSS (scoped a #sp-overlay). Estética de la casa: oscuro, oro, con
   la gráfica como protagonista. Cero guiones en el texto visible.
   ══════════════════════════════════════════════════════════════ */
function inyectarCSS() {
  if (document.getElementById('sp-css')) return;
  const st = document.createElement('style'); st.id = 'sp-css';
  st.textContent = `
#sp-overlay{position:fixed;inset:0;z-index:40050;display:flex;flex-direction:column;background:#05070a;color:#eaecef;
  --gold:#E8B84B;--line:#1c232b;--surf:#0b0f16;
  font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#sp-overlay *{box-sizing:border-box}
.sp-head{display:flex;align-items:center;gap:12px;padding:9px 14px;border-bottom:1px solid var(--line);
  background:linear-gradient(180deg,#0c111a,#070a0e);position:relative;flex-wrap:wrap}
.sp-head::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,184,75,.5),transparent)}
.sp-back,.sp-ico{width:38px;height:34px;display:grid;place-items:center;border:1px solid var(--line);border-radius:10px;
  background:linear-gradient(180deg,#141a22,#0d1117);color:#cfd6df;cursor:pointer;flex:none;padding:0}
.sp-back svg,.sp-ico svg{width:18px;height:18px}
.sp-back:hover,.sp-ico:hover{border-color:rgba(232,184,75,.5);color:var(--gold)}
.sp-brand{display:flex;flex-direction:column;line-height:1.1;margin-right:auto}
.sp-brand b{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:800;font-size:16px;letter-spacing:.3px}
.sp-brand span{font-size:10.5px;color:#79838f;font-family:"IBM Plex Mono",ui-monospace,monospace;margin-top:1px}
.sp-ctrls{display:flex;gap:8px}
.sp-seg{display:flex;border:1px solid var(--line);border-radius:11px;overflow:hidden;background:#0d1117}
.sp-seg button{appearance:none;border:0;background:transparent;color:#aeb6c0;font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:12px;padding:7px 13px;min-height:34px;cursor:pointer;border-right:1px solid var(--line)}
.sp-seg button:last-child{border-right:0}
.sp-seg button.on{background:rgba(232,184,75,.14);color:var(--gold);font-weight:700}
.sp-right{display:flex;align-items:center;gap:8px;margin-left:auto}
.sp-live{display:flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid var(--line);border-radius:999px;
  background:#0d1117;font-size:10.5px;font-family:"IBM Plex Mono",ui-monospace,monospace}
.sp-live i{width:7px;height:7px;border-radius:50%;background:#2ee86a;box-shadow:0 0 0 0 rgba(46,232,106,.6);animation:sp-pulse 1.8s infinite}
.sp-live b{color:#2ee86a;letter-spacing:.5px}
.sp-live em{color:#79838f;font-style:normal;border-left:1px solid var(--line);padding-left:6px}
.sp-live.off i{background:#5a636e;animation:none}
.sp-live.off b{color:#9aa4af}
@keyframes sp-pulse{0%{box-shadow:0 0 0 0 rgba(46,232,106,.5)}70%{box-shadow:0 0 0 7px rgba(46,232,106,0)}100%{box-shadow:0 0 0 0 rgba(46,232,106,0)}}
.sp-main{flex:1;display:flex;min-height:0}
.sp-graf{flex:1;position:relative;min-width:0;background:var(--surf)}
#sp-cv{display:block;width:100%;height:100%;touch-action:none}
.sp-wait{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
  background:rgba(5,7,10,.72);color:#cfd6df;text-align:center;padding:24px}
.sp-wait b{font-size:14px}
.sp-wait span{font-size:12px;color:#79838f;max-width:320px;line-height:1.5}
.sp-spin{width:34px;height:34px;border:3px solid rgba(232,184,75,.2);border-top-color:var(--gold);border-radius:50%;animation:sp-spin .9s linear infinite}
@keyframes sp-spin{to{transform:rotate(360deg)}}
.sp-retry{margin-top:4px;padding:8px 18px;border:1px solid rgba(232,184,75,.5);border-radius:10px;background:rgba(232,184,75,.12);color:var(--gold);font-weight:700;cursor:pointer}
.sp-side{width:330px;flex:none;border-left:1px solid var(--line);overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px;background:#080b10}
.sp-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:linear-gradient(180deg,#0c111a,#0a0d13)}
.sp-h{margin:0 0 10px;font-family:"Chakra Petch",system-ui,sans-serif;font-size:13px;letter-spacing:.4px;text-transform:uppercase;color:#cfd6df;display:flex;align-items:center;gap:8px}
.sp-muted{color:#79838f;font-size:12.5px;line-height:1.5;margin:0}
.sp-muted2{color:#5f6974;font-weight:600;font-size:10px;letter-spacing:.3px}
.sp-readtop{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.sp-chip{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px;font-family:"IBM Plex Mono",ui-monospace,monospace}
.sp-chip-won{background:rgba(46,232,106,.16);color:#2ee86a}
.sp-chip-lost{background:rgba(255,59,82,.16);color:#ff6b7a}
.sp-chip-open{background:rgba(232,184,75,.16);color:var(--gold)}
.sp-chip-range{background:rgba(255,255,255,.08);color:#aeb6c0}
.sp-verd{display:flex;align-items:baseline;gap:10px;padding:10px 12px;border-radius:11px;margin-bottom:10px;border:1px solid var(--line)}
.sp-verd b{font-family:"Chakra Petch",system-ui,sans-serif;font-size:22px;font-weight:800;letter-spacing:.5px}
.sp-verd span{font-size:11px;color:#79838f;font-family:"IBM Plex Mono",ui-monospace,monospace}
.sp-verd-buy{background:rgba(46,232,106,.08);border-color:rgba(46,232,106,.4)}.sp-verd-buy b{color:#2ee86a}
.sp-verd-sell{background:rgba(255,59,82,.08);border-color:rgba(255,59,82,.4)}.sp-verd-sell b{color:#ff5b6e}
.sp-verd-range{background:rgba(255,255,255,.04)}.sp-verd-range b{color:#cfd6df;font-size:18px}
.sp-say{font-size:12.5px;line-height:1.55;color:#c2cad3;margin:0 0 10px}
.sp-say b{color:#eaecef}
.sp-kv{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid rgba(255,255,255,.05);font-size:13px}
.sp-kv span{color:#79838f}
.sp-kv b{font-family:"IBM Plex Mono",ui-monospace,monospace;font-weight:700}
.sp-kv b em{font-style:normal;font-size:11px;opacity:.85;margin-left:4px}
.sp-c-buy{color:#2ee86a}.sp-c-sell{color:#ff6b7a}
.sp-btrow{display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;gap:1px 10px;padding:9px 11px;border-radius:11px;border:1px solid var(--line);margin-bottom:8px;background:#0a0e14}
.sp-btrow.act{border-color:rgba(232,184,75,.45);background:rgba(232,184,75,.06)}
.sp-btrow.best b{color:#2ee86a}
.sp-btwin{font-size:12px;color:#cfd6df;font-weight:600;display:flex;align-items:center;gap:6px}
.sp-btwin em{font-style:normal;font-size:9px;font-weight:800;letter-spacing:.3px;color:#2ee86a;background:rgba(46,232,106,.14);padding:1px 5px;border-radius:5px}
.sp-btwin i{font-style:normal;font-size:9px;font-weight:800;letter-spacing:.3px;color:var(--gold);background:rgba(232,184,75,.14);padding:1px 5px;border-radius:5px}
.sp-btrow b{grid-row:1 / span 2;align-self:center;font-family:"Chakra Petch",system-ui,sans-serif;font-size:24px;font-weight:800;color:#eaecef}
.sp-btn2{font-size:10.5px;color:#79838f;font-family:"IBM Plex Mono",ui-monospace,monospace}
.sp-btexp{font-size:11px;color:#aeb6c0;font-family:"IBM Plex Mono",ui-monospace,monospace;padding:4px 0 8px}
.sp-note{font-size:11px;line-height:1.5;color:#6f7985;margin:6px 0 0;border-top:1px solid rgba(255,255,255,.05);padding-top:8px}
.sp-foot{font-size:10.5px;color:#5f6974;line-height:1.5;margin:2px 2px 0;text-align:center}
.sp-modal{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .16s}
.sp-modal.on{opacity:1}
.sp-modal-bg{position:absolute;inset:0;background:rgba(5,7,10,.72);backdrop-filter:blur(3px)}
.sp-modal-card{position:relative;max-width:520px;width:100%;max-height:86vh;overflow:auto;border:1px solid var(--line);border-radius:16px;
  background:linear-gradient(180deg,#0e131c,#0a0d13);padding:22px 22px 20px;box-shadow:0 30px 80px rgba(0,0,0,.6);transform:translateY(8px);transition:transform .16s}
.sp-modal.on .sp-modal-card{transform:none}
.sp-modal-x{position:absolute;top:12px;right:12px;width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:#0d1117;color:#cfd6df;cursor:pointer}
.sp-modal-card h2{font-family:"Chakra Petch",system-ui,sans-serif;font-size:19px;margin:0 0 12px;color:var(--gold)}
.sp-modal-card p{font-size:13px;line-height:1.6;color:#c2cad3;margin:0 0 10px}
.sp-modal-card ul{margin:0 0 10px;padding-left:4px;list-style:none;display:flex;flex-direction:column;gap:7px}
.sp-modal-card li{font-size:12.5px;line-height:1.5;color:#c2cad3;padding-left:14px;position:relative}
.sp-modal-card li::before{content:"";position:absolute;left:0;top:7px;width:6px;height:6px;border-radius:50%;background:var(--gold)}
@media(max-width:820px){
  .sp-main{flex-direction:column}
  .sp-graf{height:54vh;flex:none}
  .sp-side{width:auto;border-left:none;border-top:1px solid var(--line)}
  .sp-brand{margin-right:0}
  .sp-ctrls{order:3;width:100%}
  .sp-right{order:2}
}
@media(max-width:520px){
  .sp-head{padding:8px 10px;gap:8px}
  .sp-brand b{font-size:14px}
  .sp-seg button{padding:6px 10px}
  .sp-graf{height:48vh}
}`;
  document.head.appendChild(st);
}
