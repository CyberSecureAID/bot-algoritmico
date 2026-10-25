/* terminal/candado.js — Candado de suscripcion del Open Full Chart (Security Check + Protect).
   "Transparentado con trampa": sin suscripcion (y sin ser owner) la columna de seguridad NO se audita de verdad
   — se pinta un SEÑUELO borroso con dos tarjetas de EJEMPLO (roja 1% / verde 100%) y un boton de pago. La
   auditoria autentica (ctx.auditarCache) jamas corre bloqueado, asi que los datos reales NUNCA entran al DOM:
   quitar el "filter: blur" por F12 solo revela el señuelo. Es el minimo de seguridad efectivo del lado cliente.
   El boton Protect tambien se bloquea (borroso + candado). Pagar 2.50 USD/mes en BNB desbloquea AMBAS cosas:
   todo el Security Check y Protect en cada compra SIN comision extra (antes Protect sumaba 1%; ahora va incluido).
   Suscripcion 100% EN CADENA (contrato): nada en el navegador. Owners: siempre desbloqueado (para probar).
   Modulo sellado: solo importa de ./ dentro de terminal. */
import * as ethers from './ethers.min.js';
import * as wallet from './wallet.js';
import { referidorGuardado } from './referidos.js';

/* ── Config ── */
// OWNERS: wallets que NUNCA pagan (pruebas y administracion). PON AQUI TU(S) WALLET(S) para ver todo desbloqueado.
export const OWNERS = [
  '0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d',   // owner1
  '0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d'    // owner2 (hoy la MISMA wallet; cambiar esta linea cuando el socio de su direccion)
];
export const SUB_CONTRATO = '0x458aA14D2B1144b34f0FD22e2F9d7031B5f288B7';   // Terminal.sol (proxy ERC1967). Se interactua SIEMPRE con el proxy, nunca con la implementacion.
export const SUB_PRECIO_USD = 2.5;   // precio por defecto por servicio (USD; se cobra el equivalente en BNB)
export const SUB_DIAS = 30;
/* CADA servicio de la Terminal se paga y desbloquea POR SEPARADO (pagar uno NO abre los demas). Cada compra
   dura 30 dias y luego se vuelve a bloquear. Precio por servicio (USD): el Security Check del lobby es una
   version SIMPLIFICADA (~10% del total) y por eso vale menos; el 100% esta dentro de Open Full Chart. */
export const PRECIO_SERVICIO = { prime: 2.5, movers: 2.5, 'checks-lobby': 1, acts: 2.5, 'checks-ofc': 2.5, protect: 2.5 };
export function precioDe(servicio) { const p = PRECIO_SERVICIO[servicio]; return (p != null) ? p : SUB_PRECIO_USD; }
const NOMBRE_SERVICIO = { prime: 'Prime Mover', movers: 'Top Movers', 'checks-lobby': 'Security Check (quick view)', acts: 'Recent Activity', 'checks-ofc': 'Full Security Check', protect: 'Protect' };
const DESC_SERVICIO = {
  prime: 'See the single biggest gainer on BNB Chain at this moment, live.',
  movers: 'See the coins pumping hardest over the last 24 hours, live.',
  'checks-lobby': 'A quick security read on the selected coin. This is a simplified view, about 10% of the full report; the complete 100% report is inside Open Full Chart.',
  acts: 'See the real buys and sells happening on this pair right now.',
  'checks-ofc': 'The complete security report: live honeypot and tax simulation, liquidity, ownership, holder map and creator forensics.',
  protect: 'Turn on Protect on your buys, with no extra swap fee.'
};
const _idServicio = (s) => { try { return ethers.id(String(s || '')); } catch (_) { return s || ''; } };

// Contrato POR SERVICIO (Fase 2): cada servicio se identifica con un bytes32 (ethers.id del nombre).
const ABI_SUB = [
  'function subscriptionExpiry(address, bytes32) view returns (uint256)',
  'function priceWei(bytes32) view returns (uint256)',
  'function subscribe(bytes32,address) payable'
];
const SELLO = { ok: new URL('./img/sec-safe.webp', import.meta.url).href, risk: new URL('./img/sec-risk.webp', import.meta.url).href };

/* ── Propagacion de desbloqueo POR SERVICIO (reactivo, sin recargar) + cache de sesion ──
   Problema que evita: con varias zonas bloqueadas (Prime, Top Movers, Recent Activity, el Security Check del
   lobby, el del OFC y el boton Protect), pagar UN servicio debe abrir al instante SOLO la zona de ESE servicio,
   nunca las demas; y los re-render posteriores (elegir otro token, reabrir el OFC) deben seguir reflejando lo
   que ya esta pagado sin que el usuario recargue.
   Como: cada candado se apunta al bus (_escuchar) con SU servicio; al confirmarse el pago, suscribir() registra
   30 dias en cache para ese servicio y llama a _emitir(servicio) -> se abre UNICAMENTE el candado de ese servicio. */
const _subCache = new Map();                                   // "wallet|servicio" -> expira (ts seg) confirmado esta sesion
const _ck = (w, s) => String(w || '').toLowerCase() + '|' + (s || '');
function _recordarExpira(w, s, exp) { if (!w || !exp) return; const k = _ck(w, s); if (exp > (_subCache.get(k) || 0)) _subCache.set(k, exp); }
function _expiraCache(w, s) { return w ? (_subCache.get(_ck(w, s)) || 0) : 0; }
const _oyentes = new Set();                                    // { host, fn, servicio }: cada candado se abre solo al pagar SU servicio
function _escuchar(host, fn, servicio) {
  for (const e of [..._oyentes]) if (e.host === host || (e.host && !e.host.isConnected)) _oyentes.delete(e);   // dedupe por host + poda de muertos
  const entry = { host: host || null, fn, servicio: servicio || null }; _oyentes.add(entry); return entry;
}
function _emitir(w, exp, servicio) {
  for (const e of [..._oyentes]) {
    if (e.host && !e.host.isConnected) { _oyentes.delete(e); continue; }                                       // limpia lo que ya no esta en el DOM
    if ((e.servicio || null) !== (servicio || null)) continue;                                                 // SOLO se abre la zona del MISMO servicio pagado; cualquier otra (o una sin servicio) se queda cerrada: pagar uno NUNCA abre los demas
    try { e.fn({ wallet: w, expira: exp, servicio }); } catch (_) {}
  }
}
/* Re-lee la cadena servicio por servicio y reabre SOLO los que esten activos para esta wallet (util al cargar o
   tras un evento de wallet, para reflejar pagos previos sin recargar). Un servicio inactivo se queda bloqueado. */
export async function sincronizar(w) {
  try { for (const s of Object.keys(PRECIO_SERVICIO)) { const st = await estadoSuscripcion(w, s); if (st && st.activa) _emitir(w || '', st.expira || 0, s); } } catch (_) {} return null;
}
/* Chequeo SINCRONO de la cache: true si ya confirmamos un pago activo esta sesion. Sirve para abrir sin ni un
   parpadeo de candado al re-renderizar (p.ej. elegir otro token) despues de pagar, sin esperar la lectura en cadena. */
export function activoEnCache(w, servicio) { return _expiraCache(w, servicio) > Math.floor(Date.now() / 1000); }

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const ICO_LOCK = '<svg viewBox="0 0 24 24" fill="none"><rect x="4.5" y="10.5" width="15" height="10" rx="2.2" stroke="currentColor" stroke-width="1.7"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="15.3" r="1.5" fill="currentColor"/></svg>';
const ICO_KEY = '<svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="4.2" stroke="currentColor" stroke-width="1.7"/><path d="M11 11l8 8M16 16l2-2M18.5 18.5l2-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const ICO_SHIELD = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 2.5v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V5.5L12 3z" stroke="currentColor" stroke-width="1.6"/><path d="M9 12l2 2 4-4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const BENEFICIOS = [
  'Live buy and sell simulation: real honeypot and true taxes, not just the code.',
  'Liquidity burned or locked, ownership, mint, pause and blacklist rights.',
  'Full holder map: top wallets, snipers, bundled wallets and the creator bag.',
  'Creator wallet reputation: past honeypots, scams, sanctions and mixers.',
  'Chart, logo and holders on BSC and Tron, matched to the explorer.'
];

export function esOwner(w) {
  if (!w) return false; const x = String(w).toLowerCase();
  return OWNERS.some((o) => String(o).toLowerCase() === x);
}
function proveedor() { try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); return p ? new ethers.BrowserProvider(p) : null; } catch (_) { return null; } }

/* Estado de suscripcion: {activa, expira(ts seg), inicio(ts seg), owner}. Owner -> activa. Sin contrato/wallet -> inactiva. */
export async function estadoSuscripcion(w, servicio) {
  if (esOwner(w)) return { activa: true, expira: 0, inicio: 0, owner: true };
  const now = Math.floor(Date.now() / 1000);
  const cache = _expiraCache(w, servicio);              // lo ya confirmado esta sesion para ESTE servicio
  const base = (exp) => ({ activa: exp > now, expira: exp, inicio: exp ? exp - SUB_DIAS * 86400 : 0, owner: false });
  if (!w) return base(0);
  if (!SUB_CONTRATO) return base(cache);                // sin contrato aun: manda lo confirmado en sesion
  try {
    const pr = proveedor(); if (!pr) return base(cache);
    const c = new ethers.Contract(SUB_CONTRATO, ABI_SUB, pr);
    const exp = Number(await c.subscriptionExpiry(w, _idServicio(servicio)));
    _recordarExpira(w, servicio, exp);
    return base(Math.max(exp, cache));                  // nunca por debajo de lo ya confirmado: evita falso bloqueo por nodo lento
  } catch (_) { return base(cache); }
}

/* Cobra el equivalente al precio de ESE servicio en BNB via el contrato y activa SUB_DIAS SOLO para ese
   servicio. Al confirmarse avisa al bus con el servicio -> se abre unicamente esa zona (nunca las demas). */
export async function suscribir(bnbUsd, servicio) {
  const precio = precioDe(servicio);
  if (!SUB_CONTRATO) {
    // DEMO hasta desplegar el contrato (Fase 2): desbloqueo local de ESTE servicio en la sesion, para poder
    // probar el front sin cobrar. Cuando SUB_CONTRATO tenga direccion, se exige el pago real de abajo.
    let w = ''; try { w = (wallet.cuentaActual && wallet.cuentaActual()) || ''; } catch (_) {}
    if (!w) throw new Error('nowallet');
    const exp = Math.floor(Date.now() / 1000) + SUB_DIAS * 86400;
    _recordarExpira(w, servicio, exp); _emitir(w, exp, servicio);
    return 'demo';
  }
  const pr = proveedor(); if (!pr) throw new Error('nowallet');
  const signer = await pr.getSigner();
  const c = new ethers.Contract(SUB_CONTRATO, ABI_SUB, signer);
  const id = _idServicio(servicio);
  let wei = null; try { wei = await c.priceWei(id); } catch (_) {}
  if (!wei || wei === 0n) { const bnb = precio / (bnbUsd || 1); wei = ethers.parseEther(bnb.toFixed(18)); }
  const ref = referidorGuardado() || ethers.ZeroAddress;
  const tx = await c.subscribe(id, ref, { value: wei });
  await tx.wait();
  // Pago confirmado -> registrar 30 dias de ESTE servicio y avisar al bus para que se abra solo, sin recargar.
  let w = ''; try { w = await signer.getAddress(); } catch (_) {}
  let exp = Math.floor(Date.now() / 1000) + SUB_DIAS * 86400;                       // piso optimista: 30 dias desde ahora
  try { const real = Number(await c.subscriptionExpiry(w, id)); if (real > exp) exp = real; } catch (_) {}   // renovacion: el contrato suma sobre lo que quedaba
  _recordarExpira(w, servicio, exp);
  _emitir(w, exp, servicio);
  return tx.hash;
}

/* ── Dibujo de la tarjeta de EJEMPLO (escudo real con "EXAMPLE" y un % de muestra) ── */
const _img = {};
function cargarImgC(url) {
  if (_img[url]) return _img[url];
  const p = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => { delete _img[url]; rej(0); }; im.src = url; });
  _img[url] = p; return p;
}
async function dibujarEjemplo(cv, kind, pct) {
  if (!cv) return;
  try {
    const bg = await cargarImgC(kind === 'ok' ? SELLO.ok : SELLO.risk);
    const W = bg.naturalWidth || 1672, H = bg.naturalHeight || 941;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); ctx.drawImage(bg, 0, 0, W, H);
    const col = kind === 'ok' ? '#3DED8C' : '#FF4357', glow = kind === 'ok' ? 'rgba(61,237,140,.55)' : 'rgba(255,67,87,.5)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.72)'; ctx.shadowBlur = 10; ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(H * 0.072)}px "Chakra Petch", Arial, sans-serif`; ctx.fillText('EXAMPLE', W * 0.75, H * 0.125);
    ctx.fillStyle = col; ctx.shadowColor = glow; ctx.shadowBlur = W * 0.024;
    // Encaja el % dentro del recuadro HUD: "100%" es mas ancho que "1%", asi que si no cabe se reduce la fuente
    // (igual que el escudo real). Antes "100%" se salia por la derecha de la tarjeta verde.
    let pf = Math.round(H * 0.3); const ptxt = pct + '%', maxP = W * 0.33;
    ctx.font = `800 ${pf}px "Chakra Petch", Arial, sans-serif`;
    while (ctx.measureText(ptxt).width > maxP && pf > 36) { pf -= 6; ctx.font = `800 ${pf}px "Chakra Petch", Arial, sans-serif`; }
    ctx.fillText(ptxt, W * 0.79, H * 0.46);
  } catch (_) {}
}

function decoy() {
  const filas = [
    ['No honeypot', 'ok', 'Sellable'], ['Liquidity burned', 'no', '0%'], ['Ownership renounced', 'ok', 'Yes'],
    ['Low taxes', 'ok', '0% / 0%'], ['Not mintable', 'ok', 'Yes'], ['No blacklist', 'ok', 'Yes'], ['Verified source', 'ok', 'Yes']
  ];
  return filas.map(([t, s, v]) => `<div class="tg-chk ${s === 'ok' ? 'ok' : 'no'}"><span><i>${s === 'ok' ? '✓' : '✕'}</i>${t}</span><b>${v}</b></div>`).join('');
}

/* Columna de seguridad BLOQUEADA: dos tarjetas de ejemplo (roja arriba, verde abajo) con el mensaje de venta en
   medio. No ejecuta ninguna auditoria real. El boton abre el modal de pago (con disclaimer). */
export function montarCandado(host, opts) {
  inyectarCSS();
  const bnbUsd = (opts && opts.bnbUsd) || 0;
  const servicio = (opts && opts.servicio) || 'checks-ofc';
  const bnb = bnbUsd > 0 ? (precioDe(servicio) / bnbUsd) : 0;
  const sinHeader = !!(opts && opts.sinHeader);   // el lobby trae su propia cabecera; el OFC usa la de aqui
  host.innerHTML = `
    ${sinHeader ? '' : '<div class="tg-sec-t tg-sec-head">Security check</div>'}
    <div class="tg-lock">
      <div class="tg-lock-decoy" aria-hidden="true">${decoy()}</div>
      <div class="tg-lock-card">
        <div class="tg-lock-ex"><canvas class="tg-lock-cv" data-ex="risk"></canvas><span class="tg-lock-cap risk">High risk example</span></div>
        <div class="tg-lock-mid">
          <h4 class="tg-lock-h">See the full security report</h4>
          <p class="tg-lock-p">Unlock the full 100% security report on every token: a live buy and sell test, the real taxes, liquidity, the full holder map and the creator's track record.</p>
          <button class="tg-lock-btn" type="button">${ICO_KEY}<span>Unlock${bnb > 0 ? ' ' + bnb.toFixed(4) + ' BNB' : ''}</span>${ICO_LOCK}</button>
          <span class="tg-lock-sub">$${precioDe(servicio).toFixed(2)} for ${SUB_DIAS} days, this service only</span>
        </div>
        <div class="tg-lock-ex"><canvas class="tg-lock-cv" data-ex="safe"></canvas><span class="tg-lock-cap ok">Looks safe example</span></div>
      </div>
    </div>`;
  dibujarEjemplo(host.querySelector('[data-ex="risk"]'), 'risk', 1);
  dibujarEjemplo(host.querySelector('[data-ex="safe"]'), 'ok', 100);
  const btn = host.querySelector('.tg-lock-btn');
  if (btn) btn.onclick = () => abrirModalPago(bnbUsd, servicio);
  // Bus POR SERVICIO: este candado solo se abre si se paga SU servicio (nunca por pagar otro).
  _escuchar(host, () => { if (host.isConnected && opts && typeof opts.onDesbloquear === 'function') { try { opts.onDesbloquear(); } catch (_) {} } }, servicio);
}

/* Bloquea el boton Protect: lo deja borroso y pone encima un candado. Al tocar, abre el modal de pago. */
export function bloquearProtect(protEl, opts) {
  if (!protEl || protEl.querySelector('.tg-prot-lock')) return;
  inyectarCSS();
  protEl.classList.add('tg-prot-locked');
  const bnbUsd = (opts && opts.bnbUsd) || 0;
  const servicio = (opts && opts.servicio) || 'protect';
  const ov = document.createElement('button');
  ov.type = 'button'; ov.className = 'tg-prot-lock';
  ov.innerHTML = `<i>${ICO_LOCK}</i><span>Protect</span><em>Unlock</em>`;
  ov.onclick = () => abrirModalPago(bnbUsd, servicio);
  protEl.appendChild(ov);
  // Bus POR SERVICIO: este candado solo se quita al pagar Protect (nunca por pagar otro servicio).
  _escuchar(protEl, () => { if (protEl.isConnected && opts && typeof opts.onDesbloquear === 'function') { try { opts.onDesbloquear(); } catch (_) {} } }, servicio);
}

/* Candado LIGERO para zonas del lobby (Security check, Recent activity). MANTIENE el tamaño de la ventana:
   deja el contenido (un señuelo, NUNCA datos reales) borroso y encima un boton pequeño centrado + (opcional)
   un boton de info que explica para que sirve. Pagar abre el modal; conectado al bus -> cualquier pago lo abre.
   opts = { bnbUsd, decoy (HTML señuelo), onDesbloquear, info (texto), etiqueta (texto del boton) } */
export function bloquearZona(host, opts) {
  if (!host) return;
  inyectarCSS();
  const bnbUsd = (opts && opts.bnbUsd) || 0;
  const servicio = (opts && opts.servicio) || null;
  const bnb = bnbUsd > 0 ? (precioDe(servicio) / bnbUsd) : 0;
  const decoyHTML = (opts && opts.decoy) || '';
  const info = opts && opts.info;
  const etiqueta = (opts && opts.etiqueta) || 'Unlock';
  host.classList.add('tg-zlk-host');
  host.innerHTML = `
    <div class="tg-zlk-blur" aria-hidden="true">${decoyHTML}</div>
    <div class="tg-zlk-over">
      <button class="tg-zlk-btn" type="button">${ICO_KEY}<span>${esc(etiqueta)}${bnb > 0 ? ' ' + bnb.toFixed(4) + ' BNB' : ''}</span>${ICO_LOCK}</button>
      ${info ? `<button class="tg-zlk-i" type="button" aria-label="More info"><span class="tg-zlk-i-p">+</span>info</button>` : ''}
    </div>`;
  const btn = host.querySelector('.tg-zlk-btn'); if (btn) btn.onclick = () => abrirModalPago(bnbUsd, servicio);
  if (info) { const ib = host.querySelector('.tg-zlk-i'); if (ib) ib.onclick = (e) => { e.stopPropagation(); mostrarInfo(ib, info); }; }
  _escuchar(host, () => { if (host.isConnected && opts && typeof opts.onDesbloquear === 'function') { try { opts.onDesbloquear(); } catch (_) {} } }, servicio);
}

/* Globo de info junto al boton (toggle). Va en <body> con position:fixed para que NUNCA lo recorte el
   overflow:hidden de la seccion bloqueada (antes se metia dentro del recuadro y salia cortado por detras). */
let _infoOpen = null;
function _infoCerrar(ev) {
  if (ev && ev.type === 'click' && _infoOpen && (_infoOpen.contains(ev.target) || (_infoOpen._for && _infoOpen._for.contains(ev.target)))) return;
  if (_infoOpen && _infoOpen.isConnected) _infoOpen.remove(); _infoOpen = null;
  document.removeEventListener('click', _infoCerrar, true);
  window.removeEventListener('scroll', _infoCerrar, true); window.removeEventListener('resize', _infoCerrar, true);
}
function mostrarInfo(anchor, texto) {
  const toggle = _infoOpen && _infoOpen._for === anchor;
  _infoCerrar(); if (toggle) return;                                   // tocar el mismo boton lo cierra
  inyectarCSS();
  const tip = document.createElement('div'); tip.className = 'tg-info-pop'; tip.textContent = texto; tip._for = anchor;
  document.body.appendChild(tip); _infoOpen = tip;
  const r = anchor.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight, M = 10;
  const left = Math.max(M, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - M));
  let top = r.top - th - 8; if (top < M) top = Math.min(r.bottom + 8, window.innerHeight - th - M);   // arriba si cabe, si no debajo
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
  setTimeout(() => { document.addEventListener('click', _infoCerrar, true); window.addEventListener('scroll', _infoCerrar, true); window.addEventListener('resize', _infoCerrar, true); }, 0);
}

/* Modal de pago POR SERVICIO con disclaimer que nos exonera. Muestra QUE servicio se desbloquea, su precio,
   y deja claro que paga SOLO ese servicio. Confirmar -> cobra el equivalente a su precio en BNB y activa 30 dias. */
let _modalAbierto = false;
function abrirModalPago(bnbUsd, servicio) {
  if (_modalAbierto) return; _modalAbierto = true; inyectarCSS();
  const precio = precioDe(servicio);
  const bnb = bnbUsd > 0 ? (precio / bnbUsd) : 0;
  const nombre = NOMBRE_SERVICIO[servicio] || 'this service';
  const desc = DESC_SERVICIO[servicio] || 'Unlock this part of the Terminal.';
  const lista = servicio === 'checks-ofc' ? `<ul class="tg-pay-list">${BENEFICIOS.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '';
  const ov = document.createElement('div'); ov.className = 'tg-pay-ov';
  ov.innerHTML = `
    <div class="tg-pay" role="dialog" aria-modal="true">
      <button class="tg-pay-x" type="button" aria-label="Close">✕</button>
      <div class="tg-pay-ico">${ICO_SHIELD}</div>
      <h3 class="tg-pay-h">Unlock ${esc(nombre)}</h3>
      <p class="tg-pay-sub">${esc(desc)}</p>
      ${lista}
      <div class="tg-pay-price"><b>${bnb > 0 ? bnb.toFixed(4) + ' BNB' : '— BNB'}</b><span>≈ $${precio.toFixed(2)} for ${SUB_DIAS} days, renewable. This unlocks ${esc(nombre)} only.</span></div>
      <p class="tg-pay-disc">Each Terminal service is paid for and unlocked on its own. This service shows public on-chain information for research only. It is not financial advice and not a guarantee of any outcome. Trading tokens is risky and you can lose your funds. You alone are responsible for your decisions. By paying you agree that DecFreedom is not liable for any loss, trade, or result.</p>
      <div class="tg-pay-row">
        <button class="tg-pay-cancel" type="button">Cancel</button>
        <button class="tg-pay-go" type="button">${ICO_KEY}<span>Pay ${bnb > 0 ? bnb.toFixed(4) + ' BNB' : 'in BNB'}</span></button>
      </div>
      <span class="tg-pay-msg" id="tg-pay-msg"></span>
    </div>`;
  document.body.appendChild(ov);
  const cerrar = () => { if (ov.isConnected) ov.remove(); _modalAbierto = false; };
  ov.querySelector('.tg-pay-x').onclick = cerrar;
  ov.querySelector('.tg-pay-cancel').onclick = cerrar;
  ov.addEventListener('click', (e) => { if (e.target === ov) cerrar(); });
  const go = ov.querySelector('.tg-pay-go'), msg = ov.querySelector('#tg-pay-msg');
  go.onclick = async () => {
    if (go.classList.contains('busy')) return;
    const w = wallet.cuentaActual && wallet.cuentaActual();
    if (!w) { msg.className = 'tg-pay-msg'; msg.textContent = 'Connect your wallet first.'; try { await wallet.conectar(); } catch (_) {} return; }
    const o = go.innerHTML; go.classList.add('busy'); go.innerHTML = `${ICO_KEY}<span>Confirm in your wallet…</span>`;
    try {
      await suscribir(bnbUsd, servicio);   // al confirmarse, el bus abre SOLO la zona de ESTE servicio, sin recargar
      msg.className = 'tg-pay-msg ok'; msg.textContent = nombre + ' unlocked.';
      setTimeout(cerrar, 900);
    } catch (e) {
      go.classList.remove('busy'); go.innerHTML = o;
      msg.className = 'tg-pay-msg err'; msg.textContent = (e && e.message === 'nowallet') ? 'Connect your wallet first.' : 'Payment was not completed.';
    }
  };
}

/* Pastilla del encabezado: ultimas 4 cifras de la wallet + tiempo de suscripcion (o "locked"/"owner"). */
export function pintarPill(host, estado, w) {
  if (!host) return;
  if (!w) { host.innerHTML = ''; host.hidden = true; return; }
  inyectarCSS();
  let right = 'locked', on = false;
  if (estado && estado.owner) { right = 'owner'; on = true; }
  else if (estado && estado.activa && estado.expira > 0) { const d = Math.max(0, Math.ceil((estado.expira * 1000 - Date.now()) / 86400000)); right = d + 'd left'; on = true; }
  else if (estado && estado.activa) { right = 'active'; on = true; }
  host.hidden = false;
  host.className = 'tg-sub-pill' + (on ? ' on' : '');
  host.innerHTML = `<i>${ICO_KEY}</i><b>${esc(String(w).slice(-4))}</b><span>${esc(right)}</span>`;
}

let _css = false;
function inyectarCSS() {
  if (_css) return; _css = true;
  const s = document.createElement('style');
  s.textContent = `
.tg-lock{position:relative;min-height:430px;border-radius:14px;overflow:hidden}
.tg-lock-decoy{filter:blur(7px) saturate(.75);opacity:.5;pointer-events:none;user-select:none;padding:2px}
.tg-lock-card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:10px 12px;background:radial-gradient(135% 75% at 50% 50%,rgba(8,11,14,.5),rgba(8,11,14,.9))}
.tg-lock-ex{width:100%;text-align:center}
.tg-lock-cv{width:100%;max-width:184px;height:auto;border-radius:11px;border:1px solid rgba(255,255,255,.08);display:block;margin:0 auto}
.tg-lock-cap{display:block;margin-top:3px;font:700 9.5px/1 var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase}
.tg-lock-cap.risk{color:#ff6475}.tg-lock-cap.ok{color:#3DED8C}
.tg-lock-mid{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:0 4px}
.tg-lock-h{margin:0;font:800 14.5px/1.2 'Chakra Petch',var(--display,sans-serif);color:var(--ink-1,#eaecef)}
.tg-lock-p{margin:0;max-width:264px;font:500 11.5px/1.5 var(--display,sans-serif);color:var(--ink-3,#9aa3af)}
.tg-lock-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:2px;padding:10px 18px;border-radius:12px;border:1px solid rgba(232,184,75,.42);background:linear-gradient(180deg,rgba(232,184,75,.16),rgba(232,184,75,.07));color:var(--gold,#E8B84B);font:800 13px/1 'Chakra Petch',var(--display,sans-serif);letter-spacing:.03em;cursor:pointer;box-shadow:0 6px 16px -12px rgba(0,0,0,.7);transition:transform .15s,background .15s,border-color .15s}
.tg-lock-btn:hover{transform:translateY(-1px);border-color:rgba(232,184,75,.6);background:linear-gradient(180deg,rgba(232,184,75,.22),rgba(232,184,75,.1))}
.tg-lock-btn svg{width:14px;height:14px;opacity:.95}
.tg-lock-sub{font:600 11px/1 var(--display,sans-serif);color:var(--ink-3,#7d8794)}
/* candado sobre el boton Protect */
.tg-prot-locked{position:relative}
.tg-prot-locked>:not(.tg-prot-lock){filter:blur(3.5px);opacity:.6;pointer-events:none;user-select:none}
.tg-prot-lock{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid rgba(232,184,75,.4);border-radius:11px;background:rgba(8,11,14,.5);color:var(--ink-2,#b7bdc6);font:700 12px/1 'Chakra Petch',var(--display,sans-serif);cursor:pointer}
.tg-prot-lock i{display:inline-flex;width:15px;height:15px;color:var(--gold,#E8B84B)}
.tg-prot-lock em{font-style:normal;padding:4px 9px;border-radius:7px;background:rgba(232,184,75,.16);color:var(--gold,#E8B84B);font-weight:800}
/* candado LIGERO de zonas del lobby: mantiene el tamaño de la ventana, borroso + boton centrado + info */
.tg-zlk-host{position:relative;overflow:hidden}
.tg-zlk-blur{filter:blur(5px) saturate(.8);opacity:.45;pointer-events:none;user-select:none}
.tg-zlk-over{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;background:radial-gradient(120% 90% at 50% 50%,rgba(8,11,14,.4),rgba(8,11,14,.78))}
.tg-zlk-btn{display:inline-flex;align-items:center;gap:8px;padding:8px 15px;border-radius:11px;border:1px solid rgba(232,184,75,.45);background:linear-gradient(180deg,rgba(232,184,75,.2),rgba(232,184,75,.08));color:var(--gold,#E8B84B);font:800 12px/1 'Chakra Petch',var(--display,sans-serif);letter-spacing:.02em;cursor:pointer;box-shadow:0 6px 16px -10px rgba(0,0,0,.8);transition:transform .15s,border-color .15s,background .15s}
.tg-zlk-btn:hover{transform:translateY(-1px);border-color:rgba(232,184,75,.65);background:linear-gradient(180deg,rgba(232,184,75,.28),rgba(232,184,75,.12))}
.tg-zlk-btn svg{width:13px;height:13px}
.tg-zlk-i{height:26px;flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;padding:0 12px 0 9px;border-radius:999px;border:1px solid rgba(232,184,75,.28);background:rgba(13,17,23,.65);color:var(--ink-2,#b7bdc6);font:700 11.5px/1 'Chakra Petch',var(--display,sans-serif);letter-spacing:.3px;cursor:pointer;transition:color .15s,border-color .15s,background .15s}
.tg-zlk-i:hover{color:var(--gold,#E8B84B);border-color:rgba(232,184,75,.55);background:rgba(232,184,75,.08)}
.tg-zlk-i-p{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:rgba(232,184,75,.18);color:var(--gold,#E8B84B);font-weight:800;font-size:12px}
.tg-info-pop{position:fixed;z-index:99990;width:max-content;max-width:min(300px,92vw);padding:11px 13px;border-radius:11px;border:1px solid rgba(232,184,75,.3);background:#0c1117;color:var(--ink-2,#c3ccd6);font:500 11.5px/1.5 var(--display,sans-serif);box-shadow:0 16px 40px -12px rgba(0,0,0,.92)}
/* modal de pago */
.tg-pay-ov{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(5,7,10,.72);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
.tg-pay{position:relative;width:100%;max-width:400px;max-height:90vh;overflow:auto;border-radius:16px;border:1px solid rgba(232,184,75,.26);background:linear-gradient(180deg,#0e1319,#0a0d11);padding:22px 20px 18px;text-align:center;box-shadow:0 30px 80px -30px rgba(0,0,0,.8)}
.tg-pay-x{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:9px;border:1px solid var(--line,#232b36);background:#0d1117;color:var(--ink-3,#7d8794);cursor:pointer}
.tg-pay-ico{width:50px;height:50px;margin:2px auto 10px;display:flex;align-items:center;justify-content:center;border-radius:14px;border:1px solid rgba(232,184,75,.4);background:rgba(232,184,75,.1);color:var(--gold,#E8B84B)}
.tg-pay-ico svg{width:26px;height:26px}
.tg-pay-h{margin:0 0 4px;font:800 19px/1.2 'Chakra Petch',var(--display,sans-serif);color:var(--ink-1,#eaecef)}
.tg-pay-sub{margin:0 0 10px;font:500 12.5px/1.5 var(--display,sans-serif);color:var(--ink-3,#9aa3af)}
.tg-pay-list{list-style:none;margin:0 0 12px;padding:0;text-align:left;display:flex;flex-direction:column;gap:7px}
.tg-pay-list li{position:relative;padding-left:24px;font:600 12.5px/1.4 var(--display,sans-serif);color:var(--ink-2,#b7bdc6)}
.tg-pay-list li::before{content:"✓";position:absolute;left:4px;top:0;color:#3DED8C;font-weight:800}
.tg-pay-price{margin:0 0 12px;padding:11px;border-radius:12px;border:1px solid rgba(232,184,75,.22);background:rgba(232,184,75,.06)}
.tg-pay-price b{display:block;font:800 22px/1.1 'Chakra Petch',var(--display,sans-serif);color:var(--gold,#E8B84B)}
.tg-pay-price span{font:600 11px/1.3 var(--display,sans-serif);color:var(--ink-3,#7d8794)}
.tg-pay-disc{margin:0 0 14px;font:500 10.5px/1.55 var(--display,sans-serif);color:var(--ink-3,#7d8794);text-align:left}
.tg-pay-row{display:flex;gap:10px}
.tg-pay-cancel{flex:0 0 auto;padding:12px 16px;border-radius:11px;border:1px solid var(--line,#232b36);background:#0d1117;color:var(--ink-2,#b7bdc6);font:700 12.5px/1 'Chakra Petch',var(--display,sans-serif);cursor:pointer}
.tg-pay-go{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border-radius:11px;border:1px solid rgba(232,184,75,.5);background:linear-gradient(180deg,rgba(232,184,75,.26),rgba(232,184,75,.12));color:var(--gold,#E8B84B);font:800 12.5px/1 'Chakra Petch',var(--display,sans-serif);cursor:pointer}
.tg-pay-go.busy{opacity:.7;pointer-events:none}.tg-pay-go svg{width:15px;height:15px}
.tg-pay-msg{display:block;min-height:14px;margin-top:9px;font:600 11.5px/1.3 var(--display,sans-serif);color:var(--ink-3,#7d8794)}
.tg-pay-msg.ok{color:#3DED8C}.tg-pay-msg.err{color:#ff6475}
/* pastilla del encabezado */
.tg-sub-pill{display:inline-flex;align-items:center;gap:7px;padding:0 11px;height:42px;border-radius:11px;border:1px solid var(--line,#232b36);background:#0d1117;color:var(--ink-3,#7d8794);white-space:nowrap;flex:0 0 auto}
.tg-sub-pill[hidden]{display:none}
.tg-sub-pill.on{border-color:rgba(61,237,140,.35);background:rgba(61,237,140,.07)}
.tg-sub-pill i{display:inline-flex;width:14px;height:14px;color:var(--ink-3,#7d8794)}
.tg-sub-pill i svg{width:14px;height:14px;display:block}
.tg-sub-pill.on i{color:#3DED8C}
.tg-sub-pill b{font:800 12px/1 'Chakra Petch',var(--display,sans-serif);color:var(--ink-2,#b7bdc6);letter-spacing:.02em}
.tg-sub-pill span{font:600 11px/1 var(--display,sans-serif)}
@media(max-width:560px){.tg-sub-pill span{display:none}}`;
  document.head.appendChild(s);
}
