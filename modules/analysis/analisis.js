/* analisis.js. Entrada y catalogo del Analisis Profesional.
   ──────────────────────────────────────────────────────────────────────────
   FASE 1 (estetica): catalogo con la MISMA cinta superior de las secciones
   aprobadas (Swap/Launchpad/Terminal/Bots), copiada tal cual (no recreada),
   con Analysis iluminado entre Bots y Futures. Debajo, buscador funcional y
   dos filtros (Strategies / Indicators) con el mismo chip de Terminal. Rejilla
   de herramientas data-driven, tarjetas de igual alto/ancho con inclinacion 3D
   (la misma de Shield). Solo tema oscuro, paleta de la casa, particulas y
   fondo de la casa.

   Pendiente de fases siguientes (requieren contrato nuevo): valoracion 5
   estrellas + like/dislike on-chain, pago por servicio + carrito, colaboracion
   y disclaimer. Por eso la compuerta de cobro actual se mantiene de momento.

   Uso:
     import { abrirAnalisis } from '../../modules/analysis/analisis.js';
     abrirAnalisis(origen, wallet, ethers);
*/

import { brasas } from './chispas.js';
import { abrirCobroAnalisis, tieneAccesoAnalisis, segundosAnalisis, esOwnerAnalisis } from './analisis-pro.js?v=4';

/* Rutas RELATIVAS A LA RAIZ (overlay montado sobre index.html / app.html /
   futuros.html). Logo y foto de cinta: los mismos del sitio. Fondo: en el modulo. */
const LOGO   = 'assets/img/cco-full.webp';
const BANNER = 'assets/portada/img/header.webp';
const FONDO  = new URL('./img/fondo-analisis.webp', import.meta.url).href;   // SUBIR a modules/analysis/img/fondo-analisis.webp

/* ── CATALOGO (data-driven; agregar herramienta = una linea) ──────────────────
   cat: solo 'strategy' o 'indicator' (los dos unicos filtros).
   NOTA fases siguientes: aqui iran serviceId + precio + rating, leidos de contrato. */
const HERRAMIENTAS = [
  { id:'pools', abre:'pools', nombre:'Liquidity Pools', cat:'indicator', img:'assets/img/serv-pools.webp', activos:['Crypto'], spot:true,  listo:true,
    lema:'Where the money is trapped',
    desc:'A real time liquidation map. We reconstruct the volume resting inside every block of orders and project the exact price zones where leveraged positions are waiting to be swept.' },
  { id:'hair', abre:'heat', nombre:'Hair Pools', cat:'indicator', img:'assets/img/serv-libro.webp', activos:['Crypto'], spot:true, listo:true,
    lema:'See what the big players do',
    desc:'The order book lies. We watch every wall over time and separate the real committed capital from the theater, so you know which levels truly hold.' },
  { id:'smart', abre:'levels', nombre:'Smart Pools', cat:'strategy', img:'assets/img/serv-tres.webp', activos:['Crypto'], spot:false, listo:true,
    lema:'Where to buy and where to sell',
    desc:'Market structure, read and drawn for you. The engine maps the precise levels of entry and exit from live structure and explains, at each moment, why.' },
  { id:'hfs', abre:null, nombre:'High Frequency Signals', cat:'indicator', img:null, activos:['Crypto'], spot:false, listo:false,
    lema:'Momentum and scalping, tick by tick',
    desc:'Real time signals built for scalping and momentum: micro-shifts in flow, speed and aggression surfaced the instant they happen.' },
  { id:'vp', abre:null, nombre:'Volume Profile', cat:'indicator', img:null, activos:['Crypto'], spot:true, listo:false,
    lema:'Market structure and value zones',
    desc:'The distribution of traded volume by price: value areas, points of control and the empty zones price slides through.' },
  { id:'mtf', abre:null, nombre:'Multi Timeframe', cat:'strategy', img:null, activos:['Crypto'], spot:false, listo:false,
    lema:'Aligned views, better decisions',
    desc:'One read across every timeframe at once. When the short and the long align, conviction is high; when they disagree, you see the conflict first.' },
  { id:'flow', abre:null, nombre:'Order Flow', cat:'indicator', img:null, activos:['Crypto'], spot:false, listo:false,
    lema:'Track the real movement of capital',
    desc:'The raw tape, made legible: who is hitting the bid, who is lifting the offer, and where aggression is actually coming from.' },
  { id:'liq', abre:null, nombre:'Liquidation Zones', cat:'strategy', img:null, activos:['Crypto'], spot:false, listo:false,
    lema:'Where leverage gets wiped out',
    desc:'The price areas where cascades of leveraged positions are set to unwind. Magnets for price and the fuel behind violent moves.' }
];
const CAT_NOMBRE = { strategy:'Strategy', indicator:'Indicator' };

/* Cinta: mismos items y orden que el lobby, con Analysis ENTRE Bots y Futures. */
const NAV = [
  ['Swap', 'app.html?abrir=swap'],
  ['Launchpad', 'modules/launchpad/launchpad.html'],
  ['Terminal', 'modules/terminal/terminal.html'],
  ['Bots', 'modules/bots/bots.html'],
  ['Analysis', null],
  ['Futures', 'futuros.html?v=14'],
  ['Staking', 'aportar.html'],
  ['Shield', 'modules/shield/shield.html']
];
const NAV_TOOLS = [
  ['Dust collector', 'app.html?abrir=tools&tool=polvo'],
  ['Price alerts', 'app.html?abrir=tools&tool=alertas'],
  ['Fear and greed', 'app.html?abrir=tools&tool=termometro'],
  ['Technical analysis', 'app.html?abrir=tools&tool=tecnico'],
  ['Market map', 'app.html?abrir=tools&tool=mapa'],
  ['Live chart', 'app.html?abrir=tools&tool=grafica']
];

const ICO = {
  chev: '<svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>',
  spot: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l4 4L19 6"/></svg>'
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function abrirAnalisis(origen, wallet, ethers) {
  let acceso = false;
  try { acceso = await tieneAccesoAnalisis(wallet, ethers); } catch (_) {}
  if (acceso) return abrirSelector(origen, wallet, ethers);
  return abrirCobroAnalisis(origen, wallet, ethers, () => abrirSelector(origen, wallet, ethers));
}

/* Abre una herramienta sin sacar al usuario de Analisis (sin pestañeo al lobby). */
async function abrirTool(abre, cardEl) {
  const base = new URL('../../assets/js/', import.meta.url).href;
  const sel = document.getElementById('an-sel');
  const antes = new Set(Array.from(document.body.children));

  const btn = cardEl ? cardEl.querySelector('.an-open') : null;
  const txtPrev = btn ? btn.innerHTML : '';
  if (btn) { btn.classList.add('load'); btn.textContent = 'Loading…'; }

  try {
    if (abre === 'pools')       await (await import(base + 'liquidity.js?v=126')).abrirPools();
    else if (abre === 'heat')   await (await import(base + 'muros.js?v=127')).abrirMuros();
    else if (abre === 'levels') await (await import(base + 'niveles.js?v=127')).abrirNiveles();
  } catch (e) {
    if (btn) { btn.classList.remove('load'); btn.innerHTML = txtPrev; }
    try { toast('Could not load this tool. Try again.'); } catch (_) {}
    return;
  }
  if (btn) { btn.classList.remove('load'); btn.innerHTML = txtPrev; }
  if (!sel) return;

  const nuevos = Array.from(document.body.children).filter(
    (c) => !antes.has(c) && c !== sel && c.tagName !== 'STYLE' && c.tagName !== 'SCRIPT' && c.tagName !== 'LINK'
  );
  sel.style.display = 'none';
  if (!nuevos.length) { sel.style.display = ''; return; }

  const vivos = () => nuevos.some((el) => el.isConnected);
  const revisar = () => { if (!vivos()) { obs.disconnect(); clearInterval(tmr); const s = document.getElementById('an-sel'); if (s) s.style.display = ''; } };
  const obs = new MutationObserver(revisar);
  obs.observe(document.body, { childList: true });
  const tmr = setInterval(revisar, 400);
}

function toast(txt) {
  const sel = document.getElementById('an-sel'); if (!sel) return;
  let t = sel.querySelector('.an-toast');
  if (!t) { t = document.createElement('div'); t.className = 'an-toast'; sel.appendChild(t); }
  t.textContent = txt; t.classList.add('on');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2400);
}

export function abrirSelector(origen, wallet, ethers) {
  const prev = document.getElementById('an-sel'); if (prev) prev.remove();

  const ov = document.createElement('div');
  ov.id = 'an-sel';
  ov.style.visibility = 'hidden';

  // ── Cinta (copiada de las secciones aprobadas; Analysis entre Bots y Futures) ──
  const navHTML = NAV.map(([txt, href]) => {
    if (href === null) return `<div class="pt-nav__i"><a class="pt-nav__b lp-on" aria-current="page">${esc(txt)}</a></div>`;
    return `<div class="pt-nav__i"><a class="pt-nav__b" href="${esc(href)}">${esc(txt)}</a></div>`;
  }).join('');
  const toolsHTML = `<div class="pt-nav__i">
      <button class="pt-nav__b" type="button">Tools ${ICO.chev}</button>
      <div class="pt-menu">${NAV_TOOLS.map(([t, h]) => `<a href="${esc(h)}"><b>${esc(t)}</b></a>`).join('')}</div>
    </div>`;
  const colaHTML = `<div class="pt-nav__i"><a class="pt-nav__b" href="app.html?abrir=market">P2P</a></div>
    <div class="pt-nav__i"><a class="pt-nav__b" href="app.html?abrir=academy">Academy</a></div>`;

  const cintaHTML = `
    <header class="pt-hdr">
      <div class="pt-hdr__in">
        <a class="sw-back" id="an-back" href="index.html" aria-label="Back">${ICO.back}Back</a>
        <a class="pt-logo" href="index.html" aria-label="DecFreedom"><img src="${LOGO}" alt="DecFreedom" width="150" height="30"></a>
        <nav class="pt-nav" aria-label="Main">${navHTML}${toolsHTML}${colaHTML}</nav>
        <div class="pt-hdr__a">
          <span class="an-wpill" id="an-wpill" hidden></span>
          <a class="c-contratos" href="transparency.html">Contracts</a>
        </div>
      </div>
    </header>`;

  // ── Catalogo: buscador + dos chips (Strategies / Indicators). Sin banda negra, sin brand, sin selects. ──
  const catHeadHTML = `
    <div class="an-cat-hd">
      <label class="an-search">${ICO.search}<input id="an-q" type="search" autocomplete="off" placeholder="Search for a tool, indicator or strategy..."></label>
      <button class="an-chip" type="button" data-cat="strategy">Strategies</button>
      <button class="an-chip" type="button" data-cat="indicator">Indicators</button>
    </div>`;

  ov.innerHTML = `
    <div class="an-fondo" aria-hidden="true"></div>
    <canvas class="an-chispas" data-n="110" aria-hidden="true"></canvas>
    ${cintaHTML}
    <div class="an-cat">
      <div class="an-cat-in">
        ${catHeadHTML}
        <div class="an-grid" id="an-grid"></div>
        <div class="an-empty" id="an-empty" hidden>No tools match your search.</div>
      </div>
    </div>
    <style>${CSS}</style>`;

  document.body.appendChild(ov);
  requestAnimationFrame(() => { ov.style.visibility = 'visible'; });

  const $ = (sel) => ov.querySelector(sel);

  // Fondo (si existe la imagen; si no, queda el degradado de la casa)
  (function () { const capa = $('.an-fondo'); if (!capa) return; const img = new Image(); img.onload = () => { capa.style.backgroundImage = `url(${FONDO})`; capa.classList.add('con'); }; img.src = FONDO; })();

  // Particulas de la casa
  let particulas = null; try { particulas = brasas($('.an-chispas')); } catch (_) {}

  // Un SOLO boton: ultimos 4 de la wallet + dias de suscripcion, u "Owner".
  (async () => {
    try {
      let cuenta = ''; try { cuenta = (wallet && wallet.cuentaActual && wallet.cuentaActual()) || ''; } catch (_) {}
      if (!cuenta) return;
      const last4 = String(cuenta).slice(-4);
      const chip = $('#an-wpill'); if (!chip) return;
      let dueno = false; try { dueno = await esOwnerAnalisis(wallet, ethers); } catch (_) {}
      let cola = '';
      if (dueno) cola = 'Owner';
      else {
        const seg = await segundosAnalisis(wallet, ethers);
        if (seg > 3650 * 86400) cola = 'Full';
        else if (seg > 0) { const d = Math.floor(seg / 86400); cola = d >= 1 ? (d + 'd') : '<1d'; }
      }
      chip.innerHTML = `<span class="an-w4">${esc(last4)}</span>` + (cola ? `<span class="an-wsep">·</span><span class="an-wd">${esc(cola)}</span>` : '');
      chip.hidden = false;
    } catch (_) {}
  })();

  const grid = $('#an-grid');
  const empty = $('#an-empty');
  const estado = { q: '', cats: new Set() };

  const tarjeta = (h) => {
    const catTxt = CAT_NOMBRE[h.cat] || '';
    const medio = h.img
      ? `<div class="an-img" data-img="${esc(h.img)}"></div>`
      : `<div class="an-img ph ph-${esc(h.cat)}"><span class="an-ph-ini">${esc(h.nombre[0])}</span></div>`;
    return `
      <button class="an-card${h.listo ? '' : ' soon'}" type="button" data-tilt data-abre="${esc(h.abre || '')}" data-listo="${h.listo ? '1' : '0'}" title="${esc(h.desc)}">
        <div class="an-media">
          ${medio}
          <span class="an-badge an-badge-${esc(h.cat)}">${esc(catTxt)}</span>
          ${h.spot ? `<span class="an-spot">${ICO.spot} Spot</span>` : ''}
          ${h.listo ? '' : '<span class="an-soon">Coming soon</span>'}
        </div>
        <div class="an-body">
          <div class="an-nom">${esc(h.nombre)}</div>
          <div class="an-lema">${esc(h.lema)}</div>
          <div class="an-open">${h.listo ? 'Open' : 'Coming soon'}</div>
        </div>
      </button>`;
  };

  const render = () => {
    const q = estado.q.trim().toLowerCase();
    const lista = HERRAMIENTAS.filter((h) => {
      if (estado.cats.size && !estado.cats.has(h.cat)) return false;
      if (q && !((h.nombre + ' ' + h.lema + ' ' + h.desc).toLowerCase().includes(q))) return false;
      return true;
    });
    grid.innerHTML = lista.map(tarjeta).join('');
    empty.hidden = lista.length > 0;
    grid.querySelectorAll('.an-img[data-img]').forEach((el) => {
      const img = new Image();
      img.onload = () => { el.style.backgroundImage = `url(${el.dataset.img})`; el.classList.add('con'); };
      img.src = el.dataset.img;
    });
    wireTilt();
  };

  // Inclinacion 3D (la misma de Shield)
  function wireTilt() {
    grid.querySelectorAll('[data-tilt]').forEach((el) => {
      el.onmousemove = (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(650px) rotateY(' + (x * 13) + 'deg) rotateX(' + (-y * 13) + 'deg) translateY(-5px) scale(1.03)';
      };
      el.onmouseleave = () => { el.style.transform = ''; };
    });
  }

  render();

  // ── Interaccion ──
  const cerrar = () => { try { if (particulas) particulas.parar(); } catch (_) {} try { ov.remove(); } catch (_) {} };
  const back = $('#an-back');
  back.onclick = (e) => { e.preventDefault(); cerrar(); };   // volvemos a donde estaba el usuario (no recarga)

  const q = $('#an-q');
  q.addEventListener('input', () => { estado.q = q.value || ''; render(); });

  ov.querySelectorAll('.an-chip').forEach((b) => b.onclick = () => {
    const c = b.dataset.cat;
    if (estado.cats.has(c)) estado.cats.delete(c); else estado.cats.add(c);
    b.classList.toggle('on', estado.cats.has(c));
    render();
  });

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.an-card'); if (!card) return;
    if (card.dataset.listo !== '1' || !card.dataset.abre) { toast('Coming soon'); return; }
    abrirTool(card.dataset.abre, card);
  });
}

/* ── CSS. La CINTA es copia de los cinta.css de las secciones aprobadas
   (reglas #pt...), re-scopeada a #an-sel, con el overflow del nav SOLO en el
   tramo 761-1120 (como en las aprobadas) para que la barra dorada del activo
   NO se recorte. ── */
const CSS = `
#an-sel{position:fixed;inset:0;z-index:40000;height:100dvh;max-height:100dvh;display:flex;flex-direction:column;color:#eaecef;background:#05070a;
  --gold:#E8B84B;--gold-hi:#f4d089;--gold-md:#cf9f2e;--gold-lo:#8f6a1a;--on-gold:#241900;
  --ink:#eaecef;--ink2:#a7b0bb;--ink3:#79838f;--line:#1c232b;--line2:#29313b;--surf:#12161c;
  --sans:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;--disp:"Chakra Petch",system-ui,sans-serif;
  font-family:var(--sans)}
#an-sel *{box-sizing:border-box}
#an-sel img,#an-sel svg{display:block;max-width:100%}
#an-sel a{color:inherit;text-decoration:none}

/* fondo + particulas (detras de todo) */
#an-sel .an-fondo{position:fixed;inset:0;z-index:0;pointer-events:none;background:#05070a;
  background-image:radial-gradient(1200px 560px at 82% -6%,rgba(232,184,75,.08),transparent 60%),radial-gradient(900px 520px at 8% 2%,rgba(74,163,255,.05),transparent 55%),linear-gradient(180deg,#070a0e,#05070a 62%)}
#an-sel .an-fondo.con::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,10,.72),rgba(5,7,10,.9))}
#an-sel .an-chispas{position:fixed;inset:0;z-index:1;width:100%;height:100%;pointer-events:none;display:block}

/* ── CINTA (copia 1:1 de las aprobadas) ── */
#an-sel .pt-hdr{position:relative;z-index:20;flex:0 0 auto;display:flex;align-items:center;height:58px;background:#07090c;border-bottom:1px solid #1a2029}
#an-sel .pt-hdr::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:url('${BANNER}') center/cover no-repeat;opacity:1}
#an-sel .pt-hdr button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
#an-sel .pt-hdr__in{position:relative;z-index:2;display:flex;align-items:center;gap:0;width:100%;max-width:none;margin:0 auto;padding:0 14px}
#an-sel .sw-back{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px 0 9px;border-radius:9px;font-family:var(--sans);font-size:13px;font-weight:600;color:var(--ink2);background:rgba(255,255,255,.05);border:1px solid var(--line2);text-shadow:0 1px 4px rgba(0,0,0,.9);margin-right:26px;white-space:nowrap}
#an-sel .sw-back:hover{border-color:var(--gold-lo);color:var(--gold)}
#an-sel .sw-back svg{width:12px;height:12px}
#an-sel .pt-logo{flex:0 0 auto;display:flex;align-items:center;text-shadow:0 1px 4px rgba(0,0,0,.9)}
#an-sel .pt-logo img{height:40px;width:auto}
#an-sel .pt-nav{display:flex;align-items:center;gap:2px;flex:0 1 auto;margin-left:14px}
#an-sel .pt-nav__i{position:relative}
#an-sel .pt-nav__b{display:flex;align-items:center;gap:5px;font-size:13.5px;font-weight:500;color:var(--ink2);padding:8px 11px;border-radius:8px;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.9);transition:color .15s,background .15s;cursor:pointer}
#an-sel .pt-nav__b:hover{color:var(--ink);background:rgba(255,255,255,.045)}
#an-sel .pt-nav__b svg{width:10px;height:10px;opacity:.55;transition:transform .2s}
#an-sel .pt-nav__i:hover .pt-nav__b svg{transform:rotate(180deg)}
#an-sel .pt-menu{position:absolute;top:calc(100% + 8px);left:0;z-index:300;min-width:200px;padding:7px;background:var(--surf);border:1px solid var(--line2);border-radius:12px;box-shadow:0 20px 44px rgba(0,0,0,.6);opacity:0;visibility:hidden;transform:translateY(-5px);transition:opacity .17s,transform .17s,visibility .17s}
#an-sel .pt-nav__i:hover .pt-menu,#an-sel .pt-nav__i:focus-within .pt-menu{opacity:1;visibility:visible;transform:none}
#an-sel .pt-menu a{display:block;padding:9px 11px;border-radius:8px}
#an-sel .pt-menu a:hover{background:rgba(232,184,75,.07)}
#an-sel .pt-menu b{display:block;font-size:13px;font-weight:600;color:var(--ink)}
#an-sel .pt-hdr__a{display:flex;align-items:center;gap:6px;flex:0 0 auto;margin-left:auto}
/* SERVICIO ACTIVO (igual que en las aprobadas): dorado + halo + barra inferior */
#an-sel .pt-nav__b.lp-on{position:relative;color:#f1cf6a;cursor:default;text-shadow:0 0 16px rgba(232,184,75,.55),0 0 2px rgba(232,184,75,.35),0 1px 4px rgba(0,0,0,.9)}
#an-sel .pt-nav__b.lp-on:hover{color:#f6dc8a;background:transparent}
#an-sel .pt-nav__b.lp-on::before{content:"";position:absolute;left:0;right:0;top:calc(50% + 7px);height:22px;pointer-events:none;background:radial-gradient(ellipse 60% 100% at 50% 100%,rgba(232,184,75,.42),rgba(232,184,75,.12) 45%,transparent 72%)}
#an-sel .pt-nav__b.lp-on::after{content:"";position:absolute;left:2px;right:2px;top:calc(50% + 26px);height:3px;pointer-events:none;border-radius:3px;background:radial-gradient(ellipse 50% 100% at 50% 100%,#fff3c4 0%,#E8B84B 30%,rgba(232,184,75,.55) 60%,transparent 100%)}
/* boton unico wallet+suscripcion */
#an-sel .an-wpill{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px;border-radius:9px;font-family:var(--mono);font-size:12px;font-weight:700;color:var(--ink2);background:rgba(255,255,255,.05);border:1px solid var(--line2);white-space:nowrap}
#an-sel .an-wpill[hidden]{display:none}
#an-sel .an-wpill .an-w4{letter-spacing:.5px}
#an-sel .an-wpill .an-wsep{opacity:.5}
#an-sel .an-wpill .an-wd{color:var(--gold);letter-spacing:.3px}
#an-sel .c-contratos{display:inline-flex;align-items:center;height:36px;padding:0 15px;border:1px solid var(--gold);border-radius:9px;color:var(--gold);background:rgba(232,184,75,.08);font-family:var(--disp);font-weight:700;font-size:12.5px;letter-spacing:.3px;white-space:nowrap;text-shadow:0 1px 4px rgba(0,0,0,.9)}
#an-sel .c-contratos:hover{background:rgba(232,184,75,.16)}

/* ── Catalogo (scroll infinito, sin banda negra) ── */
#an-sel .an-cat{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;position:relative;z-index:2}
#an-sel .an-cat::-webkit-scrollbar{width:0;height:0;display:none}
#an-sel .an-cat-in{width:100%;max-width:1200px;margin:0 auto;padding:18px clamp(14px,3vw,30px) 40px}
#an-sel .an-cat-hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px}
#an-sel .an-search{flex:1 1 300px;min-width:0;display:flex;align-items:center;gap:9px;height:42px;padding:0 14px;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid #2a333f;border-radius:11px;color:var(--ink3);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
#an-sel .an-search:focus-within{border-color:var(--gold-lo)}
#an-sel .an-search input{flex:1;min-width:0;background:none;border:0;outline:0;color:#eaecef;font-family:inherit;font-size:14px}
#an-sel .an-search input::placeholder{color:#6d7681}
/* chips = MISMO boton de Terminal (negro con borde; activo = texto/borde dorado, sin relleno) */
#an-sel .an-chip{display:inline-flex;align-items:center;justify-content:center;height:42px;padding:0 18px;border-radius:11px;border:1px solid #2a333f;background:linear-gradient(180deg,#1b2027,#0d1117);color:#b7bdc6;font-family:var(--disp);font-weight:700;font-size:12.5px;letter-spacing:.2px;white-space:nowrap;cursor:pointer;box-shadow:0 3px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06);transition:color .15s,border-color .15s}
#an-sel .an-chip:hover{color:#eaecef;border-color:var(--gold-lo)}
#an-sel .an-chip.on{color:#f1cf6a;border-color:rgba(232,184,75,.55)}
#an-sel .an-chip:active{transform:translateY(2px);box-shadow:0 1px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06)}

/* rejilla 4 col, tarjetas de IGUAL alto y ancho */
#an-sel .an-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:stretch}
#an-sel .an-card{display:flex;flex-direction:column;text-align:left;font-family:inherit;color:inherit;background:linear-gradient(180deg,#121820,#0b0e12);border:1px solid #232b36;border-radius:16px;overflow:hidden;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.04);transform-style:preserve-3d;transition:transform .15s ease,border-color .14s,box-shadow .18s;will-change:transform}
#an-sel .an-card:hover{border-color:var(--gold);box-shadow:0 18px 44px rgba(232,184,75,.14)}
#an-sel .an-card.soon{cursor:default}
#an-sel .an-media{position:relative;width:100%;aspect-ratio:16/9;flex:0 0 auto}
#an-sel .an-img{position:absolute;inset:0;background:#0e1319 center/cover no-repeat;border-bottom:1px solid #1c232b}
#an-sel .an-img.ph{display:grid;place-items:center}
#an-sel .an-img.ph::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:20px 20px;opacity:.35}
#an-sel .an-img.ph-indicator{background:radial-gradient(circle at 50% 40%,rgba(46,189,133,.3),rgba(10,14,18,.2))}
#an-sel .an-img.ph-strategy{background:radial-gradient(circle at 50% 40%,rgba(74,163,255,.3),rgba(10,14,18,.2))}
#an-sel .an-ph-ini{position:relative;z-index:1;font-size:44px;font-weight:900;color:rgba(255,255,255,.22)}
#an-sel .an-badge{position:absolute;top:9px;left:9px;z-index:2;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:4px 9px;border-radius:100px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
#an-sel .an-badge-indicator{color:#5ff0b0;background:rgba(46,189,133,.16);border:1px solid rgba(46,189,133,.4)}
#an-sel .an-badge-strategy{color:#9cc9ff;background:rgba(74,163,255,.16);border:1px solid rgba(74,163,255,.4)}
#an-sel .an-spot{position:absolute;top:9px;right:9px;z-index:2;display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#cdd5dd;background:rgba(5,7,10,.55);border:1px solid rgba(255,255,255,.14);border-radius:100px;padding:3px 8px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
#an-sel .an-spot svg{width:11px;height:11px;color:#2ebd85}
#an-sel .an-soon{position:absolute;top:50%;left:50%;z-index:2;transform:translate(-50%,-50%);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#cfd6dd;background:rgba(5,7,10,.6);border:1px solid rgba(255,255,255,.16);border-radius:100px;padding:6px 14px}
#an-sel .an-card.soon .an-img{filter:grayscale(.5) brightness(.72)}
/* cuerpo de ALTO FIJO → todas las tarjetas igual */
#an-sel .an-body{display:flex;flex-direction:column;padding:12px 13px 13px;height:112px}
#an-sel .an-nom{font-size:15px;font-weight:800;color:#eaecef;line-height:1.2;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#an-sel .an-lema{font-size:12px;color:#8b96a3;line-height:1.35;margin-bottom:auto;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#an-sel .an-open{text-align:center;font-size:12px;font-weight:800;color:var(--gold);border:1px solid rgba(232,184,75,.4);border-radius:10px;padding:8px;background:linear-gradient(180deg,#1b2027,#0d1117);box-shadow:0 2px 0 #060809;margin-top:10px}
#an-sel .an-card:hover .an-open{border-color:rgba(232,184,75,.7)}
#an-sel .an-card.soon .an-open{color:#79838f;border-color:#2b3340;background:rgba(255,255,255,.02);box-shadow:none}
#an-sel .an-open.load{color:var(--ink2);border-color:#2b3340}
#an-sel .an-empty{text-align:center;color:#8b96a3;font-size:14px;padding:50px 0}

/* toast */
#an-sel .an-toast{position:fixed;left:50%;bottom:30px;z-index:40;transform:translateX(-50%) translateY(14px);opacity:0;pointer-events:none;background:rgba(12,16,22,.96);border:1px solid var(--line2);color:#eaecef;font-size:13px;font-weight:600;padding:11px 20px;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.55);transition:opacity .2s,transform .2s}
#an-sel .an-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}

/* ── Responsive (IGUAL que las aprobadas: overflow del nav SOLO 761–1120) ── */
@media(max-width:1340px){#an-sel .pt-nav__b{font-size:12.5px;padding:8px 8px}}
@media(max-width:1200px){#an-sel .pt-nav{margin-left:8px}#an-sel .pt-nav__b{font-size:12px;padding:7px 6px;gap:4px}#an-sel .pt-logo img{width:124px;height:auto}#an-sel .an-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:1120px) and (min-width:761px){
  #an-sel .pt-nav{flex:1 1 auto;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;mask-image:linear-gradient(90deg,#000 calc(100% - 22px),transparent)}
  #an-sel .pt-nav::-webkit-scrollbar{display:none}
  #an-sel .pt-hdr__a{flex:0 0 auto}
}
@media(max-width:760px){
  #an-sel .pt-nav{display:none}
  #an-sel .an-grid{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:560px){#an-sel .c-contratos{display:none}}
@media(max-width:480px){#an-sel .an-grid{grid-template-columns:1fr}#an-sel .an-search{flex:1 1 100%}}
`;
