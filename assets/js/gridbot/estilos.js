/* gridbot/estilos.js — Todo el CSS de la app de bots (inyecta la etiqueta
   <style> del overlay) y monta el popup, el modal de confirmación y el
   fallback de logos. Recibe tipoNum() por parámetro (número/texto según
   móvil). Extraído de gridbot-ui.js sin cambiar la lógica. */

const $ = (id) => document.getElementById(id);
const CARET = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23C9A84B' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E";

export function inyectarEstilo(tipoNum) {
  if ($('colmena-css')) return;
  const s = document.createElement('style'); s.id = 'colmena-css';
  s.textContent = `
  #colmena-app{
    --panel:#1b2027; --panel-2:#12161c;
    --ink:#eaecef; --ink-2:#b7bdc6; --ink-3:#7d8794;
    --line:#2b3139; --line-soft:rgba(255,255,255,.055);
    --neon:#12d18e; --neon-lit:#2ee86a; --neon-dim:rgba(14,203,129,.38);
    --rojo:#f6465d;
    --az:#4d9fff; --mo:#b47cff; --ve:#34d97b;   /* acentos por bot */
    --acento:var(--gold);                          /* color del bot seleccionado (lo fija pintarTipo) */
    --ac-l:#f7db8d; --ac-m:#E8B84B; --ac-d:#c79426; --ac-s:#8f6a1a; --ac-t:#3a2800;  /* set 3D del acento (pintarTipo) */
    font-family:var(--sans);color:var(--ink);position:relative;isolation:isolate;
    background:#0b0e11;min-height:100vh;overflow-x:hidden}
  #colmena-app .c-hdr{max-width:100%;overflow:visible;position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;
    gap:12px;padding:14px 22px;background:rgba(11,14,17,.88);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
  #colmena-app .c-brand{display:inline-flex;align-items:center;gap:9px;font-family:var(--display);font-weight:700;font-size:20px;color:var(--gold);text-decoration:none;letter-spacing:.3px;min-width:0}
  #colmena-app .c-logo{height:32px;width:auto;flex:0 0 auto;display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,.55))}
  #colmena-app .c-brand-tx{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  #colmena-app .c-hdr-r{display:flex;align-items:center;gap:6px;flex:0 1 auto;min-width:0;flex-wrap:nowrap;overflow:visible}
  /* El botón del header se ajusta a su texto. Sin esto, la regla general
     .btn{width:100%} lo estira a todo el ancho y saca el header de la pantalla. */
  #colmena-app .c-hdr .hdr-btn,#colmena-app .c-hdr-r .hdr-btn{width:auto;flex:0 0 auto;white-space:nowrap}
  #colmena-app .c-hdr-r>button,#colmena-app .c-hdr-r>a{flex:0 0 auto;white-space:nowrap}
  /* Si no cabe todo (p. ej. sin wallet conectada), se ocultan los textos antes de montarse */
  /* El recorte solo en pantallas grandes: en el móvil taparía el menú. */
  @media(min-width:900px){#colmena-app .c-hdr{overflow:hidden}}
  @media(min-width:561px) and (max-width:1240px){
    #colmena-app .c-prize-tx,#colmena-app .c-market-tx,#colmena-app .c-lot-tx{display:none}
    #colmena-app .c-swap,#colmena-app .c-prize,#colmena-app .c-market,#colmena-app .c-loteria,#colmena-app .c-perfil{padding:0 9px}
  }
  @media(min-width:561px) and (max-width:1050px){
    #colmena-app .c-swap-tx{display:none}
    #colmena-app .c-ticker{max-width:170px}
  }
  /* ── Cinta Prize Pool (publicidad propia) ── */
  #colmena-app .c-ticker{flex:0 1 290px;min-width:130px;max-width:290px;height:44px;margin:0 0 0 16px;margin-right:auto;padding:0;border:none;background:transparent;overflow:hidden;position:relative;cursor:pointer;display:block;border-radius:5px;
    -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 22%,#000 78%,transparent 100%);-webkit-mask-repeat:no-repeat;-webkit-mask-size:100% 100%;
            mask-image:linear-gradient(90deg,transparent 0,#000 22%,#000 78%,transparent 100%);mask-repeat:no-repeat;mask-size:100% 100%}
  #colmena-app .c-ticker-img{height:100%;width:auto;max-width:none;display:block;will-change:transform;animation:ctSlide 34s ease-in-out infinite alternate}
  #colmena-app .c-ticker:hover .c-ticker-img{animation-play-state:paused}
  /* ══════════════════════════════════════════════════════════════
     LA CINTA — [CORREGIDO] El desplazamiento era -58% fijo. En el móvil
     la cinta es más estrecha, así que ese 58% la sacaba de su sitio y
     se veía el corte del final por la derecha. Ahora cada tamaño mueve
     lo justo para que el borde nunca asome.
     ══════════════════════════════════════════════════════════════ */
  @keyframes ctSlide{from{transform:translateX(0)}to{transform:translateX(-52%)}}
  @keyframes ctSlideM{from{transform:translateX(0)}to{transform:translateX(-38%)}}
  @media(prefers-reduced-motion:reduce){#colmena-app .c-ticker-img{animation:none}}
  #colmena-app .c-menu-btn{display:none;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:40px;height:36px;box-sizing:border-box;border-radius:11px;background:linear-gradient(180deg,#f7db8d,var(--gold) 50%,#c79426);border:1px solid #c79426;box-shadow:0 3px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5);cursor:pointer;padding:0}
  #colmena-app .c-menu-btn span{display:block;width:17px;height:2px;border-radius:2px;background:#3a2800}
  #colmena-app .c-menu-btn:active{transform:translateY(3px);box-shadow:0 0 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}
  /* Botones del header: todos mismo alto (36px), rectangulares, 3D dorado relleno */
  #colmena-app .c-loteria,#colmena-app .c-perfil,#colmena-app .c-prize,#colmena-app .c-market{display:inline-flex;align-items:center;gap:7px;height:36px;box-sizing:border-box;padding:0 11px;border-radius:8px;font-family:var(--display);font-size:13px;font-weight:600;color:var(--ink-2);text-decoration:none;background:transparent;border:none;box-shadow:none;text-shadow:none;cursor:pointer;transition:color .14s,background .14s}
  #colmena-app .c-swap:active,#colmena-app .c-loteria:active,#colmena-app .c-perfil:active,#colmena-app .c-prize:active,#colmena-app .c-market:active{opacity:.8}
  #colmena-app .c-loteria:active,#colmena-app .c-perfil:active{opacity:.8}
  /* La marca: completa en el escritorio, iniciales en el móvil. Con el
     nombre entero, la cinta del sorteo se quedaba sin sitio y no salía. */
  /* La marca: en la web "Cripto Cuba", en el móvil "CCuba". El nombre
     completo dejaba sin sitio a la cinta del sorteo. */
  #colmena-app .marca-larga{display:inline}
  /* ══════════════════════════════════════════════════════════════
     EN EL MÓVIL: el logo va centrado arriba (lo pone el HTML), así que
     la esquina izquierda queda libre. Ahí va el estado de la wallet:
     un punto verde si está conectada, gris si no. Antes ese hueco
     quedaba vacío y no decía nada.
     ══════════════════════════════════════════════════════════════ */
  #colmena-app .c-estado{display:none;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;
    background:rgba(255,255,255,.04);border:1px solid var(--line)}
  #colmena-app .c-estado i{width:7px;height:7px;border-radius:50%;background:#6b7681;flex:0 0 auto}
  #colmena-app .c-estado b{font-family:var(--mono);font-size:9.5px;color:var(--ink-3);
    text-transform:uppercase;letter-spacing:.7px;font-weight:600}
  #colmena-app .c-estado.on i{background:var(--neon-lit);box-shadow:0 0 0 0 rgba(46,232,106,.5);animation:ccLat 2.4s ease-in-out infinite}
  #colmena-app .c-estado.on b{color:var(--neon-lit)}
  @keyframes ccLat{0%,100%{box-shadow:0 0 0 0 rgba(46,232,106,.5)}50%{box-shadow:0 0 0 5px rgba(46,232,106,0)}}
  /* El logo horizontal con el nombre: solo en el móvil, centrado arriba. */
  #colmena-app .c-logo-mov{display:none}
  @media(max-width:760px){
    /* ══════════════════════════════════════════════════════════
       CABECERA MÓVIL
       El logo va centrado DENTRO de la barra, no flotando encima.
       Se centra respecto a la propia barra, con la marca a un lado
       y los botones al otro, para que nada se solape.
       ══════════════════════════════════════════════════════════ */
    #colmena-app .c-hdr{position:relative}
    #colmena-app .c-brand-tx{display:none}
    #colmena-app .c-brand .c-logo{display:none}
    #colmena-app .c-brand{min-width:0}
    /* El indicador: a la MISMA altura que el menú, no centrado en toda
       la cabecera (que incluye la cinta y lo empujaba hacia abajo). */
    #colmena-app .c-estado{display:inline-flex;position:absolute;left:12px;top:11px;
      transform:none;z-index:3;padding:8px;gap:0}
    #colmena-app .c-estado b{display:none}
    /* [CORREGIDO] Se centraba respecto a TODA la cabecera, que incluye
       la cinta del sorteo: el logo caía debajo, encima de la cinta. Se
       ancla arriba, a la altura de la fila de botones. */
    /* ══════════════════════════════════════════════════════════════
       El logo, al máximo que da la cabecera. Medido: hay 67px de alto
       antes de la cinta y 299px de ancho entre los dos botones. Usaba
       77x50 y sobraba sitio por todos lados, así que el nombre de abajo
       quedaba ilegible. Ahora ocupa lo que le corresponde.
       ══════════════════════════════════════════════════════════════ */
    #colmena-app .c-logo-mov{display:block;position:absolute;
      left:50%;top:1px;transform:translateX(-50%);
      height:64px;width:auto;max-width:64vw;object-fit:contain;
      pointer-events:none;z-index:1}
    /* Y la cinta, con su propio recorrido para no enseñar el corte. */
    #colmena-app .c-ticker-img{animation-name:ctSlideM}
    #colmena-app .c-ticker{max-width:none;margin-left:0}
  }
  @media(max-width:400px){
    #colmena-app .c-logo-mov{height:56px;max-width:62vw;top:2px}
  }
  @media(prefers-reduced-motion:reduce){#colmena-app .c-estado.on i{animation:none}}
  /* Etiquetas de las casillas: largas en la web, cortas en el móvil.
     "Precio de entrada" no cabe en 390px y se montaba con el valor. */
  #colmena-app .k-s{display:none}
  #colmena-app .k-l{display:inline}
  @media(max-width:760px){
    #colmena-app .k-s{display:inline}
    #colmena-app .k-l{display:none}
    /* El botón de recargar gas se había estirado. Vuelve a su medida. */
    /* ══════════════════════════════════════════════════════════════
       EL BOTÓN DE RECARGAR GAS — [CORREGIDO]
       Este botón NO es un botón normal: está colocado con porcentajes
       exactos (top 12.39%, height 25.99%) para encajar dentro del dibujo
       de la tarjeta de gas.

       Yo le había puesto min-height:44px pensando en la comodidad del
       dedo, sin darme cuenta de que eso lo estiraba hacia abajo y le
       hacía desbordar el marco del dibujo. La altura la manda el
       porcentaje, no una medida fija.
       ══════════════════════════════════════════════════════════════ */
    #colmena-app #f-gasdep{min-height:0;height:25.99%;padding:0;line-height:1}
  }
  /* ══════════════════════════════════════════════════════════════
     EL LOGO EN ESCRITORIO
     El nombre en texto nunca encajaba: o se salía o quedaba diminuto.
     Ahora es el logo completo, que ya trae el nombre dibujado y se ve
     sólido. El icono suelto se oculta para no duplicarlo.
     ══════════════════════════════════════════════════════════════ */
  #colmena-app .c-logo-full{display:block;height:40px;width:auto;object-fit:contain}
  @media(min-width:761px){
    #colmena-app .c-brand .c-logo{display:none}
  }
  @media(min-width:761px) and (max-width:1100px){
    #colmena-app .c-logo-full{height:34px}
  }
  /* En el móvil no cambia nada: sigue el logo centrado de arriba. */
  @media(max-width:760px){
    #colmena-app .c-logo-full{display:none}
  }
  /* La wallet: su logo y los 4 últimos caracteres, que es como la
     reconoce todo el mundo. La dirección entera no la lee nadie. */
  #colmena-app .dir-logo{width:15px;height:15px;flex:0 0 auto;border-radius:4px}
  #colmena-app .dir-tx{font-family:var(--mono);font-size:12px;letter-spacing:.5px;font-weight:700}
  @media(max-width:760px){
    #colmena-app .marca-corta{display:inline}
    #colmena-app .marca-larga{display:none}
  }
  /* Selector de idioma */
  #colmena-app .c-idioma{gap:5px;padding:0 10px}
  #colmena-app .c-idioma-tx{font-family:var(--mono,monospace);font-size:10.5px;font-weight:700}
  #idi-menu{position:fixed;z-index:9800;min-width:176px;padding:6px;
    display:flex;flex-direction:column;gap:2px;
    background:linear-gradient(180deg,var(--panel),var(--panel-2));
    border:1px solid var(--gold-soft,#C9A84B);border-radius:13px;
    box-shadow:0 16px 44px rgba(0,0,0,.7)}
  #idi-menu .idi-op{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;
    border-radius:9px;background:transparent;border:none;color:#b7bdc6;cursor:pointer;
    text-align:left;min-height:44px}
  #idi-menu .idi-op:hover{background:rgba(255,255,255,.05)}
  #idi-menu .idi-op.on{background:rgba(232,184,75,.1);color:var(--gold,#E8B84B)}
  #idi-menu .idi-op i{font-style:normal;font-size:17px;line-height:1}
  #idi-menu .idi-op b{flex:1;font-family:var(--sans,sans-serif);font-weight:600;font-size:13.5px}
  #idi-menu .idi-op svg{width:14px;height:14px;color:var(--gold,#E8B84B)}

  #colmena-app .c-liq{border-color:rgba(246,70,93,.42);color:#f6465d}
  #colmena-app .c-liq:hover{border-color:#f6465d;background:rgba(246,70,93,.1)}
  #colmena-app .c-tools{border-color:rgba(77,159,255,.42);color:var(--ac-m,#4d9fff)}
  #colmena-app .c-tools:hover{border-color:var(--ac-m,#4d9fff);background:rgba(77,159,255,.1)}
  #colmena-app .c-academy{border-color:rgba(46,232,106,.42);color:var(--neon-lit)}
  #colmena-app .c-academy:hover{border-color:var(--neon-lit);background:rgba(46,232,106,.1)}
  #colmena-app .c-swap{display:inline-flex;align-items:center;gap:7px;height:36px;box-sizing:border-box;padding:0 11px;border-radius:8px;font-family:var(--display);font-size:13px;font-weight:600;color:var(--ink-2);cursor:pointer;background:transparent;border:none;box-shadow:none;text-shadow:none;transition:color .14s,background .14s}

  #colmena-app .c-swap:active{transform:translateY(3px);box-shadow:0 0 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}
  #colmena-app .c-swap svg{display:block}
  @keyframes spin{to{transform:rotate(360deg)}}
  /* Tablets y pantallas medianas: el header nunca se desborda */
  @media(min-width:561px) and (max-width:900px){
    #colmena-app .c-ticker{display:none}                     /* la cinta cede el sitio */
    /* Un respiro a la derecha: la wallet quedaba pegada al borde. */
  /* La wallet quedaba rozando el borde. 14px le da aire sin robar
     sitio al menú. */
  #colmena-app .c-hdr-r{padding-right:14px}
  @media(max-width:760px){#colmena-app .c-hdr-r{padding-right:10px}}
  #colmena-app .dir{max-width:132px;overflow:hidden;padding:0 9px;font-size:11px}
    #colmena-app .c-swap,#colmena-app .c-prize,#colmena-app .c-market,
    #colmena-app .c-loteria,#colmena-app .c-perfil{padding:0 7px}
    #colmena-app .c-sep{display:none}
  }
  /* En el móvil todo se puede tocar cómodo */
  /* Las equis de cerrar tienen que ser cómodas con el dedo: 44px es el
     mínimo que recomiendan Apple y Google. Varias se habían quedado en 34. */
  @media(max-width:560px){
    #colmena-app .cf-x,#colmena-app .cm-x,#conf-box .cf-x,#colmena-modal .cm-x,
    #riesgo-box .rg-x,#colmena-app .modal-x{min-width:44px;min-height:44px;font-size:20px}
    #colmena-app .btn-conf,#colmena-app .btn-max,#colmena-app .btn-sug{min-height:42px}
  }
  @media(max-width:560px){
    #colmena-app .c-swap,#colmena-app .c-prize,#colmena-app .c-market,
    #colmena-app .c-loteria,#colmena-app .c-perfil,#colmena-app .dir,
    #colmena-app .hdr-btn,#colmena-app .hdr-off{min-height:44px}
    /* :not(#f-gasdep) — ese botón vive dentro de un dibujo y su altura
       la manda un porcentaje. Estirarlo a 44px lo hacía desbordar. */
    #colmena-app .bot-tab,#colmena-app .bot-tipo,#colmena-app .seg button,
    #colmena-app .sug,#colmena-app .btn:not(#f-gasdep){min-height:44px}
    /* ══════════════════════════════════════════════════════════════
       LAS FLECHITAS DE LOS CAMPOS — [POR FIN LA CAUSA REAL]

       No eran las flechas del navegador. Son BOTONES PROPIOS de la web,
       dentro de un <span class="stepper-btns">. Por eso llevo cuatro
       intentos quitando pseudo-elementos de CSS que no existían aquí.

       Y encima la regla de arriba (min-height:44px para todo lo tocable
       en móvil) los estaba AGRANDANDO, que es justo lo que se veía:
       flechas enormes y empujadas hacia abajo.

       En el móvil se quitan: se escribe con el teclado y el dedo nunca
       acierta en una flecha de 13px. En el escritorio se quedan, que
       ahí van bien y sí se usan.
       ══════════════════════════════════════════════════════════════ */
    #colmena-app .stepper-btns{display:none !important}
    /* Y el campo recupera el hueco que ocupaban. */
    #colmena-app .stepper input,#colmena-app .stepper .inp{padding-right:14px !important}
    #colmena-app .btn-avz{min-height:44px;padding:0 14px}
  }
  #colmena-app .vacio-ok{text-align:center;padding:34px 20px;border-radius:16px;background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid var(--line)}
  #colmena-app .vacio-ico{width:58px;height:58px;margin:0 auto 12px;border-radius:16px;display:grid;place-items:center;background:rgba(232,184,75,.1);border:1px solid rgba(232,184,75,.3);color:var(--gold)}
  #colmena-app .vacio-t{font-family:var(--display);font-weight:800;font-size:18px;color:var(--ink)}
  #colmena-app .vacio-d{font-family:var(--sans);font-size:13.5px;color:var(--ink-3);line-height:1.6;margin:7px auto 16px;max-width:330px}
  #colmena-app .vacio-b{padding:13px 26px;border-radius:12px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold) 45%,#c79426);color:#3a2800;font-family:var(--display);font-weight:800;font-size:14.5px;cursor:pointer;box-shadow:0 4px 0 #8f6a1a;min-height:46px}
  #colmena-app .vacio-b:active{transform:translateY(3px);box-shadow:0 1px 0 #8f6a1a}
  #colmena-app .vacio-p{font-family:var(--mono);font-size:10.5px;color:#6b7681;margin-top:14px;line-height:1.5}
  @media(max-width:560px){#colmena-app .vacio-ok{padding:26px 14px}#colmena-app .vacio-t{font-size:16px}#colmena-app .vacio-d{font-size:12.5px}}
  #colmena-app .dir{cursor:pointer}
  #colmena-app .dir:hover{border-color:var(--gold-soft);color:var(--gold)}
  #colmena-app .dir-logo{width:16px;height:16px;border-radius:4px;object-fit:contain;flex:0 0 auto}
  #colmena-app .dir-ch{width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:translateY(-2px) rotate(45deg);opacity:.65;margin-left:3px;flex:0 0 auto}
  #wsel{position:fixed;inset:0;z-index:9800}
  #wsel .wsel-bg{position:absolute;inset:0}
  #wsel .wsel-p{position:absolute;width:250px;max-width:calc(100vw - 20px);background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft);border-radius:16px;padding:9px;box-shadow:0 22px 60px rgba(0,0,0,.72);animation:wselIn .14s ease both}
  @keyframes wselIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
  #wsel .wsel-t{font-family:var(--mono);font-size:9.5px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.9px;padding:6px 9px 10px}
  #wsel .wsel-b:last-child{margin-bottom:0}
  /* Etiqueta del botón: "Instalar" en ordenador, "Compartir" en el móvil */
  #colmena-app .lbl-mov{display:none!important}
  #colmena-app .lbl-pc{display:inline}
  @media(max-width:560px){
    #colmena-app .lbl-pc{display:none!important}
    #colmena-app .lbl-mov{display:inline!important}
  }
  #wsel .wsel-b{width:100%;display:flex;align-items:center;gap:10px;padding:11px;margin-bottom:6px;border-radius:11px;border:1px solid transparent;background:transparent;color:var(--ink);font-family:var(--display);font-weight:700;font-size:14px;cursor:pointer;text-align:left;min-height:46px}
  #wsel .wsel-b:hover{background:rgba(255,255,255,.06);border-color:var(--line)}
  #wsel .wsel-b.on{background:rgba(232,184,75,.1);border-color:rgba(232,184,75,.4)}
  #wsel .wsel-b img,#wsel .wsel-i{width:26px;height:26px;border-radius:7px;flex:0 0 auto;object-fit:contain;background:rgba(255,255,255,.06)}
  #wsel .wsel-i.wc{display:grid;place-items:center;background:rgba(59,153,252,.16);color:#3b99fc}
  #wsel .wsel-b b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #wsel .wsel-ok{font-family:var(--mono);font-size:8.5px;color:var(--neon-lit);background:rgba(46,232,106,.14);border:1px solid rgba(46,232,106,.4);border-radius:7px;padding:2px 7px;flex:0 0 auto}
  #wsel .wsel-v{font-family:var(--sans);font-size:12px;color:var(--ink-3);line-height:1.55;padding:10px}
  #colmena-app .dir{display:inline-flex;align-items:center;gap:7px;height:36px;box-sizing:border-box;white-space:nowrap;font-family:var(--mono);font-size:12px;font-weight:600;color:var(--ink);background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:9px;padding:0 12px;box-shadow:none;text-shadow:none}
  #colmena-app .hdr-off{width:36px;height:36px;box-sizing:border-box;border-radius:9px;background:transparent;border:1px solid var(--line);color:var(--ink-3);cursor:pointer;display:inline-grid;place-items:center;padding:0;line-height:0;box-shadow:none;transition:color .14s,border-color .14s}
  #colmena-app .hdr-off:hover{color:var(--rojo);border-color:rgba(246,70,93,.4)}
  #colmena-app .c-swap:hover,#colmena-app .c-loteria:hover,#colmena-app .c-perfil:hover,#colmena-app .c-prize:hover,#colmena-app .c-market:hover{color:var(--gold);background:rgba(255,255,255,.05)}
  #colmena-app .c-sep{width:1px;height:22px;background:var(--line);margin:0 3px;flex:0 0 auto}
  #colmena-app .hdr-off svg{display:block}
  #colmena-app .hdr-off:hover{color:var(--ink);border-color:var(--line-soft)}
  #colmena-app .hdr-off:active{transform:translateY(3px);box-shadow:0 0 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.05)}
  #colmena-app .hdr-btn{margin:0;width:auto;height:36px;box-sizing:border-box;padding:0 16px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center}
  #colmena-app .wrap{max-width:1180px;margin:0 auto;padding:26px 22px 60px}
  #colmena-app .lead{font-size:15px;color:var(--ink-2);margin:0 0 22px;max-width:660px}
  #colmena-app .lead b{color:var(--gold)}
  #colmena-app .cols{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch}
  #colmena-app .cols>div{display:flex;flex-direction:column}
  #colmena-app .cols>div>.card{flex:1}
  #colmena-app .card{background:linear-gradient(180deg,var(--panel),var(--panel-2));border:1px solid var(--line);border-radius:18px;padding:22px}
  #colmena-app .card h3{font-family:var(--display);color:var(--gold);margin:0 0 4px;font-size:18px}
  #colmena-app .card .sub{color:var(--ink-3);font-size:12.5px;margin:0 0 16px}
  #colmena-app .v-s{display:none}
  @media(max-width:560px){
    #colmena-app .v-l{display:none}
    #colmena-app .v-s{display:inline}
    /* Etiquetas en UNA sola línea: los campos quedan siempre alineados */
    #colmena-app .lab{font-size:9.5px;letter-spacing:.2px;display:flex;align-items:center;gap:4px;flex-wrap:nowrap;white-space:nowrap;min-width:0}
    #colmena-app .lab>span:first-child{overflow:hidden;text-overflow:ellipsis;min-width:0}
    #colmena-app .lab .i-btn{flex:0 0 auto}
    #colmena-app .cols{align-items:start}
    #colmena-app .paso-box>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  }
  #colmena-app .lab{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-family:var(--mono);font-size:11px;color:var(--acento);margin:16px 0 7px;padding-left:3px;text-transform:uppercase;letter-spacing:.6px}
  #colmena-modal .busy-wrap{display:flex;align-items:center;justify-content:space-between;gap:18px}
  #colmena-modal .busy-tx{flex:1;line-height:1.55;font-size:14px}
  #colmena-modal .busy-ring{position:relative;width:58px;height:58px;flex:0 0 auto}
  #colmena-modal .busy-ring svg{width:58px;height:58px;transform:rotate(-90deg)}
  #colmena-modal .busy-ring .br-bg{fill:none;stroke:rgba(255,255,255,.1);stroke-width:3}
  #colmena-modal .busy-ring .br-fg{fill:none;stroke:#e8b84b;stroke-width:3.5;stroke-linecap:round;stroke-dasharray:88 120;transform-origin:22px 22px;animation:brspin 1.8s linear infinite}
  @keyframes brspin{to{transform:rotate(360deg)}}
  #colmena-modal .busy-num{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--display),Georgia,serif;font-size:22px;font-weight:700;color:rgba(255,255,255,.82)}
  /* Acento del bot en TODO el texto secundario de la sección (encabezados, párrafos, hints, saldos, botones no seleccionados) */
  #colmena-app .cols .acum-hero p,
  #colmena-app .cols .acum-flow .af,
  #colmena-app .cols .cash-note,
  #colmena-app .cols .cash-note b,
  #colmena-app .cols .cash-bal,
  #colmena-app .cols .cash-usd,
  #colmena-app .cols .cash-eq,
  #colmena-app .cols .cash-resumen .cr-note,
  #colmena-app .cols .hint,
  #colmena-app .cols .asesor .as-top,
  #colmena-app .cols .asesor .as-nota,
  #colmena-app .cols .seg button:not(.on),
  #colmena-app .cols .btn-linea{color:var(--acento);text-shadow:0 1px 2px rgba(0,0,0,.32)}
  #colmena-app .cols .stepper input::placeholder{color:var(--acento);opacity:.5}
  #colmena-app .i-btn{width:14px;height:14px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink-3);font-family:var(--display);font-size:9px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;opacity:.6;transition:opacity .15s,color .15s,border-color .15s}
  #colmena-app .i-btn:hover{opacity:1;color:var(--gold);border-color:var(--gold-soft)}
  #colmena-app .i-btn:hover{background:var(--gold);color:#1a1200;border-color:var(--gold)}
  #colmena-app input,#colmena-app select{width:100%;box-sizing:border-box;background:#0d1117;color:var(--ink);border:1px solid var(--line);border-radius:11px;padding:13px 14px;font-family:var(--mono);font-size:15px}
  #colmena-app select{-webkit-appearance:none;appearance:none;padding-right:40px;background-image:url("${CARET}");background-repeat:no-repeat;background-position:right 14px center;background-size:12px}
  #colmena-app input:focus,#colmena-app select:focus{outline:none;border-color:var(--gold)}
  #colmena-app .fila{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  #colmena-app .btn,#colmena-modal .btn{width:100%;box-sizing:border-box;border:none;border-radius:12px;padding:14px;font-family:var(--display);font-weight:700;font-size:15px;cursor:pointer;transition:filter .15s}
  #colmena-app .btn:hover,#colmena-modal .btn:hover{filter:brightness(1.1)}
  #colmena-app .btn-oro:hover,#colmena-modal .btn-oro:hover{filter:none;transform:translateY(-1px);box-shadow:0 6px 0 var(--ac-s),0 12px 24px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.5)}
  #colmena-app .btn-verde:hover,#colmena-modal .btn-verde:hover{filter:none;transform:translateY(-1px);box-shadow:0 6px 0 var(--ac-s),0 12px 24px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.4)} #colmena-app .btn:disabled{opacity:.5;cursor:not-allowed}
  #colmena-app .btn-oro,#colmena-modal .btn-oro{background:linear-gradient(180deg,var(--ac-l),var(--ac-m) 45%,var(--ac-d));color:var(--ac-t);box-shadow:0 4px 0 var(--ac-s),0 8px 18px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.5);transition:transform .09s,box-shadow .09s,filter .12s;text-shadow:0 1px 0 rgba(255,255,255,.3)}
  #colmena-app .btn-oro:active,#colmena-modal .btn-oro:active{transform:translateY(4px);box-shadow:0 0 0 var(--ac-s),0 3px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.4)}
  #colmena-app .btn-oro3d{width:100%;border:none;border-radius:13px;padding:16px;font-family:var(--display);font-weight:800;font-size:16px;cursor:pointer;color:#3a2800;letter-spacing:.3px;background:linear-gradient(180deg,#f7db8d,var(--gold) 45%,#c79426);box-shadow:0 5px 0 #8f6a1a,0 11px 24px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.55);transition:transform .09s,box-shadow .09s,filter .12s;text-shadow:0 1px 0 rgba(255,255,255,.3)}
  #colmena-app .btn-oro3d:hover{filter:brightness(1.05)}
  #colmena-app .btn-oro3d:active{transform:translateY(5px);box-shadow:0 0 0 #8f6a1a,0 4px 12px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.4)}
  #colmena-app .faq-search{width:100%;box-sizing:border-box;margin:0 0 14px;padding:13px 16px;border-radius:11px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--ink);font-family:var(--sans);font-size:14px}
  #colmena-app .faq-search::placeholder{color:var(--ink-3)}
  #colmena-app .faq-search:focus{outline:none;border-color:var(--gold-soft);box-shadow:0 0 0 3px rgba(232,184,75,.12)}
  #colmena-app .faq-empty{text-align:center;color:var(--ink-3);font-family:var(--mono);font-size:12px;padding:16px}
  #colmena-app .conectar-box{max-width:440px;margin:44px auto;text-align:center;background:linear-gradient(180deg,var(--panel),var(--panel-2));border:1px solid var(--line);border-radius:18px;padding:40px 26px;box-shadow:0 18px 50px rgba(0,0,0,.45)}
  #colmena-app .conectar-box h2{font-family:var(--display);color:var(--gold);font-size:28px;margin:0 0 12px;text-shadow:0 1px 2px rgba(0,0,0,.5)}
  #colmena-app .conectar-box p{font-family:var(--sans);color:var(--ink-2);font-size:15px;line-height:1.6;margin:0 auto 26px;max-width:340px}
  #colmena-app .conectar-box .btn{max-width:300px;margin:0 auto;display:block}
  #colmena-app .c-faq-wrap .faq-short{display:none}
  @media(max-width:560px){
    #colmena-app .conectar-box{margin:22px auto;padding:30px 20px}
    #colmena-app .conectar-box h2{font-size:23px}
    #colmena-app .conectar-box p{font-size:14px}
    #colmena-app .c-faq-wrap .faq-long{display:none}
    #colmena-app .c-faq-wrap .faq-short{display:inline}
    #colmena-app .c-faq-wrap summary{font-size:14px}
    #colmena-app .pio-band .l .v,#colmena-app .pio-band .r .v{word-break:break-all}
    #colmena-app .pio-pair{font-size:18px}
  }
  #colmena-app mark.faq-hl{background:transparent;color:var(--gold);font-weight:800;text-shadow:0 0 8px rgba(232,184,75,.3)}
  #colmena-app .acum-hero{text-align:center;padding:14px 12px 6px}
  #colmena-app .acum-hero .acum-ico{font-size:46px;line-height:1;color:var(--acento);filter:drop-shadow(0 0 12px rgba(0,0,0,.5))}
  #colmena-app .acum-hero h4{font-family:var(--display);color:var(--acento);font-size:20px;margin:10px 0 8px;text-shadow:0 1px 2px rgba(0,0,0,.5)}
  #colmena-app .acum-hero p{font-family:var(--sans);color:var(--ink-2);font-size:13px;line-height:1.55;margin:0 auto 14px;max-width:300px}
  #colmena-app .acum-flow{display:flex;flex-direction:column;gap:8px;text-align:left;max-width:320px;margin:0 auto}
  #colmena-app .acum-flow .af{display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:12px;color:var(--ink-2);background:rgba(255,255,255,.03);border:1px solid var(--line-soft);border-radius:10px;padding:9px 12px}
  #colmena-app .acum-flow .af span{flex:0 0 auto;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(180deg,var(--ac-l),var(--ac-d));color:var(--ac-t);font-weight:800;font-size:12px}
  /* ===== Pestañas de bot (tipo carpeta) + foto ===== */
  #colmena-app .bot-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px}
  #colmena-app .bot-tab{display:flex;flex-direction:column;align-items:center;gap:5px;padding:11px 5px;background:linear-gradient(180deg,var(--panel),var(--panel-2));border:1.5px solid var(--line);border-radius:12px;cursor:pointer;color:var(--ink-3);box-shadow:0 3px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04);transition:transform .1s,box-shadow .1s,border-color .14s,color .14s,background .14s}
  #colmena-app .bot-tab:hover{border-color:var(--acento);filter:brightness(1.15)}
  #colmena-app .bot-tab .bt-ico{display:grid}
  #colmena-app .bot-tab .bt-nom{font-family:var(--mono);font-size:10.5px;font-weight:700;text-align:center;line-height:1.05}
  #colmena-app .bot-tab[data-tipo="grid"]{color:var(--az)}
  #colmena-app .bot-tab[data-tipo="acum"]{color:var(--mo)}
  #colmena-app .bot-tab[data-tipo="cash"]{color:var(--gold)}
  #colmena-app .bot-tab[data-tipo="dca"]{color:var(--ve)}
  #colmena-app .bot-tab.on{color:var(--ac-t);background:linear-gradient(180deg,var(--ac-l),var(--ac-m) 55%,var(--ac-d));border-color:var(--ac-d);box-shadow:0 4px 0 var(--ac-s),inset 0 1px 0 rgba(255,255,255,.45);text-shadow:0 1px 0 rgba(255,255,255,.3)}
  #colmena-app .bot-tab.on:active{transform:translateY(2px);box-shadow:0 2px 0 var(--ac-s),inset 0 1px 0 rgba(255,255,255,.45)}
  #colmena-app .bot-foto{position:relative;width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;margin-bottom:16px;border:2px solid var(--ac-m);box-shadow:0 5px 0 var(--ac-s),0 12px 28px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.1);background:linear-gradient(135deg,#20262f,#0d1117)}
  #colmena-app .bot-foto img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
  #colmena-app .bot-foto img.nocarga{display:none}
  #colmena-app .bot-foto-cap{position:absolute;left:0;right:0;bottom:0;padding:28px 16px 14px;background:linear-gradient(180deg,transparent,rgba(3,5,7,.5) 42%,rgba(3,5,7,.9));display:flex;flex-direction:column;gap:3px}
  #colmena-app .bot-foto-cap b{font-family:var(--display);font-weight:800;font-size:19px;color:var(--gold);text-shadow:0 1px 3px rgba(0,0,0,.7),0 0 12px rgba(232,184,75,.3);letter-spacing:.3px}
  #colmena-app .bot-foto-cap span{font-family:var(--sans);font-size:12.5px;color:var(--gold);text-shadow:0 1px 3px rgba(0,0,0,.85);line-height:1.35}
  /* ===== Selector de moneda + modal ===== */
  #colmena-app .fila-coins{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  #colmena-app .coin-sel{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 13px;background:linear-gradient(180deg,var(--panel),var(--panel-2));border:1.5px solid var(--line);border-radius:13px;cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04);transition:border-color .14s,transform .08s}
  #colmena-app .coin-sel:hover{border-color:var(--gold-soft)}
  #colmena-app .coin-sel:active{transform:translateY(1px)}
  #colmena-app .coin-sel-l{display:flex;align-items:center;gap:10px;min-width:0}
  #colmena-app .coin-sel-ico,#colmena-app .cm-coin-ico{position:relative;overflow:hidden;border-radius:50%;background:#0d1117;border:1px solid var(--line);display:grid;place-items:center;font-weight:700;flex:0 0 auto}
  #colmena-app .coin-sel-ico{width:32px;height:32px;font-size:14px}
  #colmena-app .cm-coin-ico{width:38px;height:38px;font-size:17px}
  #colmena-app .coin-sel-ico img,#colmena-app .cm-coin-ico img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:transparent}
  #colmena-app .coin-sel-ico.conlogo,#colmena-app .cm-coin-ico.conlogo{background:transparent;border:none}
  #colmena-app .coin-sel-ico.conlogo .ico-fb,#colmena-app .cm-coin-ico.conlogo .ico-fb{display:none}
  #colmena-app .coin-sel-tx{display:flex;flex-direction:column;gap:1px;min-width:0;text-align:left}
  #colmena-app .coin-sel-tx b{font-family:var(--display);font-size:15px;color:var(--ink);line-height:1.15}
  #colmena-app .coin-sel-tx i{font-family:var(--mono);font-size:10px;color:var(--ink-3);font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px}
  #colmena-app .coin-chev{color:var(--ink-3);flex:0 0 auto;display:grid}
  #colmena-app .coin-modal{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}
  #colmena-app .coin-modal-bg{position:absolute;inset:0;background:rgba(3,5,7,.66);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);animation:cmFade .18s ease}
  #colmena-app .coin-modal-box{position:relative;width:100%;max-width:460px;max-height:84vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#171d25,#0d1117);border:1px solid var(--line);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.65),0 0 0 1px rgba(232,184,75,.06),inset 0 1px 0 rgba(255,255,255,.06);overflow:hidden;animation:cmPop .22s cubic-bezier(.2,.9,.3,1.2)}
  #colmena-app .coin-modal-box::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.5}
  @keyframes cmFade{from{opacity:0}to{opacity:1}}
  @keyframes cmPop{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
  #colmena-app .cm-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px}
  #colmena-app .cm-title{font-family:var(--display);font-weight:700;font-size:18px;color:var(--ink)}
  #colmena-app .cm-x{width:34px;height:34px;border-radius:50%;background:var(--panel-2);border:1px solid var(--line);color:var(--ink-3);cursor:pointer;display:grid;place-items:center;padding:0;transition:all .14s}
  #colmena-app .cm-x:hover{border-color:var(--rojo);color:var(--rojo);background:rgba(255,90,90,.06)}
  #colmena-app .cm-search{display:flex;align-items:center;gap:10px;margin:0 20px 14px;padding:13px 15px;background:#0b0e11;border:1px solid var(--line);border-radius:14px;color:var(--ink-3);transition:border-color .14s,box-shadow .14s}
  #colmena-app .cm-search:focus-within{border-color:var(--gold-soft);box-shadow:0 0 0 3px rgba(232,184,75,.08)}
  #colmena-app .cm-search input{flex:1;background:transparent;border:none;outline:none;color:var(--ink);font-family:var(--sans);font-size:14.5px}
  #colmena-app .cm-search input::placeholder{color:var(--ink-3)}
  #colmena-app .cm-cats{display:flex;gap:8px;padding:0 20px 14px;flex-wrap:wrap}
  #colmena-app .cm-cats button{font-family:var(--mono);font-size:12px;color:var(--ink-2);background:linear-gradient(180deg,var(--panel),var(--panel-2));border:1px solid var(--line);border-radius:100px;padding:7px 15px;cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.3);transition:all .12s}
  #colmena-app .cm-cats button:hover{border-color:var(--gold-soft)}
  #colmena-app .cm-cats button:active{transform:translateY(2px);box-shadow:0 0 0 rgba(0,0,0,.3)}
  #colmena-app .cm-cats button.on{color:#3a2800;background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426);border-color:#c79426;font-weight:800;box-shadow:0 2px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.4);text-shadow:0 1px 0 rgba(255,255,255,.3)}
  #colmena-app .cm-list{overflow-y:auto;padding:2px 12px 16px;display:flex;flex-direction:column;gap:2px}
  #colmena-app .cm-list::-webkit-scrollbar{width:8px}
  #colmena-app .cm-list::-webkit-scrollbar-thumb{background:var(--line);border-radius:8px}
  #colmena-app .cm-coin{display:flex;align-items:center;gap:13px;padding:10px 13px;background:transparent;border:1px solid transparent;border-radius:13px;cursor:pointer;text-align:left;transition:background .12s,border-color .12s}
  #colmena-app .cm-coin:hover{background:#1b222c;border-color:var(--line)}
  #colmena-app .cm-coin.on{background:linear-gradient(90deg,rgba(232,184,75,.12),rgba(232,184,75,.04));border-color:var(--gold-soft)}
  #colmena-app .cm-coin-tx{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
  #colmena-app .cm-coin-tx b{font-family:var(--display);font-size:15.5px;color:var(--ink)}
  #colmena-app .cm-coin-tx i{font-family:var(--mono);font-size:11px;color:var(--ink-3);font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #colmena-app .cm-coin-right{display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:0 0 auto}
  #colmena-app .cm-coin-price{font-family:var(--display);font-size:14.5px;font-weight:700;color:var(--ink)}
  #colmena-app .cm-coin-chg{font-family:var(--mono);font-size:11px}
  #colmena-app .cm-coin-chg.pos{color:var(--neon-lit)}
  #colmena-app .cm-coin-chg.neg{color:var(--rojo)}
  #colmena-app .cm-price-skel{display:inline-block;width:56px;height:12px;border-radius:6px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.12),rgba(255,255,255,.04));background-size:200% 100%;animation:shimmer 1.3s linear infinite}
  #colmena-app .cm-empty{text-align:center;color:var(--ink-3);font-family:var(--mono);font-size:13px;padding:34px}
  /* ===== Cash Out ===== */
  #colmena-app .cash-note{font-family:var(--sans);font-size:13px;color:var(--ink-2);text-align:center;background:linear-gradient(180deg,#12161c,#0d1117);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:18px 0 6px;box-shadow:0 3px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04)}
  #colmena-app .cash-note b{color:var(--gold)}
  #colmena-app .cash-cant-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin:18px 0 7px;flex-wrap:wrap}
  #colmena-app .cash-bal{display:flex;justify-content:flex-end;align-items:center;gap:10px;font-family:var(--mono);font-size:11.5px;color:var(--ink-3)}
  #colmena-app .cash-bal #fc-saldo{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  #colmena-app .cash-max{flex:0 0 auto;background:linear-gradient(180deg,#f7db8d,var(--gold) 50%,#c79426);color:#3a2800;border:1px solid #c79426;border-radius:8px;padding:5px 13px;font-family:var(--mono);font-size:11px;font-weight:800;cursor:pointer;box-shadow:0 2px 0 #8f6a1a;text-shadow:0 1px 0 rgba(255,255,255,.3);transition:transform .08s,box-shadow .08s}
  #colmena-app .cash-max:active{transform:translateY(2px);box-shadow:0 0 0 #8f6a1a}
  #colmena-app .stepper.has-suffix input{padding-right:132px}
  #colmena-app .cash-eq{position:absolute;right:42px;top:50%;transform:translateY(-50%);font-family:var(--mono);font-size:12px;color:var(--ink-3);pointer-events:none;max-width:86px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}
  #colmena-app .cash-slider{-webkit-appearance:none;appearance:none;width:100%;background:transparent;outline:none;margin:16px 0 8px;cursor:pointer;--fill:0%}
  #colmena-app .cash-slider::-webkit-slider-runnable-track{height:6px;border-radius:100px;background:linear-gradient(90deg,var(--gold) var(--fill),var(--line) var(--fill))}
  #colmena-app .cash-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:50%;background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426);border:2px solid #8f6a1a;cursor:pointer;box-shadow:0 2px 5px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.5);margin-top:-7px}
  #colmena-app .cash-slider::-moz-range-track{height:6px;border-radius:100px;background:var(--line)}
  #colmena-app .cash-slider::-moz-range-progress{height:6px;border-radius:100px;background:var(--gold)}
  #colmena-app .cash-slider::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426);border:2px solid #8f6a1a;cursor:pointer}
  #colmena-app .bot-panel-wrap{position:relative;display:block}
  #colmena-app .rec-tag{position:absolute;top:10%;right:9%;display:inline-flex;align-items:center;gap:6px;padding:6px 13px;border-radius:20px;font-family:var(--display);font-weight:800;font-size:10.5px;letter-spacing:.4px;color:#f7db8d;
    background:linear-gradient(180deg,#8f4de0,#6a2fb0 55%,#4a1d80);
    border:1px solid transparent;
    background-origin:border-box;
    background-clip:padding-box,border-box;
    background-image:linear-gradient(180deg,#8f4de0,#6a2fb0 55%,#4a1d80),linear-gradient(150deg,#f7db8d,#c79426 32%,#8f6a1a 55%,#f0d488 78%,#c79426);
    box-shadow:0 3px 0 #3a1566,0 7px 16px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.22);
    text-shadow:0 1px 2px rgba(0,0,0,.6);pointer-events:none;white-space:nowrap;z-index:2;overflow:hidden}
  #colmena-app .rec-tag svg{color:#f7db8d;flex:0 0 auto;filter:drop-shadow(0 1px 1px rgba(0,0,0,.5))}
  #colmena-app .rec-tag::after{content:'';position:absolute;top:0;bottom:0;left:-60%;width:45%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.42),transparent);transform:skewX(-20deg);animation:recShine 6s ease-in-out infinite}
  @keyframes recShine{0%,88%{left:-60%}100%{left:130%}}
  @media(prefers-reduced-motion:reduce){#colmena-app .rec-tag::after{animation:none}}
  @media(max-width:560px){#colmena-app .rec-tag{font-size:9px;padding:5px 10px;gap:4px;border-radius:16px;top:9.5%;right:8%}#colmena-app .rec-tag svg{width:9px;height:9px}}
  #colmena-app .bot-panel{display:block;width:100%;height:auto;max-width:100%;margin:0 0 4px;border:none;transition:filter .18s ease}
  #colmena-app .bot-panel:hover{transform:none;filter:drop-shadow(0 10px 24px rgba(0,0,0,.5))}
  #colmena-app .cash-price{position:relative;text-align:center;background:url('assets/img/marco-precio.webp') center/100% 100% no-repeat;border:none;border-radius:0;aspect-ratio:900/338;padding:0;margin-bottom:14px;box-shadow:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transition:filter .18s ease}
  #colmena-app .cash-price:hover{transform:none;filter:drop-shadow(0 8px 20px rgba(0,0,0,.55))}
  #colmena-app .cash-price .cp-lab{font-family:var(--mono);font-size:11px;color:var(--ink-2);letter-spacing:2.4px;text-transform:uppercase;opacity:.9}
  #colmena-app .cash-price .cp-val{font-family:var(--display);font-weight:800;font-size:clamp(22px,6.2vw,34px);color:var(--acento);margin:2px 0 1px;line-height:1.05;letter-spacing:-.3px;text-shadow:0 2px 4px rgba(0,0,0,.75),0 0 18px color-mix(in srgb,var(--acento) 35%,transparent)}
  #colmena-app .cash-price .cp-src{font-family:var(--mono);font-size:9px;color:var(--ink-3);text-transform:uppercase;letter-spacing:2.6px;opacity:.85}
  #colmena-app .cash-resumen{margin-top:16px;background:linear-gradient(180deg,#12161c,#0b0e11);border:1px solid var(--line);border-radius:16px;padding:16px 18px;box-shadow:0 8px 24px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.03)}
  #colmena-app .cash-resumen .cr-top{font-family:var(--display);color:var(--acento);font-size:14px;font-weight:700;text-align:center;margin-bottom:12px;text-shadow:0 1px 1px rgba(0,0,0,.4);letter-spacing:.3px}
  #colmena-app .cash-resumen .cr-rows{display:flex;flex-direction:column;gap:1px;background:var(--line-soft);border-radius:11px;overflow:hidden}
  #colmena-app .cash-resumen .cr-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 14px;background:rgba(0,0,0,.28);font-family:var(--mono);font-size:12.5px}
  #colmena-app .cash-resumen .cr-row span{color:var(--ink-3);min-width:0}
  #colmena-app .cash-resumen .cr-row b{color:var(--ink);font-family:var(--display);font-size:15px;white-space:nowrap;text-align:right}
  #colmena-app .cash-resumen .cr-gan b{font-size:18px}
  #colmena-app .cash-resumen .cr-gan b.pos{color:var(--neon-lit);text-shadow:0 0 12px rgba(46,232,106,.3)}
  #colmena-app .cash-resumen .cr-gan b.neg{color:var(--rojo)}
  #colmena-app .cash-resumen .cr-note{text-align:center;font-family:var(--sans);font-size:12px;color:var(--ink-2);line-height:1.55;margin-top:12px}
  #colmena-app .cash-resumen .cr-note b{color:var(--gold)}
  #colmena-app .btn-verde,#colmena-modal .btn-verde{background:linear-gradient(180deg,var(--ac-l),var(--ac-m) 45%,var(--ac-d));color:var(--ac-t);box-shadow:0 4px 0 var(--ac-s),0 8px 18px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.4);transition:transform .09s,box-shadow .09s,filter .12s;text-shadow:0 1px 0 rgba(255,255,255,.25)}
  #colmena-app .btn-verde:active,#colmena-modal .btn-verde:active{transform:translateY(4px);box-shadow:0 0 0 var(--ac-s),0 3px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.3)}
  #colmena-app .btn-linea,#colmena-modal .btn-linea{background:transparent;border:1px solid var(--line);color:var(--ink)}
  #colmena-app .btn-rojo,#colmena-modal .btn-rojo{background:transparent;border:1px solid var(--rojo);color:var(--rojo)}
  #colmena-app .mt{margin-top:14px} #colmena-app .mt8{margin-top:8px}
  #colmena-app .link{background:none;border:none;color:var(--gold-soft);font-family:var(--mono);font-size:12px;cursor:pointer;text-decoration:underline;padding:0;margin-top:16px}
  #colmena-app .sug{background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid var(--acento);color:var(--acento);border-radius:8px;padding:6px 11px;font-family:var(--mono);font-size:11px;cursor:pointer;margin-left:auto;box-shadow:0 2px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.06);transition:transform .08s,box-shadow .08s}
  #colmena-app .sug:active{transform:translateY(2px);box-shadow:0 0 0 rgba(0,0,0,.3)}
  #colmena-app .seg{display:flex;gap:6px}
  #colmena-app .seg button{flex:1;padding:11px;border:1px solid var(--line);background:transparent;color:var(--ink-2);border-radius:9px;font-family:var(--mono);font-size:12px;cursor:pointer}
  #colmena-app .seg button.on{background:var(--ac-m);color:var(--ac-t);border-color:var(--ac-d);font-weight:700}
  #colmena-app .avz{border-top:1px solid var(--line-soft);margin-top:18px;padding-top:4px}
  #colmena-app .chart{width:100%;height:auto;display:block;border-radius:14px;background:#0d1117;border:1px solid var(--line-soft)}
  #cmov{position:fixed;inset:0;z-index:9900;display:flex;align-items:flex-end;justify-content:center}
  #cmov .cm-bg{position:absolute;inset:0;background:rgba(3,5,8,.86);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  #cmov .cm-c{position:relative;width:100%;max-width:420px;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft);border-radius:22px 22px 0 0;padding:22px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -20px 60px rgba(0,0,0,.75);text-align:center}
  #cmov .cm-x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;cursor:pointer}
  #cmov .cm-t{font-family:var(--display);font-weight:800;font-size:20px;color:var(--gold)}
  #cmov .cm-s{font-family:var(--sans);font-size:12.5px;color:#8b96a3;margin:5px 0 16px}
  #cmov .cm-eti{font-family:var(--mono);font-size:9.5px;color:#6b7681;text-transform:uppercase;letter-spacing:.9px;text-align:left;margin:14px 0 8px}
  #cmov .cm-b{display:block;width:100%;margin-bottom:8px;padding:15px;border-radius:13px;border:1px solid #3a424c;background:linear-gradient(180deg,var(--panel),var(--panel-2));color:#eaecef;font-family:var(--display);font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.4);min-height:50px}
  #cmov .cm-b.oro{border-color:#c79426;background:linear-gradient(180deg,#f7db8d,var(--gold) 45%,#c79426);color:#3a2800;box-shadow:0 4px 0 #8f6a1a}
  #cmov .cm-b:active{transform:translateY(2px)}
  #cmov .cm-n{font-family:var(--sans);font-size:11px;color:#7d8794;line-height:1.45;margin-top:4px}
  /* Botón único de configuraciones (azul del Smart Grid) */
  /* Etiqueta con botón "Sugerir": ocupa su fila y nunca se sale */
  #colmena-app .lab-sug{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:nowrap;white-space:normal}
  #colmena-app .lab-sug .lab-tx{display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #colmena-app .lab-sug .sug{flex:0 0 auto;margin:0}
  @media(max-width:560px){
    #colmena-app .lab-sug{gap:6px}
    #colmena-app .lab-sug .sug{font-size:10px;padding:4px 9px}
  }
  #colmena-app .btn-conf{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;min-height:48px;padding:0 16px;margin:18px 0 14px;border-radius:13px;border:1px solid var(--ac-d,#2b7fe0);background:linear-gradient(180deg,var(--ac-l,#a9d4ff),var(--ac-m,#4d9fff) 45%,var(--ac-d,#2b7fe0));color:var(--ac-t,#04213f);font-family:var(--display);font-weight:800;font-size:14.5px;cursor:pointer;box-shadow:0 4px 0 var(--ac-s,#1a5bb0),0 6px 16px rgba(0,0,0,.3)}
  #colmena-app .btn-conf:active{transform:translateY(3px);box-shadow:0 1px 0 var(--ac-s,#1a5bb0)}
  #colmena-app .btn-conf .bc-sel{font-family:var(--mono);font-size:10.5px;padding:3px 10px;border-radius:20px;background:rgba(4,33,63,.22);border:1px solid rgba(4,33,63,.25)}
  #conf-box{position:fixed;inset:0;z-index:9880;display:flex;align-items:center;justify-content:center;padding:16px}
  #conf-box .cf-bg{position:absolute;inset:0;background:rgba(3,5,8,.88);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  /* Cada bot con su color */
  /* Mismos tonos que la pestaña de cada bot (--mo morado, --ve verde) */
  #conf-box.tema-acum{--cf:#b47cff;--cf-l:#d9b8ff}   /* Accumulator: morado */
  #conf-box.tema-cash{--cf:#E8B84B;--cf-l:#f7db8d}   /* Cash Out: dorado */
  #conf-box.tema-dca{--cf:#34d97b;--cf-l:#8ff0bd}    /* DCA: verde */
  #conf-box.tema-acum .cf-c,#conf-box.tema-cash .cf-c,#conf-box.tema-dca .cf-c{border-color:var(--cf)}
  #conf-box.tema-acum .cf-t,#conf-box.tema-cash .cf-t,#conf-box.tema-dca .cf-t,
  #conf-box.tema-acum .cf-saber summary,#conf-box.tema-cash .cf-saber summary,#conf-box.tema-dca .cf-saber summary{color:var(--cf-l)}
  #conf-box.tema-acum .cf-op:hover,#conf-box.tema-cash .cf-op:hover,#conf-box.tema-dca .cf-op:hover{border-color:var(--cf)}
  #conf-box .cf-c{position:relative;width:100%;max-width:470px;max-height:calc(100vh - 32px);overflow-y:auto;background:linear-gradient(180deg,#141c28,#0b0e12);border:1px solid var(--ac-m,#4d9fff);border-radius:20px;padding:24px 18px 20px;box-shadow:0 30px 90px rgba(0,0,0,.8)}
  #conf-box .cf-x{position:absolute;top:13px;right:13px;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;line-height:1;padding:0;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;cursor:pointer;font-size:14px}
  #conf-box .cf-t{font-family:var(--display);font-weight:800;font-size:20px;color:var(--ac-l,#a9d4ff);padding-right:40px}
  #conf-box .cf-s{font-family:var(--sans);font-size:12.5px;color:#8b96a3;margin:5px 0 16px;line-height:1.5}
  #conf-box .cf-s b{color:#eaecef}
  #conf-box .cf-lista{display:flex;flex-direction:column;gap:10px}
  #conf-box .cf-op{width:100%;text-align:left;padding:14px;border-radius:14px;border:1px solid #2b3139;background:linear-gradient(180deg,#1b2430,#0d1117);cursor:pointer;color:var(--ink)}
  #conf-box .cf-op:hover{border-color:var(--ac-m,#4d9fff)}
  #conf-box .cf-op.on{border-color:var(--ac-m,#4d9fff);background:linear-gradient(180deg,rgba(77,159,255,.16),rgba(77,159,255,.05))}
  #conf-box .cf-cab{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
  #conf-box .cf-cab b{font-family:var(--display);font-weight:800;font-size:16px;color:#eaecef}
  #conf-box .cf-ops{font-family:var(--mono);font-size:9.5px;color:var(--ac-l,#a9d4ff);background:rgba(77,159,255,.14);border:1px solid rgba(77,159,255,.3);border-radius:20px;padding:2px 9px}
  #conf-box .cf-d{font-family:var(--sans);font-size:12px;color:#8b96a3;line-height:1.5;margin:6px 0 9px}
  #conf-box .cf-nums{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:9px}
  #conf-box .cf-nums span{font-family:var(--display);font-weight:700;font-size:13px;color:#eaecef}
  #conf-box .cf-nums i{display:block;font-style:normal;font-family:var(--mono);font-size:8.5px;color:#6b7681;text-transform:uppercase;letter-spacing:.6px}
  #conf-box .cf-gana{font-family:var(--sans);font-size:11.5px;color:var(--neon-lit,#2ee86a);background:rgba(46,232,106,.09);border:1px solid rgba(46,232,106,.28);border-radius:9px;padding:8px 10px;line-height:1.45}
  #conf-box .cf-gana.mal{color:var(--gold,#E8B84B);background:rgba(232,184,75,.09);border-color:rgba(232,184,75,.3)}
  #conf-box .cf-sug{width:100%;margin-top:12px;padding:12px;border-radius:11px;border:1px solid #3a424c;background:transparent;color:var(--ac-l,#a9d4ff);font-family:var(--display);font-weight:700;font-size:13px;cursor:pointer;min-height:44px}
  #conf-box .cf-sim{margin-top:16px;padding:14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid #2b3139}
  #conf-box .cf-sim-t{font-family:var(--display);font-weight:800;font-size:14px;color:var(--ac-l,#a9d4ff);margin-bottom:10px}
  #conf-box .cf-sim-in{display:flex;align-items:center;gap:9px;margin-bottom:12px}
  #conf-box .cf-sim-in input{flex:1;min-width:0;padding:11px 13px;border-radius:11px;border:1px solid #3a424c;background:#0b0e12;color:var(--ink);font-family:var(--display);font-size:17px;font-weight:700}
  #conf-box .cf-sim-in input:focus{outline:none;border-color:var(--ac-m,#4d9fff)}
  #conf-box .cf-sim-in span{font-family:var(--mono);font-size:12px;color:var(--ink-3);flex:0 0 auto}
  #conf-box .cf-sim-f{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)}
  #conf-box .cf-sim-f:last-of-type{border-bottom:none}
  #conf-box .cf-sim-f .s1{font-family:var(--display);font-weight:700;font-size:12.5px;color:var(--ink);flex:0 0 auto;min-width:84px}
  #conf-box .cf-sim-f .s2,#conf-box .cf-sim-f .s3{font-family:var(--mono);font-size:12px;color:var(--ink-2);text-align:right}
  #conf-box .cf-sim-f .s3{color:var(--neon-lit);font-weight:700;min-width:78px}
  #conf-box .cf-sim-f.mal .s3{color:var(--gold)}
  #conf-box .cf-sim-f i{display:block;font-style:normal;font-size:8.5px;color:#6b7681;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;font-weight:400}
  #conf-box .cf-sim-res{margin-top:11px;padding:10px 12px;border-radius:10px;background:rgba(46,232,106,.08);border:1px solid rgba(46,232,106,.28);font-family:var(--sans);font-size:12px;color:var(--ink-2);line-height:1.55}
  #conf-box .cf-sim-res b{color:var(--neon-lit)}
  #conf-box .cf-sim-res.mal{background:rgba(232,184,75,.08);border-color:rgba(232,184,75,.3)}
  #conf-box .cf-sim-res.mal b{color:var(--gold)}
  #conf-box .cf-sim-mal{font-family:var(--sans);font-size:12px;color:var(--gold);padding:6px 0}
  #conf-box .cf-sim-n{font-family:var(--sans);font-size:11px;color:#6b7681;line-height:1.5;margin-top:10px}
  #conf-box .cf-sim-n b{color:var(--ink-3)}
  #conf-box .cf-saber{margin-top:14px;border-top:1px solid rgba(255,255,255,.08);padding-top:12px}
  #conf-box .cf-saber summary{cursor:pointer;font-family:var(--display);font-weight:700;font-size:13.5px;color:var(--ac-l,#a9d4ff);list-style:none;padding:4px 0}
  #conf-box .cf-saber summary::-webkit-details-marker{display:none}
  #conf-box .cf-saber summary:before{content:'▸ '}
  #conf-box .cf-saber[open] summary:before{content:'▾ '}
  #conf-box .cf-txt p{font-family:var(--sans);font-size:12.5px;color:#8b96a3;line-height:1.65;margin:9px 0}
  #conf-box .cf-txt b{color:#eaecef}
  @media(max-width:560px){
    #conf-box .cf-c{padding:20px 14px 16px;border-radius:18px}
    #conf-box .cf-t{font-size:17px}
    #conf-box .cf-cab b{font-size:15px}
    #conf-box .cf-d{font-size:11.5px}
    #conf-box .cf-nums{gap:11px}
  }
  #colmena-app .mb-cab{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:16px}
  #colmena-app .mb-cab h3{margin:0;flex:1;min-width:0}
  #colmena-app .mb-der{display:flex;align-items:center;gap:7px;flex:0 0 auto}
  /* Botones cómodos de tocar en cualquier pantalla (auditoría con 5 perfiles) */
  #colmena-app .btn-avz,#colmena-app .btn-max,#colmena-app .sug,#colmena-app .cash-max{min-height:34px;padding-top:0;padding-bottom:0;display:inline-flex;align-items:center;justify-content:center}
  @media(max-width:560px){#colmena-app .btn-avz,#colmena-app .btn-max,#colmena-app .sug,#colmena-app .cash-max{min-height:40px}}
  #colmena-app .c-cupo{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 13px;border-radius:20px;background:rgba(232,184,75,.1);border:1px solid rgba(232,184,75,.35);cursor:help;white-space:nowrap}
  #colmena-app .c-cupo b{font-family:var(--display);font-weight:800;font-size:13px;color:var(--gold)}
  #colmena-app .c-cupo span{font-family:var(--mono);font-size:10px;color:var(--ink-3)}
  #colmena-app .c-cupo.lleno{background:rgba(246,70,93,.1);border-color:rgba(246,70,93,.4)}
  #colmena-app .c-cupo.lleno b{color:var(--rojo)}
  /* Botón "Mis órdenes": con borde y efecto 3D para que se note que es pulsable. */
  #colmena-app #c-ver-ord{cursor:pointer;background:linear-gradient(180deg,rgba(232,184,75,.24),rgba(232,184,75,.07));
    border:1px solid rgba(232,184,75,.6);box-shadow:0 2px 0 rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.14);
    transition:transform .1s ease,box-shadow .15s ease,filter .15s ease}
  #colmena-app #c-ver-ord .cupo-tx{color:var(--gold);font-weight:700}
  #colmena-app #c-ver-ord:hover{filter:brightness(1.06);box-shadow:0 1px 3px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.14)}
  #colmena-app #c-ver-ord:active{transform:translateY(1px);box-shadow:0 1px 0 rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.1)}
  #colmena-app #c-ver-ord b{min-width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;
    background:linear-gradient(180deg,#f7db8d,#E8B84B 60%,#c79426);color:#3a2800;border-radius:9px;font-size:11px;font-weight:800;padding:0 5px;
    box-shadow:0 1px 2px rgba(0,0,0,.35)}
  #colmena-app .btn-cerrar-todos{display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 13px;border-radius:20px;border:1px solid #3a424c;background:transparent;color:var(--ink-3);font-family:var(--mono);font-size:10.5px;cursor:pointer;white-space:nowrap}
  #colmena-app .btn-cerrar-todos:hover{color:var(--rojo);border-color:rgba(246,70,93,.45)}
  #colmena-app .btn-cerrar-todos:active{transform:translateY(1px)}
  #colmena-app .btn-cerrar-todos.cargando{color:var(--gold);border-color:rgba(232,184,75,.45);cursor:default}
  #ct-box{position:fixed;inset:0;z-index:9890;display:flex;align-items:center;justify-content:center;padding:18px}
  #ct-box .ct-bg{position:absolute;inset:0;background:rgba(3,5,8,.88);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  #ct-box .ct-c{position:relative;width:100%;max-width:400px;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid rgba(246,70,93,.5);border-radius:20px;padding:24px 20px}
  #ct-box .ct-t{font-family:var(--display);font-weight:800;font-size:20px;color:var(--rojo);text-align:center}
  #ct-box .ct-s{font-family:var(--sans);font-size:13px;color:#8b96a3;line-height:1.6;margin:12px 0 18px}
  #ct-box .ct-s b{color:#eaecef}
  #ct-box .ct-acts{display:flex;gap:9px}
  #ct-box .ct-b{flex:1;padding:13px;border-radius:11px;border:1px solid #3a424c;background:linear-gradient(180deg,var(--panel),var(--panel-2));color:#b7bdc6;font-family:var(--display);font-weight:800;font-size:13.5px;cursor:pointer;min-height:46px}
  #ct-box .ct-b.rojo{border-color:#d14a58;background:linear-gradient(180deg,#f08a95,#e35d6a 45%,#b8323f);color:#fff}
  #ct-box .ct-b:disabled{opacity:.5;cursor:default}
  #ct-box .ct-prog{font-family:var(--mono);font-size:11.5px;color:var(--gold);text-align:center;margin-top:12px;min-height:16px;line-height:1.5}
  @media(max-width:560px){#colmena-app .btn-cerrar-todos{font-size:10px;padding:5px 10px}}
  #colmena-app .pio-acciones{display:flex;gap:8px;align-items:stretch;flex-wrap:wrap;margin-top:14px}
  #colmena-app .pio-acciones .pio-toggle{flex:1;min-width:150px;margin:0}
  /* Misma altura y línea base que "Ver el bot trabajando" */
  #colmena-app .pio-img{display:inline-flex;align-items:center;justify-content:center;gap:7px;margin:0;padding:0 14px;min-height:40px;border-radius:11px;border:1px solid #3a424c;background:linear-gradient(180deg,var(--panel),var(--panel-2));color:var(--gold);font-family:var(--display);font-weight:700;font-size:12.5px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.4);white-space:nowrap}
  #colmena-app .pio-img:hover{filter:brightness(1.15);border-color:var(--gold-soft)}
  #colmena-app .pio-img:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.4)}
  @media(max-width:560px){#colmena-app .pio-acciones .pio-img{flex:1}}
  #colmena-app .tv-detalle{margin-top:10px}
  #colmena-app .tv-detalle summary{cursor:pointer;font-family:var(--mono);font-size:10.5px;color:var(--ink-3);padding:7px 0;list-style:none}
  #colmena-app .tv-detalle summary::-webkit-details-marker{display:none}
  #colmena-app .tv-detalle summary:before{content:'▸ ';color:var(--gold)}
  #colmena-app .tv-detalle[open] summary:before{content:'▾ '}
  #colmena-app #c-chart{position:relative;background:url('assets/img/marco-rejilla.webp') center/100% 100% no-repeat;padding:11% 11%;box-sizing:border-box}
  #colmena-app #c-chart .chart{background:transparent;border:none;border-radius:0}
  #colmena-app .hint{font-family:var(--sans);font-size:12px;line-height:1.5;color:var(--ink-2);background:rgba(232,184,75,.05);border:1px solid var(--line-soft);border-left:2px solid var(--gold-soft);border-radius:8px;padding:9px 12px;margin:12px 0 4px}
  #colmena-app .prev{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
  #colmena-app .p{background:linear-gradient(180deg,#12161c,#0d1117);border:1px solid var(--line-soft);border-radius:11px;padding:13px 8px;text-align:center;display:flex;flex-direction:column;justify-content:center;min-height:66px}
  #colmena-app .p b{display:flex;align-items:center;justify-content:center;gap:4px;font-family:var(--mono);font-size:9px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.4px}
  #colmena-app .p span{font-family:var(--display);font-size:18px;font-weight:700;color:var(--ink);display:block;margin-top:6px;letter-spacing:-.3px}
  #colmena-app .p span.pos{color:var(--neon-lit)}
  /* Casillas del Smart Grid con marco tecnológico (una sola imagen, proporción bloqueada) */
  #colmena-app .prev{align-items:start}
  #colmena-app .prev .p{background:url('assets/img/azul.webp') center/100% 100% no-repeat;border:none;border-radius:0;box-shadow:none;aspect-ratio:606/479;min-height:92px;padding:15% 16%;overflow:hidden;justify-content:center}
  #colmena-app .prev .p b{font-size:8px;letter-spacing:.2px}
  /* valores y guiones: chapados en el metal de la pizarra (relieve visible) */
  #colmena-app .prev .p span{font-size:16px;margin-top:3px;text-shadow:0 1px 1px rgba(0,0,0,.9),0 2px 3px rgba(0,0,0,.55),0 -1px 0 rgba(255,255,255,.18)}
  #colmena-app .prev .p span.pos{color:#4dff8a}
  #colmena-app .prev .p span.neg{color:#ff7a7a}
  #colmena-app .prev.vacio .p b,#colmena-app .prev.vacio .p span,#colmena-app .prev.vacio .p .rep-wrap{opacity:0}
  /* reparto: sin título, solo las cápsulas centradas */
  #colmena-app .prev .prep{padding:14% 12%;align-items:center}
  #colmena-app .prev .p .rep-wrap{display:flex;flex-direction:column;align-items:stretch;gap:6px;margin-top:0}
  #colmena-app .prev .p .rep-pill{display:block;width:auto;text-align:center;font-size:10px;padding:3px 11px;border-radius:7px;margin-top:0}
  /* ícono de info visible sobre el metal */
  #colmena-app .prev .p .i-btn{opacity:.85;color:#9aa4b0;border-color:#3b434d;background:rgba(255,255,255,.06);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
  /* En móvil/tableta (2 columnas): casillas más grandes -> texto e info interiores más grandes */
  @media(max-width:860px){
    #colmena-app .prev .p b{font-size:10px}
    #colmena-app .prev .p span{font-size:21px}
    #colmena-app .prev .p .rep-wrap{gap:7px}
    #colmena-app .prev .p .rep-pill{font-size:12px;padding:4px 14px}
  }
  #colmena-app .gasbox{position:relative;aspect-ratio:994/367;background:url('assets/img/marco-gas.webp') center/100% 100% no-repeat;border:none;border-radius:0;padding:0;margin-top:16px;box-sizing:border-box}
  #colmena-app .gas-row{display:contents}
  #colmena-app .gas-stepper{position:absolute;left:3.83%;top:11.85%;width:69.07%;height:26.67%;margin:0;transform:translateY(2px)}
  #colmena-app .gas-stepper input{width:100%;height:100%;box-sizing:border-box;padding-top:0;padding-bottom:0;background:transparent;border:none}
  #colmena-app .gas-stepper input:focus{border:none;outline:none;box-shadow:none}
  #colmena-app #f-gasdep{position:absolute;left:74.44%;top:12.39%;width:21.43%;height:25.99%;padding:0;margin:0;box-sizing:border-box;transform:translateX(-1px);border-radius:8px;font-size:12px}
  #colmena-app .gas-stepper .stepper-btns{top:50%;bottom:auto;transform:translateY(-50%);gap:2px;right:5px}
  #colmena-app .gas-stepper .stepper-btns button{flex:0 0 auto;width:22px;height:13px;font-size:6.5px}
  #colmena-app .gasbox .top{display:flex;align-items:center;justify-content:space-between}
  #colmena-app .gasbox .v{font-family:var(--display);color:var(--gold);font-size:20px}
  #colmena-app .gas-row input{flex:1}
  #colmena-app .gas-row .btn{width:auto;white-space:nowrap;padding:13px 16px}
  #colmena-app .gas-stepper input{padding-right:118px}
  #colmena-app .gas-stepper input:focus{padding-right:38px}
  #colmena-app .gas-hint{position:absolute;right:36px;top:50%;transform:translateY(-50%);font-family:var(--mono);font-size:10.5px;color:#8fb0c8;pointer-events:none;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;transition:opacity .15s}
  #colmena-app .gas-hint .gas-ibtn{pointer-events:auto;width:14px;height:14px;border:1px solid #6f93aa;border-radius:50%;color:#8fb0c8;background:transparent;opacity:1;font-size:8.5px;font-style:italic;font-family:Georgia,serif;display:inline-grid;place-items:center;cursor:pointer;flex:0 0 auto}
  #colmena-app .gas-hint .gas-ibtn:hover{background:rgba(143,176,200,.15);color:#8fb0c8;border-color:#8fb0c8}
  #colmena-app .gas-stepper input:focus~.gas-hint,#colmena-app .gas-stepper input:not(:placeholder-shown)~.gas-hint{opacity:0;pointer-events:none}
  #colmena-app .btn-gasret{margin-top:10px;padding:11px;font-size:13px}
  #colmena-app .aviso{font-family:var(--mono);font-size:12px;padding:11px;border-radius:9px;margin-top:12px}
  #colmena-app .aviso.info{background:rgba(232,184,75,.08);color:var(--gold);border:1px solid var(--gold-soft)}
  #colmena-app .aviso.err{background:rgba(255,107,107,.08);color:var(--rojo);border:1px solid var(--rojo)}
  #colmena-app .aviso.warn{background:rgba(232,184,75,.08);color:var(--gold);border:1px solid var(--gold-soft)}
  #colmena-app .hero{text-align:center;padding:70px 20px}
  #colmena-app .hero h1{font-family:var(--display);color:var(--gold);font-size:34px;margin:0 0 12px}
  #colmena-app .colmenas{margin-top:24px;position:relative;overflow:hidden;background:#0d1117;
    border:1px solid var(--line);box-shadow:0 24px 60px rgba(0,0,0,.45)}
  #colmena-app .colmenas::before,#colmena-app .colmenas::after{display:none}
  #colmena-app .colmenas>*{position:relative;z-index:2}
  #colmena-app .colmenas h3{position:relative;z-index:2;text-shadow:0 2px 12px rgba(0,0,0,.6)}
  #colmena-app .rej{border:1px solid rgba(232,184,75,.18);border-radius:16px;padding:18px;margin-top:16px;
    background:rgba(255,255,255,.03);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);
    box-shadow:0 10px 34px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.04)}
  #colmena-app .rej-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  #colmena-app .rej-par{font-family:var(--display);color:var(--gold);font-size:17px}
  #colmena-app .pill{font-family:var(--mono);font-size:10px;padding:4px 9px;border-radius:20px}
  #colmena-app .pill.on{background:rgba(46,232,106,.15);color:var(--neon-lit)} #colmena-app .pill.off{background:rgba(100,133,122,.15);color:var(--ink-3)}
  @keyframes cpulse{0%,100%{opacity:.4;transform:scale(.8)}50%{opacity:1;transform:scale(1.25)}}
  #colmena-app .pill.on .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--neon-lit);margin-right:6px;animation:cpulse 1.2s ease-in-out infinite;vertical-align:middle}
  #colmena-app .ganmsg{background:rgba(46,232,106,.06);border:1px solid var(--neon-dim);border-radius:10px;padding:10px 12px;font-size:12.5px;color:var(--neon-lit);margin:12px 0}
  #colmena-app .rej-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:14px;align-items:start}
  #colmena-app .stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
  #colmena-app .stat{background:var(--panel-2);border:1px solid var(--line-soft);border-radius:10px;padding:9px}
  #colmena-app .stat b{display:flex;align-items:center;gap:4px;font-family:var(--mono);font-size:9px;color:var(--ink-3);text-transform:uppercase}
  #colmena-app .stat span{font-family:var(--display);font-size:15px;color:var(--ink)}
  #colmena-app .stat span.pos{color:var(--neon-lit)} #colmena-app .stat span.neg{color:var(--rojo)}
  #colmena-app .rej-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
  #colmena-app .rej-btns .btn{font-size:12px;padding:10px}
  #colmena-app .gw-i{width:14px;height:14px;flex:0 0 auto;margin-right:7px;vertical-align:-2px}
  #colmena-app .leg span{display:inline-flex;align-items:center;gap:5px}
  #colmena-app .lg-i{width:11px;height:11px;flex:0 0 auto;overflow:visible}
  #colmena-app .graf-aviso{margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(232,184,75,.07);border:1px dashed rgba(232,184,75,.32);font-family:var(--sans);font-size:11.5px;color:var(--ink-2);line-height:1.55}
  #colmena-app .leg{display:flex;gap:12px;flex-wrap:wrap;font-family:var(--mono);font-size:10px;color:var(--ink-3);margin-top:8px}
  #colmena-pop{position:absolute;z-index:9999;max-width:280px;background:var(--panel-2);border:1px solid var(--gold-soft);border-radius:10px;padding:12px 14px;font-size:13px;color:var(--ink);box-shadow:0 10px 30px rgba(0,0,0,.5);display:none;line-height:1.5}
  /* ============ VIDA: fondo, brillos y movimiento ============ */
  #colmena-app::before{content:"";position:fixed;inset:-25%;z-index:-2;pointer-events:none;
    background:radial-gradient(45% 35% at 50% -8%, rgba(232,184,75,.04), transparent 65%);
    filter:blur(60px)}
  #colmena-app::after{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;opacity:.25;
    background-image:radial-gradient(rgba(255,255,255,.03) 1px, transparent 1.5px);background-size:34px 34px;
    animation:stars 90s linear infinite}
  @keyframes drift{0%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(3%,-2%,0) scale(1.08)}100%{transform:translate3d(-3%,2%,0) scale(1.05)}}
  @keyframes stars{from{background-position:0 0}to{background-position:340px 700px}}
  @media(prefers-reduced-motion:reduce){#colmena-app::before,#colmena-app::after{animation:none}}
  /* botones vivos */
  #colmena-app .btn{transition:transform .12s ease,filter .15s,box-shadow .2s}
  #colmena-app .btn-linea:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,.35)}
  #colmena-app .btn:active{transform:translateY(0)}
  #colmena-app .btn-verde,#colmena-app .btn-oro{position:relative;overflow:hidden}
  #colmena-app .btn-verde::after,#colmena-app .btn-oro::after{content:"";position:absolute;top:0;left:-120%;width:55%;height:100%;
    background:linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent);transform:skewX(-18deg);pointer-events:none;animation:sheen 3.8s ease-in-out infinite}
  @keyframes sheen{0%,55%{left:-120%}100%{left:135%}}
  /* tarjetas con vida */
  #colmena-app .card{transition:box-shadow .25s,border-color .25s}
  #colmena-app .card:hover{border-color:rgba(232,184,75,.22);box-shadow:0 18px 50px rgba(0,0,0,.45)}
  #colmena-app input:focus,#colmena-app select:focus{box-shadow:0 0 0 3px rgba(232,184,75,.14)}
  #colmena-app input[type=number]::-webkit-inner-spin-button,#colmena-app input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
  #colmena-app input[type=number]{-moz-appearance:textfield}
  #colmena-app .stepper{position:relative}
  #colmena-app .stepper input{padding-right:38px}
  #colmena-app .gas-row .stepper{flex:1}
  #colmena-app .stepper-btns{position:absolute;right:6px;top:6px;bottom:6px;display:flex;flex-direction:column;gap:3px}
  #colmena-app .stepper-btns button{flex:1;width:24px;border:1px solid var(--line);background:var(--panel);color:var(--ac-m);border-radius:6px;font-size:7px;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0;transition:background .12s,color .12s,transform .1s}
  #colmena-app .stepper-btns button:hover{background:var(--ac-m);color:var(--ac-t);border-color:var(--ac-d)}
  #colmena-app .stepper-btns button:active{transform:scale(.92)}
  #colmena-app .saldo-chip{font-family:var(--mono);font-size:10px;color:var(--acento);cursor:pointer;white-space:nowrap;text-transform:none;letter-spacing:0}
  #colmena-app .saldo-chip:hover{filter:brightness(1.15)} #colmena-app .saldo-chip b{color:var(--acento)}
  #colmena-app .btn-avz{background:rgba(255,255,255,.03);border:1px solid var(--line-soft);color:var(--ink-3);font-family:var(--mono);font-size:11px;padding:6px 12px;border-radius:8px;cursor:pointer;margin-top:14px;transition:color .12s,border-color .12s}
  #colmena-app .btn-avz:hover{color:var(--gold);border-color:var(--gold-soft)}
  #colmena-app .paso-box{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding:12px 14px;background:var(--panel-2);border:1px solid var(--line-soft);border-radius:11px}
  #colmena-app .paso-box span{display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:10.5px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.5px}
  #colmena-app .paso-box b{font-family:var(--display);font-size:17px;color:var(--ink)}
  #colmena-app .seg.presets{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}
  #colmena-app .bot-tipos{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:10px}
  @media(max-width:640px){#colmena-app .bot-tipos{grid-template-columns:1fr}}
  #colmena-app .bot-tipo{display:flex;flex-direction:column;align-items:flex-start;gap:5px;text-align:left;padding:14px;border:1.5px solid var(--line);background:linear-gradient(180deg,var(--panel),var(--panel-2));border-radius:14px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.05);transition:transform .1s,box-shadow .1s,border-color .14s,background .14s}
  #colmena-app .bot-tipo:active{transform:translateY(2px);box-shadow:0 0 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.05)}
  #colmena-app .bot-tipo:hover{border-color:var(--acento)}
  #colmena-app .bot-tipo.on{border-color:var(--gold);background:linear-gradient(180deg,rgba(232,184,75,.13),rgba(232,184,75,.04));box-shadow:0 3px 0 #8f6a1a,0 0 0 1px var(--gold) inset,inset 0 1px 0 rgba(255,255,255,.14)}
  #colmena-app .bot-tipo .bot-ico{font-size:26px;line-height:1}
  #colmena-app .bot-tipo .bot-nom{font-family:var(--display);font-size:15px;font-weight:700;color:var(--ink)}
  #colmena-app .bot-tipo.on .bot-nom{color:var(--gold)}
  #colmena-app .bot-tipo .bot-des{font-family:var(--sans);font-size:11px;line-height:1.4;color:var(--ink-3)}
  #colmena-app .rep-wrap{display:flex;flex-direction:column;gap:4px;align-items:center;margin-top:4px}
  #colmena-app .rep-pill{font-family:var(--mono);font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:7px;white-space:nowrap}
  #colmena-app .rep-v{background:linear-gradient(180deg,rgba(246,70,93,.30),rgba(246,70,93,.12));color:#ffb0b0;border:1px solid rgba(246,70,93,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 1px 2px rgba(0,0,0,.55);text-shadow:0 1px 1px rgba(0,0,0,.75)}
  #colmena-app .rep-c{background:linear-gradient(180deg,rgba(46,232,106,.30),rgba(46,232,106,.1));color:#96ffbe;border:1px solid rgba(46,232,106,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 1px 2px rgba(0,0,0,.55);text-shadow:0 1px 1px rgba(0,0,0,.75)}
  #colmena-app .seg.presets button{padding:10px 6px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));color:var(--ink-2);border-radius:9px;font-family:var(--mono);font-size:12px;cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06);transition:transform .08s,box-shadow .08s,background .12s,color .12s}
  #colmena-app .seg.presets button:active{transform:translateY(2px);box-shadow:0 0 0 rgba(0,0,0,.35)}
  #colmena-app .seg.presets button:hover{border-color:var(--acento);color:var(--ink)}
  #colmena-app .seg.presets button.on{background:linear-gradient(180deg,var(--ac-l),var(--ac-m) 50%,var(--ac-d));color:var(--ac-t);border-color:var(--ac-d);font-weight:800;box-shadow:0 2px 0 var(--ac-s),inset 0 1px 0 rgba(255,255,255,.4);text-shadow:0 1px 0 rgba(255,255,255,.3)}
  /* Mismo marco que la tarjeta de "precio ahora", para que todo combine */
  #colmena-app .asesor{position:relative;margin-top:12px;background:url('assets/img/marco-precio.webp') center/100% 100% no-repeat;border:none;border-radius:0;padding:7% 9%;box-shadow:none;transition:filter .18s ease}
  #colmena-app .asesor:hover{filter:drop-shadow(0 10px 24px rgba(0,0,0,.45))}
  #colmena-app .as-marco{position:relative;margin-top:12px;background:url('assets/img/marco-precio.webp') center/100% 100% no-repeat;border:none!important;border-radius:0!important;padding:7% 9%!important;box-shadow:none!important;transition:filter .18s ease}
  #colmena-app .as-marco:hover{filter:drop-shadow(0 10px 24px rgba(0,0,0,.45))}
  #colmena-app .asesor .as-top{display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:10.5px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}
  #colmena-app .asesor .as-top b{color:var(--acento)}
  #colmena-app .asesor .as-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  #colmena-app .asesor .as-grid>div{display:flex;flex-direction:column;gap:4px;background:rgba(0,0,0,.28);border:1px solid var(--line-soft);border-radius:10px;padding:10px 12px}
  #colmena-app .asesor .as-grid span{font-family:var(--mono);font-size:10px;color:var(--ink-3)}
  #colmena-app .asesor .as-grid b{font-family:var(--display);font-size:19px;font-weight:700;color:var(--gold)}
  #colmena-app .asesor .as-grid b.pos{color:var(--neon-lit)} #colmena-app .asesor .as-grid b.neg{color:var(--rojo)}
  #colmena-app .asesor .as-nota{margin-top:10px;font-family:var(--sans);font-size:11.5px;line-height:1.5;color:var(--ink-2)}
  #colmena-app .c-foot{max-width:1180px;margin:40px auto 0;padding:28px 22px 40px;border-top:1px solid var(--line)}
  #colmena-app .c-foot h4{font-family:var(--display);color:var(--gold);font-size:16px;margin:0 0 18px}
  #colmena-app .c-foot-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  #colmena-app .c-faq{background:rgba(255,255,255,.03);border:1px solid var(--line-soft);border-radius:14px;padding:16px}
  #colmena-app .c-faq-wrap{border:1px solid var(--line-soft);border-radius:14px;background:rgba(255,255,255,.02);overflow:hidden;max-width:640px;margin:0 auto}
  #colmena-app .c-faq-wrap summary{list-style:none;cursor:pointer;text-align:center;font-family:var(--display);color:var(--gold);font-size:15.5px;font-weight:700;padding:16px 18px;user-select:none;transition:background .15s}
  #colmena-app .c-faq-wrap summary:hover{background:rgba(232,184,75,.06)}
  #colmena-app .c-faq-wrap summary::-webkit-details-marker{display:none}
  #colmena-app .c-faq-wrap summary::after{content:'  ▾';color:var(--ink-3);font-size:12px}
  #colmena-app .c-faq-wrap[open] summary::after{content:'  ▴'}
  #colmena-app .c-faq-wrap[open] summary{border-bottom:1px solid var(--line-soft)}
  #colmena-app .c-faq-wrap .c-foot-grid{padding:16px}
  /* botón Compartir tornasol */
  #colmena-app .pio-tag.share{cursor:pointer;color:#3a2800;font-weight:800;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold) 50%,#c79426);box-shadow:0 2px 0 #8f6a1a,0 5px 12px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.55);transition:transform .08s,box-shadow .08s;text-shadow:0 1px 0 rgba(255,255,255,.3)}
  #colmena-app .pio-tag.share:hover{filter:brightness(1.06)}
  #colmena-app .pio-tag.share:active{transform:translateY(3px);box-shadow:0 0 0 #8f6a1a,0 2px 8px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.4)}
  #colmena-app .c-faq h5{font-family:var(--display);color:var(--ink);font-size:13.5px;margin:0 0 7px}
  #colmena-app .c-faq p{font-family:var(--sans);color:var(--ink-2);font-size:12.5px;line-height:1.55;margin:0}
  #colmena-app .c-foot-bottom{max-width:520px;margin:24px auto 0;text-align:center;font-family:var(--mono);font-size:11px;color:var(--ink-3);border:1px solid var(--line-soft);border-radius:12px;padding:14px 20px;background:rgba(255,255,255,.02)}
  #colmena-app .c-foot-bottom a{color:var(--gold-soft);text-decoration:none} #colmena-app .c-foot-bottom a:hover{color:var(--gold)}
  @media(max-width:720px){#colmena-app .c-foot-grid{grid-template-columns:1fr}}
  #colmena-app .rej{position:relative;overflow:hidden;transition:transform .25s,box-shadow .25s,border-color .25s}
  #colmena-app .rej:hover{transform:translateY(-2px);border-color:rgba(46,232,106,.4);box-shadow:0 20px 50px rgba(0,0,0,.5)}
  #colmena-app .rej>*{position:relative;z-index:1}
  /* indicador En vivo */
  #colmena-app .live{display:inline-flex;align-items:center;gap:6px;height:36px;box-sizing:border-box;white-space:nowrap;padding:0 13px;font-family:var(--mono);font-size:12px;font-weight:800;color:#3a2800;background:linear-gradient(180deg,#f7db8d,var(--gold) 50%,#c79426);border:1px solid #c79426;border-radius:11px;box-shadow:0 3px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5);text-shadow:0 1px 0 rgba(255,255,255,.3)}
  #colmena-app .live i{width:7px;height:7px;border-radius:50%;background:var(--neon-lit);box-shadow:0 0 8px var(--neon-lit);animation:cpulse 1.2s ease-in-out infinite}
  /* esqueleto de carga */
  #colmena-app .skel{display:inline-block;min-width:70px;height:1em;border-radius:8px;color:transparent;
    background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.12),rgba(255,255,255,.04));background-size:200% 100%;animation:shimmer 1.3s linear infinite}
  @keyframes shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
  /* aparición suave de secciones */
  #colmena-app .card,#colmena-app .rej{animation:rise .5s ease both}
  @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  /* ====== Ficha estilo Pionex ====== */
  #colmena-app .pio-head{display:flex;align-items:center;gap:12px}
  #colmena-app .pio-logo{width:46px;height:46px;border-radius:50%;flex:0 0 auto;object-fit:cover;background:var(--panel);border:1px solid var(--line)}
  #colmena-app .pio-mono{width:46px;height:46px;border-radius:50%;flex:0 0 auto;display:grid;place-items:center;font-family:var(--display);font-weight:700;color:#03210f;font-size:14px;background:linear-gradient(135deg,var(--neon),var(--gold))}
  #colmena-app .pio-titles{flex:1;min-width:0}
  #colmena-app .pio-pair{font-family:var(--display);font-size:19px;color:var(--ink);font-weight:700;line-height:1.1}
  #colmena-app .pio-sub{font-family:var(--mono);font-size:11px;color:var(--ink-3);margin-top:4px}
  #colmena-app .pio-nombre{text-align:center;font-family:var(--display);font-weight:800;font-size:19px;color:var(--gold);margin:6px 0 2px;letter-spacing:.3px;text-shadow:0 1px 0 rgba(0,0,0,.55),0 2px 10px rgba(232,184,75,.28)}
  #colmena-app .pio-tags{display:flex;gap:6px;flex:0 0 auto}
  #colmena-app .pio-tag{font-family:var(--mono);font-size:11px;height:28px;padding:0 12px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:5px;border-radius:8px;background:linear-gradient(180deg,rgba(46,232,106,.2),rgba(46,232,106,.08));color:var(--neon-lit);border:1px solid var(--neon-dim);font-weight:700;box-shadow:0 2px 0 rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.14);text-shadow:0 1px 1px rgba(0,0,0,.4)}
  #colmena-app .pio-tag.grey{background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.03));color:var(--ink-2);border-color:var(--line);box-shadow:0 2px 0 rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.1)}
  #colmena-app .pio-band{position:relative;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);min-height:90px;display:flex;align-items:center;margin:16px 0}
  #colmena-app .pio-band .l{position:relative;z-index:2;padding:16px 20px;flex:1}
  #colmena-app .pio-band .r{position:absolute;top:0;right:0;bottom:0;width:58%;z-index:1;padding:14px 22px;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;text-align:right;background:linear-gradient(120deg,var(--neon-dim),var(--neon));color:#03210f;clip-path:polygon(22% 0,100% 0,100% 100%,0 100%)}
  #colmena-app .pio-band .r.neg{background:linear-gradient(120deg,#a83636,var(--rojo));color:#2a0808}
  #colmena-app .pio-band .k{font-family:var(--mono);font-size:11px;opacity:.9;text-transform:uppercase;letter-spacing:.4px}
  #colmena-app .pio-band .l .v{font-family:var(--display);font-size:27px;font-weight:700;margin-top:4px;color:var(--ink)}
  #colmena-app .pio-band .r .v{font-family:var(--display);font-size:34px;font-weight:800;margin-top:2px;line-height:1;letter-spacing:-.5px;-webkit-text-stroke:1.1px currentColor;text-stroke:1.1px currentColor}
  #colmena-app .pio-band .l .v{-webkit-text-stroke:.5px currentColor;text-stroke:.5px currentColor}
  #colmena-app .pio-band .r .pct{font-family:var(--mono);font-size:15px;font-weight:800;margin-top:5px;opacity:1;-webkit-text-stroke:.35px currentColor;text-stroke:.35px currentColor}
  /* colapsable + pestañas + órdenes */
  #colmena-app .pio-toggle{width:100%;margin-top:14px;background:rgba(255,255,255,.03);border:1px solid var(--line-soft);border-radius:12px;padding:12px;font-family:var(--mono);font-size:12px;color:var(--ink-2);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
  #colmena-app .pio-toggle:hover{color:var(--gold);border-color:var(--gold-soft)}
  #colmena-app .pio-panel{margin-top:10px;display:none}
  #colmena-app .pio-panel.open{display:block;animation:rise .3s ease}
  #colmena-app .pio-tabs{display:flex;gap:6px;margin-bottom:10px}
  #colmena-app .pio-tabs button{flex:1;padding:9px;border:1px solid var(--line);background:transparent;color:var(--ink-2);border-radius:9px;font-family:var(--mono);font-size:12px;cursor:pointer}
  #colmena-app .pio-tabs button.on{background:var(--gold);color:#1a1200;border-color:var(--gold);font-weight:700}
  #colmena-app .ord-list{max-height:300px;overflow-y:auto;border:1px solid var(--line-soft);border-radius:10px;background:#0d1117}
  #colmena-app .ord-row{display:grid;grid-template-columns:1fr 1.4fr;gap:8px;padding:9px 13px;border-bottom:1px solid var(--line-soft);font-family:var(--mono);font-size:12px}
  #colmena-app .ord-row:last-child{border-bottom:none}
  #colmena-app .ord-row .st{text-align:right}
  #colmena-app .ord-row .st.compra{color:var(--neon-lit)} #colmena-app .ord-row .st.venta{color:var(--rojo)} #colmena-app .ord-row .st.off{color:var(--ink-3)}
  #colmena-app .ob-head{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;color:var(--ink-3);padding:9px 13px;text-transform:uppercase;letter-spacing:.4px}
  #colmena-app .ob-side{display:flex;flex-direction:column}
  #colmena-app .ob-row{position:relative;display:flex;justify-content:space-between;align-items:center;padding:5px 13px;font-family:var(--mono);font-size:12.5px;overflow:hidden}
  #colmena-app .ob-bar{position:absolute;right:0;top:1px;bottom:1px;z-index:0;border-radius:3px 0 0 3px;transition:width .5s ease}
  #colmena-app .ob-venta .ob-bar{background:rgba(246,70,93,.14)}
  #colmena-app .ob-compra .ob-bar{background:rgba(14,203,129,.14)}
  #colmena-app .ob-row .ob-p,#colmena-app .ob-row .ob-a{position:relative;z-index:1}
  #colmena-app .ob-venta .ob-p{color:var(--rojo)} #colmena-app .ob-compra .ob-p{color:var(--neon-lit)}
  #colmena-app .ob-row .ob-a{color:var(--ink-2)}
  #colmena-app .ob-mid{display:flex;justify-content:space-between;align-items:baseline;padding:9px 13px;font-family:var(--display);font-weight:800;font-size:17px;color:var(--gold);background:rgba(232,184,75,.07);border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft)}
  #colmena-app .ob-mid .ob-mid-lbl{font-family:var(--mono);font-size:10px;color:var(--ink-3);font-weight:400}
  #colmena-app .ob-empty{padding:14px;text-align:center;color:var(--ink-3);font-family:var(--mono);font-size:11px}
  #colmena-app .rangowarn{border-radius:11px;padding:12px 14px;margin-top:12px;font-family:var(--sans);font-size:12px;line-height:1.6}
  #colmena-app .rangowarn b{display:block;font-family:var(--display);font-size:13.5px;margin-bottom:5px}
  #colmena-app .rangowarn b + b{display:inline;font-size:12px;margin:0}
  #colmena-app .rangowarn i{display:block;font-style:normal;font-size:11.5px;margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.09);opacity:.85}
  #colmena-app .rangowarn.abajo{background:rgba(246,70,93,.09);border:1px solid rgba(246,70,93,.38);color:#ffc2ca}
  #colmena-app .rangowarn.abajo b{color:var(--rojo)}
  #colmena-app .rangowarn.arriba{background:rgba(46,232,106,.09);border:1px solid rgba(46,232,106,.35);color:#bff5d3}
  #colmena-app .rangowarn.arriba b{color:var(--neon-lit)}
  #colmena-app .rangowarn.cerca{background:rgba(232,184,75,.08);border:1px solid rgba(232,184,75,.32);color:var(--ink-2)}
  #colmena-app .rangowarn.cerca b{color:var(--gold)}
  /* ══════ TEXTOS: LARGO EN LA WEB, CORTO EN EL MÓVIL ══════
     El mismo texto que se lee bien en un monitor ocupa seis líneas en un
     móvil. Se escriben las dos versiones y cada pantalla usa la suya. */
  #colmena-app .nota-corta{display:none}
  #colmena-app .nota-larga{display:inline}
  @media(max-width:760px){
    #colmena-app .nota-corta{display:inline}
    #colmena-app .nota-larga{display:none}
    /* El cupo y el botón de cerrar: en móvil, lo mínimo. "3/8" dice lo
       mismo que "3 bots activos" y no empuja al título "Mis bots". */
    /* El número ya viene como "1/8" desde el JS: solo se oculta el texto. */
    #colmena-app .c-cupo .cupo-tx{display:none}
    #colmena-app .c-cupo span{display:none}
    #colmena-app .c-cupo{padding:0 10px;gap:3px}
    #colmena-app .c-cupo{padding:0 12px}
    #colmena-app .cerrar-largo{display:none !important}
    #colmena-app .cerrar-corto{display:inline !important}
    #colmena-app .btn-cerrar-todos{padding:0 13px}
    /* Las flechitas de los campos numéricos: FUERA en el móvil.
       Se escribe con el teclado y el dedo nunca acierta en una flecha
       de 8px. En la web se quedan, que ahí van bien. */
    #colmena-app input[type="${tipoNum()}"]::-webkit-inner-spin-button,
    #colmena-app input[type="${tipoNum()}"]::-webkit-outer-spin-button,
    #conf-box input[type="${tipoNum()}"]::-webkit-inner-spin-button,
    #conf-box input[type="${tipoNum()}"]::-webkit-outer-spin-button,
    input[type="${tipoNum()}"]::-webkit-inner-spin-button,
    input[type="${tipoNum()}"]::-webkit-outer-spin-button{
      -webkit-appearance:none !important;appearance:none !important;
      margin:0 !important;display:none !important;width:0 !important}
    input[type="${tipoNum()}"]{-moz-appearance:textfield !important}
  }
  #colmena-app .cerrar-corto{display:none}
  #colmena-app .cerrar-largo{display:inline}
  #colmena-app .sinleer{padding:12px 14px;border-radius:11px;margin-top:8px;
    background:rgba(255,255,255,.025);border:1px dashed #3a424c;
    font-family:var(--sans);font-size:12px;color:var(--ink-3);text-align:center;line-height:1.5}
  #colmena-app .gaswarn{background:rgba(255,107,107,.08);border:1px solid var(--rojo);color:var(--rojo);border-radius:10px;padding:9px 12px;font-family:var(--mono);font-size:11.5px;margin-top:12px}
  #colmena-app .pio-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  #colmena-app .pio-box{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:11px 12px}
  #colmena-app .pio-box .k{display:flex;align-items:center;gap:5px;font-family:var(--mono);font-size:9.5px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:.4px;text-shadow:0 1px 1px rgba(0,0,0,.5)}
  #colmena-app .pio-box .v{font-family:var(--display);font-size:16px;color:var(--ink);margin-top:5px}
  #colmena-app .pio-box .v.pos{color:var(--neon-lit)} #colmena-app .pio-box .v.neg{color:var(--rojo)}
  #colmena-app .pio-box .v2{font-family:var(--mono);font-size:11.5px;margin-top:2px}
  #colmena-app .pio-box .v2.pos{color:var(--neon-lit)} #colmena-app .pio-box .v2.neg{color:var(--rojo)}
  /* ====== Ficha PREMIUM ====== */
  #colmena-app .rej{background:linear-gradient(160deg,rgba(19,25,29,.98),rgba(8,11,13,.99));border:1px solid rgba(232,184,75,.22);box-shadow:0 18px 52px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05)}
  #colmena-app .rej::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold-soft) 30%,var(--gold) 50%,var(--gold-soft) 70%,transparent);opacity:.55;z-index:3}
  #colmena-app .pio-band .r .k{font-weight:800;opacity:1;font-size:12px;letter-spacing:.5px}
  @keyframes flow{from{background-position:220% 0}to{background-position:-220% 0}}
  #colmena-app .rej::after{content:none}
  #colmena-app .rej:hover{transform:translateY(-3px);border-color:rgba(232,184,75,.55);box-shadow:0 30px 72px rgba(0,0,0,.62),0 0 34px rgba(232,184,75,.16)}
  #colmena-app .pio-logo,#colmena-app .pio-mono{box-shadow:0 0 0 1px rgba(255,255,255,.14),0 0 18px rgba(232,184,75,.22),0 6px 18px rgba(0,0,0,.45);width:50px;height:50px}
  #colmena-app .pio-mono{background:linear-gradient(135deg,#f7db8d,var(--gold))}
  #colmena-app .pio-pair{letter-spacing:-.3px;font-size:21px;text-shadow:0 0 18px rgba(232,184,75,.15)}
  #colmena-app .pio-sub .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--neon-lit);box-shadow:0 0 10px var(--neon-lit),0 0 4px #fff;margin-right:5px;vertical-align:middle;animation:cpulse 1.2s ease-in-out infinite}
  #colmena-app .pio-tag{backdrop-filter:blur(4px);letter-spacing:.3px}
  /* Los tres botones iguales: mismo ancho, misma altura, mismo relieve */
  #colmena-app .pio-tags{display:flex;gap:6px;align-items:stretch}
  #colmena-app .pio-tag{min-width:92px;height:30px;flex:0 0 auto}
  #colmena-app .pio-tag.grey{box-shadow:0 2px 0 rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.1)}
  @media(max-width:560px){#colmena-app .pio-tags{gap:5px}#colmena-app .pio-tag{min-width:0;flex:1;height:28px}}
  /* Banda de P&L premium (con brillo que barre) */
  #colmena-app .pio-band{min-height:116px;border:1px solid rgba(232,184,75,.14);background:radial-gradient(140% 160% at 0% 0%,rgba(24,31,35,.97),rgba(6,9,11,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
  #colmena-app .pio-band .r{background:linear-gradient(125deg,var(--neon-dim),var(--neon-lit) 52%,var(--neon));box-shadow:-28px 0 60px rgba(46,232,106,.35)}
  #colmena-app .pio-band .r.neg{background:linear-gradient(125deg,#8f2f2f,#d64545 52%,var(--rojo));box-shadow:-28px 0 60px rgba(232,80,80,.32)}
  #colmena-app .pio-band .r::before{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.45) 47%,rgba(255,255,255,.1) 55%,transparent 66%);transform:translateX(-130%);animation:sheen 3.4s ease-in-out infinite;pointer-events:none}
  @keyframes sheen{0%,52%{transform:translateX(-130%)}78%,100%{transform:translateX(130%)}}
  #colmena-app .pio-band .l .v{font-size:30px}
  #colmena-app .pio-band .r .v{font-size:40px;text-shadow:0 2px 18px rgba(0,0,0,.28),0 0 24px rgba(255,255,255,.15)}
  #colmena-app .pio-band .r .pct{font-size:16px}
  /* Cajas de datos premium */
  #colmena-app .pio-grid{gap:9px}
  #colmena-app .pio-box{background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.09);transition:border-color .18s,transform .18s,box-shadow .18s,background .18s;position:relative;overflow:hidden}
  #colmena-app .pio-box:hover{border-color:rgba(232,184,75,.4);transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,.4);background:linear-gradient(160deg,rgba(255,255,255,.1),rgba(255,255,255,.03))}
  #colmena-app .pio-box .v{font-weight:700;letter-spacing:-.2px;font-size:16.5px}
  #colmena-app .pio-box .v.pos{text-shadow:0 0 14px rgba(46,232,106,.35)}
  #colmena-app .pio-toggle{background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));box-shadow:0 3px 0 rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.06);transition:transform .08s,box-shadow .08s,color .15s,border-color .15s;font-weight:700}
  #colmena-app .pio-toggle:active{transform:translateY(3px);box-shadow:0 0 0 rgba(0,0,0,.28)}
  /* ====== Modal de la página ====== */
  #colmena-modal{position:fixed;inset:0;z-index:2000;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(4,7,10,.66);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);--ac-l:#f7db8d;--ac-m:#E8B84B;--ac-d:#c79426;--ac-s:#8f6a1a;--ac-t:#3a2800;--acento:var(--gold)}
  #colmena-modal.show{display:flex;animation:fade .16s ease both}
  #colmena-modal .m-card{max-width:430px;width:100%;background:linear-gradient(180deg,var(--panel),var(--panel-2));border:1px solid var(--gold-soft);border-radius:18px;padding:26px;box-shadow:0 30px 90px rgba(0,0,0,.7);animation:rise .2s ease both;will-change:transform,opacity}
  #colmena-modal h4{font-family:var(--display);color:var(--gold);font-size:19px;margin:0 0 12px}
  #colmena-modal h4:empty{display:none;margin:0}
  #colmena-modal p{font-size:14px;color:var(--ink-2);line-height:1.55;margin:0 0 20px}
  #colmena-modal .m-btns{display:flex;gap:10px}
  #colmena-modal .m-btns .btn{margin:0;flex:1}
  @keyframes fade{from{opacity:0}to{opacity:1}}
  /* ====== gas: botón Max ====== */
  #colmena-app .gas-sep{position:absolute;left:3.83%;top:45.79%;width:92.34%;height:34.34%;margin:0;padding:0;border:none}
  #colmena-app .gas-sep .btn{width:100%;height:100%;box-sizing:border-box;padding-top:0;padding-bottom:0;background:transparent;border:none;box-shadow:none}
  #colmena-app .gas-sep .btn:hover{background:transparent;border:none;box-shadow:0 8px 24px rgba(0,0,0,.45);transform:translateY(-1px)}
  #colmena-app .gas-rtx{display:inline-block;transform:translateY(2px)}
  #colmena-app .btn-max{width:100%;margin-top:0;padding:12px}
  /* Sin esto, un elemento ancho estira la columna y saca la tarjeta de la pantalla */
  #colmena-app .cols>*,#colmena-app .fila>*,#colmena-app .fila-coins>*,#colmena-app .card{min-width:0}
  #colmena-app .card{overflow:hidden}
  @media(max-width:400px){
    /* El iconito de ayuda nunca se sale del borde */
    #colmena-app .i-btn{margin-right:2px}
    #colmena-app .lab{padding-right:2px}
    #colmena-app .paso-box{gap:6px;padding:11px 12px}
    /* Ninguna etiqueta se sale por la derecha, ni con el icono de ayuda */
    #colmena-app .lab{max-width:100%;overflow:hidden}
    #colmena-app .lab .i-btn{margin-right:0}
    #colmena-app .lab-sug .lab-tx{max-width:calc(100% - 78px)}
    #colmena-app .paso-box>span{min-width:0;flex:1}
    #colmena-app .paso-box .i-btn{flex:0 0 auto}
    #colmena-app .wrap{padding:18px 12px 50px}
    #colmena-app .card{padding:15px}
    #colmena-app .bot-tabs{grid-template-columns:1fr 1fr}
    #colmena-app .fila,#colmena-app .fila-coins{grid-template-columns:1fr}
  }
  @media(max-width:860px){#colmena-app .cols{grid-template-columns:1fr}#colmena-app .rej-grid{grid-template-columns:1fr}#colmena-app .prev{grid-template-columns:repeat(2,1fr)}#colmena-app .pio-grid{grid-template-columns:repeat(2,1fr)}}
  @media(max-width:560px){
    #colmena-app .c-hdr{padding:10px 14px;flex-wrap:wrap}
    #colmena-app .c-ticker{order:3;flex:0 0 100%;width:100%;max-width:none;height:34px;margin:9px 0 1px;border-radius:5px;
      -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 15%,#000 85%,transparent 100%);-webkit-mask-repeat:no-repeat;-webkit-mask-size:100% 100%;
              mask-image:linear-gradient(90deg,transparent 0,#000 15%,#000 85%,transparent 100%);mask-repeat:no-repeat;mask-size:100% 100%}
    #colmena-app .c-menu-btn{display:inline-flex}
    #colmena-app .c-sep{display:none}
    #colmena-app .inv-lbl{display:none}
    #colmena-app .gas-stepper .stepper-btns{display:none}
    #colmena-app .gas-stepper input{padding-right:82px}
    #colmena-app .gas-stepper input:focus{padding-right:14px}
    #colmena-app .gas-hint{font-size:9px;right:12px;gap:3px}
    #colmena-app .gas-i{width:12px;height:12px;font-size:7.5px}
    #colmena-app .c-hdr-r{position:absolute;top:calc(100% + 8px);right:12px;flex-direction:column;align-items:stretch;gap:5px;min-width:212px;background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid var(--line);border-radius:14px;padding:8px;box-shadow:0 18px 44px rgba(0,0,0,.6);display:none;z-index:60}
    #colmena-app .c-hdr.open .c-hdr-r{display:flex;animation:cmFade .14s ease}
    #colmena-app .c-hdr-r>.live,#colmena-app .c-hdr-r>.c-swap,#colmena-app .c-hdr-r>.c-loteria,#colmena-app .c-hdr-r>.c-perfil,#colmena-app .c-hdr-r>.c-prize,#colmena-app .c-hdr-r>.c-market,#colmena-app .c-hdr-r>.dir{width:100%;height:42px;justify-content:flex-start;gap:11px;border-radius:10px;padding:0 13px;font-size:13px;background:transparent;border:1px solid transparent;box-shadow:none;color:var(--gold);text-shadow:none;font-weight:700}
    #colmena-app .c-hdr-r>.live:active,#colmena-app .c-hdr-r>.c-swap:active,#colmena-app .c-hdr-r>.c-loteria:active,#colmena-app .c-hdr-r>.c-perfil:active{transform:none}
    #colmena-app .c-hdr-r>.dir{color:var(--ink-2);font-size:12px}
    #colmena-app .c-hdr-r>.hdr-off{display:flex;align-items:center;justify-content:flex-start;gap:11px;width:100%;height:42px;border-radius:10px;padding:0 13px;background:transparent;border:1px solid transparent;box-shadow:none;color:var(--rojo)}
    #colmena-app .c-hdr-r>.hdr-off::after{content:'Desconectar';font-family:var(--mono);font-size:13px;font-weight:700}
    #colmena-app .c-hdr-r>.hdr-off:active{transform:none}
    #colmena-app .c-lot-tx,#colmena-app .c-swap-tx,#colmena-app .c-prize-tx,#colmena-app .c-market-tx,#colmena-app .live-tx{display:inline}
    #colmena-app .c-logo{height:30px}
    #colmena-app .bot-tabs{grid-template-columns:repeat(2,1fr)}
    #colmena-app .bot-tabs>*,#colmena-app .fila>*,#colmena-app .fila-coins>*,#colmena-app .seg>*,#colmena-app .seg.presets>*,#colmena-app .stats>*,#colmena-app .rej-btns>*,#colmena-app .as-grid>*{min-width:0}
    #colmena-app .bot-tab .bt-nom{overflow-wrap:anywhere}
    #colmena-app .hdr-btn{padding:0 12px;font-size:13px}
    #colmena-app .wrap{padding:18px 14px 50px}
    #colmena-app .hero{padding:44px 16px}
    #colmena-app .hero h1{font-size:26px}
    #colmena-app .seg.presets{grid-template-columns:repeat(2,1fr)}
    #colmena-app .seg.presets button{font-size:12px;padding:10px 4px}
    #colmena-app .cols{gap:14px}
    #colmena-app .card{padding:16px}
    #colmena-app .pio-band .r{width:56%;padding:12px 16px}
    #colmena-app .pio-band .cur{display:none}
    #colmena-app .pio-band .k{white-space:nowrap}
    #colmena-app .pio-band .l{padding:12px 14px}
    #colmena-app .pio-band .r .v{font-size:26px}
    #colmena-app .pio-band .l .v{font-size:21px}
    #colmena-app .pio-band .pct{font-size:13px}
    #colmena-app .prev{grid-template-columns:repeat(2,1fr)}
    #colmena-app .pio-grid{grid-template-columns:repeat(2,1fr)}
    #colmena-app .fila{flex-wrap:wrap}
    #colmena-app select,#colmena-app input{min-width:0}
    #colmena-app .asesor .as-grid{grid-template-columns:1fr 1fr}
    /* Responsividad de la tarjeta del bot en móvil (solo ajuste, sin tocar diseño) */
    #colmena-app .pio-head{flex-wrap:nowrap}
    #colmena-app .pio-tags{flex-basis:auto;margin-top:0;flex-direction:row-reverse;align-self:flex-start;gap:5px}
    #colmena-app .pio-tag{height:24px;font-size:10px;padding:0 8px;gap:3px}
    #colmena-app .pio-tag.share .lbl{display:none}
    #colmena-app .pio-tag.share{padding:0 9px;font-size:13px}
    #colmena-app .pio-time{white-space:nowrap}
    #colmena-app .pio-tags .grey{display:none}
    #colmena-app .pio-op{display:none}
    #colmena-app .pio-band .tot{display:none}
    #colmena-app .pio-box[data-box="vueltas"],#colmena-app .pio-box[data-box="gas"]{display:none}
    #colmena-app .pio-toggle{display:none}
    #colmena-app .pio-logo,#colmena-app .pio-mono{width:42px;height:42px}
    #colmena-app .pio-pair{font-size:18px}
    #colmena-app .pio-nombre{font-size:17px}
  }
  `;
  document.head.appendChild(s);
  const pop = document.createElement('div'); pop.id = 'colmena-pop'; document.body.appendChild(pop);
  document.addEventListener('click', (e) => { if (!e.target.closest('.i-btn') && e.target.id !== 'colmena-pop') pop.style.display = 'none'; });
  if (!$('colmena-modal')) {
    const md = document.createElement('div'); md.id = 'colmena-modal';
    md.innerHTML = `<div class="m-card"><h4 id="cm-title"></h4><p id="cm-body"></p>
      <div class="m-btns"><button class="btn btn-linea" id="cm-cancel">Cancelar</button><button class="btn btn-oro" id="cm-ok">Confirmar</button></div></div>`;
    document.body.appendChild(md);
  }
  window.__botLogoFail = function (img, ini) { const d = document.createElement('div'); d.className = 'pio-mono'; d.textContent = ini; img.replaceWith(d); };
}
