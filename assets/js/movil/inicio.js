/* movil/inicio.js — Pantalla 1 (Inicio). */

import { IC } from './iconos.js?v=1';
import * as wallet from '../wallet.js?v=125';
import { money, money0, cantidad, logoDe } from './fmt.js?v=1';

const $ = (id) => document.getElementById(id);
const LS = { ojo: 'mv-ojo', denom: 'mv-denom' };

const QUICK = [
  { k: 'sell',      ic: 'market', t: 'P2P' },
  { k: 'swap',      ic: 'swap',   t: 'Swap' },
  { k: 'bots',      ic: 'bot',    t: 'Bots', tag: 'HOT' },
  { k: 'liquidity', ic: 'pool',   t: 'Liquidity' },
  { k: 'academy',   ic: 'book',   t: 'Academia', tag: 'TOP' },
];

const PROMOS = [
  { ic: 'book',   t: 'Academia CriptoCuba', s: 'Aprende a operar y multiplica tu ventaja', go: 'academy' },
  { ic: 'trophy', t: 'Prize Pool comunitario', s: 'Participa y gana del fondo común', go: 'prize' },
  { ic: 'bot',    t: 'Bots que operan por ti', s: 'Compran abajo y venden arriba, en tu wallet', go: 'bots' },
  { ic: 'tools',  t: 'Herramientas', s: 'Calculadoras y utilidades para operar mejor', go: 'tools' },
];

/* TODOS los servicios pasan por las tarjetas. Iconos y colores REALES (los de
   la web para los bots). */
const SERVICIOS = [
  { go: 'bots',      color: '#4d9fff', ic: 'botGrid', kick: 'Smart Grid',      h: 'Gana en el rango',   p: 'Compra y vende en niveles; cierra cada cuadrícula solo en ganancia.' },
  { go: 'bots',      color: '#b47cff', ic: 'botAcum', kick: 'Acumulador',      h: 'Compra en caídas',   p: 'Compra por tramos cuando baja y arma posición sin que estés pendiente.' },
  { go: 'bots',      color: '#e8b84b', ic: 'botCash', kick: 'Cash Out',        h: 'Asegura ganancia',   p: 'Vende lo que ya tienes al precio o % que elijas.' },
  { go: 'bots',      color: '#34d97b', ic: 'botDca',  kick: 'DCA',             h: 'A intervalos',       p: 'Compra cantidades fijas cada cierto tiempo para promediar tu entrada.' },
  { go: 'liquidity', color: '#2ebd85', ic: 'pool',    kick: 'Liquidity',       h: 'Profundidad',        p: 'Mira dónde está la liquidez y los muros del mercado.' },
  { go: 'muros',     color: '#f6465d', ic: 'candles', kick: 'INS Radar',       h: 'Flujo órdenes',      p: 'Detecta la mano fuerte: órdenes grandes y absorción.' },
  { go: 'niveles',   color: '#E8B84B', ic: 'chart',   kick: 'Smart Levels',    h: 'Analiza y opera',    p: 'Niveles, indicadores y compra/venta al toque en la gráfica.' },
  { go: 'academy',   color: '#4c8dff', ic: 'book',    kick: 'Academia',        h: 'Aprende',            p: 'Formación paso a paso para sacarle ventaja al mercado.' },
  { go: 'swap',      color: '#2ebd85', ic: 'swap',    kick: 'Swap',            h: 'Al momento',         p: 'Cambia cualquier cripto por otra, sin KYC y no custodial.' },
  { go: 'market',    color: '#E8B84B', ic: 'market',  kick: 'Marketplace',     h: 'Compra P2P',         p: 'Órdenes de compra y venta entre personas, con garantía.' },
  { go: 'prize',     color: '#f6465d', ic: 'trophy',  kick: 'Prize Pool',      h: 'Fondo común',        p: 'Participa y gana del pozo acumulado de la comunidad.' },
];

let _ojo = leer(LS.ojo) === '1';
let _denom = 'Total';   // siempre inicia en Total

function leer(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function guardar(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

export function pintarInicio(host, api) {
  const con = api.estaConectado();

  host.innerHTML = `
    <div class="mv-top">
      <button class="mv-ava" id="mv-ava" aria-label="Perfil">
        ${IC.user}
        <i class="mv-ava-dot ${con ? 'on' : ''}"></i>
      </button>
      <div class="mv-search" id="mv-search"><span class="mv-search-ic">${IC.search}</span><span class="mv-search-ph">Busca servicios, ofertas, monedas…</span></div>
      <button class="mv-ico-btn" id="mv-support" aria-label="Soporte">${IC.support}</button>
      <button class="mv-ico-btn" id="mv-alerts" aria-label="Alertas">${IC.bell}</button>
    </div>

    <div class="mv-bal-lbl" id="mv-bal-lbl">Balance total ${IC.eye}</div>
    <div class="mv-bal-row">
      <span class="mv-bal" id="mv-bal">—</span>
      <button class="mv-denom-in" id="mv-denom">${_denom} ${chev()}</button>
      <span class="mv-wlogo" id="mv-wlogo"></span>
    </div>
    <div class="mv-bal-sub" id="mv-bal-sub">${con ? '' : 'Conecta tu wallet para ver tu saldo'}</div>

    <div class="mv-cta">
      <button class="mv-primary" id="mv-add">Agregar fondos</button>
      <button class="mv-second" id="mv-trade">Operar</button>
    </div>

    <div class="mv-quick" id="mv-quick">
      ${QUICK.map((q) => `
        <div class="mv-qi" data-k="${q.k}">
          <div class="mv-qbox">${IC[q.ic] || ''}${q.tag ? `<span class="mv-qtag">${q.tag}</span>` : ''}</div>
          <span>${q.t}</span>
        </div>`).join('')}
    </div>

    ${con ? '' : `
    <div class="mv-connect">
      <p><b>Exchange no custodial.</b> Tú controlas tus fondos siempre. Conecta tu wallet para operar, crear bots e intercambiar.</p>
      <button id="mv-connect-btn">Conectar wallet</button>
    </div>`}

    <div class="mv-strip" id="mv-strip">
      <div class="mv-strip-ic" id="mv-strip-ic">${IC.book}</div>
      <div class="mv-strip-tx"><b id="mv-strip-t">—</b><small id="mv-strip-s">—</small></div>
      <button class="mv-strip-go" id="mv-strip-go">Ver</button>
    </div>

    <div class="mv-sec-h"><b>Todos los servicios</b><span id="mv-viewall">Ver todo →</span></div>
    <div class="mv-svc"><div class="mv-svc-track" id="mv-svc-track"></div></div>

    <div class="mv-sec-h"><b>Prize Pool</b><span id="mv-prize-more">Ver →</span></div>
    <div class="mv-strip" id="mv-prize-strip">
      <div class="mv-strip-ic">${IC.trophy}</div>
      <div class="mv-strip-tx"><b>Fondo comunitario</b><small>Participa y gana del pozo acumulado</small></div>
      <button class="mv-strip-go" id="mv-prize-go">Entrar</button>
    </div>
  `;

  $('mv-ava').onclick = () => api.abrir('perfil');
  $('mv-search').onclick = () => api.abrir('buscar');
  $('mv-support').onclick = () => api.abrir('soporte');
  $('mv-alerts').onclick = () => api.abrir('alertas');
  $('mv-add').onclick = () => api.abrir('recibir');
  $('mv-trade').onclick = () => api.irA('trade');
  const cb = $('mv-connect-btn'); if (cb) cb.onclick = () => api.conectar();
  host.querySelectorAll('.mv-qi').forEach((el) => { el.onclick = () => api.abrir(el.getAttribute('data-k')); });
  $('mv-prize-go').onclick = $('mv-prize-more').onclick = () => api.abrir('prize');
  $('mv-viewall').onclick = () => api.abrir('menu');

  // Balance: ojito + moneda seleccionada (Total o una moneda concreta)
  const pintarBal = () => {
    const b = api.balance();
    const bal = $('mv-bal'), sub = $('mv-bal-sub'), wl = $('mv-wlogo');
    // logo de la wallet conectada, junto al selector
    if (wl) {
      const wi = (con && wallet.walletInfo && wallet.walletInfo()) || null;
      const wlogo = wi && (wi.icon || wi.icono);
      wl.innerHTML = wlogo ? `<img src="${wlogo}" alt="">` : '';
    }
    if (!b || !b.conectado) { bal.textContent = '—'; sub.textContent = con ? '' : 'Conecta tu wallet para ver tu saldo'; return; }
    if (_ojo) { bal.textContent = '••••••'; sub.textContent = ''; return; }
    if (_denom === 'Total') {
      bal.textContent = money(b.totalUSD); sub.textContent = '';
    } else {
      const a = (b.activos || []).find((x) => x.id === _denom);
      const amt = a ? a.bal : 0, usd = a ? a.usd : 0;
      bal.innerHTML = `${cantidad(amt)} <small>${_denom}</small>`;
      sub.textContent = '≈ ' + money(usd);
    }
  };
  $('mv-bal-lbl').onclick = () => { _ojo = !_ojo; guardar(LS.ojo, _ojo ? '1' : '0'); pintarBal(); };
  $('mv-denom').onclick = () => menuDenom(api, () => { $('mv-denom').innerHTML = `${_denom} ${chev()}`; pintarBal(); });
  pintarBal();

  // Franja rotativa (promos)
  let pi = 0;
  const pintarPromo = () => {
    const p = PROMOS[pi % PROMOS.length];
    $('mv-strip-ic').innerHTML = IC[p.ic] || IC.book;
    $('mv-strip-t').textContent = p.t; $('mv-strip-s').textContent = p.s;
    $('mv-strip-go').onclick = (e) => { e.stopPropagation(); api.abrir(p.go); };
    $('mv-strip').onclick = () => api.abrir(p.go);
  };
  pintarPromo();
  const tPromo = setInterval(() => { pi++; pintarPromo(); }, 4500);

  // Todos los servicios: tira con MOVIMIENTO automático suave + arrastre/flick
  // con el dedo + tap para abrir. El toque se gestiona por eventos pointer (no
  // por el "click", que en un contenedor con scroll se pierde y obligaba a tocar
  // varias veces). Se renderiza una sola vez.
  const track = $('mv-svc-track');
  let pararCarrusel = null;
  if (track) {
    const card = (c) => `<button class="mv-svc-card" data-go="${c.go}" style="--bc:${c.color}">
      <span class="mv-svc-ic" style="color:${c.color}">${IC[c.ic] || IC.bot}</span>
      <b>${c.kick}</b></button>`;
    track.innerHTML = SERVICIOS.map(card).join('');
    pararCarrusel = montarCarrusel(track, api);
  }

  host._limpiar = () => { clearInterval(tPromo); if (pararCarrusel) pararCarrusel(); };
  host._pintarBal = pintarBal;
}

function menuDenom(api, cb) {
  const b = api.balance();
  const cache = (() => { try { const c = JSON.parse(localStorage.getItem('mv-cg') || 'null'); return (c && c.d) || {}; } catch (_) { return {}; } })();
  const opts = [{ id: 'Total', amt: null }];
  if (b && b.activos) b.activos.forEach((a) => opts.push({ id: a.id, amt: a.bal, cg: a.cg }));
  let m = document.getElementById('mv-denom-menu'); if (m) m.remove();
  m = document.createElement('div'); m.id = 'mv-denom-menu';
  m.innerHTML = `<div class="mv-dm-bg"></div><div class="mv-dm-card">
    <div class="mv-dm-h">Ver balance en</div>
    <div class="mv-dm-list">
    ${opts.map((o) => {
      const logo = o.id === 'Total' ? '' : logoDe(o.id, o.cg, cache);
      return `<button data-o="${o.id}" class="${o.id === _denom ? 'on' : ''}">
        <span class="mv-dm-lg" style="${logo ? `background-image:url(${logo})` : ''}">${o.id === 'Total' ? '∑' : (logo ? '' : esc3(o.id))}</span>
        <span>${o.id}</span>
        ${o.amt != null ? `<span class="mv-dm-amt">${cantidad(o.amt)}</span>` : ''}
      </button>`;
    }).join('')}
    </div>
  </div>`;
  document.body.appendChild(m);
  const cerrar = () => m.remove();
  m.querySelector('.mv-dm-bg').onclick = cerrar;
  m.querySelectorAll('[data-o]').forEach((b2) => b2.onclick = () => { _denom = b2.getAttribute('data-o'); guardar('mv-denom', _denom); cerrar(); cb(); });
}
function esc3(s) { return String(s || '').slice(0, 3); }

/* Carrusel de servicios: tres cosas a la vez, sin pelearse.
   1) MOVIMIENTO automático suave (vaivén), como estaba antes; se pausa en cuanto
      tocas y se reanuda solo al soltar.
   2) ARRASTRE/flick nativo con el dedo (el overflow-x del CSS).
   3) TAP para abrir el servicio, por eventos pointer (fiable): en un contenedor
      con scroll el navegador se come el "click" del primer toque, y por eso antes
      había que tocar y tocar. Aquí abrimos en el pointerup si fue un toque limpio.
   La animación "mantener pulsado" (.press) solo salta en pulsación real, no al
   deslizar. Intensidad sutil. */
function montarCarrusel(track, api) {
  const svc = track.parentElement;                 // .mv-svc (el que scrollea)
  const UMBRAL = 8;
  let card = null, sx = 0, sy = 0, movido = false, hold = null;

  // ── movimiento automático (vaivén suave) ──
  let auto = true, dir = 1, raf = 0, reanuda = 0, vivo = true;
  const paso = () => {
    if (!vivo) return;
    if (auto) {
      const max = svc.scrollWidth - svc.clientWidth;
      if (max > 2) {
        let n = svc.scrollLeft + dir * 0.5;
        if (n >= max) { n = max; dir = -1; }
        else if (n <= 0) { n = 0; dir = 1; }
        svc.scrollLeft = n;
      }
    }
    raf = requestAnimationFrame(paso);
  };
  const pausar = () => { auto = false; if (reanuda) { clearTimeout(reanuda); reanuda = 0; } };
  const reanudarPronto = () => { if (reanuda) clearTimeout(reanuda); reanuda = setTimeout(() => { auto = true; }, 2600); };

  const limpiarPress = () => { if (hold) { clearTimeout(hold); hold = null; } if (card) card.classList.remove('press'); };

  track.addEventListener('pointerdown', (e) => {
    pausar();                                       // cualquier toque para el vaivén
    const c = e.target.closest && e.target.closest('.mv-svc-card');
    if (!c) { card = null; return; }
    card = c; sx = e.clientX; sy = e.clientY; movido = false;
    hold = setTimeout(() => { if (card && !movido) card.classList.add('press'); }, 70);
  }, { passive: true });

  track.addEventListener('pointermove', (e) => {
    if (!card) return;
    if (Math.abs(e.clientX - sx) > UMBRAL || Math.abs(e.clientY - sy) > UMBRAL) {
      movido = true; limpiarPress();                // es scroll/flick → ya no es tap
    }
  }, { passive: true });

  track.addEventListener('pointerup', () => {
    if (card && !movido) {                          // toque limpio → abrir servicio
      const go = card.getAttribute('data-go');
      if (go) api.abrir(go);
    }
    limpiarPress(); card = null; reanudarPronto();
  }, { passive: true });

  ['pointercancel', 'pointerleave', 'lostpointercapture'].forEach((ev) =>
    track.addEventListener(ev, () => { limpiarPress(); card = null; reanudarPronto(); }, { passive: true }));

  svc.addEventListener('wheel', () => { pausar(); reanudarPronto(); }, { passive: true });

  // Arrancar cuando el layout tenga ancho real (si no, scrollWidth=clientWidth
  // y el vaivén no se vería). Se reintenta unas veces al montar.
  let intentos = 0;
  const arrancar = () => {
    const max = svc.scrollWidth - svc.clientWidth;
    if (max > 2 || intentos > 20) { auto = true; raf = requestAnimationFrame(paso); }
    else { intentos++; setTimeout(arrancar, 120); }
  };
  arrancar();
  return () => { vivo = false; if (raf) cancelAnimationFrame(raf); if (reanuda) clearTimeout(reanuda); if (hold) clearTimeout(hold); };
}

function valorEn(b, denom) {
  if (denom === 'USDT' || denom === 'USDC') return b.totalUSD;
  const p = b.precios && b.precios[denom];
  return p ? b.totalUSD / p : b.totalUSD;
}
function fmtDenom(v, denom) {
  v = Number(v) || 0;
  const dec = (denom === 'USDT' || denom === 'USDC') ? 2 : (v >= 1 ? 4 : 6);
  return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmt(v) { const n = Number(v); return isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'; }
function fmtAmt(v) { v = Number(v) || 0; if (v >= 1e9) return (v / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'B'; if (v >= 1e6) return (v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'M'; return v >= 1 ? v.toLocaleString('en-US', { maximumFractionDigits: 4 }) : v.toLocaleString('en-US', { maximumFractionDigits: 8 }); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function chev() { return '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" style="vertical-align:middle"><path d="M6 9l6 6 6-6"/></svg>'; }
