/* modules/institutional/estilos.js
   Skin del terminal de Análisis Institucional con la paleta y la dinámica de
   DecFreedom. Los popups (moneda / TF / indicadores) y el disclaimer se montan
   sobre el body, así que las variables de color se declaran también ahí.

   Nota de apilamiento: en modo flotante cada .it-panel lleva un z-index NUMÉRICO
   propio. Eso crea un contexto de apilamiento en cada ventana, de modo que los
   lienzos internos de la gráfica (que la librería posiciona con z-index 1/2)
   quedan confinados dentro de SU ventana y no se pintan por encima de las demás.
   Sin un z-index numérico el panel es `auto` y no crea contexto: por eso antes
   el chart "atravesaba" los otros paneles. */

let _puesto = false;

export function estilos() {
  const old = document.getElementById('it-estilos');
  if (old) old.remove();              // re-inyecta si cambió la versión
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
.it-top{display:flex; align-items:center; gap:10px; height:54px; flex:0 0 auto; padding:0 12px;
  background:linear-gradient(180deg,#10151c,#0b0e13); border-bottom:1px solid var(--it-line)}
.it-back{display:inline-flex; align-items:center; gap:6px; flex:0 0 auto; height:36px; padding:0 13px 0 10px; border-radius:9px;
  background:rgba(255,255,255,.04); border:1px solid var(--it-line-2); color:#c3cad3; cursor:pointer;
  font-family:"Plus Jakarta Sans",system-ui,sans-serif; font-size:13px; font-weight:700}
.it-back svg{width:14px; height:14px}
.it-back:hover{border-color:var(--it-gold-soft); color:var(--it-gold)}
.it-top .it-sep{width:1px; height:28px; background:var(--it-line); flex:0 0 auto}

/* selector de moneda (logo + id + nombre), MISMO catálogo, SIN operar */
.it-coin{display:inline-flex; align-items:center; gap:9px; flex:0 0 auto; height:38px; padding:0 11px; border-radius:10px;
  background:rgba(255,255,255,.04); border:1px solid var(--it-line-2); color:var(--it-ink); cursor:pointer}
.it-coin:hover{border-color:var(--it-gold-soft)}
.it-coin b{font-family:var(--it-mono); font-weight:800; font-size:14px; letter-spacing:.02em}
.it-coin span{color:var(--it-dim); font-size:12.5px; font-weight:600; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.it-coin svg{color:var(--it-dim); margin-left:1px}
.it-coin-lg{width:24px; height:24px; flex:0 0 auto; border-radius:50%; background:#1b222c center/cover no-repeat; display:grid; place-items:center;
  font-family:var(--it-mono); font-weight:800; font-size:11px; color:var(--it-gold); border:1px solid var(--it-line-2)}
.it-coin-lg.con{color:transparent; border-color:transparent}

/* chips desplegables (TF / Indicadores) */
.it-chip{font-family:var(--it-mono); font-size:12px; height:34px; padding:0 12px; border-radius:9px; cursor:pointer; background:rgba(255,255,255,.04); border:1px solid var(--it-line-2); color:#c3cad3; letter-spacing:.03em; display:inline-flex; align-items:center; gap:4px; flex:0 0 auto; font-weight:700}
.it-chip:hover{border-color:var(--it-gold-soft); color:var(--it-gold)}
.it-chip svg{opacity:.7}

/* precio + máx/mín del día */
.it-pxbox{display:flex; flex-direction:column; justify-content:center; gap:1px; flex:0 0 auto; padding:0 2px; min-width:84px}
.it-px{font-family:var(--it-mono); font-weight:800; font-size:18px; line-height:1}
.it-px.up{color:var(--it-up)} .it-px.down{color:var(--it-down)} .it-px.dim{color:var(--it-ink)}
.it-pxhl{display:flex; gap:10px; font-family:var(--it-mono); font-size:10px; color:var(--it-dim)}
.it-pxhl b{font-weight:800} .it-pxhl .up{color:var(--it-up)} .it-pxhl .down{color:var(--it-down)}

.it-search{position:relative; flex:1 1 auto; max-width:300px; min-width:120px}
.it-search input{width:100%; height:34px; border-radius:9px; border:1px solid var(--it-line-2); background:#0a0d12; color:var(--it-ink); padding:0 12px 0 32px; font-size:13px; font-family:var(--it-mono); outline:none}
.it-search input:focus{border-color:var(--it-gold-soft)}
.it-search svg{position:absolute; left:10px; top:9px; width:15px; height:15px; color:var(--it-dim)}
.it-sug{position:absolute; top:40px; left:0; right:0; max-height:300px; overflow-y:auto; z-index:40; background:#0c1016; border:1px solid var(--it-line-2); border-radius:10px; padding:5px; box-shadow:0 18px 50px rgba(0,0,0,.6)}
.it-sug button{display:flex; align-items:center; gap:10px; width:100%; padding:7px 9px; border:0; background:transparent; color:var(--it-ink); cursor:pointer; border-radius:7px; text-align:left; font-size:13px}
.it-sug button:hover,.it-sug button.on{background:rgba(232,184,75,.12)}
.it-sug b{font-family:var(--it-mono); min-width:50px; color:var(--it-gold)}
.it-sug span{color:var(--it-dim); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.it-top-r{display:flex; align-items:center; gap:9px; margin-left:auto; flex:0 0 auto}
.it-ico{width:34px; height:34px; border-radius:9px; display:grid; place-items:center; cursor:pointer; background:rgba(255,255,255,.04); border:1px solid var(--it-line-2); color:#9aa4af}
.it-ico svg{width:17px; height:17px}
.it-ico:hover{border-color:var(--it-gold-soft); color:var(--it-gold)}

.it-mini-lg{width:19px; height:19px; flex:0 0 auto; border-radius:50%; background:#1b222c center/cover no-repeat; display:grid; place-items:center; font-family:var(--it-mono); font-weight:800; font-size:9px; color:var(--it-gold); border:1px solid var(--it-line-2)}
.it-mini-lg.con{color:transparent; border-color:transparent}

/* ── Rejilla: apilada en móvil, flotante (movible/redimensionable) en escritorio ── */
.it-grid{flex:1 1 auto; min-height:0}
.it-grid:not(.it-float){display:flex; flex-direction:column; gap:10px; padding:10px; overflow-y:auto}
.it-grid:not(.it-float) .it-panel{min-height:300px}
.it-grid.it-float{position:relative; overflow:hidden; padding:0}
.it-grid.it-float .it-panel{position:absolute; margin:0; z-index:1}   /* ← contexto de apilamiento por ventana (fix superposición) */
.it-panel{background:linear-gradient(180deg,#0f141b,#0b0e13); border:1px solid var(--it-line); border-radius:12px; display:flex; flex-direction:column; min-height:0; min-width:0; overflow:hidden}
.it-panel.it-dragging{box-shadow:0 20px 60px rgba(0,0,0,.6); border-color:var(--it-gold-soft)}
.it-ph{display:flex; align-items:center; gap:8px; flex:0 0 auto; padding:7px 10px 7px 11px; background:linear-gradient(180deg,#161c25,#10151c); border-bottom:1px solid var(--it-line); cursor:default; user-select:none}
.it-grid.it-float .it-ph{cursor:move}
.it-ph h4{margin:0; font-family:var(--it-mono); font-weight:800; font-size:11px; letter-spacing:.12em; color:var(--it-gold); text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.it-ph-ctrl{display:flex; align-items:center; gap:5px; flex:0 0 auto; margin-left:auto}
.it-pbtn{width:25px; height:25px; flex:0 0 auto; border-radius:7px; display:grid; place-items:center; cursor:pointer; background:rgba(255,255,255,.04); border:1px solid var(--it-line-2); color:#9aa4af}
.it-pbtn svg{width:13px; height:13px}
.it-pbtn:hover{border-color:var(--it-gold-soft); color:var(--it-gold)}
.it-pbtn.it-x:hover{border-color:var(--it-down); color:var(--it-down); background:rgba(255,91,110,.08)}
.it-pb{flex:1 1 auto; min-height:0; overflow:auto; position:relative; background:transparent}
.it-resize{display:none}
.it-grid.it-float .it-resize{display:block; position:absolute; right:0; bottom:0; width:18px; height:18px; cursor:nwse-resize; z-index:8;
  background:linear-gradient(135deg, transparent 50%, var(--it-gold-lo) 50%, var(--it-gold-lo) 62%, transparent 62%, transparent 74%, var(--it-gold-lo) 74%, var(--it-gold-lo) 86%, transparent 86%)}

/* ── Chart ── */
.it-cv{position:absolute; inset:0; min-height:0}
/* Leyenda ESTÁTICA (solo indicadores activos). No se reconstruye al mover el
   cursor → la ✕ ya no "baila" y se puede pulsar. */
.it-legend{position:absolute; top:8px; left:12px; z-index:7; display:flex; flex-direction:column; gap:3px; align-items:flex-start; font-family:var(--it-mono); font-size:11px; pointer-events:none}
.it-legend .ind{display:flex; align-items:center; gap:6px; height:18px; padding:0 4px 0 6px; border-radius:7px; background:rgba(8,11,16,.6); -webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); pointer-events:auto}
.it-legend .dot{width:8px; height:8px; border-radius:50%; flex:0 0 auto}
.it-legend .lbl{color:#c6cdd6; font-weight:700; letter-spacing:.02em; white-space:nowrap}
.it-leg-x{pointer-events:auto; cursor:pointer; width:16px; height:16px; flex:0 0 auto; line-height:1; border-radius:5px; border:0; background:rgba(255,255,255,.06); color:#9aa4af; font-size:13px; display:grid; place-items:center; padding:0}
.it-leg-x:hover{background:rgba(255,91,110,.22); color:var(--it-down)}
/* marca de agua: SOLO logo (el logo ya es nuestra identidad), más grande y más arriba */
/* Marca de agua: mismo sitio/tamaño que en las demás secciones (nv-marca:
   left:64px, bottom:40px, height:42px) → a la derecha de la barra, sobre las fechas. */
.it-wm{position:absolute; left:64px; bottom:40px; z-index:4; display:flex; align-items:center; pointer-events:none; opacity:.82}
.it-wm img{height:42px; width:auto; display:block; filter:drop-shadow(0 2px 9px rgba(0,0,0,.95))}

/* ── Popups ── */
.it-pop{position:fixed; z-index:10045; background:#0c1016; border:1px solid var(--it-line-2); border-radius:11px; padding:7px; box-shadow:0 20px 55px rgba(0,0,0,.65); color:var(--it-ink); font-family:var(--it-mono)}
.it-tfmenu{display:grid; grid-template-columns:repeat(3,1fr); gap:5px; width:220px}
.it-tf-it{height:34px; border-radius:8px; border:1px solid var(--it-line-2); background:rgba(255,255,255,.03); color:#aeb6c0; cursor:pointer; font-family:var(--it-mono); font-size:12px; font-weight:700}
.it-tf-it:hover{border-color:var(--it-gold-soft); color:var(--it-gold)}
.it-tf-it.on{background:rgba(232,184,75,.15); border-color:var(--it-gold); color:var(--it-gold)}
.it-inmenu{width:218px; max-height:64vh; overflow-y:auto}
.it-pop-tit{font-size:9px; letter-spacing:.14em; color:var(--it-gold); text-transform:uppercase; padding:8px 8px 4px; opacity:.85}
.it-in-it{display:flex; align-items:center; gap:9px; width:100%; height:34px; padding:0 9px; border-radius:8px; border:0; background:transparent; color:#b7bdc6; cursor:pointer; text-align:left; font-family:var(--it-mono); font-size:12.5px}
.it-in-it:hover{background:rgba(255,255,255,.05)}
.it-in-it.on{color:var(--it-gold)}
.it-in-ck{width:16px; height:16px; flex:0 0 auto; border-radius:5px; border:1px solid var(--it-line-2); display:grid; place-items:center; font-size:11px; color:var(--it-gold)}
.it-in-it.on .it-in-ck{background:rgba(232,184,75,.18); border-color:var(--it-gold)}

/* selector de monedas (catálogo completo con logos) */
.it-coinmenu{width:300px; padding:0; overflow:hidden; display:flex; flex-direction:column; max-height:70vh}
.it-cm-top{padding:8px; border-bottom:1px solid var(--it-line)}
.it-cm-top input{width:100%; height:32px; border-radius:8px; border:1px solid var(--it-line-2); background:#0a0d12; color:var(--it-ink); padding:0 11px; font-size:12.5px; font-family:var(--it-mono); outline:none}
.it-cm-top input:focus{border-color:var(--it-gold-soft)}
.it-cm-list{overflow-y:auto; padding:6px; min-height:0}
.it-cm-cat{font-size:9px; letter-spacing:.14em; color:var(--it-gold); text-transform:uppercase; padding:8px 8px 4px; opacity:.85}
.it-cm-it{display:flex; align-items:center; gap:9px; width:100%; height:36px; padding:0 9px; border-radius:8px; border:0; background:transparent; color:var(--it-ink); cursor:pointer; text-align:left; font-size:13px}
.it-cm-it:hover{background:rgba(232,184,75,.1)}
.it-cm-it.on{background:rgba(232,184,75,.16)}
.it-cm-it b{font-family:var(--it-mono); min-width:52px; color:var(--it-gold); font-weight:800}
.it-cm-it span{color:var(--it-dim); font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}

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

/* ── Heatmap (treemap: área ∝ magnitud del movimiento 24h) — estética premium ── */
#it-p-board-body{overflow:hidden; background:radial-gradient(130% 120% at 50% 0%, #0d1219, #090c11)}
.it-tile{position:absolute; border-radius:7px; display:flex; flex-direction:column; justify-content:center; gap:1px; cursor:pointer; overflow:hidden; opacity:1; transform:scale(1);
  border:1px solid rgba(255,255,255,.06); box-shadow:inset 0 1px 1px rgba(255,255,255,.1), inset 0 -11px 26px rgba(0,0,0,.24), 0 1px 2px rgba(0,0,0,.35);
  will-change:filter, transform;
  transition:left .6s cubic-bezier(.4,0,.2,1), top .6s cubic-bezier(.4,0,.2,1), width .6s cubic-bezier(.4,0,.2,1), height .6s cubic-bezier(.4,0,.2,1), background .5s ease, opacity .45s ease, transform .45s ease}
.it-tile.it-tile-in{opacity:0; transform:scale(.5); transition:none}
.it-tile b{font-family:var(--it-mono); font-weight:800; color:#fff; letter-spacing:.01em; text-shadow:0 1px 3px rgba(0,0,0,.6); line-height:1.02}
.it-tile em{font-family:var(--it-mono); font-style:normal; font-weight:800; line-height:1.1; text-shadow:0 1px 2px rgba(0,0,0,.5)}
.it-tile .pr{font-family:var(--it-mono); color:rgba(255,255,255,.78); line-height:1.1; text-shadow:0 1px 2px rgba(0,0,0,.5)}
.it-tile:hover{outline:2px solid var(--it-gold); outline-offset:-2px; z-index:3; filter:brightness(1.12) !important}
.it-tile.on{outline:2px solid rgba(255,255,255,.9); outline-offset:-2px; z-index:2}
.it-hm-wm{position:absolute; left:10px; bottom:9px; z-index:3; pointer-events:none; opacity:.8}
.it-hm-wm img{height:26px; width:auto; display:block; filter:drop-shadow(0 2px 7px rgba(0,0,0,.9))}

/* ── SIGNALS — rating técnico (lo premium) ── */
.it-sig-wrap{padding:13px 14px 12px; border-bottom:1px solid var(--it-line)}
.it-sig-top{display:flex; align-items:center; justify-content:space-between}
.it-sig-lead{font-family:var(--it-mono); font-size:9.5px; letter-spacing:.14em; color:var(--it-gold); text-transform:uppercase}
.it-sig-tfnow{font-family:var(--it-mono); font-size:10px; font-weight:800; color:#aeb6c0; background:rgba(255,255,255,.05); border:1px solid var(--it-line-2); padding:1px 7px; border-radius:6px}
.it-sig-verdict{font-family:var(--it-mono); font-weight:800; font-size:25px; letter-spacing:.02em; margin:7px 0 9px; line-height:1}
.it-sig-bar{display:flex; gap:3px; margin-bottom:11px}
.it-sig-seg{flex:1 1 0; height:7px; border-radius:3px; background:rgba(255,255,255,.08); transition:background .3s, box-shadow .3s}
.it-sig-seg.on{background:var(--c); box-shadow:0 0 10px var(--c)}
.it-sig-grid{display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px}
.it-sig-box{background:rgba(255,255,255,.03); border:1px solid var(--it-line); border-radius:9px; padding:8px 10px}
.it-sig-box .t{display:block; font-family:var(--it-mono); font-size:9px; letter-spacing:.08em; color:var(--it-dim); text-transform:uppercase; margin-bottom:5px}
.it-sig-cnt{display:flex; gap:9px; font-family:var(--it-mono); font-weight:800; font-size:15px}
.it-sig-cnt .up::before{content:'▲ '; font-size:9px} .it-sig-cnt .down::before{content:'▼ '; font-size:9px} .it-sig-cnt .dim::before{content:'● '; font-size:8px}
.it-sig-conf-tit{font-family:var(--it-mono); font-size:9px; letter-spacing:.1em; color:var(--it-dim); text-transform:uppercase; margin-bottom:6px}
.it-sig-conf{display:grid; grid-template-columns:repeat(3,1fr); gap:6px}
.it-sig-tf{display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 4px; background:rgba(255,255,255,.03); border:1px solid var(--it-line); border-radius:9px}
.it-sig-tf b{font-family:var(--it-mono); font-size:10px; color:#aeb6c0; letter-spacing:.05em}
.it-sig-tf span{font-family:var(--it-mono); font-weight:800; font-size:11px; text-align:center}

/* ── Macro (sin fondos gris de relleno → nada de 'área gris' al agrandar) ── */
.it-macro{display:flex; flex-direction:column}
.it-macro-tit{font-family:var(--it-mono); font-size:9px; letter-spacing:.1em; color:var(--it-dim); text-transform:uppercase; padding:10px 13px 4px}
.it-macro-row{display:flex; align-items:center; justify-content:space-between; padding:9px 13px; border-bottom:1px solid var(--it-line)}
.it-macro-row .k{font-family:var(--it-mono); font-size:10.5px; letter-spacing:.06em; color:var(--it-dim); text-transform:uppercase}
.it-macro-row .v{font-family:var(--it-mono); font-size:14px; font-weight:800; color:var(--it-ink)}
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

/* ── Menú de indicadores (cabecera + badge de señales) ── */
.it-in-head{display:flex; align-items:center; justify-content:space-between; padding:6px 9px 7px; border-bottom:1px solid var(--it-line); margin-bottom:3px}
.it-in-head span{font-family:var(--it-mono); font-size:10px; letter-spacing:.06em; color:var(--it-dim)}
.it-in-clear{background:rgba(255,91,110,.08); border:1px solid rgba(255,91,110,.3); color:#ff9aa6; cursor:pointer; font-family:var(--it-mono); font-size:10px; font-weight:700; padding:3px 9px; border-radius:7px}
.it-in-clear:hover{background:rgba(255,91,110,.18)}
.it-in-nm{flex:1 1 auto}
.it-in-sig{flex:0 0 auto; font-family:var(--it-mono); font-size:8.5px; font-weight:800; letter-spacing:.04em; padding:1px 5px; border-radius:5px; background:rgba(46,232,106,.14); color:#54e08a; border:1px solid rgba(46,232,106,.3)}

/* ══ Barra de dibujo REUTILIZADA de Smart/Heat/Liquidity Pools ══
   Mismos .nv-* que niveles/estilos.js, pero re-scopeados a #it-overlay
   (allí están bajo #nv-overlay). Solo lo de la barra/popups; nada del layout. */
#it-overlay .nv-tools{position:absolute;left:8px;top:50%;transform:translateY(-50%);z-index:9500;
  display:flex;flex-direction:column;gap:3px;padding:5px;border-radius:13px;
  background:rgba(13,17,24,.86);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
  border:1px solid rgba(255,255,255,.08);box-shadow:0 10px 34px rgba(0,0,0,.55);
  max-height:calc(100% - 76px);overflow-y:auto;scrollbar-width:none}   /* 76px: no toca las fechas de abajo */
#it-overlay .nv-tools::-webkit-scrollbar{display:none}
#it-overlay .nv-tool{width:31px;height:31px;flex:0 0 auto;border-radius:9px;border:none;padding:0;position:relative;
  background:transparent;color:#98a2ad;cursor:pointer;display:grid;place-items:center;transition:background .14s,color .14s}
#it-overlay .nv-tool svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#it-overlay .nv-tool:hover{background:rgba(255,255,255,.07);color:#eaecef}
#it-overlay .nv-tool.on{background:rgba(232,184,75,.18);color:var(--it-gold);box-shadow:inset 0 0 0 1px rgba(232,184,75,.45)}
#it-overlay .nv-tool-tg.on{background:rgba(232,184,75,.16);color:var(--it-gold);box-shadow:inset 0 0 0 1px rgba(232,184,75,.4)}
#it-overlay .nv-tool-sep{height:1px;background:rgba(255,255,255,.1);margin:3px 5px;flex:0 0 auto}
#it-overlay .nv-tool-fly{position:relative}
#it-overlay .nv-fly-mark{position:absolute;right:2px;bottom:2px;width:0;height:0;border-left:5px solid transparent;border-bottom:5px solid currentColor;opacity:.7}
#it-overlay .nv-txt-in{position:absolute;z-index:9502;width:190px;height:32px;padding:0 11px;border-radius:9px;
  background:rgba(13,17,24,.97);border:1px solid var(--it-gold);color:#eaecef;outline:none;
  font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:13px;box-shadow:0 10px 28px rgba(0,0,0,.55)}
#it-overlay .nv-txt-in::placeholder{color:#5c6672}
#it-overlay .nv-tools.nv-oculta{transform:translate(calc(-100% - 12px),-50%);opacity:0;pointer-events:none;transition:transform .22s ease,opacity .22s ease}
#it-overlay .nv-tools.nv-oculta.abierta,#it-overlay .nv-tools.nv-oculta.forz{transform:translate(0,-50%);opacity:1;pointer-events:auto}
#it-overlay .nv-tools-tab{position:absolute;left:0;top:50%;transform:translateY(-50%);z-index:9496;pointer-events:none;
  width:9px;height:66px;border-radius:0 8px 8px 0;background:linear-gradient(180deg,rgba(34,211,238,.65),rgba(232,184,75,.6));
  box-shadow:2px 0 12px rgba(0,0,0,.5),inset -1px 0 0 rgba(255,255,255,.25);transition:opacity .2s}
#it-overlay .nv-tools.abierta ~ .nv-tools-tab,#it-overlay .nv-tools.forz ~ .nv-tools-tab{opacity:0;pointer-events:none}
#it-overlay .nv-topbar{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:9500;
  display:flex;align-items:center;gap:3px;padding:6px 8px;border-radius:14px;
  background:linear-gradient(180deg,rgba(24,30,40,.94),rgba(14,18,26,.94));-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  border:1px solid rgba(255,255,255,.12);box-shadow:0 14px 40px rgba(0,0,0,.6);max-width:calc(100% - 96px);overflow-x:auto;scrollbar-width:none}
#it-overlay .nv-topbar::-webkit-scrollbar{display:none}
#it-overlay .nv-tb-grip{flex:0 0 auto;width:16px;height:26px;margin-right:2px;cursor:grab;display:inline-flex;align-items:center;justify-content:center;color:#5c6672}
#it-overlay .nv-tb-grip:hover{color:#9aa4b0}
#it-overlay .nv-tb-grip:active{cursor:grabbing}
#it-overlay .nv-tb-b{height:30px;min-width:30px;padding:0 9px;border-radius:9px;border:none;background:transparent;color:#c9d1d9;cursor:pointer;
  display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;font-family:var(--it-mono);font-size:11px;font-weight:700;line-height:1;transition:background .13s,color .13s}
#it-overlay .nv-tb-b:hover{background:rgba(255,255,255,.09)}
#it-overlay .nv-tb-b.on{background:rgba(232,184,75,.2);color:var(--it-gold);box-shadow:inset 0 0 0 1px rgba(232,184,75,.4)}
#it-overlay .nv-tb-pin{color:#7d8794}
#it-overlay .nv-tb-pin.on{background:rgba(46,232,106,.18);color:#3ee88a;box-shadow:inset 0 0 0 1px rgba(46,232,106,.4)}
#it-overlay .nv-tb-del:hover{background:rgba(255,59,82,.2);color:#ff6b7a}
#it-overlay .nv-tb-color{padding:0 6px}
#it-overlay .nv-tb-swatch{width:20px;height:20px;border-radius:6px;display:block;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35),0 1px 3px rgba(0,0,0,.5)}
#it-overlay .nv-tb-niv{font-size:10.5px;letter-spacing:.3px}
#it-overlay .nv-tb-gr{width:32px}
#it-overlay .nv-tb-gr i{display:block;width:16px;background:currentColor;border-radius:2px}
#it-overlay .nv-tb-sep{width:1px;height:20px;background:rgba(255,255,255,.14);margin:0 3px;flex:0 0 auto}
#it-overlay .nv-pop{position:absolute;z-index:9501;padding:8px;border-radius:12px;
  background:linear-gradient(180deg,rgba(24,30,40,.97),rgba(14,18,26,.97));-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  border:1px solid rgba(255,255,255,.13);box-shadow:0 16px 44px rgba(0,0,0,.62)}
#it-overlay .nv-pop-col{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;width:184px}
#it-overlay .nv-pc{width:22px;height:22px;border-radius:6px;border:2px solid transparent;cursor:pointer;padding:0;box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}
#it-overlay .nv-pc:hover{border-color:rgba(255,255,255,.85)}
#it-overlay .nv-pop-fib{width:210px}
#it-overlay .nv-pop-t{font-family:var(--it-mono);font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#8b95a1;margin:0 2px 7px}
#it-overlay .nv-pf-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
#it-overlay .nv-pf{height:26px;border-radius:7px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#98a2ad;cursor:pointer;font-family:var(--it-mono);font-size:10px;font-weight:700;padding:0}
#it-overlay .nv-pf:hover{border-color:rgba(255,255,255,.3);color:#eaecef}
#it-overlay .nv-pf.on{background:rgba(232,184,75,.18);border-color:rgba(232,184,75,.5);color:var(--it-gold)}
#it-overlay .nv-pop-fly{display:flex;flex-direction:column;gap:2px;width:158px}
#it-overlay .nv-pop-menu{display:flex;flex-direction:column;gap:2px;width:180px}
#it-overlay .nv-pm{display:flex;align-items:center;gap:10px;height:36px;padding:0 12px;border-radius:8px;border:none;background:transparent;color:#d7dde4;cursor:pointer;font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:12.5px;font-weight:600;text-align:left}
#it-overlay .nv-pm:hover{background:rgba(255,255,255,.08)}
#it-overlay .nv-pm svg{flex:0 0 auto;color:#9aa4b0}
#it-overlay .nv-fl{display:flex;align-items:center;gap:9px;height:34px;padding:0 10px;border-radius:8px;border:none;background:transparent;color:#c9d1d9;cursor:pointer;font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:12.5px;font-weight:600}
#it-overlay .nv-fl:hover{background:rgba(255,255,255,.08)}
#it-overlay .nv-fl.on{background:rgba(232,184,75,.16);color:var(--it-gold)}
@media(max-width:760px){ #it-overlay .nv-tools{left:5px;padding:4px;gap:2px}
  #it-overlay .nv-tool{width:29px;height:29px} #it-overlay .nv-tool svg{width:16px;height:16px} }

/* ── Responsive top bar ── */
@media (max-width:1180px){ .it-coin span{display:none} .it-search{max-width:200px} }
@media (max-width:980px){ .it-pxbox{display:none} }
@media (max-width:620px){
  .it-disc-seal{float:none; display:block; width:96px; height:96px; margin:0 auto 12px}
  .it-disc-box{text-align:center} .it-disc-box p{text-align:left}
}
`;
