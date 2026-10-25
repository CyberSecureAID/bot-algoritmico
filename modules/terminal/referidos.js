/* terminal/referidos.js — Programa de referidos de la Terminal (modulo sellado).
   Boton "Referrals" (al lado de Filters) que abre una ventana grande y responsiva con:
   los beneficios, el enlace de referido (?ref=<wallet>) y las estadisticas on-chain.

   Seguridad: la dinamica de referidos vive a nivel de WALLET + CONTRATO (Terminal), no en el
   navegador. El ?ref= se guarda en el cliente y se FIJA en el contrato en la PRIMERA accion de
   pago o swap del referido (subscribe/comprar/vender pasan el referidor). Una vez fijado, el
   contrato lo deja inmutable (referidoDe set-once): no se puede robar, reasignar ni falsear por F12.
   El referidor cobra 0.10% del VOLUMEN de cada intercambio de su referido, pagado en BNB en la
   misma transaccion. Si una wallet no tiene referidor, ese 0.10% va al staking (nada queda en el aire). */

import * as ethers from './ethers.min.js';
import * as wallet from './wallet.js';
import { TERMINAL } from './config.js';
import { conRotacion } from './rpc.js';

const KEY_REF = 'df_ref';
/* El enlace se arma con el dominio ACTUAL desde el que se sirve la pagina (location.origin +
   pathname). Asi no clavamos un dominio: hoy usa el temporal y el dia que se pase al dominio
   oficial de DecFreedom, cada enlace de referido se actualiza solo, sin tocar codigo. */
function enlaceBase() {
  try { return (location.origin && location.origin !== 'null') ? (location.origin + location.pathname) : location.href.split('?')[0]; }
  catch (_) { return ''; }
}

const ABI_REF = [
  'function refContar(address) view returns (uint256)',
  'function ganadoRef(address) view returns (uint256)',
  'function referidoDe(address) view returns (address)'
];

const esDir = (a) => { try { return ethers.isAddress(a); } catch (_) { return false; } };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/* ─── Captura y lectura del referidor (compartido con candado.js y compra.js) ─── */
/** Lee el ?ref= del enlace y lo guarda una sola vez (primer referidor gana, como el contrato). */
export function capturarRef() {
  try {
    const r = new URLSearchParams(window.location.search).get('ref');
    if (r && esDir(r) && !localStorage.getItem(KEY_REF)) localStorage.setItem(KEY_REF, ethers.getAddress(r));
  } catch (_) {}
}
/** Devuelve el referidor guardado (direccion valida) o '' si no hay. */
export function referidorGuardado() {
  try { const r = localStorage.getItem(KEY_REF); return (r && esDir(r)) ? r : ''; } catch (_) { return ''; }
}

/* ─── Iconos ─── */
const ICO_REF = '<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18.5 19.5a5.5 5.5 0 0 0-3-4.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const ICO_COPY = '<svg viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2.4" stroke="currentColor" stroke-width="1.7"/><path d="M15 5.5H6A1.5 1.5 0 0 0 4.5 7v9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const ICO_SHARE = '<svg viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="2.4" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="6" r="2.4" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="18" r="2.4" stroke="currentColor" stroke-width="1.7"/><path d="M8.1 10.9l7.8-3.8M8.1 13.1l7.8 3.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

/* ─── CSS (acotado, no pisa estilos del host) ─── */
let _css = false;
function inyectarCSS() {
  if (_css) return; _css = true;
  const s = document.createElement('style');
  s.textContent = `
.tm-ref-b{flex:0 0 auto;min-width:0;padding:0 18px}
.tg-ref-ov{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(5,7,10,.74);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}
.tg-ref-ov[hidden]{display:none}
.tg-ref{position:relative;width:100%;max-width:min(560px,94vw);max-height:92vh;overflow:auto;border-radius:18px;border:1px solid rgba(232,184,75,.26);background:linear-gradient(180deg,#0e1319,#0a0d11);padding:24px 22px 20px;box-shadow:0 34px 90px -30px rgba(0,0,0,.85);scrollbar-width:thin;scrollbar-color:rgba(232,184,75,.5) transparent}
.tg-ref::-webkit-scrollbar{width:8px}.tg-ref::-webkit-scrollbar-thumb{background:rgba(232,184,75,.34);border-radius:9px}
.tg-ref-x{position:absolute;top:13px;right:13px;width:32px;height:32px;border-radius:9px;border:1px solid var(--line,#232b36);background:#0d1117;color:var(--ink-3,#7d8794);font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2}
.tg-ref-x:hover{color:var(--gold,#E8B84B);border-color:#8f6a1a}
.tg-ref-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.tg-ref-ico{width:46px;height:46px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;border-radius:13px;border:1px solid rgba(232,184,75,.4);background:rgba(232,184,75,.1);color:var(--gold,#E8B84B)}
.tg-ref-ico svg{width:25px;height:25px}
.tg-ref-h{margin:0;font:800 20px/1.15 'Chakra Petch',var(--display,sans-serif);color:var(--ink-1,#eaecef)}
.tg-ref-h span{display:block;font:600 12px/1.4 var(--display,sans-serif);color:var(--ink-3,#9aa3af);margin-top:2px}
.tg-ref-hero{margin:0 0 16px;padding:14px 15px;border-radius:13px;border:1px solid rgba(61,237,140,.24);background:rgba(61,237,140,.06);font:600 14px/1.5 var(--display,sans-serif);color:var(--ink-1,#eaecef)}
.tg-ref-hero b{color:#3DED8C;font-weight:800}
.tg-ref-steps{list-style:none;margin:0 0 16px;padding:0;display:flex;flex-direction:column;gap:11px;counter-reset:rf}
.tg-ref-steps li{position:relative;padding-left:40px;min-height:28px;font:500 12.8px/1.5 var(--display,sans-serif);color:var(--ink-2,#b7bdc6)}
.tg-ref-steps li b{color:var(--ink-1,#eaecef);font-weight:700}
.tg-ref-steps li::before{counter-increment:rf;content:counter(rf);position:absolute;left:0;top:0;width:27px;height:27px;display:flex;align-items:center;justify-content:center;border-radius:9px;border:1px solid rgba(232,184,75,.4);background:rgba(232,184,75,.1);color:var(--gold,#E8B84B);font:800 13px/1 'Chakra Petch',var(--display,sans-serif)}
.tg-ref-stats{display:flex;gap:10px;margin:0 0 16px}
.tg-ref-stat{flex:1;padding:12px;border-radius:12px;border:1px solid rgba(232,184,75,.2);background:rgba(232,184,75,.05);text-align:center}
.tg-ref-stat b{display:block;font:800 20px/1.1 'Chakra Petch',var(--display,sans-serif);color:var(--gold,#E8B84B)}
.tg-ref-stat span{font:600 10.5px/1.3 var(--display,sans-serif);color:var(--ink-3,#7d8794);text-transform:uppercase;letter-spacing:.05em}
.tg-ref-lblk{margin:0 0 14px}
.tg-ref-lbl{display:block;margin:0 0 7px;font:700 11px/1 'Chakra Petch',var(--display,sans-serif);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3,#9aa3af)}
.tg-ref-linkrow{display:flex;gap:8px;flex-wrap:wrap}
.tg-ref-link{flex:1 1 180px;min-width:0;padding:11px 13px;border-radius:11px;border:1px solid var(--line,#232b36);background:#0b0e12;color:var(--ink-2,#c3ccd6);font:600 11.5px/1.3 'IBM Plex Mono',ui-monospace,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-ref-cp,.tg-ref-sh{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;padding:0 15px;height:42px;border-radius:11px;cursor:pointer;font:800 12.5px/1 'Chakra Petch',var(--display,sans-serif)}
.tg-ref-cp{border:1px solid rgba(232,184,75,.5);background:linear-gradient(180deg,rgba(232,184,75,.26),rgba(232,184,75,.12));color:var(--gold,#E8B84B)}
.tg-ref-cp svg,.tg-ref-sh svg{width:15px;height:15px}
.tg-ref-cp.ok{border-color:rgba(61,237,140,.5);background:rgba(61,237,140,.12);color:#3DED8C}
.tg-ref-sh{border:1px solid var(--line,#232b36);background:#0d1117;color:var(--ink-2,#b7bdc6)}
.tg-ref-connect{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:46px;border-radius:12px;cursor:pointer;border:1px solid #c79426;color:#241900;background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426);font:800 13px/1 'Chakra Petch',var(--display,sans-serif);box-shadow:0 4px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}
.tg-ref-note{margin:0;padding-top:4px;font:500 10.8px/1.6 var(--display,sans-serif);color:var(--ink-3,#7d8794)}
.tg-ref-note b{color:var(--ink-2,#b7bdc6);font-weight:700}
.tg-ref-msg{display:block;min-height:14px;margin-top:9px;font:600 11.5px/1.3 var(--display,sans-serif);color:var(--ink-3,#7d8794)}
.tg-ref-msg.ok{color:#3DED8C}.tg-ref-msg.err{color:#ff6475}
@media(max-width:480px){.tg-ref{padding:20px 16px 16px}.tg-ref-linkrow .tg-ref-cp,.tg-ref-linkrow .tg-ref-sh{flex:1 1 0;justify-content:center}}`;
  document.head.appendChild(s);
}

/* ─── Modal ─── */
let _abierto = false;
export function abrirReferidos() {
  if (_abierto) return; _abierto = true; inyectarCSS();
  const w = (wallet.cuentaActual && wallet.cuentaActual()) || '';
  const link = w ? `${enlaceBase()}?ref=${w}` : '';

  const ov = document.createElement('div'); ov.className = 'tg-ref-ov';
  const bloqueEnlace = w
    ? `<div class="tg-ref-lblk">
         <span class="tg-ref-lbl">Your referral link</span>
         <div class="tg-ref-linkrow">
           <div class="tg-ref-link" id="tg-ref-link" title="${esc(link)}">${esc(link)}</div>
           <button class="tg-ref-cp" id="tg-ref-cp" type="button">${ICO_COPY}<span>Copy</span></button>
           <button class="tg-ref-sh" id="tg-ref-sh" type="button">${ICO_SHARE}<span>Share</span></button>
         </div>
       </div>`
    : `<div class="tg-ref-lblk">
         <span class="tg-ref-lbl">Your referral link</span>
         <button class="tg-ref-connect" id="tg-ref-connect" type="button">${ICO_REF}<span>Connect your wallet to get your link</span></button>
       </div>`;

  ov.innerHTML = `
    <div class="tg-ref" role="dialog" aria-modal="true">
      <button class="tg-ref-x" type="button" aria-label="Close">✕</button>
      <div class="tg-ref-head">
        <div class="tg-ref-ico">${ICO_REF}</div>
        <h3 class="tg-ref-h">Referrals<span>Earn from everyone you bring to the Terminal.</span></h3>
      </div>
      <p class="tg-ref-hero">You earn <b>0.10% of every trade</b> your referrals make on the Terminal, for as long as they trade. Paid to your wallet in <b>BNB</b>, automatically, inside the same transaction.</p>
      <ol class="tg-ref-steps">
        <li><b>Share your link.</b> Anyone who opens the Terminal through it is tied to your wallet, once and for good.</li>
        <li><b>They trade.</b> Every buy, sell and paid service they use pays you 0.10% of the volume, on-chain.</li>
        <li><b>You get paid.</b> Your share lands in your wallet by itself. No claiming, no middleman, nothing we hold.</li>
      </ol>
      <div class="tg-ref-stats">
        <div class="tg-ref-stat"><b id="tg-ref-n">—</b><span>Referrals</span></div>
        <div class="tg-ref-stat"><b id="tg-ref-g">—</b><span>Earned so far (BNB)</span></div>
      </div>
      ${bloqueEnlace}
      <p class="tg-ref-note"><b>Safe by design.</b> Your referrals are recorded on-chain against your wallet, set once and impossible to steal or reassign. Non-custodial: we never touch the funds. <b>"Earned so far" is what your referrals have already paid you — not a forecast. What you earn depends entirely on how much they trade, and we promise no amount.</b> The same referral program is rolling out across more of the platform.</p>
      <span class="tg-ref-msg" id="tg-ref-msg"></span>
    </div>`;
  document.body.appendChild(ov);

  const cerrar = () => { if (ov.isConnected) ov.remove(); _abierto = false; };
  ov.querySelector('.tg-ref-x').onclick = cerrar;
  ov.addEventListener('click', (e) => { if (e.target === ov) cerrar(); });
  const onEsc = (e) => { if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', onEsc); } };
  document.addEventListener('keydown', onEsc);
  const msg = ov.querySelector('#tg-ref-msg');

  // Conectar wallet (si no habia) -> reabrir con el enlace ya listo.
  const cb = ov.querySelector('#tg-ref-connect');
  if (cb) cb.onclick = async () => { try { await wallet.conectar(); } catch (_) {} cerrar(); setTimeout(abrirReferidos, 200); };

  // Copiar
  const cp = ov.querySelector('#tg-ref-cp');
  if (cp) cp.onclick = async () => {
    try { await navigator.clipboard.writeText(link); } catch (_) { try { const t = ov.querySelector('#tg-ref-link'); const r = document.createRange(); r.selectNodeContents(t); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('copy'); sel.removeAllRanges(); } catch (_) {} }
    cp.classList.add('ok'); cp.querySelector('span').textContent = 'Copied';
    setTimeout(() => { cp.classList.remove('ok'); cp.querySelector('span').textContent = 'Copy'; }, 1500);
  };
  // Compartir (Web Share si existe)
  const sh = ov.querySelector('#tg-ref-sh');
  if (sh) sh.onclick = async () => {
    const data = { title: 'DecFreedom Terminal', text: 'Trade newborn tokens on the DecFreedom Terminal — join with my link:', url: link };
    try { if (navigator.share) { await navigator.share(data); return; } } catch (_) { return; }
    try { await navigator.clipboard.writeText(link); msg.className = 'tg-ref-msg ok'; msg.textContent = 'Link copied — share it anywhere.'; } catch (_) {}
  };

  // Estadisticas on-chain (si hay wallet)
  if (w) {
    conRotacion((p) => new ethers.Contract(TERMINAL, ABI_REF, p).refContar(w))
      .then((n) => { const el = ov.querySelector('#tg-ref-n'); if (el) el.textContent = String(n); }).catch(() => {});
    conRotacion((p) => new ethers.Contract(TERMINAL, ABI_REF, p).ganadoRef(w))
      .then((g) => { const el = ov.querySelector('#tg-ref-g'); if (el) { const v = Number(ethers.formatEther(g)); el.textContent = v >= 1 ? v.toFixed(3) : (v > 0 ? v.toFixed(5) : '0'); } }).catch(() => {});
  }
}
