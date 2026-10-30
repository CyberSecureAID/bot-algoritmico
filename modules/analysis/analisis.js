/* analisis.js. Entrada y catalogo del Analisis Profesional.
   ──────────────────────────────────────────────────────────────────────────
   FASE 1 (estetica): catalogo con la MISMA cinta superior de las secciones
   aprobadas (Swap/Launchpad/Terminal/Bots), copiada tal cual (no recreada),
   con Analysis iluminado entre Bots y Futures. Debajo, buscador funcional y
   dos filtros (Strategies / Indicators) con el mismo chip de Terminal. Rejilla
   de herramientas data-driven, tarjetas de igual alto/ancho con inclinacion 3D
   (la misma de Shield). Solo tema oscuro, paleta de la casa, particulas y
   fondo de la casa.

   Pendiente de fases siguientes (requieren contrato nuevo): valoracion 5
   estrellas + like/dislike on-chain, pago por servicio + carrito, colaboracion
   y disclaimer. Por eso la compuerta de cobro actual se mantiene de momento.

   Uso:
     import { abrirAnalisis } from '../../modules/analysis/analisis.js';
     abrirAnalisis(origen, wallet, ethers);
*/

import { brasas } from './chispas.js';
import { abrirCobroAnalisis, tieneAccesoAnalisis, segundosAnalisis, esOwnerAnalisis } from './analisis-pro.js?v=6';

/* Rutas RELATIVAS A LA RAIZ (overlay montado sobre index.html / app.html /
   futuros.html). Logo y foto de cinta: los mismos del sitio. Fondo: en el modulo. */
const LOGO   = 'assets/img/cco-full.webp';
const BANNER = 'assets/portada/img/header.webp';
const FONDO  = new URL('./img/fondo-analisis.webp', import.meta.url).href;   // SUBIR a modules/analysis/img/fondo-analisis.webp

/* ── CATALOGO (data-driven; agregar herramienta = una linea) ──────────────────
   cat: solo 'strategy' o 'indicator' (los dos unicos filtros).
   NOTA fases siguientes: aqui iran serviceId + precio + rating, leidos de contrato. */
const HERRAMIENTAS = [
  { id:'pools', abre:'pools', nombre:'Liquidity Pools', cat:'indicator', img:'assets/img/serv-pools.webp', activos:['Crypto'], spot:true,  listo:true,
    lema:'Where the money is trapped',
    desc:'A real time liquidation map. We reconstruct the volume resting inside every block of orders and project the exact price zones where leveraged positions are waiting to be swept.' },
  { id:'hair', abre:'heat', nombre:'Heat Pools', cat:'indicator', img:'assets/img/serv-libro.webp', activos:['Crypto'], spot:true, listo:true,
    lema:'See what the big players do',
    desc:'The order book lies. We watch every wall over time and separate the real committed capital from the theater, so you know which levels truly hold.' },
  { id:'smart', abre:'levels', nombre:'Smart Pools', cat:'indicator', img:'assets/img/serv-tres.webp', activos:['Crypto'], spot:true, listo:true,
    lema:'Where to buy and where to sell',
    desc:'Market structure, read and drawn for you. The engine maps the precise levels of entry and exit from live structure and explains, at each moment, why.' },
  { id:'inst', abre:'inst', nombre:'Institutional Analysis', cat:'analysis', img:'modules/institutional/preview.svg', activos:['Crypto'], spot:false, listo:true,
    lema:'The whole market, one desk',
    desc:'A professional analysis terminal: pro charting with fifteen indicators, live quotes and watchlist, a market-wide heatmap and macro sentiment — the systems an institutional desk watches, wired into one screen.' }
];
const CAT_NOMBRE = { strategy:'Strategy', indicator:'Indicator', analysis:'Analysis' };

/* PRECIOS Y DESCUENTOS.
   Base UNIFORME por servicio: $25/mes, $300/año (=12x25). Editables desde el
   panel admin (solo owner) cuando se haga el contrato.
   Descuento por CANTIDAD de servicios comprados juntos (hay 3 en total, no
   acumulativo), creciente, con TOPE al llevar las 3: mensual 30%, anual 50%.
   Comprar el paquete completo (3) = el mayor descuento.
   ⚠ IMPORTANTE: el descuento DEFINITIVO lo calcula y valida el CONTRATO, no el
   front-end, para que nadie pueda forzar un descuento del 100%. Esto de aqui es
   solo la vista; el contrato tendra la misma tabla. */
const MES_BASE = 25;     // USD/mes por servicio
const ANIO_BASE = 300;   // USD/año por servicio
const DESC_MES  = [0, 0.15, 0.30];     // 1,2,3 servicios (tope 30% con las 3)
const DESC_ANIO = [0, 0.25, 0.50];     // 1,2,3 servicios (tope 50% con las 3)
const descPorCantidad = (tabla, n) => tabla[Math.min(Math.max(n, 1), tabla.length) - 1];
const precioUnit = (n, anual) => Math.round((anual ? ANIO_BASE : MES_BASE) * (1 - descPorCantidad(anual ? DESC_ANIO : DESC_MES, n)));

/* Todo se PAGA EN BNB. Los precios son en USD y se convierten con el MISMO
   oraculo del sitio (OraculoPrecios.precioUSD(address(0)) = BNB/USD, 18 dec). */
const ORACULO = '0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3';
let BNB_USD = 0;
async function leerBNB(wallet, ethers) {
  try {
    const prov = new (ethers.BrowserProvider)((wallet && wallet.proveedorActivo && wallet.proveedorActivo()) || window.ethereum);
    const c = new (ethers.Contract)(ORACULO, ['function precioUSD(address) view returns (uint256)'], prov);
    const raw = await c.precioUSD('0x0000000000000000000000000000000000000000');
    const v = Number(raw) / 1e18;
    if (v > 0) { BNB_USD = v; ['#an-srv', '#an-cart'].forEach((s) => { const m = document.querySelector(s); if (m) pintarBNB(m); }); }
  } catch (_) {}
}
function bnbTxt(usd) { if (!(BNB_USD > 0)) return ''; const v = usd / BNB_USD; return '≈ ' + v.toFixed(v < 1 ? 4 : 3) + ' BNB'; }
function pintarBNB(cont) { if (!cont) return; cont.querySelectorAll('[data-bnb]').forEach((el) => { const t = bnbTxt(Number(el.dataset.bnb)); el.textContent = t || 'in BNB'; }); }

/* Carrito (local por navegador; el pago real se conecta con el contrato al final). */
const CART_KEY = 'an-carrito';
function cargarCarrito() { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (_) { return []; } }
let CARRITO = cargarCarrito();
function guardarCarrito() { try { localStorage.setItem(CART_KEY, JSON.stringify(CARRITO)); } catch (_) {} }
const enCarrito = (id) => CARRITO.indexOf(id) !== -1;
function toggleCarrito(id) { if (enCarrito(id)) CARRITO = CARRITO.filter((x) => x !== id); else CARRITO.push(id); guardarCarrito(); actualizarCart(); }
function actualizarCart() { const n = document.querySelector('#an-sel .an-cartn'); if (n) { n.textContent = CARRITO.length; n.style.display = CARRITO.length ? 'grid' : 'none'; } }

/* Cinta: mismos items y orden que el lobby, con Analysis ENTRE Bots y Futures. */
const NAV = [
  ['Swap', 'app.html?abrir=swap'],
  ['Launchpad', 'modules/launchpad/launchpad.html'],
  ['Terminal', 'modules/terminal/terminal.html'],
  ['Bots', 'modules/bots/bots.html'],
  ['Analysis', null],
  ['Futures', 'futuros.html?v=14'],
  ['Staking', 'aportar.html'],
  ['Shield', 'modules/shield/shield.html']
];
const NAV_TOOLS = [
  ['Dust collector', 'app.html?abrir=tools&tool=polvo'],
  ['Price alerts', 'app.html?abrir=tools&tool=alertas'],
  ['Fear and greed', 'app.html?abrir=tools&tool=termometro'],
  ['Technical analysis', 'app.html?abrir=tools&tool=tecnico'],
  ['Market map', 'app.html?abrir=tools&tool=mapa'],
  ['Live chart', 'app.html?abrir=tools&tool=grafica']
];

const ICO = {
  chev: '<svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>',
  spot: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4L19 6"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  cart: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h2.2l2.2 11a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.2L20.5 7H6.3"/></svg>',
  colab: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8.5" cy="8" r="3"/><circle cx="16.5" cy="8.5" r="2.6"/><path d="M2.5 19c.5-3 2.6-4.6 6-4.6 1.9 0 3.5.5 4.6 1.5M14 18.8c.3-2.6 2-4 4.6-4 2 0 3.5.9 4.2 2.7"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4L19 6"/></svg>'
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function abrirAnalisis(origen, wallet, ethers) {
  let acceso = false;
  try { acceso = await tieneAccesoAnalisis(wallet, ethers); } catch (_) {}
  if (acceso) return abrirSelector(origen, wallet, ethers);
  return abrirCobroAnalisis(origen, wallet, ethers, () => abrirSelector(origen, wallet, ethers));
}

/* Abre una herramienta sin sacar al usuario de Analisis (sin pestañeo al lobby). */
async function abrirTool(abre, cardEl) {
  const base = new URL('../../assets/js/', import.meta.url).href;
  const sel = document.getElementById('an-sel');
  const antes = new Set(Array.from(document.body.children));

  const btn = cardEl ? cardEl.querySelector('.an-open') : null;
  const txtPrev = btn ? btn.innerHTML : '';
  if (btn) { btn.classList.add('load'); btn.textContent = 'Loading…'; }

  try {
    if (abre === 'pools')       await (await import(base + 'liquidity.js?v=129')).abrirPools();
    else if (abre === 'heat')   await (await import(base + 'muros.js?v=129')).abrirMuros();
    else if (abre === 'levels') await (await import(base + 'niveles.js?v=127')).abrirNiveles();
    else if (abre === 'inst')   await (await import(new URL('../institutional/institutional.js?v=2', import.meta.url).href)).abrirInstitutional();
  } catch (e) {
    if (btn) { btn.classList.remove('load'); btn.innerHTML = txtPrev; }
    try { toast('Could not load this tool. Try again.'); } catch (_) {}
    return;
  }
  if (btn) { btn.classList.remove('load'); btn.innerHTML = txtPrev; }
  if (!sel) return;

  const nuevos = Array.from(document.body.children).filter(
    (c) => !antes.has(c) && c !== sel && c.tagName !== 'STYLE' && c.tagName !== 'SCRIPT' && c.tagName !== 'LINK'
  );
  sel.style.display = 'none';
  if (!nuevos.length) { sel.style.display = ''; return; }

  const vivos = () => nuevos.some((el) => el.isConnected);
  const revisar = () => { if (!vivos()) { obs.disconnect(); clearInterval(tmr); const s = document.getElementById('an-sel'); if (s) s.style.display = ''; } };
  const obs = new MutationObserver(revisar);
  obs.observe(document.body, { childList: true });
  const tmr = setInterval(revisar, 400);
}

function toast(txt) {
  const sel = document.getElementById('an-sel'); if (!sel) return;
  let t = sel.querySelector('.an-toast');
  if (!t) { t = document.createElement('div'); t.className = 'an-toast'; sel.appendChild(t); }
  t.textContent = txt; t.classList.add('on');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2400);
}

/* Ventana emergente de un servicio: imagen (de la tarjeta) + que es + precio +
   pago mensual / anual / anadir al carrito. El pago real se conecta al final. */
function abrirServicio(h, card) {
  const sel = document.getElementById('an-sel'); if (!sel) return;
  const old = sel.querySelector('#an-srv'); if (old) old.remove();
  const mes = MES_BASE, anio = ANIO_BASE;
  const catTxt = CAT_NOMBRE[h.cat] || '';
  const media = h.img
    ? `<div class="an-srv-img" data-img="${esc(h.img)}"></div>`
    : `<div class="an-srv-img ph ph-${esc(h.cat)}"><span class="an-ph-ini">${esc(h.nombre[0])}</span></div>`;
  const m = document.createElement('div');
  m.className = 'an-modal'; m.id = 'an-srv';
  m.innerHTML = `
    <div class="an-modal-bg"></div>
    <div class="an-modal-card an-srv-card">
      <button class="an-modal-x" aria-label="Close">${ICO.x}</button>
      <div class="an-srv-grid">
        <div class="an-srv-info">
          <h2 class="an-srv-nom">${esc(h.nombre)}</h2>
          <p class="an-srv-desc">${esc(h.desc)}</p>
          <div class="an-srv-precio">
            <div class="an-pp"><span>Monthly</span><b>$${mes}</b><i data-bnb="${mes}"></i></div>
            <div class="an-pp"><span>Annual</span><b>$${anio}</b><i data-bnb="${anio}"></i></div>
          </div>
          <div class="an-srv-acts">
            <button class="an-pay" data-plan="mes">Pay monthly</button>
            <button class="an-pay gold" data-plan="anio">Pay annual</button>
            <button class="an-cart-add${enCarrito(h.id) ? ' on' : ''}">${enCarrito(h.id) ? 'In cart' : 'Add to cart'}</button>
          </div>
          <div class="an-srv-hint">Priced in USD, charged in BNB. Bundle in the cart for up to 30% off monthly or 50% off annual.</div>
          ${h.listo ? '<button class="an-srv-open">Open now</button>' : '<div class="an-srv-soon">Coming soon</div>'}
        </div>
        <div class="an-srv-media">${media}</div>
      </div>
    </div>`;
  sel.appendChild(m);
  requestAnimationFrame(() => m.classList.add('on'));
  pintarBNB(m);
  const im = m.querySelector('.an-srv-img[data-img]');
  if (im) { const i = new Image(); i.onload = () => { im.style.backgroundImage = `url(${im.dataset.img})`; im.classList.add('con'); }; i.src = im.dataset.img; }
  const cerrar = () => { m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 180); };
  m.querySelector('.an-modal-x').onclick = cerrar;
  m.querySelector('.an-modal-bg').onclick = cerrar;
  m.querySelectorAll('.an-pay').forEach((b) => b.onclick = () => toast('El pago por servicio se conecta en la ultima fase (contrato).'));
  const add = m.querySelector('.an-cart-add');
  add.onclick = () => { toggleCarrito(h.id); add.classList.toggle('on', enCarrito(h.id)); add.textContent = enCarrito(h.id) ? 'In cart' : 'Add to cart'; };
  const open = m.querySelector('.an-srv-open');
  if (open) open.onclick = () => { cerrar(); if (h.abre) abrirTool(h.abre, card); };
}

/* Carrito: pagar varios servicios de una vez (mensual o anual). Pago real al final. */
function abrirCarrito() {
  const sel = document.getElementById('an-sel'); if (!sel) return;
  const old = sel.querySelector('#an-cart'); if (old) old.remove();
  const items = CARRITO.map((id) => HERRAMIENTAS.find((h) => h.id === id)).filter(Boolean);
  const n = items.length;
  const uMes = precioUnit(n, false), uAnio = precioUnit(n, true);
  const totMes = n * uMes, totAnio = n * uAnio;
  const baseMes = n * MES_BASE, baseAnio = n * ANIO_BASE;
  const dMes = Math.round(descPorCantidad(DESC_MES, n) * 100), dAnio = Math.round(descPorCantidad(DESC_ANIO, n) * 100);
  const m = document.createElement('div');
  m.className = 'an-modal'; m.id = 'an-cart';
  m.innerHTML = `
    <div class="an-modal-bg"></div>
    <div class="an-modal-card an-cart-card">
      <button class="an-modal-x" aria-label="Close">${ICO.x}</button>
      <h2 class="an-srv-nom">Your cart</h2>
      ${items.length ? `
        <div class="an-cart-list">${items.map((h) => `<div class="an-cart-item" data-id="${esc(h.id)}"><div class="an-cart-it-n"><b>${esc(h.nombre)}</b><span>${esc(CAT_NOMBRE[h.cat] || '')}</span></div><button class="an-cart-rm" aria-label="Remove">${ICO.x}</button></div>`).join('')}</div>
        ${n >= 2 ? `<div class="an-cart-desc">Bundle of ${n} · <b>${dMes}% off</b> monthly · <b>${dAnio}% off</b> annual</div>` : ''}
        <div class="an-cart-tot"><span>Total</span><b>${n >= 2 ? `<s>$${baseMes}</s> ` : ''}$${totMes}/mo &nbsp;·&nbsp; ${n >= 2 ? `<s>$${baseAnio}</s> ` : ''}$${totAnio}/yr</b></div>
        <div class="an-cart-bnb"><span data-bnb="${totMes}"></span> / mo &nbsp;·&nbsp; <span data-bnb="${totAnio}"></span> / yr &nbsp;·&nbsp; charged in BNB</div>
        <div class="an-srv-acts">
          <button class="an-pay" data-plan="mes">Pay all monthly · $${totMes}</button>
          <button class="an-pay gold" data-plan="anio">Pay all annual · $${totAnio}</button>
        </div>` : '<div class="an-cart-empty">Your cart is empty. Open a service and add it here to pay several at once. The more you bundle, the bigger the discount.</div>'}
    </div>`;
  sel.appendChild(m);
  requestAnimationFrame(() => m.classList.add('on'));
  const cerrar = () => { m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 180); };
  m.querySelector('.an-modal-x').onclick = cerrar;
  m.querySelector('.an-modal-bg').onclick = cerrar;
  pintarBNB(m);
  m.querySelectorAll('.an-pay').forEach((b) => b.onclick = () => toast('El pago del carrito se conecta en la ultima fase (contrato).'));
  m.querySelectorAll('.an-cart-rm').forEach((b) => b.onclick = () => { const id = b.closest('.an-cart-item').dataset.id; toggleCarrito(id); abrirCarrito(); });
}

/* Colaboracion: terceros que quieran VENDER su estrategia/indicador/bot aqui.
   Es por CORREO (@gmail del footer): el formulario abre el correo del usuario con
   los datos listos; les respondemos por el mismo correo. Reutiliza la corona. */
const COLAB_EMAIL = 'supportdecfreedom@gmail.com';
const CORONA = 'assets/portada/img/analisis-pro.webp';
function abrirColaboracion() {
  const sel = document.getElementById('an-sel'); if (!sel) return;
  const old = sel.querySelector('#an-colab-m'); if (old) old.remove();
  const m = document.createElement('div');
  m.className = 'an-modal'; m.id = 'an-colab-m';
  m.innerHTML = `
    <div class="an-modal-bg"></div>
    <div class="an-modal-card an-colab-card">
      <button class="an-modal-x" aria-label="Close">${ICO.x}</button>
      <img class="an-colab-corona" src="${CORONA}" alt="">
      <div class="an-colab-mailbox">
        <a class="an-colab-addr" href="mailto:${COLAB_EMAIL}?subject=${encodeURIComponent('Collaboration proposal')}">${esc(COLAB_EMAIL)}</a>
        <button class="an-colab-copy" id="cf-copy" type="button" aria-label="Copy email">${ICO.copy}</button>
      </div>
      <p class="an-colab-sub">If you have a profitable strategy or a trading indicator that you want to sell on our platform, get in touch with us by email. We will need you to send us the following information:</p>
      <ul class="an-colab-list">
        <li>What it is: a strategy, an indicator or a bot.</li>
        <li>Profitability history that we can study.</li>
        <li>Risk and reward ratio.</li>
        <li>How it works, and on which markets and timeframes.</li>
        <li>A way for us to verify it, such as a public backtest.</li>
        <li>The price you would propose. We work with monthly and annual plans and quantity discounts, so the final price is agreed together.</li>
      </ul>
      <a class="an-pay gold an-colab-mail" href="mailto:${COLAB_EMAIL}?subject=${encodeURIComponent('Collaboration proposal')}">Email us</a>
    </div>`;
  sel.appendChild(m);
  requestAnimationFrame(() => m.classList.add('on'));
  const cerrar = () => { m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 180); };
  m.querySelector('.an-modal-x').onclick = cerrar;
  m.querySelector('.an-modal-bg').onclick = cerrar;
  const cp = m.querySelector('#cf-copy');
  if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(COLAB_EMAIL); } catch (_) {} cp.classList.add('ok'); cp.innerHTML = ICO.check; setTimeout(() => { cp.classList.remove('ok'); cp.innerHTML = ICO.copy; }, 1500); };
}

/* Disclaimer corporativo (reutiliza el sello del sitio). Sale una vez por
   navegador con aceptacion, y se puede reabrir desde el enlace. Sin promesas de
   resultado: nos exonera de responsabilidad. */
const DISCLAIMER_IMG = 'assets/portada/red/disclaimer.webp';
const DISC_KEY = 'an-disclaimer-ok';
function mostrarDisclaimer(reView) {
  const sel = document.getElementById('an-sel'); if (!sel) return;
  if (!reView) { try { if (localStorage.getItem(DISC_KEY)) return; } catch (_) {} }
  const old = sel.querySelector('#an-disc'); if (old) old.remove();
  const m = document.createElement('div');
  m.className = 'an-modal'; m.id = 'an-disc';
  // Modo obligatorio (al entrar): EXONERANTE. Sin X y sin cierre tocando fuera; la unica
  // salida es marcar la casilla y pulsar Accept. Asi nadie puede decir que no acepto los
  // terminos. Modo re-lectura (desde el enlace "Disclaimer", ya aceptado): se puede cerrar.
  m.innerHTML = `
    <div class="an-modal-bg"></div>
    <div class="an-modal-card an-disc-card">
      ${reView ? `<button class="an-modal-x" aria-label="Close">${ICO.x}</button>` : ''}
      <div class="an-disc-box">
        <img class="an-disc-top" src="${DISCLAIMER_IMG}" alt="">
        <img class="an-disc-fl" src="${DISCLAIMER_IMG}" alt="">
        <p>DecFreedom provides analytical tools, indicators and strategies for informational and educational purposes only. Nothing here is financial, investment, legal or tax advice, and we do not guarantee any result, profit or performance. Trading digital assets carries substantial risk and you may lose part or all of your capital. Every decision is your own and you are solely responsible for it.</p>
        <p>All tools are provided as is, without warranty of any kind, and part of the data may come from third parties. To the maximum extent permitted by law, DecFreedom, its owners and affiliates accept no liability for any loss or damage arising from the use of this platform. By continuing you accept this notice and our Terms and Conditions.</p>
        ${reView ? '' : `<label class="an-disc-chk" style="display:flex;align-items:flex-start;gap:10px;margin:2px 0 14px;cursor:pointer;font-size:12.5px;line-height:1.5;color:#d4dae1">
          <input type="checkbox" id="an-disc-agree" style="flex:none;width:18px;height:18px;margin:1px 0 0;accent-color:#E8B84B;cursor:pointer">
          <span>I have read and I accept the <b style="color:#e9eef3">Terms and Conditions</b> and this notice. I understand these tools do not guarantee any result and that I use them entirely at my own risk.</span>
        </label>`}
        <button class="an-pay gold an-disc-ok" id="an-disc-ok"${reView ? '' : ' disabled style="opacity:.45;cursor:not-allowed"'}>${reView ? 'Close' : 'Accept'}</button>
      </div>
    </div>`;
  sel.appendChild(m);
  requestAnimationFrame(() => m.classList.add('on'));
  const cerrar = () => { m.classList.remove('on'); setTimeout(() => { try { m.remove(); } catch (_) {} }, 180); };
  if (reView) {
    const x = m.querySelector('.an-modal-x'); if (x) x.onclick = cerrar;
    m.querySelector('.an-modal-bg').onclick = cerrar;
  } else {
    // Bloqueante: tocar fuera NO cierra.
    m.querySelector('.an-modal-bg').onclick = (e) => { e.preventDefault(); e.stopPropagation(); };
    const chk = m.querySelector('#an-disc-agree'), ok = m.querySelector('#an-disc-ok');
    chk.addEventListener('change', () => {
      if (chk.checked) { ok.removeAttribute('disabled'); ok.style.opacity = ''; ok.style.cursor = ''; }
      else { ok.setAttribute('disabled', ''); ok.style.opacity = '.45'; ok.style.cursor = 'not-allowed'; }
    });
  }
  m.querySelector('#an-disc-ok').onclick = () => {
    if (!reView) {
      const chk = m.querySelector('#an-disc-agree');
      if (!chk || !chk.checked) return;   // sin marcar la casilla, no procede
      try { localStorage.setItem(DISC_KEY, '1'); } catch (_) {}
    }
    cerrar();
  };
}

export function abrirSelector(origen, wallet, ethers) {
  const prev = document.getElementById('an-sel'); if (prev) prev.remove();

  const ov = document.createElement('div');
  ov.id = 'an-sel';
  ov.style.visibility = 'hidden';

  // ── Cinta (copiada de las secciones aprobadas; Analysis entre Bots y Futures) ──
  const navHTML = NAV.map(([txt, href]) => {
    if (href === null) return `<div class="pt-nav__i"><a class="pt-nav__b lp-on" aria-current="page">${esc(txt)}</a></div>`;
    return `<div class="pt-nav__i"><a class="pt-nav__b" href="${esc(href)}">${esc(txt)}</a></div>`;
  }).join('');
  const toolsHTML = `<div class="pt-nav__i">
      <button class="pt-nav__b" type="button">Tools ${ICO.chev}</button>
      <div class="pt-menu">${NAV_TOOLS.map(([t, h]) => `<a href="${esc(h)}"><b>${esc(t)}</b></a>`).join('')}</div>
    </div>`;
  const colaHTML = `<div class="pt-nav__i"><a class="pt-nav__b" href="app.html?abrir=market">P2P</a></div>
    <div class="pt-nav__i"><a class="pt-nav__b" href="app.html?abrir=academy">Academy</a></div>`;

  const cintaHTML = `
    <header class="pt-hdr">
      <div class="pt-hdr__in">
        <a class="sw-back" id="an-back" href="index.html" aria-label="Back">${ICO.back}Back</a>
        <a class="pt-logo" href="index.html" aria-label="DecFreedom"><img src="${LOGO}" alt="DecFreedom" width="150" height="30"></a>
        <nav class="pt-nav" aria-label="Main">${navHTML}${toolsHTML}${colaHTML}</nav>
        <div class="pt-hdr__a">
          <span class="an-wpill" id="an-wpill" hidden></span>
          <a class="c-contratos" href="transparency.html">Contracts</a>
        </div>
      </div>
    </header>`;

  // ── Catalogo: buscador + dos chips (Strategies / Indicators). Sin banda negra, sin brand, sin selects. ──
  const catHeadHTML = `
    <div class="an-cat-hd">
      <button class="an-colab" id="an-colab" type="button">${ICO.colab}<span>Collaboration</span></button>
      <label class="an-search">${ICO.search}<input id="an-q" type="search" autocomplete="off" placeholder="Search for a tool, indicator or strategy..."></label>
      <button class="an-cartbtn" id="an-cartbtn" type="button" aria-label="Cart">${ICO.cart}<span class="an-cartn">0</span></button>
    </div>`;

  ov.innerHTML = `
    <div class="an-fondo" aria-hidden="true"></div>
    <canvas class="an-chispas" data-n="110" aria-hidden="true"></canvas>
    ${cintaHTML}
    <div class="an-cat">
      <div class="an-cat-in">
        ${catHeadHTML}
        <div class="an-grid" id="an-grid"></div>
        <div class="an-empty" id="an-empty" hidden>No tools match your search.</div>
        <div class="an-foot"><button class="an-disc-link" id="an-disc-link" type="button"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6z"/><path d="M12 9v4"/><path d="M12 16.5h.01"/></svg>Disclaimer</button></div>
      </div>
    </div>
    <style>${CSS}</style>`;

  document.body.appendChild(ov);
  requestAnimationFrame(() => { ov.style.visibility = 'visible'; });

  const $ = (sel) => ov.querySelector(sel);

  // Fondo (si existe la imagen; si no, queda el degradado de la casa)
  (function () { const capa = $('.an-fondo'); if (!capa) return; const img = new Image(); img.onload = () => { capa.style.backgroundImage = `url(${FONDO})`; capa.classList.add('con'); }; img.src = FONDO; })();

  // Particulas de la casa
  let particulas = null; try { particulas = brasas($('.an-chispas')); } catch (_) {}
  try { leerBNB(wallet, ethers); } catch (_) {}

  // Un SOLO boton: ultimos 4 de la wallet + dias de suscripcion, u "Owner".
  (async () => {
    try {
      let cuenta = ''; try { cuenta = (wallet && wallet.cuentaActual && wallet.cuentaActual()) || ''; } catch (_) {}
      if (!cuenta) return;
      const last4 = String(cuenta).slice(-4);
      const chip = $('#an-wpill'); if (!chip) return;
      let dueno = false; try { dueno = await esOwnerAnalisis(wallet, ethers); } catch (_) {}
      let cola = '';
      if (dueno) cola = 'Owner';
      else {
        const seg = await segundosAnalisis(wallet, ethers);
        if (seg > 3650 * 86400) cola = 'Full';
        else if (seg > 0) { const d = Math.floor(seg / 86400); cola = d >= 1 ? (d + 'd') : '<1d'; }
      }
      chip.innerHTML = `<span class="an-w4">${esc(last4)}</span>` + (cola ? `<span class="an-wsep">·</span><span class="an-wd">${esc(cola)}</span>` : '');
      chip.hidden = false;
    } catch (_) {}
  })();

  const grid = $('#an-grid');
  const empty = $('#an-empty');
  const estado = { q: '', cats: new Set() };

  const tarjeta = (h) => {
    const catTxt = CAT_NOMBRE[h.cat] || '';
    const medio = h.img
      ? `<div class="an-img" data-img="${esc(h.img)}"></div>`
      : `<div class="an-img ph ph-${esc(h.cat)}"><span class="an-ph-ini">${esc(h.nombre[0])}</span></div>`;
    return `
      <button class="an-card${h.listo ? '' : ' soon'}" type="button" data-tilt data-id="${esc(h.id)}" data-abre="${esc(h.abre || '')}" data-listo="${h.listo ? '1' : '0'}" title="${esc(h.desc)}">
        <div class="an-media">
          ${medio}
          <span class="an-badge an-badge-${esc(h.cat)}">${esc(catTxt)}</span>
          ${h.spot ? `<span class="an-spot">${ICO.spot} Spot</span>` : ''}
          ${h.listo ? '' : '<span class="an-soon">Coming soon</span>'}
        </div>
        <div class="an-body">
          <div class="an-nom">${esc(h.nombre)}</div>
          <div class="an-lema">${esc(h.lema)}</div>
          <div class="an-open">${h.listo ? 'Open' : 'Coming soon'}</div>
        </div>
      </button>`;
  };

  const render = () => {
    const q = estado.q.trim().toLowerCase();
    const lista = HERRAMIENTAS.filter((h) => {
      if (estado.cats.size && !estado.cats.has(h.cat)) return false;
      if (q && !((h.nombre + ' ' + h.lema + ' ' + h.desc).toLowerCase().includes(q))) return false;
      return true;
    });
    grid.innerHTML = lista.map(tarjeta).join('');
    empty.hidden = lista.length > 0;
    grid.querySelectorAll('.an-img[data-img]').forEach((el) => {
      const img = new Image();
      img.onload = () => { el.style.backgroundImage = `url(${el.dataset.img})`; el.classList.add('con'); };
      img.src = el.dataset.img;
    });
    wireTilt();
  };

  // Inclinacion 3D (la misma de Shield)
  function wireTilt() {
    grid.querySelectorAll('[data-tilt]').forEach((el) => {
      el.onmousemove = (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(650px) rotateY(' + (x * 13) + 'deg) rotateX(' + (-y * 13) + 'deg) translateY(-5px) scale(1.03)';
      };
      el.onmouseleave = () => { el.style.transform = ''; };
    });
  }

  render();

  // ── Interaccion ──
  const cerrar = () => { try { if (particulas) particulas.parar(); } catch (_) {} try { ov.remove(); } catch (_) {} };
  const back = $('#an-back');
  back.onclick = (e) => {
    e.preventDefault();
    if (window.__ANALISIS_PAGINA__) {   // pagina propia: salimos de verdad, no dejamos nada debajo (ni los bots)
      if (history.length > 1) history.back();
      else location.href = new URL('../../index.html', import.meta.url).href;
      return;
    }
    cerrar();   // overlay (portada): volvemos a donde estaba el usuario (no recarga)
  };

  const q = $('#an-q');
  q.addEventListener('input', () => { estado.q = q.value || ''; render(); });

  ov.querySelectorAll('.an-chip').forEach((b) => b.onclick = () => {
    const c = b.dataset.cat;
    if (estado.cats.has(c)) estado.cats.delete(c); else estado.cats.add(c);
    b.classList.toggle('on', estado.cats.has(c));
    render();
  });

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.an-card'); if (!card) return;
    const h = HERRAMIENTAS.find((x) => x.id === card.dataset.id);
    if (h) abrirServicio(h, card);
  });

  const cartBtn = $('#an-cartbtn');
  if (cartBtn) cartBtn.onclick = abrirCarrito;
  actualizarCart();

  const colabBtn = $('#an-colab');
  if (colabBtn) colabBtn.onclick = abrirColaboracion;

  const discLink = $('#an-disc-link');
  if (discLink) discLink.onclick = () => mostrarDisclaimer(true);
  mostrarDisclaimer(false);
}

/* ── CSS. La CINTA es copia de los cinta.css de las secciones aprobadas
   (reglas #pt...), re-scopeada a #an-sel, con el overflow del nav SOLO en el
   tramo 761-1120 (como en las aprobadas) para que la barra dorada del activo
   NO se recorte. ── */
const CSS = `
#an-sel{position:fixed;inset:0;z-index:40000;height:100dvh;max-height:100dvh;display:flex;flex-direction:column;color:#eaecef;background:#05070a;
  --gold:#E8B84B;--gold-hi:#f4d089;--gold-md:#cf9f2e;--gold-lo:#8f6a1a;--on-gold:#241900;
  --ink:#eaecef;--ink2:#a7b0bb;--ink3:#79838f;--line:#1c232b;--line2:#29313b;--surf:#12161c;
  --sans:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;--disp:"Chakra Petch",system-ui,sans-serif;
  font-family:var(--sans)}
#an-sel *{box-sizing:border-box}
#an-sel img,#an-sel svg{display:block;max-width:100%}
#an-sel a{color:inherit;text-decoration:none}

/* fondo + particulas (detras de todo) */
#an-sel .an-fondo{position:fixed;inset:0;z-index:0;pointer-events:none;background:#05070a;
  background-image:radial-gradient(1200px 560px at 82% -6%,rgba(232,184,75,.08),transparent 60%),radial-gradient(900px 520px at 8% 2%,rgba(74,163,255,.05),transparent 55%),linear-gradient(180deg,#070a0e,#05070a 62%)}
#an-sel .an-fondo.con::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,10,.72),rgba(5,7,10,.9))}
#an-sel .an-chispas{position:fixed;inset:0;z-index:1;width:100%;height:100%;pointer-events:none;display:block}

/* ── CINTA (copia 1:1 de las aprobadas) ── */
#an-sel .pt-hdr{position:relative;z-index:20;flex:0 0 auto;display:flex;align-items:center;height:58px;background:#07090c;border-bottom:1px solid #1a2029}
#an-sel .pt-hdr::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:url('${BANNER}') center/cover no-repeat;opacity:1}
#an-sel .pt-hdr button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
#an-sel .pt-hdr__in{position:relative;z-index:2;display:flex;align-items:center;gap:0;width:100%;max-width:none;margin:0 auto;padding:0 14px}
#an-sel .sw-back{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px 0 9px;border-radius:9px;font-family:var(--sans);font-size:13px;font-weight:600;color:var(--ink2);background:rgba(255,255,255,.05);border:1px solid var(--line2);text-shadow:0 1px 4px rgba(0,0,0,.9);margin-right:26px;white-space:nowrap}
#an-sel .sw-back:hover{border-color:var(--gold-lo);color:var(--gold)}
#an-sel .sw-back svg{width:12px;height:12px}
#an-sel .pt-logo{flex:0 0 auto;display:flex;align-items:center;text-shadow:0 1px 4px rgba(0,0,0,.9)}
#an-sel .pt-logo img{height:40px;width:auto}
#an-sel .pt-nav{display:flex;align-items:center;gap:2px;flex:0 1 auto;margin-left:14px}
#an-sel .pt-nav__i{position:relative}
#an-sel .pt-nav__b{display:flex;align-items:center;gap:5px;font-size:13.5px;font-weight:500;color:var(--ink2);padding:8px 11px;border-radius:8px;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.9);transition:color .15s,background .15s;cursor:pointer}
#an-sel .pt-nav__b:hover{color:var(--ink);background:rgba(255,255,255,.045)}
#an-sel .pt-nav__b svg{width:10px;height:10px;opacity:.55;transition:transform .2s}
#an-sel .pt-nav__i:hover .pt-nav__b svg{transform:rotate(180deg)}
#an-sel .pt-menu{position:absolute;top:calc(100% + 8px);left:0;z-index:300;min-width:200px;padding:7px;background:var(--surf);border:1px solid var(--line2);border-radius:12px;box-shadow:0 20px 44px rgba(0,0,0,.6);opacity:0;visibility:hidden;transform:translateY(-5px);transition:opacity .17s,transform .17s,visibility .17s}
#an-sel .pt-nav__i:hover .pt-menu,#an-sel .pt-nav__i:focus-within .pt-menu{opacity:1;visibility:visible;transform:none}
#an-sel .pt-menu a{display:block;padding:9px 11px;border-radius:8px}
#an-sel .pt-menu a:hover{background:rgba(232,184,75,.07)}
#an-sel .pt-menu b{display:block;font-size:13px;font-weight:600;color:var(--ink)}
#an-sel .pt-hdr__a{display:flex;align-items:center;gap:6px;flex:0 0 auto;margin-left:auto}
/* SERVICIO ACTIVO (igual que en las aprobadas): dorado + halo + barra inferior */
#an-sel .pt-nav__b.lp-on{position:relative;color:#f1cf6a;cursor:default;text-shadow:0 0 16px rgba(232,184,75,.55),0 0 2px rgba(232,184,75,.35),0 1px 4px rgba(0,0,0,.9)}
#an-sel .pt-nav__b.lp-on:hover{color:#f6dc8a;background:transparent}
#an-sel .pt-nav__b.lp-on::before{content:"";position:absolute;left:0;right:0;top:calc(50% + 7px);height:22px;pointer-events:none;background:radial-gradient(ellipse 60% 100% at 50% 100%,rgba(232,184,75,.42),rgba(232,184,75,.12) 45%,transparent 72%)}
#an-sel .pt-nav__b.lp-on::after{content:"";position:absolute;left:2px;right:2px;top:calc(50% + 26px);height:3px;pointer-events:none;border-radius:3px;background:radial-gradient(ellipse 50% 100% at 50% 100%,#fff3c4 0%,#E8B84B 30%,rgba(232,184,75,.55) 60%,transparent 100%)}
/* boton unico wallet+suscripcion */
#an-sel .an-wpill{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px;border-radius:9px;font-family:var(--mono);font-size:12px;font-weight:700;color:var(--ink2);background:rgba(255,255,255,.05);border:1px solid var(--line2);white-space:nowrap}
#an-sel .an-wpill[hidden]{display:none}
#an-sel .an-wpill .an-w4{letter-spacing:.5px}
#an-sel .an-wpill .an-wsep{opacity:.5}
#an-sel .an-wpill .an-wd{color:var(--gold);letter-spacing:.3px}
#an-sel .c-contratos{display:inline-flex;align-items:center;height:36px;padding:0 15px;border:1px solid var(--gold);border-radius:9px;color:var(--gold);background:rgba(232,184,75,.08);font-family:var(--disp);font-weight:700;font-size:12.5px;letter-spacing:.3px;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.9)}
#an-sel .c-contratos:hover{background:rgba(232,184,75,.16)}

/* ── Catalogo (scroll infinito, sin banda negra) ── */
#an-sel .an-cat{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;position:relative;z-index:2}
#an-sel .an-cat::-webkit-scrollbar{width:0;height:0;display:none}
#an-sel .an-cat-in{width:100%;max-width:1200px;margin:0 auto;padding:18px clamp(14px,3vw,30px) 40px}
#an-sel .an-cat-hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px}
#an-sel .an-search{flex:1 1 300px;min-width:0;display:flex;align-items:center;gap:9px;height:42px;padding:0 14px;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid #2a333f;border-radius:11px;color:var(--ink3);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
#an-sel .an-search:focus-within{border-color:var(--gold-lo)}
#an-sel .an-search input{flex:1;min-width:0;background:none;border:0;outline:0;color:#eaecef;font-family:inherit;font-size:14px}
#an-sel .an-search input::placeholder{color:#6d7681}
/* chips = MISMO boton de Terminal (negro con borde; activo = texto/borde dorado, sin relleno) */
#an-sel .an-chip{display:inline-flex;align-items:center;justify-content:center;height:42px;padding:0 18px;border-radius:11px;border:1px solid #2a333f;background:linear-gradient(180deg,#1b2027,#0d1117);color:#b7bdc6;font-family:var(--disp);font-weight:700;font-size:12.5px;letter-spacing:.2px;white-space:nowrap;cursor:pointer;box-shadow:0 3px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06);transition:color .15s,border-color .15s}
#an-sel .an-chip:hover{color:#eaecef;border-color:var(--gold-lo)}
#an-sel .an-chip.on{color:#f1cf6a;border-color:rgba(232,184,75,.55)}
#an-sel .an-chip:active{transform:translateY(2px);box-shadow:0 1px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06)}

/* rejilla 4 col, tarjetas de IGUAL alto y ancho */
#an-sel .an-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:stretch}
#an-sel .an-card{display:flex;flex-direction:column;text-align:left;font-family:inherit;color:inherit;background:linear-gradient(180deg,#121820,#0b0e12);border:1px solid #232b36;border-radius:16px;overflow:hidden;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.04);transform-style:preserve-3d;transition:transform .15s ease,border-color .14s,box-shadow .18s;will-change:transform}
#an-sel .an-card:hover{border-color:var(--gold);box-shadow:0 18px 44px rgba(232,184,75,.14)}
#an-sel .an-card.soon{cursor:default}
#an-sel .an-media{position:relative;width:100%;aspect-ratio:16/9;flex:0 0 auto;border-radius:16px 16px 0 0;overflow:hidden}
#an-sel .an-img{position:absolute;inset:0;background:#0e1319 center/cover no-repeat;border-bottom:1px solid #1c232b}
#an-sel .an-img.ph{display:grid;place-items:center}
#an-sel .an-img.ph::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:20px 20px;opacity:.35}
#an-sel .an-img.ph-indicator{background:radial-gradient(circle at 50% 40%,rgba(46,189,133,.3),rgba(10,14,18,.2))}
#an-sel .an-img.ph-strategy{background:radial-gradient(circle at 50% 40%,rgba(74,163,255,.3),rgba(10,14,18,.2))}
#an-sel .an-ph-ini{position:relative;z-index:1;font-size:44px;font-weight:900;color:rgba(255,255,255,.22)}
#an-sel .an-badge{position:absolute;top:9px;left:9px;z-index:2;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:4px 9px;border-radius:100px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
#an-sel .an-badge-indicator{color:#5ff0b0;background:rgba(46,189,133,.16);border:1px solid rgba(46,189,133,.4)}
#an-sel .an-badge-analysis{color:#f1cf6a;background:rgba(232,184,75,.16);border:1px solid rgba(232,184,75,.42)}
#an-sel .an-badge-strategy{color:#9cc9ff;background:rgba(74,163,255,.16);border:1px solid rgba(74,163,255,.4)}
#an-sel .an-spot{position:absolute;top:9px;right:9px;z-index:2;display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#cdd5dd;background:rgba(5,7,10,.55);border:1px solid rgba(255,255,255,.14);border-radius:100px;padding:3px 8px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
#an-sel .an-spot svg{width:11px;height:11px;color:#2ebd85}
#an-sel .an-soon{position:absolute;top:50%;left:50%;z-index:2;transform:translate(-50%,-50%);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#cfd6dd;background:rgba(5,7,10,.6);border:1px solid rgba(255,255,255,.16);border-radius:100px;padding:6px 14px}
#an-sel .an-card.soon .an-img{filter:grayscale(.5) brightness(.72)}
/* cuerpo de ALTO FIJO → todas las tarjetas igual */
#an-sel .an-body{display:flex;flex-direction:column;padding:12px 13px 13px;height:112px}
#an-sel .an-nom{font-size:15px;font-weight:800;color:#eaecef;line-height:1.2;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#an-sel .an-lema{font-size:12px;color:#8b96a3;line-height:1.35;margin-bottom:auto;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#an-sel .an-open{text-align:center;font-size:12px;font-weight:800;color:var(--gold);border:1px solid rgba(232,184,75,.4);border-radius:10px;padding:8px;background:linear-gradient(180deg,#1b2027,#0d1117);box-shadow:0 2px 0 #060809;margin-top:10px}
#an-sel .an-card:hover .an-open{border-color:rgba(232,184,75,.7)}
#an-sel .an-card.soon .an-open{color:#79838f;border-color:#2b3340;background:rgba(255,255,255,.02);box-shadow:none}
#an-sel .an-open.load{color:var(--ink2);border-color:#2b3340}
#an-sel .an-empty{text-align:center;color:#8b96a3;font-size:14px;padding:50px 0}

/* toast */
#an-sel .an-toast{position:fixed;left:50%;bottom:30px;z-index:40;transform:translateX(-50%) translateY(14px);opacity:0;pointer-events:none;background:rgba(12,16,22,.96);border:1px solid var(--line2);color:#eaecef;font-size:13px;font-weight:600;padding:11px 20px;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.55);transition:opacity .2s,transform .2s}
#an-sel .an-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}

/* ── Responsive (IGUAL que las aprobadas: overflow del nav SOLO 761–1120) ── */
@media(max-width:1340px){#an-sel .pt-nav__b{font-size:12.5px;padding:8px 8px}}
@media(max-width:1200px){#an-sel .pt-nav{margin-left:8px}#an-sel .pt-nav__b{font-size:12px;padding:7px 6px;gap:4px}#an-sel .pt-logo img{width:124px;height:auto}#an-sel .an-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:1120px) and (min-width:761px){
  #an-sel .pt-nav{flex:1 1 auto;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;mask-image:linear-gradient(90deg,#000 calc(100% - 22px),transparent)}
  #an-sel .pt-nav::-webkit-scrollbar{display:none}
  #an-sel .pt-hdr__a{flex:0 0 auto}
}
@media(max-width:760px){
  #an-sel .pt-nav{display:none}
  #an-sel .an-grid{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:560px){#an-sel .c-contratos{display:none}}
@media(max-width:480px){#an-sel .an-grid{grid-template-columns:1fr}#an-sel .an-search{flex:1 1 100%}}

/* ── Boton carrito (header) ── */
#an-sel .an-cartbtn{position:relative;width:42px;height:42px;flex:0 0 auto;display:grid;place-items:center;border-radius:11px;border:1px solid #2a333f;background:linear-gradient(180deg,#1b2027,#0d1117);color:#b7bdc6;cursor:pointer;box-shadow:0 3px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06);transition:color .15s,border-color .15s}
#an-sel .an-cartbtn:hover{color:#eaecef;border-color:var(--gold-lo)}
#an-sel .an-cartbtn:active{transform:translateY(2px);box-shadow:0 1px 0 #060809}
#an-sel .an-cartn{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;display:none;place-items:center;border-radius:100px;background:linear-gradient(180deg,#f4d089,#E8B84B 60%,#cf9f2e);color:#241900;font-family:var(--mono);font-size:10.5px;font-weight:800}

/* ── Modales (popup de servicio + carrito) ── */
#an-sel .an-modal{position:fixed;inset:0;z-index:60;display:grid;place-items:center;opacity:0;transition:opacity .18s;padding:20px}
#an-sel .an-modal.on{opacity:1}
#an-sel .an-modal-bg{position:absolute;inset:0;background:rgba(3,5,8,.72);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
#an-sel .an-modal-card{position:relative;z-index:1;width:100%;max-width:720px;max-height:88vh;overflow-y:auto;scrollbar-width:none;background:linear-gradient(180deg,#121820,#0b0e12);border:1px solid #2a333f;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.05);transform:translateY(8px) scale(.98);transition:transform .18s}
#an-sel .an-modal-card::-webkit-scrollbar{display:none}
#an-sel .an-modal.on .an-modal-card{transform:none}
#an-sel .an-modal-x{position:absolute;top:12px;right:12px;z-index:3;width:34px;height:34px;display:grid;place-items:center;border-radius:9px;border:1px solid var(--line2);background:rgba(255,255,255,.04);color:var(--ink2);cursor:pointer}
#an-sel .an-modal-x:hover{color:var(--gold);border-color:var(--gold-lo)}
#an-sel .an-srv-grid{display:grid;grid-template-columns:1fr 300px}
#an-sel .an-srv-info{padding:22px 22px 20px;display:flex;flex-direction:column}
#an-sel .an-srv-info .an-badge{position:static;align-self:flex-start;margin-bottom:12px}
#an-sel .an-srv-nom{font-size:21px;font-weight:900;color:#eaecef;margin:0 0 8px}
#an-sel .an-srv-desc{font-size:13px;line-height:1.55;color:#c4ccd4;margin:0 0 14px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
#an-sel .an-srv-acts{display:flex;flex-direction:column;gap:9px;margin-top:auto}
#an-sel .an-pay{display:inline-flex;align-items:center;justify-content:center;height:46px;border-radius:12px;border:1px solid #2a333f;background:linear-gradient(180deg,#1b2027,#0d1117);color:#eaecef;font-family:var(--disp);font-weight:700;font-size:13.5px;cursor:pointer;box-shadow:0 3px 0 #060809;transition:border-color .14s}
#an-sel .an-pay:hover{border-color:var(--gold-lo)}
#an-sel .an-pay:active{transform:translateY(2px);box-shadow:0 1px 0 #060809}
#an-sel .an-pay.gold{border-color:var(--gold-md);background:linear-gradient(180deg,#f4d089,#E8B84B 55%,#cf9f2e);color:#241900;box-shadow:0 3px 0 #8f6a1a}
#an-sel .an-pay.gold:active{box-shadow:0 1px 0 #8f6a1a}
#an-sel .an-cart-add{height:42px;border-radius:12px;border:1px dashed #3a4552;background:transparent;color:var(--ink2);font-family:var(--disp);font-weight:700;font-size:12.5px;cursor:pointer;transition:color .14s,border-color .14s}
#an-sel .an-cart-add:hover{color:#eaecef;border-color:var(--gold-lo)}
#an-sel .an-cart-add.on{color:#5ff0b0;border-color:rgba(46,189,133,.5);border-style:solid}
#an-sel .an-srv-open{margin-top:12px;height:44px;border-radius:12px;border:1px solid rgba(232,184,75,.4);background:rgba(232,184,75,.08);color:var(--gold);font-family:var(--disp);font-weight:800;font-size:13px;cursor:pointer}
#an-sel .an-srv-open:hover{background:rgba(232,184,75,.16)}
#an-sel .an-srv-soon{margin-top:12px;text-align:center;font-size:12px;color:#79838f;padding:11px;border:1px solid #2b3340;border-radius:12px}
#an-sel .an-srv-media{position:relative;min-height:280px;border-left:1px solid #1c232b;border-radius:0 20px 20px 0;overflow:hidden}
#an-sel .an-srv-img{position:absolute;inset:0;background:#0e1319 center/cover no-repeat}
#an-sel .an-srv-img.ph{display:grid;place-items:center}
#an-sel .an-srv-img.ph.ph-indicator{background:radial-gradient(circle at 50% 40%,rgba(46,189,133,.3),rgba(10,14,18,.4))}
#an-sel .an-srv-img.ph.ph-strategy{background:radial-gradient(circle at 50% 40%,rgba(74,163,255,.3),rgba(10,14,18,.4))}
#an-sel .an-cart-card{max-width:460px;padding:26px 24px 24px}
#an-sel .an-cart-list{display:flex;flex-direction:column;gap:8px;margin:14px 0}
#an-sel .an-cart-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border:1px solid #232b36;border-radius:12px;background:rgba(255,255,255,.02)}
#an-sel .an-cart-it-n b{display:block;font-size:14px;font-weight:700;color:#eaecef}
#an-sel .an-cart-it-n span{display:block;font-size:11.5px;color:#8b96a3;margin-top:2px}
#an-sel .an-cart-rm{width:30px;height:30px;flex:0 0 auto;display:grid;place-items:center;border-radius:8px;border:1px solid var(--line2);background:transparent;color:#8b96a3;cursor:pointer}
#an-sel .an-cart-rm:hover{color:#f6465d;border-color:rgba(246,70,93,.5)}
#an-sel .an-cart-tot{display:flex;align-items:center;justify-content:space-between;padding:12px 2px;margin-bottom:12px;border-top:1px solid #232b36;font-size:13px;color:#c4ccd4}
#an-sel .an-cart-tot b{color:#eaecef;font-family:var(--mono)}
#an-sel .an-cart-empty{text-align:center;color:#8b96a3;font-size:13.5px;line-height:1.6;padding:24px 10px}
#an-sel .an-srv-hint{margin-top:10px;font-size:11.5px;color:#8b96a3;text-align:center}
#an-sel .an-cart-desc{display:flex;align-items:center;justify-content:center;gap:5px;margin:4px 0 10px;padding:9px;border-radius:10px;background:rgba(46,189,133,.08);border:1px solid rgba(46,189,133,.28);color:#8ef0b0;font-size:12px;font-weight:600}
#an-sel .an-cart-desc b{color:#5ff0b0}
#an-sel .an-cart-tot s{color:#6d7681;font-weight:400;margin-right:2px}
/* boton Collaboration (izquierda del buscador) */
#an-sel .an-colab{display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 15px;flex:0 0 auto;border-radius:11px;border:1px solid #2a333f;background:linear-gradient(180deg,#1b2027,#0d1117);color:#b7bdc6;font-family:var(--disp);font-weight:700;font-size:12.5px;cursor:pointer;box-shadow:0 3px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06);transition:color .15s,border-color .15s}
#an-sel .an-colab:hover{color:var(--gold);border-color:var(--gold-lo)}
#an-sel .an-colab:active{transform:translateY(2px);box-shadow:0 1px 0 #060809}
#an-sel .an-colab svg{color:var(--gold)}
/* modal colaboracion */
#an-sel .an-colab-card{max-width:480px;padding:0 26px 26px;text-align:center}
#an-sel .an-colab-corona{display:block;width:100%;max-width:300px;height:auto;margin:8px auto 2px;filter:drop-shadow(0 10px 22px rgba(0,0,0,.5))}
#an-sel .an-colab-t{font-size:23px;font-weight:900;color:#eaecef;margin:0 0 8px}
#an-sel .an-colab-sub{text-align:left;font-size:13px;line-height:1.6;color:#c4ccd4;margin:2px 0 12px}
#an-sel .an-colab-list{text-align:left;margin:0 0 18px;padding:0 0 0 20px;display:flex;flex-direction:column;gap:7px}
#an-sel .an-colab-list li{font-size:12.5px;line-height:1.5;color:#c4ccd4}
#an-sel .an-colab-list li::marker{color:var(--gold)}
#an-sel .an-colab-mailbox{display:flex;align-items:center;gap:8px;margin:2px 0 16px;padding:8px 8px 8px 14px;border:1px solid var(--line2);border-radius:12px;background:rgba(232,184,75,.06)}
#an-sel .an-colab-addr{flex:1;min-width:0;font-family:var(--mono);font-size:13px;font-weight:700;color:var(--gold);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
#an-sel .an-colab-copy{flex:0 0 auto;width:36px;height:36px;display:grid;place-items:center;border-radius:9px;border:1px solid var(--line2);background:rgba(255,255,255,.04);color:var(--ink2);cursor:pointer}
#an-sel .an-colab-copy:hover{color:var(--gold);border-color:var(--gold-lo)}
#an-sel .an-colab-copy.ok{color:#5ff0b0;border-color:rgba(46,189,133,.5)}
#an-sel .an-colab-mail{width:100%;text-decoration:none}
#an-sel .an-f-lbl{display:block;text-align:left;font-size:12px;font-weight:700;color:#a7b0bb;margin:14px 0 7px}
#an-sel .an-f-lbl span{color:#79838f;font-weight:500}
#an-sel .an-f-seg{display:flex;gap:7px}
#an-sel .an-f-seg button{flex:1;height:40px;border-radius:10px;border:1px solid #2a333f;background:linear-gradient(180deg,#1b2027,#0d1117);color:#b7bdc6;font-family:var(--disp);font-weight:700;font-size:12.5px;cursor:pointer}
#an-sel .an-f-seg button:hover{border-color:var(--gold-lo)}
#an-sel .an-f-seg button.on{color:#f1cf6a;border-color:rgba(232,184,75,.55)}
#an-sel .an-f-in{width:100%;background:#0d1117;border:1px solid #2a333f;border-radius:10px;color:#eaecef;font-family:inherit;font-size:13.5px;padding:11px 13px;outline:0}
#an-sel .an-f-in:focus{border-color:var(--gold-lo)}
#an-sel .an-f-in::placeholder{color:#6d7681}
#an-sel .an-f-ta{min-height:88px;resize:vertical;line-height:1.5}
#an-sel .an-colab-nota{text-align:left;font-size:11.5px;line-height:1.5;color:#8b96a3;margin:14px 0 16px}
#an-sel .an-colab-card .an-pay{width:100%}
#an-sel .an-colab-msg{font-size:12.5px;color:#8ef0b0;margin-top:12px;min-height:16px}
@media(max-width:620px){#an-sel .an-colab span{display:none}}
/* precio con BNB en el popup */
#an-sel .an-srv-precio{display:flex;gap:10px;margin-bottom:14px}
#an-sel .an-pp{flex:1;padding:12px;border:1px solid #232b36;border-radius:12px;background:rgba(255,255,255,.02);text-align:center}
#an-sel .an-pp span{display:block;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#8b96a3;margin-bottom:4px}
#an-sel .an-pp b{display:block;font-size:22px;font-weight:900;color:#eaecef;line-height:1.1}
#an-sel .an-pp i{display:block;font-style:normal;font-family:var(--mono);font-size:11px;color:var(--gold);margin-top:3px}
#an-sel .an-cart-bnb{text-align:right;font-family:var(--mono);font-size:11px;color:var(--gold);margin:-6px 0 12px}
#an-sel .an-pay.off{opacity:.5;cursor:not-allowed}
/* footer disclaimer */
#an-sel .an-foot{text-align:center;padding:22px 0 6px}
/* Botón NEGRO (mismo sistema que los chips de Terminal), no texto subrayado. */
#an-sel .an-disc-link{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 22px;border-radius:11px;
  border:1px solid #2a333f;background:linear-gradient(180deg,#1b2027,#0d1117);color:#c3cad3;
  font-family:var(--disp);font-weight:700;font-size:12.5px;letter-spacing:.3px;cursor:pointer;
  box-shadow:0 3px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06);transition:color .15s,border-color .15s,transform .05s,box-shadow .05s}
#an-sel .an-disc-link:hover{color:#f1cf6a;border-color:rgba(232,184,75,.55)}
#an-sel .an-disc-link:active{transform:translateY(2px);box-shadow:0 1px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06)}
#an-sel .an-disc-link svg{opacity:.85;flex:0 0 auto}
/* modal disclaimer */
#an-sel .an-disc-card{max-width:600px;padding:0}
#an-sel .an-disc-box{display:flow-root;padding:24px 26px 22px;text-align:left}
#an-sel .an-disc-top{display:none}
#an-sel .an-disc-fl{float:right;width:132px;height:132px;margin:2px 0 8px 20px;shape-outside:margin-box;filter:drop-shadow(0 8px 18px rgba(0,0,0,.5))}
#an-sel .an-disc-box p{font-size:12.8px;line-height:1.65;color:#c4ccd4;margin:0 0 12px}
#an-sel .an-disc-ok{clear:both;width:100%;margin-top:4px}
@media(max-width:620px){
  #an-sel .an-modal{padding:12px}
  #an-sel .an-cat-hd{gap:8px}
  #an-sel .an-search{flex:1 1 100%;order:-1}
  #an-sel .an-chip{flex:1}
  #an-sel .an-srv-grid{grid-template-columns:1fr}
  #an-sel .an-srv-media{min-height:150px;border-left:0;border-bottom:1px solid #1c232b;border-radius:20px 20px 0 0;order:-1}
  #an-sel .an-srv-info{padding:18px}
  #an-sel .an-colab-card{padding:0 18px 20px}
  #an-sel .an-colab-corona{max-width:230px}
  #an-sel .an-disc-box{padding:18px;text-align:center}
  #an-sel .an-disc-box p{text-align:left}
  #an-sel .an-disc-fl{display:none}
  #an-sel .an-disc-top{display:block;width:100px;margin:2px auto 12px}
}
@media(max-width:400px){
  #an-sel .an-modal{padding:8px}
  #an-sel .an-srv-precio{gap:7px}
  #an-sel .an-pp b{font-size:19px}
}
`;
