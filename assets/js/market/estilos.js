/* market/estilos.js — Todo el CSS del Marketplace (inyecta la etiqueta
   <style> del overlay). CSS estático, sin dependencias. Extraído de
   market.js sin cambiar la lógica. */

const $ = (id) => document.getElementById(id);

export function estilos() {
  if ($('mk-css')) return;
  const s = document.createElement('style'); s.id = 'mk-css';
  s.textContent = `
  #mk-overlay{position:fixed;inset:0;z-index:9300;display:none;align-items:center;justify-content:center;background:rgba(3,5,8,.8);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);padding:18px}
  #mk-overlay.show{display:flex}
  #mk-overlay *{box-sizing:border-box}
  #mk-overlay .mk-card{width:100%;max-width:780px;max-height:92vh;overflow:auto;background:linear-gradient(180deg,#12161c,#0b0e12);border:1px solid #2b3139;border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.72);padding:24px;position:relative;animation:mkIn .18s ease both}
  #mk-overlay .mk-card::after{content:"";position:absolute;inset:0;z-index:0;background-image:url('assets/portada/img/swap-bg.webp');background-size:cover;background-position:center;opacity:.10;filter:saturate(1.05);pointer-events:none;border-radius:20px}
  #mk-overlay .mk-card > *{position:relative;z-index:1}
  @keyframes mkIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  #mk-overlay .mk-x{position:absolute;top:15px;right:15px;width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;display:grid;place-items:center;cursor:pointer;font-size:16px;z-index:3}
  #mk-overlay .mk-head{text-align:center;margin-bottom:16px;padding-right:40px}
  #mk-overlay .mk-title{font-family:var(--display,sans-serif);font-weight:800;font-size:24px;letter-spacing:1.5px;color:var(--gold,#E8B84B);text-transform:uppercase}
  #mk-overlay .mk-title .ln{display:inline-block;width:22px;height:1px;background:var(--gold-soft,#C9A84B);vertical-align:middle;margin:0 11px;opacity:.6}
  #mk-overlay .mk-sub{font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;letter-spacing:1px;margin-top:4px;text-transform:uppercase}
  #mk-overlay .mk-tabs{display:flex;gap:6px;background:#0b0e12;border:1px solid #2b3139;border-radius:12px;padding:5px;margin-bottom:16px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
  #mk-overlay .mk-tabs::-webkit-scrollbar{display:none}
  #mk-overlay .mk-tab{flex:1 0 auto;min-height:44px;padding:11px 12px;border:none;border-radius:8px;background:transparent;color:#b7bdc6;font-family:var(--display,sans-serif);font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap}
  #mk-overlay .mk-tab.on{color:#3a2800;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);box-shadow:0 3px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.4)}
  #mk-overlay .mk-pane{display:none} #mk-overlay .mk-pane.on{display:block;animation:mkIn .16s ease both}

  #mk-overlay .mk-of{background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid #2b3139;border-radius:14px;padding:15px;margin-bottom:11px;box-shadow:0 4px 0 rgba(0,0,0,.3)}
  #mk-overlay .mk-of-top{display:flex;align-items:center;gap:11px;margin-bottom:11px}
  #mk-overlay .mk-ava{width:38px;height:38px;flex:0 0 auto;border-radius:11px;display:grid;place-items:center;background:linear-gradient(160deg,#f7db8d,var(--gold,#E8B84B) 55%,#b98614);color:#3a2800;font-family:var(--display,sans-serif);font-weight:800;font-size:16px}
  #mk-overlay .mk-quien{flex:1;min-width:0}
  #mk-overlay .mk-nom{font-family:var(--display,sans-serif);font-weight:700;font-size:14.5px;color:#eaecef;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
  #mk-overlay .mk-rep{font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;margin-top:2px;display:flex;gap:9px;flex-wrap:wrap}
  #mk-overlay .mk-rep .st{color:var(--gold,#E8B84B)}
  #mk-overlay .mk-monto{text-align:right;flex:0 0 auto}
  #mk-overlay .mk-monto b{font-family:var(--display,sans-serif);font-weight:800;font-size:19px;color:var(--gold,#E8B84B);display:block;line-height:1.1}
  #mk-overlay .mk-monto span{font-family:var(--mono,monospace);font-size:10px;color:#7d8794}
  #mk-overlay .mk-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:11px}
  #mk-overlay .mk-chip{font-family:var(--mono,monospace);font-size:10.5px;color:#b7bdc6;background:rgba(255,255,255,.04);border:1px solid #2b3139;border-radius:8px;padding:5px 9px}
  #mk-overlay .mk-chip b{color:var(--gold,#E8B84B)}
  #mk-overlay .mk-acts{display:flex;gap:8px;flex-wrap:wrap}
  #mk-overlay .mk-b{flex:1;min-width:120px;padding:11px;border-radius:10px;font-family:var(--display,sans-serif);font-weight:800;font-size:13px;cursor:pointer;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;box-shadow:0 3px 0 #8f6a1a}
  #mk-overlay .mk-b:active{transform:translateY(2px);box-shadow:0 1px 0 #8f6a1a}
  #mk-overlay .mk-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:var(--gold,#E8B84B);box-shadow:0 3px 0 rgba(0,0,0,.4)}
  #mk-overlay .mk-b:disabled{opacity:.5;cursor:not-allowed}

  #mk-overlay .mk-prog{margin:11px 0}
  #mk-overlay .mk-prog-lab{display:flex;justify-content:space-between;font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;margin-bottom:6px}
  #mk-overlay .mk-prog-lab b{color:var(--gold,#E8B84B)}
  #mk-overlay .mk-steps{display:flex;gap:4px}
  #mk-overlay .mk-step{flex:1;height:9px;border-radius:4px;background:#0b0e12;border:1px solid #2b3139}
  #mk-overlay .mk-step.ok{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 60%,#c79426);border-color:#c79426;box-shadow:0 0 8px rgba(232,184,75,.35)}
  #mk-overlay .mk-step.now{background:rgba(232,184,75,.22);border-color:var(--gold-soft,#C9A84B);animation:mkPul 1.3s ease-in-out infinite}
  @keyframes mkPul{0%,100%{opacity:.5}50%{opacity:1}}

  #mk-overlay label{display:block;font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.7px;margin:12px 0 6px}
  #mk-overlay input,#mk-overlay select{width:100%;background:#0b0e12;border:1px solid #2b3139;border-radius:10px;color:#eaecef;font-family:var(--mono,monospace);font-size:14px;padding:12px}
  #mk-overlay input[type=number]::-webkit-outer-spin-button,#mk-overlay input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
  /* Desplegable con flecha propia, bien separada del borde */
  #mk-overlay .mk-sel{position:relative}
  #mk-overlay .mk-sel select{-webkit-appearance:none;-moz-appearance:none;appearance:none;padding-right:44px;cursor:pointer}
  #mk-overlay .mk-sel::after{content:'';position:absolute;right:16px;top:50%;width:8px;height:8px;border-right:2px solid var(--gold,#E8B84B);border-bottom:2px solid var(--gold,#E8B84B);transform:translateY(-70%) rotate(45deg);pointer-events:none;border-radius:1px}
  #mk-overlay .mk-sel::before{content:'';position:absolute;right:6px;top:6px;bottom:6px;width:32px;border-left:1px solid #2b3139;pointer-events:none}
  /* Cantidad con − y + propios */
  #mk-overlay .mk-step-in{display:flex;gap:7px;align-items:stretch}
  #mk-overlay .mk-step-in input{flex:1;min-width:0;text-align:center;font-size:16px;font-weight:700}
  #mk-overlay .mk-mm{flex:0 0 auto;width:48px;border-radius:10px;border:1px solid #3a424c;background:linear-gradient(180deg,#1b2027,#0d1117);color:var(--gold,#E8B84B);font-size:20px;font-weight:800;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.4);line-height:1}
  #mk-overlay .mk-mm:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.4)}
  /* Chips seleccionables */
  #mk-overlay .mk-chips-sel{display:flex;flex-wrap:wrap;gap:7px}
  #mk-overlay .mk-cs{min-height:40px;padding:9px 13px;border-radius:9px;border:1px solid #2b3139;background:linear-gradient(180deg,#1b2027,#0d1117);color:#b7bdc6;font-family:var(--mono,monospace);font-size:12px;cursor:pointer;font-weight:700}
  #mk-overlay .mk-cs.on{color:#3a2800;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);border-color:#c79426;box-shadow:0 2px 0 #8f6a1a}
  #mk-overlay .mk-rapidos{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
  #mk-overlay .mk-rp{padding:7px 12px;border-radius:8px;border:1px solid #3a424c;background:rgba(255,255,255,.04);color:var(--gold,#E8B84B);font-family:var(--mono,monospace);font-size:12px;cursor:pointer}
  #mk-overlay .mk-rp:active{transform:translateY(1px)}
  #mk-overlay .mk-hint{font-family:var(--sans,sans-serif);font-size:11.5px;color:#7d8794;line-height:1.55;margin-top:6px}
  #mk-overlay .mk-hint b{color:var(--gold-soft,#C9A84B)}
  #mk-overlay .mk-lab-s{text-transform:none;letter-spacing:0;color:#5f6a75}
  #mk-overlay .mk-i{width:16px;height:16px;border-radius:50%;border:1px solid #6f7a86;background:transparent;color:#8b96a3;font-size:10px;font-style:italic;font-family:Georgia,serif;cursor:pointer;display:inline-grid;place-items:center;vertical-align:middle;margin-left:4px;padding:0}
  #mk-overlay .mk-i:hover{border-color:var(--gold,#E8B84B);color:var(--gold,#E8B84B)}
  #mk-overlay label b{color:var(--gold,#E8B84B)}
  #mk-overlay .mk-chip.pr{background:rgba(232,184,75,.1);border-color:rgba(232,184,75,.35);color:var(--gold,#E8B84B)}
  #mk-overlay .mk-chip.pr b{color:#eaecef;font-size:12.5px}
  #mk-overlay .tx-s{display:none}
  #mk-overlay input:focus,#mk-overlay select:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  #mk-overlay .mk-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  #mk-overlay .mk-msg{font-family:var(--mono,monospace);font-size:12px;text-align:center;margin-top:12px;min-height:16px;line-height:1.5}
  #mk-overlay .mk-msg.err{color:var(--rojo,#f6465d)} #mk-overlay .mk-msg.ok{color:var(--neon-lit,#2ee86a)} #mk-overlay .mk-msg.info{color:#7d8794}
  #mk-overlay .mk-vacio{font-family:var(--mono,monospace);font-size:13px;color:#7d8794;text-align:center;padding:34px 0;line-height:1.7}
  #mk-overlay .mk-nota{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-align:center;margin-top:14px;line-height:1.6}
  #mk-overlay .mk-wz{display:flex;align-items:center;gap:6px;margin-bottom:12px}
  #mk-overlay .mk-wz-p{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;opacity:.5}
  #mk-overlay .mk-wz-p.now,#mk-overlay .mk-wz-p.ok{opacity:1}
  #mk-overlay .mk-wz-p .n{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-family:var(--display,sans-serif);font-weight:800;font-size:13px;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid #3a424c;color:#7d8794}
  #mk-overlay .mk-wz-p.now .n{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);border-color:#c79426;color:#3a2800;box-shadow:0 3px 0 #8f6a1a}
  #mk-overlay .mk-wz-p.ok .n{background:rgba(46,232,106,.16);border-color:rgba(46,232,106,.5);color:var(--neon-lit,#2ee86a)}
  #mk-overlay .mk-wz-p .t{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;line-height:1.3}
  #mk-overlay .mk-wz-p.now .t{color:var(--gold,#E8B84B)}
  #mk-overlay .mk-wz-l{width:18px;height:1px;background:#3a424c;flex:0 0 auto;margin-top:-16px}
  #mk-overlay .mk-guia{font-family:var(--sans,sans-serif);font-size:13px;color:#b7bdc6;line-height:1.6;padding:12px 14px;border-radius:11px;background:rgba(232,184,75,.07);border:1px solid rgba(232,184,75,.3);margin-bottom:13px;text-align:center}
  @media(max-width:560px){#mk-overlay .mk-wz-p .t{font-size:9px}#mk-overlay .mk-wz-l{width:10px}}
  #mk-overlay .mk-box{background:rgba(255,255,255,.02);border:1px solid #2b3139;border-radius:13px;padding:14px;margin-bottom:12px}
  #mk-overlay .mk-box .bt{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
  #mk-overlay .mk-row{display:flex;justify-content:space-between;gap:10px;font-family:var(--mono,monospace);font-size:12.5px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)}
  #mk-overlay .mk-row:last-child{border-bottom:none}
  #mk-overlay .mk-row .k{color:#7d8794} #mk-overlay .mk-row .v{color:#eaecef;font-weight:700}
  #mk-overlay .mk-est{font-family:var(--mono,monospace);font-size:10px;padding:3px 9px;border-radius:9px;border:1px solid #3a424c;color:#b7bdc6;background:rgba(255,255,255,.04)}
  #mk-overlay .mk-est.a{color:var(--neon-lit,#2ee86a);border-color:rgba(46,232,106,.4)}
  #mk-overlay .mk-est.d{color:var(--rojo,#f6465d);border-color:rgba(246,70,93,.4)}
  #mk-overlay .mk-stars{display:flex;gap:6px;justify-content:center;margin:10px 0}
  #mk-overlay .mk-star{font-size:28px;cursor:pointer;color:#3a424c;line-height:1}
  #mk-overlay .mk-star.on{color:var(--gold,#E8B84B);text-shadow:0 0 10px rgba(232,184,75,.4)}
  #mk-overlay .mk-dist{font-family:var(--mono,monospace);font-size:11px;color:#7fb0ff;text-align:center;padding:9px;border-radius:10px;background:rgba(127,176,255,.08);border:1px solid rgba(127,176,255,.3);margin-top:9px}
  /* Evita que el navegador pinte de blanco los campos (autorrelleno) */
  #mk-overlay input:-webkit-autofill,.mk-wiz-c input:-webkit-autofill,
  #mk-overlay input:-webkit-autofill:focus,.mk-wiz-c input:-webkit-autofill:focus{
    -webkit-text-fill-color:#eaecef!important;-webkit-box-shadow:0 0 0 1000px #0b0e12 inset!important;caret-color:#eaecef;transition:background-color 9999s ease-in-out 0s}
  #mk-overlay input,.mk-wiz-c input{color-scheme:dark}
  .mk-wiz-c label .op{text-transform:none;letter-spacing:0;color:#5f6a75}
  /* Botón desplegable de la ficha */
  .mk-wiz-c .fc-desp{width:100%;padding:12px;border-radius:11px;border:1px solid #3a424c;background:linear-gradient(180deg,#1b2027,#0d1117);color:var(--gold,#E8B84B);font-family:var(--display,sans-serif);font-weight:700;font-size:13.5px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;gap:8px}
  .mk-wiz-c .fc-desp .ar{font-size:9px;transition:transform .2s}
  .mk-wiz-c .fc-desp.open .ar{transform:rotate(180deg)}
  .mk-wiz-c .fc-desp + .fc-pasos{margin-top:9px}
  .mk-wiz-c .fc-cta{display:block;width:100%;margin:16px auto 0;text-align:center;padding:14px;border-radius:12px;font-family:var(--display,sans-serif);font-weight:800;font-size:15px;cursor:pointer;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;box-shadow:0 4px 0 #8f6a1a}
  .mk-wiz-c .fc-cta.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:var(--gold,#E8B84B);box-shadow:0 4px 0 rgba(0,0,0,.4)}
  /* Logo de la moneda */
  #mk-overlay .tj-moneda,.mk-wiz-c .tj-moneda{width:38px;height:38px;flex:0 0 auto;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#0b0e12;border:1px solid #2b3139}
  .mk-wiz-c .tj-moneda.grande{width:50px;height:50px}
  .mk-wiz-c .fc-ct .ic{display:grid;place-items:center}
  #mk-overlay .mk-badge{display:inline-grid;place-items:center;min-width:17px;height:17px;padding:0 5px;border-radius:9px;background:var(--rojo,#f6465d);color:#fff;font-family:var(--mono,monospace);font-size:9.5px;font-weight:800;margin-left:5px;box-shadow:0 0 8px rgba(246,70,93,.6)}
  #mk-overlay .tj-estrellas{display:flex;align-items:center;justify-content:center;gap:7px;width:100%}
  #mk-overlay .tj-estrellas .st{color:var(--gold,#E8B84B);font-size:11px;letter-spacing:1px}
  #mk-overlay .tj-estrellas b{color:#eaecef;font-family:var(--display,sans-serif);font-size:12px}
  #mk-overlay .tj-estrellas .ops{color:#7d8794;font-size:10px}
  #mk-overlay .tj-pie{justify-content:center}
  #mk-overlay .op-motivo{margin-top:10px;padding:11px 13px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid #3a424c;font-family:var(--sans,sans-serif);font-size:12.5px;color:#eaecef;line-height:1.6}
  #mk-overlay .op-motivo span{display:block;font-family:var(--mono,monospace);font-size:9.5px;color:#7d8794;text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px}
  .mk-wiz-c textarea{width:100%;box-sizing:border-box;background:#0b0e12;border:1px solid #2b3139;border-radius:11px;color:#eaecef;font-family:var(--sans,sans-serif);font-size:13.5px;padding:12px;line-height:1.5;resize:vertical}
  .mk-wiz-c textarea:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  #mk-overlay .op-caja{background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid rgba(232,184,75,.35);border-radius:14px;padding:15px;margin-bottom:18px;text-align:center;box-shadow:0 4px 0 rgba(0,0,0,.3)}
  #mk-overlay .op-caja.vacia{border-color:#2b3139}
  #mk-overlay .op-caja-t{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.9px}
  #mk-overlay .op-caja-v{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin:7px 0 6px}
  #mk-overlay .op-caja-v span{font-family:var(--mono,monospace);font-size:11px;color:#8b96a3}
  #mk-overlay .op-caja-v b{font-family:var(--display,sans-serif);font-size:24px;color:var(--gold,#E8B84B);margin-right:4px}
  #mk-overlay .op-caja.vacia .op-caja-v b{color:#5f6a75}
  #mk-overlay .op-caja-d{font-family:var(--sans,sans-serif);font-size:11.5px;color:#7d8794;line-height:1.5}
  #mk-overlay .op-caja-b{margin-top:12px;width:100%;padding:12px;border-radius:11px;border:1px solid #3a424c;background:linear-gradient(180deg,#1b2027,#0d1117);color:var(--gold,#E8B84B);font-family:var(--display,sans-serif);font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.4)}
  #mk-overlay .op-caja-b:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.4)}
  #mk-overlay .mk-lanza .lz-d{max-width:340px;margin-left:auto;margin-right:auto}
  /* ── Operaciones ── */
  #mk-overlay .op-sec{margin-bottom:20px}
  #mk-overlay .op-st{font-family:var(--display,sans-serif);font-weight:800;font-size:14px;color:#eaecef;margin-bottom:5px;display:flex;align-items:center;gap:8px}
  #mk-overlay .op-st span{font-family:var(--mono,monospace);font-size:10px;font-weight:400;color:#7d8794;background:rgba(255,255,255,.06);border:1px solid #2b3139;border-radius:20px;padding:2px 8px}
  #mk-overlay .op-nota{font-family:var(--sans,sans-serif);font-size:12px;color:#7d8794;margin-bottom:11px;line-height:1.5}
  #mk-overlay .op-card{background:linear-gradient(158deg,#1c222c,#0c1017);border:1px solid #2b3139;border-radius:16px;padding:15px;margin-bottom:10px;box-shadow:0 4px 0 rgba(0,0,0,.32)}
  #mk-overlay .op-card.act{border-color:rgba(232,184,75,.5);box-shadow:0 4px 0 rgba(0,0,0,.32),0 0 22px rgba(232,184,75,.09)}
  #mk-overlay .op-card.dis{border-color:rgba(246,70,93,.45)}
  #mk-overlay .op-card.ok{opacity:.72}
  #mk-overlay .op-cab{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:9px}
  #mk-overlay .op-id{font-family:var(--mono,monospace);font-size:10px;color:#6b7681}
  #mk-overlay .op-fechas{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06)}
  #mk-overlay .op-fechas span{font-family:var(--mono,monospace);font-size:11px;color:var(--ink-2,#b7bdc6);cursor:help}
  #mk-overlay .op-fechas span.dis{color:var(--rojo,#f6465d)}
  #mk-overlay .op-fechas i{display:block;font-style:normal;font-size:8.5px;color:#6b7681;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px}
  /* ── Guía paso a paso ── */
  /* ── Menú de la cabecera ── */
  /* [CORREGIDO] Tenía otra altura y otro tamaño que la ✕, y se veía
     desalineado. Ahora son idénticos: mismo top, mismo tamaño, mismo
     borde, y separados por su hueco. */
  #mk-overlay .mk-menu-b{position:absolute;top:15px;right:59px;width:36px;height:36px;z-index:15;
    border-radius:10px;display:grid;place-items:center;padding:0;cursor:pointer;
    background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6}
  #mk-overlay .mk-menu-b:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #mk-overlay .mk-menu-b svg{width:17px;height:17px}
  #mk-overlay .mk-pt{position:absolute;top:-3px;right:-3px;width:9px;height:9px;border-radius:50%;
    background:var(--rojo,#f6465d);border:2px solid #0b0e12;display:none}
  #mk-overlay .mk-pt.on{display:block;animation:mkLat 2s ease-in-out infinite}
  @keyframes mkLat{0%,100%{box-shadow:0 0 0 0 rgba(246,70,93,.6)}50%{box-shadow:0 0 0 5px rgba(246,70,93,0)}}
  #mk-overlay .mk-menu-d{position:absolute;top:58px;right:15px;z-index:20;min-width:212px;
    background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid var(--gold-soft,#C9A84B);
    border-radius:14px;padding:6px;box-shadow:0 14px 40px rgba(0,0,0,.65);
    display:none;transform-origin:top right;animation:mkAbre .14s ease-out}
  #mk-overlay .mk-menu-d.open{display:block}
  @keyframes mkAbre{from{opacity:0;transform:scale(.94) translateY(-6px)}to{opacity:1;transform:none}}
  #mk-overlay .mk-mi{display:flex;align-items:center;gap:11px;width:100%;padding:12px 13px;border-radius:10px;
    background:transparent;border:none;color:#b7bdc6;cursor:pointer;text-align:left;min-height:46px}
  #mk-overlay .mk-mi:hover{background:rgba(255,255,255,.05);color:#eaecef}
  #mk-overlay .mk-mi svg{width:17px;height:17px;flex:0 0 auto;opacity:.75}
  #mk-overlay .mk-mi span{flex:1;font-family:var(--sans,sans-serif);font-size:13.5px}
  #mk-overlay .mk-pt2{flex:0 0 auto;min-width:20px;height:20px;padding:0 6px;border-radius:20px;
    display:none;place-items:center;background:var(--rojo,#f6465d);color:#fff;
    font-family:var(--mono,monospace);font-size:11px;font-weight:700;font-style:normal}
  #mk-overlay .mk-pt2.hay{display:grid}
  #mk-overlay .mk-nuevo{flex:0 0 auto;padding:3px 8px;border-radius:20px;font-style:normal;
    background:rgba(246,70,93,.15);border:1px solid rgba(246,70,93,.4);color:var(--rojo,#f6465d);
    font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.6px}
  @media(max-width:560px){
    /* [CORREGIDO] En el móvil el botón caía sobre el título. Ahora va a
       la misma altura que la ✕ y con su propia separación. */
    #mk-overlay .mk-menu-b{top:15px;right:59px;width:36px;height:36px}
    #mk-overlay .mk-menu-b svg{width:16px;height:16px}
    #mk-overlay .mk-menu-d{top:54px;right:12px;left:12px;min-width:0}
    /* El título deja sitio a los dos botones para no solaparse. */
    #mk-overlay .mk-cab h2,#mk-overlay .mk-tit{padding-right:96px}
  }

  #mk-overlay .cf-card{padding:26px 22px;border-radius:18px;text-align:center;
    background:linear-gradient(180deg,rgba(232,184,75,.07),rgba(232,184,75,.015));border:1px solid rgba(232,184,75,.28)}
  #mk-overlay .cf-num{font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:1.6px;margin-bottom:12px}
  #mk-overlay .cf-t{font-family:var(--display,sans-serif);font-weight:800;font-size:21px;color:#eaecef;line-height:1.2}
  #mk-overlay .cf-d{font-family:var(--sans,sans-serif);font-size:14px;color:#8b96a3;line-height:1.7;
    margin:12px auto 20px;max-width:44ch}
  #mk-overlay .cf-d b{color:var(--gold,#E8B84B)}
  #mk-overlay .cf-puntos{display:flex;gap:6px;justify-content:center;margin-bottom:20px;flex-wrap:wrap}
  #mk-overlay .cf-puntos span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.15)}
  #mk-overlay .cf-puntos span.on{background:var(--gold,#E8B84B);width:18px;border-radius:20px}
  #mk-overlay .cf-acts{display:flex;gap:9px;justify-content:center}
  #mk-overlay .cf-b{min-width:150px;min-height:48px;padding:13px 26px;border-radius:12px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 0 #8f6a1a}
  #mk-overlay .cf-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:#b7bdc6;
    box-shadow:0 3px 0 rgba(0,0,0,.4);min-width:100px}
  #mk-overlay .cf-b:active{transform:translateY(2px)}
  #mk-overlay .cf-b .tx-s{display:none}
  #mk-overlay .op-atado{margin-top:11px;padding:13px 15px;border-radius:12px;
    background:rgba(232,184,75,.07);border:1px solid rgba(232,184,75,.28);
    font-family:var(--sans,sans-serif);font-size:12.5px;color:var(--ink-2,#b7bdc6);line-height:1.6;text-align:left}
  #mk-overlay .op-atado > b:first-child{display:block;color:var(--gold,#E8B84B);
    font-family:var(--display,sans-serif);font-size:13.5px;margin-bottom:5px}
  #mk-overlay .op-atado b{color:var(--ink,#eaecef)}
  #mk-overlay .op-atado i{display:block;font-style:normal;margin-top:8px;padding-top:8px;
    border-top:1px solid rgba(232,184,75,.2);font-size:12px;color:var(--ink-3,#7d8794)}
  #mk-overlay .op-limpiar{width:100%;min-height:44px;padding:11px;border-radius:11px;margin-top:8px;
    background:transparent;border:1px dashed #3a424c;color:var(--ink-3,#7d8794);
    font-family:var(--mono,monospace);font-size:11.5px;cursor:pointer}
  #mk-overlay .op-limpiar:hover{border-color:var(--rojo,#f6465d);color:var(--rojo,#f6465d)}
  @media(max-width:560px){
    #mk-overlay .cf-card{padding:22px 16px}
    #mk-overlay .cf-t{font-size:18px}
    #mk-overlay .cf-d{font-size:13px;line-height:1.6}
    #mk-overlay .cf-b{min-width:0;flex:1;padding:13px 14px;font-size:13px}
    #mk-overlay .cf-b .tx-l{display:none}
    #mk-overlay .cf-b .tx-s{display:inline}
  }
  #mk-overlay .op-mas{margin-top:6px}
  #mk-overlay .op-mas summary{cursor:pointer;list-style:none;padding:11px 13px;border-radius:11px;border:1px dashed #3a424c;background:transparent;color:var(--ink-3,#7d8794);font-family:var(--mono,monospace);font-size:11.5px;text-align:center}
  #mk-overlay .op-mas summary::-webkit-details-marker{display:none}
  #mk-overlay .op-mas summary:hover{color:var(--gold,#E8B84B);border-color:var(--gold-soft,#C9A84B)}
  #mk-overlay .op-mas[open] summary{margin-bottom:9px}
  @media(max-width:560px){#mk-overlay .op-fechas{gap:11px}#mk-overlay .op-fechas span{font-size:10.5px}}
  #mk-overlay .op-rol{font-family:var(--display,sans-serif);font-weight:800;font-size:12.5px;color:#eaecef;flex:1;min-width:0}
  #mk-overlay .op-est{font-family:var(--mono,monospace);font-size:9.5px;padding:3px 9px;border-radius:8px;border:1px solid #3a424c;color:#9aa4b0;background:rgba(255,255,255,.04)}
  #mk-overlay .op-est.act{color:var(--gold,#E8B84B);border-color:rgba(232,184,75,.45);background:rgba(232,184,75,.1)}
  #mk-overlay .op-est.dis{color:var(--rojo,#f6465d);border-color:rgba(246,70,93,.45);background:rgba(246,70,93,.1)}
  #mk-overlay .op-est.ok{color:var(--neon-lit,#2ee86a);border-color:rgba(46,232,106,.45);background:rgba(46,232,106,.1)}
  #mk-overlay .op-tit{font-family:var(--display,sans-serif);font-weight:800;font-size:15px;color:var(--gold,#E8B84B);line-height:1.3;margin-bottom:6px}
  #mk-overlay .op-card.ok .op-tit,#mk-overlay .op-card:not(.act):not(.dis) .op-tit{color:#eaecef}
  #mk-overlay .op-card.act .op-tit{color:var(--gold,#E8B84B)}
  #mk-overlay .op-exp{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.6}
  #mk-overlay .op-exp b{color:var(--gold-soft,#C9A84B)}
  #mk-overlay .op-prog{margin-top:12px}
  #mk-overlay .op-prog-l{display:flex;justify-content:space-between;gap:9px;font-family:var(--mono,monospace);font-size:10px;color:#7d8794;margin-bottom:6px;flex-wrap:wrap}
  #mk-overlay .op-ct{font-family:var(--mono,monospace);font-size:12px;color:#7fb0ff;background:rgba(127,176,255,.09);border:1px solid rgba(127,176,255,.3);border-radius:10px;padding:10px 12px;margin-bottom:9px;width:100%;word-break:break-word}
  #mk-overlay .op-arb{font-family:var(--mono,monospace);font-size:11px;color:var(--rojo,#f6465d);background:rgba(246,70,93,.09);border:1px solid rgba(246,70,93,.3);border-radius:10px;padding:9px 11px;margin-bottom:9px;width:100%}
  #mk-overlay .op-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
  #mk-overlay .op-b{flex:1;min-width:150px;min-height:44px;padding:12px 10px;border-radius:11px;font-family:var(--display,sans-serif);font-weight:800;font-size:12.5px;cursor:pointer;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;box-shadow:0 3px 0 #8f6a1a}
  #mk-overlay .op-b:active{transform:translateY(2px);box-shadow:0 1px 0 #8f6a1a}
  #mk-overlay .op-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:#b7bdc6;box-shadow:0 3px 0 rgba(0,0,0,.4)}
  .mk-wiz-acts .mk-b.peligro{background:linear-gradient(180deg,#f08a95,#e35d6a 45%,#b8323f);border-color:#d14a58;color:#fff;box-shadow:0 4px 0 #8c2531;text-shadow:0 1px 0 rgba(0,0,0,.3)}
  @media(max-width:560px){#mk-overlay .op-b{min-width:100%}}
  /* ── Tarjetas en cuadrícula ── */
  #mk-overlay .tj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
  #mk-overlay .tj{position:relative;border-radius:18px;padding:16px 15px 15px;display:flex;flex-direction:column;gap:0;overflow:hidden;
    background:linear-gradient(158deg,#1c222c 0%,#141922 45%,#0c1017 100%);
    border:1px solid #2b3139;
    box-shadow:0 6px 0 rgba(0,0,0,.35),0 12px 28px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06)}
  /* brillo diagonal sutil */
  #mk-overlay .tj::before{content:'';position:absolute;top:-40%;right:-30%;width:120%;height:90%;pointer-events:none;
    background:radial-gradient(ellipse at top right,rgba(232,184,75,.13),transparent 62%)}
  #mk-overlay .tj.compra::before{background:radial-gradient(ellipse at top right,rgba(52,217,123,.15),transparent 62%)}
  /* franja de color arriba */
  #mk-overlay .tj::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;
    background:linear-gradient(90deg,transparent,var(--gold,#E8B84B),transparent);opacity:.55}
  #mk-overlay .tj.compra::after{background:linear-gradient(90deg,transparent,#34d97b,transparent)}

  #mk-overlay .tj-cab{display:flex;align-items:center;gap:10px;position:relative;z-index:1}
  #mk-overlay .tj-moneda{width:34px;height:34px;flex:0 0 auto;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#0b0e12;border:1px solid #2b3139;box-shadow:0 2px 6px rgba(0,0,0,.5)}
  #mk-overlay .tj-q{min-width:0;flex:1;overflow:hidden}
  #mk-overlay .tj-nom{font-family:var(--display,sans-serif);font-weight:700;font-size:13.5px;color:#eaecef;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px}
  #mk-overlay .tj-ok{color:#4d9fff;font-size:10px;flex:0 0 auto}
  #mk-overlay .tj-red{font-family:var(--mono,monospace);font-size:9px;color:#6b7681;letter-spacing:.5px;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #mk-overlay .tj-tag{flex:0 0 auto;font-family:var(--display,sans-serif);font-weight:800;font-size:9.5px;padding:5px 10px;border-radius:8px;white-space:nowrap;letter-spacing:.3px;box-shadow:0 2px 6px rgba(0,0,0,.5)}
  #mk-overlay .tj-tag.v{background:linear-gradient(180deg,#e35d6a,#b8323f);color:#fff;border:1px solid #d14a58}
  #mk-overlay .tj-tag.c{background:linear-gradient(180deg,#4fd992,#1f9e5f);color:#042415;border:1px solid #34b877}

  #mk-overlay .tj-cifra{display:flex;align-items:baseline;gap:5px;margin-top:13px;position:relative;z-index:1}
  #mk-overlay .tj-cifra{flex-wrap:wrap}
  #mk-overlay .tj-cifra b{font-family:var(--display,sans-serif);font-weight:800;font-size:clamp(19px,6.4vw,27px);color:var(--gold,#E8B84B);line-height:1;text-shadow:0 2px 5px rgba(0,0,0,.6)}
  #mk-overlay .tj.compra .tj-cifra b{color:#5fe3a1}
  #mk-overlay .tj-cifra span{font-family:var(--mono,monospace);font-size:11px;color:#8b96a3}
  #mk-overlay .tj-tasa{font-family:var(--mono,monospace);font-size:12px;color:#b7bdc6;margin-top:5px;position:relative;z-index:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #mk-overlay .tj-tasa b{color:#eaecef;font-size:13px}
  #mk-overlay .tj-total{font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;margin-top:2px;position:relative;z-index:1}
  #mk-overlay .tj-total b{color:var(--gold-soft,#C9A84B)}
  #mk-overlay .tj-otras{font-family:var(--mono,monospace);font-size:9.5px;color:#6b7681;margin-top:5px;position:relative;z-index:1}
  #mk-overlay .tj-otras b{color:#9aa4b0}
  #mk-overlay .tj-pie{display:flex;gap:9px;align-items:center;margin:11px 0 12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06);font-family:var(--mono,monospace);font-size:10px;color:#7d8794;position:relative;z-index:1;min-height:12px}
  #mk-overlay .tj-pie .st{color:var(--gold,#E8B84B)}
  #mk-overlay .tj-pie .nuevo{color:#6b7681;border:1px solid #2b3139;border-radius:6px;padding:2px 7px}
  #mk-overlay .tj-btn{width:100%;margin-top:auto;min-height:44px;padding:12px;border-radius:11px;font-family:var(--display,sans-serif);font-weight:800;font-size:13.5px;cursor:pointer;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;box-shadow:0 4px 0 #8f6a1a,0 6px 14px rgba(0,0,0,.35);text-shadow:0 1px 0 rgba(255,255,255,.3);position:relative;z-index:1}
  #mk-overlay .tj-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #8f6a1a}
  #mk-overlay .tj-btn.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:var(--gold,#E8B84B);box-shadow:0 4px 0 rgba(0,0,0,.4);text-shadow:none}
  #mk-overlay .tj.compra .tj-btn{border-color:#34b877;background:linear-gradient(180deg,#8ff0bd,#34d97b 45%,#1f9e5f);color:#042415;box-shadow:0 4px 0 #158043,0 6px 14px rgba(0,0,0,.35)}
  /* Esqueletos mientras carga */
  #mk-overlay .tj-sk{height:150px;border-radius:16px;border:1px solid #2b3139;background:linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.03) 75%);background-size:220% 100%;animation:tjSk 1.1s ease-in-out infinite}
  @keyframes tjSk{0%{background-position:120% 0}100%{background-position:-120% 0}}
  /* Ficha */
  #mk-overlay .fc-h,.mk-wiz-c .fc-h{display:flex;align-items:center;gap:13px;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid #2b3139;padding-right:38px}
  .mk-wiz-c .fc-nom{font-family:var(--display,sans-serif);font-weight:800;font-size:19px;color:#eaecef}
  .mk-wiz-c .fc-sub{font-family:var(--mono,monospace);font-size:11px;color:#7d8794;margin-top:3px}
  .mk-wiz-c .fc-hero{text-align:center;padding:15px;border-radius:14px;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid #2b3139;margin-bottom:15px;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
  .mk-wiz-c .fc-hero span{display:block;font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:1px}
  .mk-wiz-c .fc-hero b{display:block;font-family:var(--display,sans-serif);font-weight:800;font-size:27px;color:var(--gold,#E8B84B);margin-top:4px}
  .mk-wiz-c .fc-hero i{display:block;font-style:normal;font-family:var(--mono,monospace);font-size:9.5px;color:#6b7681;letter-spacing:.5px;margin-top:5px}
  .mk-wiz-c .fc-reser{margin-top:14px;padding:14px 15px;border-radius:12px;background:rgba(46,232,106,.09);border:1px solid rgba(46,232,106,.4);font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;line-height:1.6;text-align:center}
  .mk-wiz-c .fc-reser b{display:block;color:var(--neon-lit,#2ee86a);font-family:var(--display,sans-serif);font-size:15px;margin-bottom:5px}
  .mk-wiz-c .fc-reser b:not(:first-child){display:inline;font-size:inherit;color:var(--gold,#E8B84B);margin:0}
  .mk-wiz-c .fc-sec{margin-bottom:16px}
  .mk-wiz-c .fc-t{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
  .mk-wiz-c .fc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
  .mk-wiz-c .fc-chip{font-family:var(--mono,monospace);font-size:11px;color:#b7bdc6;background:rgba(255,255,255,.04);border:1px solid #2b3139;border-radius:8px;padding:6px 10px}
  .mk-wiz-c .fc-chip.oro{color:var(--gold,#E8B84B);background:rgba(232,184,75,.1);border-color:rgba(232,184,75,.3)}
  .mk-wiz-c .fc-chip.oro b{color:#eaecef}
  .mk-wiz-c .fc-pasos{display:flex;flex-direction:column;gap:7px}
  .mk-wiz-c .fc-p{display:flex;gap:10px;align-items:flex-start;font-family:var(--sans,sans-serif);font-size:12.5px;color:#8b96a3;line-height:1.5;background:rgba(255,255,255,.02);border:1px solid #2b3139;border-radius:10px;padding:10px 12px}
  .mk-wiz-c .fc-p b{color:var(--gold-soft,#C9A84B)}
  .mk-wiz-c .fc-p span{flex:0 0 auto;width:20px;height:20px;border-radius:6px;display:grid;place-items:center;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800;font-family:var(--display,sans-serif);font-weight:800;font-size:11px}
  .mk-wiz-c .fc-cts{display:flex;flex-direction:column;gap:7px}
  .mk-wiz-c .fc-ct{display:flex;align-items:center;gap:10px;font-family:var(--mono,monospace);font-size:13px;color:#eaecef;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid #3a424c;border-radius:11px;padding:11px 13px}
  .mk-wiz-c .fc-ct .ic{flex:0 0 auto;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:rgba(232,184,75,.13);color:var(--gold,#E8B84B);font-size:13px}
  /* Aviso bonito (sustituye al texto blanco suelto) */
  #mk-overlay .mk-msg,.mk-wiz-c .mk-msg{font-family:var(--sans,sans-serif);font-size:12.5px;line-height:1.5;margin-top:12px;text-align:left;min-height:0;padding:0;border-radius:11px;transition:padding .15s}
  #mk-overlay .mk-msg:empty,.mk-wiz-c .mk-msg:empty{display:none}
  #mk-overlay .mk-msg.err,.mk-wiz-c .mk-msg.err{color:#ffd9dd;background:rgba(246,70,93,.14);border:1px solid rgba(246,70,93,.42);padding:11px 13px}
  #mk-overlay .mk-msg.ok,.mk-wiz-c .mk-msg.ok{color:#c9ffdc;background:rgba(46,232,106,.12);border:1px solid rgba(46,232,106,.42);padding:11px 13px}
  #mk-overlay .mk-msg.info,.mk-wiz-c .mk-msg.info{color:#cfd6de;background:rgba(255,255,255,.05);border:1px solid #3a424c;padding:11px 13px}
  @media(max-width:560px){
    #mk-overlay .tj-grid{grid-template-columns:1fr 1fr;gap:9px}
    #mk-overlay .tj{padding:13px 11px 12px;gap:8px}
    #mk-overlay .tj-tag{font-size:8.5px;padding:4px 7px;right:8px;top:8px}
    #mk-overlay .tj-top{margin-top:24px}
    #mk-overlay .tj-moneda{width:30px;height:30px}
    #mk-overlay .tj-nom{font-size:12.5px}
    #mk-overlay .tj-btn{font-size:11.5px;padding:10px 4px}
    #mk-overlay .tj-ava{width:30px;height:30px;font-size:13px}
  }
  /* ── Asistente de venta ── */
  .mk-wiz-bg{position:fixed;inset:0;z-index:9550;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,5,8,.85);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  .mk-wiz-c{width:100%;max-width:460px;max-height:90vh;overflow:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:20px;padding:22px;box-shadow:0 34px 100px rgba(0,0,0,.75);position:relative;animation:mkIn .18s ease both}
  .mk-wiz-x{position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;cursor:pointer;font-size:14px;display:grid;place-items:center}
  .mk-wiz-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:16px;padding-right:38px}
  .mk-wiz-pasos{display:flex;gap:5px}
  .mk-wiz-d{width:26px;height:5px;border-radius:3px;background:#2b3139}
  .mk-wiz-d.ok{background:var(--gold-soft,#C9A84B)}
  .mk-wiz-d.now{background:linear-gradient(90deg,#f7db8d,var(--gold,#E8B84B));box-shadow:0 0 8px rgba(232,184,75,.5)}
  .mk-wiz-n{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.7px;white-space:nowrap}
  .mk-wiz-t{font-family:var(--display,sans-serif);font-weight:800;font-size:21px;color:var(--gold,#E8B84B);line-height:1.25;margin-bottom:7px}
  .mk-wiz-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.6;margin-bottom:16px}
  .mk-wiz-s b{color:var(--gold-soft,#C9A84B)}
  .mk-wiz-b label{display:block;font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;text-transform:uppercase;letter-spacing:.6px;margin:14px 0 6px}
  .mk-wiz-b label b{color:var(--gold,#E8B84B)}
  .mk-wiz-b input{width:100%;box-sizing:border-box;background:#0b0e12;border:1px solid #2b3139;border-radius:10px;color:#eaecef;font-family:var(--mono,monospace);font-size:15px;padding:13px}
  .mk-wiz-b input:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  .wz-ops{display:grid;grid-template-columns:1fr;gap:8px}
  .wz-ops.chicas{grid-template-columns:1fr 1fr}
  .wz-op{text-align:left;padding:13px 15px;border-radius:12px;border:1px solid #2b3139;background:linear-gradient(180deg,#1b2027,#0d1117);cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.35);transition:filter .12s}
  .wz-op:hover{filter:brightness(1.15)}
  .wz-op b{display:block;font-family:var(--display,sans-serif);font-weight:800;font-size:15px;color:#eaecef}
  .wz-op span{display:block;font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;margin-top:2px}
  .wz-op.on{border-color:#c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);box-shadow:0 3px 0 #8f6a1a}
  .wz-op.on b{color:#3a2800} .wz-op.on span{color:#6a4d10}
  .mk-wiz-acts{display:flex;gap:9px;margin-top:20px}
  .mk-wiz-acts .mk-b{flex:1;min-width:0;padding:13px;border-radius:11px;font-family:var(--display,sans-serif);font-weight:800;font-size:14px;cursor:pointer;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;box-shadow:0 4px 0 #8f6a1a}
  .mk-wiz-acts .mk-b.gris{flex:0 0 34%;background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:var(--gold,#E8B84B);box-shadow:0 4px 0 rgba(0,0,0,.4)}
  .mk-wiz-acts .mk-b:active{transform:translateY(3px);box-shadow:0 1px 0 #8f6a1a}
  .mk-wiz-acts .mk-b:disabled{opacity:.5;cursor:not-allowed}
  .mk-wiz-c .mk-step-in{display:flex;gap:7px}
  .mk-wiz-c .mk-step-in input{flex:1;min-width:0;text-align:center;font-size:18px;font-weight:700}
  .mk-wiz-c .mk-mm{flex:0 0 auto;width:50px;border-radius:10px;border:1px solid #3a424c;background:linear-gradient(180deg,#1b2027,#0d1117);color:var(--gold,#E8B84B);font-size:21px;font-weight:800;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.4)}
  .mk-wiz-c .mk-sel{position:relative}
  .mk-wiz-c .mk-sel select{width:100%;box-sizing:border-box;-webkit-appearance:none;-moz-appearance:none;appearance:none;background:#0b0e12;border:1px solid #2b3139;border-radius:10px;color:#eaecef;font-family:var(--mono,monospace);font-size:14px;padding:13px;padding-right:44px;cursor:pointer}
  .mk-wiz-c .mk-sel select:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  .mk-wiz-c .mk-sel::after{content:'';position:absolute;right:16px;top:50%;width:8px;height:8px;border-right:2px solid var(--gold,#E8B84B);border-bottom:2px solid var(--gold,#E8B84B);transform:translateY(-70%) rotate(45deg);pointer-events:none}
  .mk-wiz-c .mk-sel::before{content:'';position:absolute;right:6px;top:6px;bottom:6px;width:32px;border-left:1px solid #2b3139;pointer-events:none}
  .mk-wiz-c .mk-hint{font-family:var(--sans,sans-serif);font-size:11.5px;color:#7d8794;line-height:1.55;margin-top:8px}
  .mk-wiz-c .mk-hint b{color:var(--gold-soft,#C9A84B)}
  .mk-wiz-c .mk-rp{padding:5px 10px;border-radius:7px;border:1px solid #3a424c;background:rgba(255,255,255,.05);color:var(--gold,#E8B84B);font-family:var(--mono,monospace);font-size:11px;cursor:pointer;margin-left:6px}
  .mk-wiz-c .wz-resumen{margin-top:14px;padding:13px 15px;border-radius:12px;background:rgba(232,184,75,.07);border:1px solid rgba(232,184,75,.3);font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;line-height:1.6}
  .mk-wiz-c .wz-resumen b{color:var(--gold,#E8B84B)}
  #mk-overlay .mk-lanza{text-align:center}
  #mk-overlay .mk-lanza .lz-t{font-family:var(--display,sans-serif);font-weight:800;font-size:18px;color:var(--gold,#E8B84B);margin-bottom:6px}
  #mk-overlay .mk-lanza .lz-d{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.6;margin-bottom:15px}
  @media(max-width:560px){
    .mk-wiz-bg{padding:0;align-items:flex-end}
    .mk-wiz-c{max-width:100%;max-height:94vh;border-radius:20px 20px 0 0;padding:20px 16px}
    .mk-wiz-t{font-size:19px}
    .wz-op b{font-size:14px}
  }
  .mk-dlg-bg{position:fixed;inset:0;z-index:9600;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,5,8,.82);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}
  .mk-dlg{width:100%;max-width:430px;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:18px;padding:22px;box-shadow:0 30px 90px rgba(0,0,0,.7);animation:mkIn .18s ease both}
  .mk-dlg-t{font-family:var(--display,sans-serif);font-weight:800;font-size:18px;color:var(--gold,#E8B84B);margin-bottom:11px}
  .mk-dlg-d{font-family:var(--sans,sans-serif);font-size:13.5px;color:#b7bdc6;line-height:1.65}
  .mk-dlg-d b{color:var(--gold,#E8B84B)}
  .mk-dlg-b{display:flex;gap:9px;margin-top:18px}
  .mk-dlg-b .mk-b{flex:1;min-width:0;padding:12px;border-radius:11px;font-family:var(--display,sans-serif);font-weight:800;font-size:13.5px;cursor:pointer;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;box-shadow:0 3px 0 #8f6a1a}
  .mk-dlg-b .mk-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:var(--gold,#E8B84B);box-shadow:0 3px 0 rgba(0,0,0,.4)}
  #mk-overlay .mk-mapa{margin-top:10px;border-radius:12px;overflow:hidden;border:1px solid #2b3139;background:#0b0e12}
  #mk-overlay .mk-mapa-top{display:flex;justify-content:space-between;align-items:center;padding:10px 13px;font-family:var(--mono,monospace);font-size:11px;color:#7d8794;text-transform:uppercase;letter-spacing:.6px}
  #mk-overlay .mk-mapa-top b{font-family:var(--display,sans-serif);font-size:18px;color:#7fb0ff;letter-spacing:0}
  #mk-overlay .mk-iframe{width:100%;height:190px;border:none;display:block;filter:grayscale(.35) brightness(.85) contrast(1.05)}
  #mk-overlay .mk-mapa-pie{padding:9px 13px;font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;display:flex;justify-content:space-between;gap:9px;flex-wrap:wrap}
  #mk-overlay .mk-mapa-pie a{color:#7fb0ff;text-decoration:none}
  #mk-overlay .mk-aviso{font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;line-height:1.6;padding:12px 14px;border-radius:11px;background:rgba(232,184,75,.06);border:1px solid rgba(232,184,75,.28);margin-top:10px}
  #mk-overlay .mk-aviso b{color:var(--gold,#E8B84B)}
  #mk-overlay .mk-escala{margin-top:12px;padding:13px;border-radius:12px;background:#0b0e12;border:1px solid #2b3139}
  #mk-overlay .mk-escala-t{display:flex;justify-content:space-between;font-family:var(--mono,monospace);font-size:10.5px;color:#7d8794;margin-bottom:8px}
  #mk-overlay .mk-escala-t b{color:var(--gold,#E8B84B)}
  #mk-overlay .mk-escala-bar{display:flex;gap:4px}
  #mk-overlay .mk-escala-p{flex:1;height:34px;border-radius:7px;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid #3a424c;display:grid;place-items:center;font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);font-weight:700}
  #mk-overlay .mk-paso{display:flex;gap:10px;padding:11px 12px;border-radius:11px;background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid #2b3139;margin-bottom:7px}
  #mk-overlay .mk-paso .n{flex:0 0 auto;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-family:var(--display,sans-serif);font-weight:800;font-size:12px;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800;box-shadow:0 2px 0 #8f6a1a}
  #mk-overlay .mk-paso .t b{font-family:var(--display,sans-serif);color:#eaecef;font-size:13.5px;display:block;margin-bottom:2px}
  #mk-overlay .mk-paso .t span{font-family:var(--sans,sans-serif);font-size:12.5px;color:#8b96a3;line-height:1.55}
  #mk-overlay .mk-paso .t span em{color:var(--gold,#E8B84B);font-style:normal;font-weight:600}
  @media(max-width:560px){
    #mk-overlay{padding:0}
    #mk-overlay .mk-card{max-width:100%;max-height:100vh;height:100vh;border-radius:0;border:none;padding:18px 14px}
    #mk-overlay .mk-title{font-size:20px}
    #mk-overlay .mk-2{grid-template-columns:1fr}
    #mk-overlay .mk-b{min-width:100%}
    #mk-overlay .mk-tab{font-size:11px;padding:11px 10px;min-height:44px}
    #mk-overlay .tx-l{display:none} #mk-overlay .tx-s{display:inline}
    #mk-overlay label{font-size:9.5px;letter-spacing:.4px}
    #mk-overlay .mk-cs{padding:8px 11px;font-size:11px}
    #mk-overlay .mk-mm{width:42px;font-size:18px}
    #mk-overlay .mk-hint{font-size:11px}
    #mk-overlay .mk-chip{font-size:10px;padding:4px 8px}
  }`;
  document.head.appendChild(s);
}
