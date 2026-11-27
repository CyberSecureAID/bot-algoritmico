/* movil/operar.js — Pantalla 3 (Operar). Panel de trading al estilo de un
   exchange, pero SPOT y no custodial: sin apalancamiento. Muestra precio y
   libro de órdenes en vivo (Binance), selector de moneda, Market/Limit, y
   Comprar/Vender. La ejecución real se enruta a lo que ya existe:
   · Market  → Swap (compra/venta al momento).
   · Limit   → Smart Levels (poner orden a un precio).
   Accesos arriba: mini-gráfica, bots, velas (Smart Levels) y ⋮ (Herramientas). */

import { IC } from './iconos.js?v=1';
import { t } from '../idioma.js?v=164';
import { abrirPicker } from './picker.js?v=1';
import { abrirAlerta } from './alerta.js?v=1';
import { precio as fmtPrecio, money, cantidad, logoDe } from './fmt.js?v=3';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LOGO_ESP = { EUR: 'https://flagcdn.com/w80/eu.png', GBP: 'https://flagcdn.com/w80/gb.png', PAXG: 'https://assets.coingecko.com/coins/images/9519/small/paxgold.png' };

let _pares = [];
let _par = null;          // par actual
let _tipo = 'market';     // market | limit
let _lado = null;         // solo para resaltar
let _quote = 'USDT';
let _libro = { asks: [], bids: [], precio: null, chg: null };
let _timer = null;
let _ws = null;
let _wsPar = null;                 // par al que está conectado el WS (para reutilizar)
let _api = null;

/* ── Lógica de Spot COMPARTIDA con la web (contrato SpotDF + keeper). Carga perezosa.
   El móvil usa la MISMA lógica que Spot web; solo cambia cómo se ve. ── */
let _spC = null, _spK = null;
async function _spotContrato() { if (!_spC) _spC = await import('../../../modules/spot/contrato.js?v=12'); return _spC; }
async function _spotKeeper() { if (!_spK) _spK = await import('../../../modules/spot/keeper-spot.js?v=7'); return _spK; }
let _spM = null;
async function _spotMotor() { if (!_spM) _spM = await import('../../../modules/spot/motor.js?v=15'); return _spM; }   // MISMO motor que Spot web (posiciones compartidas)
function _errMovil(e) { const m = String((e && (e.reason || e.shortMessage || e.message)) || e); if (/user rejected|rejected the request|denied/i.test(m)) return 'You cancelled the transaction.'; if (/insufficient/i.test(m)) return 'Not enough balance or allowance.'; return m.slice(0, 120); }

export async function pintarOperar(host, api) {
  _api = api;
  if (!_pares.length) { try { const c = await import('../niveles/config.js?v=1'); _pares = (c.PARES || []).slice(); } catch (_) { _pares = []; } }
  if (!_par) _par = _pares.find((p) => p.id === 'BNB') || _pares.find((p) => p.id === 'BTC') || _pares[0];

  host.innerHTML = `
    <div class="op-head">
      <button class="op-sel" id="op-sel">
        <span class="op-logo" id="op-logo"></span>
        <b id="op-sym">${esc(_par ? _par.s : 'BTCUSDT')}</b>
        ${chev()}
      </button>
      <div class="op-acts">
        <button class="op-ic" id="op-alert" title="Alerta de precio">${IC.bell}</button>
        <button class="op-ic" id="op-chart" title="Gráficas (Liquidity Pools)">${IC.candles}</button>
        <button class="op-ic" id="op-bots" title="Bots">${IC.bot}</button>
        <button class="op-ic" id="op-tools" title="Herramientas">${IC.dots}</button>
      </div>
    </div>
    <div class="op-subhead">
      <span class="op-tag">Spot</span>
      <span class="op-price" id="op-price">—</span>
      <span class="op-chg" id="op-chg"></span>
    </div>

    <div class="op-grid">
      <div class="op-book" id="op-book"></div>
      <div class="op-form">
        <div class="op-ol">
          <button class="op-olt on" data-ol="market">Market</button>
          <button class="op-olt" data-ol="limit">Limit</button>
        </div>
        <div class="op-field" id="op-field-price" style="display:none">
          <span>Precio</span><input id="op-in-price" inputmode="decimal" placeholder="0.00"><b>${esc(_quote)}</b>
        </div>
        <div class="op-field">
          <span>Amount</span><input id="op-in-amt" inputmode="decimal" placeholder="0.00">
          <button class="op-qsel" id="op-qsel">${esc(_quote)} ${chev(10)}</button>
        </div>
        <input class="op-range" id="op-range" type="range" min="0" max="100" value="0">
        <div class="op-pcts">${[25, 50, 75, 100].map((p) => `<button data-p="${p}">${p}%</button>`).join('')}</div>
        <button class="op-sltoggle" id="op-sltoggle"><span>Stop-loss <em>(optional)</em></span><i>▾</i></button>
        <div class="op-field op-slbox" id="op-slbox" style="display:none">
          <span>Stop</span><input id="op-in-sl" inputmode="decimal" placeholder="0.00"><b>${esc(_quote)}</b>
        </div>
        <div class="op-avail" id="op-avail">${t('Disponible')}: — ${esc(_quote)}</div>
        <button class="op-buy" id="op-buy">Buy</button>
        <button class="op-sell" id="op-sell">Sell</button>
      </div>
    </div>

    <div class="op-tabs">
      <button class="op-tab on" data-pt="pos">Posición</button>
      <button class="op-tab" data-pt="ord">Mis órdenes</button>
      <button class="op-tab" data-pt="bots">Bots</button>
      <button class="op-histbtn" id="op-hist" title="Historial de operaciones" aria-label="Historial de operaciones"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h4"/></svg></button>
    </div>
    <div class="op-panel" id="op-panel"></div>
  `;

  // Cabecera
  $('op-sel').onclick = () => selectorMoneda();
  $('op-chart').onclick = () => api.abrir('liquidity');   // Charts → Liquidity Pools
  $('op-bots').onclick = () => api.abrir('bots');
  $('op-tools').onclick = () => api.abrir('tools');
  $('op-alert').onclick = () => abrirAlerta(_par);
  if ($('op-hist')) $('op-hist').onclick = () => abrirHistorialMovil();
  ponerLogo();

  // Slider % y stop-loss
  const slider = $('op-range');
  const aplicarPct = (pct) => {
    const b = _api && _api.balance && _api.balance();
    const a = b && b.activos && b.activos.find((x) => x.id === _quote);
    const disp = a ? a.bal : 0;
    const amt = disp * (pct / 100);
    const inp = $('op-in-amt');
    if (inp) inp.value = amt > 0 ? String(+amt.toFixed(6)) : '';
  };
  if (slider) slider.oninput = () => aplicarPct(+slider.value);
  host.querySelectorAll('.op-pcts button').forEach((b) => b.onclick = () => { const p = +b.getAttribute('data-p'); if (slider) slider.value = p; aplicarPct(p); });
  const slt = $('op-sltoggle'); if (slt) slt.onclick = () => { const box = $('op-slbox'); const ab = box.style.display === 'none'; box.style.display = ab ? '' : 'none'; slt.classList.toggle('on', ab); };

  // Si se llegó desde Smart Levels con un lado, se resalta el botón.
  if (_lado === 'sell') { const s = $('op-sell'); if (s) s.style.outline = '2px solid var(--mv-down)'; }
  else if (_lado === 'buy') { const s = $('op-buy'); if (s) s.style.outline = '2px solid var(--mv-up)'; }
  _lado = null;

  // Market/Limit
  host.querySelectorAll('.op-olt').forEach((b) => b.onclick = () => {
    _tipo = b.getAttribute('data-ol');
    host.querySelectorAll('.op-olt').forEach((x) => x.classList.toggle('on', x === b));
    $('op-field-price').style.display = _tipo === 'limit' ? '' : 'none';
  });
  $('op-qsel').onclick = () => selectorQuote();
  $('op-buy').onclick = () => operar('buy');
  $('op-sell').onclick = () => operar('sell');
  actualizarDisponible();

  // Posición / órdenes / bots
  host.querySelectorAll('.op-tab').forEach((b) => b.onclick = () => {
    host.querySelectorAll('.op-tab').forEach((x) => x.classList.toggle('on', x === b));
    pintarPanel(b.getAttribute('data-pt'));
  });
  pintarPanel('pos');

  renderBook();
  conectarLibro();
  cargarPrecio();
  clearInterval(_timer);
  _timer = setInterval(cargarPrecio, 3000);
  host._limpiar = () => { clearInterval(_timer); cerrarLibro(); restaurarBotCard(); };

  // Scroll: esta sección NO es Home, así que debe poder desplazarse.
  try {
    var _sc = document.getElementById('mv-scroll');
    if (_sc) { _sc.style.overflowY = 'auto'; _sc.style.touchAction = ''; _sc.style.webkitOverflowScrolling = 'touch'; }
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.overscrollBehavior = '';
    if (window.__mvMedir) window.__mvMedir();
  } catch (_) {}
}

function posGuardadas() { try { return JSON.parse(localStorage.getItem('mv-pos') || '[]'); } catch (_) { return []; } }
function posGuardar(l) { try { localStorage.setItem('mv-pos', JSON.stringify(l)); } catch (_) {} }
function _panelActivo() { try { return document.querySelector('.op-tab.on')?.getAttribute('data-pt') || ''; } catch (_) { return ''; } }

// CSS de las órdenes limit de Spot (tarjetas tipo futuros, con etiqueta SPOT).
// Se inyecta una sola vez. Clases propias (spot-ord-*) para NO chocar con nada.
function inyectarSpotOrdCss() {
  if (document.getElementById('spot-ord-css')) return;
  const css = `
    .spot-ord{background:rgba(255,255,255,.025);border:1px solid var(--mv-line);border-radius:11px;padding:11px;margin-bottom:9px}
    .spot-ord-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}
    .spot-ord-coin{display:inline-flex;align-items:center;gap:7px}
    .spot-ord-ci{width:24px;height:24px;flex:0 0 auto;border-radius:50%;background:var(--mv-card2) center/cover no-repeat;border:1px solid var(--mv-line);display:grid;place-items:center;font-size:9px;font-weight:800;color:var(--mv-gold)}
    .spot-ord-par{font-size:13px;font-weight:800;color:var(--mv-txt)}
    .spot-ord-lado{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:800;padding:2px 7px;border-radius:5px}
    .spot-ord-lado.c{color:var(--mv-up);background:color-mix(in srgb,var(--mv-up) 15%,transparent)}
    .spot-ord-lado.v{color:var(--mv-down);background:color-mix(in srgb,var(--mv-down) 15%,transparent)}
    .spot-ord-tag{font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:800;letter-spacing:.06em;color:var(--mv-gold);background:rgba(232,184,75,.1);border:1px solid rgba(232,184,75,.3);border-radius:6px;padding:3px 7px}
    .spot-ord-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px}
    .spot-ord-grid>div{display:flex;flex-direction:column;gap:2px}
    .spot-ord-grid label{font-size:8.5px;color:var(--mv-mut);text-transform:uppercase;letter-spacing:.04em}
    .spot-ord-grid b{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--mv-txt);font-weight:700}
    .spot-ord-pct.up{color:var(--mv-up)} .spot-ord-pct.dn{color:var(--mv-down)}
    .spot-ord-x{width:100%;font-size:11.5px;font-weight:700;color:var(--mv-down);background:color-mix(in srgb,var(--mv-down) 10%,transparent);border:1px solid color-mix(in srgb,var(--mv-down) 30%,transparent);border-radius:8px;padding:9px 0;cursor:pointer}
  `;
  const st = document.createElement('style'); st.id = 'spot-ord-css'; st.textContent = css; document.head.appendChild(st);
}

async function pintarPanel(t) {
  const el = $('op-panel'); if (!el) return;
  const con = _api && _api.estaConectado && _api.estaConectado();
  if (t === 'bots') {
    if (!con) { restaurarBotCard(); el.innerHTML = `<div class="op-empty">Connect your wallet to see your active bots.</div>`; return; }
    el.innerHTML = `<div class="op-loading"><span class="op-spin"></span>Loading your bots…</div>`;
    reflejarBotsReales(el);
    return;
  }
  restaurarBotCard();
  if (t === 'ord') {
    if (!con) { el.innerHTML = `<div class="op-empty">Conecta tu wallet para ver tus órdenes.</div>`; return; }
    inyectarSpotOrdCss();
    // 1) Órdenes límite REALES de SpotDF (nuevas; las dispara el keeper). Misma lógica que Spot web.
    let lims = [];
    try { const K = await _spotKeeper(); lims = await K.reconciliarLimites(); } catch (_) {}
    // 2) Órdenes de gridbot (1 nivel) que ya tuvieras: se siguen mostrando hasta que se llenen/cancelen.
    let ordenes = [];
    try {
      const o = await import('../orden.js?v=126');
      const w = await import('../wallet.js?v=129');
      const cuenta = w.cuentaActual && w.cuentaActual();
      if (o.sincronizarOrdenes && cuenta) await o.sincronizarOrdenes(cuenta);
      if (o.ordenesPuestas) ordenes = (o.ordenesPuestas() || []).filter((x) => x.modo !== 'aviso' && x.botId != null);
    } catch (_) {}
    if (!lims.length && !ordenes.length) { el.innerHTML = `<div class="op-empty">You have no open limit orders.<br><span style="font-size:12px">Place one from the Limit tab.</span></div>`; return; }
    const cache = (() => { try { const c = JSON.parse(localStorage.getItem('mv-cg') || 'null'); return (c && c.d) || {}; } catch (_) { return {}; } })();
    // Tarjeta SpotDF: reusa EXACTAMENTE tu mismo diseño .spot-ord del móvil.
    const cardSpot = (l) => {
      const base = l.par || ''; const logo = logoDe(base, null, cache); const esVenta = l.lado === 'short';
      return `<div class="spot-ord ${esVenta ? 'v' : 'c'}">
        <div class="spot-ord-top">
          <span class="spot-ord-coin">
            <span class="spot-ord-ci" style="${logo ? `background-image:url(${logo});background-size:cover` : ''}">${logo ? '' : esc(String(base).slice(0, 3))}</span>
            <b class="spot-ord-par">${esc(l.simbolo || base)}</b>
            <span class="spot-ord-lado ${esVenta ? 'v' : 'c'}">${esVenta ? 'SELL' : 'BUY'}</span>
          </span>
          <span class="spot-ord-tag">SPOT · LIMIT</span>
        </div>
        <div class="spot-ord-grid">
          <div><label>Precio</label><b>${fmtP(l.objetivo)}</b></div>
          <div><label>Monto</label><b>${cantidad(l.amount)} USDT</b></div>
          <div><label>Estado</label><b style="color:var(--mv-gold)">armed</b></div>
        </div>
        <button class="spot-ord-x" data-lim="${esc(String(l.id))}">Cancelar</button>
      </div>`;
    };
    el.innerHTML = lims.map(cardSpot).join('') + ordenes.map((o, i) => {
      const base = o.base || String(o.par || '').replace(/USDT$|USDC$|BUSD$|USD$|FDUSD$/i, '');
      const logo = logoDe(base, o.cg || null, cache);
      const esVenta = !!o.vender;
      const lado = esVenta ? 'SELL' : 'BUY';
      return `<div class="spot-ord ${esVenta ? 'v' : 'c'}">
        <div class="spot-ord-top">
          <span class="spot-ord-coin">
            <span class="spot-ord-ci" style="${logo ? `background-image:url(${logo});background-size:cover` : ''}">${logo ? '' : esc(String(o.par || '').slice(0, 3))}</span>
            <b class="spot-ord-par">${esc(o.par || '')}</b>
            <span class="spot-ord-lado ${esVenta ? 'v' : 'c'}">${lado}</span>
          </span>
          <span class="spot-ord-tag">SPOT · LIMIT</span>
        </div>
        <div class="spot-ord-grid">
          <div><label>Precio</label><b>${fmtP(o.precio)}</b></div>
          <div><label>Cantidad</label><b>${o.cant ? cantidad(o.cant) + ' ' + esc(o.quote === o.base ? '' : 'USDT') : '—'}</b></div>
          <div><label>Distancia</label><b class="spot-ord-pct" data-par="${esc(o.par || '')}" data-precio="${o.precio}" data-vender="${esVenta ? 1 : 0}">—</b></div>
        </div>
        <button class="spot-ord-x" data-i="${i}">Cancelar</button>
      </div>`;
    }).join('');
    // Distancia % con el precio actual (solo gridbot)
    el.querySelectorAll('.spot-ord-pct').forEach(async (span) => {
      const par = span.getAttribute('data-par'), precio = +span.getAttribute('data-precio'), vender = span.getAttribute('data-vender') === '1';
      try {
        const sym = (par || '').replace('/', '');
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
        if (!r.ok) return; const actual = +(await r.json()).price;
        if (!(actual > 0)) return;
        const pct = vender ? ((precio - actual) / actual) * 100 : ((actual - precio) / actual) * 100;
        span.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        span.className = 'spot-ord-pct ' + (vender ? 'up' : 'dn');
      } catch (_) {}
    });
    // Cancelar: SpotDF (on chain + keeper) por data-lim; gridbot por data-i.
    el.querySelectorAll('.spot-ord-x[data-lim]').forEach((b) => b.onclick = async () => {
      const id = b.getAttribute('data-lim'); el.innerHTML = `<div class="op-loading"><span class="op-spin"></span>Cancelling…</div>`;
      try { const K = await _spotKeeper(); await K.cancelarLimiteSpotFull(id); } catch (e) { mensaje('Error', _errMovil(e)); }
      pintarPanel('ord');
    });
    el.querySelectorAll('.spot-ord-x[data-i]').forEach((b) => b.onclick = () => cancelarOrden(ordenes[+b.getAttribute('data-i')], el));
    return;
  }
  // Posición: posiciones REALES de SpotDF (el MISMO motor que Spot web). Cerrar = on chain.
  if (!con) { el.innerHTML = `<div class="op-empty">Conecta tu wallet para ver tu posición.</div>`; return; }
  let MM = null; try { MM = await _spotMotor(); } catch (_) {}
  // Importa las posiciones REALES on chain que falten (p.ej. las que abre el keeper al disparar una
  // orden límite, o abiertas desde otro dispositivo), con la MISMA lógica compartida que la web.
  // Aditiva y sin duplicados. Sin esto, una posición de un límite disparado quedaba invisible.
  try { if (MM) { const K = await _spotKeeper(); await K.sincronizarPosiciones(MM); } } catch (_) {}
  const pos = MM ? MM.posiciones() : [];
  if (!pos.length) { el.innerHTML = `<div class="op-empty">No positions. When you open at market from here, your entry shows up with its live profit.</div>`; return; }
  const _precios = await _preciosDePosiciones(pos);   // precio en vivo por par (no solo el mostrado)
  el.innerHTML = pos.map((p) => {
    const actual = _precios[p.par] || ((p.par === _par.id && _libro.precio) ? _libro.precio : p.entrada);
    const info = MM.pnlDe(p, actual);
    const cls = info.pnl >= 0 ? 'up' : 'dn';
    const estado = p.cerrando ? `<em style="color:var(--mv-gold);font-size:9.5px;margin-left:4px">closing…</em>` : (p.pend ? `<em style="color:var(--mv-gold);font-size:9.5px;margin-left:4px">confirming…</em>` : '');
    const prev = (p.chainId == null && !p.pend) ? `<em style="color:#8aa0b5;font-size:9px;border:1px solid var(--mv-line);border-radius:4px;padding:0 4px;margin-left:4px">PREVIEW</em>` : '';
    const ladoC = p.lado === 'long' ? 'var(--mv-up)' : 'var(--mv-down)';
    const pnlTxt = info.denom === 'USDT'
      ? (info.pnl >= 0 ? '+' : '') + (money ? money(info.pnl) : info.pnl.toFixed(2))
      : (info.pnl >= 0 ? '+' : '') + info.pnl.toFixed(6) + ' ' + esc(info.denom);
    return `<div class="op-item">
      <div><b>${esc(p.par)} <span style="font-size:10px;font-weight:800;color:${ladoC}">${p.lado.toUpperCase()}</span>${estado}${prev}</b><small>Entry ${fmtP(p.entrada)} · ${money ? money(p.amount) : p.amount} USDT</small></div>
      <div style="text-align:right"><span class="${cls}">${pnlTxt}</span>
      <button class="op-del" data-close="${esc(p.id)}"${(p.pend || p.cerrando) ? ' disabled style="opacity:.55"' : ''}>${p.cerrando ? 'Closing…' : (p.pend ? 'Confirming…' : 'Close')}</button></div>
    </div>`;
  }).join('');
  el.querySelectorAll('.op-del[data-close]').forEach((b) => b.onclick = () => _cerrarMovil(b.getAttribute('data-close'), b));
}

/* Cierra una posición de SpotDF desde el móvil: on chain (la firma el usuario), con tu diseño.
   Una posición de vista previa (sin id on chain) solo limpia el registro, no mueve fondos. */
async function _cerrarMovil(id, btn, forzar) {
  let M;
  try {
    M = await _spotMotor();
    const p = M.posiciones().find((x) => x.id === id); if (!p) return;
    if (p.chainId == null) { M.cerrar(id, _libro.precio || p.entrada, 'manual'); pintarPanel('pos'); return; }
    if (btn) btn.disabled = true; M.marcarCerrando(id, true); pintarPanel('pos');
    const C = await _spotContrato();
    mensaje('Close', 'Confirm the close in your wallet…');
    let refMk = (p.par === _par.id && _libro.precio) ? _libro.precio : 0;   // precio real del par para la guarda de salida
    if (!(refMk > 0)) { try { const mp = await _preciosDePosiciones([p]); refMk = mp[p.par] || 0; } catch (_) {} }
    const env = await C.cerrarMercadoSpot({ id: p.chainId, slippageBps: 100, refPrice: refMk, forzar: !!forzar });
    (async () => {
      try {
        const rec = await env.tx.wait();
        if (rec && Number(rec.status) === 0) throw new Error('reverted');
        try { const K = await _spotKeeper(); await K.cancelarOrden(p.chainId); } catch (_) {}   // cancela su TP/SL del keeper SOLO con el cierre confirmado
        M.cerrar(id, _libro.precio || p.entrada, 'manual'); if (_panelActivo() === 'pos') pintarPanel('pos');
      } catch (_) { M.marcarCerrando(id, false); if (_panelActivo() === 'pos') pintarPanel('pos'); mensaje('Close', 'The close did not confirm; your position stays open and protected.'); }
    })();
  } catch (e) {
    try { if (M) { M.marcarCerrando(id, false); pintarPanel('pos'); } } catch (_) {}
    const em = String((e && (e.reason || e.shortMessage || e.message)) || e);
    if (/already closed|not open|no esta abierta/i.test(em)) {
      // Ya estaba cerrada on chain (el keeper ganó la carrera): finaliza también aquí para que no
      // quede una posición fantasma en pantalla.
      try { if (M) { M.cerrar(id, _libro.precio || 0, 'auto'); pintarPanel('pos'); } } catch (_) {}
      mensaje('Close', 'This position was already closed on-chain.');
      return;
    }
    if (e && e.message === 'POOL_MALO_SALIDA') {
      // Salida a mal precio por pool ilíquido/podrido: NO cerrar en silencio. Avisar y dejar que el
      // usuario decida (igual que la web). Nunca atrapar a quien de verdad necesita salir.
      const pct = (e.desvPct != null) ? Math.round(e.desvPct) : '?';
      _confirmar('Bad exit price', `This coin's on-chain pool looks illiquid: closing now would be about ${pct}% worse than the real market price. Close anyway?`, 'Close anyway', () => _cerrarMovil(id, null, true));
      return;
    }
    mensaje('Close', _errMovil(e));
  }
}

/* Cancela una orden limit: cancela el bot de 1 nivel on-chain (libera cupo y no
   queda colgada) y quita el registro local. */
async function cancelarOrden(o, el) {
  if (!o) return;
  if (el) el.innerHTML = `<div class="op-loading"><span class="op-spin"></span>Cancelling the order…</div>`;
  try {
    const gb = await import('../gridbot.js?v=125');
    const w = await import('../wallet.js?v=129');
    const cuenta = w.cuentaActual && w.cuentaActual();
    if (cuenta && o.base && o.quote && o.botId != null && gb.claveBot && gb.cancelarRejillaK) {
      const clave = gb.claveBot(cuenta, o.base, o.quote, o.botId);
      await gb.cancelarRejillaK(clave);         // cancela el bot on-chain (libera cupo)
    }
  } catch (_) {}
  try { const ordn = await import('../orden.js?v=126'); if (ordn.cancelar) ordn.cancelar(o.id); } catch (_) {}
  pintarPanel('ord');
}

/* Muestra en Operar, INLINE (abajo), la MISMA sección real "Mis bots" de la web
   (con sus tarjetas .rej, cápsulas, botones y dinámica). Reubica el nodo vivo y
   clona SOLO el CSS de las tarjetas (descendientes de #colmena-app) re-apuntado
   a #op-panel — NO el contenedor de la portada (eso causaba el fondo negro). */
let _botCard = null;
function reflejarBotsReales(el) {
  const web = document.getElementById('colmena-app');
  const card = web && web.querySelector('.colmenas.card');
  if (!card) { el.innerHTML = `<div class="op-empty">Open the bots section once to load them.<br><button class="op-link" id="op-crear">Go to bots</button></div>`; const c = el.querySelector('#op-crear'); if (c) c.onclick = () => _api.abrir('bots'); return; }
  clonarEstilosBots();
  if (!card._mvPh) { const ph = document.createComment('mv-bots'); card._mvPh = ph; card.parentNode.insertBefore(ph, card); }
  el.innerHTML = '';
  el.appendChild(card);
  _botCard = card;
}
export function restaurarBotCard() {
  if (_botCard && _botCard._mvPh && _botCard._mvPh.parentNode) _botCard._mvPh.parentNode.insertBefore(_botCard, _botCard._mvPh);
  _botCard = null;
}
/* Copia SOLO las reglas que apuntan a DESCENDIENTES de #colmena-app (las de las
   tarjetas de bots) + sus @media, re-apuntadas a #op-panel. Salta la regla del
   contenedor #colmena-app{...} (fondo/altura) que rompía el layout, y salta mis
   propias inyecciones (id que empieza por 'mv-'). */
function clonarEstilosBots() {
  if (document.getElementById('mv-botcss')) return;
  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    const owner = sheet.ownerNode;
    if (owner && owner.id && owner.id.indexOf('mv-') === 0) continue;
    let reglas; try { reglas = sheet.cssRules; } catch (_) { continue; }
    if (!reglas) continue;
    for (const rule of Array.from(reglas)) {
      try {
        const txt = rule.cssText;
        if (!txt || txt.indexOf('#colmena-app') === -1) continue;
        if (rule.type === 4) { css += txt.replace(/#colmena-app/g, '#op-panel') + '\n'; continue; }  // @media
        const sel = txt.split('{')[0];
        if (!/#colmena-app\s*[>~+\s]\s*[^\s{]/.test(sel)) continue;   // solo descendientes, no el contenedor
        css += txt.replace(/#colmena-app/g, '#op-panel') + '\n';
      } catch (_) {}
    }
  }
  // Además, dentro de Operar la tarjeta debe verse limpia y responsiva.
  css += `#op-panel .colmenas.card{background:none!important;border:0!important;padding:0!important;margin:0!important;box-shadow:none!important}
    #op-panel .mb-cab h3{font-size:16px!important}
    #op-panel .rej{margin-top:12px!important}`;
  const s = document.createElement('style'); s.id = 'mv-botcss'; s.textContent = css; document.head.appendChild(s);
}

function renderBook() {
  const el = $('op-book'); if (!el) return;
  const asks = _libro.asks.slice(0, 6).reverse();
  const bids = _libro.bids.slice(0, 6);
  const maxV = Math.max(1, ...asks.map((r) => r[1]), ...bids.map((r) => r[1]));
  if (!el._built) {
    el.innerHTML = `<div class="op-bk-h"><span>Price</span><span>Amount</span></div>`
      + Array.from({ length: 6 }, () => `<div class="op-row ask"><span class="op-bar"></span><em></em><i></i></div>`).join('')
      + `<div class="op-bk-mid">—</div>`
      + Array.from({ length: 6 }, () => `<div class="op-row bid"><span class="op-bar"></span><em></em><i></i></div>`).join('');
    el._built = true;
  }
  const rows = el.querySelectorAll('.op-row');
  const fill = (start, data) => {
    for (let i = 0; i < 6; i++) {
      const row = rows[start + i]; if (!row) continue;
      const r = data[i];
      if (!r) { row.style.visibility = 'hidden'; continue; }
      row.style.visibility = '';
      row.querySelector('.op-bar').style.width = Math.min(100, (r[1] / maxV) * 100) + '%';
      row.querySelector('em').textContent = fmtP(r[0]);
      row.querySelector('i').textContent = fmtQ(r[1]);
    }
  };
  fill(0, asks); fill(6, bids);
  const mid = el.querySelector('.op-bk-mid');
  const vacio = !asks.length && !bids.length;   // libro aún sin datos (ej. al cambiar de moneda)
  if (mid) {
    if (vacio) { mid.textContent = 'Loading order book\u2026'; mid.className = 'op-bk-mid load'; }
    else { mid.textContent = _libro.precio == null ? '\u2014' : fmtP(_libro.precio); mid.className = 'op-bk-mid ' + (_libro.chg >= 0 ? 'up' : 'dn'); }
  }
}

/* Libro de órdenes en vivo por WebSocket (fluido, ~10 updates/seg).
   Idempotente: si ya está conectado (o conectando) a ESTE mismo par, no lo
   reabre — así el precargado desde Home se reutiliza y el libro sale al
   instante al entrar a Operar. Solo reconecta si cambió la moneda. */
function conectarLibro() {
  if (!_par) return;
  if (_ws && _wsPar === _par.s && (_ws.readyState === 0 || _ws.readyState === 1)) { renderBook(); return; }
  cerrarLibro();
  _wsPar = _par.s;
  try {
    _ws = new WebSocket(`wss://stream.binance.com:9443/ws/${_par.s.toLowerCase()}@depth20@100ms`);
    _ws.onmessage = (ev) => {
      try { const j = JSON.parse(ev.data);
        if (j.asks) _libro.asks = j.asks.map((x) => [+x[0], +x[1]]);
        if (j.bids) _libro.bids = j.bids.map((x) => [+x[0], +x[1]]);
        renderBook();
      } catch (_) {}
    };
  } catch (_) {}
}
function cerrarLibro() { if (_ws) { try { _ws.close(); } catch (_) {} _ws = null; } _wsPar = null; }

/* PRECARGA (llamada desde Home): abre el libro y pide el precio del par por
   defecto EN SEGUNDO PLANO, sin tocar el DOM. Cuando el usuario entra a Operar,
   los datos ya están calientes y renderBook los muestra al instante. Todo va en
   try/catch: si algo falla, no afecta a Home ni a nada más. */
export async function precargarOperar() {
  try {
    if (!_pares.length) { const c = await import('../niveles/config.js?v=1'); _pares = (c.PARES || []).slice(); }
    if (!_par) _par = _pares.find((p) => p.id === 'BNB') || _pares.find((p) => p.id === 'BTC') || _pares[0];
    if (!_par) return;
    conectarLibro();     // abre (o reutiliza) el WS → _libro se va llenando solo
    cargarPrecio();      // precio/cambio por REST (sus escrituras al DOM no-op si no existe)
  } catch (_) {}
}

async function cargarPrecio() {
  if (!_par) return;
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${_par.s}`);
    if (r.ok) { const j = await r.json(); _libro.precio = +j.lastPrice; _libro.chg = +j.priceChangePercent; }
  } catch (_) {}
  const pr = $('op-price'), ch = $('op-chg');
  if (pr) pr.textContent = _libro.precio == null ? '—' : fmtP(_libro.precio);
  if (ch && _libro.chg != null) { ch.textContent = (_libro.chg >= 0 ? '+' : '') + _libro.chg.toFixed(2) + '%'; ch.className = 'op-chg ' + (_libro.chg >= 0 ? 'up' : 'dn'); }
  renderBook();
}

async function operar(lado) {
  // ¿Se puede comerciar esta moneda en la plataforma?
  let ok = true;
  try { const o = await import('../orden.js?v=126'); if (o.sePuedeOperar) ok = await o.sePuedeOperar(_par.id); } catch (_) {}
  if (!ok) { mensaje('Solo para análisis', `${_par.id} is available to analyze on the charts, but cannot be traded on the platform.`); return; }
  // Al vender, ¿tiene saldo de esa moneda?
  if (lado === 'sell') {
    const b = _api.balance && _api.balance();
    const tiene = b && b.activos && b.activos.find((a) => a.id === _par.id && a.bal > 0);
    if (b && b.conectado && !tiene) { mensaje(t('Sin saldo'), `${t('No tienes')} ${_par.id} ${t('en tu wallet para vender.')}`); return; }
  }
  if (_tipo === 'market') {
    // MARKET: posición REAL por SpotDF (misma lógica que Spot web), con tu diseño móvil. Si no hay
    // wallet o la moneda no es operable on chain, cae al Swap como antes (no se pierde esa vía).
    if (!(_api.estaConectado && _api.estaConectado())) { _api.abrir('swap'); return; }
    const amt = parseFloat(($('op-in-amt') || {}).value) || 0;
    if (!(amt > 0)) { mensaje(t('Monto'), 'Enter an amount first.'); return; }
    const parObj = { id: _par.id, simbolo: _par.s, coin: _par.id };
    const bb = $('op-buy'), ss = $('op-sell');
    let C;
    try { C = await _spotContrato(); } catch (_) {}
    if (!C || !C.operableOnchain(parObj)) { _api.abrir('swap'); return; }   // moneda no operable: Swap como antes
    const ladoSpot = lado === 'sell' ? 'short' : 'long';
    const slPx = parseFloat(($('op-in-sl') || {}).value) || 0;
    const markClic = _libro.precio || 0;
    try {
      if (bb) bb.disabled = true; if (ss) ss.disabled = true;
      mensaje(ladoSpot === 'long' ? 'Long' : 'Short', 'Confirm the transaction in your wallet…');
      const env = await C.abrirMercadoSpot({ par: parObj, lado: ladoSpot, pagar: _quote === 'BNB' ? 'BNB' : 'USDT', monto: amt, slippageBps: 100, floorOut: 0, refPrice: markClic });
      const M = await _spotMotor();
      const r = M.abrirMercado(_par.id, _par.id, ladoSpot, (env.costoUsdt > 0 ? env.costoUsdt : amt), markClic, null, slPx > 0 ? slPx : null, null, true);
      mensaje(ladoSpot === 'long' ? 'Long enviado' : 'Short enviado', 'Confirming on-chain…');
      const inA = $('op-in-amt'); if (inA) inA.value = '';
      pintarPanel('pos');
      const posId = r.ok ? r.pos.id : null;
      (async () => {
        try {
          const rec = await env.tx.wait();
          if (rec && Number(rec.status) === 0) throw new Error('reverted');
          let cid = null; try { cid = await C.idDeRecibo(rec); } catch (_) {}
          if (posId && cid != null) {
            M.setChainId(posId, cid);
            if (slPx > 0) { try { const K = await _spotKeeper(); await K.armarOrden({ chainId: cid, par: _par.id, lado: ladoSpot, tp: null, sl: slPx }); } catch (_) {} }
          } else if (posId && cid == null) { /* minó pero sin id legible: se queda 'pend', se sincroniza al reabrir */ }
        } catch (err) {
          if (posId && err && err.message === 'reverted') { try { (await _spotMotor()).eliminar(posId); } catch (_) {} }
        }
        try { if (_panelActivo() === 'pos') pintarPanel('pos'); } catch (_) {}
      })();
    } catch (e) { mensaje('Error', _errMovil(e)); }
    finally { if (bb) bb.disabled = false; if (ss) ss.disabled = false; }
  } else {
    // LIMIT: orden REAL on chain por SpotDF (misma lógica que Spot web) + armada en el worker.
    // Se mantiene el diseño móvil; solo cambia lo que hace el botón (antes iba a Smart Levels).
    if (!(_api.estaConectado && _api.estaConectado())) { mensaje('Wallet', 'Connect your wallet first.'); return; }
    if (_quote !== 'USDT') { mensaje('Limit', 'Las órdenes límite se fondean en USDT. Cambia la moneda de pago a USDT.'); return; }
    const amt = parseFloat(($('op-in-amt') || {}).value) || 0;
    const precio = parseFloat(($('op-in-price') || {}).value) || 0;
    if (!(amt > 0)) { mensaje(t('Monto'), 'Enter an amount first.'); return; }
    if (!(precio > 0)) { mensaje('Limit', 'Enter a target price.'); return; }
    const parObj = { id: _par.id, simbolo: _par.s, coin: _par.id };
    const bb = $('op-buy'), ss = $('op-sell');
    try {
      const C = await _spotContrato();
      if (!C.operableOnchain(parObj)) { mensaje('Only for analysis', `${_par.id} cannot be traded on-chain yet.`); return; }
      if (bb) bb.disabled = true; if (ss) ss.disabled = true;
      mensaje('Limit', 'Confirm in your wallet (approve + create + arm)…');
      const K = await _spotKeeper();
      await K.ponerLimiteSpot({ par: parObj, lado: lado === 'sell' ? 'short' : 'long', montoUsdt: amt, objetivo: precio, markActual: _libro.precio || 0, slippageBps: 100 });
      mensaje(lado === 'buy' ? 'Limit buy armed' : 'Limit sell armed', 'The keeper opens it when price hits.');
      const inA = $('op-in-amt'), inP = $('op-in-price'); if (inA) inA.value = ''; if (inP) inP.value = '';
      pintarPanel('ord');
    } catch (e) { mensaje('Error', _errMovil(e)); }
    finally { if (bb) bb.disabled = false; if (ss) ss.disabled = false; }
  }
}


/* Mensaje responsive (no bloqueante), reutiliza el toast de la cáscara. */
function mensaje(t, s) {
  let d = document.getElementById('mv-toast');
  if (!d) { d = document.createElement('div'); d.id = 'mv-toast'; document.body.appendChild(d); }
  d.innerHTML = `<b>${esc(t)}</b><br><span>${esc(s)}</span>`;
  d.classList.add('show');
  clearTimeout(d._t); d._t = setTimeout(() => d.classList.remove('show'), 3200);
}

/* Confirmación simple (dos botones). Para decisiones como forzar un cierre cuando el pool está
   ilíquido: nunca atrapar a quien necesita salir, pero avisar antes del mal precio. */
function _confirmar(titulo, sub, okLabel, onOk) {
  document.getElementById('mv-confirm')?.remove();
  const d = document.createElement('div'); d.id = 'mv-confirm';
  d.style.cssText = 'position:fixed;inset:0;z-index:10400;display:flex;align-items:flex-end;justify-content:center';
  d.innerHTML = `<div class="mvc-bg" style="position:absolute;inset:0;background:rgba(0,0,0,.6)"></div>
    <div style="position:relative;width:100%;max-width:460px;background:linear-gradient(180deg,#12161c,#0b0e12);border-top:1px solid #2b3139;border-radius:18px 18px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom,0px));animation:mhUp .2s ease both">
      <b style="display:block;font-size:16px;color:var(--mv-gold,#E8B84B);margin-bottom:6px">${esc(titulo)}</b>
      <span style="display:block;font-size:13px;color:#b7c0cb;line-height:1.5;margin-bottom:16px">${esc(sub)}</span>
      <div style="display:flex;gap:10px">
        <button class="mvc-no" style="flex:1;padding:12px;border-radius:11px;border:1px solid var(--mv-line,#2b3139);background:transparent;color:#c7ced6;font-weight:700;font-size:14px">Cancel</button>
        <button class="mvc-yes" style="flex:1;padding:12px;border-radius:11px;border:0;background:var(--mv-down,#f6465d);color:#fff;font-weight:800;font-size:14px">${esc(okLabel || 'OK')}</button>
      </div>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => d.remove();
  d.querySelector('.mvc-bg').onclick = cerrar;
  d.querySelector('.mvc-no').onclick = cerrar;
  d.querySelector('.mvc-yes').onclick = () => { cerrar(); try { onOk && onOk(); } catch (_) {} };
}

/* Precio en vivo por par para las posiciones (no solo el par mostrado): así el PnL de una
   posición en otra moneda no se queda clavado en la entrada. Usa el ticker de Binance (reescrito
   al espejo por el feed-shim) en una sola llamada por lote. Falla en silencio. */
async function _preciosDePosiciones(pos) {
  const out = {};
  try {
    if (_par && _libro.precio > 0) out[_par.id] = _libro.precio;
    const syms = [...new Set((pos || []).map((p) => p.par))]
      .map((id) => { const pc = _pares.find((x) => x.id === id); return (pc && pc.s && !(out[id] > 0)) ? { id, s: pc.s } : null; })
      .filter(Boolean);
    if (!syms.length) return out;
    const lista = JSON.stringify(syms.map((x) => x.s));
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(lista)}`);
    if (r.ok) {
      const arr = await r.json(); const bySym = {};
      (Array.isArray(arr) ? arr : []).forEach((t) => { bySym[t.symbol] = +t.price; });
      syms.forEach((x) => { if (bySym[x.s] > 0) out[x.id] = bySym[x.s]; });
    }
  } catch (_) {}
  return out;
}

/* Llegada desde Smart Levels: fija la moneda y el lado antes de mostrar Operar. */
export function prepararOperar(parId, lado) {
  const set = (list) => { const p = (list || []).find((x) => x.id === parId); if (p) _par = p; _lado = lado || null; _libro = { asks: [], bids: [], precio: null, chg: null }; };
  if (_pares.length) set(_pares);
  else { import('../niveles/config.js?v=1').then((c) => { _pares = (c.PARES || []).slice(); set(_pares); }).catch(() => {}); }
}

function selectorMoneda() {
  abrirPicker('Elige un par', _pares, (id) => {
    _par = _pares.find((x) => x.id === id) || _par;
    _libro = { asks: [], bids: [], precio: null, chg: null };
    pintarOperar(document.getElementById('mv-scroll'), _api);
  });
}
function actualizarDisponible() {
  const el = $('op-avail'); if (!el) return;
  const b = _api && _api.balance && _api.balance();
  if (!b || !b.conectado) { el.textContent = `${t('Disponible')}: — ${esc(_quote)}`; return; }
  const a = (b.activos || []).find((x) => x.id === _quote);
  el.textContent = `${t('Disponible')}: ${a ? cantidad(a.bal) : '0'} ${esc(_quote)}`;
}

function selectorQuote() {
  const quotes = [
    { id: 'USDT', n: 'Tether', cg: 'tether' },
    { id: 'USDC', n: 'USD Coin', cg: 'usd-coin' },
    { id: 'BNB', n: 'BNB', cg: 'binancecoin' },
  ];
  abrirPicker('Payment coin', quotes, (id) => {
    _quote = id;
    const q = $('op-qsel'); if (q) q.innerHTML = `${esc(_quote)} ${chev(10)}`;
    actualizarDisponible();
  });
}

function ponerLogo() {
  const el = $('op-logo'); if (!el || !_par) return;
  const url = LOGO_ESP[_par.id] || (_par.cg ? '' : '');
  if (url) { el.style.backgroundImage = `url(${url})`; return; }
  if (!_par.cg) { el.textContent = _par.id.slice(0, 1); return; }
  // CoinGecko (cache compartida con Mercados)
  try {
    const c = JSON.parse(localStorage.getItem('mv-cg') || 'null');
    if (c && c.d && c.d[_par.cg] && c.d[_par.cg].img) { el.style.backgroundImage = `url(${c.d[_par.cg].img})`; return; }
  } catch (_) {}
  el.textContent = _par.id.slice(0, 1);
}

function fmtP(p) { p = +p; if (!isFinite(p)) return '—'; if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 1 }); if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 3 }); return p.toLocaleString('en-US', { maximumFractionDigits: 6 }); }
function fmtQ(q) { q = +q; if (!isFinite(q)) return ''; if (q >= 1000) return (q / 1000).toFixed(1) + 'K'; if (q >= 1) return q.toFixed(2); return q.toFixed(4); }
function chev(sz) { const s = sz || 12; return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.4" style="vertical-align:middle"><path d="M6 9l6 6 6-6"/></svg>`; }

/* ═══════════════════════════════════════════════════════════════════
   HISTORIAL DE OPERACIONES (móvil) — hoja inferior estilo exchange.
   Icono a la derecha de las pestañas. Lee la cadena, dos sectores,
   lista acotada (sin scroll infinito). No toca las pestañas.
   ═══════════════════════════════════════════════════════════════════ */
function fechaRel(ts) {
  if (!ts) return '';
  const s = Math.max(1, Math.floor(Date.now() / 1000) - Number(ts));
  if (s < 60) return 'hace ' + s + 's';
  if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
  if (s < 2592000) return 'hace ' + Math.floor(s / 86400) + ' d';
  return new Date(Number(ts) * 1000).toLocaleDateString('es');
}

export async function abrirHistorialMovil() {
  document.getElementById('mh-sheet')?.remove();
  if (!document.getElementById('mh-css')) {
    const st = document.createElement('style'); st.id = 'mh-css';
    st.textContent = `
    #mh-sheet{position:fixed;inset:0;z-index:10300;display:flex;flex-direction:column;justify-content:flex-end}
    #mh-sheet .mh-bg{position:absolute;inset:0;background:rgba(0,0,0,.6);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
    #mh-sheet .mh-c{position:relative;background:linear-gradient(180deg,#12161c,#0b0e12);border-top-left-radius:20px;border-top-right-radius:20px;border-top:1px solid #2b3139;height:80vh;max-height:88vh;display:flex;flex-direction:column;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));animation:mhUp .22s ease both}
    @keyframes mhUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    #mh-sheet .mh-grip{width:38px;height:4px;border-radius:3px;background:#39424c;margin:10px auto 4px}
    #mh-sheet .mh-head{display:flex;align-items:center;justify-content:space-between;padding:6px 18px 10px}
    #mh-sheet .mh-tit{font-family:var(--mv-display,system-ui);font-weight:800;font-size:17px;color:var(--mv-gold,#E8B84B)}
    #mh-sheet .mh-x{background:rgba(255,255,255,.06);border:0;color:#c7ced6;width:30px;height:30px;border-radius:9px;font-size:14px}
    #mh-sheet .mh-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:2px 14px 24px}
    #mh-sheet .mh-carga,#mh-sheet .mh-vacio{padding:30px;text-align:center;color:#7d8794;font-size:13px}
    #mh-sheet .mh-sect{font-family:ui-monospace,monospace;font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.9px;margin:16px 2px 8px;display:flex;align-items:center;gap:8px}
    #mh-sheet .mh-sect i{flex:1;height:1px;background:rgba(255,255,255,.08)}
    #mh-sheet .mh-row{display:flex;align-items:center;gap:11px;padding:11px 12px;margin:6px 0;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
    #mh-sheet .mh-tag{flex:0 0 auto;font-family:var(--mv-display,system-ui);font-weight:800;font-size:10px;letter-spacing:.4px;padding:4px 8px;border-radius:7px}
    #mh-sheet .mh-tag.c{background:rgba(46,232,106,.13);color:#39e07a;border:1px solid rgba(46,232,106,.35)}
    #mh-sheet .mh-tag.v{background:rgba(246,70,93,.13);color:#ff6b7d;border:1px solid rgba(246,70,93,.35)}
    #mh-sheet .mh-info{flex:1;min-width:0}
    #mh-sheet .mh-par{font-family:var(--mv-display,system-ui);font-weight:700;font-size:14px;color:#eef2f6}
    #mh-sheet .mh-meta{font-family:ui-monospace,monospace;font-size:11px;color:#7d8794;margin-top:2px}
    #mh-sheet .mh-meta b{color:#dfe5ec;font-weight:700}
    #mh-sheet .mh-fecha{flex:0 0 auto;font-family:ui-monospace,monospace;font-size:10.5px;color:#5a6570}
    #mh-sheet .mh-mas{display:block;text-align:center;margin-top:14px;font-size:11.5px;color:var(--mv-gold,#E8B84B);text-decoration:none}`;
    document.head.appendChild(st);
  }
  const d = document.createElement('div'); d.id = 'mh-sheet';
  d.innerHTML = `<div class="mh-bg"></div>
    <div class="mh-c">
      <div class="mh-grip"></div>
      <div class="mh-head"><div class="mh-tit">Historial de operaciones</div><button class="mh-x" id="mh-x" aria-label="Cerrar">✕</button></div>
      <div class="mh-body" id="mh-body"><div class="mh-carga">Reading your trades on the blockchain…</div></div>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => d.remove();
  d.querySelector('.mh-bg').onclick = cerrar;
  d.querySelector('#mh-x').onclick = cerrar;

  const body = d.querySelector('#mh-body');
  let gb, cuenta;
  try {
    gb = await import('../gridbot.js?v=125');
    const w = await import('../wallet.js?v=129');
    cuenta = w.cuentaActual && w.cuentaActual();
  } catch (_) {}
  if (!cuenta) { body.innerHTML = `<div class="mh-vacio">Connect your wallet to see your history.</div>`; return; }

  let res;
  try { res = await gb.historialDe(cuenta); } catch (_) { res = { error: 'sin-historial', ops: [] }; }
  if (res.error === 'sin-historial') { body.innerHTML = `<div class="mh-vacio">Ahora mismo no se pudo leer el historial (la red va lenta). Inténtalo de nuevo en un momento.</div>`; return; }
  const ops = res.ops || [];
  if (!ops.length) { body.innerHTML = `<div class="mh-vacio">Todavía no tienes operaciones. Cuando un bot o una orden se ejecute, aparecerá aquí.</div>`; return; }

  let marcas = {};
  try { marcas = JSON.parse(localStorage.getItem('bot-pares') || '{}'); } catch (_) {}
  const esOrden = (k) => !!(marcas[k] && marcas[k].desdeGrafico);
  const simb = {};
  const simboloDe = async (addr) => {
    const k = String(addr).toLowerCase();
    if (simb[k]) return simb[k];
    try { simb[k] = (await gb.infoToken(addr)).simbolo; } catch (_) { simb[k] = '—'; }
    return simb[k];
  };
  const manuales = ops.filter((o) => esOrden(o.clave));
  const deBots = ops.filter((o) => !esOrden(o.clave));

  const fila = async (o) => {
    const sb = await simboloDe(o.base), sq = await simboloDe(o.quoteAddr);
    const dp = o.precio < 1 ? 6 : (o.precio >= 1000 ? 1 : 3);
    return `<div class="mh-row">
      <span class="mh-tag ${o.compra ? 'c' : 'v'}">${o.compra ? 'COMPRA' : 'VENTA'}</span>
      <div class="mh-info">
        <div class="mh-par">${esc(sb)}/${esc(sq)}</div>
        <div class="mh-meta">Precio <b>${(+o.precio).toLocaleString('en-US', { maximumFractionDigits: dp })}</b> · <b>${(+o.cantidad).toLocaleString('en-US', { maximumFractionDigits: 6 })}</b> ${esc(sb)}</div>
      </div>
      <div class="mh-fecha">${fechaRel(o.tiempo)}</div>
    </div>`;
  };
  const sector = async (titulo, lista) => `<div class="mh-sect">${titulo} <i></i></div>` +
    (lista.length ? (await Promise.all(lista.slice(0, 25).map(fila))).join('') : `<div class="mh-vacio" style="padding:14px">None for now.</div>`);

  body.innerHTML =
    (await sector('Tus órdenes limit', manuales)) +
    (await sector('Operaciones de bots', deBots)) +
    `<a class="mh-mas" href="https://bscscan.com/address/${cuenta}" target="_blank" rel="noopener">See the full history on BscScan ↗</a>`;
}
