/* aportar-movil.js — Staking móvil. Reutiliza el diseño corporativo de
   aportar.js dentro de un overlay a pantalla completa. */
import { montarAportar } from '../aportar.js?v=4';
export function abrirAportarMovil(){
  const prev=document.getElementById('alm-stk'); if(prev) prev.remove();
  const d=document.createElement('div'); d.id='alm-stk';
  d.style.cssText='position:fixed;inset:0;z-index:520;background:#070b10;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(12px + env(safe-area-inset-top,0px)) 12px calc(80px + env(safe-area-inset-bottom,0px))';
  d.innerHTML='<div id="alm-stk-mount"></div>';
  document.body.appendChild(d);
  montarAportar(document.getElementById('alm-stk-mount'));
}
