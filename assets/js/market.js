/* En el móvil, los campos numéricos pintan unas flechitas que
   algunos navegadores no dejan quitar por CSS. Con type=text más
   inputmode=decimal sale el mismo teclado y ninguna flecha. */

// market.js — Marketplace P2P (caja fuerte + tramos + reputación). Módulo independiente.
// La librería vive en ESTE repositorio. Carga directa: sin CDN, sin esperas,
// sin nada externo que pueda quedarse colgado y dejar la app en 'Cargando…'.
import * as ethers from './vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from './wallet.js?v=125';
import { estilos } from './market/estilos.js?v=4';
import { MARKET, USDT, USDC, TOKENS, RPCS, ABI, ERC20, ESTADOS, MONEDAS, METODOS, PAR, SUGERE, ICOCT, CF_PASOS, COBROS, NOMBRE_MONEDA } from './market/config.js?v=1';
import { firmante, esc, f18, num, simbolo, corto, traducir, fechaExacta } from './market/util.js?v=1';
import { overlay, cerrar, dialogo, marco, cerrarWiz, wmsg, msg } from './market/ui.js?v=1';
import { guardarUbic, leerUbic, pedirUbicacion, kmEntre, distanciaEn, activarUbicacion, quitarUbicacion, initUbicacion } from './market/ubicacion.js?v=1';
export { compartirUbicacion } from './market/ubicacion.js?v=1';
import { abrirAsistente, initAsistenteVenta } from './market/asistente-venta.js?v=1';
import { panelComprar, initAsistenteCompra } from './market/asistente-compra.js?v=1';
export { abrirAsistenteCompra } from './market/asistente-compra.js?v=1';
import { lee } from './market/contrato.js?v=1';
import { pedirPerfilRapido, pedirMotivo, confirmar, pedirEstrellas, initDialogos } from './market/dialogos.js?v=1';
import { panelMisOps, wireOps, initOperaciones } from './market/operaciones.js?v=2';
import { listarOfertas } from './market/ofertas.js?v=1';
import { panelVender } from './market/vender.js?v=1';
import { panelDisputas, contarDisputas } from './market/disputas.js?v=1';
import { comoFunciona } from './market/guia.js?v=2';
export { avisarDisputas } from './market/disputas.js?v=1';

// Cablea el asistente de venta con los callbacks del panel (hoisted).
initAsistenteVenta({ listarOfertas, lee });
initAsistenteCompra({ listarOfertas, lee });
initOperaciones({ listarOfertas });
initDialogos({ panelMisOps });
initUbicacion({ panelVender });


/* ── helpers ── */
const $ = (id) => document.getElementById(id);

/* ── Distancia (se calcula en el navegador; nada se guarda on-chain) ── */

/* ── Logos ── */

/* ── Estilos ── */

/* ── Overlay ── */

/* ── Abrir ── */
export async function abrirMarket() {
  estilos();
  const o = overlay(); const card = $('mk-card');
  o.classList.add('show');
  card.innerHTML = `<button class="mk-x" id="mk-x">✕</button><div class="mk-vacio">Loading marketplace…</div>`;
  $('mk-x').onclick = cerrar;

  // Disclaimer OBLIGATORIO la primera vez. Sin aceptar, no se entra.
  let _aceptado = false;
  try { _aceptado = localStorage.getItem('aurex-p2p-ok') === '1'; } catch (_) {}
  if (!_aceptado) { mostrarDisclaimerP2P(card); return; }

  card.innerHTML = `
  <button class="mk-x" id="mk-x">✕</button>
  <div class="mk-head">
    <div class="mk-title"><span class="ln"></span>Marketplace<span class="ln"></span></div>
    <div class="mk-sub"><span class="tx-l">Compra y vende con caja fuerte</span><span class="tx-s">Compra y vende</span></div>
  </div>
  <div class="mk-tabs">
    <button class="mk-tab on" id="mk-t1">Ofertas</button>
    <button class="mk-tab" id="mk-t2">Vender</button>
    <button class="mk-tab" id="mk-t5">Comprar</button>
    <button class="mk-tab" id="mk-t3"><span class="tx-l">Operaciones</span><span class="tx-s">Ops</span></button>
  </div>
  <div class="mk-pane on" id="mk-p1"><div class="mk-vacio">Cargando ofertas…</div></div>
  <div class="mk-pane" id="mk-p2"></div>
  <div class="mk-pane" id="mk-p5"></div>
  <div class="mk-pane" id="mk-p3"></div>
  <div class="mk-pane" id="mk-p6"></div>
  <div class="mk-pane" id="mk-p4">${comoFunciona()}</div>
  <div class="mk-msg info" id="mk-msg"></div>
  `;
  $('mk-x').onclick = cerrar;

  /* ══════════════════════════════════════════════════════════════
     MENÚ DEL MARKETPLACE
     Disputas y la guía no son sitios donde se trabaja a diario: son
     consultas. Sacarlas de la fila de pestañas deja sitio para lo que
     sí se usa, y el punto rojo avisa cuando hay una disputa esperando.
     ══════════════════════════════════════════════════════════════ */
  montarMenuMk();

  const tabs = [['mk-t1', 'mk-p1'], ['mk-t2', 'mk-p2'], ['mk-t5', 'mk-p5'], ['mk-t3', 'mk-p3'], ['mk-t4', 'mk-p4'], ['mk-t6', 'mk-p6']];
  // La guía arranca en su primera tarjeta cada vez que se entra.
  const _t4 = $('mk-t4');
  if (_t4) _t4.addEventListener('click', () => setTimeout(() => cfPintar(0), 30));
  tabs.forEach(([t, p], i) => {
    const btn = $(t);
    if (!btn) return;                      // la de Disputas solo existe para el owner
    btn.onclick = () => {
      tabs.forEach(([tt, pp], j) => {
        const b2 = $(tt), p2 = $(pp);
        if (b2) b2.classList.toggle('on', i === j);
        if (p2) p2.classList.toggle('on', i === j);
      });
      $('mk-card').scrollTop = 0; msg('');
      if (i === 0) listarOfertas();
      if (i === 1) panelVender();
      if (i === 2) panelComprar();
      if (i === 3) panelMisOps();
      if (i === 4) { const b = $('mk-ir-vender'); if (b) b.onclick = () => $('mk-t2').click(); }
      if (i === 5) panelDisputas();
    };
  });
  listarOfertas();
  // Pestaña de Disputas: solo para el owner
  (async () => {
    try {
      const cuenta = wallet.cuentaActual && wallet.cuentaActual();
      if (!cuenta) return;
      const dueno = await lee('owner');
      if (String(dueno).toLowerCase() !== String(cuenta).toLowerCase()) return;
      const cont = document.querySelector('#mk-overlay .mk-tabs');
      if (!cont || $('mk-t6')) return;
      const b = document.createElement('button');
      b.className = 'mk-tab'; b.id = 'mk-t6';
      b.innerHTML = `Disputas <span class="mk-badge" id="mk-nd" style="display:none">0</span>`;
      b.style.display = 'none';   // vive en el menú, no en la fila de pestañas
      /* Disputas va ANTES de "Cómo funciona", que siempre cierra la fila:
         es la guía, no una sección de trabajo. */
      const _guia = $('mk-t4');
      if (_guia) cont.insertBefore(b, _guia); else cont.appendChild(b);
      b.onclick = () => {
        document.querySelectorAll('#mk-overlay .mk-tab').forEach(x => x.classList.remove('on'));
        document.querySelectorAll('#mk-overlay .mk-pane').forEach(x => x.classList.remove('on'));
        b.classList.add('on'); $('mk-p6').classList.add('on'); $('mk-card').scrollTop = 0; msg('');
        panelDisputas();
      };
      contarDisputas();
    } catch (_) {}
  })();
}

/* ── Disputas (solo owner) ── */

/* ── Cómo funciona ── */
/* ══════════════════════════════════════════════════════════════
   CÓMO FUNCIONA — una idea por pantalla

   Antes eran nueve párrafos apilados: un muro que nadie lee. Ahora se
   muestra UNA sola idea a la vez y el usuario avanza cuando quiera. Lo
   primero que ve es el consejo que de verdad le protege el dinero.
   ══════════════════════════════════════════════════════════════ */

let _cfPaso = 0;



/* ── Ofertas ── */

/* ── Diálogo propio (para explicar antes/después de los permisos del navegador) ── */

/* ── Ubicación ── */


/* ══════════ ASISTENTE DE VENTA (una pregunta por pantalla) ══════════ */
// Métodos de cobro. Cada uno decide qué monedas tienen sentido.


/* ── Mis operaciones ── */

/** Menú desplegable de la cabecera del Marketplace. */
function montarMenuMk() {
  const cab = document.querySelector('#mk-overlay .mk-cab') || document.querySelector('#mk-card');
  if (!cab || $('mk-menu')) return;

  const b = document.createElement('button');
  b.className = 'mk-menu-b'; b.id = 'mk-menu';
  b.setAttribute('aria-label', 'Menu');
  b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span class="mk-pt" id="mk-menu-pt"></span>`;
  cab.appendChild(b);

  const d = document.createElement('div');
  d.className = 'mk-menu-d'; d.id = 'mk-menu-d';
  d.innerHTML = `
    <button class="mk-mi" data-mk-go="disputas">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
      <span>Disputas</span><em class="mk-pt2" id="mk-menu-pt2"></em>
    </button>
    <button class="mk-mi" data-mk-go="guia">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/></svg>
      <span>Cómo funciona</span><em class="mk-nuevo" id="mk-menu-nuevo">nuevo</em>
    </button>`;
  cab.appendChild(d);

  const cerrarM = () => d.classList.remove('open');
  b.onclick = (e) => {
    e.stopPropagation();
    d.classList.toggle('open');
    // Al abrirlo, se apaga el aviso rojo de "aún no has visto la guía".
    marcarGuiaVista();
  };
  document.addEventListener('click', cerrarM);
  d.addEventListener('click', (e) => e.stopPropagation());

  d.querySelectorAll('[data-mk-go]').forEach((x) => x.onclick = () => {
    cerrarM();
    if (x.dataset.mkGo === 'guia') {
      abrirPanel('mk-p4');
      setTimeout(() => cfPintar(0), 30);
      marcarGuiaVista(true);
    } else {
      const t6 = $('mk-t6');
      if (t6) t6.click();
      else { abrirPanel('mk-p6'); panelDisputas(); }
    }
  });

  pintarAvisoGuia();
}

/** Deja un panel a la vista y apaga los demás. */
function abrirPanel(id) {
  document.querySelectorAll('#mk-overlay .mk-tab').forEach((x) => x.classList.remove('on'));
  document.querySelectorAll('#mk-overlay .mk-pane').forEach((x) => x.classList.remove('on'));
  const p = $(id); if (p) p.classList.add('on');
  const c = $('mk-card'); if (c) c.scrollTop = 0;
  msg('');
}

/* La primera vez que alguien entra, un punto rojo le enseña dónde está
   la guía. Después no vuelve a molestar. */
const CLAVE_GUIA_VISTA = 'mk-guia-vista';
const guiaVista = () => { try { return localStorage.getItem(CLAVE_GUIA_VISTA) === '1'; } catch (_) { return true; } };
function marcarGuiaVista(definitivo) {
  if (!definitivo) return;
  try { localStorage.setItem(CLAVE_GUIA_VISTA, '1'); } catch (_) {}
  pintarAvisoGuia();
}
function pintarAvisoGuia() {
  const nuevo = $('mk-menu-nuevo');
  const punto = $('mk-menu-pt');
  const ya = guiaVista();
  if (nuevo) nuevo.style.display = ya ? 'none' : '';
  if (punto) punto.classList.toggle('on', !ya);
}

/** Punto rojo en el menú cuando hay disputas esperando. */

/* Fechas en cristiano. "Hace 3 días" se entiende mejor que una fecha
   suelta, pero para lo antiguo la fecha exacta es más útil. */

/* Disputa: pedimos que expliquen qué pasó */

/* Compartir mi ubicación (para que otros vean la distancia) */

/* ═══════════ Disclaimer obligatorio del Mercado P2P ═══════════ */
function mostrarDisclaimerP2P(card) {
  card.innerHTML = `
  <button class="mk-x" id="mk-dx">✕</button>
  <div class="mk-disc">
    <div class="mk-disc-t">Before using the P2P Market</div>
    <div class="mk-disc-body">
      <p>This is a peer to peer market. We only provide the tools for two people to trade directly and safely. We are not part of any trade, we hold no VIP roles, and we never take sides. Everyone here is equal: whoever sells is a seller, whoever buys is a buyer, nothing more.</p>
      <p><b>There are no VIP users.</b> VIP status is one of the most common ways people get scammed, because it creates false trust and pressures others to pay first. Here nobody is special and nobody deserves special treatment. Treat every trade with the same caution.</p>
      <p><b>Verifying who you trade with is your responsibility.</b> If you sell, a buyer will contact you: check who they are before releasing anything. If you buy, you choose who to contact: check them before paying. Look at how many trades they have completed. If someone has no history, be extra careful.</p>
      <p><b>How it works.</b> You can split the amount you sell into parts (up to ten). The buyer pays the first part, you release the first part, and you continue in small steps until the trade is complete. This keeps the risk low at every step, but it does not replace verifying the person.</p>
      <p>The buyer always pays first, then the seller releases. If you pay or release without checking who is on the other side, that is your decision and your risk. If the person is in another country you may have no way to recover anything. We are not responsible for that.</p>
      <p>If you already know someone you want to trade with, you can use our platform to carry out that exchange safely if you wish.</p>
      <p>By continuing, you accept full responsibility for your own trades and confirm you understand how this works.</p>
    </div>
    <label class="mk-disc-chk"><input type="checkbox" id="mk-disc-agree"> I understand and accept full responsibility for my trades.</label>
    <button class="mk-disc-btn" id="mk-disc-go" disabled>Enter the P2P Market</button>
  </div>`;
  const cerrarD = () => { const o = document.getElementById('mk-overlay'); if (o) o.classList.remove('show'); };
  const dx = document.getElementById('mk-dx'); if (dx) dx.onclick = cerrarD;
  const chk = document.getElementById('mk-disc-agree');
  const btn = document.getElementById('mk-disc-go');
  if (chk) chk.onchange = () => { btn.disabled = !chk.checked; };
  if (btn) btn.onclick = () => {
    try { localStorage.setItem('aurex-p2p-ok', '1'); } catch (_) {}
    abrirMarket();
  };
}
