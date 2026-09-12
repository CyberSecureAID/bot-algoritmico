// perfil.js — Panel de cuenta por wallet. Módulo independiente (no toca la lógica existente).
import * as gb from './gridbot.js?v=125';
import * as wallet from './wallet.js?v=125';
import * as avisos from './avisos.js?v=125';

const $ = (id) => document.getElementById(id);
const num = (n, d = 2) => { const x = Number(n); if (!isFinite(x)) return '—'; return x.toLocaleString('es', { minimumFractionDigits: d, maximumFractionDigits: d }); };
const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const claveNombre = (c) => 'aurex-nombre:' + (c || '').toLowerCase();
const leerNombre = (c) => { try { return localStorage.getItem(claveNombre(c)) || ''; } catch (_) { return ''; } };
const guardarNombre = (c, v) => { try { v ? localStorage.setItem(claveNombre(c), v) : localStorage.removeItem(claveNombre(c)); } catch (_) {} };

function desde(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* Consumo real del usuario, para el coste por operación. */
const _gasReal = { gastado: 0, ops: 0 };

function estilos() {
  if ($('perfil-css')) return;
  const s = document.createElement('style');
  s.id = 'perfil-css';
  s.textContent = `
  #perfil-overlay{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;background:rgba(3,5,8,.78);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);padding:18px}
  #perfil-overlay.show{display:flex}
  #perfil-overlay *{box-sizing:border-box}
  #perfil-overlay .pf-card{width:100%;max-width:720px;max-height:92vh;overflow:auto;background:linear-gradient(180deg,#12161c,#0b0e12);border:1px solid #2b3139;border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.04);padding:24px;position:relative;animation:pfIn .18s ease both}
  @keyframes pfIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  #perfil-overlay .pf-x{position:absolute;top:16px;right:16px;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid #2b3139;color:#7d8794;display:grid;place-items:center;cursor:pointer;font-size:15px;z-index:2}
  #perfil-overlay .pf-x:hover{color:#eaecef}

  /* Cabecera */
  #perfil-overlay .pf-h{display:flex;align-items:center;gap:15px;padding-right:40px;padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid #2b3139}
  #perfil-overlay .pf-ava{width:58px;height:58px;border-radius:16px;flex:0 0 auto;background:linear-gradient(160deg,#f7db8d,var(--gold,#E8B84B) 52%,#b98614);display:grid;place-items:center;color:#3a2800;box-shadow:0 5px 0 #8f6a1a,0 10px 22px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.5)}
  #perfil-overlay .pf-idcol{min-width:0;flex:1}
  #perfil-overlay .pf-name{display:flex;align-items:center;gap:8px;min-width:0}
  #perfil-overlay .pf-nombre{font-family:var(--display,sans-serif);font-weight:800;font-size:21px;color:#eaecef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #perfil-overlay .pf-setname{font-family:var(--display,sans-serif);font-weight:700;font-size:16px;color:var(--gold,#E8B84B);background:none;border:none;cursor:pointer;padding:0;display:inline-flex;align-items:center;gap:6px}
  #perfil-overlay .pf-pen{width:26px;height:26px;flex:0 0 auto;border-radius:7px;background:rgba(255,255,255,.05);border:1px solid #2b3139;color:#7d8794;display:grid;place-items:center;cursor:pointer}
  #perfil-overlay .pf-pen:hover{color:var(--gold,#E8B84B);border-color:rgba(232,184,75,.4)}
  #perfil-overlay .pf-nameedit{display:flex;gap:6px;align-items:center;width:100%}
  #perfil-overlay .pf-inp{flex:1;min-width:0;background:#0b0e12;border:1px solid var(--gold-soft,#C9A84B);border-radius:9px;color:#eaecef;font-family:var(--display,sans-serif);font-size:15px;font-weight:700;padding:8px 11px;outline:none}
  #perfil-overlay .pf-savebtn{flex:0 0 auto;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 50%,#c79426);border:1px solid #c79426;color:#3a2800;font-family:var(--mono,monospace);font-weight:800;font-size:12px;padding:9px 13px;border-radius:9px;cursor:pointer}
  #perfil-overlay .pf-addr{font-family:var(--mono,monospace);font-size:12px;color:#7d8794;display:inline-flex;align-items:center;gap:6px;margin-top:5px;cursor:pointer;user-select:none}
  #perfil-overlay .pf-addr:hover{color:var(--gold,#E8B84B)}
  #perfil-overlay .pf-hr{flex:0 0 auto;text-align:right}
  #perfil-overlay .pf-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 13px;border-radius:20px;font-family:var(--mono,monospace);font-size:12px;font-weight:800}
  #perfil-overlay .pf-on{background:rgba(46,232,106,.14);color:var(--neon-lit,#2ee86a);border:1px solid rgba(46,232,106,.42)}
  #perfil-overlay .pf-on i{width:7px;height:7px;border-radius:50%;background:var(--neon-lit,#2ee86a);box-shadow:0 0 7px var(--neon-lit,#2ee86a)}
  #perfil-overlay .pf-off{background:rgba(246,70,93,.13);color:var(--rojo,#f6465d);border:1px solid rgba(246,70,93,.42)}

  /* Rango */
  #perfil-overlay .pf-sk{display:inline-block;height:1em;min-width:46px;border-radius:5px;vertical-align:middle;background:linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.13) 50%,rgba(255,255,255,.05) 75%);background-size:220% 100%;animation:pfSk 1.1s ease-in-out infinite}
  #perfil-overlay .pf-kpi .pf-sk{height:19px;min-width:58px}
  #perfil-overlay .pf-tipo .pf-sk{min-width:20px;height:17px}
  #perfil-overlay .pf-hr .pf-sk{min-width:74px;height:24px;border-radius:20px}
  @keyframes pfSk{0%{background-position:120% 0}100%{background-position:-120% 0}}
  @media(prefers-reduced-motion:reduce){#perfil-overlay .pf-sk{animation:none}}
  #perfil-overlay .pf-tipos{display:grid;grid-template-columns:1fr 1fr;gap:9px}
  #perfil-overlay .pf-tipo{display:flex;align-items:center;gap:10px;padding:12px 13px;border-radius:12px;background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid #2b3139;box-shadow:0 3px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04)}
  #perfil-overlay .pf-tipo .ti{flex:0 0 auto;display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,.05);border:1px solid #2b3139}
  #perfil-overlay .pf-tipo .tn{flex:1;min-width:0;font-family:var(--mono,monospace);font-size:11.5px;color:#b7bdc6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #perfil-overlay .pf-tipo .tc{flex:0 0 auto;font-family:var(--display,sans-serif);font-weight:800;font-size:17px;color:#eaecef}
  #perfil-overlay .pf-sw2{position:relative;display:inline-block;width:44px;height:24px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid #3a424c;cursor:pointer;flex:0 0 auto;transition:background .18s,border-color .18s;vertical-align:middle}
  #perfil-overlay .pf-sw2>i{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#7d8794;transition:transform .2s ease,background .2s}
  #perfil-overlay .pf-sw2.on{background:rgba(46,232,106,.18);border-color:rgba(46,232,106,.5)}
  #perfil-overlay .pf-sw2.on>i{transform:translateX(20px);background:var(--neon-lit,#2ee86a);box-shadow:0 0 8px rgba(46,232,106,.7)}
  #perfil-overlay .pf-sw{position:relative;width:40px;height:22px;border-radius:20px;background:rgba(46,232,106,.2);border:1px solid rgba(46,232,106,.45);cursor:not-allowed;flex:0 0 auto;opacity:.75;transition:background .18s,border-color .18s}
  #perfil-overlay .pf-sw>i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#7d8794;transition:transform .2s ease,background .2s}
  #perfil-overlay .pf-sw.on>i{transform:translateX(18px);background:var(--neon-lit,#2ee86a);box-shadow:0 0 8px rgba(46,232,106,.7)}

  /* KPIs */
  #perfil-overlay .pf-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  #perfil-overlay .pf-kpi{background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid #2b3139;border-radius:13px;padding:14px 10px;text-align:center;box-shadow:0 4px 0 rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.04)}
  #perfil-overlay .pf-kpi .kl{font-family:var(--mono,monospace);font-size:9.5px;color:#7d8794;text-transform:uppercase;letter-spacing:.5px}
  #perfil-overlay .pf-kpi .kv{font-family:var(--display,sans-serif);font-weight:800;font-size:20px;color:#eaecef;margin-top:5px;line-height:1.1;word-break:break-word}
  #perfil-overlay .pf-kpi .kv small{font-size:11px;color:#7d8794;font-weight:400}
  #perfil-overlay .pf-kpi .kv.pos{color:var(--neon-lit,#2ee86a)} #perfil-overlay .pf-kpi .kv.neg{color:var(--rojo,#f6465d)}
  #perfil-overlay .pf-kpi .kv.oro{color:var(--gold,#E8B84B)}

  /* Secciones */
  #perfil-overlay .pf-sec{margin-bottom:16px}
  #perfil-overlay .pf-histtog{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;background:linear-gradient(180deg,#171c23,#0e1218);border:1px solid #2b3139;border-radius:14px;padding:14px 16px;cursor:pointer;font-family:var(--display,system-ui);font-weight:800;font-size:15px;color:#eef2f6;transition:border-color .15s,background .15s}
  #perfil-overlay .pf-histtog:hover{border-color:rgba(232,184,75,.5)}
  #perfil-overlay .pf-hist-ar{color:var(--gold,#E8B84B);transition:transform .2s}
  #perfil-overlay .pf-histtog[aria-expanded="true"] .pf-hist-ar{transform:rotate(180deg)}
  #perfil-overlay .pf-hist{margin-top:12px}
  #perfil-overlay .pf-hcarga{padding:26px;text-align:center;color:#7d8794;font-size:13px}
  #perfil-overlay .pf-hsect{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.9px;margin:16px 2px 8px;display:flex;align-items:center;gap:8px}
  #perfil-overlay .pf-hsect i{flex:1;height:1px;background:rgba(255,255,255,.08)}
  #perfil-overlay .pf-hrow{display:flex;align-items:center;gap:11px;padding:11px 12px;margin:6px 0;border-radius:12px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05)}
  #perfil-overlay .pf-htag{flex:0 0 auto;font-family:var(--display,system-ui);font-weight:800;font-size:10px;letter-spacing:.4px;padding:4px 8px;border-radius:7px}
  #perfil-overlay .pf-htag.c{background:rgba(46,232,106,.13);color:#39e07a;border:1px solid rgba(46,232,106,.35)}
  #perfil-overlay .pf-htag.v{background:rgba(246,70,93,.13);color:#ff6b7d;border:1px solid rgba(246,70,93,.35)}
  #perfil-overlay .pf-hinfo{flex:1;min-width:0}
  #perfil-overlay .pf-hpar{font-family:var(--display,system-ui);font-weight:700;font-size:13.5px;color:#eef2f6}
  #perfil-overlay .pf-hmeta{font-family:ui-monospace,monospace;font-size:11px;color:#7d8794;margin-top:2px}
  #perfil-overlay .pf-hmeta b{color:#dfe5ec;font-weight:700}
  #perfil-overlay .pf-hfecha{flex:0 0 auto;font-family:ui-monospace,monospace;font-size:10.5px;color:#5a6570;text-align:right}
  #perfil-overlay .pf-hvacio{padding:20px;text-align:center;color:#7d8794;font-size:12.5px}
  #perfil-overlay .pf-hmas{display:block;text-align:center;margin-top:12px;font-size:11.5px;color:var(--gold,#E8B84B);text-decoration:none}
  #perfil-overlay .pf-perm-t{font-family:var(--sans,sans-serif);font-size:12px;color:#8b96a3;line-height:1.55;margin-bottom:11px}
  #perfil-overlay .pf-perm-t b{color:#eaecef}
  #perfil-overlay .pf-perm{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid rgba(255,255,255,.06)}
  #perfil-overlay .pf-perm-tx b{display:block;font-family:var(--display,sans-serif);font-size:13.5px;color:#eaecef}
  #perfil-overlay .pf-perm-tx span{display:block;font-family:var(--mono,monospace);font-size:10px;color:#7d8794;margin-top:2px}
  #perfil-overlay .pf-perm-b{flex:0 0 auto;min-height:34px;padding:7px 13px;border-radius:9px;border:1px solid #3a424c;background:transparent;color:var(--gold,#E8B84B);font-family:var(--mono,monospace);font-size:11px;cursor:pointer}
  #perfil-overlay .pf-perm-b:hover{border-color:var(--gold-soft,#C9A84B)}
  #perfil-overlay .pf-perm-b:disabled{opacity:.5;cursor:default}
  #perfil-overlay .pf-perm-v{font-family:var(--sans,sans-serif);font-size:12px;color:var(--neon-lit,#2ee86a);text-align:center;padding:6px 0}
  #perfil-overlay .pf-coste{text-align:center;padding:15px}
  #perfil-overlay .pf-coste-t{font-family:var(--sans,sans-serif);font-size:11.5px;color:#7d8794}
  #perfil-overlay .pf-coste-v{font-family:var(--display,sans-serif);font-size:17px;color:#eaecef;margin:6px 0 4px}
  #perfil-overlay .pf-coste-v b{color:var(--gold,#E8B84B)}
  #perfil-overlay .pf-coste-d{font-family:var(--sans,sans-serif);font-size:11px;color:#7d8794;line-height:1.45}
  #perfil-overlay .pf-setname{min-height:36px;display:inline-flex;align-items:center;gap:7px}
  #perfil-overlay .pf-sect{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.9px;margin-bottom:8px;margin-top:20px}
  /* Textos: versión corta en el móvil */
  #perfil-overlay .tx-s{display:none}
  /* ══════════════════════════════════════════════════════════════
     IDIOMA — botón junto al estado

     Va fuera del @media a propósito: la vez anterior quedó dentro y
     por eso en escritorio salían cuadros blancos sin estilo.
     ══════════════════════════════════════════════════════════════ */
  #perfil-overlay .pf-hr{display:flex;align-items:center;gap:9px}
  #perfil-overlay .pf-globo{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;
    height:32px;padding:0 10px;border-radius:9px;cursor:pointer;
    background:rgba(255,255,255,.05);border:1px solid var(--line,#2b3139);
    color:var(--ink-2,#b7bdc6);transition:border-color .14s,color .14s}
  #perfil-overlay .pf-globo:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #perfil-overlay .pf-globo svg{width:15px;height:15px;flex:0 0 auto}
  #perfil-overlay .pf-globo b{font-family:var(--mono,monospace);font-size:10.5px;font-weight:700}

  /* El desplegable va en el body, fuera del overlay, para que no lo
     recorte el scroll de la tarjeta. */
  #pf-idi-menu{position:fixed;z-index:9820;min-width:184px;padding:6px;
    display:flex;flex-direction:column;gap:2px;
    background:linear-gradient(180deg,#1b2027,#0d1117);
    border:1px solid var(--gold-soft,#C9A84B);border-radius:13px;
    box-shadow:0 16px 44px rgba(0,0,0,.72)}
  #pf-idi-menu .pf-idi{display:flex;align-items:center;gap:11px;width:100%;
    padding:11px 12px;border-radius:9px;min-height:46px;cursor:pointer;text-align:left;
    background:transparent;border:none;color:#b7bdc6}
  #pf-idi-menu .pf-idi:hover{background:rgba(255,255,255,.05)}
  #pf-idi-menu .pf-idi.on{background:rgba(232,184,75,.1);color:var(--gold,#E8B84B)}
  #pf-idi-menu .pf-idi i{font-style:normal;font-size:19px;line-height:1}
  #pf-idi-menu .pf-idi b{flex:1;font-family:var(--sans,sans-serif);font-weight:600;font-size:13.5px}
  #pf-idi-menu .pf-idi svg{width:15px;height:15px;flex:0 0 auto;color:var(--gold,#E8B84B)}

  @media(max-width:560px){
    #perfil-overlay .tx-l{display:none}
    #perfil-overlay .tx-s{display:inline}
    #perfil-overlay .pf-sect{text-align:center;margin-top:22px;margin-bottom:10px}
  /* De dónde sale el dato: real o estimado */
  #perfil-overlay .pf-fuente{display:block;margin-top:2px;font-style:normal;
    font-family:var(--mono,monospace);font-size:9px;color:#5c6672;letter-spacing:.3px}

  #perfil-overlay .pf-note{font-size:11px;line-height:1.5;text-align:center;padding:0 4px}
    #perfil-overlay .pf-setname{font-size:12.5px}
  }
  #perfil-overlay .pf-box{background:rgba(255,255,255,.02);border:1px solid #2b3139;border-radius:13px;padding:4px 14px}
  #perfil-overlay .pf-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.055);font-family:var(--mono,monospace);font-size:12.5px}
  #perfil-overlay .pf-row:last-child{border-bottom:none}
  #perfil-overlay .pf-row .k{color:#7d8794}
  #perfil-overlay .pf-row .v{color:#eaecef;font-weight:700;text-align:right}
  #perfil-overlay .pf-row .v.oro{color:var(--gold,#E8B84B)}

  #perfil-overlay .pf-acts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
  #perfil-overlay .pf-act{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid #3a424c;color:var(--gold,#E8B84B);font-family:var(--display,sans-serif);font-weight:700;font-size:13px;cursor:pointer;text-decoration:none;box-shadow:0 3px 0 rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.05)}
  #perfil-overlay .pf-act:hover{filter:brightness(1.12)}
  #perfil-overlay .pf-act:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.4)}
  #perfil-overlay .pf-soon{margin-top:14px;padding:14px 15px;border-radius:12px;background:rgba(255,255,255,.03);border:1px dashed #2b3139}
  #perfil-overlay .pf-soon .t{font-family:var(--mono,monospace);font-size:12px;color:#b7bdc6;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:8px}
  #perfil-overlay .pf-soon .d{font-family:var(--mono,monospace);font-size:11px;color:#7d8794;margin-top:6px;line-height:1.55}
  #perfil-overlay .pf-badge{font-size:9.5px;padding:2px 9px;border-radius:10px;background:rgba(232,184,75,.15);color:var(--gold,#E8B84B);border:1px solid rgba(232,184,75,.32);font-weight:800;text-transform:uppercase;letter-spacing:.4px;flex:0 0 auto}
  #perfil-overlay .pf-empty{font-family:var(--mono,monospace);font-size:13px;color:#7d8794;margin-top:16px;line-height:1.6;text-align:center;padding:24px 0}
  #perfil-overlay .pf-note{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-align:center;margin-top:14px;line-height:1.5}

  @media(max-width:560px){
    #perfil-overlay{padding:0}
    #perfil-overlay .pf-card{max-width:100%;max-height:100vh;height:100vh;border-radius:0;border:none;padding:18px 14px}
    #perfil-overlay .pf-h{gap:12px;padding-right:38px}
    #perfil-overlay .pf-ava{width:48px;height:48px;border-radius:14px}
    #perfil-overlay .pf-nombre{font-size:18px}
    #perfil-overlay .pf-hr{display:none}
    #perfil-overlay .pf-kpis{grid-template-columns:1fr 1fr;gap:8px}
    #perfil-overlay .pf-kpi{padding:12px 8px}
    #perfil-overlay .pf-kpi .kv{font-size:17px}
    #perfil-overlay .pf-acts{grid-template-columns:1fr}
    #perfil-overlay .pf-tipos{gap:7px}
    #perfil-overlay .pf-tipo{padding:10px;gap:8px}
    #perfil-overlay .pf-tipo .tn{font-size:10.5px}
    #perfil-overlay .pf-tipo .tc{font-size:15px}
    #perfil-overlay .pf-tipo .ti{width:26px;height:26px}
  }
  `;
  document.head.appendChild(s);
}

function overlay() {
  let o = $('perfil-overlay');
  if (o) return o;
  o = document.createElement('div');
  o.id = 'perfil-overlay';
  o.innerHTML = `<div class="pf-card" id="pf-card"></div>`;
  document.body.appendChild(o);
  o.addEventListener('click', (e) => { if (e.target === o) cerrar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  return o;
}
function cerrar() { const o = $('perfil-overlay'); if (o) o.classList.remove('show'); }

const iconoUser = () => `<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>`;
const iconoPen = () => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const icoGrid = () => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`;
const icoAcum = () => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>`;
const icoCash = () => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
const icoDca = () => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`;
const iconoCopy = () => `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;

function pintarNombre(cuenta) {
  const cont = $('pf-name'); if (!cont) return;
  const nom = leerNombre(cuenta);
  cont.innerHTML = nom
    ? `<span class="pf-nombre">${esc(nom)}</span><button class="pf-pen" id="pf-pen" title="Editar nombre">${iconoPen()}</button>`
    : `<button class="pf-setname" id="pf-set"><span class="tx-l">Ponle un nombre a tu cuenta</span><span class="tx-s">Ponle un nombre</span> ${iconoPen()}</button>`;
  const editar = () => {
    cont.innerHTML = `<div class="pf-nameedit"><input class="pf-inp" id="pf-inp" maxlength="24" value="${esc(nom)}" placeholder="Tu nombre o alias"><button class="pf-savebtn" id="pf-save">Guardar</button></div>`;
    const inp = $('pf-inp'); inp.focus(); inp.select();
    const ok = () => { guardarNombre(cuenta, inp.value.trim()); pintarNombre(cuenta); };
    $('pf-save').onclick = ok;
    inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') pintarNombre(cuenta); };
  };
  if ($('pf-pen')) $('pf-pen').onclick = editar;
  if ($('pf-set')) $('pf-set').onclick = editar;
}

export async function abrirPerfil() {
  estilos();
  const o = overlay(); const card = $('pf-card');
  o.classList.add('show');

  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  if (!cuenta) {
    card.innerHTML = `<button class="pf-x" id="pf-x" aria-label="Cerrar">✕</button>
      <div class="pf-h"><div class="pf-ava">${iconoUser()}</div><div class="pf-idcol"><div class="pf-nombre">Tu cuenta</div></div></div>
      <div class="pf-empty">Conecta tu wallet para ver tu panel:<br>suscripción, rendimiento, bots y gas.</div>`;
    $('pf-x').onclick = cerrar; return;
  }

  card.innerHTML = `
  <button class="pf-x" id="pf-x" aria-label="Cerrar">✕</button>
  <div class="pf-h">
    <div class="pf-ava">${iconoUser()}</div>
    <div class="pf-idcol">
      <div class="pf-name" id="pf-name"></div>
      <div class="pf-addr" id="pf-addr" title="Copiar dirección">${wallet.abreviar(cuenta)} ${iconoCopy()}</div>
    </div>
    <div class="pf-hr">
      <button class="pf-globo" id="pf-globo" title="Idioma" aria-label="Cambiar idioma">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>
        <b id="pf-globo-tx">ES</b>
      </button>
      <span id="pf-sub"><span class="pf-sk"></span></span>
    </div>
  </div>

  <div class="pf-kpis">
    <div class="pf-kpi"><div class="kl">Resultado</div><div class="kv" id="pf-pnl"><span class="pf-sk"></span></div></div>
    <div class="pf-kpi"><div class="kl">Volumen</div><div class="kv" id="pf-vol"><span class="pf-sk"></span></div></div>
    <div class="pf-kpi"><div class="kl">Operaciones</div><div class="kv" id="pf-ops"><span class="pf-sk"></span></div></div>
    <div class="pf-kpi"><div class="kl">Bots activos</div><div class="kv oro" id="pf-bots"><span class="pf-sk"></span></div></div>
  </div>

  <div class="pf-sec">
    <div class="pf-sect">Suscripción y gas</div>
    <div class="pf-box">
      <div class="pf-row"><span class="k">Cuota mensual</span><span class="v" id="pf-precio"><span class="pf-sk"></span></span></div>
      <div class="pf-row"><span class="k">Gas disponible</span><span class="v oro" id="pf-gas"><span class="pf-sk"></span></span></div>
      <div class="pf-row"><span class="k">Gas gastado (total)</span><span class="v" id="pf-gasg"><span class="pf-sk"></span></span></div>
    </div>
  </div>

  <div class="pf-sec">
    <div class="pf-sect">Actividad</div>
    <div class="pf-box">
      <div class="pf-row"><span class="k">Bots creados (total)</span><span class="v" id="pf-tot"><span class="pf-sk"></span></span></div>
      <div class="pf-row"><span class="k">Ciclos completados</span><span class="v" id="pf-ciclos"><span class="pf-sk"></span></span></div>
      <div class="pf-row"><span class="k">Compras / ventas</span><span class="v" id="pf-cv"><span class="pf-sk"></span></span></div>
      <div class="pf-row"><span class="k">Miembro desde</span><span class="v" id="pf-desde"><span class="pf-sk"></span></span></div>
    </div>
  </div>

  <div class="pf-sec">
    <div class="pf-sect">Tus bots por estrategia</div>
    <div class="pf-tipos" id="pf-tipos">
      <div class="pf-tipo"><span class="ti" style="color:#4d9fff">${icoGrid()}</span><span class="tn">Smart Grid</span><span class="tc" id="pf-t0"><span class="pf-sk"></span></span></div>
      <div class="pf-tipo"><span class="ti" style="color:#b47cff">${icoAcum()}</span><span class="tn">Accumulator</span><span class="tc" id="pf-t1"><span class="pf-sk"></span></span></div>
      <div class="pf-tipo"><span class="ti" style="color:#E8B84B">${icoCash()}</span><span class="tn">Cash Out</span><span class="tc" id="pf-t2"><span class="pf-sk"></span></span></div>
      <div class="pf-tipo"><span class="ti" style="color:#34d97b">${icoDca()}</span><span class="tn">DCA</span><span class="tc" id="pf-t3"><span class="pf-sk"></span></span></div>
    </div>
  </div>

  <div class="pf-sec">
    <button class="pf-histtog" id="pf-hist-tog" type="button" aria-expanded="false">
      <span>Historial de operaciones</span><span class="pf-hist-ar">▾</span>
    </button>
    <div class="pf-hist" id="pf-hist" hidden></div>
  </div>

  <div class="pf-acts">
    <a class="pf-act" href="https://bscscan.com/address/${cuenta}" target="_blank" rel="noopener"><span class="tx-l">Ver en BscScan ↗</span><span class="tx-s">BscScan ↗</span></a>
    <button class="pf-act" id="pf-reload">Actualizar datos</button>
  </div>

  <div class="pf-sec">
    <div class="pf-sect">Coste por operación</div>
    <div class="pf-box pf-coste">
      <div class="pf-coste-t">Cada compra o venta que hace un bot</div>
      <div class="pf-coste-v" id="pf-costeop">—</div>
      <div class="pf-coste-d" id="pf-opsrest">Se descuenta de tu gas, no de tu inversión.</div>
    </div>

    <div class="pf-sect">Permisos de gasto</div>
    <div class="pf-box">
      <div class="pf-perm-t">Los bots necesitan permiso para mover tus monedas. Cuando dejes de usarlos, <b>quítaselo</b>: es la forma más eficaz de proteger tu dinero.</div>
      <div id="pf-permisos"><div class="pf-sk" style="height:44px"></div></div>
    </div>

    <div class="pf-sect">Notificaciones</div>
    <div class="pf-box">
      <div class="pf-row">
        <span class="k">Avisos del Marketplace</span>
        <span class="v"><span class="pf-sw2" id="pf-push"><i></i></span></span>
      </div>
      <div class="pf-row" style="border-bottom:none">
        <span class="k" style="font-size:11px;line-height:1.5">Te avisamos cuando alguien tome tu oferta, marque un pago o libere un tramo.</span>
      </div>
    </div>
  </div>

  <div class="pf-soon">
    <div class="t"><span>Renovación automática</span>
      <span style="display:inline-flex;align-items:center;gap:9px">
        <span class="pf-badge">Pronto</span>
        <span class="pf-sw on" id="pf-sw" title="Disponible próximamente"><i></i></span>
      </span>
    </div>
    <div class="d">Vendrá activada: tu suscripción se renovará sola y no tendrás que acordarte cada mes. Podrás desactivarla cuando quieras (se firmará en la blockchain).</div>
  </div>
  <div class="pf-note"><span class="tx-l">Los datos se leen directamente de la blockchain. Tu nombre se guarda solo en este dispositivo.</span><span class="tx-s">Datos leídos de la blockchain. Tu nombre solo se guarda en este dispositivo.</span></div>`;

  /* ══════════════════════════════════════════════════════════════
     IDIOMA
     Un botón con globo terráqueo junto al estado, y un desplegable
     con las tres opciones. Si el módulo fallara, el botón se oculta
     y el resto del perfil sigue igual.
     ══════════════════════════════════════════════════════════════ */
  (async () => {
    const bot = $('pf-globo');
    if (!bot) return;
    try {
      const idi = await import('./idioma.js?v=152');
      const tx = $('pf-globo-tx');
      if (tx) tx.textContent = idi.idiomaActual().toUpperCase();

      bot.onclick = (ev) => {
        ev.stopPropagation();
        const prev = document.getElementById('pf-idi-menu');
        if (prev) { prev.remove(); return; }

        const m = document.createElement('div');
        m.id = 'pf-idi-menu';
        const hoy = idi.idiomaActual();
        m.innerHTML = idi.IDIOMAS.map((x) => `
          <button class="pf-idi ${x.id === hoy ? 'on' : ''}" data-idi="${x.id}">
            <i>${x.bandera}</i><b>${x.nombre}</b>
            ${x.id === hoy ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="m20 6-11 11-5-5"/></svg>' : ''}
          </button>`).join('');
        document.body.appendChild(m);

        // Se coloca bajo el botón sin salirse de la pantalla
        const r = bot.getBoundingClientRect();
        const ancho = m.offsetWidth || 184;
        m.style.left = Math.max(8, Math.min(window.innerWidth - ancho - 8, r.left - 20)) + 'px';
        m.style.top = (r.bottom + 8) + 'px';

        m.addEventListener('click', (e2) => e2.stopPropagation());
        m.querySelectorAll('[data-idi]').forEach((b) => b.onclick = () => {
          const id = b.dataset.idi;
          m.remove();
          if (tx) tx.textContent = id.toUpperCase();
          idi.cambiarIdioma(id);
        });
        setTimeout(() => document.addEventListener('click', () => {
          const x = document.getElementById('pf-idi-menu'); if (x) x.remove();
        }, { once: true }), 10);
      };
    } catch (_) {
      bot.style.display = 'none';
    }
  })();


  $('pf-x').onclick = cerrar;
  pintarNombre(cuenta);
  const addr = $('pf-addr');
  if (addr) addr.onclick = async () => {
    try { await navigator.clipboard.writeText(wallet.checksum ? wallet.checksum(cuenta) : cuenta); const t = addr.innerHTML; addr.innerHTML = '¡Copiada!'; setTimeout(() => { addr.innerHTML = t; }, 1100); } catch (_) {}
  };
  if ($('pf-reload')) $('pf-reload').onclick = () => abrirPerfil();
  if ($('pf-hist-tog')) $('pf-hist-tog').onclick = () => alternarHistorial(cuenta);
  cargarPermisos(cuenta);
  // Los datos se cargan LO PRIMERO: si algo del interruptor fallara, antes
  // se quedaba todo en blanco porque nunca se llegaba a pedirlos.
  cargarDatos(cuenta).catch((e) => {
    console.warn('[Aurex] perfil:', e);
    ['pf-pnl','pf-vol','pf-ops','pf-bots','pf-ciclos','pf-tot','pf-cv','pf-desde','pf-gasg','pf-precio','pf-gas','pf-t0','pf-t1','pf-t2','pf-t3']
      .forEach((id) => { const el = $(id); if (el && el.querySelector('.pf-sk')) el.textContent = '—'; });
  });

  try {
  const sw = $('pf-push');
  if (sw) {
    const pintar = () => sw.classList.toggle('on', avisos.pushActivado());
    pintar();
    sw.onclick = async () => {
      const nuevo = !avisos.pushActivado();
      avisos.setPush(nuevo);
      if (nuevo) await avisos.pedirPermisoPush();
      pintar();
    };
  }
  } catch (e) { console.warn('[Aurex] interruptor de avisos:', e); }
}

/** Enseña los permisos activos y deja quitarlos con un botón.
 *  Un permiso abierto es lo que convierte cualquier problema en un robo:
 *  si nadie tiene permiso, no hay nada que llevarse. */
async function cargarPermisos(cuenta) {
  const box = $('pf-permisos'); if (!box || !cuenta) return;
  const MON = gb.MONEDAS_LISTA || null;
  // Miramos las monedas que el usuario usa en sus bots (no todas: sería lento)
  let dirs = [];
  try {
    const claves = await gb.misRejillas(cuenta);
    const vistos = new Set();
    for (const k of claves.slice(0, 20)) {
      try {
        const R = await gb.resumenK(k);
        [R.base, R.quote].forEach((d) => { if (d && !vistos.has(d.toLowerCase())) { vistos.add(d.toLowerCase()); dirs.push(d); } });
      } catch (_) {}
    }
  } catch (_) {}
  if (dirs.length === 0) { box.innerHTML = `<div class="pf-perm-v">No tienes permisos que revisar.</div>`; return; }

  const filas = [];
  for (const d of dirs.slice(0, 8)) {
    let bot = 0n, swap = 0n, sim = d.slice(0, 6);
    try { bot = await gb.allowance(d, cuenta); } catch (_) {}
    try { swap = await gb.allowanceSwap(d, cuenta); } catch (_) {}
    try { sim = (await gb.infoToken(d)).simbolo; } catch (_) {}
    sim = String(sim).replace(/[^\p{L}\p{N} ._+\-]/gu, '').slice(0, 10) || '?';
    if (bot > 0n) filas.push({ d, sim, cuanto: bot, quien: 'bots', fn: 'revocarToken' });
    if (swap > 0n) filas.push({ d, sim, cuanto: swap, quien: 'swap', fn: 'revocarSwap' });
  }
  if (filas.length === 0) { box.innerHTML = `<div class="pf-perm-v">✓ No hay permisos abiertos. Tu dinero solo se mueve si tú firmas.</div>`; return; }

  box.innerHTML = filas.map((x, i) => `
    <div class="pf-perm">
      <div class="pf-perm-tx"><b>${x.sim}</b><span>hasta ${num(Number(gb.fmt(x.cuanto, 18)), 4)} · para ${x.quien === 'bots' ? 'los bots' : 'el swap'}</span></div>
      <button class="pf-perm-b" data-rev="${i}">quitar</button>
    </div>`).join('');

  box.querySelectorAll('[data-rev]').forEach((b) => b.onclick = async () => {
    const x = filas[Number(b.dataset.rev)];
    b.disabled = true; b.textContent = 'firma…';
    try {
      await gb[x.fn](x.d);
      b.textContent = 'quitado';
      setTimeout(() => cargarPermisos(cuenta), 1200);
    } catch (e) {
      b.disabled = false; b.textContent = 'quitar';
      console.warn('[Aurex] revocar:', e);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   HISTORIAL DE OPERACIONES — desplegable, leído de la cadena.
   Dos sectores: órdenes limit manuales (desde el gráfico) y bots.
   Sin scroll infinito: lista acotada; el detalle completo, en BscScan.
   ═══════════════════════════════════════════════════════════════════ */
let _histCargado = false;
async function alternarHistorial(cuenta) {
  const cont = $('pf-hist'), tog = $('pf-hist-tog');
  if (!cont || !tog) return;
  const abierto = tog.getAttribute('aria-expanded') === 'true';
  if (abierto) { cont.hidden = true; tog.setAttribute('aria-expanded', 'false'); return; }
  cont.hidden = false; tog.setAttribute('aria-expanded', 'true');
  if (_histCargado) return;
  cont.innerHTML = `<div class="pf-hcarga">Leyendo tus operaciones en la blockchain…</div>`;

  let res;
  try { res = await gb.historialDe(cuenta); } catch (_) { res = { error: 'sin-historial', ops: [] }; }
  if (res.error === 'sin-historial') {
    cont.innerHTML = `<div class="pf-hvacio">Ahora mismo no se pudo leer el historial (la red pública va lenta). Inténtalo de nuevo en un momento.</div>`;
    return;
  }
  _histCargado = true;
  const ops = res.ops || [];
  if (!ops.length) {
    cont.innerHTML = `<div class="pf-hvacio">Todavía no tienes operaciones registradas. Cuando un bot o una orden se ejecute, aparecerá aquí.</div>`;
    return;
  }

  let marcas = {};
  try { marcas = JSON.parse(localStorage.getItem('bot-pares') || '{}'); } catch (_) {}
  const esOrden = (clave) => !!(marcas[clave] && marcas[clave].desdeGrafico);
  const simbolos = {};
  const simboloDe = async (addr) => {
    const k = String(addr).toLowerCase();
    if (simbolos[k]) return simbolos[k];
    try { simbolos[k] = (await gb.infoToken(addr)).simbolo; } catch (_) { simbolos[k] = '—'; }
    return simbolos[k];
  };

  const manuales = ops.filter((o) => esOrden(o.clave));
  const deBots = ops.filter((o) => !esOrden(o.clave));

  const fila = async (o) => {
    const sb = await simboloDe(o.base), sq = await simboloDe(o.quoteAddr);
    return `<div class="pf-hrow">
      <span class="pf-htag ${o.compra ? 'c' : 'v'}">${o.compra ? 'COMPRA' : 'VENTA'}</span>
      <div class="pf-hinfo">
        <div class="pf-hpar">${sb}/${sq}</div>
        <div class="pf-hmeta">Precio <b>${num(o.precio, o.precio < 1 ? 6 : 2)}</b> · <b>${num(o.cantidad, 6)}</b> ${sb}</div>
      </div>
      <div class="pf-hfecha">${desde(o.tiempo)}</div>
    </div>`;
  };
  const sector = async (titulo, lista) => {
    const filas = (await Promise.all(lista.slice(0, 25).map(fila))).join('');
    return `<div class="pf-hsect">${titulo} <i></i></div>` +
      (lista.length ? filas : `<div class="pf-hvacio">Ninguna por ahora.</div>`);
  };

  cont.innerHTML =
    (await sector('Tus órdenes limit', manuales)) +
    (await sector('Operaciones de bots', deBots)) +
    `<a class="pf-hmas" href="https://bscscan.com/address/${cuenta}" target="_blank" rel="noopener">Ver el historial completo en BscScan ↗</a>`;
}

async function cargarDatos(cuenta) {
  // 1) Suscripción y gas: en PARALELO y se pintan apenas llegan.
  Promise.all([
    gb.estaActivo(cuenta).catch(() => false),
    gb.precioSub().catch(() => 0n),
    gb.gasSaldo(cuenta).catch(() => 0n)
  ]).then(([activo, precio, gasWei]) => {
    if ($('pf-sub')) $('pf-sub').innerHTML = activo
      ? `<span class="pf-pill pf-on"><i></i>Activa</span>`
      : `<span class="pf-pill pf-off">Inactiva</span>`;
    if ($('pf-precio')) $('pf-precio').textContent = precio > 0n ? `${num(Number(gb.fmtBNB(precio)), 5)} BNB ≈ $1` : '—';
    if ($('pf-gas')) $('pf-gas').textContent = `${num(Number(gb.fmtBNB(gasWei)), 5)} BNB`;   // 5 decimales: con 4, 0.00396 se veía como 0.0040
    /* ══════════════════════════════════════════════════════════
       [CORREGIDO] EL COSTE POR OPERACIÓN

       Antes se mostraba `gasMinOp()` del contrato, pero ESO NO ES
       EL COSTE: es el saldo mínimo exigido para dejar operar al
       bot, un colchón de seguridad. Enseñarlo como coste hacía
       creer que cada compra costaba más de un dólar, cuando en
       realidad cuesta unos céntimos.

       El coste real se calcula con datos propios: el gas que se ha
       gastado de verdad dividido entre las operaciones hechas.
       Mientras no haya operaciones, se usa una estimación de red
       (una transacción en BNB Chain ronda las 150.000 unidades de
       gas), no el umbral del contrato.
       ══════════════════════════════════════════════════════════ */
    const pintarCoste = (bnbOp, fuente) => {
      if (!$('pf-costeop') || !(bnbOp > 0)) return;
      const usd = precio > 0n ? bnbOp / Number(gb.fmtBNB(precio)) : 0;
      $('pf-costeop').innerHTML = `≈ <b>${num(bnbOp, 6)} BNB</b>` +
        (usd > 0 ? ` · unos ${usd < 0.01 ? '$' + usd.toFixed(3) : num(usd, 2) + ' USD'}` : '') +
        `<i class="pf-fuente">${fuente}</i>`;
      const quedan = Math.floor(Number(gb.fmtBNB(gasWei)) / bnbOp);
      if ($('pf-opsrest')) $('pf-opsrest').textContent = quedan > 0
        ? `Con tu gas actual te alcanza para unas ${quedan.toLocaleString('es')} operaciones más`
        : 'Recarga gas para que tus bots sigan operando';
    };

    /* Coste por operación ESTABLE y honesto: se calcula con el precio de gas
       REAL de la red ahora mismo × el consumo típico de una operación (~400k
       gas). Así no salta de miles a decenas según abran/cierren bots, y refleja
       lo que de verdad cuesta operar en este momento. El consumo real del
       usuario (si existe y es sensato) se usa como afinado. */
    const GAS_POR_OP = 400000;   // unidades de gas típicas de una compra/venta
    gb.precioGasWei().then((gwei) => {
      let bnbOp = 0, fuente = 'estimado para BNB Chain';
      if (gwei > 0n) {
        bnbOp = Number(gb.fmtBNB(gwei * BigInt(GAS_POR_OP)));
        fuente = 'según el gas de la red ahora';
      }
      // Afinado con el consumo real, solo si cae en un rango sensato.
      if (_gasReal.gastado > 0 && _gasReal.ops > 0) {
        const real = _gasReal.gastado / _gasReal.ops;
        if (real >= 0.000005 && real <= 0.002) { bnbOp = real; fuente = 'según tu consumo real'; }
      }
      if (!(bnbOp > 0)) bnbOp = 0.00002;   // último recurso
      pintarCoste(bnbOp, fuente);
    }).catch(() => pintarCoste(0.00002, 'estimado para BNB Chain'));
  }).catch(() => {});

  // 2) Bots: todo en paralelo (antes iba uno detrás de otro).
  let claves = [];
  try { claves = await gb.misRejillas(cuenta); } catch (_) { claves = []; }
  const total = claves.length;
  if ($('pf-tot')) $('pf-tot').textContent = String(total);

  if (total === 0) {
    ['pf-pnl','pf-vol','pf-ops','pf-bots','pf-ciclos','pf-t0','pf-t1','pf-t2','pf-t3']
      .forEach((id) => { const e = $(id); if (e) e.textContent = '0'; });
    if ($('pf-pnl')) $('pf-pnl').className = 'kv';
    if ($('pf-cv')) $('pf-cv').textContent = '0 / 0';
    if ($('pf-desde')) $('pf-desde').textContent = '—';
    if ($('pf-gasg')) $('pf-gasg').textContent = '0.0000 BNB';
    return;
  }

  // De 4 en 4, no todos a la vez: con muchos bots, los servidores públicos
  // rechazan la avalancha de peticiones y devolvían todo en cero.
  const conReintento = async (fn) => {
    for (let i = 0; i < 3; i++) {
      try { return await fn(); } catch (_) { await new Promise((r) => setTimeout(r, 250 * (i + 1))); }
    }
    return null;
  };
  const datos = [];
  const TANDA = 4;
  for (let i = 0; i < claves.length; i += TANDA) {
    const trozo = claves.slice(i, i + TANDA);
    const res = await Promise.all(trozo.map(async (k) => {
      const R = await conReintento(() => gb.resumenK(k));
      const md = await conReintento(() => gb.modoDe(k));
      return { R, md };
    }));
    datos.push(...res);
  }

  const quotes = [...new Set(datos.filter((d) => d.R).map((d) => String(d.R.quote || '').toLowerCase()))];
  const decs = {};
  for (const q of quotes) {
    try { decs[q] = (await gb.infoToken(q)).decimals; } catch (_) { decs[q] = 18; }
  }

  let activos = 0, ops = 0, ciclos = 0, compras = 0, ventas = 0;
  let pnl = 0, vol = 0, gasGas = 0, creadaMin = 0;
  const porTipo = [0, 0, 0, 0];

  for (const { R, md } of datos) {
    if (!R) continue;
    if (R.activa) activos++;
    if (md !== null && md !== undefined) {
      const mi = Number(Array.isArray(md) ? md[0] : md);
      if (mi >= 0 && mi <= 3) porTipo[mi]++;
    }
    ops += Number(R.totalOps || 0);
    ciclos += Number(R.ciclos || 0);
    compras += Number(R.comprasHechas || 0);
    ventas += Number(R.ventasHechas || 0);
    gasGas += Number(gb.fmtBNB(R.gasGastadoWei || 0n));
    const c = Number(R.creadaEn || 0);
    if (c > 0 && (creadaMin === 0 || c < creadaMin)) creadaMin = c;
    const dec = decs[String(R.quote || '').toLowerCase()] ?? 18;
    try { pnl += Number(gb.fmt(R.gananciaQuote || 0n, dec)); } catch (_) {}
    try { vol += Number(gb.fmt(R.volumenQuote || 0n, dec)); } catch (_) {}
  }

  const elP = $('pf-pnl');
  if (elP) {
    elP.textContent = (pnl >= 0 ? '+' : '') + num(pnl, 2);
    elP.className = 'kv ' + (pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : '');
  }
  if ($('pf-vol')) $('pf-vol').textContent = num(vol, vol >= 1000 ? 0 : 2);
  if ($('pf-ops')) $('pf-ops').textContent = String(ops);
  if ($('pf-bots')) $('pf-bots').textContent = String(activos);
  if ($('pf-ciclos')) $('pf-ciclos').textContent = String(ciclos);
  if ($('pf-cv')) $('pf-cv').textContent = `${compras} / ${ventas}`;
  if ($('pf-desde')) $('pf-desde').textContent = desde(creadaMin);
  if ($('pf-gasg')) $('pf-gasg').textContent = `${num(gasGas, 4)} BNB`;
  /* Se guarda para calcular el coste real por operación. */
  _gasReal.gastado = gasGas;
  _gasReal.ops = ops;
  if (gasGas > 0 && ops > 0) {
    const porOp = gasGas / ops;
    const el = $('pf-costeop');
    if (el) {
      el.innerHTML = `≈ <b>${num(porOp, 6)} BNB</b><i class="pf-fuente">según tu consumo real</i>`;
    }
  }
  for (let i = 0; i < 4; i++) { const e = $('pf-t' + i); if (e) e.textContent = String(porTipo[i]); }
}
