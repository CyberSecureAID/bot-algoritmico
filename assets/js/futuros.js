/* ══════════════════════════════════════════════════════════════════════
   futuros.js — Panel de operaciones de Futuros (columna derecha)
   ══════════════════════════════════════════════════════════════════════
   Opción A: el gráfico es el de Smart Levels (abrirNiveles), montado tal
   cual sin tocarlo. Este módulo SOLO añade el panel de trading a la derecha.

   Fase 3: interfaz. No hay contrato aún, así que "Open position" muestra
   "coming soon". El precio de liquidación se calcula en el front para que el
   usuario vea la mecánica, pero no se ejecuta nada on-chain todavía.

   Texto en español (base) traducido por idioma.js. Inglés por defecto.
*/

let _cssPuesto = false;

function estilos() {
  if (_cssPuesto) return;
  _cssPuesto = true;
  const css = `
  /* El gráfico de Smart Levels se encoge a la izquierda; el panel va a la
     derecha. Se ajusta el overlay de niveles SOLO dentro de futuros.html. */
  body.fut #nv-overlay{right:340px !important}
  body.fut #nv-overlay .nv-c{max-width:none !important;width:100% !important;height:100% !important;border-radius:0 !important}

  #fut-panel{
    position:fixed;top:0;right:0;bottom:0;width:340px;z-index:10001;
    background:linear-gradient(180deg,rgba(16,20,26,.96),rgba(10,14,19,.98));
    border-left:1px solid #232b36;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
    display:flex;flex-direction:column;overflow-y:auto;
    font-family:var(--display,'Plus Jakarta Sans',sans-serif);
    --gold:#E8B84B;--up:#22c55e;--down:#f6465d;--ink3:#7d8794;--ink4:#4a5561;--line:#232b36;--mono:'IBM Plex Mono',monospace;
  }
  #fut-panel .fp-in{padding:16px 15px 26px;display:flex;flex-direction:column;gap:13px}

  /* Long / Short. */
  #fut-panel .fp-ls{display:flex;gap:8px}
  #fut-panel .fp-ls button{flex:1;height:42px;border-radius:11px;border:1px solid var(--line);
    background:rgba(10,14,19,.6);color:#a9b2bd;font-weight:800;font-size:14px;cursor:pointer;transition:all .13s}
  #fut-panel .fp-ls button.on.long{background:linear-gradient(180deg,#2fd67d,#16a34a);border-color:#15803d;color:#052e13;box-shadow:0 3px 0 #0f5c30}
  #fut-panel .fp-ls button.on.short{background:linear-gradient(180deg,#fb5c6f,#e11d48);border-color:#be123c;color:#3d0511;box-shadow:0 3px 0 #8f0f2e}

  #fut-panel .fp-lbl{font-family:var(--mono);font-size:10.5px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em}
  #fut-panel .fp-row{display:flex;justify-content:space-between;align-items:center;font-size:12px}
  #fut-panel .fp-row span{color:var(--ink3);font-family:var(--mono)}
  #fut-panel .fp-row b{color:#e9edf5;font-family:var(--mono);font-weight:600}

  /* Caja input. */
  #fut-panel .fp-box{background:rgba(10,14,19,.6);border:1px solid var(--line);border-radius:12px;padding:11px 13px}
  #fut-panel .fp-box input{width:100%;background:transparent;border:none;outline:none;color:#e9edf5;
    font-family:var(--display);font-weight:700;font-size:20px}
  #fut-panel .fp-box input::placeholder{color:var(--ink4)}

  /* Apalancamiento. */
  #fut-panel .fp-lev-val{font-family:var(--display);font-weight:800;font-size:18px;color:var(--gold)}
  #fut-panel input[type=range]{width:100%;accent-color:var(--gold);cursor:pointer}
  #fut-panel .fp-lev-marks{display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;color:var(--ink4);margin-top:2px}

  /* Liquidación. */
  #fut-panel .fp-liq{background:rgba(246,70,93,.08);border:1px solid rgba(246,70,93,.25);border-radius:12px;padding:11px 13px}
  #fut-panel .fp-liq .v{color:var(--down);font-family:var(--mono);font-weight:700;font-size:15px}

  #fut-panel .fp-go{height:50px;border-radius:12px;border:none;font-weight:800;font-size:15px;cursor:pointer;
    color:#052e13;background:linear-gradient(180deg,#2fd67d,#16a34a);box-shadow:0 4px 0 #0f5c30;transition:filter .15s,transform .09s}
  #fut-panel .fp-go.short{color:#3d0511;background:linear-gradient(180deg,#fb5c6f,#e11d48);box-shadow:0 4px 0 #8f0f2e}
  #fut-panel .fp-go:hover{filter:brightness(1.06)}
  #fut-panel .fp-go:active{transform:translateY(3px);box-shadow:0 1px 0 #0f5c30}

  #fut-panel .fp-disc{font-family:var(--mono);font-size:9.5px;line-height:1.6;color:var(--ink4);
    padding:10px 12px;background:rgba(10,14,19,.4);border:1px solid var(--line);border-radius:10px}

  /* Posiciones abiertas (vacío por ahora). */
  #fut-panel .fp-pos{margin-top:4px;border-top:1px solid var(--line);padding-top:12px}
  #fut-panel .fp-pos-empty{font-family:var(--mono);font-size:11px;color:var(--ink4);text-align:center;padding:10px}

  @media(max-width:920px){
    body.fut #nv-overlay{right:0 !important;bottom:auto !important;height:55vh !important}
    #fut-panel{top:55vh;width:100%;border-left:none;border-top:1px solid #232b36}
  }
  `;
  const st = document.createElement('style');
  st.id = 'fut-css';
  st.textContent = css;
  document.head.appendChild(st);
}

/* Estimación del precio de liquidación (didáctica). Con aislado:
   long  → liq ≈ entrada · (1 − 1/lev · f)
   short → liq ≈ entrada · (1 + 1/lev · f)
   f ≈ 0.75 (se liquida al perder ~75% del margen, como pidió el owner). */
function calcLiq(entrada, lev, esLong) {
  if (!entrada || !lev) return 0;
  const f = 0.75;
  return esLong ? entrada * (1 - (f / lev)) : entrada * (1 + (f / lev));
}

export function montarFuturos() {
  estilos();
  document.body.classList.add('fut');

  const prev = document.getElementById('fut-panel');
  if (prev) prev.remove();

  let lado = 'long';    // long | short
  let lev = 10;
  let precio = 0;       // precio actual (se lee del gráfico si está disponible)

  const p = document.createElement('div');
  p.id = 'fut-panel';
  p.innerHTML = `
    <div class="fp-in">
      <div class="fp-ls">
        <button class="long on" data-lado="long">Long / Comprar</button>
        <button class="short" data-lado="short">Short / Vender</button>
      </div>

      <div>
        <div class="fp-lbl" style="margin-bottom:6px">Margen (lo que arriesgas)</div>
        <div class="fp-box"><input id="fp-margen" type="text" inputmode="decimal" placeholder="0.00 USDT"></div>
      </div>

      <div>
        <div class="fp-row" style="margin-bottom:6px">
          <span class="fp-lbl">Apalancamiento</span>
          <span class="fp-lev-val" id="fp-lev">10×</span>
        </div>
        <input type="range" id="fp-range" min="1" max="100" value="10" step="1">
        <div class="fp-lev-marks"><span>1×</span><span>25×</span><span>50×</span><span>75×</span><span>100×</span></div>
      </div>

      <div class="fp-row"><span>Tamaño de la posición</span><b id="fp-size">—</b></div>

      <div class="fp-liq">
        <div class="fp-row"><span class="fp-lbl">Precio de liquidación estimado</span></div>
        <div class="v" id="fp-liq">—</div>
      </div>

      <button class="fp-go" id="fp-go">Abrir Long</button>

      <div class="fp-disc">
        Operar con apalancamiento es de altísimo riesgo. Una pequeña variación del precio en tu contra puede liquidar toda tu posición. El precio de liquidación mostrado es una estimación. Opera solo con dinero que puedas permitirte perder. Esto no es consejo financiero.
      </div>

      <div class="fp-pos">
        <div class="fp-lbl">Tus posiciones</div>
        <div class="fp-pos-empty">No tienes posiciones abiertas.</div>
      </div>
    </div>`;
  document.body.appendChild(p);

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';

  function refrescar() {
    // Precio actual: intenta leerlo del estado de Smart Levels si existe.
    try { if (window.N && window.N.velas && window.N.velas.length) precio = window.N.velas[window.N.velas.length - 1].c; } catch (_) {}
    const margen = parseFloat(($('fp-margen').value || '').replace(/,/g, '')) || 0;
    const size = margen * lev;
    $('fp-size').textContent = size ? fmt(size) + ' USDT' : '—';
    const liq = calcLiq(precio, lev, lado === 'long');
    $('fp-liq').textContent = (precio && liq) ? '$' + fmt(liq) : 'Introduce un margen';
  }

  // Long / Short.
  p.querySelectorAll('.fp-ls button').forEach((b) => {
    b.onclick = () => {
      lado = b.dataset.lado;
      p.querySelectorAll('.fp-ls button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      const go = $('fp-go');
      go.classList.toggle('short', lado === 'short');
      go.textContent = lado === 'long' ? 'Abrir Long' : 'Abrir Short';
      refrescar();
    };
  });

  // Apalancamiento.
  $('fp-range').oninput = (e) => { lev = +e.target.value; $('fp-lev').textContent = lev + '×'; refrescar(); };
  $('fp-margen').oninput = refrescar;

  // Botón: sin acción real (no hay contrato).
  $('fp-go').onclick = () => {
    const go = $('fp-go');
    const t = go.textContent;
    go.textContent = 'Muy pronto — en desarrollo';
    setTimeout(() => { go.textContent = t; }, 2200);
  };

  // Refrescar el precio periódicamente desde el gráfico.
  refrescar();
  setInterval(refrescar, 2000);
}
