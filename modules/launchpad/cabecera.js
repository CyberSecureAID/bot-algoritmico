/* launchpad/cabecera.js. La esquina derecha de la cinta, igual que en el lobby:
   icono de perfil (abre Mi perfil en el lobby), capsula de la wallet con el logo de la
   wallet conectada y las ultimas 4 letras, y al tocarla el selector (tus wallets, otra
   wallet por QR, cual esta conectada). Sellado: solo usa ./wallet.js. */

import * as wallet from './wallet.js';
import { abrirPerfil } from './perfil.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Logos de respaldo para wallets que no se anuncian por EIP-6963 (MetaMask en escritorio). */
const LOGOS_WALLET = {
  metamask: `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><path fill="#E17726" d="M28.6 3.4 17.8 11.4l2-4.7z"/><path fill="#E27625" d="m3.4 3.4 10.7 8.1-1.9-4.8zM24.4 21.7l-2.9 4.4 6.2 1.7 1.8-6z"/><path fill="#E27625" d="m2.6 21.8 1.7 6 6.2-1.7-2.9-4.4z"/><path fill="#E27625" d="m10.1 14.5-1.7 2.6 6.1.3-.2-6.6zM21.9 14.5l-4.3-3.8-.1 6.7 6.1-.3zM10.5 26.1l3.7-1.8-3.2-2.5zM17.8 24.3l3.7 1.8-.5-4.3z"/><path fill="#D5BFB2" d="m21.5 26.1-3.7-1.8.3 2.4v1zM10.5 26.1l3.4.6v-1l.3-2.4z"/><path fill="#233447" d="m14 20.3-3.1-.9 2.2-1zM18 20.3l.9-1.9 2.2 1z"/><path fill="#CC6228" d="m10.5 26.1.5-4.4-3.4.1zM21 21.7l.5 4.4 2.9-4.3zM23.6 17.1l-6.1.3.6 3.1.9-1.9 2.2 1zM10.9 19.6l2.2-1 .9 1.9.6-3.1-6.2-.3z"/><path fill="#E27525" d="m8.4 17.1 2.6 5-.1-2.5zM21.2 19.6l-.1 2.5 2.6-5zM14.6 17.4l-.6 3.1.8 4 .2-5.3zM17.5 17.4l-.4 1.8.1 5.3.8-4z"/><path fill="#F5841F" d="m18 20.3-.8 4 .6.4 3.2-2.5.1-2.5zM10.9 19.6l.1 2.5 3.2 2.5.6-.4-.8-4z"/><path fill="#C0AC9D" d="m18.1 27.5v-1l-.3-.2h-3.6l-.3.2v1l-3.4-.6 1.2 1 2.4 1.7h3.7l2.5-1.7 1.2-1z"/><path fill="#161616" d="m17.8 24.3-.6-.4h-2.4l-.6.4-.3 2.4.3-.2h3.6l.3.2z"/><path fill="#763E1A" d="m29.1 11.9.9-4.4-1.4-4.1-11 8.1 4.3 3.6 6 1.8 1.3-1.5-.6-.4 1-.9-.7-.6 1-.7zM2 7.5l.9 4.4-.6.4 1 .7-.7.6.9.9-.6.4 1.3 1.5 6-1.8 4.3-3.6-11-8.1z"/><path fill="#F5841F" d="m28 15.1-6-1.8 1.8 2.7-2.6 5 3.5-.1h5.1zM10.1 13.3l-6 1.8-1.8 5.8h5.1l3.5.1-2.6-5zM17.5 17.4l.4-6.6 1.7-4.6h-7.3l1.7 4.6.4 6.6.2 2.1v5.2h2.4l.1-5.2z"/></svg>`,
  trust:    `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><path fill="#3375BB" d="M16 2 5 6.3v8.4c0 6.9 4.6 13.3 11 15.3 6.4-2 11-8.4 11-15.3V6.3z"/><path fill="#fff" d="M16 6.6v18.9c4.6-1.6 8-6.5 8-11.6V8.6z"/></svg>`,
  binance:  `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><path fill="#F0B90B" d="m16 4 3 3-6 6-3-3zM22 10l3 3-9 9-3-3zM10 10l3 3-3 3-3-3zM16 19l3 3-3 3-3-3z"/></svg>`,
  coinbase: `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><circle cx="16" cy="16" r="14" fill="#0052FF"/><rect x="11" y="11" width="10" height="10" rx="2" fill="#fff"/></svg>`,
  phantom:  `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><circle cx="16" cy="16" r="14" fill="#AB9FF2"/><ellipse cx="12" cy="15" rx="2" ry="3" fill="#fff"/><ellipse cx="20" cy="15" rx="2" ry="3" fill="#fff"/></svg>`,
  rabby:    `<svg class="dir-logo" viewBox="0 0 32 32" width="15" height="15"><circle cx="16" cy="16" r="14" fill="#7084F5"/><path fill="#fff" d="M9 18c3-5 11-7 14-4-2 4-9 7-14 4z"/></svg>`
};
const QR_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM19 14h2M14 19h2M19 19h2v2"/></svg>';
const PERFIL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.6-3.4 3.2-5 6.5-5s5.9 1.6 6.5 5"/></svg>';

function iconoWallet() {
  try {
    const info = wallet.walletInfo ? wallet.walletInfo() : null;
    if (info && info.icon) return '<img class="dir-logo" src="' + esc(info.icon) + '" alt="">';
    if (info && info.clave && LOGOS_WALLET[info.clave]) return LOGOS_WALLET[info.clave];
    const p = window.ethereum;
    if (p) {
      const cual = p.isTrust || p.isTrustWallet ? 'trust' : p.isPhantom ? 'phantom' : p.isCoinbaseWallet ? 'coinbase' : p.isBinance ? 'binance' : p.isRabby ? 'rabby' : p.isMetaMask ? 'metamask' : null;
      if (cual && LOGOS_WALLET[cual]) return LOGOS_WALLET[cual];
    }
  } catch (_) {}
  return '<span class="dir-punto"></span>';
}

/* Pinta la esquina derecha. `host` es el contenedor .pt-hdr__a. */
export function pintarCabecera(host) {
  if (!host) return;
  const cta = wallet.cuentaActual();
  if (!cta) {
    host.innerHTML = '<button class="dir dir-con" id="c-dir" type="button">Connect wallet</button><a class="c-contratos" href="../../transparency.html">Contracts</a>';
    $('c-dir').onclick = () => wallet.conectar().then(() => pintarCabecera(host)).catch(() => {});
    return;
  }
  host.innerHTML = '<button class="c-perfil" id="c-perfil" type="button" aria-label="My profile" title="My profile">' + PERFIL_SVG + '</button>'
    + '<button class="dir" id="c-dir" type="button" title="Switch wallet">' + iconoWallet() + '<span class="dir-tx">' + esc(String(cta).slice(-4)) + '</span><span class="dir-ch"></span></button>'
    + '<a class="c-contratos" href="../../transparency.html">Contracts</a>';
  $('c-dir').onclick = (e) => { e.stopPropagation(); selectorWallet($('c-dir'), host); };
  $('c-perfil').onclick = (e) => { e.stopPropagation(); abrirPerfil({ alCambiar: () => pintarCabecera(host) }); };
  // El logo puede llegar tarde (EIP-6963 anuncia despues): se reintenta como en el lobby.
  [300, 900, 2000].forEach((ms) => setTimeout(() => { const d = $('c-dir'); if (!d || !wallet.cuentaActual()) return; const tmp = document.createElement('span'); tmp.innerHTML = iconoWallet(); const n = tmp.firstElementChild; const v = d.firstElementChild; if (n && v && !v.classList.contains('dir-tx') && n.outerHTML !== v.outerHTML) v.replaceWith(n); }, ms));
}

function selectorWallet(ancla, host) {
  const prev = $('wsel'); if (prev) { prev.remove(); return; }
  let lista = []; try { lista = wallet.walletsDisponibles ? wallet.walletsDisponibles() : []; } catch (_) {}
  const d = document.createElement('div'); d.id = 'wsel';
  d.innerHTML = '<div class="wsel-bg"></div><div class="wsel-p"><div class="wsel-t">Your wallets</div>'
    + lista.map((x) => '<button class="wsel-b ' + (x.activa ? 'on' : '') + '" data-w="' + esc(x.id) + '">' + (x.icono ? '<img src="' + esc(x.icono) + '" alt="">' : '<span class="wsel-i"></span>') + '<b>' + esc(x.nombre) + '</b>' + (x.activa ? '<span class="wsel-ok">Connected</span>' : '') + '</button>').join('')
    + '<button class="wsel-b" data-wc="1"><span class="wsel-i wc">' + QR_SVG + '</span><b>Other wallet (QR)</b></button>'
    + '<button class="wsel-b" data-off="1"><span class="wsel-i"></span><b>Disconnect</b></button>'
    + (lista.length === 0 ? '<div class="wsel-v">No wallets in this browser. Use the QR option to connect from your phone.</div>' : '')
    + '</div>';
  document.body.appendChild(d);
  const r = ancla.getBoundingClientRect(); const pnl = d.querySelector('.wsel-p');
  pnl.style.top = (r.bottom + 8) + 'px'; pnl.style.right = Math.max(10, window.innerWidth - r.right) + 'px';
  const cerrar = () => d.remove();
  d.querySelector('.wsel-bg').onclick = cerrar;
  const bwc = d.querySelector('[data-wc]'); if (bwc) bwc.onclick = () => { cerrar(); wallet.conectarWalletConnect().then(() => pintarCabecera(host)).catch(() => {}); };
  const boff = d.querySelector('[data-off]'); if (boff) boff.onclick = () => { cerrar(); Promise.resolve(wallet.desconectar()).then(() => pintarCabecera(host)).catch(() => pintarCabecera(host)); };
  d.querySelectorAll('[data-w]').forEach((b) => (b.onclick = () => { const id = b.getAttribute('data-w'); cerrar(); Promise.resolve().then(() => wallet.conectarCon(id)).then(() => pintarCabecera(host)).catch(() => {}); }));
}
