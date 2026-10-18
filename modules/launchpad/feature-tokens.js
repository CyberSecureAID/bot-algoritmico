/* launchpad/feature-tokens.js. Seccion PREMIUM del lobby (Feature Tokens).
   Contrato NUEVO e independiente (FEATURE_TOKENS, proxy UUPS): 50 espacios por suscripcion mensual
   en BNB. Este modulo SOLO pinta la seccion y habla con ese contrato via motor.js. No toca New Tokens.

   Dinamica de orden (clave): la posicion 1 es la mas cara y la mas visible; la 50 la mas barata.
   El numero de posicion es el ranking. En pantalla se muestran SOLO las posiciones ocupadas,
   ordenadas por numero ascendente y COMPACTADAS (sin huecos): quien compra la 50 estando solo sale
   primero; si otro compra la 30 va por delante, etc. Siempre hay un boton para comprar un espacio.

   Idiomas: se elige ES/EN con el sistema existente (idioma.idiomaActual()); por defecto el launchpad
   va en ingles. Sellado: no importa nada de fuera del modulo. */

import * as wallet from './wallet.js';
import * as ethers from './ethers.min.js';
import * as gb from './motor.js';
import { leerMonedas } from './firebase-tokens.js';
import { idiomaActual } from './idioma.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const corto = (a) => a ? String(a).slice(0, 6) + '…' + String(a).slice(-4) : '';
const CERO = '0x0000000000000000000000000000000000000000';
const esCero = (a) => !a || String(a).toLowerCase() === CERO;
/* idioma: L(es, en) devuelve el texto en el idioma activo. */
const L = (es, en) => (idiomaActual() === 'es' ? es : en);
const usdTxt = (wei) => { try { const n = Number(ethers.formatEther(wei)); return '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 }); } catch (_) { return '$0'; } };
const bnbTxt = (wei) => { try { return Number(ethers.formatEther(wei)).toFixed(4) + ' BNB'; } catch (_) { return '0 BNB'; } };
const ICO_COPY = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const ICO_BNB = '<svg viewBox="0 0 126.61 126.61" width="13" height="13" aria-hidden="true"><g fill="#F3BA2F"><path d="M38.73 53.2 63.3 28.63l24.6 24.6 14.3-14.31L63.3 0 24.42 38.89z"/><path d="M0 63.3l14.3-14.3 14.31 14.3-14.31 14.3z"/><path d="M38.73 73.41 63.3 97.98l24.59-24.58 14.31 14.29-38.9 38.91L24.42 87.7z"/><path d="M98 63.3l14.3-14.3 14.31 14.3-14.31 14.31z"/><path d="M77.83 63.3 63.3 48.77 52.56 59.51l-1.24 1.23-2.54 2.55 14.52 14.53z"/></g></svg>';

const MIN_VISIBLE = 5;     // la seccion muestra siempre al menos 5 (en filas de 5); crece hacia abajo
const EJEMPLO_LOGOS = ['./img/featured-1.webp', './img/featured-2.webp', './img/featured-3.webp', './img/featured-4.webp', './img/featured-5.webp'];
let _estado = null;        // ultimo estadoEspacios()
let _logos = {};           // cache de logos por direccion (minuscula)
let _meta = {};            // cache de {nombre, simbolo} on-chain por direccion (minuscula)
const LOCK_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const CHEV_UP = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
const CHEV_DOWN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const ICO_WARN = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

/* ───────── Montaje ───────── */
export async function montar() {
  const host = $('lpl-ft'); if (!host) return;
  host.innerHTML = cascaraCargando();
  try { _estado = await gb.ftEstado(); } catch (_) { _estado = []; }
  await cargarLogos();
  pintar();
  // Liquidez de los ocupados en segundo plano: marca "0 liquidity" a los que no tienen pool real.
  enriquecerLiquidez();
}

function cascaraCargando() {
  return `<div class="lpl-ft-head"><div class="lpl-ft-tt"><span class="lpl-ft-ico">${ICO_BNB}</span><div class="lpl-ft-txt"><b>${esc(L('Tokens Premium', 'Premium Tokens'))}</b><span>${esc(L('Los espacios mas vistos del Launchpad', 'The most visible spots on the Launchpad'))}</span></div></div></div>
    <div class="lpl-ft-grid">${'<div class="lpl-ft-skel"></div>'.repeat(6)}</div>`;
}

async function cargarLogos() {
  try {
    const dirs = (_estado || []).filter((e) => e.estado !== 0 && !esCero(e.token)).map((e) => e.token);
    if (!dirs.length) return;
    // Logos (un lote REST) y nombres on-chain (name() por token) en paralelo.
    const [m, metas] = await Promise.all([
      leerMonedas(dirs).catch(() => ({})),
      Promise.all(dirs.map((a) => gb.metaToken(a).catch(() => null)))
    ]);
    for (const k in m) if (m[k] && m[k].logo) _logos[k] = m[k].logo;
    dirs.forEach((a, i) => { const meta = metas[i]; if (meta) _meta[String(a).toLowerCase()] = { nombre: meta.nombre || '', simbolo: meta.simbolo || '' }; });
  } catch (_) {}
}

/* ───────── Pintado ───────── */
function pintar() {
  const host = $('lpl-ft'); if (!host) return;
  // Ocupadas (activas o en gracia), ordenadas por numero de posicion ascendente, compactadas.
  const ocupadas = (_estado || []).filter((e) => e.estado !== 0 && !esCero(e.token)).sort((a, b) => a.slot - b.slot);
  // Siempre en filas de 5: minimo 5, y si se ocupan mas, crece a la siguiente fila completa (hasta 50).
  const total = Math.min(50, Math.max(MIN_VISIBLE, Math.ceil(ocupadas.length / 5) * 5));
  const faltan = total - ocupadas.length;

  let rank = 0;
  const cards = [];
  for (const e of ocupadas) { rank++; cards.push(cardOcupada(e, rank)); }
  for (let i = 0; i < faltan; i++) { cards.push(cardLibre(i)); }

  const head = `<div class="lpl-ft-head">
      <div class="lpl-ft-tt"><span class="lpl-ft-ico">${ICO_BNB}</span><div class="lpl-ft-txt"><b>${esc(L('Tokens Premium', 'Premium Tokens'))}</b><span>${esc(L('Los espacios mas vistos del Launchpad', 'The most visible spots on the Launchpad'))}</span></div></div>
      <div class="lpl-ft-acts">
        <button class="lpl-ft-cta" id="lpl-ft-lyt" type="button">${esc(L('List Your Token', 'List Your Token'))}</button>
        <button class="lpl-ft-cta" id="lpl-ft-get" type="button">${esc(L('Reservar un espacio', 'Get a spot'))}</button>
      </div>
    </div>`;
  host.innerHTML = head + `<div class="lpl-ft-grid">${cards.join('')}</div>`;

  const get = $('lpl-ft-get'); if (get) get.onclick = () => flujoComprar();
  // List Your Token: manda DIRECTO al swap con la ventana de listar abierta (sin disclaimer aqui; el
  // disclaimer de List your token sale alla, para no duplicarlo). Es navegacion, no importa del swap.
  const lyt = $('lpl-ft-lyt'); if (lyt) lyt.onclick = () => { location.href = '../swap/swap.html?abrir=listar'; };
  host.querySelectorAll('.lpl-ft-card[data-a]').forEach((c) => { c.onclick = () => { location.href = '?token=' + c.dataset.a; }; });
  host.querySelectorAll('.lpl-ft-card.libre').forEach((c) => { c.onclick = () => flujoComprar(); });
}

function logoHTML(addr, nombre) {
  const src = _logos[String(addr).toLowerCase()] || '';
  const ini = esc((String(nombre || '?').trim()[0] || '?').toUpperCase());
  return src
    ? `<span class="lpl-ft-logo"><img src="${esc(src)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="lpl-ft-logo-fb" style="display:none">${ini}</span></span>`
    : `<span class="lpl-ft-logo"><span class="lpl-ft-logo-fb">${ini}</span></span>`;
}

function cardOcupada(e, rank) {
  const m = _meta[String(e.token).toLowerCase()] || {};
  const nombre = e.nombre || m.nombre || corto(e.token);
  const sim = m.simbolo || '';
  const enGracia = e.estado === 2;
  return `<div class="lpl-ft-card${enGracia ? ' gracia' : ''}" data-a="${esc(e.token)}">
      <div class="lpl-ft-prem"><b>${rank}</b> Premium</div>
      ${logoHTML(e.token, nombre)}
      <div class="lpl-ft-id"><b>${esc(nombre)}</b>${sim ? `<i>${esc(sim)}</i>` : ''}</div>
    </div>`;
}

function cardLibre(i) {
  // Tarjeta de ejemplo: logo por defecto de la plataforma y nombre generico en ingles (sin nombres de
  // criptomonedas, para evitar temas de copyright). Al tocar, abre el flujo de reserva.
  const logo = EJEMPLO_LOGOS[i % EJEMPLO_LOGOS.length];
  return `<div class="lpl-ft-card libre">
      <div class="lpl-ft-tag">${esc(L('Libre', 'Available'))}</div>
      <span class="lpl-ft-logo"><img src="${logo}" alt="" loading="lazy" onerror="this.style.display='none'"></span>
      <div class="lpl-ft-id"><b class="lpl-ft-rent">${esc(L('Espacio disponible', 'Available spot'))}</b><span class="lpl-ft-from">${esc(L('Toca para reservar', 'Tap to rent'))}</span></div>
    </div>`;
}

/* Marca "0 liquidity" a los ocupados sin pool real. En segundo plano y SIN repintar la seccion: inyecta
   la pildora en la tarjeta ya pintada, para no interrumpir si el usuario esta interactuando. */
async function enriquecerLiquidez() {
  const ocup = (_estado || []).filter((e) => e.estado !== 0 && !esCero(e.token));
  if (!ocup.length) return;
  const bnb = await gb.precioBNBUSDT().catch(() => 0);
  await Promise.all(ocup.slice(0, 50).map(async (e) => {
    try {
      const r = await gb.resumenPool(e.token);
      const liqUsd = r.activo ? r.liquidez * (r.moneda === 'USDT' ? 1 : (bnb > 0 ? bnb : 0)) : 0;
      if (r.activo && liqUsd > 0) return;
      const host = $('lpl-ft'); if (!host) return;
      const card = host.querySelector(`.lpl-ft-card[data-a="${e.token}"]`);
      if (card && !card.querySelector('.lpl-ft-0liq')) card.insertAdjacentHTML('beforeend', '<span class="lpl-ft-0liq">0 Liquidity</span>');
    } catch (_) {}
  }));
}

/* ───────── Nombres de las monedas del usuario (para el selector) ───────── */
async function misMonedas() {
  const cta = wallet.cuentaActual && wallet.cuentaActual();
  if (!cta) return [];
  let addrs = [];
  try { addrs = (await gb.tokensDe(cta)).map(String).filter(Boolean); } catch (_) { addrs = []; }
  // dedup
  const vistos = new Set(); addrs = addrs.filter((a) => { const k = a.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; });
  const metas = await Promise.all(addrs.map((a) => gb.metaToken(a).catch(() => null)));
  const monedas = [];
  addrs.forEach((a, i) => { const m = metas[i]; monedas.push({ address: a, nombre: (m && m.nombre) || corto(a), simbolo: (m && m.simbolo) || '' }); });
  try { const lg = await leerMonedas(addrs).catch(() => ({})); for (const t of monedas) { const d = lg[t.address.toLowerCase()]; if (d && d.logo) _logos[t.address.toLowerCase()] = d.logo; } } catch (_) {}
  return monedas;
}

/* ───────── Overlay generico del flujo ───────── */
function cerrarOverlay() { const p = document.getElementById('lpl-ft-ovl'); if (p) p.remove(); }

async function asegurarWallet() {
  if (!(wallet.cuentaActual && wallet.cuentaActual())) { try { await wallet.conectar(); } catch (_) {} }
  if (!(wallet.cuentaActual && wallet.cuentaActual())) return false;
  try { if (wallet.esRedCorrecta && !wallet.esRedCorrecta()) await wallet.cambiarARedCorrecta(); } catch (_) {}
  return true;
}

/* ───────── Paso 1: disclaimer comercial + apto BlockAI ───────── */
function flujoComprar(slotSugerido) {
  const cuerpo = idiomaActual() === 'es' ? `
    <div class="ftd-warn">${ICO_WARN}<span>Pagar por un espacio premium compra visibilidad, no ventas. No prometemos compradores, ni volumen, ni precio, ni ningun resultado.</span></div>
    <div class="ftd">
      <div class="ftd-row"><span class="ftd-k">Que recibes</span><span class="ftd-v">Un espacio numerado en la parte de arriba del Launchpad por 30 dias. Mientras mas bajo el numero, mas arriba aparece tu token ante todo el que abra el Launchpad con tu enlace de DecFreedom.</span></div>
      <div class="ftd-row"><span class="ftd-k">Que NO prometemos</span><span class="ftd-v">Ventas, compradores, volumen, precio ni liquidez. Que tu token se venda depende de tu propio proyecto y de la promocion que hagas con tu enlace, no de nosotros.</span></div>
      <div class="ftd-row"><span class="ftd-k">Sin respaldo</span><span class="ftd-v">Un espacio no es una resena, auditoria ni recomendacion de DecFreedom. No revisamos ni avalamos ningun token.</span></div>
      <div class="ftd-row"><span class="ftd-k">Sin custodia</span><span class="ftd-v">Tu token y tus fondos siguen siendo tuyos. Solo cobramos la tarifa unica del espacio.</span></div>
      <div class="ftd-row"><span class="ftd-k">La tarifa</span><span class="ftd-v">Pagas el precio del espacio que elijas, una sola vez, en BNB al cambio del momento. El exceso se devuelve. No reembolsable. Renovable cada 30 dias. Puedes retirar tu token cuando quieras (sin reembolso).</span></div>
    </div>`
    : `
    <div class="ftd-warn">${ICO_WARN}<span>Paying for a premium spot buys visibility, not sales. We promise no buyers, no volume, no price, and no result.</span></div>
    <div class="ftd">
      <div class="ftd-row"><span class="ftd-k">What you get</span><span class="ftd-v">A numbered spot at the top of the Launchpad for 30 days. The lower the number, the higher your token shows to everyone who opens the Launchpad through your DecFreedom link.</span></div>
      <div class="ftd-row"><span class="ftd-k">Not promised</span><span class="ftd-v">Sales, buyers, volume, price or liquidity. Whether your token sells depends on your own project and the promotion you do with your link, not on us.</span></div>
      <div class="ftd-row"><span class="ftd-k">No endorsement</span><span class="ftd-v">A spot is not a review, audit or endorsement by DecFreedom. We do not vet or back any token.</span></div>
      <div class="ftd-row"><span class="ftd-k">No custody</span><span class="ftd-v">Your token and your funds stay yours. We only take the one-time spot fee.</span></div>
      <div class="ftd-row"><span class="ftd-k">The fee</span><span class="ftd-v">You pay the price of the spot you pick, once, in BNB at the live rate. Excess is refunded. Non-refundable. Renewable every 30 days. Remove your token anytime (no refund).</span></div>
    </div>`;
  overlayWrap(`<button class="lpl-ft-x" type="button" aria-label="Close">✕</button>
    <img class="lpl-ft-seal" src="./img/disclaimer.webp" alt="" onerror="this.style.display='none'">
    <h3 class="lpl-ft-ov-t cen">${esc(L('Antes de pagar, lee esto', 'Before you pay, read this'))}</h3>
    <div class="lpl-ft-ov-body">${cuerpo}</div>
    <div class="lpl-ft-ov-acts cen"><button class="lpl-ft-b gris" type="button" id="ft-d-no">${esc(L('Cancelar', 'Cancel'))}</button><button class="lpl-ft-b" type="button" id="ft-d-ok">${esc(L('Entiendo', 'I understand'))}</button></div>`);
  $('ft-d-no').onclick = cerrarOverlay;
  $('ft-d-ok').onclick = () => elegirUbicacion(Number.isInteger(slotSugerido) ? slotSugerido : null);
}
function overlayWrap(inner) { const d = document.createElement('div'); d.id = 'lpl-ft-ovl'; d.className = 'lpl-ft-ov'; cerrarOverlay(); d.innerHTML = `<div class="lpl-ft-ov-card">${inner}</div>`; document.body.appendChild(d); d.addEventListener('click', (e) => { if (e.target === d) cerrarOverlay(); }); const x = d.querySelector('.lpl-ft-x'); if (x) x.onclick = cerrarOverlay; return d; }

/* ───────── Paso 3: elegir una de MIS monedas (lista apilada, mismo formato, sin desborde) ───────── */
async function elegirMoneda(slot, usd, bnbWei) {
  if (!(await asegurarWallet())) { overlayWrap(avisoSimple(L('Conecta tu wallet', 'Connect your wallet'), L('Conecta tu wallet para elegir una de tus monedas.', 'Connect your wallet to choose one of your tokens.'))); return; }
  overlayWrap(`<button class="lpl-ft-x" type="button">✕</button><h3 class="lpl-ft-ov-t">${esc(L('Elige tu moneda', 'Choose your token'))}</h3><div class="lpl-ft-ov-sub">${esc(L('Posicion', 'Spot'))} <b style="color:var(--gold)">#${slot + 1}</b> · ${esc(usd)} <i>${esc(L('/ 30 dias', '/ 30 days'))}</i></div><div class="lpl-ft-ov-body"><div class="lpl-ft-load">${esc(L('Cargando tus monedas…', 'Loading your tokens…'))}</div></div>`);
  const monedas = await misMonedas();
  if (!document.getElementById('lpl-ft-ovl')) return;
  const body = document.querySelector('#lpl-ft-ovl .lpl-ft-ov-body');
  if (!monedas.length) { if (body) body.innerHTML = `<div class="lpl-ft-empty-msg">${esc(L('No encontramos monedas creadas por esta wallet.', 'We found no tokens created by this wallet.'))}</div>`; return; }
  if (body) body.innerHTML = `<div class="lpl-ft-toklist">${monedas.map((t) => `
      <button type="button" class="lpl-ft-tok" data-a="${esc(t.address)}" data-n="${esc(t.nombre)}">
        ${logoHTML(t.address, t.nombre)}
        <span class="lpl-ft-tok-id"><b>${esc(t.nombre)}</b><i>${esc(t.simbolo)}</i></span>
        <span class="lpl-ft-tok-c" data-copy="${esc(t.address)}" title="${esc(L('Copiar contrato', 'Copy contract'))}">${corto(t.address)} ${ICO_COPY}</span>
      </button>`).join('')}</div>`;
  document.querySelectorAll('#lpl-ft-ovl .lpl-ft-tok').forEach((b) => {
    b.onclick = (ev) => { if (ev.target.closest('.lpl-ft-tok-c')) { ev.stopPropagation(); try { navigator.clipboard.writeText(b.dataset.a); } catch (_) {} return; } confirmarPago(slot, b.dataset.a, b.dataset.n, usd, bnbWei); };
  });
}

/* ───────── Paso 2: elegir UBICACION con una rueda tipo calendario (numero centrado + precio al lado) ───────── */
function elegirUbicacion(slotSugerido) {
  const todas = (_estado || []).slice().sort((a, b) => a.slot - b.slot);
  if (!todas.length) { overlayWrap(avisoSimple(L('Un momento', 'One moment'), L('Cargando los espacios…', 'Loading the spots…'))); montar().catch(() => {}); return; }
  const libres = todas.filter((e) => e.estado === 0);
  if (!libres.length) {
    const prox = todas.filter((e) => e.estado !== 0).reduce((m, e) => Math.min(m, e.expira + 86400), Infinity);
    const txt = isFinite(prox) ? new Date(prox * 1000).toLocaleDateString() : '';
    overlayWrap(avisoSimple(L('No hay espacios libres', 'No spots available'), L('Ahora mismo los 50 espacios estan ocupados. El proximo se libera el ', 'All 50 spots are taken right now. The next one frees up on ') + txt + '.'));
    return;
  }
  const items = todas.map((e) => (e.estado !== 0)
    ? `<div class="ftw-opt taken"><span>${e.pos}</span>${LOCK_SVG}</div>`
    : `<div class="ftw-opt">${e.pos}</div>`).join('');
  const tomadas = todas.filter((e) => e.estado !== 0).length;
  overlayWrap(`<button class="lpl-ft-x" type="button">✕</button>
    <h3 class="lpl-ft-ov-t">${esc(L('Elige tu ubicacion', 'Choose your spot'))}</h3>
    <div class="lpl-ft-ov-sub">${esc(L('Desliza o usa las flechas. Mas bajo = mas arriba y mas caro. ', 'Scroll or use the arrows. Lower = higher and pricier. '))}<b style="color:var(--gold)">${tomadas}/50</b> ${esc(L('ocupadas.', 'taken.'))}</div>
    <div class="ftw-box">
      <div class="ftw-stage">
        <button class="ftw-nav" type="button" id="ftw-up" aria-label="${esc(L('Subir', 'Up'))}">${CHEV_UP}</button>
        <div class="ftw"><div class="ftw-band"></div><div class="ftw-wheel" id="ftw-wheel"><div class="ftw-pad"></div>${items}<div class="ftw-pad"></div></div></div>
        <button class="ftw-nav" type="button" id="ftw-down" aria-label="${esc(L('Bajar', 'Down'))}">${CHEV_DOWN}</button>
      </div>
      <div class="ftw-price" id="ftw-price">
        <span class="ftw-eyebrow">${esc(L('Posicion', 'Spot'))} <b class="ftw-pos" id="ftw-pos">#1</b></span>
        <b class="ftw-val" id="ftw-val">$0</b>
        <span class="ftw-per" id="ftw-per">${esc(L('por 30 dias', 'per 30 days'))}</span>
      </div>
    </div>
    <div class="lpl-ft-ov-acts"><button class="lpl-ft-b gris" type="button" id="ft-u-no">${esc(L('Atras', 'Back'))}</button><button class="lpl-ft-b" type="button" id="ft-u-ok">${esc(L('Confirmar ubicacion', 'Confirm spot'))}</button></div>`);
  $('ft-u-no').onclick = () => flujoComprar(Number.isInteger(slotSugerido) ? slotSugerido : null);
  const wheel = $('ftw-wheel'); const ITEM = 40;
  const opts = Array.from(wheel.querySelectorAll('.ftw-opt'));
  let selIdx = 0;
  function pintaSel() {
    const idx = Math.max(0, Math.min(opts.length - 1, Math.round(wheel.scrollTop / ITEM)));
    selIdx = idx;
    opts.forEach((o, i) => o.classList.toggle('is-sel', i === idx));
    const e = todas[idx]; const taken = !e || e.estado !== 0;
    const posEl = $('ftw-pos'), valEl = $('ftw-val'), perEl = $('ftw-per'), box = $('ftw-price'), ok = $('ft-u-ok');
    if (posEl) posEl.textContent = '#' + (e ? e.pos : idx + 1);
    if (valEl) valEl.textContent = taken ? L('Ocupada', 'Taken') : usdTxt(e.precioUSD);
    if (perEl) perEl.textContent = taken ? L('elige otra', 'pick another') : L('por 30 dias', 'per 30 days');
    if (box) box.classList.toggle('taken', taken);
    if (ok) ok.disabled = taken;
  }
  let t = null;
  wheel.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(pintaSel, 55); }, { passive: true });
  opts.forEach((o, i) => { o.onclick = () => { wheel.scrollTo({ top: i * ITEM, behavior: 'smooth' }); setTimeout(pintaSel, 180); }; });
  const paso = (d) => { wheel.scrollBy({ top: d * ITEM, behavior: 'smooth' }); setTimeout(pintaSel, 170); };
  $('ftw-up').onclick = () => paso(-1);
  $('ftw-down').onclick = () => paso(1);
  // Posicion inicial: la sugerida (si esta libre) o la primera libre.
  let ini = todas.findIndex((e) => e.slot === slotSugerido && e.estado === 0);
  if (ini < 0) ini = todas.findIndex((e) => e.estado === 0);
  if (ini < 0) ini = 0;
  wheel.scrollTop = ini * ITEM; pintaSel();
  $('ft-u-ok').onclick = () => { const e = todas[selIdx]; if (!e || e.estado !== 0) return; elegirMoneda(e.slot, usdTxt(e.precioUSD), BigInt(e.precioBNB)); };
}

/* ───────── Paso 4: confirmar y pagar (una firma). Tras pagar NO queda ningun mensaje bloqueado. ───────── */
function confirmarPago(slot, token, nombre, usd, bnbWei) {
  const pos = slot + 1;
  overlayWrap(`<button class="lpl-ft-x" type="button">✕</button>
    <h3 class="lpl-ft-ov-t">${esc(L('Confirmar y pagar', 'Confirm & pay'))}</h3>
    <div class="lpl-ft-ov-body">
      <div class="lpl-ft-kv"><span>${esc(L('Token', 'Token'))}</span><b>${esc(nombre)}</b></div>
      <div class="lpl-ft-kv"><span>${esc(L('Posicion', 'Spot'))}</span><b>#${pos}</b></div>
      <div class="lpl-ft-kv"><span>${esc(L('Precio', 'Price'))}</span><b>${esc(usd)} <i>/ 30 ${esc(L('dias', 'days'))}</i></b></div>
      <div class="lpl-ft-kv"><span>${esc(L('A pagar ahora', 'You pay now'))}</span><b>${ICO_BNB} ${bnbTxt(bnbWei)}</b></div>
      <p class="lpl-ft-d-fine">${esc(L('Se cobra en BNB al cambio del momento. Se devuelve el exceso. Sin reembolsos.', 'Charged in BNB at the live rate. Any excess is refunded. No refunds.'))}</p>
    </div>
    <div class="lpl-ft-ov-acts"><button class="lpl-ft-b gris" type="button" id="ft-c-no">${esc(L('Atras', 'Back'))}</button><button class="lpl-ft-b" type="button" id="ft-c-ok">${esc(L('Pagar y ubicar', 'Pay & place'))}</button></div>
    <div class="lpl-ft-msg" id="ft-c-msg"></div>`);
  $('ft-c-no').onclick = () => elegirMoneda(slot, usd, bnbWei);
  $('ft-c-ok').onclick = async () => {
    const ok = $('ft-c-ok'), msg = $('ft-c-msg'); if (ok.disabled) return;
    ok.disabled = true; ok.textContent = L('Confirma en tu wallet…', 'Confirm in your wallet…');
    try {
      await gb.ftReservar(slot, token);
    } catch (e) {
      ok.disabled = false; ok.textContent = L('Pagar y ubicar', 'Pay & place');
      if (msg) msg.textContent = esRechazo(e) ? L('Cancelaste la firma.', 'You cancelled the signature.') : errTxt(e);
      return;
    }
    // Pago confirmado: cerrar el flujo, avisar y re-montar en segundo plano. Nunca deja un spinner colgado.
    avisoFinal(L('¡Listo! Tu token ya esta en el espacio premium.', 'Done! Your token is now in the premium spot.'));
    montar().catch(() => {});
  };
}

/* Retirar/renovar un espacio se hace desde "My Coins", no desde esta seccion (tarjeta limpia). */

/* ───────── Avisos ───────── */
function avisoSimple(titulo, cuerpo) {
  return `<button class="lpl-ft-x" type="button">✕</button><h3 class="lpl-ft-ov-t">${esc(titulo)}</h3><div class="lpl-ft-ov-body"><p>${esc(cuerpo)}</p></div><div class="lpl-ft-ov-acts"><button class="lpl-ft-b" type="button" onclick="(function(){var p=document.getElementById('lpl-ft-ovl');if(p)p.remove();})()">${esc(L('Entendido', 'Got it'))}</button></div>`;
}
function avisoFinal(txt) { overlayWrap(avisoSimple(L('Listo', 'Done'), txt)); }
const esRechazo = (e) => e && (e.code === 'ACTION_REJECTED' || /reject|denied|user\s*rejected/i.test((e && e.message) || ''));
const errTxt = (e) => (e && (e.shortMessage || e.reason || e.message)) ? String(e.shortMessage || e.reason || e.message).slice(0, 160) : L('Algo salio mal. Intenta de nuevo.', 'Something went wrong. Try again.');
