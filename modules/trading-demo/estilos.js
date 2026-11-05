/* modules/trading-demo/estilos.js — Skin del Trading Demo.
   Layout tipo Binance Futures (gráfica + libro + entrada + posiciones) con la
   paleta de DecFreedom. CSS estático, autónomo, inyectado una sola vez. */

export function estilos() {
  if (document.getElementById('td-css')) return;
  const s = document.createElement('style'); s.id = 'td-css';
  s.textContent = `
  :root{ --td-gold:#E8B84B; --td-gold-soft:#C9A84B; --td-up:#2ee86a; --td-up2:#3ee88a; --td-down:#ff5b6e; --td-down2:#ff6b7a;
    --td-bg:#0a0d12; --td-panel:#0e141c; --td-panel2:#10151c; --td-line:#1b222c; --td-line2:#242d38;
    --td-ink:#eaecef; --td-ink2:#9aa4af; --td-ink3:#6b7580; --td-mono:'IBM Plex Mono',ui-monospace,Consolas,monospace; --td-disp:'Chakra Petch',system-ui,sans-serif; }
  #td-overlay{position:fixed; inset:0; z-index:10000; background:var(--td-bg); color:var(--td-ink);
    display:flex; flex-direction:column; font-family:'Plus Jakarta Sans',system-ui,sans-serif; overflow:hidden; -webkit-text-size-adjust:100%}
  #td-overlay *{box-sizing:border-box}
  #td-overlay button{font-family:inherit; cursor:pointer}

  /* ── Barra superior ── */
  .td-top{display:flex; align-items:center; gap:12px; flex:0 0 auto; height:54px; padding:0 13px;
    background:linear-gradient(180deg,#0e141c,#0a0e14); border-bottom:1px solid var(--td-line); position:relative; z-index:20}
  .td-back{display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 12px 0 9px; border-radius:9px; flex:0 0 auto;
    font-family:var(--td-disp); font-weight:700; font-size:13px; color:#8b96a3; background:rgba(255,255,255,.05); border:1px solid var(--td-line2)}
  .td-back svg{width:12px; height:12px} .td-back:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}
  .td-demo{font-family:var(--td-mono); font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase;
    color:#3ee88a; background:rgba(46,232,106,.14); border:1px solid rgba(46,232,106,.45); border-radius:100px; padding:4px 10px; flex:0 0 auto}
  .td-coin{display:inline-flex; align-items:center; gap:9px; height:38px; padding:0 13px; border-radius:10px; flex:0 0 auto;
    background:#141b24; border:1px solid var(--td-line2); color:var(--td-ink); font-family:var(--td-mono); font-weight:700; font-size:14px}
  .td-coin:hover{border-color:var(--td-gold-soft)} .td-coin i{width:20px; height:20px; border-radius:50%; background:#232b36 center/cover no-repeat; flex:0 0 auto}
  .td-coin svg{width:13px; height:13px; opacity:.6}
  .td-tf{display:inline-flex; gap:2px; flex:0 0 auto; padding:3px; background:#141b24; border-radius:9px; border:1px solid var(--td-line)}
  .td-tf button{min-height:28px; padding:0 10px; border-radius:7px; border:none; background:transparent; color:#7d8794; font-family:var(--td-mono); font-size:11px; font-weight:700}
  .td-tf button.on{background:linear-gradient(180deg,#f7db8d,var(--td-gold) 55%,#c79426); color:#2a1d00}
  .td-px{display:flex; flex-direction:column; justify-content:center; flex:0 0 auto; min-width:120px}
  .td-px-big{font-family:var(--td-disp); font-weight:800; font-size:20px; line-height:1.05; letter-spacing:.3px}
  .td-px-big.up{color:var(--td-up2)} .td-px-big.down{color:var(--td-down2)}
  .td-px-sub{font-family:var(--td-mono); font-size:10px; color:var(--td-ink3)}
  .td-stats{display:flex; gap:16px; flex:1 1 auto; overflow:hidden}
  .td-stat{display:flex; flex-direction:column; gap:1px; flex:0 0 auto}
  .td-stat b{font-family:var(--td-mono); font-size:9px; letter-spacing:.08em; text-transform:uppercase; color:var(--td-ink3); font-weight:700}
  .td-stat span{font-family:var(--td-mono); font-size:12px; color:var(--td-ink); font-weight:600}
  .td-stat span.up{color:var(--td-up2)} .td-stat span.down{color:var(--td-down2)}
  .td-wallet{display:flex; flex-direction:column; align-items:flex-end; gap:1px; flex:0 0 auto; margin-left:auto; padding-right:4px}
  .td-wallet b{font-family:var(--td-mono); font-size:9px; letter-spacing:.08em; text-transform:uppercase; color:var(--td-ink3)}
  .td-wallet span{font-family:var(--td-disp); font-weight:800; font-size:16px; color:var(--td-gold)}
  .td-reset{height:34px; width:34px; border-radius:9px; flex:0 0 auto; display:grid; place-items:center; color:#8b96a3; background:rgba(255,255,255,.05); border:1px solid var(--td-line2)}
  .td-reset svg{width:15px; height:15px} .td-reset:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}

  /* ── Cuerpo: gráfica | libro | entrada ── */
  .td-body{flex:1 1 auto; min-height:0; display:flex; flex-direction:column}
  .td-main{flex:1 1 auto; min-height:0; display:grid; grid-template-columns:1fr 238px 300px}
  .td-chart{position:relative; min-width:0; border-right:1px solid var(--td-line); background:var(--td-bg)}
  .td-cv{position:absolute; inset:0}
  .td-wm{position:absolute; left:14px; bottom:34px; z-index:1; opacity:.8; pointer-events:none}
  .td-wm img{height:30px; width:auto; filter:drop-shadow(0 2px 8px rgba(0,0,0,.9))}

  /* ── Libro de órdenes + trades ── */
  .td-book{display:flex; flex-direction:column; min-width:0; border-right:1px solid var(--td-line); background:var(--td-panel)}
  .td-book-hd{display:grid; grid-template-columns:1fr 1fr; gap:4px; padding:7px 10px 5px; font-family:var(--td-mono); font-size:9px; color:var(--td-ink3); letter-spacing:.06em; text-transform:uppercase}
  .td-book-hd span:last-child{text-align:right}
  .td-dom{flex:1 1 auto; min-height:0; display:flex; flex-direction:column; overflow:hidden}
  .td-dom-side{flex:1 1 0; min-height:0; display:flex; flex-direction:column; overflow:hidden}
  .td-dom-side.asks{justify-content:flex-end}
  .td-row{position:relative; display:grid; grid-template-columns:1fr 1fr; align-items:center; height:18px; padding:0 10px; font-family:var(--td-mono); font-size:11px; cursor:pointer}
  .td-row .td-bar{position:absolute; top:1px; bottom:1px; right:0; z-index:0; border-radius:2px}
  .td-row span{position:relative; z-index:1}
  .td-row .td-sz{text-align:right; color:var(--td-ink)}
  .td-row.ask .td-pxv{color:var(--td-down2)} .td-row.ask .td-bar{background:rgba(255,91,110,.13)}
  .td-row.bid .td-pxv{color:var(--td-up2)} .td-row.bid .td-bar{background:rgba(46,232,106,.13)}
  .td-row:hover{background:rgba(255,255,255,.04)}
  .td-mid{display:flex; align-items:center; gap:8px; padding:6px 10px; border-top:1px solid var(--td-line); border-bottom:1px solid var(--td-line); background:#0c121a}
  .td-mid b{font-family:var(--td-disp); font-weight:800; font-size:16px}
  .td-mid b.up{color:var(--td-up2)} .td-mid b.down{color:var(--td-down2)}
  .td-mid svg{width:13px;height:13px}
  .td-trades{flex:0 0 38%; min-height:0; display:flex; flex-direction:column; border-top:1px solid var(--td-line)}
  .td-trades-hd{padding:6px 10px 3px; font-family:var(--td-mono); font-size:9px; color:var(--td-ink3); letter-spacing:.06em; text-transform:uppercase; display:grid; grid-template-columns:1fr 1fr 44px}
  .td-trades-hd span:nth-child(2){text-align:right} .td-trades-hd span:last-child{text-align:right}
  .td-trades-l{flex:1 1 auto; min-height:0; overflow:hidden}
  .td-trade{display:grid; grid-template-columns:1fr 1fr 44px; height:17px; padding:0 10px; font-family:var(--td-mono); font-size:10.5px}
  .td-trade .m{text-align:right} .td-trade .t{text-align:right; color:var(--td-ink3)}
  .td-trade.buy .p{color:var(--td-up2)} .td-trade.sell .p{color:var(--td-down2)}

  /* ── Entrada de órdenes ── */
  .td-entry{display:flex; flex-direction:column; gap:11px; min-width:0; padding:12px; background:var(--td-panel); overflow-y:auto}
  .td-modes{display:flex; gap:4px}
  .td-mode{flex:1; height:30px; border-radius:8px; border:1px solid var(--td-line2); background:rgba(255,255,255,.03); color:var(--td-ink2); font-family:var(--td-mono); font-size:11px; font-weight:700}
  .td-mode.on{background:rgba(232,184,75,.12); border-color:var(--td-gold); color:var(--td-gold)}
  .td-lev{display:flex; align-items:center; gap:9px}
  .td-lev-v{font-family:var(--td-disp); font-weight:800; font-size:15px; color:var(--td-gold); min-width:42px}
  .td-lev input[type=range]{flex:1; accent-color:var(--td-gold)}
  .td-fld{display:flex; flex-direction:column; gap:5px}
  .td-fld-l{font-family:var(--td-mono); font-size:10px; color:var(--td-ink3); letter-spacing:.04em; text-transform:uppercase; display:flex; justify-content:space-between}
  .td-in{display:flex; align-items:center; height:38px; padding:0 11px; border-radius:9px; background:#0b1017; border:1px solid var(--td-line2)}
  .td-in:focus-within{border-color:var(--td-gold-soft)}
  .td-in input{flex:1; min-width:0; border:none; background:transparent; outline:none; color:var(--td-ink); font-family:var(--td-mono); font-size:14px; font-weight:600}
  .td-in input:disabled{color:var(--td-ink3)}
  .td-in em{font-style:normal; font-family:var(--td-mono); font-size:11px; color:var(--td-ink3)}
  .td-pcts{display:flex; gap:5px}
  .td-pct{flex:1; height:26px; border-radius:7px; border:1px solid var(--td-line2); background:rgba(255,255,255,.03); color:var(--td-ink2); font-family:var(--td-mono); font-size:10.5px; font-weight:700}
  .td-pct:hover{border-color:var(--td-gold-soft); color:var(--td-gold)}
  .td-cost{display:flex; justify-content:space-between; font-family:var(--td-mono); font-size:11px; color:var(--td-ink2)}
  .td-cost b{color:var(--td-ink)}
  .td-ops{display:flex; gap:8px}
  .td-op{flex:1; min-height:46px; border-radius:11px; border:none; font-family:var(--td-disp); font-weight:800; font-size:14px; display:flex; flex-direction:column; align-items:center; justify-content:center; line-height:1.15; color:#04210f}
  .td-op small{font-family:var(--td-mono); font-weight:600; font-size:9.5px; opacity:.85}
  .td-op.long{background:linear-gradient(180deg,#4dffa0,#1fc96e); box-shadow:0 3px 0 #11813f}
  .td-op.short{background:linear-gradient(180deg,#ff8a95,#e03546); color:#2a0509; box-shadow:0 3px 0 #8f1f2a}
  .td-op:hover{filter:brightness(1.05)} .td-op:active{transform:translateY(2px); box-shadow:none}
  .td-hint{font-family:var(--td-mono); font-size:10px; color:var(--td-ink3); line-height:1.5; border-top:1px solid var(--td-line); padding-top:9px}
  .td-hint b{color:var(--td-gold-soft)}

  /* ── Panel de posiciones ── */
  .td-pos{flex:0 0 auto; height:172px; display:flex; flex-direction:column; border-top:1px solid var(--td-line); background:var(--td-panel2)}
  .td-pos-tabs{display:flex; align-items:center; gap:2px; padding:4px 8px; border-bottom:1px solid var(--td-line); flex:0 0 auto}
  .td-pos-tab{height:30px; padding:0 13px; border-radius:7px; border:none; background:transparent; color:var(--td-ink2); font-family:var(--td-mono); font-size:11.5px; font-weight:700}
  .td-pos-tab.on{background:rgba(255,255,255,.06); color:var(--td-ink)}
  .td-pos-tab b{color:var(--td-gold)}
  .td-pos-body{flex:1 1 auto; min-height:0; overflow-y:auto}
  .td-tbl{width:100%; border-collapse:collapse; font-family:var(--td-mono); font-size:11.5px}
  .td-tbl th{position:sticky; top:0; background:var(--td-panel2); text-align:right; padding:7px 14px; color:var(--td-ink3); font-weight:700; font-size:9.5px; letter-spacing:.05em; text-transform:uppercase; border-bottom:1px solid var(--td-line); white-space:nowrap}
  .td-tbl th:first-child, .td-tbl td:first-child{text-align:left}
  .td-tbl td{padding:8px 14px; text-align:right; border-bottom:1px solid rgba(27,34,44,.6); white-space:nowrap; color:var(--td-ink)}
  .td-tbl .sym{display:flex; align-items:center; gap:8px}
  .td-tag{font-family:var(--td-mono); font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px; letter-spacing:.04em}
  .td-tag.long{color:var(--td-up2); background:rgba(46,232,106,.14)} .td-tag.short{color:var(--td-down2); background:rgba(255,91,110,.14)}
  .td-lev-badge{font-family:var(--td-mono); font-size:9.5px; color:var(--td-gold); background:rgba(232,184,75,.12); padding:2px 6px; border-radius:4px}
  .td-pnl.up{color:var(--td-up2)} .td-pnl.down{color:var(--td-down2)}
  .td-liq{color:var(--td-down2)}
  .td-x{height:28px; padding:0 12px; border-radius:7px; border:1px solid var(--td-line2); background:rgba(255,255,255,.04); color:var(--td-ink2); font-family:var(--td-mono); font-size:10.5px; font-weight:700}
  .td-x:hover{border-color:var(--td-down); color:var(--td-down2); background:rgba(255,91,110,.08)}
  .td-x.cancel:hover{border-color:var(--td-down)}
  .td-empty{padding:26px; text-align:center; color:var(--td-ink3); font-family:var(--td-mono); font-size:12px}

  /* ── Menú de monedas (reusa estilo oscuro) ── */
  #td-coinmenu{position:fixed; z-index:12000; width:240px; max-height:60vh; overflow-y:auto; background:#141b24; border:1px solid var(--td-line2); border-radius:13px; padding:6px; box-shadow:0 20px 50px rgba(0,0,0,.6)}
  #td-coinmenu input{width:100%; height:36px; padding:0 11px; margin-bottom:6px; border-radius:9px; border:1px solid var(--td-line2); background:#0b1017; color:var(--td-ink); font-family:var(--td-mono); font-size:13px; outline:none}
  #td-coinmenu .it{display:flex; align-items:center; gap:9px; width:100%; min-height:38px; padding:0 10px; border-radius:9px; border:none; background:transparent; color:var(--td-ink2); font-family:var(--td-mono); font-size:13px; text-align:left}
  #td-coinmenu .it:hover{background:rgba(255,255,255,.05); color:var(--td-ink)} #td-coinmenu .it.on{color:var(--td-gold)}
  #td-coinmenu .it b{min-width:56px; color:var(--td-ink); font-weight:700} #td-coinmenu .it.on b{color:var(--td-gold)}
  #td-coinmenu .it span{flex:1; color:var(--td-ink3); font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}

  .td-toast{position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:13000; max-width:92vw;
    padding:12px 18px; border-radius:12px; background:#141b24; border:1px solid var(--td-line2); color:var(--td-ink);
    font-family:var(--td-mono); font-size:12.5px; box-shadow:0 16px 44px rgba(0,0,0,.6); animation:tdToast .25s ease}
  .td-toast.ok{border-color:rgba(46,232,106,.5)} .td-toast.bad{border-color:rgba(255,91,110,.5)} .td-toast.warn{border-color:rgba(232,184,75,.5)}
  @keyframes tdToast{from{opacity:0; transform:translateX(-50%) translateY(8px)} to{opacity:1; transform:translateX(-50%) translateY(0)}}
  .td-spin{position:absolute; inset:0; display:grid; place-items:center; background:var(--td-bg); z-index:5}
  .td-spin i{width:34px; height:34px; border-radius:50%; border:3px solid rgba(232,184,75,.2); border-top-color:var(--td-gold); animation:tdGira .7s linear infinite}
  @keyframes tdGira{to{transform:rotate(360deg)}}

  /* ── Responsive: apila a una columna ── */
  @media (max-width:1100px){
    .td-main{grid-template-columns:1fr 300px}
    .td-book{display:none}
  }
  @media (max-width:800px){
    .td-main{grid-template-columns:1fr}
    .td-entry{display:none}
    .td-stats{display:none}
    .td-pos{height:150px}
  }`;
  document.head.appendChild(s);
}
