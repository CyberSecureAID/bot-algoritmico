/* modules/multichart/estilos.js — Estilos del servicio Multichart.
   Misma identidad visual (oro/oscuro) que el resto de la sección Análisis. */

let puesto = false;
export function estilos() {
  if (puesto || document.getElementById('mc-css')) { puesto = true; return; }
  puesto = true;
  const s = document.createElement('style'); s.id = 'mc-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* Las variables se definen también en los flotantes (pop/modal/toast) porque
   esos se cuelgan dentro de #mc-overlay y así heredan oro, líneas, etc. */
const CSS = `
  #mc-overlay{
    --mc-bg:#05070a; --mc-panel:#0b0f15; --mc-panel2:#0d1219; --mc-line:#1a212b; --mc-line2:#232c38;
    --mc-ink:#eaecef; --mc-ink2:#a9b2bd; --mc-ink3:#6b7580; --mc-gold:#E8B84B; --mc-gold-soft:#C9A84B;
    --mc-up:#2ee86a; --mc-up2:#34d98a; --mc-down:#ff5b6e; --mc-down2:#ff8591;
    --mc-disp:'Chakra Petch','Plus Jakarta Sans',system-ui,sans-serif; --mc-mono:'IBM Plex Mono',ui-monospace,monospace;
    position:fixed; inset:0; z-index:9000; background:var(--mc-bg); color:var(--mc-ink);
    font-family:'Plus Jakarta Sans',system-ui,sans-serif; display:flex; flex-direction:column; overflow:hidden}
  #mc-overlay *{box-sizing:border-box}
  #mc-overlay button{font-family:inherit; cursor:pointer}

  /* ── Banda superior ── */
  .mc-top{flex:0 0 auto; height:52px; display:flex; align-items:center; gap:10px; padding:0 14px; background:var(--mc-panel); border-bottom:1px solid var(--mc-line)}
  .mc-back{display:inline-flex; align-items:center; gap:7px; height:34px; padding:0 13px; border-radius:10px; border:1px solid var(--mc-line2); background:rgba(255,255,255,.03); color:var(--mc-ink); font-weight:700; font-size:13px}
  .mc-back:hover{border-color:var(--mc-gold-soft); color:var(--mc-gold)} .mc-back svg{width:15px; height:15px}
  .mc-title{font-family:var(--mc-disp); font-weight:700; font-size:16px; letter-spacing:.02em}
  .mc-title b{color:var(--mc-gold)}
  .mc-demo{font-family:var(--mc-mono); font-size:10px; color:var(--mc-ink3); border:1px solid var(--mc-line2); border-radius:6px; padding:2px 7px}
  .mc-top-r{margin-left:auto; display:flex; align-items:center; gap:8px}
  .mc-sep{width:1px; height:26px; background:var(--mc-line2); margin:0 2px}
  .mc-tool{display:inline-flex; align-items:center; gap:7px; height:36px; padding:0 12px; border-radius:10px; border:1px solid var(--mc-line2); background:rgba(255,255,255,.03); color:var(--mc-ink2); font-weight:700; font-size:12.5px}
  .mc-tool svg{width:16px; height:16px}
  .mc-tool:hover{border-color:var(--mc-gold-soft); color:var(--mc-gold)}
  .mc-tool.on{border-color:#c79426; color:#2a1d00; background:linear-gradient(180deg,#f7db8d,var(--mc-gold) 55%,#c79426)}
  .mc-icobtn{width:36px; height:36px; display:inline-grid; place-items:center; border-radius:10px; border:1px solid var(--mc-line2); background:rgba(255,255,255,.03); color:var(--mc-ink2)}
  .mc-icobtn:hover{border-color:var(--mc-gold-soft); color:var(--mc-gold)} .mc-icobtn svg{width:16px; height:16px}
  .mc-add{display:inline-flex; align-items:center; gap:7px; height:36px; width:auto; padding:0 15px; border-radius:10px; border:1px solid #c79426; background:linear-gradient(180deg,#f7db8d,var(--mc-gold) 55%,#c79426); color:#2a1d00; font-family:var(--mc-disp); font-weight:800; font-size:13px}
  .mc-add svg{width:16px; height:16px} .mc-add:hover{filter:brightness(1.05)}

  /* ── Rejilla de paneles (2×2 por defecto, cada panel redimensionable) ── */
  .mc-grid{flex:1 1 auto; min-height:0; position:relative; display:flex; flex-wrap:wrap; align-content:flex-start; gap:8px; padding:8px; overflow:auto}
  .mc-pane{position:relative; isolation:isolate; width:calc(50% - 4px); height:calc(50% - 4px); min-width:280px; min-height:180px;
    display:flex; flex-direction:column; border:1px solid var(--mc-line2); border-radius:12px; overflow:hidden;
    background:var(--mc-panel2); resize:both}
  .mc-grid.mc-uno .mc-pane{width:100%; height:100%}
  .mc-pane.mc-max{position:fixed!important; inset:0!important; left:0!important; top:0!important; z-index:9100; width:auto!important; height:auto!important; border-radius:0; resize:none}
  .mc-pane.mc-focus{box-shadow:inset 0 0 0 1.5px var(--mc-gold-soft)}
  /* ventana flotante (añadida con +) */
  .mc-float{position:absolute; isolation:isolate; z-index:55; width:520px; height:360px; min-width:300px; min-height:220px;
    display:flex; flex-direction:column; border:1px solid var(--mc-gold-soft); border-radius:12px; overflow:hidden;
    background:var(--mc-panel2); resize:both; box-shadow:0 26px 70px rgba(0,0,0,.72), 0 0 0 1px rgba(232,184,75,.12)}
  .mc-float.mc-max{position:fixed!important; inset:0!important; left:0!important; top:0!important; width:auto!important; height:auto!important; z-index:9150; border-radius:0; resize:none; box-shadow:none}
  /* con un panel maximizado, los demás se ocultan (nada se cuela por detrás) */
  #mc-overlay.mc-hasmax .mc-pane:not(.mc-max), #mc-overlay.mc-hasmax .mc-float:not(.mc-max){display:none!important}

  /* ── Cabecera de cada panel ── */
  .mc-head{flex:0 0 auto; height:40px; display:flex; align-items:center; gap:6px; padding:0 8px; background:var(--mc-panel); border-bottom:1px solid var(--mc-line); cursor:default}
  .mc-float .mc-head{cursor:grab}
  .mc-coin{display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 9px; border-radius:8px; border:1px solid var(--mc-line2); background:rgba(255,255,255,.03); color:var(--mc-ink); font-weight:700; font-size:12.5px}
  .mc-coin:hover{border-color:var(--mc-gold-soft)} .mc-coin .ic{width:17px; height:17px; border-radius:50%; background:#232b36 center/cover no-repeat; flex:0 0 auto; display:grid; place-items:center; font-size:9px; color:#c9d1d9; overflow:hidden}
  .mc-coin .q{color:var(--mc-ink3); font-weight:600} .mc-coin .cv{color:var(--mc-ink3); font-size:9px; margin-left:1px}
  .mc-tf{height:28px; padding:0 9px; border-radius:8px; border:1px solid var(--mc-line2); background:rgba(255,255,255,.03); color:var(--mc-ink2); font-family:var(--mc-mono); font-size:11.5px; font-weight:600}
  .mc-tf:hover{border-color:var(--mc-gold-soft); color:var(--mc-gold)}
  .mc-px{font-family:var(--mc-mono); font-size:12.5px; font-weight:700; color:var(--mc-ink)}
  .mc-px small{font-size:10px; margin-left:5px} .mc-px small.up{color:var(--mc-up2)} .mc-px small.down{color:var(--mc-down2)}
  .mc-hsp{margin-left:auto}
  .mc-indbtn{height:28px; padding:0 11px; display:inline-flex; align-items:center; gap:6px; border-radius:8px; border:1px solid var(--mc-line2); background:rgba(255,255,255,.03); color:var(--mc-ink2); font-weight:700; font-size:12px}
  .mc-indbtn:hover{border-color:var(--mc-gold-soft); color:var(--mc-gold)} .mc-indbtn.on{border-color:var(--mc-gold); color:var(--mc-gold); background:rgba(232,184,75,.1)}
  .mc-indbtn svg{width:12px; height:12px; opacity:.8}
  .mc-hb{width:28px; height:28px; display:inline-grid; place-items:center; border-radius:8px; border:1px solid transparent; background:transparent; color:var(--mc-ink3)}
  .mc-hb:hover{border-color:var(--mc-line2); color:var(--mc-gold); background:rgba(255,255,255,.04)} .mc-hb svg{width:15px; height:15px}
  .mc-hb.on{color:var(--mc-gold)} .mc-hb.mc-close:hover{color:var(--mc-down2); border-color:var(--mc-down)}

  /* ── Cuerpo (gráfica + capas) ── */
  .mc-body{flex:1 1 auto; position:relative; min-height:0; background:var(--mc-bg); overflow:hidden}
  .mc-cv{position:absolute; inset:0; z-index:0}
  .mc-fx{position:absolute; inset:0; z-index:3; pointer-events:none}
  .mc-ux{position:absolute; inset:0; z-index:4; pointer-events:none}
  .mc-cap{position:absolute; inset:0; z-index:6; pointer-events:none; cursor:crosshair}
  .mc-cap.on{pointer-events:auto}
  /* marca de agua: misma ubicación que las demás secciones (libre de barra y de las fechas) */
  .mc-wm{position:absolute; left:60px; bottom:36px; z-index:1; opacity:.6; pointer-events:none}
  .mc-wm img{height:21px; width:auto; filter:drop-shadow(0 2px 7px rgba(0,0,0,.95))}
  .mc-pane.mc-max .mc-wm, .mc-float.mc-max .mc-wm{left:64px; bottom:46px}
  .mc-pane.mc-max .mc-wm img, .mc-float.mc-max .mc-wm img{height:38px}
  .mc-grip{position:absolute; right:3px; bottom:3px; z-index:7; width:13px; height:13px; pointer-events:none; opacity:.45}
  .mc-grip::before,.mc-grip::after{content:""; position:absolute; right:0; background:var(--mc-ink3)}
  .mc-grip::before{bottom:0; width:11px; height:2px} .mc-grip::after{bottom:0; right:0; width:2px; height:11px}
  .mc-pane.mc-max .mc-grip, .mc-float.mc-max .mc-grip{display:none}
  .mc-hint{position:absolute; left:50%; bottom:12px; transform:translateX(-50%); z-index:5; pointer-events:none;
    font-family:var(--mc-mono); font-size:10px; color:var(--mc-ink3); background:rgba(8,11,16,.72); border:1px solid var(--mc-line2);
    border-radius:20px; padding:4px 11px; opacity:0; transition:opacity .2s}
  .mc-pane:hover .mc-hint{opacity:.9} .mc-pane.mc-focus .mc-hint{display:none}

  /* barra de dibujo embebida (barra.js): contenida en el panel, sin tapar las fechas */
  #mc-overlay .nv-tools{max-height:calc(100% - 54px); z-index:9}
  #mc-overlay .nv-tools-tab{z-index:8}
  #mc-overlay .nv-topbar{z-index:10}
  #mc-overlay .nv-pop{z-index:12}

  /* ── Popups (monedas, TF, indicadores) ── */
  .mc-pop{position:fixed; z-index:9400; background:#121922; border:1px solid var(--mc-line2); border-radius:12px; box-shadow:0 22px 60px rgba(0,0,0,.7); padding:8px; min-width:230px}
  .mc-pop .mc-search{width:100%; height:36px; padding:0 11px; margin-bottom:7px; border-radius:9px; border:1px solid var(--mc-line2); background:#0b1017; color:var(--mc-ink); font-family:var(--mc-mono); font-size:13px; outline:none}
  .mc-pop .mc-search:focus{border-color:var(--mc-gold-soft)}
  .mc-list{max-height:300px; overflow-y:auto; scrollbar-width:thin}
  .mc-opt{display:flex; align-items:center; gap:9px; padding:8px 9px; border-radius:8px; cursor:pointer; color:var(--mc-ink)}
  .mc-opt:hover{background:rgba(255,255,255,.05)} .mc-opt.on{background:rgba(232,184,75,.12)}
  .mc-opt .ic{width:20px; height:20px; border-radius:50%; background:#232b36 center/cover no-repeat; flex:0 0 auto; display:grid; place-items:center; font-size:10px; color:#c9d1d9; overflow:hidden}
  .mc-opt b{font-size:13px; font-weight:700} .mc-opt span{color:var(--mc-ink3); font-size:11px; margin-left:auto; font-family:var(--mc-mono)}
  .mc-tfgrid{display:grid; grid-template-columns:repeat(4,1fr); gap:5px}
  .mc-tfgrid button{height:34px; border-radius:8px; border:1px solid var(--mc-line2); background:rgba(255,255,255,.03); color:var(--mc-ink2); font-family:var(--mc-mono); font-size:12px; font-weight:600}
  .mc-tfgrid button.on{border-color:var(--mc-gold); color:var(--mc-gold); background:rgba(232,184,75,.12)}
  .mc-indhead{font-family:var(--mc-mono); font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--mc-ink3); margin:9px 4px 5px}
  .mc-indhead:first-child{margin-top:2px}
  .mc-ir{display:flex; align-items:center; justify-content:space-between; gap:9px; padding:7px 9px; border-radius:8px; cursor:pointer}
  .mc-ir:hover{background:rgba(255,255,255,.04)}
  .mc-ir span{display:inline-flex; align-items:center; gap:8px; font-size:12.5px} .mc-ir .dot{width:11px; height:11px; border-radius:3px; flex:0 0 auto}
  .mc-ir .sw{width:34px; height:19px; border-radius:11px; background:#2a333f; position:relative; flex:0 0 auto; transition:background .15s}
  .mc-ir .sw::after{content:""; position:absolute; top:2px; left:2px; width:15px; height:15px; border-radius:50%; background:#fff; transition:left .15s}
  .mc-ir.on .sw{background:var(--mc-gold)} .mc-ir.on .sw::after{left:17px}

  /* ── Modal (guardar imagen) ── */
  .mc-modal{position:fixed; inset:0; z-index:9600; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(3,6,10,.74); backdrop-filter:blur(4px)}
  .mc-modal .bx{position:relative; width:min(960px,96vw); max-height:92vh; display:flex; flex-direction:column; background:#10151c; border:1px solid var(--mc-line2); border-radius:16px; overflow:hidden; box-shadow:0 30px 80px rgba(0,0,0,.7)}
  .mc-modal .bxh{display:flex; align-items:center; gap:10px; padding:13px 16px; border-bottom:1px solid var(--mc-line)}
  .mc-modal .bxh b{font-family:var(--mc-disp); font-weight:800; font-size:15px} .mc-modal .bxh .x{margin-left:auto}
  .mc-modal .bxc{flex:1 1 auto; min-height:0; overflow:auto; background:#0b0f15; padding:14px}
  .mc-modal .bxc canvas{width:100%; height:auto; display:block; border-radius:8px}
  .mc-modal .bxf{display:flex; gap:9px; padding:13px 16px; border-top:1px solid var(--mc-line)}
  .mc-modal .bxf button{flex:1; min-height:42px; border-radius:11px; border:1px solid var(--mc-line2); background:rgba(255,255,255,.05); color:var(--mc-ink); font-family:var(--mc-disp); font-weight:800; font-size:13px; transition:border-color .15s, filter .15s}
  .mc-modal .bxf button:hover{border-color:var(--mc-gold-soft)}
  .mc-modal .bxf .dl{border-color:#c79426; color:#2a1d00; background:linear-gradient(180deg,#f7db8d,var(--mc-gold) 55%,#c79426)}
  .mc-modal .bxf .dl:hover{filter:brightness(1.06)}

  .mc-toast{position:fixed; left:50%; bottom:26px; transform:translateX(-50%); z-index:9700; padding:11px 18px; border-radius:11px; background:#121922; border:1px solid var(--mc-line2); color:var(--mc-ink); font-size:13px; font-weight:600; box-shadow:0 14px 40px rgba(0,0,0,.6); opacity:0; transition:opacity .2s, transform .2s}
  .mc-toast.on{opacity:1; transform:translateX(-50%) translateY(-4px)}
  .mc-spin{position:absolute; inset:0; display:grid; place-items:center; background:var(--mc-bg); z-index:8}
  .mc-spin i{width:26px; height:26px; border-radius:50%; border:3px solid rgba(232,184,75,.2); border-top-color:var(--mc-gold); animation:mcsp .7s linear infinite}
  @keyframes mcsp{to{transform:rotate(360deg)}}

  @media (max-width:820px){
    .mc-pane{width:100%; height:calc(50% - 4px); min-width:0}
    .mc-title,.mc-demo{display:none}
    .mc-tool span{display:none} .mc-tool{padding:0 10px}
  }
`;
