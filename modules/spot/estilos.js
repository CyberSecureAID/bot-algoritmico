/* modules/trading-demo/estilos.js — Skin del Trading Demo.
   Futuros estilo Binance con la paleta de DecFreedom: gráfica grande, panel de
   entrada compacto (sin scroll), posiciones abajo, apalancamiento tipo Binance,
   TP/SL arrastrables en la gráfica y tarjeta de PnL. Autónomo y responsivo. */

export function estilos() {
  if (document.getElementById('sp-css')) { return; }
  const s = document.createElement('style'); s.id = 'sp-css';
  s.textContent = `
  :root{ --sp-gold:#E8B84B; --sp-gold-soft:#C9A84B; --sp-up:#2ee86a; --sp-up2:#3ee88a; --sp-down:#ff5b6e; --sp-down2:#ff6b7a;
    --sp-bg:#0a0d12; --sp-panel:#0e141c; --sp-panel2:#10151c; --sp-line:#1b222c; --sp-line2:#242d38;
    --sp-ink:#eaecef; --sp-ink2:#9aa4af; --sp-ink3:#6b7580; --sp-mono:'IBM Plex Mono',ui-monospace,Consolas,monospace; --sp-disp:'Chakra Petch',system-ui,sans-serif; }
  #sp-overlay{position:fixed; inset:0; z-index:10000; background:var(--sp-bg); color:var(--sp-ink); display:flex; flex-direction:column; font-family:'Plus Jakarta Sans',system-ui,sans-serif; overflow:hidden; -webkit-text-size-adjust:100%}
  #sp-overlay *{box-sizing:border-box}
  #sp-overlay button{font-family:inherit; cursor:pointer}
  #sp-overlay input[type=number]{-moz-appearance:textfield}
  #sp-overlay input[type=number]::-webkit-outer-spin-button,#sp-overlay input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none; margin:0}

  /* ── Barra superior ── */
  .sp-top{display:flex; align-items:center; gap:10px; flex:0 0 auto; height:52px; padding:0 12px; background:linear-gradient(180deg,#0e141c,#0a0e14); border-bottom:1px solid var(--sp-line); position:relative; z-index:20}
  .sp-back{display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 11px 0 8px; border-radius:9px; flex:0 0 auto; font-family:var(--sp-disp); font-weight:700; font-size:12.5px; color:#8b96a3; background:rgba(255,255,255,.05); border:1px solid var(--sp-line2)}
  .sp-back svg{width:12px; height:12px} .sp-back:hover{border-color:var(--sp-gold-soft); color:var(--sp-gold)}
  .sp-demo{font-family:var(--sp-mono); font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#3ee88a; background:rgba(46,232,106,.14); border:1px solid rgba(46,232,106,.45); border-radius:100px; padding:4px 10px; flex:0 0 auto}
  .sp-coin{display:inline-flex; align-items:center; gap:8px; height:36px; padding:0 12px 0 6px; border-radius:10px; flex:0 0 auto; background:#141b24; border:1px solid var(--sp-line2); color:var(--sp-ink); font-family:var(--sp-mono); font-weight:700; font-size:14px}
  .sp-coin:hover{border-color:var(--sp-gold-soft)}
  .sp-coin i{width:24px; height:24px; border-radius:50%; flex:0 0 auto; background:#232b36 center/cover no-repeat; display:grid; place-items:center; font-family:var(--sp-disp); font-weight:800; font-size:11px; color:#c9d1d9; border:1px solid rgba(255,255,255,.08)}
  .sp-coin i.con{color:transparent; border-color:transparent}
  .sp-coin svg{width:12px; height:12px; opacity:.6}
  /* Temporalidad: dropdown, como el resto de secciones */
  .sp-tf{position:relative; flex:0 0 auto}
  .sp-tf .cur{display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 11px; border-radius:9px; background:#141b24; border:1px solid var(--sp-line2); color:var(--sp-ink); font-family:var(--sp-mono); font-weight:700; font-size:12.5px}
  .sp-tf .cur:hover{border-color:var(--sp-gold-soft)} .sp-tf .cur .cv{color:var(--sp-ink3); font-size:9px}
  .sp-tf .menu{position:absolute; top:40px; left:0; z-index:60; display:none; grid-template-columns:1fr 1fr 1fr; gap:5px; min-width:208px; padding:6px; border-radius:13px; background:#141b24; border:1px solid var(--sp-line2); box-shadow:0 18px 44px rgba(0,0,0,.6)}
  .sp-tf.open .menu{display:grid}
  .sp-tf .menu button{min-height:38px; border-radius:9px; border:1px solid transparent; background:rgba(255,255,255,.04); color:#c7cdd6; font-family:var(--sp-mono); font-weight:700; font-size:12.5px}
  .sp-tf .menu button:hover{border-color:#3a424c; color:var(--sp-ink)} .sp-tf .menu button.on{background:linear-gradient(180deg,#f7db8d,var(--sp-gold) 55%,#c79426); color:#2a1d00; border-color:var(--sp-gold)}
  .sp-px{display:flex; flex-direction:column; justify-content:center; flex:0 0 auto; min-width:116px}
  .sp-px-big{font-family:var(--sp-disp); font-weight:800; font-size:20px; line-height:1.05; letter-spacing:.3px; transition:color .15s}
  .sp-px-big.up{color:var(--sp-up2)} .sp-px-big.down{color:var(--sp-down2)}
  .sp-px-sub{font-family:var(--sp-mono); font-size:10px; color:var(--sp-ink3)}
  .sp-brand{display:inline-flex; align-items:center; height:26px; font-family:var(--sp-mono); font-size:10.5px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#ff6b78; background:rgba(255,74,90,.14); border:1px solid rgba(255,74,90,.45); border-radius:7px; padding:0 10px; flex:0 0 auto}
  .sp-wallet{display:flex; align-items:center; gap:10px; flex:1 1 auto; margin-left:16px; min-width:0}
  .sp-bal-boxes{display:flex; gap:7px; overflow-x:auto; flex:1 1 auto; min-width:0; scrollbar-width:none} .sp-bal-boxes::-webkit-scrollbar{display:none}
  .sp-bal-box{flex:0 0 auto; display:flex; flex-direction:column; justify-content:center; gap:1px; height:36px; padding:0 11px; border-radius:9px; background:rgba(255,255,255,.04); border:1px solid var(--sp-line)}
  .sp-bal-box.op{cursor:pointer; transition:border-color .15s,background .15s}
  .sp-bal-box.op:hover{border-color:var(--sp-gold-soft); background:rgba(255,255,255,.07)}
  .sp-bal-box.on{border-color:var(--sp-gold); background:rgba(201,168,75,.13)}
  .sp-bal-top{display:flex; align-items:baseline; gap:6px}
  .sp-bal-box .sym{font-family:var(--sp-mono); font-size:9px; font-weight:800; letter-spacing:.04em; line-height:1}
  .sp-bal-box b{font-family:var(--sp-mono); font-size:12.5px; font-weight:800; color:var(--sp-ink); line-height:1}
  .sp-bal-box i{font-style:normal; font-family:var(--sp-mono); font-size:8.5px; color:var(--sp-ink3); line-height:1}
  .sp-bal-box.sp-bal-empty{justify-content:center; align-items:center; color:var(--sp-ink3); font-family:var(--sp-mono); font-size:11px; padding:0 12px}
  /* Botón cuadrado (bordes redondeados) que abre TODAS tus monedas */
  .sp-coinsbtn{display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 10px; flex:0 0 auto; border-radius:9px; background:#141b24; border:1px solid var(--sp-line2); color:var(--sp-ink2); cursor:pointer; transition:border-color .15s,color .15s}
  .sp-coinsbtn:hover{border-color:var(--sp-gold-soft); color:var(--sp-ink)}
  .sp-coinsbtn svg{opacity:.85}
  .sp-coinsbtn b{font-family:var(--sp-mono); font-size:12px; font-weight:800; color:var(--sp-ink)}
  .sp-coinsbtn .cv{font-size:9px; color:var(--sp-ink3)}
  .sp-bal-total{display:flex; flex-direction:column; align-items:flex-end; flex:0 0 auto}
  .sp-bal-total .lbl{font-family:var(--sp-mono); font-size:8.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--sp-ink3)}
  .sp-bal-total b, .sp-wallet .eq{font-family:var(--sp-disp); font-weight:800; font-size:21px; letter-spacing:-.01em; color:var(--sp-gold); line-height:1.1}
  /* Popup con todas las monedas de la wallet */
  .sp-walletmenu{position:fixed; z-index:12050; width:250px; max-height:62vh; overflow-y:auto; padding:6px; border-radius:13px; background:#141b24; border:1px solid var(--sp-line2); box-shadow:0 18px 44px rgba(0,0,0,.6)}
  .sp-walletmenu .sp-wm-h{padding:6px 9px 8px; font-family:var(--sp-mono); font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--sp-ink3)}
  .sp-walletmenu button{display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; min-height:40px; padding:0 11px; border-radius:9px; border:1px solid transparent; background:transparent; color:var(--sp-ink2); font-family:var(--sp-mono); cursor:pointer}
  .sp-walletmenu button:hover{border-color:#3a424c; background:rgba(255,255,255,.04)}
  .sp-walletmenu button.on{border-color:var(--sp-gold-soft)}
  .sp-walletmenu button.nop{opacity:.5; cursor:default}
  .sp-walletmenu button .sym{font-weight:800; font-size:13px; letter-spacing:.03em}
  .sp-walletmenu button .am{display:flex; flex-direction:column; align-items:flex-end; line-height:1.15}
  .sp-walletmenu button .am b{font-size:12.5px; color:var(--sp-ink); font-weight:800}
  .sp-walletmenu button .am i{font-style:normal; font-size:9px; color:var(--sp-ink3)}
  .sp-icobtn{height:36px; min-width:36px; padding:0 9px; border-radius:9px; flex:0 0 auto; display:inline-grid; place-items:center; color:#8b96a3; background:rgba(255,255,255,.05); border:1px solid var(--sp-line2)}
  .sp-icobtn svg{width:15px; height:15px} .sp-icobtn:hover{border-color:var(--sp-gold-soft); color:var(--sp-gold)}
  .sp-icobtn.on{border-color:var(--sp-gold); color:var(--sp-gold); background:rgba(232,184,75,.12)}
  #sp-help-btn{position:relative}
  #sp-help-btn .sp-dot{position:absolute; top:-3px; right:-3px; width:9px; height:9px; border-radius:50%; background:#ff4a5a; box-shadow:0 0 7px rgba(255,74,90,.8); animation:tdPulse 1.8s ease-out infinite; pointer-events:none}
  @keyframes tdPulse{0%{box-shadow:0 0 0 0 rgba(232,184,75,.65)} 70%{box-shadow:0 0 0 7px rgba(232,184,75,0)} 100%{box-shadow:0 0 0 0 rgba(232,184,75,0)}}

  /* ── Cuerpo: scroll de pagina. Primera plana = grafica + panel de operar.
     Al bajar aparece la seccion de posiciones/ordenes/historial. ── */
  .sp-body{flex:1 1 auto; min-height:0; overflow-y:auto; position:relative}
  .sp-main{height:100%; min-height:440px; display:grid; grid-template-columns:1fr 322px}
  #sp-overlay.sp-expand .sp-main{grid-template-columns:1fr}
  #sp-overlay.sp-expand .sp-entry{display:none}
  .sp-chart{position:relative; min-width:0; border-right:1px solid var(--sp-line); background:var(--sp-bg); overflow:hidden}
  /* Gráfica completa: la gráfica cubre toda la pantalla, con botón de salir flotante */
  #sp-overlay.sp-expand .sp-chart{position:fixed; inset:0; z-index:11000; border:none}
  .sp-exit{display:none!important; position:absolute; top:12px; right:12px; z-index:12; width:auto!important; height:34px; padding:0 13px; gap:6px; font-family:var(--sp-disp); font-weight:700; font-size:12.5px; background:rgba(14,20,28,.92)}
  #sp-overlay.sp-expand .sp-exit{display:inline-flex!important; align-items:center}
  #sp-overlay.sp-expand .sp-exit svg{width:14px; height:14px}
  .sp-cv{position:absolute; inset:0}
  .sp-fx{position:absolute; inset:0; z-index:4; pointer-events:none}
  .sp-wm{position:absolute; left:64px; bottom:40px; z-index:1; opacity:.82; pointer-events:none}
  .sp-wm img{height:42px; width:auto; filter:drop-shadow(0 2px 9px rgba(0,0,0,.95))}
  .sp-ticket{position:absolute; z-index:6; pointer-events:none; left:12px; font-family:var(--sp-disp); font-weight:800; font-size:12px; padding:5px 11px; border-radius:9px; transform:translateY(-50%); animation:tdTicket 2.4s ease forwards; white-space:nowrap; box-shadow:0 6px 20px rgba(0,0,0,.5)}
  .sp-ticket.long{background:linear-gradient(180deg,#4dffa0,#1fc96e); color:#04210f} .sp-ticket.short{background:linear-gradient(180deg,#ff8a95,#e03546); color:#2a0509} .sp-ticket.gold{background:linear-gradient(180deg,#f7db8d,var(--sp-gold)); color:#2a1d00}
  @keyframes tdTicket{0%{opacity:0; transform:translateY(-50%) translateX(-6px) scale(.9)} 14%{opacity:1; transform:translateY(-50%) translateX(0) scale(1)} 82%{opacity:1} 100%{opacity:0; transform:translateY(-50%) translateX(8px)}}

  /* ── Panel de entrada (llena la primera plana; sliders de capital y apalancamiento) ── */
  .sp-entry{display:flex; flex-direction:column; gap:12px; min-width:0; padding:14px; background:var(--sp-panel); overflow-y:auto}
  /* Slider (barra progresiva) estilo futuros */
  .sp-sld{display:flex; flex-direction:column; gap:7px}
  .sp-sld-top{display:flex; justify-content:space-between; align-items:baseline}
  .sp-sld-top .lbl{font-family:var(--sp-mono); font-size:10.5px; color:var(--sp-ink3); letter-spacing:.04em; text-transform:uppercase}
  .sp-sld-top .val{font-family:var(--sp-disp); font-weight:800; font-size:16px; color:var(--sp-gold)}
  .sp-capedit{display:inline-flex; align-items:baseline; gap:4px}
  .sp-capedit input{width:88px; padding:0 0 1px; border:none; border-bottom:1px dashed rgba(201,168,75,.45); background:transparent; outline:none; text-align:right; font-family:var(--sp-disp); font-weight:800; font-size:16px; color:var(--sp-gold)}
  .sp-capedit input:focus{border-bottom-color:var(--sp-gold)}
  .sp-capedit input::-webkit-outer-spin-button,.sp-capedit input::-webkit-inner-spin-button{-webkit-appearance:none; margin:0}
  .sp-capedit input[type=number]{-moz-appearance:textfield}
  .sp-capedit em{font-style:normal; font-family:var(--sp-mono); font-size:10px; color:var(--sp-ink3)}
  .sp-range{-webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:4px; background:linear-gradient(90deg,var(--sp-gold) 0%,var(--sp-gold) var(--f,20%),#222b36 var(--f,20%),#222b36 100%); outline:none; cursor:pointer}
  .sp-range::-webkit-slider-thumb{-webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:50%; background:#fff; border:3px solid var(--sp-gold); cursor:pointer; box-shadow:0 1px 5px rgba(0,0,0,.5)}
  .sp-range::-moz-range-thumb{width:16px; height:16px; border:3px solid var(--sp-gold); border-radius:50%; background:#fff; cursor:pointer}
  .sp-marks{display:flex; justify-content:space-between; font-family:var(--sp-mono); font-size:9px; color:var(--sp-ink3); margin-top:-1px}
  .sp-marks span{cursor:pointer}
  .sp-modes{display:flex; gap:4px}
  .sp-mode{flex:1; height:32px; border-radius:8px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.03); color:var(--sp-ink2); font-family:var(--sp-mono); font-size:11.5px; font-weight:700}
  .sp-mode.on{background:rgba(232,184,75,.12); border-color:var(--sp-gold); color:var(--sp-gold)}
  .sp-row2{display:flex; gap:7px}
  .sp-levbtn{flex:0 0 auto; width:100%; height:40px; border-radius:9px; border:1px solid var(--sp-line2); background:#0b1017; color:var(--sp-ink); display:flex; align-items:center; justify-content:space-between; padding:0 13px; font-family:var(--sp-mono); font-weight:700; font-size:13px}
  .sp-levbtn:hover{border-color:var(--sp-gold-soft)} .sp-levbtn b{color:var(--sp-gold); font-family:var(--sp-disp); font-size:15px} .sp-levbtn span{color:var(--sp-ink3); font-size:10px}
  /* Selector Long/Short que define la seccion (arriba de Market/Limit) */
  .sp-side{display:grid; grid-template-columns:1fr 1fr; gap:7px}
  .sp-side-b{display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; min-height:50px; border-radius:10px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.03); color:var(--sp-ink2); font-family:var(--sp-disp); font-weight:800; font-size:15px; letter-spacing:.03em; cursor:pointer; transition:border-color .15s,background .15s,color .15s}
  .sp-side-b small{font-family:var(--sp-mono); font-weight:600; font-size:9px; letter-spacing:0; text-transform:none; color:var(--sp-ink3)}
  .sp-side-b:hover{border-color:var(--sp-gold-soft)}
  .sp-side-b.long.on{background:rgba(46,232,106,.12); border-color:var(--sp-up); color:var(--sp-up2)}
  .sp-side-b.short.on{background:rgba(255,91,110,.12); border-color:var(--sp-down); color:var(--sp-down2)}
  .sp-side-b.on small{color:inherit; opacity:.85}
  .sp-side-hint{font-family:var(--sp-mono); font-size:10.5px; line-height:1.5; color:var(--sp-ink3); text-align:center; padding:1px 4px}
  .sp-side-hint b{color:var(--sp-ink2)}
  /* Unidad del Amount: USDT (long) o moneda elegible para short (clicable) */
  .sp-amtunit{border:none; background:transparent; font-family:var(--sp-mono); font-size:11px; font-weight:700; color:var(--sp-ink3); cursor:default; padding:0}
  .sp-amtunit.pick{cursor:pointer; display:inline-flex; align-items:center; gap:4px; height:24px; padding:0 8px; border-radius:7px; border:1px solid var(--sp-line2); background:#141b24; color:var(--sp-gold); font-weight:800}
  .sp-amtunit.pick::after{content:'▾'; font-size:8px; color:var(--sp-ink3)}
  .sp-amtunit.pick:hover{border-color:var(--sp-gold-soft)}
  .sp-avail-row{padding:1px 1px}
  .sp-avail-row .sp-fld-l{text-transform:none; letter-spacing:0}
  .sp-avail-row #sp-avail{color:var(--sp-ink); font-weight:700}
  /* Menu de las monedas disponibles para short */
  .sp-shortmenu{position:fixed; z-index:12050; width:212px; max-height:50vh; overflow-y:auto; padding:6px; border-radius:13px; background:#141b24; border:1px solid var(--sp-line2); box-shadow:0 18px 44px rgba(0,0,0,.6)}
  .sp-shortmenu button{display:flex; align-items:center; justify-content:space-between; gap:9px; width:100%; min-height:38px; padding:0 11px; border-radius:9px; border:1px solid transparent; background:transparent; color:var(--sp-ink2); font-family:var(--sp-mono); font-size:13px}
  .sp-shortmenu button:hover{border-color:#3a424c; background:rgba(255,255,255,.04); color:var(--sp-ink)}
  .sp-shortmenu button.on{color:var(--sp-gold)}
  .sp-shortmenu button .sym{font-weight:800; letter-spacing:.03em}
  .sp-shortmenu button b{color:var(--sp-ink); font-weight:700} .sp-shortmenu button.on b{color:var(--sp-gold)}
  .sp-cm-empty{padding:12px 11px; font-family:var(--sp-mono); font-size:11px; line-height:1.5; color:var(--sp-ink3); text-align:center}
  .sp-fld{display:flex; flex-direction:column; gap:5px}
  .sp-fld-l{font-family:var(--sp-mono); font-size:10px; color:var(--sp-ink3); letter-spacing:.04em; text-transform:uppercase; display:flex; justify-content:space-between; align-items:center}
  .sp-in{display:flex; align-items:center; height:38px; padding:0 4px 0 12px; border-radius:9px; background:#0b1017; border:1px solid var(--sp-line2); gap:6px}
  .sp-in:focus-within{border-color:var(--sp-gold-soft)}
  .sp-in input{flex:1; min-width:0; border:none; background:transparent; outline:none; color:var(--sp-ink); font-family:var(--sp-mono); font-size:14px; font-weight:600}
  .sp-in em{font-style:normal; font-family:var(--sp-mono); font-size:11px; color:var(--sp-ink3); flex:0 0 auto; margin-right:4px}
  .sp-step{display:flex; flex-direction:column; gap:2px; flex:0 0 auto}
  .sp-step button{width:22px; height:16px; border-radius:5px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.04); color:var(--sp-ink2); display:grid; place-items:center; padding:0}
  .sp-step button svg{width:9px; height:9px} .sp-step button:hover{border-color:var(--sp-gold-soft); color:var(--sp-gold)}
  .sp-pcts{display:flex; gap:5px}
  .sp-pct{flex:1; height:25px; border-radius:7px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.03); color:var(--sp-ink2); font-family:var(--sp-mono); font-size:10.5px; font-weight:700}
  .sp-pct:hover{border-color:var(--sp-gold-soft); color:var(--sp-gold)}
  .sp-tpsl{display:flex; gap:7px}
  .sp-tpsl .sp-in{flex:1 1 0; min-width:0; padding:0 10px}
  .sp-tpsl .sp-in em{order:-1; margin-right:2px}
  .sp-tpsl .sp-in{padding:0 4px 0 10px}
  .sp-unit{flex:0 0 auto; width:28px; height:26px; margin-left:2px; border-radius:7px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.05); color:var(--sp-gold); font-family:var(--sp-mono); font-size:12px; font-weight:800; cursor:pointer; display:grid; place-items:center}
  .sp-unit:hover{border-color:var(--sp-gold-soft)}
  .sp-proj{display:flex; gap:7px}
  .sp-proj-c{flex:1 1 0; min-width:0; display:flex; flex-direction:column; gap:1px; padding:8px 11px; border-radius:10px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.02)}
  .sp-proj-c span{font-family:var(--sp-mono); font-size:9px; letter-spacing:.06em; text-transform:uppercase; color:var(--sp-ink3)}
  .sp-proj-c b{font-family:var(--sp-disp); font-weight:800; font-size:17px; line-height:1.1}
  .sp-proj-c i{font-style:normal; font-family:var(--sp-mono); font-size:11px; font-weight:600}
  .sp-proj-c.tp{border-color:rgba(46,232,106,.32); background:rgba(46,232,106,.06)}
  .sp-proj-c.tp b,.sp-proj-c.tp i{color:var(--sp-up2)}
  .sp-proj-c.sl{border-color:rgba(255,91,110,.32); background:rgba(255,91,110,.06)}
  .sp-proj-c.sl b,.sp-proj-c.sl i{color:var(--sp-down2)}
  .sp-cost{display:flex; justify-content:space-between; font-family:var(--sp-mono); font-size:11px; color:var(--sp-ink2)}
  .sp-cost b{color:var(--sp-ink)} .sp-cost .liqv{color:var(--sp-down2)}
  /* Resumen de la orden: rellena el espacio entre Liq y los botones */
  .sp-summary{margin-top:2px; display:flex; flex-direction:column; gap:9px; padding:11px 13px; border-radius:11px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.02)}
  .sp-summary .sp-sum-h{display:flex; justify-content:space-between; align-items:center; width:100%; padding:0; border:none; background:transparent; cursor:pointer; font-family:var(--sp-mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--sp-ink3)}
  .sp-summary .sp-sum-h .cv{font-size:9px; transition:transform .2s}
  .sp-sum-body{display:flex; flex-direction:column; gap:7px}
  .sp-sum-body[hidden]{display:none}
  .sp-summary .sp-sum-row{display:flex; justify-content:space-between; font-family:var(--sp-mono); font-size:12px; color:var(--sp-ink2)}
  .sp-summary .sp-sum-row b{color:var(--sp-ink); font-weight:700}
  .sp-summary .sp-sum-note{margin-top:2px; font-family:var(--sp-mono); font-size:9.5px; line-height:1.5; color:var(--sp-ink3)}
  .sp-ops{display:flex; gap:10px; margin-top:auto; position:sticky; bottom:0; padding-top:12px; padding-bottom:2px; background:var(--sp-panel)}
  .sp-op{flex:1; min-height:46px; border-radius:11px; border:none; font-family:var(--sp-disp); font-weight:800; font-size:16px; letter-spacing:.04em; color:#04210f}
  .sp-op.long{background:linear-gradient(180deg,#4dffa0,#1fc96e); box-shadow:0 3px 0 #11813f}
  .sp-op.short{background:linear-gradient(180deg,#ff8a95,#e03546); color:#2a0509; box-shadow:0 3px 0 #8f1f2a}
  .sp-op:hover{filter:brightness(1.05)} .sp-op:active{transform:translateY(2px); box-shadow:none}
  .sp-op:disabled{opacity:.3; filter:grayscale(.6); box-shadow:none; cursor:not-allowed; transform:none}
  .sp-op:disabled:hover{filter:grayscale(.6)}

  /* ── Panel inferior: aparece al hacer scroll, alto, con lista desplazable (72+ ordenes) ── */
  .sp-pos{flex:0 0 auto; min-height:78vh; display:flex; flex-direction:column; border-top:2px solid var(--sp-line2); background:var(--sp-panel2)}
  #sp-overlay.sp-expand .sp-pos{display:none}
  .sp-pos-hint{display:flex; align-items:center; justify-content:center; gap:7px; height:30px; flex:0 0 auto; font-family:var(--sp-mono); font-size:10.5px; color:var(--sp-ink3); border-bottom:1px solid var(--sp-line); background:rgba(255,255,255,.015)}
  .sp-pos-hint svg{width:13px; height:13px}
  .sp-pos-tabs{display:flex; align-items:center; gap:2px; padding:5px 8px; border-bottom:1px solid var(--sp-line); flex:0 0 auto}
  .sp-pos-tab{height:28px; padding:0 12px; border-radius:7px; border:none; background:transparent; color:var(--sp-ink2); font-family:var(--sp-mono); font-size:11.5px; font-weight:700}
  .sp-pos-tab.on{background:rgba(255,255,255,.06); color:var(--sp-ink)} .sp-pos-tab b{color:var(--sp-gold)}
  .sp-pos-r{margin-left:auto; display:flex; gap:7px; align-items:center; padding-right:4px}
  .sp-stat-chip{font-family:var(--sp-mono); font-size:10.5px; color:var(--sp-ink2)} .sp-stat-chip b{color:var(--sp-ink)} .sp-stat-chip b.up{color:var(--sp-up2)} .sp-stat-chip b.down{color:var(--sp-down2)}
  .sp-pager{display:inline-flex; align-items:center; gap:6px; font-family:var(--sp-mono); font-size:11px; color:var(--sp-ink2)}
  .sp-pager button{min-width:26px; padding:0 7px} .sp-pager button:disabled{opacity:.4; cursor:default}
  /* Botón de certificado: protagonista, centrado y fijo arriba del History */
  .sp-cert-cta{position:sticky; top:0; z-index:3; display:flex; justify-content:center; padding:12px 10px; background:var(--sp-panel2); border-bottom:1px solid var(--sp-line)}
  .sp-cert-btn{display:inline-flex; align-items:center; gap:9px; min-height:46px; padding:0 28px; border-radius:12px; border:1px solid #c79426; background:linear-gradient(180deg,#f7db8d,var(--sp-gold) 55%,#c79426); color:#2a1d00; font-family:var(--sp-disp); font-weight:800; font-size:14px; box-shadow:0 6px 18px rgba(232,184,75,.3)}
  .sp-cert-btn svg{width:17px; height:17px} .sp-cert-btn:hover{filter:brightness(1.05)}
  .sp-pos-body{flex:1 1 auto; min-height:0; overflow:auto}
  .sp-tbl{width:100%; border-collapse:collapse; font-family:var(--sp-mono); font-size:11.5px}
  .sp-tbl th{position:sticky; top:0; background:var(--sp-panel2); text-align:right; padding:6px 13px; color:var(--sp-ink3); font-weight:700; font-size:9.5px; letter-spacing:.05em; text-transform:uppercase; border-bottom:1px solid var(--sp-line); white-space:nowrap; z-index:1}
  .sp-tbl th:first-child,.sp-tbl td:first-child{text-align:left}
  .sp-tbl td{padding:9px 13px; text-align:right; border-bottom:1px solid rgba(27,34,44,.6); white-space:nowrap; color:var(--sp-ink); vertical-align:middle}
  .sp-acts{display:inline-flex; align-items:center; gap:6px; vertical-align:middle}
  .sp-tpsl-c{display:inline-flex; align-items:center; gap:5px; vertical-align:middle}
  .sp-tpsl-c em{font-style:normal}
  .sp-edit{width:22px; height:22px; flex:0 0 auto; display:inline-grid; place-items:center; padding:0; border-radius:6px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.04); color:var(--sp-ink3)}
  .sp-edit svg{width:11px; height:11px} .sp-edit:hover{border-color:var(--sp-gold-soft); color:var(--sp-gold)}
  .sp-tbl tbody tr:hover{background:rgba(255,255,255,.02)}
  .sp-sym{display:inline-flex; align-items:center; gap:7px}
  .sp-sym i{width:18px; height:18px; border-radius:50%; flex:0 0 auto; background:#232b36 center/cover no-repeat; display:inline-grid; place-items:center; font-family:var(--sp-disp); font-weight:800; font-size:8px; color:#c9d1d9}
  .sp-sym i.con{color:transparent}
  .sp-tag{font-family:var(--sp-mono); font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px; letter-spacing:.04em}
  .sp-tag.long{color:var(--sp-up2); background:rgba(46,232,106,.14)} .sp-tag.short{color:var(--sp-down2); background:rgba(255,91,110,.14)}
  .sp-lev-badge{font-family:var(--sp-mono); font-size:9.5px; color:var(--sp-gold); background:rgba(232,184,75,.12); padding:2px 6px; border-radius:4px}
  .sp-pnl.up{color:var(--sp-up2)} .sp-pnl.down{color:var(--sp-down2)} .sp-liq{color:var(--sp-down2)}
  .sp-mini{height:24px; padding:0 8px; border-radius:6px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.04); color:var(--sp-ink2); font-family:var(--sp-mono); font-size:10px; font-weight:700}
  .sp-mini:hover{border-color:var(--sp-gold-soft); color:var(--sp-gold)}
  .sp-x{height:26px; padding:0 11px; border-radius:7px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.04); color:var(--sp-ink2); font-family:var(--sp-mono); font-size:10.5px; font-weight:700}
  .sp-x:hover{border-color:var(--sp-down); color:var(--sp-down2); background:rgba(255,91,110,.08)}
  .sp-share{height:26px; width:28px; border-radius:7px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.04); color:var(--sp-ink2); display:inline-grid; place-items:center; padding:0}
  .sp-share svg{width:13px; height:13px} .sp-share:hover{border-color:var(--sp-gold); color:var(--sp-gold)}
  .sp-empty{padding:22px; text-align:center; color:var(--sp-ink3); font-family:var(--sp-mono); font-size:12px}

  /* ── Popups (monedas, apalancamiento, ayuda, TP/SL) ── */
  .sp-pop{position:fixed; z-index:12000; background:#141b24; border:1px solid var(--sp-line2); border-radius:14px; padding:12px; box-shadow:0 22px 56px rgba(0,0,0,.62)}
  #sp-coinmenu{width:250px; max-height:62vh; overflow-y:auto; padding:6px}
  #sp-coinmenu input{width:100%; height:36px; padding:0 11px; margin-bottom:6px; border-radius:9px; border:1px solid var(--sp-line2); background:#0b1017; color:var(--sp-ink); font-family:var(--sp-mono); font-size:13px; outline:none}
  #sp-coinmenu .it{display:flex; align-items:center; gap:9px; width:100%; min-height:40px; padding:0 10px; border-radius:9px; border:none; background:transparent; color:var(--sp-ink2); font-family:var(--sp-mono); font-size:13px; text-align:left}
  #sp-coinmenu .it:hover{background:rgba(255,255,255,.05); color:var(--sp-ink)} #sp-coinmenu .it.on{color:var(--sp-gold)}
  #sp-coinmenu .it i{width:22px; height:22px; border-radius:50%; flex:0 0 auto; background:#232b36 center/cover no-repeat; display:grid; place-items:center; font-family:var(--sp-disp); font-weight:800; font-size:9px; color:#c9d1d9}
  #sp-coinmenu .it i.con{color:transparent}
  #sp-coinmenu .it b{min-width:50px; color:var(--sp-ink); font-weight:700} #sp-coinmenu .it.on b{color:var(--sp-gold)} #sp-coinmenu .it span{flex:1; color:var(--sp-ink3); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
  #sp-levpop{width:300px}
  #sp-levpop .t{font-family:var(--sp-disp); font-weight:800; font-size:14px; margin-bottom:4px}
  #sp-levpop .big{font-family:var(--sp-disp); font-weight:800; font-size:30px; color:var(--sp-gold); text-align:center; margin:4px 0}
  #sp-levpop input[type=range]{width:100%; accent-color:var(--sp-gold); margin:6px 0}
  #sp-levpop .marks{display:flex; justify-content:space-between; font-family:var(--sp-mono); font-size:9px; color:var(--sp-ink3); margin-bottom:9px}
  #sp-levpop .chips{display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px}
  #sp-levpop .chips button{flex:1 0 auto; min-width:46px; height:30px; border-radius:8px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.04); color:var(--sp-ink2); font-family:var(--sp-mono); font-size:11px; font-weight:700}
  #sp-levpop .chips button.on{background:rgba(232,184,75,.14); border-color:var(--sp-gold); color:var(--sp-gold)}
  #sp-levpop .nota{font-family:var(--sp-mono); font-size:10.5px; color:var(--sp-ink2); margin-bottom:10px} #sp-levpop .nota b{color:var(--sp-ink)}
  #sp-levpop .ok{width:100%; min-height:40px; border-radius:10px; border:1px solid #c79426; background:linear-gradient(180deg,#f7db8d,var(--sp-gold) 55%,#c79426); color:#2a1d00; font-family:var(--sp-disp); font-weight:800; font-size:13px}
  #sp-help{position:fixed; inset:0; z-index:12000; display:flex; align-items:center; justify-content:center; padding:18px; font-family:'Plus Jakarta Sans',sans-serif}
  .sp-hlp-bg{position:absolute; inset:0; background:rgba(3,6,10,.74); backdrop-filter:blur(5px)}
  .sp-hlp-c{position:relative; width:430px; max-width:100%; max-height:92vh; overflow-y:auto; background:#10151d; border:1px solid rgba(232,184,75,.4); border-radius:18px; padding:22px 20px 18px; box-shadow:0 36px 90px rgba(0,0,0,.72)}
  .sp-hlp-x{position:absolute; top:12px; right:12px; width:30px; height:30px; border-radius:9px; border:1px solid var(--sp-line2); background:rgba(0,0,0,.4); color:var(--sp-ink2); cursor:pointer}
  .sp-hlp-x:hover{border-color:var(--sp-down); color:var(--sp-down2)}
  .sp-hlp-eyebrow{text-align:center; font-family:var(--sp-mono); font-size:10px; font-weight:800; letter-spacing:.22em; text-transform:uppercase; color:var(--sp-ink3); margin-bottom:6px}
  .sp-hlp-card{background:linear-gradient(180deg,rgba(232,184,75,.05),transparent 60%); border:1px solid var(--sp-line); border-radius:14px; padding:18px}
  .sp-hlp-n{text-align:center; font-family:var(--sp-mono); font-size:11px; color:var(--sp-ink3); margin-bottom:8px} .sp-hlp-n em{font-style:normal; color:var(--sp-ink2)}
  .sp-hlp-t{text-align:center; font-family:var(--sp-disp); font-weight:800; font-size:20px; color:var(--sp-ink); margin-bottom:12px}
  .sp-hlp-d{font-size:13.5px; line-height:1.6; color:#c3cbd4; text-align:center} .sp-hlp-d b{color:var(--sp-ink); font-weight:800}
  .sp-hlp-x2{margin-top:14px; font-size:12px; line-height:1.5; color:var(--sp-ink3); border-left:2px solid var(--sp-gold); background:rgba(232,184,75,.05); padding:9px 12px; border-radius:0 8px 8px 0}
  .sp-hlp-dots{display:flex; gap:7px; justify-content:center; margin:16px 0} .sp-hlp-dots i{width:7px; height:7px; border-radius:50%; background:var(--sp-line2); cursor:pointer; transition:.2s} .sp-hlp-dots i.on{background:var(--sp-gold); width:20px; border-radius:4px}
  .sp-hlp-acts{display:flex; gap:10px}
  .sp-hlp-back{flex:0 0 auto; padding:0 18px; height:46px; border-radius:11px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.04); color:var(--sp-ink2); font-weight:700; cursor:pointer}
  .sp-hlp-next{flex:1; height:46px; border:0; border-radius:11px; background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426); color:#3a2800; font-family:var(--sp-disp); font-weight:800; font-size:15px; cursor:pointer}

  /* ── Toast / spinner ── */
  .sp-toast{position:fixed; left:50%; bottom:26px; transform:translateX(-50%); z-index:13000; max-width:92vw; padding:12px 18px; border-radius:12px; background:#141b24; border:1px solid var(--sp-line2); color:var(--sp-ink); font-family:var(--sp-mono); font-size:12.5px; box-shadow:0 16px 44px rgba(0,0,0,.6); animation:tdToast .25s ease}
  .sp-toast.ok{border-color:rgba(46,232,106,.5)} .sp-toast.bad{border-color:rgba(255,91,110,.5)} .sp-toast.warn{border-color:rgba(232,184,75,.5)}
  @keyframes tdToast{from{opacity:0; transform:translateX(-50%) translateY(8px)} to{opacity:1; transform:translateX(-50%) translateY(0)}}
  .sp-spin{position:absolute; inset:0; display:grid; place-items:center; background:var(--sp-bg); z-index:7}
  .sp-spin i{width:34px; height:34px; border-radius:50%; border:3px solid rgba(232,184,75,.2); border-top-color:var(--sp-gold); animation:tdGira .7s linear infinite}
  @keyframes tdGira{to{transform:rotate(360deg)}}

  /* ── Modal tarjeta de PnL ── */
  #sp-modal{position:fixed; inset:0; z-index:14000; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(3,6,10,.72); backdrop-filter:blur(4px)}
  #sp-modal .card{position:relative; max-width:600px; width:100%; background:#10151c; border:1px solid var(--sp-line2); border-radius:18px; padding:16px; box-shadow:0 30px 80px rgba(0,0,0,.7); max-height:92vh; overflow-y:auto}
  #sp-modal canvas,#sp-modal img{width:100%; height:auto; border-radius:12px; display:block}
  #sp-modal .acts{display:flex; gap:9px; margin-top:13px; flex-wrap:wrap}
  #sp-modal .acts button{flex:1 1 auto; min-width:120px; min-height:42px; border-radius:11px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.05); color:var(--sp-ink); font-family:var(--sp-disp); font-weight:800; font-size:13px}
  #sp-modal .acts .dl{border-color:#c79426; color:#2a1d00; background:linear-gradient(180deg,#f7db8d,var(--sp-gold) 55%,#c79426)}
  #sp-modal .acts button:hover{filter:brightness(1.05)}

  /* ── Mini-modal generico (editar TP/SL, pedir nombre) ── */
  .sp-sheet{position:fixed; inset:0; z-index:14500; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(3,6,10,.72); backdrop-filter:blur(4px)}
  .sp-sheet .bx{position:relative; width:360px; max-width:100%; background:#141b24; border:1px solid var(--sp-line2); border-radius:16px; padding:18px; box-shadow:0 30px 80px rgba(0,0,0,.7)}
  .sp-sheet h5{margin:0 0 3px; font-family:var(--sp-disp); font-weight:800; font-size:16px; color:var(--sp-ink)}
  .sp-sheet .sub{font-family:var(--sp-mono); font-size:11.5px; color:var(--sp-ink3); margin-bottom:14px}
  .sp-sheet .fld{display:flex; align-items:center; gap:8px; height:46px; padding:0 13px; border-radius:11px; background:#0b1017; border:1px solid var(--sp-line2); margin-bottom:14px}
  .sp-sheet .fld:focus-within{border-color:var(--sp-gold-soft)}
  .sp-sheet .fld input{flex:1; min-width:0; border:none; background:transparent; outline:none; color:var(--sp-ink); font-family:var(--sp-mono); font-size:16px; font-weight:700}
  .sp-sheet .fld .u{font-family:var(--sp-mono); font-size:12px; color:var(--sp-ink3)}
  .sp-sheet .btns{display:flex; gap:10px}
  .sp-sheet .btns button{flex:1; min-height:44px; border-radius:11px; font-family:var(--sp-disp); font-weight:800; font-size:13.5px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.05); color:var(--sp-ink)}
  .sp-sheet .btns .ok{border-color:#c79426; color:#2a1d00; background:linear-gradient(180deg,#f7db8d,var(--sp-gold) 55%,#c79426)}
  .sp-sheet .btns .ok.tp{border-color:#12b06a; background:linear-gradient(180deg,#34d98a,#12b06a); color:#04210f}
  .sp-sheet .btns .ok.sl{border-color:#e03246; background:linear-gradient(180deg,#fb5c6f,#e03246); color:#2a0509}

  /* Menú de clic derecho en la gráfica: copiar precio / poner alerta */
  .sp-ctx{position:fixed; z-index:10020; min-width:170px; padding:8px; border-radius:12px; background:#0e141c; border:1px solid var(--sp-line2); box-shadow:0 18px 44px rgba(0,0,0,.6)}
  .sp-ctx-px{font-family:var(--sp-disp); font-weight:800; font-size:16px; color:var(--sp-ink); padding:3px 6px 0}
  .sp-ctx-sub{font-family:var(--sp-mono); font-size:10.5px; padding:0 6px 7px; color:var(--sp-ink3)}
  .sp-ctx-sub.up{color:var(--sp-up2)} .sp-ctx-sub.down{color:var(--sp-down2)}
  .sp-ctx-b{display:block; width:100%; text-align:left; height:34px; padding:0 10px; margin-top:4px; border-radius:8px; border:1px solid var(--sp-line2); background:rgba(255,255,255,.03); color:var(--sp-ink); font-family:var(--sp-mono); font-size:12.5px; font-weight:600; cursor:pointer}
  .sp-ctx-b:hover{border-color:var(--sp-gold-soft); color:var(--sp-gold)}
  .sp-ctx-b.alert:hover{border-color:#5ec8e8; color:#5ec8e8}

  /* ── Responsivo ── */
  @media (max-width:980px){
    .sp-main{display:block; height:auto; min-height:0}
    #sp-overlay.sp-expand .sp-main{display:block}
    .sp-chart{height:60vh; border-right:none; border-bottom:1px solid var(--sp-line)}
    .sp-pos{min-height:auto}
    .sp-ops{position:static; margin-top:12px}
  }
  @media (max-width:560px){
    .sp-top{height:auto; flex-wrap:wrap; padding:8px 10px; gap:7px}
    .sp-coin{order:2} .sp-tf{order:3} .sp-px{order:4} .sp-wallet{order:5; margin-left:auto}
    .sp-chart{height:52vh} .sp-ops .sp-op{font-size:15px}
  }`;
  document.head.appendChild(s);
}
