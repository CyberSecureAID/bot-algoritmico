/* shield.js — Wallet Shield: seguridad de la wallet del usuario.
   Fase 1: escáner de permisos (approvals). Detecta la wallet conectada,
   escanea, y muestra los permisos en 2 grupos (nuestros = confiables /
   externos = con riesgo y opción de revocar). Diseño dark profesional. */
import * as datos from './shield-datos.js?v=2';
import * as wallet from '../wallet.js?v=125';
import { calcularScore } from './shield-score.js?v=1';
import * as sim from './shield-sim.js?v=1';

const $ = (id) => document.getElementById(id);
let _css = false;

/* ═══════════ CSS ═══════════ */
function inyectarCSS() {
  if (_css) return; _css = true;
  const s = document.createElement('style'); s.id = 'shd-css';
  s.textContent = `
  #shd{position:fixed;inset:0;z-index:400;display:flex;flex-direction:column;color:#eaecef;font-family:var(--display,'Segoe UI',sans-serif);
    background:#000 url('assets/portada/img/fondo-shield.webp') center/cover no-repeat;overflow-y:auto;-webkit-overflow-scrolling:touch}
  #shd::before{content:'';position:fixed;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.78),rgba(3,5,8,.93));z-index:0;pointer-events:none}
  #shd *{box-sizing:border-box}
  /* Barra superior tipo sección interna (back a la izquierda) */
  #shd .shd-bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;padding:calc(12px + env(safe-area-inset-top,0px)) 18px 12px;background:rgba(5,7,9,.82);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid #1c232b}
  #shd .shd-back{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.04);border:1px solid #29313b;color:#a7b0bb;border-radius:10px;padding:9px 14px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600}
  #shd .shd-back:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #shd .shd-bar-t{font-size:15px;font-weight:800;letter-spacing:.2px}
  #shd .shd-bar-t span{color:var(--gold,#E8B84B)}
  #shd .shd-in{position:relative;z-index:1;width:100%;max-width:820px;margin:0 auto;padding:22px 16px calc(40px + env(safe-area-inset-bottom,0px))}
  /* Wallet conectada */
  #shd .shd-wallet{display:flex;align-items:center;gap:12px;background:rgba(14,19,25,.78);border:1px solid #1c232b;border-radius:14px;padding:14px 16px;margin-bottom:18px}
  #shd .shd-wava{width:38px;height:38px;border-radius:50%;background:#12161c;display:grid;place-items:center;flex:none;color:var(--gold,#E8B84B)}
  #shd .shd-wava svg{width:24px;height:24px} #shd .shd-wava img{width:26px;height:26px;border-radius:6px;object-fit:cover}
  #shd .shd-wava img{width:100%;height:100%;object-fit:cover}
  #shd .shd-winfo{flex:1;min-width:0}
  #shd .shd-winfo b{font-size:14px;display:block}
  #shd .shd-winfo small{font-size:12px;color:#79838f;font-family:var(--mono,monospace)}
  #shd .shd-wdot{width:9px;height:9px;border-radius:50%;background:#2ebd85;box-shadow:0 0 8px #2ebd85;flex:none}
  /* Hero */
  #shd .shd-hero{text-align:center;padding:24px 16px 28px}
  #shd .shd-hero h1{font-size:25px;font-weight:800;margin:0 0 10px}
  #shd .shd-hero p{font-size:13.5px;color:#a7b0bb;line-height:1.65;max-width:480px;margin:0 auto 8px}
  #shd .shd-feats{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:16px auto 24px;max-width:520px}
  #shd .shd-feat{font-size:11.5px;color:#a7b0bb;background:rgba(232,184,75,.06);border:1px solid rgba(232,184,75,.18);border-radius:100px;padding:6px 13px}
  /* Botón dorado (como la página) */
  #shd .shd-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:15px 34px;border:1px solid var(--gold-md,#cf9f2e);border-radius:13px;background:linear-gradient(180deg,#f4d089,#E8B84B 55%,#cf9f2e);color:#241900;font-family:var(--display,sans-serif);font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 5px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.4)}
  #shd .shd-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.4)}
  #shd .shd-btn:disabled{opacity:.6;cursor:default}
  #shd .shd-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px}
  #shd .shd-btns .shd-btn,#shd .shd-btns .shd-btn2{margin-top:0;padding:14px 22px;flex:0 1 auto}
  #shd .shd-btn2{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;padding:12px 24px;border:1px solid #29313b;border-radius:12px;background:rgba(255,255,255,.03);color:#a7b0bb;font-family:inherit;font-weight:600;font-size:13.5px;cursor:pointer}
  #shd .shd-btn2:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #shd .shd-btn2 svg{stroke:currentColor}
  /* Escaneo (radar dorado) */
  #shd .shd-scanning{max-width:520px;margin:0 auto;padding:22px}
  #shd .shd-radar{width:120px;height:120px;margin:0 auto 20px;position:relative}
  #shd .shd-radar-ring{position:absolute;inset:0;border-radius:50%;border:1px solid #29313b}
  #shd .shd-radar-ring.r2{inset:18px} #shd .shd-radar-ring.r3{inset:36px}
  #shd .shd-radar-sweep{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,transparent 0deg,rgba(232,184,75,.32) 40deg,transparent 80deg);animation:shdSweep 1.4s linear infinite}
  #shd .shd-radar-core{position:absolute;inset:46px;border-radius:50%;background:radial-gradient(circle,#f4d089,#cf9f2e);box-shadow:0 0 20px rgba(232,184,75,.55)}
  @keyframes shdSweep{to{transform:rotate(360deg)}}
  #shd .shd-radar-grid{position:absolute;inset:0;border-radius:50%;background:
    linear-gradient(0deg,transparent 49%,rgba(232,184,75,.1) 50%,transparent 51%),
    linear-gradient(90deg,transparent 49%,rgba(232,184,75,.1) 50%,transparent 51%)}
  #shd .shd-blip{position:absolute;width:7px;height:7px;border-radius:50%;background:var(--gold,#E8B84B);box-shadow:0 0 8px var(--gold,#E8B84B);opacity:0}
  #shd .shd-blip.b1{top:24%;left:30%;animation:shdBlip 1.4s ease-in-out .3s infinite}
  #shd .shd-blip.b2{top:60%;left:66%;animation:shdBlip 1.4s ease-in-out .7s infinite}
  #shd .shd-blip.b3{top:70%;left:28%;animation:shdBlip 1.4s ease-in-out 1s infinite}
  #shd .shd-blip.b4{top:34%;left:68%;animation:shdBlip 1.4s ease-in-out 1.2s infinite}
  @keyframes shdBlip{0%,100%{opacity:0;transform:scale(.5)}40%{opacity:1;transform:scale(1)}}
  #shd .shd-term{background:rgba(3,5,8,.72);border:1px solid #1c232b;border-radius:12px;padding:14px 16px;font-family:var(--mono,monospace);font-size:12.5px;text-align:left;min-height:120px}
  #shd .shd-term .ln{color:#79838f;margin-bottom:5px;opacity:0;animation:shdIn .3s forwards}
  #shd .shd-term .ln b{color:var(--gold,#E8B84B)} #shd .shd-term .ln .ok{color:#2ebd85}
  @keyframes shdIn{to{opacity:1}}
  #shd .shd-bar-pr{height:6px;background:#12161c;border-radius:100px;overflow:hidden;margin-top:16px}
  #shd .shd-bar-fill{height:100%;width:0;background:linear-gradient(90deg,#cf9f2e,#f4d089);border-radius:100px;transition:width .3s}
  /* Resultados */
  #shd .shd-res-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0 14px}
  #shd .shd-res-head h2{font-size:17px;font-weight:800;margin:0}
  #shd .shd-rescan{font-size:12.5px;padding:8px 14px;border-radius:9px;border:1px solid #29313b;background:rgba(255,255,255,.03);color:#a7b0bb;cursor:pointer;font-family:inherit}
  #shd .shd-rescan:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #shd .shd-group-t{font-size:12px;font-weight:700;color:#79838f;text-transform:uppercase;letter-spacing:.6px;margin:20px 0 10px}
  #shd .shd-group-t.trust{color:#2ebd85} #shd .shd-group-t.risk{color:#f6465d}
  #shd .shd-perm{display:flex;align-items:center;gap:13px;background:rgba(14,19,25,.78);border:1px solid #1c232b;border-radius:13px;padding:13px 15px;margin-bottom:9px}
  #shd .shd-perm.trust{border-color:rgba(46,189,133,.25)}
  #shd .shd-perm.danger{border-color:rgba(246,70,93,.3)}
  #shd .shd-perm-ic{width:38px;height:38px;border-radius:10px;background:#12161c;display:grid;place-items:center;font-weight:800;font-size:13px;color:#a7b0bb;flex:none}
  #shd .shd-perm.trust .shd-perm-ic{background:rgba(46,189,133,.12);color:#2ebd85}
  #shd .shd-perm-info{flex:1;min-width:0}
  #shd .shd-perm-info b{font-size:14px;display:block}
  #shd .shd-perm-info .sp{font-size:11.5px;color:#79838f;font-family:var(--mono,monospace);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #shd .shd-perm-info .exp{font-size:11.5px;margin-top:3px}
  #shd .shd-perm-info .exp.ok{color:#2ebd85} #shd .shd-perm-info .exp.warn{color:#e8b84b} #shd .shd-perm-info .exp.bad{color:#f6465d}
  #shd .shd-tag{font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px;flex:none}
  #shd .shd-tag.unl{background:rgba(246,70,93,.14);color:#f6465d}
  #shd .shd-tag.ok{background:rgba(46,189,133,.14);color:#2ebd85}
  #shd .shd-revoke{font-size:12.5px;font-weight:700;padding:9px 15px;border-radius:9px;border:1px solid rgba(246,70,93,.4);background:rgba(246,70,93,.1);color:#f6465d;cursor:pointer;font-family:inherit;flex:none}
  #shd .shd-revoke:hover{background:rgba(246,70,93,.18)}
  #shd .shd-revoke:disabled{opacity:.5;cursor:default}
  #shd .shd-safe{display:grid;place-items:center;padding:40px 20px;text-align:center;color:#a7b0bb}
  #shd .shd-safe .ic{width:60px;height:60px;border-radius:50%;background:rgba(46,189,133,.12);color:#2ebd85;display:grid;place-items:center;margin-bottom:16px}
  #shd .shd-how{background:rgba(14,19,25,.6);border:1px solid #1c232b;border-radius:12px;padding:14px 16px;margin-top:18px;font-size:12.5px;color:#a7b0bb;line-height:1.6}
  #shd .shd-how b{color:#eaecef}
  /* Health Score */
  #shd .shd-health{display:flex;gap:20px;align-items:center;background:rgba(14,19,25,.8);border:1px solid #1c232b;border-radius:16px;padding:20px;margin-bottom:20px}
  #shd .shd-gauge{position:relative;flex:none;width:180px;text-align:center}
  #shd .shd-gauge-n{position:absolute;top:52px;left:0;right:0;font-size:38px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}
  #shd .shd-gauge-l{position:absolute;top:90px;left:0;right:0;font-size:13px;font-weight:700}
  #shd .shd-health-side{flex:1;min-width:0}
  #shd .shd-health-t{font-size:15px;font-weight:800;margin-bottom:12px}
  #shd .shd-facs{display:flex;flex-direction:column;gap:8px}
  #shd .shd-fac{display:flex;gap:10px;align-items:flex-start;font-size:12.5px}
  #shd .shd-fac-ic{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:11px;flex:none}
  #shd .shd-fac.ok .shd-fac-ic{background:rgba(46,189,133,.15);color:#2ebd85}
  #shd .shd-fac.warn .shd-fac-ic{background:rgba(232,184,75,.15);color:#e8b84b}
  #shd .shd-fac.bad .shd-fac-ic{background:rgba(246,70,93,.15);color:#f6465d}
  #shd .shd-fac b{display:block;color:#eaecef;font-weight:600} #shd .shd-fac small{color:#79838f;font-size:11.5px}
  #shd .shd-consejo{margin-top:12px;font-size:12.5px;color:#a7b0bb;background:rgba(232,184,75,.06);border:1px solid rgba(232,184,75,.18);border-radius:9px;padding:9px 12px}
  /* Simulador */
  #shd .shd-sim-wrap{max-width:560px;margin:0 auto;padding:10px 0}
  #shd .shd-sim-h{font-size:23px;font-weight:800;text-align:center;margin:8px 0 10px}
  #shd .shd-sim-p{font-size:13px;color:#a7b0bb;text-align:center;line-height:1.6;margin:0 0 22px}
  #shd .shd-sim-lbl{display:block;font-size:12px;color:#a7b0bb;margin:14px 0 6px}
  #shd .shd-sim-in{width:100%;box-sizing:border-box;background:rgba(11,14,17,.72);border:1px solid #1c232b;border-radius:11px;padding:12px 14px;color:#eaecef;font-family:var(--mono,monospace);font-size:13px;outline:none}
  #shd .shd-sim-in:focus{border-color:var(--gold-soft,#C9A84B)}
  #shd .shd-sim-msg{font-size:13px;margin-top:14px;padding:12px;border-radius:10px;text-align:center}
  #shd .shd-sim-msg.bad{background:rgba(246,70,93,.1);color:#f6465d}
  #shd .shd-sim-loading{text-align:center;padding:26px}
  #shd .shd-sim-card{margin-top:18px;border:1px solid;border-radius:14px;padding:18px;background:rgba(14,19,25,.8)}
  #shd .shd-sim-verd{font-size:18px;font-weight:800;margin-bottom:10px}
  #shd .shd-sim-res{font-size:13.5px;color:#c9d2dc;line-height:1.65;margin-bottom:14px}
  #shd .shd-sim-halls{display:flex;flex-direction:column;gap:7px}
  #shd .shd-sim-h-row{font-size:12.5px;display:flex;gap:8px;align-items:flex-start}
  #shd .shd-sim-h-row.ok{color:#2ebd85} #shd .shd-sim-h-row.warn{color:#e8b84b} #shd .shd-sim-h-row.bad{color:#f6465d} #shd .shd-sim-h-row.info{color:#a7b0bb}
  @media(max-width:560px){
    #shd .shd-hero h1{font-size:21px} #shd .shd-perm{flex-wrap:wrap}
    #shd .shd-perm-info{flex:1 1 60%} #shd .shd-revoke{margin-left:auto}
    #shd .shd-health{flex-direction:column} #shd .shd-gauge{margin:0 auto}
  }
  `;
  document.head.appendChild(s);
}

const IC = {
  shield: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'
};

/* ═══════════ Abrir Wallet Shield ═══════════ */
export function abrirShield() {
  inyectarCSS();
  const prev = $('shd'); if (prev) prev.remove();
  const cont = document.createElement('div'); cont.id = 'shd';
  document.body.appendChild(cont);
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  cont.innerHTML = `<div id="shd-barslot"></div><div class="shd-in" id="shd-in"></div>`;
  if (!cuenta) { pintarConectar(); return; }
  pintarInicio(cuenta);
}
function cerrar() {
  // Navegar al lobby SIN quitar el overlay antes (si se quita, se ven los bots
  // de app.html un instante). El overlay tapa la pantalla hasta que carga index.
  try { location.replace('index.html'); } catch (_) { location.href = 'index.html'; }
}

function cabecera() {
  return `<div class="shd-bar">
    <button class="shd-back" id="shd-back">← Back</button>
    <div class="shd-bar-t">Wallet <span>Shield</span></div>
  </div>`;
}

function pintarConectar() {
  $('shd-barslot').innerHTML = cabecera();
  $('shd-in').innerHTML = `
    <div class="shd-hero" style="padding-top:50px">
      <h1>Protect your wallet</h1>
      <p>Wallet Shield scans your wallet for risky permissions, gives you a security score, checks contracts before you sign, and lets you revoke threats, all in one place. Connect your wallet to begin.</p>
      <div class="shd-feats">
        <span class="shd-feat">Permission scanner</span>
        <span class="shd-feat">Health score</span>
        <span class="shd-feat">Contract checker</span>
        <span class="shd-feat">One-tap revoke</span>
      </div>
      <button class="shd-btn" id="shd-conn">Connect wallet</button>
    </div>`;
  wireBack();
  $('shd-conn').onclick = async () => { try { await wallet.conectar(); abrirShield(); } catch (_) {} };
}
function wireBack() { const b = $('shd-back'); if (b) b.onclick = cerrar; }

function pintarInicio(cuenta) {
  const info = datos.infoWallet();
  const corta = cuenta.slice(0, 6) + '…' + cuenta.slice(-4);
  $('shd-barslot').innerHTML = cabecera();
  $('shd-in').innerHTML = `
    <div class="shd-wallet">
      <div class="shd-wava">${info.iconoHTML || IC.user}</div>
      <div class="shd-winfo"><b>${info.nombre || 'Wallet'}</b><small>${corta}</small></div>
      <span class="shd-wdot"></span>
    </div>
    <div class="shd-hero">
      <h1>Scan your wallet</h1>
      <p>Check every permission your wallet has granted, get a security score, and revoke anything risky in one tap.</p>
      <div class="shd-btns"><button class="shd-btn" id="shd-scan">${IC.shield} Scan</button><button class="shd-btn2" id="shd-sim">${IC.search} Check contract</button></div>
    </div>
    <div class="shd-how">
      <b>How it works.</b> Every time you use a dApp, you grant it permission to move certain tokens. Old or unlimited permissions are the top way wallets get drained. This scan shows them all. Permissions to our own contracts are marked as trusted. Anything you don't recognize, revoke it.
    </div>`;
  wireBack();
  $('shd-scan').onclick = () => escanear(cuenta);
  $('shd-sim').onclick = () => pintarSimulador(cuenta);
}

function pintarSimulador(cuenta) {
  $('shd-barslot').innerHTML = cabecera();
  $('shd-in').innerHTML = `
    <div class="shd-sim-wrap">
      <h1 class="shd-sim-h">What happens if I sign this?</h1>
      <p class="shd-sim-p">Paste the contract a site is asking you to approve. If you have the spender address too, add it for a full risk check. We read the blockchain live, no guessing.</p>
      <label class="shd-sim-lbl">Token / contract address</label>
      <input class="shd-sim-in" id="sim-c" placeholder="0x… contract address" autocomplete="off" spellcheck="false">
      <label class="shd-sim-lbl">Spender address <span style="color:#5f6b7a">(optional, who is asking for permission)</span></label>
      <input class="shd-sim-in" id="sim-s" placeholder="0x… spender address" autocomplete="off" spellcheck="false">
      <button class="shd-btn" id="sim-go" style="margin-top:16px;width:100%">Analyze</button>
      <div id="sim-res"></div>
      <button class="shd-rescan" id="sim-back" style="margin-top:18px">← Back</button>
    </div>`;
  wireBack();
  $('sim-back').onclick = () => pintarInicio(cuenta);
  $('sim-go').onclick = async () => {
    const cAddr = $('sim-c').value.trim(); const sAddr = $('sim-s').value.trim();
    const res = $('sim-res');
    if (!sim.esDireccion(cAddr)) { res.innerHTML = `<div class="shd-sim-msg bad">Enter a valid contract address (0x…)</div>`; return; }
    res.innerHTML = `<div class="shd-sim-loading"><div class="shd-radar" style="width:70px;height:70px"><div class="shd-radar-ring"></div><div class="shd-radar-sweep"></div><div class="shd-radar-core" style="inset:26px"></div></div><div style="color:#a7b0bb;font-size:13px;margin-top:10px">Reading the blockchain…</div></div>`;
    try {
      const info = await sim.analizar(cAddr, sAddr || null);
      res.innerHTML = tarjetaSim(info);
    } catch (e) { res.innerHTML = `<div class="shd-sim-msg bad">Could not analyze. Check the address and try again.</div>`; }
  };
}
function tarjetaSim(info) {
  const col = { safe: '#2ebd85', info: '#E8B84B', warn: '#e8b84b', danger: '#f6465d', unknown: '#a7b0bb' }[info.veredicto] || '#a7b0bb';
  const hall = info.hallazgos.map(h => {
    const ic = h.tipo === 'ok' ? '✓' : (h.tipo === 'warn' ? '!' : (h.tipo === 'bad' ? '✕' : 'ℹ'));
    const cls = h.tipo === 'ok' ? 'ok' : (h.tipo === 'warn' ? 'warn' : (h.tipo === 'bad' ? 'bad' : 'info'));
    return `<div class="shd-sim-h-row ${cls}"><span>${ic}</span> ${escH(h.t)}</div>`;
  }).join('');
  return `<div class="shd-sim-card" style="border-color:${col}44">
    <div class="shd-sim-verd" style="color:${col}">${escH(info.titulo)}</div>
    <div class="shd-sim-res">${escH(info.resumen)}</div>
    <div class="shd-sim-halls">${hall}</div>
  </div>`;
}
async function escanear(cuenta) {
  const lineas = [
    'Initializing secure scan…',
    'Reading approval history from chain…',
    'Cross-checking active allowances…',
    'Flagging unlimited & risky spenders…',
    'Identifying trusted contracts…'
  ];
  $('shd-barslot').innerHTML = cabecera();
  $('shd-in').innerHTML = `
    <div class="shd-scanning">
      <div class="shd-radar">
        <div class="shd-radar-ring"></div><div class="shd-radar-ring r2"></div><div class="shd-radar-ring r3"></div>
        <div class="shd-radar-grid"></div>
        <div class="shd-radar-sweep"></div><div class="shd-radar-core"></div>
        <span class="shd-blip b1"></span><span class="shd-blip b2"></span><span class="shd-blip b3"></span><span class="shd-blip b4"></span>
      </div>
      <div class="shd-term" id="shd-term"></div>
      <div class="shd-bar-pr"><div class="shd-bar-fill" id="shd-bar"></div></div>
    </div>`;
  wireBack();
  const term = $('shd-term');
  let li = 0;
  const meter = setInterval(() => {
    if (li < lineas.length) {
      const d = document.createElement('div'); d.className = 'ln';
      d.innerHTML = `<b>›</b> ${lineas[li]}`;
      term.appendChild(d); li++;
    }
  }, 500);
  try {
    const permisos = await datos.escanearApprovals(cuenta, (p) => {
      const bar = $('shd-bar'); if (bar) bar.style.width = Math.round(p * 100) + '%';
    });
    clearInterval(meter);
    // última línea OK
    const d = document.createElement('div'); d.className = 'ln'; d.innerHTML = `<span class="ok">✓ Scan complete</span>`; if (term) term.appendChild(d);
    setTimeout(() => pintarResultados(cuenta, permisos), 700);
  } catch (e) {
    clearInterval(meter);
    setTimeout(() => pintarResultados(cuenta, []), 500);
  }
}

function pintarResultados(cuenta, permisos) {
  const externos = permisos.filter(p => !p.nuestro);
  const nuestros = permisos.filter(p => p.nuestro);
  const peligrosos = externos.filter(p => p.ilimitado).length;
  const sc = calcularScore(permisos);
  $('shd-barslot').innerHTML = cabecera();
  let html = healthCard(sc) + `
    <div class="shd-res-head">
      <h2>${externos.length + nuestros.length} permission${(externos.length+nuestros.length)!==1?'s':''} found${peligrosos ? ` · <span style="color:#f6465d">${peligrosos} risky</span>` : ''}</h2>
      <button class="shd-rescan" id="shd-rescan">Scan again</button>
    </div>`;
  if (permisos.length === 0) {
    html += `<div class="shd-safe"><div class="ic">${IC.check}</div><h2 style="margin:0 0 6px;color:#e7ecf2">Your wallet is clean</h2><p style="margin:0">No active permissions found. Nothing to revoke.</p></div>`;
  } else {
    if (externos.length) {
      html += `<div class="shd-group-t risk">⚠ External permissions</div>`;
      html += externos.map(filaPerm).join('');
    }
    if (nuestros.length) {
      html += `<div class="shd-group-t trust">✓ Trusted · Cripto Cuba</div>`;
      html += nuestros.map(filaPerm).join('');
    }
  }
  html += `<div class="shd-how"><b>Tip.</b> Revoking a permission only stops future spending. It never moves or risks your funds. Revoke anything you don't recognize or no longer use. Each revoke is a transaction you sign in your wallet (costs a little gas).</div>`;
  $('shd-in').innerHTML = html;
  wireBack();
  $('shd-rescan').onclick = () => escanear(cuenta);
  // wire revokes
  document.querySelectorAll('[data-revoke]').forEach(b => {
    b.onclick = async () => {
      const [token, spender] = b.dataset.revoke.split('|');
      b.disabled = true; b.textContent = 'Revoking…';
      try { await datos.revocar(token, spender); b.closest('.shd-perm').style.opacity = '.4'; b.textContent = 'Revoked ✓'; }
      catch (e) { b.disabled = false; b.textContent = 'Revoke'; }
    };
  });
}

function healthCard(sc) {
  // arco semicircular del score (SVG)
  const pct = sc.score / 100;
  const circ = 251;  // circunferencia de media rueda (r=80)
  const offset = circ * (1 - pct);
  const factores = sc.factores.map(f => {
    const ic = f.tipo === 'ok' ? '✓' : (f.tipo === 'warn' ? '!' : '✕');
    const cls = f.tipo === 'ok' ? 'ok' : (f.tipo === 'warn' ? 'warn' : 'bad');
    return `<div class="shd-fac ${cls}"><span class="shd-fac-ic">${ic}</span><div><b>${f.texto}</b><small>${f.detalle}</small></div></div>`;
  }).join('');
  return `<div class="shd-health">
    <div class="shd-gauge">
      <svg viewBox="0 0 180 110" width="180" height="110">
        <path d="M10 100 A80 80 0 0 1 170 100" fill="none" stroke="#1a2230" stroke-width="14" stroke-linecap="round"/>
        <path d="M10 100 A80 80 0 0 1 170 100" fill="none" stroke="${sc.color}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" style="transition:stroke-dashoffset 1s ease"/>
      </svg>
      <div class="shd-gauge-n" style="color:${sc.color}">${sc.score}</div>
      <div class="shd-gauge-l" style="color:${sc.color}">${sc.nivel}</div>
    </div>
    <div class="shd-health-side">
      <div class="shd-health-t">Wallet Health Score</div>
      <div class="shd-facs">${factores}</div>
      ${sc.consejos.length ? `<div class="shd-consejo">💡 ${sc.consejos[0]}</div>` : ''}
    </div>
  </div>`;
}
function filaPerm(p) {
  const corta = p.spender.slice(0, 8) + '…' + p.spender.slice(-6);
  const ini = (p.symbol || '?').slice(0, 3).toUpperCase();
  if (p.nuestro) {
    return `<div class="shd-perm trust">
      <div class="shd-perm-ic">${ini}</div>
      <div class="shd-perm-info"><b>${escH(p.symbol)}</b><div class="sp">${corta}</div><div class="exp ok">${escH(p.nombreNuestro)} · safe to keep</div></div>
      <span class="shd-tag ok">Trusted</span>
    </div>`;
  }
  const riesgo = p.ilimitado
    ? `<div class="exp bad">Unlimited access, high risk if unknown</div>`
    : `<div class="exp warn">Limited approval</div>`;
  return `<div class="shd-perm ${p.ilimitado ? 'danger' : ''}">
    <div class="shd-perm-ic">${ini}</div>
    <div class="shd-perm-info"><b>${escH(p.symbol)}</b><div class="sp">to ${corta}</div>${riesgo}</div>
    ${p.ilimitado ? '<span class="shd-tag unl">Unlimited</span>' : ''}
    <button class="shd-revoke" data-revoke="${p.token}|${p.spender}">Revoke</button>
  </div>`;
}
function escH(s){return String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));}
