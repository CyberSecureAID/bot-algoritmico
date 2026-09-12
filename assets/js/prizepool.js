// prizepool.js — Módulo Prize Pool (independiente). No toca la lógica de los bots.
// La librería vive en ESTE repositorio. Carga directa: sin CDN, sin esperas,
// sin nada externo que pueda quedarse colgado y dejar la app en 'Cargando…'.
import * as ethers from './vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from './wallet.js?v=125';

/* ───────── Config ───────── */
const PRIZEPOOL = '0x595CD563F236DAEba21219D60AEF656a750A8132';
const USDT      = '0x55d398326f99059fF775485246999027B3197955';   // BSC-USD (18 dec)
const RPCS = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
  'https://rpc.ankr.com/bsc'
];
const PP_ABI = [
  'function estadoActual() view returns (uint256 round,uint256 pool,uint256 players,uint256 minReq,uint256 endTime,uint256 entrada,uint256 ganadoresEstimados,uint8 state)',
  'function distribucionEstimada(uint256 pool,uint256 players) view returns (uint256[])',
  'function ultimosGanadores() view returns (uint256 round, tuple(address player,string name,string telegram,uint256 prize,uint8 rank)[])',
  'function necesitaGas() view returns (bool)',
  'function gasPerEntry() view returns (uint256)',
  'function entryTotal() view returns (uint256)',
  'function miReclamo(uint256 round,address who) view returns (uint256 amount,bool yaReclamado)',
  'function participar(string name,string telegram,address inviter) payable',
  'function reclamar(uint256 round)',
  'function miAporte(address who) view returns (uint256 tickets,uint256 devolucion,bool puedeSalir,uint256 cierreSalida)',
  'function abandonarParticipacion()',
  'function gasFaltante() view returns (uint256)',
  'function sorteoAtascado(uint256) view returns (bool)',
  'function destrabarSorteo(uint256) payable',
  'function saldoGas() view returns (uint256 enSponsor,uint256 enReserva,uint256 objetivo)',
  'function owner() view returns (address)'
];
const ERC20 = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)'
];

/* ───────── ethers helpers ───────── */
let _idx = 0;
async function leePP(fn, args = []) {
  for (let k = 0; k < RPCS.length; k++) {
    try {
      const c = new ethers.Contract(PRIZEPOOL, PP_ABI, new ethers.JsonRpcProvider(RPCS[_idx % RPCS.length], 56, { staticNetwork: true }));
      return await c[fn](...args);
    } catch (e) { _idx++; await new Promise(r => setTimeout(r, 200)); }
  }
  throw new Error('rpc');
}
async function firmante() { const bp = new ethers.BrowserProvider(window.ethereum); return bp.getSigner(); }
const fmt = (v) => Number(ethers.formatUnits(v, 18));
const num = (n, d = 2) => Number(n).toLocaleString('es', { minimumFractionDigits: d, maximumFractionDigits: d });
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

/* ───────── Filtro de nombres (web, gratis) ───────── */
const MALAS = ['pinga','maricon','maricón','singao','singa','comemierda','comierda','puta','puto','coño','cono','mierda','cabron','cabrón','culero','pendejo','verga','chocha','bollo','mamahuevo','mamaguevo','maricona','fuck','shit','bitch','asshole','nigger','cunt','pussy','dick','cock','whore','nazi','hitler'];
function limpio(txt) {
  const t = (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const w of MALAS) { if (t.includes(w)) return false; }
  return true;
}

/* ───────── Estilos ───────── */
function estilos() {
  if ($('pp-css')) return;
  const s = document.createElement('style'); s.id = 'pp-css';
  s.textContent = `
  #pp-overlay{position:fixed;inset:0;z-index:9100;display:none;align-items:center;justify-content:center;background:rgba(3,5,8,.78);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);padding:18px}
  #pp-overlay.show{display:flex}
  #pp-overlay *{box-sizing:border-box}
  #pp-overlay .pp-card{width:100%;max-width:760px;max-height:92vh;overflow:auto;background:linear-gradient(180deg,rgba(18,22,28,.82),rgba(11,14,18,.88));border:1px solid #2b3139;border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.04);padding:26px 26px 24px;position:relative;animation:ppIn .18s ease both}
  #pp-overlay .pp-card::after{content:"";position:fixed;inset:0;z-index:0;background-image:url('assets/portada/img/swap-bg.webp');background-size:cover;background-position:center;opacity:.10;filter:saturate(1.05);pointer-events:none;}
  #pp-overlay .pp-card > *{position:relative;z-index:1}
  @keyframes ppIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  #pp-overlay .pp-x{position:absolute;top:16px;right:16px;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid #2b3139;color:#7d8794;display:grid;place-items:center;cursor:pointer;font-size:15px;z-index:2}
  #pp-overlay .pp-x:hover{color:#eaecef}

  /* Cabecera centrada */
  #pp-overlay .pp-head{text-align:center;margin-bottom:18px}
  #pp-overlay .pp-title{font-family:var(--display,sans-serif);font-weight:800;font-size:26px;letter-spacing:2px;color:var(--gold,#E8B84B);text-shadow:0 2px 4px rgba(0,0,0,.6);text-transform:uppercase}
  #pp-overlay .pp-title .pp-line{display:inline-block;width:26px;height:1px;background:linear-gradient(90deg,transparent,var(--gold-soft,#C9A84B));vertical-align:middle;margin:0 12px}
  #pp-overlay .pp-title .pp-line.r{background:linear-gradient(90deg,var(--gold-soft,#C9A84B),transparent)}
  #pp-overlay .pp-round{display:inline-flex;align-items:center;gap:9px;margin-top:11px;padding:8px 18px;border-radius:999px;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid #c79426;box-shadow:0 4px 0 rgba(143,106,26,.35),0 8px 18px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06);font-family:var(--display,sans-serif);font-weight:800;font-size:14px;color:var(--gold,#E8B84B);letter-spacing:.5px}
  #pp-overlay .pp-round .dot{width:8px;height:8px;border-radius:50%;background:var(--neon-lit,#2ee86a);box-shadow:0 0 9px rgba(46,232,106,.8);animation:ppPulse 1.6s ease-in-out infinite}
  #pp-overlay .pp-round .sep{width:1px;height:13px;background:#3a424c}
  #pp-overlay .pp-round .fc{color:#b7bdc6;font-weight:600;font-size:12.5px}
  @keyframes ppPulse{0%,100%{opacity:.45}50%{opacity:1}}
  #pp-overlay .pp-eco-btn{width:100%;padding:13px;border-radius:12px;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid #3a424c;color:var(--gold,#E8B84B);font-family:var(--display,sans-serif);font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;gap:9px;margin-bottom:14px}
  #pp-overlay .pp-eco-btn .ar{transition:transform .22s;font-size:10px;color:var(--gold-soft,#C9A84B)}
  #pp-overlay .pp-eco-btn.open .ar{transform:rotate(180deg)}
  #pp-overlay .pp-eco{display:none;margin-bottom:16px;padding:15px;border-radius:13px;background:rgba(255,255,255,.02);border:1px solid #2b3139;box-shadow:inset 0 1px 0 rgba(255,255,255,.03)}
  #pp-overlay .pp-eco.open{display:block;animation:ppIn .16s ease both}
  #pp-overlay .pp-eco p{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.6;margin:0 0 13px}
  #pp-overlay .pp-eco p b{color:var(--gold-soft,#C9A84B)}
  #pp-overlay .pp-eco-tbl{width:100%;border-collapse:collapse;font-family:var(--mono,monospace);font-size:12.5px}
  #pp-overlay .pp-eco-tbl th{color:#7d8794;font-weight:400;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;padding:7px 4px;border-bottom:1px solid #2b3139;text-align:center}
  #pp-overlay .pp-eco-tbl td{color:#eaecef;padding:9px 4px;text-align:center;border-bottom:1px solid var(--line-soft,rgba(255,255,255,.055))}
  #pp-overlay .pp-eco-tbl td:first-child{color:var(--gold,#E8B84B);font-weight:700}
  #pp-overlay .pp-eco-tbl td:last-child{color:var(--neon-lit,#2ee86a)}
  #pp-overlay .pp-eco-tbl tr:last-child td{border-bottom:none}
  #pp-overlay .pp-eco-hi{display:flex;flex-direction:column;align-items:center;gap:2px;padding:14px;margin-bottom:14px;border-radius:12px;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid #c79426;box-shadow:0 4px 0 rgba(143,106,26,.3),inset 0 1px 0 rgba(255,255,255,.06)}
  #pp-overlay .pp-eco-hi .n{font-family:var(--display,sans-serif);font-weight:800;font-size:26px;color:var(--gold,#E8B84B);line-height:1;text-shadow:0 2px 4px rgba(0,0,0,.6)}
  #pp-overlay .pp-eco-hi .l{font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;text-transform:uppercase;letter-spacing:1.4px}
  #pp-overlay .pp-eco-pie{margin:13px 0 0!important;font-size:12px!important;color:#7d8794!important;text-align:center;line-height:1.6!important}

  /* Pestañas */
  #pp-overlay .pp-tabs{display:flex;gap:8px;background:#0b0e12;border:1px solid #2b3139;border-radius:12px;padding:5px;margin-bottom:18px}
  #pp-overlay .pp-tab{flex:1;padding:11px;border:none;border-radius:8px;background:transparent;color:#b7bdc6;font-family:var(--display,sans-serif);font-weight:700;font-size:13px;cursor:pointer;letter-spacing:.3px;transition:all .14s}
  #pp-overlay .pp-tab.on{color:#3a2800;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);box-shadow:0 3px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.4);text-shadow:0 1px 0 rgba(255,255,255,.3)}
  #pp-overlay .pp-pane{display:none}
  #pp-overlay .pp-pane.on{display:block;animation:ppIn .16s ease both}

  /* Fondo (hero) */
  #pp-overlay .pp-fondo{text-align:center;background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid #2b3139;border-radius:16px;padding:20px 16px;margin-bottom:16px;box-shadow:0 6px 0 rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05);position:relative;overflow:hidden}
  #pp-overlay .pp-fondo::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold,#E8B84B),transparent);opacity:.6}
  #pp-overlay .pp-fondo .l{font-family:var(--mono,monospace);font-size:11px;color:#7d8794;text-transform:uppercase;letter-spacing:1px}
  #pp-overlay .pp-fondo .v{font-family:var(--display,sans-serif);font-weight:800;font-size:40px;color:var(--gold,#E8B84B);margin-top:6px;line-height:1;text-shadow:0 2px 3px rgba(0,0,0,.7),0 3px 0 rgba(143,106,26,.35)}
  #pp-overlay .pp-fondo .v small{font-size:19px;color:#c79426}

  /* Barra de progreso */
  #pp-overlay .pp-plab{display:flex;justify-content:space-between;font-family:var(--mono,monospace);font-size:11.5px;color:#b7bdc6;margin-bottom:7px}
  #pp-overlay .pp-plab b{color:var(--gold,#E8B84B)}
  #pp-overlay .pp-bar{height:12px;border-radius:7px;background:#0b0e12;border:1px solid #2b3139;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.6)}
  #pp-overlay .pp-bar>i{display:block;height:100%;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 60%,#c79426);box-shadow:0 0 10px rgba(232,184,75,.4);transition:width .5s ease}
  #pp-overlay .pp-timer{text-align:center;font-family:var(--mono,monospace);font-size:16px;color:#eaecef;font-weight:700;letter-spacing:1px;margin:14px 0 16px}
  #pp-overlay .pp-timer .u{color:#7d8794;font-size:10px;font-weight:400;margin-left:1px}
  #pp-overlay .pp-timer .tl{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;font-weight:400}

  /* Chips de stats */
  #pp-overlay .pp-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
  #pp-overlay .pp-stat{background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid #2b3139;border-radius:12px;padding:13px 10px;text-align:center;box-shadow:0 3px 0 rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.04)}
  #pp-overlay .pp-stat .sl{font-family:var(--mono,monospace);font-size:9.5px;color:#7d8794;text-transform:uppercase;letter-spacing:.5px}
  #pp-overlay .pp-stat .sv{font-family:var(--display,sans-serif);font-weight:800;font-size:19px;color:var(--gold,#E8B84B);margin-top:4px;line-height:1}
  #pp-overlay .pp-stat .sv small{font-size:11px;color:#7d8794;font-weight:400}

  #pp-overlay .pp-dist{background:rgba(255,255,255,.02);border:1px solid var(--line-soft,rgba(255,255,255,.055));border-radius:12px;padding:12px 14px;margin-bottom:16px}
  #pp-overlay .pp-dist .dl{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px}
  #pp-overlay .pp-dist .dv{font-family:var(--mono,monospace);font-size:12.5px;color:#b7bdc6;line-height:1.7}
  #pp-overlay .pp-dist .dv b{color:var(--gold,#E8B84B)}

  /* Botón participar (3D dorado) */
  #pp-overlay .pp-btn{width:100%;padding:15px;border-radius:13px;font-family:var(--display,sans-serif);font-weight:800;font-size:16px;cursor:pointer;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;box-shadow:0 5px 0 #8f6a1a,0 10px 22px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.5);text-shadow:0 1px 0 rgba(255,255,255,.3);letter-spacing:.3px;transition:transform .08s,box-shadow .08s}
  #pp-overlay .pp-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.4)}
  #pp-overlay .pp-btn:disabled{opacity:.55;cursor:not-allowed}
  #pp-overlay .pp-form{margin-top:14px;display:none}
  #pp-overlay .pp-form.on{display:block}
  #pp-overlay .pp-form input{width:100%;background:#0b0e12;border:1px solid #2b3139;border-radius:11px;color:#eaecef;font-family:var(--mono,monospace);font-size:14px;padding:13px;margin-bottom:9px;box-shadow:inset 0 1px 3px rgba(0,0,0,.4)}
  #pp-overlay .pp-form input:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  #pp-overlay .pp-msg{font-family:var(--mono,monospace);font-size:12px;line-height:1.5;margin-top:11px;text-align:center;min-height:16px}
  #pp-overlay .pp-msg.err{color:var(--rojo,#f6465d)} #pp-overlay .pp-msg.ok{color:var(--neon-lit,#2ee86a)} #pp-overlay .pp-msg.info{color:#7d8794}

  /* Reclamo */
  #pp-overlay .pp-claim{margin-top:14px;padding:14px;border-radius:12px;background:rgba(46,232,106,.07);border:1px solid rgba(46,232,106,.35);font-family:var(--mono,monospace);font-size:12.5px;color:var(--neon-lit,#2ee86a);text-align:center}
  #pp-overlay .pp-claim b{font-size:14px}
  #pp-overlay .pp-claim button{margin-top:9px;width:100%;padding:12px;border-radius:10px;border:1px solid rgba(46,232,106,.5);background:rgba(46,232,106,.14);color:var(--neon-lit,#2ee86a);font-family:var(--display,sans-serif);font-weight:800;cursor:pointer;font-size:14px}

  /* Ganadores */
  #pp-overlay .pp-mio{margin-top:14px;padding:14px;border-radius:12px;background:rgba(46,232,106,.07);border:1px solid rgba(46,232,106,.35);text-align:center}
  #pp-overlay .pp-mio .t{font-family:var(--display,sans-serif);font-weight:800;font-size:14px;color:var(--neon-lit,#2ee86a)}
  #pp-overlay .pp-mio .d{font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;margin:5px 0 10px}
  #pp-overlay .pp-mio .d b{color:#eaecef}
  #pp-overlay .pp-mio-b{width:100%;padding:11px;border-radius:10px;border:1px solid #3a424c;background:linear-gradient(180deg,#1b2027,#0d1117);color:#b7bdc6;font-family:var(--display,sans-serif);font-weight:700;font-size:12.5px;cursor:pointer;min-height:44px}
  #pp-overlay .pp-mio-b:hover{color:var(--rojo,#f6465d);border-color:rgba(246,70,93,.4)}
  #pp-overlay .pp-mio-av{font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;margin-top:8px;line-height:1.5}
  #pp-overlay .pp-mio-av b{color:var(--gold-soft,#C9A84B)}
  #pp-overlay .pp-mio.cerrado{background:rgba(232,184,75,.07);border-color:rgba(232,184,75,.35)}
  #pp-overlay .pp-mio.cerrado .t{color:var(--gold,#E8B84B)}
  #pp-overlay .pp-mio-lock{font-family:var(--display,sans-serif);font-weight:800;font-size:13px;color:var(--gold,#E8B84B);padding:11px;border-radius:10px;background:rgba(0,0,0,.25);border:1px dashed rgba(232,184,75,.4)}
  #pp-overlay .pp-mio-lock span{display:block;font-family:var(--sans,sans-serif);font-weight:400;font-size:11.5px;color:#8b96a3;margin-top:6px;line-height:1.55}
  #pp-overlay .pp-gana{margin-top:14px;padding:20px 16px;border-radius:16px;text-align:center;background:linear-gradient(180deg,rgba(46,232,106,.14),rgba(46,232,106,.05));border:1px solid rgba(46,232,106,.5);box-shadow:0 6px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.08)}
  #pp-overlay .pp-gana-c{font-size:34px;line-height:1}
  #pp-overlay .pp-gana-t{font-family:var(--display,sans-serif);font-weight:800;font-size:21px;color:var(--neon-lit,#2ee86a);margin-top:6px}
  #pp-overlay .pp-gana-m{font-family:var(--display,sans-serif);font-weight:800;font-size:34px;color:#eaecef;line-height:1.1;margin-top:4px}
  #pp-overlay .pp-gana-m small{font-size:16px;color:#8b96a3}
  #pp-overlay .pp-gana-d{font-family:var(--sans,sans-serif);font-size:12.5px;color:#8b96a3;margin:7px 0 14px;line-height:1.5}
  #pp-overlay .pp-gana button{width:100%;padding:14px;border-radius:12px;border:1px solid rgba(46,232,106,.55);background:linear-gradient(180deg,#8ff0bd,#34d97b 50%,#1f9e5f);color:#042415;font-family:var(--display,sans-serif);font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 4px 0 #158043;min-height:48px}
  #pp-overlay .pp-atasco{margin-top:14px;padding:15px;border-radius:12px;background:rgba(232,184,75,.08);border:1px solid rgba(232,184,75,.4)}
  #pp-overlay .pp-atasco .t{font-family:var(--display,sans-serif);font-weight:800;font-size:14.5px;color:var(--gold,#E8B84B);text-align:center}
  #pp-overlay .pp-atasco .d{font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;line-height:1.6;margin:7px 0 11px;text-align:center}
  #pp-overlay .pp-atasco .d b{color:var(--gold-soft,#C9A84B)}
  #pp-overlay .pp-gas{margin-top:12px;padding:11px 13px;border-radius:11px;background:rgba(255,255,255,.03);border:1px dashed #3a424c;text-align:center}
  #pp-overlay .pp-gas span{display:block;font-family:var(--mono,monospace);font-size:9px;color:#6b7681;text-transform:uppercase;letter-spacing:.8px}
  #pp-overlay .pp-gas b{display:block;font-family:var(--display,sans-serif);font-size:17px;color:var(--neon-lit,#2ee86a);margin:3px 0}
  #pp-overlay .pp-gas.bajo b{color:var(--gold,#E8B84B)}
  #pp-overlay .pp-gas i{display:block;font-style:normal;font-family:var(--sans,sans-serif);font-size:10.5px;color:#7d8794;line-height:1.4}
  @media(max-width:560px){
    #pp-overlay .pp-gana-m{font-size:28px}
    #pp-overlay .pp-gana-t{font-size:18px}
    #pp-overlay .pp-gana-d,#pp-overlay .pp-atasco .d{font-size:11.5px}
  }
  #pp-overlay .pp-win{margin-top:20px}
  #pp-overlay .pp-win .wt{font-family:var(--mono,monospace);font-size:11px;color:#7d8794;text-transform:uppercase;letter-spacing:.8px;margin-bottom:9px;text-align:center}
  #pp-overlay .pp-w{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:11px;background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid #2b3139;font-family:var(--mono,monospace);font-size:12.5px;margin-bottom:7px;box-shadow:0 2px 0 rgba(0,0,0,.3)}
  #pp-overlay .pp-w .rk{flex:0 0 auto;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-family:var(--display,sans-serif);font-weight:800;font-size:12px;background:linear-gradient(180deg,#2b3139,#1b2027);color:#b7bdc6;border:1px solid #3a424c}
  #pp-overlay .pp-w.top .rk{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800;border-color:#c79426;box-shadow:0 2px 0 #8f6a1a}
  #pp-overlay .pp-w .nm{color:#eaecef;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
  #pp-overlay .pp-w .tg{color:#7fb0ff;font-size:11px}
  #pp-overlay .pp-w .pz{color:var(--gold,#E8B84B);font-weight:800;flex:0 0 auto}

  /* Cómo funciona — una idea por pantalla */
  #pp-overlay .pp-guia-card{padding:26px 22px;border-radius:18px;text-align:center;margin-bottom:14px;
    background:linear-gradient(180deg,rgba(232,184,75,.07),rgba(232,184,75,.015));border:1px solid rgba(232,184,75,.28)}
  #pp-overlay .pp-guia-n{font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:1.6px;margin-bottom:12px}
  #pp-overlay .pp-guia-t{font-family:var(--display,sans-serif);font-weight:800;font-size:21px;color:#eaecef;line-height:1.2}
  #pp-overlay .pp-guia-d{font-family:var(--sans,sans-serif);font-size:14px;color:#8b96a3;line-height:1.7;
    margin:12px auto 20px;max-width:44ch}
  #pp-overlay .pp-guia-d em{color:var(--gold,#E8B84B);font-style:normal}
  #pp-overlay .pp-puntos{display:flex;gap:6px;justify-content:center;margin-bottom:20px;flex-wrap:wrap}
  #pp-overlay .pp-puntos span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.15)}
  #pp-overlay .pp-puntos span.on{background:var(--gold,#E8B84B);width:18px;border-radius:20px}
  #pp-overlay .pp-guia-acts{display:flex;gap:9px;justify-content:center}
  #pp-overlay .pp-cb{min-width:150px;min-height:48px;padding:13px 26px;border-radius:12px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 0 #8f6a1a}
  #pp-overlay .pp-cb.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:#b7bdc6;
    box-shadow:0 3px 0 rgba(0,0,0,.4);min-width:100px}
  #pp-overlay .pp-cb:active{transform:translateY(2px)}
  #pp-overlay .pp-cb .tx-s{display:none}
  @media(max-width:560px){
    #pp-overlay .pp-guia-card{padding:22px 16px}
    #pp-overlay .pp-guia-t{font-size:18px}
    #pp-overlay .pp-guia-d{font-size:13px}
    #pp-overlay .pp-cb{min-width:0;flex:1;padding:13px 14px;font-size:13px}
    #pp-overlay .pp-cb .tx-l{display:none}
    #pp-overlay .pp-cb .tx-s{display:inline}
  }

  /* Cómo funciona */
  #pp-overlay .pp-intro{font-family:var(--sans,sans-serif);font-size:14px;color:#b7bdc6;line-height:1.6;text-align:center;margin-bottom:18px}
  #pp-overlay .pp-intro b{color:var(--gold,#E8B84B)}
  #pp-overlay .pp-step{display:flex;gap:13px;padding:14px;border-radius:13px;background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid #2b3139;margin-bottom:10px;box-shadow:0 3px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.03)}
  #pp-overlay .pp-step .n{flex:0 0 auto;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-family:var(--display,sans-serif);font-weight:800;font-size:16px;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800;border:1px solid #c79426;box-shadow:0 3px 0 #8f6a1a}
  #pp-overlay .pp-step .tx b{font-family:var(--display,sans-serif);color:#eaecef;font-size:14.5px;display:block;margin-bottom:3px}
  #pp-overlay .pp-step .tx span{font-family:var(--sans,sans-serif);font-size:12.5px;color:#8b96a3;line-height:1.55}
  #pp-overlay .pp-step .tx span em{color:var(--gold-soft,#C9A84B);font-style:normal}
  #pp-overlay .pp-cta{margin-top:16px;text-align:center}
  #pp-overlay .pp-note{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-align:center;margin-top:16px;line-height:1.6}
  #pp-overlay .pp-empty{font-family:var(--mono,monospace);font-size:13px;color:#7d8794;text-align:center;padding:40px 0;line-height:1.6}

  /* ── Móvil ── */
  @media(max-width:560px){
    #pp-overlay{padding:0}
    #pp-overlay .pp-card{max-width:100%;max-height:100vh;height:100vh;border-radius:0;border:none;padding:20px 16px}
    #pp-overlay .pp-title{font-size:21px;letter-spacing:1px}
    #pp-overlay .pp-title .pp-line{width:16px;margin:0 8px}
    #pp-overlay .pp-fondo .v{font-size:32px}
    #pp-overlay .pp-fondo .v small{font-size:16px}
    #pp-overlay .pp-stats{grid-template-columns:repeat(3,1fr);gap:7px}
    #pp-overlay .pp-stat{padding:11px 5px}
    #pp-overlay .pp-stat .sv{font-size:15px}
    #pp-overlay .pp-stat .sl{font-size:8.5px}
    #pp-overlay .pp-step{padding:12px;gap:11px}
    #pp-overlay .pp-step .n{width:30px;height:30px;font-size:14px}
    #pp-overlay .pp-intro{font-size:13px}
  }
  `;
  document.head.appendChild(s);
}

/* ───────── Overlay ───────── */
let _timer = null;
function overlay() {
  let o = $('pp-overlay');
  if (o) return o;
  o = document.createElement('div'); o.id = 'pp-overlay';
  o.innerHTML = `<div class="pp-card" id="pp-card"></div>`;
  document.body.appendChild(o);
  o.addEventListener('click', e => { if (e.target === o) cerrar(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
  return o;
}
function cerrar() { const o = $('pp-overlay'); if (o) o.classList.remove('show'); if (_timer) { clearInterval(_timer); _timer = null; } }

function cuentaAtras(endTime) {
  const el = $('pp-timer'); if (!el) return;
  const tick = () => {
    const left = Number(endTime) - Math.floor(Date.now() / 1000);
    if (left <= 0) { el.innerHTML = '<span class="tl">Estado</span>Ciclo terminado — cerrando'; if (_timer) clearInterval(_timer); return; }
    const d = Math.floor(left / 86400), h = Math.floor((left % 86400) / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;
    el.innerHTML = `<span class="tl">Cierra en</span>${d}<span class="u">d</span> ${String(h).padStart(2,'0')}<span class="u">h</span> ${String(m).padStart(2,'0')}<span class="u">m</span> ${String(s).padStart(2,'0')}<span class="u">s</span>`;
  };
  tick(); if (_timer) clearInterval(_timer); _timer = setInterval(tick, 1000);
}

function tabHTML() {
  return `
  <div class="pp-tabs">
    <button class="pp-tab on" id="pp-tab-ev">Evento</button>
    <button class="pp-tab" id="pp-tab-hw">Cómo funciona</button>
  </div>`;
}

let _ppPasos = [];

function comoFunciona(entrada) {
  const pasos = [
    ['¿Qué es esto?', 'Muchas personas ponen un granito, se junta un <em>premio grande</em> y se reparte entre <em>muchos ganadores</em>. No es apostar a lo loco: es una <em>oportunidad con reglas claras</em>, pensada para que gane la mayor cantidad de gente.'],
    ['Conecta tu wallet', 'Sin cuenta, sin banco, sin papeleo. Tu dinero <em>siempre está en tu wallet</em> — nosotros nunca lo tocamos. Solo lo conectas para poder entrar.'],
    ['Pon tu nombre y tu Telegram', 'Así, <em>si ganas</em>, todos ven que fue una persona real y pueden felicitarte. Transparencia total: los ganadores quedan a la vista de todos.'],
    ['Participa con ' + entrada + ' USDT', 'Menos que un café. Casi todo va al <em>fondo común de premios</em>; solo una pizca cubre el sistema. Puedes entrar una vez… o varias, tú decides.'],
    ['El fondo crece con cada persona', 'Mientras <em>más gente entra, más grande es el premio</em> — y también <em>más ganadores hay</em>. Todos suman para todos.'],
    ['Se eligen los ganadores', 'Al azar, pero de forma <em>verificable en la blockchain</em>. Nadie hace trampa, ni siquiera nosotros: el sorteo lo hace un sistema público y auditable.'],
    ['Reclamas tu premio', 'Si ganas, el premio llega <em>directo a tu wallet</em>. Y si no se junta suficiente gente, se te <em>devuelve tu aporte</em>. Reglas claras desde el minuto uno.'],
    ['¿Y si me arrepiento?', 'Puedes <em>salirte y recuperar tu aporte</em> cuando quieras… hasta <em>24 horas antes del cierre</em>. En ese último día la salida se bloquea para todos, y es a propósito: así nadie engorda el premio y se marcha justo antes del sorteo. El pozo que ves en la recta final es <em>real y se reparte</em>.']
  ];
  /* ══════════════════════════════════════════════════════════════
     Una idea por pantalla, igual que en el Marketplace. Ocho párrafos
     seguidos no los lee nadie; de uno en uno, sí.
     ══════════════════════════════════════════════════════════════ */
  _ppPasos = pasos;   // se guarda ANTES de pintar, o la tarjeta sale vacía
  let html = `
  <div id="pp-guia" data-i="0">${ppTarjeta(0, pasos)}</div>
  <button class="pp-eco-btn" id="pp-eco-btn">Funcionamiento económico <span class="ar">▼</span></button>
  <div class="pp-eco" id="pp-eco">
    <p>Pones <b>${entrada} USDT</b>. Si ganas, <b>recuperas eso y varias veces más</b>. Y no gana solo uno: <b>gana 1 de cada 5 participantes</b>. Mientras más gente entra, <b>más ganadores hay</b> — ese es el objetivo.</p>
    <div class="pp-eco-hi"><span class="n">1 de cada 5</span><span class="l">participantes gana</span></div>
    <table class="pp-eco-tbl">
      <tr><th>Si entran</th><th>Ganan</th><th>Multiplicas tu entrada</th></tr>
      <tr><td>10</td><td>2 personas</td><td>2.9× – 3.8×</td></tr>
      <tr><td>50</td><td>10 personas</td><td>2.3× – 4.4×</td></tr>
      <tr><td>100</td><td>20 personas</td><td>2.1× – 4.5×</td></tr>
      <tr><td>300</td><td>60 personas</td><td>2.1× – 4.6×</td></tr>
      <tr><td>500</td><td>100 personas</td><td>2.0× – 4.6×</td></tr>
    </table>
    <p class="pp-eco-pie">Si no ganas, lo único que arriesgaste fue <b>${entrada} USDT</b> — menos que un refresco. Y si la ronda no reúne el mínimo de gente, <b>se te devuelve tu aporte</b>.</p>
  </div>`;
  return html;
}

/** Una tarjeta de la guía. */
function ppTarjeta(i, pasos) {
  const p = pasos[i];
  const ultimo = i === pasos.length - 1;
  return `
  <div class="pp-guia-card">
    <div class="pp-guia-n">${i + 1} de ${pasos.length}</div>
    <div class="pp-guia-t">${p[0]}</div>
    <div class="pp-guia-d">${p[1]}</div>
    <div class="pp-puntos">${pasos.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>
    <div class="pp-guia-acts">
      ${i > 0 ? `<button class="pp-cb gris" data-pp-atras>Atrás</button>` : ''}
      ${ultimo
        ? `<button class="pp-cb" id="pp-goto-ev">Quiero participar</button>`
        : `<button class="pp-cb" data-pp-mas><span class="tx-l">Saber más</span><span class="tx-s">Más</span></button>`}
    </div>
  </div>`;
}

/** Cambia de tarjeta. Se llama desde los botones. */
function ppIr(i) {
  const pasos = _ppPasos || [];
  if (!pasos.length) return;
  const z = document.getElementById('pp-guia');
  if (!z) return;
  const k = Math.max(0, Math.min(pasos.length - 1, i));
  z.dataset.i = k;
  z.innerHTML = ppTarjeta(k, pasos);
  const m = z.querySelector('[data-pp-mas]');
  if (m) m.onclick = () => ppIr(k + 1);
  const a = z.querySelector('[data-pp-atras]');
  if (a) a.onclick = () => ppIr(k - 1);
  const g = z.querySelector('#pp-goto-ev');
  if (g) g.onclick = () => { const t = document.getElementById('pp-tab-ev'); if (t) t.click(); };
}

/* ───────── Abrir + cargar datos reales ───────── */
export async function abrirPrizePool() {
  estilos();
  const o = overlay(); const card = $('pp-card');
  o.classList.add('show');
  card.innerHTML = `<button class="pp-x" id="pp-x">✕</button><div class="pp-empty">Cargando Prize Pool…</div>`;
  $('pp-x').onclick = cerrar;

  let st;
  try { st = await leePP('estadoActual'); }
  catch (e) {
    card.innerHTML = `<button class="pp-x" id="pp-x">✕</button><div class="pp-empty">No se pudo cargar el Prize Pool ahora mismo.<br>Revisa tu conexión y vuelve a intentar.</div>`;
    $('pp-x').onclick = cerrar; return;
  }

  const round = Number(st.round), pool = fmt(st.pool), players = Number(st.players);
  const minReq = Number(st.minReq), endTime = st.endTime, entrada = fmt(st.entrada), W = Number(st.ganadoresEstimados);
  const pct = minReq > 0 ? Math.min(100, Math.round(players / minReq * 100)) : 0;

  let distTxt = 'Se define al cerrar, según cuánta gente entre.';
  try {
    const d = await leePP('distribucionEstimada', [st.pool, st.players]);
    if (d && d.length) {
      const top = d.slice(0, 3).map((x, i) => `<b>${i + 1}º</b> ${num(fmt(x), 2)}`);
      distTxt = top.join(' &nbsp;·&nbsp; ') + (d.length > 3 ? ` &nbsp;·&nbsp; +${d.length - 3} más` : '') + ' USDT';
    }
  } catch (_) {}

  card.innerHTML = render(round, pool, players, minReq, pct, entrada, W, distTxt);
  $('pp-x').onclick = cerrar;
  cuentaAtras(endTime);
  wireTabs(); wireParticipar();
  cargarGanadores(); cargarReclamo(); cargarMiAporte(); revisarSorteo(round); panelGasOwner();
}

function render(round, pool, players, minReq, pct, entrada, W, distTxt) {
  const e = num(entrada, 2);
  return `
  <button class="pp-x" id="pp-x">✕</button>
  <div class="pp-head">
    <div class="pp-title"><span class="pp-line"></span>Prize Pool<span class="pp-line r"></span></div>
    <div class="pp-round"><span class="dot"></span> Ronda #${round} <span class="sep"></span> <span class="fc">Fondo comunitario</span></div>
  </div>
  ${tabHTML()}

  <div class="pp-pane on" id="pp-pane-ev">
    <div class="pp-fondo"><div class="l">Fondo total de premios</div><div class="v">${num(pool, 2)} <small>USDT</small></div></div>

    <div class="pp-plab"><span>Participantes</span><span><b>${players}</b> / ${minReq} mínimo ${players >= minReq ? '· listo' : ''}</span></div>
    <div class="pp-bar"><i style="width:${pct}%"></i></div>
    <div class="pp-timer" id="pp-timer">—</div>

    <div class="pp-stats">
      <div class="pp-stat"><div class="sl">Entrada</div><div class="sv">${e} <small>USDT</small></div></div>
      <div class="pp-stat"><div class="sl">Ganadores</div><div class="sv">${W || '—'}</div></div>
      <div class="pp-stat"><div class="sl">Se reparte</div><div class="sv">100<small>%</small></div></div>
    </div>

    <div class="pp-dist"><div class="dl">Distribución estimada de premios</div><div class="dv">${distTxt}</div></div>

    <button class="pp-btn" id="pp-go">Participar · ${e} USDT</button>
    <div class="pp-form" id="pp-form">
      <input id="pp-name" maxlength="40" placeholder="Tu nombre">
      <input id="pp-tg" maxlength="40" placeholder="Tu usuario de Telegram (opcional)">
      <button class="pp-btn" id="pp-confirm" style="margin-top:4px">Confirmar participación</button>
    </div>
    <div class="pp-msg info" id="pp-msg"></div>
    <div id="pp-mio"></div>
    <div id="pp-claim-box"></div>
    <div class="pp-win" id="pp-win"></div>
    <div class="pp-note">Puedes salirte y recuperar tu aporte hasta 24 h antes del cierre; en el último día la salida se bloquea para todos.<br>Al participar, tu nombre y Telegram quedan registrados on-chain y se muestran si ganas. Participa con responsabilidad.</div>
  </div>

  <div class="pp-pane" id="pp-pane-hw">
    ${comoFunciona(e)}
  </div>`;
}

/* ───────── Pestañas ───────── */
function wireTabs() {
  const ev = $('pp-tab-ev'), hw = $('pp-tab-hw'), pev = $('pp-pane-ev'), phw = $('pp-pane-hw');
  const go = (which) => {
    const isEv = which === 'ev';
    ev.classList.toggle('on', isEv); hw.classList.toggle('on', !isEv);
    pev.classList.toggle('on', isEv); phw.classList.toggle('on', !isEv);
    $('pp-card').scrollTop = 0;
  };
  if (ev) ev.onclick = () => go('ev');
  if (hw) hw.onclick = () => { go('hw'); setTimeout(() => ppIr(0), 30); };
  const goev = $('pp-goto-ev'); if (goev) goev.onclick = () => go('ev');
  // La guía arranca ya montada, con sus botones conectados.
  setTimeout(() => { if (document.getElementById('pp-guia')) ppIr(0); }, 60);
  const eco = $('pp-eco-btn'); if (eco) eco.onclick = () => { eco.classList.toggle('open'); const p = $('pp-eco'); if (p) p.classList.toggle('open'); };
}

/* ───────── Participar ───────── */
function wireParticipar() {
  const go = $('pp-go'), form = $('pp-form');
  if (go) go.onclick = () => { form.classList.toggle('on'); if (form.classList.contains('on')) $('pp-name').focus(); };
  const cf = $('pp-confirm'); if (cf) cf.onclick = participar;
}
function msg(t, cls) { const m = $('pp-msg'); if (m) { m.className = 'pp-msg ' + (cls || 'info'); m.textContent = t; } }

async function participar() {
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  if (!cuenta) { msg('Conecta tu wallet primero.', 'err'); return; }
  const name = ($('pp-name').value || '').trim();
  const tg = ($('pp-tg').value || '').trim();
  if (!name) { msg('Pon tu nombre.', 'err'); return; }
  if (!limpio(name) || !limpio(tg)) { msg('Ese nombre/usuario no está permitido. Usa uno apropiado.', 'err'); return; }

  const btn = $('pp-confirm'); btn.disabled = true;
  try {
    const signer = await firmante();
    const usdt = new ethers.Contract(USDT, ERC20, signer);
    const pp = new ethers.Contract(PRIZEPOOL, PP_ABI, signer);
    const total = await leePP('entryTotal');

    msg('Revisando permiso de USDT…', 'info');
    const alw = await usdt.allowance(cuenta, PRIZEPOOL);
    if (alw < total) {
      msg('Aprueba el gasto de USDT en tu wallet…', 'info');
      const txa = await usdt.approve(PRIZEPOOL, total); await txa.wait();
    }
    let value = 0n;
    try { if (await leePP('necesitaGas')) value = await leePP('gasPerEntry'); } catch (_) {}

    msg('Confirma la participación en tu wallet…', 'info');
    const tx = await pp.participar(name, tg, ethers.ZeroAddress, { value });
    await tx.wait();
    msg('¡Listo! Ya estás participando. Mucha suerte.', 'ok');
    setTimeout(() => abrirPrizePool(), 1600);
  } catch (e) { msg(traducir(e), 'err'); }
  finally { btn.disabled = false; }
}
function traducir(e) {
  const s = (e && (e.reason || e.shortMessage || e.message) || '').toLowerCase();
  if (s.includes('user rejected') || s.includes('denied')) return 'Cancelaste la operación.';
  if (s.includes('insufficient')) return 'Saldo insuficiente (USDT o BNB para el gas).';
  if (s.includes('rondanoabierta') || s.includes('rondaencurso')) return 'La ronda no está abierta ahora mismo.';
  return 'No se pudo completar. Intenta de nuevo.';
}

/* ───────── Sorteo atascado por gas: cualquiera puede destrabarlo ───────── */
async function revisarSorteo(rondaActual) {
  const box = $('pp-mio'); if (!box) return;
  try {
    const anterior = Number(rondaActual) - 1;
    if (anterior < 1) return;
    const atascado = await leePP('sorteoAtascado', [anterior]);
    if (!atascado) return;
    const falta = await leePP('gasFaltante');
    const bnb = Number(ethers.formatEther(falta));
    box.insertAdjacentHTML('afterbegin', `<div class="pp-atasco">
      <div class="t">El sorteo está esperando</div>
      <div class="d">La ronda #${anterior} ya cerró, pero al sistema le falta un poquito de gas para sortear. <b>Nadie pierde nada</b>: el dinero sigue guardado.<br>
      Cualquiera puede destrabarlo poniendo <b>${bnb.toFixed(4)} BNB</b> (unos centavos) y el sorteo se hace al momento.</div>
      <button class="pp-mio-b" id="pp-destrabar">Destrabar el sorteo (${bnb.toFixed(4)} BNB)</button>
    </div>`);
    $('pp-destrabar').onclick = async () => {
      try {
        msg('Confirma en tu wallet…', 'info');
        const c = new ethers.Contract(PRIZEPOOL, PP_ABI, await firmante());
        await (await c.destrabarSorteo(anterior, { value: falta })).wait();
        msg('¡Listo! El sorteo ya se está haciendo.', 'ok');
        setTimeout(() => abrirPrizePool(), 2000);
      } catch (e) { msg(traducir(e), 'err'); }
    };
  } catch (_) {}
}

/* ───────── Estado del gas: SOLO lo ve el owner ───────── */
async function panelGasOwner() {
  const box = $('pp-mio'); if (!box) return;
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  if (!cuenta) return;
  try {
    const dueno = await leePP('owner');
    if (String(dueno).toLowerCase() !== String(cuenta).toLowerCase()) return;
    const [enSponsor, enReserva, objetivo] = await leePP('saldoGas');
    const s = Number(ethers.formatEther(enSponsor)), r = Number(ethers.formatEther(enReserva)), o = Number(ethers.formatEther(objetivo));
    const ok = (s + r) >= o * 0.5;
    box.insertAdjacentHTML('beforeend', `<div class="pp-gas ${ok ? '' : 'bajo'}">
      <span>Gas del sorteo (solo lo ves tú)</span>
      <b>${(s + r).toFixed(4)} BNB</b>
      <i>${ok ? 'Suficiente. Se rellena solo con cada participación.' : 'Bajo. Se irá rellenando con las próximas participaciones.'}</i>
    </div>`);
  } catch (_) {}
}

/* ───────── Mi participación (con opción de abandonar) ───────── */
async function cargarMiAporte() {
  const box = $('pp-mio'); if (!box) return;
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  if (!cuenta) { box.innerHTML = ''; return; }
  try {
    const [tickets, devolucion, puedeSalir, cierreSalida] = await leePP('miAporte', [cuenta]);
    if (Number(tickets) === 0) { box.innerHTML = ''; return; }
    const faltan = Number(cierreSalida) - Math.floor(Date.now() / 1000);
    const hs = Math.max(0, Math.floor(faltan / 3600));
    const min = Math.max(0, Math.floor((faltan % 3600) / 60));
    box.innerHTML = `<div class="pp-mio ${puedeSalir ? '' : 'cerrado'}">
      <div class="t">Ya estás participando</div>
      <div class="d">Tienes <b>${Number(tickets)}</b> ${Number(tickets) === 1 ? 'participación' : 'participaciones'} en esta ronda.</div>
      ${puedeSalir
        ? `<button class="pp-mio-b" id="pp-aband">Abandonar y recuperar ${num(fmt(devolucion), 2)} USDT</button>
           <div class="pp-mio-av">Podrás salirte durante <b>${hs}h ${min}m</b> más. Después queda bloqueado hasta que salgan los ganadores.</div>`
        : `<div class="pp-mio-lock">Salida cerrada
             <span>Estamos en las últimas 24 horas. Nadie puede retirar su aporte hasta que se sorteen los ganadores: así nadie infla el pozo y se va antes del sorteo.</span></div>`}
    </div>`;
    if (!puedeSalir) return;
    $('pp-aband').onclick = async () => {
      if (!confirm('¿Seguro que quieres abandonar?\n\nSe te devuelve tu aporte al fondo y quedas fuera del sorteo. La comisión de la plataforma no se devuelve.')) return;
      try {
        msg('Confirma en tu wallet…', 'info');
        const c = new ethers.Contract(PRIZEPOOL, PP_ABI, await firmante());
        await (await c.abandonarParticipacion()).wait();
        msg('Listo. Tu aporte volvió a tu wallet.', 'ok');
        setTimeout(() => abrirPrizePool(), 1200);
      } catch (e) { msg(traducir(e), 'err'); }
    };
  } catch (_) { box.innerHTML = ''; }
}

/* ───────── Ganadores ───────── */
async function cargarGanadores() {
  const box = $('pp-win'); if (!box) return;
  try {
    const [rnd, ws] = await leePP('ultimosGanadores');
    if (!ws || ws.length === 0) { box.innerHTML = ''; return; }
    let html = `<div class="wt">Últimos ganadores · ronda #${Number(rnd)}</div>`;
    ws.forEach(w => {
      const r = Number(w.rank);
      const tg = w.telegram && w.telegram.length ? `<span class="tg">@${esc(w.telegram.replace(/^@/, ''))}</span>` : '';
      html += `<div class="pp-w ${r <= 3 ? 'top' : ''}"><span class="rk">${r}º</span><span class="nm">${esc(w.name)} ${tg}</span><span class="pz">${num(fmt(w.prize), 2)} USDT</span></div>`;
    });
    box.innerHTML = html;
  } catch (_) { box.innerHTML = ''; }
}

/* ───────── Reclamo ───────── */
async function cargarReclamo() {
  const box = $('pp-claim-box'); if (!box) return;
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  if (!cuenta) { box.innerHTML = ''; return; }
  try {
    const [rnd] = await leePP('ultimosGanadores');
    if (!rnd) return;
    const [amount, ya] = await leePP('miReclamo', [rnd, cuenta]);
    if (amount > 0n && !ya) {
      box.innerHTML = `<div class="pp-gana">
        <div class="pp-gana-c">🎉</div>
        <div class="pp-gana-t">¡Ganaste!</div>
        <div class="pp-gana-m">${num(fmt(amount), 2)} <small>USDT</small></div>
        <div class="pp-gana-d">Ronda #${Number(rnd)} · el premio es tuyo, va directo a tu wallet.</div>
        <button id="pp-claim-btn">Cobrar mi premio</button>
      </div>`;
      $('pp-claim-btn').onclick = async () => {
        try {
          const signer = await firmante();
          const pp = new ethers.Contract(PRIZEPOOL, PP_ABI, signer);
          const tx = await pp.reclamar(rnd); await tx.wait();
          msg('¡Reclamado! Revisa tu wallet.', 'ok'); cargarReclamo();
        } catch (e) { msg(traducir(e), 'err'); }
      };
    } else { box.innerHTML = ''; }
  } catch (_) { box.innerHTML = ''; }
}
