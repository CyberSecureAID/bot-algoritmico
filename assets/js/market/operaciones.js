/* market/operaciones.js — La pestaña "Mis operaciones": lista las compras/
   ventas activas del usuario, cada una como tarjeta (opCard) con sus
   acciones (confirmar, cancelar, disputar, calificar) cableadas en wireOps.
   Recibe listarOfertas por initOperaciones. Extraído de market.js. */

import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';
import { esc, num, f18, simbolo, fechaExacta, traducir, firmante } from './util.js?v=1';
import { msg, overlay, cerrar } from './ui.js?v=1';
import { confirmar, pedirEstrellas, pedirMotivo } from './dialogos.js?v=1';
import { lee } from './contrato.js?v=1';
import { MARKET, ABI, ESTADOS } from './config.js?v=1';

const $ = (id) => document.getElementById(id);
let _listarOfertas = () => {};
export function initOperaciones({ listarOfertas }) { _listarOfertas = listarOfertas; }

export async function panelMisOps() {
  const box = $('mk-p3'); if (!box) return;
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  if (!cuenta) { box.innerHTML = `<div class="mk-vacio">Conecta tu wallet para ver tus operaciones.</div>`; return; }
  box.innerHTML = `<div class="tj-grid">${'<div class="tj-sk"></div>'.repeat(2)}</div>`;
  try {
    const [ventas, compras, dueno] = await Promise.all([
      lee('misOrdenes', [cuenta]).catch(() => []),
      lee('misCompras', [cuenta]).catch(() => []),
      lee('owner').catch(() => null)
    ]);
    const esOwner = dueno && String(dueno).toLowerCase() === String(cuenta).toLowerCase();
    const ids = [...new Set([...ventas, ...compras].map(String))];
    if (ids.length === 0) {
      box.innerHTML = `<div class="mk-vacio">Todavía no tienes operaciones.<br>Publica una oferta o reserva una de otra persona.</div>`;
      return;
    }
    const ords = (await Promise.all(ids.map(async (id) => {
      const o = await lee('ordenes', [id]).catch(() => null);
      if (!o) return null;
      const otro = String(o.vendedor).toLowerCase() === String(cuenta).toLowerCase() ? o.comprador : o.vendedor;
      let perfOtro = null;
      if (otro && otro !== '0x0000000000000000000000000000000000000000') {
        perfOtro = await lee('perfiles', [otro]).catch(() => null);
      }
      return { o, perfOtro };
    }))).filter(Boolean);
    ords.sort((a, b) => Number(b.o.id) - Number(a.o.id));

    // Agrupar: lo que necesita acción va primero
    /* Marca de "ocultar terminadas": todo lo cerrado ANTES de este
       momento no se lista. Solo afecta a este navegador; en la cadena
       queda todo, que es lo que sostiene la reputación. */
    let _ocultas = {};
    try {
      const v = JSON.parse(localStorage.getItem('mk-ocultas') || '{}');
      _ocultas = v[String(cuenta).toLowerCase()] || {};
    } catch (_) {}

    const urg = [], curso = [], abiertas = [], fin_ = [];
    for (const d of ords) {
      const o = d.o, est = Number(o.estado);
      const soyV = String(o.vendedor).toLowerCase() === String(cuenta).toLowerCase();
      const tocaMi = (est === 1 && ((soyV && o.tramoPagado) || (!soyV && !o.tramoPagado)))
        || (est === 2 && (soyV ? !o.califVendedor : !o.califComprador))
        || (est === 4 && esOwner);
      if (tocaMi) urg.push(d);
      else if (est === 1) curso.push(d);
      else if (est === 0) abiertas.push(d);
      else {
        /* [CORREGIDO] Antes se comparaba con la FECHA de cierre, pero
           muchas órdenes tienen ultimoMovEn a cero y nunca se ocultaban.
           Ahora se guardan los IDs concretos: si está en la lista, fuera. */
        if (!_ocultas[String(d.o.id)]) fin_.push(d);
      }
    }
    const sec = (tit, arr, nota, plegable) => {
      if (!arr.length) return '';
      /* Las terminadas se pliegan solas a partir de cinco: si no, el
         historial crece sin fin y tapa lo que de verdad hay que atender. */
      const TOPE = 5;
      const pliega = plegable && arr.length > TOPE;
      const visibles = pliega ? arr.slice(0, TOPE) : arr;
      const ocultas = pliega ? arr.slice(TOPE) : [];
      return `<div class="op-sec"><div class="op-st">${tit} <span>${arr.length}</span></div>` +
        (nota ? `<div class="op-nota">${nota}</div>` : '') +
        visibles.map(d => opCard(d, cuenta, esOwner)).join('') +
        (pliega
          ? `<details class="op-mas"><summary>Ver las ${ocultas.length} anteriores</summary>${ocultas.map(d => opCard(d, cuenta, esOwner)).join('')}</details>`
          : '') +
        `</div>`;
    };
    // Cuánto tiene el contrato retenido que es tuyo
    let retenido = {};
    for (const { o } of ords) {
      const est = Number(o.estado);
      const soyV = String(o.vendedor).toLowerCase() === String(cuenta).toLowerCase();
      if (soyV && Number(o.tipo) === 0 && (est === 0 || est === 1 || est === 4)) {
        const sim = simbolo(o.token);
        retenido[sim] = (retenido[sim] || 0) + (f18(o.monto) - f18(o.liberado));
      }
    }
    const hayRet = Object.entries(retenido).filter(([, v]) => v > 0);
    const cajaRet = hayRet.length
      ? `<div class="op-caja">
          <div class="op-caja-t">Tu dinero en la caja fuerte</div>
          <div class="op-caja-v">${hayRet.map(([k, v]) => `<span><b>${num(v, 2)}</b> ${k}</span>`).join('')}</div>
          <div class="op-caja-d">Es tuyo. Vuelve a tu wallet en cuanto canceles la publicación o termine la operación.</div>
          <button class="op-caja-b" id="op-retirar"><span class="tx-l">Retirar todos mis fondos</span><span class="tx-s">Retirar fondos</span></button>
        </div>`
      : `<div class="op-caja vacia"><div class="op-caja-t">Tu dinero en la caja fuerte</div><div class="op-caja-v"><span><b>0.00</b></span></div><div class="op-caja-d">Ahora mismo el contrato no retiene nada tuyo.</div></div>`;

    box.innerHTML = cajaRet +
      sec('Te toca a ti', urg, 'Estas operaciones están esperando algo tuyo. Atiéndelas primero.') +
      sec('En curso', curso, 'Estás esperando a la otra persona.') +
      sec('Publicadas', abiertas, 'Todavía nadie las ha tomado.') +
      sec('Terminadas', fin_, 'Historial de lo que ya se cerró.', true) +
      (fin_.length ? `<button class="op-limpiar" id="op-limpiar">Ocultar las ${fin_.length} terminadas</button>` : '')
    wireOps();

    /* [CORREGIDO] Este botón estaba dentro de wireOps(), pero la lista
       de terminadas (fin_) se calcula AQUÍ, en panelMisOps. Desde allí
       no la veía, así que ocultaba una lista vacía: el mensaje verde
       aparecía y no se ocultaba nada. */
    const _limp = $('op-limpiar');
    if (_limp) _limp.onclick = () => confirmar({
      titulo: `Ocultar ${fin_.length} terminada${fin_.length > 1 ? 's' : ''}`,
      texto: 'Desaparecen de esta lista para que veas solo lo que está en marcha.<br><br>' +
             '<b>No se borra nada</b>: tu historial y tus estrellas siguen en la blockchain.',
      ok: 'Ocultar'
    }, async () => {
      try {
        const v = JSON.parse(localStorage.getItem('mk-ocultas') || '{}');
        const k = String(cuenta).toLowerCase();
        v[k] = v[k] || {};
        fin_.forEach((d) => { v[k][String(d.o.id)] = 1; });
        localStorage.setItem('mk-ocultas', JSON.stringify(v));
      } catch (_) {}
      msg(`${fin_.length} ocultada${fin_.length > 1 ? 's' : ''}.`, 'ok');
      panelMisOps();
    });

    const rt = $('op-retirar');
    if (rt) rt.onclick = () => confirmar({
      titulo: '¿Retirar todo lo que tienes en la caja fuerte?',
      texto: 'Se te devuelve <b>todo tu dinero</b> de una vez, incluida tu fianza.<br><br>A cambio: <b>todas tus publicaciones se cancelan al instante</b> y desaparecen del listado, igual que las reservas donde todavía nadie ha pagado.<br><br>Lo que ya esté a mitad de una operación (con un pago declarado) <b>no se toca</b>: eso hay que terminarlo o resolverlo por disputa.',
      ok: 'Sí, retirar todo', peligro: true
    }, async () => {
      try {
        msg('Confirma en tu wallet…', 'info');
        const c = new ethers.Contract(MARKET, ABI, await firmante());
        await (await c.retirarTodo()).wait();
        msg('Listo. Tus fondos volvieron a tu wallet.', 'ok');
        panelMisOps(); _listarOfertas();
      } catch (e) { msg(traducir(e), 'err'); }
    });

    /* ══════════════════════════════════════════════════════════════
       POR QUÉ QUEDA DINERO DESPUÉS DE "RETIRAR TODO"

       retirarTodo() NO puede sacar lo que está dentro de una operación
       viva: eso sería robarle al comprador. Si queda saldo después de
       retirar, es que hay una orden abierta reteniéndolo.

       Antes esto no se explicaba: el usuario pulsaba "retirar todo",
       firmaba, y seguía viendo dinero ahí. Diez veces. Sin entender
       nada. Ahora se le dice qué lo retiene y cómo sacarlo.
       ══════════════════════════════════════════════════════════════ */
    if (hayRet.length && (urg.length || curso.length || abiertas.length)) {
      const zona = document.querySelector('#mk-overlay .op-caja');
      if (zona) {
        const _atadas = urg.length + curso.length + abiertas.length;
        zona.insertAdjacentHTML('beforeend', `
          <div class="op-atado">
            <b>¿Retiraste y sigue apareciendo saldo?</b>
            Es porque tienes <b>${_atadas} operación${_atadas > 1 ? 'es' : ''} sin terminar</b>. Ese dinero está reservado para ellas: el contrato no puede devolvértelo mientras sigan abiertas, porque sería quitárselo a la otra parte.
            <i>Para recuperarlo: cancela o termina esas operaciones ahí abajo. En cuanto se cierren, el dinero vuelve solo a tu wallet.</i>
          </div>`);
      }
    }
  } catch (e) { box.innerHTML = `<div class="mk-vacio">No se pudo cargar. Revisa tu conexión.</div>`; }
}

function cuando(seg) {
  const t = Number(seg) * 1000;
  if (!t || !isFinite(t)) return '';
  const d = Date.now() - t;
  const min = Math.floor(d / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  return new Date(t).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });
}

function opCard({ o, perfOtro }, cuenta, esOwner) {
  const soyV = String(o.vendedor).toLowerCase() === String(cuenta).toLowerCase();
  const est = Number(o.estado);
  const sim = simbolo(o.token);
  const compraAnuncio = Number(o.tipo) === 1;
  const monto = f18(o.monto), tramos = Number(o.tramos) || 1, hechos = Number(o.tramosHechos);
  const porTramo = monto / tramos;
  const otroNom = (perfOtro && perfOtro.nombre) || 'la otra persona';
  const otroCt = (perfOtro && perfOtro.contacto) || '';

  // Qué está pasando y qué toca hacer, en cristiano
  let titulo = '', explica = '', acciones = '', color = '';
  if (est === 0) {
    titulo = compraAnuncio ? 'Tu anuncio de compra' : 'Tu oferta está publicada';
    explica = 'Todavía nadie la ha tomado. Puedes cancelarla y recuperar tu cripto cuando quieras.';
    acciones = `<button class="op-b gris" data-cancel2="${o.id}"><span class="tx-l">Cancelar y recuperar</span><span class="tx-s">Cancelar</span></button>`;
  } else if (est === 1) {
    color = 'act';
    if (soyV) {
      if (o.tramoPagado) {
        titulo = `${esc(otroNom)} dice que ya pagó la parte ${hechos + 1}`;
        explica = `<b>Comprueba en tu banco/Zelle que el dinero llegó de verdad.</b> Si llegó, libera esa parte y se le envían ${num(porTramo, 2)} ${sim}. Si no llegó, no liberes nada y abre una disputa.`;
        acciones = `<button class="op-b" data-lib="${o.id}"><span class="tx-l">Sí, ya me llegó · liberar ${num(porTramo, 2)} ${sim}</span><span class="tx-s">Ya me llegó · liberar</span></button>
                    <button class="op-b gris" data-canmut="${o.id}">Cancelar pedido</button>
                    `;
      } else {
        titulo = `${esc(otroNom)} reservó tu oferta`;
        const venceEn = (Number(o.tomadaEn) + 24 * 3600) * 1000;
        const vencida = Date.now() > venceEn;
        const hs = Math.max(0, Math.ceil((venceEn - Date.now()) / 3600000));
        explica = `Ahora te toca <b>contactarlo</b> y ponerte de acuerdo. Cuando te pague la parte ${hechos + 1}, él marcará el pago y tú lo confirmas aquí.` +
          (vencida ? ` <b>La reserva ya venció</b>: puedes devolver la oferta al listado.` : ` Si no arranca, en <b>${hs} h</b> podrás devolverla al listado.`);
        acciones = otroCt ? `<div class="op-ct">${esc(otroCt)}</div>` : '';
        acciones += vencida ? `<button class="op-b" data-liber="${o.id}"><span class="tx-l">Devolver mi oferta al listado</span><span class="tx-s">Devolver al listado</span></button>` : '';
        acciones += `<button class="op-b gris" data-aband="${o.id}"><span class="tx-l">Me arrepentí · cancelar pedido</span><span class="tx-s">Cancelar pedido</span></button>
                     `;
      }
    } else {
      if (o.tramoPagado) {
        titulo = 'Esperando a que confirme tu pago';
        explica = `Ya marcaste el pago de la parte ${hechos + 1}. Cuando ${esc(otroNom)} lo verifique, recibirás ${num(porTramo, 2)} ${sim} en tu wallet.`;
        acciones = ``;
      } else {
        titulo = `Te toca pagar la parte ${hechos + 1}`;
        explica = `Contacta a ${esc(otroNom)}, págale lo acordado por esta parte y <b>solo entonces</b> marca abajo que ya pagaste. Recibirás ${num(porTramo, 2)} ${sim}.`;
        acciones = otroCt ? `<div class="op-ct">${esc(otroCt)}</div>` : '';
        acciones += `<button class="op-b" data-pag="${o.id}"><span class="tx-l">Ya le pagué la parte ${hechos + 1}</span><span class="tx-s">Ya pagué</span></button>
                     <button class="op-b gris" data-canmut="${o.id}">Cancelar pedido</button>
                     `;
      }
    }
  } else if (est === 2) {
    const falta = soyV ? !o.califVendedor : !o.califComprador;
    titulo = 'Operación completada';
    explica = falta ? `Todo salió bien. Solo falta que califiques a ${esc(otroNom)}: ayuda a los demás a saber en quién confiar.` : 'Completada y calificada. ¡Buen trato!';
    acciones = falta ? `<button class="op-b" data-cal="${o.id}">Calificar a ${esc(otroNom)}</button>` : '';
    color = falta ? 'act' : 'ok';
  } else if (est === 3) {
    titulo = 'Cancelada';
    explica = 'Esta operación se canceló. Si tenías cripto trabada, ya volvió a tu wallet.';
  } else if (est === 4) {
    titulo = 'En disputa';
    color = 'dis';
    explica = 'Un árbitro va a revisar el caso y decidirá quién tiene razón. Mientras tanto, la cripto sigue trabada y segura.';
    if (esOwner) {
      acciones = `<div class="op-arb">Eres el árbitro. Revisa los comprobantes antes de decidir.</div>
        <button class="op-b" data-res1="${o.id}">Razón al COMPRADOR</button>
        <button class="op-b gris" data-res0="${o.id}">Razón al VENDEDOR</button>
        <button class="op-b gris" data-anu="${o.id}">Anular · devolver todo</button>`;
    }
  }

  const pasos = Array.from({ length: tramos }, (_, i) =>
    `<div class="mk-step ${i < hechos ? 'ok' : (i === hechos && est === 1 ? 'now' : '')}"></div>`).join('');

  return `
  <div class="op-card ${color}">
    <div class="op-cab">
      <span class="op-id">#${o.id}</span>
      <span class="op-rol ${soyV ? 'v' : 'c'}">${compraAnuncio ? 'Anuncio' : (soyV ? 'Vendo' : 'Compro')} ${num(monto, 2)} ${sim}</span>
      <span class="op-est ${color}">${ESTADOS[est]}</span>
    </div>
    <div class="op-tit">${titulo}</div>
    <div class="op-exp">${explica}</div>
    ${(() => {
      /* CUÁNDO PASÓ CADA COSA. Antes no se veía ninguna fecha: no sabías si
         una operación era de hoy o de hace un mes, ni cuánto tardó. */
      const t = [];
      if (Number(o.creadaEn) > 0) t.push(`<span title="${fechaExacta(o.creadaEn)}"><i>Publicada</i>${cuando(o.creadaEn)}</span>`);
      if (Number(o.tomadaEn) > 0) t.push(`<span title="${fechaExacta(o.tomadaEn)}"><i>Tomada</i>${cuando(o.tomadaEn)}</span>`);
      if (est >= 2 && Number(o.ultimoMovEn) > 0) {
        t.push(`<span title="${fechaExacta(o.ultimoMovEn)}"><i>${est === 2 ? 'Completada' : 'Cerrada'}</i>${cuando(o.ultimoMovEn)}</span>`);
        // Cuánto tardó de principio a fin: útil para juzgar a la otra parte.
        const ini = Number(o.tomadaEn) || Number(o.creadaEn);
        const dur = Number(o.ultimoMovEn) - ini;
        if (ini > 0 && dur > 60) {
          const h = Math.floor(dur / 3600), m = Math.floor((dur % 3600) / 60);
          t.push(`<span><i>Duró</i>${h > 24 ? Math.floor(h / 24) + ' días' : h > 0 ? h + ' h ' + m + ' min' : m + ' min'}</span>`);
        }
      }
      if (Number(o.disputaEn) > 0) t.push(`<span class="dis" title="${fechaExacta(o.disputaEn)}"><i>Disputa</i>${cuando(o.disputaEn)}</span>`);
      return t.length ? `<div class="op-fechas">${t.join('')}</div>` : '';
    })()}
    ${(!compraAnuncio && est === 1) ? `<div class="op-prog">
      <div class="op-prog-l"><span>Parte ${Math.min(hechos + 1, tramos)} de ${tramos}</span><span>Entregado ${num(f18(o.liberado), 2)} de ${num(monto, 2)} ${sim}</span></div>
      <div class="mk-steps">${pasos}</div></div>` : ''}
    <div class="op-acts">${acciones}</div>
    <div id="mk-cal-${o.id}"></div>
  </div>`;
}


export function wireOps() {
  /* [FALLO GRAVE CORREGIDO] Esta función se tragaba los errores: si el
     contrato rechazaba la transacción, mostraba el aviso rojo pero
     devolvía "todo bien" a quien la llamó. Por eso el botón de cancelar
     decía que había funcionado cuando en realidad no hizo nada.
     Ahora devuelve true/false y quien la use puede reaccionar. */
  const tx = async (fn, id, okMsg, args) => {
    try {
      msg('Confirma en tu wallet…', 'info');
      const c = new ethers.Contract(MARKET, ABI, await firmante());
      await (await c[fn](...(args !== undefined ? [id, args] : [id]))).wait();
      msg(okMsg, 'ok'); panelMisOps();
      return true;
    } catch (e) { msg(traducir(e), 'err'); return false; }
  };

  /* Igual que tx(), pero SIN mensajes: para probar una vía y, si falla,
     seguir con la siguiente sin marear al usuario con avisos rojos. */
  const txCallado = async (fn, id) => {
    try {
      const c = new ethers.Contract(MARKET, ABI, await firmante());
      await (await c[fn](id)).wait();
      return { ok: true };
    } catch (e) {
      const m = String(e?.shortMessage || e?.reason || e?.message || e);
      return { ok: false, rechazado: /reject|denied|user cancel/i.test(m), motivo: m };
    }
  };
  document.querySelectorAll('[data-pag]').forEach(b => b.onclick = () => confirmar({
    titulo: '¿Ya le pagaste?',
    texto: 'Marca esto <b>solo si ya enviaste el dinero</b>. La otra persona lo va a verificar antes de soltarte la cripto. Marcarlo sin pagar puede costarte una disputa perdida y tu reputación.',
    ok: 'Sí, ya pagué'
  }, () => tx('marcarPagado', b.getAttribute('data-pag'), 'Pago marcado. Espera la confirmación.')));

  document.querySelectorAll('[data-lib]').forEach(b => b.onclick = () => confirmar({
    titulo: '¿Confirmas que te llegó?',
    texto: 'Al liberar, <b>la cripto sale de la caja fuerte y va al comprador</b>. Esto no se puede deshacer. Comprueba primero en tu banco que el dinero está de verdad.',
    ok: 'Sí, me llegó · liberar'
  }, () => tx('liberarTramo', b.getAttribute('data-lib'), 'Parte liberada.')));


  document.querySelectorAll('[data-aband]').forEach(b => b.onclick = () => confirmar({
    titulo: '¿Abandonar esta venta?',
    texto: 'Te echas atrás antes de que empiece el pago. La operación <b>se cierra</b>, tu cripto <b>vuelve a tu wallet</b> y la publicación <b>desaparece del listado</b>.<br><br>Avisa a la otra persona por el contacto: si ya te mandó el dinero, no uses esto — usa la disputa.',
    ok: 'Sí, abandonar', peligro: true
  }, () => tx('abandonarVenta', b.getAttribute('data-aband'), 'Venta abandonada. Tu cripto volvió a tu wallet.')));

  document.querySelectorAll('[data-liber]').forEach(b => b.onclick = () => confirmar({
    titulo: 'Devolver tu oferta al listado',
    texto: 'La persona que la reservó no arrancó en 24 horas. Tu oferta <b>vuelve a estar visible</b> para todos y tu cripto sigue trabada y segura.',
    ok: 'Sí, devolverla'
  }, () => tx('liberarReserva', b.getAttribute('data-liber'), 'Tu oferta volvió al listado.')));

  /* ══════════════════════════════════════════════════════════════
     CANCELAR SIN DEPENDER DEL OTRO — [FALLO GRAVE CORREGIDO]

     Antes esto solo llamaba a pedirCancelar(), que necesita que AMBAS
     partes lo pidan. Si la otra persona se enfadaba y no volvía nunca,
     el dinero se quedaba atrapado en el contrato para siempre. Eso es
     inaceptable: nadie debe poder secuestrar tu dinero por no volver.

     Ahora se intentan las dos vías, en orden:
       1. pedirCancelar()     — si el otro coopera, se cierra al momento
       2. cancelarPorTiempo() — pasado el plazo, cancelas tú solo

     Y si ninguna funciona todavía, se explica cuánto falta y se ofrece
     la disputa, que SIEMPRE tiene salida por arbitraje.
     ══════════════════════════════════════════════════════════════ */
  document.querySelectorAll('[data-canmut]').forEach(b => b.onclick = () => confirmar({
    titulo: 'Cancelar este pedido',
    texto: 'Se intentará cerrar la operación y <b>devolverte la cripto que quede</b>.<br><br>' +
           'Si la otra persona también lo pide, se cancela al instante. Si no responde, ' +
           'se cancela igualmente <b>pasado el plazo de espera</b>: nadie puede retener tu dinero por no contestar.',
    ok: 'Sí, cancelar'
  }, async () => {
    const id = b.getAttribute('data-canmut');
    msg('Confirma en tu wallet…', 'info');

    /* Se prueban TRES vías en orden. Antes solo se intentaba la primera
       y, si el contrato la rechazaba, el usuario firmaba para nada y no
       se enteraba de por qué. */
    const vias = [
      ['cancelarPorTiempo', 'Pedido cancelado. Tu cripto vuelve a tu wallet.'],
      ['cancelarOrden',     'Pedido cancelado. Tu cripto vuelve a tu wallet.'],
      ['pedirCancelar',     'Petición registrada. Falta que la otra persona la confirme.']
    ];

    let ultimo = '';
    for (const [fn, okMsg] of vias) {
      const r = await txCallado(fn, id);
      if (r.ok) { msg(okMsg, 'ok'); panelMisOps(); return; }
      if (r.rechazado) { msg('Cancelaste la firma.', ''); return; }
      ultimo = r.motivo;
    }

    /* Ninguna funcionó. Se explica QUÉ pasa y qué puede hacer, en vez de
       dejarle firmando una y otra vez sin resultado. */
    msg('', '');
    confirmar({
      titulo: 'Este pedido no se puede cancelar todavía',
      texto: 'El contrato no lo permite ahora mismo. Suele ser por una de estas dos:<br><br>' +
             '<b>1.</b> Hay un pago declarado por la otra parte. Mientras eso esté ahí, ' +
             'el contrato no deja cancelar: sería quitarle su dinero.<br>' +
             '<b>2.</b> Todavía no ha pasado el plazo de espera.<br><br>' +
             '<b>La salida segura es la disputa.</b> Un árbitro revisa el caso y libera el dinero ' +
             'a quien corresponda. Es la vía que existe justo para esto.',
      ok: 'Abrir disputa'
    }, () => pedirMotivo(id));
  }));

  document.querySelectorAll('[data-anu]').forEach(b => b.onclick = () => confirmar({
    titulo: 'Anular la disputa',
    texto: 'Se cierra sin culpables y <b>la cripto trabada vuelve al vendedor</b>. Úsalo cuando fue un malentendido.',
    ok: 'Anular', peligro: true
  }, () => tx('anularDisputa', b.getAttribute('data-anu'), 'Disputa anulada.')));

  document.querySelectorAll('[data-cancel2]').forEach(b => b.onclick = () => confirmar({
    titulo: '¿Cancelar tu publicación?',
    texto: 'Se retira del marketplace y <b>tu cripto vuelve a tu wallet</b> al momento.',
    ok: 'Sí, cancelar'
  }, () => tx('cancelarOrden', b.getAttribute('data-cancel2'), 'Cancelada. Tu cripto volvió a tu wallet.')));

  document.querySelectorAll('[data-res1]').forEach(b => b.onclick = () => confirmar({
    titulo: 'Dar la razón al comprador',
    texto: 'El comprador recibirá la parte en disputa, y si falta, se completa con la fianza del vendedor. El resto vuelve al vendedor.',
    ok: 'Confirmar', peligro: true
  }, () => tx('resolverDisputa', b.getAttribute('data-res1'), 'Disputa resuelta.', true)));

  document.querySelectorAll('[data-res0]').forEach(b => b.onclick = () => confirmar({
    titulo: 'Dar la razón al vendedor',
    texto: 'La cripto que queda trabada vuelve al vendedor y la operación se cierra.',
    ok: 'Confirmar', peligro: true
  }, () => tx('resolverDisputa', b.getAttribute('data-res0'), 'Disputa resuelta.', false)));

  document.querySelectorAll('[data-cal]').forEach(b => b.onclick = () => pedirEstrellas(b.getAttribute('data-cal')));
}
