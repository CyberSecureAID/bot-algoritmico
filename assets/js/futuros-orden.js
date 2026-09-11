/* ══════════════════════════════════════════════════════════════════════
   futuros-orden.js — Clic derecho para operar en Futuros (pieza 2)
   ══════════════════════════════════════════════════════════════════════
   Espejo del sistema spot (orden.js), adaptado a futuros. NO toca orden.js.

   Diferencias con spot:
   · Long / Short (no comprar / vender).
   · Muestra la DISTANCIA % al precio actual (dónde entras), no "ganancia".
   · Un selector de APALANCAMIENTO dentro de la ficha; el % de movimiento
     necesario para tu objetivo/liquidación se recalcula con el apalancamiento.
   · Precio de liquidación estimado (se liquida al perder ~75% del margen).

   Se conecta a la gráfica limpia (pieza 1) mediante su cfg:
     conectarFuturos(grafica.cfg)

   Fase actual: interfaz. No ejecuta on-chain (no hay contrato de futuros aún):
   "Open position" muestra "coming soon". La posición SÍ se dibuja en la
   gráfica para que el usuario vea dónde entró, igual que en spot.
*/

const T = (s) => s;   // se traduce por idioma.js sobre el DOM
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (p) => {
  if (!p) return '0';
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toPrecision(4);
};

let _posiciones = [];     // posiciones dibujadas: {precio, lado, lev, id}
let _cfg = null;
let _cssPuesto = false;

function estilos() {
  if (_cssPuesto) return;
  _cssPuesto = true;
  const css = `
  .fo-menu,.fo-ficha{position:fixed;z-index:10050;font-family:'Plus Jakarta Sans',sans-serif;
    background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid #2b3139;border-radius:14px;
    box-shadow:0 24px 60px rgba(0,0,0,.6);color:#e9edf5;overflow:hidden}
  .fo-menu{width:230px}
  .fo-menu.long{border-color:rgba(34,197,94,.4)} .fo-menu.short{border-color:rgba(246,70,93,.4)}
  .fo-m-cab{display:flex;align-items:center;gap:10px;padding:13px 14px}
  .fo-m-ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-weight:800;font-size:14px}
  .fo-menu.long .fo-m-ic{background:rgba(34,197,94,.15);color:#22c55e}
  .fo-menu.short .fo-m-ic{background:rgba(246,70,93,.15);color:#f6465d}
  .fo-m-tx b{display:block;font-weight:800;font-size:14px} .fo-m-tx span{font-family:'IBM Plex Mono';font-size:12px;color:#a9b2bd}
  .fo-m-pct{margin-left:auto;text-align:right}
  .fo-m-pct b{display:block;font-family:'IBM Plex Mono';font-weight:700;font-size:15px;color:var(--gold,#E8B84B)}
  .fo-m-pct span{font-family:'IBM Plex Mono';font-size:9px;color:#7d8794;text-transform:uppercase;letter-spacing:.05em}
  .fo-m-b{width:100%;border:none;padding:12px;font-weight:800;font-size:13px;cursor:pointer;color:#0b0e12}
  .fo-menu.long .fo-m-b{background:linear-gradient(180deg,#2fd67d,#16a34a)}
  .fo-menu.short .fo-m-b{background:linear-gradient(180deg,#fb5c6f,#e11d48);color:#fff}

  .fo-ficha{width:300px;padding:16px;max-height:90vh;overflow-y:auto}
  .fo-x{position:absolute;top:11px;right:11px;width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.05);
    border:1px solid #2b3139;color:#7d8794;cursor:pointer}
  .fo-cab{display:flex;align-items:center;gap:11px;margin-bottom:14px}
  .fo-cab .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-weight:800}
  .fo-ficha.long .ic{background:rgba(34,197,94,.15);color:#22c55e} .fo-ficha.short .ic{background:rgba(246,70,93,.15);color:#f6465d}
  .fo-cab b{display:block;font-weight:800;font-size:15px} .fo-cab span{font-family:'IBM Plex Mono';font-size:12px;color:#a9b2bd}
  .fo-cab .pct{margin-left:auto;text-align:right}
  .fo-cab .pct b{font-family:'IBM Plex Mono';font-size:16px;color:var(--gold,#E8B84B)}
  .fo-cab .pct span{display:block;font-family:'IBM Plex Mono';font-size:9px;color:#7d8794;text-transform:uppercase}

  .fo-campo{margin-bottom:13px}
  .fo-campo label{display:block;font-family:'IBM Plex Mono';font-size:10.5px;color:#7d8794;
    text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px}
  .fo-inp-fila{display:flex;align-items:center;background:rgba(10,14,19,.6);border:1px solid #2b3139;border-radius:11px;padding:9px 12px}
  .fo-inp{flex:1;min-width:0;background:transparent;border:none;outline:none;color:#e9edf5;font-family:'Plus Jakarta Sans';font-weight:700;font-size:17px}
  .fo-inp::placeholder{color:#4a5561}
  .fo-unidad{font-family:'Plus Jakarta Sans';font-weight:700;font-size:13px;color:#a9b2bd}

  /* Apalancamiento dentro de la ficha. */
  .fo-lev-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}
  .fo-lev-val{font-family:'Plus Jakarta Sans';font-weight:800;font-size:17px;color:var(--gold,#E8B84B)}
  .fo-lev-range{width:100%;accent-color:var(--gold,#E8B84B);cursor:pointer}
  .fo-lev-quick{display:flex;gap:5px;margin-top:7px}
  .fo-lev-quick button{flex:1;background:rgba(10,14,19,.6);border:1px solid #2b3139;border-radius:8px;
    color:#a9b2bd;font-family:'IBM Plex Mono';font-size:11px;font-weight:700;padding:5px 0;cursor:pointer}
  .fo-lev-quick button.on{color:#241900;background:var(--gold,#E8B84B);border-color:#c79426}

  .fo-liq{background:rgba(246,70,93,.08);border:1px solid rgba(246,70,93,.25);border-radius:11px;padding:10px 12px;margin-bottom:13px}
  .fo-liq .r{display:flex;justify-content:space-between;font-family:'IBM Plex Mono';font-size:12px}
  .fo-liq .r span{color:#7d8794} .fo-liq .r b{color:#f6465d}

  .fo-ok{width:100%;height:48px;border:none;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;color:#0b0e12}
  .fo-ficha.long .fo-ok{background:linear-gradient(180deg,#2fd67d,#16a34a)}
  .fo-ficha.short .fo-ok{background:linear-gradient(180deg,#fb5c6f,#e11d48);color:#fff}
  .fo-aviso{font-family:'IBM Plex Mono';font-size:9.5px;line-height:1.55;color:#7d8794;margin-top:10px}
  `;
  const st = document.createElement('style');
  st.id = 'fo-css';
  st.textContent = css;
  document.head.appendChild(st);
}

function cerrarTodo() {
  document.querySelectorAll('.fo-menu,.fo-ficha').forEach((e) => e.remove());
}

function colocar(d, cx, cy) {
  const r = d.getBoundingClientRect();
  let x = cx + 8, y = cy + 8;
  if (x + r.width > window.innerWidth - 8) x = cx - r.width - 8;
  if (y + r.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - r.height - 8);
  d.style.left = Math.max(8, x) + 'px';
  d.style.top = Math.max(8, y) + 'px';
}

/* Liquidación estimada: se liquida al perder ~75% del margen. */
function liqDe(entrada, lev, esLong) {
  const f = 0.75;
  return esLong ? entrada * (1 - f / lev) : entrada * (1 + f / lev);
}

function abrirMenu(cx, cy, cfg) {
  cerrarTodo();
  const cv = cfg.canvas;
  const r = cv.getBoundingClientRect();
  const precio = cfg.precioEn(cy - r.top);
  const actual = cfg.precioActual();
  if (!(precio > 0) || !(actual > 0)) return;

  // Encima del precio = short (esperas que baje). Debajo = long.
  const esLong = precio < actual;
  const dist = ((precio - actual) / actual) * 100;

  const d = document.createElement('div');
  d.className = 'fo-menu ' + (esLong ? 'long' : 'short');
  d.innerHTML = `
    <div class="fo-m-cab">
      <span class="fo-m-ic">${esLong ? '▲' : '▼'}</span>
      <div class="fo-m-tx">
        <b>${esLong ? 'Long / Comprar' : 'Short / Vender'}</b>
        <span>${fmt(precio)}</span>
      </div>
      <div class="fo-m-pct">
        <b>${dist >= 0 ? '+' : ''}${dist.toFixed(2)}%</b>
        <span>Distancia</span>
      </div>
    </div>
    <button class="fo-m-b" type="button">${esLong ? 'Abrir Long aquí' : 'Abrir Short aquí'}</button>`;
  document.body.appendChild(d);
  colocar(d, cx, cy);
  d.addEventListener('click', (e) => e.stopPropagation());
  d.querySelector('.fo-m-b').onclick = (e) => { e.stopPropagation(); d.remove(); abrirFicha(cx, cy, cfg, precio, esLong); };
  setTimeout(() => document.addEventListener('click', cerrarTodo, { once: true }), 10);
}

function abrirFicha(cx, cy, cfg, precio, esLong) {
  cerrarTodo();
  const par = cfg.par ? cfg.par() : '';
  const actual = cfg.precioActual();
  const dist = ((precio - actual) / actual) * 100;
  let lev = 10;

  const d = document.createElement('div');
  d.className = 'fo-ficha ' + (esLong ? 'long' : 'short');
  d.innerHTML = `
    <button class="fo-x" type="button" aria-label="Cerrar">✕</button>
    <div class="fo-cab">
      <span class="ic">${esLong ? '▲' : '▼'}</span>
      <div>
        <b>${esLong ? 'Abrir Long' : 'Abrir Short'}</b>
        <span>${esc(par)} · ${fmt(precio)}</span>
      </div>
      <div class="pct"><b>${dist >= 0 ? '+' : ''}${dist.toFixed(2)}%</b><span>Distancia</span></div>
    </div>

    <div class="fo-campo">
      <label>Margen (lo que arriesgas)</label>
      <div class="fo-inp-fila">
        <input class="fo-inp" id="fo-margen" type="text" inputmode="decimal" placeholder="0.00">
        <span class="fo-unidad">USDT</span>
      </div>
    </div>

    <div class="fo-campo">
      <div class="fo-lev-top">
        <label style="margin:0">Apalancamiento</label>
        <span class="fo-lev-val" id="fo-lev">10×</span>
      </div>
      <input type="range" class="fo-lev-range" id="fo-range" min="1" max="100" value="10" step="1">
      <div class="fo-lev-quick">
        ${[2, 5, 10, 25, 50, 100].map((x) => `<button type="button" data-lev="${x}"${x === 10 ? ' class="on"' : ''}>${x}×</button>`).join('')}
      </div>
    </div>

    <div class="fo-liq">
      <div class="r"><span>Precio de liquidación</span><b id="fo-liq">—</b></div>
      <div class="r" style="margin-top:5px"><span>Tamaño de posición</span><b id="fo-size" style="color:#e9edf5">—</b></div>
    </div>

    <button class="fo-ok" id="fo-ok" type="button">${esLong ? 'Abrir Long' : 'Abrir Short'}</button>
    <div class="fo-aviso">El apalancamiento multiplica ganancias y pérdidas. Una variación pequeña del precio en tu contra puede liquidar toda tu posición. El precio de liquidación es una estimación. Opera solo con lo que puedas permitirte perder. Esto no es consejo financiero.</div>`;
  document.body.appendChild(d);
  colocar(d, cx, cy);
  d.addEventListener('click', (e) => e.stopPropagation());

  const $ = (id) => d.querySelector('#' + id);
  function refrescar() {
    $('fo-lev').textContent = lev + '×';
    const margen = parseFloat(($('fo-margen').value || '').replace(/,/g, '')) || 0;
    const size = margen * lev;
    $('fo-size').textContent = size ? fmt(size) + ' USDT' : '—';
    const liq = liqDe(precio, lev, esLong);
    $('fo-liq').textContent = '$' + fmt(liq);
  }
  $('fo-range').oninput = (e) => {
    lev = +e.target.value;
    d.querySelectorAll('.fo-lev-quick button').forEach((b) => b.classList.toggle('on', +b.dataset.lev === lev));
    refrescar();
  };
  d.querySelectorAll('.fo-lev-quick button').forEach((b) => {
    b.onclick = () => { lev = +b.dataset.lev; $('fo-range').value = lev;
      d.querySelectorAll('.fo-lev-quick button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); refrescar(); };
  });
  $('fo-margen').oninput = refrescar;
  d.querySelector('.fo-x').onclick = cerrarTodo;

  // Abrir: sin contrato aún -> dibuja la posición en la gráfica y avisa.
  $('fo-ok').onclick = () => {
    const margen = parseFloat(($('fo-margen').value || '').replace(/,/g, '')) || 0;
    if (!margen) { $('fo-margen').focus(); return; }
    _posiciones.push({ precio, lado: esLong ? 'long' : 'short', lev, margen, id: Date.now() });
    if (cfg.repintar) cfg.repintar();
    const ok = $('fo-ok');
    ok.textContent = 'Muy pronto — en desarrollo';
    setTimeout(() => cerrarTodo(), 1400);
  };

  refrescar();
}

/* Dibuja las posiciones sobre la gráfica (lo llama la gráfica en cada frame). */
export function pintarPosiciones({ ctx, areaW, escY }) {
  _posiciones.forEach((p) => {
    const y = escY(p.precio);
    const col = p.lado === 'long' ? '#22c55e' : '#f6465d';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(areaW, y); ctx.stroke();
    ctx.setLineDash([]);
    // etiqueta
    const txt = (p.lado === 'long' ? 'LONG' : 'SHORT') + ' ' + p.lev + '×';
    ctx.font = 'bold 10px "IBM Plex Mono", monospace';
    const w = ctx.measureText(txt).width + 12;
    ctx.fillStyle = col;
    ctx.fillRect(2, y - 9, w, 18);
    ctx.fillStyle = '#0b0e12';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, 8, y);
  });
}

export function conectarFuturos(cfg) {
  if (!cfg || !cfg.canvas) return;
  _cfg = cfg;
  estilos();
  const cv = cfg.canvas;
  if (cv.dataset.foLista) return;
  cv.dataset.foLista = '1';

  cv.addEventListener('contextmenu', (e) => { e.preventDefault(); abrirMenu(e.clientX, e.clientY, cfg); });

  // Móvil: pulsación larga.
  let temp = null, x0 = 0, y0 = 0, mov = false;
  cv.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { clearTimeout(temp); return; }
    const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; mov = false;
    clearTimeout(temp);
    temp = setTimeout(() => { if (!mov) { try { navigator.vibrate && navigator.vibrate(18); } catch (_) {} abrirMenu(x0, y0, cfg); } }, 500);
  }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    const t = e.touches[0]; if (t && (Math.abs(t.clientX - x0) > 9 || Math.abs(t.clientY - y0) > 9)) { mov = true; clearTimeout(temp); }
  }, { passive: true });
  cv.addEventListener('touchend', () => clearTimeout(temp), { passive: true });
}

export function posiciones() { return _posiciones.slice(); }
