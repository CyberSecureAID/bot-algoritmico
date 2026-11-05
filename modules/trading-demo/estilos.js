/* modules/trading-demo/estilos.js — Skin del Trading Demo.
   Layout tipo Binance Futures (gráfica ancha + panel de entrada + posiciones)
   con la paleta de DecFreedom. Sin libro de órdenes. Autónomo y responsivo. */

export function estilos() {
  if (document.getElementById('td-css')) { return; }
  const s = document.createElement('style'); s.id = 'td-css';
  s.textContent = `
  :root{ --td-gold:#E8B84B; --td-gold-soft:#C9A84B; --td-gold-hi:#f4d089; --td-up:#2ee86a; --td-up2:#3ee88a; --td-down:#ff5b6e; --td-down2:#ff6b7a;
    --td-bg:#0a0d12; --td-panel:#0e141c; --td-panel2:#10151c; --td-line:#1b222c; --td-line2:#242d38;
    --td-ink:#eaecef; --td-ink2:#9aa4af; --td-ink3:#6b7580; --td-mono:'IBM Plex Mono',ui-monospace,Consolas,monospace; --td-disp:'Chakra Petch',system-ui,sans-serif; }
  #td-overlay{position:fixed; inset:0; z-index:10000; background:var(--td-bg); color:var(--td-ink);
    display:flex; flex-direction:column; font-family:'Plus Jakarta Sans',system-ui,sans-serif; overflow:hidden; -webkit-text-size-adjust:100%}
  #td-overlay *{box-sizing:border-box}
  #td-overlay button{font-family:inherit; cursor:pointer}
  #td-overlay input[type=number]{-moz-appearance:textfield}
  #td-overlay input[type=number]::-webkit-outer-spin-button, #td-overlay input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none; margin:0}

  /* ── Barra superior ── */
  .td-top{display:flex; align-items:center; gap:11px; flex:0 0 auto; height:54px; padding:0 13px;
    background:linear-gradient(180deg,#0e141c,#0a0e14); border-bottom:1px solid var(--td-line); position:relative; z-index:20; overflow:hidden}
  .td-back{display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 12px 0 9px; border-radius:9px; flex:0 0 auto;
    font-family:var(--td-disp); font-weight:700; font-size:13px; color:#8b96a3; background:rgba(255,255,255,.05); border:1px solid var(--td-line2)}
  .td-back svg{width:12px; height:12px} .td-back:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}
  .td-demo{font-family:var(--td-mono); font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
    color:#3ee88a; background:rgba(46,232,106,.14); border:1px solid rgba(46,232,106,.45); border-radius:100px; padding:4px 10px; flex:0 0 auto}
  .td-coin{display:inline-flex; align-items:center; gap:9px; height:38px; padding:0 13px 0 7px; border-radius:10px; flex:0 0 auto;
    background:#141b24; border:1px solid var(--td-line2); color:var(--td-ink); font-family:var(--td-mono); font-weight:700; font-size:14px}
  .td-coin:hover{border-color:var(--td-gold-soft)}
  .td-coin i{width:24px; height:24px; border-radius:50%; flex:0 0 auto; background:#232b36 center/cover no-repeat; display:grid; place-items:center;
    font-family:var(--td-disp); font-weight:800; font-size:11px; color:#c9d1d9; border:1px solid rgba(255,255,255,.08)}
  .td-coin i.con{color:transparent; border-color:transparent}
  .td-coin svg{width:13px; height:13px; opacity:.6}
  .td-tf{display:inline-flex; gap:2px; flex:0 0 auto; padding:3px; background:#141b24; border-radius:9px; border:1px solid var(--td-line)}
  .td-tf button{min-height:28px; padding:0 10px; border-radius:7px; border:none; background:transparent; color:#7d8794; font-family:var(--td-mono); font-size:11px; font-weight:700}
  .td-tf button.on{background:linear-gradient(180deg,#f7db8d,var(--td-gold) 55%,#c79426); color:#2a1d00}
  .td-px{display:flex; flex-direction:column; justify-content:center; flex:0 0 auto; min-width:118px}
  .td-px-big{font-family:var(--td-disp); font-weight:800; font-size:20px; line-height:1.05; letter-spacing:.3px; transition:color .15s}
  .td-px-big.up{color:var(--td-up2)} .td-px-big.down{color:var(--td-down2)}
  .td-px-sub{font-family:var(--td-mono); font-size:10px; color:var(--td-ink3)}
  .td-stats{display:flex; gap:15px; flex:1 1 auto; overflow:hidden; min-width:0}
  .td-stat{display:flex; flex-direction:column; gap:1px; flex:0 0 auto}
  .td-stat b{font-family:var(--td-mono); font-size:9px; letter-spacing:.07em; text-transform:uppercase; color:var(--td-ink3); font-weight:700}
  .td-stat span{font-family:var(--td-mono); font-size:12px; color:var(--td-ink); font-weight:600}
  .td-stat span.up{color:var(--td-up2)} .td-stat span.down{color:var(--td-down2)}
  .td-wallet{display:flex; flex-direction:column; align-items:flex-end; gap:0; flex:0 0 auto; margin-left:auto; padding-right:2px}
  .td-wallet b{font-family:var(--td-mono); font-size:9px; letter-spacing:.07em; text-transform:uppercase; color:var(--td-ink3)}
  .td-wallet .eq{font-family:var(--td-disp); font-weight:800; font-size:17px; color:var(--td-gold); line-height:1.15; transition:color .15s}
  .td-wallet .eq.up{color:var(--td-up2)} .td-wallet .eq.down{color:var(--td-down2)}
  .td-wallet small{font-family:var(--td-mono); font-size:10px; color:var(--td-ink2)}
  .td-icobtn{height:36px; min-width:36px; padding:0 10px; border-radius:9px; flex:0 0 auto; display:inline-flex; align-items:center; gap:6px; justify-content:center;
    color:#8b96a3; background:rgba(255,255,255,.05); border:1px solid var(--td-line2); font-family:var(--td-mono); font-size:11px; font-weight:700}
  .td-icobtn svg{width:15px; height:15px} .td-icobtn:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}

  /* ── Cuerpo: gráfica | entrada ── */
  .td-body{flex:1 1 auto; min-height:0; display:flex; flex-direction:column}
  .td-main{flex:1 1 auto; min-height:0; display:grid; grid-template-columns:1fr 300px}
  .td-chart{position:relative; min-width:0; border-right:1px solid var(--td-line); background:var(--td-bg); overflow:hidden}
  .td-cv{position:absolute; inset:0}
  .td-fx{position:absolute; inset:0; z-index:4; pointer-events:none}
  .td-wm{position:absolute; left:14px; bottom:34px; z-index:1; opacity:.8; pointer-events:none}
  .td-wm img{height:30px; width:auto; filter:drop-shadow(0 2px 8px rgba(0,0,0,.9))}
  .td-flash{position:absolute; z-index:5; pointer-events:none; border-radius:50%; transform:translate(-50%,-50%);
    width:14px; height:14px; animation:tdFlash 1s ease-out forwards}
  @keyframes tdFlash{0%{opacity:.9; box-shadow:0 0 0 0 currentColor, 0 0 18px 4px currentColor} 100%{opacity:0; box-shadow:0 0 0 70px rgba(0,0,0,0), 0 0 0 0 currentColor}}
  .td-ticket{position:absolute; z-index:6; pointer-events:none; left:12px; font-family:var(--td-disp); font-weight:800; font-size:12px;
    padding:4px 10px; border-radius:8px; transform:translateY(-50%); animation:tdTicket 2.2s ease forwards; white-space:nowrap}
  .td-ticket.long{background:rgba(46,232,106,.9); color:#04210f} .td-ticket.short{background:rgba(255,91,110,.92); color:#2a0509}
  @keyframes tdTicket{0%{opacity:0; transform:translateY(-50%) scale(.8)} 12%{opacity:1; transform:translateY(-50%) scale(1)} 80%{opacity:1} 100%{opacity:0; transform:translateY(-50%) translateX(10px)}}

  /* ── Entrada de órdenes ── */
  .td-entry{display:flex; flex-direction:column; gap:11px; min-width:0; padding:13px; background:var(--td-panel); overflow-y:auto}
  .td-modes{display:flex; gap:4px}
  .td-mode{flex:1; height:32px; border-radius:8px; border:1px solid var(--td-line2); background:rgba(255,255,255,.03); color:var(--td-ink2); font-family:var(--td-mono); font-size:11.5px; font-weight:700}
  .td-mode.on{background:rgba(232,184,75,.12); border-color:var(--td-gold); color:var(--td-gold)}
  .td-lev{display:flex; align-items:center; gap:10px}
  .td-lev .td-fld-l{flex:0 0 auto}
  .td-lev-v{font-family:var(--td-disp); font-weight:800; font-size:16px; color:var(--td-gold); min-width:46px; text-align:right}
  .td-lev input[type=range]{flex:1; height:4px; accent-color:var(--td-gold); cursor:pointer}
  .td-fld{display:flex; flex-direction:column; gap:6px}
  .td-fld-l{font-family:var(--td-mono); font-size:10px; color:var(--td-ink3); letter-spacing:.04em; text-transform:uppercase; display:flex; justify-content:space-between; align-items:center}
  .td-in{display:flex; align-items:center; height:40px; padding:0 4px 0 12px; border-radius:9px; background:#0b1017; border:1px solid var(--td-line2); gap:6px}
  .td-in:focus-within{border-color:var(--td-gold-soft)}
  .td-in input{flex:1; min-width:0; border:none; background:transparent; outline:none; color:var(--td-ink); font-family:var(--td-mono); font-size:14px; font-weight:600}
  .td-in em{font-style:normal; font-family:var(--td-mono); font-size:11px; color:var(--td-ink3); flex:0 0 auto}
  .td-step{display:flex; flex-direction:column; gap:2px; flex:0 0 auto}
  .td-step button{width:22px; height:17px; border-radius:5px; border:1px solid var(--td-line2); background:rgba(255,255,255,.04); color:var(--td-ink2); display:grid; place-items:center; padding:0; line-height:0}
  .td-step button svg{width:9px; height:9px} .td-step button:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}
  .td-pcts{display:flex; gap:5px}
  .td-pct{flex:1; height:27px; border-radius:7px; border:1px solid var(--td-line2); background:rgba(255,255,255,.03); color:var(--td-ink2); font-family:var(--td-mono); font-size:10.5px; font-weight:700}
  .td-pct:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}
  .td-cost{display:flex; justify-content:space-between; font-family:var(--td-mono); font-size:11.5px; color:var(--td-ink2)}
  .td-cost b{color:var(--td-ink)} .td-cost .liqv{color:var(--td-down2)}
  .td-ops{display:flex; gap:9px}
  .td-op{flex:1; min-height:48px; border-radius:11px; border:none; font-family:var(--td-disp); font-weight:800; font-size:16px; letter-spacing:.04em; color:#04210f; position:relative; overflow:hidden}
  .td-op.long{background:linear-gradient(180deg,#4dffa0,#1fc96e); box-shadow:0 3px 0 #11813f}
  .td-op.short{background:linear-gradient(180deg,#ff8a95,#e03546); color:#2a0509; box-shadow:0 3px 0 #8f1f2a}
  .td-op:hover{filter:brightness(1.05)} .td-op:active{transform:translateY(2px); box-shadow:none}
  .td-hint{font-family:var(--td-mono); font-size:10px; color:var(--td-ink3); line-height:1.55; border-top:1px solid var(--td-line); padding-top:9px}
  .td-hint b{color:var(--td-gold-soft)}

  /* ── Panel inferior: posiciones / órdenes / historial ── */
  .td-pos{flex:0 0 auto; height:188px; display:flex; flex-direction:column; border-top:1px solid var(--td-line); background:var(--td-panel2)}
  .td-pos-tabs{display:flex; align-items:center; gap:2px; padding:5px 8px; border-bottom:1px solid var(--td-line); flex:0 0 auto}
  .td-pos-tab{height:30px; padding:0 13px; border-radius:7px; border:none; background:transparent; color:var(--td-ink2); font-family:var(--td-mono); font-size:11.5px; font-weight:700}
  .td-pos-tab.on{background:rgba(255,255,255,.06); color:var(--td-ink)}
  .td-pos-tab b{color:var(--td-gold)}
  .td-pos-r{margin-left:auto; display:flex; gap:6px; align-items:center; padding-right:4px}
  .td-stat-chip{font-family:var(--td-mono); font-size:10.5px; color:var(--td-ink2)} .td-stat-chip b{color:var(--td-ink)} .td-stat-chip b.up{color:var(--td-up2)} .td-stat-chip b.down{color:var(--td-down2)}
  .td-pos-body{flex:1 1 auto; min-height:0; overflow:auto}
  .td-tbl{width:100%; border-collapse:collapse; font-family:var(--td-mono); font-size:11.5px}
  .td-tbl th{position:sticky; top:0; background:var(--td-panel2); text-align:right; padding:7px 14px; color:var(--td-ink3); font-weight:700; font-size:9.5px; letter-spacing:.05em; text-transform:uppercase; border-bottom:1px solid var(--td-line); white-space:nowrap; z-index:1}
  .td-tbl th:first-child, .td-tbl td:first-child{text-align:left}
  .td-tbl td{padding:8px 14px; text-align:right; border-bottom:1px solid rgba(27,34,44,.6); white-space:nowrap; color:var(--td-ink)}
  .td-tbl tbody tr:hover{background:rgba(255,255,255,.02)}
  .td-sym{display:inline-flex; align-items:center; gap:8px}
  .td-sym i{width:18px; height:18px; border-radius:50%; flex:0 0 auto; background:#232b36 center/cover no-repeat; display:inline-grid; place-items:center; font-family:var(--td-disp); font-weight:800; font-size:8px; color:#c9d1d9}
  .td-sym i.con{color:transparent}
  .td-tag{font-family:var(--td-mono); font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px; letter-spacing:.04em}
  .td-tag.long{color:var(--td-up2); background:rgba(46,232,106,.14)} .td-tag.short{color:var(--td-down2); background:rgba(255,91,110,.14)}
  .td-lev-badge{font-family:var(--td-mono); font-size:9.5px; color:var(--td-gold); background:rgba(232,184,75,.12); padding:2px 6px; border-radius:4px}
  .td-pnl.up{color:var(--td-up2)} .td-pnl.down{color:var(--td-down2)}
  .td-liq{color:var(--td-down2)}
  .td-x{height:28px; padding:0 12px; border-radius:7px; border:1px solid var(--td-line2); background:rgba(255,255,255,.04); color:var(--td-ink2); font-family:var(--td-mono); font-size:10.5px; font-weight:700}
  .td-x:hover{border-color:var(--td-down); color:var(--td-down2); background:rgba(255,91,110,.08)}
  .td-share{height:28px; width:30px; border-radius:7px; border:1px solid var(--td-line2); background:rgba(255,255,255,.04); color:var(--td-ink2); display:inline-grid; place-items:center; padding:0}
  .td-share svg{width:14px; height:14px} .td-share:hover{border-color:var(--td-gold); color:var(--td-gold)}
  .td-empty{padding:26px; text-align:center; color:var(--td-ink3); font-family:var(--td-mono); font-size:12px}

  /* ── Menú de monedas ── */
  #td-coinmenu{position:fixed; z-index:12000; width:248px; max-height:62vh; overflow-y:auto; background:#141b24; border:1px solid var(--td-line2); border-radius:13px; padding:6px; box-shadow:0 20px 50px rgba(0,0,0,.6)}
  #td-coinmenu input{width:100%; height:36px; padding:0 11px; margin-bottom:6px; border-radius:9px; border:1px solid var(--td-line2); background:#0b1017; color:var(--td-ink); font-family:var(--td-mono); font-size:13px; outline:none}
  #td-coinmenu .it{display:flex; align-items:center; gap:9px; width:100%; min-height:40px; padding:0 10px; border-radius:9px; border:none; background:transparent; color:var(--td-ink2); font-family:var(--td-mono); font-size:13px; text-align:left}
  #td-coinmenu .it:hover{background:rgba(255,255,255,.05); color:var(--td-ink)} #td-coinmenu .it.on{color:var(--td-gold)}
  #td-coinmenu .it i{width:22px; height:22px; border-radius:50%; flex:0 0 auto; background:#232b36 center/cover no-repeat; display:grid; place-items:center; font-family:var(--td-disp); font-weight:800; font-size:9px; color:#c9d1d9}
  #td-coinmenu .it i.con{color:transparent}
  #td-coinmenu .it b{min-width:50px; color:var(--td-ink); font-weight:700} #td-coinmenu .it.on b{color:var(--td-gold)}
  #td-coinmenu .it span{flex:1; color:var(--td-ink3); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}

  /* ── Toast ── */
  .td-toast{position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:13000; max-width:92vw;
    padding:12px 18px; border-radius:12px; background:#141b24; border:1px solid var(--td-line2); color:var(--td-ink);
    font-family:var(--td-mono); font-size:12.5px; box-shadow:0 16px 44px rgba(0,0,0,.6); animation:tdToast .25s ease}
  .td-toast.ok{border-color:rgba(46,232,106,.5)} .td-toast.bad{border-color:rgba(255,91,110,.5)} .td-toast.warn{border-color:rgba(232,184,75,.5)}
  @keyframes tdToast{from{opacity:0; transform:translateX(-50%) translateY(8px)} to{opacity:1; transform:translateX(-50%) translateY(0)}}
  .td-spin{position:absolute; inset:0; display:grid; place-items:center; background:var(--td-bg); z-index:7}
  .td-spin i{width:34px; height:34px; border-radius:50%; border:3px solid rgba(232,184,75,.2); border-top-color:var(--td-gold); animation:tdGira .7s linear infinite}
  @keyframes tdGira{to{transform:rotate(360deg)}}

  /* ── Modal tarjeta de PnL ── */
  #td-modal{position:fixed; inset:0; z-index:14000; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(3,6,10,.72); backdrop-filter:blur(4px)}
  #td-modal .card{position:relative; max-width:440px; width:100%; background:#10151c; border:1px solid var(--td-line2); border-radius:18px; padding:16px; box-shadow:0 30px 80px rgba(0,0,0,.7)}
  #td-modal canvas{width:100%; height:auto; border-radius:12px; display:block}
  #td-modal .acts{display:flex; gap:9px; margin-top:13px}
  #td-modal .acts button{flex:1; min-height:42px; border-radius:11px; border:1px solid var(--td-line2); background:rgba(255,255,255,.05); color:var(--td-ink); font-family:var(--td-disp); font-weight:800; font-size:13px}
  #td-modal .acts .dl{border-color:#c79426; color:#2a1d00; background:linear-gradient(180deg,#f7db8d,var(--td-gold) 55%,#c79426)}
  #td-modal .acts button:hover{filter:brightness(1.05)}
  #td-modal .x{position:absolute; top:10px; right:10px; width:30px; height:30px; border-radius:9px; border:1px solid var(--td-line2); background:rgba(0,0,0,.4); color:var(--td-ink2); z-index:2}

  /* ── Responsivo: en pantallas chicas se apila (gráfica, entrada, posiciones) ── */
  @media (max-width:980px){
    .td-body{display:block; overflow-y:auto}
    .td-main{display:block}
    .td-chart{height:54vh; border-right:none; border-bottom:1px solid var(--td-line)}
    .td-entry{overflow:visible}
    .td-stats{display:none}
    .td-pos{height:auto; max-height:52vh}
  }
  @media (max-width:560px){
    .td-top{height:auto; flex-wrap:wrap; padding:8px 10px; gap:8px}
    .td-coin{order:2} .td-tf{order:4} .td-px{order:3} .td-wallet{order:5; margin-left:auto}
    .td-export, .td-reset{order:6}
    .td-chart{height:48vh}
    .td-ops .td-op{font-size:15px}
  }`;
  document.head.appendChild(s);
}
