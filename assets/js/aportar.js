/* ══════════════════════════════════════════════════════════════════════
   aportar.js — Sección "Add liquidity" estilo Earn page (tanda 4)
   ══════════════════════════════════════════════════════════════════════
   Investigado sobre GMX (que es nuestro mismo modelo: los que aportan son la
   contraparte de los que operan con futuros). Estructura de "Earn page":
   · Tabs Aportar / Retirar.
   · Panel "tu resumen" (tu aporte, comisiones ganadas, desbloqueo).
   · Tarjeta de depósito con monto y plazos de bloqueo.
   · Cómo funciona en pasos.
   · Descargo honesto.

   Se mantiene lo pedido por el owner:
   · SIN métricas de capital total (no se expone cuánta liquidez hay).
   · SIN APR fijo mentiroso (el rendimiento es variable, se dice claro).

   Solo interfaz (Fase 2): no hay contrato aún. Los botones muestran
   "coming soon". Texto en español (base), traducido por idioma.js.
*/

const PLAZOS = [
  { id: '7d', etiqueta: '7 días'  },
  { id: '1m', etiqueta: '1 mes'   },
  { id: '3m', etiqueta: '3 meses' },
  { id: '6m', etiqueta: '6 meses' },
  { id: '1a', etiqueta: '1 año'   }
];

let _cssPuesto = false;

function estilos() {
  if (_cssPuesto) return;
  _cssPuesto = true;
  const css = `
  #lq-wrap{max-width:680px}
  #lq-wrap .lq-head{text-align:center;margin-bottom:22px}
  #lq-wrap .lq-title{font-family:var(--display);font-weight:800;font-size:27px;color:#eef1f6;
    display:flex;align-items:center;justify-content:center;gap:14px}
  #lq-wrap .lq-title .ln{flex:1;max-width:70px;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
  #lq-wrap .lq-sub{font-family:var(--mono);font-size:13px;color:var(--gold-soft);margin-top:8px}

  /* Resumen de TU posición (no de la pool total). */
  #lq-wrap .lq-mine{display:flex;gap:11px;margin-bottom:20px;flex-wrap:wrap}
  #lq-wrap .lq-mine .m{flex:1;min-width:150px;background:rgba(16,20,26,.62);border:1px solid var(--line);
    border-radius:15px;padding:14px 16px;backdrop-filter:blur(12px)}
  #lq-wrap .lq-mine .m b{display:block;font-family:var(--display);font-weight:800;font-size:19px;color:#eef1f6}
  #lq-wrap .lq-mine .m b.gold{color:var(--gold)}
  #lq-wrap .lq-mine .m span{display:block;font-family:var(--mono);font-size:10px;color:var(--ink3,#7d8794);
    text-transform:uppercase;letter-spacing:.06em;margin-top:4px}

  /* Tabs Aportar / Retirar. */
  #lq-wrap .lq-tabs{display:flex;background:rgba(10,14,19,.55);border:1px solid var(--line);border-radius:13px;padding:4px;margin-bottom:16px}
  #lq-wrap .lq-tabs button{flex:1;height:40px;border:none;background:none;border-radius:10px;
    font-family:var(--display);font-weight:700;font-size:14px;color:var(--ink3,#7d8794);cursor:pointer;transition:all .13s}
  #lq-wrap .lq-tabs button.on{color:#241900;background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426);
    box-shadow:0 2px 0 #8f6a1a}

  /* Tarjeta de depósito. */
  #lq-wrap .lq-card{background:rgba(11,14,17,.66);border:1px solid var(--line);border-radius:16px;
    padding:16px;margin-bottom:14px;backdrop-filter:blur(12px)}
  #lq-wrap .lq-lbl{font-family:var(--mono);font-size:10.5px;color:var(--ink3,#7d8794);
    text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
  #lq-wrap .lq-amt-row{display:flex;align-items:center;gap:10px}
  #lq-wrap .lq-amt{flex:1;min-width:0;background:transparent;border:none;outline:none;
    font-family:var(--display);font-weight:700;font-size:28px;color:#eef1f6;width:100%}
  #lq-wrap .lq-amt::placeholder{color:var(--ink4,#4a5561)}
  #lq-wrap .lq-usdt{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;
    background:linear-gradient(180deg,#1b2027,#12161c);border:1px solid var(--gold-soft);
    border-radius:100px;padding:8px 14px;font-family:var(--display);font-weight:700;font-size:14px;color:#eef1f6}
  #lq-wrap .lq-max{margin-left:2px;font-family:var(--mono);font-size:11px;font-weight:700;color:#3a2800;
    background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426);border:1px solid #c79426;
    border-radius:8px;padding:4px 10px;cursor:pointer;box-shadow:0 2px 0 #8f6a1a}

  /* Plazos — sin porcentajes. */
  #lq-wrap .lq-plazos{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
  #lq-wrap .lq-plazo{flex:1;min-width:78px;background:rgba(10,14,19,.5);border:1px solid var(--line);
    border-radius:13px;padding:13px 8px;cursor:pointer;text-align:center;transition:border-color .14s,background .14s}
  #lq-wrap .lq-plazo:hover{border-color:var(--gold-soft)}
  #lq-wrap .lq-plazo.on{border-color:var(--gold);background:rgba(232,184,75,.1)}
  #lq-wrap .lq-plazo b{display:block;font-family:var(--display);font-weight:700;font-size:14px;color:#eef1f6}
  #lq-wrap .lq-plazo em{display:block;font-style:normal;font-family:var(--mono);font-size:9px;
    color:var(--ink3,#7d8794);text-transform:uppercase;letter-spacing:.05em;margin-top:4px}

  #lq-wrap .lq-go{width:100%;height:54px;border:1px solid #c79426;border-radius:13px;
    background:linear-gradient(180deg,#f7db8d,var(--gold) 46%,#c79426);color:#241900;
    font-family:var(--display);font-weight:800;font-size:16px;cursor:pointer;
    box-shadow:0 5px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5);text-shadow:0 1px 0 rgba(255,255,255,.28);
    transition:filter .16s,transform .09s,box-shadow .09s}
  #lq-wrap .lq-go:hover{filter:brightness(1.05)}
  #lq-wrap .lq-go:active{transform:translateY(4px);box-shadow:0 1px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}

  /* Cómo funciona. */
  #lq-wrap .lq-how{display:flex;flex-direction:column;gap:10px;margin:22px 0}
  #lq-wrap .lq-step{display:flex;gap:13px;align-items:flex-start;
    background:rgba(11,14,17,.6);border:1px solid var(--line);border-radius:14px;padding:14px 15px;backdrop-filter:blur(12px)}
  #lq-wrap .lq-step .n{flex:0 0 auto;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;
    font-family:var(--display);font-weight:800;font-size:14px;color:#241900;
    background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426);border:1px solid #c79426;box-shadow:0 3px 0 #8f6a1a}
  #lq-wrap .lq-step div b{display:block;font-family:var(--display);font-weight:700;font-size:14px;color:#eef1f6;margin-bottom:3px}
  #lq-wrap .lq-step div span{display:block;font-size:12.5px;line-height:1.55;color:#a9b2bd}

  #lq-wrap .lq-disc{font-family:var(--mono);font-size:10.5px;line-height:1.65;color:var(--ink3,#7d8794);
    padding:13px 15px;background:rgba(10,14,19,.4);border:1px solid var(--line);border-radius:12px}
  #lq-wrap .lq-disc b{color:var(--gold-soft)}
  `;
  const st = document.createElement('style');
  st.id = 'lq-css';
  st.textContent = css;
  document.head.appendChild(st);
}

export function montarAportar(cont) {
  if (!cont) return;
  estilos();
  let modo = 'aportar';   // aportar | retirar

  cont.innerHTML = `
    <div class="lq-head">
      <div class="lq-title"><span class="ln"></span>Aportar liquidez<span class="ln"></span></div>
      <div class="lq-sub">Gana una parte de las comisiones cuando otros operan con futuros</div>
    </div>

    <div class="lq-mine">
      <div class="m"><b>0.00 USDT</b><span>Tu aporte</span></div>
      <div class="m"><b class="gold">0.00 USDT</b><span>Comisiones ganadas</span></div>
      <div class="m"><b>—</b><span>Se desbloquea</span></div>
    </div>

    <div class="lq-tabs">
      <button class="on" data-modo="aportar">Aportar</button>
      <button data-modo="retirar">Retirar</button>
    </div>

    <div id="lq-panel"></div>

    <div class="lq-how">
      <div class="lq-step"><span class="n">1</span><div><b>Aportas USDT</b><span>Depositas la cantidad que elijas. Tu aporte queda registrado a tu nombre: siempre se sabe qué parte es tuya.</span></div></div>
      <div class="lq-step"><span class="n">2</span><div><b>Otros operan con futuros</b><span>Cada vez que alguien abre o mantiene una operación, paga una comisión. Una parte de esa comisión es para ti, repartida entre quienes aportan.</span></div></div>
      <div class="lq-step"><span class="n">3</span><div><b>Retiras al vencer el plazo</b><span>Tu aporte se bloquea durante el plazo que elijas. Al terminar, retiras tu capital más las comisiones que hayas ganado.</span></div></div>
    </div>

    <div class="lq-disc">
      <b>Aviso importante:</b> aportar liquidez no garantiza ningún rendimiento fijo. Lo que ganas depende por completo de cuánta gente opere: si hay mucha actividad, ganas más; si hay poca, puedes ganar muy poco o nada durante ese periodo. Tu aporte queda bloqueado durante el plazo elegido y no se puede retirar antes de tiempo. Además, aportar liquidez conlleva riesgo de mercado: en momentos de fuerte movimiento, el capital de la reserva puede disminuir. Aporta solo lo que puedas permitirte inmovilizar y, llegado el caso, perder.
    </div>`;

  const panel = cont.querySelector('#lq-panel');

  function pintarPanel() {
    if (modo === 'aportar') {
      panel.innerHTML = `
        <div class="lq-card">
          <div class="lq-lbl">Cantidad a aportar</div>
          <div class="lq-amt-row">
            <input class="lq-amt" id="lq-amt" type="text" inputmode="decimal" placeholder="0.00">
            <span class="lq-usdt">USDT <button class="lq-max" id="lq-max" type="button">MÁX</button></span>
          </div>
        </div>
        <div class="lq-lbl" style="margin:0 2px 8px">Plazo de bloqueo</div>
        <div class="lq-plazos" id="lq-plazos">
          ${PLAZOS.map((p, i) => `<div class="lq-plazo${i === 1 ? ' on' : ''}" data-plazo="${p.id}"><b>${p.etiqueta}</b><em>bloqueado</em></div>`).join('')}
        </div>
        <button class="lq-go" id="lq-go" type="button">Aportar liquidez</button>`;
      panel.querySelectorAll('.lq-plazo').forEach((el) => el.onclick = () => {
        panel.querySelectorAll('.lq-plazo').forEach((x) => x.classList.remove('on')); el.classList.add('on');
      });
    } else {
      panel.innerHTML = `
        <div class="lq-card">
          <div class="lq-lbl">Cantidad a retirar</div>
          <div class="lq-amt-row">
            <input class="lq-amt" id="lq-amt" type="text" inputmode="decimal" placeholder="0.00">
            <span class="lq-usdt">USDT <button class="lq-max" id="lq-max" type="button">MÁX</button></span>
          </div>
        </div>
        <div class="lq-disc" style="margin-bottom:14px">Solo puedes retirar el aporte cuyo plazo de bloqueo ya haya vencido. Lo que sigue bloqueado aparece con su fecha de desbloqueo arriba.</div>
        <button class="lq-go" id="lq-go" type="button">Retirar</button>`;
    }
    const go = panel.querySelector('#lq-go');
    if (go) go.onclick = () => { const t = go.textContent; go.textContent = 'Muy pronto — en desarrollo'; setTimeout(() => { go.textContent = t; }, 2000); };
    const max = panel.querySelector('#lq-max');
    if (max) max.onclick = (e) => e.preventDefault();
  }

  cont.querySelectorAll('.lq-tabs button').forEach((b) => b.onclick = () => {
    modo = b.dataset.modo;
    cont.querySelectorAll('.lq-tabs button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    pintarPanel();
  });

  pintarPanel();
}
