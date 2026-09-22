/* panel-trigger.js — Abre el panel admin nuevo con 5 toques en la esquina inferior izquierda.
   El panel verifica owner on-chain, así que el gesto es solo un atajo (no da acceso por sí mismo). */
import { abrirPanel } from './panel.js?v=1';

export function iniciarTriggerPanel() {
  if (document.getElementById('adm2-zona')) return;
  const z = document.createElement('div');
  z.id = 'adm2-zona';
  z.setAttribute('aria-hidden', 'true');
  z.style.cssText = 'position:fixed;left:0;bottom:0;width:64px;height:64px;z-index:399;background:transparent';
  document.body.appendChild(z);
  let clics = 0, t = null, abriendo = false;
  const golpe = async () => {
    clics++; clearTimeout(t); t = setTimeout(() => { clics = 0; }, 2500);
    if (clics < 5 || abriendo) return;
    clics = 0; abriendo = true;
    try { await abrirPanel(); } catch (_) {} finally { abriendo = false; }
  };
  z.addEventListener('click', golpe);
  z.addEventListener('touchend', (e) => { e.preventDefault(); golpe(); }, { passive: false });
}
