/* niveles/interaccion.js — Toda la interacción con la gráfica: cursores,
   herramientas de dibujo, arrastre, zoom, popups y barra de ajustes.
   Extraído de niveles.js; recibe dibujar/burbujas/guardarDib por parámetro
   para no crear dependencias circulares. Sin cambios de lógica. */

import { N } from './estado.js?v=1';
import { T } from './i18n.js?v=1';
import { dibAxy, dibXYa, _tfMs, DIB_FIBS } from './dibujo.js?v=1';

const $ = (id) => document.getElementById(id);

export function gestos(cv, dibujar, burbujas, guardarDib) {
  /* [CORREGIDO] El arrastre iba en cámara lenta porque redibujaba
     TODO en cada píxel de movimiento. Ahora se agrupa por
     fotograma: el navegador dibuja cuando puede, no cuando se lo
     pedimos. Es lo que hace TradingView. */
  let pendiente = false;
  const refrescar = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      dibujar();
      burbujas();
    });
  };

  const zoomX = (f) => {
    N.vista.ancho = Math.max(20, Math.min(600, Math.round(N.vista.ancho * f)));
    refrescar();
  };
  const zoomY = (f) => {
    N.vista.zoomY = Math.max(0.2, Math.min(5, (N.vista.zoomY || 1) * f));
    refrescar();
  };
  const enEscala = (x) => x > cv.clientWidth - 90;

  /* ══ Herramientas de dibujo: barra lateral, ajustes e interacción ══ */
  const loc = (e, t) => { const r = cv.getBoundingClientRect(); const s = t || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; };
  const tools = document.getElementById('nv-tools');
  let abrirBarra = () => {}, cerrarBarra = () => {};
  const grafEl = document.getElementById('nv-graf');
  let topbar = document.getElementById('nv-topbar');
  if (!topbar && grafEl) { topbar = document.createElement('div'); topbar.id = 'nv-topbar'; topbar.style.display = 'none'; grafEl.appendChild(topbar); }
  if (topbar && grafEl && !topbar._movible) {
    topbar._movible = true;
    let tb = null;
    topbar.addEventListener('mousedown', (e) => {
      const g0 = e.target.closest('.nv-tb-grip'); if (!g0) return;
      e.preventDefault(); const r = topbar.getBoundingClientRect(), gr = grafEl.getBoundingClientRect();
      tb = { dx: e.clientX - r.left, dy: e.clientY - r.top, gr };
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (e) => {
      if (!tb) return;
      const w = topbar.offsetWidth, hh = topbar.offsetHeight;
      let nx = e.clientX - tb.dx - tb.gr.left, ny = e.clientY - tb.dy - tb.gr.top;
      nx = Math.max(4, Math.min(tb.gr.width - w - 4, nx)); ny = Math.max(4, Math.min(tb.gr.height - hh - 4, ny));
      topbar.style.left = nx + 'px'; topbar.style.top = ny + 'px'; topbar.style.transform = 'none';
    });
    window.addEventListener('mouseup', () => { if (tb) { tb = null; document.body.style.userSelect = ''; } });
  }
  const COLORES = ['#22d3ee', '#E8B84B', '#2ee86a', '#ff3b52', '#a78bfa', '#ffffff'];
  const COLORES_FULL = ['#22d3ee', '#38bdf8', '#2ee86a', '#a3e635', '#ffd400', '#E8B84B', '#f59e0b', '#ff3b52', '#fb7185', '#a78bfa', '#e879f9', '#94a3b8', '#ffffff'];
  const FIB_TODOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2, 2.618];
  const rgbDe = (hex) => { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
  const CON_GROSOR = ['linea', 'flecha', 'rect', 'brush', 'regla', 'poslarga', 'poscorta'];
  const CON_PUNTEADO = ['linea', 'flecha', 'rect', 'rayo', 'vert'];

  const objSel = () => (N.sel >= 0 && N.dibujos[N.sel]) ? N.dibujos[N.sel] : null;
  const objEstilo = () => objSel() || N.estilo;
  const tipoCtx = () => (N.herr !== 'cursor' && N.herr !== 'borrar') ? N.herr : (objSel() ? objSel().tipo : null);

  const marcarBoton = () => {
    if (tools) {
      tools.querySelectorAll('.nv-tool[data-h]').forEach((o) => o.classList.toggle('on', o.dataset.h === N.herr));
      tools.classList.toggle('forz', N.herr !== 'cursor');   // no se oculta con herramienta activa
    }
    let cur = 'crosshair';
    if (N.herr === 'cursor') cur = N.cursorTipo === 'flecha' ? 'default' : (N.cursorTipo === 'punto' ? 'none' : 'crosshair');
    else if (N.herr === 'borrar') cur = 'crosshair';
    cv.style.cursor = cur;
  };
  const construirTopbar = () => {
    if (!topbar) return;
    const t = tipoCtx();
    if (!t) { topbar.style.display = 'none'; cerrarPopups(); return; }
    const o = objEstilo();
    // Interruptor "mantener activa" (sustituye a la estrella de favoritos)
    let h = `<span class="nv-tb-grip" title="Mover"><svg viewBox="0 0 12 20" width="11" height="18" aria-hidden="true"><circle cx="3.5" cy="4" r="1.3" fill="currentColor"/><circle cx="8.5" cy="4" r="1.3" fill="currentColor"/><circle cx="3.5" cy="10" r="1.3" fill="currentColor"/><circle cx="8.5" cy="10" r="1.3" fill="currentColor"/><circle cx="3.5" cy="16" r="1.3" fill="currentColor"/><circle cx="8.5" cy="16" r="1.3" fill="currentColor"/></svg></span>`;
    h += `<button class="nv-tb-b nv-tb-pin ${N.fijar ? 'on' : ''}" data-a="fijar" title="${N.fijar ? 'Mantener activa: SÍ' : 'Mantener activa: NO'}"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 7 3 3v2H7v-2l3-3z"/><path d="M12 16v4"/></svg></button><span class="nv-tb-sep"></span>`;
    const esPos = t === 'poslarga' || t === 'poscorta';
    const swColor = esPos ? (o.cEntry || '#eaecef') : (o.color || '#22d3ee');
    h += `<button class="nv-tb-b nv-tb-color" data-a="colorpop" title="Color"><span class="nv-tb-swatch" style="background:${swColor}"></span></button>`;
    if (CON_GROSOR.includes(t)) h += '<span class="nv-tb-sep"></span>' + [1, 2, 3, 4].map((w) => `<button class="nv-tb-b nv-tb-gr ${(o.grosor || 2) === w ? 'on' : ''}" data-gr="${w}"><i style="height:${w + 1}px"></i></button>`).join('');
    if (t === 'marca') h += '<span class="nv-tb-sep"></span>' + [['S', 5], ['M', 7], ['L', 10]].map((e) => `<button class="nv-tb-b nv-tb-tx ${(o.tam || 7) === e[1] ? 'on' : ''}" data-tam="${e[1]}">${e[0]}</button>`).join('');
    if (t === 'texto') h += '<span class="nv-tb-sep"></span>' + [['S', 12], ['M', 17], ['L', 24]].map((e) => `<button class="nv-tb-b nv-tb-tx ${(o.tam || 13) === e[1] ? 'on' : ''}" data-tam="${e[1]}">${e[0]}</button>`).join('');
    if (CON_PUNTEADO.includes(t)) h += `<span class="nv-tb-sep"></span><button class="nv-tb-b ${o.punteado ? 'on' : ''}" data-a="dash" title="Punteado">╌</button>`;
    if (esPos || t === 'rect') h += '<span class="nv-tb-sep"></span>' + [['Suave', .45], ['Media', .7], ['Fuerte', 1]].map((e) => `<button class="nv-tb-b nv-tb-tx ${((o.intensidad != null ? o.intensidad : 1) === e[1]) ? 'on' : ''}" data-int="${e[1]}" title="Intensidad del color">${e[0]}</button>`).join('');
    if (t === 'fib') h += `<span class="nv-tb-sep"></span><button class="nv-tb-b nv-tb-niv" data-a="fibpop" title="Niveles">Niveles</button>`;
    h += `<span class="nv-tb-sep"></span><button class="nv-tb-b nv-tb-del" data-a="del" title="Eliminar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg></button>`;
    topbar.innerHTML = h; topbar.style.display = 'flex';
  };
  const aplicar = (prop, val) => {
    const o = objSel();
    if (o) { o[prop] = val; if (prop === 'color') o.rgb = rgbDe(val); guardarDib(); }
    else { N.estilo[prop] = val; if (prop === 'color') N.estilo.rgb = rgbDe(val); }
    construirTopbar(); dibujar();
  };
  const seleccionar = (h) => { if (h !== N.herr) N.fijar = false; if (colocando) { colocando = false; N.dib = null; } N.herr = h; N.sel = -1; cerrarPopups(); marcarBoton(); construirTopbar(); };

  // ── Popups flotantes (color, niveles Fibonacci, tipos de línea) ──
  let popActual = null;
  const cerrarPopups = () => { if (grafEl) grafEl.querySelectorAll('.nv-pop').forEach((p) => p.remove()); popActual = null; };
  const crearPop = (anchor, abajo, src) => {
    cerrarPopups();
    popActual = src || null;
    const pop = document.createElement('div'); pop.className = 'nv-pop'; if (src) pop.dataset.src = src;
    grafEl.appendChild(pop);
    const gr = grafEl.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    requestAnimationFrame(() => {
      const pw = pop.offsetWidth || 180, ph = pop.offsetHeight || 100;
      pop.style.left = Math.max(6, Math.min(gr.width - pw - 6, ar.left - gr.left + (abajo ? 0 : ar.width + 6))) + 'px';
      pop.style.top = Math.max(6, Math.min(gr.height - ph - 6, abajo ? (ar.bottom - gr.top + 6) : (ar.top - gr.top))) + 'px';
    });
    setTimeout(() => document.addEventListener('mousedown', function cerra(ev) {
      if (!pop.contains(ev.target) && !(topbar && topbar.contains(ev.target)) && !(tools && tools.contains(ev.target))) { pop.remove(); popActual = null; document.removeEventListener('mousedown', cerra); }
    }), 0);
    return pop;
  };
  const colorPop = (anchor) => {
    const pop = crearPop(anchor, true, 'colorpop'); pop.classList.add('nv-pop-col');
    pop.innerHTML = COLORES_FULL.map((c) => `<button class="nv-pc" data-col="${c}" style="background:${c}"></button>`).join('');
    pop.addEventListener('click', (e) => { const b = e.target.closest('[data-col]'); if (!b) return; aplicar('color', b.dataset.col); cerrarPopups(); });
  };
  // Color de las 3 líneas de la posición (objetivo / entrada / stop)
  const colorPopPos = (anchor) => {
    const pop = crearPop(anchor, true, 'colorpop'); pop.classList.add('nv-pop-fib');
    const o = objSel() || N.estilo;
    const filas = [['cTarget', 'Objetivo', o.cTarget || '#2ee86a'], ['cEntry', 'Entrada', o.cEntry || '#eaecef'], ['cStop', 'Stop', o.cStop || '#ff3b52']];
    pop.innerHTML = filas.map((f) => `<div class="nv-pop-t">${f[1]}</div><div class="nv-pop-col nv-pcp" data-k="${f[0]}">` +
      COLORES_FULL.map((c) => `<button class="nv-pc ${c.toLowerCase() === f[2].toLowerCase() ? 'on' : ''}" data-col="${c}" style="background:${c}"></button>`).join('') + '</div>').join('');
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('[data-col]'); if (!b) return;
      const k = b.parentNode.dataset.k;
      const s = objSel(); if (s) { s[k] = b.dataset.col; guardarDib(); } else { N.estilo[k] = b.dataset.col; }
      b.parentNode.querySelectorAll('.nv-pc').forEach((z) => z.classList.toggle('on', z === b));
      construirTopbar(); dibujar();
    });
  };
  const fibPop = (anchor) => {
    const pop = crearPop(anchor, true, 'fibpop'); pop.classList.add('nv-pop-fib');
    const act = (objSel() && objSel().niveles) ? objSel().niveles : (N.estilo.fibNiveles || DIB_FIBS);
    pop.innerHTML = `<div class="nv-pop-t">Niveles Fibonacci</div><div class="nv-pf-grid">` +
      FIB_TODOS.map((f) => `<button class="nv-pf ${act.includes(f) ? 'on' : ''}" data-f="${f}">${(f * 100).toFixed(1).replace(/\.0$/, '')}%</button>`).join('') + '</div>';
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      const f = parseFloat(b.dataset.f);
      const cur = (objSel() && objSel().niveles) ? objSel().niveles.slice() : (N.estilo.fibNiveles ? N.estilo.fibNiveles.slice() : DIB_FIBS.slice());
      const i = cur.indexOf(f); if (i >= 0) cur.splice(i, 1); else cur.push(f);
      cur.sort((a, b2) => a - b2);
      if (objSel()) { objSel().niveles = cur; guardarDib(); } else { N.estilo.fibNiveles = cur; }
      b.classList.toggle('on'); dibujar();
    });
  };
  const flyLineas = (anchor) => {
    const pop = crearPop(anchor, false, 'lineas'); pop.classList.add('nv-pop-fly');
    const items = [['linea', 'Tendencia', 'M4 19L20 5'], ['rayo', 'Horizontal', 'M3 12h18'], ['vert', 'Vertical', 'M12 3v18']];
    pop.innerHTML = items.map((it) => `<button class="nv-fl ${N.herr === it[0] ? 'on' : ''}" data-h="${it[0]}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="${it[2]}"/></svg><span>${it[1]}</span></button>`).join('');
    pop.addEventListener('click', (e) => { const b = e.target.closest('[data-h]'); if (!b) return; const mk = anchor; mk.dataset.h = b.dataset.h; mk.title = b.querySelector('span').textContent; seleccionar(b.dataset.h); cerrarPopups(); });
  };
  const flyCursores = (anchor) => {
    const pop = crearPop(anchor, false, 'cursores'); pop.classList.add('nv-pop-fly');
    const items = [['cruz', 'Cruz', 'M12 4v16M4 12h16'], ['punto', 'Punto', 'M12 12h.01'], ['flecha', 'Flecha', 'M5 3l7 17 2-7 7-2z']];
    pop.innerHTML = items.map((it) => `<button class="nv-fl ${N.cursorTipo === it[0] ? 'on' : ''}" data-c="${it[0]}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${it[2]}"/></svg><span>${it[1]}</span></button>`).join('');
    pop.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; N.cursorTipo = b.dataset.c; seleccionar('cursor'); cerrarPopups(); });
  };

  if (tools) {
    tools.querySelectorAll('.nv-tool[data-h]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.fly === 'lineas') { if (popActual === 'lineas') { cerrarPopups(); return; } flyLineas(b); return; }
      if (b.dataset.fly === 'cursores') { if (popActual === 'cursores') { cerrarPopups(); return; } flyCursores(b); return; }
      seleccionar(b.dataset.h);
    }));
    const bIman = document.getElementById('nv-iman');
    if (bIman) { bIman.classList.toggle('on', !!N.imant); bIman.addEventListener('click', () => { N.imant = !N.imant; bIman.classList.toggle('on', N.imant); }); }
    const bLimp = document.getElementById('nv-limpiar');
    if (bLimp) bLimp.addEventListener('click', () => {
      if (popActual === 'limpiar') { cerrarPopups(); return; }
      const pop = crearPop(bLimp, false, 'limpiar'); pop.classList.add('nv-pop-menu');
      pop.innerHTML =
        `<button class="nv-pm" data-lim="dib"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>Borrar dibujos</button>` +
        `<button class="nv-pm" data-lim="ind"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>Borrar indicadores</button>`;
      pop.addEventListener('click', (e) => {
        const b = e.target.closest('[data-lim]'); if (!b) return;
        if (b.dataset.lim === 'dib') { N.dibujos = []; N.dib = null; N.sel = -1; guardarDib(); }
        else { N.verMarea = false; N.verEstructura = false; const pm = document.querySelectorAll('#nv-herr-panel .nv-ind-row.on'); pm.forEach((r) => { if (r.dataset.h === 'marea' || r.dataset.h === 'estructura') r.classList.remove('on'); }); }
        cerrarPopups(); construirTopbar(); dibujar();
      });
    });
    // Auto-ocultar: la barra sale al acercar el cursor al borde izquierdo
    tools.classList.add('nv-oculta');
    const tab = document.createElement('div'); tab.id = 'nv-tools-tab'; grafEl.appendChild(tab);
    let tHide = null;
    abrirBarra = () => { clearTimeout(tHide); tools.classList.add('abierta'); };
    cerrarBarra = () => { clearTimeout(tHide); tHide = setTimeout(() => tools.classList.remove('abierta'), 300); };
    tools.addEventListener('mouseenter', abrirBarra);
    tools.addEventListener('mouseleave', cerrarBarra);
  }
  if (topbar) {
    topbar.addEventListener('mousedown', (e) => e.stopPropagation());
    topbar.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
      if (b.dataset.gr) return aplicar('grosor', +b.dataset.gr);
      if (b.dataset.tam) return aplicar('tam', +b.dataset.tam);
      if (b.dataset.int) return aplicar('intensidad', +b.dataset.int);
      const a = b.dataset.a;
      if (a === 'colorpop') { if (popActual === 'colorpop') { cerrarPopups(); return; } const s = objSel(); return (s && (s.tipo === 'poslarga' || s.tipo === 'poscorta')) || N.herr === 'poslarga' || N.herr === 'poscorta' ? colorPopPos(b) : colorPop(b); }
      if (a === 'fibpop') { if (popActual === 'fibpop') { cerrarPopups(); return; } return fibPop(b); }
      if (a === 'dash') return aplicar('punteado', !objEstilo().punteado);
      if (a === 'del') {
        if (N.sel >= 0) { N.dibujos.splice(N.sel, 1); N.sel = -1; }
        else { for (let k = N.dibujos.length - 1; k >= 0; k--) if (N.dibujos[k].tipo === N.herr) { N.dibujos.splice(k, 1); break; } }
        guardarDib(); cerrarPopups(); construirTopbar(); dibujar(); return;
      }
      if (a === 'fijar') { N.fijar = !N.fijar; construirTopbar(); }
    });
  }

  const distSeg = (px, py, ax2, ay2, bx, by) => { const dx = bx - ax2, dy = by - ay2, L = dx * dx + dy * dy || 1; let t = ((px - ax2) * dx + (py - ay2) * dy) / L; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (ax2 + t * dx), py - (ay2 + t * dy)); };
  const dibujoEn = (x, y) => {
    const lista = N.dibujos || [];
    for (let k = lista.length - 1; k >= 0; k--) {
      const d = lista[k], A = d.pts[0] ? dibAxy(d.pts[0]) : null, B = d.pts[1] ? dibAxy(d.pts[1]) : null;
      let hit = false;
      if (d.tipo === 'rayo' && A) hit = Math.abs(y - A.y) < 8;
      else if (d.tipo === 'vert' && A) hit = Math.abs(x - A.x) < 8;
      else if ((d.tipo === 'linea' || d.tipo === 'flecha') && A && B) hit = distSeg(x, y, A.x, A.y, B.x, B.y) < 8;
      else if ((d.tipo === 'poslarga' || d.tipo === 'poscorta') && A && B) {
        const pe = d.pts[0].p, pT = d.pTarget != null ? d.pTarget : pe, pS = d.pStop != null ? d.pStop : pe;
        const yy = [A.y, N._geo.Y(pT), N._geo.Y(pS)];
        const x0 = Math.min(A.x, B.x), x1b = Math.max(A.x, B.x), y0 = Math.min.apply(null, yy), y1b = Math.max.apply(null, yy);
        hit = x >= x0 - 8 && x <= x1b + 8 && y >= y0 - 8 && y <= y1b + 8;
      }
      else if ((d.tipo === 'rect' || d.tipo === 'regla' || d.tipo === 'fib') && A && B) { const x0 = Math.min(A.x, B.x), x1b = Math.max(A.x, B.x), y0 = Math.min(A.y, B.y), y1b = Math.max(A.y, B.y); hit = x >= x0 - 8 && x <= x1b + 8 && y >= y0 - 8 && y <= y1b + 8; }
      else if (d.tipo === 'texto' && A) { const w = d._w || 42, fs = d._fs || 13; hit = x >= A.x - 7 && x <= A.x + w && y >= A.y - fs - 3 && y <= A.y + 8; }
      else if (d.tipo === 'marca' && A) hit = Math.hypot(x - A.x, y - A.y) < 14;
      else if (d.tipo === 'brush') hit = d.pts.some((pt, i) => { if (!i) return false; const P = dibAxy(d.pts[i - 1]), Q = dibAxy(pt); return distSeg(x, y, P.x, P.y, Q.x, Q.y) < 8; });
      if (hit) return k;
    }
    return -1;
  };
  const estiloNuevo = (tipo) => {
    const e = { color: N.estilo.color, rgb: N.estilo.rgb || rgbDe(N.estilo.color), grosor: N.estilo.grosor, punteado: N.estilo.punteado, tam: N.estilo.tam };
    if (tipo === 'fib' && N.estilo.fibNiveles) e.niveles = N.estilo.fibNiveles.slice();
    if (tipo === 'marca') { e.color = N.estilo.colorMarca || '#ffd400'; e.rgb = rgbDe(e.color); }   // amarillo intenso por defecto
    if (tipo === 'poslarga' || tipo === 'poscorta') {
      e.cTarget = N.estilo.cTarget || '#2ee86a'; e.cEntry = N.estilo.cEntry || '#eaecef'; e.cStop = N.estilo.cStop || '#ff3b52';
      e.intensidad = N.estilo.intensidad != null ? N.estilo.intensidad : 1;
    }
    if (tipo === 'rect') e.intensidad = N.estilo.intensidad != null ? N.estilo.intensidad : 1;
    return e;
  };
  const finDib = (idx) => {
    // El marcador SIEMPRE se queda activo (pones 1, 2, 3, 4… seguidos; el cesto los quita).
    // El resto: una sola vez por defecto, salvo que "mantener activa" esté encendido.
    if (N.herr !== 'marca' && !N.fijar) { N.herr = 'cursor'; N.sel = idx; marcarBoton(); }
    construirTopbar(); dibujar();
  };
  let inputTexto = null;   // { inp, x, y } mientras se escribe, o null
  const cerrarTexto = (guardar) => {
    if (!inputTexto) return;
    const { inp, x, y } = inputTexto; const v = inp.value.trim(); inputTexto = null; inp.remove();
    if (guardar && v) { N.dibujos.push({ tipo: 'texto', pts: [dibXYa(x, y, false)], txt: v, ...estiloNuevo('texto') }); guardarDib(); }
    if (!N.fijar) { N.herr = 'cursor'; N.sel = (guardar && v) ? N.dibujos.length - 1 : -1; marcarBoton(); }
    construirTopbar(); dibujar();
  };
  const pedirTexto = (x, y) => {
    cerrarTexto(false); cerrarPopups();
    const inp = document.createElement('input'); inp.className = 'nv-txt-in'; inp.placeholder = 'Escribe y pulsa Enter…';
    grafEl.appendChild(inp);
    inp.style.left = Math.max(4, Math.min(grafEl.clientWidth - 200, x)) + 'px';
    inp.style.top = Math.max(4, y - 14) + 'px';
    inputTexto = { inp, x, y };
    setTimeout(() => inp.focus(), 0);
    inp.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') cerrarTexto(true); else if (ev.key === 'Escape') cerrarTexto(false); });
    inp.addEventListener('blur', () => setTimeout(() => cerrarTexto(true), 0));
  };
  const unPunto = (t) => t === 'rayo' || t === 'vert' || t === 'marca';
  const dosPuntos = (t) => t === 'linea' || t === 'rect' || t === 'fib' || t === 'flecha' || t === 'regla' || t === 'poslarga' || t === 'poscorta';
  let dibujando = false, colocando = false;
  const iniciarDib = (x, y) => {
    const t = N.herr;
    if (t === 'cursor' || t === 'borrar') return false;
    if (t === 'texto') { if (inputTexto) { cerrarTexto(true); } else { pedirTexto(x, y); } return true; }
    // La REGLA es clic–mover–clic (no hay que mantener presionado, como en TradingView)
    if (t === 'regla' || t === 'rect') {
      if (!colocando) { const a = dibXYa(x, y, true); N.dib = { tipo: t, pts: [a, { ...a }], ...estiloNuevo(t) }; colocando = true; dibujar(); return true; }
      N.dib.pts[1] = dibXYa(x, y, true); const d = N.dib; N.dib = null; colocando = false;
      N.dibujos.push(d); guardarDib(); finDib(N.dibujos.length - 1); return true;
    }
    if (unPunto(t)) { N.dibujos.push({ tipo: t, pts: [dibXYa(x, y, true)], ...estiloNuevo(t) }); guardarDib(); finDib(N.dibujos.length - 1); return true; }
    if (t === 'brush') { N.dib = { tipo: 'brush', pts: [dibXYa(x, y, false)], ...estiloNuevo(t) }; dibujando = true; return true; }
    if (dosPuntos(t)) { const a = dibXYa(x, y, true); N.dib = { tipo: t, pts: [a, { ...a }], ...estiloNuevo(t) }; dibujando = true; return true; }
    return false;
  };
  const moverDib = (x, y) => { if (!dibujando || !N.dib) return; if (N.dib.tipo === 'brush') N.dib.pts.push(dibXYa(x, y, false)); else N.dib.pts[1] = dibXYa(x, y, true); dibujar(); };
  const soltarDib = () => {
    if (!dibujando || !N.dib) { dibujando = false; return; }
    const d = N.dib; N.dib = null; dibujando = false;
    if (d.tipo === 'brush' && d.pts.length < 2) { construirTopbar(); dibujar(); return; }
    if (d.tipo === 'poslarga' || d.tipo === 'poscorta') {
      const largo = d.tipo === 'poslarga', pe = d.pts[0].p; let pT = d.pts[1].p;
      if (Math.abs((pT - pe) / pe) < 0.0015) pT = pe * (largo ? 1.01 : 0.99);  // proyección de ejemplo
      d.pTarget = pT; d.pStop = pe - (pT - pe) * 0.5;
      const tf = _tfMs();
      let tW = d.pts[1].t; if (Math.abs(tW - d.pts[0].t) < tf * 6) tW = d.pts[0].t + tf * 34;  // ancho mínimo visible
      d.pts[1] = { t: tW, p: pe };
    }
    N.dibujos.push(d); guardarDib(); finDib(N.dibujos.length - 1);
  };

  /* Goma por ÁREA: arrastra un rectángulo y borra lo que quede dentro */
  const bboxDe = (d) => {
    const ps = d.pts.map((pt) => dibAxy(pt)); if (!ps.length) return null;
    let x0 = Infinity, y0 = Infinity, x1b = -Infinity, y1b = -Infinity;
    ps.forEach((P) => { x0 = Math.min(x0, P.x); y0 = Math.min(y0, P.y); x1b = Math.max(x1b, P.x); y1b = Math.max(y1b, P.y); });
    if (d.tipo === 'poslarga' || d.tipo === 'poscorta') {
      if (d.pTarget != null) { const yT = N._geo.Y(d.pTarget); y0 = Math.min(y0, yT); y1b = Math.max(y1b, yT); }
      if (d.pStop != null) { const yS = N._geo.Y(d.pStop); y0 = Math.min(y0, yS); y1b = Math.max(y1b, yS); }
    }
    if (d.tipo === 'rayo') { x0 = -1e5; x1b = 1e5; } if (d.tipo === 'vert') { y0 = -1e5; y1b = 1e5; }
    return { x0, y0, x1: x1b, y1: y1b };
  };
  let goma = null;
  const moverGoma = (x, y) => { if (!goma) return; goma.x1 = x; goma.y1 = y; N.gomaBox = { x0: Math.min(goma.x0, x), y0: Math.min(goma.y0, y), x1: Math.max(goma.x0, x), y1: Math.max(goma.y0, y) }; dibujar(); };
  const soltarGoma = () => {
    if (!goma) return;
    const gb = { x0: Math.min(goma.x0, goma.x1), y0: Math.min(goma.y0, goma.y1), x1: Math.max(goma.x0, goma.x1), y1: Math.max(goma.y0, goma.y1) };
    const chico = Math.abs(gb.x1 - gb.x0) < 6 && Math.abs(gb.y1 - gb.y0) < 6;
    if (chico) { const k = dibujoEn(goma.x0, goma.y0); if (k >= 0) N.dibujos.splice(k, 1); }
    else N.dibujos = N.dibujos.filter((d) => { const bb = bboxDe(d); return !(bb && bb.x0 < gb.x1 && bb.x1 > gb.x0 && bb.y0 < gb.y1 && bb.y1 > gb.y0); });
    goma = null; N.gomaBox = null; guardarDib(); dibujar();
  };

  /* ¿el cursor está sobre una de las 3 líneas de una posición? */
  const posLineaEn = (d, x, y) => {
    const A = dibAxy(d.pts[0]), B = dibAxy(d.pts[1]);
    const xL = Math.min(A.x, B.x) - 6, xR = Math.max(A.x, B.x) + 6;
    if (x < xL || x > xR) return null;
    const pe = d.pts[0].p, pT = d.pTarget != null ? d.pTarget : pe, pS = d.pStop != null ? d.pStop : pe;
    const cand = [['target', N._geo.Y(pT)], ['entry', A.y], ['stop', N._geo.Y(pS)]];
    for (const c of cand) if (Math.abs(y - c[1]) < 7) return c[0];
    return null;
  };
  /* ¿el cursor está sobre el borde izq/der de una posición (redimensionar a lo ancho)? */
  const posBordeEn = (d, x, y) => {
    if (!d._pos) return null;
    const { x: bx, w, yt, ye, ys } = d._pos;
    const yTop = Math.min(yt, ye, ys) - 4, yBot = Math.max(yt, ye, ys) + 4;
    if (y < yTop || y > yBot) return null;
    if (Math.abs(x - bx) < 6) return 'izq';
    if (Math.abs(x - (bx + w)) < 6) return 'der';
    return null;
  };
  /* ¿cerca de un extremo de una regla o rectángulo? (0 o 1, si no -1) */
  const extremoEn = (d, x, y) => {
    for (let i = 0; i < d.pts.length; i++) { const P = dibAxy(d.pts[i]); if (Math.hypot(x - P.x, y - P.y) < 9) return i; }
    return -1;
  };
  const dentro = (x, y, r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  /* ¿el cursor está sobre un elemento interactivo del indicador Marea
     (la cápsula/panel para recoger, o una tachuela de disparo)? */
  const sobreMareaEn = (x, y) => (N.marea && N.verMarea) && (dentro(x, y, N._mareaBtn) || (N._proxBtns && N._proxBtns.some((r) => dentro(x, y, r))));
  /* ¿el cursor está sobre un botón de una posición (minimizar, reabrir, mover la tarjeta)? */
  const sobreBotonPos = (x, y) => (N.dibujos || []).some((d) => (d.tipo === 'poslarga' || d.tipo === 'poscorta') && (dentro(x, y, d._hideBtn) || dentro(x, y, d._miniBtn) || dentro(x, y, d._arrL) || dentro(x, y, d._arrR)));
  const ORDEN_POS = ['der', 'abajo', 'izq', 'arriba'];
  const girarPos = (pos, dir) => { const i = Math.max(0, ORDEN_POS.indexOf(pos || 'der')); return ORDEN_POS[(i + dir + ORDEN_POS.length) % ORDEN_POS.length]; };

  /* Arrastrar un dibujo, una línea/borde de posición, o un extremo de regla/rect */
  let arrDib = -1, arrXY = null, arrLin = null, arrBorde = null, arrPunto = null;
  const iniciarArrastre = (x, y) => {
    // 1) Botones de las tarjetas de posición (hide / flechas / mini para volver a mostrar)
    for (let k = N.dibujos.length - 1; k >= 0; k--) {
      const d = N.dibujos[k]; if (d.tipo !== 'poslarga' && d.tipo !== 'poscorta') continue;
      if (d.oculto && dentro(x, y, d._miniBtn)) { d.oculto = false; guardarDib(); N.sel = k; construirTopbar(); dibujar(); return true; }
      if (!d.oculto && dentro(x, y, d._hideBtn)) { d.oculto = true; guardarDib(); N.sel = k; construirTopbar(); dibujar(); return true; }
      if (!d.oculto && dentro(x, y, d._arrL)) { d.cardPos = girarPos(d.cardPos, -1); guardarDib(); dibujar(); return true; }
      if (!d.oculto && dentro(x, y, d._arrR)) { d.cardPos = girarPos(d.cardPos, 1); guardarDib(); dibujar(); return true; }
    }
    const k = dibujoEn(x, y);
    N.sel = k; construirTopbar();
    if (k >= 0) {
      const d = N.dibujos[k];
      if (d.tipo === 'poslarga' || d.tipo === 'poscorta') {
        const bo = posBordeEn(d, x, y); if (bo) { arrBorde = { idx: k, lado: bo }; cv.style.cursor = 'ew-resize'; dibujar(); return true; }
        const cual = posLineaEn(d, x, y); if (cual) { arrLin = { idx: k, cual }; cv.style.cursor = 'ns-resize'; dibujar(); return true; }
      }
      if (d.tipo === 'regla' || d.tipo === 'rect') {
        const ei = extremoEn(d, x, y); if (ei >= 0) { arrPunto = { idx: k, i: ei }; cv.style.cursor = 'nwse-resize'; dibujar(); return true; }
      }
      arrDib = k; arrXY = { x, y }; cv.style.cursor = 'grabbing'; dibujar(); return true;
    }
    dibujar(); return false;
  };
  const moverArrastre = (x, y) => {
    if (arrLin) {
      const d = N.dibujos[arrLin.idx]; if (!d) return;
      const p = dibXYa(x, y, false).p;
      if (arrLin.cual === 'entry') { d.pts[0].p = p; d.pts[1].p = p; }
      else if (arrLin.cual === 'target') d.pTarget = p; else d.pStop = p;
      dibujar(); return;
    }
    if (arrBorde) {
      const d = N.dibujos[arrBorde.idx]; if (!d) return;
      const t = dibXYa(x, y, false).t;
      // mueve el punto del lado agarrado (el de menor/mayor x)
      const ix = dibAxy(d.pts[0]).x <= dibAxy(d.pts[1]).x ? 0 : 1;   // 0 = izquierda
      const idx = arrBorde.lado === 'izq' ? ix : 1 - ix;
      d.pts[idx] = { t, p: d.pts[idx].p };
      dibujar(); return;
    }
    if (arrPunto) {
      const d = N.dibujos[arrPunto.idx]; if (!d) return;
      d.pts[arrPunto.i] = dibXYa(x, y, true);
      dibujar(); return;
    }
    if (arrDib < 0 || !arrXY || !N.dibujos[arrDib]) return;
    const a = dibXYa(arrXY.x, arrXY.y, false), b = dibXYa(x, y, false);
    const dt = b.t - a.t, dp = b.p - a.p;
    const d = N.dibujos[arrDib];
    d.pts = d.pts.map((pt) => ({ t: pt.t + dt, p: pt.p + dp }));
    if (d.pTarget != null) d.pTarget += dp; if (d.pStop != null) d.pStop += dp;
    arrXY = { x, y }; dibujar();
  };
  const soltarArrastre = () => { if (arrDib >= 0 || arrLin || arrBorde || arrPunto) guardarDib(); arrDib = -1; arrXY = null; arrLin = null; arrBorde = null; arrPunto = null; };
  marcarBoton(); construirTopbar();

  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    if (enEscala(e.clientX - r.left)) zoomY(e.deltaY > 0 ? 1.12 : 0.9);
    else zoomX(e.deltaY > 0 ? 1.15 : 0.87);
  }, { passive: false });

  /* La cruz sigue al cursor (o dibuja/arrastra según el modo) */
  cv.addEventListener('mousemove', (e) => {
    const p = loc(e);
    if (dibujando) { moverDib(p.x, p.y); return; }
    if (colocando && N.dib) { N.dib.pts[1] = dibXYa(p.x, p.y, true); N.cruz = { x: Math.round(p.x), y: Math.round(p.y) }; dibujar(); return; }
    if (goma) { moverGoma(p.x, p.y); return; }
    if (arrDib >= 0 || arrLin || arrBorde || arrPunto) { moverArrastre(p.x, p.y); return; }
    if (arr) return;
    if (p.x < 20) abrirBarra(); else if (p.x > 90) cerrarBarra();
    N.cruz = { x: Math.round(p.x), y: Math.round(p.y) };
    // manito sobre el toggle del panel Marea o sobre una tachuela de disparo (interactivos)
    if (sobreMareaEn(p.x, p.y)) { cv.style.cursor = 'pointer'; dibujar(); return; }
    // cursor: manito sobre un dibujo, editar sobre las líneas de una posición
    if (N.herr === 'cursor' && !enEscala(p.x)) {
      const k = dibujoEn(p.x, p.y); let cur = N.cursorTipo === 'flecha' ? 'default' : (N.cursorTipo === 'punto' ? 'none' : 'crosshair');
      if (k >= 0) {
        const d = N.dibujos[k]; cur = 'grab';
        if (d.tipo === 'poslarga' || d.tipo === 'poscorta') { if (posBordeEn(d, p.x, p.y)) cur = 'ew-resize'; else if (posLineaEn(d, p.x, p.y)) cur = 'ns-resize'; }
        else if ((d.tipo === 'regla' || d.tipo === 'rect') && extremoEn(d, p.x, p.y) >= 0) cur = 'nwse-resize';
      }
      cv.style.cursor = cur;
    } else if (enEscala(p.x)) { cv.style.cursor = 'ns-resize'; }   // sobre la escala: cursor visible, nunca oculto
    dibujar();
  });
  cv.addEventListener('mouseleave', () => { N.cruz = null; cv.style.cursor = 'default'; dibujar(); });
  /* orden.js (menú clic-derecho) tiene su propio mousemove sobre el canvas que
     repone 'crosshair' cuando el cursor está en 'pointer' y no está sobre uno de
     sus marcadores. Como se registra después, pisa la manito de Marea. Este
     handler a nivel window corre DESPUÉS (fase de burbujeo) y la restablece. */
  window.addEventListener('mousemove', (e) => {
    const cvv = $('nv-cv'); if (!cvv) return;
    const p = loc(e);
    if (sobreMareaEn(p.x, p.y) || sobreBotonPos(p.x, p.y) || (N.verEstructura && N._faroBtn && dentro(p.x, p.y, N._faroBtn))) cvv.style.cursor = 'pointer';
  });

  cv.addEventListener('dblclick', () => {
    N.vista.ancho = window.innerWidth < 760 ? 80 : 130;
    N.vista.desde = 0;
    N.vista.zoomY = 1;
    N.vista.offsetY = 0;
    refrescar();
  });

  /* Arrastre: en el gráfico mueve el tiempo, en la escala estira */
  /* [CORREGIDO] Antes solo se movía en el tiempo. Ahora el arrastre
     mueve en AMBOS ejes, como en TradingView: agarras el gráfico y lo
     llevas donde quieras. */
  let ax = 0, ay = 0, arr = false, modo = 'x';
  cv.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;   // el clic derecho es para el menú de operar (orden.js)
    const r = cv.getBoundingClientRect();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    // Colapsar / desplegar el panel de Marea (cápsula)
    // Colapsar / desplegar el panel de Marea (cápsula o tachuela)
    if (N.marea && N.verMarea) {
      const enTog = N._mareaBtn && lx >= N._mareaBtn.x && lx <= N._mareaBtn.x + N._mareaBtn.w && ly >= N._mareaBtn.y && ly <= N._mareaBtn.y + N._mareaBtn.h;
      const enProx = N._proxBtns && N._proxBtns.some((r) => lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h);
      if (enTog || enProx) { N.mareaMin = !N.mareaMin; e.preventDefault(); dibujar(); return; }
    }
    // Clic en la tarjeta de la posición de Faro → la materializa como posición editable
    // Botón del recuadro de Faro: expandir / minimizar la relación riesgo-beneficio
    if (N.verEstructura && N._faroBtn && dentro(lx, ly, N._faroBtn)) {
      N._faroExp = !N._faroExp; e.preventDefault(); dibujar(); return;
    }
    // Herramienta de dibujo activa → dibuja
    if (N.herr !== 'cursor' && N.herr !== 'borrar' && !enEscala(lx)) { if (iniciarDib(lx, ly)) { e.preventDefault(); return; } }
    // Borrador → arrastra un área y borra lo que quede dentro
    if (N.herr === 'borrar' && !enEscala(lx)) { goma = { x0: lx, y0: ly, x1: lx, y1: ly }; N.gomaBox = { x0: lx, y0: ly, x1: lx, y1: ly }; e.preventDefault(); return; }
    // Cursor → si tocas un dibujo, lo seleccionas y arrastras; si no, deseleccionas y haces pan
    if (N.herr === 'cursor' && !enEscala(lx)) { if (iniciarArrastre(lx, ly)) { e.preventDefault(); return; } }
    modo = enEscala(lx) ? 'y' : 'libre';
    arr = true; ax = e.clientX; ay = e.clientY;
    cv.style.cursor = modo === 'y' ? 'ns-resize' : 'grabbing';
  });
  window.addEventListener('mousemove', (e) => {
    if (dibujando) { const p = loc(e); moverDib(p.x, p.y); return; }
    if (goma) { const p = loc(e); moverGoma(p.x, p.y); return; }
    if (arrDib >= 0 || arrLin || arrBorde || arrPunto) { const p = loc(e); moverArrastre(p.x, p.y); return; }
    if (!arr) return;
    if (modo === 'y') {
      // Sobre la escala: estirar o comprimir
      const dy = e.clientY - ay;
      if (Math.abs(dy) > 2) { zoomY(1 + dy * 0.004); ay = e.clientY; }
      return;
    }
    let cambio = false;
    // Horizontal: recorrer el tiempo
    const paso = (cv.clientWidth - 64) / N.vista.ancho;
    const d = Math.round((e.clientX - ax) / Math.max(1, paso));
    if (d !== 0) {
      const tope = Math.max(0, N.velas.length - N.vista.ancho) + Math.floor(N.vista.ancho * 0.6);
      const suelo = -Math.floor(N.vista.ancho * 0.6);   // respiro a ambos lados
      N.vista.desde = Math.max(suelo, Math.min(tope, N.vista.desde + d));
      ax = e.clientX; cambio = true;
    }
    // Vertical: desplazar el rango de precios
    const dy = e.clientY - ay;
    if (Math.abs(dy) > 1) {
      N.vista.offsetY = (N.vista.offsetY || 0) + dy;
      ay = e.clientY; cambio = true;
    }
    if (cambio) refrescar();
  });
  window.addEventListener('mouseup', () => { if (dibujando) { soltarDib(); return; } if (goma) { soltarGoma(); return; } if (arrDib >= 0 || arrLin || arrBorde || arrPunto) { soltarArrastre(); cv.style.cursor = 'grab'; return; } arr = false; cv.style.cursor = N.herr === 'cursor' ? 'crosshair' : 'crosshair'; });

  /* Táctil: un dedo mueve, dos hacen zoom en ambos ejes */
  let d0 = 0, dy0 = 0, tx = 0;
  cv.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const p = loc(e, e.touches[0]);
      if (N.herr !== 'cursor' && N.herr !== 'borrar' && !enEscala(p.x)) { if (iniciarDib(p.x, p.y)) { arr = false; return; } }
      if (N.herr === 'borrar' && !enEscala(p.x)) { const k = dibujoEn(p.x, p.y); if (k >= 0) { N.dibujos.splice(k, 1); guardarDib(); dibujar(); } arr = false; return; }
      if (N.herr === 'cursor' && !enEscala(p.x)) { if (iniciarArrastre(p.x, p.y)) { arr = false; return; } }
      tx = e.touches[0].clientX; arr = true; modo = 'x';
    } else if (e.touches.length === 2) {
      arr = false; dibujando = false; N.dib = null; soltarArrastre();
      d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      dy0 = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    if (dibujando && e.touches.length === 1) { e.preventDefault(); const p = loc(e, e.touches[0]); moverDib(p.x, p.y); return; }
    if ((arrDib >= 0 || arrLin || arrBorde || arrPunto) && e.touches.length === 1) { e.preventDefault(); const p = loc(e, e.touches[0]); moverArrastre(p.x, p.y); return; }
    if (e.touches.length === 1 && arr) {
      e.preventDefault();
      const paso = (cv.clientWidth - 64) / N.vista.ancho;
      const d = Math.round((e.touches[0].clientX - tx) / Math.max(1, paso));
      if (d !== 0) {
        const tope = Math.max(0, N.velas.length - N.vista.ancho) + Math.floor(N.vista.ancho * 0.6);
        const suelo = -Math.floor(N.vista.ancho * 0.6);
        N.vista.desde = Math.max(suelo, Math.min(tope, N.vista.desde + d));
        tx = e.touches[0].clientX; refrescar();
      }
    } else if (e.touches.length === 2 && d0 > 0) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const dy = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
      // Si el pellizco es más vertical que horizontal, estira la escala
      if (dy > dy0 * 1.3 || dy0 > dy * 1.3) { zoomY(dy0 / Math.max(1, dy)); dy0 = dy; }
      else if (Math.abs(d - d0) > 8) { zoomX(d0 / d); }
      d0 = d;
    }
  }, { passive: false });
  cv.addEventListener('touchend', () => { if (dibujando) { soltarDib(); } if (arrDib >= 0 || arrLin || arrBorde || arrPunto) { soltarArrastre(); } arr = false; d0 = 0; });
  cv.style.cursor = 'crosshair';
}
