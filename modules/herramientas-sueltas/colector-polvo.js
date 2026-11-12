/* ══════════════════════════════════════════════════════════════
   colector-polvo.js — COLECTOR DE POLVO (archivo suelto, NO cableado)

   Extraído de assets/js/tools.js para tenerlo modularizado aparte.
   NO se carga en ninguna página todavía: queda aquí por si se necesita
   (la versión móvil lo llamará). La lógica es idéntica a la de tools.js.

   Operando con bots siempre quedan restos: 0,40 de una moneda, 1,20 de
   otra. Por separado no valen la pena (el gas se come el cambio), pero
   juntos sí. Esta herramienta los reúne y los pasa a una sola moneda.

   USO:  import { abrir } from './colector-polvo.js';  abrir();
   ══════════════════════════════════════════════════════════════ */

import * as ethers from '../../assets/js/vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../../assets/js/wallet.js?v=129';
import * as gb from '../../assets/js/gridbot.js?v=125';
import { MONEDAS } from '../../assets/js/tokens.js?v=125';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d = 2) => Number(v).toLocaleString('es', { maximumFractionDigits: d });

/* Mensaje en la línea del menú de herramientas (#tl-msg). Si esta tool se
   abre suelta, sin ese menú, simplemente no pinta nada (guard). */
function decir(txt, clase = '') {
  const e = $('tl-msg'); if (!e) return;
  e.className = 'tl-msg ' + clase;
  e.innerHTML = txt;
  if (txt) setTimeout(() => { if (e.innerHTML === txt) { e.innerHTML = ''; e.className = 'tl-msg'; } }, 11000);
}

const ABI20 = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

/* Por debajo de esto no compensa: el gas costaría más que la moneda. */
const MINIMO_USD = 0.30;

let _saldos = [];
let _destino = 'USDT';

async function abrirPolvo() {
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  if (!cuenta) { decir('Connect your wallet first, top right.', 'mal'); return; }

  const prev = $('pv-overlay'); if (prev) prev.remove();
  const d = document.createElement('div');
  d.id = 'pv-overlay';
  d.innerHTML = `<div class="pv-bg"></div>
    <div class="pv-c">
      <div class="tl-top">
        <div class="tl-eyebrow">Dust collector</div>
        <button class="pv-x" aria-label="Close">✕</button>
      </div>
      <p class="tl-s">These are the leftovers scattered across your wallet. Pick one coin to move them all into.</p>
      <div id="pv-cuerpo">
        <div class="pv-cargando">
          <div class="pv-spin"></div>
          <div class="pv-carga-t">Checking your wallet</div>
          <div class="pv-carga-s" id="pv-avance">Looking for coins with a balance…</div>
        </div>
      </div>
      <div class="tl-msg" id="pv-msg"></div>
    </div>`;
  document.body.appendChild(d);

  const cerrar = () => { const e = $('pv-overlay'); if (e) e.remove(); };
  d.querySelector('.pv-bg').onclick = cerrar;
  d.querySelector('.pv-x').onclick = cerrar;

  cargarSaldos(cuenta);
}

function decirP(txt, clase = '') {
  const e = $('pv-msg'); if (!e) return;
  e.className = 'tl-msg ' + clase; e.innerHTML = txt;
  if (txt) setTimeout(() => { if (e.innerHTML === txt) { e.innerHTML = ''; e.className = 'tl-msg'; } }, 12000);
}

async function cargarSaldos(cuenta) {
  const box = $('pv-cuerpo'); if (!box) return;
  const prov = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org', 56, { staticNetwork: true });

  // Precios en dólares, para saber qué es polvo y qué no
  let precios = {};
  try {
    const ids = Object.values(MONEDAS).map((m) => m.cg).filter(Boolean);
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${[...new Set(ids)].join(',')}&vs_currencies=usd`);
    precios = await r.json();
  } catch (_) {}

  /* Los saldos, en lotes de 5. De una en una tardaba una eternidad (28
     viajes encadenados); todas a la vez, el servidor rechaza la mitad. */
  const lista = Object.entries(MONEDAS);
  const encontrados = [];

  for (let i = 0; i < lista.length; i += 5) {
    const res = await Promise.all(lista.slice(i, i + 5).map(async ([id, m]) => {
      try {
        let saldo = 0n;
        if (!m.address || m.address === '0x0000000000000000000000000000000000000000') {
          saldo = await prov.getBalance(cuenta);
        } else {
          saldo = await new ethers.Contract(m.address, ABI20, prov).balanceOf(cuenta);
        }
        if (saldo === 0n) return null;
        const cant = Number(ethers.formatUnits(saldo, m.decimals ?? 18));
        const precio = (precios[m.cg] && precios[m.cg].usd) || 0;
        return { id, m, saldo, cant, usd: cant * precio, precio };
      } catch (_) { return null; }
    }));
    res.forEach((x) => { if (x) encontrados.push(x); });
    // Se va pintando lo que ya hay: el usuario ve avance, no una pantalla muerta.
    const av = $('pv-avance');
    if (av) av.textContent = `Checking… ${Math.min(i + 5, lista.length)} of ${lista.length} coins`;
  }

  encontrados.sort((a, b) => b.usd - a.usd);
  _saldos = encontrados;

  const polvo = encontrados.filter((x) => x.usd >= MINIMO_USD);
  const migajas = encontrados.filter((x) => x.usd > 0 && x.usd < MINIMO_USD);

  if (encontrados.length === 0) {
    box.innerHTML = `<div class="tl-vacio">No coins found in your wallet on this network.</div>`;
    return;
  }

  box.innerHTML = `
    <div class="pv-destino">
      <span>Move everything to</span>
      <div class="pv-opts">
        <button class="pv-opt on" data-dest="USDT">USDT</button>
        <button class="pv-opt" data-dest="BNB">BNB</button>
      </div>
    </div>

    <div class="pv-lista">
      ${polvo.map((x, i) => `
        <label class="pv-fila">
          <input type="checkbox" class="pv-chk" data-i="${i}" ${x.id === _destino ? 'disabled' : 'checked'}>
          <span class="pv-mon">
            <b>${esc(x.m.simbolo)}</b>
            <em>${num(x.cant, 6)}</em>
          </span>
          <span class="pv-usd">${x.usd > 0 ? '$' + num(x.usd, 2) : '—'}</span>
        </label>`).join('')}
    </div>

    ${migajas.length ? `<div class="pv-migajas">
      <b>${migajas.length} coin${migajas.length > 1 ? 's' : ''} below $${MINIMO_USD}</b>
      We leave them out: gas would cost more than they are worth. Here they are just in case:
      <span>${migajas.map((x) => esc(x.m.simbolo) + ' ' + num(x.cant, 4)).join(' · ')}</span>
    </div>` : ''}

    <div class="pv-total" id="pv-total"></div>

    <button class="pv-b" id="pv-juntar">Gather selected</button>

    <div class="pv-nota">
      It makes <b>one swap per coin</b>, so you will sign several times. Each one costs its gas: that is why it only pays off with leftovers worth something.
    </div>`;

  const recalcular = () => {
    let n = 0, usd = 0;
    box.querySelectorAll('.pv-chk:checked').forEach((c) => {
      const x = polvo[Number(c.dataset.i)];
      if (x) { n++; usd += x.usd; }
    });
    const t = $('pv-total');
    if (t) t.innerHTML = n === 0
      ? `<span class="vacio">Nothing selected</span>`
      : `You will gather <b>${n} coin${n > 1 ? 's' : ''}</b> worth <b>$${num(usd, 2)}</b>`;
    const b = $('pv-juntar');
    if (b) b.disabled = n === 0;
  };
  box.querySelectorAll('.pv-chk').forEach((c) => c.onchange = recalcular);
  recalcular();

  /* Cambiar de destino NO recarga los saldos (eso tardaba y parecía que
     se rompía). Solo se marca la moneda destino como no seleccionable. */
  box.querySelectorAll('[data-dest]').forEach((b) => b.onclick = () => {
    _destino = b.dataset.dest;
    box.querySelectorAll('.pv-opt').forEach((x) => x.classList.toggle('on', x.dataset.dest === _destino));
    box.querySelectorAll('.pv-chk').forEach((c) => {
      const x = polvo[Number(c.dataset.i)];
      const esDestino = x && x.id === _destino;
      c.disabled = esDestino;
      if (esDestino) c.checked = false;
      c.closest('.pv-fila').classList.toggle('destino', !!esDestino);
    });
    recalcular();
  });

  $('pv-juntar').onclick = () => {
    const elegidos = [];
    box.querySelectorAll('.pv-chk:checked').forEach((c) => {
      const x = polvo[Number(c.dataset.i)];
      if (x) elegidos.push(x);
    });
    confirmarJuntar(elegidos, cuenta);
  };
}

function confirmarJuntar(elegidos, cuenta) {
  const total = elegidos.reduce((s, x) => s + x.usd, 0);
  const d = document.createElement('div');
  d.id = 'pv-conf';
  d.innerHTML = `<div class="pv-bg"></div>
    <div class="pvc-c">
      <div class="pvc-t">Gather ${elegidos.length} coin${elegidos.length > 1 ? 's' : ''}</div>
      <div class="pvc-s">They will all be swapped to <b>${_destino}</b>, worth about <b>$${num(total, 2)}</b>.</div>
      <div class="pvc-lista">${elegidos.map((x) => `<span>${esc(x.m.simbolo)} <i>${num(x.cant, 6)}</i></span>`).join('')}</div>
      <div class="pvc-aviso">
        You will sign <b>${elegidos.length} swap${elegidos.length > 1 ? 's' : ''}</b>, one per coin. If one fails, the rest go on: nothing is lost.
        <i>The final price may move a little while it runs. That is normal in any swap.</i>
      </div>
      <div class="pvc-acts">
        <button class="pv-b gris" data-no>Cancel</button>
        <button class="pv-b" data-si>Start</button>
      </div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  d.querySelector('.pv-bg').onclick = q;
  d.querySelector('[data-no]').onclick = q;
  d.querySelector('[data-si]').onclick = () => { q(); juntar(elegidos, cuenta); };
}

async function juntar(elegidos, cuenta) {
  const b = $('pv-juntar');
  if (b) b.disabled = true;
  let hechos = 0;
  const fallos = [];

  for (let i = 0; i < elegidos.length; i++) {
    const x = elegidos[i];
    decirP(`Swapping <b>${esc(x.m.simbolo)}</b> (${i + 1} of ${elegidos.length})… sign in your wallet`, 'info');
    try {
      const destino = MONEDAS[_destino];
      // Primero se pide precio, luego se ejecuta. Igual que el swap normal.
      const cot = await gb.cotizarSwap({
        inAddr: x.m.address, outAddr: destino.address,
        amountInBI: x.saldo, slippageBps: 150      // margen amplio: son cantidades pequeñas
      });
      if (!cot || !cot.minOut) throw new Error('sin mercado');

      // Si no es la moneda nativa, hay que dar permiso primero.
      if (!gb.esNativoSwap(x.m.address)) {
        const permiso = await gb.allowanceSwap(x.m.address, cuenta);
        if (permiso < x.saldo) await gb.aprobarSwap(x.m.address, x.saldo);
      }
      await gb.ejecutarSwap({
        inAddr: x.m.address, outAddr: destino.address,
        amountInBI: x.saldo, minOut: cot.minOut, fee: cot.fee
      });
      hechos++;
    } catch (e) {
      const m = String(e?.shortMessage || e?.reason || e?.message || e);
      if (/reject|denied|cancel/i.test(m)) { decirP('You cancelled. What is done so far stays.', ''); break; }
      fallos.push(esc(x.m.simbolo));
    }
  }

  decirP(
    fallos.length === 0
      ? `Done: <b>${hechos}</b> coin${hechos !== 1 ? 's' : ''} converted to ${_destino}.`
      : `Converted ${hechos}. Could not with: ${fallos.join(', ')}.<br>They may not have enough market.`,
    fallos.length ? 'mal' : 'ok'
  );
  if (b) b.disabled = false;
  setTimeout(() => cargarSaldos(cuenta), 2500);
}

/* ══════════════════ ESTILOS (solo los del colector) ══════════════════ */
function estilos() {
  if ($('cc-polvo-css')) return;
  const s = document.createElement('style'); s.id = 'cc-polvo-css';
  s.textContent = `
  #pv-overlay,#pv-conf{position:fixed;inset:0;z-index:9700;display:flex;align-items:center;justify-content:center;padding:16px}
  #pv-overlay{z-index:9710}
  #pv-conf{z-index:9720}
  #pv-overlay .pv-bg,#pv-conf .pv-bg{position:absolute;inset:0;background:rgba(3,5,8,.9);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}
  #pv-overlay .pv-c{position:relative;width:100%;max-width:520px;max-height:calc(100vh - 32px);overflow-y:auto;
    background:linear-gradient(180deg,#141922,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:20px;padding:22px 20px}
  #pv-overlay .tl-top{position:relative;display:flex;align-items:center;justify-content:center;min-height:36px;margin-bottom:10px}
  #pv-overlay .tl-eyebrow{font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);text-transform:uppercase;letter-spacing:2px}
  #pv-overlay .pv-x{position:absolute;top:0;right:0;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;padding:0;
    background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;cursor:pointer;font-size:15px}
  #pv-overlay .tl-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;text-align:center;line-height:1.6;margin:0 0 20px}
  .tl-cargando,.tl-vacio{font-family:var(--mono,monospace);font-size:12px;color:#7d8794;text-align:center;padding:30px 10px;line-height:1.7}
  .tl-msg{font-family:var(--mono,monospace);font-size:12px;text-align:center;margin-top:14px;min-height:17px;line-height:1.6}
  .tl-msg.ok{color:var(--neon-lit,#2ee86a)} .tl-msg.mal{color:var(--rojo,#f6465d)} .tl-msg.info{color:var(--gold,#E8B84B)}

  #pv-overlay .pv-cargando{text-align:center;padding:38px 16px}
  #pv-overlay .pv-spin{width:34px;height:34px;margin:0 auto 16px;border-radius:50%;
    border:2.5px solid rgba(232,184,75,.18);border-top-color:var(--gold,#E8B84B);animation:pvGira .8s linear infinite}
  @keyframes pvGira{to{transform:rotate(360deg)}}
  #pv-overlay .pv-carga-t{font-family:var(--display,sans-serif);font-weight:800;font-size:15px;color:#eaecef}
  #pv-overlay .pv-carga-s{font-family:var(--mono,monospace);font-size:11.5px;color:#7d8794;margin-top:6px}
  #pv-overlay .pv-fila.destino{opacity:.45}
  @media(prefers-reduced-motion:reduce){#pv-overlay .pv-spin{animation:none}}
  #pv-overlay .pv-destino{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
    padding:13px 15px;border-radius:13px;background:rgba(255,255,255,.03);border:1px solid #2b3139;margin-bottom:13px}
  #pv-overlay .pv-destino > span{font-family:var(--sans,sans-serif);font-size:13px;color:#b7bdc6}
  #pv-overlay .pv-opts{display:flex;gap:6px}
  #pv-overlay .pv-opt{padding:9px 18px;border-radius:10px;border:1px solid #3a424c;background:transparent;color:#8b96a3;
    font-family:var(--display,sans-serif);font-weight:700;font-size:12.5px;cursor:pointer;min-height:40px}
  #pv-overlay .pv-opt.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);border-color:#c79426;color:#3a2800}
  #pv-overlay .pv-lista{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
  #pv-overlay .pv-fila{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;
    background:rgba(255,255,255,.025);border:1px solid #2b3139;cursor:pointer}
  #pv-overlay .pv-chk{width:19px;height:19px;flex:0 0 auto;accent-color:var(--gold,#E8B84B);cursor:pointer}
  #pv-overlay .pv-chk:disabled{opacity:.3}
  #pv-overlay .pv-mon{flex:1;min-width:0}
  #pv-overlay .pv-mon b{display:block;font-family:var(--display,sans-serif);font-size:14px;color:#eaecef}
  #pv-overlay .pv-mon em{display:block;font-style:normal;font-family:var(--mono,monospace);font-size:11px;color:#7d8794;margin-top:2px}
  #pv-overlay .pv-usd{flex:0 0 auto;font-family:var(--mono,monospace);font-size:13px;color:var(--neon-lit,#2ee86a)}
  #pv-overlay .pv-migajas{padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.02);border:1px dashed #3a424c;
    font-family:var(--sans,sans-serif);font-size:12px;color:#7d8794;line-height:1.55;margin-bottom:12px}
  #pv-overlay .pv-migajas b{display:block;color:#b7bdc6;margin-bottom:3px}
  #pv-overlay .pv-migajas span{display:block;margin-top:7px;font-family:var(--mono,monospace);font-size:11px;color:#6b7681;word-break:break-word}
  #pv-overlay .pv-total{text-align:center;font-family:var(--sans,sans-serif);font-size:13px;color:#b7bdc6;margin-bottom:13px}
  #pv-overlay .pv-total b{color:var(--gold,#E8B84B)}
  #pv-overlay .pv-total .vacio{color:#6b7681}
  .pv-b{width:100%;min-height:48px;padding:13px;border-radius:12px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 0 #8f6a1a}
  .pv-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:#b7bdc6;box-shadow:0 3px 0 rgba(0,0,0,.4)}
  .pv-b:disabled{opacity:.4;cursor:default;box-shadow:none}
  .pv-b:active:not(:disabled){transform:translateY(2px)}
  .pv-nota{font-family:var(--sans,sans-serif);font-size:11.5px;color:#6b7681;line-height:1.55;margin-top:13px}
  .pv-nota b{color:#8b96a3}

  #pv-conf .pvc-c{position:relative;width:100%;max-width:400px;max-height:calc(100vh - 32px);overflow-y:auto;text-align:center;
    background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:20px;padding:26px 20px}
  #pv-conf .pvc-t{font-family:var(--display,sans-serif);font-weight:800;font-size:19px;color:var(--gold,#E8B84B)}
  #pv-conf .pvc-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;margin:8px 0 14px;line-height:1.6}
  #pv-conf .pvc-s b{color:#eaecef}
  #pv-conf .pvc-lista{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:14px}
  #pv-conf .pvc-lista span{padding:6px 11px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid #2b3139;
    font-family:var(--mono,monospace);font-size:11px;color:#b7bdc6}
  #pv-conf .pvc-lista i{font-style:normal;color:#6b7681}
  #pv-conf .pvc-aviso{text-align:left;padding:12px 14px;border-radius:11px;background:rgba(232,184,75,.07);
    border:1px solid rgba(232,184,75,.25);font-family:var(--sans,sans-serif);font-size:12px;color:#b7bdc6;line-height:1.55;margin-bottom:16px}
  #pv-conf .pvc-aviso b{color:var(--gold,#E8B84B)}
  #pv-conf .pvc-aviso i{display:block;font-style:normal;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.07);font-size:11.5px;color:#7d8794}
  #pv-conf .pvc-acts{display:flex;flex-direction:column;gap:8px}

  @media(max-width:560px){
    #pv-overlay,#pv-conf{padding:9px}
    #pv-overlay .pv-c{padding:18px 14px;border-radius:17px}
    #pv-overlay .pv-destino{flex-direction:column;align-items:stretch;gap:9px}
    #pv-overlay .pv-opts .pv-opt{flex:1}
  }`;
  document.head.appendChild(s);
}

/* Punto de entrada único. Inyecta sus estilos y abre la ventana. */
export function abrir() { estilos(); return abrirPolvo(); }
