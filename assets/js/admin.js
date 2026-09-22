// admin.js — Panel de control. Módulo independiente.
//
// SE ABRE con 5 clics en la esquina inferior izquierda. Si quien los da no es
// dueño de los contratos, no pasa absolutamente nada: ni se abre, ni avisa.
//
// ══════════════════════════════════════════════════════════════════════════
//  POR QUÉ ESTE PANEL NO PUEDE ROMPER NADA
// ══════════════════════════════════════════════════════════════════════════
//  1. No hay ejecución libre de funciones. Solo acciones preparadas.
//  2. Lo irreversible NO ESTÁ: traspasar la propiedad o renunciar a ella no se
//     puede hacer desde aquí. Son los "cables" que, cruzados, lo matan todo.
//  3. Cada ajuste enseña SU VALOR ACTUAL antes de que lo toques.
//  4. Cada campo tiene un mínimo y un máximo comprobados antes de firmar.
//  5. ENSAYO EN SECO: antes de firmar se le pregunta al contrato si lo va a
//     aceptar. Si no, se avisa con el motivo y no se gasta ni un céntimo.
//  6. DESHACER: se guarda el valor anterior y se restaura con un botón.
//  7. Todo se firma con la wallet. Sin firma del dueño, el contrato rechaza.

import * as ethers from './vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from './wallet.js?v=125';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ── Contratos ──────────────────────────────────────────────────────────── */
const C = {
  bots:   { dir: '0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B', nombre: 'Bots' },
  market: { dir: '0x1131c4760Da083aaFCf20d6848Af93A8a2edFb18', nombre: 'Marketplace' },
  prize:  { dir: '0x595CD563F236DAEba21219D60AEF656a750A8132', nombre: 'Prize Pool' },
  swap:   { dir: '0xa15794D9c313F3E2726ED1D45A1B6CC72BFA2a0c', nombre: 'Swap' }
};
const RPC = 'https://bsc-dataseed.binance.org';
const KEEPER = 'https://bolita-keeper-bot.yamicelanvivesqui.workers.dev';
const CERO = '0x0000000000000000000000000000000000000000';
/* La wallet que firma las operaciones de TODOS los bots. Si se queda sin BNB,
   la plataforma entera deja de operar. Es lo primero que hay que vigilar. */
const WALLET_KEEPER = '0x34D57FBdCD5D7254fdC111357f0f2b28562F4419';

const ABI_BASE = ['function owner() view returns (address)', 'function paused() view returns (bool)', 'function pause()', 'function unpause()'];
const ABI_MARKET = [...ABI_BASE,
  'function totalOrdenes() view returns (uint256)',
  'function ordenes(uint256) view returns (tuple(uint256 id,address vendedor,address comprador,address token,uint256 monto,uint256 liberado,uint16 tramos,uint16 tramosHechos,string moneda,string metodo,uint256 precioFiat,uint64 creadaEn,uint64 tomadaEn,uint64 ultimoMovEn,bool tramoPagado,uint8 estado,address arbitro,bool califVendedor,bool califComprador,uint8 tipo,string motivo,uint64 disputaEn,bool cancelaV,bool cancelaC))',
  'function resolverDisputa(uint256,bool)', 'function anularDisputa(uint256)',
  'function fianzaMinima() view returns (uint256)', 'function setFianzaMinima(uint256)',
  'function plazoPago() view returns (uint64)', 'function plazoConfirm() view returns (uint64)',
  'function plazoReserva() view returns (uint64)', 'function plazoDisputa() view returns (uint64)',
  'function setPlazos(uint64,uint64,uint64,uint64)',
  'function setArbitro(address,bool)'];
const ABI_PRIZE = [...ABI_BASE,
  'function currentRound() view returns (uint256)',
  'function rounds(uint256) view returns (tuple(uint8 state,uint64 startTime,uint64 endTime,uint64 drawRequestedAt,uint256 pool,uint256 tickets))',
  'function saldoGas() view returns (uint256,uint256,uint256)',
  'function gasFaltante() view returns (uint256)',
  'function sponsorWallet() view returns (address)',
  'function sponsorTarget() view returns (uint256)', 'function gasPerEntry() view returns (uint256)',
  'function setGasFunding(uint256,uint256)',
  'function bloqueoSalida() view returns (uint256)', 'function setBloqueoSalida(uint256)',
  'function cerrarRonda()', 'function forzarReembolso(uint256)', 'function destrabarSorteo(uint256) payable',
  'function sorteoAtascado(uint256) view returns (bool)'];
const ABI_BOTS = [...ABI_BASE,
  'function precioSub() view returns (uint256)',
  'function gasMinOp() view returns (uint256)',
  'function gasSaldo(address) view returns (uint256)',
  'function depositarGas() payable'];

/* ── Lectura y firma ────────────────────────────────────────────────────── */
let _p = null;
const lector = () => (_p ||= new ethers.JsonRpcProvider(RPC, 56, { staticNetwork: true }));
const leer = (dir, abi) => new ethers.Contract(dir, abi, lector());
async function firmante() {
  const prov = new ethers.BrowserProvider(window.ethereum);
  return prov.getSigner();
}
const escribir = async (dir, abi) => new ethers.Contract(dir, abi, await firmante());

async function permisos(cuenta) {
  if (!cuenta) return null;
  const yo = String(cuenta).toLowerCase();
  const r = {};
  await Promise.all(Object.entries(C).map(async ([k, c]) => {
    try { const o = await leer(c.dir, ABI_BASE).owner(); r[k] = { owner: o, mio: String(o).toLowerCase() === yo }; }
    catch (_) { r[k] = { owner: null, mio: false }; }
  }));
  r.alguno = Object.values(r).some((x) => x && x.mio);
  return r;
}

/* ══════════════════ APERTURA OCULTA ══════════════════ */
let _clics = 0, _t = null, _abriendo = false;
export function iniciarPanelOculto() {
  // PANEL VIEJO DESACTIVADO por seguridad. Se rehará en una sección propia.
  // No se crea la zona de clics ni se escucha nada: ninguna puerta abierta.
  return;
  /* eslint-disable no-unreachable */
  estilos();
  const z = document.createElement('div');
  z.id = 'adm-zona'; z.setAttribute('aria-hidden', 'true');
  document.body.appendChild(z);
  const golpe = async () => {
    _clics++; clearTimeout(_t); _t = setTimeout(() => { _clics = 0; }, 2500);
    if (_clics < 5 || _abriendo) return;
    _clics = 0; _abriendo = true;
    try {
      const cta = wallet.cuentaActual && wallet.cuentaActual();
      if (!cta) return;
      const p = await permisos(cta);
      if (!p || !p.alguno) return;
      abrir(cta, p);
    } catch (_) {} finally { _abriendo = false; }
  };
  z.addEventListener('click', golpe);
  z.addEventListener('touchend', (e) => { e.preventDefault(); golpe(); }, { passive: false });
}

/* ══════════════════ AVISOS ══════════════════ */
function decir(txt, clase = '') {
  const e = $('ad-msg'); if (!e) return;
  e.className = 'ad-msg ' + clase; e.textContent = txt;
  if (txt) setTimeout(() => { if (e.textContent === txt) { e.textContent = ''; e.className = 'ad-msg'; } }, 10000);
}

/**
 * Ejecuta una acción con TODAS las protecciones:
 *   1. ensayo en seco contra el contrato (sin gastar gas)
 *   2. confirmación explicando qué cambia y desde qué valor
 *   3. firma
 *   4. guarda el valor anterior por si quieres deshacer
 */
async function accionSegura({ dir, abi, fn, args, titulo, explica, anterior, deshacer, alTerminar }) {
  decir('Comprobando que el contrato lo acepta…', 'info');
  let c;
  try { c = await escribir(dir, abi); }
  catch (_) { decir('No se pudo conectar con tu wallet.', 'mal'); return; }
  try {
    await c[fn].staticCall(...args);
  } catch (e) {
    const m = String(e?.reason || e?.shortMessage || e?.message || e).replace(/^execution reverted:?\s*/i, '');
    decir('El contrato NO lo aceptaría: ' + m.slice(0, 110) + '\nNo se ha gastado nada. Revisa los datos.', 'mal');
    return;
  }
  decir('');
  confirmar({
    titulo,
    texto: explica + (anterior !== undefined ? `<div class="ad-antes"><i>Valor actual</i>${esc(anterior)}</div>` : '')
  }, async () => {
    try {
      decir('Firma en tu wallet…', 'info');
      const tx = await c[fn](...args);
      await tx.wait();
      if (deshacer) guardarDeshacer(deshacer);
      decir('Hecho.' + (deshacer ? ' Puedes deshacerlo desde el Resumen.' : ''), 'ok');
      if (alTerminar) alTerminar();
    } catch (e) {
      const m = String(e?.shortMessage || e?.reason || e?.message || e);
      decir(/reject|denied|cancel/i.test(m) ? 'Cancelaste la firma.' : 'No se pudo: ' + m.slice(0, 110), 'mal');
    }
  });
}

function confirmar({ titulo, texto, ok = 'Aplicar' }, alAceptar) {
  const d = document.createElement('div');
  d.className = 'ad-conf';
  d.innerHTML = `<div class="ad-conf-bg"></div>
    <div class="ad-conf-c">
      <div class="ad-conf-t">${titulo}</div>
      <div class="ad-conf-s">${texto}</div>
      <div class="ad-conf-acts"><button class="ad-b gris" data-no>Cancelar</button><button class="ad-b" data-si>${ok}</button></div>
      <div class="ad-conf-n">Se firma con tu wallet. Nada cambia hasta que firmes.</div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  d.querySelector('.ad-conf-bg').onclick = q;
  d.querySelector('[data-no]').onclick = q;
  d.querySelector('[data-si]').onclick = () => { q(); alAceptar(); };
}

/* ── Deshacer ── */
const CLAVE_UNDO = 'aurex-admin-undo';
function guardarDeshacer(u) {
  try {
    const l = JSON.parse(localStorage.getItem(CLAVE_UNDO) || '[]');
    l.unshift({ ...u, cuando: Date.now() });
    localStorage.setItem(CLAVE_UNDO, JSON.stringify(l.slice(0, 10)));
  } catch (_) {}
}
const listaDeshacer = () => { try { return JSON.parse(localStorage.getItem(CLAVE_UNDO) || '[]'); } catch (_) { return []; } };
function quitarDeshacer(i) {
  try { const l = listaDeshacer(); l.splice(i, 1); localStorage.setItem(CLAVE_UNDO, JSON.stringify(l)); } catch (_) {}
}

/* ── Formulario con límites comprobados ── */
function pedir(titulo, campos, alAceptar) {
  const d = document.createElement('div');
  d.className = 'ad-conf';
  d.innerHTML = `<div class="ad-conf-bg"></div>
    <div class="ad-conf-c">
      <div class="ad-conf-t">${titulo}</div>
      ${campos.map((c) => `<label class="ad-lab">${esc(c.lab)}
        <input class="ad-in" data-k="${c.id}" value="${esc(c.val ?? '')}" placeholder="${esc(c.ph || '')}">
        ${c.pista ? `<span class="ad-pista">${esc(c.pista)}</span>` : ''}</label>`).join('')}
      <div class="ad-err" id="ad-err"></div>
      <div class="ad-conf-acts"><button class="ad-b gris" data-no>Cancelar</button><button class="ad-b" data-si>Continuar</button></div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  const fallo = (t) => { const e = d.querySelector('#ad-err'); if (e) e.textContent = t; };
  d.querySelector('.ad-conf-bg').onclick = q;
  d.querySelector('[data-no]').onclick = q;
  d.querySelector('[data-si]').onclick = () => {
    const v = {}; d.querySelectorAll('.ad-in').forEach((i) => { v[i.dataset.k] = i.value.trim(); });
    for (const c of campos) {
      const val = v[c.id];
      if (c.tipo === 'numero') {
        const n = Number(String(val).replace(',', '.'));
        if (!isFinite(n)) return fallo(`"${c.lab}": escribe un número.`);
        if (c.min !== undefined && n < c.min) return fallo(`"${c.lab}": el mínimo permitido es ${c.min}.`);
        if (c.max !== undefined && n > c.max) return fallo(`"${c.lab}": el máximo permitido es ${c.max}.`);
        v[c.id] = n;
      }
      if (c.tipo === 'wallet' && !/^0x[0-9a-fA-F]{40}$/.test(val)) return fallo(`"${c.lab}": esa dirección no es válida.`);
      if (c.tipo === 'si_no') {
        if (!/^(si|sí|no)$/i.test(val)) return fallo(`"${c.lab}": escribe SI o NO.`);
        v[c.id] = /^(si|sí)$/i.test(val);
      }
    }
    q(); alAceptar(v);
  };
}

/* ══════════════════ PANEL ══════════════════ */
function abrir(cuenta, perm) {
  const prev = $('adm-panel'); if (prev) prev.remove();
  const d = document.createElement('div');
  d.id = 'adm-panel';
  d.innerHTML = `<div class="ad-bg"></div>
    <div class="ad-c">
      <div class="ad-cab">
        <div><div class="ad-t">Panel de control</div>
        <div class="ad-s">${wallet.abreviar(cuenta)} · verificado en la cadena</div></div>
        <button class="ad-x" aria-label="Cerrar">✕</button>
      </div>
      <div class="ad-seguro">Este panel <b>no puede romper nada</b>: cada cambio se prueba antes de firmar, tiene límites, y se puede deshacer. Lo irreversible no está aquí.</div>
      <div class="ad-tabs">
        <button class="ad-tab on" data-p="resumen">Resumen</button>
        <button class="ad-tab" data-p="fondear">Fondear</button>
        <button class="ad-tab" data-p="disputas">Disputas</button>
        <button class="ad-tab" data-p="sorteo">Sorteo</button>
        <button class="ad-tab" data-p="ajustes">Ajustes</button>
        <button class="ad-tab" data-p="emergencia">Emergencia</button>
      </div>
      <div class="ad-pane on" id="ad-resumen"><div class="ad-cargando">Leyendo la cadena…</div></div>
      <div class="ad-pane" id="ad-fondear"></div>
      <div class="ad-pane" id="ad-disputas"></div>
      <div class="ad-pane" id="ad-sorteo"></div>
      <div class="ad-pane" id="ad-ajustes"></div>
      <div class="ad-pane" id="ad-emergencia"></div>
      <div class="ad-msg" id="ad-msg"></div>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => { const e = $('adm-panel'); if (e) e.remove(); };
  d.querySelector('.ad-bg').onclick = cerrar;
  d.querySelector('.ad-x').onclick = cerrar;
  d.querySelectorAll('.ad-tab').forEach((b) => b.onclick = () => {
    d.querySelectorAll('.ad-tab').forEach((x) => x.classList.remove('on'));
    d.querySelectorAll('.ad-pane').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    const pane = $('ad-' + b.dataset.p); if (pane) pane.classList.add('on');
    ({ resumen: () => resumen(cuenta, perm), fondear: () => fondear(cuenta, perm), disputas: () => disputas(perm), sorteo: () => sorteo(perm),
       ajustes: () => ajustes(perm), emergencia: () => emergencia(perm) }[b.dataset.p] || (() => {}))();
  });
  resumen(cuenta, perm);
}

/* ── Botones de ayuda: cada ajuste explica qué es y qué pasa si lo cambias ── */
const AYUDA = {
  keeper: ['La wallet del keeper', 'Es una wallet nuestra que firma las compras y ventas de todos los bots de todos los usuarios. Cada operación le cuesta unos 0,00002 BNB. Si se queda vacía, ningún bot vuelve a operar hasta que la recargues. Con 0,05 BNB aguanta miles de operaciones.'],
  sponsor: ['El gas del sorteo', 'Cada sorteo pide un número aleatorio verificable, y eso cuesta gas. Esta wallet lo paga. Se rellena sola con la parte que aporta cada participante, así que en condiciones normales no hay que tocarla.'],
  gasbot: ['El gas de tus bots', 'Es tu saldo personal dentro del contrato, el mismo que ves en la pantalla principal. Cada bot tuyo descuenta de aquí cuando compra o vende. Es tuyo y puedes retirarlo cuando quieras.'],
  fianza: ['La fianza del vendedor', 'Dinero que un vendedor deja depositado antes de poder publicar. Si pierde una disputa, se usa para compensar al comprador. Cuanto más alta, más confianza da la plataforma, pero menos vendedores se animan a entrar. Lo habitual son 20 USDT.'],
  plazos: ['Los plazos', 'Cuánto tiempo tiene cada uno para hacer su parte. Si alguien se pasa del plazo, el sistema resuelve solo: devuelve la cripto o libera la operación. Plazos muy cortos generan cancelaciones injustas; muy largos dejan el dinero bloqueado demasiado tiempo.'],
  arbitros: ['Los árbitros', 'Wallets que pueden resolver disputas además de la tuya. Útil si delegas la atención al cliente. Ojo: un árbitro decide quién se queda el dinero en un conflicto, así que dáselo solo a alguien de máxima confianza.'],
  gasauto: ['El gas automático', 'Cada persona que entra al sorteo aporta una pizca de BNB para el gas, y el sistema mantiene un saldo objetivo en la wallet. Así el sorteo se paga solo sin que tengas que estar pendiente.'],
  bloqueo: ['El bloqueo de salida', 'Horas antes del cierre en las que ya nadie puede retirar su aporte. Existe para que nadie infle el pozo para atraer gente y se marche justo antes del sorteo. Lo razonable son 24 horas.'],
  congelar: ['Congelar un contrato', 'Impide crear operaciones nuevas mientras resuelves un problema. El dinero que ya está dentro sigue seguro y la gente puede retirarlo. Se reanuda con un clic.']
};
const info = (k) => `<button class="ad-i" data-info="${k}" type="button" aria-label="Qué es esto">i</button>`;
function wireInfo() {
  document.querySelectorAll('#adm-panel [data-info]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    const a = AYUDA[b.dataset.info]; if (!a) return;
    confirmarSolo(a[0], a[1]);
  });
}
function confirmarSolo(titulo, texto) {
  const d = document.createElement('div');
  d.className = 'ad-conf';
  d.innerHTML = `<div class="ad-conf-bg"></div>
    <div class="ad-conf-c">
      <div class="ad-conf-t">${esc(titulo)}</div>
      <div class="ad-conf-s">${esc(texto)}</div>
      <div class="ad-conf-acts"><button class="ad-b" data-ok>Entendido</button></div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  d.querySelector('.ad-conf-bg').onclick = q;
  d.querySelector('[data-ok]').onclick = q;
}

const bnb = (v, d = 5) => Number(ethers.formatEther(v)).toFixed(d);
const usdt = (v, d = 2) => Number(ethers.formatUnits(v, 18)).toFixed(d);

/* ── RESUMEN ── */
async function resumen(cuenta, perm) {
  const box = $('ad-resumen'); if (!box) return;
  let m = {}, p = {}, keeper = null, usuarios = null, botsVivos = null, keeperVivo = false;
  try { const c = leer(C.market.dir, ABI_MARKET); m.total = Number(await c.totalOrdenes()); m.pausado = await c.paused().catch(() => false); } catch (_) {}
  try {
    const c = leer(C.prize.dir, ABI_PRIZE);
    p.ronda = Number(await c.currentRound());
    const r = await c.rounds(p.ronda);
    p.estado = Number(r.state); p.pozo = r.pool; p.tickets = Number(r.tickets);
    const g = await c.saldoGas(); p.gas = g[0] + g[1];
    p.pausado = await c.paused().catch(() => false);
  } catch (_) {}
  try {
    keeper = await (await fetch(KEEPER + '/estado', { cache: 'no-store' })).text();
    usuarios = (keeper.match(/Cuentas vigiladas:\s*(\d+)/) || [])[1];
    botsVivos = (keeper.match(/Bots encontrados:\s*(\d+)/) || [])[1];
    const hace = (keeper.match(/hace (\d+) s/) || [])[1];
    keeperVivo = hace !== undefined && Number(hace) < 300;
  } catch (_) {}

  const ESTADOS = ['Abierta', 'Sorteando', 'Cerrada', 'Reembolsada'];
  const gasBajo = p.gas !== undefined && p.gas < 4000000000000000n;
  box.innerHTML = `
    <div class="ad-grid">
      <div class="ad-kpi"><span>Usuarios con bots</span><b>${usuarios ?? '—'}</b></div>
      <div class="ad-kpi"><span>Bots trabajando</span><b>${botsVivos ?? '—'}</b></div>
      <div class="ad-kpi"><span>Publicaciones Market</span><b>${m.total ?? '—'}</b></div>
      <div class="ad-kpi"><span>Ronda del sorteo</span><b>#${p.ronda ?? '—'} <i>${ESTADOS[p.estado] || ''}</i></b></div>
      <div class="ad-kpi"><span>Pozo</span><b>${p.pozo != null ? usdt(p.pozo) : '—'} <i>USDT</i></b></div>
      <div class="ad-kpi ${gasBajo ? 'alerta' : ''}"><span>Gas del sorteo</span><b>${p.gas != null ? bnb(p.gas) : '—'} <i>BNB</i></b></div>
    </div>
    ${gasBajo ? `<div class="ad-alerta">El gas del sorteo está bajo. Puedes recargarlo en la pestaña <b>Sorteo</b>.</div>` : ''}
    ${(m.pausado || p.pausado) ? `<div class="ad-alerta">Congelado ahora mismo: ${m.pausado ? 'Marketplace ' : ''}${p.pausado ? 'Prize Pool' : ''}. Se reanuda en <b>Emergencia</b>.</div>` : ''}

    <div class="ad-sec">Keeper (el que ejecuta los bots)</div>
    <div class="ad-fila">
      <div class="ad-fila-tx"><b>${keeperVivo ? 'Trabajando' : 'Sin señal reciente'}</b><span>${keeperVivo ? 'ha corrido hace menos de 5 minutos' : 'comprueba que esté encendido'}</span></div>
      <a class="ad-link" href="${KEEPER}/estado" target="_blank" rel="noopener">detalle ↗</a>
    </div>

    <div class="ad-sec">Contratos</div>
    ${Object.entries(C).map(([k, c]) => `<div class="ad-fila">
      <div class="ad-fila-tx"><b>${c.nombre}</b><span>${perm[k]?.mio ? 'mandas tú' : 'lo lleva otra wallet'}</span></div>
      <a class="ad-link" href="https://bscscan.com/address/${c.dir}" target="_blank" rel="noopener">ver ↗</a></div>`).join('')}
    ${pintarDeshacer()}`;
  wireDeshacer(() => resumen(cuenta, perm));
}

function pintarDeshacer() {
  const l = listaDeshacer();
  if (l.length === 0) return '';
  return `<div class="ad-sec">Deshacer cambios recientes</div>` + l.map((u, i) => `
    <div class="ad-fila">
      <div class="ad-fila-tx"><b>${esc(u.que)}</b><span>volver a ${esc(u.antesTxt)}</span></div>
      <button class="ad-link btn" data-undo="${i}">deshacer</button>
    </div>`).join('');
}
function wireDeshacer(recargar) {
  document.querySelectorAll('[data-undo]').forEach((b) => b.onclick = () => {
    const i = Number(b.dataset.undo), u = listaDeshacer()[i];
    if (!u) return;
    accionSegura({
      dir: u.dir, abi: u.abi, fn: u.fn,
      args: u.args.map((x) => (typeof x === 'string' && /^\d+$/.test(x) ? BigInt(x) : x)),
      titulo: 'Deshacer: ' + u.que,
      explica: `Se deja como estaba: <b>${esc(u.antesTxt)}</b>.`,
      alTerminar: () => { quitarDeshacer(i); recargar(); }
    });
  });
}

/* ── FONDEAR: todo el dinero que hay que mantener, en un sitio ── */
async function fondear(cuenta, perm) {
  const box = $('ad-fondear'); if (!box) return;
  box.innerHTML = `<div class="ad-cargando">Mirando los saldos…</div>`;

  const saldo = async (dir) => { try { return await lector().getBalance(dir); } catch (_) { return null; } };
  const bKeeper = await saldo(WALLET_KEEPER);
  let bSponsor = null, sponsor = null, gasMios = null, minOp = null;
  try {
    const p = leer(C.prize.dir, ABI_PRIZE);
    sponsor = await p.sponsorWallet();
    if (sponsor === CERO) sponsor = null; else bSponsor = await saldo(sponsor);
  } catch (_) {}
  try {
    const b = leer(C.bots.dir, ABI_BOTS);
    gasMios = await b.gasSaldo(cuenta);
    minOp = await b.gasMinOp();
  } catch (_) {}

  const ops = (g, m) => (g != null && m && m > 0n) ? Math.floor(Number(g) / Number(m)) : null;
  const semaforo = (v, bajo, medio) => v == null ? '' : (v < bajo ? 'mal' : (v < medio ? 'medio' : 'bien'));

  box.innerHTML = `
    <p class="ad-intro">Aquí está todo el dinero que hay que mantener para que la plataforma funcione. Enviar BNB es una transferencia normal: no toca ningún contrato ni puede romper nada.</p>

    <div class="ad-card ${semaforo(bKeeper, 5000000000000000n, 20000000000000000n)}">
      <div class="ad-card-cab">
        <div>
          <div class="ad-card-t">Wallet del keeper ${info('keeper')}</div>
          <div class="ad-card-d">Es la que firma las compras y ventas de <b>todos</b> los bots. Si se queda sin BNB, la plataforma deja de operar.</div>
        </div>
        <div class="ad-card-val"><b>${bKeeper != null ? bnb(bKeeper) : '—'}</b><span>BNB</span></div>
      </div>
      <div class="ad-card-pie">
        <span class="ad-hint">${bKeeper != null ? `le alcanza para unas ${ops(bKeeper, 30000000000000n) ?? '—'} operaciones` : 'no se pudo leer'}</span>
        <button class="ad-b" id="f-keeper">Enviar BNB</button>
      </div>
    </div>

    <div class="ad-card ${semaforo(bSponsor, 3000000000000000n, 15000000000000000n)}">
      <div class="ad-card-cab">
        <div>
          <div class="ad-card-t">Gas del sorteo ${info('sponsor')}</div>
          <div class="ad-card-d">Paga el número aleatorio de cada sorteo. Se rellena sola con lo que aporta cada participante; solo hay que tocarla si se vacía.</div>
        </div>
        <div class="ad-card-val"><b>${bSponsor != null ? bnb(bSponsor) : '—'}</b><span>BNB</span></div>
      </div>
      <div class="ad-card-pie">
        <span class="ad-hint">${sponsor ? wallet.abreviar(sponsor) : 'sin configurar'}</span>
        <button class="ad-b" id="f-sponsor" ${sponsor ? '' : 'disabled'}>Enviar BNB</button>
      </div>
    </div>

    <div class="ad-card ${semaforo(gasMios, minOp ? minOp * 20n : 0n, minOp ? minOp * 100n : 0n)}">
      <div class="ad-card-cab">
        <div>
          <div class="ad-card-t">Gas de tus propios bots ${info('gasbot')}</div>
          <div class="ad-card-d">Es tu saldo personal como usuario, el mismo que ves en la pantalla principal. Sirve para que tus bots paguen sus operaciones.</div>
        </div>
        <div class="ad-card-val"><b>${gasMios != null ? bnb(gasMios) : '—'}</b><span>BNB</span></div>
      </div>
      <div class="ad-card-pie">
        <span class="ad-hint">${gasMios != null && minOp ? `unas ${ops(gasMios, minOp) ?? '—'} operaciones` : ''}</span>
        <button class="ad-b" id="f-gasbot">Recargar</button>
      </div>
    </div>

    <div class="ad-sec">Enviar BNB a un contrato</div>
    <p class="ad-intro chico">Solo si algún contrato necesita BNB suelto. Normalmente no hace falta.</p>
    <div class="ad-chips">
      ${Object.entries(C).map(([k, c]) => `<button class="ad-chip" data-fc="${k}">${c.nombre}</button>`).join('')}
    </div>`;

  const enviarA = (destino, titulo, sug = '0.02') => pedir(titulo, [
    { id: 'v', lab: 'Cuánto BNB', val: sug, tipo: 'numero', min: 0.0005, max: 5,
      pista: 'Es una transferencia normal desde tu wallet. Puedes empezar con poco y repetir.' }
  ], async (v) => {
    try {
      const s = await firmante();
      decir('Firma en tu wallet…', 'info');
      const tx = await s.sendTransaction({ to: destino, value: ethers.parseEther(String(v.v)) });
      await tx.wait();
      decir(`Enviados ${v.v} BNB.`, 'ok');
      fondear(cuenta, perm);
    } catch (e) {
      const m = String(e?.shortMessage || e?.message || e);
      decir(/reject|denied|cancel/i.test(m) ? 'Cancelaste la firma.' : 'No se pudo: ' + m.slice(0, 100), 'mal');
    }
  });

  $('f-keeper').onclick = () => enviarA(WALLET_KEEPER, 'Recargar la wallet del keeper', '0.05');
  if ($('f-sponsor') && sponsor) $('f-sponsor').onclick = () => enviarA(sponsor, 'Recargar el gas del sorteo', '0.02');
  $('f-gasbot').onclick = () => pedir('Recargar el gas de tus bots', [
    { id: 'v', lab: 'Cuánto BNB depositar', val: '0.01', tipo: 'numero', min: 0.001, max: 1,
      pista: 'Va al contrato de bots, a tu nombre. Puedes retirarlo cuando quieras desde la pantalla principal.' }
  ], (v) => accionSegura({
    dir: C.bots.dir, abi: ABI_BOTS, fn: 'depositarGas', args: [{ value: ethers.parseEther(String(v.v)) }],
    titulo: 'Recargar el gas de tus bots',
    explica: `Depositas <b>${v.v} BNB</b> para que tus bots paguen sus operaciones. Es tuyo y lo puedes retirar cuando quieras.`,
    anterior: gasMios != null ? bnb(gasMios) + ' BNB' : undefined,
    alTerminar: () => fondear(cuenta, perm)
  }));

  box.querySelectorAll('[data-fc]').forEach((b) => b.onclick = () => {
    const c = C[b.dataset.fc];
    enviarA(c.dir, `Enviar BNB a ${c.nombre}`, '0.01');
  });
  wireInfo();
}

/* ── DISPUTAS ── */
async function disputas(perm) {
  const box = $('ad-disputas'); if (!box) return;
  if (!perm.market?.mio) { box.innerHTML = `<div class="ad-vacio">Esta wallet no lleva el Marketplace.</div>`; return; }
  box.innerHTML = `<div class="ad-cargando">Buscando disputas…</div>`;
  try {
    const c = leer(C.market.dir, ABI_MARKET);
    const total = Number(await c.totalOrdenes());
    const ids = []; for (let i = total; i >= 1; i--) ids.push(i);
    const ords = (await Promise.all(ids.map((i) => c.ordenes(i).catch(() => null)))).filter(Boolean);
    const dis = ords.filter((o) => Number(o.estado) === 4);
    if (dis.length === 0) { box.innerHTML = `<div class="ad-vacio">No hay disputas abiertas.<br>Todo tranquilo.</div>`; return; }
    box.innerHTML = `<div class="ad-nota">Lee el motivo y los comprobantes antes de decidir. Si no resuelves en 48 h, el sistema devuelve la cripto al vendedor solo.</div>` +
      dis.map((o) => `<div class="ad-caso">
        <div class="ad-caso-cab"><b>Orden #${o.id}</b><span>${usdt(o.monto)} · ${Number(o.tramosHechos)}/${Number(o.tramos)} partes</span></div>
        <div class="ad-caso-p"><i>Vendedor</i>${wallet.abreviar(o.vendedor)}</div>
        <div class="ad-caso-p"><i>Comprador</i>${o.comprador && o.comprador !== CERO ? wallet.abreviar(o.comprador) : '—'}</div>
        ${o.motivo ? `<div class="ad-motivo"><i>Lo que dice quien abrió la disputa</i>${esc(o.motivo)}</div>` : '<div class="ad-caso-p"><i>Sin explicación</i></div>'}
        <div class="ad-acts">
          <button class="ad-b" data-dc="${o.id}">Razón al comprador</button>
          <button class="ad-b gris" data-dv="${o.id}">Razón al vendedor</button>
          <button class="ad-b gris" data-da="${o.id}">Anular</button>
        </div></div>`).join('');

    const liga = (attr, titulo, explica, fn, mk) => box.querySelectorAll('[' + attr + ']').forEach((b) => b.onclick = () => {
      const id = BigInt(b.getAttribute(attr));
      accionSegura({ dir: C.market.dir, abi: ABI_MARKET, fn, args: mk(id), titulo, explica, alTerminar: () => disputas(perm) });
    });
    liga('data-dc', 'Dar la razón al comprador', 'El comprador recibirá la parte en disputa. Si falta dinero, se completa con la fianza del vendedor. Lo demás vuelve al vendedor.', 'resolverDisputa', (id) => [id, true]);
    liga('data-dv', 'Dar la razón al vendedor', 'La cripto que queda trabada vuelve al vendedor y la operación se cierra.', 'resolverDisputa', (id) => [id, false]);
    liga('data-da', 'Anular la disputa', 'Se cierra sin culpables: la cripto vuelve al vendedor. Para cuando fue un malentendido.', 'anularDisputa', (id) => [id]);
  } catch (e) {
    box.innerHTML = `<div class="ad-vacio">No se pudo leer: ${esc(e?.message || e)}</div>`;
  }
}

/* ── SORTEO ── */
async function sorteo(perm) {
  const box = $('ad-sorteo'); if (!box) return;
  if (!perm.prize?.mio) { box.innerHTML = `<div class="ad-vacio">Esta wallet no lleva el Prize Pool.</div>`; return; }
  box.innerHTML = `<div class="ad-cargando">Leyendo la ronda…</div>`;
  try {
    const c = leer(C.prize.dir, ABI_PRIZE);
    const ronda = Number(await c.currentRound());
    const r = await c.rounds(ronda);
    let sponsor = null, saldoSp = '—';
    try { sponsor = await c.sponsorWallet(); if (sponsor === CERO) sponsor = null; } catch (_) {}
    if (sponsor) { try { saldoSp = bnb(await lector().getBalance(sponsor)); } catch (_) {} }
    const objetivo = await c.sponsorTarget().catch(() => 0n);
    const porEntrada = await c.gasPerEntry().catch(() => 0n);
    const bloqueo = await c.bloqueoSalida().catch(() => 0n);
    const atascado = await c.sorteoAtascado(ronda).catch(() => false);
    const ESTADOS = ['Abierta', 'Sorteando', 'Cerrada', 'Reembolsada'];

    box.innerHTML = `
      <div class="ad-grid">
        <div class="ad-kpi"><span>Ronda</span><b>#${ronda}</b></div>
        <div class="ad-kpi"><span>Estado</span><b>${ESTADOS[Number(r.state)] || '—'}</b></div>
        <div class="ad-kpi"><span>Pozo</span><b>${usdt(r.pool)} <i>USDT</i></b></div>
        <div class="ad-kpi"><span>Participaciones</span><b>${Number(r.tickets)}</b></div>
      </div>
      <div class="ad-nota">Cierra el <b>${new Date(Number(r.endTime) * 1000).toLocaleString('es')}</b>.</div>
      ${atascado ? `<div class="ad-alerta">El sorteo lleva más de 20 minutos esperando. Puedes destrabarlo abajo.</div>` : ''}

      <div class="ad-sec">Gas del sorteo</div>
      <div class="ad-fila">
        <div class="ad-fila-tx"><b>${saldoSp} BNB en la wallet de gas</b><span>${sponsor ? wallet.abreviar(sponsor) : 'sin configurar'} · se rellena sola con cada participación</span></div>
      </div>
      <div class="ad-acts col">
        <button class="ad-b" id="s-gas" ${sponsor ? '' : 'disabled'}>Recargar la wallet de gas</button>
        ${atascado ? `<button class="ad-b" id="s-destrabar">Destrabar el sorteo</button>` : ''}
      </div>

      <div class="ad-sec">Ajustes</div>
      <div class="ad-ajuste">
        <div class="ad-ajuste-tx"><b>Aporte de cada participante al gas ${info('gasauto')}</b><span>Ahora: ${bnb(porEntrada, 5)} BNB · el sistema mantiene ${bnb(objetivo, 4)} BNB en la wallet</span></div>
        <button class="ad-link btn" id="s-fund">cambiar</button>
      </div>
      <div class="ad-ajuste">
        <div class="ad-ajuste-tx"><b>Bloqueo de salida antes del cierre ${info('bloqueo')}</b><span>Ahora: ${Math.round(Number(bloqueo) / 3600)} horas</span></div>
        <button class="ad-link btn" id="s-bloq">cambiar</button>
      </div>

      <div class="ad-sec">Operaciones de la ronda</div>
      <div class="ad-acts col">
        <button class="ad-b gris" id="s-cerrar">Cerrar la ronda y sortear ya</button>
        <button class="ad-b gris" id="s-reemb">Devolver el dinero a todos</button>
      </div>
      <div class="ad-nota">Son operativas: cerrar antes de tiempo, o cancelar devolviendo el dinero. No rompen nada; la siguiente ronda arranca igual.</div>`;

    wireInfo();
    if ($('s-gas')) $('s-gas').onclick = () => pedir('Recargar la wallet de gas', [
      { id: 'v', lab: 'Cuánto BNB enviar', val: '0.02', tipo: 'numero', min: 0.001, max: 1, pista: 'Con 0.02 BNB sobra para muchos sorteos.' }
    ], async (v) => {
      try {
        const s = await firmante();
        decir('Firma en tu wallet…', 'info');
        const tx = await s.sendTransaction({ to: sponsor, value: ethers.parseEther(String(v.v)) });
        await tx.wait(); decir('Gas recargado.', 'ok'); sorteo(perm);
      } catch (e) { decir('No se pudo: ' + (e?.shortMessage || e?.message || e), 'mal'); }
    });

    if ($('s-destrabar')) $('s-destrabar').onclick = async () => {
      const falta = await c.gasFaltante().catch(() => 0n);
      accionSegura({
        dir: C.prize.dir, abi: ABI_PRIZE, fn: 'destrabarSorteo', args: [BigInt(ronda), { value: falta }],
        titulo: 'Destrabar el sorteo',
        explica: `Se pone el gas que falta (<b>${bnb(falta)} BNB</b>) y se pide de nuevo el número aleatorio. El sorteo se hace al momento.`,
        alTerminar: () => sorteo(perm)
      });
    };

    $('s-fund').onclick = () => pedir('Gas automático', [
      { id: 'obj', lab: 'BNB que se mantiene en la wallet de gas', val: bnb(objetivo, 4), tipo: 'numero', min: 0.005, max: 0.5, pista: 'Recomendado: 0.02' },
      { id: 'por', lab: 'BNB que aporta cada participante', val: bnb(porEntrada, 5), tipo: 'numero', min: 0.0001, max: 0.01, pista: 'Recomendado: 0.0005 (unos 30 céntimos)' }
    ], (v) => accionSegura({
      dir: C.prize.dir, abi: ABI_PRIZE, fn: 'setGasFunding',
      args: [ethers.parseEther(String(v.obj)), ethers.parseEther(String(v.por))],
      titulo: 'Cambiar el gas automático',
      explica: `Cada participante aportará <b>${v.por} BNB</b> y el sistema mantendrá <b>${v.obj} BNB</b> en la wallet de gas.`,
      anterior: `${bnb(porEntrada, 5)} por participante · ${bnb(objetivo, 4)} de objetivo`,
      deshacer: { que: 'Gas automático', antesTxt: `${bnb(porEntrada, 5)} / ${bnb(objetivo, 4)} BNB`, dir: C.prize.dir, abi: ABI_PRIZE, fn: 'setGasFunding', args: [objetivo.toString(), porEntrada.toString()] },
      alTerminar: () => sorteo(perm)
    }));

    $('s-bloq').onclick = () => pedir('Bloqueo de salida', [
      { id: 'h', lab: 'Horas antes del cierre', val: String(Math.round(Number(bloqueo) / 3600)), tipo: 'numero', min: 1, max: 168, pista: 'Recomendado: 24. Impide que alguien infle el pozo y se marche antes del sorteo.' }
    ], (v) => accionSegura({
      dir: C.prize.dir, abi: ABI_PRIZE, fn: 'setBloqueoSalida', args: [BigInt(Math.round(v.h * 3600))],
      titulo: 'Cambiar el bloqueo de salida',
      explica: `Nadie podrá retirar su aporte en las <b>${v.h} horas</b> previas al cierre.`,
      anterior: `${Math.round(Number(bloqueo) / 3600)} horas`,
      deshacer: { que: 'Bloqueo de salida', antesTxt: `${Math.round(Number(bloqueo) / 3600)} h`, dir: C.prize.dir, abi: ABI_PRIZE, fn: 'setBloqueoSalida', args: [bloqueo.toString()] },
      alTerminar: () => sorteo(perm)
    }));

    $('s-cerrar').onclick = () => accionSegura({
      dir: C.prize.dir, abi: ABI_PRIZE, fn: 'cerrarRonda', args: [],
      titulo: 'Cerrar la ronda ahora',
      explica: 'Se cierra antes de tiempo y se sortea. Si no hay participantes suficientes, se devuelve el dinero a todos automáticamente.',
      alTerminar: () => sorteo(perm)
    });

    $('s-reemb').onclick = () => accionSegura({
      dir: C.prize.dir, abi: ABI_PRIZE, fn: 'forzarReembolso', args: [BigInt(ronda)],
      titulo: 'Devolver el dinero a todos',
      explica: `Todos los participantes de la ronda <b>#${ronda}</b> recuperan su aporte y no habrá ganadores. Para cuando algo salió mal.`,
      alTerminar: () => sorteo(perm)
    });
  } catch (e) {
    box.innerHTML = `<div class="ad-vacio">No se pudo leer: ${esc(e?.message || e)}</div>`;
  }
}

/* ── AJUSTES (Marketplace) ── */
async function ajustes(perm) {
  const box = $('ad-ajustes'); if (!box) return;
  if (!perm.market?.mio) { box.innerHTML = `<div class="ad-vacio">Esta wallet no lleva el Marketplace.</div>`; return; }
  box.innerHTML = `<div class="ad-cargando">Leyendo la configuración…</div>`;
  try {
    const c = leer(C.market.dir, ABI_MARKET);
    const fianza = await c.fianzaMinima().catch(() => 0n);
    const pPago = await c.plazoPago().catch(() => 0n);
    const pConf = await c.plazoConfirm().catch(() => 0n);
    const pRes = await c.plazoReserva().catch(() => 0n);
    const pDis = await c.plazoDisputa().catch(() => 0n);
    const min = (v) => Math.round(Number(v) / 60);

    box.innerHTML = `
      <div class="ad-nota">Cada ajuste enseña su valor de ahora y tiene un mínimo y un máximo. Antes de firmar se comprueba con el contrato, así que no puede quedar en un estado imposible.</div>
      <div class="ad-ajuste">
        <div class="ad-ajuste-tx"><b>Fianza mínima del vendedor ${info('fianza')}</b><span>Ahora: ${usdt(fianza)} USDT · su garantía si pierde una disputa</span></div>
        <button class="ad-link btn" id="a-fianza">cambiar</button>
      </div>
      <div class="ad-ajuste">
        <div class="ad-ajuste-tx"><b>Plazos del Marketplace ${info('plazos')}</b><span>Pagar ${min(pPago)} min · confirmar ${min(pConf)} min · reserva ${min(pRes)} min · disputa ${min(pDis)} min</span></div>
        <button class="ad-link btn" id="a-plazos">cambiar</button>
      </div>
      <div class="ad-ajuste">
        <div class="ad-ajuste-tx"><b>Árbitros de disputas ${info('arbitros')}</b><span>Wallets que pueden resolver casos, además de la tuya</span></div>
        <button class="ad-link btn" id="a-arb">gestionar</button>
      </div>
      ${pintarDeshacer()}`;
    wireDeshacer(() => ajustes(perm));
    wireInfo();

    $('a-fianza').onclick = () => pedir('Fianza mínima', [
      { id: 'v', lab: 'USDT que debe depositar un vendedor', val: usdt(fianza), tipo: 'numero', min: 0, max: 1000, pista: 'Recomendado: 20. A más fianza, más confianza, pero menos vendedores.' }
    ], (v) => accionSegura({
      dir: C.market.dir, abi: ABI_MARKET, fn: 'setFianzaMinima', args: [ethers.parseUnits(String(v.v), 18)],
      titulo: 'Cambiar la fianza mínima',
      explica: `Los vendedores nuevos tendrán que depositar <b>${v.v} USDT</b> para publicar. A los que ya venden no les afecta.`,
      anterior: `${usdt(fianza)} USDT`,
      deshacer: { que: 'Fianza mínima', antesTxt: `${usdt(fianza)} USDT`, dir: C.market.dir, abi: ABI_MARKET, fn: 'setFianzaMinima', args: [fianza.toString()] },
      alTerminar: () => ajustes(perm)
    }));

    $('a-plazos').onclick = () => pedir('Plazos (en minutos)', [
      { id: 'pago', lab: 'Para que el comprador pague', val: String(min(pPago)), tipo: 'numero', min: 10, max: 1440, pista: 'Recomendado: 60' },
      { id: 'conf', lab: 'Para que el vendedor confirme', val: String(min(pConf)), tipo: 'numero', min: 10, max: 1440, pista: 'Recomendado: 120' },
      { id: 'res', lab: 'Que dura una reserva', val: String(min(pRes)), tipo: 'numero', min: 30, max: 10080, pista: 'Recomendado: 1440 (un día)' },
      { id: 'dis', lab: 'Para resolver una disputa', val: String(min(pDis)), tipo: 'numero', min: 60, max: 20160, pista: 'Recomendado: 2880 (dos días)' }
    ], (v) => accionSegura({
      dir: C.market.dir, abi: ABI_MARKET, fn: 'setPlazos',
      args: [BigInt(Math.round(v.pago * 60)), BigInt(Math.round(v.conf * 60)), BigInt(Math.round(v.res * 60)), BigInt(Math.round(v.dis * 60))],
      titulo: 'Cambiar los plazos',
      explica: `Pagar en <b>${v.pago} min</b>, confirmar en <b>${v.conf} min</b>, reserva de <b>${v.res} min</b> y disputas en <b>${v.dis} min</b>.`,
      anterior: `${min(pPago)} / ${min(pConf)} / ${min(pRes)} / ${min(pDis)} min`,
      deshacer: { que: 'Plazos del Marketplace', antesTxt: `${min(pPago)}/${min(pConf)}/${min(pRes)}/${min(pDis)} min`, dir: C.market.dir, abi: ABI_MARKET, fn: 'setPlazos', args: [pPago.toString(), pConf.toString(), pRes.toString(), pDis.toString()] },
      alTerminar: () => ajustes(perm)
    }));

    $('a-arb').onclick = () => pedir('Árbitro de disputas', [
      { id: 'dir', lab: 'Wallet del árbitro', val: '', tipo: 'wallet', ph: '0x…', pista: 'Podrá resolver disputas de otros usuarios. Dáselo solo a alguien de confianza.' },
      { id: 'ok', lab: '¿Le das permiso? Escribe SI o NO', val: 'SI', tipo: 'si_no' }
    ], (v) => accionSegura({
      dir: C.market.dir, abi: ABI_MARKET, fn: 'setArbitro', args: [v.dir, v.ok],
      titulo: v.ok ? 'Dar permiso de árbitro' : 'Quitar permiso de árbitro',
      explica: v.ok
        ? `<b>${esc(v.dir)}</b> podrá resolver disputas. Tú sigues pudiendo hacerlo igual.`
        : `<b>${esc(v.dir)}</b> dejará de poder resolver disputas.`,
      deshacer: { que: 'Árbitro ' + v.dir.slice(0, 10), antesTxt: v.ok ? 'sin permiso' : 'con permiso', dir: C.market.dir, abi: ABI_MARKET, fn: 'setArbitro', args: [v.dir, !v.ok] },
      alTerminar: () => ajustes(perm)
    }));
  } catch (e) {
    box.innerHTML = `<div class="ad-vacio">No se pudo leer: ${esc(e?.message || e)}</div>`;
  }
}

/* ── EMERGENCIA ── */
async function emergencia(perm) {
  const box = $('ad-emergencia'); if (!box) return;
  const est = async (dir) => { try { return await leer(dir, ABI_BASE).paused(); } catch (_) { return null; } };
  const pm = await est(C.market.dir), pp = await est(C.prize.dir);

  box.innerHTML = `
    <div class="ad-nota">
      Congelar un contrato es <b>la red de seguridad</b>, no un peligro: impide crear operaciones nuevas mientras resuelves un problema.
      <b>El dinero de la gente sigue seguro y se puede retirar igual.</b> Se reanuda con un clic cuando quieras.
    </div>
    <div class="ad-ajuste">
      <div class="ad-ajuste-tx"><b>Marketplace</b><span>${pm === null ? 'no se pudo leer' : pm ? 'CONGELADO ahora mismo' : 'funcionando con normalidad'}</span></div>
      <button class="ad-link btn ${pm ? 'ok' : 'rojo'}" id="e-m" ${perm.market?.mio && pm !== null ? '' : 'disabled'}>${pm ? 'reanudar' : 'congelar'}</button>
    </div>
    <div class="ad-ajuste">
      <div class="ad-ajuste-tx"><b>Prize Pool</b><span>${pp === null ? 'no se pudo leer' : pp ? 'CONGELADO ahora mismo' : 'funcionando con normalidad'}</span></div>
      <button class="ad-link btn ${pp ? 'ok' : 'rojo'}" id="e-p" ${perm.prize?.mio && pp !== null ? '' : 'disabled'}>${pp ? 'reanudar' : 'congelar'}</button>
    </div>

    <div class="ad-sec">Lo que este panel no hace, y por qué</div>
    <div class="ad-nota">
      <b>Traspasar o renunciar a la propiedad</b> de un contrato no está aquí a propósito: es lo único de verdad irreversible.
      Si alguna vez hiciera falta, se hace desde Remix con calma y la dirección comprobada dos veces.<br><br>
      <b>Ejecutar funciones sueltas a mano</b> tampoco: es la forma más fácil de romper algo sin darse cuenta.
      Si necesitas algo que no está aquí, pídelo y se añade como acción preparada, con sus límites y su ensayo previo.
    </div>`;

  const alternar = (id, dir, abi, nombre, estado) => {
    const b = $(id); if (!b || b.disabled) return;
    b.onclick = () => accionSegura({
      dir, abi, fn: estado ? 'unpause' : 'pause', args: [],
      titulo: estado ? `Reanudar ${nombre}` : `Congelar ${nombre}`,
      explica: estado
        ? `${nombre} vuelve a funcionar con normalidad.`
        : `Nadie podrá crear operaciones nuevas en ${nombre}. <b>El dinero de la gente sigue seguro</b> y se puede retirar. Se reanuda cuando quieras desde aquí.`,
      alTerminar: () => emergencia(perm)
    });
  };
  alternar('e-m', C.market.dir, ABI_MARKET, 'el Marketplace', pm);
  alternar('e-p', C.prize.dir, ABI_PRIZE, 'el Prize Pool', pp);
}

/* ── Estilos ── */
function estilos() {
  if ($('adm-css')) return;
  const s = document.createElement('style'); s.id = 'adm-css';
  s.textContent = `
  #adm-zona{position:fixed;left:0;bottom:0;width:54px;height:54px;z-index:9999;background:transparent}
  #adm-panel{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px}
  #adm-panel .ad-bg{position:absolute;inset:0;background:rgba(2,4,6,.93);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
  #adm-panel .ad-c{position:relative;width:100%;max-width:620px;max-height:calc(100vh - 32px);overflow-y:auto;background:linear-gradient(180deg,#12161c,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:18px;padding:20px}
  #adm-panel .ad-cab{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  #adm-panel .ad-t{font-family:var(--display,sans-serif);font-weight:800;font-size:21px;color:var(--gold,#E8B84B)}
  #adm-panel .ad-s{font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;margin-top:3px}
  #adm-panel .ad-x{width:34px;height:34px;flex:0 0 auto;border-radius:10px;display:grid;place-items:center;padding:0;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;cursor:pointer}
  #adm-panel .ad-seguro{margin:14px 0;padding:10px 12px;border-radius:11px;background:rgba(46,232,106,.07);border:1px solid rgba(46,232,106,.3);font-family:var(--sans,sans-serif);font-size:11.5px;color:#8b96a3;line-height:1.55}
  #adm-panel .ad-seguro b{color:var(--neon-lit,#2ee86a)}
  #adm-panel .ad-tabs{display:flex;gap:5px;overflow-x:auto;background:#0b0e12;border:1px solid #2b3139;border-radius:11px;padding:4px;margin-bottom:18px;scrollbar-width:none}
  #adm-panel .ad-tabs::-webkit-scrollbar{display:none}
  #adm-panel .ad-tab{flex:1 0 auto;min-height:38px;padding:0 13px;border:none;border-radius:8px;background:transparent;color:#b7bdc6;font-family:var(--display,sans-serif);font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}
  #adm-panel .ad-tab.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800}
  #adm-panel .ad-pane{display:none}
  #adm-panel .ad-pane.on{display:block}
  /* Ritmo de espacios: 8 / 12 / 18 / 26. Nada se toca con nada. */
  #adm-panel .ad-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:8px}
  #adm-panel .ad-intro{font-family:var(--sans,sans-serif);font-size:12.5px;color:#8b96a3;line-height:1.65;margin:0 0 18px}
  #adm-panel .ad-intro.chico{font-size:11.5px;margin-bottom:12px}
  /* Botón de ayuda: pequeño pero cómodo de tocar */
  #adm-panel .ad-i{display:inline-grid;place-items:center;width:17px;height:17px;margin-left:6px;padding:0;border-radius:50%;border:1px solid #4a535f;background:transparent;color:#8b96a3;font-family:var(--mono,monospace);font-size:9.5px;font-style:italic;cursor:pointer;vertical-align:middle;line-height:1;position:relative}
  #adm-panel .ad-i:after{content:'';position:absolute;inset:-9px}
  #adm-panel .ad-i:hover{color:var(--gold,#E8B84B);border-color:var(--gold-soft,#C9A84B)}
  /* Tarjeta de fondeo: cabecera, cifra grande, pie con acción */
  #adm-panel .ad-card{border:1px solid #2b3139;border-radius:14px;padding:16px;margin-bottom:12px;background:linear-gradient(180deg,rgba(255,255,255,.025),transparent)}
  #adm-panel .ad-card.bien{border-left:3px solid var(--neon-lit,#2ee86a)}
  #adm-panel .ad-card.medio{border-left:3px solid var(--gold,#E8B84B)}
  #adm-panel .ad-card.mal{border-left:3px solid var(--rojo,#f6465d)}
  #adm-panel .ad-card-cab{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
  #adm-panel .ad-card-t{font-family:var(--display,sans-serif);font-weight:800;font-size:15px;color:#eaecef;line-height:1.3}
  #adm-panel .ad-card-d{font-family:var(--sans,sans-serif);font-size:12px;color:#8b96a3;line-height:1.6;margin-top:6px;max-width:46ch}
  #adm-panel .ad-card-d b{color:#b7bdc6}
  #adm-panel .ad-card-val{flex:0 0 auto;text-align:right}
  #adm-panel .ad-card-val b{display:block;font-family:var(--display,sans-serif);font-size:22px;color:#eaecef;line-height:1.1}
  #adm-panel .ad-card-val span{display:block;font-family:var(--mono,monospace);font-size:9.5px;color:#6b7681;margin-top:3px;letter-spacing:.8px}
  #adm-panel .ad-card-pie{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:16px;padding-top:13px;border-top:1px solid rgba(255,255,255,.06)}
  #adm-panel .ad-hint{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;line-height:1.4}
  #adm-panel .ad-card-pie .ad-b{flex:0 0 auto;min-width:120px}
  #adm-panel .ad-chips{display:flex;gap:8px;flex-wrap:wrap}
  #adm-panel .ad-chip{padding:9px 14px;border-radius:20px;border:1px solid #3a424c;background:transparent;color:#b7bdc6;font-family:var(--mono,monospace);font-size:11px;cursor:pointer;min-height:36px}
  #adm-panel .ad-chip:hover{color:var(--gold,#E8B84B);border-color:var(--gold-soft,#C9A84B)}
  #adm-panel .ad-kpi{padding:11px 13px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid #2b3139}
  #adm-panel .ad-kpi.alerta{border-color:rgba(246,70,93,.45);background:rgba(246,70,93,.07)}
  #adm-panel .ad-kpi span{display:block;font-family:var(--mono,monospace);font-size:9px;color:#6b7681;text-transform:uppercase;letter-spacing:.7px}
  #adm-panel .ad-kpi b{display:block;font-family:var(--display,sans-serif);font-size:18px;color:#eaecef;margin-top:3px}
  #adm-panel .ad-kpi i{font-style:normal;font-size:11px;color:#7d8794}
  #adm-panel .ad-sec{font-family:var(--mono,monospace);font-size:9.5px;color:#7d8794;text-transform:uppercase;letter-spacing:1.1px;margin:26px 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.06)}
  #adm-panel .ad-fila,#adm-panel .ad-ajuste{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 15px;border-radius:12px;background:rgba(255,255,255,.02);border:1px solid #2b3139;margin-bottom:9px}
  #adm-panel .ad-fila-tx b,#adm-panel .ad-ajuste-tx b{display:block;font-family:var(--display,sans-serif);font-size:13.5px;color:#eaecef}
  #adm-panel .ad-fila-tx,#adm-panel .ad-ajuste-tx{min-width:0}
  #adm-panel .ad-fila-tx span,#adm-panel .ad-ajuste-tx span{display:block;font-family:var(--mono,monospace);font-size:10px;color:#7d8794;margin-top:5px;line-height:1.55}
  #adm-panel .ad-link{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;font-family:var(--mono,monospace);font-size:10.5px;color:var(--gold,#E8B84B);text-decoration:none;padding:8px 12px;border-radius:8px;border:1px solid #3a424c;background:transparent;cursor:pointer;min-height:34px}
  #adm-panel .ad-link.rojo{color:var(--rojo,#f6465d);border-color:rgba(246,70,93,.4)}
  #adm-panel .ad-link.ok{color:var(--neon-lit,#2ee86a);border-color:rgba(46,232,106,.4)}
  #adm-panel .ad-link[disabled]{opacity:.35;cursor:default}
  #adm-panel .ad-nota{font-family:var(--sans,sans-serif);font-size:12px;color:#8b96a3;line-height:1.65;padding:13px 15px;border-radius:12px;background:rgba(255,255,255,.03);border:1px dashed #3a424c;margin:14px 0}
  #adm-panel .ad-nota b{color:#eaecef}
  #adm-panel .ad-alerta{margin:10px 0;padding:11px 13px;border-radius:11px;background:rgba(246,70,93,.1);border:1px solid rgba(246,70,93,.4);color:#ffb3bd;font-family:var(--sans,sans-serif);font-size:12.5px;line-height:1.5}
  #adm-panel .ad-alerta b{color:#fff}
  #adm-panel .ad-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  #adm-panel .ad-acts.col{flex-direction:column}
  #adm-panel .ad-b{flex:1;min-width:130px;min-height:44px;padding:11px 13px;border-radius:11px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;font-family:var(--display,sans-serif);font-weight:800;font-size:12.5px;cursor:pointer;box-shadow:0 3px 0 #8f6a1a}
  #adm-panel .ad-b.gris,.ad-conf .ad-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:#b7bdc6;box-shadow:0 3px 0 rgba(0,0,0,.4)}
  #adm-panel .ad-b:disabled{opacity:.35;cursor:default;box-shadow:none}
  #adm-panel .ad-b:active{transform:translateY(2px)}
  #adm-panel .ad-caso{padding:13px;border-radius:13px;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid rgba(246,70,93,.35);margin-bottom:10px}
  #adm-panel .ad-caso-cab{display:flex;justify-content:space-between;gap:9px;font-family:var(--display,sans-serif);font-size:13.5px;color:#eaecef;margin-bottom:8px}
  #adm-panel .ad-caso-cab span{font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794}
  #adm-panel .ad-caso-p{font-family:var(--sans,sans-serif);font-size:12px;color:#b7bdc6;margin-bottom:4px}
  #adm-panel .ad-caso-p i,#adm-panel .ad-motivo i{font-style:normal;font-family:var(--mono,monospace);font-size:9px;color:#6b7681;text-transform:uppercase;letter-spacing:.6px;margin-right:7px}
  #adm-panel .ad-motivo{margin:8px 0;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid #3a424c;font-family:var(--sans,sans-serif);font-size:12.5px;color:#eaecef;line-height:1.55}
  #adm-panel .ad-motivo i{display:block;margin-bottom:4px}
  #adm-panel .ad-cargando,#adm-panel .ad-vacio{font-family:var(--mono,monospace);font-size:11.5px;color:#7d8794;text-align:center;padding:26px 10px;line-height:1.6}
  #adm-panel .ad-msg{font-family:var(--mono,monospace);font-size:11.5px;text-align:center;margin-top:14px;min-height:16px;line-height:1.5;white-space:pre-wrap}
  #adm-panel .ad-msg.ok{color:var(--neon-lit,#2ee86a)}
  #adm-panel .ad-msg.mal{color:var(--rojo,#f6465d)}
  #adm-panel .ad-msg.info{color:var(--gold,#E8B84B)}
  .ad-conf{position:fixed;inset:0;z-index:10010;display:flex;align-items:center;justify-content:center;padding:18px}
  .ad-conf .ad-conf-bg{position:absolute;inset:0;background:rgba(2,4,6,.9)}
  .ad-conf .ad-conf-c{position:relative;width:100%;max-width:410px;max-height:calc(100vh - 40px);overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:18px;padding:22px}
  .ad-conf .ad-conf-t{font-family:var(--display,sans-serif);font-weight:800;font-size:18px;color:var(--gold,#E8B84B);text-align:center}
  .ad-conf .ad-conf-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.6;margin:11px 0 16px}
  .ad-conf .ad-conf-s b{color:#eaecef}
  .ad-conf .ad-antes{margin-top:11px;padding:9px 11px;border-radius:9px;background:rgba(255,255,255,.03);border:1px solid #2b3139;font-family:var(--mono,monospace);font-size:11.5px;color:#b7bdc6}
  .ad-conf .ad-antes i{display:block;font-style:normal;font-size:8.5px;color:#6b7681;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px}
  .ad-conf .ad-conf-acts{display:flex;gap:9px}
  .ad-conf .ad-b{flex:1;min-height:46px;padding:12px;border-radius:11px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;font-family:var(--display,sans-serif);font-weight:800;font-size:13px;cursor:pointer}
  .ad-conf .ad-conf-n{font-family:var(--mono,monospace);font-size:9.5px;color:#6b7681;text-align:center;margin-top:11px}
  .ad-conf .ad-lab{display:block;font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.6px;margin-bottom:13px}
  .ad-conf .ad-in{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:11px;border-radius:10px;border:1px solid #2b3139;background:#0b0e12;color:#eaecef;font-family:var(--mono,monospace);font-size:13px;text-transform:none;letter-spacing:0}
  .ad-conf .ad-in:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  .ad-conf .ad-pista{display:block;margin-top:5px;font-family:var(--sans,sans-serif);font-size:11px;color:#6b7681;text-transform:none;letter-spacing:0;line-height:1.45}
  .ad-conf .ad-err{font-family:var(--sans,sans-serif);font-size:12px;color:var(--rojo,#f6465d);min-height:16px;margin-bottom:8px;line-height:1.4}
  @media(max-width:560px){
    #adm-panel{padding:10px}
    /* En el móvil las pestañas no caben en una fila: las repartimos en dos.
       Antes había que deslizar a ciegas y no se veían todas. */
    #adm-panel .ad-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;overflow:visible}
    #adm-panel .ad-tab{min-width:0;padding:0 6px;font-size:11px;min-height:40px}
    #adm-panel .ad-c{padding:16px 13px;border-radius:15px}
    #adm-panel .ad-t{font-size:18px}
    #adm-panel .ad-kpi b{font-size:16px}
    #adm-panel .ad-b{min-width:100%}
    #adm-panel .ad-fila,#adm-panel .ad-ajuste{flex-direction:column;align-items:stretch;gap:11px}
    #adm-panel .ad-card{padding:14px}
    #adm-panel .ad-card-cab{flex-direction:column;gap:12px}
    #adm-panel .ad-card-val{text-align:left}
    #adm-panel .ad-card-val b{font-size:26px}
    #adm-panel .ad-card-d{max-width:none}
    #adm-panel .ad-card-pie{flex-direction:column;align-items:stretch;gap:11px}
    #adm-panel .ad-card-pie .ad-b{min-width:100%}
    #adm-panel .ad-hint{text-align:center}
  }`;
  document.head.appendChild(s);
}
