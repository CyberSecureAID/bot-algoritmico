/* panel.js — Panel administrativo (página propia). Solo owners (verificación on-chain).
   Web: sidebar 256px + KPIs + grid. Móvil: menú hamburguesa + tarjetas apiladas.
   Dark-first, números tabulares, color solo para estado financiero. */
import * as datos from './panel-datos.js?v=2';
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
  #adm2 .adm-logo{width:34px;height:34px;border-radius:9px;background:linear-gradient(180deg,#f7db8d,#E8B84B 60%,#c79426);display:grid;place-items:center;color:#241900;font-weight:900;flex:none}
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
  { id: 'resumen', t: 'Resumen', ic: IC.resumen },
  { id: 'usuarios', t: 'Usuarios', ic: IC.users },
  { id: 'finanzas', t: 'Finanzas', ic: IC.fin },
  { id: 'servicios', t: 'Servicios', ic: IC.serv },
  { id: 'disputas', t: 'Marketplace', ic: IC.disp },
  { id: 'seguridad', t: 'Seguridad', ic: IC.seg }
];
let _sec = 'resumen';

/* ═══════════ Abrir el panel (verifica owner on-chain) ═══════════ */
export async function abrirPanel() {
  inyectarCSS();
  const prev = $('adm2'); if (prev) prev.remove();
  const cont = document.createElement('div'); cont.id = 'adm2';
  document.body.appendChild(cont);
  // pantalla de carga breve mientras verifica
  cont.innerHTML = `<div class="adm-deny"><div class="adm-skel">Verificando acceso…</div></div>`;
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
    <div class="adm-brand"><div class="adm-logo">A</div><div><b>Admin</b><small>Control panel</small></div></div>
    <nav class="adm-nav" id="adm-nav">
      ${SECCIONES.map(s => `<button data-sec="${s.id}" class="${s.id===_sec?'on':''}">${s.ic}<span>${s.t}</span></button>`).join('')}
    </nav>
    <div class="adm-side-foot">
      <div class="adm-wallet">${cuenta}</div>
      <button class="adm-close" id="adm-x">Close panel</button>
    </div>
  </aside>
  <div class="adm-main">
    <div class="adm-top">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="adm-burger" id="adm-burger"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg></button>
        <h1 id="adm-title">Resumen</h1>
      </div>
    </div>
    <div class="adm-body" id="adm-body"></div>
  </div>`;
  $('adm-x').onclick = () => cont.remove();
  $('adm-burger').onclick = () => cont.classList.toggle('side-open');
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
  body.innerHTML = `<div class="adm-empty">Section "${_sec}" — coming next.</div>`;
}

/* ── Sección Resumen ── */
async function renderResumen(body) {
  body.innerHTML = `
    <div class="adm-kpis" id="adm-kpis">
      ${kpiSkel('Generado total')}${kpiSkel('Este mes')}${kpiSkel('Usuarios (wallets)')}${kpiSkel('Al staking')}
    </div>
    <div class="adm-grid">
      <div class="adm-card col-8"><h3>Ingresos por servicio</h3><div id="adm-serv"><div class="adm-empty adm-skel">Cargando…</div></div></div>
      <div class="adm-card col-4"><h3>Resumen del mes</h3><div id="adm-mes"><div class="adm-empty adm-skel">Cargando…</div></div></div>
    </div>`;
  try {
    const r = await datos.resumenGeneral();
    $('adm-kpis').innerHTML =
      kpi('Generado total', '$'+fmt(r.generadoTotal), IC.money, `${r.operaciones} operaciones`, 'mut') +
      kpi('Este mes', '$'+fmt(r.mesGenerado), IC.op, `${r.mesWalletsNuevas} nuevos este mes`, r.mesWalletsNuevas>0?'up':'mut') +
      kpi('Usuarios (wallets)', String(r.wallets), IC.wallet, 'wallets únicas', 'mut') +
      kpi('Al staking', '$'+fmt(r.aStaking), IC.stk, 'repartido a stakers', 'mut');
    // resumen del mes
    $('adm-mes').innerHTML =
      row('Generado', '$'+fmt(r.mesGenerado)) + row('Operaciones', String(r.mesOperaciones)) +
      row('Nuevos usuarios', String(r.mesWalletsNuevas)) + row('Periodo', String(r.mes));
    // por servicio
    const serv = await datos.porServicio();
    $('adm-serv').innerHTML = serv.length
      ? serv.map(s => row(nombreServicio(s.nombre)+` · ${s.operaciones} ops`, '$'+fmt(s.generado))).join('')
      : `<div class="adm-empty">Aún no hay actividad registrada.<br><small>Los servicios empezarán a reportar cuando se interconecten.</small></div>`;
  } catch (e) {
    $('adm-kpis').innerHTML = `<div class="adm-empty col-12">No se pudieron cargar los datos. ${(e&&e.message)||''}</div>`;
  }
}

function kpi(label, valor, ic, sub, cls) {
  return `<div class="adm-kpi"><div class="k-ic">${ic}</div><div class="k-l">${label}</div><div class="k-v">${valor}</div><div class="k-s ${cls||'mut'}">${sub}</div></div>`;
}
function kpiSkel(label) { return `<div class="adm-kpi"><div class="k-l">${label}</div><div class="k-v adm-skel">—</div><div class="k-s mut adm-skel">cargando</div></div>`; }
function row(l, v) { return `<div class="adm-row"><span>${l}</span><span class="r-v">${v}</span></div>`; }
function fmt(n) { return Number(n||0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function nombreServicio(n) { const m = { gridbot:'Bots', swap:'Swap', mercadotokens:'Token listing', futuros:'Futures', academy:'Academy', prizepool:'Prize Pool', bridge:'Bridge' }; return m[n] || n; }
