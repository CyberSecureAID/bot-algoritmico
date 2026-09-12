/* ══════════════════════════════════════════════════════════════════════
   futuros-movil.js — Futuros MÓVIL, clonando el formulario de Spot móvil
   ══════════════════════════════════════════════════════════════════════
   Reutiliza EXACTAMENTE la estructura y los estilos de Spot móvil (operar.js
   + estilos.js: clases op-*), para que se vea idéntico a un exchange en el
   teléfono. Añade lo propio de futuros:
     · Long / Short (en vez de Comprar/Vender).
     · Margen + Apalancamiento (slider hasta 200×).
     · Aislado / Cruzado.
     · Precio de liquidación estimado.
   Sin bots (los bots solo van en Spot), sin la gráfica web reducida.

   Fase actual: interfaz. El botón muestra "coming soon". Texto en español,
   traducido por idioma.js.
*/

let _pares = [];
let _par = null;
let _quote = 'USDT';
let _tipo = 'market';   // market | limit
let _lado = 'long';     // long | short
let _lev = 10;
let _modo = 'aislado';  // aislado | cruzado
let _precio = 0;
let _cssPuesto = false;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (p) => !p ? '—' : (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 1 }) : p >= 1 ? p.toFixed(2) : p.toPrecision(4));
function liqDe(e, l, esL) { const f = 0.75; return esL ? e * (1 - f / l) : e * (1 + f / l); }

/* Estilos EXTRA de futuros (los op-* base ya están en estilos.js de Spot).
   Solo se añade lo nuevo: modo aislado/cruzado, apalancamiento, botón long/short. */
function estilos() {
  if (_cssPuesto) return;
  _cssPuesto = true;
  const css = `
  .op-fmode{display:flex;gap:7px;margin-bottom:2px}
  .op-fmode button{flex:1;height:34px;border-radius:9px;border:1px solid var(--mv-line);background:var(--mv-card);
    color:var(--mv-mut);font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700}
  .op-fmode button b{color:var(--mv-gold);font-family:inherit}
  .op-flev-top{display:flex;justify-content:space-between;align-items:center;margin:2px 0 5px}
  .op-flev-top span{color:var(--mv-mut);font-size:12px}
  .op-flev-val{color:var(--mv-gold);font-weight:800;font-size:16px}
  .op-finfo{display:flex;flex-direction:column;gap:5px;padding:10px 12px;background:var(--mv-card);border:1px solid var(--mv-line);border-radius:10px}
  .op-finfo .r{display:flex;justify-content:space-between;font-size:12px}
  .op-finfo .r span{color:var(--mv-mut)} .op-finfo .r b{color:var(--mv-txt)} .op-finfo .r b.liq{color:var(--mv-down)}
  .op-flong,.op-fshort{padding:14px 0;border-radius:13px;font-size:15.5px;font-weight:800;color:#fff;letter-spacing:.2px}
  .op-flong{background:linear-gradient(180deg,#34d98a,#12b06a);box-shadow:0 6px 16px rgba(46,189,133,.28)}
  .op-fshort{background:linear-gradient(180deg,#ff5c6c,#e03246);box-shadow:0 6px 16px rgba(246,70,93,.26)}
  .op-flong:active,.op-fshort:active{transform:translateY(1px);filter:brightness(1.06)}
  /* Ventana de modo de margen. */
  .fxm-modal{position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end}
  .fxm-modal .bg{position:absolute;inset:0;background:rgba(3,5,7,.65)}
  .fxm-modal .card{position:relative;width:100%;background:#0e1218;border-top:1px solid #232b36;border-radius:20px 20px 0 0;padding:18px 16px calc(20px + env(safe-area-inset-bottom,0px))}
  .fxm-modal h4{margin:0 0 12px;text-align:center;font-family:'Plus Jakarta Sans';font-weight:800;font-size:17px;color:#eef1f6}
  .fxm-modal .opt{display:block;width:100%;text-align:left;background:rgba(10,14,19,.6);border:1px solid #232b36;border-radius:13px;padding:13px;margin-bottom:9px}
  .fxm-modal .opt.on{border-color:var(--mv-gold,#E8B84B);background:rgba(232,184,75,.08)}
  .fxm-modal .opt b{display:block;font-family:'Plus Jakarta Sans';font-weight:800;font-size:15px;color:#eef1f6;margin-bottom:4px}
  .fxm-modal .opt span{display:block;font-size:12px;line-height:1.5;color:#a9b2bd}
  `;
  const st = document.createElement('style'); st.id = 'fm-extra-css'; st.textContent = css;
  document.head.appendChild(st);
}

export async function pintarFuturos(host, api) {
  if (!host) return;
  estilos();
  if (!_pares.length) { try { const c = await import('../niveles/config.js?v=1'); _pares = (c.PARES || []).slice(); } catch (_) { _pares = []; } }
  if (!_par) _par = _pares.find((p) => p.id === 'BTC') || _pares[0];

  const { logoDe } = await import('./fmt.js?v=1').catch(() => ({ logoDe: () => '' }));

  host.innerHTML = `
    <div class="op-head">
      <button class="op-sel" id="fm-sel">
        <span class="op-logo" id="fm-logo"></span>
        <b id="fm-sym">${esc(_par ? _par.s : 'BTCUSDT')}</b>
      </button>
    </div>
    <div class="op-subhead">
      <span class="op-tag">Futures</span>
      <span class="op-price" id="fm-price">—</span>
      <span class="op-chg" id="fm-chg"></span>
    </div>

    <div class="op-form" style="margin-top:6px">
      <div class="op-fmode">
        <button id="fm-mode">Aislado</button>
        <button id="fm-levbtn">Apalanc. <b id="fm-levbtn-v">10×</b></button>
      </div>

      <div class="op-ol">
        <button class="op-olt on" data-ol="market">Market</button>
        <button class="op-olt" data-ol="limit">Limit</button>
      </div>

      <div class="op-field" id="fm-field-price" style="display:none">
        <span>Precio</span><input id="fm-in-price" inputmode="decimal" placeholder="0.00"><b>USDT</b>
      </div>

      <div class="op-field">
        <span>Margen</span><input id="fm-in-margen" inputmode="decimal" placeholder="0.00"><b>USDT</b>
      </div>

      <div class="op-flev-top"><span>Apalancamiento</span><span class="op-flev-val" id="fm-lev">10×</span></div>
      <input class="op-range" id="fm-range" type="range" min="1" max="200" value="10">

      <div class="op-finfo">
        <div class="r"><span>Tamaño de posición</span><b id="fm-size">—</b></div>
        <div class="r"><span>Precio de liquidación</span><b class="liq" id="fm-liq">—</b></div>
      </div>

      <button class="op-flong" id="fm-long">Long</button>
      <button class="op-fshort" id="fm-short">Short</button>
    </div>

    <div class="op-tabs">
      <button class="op-tab on" data-pt="pos">Posiciones</button>
      <button class="op-tab" data-pt="ord">Mis órdenes</button>
    </div>
    <div class="op-panel" id="fm-panel"><div style="text-align:center;color:var(--mv-mut);font-family:'IBM Plex Mono';font-size:12px;padding:20px">No tienes posiciones abiertas.</div></div>
  `;

  const $ = (id) => document.getElementById(id);

  // Logo de la moneda.
  function ponerLogo() { try { $('fm-logo').innerHTML = logoDe(_par); } catch (_) {} }
  ponerLogo();

  // Precio en vivo desde Binance.
  async function tick() {
    if (!_par) return;
    try {
      const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=' + _par.s);
      if (r.ok) { const j = await r.json(); _precio = +j.lastPrice; const chg = +j.priceChangePercent;
        $('fm-price').textContent = '$' + fmt(_precio);
        const ce = $('fm-chg'); if (ce) { ce.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'; ce.style.color = chg >= 0 ? 'var(--mv-up)' : 'var(--mv-down)'; }
      }
    } catch (_) {}
    refrescar();
  }

  function refrescar() {
    const margen = parseFloat(($('fm-in-margen').value || '').replace(/,/g, '')) || 0;
    $('fm-size').textContent = margen ? fmt(margen * _lev) + ' USDT' : '—';
    $('fm-liq').textContent = (_precio && margen) ? '$' + fmt(liqDe(_precio, _lev, _lado === 'long')) : '—';
  }

  // Selector de moneda (reutiliza el picker de Spot si está).
  $('fm-sel').onclick = async () => {
    try {
      const { abrirPicker } = await import('./picker.js?v=1');
      abrirPicker('Elige un par', _pares, (id) => {
        _par = _pares.find((x) => x.id === id) || _par;
        $('fm-sym').textContent = _par.s; ponerLogo(); tick();
      });
    } catch (_) {}
  };

  // Market / Limit.
  host.querySelectorAll('.op-olt').forEach((b) => b.onclick = () => {
    _tipo = b.dataset.ol;
    host.querySelectorAll('.op-olt').forEach((x) => x.classList.toggle('on', x === b));
    $('fm-field-price').style.display = _tipo === 'limit' ? '' : 'none';
  });

  // Apalancamiento.
  $('fm-range').oninput = (e) => { _lev = +e.target.value; $('fm-lev').textContent = _lev + '×'; $('fm-levbtn-v').textContent = _lev + '×'; refrescar(); };
  $('fm-in-margen').oninput = refrescar;

  // Aislado / Cruzado (ventana explicativa como en un exchange).
  const abrirModo = () => {
    const ov = document.createElement('div'); ov.className = 'fxm-modal';
    ov.innerHTML = `
      <div class="bg"></div>
      <div class="card">
        <h4>Modo de margen</h4>
        <button class="opt${_modo === 'aislado' ? ' on' : ''}" data-m="aislado"><b>Aislado</b><span>El margen de esta posición está separado. Si se liquida, solo pierdes lo asignado a ella.</span></button>
        <button class="opt${_modo === 'cruzado' ? ' on' : ''}" data-m="cruzado"><b>Cruzado</b><span>Todo tu saldo respalda la posición. Aguanta más, pero puedes perder todo el saldo disponible.</span></button>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('.bg').onclick = () => ov.remove();
    ov.querySelectorAll('.opt').forEach((o) => o.onclick = () => { _modo = o.dataset.m; $('fm-mode').textContent = _modo === 'aislado' ? 'Aislado' : 'Cruzado'; ov.remove(); });
  };
  $('fm-mode').onclick = abrirModo;
  $('fm-levbtn').onclick = () => { $('fm-range').focus(); };

  // Long / Short: sin contrato aún -> aviso.
  function ejecutar(l) {
    _lado = l;
    const margen = parseFloat(($('fm-in-margen').value || '').replace(/,/g, '')) || 0;
    if (!margen) { $('fm-in-margen').focus(); return; }
    const btn = l === 'long' ? $('fm-long') : $('fm-short');
    const t = btn.textContent; btn.textContent = 'Muy pronto — en desarrollo';
    setTimeout(() => { btn.textContent = t; }, 1500);
  }
  $('fm-long').onclick = () => { _lado = 'long'; ejecutar('long'); };
  $('fm-short').onclick = () => { _lado = 'short'; ejecutar('short'); };

  // Tabs Posiciones / Órdenes.
  host.querySelectorAll('.op-tab').forEach((b) => b.onclick = () => {
    host.querySelectorAll('.op-tab').forEach((x) => x.classList.toggle('on', x === b));
  });

  tick();
  const iv = setInterval(tick, 3000);
  host._limpiarFut = () => clearInterval(iv);

  // Traducir a inglés si corresponde.
  try { import('../idioma.js?v=152').then((idi) => idi.traducirTodo && idi.traducirTodo()); } catch (_) {}
}
