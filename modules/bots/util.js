/* gridbot/util.js, Utilidades compartidas de la app de bots: formateo
   (num, fmtPrecioUSD), escape (escT), detección de móvil, traducción de
   errores a lenguaje llano (enCristiano) y el sistema de modales
   (busy/error). Extraído de gridbot-ui.js sin cambiar la lógica. */

import { MONEDAS } from './tokens.js';
import { LOGOS } from './estado.js';

const $ = (id) => document.getElementById(id);

export const moneda = (id) => MONEDAS[id];
export function num(n, d = 4) { return isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: d }) : '...'; }

export const _movil = () => window.matchMedia('(max-width: 760px)').matches;
export const tipoNum = () => (_movil() ? 'text' : 'number');

export const escT = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function enCristiano(e) {
  const crudo = String(e?.shortMessage || e?.reason || e?.message || e || '');
  // Los fallos de WalletConnect los mostramos tal cual: hacen falta para
  // saber qué pasa, y el usuario puede contárnoslo.
  if (/^WC_/.test(crudo)) return crudo;
  const t = crudo.toLowerCase();
  if (t.includes('user rejected') || t.includes('denied') || t.includes('rechaz')) return 'You cancelled the operation in your wallet.';
  if (t.includes('insufficient funds')) return 'Not enough BNB to pay the network fee.';
  if (t.includes('transfer amount exceeds balance') || t.includes('exceeds balance')) return 'You do not have enough balance of that coin.';
  if (t.includes('allowance') || t.includes('approve')) return 'The coin permission is missing. Try again.';
  if (t.includes('no_wallet')) return 'No wallet found. Install MetaMask or open this page from your wallet.';
  if (t.includes('sin_cuentas')) return 'Your wallet did not give access to any account.';
  if (t.includes('nonce') || t.includes('replacement')) return 'You have another operation in progress. Wait for it to finish.';
  if (t.includes('network') || t.includes('rpc') || t.includes('timeout') || t.includes('fetch')) return 'The network is slow right now. Try again in a moment.';
  if (t.includes('chain') || t.includes('red incorrecta')) return 'Switch your wallet to BNB Smart Chain.';
  if (t.includes('gas required exceeds') || t.includes('gas limit')) return 'The operation does not fit. Try a smaller amount.';
  if (t.includes('revert')) return 'The contract did not accept the operation. Check the data and try again.';
  return 'Could not complete. Try again in a moment.';
}

export function fmtPrecioUSD(p) {
  if (p == null || !isFinite(p)) return '...';
  if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 1) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 0.01) return '$' + p.toFixed(4);
  if (p >= 0.0001) return '$' + p.toFixed(6);
  return '$' + Number(p.toPrecision(2)).toString();
}

/* ── Sistema de modales (busy / error) ── */
export function limpiarBusy() { if (window._busyTimer) { clearInterval(window._busyTimer); window._busyTimer = null; } }
export function modalBusy(txt) {
  const m = $('colmena-modal'); if (!m) return;
  $('cm-body').innerHTML = `<div class="busy-wrap"><div class="busy-tx" id="busy-tx">${txt}</div><div class="busy-ring"><svg viewBox="0 0 44 44"><circle class="br-bg" cx="22" cy="22" r="19"/><circle class="br-fg" cx="22" cy="22" r="19"/></svg><span class="busy-num" id="busy-num">1</span></div></div>`;
  m.querySelector('.m-btns').style.display = 'none'; m.onclick = null; m.classList.add('show');
  limpiarBusy();
  let n = 1;
  window._busyTimer = setInterval(() => {
    const el = $('busy-num'); if (!el) { limpiarBusy(); return; }
    if (n < 99) n++; el.textContent = n;
  }, 2500);
}
export function modalBusyTexto(txt) { const el = $('busy-tx'); if (el) el.innerHTML = txt; }
window._onTxProcesando = function () { const el = document.getElementById('busy-tx'); if (el) el.innerHTML = 'Processing on the network… <span style="opacity:.6">almost there</span>'; };
export function modalError(txt) {
  const m = $('colmena-modal'); if (!m) return;
  limpiarBusy(); $('cm-title').textContent = 'Could not complete'; $('cm-body').textContent = txt;
  const btns = m.querySelector('.m-btns'); btns.style.display = 'flex';
  $('cm-cancel').style.display = 'none'; const ok = $('cm-ok');
  ok.textContent = 'Got it'; ok.className = 'btn btn-linea'; ok.onclick = () => m.classList.remove('show');
}
export function modalClose() { limpiarBusy(); const m = $('colmena-modal'); if (m) m.classList.remove('show'); }

/* Icono de una moneda: letra de respaldo + logo (si CoinGecko lo cargó). */
// Direcciones conocidas para el logo de Trust Wallet (las monedas nativas o sin
// contrato en su propia cadena no traen address, así que se listan aquí).
const LOGO_DIR_UTIL = {
  BNB:'0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', WBNB:'0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  BTC:'0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', BTCB:'0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  ETH:'0x2170Ed0880ac9A755fd29B2688956BD959F933F8', USDT:'0x55d398326f99059fF775485246999027B3197955',
  USDC:'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', CAKE:'0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  XRP:'0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', ADA:'0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47',
  DOGE:'0xbA2aE424d960c26247Dd6c32edC70B295c744C43', DOT:'0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402',
  MATIC:'0xCC42724C6683B7E57334c4E856f4c9965ED682bD', LTC:'0x4338665CBB7B2485A8855A139b75D5e34AB0DB94',
  LINK:'0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', AVAX:'0x1CE0c2827e2eF14D5C4f29a091d735A204794041',
  TRX:'0xCE7de646e7208a4Ef112cb6ed5038FA6cC6b12e3', SHIB:'0x2859e4544C4bB03966803b044A93563Bd2D0DD4D',
  UNI:'0xBf5140A22578168FD562DCcF235E5D43A02ce9B1', ATOM:'0x0Eb3a705fc54725037CC9e008bDede697f62F335',
  BUSD:'0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
};
export function icoInner(mo) {
  const letra = mo.icono || (mo.simbolo || '?')[0];
  const L = LOGOS[mo.id];
  // 1) el logo ya cargado (con precio) si existe; 2) si no, se arma la URL de
  //    Trust Wallet con la dirección de la moneda o la conocida por su símbolo.
  let src = (L && L.img) ? L.img : '';
  if (!src) {
    const addr = mo.address || LOGO_DIR_UTIL[mo.id] || LOGO_DIR_UTIL[mo.simbolo];
    if (addr && /^0x[0-9a-fA-F]{40}$/.test(addr)) {
      src = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/' + addr + '/logo.png';
    }
  }
  return `<span class="ico-fb">${letra}</span>` + (src ? `<img src="${src}" alt="" onload="if(this.parentElement)this.parentElement.classList.add('conlogo')" onerror="this.style.display='none'">` : '');
}
