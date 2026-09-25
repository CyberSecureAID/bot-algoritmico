/* market/asistente-compra.js — El panel de compra y su asistente paso a
   paso para PUBLICAR una solicitud de compra (el comprador arma su pedido
   y lo crea en el contrato). Recibe listarOfertas y lee por
   initAsistenteCompra. Extraído de market.js. */

import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';
import { firmante, esc, num, traducir } from './util.js?v=1';
import { marco, cerrarWiz, wmsg, msg } from './ui.js?v=1';
import { MARKET, USDT, USDC, ABI, COBROS, NOMBRE_MONEDA } from './config.js?v=1';
import { infoToken as _infoTok, esDireccion as _esDir } from '../gridbot/mercado.js?v=3';

const $ = (id) => document.getElementById(id);
let _listarOfertas = () => {}, _lee = async () => null;
export function initAsistenteCompra({ listarOfertas, lee }) { _listarOfertas = listarOfertas; _lee = lee; }

export async function panelComprar() {
  const box = $('mk-p5'); if (!box) return;
  const cuenta = wallet.cuentaActual && wallet.cuentaActual();
  if (!cuenta) { box.innerHTML = `<div class="mk-vacio">Conecta tu wallet para publicar que quieres comprar.</div>`; return; }
  box.innerHTML = `
  <div class="mk-box mk-lanza">
    <div class="lz-t">Todo listo para comprar</div>
    <div class="lz-d">Unas preguntas cortas y tu anuncio queda publicado.</div>
    <button class="mk-b" id="mk-abrir-cwiz">Quiero comprar</button>
  </div>`;
  if ($('mk-abrir-cwiz')) $('mk-abrir-cwiz').onclick = () => abrirAsistenteCompra();
}

let C = null;
export function abrirAsistenteCompra() {
  C = { token: USDT, tokSel: null, sim: 'USDT', cant: 0, cobros: [], datos: {}, monedas: [], precios: {}, contactos: {} };
  pasoC(1);
}
function pasoC(p) {
  if (p === 1) {
    marco(1, 5, 'What do you want to buy?', 'Paste the token contract, or pick a common one. Any BNB Smart Chain token works.',
      `<div class="wz-tok-find">
        <input id="cz-tok-addr" placeholder="0x… token contract address" autocomplete="off" spellcheck="false">
        <div class="wz-tok-msg" id="cz-tok-msg"></div>
      </div>
      <div class="wz-tok-quick">
        <button class="wz-op ${C.tokSel === USDT ? 'on' : ''}" data-ctok="${USDT}" data-csim="USDT"><b>USDT</b><span>Tether</span></button>
        <button class="wz-op ${C.tokSel === USDC ? 'on' : ''}" data-ctok="${USDC}" data-csim="USDC"><b>USDC</b><span>USD Coin</span></button>
      </div>`, { atras: false });
    const caddr = $('cz-tok-addr');
    if (caddr) caddr.oninput = async () => {
      const v = caddr.value.trim(); const msg = $('cz-tok-msg');
      document.querySelectorAll('[data-ctok]').forEach(x => x.classList.remove('on'));
      if (!_esDir(v)) { msg.textContent = v ? 'Enter a valid 0x… address' : ''; C.tokSel = null; return; }
      msg.textContent = 'Reading token…';
      try {
        const info = await _infoTok(v);
        if (info && info.simbolo) { C.tokSel = info.address; C.token = info.address; C.sim = info.simbolo; msg.innerHTML = `<span style="color:#34d399">Found: <b>${info.simbolo}</b> · ${info.nombre||''}</span>`; }
        else { msg.textContent = 'Token not found'; C.tokSel = null; }
      } catch (_) { msg.textContent = 'Could not read that token'; C.tokSel = null; }
    };
    document.querySelectorAll('[data-ctok]').forEach(b => b.onclick = () => {
      document.querySelectorAll('[data-ctok]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); C.tokSel = b.getAttribute('data-ctok'); C.token = C.tokSel; C.sim = b.getAttribute('data-csim');
    });
    $('wz-ok').onclick = () => { if (!C.tokSel) { wmsg('Elige qué quieres comprar.', 'err'); return; } pasoC(2); };
    return;
  }
  if (p === 2) {
    marco(2, 5, `How much ${C.sim} do you want to buy?`, 'The amount you are looking for.',
      `<div class="mk-step-in">
        <button type="button" class="mk-mm" data-cmm="-">−</button>
        <input id="cz-cant" type="text" inputmode="decimal" placeholder="0.00" value="${C.cant || ''}">
        <button type="button" class="mk-mm" data-cmm="+">+</button>
      </div>`);
    const inp = $('cz-cant');
    document.querySelectorAll('[data-cmm]').forEach(b => b.onclick = () => {
      let v = Number(String(inp.value || '').replace(',', '.')) || 0;
      v = b.getAttribute('data-cmm') === '+' ? v + 10 : Math.max(0, v - 10);
      inp.value = String(Math.round(v * 100) / 100);
    });
    $('wz-ok').onclick = () => {
      const v = Number(String(inp.value || '').replace(',', '.')) || 0;
      if (!(v > 0)) { wmsg('Escribe cuánto quieres comprar.', 'err'); return; }
      C.cant = v; pasoC(3);
    };
    $('wz-atras').onclick = () => pasoC(1);
    return;
  }
  if (p === 3) {
    marco(3, 5, 'How will you pay?', 'Check all the ways you can pay.',
      `<div class="wz-ops" id="cz-cobros">${COBROS.map(c =>
        `<button class="wz-op ${C.cobros.includes(c.id) ? 'on' : ''}" data-cco="${c.id}"><b>${c.nom}</b><span>${c.desc}</span></button>`).join('')}</div>`);
    document.querySelectorAll('[data-cco]').forEach(b => b.onclick = () => {
      const id = b.getAttribute('data-cco'); b.classList.toggle('on');
      C.cobros = C.cobros.includes(id) ? C.cobros.filter(x => x !== id) : [...C.cobros, id];
    });
    $('wz-ok').onclick = () => {
      if (C.cobros.length === 0) { wmsg('Marca al menos una forma de pago.', 'err'); return; }
      C.posibles = [...new Set(C.cobros.flatMap(id => (COBROS.find(c => c.id === id) || {}).monedas || []))];
      C.monedas = C.monedas.filter(m => C.posibles.includes(m));
      pasoC(4);
    };
    $('wz-atras').onclick = () => pasoC(2);
    return;
  }
  if (p === 4) {
    marco(4, 5, 'Which currency and at what rate?', 'Pick the currency and set what you are willing to pay.',
      `<div class="wz-ops chicas" id="cz-monedas">${(C.posibles || []).map(m =>
        `<button class="wz-op ${C.monedas.includes(m) ? 'on' : ''}" data-cmo="${m}"><b>${m}</b><span>${NOMBRE_MONEDA[m] || ''}</span></button>`).join('')}
        <button class="wz-op ${C.otraMon ? 'on' : ''}" id="cz-otra"><b>Otra</b><span>Escríbela tú</span></button></div>
       <div id="cz-otra-box"></div>
       <div id="cz-precios"></div>`);
    const pintarOtraC = () => {
      const b = $('cz-otra-box');
      b.innerHTML = $('cz-otra').classList.contains('on')
        ? `<label>¿Cuál moneda?</label><input id="cz-otra-in" maxlength="10" placeholder="Ej: CAD" value="${esc(C.otraMon || '')}">` : '';
      const i = $('cz-otra-in');
      if (i) i.oninput = () => {
        const antes = C.otraMon;
        C.otraMon = i.value.toUpperCase().trim();
        C.monedas = C.monedas.filter(x => x !== antes);
        if (C.otraMon) C.monedas = [...C.monedas, C.otraMon];
        pintar();
      };
    };
    $('cz-otra').onclick = () => {
      $('cz-otra').classList.toggle('on');
      if (!$('cz-otra').classList.contains('on')) { C.monedas = C.monedas.filter(x => x !== C.otraMon); C.otraMon = ''; pintar(); }
      pintarOtraC();
    };
    const pintar = () => {
      $('cz-precios').innerHTML = C.monedas.map(m => `<label>¿Cuántos <b>${m}</b> pagas por cada <b>1 ${C.sim}</b>?</label>
        <input class="cz-precio" data-cmo="${m}" type="text" inputmode="decimal" placeholder="${['USD','MLC','EUR'].includes(m) ? 'Ej: 1.05' : 'Ej: 380'}" value="${C.precios[m] || ''}">`).join('');
      document.querySelectorAll('.cz-precio').forEach(i => i.oninput = () => { C.precios[i.getAttribute('data-cmo')] = i.value; });
    };
    document.querySelectorAll('[data-cmo]').forEach(b => b.onclick = () => {
      const m = b.getAttribute('data-cmo'); b.classList.toggle('on');
      C.monedas = C.monedas.includes(m) ? C.monedas.filter(x => x !== m) : [...C.monedas, m];
      pintar();
    });
    pintar(); pintarOtraC();
    $('wz-ok').onclick = () => {
      if (C.monedas.length === 0) { wmsg('Marca al menos una moneda.', 'err'); return; }
      for (const m of C.monedas) { if (!(Number(String(C.precios[m] || '').replace(',', '.')) > 0)) { wmsg(`Falta el precio para ${m}.`, 'err'); return; } }
      pasoC(5);
    };
    $('wz-atras').onclick = () => pasoC(3);
    return;
  }
  if (p === 5) {
    const VIAS = [{ id: 'Telegram', lab: 'Usuario de Telegram', ph: '@tuusuario' }, { id: 'WhatsApp', lab: 'WhatsApp (opcional)', ph: '+53 5xxxxxxx' }];
    marco(5, 5, 'How do they contact you?', 'So sellers can reach you.',
      VIAS.map(v => `<label>${v.lab}</label><input class="cz-ct" data-cct="${v.id}" maxlength="40" placeholder="${v.ph}" value="${esc(C.contactos[v.id] || '')}">`).join(''),
      { seguir: 'Publicar anuncio' });
    document.querySelectorAll('.cz-ct').forEach(i => i.oninput = () => { C.contactos[i.getAttribute('data-cct')] = i.value; });
    $('wz-ok').onclick = publicarCompra;
    $('wz-atras').onclick = () => pasoC(4);
    return;
  }
}

async function publicarCompra() {
  const hay = Object.values(C.contactos).filter(v => String(v || '').trim()).length;
  if (hay === 0) { wmsg('Pon al menos una forma de contacto.', 'err'); return; }
  const moneda = C.monedas.map(m => `${m} ${Number(String(C.precios[m]).replace(',', '.'))}`).join(' · ').slice(0, 160);
  const metodo = C.cobros.join(' · ').slice(0, 160);
  const primero = Number(String(C.precios[C.monedas[0]]).replace(',', '.')) || 0;
  const btn = $('wz-ok'); if (btn) btn.disabled = true;
  try {
    const signer = await firmante();
    const cuenta = await signer.getAddress();
    const c = new ethers.Contract(MARKET, ABI, signer);
    const cts = Object.entries(C.contactos).filter(([, v]) => String(v || '').trim()).map(([k, v]) => `${k}: ${String(v).trim()}`).join(' · ').slice(0, 200);
    const p = await _lee('perfiles', [cuenta]).catch(() => null);
    if (!p || !p.existe || p.contacto !== cts) {
      wmsg('Guardando tus datos…', 'info');
      await (await c.guardarPerfil((p && p.nombre) || 'Comprador', (p && p.pais) || '', C.monedas[0] || 'USD', cts)).wait();
    }
    const fee = await _lee('comisionBnb');
    wmsg('Confirma la publicación (1 USD en BNB)…', 'info');
    await (await c.crearAnuncioCompra(C.token, ethers.parseUnits(String(C.cant), 18), moneda, metodo, Math.round(primero * 100), { value: fee })).wait();
    cerrarWiz();
    msg('¡Anuncio publicado! Los vendedores ya pueden verte.', 'ok');
    $('mk-t1').click(); _listarOfertas();
  } catch (e) { wmsg(traducir(e), 'err'); if (btn) btn.disabled = false; }
}
