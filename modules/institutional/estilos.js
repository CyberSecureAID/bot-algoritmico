/* modules/institutional/estilos.js
   Skin del terminal de Análisis Institucional con la paleta y la dinámica de
   DecFreedom. Los popups (TF/indicadores) y el disclaimer se montan sobre el
   body, así que las variables de color se declaran también ahí. */

let _puesto = false;

export function estilos() {
  if (_puesto || document.getElementById('it-estilos')) { _puesto = true; return; }
  _puesto = true;
  const s = document.createElement('style');
  s.id = 'it-estilos';
  s.textContent = CSS;
  document.head.appendChild(s);
}

const CSS = `
#it-overlay, .it-modal, .it-pop{
  --it-gold:#E8B84B; --it-gold-soft:#C9A84B; --it-gold-lo:#8f6a1a;
  --it-up:#2ee86a; --it-down:#ff5b6e; --it-line:#232b35; --it-line-2:#2a333f;
  --it-panel:#0e131a; --it-head:#161c25; --it-dim:#7d8794; --it-ink:#e7ebf0;
  --it-mono:"Chakra Petch", ui-monospace, "SF Mono", Menlo, monospace;
}
#it-overlay{
  position:fixed; inset:0; z-index:10030; display:flex; flex-direction:column;
  background:radial-gradient(1200px 600px at 80% -10%, rgba(232,184,75,.05), transparent 60%), #0b0e13;
  color:var(--it-ink); font-family:"Plus Jakarta Sans", system-ui, sans-serif;
}
#it-overlay *{box-sizing:border-box}
#it-overlay ::-webkit-scrollbar, .it-pop ::-webkit-scrollbar{width:8px;height:8px}
#it-overlay ::-webkit-scrollbar-track, .it-pop ::-webkit-scrollbar-track{background:transparent}
#it-overlay ::-webkit-scrollbar-thumb, .it-pop ::-webkit-scrollbar-thumb{background:#273039;border-radius:6px}
#it-overlay ::-webkit-scrollbar-thumb:hover{background:var(--it-gold-lo)}

/* ── Barra superior ── */
.it-top{display:flex; align-items:center; gap:12px; height:52px; flex:0 0 auto; padding:0 12px;
  background:linear-gradient(180deg,#10151c,#0b0e13); border-bottom:1px solid var(--it-line)}
.it-back{display:inline-flex; align-items:center; gap:6px; flex:0 0 auto; height:36px; padding:0 13px 0 10px; border-radius:9px;
  background:rgba(255,255,255,.04); border:1px solid var(--it-line-2); color:#c3cad3; cursor:pointer;
  font-family:"Plus Jakarta Sans",system-ui,sans-serif; font-size:13px; font-weight:700}
.it-back svg{width:13px; height:13px}
.it-back:hover{border-color:var(--it-gold-soft); color:var(--it-gold)}
.it-top .it-sep{width:1px; height:26px; background:var(--it-line); flex:0 0 auto}
.it-title{font-family:var(--it-mono); font-weight:800; font-size:12.5px; letter-spacing:.16em; color:var(--it-gold); white-space:nowrap; flex:0 0 auto}
.it-status{display:flex; align-items:center; gap:7px; font-family:var(--it-mono); font-size:11px; color:var(--it-dim); white-space:nowrap}
.it-dot{width:7px; height:7px; border-radius:50%; background:var(--it-up); box-shadow:0 0 8px rgba(46,232,106,.7)}
.it-clock{font-family:var(--it-mono); font-size:11px; color:#aeb6c0; letter-spacing:.04em; white-space:nowrap}
.it-search{position:relative; flex:1 1 auto; max-width:360px; min-width:120px}
.it-search input{width:100%; height:34px; border-radius:9px; border:1px solid var(--it-line-2); background:#0a0d12; color:var(--it-ink); padding:0 12px 0 32px; font-size:13px; font-family:var(--it-mono); outline:none}
.it-search input:focus{border-color:var(--it-gold-soft)}
.it-search svg{position:absolute; left:10px; top:9px; width:15px; height:15px; color:var(--it-dim)}
.it-search .it-kbd{position:absolute; right:8px; top:8px; font-family:var(--it-mono); font-size:10px; color:var(--it-dim); border:1px solid var(--it-line-2); border-radius:5px; padding:1px 5px}
.it-sug{position:absolute; top:40px; left:0; right:0; max-height:300px; overflow-y:auto; z-index:40; background:#0c1016; border:1px solid var(--it-line-2); border-radius:10px; padding:5px; box-shadow:0 18px 50px rgba(0,0,0,.6)}
.it-sug button{display:flex; align-items:center; gap:10px; width:100%; padding:8px 10px; border:0; background:transparent; color:var(--it-ink); cursor:pointer; border-radius:7px; text-align:left; font-size:13px}
.it-sug button:hover,.it-sug button.on{background:rgba(232,184,75,.12)}
.it-sug b{font-family:var(--it-mono); min-width:52px; color:var(--it-gold)}
.it-sug span{color:var(--it-dim); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.it-top-r{display:flex; align-items:center; gap:10px; margin-left:auto; flex:0 0 auto}
.it-fng{display:flex; align-items:center; gap:6px; font-family:var(--it-mono); font-size:11px; color:var(--it-dim)}
.it-fng b{font-weight:800}
.it-ico{width:34px; height:34px; border-radius:9px; display:grid; place-items:center; cursor:pointer; background:rgba(255,255,255,.04); border:1px solid var(--it-line-2); color:#9aa4af}
.it-ico svg{width:17px; height:17px}
.it-ico:hover{border-color:var(--it-gold-soft); color:var(--it-gold)}

/* ── Rejilla: stacked en móvil, flotante (movible/redimensionable) en escritorio ── */
.it-grid{flex:1 1 auto; min-height:0}
.it-grid:not(.it-float){display:flex; flex-direction:column; gap:10px; padding:10px; overflow-y:auto}
.it-grid:not(.it-float) .it-panel{min-height:300px}
.it-grid.it-float{position:relative; overflow:hidden; padding:0}
.it-grid.it-float .it-panel{position:absolute; margin:0}
.it-panel{background:linear-gradient(180deg,#0f141b,#0b0e13); border:1px solid var(--it-line); border-radius:12px; display:flex; flex-direction:column; min-height:0; min-width:0; overflow:hidden}
.it-panel.it-dragging{z-index:20; box-shadow:0 20px 60px rgba(0,0,0,.6); border-color:var(--it-gold-soft)}
.it-ph{display:flex; align-items:center; gap:8px; flex:0 0 auto; padding:7px 11px; background:linear-gradient(180deg,#161c25,#10151c); border-bottom:1px solid var(--it-line); cursor:default}
.it-grid.it-float .it-ph{cursor:move}
.it-ph h4{margin:0; font-family:var(--it-mono); font-weight:800; font-size:11px; letter-spacing:.12em; color:var(--it-gold); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.it-ph .it-ph-r{display:flex; align-items:center; gap:7px; flex:0 0 auto; margin-left:auto}
.it-grip{flex:0 0 auto; width:16px; height:10px; margin-left:8px; opacity:.5;
  background-image:radial-gradient(circle,#6b7580 1px, transparent 1px); background-size:4px 4px; display:none}
.it-grid.it-float .it-grip{display:block}
.it-pb{flex:1 1 auto; min-height:0; overflow:auto; position:relative}
.it-resize{display:none}
.it-grid.it-float .it-resize{display:block; position:absolute; right:0; bottom:0; width:16px; height:16px; cursor:nwse-resize; z-index:8;
  background:linear-gradient(135deg, transparent 50%, var(--it-gold-lo) 50%, var(--it-gold-lo) 62%, transparent 62%, transparent 74%, var(--it-gold-lo) 74%, var(--it-gold-lo) 86%, transparent 86%)}

/* ── Chart ── */
.it-chart-body{display:flex; flex-direction:column; height:100%}
.it-chart-bar{display:flex; align-items:center; gap:7px; flex-wrap:wrap; padding:6px 10px; border-bottom:1px solid var(--it-line); flex:0 0 auto}
.it-chip{font-family:var(--it-mono); font-size:11.5px; padding:4px 11px; border-radius:8px; cursor:pointer; background:rgba(255,255,255,.04); border:1px solid var(--it-line-2); color:#aeb6c0; letter-spacing:.03em; display:inline-flex; align-items:center; gap:6px}
.it-chip:hover{border-color:var(--it-gold-soft); color:var(--it-gold)}
.it-chip svg{opacity:.8}
.it-cv{flex:1 1 auto; min-height:0; position:relative}
.it-legend{position:absolute; top:8px; left:10px; z-index:6; font-family:var(--it-mono); font-size:11px; line-height:1.5; pointer-events:none; text-shadow:0 1px 3px rgba(0,0,0,.9)}
.it-legend .nm{color:var(--it-gold); font-weight:800; font-size:12.5px; letter-spacing:.05em}
.it-legend .ind{color:#9fb0c2}
.it-legend .o{color:var(--it-dim)}
.it-wm{position:absolute; left:10px; bottom:26px; z-index:5; display:flex; align-items:center; gap:7px; pointer-events:none; opacity:.42}
.it-wm img{height:16px; width:auto; display:block; opacity:.85}
.it-wm span{font-family:var(--it-mono); font-size:11px; font-weight:800; letter-spacing:.1em; color:var(--it-gold)}

/* ── Popups (TF / indicadores) ── */
.it-pop{position:fixed; z-index:10045; background:#0c1016; border:1px solid var(--it-line-2); border-radius:11px; padding:7px; box-shadow:0 20px 55px rgba(0,0,0,.65); color:var(--it-ink); font-family:var(--it-mono)}
.it-tfmenu{display:grid; grid-template-columns:repeat(3,1fr); gap:5px; width:210px}
.it-tf-it{height:34px; border-radius:8px; border:1px solid var(--it-line-2); background:rgba(255,255,255,.03); color:#aeb6c0; cursor:pointer; font-family:var(--it-mono); font-size:12px; font-weight:700}
.it-tf-it:hover{border-color:var(--it-gold-soft); color:var(--it-gold)}
.it-tf-it.on{background:rgba(232,184,75,.15); border-color:var(--it-gold); color:var(--it-gold)}
.it-inmenu{width:216px; max-height:62vh; overflow-y:auto}
.it-pop-tit{font-size:9px; letter-spacing:.14em; color:var(--it-gold); text-transform:uppercase; padding:8px 8px 4px; opacity:.85}
.it-in-it{display:flex; align-items:center; gap:9px; width:100%; height:34px; padding:0 9px; border-radius:8px; border:0; background:transparent; color:#b7bdc6; cursor:pointer; text-align:left; font-family:var(--it-mono); font-size:12.5px}
.it-in-it:hover{background:rgba(255,255,255,.05)}
.it-in-it.on{color:var(--it-gold)}
.it-in-ck{width:16px; height:16px; flex:0 0 auto; border-radius:5px; border:1px solid var(--it-line-2); display:grid; place-items:center; font-size:11px; color:var(--it-gold)}
.it-in-it.on .it-in-ck{background:rgba(232,184,75,.18); border-color:var(--it-gold)}

/* ── Quote ── */
.it-q-top{padding:12px 12px 8px; border-bottom:1px solid var(--it-line)}
.it-q-last{font-family:var(--it-mono); font-weight:800; font-size:30px; letter-spacing:.01em; line-height:1}
.it-q-chg{font-family:var(--it-mono); font-size:13px; margin-top:6px; font-weight:700}
.it-q-grid{display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--it-line)}
.it-q-cell{background:#0c1016; padding:8px 11px; display:flex; flex-direction:column; gap:2px}
.it-q-cell .k{font-family:var(--it-mono); font-size:9.5px; letter-spacing:.09em; color:var(--it-dim); text-transform:uppercase}
.it-q-cell .v{font-family:var(--it-mono); font-size:13px; color:var(--it-ink); font-weight:600}

/* ── Tablas ── */
.it-tbl{width:100%; border-collapse:collapse; font-family:var(--it-mono); font-size:12px}
.it-tbl th{position:sticky; top:0; background:#0e131a; color:var(--it-dim); font-weight:600; font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; text-align:right; padding:6px 10px; border-bottom:1px solid var(--it-line)}
.it-tbl th:first-child{text-align:left}
.it-tbl td{padding:6px 10px; text-align:right; border-bottom:1px solid #141a22; white-space:nowrap}
.it-tbl td:first-child{text-align:left; color:var(--it-ink); font-weight:700}
.it-tbl tr{cursor:pointer}
.it-tbl tbody tr:hover{background:rgba(232,184,75,.07)}
.it-tbl tr.on td{background:rgba(232,184,75,.1)}
.it-tbl .sym{display:flex; align-items:center; gap:8px}
.up{color:var(--it-up)} .down{color:var(--it-down)} .dim{color:var(--it-dim)} .gold{color:var(--it-gold)}

/* ── Heatmap ── */
.it-heat{display:grid; grid-template-columns:repeat(auto-fill,minmax(94px,1fr)); gap:4px; padding:8px}
.it-tile{border-radius:7px; padding:8px 9px; display:flex; flex-direction:column; justify-content:space-between; min-height:58px; cursor:pointer; border:1px solid rgba(255,255,255,.06); overflow:hidden}
.it-tile b{font-family:var(--it-mono); font-weight:800; font-size:12px; color:#fff; letter-spacing:.03em}
.it-tile em{font-family:var(--it-mono); font-style:normal; font-size:11px; font-weight:700}
.it-tile .pr{font-family:var(--it-mono); font-size:9.5px; color:rgba(255,255,255,.7)}
.it-tile:hover{outline:1px solid var(--it-gold)}

/* ── Macro ── */
.it-macro{display:flex; flex-direction:column; gap:1px; background:var(--it-line); min-height:100%}
.it-macro-row{background:#0c1016; display:flex; align-items:center; justify-content:space-between; padding:11px 13px}
.it-macro-row .k{font-family:var(--it-mono); font-size:10.5px; letter-spacing:.06em; color:var(--it-dim); text-transform:uppercase}
.it-macro-row .v{font-family:var(--it-mono); font-size:15px; font-weight:800; color:var(--it-ink)}
.it-gauge{height:8px; border-radius:6px; background:linear-gradient(90deg,#ff5b6e,#E8B84B 50%,#2ee86a); position:relative; margin:4px 0 2px}
.it-gauge .pin{position:absolute; top:-3px; width:3px; height:14px; background:#fff; border-radius:2px; box-shadow:0 0 6px rgba(0,0,0,.8); transform:translateX(-50%)}

/* ── Vacío / cargando ── */
.it-empty{height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; text-align:center; padding:20px; color:var(--it-dim)}
.it-empty svg{width:28px; height:28px; color:var(--it-line-2)}
.it-empty b{color:#aeb6c0; font-size:13px; font-family:var(--it-mono); font-weight:700}
.it-empty span{font-size:11.5px; max-width:260px; line-height:1.5}
.it-spin{width:22px; height:22px; border:2px solid var(--it-line-2); border-top-color:var(--it-gold); border-radius:50%; animation:it-sp .7s linear infinite}
@keyframes it-sp{to{transform:rotate(360deg)}}

/* ── Pie ── */
.it-foot{display:flex; align-items:center; justify-content:space-between; gap:12px; flex:0 0 auto; height:30px; padding:0 14px; border-top:1px solid var(--it-line); background:#0a0d12; font-family:var(--it-mono); font-size:10px; color:var(--it-dim); letter-spacing:.04em}
.it-foot a{color:var(--it-gold-soft); text-decoration:none}
.it-foot .it-disc-link{background:none; border:0; color:var(--it-dim); cursor:pointer; font:inherit; text-decoration:underline; text-underline-offset:3px}
.it-foot .it-disc-link:hover{color:var(--it-gold)}

/* ── Disclaimer (sello flotado a la derecha, como el de Análisis) ── */
.it-modal{position:fixed; inset:0; z-index:10050; display:flex; align-items:center; justify-content:center; padding:18px; opacity:0; transition:opacity .18s; color:var(--it-ink); font-family:"Plus Jakarta Sans",system-ui,sans-serif}
.it-modal.on{opacity:1}
.it-modal-bg{position:absolute; inset:0; background:rgba(4,7,11,.78); backdrop-filter:blur(3px)}
.it-modal-card{position:relative; width:min(600px,96vw); max-height:92vh; overflow-y:auto; background:linear-gradient(180deg,#121823,#0b0e13); border:1px solid var(--it-line-2); border-radius:16px; box-shadow:0 30px 80px rgba(0,0,0,.6)}
.it-disc-box{display:flow-root; padding:26px 28px 22px; text-align:left}
.it-disc-seal{float:right; width:124px; height:124px; margin:2px 0 10px 20px; shape-outside:margin-box; filter:drop-shadow(0 8px 18px rgba(0,0,0,.5))}
.it-disc-box h3{margin:6px 0 10px; font-family:var(--it-mono); font-size:20px; color:var(--it-ink); letter-spacing:.02em}
.it-disc-box p{margin:0 0 13px; font-size:13px; line-height:1.64; color:#c4ccd4}
.it-disc-box p b{color:#e9eef3}
.it-disc-chk{display:flex; align-items:flex-start; gap:10px; margin:4px 0 16px; cursor:pointer; font-size:12.5px; line-height:1.5; color:#d4dae1}
.it-disc-chk input{flex:none; width:18px; height:18px; margin:1px 0 0; accent-color:var(--it-gold); cursor:pointer}
.it-pay{width:100%; height:46px; border-radius:11px; border:1px solid var(--it-gold); cursor:pointer; font-family:var(--it-mono); font-weight:800; font-size:14px; letter-spacing:.04em; background:linear-gradient(180deg,#f4d089,#cf9f2e); color:#241900}
.it-pay[disabled]{opacity:.45; cursor:not-allowed}
.it-modal-x{position:absolute; top:14px; right:14px; width:30px; height:30px; border-radius:8px; border:1px solid var(--it-line-2); background:rgba(255,255,255,.04); color:#9aa4af; cursor:pointer; z-index:2}

@media (max-width:620px){
  .it-disc-seal{float:none; display:block; width:96px; height:96px; margin:0 auto 12px}
  .it-disc-box{text-align:center} .it-disc-box p{text-align:left}
}
`;
