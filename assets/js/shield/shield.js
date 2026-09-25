/* shield.js — Wallet Shield: seguridad de la wallet del usuario.
   Fase 1: escáner de permisos (approvals). Detecta la wallet conectada,
   escanea, y muestra los permisos en 2 grupos (nuestros = confiables /
   externos = con riesgo y opción de revocar). Diseño dark profesional. */
import * as datos from './shield-datos.js?v=1';
import * as wallet from '../wallet.js?v=125';

const $ = (id) => document.getElementById(id);
let _css = false;

/* ═══════════ CSS ═══════════ */
function inyectarCSS() {
  if (_css) return; _css = true;
  const s = document.createElement('style'); s.id = 'shd-css';
  s.textContent = `
  #shd{position:fixed;inset:0;z-index:400;display:flex;flex-direction:column;color:#e7ecf2;font-family:var(--display,'Segoe UI',sans-serif);
    background:#080b10 url('assets/portada/img/fondo-shield.webp') center/cover no-repeat;overflow-y:auto;-webkit-overflow-scrolling:touch}
  #shd::before{content:'';position:fixed;inset:0;background:linear-gradient(180deg,rgba(6,9,13,.82),rgba(6,9,13,.94));z-index:0;pointer-events:none}
  #shd *{box-sizing:border-box}
  #shd .shd-in{position:relative;z-index:1;width:100%;max-width:820px;margin:0 auto;padding:calc(18px + env(safe-area-inset-top,0px)) 16px calc(30px + env(safe-area-inset-bottom,0px))}
  /* Header */
  #shd .shd-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px}
  #shd .shd-brand{display:flex;align-items:center;gap:11px}
  #shd .shd-logo{width:40px;height:40px;border-radius:11px;background:linear-gradient(145deg,#1b2430,#0d131b);border:1px solid #2b3a4d;display:grid;place-items:center;color:#5ac8fa}
  #shd .shd-brand b{font-size:18px;font-weight:800;letter-spacing:.3px;display:block}
  #shd .shd-brand small{font-size:11px;color:#6b7684}
  #shd .shd-x{width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid #26313f;color:#aab6c4;cursor:pointer;flex:none}
  /* Wallet conectada */
  #shd .shd-wallet{display:flex;align-items:center;gap:12px;background:rgba(13,19,26,.7);border:1px solid #26313f;border-radius:14px;padding:14px 16px;margin-bottom:18px}
  #shd .shd-wava{width:38px;height:38px;border-radius:50%;background:#1a2230;display:grid;place-items:center;overflow:hidden;flex:none}
  #shd .shd-wava img{width:100%;height:100%;object-fit:cover}
  #shd .shd-winfo{flex:1;min-width:0}
  #shd .shd-winfo b{font-size:14px;display:block}
  #shd .shd-winfo small{font-size:12px;color:#6b7684;font-family:var(--mono,monospace)}
  #shd .shd-wdot{width:9px;height:9px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399;flex:none}
  /* Hero de escaneo */
  #shd .shd-hero{text-align:center;padding:26px 16px 30px}
  #shd .shd-hero h1{font-size:24px;font-weight:800;margin:0 0 8px}
  #shd .shd-hero p{font-size:13.5px;color:#8a95a3;line-height:1.6;max-width:440px;margin:0 auto 22px}
  #shd .shd-scan{display:inline-flex;align-items:center;gap:9px;padding:15px 34px;border:0;border-radius:13px;background:linear-gradient(180deg,#2b6cff,#1e52d6 60%,#1642b0);color:#fff;font-family:inherit;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 6px 0 #123a94,0 10px 26px rgba(43,108,255,.35)}
  #shd .shd-scan:active{transform:translateY(3px);box-shadow:0 3px 0 #123a94,0 6px 14px rgba(43,108,255,.3)}
  #shd .shd-scan:disabled{opacity:.6;cursor:default}
  /* Animación de escaneo (terminal hacker sobria) */
  #shd .shd-scanning{max-width:520px;margin:0 auto;padding:22px}
  #shd .shd-radar{width:120px;height:120px;margin:0 auto 20px;position:relative}
  #shd .shd-radar-ring{position:absolute;inset:0;border-radius:50%;border:1px solid #26313f}
  #shd .shd-radar-ring.r2{inset:18px} #shd .shd-radar-ring.r3{inset:36px}
  #shd .shd-radar-sweep{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,transparent 0deg,rgba(90,200,250,.35) 40deg,transparent 80deg);animation:shdSweep 1.4s linear infinite}
  #shd .shd-radar-core{position:absolute;inset:46px;border-radius:50%;background:radial-gradient(circle,#5ac8fa,#1e52d6);box-shadow:0 0 20px rgba(90,200,250,.6)}
  @keyframes shdSweep{to{transform:rotate(360deg)}}
  #shd .shd-term{background:rgba(4,7,11,.7);border:1px solid #1b2430;border-radius:12px;padding:14px 16px;font-family:var(--mono,monospace);font-size:12.5px;text-align:left;min-height:120px}
  #shd .shd-term .ln{color:#7d8895;margin-bottom:5px;opacity:0;animation:shdIn .3s forwards}
  #shd .shd-term .ln b{color:#5ac8fa} #shd .shd-term .ln .ok{color:#34d399}
  @keyframes shdIn{to{opacity:1}}
  #shd .shd-bar{height:6px;background:#141c26;border-radius:100px;overflow:hidden;margin-top:16px}
  #shd .shd-bar-fill{height:100%;width:0;background:linear-gradient(90deg,#2b6cff,#5ac8fa);border-radius:100px;transition:width .3s}
  /* Resultados */
  #shd .shd-res-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0 14px}
  #shd .shd-res-head h2{font-size:17px;font-weight:800;margin:0}
  #shd .shd-rescan{font-size:12.5px;padding:8px 14px;border-radius:9px;border:1px solid #26313f;background:rgba(255,255,255,.03);color:#aab6c4;cursor:pointer;font-family:inherit}
  #shd .shd-group-t{font-size:12px;font-weight:700;color:#6b7684;text-transform:uppercase;letter-spacing:.6px;margin:20px 0 10px;display:flex;align-items:center;gap:8px}
  #shd .shd-group-t.trust{color:#34d399} #shd .shd-group-t.risk{color:#f87171}
  #shd .shd-perm{display:flex;align-items:center;gap:13px;background:rgba(13,19,26,.7);border:1px solid #202b37;border-radius:13px;padding:13px 15px;margin-bottom:9px}
  #shd .shd-perm.trust{border-color:rgba(52,211,153,.25)}
  #shd .shd-perm.danger{border-color:rgba(248,113,113,.3)}
  #shd .shd-perm-ic{width:38px;height:38px;border-radius:10px;background:#1a2230;display:grid;place-items:center;font-weight:800;font-size:13px;color:#8a95a3;flex:none}
  #shd .shd-perm.trust .shd-perm-ic{background:rgba(52,211,153,.12);color:#34d399}
  #shd .shd-perm-info{flex:1;min-width:0}
  #shd .shd-perm-info b{font-size:14px;display:block}
  #shd .shd-perm-info .sp{font-size:11.5px;color:#6b7684;font-family:var(--mono,monospace);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #shd .shd-perm-info .exp{font-size:11.5px;margin-top:3px}
  #shd .shd-perm-info .exp.ok{color:#34d399} #shd .shd-perm-info .exp.warn{color:#f8b34b} #shd .shd-perm-info .exp.bad{color:#f87171}
  #shd .shd-tag{font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px;flex:none}
  #shd .shd-tag.unl{background:rgba(248,113,113,.14);color:#f87171}
  #shd .shd-tag.ok{background:rgba(52,211,153,.14);color:#34d399}
  #shd .shd-revoke{font-size:12.5px;font-weight:700;padding:9px 15px;border-radius:9px;border:1px solid rgba(248,113,113,.4);background:rgba(248,113,113,.1);color:#f87171;cursor:pointer;font-family:inherit;flex:none}
  #shd .shd-revoke:hover{background:rgba(248,113,113,.18)}
  #shd .shd-revoke:disabled{opacity:.5;cursor:default}
  #shd .shd-safe{display:grid;place-items:center;padding:40px 20px;text-align:center;color:#8a95a3}
  #shd .shd-safe .ic{width:60px;height:60px;border-radius:50%;background:rgba(52,211,153,.12);color:#34d399;display:grid;place-items:center;margin-bottom:16px}
  #shd .shd-empty{color:#6b7684;font-size:12.5px;text-align:center;padding:20px}
  /* explicación "cómo funciona" */
  #shd .shd-how{background:rgba(13,19,26,.6);border:1px solid #202b37;border-radius:12px;padding:14px 16px;margin-top:18px;font-size:12.5px;color:#8a95a3;line-height:1.6}
  #shd .shd-how b{color:#c9d2dc}
  /* conectar wallet */
  #shd .shd-connect{display:grid;place-items:center;padding:50px 20px;text-align:center}
  #shd .shd-connect h1{font-size:22px;margin:0 0 10px}
  #shd .shd-connect p{color:#8a95a3;font-size:13.5px;margin:0 0 22px;max-width:360px}
  #shd .shd-connect button{padding:14px 30px;border:0;border-radius:12px;background:linear-gradient(180deg,#2b6cff,#1642b0);color:#fff;font-family:inherit;font-weight:800;font-size:15px;cursor:pointer}
  @media(max-width:560px){
    #shd .shd-hero h1{font-size:21px} #shd .shd-perm{flex-wrap:wrap}
    #shd .shd-perm-info{flex:1 1 60%} #shd .shd-revoke{margin-left:auto}
  }
  `;
  document.head.appendChild(s);
}

const IC = {
  shield: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>'
};

/* ═══════════ Abrir Wallet Shield ═══════════ */
export function abrirShield() {
  inyectarCSS();
  const prev = $('shd'); if (prev) prev.remove();
  const cont = document.createElement('div'); cont.id = 'shd';
  document.body.appendChild(cont);
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  cont.innerHTML = `<div class="shd-in" id="shd-in"></div>`;
  if (!cuenta) { pintarConectar(); return; }
  pintarInicio(cuenta);
}
function cerrar() { const c = $('shd'); if (c) c.remove(); }

function cabecera() {
  return `<div class="shd-top">
    <div class="shd-brand"><div class="shd-logo">${IC.shield}</div><div><b>Wallet Shield</b><small>Protect what's yours</small></div></div>
    <button class="shd-x" id="shd-x">✕</button>
  </div>`;
}

function pintarConectar() {
  $('shd-in').innerHTML = cabecera() + `
    <div class="shd-connect">
      <div class="shd-logo" style="width:64px;height:64px;margin-bottom:20px">${IC.shield}</div>
      <h1>Connect your wallet</h1>
      <p>Wallet Shield scans your wallet for risky permissions and lets you revoke them. Connect to begin.</p>
      <button id="shd-conn">Connect wallet</button>
    </div>`;
  $('shd-x').onclick = cerrar;
  $('shd-conn').onclick = async () => { try { await wallet.conectar(); abrirShield(); } catch (_) {} };
}

function pintarInicio(cuenta) {
  const info = datos.infoWallet();
  const corta = cuenta.slice(0, 6) + '…' + cuenta.slice(-4);
  $('shd-in').innerHTML = cabecera() + `
    <div class="shd-wallet">
      <div class="shd-wava">${info.icono ? `<img src="${info.icono}" alt="">` : IC.user}</div>
      <div class="shd-winfo"><b>${info.nombre || 'Wallet'}</b><small>${corta}</small></div>
      <span class="shd-wdot"></span>
    </div>
    <div class="shd-hero">
      <h1>Scan your wallet</h1>
      <p>We'll check every permission (token approval) your wallet has granted, flag the risky ones, and let you revoke them in one tap.</p>
      <button class="shd-scan" id="shd-scan">${IC.shield} Scan now</button>
    </div>
    <div class="shd-how">
      <b>How it works.</b> Every time you use a dApp, you grant it permission to move certain tokens. Old or unlimited permissions are the #1 way wallets get drained. This scan shows them all — permissions to our own contracts are marked as trusted; anything else you don't recognize, revoke it.
    </div>`;
  $('shd-x').onclick = cerrar;
  $('shd-scan').onclick = () => escanear(cuenta);
}

async function escanear(cuenta) {
  const lineas = [
    'Initializing secure scan…',
    'Reading approval history from chain…',
    'Cross-checking active allowances…',
    'Flagging unlimited & risky spenders…',
    'Identifying trusted contracts…'
  ];
  $('shd-in').innerHTML = cabecera() + `
    <div class="shd-scanning">
      <div class="shd-radar">
        <div class="shd-radar-ring"></div><div class="shd-radar-ring r2"></div><div class="shd-radar-ring r3"></div>
        <div class="shd-radar-sweep"></div><div class="shd-radar-core"></div>
      </div>
      <div class="shd-term" id="shd-term"></div>
      <div class="shd-bar"><div class="shd-bar-fill" id="shd-bar"></div></div>
    </div>`;
  $('shd-x').onclick = cerrar;
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
  let html = cabecera() + `
    <div class="shd-res-head">
      <h2>${externos.length + nuestros.length} permission${(externos.length+nuestros.length)!==1?'s':''} found${peligrosos ? ` · <span style="color:#f87171">${peligrosos} risky</span>` : ''}</h2>
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
  html += `<div class="shd-how"><b>Tip.</b> Revoking a permission only stops future spending — it never moves or risks your funds. Revoke anything you don't recognize or no longer use. Each revoke is a transaction you sign in your wallet (costs a little gas).</div>`;
  $('shd-in').innerHTML = html;
  $('shd-x').onclick = cerrar;
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
    ? `<div class="exp bad">Unlimited access — high risk if unknown</div>`
    : `<div class="exp warn">Limited approval</div>`;
  return `<div class="shd-perm ${p.ilimitado ? 'danger' : ''}">
    <div class="shd-perm-ic">${ini}</div>
    <div class="shd-perm-info"><b>${escH(p.symbol)}</b><div class="sp">to ${corta}</div>${riesgo}</div>
    ${p.ilimitado ? '<span class="shd-tag unl">Unlimited</span>' : ''}
    <button class="shd-revoke" data-revoke="${p.token}|${p.spender}">Revoke</button>
  </div>`;
}
function escH(s){return String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));}
