/* ──────────────────────────────────────────────────────────────────────────
   modules/indicadores/ui.js — BARRA de configuracion de un indicador.

   Es la MISMA barra de las herramientas de dibujo (nv-topbar): copiada tal
   cual en estructura y estilo (color, sombra, blur, el asa de 6 puntos para
   arrastrarla donde quieras, pin, color, grosor, punteada, eliminar) y con la
   ruedita que faltaba, que abre los ajustes del indicador en una ventanita del
   mismo estilo. Sale al tocar/activar el indicador y se QUITA al dar clic
   afuera (como TradingView); los popups hijos se van con ella, nunca quedan
   colgados. Generica: recibe la config de la instancia + callbacks.
   ────────────────────────────────────────────────────────────────────────── */

/* Misma paleta que la barra de herramientas (niveles). */
const PALETA = ['#22d3ee', '#38bdf8', '#2ee86a', '#a3e635', '#ffd400', '#E8B84B', '#f59e0b', '#ff3b52', '#fb7185', '#a78bfa', '#e879f9', '#94a3b8', '#ffffff'];
let _bar = null, _pop = null, _docCerra = null;

function inyectarCSS() {
  if (document.getElementById('indtb-css')) return;
  const s = document.createElement('style'); s.id = 'indtb-css';
  /* Valores copiados de assets/js/niveles/estilos.js (la misma barra). */
  s.textContent = `
  .indtb{position:fixed; z-index:10000; display:flex; align-items:center; gap:3px; padding:6px 8px; border-radius:14px;
    background:linear-gradient(180deg,rgba(24,30,40,.94),rgba(14,18,26,.94));
    -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px);
    border:1px solid rgba(255,255,255,.12); box-shadow:0 14px 40px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05);
    font-family:'IBM Plex Mono',ui-monospace,monospace; max-width:calc(100vw - 20px); overflow-x:auto; scrollbar-width:none; animation:indtbIn .13s ease both}
  .indtb::-webkit-scrollbar{display:none}
  @keyframes indtbIn{from{opacity:0; transform:translateY(5px)} to{opacity:1; transform:none}}
  .indtb-grip{flex:0 0 auto; width:16px; height:26px; margin-right:2px; cursor:grab; display:inline-flex; align-items:center; justify-content:center; color:#5c6672}
  .indtb-grip:hover{color:#9aa4b0}
  .indtb-grip:active{cursor:grabbing}
  .indtb-nm{flex:0 0 auto; font-size:11px; font-weight:700; color:#c9d1d9; padding:0 4px; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
  .indtb-b{height:30px; min-width:30px; padding:0 9px; border-radius:9px; border:none; background:transparent; color:#c9d1d9;
    cursor:pointer; display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto;
    font-family:inherit; font-size:12px; font-weight:700; line-height:1; transition:background .13s,color .13s}
  .indtb-b:hover{background:rgba(255,255,255,.09)}
  .indtb-b.on{background:rgba(34,211,238,.2); color:#22d3ee; box-shadow:inset 0 0 0 1px rgba(34,211,238,.4)}
  .indtb-b svg{width:15px; height:15px}
  .indtb-pin{color:#7d8794}
  .indtb-pin.on{background:rgba(46,232,106,.18); color:#3ee88a; box-shadow:inset 0 0 0 1px rgba(46,232,106,.4)}
  .indtb-del:hover{background:rgba(255,59,82,.2); color:#ff6b7a}
  .indtb-color{padding:0 6px}
  .indtb-swatch{width:20px; height:20px; border-radius:6px; display:block; box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35),0 1px 3px rgba(0,0,0,.5)}
  .indtb-gr{width:32px}
  .indtb-gr i{display:block; width:16px; background:currentColor; border-radius:2px}
  .indtb-dash i{display:block; width:16px; height:0; border-top:2px dashed currentColor}
  .indtb-sep{width:1px; height:20px; background:rgba(255,255,255,.14); margin:0 3px; flex:0 0 auto}
  .indtb-pop{position:fixed; z-index:10001; padding:8px; border-radius:12px;
    background:linear-gradient(180deg,rgba(24,30,40,.97),rgba(14,18,26,.97));
    -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px);
    border:1px solid rgba(255,255,255,.13); box-shadow:0 16px 44px rgba(0,0,0,.62); font-family:'IBM Plex Mono',ui-monospace,monospace}
  .indtb-pop-col{display:grid; grid-template-columns:repeat(6,1fr); gap:6px; width:184px}
  .indtb-pc{width:22px; height:22px; border-radius:6px; border:2px solid transparent; cursor:pointer; padding:0; box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}
  .indtb-pc:hover{border-color:rgba(255,255,255,.85)}
  .indtb-pc.on{border-color:#fff}
  .indtb-pop-cfg{width:210px}
  .indtb-pop-t{font-size:9px; letter-spacing:1px; text-transform:uppercase; color:#8b95a1; margin:0 2px 8px}
  .indtb-row{display:flex; align-items:center; justify-content:space-between; gap:12px; margin:7px 2px}
  .indtb-row>span{font-size:11px; color:#b7bdc6}
  .indtb-step{display:inline-flex; align-items:center; gap:5px}
  .indtb-step button{width:24px; height:24px; border-radius:7px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.03); color:#eaecef; cursor:pointer; font-size:14px; line-height:1; display:flex; align-items:center; justify-content:center; padding:0}
  .indtb-step button:hover{border-color:rgba(34,211,238,.5); color:#22d3ee}
  .indtb-val{width:50px; height:24px; text-align:center; border-radius:7px; border:1px solid rgba(255,255,255,.14); background:rgba(0,0,0,.25); color:#eaecef; font-size:12px; outline:none; font-family:inherit}
  .indtb-val:focus{border-color:rgba(34,211,238,.6)}
  .indtb-slider{-webkit-appearance:none; appearance:none; display:block; width:calc(100% - 4px); height:4px; margin:1px 2px 10px; border-radius:3px; background:rgba(255,255,255,.14); outline:none; cursor:pointer}
  .indtb-slider::-webkit-slider-thumb{-webkit-appearance:none; appearance:none; width:15px; height:15px; border-radius:50%; background:#22d3ee; border:2px solid #0b1017; cursor:grab; box-shadow:0 1px 4px rgba(0,0,0,.5)}
  .indtb-slider::-webkit-slider-thumb:active{cursor:grabbing}
  .indtb-slider::-moz-range-thumb{width:15px; height:15px; border-radius:50%; background:#22d3ee; border:2px solid #0b1017; cursor:grab}
  .indtb-slider::-moz-range-track{height:4px; border-radius:3px; background:rgba(255,255,255,.14)}`;
  document.head.appendChild(s);
}

const SVG = {
  grip: '<svg viewBox="0 0 12 20" width="11" height="18" aria-hidden="true"><circle cx="3.5" cy="4" r="1.3" fill="currentColor"/><circle cx="8.5" cy="4" r="1.3" fill="currentColor"/><circle cx="3.5" cy="10" r="1.3" fill="currentColor"/><circle cx="8.5" cy="10" r="1.3" fill="currentColor"/><circle cx="3.5" cy="16" r="1.3" fill="currentColor"/><circle cx="8.5" cy="16" r="1.3" fill="currentColor"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 7 3 3v2H7v-2l3-3z"/><path d="M12 16v4"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>'
};

function cerrarPop() { if (_pop) { _pop.remove(); _pop = null; } }
export function cerrarBarraInd() {
  cerrarPop();
  if (_bar) { _bar.remove(); _bar = null; }
  if (_docCerra) { document.removeEventListener('mousedown', _docCerra, true); _docCerra = null; }
}
export function hayBarraInd() { return !!_bar; }

function colocar(el, cx, cy) {
  const mw = el.offsetWidth, mh = el.offsetHeight;
  let left = cx - mw / 2; left = Math.max(8, Math.min(innerWidth - mw - 8, left));
  let top = cy; if (top + mh > innerHeight - 8) top = innerHeight - mh - 8; if (top < 8) top = 8;   // barra pegada ARRIBA (centro), no por encima del ancla
  el.style.left = left + 'px'; el.style.top = top + 'px';
}

/* opts: { cfg, params, nombre, cx, cy, onCambio, onEliminar } */
export function abrirBarraInd(opts) {
  inyectarCSS();
  cerrarBarraInd();
  const { cfg, params = [], nombre = '', onCambio = () => {}, onEliminar = () => {} } = opts;
  let fijado = false;
  const bar = document.createElement('div'); bar.className = 'indtb';
  const grBtns = [1, 2, 3, 4].map((w) => `<button class="indtb-b indtb-gr ${Math.round(cfg.gr || 2) === w ? 'on' : ''}" data-gr="${w}" title="Thickness"><i style="height:${w + 1}px"></i></button>`).join('');
  bar.innerHTML =
    `<span class="indtb-grip" title="Move">${SVG.grip}</span>` +
    `<span class="indtb-nm">${nombre}</span>` +
    `<button class="indtb-b indtb-pin" data-pin title="Keep open">${SVG.pin}</button>` +
    `<span class="indtb-sep"></span>` +
    `<button class="indtb-b indtb-color" data-col title="Color"><span class="indtb-swatch" style="background:${cfg.col}"></span></button>` +
    `<span class="indtb-sep"></span>${grBtns}` +
    `<button class="indtb-b indtb-dash ${cfg.dash ? 'on' : ''}" data-dash title="Dashed"><i></i></button>` +
    (params.length ? `<span class="indtb-sep"></span><button class="indtb-b indtb-gear" data-gear title="Settings">${SVG.gear}</button>` : '') +
    `<span class="indtb-sep"></span><button class="indtb-b indtb-del" data-del title="Delete">${SVG.del}</button>`;
  document.body.appendChild(bar);
  colocar(bar, opts.cx, opts.cy);
  _bar = bar;

  /* Asa de 6 puntos: arrastrar la barra a donde sea. */
  let drag = null;
  bar.querySelector('.indtb-grip').addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = bar.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    let nx = e.clientX - drag.dx, ny = e.clientY - drag.dy;
    nx = Math.max(4, Math.min(innerWidth - bar.offsetWidth - 4, nx)); ny = Math.max(4, Math.min(innerHeight - bar.offsetHeight - 4, ny));
    bar.style.left = nx + 'px'; bar.style.top = ny + 'px'; cerrarPop();
  });
  window.addEventListener('mouseup', () => { if (drag) { drag = null; document.body.style.userSelect = ''; } });

  const cambiar = () => { onCambio(); if (opts.nombreDe) { try { const el = bar.querySelector('.indtb-nm'); if (el) el.textContent = opts.nombreDe(); } catch (_) {} } };
  bar.querySelector('[data-col]').onclick = (e) => { e.stopPropagation(); popColor(cfg, e.currentTarget, cambiar); };
  bar.querySelectorAll('[data-gr]').forEach((b) => b.onclick = () => { cfg.gr = +b.dataset.gr; bar.querySelectorAll('[data-gr]').forEach((x) => x.classList.toggle('on', x === b)); cerrarPop(); cambiar(); });
  bar.querySelector('[data-dash]').onclick = (e) => { cfg.dash = !cfg.dash; e.currentTarget.classList.toggle('on', cfg.dash); cerrarPop(); cambiar(); };
  const gearBtn = bar.querySelector('[data-gear]'); if (gearBtn) gearBtn.onclick = (e) => { e.stopPropagation(); popAjustes(cfg, params, nombre, gearBtn, cambiar); };
  bar.querySelector('[data-pin]').onclick = (e) => { fijado = !fijado; e.currentTarget.classList.toggle('on', fijado); };
  bar.querySelector('[data-del]').onclick = () => { onEliminar(); cerrarBarraInd(); };

  /* Clic AFUERA: se quita la barra y sus popups (como TradingView). Si esta
     fijada (pin), se queda. */
  _docCerra = (ev) => {
    if (fijado) return;
    if (bar.contains(ev.target) || (_pop && _pop.contains(ev.target))) return;
    cerrarBarraInd();
  };
  setTimeout(() => { if (_docCerra) document.addEventListener('mousedown', _docCerra, true); }, 0);
  return bar;
}

function popColor(cfg, anchor, cambiar) {
  if (_pop && _pop.dataset.k === 'col') { cerrarPop(); return; }
  cerrarPop();
  const pop = document.createElement('div'); pop.className = 'indtb-pop indtb-pop-col'; pop.dataset.k = 'col';
  pop.innerHTML = PALETA.map((c) => `<button class="indtb-pc ${c === cfg.col ? 'on' : ''}" data-c="${c}" style="background:${c}"></button>`).join('');
  document.body.appendChild(pop); _pop = pop;
  ubicarPop(pop, anchor);
  pop.onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cfg.col = b.dataset.c; const sw = anchor.querySelector('.indtb-swatch'); if (sw) sw.style.background = cfg.col; cambiar(); cerrarPop(); };
}
function popAjustes(cfg, params, nombre, anchor, cambiar) {
  if (_pop && _pop.dataset.k === 'cfg') { cerrarPop(); return; }
  cerrarPop();
  const filas = params.map((p) => {
    const step = p.step || 1, lo = p.min != null ? p.min : 1, hi = p.max != null ? p.max : 100;
    return `<div class="indtb-row"><span>${p.lbl || p.k}</span><div class="indtb-step"><button type="button" data-dec="${p.k}" data-step="${step}">−</button><input class="indtb-val" data-val="${p.k}" value="${cfg[p.k]}" inputmode="decimal"><button type="button" data-inc="${p.k}" data-step="${step}">+</button></div></div>` +
      `<input class="indtb-slider" type="range" data-slider="${p.k}" min="${lo}" max="${hi}" step="${step}" value="${cfg[p.k]}">`;
  }).join('');
  const pop = document.createElement('div'); pop.className = 'indtb-pop indtb-pop-cfg'; pop.dataset.k = 'cfg';
  pop.innerHTML = `<div class="indtb-pop-t">${nombre} settings</div>${filas}`;
  document.body.appendChild(pop); _pop = pop;
  ubicarPop(pop, anchor);
  const setVal = (pk, val) => { const p = params.find((x) => x.k === pk); if (!p) return; const lo = p.min != null ? p.min : 1, hi = p.max != null ? p.max : 1e9; let nv = Math.max(lo, Math.min(hi, val)); const step = p.step || 1; nv = step >= 1 ? Math.round(nv) : Math.round(nv / step) * step; cfg[pk] = nv; const inp = pop.querySelector('[data-val="' + pk + '"]'); if (inp) inp.value = nv; const sl = pop.querySelector('[data-slider="' + pk + '"]'); if (sl && +sl.value !== nv) sl.value = nv; cambiar(); };
  pop.querySelectorAll('[data-dec]').forEach((b) => b.onclick = () => setVal(b.dataset.dec, (+cfg[b.dataset.dec]) - (+b.dataset.step)));
  pop.querySelectorAll('[data-inc]').forEach((b) => b.onclick = () => setVal(b.dataset.inc, (+cfg[b.dataset.inc]) + (+b.dataset.step)));
  pop.querySelectorAll('.indtb-val').forEach((inp) => inp.onchange = () => { const nv = parseFloat(inp.value); if (isFinite(nv)) setVal(inp.dataset.val, nv); else inp.value = cfg[inp.dataset.val]; });
  pop.querySelectorAll('.indtb-slider').forEach((sl) => sl.oninput = () => setVal(sl.dataset.slider, parseFloat(sl.value)));
}
function ubicarPop(pop, anchor) {
  const r = anchor.getBoundingClientRect();
  let left = r.left, top = r.bottom + 7;
  if (left + pop.offsetWidth > innerWidth - 8) left = innerWidth - pop.offsetWidth - 8;
  if (top + pop.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - pop.offsetHeight - 7);
  pop.style.left = Math.max(8, left) + 'px'; pop.style.top = top + 'px';
  pop.onmousedown = (e) => e.stopPropagation();
}
