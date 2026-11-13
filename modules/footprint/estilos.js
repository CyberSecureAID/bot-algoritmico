/* modules/footprint/estilos.js — Estilos de Footprint Pro.
   Mismo tema, marca y paleta que el resto de Análisis (oro, verde/rojo de
   mercado, fondo oscuro, Chakra Petch / IBM Plex Mono). Solo lo propio del
   footprint: barra, modos, analista, alertas, menús, tooltip. */

export function estilosFootprint() {
  if (document.getElementById('fp-css')) return;
  const s = document.createElement('style'); s.id = 'fp-css';
  s.textContent = `
  #fp-overlay{position:fixed;inset:0;z-index:9600;font-family:var(--sans,'Plus Jakarta Sans',system-ui,sans-serif);color:#eaecef}
  #fp-overlay .fp-bg{position:absolute;inset:0;background:rgba(4,6,10,.92);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  #fp-overlay .fp-wrap{position:absolute;inset:0;display:flex;flex-direction:column;background:#0a0e14}

  /* ── Barra superior ── */
  #fp-overlay .fp-top{display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:8px 10px;
    background:linear-gradient(180deg,#141922,#0d1117);border-bottom:1px solid #2b3139;overflow-x:auto;scrollbar-width:none}
  #fp-overlay .fp-top::-webkit-scrollbar{display:none}
  #fp-overlay .fp-back{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;height:36px;padding:0 13px 0 10px;border-radius:9px;border:1px solid #2b3139;
    background:rgba(255,255,255,.04);color:#b7bdc6;cursor:pointer;font-family:var(--display,'Chakra Petch',system-ui);font-weight:700;font-size:13px}
  #fp-overlay .fp-back svg{width:14px;height:14px}
  #fp-overlay .fp-back:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #fp-overlay .fp-sep{width:1px;height:24px;background:#2b3139;flex:0 0 auto}
  #fp-overlay .fp-coin{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;min-height:38px;padding:0 12px;border-radius:10px;
    background:#12161c;border:1px solid #2b3139;color:#eaecef;cursor:pointer;font-family:var(--display,'Chakra Petch',system-ui)}
  #fp-overlay .fp-coin:hover{border-color:var(--gold-soft,#C9A84B)}
  #fp-overlay .fp-coin-lg{width:24px;height:24px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;
    background:#0b0e12 center/cover no-repeat;border:1px solid #3a424c;font-size:11px;font-weight:800;color:#8b96a3}
  #fp-overlay .fp-coin-lg.con{border-color:transparent;color:transparent}
  #fp-overlay .fp-coin b{font-weight:800;font-size:14px}
  #fp-overlay .fp-coin span{font-size:11.5px;color:#7d8794;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #fp-overlay .fp-chev{font-style:normal;color:#6b7681;font-size:10px}
  #fp-overlay .fp-chip{flex:0 0 auto;min-height:38px;padding:0 12px;border-radius:10px;background:#12161c;border:1px solid #2b3139;
    color:#eaecef;cursor:pointer;font-family:var(--mono,'IBM Plex Mono',monospace);font-size:12.5px;font-weight:600}
  #fp-overlay .fp-chip:hover{border-color:var(--gold-soft,#C9A84B)}
  #fp-overlay .fp-pxbox{display:flex;flex-direction:column;justify-content:center;flex:0 0 auto;padding:0 4px;min-width:90px}
  #fp-overlay .fp-px{font-family:var(--mono,'IBM Plex Mono',monospace);font-size:15px;font-weight:700;line-height:1.1}
  #fp-overlay .fp-chg{font-family:var(--mono,'IBM Plex Mono',monospace);font-size:11px}
  #fp-overlay .fp-chg.up{color:#2ee86a}#fp-overlay .fp-chg.down{color:#f6465d}
  #fp-overlay .fp-modes{display:flex;gap:3px;flex:0 0 auto;background:#0b0e12;border:1px solid #2b3139;border-radius:10px;padding:3px}
  #fp-overlay .fp-modes button{min-height:30px;padding:0 12px;border-radius:7px;border:none;background:transparent;color:#8b96a3;
    cursor:pointer;font-family:var(--display,'Chakra Petch',system-ui);font-weight:700;font-size:12px;white-space:nowrap}
  #fp-overlay .fp-modes button.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800}
  #fp-overlay .fp-modes button:not(.on):hover{color:#eaecef}
  #fp-overlay .fp-top-r{display:flex;gap:5px;flex:0 0 auto}
  #fp-overlay .fp-ico{width:38px;height:38px;flex:0 0 auto;border-radius:9px;display:grid;place-items:center;cursor:pointer;
    background:rgba(255,255,255,.05);border:1px solid #2b3139;color:#b7bdc6;font-size:16px}
  #fp-overlay .fp-ico:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #fp-overlay .fp-snd.on{border-color:var(--gold,#E8B84B);color:var(--gold,#E8B84B);background:rgba(232,184,75,.12)}

  /* ── Escenario: gráfica (1fr) + columna del analista a la derecha ── */
  #fp-overlay .fp-stage{flex:1;min-height:0;display:grid;grid-template-columns:1fr 304px}
  #fp-overlay .fp-cvwrap{position:relative;min-width:0;border-right:1px solid #2b3139}
  #fp-overlay .fp-cv{position:absolute;inset:0}

  /* ── Marca de agua: logo, MISMO tamaño/ubicación/intensidad que las demás
     secciones (nv-marca / it-wm / td-wm: left 64, bottom 40, alto 42, .82) ── */
  #fp-overlay .fp-wm{position:absolute;left:64px;bottom:40px;z-index:4;display:flex;align-items:center;pointer-events:none;opacity:.82}
  #fp-overlay .fp-wm img{height:42px;width:auto;display:block;filter:drop-shadow(0 2px 9px rgba(0,0,0,.95))}

  /* ── Carga: MISMO patrón que el resto de Análisis (spinner simple, sin logo) ── */
  #fp-overlay .fp-loading{position:absolute;inset:0;z-index:12;display:flex;align-items:center;justify-content:center;background:#0a0e14;transition:opacity .35s ease}
  #fp-overlay .fp-loading.hide{opacity:0;pointer-events:none}
  #fp-overlay .fp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;font-family:var(--mono,'IBM Plex Mono',monospace);font-size:12px;color:#7d8794}
  #fp-overlay .fp-spin{width:24px;height:24px;border-radius:50%;border:2.5px solid #2a333f;border-top-color:var(--gold,#E8B84B);animation:fpGira .7s linear infinite}
  @keyframes fpGira{to{transform:rotate(360deg)}}
  @media(prefers-reduced-motion:reduce){#fp-overlay .fp-spin{animation:none}}

  /* ── Etiqueta de fuente de datos ── */
  #fp-overlay .fp-src{position:absolute;left:10px;bottom:8px;z-index:5;font-family:var(--mono,'IBM Plex Mono',monospace);
    font-size:10px;color:#6b7681;background:rgba(10,14,20,.72);padding:4px 9px;border-radius:7px;border:1px solid #20262e;pointer-events:none}

  /* ── Tooltip ── */
  #fp-overlay .fp-tip{position:absolute;z-index:20;min-width:124px;padding:9px 11px;border-radius:10px;pointer-events:none;
    background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid var(--gold-soft,#C9A84B);box-shadow:0 12px 34px rgba(0,0,0,.6)}
  #fp-overlay .fp-tip-p{font-family:var(--mono,'IBM Plex Mono',monospace);font-size:13px;font-weight:700;color:var(--gold,#E8B84B);margin-bottom:5px}
  #fp-overlay .fp-tip-r{display:flex;justify-content:space-between;gap:14px;font-family:var(--mono,'IBM Plex Mono',monospace);font-size:11.5px;color:#b7bdc6;margin-top:2px}
  #fp-overlay .fp-tip-r .s{color:#f6465d}#fp-overlay .fp-tip-r .b{color:#2ee86a}
  #fp-overlay .fp-tip-r b.up{color:#2ee86a}#fp-overlay .fp-tip-r b.down{color:#f6465d}

  /* ── Alertas ── */
  #fp-overlay .fp-alerts{position:absolute;right:12px;bottom:40px;z-index:15;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
  #fp-overlay .fp-toast{min-width:180px;padding:10px 13px;border-radius:11px;background:linear-gradient(180deg,#1b2027,#0d1117);
    border:1px solid #3a424c;box-shadow:0 10px 28px rgba(0,0,0,.55);animation:fpIn .3s ease}
  #fp-overlay .fp-toast.out{opacity:0;transform:translateX(12px);transition:all .35s ease}
  #fp-overlay .fp-toast b{display:block;font-family:var(--display,'Chakra Petch',system-ui);font-size:13px}
  #fp-overlay .fp-toast span{display:block;font-family:var(--mono,'IBM Plex Mono',monospace);font-size:10.5px;color:#8b96a3;margin-top:2px}
  #fp-overlay .fp-toast.t-up{border-left:3px solid #2ee86a}#fp-overlay .fp-toast.t-up b{color:#2ee86a}
  #fp-overlay .fp-toast.t-down{border-left:3px solid #f6465d}#fp-overlay .fp-toast.t-down b{color:#f6465d}
  @keyframes fpIn{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}

  /* ── Temporizador de la vela (barra superior, grande) ── */
  #fp-overlay .fp-timer{flex:0 0 auto;margin-left:auto;min-width:58px;padding:0 13px;min-height:34px;display:inline-flex;align-items:center;justify-content:center;
    border-radius:9px;background:#0b0e12;border:1px solid #2b3139;color:#eaecef;font-family:var(--mono,'IBM Plex Mono',monospace);font-weight:800;font-size:16px;letter-spacing:.5px}
  #fp-overlay .fp-timer.urge{color:var(--rojo,#f6465d);border-color:rgba(246,70,93,.5)}

  /* ── Analista: COLUMNA vertical a la derecha, activo en vivo ── */
  #fp-overlay .fp-an-col{position:relative;min-width:0;overflow-y:auto;padding:14px 14px 18px;display:flex;flex-direction:column;gap:12px;
    background:linear-gradient(180deg,#0f141b,#0b0e12)}
  #fp-overlay .fp-an-col::-webkit-scrollbar{width:7px}
  #fp-overlay .fp-an-col::-webkit-scrollbar-thumb{background:#273039;border-radius:6px}
  #fp-overlay .fp-anc-head{display:flex;align-items:center;gap:10px;flex:0 0 auto}
  #fp-overlay .fp-anc-ava{width:38px;height:38px;border-radius:50%;flex:0 0 auto;object-fit:cover;border:1px solid var(--gold-soft,#C9A84B)}
  #fp-overlay .fp-anc-id{flex:1;min-width:0}
  #fp-overlay .fp-anc-id b{display:block;font-family:var(--display,'Chakra Petch',system-ui);font-size:15px;color:#eaecef;line-height:1.1}
  #fp-overlay .fp-anc-id span{display:block;font-family:var(--mono,'IBM Plex Mono',monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold,#E8B84B);margin-top:2px}
  #fp-overlay .fp-anc-lang{flex:0 0 auto;min-height:28px;padding:0 10px;border-radius:8px;border:1px solid #2b3139;background:rgba(255,255,255,.05);color:#b7bdc6;cursor:pointer;font-family:var(--mono,monospace);font-size:11px;font-weight:700}
  #fp-overlay .fp-anc-lang:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #fp-overlay .fp-anc-live{display:flex;align-items:center;gap:8px;flex:0 0 auto}
  #fp-overlay .fp-anc-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:#26c281;box-shadow:0 0 0 0 rgba(38,194,129,.5);animation:fpPulso 1.6s ease-in-out infinite}
  @keyframes fpPulso{0%,100%{box-shadow:0 0 0 0 rgba(38,194,129,.5)}50%{box-shadow:0 0 0 6px rgba(38,194,129,0)}}
  #fp-overlay .fp-anc-live>span{font-family:var(--mono,monospace);font-size:10px;letter-spacing:.14em;color:#8b96a3}
  #fp-overlay .fp-anc-tag{margin-left:auto;font-style:normal;font-family:var(--mono,monospace);font-size:11px;font-weight:800;letter-spacing:.06em;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,.06)}
  #fp-overlay .fp-anc-tag.c-compra,#fp-overlay .fp-anc-tag.c-tendencia{background:rgba(38,194,129,.16);color:#26c281}
  #fp-overlay .fp-anc-tag.c-venta,#fp-overlay .fp-anc-tag.c-aviso{background:rgba(232,68,93,.16);color:#e8445d}
  #fp-overlay .fp-anc-tag.c-vigilar{background:rgba(232,184,75,.16);color:var(--gold,#E8B84B)}
  #fp-overlay .fp-anc-stats{display:grid;grid-template-columns:1fr 1fr;gap:7px;flex:0 0 auto}
  #fp-overlay .fp-anc-st{background:rgba(255,255,255,.03);border:1px solid #1d242d;border-radius:9px;padding:7px 9px}
  #fp-overlay .fp-anc-st span{display:block;font-family:var(--mono,monospace);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#7d8794;margin-bottom:3px}
  #fp-overlay .fp-anc-st b{font-family:var(--mono,monospace);font-size:14px;font-weight:800;color:#eaecef}
  #fp-overlay .fp-anc-st b.up{color:#26c281}#fp-overlay .fp-anc-st b.down{color:#e8445d}
  #fp-overlay .fp-anc-title{flex:0 0 auto;font-family:var(--display,'Chakra Petch',system-ui);font-weight:800;font-size:15.5px;line-height:1.25;color:#eaecef}
  #fp-overlay .fp-an-col.t-compra .fp-anc-title,#fp-overlay .fp-an-col.t-tendencia .fp-anc-title{color:#4bd79b}
  #fp-overlay .fp-an-col.t-venta .fp-anc-title,#fp-overlay .fp-an-col.t-aviso .fp-anc-title{color:#ff7183}
  #fp-overlay .fp-an-col.t-vigilar .fp-anc-title{color:var(--gold,#E8B84B)}
  #fp-overlay .fp-anc-tx{flex:0 0 auto;font-size:13px;line-height:1.6;color:#c7ccd4;min-height:20px}
  #fp-overlay .fp-anc-do{flex:0 0 auto;padding:10px 12px;border-radius:10px;background:rgba(232,184,75,.08);border:1px solid rgba(232,184,75,.22);font-size:12.5px;line-height:1.55;color:#eaecef}
  #fp-overlay .fp-anc-do span{display:block;font-family:var(--mono,monospace);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold,#E8B84B);margin-bottom:4px}
  #fp-overlay .fp-anc-why{flex:0 0 auto;display:flex;flex-direction:column}
  #fp-overlay .fp-anc-li{font-family:var(--mono,'IBM Plex Mono',monospace);font-size:11px;color:#8b96a3;line-height:1.5;padding:6px 0;border-top:1px solid rgba(255,255,255,.05)}
  #fp-overlay .fp-anc-disc{margin-top:auto;padding-top:10px;font-size:10px;color:#6b7681;font-style:italic;border-top:1px solid rgba(255,255,255,.05)}
  #fp-overlay .fp-anc-wait{display:flex;align-items:center;gap:8px;font-family:var(--mono,monospace);font-size:12px;color:#7d8794}

  /* ── Iconos SVG centrados + logos SVG de divisas (EUR/GBP) ── */
  #fp-overlay .fp-ico svg,#fp-overlay .fp-back svg{display:block}
  #fp-overlay .fp-coin-lg svg,.fp-mi-lg svg{width:100%;height:100%;display:block}
  #fp-overlay .fp-coin-lg.con-svg,.fp-mi-lg.con-svg{background:none;border-color:transparent;overflow:hidden}

  /* ── Ayuda (How it works) ── */
  #fp-overlay .fp-help{position:absolute;inset:0;z-index:9690;display:flex;align-items:center;justify-content:center;padding:18px}
  #fp-overlay .fp-help-bg{position:absolute;inset:0;background:rgba(4,6,10,.82);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}
  #fp-overlay .fp-help-c{position:relative;width:100%;max-width:560px;max-height:calc(100vh - 56px);overflow-y:auto;border-radius:18px;padding:20px 22px;
    background:linear-gradient(180deg,#141922,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);box-shadow:0 24px 60px rgba(0,0,0,.7)}
  #fp-overlay .fp-help-cab{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  #fp-overlay .fp-help-cab h3{margin:0;font-family:var(--display,'Chakra Petch',system-ui);font-size:19px;color:var(--gold,#E8B84B)}
  #fp-overlay .fp-help-x{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;cursor:pointer;background:rgba(255,255,255,.05);border:1px solid #3a424c;color:#b7bdc6;font-size:14px}
  #fp-overlay .fp-help-lead{font-size:13px;line-height:1.6;color:#b7bdc6;margin:0 0 14px}
  #fp-overlay .fp-help-lead b{color:#eaecef}
  #fp-overlay .fp-h-row{display:flex;gap:13px;align-items:center;padding:11px 0;border-top:1px solid rgba(255,255,255,.06)}
  #fp-overlay .fp-h-ic{flex:0 0 auto;width:78px}
  #fp-overlay .fp-h-svg{width:78px;height:auto;border-radius:6px;background:#0b0e12;display:block}
  #fp-overlay .fp-h-tx b{display:block;font-family:var(--display,'Chakra Petch',system-ui);font-size:13.5px;color:#eaecef;margin-bottom:3px}
  #fp-overlay .fp-h-tx span{display:block;font-size:12px;line-height:1.55;color:#8b96a3}
  #fp-overlay .fp-help-note{margin-top:14px;padding:12px 14px;border-radius:11px;background:rgba(232,184,75,.07);border:1px solid rgba(232,184,75,.2);font-size:12px;line-height:1.55;color:#b7bdc6}
  #fp-overlay .fp-help-note b{color:var(--gold,#E8B84B)}
  #fp-overlay .fp-help-disc{margin:0 0 14px;padding:10px 13px;border-radius:10px;background:rgba(246,70,93,.08);border:1px solid rgba(246,70,93,.25);font-size:12px;line-height:1.5;color:#d8b0b6}
  #fp-overlay .fp-help-disc b{color:#f6465d}
  #fp-overlay .fp-tip-won{margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,.08);font-family:var(--display,'Chakra Petch',system-ui);font-weight:700;font-size:12px;text-align:center}
  #fp-overlay .fp-tip-won.up{color:#26c281}#fp-overlay .fp-tip-won.down{color:#e8445d}

  /* ── Disclaimer de entrada (una vez) ── */
  .fp-disc{position:fixed;inset:0;z-index:9800;display:flex;align-items:center;justify-content:center;padding:20px}
  .fp-disc-bg{position:absolute;inset:0;background:rgba(4,6,10,.88);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  .fp-disc-c{position:relative;width:100%;max-width:440px;border-radius:18px;padding:24px 22px;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);box-shadow:0 24px 60px rgba(0,0,0,.7);text-align:center}
  .fp-disc-c h4{margin:0 0 10px;font-family:var(--display,'Chakra Petch',system-ui);font-size:19px;color:var(--gold,#E8B84B)}
  .fp-disc-c p{font-size:13.5px;line-height:1.6;color:#b7bdc6;margin:0 0 18px}
  .fp-disc-c p b{color:#eaecef}
  .fp-disc-ok{min-height:46px;padding:0 28px;border-radius:11px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;font-family:var(--display,'Chakra Petch',system-ui);font-weight:800;font-size:14px;cursor:pointer}

  /* ── Menús (moneda / temporalidad) ── */
  .fp-menu{position:fixed;z-index:9650;background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid var(--gold-soft,#C9A84B);
    border-radius:13px;padding:8px;box-shadow:0 18px 46px rgba(0,0,0,.7)}
  .fp-coinmenu{width:264px;max-height:360px;display:flex;flex-direction:column}
  .fp-mbuscar{width:100%;box-sizing:border-box;padding:9px 11px;margin-bottom:6px;border-radius:9px;border:1px solid #2b3139;background:#0b0e12;color:#eaecef;font-size:13px}
  .fp-mbuscar:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  .fp-mlista{overflow-y:auto;display:flex;flex-direction:column;gap:2px}
  .fp-mi{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:9px;border:none;background:transparent;color:#eaecef;cursor:pointer;text-align:left}
  .fp-mi:hover{background:rgba(255,255,255,.05)}.fp-mi.on{background:rgba(232,184,75,.12)}
  .fp-mi-lg{width:24px;height:24px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;background:#0b0e12 center/cover no-repeat;border:1px solid #3a424c;font-size:10px;font-weight:800;color:#8b96a3}
  .fp-mi-lg.con{border-color:transparent}
  .fp-mi b{font-family:var(--mono,monospace);font-size:12.5px;font-weight:700;min-width:52px}
  .fp-mi span{flex:1;font-size:11.5px;color:#7d8794;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fp-tfmenu{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;width:220px}
  .fp-tfi{min-height:36px;border-radius:8px;border:1px solid #2b3139;background:#12161c;color:#b7bdc6;cursor:pointer;font-family:var(--mono,monospace);font-size:12px;font-weight:700}
  .fp-tfi:hover{border-color:var(--gold-soft,#C9A84B)}.fp-tfi.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800;border-color:#c79426}

  /* ── Popup de ajustes ── */
  #fp-overlay .fp-pop{position:absolute;z-index:30;width:240px;padding:14px;border-radius:13px;
    background:linear-gradient(180deg,#1b2027,#0d1117);border:1px solid var(--gold-soft,#C9A84B);box-shadow:0 18px 46px rgba(0,0,0,.7)}
  #fp-overlay .fp-pop-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
  #fp-overlay .fp-pop-row label{font-size:12.5px;color:#b7bdc6}
  #fp-overlay .fp-pop-row input{width:100px;padding:8px 10px;border-radius:8px;border:1px solid #2b3139;background:#0b0e12;color:#eaecef;font-family:var(--mono,monospace);font-size:12.5px}
  #fp-overlay .fp-pop-row input:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  #fp-overlay .fp-pop-apply{width:100%;min-height:40px;border-radius:10px;border:1px solid #c79426;margin-top:4px;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;font-family:var(--display,'Chakra Petch',system-ui);font-weight:800;font-size:13px;cursor:pointer}
  #fp-overlay .fp-pop-note{margin-top:9px;font-size:10.5px;color:#6b7681;line-height:1.5}

  @media(max-width:860px){
    #fp-overlay .fp-stage{grid-template-columns:1fr;grid-template-rows:1fr auto}
    #fp-overlay .fp-cvwrap{border-right:none;border-bottom:1px solid #2b3139}
    #fp-overlay .fp-an-col{max-height:42vh}
    #fp-overlay .fp-anc-why{display:none}
  }
  @media(max-width:720px){
    #fp-overlay .fp-coin span{display:none}
  }`;
  document.head.appendChild(s);
}
