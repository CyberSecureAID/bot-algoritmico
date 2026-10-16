/* launchpad/swap-inline.js. El swap de la moneda, montable en cualquier contenedor (sellado).
   Es el MISMO swap de la plataforma (compra/venta contra el par de la pool: BNB o USDT). Lo usa
   tanto el panel de la moneda (inline, sin iframe) como el widget embebible. El par es fijo: lo
   fija el creador al abrir la pool; el contrato solo permite esa moneda (comprar=BNB, comprarConToken=USDT). */

import * as wallet from './wallet.js';
import * as gb from './motor.js';
import { leerMoneda } from './firebase-tokens.js';
import { USDT } from './config.js';

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Numero legible: cantidades enormes se abrevian (M/B/T) para que nunca rompan la tarjeta;
   precios diminutos van en notacion compacta. Asi aguanta 14-15 cifras. */
function num(n) {
  n = Number(n); if (!isFinite(n) || n === 0) return '0';
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
  if (a >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (a >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
  const s = a.toFixed(12).replace(/0+$/, ''); return s.length > 10 ? Number(n).toPrecision(4) : s;
}

/* Logo real de BNB (marca oficial, oro) y de Tether (circulo verde con la T). */
const BNB_SVG = '<svg viewBox="0 0 126.61 126.61" fill="#F3BA2F"><path d="M38.73 53.2 63.3 28.63l24.6 24.6 14.3-14.31L63.3 0 24.42 38.89z"/><path d="M0 63.3l14.3-14.3 14.31 14.3-14.31 14.3z"/><path d="M38.73 73.41 63.3 97.98l24.59-24.58 14.31 14.29-38.9 38.91L24.42 87.7z"/><path d="M98 63.3l14.3-14.3 14.31 14.3-14.31 14.31z"/><path d="M77.83 63.3 63.3 48.77 52.56 59.51l-1.24 1.23-2.54 2.55 14.52 14.53z"/></svg>';
const FLIP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v13M4 14l3 3 3-3M17 20V7M14 10l3-3 3 3"/></svg>';
const CHEV = '<svg class="sw-chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
/* Respaldo del logo de Tether si CoinGecko no responde: la T sobre el verde oficial. */
const USDT_FB = '<span class="coin-sel-ico" style="background:#26a17b"><span class="ico-fb" style="color:#fff;font-size:15px">₮</span></span>';
const SLIP = 50n, MIL = 10000n, GAS_BUF = 500000000000000n;

/* Monta el swap dentro de `host` (un contenedor vacio). Devuelve { destruir }.
   opts: { datos, logo, modal, modalBusy, modalCerrar, brand } */
export function montarSwap(host, token, opts = {}) {
  const TOKEN = String(token || '').trim();
  const ui = {
    modal: opts.modal || (async () => true),
    modalBusy: opts.modalBusy || (() => {}),
    modalCerrar: opts.modalCerrar || (() => {})
  };
  let T = opts.datos || null, logo = opts.logo || '', moneda = 'BNB';
  let dir = 'buy', amount = '', outWei = 0n, minOut = 0n, maxWei = null;
  let balQuoteWei = 0n, balCoinWei = 0n, quoting = false, accion = 'connect', tmr = null, vivo = true;
  let _logos = { BNB: '', USDT: '' }, menuAbierto = false;

  const $ = (id) => host.querySelector('#' + id);
  const cuenta = () => wallet.cuentaActual();
  const redOk = () => { try { return wallet.esRedCorrecta(); } catch (_) { return true; } };
  const simIn = () => (dir === 'buy' ? moneda : T.simbolo);
  const simOut = () => (dir === 'buy' ? T.simbolo : moneda);
  const esRechazo = (e) => /reject|denied|user|cancell/i.test(String((e && (e.message || e.reason)) || e));

  /* Logo REAL de la moneda del par (BNB/USDT), de CoinGecko, igual que en todos los mercados.
     Si la red no respondio, cae al SVG de BNB o al circulo de Tether. */
  function icoQuote(cual) {
    cual = cual || moneda;
    const url = _logos[cual];
    if (url) return `<span class="coin-sel-ico conlogo"><img src="${esc(url)}" alt=""></span>`;
    if (cual === 'USDT') return USDT_FB;
    return '<span class="coin-sel-ico" style="background:#0d1117">' + BNB_SVG + '</span>';
  }
  function icoCoin() { return logo ? `<span class="coin-sel-ico conlogo"><img src="${esc(logo)}" alt=""><span class="ico-fb">${esc((T.simbolo || '?')[0].toUpperCase())}</span></span>` : `<span class="coin-sel-ico" style="color:var(--gold,#E8B84B)"><span class="ico-fb">${esc((T.simbolo || '?')[0].toUpperCase())}</span></span>`; }
  /* El lado de la moneda del par es un selector con estilo (chevron). El lado del token es fijo. */
  function pill(which) {
    const coin = (which === 'in' ? dir === 'sell' : dir === 'buy');
    if (coin) return icoCoin() + `<b>${esc(T.simbolo)}</b>`;
    return icoQuote(moneda) + `<b>${esc(moneda)}</b>` + (T.pool ? CHEV : '');
  }

  /* Menu del selector de par. El contrato fija UNA moneda por pool (comprar=BNB, comprarConToken=USDT),
     asi que se muestran BNB y USDT con su logo real: la del pool queda activa y la otra deshabilitada
     con su motivo. No se simula una opcion que la cadena rechazaria. */
  function filaOpt(cur) {
    const on = cur === moneda;
    // La moneda del par queda activa; la OTRA se muestra atenuada pero SIGUE siendo pulsable: al tocarla
    // se explica por que no se puede comprar con ella y como habilitarla (abrir pool). No va 'disabled'.
    return `<button type="button" class="sw-opt${on ? ' on' : ''}" data-cur="${esc(cur)}"${on ? '' : ' style="opacity:.6"'}>${icoQuote(cur)}<b>${esc(cur)}</b><span class="sw-opt-tag">${on ? 'Current pair' : 'No pool'}</span></button>`;
  }
  /* Mensaje al tocar la moneda que NO tiene pool: `otra` = la que toco el usuario; `moneda` = la del
     par (la unica con la que se compra). Explica que para comprar con la otra hay que abrir su pool. */
  function mensajePar(otra) {
    return `This pool was created with ${moneda} liquidity, so this coin can only be bought with ${moneda}. To buy it with ${otra}, the coin's owner needs to open a ${otra} pool for this same coin as well. Once there is a ${otra} pool, it can be bought with both ${moneda} and ${otra}.`;
  }
  function onDocDown(e) { if (!e.target.closest('.sw-tok-sel') && !e.target.closest('.sw-menu')) cerrarMenu(); }
  function onEsc(e) { if (e.key === 'Escape') cerrarMenu(); }
  function cerrarMenu() {
    const m = host.querySelector('.sw-menu'); if (m) m.remove();
    menuAbierto = false;
    document.removeEventListener('pointerdown', onDocDown, true);
    document.removeEventListener('keydown', onEsc, true);
  }
  function abrirMenu(tokEl) {
    cerrarMenu();
    const m = document.createElement('div');
    m.className = 'sw-menu';
    m.innerHTML = filaOpt('BNB') + filaOpt('USDT') + `<div class="sw-menu-note">Pair set by the coin's pool</div>`;
    tokEl.appendChild(m);
    m.querySelectorAll('.sw-opt').forEach((b) => { b.onclick = (ev) => {
      ev.stopPropagation(); const cur = b.dataset.cur; cerrarMenu();
      if (cur === moneda) return;                                   // ya es la moneda del par
      ui.modal(`Only ${moneda} for this coin`, mensajePar(cur));    // explica por que y como habilitar la otra
    }; });
    menuAbierto = true;
    setTimeout(() => { if (!vivo) return; document.addEventListener('pointerdown', onDocDown, true); document.addEventListener('keydown', onEsc, true); }, 0);
  }
  function toggleMenu(tokEl) { if (menuAbierto) cerrarMenu(); else abrirMenu(tokEl); }

  function render() {
    const cta = cuenta();
    host.innerHTML = `<div class="wg-head">${icoCoin()}<div class="wg-hname"><b>${esc(T.nombre || T.simbolo)}</b><span>${esc(T.simbolo)}</span></div>${cta ? `<span class="wg-acct"><i></i>${esc(cta.slice(0, 5) + '…' + cta.slice(-4))}</span>` : ''}</div>
      <div class="sw-body">
        <div class="sw-cards">
          <div class="sw-card">
            <div class="sw-card-top"><span class="sw-lbl">Pay</span><span class="sw-bal" id="wg-bal-in"></span></div>
            <div class="sw-card-mid"><input class="sw-amt" id="wg-amt" inputmode="decimal" placeholder="0.0" autocomplete="off" value="${esc(amount)}"><span class="sw-tok" id="wg-tok-in" title="Pair fixed by the pool">${pill('in')}</span></div>
            <div class="sw-card-bot"><span class="sw-usd"></span><button class="sw-max" id="wg-max" type="button">MAX</button></div>
          </div>
          <div class="sw-card">
            <div class="sw-card-top"><span class="sw-lbl">Receive</span><span class="sw-bal" id="wg-bal-out"></span></div>
            <div class="sw-card-mid"><div class="sw-out" id="wg-out">0.0</div><span class="sw-tok" id="wg-tok-out" title="Pair fixed by the pool">${pill('out')}</span></div>
            <div class="sw-card-bot"><span class="sw-usd"></span></div>
          </div>
          <button class="sw-flip" id="wg-flip" type="button" aria-label="Flip">${FLIP}</button>
        </div>
        <div class="sw-info" id="wg-info"></div>
        <button class="sw-go" id="wg-go" type="button">Connect wallet</button>
      </div>
      ${opts.brand ? `<div class="wg-brand"><a href="../../index.html" target="_blank" rel="noopener" aria-label="DecFreedom"><img src="./img/cco-full.webp" alt="DecFreedom"></a></div>` : ''}`;
    $('wg-amt').addEventListener('input', onInput);
    $('wg-max').onclick = onMax;
    $('wg-flip').onclick = onFlip;
    $('wg-go').onclick = onGo;
    cerrarMenu();
    const qtok = $(dir === 'buy' ? 'wg-tok-in' : 'wg-tok-out');
    if (qtok && T.pool) { qtok.classList.add('sw-tok-sel'); qtok.onclick = (e) => { e.stopPropagation(); toggleMenu(qtok); }; }
    pintarBal(); renderInfo(); renderBtn(); setOut();
  }

  function pintarBal() {
    const bi = $('wg-bal-in'), bo = $('wg-bal-out'); if (!bi) return;
    const inCoin = dir === 'sell', outCoin = dir === 'buy';
    const bInWei = inCoin ? balCoinWei : balQuoteWei, bOutWei = outCoin ? balCoinWei : balQuoteWei;
    bi.textContent = cuenta() ? `Balance: ${num(Number(gb.fmtEther(bInWei)))}` : '';
    bo.textContent = cuenta() ? `Balance: ${num(Number(gb.fmtEther(bOutWei)))}` : '';
  }
  function amountBI() { try { if (maxWei != null) return maxWei; return gb.parseEther((amount || '0').replace(/,/g, '')); } catch (_) { return 0n; } }
  function onInput(e) { let v = (e.target.value || '').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'); e.target.value = v; amount = v; maxWei = null; setOut(); clearTimeout(tmr); tmr = setTimeout(cotizar, 320); }
  function onMax() {
    if (!cuenta()) return;
    const inCoin = dir === 'sell';
    let w = inCoin ? balCoinWei : balQuoteWei;
    if (!inCoin && moneda === 'BNB') w = w > GAS_BUF ? w - GAS_BUF : 0n;
    maxWei = w; amount = gb.fmtEther(w); const i = $('wg-amt'); if (i) i.value = num(Number(amount)); setOut(); cotizar();
  }
  function onFlip() { dir = dir === 'buy' ? 'sell' : 'buy'; amount = ''; maxWei = null; outWei = 0n; minOut = 0n; render(); cargarBalances(); }

  async function cotizar() {
    const inWei = amountBI();
    if (!T.pool || inWei <= 0n) { outWei = 0n; minOut = 0n; quoting = false; setOut(); renderInfo(); renderBtn(); return; }
    quoting = true; renderBtn();
    try {
      if (dir === 'buy') { outWei = await gb.cotizarCompra(TOKEN, inWei); }
      else { const r = await gb.cotizarVenta(TOKEN, inWei, cuenta() || undefined); outWei = r.paraTi; }
      minOut = outWei * (MIL - SLIP) / MIL;
    } catch (_) { outWei = 0n; minOut = 0n; }
    if (!vivo) return;
    quoting = false; setOut(); renderInfo(); renderBtn();
  }
  function setOut() { const o = $('wg-out'); if (o) o.textContent = outWei > 0n ? num(Number(gb.fmtEther(outWei))) : '0.0'; }
  function renderInfo() {
    const el = $('wg-info'); if (!el) return;
    const rows = [];
    if (T.pool && outWei > 0n && amountBI() > 0n) {
      const inN = Number(gb.fmtEther(amountBI())), outN = Number(gb.fmtEther(outWei));
      if (inN > 0) rows.push(['Price', `1 ${esc(simIn())} ≈ ${num(outN / inN)} ${esc(simOut())}`]);
      rows.push(['Min received', `${num(Number(gb.fmtEther(minOut)))} ${esc(simOut())}`]);
    }
    rows.push(['Fee', '0.5% ecosystem + 0.3% pool']);
    el.innerHTML = rows.map((r) => `<div class="r"><span>${r[0]}</span><span>${r[1]}</span></div>`).join('');
  }
  function renderBtn() {
    const b = $('wg-go'); if (!b) return; b.disabled = false;
    if (!cuenta()) { accion = 'connect'; b.textContent = 'Connect wallet'; return; }
    if (!redOk()) { accion = 'net'; b.textContent = 'Switch to BNB Chain'; return; }
    if (!T.pool) { accion = 'x'; b.textContent = 'No liquidity yet'; b.disabled = true; return; }
    const inWei = amountBI();
    if (inWei <= 0n) { accion = 'x'; b.textContent = 'Swap'; b.disabled = true; return; }
    const bal = dir === 'sell' ? balCoinWei : balQuoteWei;
    if (inWei > bal) { accion = 'x'; b.textContent = 'Insufficient balance'; b.disabled = true; return; }
    if (quoting) { accion = 'x'; b.textContent = 'Swap'; b.disabled = true; return; }
    if (outWei <= 0n) { accion = 'x'; b.textContent = 'No route'; b.disabled = true; return; }
    accion = 'swap'; b.textContent = 'Swap';
  }
  async function onGo() {
    if (accion === 'connect') { try { await wallet.conectar(); } catch (_) {} render(); cargarBalances(); return; }
    if (accion === 'net') { try { await wallet.cambiarARedCorrecta(); } catch (_) {} render(); return; }
    if (accion !== 'swap') return;
    const inWei = amountBI();
    ui.modalBusy(dir === 'buy' ? `Buying ${esc(T.simbolo)}` : `Selling ${esc(T.simbolo)}`, 'Confirm in your wallet.');
    try {
      if (dir === 'buy') await gb.comprar({ token: TOKEN, quoteId: moneda, cantQuote: inWei, minOut });
      else await gb.vender({ token: TOKEN, cantTok: inWei, minOut });
      // Cerrar el modal y seguir sin bloquear: nada de ventana "Got it" que haya que cerrar a mano.
      ui.modalCerrar();
      amount = ''; maxWei = null; outWei = 0n; render(); cargarBalances();
      // Refrescar el panel entero (24h, volumen, velas y trades) sin tener que recargar la pagina.
      try { if (typeof opts.recargarPanel === 'function') opts.recargarPanel(); } catch (_) {}
      const bb = $('wg-go'); if (bb) { bb.disabled = true; bb.textContent = 'Done ✓'; setTimeout(() => { if (vivo && $('wg-go')) renderBtn(); }, 1600); }
    } catch (e) {
      ui.modalCerrar();
      if (esRechazo(e)) await ui.modal('Cancelled', 'You cancelled the signature. Nothing was swapped.');
      else await ui.modal('Could not swap', 'The swap did not go through. Try again in a moment.');
    }
  }
  async function cargarBalances() {
    const c = cuenta(); if (!c) { balQuoteWei = 0n; balCoinWei = 0n; pintarBal(); renderBtn(); return; }
    try { balCoinWei = await gb.saldoToken(TOKEN, c).catch(() => 0n); } catch (_) { balCoinWei = 0n; }
    try {
      if (moneda === 'USDT') balQuoteWei = await gb.saldoToken(USDT, c).catch(() => 0n);
      else { const prov = wallet.proveedorActivo(); const hex = prov ? await prov.request({ method: 'eth_getBalance', params: [c, 'latest'] }) : '0x0'; balQuoteWei = BigInt(hex); }
    } catch (_) { balQuoteWei = 0n; }
    if (!vivo) return;
    pintarBal(); renderBtn();
  }

  (async () => {
    // Si el panel ya nos paso los datos de la moneda, pintamos YA, sin esperar a la red: el swap
    // aparece al instante (nada de "Loading…" colgado). Los logos del par (CoinGecko) y el logo de
    // la moneda llegan despues y repintan en silencio; los balances se cargan en paralelo.
    if (T) {
      moneda = T.moneda || (T.pool && T.pool.moneda) || 'BNB';
      render();
      cargarBalances();
      gb.logosPar().then((l) => { if (vivo && l) { _logos = l; render(); } }).catch(() => {});
      if (!logo) leerMoneda(TOKEN).then((m) => { if (vivo && m && m.logo) { logo = m.logo; render(); } }).catch(() => {});
      return;
    }
    // Sin datos (p. ej. el widget embebible): leer la moneda de la cadena y luego pintar.
    T = await gb.datosToken(TOKEN).catch(() => null);
    if (!vivo) return;
    if (!T) { host.innerHTML = `<div class="wg-msg">This coin was not found on the launchpad.</div>`; return; }
    moneda = T.moneda || 'BNB';
    if (!logo) { try { const m = await leerMoneda(TOKEN); if (m && m.logo) logo = m.logo; } catch (_) {} }
    try { _logos = await gb.logosPar(); } catch (_) {}
    if (!vivo) return;
    render();
    cargarBalances();
  })();

  return {
    refrescar() { if (vivo && T) { render(); cargarBalances(); } },
    destruir() { vivo = false; cerrarMenu(); try { host.innerHTML = ''; } catch (_) {} }
  };
}
