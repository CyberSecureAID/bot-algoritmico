/* aportar-movil.js — Staking móvil. Reutiliza el diseño de aportar.js. */
import { montarAportar } from '../aportar.js?v=5';
export function abrirAportarMovil(){
  const prev=document.getElementById('alm-stk'); if(prev) prev.remove();
  const d=document.createElement('div'); d.id='alm-stk';
  d.style.cssText='position:fixed;inset:0;z-index:520;background:rgba(5,7,10,.72);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:calc(12px + env(safe-area-inset-top,0px)) 10px calc(80px + env(safe-area-inset-bottom,0px))';
  d.innerHTML='<div id="alm-stk-mount" style="width:100%"></div>';
  document.body.appendChild(d);
  montarAportar(document.getElementById('alm-stk-mount'));
}
