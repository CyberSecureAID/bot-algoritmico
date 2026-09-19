/* aportar-movil.js — Staking móvil. Overlay a pantalla completa con X. */
import { montarAportar } from '../aportar.js?v=6';
export function abrirAportarMovil(){
  const prev=document.getElementById('alm-stk'); if(prev) prev.remove();
  const d=document.createElement('div'); d.id='alm-stk';
  d.style.cssText='position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:520;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;background:rgba(5,7,10,.55);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)';
  d.innerHTML='<button id="alm-stk-x" aria-label="Close" style="position:fixed;top:calc(14px + env(safe-area-inset-top,0px));right:16px;z-index:2;width:36px;height:36px;border-radius:10px;background:rgba(14,21,28,.9);border:1px solid #202b37;color:#aab6c4;font-size:15px">✕</button><div style="box-sizing:border-box;width:100%;max-width:1320px;margin:0 auto;padding:calc(56px + env(safe-area-inset-top,0px)) 12px calc(70px + env(safe-area-inset-bottom,0px))"><div id="alm-stk-mount" style="width:100%"></div></div>';
  document.body.appendChild(d);
  document.getElementById('alm-stk-x').onclick=()=>d.remove();
  montarAportar(document.getElementById('alm-stk-mount'));
}
