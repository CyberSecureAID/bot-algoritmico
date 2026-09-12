/* ══════════════════════════════════════════════════════════════════════
   futuros-movil.js — Futuros MÓVIL estilo exchange (Bitunix layout)
   ══════════════════════════════════════════════════════════════════════
   Layout de dos columnas como los exchanges reales:
   · IZQUIERDA: formulario compacto (Cruzado/Aislado + apalancamiento,
     Mercado/Límite, Precio, Cantidad, slider %, TP/SL con checkbox,
     botones Abrir Largo / Abrir Corto).
   · DERECHA: libro de órdenes COMPLETO de arriba a abajo (asks en rojo,
     precio en medio, bids en verde), en vivo por WebSocket.
   Abajo: tabs Posiciones / Órdenes abiertas / Historial.

   Nuestra paleta (--mv-gold, --mv-up, --mv-down). Sin bots. Fase interfaz:
   los botones muestran "coming soon" hasta que exista el contrato.
*/

let _pares = [], _par = null;
let _tipo = 'market', _modo = 'cruzado', _lev = 10;
let _libro = { asks: [], bids: [], precio: null, chg: null };
let _ws = null, _wsPar = null;
let _cssPuesto = false;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtP = (p) => !p ? '—' : (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 1 }) : p >= 1 ? p.toFixed(2) : p.toPrecision(5));
const fmtV = (v) => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v.toFixed(1);
function liqDe(e, l, esL) { const f = 0.75; return esL ? e * (1 - f / l) : e * (1 + f / l); }

function estilos() {
  if (_cssPuesto) return; _cssPuesto = true;
  const css = `
  #fmx{display:flex;flex-direction:column;min-height:100%;
    --gold:var(--mv-gold,#E8B84B);--up:var(--mv-up,#2ebd85);--down:var(--mv-down,#f6465d);
    --ink:var(--mv-txt,#eaecef);--mut:var(--mv-mut,#8b96a3);--card:var(--mv-card,#151b23);--line:var(--mv-line,#232b36)}
  #fmx .fx-head{display:flex;align-items:center;gap:9px;padding:10px 2px}
  #fmx .fx-sel{display:flex;align-items:center;gap:7px;cursor:pointer}
  #fmx .fx-sel img{width:24px;height:24px;border-radius:50%}
  #fmx .fx-sel b{font-family:'Plus Jakarta Sans';font-weight:800;font-size:17px;color:var(--ink)}
  #fmx .fx-sel .cv{color:var(--mut);font-size:9px}
  #fmx .fx-tag{font-family:'IBM Plex Mono';font-size:9px;font-weight:700;color:var(--gold);
    border:1px solid rgba(232,184,75,.4);border-radius:5px;padding:2px 5px}
  #fmx .fx-px{margin-left:auto;text-align:right}
  #fmx .fx-px b{font-family:'IBM Plex Mono';font-size:16px;color:var(--ink);display:block}
  #fmx .fx-px span{font-family:'IBM Plex Mono';font-size:11px;font-weight:700}
  #fmx .fx-px .up{color:var(--up)} #fmx .fx-px .down{color:var(--down)}

  /* Dos columnas: formulario + libro. */
  #fmx .fx-grid{display:grid;grid-template-columns:1fr 118px;gap:10px}

  /* Formulario izquierdo. */
  #fmx .fx-form{display:flex;flex-direction:column;gap:8px}
  #fmx .fx-top2{display:flex;gap:6px}
  #fmx .fx-top2 button{flex:1;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--card);
    color:var(--mut);font-family:'IBM Plex Mono';font-size:10.5px;font-weight:700}
  #fmx .fx-top2 button b{color:var(--gold);font-family:'Plus Jakarta Sans'}
  #fmx .fx-ol{display:flex;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:3px}
  #fmx .fx-ol button{flex:1;height:28px;border-radius:6px;background:none;border:none;color:var(--mut);font-weight:700;font-size:12px}
  #fmx .fx-ol button.on{background:rgba(232,184,75,.14);color:var(--gold)}
  #fmx .fx-fld{display:flex;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:0 10px;height:40px}
  #fmx .fx-fld input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--ink);font-family:'Plus Jakarta Sans';font-weight:700;font-size:15px}
  #fmx .fx-fld input::placeholder{color:var(--mut)}
  #fmx .fx-fld .lb{font-family:'IBM Plex Mono';font-size:9px;color:var(--mut);margin-right:6px}
  #fmx .fx-fld .u{font-family:'Plus Jakarta Sans';font-weight:700;font-size:11px;color:var(--mut)}
  #fmx .fx-avbl{display:flex;justify-content:space-between;font-family:'IBM Plex Mono';font-size:10px;color:var(--mut)}
  #fmx .fx-avbl b{color:var(--ink)}
  #fmx .fx-pcts{display:flex;gap:5px}
  #fmx .fx-pcts button{flex:1;height:24px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--mut);font-family:'IBM Plex Mono';font-size:10px;font-weight:700}
  #fmx .fx-pcts button:active{border-color:var(--gold);color:var(--gold)}

  /* TP/SL con checkbox. */
  #fmx .fx-tpsl-h{display:flex;align-items:center;gap:8px;cursor:pointer}
  #fmx .fx-chk{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--line);display:grid;place-items:center;flex:0 0 auto}
  #fmx .fx-chk.on{border-color:var(--gold);background:var(--gold)}
  #fmx .fx-chk.on::after{content:"✓";font-size:11px;color:#241900;font-weight:800}
  #fmx .fx-tpsl-h span{font-size:12px;color:var(--ink);font-weight:600}
  #fmx .fx-tpsl-box{display:none;flex-direction:column;gap:6px}
  #fmx .fx-tpsl-box.on{display:flex}

  /* Info compacta (tamaño / liquidación). */
  #fmx .fx-info{display:flex;flex-direction:column;gap:3px;font-family:'IBM Plex Mono';font-size:10.5px}
  #fmx .fx-info .r{display:flex;justify-content:space-between}
  #fmx .fx-info .r span{color:var(--mut)} #fmx .fx-info .r b{color:var(--ink)} #fmx .fx-info .r b.liq{color:var(--down)}

  #fmx .fx-btns{display:flex;flex-direction:column;gap:7px}
  #fmx .fx-btn{height:42px;border-radius:11px;border:none;font-weight:800;font-size:14px;color:#fff}
  #fmx .fx-btn.long{background:linear-gradient(180deg,#34d98a,#12b06a)}
  #fmx .fx-btn.short{background:linear-gradient(180deg,#ff5c6c,#e03246)}
  #fmx .fx-btn:active{filter:brightness(1.08)}

  /* Libro de órdenes derecho, completo. */
  #fmx .fx-book{display:flex;flex-direction:column;gap:1px;font-family:'IBM Plex Mono';font-size:9.5px}
  #fmx .fx-book .bh{display:flex;justify-content:space-between;color:var(--mut);font-size:8.5px;padding:0 2px 3px}
  #fmx .fx-book .row{position:relative;display:flex;justify-content:space-between;padding:2px 3px;overflow:hidden}
  #fmx .fx-book .row .bar{position:absolute;top:0;bottom:0;right:0;opacity:.14}
  #fmx .fx-book .row.ask .bar{background:var(--down)} #fmx .fx-book .row.bid .bar{background:var(--up)}
  #fmx .fx-book .row.ask .px{color:var(--down)} #fmx .fx-book .row.bid .px{color:var(--up)}
  #fmx .fx-book .row .px,#fmx .fx-book .row .qt{position:relative;z-index:1}
  #fmx .fx-book .row .qt{color:var(--mut)}
  #fmx .fx-book .mid{text-align:center;padding:5px 0;font-family:'Plus Jakarta Sans';font-weight:800;font-size:14px;border-block:1px solid var(--line);margin:2px 0}
  #fmx .fx-book .mid.up{color:var(--up)} #fmx .fx-book .mid.dn{color:var(--down)}

  /* Tabs abajo. */
  #fmx .fx-tabs{display:flex;gap:16px;border-bottom:1px solid var(--line);margin-top:14px;padding-bottom:0}
  #fmx .fx-tabs button{background:none;border:none;color:var(--mut);font-family:'Plus Jakarta Sans';font-weight:700;font-size:12.5px;padding:0 0 9px;position:relative}
  #fmx .fx-tabs button.on{color:var(--ink)}
  #fmx .fx-tabs button.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--gold)}
  #fmx .fx-panel{padding:14px 2px 24px;font-family:'IBM Plex Mono';font-size:12px;color:var(--mut);text-align:center}

  /* Selector de moneda (bottom sheet). */
  .fxs{position:fixed;inset:0;z-index:600;display:flex;flex-direction:column;background:#0b0e13}
  .fxs .h{display:flex;align-items:center;padding:14px;border-bottom:1px solid #232b36}
  .fxs .h b{font-family:'Plus Jakarta Sans';font-weight:800;font-size:17px;color:#eef1f6}
  .fxs .h .x{margin-left:auto;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid #232b36;color:#7d8794}
  .fxs .l{flex:1;overflow-y:auto;padding:8px}
  .fxs .o{display:flex;align-items:center;gap:11px;padding:12px;border-radius:11px}
  .fxs .o:active{background:rgba(232,184,75,.08)}
  .fxs .o img{width:28px;height:28px;border-radius:50%}
  .fxs .o b{font-family:'Plus Jakarta Sans';font-weight:700;font-size:15px;color:#eef1f6}

  /* Ventana modo margen. */
  .fxm{position:fixed;inset:0;z-index:650;display:flex;align-items:flex-end}
  .fxm .bg{position:absolute;inset:0;background:rgba(3,5,7,.65)}
  .fxm .c{position:relative;width:100%;background:#0e1218;border-top:1px solid #232b36;border-radius:20px 20px 0 0;padding:18px 16px calc(20px + env(safe-area-inset-bottom,0px))}
  .fxm h4{margin:0 0 12px;text-align:center;font-family:'Plus Jakarta Sans';font-weight:800;font-size:17px;color:#eef1f6}
  .fxm .opt{display:block;width:100%;text-align:left;background:rgba(10,14,19,.6);border:1px solid #232b36;border-radius:13px;padding:13px;margin-bottom:9px}
  .fxm .opt.on{border-color:var(--mv-gold);background:rgba(232,184,75,.08)}
  .fxm .opt b{display:block;font-family:'Plus Jakarta Sans';font-weight:800;font-size:15px;color:#eef1f6;margin-bottom:4px}
  .fxm .opt span{display:block;font-size:12px;line-height:1.5;color:#a9b2bd}
  `;
  const st = document.createElement('style'); st.id = 'fmx-css'; st.textContent = css;
  document.head.appendChild(st);
}

export async function pintarFuturos(host, api) {
  if (!host) return;
  estilos();
  if (!_pares.length) { try { const c = await import('../niveles/config.js?v=1'); _pares = (c.PARES || []).slice(); } catch (_) { _pares = []; } }
  if (!_par) _par = _pares.find((p) => p.id === 'BTC') || _pares[0];

  const { logoDe } = await import('./fmt.js?v=1').catch(() => ({ logoDe: () => '' }));

  host.innerHTML = `
    <div id="fmx">
      <div class="fx-head">
        <div class="fx-sel" id="fx-sel"><span id="fx-ico"></span><b id="fx-sym">${esc(_par ? _par.id : 'BTC')}/USDT</b><span class="cv">▼</span></div>
        <span class="fx-tag">Futures</span>
        <div class="fx-px"><b id="fx-price">—</b><span id="fx-chg"></span></div>
      </div>

      <div class="fx-grid">
        <div class="fx-form">
          <div class="fx-top2">
            <button id="fx-mode">Cruzado</button>
            <button id="fx-levbtn">Apalanc. <b id="fx-levbtn-v">10×</b></button>
          </div>
          <div class="fx-ol">
            <button class="on" data-ol="market">Mercado</button>
            <button data-ol="limit">Límite</button>
          </div>
          <div class="fx-fld" id="fx-price-fld" style="display:none"><span class="lb">PRECIO</span><input id="fx-in-price" inputmode="decimal" placeholder="0.00"><span class="u">USDT</span></div>
          <div class="fx-fld"><span class="lb">CANT.</span><input id="fx-in-amt" inputmode="decimal" placeholder="0.00"><span class="u">USDT</span></div>
          <div class="fx-avbl"><span>Disponible</span><b>— USDT</b></div>
          <div class="fx-pcts">
            <button data-pct="25">25%</button><button data-pct="50">50%</button><button data-pct="75">75%</button><button data-pct="100">100%</button>
          </div>
          <div>
            <div class="fx-avbl" style="margin-bottom:4px"><span>Apalancamiento</span><b id="fx-lev">10×</b></div>
            <input type="range" id="fx-range" min="1" max="200" value="10" style="width:100%;accent-color:var(--gold)">
          </div>
          <div class="fx-tpsl-h" id="fx-tpsl-tog"><span class="fx-chk" id="fx-tpsl-chk"></span><span>TP/SL</span></div>
          <div class="fx-tpsl-box" id="fx-tpsl-box">
            <div class="fx-fld"><span class="lb">TP</span><input id="fx-in-tp" inputmode="decimal" placeholder="Take-profit"><span class="u">USDT</span></div>
            <div class="fx-fld"><span class="lb">SL</span><input id="fx-in-sl" inputmode="decimal" placeholder="Stop-loss"><span class="u">USDT</span></div>
          </div>
          <div class="fx-info">
            <div class="r"><span>Tamaño</span><b id="fx-size">—</b></div>
            <div class="r"><span>Liquidación</span><b class="liq" id="fx-liq">—</b></div>
          </div>
          <div class="fx-btns">
            <button class="fx-btn long" id="fx-long">Abrir Largo</button>
            <button class="fx-btn short" id="fx-short">Abrir Corto</button>
          </div>
        </div>

        <div class="fx-book" id="fx-book"></div>
      </div>

      <div class="fx-tabs">
        <button class="on" data-t="pos">Posiciones</button>
        <button data-t="ord">Órdenes abiertas</button>
        <button data-t="hist">Historial</button>
      </div>
      <div class="fx-panel" id="fx-panel">No tienes posiciones abiertas.</div>
    </div>`;

  const $ = (id) => document.getElementById(id);
  function ico() { try { $('fx-ico').innerHTML = logoDe(_par ? _par.id : '', _par ? _par.cg : '', null) ? `<img src="${logoDe(_par.id, _par.cg, null)}">` : ''; } catch (_) {} }
  ico();

  // Libro de órdenes en vivo.
  function renderBook() {
    const el = $('fx-book'); if (!el) return;
    const asks = _libro.asks.slice(0, 8).reverse();
    const bids = _libro.bids.slice(0, 8);
    const maxV = Math.max(1, ...asks.map((r) => r[1]), ...bids.map((r) => r[1]));
    const fila = (r, cls) => {
      const w = (r[1] / maxV * 100).toFixed(0);
      return `<div class="row ${cls}"><span class="bar" style="width:${w}%"></span><span class="px">${fmtP(r[0])}</span><span class="qt">${fmtV(r[1])}</span></div>`;
    };
    const mid = _libro.precio == null ? '—' : fmtP(_libro.precio);
    el.innerHTML = `<div class="bh"><span>Precio</span><span>Cant.</span></div>` +
      asks.map((r) => fila(r, 'ask')).join('') +
      `<div class="mid ${_libro.chg >= 0 ? 'up' : 'dn'}">${mid}</div>` +
      bids.map((r) => fila(r, 'bid')).join('');
  }
  function conectarLibro() {
    if (!_par) return;
    if (_ws && _wsPar === _par.s && (_ws.readyState === 0 || _ws.readyState === 1)) { renderBook(); return; }
    if (_ws) { try { _ws.close(); } catch (_) {} }
    _wsPar = _par.s;
    try {
      _ws = new WebSocket(`wss://stream.binance.com:9443/ws/${_par.s.toLowerCase()}@depth20@100ms`);
      _ws.onmessage = (ev) => { try { const j = JSON.parse(ev.data);
        if (j.asks) _libro.asks = j.asks.map((x) => [+x[0], +x[1]]);
        if (j.bids) _libro.bids = j.bids.map((x) => [+x[0], +x[1]]);
        renderBook(); calc();
      } catch (_) {} };
    } catch (_) {}
  }
  conectarLibro(); renderBook();

  // Precio + cambio.
  async function tick() {
    if (!_par) return;
    try { const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${_par.s}`);
      if (r.ok) { const j = await r.json(); _libro.precio = +j.lastPrice; _libro.chg = +j.priceChangePercent;
        $('fx-price').textContent = '$' + fmtP(_libro.precio);
        const ce = $('fx-chg'); ce.textContent = (_libro.chg >= 0 ? '+' : '') + _libro.chg.toFixed(2) + '%'; ce.className = _libro.chg >= 0 ? 'up' : 'down';
      }
    } catch (_) {}
    renderBook(); calc();
  }
  tick(); const iv = setInterval(tick, 3000);
  host._limpiar = () => { clearInterval(iv); if (_ws) { try { _ws.close(); } catch (_) {} _ws = null; _wsPar = null; } };

  let _lado = 'long';
  function calc() {
    const margen = parseFloat(($('fx-in-amt').value || '').replace(/,/g, '')) || 0;
    const px = _libro.precio || 0;
    $('fx-size').textContent = margen ? fmtP(margen * _lev) + ' USDT' : '—';
    $('fx-liq').textContent = (px && margen) ? '$' + fmtP(liqDe(px, _lev, _lado === 'long')) : '—';
  }

  // Interacciones.
  host.querySelectorAll('.fx-ol button').forEach((b) => b.onclick = () => {
    _tipo = b.dataset.ol; host.querySelectorAll('.fx-ol button').forEach((x) => x.classList.toggle('on', x === b));
    $('fx-price-fld').style.display = _tipo === 'limit' ? '' : 'none';
  });
  $('fx-range').oninput = (e) => { _lev = +e.target.value; $('fx-lev').textContent = _lev + '×'; $('fx-levbtn-v').textContent = _lev + '×'; calc(); };
  $('fx-in-amt').oninput = calc;
  host.querySelectorAll('.fx-pcts button').forEach((b) => b.onclick = () => {});
  // TP/SL checkbox.
  $('fx-tpsl-tog').onclick = () => { const on = $('fx-tpsl-chk').classList.toggle('on'); $('fx-tpsl-box').classList.toggle('on', on); };
  // Modo margen.
  $('fx-mode').onclick = () => {
    const ov = document.createElement('div'); ov.className = 'fxm';
    ov.innerHTML = '<div class="bg"></div><div class="c"><h4>Modo de margen</h4>' +
      '<button class="opt' + (_modo === 'aislado' ? ' on' : '') + '" data-m="aislado"><b>Aislado</b><span>El margen de esta posición está separado. Si se liquida, solo pierdes lo asignado a ella.</span></button>' +
      '<button class="opt' + (_modo === 'cruzado' ? ' on' : '') + '" data-m="cruzado"><b>Cruzado</b><span>Todo tu saldo respalda la posición. Aguanta más, pero puedes perder todo el saldo disponible.</span></button></div>';
    document.body.appendChild(ov);
    ov.querySelector('.bg').onclick = () => ov.remove();
    ov.querySelectorAll('.opt').forEach((o) => o.onclick = () => { _modo = o.dataset.m; $('fx-mode').textContent = _modo === 'aislado' ? 'Aislado' : 'Cruzado'; ov.remove(); });
  };
  $('fx-levbtn').onclick = () => $('fx-range').focus();

  function ejec(l) {
    _lado = l; calc();
    const margen = parseFloat(($('fx-in-amt').value || '').replace(/,/g, '')) || 0;
    if (!margen) { $('fx-in-amt').focus(); return; }
    const b = l === 'long' ? $('fx-long') : $('fx-short');
    const t = b.textContent; b.textContent = 'Muy pronto — en desarrollo'; setTimeout(() => { b.textContent = t; }, 1500);
  }
  $('fx-long').onclick = () => ejec('long');
  $('fx-short').onclick = () => ejec('short');

  host.querySelectorAll('.fx-tabs button').forEach((b) => b.onclick = () => {
    host.querySelectorAll('.fx-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    const t = b.dataset.t;
    $('fx-panel').textContent = t === 'pos' ? 'No tienes posiciones abiertas.' : t === 'ord' ? 'No tienes órdenes abiertas.' : 'Sin historial.';
  });

  // Selector de moneda.
  $('fx-sel').onclick = () => {
    const sh = document.createElement('div'); sh.className = 'fxs';
    sh.innerHTML = `<div class="h"><b>Elige la moneda</b><button class="x">✕</button></div>
      <div class="l">${_pares.map((p) => `<div class="o" data-id="${p.id}">${logoDe(p.id, p.cg, null) ? `<img src="${logoDe(p.id, p.cg, null)}">` : ''}<b>${p.id}/USDT</b></div>`).join('')}</div>`;
    document.body.appendChild(sh);
    sh.querySelector('.x').onclick = () => sh.remove();
    sh.querySelectorAll('.o').forEach((o) => o.onclick = () => {
      _par = _pares.find((x) => x.id === o.dataset.id) || _par;
      $('fx-sym').textContent = _par.id + '/USDT'; ico();
      _libro = { asks: [], bids: [], precio: null, chg: null };
      conectarLibro(); tick(); sh.remove();
    });
  };

  calc();
  try { import('../idioma.js?v=153').then((idi) => idi.traducirTodo && idi.traducirTodo()); } catch (_) {}
}
