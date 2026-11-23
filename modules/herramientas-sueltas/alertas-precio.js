/* ══════════════════════════════════════════════════════════════
   alertas-precio.js — ALERTAS DE PRECIO (archivo suelto, NO cableado)

   Extraído de assets/js/tools.js para tenerlo modularizado aparte.
   NO se carga en ninguna página todavía: queda aquí por si se necesita
   (la versión móvil lo llamará). La lógica es idéntica a la de tools.js.

   Avisa cuando una moneda llega al precio que marques. Las alertas viven
   en el navegador (localStorage), no en un servidor.

   USO:  import { abrir, vigilar } from './alertas-precio.js';
         abrir();      // abre la ventana para crear/ver alertas
         vigilar();    // arranca la comprobación en segundo plano (cada 60s)
   ══════════════════════════════════════════════════════════════ */

import * as ethers from '../../assets/js/vendor/ethers-6.13.4.min.js?v=125';
import { MONEDAS } from '../../assets/js/tokens.js?v=125';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d = 2) => Number(v).toLocaleString('es', { maximumFractionDigits: d });
/* En el móvil, los campos numéricos pintan unas flechitas que algunos
   navegadores no dejan quitar por CSS. Con type=text + inputmode=decimal
   sale el mismo teclado y ninguna flecha. */
const _tipoNumCC = () => (window.matchMedia('(max-width: 760px)').matches ? 'text' : 'number');

/* El selector de logos de los widgets no existe en este archivo suelto; se
   deja la lista vacía para que ponerLogos() quede idéntico a tools.js. */
const MON_WIDGET = [];

/* Mensaje dentro de la ventana de alertas (#pv-msg). */
function decirP(txt, clase = '') {
  const e = $('pv-msg'); if (!e) return;
  e.className = 'tl-msg ' + clase; e.innerHTML = txt;
  if (txt) setTimeout(() => { if (e.innerHTML === txt) { e.innerHTML = ''; e.className = 'tl-msg'; } }, 12000);
}

const CLAVE_ALERTAS = 'aurex-alertas';
const leerAlertas = () => { try { return JSON.parse(localStorage.getItem(CLAVE_ALERTAS) || '[]'); } catch (_) { return []; } };
const guardarAlertas = (a) => { try { localStorage.setItem(CLAVE_ALERTAS, JSON.stringify(a)); } catch (_) {} };

async function abrirAlertas() {
  const prev = $('al-overlay'); if (prev) prev.remove();
  const d = document.createElement('div');
  d.id = 'al-overlay';
  d.innerHTML = `<div class="pv-bg"></div>
    <div class="pv-c">
      <div class="tl-top">
        <div class="tl-eyebrow">Price alerts</div>
        <button class="pv-x" aria-label="Close">✕</button>
      </div>
      <p class="tl-s">We alert you when a coin reaches the price you set.</p>
      <div id="al-cuerpo"></div>
      <div class="tl-msg" id="pv-msg"></div>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => { const e = $('al-overlay'); if (e) e.remove(); };
  d.querySelector('.pv-bg').onclick = cerrar;
  d.querySelector('.pv-x').onclick = cerrar;
  pintarAlertas();
}

let _alMoneda = 'BNB';
let _alDir = 'sube';

function pintarAlertas() {
  const box = $('al-cuerpo'); if (!box) return;
  const alertas = leerAlertas();
  /* Solo monedas cuyo precio SE MUEVE. Poner una alerta a USDT o USDC
     no tiene sentido: valen un dólar y ahí se quedan. */
  const ESTABLES = ['USDT', 'USDC', 'USDTZ', 'BUSD', 'DAI', 'TUSD', 'FDUSD'];
  const monedas = Object.entries(MONEDAS)
    .filter(([id, m]) => m.cg && !ESTABLES.includes(id));

  box.innerHTML = `
    <div class="al-paso"><span>1</span>Pick the coin</div>
    <button class="al-selector" id="al-abrir">
      <span class="al-mon-i" data-logo="${esc((MONEDAS[_alMoneda] || {}).cg || '')}" data-dir="${esc((MONEDAS[_alMoneda] || {}).address || '')}" data-ini="${esc(((MONEDAS[_alMoneda] || {}).simbolo || '?')[0])}" style="border-color:${(MONEDAS[_alMoneda] || {}).color}55;--c:${(MONEDAS[_alMoneda] || {}).color}"></span>
      <span class="al-sel-tx"><b>${esc((MONEDAS[_alMoneda] || {}).simbolo || '')}</b><em>${esc((MONEDAS[_alMoneda] || {}).nombre || '')}</em></span>
      <svg class="al-sel-v" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </button>

    <div class="al-paso"><span>2</span>Alert me when the price…</div>
    <div class="al-dirs">
      <button class="al-dir ${_alDir === 'sube' ? 'on' : ''}" data-dir="sube">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        rises to
      </button>
      <button class="al-dir ${_alDir === 'baja' ? 'on' : ''}" data-dir="baja">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        drops to
      </button>
    </div>

    <div class="al-paso"><span>3</span>The price</div>
    <div class="al-precio">
      <span class="al-dolar">$</span>
      <input id="al-precio" class="al-in" type="text" placeholder="0.00" inputmode="decimal" autocomplete="off">
      <div class="al-pasos">
        <button class="al-paso-b" id="al-mas" type="button" aria-label="Subir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15l7-7 7 7"/></svg></button>
        <button class="al-paso-b" id="al-menos" type="button" aria-label="Bajar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9l-7 7-7-7"/></svg></button>
      </div>
    </div>
    <div class="al-ahora" id="al-ahora"></div>

    <button class="pv-b" id="al-add">Create alert</button>

    ${alertas.length ? `
      <div class="al-titulo">Your alerts</div>
      <div class="al-lista">${alertas.map((a, i) => {
        const mm = MONEDAS[a.id] || {};
        return `<div class="al-fila ${a.saltada ? 'saltada' : ''}">
          <span class="al-mon-i chico" data-logo="${esc(a.cg || '')}" data-dir="${esc(mm.address || '')}" data-ini="${esc(a.sim[0])}" style="border-color:${(mm.color || '#888')}55;--c:${mm.color || '#888'}"></span>
          <span class="al-tx"><b>${esc(a.sim)}</b> ${a.dir === 'sube' ? 'rises to' : 'drops to'} <b>$${num(a.precio, 6)}</b></span>
          ${a.saltada ? '<span class="al-ya">alerted</span>' : ''}
          <button class="al-del" data-del="${i}" aria-label="Delete">✕</button>
        </div>`;
      }).join('')}</div>` : ''}

    <div class="pv-nota">
      Alerts live <b>in this browser</b>, not on a server. They work while you keep DecFreedom open or installed as an app.
    </div>`;

  ponerLogos();

  /* Desplegable de monedas, con la misma dinámica que en los bots:
     una barra que abre una lista, no 26 botones ocupando la pantalla. */
  $('al-abrir').onclick = () => {
    const d = document.createElement('div');
    d.id = 'al-picker';
    d.innerHTML = `<div class="alp-bg"></div>
      <div class="alp-c">
        <div class="alp-cab">
          <span>Pick the coin</span>
          <button class="alp-x" aria-label="Close">✕</button>
        </div>
        <input class="alp-buscar" id="alp-q" placeholder="Search…" autocomplete="off">
        <div class="alp-lista" id="alp-lista">
          ${monedas.map(([id, m]) => `
            <button class="alp-item ${id === _alMoneda ? 'on' : ''}" data-pick="${id}" data-busca="${esc((m.simbolo + ' ' + m.nombre).toLowerCase())}">
              <span class="al-mon-i" data-logo="${esc(m.cg)}" data-dir="${esc(m.address || '')}" data-ini="${esc(m.simbolo[0])}" style="border-color:${m.color}55;--c:${m.color}"></span>
              <span class="alp-tx"><b>${esc(m.simbolo)}</b><em>${esc(m.nombre)}</em></span>
              ${id === _alMoneda ? '<svg class="alp-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>' : ''}
            </button>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(d);
    // Los logos, DESPUÉS de que el desplegable esté en la página.
    setTimeout(ponerLogos, 30);
    const q = () => d.remove();
    d.querySelector('.alp-bg').onclick = q;
    d.querySelector('.alp-x').onclick = q;
    $('alp-q').oninput = (e) => {
      const t = e.target.value.toLowerCase().trim();
      d.querySelectorAll('.alp-item').forEach((x) => {
        x.style.display = !t || x.dataset.busca.includes(t) ? '' : 'none';
      });
    };
    d.querySelectorAll('[data-pick]').forEach((b) => b.onclick = () => {
      _alMoneda = b.dataset.pick;
      q();
      pintarAlertas();
    });
    setTimeout(() => { try { $('alp-q').focus(); } catch (_) {} }, 100);
  };

  // Precio de ahora, para que sepa dónde está antes de elegir
  const verPrecio = async () => {
    const el = $('al-ahora'); if (!el) return;
    const m = MONEDAS[_alMoneda];
    el.textContent = 'checking…';
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${m.cg}&vs_currencies=usd`);
      const j = await r.json();
      const p = j[m.cg] && j[m.cg].usd;
      el.innerHTML = p ? `${esc(m.simbolo)} is now at <b>$${num(p, 6)}</b>` : '';
    } catch (_) { el.textContent = ''; }
  };
  verPrecio();


  box.querySelectorAll('[data-dir]').forEach((b) => b.onclick = () => {
    _alDir = b.dataset.dir;
    box.querySelectorAll('.al-dir').forEach((x) => x.classList.toggle('on', x.dataset.dir === _alDir));
  });

  /* Los botones de subir y bajar el precio: el paso se adapta al valor,
     que no es lo mismo ajustar 0,08 que 68.000. */
  const _paso = (v) => {
    const a = Math.abs(v);
    if (a >= 10000) return 100;
    if (a >= 1000) return 10;
    if (a >= 100) return 1;
    if (a >= 10) return 0.1;
    if (a >= 1) return 0.01;
    if (a >= 0.01) return 0.001;
    return 0.00001;
  };
  const _mover = (signo) => {
    const el = $('al-precio');
    const v = Number(String(el.value).replace(',', '.')) || 0;
    const p = _paso(v);
    const nuevo = Math.max(0, v + signo * p);
    el.value = nuevo.toFixed(String(p).split('.')[1]?.length || 0);
  };
  $('al-mas').onclick = () => _mover(1);
  $('al-menos').onclick = () => _mover(-1);

  $('al-add').onclick = async () => {
    const precio = Number($('al-precio').value);
    if (!isFinite(precio) || precio <= 0) { decirP('Enter a valid price.', 'mal'); return; }
    const m = MONEDAS[_alMoneda];
    const a = leerAlertas();
    a.push({ id: _alMoneda, sim: m.simbolo, cg: m.cg, dir: _alDir, precio, saltada: false, creada: Date.now() });
    guardarAlertas(a);
    try { if (window.Notification && Notification.permission === 'default') await Notification.requestPermission(); } catch (_) {}
    decirP(`Done: we will notify you when ${esc(m.simbolo)} ${_alDir === 'sube' ? 'rises to' : 'drops to'} $${num(precio, 6)}.`, 'ok');
    pintarAlertas();
    vigilar();
  };

  box.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
    const a = leerAlertas();
    a.splice(Number(b.dataset.del), 1);
    guardarAlertas(a);
    pintarAlertas();
  });
}

/* ── LOGOS DE LAS MONEDAS ──────────────────────────────────────
   Los trae CoinGecko, que es la misma fuente que ya usamos para los
   precios. Se guardan en el navegador un día: así no se piden otra vez
   en cada visita. Si alguno no llega, queda el círculo con su color y
   no se rompe nada. */
const CLAVE_LOGOS = 'aurex-logos';
let _logos = null;

async function ponerLogos() {
  if (!_logos) {
    try {
      const g = JSON.parse(localStorage.getItem(CLAVE_LOGOS) || 'null');
      if (g && Date.now() - g.cuando < 86400000) _logos = g.datos;
    } catch (_) {}
  }
  if (!_logos) {
    try {
      /* Se piden juntos los de las alertas y los de los widgets: una
         sola llamada para todo, y así el desplegable tiene sus logos. */
      const ids = [...new Set([
        ...Object.values(MONEDAS).map((m) => m.cg),
        ...MON_WIDGET.map((m) => m.cg)
      ].filter(Boolean))];
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&per_page=250`);
      const j = await r.json();
      _logos = {};
      j.forEach((x) => { _logos[x.id] = x.image; });
      try { localStorage.setItem(CLAVE_LOGOS, JSON.stringify({ cuando: Date.now(), datos: _logos })); } catch (_) {}
    } catch (_) { _logos = {}; }
  }
  /* Si CoinGecko no responde (pasa a menudo), se usa el repositorio de
     iconos de TrustWallet, que sirve la imagen por DIRECCIÓN del token.
     Y si tampoco, queda la inicial de la moneda con su color: nunca un
     círculo vacío. */
  // Los logos del selector de widgets
  document.querySelectorAll('.w-sel-logo[data-cg]').forEach((el) => {
    const url = _logos && _logos[el.dataset.cg];
    if (url) { el.style.backgroundImage = `url(${url})`; el.classList.add('con'); }
  });

  document.querySelectorAll('[data-logo]').forEach((el) => {
    const id = el.dataset.logo;
    const url = (_logos && _logos[id]) || null;
    const dir = el.dataset.dir;

    const poner = (u) => {
      const img = new Image();
      img.onload = () => { el.style.backgroundImage = `url(${u})`; el.classList.add('con-logo'); };
      img.onerror = () => { el.classList.add('sin-logo'); };
      img.src = u;
    };

    if (url) { poner(url); return; }
    if (dir && dir.length === 42) {
      poner(`https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${ethers.getAddress(dir)}/logo.png`);
      return;
    }
    el.classList.add('sin-logo');
  });
}

/* Comprueba los precios cada minuto y avisa cuando toca. */
let _timer = null;
export function vigilar() {
  if (_timer) return;
  const comprobar = async () => {
    const a = leerAlertas().filter((x) => !x.saltada);
    if (a.length === 0) return;
    try {
      const ids = [...new Set(a.map((x) => x.cg))].join(',');
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      const p = await r.json();
      const todas = leerAlertas();
      let cambio = false;
      todas.forEach((x) => {
        if (x.saltada) return;
        const ahora = p[x.cg] && p[x.cg].usd;
        if (!ahora) return;
        const toca = x.dir === 'sube' ? ahora >= x.precio : ahora <= x.precio;
        if (toca) {
          x.saltada = true; cambio = true;
          avisar(`${x.sim} ${x.dir === 'sube' ? 'rose to' : 'dropped to'} $${num(ahora, 6)}`);
        }
      });
      if (cambio) guardarAlertas(todas);
    } catch (_) {}
  };
  comprobar();
  _timer = setInterval(comprobar, 60000);
}

function avisar(texto) {
  try {
    if (Notification && Notification.permission === 'granted') {
      new Notification('DecFreedom · price alert', { body: texto, icon: 'assets/img/cco-192.png' });
      return;
    }
  } catch (_) {}
  // Sin permiso: aviso dentro de la propia página
  const d = document.createElement('div');
  d.className = 'al-toast';
  d.innerHTML = `<b>Price alert</b>${esc(texto)}`;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 9000);
}

/* ══════════════════ ESTILOS (solo los de alertas) ══════════════════ */
function estilos() {
  if ($('cc-alertas-css')) return;
  const s = document.createElement('style'); s.id = 'cc-alertas-css';
  s.textContent = `
  #al-overlay{position:fixed;inset:0;z-index:9710;display:flex;align-items:center;justify-content:center;padding:16px}
  #al-overlay .pv-bg{position:absolute;inset:0;background:rgba(3,5,8,.9);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}
  #al-overlay .pv-c{position:relative;width:100%;max-width:520px;max-height:calc(100vh - 32px);overflow-y:auto;
    background:linear-gradient(180deg,#141922,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:20px;padding:22px 20px}
  #al-overlay .tl-top{position:relative;display:flex;align-items:center;justify-content:center;min-height:36px;margin-bottom:10px}
  #al-overlay .tl-eyebrow{font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);text-transform:uppercase;letter-spacing:2px}
  #al-overlay .pv-x{position:absolute;top:0;right:0;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;padding:0;
    background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;cursor:pointer;font-size:15px}
  #al-overlay .tl-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;text-align:center;line-height:1.6;margin:0 0 20px}
  .tl-msg{font-family:var(--mono,monospace);font-size:12px;text-align:center;margin-top:14px;min-height:17px;line-height:1.6}
  .tl-msg.ok{color:var(--neon-lit,#2ee86a)} .tl-msg.mal{color:var(--rojo,#f6465d)} .tl-msg.info{color:var(--gold,#E8B84B)}
  .pv-b{width:100%;min-height:48px;padding:13px;border-radius:12px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 0 #8f6a1a}
  .pv-b:disabled{opacity:.4;cursor:default;box-shadow:none}
  .pv-b:active:not(:disabled){transform:translateY(2px)}
  .pv-nota{font-family:var(--sans,sans-serif);font-size:11.5px;color:#6b7681;line-height:1.55;margin-top:13px}
  .pv-nota b{color:#8b96a3}

  #al-overlay .al-paso{display:flex;align-items:center;gap:9px;font-family:var(--mono,monospace);font-size:10px;
    color:#7d8794;text-transform:uppercase;letter-spacing:1px;margin:18px 0 10px}
  #al-overlay .al-paso:first-child{margin-top:0}
  #al-overlay .al-paso span{width:20px;height:20px;border-radius:6px;display:grid;place-items:center;flex:0 0 auto;
    background:rgba(232,184,75,.14);color:var(--gold,#E8B84B);font-size:10px;font-weight:700}
  /* La barra que abre el desplegable */
  #al-overlay .al-selector{display:flex;align-items:center;gap:12px;width:100%;padding:13px 15px;border-radius:13px;
    background:rgba(255,255,255,.03);border:1px solid #2b3139;color:#eaecef;cursor:pointer;min-height:60px;
    transition:border-color .15s ease}
  #al-overlay .al-selector:hover{border-color:var(--gold-soft,#C9A84B)}
  #al-overlay .al-sel-tx{flex:1;min-width:0;text-align:left}
  #al-overlay .al-sel-tx b{display:block;font-family:var(--display,sans-serif);font-size:15px}
  #al-overlay .al-sel-tx em{display:block;font-style:normal;font-family:var(--sans,sans-serif);font-size:11.5px;color:#7d8794;margin-top:2px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #al-overlay .al-sel-v{width:18px;height:18px;flex:0 0 auto;color:#6b7681}

  /* El desplegable */
  #al-picker{position:fixed;inset:0;z-index:9730;display:flex;align-items:center;justify-content:center;padding:16px}
  #al-picker .alp-bg{position:absolute;inset:0;background:rgba(3,5,8,.9);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  #al-picker .alp-c{position:relative;width:100%;max-width:400px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:18px;padding:16px;overflow:hidden}
  #al-picker .alp-cab{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
  #al-picker .alp-cab span{font-family:var(--display,sans-serif);font-weight:800;font-size:16px;color:#eaecef}
  #al-picker .alp-x{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;padding:0;
    background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;cursor:pointer}
  #al-picker .alp-buscar{width:100%;box-sizing:border-box;padding:12px 14px;border-radius:11px;border:1px solid #2b3139;
    background:#0b0e12;color:#eaecef;font-family:var(--sans,sans-serif);font-size:14px;margin-bottom:10px;min-height:46px}
  #al-picker .alp-buscar:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  #al-picker .alp-lista{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:5px;margin:0 -4px;padding:0 4px}
  #al-picker .alp-item{display:flex;align-items:center;gap:12px;width:100%;padding:11px 13px;border-radius:12px;
    background:transparent;border:1px solid transparent;color:#eaecef;cursor:pointer;min-height:56px;text-align:left}
  #al-picker .alp-item:hover{background:rgba(255,255,255,.04)}
  #al-picker .alp-item.on{background:rgba(232,184,75,.1);border-color:rgba(232,184,75,.35)}
  #al-picker .alp-tx{flex:1;min-width:0}
  #al-picker .alp-tx b{display:block;font-family:var(--display,sans-serif);font-size:14px}
  #al-picker .alp-tx em{display:block;font-style:normal;font-family:var(--sans,sans-serif);font-size:11.5px;color:#7d8794;margin-top:2px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #al-picker .alp-ok{width:17px;height:17px;flex:0 0 auto;color:var(--gold,#E8B84B)}
  #al-overlay .al-mon-i{width:30px;height:30px;border-radius:50%;flex:0 0 auto;border:1px solid;
    background:rgba(255,255,255,.05) center/cover no-repeat}
  #al-overlay .al-mon-i.con-logo{background-color:transparent;background-size:cover}
  /* Respaldo: la inicial con el color de la moneda. Nunca un hueco. */
  #al-overlay .al-mon-i.sin-logo:after,#al-picker .al-mon-i.sin-logo:after{
    content:attr(data-ini);display:grid;place-items:center;width:100%;height:100%;
    color:var(--c,#8b96a3);font-family:var(--display,sans-serif);font-weight:800;font-size:13px}
  #al-picker .al-mon-i{width:30px;height:30px;border-radius:50%;flex:0 0 auto;border:1px solid;
    background:rgba(255,255,255,.05) center/cover no-repeat}
  #al-picker .al-mon-i.con-logo{background-color:transparent}
  #al-overlay .al-mon-i.chico{width:26px;height:26px;font-size:11px}
  #al-overlay .al-mon-s{font-family:var(--mono,monospace);font-size:10.5px;color:#b7bdc6;
    max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #al-overlay .al-mon.on .al-mon-s{color:var(--gold,#E8B84B)}
  #al-overlay .al-dirs{display:flex;gap:8px}
  #al-overlay .al-dir{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;
    padding:0 14px;border-radius:12px;background:rgba(255,255,255,.025);border:1px solid #2b3139;color:#8b96a3;
    font-family:var(--display,sans-serif);font-weight:700;font-size:13px;cursor:pointer}
  #al-overlay .al-dir svg{width:16px;height:16px}
  /* Verde sube, rojo baja: es el lenguaje de cualquier gráfico. */
  #al-overlay .al-dir[data-dir="sube"].on{border-color:var(--neon-lit,#2ee86a);background:rgba(46,232,106,.12);color:var(--neon-lit,#2ee86a)}
  #al-overlay .al-dir[data-dir="baja"].on{border-color:var(--rojo,#f6465d);background:rgba(246,70,93,.12);color:var(--rojo,#f6465d)}
  #al-overlay .al-dir[data-dir="sube"]:not(.on):hover{border-color:rgba(46,232,106,.45);color:#8fdcab}
  #al-overlay .al-dir[data-dir="baja"]:not(.on):hover{border-color:rgba(246,70,93,.45);color:#e79aa5}
  #al-overlay .al-precio{display:flex;align-items:center;border-radius:12px;border:1px solid #2b3139;background:#0b0e12;overflow:hidden}
  #al-overlay .al-precio:focus-within{border-color:var(--gold-soft,#C9A84B)}
  #al-overlay .al-dolar{padding:0 4px 0 15px;font-family:var(--display,sans-serif);font-size:19px;color:#6b7681}
  #al-overlay .al-in{flex:1;min-width:0;padding:14px 14px 14px 3px;border:none;background:transparent;color:#eaecef;
    font-family:var(--display,sans-serif);font-size:19px;font-weight:700;min-height:52px}
  #al-overlay .al-in:focus{outline:none}
  #al-overlay .al-in::-webkit-inner-spin-button,
  #al-overlay .al-in::-webkit-outer-spin-button,
  #al-overlay input[type="${_tipoNumCC()}"]::-webkit-inner-spin-button,
  #al-overlay input[type="${_tipoNumCC()}"]::-webkit-outer-spin-button{
    -webkit-appearance:none !important;appearance:none !important;
    margin:0 !important;display:none !important;width:0 !important}
  #al-overlay .al-in,#al-overlay input[type="${_tipoNumCC()}"]{-moz-appearance:textfield !important}
  /* Los nuestros: discretos y con el estilo de la casa. */
  #al-overlay .al-pasos{display:flex;flex-direction:column;border-left:1px solid #2b3139;flex:0 0 auto}
  #al-overlay .al-paso-b{width:38px;flex:1;display:grid;place-items:center;padding:0;cursor:pointer;
    background:transparent;border:none;color:#6b7681;transition:color .15s ease,background .15s ease}
  #al-overlay .al-paso-b:hover{color:var(--gold,#E8B84B);background:rgba(232,184,75,.07)}
  #al-overlay .al-paso-b:first-child{border-bottom:1px solid #2b3139}
  #al-overlay .al-paso-b svg{width:13px;height:13px}
  #al-overlay .al-ahora{font-family:var(--mono,monospace);font-size:11.5px;color:#7d8794;text-align:center;margin:9px 0 14px;min-height:16px}
  #al-overlay .al-ahora b{color:var(--gold,#E8B84B)}
  #al-overlay .al-titulo{font-family:var(--mono,monospace);font-size:9.5px;color:#7d8794;text-transform:uppercase;
    letter-spacing:1.1px;margin:22px 0 10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.07)}
  #al-overlay .al-lista{display:flex;flex-direction:column;gap:6px}
  #al-overlay .al-fila{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;
    background:rgba(255,255,255,.025);border:1px solid #2b3139}
  #al-overlay .al-fila.saltada{opacity:.55}
  #al-overlay .al-tx{flex:1;font-family:var(--sans,sans-serif);font-size:13px;color:#b7bdc6}
  #al-overlay .al-tx b{color:#eaecef}
  #al-overlay .al-ya{font-family:var(--mono,monospace);font-size:10px;color:var(--neon-lit,#2ee86a);
    padding:3px 9px;border-radius:20px;background:rgba(46,232,106,.12)}
  #al-overlay .al-del{width:34px;height:34px;flex:0 0 auto;border-radius:9px;padding:0;display:grid;place-items:center;
    background:transparent;border:1px solid #3a424c;color:#7d8794;cursor:pointer}
  .al-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9999;max-width:calc(100vw - 32px);
    padding:14px 20px;border-radius:14px;background:linear-gradient(180deg,#1b2027,#0d1117);
    border:1px solid var(--gold-soft,#C9A84B);box-shadow:0 10px 30px rgba(0,0,0,.6);
    font-family:var(--sans,sans-serif);font-size:13px;color:#eaecef}
  .al-toast b{display:block;font-family:var(--display,sans-serif);color:var(--gold,#E8B84B);font-size:12px;margin-bottom:3px}

  @media(max-width:560px){
    #al-overlay{padding:9px}
    #al-overlay .pv-c{padding:18px 14px;border-radius:17px}
    #al-overlay .al-campos{flex-direction:column}
  }`;
  document.head.appendChild(s);
}

/* Punto de entrada. Inyecta sus estilos y abre la ventana. */
export function abrir() { estilos(); return abrirAlertas(); }
