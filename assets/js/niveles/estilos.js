/* niveles/estilos.js — Estilos (CSS) de Smart Levels.
   Inyecta una etiqueta <style> con todo el CSS del overlay. CSS estático,
   sin dependencias. Extraído de niveles.js sin cambios de lógica. */

export function estilos() {
  if (document.getElementById('nv-css')) return;
  const s = document.createElement('style'); s.id = 'nv-css';
  s.textContent = `
  #nv-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center}
  /* El menú de orden (clic derecho para comprar/vender) vive fuera del overlay:
     debe quedar por ENCIMA de él (el overlay subió a 10000 para tapar el
     disparador admin). Se sube aquí sin tocar orden.js. */
  .od-menu,.od-ficha{z-index:10010 !important}
  .od-confirmar-box{z-index:10015 !important}
  #od-pasos{z-index:10016 !important}
  .od-toast{z-index:10018 !important}
  #nv-overlay .nv-bg{position:absolute;inset:0;background:rgba(3,5,8,.95)}
  #nv-overlay .nv-c{position:relative;width:100%;height:100vh;height:100dvh;
    display:flex;flex-direction:column;background:#0b0f16}
  /* ── Superponer: ventana flotante ── */
  #nv-overlay.flotante{pointer-events:none;background:transparent;display:block}
  #nv-overlay.flotante .nv-bg{display:none}
  #nv-overlay.flotante .nv-c{position:fixed;pointer-events:auto;height:auto;width:auto;
    border-radius:14px;overflow:hidden;border:1px solid #2b3139;
    box-shadow:0 26px 80px rgba(0,0,0,.78),0 0 0 1px rgba(255,255,255,.04)}
  #nv-overlay.flotante .nv-cab{cursor:move}
  #nv-overlay.flotante .nv-rz{position:absolute;right:0;bottom:0;width:20px;height:20px;cursor:nwse-resize;z-index:40;
    background:linear-gradient(135deg,transparent 46%,rgba(255,255,255,.35) 46%,rgba(255,255,255,.35) 54%,transparent 54%,transparent 70%,rgba(255,255,255,.35) 70%,rgba(255,255,255,.35) 78%,transparent 78%)}
  #nv-overlay .nv-sup{width:auto;padding:0 12px;display:inline-flex;align-items:center}
  #nv-overlay .nv-sup.on{background:rgba(34,211,238,.16);border-color:rgba(34,211,238,.5);color:#22d3ee}
  #nv-overlay .nv-flot-zoom{display:inline-flex;gap:4px;align-items:center;flex:0 0 auto}
  #nv-overlay .nv-fz{width:30px;height:30px;border-radius:8px;border:1px solid #2b3139;cursor:pointer;
    background:rgba(255,255,255,.05);color:#c9d1d9;font-size:19px;font-weight:700;line-height:1;
    display:grid;place-items:center;font-family:var(--mono,monospace)}
  #nv-overlay .nv-fz:hover{border-color:rgba(34,211,238,.5);background:rgba(34,211,238,.14);color:#22d3ee}
  #nv-overlay .nv-sup-tx{margin-left:7px;font-family:var(--mono,monospace);font-size:12px;font-weight:600}
  @media(max-width:900px){ #nv-overlay .nv-sup{padding:0;width:36px} #nv-overlay .nv-sup-tx{display:none} }

  /* ── Cabecera ── */
  /* [CORREGIDO] La barra recortaba los paneles con overflow. Ahora
     no recorta y queda por encima de la gráfica. */
  #nv-overlay .nv-cab{display:flex;align-items:center;gap:11px;flex:0 0 auto;
    padding:9px 12px;background:#0a0d13;border-bottom:1px solid #1a1f28;
    position:relative;z-index:30;overflow:visible}
  #nv-overlay .nv-cab::-webkit-scrollbar{display:none}
  /* Back arriba-izquierda: COPIA 1:1 del botón de las demás secciones (lq-back) */
  #nv-overlay .nv-back{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;height:36px;padding:0 12px 0 9px;border-radius:9px;
    font-family:var(--sans,inherit);font-size:13px;font-weight:600;color:#8b96a3;background:rgba(255,255,255,.05);
    border:1px solid #2b3139;white-space:nowrap;cursor:pointer}
  #nv-overlay .nv-back svg{width:12px;height:12px}
  #nv-overlay .nv-back:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #nv-overlay .nv-sel{display:inline-flex;align-items:center;gap:9px;flex:0 0 auto;min-height:36px;
    padding:0 12px;border-radius:10px;background:#141922;border:1px solid #2b3139;color:#eaecef;
    cursor:pointer;font-family:var(--mono,monospace);font-size:12.5px}
  #nv-overlay .nv-sel:hover{border-color:var(--gold-soft,#C9A84B)}
  #nv-overlay .nv-sel svg{width:13px;height:13px;opacity:.6}
  .nv-logo{width:20px;height:20px;border-radius:50%;flex:0 0 auto;display:block;
    background:rgba(255,255,255,.06) center/cover no-repeat;border:1px solid #2b3139}
  .nv-logo.con-ico{background:#1c2127;color:#e8ecf2;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;line-height:1}
  .nv-logo.con{background-size:cover;background-position:center}
  .nv-logo.con{background-color:transparent;border-color:transparent}
  #nv-overlay .nv-tfs{display:flex;gap:2px;flex:0 0 auto;padding:3px;background:#141922;border-radius:9px}
  #nv-overlay .nv-tf{min-height:30px;padding:0 13px;border-radius:7px;border:none;background:transparent;
    color:#7d8794;font-family:var(--mono,monospace);font-size:11px;font-weight:700;cursor:pointer}
  #nv-overlay .nv-tf.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800}
  /* Desplegable de temporalidad: IDÉNTICO al de Liquidity/Heat (#lq-tfmenu/#mu-tfmenu):
     rejilla de 3 columnas con todas las TFs. Va en el body (sin #nv-overlay). */
  #nv-tfmenu{position:fixed;z-index:12000;background:#141922;border:1px solid #2b3139;border-radius:14px;
    padding:6px;box-shadow:0 18px 44px rgba(0,0,0,.6);display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;
    min-width:210px;max-height:60vh;overflow-y:auto;animation:nvTfMenu .16s ease}
  @keyframes nvTfMenu{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
  #nv-tfmenu .nv-tfmenu-it{min-height:42px;border-radius:10px;border:1px solid transparent;
    background:rgba(255,255,255,.04);color:#c7cdd6;font-family:var(--mono,monospace);font-weight:700;
    font-size:13px;cursor:pointer}
  #nv-tfmenu .nv-tfmenu-it:hover{border-color:#3a424c;color:#eaecef}
  #nv-tfmenu .nv-tfmenu-it.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);
    color:#3a2800;border-color:var(--gold,#E8B84B)}
  #nv-overlay .nv-estado{display:flex;align-items:center;gap:10px;flex:0 0 auto}
  #nv-overlay .nv-pill{padding:4px 11px;border-radius:20px;font-family:var(--mono,monospace);
    font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px}
  #nv-overlay .nv-pill.sube{background:rgba(46,232,106,.16);color:#3ee88a}
  #nv-overlay .nv-pill.baja{background:rgba(246,70,93,.16);color:#ff6b7a}
  #nv-overlay .nv-pill.lat{background:rgba(139,150,163,.14);color:#9aa5b1}
  #nv-overlay .nv-precio{font-family:"Chakra Petch", system-ui, sans-serif;font-weight:800;font-size:17px;
    color:var(--gold,#E8B84B)}
  #nv-overlay .nv-24h{font-family:var(--mono,monospace);font-weight:700;font-size:11px;
    padding:3px 8px;border-radius:8px;margin-left:1px;white-space:nowrap}
  #nv-overlay .nv-24h.sube{background:rgba(46,232,106,.16);color:#3ee88a}
  #nv-overlay .nv-24h.baja{background:rgba(246,70,93,.16);color:#ff6b7a}
  #nv-overlay .nv-24h.lat{background:rgba(139,150,163,.14);color:#9aa5b1}
  #nv-overlay .nv-der{margin-left:auto;display:flex;gap:6px;flex:0 0 auto}
  #nv-overlay .nv-ico{width:36px;height:36px;min-height:36px;flex:0 0 auto;border-radius:10px;
    display:grid;place-items:center;padding:0;cursor:pointer;
    background:rgba(255,255,255,.05);border:1px solid #2b3139;color:#8b96a3;
    font-family:var(--mono,monospace);font-size:14px;font-weight:700}
  #nv-overlay .nv-ico:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
  #nv-overlay .nv-comof{width:auto;padding:0 14px;border-color:rgba(232,184,75,.4);color:var(--gold,#E8B84B)}
  /* Los botones que llevan ícono + texto deben ir en FILA. La base
     .nv-ico usa grid con una sola celda, que los apilaba (el texto caía
     debajo del ícono). Con flex quedan uno al lado del otro y centrados. */
  #nv-overlay .nv-registrar,
  #nv-overlay .nv-news,
  #nv-overlay .nv-herr-btn{display:inline-flex;flex-direction:row;align-items:center;justify-content:center}
  #nv-overlay .nv-registrar,
  #nv-overlay .nv-news{width:auto;height:36px;padding:0 15px;gap:8px;position:relative;
    border:1px solid #c79426;color:#3a2800;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 48%,#c79426);
    box-shadow:0 2px 0 #9c7016,inset 0 1px 0 rgba(255,255,255,.4)}
  #nv-overlay .nv-registrar:hover,#nv-overlay .nv-news:hover{color:#3a2800;filter:brightness(1.04);
    box-shadow:0 2px 0 #9c7016,0 2px 8px rgba(232,184,75,.22),inset 0 1px 0 rgba(255,255,255,.45)}
  #nv-overlay .nv-registrar:active,#nv-overlay .nv-news:active{transform:translateY(1px);
    box-shadow:0 1px 0 #9c7016,inset 0 1px 0 rgba(255,255,255,.3)}
  #nv-overlay .nv-rg-tx{font-family:"Chakra Petch", system-ui, sans-serif;font-weight:800;font-size:12.5px;white-space:nowrap;letter-spacing:.2px;color:#3a2800}
  #nv-overlay .nv-news .nv-news-dot{position:absolute;top:3px;right:3px;width:7px;height:7px;border-radius:50%;background:#f6465d;box-shadow:0 0 0 0 rgba(246,70,93,.6);animation:nvNewsPulse 2.2s infinite}
  @keyframes nvNewsPulse{0%{box-shadow:0 0 0 0 rgba(246,70,93,.55)}70%{box-shadow:0 0 0 6px rgba(246,70,93,0)}100%{box-shadow:0 0 0 0 rgba(246,70,93,0)}}

  /* ══ Modal Registrar mi indicador ══ */
  #nv-reg-modal{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px}
  #nv-reg-modal .nv-reg-bg{position:absolute;inset:0;background:rgba(3,5,9,.72);backdrop-filter:blur(3px)}
  #nv-reg-modal .nv-reg-card{position:relative;max-width:400px;width:100%;max-height:90vh;overflow:auto;
    background:linear-gradient(180deg,#12161d,#0c1016);border:1px solid rgba(232,184,75,.4);
    border-radius:18px;padding:24px 22px 20px;box-shadow:0 24px 70px rgba(0,0,0,.7);
    font-family:var(--mono,ui-monospace,monospace);color:#eaecef}
  #nv-reg-modal .nv-reg-x{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:9px;
    border:1px solid #2b3139;background:rgba(255,255,255,.04);color:#aeb6bf;cursor:pointer;font-size:14px}
  #nv-reg-modal .nv-reg-x:hover{border-color:var(--gold,#E8B84B);color:var(--gold,#E8B84B)}
  #nv-reg-modal .nv-reg-ico{width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;
    margin:0 auto 14px;
    background:radial-gradient(circle at 50% 40%,rgba(232,184,75,.22),rgba(232,184,75,.05));
    border:1px solid rgba(232,184,75,.45);color:var(--gold,#E8B84B)}
  #nv-reg-modal h3{font-family:"Chakra Petch", system-ui, sans-serif;font-size:20px;font-weight:800;margin:0 0 8px;color:#fff;letter-spacing:.2px;text-align:center}
  #nv-reg-modal .nv-reg-lead{font-size:12.5px;line-height:1.55;color:#c4ccd4;margin:0 0 16px;text-align:center}
  #nv-reg-modal .nv-reg-pasos{display:flex;flex-direction:column;gap:11px;margin-bottom:18px}
  #nv-reg-modal .nv-reg-paso{display:flex;gap:11px;align-items:flex-start}
  #nv-reg-modal .nv-reg-paso>span{flex:0 0 auto;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;
    font-weight:800;font-size:11px;color:#0b0f16;background:var(--gold,#E8B84B);margin-top:1px}
  #nv-reg-modal .nv-reg-paso b{display:block;font-family:"Chakra Petch", system-ui, sans-serif;font-size:12.5px;color:#eaecef;margin-bottom:2px}
  #nv-reg-modal .nv-reg-paso em{font-style:normal;font-size:11px;line-height:1.5;color:#98a1ab}
  #nv-reg-modal .nv-reg-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;
    padding:12px;border-radius:12px;text-decoration:none;font-family:"Chakra Petch", system-ui, sans-serif;font-weight:800;font-size:13.5px;
    color:#3a2800;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 48%,#c79426);
    box-shadow:0 3px 0 #9c7016,0 8px 22px rgba(232,184,75,.28),inset 0 1px 0 rgba(255,255,255,.45)}
  #nv-reg-modal .nv-reg-cta:hover{filter:brightness(1.04)}
  #nv-reg-modal .nv-reg-cta:active{transform:translateY(1px);box-shadow:0 1px 0 #9c7016,inset 0 1px 0 rgba(255,255,255,.3)}
  #nv-reg-modal .nv-reg-pie{font-size:10.5px;line-height:1.5;color:#7d8794;text-align:center;margin:13px 0 0}

  /* ══ Modal de Alertas ══ */
  #nv-al-modal{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px}
  #nv-al-modal .nv-al-bg{position:absolute;inset:0;background:rgba(3,5,9,.72);backdrop-filter:blur(3px)}
  #nv-al-modal .nv-al-card{position:relative;max-width:400px;width:100%;max-height:92vh;overflow:auto;
    background:linear-gradient(180deg,#12161d,#0c1016);border:1px solid rgba(232,184,75,.4);
    border-radius:18px;padding:22px 20px 18px;box-shadow:0 24px 70px rgba(0,0,0,.7);
    font-family:var(--mono,ui-monospace,monospace);color:#eaecef}
  #nv-al-modal .nv-al-x{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:9px;
    border:1px solid #2b3139;background:rgba(255,255,255,.04);color:#aeb6bf;cursor:pointer;font-size:14px}
  #nv-al-modal .nv-al-x:hover{border-color:var(--gold,#E8B84B);color:var(--gold,#E8B84B)}
  #nv-al-modal h3{font-family:"Chakra Petch", system-ui, sans-serif;font-size:19px;font-weight:800;margin:0 0 6px;color:#fff}
  #nv-al-modal .nv-al-lead{font-size:12px;line-height:1.5;color:#c4ccd4;margin:0 0 14px}
  #nv-al-modal .nv-al-estado{font-size:11.5px;color:#c4ccd4;background:rgba(232,184,75,.1);
    border:1px solid rgba(232,184,75,.28);border-radius:10px;padding:8px 10px;margin-bottom:14px;
    display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  #nv-al-modal .nv-al-off{margin-left:auto;padding:4px 10px;border-radius:8px;cursor:pointer;
    border:1px solid #f6465d;background:rgba(246,70,93,.12);color:#ff8a97;font-size:11px;font-weight:700}
  #nv-al-modal .nv-al-inds{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
  #nv-al-modal .nv-al-ind{display:flex;flex-direction:column;align-items:flex-start;gap:2px;
    padding:12px;border-radius:12px;cursor:pointer;text-align:left;
    background:rgba(255,255,255,.035);border:1px solid #2b3139;transition:border-color .15s,background .15s}
  #nv-al-modal .nv-al-ind:hover{border-color:var(--gold-soft,#C9A84B)}
  #nv-al-modal .nv-al-ind.sel{background:rgba(232,184,75,.13);border-color:var(--gold,#E8B84B)}
  #nv-al-modal .nv-al-ic{width:26px;height:26px;color:#8b95a1;margin-bottom:4px}
  #nv-al-modal .nv-al-ic svg{width:22px;height:22px;display:block}
  #nv-al-modal .nv-al-ind.sel .nv-al-ic{color:var(--gold,#E8B84B)}
  #nv-al-modal .nv-al-ind b{font-family:"Chakra Petch", system-ui, sans-serif;font-size:14px;color:#eaecef}
  #nv-al-modal .nv-al-ind.sel b{color:var(--gold,#E8B84B)}
  #nv-al-modal .nv-al-ind em{font-style:normal;font-size:10px;color:#8b95a1}
  #nv-al-modal .nv-al-sub{font-size:12px;color:#c4ccd4;margin-bottom:9px}
  #nv-al-modal .nv-al-conds{display:flex;gap:10px;margin-bottom:14px}
  #nv-al-modal .nv-al-cond{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;
    padding:11px;border-radius:11px;cursor:pointer;font-family:var(--mono,monospace);font-weight:700;font-size:12.5px;
    color:#8b95a1;background:rgba(255,255,255,.035);border:1px solid #2b3139;transition:.15s}
  #nv-al-modal .nv-al-cond .nv-al-dot{width:9px;height:9px;border-radius:50%;opacity:.4;transition:.15s}
  #nv-al-modal .nv-al-cond.on{color:#eaecef;border-color:var(--gold,#E8B84B);background:rgba(232,184,75,.1)}
  #nv-al-modal .nv-al-cond.on .nv-al-dot{opacity:1;box-shadow:0 0 8px currentColor}
  #nv-al-modal .nv-al-go{width:100%;padding:12px;border-radius:12px;cursor:pointer;
    font-family:"Chakra Petch", system-ui, sans-serif;font-weight:800;font-size:13.5px;color:#3a2800;
    border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 48%,#c79426);
    box-shadow:0 3px 0 #9c7016,0 8px 22px rgba(232,184,75,.28),inset 0 1px 0 rgba(255,255,255,.45)}
  #nv-al-modal .nv-al-go:hover{filter:brightness(1.04)}
  #nv-al-modal .nv-al-go:active{transform:translateY(1px);box-shadow:0 1px 0 #9c7016,inset 0 1px 0 rgba(255,255,255,.3)}
  #nv-al-modal .nv-al-nota{font-size:10.5px;line-height:1.5;color:#7d8794;text-align:center;margin:11px 0 0}
  #nv-al-modal .nv-al-faro p{font-size:12px;line-height:1.55;color:#c4ccd4;margin:0 0 10px}
  #nv-al-modal .nv-al-faro ol{margin:0 0 14px;padding-left:20px;display:flex;flex-direction:column;gap:6px}
  #nv-al-modal .nv-al-faro li{font-size:11.5px;line-height:1.45;color:#aeb6bf}
  #nv-al-modal .nv-al-faro li::marker{color:var(--gold,#E8B84B);font-weight:700}
  #nv-overlay .nv-cf-tx{font-family:"Chakra Petch", system-ui, sans-serif;font-weight:700;font-size:12.5px;white-space:nowrap}
  #nv-overlay .nv-cf-s{display:none}

  /* ── La barra de veredicto ── */
  #nv-overlay .nv-veredicto{display:flex;align-items:center;gap:10px;flex:0 0 auto;
    padding:8px 12px;background:#0d1219;border-bottom:1px solid #1a1f28;
    position:relative;z-index:28;overflow:visible;min-height:44px}
  #nv-overlay .nv-meta{margin-left:auto;display:flex;gap:7px;flex:0 0 auto}
  #nv-overlay .nv-v-tag{font-family:var(--mono,monospace);font-size:11px;font-weight:800;
    letter-spacing:1.2px;padding:5px 12px;border-radius:8px}
  #nv-overlay .nv-v-tag.comprar{background:linear-gradient(180deg,#4dffa0,#1fc96e);color:#04210f}
  #nv-overlay .nv-v-tag.vender{background:linear-gradient(180deg,#ff8a95,#e03546);color:#2a0509}
  #nv-overlay .nv-v-tag.esperar{background:rgba(232,184,75,.18);color:var(--gold,#E8B84B);
    border:1px solid rgba(232,184,75,.4)}
  #nv-overlay .nv-v-tx{flex:1;min-width:0;font-family:"Chakra Petch", system-ui, sans-serif;font-weight:700;
    font-size:14px;color:#eaecef;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #nv-overlay .nv-v-hz,#nv-overlay .nv-v-pt{font-family:var(--mono,monospace);font-size:9.5px;
    color:#5c6672;white-space:nowrap;padding:3px 9px;border-radius:20px;background:rgba(255,255,255,.04)}

  /* ── La gráfica ocupa todo ── */
  #nv-overlay .nv-graf{flex:1;min-height:0;position:relative;background:#0b0f16}
  #nv-overlay .nv-cv{display:block}
  /* ── Barra lateral de herramientas de dibujo ── */
  #nv-overlay .nv-tools{position:absolute;left:8px;top:50%;transform:translateY(-50%);z-index:10000;
    display:flex;flex-direction:column;gap:3px;padding:5px;border-radius:13px;
    background:rgba(13,17,24,.82);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
    border:1px solid rgba(255,255,255,.08);box-shadow:0 10px 34px rgba(0,0,0,.55);
    max-height:calc(100% - 20px);overflow-y:auto;scrollbar-width:none}
  #nv-overlay .nv-tools::-webkit-scrollbar{display:none}
  #nv-overlay .nv-tool{width:32px;height:32px;flex:0 0 auto;border-radius:9px;border:none;padding:0;
    background:transparent;color:#98a2ad;cursor:pointer;display:grid;place-items:center;transition:background .14s,color .14s}
  #nv-overlay .nv-tool svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  #nv-overlay .nv-tool:hover{background:rgba(255,255,255,.07);color:#eaecef}
  #nv-overlay .nv-tool.on{background:rgba(34,211,238,.16);color:#22d3ee;box-shadow:inset 0 0 0 1px rgba(34,211,238,.4)}
  #nv-overlay .nv-tool-tg.on{background:rgba(232,184,75,.16);color:var(--gold,#E8B84B);box-shadow:inset 0 0 0 1px rgba(232,184,75,.4)}
  #nv-overlay .nv-tool-sep{height:1px;background:rgba(255,255,255,.1);margin:3px 5px;flex:0 0 auto}
  /* Input de texto en la propia página (no del navegador) */
  #nv-overlay .nv-txt-in{position:absolute;z-index:10002;width:190px;height:32px;padding:0 11px;border-radius:9px;
    background:rgba(13,17,24,.97);border:1px solid #22d3ee;color:#eaecef;outline:none;
    font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:13px;box-shadow:0 10px 28px rgba(0,0,0,.55)}
  #nv-overlay .nv-txt-in::placeholder{color:#5c6672}
  /* Barra auto-ocultable: sale al pasar el cursor por el bisel del borde */
  #nv-overlay .nv-tools.nv-oculta{transform:translate(calc(-100% - 12px),-50%);opacity:0;pointer-events:none;
    transition:transform .22s ease,opacity .22s ease}
  #nv-overlay .nv-tools.nv-oculta.abierta,#nv-overlay .nv-tools.nv-oculta.forz{transform:translate(0,-50%);opacity:1;pointer-events:auto}
  #nv-overlay .nv-tools-tab{position:absolute;left:0;top:50%;transform:translateY(-50%);z-index:9996;pointer-events:none;
    width:9px;height:66px;border-radius:0 8px 8px 0;
    background:linear-gradient(180deg,rgba(34,211,238,.65),rgba(232,184,75,.6));
    box-shadow:2px 0 12px rgba(0,0,0,.5),inset -1px 0 0 rgba(255,255,255,.25);transition:opacity .2s}
  #nv-overlay .nv-tools.abierta ~ .nv-tools-tab,#nv-overlay .nv-tools.forz ~ .nv-tools-tab{opacity:0;pointer-events:none}
  @media(max-width:760px){ #nv-overlay .nv-tools{left:5px;padding:4px;gap:2px}
    #nv-overlay .nv-tool{width:29px;height:29px}
    #nv-overlay .nv-tool svg{width:16px;height:16px} }
  /* ── Barra de ajustes horizontal (arriba) ── */
  #nv-overlay .nv-tool{position:relative}
  #nv-overlay .nv-topbar{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:10000;
    display:flex;align-items:center;gap:3px;padding:6px 8px;border-radius:14px;
    background:linear-gradient(180deg,rgba(24,30,40,.94),rgba(14,18,26,.94));
    -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
    border:1px solid rgba(255,255,255,.12);box-shadow:0 14px 40px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05);
    max-width:calc(100% - 96px);overflow-x:auto;scrollbar-width:none}
  #nv-overlay .nv-topbar::-webkit-scrollbar{display:none}
  #nv-overlay .nv-tb-grip{flex:0 0 auto;width:16px;height:26px;margin-right:2px;cursor:grab;display:inline-flex;align-items:center;justify-content:center;color:#5c6672}
  #nv-overlay .nv-tb-grip:hover{color:#9aa4b0}
  #nv-overlay .nv-tb-grip:active{cursor:grabbing}
  #nv-overlay .nv-tb-b{height:30px;min-width:30px;padding:0 9px;border-radius:9px;border:none;background:transparent;
    color:#c9d1d9;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;
    font-family:var(--mono,monospace);font-size:11px;font-weight:700;line-height:1;transition:background .13s,color .13s}
  #nv-overlay .nv-tb-b:hover{background:rgba(255,255,255,.09)}
  #nv-overlay .nv-tb-b.on{background:rgba(34,211,238,.2);color:#22d3ee;box-shadow:inset 0 0 0 1px rgba(34,211,238,.4)}
  #nv-overlay .nv-tb-pin{color:#7d8794}
  #nv-overlay .nv-tb-pin.on{background:rgba(46,232,106,.18);color:#3ee88a;box-shadow:inset 0 0 0 1px rgba(46,232,106,.4)}
  #nv-overlay .nv-tb-del:hover{background:rgba(255,59,82,.2);color:#ff6b7a}
  #nv-overlay .nv-tb-color{padding:0 6px}
  #nv-overlay .nv-tb-swatch{width:20px;height:20px;border-radius:6px;display:block;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35),0 1px 3px rgba(0,0,0,.5)}
  #nv-overlay .nv-tb-niv{font-size:10.5px;letter-spacing:.3px}
  #nv-overlay .nv-tb-gr{width:32px}
  #nv-overlay .nv-tb-gr i{display:block;width:16px;background:currentColor;border-radius:2px}
  #nv-overlay .nv-tb-sep{width:1px;height:20px;background:rgba(255,255,255,.14);margin:0 3px;flex:0 0 auto}
  /* ── Popups flotantes (color, niveles, líneas) ── */
  #nv-overlay .nv-pop{position:absolute;z-index:10001;padding:8px;border-radius:12px;
    background:linear-gradient(180deg,rgba(24,30,40,.97),rgba(14,18,26,.97));
    -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
    border:1px solid rgba(255,255,255,.13);box-shadow:0 16px 44px rgba(0,0,0,.62)}
  #nv-overlay .nv-pop-col{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;width:184px}
  #nv-overlay .nv-pc{width:22px;height:22px;border-radius:6px;border:2px solid transparent;cursor:pointer;padding:0;
    box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}
  #nv-overlay .nv-pc:hover{border-color:rgba(255,255,255,.85)}
  #nv-overlay .nv-pop-fib{width:210px}
  #nv-overlay .nv-pop-t{font-family:var(--mono,monospace);font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#8b95a1;margin:0 2px 7px}
  #nv-overlay .nv-pf-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
  #nv-overlay .nv-pf{height:26px;border-radius:7px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);
    color:#98a2ad;cursor:pointer;font-family:var(--mono,monospace);font-size:10px;font-weight:700;padding:0}
  #nv-overlay .nv-pf:hover{border-color:rgba(255,255,255,.3);color:#eaecef}
  #nv-overlay .nv-pf.on{background:rgba(34,211,238,.18);border-color:rgba(34,211,238,.5);color:#22d3ee}
  #nv-overlay .nv-pop-fly{display:flex;flex-direction:column;gap:2px;width:158px}
  #nv-overlay .nv-pop-menu{display:flex;flex-direction:column;gap:2px;width:180px}
  #nv-overlay .nv-pm{display:flex;align-items:center;gap:10px;height:36px;padding:0 12px;border-radius:8px;border:none;
    background:transparent;color:#d7dde4;cursor:pointer;font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:12.5px;font-weight:600;text-align:left}
  #nv-overlay .nv-pm:hover{background:rgba(255,255,255,.08)}
  #nv-overlay .nv-pm svg{flex:0 0 auto;color:#9aa4b0}
  #nv-overlay .nv-fl{display:flex;align-items:center;gap:9px;height:34px;padding:0 10px;border-radius:8px;border:none;
    background:transparent;color:#c9d1d9;cursor:pointer;font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:12.5px;font-weight:600}
  #nv-overlay .nv-fl:hover{background:rgba(255,255,255,.08)}
  #nv-overlay .nv-fl.on{background:rgba(34,211,238,.16);color:#22d3ee}
  #nv-overlay .nv-tool-fly{position:relative}
  #nv-overlay .nv-fly-mark{position:absolute;right:2px;bottom:2px;width:0;height:0;border-left:5px solid transparent;border-bottom:5px solid currentColor;opacity:.7}


  /* El logo: se tiene que ver que somos nosotros */
  #nv-overlay .nv-marca{position:absolute;left:64px;bottom:40px;height:42px;width:auto;
    opacity:.85;pointer-events:none;filter:drop-shadow(0 2px 9px rgba(0,0,0,.95))}

  #nv-overlay .nv-esperando{position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:12px;text-align:center;padding:30px;
    background:rgba(11,15,22,.96);z-index:9}
  #nv-overlay .nv-spin{width:38px;height:38px;border-radius:50%;
    border:2.5px solid rgba(232,184,75,.16);border-top-color:var(--gold,#E8B84B);
    animation:nvGira .85s linear infinite}
  @keyframes nvGira{to{transform:rotate(360deg)}}
  #nv-overlay .nv-esperando b{font-family:"Chakra Petch", system-ui, sans-serif;font-weight:800;font-size:17px;color:#eaecef}
  #nv-overlay .nv-esperando span{font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:13px;color:#7d8794;
    max-width:36ch;line-height:1.6}
  #nv-overlay .nv-btn{min-height:44px;padding:0 22px;border-radius:11px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:"Chakra Petch", system-ui, sans-serif;font-weight:800;font-size:13px;cursor:pointer;margin-top:6px}

  /* ══════════════════════════════════════════════════════════
     LAS CÁPSULAS · arriba a la derecha, donde no hay velas
     ══════════════════════════════════════════════════════════ */
  #nv-overlay .nv-burbujas{display:none}
  /* Las cápsulas viven en la barra superior, en horizontal */
  #nv-overlay .nv-caps{display:flex;align-items:center;gap:6px;flex:0 0 auto}
  #nv-overlay .nv-cap{position:relative}

  #nv-overlay .nv-cap-b{display:flex;align-items:center;gap:7px;padding:4px 10px 4px 4px;
    border-radius:20px;cursor:pointer;white-space:nowrap;
    background:rgba(13,17,23,.95);border:1.5px solid #3a424c;
    box-shadow:0 3px 14px rgba(0,0,0,.6);transition:transform .15s}
  #nv-overlay .nv-cap-b:hover{transform:scale(1.04)}
  /* Parpadeo discreto: "tengo algo que decirte" */
  #nv-overlay .nv-cap.avisa .nv-cap-b{animation:nvAvisa 2.6s ease-in-out infinite}
  @keyframes nvAvisa{0%,100%{box-shadow:0 3px 14px rgba(0,0,0,.6)}
                     50%{box-shadow:0 3px 14px rgba(0,0,0,.6),0 0 0 4px rgba(232,184,75,.16)}}
  #nv-overlay .nv-cap.abierto .nv-cap-b{animation:none}
  #nv-overlay .nv-num{width:19px;height:19px;flex:0 0 auto;border-radius:6px;
    display:grid;place-items:center;font-family:"Chakra Petch", system-ui, sans-serif;
    font-weight:800;font-size:11px;background:rgba(255,255,255,.1);color:#b7bdc6}
  #nv-overlay .nv-cap.plan .nv-num{background:linear-gradient(180deg,#f7db8d,#E8B84B);color:#3a2800}
  #nv-overlay .nv-cap.plan .nv-cap-b{border-width:2px}
  #nv-overlay .nv-cap-ava{width:22px;height:22px;border-radius:50%;object-fit:cover;flex:0 0 auto;
    border:1px solid rgba(232,184,75,.5)}
  #nv-overlay .nv-cap-tx{font-family:var(--mono,monospace);font-size:9.5px;font-weight:700;letter-spacing:.6px}
  /* La flecha late como una lucecita: dice "aquí hay algo, tócame" */
  #nv-overlay .nv-cap-fl{font-size:11px;transition:transform .2s;
    animation:nvFlecha 1.8s ease-in-out infinite}
  @keyframes nvFlecha{
    0%,100%{opacity:.35;transform:translateY(0)}
    50%{opacity:1;transform:translateY(1.5px)}}
  #nv-overlay .nv-cap.abierto .nv-cap-fl{transform:rotate(180deg);animation:none;opacity:.6}
  #nv-overlay .t-compra .nv-cap-fl{color:#3ee88a}
  #nv-overlay .t-venta .nv-cap-fl{color:#ff6b7a}
  #nv-overlay .t-aviso .nv-cap-fl{color:var(--gold,#E8B84B)}
  #nv-overlay .t-vigilar .nv-cap-fl,#nv-overlay .t-contexto .nv-cap-fl{color:#9aa5b1}
  #nv-overlay .t-tendencia .nv-cap-fl{color:#6fb0ff}
  #nv-overlay .t-compra .nv-cap-b{border-color:#2ee86a}
  #nv-overlay .t-compra .nv-cap-tx{color:#3ee88a}
  #nv-overlay .t-venta .nv-cap-b{border-color:#f6465d}
  #nv-overlay .t-venta .nv-cap-tx{color:#ff6b7a}
  #nv-overlay .t-aviso .nv-cap-b{border-color:rgba(232,184,75,.75)}
  #nv-overlay .t-aviso .nv-cap-tx{color:var(--gold,#E8B84B)}
  #nv-overlay .t-vigilar .nv-cap-b,#nv-overlay .t-contexto .nv-cap-b{border-color:#5c6672}
  #nv-overlay .t-vigilar .nv-cap-tx,#nv-overlay .t-contexto .nv-cap-tx{color:#9aa5b1}
  #nv-overlay .t-tendencia .nv-cap-b{border-color:#4d9fff}
  #nv-overlay .t-tendencia .nv-cap-tx{color:#6fb0ff}

  /* El panel cuelga de su cápsula, sobre la gráfica */
  #nv-overlay .nv-cap-panel{display:none;position:absolute;top:calc(100% + 9px);left:0;
    z-index:40;width:min(330px, calc(100vw - 24px));
    padding:13px;border-radius:14px;text-align:left;
    background:linear-gradient(165deg,rgba(20,26,35,.985),rgba(11,15,22,.985));
    border:1px solid #3a424c;box-shadow:0 14px 40px rgba(0,0,0,.72);
    max-height:min(62vh, 460px);overflow-y:auto;animation:nvAbrePanel .22s ease both}
  #nv-overlay .nv-cap.abierto .nv-cap-panel{display:block}
  @keyframes nvAbrePanel{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
  #nv-overlay .t-compra .nv-cap-panel{border-color:rgba(46,232,106,.45)}
  #nv-overlay .t-venta .nv-cap-panel{border-color:rgba(246,70,93,.45)}
  #nv-overlay .t-aviso .nv-cap-panel{border-color:rgba(232,184,75,.4)}

  #nv-overlay .nv-pm-cab{display:flex;align-items:center;gap:9px;margin-bottom:9px}
  #nv-overlay .nv-pm-ava{width:32px;height:32px;border-radius:50%;object-fit:cover;flex:0 0 auto;
    border:1.5px solid rgba(232,184,75,.6)}
  #nv-overlay .nv-pm-quien{flex:1;min-width:0}
  #nv-overlay .nv-pm-quien b{display:block;font-family:"Chakra Petch", system-ui, sans-serif;font-weight:800;
    font-size:12px;color:var(--gold,#E8B84B);line-height:1.1}
  #nv-overlay .nv-pm-quien span{display:block;font-family:"Chakra Petch", system-ui, sans-serif;font-weight:700;
    font-size:13.5px;color:#eaecef;line-height:1.25;overflow-wrap:anywhere}
  #nv-overlay .nv-pm-tx{min-height:30px;font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:12.5px;
    color:#b7bdc6;line-height:1.55}
  #nv-overlay .nv-pm-hacer{margin-top:9px;padding:10px 12px;border-radius:10px;
    background:rgba(0,0,0,.38);border-left:2px solid rgba(232,184,75,.6);
    font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:12px;color:#e2e8ee;line-height:1.5}

  /* La tabla del plan de operación */
  #nv-overlay .nv-plan{margin-top:10px;padding:11px;border-radius:11px;
    background:rgba(255,255,255,.035);border:1px solid #2b3139}
  #nv-overlay .nv-plan-t{font-family:var(--mono,monospace);font-size:9px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:1.3px;margin-bottom:8px}
  #nv-overlay .nv-plan-fila{display:flex;align-items:center;gap:8px;padding:5px 0;
    border-bottom:1px solid rgba(255,255,255,.05)}
  #nv-overlay .nv-plan-fila:last-of-type{border-bottom:none}
  #nv-overlay .nv-plan-fila span{flex:1;font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:11.5px;color:#8b96a3}
  #nv-overlay .nv-plan-fila span em{font-style:normal;font-family:var(--mono,monospace);
    font-size:9px;color:#5c6672;margin-left:3px}
  #nv-overlay .nv-plan-fila b{font-family:var(--mono,monospace);font-size:12.5px;color:#eaecef}
  #nv-overlay .nv-plan-fila i{font-style:normal;font-family:var(--mono,monospace);font-size:10px;
    min-width:52px;text-align:right}
  #nv-overlay .nv-plan-fila.entrada b{color:var(--gold,#E8B84B)}
  #nv-overlay .nv-plan-fila.stop b,#nv-overlay .nv-plan-fila.stop i{color:#ff6b7a}
  #nv-overlay .nv-plan-fila.obj b,#nv-overlay .nv-plan-fila.obj i{color:#3ee88a}
  #nv-overlay .nv-plan-pie{margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);
    font-family:var(--mono,monospace);font-size:9.5px;color:#5c6672}
  #nv-overlay .nv-plan-pie b{color:#b7bdc6}

  #nv-overlay .nv-acts{display:flex;gap:6px;margin-top:9px}
  #nv-overlay .nv-pm-mas,#nv-overlay .nv-senala{flex:1;min-height:34px;border-radius:8px;cursor:pointer;
    background:rgba(255,255,255,.04);border:1px solid #2b3139;color:#8b96a3;
    font-family:var(--mono,monospace);font-size:9.5px;letter-spacing:.5px;padding:0 8px}
  #nv-overlay .nv-senala{background:rgba(232,184,75,.12);border-color:rgba(232,184,75,.4);
    color:var(--gold,#E8B84B);font-weight:700}
  /* "Show me where" activo por defecto: cuando está marcando, se rellena. */
  #nv-overlay .nv-senala.on{background:rgba(232,184,75,.3);border-color:var(--gold,#E8B84B);color:#fff}
  /* Botón cuadrado de idioma por analista (ES / EN), arriba a la derecha del popup. */
  #nv-overlay .nv-lang{flex:0 0 auto;align-self:flex-start;width:30px;height:24px;border-radius:7px;cursor:pointer;
    background:rgba(255,255,255,.05);border:1px solid #2b3139;color:#8b96a3;
    font-family:var(--mono,monospace);font-size:10px;font-weight:700;letter-spacing:.5px;padding:0;
    display:flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s,color .15s}
  #nv-overlay .nv-lang:hover{background:rgba(232,184,75,.14);border-color:rgba(232,184,75,.45);color:var(--gold,#E8B84B)}
  #nv-overlay .nv-herr{margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07)}
  #nv-overlay .nv-herr-t{font-family:var(--mono,monospace);font-size:8.5px;color:#5c6672;
    text-transform:uppercase;letter-spacing:1.2px;margin-bottom:6px}
  #nv-overlay .nv-herr-rej{display:flex;flex-direction:column;gap:5px}
  #nv-overlay .nv-herr-b{width:100%;padding:8px 11px;border-radius:9px;cursor:pointer;
    text-align:left;background:rgba(255,255,255,.04);border:1px solid #2b3139}
  #nv-overlay .nv-herr-b b{display:block;font-family:"Chakra Petch", system-ui, sans-serif;
    font-weight:700;font-size:12px;color:#eaecef;margin-bottom:1px}
  #nv-overlay .nv-herr-b span{display:block;font-family:"Plus Jakarta Sans", system-ui, sans-serif;
    font-size:10px;color:#7d8794;line-height:1.3}
  #nv-overlay .nv-herr-b.on{background:rgba(232,184,75,.14);border-color:var(--gold,#E8B84B)}
  #nv-overlay .nv-herr-b.on b{color:var(--gold,#E8B84B)}

  #nv-overlay .nv-pm-det{display:none;margin-top:9px}
  #nv-overlay .nv-cap.con-detalle .nv-pm-det{display:block}
  #nv-overlay .nv-pm-li{font-family:var(--mono,monospace);font-size:10.5px;color:#8b96a3;
    line-height:1.7;padding-left:11px;position:relative}
  #nv-overlay .nv-pm-li:before{content:'·';position:absolute;left:2px;color:#5c6672}

  /* ── Panel de herramientas ── */
  #nv-overlay .nv-herr-btn.activa{border-color:var(--gold,#E8B84B);color:var(--gold,#E8B84B)}
  /* En WEB el botón de indicadores es de TEXTO ("Indicators") con el
     ícono de barras, no un cuadrito de menú (que confundía). */
  #nv-overlay .nv-herr-btn{width:auto;padding:0 13px;gap:7px;
    border-color:rgba(232,184,75,.4);color:var(--gold,#E8B84B)}
  #nv-overlay .nv-herr-btn:hover{border-color:var(--gold,#E8B84B)}
  #nv-overlay .nv-ind-ic{flex:0 0 auto}
  #nv-overlay .nv-ind-tx{font-family:"Chakra Petch", system-ui, sans-serif;font-weight:700;font-size:12.5px;white-space:nowrap}
  /* El botón de indicadores MÓVIL vive junto a "3 lecturas"; en web se
     oculta (allí manda el de texto de la cabecera). */
  #nv-overlay .nv-herr-m{display:none}
  #nv-herr-panel{position:fixed;z-index:10010;width:292px;padding:8px;
    background:linear-gradient(180deg,#1b2027,#0d1117);
    border:1px solid var(--gold-soft,#C9A84B);border-radius:14px;
    box-shadow:0 16px 44px rgba(0,0,0,.75)}
  #nv-herr-panel .nv-hp-t{font-family:var(--mono,monospace);font-size:9px;
    color:var(--gold,#E8B84B);text-transform:uppercase;letter-spacing:1.4px;
    padding:6px 8px 8px}
  #nv-herr-panel .nv-hp-b{display:flex;align-items:flex-start;gap:10px;width:100%;
    padding:10px 11px;margin-bottom:4px;border-radius:10px;cursor:pointer;text-align:left;
    background:rgba(255,255,255,.035);border:1px solid #2b3139}
  #nv-herr-panel .nv-hp-b:hover:not(:disabled){border-color:var(--gold-soft,#C9A84B)}
  #nv-herr-panel .nv-hp-b.on{background:rgba(232,184,75,.14);border-color:var(--gold,#E8B84B)}
  #nv-herr-panel .nv-hp-b.no-hay{opacity:.45;cursor:not-allowed}
  #nv-herr-panel .nv-hp-luz{width:9px;height:9px;border-radius:50%;flex:0 0 auto;margin-top:4px;
    background:#3a424c;border:1px solid #4a525c;transition:background .18s}
  #nv-herr-panel .nv-hp-b.on .nv-hp-luz{background:var(--gold,#E8B84B);
    border-color:var(--gold,#E8B84B);box-shadow:0 0 8px rgba(232,184,75,.6)}
  #nv-herr-panel .nv-hp-tx{flex:1;min-width:0}
  #nv-herr-panel .nv-hp-tx b{display:block;font-family:"Chakra Petch", system-ui, sans-serif;
    font-weight:700;font-size:13px;color:#eaecef;margin-bottom:2px}
  #nv-herr-panel .nv-hp-b.on .nv-hp-tx b{color:var(--gold,#E8B84B)}
  #nv-herr-panel .nv-hp-tx span{display:block;font-family:"Plus Jakarta Sans", system-ui, sans-serif;
    font-size:10.5px;color:#7d8794;line-height:1.4}
  #nv-herr-panel .nv-hp-pie{padding:6px 8px 2px;font-family:var(--mono,monospace);
    font-size:9px;color:#4a525c;text-align:center}
  @media(max-width:560px){
    #nv-herr-panel{left:8px !important;right:8px !important;width:auto !important}
  }

  /* ── Modal de Indicadores (estilo TradingView) ── */
  #nv-ind-modal{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px}
  #nv-ind-modal .nv-ind-bg{position:absolute;inset:0;background:rgba(3,5,9,.72);backdrop-filter:blur(3px)}
  #nv-ind-modal .nv-ind-card{position:relative;display:flex;flex-direction:column;
    width:min(440px,100%);max-height:min(560px,88vh);
    background:linear-gradient(180deg,#12161d,#0c1016);border:1px solid rgba(232,184,75,.4);
    border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.7);overflow:hidden;
    font-family:var(--mono,ui-monospace,monospace);color:#eaecef}
  #nv-ind-modal .nv-ind-head{display:flex;align-items:center;justify-content:space-between;
    padding:16px 16px 10px}
  #nv-ind-modal .nv-ind-head h3{margin:0;font-family:"Chakra Petch", system-ui, sans-serif;font-size:18px;font-weight:800;color:#fff}
  #nv-ind-modal .nv-ind-acc{display:flex;align-items:center;gap:8px;flex:0 0 auto}
  #nv-ind-modal .nv-ind-limpia{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;
    border-radius:9px;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid #2b3139;color:#aeb6bf;
    font-family:var(--mono,monospace)}
  #nv-ind-modal .nv-ind-limpia svg{width:15px;height:15px;display:block}
  #nv-ind-modal .nv-ind-limpia span{font-size:11px;font-weight:700}
  #nv-ind-modal .nv-ind-limpia:hover{border-color:var(--gold-soft,#C9A84B);color:#eaecef}
  #nv-ind-modal .nv-ind-limpia.on{background:rgba(232,184,75,.14);border-color:var(--gold,#E8B84B);color:var(--gold,#E8B84B)}
  @media(max-width:440px){ #nv-ind-modal .nv-ind-limpia span{display:none} #nv-ind-modal .nv-ind-limpia{padding:0;width:30px;justify-content:center} }
  #nv-ind-modal .nv-ind-x{width:30px;height:30px;border-radius:9px;flex:0 0 auto;
    border:1px solid #2b3139;background:rgba(255,255,255,.04);color:#aeb6bf;cursor:pointer;font-size:14px}
  #nv-ind-modal .nv-ind-x:hover{border-color:var(--gold,#E8B84B);color:var(--gold,#E8B84B)}
  #nv-ind-modal .nv-ind-search{display:flex;align-items:center;gap:9px;margin:0 16px 10px;
    padding:0 12px;height:42px;border-radius:11px;background:#0b0e12;border:1px solid #2b3139;color:#8b95a1}
  #nv-ind-modal .nv-ind-search:focus-within{border-color:var(--gold-soft,#C9A84B)}
  #nv-ind-modal .nv-ind-search svg{flex:0 0 auto}
  #nv-ind-modal .nv-ind-search input{flex:1;min-width:0;border:none;background:transparent;outline:none;
    color:#eaecef;font-family:var(--mono,monospace);font-size:13.5px}
  #nv-ind-modal .nv-ind-list{overflow-y:auto;padding:0 10px 6px;display:flex;flex-direction:column;gap:6px}
  #nv-ind-modal .nv-ind-item{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:11px;cursor:pointer;
    background:rgba(255,255,255,.03);border:1px solid #232a32;transition:border-color .15s,background .15s}
  #nv-ind-modal .nv-ind-item:hover{border-color:var(--gold-soft,#C9A84B);background:rgba(255,255,255,.05)}
  #nv-ind-modal .nv-ind-item.on{background:rgba(232,184,75,.12);border-color:var(--gold,#E8B84B)}
  #nv-ind-modal .nv-ind-ic{width:30px;height:30px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;color:#8b95a1}
  #nv-ind-modal .nv-ind-ic svg{width:22px;height:22px;display:block}
  #nv-ind-modal .nv-ind-item.on .nv-ind-ic{color:var(--gold,#E8B84B);filter:drop-shadow(0 0 5px rgba(232,184,75,.45))}
  #nv-ind-modal .nv-ind-tx{flex:1 1 auto;min-width:0}
  #nv-ind-modal .nv-ind-nm{display:flex;align-items:center;gap:7px}
  #nv-ind-modal .nv-ind-nm b{font-family:"Chakra Petch", system-ui, sans-serif;font-weight:700;font-size:14px;color:#eaecef}
  #nv-ind-modal .nv-ind-item.on .nv-ind-nm b{color:var(--gold,#E8B84B)}
  #nv-ind-modal .nv-ind-nm em{font-style:normal;font-family:var(--mono,monospace);font-size:8.5px;
    color:var(--gold,#E8B84B);padding:1px 6px;border-radius:4px;background:rgba(232,184,75,.16)}
  #nv-ind-modal .nv-ind-de{display:block;font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:11px;color:#8b95a1;line-height:1.4;margin-top:3px}
  /* Interruptor tipo switch */
  #nv-ind-modal .nv-ind-sw{flex:0 0 auto;width:38px;height:22px;border-radius:12px;position:relative;
    background:#2b3139;border:1px solid #3a424c;transition:background .18s,border-color .18s}
  #nv-ind-modal .nv-ind-kn{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
    background:#8b95a1;transition:left .18s,background .18s}
  #nv-ind-modal .nv-ind-item.on .nv-ind-sw{background:rgba(232,184,75,.9);border-color:var(--gold,#E8B84B)}
  #nv-ind-modal .nv-ind-item.on .nv-ind-kn{left:18px;background:#1a1205}
  #nv-ind-modal .nv-ind-go{flex:0 0 auto;font-size:20px;color:var(--gold,#E8B84B);line-height:1;padding:0 4px}
  /* Botón "Cómo funciona": "?" siempre; el texto se ve si hay espacio */
  #nv-ind-modal .nv-ind-help{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;
    height:28px;padding:0 9px;border-radius:9px;cursor:pointer;
    background:rgba(232,184,75,.1);border:1px solid rgba(232,184,75,.4);color:var(--gold,#E8B84B);
    font-family:var(--mono,monospace)}
  #nv-ind-modal .nv-ind-help:hover{background:rgba(232,184,75,.2)}
  #nv-ind-modal .nv-ind-help span{font-size:13px;font-weight:800;line-height:1}
  #nv-ind-modal .nv-ind-help em{font-style:normal;font-size:10.5px;font-weight:600;white-space:nowrap}
  @media(max-width:520px){ #nv-ind-modal .nv-ind-help em{display:none} #nv-ind-modal .nv-ind-help{padding:0;width:28px;justify-content:center} }
  #nv-ind-modal .nv-ind-nada{padding:20px;text-align:center;color:#7d8794;font-size:12px}
  #nv-ind-modal .nv-ind-pie{padding:10px 16px 14px;font-family:var(--mono,monospace);
    font-size:9px;color:#5c6672;text-align:center;border-top:1px solid #1c232b}

  /* ── Ventana "Cómo funciona" (encima del modal) ── */
  #nv-guia{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;justify-content:center;padding:16px}
  #nv-guia .nv-guia-bg{position:absolute;inset:0;background:rgba(3,5,9,.7);backdrop-filter:blur(3px)}
  #nv-guia .nv-guia-card{position:relative;display:flex;flex-direction:column;
    width:min(440px,100%);max-height:min(600px,88vh);
    background:linear-gradient(180deg,#12161d,#0c1016);border:1px solid rgba(232,184,75,.45);
    border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.72);overflow:hidden}
  #nv-guia .nv-guia-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:16px 16px 8px}
  #nv-guia .nv-guia-head h3{margin:0;font-family:"Chakra Petch", system-ui, sans-serif;font-size:16px;font-weight:800;color:#fff;line-height:1.3}
  #nv-guia .nv-guia-head h3 span{display:block;font-family:var(--mono,monospace);font-size:9px;font-weight:700;
    letter-spacing:1.4px;text-transform:uppercase;color:var(--gold,#E8B84B);margin-bottom:3px}
  #nv-guia .nv-guia-x{flex:0 0 auto;width:30px;height:30px;border-radius:9px;
    border:1px solid #2b3139;background:rgba(255,255,255,.04);color:#aeb6bf;cursor:pointer;font-size:14px}
  #nv-guia .nv-guia-x:hover{border-color:var(--gold,#E8B84B);color:var(--gold,#E8B84B)}
  #nv-guia .nv-guia-body{overflow-y:auto;padding:4px 18px 18px}
  #nv-guia .nv-guia-body p{margin:0 0 12px;font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:13px;line-height:1.6;color:#c9d1d9}
  #nv-guia .nv-guia-body p:last-child{margin-bottom:0}

  /* ── Selector ── */
  #nv-picker{position:fixed;z-index:10010;min-width:232px;max-height:340px;overflow:hidden;
    display:flex;flex-direction:column;background:linear-gradient(180deg,#1b2027,#0d1117);
    border:1px solid var(--gold-soft,#C9A84B);border-radius:13px;padding:6px;
    box-shadow:0 16px 44px rgba(0,0,0,.72)}
  #nv-picker .nv-buscar{width:100%;box-sizing:border-box;padding:9px 11px;margin-bottom:6px;
    border-radius:9px;border:1px solid #2b3139;background:#0b0e12;color:#eaecef;
    font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:13px;min-height:38px}
  #nv-picker .nv-buscar:focus{outline:none;border-color:var(--gold-soft,#C9A84B)}
  #nv-picker .nv-lista-mon{overflow-y:auto;display:flex;flex-direction:column;gap:2px}
  #nv-picker .nv-filtro{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;
    padding:0 11px;margin-bottom:6px;border-radius:9px;cursor:pointer;
    background:rgba(255,255,255,.04);border:1px solid #2b3139;color:#8b96a3;
    font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:12px;text-align:left}
  #nv-picker .nv-filtro:hover{border-color:var(--gold-soft,#C9A84B)}
  #nv-picker .nv-filtro.on{background:rgba(232,184,75,.14);border-color:var(--gold,#E8B84B);
    color:var(--gold,#E8B84B);font-weight:600}
  #nv-picker .nv-fl-ic{font-size:12px;flex:0 0 auto}
  #nv-picker .nv-op.no-operable b{color:#5c6672}
  #nv-picker .nv-op.no-operable:after{content:'solo análisis';margin-left:auto;
    font-family:var(--mono,monospace);font-size:8px;color:#4a525c;flex:0 0 auto}

  #nv-picker .nv-grupo{font-family:var(--mono,monospace);font-size:8.5px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:1.3px;padding:9px 11px 4px;position:sticky;top:0;
    background:linear-gradient(180deg,#1b2027,#1b2027 70%,transparent)}
  #nv-picker .nv-op{display:flex;align-items:center;gap:9px;width:100%;padding:9px 11px;
    border-radius:9px;background:transparent;border:none;color:#b7bdc6;cursor:pointer;
    text-align:left;min-height:42px}
  #nv-picker .nv-op:hover{background:rgba(255,255,255,.05)}
  #nv-picker .nv-op.on{background:rgba(232,184,75,.1);color:var(--gold,#E8B84B)}
  #nv-picker .nv-op b{font-family:var(--mono,monospace);font-size:12px;font-weight:700;min-width:46px}
  #nv-picker .nv-op span{flex:1;font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:12px;color:#7d8794;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  /* ── Ayuda ── */
  #nv-ayuda-box{position:fixed;inset:0;z-index:10012;display:flex;align-items:center;justify-content:center;padding:16px}
  #nv-ayuda-box .nv-bg{position:absolute;inset:0;background:rgba(3,5,8,.93)}
  #nv-ayuda-box .nva-c{position:relative;width:100%;max-width:540px;max-height:calc(100vh - 32px);
    overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);
    border:1px solid var(--gold-soft,#C9A84B);border-radius:20px;padding:24px 20px}
  #nv-ayuda-box .nva-x{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:10px;
    display:grid;place-items:center;padding:0;cursor:pointer;font-size:15px;z-index:5;
    background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6}
  #nv-ayuda-box .nva-eyebrow{font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:2px;text-align:center;margin-bottom:18px}
  #nv-ayuda-box .nva-card{padding:24px 20px;border-radius:16px;text-align:center;margin-bottom:18px;
    background:linear-gradient(165deg,rgba(232,184,75,.08),rgba(255,255,255,.015));
    border:1px solid rgba(232,184,75,.26)}
  #nv-ayuda-box .nva-n{font-family:var(--mono,monospace);font-size:11px;color:var(--gold,#E8B84B);
    font-weight:700;margin-bottom:10px}
  #nv-ayuda-box .nva-n em{font-style:normal;color:#5c6672;font-weight:400}
  #nv-ayuda-box .nva-t{font-family:"Chakra Petch", system-ui, sans-serif;font-weight:800;font-size:21px;
    color:#eaecef;margin-bottom:12px;line-height:1.25}
  #nv-ayuda-box .nva-d{font-family:"Plus Jakarta Sans", system-ui, sans-serif;font-size:14px;color:#b7bdc6;
    line-height:1.7;margin-bottom:14px}
  #nv-ayuda-box .nva-d b{color:var(--gold,#E8B84B);font-weight:700}
  #nv-ayuda-box .nva-x2{padding:12px 14px;border-radius:11px;background:rgba(255,255,255,.035);
    border-left:2px solid var(--gold-soft,#C9A84B);font-family:"Plus Jakarta Sans", system-ui, sans-serif;
    font-size:12.5px;color:#8b96a3;line-height:1.55;text-align:left}
  #nv-ayuda-box .nva-puntos{display:flex;gap:5px;justify-content:center;margin-bottom:18px;flex-wrap:wrap}
  #nv-ayuda-box .nva-puntos i{width:7px;height:7px;border-radius:50%;background:#2b3139;cursor:pointer}
  #nv-ayuda-box .nva-puntos i.on{background:var(--gold,#E8B84B);transform:scale(1.35)}
  #nv-ayuda-box .nva-acts{display:flex;gap:9px}
  #nv-ayuda-box .nva-atras{flex:0 0 auto;min-height:48px;padding:0 20px;border-radius:12px;
    background:transparent;border:1px solid #2b3139;color:#8b96a3;cursor:pointer;
    font-family:"Chakra Petch", system-ui, sans-serif;font-weight:700;font-size:13px}
  #nv-ayuda-box .nva-b{flex:1;min-height:48px;border-radius:12px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:"Chakra Petch", system-ui, sans-serif;font-weight:800;font-size:14px;cursor:pointer;
    box-shadow:0 4px 0 #8f6a1a}

  /* Pantallas muy estrechas: todo más compacto para que el plan
     quepa sin pelear con el scroll. */
  @media(max-width:360px){
    #nv-overlay .nv-cap-panel{max-height:min(68dvh, 480px);padding:11px}
    #nv-overlay .nv-plan{padding:8px;margin-top:8px}
    #nv-overlay .nv-plan-fila{padding:3px 0}
    #nv-overlay .nv-pm-ava{width:28px;height:28px}
  }

  @media(max-width:760px){
    #nv-overlay .nv-cab{padding:8px 10px;gap:8px}
    #nv-overlay .nv-comof{width:36px;padding:0}
    #nv-overlay .nv-cf-tx{display:none}
    #nv-overlay .nv-cf-s{display:block}
    #nv-overlay .nv-registrar{width:36px;padding:0}
    #nv-overlay .nv-rg-tx{display:none}
    #nv-overlay .nv-precio{font-size:15px}
    /* ══ MÓVIL ══
       Las cápsulas se reducen a un círculo con su número y un punto
       rojo latiendo, para que se vea que hay que tocarlas. */
    #nv-overlay .nv-cap-b{width:34px;height:34px;padding:0;border-radius:50%;
      justify-content:center;position:relative}
    #nv-overlay .nv-cap-ava,#nv-overlay .nv-cap-tx{display:none}
    /* La flecha se convierte en el punto que late */
    #nv-overlay .nv-cap-fl{position:absolute;bottom:-1px;right:-1px;font-size:8px}
    /* Los números 2 y 3 salían en negro sobre fondo oscuro */
    #nv-overlay .nv-num{width:auto;height:auto;background:none !important;
      font-size:14px;color:#eaecef !important}
    #nv-overlay .nv-cap.plan .nv-num{color:var(--gold,#E8B84B) !important}
    #nv-overlay .t-compra .nv-num{color:#3ee88a !important}
    #nv-overlay .t-venta .nv-num{color:#ff6b7a !important}
    #nv-overlay .nv-cap-b:after{content:'';position:absolute;top:1px;right:1px;
      width:8px;height:8px;border-radius:50%;background:#ff3b30;
      border:1.5px solid #0b0f16;animation:nvLate 1.9s ease-in-out infinite}
    @keyframes nvLate{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}
    #nv-overlay .nv-cap.abierto .nv-cap-b:after{display:none}
    /* El panel, a pantalla casi completa */
    /* [CORREGIDO] El panel se cortaba: el max-height en vh no cuenta
       la barra del navegador móvil. Se ancla arriba Y abajo, así
       ocupa exactamente lo que hay disponible. */
    /* [RESUELTO] El panel cabía, pero la tabla del plan quedaba
       por debajo del borde y había que adivinar que existía.

       Ahora el panel se dimensiona con dvh (que sí cuenta la barra
       del navegador móvil), lleva un degradado abajo que avisa de
       que hay más contenido, y desplazamiento suave. */
    #nv-overlay .nv-cap-panel{position:fixed;top:auto;bottom:10px;
      left:8px;right:8px;width:auto;height:auto;
      max-height:min(62dvh, 460px);overflow-y:auto;
      overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
      scroll-behavior:smooth;padding-bottom:22px;
      box-shadow:0 -8px 40px rgba(0,0,0,.8)}
    /* La pista visual de que hay más abajo */
    #nv-overlay .nv-cap.abierto:after{content:'';position:fixed;
      left:9px;right:9px;bottom:11px;height:26px;border-radius:0 0 13px 13px;
      pointer-events:none;z-index:41;
      background:linear-gradient(180deg,transparent,rgba(11,15,22,.96))}
    #nv-overlay .nv-acts{flex-direction:column}
    /* El plan, compacto: cabe entero sin tanto desplazamiento */
    #nv-overlay .nv-plan{padding:9px}
    #nv-overlay .nv-plan-fila{padding:4px 0}
    #nv-overlay .nv-plan-fila span{font-size:11px}
    #nv-overlay .nv-plan-fila b{font-size:12px}
    #nv-overlay .nv-pm-tx{font-size:12px}
    #nv-overlay .nv-pm-hacer{padding:9px 11px;font-size:11.5px}
    /* La barra superior, ordenada en dos filas */
    /* Una sola fila compacta: la banda ancha robaba gráfica */
    #nv-overlay .nv-cab{flex-wrap:nowrap;padding:7px 9px;gap:7px;
      overflow-x:auto;scrollbar-width:none}
    #nv-overlay .nv-cab::-webkit-scrollbar{display:none}
    #nv-overlay .nv-estado{flex:0 0 auto}
    #nv-overlay .nv-pill{padding:3px 8px;font-size:9px}
    #nv-overlay .nv-der{flex:0 0 auto;margin-left:auto}
    #nv-overlay .nv-ico{width:32px;height:32px;min-height:32px}
    /* [CORREGIDO] Las píldoras se cortaban. Ahora tienen su banda
       propia con desplazamiento lateral. */
    #nv-overlay .nv-veredicto{padding:7px 10px;min-height:40px;gap:7px}
    #nv-overlay .nv-caps{flex:1;min-width:0;overflow-x:auto;scrollbar-width:none;
      padding-bottom:1px}
    #nv-overlay .nv-caps::-webkit-scrollbar{display:none}
    #nv-overlay .nv-meta{flex:0 0 auto}
    /* En MÓVIL el botón de indicadores no va en la cabecera (ahí se
       perdía): baja a la banda de lecturas, a la derecha de "3 lecturas",
       con el ícono de barras y un acento dorado para que se vea. No pisa
       las píldoras 1·2·3 (que viven en su propia banda con scroll). */
    #nv-overlay .nv-herr-btn{display:none}
    #nv-overlay .nv-herr-m{display:flex;align-items:center;justify-content:center;
      flex:0 0 auto;width:34px;height:34px;border-radius:10px;cursor:pointer;
      color:var(--gold,#E8B84B);border:1px solid rgba(232,184,75,.5);
      background:linear-gradient(180deg,rgba(232,184,75,.16),rgba(232,184,75,.05))}
    #nv-overlay .nv-herr-m:active{filter:brightness(1.1)}
    #nv-overlay .nv-v-hz{display:none}
    #nv-overlay .nv-marca{height:28px;left:52px;bottom:34px}
    #nv-overlay .nv-chip-tx{font-size:9px}
    #nv-overlay .nv-chip-ava{width:20px;height:20px}
    #nv-overlay .nv-pm-quien span{font-size:12.5px}
    #nv-overlay .nv-pm-tx{font-size:12px}
    #nv-overlay .nv-marca{height:26px;left:50px;bottom:34px}
    #nv-ayuda-box .nva-c{padding:20px 14px}
  }`;
  /* [BARRA COMPARTIDA] La misma barra de herramientas se monta también en
     Heat Pools y Liquidity Pools dentro de un contenedor .nv-host. Se copian
     SOLO las reglas de la barra (popups, ajustes, pestaña) cambiando el
     ámbito #nv-overlay → .nv-host, sin duplicar a mano ni tocar el resto. */
  const base = s.textContent;
  /* Se quitan comentarios y los bloques @media completos (llaves balanceadas):
     las reglas de móvil de la barra no deben copiarse sin su condición. */
  let zona = base.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let k = zona.indexOf('@media'); k >= 0; k = zona.indexOf('@media')) {
    let i = zona.indexOf('{', k), prof = 0;
    for (; i < zona.length; i++) { if (zona[i] === '{') prof++; else if (zona[i] === '}' && --prof === 0) break; }
    zona = zona.slice(0, k) + zona.slice(i + 1);
  }
  const TOK = ['.nv-tool', '.nv-tools', '.nv-fly', '.nv-topbar', '.nv-tb-', '.nv-pop', '.nv-pc', '.nv-pf', '.nv-fl', '.nv-txt-in', '.nv-goma', '.nv-tools-tab'];
  const copia = [];
  zona.replace(/([^{}]+)\{([^{}]*)\}/g, (m, sel, cuerpo) => {
    const sl = sel.trim();
    if (sl.indexOf('#nv-overlay') === 0 && TOK.some((t) => sl.indexOf(t) >= 0) && sl.indexOf('.nv-pm') < 0) {
      copia.push(sl.split(',').map((x) => x.trim().replace(/^#nv-overlay/, '.nv-host')).join(',') + '{' + cuerpo + '}');
    }
    return m;
  });
  s.textContent = base + '\n' + copia.join('\n');
  document.head.appendChild(s);
}
