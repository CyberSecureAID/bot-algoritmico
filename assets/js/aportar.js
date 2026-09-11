/* ══════════════════════════════════════════════════════════════════════
   aportar.js — Sección "Add liquidity" (aportar liquidez)
   ══════════════════════════════════════════════════════════════════════
   SOLO INTERFAZ (Fase 2). No hay contrato aún: los botones de acción
   muestran un aviso "coming soon". Cuando exista el contrato AurexFutures,
   se cablea aquí sin tocar el diseño.

   Todo el texto va en español (idioma base del sitio) y se traduce al
   inglés por el diccionario de idioma.js — igual que el resto de la web.
   El idioma por defecto es inglés; pasa a español solo si el usuario lo
   elige en su perfil.

   Módulo aislado: overlay propio (#lq-overlay), estilos propios inyectados
   una vez. No comparte nada con los demás módulos ni con los contratos.
*/

const $ = (id) => document.getElementById(id);

/* Plazos de bloqueo ofrecidos. El APR es ESTIMADO (no fijo): depende de la
   actividad real de trading. Se muestra con descargo. */
const PLAZOS = [
  { id: '7d',  etiqueta: '7 días',   apr: '~4%'  },
  { id: '1m',  etiqueta: '1 mes',    apr: '~9%'  },
  { id: '3m',  etiqueta: '3 meses',  apr: '~14%' },
  { id: '6m',  etiqueta: '6 meses',  apr: '~20%' },
  { id: '1a',  etiqueta: '1 año',    apr: '~28%' }
];

let _estiloPuesto = false;

function estilos() {
  if (_estiloPuesto) return;
  _estiloPuesto = true;
  const css = `
  #lq-overlay{position:fixed;inset:0;z-index:240;display:flex;align-items:center;justify-content:center;padding:16px}
  #lq-overlay .lq-bg{position:absolute;inset:0;background:rgba(3,5,7,.72);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
  #lq-overlay .lq-box{
    position:relative;width:100%;max-width:760px;max-height:92vh;overflow:auto;
    background:linear-gradient(180deg,#12161c,#0b0e12);
    border:1px solid #2b3139;border-radius:22px;padding:26px 24px;
    box-shadow:0 40px 120px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.05);
    animation:lqIn .2s ease both;
  }
  /* Fondo cósmico de la ventana (imagen en segundo plano). En ::after para
     no chocar con nada. Sube liquidez-bg.webp a assets/portada/img/. */
  #lq-overlay .lq-box::after{
    content:"";position:absolute;inset:0;z-index:0;border-radius:22px;pointer-events:none;
    background-image:url('assets/portada/img/liquidez-bg.webp');
    background-size:cover;background-position:center;opacity:.12;filter:saturate(1.05);
  }
  #lq-overlay .lq-box > *{position:relative;z-index:1}
  @keyframes lqIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

  #lq-overlay .lq-x{position:absolute;top:16px;right:16px;width:34px;height:34px;border-radius:10px;
    background:rgba(255,255,255,.05);border:1px solid #2b3139;color:#7d8794;display:grid;place-items:center;
    cursor:pointer;font-size:15px;z-index:3}
  #lq-overlay .lq-x:hover{color:#e9edf5;border-color:#3a424e}

  #lq-overlay .lq-head{text-align:center;margin-bottom:20px}
  #lq-overlay .lq-title{font-family:var(--display,sans-serif);font-weight:800;font-size:22px;color:#e9edf5;
    display:flex;align-items:center;justify-content:center;gap:12px}
  #lq-overlay .lq-title .ln{flex:1;max-width:60px;height:1px;background:linear-gradient(90deg,transparent,var(--gold,#E8B84B),transparent)}
  #lq-overlay .lq-sub{font-family:var(--mono,monospace);font-size:12.5px;color:var(--gold-soft,#C9A84B);margin-top:6px}

  /* Métricas de la pool. */
  #lq-overlay .lq-stats{display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap}
  #lq-overlay .lq-stat{flex:1;min-width:120px;background:rgba(10,14,19,.5);border:1px solid #232b36;
    border-radius:14px;padding:12px 14px;backdrop-filter:blur(8px)}
  #lq-overlay .lq-stat b{display:block;font-family:var(--display);font-weight:700;font-size:17px;color:#e9edf5}
  #lq-overlay .lq-stat span{display:block;font-family:var(--mono);font-size:10.5px;color:var(--ink3,#7d8794);
    text-transform:uppercase;letter-spacing:.06em;margin-top:3px}

  /* Tarjeta de depósito. */
  #lq-overlay .lq-card{background:rgba(11,14,17,.66);border:1px solid #2b3139;border-radius:16px;
    padding:16px;margin-bottom:14px;backdrop-filter:blur(12px)}
  #lq-overlay .lq-lbl{font-family:var(--mono);font-size:11px;color:var(--ink3,#7d8794);
    text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
  #lq-overlay .lq-amt-row{display:flex;align-items:center;gap:10px}
  #lq-overlay .lq-amt{flex:1;min-width:0;background:transparent;border:none;outline:none;
    font-family:var(--display);font-weight:700;font-size:26px;color:#e9edf5;width:100%}
  #lq-overlay .lq-amt::placeholder{color:var(--ink4,#4a5561)}
  #lq-overlay .lq-usdt{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;
    background:linear-gradient(180deg,#1b2027,#12161c);border:1px solid var(--gold-soft,#C9A84B);
    border-radius:100px;padding:7px 14px;font-family:var(--display);font-weight:700;font-size:14px;color:#e9edf5}
  #lq-overlay .lq-max{margin-left:2px;font-family:var(--mono);font-size:11px;font-weight:700;color:#3a2800;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);border:1px solid #c79426;
    border-radius:8px;padding:4px 10px;cursor:pointer;box-shadow:0 2px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.4)}

  /* Selector de plazo. */
  #lq-overlay .lq-plazos{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
  #lq-overlay .lq-plazo{flex:1;min-width:88px;background:rgba(10,14,19,.5);border:1px solid #232b36;
    border-radius:13px;padding:11px 8px;cursor:pointer;text-align:center;transition:border-color .14s,background .14s}
  #lq-overlay .lq-plazo:hover{border-color:var(--gold-soft,#C9A84B)}
  #lq-overlay .lq-plazo.on{border-color:var(--gold,#E8B84B);background:rgba(232,184,75,.1)}
  #lq-overlay .lq-plazo b{display:block;font-family:var(--display);font-weight:700;font-size:13px;color:#e9edf5}
  #lq-overlay .lq-plazo s{display:block;text-decoration:none;font-family:var(--mono);font-size:13px;
    font-weight:700;color:var(--gold,#E8B84B);margin-top:4px}
  #lq-overlay .lq-plazo em{display:block;font-style:normal;font-family:var(--mono);font-size:9px;
    color:var(--ink3,#7d8794);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}

  /* Botón principal (bisel dorado 3D). */
  #lq-overlay .lq-go{width:100%;height:52px;border:1px solid #c79426;border-radius:13px;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 46%,#c79426);color:#241900;
    font-family:var(--display);font-weight:800;font-size:16px;cursor:pointer;
    box-shadow:0 5px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5);text-shadow:0 1px 0 rgba(255,255,255,.28);
    transition:filter .16s,transform .09s,box-shadow .09s;margin-top:4px}
  #lq-overlay .lq-go:hover{filter:brightness(1.05)}
  #lq-overlay .lq-go:active{transform:translateY(4px);box-shadow:0 1px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}

  /* Descargo. */
  #lq-overlay .lq-disc{font-family:var(--mono);font-size:10.5px;line-height:1.6;color:var(--ink3,#7d8794);
    margin-top:14px;padding:12px 14px;background:rgba(10,14,19,.4);border:1px solid #232b36;border-radius:12px}
  #lq-overlay .lq-disc b{color:var(--gold-soft,#C9A84B)}

  /* Tu posición (vacía por ahora). */
  #lq-overlay .lq-pos{margin-top:16px;padding-top:16px;border-top:1px solid #232b36}
  #lq-overlay .lq-pos-empty{font-family:var(--mono);font-size:12px;color:var(--ink4,#4a5561);text-align:center;padding:10px}

  @media(max-width:560px){
    #lq-overlay .lq-box{max-width:100%;max-height:100vh;height:100vh;border-radius:0;border:none}
    #lq-overlay .lq-box::after{border-radius:0}
  }
  `;
  const st = document.createElement('style');
  st.id = 'lq-css';
  st.textContent = css;
  document.head.appendChild(st);
}

export function abrirAportar() {
  estilos();
  const prev = $('lq-overlay');
  if (prev) prev.remove();

  const d = document.createElement('div');
  d.id = 'lq-overlay';
  d.innerHTML = `
    <div class="lq-bg"></div>
    <div class="lq-box">
      <button class="lq-x" id="lq-x" aria-label="Cerrar">✕</button>

      <div class="lq-head">
        <div class="lq-title"><span class="ln"></span>Aportar liquidez<span class="ln"></span></div>
        <div class="lq-sub">Gana comisiones cuando otros operan con futuros</div>
      </div>

      <div class="lq-stats">
        <div class="lq-stat"><b>—</b><span>Liquidez total</span></div>
        <div class="lq-stat"><b>—</b><span>Aportantes</span></div>
        <div class="lq-stat"><b>—</b><span>Comisiones 24h</span></div>
      </div>

      <div class="lq-card">
        <div class="lq-lbl">Cantidad a aportar</div>
        <div class="lq-amt-row">
          <input class="lq-amt" id="lq-amt" type="text" inputmode="decimal" placeholder="0.00">
          <span class="lq-usdt">USDT <button class="lq-max" id="lq-max" type="button">MÁX</button></span>
        </div>
      </div>

      <div class="lq-lbl" style="margin:0 2px 8px">Plazo de bloqueo</div>
      <div class="lq-plazos" id="lq-plazos">
        ${PLAZOS.map((p, i) => `
          <div class="lq-plazo${i === 1 ? ' on' : ''}" data-plazo="${p.id}">
            <b>${p.etiqueta}</b>
            <s>${p.apr}</s>
            <em>APR est.</em>
          </div>`).join('')}
      </div>

      <button class="lq-go" id="lq-go" type="button">Aportar liquidez</button>

      <div class="lq-disc">
        <b>Aviso:</b> el APR mostrado es una estimación, no un rendimiento fijo. Tus ganancias dependen de cuánto operen otros usuarios: si hay mucha actividad, ganas más; si hay poca, ganas menos. Tu aporte queda bloqueado durante el plazo que elijas y no puede retirarse antes. Aportar liquidez conlleva riesgo: en periodos de fuerte movimiento del mercado, el capital de la pool puede reducirse. Aporta solo lo que puedas permitirte inmovilizar.
      </div>

      <div class="lq-pos">
        <div class="lq-lbl">Tu posición</div>
        <div class="lq-pos-empty">Aún no has aportado liquidez.</div>
      </div>
    </div>`;
  document.body.appendChild(d);

  const cerrar = () => { const e = $('lq-overlay'); if (e) e.remove(); };
  d.querySelector('.lq-bg').onclick = cerrar;
  $('lq-x').onclick = cerrar;

  // Selector de plazo.
  d.querySelectorAll('.lq-plazo').forEach((el) => {
    el.onclick = () => {
      d.querySelectorAll('.lq-plazo').forEach((x) => x.classList.remove('on'));
      el.classList.add('on');
    };
  });

  // MÁX y botón principal: sin acción real todavía (no hay contrato).
  const avisoSoon = () => {
    const g = $('lq-go');
    if (g) { g.textContent = 'Muy pronto — en desarrollo'; setTimeout(() => { g.textContent = 'Aportar liquidez'; }, 2200); }
  };
  const max = $('lq-max'); if (max) max.onclick = (e) => { e.preventDefault(); };
  const go = $('lq-go'); if (go) go.onclick = avisoSoon;
}
