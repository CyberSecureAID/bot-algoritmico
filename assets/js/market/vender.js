/* market/vender.js — El panel de vender: guía de 3 pasos (perfil, fianza,
   publicar), depósito de fianza y creación de la oferta en el contrato.
   Abre el asistente de venta. Extraído de market.js. */

import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';
import { f18, firmante, num, traducir } from './util.js?v=1';
import { msg } from './ui.js?v=1';
import { activarUbicacion, quitarUbicacion } from './ubicacion.js?v=1';
import { lee } from './contrato.js?v=1';
import { abrirAsistente } from './asistente-venta.js?v=1';
import { listarOfertas } from './ofertas.js?v=1';
import { MARKET, USDT, ABI, ERC20, MONEDAS } from './config.js?v=1';

const $ = (id) => document.getElementById(id);
const _tipoNumCC = () => (window.matchMedia('(max-width: 760px)').matches ? 'text' : 'number');

export async function panelVender() {
  const box = $('mk-p2'); if (!box) return;
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  if (!cuenta) { box.innerHTML = `<div class="mk-vacio">Conecta tu wallet para publicar una oferta.</div>`; return; }
  box.innerHTML = `<div class="mk-vacio">Cargando…</div>`;

  const [perf, fianza, fmin, ubic, dueno] = await Promise.all([
    lee('perfiles', [cuenta]).catch(() => null),
    lee('fianzaDe', [cuenta]).catch(() => 0n),
    lee('fianzaMinima').catch(() => 0n),
    lee('ubicacionDe', [cuenta]).catch(() => null),
    lee('owner').catch(() => null)
  ]);
  const tienePerfil = perf && perf.existe;
  const esOwner = dueno && String(dueno).toLowerCase() === String(cuenta).toLowerCase();
  const fOk = esOwner || fianza >= fmin;   // el owner está exento de fianza
  const listo = tienePerfil && fOk;

  const pasoActual = !tienePerfil ? 1 : (!fOk ? 2 : 3);
  const pasoHTML = (nro, txt, ok) =>
    `<div class="mk-wz-p ${ok ? 'ok' : (pasoActual === nro ? 'now' : '')}"><span class="n">${ok ? '✓' : nro}</span><span class="t">${txt}</span></div>`;

  box.innerHTML = `
  <div class="mk-wz">
    ${pasoHTML(1, 'Crea tu perfil', tienePerfil)}
    <div class="mk-wz-l"></div>
    ${pasoHTML(2, esOwner ? 'Fianza (no aplica)' : 'Deposita la fianza', fOk)}
    <div class="mk-wz-l"></div>
    ${pasoHTML(3, 'Publica tu oferta', false)}
  </div>
  ${listo ? '' : `<div class="mk-guia">${!tienePerfil ? 'Empieza creando tu perfil aquí abajo. Solo se hace una vez.' : 'Te falta la fianza. Deposítala aquí abajo y enseguida aparecerá el formulario para publicar tu oferta.'}</div>`}

  ${!tienePerfil ? `
  <div class="mk-box">
    <div class="bt">Paso 1 · Crea tu perfil</div>
    <div class="mk-2"><div><label>Tu nombre o alias</label><input id="mk-nom" maxlength="32" placeholder="Ej: Jesus"></div>
    <div><label>País</label><input id="mk-pais" maxlength="8" placeholder="CU"></div></div>
    <div class="mk-2"><div><label>Moneda habitual</label><select id="mk-mon">${MONEDAS.map(m => `<option>${m}</option>`).join('')}</select></div>
    <div><label>Contacto (Telegram)</label><input id="mk-cont" maxlength="64" placeholder="@usuario"></div></div>
    <button class="mk-b" id="mk-savep" style="margin-top:12px">Guardar perfil</button>
  </div>` : ''}

  ${tienePerfil && !fOk ? `
  <div class="mk-box">
    <div class="bt">Paso 2 · Deposita tu fianza</div>
    <div style="font-family:var(--mono,monospace);font-size:11.5px;color:#8b96a3;line-height:1.6;margin-bottom:10px">
      La fianza es <b style="color:#E8B84B">tuya</b> y la retiras cuando quieras. Solo respalda a tu comprador si un árbitro determina que hubo estafa.
    </div>
    <input id="mk-fianza" type="${_tipoNumCC()}" step="1" placeholder="${num(f18(fmin), 0)}">
    <button class="mk-b" id="mk-dep" style="margin-top:10px">Depositar fianza</button>
  </div>` : ''}

  ${listo ? `
  <div class="mk-box mk-lanza">
    <div class="lz-t">Todo listo para vender</div>
    <div class="lz-d">Unas preguntas cortas y tu oferta queda publicada.</div>
    <button class="mk-b" id="mk-abrir-wiz">Quiero vender</button>
  </div>` : ''}

`;

  if ($('mk-savep')) $('mk-savep').onclick = guardarPerfil;
  if ($('mk-dep')) $('mk-dep').onclick = depositarFianza;
  if ($('mk-abrir-wiz')) $('mk-abrir-wiz').onclick = () => abrirAsistente();
  if ($('mk-ubic-on')) $('mk-ubic-on').onclick = activarUbicacion;
  if ($('mk-ubic-off')) $('mk-ubic-off').onclick = quitarUbicacion;
}

async function guardarPerfil() {
  const n = ($('mk-nom').value || '').trim(), p = ($('mk-pais').value || '').trim().toUpperCase();
  const m = $('mk-mon').value, c = ($('mk-cont').value || '').trim();
  if (!n) { msg('Pon tu nombre.', 'err'); return; }
  try {
    msg('Confirma en tu wallet…', 'info');
    const ct = new ethers.Contract(MARKET, ABI, await firmante());
    const tx = await ct.guardarPerfil(n, p, m, c); await tx.wait();
    msg('Perfil guardado en la blockchain.', 'ok'); panelVender();
  } catch (e) { msg(traducir(e), 'err'); }
}

async function depositarFianza() {
  const v = Number($('mk-fianza').value || 0);
  if (!(v > 0)) { msg('Pon un monto.', 'err'); return; }
  try {
    const signer = await firmante();
    const cuenta = await signer.getAddress();
    const monto = ethers.parseUnits(String(v), 18);
    const t = new ethers.Contract(USDT, ERC20, signer);
    msg('Revisando permiso de USDT…', 'info');
    if ((await t.allowance(cuenta, MARKET)) < monto) {
      msg('Aprueba el USDT en tu wallet…', 'info');
      await (await t.approve(MARKET, monto)).wait();
    }
    msg('Confirm the deposit…', 'info');
    const c = new ethers.Contract(MARKET, ABI, signer);
    await (await c.depositarFianza(monto)).wait();
    msg('Deposit made. You can now sell.', 'ok'); panelVender();
  } catch (e) { msg(traducir(e), 'err'); }
}

async function publicar() {
  const tok = $('mk-tok').value;
  const cant = Number(String($('mk-cant').value || '').replace(',', '.')) || 0;
  const tramos = Number($('mk-tra').value);
  const monedas = [...document.querySelectorAll('#mk-monedas .mk-cs.on')].map(b => b.getAttribute('data-mon'));
  const metodos = [...document.querySelectorAll('#mk-metodos .mk-cs.on')].map(b => b.getAttribute('data-met'));

  if (!(cant > 0)) { msg('Enter the amount you will sell.', 'err'); return; }
  if (monedas.length === 0) { msg('Marca al menos una moneda que aceptas.', 'err'); return; }
  if (metodos.length === 0) { msg('Marca al menos una forma de pago.', 'err'); return; }

  // Precio de cada moneda: "CUP 420 · USD 1.10"
  const partes = [];
  let primero = 0;
  for (const m of monedas) {
    const inp = document.querySelector(`.mk-precio[data-mon="${m}"]`);
    const v = Number(String((inp && inp.value) || '').replace(',', '.')) || 0;
    if (!(v > 0)) { msg(`Falta el precio para ${m}.`, 'err'); return; }
    if (primero === 0) primero = v;
    partes.push(`${m} ${v}`);
  }
  const moneda = partes.join(' · ').slice(0, 160);
  const metodo = metodos.join(' · ').slice(0, 160);

  try {
    const signer = await firmante();
    const cuenta = await signer.getAddress();
    const monto = ethers.parseUnits(String(cant), 18);
    if (monto % BigInt(tramos) !== 0n) { msg('Elige una cantidad que se divida exacta entre las partes.', 'err'); return; }
    const t = new ethers.Contract(tok, ERC20, signer);
    msg('Revisando permiso…', 'info');
    if ((await t.allowance(cuenta, MARKET)) < monto) {
      msg('Aprueba el token en tu wallet…', 'info');
      await (await t.approve(MARKET, monto)).wait();
    }
    const fee = await lee('comisionBnb');
    msg('Confirma la publicación…', 'info');
    const c = new ethers.Contract(MARKET, ABI, signer);
    await (await c.crearOrden(tok, monto, tramos, moneda, metodo, Math.round(primero * 100), { value: fee })).wait();
    msg('Offer published! Everyone can see it now.', 'ok');
    setTimeout(() => { $('mk-t1').click(); listarOfertas(); }, 900);
  } catch (e) { msg(traducir(e), 'err'); }
}
