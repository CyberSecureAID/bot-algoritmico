/* movil/futuros-movil.js — Futuros en el teléfono, calcado del inventario de
   la referencia (Bitunix móvil) con nuestra paleta.
   · Header de UNA fila: [logo PAR ▾] … [historial][gráfica]. Sin tabs.
   · Rejilla 58/42: izquierda formulario, derecha libro completo (sticky):
     asks ↑ rojo, precio medio, bids ↓ verde, ratio compra/venta.
   · Formulario: [Cruzada▾][20×▾] / Abierto|Cerrado / Mercado▾ / Disponible /
     Precio / Cantidad / slider % / ☐TP/SL / Abrir Largo / Abrir Corto /
     Coste / Máximo.
   · Debajo: Posiciones (n) | Órdenes abiertas (n) · ☐Solo actual · Cerrar todo.
   · Historial = ventana ya existente (abrirHistorialMovil de operar.js).
   · Logos y selector = picker/fmt reales (cache mv-cg + CoinGecko).
   Las posiciones viven en memoria hasta que exista el contrato de futuros. */

import { abrirPicker } from './picker.js?v=1';
import { IC } from './iconos.js?v=1';
import { abrirHistorialMovil } from './operar.js?v=2';
import { t } from '../idioma.js?v=159';

let _pares = [], _par = null;
let _tipo = 'market', _modo = 'cruzada', _lev = 20, _oc = 'abierto';
let _libro = { asks: [], bids: [], precio: null, chg: null };
let _ws = null, _wsPar = null, _css = false, _pos = [];
const LOGO_ESP = { EUR: 'https://flagcdn.com/w80/eu.png', GBP: 'https://flagcdn.com/w80/gb.png', PAXG: 'https://assets.coingecko.com/coins/images/9519/small/paxgold.png' };

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtP = (p) => { p = +p; if (!isFinite(p) || !p) return '—'; if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 1 }); if (p >= 1) return p.toFixed(2); if (p >= 0.01) return p.toFixed(5); return p.toPrecision(5); };
const fmtQ = (v) => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v.toFixed(1);
const liqDe = (e, l, esL) => esL ? e * (1 - 0.75 / l) : e * (1 + 0.75 / l);

function estilos() {
  if (_css) return; _css = true;
  const st = document.createElement('style'); st.id = 'fx-css';
  st.textContent = `
  #fx{--gold:var(--mv-gold,#E8B84B);--up:var(--mv-up,#2ebd85);--down:var(--mv-down,#f6465d);--ink:var(--mv-txt,#eaecef);--mut:var(--mv-mut,#8b96a3);--card:var(--mv-card,#151b23);--line:var(--mv-line,#232b36)}
  #fx .hd{display:flex;align-items:center;gap:8px;padding:6px 0 8px}
  #fx .coin{display:flex;align-items:center;gap:7px;padding:4px 6px 4px 2px;border-radius:9px;min-width:0}
  #fx .coin:active{background:var(--card)}
  #fx .coin .lg{width:24px;height:24px;border-radius:50%;background:#1b2230 center/cover no-repeat;display:grid;place-items:center;font-family:'IBM Plex Mono';font-size:9px;color:var(--gold)}
  #fx .coin b{font-weight:800;font-size:16px;color:var(--ink)} #fx .coin .cv{color:var(--mut);font-size:9px}
  #fx .hd .px{font-family:'IBM Plex Mono';font-size:13px;font-weight:700} #fx .hd .px.up{color:var(--up)} #fx .hd .px.dn{color:var(--down)}
  #fx .hd .ics{margin-left:auto;display:flex;gap:6px;flex:0 0 auto}
  #fx .hd .ics button{width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);display:grid;place-items:center}
  #fx .hd .ics svg{width:17px;height:17px}

  #fx{min-width:0;max-width:100%}
  #fx .main{display:grid;grid-template-columns:minmax(0,58fr) minmax(0,42fr);gap:10px;align-items:start;min-width:0}
  #fx .form{display:flex;flex-direction:column;gap:8px;min-width:0}
  #fx .r2{display:flex;gap:6px}
  #fx .r2 button{flex:1;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);font-family:'IBM Plex Mono';font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:4px;min-width:0}
  #fx .r2 button b{color:var(--gold);font-family:'Plus Jakarta Sans'} #fx .r2 .cv{font-size:8px}
  #fx .oc{display:flex;gap:6px}
  #fx .oc button{flex:1;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);font-weight:700;font-size:12px}
  #fx .oc button.on{background:rgba(46,189,133,.14);color:var(--up);border-color:rgba(46,189,133,.4)}
  #fx .typ{position:relative}
  #fx .typ .cur{width:100%;height:34px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:space-between;padding:0 12px}
  #fx .typ .cur .cv{color:var(--mut);font-size:9px}
  #fx .typ .menu{position:absolute;top:38px;left:0;right:0;z-index:50;background:rgba(16,20,26,.97);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid var(--line);border-radius:11px;padding:5px;box-shadow:0 20px 50px rgba(0,0,0,.6);display:none}
  #fx .typ.open .menu{display:block}
  #fx .typ .menu button{display:block;width:100%;text-align:left;background:none;border:none;color:var(--mut);font-weight:600;font-size:13px;padding:9px 10px;border-radius:8px}
  #fx .typ .menu button.on{background:rgba(232,184,75,.1);color:var(--ink)}
  #fx .avbl{display:flex;justify-content:space-between;font-family:'IBM Plex Mono';font-size:10.5px}
  #fx .avbl span{color:var(--mut)} #fx .avbl b{color:var(--ink)}
  #fx .lbl{font-family:'IBM Plex Mono';font-size:9.5px;color:var(--mut);margin-bottom:4px}
  #fx .fld{display:flex;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:0 11px;height:40px}
  #fx .fld input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--ink);font-weight:700;font-size:14px}
  #fx .fld input::placeholder{color:var(--mut)} #fx .fld input:disabled{color:var(--mut)} #fx .fld .u{font-weight:700;font-size:11px;color:var(--mut)}
  #fx .pct input{width:100%;accent-color:var(--gold)}
  #fx .pct .mk{display:flex;justify-content:space-between;font-family:'IBM Plex Mono';font-size:8.5px;color:var(--mut)}
  #fx .tpsl{display:flex;align-items:center;gap:8px}
  #fx .chk{width:15px;height:15px;border-radius:4px;border:1.5px solid var(--line);display:grid;place-items:center;flex:0 0 auto}
  #fx .chk.on{border-color:var(--gold);background:var(--gold)} #fx .chk.on::after{content:"✓";font-size:10px;color:#241900;font-weight:800}
  #fx .tpsl span{font-size:12px;color:var(--ink);font-weight:600}
  #fx .tpsl-box{display:none;flex-direction:column;gap:6px} #fx .tpsl-box.on{display:flex}
  #fx .go{height:42px;border:none;border-radius:11px;font-weight:800;font-size:14px;color:#fff}
  #fx .go.long{background:linear-gradient(180deg,#34d98a,#12b06a)} #fx .go.short{background:linear-gradient(180deg,#ff5c6c,#e03246)}
  #fx .go:active{filter:brightness(1.08)}
  #fx .cm{display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-family:'IBM Plex Mono';font-size:9.5px}
  #fx .cm span{color:var(--mut)} #fx .cm b{color:var(--ink);display:block}

  #fx .book{position:sticky;top:6px;display:flex;flex-direction:column;gap:1px;font-family:'IBM Plex Mono';font-size:9px;min-width:0}
  #fx .book .bh{display:flex;justify-content:space-between;color:var(--mut);font-size:8px;padding:0 2px 3px}
  #fx .book .rw{position:relative;display:flex;justify-content:space-between;gap:4px;padding:1.5px 3px;overflow:hidden;white-space:nowrap}
  #fx .book .rw .bar{position:absolute;top:0;bottom:0;right:0;opacity:.14}
  #fx .book .rw.a .bar{background:var(--down)} #fx .book .rw.b .bar{background:var(--up)}
  #fx .book .rw.a .p{color:var(--down)} #fx .book .rw.b .p{color:var(--up)}
  #fx .book .rw .p,#fx .book .rw .q{position:relative;z-index:1} #fx .book .rw .q{color:var(--mut)}
  #fx .book .md{text-align:center;padding:4px 0;font-weight:800;font-size:12.5px;border-block:1px solid var(--line);margin:1px 0}
  #fx .book .md.up{color:var(--up)} #fx .book .md.dn{color:var(--down)}
  #fx .book .ratio{display:flex;height:16px;border-radius:5px;overflow:hidden;margin-top:4px;font-size:8.5px;font-weight:700}
  #fx .book .ratio b{display:grid;place-items:center;color:#fff} #fx .book .ratio .bb{background:var(--up)} #fx .book .ratio .ss{background:var(--down)}

  #fx .btabs{display:flex;gap:14px;border-bottom:1px solid var(--line);margin-top:14px}
  #fx .btabs button{background:none;border:none;color:var(--mut);font-weight:700;font-size:12px;padding:0 0 9px;position:relative;white-space:nowrap}
  #fx .btabs button.on{color:var(--ink)} #fx .btabs button.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--gold)}
  #fx .brow{display:flex;align-items:center;justify-content:space-between;padding:10px 2px}
  #fx .brow .solo{display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--ink)}
  #fx .brow .all{padding:6px 11px;border:1px solid var(--line);border-radius:8px;color:var(--ink);font-family:'IBM Plex Mono';font-size:10.5px;background:var(--card)}
  #fx .bbody{padding:6px 2px 24px;font-family:'IBM Plex Mono';font-size:12px;color:var(--mut)}
  #fx .bempty{text-align:center;padding:26px 0}
  #fx .prow{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.04);color:var(--ink);font-size:11px}
  #fx .prow .side{font-weight:800} #fx .prow .side.long{color:var(--up)} #fx .prow .side.short{color:var(--down)}
  #fx .prow .x{padding:5px 9px;border:1px solid rgba(246,70,93,.3);border-radius:7px;color:var(--down);background:rgba(246,70,93,.1);font-weight:700}

  .fxpop{position:fixed;inset:0;z-index:10350;display:flex;align-items:flex-end}
  .fxpop .bg{position:absolute;inset:0;background:rgba(3,5,7,.65);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
  .fxpop .c{position:relative;width:100%;background:#0e1218;border-top:1px solid #232b36;border-radius:20px 20px 0 0;padding:18px 16px calc(20px + env(safe-area-inset-bottom,0px))}
  .fxpop h4{margin:0 0 12px;text-align:center;font-weight:800;font-size:17px;color:#eef1f6}
  .fxpop .opt{display:block;width:100%;text-align:left;background:rgba(10,14,19,.6);border:1px solid #232b36;border-radius:13px;padding:13px;margin-bottom:9px;color:#eef1f6}
  .fxpop .opt.on{border-color:var(--mv-gold,#E8B84B);background:rgba(232,184,75,.08)}
  .fxpop .opt b{display:block;font-weight:800;font-size:15px;margin-bottom:4px} .fxpop .opt span{display:block;font-size:12px;line-height:1.5;color:#a9b2bd}
  `;
  document.head.appendChild(st);
}

function cache() { try { const c = JSON.parse(localStorage.getItem('mv-cg') || 'null'); return (c && c.d) || {}; } catch (_) { return {}; } }
async function logoUrl(p) {
  if (!p) return '';
  if (LOGO_ESP[p.id]) return LOGO_ESP[p.id];
  if (!p.cg) return '';
  const d = cache(); if (d[p.cg] && d[p.cg].img) return d[p.cg].img;
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${p.cg}`);
    if (r.ok) { const j = await r.json(); if (j[0]) { d[p.cg] = { img: j[0].image, price: j[0].current_price, chg: j[0].price_change_percentage_24h }; try { localStorage.setItem('mv-cg', JSON.stringify({ t: Date.now(), d })); } catch (_) {} return j[0].image; } }
  } catch (_) {}
  return '';
}

export async function pintarFuturos(host, api) {
  if (!host) return;
  estilos();
  if (!_pares.length) { try { const c = await import('../niveles/config.js?v=1'); _pares = (c.PARES || []).slice(); } catch (_) {} }
  if (!_par) _par = _pares.find((p) => p.id === 'BTC') || _pares[0] || { id: 'BTC', s: 'BTCUSDT', n: 'Bitcoin' };
  const TYP = { market: 'Mercado', limit: 'Límite', trigger: 'Activador' };

  host.innerHTML = `
  <div id="fx">
    <div class="hd">
      <div class="coin" id="fx-coin"><span class="lg" id="fx-lg">${esc(_par.id.slice(0, 3))}</span><b id="fx-sym">${esc(_par.s)}</b><span class="cv">▼</span></div>
      <span class="px" id="fx-hpx">—</span>
      <div class="ics">
        <button id="fx-hist" title="${t('Historial')}">${IC.clock}</button>
        <button id="fx-chart" title="${t('Gráfica')}">${IC.candles}</button>
      </div>
    </div>

    <div class="main">
      <div class="form">
        <div class="r2"><button id="fx-mode">${t('Cruzada')} <span class="cv">▾</span></button><button id="fx-lev"><b id="fx-levv">${_lev}×</b> <span class="cv">▾</span></button></div>
        <div class="oc"><button class="on" data-oc="abierto">${t('Abierto')}</button><button data-oc="cerrado">${t('Cerrado')}</button></div>
        <div class="typ" id="fx-typ"><button class="cur" id="fx-typcur">${t('Mercado')} <span class="cv">▾</span></button>
          <div class="menu"><button class="on" data-t="market">${t('Mercado')}</button><button data-t="limit">${t('Límite')}</button><button data-t="trigger">${t('Activador')}</button></div></div>
        <div class="avbl"><span>${t('Disponible')}</span><b id="fx-avbl">0.0000 USDT</b></div>
        <div><div class="lbl">${t('Precio')}</div><div class="fld"><input id="fx-price" inputmode="decimal" placeholder="—" disabled><span class="u">USDT</span></div></div>
        <div><div class="lbl">${t('Cantidad')}</div><div class="fld"><input id="fx-amt" inputmode="decimal" placeholder="${t('Orden mínima')}"><span class="u">USDT</span></div></div>
        <div class="pct"><input type="range" id="fx-pct" min="0" max="100" step="25" value="0"><div class="mk"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div></div>
        <div class="tpsl" id="fx-tpsl-t"><span class="chk" id="fx-chk"></span><span>TP/SL</span></div>
        <div class="tpsl-box" id="fx-tpsl-b">
          <div class="fld"><input id="fx-tp" inputmode="decimal" placeholder="Take-profit"><span class="u">USDT</span></div>
          <div class="fld"><input id="fx-sl" inputmode="decimal" placeholder="Stop-loss"><span class="u">USDT</span></div>
        </div>
        <button class="go long" id="fx-long">${t('Abrir Largo')}</button>
        <button class="go short" id="fx-short">${t('Abrir Corto')}</button>
        <div class="cm"><span>${t('Coste')} (USDT)<b id="fx-cl">0.0</b></span><span>${t('Coste')} (USDT)<b id="fx-cs">0.0</b></span><span>${t('Máximo')} (USDT)<b id="fx-ml">0.0</b></span><span>${t('Máximo')} (USDT)<b id="fx-ms">0.0</b></span></div>
      </div>
      <div class="book" id="fx-book"></div>
    </div>

    <div class="btabs"><button class="on" data-b="pos">${t('Posiciones')} (<span id="fx-npos">0</span>)</button><button data-b="ord">${t('Órdenes abiertas')} (0)</button></div>
    <div class="brow"><label class="solo"><span class="chk" id="fx-solo"></span>${t('Solo actual')}</label><button class="all" id="fx-all">${t('Cerrar todo')}</button></div>
    <div class="bbody" id="fx-bbody"></div>
  </div>`;

  const $ = (id) => document.getElementById(id);
  let _lado = 'long', _solo = false, _tab = 'pos', _saldo = 0;

  async function ponerLogo() { const u = await logoUrl(_par); const el = $('fx-lg'); if (!el) return; if (u) { el.style.backgroundImage = `url(${u})`; el.textContent = ''; } else { el.style.backgroundImage = ''; el.textContent = _par.id.slice(0, 3); } }
  ponerLogo();

  /* Libro de órdenes en vivo (WebSocket Binance, igual que Spot). */
  function renderBook() {
    const el = $('fx-book'); if (!el) return;
    const asks = _libro.asks.slice(0, 9).reverse(), bids = _libro.bids.slice(0, 9);
    const maxV = Math.max(1, ...asks.map((r) => r[1]), ...bids.map((r) => r[1]));
    const row = (r, c) => `<div class="rw ${c}"><span class="bar" style="width:${(r[1] / maxV * 100).toFixed(0)}%"></span><span class="p">${fmtP(r[0])}</span><span class="q">${fmtQ(r[1])}</span></div>`;
    const sb = bids.reduce((a, r) => a + r[1], 0), sa = asks.reduce((a, r) => a + r[1], 0), tot = sb + sa || 1;
    const pb = Math.round(sb / tot * 100), ps = 100 - pb;
    el.innerHTML = `<div class="bh"><span>${t('Precio')}</span><span>${t('Cant.')}</span></div>` + asks.map((r) => row(r, 'a')).join('') +
      `<div class="md ${(_libro.chg || 0) >= 0 ? 'up' : 'dn'}">${fmtP(_libro.precio)}</div>` + bids.map((r) => row(r, 'b')).join('') +
      `<div class="ratio"><b class="bb" style="flex:${pb}">B ${pb}%</b><b class="ss" style="flex:${ps}">${ps}% S</b></div>`;
  }
  function conectarLibro() {
    if (!_par) return;
    if (_ws && _wsPar === _par.s && (_ws.readyState === 0 || _ws.readyState === 1)) { renderBook(); return; }
    if (_ws) { try { _ws.close(); } catch (_) {} }
    _wsPar = _par.s;
    try {
      _ws = new WebSocket(`wss://stream.binance.com:9443/ws/${_par.s.toLowerCase()}@depth20@100ms`);
      _ws.onmessage = (ev) => { try { const j = JSON.parse(ev.data); if (j.asks) _libro.asks = j.asks.map((x) => [+x[0], +x[1]]); if (j.bids) _libro.bids = j.bids.map((x) => [+x[0], +x[1]]); renderBook(); } catch (_) {} };
    } catch (_) {}
  }
  conectarLibro(); renderBook();

  async function tick() {
    if (!_par) return;
    try { const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${_par.s}`); if (r.ok) { const j = await r.json(); _libro.precio = +j.lastPrice; _libro.chg = +j.priceChangePercent; } } catch (_) {}
    const hp = $('fx-hpx'); if (hp) { hp.textContent = fmtP(_libro.precio); hp.className = 'px ' + ((_libro.chg || 0) >= 0 ? 'up' : 'dn'); }
    if (_tipo === 'market' && $('fx-price')) $('fx-price').placeholder = fmtP(_libro.precio);
    renderBook(); calc(); pintarPos();
  }
  tick(); const iv = setInterval(tick, 3000);
  host._limpiar = () => { clearInterval(iv); if (_ws) { try { _ws.close(); } catch (_) {} _ws = null; _wsPar = null; } };

  function calc() {
    const amt = parseFloat(($('fx-amt').value || '').replace(/,/g, '')) || 0;
    $('fx-cl').textContent = amt ? amt.toFixed(2) : '0.0'; $('fx-cs').textContent = amt ? amt.toFixed(2) : '0.0';
    $('fx-ml').textContent = _saldo ? (_saldo * _lev).toFixed(2) : '0.0'; $('fx-ms').textContent = _saldo ? (_saldo * _lev).toFixed(2) : '0.0';
  }

  function pop(titulo, items, onPick) {
    const ov = document.createElement('div'); ov.className = 'fxpop';
    ov.innerHTML = '<div class="bg"></div><div class="c"><h4>' + t(titulo) + '</h4>' + items.map((it) => '<button class="opt' + (it.on ? ' on' : '') + '" data-v="' + (it.v || '') + '"><b>' + t(it.b) + '</b><span>' + t(it.s) + '</span></button>').join('') + '</div>';
    document.body.appendChild(ov);
    ov.querySelector('.bg').onclick = () => ov.remove();
    ov.querySelectorAll('.opt').forEach((o) => o.onclick = () => { if (onPick) onPick(o.dataset.v); ov.remove(); });
  }

  $('fx-coin').onclick = () => abrirPicker(t('Elige un par'), _pares, (id) => {
    _par = _pares.find((x) => x.id === id) || _par;
    $('fx-sym').textContent = _par.s; ponerLogo();
    _libro = { asks: [], bids: [], precio: null, chg: null }; conectarLibro(); tick();
  });
  $('fx-hist').onclick = () => abrirHistorialMovil();
  $('fx-chart').onclick = () => { try { api && api.abrirGrafica ? api.abrirGrafica(_par.id) : (api && api.abrir && api.abrir('levels')); } catch (_) {} };

  $('fx-mode').onclick = () => pop('Modo de margen', [
    { b: 'Aislada', s: 'El margen de esta posición está separado del resto. Si se liquida, solo pierdes lo asignado a ella.', on: _modo === 'aislada', v: 'aislada' },
    { b: 'Cruzada', s: 'Todo tu saldo respalda la posición. Aguanta más, pero puedes perder todo el saldo disponible.', on: _modo === 'cruzada', v: 'cruzada' }
  ], (v) => { _modo = v; $('fx-mode').innerHTML = t(v === 'aislada' ? 'Aislada' : 'Cruzada') + ' <span class="cv">▾</span>'; });
  $('fx-lev').onclick = () => pop('Apalancamiento', [5, 10, 20, 50, 100, 200].map((x) => ({ b: x + '×', s: x <= 10 ? 'Riesgo bajo.' : x <= 20 ? 'Riesgo medio. Recomendado.' : x <= 50 ? 'Riesgo alto.' : 'Riesgo extremo.', on: _lev === x, v: '' + x })), (v) => { _lev = +v; $('fx-levv').textContent = _lev + '×'; calc(); });
  host.querySelectorAll('.oc button').forEach((b) => b.onclick = () => {
    _oc = b.dataset.oc; host.querySelectorAll('.oc button').forEach((x) => x.classList.toggle('on', x === b));
    pop('Abierto / Cerrado', [{ b: 'Abierto', s: 'Abre una posición nueva en largo o corto con el capital y apalancamiento que definas.', on: _oc === 'abierto' }, { b: 'Cerrado', s: 'Cierra una posición que ya tienes abierta, tomando la ganancia o pérdida acumulada.', on: _oc === 'cerrado' }]);
  });
  const typ = $('fx-typ');
  $('fx-typcur').onclick = (e) => { e.stopPropagation(); typ.classList.toggle('open'); };
  document.addEventListener('click', () => typ.classList.remove('open'));
  host.querySelectorAll('.typ .menu button').forEach((b) => b.onclick = () => {
    _tipo = b.dataset.t; host.querySelectorAll('.typ .menu button').forEach((x) => x.classList.toggle('on', x === b));
    $('fx-typcur').innerHTML = t(TYP[_tipo]) + ' <span class="cv">▾</span>'; typ.classList.remove('open');
    const pr = $('fx-price'); pr.disabled = _tipo === 'market'; pr.placeholder = _tipo === 'market' ? fmtP(_libro.precio) : '0.00';
    if (_tipo === 'trigger') pop('Orden Activador', [{ b: '¿Qué es?', s: 'Una orden que solo se activa cuando el precio alcanza el nivel que marcas. Hasta entonces queda en espera.', on: true }, { b: 'Para qué sirve', s: 'Entrar automáticamente si el mercado llega a cierto precio, sin estar pendiente de la pantalla.' }]);
  });
  $('fx-amt').oninput = calc;
  $('fx-pct').oninput = (e) => { if (_saldo > 0) { $('fx-amt').value = (_saldo * (+e.target.value) / 100).toFixed(2); calc(); } };
  $('fx-tpsl-t').onclick = () => { const on = $('fx-chk').classList.toggle('on'); $('fx-tpsl-b').classList.toggle('on', on); };

  function abrir(lado) {
    _lado = lado;
    const amt = parseFloat(($('fx-amt').value || '').replace(/,/g, '')) || 0;
    if (!amt) { const f = $('fx-amt'); f.focus(); f.closest('.fld').style.borderColor = 'var(--down)'; setTimeout(() => { f.closest('.fld').style.borderColor = ''; }, 1200); return; }
    const px = (_tipo !== 'market' && parseFloat($('fx-price').value)) || _libro.precio || 0; if (!px) return;
    const esL = lado === 'long';
    _pos.push({ id: Date.now(), sim: _par.s, lado, px, amt, lev: _lev, tp: parseFloat($('fx-tp').value) || 0, sl: parseFloat($('fx-sl').value) || 0, liq: liqDe(px, _lev, esL) });
    pintarPos();
  }
  $('fx-long').onclick = () => abrir('long');
  $('fx-short').onclick = () => abrir('short');
  $('fx-all').onclick = () => { _pos = []; pintarPos(); };
  $('fx-solo').parentElement.onclick = () => { _solo = !_solo; $('fx-solo').classList.toggle('on', _solo); pintarPos(); };
  host.querySelectorAll('.btabs button').forEach((b) => b.onclick = () => { _tab = b.dataset.b; host.querySelectorAll('.btabs button').forEach((x) => x.classList.toggle('on', x === b)); pintarPos(); });

  function pintarPos() {
    const np = $('fx-npos'); if (np) np.textContent = _pos.length;
    const body = $('fx-bbody'); if (!body) return;
    if (_tab === 'ord') { body.innerHTML = '<div class="bempty">' + t('No tienes órdenes abiertas.') + '</div>'; return; }
    const ps = _solo ? _pos.filter((p) => p.sim === _par.s) : _pos;
    if (!ps.length) { body.innerHTML = '<div class="bempty">' + t('No tienes posiciones abiertas.') + '</div>'; return; }
    body.innerHTML = ps.map((p) => '<div class="prow"><span><span class="side ' + p.lado + '">' + p.sim + ' ' + (p.lado === 'long' ? 'LONG' : 'SHORT') + ' ' + p.lev + '×</span><br><span style="color:var(--mut)">' + t('Entrada') + ' ' + fmtP(p.px) + ' · ' + t('Liq.') + ' ' + fmtP(p.liq) + '</span></span><span>' + fmtP(p.amt * p.lev) + ' USDT</span><button class="x" data-id="' + p.id + '">' + t('Cerrar') + '</button></div>').join('');
    body.querySelectorAll('.x').forEach((b) => b.onclick = () => { _pos = _pos.filter((p) => p.id !== +b.dataset.id); pintarPos(); });
  }
  calc(); pintarPos();
}
