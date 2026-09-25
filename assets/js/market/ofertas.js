/* market/ofertas.js — La pestaña de Ofertas: lista los anuncios (tarjeta),
   abre la ficha de cada uno (verFicha) y permite tomar o cancelar. Incluye
   el mapa de logos y el árbitro por defecto. Es autónomo (solo exporta
   listarOfertas). Extraído de market.js. */

import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';
import { esc, num, f18, simbolo, corto, traducir, firmante } from './util.js?v=1';
import { msg, cerrar } from './ui.js?v=1';
import { distanciaEn } from './ubicacion.js?v=1';
import { lee } from './contrato.js?v=1';
import { pedirPerfilRapido } from './dialogos.js?v=1';
import { MARKET, ABI, ICOCT } from './config.js?v=1';

const $ = (id) => document.getElementById(id);

const LOGO = {
  USDT: `<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="16" r="16" fill="#26A17B"/><path fill="#fff" d="M17.9 17.4v0c-.1 0-.7.1-1.9.1-1 0-1.7 0-2 0v0c-3.6-.2-6.2-.8-6.2-1.5s2.7-1.3 6.2-1.5v2.3c.3 0 1.1.1 2 .1 1.2 0 1.8-.1 1.9-.1v-2.3c3.6.2 6.2.8 6.2 1.5s-2.7 1.3-6.2 1.5m0-3.2v-2h4.7v-3.1H9.4v3.1h4.7v2C10.3 14.4 7.4 15.2 7.4 16.1s2.9 1.7 6.7 1.9v6.6h3.8v-6.6c3.8-.2 6.7-1 6.7-1.9s-2.9-1.7-6.7-1.9"/></svg>`,
  USDC: `<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="16" r="16" fill="#2775CA"/><path fill="#fff" d="M20.3 18.5c0-2.3-1.4-3.1-4.1-3.4-2-.3-2.4-.8-2.4-1.7s.7-1.6 2-1.6c1.2 0 1.8.4 2.1 1.4.1.2.3.3.4.3h1.1c.2 0 .4-.2.4-.4v0c-.3-1.5-1.5-2.6-3-2.8V8.7c0-.2-.2-.4-.4-.4h-1c-.2 0-.4.2-.4.4v1.5c-2 .3-3.2 1.6-3.2 3.3 0 2.2 1.3 3.1 4 3.4 1.9.3 2.5.7 2.5 1.8s-.9 1.8-2.2 1.8c-1.7 0-2.3-.7-2.5-1.7 0-.2-.2-.3-.4-.3h-1.2c-.2 0-.4.2-.4.4v0c.3 1.7 1.4 2.9 3.4 3.2v1.5c0 .2.2.4.4.4h1c.2 0 .4-.2.4-.4v-1.5c2-.3 3.3-1.7 3.3-3.6z"/><path fill="#fff" d="M12.9 25.5c-4.1-1.5-6.2-6.1-4.7-10.2.8-2.2 2.5-3.9 4.7-4.7.2-.1.3-.3.3-.5v-.9c0-.2-.1-.4-.3-.4-.1 0-.2 0-.3 0-5 1.6-7.7 6.9-6.1 11.9.9 2.9 3.2 5.2 6.1 6.1.2.1.4 0 .5-.2.1-.1.1-.1.1-.2v-.9c0-.2-.2-.4-.3-.5zm6.5-17.2c-.2-.1-.4 0-.5.2-.1.1-.1.1-.1.2v.9c0 .2.2.4.3.5 4.1 1.5 6.2 6.1 4.7 10.2-.8 2.2-2.5 3.9-4.7 4.7-.2.1-.3.3-.3.5v.9c0 .2.1.4.3.4.1 0 .2 0 .3 0 5-1.6 7.7-6.9 6.1-11.9-.9-2.9-3.2-5.2-6.1-6.2z"/></svg>`
};
const logoMoneda = (t) => LOGO[simbolo(t)] || '';

const OF_POR_PAG = 12;   // ofertas por página
let _ofDatos = [];       // todas las ofertas abiertas cargadas
let _ofPag = 1;

export async function listarOfertas() {
  const box = $('mk-p1'); if (!box) return;
  box.innerHTML = `<div class="tj-grid">${'<div class="tj-sk"></div>'.repeat(4)}</div>`;
  try {
    const total = Number(await lee('totalOrdenes'));
    if (total === 0) { box.innerHTML = `<div class="mk-vacio">No offers published yet.<br>Be the first: go to "Sell".</div>`; return; }
    // Escanear las últimas 300 órdenes (para plataformas con mucho volumen).
    const escanear = total > 300 ? 300 : total;
    const desde = total - escanear;
    const todos = [];
    for (let i = total; i > desde; i--) todos.push(i);
    // Traer en lotes para no saturar el RPC con miles de llamadas a la vez.
    const crudas = [];
    for (let k = 0; k < todos.length; k += 30) {
      const lote = todos.slice(k, k + 30);
      const res = await Promise.all(lote.map(i => lee('ordenes', [i]).catch(() => null)));
      crudas.push(...res);
    }
    const abiertas = crudas.filter(o => o && Number(o.estado) === 0);
    if (abiertas.length === 0) { box.innerHTML = `<div class="mk-vacio">No open offers right now.</div>`; return; }
    // Cargar perfil/reputación solo de las abiertas.
    _ofDatos = [];
    for (let k = 0; k < abiertas.length; k += 30) {
      const lote = abiertas.slice(k, k + 30);
      const res = await Promise.all(lote.map(async (o) => {
        const [perf, rep] = await Promise.all([
          lee('perfiles', [o.vendedor]).catch(() => null),
          lee('reputacionDe', [o.vendedor]).catch(() => null)
        ]);
        return { o, perf, rep };
      }));
      _ofDatos.push(...res);
    }
    _ofPag = 1;
    pintarOfertas();
  } catch (e) {
    box.innerHTML = `<div class="mk-vacio">Could not load offers.<br>Check your connection.</div>`;
  }
}

function pintarOfertas() {
  const box = $('mk-p1'); if (!box) return;
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  const arr = _ofDatos.filter(Boolean);
  if (!arr.length) { box.innerHTML = `<div class="mk-vacio">No open offers right now.</div>`; return; }
  const totalPag = Math.ceil(arr.length / OF_POR_PAG);
  if (_ofPag > totalPag) _ofPag = totalPag;
  const ini = (_ofPag - 1) * OF_POR_PAG;
  const pagina = arr.slice(ini, ini + OF_POR_PAG);
  const html = pagina.map(d => tarjeta(d, cuenta)).join('');
  box.innerHTML = `<div class="tj-grid">${html}</div>` + paginadorOf(arr.length, totalPag);
  wireTarjetas();
  // controles de paginación
  const prev = $('of-prev'), next = $('of-next');
  if (prev) prev.onclick = () => { if (_ofPag > 1) { _ofPag--; pintarOfertas(); box.scrollTop = 0; } };
  if (next) next.onclick = () => { if (_ofPag < totalPag) { _ofPag++; pintarOfertas(); box.scrollTop = 0; } };
  box.querySelectorAll('[data-ofp]').forEach(b => { b.onclick = () => { _ofPag = +b.dataset.ofp; pintarOfertas(); box.scrollTop = 0; }; });
}

function paginadorOf(total, totalPag) {
  if (totalPag <= 1) return `<div class="of-pag-info">${total} offer${total!==1?'s':''}</div>`;
  let nums = [];
  for (let i = 1; i <= totalPag; i++) {
    if (i === 1 || i === totalPag || (i >= _ofPag - 2 && i <= _ofPag + 2)) nums.push(i);
    else if (nums[nums.length-1] !== '…') nums.push('…');
  }
  const btns = nums.map(n => n === '…' ? `<span class="of-pag-e">…</span>` : `<button class="of-pag-n ${n===_ofPag?'on':''}" data-ofp="${n}">${n}</button>`).join('');
  return `<div class="of-pag">
    <div class="of-pag-info">${total} offers · page ${_ofPag} of ${totalPag}</div>
    <div class="of-pag-ctrl">
      <button class="of-pag-b" id="of-prev" ${_ofPag<=1?'disabled':''}>‹</button>
      ${btns}
      <button class="of-pag-b" id="of-next" ${_ofPag>=totalPag?'disabled':''}>›</button>
    </div>
  </div>`;
}

function estrellasTxt(rep) {
  if (!rep || Number(rep.votos) === 0) return 'sin calificaciones';
  const e = Number(rep.estrellasX100) / 100;
  return `<span class="st">★ ${e.toFixed(1)}</span> (${Number(rep.votos)})`;
}

function tarjeta({ o, perf, rep }, cuenta) {
  const sim = simbolo(o.token);
  const monto = f18(o.monto);
  const nombre = perf && perf.nombre ? perf.nombre : 'Sin nombre';
  const mio = cuenta && String(cuenta).toLowerCase() === String(o.vendedor).toLowerCase();
  const compra = Number(o.tipo) === 1;
  const conRep = rep && Number(rep.votos) > 0;
  const ventas = rep ? Number(rep.ventasOk) : 0;

  // Precio principal + equivalente total
  const lista = String(o.moneda || '').split('·').filter(Boolean)
    .map(p => { const t = p.trim().split(/\s+/); return { m: t[0] || '', v: Number(t[1]) || 0 }; });
  const p1 = lista[0] || { m: '', v: 0 };
  const total = p1.v * monto;
  const otras = lista.slice(1);

  return `
  <div class="tj ${compra ? 'compra' : ''}" data-id="${o.id}">
    <div class="tj-cab">
      <div class="tj-moneda">${logoMoneda(o.token)}</div>
      <div class="tj-q">
        <div class="tj-nom">${esc(nombre)}${(conRep || ventas > 0) ? `<span class="tj-ok" title="Con historial">✓</span>` : ''}</div>
        <div class="tj-red">${sim} · BEP-20</div>
      </div>
      <span class="tj-tag ${compra ? 'c' : 'v'}">${compra ? 'Compro' : 'Vendo'}</span>
    </div>

    <div class="tj-cifra">
      <b>${corto(monto)}</b><span>${sim}</span>
    </div>
    ${p1.v > 0 ? `<div class="tj-tasa">a <b>${corto(p1.v)}</b> ${esc(p1.m)} c/u</div>` : ''}
    ${(p1.v > 0 && total > 0) ? `<div class="tj-total">≈ <b>${corto(total)} ${esc(p1.m)}</b> en total</div>` : ''}
    ${otras.length ? `<div class="tj-otras">También: ${otras.map(x => `<b>${num(x.v, x.v >= 100 ? 0 : 2)}</b> ${esc(x.m)}`).join(' · ')}</div>` : ''}

    <div class="tj-pie">
      ${(conRep || ventas > 0)
        ? `<div class="tj-estrellas">${conRep ? `<span class="st">${'★'.repeat(Math.round(Number(rep.estrellasX100) / 100))}${'☆'.repeat(5 - Math.round(Number(rep.estrellasX100) / 100))}</span><b>${(Number(rep.estrellasX100) / 100).toFixed(1)}</b>` : ''}${ventas > 0 ? `<span class="ops">${ventas} ${ventas === 1 ? 'venta' : 'ventas'}</span>` : ''}</div>`
        : '<span class="nuevo">New · no history</span>'}
    </div>

    <button class="tj-btn${mio ? ' gris' : ''}" data-ver="${o.id}">${mio ? 'My listing' : (compra ? 'I want to sell' : 'Buy')}</button>
  </div>`;
}

function wireTarjetas() {
  document.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => verFicha(b.getAttribute('data-ver')));
}

/* ── Ficha completa (al tocar Comprar) ── */
async function verFicha(id) {
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  const d = document.createElement('div');
  d.id = 'mk-ficha'; d.className = 'mk-wiz-bg';
  d.innerHTML = `<div class="mk-wiz-c"><button class="mk-wiz-x" id="fc-x">✕</button><div class="mk-vacio">Cargando…</div></div>`;
  document.body.appendChild(d);
  const cerrar = () => d.remove();
  $('fc-x').onclick = cerrar;
  d.onclick = (e) => { if (e.target === d) cerrar(); };

  let o, perf, rep, ubic;
  try {
    o = await lee('ordenes', [id]);
    [perf, rep, ubic] = await Promise.all([
      lee('perfiles', [o.vendedor]).catch(() => null),
      lee('reputacionDe', [o.vendedor]).catch(() => null),
      lee('ubicacionDe', [o.vendedor]).catch(() => null)
    ]);
  } catch (_) { d.querySelector('.mk-wiz-c').innerHTML = `<button class="mk-wiz-x" id="fc-x2">✕</button><div class="mk-vacio">No se pudo cargar.</div>`; $('fc-x2').onclick = cerrar; return; }

  const compra = Number(o.tipo) === 1;
  const sim = simbolo(o.token);
  const monto = f18(o.monto);
  const tramos = Number(o.tramos) || 1;
  const nombre = (perf && perf.nombre) || 'Sin nombre';
  const conRep = rep && Number(rep.votos) > 0;
  const contactos = String((perf && perf.contacto) || '').split('·').map(x => x.trim()).filter(Boolean);
  const mio = cuenta && String(cuenta).toLowerCase() === String(o.vendedor).toLowerCase();
  const reservada = Number(o.estado) === 1;
  const miaReserva = reservada && cuenta && String(cuenta).toLowerCase() === String(o.comprador).toLowerCase();

  const iconoDe = (t) => {
    const l = t.toLowerCase();
    if (l.startsWith('telegram')) return ICOCT.Telegram;
    if (l.startsWith('whatsapp')) return ICOCT.WhatsApp;
    if (l.startsWith('tel')) return ICOCT['Phone'];
    return '•';
  };

  d.querySelector('.mk-wiz-c').innerHTML = `
    <button class="mk-wiz-x" id="fc-x3">✕</button>
    <div class="fc-h">
      <div class="tj-moneda grande">${logoMoneda(o.token)}</div>
      <div>
        <div class="fc-nom">${esc(nombre)}</div>
        ${(conRep || (rep && Number(rep.ventasOk) > 0) || (perf && perf.pais)) ? `<div class="fc-sub">${conRep ? `★ ${(Number(rep.estrellasX100) / 100).toFixed(1)} · ` : ''}${(rep && Number(rep.ventasOk) > 0) ? `${Number(rep.ventasOk)} sales · ` : ''}${(perf && perf.pais) ? esc(perf.pais) : ''}</div>` : ''}
      </div>
    </div>

    <div class="fc-hero"><span>${compra ? 'Wants to buy' : 'Selling'}</span><b>${num(monto, 2)} ${sim}</b><i>${sim} BEP-20 · Binance Smart Chain</i></div>

    <div class="fc-sec"><div class="fc-t">Acepta que le paguen</div>
      <div class="fc-chips">${String(o.moneda || '').split('·').filter(Boolean).map(p => {
        const t = p.trim().split(/\s+/);
        return `<span class="fc-chip oro"><b>${esc(t[1] || '')}</b> ${esc(t[0] || '')} por 1 ${sim}</span>`;
      }).join('')}</div>
      <div class="fc-chips">${String(o.metodo || '').split('·').filter(Boolean).map(p => `<span class="fc-chip">${esc(p.trim())}</span>`).join('')}</div>
    </div>

    ${compra ? '' : `<div class="fc-sec">
      <button class="fc-desp" id="fc-como">How this purchase works <span class="ar">▼</span></button>
      <div class="fc-pasos" id="fc-pasos" style="display:none">
        <div class="fc-p"><span>1</span>Te pones en contacto con ${esc(nombre)} por donde prefiera.</div>
        <div class="fc-p"><span>2</span>Their ${num(monto, 2)} ${sim} are already <b>locked here</b>: they can't take them.</div>
        <div class="fc-p"><span>3</span>You pay the first part (${num(monto / tramos, 2)} ${sim} equivalent). They confirm and it releases to you.</div>
        <div class="fc-p"><span>4</span>Se repite hasta completar las ${tramos} partes. Si algo falla, solo arriesgas una parte.</div>
      </div></div>`}

    <div class="fc-sec"><div class="fc-t">Cómo contactarlo</div>
      ${contactos.length ? `<div class="fc-cts">${contactos.map(c => `<div class="fc-ct"><span class="ic">${iconoDe(c)}</span>${esc(c)}</div>`).join('')}</div>`
        : `<div class="mk-hint">No dejó datos de contacto.</div>`}
      ${(perf && perf.horario) ? `<div class="mk-hint">Horario: <b>${esc(perf.horario)}</b></div>` : ''}
    </div>

    <div class="fc-sec"><div class="fc-t">Dónde está</div>
      <div id="fc-dist">${(ubic && ubic.comparte) ? `<div class="mk-hint">Zona: <b>${esc(ubic.zona || 'no indicada')}</b></div><button class="mk-b gris" id="fc-vd" style="margin-top:9px">Ver distancia hasta mí</button>` : `<div class="mk-hint">Esta persona no comparte su ubicación. Puedes pedírsela por el contacto: <b>si se niega, tú decides si sigues</b>.</div>`}</div>
    </div>

    ${reservada ? `<div class="fc-reser">
        <b>${miaReserva ? 'Ya la reservaste' : 'Reservada por otra persona'}</b>
        ${miaReserva ? 'Contacta ahora a esta persona por cualquiera de las vías de arriba y acuerden el pago. Después continúa desde la pestaña <b>Operaciones</b>.' : 'Si no la arranca en 24 horas, volverá a estar disponible.'}
      </div>` : ((!compra && !mio) ? `<button class="mk-b fc-cta" id="fc-tomar">Reservar esta compra</button>
      <div class="mk-hint" style="text-align:center;margin-top:7px">Queda apartada para ti <b>24 horas</b>. Si no la arrancas, vuelve a estar disponible.</div>` : '')}
    ${mio ? `<button class="mk-b gris fc-cta" id="fc-cancel">Cancelar mi publicación</button>` : ''}
    <div class="mk-msg info" id="fc-msg"></div>`;
  $('fc-x3').onclick = cerrar;
  const como = $('fc-como');
  if (como) como.onclick = () => {
    const p = $('fc-pasos');
    const ab = p.style.display === 'none';
    p.style.display = ab ? 'flex' : 'none';
    como.classList.toggle('open', ab);
  };

  const fmsg = (t, c) => { const m = $('fc-msg'); if (m) { m.className = 'mk-msg ' + (c || 'info'); m.textContent = t; } };
  if ($('fc-vd')) $('fc-vd').onclick = () => distanciaEn('fc-dist', o.vendedor, ubic);
  if ($('fc-tomar')) $('fc-tomar').onclick = async () => {
    if (!cuenta) { fmsg('Conecta tu wallet primero.', 'err'); return; }
    // El contrato exige perfil (para que el vendedor sepa quién eres y cómo contactarte)
    let miPerf = null;
    try { miPerf = await lee('perfiles', [cuenta]); } catch (_) {}
    if (!miPerf || !miPerf.existe) { cerrar(); pedirPerfilRapido(() => verFicha(o.id)); return; }
    try {
      fmsg('Confirma en tu wallet…', 'info');
      const c = new ethers.Contract(MARKET, ABI, await firmante());
      await (await c.tomarOrden(o.id, ARBITRO)).wait();
      cerrar(); msg('¡Reservada para ti por 24 horas! Contacta a la persona y ve a "Operaciones".', 'ok'); listarOfertas();
    } catch (e) { fmsg(traducir(e), 'err'); }
  };
  if ($('fc-cancel')) $('fc-cancel').onclick = async () => {
    try {
      fmsg('Confirma en tu wallet…', 'info');
      const c = new ethers.Contract(MARKET, ABI, await firmante());
      await (await c.cancelarOrden(o.id)).wait();
      cerrar(); msg('Publicación cancelada.', 'ok'); listarOfertas();
    } catch (e) { fmsg(traducir(e), 'err'); }
  };
}


/* ── Perfil rápido (lo necesita quien reserva, para que puedan contactarlo) ── */

/* ── Tomar / cancelar ── */
async function tomar(id) {
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  if (!cuenta) { msg('Conecta tu wallet primero.', 'err'); return; }
  try {
    msg('Confirma en tu wallet…', 'info');
    const c = new ethers.Contract(MARKET, ABI, await firmante());
    const tx = await c.tomarOrden(id, ARBITRO); await tx.wait();
    msg('¡Listo! Ya puedes pagar el primer tramo. Ve a "Mis operaciones".', 'ok');
    setTimeout(() => { listarOfertas(); }, 1200);
  } catch (e) { msg(traducir(e), 'err'); }
}
let ARBITRO = '0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d'; // árbitro por defecto (owner)

async function cancelar(id) {
  try {
    msg('Confirma en tu wallet…', 'info');
    const c = new ethers.Contract(MARKET, ABI, await firmante());
    const tx = await c.cancelarOrden(id); await tx.wait();
    msg('Oferta cancelada. Tu cripto volvió a tu wallet.', 'ok');
    listarOfertas();
  } catch (e) { msg(traducir(e), 'err'); }
}

/* ── Vender ── */
