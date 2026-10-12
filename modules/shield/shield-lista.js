/* shield-lista.js: Lista negra comunitaria (herramienta 8 de Wallet Shield).
   Escanea una wallet (BSC o Tron) contra tres fuentes y muestra un veredicto:
     1. Nuestra lista en cadena (contrato WalletShield v2): reportes de suscriptores y vetos de owner.
     2. Nuestras direcciones oficiales (contratos y owners): siempre seguras y NO reportables.
     3. GoPlus Security (API publica, sin clave): etiquetas de phishing, robo, lavado, honeypot, etc.
   Y permite reportar una wallet (una firma, gratis para suscriptores; una vez por wallet y direccion).
   Independiente: solo importa archivos de esta carpeta. */
import * as pago from './shield-pago.js';
import { NUESTROS } from './shield-datos.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

const IC_LISTA = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 9l6 6M15 9l-6 6"/></svg>';

let _css = false;
export function css() {
  if (_css) return; _css = true;
  const st = document.createElement('style'); st.id = 'shd-lista-css';
  st.textContent = `
  #shd .shd-card-lista{border-color:rgba(246,70,93,.22)}
  #shd .shd-card-lista .shd-card-ic{background:rgba(246,70,93,.1);color:#f6465d}
  #shd .shd-card-btn.lista{border-color:rgba(246,70,93,.4);background:rgba(246,70,93,.08);color:#f6465d}
  #shd .shd-card-btn.lista:hover{background:rgba(246,70,93,.16)}
  #shd .shd-lista-wrap{max-width:560px;margin:0 auto;padding:10px 0}
  #shd .shd-lista-hero{text-align:center}
  #shd .shd-lista-icon{width:56px;height:56px;border-radius:50%;background:rgba(246,70,93,.1);color:#f6465d;display:grid;place-items:center;margin:0 auto 14px}
  #shd .shd-lista-hero h1{font-size:22px;font-weight:800;margin:0 0 10px}
  #shd .shd-lista-hero p{font-size:13px;color:#a7b0bb;line-height:1.6;margin:0 0 18px;text-align:left}
  #shd .shd-lista-tabs{display:flex;gap:8px;margin:0 0 14px}
  #shd .shd-lista-tab{flex:1;padding:10px;border-radius:10px;border:1px solid #1c232b;background:rgba(14,19,25,.7);color:#a7b0bb;font-family:inherit;font-weight:700;font-size:12.5px;cursor:pointer}
  #shd .shd-lista-tab.on{border-color:var(--gold,#E8B84B);color:var(--gold,#E8B84B);background:rgba(232,184,75,.08)}
  #shd .shd-lista-scan{text-align:center;padding:26px 10px}
  #shd .shd-lista-steps{list-style:none;margin:16px auto 0;padding:0;max-width:340px;text-align:left}
  #shd .shd-lista-steps li{font-size:12.5px;color:#64707c;padding:6px 0;display:flex;gap:10px;align-items:center;opacity:.45;transition:opacity .3s,color .3s}
  #shd .shd-lista-steps li.on{opacity:1;color:#eaecef}
  #shd .shd-lista-steps li.ok{opacity:1;color:#2ebd85}
  #shd .shd-lista-steps li i{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}
  #shd .shd-lista-steps li.on i{animation:shdBlip 1s ease-in-out infinite}
  #shd .shd-lista-ver{margin-top:16px;border-radius:16px;padding:22px 20px;text-align:center;border:1px solid #1c232b;background:linear-gradient(135deg,rgba(20,26,33,.9),rgba(10,14,18,.9))}
  #shd .shd-lista-ver.ok{border-color:rgba(46,189,133,.4);box-shadow:0 0 40px rgba(46,189,133,.12)}
  #shd .shd-lista-ver.bad{border-color:rgba(246,70,93,.5);box-shadow:0 0 40px rgba(246,70,93,.18)}
  #shd .shd-lista-ver.warn{border-color:rgba(232,184,75,.45);box-shadow:0 0 40px rgba(232,184,75,.12)}
  #shd .shd-lista-ver.ours{border-color:rgba(232,184,75,.6)}
  #shd .shd-lista-vt{font-size:21px;font-weight:900;margin:8px 0 6px}
  #shd .shd-lista-ver.ok .shd-lista-vt{color:#2ebd85} #shd .shd-lista-ver.bad .shd-lista-vt{color:#f6465d} #shd .shd-lista-ver.warn .shd-lista-vt{color:var(--gold,#E8B84B)} #shd .shd-lista-ver.ours .shd-lista-vt{color:var(--gold,#E8B84B)}
  #shd .shd-lista-vs{font-size:12.5px;color:#a7b0bb;line-height:1.6}
  #shd .shd-lista-addr{font-family:var(--mono,monospace);font-size:11.5px;color:#79838f;word-break:break-all;margin-top:10px}
  #shd .shd-lista-src{margin-top:14px;display:flex;flex-direction:column;gap:7px;text-align:left}
  #shd .shd-lista-row{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12.5px;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid #1c232b}
  #shd .shd-lista-row b{color:#eaecef;font-weight:700}
  #shd .shd-lista-row .v{color:#a7b0bb;text-align:right}
  #shd .shd-lista-row .v.bad{color:#f6465d;font-weight:700} #shd .shd-lista-row .v.ok{color:#2ebd85} #shd .shd-lista-row .v.warn{color:var(--gold,#E8B84B)}
  #shd .shd-lista-tags{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:10px}
  #shd .shd-lista-tag{font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px;background:rgba(246,70,93,.12);color:#f6465d;border:1px solid rgba(246,70,93,.3)}
  #shd .shd-lista-rep{margin-top:14px;font-size:12px;color:#79838f;line-height:1.55}
  #shd .shd-lista-note{font-size:11.5px;color:#64707c;line-height:1.55;margin-top:14px;text-align:left}
  `;
  document.head.appendChild(st);
}

/* GoPlus Security: API publica de reputacion de direcciones (sin clave, solo lectura). */
/* Dos niveles: 'bad' = conducta criminal confirmada por GoPlus (veredicto rojo);
   'warn' = senal tecnica (relacion con honeypot, token falso...) que merece aviso, no condena. */
const GOPLUS_FLAGS = {
  phishing_activities: ['Phishing', 'bad'], stealing_attack: ['Theft', 'bad'], blackmail_activities: ['Blackmail', 'bad'], cybercrime: ['Cybercrime', 'bad'],
  money_laundering: ['Money laundering', 'bad'], financial_crime: ['Financial crime', 'bad'], darkweb_transactions: ['Dark web', 'bad'], fake_kyc: ['Fake KYC', 'bad'],
  malicious_mining_activities: ['Malicious mining', 'bad'], sanctioned: ['Sanctioned', 'bad'], blacklist_doubt: ['Blacklisted elsewhere', 'bad'],
  number_of_malicious_contracts_created: ['Created malicious contracts', 'bad'],
  honeypot_related_address: ['Honeypot related', 'warn'], fake_token: ['Fake token', 'warn'], mixer: ['Mixer', 'warn'], gas_abuse: ['Gas abuse', 'warn'],
  reinit: ['Reinit', 'warn'], fake_standard_interface: ['Fake interface', 'warn']
};
async function goplus(addr) {
  const chain = pago.esTron(addr) ? 'tron' : '56';
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch('https://api.gopluslabs.io/api/v1/address_security/' + encodeURIComponent(addr) + '?chain_id=' + chain, { signal: ctl.signal });
    const j = await r.json();
    const d = (j && j.result) || {};
    const tags = [], bad = [];
    for (const k in GOPLUS_FLAGS) {
      const v = d[k];
      if (v === '1' || v === 1 || (k === 'number_of_malicious_contracts_created' && Number(v) > 0)) { tags.push(GOPLUS_FLAGS[k][0]); if (GOPLUS_FLAGS[k][1] === 'bad') bad.push(GOPLUS_FLAGS[k][0]); }
    }
    return { ok: true, tags, bad, esContrato: d.contract_address === '1' };
  } catch (_) { return { ok: false, tags: [], bad: [] }; }
  finally { clearTimeout(t); }
}

function nuestra(addr) {
  const k = (addr || '').toLowerCase();
  if (NUESTROS[k]) return NUESTROS[k];
  if (k === pago.WALLETSHIELD.toLowerCase()) return 'DecFreedom Wallet Shield';
  if (k === pago.GASFAUCET.toLowerCase()) return 'DecFreedom Gas Faucet';
  return null;
}

/* ─────────── Pantalla ─────────── */
export function pintar(cuenta, { cabecera, wireBack, volver, IC }) {
  css();
  $('shd-barslot').innerHTML = cabecera();
  $('shd-in').innerHTML = `
    <div class="shd-lista-wrap">
      <div class="shd-lista-hero">
        <div class="shd-lista-icon">${IC_LISTA}</div>
        <h1>Wallet blacklist</h1>
        <p>Before you send funds to someone you do not know, check their wallet here. The scan runs the address against three sources: wallets reported by DecFreedom subscribers, wallets confirmed by our team, and GoPlus Security, a public threat database with labels for phishing, theft, laundering and honeypot activity. If you were scammed, report the wallet: every report makes the list stronger for everyone. Our own contracts and team wallets are protected and cannot be reported.</p>
      </div>
      <div class="shd-lista-tabs">
        <button class="shd-lista-tab on" id="lista-tab-scan">Check a wallet</button>
        <button class="shd-lista-tab" id="lista-tab-rep">Report a wallet</button>
      </div>
      <div id="lista-body"></div>
      <button class="shd-rescan" id="lista-back" style="margin-top:18px">Back</button>
    </div>`;
  wireBack(volver);
  $('lista-back').onclick = volver;
  const tabs = { scan: $('lista-tab-scan'), rep: $('lista-tab-rep') };
  const ver = (q) => { tabs.scan.classList.toggle('on', q === 'scan'); tabs.rep.classList.toggle('on', q === 'rep'); if (q === 'scan') vistaScan(cuenta); else vistaReporte(cuenta); };
  tabs.scan.onclick = () => ver('scan'); tabs.rep.onclick = () => ver('rep');
  vistaScan(cuenta);
}

function vistaScan(cuenta) {
  $('lista-body').innerHTML = `
    <label class="shd-sim-lbl">Wallet to check</label>
    <input class="shd-sim-in" id="lista-in" placeholder="0x… (BSC) or T… (TRON) wallet" autocomplete="off" spellcheck="false">
    <button class="shd-btn" id="lista-go" style="width:100%;margin-top:14px">${IC_LISTA} Scan this wallet</button>
    <div id="lista-res"></div>
    <p class="shd-lista-note">Not reported does not mean safe: a scammer can use a brand new wallet. Reported means at least one subscriber paid to be here and signed a report with their own wallet, or our team confirmed it. Treat it as a strong warning and verify on your own before sending anything.</p>`;
  $('lista-go').onclick = () => escanear($('lista-in').value.trim(), cuenta);
  $('lista-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('lista-go').click(); });
}

async function escanear(addr, cuenta) {
  const res = $('lista-res'); if (!res) return;
  if (!pago.esBSC(addr) && !pago.esTron(addr)) { res.innerHTML = `<div class="shd-sim-msg bad">Enter a valid wallet address: 0x… for BSC or T… for TRON</div>`; return; }
  res.innerHTML = `
    <div class="shd-lista-scan">
      <div class="shd-radar" style="width:90px;height:90px;margin-bottom:6px"><div class="shd-radar-ring"></div><div class="shd-radar-ring r2"></div><div class="shd-radar-ring r3"></div><div class="shd-radar-sweep"></div></div>
      <ul class="shd-lista-steps">
        <li id="ls1"><i></i>Checking DecFreedom protected addresses</li>
        <li id="ls2"><i></i>Reading community reports on chain</li>
        <li id="ls3"><i></i>Querying GoPlus Security threat database</li>
        <li id="ls4"><i></i>Building the verdict</li>
      </ul>
    </div>`;
  const paso = (i, estado) => { const el = $('ls' + i); if (el) { el.classList.remove('on', 'ok'); el.classList.add(estado); } };
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  paso(1, 'on'); await espera(650);
  const ours = nuestra(addr);
  paso(1, 'ok'); paso(2, 'on');
  const [chain] = await Promise.all([pago.consultarLista(addr, cuenta), espera(900)]);
  paso(2, 'ok'); paso(3, 'on');
  const [gp] = await Promise.all([goplus(addr), espera(900)]);
  paso(3, 'ok'); paso(4, 'on'); await espera(500);
  res.innerHTML = veredicto(addr, ours, chain, gp);
  const rb = $('lista-rep-go'); if (rb) rb.onclick = () => { $('lista-tab-rep').click(); setTimeout(() => { const i = $('lista-rep-in'); if (i) i.value = addr; }, 30); };
}

function veredicto(addr, ours, chain, gp) {
  const esTron = pago.esTron(addr);
  const link = esTron ? 'https://tronscan.org/#/address/' + addr : 'https://bscscan.com/address/' + addr;
  let clase, titulo, sub;
  const comunidad = chain ? chain.n : null;
  const veto = !!(chain && chain.veto);
  const gpBad = gp.bad.length > 0;
  const gpWarn = !gpBad && gp.tags.length > 0;
  if (ours || (chain && chain.prot)) {
    clase = 'ours'; titulo = 'Official DecFreedom address';
    sub = (ours || 'Protected address') + '. This is one of our contracts or team wallets. It is verified and cannot be reported.';
  } else if (veto || (chain && chain.reportada) || gpBad) {
    clase = 'bad'; titulo = 'Do not send funds to this wallet';
    const partes = [];
    if (veto) partes.push('confirmed as malicious by the DecFreedom team');
    if (comunidad > 0) partes.push('reported by ' + comunidad + ' subscriber' + (comunidad === 1 ? '' : 's'));
    if (gpBad) partes.push('flagged by GoPlus Security');
    sub = 'This wallet is ' + partes.join(', ') + '. Anything you send here is very likely lost.';
  } else if (chain === null && !gp.ok) {
    clase = 'warn'; titulo = 'Could not complete the check';
    sub = 'The sources did not answer. Check your connection and try again.';
  } else if (comunidad > 0 || gpWarn) {
    clase = 'warn'; titulo = 'Proceed with caution';
    const partes = [];
    if (comunidad > 0) partes.push(comunidad + ' community report' + (comunidad === 1 ? '' : 's'));
    if (gpWarn) partes.push('technical flags from GoPlus Security (' + gp.tags.join(', ') + ')');
    sub = 'This address has ' + partes.join(' and ') + '. Not confirmed as a scam, but verify before sending.';
  } else {
    clase = 'ok'; titulo = 'No reports found';
    sub = 'Not in our community list, not confirmed by our team and not flagged by GoPlus Security. This is not a guarantee: a fresh wallet has no history yet.';
  }
  const fila = (k, v, c) => `<div class="shd-lista-row"><b>${k}</b><span class="v ${c || ''}">${v}</span></div>`;
  const tags = gp.tags.length ? `<div class="shd-lista-tags">${gp.tags.map((t) => `<span class="shd-lista-tag">${esc(t)}</span>`).join('')}</div>` : '';
  const comTxt = chain === null ? 'Unavailable' : (veto ? 'Confirmed by team' : (comunidad > 0 ? comunidad + ' report' + (comunidad === 1 ? '' : 's') : 'None'));
  const comCls = chain === null ? 'warn' : ((veto || (chain && chain.reportada)) ? 'bad' : (comunidad > 0 ? 'warn' : 'ok'));
  const gpTxt = !gp.ok ? 'Unavailable' : (gp.tags.length ? gp.tags.length + ' flag' + (gp.tags.length === 1 ? '' : 's') : 'Clean');
  const gpCls = !gp.ok ? 'warn' : (gpBad ? 'bad' : (gpWarn ? 'warn' : 'ok'));
  const puedeReportar = !ours && !(chain && chain.prot) && !(chain && chain.yaReporte);
  return `
    <div class="shd-lista-ver ${clase}">
      <div class="shd-lista-vt">${titulo}</div>
      <div class="shd-lista-vs">${esc(sub)}</div>
      <div class="shd-lista-addr">${esc(addr)}</div>
      ${tags}
      <div class="shd-lista-src">
        ${fila('DecFreedom community list', comTxt, comCls)}
        ${fila('GoPlus Security', gpTxt, gpCls)}
        ${fila('Explorer', `<a href="${link}" target="_blank" rel="noopener" style="color:var(--gold,#E8B84B)">Open on ${esTron ? 'TronScan' : 'BscScan'}</a>`)}
      </div>
      ${chain && chain.yaReporte ? '<div class="shd-lista-rep">You already reported this wallet.</div>' : ''}
      ${puedeReportar ? `<button class="shd-card-btn lista" id="lista-rep-go" style="margin-top:14px">Were you scammed by this wallet? Report it</button>` : ''}
    </div>`;
}

function vistaReporte(cuenta) {
  $('lista-body').innerHTML = `
    <label class="shd-sim-lbl">Wallet to report</label>
    <input class="shd-sim-in" id="lista-rep-in" placeholder="0x… (BSC) or T… (TRON) wallet" autocomplete="off" spellcheck="false">
    <button class="shd-btn" id="lista-rep-btn" style="width:100%;margin-top:14px">${IC_LISTA} Report this wallet</button>
    <div id="lista-rep-res"></div>
    <p class="shd-lista-note">Reports are signed with your wallet and stored on chain. They are free for subscribers (you only pay network gas, a fraction of a cent). One report per wallet per address. Report only wallets that actually scammed you or someone you know: false reports can be cleared by the team and repeated abuse can get a wallet blocked from the service.</p>`;
  $('lista-rep-btn').onclick = async () => {
    const addr = $('lista-rep-in').value.trim(); const res = $('lista-rep-res'); const btn = $('lista-rep-btn');
    if (!pago.esBSC(addr) && !pago.esTron(addr)) { res.innerHTML = `<div class="shd-sim-msg bad">Enter a valid wallet address: 0x… for BSC or T… for TRON</div>`; return; }
    if (nuestra(addr)) { res.innerHTML = `<div class="shd-sim-msg bad">That is an official DecFreedom address. It cannot be reported.</div>`; return; }
    if (cuenta && addr.toLowerCase() === cuenta.toLowerCase()) { res.innerHTML = `<div class="shd-sim-msg bad">You cannot report your own wallet.</div>`; return; }
    btn.disabled = true; res.innerHTML = `<div class="shd-sim-loading">Confirm the report in your wallet…</div>`;
    try {
      await pago.reportarLista(addr);
      res.innerHTML = `<div class="shd-sim-msg" style="background:rgba(46,189,133,.1);color:#2ebd85">Report recorded on chain. Thank you for protecting the community.</div>`;
    } catch (e) {
      const nombre = (e && e.revert && e.revert.name) || '';
      const m = (nombre + ' ' + ((e && (e.reason || e.shortMessage || e.message)) || '')).toLowerCase();
      let txt = 'Could not record the report. Try again.';
      if (m.includes('user rejected') || m.includes('denied') || m.includes('4001')) txt = 'You cancelled the report.';
      if (m.includes('sinacceso')) txt = 'Reports require an active Wallet Shield subscription.';
      if (m.includes('direccionprotegida')) txt = 'That address is protected and cannot be reported.';
      if (m.includes('enpausa')) txt = 'The service is paused right now.';
      if (m.includes('yareportada')) txt = 'You already reported this wallet.';
      if (m.includes('insufficient funds')) txt = 'Not enough BNB for gas.';
      try { console.warn('[shield] report:', e); } catch (_) {}
      res.innerHTML = `<div class="shd-sim-msg bad">${txt}</div>`;
    }
    btn.disabled = false;
  };
}
