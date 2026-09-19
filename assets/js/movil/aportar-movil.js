/* aportar-movil.js — Staking móvil. Reutiliza el diseño institucional de
   aportar.js dentro de un overlay app-like a pantalla completa. */
import { montarAportar } from '../aportar.js?v=3';

export function abrirAportarMovil() {
  const prev = document.getElementById('alm-stk'); if (prev) prev.remove();
  const d = document.createElement('div');
  d.id = 'alm-stk';
  d.style.cssText = 'position:fixed;inset:0;z-index:520;background:#05070a;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(14px + env(safe-area-inset-top,0px)) 14px calc(90px + env(safe-area-inset-bottom,0px))';
  d.innerHTML = '<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button id="alm-stk-x" aria-label="Close" style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid #1c232c;color:#aeb8c4;font-size:15px">✕</button></div><div id="alm-stk-mount"></div>';
  document.body.appendChild(d);
  document.getElementById('alm-stk-x').onclick = () => d.remove();
  montarAportar(document.getElementById('alm-stk-mount'));
}
