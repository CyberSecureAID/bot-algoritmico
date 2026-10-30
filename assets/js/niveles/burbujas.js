/* niveles/burbujas.js — Burbujas del asistente sobre la gráfica (los
   mensajes que explican qué está pasando) + su escritura letra a letra y
   la tabla del plan. Extraído de niveles.js. Usa initBurbujas(dibujar)
   para volver a dibujar al abrir/cerrar una burbuja, sin import circular. */

import { N } from './estado.js?v=1';
import { T } from './i18n.js?v=1';
import { esc, fmt } from './util.js?v=1';

const $ = (id) => document.getElementById(id);
let _dibujar = () => {};
export function initBurbujas(dibujar) { _dibujar = dibujar; }

export function burbujas() {
  const caja = $('nv-caps');
  if (!caja || !N._geo || N.cargando) return;
  if (!N.mensajes.length) { caja.innerHTML = ''; return; }

  /* ══════════════════════════════════════════════════════════
     LAS CÁPSULAS

     [REPLANTEADO] Se quitaron los puntos latiendo y las cuerdas:
     ensuciaban la gráfica y con el zoom se volvían locos.

     Ahora las cápsulas van arriba a la derecha, que es donde no
     hay velas (el mercado avanza de izquierda a derecha). Se
     tocan, se despliegan hacia abajo, y solo si el usuario pulsa
     "Señálame dónde está" aparece la línea al nivel.
     ══════════════════════════════════════════════════════════ */
  /* [CORREGIDO] La firma incluía los números con decimales, así que
     cualquier micromovimiento del precio la cambiaba y las tarjetas
     se rehacían y reanimaban cada 30 segundos con el mismo mensaje.

     Ahora los números se redondean para la firma: solo se rehace
     cuando el mensaje cambia de verdad. */
  const firma = N.mensajes
    .map((m) => m.tipo + '|' + m.titulo + '|' + String(m.txt).replace(/[\d.,]+/g, '#'))
    .join('~');
  if (caja.dataset.firma === firma) {
    /* Mismo mensaje: solo se refrescan las cifras, sin reanimar. */
    N.mensajes.forEach((m, i) => {
      const el = caja.querySelector(`[data-nvm="${i}"] .nv-pm-tx`);
      if (el && el.dataset.hecho) el.textContent = T(m.txt);
      const h = caja.querySelector(`[data-nvm="${i}"] .nv-pm-hacer`);
      if (h) h.textContent = T(m.hacer);
    });
    return;
  }
  caja.dataset.firma = firma;

  const ic = { compra: '▲', venta: '▼', vigilar: '◆', aviso: '✱', tendencia: '➜', contexto: '·' };
  const etq = { compra: 'BUY', venta: 'SELL', vigilar: 'WATCH', aviso: 'WAIT',
                tendencia: 'TREND', contexto: 'CONTEXT' };

  caja.innerHTML = `${N.mensajes.map((m, idx) => `
    <div class="nv-cap t-${m.tipo} ${m.esPlan ? 'plan' : ''} avisa" data-nvm="${idx}">
      <button class="nv-cap-b" type="button">
        <span class="nv-num">${idx + 1}</span>
        <img class="nv-cap-ava" src="assets/img/jesus-avatar.webp" alt="">
        <span class="nv-cap-tx">${ic[m.tipo] || '✱'} ${esc(T(etq[m.tipo] || ''))}</span>
        <span class="nv-cap-fl">▾</span>
      </button>

      <div class="nv-cap-panel">
        <div class="nv-pm-cab">
          <img class="nv-pm-ava" src="assets/img/jesus-avatar.webp" alt="">
          <div class="nv-pm-quien"><b>Jesús</b><span>${esc(T(m.titulo))}</span></div>
        </div>
        <div class="nv-pm-tx" data-escribir="${esc(T(m.txt))}"></div>
        <div class="nv-pm-hacer">${esc(T(m.hacer))}</div>

        ${m.plan ? planHTML(m.plan) : ''}

        <div class="nv-acts">
          <button class="nv-pm-mas" type="button">${esc(T('Why I say this'))} ▾</button>
          ${m.p ? `<button class="nv-senala" type="button">${esc(T('Show me where'))}</button>` : ''}
        </div>

        <!-- Herramientas que el usuario puede pedir -->
        <div class="nv-pm-det">
          ${(m.detalle || []).map((x) => `<div class="nv-pm-li">${esc(T(x))}</div>`).join('')}
        </div>
      </div>
    </div>`).join('')}`;

  caja.querySelectorAll('[data-nvm]').forEach((el, idx) => {
    const b = el.querySelector('.nv-cap-b');
    const mas = el.querySelector('.nv-pm-mas');
    const sen = el.querySelector('.nv-senala');

    b.onclick = (e) => {
      e.stopPropagation();
      el.classList.remove('avisa');      // ya la miró: deja de avisar
      const ab = el.classList.contains('abierto');
      caja.querySelectorAll('.nv-cap').forEach((x) => x.classList.remove('abierto'));
      if (!ab) { el.classList.add('abierto'); escribir(el.querySelector('[data-escribir]')); }
    };
    mas.onclick = (e) => {
      e.stopPropagation();
      el.classList.toggle('con-detalle');
      mas.textContent = el.classList.contains('con-detalle')
        ? T('Hide') + ' ▴' : T('Why I say this') + ' ▾';
    };
    const vw = el.querySelector('[data-vwap]');
    if (vw) vw.onclick = (e) => {
      e.stopPropagation();
      N.verVWAP = !N.verVWAP;
      vw.classList.toggle('on', N.verVWAP);
      if (N.verVWAP) el.classList.remove('abierto');
      _dibujar();
    };
    const pf = el.querySelector('[data-perfil]');
    if (pf) pf.onclick = (e) => {
      e.stopPropagation();
      N.verPerfil = !N.verPerfil;
      pf.classList.toggle('on', N.verPerfil);
      if (N.verPerfil) el.classList.remove('abierto');
      _dibujar();
    };

    const fib = el.querySelector('[data-fib]');
    if (fib) fib.onclick = (e) => {
      e.stopPropagation();
      N.verFibo = !N.verFibo;
      fib.classList.toggle('on', N.verFibo);
      if (N.verFibo) { el.classList.remove('abierto'); animarFibo(); }
      else _dibujar();
    };

    if (sen) sen.onclick = (e) => {
      e.stopPropagation();
      /* Se cierra la cápsula y se marca el nivel en la gráfica */
      el.classList.remove('abierto');
      N.senalado = N.senalado === idx ? null : idx;
      _dibujar();
    };
  });

  /* [CORREGIDO] Ninguna se abre sola: molestaba y tapaba la gráfica
     nada más entrar. La flecha parpadea para avisar de que hay algo
     que leer, y el usuario decide cuándo. */
}

function escribir(el) {
  if (!el || el.dataset.hecho) return;
  const txt = el.dataset.escribir || '';
  el.dataset.hecho = '1';
  let n = 0;
  const t = setInterval(() => {
    n += 2;
    el.textContent = txt.slice(0, n);
    if (n >= txt.length) { el.textContent = txt; clearInterval(t); }
  }, 13);
}

function planHTML(p) {
  if (!p) return '';
  const largo = p.lado === 'compra';
  return `
  <div class="nv-plan">
    <div class="nv-plan-t">${esc(T('Trade plan'))}</div>
    <div class="nv-plan-fila entrada">
      <span>${esc(T('Entry'))}</span><b>${fmt(p.entrada)}</b>
    </div>
    <div class="nv-plan-fila stop">
      <span>${esc(T('Stop'))}</span><b>${fmt(p.stop)}</b>
      <i>−${p.riesgoPct.toFixed(2)}%</i>
    </div>
    ${p.obj.map((o, i) => `
    <div class="nv-plan-fila obj">
      <span>${esc(T('Target'))} ${i + 1} <em>${o.r}R</em></span><b>${fmt(o.p)}</b>
      <i>+${o.pct.toFixed(2)}%</i>
    </div>`).join('')}
    <div class="nv-plan-pie">
      ${esc(T('Risk/reward'))} <b>1:${p.rr}</b> ·
      ${esc(T('Avg. volatility'))} <b>${fmt(p.atr)}</b>
    </div>
  </div>`;
}
