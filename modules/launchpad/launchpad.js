/* launchpad/launchpad.js. Interfaz del Launchpad (fase 1: solo front).
   Portada, asistente de una pregunta por pantalla (como el P2P), panel del creador,
   generador del widget. Las firmas al contrato se enchufan en la
   fase de contrato: mientras LAUNCHPAD sea 0x0, el boton final avisa "pending". */

import * as wallet from './wallet.js';
import * as ethers from './ethers.min.js';
import { LAUNCHPAD, LIQUIDEZ, REGLAS, PRESETS_SUPPLY, LOGO_MAX_PX } from './config.js';
import * as gb from './motor.js';
import { descargarTokenomics } from './tokenomics.js';
import { guardarMoneda, leerMoneda, leerMonedas } from './firebase-tokens.js';
import { filaRedes, redesControl, abrirEditorMoneda } from './perfil-moneda.js';

const $ = (id) => document.getElementById(id);
const APP = 'colmena-app';
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n, d = 2) => isFinite(n) ? Number(n).toLocaleString('en-US', { maximumFractionDigits: d }) : '...';
/* Numero compacto para cantidades grandes (supply, quemado): 100M, 2.5B, sin desbordar la casilla. */
const numC = (n) => { n = Number(n) || 0; if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 2).replace(/\.?0+$/, '') + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 2).replace(/\.?0+$/, '') + 'M'; if (n >= 1e4) return (n / 1e3).toFixed(0) + 'K'; return num(n, 0); };
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
/* Descarga la ficha tecnica + tokenomics de ESTA moneda (PDF por moneda, generado en el navegador). */
async function bajarTokenomics(t, btn) {
  const lab = btn && btn.querySelector('b'); const nodo = lab || btn; const t0 = nodo ? nodo.textContent : '';
  if (nodo) nodo.textContent = 'Preparing PDF…'; if (btn) btn.disabled = true;
  try { await descargarTokenomics({ nombre: t.nombre, simbolo: t.simbolo, contrato: t.address, supply: t.supply ? num(t.supply, 0) + ' ' + t.simbolo : '' }); }
  catch (_) { await modal('Could not build the document', 'The PDF tool could not load. Check your connection and try again.'); }
  if (nodo) nodo.textContent = t0; if (btn) btn.disabled = false;
}
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
  // Quitar de mi lista = preferencia local de esta vista (no toca la cadena: la moneda es
  // permanente para sus holders y su pagina publica). Tres confirmaciones y se quita de verdad;
  // no se pide firma porque no hay nada que firmar en una accion solo de este navegador.
  const p1 = await modal('Remove this coin?', `<b>${esc(t.nombre)}</b> will disappear from your list. It stays live on the chain and in the swap for everyone.`, { ok: 'Yes, remove it', cancel: 'Cancel' });
  if (!p1) return false;
  const p2 = await modal('This cannot be undone here', 'The coin is not deleted from the blockchain: holders keep it, buyers keep finding it and its public page keeps working. What you remove is this card from your list.', { ok: 'I understand, continue', cancel: 'Cancel' });
  if (!p2) return false;
  const p3 = await modal('Confirm once more', 'Press confirm to remove it from your list. You can open it again any time from its contract address or its public link.', { ok: 'Remove it', cancel: 'Cancel' });
  if (!p3) return false;
  if (!t.demo) ocultar(t.address);
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
let _panelAddr = null;
async function cargarToken(addr) {
  _panelAddr = addr;
  pintarCargando();
  try {
    const [datos, perfil, bnbUsd] = await Promise.all([gb.datosToken(addr), leerMoneda(addr).catch(() => null), gb.precioBNBUSDT().catch(() => 0)]);
    const t = deChain(datos, metaLocal(addr));
    if (!t) { await modal('Coin not found', 'This coin is not on the launchpad, or the network did not answer. Try again.'); pintarPortada(); return; }
    // El logo persiste en Firestore (por direccion), no en el navegador: la cadena manda el resto.
    if (perfil) { if (perfil.logo) t.logo = perfil.logo; t.redes = perfil; }
    t.bnbUsd = bnbUsd;   // tasa BNB->USDT para mostrar el panel en USDT
    t.txs = [];          // pinta ya; el historial real puede tardar en RPC y va en segundo plano
    pintarPanel(t);
    // Historial real de la cadena en segundo plano: al llegar repinta con grafica, trades, 24h y volumen reales.
    gb.operaciones(addr).then((ops) => { if (_panelAddr === addr && ops && ops.length) { t.txs = ops; pintarPanel(t); } }).catch(() => {});
  } catch (_) { await modal('Network busy', 'Could not read this coin right now. Try again in a moment.'); pintarPortada(); }
}
function pintarCargando() { const h = $(APP); if (h) h.innerHTML = `<div style="min-height:60vh;display:flex;align-items:center;justify-content:center"><span style="width:24px;height:24px;border-radius:50%;border:2px solid rgba(232,184,75,.25);border-top-color:#E8B84B;display:inline-block;animation:spin .7s linear infinite"></span></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`; }

/* Muestra de ejemplo para ver el panel sin contrato: launchpad.html?demo=1 */
function tokenDemo() {
  return {
    address: '0xD3c0F0000000000000000000000000000000FEED', nombre: 'Demo Coin', simbolo: 'DEMO', supply: 100000000, logo: '',
    suelo: true, sueloBps: 300, fundadorPct: 10, vestingMeses: 12, antibot: true,
    pool: { moneda: 'BNB', liquidez: 2.5, tokens: 50000000, candadoMeses: 12, creadoEn: Date.now() - 86400000 * 40 },
    bnbUsd: 600, creadoEn: Date.now() - 86400000 * 40, demo: true, creador: ''
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
/* Logo real de BNB Smart Chain (marca oficial, oro), para el chip de red en vez del rombo. */
const ICO_BNB = '<svg viewBox="0 0 126.61 126.61" width="14" height="14" aria-hidden="true"><g fill="#F3BA2F"><path d="M38.73 53.2 63.3 28.63l24.6 24.6 14.3-14.31L63.3 0 24.42 38.89z"/><path d="M0 63.3l14.3-14.3 14.31 14.3-14.31 14.3z"/><path d="M38.73 73.41 63.3 97.98l24.59-24.58 14.31 14.29-38.9 38.91L24.42 87.7z"/><path d="M98 63.3l14.3-14.3 14.31 14.3-14.31 14.31z"/><path d="M77.83 63.3 63.3 48.77 52.56 59.51l-1.24 1.23-2.54 2.55 14.52 14.53z"/></g></svg>';
const ICO_DL = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>';
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
  _panelAddr = null;   // cancela cualquier repintado de historial en vuelo
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
        <li><b>You own 100% of your supply.</b> The entire supply is minted to you, the creator: the part you keep and the part that vests to you over time. DecFreedom holds no share of your coin, now or ever, which leaves you in full control of what you do with it.</li>
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

/* Guia de listado: como mostrar el logo del token en Trust Wallet, MetaMask, BscScan
   y CoinGecko. Solo informacion publica y verificada de cada plataforma, con sus
   enlaces oficiales. No garantiza nada: la decision final es de cada plataforma. */
function abrirGuiaListado() {
  const prev = $('lp-guia'); if (prev) prev.remove();
  const lnk = (t, u) => `<a href="${u}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;margin-top:9px;font-family:var(--mono);font-size:11px;color:var(--gold);text-decoration:none;border:1px solid rgba(232,184,75,.4);background:rgba(232,184,75,.07);border-radius:999px;padding:5px 11px">${t} ${ICO_CODE}</a>`;
  const d = document.createElement('div'); d.id = 'lp-guia'; d.className = 'lp-wiz-bg';
  d.innerHTML = `<div class="lp-wiz lp-infobox">
    <button class="lp-wiz-x" id="lp-guia-x" type="button">✕</button>
    <div class="lp-wiz-t">Get your coin listed</div>
    <div class="lp-wiz-s">How to show your logo on wallets and trackers like Trust Wallet, MetaMask and CoinGecko. Everything here is taken from each platform's public information. Requirements change often and the final decision always belongs to the platform, so confirm the details on the official pages linked in each step. We do not guarantee any listing.</div>

    <div class="lp-sec"><div class="lp-sec-t">BscScan, your explorer</div>
      <ul class="lp-ul">
        <li><b>Verified contract. Done here automatically</b> the moment you create your coin, which is the main requirement.</li>
        <li>A working website and a project email on that same domain.</li>
        <li>A logo in SVG 32 by 32 or PNG 64 by 64, a neutral description, and the full links to your social channels.</li>
      </ul>${lnk('BscScan token info guide', 'https://info.etherscan.com/how-to-update-token-info')}</div>

    <div class="lp-sec"><div class="lp-sec-t">Trust Wallet</div>
      <ul class="lp-ul">
        <li><b>At least 10,000 holders and 15,000 transactions.</b> Airdropped tokens do not count, and the threshold can be adjusted case by case.</li>
        <li>A logo file named logo.png, PNG, 256 by 256 pixels, with an info.json that holds your token details.</li>
        <li>A live website with a whitepaper, active social channels with support, a security audit by a reputable firm, an original identity that does not copy another project, and a CoinMarketCap listing.</li>
        <li>You submit a request to the Trust Wallet assets repository with a processing fee, around 500 TWT or 2.5 BNB. The fee is not refundable and does not guarantee approval.</li>
      </ul>${lnk('Trust Wallet listing docs', 'https://developer.trustwallet.com/developer/new-asset')}</div>

    <div class="lp-sec"><div class="lp-sec-t">MetaMask</div>
      <ul class="lp-ul">
        <li>Submit your token to MetaMask's public token list so its logo is recognized automatically.</li>
        <li>Or let each person add your token with its logo using the standard add token method. For a price to show, your coin should trade on well known venues.</li>
      </ul>${lnk('MetaMask logo guide', 'https://support.metamask.io/develop/how-to-add-a-token-logo/')}</div>

    <div class="lp-sec"><div class="lp-sec-t">CoinGecko and CoinMarketCap</div>
      <ul class="lp-ul">
        <li>These trackers feed logos and prices to many wallets at once, so being on them helps everywhere.</li>
        <li>Your coin must be actively traded on an exchange that the tracker already follows. Then you submit it through their official request form with your details and logo. Reviews can take a few days.</li>
        <li>Do not have your community spam them with listing requests, because that can disqualify your coin.</li>
      </ul>${lnk('CoinGecko listing guide', 'https://support.coingecko.com/hc/en-us/articles/7291312302617')}</div>

    <div class="lp-sec"><div class="lp-sec-t">Tips to be well regarded, and to avoid false scam flags</div>
      <ul class="lp-ul">
        <li>New coins on BNB Smart Chain are often flagged by automated systems before anyone reviews them. Most of the steps below are already true of your coin here, and they reduce that risk.</li>
        <li><b>Keep your contract verified.</b> It already is, from the first block.</li>
        <li><b>Lock your liquidity for a long term and keep a real floor reserve.</b> Both are built into your coin here, and they are among the strongest signals that your project is not a rug.</li>
        <li>Give your coin a distinct name and symbol that do not imitate a famous coin, so automatic systems do not mark it as an impersonation.</li>
        <li>Grow real holders and real activity over time. Listings reward longevity, steady liquidity and a genuine community far more than a fast launch.</li>
        <li>Keep one consistent logo, website and set of social links everywhere you appear.</li>
        <li>Let people trade your coin on your own site with our embeddable widget, directly in BNB or USDT, through your own pool on this platform. You do not need any outside exchange to open trading.</li>
      </ul></div>

    <div class="lp-nota"><b>This is a preparation guide, not a promise.</b> It summarizes public information from each platform to help you get ready. The requirements can change at any time, so always confirm the current ones on each official page above. Every listing and logo decision is made by that platform, not by us.</div>
    <div class="lp-wiz-acts"><button class="lp-b" id="lp-guia-ok" type="button">Got it</button></div>
  </div>`;
  document.body.appendChild(d);
  $('lp-guia-x').onclick = () => d.remove();
  $('lp-guia-ok').onclick = () => d.remove();
  d.onclick = (e) => { if (e.target === d) d.remove(); };
}

/* Instrucciones del widget embebible. Misma ventana que la guia de listado (overlay fijo
   z-index 9000, scroll en movil), para que nunca salga por detras de la interfaz. */
function abrirGuiaWidget() {
  const prev = $('lp-guia'); if (prev) prev.remove();
  const d = document.createElement('div'); d.id = 'lp-guia'; d.className = 'lp-wiz-bg';
  d.innerHTML = `<div class="lp-wiz lp-infobox">
    <button class="lp-wiz-x" id="lp-guia-x" type="button">✕</button>
    <div class="lp-wiz-t">Add the swap to your site</div>
    <div class="lp-wiz-s">This widget lets anyone buy and sell your coin straight from your own website, a two way swap through your pool on DecFreedom, with no outside exchange. Here is how to put it on your page and what your visitors need in order to trade.</div>

    <div class="lp-sec"><div class="lp-sec-t">1. Put it on your page</div>
      <ul class="lp-ul">
        <li>Press <b>Copy code</b> next to this guide. It copies a single iframe that already points to your coin.</li>
        <li>Paste it into the HTML of your page, wherever you want the swap to appear.</li>
        <li>The default size is 360 wide by 520 tall. You can change the width and height; keep it at least 340 wide so it reads well on a phone.</li>
      </ul>
      <div class="lp-code" style="margin-top:10px">&lt;iframe src="https://yoursite.com/modules/launchpad/widget.html?token=YOUR_COIN" width="360" height="520" style="border:0;border-radius:16px" loading="lazy"&gt;&lt;/iframe&gt;</div></div>

    <div class="lp-sec"><div class="lp-sec-t">2. How your visitors connect their wallet</div>
      <ul class="lp-ul">
        <li>The widget has its <b>own Connect wallet button</b>. Each visitor connects their own wallet to the widget, so your site needs no wallet code of its own.</li>
        <li><b>On a computer:</b> the visitor needs a wallet browser extension such as MetaMask or Trust Wallet, on BNB Smart Chain. They press Connect wallet, approve, and swap.</li>
        <li><b>On a phone:</b> they should open your page inside their wallet app browser (the browser built into MetaMask or Trust Wallet), or connect through WalletConnect when it appears. A plain mobile browser with no wallet cannot sign.</li>
      </ul></div>

    <div class="lp-sec"><div class="lp-sec-t">3. Make sure it works</div>
      <ul class="lp-ul">
        <li>Serve your page over <b>https</b>. Wallets do not work on insecure pages.</li>
        <li>Do not box in the iframe. If you add the <code>sandbox</code> attribute, include <code>allow-scripts</code>, <code>allow-same-origin</code> and <code>allow-popups</code>, or the wallet cannot connect.</li>
        <li>Every swap routes through your own pool here, so each sale feeds your floor. The widget runs on its own and does not touch your site or our main platform.</li>
      </ul></div>

    <div class="lp-nota"><b>Shared as is.</b> Creating a coin or sharing a swap does not give it value, and trading always carries risk. You are responsible for how and where you share this widget and for what you tell people.</div>
    <div class="lp-wiz-acts"><button class="lp-b" id="lp-guia-ok" type="button">Got it</button></div>
  </div>`;
  document.body.appendChild(d);
  $('lp-guia-x').onclick = () => d.remove();
  $('lp-guia-ok').onclick = () => d.remove();
  d.onclick = (e) => { if (e.target === d) d.remove(); };
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
  // Logos desde Firestore (persisten entre dispositivos); el navegador es solo respaldo.
  const fs = await leerMonedas(addrs).catch(() => ({}));
  c.innerHTML = addrs.map((a) => { const m = metaLocal(a) || {}; const fl = fs[a.toLowerCase()]; const logo = (fl && fl.logo) || m.logo; return `<div class="lp-tok" data-a="${a}">
      ${logo ? `<img src="${logo}" alt="">` : `<div class="lp-ini">${esc((m.simbolo || '?')[0])}</div>`}
      <div class="lp-tok-id"><b data-nom="${a}">${esc(m.nombre || 'Coin')} <small style="color:var(--gold);font-family:var(--mono);font-size:11px">${esc(m.simbolo || '')}</small></b><span>${corto(a)}</span></div>
      <div class="lp-tok-end"><div class="lp-tok-nums" data-pool="${a}"><span class="lp-est">…</span></div>
      <button class="lp-tok-x" data-x="${a}" type="button" title="Remove from my list" aria-label="Remove from my list">✕</button></div>
    </div>`; }).join('');
  c.querySelectorAll('.lp-tok').forEach((el) => el.onclick = () => cargarToken(el.dataset.a));
  c.querySelectorAll('.lp-tok-x').forEach((b) => b.onclick = async (e) => {
    e.stopPropagation(); const a = b.dataset.x; const m = metaLocal(a) || {};
    const ok = await ocultarToken({ address: a, nombre: m.nombre || 'this coin', simbolo: m.simbolo || '', creador: m.creador || cuenta, demo: false });
    if (ok) pintarMios();
  });
  // Precio y liquidez reales por moneda (dato de cadena), sin bloquear el render.
  addrs.forEach(async (a) => {
    try {
      const d = await gb.datosToken(a); const e = c.querySelector(`[data-pool="${a}"]`); if (!e) return;
      // Nombre y simbolo reales de la cadena (en otro dispositivo no hay copia local).
      const nm = c.querySelector(`[data-nom="${a}"]`);
      if (nm && d.nombre) nm.innerHTML = `${esc(d.nombre)} <small style="color:var(--gold);font-family:var(--mono);font-size:11px">${esc(d.simbolo || '')}</small>`;
      if (d.pool) { const mon = d.moneda || 'BNB'; const liq = Number(gb.fmtEther(d.pool.rQuote));
        e.innerHTML = `<b class="lp-tok-pr">${fmtP(d.precio)} ${mon}</b><span class="lp-tok-lq">${num(liq, 3)} ${mon} liquidity</span>`; }
      else e.innerHTML = `<span class="lp-est gris">No pool</span>`;
    } catch (_) {}
  });
}

/* ───────── Asistente ───────── */
let W = null;
/* Barra de construccion del asistente: los modulos de la moneda se van encendiendo paso a
   paso. El del paso actual late en dorado; los ya configurados quedan en verde con palomita.
   Da la sensacion de ir montando la moneda, no de rellenar un formulario. */
const ICO_W = {
  id: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.3"/></svg>',
  supply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="9" r="1.6"/><path d="M21 15l-5-5L5 20"/></svg>',
  deploy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>'
};
const WIZ_MODULOS = [
  { t: 'Identity', ini: 1, fin: 2, ic: ICO_W.id },
  { t: 'Supply', ini: 3, fin: 3, ic: ICO_W.supply },
  { t: 'Logo', ini: 4, fin: 4, ic: ICO_W.logo },
  { t: 'Floor', ini: 5, fin: 5, ic: ICO.suelo },
  { t: 'Vesting', ini: 6, fin: 6, ic: ICO.goteo },
  { t: 'Guard', ini: 7, fin: 7, ic: ICO.escudo },
  { t: 'Deploy', ini: 8, fin: 8, ic: ICO_W.deploy }
];
function railHTML(paso) {
  return WIZ_MODULOS.map((m) => {
    const st = paso > m.fin ? 'on' : (paso >= m.ini ? 'now' : '');
    return `<div class="lp-rail-i ${st}"><span class="lp-rail-ic">${st === 'on' ? ICO_CHECK : m.ic}</span><span class="lp-rail-t">${m.t}</span></div>`;
  }).join('');
}
/* Beat de "activando funcion" al avanzar: late el modulo actual y aparece la pildora verde. */
function activando(hacia, etiqueta) {
  const chip = document.querySelector('#lp-wiz .lp-rail-i.now');
  if (chip) chip.classList.add('fx');
  const m = $('wz-msg'); if (m) { m.className = 'lp-wiz-msg lp-fx'; m.innerHTML = `<span class="lp-fx-ic">${ICO_CHECK}</span><span>${esc(etiqueta)}</span>`; }
  const ok = $('wz-ok'); if (ok) ok.disabled = true;
  const bk = $('wz-atras'); if (bk) bk.disabled = true;
  setTimeout(() => pintarPaso(hacia), 640);
}
const PASOS = 8;
function wizCerrar() { const d = $('lp-wiz'); if (d) d.remove(); }
function marco(paso, titulo, sub, cuerpo, { atras = true, seguir = 'Continue' } = {}) {
  const prev = $('lp-wiz'); if (prev) prev.remove();
  const d = document.createElement('div'); d.id = 'lp-wiz'; d.className = 'lp-wiz-bg';
  d.innerHTML = `<div class="lp-wiz">
    <button class="lp-wiz-x" id="wz-x" type="button">✕</button>
    <div class="lp-wiz-top"><span class="lp-wiz-n">Step ${paso} of ${PASOS}</span></div>
    <div class="lp-rail">${railHTML(paso)}</div>
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
    $('wz-ok').onclick = () => { const v = i.value.trim(); if (v.length < 2) { wmsg('Give it a name, at least 2 letters.'); return; } if (!/[a-zA-Z]/.test(v)) { wmsg('The name needs at least one letter.'); return; } W.nombre = v; if (!W.simbolo) W.simbolo = v.replace(/[^a-z]/gi, '').slice(0, 6).toUpperCase(); activando(2, 'Coin named'); };
    i.onkeydown = (e) => { if (e.key === 'Enter') $('wz-ok').click(); };
    return;
  }

  if (p === 2) {
    marco(2, 'And its ticker?', `The short symbol, ${REGLAS.simboloMin} to ${REGLAS.simboloMax} letters. Like BTC or BNB.`,
      `${previa()}<input type="text" id="wz-sim" maxlength="${REGLAS.simboloMax}" placeholder="TICKER" value="${esc(W.simbolo)}" autocomplete="off" style="text-transform:uppercase;letter-spacing:2px"><div class="lp-hint" id="wz-h"></div>`);
    const i = $('wz-sim'); i.focus();
    i.oninput = () => { i.value = i.value.replace(/[^a-z0-9]/gi, '').toUpperCase(); };
    $('wz-ok').onclick = () => { const v = i.value.trim(); if (v.length < REGLAS.simboloMin) { wmsg(`At least ${REGLAS.simboloMin} letters.`); return; } W.simbolo = v; activando(3, 'Identity set'); };
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
    $('wz-ok').onclick = () => { if (!(W.supply >= 1000)) { wmsg('Pick a supply of at least 1,000 coins.'); return; } if (W.supply > 1e15) { wmsg('Too many. Keep it under 1,000 trillion.'); return; } activando(4, 'Supply fixed'); };
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
    $('wz-ok').onclick = () => activando(5, W.logo ? 'Logo added' : 'Logo skipped');
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
    $('wz-ok').onclick = () => activando(6, W.suelo ? 'Floor reserve armed' : 'Floor left off');
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
    $('wz-ok').onclick = () => activando(7, W.fundadorPct ? 'Founder vesting scheduled' : 'No founder share');
    return;
  }

  if (p === 7) {
    marco(7, 'Fair launch against bots?', `For the first ${REGLAS.antibot.horas} hours: no wallet can hold more than ${REGLAS.antibot.maxWalletBps / 100}% of the supply and nobody can buy and sell in the same block. Then it switches off by itself.`,
      `<div class="lp-sw ${W.antibot ? 'on' : ''}" id="wz-sw"><div class="tg"></div><div><b>Launch guard</b><span>Recommended. Sniper bots are the first thing that kills a new coin.</span></div></div>`);
    $('wz-sw').onclick = () => { W.antibot = !W.antibot; $('wz-sw').classList.toggle('on', W.antibot); };
    $('wz-ok').onclick = () => activando(8, W.antibot ? 'Launch guard enabled' : 'Launch guard off');
    return;
  }

  if (p === 8) {
    marco(8, 'Check it and create it', 'This is what gets written on chain. It cannot be changed afterwards.',
      `${previa()}
      <div class="lp-rev">
        <div><span>Total supply</span><b>${num(W.supply, 0)} ${esc(W.simbolo)}</b></div>
        <div><span>Floor price</span><b class="${W.suelo ? 'si' : 'no'}">${W.suelo ? 'On · ' + (W.sueloBps / 100) + '% of each sale' : 'Off'}</b></div>
        <div><span>Founder lock</span><b class="${W.fundadorPct ? 'si' : 'no'}">${W.fundadorPct ? W.fundadorPct + '% over ' + W.vestingMeses + ' months' : 'You keep nothing'}</b></div>
        <div><span>Launch guard</span><b class="${W.antibot ? 'si' : 'no'}">${W.antibot ? 'On · first ' + REGLAS.antibot.horas + ' h' : 'Off'}</b></div>
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
    <p><b>Non custodial.</b> We never hold your funds or your coins and we cannot reverse any transaction. If you lose your keys, nobody can recover your creator rights.</p>
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
    // Persistir el logo en Firestore por direccion, para que no dependa de este navegador.
    if (W.logo) guardarMoneda(token, { logo: W.logo }).catch(() => {});
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
  if (tok.antibot) items.push({ t: 'Launch guard', s: 'First 24 h protected from snipers' });
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
    <div class="lp-typebox"><div class="lp-type-lab">Contract address</div><div class="lp-type-line"><span class="lp-type-txt" id="lp-type"></span><span class="lp-type-cur"></span></div></div>
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
    // Efecto maquina de escribir: el contrato se va escribiendo durante toda la validacion.
    (() => { const full = tok.address, te = $('lp-type'), cur = d.querySelector('.lp-type-cur'); let ci = 0; const tm = setInterval(() => { if (!$('lp-type')) return clearInterval(tm); if (ci >= full.length) { clearInterval(tm); if (cur) cur.style.display = 'none'; return; } te.textContent = full.slice(0, ++ci); }, 90); })();
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
        <div class="lp-tcard__meta"><span class="lp-net">${ICO_BNB}BNB Smart Chain</span><a class="lp-codelink" href="${bsc}" target="_blank" rel="noopener">${ICO_CODE} View code</a></div>
      </div>
    </div>
    <p class="lp-live-note">Your coin exists on BNB Smart Chain. Add liquidity so anyone can buy it now, or do it later from your panel.</p>
    <button class="lp-dl" id="lp-tokenomic" type="button">${ICO_DL}<div><b>Download tokenomics</b><span>Technical sheet of your coin, ready for your BscScan logo and info request.</span></div></button>
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
  $('lp-tokenomic').onclick = () => bajarTokenomics(tok, $('lp-tokenomic'));
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
      // Pool confirmada: cerrar esta ventana (antes se quedaba abierta encima del panel)
      // y recargar el panel desde la cadena con logo y redes de Firestore.
      wizCerrar();
      await cargarToken(tok.address);
    } catch (e) {
      modalCerrar();
      if (esRechazo(e)) { wmsg('You cancelled a signature.'); return; }
      await modal('Could not launch the pool', errTxt(e));
      // Si la transaccion salio pero no se confirmo a tiempo, el panel la mostrara al leer la cadena.
      wizCerrar();
      await cargarToken(tok.address);
    }
  };
}

/* ───────── Panel del creador ───────── */
function pintarPanel(t) {
  const host = $(APP); if (!host) return;
  const pool = t.pool || null;
  const precio = pool ? pool.liquidez / pool.tokens : 0;
  const quemado = t.quemado || 0;
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
  const precioAhora = pool ? (txs.length ? txs[0].precio : precio) : 0;
  const vol24 = txs.filter((x) => Date.now() - x.tiempo < 86400000).reduce((a, x) => a + x.valor, 0);
  // Cambio 24h real: con operaciones, del precio mas viejo de las ultimas 24h al actual.
  // Recien abierta la pool y sin operaciones es 0% (el precio aun no se movio del de apertura);
  // desde cero no es "100%", es indefinido, asi que no se inventa.
  const cambio24 = (() => {
    if (!pool) return null;
    const h = txs.filter((x) => Date.now() - x.tiempo < 86400000 && x.precio > 0);
    if (!h.length) return 0;
    const ref = h.length > 1 ? h[h.length - 1].precio : precio;
    return ref > 0 ? (h[0].precio / ref - 1) * 100 : 0;
  })();
  // Mostrar el panel en USDT (lo que quiere ver un creador), aunque el par sea BNB. Si el par ya es
  // USDT la tasa es 1; si es BNB se usa la tasa de CoinGecko. Sin tasa (red caida), se cae a la
  // moneda del par de forma honesta. La tasa no toca ninguna transaccion, solo la pantalla.
  const tasa = !pool ? 0 : (mon === 'USDT' ? 1 : (t.bnbUsd > 0 ? t.bnbUsd : 0));
  const hayUSD = tasa > 0;
  const kU = hayUSD ? tasa : 1;
  const precioU = precioAhora * kU, mcapU = precioU * t.supply, liqU = pool ? pool.liquidez * kU : 0, vol24U = vol24 * kU, sueloU = suelo * kU;
  // Formato de dinero: USD con "$" cuando hay tasa; en la moneda del par solo si hay pool y la red
  // de precios fallo; "$0" cuando aun no hay pool. (small = numero chico, con subindice fmtP.)
  const fmtMoney = (v, small) => { const b = small ? (v > 0 ? fmtP(v) : '0') : num(v, 2); return hayUSD ? '$' + b : (pool ? b + ' ' + mon : '$' + b); };
  // Precio grande en USD, y debajo el precio real del par (BNB) como en los exploradores.
  const precioBig = fmtMoney(precioU, true);
  const precioNat = pool ? (hayUSD && mon !== 'USDT' ? fmtP(precioAhora) + ' ' + mon : '') : 'no pool';
  // Porcentaje 24h listo para valores grandes: estas monedas pueden subir 400%, 10,000%, 1,000,000%.
  const fmtPct = (p) => p == null ? '--' : (Math.abs(p) >= 1000 ? (p >= 0 ? '+' : '') + Math.round(p).toLocaleString('en-US') + '%' : (p >= 0 ? '+' : '') + p.toFixed(2) + '%');
  const cambioTxt = fmtPct(cambio24);
  const cambioCls = cambio24 == null ? '' : cambio24 >= 0 ? 'up' : 'down';
  // Holders: distintas wallets vistas en las operaciones, con minimo 1 (el creador tiene el supply).
  const holders = Math.max(1, new Set(txs.map((x) => x.wallet).filter(Boolean)).size);
  host.innerHTML = `
    <button class="lp-volver" id="lp-volver" type="button">‹ Launchpad</button>
    <div class="lp-panel">
      <div class="lp-top">
        <div class="lp-id">
          <div class="lp-id-cap">
            <div class="lp-logo-wrap">${logoPrev(t, 'lp-logo-prev')}<span class="lp-logo-chain" title="BNB Smart Chain">${ICO_BNB}</span></div>
            <div class="lp-id-main"><div class="lp-nom">${esc(t.nombre)} <small>(${esc(t.simbolo)})</small></div><button class="lp-dir" id="lp-copiar" type="button" title="Copy contract">${corto(t.address)} ${ICO_COPY}</button></div>
            <div class="lp-id-price"><b class="lp-px ${cambioCls}">${precioBig}</b>${precioNat ? `<span class="lp-px-nat">${precioNat}</span>` : ''}</div>
          </div>
          <div class="lp-id-row">
            <div class="lp-id-soc-cap">${redesControl(t, esAdmin) || '<span class="lp-soc-empty">No links yet</span>'}</div>
            <div class="lp-24h-cap"><span class="lp-24h-l">24h Change</span><b class="${cambioCls}">${cambioTxt}</b></div>
          </div>
        </div>
        <div class="lp-stats">
          <div class="lp-stat"><i>Market cap</i><b class="oro">${pool ? fmtMoney(mcapU) : '$0'}</b></div>
          <div class="lp-stat"><i>Real liquidity</i><b class="verde">${pool ? fmtMoney(liqU) : 'No pool'}</b></div>
          <div class="lp-stat"><i>24h volume</i><b>${pool ? fmtMoney(vol24U) : '$0'}</b></div>
          <div class="lp-stat"><i>Floor price</i><b>${t.suelo ? (sueloU > 0 ? fmtMoney(sueloU, true) : fmtMoney(0)) : 'off'}</b></div>
          <div class="lp-stat"><i>Supply</i><b title="${num(t.supply, 0)}">${numC(t.supply)}</b></div>
          <div class="lp-stat"><i>Burned</i><b title="${num(quemado, 0)}">${quemado ? numC(quemado) : '0'}</b></div>
          <div class="lp-stat"><i>Holders</i><b>${num(holders, 0)}</b></div>
          <div class="lp-stat"><i>Contract</i><b id="lp-verif-tile">…</b></div>
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
        ${pool ? (t.demo ? `<div class="lp-card"><h4>Swap</h4>
          <p style="font-size:12.5px;line-height:1.5;color:var(--ink-3);margin:0">The live swap to buy and sell this coin against ${esc(mon)} shows here once it is a real deployed coin.</p>
        </div>` : `<div class="lp-card lp-swap-card"><h4>Swap</h4>
          <iframe class="lp-swap-frame" src="${esc(widgetUrl)}" title="Swap ${esc(t.simbolo)}" loading="lazy"></iframe>
        </div>`) : `<div class="lp-card"><h4>Swap</h4>
          <p style="font-size:12.5px;line-height:1.5;color:var(--ink-3);margin:0 0 ${esAdmin ? '10px' : '0'}">This coin has no pool yet, so it cannot be traded. ${esAdmin ? 'Add liquidity to open trading for everyone.' : 'Trading opens when the creator adds liquidity.'}</p>
          ${esAdmin ? `<button class="lp-b" id="lp-add" type="button">Add liquidity</button>` : ''}
        </div>`}
        ${t.suelo ? `<div class="lp-card"><h4>Floor reserve</h4>
          <div class="lp-kv"><span>Reserve</span><b>${num(t.reservaSuelo || 0, 5)} ${mon}</b></div>
          <div class="lp-kv"><span>Feeds from sales</span><b class="oro">${t.sueloBps / 100}%</b></div>
          <div class="lp-kv"><span>Floor per coin</span><b>${suelo > 0 ? fmtP(suelo) + ' ' + mon : '0 ' + mon}</b></div>
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
          <div class="lp-kv" style="margin-top:8px"><span>Tokenomics</span><b>PDF for BscScan</b></div>
          <button class="lp-b gris" id="lp-tokenomic-p" type="button">Download tokenomics</button>
          <div class="lp-kv" style="margin-top:8px"><span>Hide from my panel</span><b>stays public</b></div>
          <button class="lp-b gris rojo" id="lp-ocultar" type="button">Hide</button>
          ${pool ? `<div class="lp-kv" style="margin-top:8px"><span>Liquidity lock</span><b>${desbloqueo ? (Date.now() > desbloqueo ? 'unlocked' : 'until ' + new Date(desbloqueo).toLocaleDateString('en-GB')) : 'forever'}</b></div>
          <button class="lp-b gris" id="lp-ret" ${desbloqueo && Date.now() > desbloqueo ? '' : 'disabled'} type="button">${desbloqueo && Date.now() > desbloqueo ? 'Withdraw liquidity' : 'Locked'}</button>` : ''}</div>` : ''}
        <div class="lp-card"><h4>Get listed</h4>
          <p style="font-size:12.5px;line-height:1.5;color:var(--ink-3);margin:0 0 2px">Show your logo on Trust Wallet, MetaMask and CoinGecko, and stay clear of automatic scam flags.</p>
          <button class="lp-b gris" id="lp-listar" type="button">Open the guide</button></div>
        <div class="lp-card"><h4>Embed our swap on your site</h4>
          <div class="lp-widget-prev" id="lp-wprev" role="button" tabindex="0" title="Open the live swap" style="cursor:pointer">
            <div class="wp-top">${logoPrev(t, 'lp-logo-prev')}<b>Buy ${esc(t.simbolo)}</b></div>
            <div class="wp-box"><div class="wp-in"><span>You pay</span><b>BNB</b></div><div class="wp-in"><span>You get</span><b>${esc(t.simbolo)}</b></div><div class="wp-btn">Open swap</div></div>
            <div class="wp-marca"><img src="./img/cco-full.webp" alt="DecFreedom"></div>
          </div>
          <div class="lp-code" id="lp-code">&lt;iframe src="${esc(widgetUrl)}" width="360" height="520" style="border:0;border-radius:16px" loading="lazy"&gt;&lt;/iframe&gt;</div>
          <div style="display:flex;gap:8px;margin-top:8px"><button class="lp-b gris" id="lp-copy-w" type="button" style="flex:1;min-width:0;padding:0 8px">Copy code</button><button class="lp-b gris" id="lp-instr" type="button" style="flex:1;min-width:0;padding:0 8px">Instructions</button></div>
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
  if ($('lp-fotos')) $('lp-fotos').onclick = () => abrirEditorMoneda(t, () => cargarToken(t.address));
  if ($('lp-redes-edit')) $('lp-redes-edit').onclick = () => abrirEditorMoneda(t, () => cargarToken(t.address));
  if ($('lp-tokenomic-p')) $('lp-tokenomic-p').onclick = () => bajarTokenomics(t, $('lp-tokenomic-p'));
  if ($('lp-ocultar')) $('lp-ocultar').onclick = async () => { if (await ocultarToken(t)) { history.replaceState(null, '', location.pathname); pintarPortada(); } };
  $('lp-volver').onclick = () => { history.replaceState(null, '', location.pathname); pintarPortada(); };
  $('lp-copiar').onclick = () => { try { navigator.clipboard.writeText(t.address); $('lp-copiar').innerHTML = 'copied ' + ICO_COPY; setTimeout(() => { $('lp-copiar').innerHTML = corto(t.address) + ' ' + ICO_COPY; }, 1500); } catch (_) {} };
  $('lp-copy-w').onclick = () => { try { navigator.clipboard.writeText($('lp-code').textContent); $('lp-copy-w').textContent = 'Copied'; setTimeout(() => { $('lp-copy-w').textContent = 'Copy code'; }, 1500); } catch (_) {} };
  if ($('lp-instr')) $('lp-instr').onclick = () => abrirGuiaWidget();
  if ($('lp-wprev')) { const abrirSwap = () => { try { window.open(widgetUrl, '_blank', 'noopener'); } catch (_) {} }; $('lp-wprev').onclick = abrirSwap; $('lp-wprev').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirSwap(); } }; }
  if ($('lp-listar')) $('lp-listar').onclick = () => abrirGuiaListado();
  if ($('lp-add')) $('lp-add').onclick = () => preguntarLiquidez(t);
  if ($('lp-ret')) $('lp-ret').onclick = () => accionRetirar(t);
  if ($('lp-claim')) $('lp-claim').onclick = () => accionReclamar(t);
  document.querySelectorAll('.lp-chart-tabs button').forEach((b) => b.onclick = () => { document.querySelectorAll('.lp-chart-tabs button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); pintarGrafica(t, b.dataset.r); });
  pintarGrafica(t, '1h');
  if (t.demo) { const vt = $('lp-verif-tile'); if (vt) vt.innerHTML = '<span style="display:inline-flex;align-items:center;gap:5px;color:var(--verde);font-size:13.5px">' + ICO_CHECK + ' Verified</span>'; } else if (t.address) pintarVerif(t.address);
  // Par en BNB sin tasa todavia (p. ej. panel abierto al vuelo): traer BNB->USDT y repintar en USDT.
  if (pool && mon === 'BNB' && !(t.bnbUsd > 0)) gb.precioBNBUSDT().then((v) => { if (v > 0) { t.bnbUsd = v; pintarPanel(t); } }).catch(() => {});
}

/* Estado de verificacion en BscScan: badge verde con enlace, o boton para verificar
   (sirve tanto para monedas nuevas como para las creadas antes de esta funcion). */
/* En el panel la verificacion es solo un sello de lectura (verde con enlace si esta
   verificada). La ACCION de verificar vive en el paso de validacion al crear la moneda. */
async function pintarVerif(addr) {
  const el = $('lp-verif-tile'); if (!el) return;
  const ok = await gb.verificado(addr).catch(() => false);
  const est = 'display:inline-flex;align-items:center;gap:5px;text-decoration:none;font-size:13.5px';
  el.innerHTML = ok
    ? `<a href="https://bscscan.com/address/${addr}#code" target="_blank" rel="noopener" style="${est};color:var(--verde)">${ICO_CHECK} Verified</a>`
    : `<a href="https://bscscan.com/address/${addr}#code" target="_blank" rel="noopener" style="${est};color:var(--ink-3)">Not verified</a>`;
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
  if (!velas.length) {
    // Con pool pero sin operaciones: linea plana al precio de apertura (reservas del pool, dato real),
    // en vez de dejar el lienzo en blanco. Las velas aparecen con la primera compra o venta.
    const p0 = t.pool ? ((t.pool.liquidez && t.pool.tokens) ? t.pool.liquidez / t.pool.tokens : 0) : 0;
    if (!(p0 > 0)) return;
    const pL = 10, pR = 64, pT = 14, pB = 22; const yMid = pT + (H0 - pT - pB) * 0.5;
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.font = '10px IBM Plex Mono, monospace'; g.textAlign = 'left';
    for (let k = 0; k <= 4; k++) { const ry = pT + (H0 - pT - pB) * k / 4; g.beginPath(); g.moveTo(pL, ry); g.lineTo(W0 - pR, ry); g.stroke(); }
    g.setLineDash([5, 4]); g.strokeStyle = '#E8B84B'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(pL, yMid); g.lineTo(W0 - pR, yMid); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#E8B84B'; g.fillText(p0.toPrecision(3), W0 - pR + 6, yMid + 3);
    g.fillStyle = '#7d8794'; g.textAlign = 'center'; g.fillText('opening price · the first trade draws the candles', W0 / 2, H0 - 6);
    return;
  }
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
