/* panel.js — Panel administrativo (página propia). Solo owners (verificación on-chain).
   Web: sidebar 256px + KPIs + grid. Móvil: menú hamburguesa + tarjetas apiladas.
   Dark-first, números tabulares, color solo para estado financiero. */
import * as datos from './panel-datos.js?v=3';
import * as wallet from '../wallet.js?v=125';

const $ = (id) => document.getElementById(id);
let _css = false;

/* ═══════════ CSS ═══════════ */
function inyectarCSS() {
  if (_css) return; _css = true;
  const s = document.createElement('style'); s.id = 'adm2-css';
  s.textContent = `
  #adm2{position:fixed;inset:0;z-index:400;background:#0a0e14;color:#e7ecf2;font-family:var(--display,'Segoe UI',sans-serif);display:flex;overflow:hidden}
  #adm2 *{box-sizing:border-box}
  /* Sidebar */
  #adm2 .adm-side{width:256px;flex:none;background:#0d131c;border-right:1px solid #1b2531;display:flex;flex-direction:column;transition:transform .25s;z-index:3}
  #adm2 .adm-brand{display:flex;align-items:center;gap:10px;padding:18px 18px 16px;border-bottom:1px solid #1b2531}
  #adm2 .adm-brand b{font-size:16px;font-weight:800}
  #adm2 .adm-brand small{color:#5f6b7a;font-size:10.5px;display:block;margin-top:1px}
  #adm2 .adm-logo{width:38px;height:38px;border-radius:50%;background:linear-gradient(180deg,#232b34,#151b22);display:grid;place-items:center;color:#5f6b7a;font-weight:900;flex:none;overflow:hidden;position:relative;border:2px solid #E8B84B}
  #adm2 .adm-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  #adm2 .adm-brand b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
  #adm2 .adm-nav{flex:1;overflow-y:auto;padding:10px 10px 20px}
  #adm2 .adm-nav button{width:100%;display:flex;align-items:center;gap:11px;padding:10px 12px;margin-bottom:3px;border:0;background:none;color:#8a95a3;border-radius:9px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600;text-align:left}
  #adm2 .adm-nav button:hover{background:rgba(255,255,255,.04);color:#e7ecf2}
  #adm2 .adm-nav button.on{background:rgba(232,184,75,.1);color:#E8B84B}
  #adm2 .adm-nav button svg{width:18px;height:18px;flex:none}
  #adm2 .adm-side-foot{padding:12px;border-top:1px solid #1b2531}
  #adm2 .adm-side-foot .adm-wallet{font-family:var(--mono,monospace);font-size:11px;color:#5f6b7a;margin-bottom:8px;word-break:break-all}
  #adm2 .adm-close{width:100%;padding:9px;border:1px solid #2a3644;background:rgba(255,255,255,.03);color:#aab6c4;border-radius:9px;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600}
  /* Main */
  #adm2 .adm-main{flex:1;display:flex;flex-direction:column;min-width:0}
  #adm2 .adm-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 22px;border-bottom:1px solid #1b2531;flex:none}
  #adm2 .adm-top h1{font-size:19px;font-weight:800;margin:0}
  #adm2 .adm-burger{display:none;width:38px;height:38px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #1b2531;color:#e7ecf2;cursor:pointer}
  #adm2 .adm-body{flex:1;overflow-y:auto;padding:22px}
  /* KPIs */
  #adm2 .adm-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
  #adm2 .adm-kpi{background:linear-gradient(180deg,#111925,#0d131c);border:1px solid #1b2531;border-radius:14px;padding:16px 18px}
  #adm2 .adm-kpi .k-l{font-size:11.5px;color:#5f6b7a;font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px}
  #adm2 .adm-kpi .k-v{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.5px}
  #adm2 .adm-kpi .k-s{font-size:11.5px;margin-top:6px;font-variant-numeric:tabular-nums}
  #adm2 .adm-kpi .k-s.up{color:#34d399} #adm2 .adm-kpi .k-s.dn{color:#f87171} #adm2 .adm-kpi .k-s.mut{color:#5f6b7a}
  #adm2 .adm-kpi .k-ic{width:30px;height:30px;border-radius:8px;background:rgba(232,184,75,.1);color:#E8B84B;display:grid;place-items:center;float:right;margin-top:-2px}
  /* Paneles */
  #adm2 .adm-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
  #adm2 .adm-card{background:linear-gradient(180deg,#111925,#0d131c);border:1px solid #1b2531;border-radius:14px;padding:18px}
  #adm2 .adm-card h3{font-size:14px;font-weight:700;margin:0 0 14px}
  #adm2 .col-8{grid-column:span 8} #adm2 .col-4{grid-column:span 4} #adm2 .col-6{grid-column:span 6} #adm2 .col-12{grid-column:span 12}
  /* tabla simple */
  #adm2 .adm-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #161f2b;font-size:13px}
  #adm2 .adm-row:last-child{border-bottom:0}
  #adm2 .adm-row .r-v{font-weight:700;font-variant-numeric:tabular-nums}
  #adm2 .adm-empty{color:#5f6b7a;font-size:12.5px;text-align:center;padding:24px}
  #adm2 .adm-skel{color:#3a4552}
  /* acceso denegado */
  #adm2 .adm-deny{margin:auto;text-align:center;max-width:340px;padding:40px 24px}
  #adm2 .adm-deny .d-ic{width:64px;height:64px;border-radius:50%;background:rgba(248,113,113,.12);color:#f87171;display:grid;place-items:center;margin:0 auto 18px}
  #adm2 .adm-deny h2{font-size:20px;margin:0 0 10px}
  #adm2 .adm-deny p{color:#8a95a3;font-size:13.5px;line-height:1.6}
  /* Overlay móvil del sidebar */
  #adm2 .adm-scrim{display:none;position:absolute;inset:0;background:rgba(0,0,0,.5);z-index:2}
  @media(max-width:860px){
    #adm2 .adm-side{position:absolute;left:0;top:0;bottom:0;transform:translateX(-100%)}
    #adm2.side-open .adm-side{transform:translateX(0)}
    #adm2.side-open .adm-scrim{display:block}
    #adm2 .adm-burger{display:grid;place-items:center}
    #adm2 .adm-kpis{grid-template-columns:repeat(2,1fr);gap:10px}
    #adm2 .adm-kpi .k-v{font-size:22px}
    #adm2 .adm-body{padding:16px}
    #adm2 .col-8,#adm2 .col-4,#adm2 .col-6{grid-column:span 12}
  }
  @media(max-width:480px){ #adm2 .adm-kpis{grid-template-columns:1fr} }

  #adm2 .adm-search-inp{background:rgba(11,14,17,.72);border:1px solid #1b2531;border-radius:10px;padding:9px 13px;color:#e7ecf2;font-family:inherit;font-size:13px;outline:none;min-width:220px}
  #adm2 .adm-search-inp:focus{border-color:rgba(232,184,75,.4)}
  #adm2 .adm-utable{display:flex;flex-direction:column}
  #adm2 .adm-urow{display:flex;align-items:center;gap:13px;padding:12px 4px;border-bottom:1px solid #161f2b}
  #adm2 .adm-urow:last-child{border-bottom:0}
  #adm2 .adm-uava{width:40px;height:40px;border-radius:50%;background:linear-gradient(180deg,#232b34,#151b22);display:grid;place-items:center;color:#8a95a3;font-weight:800;flex:none;overflow:hidden;position:relative;border:1px solid #2a3644}
  #adm2 .adm-uava img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  #adm2 .adm-uinfo{flex:1;min-width:0}
  #adm2 .adm-uname{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #adm2 .adm-uaddr{font-size:11.5px;color:#5f6b7a;font-family:var(--mono,monospace);margin-top:2px}
  #adm2 .adm-uright{display:flex;align-items:center;gap:10px;flex:none}
  #adm2 .adm-tag{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:100px}
  #adm2 .adm-tag.ok{background:rgba(52,211,153,.14);color:#34d399}
  #adm2 .adm-tag.bad{background:rgba(248,113,113,.14);color:#f87171}
  #adm2 .adm-ubtn{font-size:12px;font-weight:700;padding:7px 14px;border-radius:9px;border:1px solid rgba(248,113,113,.4);background:rgba(248,113,113,.1);color:#f87171;cursor:pointer;font-family:inherit}
  #adm2 .adm-ubtn:hover{background:rgba(248,113,113,.18)}
  #adm2 .adm-ubtn.un{border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.1);color:#34d399}
  #adm2 .adm-ubtn:disabled{opacity:.5;cursor:default}
  @media(max-width:860px){ #adm2 .adm-search-inp{min-width:0;width:100%} #adm2 .adm-uright{flex-direction:column;align-items:flex-end;gap:6px} }
    `;
  document.head.appendChild(s);
}

const IC = {
  resumen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3.5-6 7-6s7 2 7 6"/><path d="M16 4a3.5 3.5 0 0 1 0 7"/></svg>',
  fin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  serv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/></svg>',
  disp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 2 20h20L12 2z"/><path d="M12 9v5M12 17h.01"/></svg>',
  seg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h2"/></svg>',
  op: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg>',
  stk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>'
};

const SECCIONES = [
  { id: 'resumen', t: 'Summary', ic: IC.resumen },
  { id: 'usuarios', t: 'Users', ic: IC.users },
  { id: 'finanzas', t: 'Finance', ic: IC.fin },
  { id: 'servicios', t: 'Services', ic: IC.serv },
  { id: 'disputas', t: 'Marketplace', ic: IC.disp },
  { id: 'seguridad', t: 'Security', ic: IC.seg }
];
let _sec = 'resumen';

/* ═══════════ Abrir el panel (verifica owner on-chain) ═══════════ */
export async function abrirPanel() {
  inyectarCSS();
  const prev = $('adm2'); if (prev) prev.remove();
  const cont = document.createElement('div'); cont.id = 'adm2';
  document.body.appendChild(cont);
  // pantalla de carga breve mientras verifica
  cont.innerHTML = `<div class="adm-deny"><div class="adm-skel">Checking access…</div></div>`;
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  const ok = await datos.esOwner(cuenta);
  if (!ok) { pintarDenegado(cont); return; }
  pintarPanel(cont, cuenta);
}

function pintarDenegado(cont) {
  cont.innerHTML = `<div class="adm-deny">
    <div class="d-ic"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg></div>
    <h2>Access restricted</h2>
    <p>This area is only available to platform owners. Your connected wallet does not have owner permissions.</p>
    <button class="adm-close" id="adm-x" style="margin-top:20px;max-width:160px">Close</button>
  </div>`;
  $('adm-x').onclick = () => cont.remove();
}

function pintarPanel(cont, cuenta) {
  cont.innerHTML = `
  <div class="adm-scrim" id="adm-scrim"></div>
  <aside class="adm-side">
    <div class="adm-brand" id="adm-brand"><div class="adm-logo" id="adm-logo">A</div><div style="min-width:0"><b id="adm-name">Owner</b><small id="adm-wa">…</small></div></div>
    <nav class="adm-nav" id="adm-nav">
      ${SECCIONES.map(s => `<button data-sec="${s.id}" class="${s.id===_sec?'on':''}">${s.ic}<span>${s.t}</span></button>`).join('')}
    </nav>
    <div class="adm-side-foot">
      <button class="adm-close" id="adm-x">Close panel</button>
    </div>
  </aside>
  <div class="adm-main">
    <div class="adm-top">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="adm-burger" id="adm-burger"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg></button>
        <h1 id="adm-title">Summary</h1>
      </div>
    </div>
    <div class="adm-body" id="adm-body"></div>
  </div>`;
  $('adm-x').onclick = () => cont.remove();
  $('adm-burger').onclick = () => cont.classList.toggle('side-open');
  // Cabecera: foto (Firestore/caché) + nombre + últimas 4 de la wallet.
  (async () => {
    try {
      const wa = $('adm-wa'); if (wa) wa.textContent = '…' + cuenta.slice(-5);
      let foto = ''; let nombre = '';
      try { foto = localStorage.getItem('aurex-foto:' + cuenta.toLowerCase()) || ''; nombre = localStorage.getItem('aurex-nombre:' + cuenta.toLowerCase()) || ''; } catch (_) {}
      if (!foto || !nombre) { try { const pr = await datos.perfilDe(cuenta); if (pr.foto) foto = pr.foto; if (pr.nombre) nombre = pr.nombre; } catch (_) {} }
      const lg = $('adm-logo'); if (lg && foto) lg.innerHTML = `<img src="${foto}" alt="">`;
      const nm = $('adm-name'); if (nm && nombre) nm.textContent = nombre;
    } catch (_) {}
  })();
  $('adm-scrim').onclick = () => cont.classList.remove('side-open');
  $('adm-nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sec]'); if (!b) return;
    _sec = b.dataset.sec;
    document.querySelectorAll('#adm-nav button').forEach(x => x.classList.toggle('on', x.dataset.sec===_sec));
    $('adm-title').textContent = SECCIONES.find(s=>s.id===_sec).t;
    cont.classList.remove('side-open');
    render();
  });
  render();
}

/* ═══════════ Router de secciones ═══════════ */
function render() {
  const body = $('adm-body'); if (!body) return;
  if (_sec === 'resumen') return renderResumen(body);
  if (_sec === 'usuarios') return renderUsuarios(body);
  body.innerHTML = `<div class="adm-empty">Section "${_sec}" — coming next.</div>`;
}

/* ── Sección Resumen ── */
async function renderResumen(body) {
  body.innerHTML = `
    <div class="adm-kpis" id="adm-kpis">
      ${kpiSkel('Total generated')}${kpiSkel('This month')}${kpiSkel('Users (wallets)')}${kpiSkel('To staking')}
    </div>
    <div class="adm-grid">
      <div class="adm-card col-8"><h3>Revenue by service</h3><div id="adm-serv"><div class="adm-empty adm-skel">Loading…</div></div></div>
      <div class="adm-card col-4"><h3>This month</h3><div id="adm-mes"><div class="adm-empty adm-skel">Loading…</div></div></div>
    </div>`;
  try {
    const r = await datos.resumenGeneral();
    $('adm-kpis').innerHTML =
      kpi('Total generated', '$'+fmt(r.generadoTotal), IC.money, `${r.operaciones} operations`, 'mut') +
      kpi('This month', '$'+fmt(r.mesGenerado), IC.op, `${r.mesWalletsNuevas} new this month`, r.mesWalletsNuevas>0?'up':'mut') +
      kpi('Users (wallets)', String(r.wallets), IC.wallet, 'unique wallets', 'mut') +
      kpi('To staking', '$'+fmt(r.aStaking), IC.stk, 'shared to stakers', 'mut');
    // resumen del mes
    $('adm-mes').innerHTML =
      row('Generated', '$'+fmt(r.mesGenerado)) + row('Operations', String(r.mesOperaciones)) +
      row('New users', String(r.mesWalletsNuevas)) + row('Period', String(r.mes));
    // por servicio
    const serv = await datos.porServicio();
    $('adm-serv').innerHTML = serv.length
      ? serv.map(s => row(nombreServicio(s.nombre)+` · ${s.operaciones} ops`, '$'+fmt(s.generado))).join('')
      : `<div class="adm-empty">No activity recorded yet.<br><small>Services will report once interconnected.</small></div>`;
  } catch (e) {
    $('adm-kpis').innerHTML = `<div class="adm-empty col-12">Could not load data. ${(e&&e.message)||''}</div>`;
  }
}


/* ── Sección Users: lista de wallets con foto/nombre, fecha, y bloquear ── */
async function renderUsuarios(body) {
  body.innerHTML = `
    <div class="adm-card col-12">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <h3 style="margin:0">Users</h3>
        <input id="adm-usearch" class="adm-search-inp" placeholder="Search by name or address…">
      </div>
      <div id="adm-ulist"><div class="adm-empty adm-skel">Loading users…</div></div>
    </div>`;
  let todos = [];
  try {
    const lista = await datos.listaWallets();
    if (!lista.length) { $('adm-ulist').innerHTML = `<div class="adm-empty">No users recorded yet.<br><small>Wallets appear here once they interact and services report to Accounting.</small></div>`; return; }
    // enriquecer con perfil (en tandas para no saturar)
    $('adm-ulist').innerHTML = `<div class="adm-empty adm-skel">Loading ${lista.length} wallets…</div>`;
    todos = await datos.walletsConPerfil(lista);
    pintarUsuarios(todos);
    const inp = $('adm-usearch');
    if (inp) inp.oninput = () => {
      const q = inp.value.trim().toLowerCase();
      pintarUsuarios(!q ? todos : todos.filter(u => (u.nombre||'').toLowerCase().includes(q) || u.wallet.toLowerCase().includes(q)));
    };
  } catch (e) { $('adm-ulist').innerHTML = `<div class="adm-empty">Could not load users. ${(e&&e.message)||''}</div>`; }
}
function pintarUsuarios(arr) {
  const box = $('adm-ulist'); if (!box) return;
  if (!arr.length) { box.innerHTML = `<div class="adm-empty">No matches.</div>`; return; }
  box.innerHTML = `<div class="adm-utable">${arr.map(filaUsuario).join('')}</div>`;
  box.querySelectorAll('[data-block]').forEach(b => {
    b.onclick = async () => {
      const addr = b.dataset.block; const bloquear = b.dataset.val === '1';
      b.disabled = true; b.textContent = bloquear ? 'Blocking…' : 'Unblocking…';
      try { await datos.bloquearWallet(addr, bloquear); render(); }
      catch (e) { b.disabled = false; b.textContent = bloquear ? 'Block' : 'Unblock'; }
    };
  });
}
function filaUsuario(u) {
  const foto = u.foto ? `<img src="${u.foto}" alt="">` : `<span>${(u.nombre||'?').slice(0,1).toUpperCase()}</span>`;
  const nombre = u.nombre ? escH(u.nombre) : '<i style="color:#5f6b7a">No name</i>';
  const corta = u.wallet.slice(0,6) + '…' + u.wallet.slice(-4);
  const fecha = u.cuando ? new Date(u.cuando*1000).toLocaleDateString('en-US', {year:'numeric',month:'short',day:'numeric'}) : '';
  const estado = u.bloqueada
    ? `<span class="adm-tag bad">Blocked</span>`
    : `<span class="adm-tag ok">Active</span>`;
  const btn = u.bloqueada
    ? `<button class="adm-ubtn un" data-block="${u.wallet}" data-val="0">Unblock</button>`
    : `<button class="adm-ubtn" data-block="${u.wallet}" data-val="1">Block</button>`;
  return `<div class="adm-urow">
    <div class="adm-uava">${foto}</div>
    <div class="adm-uinfo">
      <div class="adm-uname">${nombre}</div>
      <div class="adm-uaddr">${corta}${fecha?` · joined ${fecha}`:''}</div>
    </div>
    <div class="adm-uright">${estado}${btn}</div>
  </div>`;
}
function escH(s){return String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));}

function kpi(label, valor, ic, sub, cls) {
  return `<div class="adm-kpi"><div class="k-ic">${ic}</div><div class="k-l">${label}</div><div class="k-v">${valor}</div><div class="k-s ${cls||'mut'}">${sub}</div></div>`;
}
function kpiSkel(label) { return `<div class="adm-kpi"><div class="k-l">${label}</div><div class="k-v adm-skel">—</div><div class="k-s mut adm-skel">loading</div></div>`; }
function row(l, v) { return `<div class="adm-row"><span>${l}</span><span class="r-v">${v}</span></div>`; }
function fmt(n) { return Number(n||0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function nombreServicio(n) { const m = { gridbot:'Bots', swap:'Swap', mercadotokens:'Token listing', futuros:'Futures', academy:'Academy', prizepool:'Prize Pool', bridge:'Bridge' }; return m[n] || n; }
