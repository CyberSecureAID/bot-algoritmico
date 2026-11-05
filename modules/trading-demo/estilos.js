/* modules/trading-demo/estilos.js — Skin del Trading Demo.
   Futuros estilo Binance con la paleta de DecFreedom: gráfica grande, panel de
   entrada compacto (sin scroll), posiciones abajo, apalancamiento tipo Binance,
   TP/SL arrastrables en la gráfica y tarjeta de PnL. Autónomo y responsivo. */

export function estilos() {
  if (document.getElementById('td-css')) { return; }
  const s = document.createElement('style'); s.id = 'td-css';
  s.textContent = `
  :root{ --td-gold:#E8B84B; --td-gold-soft:#C9A84B; --td-up:#2ee86a; --td-up2:#3ee88a; --td-down:#ff5b6e; --td-down2:#ff6b7a;
    --td-bg:#0a0d12; --td-panel:#0e141c; --td-panel2:#10151c; --td-line:#1b222c; --td-line2:#242d38;
    --td-ink:#eaecef; --td-ink2:#9aa4af; --td-ink3:#6b7580; --td-mono:'IBM Plex Mono',ui-monospace,Consolas,monospace; --td-disp:'Chakra Petch',system-ui,sans-serif; }
  #td-overlay{position:fixed; inset:0; z-index:10000; background:var(--td-bg); color:var(--td-ink); display:flex; flex-direction:column; font-family:'Plus Jakarta Sans',system-ui,sans-serif; overflow:hidden; -webkit-text-size-adjust:100%}
  #td-overlay *{box-sizing:border-box}
  #td-overlay button{font-family:inherit; cursor:pointer}
  #td-overlay input[type=number]{-moz-appearance:textfield}
  #td-overlay input[type=number]::-webkit-outer-spin-button,#td-overlay input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none; margin:0}

  /* ── Barra superior ── */
  .td-top{display:flex; align-items:center; gap:10px; flex:0 0 auto; height:52px; padding:0 12px; background:linear-gradient(180deg,#0e141c,#0a0e14); border-bottom:1px solid var(--td-line); position:relative; z-index:20}
  .td-back{display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 11px 0 8px; border-radius:9px; flex:0 0 auto; font-family:var(--td-disp); font-weight:700; font-size:12.5px; color:#8b96a3; background:rgba(255,255,255,.05); border:1px solid var(--td-line2)}
  .td-back svg{width:12px; height:12px} .td-back:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}
  .td-demo{font-family:var(--td-mono); font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:#3ee88a; background:rgba(46,232,106,.14); border:1px solid rgba(46,232,106,.45); border-radius:100px; padding:4px 10px; flex:0 0 auto}
  .td-coin{display:inline-flex; align-items:center; gap:8px; height:36px; padding:0 12px 0 6px; border-radius:10px; flex:0 0 auto; background:#141b24; border:1px solid var(--td-line2); color:var(--td-ink); font-family:var(--td-mono); font-weight:700; font-size:14px}
  .td-coin:hover{border-color:var(--td-gold-soft)}
  .td-coin i{width:24px; height:24px; border-radius:50%; flex:0 0 auto; background:#232b36 center/cover no-repeat; display:grid; place-items:center; font-family:var(--td-disp); font-weight:800; font-size:11px; color:#c9d1d9; border:1px solid rgba(255,255,255,.08)}
  .td-coin i.con{color:transparent; border-color:transparent}
  .td-coin svg{width:12px; height:12px; opacity:.6}
  /* Temporalidad: dropdown, como el resto de secciones */
  .td-tf{position:relative; flex:0 0 auto}
  .td-tf .cur{display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 11px; border-radius:9px; background:#141b24; border:1px solid var(--td-line2); color:var(--td-ink); font-family:var(--td-mono); font-weight:700; font-size:12.5px}
  .td-tf .cur:hover{border-color:var(--td-gold-soft)} .td-tf .cur .cv{color:var(--td-ink3); font-size:9px}
  .td-tf .menu{position:absolute; top:40px; left:0; z-index:60; display:none; grid-template-columns:1fr 1fr 1fr; gap:5px; min-width:208px; padding:6px; border-radius:13px; background:#141b24; border:1px solid var(--td-line2); box-shadow:0 18px 44px rgba(0,0,0,.6)}
  .td-tf.open .menu{display:grid}
  .td-tf .menu button{min-height:38px; border-radius:9px; border:1px solid transparent; background:rgba(255,255,255,.04); color:#c7cdd6; font-family:var(--td-mono); font-weight:700; font-size:12.5px}
  .td-tf .menu button:hover{border-color:#3a424c; color:var(--td-ink)} .td-tf .menu button.on{background:linear-gradient(180deg,#f7db8d,var(--td-gold) 55%,#c79426); color:#2a1d00; border-color:var(--td-gold)}
  .td-px{display:flex; flex-direction:column; justify-content:center; flex:0 0 auto; min-width:116px}
  .td-px-big{font-family:var(--td-disp); font-weight:800; font-size:20px; line-height:1.05; letter-spacing:.3px; transition:color .15s}
  .td-px-big.up{color:var(--td-up2)} .td-px-big.down{color:var(--td-down2)}
  .td-px-sub{font-family:var(--td-mono); font-size:10px; color:var(--td-ink3)}
  .td-stats{display:flex; gap:15px; flex:1 1 auto; overflow:hidden; min-width:0}
  .td-stat{display:flex; flex-direction:column; gap:1px; flex:0 0 auto}
  .td-stat b{font-family:var(--td-mono); font-size:9px; letter-spacing:.07em; text-transform:uppercase; color:var(--td-ink3); font-weight:700}
  .td-stat span{font-family:var(--td-mono); font-size:12px; color:var(--td-ink); font-weight:600}
  .td-stat span.up{color:var(--td-up2)} .td-stat span.down{color:var(--td-down2)}
  .td-wallet{display:flex; flex-direction:column; align-items:flex-end; gap:0; flex:0 0 auto; margin-left:auto}
  .td-wallet b{font-family:var(--td-mono); font-size:9px; letter-spacing:.07em; text-transform:uppercase; color:var(--td-ink3)}
  .td-wallet .eq{font-family:var(--td-disp); font-weight:800; font-size:17px; color:var(--td-gold); line-height:1.15; transition:color .15s}
  .td-wallet .eq.up{color:var(--td-up2)} .td-wallet .eq.down{color:var(--td-down2)}
  .td-wallet small{font-family:var(--td-mono); font-size:10px; color:var(--td-ink2)}
  .td-icobtn{height:36px; min-width:36px; padding:0 9px; border-radius:9px; flex:0 0 auto; display:inline-grid; place-items:center; color:#8b96a3; background:rgba(255,255,255,.05); border:1px solid var(--td-line2)}
  .td-icobtn svg{width:15px; height:15px} .td-icobtn:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}
  .td-icobtn.on{border-color:var(--td-gold); color:var(--td-gold); background:rgba(232,184,75,.12)}
  #td-help-btn{position:relative}
  #td-help-btn .td-dot{position:absolute; top:-3px; right:-3px; width:9px; height:9px; border-radius:50%; background:var(--td-gold); animation:tdPulse 1.8s ease-out infinite; pointer-events:none}
  @keyframes tdPulse{0%{box-shadow:0 0 0 0 rgba(232,184,75,.65)} 70%{box-shadow:0 0 0 7px rgba(232,184,75,0)} 100%{box-shadow:0 0 0 0 rgba(232,184,75,0)}}

  /* ── Cuerpo: scroll de pagina. Primera plana = grafica + panel de operar.
     Al bajar aparece la seccion de posiciones/ordenes/historial. ── */
  .td-body{flex:1 1 auto; min-height:0; overflow-y:auto; position:relative}
  .td-main{height:100%; min-height:440px; display:grid; grid-template-columns:1fr 322px}
  #td-overlay.td-expand .td-main{grid-template-columns:1fr}
  #td-overlay.td-expand .td-entry{display:none}
  .td-chart{position:relative; min-width:0; border-right:1px solid var(--td-line); background:var(--td-bg); overflow:hidden}
  /* Gráfica completa: la gráfica cubre toda la pantalla, con botón de salir flotante */
  #td-overlay.td-expand .td-chart{position:fixed; inset:0; z-index:11000; border:none}
  .td-exit{display:none!important; position:absolute; top:12px; right:12px; z-index:12; width:auto!important; height:34px; padding:0 13px; gap:6px; font-family:var(--td-disp); font-weight:700; font-size:12.5px; background:rgba(14,20,28,.92)}
  #td-overlay.td-expand .td-exit{display:inline-flex!important; align-items:center}
  #td-overlay.td-expand .td-exit svg{width:14px; height:14px}
  .td-cv{position:absolute; inset:0}
  .td-fx{position:absolute; inset:0; z-index:4; pointer-events:none}
  .td-wm{position:absolute; left:64px; bottom:40px; z-index:1; opacity:.82; pointer-events:none}
  .td-wm img{height:42px; width:auto; filter:drop-shadow(0 2px 9px rgba(0,0,0,.95))}
  /* La barra de herramientas no debe pisar el eje de fechas (abajo) ni el de
     precios: se limita su alto para que quede siempre dentro del área de velas. */
  #td-chart .nv-tools{max-height:calc(100% - 88px)!important}
  .td-ticket{position:absolute; z-index:6; pointer-events:none; left:12px; font-family:var(--td-disp); font-weight:800; font-size:12px; padding:5px 11px; border-radius:9px; transform:translateY(-50%); animation:tdTicket 2.4s ease forwards; white-space:nowrap; box-shadow:0 6px 20px rgba(0,0,0,.5)}
  .td-ticket.long{background:linear-gradient(180deg,#4dffa0,#1fc96e); color:#04210f} .td-ticket.short{background:linear-gradient(180deg,#ff8a95,#e03546); color:#2a0509} .td-ticket.gold{background:linear-gradient(180deg,#f7db8d,var(--td-gold)); color:#2a1d00}
  @keyframes tdTicket{0%{opacity:0; transform:translateY(-50%) translateX(-6px) scale(.9)} 14%{opacity:1; transform:translateY(-50%) translateX(0) scale(1)} 82%{opacity:1} 100%{opacity:0; transform:translateY(-50%) translateX(8px)}}

  /* ── Panel de entrada (llena la primera plana; sliders de capital y apalancamiento) ── */
  .td-entry{display:flex; flex-direction:column; gap:12px; min-width:0; padding:14px; background:var(--td-panel); overflow-y:auto}
  /* Slider (barra progresiva) estilo futuros */
  .td-sld{display:flex; flex-direction:column; gap:7px}
  .td-sld-top{display:flex; justify-content:space-between; align-items:baseline}
  .td-sld-top .lbl{font-family:var(--td-mono); font-size:10.5px; color:var(--td-ink3); letter-spacing:.04em; text-transform:uppercase}
  .td-sld-top .val{font-family:var(--td-disp); font-weight:800; font-size:16px; color:var(--td-gold)}
  .td-range{-webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:4px; background:linear-gradient(90deg,var(--td-gold) 0%,var(--td-gold) var(--f,20%),#222b36 var(--f,20%),#222b36 100%); outline:none; cursor:pointer}
  .td-range::-webkit-slider-thumb{-webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:50%; background:#fff; border:3px solid var(--td-gold); cursor:pointer; box-shadow:0 1px 5px rgba(0,0,0,.5)}
  .td-range::-moz-range-thumb{width:16px; height:16px; border:3px solid var(--td-gold); border-radius:50%; background:#fff; cursor:pointer}
  .td-marks{display:flex; justify-content:space-between; font-family:var(--td-mono); font-size:9px; color:var(--td-ink3); margin-top:-1px}
  .td-marks span{cursor:pointer}
  .td-modes{display:flex; gap:4px}
  .td-mode{flex:1; height:32px; border-radius:8px; border:1px solid var(--td-line2); background:rgba(255,255,255,.03); color:var(--td-ink2); font-family:var(--td-mono); font-size:11.5px; font-weight:700}
  .td-mode.on{background:rgba(232,184,75,.12); border-color:var(--td-gold); color:var(--td-gold)}
  .td-row2{display:flex; gap:7px}
  .td-levbtn{flex:0 0 auto; width:100%; height:40px; border-radius:9px; border:1px solid var(--td-line2); background:#0b1017; color:var(--td-ink); display:flex; align-items:center; justify-content:space-between; padding:0 13px; font-family:var(--td-mono); font-weight:700; font-size:13px}
  .td-levbtn:hover{border-color:var(--td-gold-soft)} .td-levbtn b{color:var(--td-gold); font-family:var(--td-disp); font-size:15px} .td-levbtn span{color:var(--td-ink3); font-size:10px}
  .td-fld{display:flex; flex-direction:column; gap:5px}
  .td-fld-l{font-family:var(--td-mono); font-size:10px; color:var(--td-ink3); letter-spacing:.04em; text-transform:uppercase; display:flex; justify-content:space-between; align-items:center}
  .td-in{display:flex; align-items:center; height:38px; padding:0 4px 0 12px; border-radius:9px; background:#0b1017; border:1px solid var(--td-line2); gap:6px}
  .td-in:focus-within{border-color:var(--td-gold-soft)}
  .td-in input{flex:1; min-width:0; border:none; background:transparent; outline:none; color:var(--td-ink); font-family:var(--td-mono); font-size:14px; font-weight:600}
  .td-in em{font-style:normal; font-family:var(--td-mono); font-size:11px; color:var(--td-ink3); flex:0 0 auto}
  .td-step{display:flex; flex-direction:column; gap:2px; flex:0 0 auto}
  .td-step button{width:22px; height:16px; border-radius:5px; border:1px solid var(--td-line2); background:rgba(255,255,255,.04); color:var(--td-ink2); display:grid; place-items:center; padding:0}
  .td-step button svg{width:9px; height:9px} .td-step button:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}
  .td-pcts{display:flex; gap:5px}
  .td-pct{flex:1; height:25px; border-radius:7px; border:1px solid var(--td-line2); background:rgba(255,255,255,.03); color:var(--td-ink2); font-family:var(--td-mono); font-size:10.5px; font-weight:700}
  .td-pct:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}
  .td-tpsl{display:flex; gap:7px}
  .td-tpsl .td-in{flex:1 1 0; min-width:0; padding:0 10px}
  .td-tpsl .td-in em{order:-1; margin-right:2px}
  .td-cost{display:flex; justify-content:space-between; font-family:var(--td-mono); font-size:11px; color:var(--td-ink2)}
  .td-cost b{color:var(--td-ink)} .td-cost .liqv{color:var(--td-down2)}
  /* Resumen de la orden: rellena el espacio entre Liq y los botones */
  .td-summary{flex:1 1 auto; min-height:92px; display:flex; flex-direction:column; gap:7px; padding:12px 13px; border-radius:11px; border:1px solid var(--td-line2); background:rgba(255,255,255,.02)}
  .td-summary .td-sum-h{font-family:var(--td-mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--td-ink3)}
  .td-summary .td-sum-row{display:flex; justify-content:space-between; font-family:var(--td-mono); font-size:12px; color:var(--td-ink2)}
  .td-summary .td-sum-row b{color:var(--td-ink); font-weight:700}
  .td-summary .td-sum-note{margin-top:auto; font-family:var(--td-mono); font-size:9.5px; line-height:1.5; color:var(--td-ink3)}
  .td-ops{display:flex; gap:10px; margin-top:auto; position:sticky; bottom:0; padding-top:12px; padding-bottom:2px; background:var(--td-panel)}
  .td-op{flex:1; min-height:46px; border-radius:11px; border:none; font-family:var(--td-disp); font-weight:800; font-size:16px; letter-spacing:.04em; color:#04210f}
  .td-op.long{background:linear-gradient(180deg,#4dffa0,#1fc96e); box-shadow:0 3px 0 #11813f}
  .td-op.short{background:linear-gradient(180deg,#ff8a95,#e03546); color:#2a0509; box-shadow:0 3px 0 #8f1f2a}
  .td-op:hover{filter:brightness(1.05)} .td-op:active{transform:translateY(2px); box-shadow:none}

  /* ── Panel inferior: aparece al hacer scroll, alto, con lista desplazable (72+ ordenes) ── */
  .td-pos{flex:0 0 auto; min-height:78vh; display:flex; flex-direction:column; border-top:2px solid var(--td-line2); background:var(--td-panel2)}
  #td-overlay.td-expand .td-pos{display:none}
  .td-pos-hint{display:flex; align-items:center; justify-content:center; gap:7px; height:30px; flex:0 0 auto; font-family:var(--td-mono); font-size:10.5px; color:var(--td-ink3); border-bottom:1px solid var(--td-line); background:rgba(255,255,255,.015)}
  .td-pos-hint svg{width:13px; height:13px}
  .td-pos-tabs{display:flex; align-items:center; gap:2px; padding:5px 8px; border-bottom:1px solid var(--td-line); flex:0 0 auto}
  .td-pos-tab{height:28px; padding:0 12px; border-radius:7px; border:none; background:transparent; color:var(--td-ink2); font-family:var(--td-mono); font-size:11.5px; font-weight:700}
  .td-pos-tab.on{background:rgba(255,255,255,.06); color:var(--td-ink)} .td-pos-tab b{color:var(--td-gold)}
  .td-pos-r{margin-left:auto; display:flex; gap:7px; align-items:center; padding-right:4px}
  .td-stat-chip{font-family:var(--td-mono); font-size:10.5px; color:var(--td-ink2)} .td-stat-chip b{color:var(--td-ink)} .td-stat-chip b.up{color:var(--td-up2)} .td-stat-chip b.down{color:var(--td-down2)}
  .td-pager{display:inline-flex; align-items:center; gap:6px; font-family:var(--td-mono); font-size:11px; color:var(--td-ink2)}
  .td-pager button{min-width:26px; padding:0 7px} .td-pager button:disabled{opacity:.4; cursor:default}
  /* Botón de certificado: protagonista, centrado y fijo arriba del History */
  .td-cert-cta{position:sticky; top:0; z-index:3; display:flex; justify-content:center; padding:12px 10px; background:var(--td-panel2); border-bottom:1px solid var(--td-line)}
  .td-cert-btn{display:inline-flex; align-items:center; gap:9px; min-height:46px; padding:0 28px; border-radius:12px; border:1px solid #c79426; background:linear-gradient(180deg,#f7db8d,var(--td-gold) 55%,#c79426); color:#2a1d00; font-family:var(--td-disp); font-weight:800; font-size:14px; box-shadow:0 6px 18px rgba(232,184,75,.3)}
  .td-cert-btn svg{width:17px; height:17px} .td-cert-btn:hover{filter:brightness(1.05)}
  .td-pos-body{flex:1 1 auto; min-height:0; overflow:auto}
  .td-tbl{width:100%; border-collapse:collapse; font-family:var(--td-mono); font-size:11.5px}
  .td-tbl th{position:sticky; top:0; background:var(--td-panel2); text-align:right; padding:6px 13px; color:var(--td-ink3); font-weight:700; font-size:9.5px; letter-spacing:.05em; text-transform:uppercase; border-bottom:1px solid var(--td-line); white-space:nowrap; z-index:1}
  .td-tbl th:first-child,.td-tbl td:first-child{text-align:left}
  .td-tbl td{padding:9px 13px; text-align:right; border-bottom:1px solid rgba(27,34,44,.6); white-space:nowrap; color:var(--td-ink); vertical-align:middle}
  .td-acts{display:inline-flex; align-items:center; gap:6px; vertical-align:middle}
  .td-tpsl-c{display:inline-flex; align-items:center; gap:5px; vertical-align:middle}
  .td-tpsl-c em{font-style:normal}
  .td-edit{width:22px; height:22px; flex:0 0 auto; display:inline-grid; place-items:center; padding:0; border-radius:6px; border:1px solid var(--td-line2); background:rgba(255,255,255,.04); color:var(--td-ink3)}
  .td-edit svg{width:11px; height:11px} .td-edit:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}
  .td-tbl tbody tr:hover{background:rgba(255,255,255,.02)}
  .td-sym{display:inline-flex; align-items:center; gap:7px}
  .td-sym i{width:18px; height:18px; border-radius:50%; flex:0 0 auto; background:#232b36 center/cover no-repeat; display:inline-grid; place-items:center; font-family:var(--td-disp); font-weight:800; font-size:8px; color:#c9d1d9}
  .td-sym i.con{color:transparent}
  .td-tag{font-family:var(--td-mono); font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px; letter-spacing:.04em}
  .td-tag.long{color:var(--td-up2); background:rgba(46,232,106,.14)} .td-tag.short{color:var(--td-down2); background:rgba(255,91,110,.14)}
  .td-lev-badge{font-family:var(--td-mono); font-size:9.5px; color:var(--td-gold); background:rgba(232,184,75,.12); padding:2px 6px; border-radius:4px}
  .td-pnl.up{color:var(--td-up2)} .td-pnl.down{color:var(--td-down2)} .td-liq{color:var(--td-down2)}
  .td-mini{height:24px; padding:0 8px; border-radius:6px; border:1px solid var(--td-line2); background:rgba(255,255,255,.04); color:var(--td-ink2); font-family:var(--td-mono); font-size:10px; font-weight:700}
  .td-mini:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}
  .td-x{height:26px; padding:0 11px; border-radius:7px; border:1px solid var(--td-line2); background:rgba(255,255,255,.04); color:var(--td-ink2); font-family:var(--td-mono); font-size:10.5px; font-weight:700}
  .td-x:hover{border-color:var(--td-down); color:var(--td-down2); background:rgba(255,91,110,.08)}
  .td-share{height:26px; width:28px; border-radius:7px; border:1px solid var(--td-line2); background:rgba(255,255,255,.04); color:var(--td-ink2); display:inline-grid; place-items:center; padding:0}
  .td-share svg{width:13px; height:13px} .td-share:hover{border-color:var(--td-gold); color:var(--td-gold)}
  .td-empty{padding:22px; text-align:center; color:var(--td-ink3); font-family:var(--td-mono); font-size:12px}

  /* ── Popups (monedas, apalancamiento, ayuda, TP/SL) ── */
  .td-pop{position:fixed; z-index:12000; background:#141b24; border:1px solid var(--td-line2); border-radius:14px; padding:12px; box-shadow:0 22px 56px rgba(0,0,0,.62)}
  #td-coinmenu{width:250px; max-height:62vh; overflow-y:auto; padding:6px}
  #td-coinmenu input{width:100%; height:36px; padding:0 11px; margin-bottom:6px; border-radius:9px; border:1px solid var(--td-line2); background:#0b1017; color:var(--td-ink); font-family:var(--td-mono); font-size:13px; outline:none}
  #td-coinmenu .it{display:flex; align-items:center; gap:9px; width:100%; min-height:40px; padding:0 10px; border-radius:9px; border:none; background:transparent; color:var(--td-ink2); font-family:var(--td-mono); font-size:13px; text-align:left}
  #td-coinmenu .it:hover{background:rgba(255,255,255,.05); color:var(--td-ink)} #td-coinmenu .it.on{color:var(--td-gold)}
  #td-coinmenu .it i{width:22px; height:22px; border-radius:50%; flex:0 0 auto; background:#232b36 center/cover no-repeat; display:grid; place-items:center; font-family:var(--td-disp); font-weight:800; font-size:9px; color:#c9d1d9}
  #td-coinmenu .it i.con{color:transparent}
  #td-coinmenu .it b{min-width:50px; color:var(--td-ink); font-weight:700} #td-coinmenu .it.on b{color:var(--td-gold)} #td-coinmenu .it span{flex:1; color:var(--td-ink3); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
  #td-levpop{width:300px}
  #td-levpop .t{font-family:var(--td-disp); font-weight:800; font-size:14px; margin-bottom:4px}
  #td-levpop .big{font-family:var(--td-disp); font-weight:800; font-size:30px; color:var(--td-gold); text-align:center; margin:4px 0}
  #td-levpop input[type=range]{width:100%; accent-color:var(--td-gold); margin:6px 0}
  #td-levpop .marks{display:flex; justify-content:space-between; font-family:var(--td-mono); font-size:9px; color:var(--td-ink3); margin-bottom:9px}
  #td-levpop .chips{display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px}
  #td-levpop .chips button{flex:1 0 auto; min-width:46px; height:30px; border-radius:8px; border:1px solid var(--td-line2); background:rgba(255,255,255,.04); color:var(--td-ink2); font-family:var(--td-mono); font-size:11px; font-weight:700}
  #td-levpop .chips button.on{background:rgba(232,184,75,.14); border-color:var(--td-gold); color:var(--td-gold)}
  #td-levpop .nota{font-family:var(--td-mono); font-size:10.5px; color:var(--td-ink2); margin-bottom:10px} #td-levpop .nota b{color:var(--td-ink)}
  #td-levpop .ok{width:100%; min-height:40px; border-radius:10px; border:1px solid #c79426; background:linear-gradient(180deg,#f7db8d,var(--td-gold) 55%,#c79426); color:#2a1d00; font-family:var(--td-disp); font-weight:800; font-size:13px}
  #td-help{position:fixed; inset:0; z-index:12000; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(3,6,10,.72); backdrop-filter:blur(4px); font-family:'Plus Jakarta Sans',sans-serif}
  #td-help .box{position:relative; width:340px; max-width:100%; max-height:84vh; overflow-y:auto; background:#141b24; border:1px solid var(--td-line2); border-radius:16px; padding:18px; box-shadow:0 30px 80px rgba(0,0,0,.7)}
  #td-help h4{font-family:var(--td-disp); font-weight:800; font-size:15px; margin:0 0 12px; color:var(--td-gold)}
  #td-help .st{display:flex; gap:9px; margin-bottom:10px} #td-help .st b{flex:0 0 auto; width:20px; height:20px; border-radius:50%; background:var(--td-gold); color:#2a1d00; font-family:var(--td-disp); font-weight:800; font-size:11px; display:grid; place-items:center}
  #td-help .st div{font-size:12.5px; color:#c3cbd4; line-height:1.52} #td-help .st div em{font-style:normal; color:var(--td-ink)}
  #td-help .pie{font-family:var(--td-mono); font-size:10px; color:var(--td-ink3); border-top:1px solid var(--td-line); padding-top:9px; margin-top:4px}
  #td-help .x{position:absolute; top:11px; right:11px; width:28px; height:28px; border-radius:8px; border:1px solid var(--td-line2); background:rgba(0,0,0,.4); color:var(--td-ink2)}
  #td-help .x:hover{border-color:var(--td-down); color:var(--td-down2)}

  /* ── Toast / spinner ── */
  .td-toast{position:fixed; left:50%; bottom:26px; transform:translateX(-50%); z-index:13000; max-width:92vw; padding:12px 18px; border-radius:12px; background:#141b24; border:1px solid var(--td-line2); color:var(--td-ink); font-family:var(--td-mono); font-size:12.5px; box-shadow:0 16px 44px rgba(0,0,0,.6); animation:tdToast .25s ease}
  .td-toast.ok{border-color:rgba(46,232,106,.5)} .td-toast.bad{border-color:rgba(255,91,110,.5)} .td-toast.warn{border-color:rgba(232,184,75,.5)}
  @keyframes tdToast{from{opacity:0; transform:translateX(-50%) translateY(8px)} to{opacity:1; transform:translateX(-50%) translateY(0)}}
  .td-spin{position:absolute; inset:0; display:grid; place-items:center; background:var(--td-bg); z-index:7}
  .td-spin i{width:34px; height:34px; border-radius:50%; border:3px solid rgba(232,184,75,.2); border-top-color:var(--td-gold); animation:tdGira .7s linear infinite}
  @keyframes tdGira{to{transform:rotate(360deg)}}

  /* ── Modal tarjeta de PnL ── */
  #td-modal{position:fixed; inset:0; z-index:14000; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(3,6,10,.72); backdrop-filter:blur(4px)}
  #td-modal .card{position:relative; max-width:600px; width:100%; background:#10151c; border:1px solid var(--td-line2); border-radius:18px; padding:16px; box-shadow:0 30px 80px rgba(0,0,0,.7); max-height:92vh; overflow-y:auto}
  #td-modal canvas,#td-modal img{width:100%; height:auto; border-radius:12px; display:block}
  #td-modal .acts{display:flex; gap:9px; margin-top:13px; flex-wrap:wrap}
  #td-modal .acts button{flex:1 1 auto; min-width:120px; min-height:42px; border-radius:11px; border:1px solid var(--td-line2); background:rgba(255,255,255,.05); color:var(--td-ink); font-family:var(--td-disp); font-weight:800; font-size:13px}
  #td-modal .acts .dl{border-color:#c79426; color:#2a1d00; background:linear-gradient(180deg,#f7db8d,var(--td-gold) 55%,#c79426)}
  #td-modal .acts button:hover{filter:brightness(1.05)}

  /* ── Mini-modal generico (editar TP/SL, pedir nombre) ── */
  .td-sheet{position:fixed; inset:0; z-index:14500; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(3,6,10,.72); backdrop-filter:blur(4px)}
  .td-sheet .bx{position:relative; width:360px; max-width:100%; background:#141b24; border:1px solid var(--td-line2); border-radius:16px; padding:18px; box-shadow:0 30px 80px rgba(0,0,0,.7)}
  .td-sheet h5{margin:0 0 3px; font-family:var(--td-disp); font-weight:800; font-size:16px; color:var(--td-ink)}
  .td-sheet .sub{font-family:var(--td-mono); font-size:11.5px; color:var(--td-ink3); margin-bottom:14px}
  .td-sheet .fld{display:flex; align-items:center; gap:8px; height:46px; padding:0 13px; border-radius:11px; background:#0b1017; border:1px solid var(--td-line2); margin-bottom:14px}
  .td-sheet .fld:focus-within{border-color:var(--td-gold-soft)}
  .td-sheet .fld input{flex:1; min-width:0; border:none; background:transparent; outline:none; color:var(--td-ink); font-family:var(--td-mono); font-size:16px; font-weight:700}
  .td-sheet .fld .u{font-family:var(--td-mono); font-size:12px; color:var(--td-ink3)}
  .td-sheet .btns{display:flex; gap:10px}
  .td-sheet .btns button{flex:1; min-height:44px; border-radius:11px; font-family:var(--td-disp); font-weight:800; font-size:13.5px; border:1px solid var(--td-line2); background:rgba(255,255,255,.05); color:var(--td-ink)}
  .td-sheet .btns .ok{border-color:#c79426; color:#2a1d00; background:linear-gradient(180deg,#f7db8d,var(--td-gold) 55%,#c79426)}
  .td-sheet .btns .ok.tp{border-color:#12b06a; background:linear-gradient(180deg,#34d98a,#12b06a); color:#04210f}
  .td-sheet .btns .ok.sl{border-color:#e03246; background:linear-gradient(180deg,#fb5c6f,#e03246); color:#2a0509}

  /* ── Responsivo ── */
  @media (max-width:980px){
    .td-main{display:block; height:auto; min-height:0}
    #td-overlay.td-expand .td-main{display:block}
    .td-chart{height:60vh; border-right:none; border-bottom:1px solid var(--td-line)}
    .td-stats{display:none}
    .td-pos{min-height:auto}
    .td-ops{position:static; margin-top:12px}
  }
  @media (max-width:560px){
    .td-top{height:auto; flex-wrap:wrap; padding:8px 10px; gap:7px}
    .td-coin{order:2} .td-tf{order:3} .td-px{order:4} .td-wallet{order:5; margin-left:auto}
    .td-chart{height:52vh} .td-ops .td-op{font-size:15px}
  }`;
  document.head.appendChild(s);
}
