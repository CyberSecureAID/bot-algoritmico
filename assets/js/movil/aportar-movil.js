/* ══════════════════════════════════════════════════════════════════════
   aportar-movil.js — Add liquidity para MÓVIL (overlay estilo app)
   ══════════════════════════════════════════════════════════════════════
   Vista propia para el teléfono: overlay a pantalla completa con formulario
   compacto (Aportar / Retirar, monto, plazos, descargo). NO redirige a la
   página de escritorio (eso causaba el bucle de flasheo que botaba a Home).

   Solo interfaz (Fase 2): el botón muestra "coming soon". Texto en español,
   traducido por idioma.js.
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
  .alm{position:fixed;inset:0;z-index:500;background:#0a0d12;display:flex;flex-direction:column;
    font-family:'Plus Jakarta Sans',sans-serif;color:#eef1f6;
    --gold:#E8B84B;--ink3:#7d8794;--ink4:#4a5561;--line:#232b36}
  .alm .alm-head{display:flex;align-items:center;gap:12px;padding:16px 14px;border-bottom:1px solid var(--line)}
  .alm .alm-x{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid var(--line);
    color:#7d8794;display:grid;place-items:center;font-size:15px}
  .alm .alm-h{font-family:'Plus Jakarta Sans';font-weight:800;font-size:18px}
  .alm .alm-body{flex:1;overflow-y:auto;padding:16px 14px 30px;display:flex;flex-direction:column;gap:13px}

  .alm .alm-sub{font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--gold);text-align:center;margin-bottom:4px}

  .alm .alm-mine{display:flex;gap:9px}
  .alm .alm-mine .m{flex:1;background:rgba(16,20,26,.62);border:1px solid var(--line);border-radius:13px;padding:12px 11px}
  .alm .alm-mine .m b{display:block;font-weight:800;font-size:15px}
  .alm .alm-mine .m b.gold{color:var(--gold)}
  .alm .alm-mine .m span{display:block;font-family:'IBM Plex Mono';font-size:9px;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em;margin-top:3px}

  .alm .alm-tabs{display:flex;background:rgba(10,14,19,.55);border:1px solid var(--line);border-radius:12px;padding:4px}
  .alm .alm-tabs button{flex:1;height:38px;border:none;background:none;border-radius:9px;font-weight:700;font-size:14px;color:var(--ink3)}
  .alm .alm-tabs button.on{color:#241900;background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426)}

  .alm .alm-card{background:rgba(11,14,17,.66);border:1px solid var(--line);border-radius:14px;padding:14px}
  .alm .alm-lbl{font-family:'IBM Plex Mono';font-size:10.5px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
  .alm .alm-amt-row{display:flex;align-items:center;gap:10px}
  .alm .alm-amt{flex:1;min-width:0;background:none;border:none;outline:none;color:#eef1f6;font-weight:700;font-size:26px}
  .alm .alm-amt::placeholder{color:var(--ink4)}
  .alm .alm-usdt{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(180deg,#1b2027,#12161c);
    border:1px solid #C9A84B;border-radius:100px;padding:7px 13px;font-weight:700;font-size:13px}
  .alm .alm-max{font-family:'IBM Plex Mono';font-size:11px;font-weight:700;color:#3a2800;
    background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426);border:1px solid #c79426;border-radius:8px;padding:4px 9px}

  .alm .alm-plazos{display:flex;gap:7px;flex-wrap:wrap}
  .alm .alm-plazo{flex:1;min-width:60px;background:rgba(10,14,19,.5);border:1px solid var(--line);border-radius:11px;
    padding:11px 4px;text-align:center}
  .alm .alm-plazo.on{border-color:var(--gold);background:rgba(232,184,75,.1)}
  .alm .alm-plazo b{display:block;font-weight:700;font-size:13px}
  .alm .alm-plazo em{display:block;font-style:normal;font-family:'IBM Plex Mono';font-size:8px;color:var(--ink3);text-transform:uppercase;margin-top:3px}

  .alm .alm-go{height:52px;border:1px solid #c79426;border-radius:13px;
    background:linear-gradient(180deg,#f7db8d,var(--gold) 46%,#c79426);color:#241900;font-weight:800;font-size:16px;
    box-shadow:0 4px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}
  .alm .alm-go:active{transform:translateY(3px);box-shadow:0 1px 0 #8f6a1a}

  .alm .alm-how{display:flex;flex-direction:column;gap:9px}
  .alm .alm-step{display:flex;gap:11px;background:rgba(11,14,17,.6);border:1px solid var(--line);border-radius:13px;padding:12px}
  .alm .alm-step .n{flex:0 0 auto;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-weight:800;font-size:13px;color:#241900;
    background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426)}
  .alm .alm-step b{display:block;font-weight:700;font-size:13.5px;margin-bottom:2px}
  .alm .alm-step span{display:block;font-size:12px;line-height:1.5;color:#a9b2bd}

  .alm .alm-disc{font-family:'IBM Plex Mono';font-size:10px;line-height:1.6;color:var(--ink3);
    padding:12px;background:rgba(10,14,19,.4);border:1px solid var(--line);border-radius:11px}
  .alm .alm-disc b{color:#C9A84B}
  `;
  const st = document.createElement('style'); st.id = 'alm-css'; st.textContent = css;
  document.head.appendChild(st);
}

export function abrirAportarMovil() {
  estilos();
  const prev = document.getElementById('alm'); if (prev) prev.remove();

  let modo = 'aportar';
  const d = document.createElement('div');
  d.className = 'alm'; d.id = 'alm';
  d.innerHTML = `
    <div class="alm-head">
      <button class="alm-x" id="alm-x">✕</button>
      <div class="alm-h">Aportar liquidez</div>
    </div>
    <div class="alm-body">
      <div class="alm-sub">Gana una parte de las comisiones cuando otros operan</div>

      <div class="alm-mine">
        <div class="m"><b>0.00</b><span>Tu aporte</span></div>
        <div class="m"><b class="gold">0.00</b><span>Comisiones</span></div>
      </div>

      <div class="alm-tabs">
        <button class="on" data-modo="aportar">Aportar</button>
        <button data-modo="retirar">Retirar</button>
      </div>

      <div id="alm-panel"></div>

      <div class="alm-how">
        <div class="alm-step"><span class="n">1</span><div><b>Aportas USDT</b><span>Tu aporte queda registrado a tu nombre.</span></div></div>
        <div class="alm-step"><span class="n">2</span><div><b>Otros operan</b><span>Cada operación paga una comisión; una parte es para ti.</span></div></div>
        <div class="alm-step"><span class="n">3</span><div><b>Retiras al vencer</b><span>Al terminar el plazo, retiras tu capital más las comisiones.</span></div></div>
      </div>

      <div class="alm-disc">
        <b>Aviso:</b> aportar liquidez no garantiza rendimiento fijo. Lo que ganas depende de cuánta gente opere. Tu aporte se bloquea durante el plazo elegido. Conlleva riesgo de mercado: la reserva puede disminuir. Aporta solo lo que puedas inmovilizar.
      </div>
    </div>`;
  document.body.appendChild(d);
  d.querySelector('#alm-x').onclick = () => d.remove();

  const panel = d.querySelector('#alm-panel');
  function pintar() {
    if (modo === 'aportar') {
      panel.innerHTML = `
        <div class="alm-card">
          <div class="alm-lbl">Cantidad a aportar</div>
          <div class="alm-amt-row">
            <input class="alm-amt" type="text" inputmode="decimal" placeholder="0.00">
            <span class="alm-usdt">USDT <button class="alm-max" type="button">MÁX</button></span>
          </div>
        </div>
        <div class="alm-lbl" style="margin:12px 2px 8px">Plazo de bloqueo</div>
        <div class="alm-plazos">${PLAZOS.map((p, i) => `<div class="alm-plazo${i === 1 ? ' on' : ''}" data-plazo="${p.id}"><b>${p.etiqueta}</b><em>bloqueado</em></div>`).join('')}</div>
        <button class="alm-go" style="margin-top:14px;width:100%">Aportar liquidez</button>`;
      panel.querySelectorAll('.alm-plazo').forEach((el) => el.onclick = () => {
        panel.querySelectorAll('.alm-plazo').forEach((x) => x.classList.remove('on')); el.classList.add('on');
      });
    } else {
      panel.innerHTML = `
        <div class="alm-card">
          <div class="alm-lbl">Cantidad a retirar</div>
          <div class="alm-amt-row">
            <input class="alm-amt" type="text" inputmode="decimal" placeholder="0.00">
            <span class="alm-usdt">USDT <button class="alm-max" type="button">MÁX</button></span>
          </div>
        </div>
        <div class="alm-disc" style="margin-top:12px">Solo puedes retirar el aporte cuyo plazo ya haya vencido.</div>
        <button class="alm-go" style="margin-top:14px;width:100%">Retirar</button>`;
    }
    const go = panel.querySelector('.alm-go');
    if (go) go.onclick = () => { const t = go.textContent; go.textContent = 'Muy pronto — en desarrollo'; setTimeout(() => { go.textContent = t; }, 1800); };
  }
  d.querySelectorAll('.alm-tabs button').forEach((b) => b.onclick = () => {
    modo = b.dataset.modo;
    d.querySelectorAll('.alm-tabs button').forEach((x) => x.classList.remove('on')); b.classList.add('on');
    pintar();
  });
  pintar();

  // Traducir a inglés si corresponde.
  try { import('../idioma.js?v=152').then((idi) => idi.traducirTodo && idi.traducirTodo()); } catch (_) {}
}
