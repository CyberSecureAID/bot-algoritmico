/* ══════════════════════════════════════════════════════════════
   sp500/sp500.js — SP500 TD Sequential (DeMark). Herramienta completa.

   Autocontenida en su carpeta (modules/analysis/sp500/). Se abre como
   overlay a pantalla completa; al cerrarse, el catalogo de Analisis
   vuelve solo. Cabecera uniforme estilo Futuros, grafica con las
   cuentas DENTRO del lienzo, lectura anti standby (la cuenta y el
   umbral que falta), backtest real, tarjeta exportable y alertas.

   Piezas: motor.js (TD Sequential + backtest), datos.js (SPY con
   relevo), grafica.js (la grafica de un solo lienzo).
   ══════════════════════════════════════════════════════════════ */

import { crearChart } from './grafica.js?v=3';
import { traerVelasSP, ES_DIARIA } from './datos.js?v=3';
import { computeTD, backtestTD, soloRTH, etDay, etMin, etFinde, etHora, etFecha, APERTURA, CIERRE } from './motor.js?v=3';

const ICO = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  how: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 0 1 4.6 1.2c0 1.7-2.1 2-2.1 3.3"/><path d="M12 17h.01"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  exp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M8 8l4-4 4 4"/><path d="M12 4v12"/></svg>'
};
const TFS = [['1d', 'Daily', '1D'], ['1h', '1 hour', '1H'], ['15m', '15 min', '15M'], ['5m', '5 min', '5M']];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (p) => (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : (p || 0).toFixed(2));
const REL = { close_below: 'below', close_above: 'above', close_leq_low: 'at or below', close_geq_high: 'at or above', flip: 'below' };
const DIRUP = (d) => d === 'buy' ? 'BUY' : d === 'sell' ? 'SELL' : '';
const lget = (k, d) => { try { return localStorage.getItem(k) || d; } catch (_) { return d; } };
const lset = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

export async function abrirSP500() {
  inyectarCSS();
  const prev = document.getElementById('sp-overlay'); if (prev) prev.remove();

  const ov = document.createElement('div');
  ov.id = 'sp-overlay';
  ov.innerHTML = `
    <header class="sp-bar">
      <button class="sp-bk" id="sp-back" aria-label="Back">${ICO.back}</button>
      <div class="sp-coin"><span class="sp-ico">SPY</span><div class="sp-nm"><b>S&P 500</b><span>SPY ${String.fromCharCode(183)} TD Sequential</span></div></div>
      <span class="sp-px" id="sp-px">...</span>
      <div class="sp-dd" id="sp-tf">
        <button class="cur" id="sp-tfcur">1D <i>${String.fromCharCode(9662)}</i></button>
        <div class="menu">${TFS.map((t) => `<button data-tf="${t[0]}"${t[0] === '1d' ? ' class="on"' : ''}>${t[1]}</button>`).join('')}</div>
      </div>
      <div class="col"><span class="l">Change</span><b class="v" id="sp-chg">...</b></div>
      <div class="col"><span class="l">Count</span><b class="v" id="sp-count">...</b></div>
      <div class="col col-wide"><span class="l">Next close</span><b class="v" id="sp-next">...</b></div>
      <div class="col hide-md"><span class="l">TDST res</span><b class="v" id="sp-res">...</b></div>
      <div class="col hide-md"><span class="l">TDST sup</span><b class="v" id="sp-sup">...</b></div>
      <div class="col hide-sm"><span class="l">Day high</span><b class="v" id="sp-hi">...</b></div>
      <div class="col hide-sm"><span class="l">Day low</span><b class="v" id="sp-lo">...</b></div>
      <div class="sp-right">
        <div class="sp-live" id="sp-live"><i></i><b>...</b></div>
        <button class="sp-ib" id="sp-notif" title="Signal alerts">${ICO.bell}</button>
        <button class="sp-ib" id="sp-export" title="Export signal as image">${ICO.exp}</button>
        <button class="sp-ib" id="sp-how" title="How it works">${ICO.how}</button>
      </div>
    </header>
    <div class="sp-main">
      <div class="sp-graf" id="sp-graf"><canvas id="sp-cv"></canvas>
        <div class="sp-wait" id="sp-wait"><div class="sp-spin"></div><b>Loading S&P 500</b></div>
      </div>
      <aside class="sp-side">
        <section class="sp-card" id="sp-read"></section>
        <section class="sp-card" id="sp-bt"></section>
        <p class="sp-foot">TD Sequential (DeMark). Educational tool, not financial advice. Prices from a free feed and may be delayed.</p>
      </aside>
    </div>`;
  document.body.appendChild(ov);

  const $ = (s) => ov.querySelector(s);
  const cv = $('#sp-cv'), cont = $('#sp-graf'), wait = $('#sp-wait');
  const chart = crearChart(cv, cont);

  let rawVelas = [], fuente = '', tf = lget('sp-tf2', '1d'), tfOk = tf;
  let pollTimer = null, animOn = false, notifOn = lget('sp-notif2', '0') === '1', lastNotif = '';
  if (!TFS.some((t) => t[0] === tf)) tf = '1d';
  // reflejar tf guardado
  $('#sp-tf').querySelectorAll('button[data-tf]').forEach((b) => b.classList.toggle('on', b.dataset.tf === tf));
  $('#sp-tfcur').firstChild && ($('#sp-tfcur').childNodes[0].nodeValue = (TFS.find((t) => t[0] === tf) || TFS[0])[2] + ' ');

  const mercadoAbierto = () => { const n = Date.now(); return !etFinde(n) && etMin(n) >= APERTURA && etMin(n) < CIERRE; };
  const prepara = () => ES_DIARIA(tf) ? rawVelas.slice() : soloRTH(rawVelas);

  function marcarTf() { $('#sp-tf').querySelectorAll('button[data-tf]').forEach((b) => b.classList.toggle('on', b.dataset.tf === tf)); $('#sp-tfcur').childNodes[0].nodeValue = (TFS.find((t) => t[0] === tf) || TFS[0])[2] + ' '; }
  function toast(msg) { let t = ov.querySelector('.sp-toast'); if (!t) { t = document.createElement('div'); t.className = 'sp-toast'; cont.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2600); }

  function estadoDia(base) {
    // Para la cabecera: high/low de hoy, open y cierre de referencia
    if (!base.length) return null;
    const diaria = ES_DIARIA(tf);
    const last = base[base.length - 1];
    if (diaria) { const prev = base.length > 1 ? base[base.length - 2].c : last.o; return { hi: last.h, lo: last.l, ref: prev, price: last.c }; }
    const hoy = etDay(last.t); let hi = -Infinity, lo = Infinity, open = null;
    for (let k = base.length - 1; k >= 0; k--) { if (etDay(base[k].t) !== hoy) break; if (base[k].h > hi) hi = base[k].h; if (base[k].l < lo) lo = base[k].l; open = base[k].o; }
    return { hi, lo, ref: open, price: last.c };
  }

  function recomputar() {
    const diaria = ES_DIARIA(tf);
    const base = prepara();
    chart.S.velas = base; chart.S.tf = tf; chart.S.diaria = diaria;
    chart.S.td = computeTD(base);
    chart.S.precio = base.length ? base[base.length - 1].c : 0;
    chart.S.fuente = fuente;
    chart.dibujar();
    pintarBar(base); pintarPaneles(base); pintarLive();
    chequearNotif(base);
  }

  function pintarBar(base) {
    const st = estadoDia(base); if (!st) return;
    const viv = (chart.S.td && chart.S.td.vivo) || {};
    const chg = st.ref ? ((st.price - st.ref) / st.ref) * 100 : 0;
    const px = $('#sp-px'); px.textContent = fmt(st.price); px.className = 'sp-px ' + (chg >= 0 ? 'up' : 'dn');
    const cE = $('#sp-chg'); cE.textContent = (chg >= 0 ? String.fromCharCode(9650) : String.fromCharCode(9660)) + ' ' + Math.abs(chg).toFixed(2) + '%'; cE.className = 'v ' + (chg >= 0 ? 'up' : 'dn');
    // Count
    let ct = 'No count', cc = '';
    if (viv.countdown) { ct = DIRUP(viv.countdown.dir) + ' CD ' + viv.countdown.n + '/13'; cc = 'cd'; }
    else if (viv.setup) { ct = DIRUP(viv.setup.dir) + ' ' + viv.setup.n + '/9'; cc = viv.setup.dir; }
    const cnt = $('#sp-count'); cnt.textContent = ct; cnt.className = 'v ' + (cc === 'buy' ? 'up' : cc === 'sell' ? 'dn' : cc === 'cd' ? 'cd' : '');
    const sg = viv.siguiente;
    $('#sp-next').textContent = sg ? (REL[sg.relacion] + ' ' + fmt(sg.umbral)) : '...';
    $('#sp-res').textContent = viv.tdstRes != null ? fmt(viv.tdstRes) : '...';
    $('#sp-sup').textContent = viv.tdstSup != null ? fmt(viv.tdstSup) : '...';
    $('#sp-hi').textContent = fmt(st.hi); $('#sp-lo').textContent = fmt(st.lo);
  }

  function pintarLive() { const el = $('#sp-live'); if (!el) return; const ab = mercadoAbierto(); el.classList.toggle('off', !ab); el.innerHTML = `<i></i><b>${ab ? 'LIVE' : 'CLOSED'}</b>${fuente ? `<em>${esc(fuente)}</em>` : ''}`; }

  function pintarPaneles(base) {
    const read = $('#sp-read'), bt = $('#sp-bt');
    const td = chart.S.td || { bars: [], vivo: {}, signals: [] };
    const viv = td.vivo || {}; const sg = viv.siguiente;
    const last = base.length - 1;
    const bl = last >= 0 ? td.bars[last] : null;
    const price = chart.S.precio;
    const relTxt = sg ? (REL[sg.relacion] + ' ' + fmt(sg.umbral)) : '';
    const faltanTxt = sg ? (sg.faltan === 1 ? '1 more close' : sg.faltan + ' more closes') : '';

    let verd = 'NO COUNT', vc = 'neutral', chip = '', say = '';
    if (bl && bl.thirteen) {
      const buy = bl.setup ? bl.setup.dir === 'buy' : (bl.countdown ? bl.countdown.dir === 'buy' : true);
      verd = (buy ? 'BUY' : 'SELL') + ' 13'; vc = buy ? 'buy' : 'sell'; chip = 'Signal now';
      say = `A ${buy ? 'buy' : 'sell'} countdown just completed (13). This is the strong exhaustion signal and flags a probable ${buy ? 'bottom' : 'top'}. ${viv.tdstRes != null && buy ? 'Reclaiming TDST ' + fmt(viv.tdstRes) + ' confirms strength.' : ''}`;
    } else if (bl && bl.nine) {
      const buy = bl.setup && bl.setup.dir === 'buy';
      verd = (buy ? 'BUY' : 'SELL') + ' 9'; vc = buy ? 'buy' : 'sell'; chip = 'Signal now';
      say = `A ${buy ? 'buy' : 'sell'} setup just completed (9 closes ${buy ? 'below' : 'above'} the close 4 bars earlier). That flags a possible ${buy ? 'bottom' : 'top'} and often brings a reaction of one to four bars.`;
    } else if (viv.countdown) {
      const buy = viv.countdown.dir === 'buy';
      verd = (buy ? 'BUY' : 'SELL') + ' CD ' + viv.countdown.n + '/13'; vc = buy ? 'buy' : 'sell'; chip = 'Counting';
      say = `The ${buy ? 'buy' : 'sell'} countdown is at ${viv.countdown.n} of 13. ${faltanTxt} with the close ${relTxt} and a strong 13 prints. You can see it coming.`;
    } else if (viv.setup) {
      const buy = viv.setup.dir === 'buy';
      verd = (buy ? 'BUY' : 'SELL') + ' SETUP ' + viv.setup.n + '/9'; vc = buy ? 'buy' : 'sell'; chip = 'Counting';
      say = `The ${buy ? 'buy' : 'sell'} setup is at ${viv.setup.n} of 9. ${faltanTxt} ${relTxt} and the setup completes, flagging a possible ${buy ? 'bottom' : 'top'}.`;
    } else {
      verd = 'NO COUNT'; vc = 'neutral'; chip = 'Flat';
      say = sg ? `No active count right now. A close ${relTxt} would start a fresh setup. The tool shows the exact level, so you are never guessing.` : 'Waiting for data.';
    }

    read.innerHTML = `
      <div class="sp-readtop"><h3 class="sp-h">${ES_DIARIA(tf) ? 'Daily' : etHora(base.length ? base[last].t : Date.now()) + ' ET'}</h3>${chip ? `<span class="sp-chip sp-chip-${vc}">${chip}</span>` : ''}</div>
      <div class="sp-verd sp-verd-${vc}"><b>${verd}</b></div>
      <p class="sp-say">${say}</p>
      <div class="sp-kv"><span>Price now</span><b>${fmt(price)}</b></div>
      ${sg ? `<div class="sp-kv"><span>Next close</span><b class="sp-c-${vc}">${esc(relTxt)}</b></div>` : ''}
      <div class="sp-kv"><span>TDST res</span><b>${viv.tdstRes != null ? fmt(viv.tdstRes) : '...'}</b></div>
      <div class="sp-kv"><span>TDST sup</span><b>${viv.tdstSup != null ? fmt(viv.tdstSup) : '...'}</b></div>
      <button class="sp-dl" id="sp-dl">${ICO.exp}<span>Download signal</span></button>`;
    const dl = $('#sp-dl'); if (dl) dl.onclick = exportarSenal;

    const r = backtestTD(base);
    bt.innerHTML = `
      <h3 class="sp-h">Backtest <span class="sp-muted2">9 reactions</span></h3>
      <div class="sp-btrow"><span class="sp-btwin">Hit rate <i>${r.NR} bars</i></span><b>${r.muestra ? r.winrate.toFixed(0) + '%' : '--'}</b><span class="sp-btn2">${r.muestra ? r.win + 'W ' + r.los + 'L ' + String.fromCharCode(183) + ' ' + r.muestra + ' nines' : 'no data yet'}</span></div>
      <div class="sp-btexp">${r.muestra ? 'Favorable ' + r.favAvg.toFixed(2) + '% vs adverse ' + r.advAvg.toFixed(2) + '% within ' + r.NR + ' bars' : 'Waiting for data'} ${String.fromCharCode(183)} ${r.treces} thirteens</div>
      <p class="sp-note">A 9 is a turn signal, not a guarantee. Hit rate means the move went the right way within ${r.NR} bars. Numbers come from the recent history the free feed returns, so the sample is limited and only indicative.</p>`;
  }

  /* ── Alertas del navegador (foreground) ── */
  function chequearNotif(base) {
    actualizarBell();
    if (!notifOn || !('Notification' in window) || Notification.permission !== 'granted') return;
    const td = chart.S.td; if (!td || !base.length) return;
    const bl = td.bars[base.length - 1]; if (!bl) return;
    if (!(bl.nine || bl.thirteen)) return;
    const key = tf + '-' + (base.length - 1) + '-' + (bl.thirteen ? '13' : '9') + '-' + Math.round(base[base.length - 1].t / 60000);
    if (key === lastNotif) return; lastNotif = key;
    const buy = bl.setup ? bl.setup.dir === 'buy' : (bl.countdown ? bl.countdown.dir === 'buy' : true);
    const cnt = bl.thirteen ? '13' : '9';
    try { new Notification('S&P 500 ' + (buy ? 'BUY' : 'SELL') + ' ' + cnt, { body: 'TD Sequential ' + (buy ? 'buy' : 'sell') + ' ' + cnt + ' on SPY ' + tf.toUpperCase() + ' at ' + fmt(base[base.length - 1].c), tag: 'sp500-td' }); } catch (_) {}
  }
  function actualizarBell() { const b = $('#sp-notif'); if (b) b.classList.toggle('on', notifOn && ('Notification' in window) && Notification.permission === 'granted'); }

  /* ── Exportar la senal como imagen (descarga) ── */
  function exportarSenal() {
    try {
      const e2 = cv.width / cv.clientWidth || 1;
      const W = cv.width;
      const hCab = 64 * e2, hRead = 80 * e2, hPie = 74 * e2;
      const out = document.createElement('canvas'); out.width = W; out.height = hCab + cv.height + hRead + hPie;
      const g = out.getContext('2d');
      g.fillStyle = '#0b0f16'; g.fillRect(0, 0, out.width, out.height);
      // Cabecera
      g.fillStyle = '#0a0d13'; g.fillRect(0, 0, W, hCab);
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, hCab - 1, W, 1);
      g.textAlign = 'left'; g.fillStyle = '#eaecef'; g.font = `800 ${22 * e2}px system-ui,sans-serif`;
      g.fillText('S&P 500', 20 * e2, 30 * e2);
      g.font = `700 ${12 * e2}px ui-monospace,monospace`; g.fillStyle = '#7d8794';
      g.fillText('SPY ' + String.fromCharCode(183) + ' TD Sequential ' + String.fromCharCode(183) + ' ' + tf.toUpperCase(), 20 * e2, 50 * e2);
      g.textAlign = 'right'; g.fillStyle = '#E8B84B'; g.font = `800 ${22 * e2}px system-ui,sans-serif`;
      g.fillText(fmt(chart.S.precio), W - 20 * e2, 40 * e2);
      // Grafica
      g.drawImage(cv, 0, hCab);
      // Lectura
      const viv = (chart.S.td && chart.S.td.vivo) || {}; const sg = viv.siguiente;
      const yR = hCab + cv.height;
      g.fillStyle = '#0d1219'; g.fillRect(0, yR, W, hRead);
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, yR, W, 1);
      g.textAlign = 'left'; g.fillStyle = '#5c6672'; g.font = `${10 * e2}px ui-monospace,monospace`;
      g.fillText('TD SEQUENTIAL', 20 * e2, yR + 20 * e2);
      let ct = 'No count', col = '#9aa5b1';
      if (viv.countdown) { ct = DIRUP(viv.countdown.dir) + ' COUNTDOWN ' + viv.countdown.n + '/13'; col = viv.countdown.dir === 'buy' ? '#2ee86a' : '#ff5b6e'; }
      else if (viv.setup) { ct = DIRUP(viv.setup.dir) + ' SETUP ' + viv.setup.n + '/9'; col = viv.setup.dir === 'buy' ? '#2ee86a' : '#ff5b6e'; }
      g.fillStyle = col; g.font = `800 ${20 * e2}px "Chakra Petch",system-ui,sans-serif`;
      g.fillText(ct, 20 * e2, yR + 46 * e2);
      if (sg) { g.fillStyle = '#c2cad3'; g.font = `600 ${12 * e2}px ui-monospace,monospace`; g.fillText('Next close ' + REL[sg.relacion] + ' ' + fmt(sg.umbral) + '   ' + String.fromCharCode(183) + '   TDST res ' + (viv.tdstRes != null ? fmt(viv.tdstRes) : 'na') + '   sup ' + (viv.tdstSup != null ? fmt(viv.tdstSup) : 'na'), 20 * e2, yR + 66 * e2); }
      // Marca
      const yB = yR + hRead;
      g.fillStyle = '#0b0e12'; g.fillRect(0, yB, W, hPie);
      g.fillStyle = 'rgba(232,184,75,.4)'; g.fillRect(0, yB, W, 2 * e2);
      const textos = (wLogo) => {
        const x0 = wLogo ? 20 * e2 + wLogo + 16 * e2 : 20 * e2;
        g.textAlign = 'left'; g.fillStyle = '#E8B84B'; g.font = `800 ${18 * e2}px system-ui,sans-serif`;
        g.fillText('SP500 ' + String.fromCharCode(183) + ' TD Sequential', x0, yB + 32 * e2);
        g.font = `700 ${12 * e2}px ui-monospace,monospace`; g.fillStyle = '#C9A84B';
        g.fillText('decfreedom.com', x0, yB + 52 * e2);
        g.textAlign = 'right'; g.fillStyle = '#6b7681'; g.font = `${11 * e2}px ui-monospace,monospace`;
        g.fillText('Not financial advice', W - 20 * e2, yB + 32 * e2);
        g.fillText(new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), W - 20 * e2, yB + 52 * e2);
        g.textAlign = 'left';
      };
      const bajar = () => out.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'sp500-td-' + tf + '-' + Date.now() + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); toast('Signal image downloaded'); }, 'image/png');
      const logo = new Image(); let hecho = false;
      const una = (w) => { if (hecho) return; hecho = true; textos(w); bajar(); };
      logo.onload = () => { try { const alto = 46 * e2, anc = Math.round(logo.width * (alto / logo.height)); g.drawImage(logo, 20 * e2, yB + (hPie - alto) / 2, anc, alto); una(anc); } catch (_) { una(0); } };
      logo.onerror = () => una(0); setTimeout(() => una(0), 1500);
      logo.src = new URL('../../../assets/img/cco-full.webp', import.meta.url).href;
    } catch (_) { toast('Could not export right now'); }
  }

  async function cargar(inicial) {
    try {
      if (inicial) { wait.style.display = 'flex'; wait.innerHTML = `<div class="sp-spin"></div><b>Loading S&P 500</b>`; }
      const r = await traerVelasSP(tf);
      if (!r.velas || !r.velas.length) throw new Error('empty');
      rawVelas = r.velas; fuente = r.fuente; tfOk = tf;
      wait.style.display = 'none';
      recomputar(); arrancarAnim();
    } catch (e) {
      if (!inicial && rawVelas.length) { if (tf !== tfOk) { tf = tfOk; marcarTf(); recomputar(); } toast('Could not load that view. Staying on ' + tfOk.toUpperCase() + '.'); return; }
      wait.style.display = 'flex';
      wait.innerHTML = `<b>Could not load the data right now.</b><span>The free feeds may be busy. Tip: add a free API key in datos.js for a stronger primary source.</span><button class="sp-retry" id="sp-retry">Retry</button>`;
      const b = $('#sp-retry'); if (b) b.onclick = () => cargar(true);
    }
  }

  function arrancarAnim() { if (animOn) return; animOn = true; const paso = () => { if (!document.getElementById('sp-overlay')) { animOn = false; return; } if (mercadoAbierto() && !document.hidden) chart.dibujar(); setTimeout(() => requestAnimationFrame(paso), 55); }; requestAnimationFrame(paso); }
  function reprogramarPoll() { clearInterval(pollTimer); pollTimer = setInterval(async () => { if (!document.getElementById('sp-overlay')) { clearInterval(pollTimer); return; } if (ES_DIARIA(tf) || !mercadoAbierto() || document.hidden) return; try { const r = await traerVelasSP(tf); if (r.velas.length) { rawVelas = r.velas; fuente = r.fuente; recomputar(); } } catch (_) {} }, 60000); }

  /* ── Controles ── */
  const tfdd = $('#sp-tf');
  $('#sp-tfcur').onclick = (e) => { e.stopPropagation(); tfdd.classList.toggle('open'); };
  tfdd.querySelector('.menu').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tf]'); if (!b) return; tfdd.classList.remove('open');
    if (b.dataset.tf === tf) return; tf = b.dataset.tf; lset('sp-tf2', tf); marcarTf(); cargar(false);
  });
  document.addEventListener('click', (e) => { if (!tfdd.contains(e.target)) tfdd.classList.remove('open'); });

  $('#sp-notif').onclick = () => {
    if (!('Notification' in window)) { toast('Notifications are not supported here'); return; }
    if (notifOn && Notification.permission === 'granted') { notifOn = false; lset('sp-notif2', '0'); actualizarBell(); toast('Alerts off'); return; }
    Notification.requestPermission().then((p) => { notifOn = p === 'granted'; lset('sp-notif2', notifOn ? '1' : '0'); actualizarBell(); toast(notifOn ? 'Alerts on. You will be notified on a new 9 or 13.' : 'Permission denied'); });
  };
  $('#sp-export').onclick = exportarSenal;
  const cerrar = () => { clearInterval(pollTimer); try { chart.destruir(); } catch (_) {} try { ov.remove(); } catch (_) {} };
  $('#sp-back').onclick = cerrar;
  $('#sp-how').onclick = abrirComo;

  function abrirComo() {
    const old = ov.querySelector('#sp-modal'); if (old) old.remove();
    const m = document.createElement('div'); m.className = 'sp-modal'; m.id = 'sp-modal';
    m.innerHTML = `
      <div class="sp-modal-bg"></div>
      <div class="sp-modal-card">
        <button class="sp-modal-x" aria-label="Close">${ICO.x}</button>
        <h2>TD Sequential, in plain words</h2>
        <p>DeMark's TD Sequential is the exhaustion indicator the pros pay for (Bloomberg licenses it). It does not chase the trend. It counts when a move is running out of fuel and a turn gets likely.</p>
        <ul>
          <li><b>Setup (1 to 9):</b> nine closes in a row ${String.fromCharCode(183)} a buy setup is nine closes below the close four bars earlier, a sell setup nine above. A completed 9 flags a possible turn.</li>
          <li><b>Countdown (1 to 13):</b> after a setup, it counts qualifying closes to 13. A 13 is the stronger exhaustion signal.</li>
          <li><b>TDST levels:</b> the lines a reversal must hold or reclaim.</li>
        </ul>
        <p>No standby: the chart always shows the running count and the <b>exact close the next bar needs</b> to advance it, so you see the signal coming instead of guessing.</p>
        <p class="sp-note">The tool backtests the 9 reversals on the real history the free feed returns and shows the honest win rate. Educational only, not financial advice.</p>
      </div>`;
    ov.appendChild(m); requestAnimationFrame(() => m.classList.add('on'));
    const q = () => { m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 160); };
    m.querySelector('.sp-modal-x').onclick = q; m.querySelector('.sp-modal-bg').onclick = q;
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('sp-overlay')) chart.dibujar(); });
  actualizarBell();
  await cargar(true);
  reprogramarPoll();
}

function inyectarCSS() {
  if (document.getElementById('sp-css')) return;
  const st = document.createElement('style'); st.id = 'sp-css';
  st.textContent = `
#sp-overlay{position:fixed;inset:0;z-index:40050;display:flex;flex-direction:column;background:#05070a;color:#eaecef;
  --gold:#E8B84B;--line:#1c232b;--surf:#0b0f16;--up:#2ebd85;--dn:#f6465d;--cd:#36d6c6;
  font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#sp-overlay *{box-sizing:border-box}
.sp-bar{display:flex;align-items:center;gap:12px;padding:0 12px;height:52px;flex:none;position:relative;
  background:linear-gradient(180deg,#0c111a,#070a0e);border-bottom:1px solid var(--line);overflow:visible}
.sp-bar::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(232,184,75,.5),transparent)}
.sp-bk{width:34px;height:32px;flex:none;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:linear-gradient(180deg,#141a22,#0d1117);color:#cfd6df;cursor:pointer;padding:0}
.sp-bk svg{width:17px;height:17px}.sp-bk:hover{border-color:rgba(232,184,75,.5);color:var(--gold)}
.sp-coin{display:flex;align-items:center;gap:8px;flex:none}
.sp-coin .sp-ico{width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#223049,#121826);display:grid;place-items:center;font-family:"IBM Plex Mono",monospace;font-size:9px;font-weight:700;color:var(--gold);border:1px solid #2a3647}
.sp-coin .sp-nm{display:flex;flex-direction:column;line-height:1.12}
.sp-coin .sp-nm b{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:800;font-size:15px}
.sp-coin .sp-nm span{font-size:9px;color:#79838f;font-family:"IBM Plex Mono",monospace}
.sp-px{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:800;font-size:19px;color:var(--up);flex:none}
.sp-px.dn{color:var(--dn)}
.sp-dd{position:relative;flex:none}
.sp-dd .cur{display:flex;align-items:center;gap:5px;background:#0d1117;border:1px solid var(--line);border-radius:9px;color:#eaecef;font-family:"IBM Plex Mono",monospace;font-size:12px;font-weight:700;padding:7px 11px;cursor:pointer;min-height:32px}
.sp-dd .cur i{font-style:normal;color:#79838f;font-size:9px}
.sp-dd .cur:hover{border-color:rgba(232,184,75,.5)}
.sp-dd .menu{position:absolute;top:38px;left:0;z-index:60;min-width:130px;display:none;background:rgba(16,20,26,.96);backdrop-filter:blur(14px);border:1px solid #29313b;border-radius:12px;padding:5px;box-shadow:0 22px 56px rgba(0,0,0,.7)}
.sp-dd.open .menu{display:block}
.sp-dd .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:#aeb6c0;font-weight:600;font-size:13px;padding:9px 11px;border-radius:9px;cursor:pointer}
.sp-dd .menu button:hover{background:rgba(232,184,75,.1);color:#eaecef}
.sp-dd .menu button.on{color:var(--gold);background:rgba(232,184,75,.08)}
.sp-bar .col{flex:none;display:flex;flex-direction:column;line-height:1.25;white-space:nowrap}
.sp-bar .col .l{font-family:"IBM Plex Mono",monospace;font-size:9px;color:#79838f;margin-bottom:2px}
.sp-bar .col .v{font-family:"IBM Plex Mono",monospace;font-size:12px;color:#eaecef;font-weight:600}
.sp-bar .col .v.up{color:var(--up)}.sp-bar .col .v.dn{color:var(--dn)}.sp-bar .col .v.cd{color:var(--cd)}
.sp-bar .col-wide .v{font-size:11px}
.sp-right{margin-left:auto;display:flex;align-items:center;gap:7px;flex:none}
.sp-live{display:flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid var(--line);border-radius:999px;background:#0d1117;font-size:10px;font-family:"IBM Plex Mono",monospace}
.sp-live i{width:7px;height:7px;border-radius:50%;background:#2ee86a;animation:sp-pulse 1.8s infinite}
.sp-live b{color:#2ee86a;letter-spacing:.5px}.sp-live em{color:#79838f;font-style:normal;border-left:1px solid var(--line);padding-left:6px}
.sp-live.off i{background:#5a636e;animation:none}.sp-live.off b{color:#9aa4af}
@keyframes sp-pulse{0%{box-shadow:0 0 0 0 rgba(46,232,106,.5)}70%{box-shadow:0 0 0 7px rgba(46,232,106,0)}100%{box-shadow:0 0 0 0 rgba(46,232,106,0)}}
.sp-ib{width:34px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:linear-gradient(180deg,#141a22,#0d1117);color:#cfd6df;cursor:pointer;padding:0}
.sp-ib svg{width:17px;height:17px}.sp-ib:hover{border-color:rgba(232,184,75,.5);color:var(--gold)}
.sp-ib.on{color:var(--gold);border-color:rgba(232,184,75,.55);background:rgba(232,184,75,.1)}
.sp-main{flex:1;display:flex;min-height:0}
.sp-graf{flex:1;position:relative;min-width:0;background:var(--surf)}
#sp-cv{display:block;width:100%;height:100%;touch-action:none}
.sp-wait{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(5,7,10,.72);text-align:center;padding:24px}
.sp-wait b{font-size:14px}.sp-wait span{font-size:12px;color:#79838f;max-width:320px;line-height:1.5}
.sp-spin{width:34px;height:34px;border:3px solid rgba(232,184,75,.2);border-top-color:var(--gold);border-radius:50%;animation:sp-spin .9s linear infinite}
@keyframes sp-spin{to{transform:rotate(360deg)}}
.sp-retry{margin-top:4px;padding:8px 18px;border:1px solid rgba(232,184,75,.5);border-radius:10px;background:rgba(232,184,75,.12);color:var(--gold);font-weight:700;cursor:pointer}
.sp-toast{position:absolute;left:50%;bottom:16px;transform:translateX(-50%) translateY(10px);z-index:6;pointer-events:none;background:rgba(16,20,26,.96);border:1px solid var(--line);color:#eaecef;font-size:12px;padding:9px 14px;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.5);opacity:0;transition:opacity .18s,transform .18s;max-width:84%;text-align:center}
.sp-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
.sp-side{width:332px;flex:none;border-left:1px solid var(--line);overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px;background:#080b10}
.sp-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:linear-gradient(180deg,#0c111a,#0a0d13)}
.sp-h{margin:0 0 10px;font-family:"Chakra Petch",system-ui,sans-serif;font-size:13px;letter-spacing:.4px;text-transform:uppercase;color:#cfd6df;display:flex;gap:8px;align-items:center}
.sp-muted2{color:#5f6974;font-weight:600;font-size:10px;letter-spacing:.3px}
.sp-readtop{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.sp-chip{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px;font-family:"IBM Plex Mono",monospace}
.sp-chip-buy{background:rgba(46,232,106,.16);color:#2ee86a}.sp-chip-sell{background:rgba(255,91,110,.16);color:#ff6b7a}.sp-chip-neutral{background:rgba(255,255,255,.08);color:#aeb6c0}
.sp-verd{display:flex;align-items:baseline;gap:10px;padding:10px 12px;border-radius:11px;margin-bottom:10px;border:1px solid var(--line)}
.sp-verd b{font-family:"Chakra Petch",system-ui,sans-serif;font-size:21px;font-weight:800;letter-spacing:.5px}
.sp-verd-buy{background:rgba(46,232,106,.08);border-color:rgba(46,232,106,.4)}.sp-verd-buy b{color:#2ee86a}
.sp-verd-sell{background:rgba(255,91,110,.08);border-color:rgba(255,91,110,.4)}.sp-verd-sell b{color:#ff6b7a}
.sp-verd-neutral{background:rgba(255,255,255,.04)}.sp-verd-neutral b{color:#cfd6df;font-size:17px}
.sp-say{font-size:12.5px;line-height:1.55;color:#c2cad3;margin:0 0 10px}.sp-say b{color:#eaecef}
.sp-kv{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid rgba(255,255,255,.05);font-size:13px}
.sp-kv span{color:#79838f}.sp-kv b{font-family:"IBM Plex Mono",monospace;font-weight:700}
.sp-c-buy{color:#2ee86a}.sp-c-sell{color:#ff6b7a}.sp-c-neutral{color:#eaecef}
.sp-dl{margin-top:12px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;border:1px solid rgba(232,184,75,.4);border-radius:11px;background:rgba(232,184,75,.1);color:var(--gold);font-weight:700;font-size:12.5px;cursor:pointer}
.sp-dl svg{width:15px;height:15px}.sp-dl:hover{background:rgba(232,184,75,.18)}
.sp-btrow{display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;gap:1px 10px;padding:9px 11px;border-radius:11px;border:1px solid rgba(232,184,75,.4);background:rgba(232,184,75,.06);margin-bottom:8px}
.sp-btwin{font-size:12px;color:#cfd6df;font-weight:600;display:flex;align-items:center;gap:6px}
.sp-btwin i{font-style:normal;font-size:9px;font-weight:800;color:var(--gold);background:rgba(232,184,75,.14);padding:1px 5px;border-radius:5px}
.sp-btrow b{grid-row:1 / span 2;align-self:center;font-family:"Chakra Petch",system-ui,sans-serif;font-size:24px;font-weight:800}
.sp-btn2{font-size:10.5px;color:#79838f;font-family:"IBM Plex Mono",monospace}
.sp-btexp{font-size:11px;color:#aeb6c0;font-family:"IBM Plex Mono",monospace;padding:4px 0 8px}
.sp-note{font-size:11px;line-height:1.5;color:#6f7985;margin:6px 0 0;border-top:1px solid rgba(255,255,255,.05);padding-top:8px}
.sp-foot{font-size:10.5px;color:#5f6974;line-height:1.5;margin:2px 2px 0;text-align:center}
.sp-modal{position:absolute;inset:0;z-index:7;display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;transition:opacity .16s}
.sp-modal.on{opacity:1}
.sp-modal-bg{position:absolute;inset:0;background:rgba(5,7,10,.72);backdrop-filter:blur(3px)}
.sp-modal-card{position:relative;max-width:520px;width:100%;max-height:86vh;overflow:auto;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,#0e131c,#0a0d13);padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.6);transform:translateY(8px);transition:transform .16s}
.sp-modal.on .sp-modal-card{transform:none}
.sp-modal-x{position:absolute;top:12px;right:12px;width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:#0d1117;color:#cfd6df;cursor:pointer}
.sp-modal-card h2{font-family:"Chakra Petch",system-ui,sans-serif;font-size:19px;margin:0 0 12px;color:var(--gold)}
.sp-modal-card p{font-size:13px;line-height:1.6;color:#c2cad3;margin:0 0 10px}
.sp-modal-card ul{margin:0 0 10px;padding-left:4px;list-style:none;display:flex;flex-direction:column;gap:7px}
.sp-modal-card li{font-size:12.5px;line-height:1.5;color:#c2cad3;padding-left:14px;position:relative}
.sp-modal-card li::before{content:"";position:absolute;left:0;top:7px;width:6px;height:6px;border-radius:50%;background:var(--gold)}
@media(max-width:1150px){.sp-bar .hide-md{display:none}}
@media(max-width:900px){
  .sp-main{flex-direction:column}.sp-graf{height:52vh;flex:none}
  .sp-side{width:auto;border-left:none;border-top:1px solid var(--line)}
  .sp-bar{flex-wrap:wrap;height:auto;padding:8px 10px;gap:9px}
  .sp-bar .hide-sm{display:none}
  .sp-right{order:5}
}
@media(max-width:560px){
  .sp-bar .col-wide,.sp-bar .hide-md{display:none}
  .sp-coin .sp-nm span{display:none}.sp-px{font-size:17px}
  .sp-graf{height:46vh}
}`;
  document.head.appendChild(st);
}
