/* ══════════════════════════════════════════════════════════════════════
   futuros-tools.js — Barra de herramientas de análisis para la gráfica
   ══════════════════════════════════════════════════════════════════════
   Herramientas ligeras que dibujan sobre la gráfica de Futures usando su
   contrato (cfg.precioEn, cfg.canvas) y el hook alDibujar. NO toca Smart
   Levels ni su estado: es independiente.

   Herramientas:
     · Cursor (mover/operar normal).
     · Línea horizontal (marca un precio).
     · Línea de tendencia (dos puntos).
     · Borrar la última / Limpiar todo.

   Uso:
     conectarTools(grafica);   // grafica = objeto de crearGrafica()
*/

let _css = false;
let _dibujos = [];        // {tipo, ...} en coordenadas de PRECIO/índice
let _modo = 'cursor';     // cursor | hline | trend
let _pend = null;         // punto pendiente para la tendencia
let _g = null;

function estilos() {
  if (_css) return; _css = true;
  const css = `
  .fx-tools{position:absolute;top:60px;left:8px;z-index:30;display:flex;flex-direction:column;gap:5px;
    background:rgba(14,18,24,.9);border:1px solid #232b36;border-radius:12px;padding:5px;
    backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .fx-tool{width:36px;height:36px;border-radius:9px;border:1px solid transparent;background:none;color:#a9b2bd;
    display:grid;place-items:center;cursor:pointer;transition:all .12s}
  .fx-tool:hover{background:rgba(255,255,255,.05);color:#eef1f6}
  .fx-tool.on{background:rgba(232,184,75,.14);border-color:rgba(232,184,75,.4);color:#E8B84B}
  .fx-tool svg{width:19px;height:19px}
  .fx-tool.sep{height:1px;padding:0;margin:2px 4px;background:#232b36;pointer-events:none;border-radius:0}
  `;
  const st = document.createElement('style'); st.id = 'fx-tools-css'; st.textContent = css;
  document.head.appendChild(st);
}

/* Dibuja los trazos guardados sobre la gráfica (lo llama alDibujar). */
function pintar({ ctx, areaW, escY }) {
  _dibujos.forEach((d) => {
    ctx.strokeStyle = d.color || '#E8B84B';
    ctx.lineWidth = 1.4;
    if (d.tipo === 'hline') {
      const y = escY(d.precio);
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(areaW, y); ctx.stroke();
      // etiqueta con el precio
      const t = d.precio >= 1000 ? d.precio.toLocaleString('en-US', { maximumFractionDigits: 1 }) : d.precio.toPrecision(6);
      ctx.font = '10px "IBM Plex Mono", monospace';
      const w = ctx.measureText(t).width + 12;
      ctx.fillStyle = 'rgba(232,184,75,.9)';
      ctx.fillRect(areaW - w, y - 9, w, 18);
      ctx.fillStyle = '#241900'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(t, areaW - w + 6, y);
    } else if (d.tipo === 'trend') {
      const y1 = escY(d.p1), y2 = escY(d.p2);
      const x1 = d.x1 * areaW, x2 = d.x2 * areaW;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      // puntos
      ctx.fillStyle = d.color || '#E8B84B';
      [[x1, y1], [x2, y2]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill(); });
    }
  });
}

export function conectarTools(grafica) {
  if (!grafica || !grafica.cfg) return;
  _g = grafica;
  estilos();
  const cv = grafica.cfg.canvas;
  const cont = cv.parentElement;
  if (!cont || cont.querySelector('.fx-tools')) return;

  // Barra de herramientas.
  const bar = document.createElement('div');
  bar.className = 'fx-tools';
  bar.innerHTML = `
    <button class="fx-tool on" data-t="cursor" title="Cursor">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3l14 8-6 1.5L9.5 19 5 3z"/></svg></button>
    <button class="fx-tool" data-t="hline" title="Línea horizontal">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h18"/><circle cx="8" cy="12" r="1.6" fill="currentColor"/></svg></button>
    <button class="fx-tool" data-t="trend" title="Línea de tendencia">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 18L20 6"/><circle cx="4" cy="18" r="1.8" fill="currentColor"/><circle cx="20" cy="6" r="1.8" fill="currentColor"/></svg></button>
    <div class="fx-tool sep"></div>
    <button class="fx-tool" data-t="undo" title="Borrar el último">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/></svg></button>
    <button class="fx-tool" data-t="clear" title="Limpiar todo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button>`;
  cont.appendChild(bar);

  // Dibujar los trazos encima (encadenado con lo que ya dibuje la gráfica).
  const prev = grafica._alDibujarExterno;
  grafica.alDibujar((api) => { if (prev) prev(api); pintar(api); });
  grafica._alDibujarExterno = pintar;

  function setModo(m) {
    _modo = m; _pend = null;
    bar.querySelectorAll('.fx-tool[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === m));
    cv.style.cursor = (m === 'cursor') ? 'crosshair' : 'copy';
  }

  bar.querySelectorAll('.fx-tool[data-t]').forEach((b) => b.onclick = () => {
    const t = b.dataset.t;
    if (t === 'undo') { _dibujos.pop(); grafica.cfg.repintar(); return; }
    if (t === 'clear') { _dibujos = []; grafica.cfg.repintar(); return; }
    setModo(t);
  });

  // Clic en la gráfica según el modo activo.
  cv.addEventListener('click', (e) => {
    if (_modo === 'cursor') return;
    const r = cv.getBoundingClientRect();
    const y = e.clientY - r.top;
    const areaW = cv.width / (window.devicePixelRatio || 1) - 66;
    const xRel = (e.clientX - r.left) / areaW;
    const precio = grafica.cfg.precioEn(y);
    if (_modo === 'hline') {
      _dibujos.push({ tipo: 'hline', precio, color: '#E8B84B' });
      grafica.cfg.repintar();
      setModo('cursor');
    } else if (_modo === 'trend') {
      if (!_pend) { _pend = { p: precio, x: xRel }; }
      else {
        _dibujos.push({ tipo: 'trend', p1: _pend.p, x1: _pend.x, p2: precio, x2: xRel, color: '#5a8cff' });
        _pend = null; grafica.cfg.repintar(); setModo('cursor');
      }
    }
  });
}
