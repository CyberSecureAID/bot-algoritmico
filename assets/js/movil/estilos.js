/* movil/estilos.js — CSS de la experiencia MÓVIL tipo exchange. Todo va
   scoped bajo #mv-app para NO afectar la web ni las secciones existentes.
   Paleta: negro/gris oscuro nuestro + dorado #E8B84B. Sin logos ajenos. */

let _puesto = false;

export function inyectarMovil() {
  if (_puesto || document.getElementById('mv-css')) { _puesto = true; return; }
  _puesto = true;
  const s = document.createElement('style');
  s.id = 'mv-css';
  s.textContent = `
  @media(max-width:760px){
    html::-webkit-scrollbar,body::-webkit-scrollbar,*::-webkit-scrollbar{width:0!important;height:0!important;display:none!important;background:transparent!important}
    html,body{scrollbar-width:none!important;-ms-overflow-style:none!important}
  }
  :root{
    --mv-bg:#0B0E11; --mv-bg2:#0f141a; --mv-card:#151b23; --mv-card2:#1b222c;
    --mv-line:#232b36; --mv-txt:#eaecef; --mv-mut:#8b96a3; --mv-mut2:#5b6472;
    --mv-gold:#E8B84B; --mv-gold-d:#c99a2e; --mv-up:#2ebd85; --mv-down:#f6465d;
  }
  #mv-app{position:fixed;inset:0;z-index:100;background:var(--mv-bg);color:var(--mv-txt);
    font-family:'Plus Jakarta Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden;-webkit-tap-highlight-color:transparent}
  #mv-app *{box-sizing:border-box}
  :where(#mv-app) button{font-family:inherit;cursor:pointer;border:0;background:none;color:inherit}
  #mv-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;
    padding:0 16px calc(84px + env(safe-area-inset-bottom,0px));scrollbar-width:none}
  #mv-scroll::-webkit-scrollbar{display:none}

  /* ── Barra superior ── */
  .mv-top{display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 16px 8px 12px}
  .mv-ava{position:relative;width:38px;height:38px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;
    background:linear-gradient(145deg,#1e2530,#12171e);border:1px solid var(--mv-line);overflow:visible}
  .mv-ava svg{width:20px;height:20px;color:var(--mv-gold)}
  .mv-ava .mv-ava-dot{position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:50%;
    background:var(--mv-mut2);border:2px solid var(--mv-bg)}
  .mv-ava .mv-ava-dot.on{background:var(--mv-up)}
  .mv-ava img{width:100%;height:100%;object-fit:cover;border-radius:50%}
  .mv-tcard{transition:opacity .24s ease}
  .mv-tcard.fade-out{opacity:0}
  .mv-search{flex:1;display:flex;align-items:center;gap:8px;height:38px;padding:0 14px;
    background:var(--mv-card);border:1px solid var(--mv-line);border-radius:20px;color:var(--mv-mut);font-size:14px;min-width:0;cursor:pointer}
  .mv-search .mv-search-ic{display:flex}
  .mv-search svg{width:16px;height:16px;flex:0 0 auto;opacity:.85}
  .mv-search .mv-search-ph{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mv-ico-btn{width:38px;height:38px;flex:0 0 auto;display:grid;place-items:center;border-radius:12px;
    background:var(--mv-card);border:1px solid var(--mv-line);position:relative;transition:background .15s}
  .mv-ico-btn:active{background:var(--mv-card2)}
  .mv-ico-btn svg{width:19px;height:19px;color:var(--mv-txt)}
  .mv-ico-btn .mv-dot{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;
    background:var(--mv-down);color:#fff;font-size:10px;font-weight:700;border-radius:9px;display:grid;place-items:center}

  /* ── Balance ── */
  .mv-bal-lbl{display:inline-flex;align-items:center;gap:7px;color:var(--mv-mut);font-size:13px;cursor:pointer;user-select:none;margin:10px 0 3px}
  .mv-bal-lbl svg{width:16px;height:16px;opacity:.85}
  .mv-bal-row{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
  .mv-bal{font-size:34px;font-weight:800;letter-spacing:-.5px;line-height:1.08}
  .mv-denom-in{align-self:center;display:inline-flex;align-items:center;gap:4px;background:var(--mv-card);border:1px solid var(--mv-line);
    color:var(--mv-txt);font-size:13px;font-weight:700;padding:6px 12px;border-radius:16px;transition:border-color .15s}
  .mv-denom-in:active{border-color:var(--mv-gold)}
  .mv-bal-sub{color:var(--mv-mut);font-size:13px;margin-top:4px;min-height:16px}
  .mv-wlogo{display:inline-flex;align-items:center}
  .mv-wlogo img{width:22px;height:22px;border-radius:50%;border:1px solid var(--mv-line);object-fit:cover}
  #mv-bots-x{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));right:12px;z-index:10200;width:38px;height:38px;
    border-radius:50%;background:rgba(11,14,17,.82);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
    border:1px solid var(--mv-line);color:var(--mv-txt);font-size:17px;box-shadow:0 4px 14px rgba(0,0,0,.5)}

  /* ── CTAs principales ── */
  .mv-cta{display:flex;gap:12px;margin:18px 0 4px}
  .mv-cta button{flex:1;height:52px;border-radius:14px;font-size:16px;font-weight:800;transition:transform .12s,filter .15s}
  .mv-cta button:active{transform:translateY(1px)}
  .mv-cta .mv-primary{background:linear-gradient(180deg,#f4d06a,#e0a92f);color:#231800;border:1px solid #f4d06a}
  .mv-cta .mv-primary:active{filter:brightness(1.05)}
  .mv-cta .mv-second{background:var(--mv-card2);color:var(--mv-txt);border:1px solid #2c3542}
  .mv-cta .mv-second:active{background:#222b36}

  /* ── Accesos rápidos (carrusel) ── */
  .mv-quick{display:flex;gap:4px;justify-content:space-between;overflow-x:visible;overflow-y:visible;margin:6px 0 2px;padding:12px 0 2px}
  .mv-quick::-webkit-scrollbar{display:none}
  .mv-qi{flex:1 1 0;min-width:0;max-width:80px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer}
  .mv-qi .mv-qbox{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;position:relative;overflow:visible;
    background:var(--mv-card);border:1px solid var(--mv-line);transition:transform .15s,background .15s,border-color .15s}
  .mv-qi .mv-qbox svg{width:24px;height:24px;color:var(--mv-txt);transition:color .15s}
  @media(hover:hover){.mv-qi:hover .mv-qbox{transform:translateY(-3px);border-color:var(--mv-gold);background:var(--mv-card2)}
    .mv-qi:hover .mv-qbox svg{color:var(--mv-gold)}}
  .mv-qi:active .mv-qbox{transform:scale(.92);background:var(--mv-card2);border-color:var(--mv-gold)}
  .mv-qi:active .mv-qbox svg{color:var(--mv-gold)}
  .mv-qi span{font-size:11.5px;color:var(--mv-mut);text-align:center;line-height:1.2}
  .mv-qi .mv-qtag{position:absolute;top:-6px;right:-4px;background:#E8B84B;color:#1a1200;font-size:8px;
    font-weight:900;padding:2px 6px;border-radius:7px;line-height:1;white-space:nowrap;letter-spacing:.3px;box-shadow:0 2px 6px rgba(0,0,0,.4);z-index:2}
  .mv-dots{display:flex;justify-content:center;gap:5px;margin:8px 0 2px}
  .mv-dots i{width:14px;height:3px;border-radius:2px;background:var(--mv-line)}
  .mv-dots i.on{background:var(--mv-gold);width:20px}

  /* ── Franja/lista rotativa (promos) ── */
  .mv-strip{margin:12px 0 0;background:var(--mv-card);border:1px solid var(--mv-line);border-radius:16px;
    padding:12px 13px;display:flex;align-items:center;gap:12px;overflow:hidden}
  .mv-strip .mv-strip-ic{width:40px;height:40px;flex:0 0 auto;border-radius:12px;display:grid;place-items:center;
    background:linear-gradient(145deg,#1f2731,#141a21);border:1px solid var(--mv-line)}
  .mv-strip .mv-strip-ic svg{width:24px;height:24px;color:var(--mv-gold)}
  .mv-strip .mv-strip-tx{flex:1;min-width:0}
  .mv-strip .mv-strip-tx b{display:block;font-size:14.5px;font-weight:700}
  .mv-strip .mv-strip-tx small{display:block;color:var(--mv-mut);font-size:12px;margin-top:2px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .mv-strip{position:relative}
  .mv-strip .mv-strip-count{position:absolute;top:8px;right:12px;font-size:11px;color:var(--mv-mut2);font-weight:700}
  .mv-strip .mv-strip-go{flex:0 0 auto;font-size:12px;font-weight:800;color:#1a1200;background:var(--mv-gold);
    padding:7px 13px;border-radius:20px}
  .mv-viewall{text-align:center;color:var(--mv-mut);font-size:13px;font-weight:600;padding:12px 0 2px}
  .mv-viewall b{color:var(--mv-gold)}

  /* ── Dos tarjetas rotativas ── */
  /* Tira de servicios: se mueve sola (JS) y además se arrastra/lanza con el dedo
     (scroll táctil nativo). El toque para abrir se gestiona por eventos pointer
     en inicio.js. scrollbar oculta; overscroll contenido para no encadenar con la
     página. La animación "mantener pulsado" (clase .press) solo salta en pulsación
     real, no al deslizar. */
  .mv-svc{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;
    margin:4px -16px 0;padding:2px 16px;scrollbar-width:none;
    -webkit-mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent);mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}
  .mv-svc::-webkit-scrollbar{display:none}
  .mv-svc-track{display:flex;gap:10px;width:max-content}
  .mv-svc-card{flex:0 0 auto;width:132px;height:104px;background:var(--mv-card);border:1px solid var(--mv-line);
    border-top:2px solid var(--bc,var(--mv-line));border-radius:15px;padding:14px 13px;display:flex;flex-direction:column;
    align-items:flex-start;justify-content:space-between;gap:10px;text-align:left;color:inherit;
    transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease;will-change:transform;transform-origin:center}
  /* Mantener el dedo puesto: resalta y crece un pelín (sutil, no rompe el scroll) */
  .mv-svc-card.press{transform:scale(1.045);border-color:var(--mv-gold);box-shadow:0 8px 22px rgba(0,0,0,.42),0 0 0 1px rgba(232,184,75,.35)}
  .mv-svc-ic{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:var(--mv-card2);border:1px solid var(--mv-line)}
  .mv-svc-ic svg{width:22px;height:22px}
  .mv-svc-card b{font-size:14px;font-weight:800;line-height:1.25;white-space:nowrap;width:100%}
  .mv-tdots{display:flex;gap:4px;position:absolute;bottom:10px;left:50%;transform:translateX(-50%)}
  .mv-tdots i{width:5px;height:5px;border-radius:50%;background:var(--mv-line)}
  .mv-tdots i.on{background:var(--mv-gold);width:16px;border-radius:3px}

  .mv-sec-h{display:flex;align-items:center;justify-content:space-between;margin:12px 0 7px}
  .mv-sec-h b{font-size:16px;font-weight:800}
  .mv-sec-h span{font-size:13px;color:var(--mv-gold);font-weight:600}

  /* ── Aviso conectar ── */
  .mv-connect{margin:12px 0 0;background:linear-gradient(180deg,#1a212b,#141a21);border:1px solid var(--mv-line);
    border-radius:16px;padding:14px 14px;text-align:center}
  .mv-connect p{margin:0 0 10px;color:var(--mv-mut);font-size:12.5px;line-height:1.4}
  .mv-connect b{color:var(--mv-txt)}
  .mv-connect button{height:44px;width:100%;border-radius:22px;font-weight:800;font-size:15px;
    background:linear-gradient(180deg,#f2ca63,var(--mv-gold-d));color:#1a1200}

  /* ── Barra inferior PERPETUA (encima de todo) ── */
  #mv-nav{position:fixed;left:0;right:0;bottom:0;z-index:10100;display:flex;background:var(--mv-bg2);
    border-top:1px solid var(--mv-line);padding:8px 4px calc(8px + env(safe-area-inset-bottom,0px));
    font-family:'Plus Jakarta Sans',system-ui,sans-serif}
  #mv-nav button{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:2px 0;color:var(--mv-mut2);background:none;border:0;cursor:pointer}
  #mv-nav button svg{width:23px;height:23px}
  #mv-nav button span{font-size:11px;font-weight:600}
  #mv-nav button.on{color:var(--mv-gold)}

  /* ── Market (pantalla 2) ── */
  .mv-mk-tabs{display:flex;gap:18px;margin:6px 0 2px;font-size:17px;font-weight:800}
  .mv-mk-tabs button{color:var(--mv-mut);padding:6px 0;position:relative}
  .mv-mk-tabs button.on{color:var(--mv-txt)}
  .mv-mk-tabs button.on::after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;border-radius:2px;background:var(--mv-gold)}
  .mv-mk-cats{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:10px -16px 4px;padding:0 16px}
  .mv-mk-cats::-webkit-scrollbar{display:none}
  .mv-mk-cats button{flex:0 0 auto;font-size:13.5px;font-weight:700;color:var(--mv-mut);padding:7px 14px;
    border-radius:18px;background:var(--mv-card);border:1px solid var(--mv-line)}
  .mv-mk-cats button.on{color:var(--mv-gold);border-color:var(--mv-gold)}
  .mv-mk-sort{display:flex;align-items:center;justify-content:space-between;color:var(--mv-mut);font-size:12.5px;
    padding:12px 2px 6px;border-bottom:1px solid var(--mv-line)}
  .mv-row{display:flex;align-items:center;gap:11px;padding:13px 2px;border-bottom:1px solid var(--mv-line)}
  .mv-row:active{background:var(--mv-card)}
  .mv-row .mv-favb{flex:0 0 auto;width:22px;height:22px;display:grid;place-items:center;color:var(--mv-mut2);background:none;border:0;padding:0}
  .mv-row .mv-favb svg{width:18px;height:18px}
  .mv-row .mv-favb.on{color:var(--mv-gold)}
  .mv-row .mv-ci{position:relative;width:34px;height:34px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;
    background-color:var(--mv-card2);background-size:cover;background-position:center;border:1px solid var(--mv-line);
    font-weight:800;font-size:13px;overflow:hidden}
  .mv-row .mv-ci img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .mv-row .mv-ci .ico-fb{color:var(--mv-gold)}
  .mv-row .mv-cn{flex:1;min-width:0}
  .mv-row .mv-cn b{font-size:15px;font-weight:700;display:block;letter-spacing:.2px}
  .mv-row .mv-cn small{font-size:12px;color:var(--mv-mut);display:block}
  .mv-row .mv-cp{text-align:right;flex:0 0 auto}
  .mv-row .mv-cp b{font-size:15px;font-weight:700;display:block}
  .mv-row .mv-cp small{font-size:12.5px;font-weight:700}
  .mv-row .mv-cp small.up{color:var(--mv-up)} .mv-row .mv-cp small.dn{color:var(--mv-down)} .mv-row .mv-cp small.fl{color:var(--mv-mut)}
  .mv-search input{flex:1;min-width:0;background:none;border:0;outline:none;color:var(--mv-txt);font-family:inherit;font-size:14px}
  .mv-search input::placeholder{color:var(--mv-mut)}
  .mv-empty{text-align:center;color:var(--mv-mut);padding:40px 20px;font-size:13.5px}

  /* ── Activos (pantalla 4) ── */
  .mv-acard{margin:12px 0 0;background:linear-gradient(180deg,#161d26,#12171e);border:1px solid var(--mv-line);
    border-radius:18px;padding:18px 16px}
  .mv-acard .mv-a-lbl{color:var(--mv-mut);font-size:13px;display:flex;align-items:center;gap:6px}
  .mv-acard .mv-a-bal{font-size:34px;font-weight:800;margin:6px 0 2px}
  .mv-aacts{display:flex;gap:10px;margin:16px 0 0}
  .mv-aacts button{flex:1;background:var(--mv-card2);border:1px solid var(--mv-line);border-radius:14px;
    padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:var(--mv-txt)}
  .mv-aacts button svg{width:22px;height:22px;color:var(--mv-gold)}
  .mv-hold{display:flex;align-items:center;gap:12px;padding:15px 2px;border-bottom:1px solid var(--mv-line)}
  .mv-hold .mv-h-nm{flex:1;min-width:0} .mv-hold .mv-h-nm b{font-size:15px} .mv-hold .mv-h-nm small{display:block;color:var(--mv-mut);font-size:12px}
  .mv-hold .mv-h-am{text-align:right} .mv-hold .mv-h-am b{font-size:15px} .mv-hold .mv-h-am small{display:block;color:var(--mv-mut);font-size:12px}

  /* ── Hojas emergentes (por ENCIMA de la barra inferior; flotantes) ── */
  #mv-sheet,#mv-denom-menu,#mv-menu{position:fixed;inset:0;z-index:11000;display:flex;flex-direction:column;justify-content:flex-end}
  #mv-sheet .mv-sheet-bg,#mv-denom-menu .mv-dm-bg,#mv-menu .mv-menu-bg{position:absolute;inset:0;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
  #mv-sheet .mv-sheet-card,#mv-denom-menu .mv-dm-card,#mv-menu .mv-menu-card{position:relative;background:var(--mv-bg2);
    border:1px solid var(--mv-line);border-radius:20px;width:calc(100% - 20px);max-width:460px;margin:0 auto calc(14px + env(safe-area-inset-bottom,0px));
    padding:16px 15px 18px;max-height:78vh;overflow-y:auto;scrollbar-width:none;animation:mvUp .22s ease;box-shadow:0 -8px 40px rgba(0,0,0,.5)}
  #mv-sheet .mv-sheet-card::-webkit-scrollbar,#mv-menu .mv-menu-card::-webkit-scrollbar{display:none}
  @keyframes mvUp{from{transform:translateY(30px);opacity:.4}to{transform:none;opacity:1}}
  #mv-sheet .mv-sheet-h{position:relative;text-align:center;margin-bottom:12px;padding:0 24px}
  #mv-sheet .mv-sheet-search{display:flex;align-items:center;gap:9px;height:50px;padding:0 14px;margin-bottom:12px;background:var(--mv-card);border:1px solid var(--mv-line);border-radius:13px}
  #mv-sheet .mv-sheet-search:focus-within{border-color:var(--mv-gold)}
  #mv-sheet .mv-sheet-search svg{width:18px;height:18px;color:var(--mv-mut);flex:0 0 auto}
  #mv-sheet .mv-sheet-search input{flex:1;min-width:0;height:100%;background:none;border:0;outline:none;color:var(--mv-txt);font-family:inherit;font-size:15px}
  #mv-sheet .mv-sheet-list{display:flex;flex-direction:column;gap:9px;max-height:52vh;overflow-y:auto;scrollbar-width:none}
  #mv-sheet .mv-sheet-list::-webkit-scrollbar{display:none}
  #mv-sheet .mv-sheet-h b{display:block;font-size:16px}
  #mv-sheet .mv-sheet-h span{display:block;color:var(--mv-mut);font-size:12.5px;margin-top:2px}
  .mv-sheet-x{position:absolute;top:12px;right:12px;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;
    background:var(--mv-card2);border:1px solid var(--mv-line);color:var(--mv-mut);font-size:16px;z-index:2}
  #mv-sheet .mv-sheet-op{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--mv-card);
    border:1px solid var(--mv-line);border-radius:13px;padding:13px;margin-bottom:9px}
  #mv-sheet .mv-sheet-op svg{width:24px;height:24px;color:var(--mv-gold);flex:0 0 auto}
  #mv-sheet .mv-sheet-op b{display:block;font-size:14.5px}
  #mv-sheet .mv-sheet-op small{display:block;color:var(--mv-mut);font-size:12px;margin-top:1px}
  #mv-sheet .mv-sheet-op:active{background:var(--mv-card2)}
  #mv-sheet .mv-sheet-cancel{width:100%;background:var(--mv-card2);border:1px solid var(--mv-line);border-radius:13px;
    padding:13px;color:var(--mv-txt);font-weight:700;font-size:15px;margin-top:2px}
  #mv-sheet button,#mv-menu button,#mv-denom-menu button{background:none;border:0;color:inherit;font-family:inherit;cursor:pointer;box-shadow:none}

  #mv-menu .mv-menu-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  #mv-menu .mv-menu-h b{font-size:17px;font-weight:800}
  #mv-menu .mv-menu-h button{color:var(--mv-mut);font-size:22px;line-height:1;padding:4px 8px}
  #mv-menu .mv-menu-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px 4px}
  #mv-menu .mv-mg-i{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 4px;border-radius:14px;background:none}
  #mv-menu .mv-mg-i:active{background:var(--mv-card)}
  #mv-menu .mv-mg-i .mv-mg-box{width:50px;height:50px;border-radius:15px;display:grid;place-items:center;background:var(--mv-card);border:1px solid var(--mv-line)}
  #mv-menu .mv-mg-i .mv-mg-box svg{width:23px;height:23px;color:var(--mv-gold)}
  #mv-menu .mv-mg-i span{font-size:11.5px;color:var(--mv-mut);text-align:center;line-height:1.2}
  #mv-menu .mv-menu-sub{color:var(--mv-mut2);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin:14px 4px 4px}

  #mv-denom-menu .mv-dm-h{color:var(--mv-mut);font-size:13px;margin-bottom:8px;text-align:center}
  #mv-denom-menu .mv-dm-list{max-height:56vh;overflow-y:auto;scrollbar-width:none}
  #mv-denom-menu .mv-dm-list::-webkit-scrollbar{display:none}
  #mv-denom-menu button[data-o]{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:var(--mv-card);border:1px solid var(--mv-line);
    color:var(--mv-txt);font-weight:700;font-size:15px;padding:12px;border-radius:12px;margin-bottom:8px}
  #mv-denom-menu button[data-o].on{border-color:var(--mv-gold)}
  #mv-denom-menu .mv-dm-lg{width:26px;height:26px;border-radius:50%;background:var(--mv-card2) center/cover no-repeat;border:1px solid var(--mv-line);flex:0 0 auto;display:grid;place-items:center;font-size:10px;color:var(--mv-gold)}
  #mv-denom-menu .mv-dm-amt{margin-left:auto;color:var(--mv-mut);font-size:12.5px;font-weight:600}

  /* ── Buscador (pantalla completa) ── */
  #mv-buscar{position:fixed;inset:0;z-index:11000;background:var(--mv-bg);display:flex;flex-direction:column}
  #mv-buscar .mv-bs-top{display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;border-bottom:1px solid var(--mv-line)}
  #mv-buscar .mv-search{cursor:text}
  #mv-buscar .mv-bs-cancel{background:none;border:0;color:var(--mv-gold);font-weight:700;font-size:14px;flex:0 0 auto;font-family:inherit}
  #mv-buscar .mv-bs-res{flex:1;overflow-y:auto;padding:6px 14px 20px}
  #mv-buscar .mv-bs-sub{color:var(--mv-mut2);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin:14px 2px 4px}
  #mv-buscar .mv-bs-item{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:none;border:0;
    padding:12px 4px;border-bottom:1px solid var(--mv-line);color:inherit;font-family:inherit}
  #mv-buscar .mv-bs-item:active{background:var(--mv-card)}
  #mv-buscar .mv-bs-ic{width:38px;height:38px;flex:0 0 auto;border-radius:11px;display:grid;place-items:center;background:var(--mv-card);border:1px solid var(--mv-line)}
  #mv-buscar .mv-bs-ic svg{width:20px;height:20px;color:var(--mv-gold)}
  #mv-buscar .mv-bs-item b{display:block;font-size:15px} #mv-buscar .mv-bs-item small{display:block;color:var(--mv-mut);font-size:12px}

  /* ── Selector de moneda compacto (con logo, precio, 24h y búsqueda) ── */
  #mv-picker{position:fixed;inset:0;z-index:11000;display:flex;flex-direction:column;justify-content:flex-end}
  #mv-picker .mvp-bg{position:absolute;inset:0;background:rgba(0,0,0,.55);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
  #mv-picker .mvp-card{position:relative;background:var(--mv-bg2);border:1px solid var(--mv-line);border-radius:20px;
    width:calc(100% - 20px);max-width:460px;margin:0 auto calc(14px + env(safe-area-inset-bottom,0px));
    padding:14px 14px 16px;max-height:72vh;display:flex;flex-direction:column;animation:mvUp .22s ease;box-shadow:0 -8px 40px rgba(0,0,0,.5)}
  #mv-picker .mvp-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  #mv-picker .mvp-h b{font-size:16px;font-weight:800}
  #mv-picker .mvp-h button{width:30px;height:30px;border-radius:9px;background:var(--mv-card2);border:1px solid var(--mv-line);color:var(--mv-mut);font-size:16px}
  #mv-picker .mvp-search{display:flex;align-items:center;gap:9px;height:50px;padding:0 14px;background:var(--mv-card);border:1px solid var(--mv-line);border-radius:13px;margin-bottom:10px;flex:0 0 auto}
  #mv-picker .mvp-search:focus-within{border-color:var(--mv-gold)}
  #mv-picker .mvp-search svg{width:18px;height:18px;color:var(--mv-mut);flex:0 0 auto}
  #mv-picker .mvp-search input{flex:1;min-width:0;height:100%;background:none;border:0;outline:none;color:var(--mv-txt);font-family:inherit;font-size:15px}
  #mv-picker .mvp-list{overflow-y:auto;scrollbar-width:none}
  #mv-picker .mvp-list::-webkit-scrollbar{display:none}
  #mv-picker button{background:none;border:0;color:inherit;font-family:inherit;cursor:pointer}
  #mv-picker .mvp-row{display:flex;align-items:center;gap:11px;padding:11px 4px;border-bottom:1px solid var(--mv-line);width:100%;text-align:left;background:none}
  #mv-picker .mvp-ci{width:32px;height:32px;flex:0 0 auto;border-radius:50%;background:var(--mv-card2) center/cover no-repeat;border:1px solid var(--mv-line);display:grid;place-items:center;font-size:11px;font-weight:800;color:var(--mv-gold)}
  #mv-picker .mvp-nm{flex:1;min-width:0} #mv-picker .mvp-nm b{font-size:14.5px;display:block} #mv-picker .mvp-nm small{color:var(--mv-mut);font-size:12px}
  #mv-picker .mvp-pr{text-align:right} #mv-picker .mvp-pr b{font-size:14px;display:block} #mv-picker .mvp-pr small{font-size:12px;font-weight:700}
  #mv-picker .mvp-pr small.up{color:var(--mv-up)} #mv-picker .mvp-pr small.dn{color:var(--mv-down)} #mv-picker .mvp-pr small.fl{color:var(--mv-mut)}
  #mv-picker .mvp-empty{text-align:center;color:var(--mv-mut);padding:26px;font-size:13px}

  /* ── Botón volver ── */
  #mv-volver{position:fixed;left:14px;top:calc(12px + env(safe-area-inset-top,0px));background:rgba(11,14,17,.85);
    -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:var(--mv-gold);font-weight:800;border:1px solid var(--mv-line);
    border-radius:22px;padding:10px 18px;box-shadow:0 6px 16px rgba(0,0,0,.5);font-family:inherit;font-size:15px}
  #mv-volver.abajo{top:auto;bottom:calc(76px + env(safe-area-inset-bottom,0px))}

  /* ── Toast ── */
  #mv-toast{position:fixed;left:50%;top:80px;transform:translateX(-50%) translateY(-8px);z-index:11200;background:#1b222c;
    color:var(--mv-txt);border:1px solid var(--mv-line);border-radius:14px;padding:13px 18px;max-width:86%;text-align:center;
    box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .2s,transform .2s}
  #mv-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  #mv-toast b{color:var(--mv-gold)} #mv-toast span{color:var(--mv-mut);font-size:13px}

  /* ── Modal de alerta de precio ── */
  #mv-sheet .al-card{padding-top:20px}
  .al-h{text-align:center;margin:2px 0 16px;padding:0 34px}
  .al-h b{display:block;font-size:17px;font-weight:800}
  .al-h span{display:block;color:var(--mv-mut);font-size:12.5px;margin-top:5px;line-height:1.35}
  #mv-sheet .al-field{margin-bottom:16px;background:var(--mv-card2)!important;height:56px;border:1px solid var(--mv-line)!important;border-radius:13px!important}
  #mv-sheet .al-field:focus-within{border-color:var(--mv-gold)!important}
  #mv-sheet .al-field input{font-size:17px!important}
  #mv-sheet .al-ok{width:100%;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426)!important;color:#3a2a06!important;font-weight:800;font-size:15px;
    border-radius:13px!important;border:0!important;padding:15px!important;margin-bottom:10px;box-shadow:0 6px 16px rgba(232,184,75,.28)}
  #mv-sheet .al-ok:active{filter:brightness(1.05)}
  #mv-sheet .al-cancel{width:100%;background:var(--mv-card2)!important;border:1px solid var(--mv-line)!important;border-radius:13px!important;padding:14px!important;color:var(--mv-txt)!important;font-weight:700;font-size:15px}
  .al-ok{width:100%;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2a06;font-weight:800;font-size:15px;
    border-radius:13px;padding:14px;margin-bottom:10px}
  .al-cancel{width:100%;background:var(--mv-card2);border:1px solid var(--mv-line);border-radius:13px;padding:13px;color:var(--mv-txt);font-weight:700;font-size:15px}

  /* ── Operar (pantalla 3) ── */
  .op-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0 6px}
  .op-sel{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:800;color:var(--mv-txt);background:none;border:0}
  .op-sel .op-logo{width:26px;height:26px;border-radius:50%;background:var(--mv-card2) center/cover no-repeat;border:1px solid var(--mv-line);
    display:grid;place-items:center;font-size:11px;font-weight:800;color:var(--mv-gold)}
  .op-acts{display:flex;gap:6px}
  .op-ic{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:var(--mv-card);border:1px solid var(--mv-line)}
  .op-ic svg{width:18px;height:18px;color:var(--mv-txt)}
  .op-ic:active{background:var(--mv-card2)}
  .op-subhead{display:flex;align-items:center;gap:10px;margin:2px 0 12px}
  .op-tag{font-size:12px;font-weight:800;color:var(--mv-gold);background:color-mix(in srgb,var(--mv-gold) 16%,transparent);padding:3px 9px;border-radius:8px}
  .op-price{font-size:20px;font-weight:800}
  .op-chg{font-size:13px;font-weight:700} .op-chg.up{color:var(--mv-up)} .op-chg.dn{color:var(--mv-down)}

  .op-grid{display:grid;grid-template-columns:minmax(0,0.85fr) minmax(0,1.15fr);gap:12px;align-items:start}
  .op-book{font-size:12px;min-width:0}
  .op-bk-h{display:flex;justify-content:space-between;color:var(--mv-mut2);font-size:11px;margin-bottom:4px}
  .op-row{position:relative;display:flex;justify-content:space-between;align-items:center;padding:2.5px 4px;overflow:hidden;border-radius:3px}
  .op-row em{position:relative;font-style:normal;font-weight:600} .op-row i{position:relative;font-style:normal;color:var(--mv-mut);font-size:11px}
  .op-row .op-bar{position:absolute;right:0;top:0;bottom:0;opacity:.16;transition:width .28s cubic-bezier(.4,0,.2,1)}
  .op-row.ask em{color:var(--mv-down)} .op-row.ask .op-bar{background:var(--mv-down)}
  .op-row.bid em{color:var(--mv-up)}  .op-row.bid .op-bar{background:var(--mv-up)}
  .op-bk-mid{font-size:17px;font-weight:800;padding:6px 4px} .op-bk-mid.up{color:var(--mv-up)} .op-bk-mid.dn{color:var(--mv-down)}

  .op-form{display:flex;flex-direction:column;gap:10px;min-width:0}
  .op-ol{display:flex;background:var(--mv-card);border:1px solid var(--mv-line);border-radius:10px;padding:3px;min-width:0}
  .op-olt{flex:1;padding:8px 0;font-size:13px;font-weight:700;color:var(--mv-mut);border-radius:8px}
  .op-olt.on{background:var(--mv-card2);color:var(--mv-txt)}
  .op-field{display:flex;align-items:center;gap:6px;background:var(--mv-card);border:1px solid var(--mv-line);border-radius:10px;padding:9px 12px}
  .op-field span{color:var(--mv-mut);font-size:12px;flex:0 0 auto}
  .op-field input{flex:1;min-width:0;background:none;border:0;outline:none;color:var(--mv-txt);font-family:inherit;font-size:15px;text-align:right}
  .op-field b,.op-qsel{color:var(--mv-txt);font-size:12.5px;font-weight:700;flex:0 0 auto}
  .op-qsel{display:inline-flex;align-items:center;gap:3px;background:var(--mv-card2);border:1px solid var(--mv-line);border-radius:8px;padding:5px 8px}
  .op-avail{color:var(--mv-mut);font-size:11.5px;margin:-2px 2px 0}
  .op-range{width:100%;-webkit-appearance:none;appearance:none;height:4px;border-radius:3px;background:var(--mv-line);margin:2px 0}
  .op-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--mv-gold);border:2px solid var(--mv-bg);cursor:pointer}
  .op-range::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--mv-gold);border:2px solid var(--mv-bg);cursor:pointer}
  .op-pcts{display:flex;gap:6px}
  .op-pcts button{flex:1;background:var(--mv-card);border:1px solid var(--mv-line);border-radius:9px;padding:7px 0;font-size:12px;font-weight:700;color:var(--mv-mut)}
  .op-pcts button:active{border-color:var(--mv-gold);color:var(--mv-gold)}
  .op-sltoggle{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:0;color:var(--mv-mut);font-size:13px;font-weight:700;padding:2px 0}
  .op-sltoggle em{color:var(--mv-mut2);font-weight:600;font-style:normal;font-size:12px}
  .op-sltoggle.on i{transform:rotate(180deg)}
  .op-sltoggle i{transition:transform .2s;display:inline-block}
  .op-buy,.op-sell{padding:14px 0;border-radius:13px;font-size:15.5px;font-weight:800;color:#fff;letter-spacing:.2px;transition:transform .12s,filter .15s}
  .op-buy{background:linear-gradient(180deg,#34d98a,#12b06a);box-shadow:0 6px 16px rgba(46,189,133,.28)}
  .op-sell{background:linear-gradient(180deg,#ff5c6c,#e03246);box-shadow:0 6px 16px rgba(246,70,93,.26)}
  .op-buy:active,.op-sell:active{transform:translateY(1px);filter:brightness(1.06)}

  .op-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 2px;border-bottom:1px solid var(--mv-line)}
  .op-ord{display:flex;align-items:center;gap:11px;padding:12px 2px;border-bottom:1px solid var(--mv-line)}
  .op-ord-ci{width:34px;height:34px;flex:0 0 auto;border-radius:50%;background:var(--mv-card2) center/cover no-repeat;border:1px solid var(--mv-line);display:grid;place-items:center;font-size:11px;font-weight:800;color:var(--mv-gold)}
  .op-ord-tx{flex:1;min-width:0} .op-ord-tx b{font-size:14.5px;display:flex;align-items:center;gap:7px} .op-ord-tx small{color:var(--mv-mut);font-size:12px}
  .op-ord-tag{font-style:normal;font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px}
  .op-ord-tag.buy{color:var(--mv-up);background:color-mix(in srgb,var(--mv-up) 15%,transparent)}
  .op-ord-tag.sell{color:var(--mv-down);background:color-mix(in srgb,var(--mv-down) 15%,transparent)}
  .op-ord-r{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:5px}
  .op-ord-pct{font-size:12px;font-weight:700;color:var(--mv-mut)} .op-ord-pct.up{color:var(--mv-up)} .op-ord-pct.dn{color:var(--mv-down)}
  .op-ord-x{font-size:11.5px;font-weight:700;color:var(--mv-down);background:color-mix(in srgb,var(--mv-down) 12%,transparent);border:1px solid color-mix(in srgb,var(--mv-down) 40%,transparent);border-radius:8px;padding:5px 10px}
  .op-item b{font-size:14.5px} .op-item small{display:block;color:var(--mv-mut);font-size:12px}
  .op-item .up{color:var(--mv-up);font-weight:800} .op-item .dn{color:var(--mv-down);font-weight:800}
  .op-del{display:block;margin-top:4px;margin-left:auto;background:var(--mv-card2);border:1px solid var(--mv-line);color:var(--mv-down);
    font-size:11.5px;font-weight:700;padding:5px 10px;border-radius:9px}

  .op-tabs{display:flex;align-items:center;gap:18px;border-bottom:1px solid var(--mv-line);margin:18px 0 0;min-height:44px;overflow:visible}
  @media(max-width:360px){
    .op-ic{width:30px;height:30px} .op-ic svg{width:16px;height:16px} .op-acts{gap:4px}
    .op-sel{font-size:16px;gap:6px} .op-sel .op-logo{width:22px;height:22px}
    .op-grid{gap:8px}
  }
  .op-tab{padding:10px 0;font-size:14px;font-weight:700;color:var(--mv-mut);position:relative}
  .op-tab.on{color:var(--mv-txt)}
  .op-tab.on::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--mv-gold);border-radius:2px}
  .op-histbtn{margin-left:auto;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;min-width:34px;padding:0;border:1px solid var(--mv-line,#232b36);border-radius:10px;background:rgba(255,255,255,.04);color:var(--mv-txt,#e9edf1);cursor:pointer;align-self:center;overflow:visible;transition:border-color .13s,background .13s}
  .op-histbtn svg{width:20px;height:20px}
  .op-histbtn:hover{border-color:var(--gold,#E8B84B)}
.op-histbtn:active{transform:scale(.94);background:rgba(232,184,75,.12)}
  .op-panel{padding:6px 0}
  .op-empty{text-align:center;color:var(--mv-mut);padding:28px 16px;font-size:13.5px}
  .op-loading{display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--mv-mut);padding:34px 16px;font-size:13.5px}
  .op-spin{width:26px;height:26px;border-radius:50%;border:3px solid var(--mv-line);border-top-color:var(--mv-gold);animation:opspin .8s linear infinite}
  @keyframes opspin{to{transform:rotate(360deg)}}
  /* Tarjeta real de "Mis bots" reubicada dentro de Operar */
  #op-panel .mv-botcard{margin-top:6px}
  #op-panel .mv-botcard .rej{padding:13px!important;border-radius:14px!important}
  #op-panel .mv-botcard .rej .l,#op-panel .mv-botcard .rej .r{padding:11px 13px!important}
  #op-panel .mv-botcard .pio-box{padding:9px 11px!important}
  .op-link{color:var(--mv-gold);font-weight:700;background:none;border:0;text-decoration:underline}
  .op-bot{display:flex;align-items:center;gap:11px;padding:13px 12px;margin-bottom:9px;background:var(--mv-card);
    border:1px solid var(--mv-line);border-left:3px solid var(--bc,var(--mv-gold));border-radius:13px}
  .op-bot-ic{width:40px;height:40px;flex:0 0 auto;border-radius:11px;display:grid;place-items:center}
  .op-bot-ic svg{width:22px;height:22px}
  .op-bot-tx{flex:1;min-width:0} .op-bot-tx b{font-size:14.5px;display:flex;align-items:center;gap:7px} .op-bot-tx small{color:var(--mv-mut);font-size:12px}
  .op-bot-on{font-style:normal;font-size:10px;font-weight:800;color:var(--mv-up);background:color-mix(in srgb,var(--mv-up) 16%,transparent);padding:2px 7px;border-radius:6px}
  .op-bot-pnl{font-weight:800;font-size:14px} .op-bot-pnl.up{color:var(--mv-up)} .op-bot-pnl.dn{color:var(--mv-down)}
  .op-bot-manage{width:100%;margin-top:8px;background:var(--mv-card2);border:1px solid var(--mv-gold);color:var(--mv-gold);
    font-weight:800;font-size:14px;border-radius:12px;padding:13px}
  /* Tarjetas de bot (estilo compacto Pionex) */
  .op-botc{background:var(--mv-card);border:1px solid var(--mv-line);border-left:3px solid var(--bc,var(--mv-gold));border-radius:14px;padding:12px;margin-bottom:10px}
  .op-botc-h{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  .op-botc-ic{width:38px;height:38px;flex:0 0 auto;border-radius:11px;display:grid;place-items:center}
  .op-botc-ic svg{width:21px;height:21px}
  .op-botc-t{flex:1;min-width:0} .op-botc-t b{font-size:14.5px;display:block} .op-botc-t small{color:var(--mv-mut);font-size:11.5px}
  .op-botc-on{flex:0 0 auto;font-size:10px;font-weight:800;color:var(--mv-up);background:color-mix(in srgb,var(--mv-up) 15%,transparent);padding:3px 8px;border-radius:7px}
  .op-botc-g{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .op-botc-box{background:var(--mv-card2);border:1px solid var(--mv-line);border-radius:10px;padding:8px 10px}
  .op-botc-box span{display:block;color:var(--mv-mut);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
  .op-botc-box b{font-size:15px;display:block;margin-top:3px} .op-botc-box b.up{color:var(--mv-up)} .op-botc-box b.dn{color:var(--mv-down)}

  /* ── Activos (pantalla 4) ── */
  .ac-card{position:relative;background:
      radial-gradient(120% 90% at 100% 0%, rgba(232,184,75,.16), transparent 55%),
      linear-gradient(158deg,#1c2530 0%,#141a22 46%,#0f141b 100%);
    border:1px solid rgba(232,184,75,.22);border-radius:22px;padding:18px 17px;margin-top:6px;overflow:hidden;
    box-shadow:0 18px 40px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.05)}
  .ac-card::after{content:'';position:absolute;right:-40px;bottom:-60px;width:180px;height:180px;border-radius:50%;
    background:radial-gradient(circle,rgba(232,184,75,.10),transparent 70%);pointer-events:none}
  .ac-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .ac-top-r{display:flex;align-items:center;gap:8px}
  .ac-share{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--mv-gold)}
  .ac-share:active{background:rgba(255,255,255,.12)}
  .ac-lbl{display:inline-flex;align-items:center;gap:6px;color:var(--mv-mut);font-size:12.5px;cursor:pointer}
  .ac-lbl svg{width:15px;height:15px;opacity:.85}
  .ac-brand{font-size:13px;font-weight:800;color:var(--mv-gold);white-space:nowrap;letter-spacing:.2px}
  .ac-bal{font-size:36px;font-weight:800;letter-spacing:-.6px;margin:10px 0 2px}
  .ac-sub{color:var(--mv-mut);font-size:12.5px;min-height:16px}
  .ac-acts{display:flex;gap:7px;margin-top:18px}
  .ac-act{flex:1;min-width:0;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:9px 2px;
    display:flex;flex-direction:column;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:var(--mv-txt);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);text-align:center;line-height:1.2}
  .ac-act span{display:grid;place-items:center} .ac-act svg{width:19px;height:19px;color:var(--mv-gold)}
  .ac-act:active{background:rgba(255,255,255,.1)}
  .ac-tabs{display:flex;gap:18px;border-bottom:1px solid var(--mv-line);margin:20px 0 4px}
  .ac-tabs button{padding:10px 0;font-size:15px;font-weight:800;color:var(--mv-txt);position:relative}
  .ac-tabs button.on::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--mv-gold);border-radius:2px}
  .ac-tabs .ac-dust{display:inline-flex;align-items:center;gap:5px;background:color-mix(in srgb,var(--mv-gold) 12%,transparent);
    border:1px solid color-mix(in srgb,var(--mv-gold) 55%,transparent);color:var(--mv-gold);font-size:11.5px;font-weight:700;
    padding:6px 10px;border-radius:9px;margin-bottom:6px}
  .ac-tabs .ac-dust::after{display:none}
  .ac-tabs .ac-dust svg{width:13px;height:13px}
  .ac-row{display:flex;align-items:center;gap:12px;padding:14px 2px;border-bottom:1px solid var(--mv-line)}
  .ac-ci{width:36px;height:36px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background:var(--mv-card2);
    border:1px solid var(--mv-line);font-size:12px;font-weight:800;color:var(--mv-gold)}
  .ac-nm{flex:1;min-width:0} .ac-nm b{font-size:15px} .ac-nm small{display:block;color:var(--mv-mut);font-size:12.5px}
  .ac-am{text-align:right} .ac-am b{font-size:15px}
  .ac-nft-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding-top:8px}
  .ac-nft{background:var(--mv-card);border:1px solid var(--mv-line);border-radius:14px;overflow:hidden}
  .ac-nft-img{aspect-ratio:1;background:var(--mv-card2) center/cover no-repeat;display:grid;place-items:center;font-size:30px}
  .ac-nft-nm{padding:9px 11px;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  /* Aviso de red incorrecta (móvil) */
  #mv-red{position:fixed;left:10px;right:10px;top:calc(10px + env(safe-area-inset-top,0px));z-index:11800;
    background:linear-gradient(180deg,#1c1206,#150e05);border:1px solid var(--mv-gold);border-radius:16px;padding:14px;
    box-shadow:0 16px 40px rgba(0,0,0,.55);max-width:460px;margin:0 auto;animation:mvRedIn .25s ease}
  @keyframes mvRedIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
  #mv-red .mv-red-h{display:flex;align-items:flex-start;gap:10px}
  #mv-red .mv-red-ico{font-size:18px;line-height:1.2;flex:0 0 auto}
  #mv-red .mv-red-tx{flex:1;min-width:0}
  #mv-red .mv-red-tx>b{color:var(--mv-txt);font-size:14.5px;display:block}
  #mv-red .mv-red-tx span{color:var(--mv-mut);font-size:12.5px;line-height:1.4}
  #mv-red .mv-red-tx span b{display:inline;color:var(--mv-gold)}
  #mv-red .mv-red-x{flex:0 0 auto;background:none;border:0;color:var(--mv-mut);font-size:16px;padding:0 2px;cursor:pointer}
  #mv-red .mv-red-btn{width:100%;margin-top:12px;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;
    font-weight:800;font-size:14.5px;border:0;border-radius:12px;padding:13px}
  #mv-red .mv-red-btn:active{filter:brightness(1.05)}
  #mv-red .mv-red-ayuda{margin-top:10px;color:var(--mv-mut);font-size:11.5px;line-height:1.5}
  #mv-red .mv-red-ayuda b{color:var(--mv-txt)}
  #mv-red .mv-red-w{display:block;margin-top:5px;padding-left:2px}
  
/* ── Futuros móvil (extra sobre op-*) ── */
  .op-fmode{display:flex;gap:7px;margin-bottom:8px}
  .op-fmode button{flex:1;height:34px;border-radius:9px;border:1px solid var(--mv-line);background:var(--mv-card);color:var(--mv-mut);font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700}
  .op-fmode button b{color:var(--mv-gold);font-family:inherit}
  .op-flev-top{display:flex;justify-content:space-between;align-items:center;margin:4px 0 2px}
  .op-flev-top span{color:var(--mv-mut);font-size:12px}
  .op-flev-val{color:var(--mv-gold);font-weight:800;font-size:16px}
  .op-finfo{display:flex;flex-direction:column;gap:5px;padding:10px 12px;background:var(--mv-card);border:1px solid var(--mv-line);border-radius:10px}
  .op-finfo .r{display:flex;justify-content:space-between;font-size:12px}
  .op-finfo .r span{color:var(--mv-mut)} .op-finfo .r b{color:var(--mv-txt)} .op-finfo .r b.liq{color:var(--mv-down)}
  .fxm-modal{position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end}
  .fxm-modal .bg{position:absolute;inset:0;background:rgba(3,5,7,.65)}
  .fxm-modal .card{position:relative;width:100%;background:#0e1218;border-top:1px solid #232b36;border-radius:20px 20px 0 0;padding:18px 16px calc(20px + env(safe-area-inset-bottom,0px))}
  .fxm-modal h4{margin:0 0 12px;text-align:center;font-family:'Plus Jakarta Sans';font-weight:800;font-size:17px;color:#eef1f6}
  .fxm-modal .opt{display:block;width:100%;text-align:left;background:rgba(10,14,19,.6);border:1px solid #232b36;border-radius:13px;padding:13px;margin-bottom:9px}
  .fxm-modal .opt.on{border-color:var(--mv-gold);background:rgba(232,184,75,.08)}
  .fxm-modal .opt b{display:block;font-family:'Plus Jakarta Sans';font-weight:800;font-size:15px;color:#eef1f6;margin-bottom:4px}
  .fxm-modal .opt span{display:block;font-size:12px;line-height:1.5;color:#a9b2bd}
`;
  document.head.appendChild(s);
}
