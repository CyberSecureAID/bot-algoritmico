/* ══════════════════════════════════════════════════════════════════════
   fx-saldo.js — Saldo de stablecoins para la sección de Futuros (web)
   ══════════════════════════════════════════════════════════════════════
   PIEZA NUEVA Y AISLADA. No modifica ningún archivo existente.

   Muestra el saldo TOTAL de stablecoins (USDT + USDC + DAI) en BNB Chain de la
   wallet conectada, grande, con el símbolo "USDT" (la unidad de cuenta), arriba
   a la derecha de la gráfica de Futuros. Ejemplo: 13.000 USDT + 10.000 USDC
   → muestra 23.000 USDT.

   · Deja previsto el botón "PNL" al lado (sin función todavía; se conectará
     cuando exista el contrato de futuros que lo alimente).
   · Se muestra SOLO en Futuros (body.fut). Sin wallet conectada, se esconde.

   AISLAMIENTO (verificado):
   · NO usa ninguna variable global → no puede pisar el saldo del móvil ni nada.
   · Reutiliza funciones YA probadas, sin reescribirlas:
       gridbot.balanceToken(token, duenio)  → saldo crudo
       gridbot.infoToken(token)             → decimales reales del token
       wallet.cuentaActual()                → cuenta conectada
   · Lee los decimales REALES de cada token (no asume 18), por si una stable
     futura tuviera otros. Así el total nunca se calcula mal.
   · Si algo falla aquí, no afecta a nada más. Se desactiva quitando la línea
     que lo carga.

   NOTA: cuando exista el contrato de futuros, la lista de stablecoins debería
   leerse del contrato (es administrable). De momento, las tres por defecto.
   ══════════════════════════════════════════════════════════════════════ */

// Stablecoins aceptadas en BNB Chain (por defecto). En el futuro: leer del contrato.
const STABLES = [
  '0x55d398326f99059fF775485246999027B3197955', // USDT (BSC)
  '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC (BSC)
];

let _iniciado = false;
let _timer = null;
const _dec = {};   // caché de decimales por token

async function decimalesDe(gb, token) {
  if (_dec[token] != null) return _dec[token];
  try { const info = await gb.infoToken(token); _dec[token] = Number(info.decimals) || 18; }
  catch (_) { _dec[token] = 18; }
  return _dec[token];
}

/* Suma el saldo de las tres stablecoins, cada una con SUS decimales reales. */
async function leerSaldoTotal() {
  try {
    const wallet = await import('./wallet.js?v=128');
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    if (!cuenta) return null;                        // sin wallet → se esconde
    const gb = await import('./gridbot.js?v=129');
    if (!gb.balanceToken || !gb.fmt) return null;

    let total = 0;
    await Promise.all(STABLES.map(async (tok) => {
      try {
        const [crudo, dec] = await Promise.all([gb.balanceToken(tok, cuenta), decimalesDe(gb, tok)]);
        const n = Number(gb.fmt(crudo, dec));   // gb.fmt es ethers.formatUnits
        if (isFinite(n)) total += n;
      } catch (_) { /* un token puede fallar; los demás siguen */ }
    }));
    return total;
  } catch (_) { return null; }
}

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function estilos() {
  if (document.getElementById('fx-saldo-css')) return;
  const st = document.createElement('style');
  st.id = 'fx-saldo-css';
  st.textContent = `
    #fx-saldo{display:none;align-items:center;gap:14px}
    #fx-saldo.visible{display:flex}
    #fx-saldo .fxs-bloque{display:flex;flex-direction:column;line-height:1.1}
    #fx-saldo .fxs-lbl{font-size:11px;color:#8b96a3;font-weight:600;letter-spacing:.3px}
    #fx-saldo .fxs-val{font-size:22px;font-weight:800;color:#eaecef;white-space:nowrap}
    #fx-saldo .fxs-val .fxs-u{font-size:13px;font-weight:700;color:#8b96a3;margin-left:6px}
    #fx-saldo .fxs-pnl{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);
      border:1px solid rgba(255,255,255,.1);color:#E8B84B;font-weight:800;font-size:13px;
      padding:9px 16px;border-radius:12px;cursor:pointer;transition:background .15s,border-color .15s;white-space:nowrap}
    #fx-saldo .fxs-pnl:hover{background:rgba(232,184,75,.1);border-color:rgba(232,184,75,.4)}
    #fx-saldo .fxs-pnl:active{transform:translateY(1px)}
    @media(max-width:760px){
      #fx-saldo{gap:9px}
      #fx-saldo .fxs-val{font-size:18px}
      #fx-saldo .fxs-pnl{padding:7px 12px;font-size:12px}
    }
  `;
  document.head.appendChild(st);
}

function crearElemento() {
  let el = document.getElementById('fx-saldo');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'fx-saldo';
  el.innerHTML = `
    <div class="fxs-bloque">
      <span class="fxs-lbl">Saldo disponible</span>
      <span class="fxs-val" id="fxs-val">—<span class="fxs-u">USDT</span></span>
    </div>
    <button class="fxs-pnl" id="fxs-pnl" title="Tu PNL (próximamente)">PNL</button>`;
  el.querySelector('#fxs-pnl').onclick = () => { /* PNL: pendiente del contrato de futuros */ };
  return el;
}

function colocar(el) {
  const cont = document.querySelector('#nv-overlay .nv-c') || document.querySelector('#nv-overlay') || document.body;
  if (!cont) return false;
  if (el.parentElement === cont) return true;
  el.style.position = 'absolute';
  el.style.top = '12px';
  el.style.right = '16px';
  el.style.zIndex = '20';
  cont.appendChild(el);
  return true;
}

async function refrescar() {
  const enFuturos = document.body.classList.contains('fut');
  const el = document.getElementById('fx-saldo');
  if (!enFuturos) { if (el) el.classList.remove('visible'); return; }
  estilos();
  const elem = crearElemento();
  colocar(elem);
  const total = await leerSaldoTotal();
  if (total == null) { elem.classList.remove('visible'); return; }   // sin wallet → escondido
  const val = document.getElementById('fxs-val');
  if (val) val.innerHTML = fmt(total) + '<span class="fxs-u">USDT</span>';
  elem.classList.add('visible');
}

export function iniciarSaldoFuturos() {
  if (_iniciado) return;
  _iniciado = true;
  try {
    const mo = new MutationObserver(() => refrescar());
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } catch (_) {}
  import('./wallet.js?v=128').then((w) => {
    try { if (w.alCambiar) w.alCambiar(() => refrescar()); } catch (_) {}
  }).catch(() => {});
  if (_timer) clearInterval(_timer);
  _timer = setInterval(() => { if (document.body.classList.contains('fut')) refrescar(); }, 20000);
  refrescar();
}

iniciarSaldoFuturos();
