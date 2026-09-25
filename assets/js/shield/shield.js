/* shield.js — Wallet Shield: seguridad de la wallet del usuario.
   Fase 1: escáner de permisos (approvals). Detecta la wallet conectada,
   escanea, y muestra los permisos en 2 grupos (nuestros = confiables /
   externos = con riesgo y opción de revocar). Diseño dark profesional. */
import * as datos from './shield-datos.js?v=4';
import * as wallet from '../wallet.js?v=125';
import { calcularScore } from './shield-score.js?v=1';
import * as sim from './shield-sim.js?v=1';
import * as rescue from './shield-rescue.js?v=1';

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
  #shd #shd-fx{position:fixed;inset:0;z-index:0;pointer-events:none;width:100%;height:100%}
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
    /* Cinta de wallet mejorada */
  #shd .shd-wallet{display:flex;align-items:stretch;background:rgba(14,19,25,.78);border:1px solid #1c232b;border-radius:14px;padding:0;margin-bottom:18px;overflow:hidden}
  #shd .shd-wcell{flex:1;display:flex;align-items:center;gap:11px;padding:15px 18px;min-width:0}
  #shd .shd-wcenter,#shd .shd-wright{flex-direction:column;align-items:flex-start;gap:3px;justify-content:center}
  #shd .shd-wright{align-items:flex-end}
  #shd .shd-wcell small{font-size:11px;color:#79838f}
  #shd .shd-wcell b{font-size:13.5px;font-weight:700}
  #shd .shd-wcenter b,#shd .shd-wright b{font-size:13px}
  #shd .shd-wava{width:38px;height:38px;border-radius:50%;background:#12161c;display:grid;place-items:center;flex:none;color:var(--gold,#E8B84B)}
  #shd .shd-wava svg{width:24px;height:24px} #shd .shd-wava img{width:26px;height:26px;border-radius:6px;object-fit:cover}
  #shd .shd-winfo{min-width:0}
  #shd .shd-winfo b{font-size:14px;display:block}
  #shd .shd-winfo small{font-size:12px;color:#79838f;font-family:var(--mono,monospace);display:flex;align-items:center;gap:6px}
  #shd .shd-copy{background:none;border:0;color:#79838f;cursor:pointer;padding:2px;display:inline-flex}
  #shd .shd-copy:hover{color:var(--gold,#E8B84B)}
  #shd .shd-wsep{width:1px;align-self:center;height:44px;background:linear-gradient(180deg,transparent,#29313b 30%,#29313b 70%,transparent);flex:none}
  /* Botones uniformes */
  #shd .shd-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px}
  #shd .shd-btns .shd-btn{margin-top:0;padding:14px 26px;flex:0 1 auto;min-width:150px}
  #shd .shd-btn-ghost{background:rgba(255,255,255,.03)!important;border:1px solid #29313b!important;color:#eaecef!important;box-shadow:none!important}
  #shd .shd-btn-ghost:active{transform:translateY(2px)!important}
  #shd .shd-btn-ghost svg{stroke:var(--gold,#E8B84B)}
  /* Cards explicativas */
  #shd .shd-cards{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:24px}
  #shd .shd-card{background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:14px;padding:16px}
  #shd .shd-card-ic{width:38px;height:38px;border-radius:10px;background:rgba(232,184,75,.1);color:var(--gold,#E8B84B);display:grid;place-items:center;margin-bottom:11px}
  #shd .shd-card-ic svg{width:20px;height:20px;stroke:currentColor}
  #shd .shd-card b{font-size:14px;display:block;margin-bottom:5px}
  #shd .shd-card span{font-size:12px;color:#a7b0bb;line-height:1.5;display:block}
  #shd .shd-card-red{border-color:rgba(246,70,93,.25)}
  #shd .shd-card-red .shd-card-ic{background:rgba(246,70,93,.12);color:#f6465d}
  #shd .shd-card-btn{margin-top:12px;width:100%;padding:9px;border:1px solid rgba(246,70,93,.4);border-radius:9px;background:rgba(246,70,93,.08);color:#f6465d;font-family:inherit;font-weight:700;font-size:12px;cursor:pointer}
  #shd .shd-card-btn:hover{background:rgba(246,70,93,.16)}
  
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
    /* Emergency Kill Switch */
  #shd .shd-emerg{display:inline-flex;align-items:center;gap:8px;padding:11px 22px;border:1px solid rgba(246,70,93,.4);border-radius:12px;background:rgba(246,70,93,.08);color:#f6465d;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
  #shd .shd-emerg:hover{background:rgba(246,70,93,.15)}
  #shd .shd-emerg svg{stroke:currentColor}
  #shd .shd-resc{max-width:560px;margin:0 auto;padding:10px 0}
  #shd .shd-resc-icon{width:56px;height:56px;border-radius:50%;background:rgba(246,70,93,.12);color:#f6465d;display:grid;place-items:center;margin:0 auto 16px}
  #shd .shd-resc-icon svg{width:26px;height:26px}
  #shd .shd-resc-h{font-size:22px;font-weight:800;text-align:center;margin:0 0 10px}
  #shd .shd-resc-p{font-size:13px;color:#a7b0bb;text-align:center;line-height:1.6;margin:0 0 18px}
  #shd .shd-resc-warn{background:rgba(246,70,93,.07);border:1px solid rgba(246,70,93,.22);border-radius:11px;padding:13px 15px;font-size:12.5px;color:#e0b3b8;line-height:1.55;margin-bottom:18px}
  #shd .shd-resc-warn b{color:#f6465d}
  #shd .shd-resc-dest{font-size:13px;color:#a7b0bb;text-align:center;margin:16px 0 12px}
  #shd .shd-resc-dest b{color:var(--gold,#E8B84B);font-family:var(--mono,monospace)}
  #shd .shd-resc-items{display:flex;flex-direction:column;gap:8px}
  #shd .shd-resc-item{display:flex;align-items:center;gap:12px;background:rgba(14,19,25,.78);border:1px solid #1c232b;border-radius:12px;padding:11px 14px}
  #shd .shd-resc-st{font-size:12px;font-weight:700;color:#79838f;flex:none}
  #shd .shd-resc-st.going{color:#e8b84b} #shd .shd-resc-st.done{color:#2ebd85} #shd .shd-resc-st.skip{color:#f6465d}
  #shd .shd-btn-danger{background:linear-gradient(180deg,#ff6b7d,#f6465d 55%,#d12d43)!important;border-color:#d12d43!important;color:#fff!important;box-shadow:0 5px 0 #8f1f2e!important}
  #shd .shd-btn-danger:active{box-shadow:0 2px 0 #8f1f2e!important}
  #shd .shd-resc-note{font-size:12px;color:#79838f;text-align:center;margin-top:12px;line-height:1.5}
  
      /* Resultados premium: hero del score */
  #shd .shd-hero-score{display:flex;align-items:center;gap:26px;background:linear-gradient(135deg,rgba(20,26,33,.9),rgba(10,14,18,.9));border:1px solid #1c232b;border-radius:18px;padding:24px 26px;margin-bottom:16px}
  #shd .shd-score-ring{position:relative;flex:none;width:150px;height:150px}
  #shd .shd-score-mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
  #shd .shd-score-n{font-size:46px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
  #shd .shd-score-max{font-size:12px;color:#79838f;margin-top:2px}
  #shd .shd-score-side{flex:1;min-width:0}
  #shd .shd-score-lvl{font-size:24px;font-weight:800;margin-bottom:2px}
  #shd .shd-score-sub{font-size:13px;color:#79838f;margin-bottom:18px}
  #shd .shd-score-stats{display:flex;gap:22px}
  #shd .shd-sstat b{font-size:22px;font-weight:800;display:block;line-height:1}
  #shd .shd-sstat span{font-size:11px;color:#79838f;text-transform:uppercase;letter-spacing:.4px}
  #shd .shd-factors{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
  #shd .shd-factor{font-size:12px;padding:7px 13px;border-radius:100px;display:flex;align-items:center;gap:6px;border:1px solid}
  #shd .shd-factor.ok{background:rgba(46,189,133,.08);border-color:rgba(46,189,133,.25);color:#2ebd85}
  #shd .shd-factor.warn{background:rgba(232,184,75,.08);border-color:rgba(232,184,75,.25);color:#e8b84b}
  #shd .shd-factor.bad{background:rgba(246,70,93,.08);border-color:rgba(246,70,93,.3);color:#f6465d}
  
  /* Escaneo con pasos (dramatismo) */
  #shd .shd-scan-title{text-align:center;font-size:18px;font-weight:800;margin:4px 0 18px;color:#eaecef}
  #shd .shd-steps{max-width:400px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
  #shd .shd-step{display:flex;align-items:center;gap:11px;font-size:13px;opacity:0;animation:shdStepIn .3s forwards}
  @keyframes shdStepIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
  #shd .shd-step-ic{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;flex:none}
  #shd .shd-step-ic.checking{background:rgba(232,184,75,.12)}
  #shd .shd-step-ic.done{background:rgba(46,189,133,.15);color:#2ebd85}
  #shd .shd-step-tx{color:#a7b0bb}
  #shd .shd-spin{width:11px;height:11px;border:2px solid rgba(232,184,75,.3);border-top-color:var(--gold,#E8B84B);border-radius:50%;animation:shdSpin .6s linear infinite}
  @keyframes shdSpin{to{transform:rotate(360deg)}}
  #shd .shd-blip.b5{top:18%;left:52%;animation:shdBlip 1.4s ease-in-out .5s infinite}
  #shd .shd-blip.b6{top:52%;left:16%;animation:shdBlip 1.4s ease-in-out .9s infinite}
  #shd .shd-res-btns{display:flex;gap:8px}
  
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
    #shd .shd-hero-score{flex-direction:column;text-align:center} #shd .shd-score-stats{justify-content:center} #shd .shd-wallet{flex-direction:column} #shd .shd-wsep{width:auto;height:1px;align-self:stretch;background:linear-gradient(90deg,transparent,#29313b 30%,#29313b 70%,transparent)}
    #shd .shd-wright{align-items:flex-start} #shd .shd-cards{grid-template-columns:1fr}
    #shd .shd-btns .shd-btn{flex:1 1 100%}
  }
  `;
  document.head.appendChild(s);
}

const IC = {
  shield: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  alert: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check2: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#2ebd85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
};

/* ═══════════ Abrir Wallet Shield ═══════════ */
export function abrirShield() {
  inyectarCSS();
  const prev = $('shd'); if (prev) prev.remove();
  const cont = document.createElement('div'); cont.id = 'shd';
  document.body.appendChild(cont);
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  cont.innerHTML = `<canvas id="shd-fx" aria-hidden="true"></canvas><div id="shd-barslot"></div><div class="shd-in" id="shd-in"></div>`;
  montarParticulas();
  if (!cuenta) { pintarConectar(); return; }
  pintarInicio(cuenta);
}
async function montarParticulas() {
  try {
    const quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieto) return;
    const lienzo = document.getElementById('shd-fx'); if (!lienzo) return;
    const mod = await import('../../portada/chispas.js?v=200');
    if (mod.brasas) {
      mod.brasas(lienzo);
      const remedir = () => { if (mod.brasas._remedir) mod.brasas._remedir(); };
      [50, 200, 500, 1000].forEach((t) => setTimeout(remedir, t));
    }
  } catch (_) {}
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
      <div class="shd-wcell">
        <div class="shd-wava">${info.iconoHTML || IC.user}</div>
        <div class="shd-winfo"><b>${info.nombre || 'Wallet'}</b><small>${corta} <button class="shd-copy" id="shd-copy" title="Copy address">${IC.copy}</button></small></div>
      </div>
      <div class="shd-wsep"></div>
      <div class="shd-wcell shd-wcenter">
        <small>Network</small><b>BNB Smart Chain</b>
      </div>
      <div class="shd-wsep"></div>
      <div class="shd-wcell shd-wright">
        <small>Total balance</small><b id="shd-bal">…</b>
      </div>
    </div>
    <div class="shd-hero">
      <h1>Scan your wallet</h1>
      <p>Check every permission your wallet has granted, get a security score, and revoke anything risky in one tap.</p>
      <div class="shd-btns">
        <button class="shd-btn" id="shd-scan">${IC.shield} Scan</button>
        <button class="shd-btn shd-btn-ghost" id="shd-sim">${IC.search} Check contract</button>
      </div>
    </div>
    <div class="shd-cards">
      <div class="shd-card"><div class="shd-card-ic">${IC.shield}</div><b>Permission scan</b><span>See every approval your wallet gave and revoke the risky ones.</span></div>
      <div class="shd-card"><div class="shd-card-ic">${IC.search}</div><b>Contract check</b><span>Paste any contract before you sign and we tell you if it's safe.</span></div>
      <div class="shd-card shd-card-red"><div class="shd-card-ic">${IC.alert}</div><b>Emergency evacuation</b><span>If your wallet is at risk, move all your tokens to a safe wallet fast.</span><button class="shd-card-btn" id="shd-emerg">Open emergency tool</button></div>
    </div>`;
  wireBack();
  $('shd-scan').onclick = () => escanear(cuenta);
  $('shd-sim').onclick = () => pintarSimulador(cuenta);
  $('shd-emerg').onclick = () => pintarRescate(cuenta);
  const cp = $('shd-copy'); if (cp) cp.onclick = async () => { const ok = await datos.copiar(cuenta); cp.innerHTML = ok ? IC.check2 : IC.copy; setTimeout(() => { cp.innerHTML = IC.copy; }, 1400); };
  // saldo (async)
  datos.saldoTotalUSD(cuenta).then(b => { const e = $('shd-bal'); if (e) e.textContent = b; });
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
function pintarRescate(cuenta) {
  $('shd-barslot').innerHTML = cabecera();
  $('shd-in').innerHTML = `
    <div class="shd-resc">
      <div class="shd-resc-icon">${IC.alert}</div>
      <h1 class="shd-resc-h">Emergency evacuation</h1>
      <p class="shd-resc-p">This moves your tokens to a safe wallet you choose. Use it if your wallet may be compromised, or to migrate to a new one. You sign every transfer yourself. We never touch your keys or your funds.</p>
      <div class="shd-resc-warn">
        <b>Before you start:</b> make sure the destination wallet is one you fully control and its seed phrase is safe. Transfers on the blockchain cannot be undone. A little BNB (~${rescue.reservaGasFmt}) stays behind to pay for gas.
      </div>
      <label class="shd-sim-lbl">Safe destination wallet</label>
      <input class="shd-sim-in" id="resc-dest" placeholder="0x… your safe wallet address" autocomplete="off" spellcheck="false">
      <button class="shd-btn" id="resc-scan" style="width:100%;margin-top:16px">${IC.search} Find my assets</button>
      <div id="resc-list"></div>
      <button class="shd-rescan" id="resc-back" style="margin-top:18px">Back</button>
    </div>`;
  wireBack();
  $('resc-back').onclick = () => pintarInicio(cuenta);
  $('resc-scan').onclick = async () => {
    const dest = $('resc-dest').value.trim();
    const cont = $('resc-list');
    if (!rescue.esDireccion(dest)) { cont.innerHTML = `<div class="shd-sim-msg bad">Enter a valid destination address (0x…)</div>`; return; }
    if (dest.toLowerCase() === cuenta.toLowerCase()) { cont.innerHTML = `<div class="shd-sim-msg bad">The destination must be a DIFFERENT wallet.</div>`; return; }
    cont.innerHTML = `<div class="shd-sim-loading"><div style="color:#a7b0bb;font-size:13px">Finding your assets…</div></div>`;
    try {
      const act = await rescue.detectarActivos(cuenta);
      pintarActivos(cuenta, dest, act);
    } catch (e) { cont.innerHTML = `<div class="shd-sim-msg bad">Could not read your assets. Try again.</div>`; }
  };
}
function pintarActivos(cuenta, dest, act) {
  const cont = $('resc-list');
  const tieneNativo = act.nativo > 0n;
  const items = act.tokens.map((t, i) => `
    <div class="shd-resc-item" id="rescit-${i}">
      <div class="shd-perm-ic">${(t.symbol||'?').slice(0,3).toUpperCase()}</div>
      <div class="shd-perm-info"><b>${escH(t.symbol)}</b><div class="sp">${(+t.balanceFmt).toLocaleString(undefined,{maximumFractionDigits:6})}</div></div>
      <span class="shd-resc-st" id="rescst-${i}">Ready</span>
    </div>`).join('');
  const nativoItem = tieneNativo ? `
    <div class="shd-resc-item" id="rescit-bnb">
      <div class="shd-perm-ic">BNB</div>
      <div class="shd-perm-info"><b>BNB</b><div class="sp">${(+require0(act.nativo)).toLocaleString(undefined,{maximumFractionDigits:6})} (minus gas)</div></div>
      <span class="shd-resc-st" id="rescst-bnb">Ready</span>
    </div>` : '';
  if (!act.tokens.length && !tieneNativo) {
    cont.innerHTML = `<div class="shd-safe" style="padding:30px"><div class="ic">${IC.check}</div><p style="margin:0">No assets with balance found in this wallet.</p></div>`;
    return;
  }
  const corta = dest.slice(0,6)+'…'+dest.slice(-4);
  cont.innerHTML = `
    <div class="shd-resc-dest">Moving everything to <b>${corta}</b></div>
    <div class="shd-resc-items">${items}${nativoItem}</div>
    <button class="shd-btn shd-btn-danger" id="resc-go" style="width:100%;margin-top:16px">Move all to safety (${act.tokens.length + (tieneNativo?1:0)} transfers)</button>
    <div class="shd-resc-note">You will sign each transfer in your wallet, one by one. Keep confirming until all are done.</div>`;
  $('resc-go').onclick = async () => {
    const btn = $('resc-go'); btn.disabled = true; btn.textContent = 'Moving… confirm in your wallet';
    // mover tokens uno por uno
    for (let i = 0; i < act.tokens.length; i++) {
      const st = $('rescst-'+i);
      if (st) { st.textContent = 'Signing…'; st.className = 'shd-resc-st going'; }
      try { await rescue.moverToken(act.tokens[i].address, dest, act.tokens[i].balance); if (st){st.textContent='Moved ✓';st.className='shd-resc-st done';} }
      catch (e) { if (st){st.textContent='Skipped';st.className='shd-resc-st skip';} }
    }
    // mover el nativo al final (necesita gas para lo anterior)
    if (act.nativo > 0n) {
      const st = $('rescst-bnb');
      if (st) { st.textContent = 'Signing…'; st.className = 'shd-resc-st going'; }
      try { await rescue.moverNativo(dest, act.nativo); if (st){st.textContent='Moved ✓';st.className='shd-resc-st done';} }
      catch (e) { if (st){st.textContent='Skipped';st.className='shd-resc-st skip';} }
    }
    btn.textContent = 'Done'; btn.disabled = true;
  };
}
function require0(wei) { try { return (Number(wei) / 1e18).toString(); } catch(_) { return '0'; } }
async function escanear(cuenta) {
  // Pasos del escaneo: cada uno aparece, muestra "checking…" y luego se marca ✓.
  const pasos = [
    'Connecting to BNB Smart Chain',
    'Reading your approval history',
    'Checking active token allowances',
    'Detecting unlimited permissions',
    'Scanning for known drainer addresses',
    'Verifying spender contracts',
    'Matching trusted Cripto Cuba contracts',
    'Calculating your security score'
  ];
  $('shd-barslot').innerHTML = cabecera();
  $('shd-in').innerHTML = `
    <div class="shd-scanning">
      <div class="shd-radar">
        <div class="shd-radar-ring"></div><div class="shd-radar-ring r2"></div><div class="shd-radar-ring r3"></div>
        <div class="shd-radar-grid"></div>
        <div class="shd-radar-sweep"></div><div class="shd-radar-core"></div>
        <span class="shd-blip b1"></span><span class="shd-blip b2"></span><span class="shd-blip b3"></span><span class="shd-blip b4"></span><span class="shd-blip b5"></span><span class="shd-blip b6"></span>
      </div>
      <div class="shd-scan-title">Scanning your wallet…</div>
      <div class="shd-steps" id="shd-steps"></div>
      <div class="shd-bar-pr"><div class="shd-bar-fill" id="shd-bar"></div></div>
    </div>`;
  wireBack();
  const cont = $('shd-steps');
  // lanzar el escaneo real en paralelo
  let permisos = null, error = false;
  const tarea = datos.escanearApprovals(cuenta, () => {}).then(r => { permisos = r; }).catch(() => { error = true; });
  // animar los pasos: cada uno aparece como "checking" y tras un momento se marca ✓
  let i = 0;
  function siguientePaso() {
    if (i >= pasos.length) return;
    const idx = i;
    const row = document.createElement('div'); row.className = 'shd-step'; row.id = 'step-' + idx;
    row.innerHTML = `<span class="shd-step-ic checking" id="stic-${idx}"><span class="shd-spin"></span></span><span class="shd-step-tx">${pasos[idx]}</span>`;
    cont.appendChild(row);
    const bar = $('shd-bar'); if (bar) bar.style.width = Math.round(((idx + 1) / pasos.length) * 100) + '%';
    i++;
    // marcar ✓ tras un momento y pasar al siguiente
    setTimeout(() => {
      const ic = $('stic-' + idx);
      if (ic) { ic.className = 'shd-step-ic done'; ic.innerHTML = '✓'; }
      siguientePaso();
    }, 480 + Math.random() * 320);
  }
  siguientePaso();
  // esperar a que TERMINEN los pasos Y el escaneo real, luego mostrar resultados
  const minTiempo = new Promise(r => setTimeout(r, pasos.length * 700));
  await Promise.all([tarea, minTiempo]);
  // un último check
  const fin = document.createElement('div'); fin.className = 'shd-step'; fin.innerHTML = `<span class="shd-step-ic done">✓</span><span class="shd-step-tx" style="color:#2ebd85">Scan complete</span>`;
  if (cont) cont.appendChild(fin);
  await new Promise(r => setTimeout(r, 600));
  pintarResultados(cuenta, permisos || []);
}

function pintarResultados(cuenta, permisos) {
  const externos = permisos.filter(p => !p.nuestro);
  const nuestros = permisos.filter(p => p.nuestro);
  const peligrosos = externos.filter(p => p.ilimitado).length;
  const sc = calcularScore(permisos);
  $('shd-barslot').innerHTML = cabecera();

  // arco del score
  const pct = sc.score / 100; const circ = 283; const off = circ * (1 - pct);

  let html = `
    <div class="shd-hero-score">
      <div class="shd-score-ring">
        <svg viewBox="0 0 110 110" width="150" height="150">
          <circle cx="55" cy="55" r="45" fill="none" stroke="#12161c" stroke-width="9"/>
          <circle cx="55" cy="55" r="45" fill="none" stroke="${sc.color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${off}" transform="rotate(-90 55 55)" style="transition:stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)"/>
        </svg>
        <div class="shd-score-mid"><div class="shd-score-n" style="color:${sc.color}">${sc.score}</div><div class="shd-score-max">/ 100</div></div>
      </div>
      <div class="shd-score-side">
        <div class="shd-score-lvl" style="color:${sc.color}">${sc.nivel}</div>
        <div class="shd-score-sub">Wallet security score</div>
        <div class="shd-score-stats">
          <div class="shd-sstat"><b>${externos.length + nuestros.length}</b><span>permissions</span></div>
          <div class="shd-sstat"><b style="color:${peligrosos?'#f6465d':'#2ebd85'}">${peligrosos}</b><span>risky</span></div>
          <div class="shd-sstat"><b style="color:#2ebd85">${nuestros.length}</b><span>trusted</span></div>
        </div>
      </div>
    </div>`;

  // factores del score como fila de chips
  if (sc.factores.length) {
    html += `<div class="shd-factors">` + sc.factores.map(f => {
      const cls = f.tipo === 'ok' ? 'ok' : (f.tipo === 'warn' ? 'warn' : 'bad');
      const ic = f.tipo === 'ok' ? '✓' : (f.tipo === 'warn' ? '!' : '✕');
      return `<div class="shd-factor ${cls}" title="${escH(f.detalle)}"><span>${ic}</span> ${escH(f.texto)}</div>`;
    }).join('') + `</div>`;
  }
  if (sc.consejos.length) html += `<div class="shd-consejo" style="margin:0 0 18px">💡 ${escH(sc.consejos[0])}</div>`;

  html += `<div class="shd-res-head">
      <h2>Permissions</h2>
      <div class="shd-res-btns"><button class="shd-rescan" id="shd-back2">Back</button><button class="shd-rescan" id="shd-rescan">Scan again</button></div>
    </div>`;

  if (permisos.length === 0) {
    html += `<div class="shd-safe"><div class="ic">${IC.check}</div><h2 style="margin:0 0 6px;color:#eaecef">Your wallet is clean</h2><p style="margin:0">No active permissions found. Nothing to revoke.</p></div>`;
  } else {
    if (externos.length) { html += `<div class="shd-group-t risk">${escH('⚠')} External permissions</div>` + externos.map(filaPerm).join(''); }
    if (nuestros.length) { html += `<div class="shd-group-t trust">✓ Trusted · Cripto Cuba</div>` + nuestros.map(filaPerm).join(''); }
  }
  html += `<div class="shd-how"><b>Tip.</b> Revoking a permission only stops future spending. It never moves or risks your funds. Revoke anything you don't recognize or no longer use. Each revoke is a transaction you sign in your wallet.</div>`;

  $('shd-in').innerHTML = html;
  wireBack();
  const bb = $('shd-back2'); if (bb) bb.onclick = () => pintarInicio(cuenta);
  $('shd-rescan').onclick = () => escanear(cuenta);
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
