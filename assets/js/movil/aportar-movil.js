/* aportar-movil.js — Staking móvil. <dialog> showModal (top layer). */
import { montarAportar } from '../aportar.js?v=15';
export function abrirAportarMovil(){
  const prev=document.getElementById('alm-stk'); if(prev) prev.remove();
  const dg=document.createElement('dialog'); dg.id='alm-stk';
  dg.style.cssText='margin:0;padding:0;border:0;max-width:100vw;max-height:100vh;width:100vw;height:100vh;background:rgba(5,7,10,.96);overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;color:inherit';
  dg.innerHTML='<button id="alm-stk-x" aria-label="Close" style="position:fixed;top:calc(14px + env(safe-area-inset-top,0px));right:16px;z-index:3;width:36px;height:36px;border-radius:10px;background:rgba(14,21,28,.9);border:1px solid #202b37;color:#aab6c4;font-size:15px">✕</button><div style="box-sizing:border-box;width:100%;max-width:960px;margin:0 auto;padding:calc(56px + env(safe-area-inset-top,0px)) 12px calc(70px + env(safe-area-inset-bottom,0px))"><div id="alm-stk-mount" style="width:100%"></div></div>';
  document.body.appendChild(dg);
  if(dg.showModal)dg.showModal();else dg.setAttribute('open','');
  const cerrar=()=>{try{dg.close();}catch(_){}dg.remove();};
  document.getElementById('alm-stk-x').onclick=cerrar;
  dg.addEventListener('cancel',(e)=>{e.preventDefault();cerrar();});
  montarAportar(document.getElementById('alm-stk-mount'));
}
