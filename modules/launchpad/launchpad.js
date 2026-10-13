/* launchpad/launchpad.js. Interfaz del Launchpad (fase 1: solo front).
   Portada, asistente de una pregunta por pantalla (como el P2P), panel del creador,
   generador del widget y el robotito Lounge. Las firmas al contrato se enchufan en la
   fase de contrato: mientras LAUNCHPAD sea 0x0, el boton final avisa "pending". */

import * as wallet from './wallet.js';
import { LAUNCHPAD, LIQUIDEZ, REGLAS, PRESETS_SUPPLY, LOGO_MAX_PX } from './config.js';
import { montarLounge, loungeModo } from './lounge.js';

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

/* ───────── Tokens del usuario (fase 1: lo que este navegador creo; fase 2: el contrato) ───────── */
function misTokens() {
  try { return JSON.parse(localStorage.getItem('lp-tokens') || '[]'); } catch (_) { return []; }
}
function guardarTokens(l) { try { localStorage.setItem('lp-tokens', JSON.stringify(l)); } catch (_) {} }

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
function hace(ms) { const s = Math.max(0, Math.floor((Date.now() - ms) / 1000)); if (s < 60) return s + 's ago'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; return Math.floor(s / 86400) + 'd ago'; }

/* ───────── Arranque ───────── */
export function arrancar() {
  montarLounge();
  const q = new URLSearchParams(location.search);
  if (q.get('demo') === '1') { pintarPanel(tokenDemo()); return; }
  const ver = q.get('token');
  if (ver) { const t = misTokens().find((x) => x.address.toLowerCase() === ver.toLowerCase()); if (t) { pintarPanel(t); return; } }
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
  loungeModo('grande');
  const host = $(APP); if (!host) return;
  const mios = misTokens();
  host.innerHTML = `
    <section class="lp-hero">
      <span class="lp-kicker">Launchpad</span>
      <h1 class="lp-h1">Create your own coin.<br><b>Backed by contract, not by promises.</b></h1>
      <p class="lp-sub">A few simple questions and your token is live on BNB Smart Chain, with a guaranteed floor price, locked liquidity and a founder lock everyone can verify. Creating it is free: you only pay the network gas.</p>
      <div class="lp-cta">
        <button class="lp-b" id="lp-crear">Create my coin</button>
        <button class="lp-b gris" id="lp-ver-mios">My coins${mios.length ? ' (' + mios.length + ')' : ''}</button>
      </div>
      <div class="lp-poderes">
        <div class="lp-poder"><div class="ic">${ICO.suelo}</div><b>Guaranteed floor price</b><span>Part of every sale goes into a BNB reserve inside the coin. Any holder can redeem at the floor, always. It can never be worth zero.</span></div>
        <div class="lp-poder"><div class="ic">${ICO.candado}</div><b>Rug-proof liquidity</b><span>The liquidity you add stays locked in our contract for the time you choose. You never hold the keys to the pool, and everyone can see it.</span></div>
        <div class="lp-poder"><div class="ic">${ICO.goteo}</div><b>Founder lock</b><span>Your share of the supply is released drop by drop, on chain. Buyers know you cannot dump on them.</span></div>
        <div class="lp-poder"><div class="ic">${ICO.escudo}</div><b>Fair launch</b><span>Anti-bot rules for the first hours: wallet limit and no buy plus sell in the same block. They switch off by themselves.</span></div>
      </div>
      <div class="lp-como">
        <div><i>1 · ANSWER</i>Name, ticker, supply, logo. Then switch on the powers you want. Two minutes.</div>
        <div><i>2 · SIGN</i>One signature creates the coin. Add liquidity in BNB or USDT if you want it tradable right away.</div>
        <div><i>3 · GROW</i>It appears in the DecFreedom Swap by name, ticker or contract. Embed our swap on your site with one line.</div>
      </div>
      <div class="lp-nota"><b>Every coin created here pays a 0.02% fee on each sale to the DecFreedom ecosystem</b> (half to staking, half to the platform). That is how the launchpad stays free. Creating a coin does not make it valuable: its price depends only on what people pay for it. We never custody your funds and we cannot reverse a transaction.</div>
    </section>
    <section class="lp-mios" id="lp-mios" style="display:none">
      <h3>My coins</h3>
      <div id="lp-mios-lista"></div>
    </section>`;
  $('lp-crear').onclick = () => abrirAsistente();
  $('lp-ver-mios').onclick = () => { pintarMios(); const s = $('lp-mios'); s.style.display = ''; s.scrollIntoView({ behavior: 'smooth' }); };
  if (mios.length) { pintarMios(); $('lp-mios').style.display = ''; }
}
function pintarMios() {
  const l = misTokens(); const c = $('lp-mios-lista'); if (!c) return;
  if (!l.length) { c.innerHTML = `<div class="lp-vacio">You have not created any coin yet.</div>`; return; }
  c.innerHTML = l.map((t) => `<div class="lp-tok" data-a="${t.address}">
      ${t.logo ? `<img src="${t.logo}" alt="">` : `<div class="lp-ini">${esc((t.simbolo || '?')[0])}</div>`}
      <div><b>${esc(t.nombre)} <small style="color:var(--gold);font-family:var(--mono);font-size:11px">${esc(t.simbolo)}</small></b><span>${corto(t.address)}</span></div>
      <span class="lp-est ${t.pool ? '' : 'gris'}">${t.pool ? 'Tradable' : 'No pool yet'}</span>
    </div>`).join('');
  c.querySelectorAll('.lp-tok').forEach((el) => el.onclick = () => { const t = l.find((x) => x.address === el.dataset.a); if (t) pintarPanel(t); });
}

/* ───────── Asistente ───────── */
let W = null;
const PASOS = 8;
function wizCerrar() { const d = $('lp-wiz'); if (d) d.remove(); loungeModo('rincon'); }
function marco(paso, titulo, sub, cuerpo, { atras = true, seguir = 'Continue' } = {}) {
  const prev = $('lp-wiz'); if (prev) prev.remove();
  loungeModo('junto');
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
      `<input type="text" id="wz-nombre" maxlength="${REGLAS.nombreMax}" placeholder="Pepito Coin" value="${esc(W.nombre)}" autocomplete="off"><div class="lp-hint" id="wz-h"></div>`, { atras: false });
    const i = $('wz-nombre'); i.focus();
    i.oninput = () => { const h = $('wz-h'); h.textContent = i.value.length ? `${i.value.length} / ${REGLAS.nombreMax}` : ''; };
    $('wz-ok').onclick = () => { const v = i.value.trim(); if (v.length < 2) { wmsg('Give it a name, at least 2 letters.'); return; } W.nombre = v; if (!W.simbolo) W.simbolo = v.replace(/[^a-z]/gi, '').slice(0, 6).toUpperCase(); pintarPaso(2); };
    i.onkeydown = (e) => { if (e.key === 'Enter') $('wz-ok').click(); };
    return;
  }

  if (p === 2) {
    marco(2, 'And its ticker?', `The short symbol, ${REGLAS.simboloMin} to ${REGLAS.simboloMax} letters. Like BTC or BNB.`,
      `${previa()}<input type="text" id="wz-sim" maxlength="${REGLAS.simboloMax}" placeholder="PEPITO" value="${esc(W.simbolo)}" autocomplete="off" style="text-transform:uppercase;letter-spacing:2px"><div class="lp-hint" id="wz-h"></div>`);
    const i = $('wz-sim'); i.focus();
    i.oninput = () => { i.value = i.value.replace(/[^a-z0-9]/gi, '').toUpperCase(); };
    $('wz-ok').onclick = () => { const v = i.value.trim(); if (v.length < REGLAS.simboloMin) { wmsg(`At least ${REGLAS.simboloMin} letters.`); return; } W.simbolo = v; pintarPaso(3); };
    i.onkeydown = (e) => { if (e.key === 'Enter') $('wz-ok').click(); };
    return;
  }

  if (p === 3) {
    marco(3, 'How many coins will exist?', 'The total supply. It is fixed forever: nobody, not even you, can mint more.',
      `${previa()}<div class="lp-ops" id="wz-pre">${PRESETS_SUPPLY.map((x) => `<button type="button" class="lp-op ${W.supply === x.v ? 'on' : ''}" data-v="${x.v}"><b>${x.t}</b><span>${num(x.v, 0)}</span></button>`).join('')}</div>
      <div class="lp-sub-op"><div class="lp-lab">or type your own</div><input type="text" inputmode="numeric" id="wz-sup" placeholder="21000000" value="${W.supply && !PRESETS_SUPPLY.some((x) => x.v === W.supply) ? W.supply : ''}" autocomplete="off"><div class="lp-hint" id="wz-h"></div></div>`);
    const i = $('wz-sup');
    document.querySelectorAll('#wz-pre .lp-op').forEach((b) => b.onclick = () => { document.querySelectorAll('#wz-pre .lp-op').forEach((x) => x.classList.remove('on')); b.classList.add('on'); W.supply = Number(b.dataset.v); i.value = ''; });
    i.oninput = () => { i.value = i.value.replace(/[^0-9]/g, ''); document.querySelectorAll('#wz-pre .lp-op').forEach((x) => x.classList.remove('on')); W.supply = Number(i.value) || 0; $('wz-h').textContent = W.supply ? num(W.supply, 0) + ' ' + W.simbolo : ''; };
    $('wz-ok').onclick = () => { if (!(W.supply >= 1000)) { wmsg('Pick a supply of at least 1,000 coins.'); return; } if (W.supply > 1e15) { wmsg('Too many. Keep it under 1,000 trillion.'); return; } pintarPaso(4); };
    return;
  }

  if (p === 4) {
    marco(4, 'Give it a face', 'A square logo looks best. We shrink it to 128 px, same as List your token, so it loads fast everywhere.',
      `<label class="lp-logo-drop" for="wz-file">${logoPrev(W, 'lp-logo-prev')}<div><b>${W.logo ? 'Change logo' : 'Upload a logo'}</b><span>PNG, JPG or WEBP. You can skip this and add it later from your panel.</span></div></label>
      <input type="file" id="wz-file" accept="image/*" style="display:none"><div class="lp-hint" id="wz-h"></div>`, { seguir: W.logo ? 'Continue' : 'Continue without logo' });
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
        <div><span>Ecosystem fee</span><b>0.02% on sales</b></div>
        <div><span>Cost</span><b class="si">Free · gas only</b></div>
      </div>
      ${disclaimer()}
      <label class="lp-ok"><input type="checkbox" id="wz-acepto"> I have read this and I accept it</label>`, { seguir: 'Create my coin' });
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
    <p><b>Fees.</b> Creating is free; you pay the network gas. Every sale of the coin pays 0.02% to the DecFreedom ecosystem and the DEX swap fee. If a transaction reverts, nothing is charged except gas.</p>
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
    await modal('Contract pending', 'The launchpad contract is not deployed yet. Your configuration is complete and this is exactly what it will create when it goes live.<br><br>The interface is ready; the on-chain part comes in the next phase.');
    pintarPortada();
    return;
  }
  // Fase 2: firma crearToken(...) en LAUNCHPAD, espera el evento, guarda address y pasa a la liquidez.
}

/* ───────── Liquidez (se ofrece justo despues de crear) ───────── */
function preguntarLiquidez(tok) {
  const prev = $('lp-wiz'); if (prev) prev.remove();
  loungeModo('junto');
  const d = document.createElement('div'); d.id = 'lp-wiz'; d.className = 'lp-wiz-bg';
  d.innerHTML = `<div class="lp-wiz">
    <div class="lp-done">${logoPrev(tok, 'lp-logo-prev')}<h4>${esc(tok.nombre)} is live</h4><p>Your coin exists on BNB Smart Chain. Do you want people to be able to buy it right now?</p>
    <button class="lp-dir" id="lp-copiar" type="button">${corto(tok.address)} ${ICO_COPY}</button></div>
    <div class="lp-wiz-b" style="margin-top:18px">
      <div class="lp-lab" style="font-family:var(--mono);font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--ink-3);margin:0 0 7px">Coins you put in the pool</div>
      <input type="text" inputmode="numeric" id="lq-tok" placeholder="${num(tok.supply / 2, 0)}" autocomplete="off">
      <div class="lp-lab" style="font-family:var(--mono);font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--ink-3);margin:12px 0 7px">Liquidity you add</div>
      <div class="lp-liq-row"><input type="text" inputmode="decimal" id="lq-cant" placeholder="0.00" autocomplete="off"><select id="lq-mon">${LIQUIDEZ.map((m) => `<option value="${m.id}">${m.simbolo}</option>`).join('')}</select></div>
      <div class="lp-lab" style="font-family:var(--mono);font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--ink-3);margin:12px 0 7px">Locked for</div>
      <div class="lp-ops cuatro" id="lq-cand">${REGLAS.candadoMeses.map((v, i) => `<button type="button" class="lp-op ${i === 1 ? 'on' : ''}" data-v="${v}"><b>${v === 0 ? 'Forever' : v + ' mo'}</b><span>${v === 0 ? 'max trust' : v >= 12 ? 'trusted' : 'minimum'}</span></button>`).join('')}</div>
      <div class="lp-ratio" id="lq-ratio">Starting price appears here when you fill both amounts.</div>
    </div>
    <div class="lp-wiz-acts"><button class="lp-b gris" id="lq-no" type="button">Later</button><button class="lp-b" id="lq-si" type="button">Launch the pool</button></div>
    <div class="lp-wiz-msg" id="wz-msg"></div>
  </div>`;
  document.body.appendChild(d);
  let cand = 12;
  const ratio = () => {
    const t = Number($('lq-tok').value.replace(/[^0-9.]/g, '')) || 0, c = Number($('lq-cant').value.replace(/[^0-9.]/g, '')) || 0, m = $('lq-mon').value;
    const r = $('lq-ratio');
    if (!(t > 0 && c > 0)) { r.innerHTML = 'Starting price appears here when you fill both amounts.'; return; }
    r.innerHTML = `Starting price: <b>1 ${esc(tok.simbolo)} = ${(c / t).toPrecision(4)} ${m}</b> · locked ${cand === 0 ? 'forever' : cand + ' months'}. You never hold the LP: the contract does.`;
  };
  ['lq-tok', 'lq-cant'].forEach((id) => $(id).oninput = ratio); $('lq-mon').onchange = ratio;
  document.querySelectorAll('#lq-cand .lp-op').forEach((b) => b.onclick = () => { document.querySelectorAll('#lq-cand .lp-op').forEach((x) => x.classList.remove('on')); b.classList.add('on'); cand = Number(b.dataset.v); ratio(); });
  $('lp-copiar').onclick = () => { try { navigator.clipboard.writeText(tok.address); $('lp-copiar').innerHTML = 'copied ' + ICO_COPY; } catch (_) {} };
  $('lq-no').onclick = () => { wizCerrar(); pintarPanel(tok); };
  $('lq-si').onclick = () => { wmsg('Pool creation is wired in the contract phase.'); };
}

/* ───────── Panel del creador ───────── */
function pintarPanel(t) {
  loungeModo('rincon');
  const host = $(APP); if (!host) return;
  const pool = t.pool || null;
  const precio = pool ? pool.liquidez / pool.tokens : 0;
  const mcap = pool ? precio * t.supply : 0;
  const quemado = t.quemado || 0, holders = t.holders || (pool ? 1 : 1);
  const suelo = t.suelo ? (t.reservaSuelo || 0) / Math.max(1, t.supply - quemado) : 0;
  const mon = pool ? pool.moneda : 'BNB';
  const desbloqueo = pool ? (pool.candadoMeses === 0 ? null : pool.creadoEn + pool.candadoMeses * 30 * 86400000) : null;
  const vestFin = t.creadoEn + (t.vestingMeses || 0) * 30 * 86400000;
  const vestPct = t.fundadorPct ? Math.min(100, Math.max(0, (Date.now() - t.creadoEn) / (vestFin - t.creadoEn) * 100)) : 0;
  const fundadorTot = t.supply * (t.fundadorPct || 0) / 100;
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
        <div class="lp-id">${logoPrev(t, 'lp-logo-prev')}<div><div class="lp-nom">${esc(t.nombre)}<small>${esc(t.simbolo)}</small></div><button class="lp-dir" id="lp-copiar" type="button" title="Copy contract">${corto(t.address)} ${ICO_COPY}</button></div></div>
        <div class="lp-precio"><b>${precioTxt}</b><span class="${cambio24 == null ? '' : cambio24 >= 0 ? 'up' : 'down'}">${cambio24 == null ? '24h · no data yet' : (cambio24 >= 0 ? '+' : '') + cambio24.toFixed(2) + '% · 24h'}</span></div>
        <div class="lp-stats">
          <div class="lp-stat"><i>Supply</i><b>${num(t.supply, 0)}</b></div>
          <div class="lp-stat"><i>Burned</i><b>${quemado ? num(quemado, 0) : '0'}</b></div>
          <div class="lp-stat"><i>Holders</i><b>${num(holders, 0)}</b></div>
          <div class="lp-stat"><i>Market cap</i><b class="oro">${pool ? num(mcap, 4) + ' ' + mon : '...'}</b></div>
          <div class="lp-stat"><i>Real liquidity</i><b class="verde">${pool ? num(pool.liquidez, 4) + ' ' + mon : 'No pool'}</b></div>
          <div class="lp-stat"><i>24h volume</i><b>${pool ? num(vol24, 4) + ' ' + mon : '...'}</b></div>
          <div class="lp-stat"><i>Floor price</i><b>${t.suelo ? (suelo > 0 ? suelo.toPrecision(3) + ' BNB' : 'building') : 'off'}</b></div>
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
          ${esAdmin ? (pool ? `<button class="lp-b gris" id="lp-ret" ${desbloqueo && Date.now() > desbloqueo ? '' : 'disabled'} type="button">${desbloqueo && Date.now() > desbloqueo ? 'Withdraw liquidity' : 'Withdraw (locked)'}</button>` : `<button class="lp-b" id="lp-add" type="button">Add liquidity</button>`) : ''}
        </div>
        ${t.suelo ? `<div class="lp-card"><h4>Floor reserve</h4>
          <div class="lp-kv"><span>Reserve</span><b>${num(t.reservaSuelo || 0, 5)} BNB</b></div>
          <div class="lp-kv"><span>Feeds from sales</span><b class="oro">${t.sueloBps / 100}%</b></div>
          <div class="lp-kv"><span>Floor per coin</span><b>${suelo > 0 ? suelo.toPrecision(3) + ' BNB' : 'building'}</b></div>
          <button class="lp-b gris" id="lp-redeem" type="button" ${suelo > 0 ? '' : 'disabled'}>Redeem at floor</button></div>` : ''}
        ${t.fundadorPct ? `<div class="lp-card"><h4>Founder lock</h4>
          <div class="lp-kv"><span>Founder share</span><b>${num(fundadorTot, 0)} ${esc(t.simbolo)}</b></div>
          <div class="lp-bar"><i style="width:${vestPct.toFixed(1)}%"></i></div>
          <div class="lp-kv"><span>Released</span><b class="oro">${vestPct.toFixed(1)}%</b></div>
          <div class="lp-kv"><span>Fully released</span><b>${new Date(vestFin).toLocaleDateString('en-GB')}</b></div>
          ${esAdmin ? `<button class="lp-b gris" id="lp-claim" type="button" ${vestPct > 0 ? '' : 'disabled'}>Claim released coins</button>` : ''}</div>` : ''}
        ${esAdmin ? `<div class="lp-card"><h4>Creator tools</h4>
          <div class="lp-kv"><span>Burn coins</span><b>from your wallet</b></div>
          <button class="lp-b gris" id="lp-burn" type="button">Burn</button>
          <div class="lp-kv" style="margin-top:8px"><span>Photos and links</span><b>public page</b></div>
          <button class="lp-b gris" id="lp-fotos" type="button">Edit profile</button></div>` : ''}
        <div class="lp-card"><h4>Embed our swap on your site</h4>
          <div class="lp-widget-prev">
            <div class="wp-top">${logoPrev(t, 'lp-logo-prev')}<b>Buy ${esc(t.simbolo)}</b></div>
            <div class="wp-box"><div class="wp-in"><span>You pay</span><b>BNB</b></div><div class="wp-in"><span>You get</span><b>${esc(t.simbolo)}</b></div><div class="wp-btn">Swap</div></div>
            <div class="wp-marca"><img src="./img/cco-full.webp" alt="DecFreedom"> POWERED BY DECFREEDOM</div>
          </div>
          <div class="lp-code" id="lp-code">&lt;iframe src="${esc(widgetUrl)}" width="360" height="520" style="border:0;border-radius:16px" loading="lazy"&gt;&lt;/iframe&gt;</div>
          <button class="lp-b gris" id="lp-copy-w" type="button">Copy embed code</button>
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
  if ($('lp-redeem')) $('lp-redeem').onclick = () => modal('Contract pending', 'Redeeming at the floor is signed against the coin contract in the next phase.');
  if ($('lp-burn')) $('lp-burn').onclick = () => modal('Contract pending', 'Burning is signed against the coin contract in the next phase.');
  if ($('lp-fotos')) $('lp-fotos').onclick = () => modal('Coming with the contract', 'Photos and links use the same storage as List your token. It is wired in the next phase.');
  $('lp-volver').onclick = () => { history.replaceState(null, '', location.pathname); pintarPortada(); };
  $('lp-copiar').onclick = () => { try { navigator.clipboard.writeText(t.address); $('lp-copiar').innerHTML = 'copied ' + ICO_COPY; setTimeout(() => { $('lp-copiar').innerHTML = corto(t.address) + ' ' + ICO_COPY; }, 1500); } catch (_) {} };
  $('lp-copy-w').onclick = () => { try { navigator.clipboard.writeText($('lp-code').textContent); $('lp-copy-w').textContent = 'Copied'; setTimeout(() => { $('lp-copy-w').textContent = 'Copy embed code'; }, 1500); } catch (_) {} };
  if ($('lp-add')) $('lp-add').onclick = () => preguntarLiquidez(t);
  if ($('lp-ret')) $('lp-ret').onclick = () => modal('Contract pending', 'Withdrawals are signed against the launchpad contract in the next phase.');
  if ($('lp-claim')) $('lp-claim').onclick = () => modal('Contract pending', 'Claims are signed against the launchpad contract in the next phase.');
  document.querySelectorAll('.lp-chart-tabs button').forEach((b) => b.onclick = () => { document.querySelectorAll('.lp-chart-tabs button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); pintarGrafica(t, b.dataset.r); });
  pintarGrafica(t, '1h');
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
function pintarGrafica(t, rango) {
  const cv = $('lp-cv'); if (!cv) return;
  const velas = velasDemo(t, rango);
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
