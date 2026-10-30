/* niveles/burbujas.js — Burbujas del asistente sobre la gráfica (los
   mensajes que explican qué está pasando) + su escritura letra a letra y
   la tabla del plan. Usa initBurbujas(dibujar) para volver a dibujar al
   abrir/cerrar una burbuja, sin import circular.

   [T4] Cada analista es bilingüe. Arranca en el idioma del sitio y trae un
   botón cuadrado "ES"/"EN" que cambia SOLO ese popup. Al abrir un analista
   se marca por defecto en la gráfica el nivel del que habla ("Show me where"
   activo). Los textos vienen como { en, es } desde asistente.js. */

import { N } from './estado.js?v=1';
import { T } from './i18n.js?v=1';
import { esc, fmt } from './util.js?v=1';

const $ = (id) => document.getElementById(id);
let _dibujar = () => {};
export function initBurbujas(dibujar) { _dibujar = dibujar; }

/* Escoge el lado del par bilingüe; tolera strings sueltos por si acaso. */
const L = (f, lang) => (f && typeof f === 'object')
  ? (f[lang] != null ? f[lang] : f.en)
  : (f == null ? '' : f);

/* Idioma con el que arranca cada popup: el del sitio (idioma.js fija
   document.documentElement.lang). Inglés si no se puede leer. */
const idiomaSitio = () => {
  try { return (document.documentElement.lang || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'; }
  catch (_) { return 'en'; }
};

/* Etiquetas de interfaz del panel, en los dos idiomas que ofrece el botón. */
const UI = {
  en: { why: 'Why I say this', hide: 'Hide', show: 'Show me where', plan: 'Trade plan',
        entry: 'Entry', stop: 'Stop', target: 'Target', rr: 'Risk/reward', vol: 'Avg. volatility' },
  es: { why: 'Por qué lo digo', hide: 'Ocultar', show: 'Muéstrame dónde', plan: 'Plan de trade',
        entry: 'Entrada', stop: 'Stop', target: 'Objetivo', rr: 'Riesgo/beneficio', vol: 'Volatilidad media' }
};

const ic = { compra: '▲', venta: '▼', vigilar: '◆', aviso: '✱', tendencia: '➜', contexto: '·' };
const etq = { compra: 'BUY', venta: 'SELL', vigilar: 'WATCH', aviso: 'WAIT', tendencia: 'TREND', contexto: 'CONTEXT' };

export function burbujas() {
  const caja = $('nv-caps');
  if (!caja || !N._geo || N.cargando) return;
  if (!N.mensajes.length) { caja.innerHTML = ''; return; }

  /* [CORREGIDO] La firma redondea los números: solo se rehace (y reanima)
     cuando el mensaje cambia de verdad, no en cada micromovimiento. La firma
     se calcula en inglés para que sea estable independientemente del idioma
     en que el usuario tenga abierto cada popup. */
  const firma = N.mensajes
    .map((m) => m.tipo + '|' + L(m.titulo, 'en') + '|' + String(L(m.txt, 'en')).replace(/[\d.,]+/g, '#'))
    .join('~');
  if (caja.dataset.firma === firma) {
    /* Mismo mensaje: solo se refrescan las cifras, en el idioma de cada popup. */
    N.mensajes.forEach((m, i) => {
      const cap = caja.querySelector(`[data-nvm="${i}"]`);
      if (!cap) return;
      const lang = cap.dataset.lang === 'es' ? 'es' : 'en';
      const el = cap.querySelector('.nv-pm-tx');
      if (el && el.dataset.hecho) el.textContent = L(m.txt, lang);
      const h = cap.querySelector('.nv-pm-hacer');
      if (h) h.textContent = L(m.hacer, lang);
    });
    return;
  }
  caja.dataset.firma = firma;

  const base = idiomaSitio();
  caja.innerHTML = `${N.mensajes.map((m, idx) => `
    <div class="nv-cap t-${m.tipo} ${m.esPlan ? 'plan' : ''} avisa" data-nvm="${idx}" data-lang="${base}">
      <button class="nv-cap-b" type="button">
        <span class="nv-num">${idx + 1}</span>
        <img class="nv-cap-ava" src="assets/img/jesus-avatar.webp" alt="">
        <span class="nv-cap-tx">${ic[m.tipo] || '✱'} ${esc(T(etq[m.tipo] || ''))}</span>
        <span class="nv-cap-fl">▾</span>
      </button>
      <div class="nv-cap-panel">${panelInner(m, idx, base)}</div>
    </div>`).join('')}`;

  caja.querySelectorAll('[data-nvm]').forEach((el) => {
    const idx = +el.dataset.nvm;
    const b = el.querySelector('.nv-cap-b');

    b.onclick = (e) => {
      e.stopPropagation();
      el.classList.remove('avisa');               // ya la miró: deja de avisar
      const abierta = el.classList.contains('abierto');
      caja.querySelectorAll('.nv-cap').forEach((x) => x.classList.remove('abierto'));
      if (!abierta) {
        el.classList.add('abierto');
        /* "Show me where" activo por defecto: marca en la gráfica el nivel
           del que habla este analista en cuanto se abre. */
        if (N.mensajes[idx] && N.mensajes[idx].p) {
          N.senalado = idx;
          const sb = el.querySelector('.nv-senala'); if (sb) sb.classList.add('on');
          _dibujar();
        }
        escribir(el.querySelector('[data-escribir]'));
      } else if (N.senalado === idx) {
        N.senalado = null;                         // se cerró: quita la marca
        _dibujar();
      }
    };

    bindPanel(el, idx);
  });
}

/* Construye el interior del panel en el idioma pedido. Se usa al pintar y al
   cambiar de idioma con el botón. */
function panelInner(m, idx, lang) {
  const u = UI[lang] || UI.en;
  return `
    <div class="nv-pm-cab">
      <img class="nv-pm-ava" src="assets/img/jesus-avatar.webp" alt="">
      <div class="nv-pm-quien"><b>Jesús</b><span>${esc(L(m.titulo, lang))}</span></div>
      <button class="nv-lang" type="button" title="${lang === 'en' ? 'Ver en español' : 'View in English'}">${lang === 'en' ? 'ES' : 'EN'}</button>
    </div>
    <div class="nv-pm-tx" data-escribir="${esc(L(m.txt, lang))}"></div>
    <div class="nv-pm-hacer">${esc(L(m.hacer, lang))}</div>

    ${m.plan ? planHTML(m.plan, lang) : ''}

    <div class="nv-acts">
      <button class="nv-pm-mas" type="button">${esc(u.why)} ▾</button>
      ${m.p ? `<button class="nv-senala" type="button">${esc(u.show)}</button>` : ''}
    </div>

    <div class="nv-pm-det">
      ${(m.detalle || []).map((x) => `<div class="nv-pm-li">${esc(L(x, lang))}</div>`).join('')}
    </div>`;
}

/* Cablea los botones internos del panel (se vuelve a llamar tras cambiar de
   idioma, porque el innerHTML del panel se rehace). */
function bindPanel(el, idx) {
  const lang = () => (el.dataset.lang === 'es' ? 'es' : 'en');

  const mas = el.querySelector('.nv-pm-mas');
  if (mas) mas.onclick = (e) => {
    e.stopPropagation();
    const u = UI[lang()] || UI.en;
    el.classList.toggle('con-detalle');
    mas.textContent = el.classList.contains('con-detalle') ? u.hide + ' ▴' : u.why + ' ▾';
  };

  const sen = el.querySelector('.nv-senala');
  if (sen) {
    if (N.senalado === idx) sen.classList.add('on');
    sen.onclick = (e) => {
      e.stopPropagation();
      /* Alterna la marca SIN cerrar el popup, para ver texto y nivel a la vez. */
      if (N.senalado === idx) { N.senalado = null; sen.classList.remove('on'); }
      else { N.senalado = idx; sen.classList.add('on'); }
      _dibujar();
    };
  }

  const lng = el.querySelector('.nv-lang');
  if (lng) lng.onclick = (e) => {
    e.stopPropagation();
    const nx = (el.dataset.lang === 'es') ? 'en' : 'es';
    el.dataset.lang = nx;
    const panel = el.querySelector('.nv-cap-panel');
    panel.innerHTML = panelInner(N.mensajes[idx], idx, nx);
    bindPanel(el, idx);                            // recablea los nodos nuevos
    if (el.classList.contains('abierto')) escribir(panel.querySelector('[data-escribir]'));
  };
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

function planHTML(p, lang) {
  if (!p) return '';
  const u = UI[lang] || UI.en;
  return `
  <div class="nv-plan">
    <div class="nv-plan-t">${esc(u.plan)}</div>
    <div class="nv-plan-fila entrada">
      <span>${esc(u.entry)}</span><b>${fmt(p.entrada)}</b>
    </div>
    <div class="nv-plan-fila stop">
      <span>${esc(u.stop)}</span><b>${fmt(p.stop)}</b>
      <i>−${p.riesgoPct.toFixed(2)}%</i>
    </div>
    ${p.obj.map((o, i) => `
    <div class="nv-plan-fila obj">
      <span>${esc(u.target)} ${i + 1} <em>${o.r}R</em></span><b>${fmt(o.p)}</b>
      <i>+${o.pct.toFixed(2)}%</i>
    </div>`).join('')}
    <div class="nv-plan-pie">
      ${esc(u.rr)} <b>1:${p.rr}</b> ·
      ${esc(u.vol)} <b>${fmt(p.atr)}</b>
    </div>
  </div>`;
}
