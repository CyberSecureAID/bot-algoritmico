/* ══════════════════════════════════════════════════════════════════════
   futuros-movil.js — Futuros MÓVIL, calcado del inventario de Bitunix
   ══════════════════════════════════════════════════════════════════════
   Layout exacto de la foto (proporción formulario 58% / libro 42%):
   Header (moneda + iconos) → tabs Futuros/Grid → Cruzado + apalancamiento
   → Abierto/Cerrado → Mercado/Límite/Activador → Disponible → Precio →
   Cantidad → slider % → TP/SL checkbox → Abrir Largo/Corto → Coste → Máximo.
   A la derecha: libro de órdenes completo (asks/precio/bids) en vivo.
   Debajo: tabs Posiciones / Órdenes abiertas / Historial.
   Nuestra paleta (--mv-gold, --mv-up, --mv-down). Sin placeholders muertos.
*/

let _pares = [], _par = null;
let _tipo = 'market', _modo = 'cruzado', _lev = 20, _oc = 'abierto';
let _libro = { asks: [], bids: [], precio: null, chg: null };
let _ws = null, _wsPar = null, _cssPuesto = false;

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

  /* Header. */
  #fmx .fx-hd{display:flex;align-items:center;gap:8px;padding:8px 2px 6px}
  #fmx .fx-coin{display:flex;align-items:center;gap:7px;cursor:pointer}
  #fmx .fx-coin img{width:22px;height:22px;border-radius:50%}
  #fmx .fx-coin b{font-family:'Plus Jakarta Sans';font-weight:800;font-size:16px;color:var(--ink)}
  #fmx .fx-coin .cv{color:var(--mut);font-size:9px}
  #fmx .fx-hd-ic{margin-left:auto;display:flex;gap:12px;color:var(--mut)}
  #fmx .fx-hd-ic svg{width:17px;height:17px}

  /* Tabs Futuros/Grid. */
  #fmx .fx-fg{display:flex;gap:16px;padding:4px 2px 8px;border-bottom:1px solid var(--line)}
  #fmx .fx-fg button{background:none;border:none;color:var(--mut);font-family:'Plus Jakarta Sans';font-weight:700;font-size:14px;padding:0 0 6px;position:relative}
  #fmx .fx-fg button.on{color:var(--ink)}
  #fmx .fx-fg button.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--gold)}

  /* Dos columnas: formulario 58% / libro 42%. */
  #fmx .fx-main{display:grid;grid-template-columns:1fr 128px;gap:10px;padding-top:10px}

  #fmx .fx-form{display:flex;flex-direction:column;gap:8px;min-width:0}
  #fmx .fx-row2{display:flex;gap:6px}
  #fmx .fx-row2 button{flex:1;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);font-family:'IBM Plex Mono';font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:4px}
  #fmx .fx-row2 button .cv{font-size:8px}
  #fmx .fx-row2 button b{color:var(--gold);font-family:'Plus Jakarta Sans'}

  /* Abierto/Cerrado. */
  #fmx .fx-oc{display:flex;gap:6px}
  #fmx .fx-oc button{flex:1;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);font-weight:700;font-size:12px}
  #fmx .fx-oc button.on{background:rgba(46,189,133,.14);color:var(--up);border-color:rgba(46,189,133,.4)}

  /* Mercado/Límite/Activador (desplegable). */
  #fmx .fx-typ{position:relative}
  #fmx .fx-typ-cur{width:100%;height:34px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-family:'Plus Jakarta Sans';font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;cursor:pointer}
  #fmx .fx-typ-cur .cv{color:var(--mut);font-size:9px}
  #fmx .fx-typ-menu{position:absolute;top:38px;left:0;right:0;z-index:50;background:rgba(16,20,26,.96);backdrop-filter:blur(14px);border:1px solid var(--line);border-radius:11px;padding:5px;box-shadow:0 20px 50px rgba(0,0,0,.6);display:none}
  #fmx .fx-typ.open .fx-typ-menu{display:block}
  #fmx .fx-typ-menu button{display:block;width:100%;text-align:left;background:none;border:none;color:var(--mut);font-family:'Plus Jakarta Sans';font-weight:600;font-size:13px;padding:9px 10px;border-radius:8px}
  #fmx .fx-typ-menu button:hover,#fmx .fx-typ-menu button.on{background:rgba(232,184,75,.1);color:var(--ink)}

  #fmx .fx-avbl{display:flex;justify-content:space-between;font-family:'IBM Plex Mono';font-size:10.5px}
  #fmx .fx-avbl span{color:var(--mut)} #fmx .fx-avbl b{color:var(--ink)}
  #fmx .fx-lbl{font-family:'IBM Plex Mono';font-size:9.5px;color:var(--mut);margin-bottom:4px}
  #fmx .fx-fld{display:flex;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:0 11px;height:40px}
  #fmx .fx-fld input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--ink);font-family:'Plus Jakarta Sans';font-weight:700;font-size:15px}
  #fmx .fx-fld input::placeholder{color:var(--mut)} #fmx .fx-fld .u{font-family:'Plus Jakarta Sans';font-weight:700;font-size:11px;color:var(--mut)}

  /* slider %. */
  #fmx .fx-pct{padding:3px 0}
  #fmx .fx-pct input{width:100%;accent-color:var(--gold)}
  #fmx .fx-pct-marks{display:flex;justify-content:space-between;font-family:'IBM Plex Mono';font-size:8.5px;color:var(--mut);margin-top:1px}

  /* TP/SL checkbox. */
  #fmx .fx-tpsl{display:flex;align-items:center;gap:8px;cursor:pointer}
  #fmx .fx-chk{width:15px;height:15px;border-radius:4px;border:1.5px solid var(--line);display:grid;place-items:center;flex:0 0 auto}
  #fmx .fx-chk.on{border-color:var(--gold);background:var(--gold)} #fmx .fx-chk.on::after{content:"✓";font-size:10px;color:#241900;font-weight:800}
  #fmx .fx-tpsl span{font-size:12px;color:var(--ink);font-weight:600}
  #fmx .fx-tpsl-box{display:none;flex-direction:column;gap:6px} #fmx .fx-tpsl-box.on{display:flex}

  /* Botones Abrir Largo/Corto. */
  #fmx .fx-go{height:42px;border:none;border-radius:11px;font-weight:800;font-size:14px;color:#fff}
  #fmx .fx-go.long{background:linear-gradient(180deg,#34d98a,#12b06a)}
  #fmx .fx-go.short{background:linear-gradient(180deg,#ff5c6c,#e03246)}
  #fmx .fx-go:active{filter:brightness(1.08)}

  /* Coste / Máximo. */
  #fmx .fx-cm{display:flex;flex-direction:column;gap:3px;font-family:'IBM Plex Mono';font-size:10px}
  #fmx .fx-cm .r{display:flex;justify-content:space-between}
  #fmx .fx-cm .r span{color:var(--mut)} #fmx .fx-cm .r b{color:var(--ink)}

  /* Libro de órdenes derecho. */
  #fmx .fx-book{display:flex;flex-direction:column;gap:1px;font-family:'IBM Plex Mono';font-size:9px;min-width:0}
  #fmx .fx-book .bh{display:flex;justify-content:space-between;color:var(--mut);font-size:8px;padding:0 2px 2px}
  #fmx .fx-book .rw{position:relative;display:flex;justify-content:space-between;padding:1.5px 3px;overflow:hidden}
  #fmx .fx-book .rw .bar{position:absolute;top:0;bottom:0;right:0;opacity:.13}
  #fmx .fx-book .rw.a .bar{background:var(--down)} #fmx .fx-book .rw.b .bar{background:var(--up)}
  #fmx .fx-book .rw.a .p{color:var(--down)} #fmx .fx-book .rw.b .p{color:var(--up)}
  #fmx .fx-book .rw .p,#fmx .fx-book .rw .q{position:relative;z-index:1}
  #fmx .fx-book .rw .q{color:var(--mut)}
  #fmx .fx-book .md{text-align:center;padding:3px 0;font-family:'Plus Jakarta Sans';font-weight:800;font-size:12px;border-block:1px solid var(--line);margin:1px 0}
  #fmx .fx-book .md.up{color:var(--up)} #fmx .fx-book .md.dn{color:var(--down)}

  /* Tabs de abajo. */
  #fmx .fx-btabs{display:flex;gap:14px;border-bottom:1px solid var(--line);margin-top:14px;padding-bottom:0;overflow-x:auto}
  #fmx .fx-btabs button{flex:0 0 auto;background:none;border:none;color:var(--mut);font-family:'Plus Jakarta Sans';font-weight:700;font-size:12px;padding:0 0 9px;position:relative;white-space:nowrap}
  #fmx .fx-btabs button.on{color:var(--ink)}
  #fmx .fx-btabs button.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--gold)}
  #fmx .fx-bbody{padding:16px 2px 24px;font-family:'IBM Plex Mono';font-size:12px;color:var(--mut);text-align:center}

  /* Selector de moneda (sheet). */
  .fxsheet{position:fixed;inset:0;z-index:600;display:flex;flex-direction:column;background:#0b0e13}
  .fxsheet .h{display:flex;align-items:center;padding:14px;border-bottom:1px solid #232b36}
  .fxsheet .h b{font-family:'Plus Jakarta Sans';font-weight:800;font-size:17px;color:#eef1f6}
  .fxsheet .h .x{margin-left:auto;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid #232b36;color:#7d8794}
  .fxsheet .l{flex:1;overflow-y:auto;padding:8px}
  .fxsheet .o{display:flex;align-items:center;gap:11px;padding:12px;border-radius:11px}
  .fxsheet .o:active{background:rgba(232,184,75,.08)}
  .fxsheet .o img{width:28px;height:28px;border-radius:50%}
  .fxsheet .o b{font-family:'Plus Jakarta Sans';font-weight:700;font-size:15px;color:#eef1f6}

  /* Ventana explicativa (modo, open/close). */
  .fxpop{position:fixed;inset:0;z-index:650;display:flex;align-items:flex-end}
  .fxpop .bg{position:absolute;inset:0;background:rgba(3,5,7,.65)}
  .fxpop .c{position:relative;width:100%;background:#0e1218;border-top:1px solid #232b36;border-radius:20px 20px 0 0;padding:18px 16px calc(20px + env(safe-area-inset-bottom,0px))}
  .fxpop h4{margin:0 0 12px;text-align:center;font-family:'Plus Jakarta Sans';font-weight:800;font-size:17px;color:#eef1f6}
  .fxpop .opt{display:block;width:100%;text-align:left;background:rgba(10,14,19,.6);border:1px solid #232b36;border-radius:13px;padding:13px;margin-bottom:9px}
  .fxpop .opt.on{border-color:var(--mv-gold);background:rgba(232,184,75,.08)}
  .fxpop .opt b{display:block;font-family:'Plus Jakarta Sans';font-weight:800;font-size:15px;color:#eef1f6;margin-bottom:4px}
  .fxpop .opt span{display:block;font-size:12px;line-height:1.5;color:#a9b2bd}
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
  const lg = (p) => { try { const u = logoDe(p.id, p.cg, null); return u ? `<img src="${u}">` : ''; } catch (_) { return ''; } };

  const TYP = { market: 'Mercado', limit: 'Límite', trigger: 'Activador' };

  host.innerHTML = `
    <div id="fmx">
      <div class="fx-hd">
        <div class="fx-coin" id="fx-coin"><span id="fx-ico">${lg(_par)}</span><b id="fx-sym">${esc(_par ? _par.id : 'BTC')}USDT</b><span class="cv">▼</span></div>
        <div class="fx-hd-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12v8h16v-8"/><path d="M12 3v13M8 7l4-4 4 4"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20V8"/></svg>
        </div>
      </div>

      <div class="fx-fg">
        <button class="on" data-fg="fut">Futuros</button>
        <button data-fg="grid">Grid</button>
      </div>

      <div class="fx-main">
        <div class="fx-form">
          <div class="fx-row2">
            <button id="fx-mode">Cruzado <span class="cv">▾</span></button>
            <button id="fx-lev"><b id="fx-levv">${_lev}×</b> <span class="cv">▾</span></button>
          </div>

          <div class="fx-oc">
            <button class="on" data-oc="abierto">Abierto</button>
            <button data-oc="cerrado">Cerrado</button>
          </div>

          <div class="fx-typ" id="fx-typ">
            <button class="fx-typ-cur" id="fx-typ-cur">Mercado <span class="cv">▾</span></button>
            <div class="fx-typ-menu" id="fx-typ-menu">
              <button class="on" data-t="market">Mercado</button>
              <button data-t="limit">Límite</button>
              <button data-t="trigger">Activador</button>
            </div>
          </div>

          <div class="fx-avbl"><span>Disponible</span><b id="fx-avbl">0.0000 USDT</b></div>

          <div id="fx-price-wrap" style="display:none">
            <div class="fx-lbl">Precio</div>
            <div class="fx-fld"><input id="fx-price" inputmode="decimal" placeholder="0.00"><span class="u">USDT</span></div>
          </div>

          <div>
            <div class="fx-lbl">Cantidad</div>
            <div class="fx-fld"><input id="fx-amt" inputmode="decimal" placeholder="Orden mínima"><span class="u">USDT</span></div>
          </div>

          <div class="fx-pct">
            <input type="range" id="fx-pctr" min="0" max="100" value="0" step="25">
            <div class="fx-pct-marks"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
          </div>

          <div class="fx-tpsl" id="fx-tpsl-t"><span class="fx-chk" id="fx-chk"></span><span>TP/SL</span></div>
          <div class="fx-tpsl-box" id="fx-tpsl-b">
            <div class="fx-fld"><input id="fx-tp" inputmode="decimal" placeholder="Take-profit"><span class="u">USDT</span></div>
            <div class="fx-fld"><input id="fx-sl" inputmode="decimal" placeholder="Stop-loss"><span class="u">USDT</span></div>
          </div>

          <button class="fx-go long" id="fx-long">Abrir Largo</button>
          <button class="fx-go short" id="fx-short">Abrir Corto</button>

          <div class="fx-cm">
            <div class="r"><span>Coste (USDT)</span><b id="fx-cost-l">0.0</b></div>
            <div class="r"><span>Coste (USDT)</span><b id="fx-cost-s">0.0</b></div>
          </div>
        </div>

        <div class="fx-book" id="fx-book"></div>
      </div>

      <div class="fx-btabs">
        <button class="on" data-b="pos">Posiciones (0)</button>
        <button data-b="ord">Órdenes abiertas (0)</button>
        <button data-b="hist">Historial</button>
      </div>
      <div class="fx-bbody" id="fx-bbody">No tienes posiciones abiertas.</div>
    </div>`;

  const $ = (id) => document.getElementById(id);

  // Libro en vivo.
  function renderBook() {
    const el = $('fx-book'); if (!el) return;
    const asks = _libro.asks.slice(0, 9).reverse();
    const bids = _libro.bids.slice(0, 9);
    const maxV = Math.max(1, ...asks.map((r) => r[1]), ...bids.map((r) => r[1]));
    const row = (r, c) => `<div class="rw ${c}"><span class="bar" style="width:${(r[1] / maxV * 100).toFixed(0)}%"></span><span class="p">${fmtP(r[0])}</span><span class="q">${fmtV(r[1])}</span></div>`;
    el.innerHTML = `<div class="bh"><span>Precio</span><span>Cant.</span></div>` +
      asks.map((r) => row(r, 'a')).join('') +
      `<div class="md ${_libro.chg >= 0 ? 'up' : 'dn'}">${_libro.precio == null ? '—' : fmtP(_libro.precio)}</div>` +
      bids.map((r) => row(r, 'b')).join('');
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

  async function tick() {
    if (!_par) return;
    try { const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${_par.s}`);
      if (r.ok) { const j = await r.json(); _libro.precio = +j.lastPrice; _libro.chg = +j.priceChangePercent; }
    } catch (_) {}
    renderBook(); calc();
  }
  tick(); const iv = setInterval(tick, 3000);
  host._limpiar = () => { clearInterval(iv); if (_ws) { try { _ws.close(); } catch (_) {} _ws = null; _wsPar = null; } };

  let _lado = 'long';
  function calc() {
    const amt = parseFloat(($('fx-amt').value || '').replace(/,/g, '')) || 0;
    const c = amt ? amt.toFixed(1) : '0.0';
    if ($('fx-cost-l')) $('fx-cost-l').textContent = c;
    if ($('fx-cost-s')) $('fx-cost-s').textContent = c;
  }

  // Ventana explicativa.
  function pop(titulo, items, onPick) {
    const ov = document.createElement('div'); ov.className = 'fxpop';
    let h = '<div class="bg"></div><div class="c"><h4>' + titulo + '</h4>';
    items.forEach((it) => { h += '<button class="opt' + (it[2] ? ' on' : '') + '" data-v="' + (it[3] || '') + '"><b>' + it[0] + '</b><span>' + it[1] + '</span></button>'; });
    h += '</div>'; ov.innerHTML = h; document.body.appendChild(ov);
    ov.querySelector('.bg').onclick = () => ov.remove();
    ov.querySelectorAll('.opt').forEach((o) => o.onclick = () => { if (onPick) onPick(o.dataset.v); ov.remove(); });
  }

  $('fx-coin').onclick = () => {
    const sh = document.createElement('div'); sh.className = 'fxsheet';
    sh.innerHTML = `<div class="h"><b>Elige la moneda</b><button class="x">✕</button></div><div class="l">${_pares.map((p) => `<div class="o" data-id="${p.id}">${lg(p)}<b>${p.id}/USDT</b></div>`).join('')}</div>`;
    document.body.appendChild(sh);
    sh.querySelector('.x').onclick = () => sh.remove();
    sh.querySelectorAll('.o').forEach((o) => o.onclick = () => { _par = _pares.find((x) => x.id === o.dataset.id) || _par; $('fx-sym').textContent = _par.id + 'USDT'; $('fx-ico').innerHTML = lg(_par); _libro = { asks: [], bids: [], precio: null, chg: null }; conectarLibro(); tick(); sh.remove(); });
  };

  host.querySelectorAll('.fx-fg button').forEach((b) => b.onclick = () => host.querySelectorAll('.fx-fg button').forEach((x) => x.classList.toggle('on', x === b)));

  $('fx-mode').onclick = () => pop('Modo de margen', [
    ['Aislado', 'El margen de esta posición está separado. Si se liquida, solo pierdes lo asignado a ella.', _modo === 'aislado', 'aislado'],
    ['Cruzado', 'Todo tu saldo respalda la posición. Aguanta más, pero puedes perder todo el saldo disponible.', _modo === 'cruzado', 'cruzado']
  ], (v) => { _modo = v; $('fx-mode').innerHTML = (v === 'aislado' ? 'Aislado' : 'Cruzado') + ' <span class="cv">▾</span>'; });

  $('fx-lev').onclick = () => pop('Apalancamiento', [
    ['5×', 'Riesgo bajo. Pérdidas y ganancias multiplicadas por 5.', _lev === 5, '5'],
    ['20×', 'Riesgo medio. Recomendado para la mayoría.', _lev === 20, '20'],
    ['50×', 'Riesgo alto. Una variación pequeña puede liquidarte.', _lev === 50, '50'],
    ['100×', 'Riesgo muy alto.', _lev === 100, '100'],
    ['200×', 'Riesgo extremo. Solo para expertos.', _lev === 200, '200']
  ], (v) => { _lev = +v; $('fx-levv').textContent = _lev + '×'; });

  // Abierto/Cerrado con explicación.
  host.querySelectorAll('.fx-oc button').forEach((b) => b.onclick = () => {
    _oc = b.dataset.oc; host.querySelectorAll('.fx-oc button').forEach((x) => x.classList.toggle('on', x === b));
    if (_oc === 'abierto') pop('Abierto / Cerrado', [
      ['Abierto (Open)', 'Abre una posición nueva en largo o corto con el capital y apalancamiento que definas.', true, ''],
      ['Cerrado (Close)', 'Cierra una posición que ya tienes abierta, tomando la ganancia o pérdida acumulada.', false, '']
    ]);
  });

  // Tipo de orden (desplegable).
  const typ = $('fx-typ');
  $('fx-typ-cur').onclick = (e) => { e.stopPropagation(); typ.classList.toggle('open'); };
  document.addEventListener('click', () => typ.classList.remove('open'));
  host.querySelectorAll('.fx-typ-menu button').forEach((b) => b.onclick = () => {
    _tipo = b.dataset.t; host.querySelectorAll('.fx-typ-menu button').forEach((x) => x.classList.toggle('on', x === b));
    $('fx-typ-cur').innerHTML = TYP[_tipo] + ' <span class="cv">▾</span>';
    $('fx-price-wrap').style.display = (_tipo === 'limit' || _tipo === 'trigger') ? '' : 'none';
    typ.classList.remove('open');
    if (_tipo === 'trigger') pop('Orden Activador (Trigger)', [
      ['¿Qué es?', 'Una orden que solo se activa cuando el precio alcanza el nivel que marcas. Hasta entonces queda en espera.', true, ''],
      ['Para qué sirve', 'Entrar automáticamente si el mercado llega a cierto precio, sin estar pendiente de la pantalla.', false, '']
    ]);
  });

  $('fx-amt').oninput = calc;
  $('fx-pctr').oninput = () => {};
  $('fx-tpsl-t').onclick = () => { const on = $('fx-chk').classList.toggle('on'); $('fx-tpsl-b').classList.toggle('on', on); };

  function ejec(l) {
    _lado = l; calc();
    const amt = parseFloat(($('fx-amt').value || '').replace(/,/g, '')) || 0;
    if (!amt) { $('fx-amt').focus(); return; }
    const b = l === 'long' ? $('fx-long') : $('fx-short');
    const t = b.textContent; b.textContent = 'Muy pronto — en desarrollo'; setTimeout(() => { b.textContent = t; }, 1500);
  }
  $('fx-long').onclick = () => ejec('long');
  $('fx-short').onclick = () => ejec('short');

  host.querySelectorAll('.fx-btabs button').forEach((b) => b.onclick = () => {
    host.querySelectorAll('.fx-btabs button').forEach((x) => x.classList.toggle('on', x === b));
    $('fx-bbody').textContent = b.dataset.b === 'pos' ? 'No tienes posiciones abiertas.' : b.dataset.b === 'ord' ? 'No tienes órdenes abiertas.' : 'Sin historial.';
  });

  calc();
  try { import('../idioma.js?v=158').then((idi) => idi.traducirTodo && idi.traducirTodo()); } catch (_) {}
}
