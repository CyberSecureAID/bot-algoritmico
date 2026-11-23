/* modules/spot/indicadores-spot.js — Indicadores para la gráfica de Spot.
   ──────────────────────────────────────────────────────────────────────────────
   REUTILIZA el módulo compartido modules/indicadores/ (mismas fórmulas, mismo
   catálogo y la MISMA barra de configuración que multichart). Aquí solo se guarda
   el estado y se DIBUJA sobre la gráfica de Spot con las series nativas de
   LightweightCharts: overlays en el panel del precio, osciladores en su propio panel.

   No toca multichart ni el resto de spot.js. Se engancha por tres puntos:
     initIndSpot(ctx)  una vez (ctx da acceso a la gráfica, las velas y el host).
     reaplicarInd()    cuando la gráfica se reconstruye (recrea las series).
     refrescarInd()    cuando llega una vela nueva (actualiza los datos).            */

import { INDICADORES, calcular as _calcular, cfgInicial as _cfgInicial, buscarInd as _buscarInd, transformar, nombreInd as _nombreInd } from '../indicadores/libreria.js?v=7';
import { abrirBarraInd } from '../indicadores/ui.js?v=7';

const LS = 'sp-indicadores';
const baseId = (k) => String(k).split('#')[0];

/* ── MultiMA: un solo indicador con 5 medias (EMA) configurables por separado.
   Es LOCAL de Spot (no va en la libreria compartida, para no tocar multichart). El
   motor de overlays ya dibuja varias lineas con color y grosor por linea, asi que
   MultiMA solo devuelve 5 lineas. buscarInd/calcular/cfgInicial/nombreInd se envuelven
   para atender 'multima' sin cambiar el resto. ── */
function emaCalc(src, n) {
  n = Math.max(1, Math.round(n || 1)); const out = new Array(src.length).fill(null);
  if (src.length < n) return out; const k = 2 / (n + 1); let prev = null, suma = 0;
  for (let i = 0; i < src.length; i++) { const v = src[i]; if (v == null) { out[i] = prev; continue; } if (i < n - 1) { suma += v; continue; } if (i === n - 1) { suma += v; prev = suma / n; out[i] = prev; continue; } prev = v * k + prev * (1 - k); out[i] = prev; }
  return out;
}
const MM_DEF = [
  { periodo: 9, col: '#f5d13b', gr: 2 },    // amarillo
  { periodo: 20, col: '#49b6ff', gr: 2 },   // azul
  { periodo: 50, col: '#ff5b6e', gr: 2 },   // rojo
  { periodo: 100, col: '#2ee86a', gr: 2 },  // verde
  { periodo: 200, col: '#ffffff', gr: 2 }   // blanco
];
const MULTIMA = { id: 'multima', nom: 'MultiMA', grupo: 'Trend', tipo: 'ovl', estilo: { col: '#f5d13b', gr: 2 } };
const CATALOGO = INDICADORES.concat([MULTIMA]);   // catalogo del selector (51)
function buscarInd(id) { return id === 'multima' ? MULTIMA : _buscarInd(id); }
function cfgInicial(def) { return (def && def.id === 'multima') ? { col: MM_DEF[0].col, lineas: MM_DEF.map((l) => Object.assign({}, l)) } : _cfgInicial(def); }
function nombreInd(def, c) { return (def && def.id === 'multima') ? 'MultiMA' : _nombreInd(def, c); }
function calcular(def, velas, c) {
  if (def && def.id === 'multima') {
    const cls = velas.map((v) => v.close);
    const lns = (c && c.lineas && c.lineas.length) ? c.lineas : MM_DEF;
    return { lineas: lns.map((l) => ({ data: emaCalc(cls, l.periodo), col: l.col, gr: l.gr })) };
  }
  return _calcular(def, velas, c);
}

let ctx = null;                 // { chart(), velas(), lc(), host() }
const ST = { ovl: new Set(), cfg: {}, oscK: null };   // estado persistente
let series = {};                // key -> [LCseries]  (overlays)
let osc = null;                 // { S2, refs, mounted } del oscilador activo
let _throttle = 0;

/* #rrggbb -> rgba con alpha. */
function hexA(h, a) { if (!h || h[0] !== '#') return h; h = h.slice(1); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function cfgDe(key) { const def = buscarInd(baseId(key)); if (!ST.cfg[key] && def) ST.cfg[key] = cfgInicial(def); return ST.cfg[key] || {}; }
function lsNum(cfg) { return cfg.ls === 'dotted' ? 1 : cfg.ls === 'dashed' ? 2 : 0; }
function optsLinea(cfg, ln) {
  const op = (cfg.op != null ? cfg.op : 100) / 100;
  return { color: hexA(ln.col || cfg.col, (ln.a != null ? ln.a : 1) * op), lineWidth: Math.max(1, Math.round(ln.gr || cfg.gr || 2)), lineStyle: lsNum(cfg), priceLineVisible: !!cfg.tag, lastValueVisible: !!cfg.tag };
}
/* array de valores + velas -> datos LC {time,value}, respetando el desplazamiento. */
function serieData(velas, data, shift) { shift = shift || 0; const o = []; for (let i = 0; i < data.length; i++) { const val = data[i]; if (val == null) continue; const j = i + shift; const t = velas[j] && velas[j].time; if (t == null) continue; o.push({ time: t, value: val }); } return o; }

/* ── Overlays (sobre el precio, panel 0) ── */
function quitarSeriesOvl(key) { const chart = ctx.chart(); (series[key] || []).forEach((s) => { try { chart && chart.removeSeries(s); } catch (_) {} }); delete series[key]; }
function construirOverlay(key) {
  quitarSeriesOvl(key);
  const def = buscarInd(baseId(key)); const chart = ctx.chart(); const LC = ctx.lc(); const velas = ctx.velas();
  if (!def || def.tipo !== 'ovl' || !chart || !LC || !velas.length) return;
  const c = cfgDe(key); const r = calcular(def, velas, c) || {};
  const arr = [];
  (r.lineas || []).forEach((ln) => { try { const s = chart.addSeries(LC.LineSeries, optsLinea(c, ln)); s.setData(serieData(velas, transformar(ln.data, c), (ln.shift || 0) + (c.desp || 0))); arr.push(s); } catch (_) {} });
  series[key] = arr;
}
function actualizarOverlay(key) {
  const def = buscarInd(baseId(key)); const velas = ctx.velas();
  if (!def || !velas.length) return;
  const c = cfgDe(key); const r = calcular(def, velas, c) || {}; const lineas = r.lineas || []; const arr = series[key] || [];
  if (arr.length !== lineas.length) { construirOverlay(key); return; }   // cambió la forma: reconstruir
  lineas.forEach((ln, i) => { try { arr[i].applyOptions(optsLinea(c, ln)); arr[i].setData(serieData(velas, transformar(ln.data, c), (ln.shift || 0) + (c.desp || 0))); } catch (_) {} });
}

/* ── Oscilador (su propio panel nativo, panel 1). Uno a la vez, como multichart. ── */
function desmontarOsc() { const chart = ctx.chart(); if (osc && osc.S2) Object.keys(osc.S2).forEach((k) => { try { chart && chart.removeSeries(osc.S2[k]); } catch (_) {} }); osc = null; }
function crearOsc(def, c, r) {
  const chart = ctx.chart(); const LC = ctx.lc(); const S2 = {};
  if (r.hist) S2.hist = chart.addSeries(LC.HistogramSeries, { priceLineVisible: false, lastValueVisible: r.serie == null, base: 0 }, 1);
  if (r.serie3 != null) S2.s3 = chart.addSeries(LC.LineSeries, { color: r.col3 || '#49b6ff', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 1);
  if (r.serie2 != null) S2.s2 = chart.addSeries(LC.LineSeries, { color: r.col2 || '#ff8fbf', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, 1);
  if (r.serie != null) S2.main = chart.addSeries(LC.LineSeries, { color: c.col, lineWidth: c.gr || 2, priceLineVisible: false, lastValueVisible: true }, 1);
  const ref = S2.main || S2.hist;
  if (def.rango && ref) { try { ref.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: def.rango[0], maxValue: def.rango[1] } }) }); } catch (_) {} }
  const refs = [];
  if (ref) (def.ref || []).forEach((rv) => { try { refs.push(ref.createPriceLine({ price: rv, color: 'rgba(255,255,255,.22)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true })); } catch (_) {} });
  osc = { S2, refs, mounted: null };
  try { const host = ctx.host(); const ps = chart.panes(); if (ps[1]) ps[1].setHeight(Math.max(90, Math.round((host ? host.clientHeight : 300) * 0.28))); } catch (_) {}
}
function sincronizarOsc(key) {
  const def = buscarInd(baseId(key)); const velas = ctx.velas();
  if (!def || def.tipo !== 'osc' || !velas.length) { desmontarOsc(); return; }
  const c = cfgDe(key); const r = calcular(def, velas, c) || {};
  const forma = def.id + ':' + (r.serie != null ? '1' : '0') + (r.serie2 != null ? '2' : '0') + (r.serie3 != null ? '3' : '0') + (r.hist ? 'h' : '0');
  if (!osc || osc.mounted !== forma) { desmontarOsc(); crearOsc(def, c, r); if (osc) osc.mounted = forma; }
  if (!osc || !osc.S2) return;
  const S2 = osc.S2, op = (c.op != null ? c.op : 100) / 100, lsN = lsNum(c), dsp = c.desp || 0;
  if (S2.hist && r.hist) { const h = []; let prev = null; for (let i = 0; i < r.hist.length; i++) { const hv = r.hist[i]; if (hv == null) continue; const j = i + dsp; const t = velas[j] && velas[j].time; if (t == null) continue; const col = r.histMom ? ((prev == null || hv >= prev) ? 'rgba(46,232,106,.62)' : 'rgba(255,91,110,.62)') : (hv >= 0 ? 'rgba(46,232,106,.55)' : 'rgba(255,91,110,.55)'); prev = hv; h.push({ time: t, value: hv, color: col }); } try { S2.hist.setData(h); } catch (_) {} }
  const wrp = (s) => transformar(s, c);
  if (S2.s3 && r.serie3) { try { S2.s3.applyOptions({ color: hexA(r.col3 || '#49b6ff', op), lineWidth: c.gr || 2, lineStyle: lsN }); S2.s3.setData(serieData(velas, wrp(r.serie3), dsp)); } catch (_) {} }
  if (S2.s2 && r.serie2) { try { S2.s2.applyOptions({ color: hexA(r.col2 || '#ff8fbf', op), lineWidth: c.gr || 2, lineStyle: lsN }); S2.s2.setData(serieData(velas, wrp(r.serie2), dsp)); } catch (_) {} }
  if (S2.main && r.serie) { try { S2.main.applyOptions({ color: hexA(c.col, op), lineWidth: c.gr || 2, lineStyle: lsN, priceLineVisible: !!c.tag }); S2.main.setData(serieData(velas, wrp(r.serie), dsp)); } catch (_) {} }
}

/* ── Estado: alta, baja, recálculo ── */
function recalcTodo() {
  ST.ovl.forEach((key) => actualizarOverlay(key));
  if (ST.oscK) sincronizarOsc(ST.oscK); else desmontarOsc();
  pintarLeyenda();
}
function reconstruirTodo() {   // la gráfica se recreó: hay que volver a crear las series
  series = {}; osc = null;
  ST.ovl.forEach((key) => construirOverlay(key));
  if (ST.oscK) sincronizarOsc(ST.oscK);
  pintarLeyenda();
}
function activo(def) { return def.tipo === 'ovl' ? [...ST.ovl].some((k) => baseId(k) === def.id) : (ST.oscK && baseId(ST.oscK) === def.id); }
function alternar(id) {
  const def = buscarInd(id); if (!def) return null;
  if (def.tipo === 'ovl') {
    const has = [...ST.ovl].some((k) => baseId(k) === id);
    if (has) { [...ST.ovl].forEach((k) => { if (baseId(k) === id) { ST.ovl.delete(k); quitarSeriesOvl(k); delete ST.cfg[k]; } }); guardar(); pintarLeyenda(); return null; }
    ST.ovl.add(id); construirOverlay(id); guardar(); pintarLeyenda(); return id;
  }
  const enc = baseId(ST.oscK || '') !== id;
  if (ST.oscK) { ST.oscK = null; desmontarOsc(); }
  if (enc) { ST.oscK = id; sincronizarOsc(id); }
  guardar(); pintarLeyenda(); return enc ? id : null;
}
function quitar(key) {
  if (ST.ovl.has(key)) { ST.ovl.delete(key); quitarSeriesOvl(key); delete ST.cfg[key]; }
  else if (ST.oscK === key || baseId(ST.oscK || '') === baseId(key)) { ST.oscK = null; desmontarOsc(); delete ST.cfg[key]; }
  guardar(); pintarLeyenda();
}
function duplicar(id) { const base = baseId(id); let n = 2; while (ST.ovl.has(base + '#' + n)) n++; const key = base + '#' + n; ST.ovl.add(key); try { ST.cfg[key] = JSON.parse(JSON.stringify(cfgDe(id))); } catch (_) { ST.cfg[key] = Object.assign({}, cfgDe(id)); } construirOverlay(key); guardar(); pintarLeyenda(); setTimeout(() => barraDe(key), 30); }

function guardar() { try { localStorage.setItem(LS, JSON.stringify({ ovl: [...ST.ovl], cfg: ST.cfg, oscK: ST.oscK })); } catch (_) {} }
function cargar() { try { const s = JSON.parse(localStorage.getItem(LS) || '{}'); if (s && typeof s === 'object') { ST.ovl = new Set(Array.isArray(s.ovl) ? s.ovl : []); ST.cfg = s.cfg && typeof s.cfg === 'object' ? s.cfg : {}; ST.oscK = s.oscK || null; } } catch (_) {} }

/* ── Barra de configuración de un indicador puesto (la MISMA de multichart) ── */
function barraDe(key) {
  if (baseId(key) === 'multima') { panelMultiMA(key); return; }   // MultiMA tiene su panel compacto propio
  const def = buscarInd(baseId(key)); if (!def) return; const c = cfgDe(key);
  const host = ctx.host(); const r = host ? host.getBoundingClientRect() : { left: 0, width: innerWidth, top: 0 };
  abrirBarraInd({
    cfg: c, params: def.params || [], opc: def.op || [], tipo: def.tipo, nombre: nombreInd(def, c), nombreDe: () => nombreInd(def, c),
    cx: r.left + r.width / 2, cy: r.top + 8,
    onCambio: () => { if (def.tipo === 'ovl') construirOverlay(key); else sincronizarOsc(key); guardar(); pintarLeyenda(); },
    onEliminar: () => quitar(key),
    onDuplicar: def.tipo === 'ovl' ? () => duplicar(key) : null
  });
}

/* ── Panel compacto de MultiMA: color, periodo y grosor por cada media.
   Angosto (sirve en movil), con scroll interno y posicion acotada para que
   NUNCA se salga por abajo ni por los lados. ── */
let _mmPanel = null;
function cerrarMMPanel() { if (_mmPanel) { try { _mmPanel.remove(); } catch (_) {} _mmPanel = null; document.removeEventListener('mousedown', _mmDoc, true); } }
function _mmDoc(e) { if (_mmPanel && !_mmPanel.contains(e.target) && !e.target.closest('.sp-ind-chip')) cerrarMMPanel(); }
function panelMultiMA(key) {
  cerrarGest(); cerrarMMPanel();
  const c = cfgDe(key); if (!c.lineas || !c.lineas.length) c.lineas = MM_DEF.map((l) => Object.assign({}, l));
  const host = ctx.host(); if (!host) return;
  const pop = document.createElement('div'); pop.className = 'sp-mm'; _mmPanel = pop;
  const rows = c.lineas.map((l, i) => `<div class="sp-mm-row">
    <input type="color" class="sp-mm-c" data-i="${i}" value="${l.col}" title="Color">
    <input type="number" class="sp-mm-p" data-i="${i}" value="${Math.round(l.periodo)}" min="1" max="400" inputmode="numeric" title="Length">
    <select class="sp-mm-g" data-i="${i}" title="Width">${[1, 2, 3, 4].map((g) => `<option value="${g}"${Math.round(l.gr || 2) === g ? ' selected' : ''}>${g}px</option>`).join('')}</select>
  </div>`).join('');
  pop.innerHTML = `<div class="sp-mm-h"><b>MultiMA</b><span class="sp-mm-sub">5 moving averages (EMA)</span><button class="sp-mm-x" title="Close">✕</button></div>
    <div class="sp-mm-cols"><span>Color</span><span>Length</span><span>Width</span></div>
    <div class="sp-mm-list">${rows}</div>
    <button class="sp-mm-del">Remove indicator</button>`;
  host.appendChild(pop);
  // posicion acotada dentro del host (ni por abajo ni por los lados)
  const btn = host.querySelector('#sp-ind-btn'); const hr = host.getBoundingClientRect();
  const bl = btn ? (btn.offsetLeft) : 8, bb = btn ? (btn.offsetTop + btn.offsetHeight) : 40;
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = Math.max(6, Math.min(bl, host.clientWidth - pw - 6)) + 'px';
  let top = bb + 6; const maxTop = host.clientHeight - ph - 6; if (top > maxTop) top = Math.max(6, maxTop); pop.style.top = top + 'px';
  const aplica = () => { actualizarOverlay(key); guardar(); pintarLeyenda(); };
  pop.querySelectorAll('.sp-mm-c').forEach((inp) => inp.oninput = () => { const i = +inp.dataset.i; c.lineas[i].col = inp.value; if (i === 0) c.col = inp.value; aplica(); });
  pop.querySelectorAll('.sp-mm-p').forEach((inp) => inp.onchange = () => { const n = Math.max(1, Math.min(400, Math.round(+inp.value || 1))); inp.value = n; c.lineas[+inp.dataset.i].periodo = n; aplica(); });
  pop.querySelectorAll('.sp-mm-g').forEach((sel) => sel.onchange = () => { c.lineas[+sel.dataset.i].gr = +sel.value; aplica(); });
  pop.querySelector('.sp-mm-x').onclick = cerrarMMPanel;
  pop.querySelector('.sp-mm-del').onclick = () => { cerrarMMPanel(); quitar(key); };
  setTimeout(() => document.addEventListener('mousedown', _mmDoc, true), 0);
}

/* ── Leyenda: chips de los indicadores activos (tocar = configurar, X = quitar) ── */
function activos() { const items = []; ST.ovl.forEach((k) => { const d = buscarInd(baseId(k)); if (d) items.push({ key: k, def: d }); }); if (ST.oscK) { const d = buscarInd(baseId(ST.oscK)); if (d) items.push({ key: ST.oscK, def: d }); } return items; }
const MAXVIS = 3;   // 3 chips visibles + "+N" (el 4to y siguientes se colapsan)
function pintarLeyenda() {
  const host = ctx.host(); if (!host) return;
  let leg = host.querySelector('#sp-ind-leg'); if (!leg) { leg = document.createElement('div'); leg.id = 'sp-ind-leg'; leg.className = 'sp-ind-leg'; host.appendChild(leg); }
  const items = activos();
  const vis = items.slice(0, MAXVIS), resto = items.length - vis.length;
  let html = vis.map(({ key, def }) => { const c = cfgDe(key); return `<span class="sp-ind-chip" data-id="${key}" style="color:${c.col}"><i style="background:${c.col}"></i>${nombreInd(def, c)}<button class="sp-ind-chipx" data-x="${key}" title="Remove">✕</button></span>`; }).join('');
  if (resto > 0) html += `<button class="sp-ind-chip sp-ind-mas" data-mas="1" title="All indicators">+${resto}</button>`;
  leg.innerHTML = html;
  leg.querySelectorAll('.sp-ind-chip[data-id]').forEach((ch) => ch.onclick = (e) => { if (e.target.closest('.sp-ind-chipx')) return; e.stopPropagation(); cerrarGest(); barraDe(ch.dataset.id); });
  leg.querySelectorAll('.sp-ind-chipx').forEach((b) => b.onclick = (e) => { e.stopPropagation(); quitar(b.dataset.x); });
  const mas = leg.querySelector('[data-mas]');
  if (mas) {
    mas.onclick = (e) => { e.stopPropagation(); abrirGest(mas); };
    mas.onmouseenter = () => { clearTimeout(_gestTmr); abrirGest(mas); };   // se abre al acercar el cursor
    mas.onmouseleave = () => { _gestTmr = setTimeout(cerrarGest, 220); };
  }
  const btn = host.querySelector('#sp-ind-btn');
  if (btn) {
    btn.classList.toggle('on', items.length > 0);
    // leyenda a la DERECHA del boton, en su misma fila (como multichart)
    leg.style.left = (btn.offsetLeft + btn.offsetWidth + 8) + 'px';
    leg.style.top = (btn.offsetTop + (btn.offsetHeight - 21) / 2) + 'px';
  }
}
/* Gestor de TODOS los indicadores activos (lo abre el "+N"): lista con config y papelera. */
let _gest = null, _gestTmr = null;
function cerrarGest() { clearTimeout(_gestTmr); if (_gest) { try { _gest.remove(); } catch (_) {} _gest = null; document.removeEventListener('mousedown', _gestDoc, true); } }
function _gestDoc(e) { if (_gest && !_gest.contains(e.target) && !e.target.closest('[data-mas]')) cerrarGest(); }
function abrirGest(anc) {
  cerrarGest(); const host = ctx.host(); if (!host) return;
  const pop = document.createElement('div'); pop.className = 'sp-ind-gest'; _gest = pop;
  pop.innerHTML = `<div class="sp-ind-gest-h">Indicators</div><div class="sp-ind-gest-list"></div>`;
  host.appendChild(pop);
  const rh = host.getBoundingClientRect(), ra = anc.getBoundingClientRect();
  pop.style.left = Math.max(6, ra.left - rh.left) + 'px'; pop.style.top = (ra.bottom - rh.top + 6) + 'px';
  pop.onmouseenter = () => clearTimeout(_gestTmr);               // mantener abierto al pasar al popup
  pop.onmouseleave = () => { _gestTmr = setTimeout(cerrarGest, 220); };
  llenarGest(pop); setTimeout(() => document.addEventListener('mousedown', _gestDoc, true), 0);
}
function llenarGest(pop) {
  const list = pop.querySelector('.sp-ind-gest-list'); if (!list) return;
  const items = activos(); if (!items.length) { cerrarGest(); return; }
  list.innerHTML = items.map(({ key, def }) => { const c = cfgDe(key); return `<div class="sp-ind-grow" data-id="${key}"><i style="background:${c.col}"></i><span class="nm" style="color:${c.col}">${nombreInd(def, c)}</span><button class="sp-ind-gdel" data-del="${key}" title="Remove">✕</button></div>`; }).join('');
  list.querySelectorAll('.sp-ind-grow .nm').forEach((n) => n.onclick = () => { cerrarGest(); barraDe(n.parentElement.dataset.id); });
  list.querySelectorAll('.sp-ind-gdel').forEach((b) => b.onclick = (e) => { e.stopPropagation(); quitar(b.dataset.del); llenarGest(pop); });
}

/* ── Selector de indicadores (popup con categorías y búsqueda) ── */
const CATS = [['all', 'All'], ['Trend', 'Trend'], ['Volume', 'Volume'], ['Volatility', 'Volatility'], ['Momentum', 'Momentum']];
let _modal = null;
function cerrarModal() { if (_modal) { try { _modal.remove(); } catch (_) {} _modal = null; } document.removeEventListener('keydown', escCerrar, true); }
function escCerrar(e) { if (e.key === 'Escape') cerrarModal(); }
/* Cuantas instancias activas hay de un overlay (ema, ema#2 ...). */
function nInst(id) { let n = 0; ST.ovl.forEach((k) => { if (baseId(k) === id) n++; }); return n; }
function abrirSelector() {
  cerrarModal();
  const ov = document.createElement('div'); ov.className = 'sp-ind-ov'; _modal = ov;
  const rows = CATALOGO.map((d) => {
    const c = (ST.cfg[d.id]) || d.estilo;
    const n = d.tipo === 'ovl' ? nInst(d.id) : 0;
    // overlays: boton "+" para agregar OTRA instancia (EMA 9 y EMA 200, por ejemplo) y contador si hay 2+
    const extra = d.tipo === 'ovl' ? `${n >= 2 ? `<span class="sp-icnt">×${n}</span>` : ''}<span class="sp-idup" data-dup="${d.id}" title="Add another ${d.nom}">+</span>` : '';
    return `<button class="sp-irow${activo(d) ? ' on' : ''}" data-id="${d.id}" data-grp="${d.grupo}"><i class="dot" style="background:${c.col}"></i><span class="nm">${d.nom}</span><span class="tag">${d.tipo === 'ovl' ? 'Price' : 'Panel'}</span><span class="ck">✓</span>${extra}</button>`;
  }).join('');
  const cats = CATS.map(([k, lbl], i) => `<button class="sp-icat${i === 0 ? ' on' : ''}" data-cat="${k}">${lbl}</button>`).join('');
  ov.innerHTML = `<div class="sp-ind-modal"><div class="sp-ind-head"><b>Indicators</b><button class="sp-ind-close" title="Close">✕</button></div>
    <div class="sp-ind-search"><input placeholder="Search indicator…"><span class="cnt"></span></div>
    <div class="sp-ind-grid"><div class="sp-ind-cats">${cats}</div><div class="sp-ind-list">${rows}</div></div></div>`;
  document.body.appendChild(ov);
  const list = ov.querySelector('.sp-ind-list'), search = ov.querySelector('input'), cnt = ov.querySelector('.cnt');
  let cat = 'all';
  const filtrar = () => { const q = search.value.trim().toLowerCase(); let n = 0; list.querySelectorAll('.sp-irow').forEach((b) => { const d = buscarInd(b.dataset.id); const ok = (cat === 'all' || b.dataset.grp === cat) && (!q || (d && d.nom.toLowerCase().indexOf(q) >= 0)); b.style.display = ok ? '' : 'none'; if (ok) n++; }); if (cnt) cnt.textContent = n + ' indicators'; };
  ov.querySelectorAll('.sp-icat').forEach((b) => b.onclick = () => { cat = b.dataset.cat; ov.querySelectorAll('.sp-icat').forEach((x) => x.classList.toggle('on', x === b)); filtrar(); });
  search.oninput = filtrar; filtrar(); setTimeout(() => { try { search.focus(); } catch (_) {} }, 40);
  list.querySelectorAll('.sp-irow').forEach((row) => row.onclick = () => {
    const id = row.dataset.id, def = buscarInd(id); if (!def) return;
    const enc = alternar(id);
    if (def.tipo === 'ovl') row.classList.toggle('on', [...ST.ovl].some((k) => baseId(k) === id));
    else list.querySelectorAll('.sp-irow').forEach((x) => { const dd = buscarInd(x.dataset.id); if (dd && dd.tipo === 'osc') x.classList.toggle('on', ST.oscK && baseId(ST.oscK) === x.dataset.id); });
    if (enc) { cerrarModal(); setTimeout(() => barraDe(id), 30); }
  });
  list.querySelectorAll('.sp-idup').forEach((p) => p.onclick = (e) => { e.stopPropagation(); cerrarModal(); duplicar(p.dataset.dup); });   // "+" = agregar otra instancia y abrir sus ajustes
  ov.querySelector('.sp-ind-close').onclick = cerrarModal;
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) cerrarModal(); });
  document.addEventListener('keydown', escCerrar, true);
}

/* ── CSS propio (no toca estilos.js). La barra de config trae el suyo desde ui.js. ── */
function inyectarCSS() {
  if (document.getElementById('sp-ind-css')) return;
  const st = document.createElement('style'); st.id = 'sp-ind-css';
  st.textContent = `
  .sp-ind-btn{position:absolute;top:8px;left:8px;z-index:6;height:26px;padding:0 10px;border-radius:7px;border:1px solid rgba(255,255,255,.12);background:rgba(17,22,28,.82);color:#cfd8e3;font:700 11.5px/1 "Chakra Petch",system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;backdrop-filter:blur(4px)}
  .sp-ind-btn:hover{border-color:rgba(232,184,75,.6);color:#E8B84B}
  .sp-ind-btn.on{border-color:rgba(232,184,75,.55);color:#E8B84B}
  .sp-ind-leg{position:absolute;top:10px;left:98px;z-index:6;display:flex;flex-wrap:nowrap;align-items:center;gap:5px;max-width:calc(100% - 110px);pointer-events:none}
  .sp-ind-chip{pointer-events:auto;display:inline-flex;align-items:center;gap:5px;height:21px;padding:0 5px 0 7px;border-radius:6px;background:rgba(17,22,28,.82);border:1px solid rgba(255,255,255,.1);font:700 10.5px/1 "IBM Plex Mono",monospace;cursor:pointer;backdrop-filter:blur(4px)}
  .sp-ind-chip i{width:7px;height:7px;border-radius:50%;flex:none}
  .sp-ind-mas{color:#E8B84B!important;font-weight:800;border-color:rgba(232,184,75,.45)!important;background:rgba(232,184,75,.12)!important}
  .sp-mm{position:absolute;z-index:8;width:206px;max-height:calc(100% - 14px);display:flex;flex-direction:column;background:#141b24;border:1px solid #2b3139;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.55);font-family:"IBM Plex Mono",monospace;overflow:hidden}
  .sp-mm-h{display:flex;align-items:center;gap:6px;padding:9px 10px 7px;border-bottom:1px solid #222a33}
  .sp-mm-h b{font:800 12px system-ui;color:#eaecef}
  .sp-mm-sub{flex:1;font-size:8.5px;color:#8b96a3;line-height:1.1}
  .sp-mm-x{flex:none;width:20px;height:20px;border:0;background:rgba(255,255,255,.06);border-radius:6px;color:#b7bdc6;cursor:pointer;font-size:11px;line-height:1}
  .sp-mm-cols{display:flex;gap:6px;padding:7px 10px 3px;font-size:8px;letter-spacing:.04em;text-transform:uppercase;color:#6b7580}
  .sp-mm-cols span:nth-child(1){width:26px}.sp-mm-cols span:nth-child(2){width:56px}.sp-mm-cols span:nth-child(3){flex:1}
  .sp-mm-list{display:flex;flex-direction:column;gap:5px;padding:4px 10px 8px;overflow-y:auto}
  .sp-mm-row{display:flex;align-items:center;gap:6px}
  .sp-mm-c{width:26px;height:26px;flex:none;padding:0;border:1px solid #3a424c;border-radius:6px;background:none;cursor:pointer}
  .sp-mm-c::-webkit-color-swatch-wrapper{padding:0}.sp-mm-c::-webkit-color-swatch{border:none;border-radius:5px}.sp-mm-c::-moz-color-swatch{border:none;border-radius:5px}
  .sp-mm-p{width:56px;height:28px;flex:none;background:#0e141b;border:1px solid #2b3139;border-radius:7px;color:#eaecef;font:700 12px "IBM Plex Mono",monospace;text-align:center}
  .sp-mm-g{flex:1;height:28px;background:#0e141b;border:1px solid #2b3139;border-radius:7px;color:#eaecef;font:700 11px "IBM Plex Mono",monospace;padding:0 6px;cursor:pointer}
  .sp-mm-del{margin:2px 10px 10px;padding:8px;border:1px solid rgba(246,70,93,.4);background:rgba(246,70,93,.08);color:#ff6b7d;border-radius:8px;font:700 10.5px "IBM Plex Mono",monospace;cursor:pointer}
  .sp-mm-del:hover{background:rgba(246,70,93,.16)}
  .sp-ind-chipx{border:0;background:none;color:inherit;opacity:.6;cursor:pointer;font-size:10px;padding:0 1px;line-height:1}
  .sp-ind-chipx:hover{opacity:1;color:#ff6b7a}
  .sp-ind-ov{position:fixed;inset:0;z-index:99999;background:rgba(4,8,12,.62);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)}
  .sp-ind-modal{width:min(560px,94vw);max-height:82vh;display:flex;flex-direction:column;background:#0e1319;border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6)}
  .sp-ind-head{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.08);color:#eaf0f6;font:800 15px "Chakra Petch",sans-serif}
  .sp-ind-close{border:0;background:none;color:#8b95a1;font-size:15px;cursor:pointer}.sp-ind-close:hover{color:#fff}
  .sp-ind-search{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:10px}
  .sp-ind-search input{flex:1;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:#070b10;color:#eaf0f6;padding:0 12px;font:500 13px system-ui;outline:none}
  .sp-ind-search input:focus{border-color:rgba(232,184,75,.5)}.sp-ind-search .cnt{color:#6b7580;font:600 11px "IBM Plex Mono",monospace;white-space:nowrap}
  .sp-ind-grid{display:flex;min-height:0;flex:1}
  .sp-ind-cats{width:150px;flex:none;border-right:1px solid rgba(255,255,255,.06);padding:8px;display:flex;flex-direction:column;gap:3px;overflow:auto}
  .sp-icat{text-align:left;border:0;background:none;color:#9aa7b5;padding:8px 10px;border-radius:7px;font:600 12px system-ui;cursor:pointer}
  .sp-icat:hover{background:rgba(255,255,255,.04);color:#eaf0f6}.sp-icat.on{background:rgba(232,184,75,.14);color:#E8B84B}
  .sp-ind-list{flex:1;overflow:auto;padding:8px}
  .sp-irow{width:100%;display:flex;align-items:center;gap:9px;padding:9px 11px;border:0;background:none;border-radius:8px;color:#cfd8e3;font:600 13px system-ui;cursor:pointer;text-align:left}
  .sp-irow:hover{background:rgba(255,255,255,.05)}
  .sp-irow .dot{width:9px;height:9px;border-radius:50%;flex:none}.sp-irow .nm{flex:1}
  .sp-irow .tag{font:600 10px "IBM Plex Mono",monospace;color:#6b7580;border:1px solid rgba(255,255,255,.1);border-radius:5px;padding:2px 6px}
  .sp-irow .ck{opacity:0;color:#2ee86a;font-weight:800}.sp-irow.on{background:rgba(46,232,106,.08)}.sp-irow.on .ck{opacity:1}
  .sp-icnt{font:800 10px "IBM Plex Mono",monospace;color:#E8B84B}
  .sp-idup{display:none;align-items:center;justify-content:center;width:22px;height:22px;flex:none;border-radius:6px;border:1px solid #C9A84B;background:rgba(232,184,75,.12);color:#E8B84B;font-size:15px;font-weight:800;line-height:1;cursor:pointer}
  .sp-irow.on .sp-idup{display:inline-flex}
  .sp-idup:hover{background:rgba(232,184,75,.26)}
  @media(max-width:560px){.sp-ind-cats{width:112px}}
  /* Scrollbars con estilo (copiado de multichart): track transparente + pulgar redondeado.
     Incluye la ventana de ajustes compartida de ui.js (.indtb-pop-cfg), que en Spot salía
     con la barra blanca/gris por defecto. */
  .sp-ind-list, .sp-ind-cats, .indtb-pop-cfg, .sp-ind-gest-list{scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.22) transparent}
  .sp-ind-list::-webkit-scrollbar, .sp-ind-cats::-webkit-scrollbar, .indtb-pop-cfg::-webkit-scrollbar, .sp-ind-gest-list::-webkit-scrollbar{width:10px; height:10px}
  .sp-ind-list::-webkit-scrollbar-track, .sp-ind-cats::-webkit-scrollbar-track, .indtb-pop-cfg::-webkit-scrollbar-track, .sp-ind-gest-list::-webkit-scrollbar-track{background:transparent}
  .sp-ind-list::-webkit-scrollbar-thumb, .sp-ind-cats::-webkit-scrollbar-thumb, .indtb-pop-cfg::-webkit-scrollbar-thumb, .sp-ind-gest-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18); border-radius:8px; border:2px solid transparent; background-clip:content-box}
  .sp-ind-list::-webkit-scrollbar-thumb:hover, .sp-ind-cats::-webkit-scrollbar-thumb:hover, .indtb-pop-cfg::-webkit-scrollbar-thumb:hover, .sp-ind-gest-list::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.32); background-clip:content-box}
  /* Gestor de la leyenda (lista de indicadores activos con +N). */
  .sp-ind-gest{position:absolute;z-index:7;min-width:190px;max-width:260px;background:#0e1319;border:1px solid rgba(255,255,255,.12);border-radius:10px;box-shadow:0 14px 40px rgba(0,0,0,.5);overflow:hidden}
  .sp-ind-gest-h{padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.08);color:#eaf0f6;font:800 12px "Chakra Petch",sans-serif}
  .sp-ind-gest-list{max-height:240px;overflow:auto;padding:5px}
  .sp-ind-grow{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:7px;cursor:pointer}
  .sp-ind-grow:hover{background:rgba(255,255,255,.05)}
  .sp-ind-grow i{width:8px;height:8px;border-radius:50%;flex:none}.sp-ind-grow .nm{flex:1;color:#cfd8e3;font:600 12px system-ui}
  .sp-ind-gdel{border:0;background:none;color:#8b95a1;cursor:pointer;font-size:12px;padding:0 2px}.sp-ind-gdel:hover{color:#ff6b7a}
  `;
  document.head.appendChild(st);
}

/* ── Hover sobre un overlay: cursor de manito + clic abre su config (NO marca entry). ── */
let _bajo = null, _hoverWired = false;
function cvEl() { const h = ctx && ctx.host(); return h ? h.querySelector('#sp-cv') : null; }
function hitOverlay(clientX, clientY) {
  if (!ctx || !ST.ovl.size) return null;
  const chart = ctx.chart(), serie = ctx.serie && ctx.serie(), velas = ctx.velas(), cv = cvEl();
  if (!chart || !serie || !velas.length || !cv) return null;
  const r = cv.getBoundingClientRect(); const x = clientX - r.left, y = clientY - r.top;
  if (x < 0 || y < 0 || x > r.width || y > r.height) return null;
  let logical = null; try { logical = chart.timeScale().coordinateToLogical(x); } catch (_) {}
  if (logical == null) return null;
  const idx = Math.round(logical); let best = null, bestD = 7;
  ST.ovl.forEach((key) => {
    const def = buscarInd(baseId(key)); if (!def) return; const c = cfgDe(key);
    const rr = calcular(def, velas, c) || {};
    (rr.lineas || []).forEach((ln) => {
      const di = idx - ((ln.shift || 0) + (c.desp || 0)); const val = transformar(ln.data, c)[di]; if (val == null) return;
      let yc = null; try { yc = serie.priceToCoordinate(val); } catch (_) {}
      if (yc == null) return; const d = Math.abs(yc - y); if (d < bestD) { bestD = d; best = key; }
    });
  });
  return best;
}
function onHoverMove(e) { const key = hitOverlay(e.clientX, e.clientY); _bajo = key; const cv = cvEl(); if (cv) cv.style.cursor = key ? 'pointer' : ''; }
function onHoverClick(e) { const key = hitOverlay(e.clientX, e.clientY); if (key) { e.stopPropagation(); cerrarGest(); barraDe(key); } }
function wireHover() {
  if (_hoverWired) return; const cv = cvEl(); if (!cv) return;
  cv.addEventListener('mousemove', onHoverMove);
  cv.addEventListener('mouseleave', () => { _bajo = null; cv.style.cursor = ''; });
  cv.addEventListener('click', onHoverClick, true);
  _hoverWired = true;
}
export function bajoCursor() { return _bajo; }   // spot.js lo consulta para no marcar entry sobre un indicador

/* ── API pública ── */
export function initIndSpot(opts) {
  ctx = opts; inyectarCSS(); cargar();
}
/* Llamar cuando la gráfica de Spot acaba de (re)construirse: pone el botón y recrea todo. */
export function reaplicarInd() {
  if (!ctx) return;
  const host = ctx.host(); if (!host) return;
  let btn = host.querySelector('#sp-ind-btn');
  if (!btn) { btn = document.createElement('button'); btn.id = 'sp-ind-btn'; btn.className = 'sp-ind-btn'; btn.textContent = 'Indicators'; host.appendChild(btn); btn.onclick = (e) => { e.stopPropagation(); abrirSelector(); }; }
  wireHover();
  try { reconstruirTodo(); } catch (_) {}
}
/* Llamar cuando llega una vela nueva: refresca los datos (limitado, para no recargar). */
export function refrescarInd() {
  if (!ctx || (!ST.ovl.size && !ST.oscK)) return;
  const now = Date.now(); if (now - _throttle < 400) return; _throttle = now;
  try { recalcTodo(); } catch (_) {}
}
export function hayIndicadores() { return ST.ovl.size > 0 || !!ST.oscK; }
