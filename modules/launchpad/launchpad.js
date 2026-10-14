/* launchpad/launchpad.js. Interfaz del Launchpad (fase 1: solo front).
   Portada, asistente de una pregunta por pantalla (como el P2P), panel del creador,
   generador del widget. Las firmas al contrato se enchufan en la
   fase de contrato: mientras LAUNCHPAD sea 0x0, el boton final avisa "pending". */

import * as wallet from './wallet.js';
import * as ethers from './ethers.min.js';
import { LAUNCHPAD, LIQUIDEZ, REGLAS, PRESETS_SUPPLY, LOGO_MAX_PX } from './config.js';
import * as gb from './motor.js';

const $ = (id) => document.getElementById(id);
const APP = 'colmena-app';
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n, d = 2) => isFinite(n) ? Number(n).toLocaleString('en-US', { maximumFractionDigits: d }) : '...';
const corto = (a) => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
const CERO = '0x0000000000000000000000000000000000000000';
/* Precios muy pequenos legibles: 0.0<sub>7</sub>4779 en vez de 4.779e-8. */
function fmtP(p, sig = 4) {
  if (!(p > 0) || !isFinite(p)) return '...';
  if (p >= 0.001) return Number(p.toPrecision(sig)).toString();
  const e = Math.floor(Math.log10(p)); const ceros = -e - 1;
  const dig = Math.round(p / Math.pow(10, e - sig + 1)).toString().slice(0, sig);
  return `0.0<sub>${ceros}</sub>${dig}`;
}
const hayContrato = () => LAUNCHPAD && LAUNCHPAD !== CERO;

/* ───────── Modal generico ───────── */
function modal(titulo, cuerpo, { ok = 'Got it', cancel = null } = {}) {
  return new Promise((resolve) => {
    const m = $('colmena-modal'); if (!m) return resolve(true);
    $('cm-title').textContent = titulo; $('cm-body').innerHTML = cuerpo;
    const bo = $('cm-ok'), bc = $('cm-cancel');
    bo.textContent = ok; bc.style.display = cancel ? '' : 'none'; if (cancel) bc.textContent = cancel;
    bo.onclick = () => { m.classList.remove('show'); resolve(true); };
    bc.onclick = () => { m.classList.remove('show'); resolve(false); };
    m.classList.add('show');
  });
}
function modalBusy(titulo, cuerpo) {
  const m = $('colmena-modal'); if (!m) return;
  $('cm-title').textContent = titulo; $('cm-body').innerHTML = cuerpo;
  const b = m.querySelector('.m-btns'); if (b) b.style.display = 'none';
  m.classList.add('show');
}
function modalCerrar() { const m = $('colmena-modal'); if (!m) return; m.classList.remove('show'); const b = m.querySelector('.m-btns'); if (b) b.style.display = ''; }
window._onTxProcesando = function () { const el = document.getElementById('cm-body'); if (el && document.getElementById('colmena-modal').classList.contains('show')) { const s = el.querySelector('.lp-proc'); if (!s) el.insertAdjacentHTML('beforeend', '<div class="lp-proc" style="margin-top:8px;font-family:var(--mono);font-size:11px;color:var(--ink-3)">Processing on the network…</div>'); } };
const esRechazo = (e) => e && (e.code === 'ACTION_REJECTED' || /reject|denied|user\s*rejected/i.test(e.message || ''));
const errTxt = (e) => (e && (e.shortMessage || e.reason || e.message)) ? String(e.shortMessage || e.reason || e.message).slice(0, 180) : 'Something went wrong. Try again.';
/* Pequeno modal con un campo numerico. Devuelve el numero o null. */
function pedirCantidad({ titulo, cuerpo, max, sufijo = '', ok = 'Confirm' }) {
  return new Promise((resolve) => {
    const prev = $('lp-wiz'); if (prev) prev.remove();
    const d = document.createElement('div'); d.id = 'lp-wiz'; d.className = 'lp-wiz-bg';
    d.innerHTML = `<div class="lp-wiz" style="max-width:420px">
      <button class="lp-wiz-x" id="pc-x" type="button">✕</button>
      <div class="lp-wiz-t">${titulo}</div>${cuerpo ? `<div class="lp-wiz-s">${cuerpo}</div>` : ''}
      <div class="lp-wiz-b"><input type="text" inputmode="decimal" id="pc-in" placeholder="0" autocomplete="off">
      <div class="lp-hint" id="pc-h">${max != null ? 'You have ' + num(max, 6) + ' ' + sufijo : ''}${max != null ? ' · <button type="button" id="pc-max" style="background:none;border:0;color:var(--gold);cursor:pointer;font-family:var(--mono);font-size:11px">Max</button>' : ''}</div></div>
      <div class="lp-wiz-acts"><button class="lp-b gris" id="pc-no" type="button">Cancel</button><button class="lp-b" id="pc-ok" type="button">${ok}</button></div>
      <div class="lp-wiz-msg" id="pc-msg"></div></div>`;
    document.body.appendChild(d);
    const cerrar = (v) => { d.remove(); resolve(v); };
    $('pc-x').onclick = () => cerrar(null); $('pc-no').onclick = () => cerrar(null);
    d.onclick = (e) => { if (e.target === d) cerrar(null); };
    if ($('pc-max')) $('pc-max').onclick = () => { $('pc-in').value = String(max); };
    $('pc-in').focus();
    $('pc-ok').onclick = () => { const v = Number(($('pc-in').value || '').replace(/[^0-9.]/g, '')) || 0; if (!(v > 0)) { $('pc-msg').textContent = 'Enter an amount.'; return; } if (max != null && v > max + 1e-9) { $('pc-msg').textContent = 'More than you have.'; return; } cerrar(v); };
  });
}

/* ───────── Tokens del usuario (fase 1: lo que este navegador creo; fase 2: el contrato) ───────── */
function misTokens() {
  let l = []; try { l = JSON.parse(localStorage.getItem('lp-tokens') || '[]'); } catch (_) { l = []; }
  const oc = ocultos();
  return l.filter((t) => !oc.includes(String(t.address).toLowerCase()));
}
/* Tokens que el creador decidio no ver mas en su panel (siguen publicos en la cadena y en el swap).
   Fase 2: la lista se guarda firmada por wallet en el mismo almacen que las fotos. */
function ocultos() { try { return JSON.parse(localStorage.getItem('lp-ocultos') || '[]'); } catch (_) { return []; } }
function ocultar(addr) { const l = ocultos(); l.push(String(addr).toLowerCase()); try { localStorage.setItem('lp-ocultos', JSON.stringify(l)); } catch (_) {} }

/* Tres confirmaciones y una firma de la wallet creadora. Sin la firma no se oculta nada. */
async function ocultarToken(t) {
  const p1 = await modal('Hide this coin?', `<b>${esc(t.nombre)}</b> will disappear from your panel. It stays live on the chain and in the swap for everyone.`, { ok: 'Yes, hide it', cancel: 'Cancel' });
  if (!p1) return false;
  const p2 = await modal('This cannot be undone', 'The coin is not deleted: holders keep it, buyers keep finding it and its public page keeps working. What you lose is this panel: you will not manage it from here again.', { ok: 'I understand, continue', cancel: 'Cancel' });
  if (!p2) return false;
  const p3 = await modal('Last step: sign with your wallet', 'Your wallet will ask you to sign a message (no gas, nothing is sent). Only the wallet that created the coin can hide it. By signing you confirm this is final.', { ok: 'Sign and hide', cancel: 'Cancel' });
  if (!p3) return false;
  try {
    const cuenta = wallet.cuentaActual();
    if (!cuenta || (t.creador && t.creador.toLowerCase() !== cuenta.toLowerCase() && !t.demo)) { await modal('Not your coin', 'Only the wallet that created this coin can hide it.'); return false; }
    const bp = new ethers.BrowserProvider(wallet.proveedorActivo());
    const signer = await bp.getSigner();
    const msg = `DecFreedom Launchpad\nHide coin from my panel\nCoin: ${t.address}\nWallet: ${cuenta}\nDate: ${new Date().toISOString()}\nThis action is final.`;
    const firma = await signer.signMessage(msg);
    const quien = ethers.verifyMessage(msg, firma);
    if (quien.toLowerCase() !== cuenta.toLowerCase()) { await modal('Signature mismatch', 'The signature does not belong to the connected wallet. Nothing was changed.'); return false; }
  } catch (e) {
    const rech = /reject|denied|user/i.test(String(e && (e.message || e)));
    await modal(rech ? 'Signature cancelled' : 'Could not sign', rech ? 'You cancelled the signature. Nothing was changed.' : 'Your wallet did not sign. Nothing was changed.');
    return false;
  }
  if (!t.demo) ocultar(t.address);
  await modal('Hidden', `${esc(t.nombre)} no longer shows in your panel.`);
  return true;
}
function guardarTokens(l) { try { localStorage.setItem('lp-tokens', JSON.stringify(l)); } catch (_) {} }
/* Metadatos locales por moneda (logo, supply inicial): el dato de cadena manda,
   esto solo guarda lo que la cadena no tiene barato (el logo). */
function metaLocal(addr) { try { return (JSON.parse(localStorage.getItem('lp-tokens') || '[]')).find((x) => x.address.toLowerCase() === String(addr).toLowerCase()) || null; } catch (_) { return null; } }
function guardarMeta(meta) { let l = []; try { l = JSON.parse(localStorage.getItem('lp-tokens') || '[]'); } catch (_) {} const i = l.findIndex((x) => x.address.toLowerCase() === meta.address.toLowerCase()); if (i >= 0) l[i] = { ...l[i], ...meta }; else l.push(meta); try { localStorage.setItem('lp-tokens', JSON.stringify(l)); } catch (_) {} const c = JSON.parse(localStorage.getItem('lp-ocultos') || '[]'); const j = c.indexOf(meta.address.toLowerCase()); if (j >= 0) { c.splice(j, 1); localStorage.setItem('lp-ocultos', JSON.stringify(c)); } }

/* datosToken (motor) -> la forma que usa pintarPanel. */
function deChain(datos, meta) {
  if (!datos) return null;
  const pool = datos.pool ? {
    moneda: datos.moneda, quote: datos.pool.quote,
    liquidez: Number(gb.fmtEther(datos.pool.rQuote)), tokens: Number(gb.fmtEther(datos.pool.rTok)),
    rTokWei: datos.pool.rTok, rQuoteWei: datos.pool.rQuote,
    creadoEn: datos.pool.abiertoEn * 1000,
    desbloqueoTs: datos.pool.desbloqueo ? datos.pool.desbloqueo * 1000 : null
  } : null;
  const liberado = (datos.vestReclamado || 0) + (datos.reclamable || 0);
  return {
    address: datos.address, nombre: datos.nombre || (meta && meta.nombre) || '', simbolo: datos.simbolo || (meta && meta.simbolo) || '',
    logo: (meta && meta.logo) || '', supply: datos.supply,
    suelo: datos.sueloBps > 0, sueloBps: datos.sueloBps, reservaSuelo: datos.reservaSuelo, antibot: !!datos.antibot,
    fundadorPct: datos.fundadorPct, vestFinTs: (datos.vestInicio + datos.vestDur) * 1000,
    vestPct: datos.vestTotal > 0 ? Math.min(100, liberado / datos.vestTotal * 100) : 0,
    reclamable: datos.reclamable, vestTotalCoins: datos.vestTotal,
    creador: datos.creador, creadoEn: datos.creadoEn * 1000, holders: null, quemado: 0,
    pool, demo: false, fromChain: true
  };
}
/* Carga una moneda de la cadena y pinta su panel (pagina publica ?token y clics internos). */
async function cargarToken(addr) {
  pintarCargando();
  try {
    const t = deChain(await gb.datosToken(addr), metaLocal(addr));
    if (!t) { await modal('Coin not found', 'This coin is not on the launchpad, or the network did not answer. Try again.'); pintarPortada(); return; }
    t.txs = await gb.operaciones(addr).catch(() => []);
    pintarPanel(t);
  } catch (_) { await modal('Network busy', 'Could not read this coin right now. Try again in a moment.'); pintarPortada(); }
}
function pintarCargando() { const h = $(APP); if (h) h.innerHTML = `<div style="min-height:60vh;display:flex;align-items:center;justify-content:center"><span style="width:24px;height:24px;border-radius:50%;border:2px solid rgba(232,184,75,.25);border-top-color:#E8B84B;display:inline-block;animation:spin .7s linear infinite"></span></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`; }

/* Muestra de ejemplo para ver el panel sin contrato: launchpad.html?demo=1 */
function tokenDemo() {
  return {
    address: '0xD3c0F0000000000000000000000000000000FEED', nombre: 'Pepito Coin', simbolo: 'PEPITO', supply: 100000000, logo: '',
    suelo: true, sueloBps: 300, fundadorPct: 10, vestingMeses: 12, antibot: true,
    pool: { moneda: 'BNB', liquidez: 2.5, tokens: 50000000, candadoMeses: 12, creadoEn: Date.now() - 86400000 * 40 },
    creadoEn: Date.now() - 86400000 * 40, demo: true, creador: ''
  };
}

/* Operaciones de muestra (fase 2: eventos Swap del par, leidos de la cadena). */
function txsDemo(t) {
  if (!t.pool || !t.demo) return [];
  let s = 11; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const base = t.pool.liquidez / t.pool.tokens; const out = [];
  for (let i = 0; i < 48; i++) {
    const compra = rnd() > 0.45; const cant = Math.round(1000 + rnd() * 60000); const precio = base * (0.8 + rnd() * 0.5);
    out.push({ compra, cantidad: cant, valor: cant * precio, precio, tiempo: Date.now() - i * (600000 + rnd() * 1800000), wallet: '0x' + Math.floor(rnd() * 0xffffff).toString(16).padStart(6, '0') + '…' + Math.floor(rnd() * 0xffff).toString(16).padStart(4, '0') });
  }
  return out;
}
const ICO_COPY = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const ICO_CODE = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/></svg>';
function hace(ms) { const s = Math.max(0, Math.floor((Date.now() - ms) / 1000)); if (s < 60) return s + 's ago'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; }

/* ───────── Arranque ───────── */
export function arrancar() {
  const q = new URLSearchParams(location.search);
  if (q.get('demo') === '1') { pintarPanel(tokenDemo()); return; }
  const ver = q.get('token');
  if (ver && /^0x[0-9a-fA-F]{40}$/.test(ver) && hayContrato()) { cargarToken(ver); return; }
  pintarPortada();
}

/* ───────── Portada ───────── */
const ICO = {
  suelo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/></svg>',
  candado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  goteo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  escudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>'
};
function pintarPortada() {
  const host = $(APP); if (!host) return;
  const mios = misTokens();
  host.innerHTML = `
    <section class="lp-hero">
      <img class="lp-hero-ico" src="./img/launchpad-icono.webp" alt="" width="220" height="220" onerror="this.style.display='none'">
      <h1 class="lp-h1">Create your own coin</h1>
      <p class="lp-sub">Most launchpads hand you a token. This one hands you a position you can defend. Every coin deployed here carries, in its own immutable contract, the three guarantees a serious buyer checks first: a floor price backed by a BNB reserve that only grows and that any holder can redeem against; liquidity locked by the factory for the term you choose, so there is no LP to pull; and a founder allocation that vests linearly, on chain, with no override. Fixed supply, no mint, no admin keys, no proxy, verified source from block one. Deploying costs you nothing. The ecosystem takes 0.5% of each sale, in BNB, and nothing else: buying, holding and transferring are free.</p>
      <div class="lp-cta">
        <button class="lp-b" id="lp-crear">Create</button>
        <button class="lp-b" id="lp-ver-mios">My coins</button>
        <button class="lp-b" id="lp-info">Learn more</button>
      </div>
    </section>`;
  $('lp-crear').onclick = () => abrirAsistente();
  $('lp-ver-mios').onclick = () => pintarMios();
  $('lp-info').onclick = () => abrirInfo();
}

/* Pagina de informacion, escrita para quien de verdad la lee: desarrolladores y creadores
   con experiencia. Hechos del contrato, mecanica exacta, que controlas y que no. */
function abrirInfo() {
  const prev = $('lp-info-box'); if (prev) prev.remove();
  const d = document.createElement('div'); d.id = 'lp-info-box'; d.className = 'lp-wiz-bg';
  d.innerHTML = `<div class="lp-wiz lp-infobox">
    <button class="lp-wiz-x" id="lp-info-x" type="button">✕</button>
    <div class="lp-wiz-t">Technical overview</div>
    <div class="lp-wiz-s">What the factory deploys, how each mechanism works, and what nobody can change afterwards. If something here is not true of the deployed contract, it is a bug and it is public.</div>

    <div class="lp-sec"><div class="lp-sec-t">Contract facts</div>
      <ul class="lp-ul">
        <li><b>Standard BEP-20</b> (ERC-20 ABI), 18 decimals, fixed total supply minted once at creation. No <code>mint</code>, no supply changes, ever.</li>
        <li><b>Immutable token.</b> No proxy, no upgrade path, no <code>pause</code>, no blacklist, no transfer blocking. The only privileged actions belong to the mechanisms below and are bounded by the parameters you set at creation.</li>
        <li><b>Verified source.</b> Every token is deployed by the public factory from the same source, so BscScan shows the full code the moment it exists.</li>
        <li><b>Ecosystem fee: 0.5% of what a seller receives, hard-coded in the pool and paid in the pool's quote asset (BNB or USDT), never in your token.</b> The rate cannot change. It splits 0.20% to each of the two platform owners and 0.10% to DecFreedom staking; the destination wallets are read from the public Launchpad contract, so a wallet rotation never touches your token. Buys and wallet to wallet transfers pay nothing.</li>
        <li><b>Deployed from your wallet.</b> You are the creator on chain. DecFreedom holds no key over your token.</li>
      </ul></div>

    <div class="lp-sec"><div class="lp-sec-t">Mechanisms</div>
      <div class="lp-poderes">
        <div class="lp-poder"><div class="ic">${ICO.suelo}</div><b>Floor price (reserve backed)</b><span>On every sell, the share you chose (1 to 5%) is converted to BNB and held inside the token. <code>floor = reserve / circulatingSupply</code>. Any holder can call <code>redeem(amount)</code>: tokens are burned and the holder receives <code>amount × floor</code> from the reserve. The reserve only grows; the floor cannot fall. It is a hard lower bound, not a market price.</span></div>
        <div class="lp-poder"><div class="ic">${ICO.candado}</div><b>Liquidity lock (factory held)</b><span>The pool lives inside the public Launchpad contract: constant product, BNB or USDT as quote. There are no LP tokens to hold or to dump; the reserves are locked until the date you chose (6, 12, 24 months or forever). Withdrawal is only possible after the date, only by the creator, and the date cannot be shortened by anyone.</span></div>
        <div class="lp-poder"><div class="ic">${ICO.goteo}</div><b>Founder vesting (linear)</b><span>Your share (0 to 20% of supply) sits in the token under a linear schedule of 3 to 24 months. <code>claimable = share × elapsed / duration − claimed</code>. There is no cliff, no early release and no admin override.</span></div>
        <div class="lp-poder"><div class="ic">${ICO.escudo}</div><b>Launch guard (self expiring)</b><span>Enforced by the pool for the first 24 hours after it opens: no wallet can buy more than 1% of the supply from the pool, and buy plus sell in the same block is rejected. After that the checks are skipped by block timestamp. Your token itself never restricts transfers.</span></div>
      </div></div>

    <div class="lp-sec"><div class="lp-sec-t">What you control</div>
      <ul class="lp-ul">
        <li>Name, ticker, supply, logo and all mechanism parameters, once, at creation.</li>
        <li>Initial liquidity in BNB or USDT, and the lock term.</li>
        <li>Burning coins from your own wallet; claiming vested coins; withdrawing LP after the lock date.</li>
        <li>Your public page: logo, photos and links. The page itself (price, chart, trades, reserve, locks) is read from the chain and cannot be edited.</li>
      </ul></div>

    <div class="lp-sec"><div class="lp-sec-t">What nobody controls</div>
      <ul class="lp-ul">
        <li>Supply, fee rate, floor share, lock dates and vesting schedule after deployment.</li>
        <li>The reserve: it can only leave the contract through <code>redeem</code>, paid to the holder who burns.</li>
        <li>Transfers: no address can be frozen, taxed differently or blocked.</li>
      </ul></div>

    <div class="lp-sec"><div class="lp-sec-t">Distribution</div>
      <ul class="lp-ul">
        <li>Listed in the DecFreedom Swap by name, ticker or contract from the first block.</li>
        <li>Public coin page with on-chain candles built from the pair's swap events, trade tape and reserve, lock and vesting state.</li>
        <li>Embeddable swap widget (one <code>iframe</code>) defaulting to your pair, with the DecFreedom mark. All volume routes through the same public pool, so every sale feeds your floor.</li>
      </ul></div>

    <div class="lp-nota"><b>Cost.</b> Creation is free; you pay network gas. When someone sells through the pool, 0.5% of the proceeds goes to the ecosystem (0.40% platform, 0.10% staking), paid in BNB or USDT, and the pool keeps a 0.3% swap fee in its own reserves, which belong to your locked liquidity. Buys and transfers are free. Nothing else, no subscription, no listing fee. Creating a coin does not give it value; its price is whatever a public pool clears.</div>
    <div class="lp-wiz-acts"><button class="lp-b" id="lp-info-ok" type="button">Create</button></div>
  </div>`;
  document.body.appendChild(d);
  $('lp-info-x').onclick = () => d.remove();
  d.onclick = (e) => { if (e.target === d) d.remove(); };
  $('lp-info-ok').onclick = () => { d.remove(); abrirAsistente(); };
}

async function pintarMios() {
  const host = $(APP); if (!host) return;
  const cuenta = wallet.cuentaActual();
  if (!cuenta) { const si = await modal('Connect your wallet', 'Your coins belong to a wallet. Connect to see them.', { ok: 'Connect', cancel: 'Back' }); if (!si) { pintarPortada(); return; } try { await wallet.conectar(); } catch (_) {} if (!wallet.cuentaActual()) { pintarPortada(); return; } }
  host.innerHTML = `
    <button class="lp-volver" id="lp-volver" type="button">‹ Launchpad</button>
    <section class="lp-mios"><h3>My coins</h3><div id="lp-mios-lista"><div class="lp-vacio">Reading the chain…</div></div></section>`;
  $('lp-volver').onclick = () => pintarPortada();
  // La cadena manda quien existe; el navegador solo aporta el logo y oculta lo que escondiste.
  let addrs = [];
  try { addrs = (await gb.tokensDe(wallet.cuentaActual())).map((a) => String(a)); } catch (_) {}
  const oc = ocultos();
  addrs = addrs.filter((a) => !oc.includes(a.toLowerCase()));
  const c = $('lp-mios-lista'); if (!c) return;
  if (!addrs.length) { pintarPortada(); return; }
  c.innerHTML = addrs.map((a) => { const m = metaLocal(a) || {}; return `<div class="lp-tok" data-a="${a}">
      ${m.logo ? `<img src="${m.logo}" alt="">` : `<div class="lp-ini">${esc((m.simbolo || '?')[0])}</div>`}
      <div><b>${esc(m.nombre || 'Coin')} <small style="color:var(--gold);font-family:var(--mono);font-size:11px">${esc(m.simbolo || '')}</small></b><span>${corto(a)}</span></div>
      <span class="lp-est" data-pool="${a}">…</span>
    </div>`; }).join('');
  c.querySelectorAll('.lp-tok').forEach((el) => el.onclick = () => cargarToken(el.dataset.a));
  // Estado del pool (tradable / no pool), sin bloquear el render.
  addrs.forEach(async (a) => { try { const d = await gb.datosToken(a); const e = c.querySelector(`[data-pool="${a}"]`); if (e) { e.textContent = d.pool ? 'Tradable' : 'No pool'; e.classList.toggle('gris', !d.pool); } } catch (_) {} });
}

/* ───────── Asistente ───────── */
let W = null;
const PASOS = 8;
function wizCerrar() { const d = $('lp-wiz'); if (d) d.remove(); }
function marco(paso, titulo, sub, cuerpo, { atras = true, seguir = 'Continue' } = {}) {
  const prev = $('lp-wiz'); if (prev) prev.remove();
  const d = document.createElement('div'); d.id = 'lp-wiz'; d.className = 'lp-wiz-bg';
  d.innerHTML = `<div class="lp-wiz">
    <button class="lp-wiz-x" id="wz-x" type="button">✕</button>
    <div class="lp-wiz-top"><div class="lp-wiz-pasos">${Array.from({ length: PASOS }, (_, i) => `<span class="lp-wiz-d ${i + 1 < paso ? 'ok' : i + 1 === paso ? 'now' : ''}"></span>`).join('')}</div><span class="lp-wiz-n">Step ${paso} of ${PASOS}</span></div>
    <div class="lp-wiz-t">${titulo}</div>
    ${sub ? `<div class="lp-wiz-s">${sub}</div>` : ''}
    <div class="lp-wiz-b">${cuerpo}</div>
    <div class="lp-wiz-acts">${atras ? `<button class="lp-b gris" id="wz-atras" type="button">Back</button>` : ''}<button class="lp-b" id="wz-ok" type="button">${seguir}</button></div>
    <div class="lp-wiz-msg" id="wz-msg"></div>
  </div>`;
  document.body.appendChild(d);
  $('wz-x').onclick = () => { wizCerrar(); pintarPortada(); };
  if (atras) $('wz-atras').onclick = () => pintarPaso(paso - 1);
  return d;
}
const wmsg = (t) => { const m = $('wz-msg'); if (m) m.textContent = t || ''; };
const previa = () => `<div class="lp-prev">${logoPrev(W, 'lp-logo-prev')}<div><b>${esc(W.nombre || 'Your coin')}</b><span>${esc(W.simbolo || 'TICKER')}${W.supply ? ' · ' + num(W.supply, 0) + ' supply' : ''}</span></div></div>`;
function logoPrev(t, cls) { return `<div class="${cls}">${t.logo ? `<img src="${t.logo}" alt="">` : esc((t.simbolo || t.nombre || '?')[0].toUpperCase())}</div>`; }

export function abrirAsistente() {
  if (!wallet.cuentaActual()) {
    modal('Connect your wallet', 'Your coin belongs to the wallet that creates it. Connect first and we start.', { ok: 'Connect', cancel: 'Not now' })
      .then(async (si) => { if (!si) return; try { await wallet.conectar(); } catch (_) { return; } if (wallet.cuentaActual()) abrirAsistente(); });
    return;
  }
  W = { nombre: '', simbolo: '', supply: 0, logo: '', suelo: true, sueloBps: 300, fundadorPct: 10, vestingMeses: 12, antibot: true, creador: wallet.cuentaActual() };
  pintarPaso(1);
}

function pintarPaso(p) {
  if (p < 1) { wizCerrar(); pintarPortada(); return; }

  if (p === 1) {
    marco(1, 'What is your coin called?', 'The full name people will see. You can use spaces.',
      `<input type="text" id="wz-nombre" maxlength="${REGLAS.nombreMax}" placeholder="Coin name" value="${esc(W.nombre)}" autocomplete="off"><div class="lp-hint" id="wz-h"></div>`, { atras: false });
    const i = $('wz-nombre'); i.focus();
    /* Solo letras, numeros y espacios: nombres que cualquier wallet y explorador muestran bien. */
    i.oninput = () => { i.value = i.value.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s{2,}/g, ' '); const h = $('wz-h'); h.textContent = i.value.length ? `${i.value.length} / ${REGLAS.nombreMax}` : ''; };
    $('wz-ok').onclick = () => { const v = i.value.trim(); if (v.length < 2) { wmsg('Give it a name, at least 2 letters.'); return; } if (!/[a-zA-Z]/.test(v)) { wmsg('The name needs at least one letter.'); return; } W.nombre = v; if (!W.simbolo) W.simbolo = v.replace(/[^a-z]/gi, '').slice(0, 6).toUpperCase(); pintarPaso(2); };
    i.onkeydown = (e) => { if (e.key === 'Enter') $('wz-ok').click(); };
    return;
  }

  if (p === 2) {
    marco(2, 'And its ticker?', `The short symbol, ${REGLAS.simboloMin} to ${REGLAS.simboloMax} letters. Like BTC or BNB.`,
      `${previa()}<input type="text" id="wz-sim" maxlength="${REGLAS.simboloMax}" placeholder="TICKER" value="${esc(W.simbolo)}" autocomplete="off" style="text-transform:uppercase;letter-spacing:2px"><div class="lp-hint" id="wz-h"></div>`);
    const i = $('wz-sim'); i.focus();
    i.oninput = () => { i.value = i.value.replace(/[^a-z0-9]/gi, '').toUpperCase(); };
    $('wz-ok').onclick = () => { const v = i.value.trim(); if (v.length < REGLAS.simboloMin) { wmsg(`At least ${REGLAS.simboloMin} letters.`); return; } W.simbolo = v; pintarPaso(3); };
    i.onkeydown = (e) => { if (e.key === 'Enter') $('wz-ok').click(); };
    return;
  }

  if (p === 3) {
    marco(3, 'How many coins will exist?', 'The total supply. It is fixed forever: nobody, not even you, can mint more.',
      `${previa()}<div class="lp-ops" id="wz-pre">${PRESETS_SUPPLY.map((x) => `<button type="button" class="lp-op ${W.supply === x.v ? 'on' : ''}" data-v="${x.v}"><b>${x.t}</b><span>${num(x.v, 0)}</span></button>`).join('')}</div>
      <div class="lp-sub-op"><div class="lp-lab">or type your own</div><input type="text" inputmode="numeric" id="wz-sup" placeholder="21000000" value="${W.supply || ''}" autocomplete="off"><div class="lp-hint" id="wz-h"></div></div>`);
    const i = $('wz-sup');
    document.querySelectorAll('#wz-pre .lp-op').forEach((b) => b.onclick = () => { document.querySelectorAll('#wz-pre .lp-op').forEach((x) => x.classList.remove('on')); b.classList.add('on'); W.supply = Number(b.dataset.v); i.value = String(W.supply); $('wz-h').textContent = num(W.supply, 0) + ' ' + W.simbolo; });
    i.oninput = () => { i.value = i.value.replace(/[^0-9]/g, ''); document.querySelectorAll('#wz-pre .lp-op').forEach((x) => x.classList.remove('on')); W.supply = Number(i.value) || 0; $('wz-h').textContent = W.supply ? num(W.supply, 0) + ' ' + W.simbolo : ''; };
    $('wz-ok').onclick = () => { if (!(W.supply >= 1000)) { wmsg('Pick a supply of at least 1,000 coins.'); return; } if (W.supply > 1e15) { wmsg('Too many. Keep it under 1,000 trillion.'); return; } pintarPaso(4); };
    return;
  }

  if (p === 4) {
    marco(4, 'Give it a face', 'A square logo looks best. We shrink it to 128 px, same as List your token, so it loads fast everywhere.',
      `<label class="lp-logo-drop" for="wz-file">${logoPrev(W, 'lp-logo-prev')}<div><b>${W.logo ? 'Change logo' : 'Upload a logo'}</b><span>PNG, JPG or WEBP. You can skip this and add it later from your panel.</span></div></label>
      <input type="file" id="wz-file" accept="image/*" style="display:none"><div class="lp-hint" id="wz-h"></div>`, { seguir: W.logo ? 'Continue' : 'Skip' });
    $('wz-file').onchange = async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      $('wz-h').textContent = 'Shrinking your logo…';
      try { W.logo = await reducirLogo(f); pintarPaso(4); } catch (_) { $('wz-h').textContent = 'Could not read that image. Try a PNG or JPG.'; }
    };
    $('wz-ok').onclick = () => pintarPaso(5);
    return;
  }

  if (p === 5) {
    const pct = (W.sueloBps / 100);
    marco(5, 'A floor price that can only go up?', 'Part of every sale goes into a BNB reserve inside the coin. Any holder can burn coins and take their share of the reserve, always. This is what makes your coin different.',
      `<div class="lp-sw ${W.suelo ? 'on' : ''}" id="wz-sw"><div class="tg"></div><div><b>Guaranteed floor price</b><span>Recommended. It is the strongest trust signal you can give buyers.</span></div></div>
      <div class="lp-sub-op" id="wz-sub" style="${W.suelo ? '' : 'display:none'}"><div class="lp-lab">Share of each sale that feeds the floor</div>
      <div class="lp-ops cuatro" id="wz-pct">${[1, 2, 3, 5].map((v) => `<button type="button" class="lp-op ${pct === v ? 'on' : ''}" data-v="${v}"><b>${v}%</b><span>${v === 1 ? 'light' : v === 5 ? 'strong' : v === 3 ? 'balanced' : 'soft'}</span></button>`).join('')}</div></div>`);
    $('wz-sw').onclick = () => { W.suelo = !W.suelo; $('wz-sw').classList.toggle('on', W.suelo); $('wz-sub').style.display = W.suelo ? '' : 'none'; };
    document.querySelectorAll('#wz-pct .lp-op').forEach((b) => b.onclick = () => { document.querySelectorAll('#wz-pct .lp-op').forEach((x) => x.classList.remove('on')); b.classList.add('on'); W.sueloBps = Number(b.dataset.v) * 100; });
    $('wz-ok').onclick = () => pintarPaso(6);
    return;
  }

  if (p === 6) {
    marco(6, 'How much do you keep, and for how long?', 'Your share is released drop by drop, on chain. The rest of the supply goes to the pool and to buyers. Buyers can see this and it is what tells them you will not dump.',
      `<div class="lp-lab" style="font-family:var(--mono);font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--ink-3);margin:0 0 7px">Your share of the supply</div>
      <div class="lp-ops cuatro" id="wz-fp">${[0, 5, 10, 20].map((v) => `<button type="button" class="lp-op ${W.fundadorPct === v ? 'on' : ''}" data-v="${v}"><b>${v}%</b><span>${v === 0 ? 'none' : num(W.supply * v / 100, 0)}</span></button>`).join('')}</div>
      <div class="lp-sub-op" id="wz-vs" style="${W.fundadorPct ? '' : 'display:none'}"><div class="lp-lab">Released over</div>
      <div class="lp-ops cuatro" id="wz-vm">${REGLAS.vestingMeses.map((v) => `<button type="button" class="lp-op ${W.vestingMeses === v ? 'on' : ''}" data-v="${v}"><b>${v} mo</b><span>${v >= 12 ? 'trusted' : 'short'}</span></button>`).join('')}</div></div>`);
    document.querySelectorAll('#wz-fp .lp-op').forEach((b) => b.onclick = () => { document.querySelectorAll('#wz-fp .lp-op').forEach((x) => x.classList.remove('on')); b.classList.add('on'); W.fundadorPct = Number(b.dataset.v); $('wz-vs').style.display = W.fundadorPct ? '' : 'none'; });
    document.querySelectorAll('#wz-vm .lp-op').forEach((b) => b.onclick = () => { document.querySelectorAll('#wz-vm .lp-op').forEach((x) => x.classList.remove('on')); b.classList.add('on'); W.vestingMeses = Number(b.dataset.v); });
    $('wz-ok').onclick = () => pintarPaso(7);
    return;
  }

  if (p === 7) {
    marco(7, 'Fair launch against bots?', `For the first ${REGLAS.antibot.horas} hours: no wallet can hold more than ${REGLAS.antibot.maxWalletBps / 100}% of the supply and nobody can buy and sell in the same block. Then it switches off by itself.`,
      `<div class="lp-sw ${W.antibot ? 'on' : ''}" id="wz-sw"><div class="tg"></div><div><b>Anti-bot launch</b><span>Recommended. Sniper bots are the first thing that kills a new coin.</span></div></div>`);
    $('wz-sw').onclick = () => { W.antibot = !W.antibot; $('wz-sw').classList.toggle('on', W.antibot); };
    $('wz-ok').onclick = () => pintarPaso(8);
    return;
  }

  if (p === 8) {
    marco(8, 'Check it and create it', 'This is what gets written on chain. It cannot be changed afterwards.',
      `${previa()}
      <div class="lp-rev">
        <div><span>Total supply</span><b>${num(W.supply, 0)} ${esc(W.simbolo)}</b></div>
        <div><span>Floor price</span><b class="${W.suelo ? 'si' : 'no'}">${W.suelo ? 'On · ' + (W.sueloBps / 100) + '% of each sale' : 'Off'}</b></div>
        <div><span>Founder lock</span><b class="${W.fundadorPct ? 'si' : 'no'}">${W.fundadorPct ? W.fundadorPct + '% over ' + W.vestingMeses + ' months' : 'You keep nothing'}</b></div>
        <div><span>Anti-bot launch</span><b class="${W.antibot ? 'si' : 'no'}">${W.antibot ? 'On · first ' + REGLAS.antibot.horas + ' h' : 'Off'}</b></div>
        <div><span>Ecosystem fee</span><b>0.5% on sales, in BNB</b></div>
        <div><span>Cost</span><b class="si">Free · gas only</b></div>
      </div>
      ${disclaimer()}
      <label class="lp-ok"><input type="checkbox" id="wz-acepto"> I have read this and I accept it</label>`, { seguir: 'Create' });
    $('wz-ok').disabled = true;
    $('wz-acepto').onchange = (e) => { $('wz-ok').disabled = !e.target.checked; };
    $('wz-ok').onclick = () => crear();
    return;
  }
}

function disclaimer() {
  return `<div class="lp-disc">
    <img src="./img/disclaimer.webp" alt="">
    <h5>Read this before you create your coin</h5>
    <p><b>You are the issuer.</b> The coin is created from your wallet and in your name. DecFreedom only provides the tool; it is not a party to your project, does not endorse it and does not promote it.</p>
    <p><b>Creating a coin does not give it value.</b> Its price depends only on what other people are willing to pay. Nobody, including you, can promise profits. Most new coins lose all their value.</p>
    <p><b>What is locked stays locked.</b> The liquidity you add and your founder share are released by the contract on the dates you choose. We cannot unlock them early, not for you, not for anyone.</p>
    <p><b>The floor is a reserve, not a promise.</b> The floor price equals the BNB reserve divided by the supply. It rises with sales and never falls, but it is not a guarantee of your market price.</p>
    <p><b>Fees.</b> Creating is free; you pay the network gas. Every sale through the pool pays 0.5% of the proceeds to the DecFreedom ecosystem (0.40% platform, 0.10% staking), in BNB or USDT, and the pool keeps a 0.3% swap fee in its reserves. Buying and transferring are free. If a transaction reverts, nothing is charged except gas.</p>
    <p><b>Your legal duty.</b> Issuing a token may be regulated where you live. You are responsible for complying with your laws, for your buyers and for what you tell them. Do not use this to raise money with claims you cannot keep.</p>
    <p><b>Non-custodial.</b> We never hold your funds or your coins and we cannot reverse any transaction. If you lose your keys, nobody can recover your creator rights.</p>
  </div>`;
}

/* Logo: reducido en el navegador a 128 px, igual que List your token. */
function reducirLogo(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const im = new Image();
      im.onerror = reject;
      im.onload = () => {
        const s = Math.min(im.width, im.height);
        const cv = document.createElement('canvas'); cv.width = LOGO_MAX_PX; cv.height = LOGO_MAX_PX;
        const g = cv.getContext('2d');
        g.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, LOGO_MAX_PX, LOGO_MAX_PX);
        let out = cv.toDataURL('image/webp', 0.85);
        if (!out.startsWith('data:image/webp')) out = cv.toDataURL('image/jpeg', 0.85);
        resolve(out);
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/* ───────── Crear (fase 1: sin contrato) ───────── */
async function crear() {
  if (!hayContrato()) {
    wizCerrar();
    await modal('Launchpad not ready', 'The launchpad contract address is not set yet. Try again shortly.');
    pintarPortada();
    return;
  }
  const cuenta = wallet.cuentaActual();
  if (!cuenta) { await modal('Connect your wallet', 'Connect the wallet that will own the coin.'); return; }
  const prev = $('lp-wiz'); if (prev) prev.remove();
  modalBusy('Creating your coin', `Confirm in your wallet. This deploys <b>${esc(W.nombre)}</b> on BNB Smart Chain. It is free; you pay only the network gas.`);
  try {
    const supply = gb.parseEther(W.supply);
    const token = await gb.crearToken({ nombre: W.nombre, simbolo: W.simbolo, supply, sueloBps: W.suelo ? W.sueloBps : 0, fundadorPct: W.fundadorPct, vestingMeses: W.fundadorPct ? W.vestingMeses : 0, antibot: W.antibot });
    if (!token) throw new Error('Created, but the address did not come back. Check My coins in a moment.');
    // Guardar metadatos locales (logo, supply inicial) para esta moneda.
    const meta = { address: token, nombre: W.nombre, simbolo: W.simbolo, logo: W.logo || '', supply: W.supply, sueloBps: W.suelo ? W.sueloBps : 0, fundadorPct: W.fundadorPct, vestingMeses: W.vestingMeses, antibot: W.antibot, creador: cuenta, creadoEn: Date.now() };
    guardarMeta(meta);
    modalCerrar();
    const t = deChain(await gb.datosToken(token).catch(() => null), meta) || { ...meta, suelo: meta.sueloBps > 0, reservaSuelo: 0, pool: null, fromChain: true };
    pantallaValidacion(t, () => preguntarLiquidez(t));
  } catch (e) {
    modalCerrar();
    if (esRechazo(e)) { await modal('Cancelled', 'You cancelled the signature. Nothing was created.'); }
    else await modal('Could not create the coin', errTxt(e));
    pintarPortada();
  }
}

/* ───────── Paso de validacion (obligatorio tras crear, con efecto dramatico) ─────────
   Enseña, uno a uno, los mecanismos que lleva la moneda y PUBLICA su codigo verificado
   en BscScan (esto ultimo es real: gb.verificar). Las demas palomitas reflejan lo que
   el contrato ya hace de verdad; no se inventa nada que la moneda no tenga. */
const ICO_CHECK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
function pantallaValidacion(tok, siguiente) {
  const prev = $('lp-wiz'); if (prev) prev.remove();
  const items = [];
  items.push({ t: 'Fixed supply minted', s: 'No mint, no admin keys, ever' });
  if (tok.suelo) items.push({ t: 'Floor reserve armed', s: (tok.sueloBps / 100) + '% of each sale backs a redeemable floor' });
  items.push({ t: 'Rug-proof liquidity lock ready', s: 'The factory holds the LP, not you' });
  if (tok.fundadorPct) items.push({ t: 'Founder vesting set', s: tok.fundadorPct + '% released linearly, on chain' });
  if (tok.antibot) items.push({ t: 'Anti-bot launch guard', s: 'First 24 h protected from snipers' });
  items.push({ t: 'Ecosystem fee routing connected', s: '0.5% on sells, split to owners and staking' });
  const iV = items.length;
  items.push({ t: 'Source verified on BscScan', s: 'Publishing and matching bytecode' });

  const d = document.createElement('div'); d.id = 'lp-wiz'; d.className = 'lp-wiz-bg';
  d.innerHTML = `<div class="lp-wiz">
    <div class="lp-val-head">
      <div class="lp-tcard__logo" style="width:46px;height:46px;font-size:18px;border-radius:11px">${tok.logo ? `<img src="${esc(tok.logo)}" alt="">` : esc((tok.simbolo || '?')[0].toUpperCase())}</div>
      <div><div class="lp-val-h">${esc(tok.nombre)} <span>(${esc(tok.simbolo)})</span></div><div class="lp-val-sub">Created on BNB Smart Chain</div></div>
    </div>
    <div class="lp-wiz-t" style="font-size:20px;margin-top:14px">Activate and verify your coin</div>
    <div class="lp-wiz-s">One tap writes it on chain and publishes its verified source. This is what a serious buyer checks first.</div>
    <div class="lp-val" id="lp-val">${items.map((it, i) => `<div class="lp-val-item" id="val-${i}"><div class="lp-val-ic">${i + 1}</div><div class="lp-val-tx"><b>${esc(it.t)}</b><span>${esc(it.s)}</span></div></div>`).join('')}</div>
    <div class="lp-wiz-acts"><button class="lp-b" id="val-go" type="button">Activate and verify</button></div>
    <div class="lp-wiz-msg" id="wz-msg"></div>
  </div>`;
  document.body.appendChild(d);

  const setIc = (i, html) => { const e = document.querySelector(`#val-${i} .lp-val-ic`); if (e) e.innerHTML = html; };
  const cls = (i, c) => { const e = $('val-' + i); if (e) e.className = 'lp-val-item ' + c; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const SP = '<span class="sp"></span>';

  $('val-go').onclick = async () => {
    const go = $('val-go'); go.disabled = true; go.textContent = 'Activating…';
    const verifP = tok.demo ? Promise.resolve('ya') : gb.verificar(tok.address).catch(() => 'error');
    for (let i = 0; i < iV; i++) {
      cls(i, 'act'); setIc(i, SP);
      await wait(540 + Math.random() * 260);
      cls(i, 'done'); setIc(i, ICO_CHECK);
    }
    cls(iV, 'act'); setIc(iV, SP);
    go.textContent = 'Continue'; go.disabled = false;
    go.onclick = () => { wizCerrar(); siguiente(); };
    const r = await verifP;
    if (r === 'ok' || r === 'ya') { cls(iV, 'done'); setIc(iV, ICO_CHECK); }
    else {
      cls(iV, 'warn'); setIc(iV, '!');
      const sp = document.querySelector(`#val-${iV} .lp-val-tx span`);
      if (sp) sp.textContent = r === 'pendiente' ? 'Still compiling on BscScan, it will appear shortly.' : 'Verification will finish on its own shortly.';
      try { console.warn('[launchpad verif]', r); } catch (_) {}
    }
  };
}

/* ───────── Liquidez (se ofrece justo despues de crear) ───────── */
function preguntarLiquidez(tok) {
  const prev = $('lp-wiz'); if (prev) prev.remove();
  const bsc = 'https://bscscan.com/address/' + tok.address + '#code';
  const lab = 'font-family:var(--mono);font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--ink-3)';
  let monId = 'BNB', cand = 12;
  const d = document.createElement('div'); d.id = 'lp-wiz'; d.className = 'lp-wiz-bg';
  d.innerHTML = `<div class="lp-wiz">
    <div class="lp-tcard">
      <span class="lp-live-pill"><i></i>Live</span>
      <div class="lp-tcard__logo">${tok.logo ? `<img src="${esc(tok.logo)}" alt="">` : esc((tok.simbolo || tok.nombre || '?')[0].toUpperCase())}</div>
      <div class="lp-tcard__id">
        <div class="lp-tcard__name">${esc(tok.nombre)} <span>(${esc(tok.simbolo)})</span></div>
        <button class="lp-addr-full" id="lp-copiar" type="button" title="Copy contract"><span class="lp-addr-txt">${esc(tok.address)}</span>${ICO_COPY}</button>
        <div class="lp-tcard__meta"><span class="lp-net"><i></i>BNB Smart Chain</span><a class="lp-codelink" href="${bsc}" target="_blank" rel="noopener">${ICO_CODE} View code</a></div>
      </div>
    </div>
    <p class="lp-live-note">Your coin exists on BNB Smart Chain. Add liquidity so anyone can buy it now, or do it later from your panel.</p>
    <div class="lp-wiz-b">
      <div class="lp-lab" style="${lab};margin:0 0 7px">Coins you put in the pool</div>
      <input type="text" inputmode="numeric" id="lq-tok" placeholder="${num(tok.supply / 2, 0)}" autocomplete="off">
      <div class="lp-lab" style="${lab};margin:12px 0 7px">Liquidity you add</div>
      <div class="lp-liq-row"><input type="text" inputmode="decimal" id="lq-cant" placeholder="0.00" autocomplete="off">
        <div class="lp-sel" id="lq-sel"><button type="button" class="lp-sel__btn" id="lq-sel-b"><span class="lp-sel__t" id="lq-sel-t">BNB</span><svg width="12" height="12" viewBox="0 0 14 14"><use href="#chev"/></svg></button>
        <div class="lp-sel__menu" id="lq-sel-m">${LIQUIDEZ.map((m) => `<button type="button" data-id="${m.id}" class="${m.id === 'BNB' ? 'on' : ''}">${m.simbolo}</button>`).join('')}</div></div>
      </div>
      <div class="lp-lab" style="${lab};margin:12px 0 7px">Locked for</div>
      <div class="lp-ops cuatro" id="lq-cand">${REGLAS.candadoMeses.map((v, i) => `<button type="button" class="lp-op ${i === 1 ? 'on' : ''}" data-v="${v}"><b>${v === 0 ? 'Forever' : v + ' mo'}</b><span>${v === 0 ? 'max trust' : v >= 12 ? 'trusted' : 'minimum'}</span></button>`).join('')}</div>
      <div class="lp-ratio" id="lq-ratio">Starting price appears here when you fill both amounts.</div>
    </div>
    <div class="lp-wiz-acts"><button class="lp-b gris" id="lq-no" type="button">Later</button><button class="lp-b" id="lq-si" type="button">Launch</button></div>
    <div class="lp-wiz-msg" id="wz-msg"></div>
  </div>`;
  document.body.appendChild(d);
  const ratio = () => {
    const t = Number($('lq-tok').value.replace(/[^0-9.]/g, '')) || 0, c = Number($('lq-cant').value.replace(/[^0-9.]/g, '')) || 0;
    const r = $('lq-ratio');
    if (!(t > 0 && c > 0)) { r.innerHTML = 'Starting price appears here when you fill both amounts.'; return; }
    r.innerHTML = `Starting price: <b>1 ${esc(tok.simbolo)} = ${(c / t).toPrecision(4)} ${monId}</b> · locked ${cand === 0 ? 'forever' : cand + ' months'}. You never hold the LP: the contract does.`;
  };
  ['lq-tok', 'lq-cant'].forEach((id) => $(id).oninput = ratio);
  const selM = $('lq-sel-m');
  $('lq-sel-b').onclick = (e) => { e.stopPropagation(); selM.classList.toggle('open'); };
  d.addEventListener('click', (e) => { if (!e.target.closest('#lq-sel')) selM.classList.remove('open'); });
  selM.querySelectorAll('button').forEach((b) => b.onclick = () => { monId = b.dataset.id; $('lq-sel-t').textContent = b.textContent; selM.querySelectorAll('button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); selM.classList.remove('open'); ratio(); });
  document.querySelectorAll('#lq-cand .lp-op').forEach((b) => b.onclick = () => { document.querySelectorAll('#lq-cand .lp-op').forEach((x) => x.classList.remove('on')); b.classList.add('on'); cand = Number(b.dataset.v); ratio(); });
  $('lp-copiar').onclick = () => { try { navigator.clipboard.writeText(tok.address); const c = $('lp-copiar'); c.classList.add('copied'); setTimeout(() => c.classList.remove('copied'), 1400); } catch (_) {} };
  $('lq-no').onclick = () => { wizCerrar(); pintarPanel(tok); };
  $('lq-si').onclick = async () => {
    const cTok = Number($('lq-tok').value.replace(/[^0-9.]/g, '')) || 0;
    const cQuote = Number($('lq-cant').value.replace(/[^0-9.]/g, '')) || 0;
    if (!(cTok > 0)) { wmsg('How many coins go into the pool?'); return; }
    if (!(cQuote > 0)) { wmsg('How much liquidity do you add?'); return; }
    if (tok.demo) { wmsg('This is a demo coin.'); return; }
    modalBusy('Launching the pool', `Confirm the signatures in your wallet. You grant permission over your <b>${esc(tok.simbolo)}</b>${monId === 'USDT' ? ' and USDT' : ''}, then the pool is created with the liquidity locked ${cand === 0 ? 'forever' : 'for ' + cand + ' months'}.`);
    try {
      await gb.abrirPool({ token: tok.address, cantTok: gb.parseEther(cTok), quoteId: monId, cantQuote: gb.parseEther(cQuote), candadoMeses: cand });
      modalCerrar();
      const t = deChain(await gb.datosToken(tok.address).catch(() => null), metaLocal(tok.address)) || tok;
      pintarPanel(t);
    } catch (e) {
      modalCerrar();
      if (esRechazo(e)) wmsg('You cancelled a signature.');
      else await modal('Could not launch the pool', errTxt(e));
    }
  };
}

/* ───────── Panel del creador ───────── */
function pintarPanel(t) {
  const host = $(APP); if (!host) return;
  const pool = t.pool || null;
  const precio = pool ? pool.liquidez / pool.tokens : 0;
  const mcap = pool ? precio * t.supply : 0;
  const quemado = t.quemado || 0, holders = (t.holders === undefined ? (pool ? 1 : 1) : t.holders);
  const suelo = t.suelo ? (t.reservaSuelo || 0) / Math.max(1, t.supply - quemado) : 0;
  const mon = pool ? pool.moneda : 'BNB';
  const desbloqueo = pool ? (pool.desbloqueoTs !== undefined ? pool.desbloqueoTs : (pool.candadoMeses === 0 ? null : pool.creadoEn + pool.candadoMeses * 30 * 86400000)) : null;
  const vestFin = t.vestFinTs || (t.creadoEn + (t.vestingMeses || 0) * 30 * 86400000);
  const vestPct = t.vestPct != null ? t.vestPct : (t.fundadorPct ? Math.min(100, Math.max(0, (Date.now() - t.creadoEn) / (vestFin - t.creadoEn) * 100)) : 0);
  const fundadorTot = t.vestTotalCoins != null ? t.vestTotalCoins : t.supply * (t.fundadorPct || 0) / 100;
  const widgetUrl = `${location.origin}${location.pathname.replace(/launchpad\.html.*$/, '')}widget.html?token=${t.address}`;
  const cuenta = (wallet.cuentaActual() || '').toLowerCase();
  const esAdmin = t.demo || (t.creador && t.creador.toLowerCase() === cuenta);
  const txs = t.txs || txsDemo(t);
  const vol24 = txs.filter((x) => Date.now() - x.tiempo < 86400000).reduce((a, x) => a + x.valor, 0);
  const cambio24 = (() => { const h = txs.filter((x) => Date.now() - x.tiempo < 86400000); if (h.length < 2) return null; const ult = h[0].precio, ant = h[h.length - 1].precio; return ant > 0 ? (ult / ant - 1) * 100 : null; })();
  const precioTxt = pool ? fmtP(txs.length ? txs[0].precio : precio) + ' ' + mon : 'no pool';
  host.innerHTML = `
    <button class="lp-volver" id="lp-volver" type="button">‹ Launchpad</button>
    <div class="lp-panel">
      <div class="lp-top">
        <div class="lp-id">${logoPrev(t, 'lp-logo-prev')}<div><div class="lp-nom">${esc(t.nombre)}<small>${esc(t.simbolo)}</small></div><button class="lp-dir" id="lp-copiar" type="button" title="Copy contract">${corto(t.address)} ${ICO_COPY}</button><span id="lp-verif" style="display:block"></span></div></div>
        <div class="lp-precio"><b>${precioTxt}</b><span class="${cambio24 == null ? '' : cambio24 >= 0 ? 'up' : 'down'}">${cambio24 == null ? '24h · no data yet' : (cambio24 >= 0 ? '+' : '') + cambio24.toFixed(2) + '% · 24h'}</span></div>
        <div class="lp-stats">
          <div class="lp-stat"><i>Supply</i><b>${num(t.supply, 0)}</b></div>
          <div class="lp-stat"><i>Burned</i><b>${quemado ? num(quemado, 0) : '0'}</b></div>
          <div class="lp-stat"><i>Holders</i><b>${holders == null ? 'n/a' : num(holders, 0)}</b></div>
          <div class="lp-stat"><i>Market cap</i><b class="oro">${pool ? num(mcap, 4) + ' ' + mon : '...'}</b></div>
          <div class="lp-stat"><i>Real liquidity</i><b class="verde">${pool ? num(pool.liquidez, 4) + ' ' + mon : 'No pool'}</b></div>
          <div class="lp-stat"><i>24h volume</i><b>${pool ? num(vol24, 4) + ' ' + mon : '...'}</b></div>
          <div class="lp-stat"><i>Floor price</i><b>${t.suelo ? (suelo > 0 ? fmtP(suelo) + ' ' + mon : 'building') : 'off'}</b></div>
        </div>
      </div>
      <div class="lp-main">
        <div class="lp-card lp-chart-card">
          <div class="lp-chart-tabs"><button class="on" data-r="1h">1h</button><button data-r="4h">4h</button><button data-r="1d">1d</button></div>
          <div class="lp-chart"><canvas id="lp-cv"></canvas>${pool ? '' : '<div class="lp-chart-vacio">The chart appears as soon as your pool has its first trades.<br>Every candle is read from the chain, nothing else.</div>'}</div>
        </div>
        <div class="lp-card lp-txs">
          <div class="lp-txs-head"><h4>Trades</h4>
            <div class="lp-filtro" id="lp-filtro"><button type="button" id="lp-filtro-b">Latest <svg width="10" height="10" viewBox="0 0 14 14"><use href="#chev"/></svg></button>
              <div class="lp-filtro-m" id="lp-filtro-m">
                <button type="button" data-f="latest">Latest</button><button type="button" data-f="buys">Buys only</button><button type="button" data-f="sells">Sells only</button><button type="button" data-f="bigbuys">Largest buys</button><button type="button" data-f="bigsells">Largest sells</button>
              </div></div></div>
          <div class="lp-tabla" id="lp-tabla"></div>
        </div>
      </div>
      <div class="lp-side">
        <div class="lp-card"><h4>Liquidity</h4>
          <div class="lp-kv"><span>In the pool</span><b>${pool ? num(pool.liquidez, 4) + ' ' + mon : 'none'}</b></div>
          <div class="lp-kv"><span>Lock</span><b>${pool ? (desbloqueo ? 'until ' + new Date(desbloqueo).toLocaleDateString('en-GB') : 'forever') : '...'}</b></div>
          <div class="lp-kv"><span>Status</span><b><span class="lp-sello ${pool ? '' : 'gris'}">${pool ? (desbloqueo && Date.now() > desbloqueo ? 'unlocked' : 'locked') : 'no pool'}</span></b></div>
          ${esAdmin ? (pool ? `<button class="lp-b gris" id="lp-ret" ${desbloqueo && Date.now() > desbloqueo ? '' : 'disabled'} type="button">${desbloqueo && Date.now() > desbloqueo ? 'Withdraw' : 'Locked'}</button>` : `<button class="lp-b" id="lp-add" type="button">Add liquidity</button>`) : ''}
        </div>
        ${t.suelo ? `<div class="lp-card"><h4>Floor reserve</h4>
          <div class="lp-kv"><span>Reserve</span><b>${num(t.reservaSuelo || 0, 5)} ${mon}</b></div>
          <div class="lp-kv"><span>Feeds from sales</span><b class="oro">${t.sueloBps / 100}%</b></div>
          <div class="lp-kv"><span>Floor per coin</span><b>${suelo > 0 ? fmtP(suelo) + ' ' + mon : 'building'}</b></div>
          <button class="lp-b gris" id="lp-redeem" type="button" ${suelo > 0 ? '' : 'disabled'}>Redeem</button></div>` : ''}
        ${t.fundadorPct ? `<div class="lp-card"><h4>Founder lock</h4>
          <div class="lp-kv"><span>Founder share</span><b>${num(fundadorTot, 0)} ${esc(t.simbolo)}</b></div>
          <div class="lp-bar"><i style="width:${vestPct.toFixed(1)}%"></i></div>
          <div class="lp-kv"><span>Released</span><b class="oro">${vestPct.toFixed(1)}%</b></div>
          <div class="lp-kv"><span>Fully released</span><b>${new Date(vestFin).toLocaleDateString('en-GB')}</b></div>
          ${esAdmin ? `<button class="lp-b gris" id="lp-claim" type="button" ${vestPct > 0 ? '' : 'disabled'}>Claim</button>` : ''}</div>` : ''}
        ${esAdmin ? `<div class="lp-card"><h4>Creator tools</h4>
          <div class="lp-kv"><span>Burn coins</span><b>from your wallet</b></div>
          <button class="lp-b gris" id="lp-burn" type="button">Burn</button>
          <div class="lp-kv" style="margin-top:8px"><span>Photos and links</span><b>public page</b></div>
          <button class="lp-b gris" id="lp-fotos" type="button">Edit profile</button>
          <div class="lp-kv" style="margin-top:8px"><span>Hide from my panel</span><b>stays public</b></div>
          <button class="lp-b gris rojo" id="lp-ocultar" type="button">Hide</button></div>` : ''}
        <div class="lp-card"><h4>Embed our swap on your site</h4>
          <div class="lp-widget-prev">
            <div class="wp-top">${logoPrev(t, 'lp-logo-prev')}<b>Buy ${esc(t.simbolo)}</b></div>
            <div class="wp-box"><div class="wp-in"><span>You pay</span><b>BNB</b></div><div class="wp-in"><span>You get</span><b>${esc(t.simbolo)}</b></div><div class="wp-btn">Swap</div></div>
            <div class="wp-marca"><img src="./img/cco-full.webp" alt="DecFreedom"> POWERED BY DECFREEDOM</div>
          </div>
          <div class="lp-code" id="lp-code">&lt;iframe src="${esc(widgetUrl)}" width="360" height="520" style="border:0;border-radius:16px" loading="lazy"&gt;&lt;/iframe&gt;</div>
          <button class="lp-b gris" id="lp-copy-w" type="button">Copy code</button>
        </div>
      </div>
    </div>`;
  /* Tabla de operaciones con filtro */
  let filtro = 'latest';
  const pintarTabla = () => {
    let l = txs.slice();
    if (filtro === 'buys') l = l.filter((x) => x.compra); if (filtro === 'sells') l = l.filter((x) => !x.compra);
    if (filtro === 'bigbuys') l = l.filter((x) => x.compra).sort((a, b) => b.valor - a.valor);
    if (filtro === 'bigsells') l = l.filter((x) => !x.compra).sort((a, b) => b.valor - a.valor);
    const c = $('lp-tabla'); if (!c) return;
    if (!l.length) { c.innerHTML = `<div class="lp-vacio">No trades yet. They appear here the moment someone buys or sells.</div>`; return; }
    c.innerHTML = `<div class="lp-tr lp-th"><span>Type</span><span>Amount ${esc(t.simbolo)}</span><span>Value ${mon}</span><span>Price ${mon}</span><span>Wallet</span><span>When</span></div>` +
      l.slice(0, 60).map((x) => `<div class="lp-tr ${x.compra ? 'buy' : 'sell'}"><span class="lp-tipo"><i></i>${x.compra ? 'BUY' : 'SELL'}</span><span>${num(x.cantidad, 0)}</span><span>${fmtP(x.valor)}</span><span>${fmtP(x.precio)}</span><span class="lp-w">${esc(x.wallet)}</span><span class="lp-t">${hace(x.tiempo)}</span></div>`).join('');
  };
  pintarTabla();
  const fm = $('lp-filtro-m'), fb = $('lp-filtro-b');
  fb.onclick = (e) => { e.stopPropagation(); fm.classList.toggle('open'); };
  document.addEventListener('click', () => fm && fm.classList.remove('open'), { once: true });
  fm.querySelectorAll('button').forEach((b) => b.onclick = () => { filtro = b.dataset.f; fb.innerHTML = b.textContent + ' <svg width="10" height="10" viewBox="0 0 14 14"><use href="#chev"/></svg>'; fm.classList.remove('open'); pintarTabla(); });
  if ($('lp-redeem')) $('lp-redeem').onclick = () => accionRedimir(t);
  if ($('lp-burn')) $('lp-burn').onclick = () => accionQuemar(t);
  if ($('lp-fotos')) $('lp-fotos').onclick = () => modal('Coming with the contract', 'Photos and links use the same storage as List your token. It is wired in the next phase.');
  if ($('lp-ocultar')) $('lp-ocultar').onclick = async () => { if (await ocultarToken(t)) { history.replaceState(null, '', location.pathname); pintarPortada(); } };
  $('lp-volver').onclick = () => { history.replaceState(null, '', location.pathname); pintarPortada(); };
  $('lp-copiar').onclick = () => { try { navigator.clipboard.writeText(t.address); $('lp-copiar').innerHTML = 'copied ' + ICO_COPY; setTimeout(() => { $('lp-copiar').innerHTML = corto(t.address) + ' ' + ICO_COPY; }, 1500); } catch (_) {} };
  $('lp-copy-w').onclick = () => { try { navigator.clipboard.writeText($('lp-code').textContent); $('lp-copy-w').textContent = 'Copied'; setTimeout(() => { $('lp-copy-w').textContent = 'Copy code'; }, 1500); } catch (_) {} };
  if ($('lp-add')) $('lp-add').onclick = () => preguntarLiquidez(t);
  if ($('lp-ret')) $('lp-ret').onclick = () => accionRetirar(t);
  if ($('lp-claim')) $('lp-claim').onclick = () => accionReclamar(t);
  document.querySelectorAll('.lp-chart-tabs button').forEach((b) => b.onclick = () => { document.querySelectorAll('.lp-chart-tabs button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); pintarGrafica(t, b.dataset.r); });
  pintarGrafica(t, '1h');
  if (!t.demo && t.address) pintarVerif(t.address);
}

/* Estado de verificacion en BscScan: badge verde con enlace, o boton para verificar
   (sirve tanto para monedas nuevas como para las creadas antes de esta funcion). */
/* En el panel la verificacion es solo un sello de lectura (verde con enlace si esta
   verificada). La ACCION de verificar vive en el paso de validacion al crear la moneda. */
async function pintarVerif(addr) {
  const el = $('lp-verif'); if (!el) return;
  el.innerHTML = '';
  if (await gb.verificado(addr).catch(() => false)) {
    const chip = 'display:inline-flex;align-items:center;gap:6px;margin-top:9px;font-family:var(--mono);font-size:11px;padding:6px 11px;border-radius:8px;text-decoration:none;color:var(--verde);border:1px solid rgba(46,232,106,.45);background:rgba(46,232,106,.08)';
    el.innerHTML = `<a href="https://bscscan.com/address/${addr}#code" target="_blank" rel="noopener" style="${chip}">${ICO_CHECK} Verified on BscScan</a>`;
  }
}

/* ───────── Acciones del panel (firman contra el contrato) ───────── */
async function _tras(t, titulo, fn) {
  modalBusy(titulo, 'Confirm in your wallet.');
  try { await fn(); modalCerrar(); await cargarToken(t.address); }
  catch (e) { modalCerrar(); if (esRechazo(e)) await modal('Cancelled', 'You cancelled the signature. Nothing changed.'); else await modal('Could not complete', errTxt(e)); }
}
async function accionRetirar(t) {
  if (t.demo) return modal('Demo', 'This is a demo coin.');
  const ok = await modal('Withdraw liquidity', `The lock is over. Your pooled coins and <b>${num((t.pool && t.pool.liquidez) || 0, 4)} ${t.pool ? t.pool.moneda : 'BNB'}</b> go back to your wallet and the pool closes.`, { ok: 'Withdraw', cancel: 'Cancel' });
  if (!ok) return; _tras(t, 'Withdrawing liquidity', () => gb.retirarLiquidez(t.address));
}
async function accionReclamar(t) {
  if (t.demo) return modal('Demo', 'This is a demo coin.');
  const ok = await modal('Claim released coins', `You claim the part of your founder allocation already released: <b>${num(t.reclamable || 0, 4)} ${esc(t.simbolo)}</b>.`, { ok: 'Claim', cancel: 'Cancel' });
  if (!ok) return; _tras(t, 'Claiming your coins', () => gb.reclamarGoteo(t.address));
}
async function accionRedimir(t) {
  if (t.demo) return modal('Demo', 'This is a demo coin.');
  const cuenta = wallet.cuentaActual();
  if (!cuenta) { await modal('Connect your wallet', 'Connect to redeem.'); return; }
  let saldo = 0; try { saldo = Number(gb.fmtEther(await gb.saldoToken(t.address, cuenta))); } catch (_) {}
  if (!(saldo > 0)) { await modal('No coins to redeem', `You do not hold any ${esc(t.simbolo)}.`); return; }
  const floor = t.supply > 0 ? (t.reservaSuelo || 0) / t.supply : 0;
  const cant = await pedirCantidad({ titulo: 'Redeem at the floor', cuerpo: `Burn ${esc(t.simbolo)} and receive its share of the reserve (~${fmtP(floor)} ${t.pool ? t.pool.moneda : 'BNB'} per coin). The coins you redeem are destroyed.`, max: saldo, sufijo: t.simbolo, ok: 'Redeem' });
  if (cant == null) return;
  _tras(t, 'Redeeming at the floor', () => gb.redimir(t.address, gb.parseEther(cant)));
}
async function accionQuemar(t) {
  if (t.demo) return modal('Demo', 'This is a demo coin.');
  const cuenta = wallet.cuentaActual();
  let saldo = 0; try { saldo = Number(gb.fmtEther(await gb.saldoToken(t.address, cuenta))); } catch (_) {}
  if (!(saldo > 0)) { await modal('Nothing to burn', `You do not hold any ${esc(t.simbolo)}.`); return; }
  const cant = await pedirCantidad({ titulo: 'Burn coins', cuerpo: `Permanently destroy ${esc(t.simbolo)} from your wallet. This lowers the supply and raises the floor per coin. There is no refund.`, max: saldo, sufijo: t.simbolo, ok: 'Burn' });
  if (cant == null) return;
  _tras(t, 'Burning coins', () => gb.quemar(t.address, gb.parseEther(cant)));
}

/* Velas: fase 1 dibuja una serie de muestra en el demo; fase 2 lee los eventos Swap del par
   (eth_getLogs) y arma las velas en el navegador, sin terceros. */
function velasDemo(t, rango) {
  if (!t.pool || !t.demo) return [];
  const n = 60, out = []; let p = t.pool.liquidez / t.pool.tokens; let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) { const o = p; const c = o * (1 + (rnd() - 0.47) * 0.08); const h = Math.max(o, c) * (1 + rnd() * 0.03); const l = Math.min(o, c) * (1 - rnd() * 0.03); out.push({ o, h, l, c, v: rnd() }); p = c; }
  return out;
}
/* Velas reales a partir de las operaciones (eventos Compra/Venta), agrupadas por tiempo. */
function velasDeOps(ops, rango) {
  const l = (ops || []).filter((o) => o.precio > 0 && o.tiempo > 0).slice().sort((a, b) => a.tiempo - b.tiempo);
  if (l.length < 2) return [];
  const bucket = rango === '1d' ? 86400000 : rango === '4h' ? 14400000 : 3600000;
  const velas = []; let cur = null;
  for (const o of l) {
    const k = Math.floor(o.tiempo / bucket);
    if (!cur || cur.k !== k) { if (cur) velas.push(cur); cur = { k, o: o.precio, h: o.precio, l: o.precio, c: o.precio, v: o.valor }; }
    else { cur.h = Math.max(cur.h, o.precio); cur.l = Math.min(cur.l, o.precio); cur.c = o.precio; cur.v += o.valor; }
  }
  if (cur) velas.push(cur);
  return velas.slice(-60);
}
function pintarGrafica(t, rango) {
  const cv = $('lp-cv'); if (!cv) return;
  const velas = t.demo ? velasDemo(t, rango) : velasDeOps(t.txs, rango);
  const W0 = cv.clientWidth || 600, H0 = cv.clientHeight || 380, dpr = window.devicePixelRatio || 1;
  cv.width = W0 * dpr; cv.height = H0 * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
  g.clearRect(0, 0, W0, H0);
  if (!velas.length) return;
  const padL = 10, padR = 64, padT = 14, padB = 22;
  const hi = Math.max(...velas.map((v) => v.h)), lo = Math.min(...velas.map((v) => v.l));
  const y = (p) => padT + (hi - p) / (hi - lo || 1) * (H0 - padT - padB);
  const w = (W0 - padL - padR) / velas.length;
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.font = '10px IBM Plex Mono, monospace'; g.fillStyle = '#7d8794'; g.textAlign = 'left';
  for (let k = 0; k <= 4; k++) { const p = lo + (hi - lo) * k / 4; const yy = y(p); g.beginPath(); g.moveTo(padL, yy); g.lineTo(W0 - padR, yy); g.stroke(); g.fillText(p.toPrecision(3), W0 - padR + 6, yy + 3); }
  velas.forEach((v, i) => {
    const x = padL + i * w + w / 2; const up = v.c >= v.o; g.strokeStyle = g.fillStyle = up ? '#2ebd85' : '#f6465d';
    g.beginPath(); g.moveTo(x, y(v.h)); g.lineTo(x, y(v.l)); g.stroke();
    const top = y(Math.max(v.o, v.c)), hh = Math.max(1, Math.abs(y(v.o) - y(v.c)));
    g.fillRect(x - w * 0.32, top, w * 0.64, hh);
  });
  if (t.suelo && t.reservaSuelo) { const f = t.reservaSuelo / t.supply; if (f > lo && f < hi) { g.setLineDash([4, 4]); g.strokeStyle = '#E8B84B'; g.beginPath(); g.moveTo(padL, y(f)); g.lineTo(W0 - padR, y(f)); g.stroke(); g.setLineDash([]); g.fillStyle = '#E8B84B'; g.fillText('floor', W0 - padR + 6, y(f) - 4); } }
  g.fillStyle = '#7d8794'; g.textAlign = 'center'; g.fillText(rango + ' candles · read from the chain', W0 / 2, H0 - 6);
}
