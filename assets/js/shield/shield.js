/* shield.js — Wallet Shield: seguridad de la wallet del usuario.
   Fase 1: escáner de permisos (approvals). Detecta la wallet conectada,
   escanea, y muestra los permisos en 2 grupos (nuestros = confiables /
   externos = con riesgo y opción de revocar). Diseño dark profesional. */
import * as datos from './shield-datos.js?v=113';
import * as wallet from '../wallet.js?v=129';
import { calcularScore } from './shield-score.js?v=100';
import { plataformasDe } from './shield-platforms.js?v=1';
import * as sim from './shield-sim.js?v=99';
import * as rescue from './shield-rescue.js?v=100';
import * as watch from './shield-watch.js?v=122';
import * as tron from './shield-tron.js?v=16';
import * as hashmod from './shield-hash.js?v=2';
import * as poison from './shield-poison.js?v=2';
import * as pago from './shield-pago.js?v=1';

const $ = (id) => document.getElementById(id);
let _css = false;

/* ═══════════ CSS ═══════════ */
function inyectarCSS() {
  if (_css) return; _css = true;
  const s = document.createElement('style'); s.id = 'shd-css';
  s.textContent = `
  #shd{position:fixed;top:0;left:0;right:0;bottom:0;height:100dvh;max-height:100dvh;z-index:400;display:flex;flex-direction:column;color:#eaecef;font-family:var(--display,'Segoe UI',sans-serif);
    background:#000 url('assets/portada/img/fondo-shield.webp') center/cover no-repeat;overflow-y:auto;-webkit-overflow-scrolling:touch}
  #shd::before{content:'';position:fixed;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.78),rgba(3,5,8,.93));z-index:0;pointer-events:none}
  #shd #shd-fx{position:fixed;inset:0;z-index:0;pointer-events:none;width:100%;height:100%;will-change:transform}
  #shd *{box-sizing:border-box}
  /* Barra superior tipo sección interna (back a la izquierda) */
  #shd .shd-bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;padding:calc(12px + env(safe-area-inset-top,0px)) 18px 12px;background:rgba(5,7,9,.4);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid #1c232b;position:relative;z-index:3}
  #shd .shd-bar{position:relative;overflow:hidden}
  #shd .shd-bar::before{content:'';position:absolute;inset:0;z-index:-1;background-image:url('assets/portada/img/header.webp');background-size:cover;background-position:center;opacity:.55;-webkit-mask-image:linear-gradient(180deg,#000,rgba(0,0,0,.6));mask-image:linear-gradient(180deg,#000,rgba(0,0,0,.6))}
  #shd .shd-back{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.04);border:1px solid #29313b;color:#a7b0bb;border-radius:10px;padding:9px 14px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600}
  #shd .shd-back:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #shd .shd-bar-t{font-size:15px;font-weight:800;letter-spacing:.2px}
  #shd .shd-bar-t span{color:var(--gold,#E8B84B)}
  #shd .shd-in{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;position:relative;z-index:1;width:100%;max-width:820px;margin:0 auto;padding:22px 16px calc(40px + env(safe-area-inset-bottom,0px));position:relative;z-index:2}
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
            /* Banner de gas de emergencia en la evacuación */
  #shd .shd-resc-gas{background:linear-gradient(135deg,rgba(90,200,180,.1),rgba(90,200,180,.03));border:1px solid rgba(90,200,180,.3);border-radius:13px;padding:15px 16px;margin-bottom:14px}
  #shd .shd-resc-gas-t{font-size:14px;font-weight:700;color:#4ec8b4;display:flex;align-items:center;gap:8px;margin-bottom:7px}
  #shd .shd-resc-gas-t svg{stroke:#4ec8b4}
  #shd .shd-resc-gas-s{font-size:12.5px;color:#a7b0bb;line-height:1.5;margin-bottom:12px}
  #shd .shd-resc-gas-btn{padding:10px 18px;border:1px solid rgba(90,200,180,.5);border-radius:10px;background:rgba(90,200,180,.12);color:#4ec8b4;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
  #shd .shd-resc-gas-btn:hover{background:rgba(90,200,180,.2)}
  #shd .shd-resc-gas-msg{font-size:12.5px;margin-top:10px;min-height:16px}
  
  /* Faucet de gas */
  #shd .shd-card-gas{border-color:rgba(90,200,180,.22)}
  #shd .shd-card-gas .shd-card-ic{background:rgba(90,200,180,.1);color:#4ec8b4}
  #shd .shd-card-btn.gas{border-color:rgba(90,200,180,.4);background:rgba(90,200,180,.08);color:#4ec8b4}
  #shd .shd-card-btn.gas:hover{background:rgba(90,200,180,.16)}
  #shd .shd-faucet-wrap{max-width:520px;margin:0 auto;padding:10px 0;text-align:center}
  #shd .shd-faucet-icon{width:56px;height:56px;border-radius:50%;background:rgba(232,184,75,.1);color:var(--gold,#E8B84B);display:grid;place-items:center;margin:0 auto 14px}
  #shd .shd-faucet-hero h1{font-size:22px;font-weight:800;margin:0 0 10px}
  #shd .shd-faucet-hero p{font-size:13px;color:#a7b0bb;line-height:1.6;margin:0 0 20px}
  #shd .shd-faucet-box{background:linear-gradient(135deg,rgba(20,26,33,.9),rgba(10,14,18,.9));border:1px solid #1c232b;border-radius:16px;padding:24px 22px}
  #shd .shd-faucet-loading{color:#a7b0bb;font-size:13px;padding:20px}
  #shd .shd-faucet-amount{font-size:32px;font-weight:900;color:var(--gold,#E8B84B);line-height:1;text-shadow:0 2px 8px rgba(232,184,75,.25)}
  #shd .shd-faucet-sub{font-size:12.5px;color:#79838f;margin-top:8px}
  #shd .shd-faucet-msg{font-size:13px;margin-top:14px;min-height:18px}
  #shd .shd-faucet-pool{font-size:11.5px;color:#5f6b7a;margin-top:16px;padding-top:14px;border-top:1px solid #161f2b}
  #shd .shd-faucet-wait-ic{font-size:32px;margin-bottom:10px}
  #shd .shd-faucet-wait-t{font-size:18px;font-weight:800;color:#e8b84b;margin-bottom:6px}
  #shd .shd-faucet-wait-s{font-size:13px;color:#a7b0bb;line-height:1.55}
  #shd .shd-faucet-wait-s b{color:#eaecef}
  
  /* Pantalla de pago (solo BNB) */
  #shd .shd-pay-box{max-width:360px;margin:8px auto 24px;background:linear-gradient(135deg,rgba(232,184,75,.1),rgba(232,184,75,.03));border:1px solid rgba(232,184,75,.3);border-radius:16px;padding:22px 20px}
  #shd .shd-pay-label{font-size:12px;color:#a7b0bb;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
  #shd .shd-pay-amount{font-size:34px;font-weight:900;color:var(--gold,#E8B84B);line-height:1;text-shadow:0 2px 8px rgba(232,184,75,.25)}
  #shd .shd-pay-sub{font-size:12.5px;color:#79838f;margin-top:8px}
  #shd .shd-pay-msg{font-size:13px;margin-top:16px;min-height:20px}
  
  
  /* ── Adaptación a móvil ── */
  @media(max-width:640px){
    #shd .shd-in{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 12px 90px}
    #shd .shd-cards{grid-template-columns:1fr;gap:10px}
    #shd .shd-audit-hero{flex-direction:column;text-align:center;gap:16px;padding:20px 16px}
    #shd .shd-audit-side{align-items:center}
    #shd .shd-audit-badge{align-self:center}
    #shd .shd-audit-stats{justify-content:center;gap:18px;flex-wrap:wrap}
    #shd .shd-audit-comps{grid-template-columns:1fr}
    #shd .shd-found{grid-template-columns:1fr 1fr}
    #shd .shd-plat{flex-wrap:wrap;gap:10px}
    #shd .shd-plat-info{flex:1 1 100%;order:2}
    #shd .shd-plat-tag{order:3}
    #shd .shd-perm{flex-wrap:wrap}
    #shd .shd-perm-info{flex:1 1 100%;min-width:0}
    #shd .shd-perm-info .sp{word-break:break-all;font-size:11px}
    #shd .shd-res-head{flex-direction:column;align-items:stretch;gap:10px}
    #shd .shd-res-btns{display:flex;gap:8px}
    #shd .shd-res-btns .shd-rescan{flex:1}
    #shd .shd-how,#shd .shd-consejo{font-size:12px;line-height:1.55}
    #shd .shd-scan-other{flex-direction:column}
    #shd .shd-scan-other-go{width:100%}
    #shd .shd-portada{padding:8px 12px 80px}
    #shd .shd-hash-grid{grid-template-columns:1fr}
    #shd .shd-hash-fromto{flex-direction:column}
    #shd .shd-poison-drow{flex-direction:column;align-items:stretch;gap:10px}
    #shd .shd-poison-daddr{word-break:break-all;font-size:11px}
    #shd .shd-faucet-wrap{padding-bottom:80px}
  }
  
  /* Banner superior con mármol dorado (header.webp), como los bots */
  #shd #shd-header-banner{position:fixed;top:0;left:0;right:0;height:300px;z-index:0;will-change:transform;pointer-events:none;opacity:.8;background-image:url('assets/portada/img/header.webp');background-size:cover;background-position:center top;-webkit-mask-image:linear-gradient(180deg,#000 0,#000 45%,transparent 100%);mask-image:linear-gradient(180deg,#000 0,#000 45%,transparent 100%)}
  /* Portada de Wallet Shield (según plantilla) */
  #shd .shd-portada{max-width:860px;margin:0 auto;padding:8px 16px 30px;text-align:center}
  #shd .shd-portada-hero{display:block;margin:0 auto 2px;max-width:200px;width:48%;height:auto}
  #shd .shd-portada-title{font-size:clamp(24px,4.2vw,38px);font-weight:900;margin:0 0 14px;letter-spacing:-.5px;text-shadow:0 2px 0 rgba(0,0,0,.4),0 5px 14px rgba(0,0,0,.55)}
  #shd .shd-portada-title .g{color:var(--gold,#E8B84B);text-shadow:0 2px 0 rgba(120,80,0,.5),0 6px 18px rgba(232,184,75,.25)}
  #shd .shd-portada-p{font-size:14.5px;color:#c9d2dc;line-height:1.65;max-width:620px;margin:0 auto 14px}
  #shd .shd-portada-cost{font-size:13.5px;color:#a7b0bb;line-height:1.6;max-width:560px;margin:0 auto 30px}
  #shd .shd-portada-cost b{color:var(--gold,#E8B84B);font-weight:800}
  #shd .shd-portada-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:30px}
  #shd .shd-pcard{background:linear-gradient(160deg,rgba(20,26,33,.72),rgba(10,14,18,.72));border:1px solid rgba(232,184,75,.18);border-radius:14px;padding:16px 12px;transition:transform .15s ease,box-shadow .2s ease,border-color .2s ease;transform-style:preserve-3d;cursor:default}
  #shd .shd-pcard:hover{border-color:rgba(232,184,75,.4);box-shadow:0 18px 40px rgba(0,0,0,.5),0 0 0 1px rgba(232,184,75,.15)}
  #shd .shd-pcard img{width:44px;height:44px;object-fit:contain;margin-bottom:10px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.4))}
  #shd .shd-pcard b{display:block;font-size:14.5px;font-weight:700;margin-bottom:6px}
  #shd .shd-pcard span{display:block;font-size:12px;color:#8a95a3;line-height:1.5}
  /* Botón connect con imagen (zoom hover + clic) */
  #shd .shd-connect-btn{background:none;border:0;cursor:pointer;padding:0;display:inline-block;transition:transform .18s ease}
  #shd .shd-connect-btn img{max-width:240px;width:62vw;height:auto;display:block;filter:drop-shadow(0 10px 18px rgba(0,0,0,.6))}
  #shd .shd-connect-btn:hover{transform:scale(1.045)}
  #shd .shd-connect-btn:active{transform:scale(.97)}
  @media(max-width:640px){
    #shd .shd-portada-cards{grid-template-columns:1fr 1fr;gap:11px}
    #shd .shd-pcard img{width:44px;height:44px;object-fit:contain;margin-bottom:10px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.4))}
    #shd #shd-header-banner{height:220px}
  }
  
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
  #shd .shd-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}
  #shd .shd-card{background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:14px;padding:16px}
  #shd .shd-card-ic{width:38px;height:38px;border-radius:10px;background:rgba(232,184,75,.1);color:var(--gold,#E8B84B);display:grid;place-items:center;margin-bottom:11px}
  #shd .shd-card-ic svg{width:20px;height:20px;stroke:currentColor}
  #shd .shd-card b{font-size:14px;display:block;margin-bottom:5px}
  #shd .shd-card span{font-size:12px;color:#a7b0bb;line-height:1.5;display:block}
  #shd .shd-card-red{border-color:rgba(246,70,93,.25)}
  #shd .shd-card-red .shd-card-ic{background:rgba(246,70,93,.12);color:#f6465d}
  #shd .shd-card-btn{margin-top:12px;width:100%;padding:9px;border:1px solid rgba(246,70,93,.4);border-radius:9px;background:rgba(246,70,93,.08);color:#f6465d;font-family:inherit;font-weight:700;font-size:12px;cursor:pointer}
  #shd .shd-card-btn:hover{background:rgba(246,70,93,.16)}
  #shd .shd-card-btn.gold{border-color:var(--gold-md,#cf9f2e);background:linear-gradient(180deg,#f4d089,#E8B84B 55%,#cf9f2e);color:#241900}
  #shd .shd-card-btn.gold:hover{filter:brightness(1.06)}
  
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
            /* Barra de búsqueda con filtro integrado */
  #shd .shd-tok-bar{position:relative;display:flex;align-items:center;gap:10px;background:rgba(11,14,17,.72);border:1px solid #1c232b;border-radius:12px;padding:0 12px;height:46px;box-sizing:border-box}
  #shd .shd-tok-bar:focus-within{border-color:var(--gold-soft,#C9A84B)}
  #shd .shd-tok-search{flex:1;min-width:0;height:100%;background:transparent;border:0;outline:none;color:#eaecef;font-family:inherit;font-size:13px;padding:0;margin:0}
  #shd .shd-tok-fbtn{position:relative;flex:none;background:rgba(255,255,255,.04);border:1px solid #29313b;border-radius:8px;padding:6px 9px;color:#a7b0bb;cursor:pointer;display:grid;place-items:center}
  #shd .shd-tok-fbtn.active{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #shd .shd-tok-fbtn #tok-fbadge.dot{position:absolute;top:-3px;right:-3px;width:8px;height:8px;border-radius:50%;background:var(--gold,#E8B84B)}
  #shd .shd-tok-pop{position:absolute;top:calc(100% + 6px);right:0;z-index:20;background:#12161c;border:1px solid #29313b;border-radius:12px;padding:6px;min-width:210px;max-width:calc(100vw - 40px);box-shadow:0 18px 50px rgba(0,0,0,.6);display:none;flex-direction:column;gap:2px}
  #shd .shd-tok-pop.open{display:flex}
  #shd .shd-tok-popf{text-align:left;background:none;border:0;border-radius:8px;padding:10px 12px;color:#c9d2dc;font-family:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
  #shd .shd-tok-popf:hover{background:rgba(255,255,255,.04)}
  #shd .shd-tok-popf.on{background:rgba(232,184,75,.12);color:var(--gold,#E8B84B);font-weight:700}
  /* Desplegable de traders */
  #shd .shd-reco-toggle{width:100%;margin-top:10px;padding:10px;background:rgba(255,255,255,.02);border:1px solid #1c232b;border-radius:10px;color:#a7b0bb;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
  #shd .shd-reco-toggle:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #shd .shd-reco-more{max-height:280px;overflow-y:auto;margin-top:9px}
  
  /* Búsqueda y filtros de tokens */
  #shd .shd-tok-tools{margin-bottom:12px}
  #shd .shd-tok-search{flex:1;min-width:0;height:100%;background:transparent;border:0;outline:none;color:#eaecef;font-family:inherit;font-size:13px;padding:0;margin:0}
  #shd .shd-tok-search:focus{border-color:var(--gold-soft,#C9A84B)}
  #shd .shd-tok-filters{display:flex;gap:7px;flex-wrap:wrap}
  #shd .shd-tok-f{padding:7px 13px;border-radius:100px;border:1px solid #1c232b;background:rgba(255,255,255,.02);color:#a7b0bb;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer}
  #shd .shd-tok-f.on{background:rgba(232,184,75,.1);border-color:rgba(232,184,75,.35);color:var(--gold,#E8B84B)}
  #shd .shd-tok-new{font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:100px;background:rgba(90,160,232,.15);color:#6aa8f0;vertical-align:middle;margin-left:4px}
  #shd .shd-tok-new.hot{background:rgba(46,189,133,.15);color:#2ebd85}
  #shd .shd-wtok-swap{margin-left:auto;flex:none;padding:8px 16px;border:1px solid var(--gold-md,#cf9f2e);border-radius:9px;background:linear-gradient(180deg,#f4d089,#E8B84B 60%,#cf9f2e);color:#241900;font-family:inherit;font-weight:800;font-size:12.5px;cursor:pointer}
  #shd .shd-wtok-swap:hover{filter:brightness(1.06)}
  
  /* Tarjeta de token enriquecida (Watcher) */
  #shd .shd-wtok2{background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:12px;padding:12px 14px;margin-bottom:8px}
  #shd .shd-wtok-top{display:flex;align-items:center;gap:12px}
  #shd .shd-wtok-ic{width:38px;height:38px;border-radius:50%;background:#12161c;display:grid;place-items:center;font-weight:800;font-size:12px;color:#a7b0bb;flex:none;overflow:hidden}
  #shd .shd-wtok-ic img{width:100%;height:100%;object-fit:cover}
  #shd .shd-wtok-info{flex:1;min-width:0}
  #shd .shd-wtok-info b{font-size:14px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #shd .shd-wtok-bal{font-size:12.5px;color:#a7b0bb;margin-top:2px}
  #shd .shd-wtok-contract{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid #161f2b}
  #shd .shd-wtok-addr{font-size:11.5px;color:#79838f;font-family:var(--mono,monospace);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #shd .shd-wtok-copy{background:none;border:1px solid #29313b;color:#a7b0bb;border-radius:7px;padding:3px 8px;cursor:pointer;font-size:12px;flex:none}
  #shd .shd-wtok-copy:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #shd .shd-wtok-scan{font-size:11.5px;color:var(--gold,#E8B84B);text-decoration:none;border:1px solid rgba(232,184,75,.3);border-radius:7px;padding:3px 9px;flex:none}
  #shd .shd-wtok-scan:hover{background:rgba(232,184,75,.08)}
  
    /* Panel de estadísticas del Watcher */
  #shd .shd-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:14px 0 4px}
  #shd .shd-stat{background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:11px;padding:12px 10px;text-align:center}
  #shd .shd-stat b{display:block;font-size:19px;font-weight:800;color:var(--gold,#E8B84B);font-variant-numeric:tabular-nums}
  #shd .shd-stat span{font-size:10.5px;color:#79838f;text-transform:uppercase;letter-spacing:.4px}
  #shd .shd-watch-reco-sub{font-size:12px;color:#8a95a3;line-height:1.55;margin-bottom:14px}
  @media(max-width:560px){ #shd .shd-stats{grid-template-columns:repeat(2,1fr)} }
  
          /* Botones dentro del modal (vive fuera de #shd, necesita estilo propio) */
  .shd-clean-btns .shd-rescan{flex:1;padding:12px;border:1px solid #29313b;border-radius:10px;background:rgba(255,255,255,.03);color:#a7b0bb;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer}
  .shd-clean-btns .shd-btn{flex:1;padding:12px;border:0;border-radius:10px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;background:linear-gradient(180deg,#ff6b7d,#f6465d 60%,#d12d43);color:#fff}
  .shd-clean-box{font-family:var(--display,'Segoe UI',sans-serif);color:#eaecef}
  
  /* Limpieza de tokens basura */
  #shd .shd-tok-fbtn#clean-toggle.active{border-color:rgba(246,70,93,.5);color:#f6465d;background:rgba(246,70,93,.12)}
  #shd .shd-wtok-btns{margin-left:auto;display:flex;align-items:center;gap:0;flex:none}
  #shd .shd-wtok-div{width:1px;height:26px;margin:0 4px;background:linear-gradient(180deg,transparent,#3a424c 30%,#3a424c 70%,transparent);flex:none}
  #shd .shd-wtok-del{background:none;border:0;color:#79838f;cursor:pointer;padding:8px;display:grid;place-items:center;border-radius:8px;flex:none}
  #shd .shd-wtok-del svg{pointer-events:none}
  #shd .shd-wtok-del:hover{color:#f6465d;background:rgba(246,70,93,.1)}
  /* checkbox con estilo */
  #shd .shd-tok-check{align-items:center;flex:none;cursor:pointer;margin-right:2px}
  #shd .shd-tok-cb{appearance:none;-webkit-appearance:none;width:20px;height:20px;border:2px solid #3a424c;border-radius:6px;background:rgba(11,14,17,.6);cursor:pointer;position:relative;flex:none;transition:.15s}
  #shd .shd-tok-cb:checked{background:var(--gold,#E8B84B);border-color:var(--gold,#E8B84B)}
  #shd .shd-tok-cb:checked::after{content:'';position:absolute;left:50%;top:50%;width:5px;height:9px;border:solid #241900;border-width:0 2.5px 2.5px 0;transform:translate(-50%,-60%) rotate(45deg)}
  /* barra de acciones con MARGEN */
  #shd .shd-clean-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:12px;padding:11px 13px;background:rgba(246,70,93,.06);border:1px solid rgba(246,70,93,.22);border-radius:11px}
  #shd .shd-clean-actions{display:flex;gap:7px;flex-wrap:wrap}
  #shd .shd-clean-sel{padding:8px 13px;border:1px solid #29313b;border-radius:8px;background:rgba(255,255,255,.03);color:#a7b0bb;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer}
  #shd .shd-clean-sel:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #shd .shd-clean-go{padding:9px 20px;border:0;border-radius:9px;background:linear-gradient(180deg,#ff6b7d,#f6465d 60%,#d12d43);color:#fff;font-family:inherit;font-weight:800;font-size:12.5px;cursor:pointer;flex:none}
  /* modal de confirmación */
  .shd-clean-modal{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:18px;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
  .shd-clean-box{width:100%;max-width:460px;max-height:88vh;overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid #29313b;border-radius:18px;padding:22px}
  .shd-clean-title{font-size:19px;font-weight:800;margin-bottom:12px}
  .shd-clean-warn{font-size:12.5px;color:#f6465d;background:rgba(246,70,93,.08);border:1px solid rgba(246,70,93,.25);border-radius:10px;padding:12px;line-height:1.5;margin-bottom:14px}
  .shd-clean-note{font-size:12.5px;color:#a7b0bb;background:rgba(232,184,75,.06);border:1px solid rgba(232,184,75,.2);border-radius:10px;padding:12px;line-height:1.5;margin-bottom:14px}
  .shd-clean-list{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;max-height:220px;overflow-y:auto}
  .shd-clean-item{display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(11,14,17,.5);border:1px solid #1c232b;border-radius:9px;padding:10px 12px;font-size:13px}
  .shd-clean-item small{color:#79838f;font-size:11px}
  .shd-clean-remove{padding:5px 11px;border:1px solid #29313b;border-radius:7px;background:rgba(255,255,255,.03);color:#a7b0bb;font-family:inherit;font-size:11px;cursor:pointer}
  .shd-clean-remove:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  .shd-clean-btns{display:flex;gap:10px}
  .shd-clean-btns .shd-rescan{flex:1} .shd-clean-btns .shd-btn{flex:1}
  @media(max-width:560px){ #shd .shd-clean-bar{flex-direction:column;align-items:stretch} #shd .shd-clean-go{width:100%} #shd .shd-clean-actions{justify-content:center} }
      /* Address poisoning checker */
  #shd .shd-card-poison{border-color:rgba(180,120,255,.22)}
  #shd .shd-card-poison .shd-card-ic{background:rgba(180,120,255,.1);color:#b478ff}
  #shd .shd-card-btn.poison{border-color:rgba(180,120,255,.4);background:rgba(180,120,255,.08);color:#b478ff}
  #shd .shd-card-btn.poison:hover{background:rgba(180,120,255,.16)}
  #shd .shd-poison-wrap{max-width:600px;margin:0 auto;padding:10px 0}
  #shd .shd-poison-hero{text-align:center;margin-bottom:8px}
  #shd .shd-poison-icon{width:56px;height:56px;border-radius:50%;background:rgba(232,184,75,.1);color:var(--gold,#E8B84B);display:grid;place-items:center;margin:0 auto 14px}
  #shd .shd-poison-hero h1{font-size:22px;font-weight:800;margin:0 0 10px}
  #shd .shd-poison-hero p{font-size:13px;color:#a7b0bb;line-height:1.6;margin:0}
  #shd .shd-poison-card{margin-top:18px}
  #shd .shd-poison-threat{background:rgba(246,70,93,.05);border:1px solid rgba(246,70,93,.25);border-radius:13px;padding:16px;margin-bottom:12px}
  #shd .shd-poison-threat-h{font-size:13px;font-weight:800;color:#f6465d;margin-bottom:12px;text-transform:uppercase;letter-spacing:.5px}
  #shd .shd-poison-pair{margin-bottom:11px}
  #shd .shd-poison-lbl{font-size:11px;color:#79838f;display:block;margin-bottom:5px}
  #shd .shd-poison-addr{font-family:var(--mono,monospace);font-size:12.5px;word-break:break-all;padding:9px 11px;border-radius:8px;display:flex;align-items:center;gap:8px;line-height:1.4}
  #shd .shd-poison-addr.bad{background:rgba(246,70,93,.08);border:1px solid rgba(246,70,93,.2)}
  #shd .shd-poison-addr.good{background:rgba(46,189,133,.08);border:1px solid rgba(46,189,133,.2)}
  #shd .shd-poison-match{color:#e8b84b;font-weight:700}
  #shd .shd-poison-mid{color:#79838f}
  #shd .shd-poison-addr.bad .shd-poison-mid{color:#f6465d}
  #shd .shd-poison-addr.good .shd-poison-mid{color:#2ebd85}
  #shd .shd-poison-note{font-size:11.5px;color:#a7b0bb;line-height:1.5;margin-top:4px}
  #shd .shd-poison-tip{font-size:12.5px;color:#a7b0bb;line-height:1.55;background:rgba(232,184,75,.06);border:1px solid rgba(232,184,75,.2);border-radius:10px;padding:13px;margin-top:6px}
  #shd .shd-poison-tip b{color:#eaecef}
  
          #shd .shd-act-more{width:100%;margin-top:10px;padding:12px;background:rgba(255,255,255,.02);border:1px solid #1c232b;border-radius:10px;color:#a7b0bb;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
  #shd .shd-act-more:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  
  #shd .shd-act-loading{text-align:center;padding:40px 20px}
  #shd .shd-act-spin{width:34px;height:34px;border:3px solid rgba(232,184,75,.2);border-top-color:var(--gold,#E8B84B);border-radius:50%;animation:shdSpin .7s linear infinite;margin:0 auto 14px}
  #shd .shd-act-loadtx{font-size:13px;color:#a7b0bb}
  
      /* Tarjeta de transacción (según plantilla del usuario) */
  #shd .shd-tx{position:relative;background:rgba(14,19,25,.85);border:1px solid #232d38;border-radius:18px;padding:20px 22px;margin-bottom:12px}
  #shd .shd-tx-net{position:absolute;top:16px;right:18px;display:flex;align-items:center;gap:7px;background:rgba(11,14,17,.7);border:1px solid #2b3844;border-radius:100px;padding:6px 13px;font-size:12px;font-weight:600;color:#c9d2dc}
  #shd .shd-tx-net-dot{width:8px;height:8px;border-radius:50%;background:#2ebd85;box-shadow:0 0 7px #2ebd85}
  #shd .shd-tx-top{display:flex;align-items:center;gap:16px;padding-right:90px}
  #shd .shd-tx-logo{position:relative;width:52px;height:52px;border-radius:50%;flex:none;display:grid;place-items:center;background:#12161c}
  #shd .shd-tx-logo img{width:52px;height:52px;border-radius:50%;object-fit:cover}
  #shd .shd-tx-logo-txt{font-weight:800;font-size:15px;color:#a7b0bb}
  #shd .shd-tx-badge{position:absolute;bottom:-1px;right:-1px;width:21px;height:21px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;border:3px solid #12161c}
  #shd .shd-tx-badge.in{background:#2ebd85;color:#04140c} #shd .shd-tx-badge.out{background:#f6465d;color:#fff}
  #shd .shd-tx-amt b{font-size:26px;font-weight:800;line-height:1.1;display:block} #shd .shd-tx-amt b.pos{color:#2ebd85} #shd .shd-tx-amt b.neg{color:#f6465d}
  #shd .shd-tx-amt small{font-size:13px;color:#79838f;display:block;margin-top:3px}
  #shd .shd-tx-divider{height:1px;background:linear-gradient(90deg,transparent,#2b3844 15%,#2b3844 85%,transparent);margin:16px 0}
  #shd .shd-tx-route{display:flex;align-items:center;gap:14px}
  #shd .shd-tx-node{flex:1;min-width:0;display:flex;align-items:center;gap:12px;background:rgba(11,14,17,.5);border:1px solid #232d38;border-radius:13px;padding:13px 15px}
  #shd .shd-tx-node-ic{width:38px;height:38px;border-radius:11px;background:rgba(232,184,75,.1);color:var(--gold,#E8B84B);display:grid;place-items:center;flex:none}
  #shd .shd-tx-node-txt{flex:1;min-width:0}
  #shd .shd-tx-node-txt small{font-size:12px;color:#79838f;display:block}
  #shd .shd-tx-node-txt b{font-size:15px;font-family:var(--mono,monospace);color:#eaecef;font-weight:700}
  #shd .shd-tx-node .shd-wop2-copy{color:#79838f;background:none;border:0;cursor:pointer;padding:2px;flex:none}
  #shd .shd-tx-node .shd-wop2-copy:hover{color:var(--gold,#E8B84B)}
  #shd .shd-tx-arrow{color:var(--gold,#E8B84B);font-weight:800;font-size:22px;flex:none}
  #shd .shd-tx-links{display:flex;gap:12px;margin-top:14px}
  #shd .shd-tx-links a{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600;color:var(--gold,#E8B84B);text-decoration:none;border:1px solid rgba(232,184,75,.5);border-radius:12px;padding:14px 12px}
  #shd .shd-tx-links a:hover{background:rgba(232,184,75,.08)}
  #shd .shd-tx-links a svg{stroke:currentColor}
  @media(max-width:640px){
    #shd .shd-tx-route{flex-direction:column;align-items:stretch;gap:10px}
    #shd .shd-tx-arrow{transform:rotate(90deg);text-align:center}
    #shd .shd-tx-links{flex-direction:column}
    #shd .shd-tx-amt b{font-size:22px} #shd .shd-tx-top{padding-right:0;margin-top:8px}
    #shd .shd-tx-net{position:static;display:inline-flex;margin-bottom:12px}
  }
  
  /* Tarjeta de actividad v3 (bien distribuida) */
  #shd .shd-wop3{background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:12px;padding:14px 16px;margin-bottom:9px}
  #shd .shd-wop3-head{display:flex;align-items:center;gap:13px;margin-bottom:12px}
  #shd .shd-wop3-amt{flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  #shd .shd-wop3-amt b{font-size:16px;font-weight:700} #shd .shd-wop3-amt b.pos{color:#2ebd85} #shd .shd-wop3-amt b.neg{color:#f6465d}
  #shd .shd-wop3-date{font-size:11.5px;color:#79838f;white-space:nowrap}
  #shd .shd-wop3-body{padding-left:53px}
  #shd .shd-wop3-route{display:flex;align-items:center;gap:12px;margin-bottom:11px;flex-wrap:wrap}
  #shd .shd-wop3-node{display:flex;align-items:center;gap:7px;background:rgba(11,14,17,.5);border:1px solid #1c232b;border-radius:9px;padding:8px 11px;flex:1;min-width:130px}
  #shd .shd-wop3-node span{font-size:9.5px;color:#5f6b7a;font-weight:700}
  #shd .shd-wop3-node b{font-size:12px;font-family:var(--mono,monospace);color:#c9d2dc;font-weight:600;flex:1}
  #shd .shd-wop3-node .shd-wop2-copy{color:#79838f;background:none;border:0;cursor:pointer;padding:0}
  #shd .shd-wop3-node .shd-wop2-copy:hover{color:var(--gold,#E8B84B)}
  #shd .shd-wop3-sep{color:var(--gold,#E8B84B);font-weight:800;font-size:15px;flex:none}
  #shd .shd-wop3-links{display:flex;gap:8px;flex-wrap:wrap}
  #shd .shd-wop3-links a{flex:1;text-align:center;font-size:11px;color:var(--gold,#E8B84B);text-decoration:none;border:1px solid rgba(232,184,75,.28);border-radius:8px;padding:7px 10px;white-space:nowrap}
  #shd .shd-wop3-links a:hover{background:rgba(232,184,75,.08)}
  @media(max-width:560px){ #shd .shd-wop3-body{padding-left:0} #shd .shd-wop3-route{flex-direction:column;align-items:stretch;gap:8px} #shd .shd-wop3-sep{transform:rotate(90deg);text-align:center} #shd .shd-wop3-links{flex-direction:column} }
  
  /* Actividad enriquecida (Watcher) */
  #shd .shd-wtab-load{display:inline-block;width:11px;height:11px;border:2px solid rgba(232,184,75,.3);border-top-color:var(--gold,#E8B84B);border-radius:50%;animation:shdSpin .6s linear infinite;vertical-align:middle;margin-left:4px}
  #shd .shd-act-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}
  #shd .shd-act-tabs{display:flex;gap:6px}
  #shd .shd-act-f{padding:7px 13px;border-radius:100px;border:1px solid #1c232b;background:rgba(255,255,255,.02);color:#a7b0bb;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer}
  #shd .shd-act-f.on{background:rgba(232,184,75,.1);border-color:rgba(232,184,75,.35);color:var(--gold,#E8B84B)}
  #shd .shd-act-search{display:flex;align-items:center;gap:0;background:rgba(11,14,17,.72);border:1px solid #1c232b;border-radius:10px;overflow:hidden;height:38px}
  #shd .shd-act-search input{background:transparent;border:0;outline:none;color:#eaecef;font-family:inherit;font-size:12.5px;padding:0 12px;width:130px;height:100%}
  #shd .shd-act-go{background:rgba(232,184,75,.12);border:0;border-left:1px solid #1c232b;color:var(--gold,#E8B84B);cursor:pointer;padding:0 12px;height:100%;display:grid;place-items:center}
  #shd .shd-wop2{display:flex;align-items:flex-start;gap:13px;background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:12px;padding:13px 15px}
  #shd .shd-wop-logo{position:relative;width:40px;height:40px;border-radius:50%;background:#12161c;display:grid;place-items:center;flex:none;overflow:visible}
  #shd .shd-wop-logo img{width:40px;height:40px;border-radius:50%;object-fit:cover}
  #shd .shd-wop-logo-txt{font-weight:800;font-size:12px;color:#a7b0bb}
  #shd .shd-wop-badge{position:absolute;bottom:-2px;right:-2px;width:17px;height:17px;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:800;border:2px solid #0b0e12}
  #shd .shd-wop-badge.in{background:#2ebd85;color:#04140c} #shd .shd-wop-badge.out{background:#f6465d;color:#fff}
  #shd .shd-wop2-info{flex:1;min-width:0}
  #shd .shd-wop2-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
  #shd .shd-wop2-top b{font-size:15px;font-weight:700} #shd .shd-wop2-top b.pos{color:#2ebd85} #shd .shd-wop2-top b.neg{color:#f6465d}
  #shd .shd-wop2-date{font-size:11px;color:#79838f}
  #shd .shd-wop2-addrs{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:7px;font-family:var(--mono,monospace);font-size:11.5px;color:#a7b0bb}
  #shd .shd-wop2-addr{display:flex;align-items:center;gap:5px} #shd .shd-wop2-addr small{color:#5f6b7a;font-family:var(--display,sans-serif);font-size:10px;text-transform:uppercase}
  #shd .shd-wop2-arrow{color:var(--gold,#E8B84B);font-weight:800}
  #shd .shd-wop2-copy{background:none;border:0;color:#79838f;cursor:pointer;padding:1px;font-size:12px}
  #shd .shd-wop2-copy:hover{color:var(--gold,#E8B84B)}
  #shd .shd-wop2-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
  #shd .shd-wop2-scan{font-size:10.5px;color:var(--gold,#E8B84B);text-decoration:none;border:1px solid rgba(232,184,75,.28);border-radius:7px;padding:3px 8px}
  #shd .shd-wop2-scan:hover{background:rgba(232,184,75,.08)}
  @media(max-width:560px){ #shd .shd-act-bar{flex-direction:column;align-items:stretch} #shd .shd-act-search{width:100%} #shd .shd-act-search input{flex:1;width:auto} #shd .shd-wop2-addrs{flex-direction:column;align-items:flex-start;gap:4px} #shd .shd-wop2-arrow{display:none} }
    /* desplegable poison enriquecido */
  #shd .shd-poison-drow-l{flex:1;min-width:0}
  #shd .shd-poison-drow-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
  #shd .shd-poison-drow-meta{font-size:11px;color:#79838f;margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  #shd .shd-poison-dscan{font-size:10.5px;color:var(--gold,#E8B84B);text-decoration:none;border:1px solid rgba(232,184,75,.3);border-radius:6px;padding:2px 6px}
  
  /* Lista de direcciones analizadas (poison) */
  #shd .shd-poison-list-wrap{margin-top:14px}
  #shd .shd-poison-list-tog{width:100%;padding:11px;background:rgba(255,255,255,.02);border:1px solid #1c232b;border-radius:10px;color:#a7b0bb;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
  #shd .shd-poison-list-tog:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #shd .shd-poison-list{margin-top:10px;max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 4px 4px 0}
  #shd .shd-poison-drow{display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(11,14,17,.5);border:1px solid #1c232b;border-radius:11px;padding:13px 15px}
  #shd .shd-poison-drow.dust{border-color:rgba(232,184,75,.25);background:rgba(232,184,75,.04)}
  #shd .shd-poison-daddr{font-family:var(--mono,monospace);font-size:12px;color:#c9d2dc;display:flex;align-items:center;gap:6px}
  #shd .shd-poison-dmeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  #shd .shd-poison-dmeta span{font-size:11px;color:#79838f}
  #shd .shd-poison-dtag{font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:100px;background:rgba(232,184,75,.15);color:#e8b84b}
  #shd .shd-poison-rtag{font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:100px;background:rgba(46,189,133,.14);color:#2ebd85}
  @media(max-width:560px){ #shd .shd-poison-drow{display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(11,14,17,.5);border:1px solid #1c232b;border-radius:11px;padding:13px 15px} }
  
  /* Verificación de hash premium */
  #shd .shd-hash-big{display:flex;align-items:center;gap:16px;padding:18px;border-radius:14px;margin-bottom:18px}
  #shd .shd-hash-big.ok{background:linear-gradient(135deg,rgba(46,189,133,.14),rgba(46,189,133,.04));border:1px solid rgba(46,189,133,.3)}
  #shd .shd-hash-big.bad{background:linear-gradient(135deg,rgba(246,70,93,.14),rgba(246,70,93,.04));border:1px solid rgba(246,70,93,.3)}
  #shd .shd-hash-big.warn{background:linear-gradient(135deg,rgba(232,184,75,.14),rgba(232,184,75,.04));border:1px solid rgba(232,184,75,.3)}
  #shd .shd-hash-bigic{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;flex:none}
  #shd .shd-hash-bigic.ok{background:rgba(46,189,133,.18);color:#2ebd85} #shd .shd-hash-bigic.bad{background:rgba(246,70,93,.18);color:#f6465d} #shd .shd-hash-bigic.warn{background:rgba(232,184,75,.18);color:#e8b84b}
  #shd .shd-hash-bigt{font-size:22px;font-weight:800;line-height:1.1}
  #shd .shd-hash-big.ok .shd-hash-bigt{color:#2ebd85} #shd .shd-hash-big.bad .shd-hash-bigt{color:#f6465d} #shd .shd-hash-big.warn .shd-hash-bigt{color:#e8b84b}
  #shd .shd-hash-bigs{font-size:12.5px;color:#a7b0bb;margin-top:4px;line-height:1.5}
  #shd .shd-hash-sec-t{font-size:11px;font-weight:700;color:#79838f;text-transform:uppercase;letter-spacing:.6px;margin:18px 0 10px}
  #shd .shd-hash-transfers{display:flex;flex-direction:column;gap:9px}
  #shd .shd-hash-transfer{display:flex;align-items:center;gap:12px;background:rgba(11,14,17,.5);border:1px solid #1c232b;border-radius:11px;padding:12px 14px}
  #shd .shd-hash-tic{width:38px;height:38px;border-radius:50%;background:#12161c;display:grid;place-items:center;font-weight:800;font-size:12px;color:#a7b0bb;flex:none;overflow:hidden}
  #shd .shd-hash-tic img{width:100%;height:100%;object-fit:cover}
  #shd .shd-hash-tamt{font-size:15px;font-weight:700;color:#eaecef}
  #shd .shd-hash-usd{font-size:12px;color:#79838f;font-weight:600}
  #shd .shd-hash-tflow{font-size:11.5px;color:#79838f;font-family:var(--mono,monospace);margin-top:4px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
  #shd .shd-hash-arrow,#shd .shd-hash-ftarrow{color:var(--gold,#E8B84B);font-weight:800}
  #shd .shd-hash-fromto{display:flex;align-items:center;gap:12px}
  #shd .shd-hash-ft{flex:1;min-width:0;background:rgba(11,14,17,.5);border:1px solid #1c232b;border-radius:11px;padding:12px 14px}
  #shd .shd-hash-ft span{font-size:11px;color:#79838f;display:block;margin-bottom:4px}
  #shd .shd-hash-ft b{font-size:12.5px;color:#eaecef;font-family:var(--mono,monospace);font-weight:600;display:flex;align-items:center;gap:6px}
  #shd .shd-hash-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#161f2b;border-radius:11px;overflow:hidden}
  #shd .shd-hash-d{display:flex;flex-direction:column;gap:4px;background:rgba(14,19,25,.85);padding:12px 14px}
  #shd .shd-hash-d span{font-size:11px;color:#79838f} #shd .shd-hash-d b{font-size:12.5px;color:#eaecef;font-weight:600;word-break:break-word}
  #shd .shd-hash-scan{display:block;text-align:center;margin-top:16px;padding:13px;border:1px solid rgba(232,184,75,.3);border-radius:11px;color:var(--gold,#E8B84B);text-decoration:none;font-size:13px;font-weight:700}
  #shd .shd-hash-scan:hover{background:rgba(232,184,75,.08)}
  #shd .shd-hash-msg{font-size:13px;color:#a7b0bb;line-height:1.55}
  @media(max-width:560px){ #shd .shd-hash-grid{grid-template-columns:1fr} #shd .shd-hash-fromto{flex-direction:column;align-items:stretch} #shd .shd-hash-ftarrow{transform:rotate(90deg);text-align:center} }
  
  /* Verificación de hash */
  #shd .shd-card-hash{border-color:rgba(52,211,153,.2)}
  #shd .shd-card-hash .shd-card-ic{background:rgba(52,211,153,.1);color:#2ebd85}
  #shd .shd-card-btn.hash{border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08);color:#2ebd85}
  #shd .shd-card-btn.hash:hover{background:rgba(52,211,153,.16)}
  #shd .shd-hash-wrap{max-width:600px;margin:0 auto;padding:10px 0}
  #shd .shd-hash-hero{text-align:center;margin-bottom:8px}
  #shd .shd-hash-icon{width:56px;height:56px;border-radius:50%;background:rgba(232,184,75,.1);color:var(--gold,#E8B84B);display:grid;place-items:center;margin:0 auto 14px}
  #shd .shd-hash-hero h1{font-size:22px;font-weight:800;margin:0 0 10px}
  #shd .shd-hash-hero p{font-size:13px;color:#a7b0bb;line-height:1.6;margin:0}
  #shd .shd-hash-card{margin-top:18px;border:1px solid #1c232b;border-radius:14px;padding:18px;background:rgba(14,19,25,.8)}
  #shd .shd-hash-status{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800;margin-bottom:16px}
  #shd .shd-hash-status.ok{color:#2ebd85} #shd .shd-hash-status.bad{color:#f6465d} #shd .shd-hash-status.warn{color:#e8b84b}
  #shd .shd-hash-dot{width:11px;height:11px;border-radius:50%;flex:none}
  #shd .shd-hash-dot.ok{background:#2ebd85;box-shadow:0 0 10px #2ebd85} #shd .shd-hash-dot.bad{background:#f6465d;box-shadow:0 0 10px #f6465d} #shd .shd-hash-dot.warn{background:#e8b84b;box-shadow:0 0 10px #e8b84b}
  #shd .shd-hash-msg,#shd .shd-hash-notrans{font-size:13px;color:#a7b0bb;line-height:1.55}
  #shd .shd-hash-transfers{display:flex;flex-direction:column;gap:9px;margin-bottom:16px}
  #shd .shd-hash-transfer{display:flex;align-items:center;gap:12px;background:rgba(11,14,17,.5);border:1px solid #1c232b;border-radius:11px;padding:12px 14px}
  #shd .shd-hash-tic{width:36px;height:36px;border-radius:50%;background:#12161c;display:grid;place-items:center;font-weight:800;font-size:12px;color:#a7b0bb;flex:none;overflow:hidden}
  #shd .shd-hash-tic img{width:100%;height:100%;object-fit:cover}
  #shd .shd-hash-tamt{font-size:15px;font-weight:700;color:#eaecef}
  #shd .shd-hash-usd{font-size:12px;color:#79838f;font-weight:600}
  #shd .shd-hash-tflow{font-size:11.5px;color:#79838f;font-family:var(--mono,monospace);margin-top:3px}
  #shd .shd-hash-rows{display:flex;flex-direction:column;gap:1px;background:#161f2b;border-radius:10px;overflow:hidden;margin-bottom:14px}
  #shd .shd-hash-row{display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(14,19,25,.8);padding:11px 14px;font-size:12.5px}
  #shd .shd-hash-row span{color:#79838f} #shd .shd-hash-row b{color:#eaecef;font-family:var(--mono,monospace);font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px}
  #shd .shd-hash-scan{display:block;text-align:center;padding:12px;border:1px solid rgba(232,184,75,.3);border-radius:10px;color:var(--gold,#E8B84B);text-decoration:none;font-size:13px;font-weight:700}
  #shd .shd-hash-scan:hover{background:rgba(232,184,75,.08)}
  
  /* Wallet Watcher */
  #shd .shd-card-watch{border-color:rgba(90,160,232,.22)}
  #shd .shd-card-watch .shd-card-ic{background:rgba(90,160,232,.12);color:#6aa8f0}
  #shd .shd-card-btn.watch{border-color:rgba(90,160,232,.4);background:rgba(90,160,232,.08);color:#6aa8f0}
  #shd .shd-card-btn.watch:hover{background:rgba(90,160,232,.16)}
  #shd .shd-watch-wrap{max-width:600px;margin:0 auto;padding:10px 0}
  #shd .shd-watch-hero{text-align:center;margin-bottom:8px}
  #shd .shd-watch-icon{width:56px;height:56px;border-radius:50%;background:rgba(232,184,75,.1);color:var(--gold,#E8B84B);display:grid;place-items:center;margin:0 auto 14px}
  #shd .shd-watch-hero h1{font-size:22px;font-weight:800;margin:0 0 10px}
  #shd .shd-watch-hero p{font-size:13px;color:#a7b0bb;line-height:1.6;margin:0 0 6px}
  #shd .shd-watch-saved{margin-top:14px;font-size:12px;color:#79838f;display:flex;flex-wrap:wrap;gap:7px;align-items:center}
  #shd .shd-watch-chip{background:rgba(232,184,75,.08);border:1px solid rgba(232,184,75,.22);color:var(--gold,#E8B84B);border-radius:100px;padding:5px 12px;font-family:var(--mono,monospace);font-size:11.5px;cursor:pointer}
  #shd .shd-watch-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px;padding:16px 18px;background:linear-gradient(135deg,rgba(20,26,33,.9),rgba(10,14,18,.9));border:1px solid #1c232b;border-radius:14px}
  #shd .shd-watch-addr{font-family:var(--mono,monospace);font-size:14px;color:#a7b0bb}
  #shd .shd-watch-total{font-size:26px;font-weight:800;margin-top:4px} #shd .shd-watch-total small{font-size:12px;color:#79838f;font-weight:600}
  #shd .shd-watch-follow{padding:11px 18px;border-radius:11px;border:1px solid var(--gold-md,#cf9f2e);background:rgba(232,184,75,.1);color:var(--gold,#E8B84B);font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;flex:none}
  #shd .shd-watch-follow.on{background:rgba(46,189,133,.12);border-color:rgba(46,189,133,.4);color:#2ebd85}
  #shd .shd-watch-tabs{display:flex;gap:8px;margin:16px 0 12px}
  #shd .shd-wtab{flex:1;padding:11px;border-radius:10px;border:1px solid #1c232b;background:rgba(255,255,255,.02);color:#a7b0bb;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
  #shd .shd-wtab.on{background:rgba(232,184,75,.1);border-color:rgba(232,184,75,.35);color:var(--gold,#E8B84B)}
  #shd .shd-wtoks,#shd .shd-wops{display:flex;flex-direction:column;gap:8px}
  #shd .shd-wtok{display:flex;align-items:center;gap:12px;background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:11px;padding:11px 14px}
  #shd .shd-wtok .shd-perm-ic img{width:100%;height:100%;border-radius:50%;object-fit:cover}
  #shd .shd-wtok .shd-perm-ic{overflow:hidden}
  #shd .shd-watch-dust{font-size:11.5px;color:#79838f;text-transform:uppercase;letter-spacing:.5px;margin:10px 0 4px;padding-left:2px}
  #shd .shd-wop{display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:11px;padding:12px 14px;font-size:13px}
  #shd .shd-wop-l b{font-weight:700} #shd .shd-wop-r{display:flex;align-items:center;gap:10px;flex:none}
  #shd .shd-wop-r span{font-size:11.5px;color:#79838f} #shd .shd-wop-hash{font-size:11.5px;color:var(--gold,#E8B84B);text-decoration:none;border:1px solid rgba(232,184,75,.3);border-radius:7px;padding:3px 8px}
  #shd .shd-empty{text-align:center;color:#79838f;font-size:13px;padding:26px}
  @media(max-width:560px){ #shd .shd-watch-head{flex-direction:column;align-items:stretch} #shd .shd-watch-follow{width:100%} #shd .shd-wop{flex-wrap:wrap} }
  
  #shd .shd-watch-reco{margin-top:22px;padding-top:18px;border-top:1px solid #1c232b}
  #shd .shd-watch-reco-t{font-size:12px;font-weight:700;color:#79838f;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
  #shd .shd-watch-reco-list{display:grid;grid-template-columns:1fr 1fr;gap:9px}
  #shd .shd-reco{text-align:left;background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:11px;padding:12px 14px;cursor:pointer;transition:.15s}
  #shd .shd-reco:hover{border-color:rgba(232,184,75,.35);background:rgba(232,184,75,.05)}
  #shd .shd-reco b{display:block;font-size:13px;color:#eaecef;margin-bottom:2px}
  #shd .shd-reco span{font-size:11px;color:#79838f}
  #shd .shd-watch-reco-note{font-size:11.5px;color:#79838f;line-height:1.5;margin-top:12px}
  @media(max-width:560px){ #shd .shd-watch-reco-list{grid-template-columns:1fr} }
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
  
          /* Escanear otra wallet + info real */
  #shd .shd-viewing{display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,rgba(90,160,232,.12),rgba(90,160,232,.04));border:1px solid rgba(90,160,232,.28);border-radius:13px;padding:13px 16px;margin-bottom:14px}
  #shd .shd-viewing-ic{font-size:18px;flex:none}
  #shd .shd-viewing small{font-size:11px;color:#79838f;display:block}
  #shd .shd-viewing b{color:#6aa8f0;font-family:var(--mono,monospace);font-size:13.5px}
  #shd .shd-scan-other{display:flex;gap:9px;margin:16px 0;align-items:center}
  #shd .shd-scan-other input{flex:1;min-width:0;background:rgba(11,14,17,.72);border:1px solid #1c232b;border-radius:11px;padding:12px 14px;color:#eaecef;font-family:var(--mono,monospace);font-size:12.5px;outline:none}
  #shd .shd-scan-other input:focus{border-color:var(--gold-soft,#C9A84B)}
  #shd .shd-scan-other-go{flex:none;padding:12px 24px;border:1px solid var(--gold-md,#cf9f2e);border-radius:11px;background:linear-gradient(180deg,#f4d089,#E8B84B 60%,#cf9f2e);color:#241900;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer}
  #shd .shd-scan-other-go:hover{filter:brightness(1.06)}
  #shd .shd-comp-badge{font-size:10px;font-weight:800;padding:3px 9px;border-radius:100px;text-transform:uppercase;letter-spacing:.4px}
  @media(max-width:560px){ #shd .shd-scan-other{flex-direction:column;align-items:stretch} #shd .shd-scan-other-go{width:100%} }
  /* Selector de wallet de Permission Scan (BSC/TRON) */
  #shd .shd-scansel{display:flex;flex-direction:column;gap:12px;max-width:520px;margin:0 auto}
  #shd .shd-scansel-mine{display:flex;align-items:center;gap:13px;width:100%;text-align:left;background:rgba(14,19,25,.85);border:1px solid #232d38;border-radius:14px;padding:15px 16px;cursor:pointer;color:#eaecef;font-family:inherit}
  #shd .shd-scansel-mine:hover{border-color:var(--gold-soft,#C9A84B)}
  #shd .shd-scansel-ic{width:40px;height:40px;border-radius:11px;background:rgba(232,184,75,.12);color:var(--gold,#E8B84B);display:grid;place-items:center;flex:none}
  #shd .shd-scansel-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  #shd .shd-scansel-tx small{font-size:12px;color:#79838f}
  #shd .shd-scansel-tx b{font-size:14px;font-family:var(--mono,monospace);color:#eaecef;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #shd .shd-scansel-or{display:flex;align-items:center;gap:12px;color:#79838f;font-size:12px}
  #shd .shd-scansel-or:before,#shd .shd-scansel-or:after{content:"";flex:1;height:1px;background:#232d38}
  #shd .shd-scansel-row{display:flex;align-items:center;gap:10px}
  #shd .shd-scansel-row .shd-sim-in{flex:1;min-width:0}
  #shd .shd-net-badge{flex:none;font-size:11px;font-weight:800;padding:5px 10px;border-radius:100px;letter-spacing:.3px}
  #shd .shd-net-badge.bsc{background:rgba(240,185,11,.14);color:#f0b90b}
  #shd .shd-net-badge.tron{background:rgba(235,0,41,.16);color:#ff5c6e}
  #shd .shd-net-badge.bad{background:rgba(246,70,93,.16);color:#f6465d}
  #shd .shd-scansel #scansel-go{width:100%}
  
    /* Datos duros del diagnóstico */
  #shd .shd-found{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-bottom:6px}
  #shd .shd-found-cell{background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:12px;padding:16px 12px;text-align:center}
  #shd .shd-found-cell b{display:block;font-size:26px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
  #shd .shd-found-cell span{font-size:11px;color:#79838f;margin-top:5px;display:block}
  @media(max-width:560px){ #shd .shd-found{grid-template-columns:1fr 1fr} }
  
  /* Diagnóstico premium (auditoría) */
  #shd .shd-audit-hero{display:flex;align-items:center;gap:30px;background:linear-gradient(135deg,rgba(20,26,33,.92),rgba(10,14,18,.92));border:1px solid #232d38;border-radius:18px;padding:26px 30px;margin-bottom:16px}
  #shd .shd-audit-side{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
  #shd .shd-audit-badge{display:inline-block;align-self:flex-start;font-size:11px;font-weight:800;letter-spacing:.6px;padding:5px 12px;border-radius:100px;border:1px solid;margin-bottom:10px}
  #shd .shd-audit-lvl{font-size:26px;font-weight:800;line-height:1}
  #shd .shd-audit-sub{font-size:13px;color:#79838f;margin:2px 0 16px}
  #shd .shd-audit-stats{display:flex;gap:28px;margin-top:4px}
  #shd .shd-audit-comps{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
  #shd .shd-comp{background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:13px;padding:15px 16px}
  #shd .shd-comp-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:9px}
  #shd .shd-comp-name{font-size:13px;font-weight:700;color:#eaecef} #shd .shd-comp-name em{font-style:normal;font-size:10.5px;color:#79838f;font-weight:600}
  #shd .shd-comp-val{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums}
  #shd .shd-comp-bar{height:7px;background:#12161c;border-radius:100px;overflow:hidden;margin-bottom:9px}
  #shd .shd-comp-bar span{display:block;height:100%;border-radius:100px;transition:width 1s ease}
  #shd .shd-comp-detail{font-size:11.5px;color:#8a95a3;line-height:1.5}
  #shd .shd-audit-sec-t{font-size:12px;font-weight:700;color:#79838f;text-transform:uppercase;letter-spacing:.6px;margin:20px 0 12px}
  #shd .shd-plats{display:flex;flex-direction:column;gap:9px}
  #shd .shd-plat{display:flex;align-items:center;gap:13px;background:rgba(14,19,25,.7);border:1px solid #1c232b;border-radius:12px;padding:13px 15px}
  #shd .shd-plat.ours{border-color:rgba(232,184,75,.28)} #shd .shd-plat.known{border-color:rgba(46,189,133,.22)} #shd .shd-plat.unknown{border-color:rgba(246,70,93,.28)}
  #shd .shd-plat-ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-weight:800;font-size:15px;flex:none;background:#12161c;color:#a7b0bb}
  #shd .shd-plat.ours .shd-plat-ic{background:rgba(232,184,75,.14);color:var(--gold,#E8B84B)} #shd .shd-plat.known .shd-plat-ic{background:rgba(46,189,133,.12);color:#2ebd85} #shd .shd-plat.unknown .shd-plat-ic{background:rgba(246,70,93,.12);color:#f6465d}
  #shd .shd-plat-info{flex:1;min-width:0} #shd .shd-plat-info b{font-size:14px;display:block} #shd .shd-plat-info span{font-size:11.5px;color:#79838f}
  #shd .shd-plat-tag{font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:100px;flex:none}
  #shd .shd-plat-tag.ours{background:rgba(232,184,75,.14);color:var(--gold,#E8B84B)} #shd .shd-plat-tag.known{background:rgba(46,189,133,.14);color:#2ebd85} #shd .shd-plat-tag.unknown{background:rgba(246,70,93,.14);color:#f6465d}
  #shd .shd-plat-note{font-size:12px;color:#f8934b;margin-top:10px;line-height:1.5}
  @media(max-width:560px){ #shd .shd-audit-hero{display:flex;align-items:center;gap:30px;background:linear-gradient(135deg,rgba(20,26,33,.92),rgba(10,14,18,.92));border:1px solid #232d38;border-radius:18px;padding:26px 30px;margin-bottom:16px} #shd .shd-audit-stats{display:flex;gap:28px;margin-top:4px} #shd .shd-audit-comps{grid-template-columns:1fr} #shd .shd-plat{flex-wrap:wrap} }
  
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
  eye: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  hash: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>',
  poison: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s6 5 6 11a6 6 0 0 1-12 0c0-6 6-11 6-11z"/><path d="M9 13h6M12 10v6"/></svg>',
  gas: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22h12V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M15 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3M6 6h6"/></svg>',
  check2: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#2ebd85" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
};

/* ═══════════ Abrir Wallet Shield ═══════════ */
export function abrirShield() {
  inyectarCSS();
  const prev = $('shd'); if (prev) prev.remove();
  const cont = document.createElement('div'); cont.id = 'shd';
  document.body.appendChild(cont);
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  cont.innerHTML = `<div id="shd-header-banner"></div><canvas id="shd-fx" aria-hidden="true"></canvas><div id="shd-barslot"></div><div class="shd-in" id="shd-in"></div>`;
  montarParticulas();
  // SIEMPRE se muestra primero la portada explicativa (pintarConectar), tenga o
  // no cuenta conectada. Esa pantalla lleva la explicación importante y su botón
  // verifica el pago/acceso antes de entrar. Así nunca se salta ni la explicación
  // ni el cobro (antes, con la wallet ya conectada, se entraba directo sin pagar).
  pintarConectar();
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
  // Wallet Shield es su propia página. Al salir se VUELVE a la página anterior
  // (de donde se entró: Home o Actives del móvil) con history.back(). Así no se
  // recarga ni se pasa por index.html, y la wallet NO se desconecta.
  const cont = document.getElementById('shd');
  // Si la sección se montó dentro de la app móvil, basta con retirarla.
  if (document.getElementById('mv-app')) { if (cont) cont.remove(); return; }
  // Si hay historial (se entró con location.href desde el móvil), volver atrás.
  if (history.length > 1) { history.back(); return; }
  // Respaldo: si no hay historial (entrada directa), ir a la portada.
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
  const IMG = 'assets/portada/img/';
  $('shd-in').innerHTML = `
    <div class="shd-portada">
      <img class="shd-portada-hero" src="${IMG}shield-hero.webp" alt="">
      <h1 class="shd-portada-title"><span class="g">Protect</span> your wallet</h1>
      <p class="shd-portada-p">Most wallets are not hacked. They are quietly given away, through an old permission you forgot, a fake address, or a contract you signed without reading. Wallet Shield is your personal security team: it scans your wallet, exposes every hidden threat, and lets you shut it down in one tap. See exactly what is putting your funds at risk, in seconds, even if you have never done this before.</p>
      <p class="shd-portada-cost"><b>Full access to every tool for 30 days.</b> One small payment in BNB, taken only when you connect. Connect to see the exact amount.</p>
      <button class="shd-connect-btn" id="shd-conn"><img src="${IMG}shield-connect.webp" alt="Connect your wallet"></button>
    </div>`;
  wireBack();
  wireTilt();
  $('shd-conn').onclick = async () => {
    try {
      // conectar solo si no lo está ya (en el móvil suele estar conectada)
      let cuenta = wallet.cuentaActual && wallet.cuentaActual();
      if (!cuenta) { await wallet.conectar(); cuenta = wallet.cuentaActual && wallet.cuentaActual(); }
      if (!cuenta) return;
      // ¿ya tiene acceso pagado (u owner)? → entra. Si no → pantalla de pago.
      const acceso = await pago.tieneAcceso(cuenta);
      if (acceso) { pintarInicio(cuenta); } else { pintarPago(cuenta); }
    } catch (_) {}
  };
}
function pintarFaucet(cuenta) {
  $('shd-barslot').innerHTML = cabecera();
  $('shd-in').innerHTML = `
    <div class="shd-faucet-wrap">
      <div class="shd-faucet-hero">
        <div class="shd-faucet-icon">${IC.gas}</div>
        <h1>Free gas faucet</h1>
        <p>Ran out of BNB and can't even move your own tokens? Claim a small amount of gas to unstick your wallet. It's free, once every 30 days, as long as the pool has funds.</p>
      </div>
      <div class="shd-faucet-box" id="faucet-box">
        <div class="shd-faucet-loading">Checking the faucet…</div>
      </div>
      <button class="shd-rescan" id="faucet-back" style="margin-top:18px">Back</button>
    </div>`;
  wireBack(function () { pintarInicio(cuenta); });
  $('faucet-back').onclick = () => pintarInicio(cuenta);
  cargarFaucet(cuenta);
}
function cargarFaucet(cuenta) {
  pago.infoFaucet(cuenta).then(function (info) {
    const box = $('faucet-box'); if (!box) return;
    if (info.puede) {
      box.innerHTML = '<div class="shd-faucet-amount">' + info.monto + ' BNB</div>' +
        '<div class="shd-faucet-sub">Available to claim now</div>' +
        '<button class="shd-btn" id="faucet-claim" style="width:100%;margin-top:16px">' + IC.gas + ' Claim free gas</button>' +
        '<div class="shd-faucet-msg" id="faucet-msg"></div>' +
        '<div class="shd-faucet-pool">Faucet pool: ' + info.pozo + ' BNB</div>';
      const cb = $('faucet-claim');
      cb.onclick = async function () {
        const msg = $('faucet-msg');
        cb.style.pointerEvents = 'none'; cb.style.opacity = '.6';
        if (msg) msg.innerHTML = '<span style="color:#a7b0bb">Confirm in your wallet…</span>';
        try {
          await pago.reclamarFaucet();
          if (msg) msg.innerHTML = '<span style="color:#2ebd85">Gas sent to your wallet. You can move your funds now.</span>';
          setTimeout(function () { cargarFaucet(cuenta); }, 2000);
        } catch (e) {
          cb.style.pointerEvents = ''; cb.style.opacity = '';
          const err = (e && e.message) || '';
          if (/EnfriamientoActivo|cooldown/i.test(err)) { if (msg) msg.innerHTML = '<span style="color:#e8b84b">You already claimed recently. Come back later.</span>'; }
          else if (/PozoVacio|empty/i.test(err)) { if (msg) msg.innerHTML = '<span style="color:#f6465d">The faucet pool is empty right now. Try again later.</span>'; }
          else if (/rejected|denied|user/i.test(err)) { if (msg) msg.innerHTML = '<span style="color:#a7b0bb">Cancelled.</span>'; }
          else { if (msg) msg.innerHTML = '<span style="color:#f6465d">Could not claim right now. Try again.</span>'; }
        }
      };
    } else {
      const cuando = info.proximo > 0 ? new Date(info.proximo).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
      box.innerHTML = '<div class="shd-faucet-wait"><div class="shd-faucet-wait-ic">\u23f3</div><div class="shd-faucet-wait-t">Already claimed</div>' +
        '<div class="shd-faucet-wait-s">You can claim free gas again' + (cuando ? ' on <b>' + cuando + '</b>' : ' in about 30 days') + '.</div></div>' +
        '<div class="shd-faucet-pool">Faucet pool: ' + info.pozo + ' BNB</div>';
    }
  }).catch(function () {
    const box = $('faucet-box'); if (box) box.innerHTML = '<div class="shd-sim-msg bad">Could not reach the faucet. Try again.</div>';
  });
}
function pintarPago(cuenta) {
  $('shd-barslot').innerHTML = cabecera();
  const IMG = 'assets/portada/img/';
  $('shd-in').innerHTML = `
    <div class="shd-portada">
      <img class="shd-portada-hero" src="${IMG}shield-hero.webp" alt="">
      <h1 class="shd-portada-title"><span class="g">Unlock</span> Wallet Shield</h1>
      <p class="shd-portada-p">Your wallet is connected. Activate 30 days of full access to every security tool: permission scanner, contract checker, wallet watcher, transaction verifier and address poisoning detector.</p>
      <div class="shd-pay-box">
        <div class="shd-pay-label">One payment · 30 days access</div>
        <div class="shd-pay-amount" id="pay-amount">…</div>
        <div class="shd-pay-sub">Paid in BNB from your wallet</div>
      </div>
      <button class="shd-connect-btn" id="shd-pay"><img src="${IMG}shield-connect.webp" alt="Pay and unlock"></button>
      <div class="shd-pay-msg" id="pay-msg"></div>
    </div>`;
  wireBack();
  // cargar el monto en BNB (del contrato, vía oráculo) — sin mencionar dólares
  pago.infoAcceso(cuenta).then(function (info) {
    const el = $('pay-amount');
    if (info.esOwner) { if (el) el.textContent = 'Free for owners'; const b = $('shd-pay'); if (b) b.onclick = function () { abrirShield(); }; return; }
    if (el) el.textContent = (info.precioBNBtxt !== '—' ? info.precioBNBtxt + ' BNB' : 'Price unavailable');
  });
  $('shd-pay').onclick = async function () {
    const msg = $('pay-msg'); const btn = $('shd-pay');
    // si ya es owner, el handler de arriba entra directo; aquí es el pago normal
    try {
      const info = await pago.infoAcceso(cuenta);
      if (info.esOwner) { abrirShield(); return; }
      if (info.tiene) { abrirShield(); return; }
      btn.style.pointerEvents = 'none'; btn.style.opacity = '.6';
      if (msg) msg.innerHTML = '<span style="color:#a7b0bb">Confirm the payment in your wallet…</span>';
      await pago.comprarAcceso();
      if (msg) msg.innerHTML = '<span style="color:#2ebd85">Access unlocked. Welcome to Wallet Shield.</span>';
      setTimeout(function () { abrirShield(); }, 1200);
    } catch (e) {
      btn.style.pointerEvents = ''; btn.style.opacity = '';
      const err = (e && e.message) || '';
      if (/insufficient|exceeds/i.test(err)) { if (msg) msg.innerHTML = '<span style="color:#f6465d">Not enough BNB in your wallet for the payment plus gas.</span>'; }
      else if (/rejected|denied|user/i.test(err)) { if (msg) msg.innerHTML = '<span style="color:#a7b0bb">Payment cancelled.</span>'; }
      else { if (msg) msg.innerHTML = '<span style="color:#f6465d">Could not complete the payment. Try again.</span>'; }
    }
  };
}
function wireBack(alSalir) { const b = $('shd-back'); if (b) b.onclick = alSalir || cerrar; }
function wireTilt() {
  document.querySelectorAll('[data-tilt]').forEach(function (el) {
    el.onmousemove = function (e) {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = 'perspective(700px) rotateY(' + (x * 10) + 'deg) rotateX(' + (-y * 10) + 'deg) translateY(-3px)';
    };
    el.onmouseleave = function () { el.style.transform = ''; };
  });
}

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
    <div class="shd-hero" style="padding-bottom:14px">
      <h1>Wallet Shield</h1>
      <p>Everything you need to keep your wallet safe, in one place. Pick a tool below.</p>
    </div>
    <div class="shd-cards">
      <div class="shd-card"><div class="shd-card-ic">${IC.shield}</div><b>Permission scan</b><span>See every approval your wallet gave and revoke the risky ones.</span><button class="shd-card-btn gold" id="shd-scan">Scan</button></div>
      <div class="shd-card"><div class="shd-card-ic">${IC.search}</div><b>Contract check</b><span>Paste any contract before you sign and we tell you if it's safe.</span><button class="shd-card-btn gold" id="shd-sim">Check</button></div>
      <div class="shd-card shd-card-red"><div class="shd-card-ic">${IC.alert}</div><b>Emergency evacuation</b><span>If your wallet is at risk, move all your tokens to a safe wallet fast.</span><button class="shd-card-btn" id="shd-emerg">Open</button></div>
      <div class="shd-card shd-card-watch"><div class="shd-card-ic">${IC.eye}</div><b>Wallet Watcher</b><span>Track any wallet on the chain: see all its tokens, balance and live moves.</span><button class="shd-card-btn watch" id="shd-watch">Open</button></div>
      <div class="shd-card shd-card-hash"><div class="shd-card-ic">${IC.hash}</div><b>Verify a transaction</b><span>Paste a transaction hash and confirm it really went through, who sent what to whom, and how much.</span><button class="shd-card-btn hash" id="shd-hash">Verify</button></div>
      <div class="shd-card shd-card-poison"><div class="shd-card-ic">${IC.poison}</div><b>Address poison check</b><span>Scan a wallet for fake lookalike addresses planted by scammers to trick you into sending funds to them.</span><button class="shd-card-btn poison" id="shd-poison">Scan</button></div>
      <div class="shd-card shd-card-gas"><div class="shd-card-ic">${IC.gas}</div><b>Free gas</b><span>Out of BNB and stuck? Claim a small amount of gas to move your funds. Free, once a month.</span><button class="shd-card-btn gas" id="shd-gas">Get gas</button></div>
    </div>`;
  wireBack();
  $('shd-scan').onclick = () => pintarSelectorScan(cuenta);
  $('shd-sim').onclick = () => pintarSimulador(cuenta);
  $('shd-emerg').onclick = () => pintarRescate(cuenta);
  const wb = $('shd-watch'); if (wb) wb.onclick = () => pintarWatcher(cuenta);
  const hb = $('shd-hash'); if (hb) hb.onclick = () => pintarHash(cuenta);
  const pb = $('shd-poison'); if (pb) pb.onclick = () => pintarPoison(cuenta);
  const gb = $('shd-gas'); if (gb) gb.onclick = () => pintarFaucet(cuenta);
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
  wireBack(function () { pintarInicio(cuenta); });
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
function pintarPoison(cuenta) {
  $('shd-barslot').innerHTML = cabecera();
  const miWallet = cuenta || '';
  $('shd-in').innerHTML = `
    <div class="shd-poison-wrap">
      <div class="shd-poison-hero">
        <div class="shd-poison-icon">${IC.poison}</div>
        <h1>Address poisoning checker</h1>
        <p>Address poisoning is one of the fastest growing scams in crypto, and it works even against careful people. Here is exactly how it happens, step by step. A scammer watches the blockchain and sees a wallet you send money to often. They then generate a brand new wallet whose address starts and ends with the very same characters as that real one, because most people only check the first four and last four characters. They send you a transaction of zero or almost zero value from that fake address, purely so it appears in your transaction history next to the real one. Days later, when you go to pay that contact again, you scroll your history, copy what looks like the right address, and send. But you copied the scammer's twin, and your money is gone with no way to reverse it. Their whole goal is to steal a full payment by making you trust your own history. Paste any wallet below and we will scan its history for these planted twin addresses before they cost you anything.</p>
      </div>
      <label class="shd-sim-lbl">Wallet to scan for poisoning</label>
      <input class="shd-sim-in" id="poison-in" placeholder="0x… wallet address" autocomplete="off" spellcheck="false" value="${miWallet}">
      <button class="shd-btn" id="poison-go" style="width:100%;margin-top:14px">${IC.poison} Scan for poisoning</button>
      <div id="poison-res"></div>
      <button class="shd-rescan" id="poison-back" style="margin-top:18px">Back</button>
    </div>`;
  wireBack(function () { pintarInicio(cuenta); });
  $('poison-back').onclick = () => pintarInicio(cuenta);
  $('poison-go').onclick = async () => {
    const addr = $('poison-in').value.trim(); const res = $('poison-res');
    if (!poison.esDireccion(addr)) { res.innerHTML = `<div class="shd-sim-msg bad">Enter a valid wallet address (0x…)</div>`; return; }
    res.innerHTML = `<div class="shd-sim-loading"><div class="shd-radar" style="width:70px;height:70px"><div class="shd-radar-ring"></div><div class="shd-radar-sweep"></div><div class="shd-radar-core" style="inset:26px"></div></div><div style="color:#a7b0bb;font-size:13px;margin-top:10px">Scanning history for lookalikes…</div></div>`;
    try {
      const hist = await watch.historialAmplio(addr);
      const info = poison.analizar(addr, hist);
      res.innerHTML = tarjetaPoison(info, hist.length);
      wirePoisonCopy();
    } catch (e) { res.innerHTML = `<div class="shd-sim-msg bad">Could not scan that wallet. Try again.</div>`; }
  };
  function wirePoisonCopy() {
    document.querySelectorAll('[data-pcopy]').forEach(function (b) { b.onclick = function () { try { navigator.clipboard.writeText(b.dataset.pcopy); const o = b.textContent; b.textContent = '✓'; setTimeout(function () { b.textContent = o; }, 1200); } catch (_) {} }; });
    const tog = $('poison-list-tog'); const lst = $('poison-list');
    if (tog && lst) tog.onclick = function () { const abrir = lst.style.display === 'none'; lst.style.display = abrir ? 'block' : 'none'; tog.textContent = abrir ? 'Hide addresses \u25b4' : ('All ' + document.querySelectorAll('.shd-poison-drow').length + ' addresses \u25be'); };
  }
}
function resaltar(addr, pref, suf) {
  // resalta el prefijo y sufijo que coinciden (la parte que engaña), medio en rojo
  const p = addr.slice(0, pref);
  const m = addr.slice(pref, addr.length - suf);
  const s2 = addr.slice(addr.length - suf);
  return '<span class="shd-poison-match">' + escH(p) + '</span><span class="shd-poison-mid">' + escH(m) + '</span><span class="shd-poison-match">' + escH(s2) + '</span>';
}
function listaDirecciones(info) {
  if (!info.todasContrapartes || !info.todasContrapartes.length) return '';
  const filas = info.todasContrapartes.map(function (c) {
    const corta = c.addr.slice(0,12) + '\u2026' + c.addr.slice(-10);
    // fecha condicional: 1 transfer => fecha + hora; muchas => solo día/mes/año
    let fecha = '';
    if (c.ts > 0) {
      if (c.veces === 1) fecha = new Date(c.ts).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
      else fecha = 'last ' + new Date(c.ts).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
    }
    const tag = c.esDust ? '<span class="shd-poison-dtag">suspicious dust</span>' : '<span class="shd-poison-rtag">real transfer</span>';
    const fl = c.tipo === 'in' ? '<span style="color:#2ebd85">received</span>' : '<span style="color:#f6465d">sent</span>';
    return '<div class="shd-poison-drow ' + (c.esDust?'dust':'') + '">' +
      '<div class="shd-poison-drow-l">' +
        '<div class="shd-poison-daddr">' + corta + ' <button class="shd-wtok-copy" data-pcopy="' + c.addr + '">\u29c9</button></div>' +
        '<div class="shd-poison-drow-meta">' + tag + '<span>' + c.veces + ' transfer' + (c.veces>1?'s':'') + '</span><span>' + fl + '</span>' + (fecha ? '<span>' + fecha + '</span>' : '') + '</div>' +
      '</div>' +
      '<a href="https://bscscan.com/address/' + c.addr + '" target="_blank" rel="noopener" class="shd-poison-dscan">BscScan \u2197</a>' +
    '</div>';
  }).join('');
  // DESPLEGADO por defecto (display:block, botón dice ocultar)
  return '<div class="shd-poison-list-wrap"><button class="shd-poison-list-tog" id="poison-list-tog">Hide addresses \u25b4</button><div class="shd-poison-list" id="poison-list" style="display:block">' + filas + '</div></div>';
}
function tarjetaPoison(info, numOps) {
  const iconoOk = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const iconoX = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  if (numOps === 0) {
    return '<div class="shd-poison-card"><div class="shd-hash-big warn"><div class="shd-hash-bigic warn">' + iconoX + '</div><div><div class="shd-hash-bigt">No history</div><div class="shd-hash-bigs">This wallet has no recent activity to scan. Poisoning needs a transaction history to work against.</div></div></div></div>';
  }
  if (!info.amenazas.length) {
    return '<div class="shd-poison-card"><div class="shd-hash-big ok"><div class="shd-hash-bigic ok">' + iconoOk + '</div><div><div class="shd-hash-bigt">Clean</div><div class="shd-hash-bigs">No poisoning lookalike addresses found in this wallet\'s recent history. We checked ' + info.contrapartesTotales + ' addresses it interacted with.</div></div></div>' +
      '<div class="shd-poison-tip"><b>Stay safe.</b> Even so, never copy an address from your history. Use an address book or paste from the original source, and send a tiny test amount first for large transfers.</div>' + listaDirecciones(info) + '</div>';
  }
  // hay amenazas
  let items = info.amenazas.map(function (a) {
    return '<div class="shd-poison-threat">' +
      '<div class="shd-poison-threat-h">Fake lookalike found</div>' +
      '<div class="shd-poison-pair"><span class="shd-poison-lbl">Scammer address (avoid)</span><div class="shd-poison-addr bad">' + resaltar(a.falsa, a.prefijoIguales, a.sufijoIguales) + ' <button class="shd-wtok-copy" data-pcopy="' + a.falsa + '">⧉</button></div></div>' +
      '<div class="shd-poison-pair"><span class="shd-poison-lbl">Your real address</span><div class="shd-poison-addr good">' + resaltar(a.real, a.prefijoIguales, a.sufijoIguales) + ' <button class="shd-wtok-copy" data-pcopy="' + a.real + '">⧉</button></div></div>' +
      '<div class="shd-poison-note">They match the first ' + a.prefijoIguales + ' and last ' + a.sufijoIguales + ' characters. Only the middle differs. This is a trap.</div>' +
    '</div>';
  }).join('');
  return '<div class="shd-poison-card">' +
    '<div class="shd-hash-big bad"><div class="shd-hash-bigic bad">' + iconoX + '</div><div><div class="shd-hash-bigt">' + info.amenazas.length + ' poisoning threat' + (info.amenazas.length>1?'s':'') + ' found</div><div class="shd-hash-bigs">Someone planted fake lookalike addresses in this wallet\'s history to trick you into paying them by mistake. Nothing has been stolen and your funds are safe. The addresses below are the traps. Read what to do so this never costs you anything.</div></div></div>' +
    items +
    '<div class="shd-poison-tip"><b>Your funds are safe right now.</b> Finding these does not mean anything was stolen. It means someone planted a trap for the future. You do NOT need to move or abandon this wallet. The danger only appears the moment you copy an address from your history to send money. Follow these steps: first, never copy a payment address from your transaction history, not even once. Second, save the addresses you really use in an address book or the contacts of your wallet, and always paste from there. Third, before sending a large amount, send a tiny test first and confirm the receiver got it. Fourth, always check the full address, the middle characters too, not just the start and end. Fifth, if a wallet or site autofills an address, compare it letter by letter before you approve. Do this and address poisoning cannot touch you.</div>' + listaDirecciones(info) +
  '</div>';
}
function pintarHash(cuenta) {
  $('shd-barslot').innerHTML = cabecera();
  $('shd-in').innerHTML = `
    <div class="shd-hash-wrap">
      <div class="shd-hash-hero">
        <div class="shd-hash-icon">${IC.hash}</div>
        <h1>Transaction hash checker</h1>
        <p>Paste a BNB Smart Chain or TRON transaction hash to check if the transfer really happened. See in seconds whether it succeeded or failed, which wallet sent it, which wallet received it, exactly how much was moved and in which token, how many confirmations it has and when it was mined. Verify any payment before you trust it.</p>
      </div>
      <label class="shd-sim-lbl">Transaction hash</label>
      <input class="shd-sim-in" id="hash-in" placeholder="0x… (BSC) or 64-char hash (TRON)" autocomplete="off" spellcheck="false">
      <button class="shd-btn" id="hash-go" style="width:100%;margin-top:14px">${IC.hash} Verify transaction</button>
      <div id="hash-res"></div>
      <button class="shd-rescan" id="hash-back" style="margin-top:18px">Back</button>
    </div>`;
  wireBack(function () { pintarInicio(cuenta); });
  $('hash-back').onclick = () => pintarInicio(cuenta);
  $('hash-go').onclick = async () => {
    const h = $('hash-in').value.trim(); const res = $('hash-res');
    const esBsc = hashmod.esHash(h); const esTron = !esBsc && tron.esHashTron(h);
    if (!esBsc && !esTron) { res.innerHTML = `<div class="shd-sim-msg bad">Enter a valid transaction hash — 0x + 64 characters for BSC, or 64 characters for TRON.</div>`; return; }
    res.innerHTML = `<div class="shd-sim-loading"><div class="shd-radar" style="width:70px;height:70px"><div class="shd-radar-ring"></div><div class="shd-radar-sweep"></div><div class="shd-radar-core" style="inset:26px"></div></div><div style="color:#a7b0bb;font-size:13px;margin-top:10px">Reading the transaction…</div></div>`;
    try { const info = esTron ? await tron.tronVerificarHash(h) : await hashmod.verificar(h); res.innerHTML = tarjetaHash(info, h); wireHashCopy(); }
    catch (e) { res.innerHTML = `<div class="shd-sim-msg bad">Could not read that transaction. Check the hash and try again.</div>`; }
  };
  function wireHashCopy() {
    document.querySelectorAll('[data-hcopy]').forEach(function (b) { b.onclick = function () { try { navigator.clipboard.writeText(b.dataset.hcopy); const o = b.textContent; b.textContent = '✓'; setTimeout(function () { b.textContent = o; }, 1200); } catch (_) {} }; });
  }
}
function tarjetaHash(info, h) {
  const corta = function (a) { return a ? (a.slice(0,10) + '\u2026' + a.slice(-8)) : '\u2014'; };
  const esTron = info && info.red === 'tron';
  const netName = esTron ? 'TRON' : 'BNB Smart Chain';
  const scanUrl = esTron ? ('https://tronscan.org/#/transaction/' + h) : ('https://bscscan.com/tx/' + h);
  const scanName = esTron ? 'TronScan' : 'BscScan';
  const nativoSym = esTron ? 'TRX' : 'BNB';
  const iconoX = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const iconoOk = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const iconoWait = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  if (!info.existe) {
    return '<div class="shd-hash-card"><div class="shd-hash-big bad"><div class="shd-hash-bigic bad">' + iconoX + '</div><div><div class="shd-hash-bigt">Not found</div><div class="shd-hash-bigs">No transaction with this hash exists on ' + netName + '</div></div></div><div class="shd-hash-msg">Double check that you copied the full hash and that it belongs to ' + netName + ', not another network.</div></div>';
  }
  let bigClass, bigIc, bigT, bigS;
  if (info.pendiente) { bigClass = 'warn'; bigIc = iconoWait; bigT = 'Pending'; bigS = 'This transaction is not confirmed yet. Check again in a few seconds.'; }
  else if (info.exitosa) { bigClass = 'ok'; bigIc = iconoOk; bigT = 'Success'; bigS = 'This transaction was confirmed on the blockchain and cannot be reversed.'; }
  else { bigClass = 'bad'; bigIc = iconoX; bigT = 'Failed'; bigS = 'This transaction was mined but reverted. No funds were transferred. The sender still paid the gas fee.'; }
  const fecha = info.ts > 0 ? new Date(info.ts).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '\u2014';
  const hace = info.ts > 0 ? tiempoRel(info.ts) : '';
  let trans = '';
  if (info.transferencias.length) {
    trans = '<div class="shd-hash-sec-t">What moved</div><div class="shd-hash-transfers">' + info.transferencias.map(function (t) {
      const ini = (t.symbol||'?').slice(0,3).toUpperCase();
      const ic = t.logo ? ('<div class="shd-hash-tic"><img src="' + t.logo + '" onerror="this.style.display=\'none\';this.parentElement.textContent=\'' + ini + '\'"></div>') : ('<div class="shd-hash-tic">' + ini + '</div>');
      const usd = t.usd ? ('<span class="shd-hash-usd">\u2248 $' + t.usd.toLocaleString(undefined,{maximumFractionDigits:2}) + '</span>') : '';
      return '<div class="shd-hash-transfer">' + ic + '<div class="shd-hash-tinfo"><div class="shd-hash-tamt">' + t.cantidad.toLocaleString(undefined,{maximumFractionDigits:6}) + ' ' + escH(t.symbol) + ' ' + usd + '</div><div class="shd-hash-tflow"><span class="shd-hash-fw">' + corta(t.de) + '</span><span class="shd-hash-arrow">\u2192</span><span class="shd-hash-fw">' + corta(t.para) + '</span></div></div></div>';
    }).join('') + '</div>';
  }
  const filaDet = function (label, val) { return '<div class="shd-hash-d"><span>' + label + '</span><b>' + val + '</b></div>'; };
  let detalles = '<div class="shd-hash-sec-t">Details</div><div class="shd-hash-grid">';
  detalles += filaDet('Type', escH(info.tipoTx));
  detalles += filaDet('Confirmations', info.confirmaciones.toLocaleString());
  detalles += filaDet('Block', info.bloque ? info.bloque.toLocaleString() : '\u2014');
  if (!esTron)detalles += filaDet('Position in block', info.posicion != null ? ('#' + info.posicion) : '\u2014');
  detalles += filaDet('Network fee', info.comisionBNB.toLocaleString(undefined,{maximumFractionDigits:8}) + ' ' + nativoSym + (info.comisionUSD ? ' \u00b7 $' + info.comisionUSD.toLocaleString(undefined,{maximumFractionDigits:4}) : ''));
  if (!esTron)detalles += filaDet('Gas price', info.gweiPrecio.toLocaleString(undefined,{maximumFractionDigits:3}) + ' Gwei');
  if (!esTron)detalles += filaDet('Gas used', Number(info.gasUsado).toLocaleString());
  if (!esTron)detalles += filaDet('Nonce', info.nonce != null ? info.nonce.toLocaleString() : '\u2014');
  detalles += filaDet('Events emitted', info.numEventos.toLocaleString());
  detalles += filaDet('Date', fecha + (hace ? (' \u00b7 ' + hace) : ''));
  detalles += '</div>';
  const flujo = '<div class="shd-hash-sec-t">From and to</div><div class="shd-hash-fromto"><div class="shd-hash-ft"><span>From</span><b>' + corta(info.de) + ' <button class="shd-wtok-copy" data-hcopy="' + info.de + '">\u29c9</button></b></div><div class="shd-hash-ftarrow">\u2192</div><div class="shd-hash-ft"><span>To</span><b>' + corta(info.para) + ' <button class="shd-wtok-copy" data-hcopy="' + (info.para||'') + '">\u29c9</button></b></div></div>';
  return '<div class="shd-hash-card"><div class="shd-hash-big ' + bigClass + '"><div class="shd-hash-bigic ' + bigClass + '">' + bigIc + '</div><div><div class="shd-hash-bigt">' + bigT + '</div><div class="shd-hash-bigs">' + bigS + '</div></div></div>' + trans + flujo + detalles + '<a href="' + scanUrl + '" target="_blank" rel="noopener" class="shd-hash-scan">Open on ' + scanName + ' \u2197</a></div>';
}
function tiempoRel(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + ' seconds ago';
  if (s < 3600) return Math.floor(s/60) + ' minutes ago';
  if (s < 86400) return Math.floor(s/3600) + ' hours ago';
  return Math.floor(s/86400) + ' days ago';
}
function pintarWatcher(cuenta) {
  $('shd-barslot').innerHTML = cabecera();
  const seguidas = watch.listaSeguidas();
  let chips = '';
  if (seguidas.length) {
    const btns = seguidas.map(w => '<button class="shd-watch-chip" data-w="' + w.addr + '">' + w.addr.slice(0,6) + '…' + w.addr.slice(-4) + '</button>').join('');
    chips = '<div class="shd-watch-saved"><small>You are watching:</small> ' + btns + '</div>';
  }
  $('shd-in').innerHTML = `
    <div class="shd-watch-wrap">
      <div class="shd-watch-hero">
        <div class="shd-watch-icon">${IC.eye}</div>
        <h1>Wallet Watcher</h1>
        <p>Track any wallet on the blockchain. See every token it holds (even dust and spam), its total balance, and a live history of its moves with a link to verify each one on BscScan. Everything on the chain is public, so this breaks no rules. Follow whale wallets, watch your cold wallet, or keep an eye on a wallet you trade with.</p>
      </div>
      <label class="shd-sim-lbl">Wallet address to watch</label>
      <input class="shd-sim-in" id="watch-addr" placeholder="0x… (BSC) or T… (TRON) wallet" autocomplete="off" spellcheck="false">
      <button class="shd-btn" id="watch-go" style="width:100%;margin-top:14px">${IC.eye} Look inside</button>
      ${chips}
      <div id="watch-res">      <div id="watch-res">      <div id="watch-res"></div>
      <button class="shd-rescan" id="watch-back" style="margin-top:18px">Back</button>
    </div>`;
  wireBack(function () { pintarInicio(cuenta); });
  $('watch-back').onclick = () => pintarInicio(cuenta);

  const ir = async (addr) => {
    const cont = $('watch-res');
    if (!tron.redDe(addr)) { cont.innerHTML = `<div class="shd-sim-msg bad">Enter a valid wallet (0x… BSC or T… TRON)</div>`; return; }
    cont.innerHTML = `<div class="shd-sim-loading"><div class="shd-radar" style="width:70px;height:70px"><div class="shd-radar-ring"></div><div class="shd-radar-sweep"></div><div class="shd-radar-core" style="inset:26px"></div></div><div style="color:#a7b0bb;font-size:13px;margin-top:10px">Reading wallet…</div></div>`;
    try {
      if (tron.redDe(addr) === 'tron') {
        const datos_ = await tron.tronWatcherTokens(addr);
        window._shdHist = (datos_.moves || []); window._shdHistCargando = false;
        pintarWatchRes(cuenta, addr, datos_, (datos_.moves || []));
        ['st-val','st-age','st-tx','st-conc'].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = '—'; });
        const _ch = document.querySelector('[data-wt="hist"]'); if (_ch) _ch.textContent = 'Activity (' + (datos_.moves ? datos_.moves.length : 0) + ')';
        return;
      }
      const datos_ = await watch.tokensDe(addr);
      pintarWatchRes(cuenta, addr, datos_, []);
      // cargar en segundo plano: historial, stats y pnl (no bloquean la vista)
      // marcar el tab Activity como cargando mientras llega el historial amplio
      window._shdHistCargando = true; window._shdHist = null;
      (function () { const c = document.querySelector('[data-wt="hist"]'); if (c) c.innerHTML = 'Activity <span class="shd-wtab-load"></span>'; })();
      watch.historialAmplio(addr).then(function (h) {
        window._shdHist = h; window._shdHistCargando = false;
        const c = document.querySelector('[data-wt="hist"]'); if (c) c.textContent = 'Activity (' + h.length + ')';
        // si el tab de activity está abierto, repintarlo ahora que hay datos
        const tabH = document.querySelector('[data-wt="hist"]');
        if (tabH && tabH.classList.contains('on') && window._pintarActividad) window._pintarActividad();
        // marcar tokens recientes con el historial y repintar la lista de tokens si está visible
        try {
          watch.marcarRecientes(addr, datos_.tokens, h);
          // repintar la lista de tokens SOLO si el tab de tokens está activo (sin alternar)
          const tabTokens = document.querySelector('[data-wt="tokens"]');
          if (tabTokens && tabTokens.classList.contains('on')) { const pane = $('watch-pane'); if (pane) { pane.innerHTML = paneTokens(); wireTokTools(); wireTokBtns(); } }
        } catch (_) {}
      });
      Promise.all([ watch.estadisticas(addr), watch.pnlAprox(addr, datos_.tokens) ]).then(function (r) { pintarStats(addr, datos_, r[0], r[1]); });
    } catch (e) { cont.innerHTML = `<div class="shd-sim-msg bad">Could not read that wallet. Try again.</div>`; }
  };
  $('watch-go').onclick = () => ir($('watch-addr').value.trim());
  document.querySelectorAll('[data-w], .shd-reco').forEach(b => b.onclick = () => { $('watch-addr').value = b.dataset.w; ir(b.dataset.w); });
}
// Delegación global para el botón de eliminar token (cestico). Se instala una
// sola vez y funciona aunque la lista se repinte, porque escucha en el documento.
// Función global que abre el modal de eliminación. La llama el onclick inline
// del cestico, de modo que no depende de ningún wire ni delegación posterior.
window.__shdBorrar = function (i) {
  const t = (window.__shdToks || [])[i];
  if (!t) return;
  if (window._shdRevisarLimpieza) window._shdRevisarLimpieza([t]);
};
function pintarStats(addr, d, est, pnl) {
  est = est || {}; pnl = pnl || {};
  const set = function (id, v) { const e = $(id); if (e) e.textContent = v; };
  set('st-val', pnl.tokensConValor != null ? pnl.tokensConValor : '—');
  const dias = Number(est.edadDias) || 0;
  set('st-age', dias > 0 ? (dias > 365 ? (Math.floor(dias/365) + 'y') : (dias + 'd')) : '—');
  set('st-tx', est.txCount > 0 ? Number(est.txCount).toLocaleString() : '—');
  set('st-conc', pnl.concentracion > 0 ? (Math.round(pnl.concentracion) + '%') : '—');
}
function pintarWatchRes(cuenta, addr, d, hist) {
  const esPropia = cuenta && addr && cuenta.toLowerCase() === addr.toLowerCase();
  const redW = tron.redDe(addr) || 'bsc';
  window._watchAddr = addr;
  const cont = $('watch-res');
  const corta = addr.slice(0,6)+'…'+addr.slice(-4);
  const siguiendo = watch.estaSiguiendo(addr);
  const conValor = d.tokens.filter(t => t.usd > 0.01);
  const polvo = d.tokens.filter(t => t.usd <= 0.01);
  const filaTok = (t) => {
    const usdTxt = t.usd > 0.01 ? (' · $' + t.usd.toLocaleString(undefined,{maximumFractionDigits:2})) : '';
    const bal = t.balance.toLocaleString(undefined,{maximumFractionDigits:4});
    const ini = (t.symbol||'?').slice(0,3).toUpperCase();
    const ic = t.logo
      ? ('<div class="shd-wtok-ic"><img src="' + t.logo + '" alt="" onerror="this.style.display=\'none\';this.parentElement.textContent=\''+ini+'\'"></div>')
      : ('<div class="shd-wtok-ic">' + ini + '</div>');
    const corta = t.address ? (t.address.slice(0,8) + '…' + t.address.slice(-6)) : '';
    const nuevo = t.hoy ? '<span class="shd-tok-new hot">NEW · 24h</span>' : (t.reciente ? '<span class="shd-tok-new">NEW · ' + t.diasDesde + 'd</span>' : '');
    const _esTronT = t.red === 'tron';
    const _scanUrl = _esTronT ? ('https://tronscan.org/#/token20/' + t.address) : ('https://bscscan.com/token/' + t.address);
    const scan = t.address ? ('<a href="' + _scanUrl + '" target="_blank" rel="noopener" class="shd-wtok-scan" onclick="event.stopPropagation()">' + (_esTronT ? 'TronScan' : 'BscScan') + ' ↗</a>') : '';
    const copiar = t.address ? ('<button class="shd-wtok-copy" data-copy="' + t.address + '" onclick="event.stopPropagation()" title="Copy contract">⧉</button>') : '';
    const swap = (t.address && t.red !== 'tron') ? ('<button class="shd-wtok-swap" data-swap="' + t.address + '" onclick="event.stopPropagation()">Swap</button>') : '';
    // papelera (eliminar) solo en la wallet propia, separada del swap por una rayita difuminada
    // Guardamos el token en un registro global; el botón solo pasa su índice
    // (un número, sin comillas ni escapes que puedan romper el atributo).
    let _idx = -1;
    if (esPropia && t.address && t.red !== 'tron') {
      if (!window.__shdToks) window.__shdToks = [];
      _idx = window.__shdToks.length;
      window.__shdToks.push({ addr: t.address, raw: t.balanceRaw || '0x0', sym: t.symbol || '?', usd: t.usd || 0 });
    }
    const del = (_idx >= 0) ? ('<span class="shd-wtok-div"></span><button class="shd-wtok-del" onclick=window.__shdBorrar(' + _idx + ') title="Send this token out of your wallet"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>') : '';
    const selBox = '<label class="shd-tok-check" style="display:none"><input type="checkbox" class="shd-tok-cb" data-caddr="' + (t.address||'') + '" data-craw="' + (t.balanceRaw||'0x0') + '" data-csym="' + escH(t.symbol||'?') + '" data-cusd="' + (t.usd||0) + '"></label>';
    return '<div class="shd-wtok2" data-tokrow="' + escH((t.name||'') + ' ' + (t.symbol||'') + ' ' + (t.address||'')).toLowerCase() + '" data-new="' + (t.reciente?'1':'0') + '" data-today="' + (t.hoy?'1':'0') + '" data-usdval="' + (t.usd||0) + '">' +
      '<div class="shd-wtok-top">' + selBox + ic +
        '<div class="shd-wtok-info"><b>' + escH(t.name || t.symbol) + ' ' + nuevo + '</b><div class="shd-wtok-bal">' + bal + ' ' + escH(t.symbol) + usdTxt + '</div></div>' +
        '<div class="shd-wtok-btns">' + swap + del + '</div>' +
      '</div>' +
      (corta ? ('<div class="shd-wtok-contract"><span class="shd-wtok-addr">' + corta + '</span>' + copiar + scan + '</div>') : '') +
    '</div>';
  };
  function fmtNum(n) {
    n = Number(n) || 0;
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
    if (abs >= 0.0001) return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
    return n.toExponential(2);
  }
  const filaOp = (o) => {
    const fecha = o.ts > 0 ? new Date(o.ts).toLocaleString(undefined,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
    const cant = fmtNum(o.cantidad);
    const entra = o.tipo === 'in';
    const _esTronOp = o.red === 'tron';
    const _netOp = _esTronOp ? 'TRC20' : 'BEP20';
    const _txU = _esTronOp ? ('https://tronscan.org/#/transaction/' + (o.hash || '')) : ('https://bscscan.com/tx/' + (o.hash || ''));
    const _adU = function (a2) { return _esTronOp ? ('https://tronscan.org/#/address/' + (a2 || '')) : ('https://bscscan.com/address/' + (a2 || '')); };
    const sym = escH(o.symbol || '');
    const ini3 = (o.symbol || '?').slice(0,3).toUpperCase();
    const usd = o.usd ? ('\u2248 $' + o.usd.toLocaleString(undefined,{maximumFractionDigits:2}) + ' USD') : (fecha || '');
    const logoUrl = o.tokenLogo || null;
    const ic = logoUrl
      ? ('<div class="shd-tx-logo"><img src="' + logoUrl + '" onerror="this.style.display=\'none\';this.parentElement.childNodes[0].textContent=\''+ini3+'\'"><span class="shd-tx-badge ' + (entra?'in':'out') + '">' + (entra?'\u2193':'\u2191') + '</span></div>')
      : ('<div class="shd-tx-logo"><span class="shd-tx-logo-txt">' + ini3 + '</span><span class="shd-tx-badge ' + (entra?'in':'out') + '">' + (entra?'\u2193':'\u2191') + '</span></div>');
    const wObs = window._watchAddr || '';
    const from = entra ? (o.contraparte || '') : wObs;
    const to = entra ? wObs : (o.contraparte || '');
    const cortaF = from ? (from.slice(0,6) + '\u2026' + from.slice(-4)) : '\u2014';
    const cortaT = to ? (to.slice(0,6) + '\u2026' + to.slice(-4)) : '\u2014';
    const walletIc = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M16 12h.01M3 9h18"/></svg>';
    const copyIc = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
    return '<div class="shd-tx">' +
      '<div class="shd-tx-net"><span class="shd-tx-net-dot"></span>' + _netOp + '</div>' +
      '<div class="shd-tx-top">' + ic +
        '<div class="shd-tx-amt"><b class="' + (entra?'pos':'neg') + '">' + (entra?'+':'\u2212') + cant + ' ' + sym + '</b><small>' + usd + '</small></div>' +
      '</div>' +
      '<div class="shd-tx-divider"></div>' +
      '<div class="shd-tx-route">' +
        '<div class="shd-tx-node"><span class="shd-tx-node-ic">' + walletIc + '</span><div class="shd-tx-node-txt"><small>From</small><b>' + cortaF + '</b></div><button class="shd-wop2-copy" data-wcopy="' + from + '">' + copyIc + '</button></div>' +
        '<div class="shd-tx-arrow">\u2192</div>' +
        '<div class="shd-tx-node"><span class="shd-tx-node-ic">' + walletIc + '</span><div class="shd-tx-node-txt"><small>To</small><b>' + cortaT + '</b></div><button class="shd-wop2-copy" data-wcopy="' + to + '">' + copyIc + '</button></div>' +
      '</div>' +
      '<div class="shd-tx-links">' +
        '<a href="' + _txU + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l-4 4 4 4M3 14h13M17 14l4-4-4-4M21 10H8"/></svg> Tx \u203a</a>' +
        '<a href="' + _adU(from) + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg> Sender \u203a</a>' +
        '<a href="' + _adU(to) + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M16 12h.01"/></svg> Receiver \u203a</a>' +
      '</div>' +
    '</div>';
  };;;;;
  cont.innerHTML = `
    <div class="shd-watch-head">
      <div><div class="shd-watch-addr">${corta} <button class="shd-wtok-copy" data-copy="${addr}" title="Copy">⧉</button> <a href="${redW==='tron'?'https://tronscan.org/#/address/'+addr:'https://bscscan.com/address/'+addr}" target="_blank" rel="noopener" class="shd-wtok-scan">${redW==='tron'?'TronScan':'BscScan'} ↗</a></div>
        <div class="shd-watch-total">$${d.totalUSD.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} <small>total value</small></div></div>
      <button class="shd-watch-follow ${siguiendo?'on':''}" id="watch-follow">${siguiendo ? '✓ Watching' : '+ Watch this wallet'}</button>
    </div>
    <div class="shd-stats" id="shd-stats">
      <div class="shd-stat"><b id="st-tokens">${d.tokens.length}</b><span>tokens held</span></div>
      <div class="shd-stat"><b id="st-val">…</b><span>real positions</span></div>
      <div class="shd-stat"><b id="st-age">…</b><span>wallet age</span></div>
      <div class="shd-stat"><b id="st-tx">…</b><span>transactions</span></div>
      <div class="shd-stat"><b id="st-conc">…</b><span>top holding</span></div>
    </div>
    <div class="shd-watch-tabs"><button class="shd-wtab on" data-wt="tokens">Tokens (${d.tokens.length})</button><button class="shd-wtab" data-wt="hist">Activity (${hist.length})</button></div>
    <div id="watch-pane"></div>`;
  const paneTokens = () => {
    window.__shdToks = [];
    let h = '<div class="shd-tok-tools">' +

      '<div class="shd-tok-bar">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.5;flex:none"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
        '<input class="shd-tok-search" id="tok-search" placeholder="Search tokens by name, symbol or contract" autocomplete="off">' +
        (esPropia ? '<button class="shd-tok-fbtn" id="clean-toggle" title="Select tokens to clean"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg></button>' : '') +
        '<button class="shd-tok-fbtn" id="tok-fbtn" title="Filter"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg><span id="tok-fbadge"></span></button>' +
        '<div class="shd-tok-pop" id="tok-pop">' +
          '<button class="shd-tok-popf on" data-f="all">All tokens</button>' +
          '<button class="shd-tok-popf" data-f="today">Bought in last 24h</button>' +
          '<button class="shd-tok-popf" data-f="week">Bought this week</button>' +
          '<button class="shd-tok-popf" data-f="value">Only with USD value</button>' +
        '</div>' +
      '</div>' +
      '<div class="shd-clean-bar" id="clean-bar" style="display:none"><div class="shd-clean-actions"><button class="shd-clean-sel" id="clean-zero">Zero value</button><button class="shd-clean-sel" id="clean-all">All</button><button class="shd-clean-sel" id="clean-none">Clear</button></div><button class="shd-clean-go" id="clean-go">Delete selected</button></div>' +
      '</div>';
    h += '<div class="shd-wtoks" id="tok-list">';
    if (d.nativo > 0) h += filaTok(redW === 'tron'
      ? { symbol: 'TRX', balance: d.nativo, usd: d.nativoUSD, logo: 'https://static.tronscan.org/production/logo/trx.png', red: 'tron' }
      : { symbol: 'BNB', balance: d.nativo, usd: d.nativoUSD, logo: watch.logoBNB() });
    h += conValor.map(filaTok).join('');
    if (polvo.length) { h += `<div class="shd-watch-dust">${polvo.length} dust / spam token${polvo.length>1?'s':''} (zero or near-zero value)</div>`; h += polvo.map(filaTok).join(''); }
    return h + '</div>';
  };
  function wireTokTools() {
    const inp = $('tok-search');
    const fbtn = $('tok-fbtn'); const pop = $('tok-pop'); const badge = $('tok-fbadge');
    let fActivo = 'all';
    function aplicar() {
      const q = (inp && inp.value || '').trim().toLowerCase();
      document.querySelectorAll('[data-tokrow]').forEach(function (row) {
        const txt = row.getAttribute('data-tokrow') || '';
        const esNew = row.getAttribute('data-new') === '1';
        const esToday = row.getAttribute('data-today') === '1';
        const bal = row.querySelector('.shd-wtok-bal');
        const tieneVal = bal && /\$/.test(bal.textContent);
        let ok = q === '' || txt.indexOf(q) !== -1;
        if (ok && fActivo === 'today') ok = esToday;
        if (ok && fActivo === 'week') ok = esNew;
        if (ok && fActivo === 'value') ok = tieneVal;
        row.style.display = ok ? '' : 'none';
      });
      // ocultar los separadores de dust si el filtro está activo
      document.querySelectorAll('.shd-watch-dust').forEach(function (d) { d.style.display = fActivo === 'all' && q === '' ? '' : 'none'; });
    }
    if (inp) inp.oninput = aplicar;
    if (fbtn && pop) {
      fbtn.onclick = function (e) { e.stopPropagation(); pop.classList.toggle('open'); };
      document.addEventListener('click', function (e) { if (pop.classList.contains('open') && !pop.contains(e.target) && e.target !== fbtn && !fbtn.contains(e.target)) pop.classList.remove('open'); });
      pop.querySelectorAll('[data-f]').forEach(function (b) {
        b.onclick = function () {
          pop.querySelectorAll('[data-f]').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on'); fActivo = b.dataset.f;
          // badge: punto dorado si no es "all"
          if (badge) badge.className = fActivo === 'all' ? '' : 'dot';
          if (fbtn) fbtn.classList.toggle('active', fActivo !== 'all');
          pop.classList.remove('open');
          aplicar();
        };
      });
    }
  }
  let _modoLimpieza = false;
  function wireLimpieza(cuenta, addr) {
    const tog = $('clean-toggle');
    if (!tog) return;
    const bar = $('clean-bar');
    tog.onclick = function () {
      _modoLimpieza = !_modoLimpieza;
      document.querySelectorAll('.shd-tok-check').forEach(function (c) { c.style.display = _modoLimpieza ? 'flex' : 'none'; });
      tog.classList.toggle('active', _modoLimpieza);
      tog.title = _modoLimpieza ? 'Cancel selection' : 'Select tokens to clean';
      if (bar) bar.style.display = _modoLimpieza ? 'flex' : 'none';
      if (!_modoLimpieza) document.querySelectorAll('.shd-tok-cb').forEach(function (cb) { cb.checked = false; });
    };
    if (bar) {
      const z = $('clean-zero'), a = $('clean-all'), n = $('clean-none'), g = $('clean-go');
      if (z) z.onclick = function () { document.querySelectorAll('.shd-tok-cb').forEach(function (cb) { cb.checked = Number(cb.dataset.cusd) <= 0.01; }); };
      if (a) a.onclick = function () { document.querySelectorAll('.shd-tok-cb').forEach(function (cb) { cb.checked = true; }); };
      if (n) n.onclick = function () { document.querySelectorAll('.shd-tok-cb').forEach(function (cb) { cb.checked = false; }); };
      if (g) g.onclick = function () { revisarLimpieza(cuenta, addr); };
    }
  }
  function revisarLimpieza(cuenta, addr) {
    const sel = [];
    document.querySelectorAll('.shd-tok-cb').forEach(function (cb) { if (cb.checked && cb.dataset.caddr) sel.push({ addr: cb.dataset.caddr, raw: cb.dataset.craw, sym: cb.dataset.csym, usd: Number(cb.dataset.cusd) }); });
    revisarLimpiezaLista(sel);
  }
  window._shdRevisarLimpieza = revisarLimpiezaLista;
  function revisarLimpiezaLista(sel) {
    if (!sel.length) { return; }
    const valorTotal = sel.reduce(function (a, t) { return a + t.usd; }, 0);
    const conValor = sel.filter(function (t) { return t.usd > 0.01; });
    // modal de confirmación
    const modal = document.createElement('div'); modal.className = 'shd-clean-modal'; modal.id = 'clean-modal';
    let lista = sel.map(function (t, i) {
      const v = t.usd > 0.01 ? ('$' + t.usd.toLocaleString(undefined,{maximumFractionDigits:2})) : 'no value';
      return '<div class="shd-clean-item"><span>' + escH(t.sym) + ' <small>' + v + '</small></span><button class="shd-clean-remove" data-ri="' + i + '">Keep this</button></div>';
    }).join('');
    modal.innerHTML = '<div class="shd-clean-box">' +
      '<div class="shd-clean-title">Send ' + sel.length + ' token' + (sel.length>1?'s':'') + ' out of your wallet?</div>' +
      (conValor.length ? '<div class="shd-clean-warn">Careful: ' + conValor.length + ' of these still hold value (about $' + valorTotal.toLocaleString(undefined,{maximumFractionDigits:2}) + ' in total). Once sent they are gone for good. Keep anything you might want.</div>' : '<div class="shd-clean-note">These tokens have no value. Sending them just clears the clutter. This cannot be undone.</div>') +
      '<div class="shd-clean-list" id="clean-list">' + lista + '</div>' +
      '<div class="shd-clean-btns"><button class="shd-rescan" id="clean-cancel">Cancel</button><button class="shd-btn shd-btn-danger" id="clean-confirm">Send ' + sel.length + ' out</button></div>' +
    '</div>';
    document.body.appendChild(modal);
    // quitar items de la lista
    modal.querySelectorAll('[data-ri]').forEach(function (b) { b.onclick = function () { const i = Number(b.dataset.ri); sel[i]._quitar = true; b.closest('.shd-clean-item').style.opacity = '.35'; b.textContent = 'Kept'; b.disabled = true; }; });
    $('clean-cancel').onclick = function () { modal.remove(); };
    $('clean-confirm').onclick = async function () {
      const finales = sel.filter(function (t) { return !t._quitar; });
      if (!finales.length) { modal.remove(); return; }
      const btn = $('clean-confirm'); btn.disabled = true;
      const cont = $('clean-list');
      for (let i = 0; i < finales.length; i++) {
        const t = finales[i];
        btn.textContent = 'Confirm in wallet… (' + (i+1) + '/' + finales.length + ')';
        try { await rescue.evacuarADead(t.addr, BigInt(t.raw)); }
        catch (e) { /* si rechaza uno, seguimos con los demás */ }
      }
      btn.textContent = 'Done'; 
      setTimeout(function () { modal.remove(); const g = $('watch-go'); if (g) g.click(); }, 800);
    };
  }
  function pintarActividad() {
    const pane = $('watch-pane'); if (!pane) return;
    const H = (window._shdHist && window._shdHist.length) ? window._shdHist : null;
    if (H && H.length) {
      const barra = '<div class="shd-act-bar"><div class="shd-act-tabs"><button class="shd-act-f on" data-af="all">All</button><button class="shd-act-f" data-af="in">Received</button><button class="shd-act-f" data-af="out">Sent</button></div><div class="shd-act-search"><input id="act-search" placeholder="Token symbol"><button class="shd-act-go" id="act-go"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></button></div></div>';
      pane.innerHTML = barra + '<div class="shd-wops" id="act-list"></div><div id="act-more-wrap"></div>';
      renderActividad(H, 'all', '');
      wireActFilter(H);
    } else if (window._shdHistCargando) {
      pane.innerHTML = '<div class="shd-act-loading"><div class="shd-act-spin"></div><div class="shd-act-loadtx">Reading activity from the chain…</div></div>';
    } else {
      pane.innerHTML = '<div class="shd-empty">No activity found for this wallet.</div>';
    }
  }
  // renderiza la actividad PAGINADA (25 por tanda) para no colapsar el navegador
  let _actMostradas = 0; let _actFiltradas = [];
  function renderActividad(H, fTipo, q) {
    _actFiltradas = H.filter(function (o) {
      if (fTipo === 'in' && o.tipo !== 'in') return false;
      if (fTipo === 'out' && o.tipo !== 'out') return false;
      if (q && (o.symbol || '').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    _actMostradas = 0;
    const lst = document.getElementById('act-list'); if (lst) lst.innerHTML = '';
    masActividad();
  }
  function masActividad() {
    const lst = document.getElementById('act-list'); if (!lst) return;
    const TANDA = 25;
    const trozo = _actFiltradas.slice(_actMostradas, _actMostradas + TANDA);
    lst.insertAdjacentHTML('beforeend', trozo.map(filaOp).join(''));
    _actMostradas += trozo.length;
    wireOpBtns();
    const wrap = document.getElementById('act-more-wrap');
    if (wrap) {
      if (_actMostradas < _actFiltradas.length) {
        wrap.innerHTML = '<button class="shd-act-more" id="act-more">Show more (' + (_actFiltradas.length - _actMostradas) + ' left)</button>';
        const mb = document.getElementById('act-more'); if (mb) mb.onclick = masActividad;
      } else if (_actFiltradas.length === 0) {
        wrap.innerHTML = '<div class="shd-empty">No transactions match.</div>';
      } else { wrap.innerHTML = ''; }
    }
  }
  window._pintarActividad = pintarActividad;
  function wireActFilter(H) {
    let fTipo = 'all';
    const inp = document.getElementById('act-search');
    function aplicar() {
      const q = (inp && inp.value || '').trim().toLowerCase();
      renderActividad(H, fTipo, q);
    }
    document.querySelectorAll('[data-af]').forEach(function (b) { b.onclick = function () { document.querySelectorAll('[data-af]').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); fTipo = b.dataset.af; aplicar(); }; });
    const go = document.getElementById('act-go'); if (go) go.onclick = aplicar;
    if (inp) inp.onkeydown = function (e) { if (e.key === 'Enter') aplicar(); };
  }
  function wireOpBtns() {
    document.querySelectorAll('[data-wcopy]').forEach(function (b) { b.onclick = function () { const v = b.dataset.wcopy; if (!v) return; try { navigator.clipboard.writeText(v); const o = b.textContent; b.textContent = '\u2713'; setTimeout(function () { b.textContent = o; }, 1200); } catch (_) {} }; });
  }
  function wireTokBtns() {
    document.querySelectorAll('[data-copy]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); try { navigator.clipboard.writeText(b.dataset.copy); const o = b.textContent; b.textContent = '✓'; setTimeout(function () { b.textContent = o; }, 1200); } catch (_) {} }; });
    // (el clic del cestico se maneja por delegación global, más abajo)
    document.querySelectorAll('[data-swap]').forEach(function (b) { b.onclick = function (e) {
      e.stopPropagation();
      // velo negro instantáneo para tapar la transición (nada de pestañazo al lobby)
      var velo = document.createElement('div');
      velo.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;opacity:1';
      document.body.appendChild(velo);
      setTimeout(function () { location.href = 'index.html?abrir=swap&token=' + b.dataset.swap; }, 30);
    }; });
  }
  // seguir/dejar
  // Pintar los tokens de inmediato (sin tener que tocar el tab)
  const _pane0 = $('watch-pane');
  if (_pane0) { _pane0.innerHTML = paneTokens(); wireTokTools(); wireTokBtns(); wireLimpieza(cuenta, addr); }
  const fb = $('watch-follow');
  fb.onclick = () => {
    if (watch.estaSiguiendo(addr)) { watch.dejarSeguir(addr); fb.className='shd-watch-follow'; fb.textContent='+ Watch this wallet'; }
    else { watch.seguir(addr); fb.className='shd-watch-follow on'; fb.textContent='✓ Watching'; }
  };
  // tabs
  document.querySelectorAll('[data-wt]').forEach(b => b.onclick = () => {
    document.querySelectorAll('[data-wt]').forEach(x=>x.classList.remove('on')); b.classList.add('on');
    const pane = $('watch-pane');
    if (b.dataset.wt === 'hist') {
      pintarActividad();
        } else {
      pane.innerHTML = paneTokens();
      wireTokTools();
      wireTokBtns();
      wireLimpieza(cuenta, addr);
    }
  });
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
  wireBack(function () { pintarInicio(cuenta); });
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
  // ¿el usuario tiene suficiente BNB para el gas de las transferencias?
  const gasMinimo = 1000000000000000n; // ~0.001 BNB
  const sinGas = act.nativo < gasMinimo;
  const bannerGas = sinGas ? `
    <div class="shd-resc-gas">
      <div class="shd-resc-gas-t">${IC.gas} You are low on BNB for gas</div>
      <div class="shd-resc-gas-s">Each transfer needs a little BNB for gas. Claim free gas first so you can move your tokens out.</div>
      <button class="shd-resc-gas-btn" id="resc-getgas">Get free gas first</button>
      <div class="shd-resc-gas-msg" id="resc-gas-msg"></div>
    </div>` : '';
  cont.innerHTML = `
    <div class="shd-resc-dest">Moving everything to <b>${corta}</b></div>
    ${bannerGas}
    <div class="shd-resc-items">${items}${nativoItem}</div>
    <button class="shd-btn shd-btn-danger" id="resc-go" style="width:100%;margin-top:16px">Move all to safety (${act.tokens.length + (tieneNativo?1:0)} transfers)</button>
    <div class="shd-resc-note">You will sign each transfer in your wallet, one by one. Keep confirming until all are done.</div>`;
  // wire del botón de gas de emergencia
  const gg = $('resc-getgas');
  if (gg) gg.onclick = async () => {
    const msg = $('resc-gas-msg');
    gg.style.pointerEvents = 'none'; gg.style.opacity = '.6';
    if (msg) msg.innerHTML = '<span style="color:#a7b0bb">Confirm in your wallet…</span>';
    try {
      await pago.reclamarFaucet();
      if (msg) msg.innerHTML = '<span style="color:#2ebd85">Gas received. You can move your tokens now.</span>';
    } catch (e) {
      gg.style.pointerEvents = ''; gg.style.opacity = '';
      const err = (e && e.message) || '';
      if (/EnfriamientoActivo|cooldown/i.test(err)) { if (msg) msg.innerHTML = '<span style="color:#e8b84b">You already claimed gas recently. Use another wallet with a little BNB to send gas here, or wait.</span>'; }
      else if (/PozoVacio|empty/i.test(err)) { if (msg) msg.innerHTML = '<span style="color:#f6465d">The gas pool is empty right now. You will need a little BNB from another source.</span>'; }
      else if (/rejected|denied|user/i.test(err)) { if (msg) msg.innerHTML = '<span style="color:#a7b0bb">Cancelled.</span>'; }
      else { if (msg) msg.innerHTML = '<span style="color:#f6465d">Could not get gas right now. Try again.</span>'; }
    }
  };
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
function pintarSelectorScan(cuenta) {
  const corta = cuenta.slice(0, 10) + '\u2026' + cuenta.slice(-8);
  $('shd-barslot').innerHTML = cabecera();
  $('shd-in').innerHTML = `
    <div class="shd-hero" style="padding-bottom:10px"><h1>Permission scan</h1><p>Scan your connected wallet, or paste any other wallet. BSC and TRON are both supported.</p></div>
    <div class="shd-scansel">
      <button class="shd-scansel-mine" id="scansel-mine">
        <span class="shd-scansel-ic">${IC.shield}</span>
        <span class="shd-scansel-tx"><small>Your connected wallet</small><b>${corta}</b></span>
        <span class="shd-net-badge bsc">BSC</span>
      </button>
      <div class="shd-scansel-or"><span>or scan another wallet</span></div>
      <div class="shd-scansel-row">
        <input class="shd-sim-in" id="scansel-inp" placeholder="Paste a 0x\u2026 (BSC) or T\u2026 (TRON) address" autocomplete="off" spellcheck="false">
        <span class="shd-net-badge" id="scansel-badge"></span>
      </div>
      <button class="shd-card-btn gold" id="scansel-go">Scan this wallet</button>
    </div>`;
  wireBack(function () { pintarInicio(cuenta); });
  $('scansel-mine').onclick = function () { escanear(cuenta, cuenta); };
  const inp = $('scansel-inp'); const badge = $('scansel-badge'); const go = $('scansel-go');
  function refrescar() {
    const r = tron.redDe((inp.value || '').trim());
    badge.textContent = r ? r.toUpperCase() : '';
    badge.className = 'shd-net-badge' + (r ? ' ' + r : '');
  }
  inp.oninput = refrescar;
  function lanzar() {
    const v = (inp.value || '').trim();
    const r = tron.redDe(v);
    if (!r) { badge.textContent = 'Invalid'; badge.className = 'shd-net-badge bad'; inp.style.borderColor = '#f6465d'; return; }
    escanear(cuenta, v);
  }
  go.onclick = lanzar;
  inp.onkeydown = function (e) { if (e.key === 'Enter') lanzar(); };
}
async function escanear(cuenta, objetivo) {
  const dir = objetivo || cuenta;
  const red = tron.redDe(dir) || 'bsc';
  // Pasos del escaneo: cada uno aparece, muestra "checking…" y luego se marca ✓.
  const pasos = [
    (red === 'tron' ? 'Connecting to the TRON network' : 'Connecting to BNB Smart Chain'),
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
  wireBack(function () { pintarInicio(cuenta); });
  const cont = $('shd-steps');
  // lanzar el escaneo real en paralelo
  let permisos = null, error = false, estad = {};
  let tarea, tareaStats;
  if (red === 'tron') {
    tarea = tron.tronApprovals(dir).then(r => { permisos = r; }).catch(() => { error = true; });
    tareaStats = Promise.resolve();
  } else {
    tarea = datos.escanearApprovals(dir, () => {}).then(r => { permisos = r; }).catch(() => { error = true; });
    tareaStats = watch.estadisticas(dir).then(function (e) { estad = e || {}; }).catch(function () {});
  }
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
  await Promise.all([tarea, tareaStats, minTiempo]);
  // un último check
  const fin = document.createElement('div'); fin.className = 'shd-step'; fin.innerHTML = `<span class="shd-step-ic done">✓</span><span class="shd-step-tx" style="color:#2ebd85">Scan complete</span>`;
  if (cont) cont.appendChild(fin);
  await new Promise(r => setTimeout(r, 600));
  pintarResultados(cuenta, permisos || [], estad, dir);
}

function pintarResultados(cuenta, permisos, estad, dirEscaneada) {
  estad = estad || {};
  const walletVista = dirEscaneada || cuenta;
  const externos = permisos.filter(p => !p.nuestro);
  const nuestros = permisos.filter(p => p.nuestro);
  const peligrosos = externos.filter(p => p.ilimitado).length;
  const sc = calcularScore(permisos, estad);
  const plat = plataformasDe(permisos);
  $('shd-barslot').innerHTML = cabecera();
  const pct = sc.score / 100; const circ = 283; const off = circ * (1 - pct);
  const esOtra = walletVista && (walletVista.toLowerCase() !== (cuenta||'').toLowerCase());
  let html = '';
  if (esOtra) html += '<div class="shd-viewing"><span class="shd-viewing-ic"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#6aa8f0" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></span><div><small>You are scanning another wallet</small><b>' + walletVista.slice(0,10) + '\u2026' + walletVista.slice(-8) + '</b></div></div>';
  html += '<div class="shd-audit-hero">'  +
    '<div class="shd-score-ring"><svg viewBox="0 0 110 110" width="150" height="150"><circle cx="55" cy="55" r="45" fill="none" stroke="#12161c" stroke-width="9"/><circle cx="55" cy="55" r="45" fill="none" stroke="' + sc.color + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + circ + '" stroke-dashoffset="' + off + '" transform="rotate(-90 55 55)" style="transition:stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)"/></svg><div class="shd-score-mid"><div class="shd-score-n" style="color:' + sc.color + '">' + sc.score + '</div><div class="shd-score-max">/ 100</div></div></div>' +
    '<div class="shd-audit-side"><div class="shd-audit-badge" style="background:' + sc.color + '22;color:' + sc.color + ';border-color:' + sc.color + '55">' + sc.riesgo + '</div><div class="shd-audit-lvl" style="color:' + sc.color + '">' + sc.nivel + '</div><div class="shd-audit-sub">Wallet security score</div><div class="shd-audit-stats"><div class="shd-sstat"><b>' + (externos.length + nuestros.length) + '</b><span>permissions</span></div><div class="shd-sstat"><b style="color:' + (peligrosos?'#f6465d':'#2ebd85') + '">' + peligrosos + '</b><span>risky</span></div><div class="shd-sstat"><b style="color:#2ebd85">' + nuestros.length + '</b><span>trusted</span></div></div></div>' +
  '</div>';
  // barra para escanear OTRA wallet
  html += '<div class="shd-scan-other"><input id="scan-other-inp" placeholder="Paste any wallet address to scan it" autocomplete="off" spellcheck="false" value="' + (walletVista && walletVista.toLowerCase() !== (cuenta||'').toLowerCase() ? walletVista : '') + '"><button class="shd-scan-other-go" id="scan-other-go">Scan</button></div>';
  // desglose con INFORMACIÓN REAL: cada tarjeta muestra un dato concreto + una barra que refleja su puntuación
  html += '<div class="shd-audit-sec-t">Security breakdown</div><div class="shd-audit-comps">';
  for (const c of sc.componentes) {
    const cCol = c.valor >= 85 ? '#2ebd85' : (c.valor >= 60 ? '#5ac8fa' : (c.valor >= 40 ? '#e8b84b' : '#f6465d'));
    const etiqueta = c.valor >= 85 ? 'Strong' : (c.valor >= 60 ? 'Good' : (c.valor >= 40 ? 'Weak' : 'Poor'));
    html += '<div class="shd-comp">' +
      '<div class="shd-comp-head"><span class="shd-comp-name">' + escH(c.nombre) + '</span><span class="shd-comp-badge" style="color:' + cCol + ';background:' + cCol + '1a">' + etiqueta + '</span></div>' +
      '<div class="shd-comp-bar"><span style="width:' + Math.max(3, c.valor) + '%;background:' + cCol + '"></span></div>' +
      '<div class="shd-comp-detail">' + escH(c.detalle) + '</div>' +
    '</div>';
  }
  html += '</div>';
  // ── DATOS DUROS: qué encontramos exactamente ──
  {
    const totalPerm = externos.length + nuestros.length;
    const unl = externos.filter(function(x){return x.ilimitado;}).length;
    const lim = externos.filter(function(x){return !x.ilimitado;}).length;
    const items = [
      { n: totalPerm, l: 'active permission' + (totalPerm!==1?'s':''), c: '#eaecef' },
      { n: unl, l: 'unlimited approval' + (unl!==1?'s':''), c: unl>0?'#f6465d':'#2ebd85' },
      { n: lim, l: 'limited approval' + (lim!==1?'s':''), c: lim>0?'#e8b84b':'#2ebd85' },
      { n: plat.conocidas, l: 'known platform' + (plat.conocidas!==1?'s':''), c: '#2ebd85' },
      { n: plat.desconocidas, l: 'unknown contract' + (plat.desconocidas!==1?'s':''), c: plat.desconocidas>0?'#f6465d':'#2ebd85' },
      { n: nuestros.length, l: 'trusted (our platform)', c: '#E8B84B' }
    ];
    html += '<div class="shd-audit-sec-t">What we found</div><div class="shd-found">';
    for (const it of items) { html += '<div class="shd-found-cell"><b style="color:' + it.c + '">' + it.n + '</b><span>' + it.l + '</span></div>'; }
    html += '</div>';
  }
  if (plat.plataformas.length) {
    html += '<div class="shd-audit-sec-t">Platforms this wallet has connected to</div><div class="shd-plats">';
    for (const pl of plat.plataformas) {
      let est, estCls, estIc;
      if (pl.estado === 'nuestro') { est = 'Our platform'; estCls = 'ours'; estIc = '\u2713'; }
      else if (pl.estado === 'conocido') { est = 'Known & safe'; estCls = 'known'; estIc = '\u2713'; }
      else { est = 'Unknown'; estCls = 'unknown'; estIc = '?'; }
      const nombre = pl.nombre || (pl.addr.slice(0,8) + '\u2026' + pl.addr.slice(-6));
      const cAddr = pl.addr.slice(0,10) + '\u2026' + pl.addr.slice(-8);
      html += '<div class="shd-plat ' + estCls + '">' +
        '<div class="shd-plat-ic">' + (pl.nombre ? escH((pl.nombre[0]||'?').toUpperCase()) : '?') + '</div>' +
        '<div class="shd-plat-info"><b>' + escH(nombre) + '</b><span>' + escH(pl.tipo) + '</span><a class="shd-plat-addr" href="https://bscscan.com/address/' + pl.addr + '" target="_blank" rel="noopener">' + cAddr + ' \u2197</a></div>' +
        '<div class="shd-plat-tag ' + estCls + '">' + estIc + ' ' + est + '</div>' +
      '</div>';
    }
    html += '</div>';
    if (plat.desconocidas > 0) html += '<div class="shd-plat-note">' + plat.desconocidas + ' unrecognised contract' + (plat.desconocidas>1?'s':'') + '. If you do not remember using ' + (plat.desconocidas>1?'them':'it') + ', revoke below.</div>';
  }
  if (sc.consejos.length) html += '<div class="shd-consejo" style="margin:18px 0">\ud83d\udca1 ' + escH(sc.consejos[0]) + '</div>';
  html += '<div class="shd-res-head"><h2>Permissions</h2><div class="shd-res-btns"><button class="shd-rescan" id="shd-back2">Back</button><button class="shd-rescan" id="shd-rescan">Scan again</button></div></div>';
  if (permisos.length === 0) {
    html += '<div class="shd-safe"><div class="ic">' + IC.check + '</div><h2 style="margin:0 0 6px;color:#eaecef">Your wallet is clean</h2><p style="margin:0">No active permissions found. Nothing to revoke.</p></div>';
  } else {
    if (externos.length) { html += '<div class="shd-group-t risk">\u26a0 External permissions</div>' + externos.map(filaPerm).join(''); }
    if (nuestros.length) { html += '<div class="shd-group-t trust">\u2713 Trusted \u00b7 Cripto Cuba</div>' + nuestros.map(filaPerm).join(''); }
  }
  html += '<div class="shd-how"><b>Tip.</b> Revoking a permission only stops future spending. It never moves or risks your funds. Revoke anything you do not recognise or no longer use.</div>';
  $('shd-in').innerHTML = html;
  wireBack(function () { pintarInicio(cuenta); });
  const bb = $('shd-back2'); if (bb) bb.onclick = () => pintarInicio(cuenta);
  $('shd-rescan').onclick = () => escanear(cuenta, walletVista);
  const soGo = $('scan-other-go'); const soInp = $('scan-other-inp');
  function scanOtra() { const v = (soInp && soInp.value || '').trim(); if (tron.redDe(v)) escanear(cuenta, v); else if (soInp) { soInp.style.borderColor = '#f6465d'; } }
  if (soGo) soGo.onclick = scanOtra;
  if (soInp) soInp.onkeydown = function (e) { if (e.key === 'Enter') scanOtra(); };
  document.querySelectorAll('[data-revoke]').forEach(b => {
    b.onclick = async () => {
      const [token, spender] = b.dataset.revoke.split('|');
      b.disabled = true; b.textContent = 'Revoking...';
      try { await datos.revocar(token, spender); b.closest('.shd-perm').style.opacity = '.4'; b.textContent = 'Revoked'; }
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
    ? `<div class="exp bad">Unlimited access, high risk if unknown</div>`
    : `<div class="exp warn">Limited approval</div>`;
  const btnRev = (p.red === 'tron')
    ? '<button class="shd-revoke" disabled title="Revoking on TRON needs TronLink (coming soon)" style="opacity:.5;cursor:default">Revoke</button>'
    : '<button class="shd-revoke" data-revoke="' + p.token + '|' + p.spender + '">Revoke</button>';
  return `<div class="shd-perm ${p.ilimitado ? 'danger' : ''}">
    <div class="shd-perm-ic">${ini}</div>
    <div class="shd-perm-info"><b>${escH(p.symbol)}</b><div class="sp">to ${corta}</div>${riesgo}</div>
    ${p.ilimitado ? '<span class="shd-tag unl">Unlimited</span>' : ''}
    ${btnRev}
  </div>`;
}
function escH(s){return String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));}
