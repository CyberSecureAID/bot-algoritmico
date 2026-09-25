/* market/asistente-venta.js — El asistente paso a paso para PUBLICAR una
   oferta de venta (el vendedor arma su anuncio, deposita fianza y crea la
   orden en el contrato). Recibe listarOfertas y lee por initAsistenteVenta
   para no acoplar con el panel. Extraído de market.js. */

import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';
import { firmante, esc, f18, num, traducir } from './util.js?v=1';
import { marco, cerrarWiz, wmsg, msg } from './ui.js?v=1';
import { guardarUbic, pedirUbicacion, compartirUbicacion } from './ubicacion.js?v=1';
import { MARKET, USDT, USDC, ABI, ERC20, RPCS, COBROS, NOMBRE_MONEDA } from './config.js?v=1';
import { infoToken as _infoTok, esDireccion as _esDir } from '../gridbot/mercado.js?v=3';

const $ = (id) => document.getElementById(id);
let _listarOfertas = () => {}, _lee = async () => null;
export function initAsistenteVenta({ listarOfertas, lee }) { _listarOfertas = listarOfertas; _lee = lee; }

let W = null;   // datos que va armando el asistente

export function abrirAsistente() {
  W = { token: USDT, tokSel: null, sim: 'USDT', cant: 0, tramos: 5, cobros: [], datos: {}, monedas: [], precios: {}, contactos: {}, horario: '' };
  pintarPaso(1);
}

/* Paso 1 · Qué vendes */
function pintarPaso(p) {
  if (p === 1) {
    marco(1, 8, 'What are you selling?', 'Paste the token contract, or pick a common one. Any BNB Smart Chain token works.',
      `<div class="wz-tok-find">
        <input id="wz-tok-addr" placeholder="0x… token contract address" autocomplete="off" spellcheck="false" value="${W.tokSel && _esDir(W.tokSel) && W.sim!=='USDT' && W.sim!=='USDC' ? W.tokSel : ''}">
        <div class="wz-tok-msg" id="wz-tok-msg"></div>
      </div>
      <div class="wz-tok-quick">
        <button class="wz-op ${W.tokSel === USDT ? 'on' : ''}" data-tok="${USDT}" data-sim="USDT"><b>USDT</b><span>Tether</span></button>
        <button class="wz-op ${W.tokSel === USDC ? 'on' : ''}" data-tok="${USDC}" data-sim="USDC"><b>USDC</b><span>USD Coin</span></button>
      </div>`, { atras: false });
    // atajos rápidos (USDT/USDC)
    document.querySelectorAll('[data-tok]').forEach(b => b.onclick = () => {
      document.querySelectorAll('[data-tok]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); W.tokSel = b.getAttribute('data-tok'); W.token = W.tokSel; W.sim = b.getAttribute('data-sim');
      const a = $('wz-tok-addr'); if (a) a.value = ''; const m = $('wz-tok-msg'); if (m) m.textContent = '';
    });
    // pegar cualquier contrato → leer el token de la cadena
    const addr = $('wz-tok-addr');
    if (addr) addr.oninput = async () => {
      const v = addr.value.trim(); const msg = $('wz-tok-msg');
      document.querySelectorAll('[data-tok]').forEach(x => x.classList.remove('on'));
      if (!_esDir(v)) { msg.textContent = v ? 'Enter a valid 0x… address' : ''; W.tokSel = null; return; }
      msg.textContent = 'Reading token…';
      try {
        const info = await _infoTok(v);
        if (info && info.simbolo) {
          W.tokSel = info.address; W.token = info.address; W.sim = info.simbolo;
          msg.innerHTML = `<span style="color:#34d399">Found: <b>${info.simbolo}</b> · ${info.nombre||''}</span>`;
        } else { msg.textContent = 'Token not found on BNB Smart Chain'; W.tokSel = null; }
      } catch (_) { msg.textContent = 'Could not read that token'; W.tokSel = null; }
    };
    $('wz-ok').onclick = () => { if (!W.tokSel) { wmsg('Choose or paste what you want to sell.', 'err'); return; } pintarPaso(2); };
    return;
  }

  /* Paso 2 · Cuánto */
  if (p === 2) {
    marco(2, 8, `¿Cuánto ${W.sim} vas a vender?`, 'Enter the total amount. We will split it into parts.',
      `<div class="mk-step-in">
        <button type="button" class="mk-mm" data-mm="-">−</button>
        <input id="wz-cant" type="text" inputmode="decimal" placeholder="0.00" value="${W.cant || ''}">
        <button type="button" class="mk-mm" data-mm="+">+</button>
      </div>
      <div class="mk-hint" id="wz-saldo">Consultando tu saldo…</div>`);
    const inp = $('wz-cant');
    document.querySelectorAll('[data-mm]').forEach(b => b.onclick = () => {
      let v = Number(String(inp.value || '').replace(',', '.')) || 0;
      v = b.getAttribute('data-mm') === '+' ? v + 10 : Math.max(0, v - 10);
      inp.value = String(Math.round(v * 100) / 100);
    });
    // saldo real, para no fallar al publicar
    (async () => {
      try {
        const cuenta = wallet.cuentaActual();
        const t = new ethers.Contract(W.token, ERC20, new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }));
        const bal = f18(await t.balanceOf(cuenta));
        W.saldo = bal;
        const el = $('wz-saldo');
        if (el) el.innerHTML = `Tienes <b>${num(bal, 2)} ${W.sim}</b> en tu wallet. <button type="button" class="mk-rp" id="wz-todo">Vender todo</button>`;
        const td = $('wz-todo'); if (td) td.onclick = () => { inp.value = String(Math.floor(bal * 100) / 100); };
      } catch (_) { const el = $('wz-saldo'); if (el) el.textContent = 'No se pudo leer tu saldo.'; }
    })();
    $('wz-ok').onclick = () => {
      const v = Number(String(inp.value || '').replace(',', '.')) || 0;
      if (!(v > 0)) { wmsg('Enter how much you will sell.', 'err'); return; }
      if (W.saldo !== undefined && v > W.saldo) { wmsg(`Solo tienes ${num(W.saldo, 2)} ${W.sim} en tu wallet.`, 'err'); return; }
      W.cant = v; pintarPaso(3);
    };
    $('wz-atras').onclick = () => pintarPaso(1);
    return;
  }

  /* Paso 3 · Partes */
  if (p === 3) {
    const ops = [10, 5, 4, 3, 2];
    marco(3, 8, 'Split your sale into parts',
      'Your funds are <b>not released all at once</b>. They go out in parts: you get paid for one, confirm, and it releases. So if someone tries to scam you, <b>they can only reach one part</b>.',
      `<div class="wz-ops chicas" id="wz-tramos">${ops.map(t =>
        `<button class="wz-op ${W.tramos === t ? 'on' : ''}" data-tr="${t}"><b>${t} partes</b><span>${t === 5 ? 'Recomendado' : (t === 10 ? 'Maximum safety' : (t === 2 ? 'Minimum' : '&nbsp;'))}</span></button>`).join('')}</div>
      <div class="wz-resumen" id="wz-escala"></div>`);
    const pintar = () => {
      const por = W.cant / W.tramos;
      $('wz-escala').innerHTML = `Cada parte será de <b>${num(por, 2)} ${W.sim}</b>. Si algo saliera mal, lo máximo en riesgo es esa parte, no los ${num(W.cant, 2)}.`;
    };
    document.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => {
      document.querySelectorAll('[data-tr]').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); W.tramos = Number(b.getAttribute('data-tr')); pintar();
    });
    pintar();
    $('wz-ok').onclick = () => pintarPaso(4);
    $('wz-atras').onclick = () => pintarPaso(2);
    return;
  }

  /* Paso 4 · Cómo te pagan (el método manda) */
  if (p === 4) {
    marco(4, 8, 'How do you want to get paid?', 'Marca todas las formas que aceptes. Puedes elegir varias.',
      `<div class="wz-ops" id="wz-cobros">${COBROS.map(c =>
        `<button class="wz-op ${W.cobros.includes(c.id) ? 'on' : ''}" data-co="${c.id}"><b>${c.nom}</b><span>${c.desc}</span></button>`).join('')}</div>
      <div id="wz-datos"></div>`);
    const pintarDatos = () => {
      const box = $('wz-datos');
      const conDato = COBROS.filter(c => W.cobros.includes(c.id) && c.pideDato);
      box.innerHTML = conDato.map(c => `<label>${c.nom}: ${c.pideDato}</label>
        <input class="wz-dato" data-co="${c.id}" maxlength="24" value="${esc(W.datos[c.id] || '')}" placeholder="${c.id === 'Transferencia' ? 'e.g. bank transfer, cash' : 'Ej: Binance Pay'}">`).join('');
      document.querySelectorAll('.wz-dato').forEach(i => i.oninput = () => { W.datos[i.getAttribute('data-co')] = i.value; });
    };
    document.querySelectorAll('[data-co]').forEach(b => b.onclick = () => {
      const id = b.getAttribute('data-co');
      b.classList.toggle('on');
      W.cobros = W.cobros.includes(id) ? W.cobros.filter(x => x !== id) : [...W.cobros, id];
      pintarDatos();
    });
    pintarDatos();
    $('wz-ok').onclick = () => {
      if (W.cobros.length === 0) { wmsg('Marca al menos una forma de pago.', 'err'); return; }
      // monedas posibles según los métodos elegidos
      const posibles = [...new Set(W.cobros.flatMap(id => (COBROS.find(c => c.id === id) || {}).monedas || []))];
      W.posibles = posibles;
      W.monedas = W.monedas.filter(m => posibles.includes(m));
      pintarPaso(5);
    };
    $('wz-atras').onclick = () => pintarPaso(3);
    return;
  }

  /* Paso 5 · En qué moneda */
  if (p === 5) {
    marco(5, 8, 'Which currency do they pay you in?', 'Based on your choice, these make sense. Check the ones you accept.',
      `<div class="wz-ops chicas" id="wz-monedas">${(W.posibles || []).map(m =>
        `<button class="wz-op ${W.monedas.includes(m) ? 'on' : ''}" data-mo="${m}"><b>${m}</b><span>${NOMBRE_MONEDA[m] || ''}</span></button>`).join('')}
        <button class="wz-op ${W.otraMon ? 'on' : ''}" id="wz-otra"><b>Otra</b><span>Escríbela tú</span></button></div>
      <div id="wz-otra-box"></div>`);
    const pintarOtra = () => {
      const b = $('wz-otra-box');
      b.innerHTML = $('wz-otra').classList.contains('on')
        ? `<label>¿Cuál moneda?</label><input id="wz-otra-in" maxlength="10" placeholder="Ej: CAD" value="${esc(W.otraMon || '')}">` : '';
      const i = $('wz-otra-in'); if (i) i.oninput = () => { W.otraMon = i.value.toUpperCase().trim(); };
    };
    $('wz-otra').onclick = () => { $('wz-otra').classList.toggle('on'); if (!$('wz-otra').classList.contains('on')) W.otraMon = ''; pintarOtra(); };
    pintarOtra();
    document.querySelectorAll('[data-mo]').forEach(b => b.onclick = () => {
      const m = b.getAttribute('data-mo');
      b.classList.toggle('on');
      W.monedas = W.monedas.includes(m) ? W.monedas.filter(x => x !== m) : [...W.monedas, m];
    });
    $('wz-ok').onclick = () => {
      if (W.otraMon && !W.monedas.includes(W.otraMon)) W.monedas = [...W.monedas.filter(m => (W.posibles || []).includes(m)), W.otraMon];
      if (W.monedas.length === 0) { wmsg('Marca al menos una moneda.', 'err'); return; }
      pintarPaso(6);
    };
    $('wz-atras').onclick = () => pintarPaso(4);
    return;
  }

  /* Paso 6 · Precio de cada moneda */
  if (p === 6) {
    marco(6, 8, 'At what price do you sell?', 'Pon tu precio para cada moneda que aceptas.',
      W.monedas.map(m => `<label>¿Cuántos <b>${m}</b> por cada <b>1 ${W.sim}</b>?</label>
        <input class="wz-precio" data-mo="${m}" type="text" inputmode="decimal" placeholder="${['USD','MLC','EUR'].includes(m) ? 'Ej: 1.10' : 'Ej: 390'}" value="${W.precios[m] || ''}">
        <div class="mk-hint">${['USD','MLC','EUR'].includes(m) ? `At par put <b>1.00</b>; higher, <b>1.10</b>, <b>1.20</b>…` : `Today's rate.`}</div>`).join(''),
      );
    document.querySelectorAll('.wz-precio').forEach(i => i.oninput = () => { W.precios[i.getAttribute('data-mo')] = i.value; });
    $('wz-ok').onclick = () => {
      for (const m of W.monedas) {
        const v = Number(String(W.precios[m] || '').replace(',', '.')) || 0;
        if (!(v > 0)) { wmsg(`Falta el precio para ${m}.`, 'err'); return; }
      }
      pintarPaso(7);
    };
    $('wz-atras').onclick = () => pintarPaso(5);
    return;
  }

  /* Paso 7 · Cómo te contactan (OBLIGATORIO) */
  if (p === 7) {
    const VIAS = [
      { id: 'Telegram', lab: 'Usuario de Telegram', ph: '@tuusuario' },
      { id: 'WhatsApp', lab: 'WhatsApp number (optional)', ph: '+53 5xxxxxxx' },
      { id: 'Teléfono', lab: 'Phone for calls (optional)', ph: 'Suele ser el mismo de WhatsApp' }
    ];
    marco(7, 8, 'How should buyers contact you?', 'Add at least one. Without it, nobody can close a deal with you.',
      VIAS.map(v => `<label>${v.lab}</label><input class="wz-ct" data-ct="${v.id}" maxlength="40" placeholder="${v.ph}" value="${esc(W.contactos[v.id] || '')}">`).join('') +
      `<label>¿En qué horario prefieres que te escriban? <span class="op">(opcional)</span></label>
       <div class="mk-sel wz-sel"><select id="wz-hora-sel">
         <option value="">Elige uno…</option>
         ${['A cualquier hora', 'Mornings (9am to 1pm)', 'Tardes (1pm a 7pm)', 'Noches (7pm a 11pm)', '9am a 9pm'].map(h => `<option${W.horario === h ? ' selected' : ''}>${h}</option>`).join('')}
       </select></div>
       <input id="wz-hora" maxlength="40" placeholder="O escríbelo con tus palabras" value="${esc(W.horario || '')}" style="margin-top:8px">
       <label>Nota para quien te compre <span class="op">(opcional)</span></label>
       <input id="wz-nota" maxlength="60" placeholder="Ej: solo trato por Telegram, respondo rápido" value="${esc(W.nota || '')}">
       <div class="mk-hint">Una aclaración o sugerencia para la persona que te vaya a comprar.</div>`);
    const hs = $('wz-hora-sel'); if (hs) hs.onchange = () => { if (hs.value) { $('wz-hora').value = hs.value; W.horario = hs.value; } };
    const nt = $('wz-nota'); if (nt) nt.oninput = () => { W.nota = nt.value; };
    document.querySelectorAll('.wz-ct').forEach(i => i.oninput = () => { W.contactos[i.getAttribute('data-ct')] = i.value; });
    const h = $('wz-hora'); if (h) h.oninput = () => { W.horario = h.value; };
    $('wz-ok').onclick = () => {
      const hay = Object.values(W.contactos).filter(v => String(v || '').trim()).length;
      if (hay === 0) { wmsg('Pon al menos una forma de contacto.', 'err'); return; }
      pintarPaso(8);
    };
    $('wz-atras').onclick = () => pintarPaso(6);
    return;
  }

  /* Paso 8 · Ubicación (opcional) y publicar */
  if (p === 8) {
    marco(8, 8, 'Your location (optional)', 'Sharing it builds trust: buyers will see your area and how far away it is.',
      `<button class="fc-desp" id="wz-mas">¿Cómo funciona esto? <span class="ar">▼</span></button>
       <div id="wz-mas-box"></div>
       <div class="wz-ops" style="margin-top:12px">
         <button class="wz-op ${W.compartirU ? 'on' : ''}" id="wz-si-u"><b>Sí, compartir mi zona</b><span>Se guarda redondeada, sin tu dirección exacta</span></button>
         <button class="wz-op ${W.compartirU === false ? 'on' : ''}" id="wz-no-u"><b>No, ahora no</b><span>Puedes activarlo después</span></button>
       </div>`, { seguir: 'Publicar oferta' });
    $('wz-mas').onclick = () => {
      const b = $('wz-mas-box');
      $('wz-mas').classList.toggle('open', !b.innerHTML);
      b.innerHTML = b.innerHTML ? '' : `<div class="mk-hint" style="margin-top:10px">Guardamos tu posición <b>redondeada a 1 km aprox.</b>, nunca tu dirección exacta. Sirve para que la otra persona vea tu zona y la distancia. Es <b>opcional</b> y la puedes quitar cuando quieras. Quien no la comparte, suele generar más dudas.</div>`;
    };
    $('wz-si-u').onclick = () => { W.compartirU = true; $('wz-si-u').classList.add('on'); $('wz-no-u').classList.remove('on'); };
    $('wz-no-u').onclick = () => { W.compartirU = false; $('wz-no-u').classList.add('on'); $('wz-si-u').classList.remove('on'); };
    $('wz-ok').onclick = publicarWiz;
    $('wz-atras').onclick = () => pintarPaso(7);
    return;
  }
}

async function publicarWiz() {
  const moneda = W.monedas.map(m => `${m} ${Number(String(W.precios[m]).replace(',', '.'))}`).join(' · ').slice(0, 160);
  const metodo = W.cobros.map(id => {
    const d = (W.datos[id] || '').trim();
    return d ? `${id} (${d})` : id;
  }).join(' · ').slice(0, 160);
  const primero = Number(String(W.precios[W.monedas[0]]).replace(',', '.')) || 0;

  const btn = $('wz-ok'); if (btn) btn.disabled = true;
  try {
    const signer = await firmante();
    const cuenta = await signer.getAddress();
    const c0 = new ethers.Contract(MARKET, ABI, signer);

    // Guardar contactos (con su plataforma) y horario en el perfil
    const cts = Object.entries(W.contactos).filter(([, v]) => String(v || '').trim())
      .map(([k, v]) => `${k}: ${String(v).trim()}`).join(' · ').slice(0, 200);
    const p = await _lee('perfiles', [cuenta]).catch(() => null);
    if (cts && (!p || p.contacto !== cts)) {
      wmsg('Guardando tus datos de contacto…', 'info');
      await (await c0.guardarPerfil(p && p.nombre ? p.nombre : 'Usuario', (p && p.pais) || '', (p && p.moneda) || W.monedas[0] || '', cts)).wait();
    }
    const hn = [W.horario, W.nota].filter(Boolean).join(' · ').slice(0, 40);
    if (hn && (!p || p.horario !== hn)) {
      try { wmsg('Guardando tus preferencias…', 'info'); await (await c0.guardarHorario(hn)).wait(); } catch (_) {}
    }
    const monto = ethers.parseUnits(String(W.cant), 18);
    if (monto % BigInt(W.tramos) !== 0n) { wmsg('Cambia un poco la cantidad: no se divide exacta entre las partes.', 'err'); btn.disabled = false; return; }

    const t = new ethers.Contract(W.token, ERC20, signer);
    const bal = await t.balanceOf(cuenta);
    if (bal < monto) { wmsg(`No te alcanza: tienes ${num(f18(bal), 2)} ${W.sim}.`, 'err'); btn.disabled = false; return; }

    wmsg('Revisando permiso del token…', 'info');
    if ((await t.allowance(cuenta, MARKET)) < monto) {
      wmsg('Aprueba el token en tu wallet…', 'info');
      await (await t.approve(MARKET, monto)).wait();
    }
    const fee = await _lee('comisionBnb');
    wmsg('Confirm the listing (1 USD in BNB)…', 'info');
    const c = new ethers.Contract(MARKET, ABI, signer);
    await (await c.crearOrden(W.token, monto, W.tramos, moneda, metodo, Math.round(primero * 100), { value: fee })).wait();
    // Ubicación, si la aceptó
    if (W.compartirU) {
      try {
        wmsg('Guardando tu zona…', 'info');
        const u = await pedirUbicacion();
        guardarUbic(cuenta, u.lat, u.lon);
        let zona = '';
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${u.lat}&lon=${u.lon}&zoom=10`, { headers: { 'Accept-Language': 'es' } });
          const j = await r.json(); const a = j.address || {};
          zona = [a.city || a.town || a.village || a.county || a.state, a.country].filter(Boolean).join(', ').slice(0, 40);
        } catch (_) {}
        await (await c0.compartirUbicacion(Math.round(u.lat * 1000), Math.round(u.lon * 1000), zona)).wait();
      } catch (_) {}
    }
    cerrarWiz();
    msg('Offer published! Everyone can see it now.', 'ok');
    $('mk-t1').click(); _listarOfertas();
  } catch (e) { wmsg(traducir(e), 'err'); if (btn) btn.disabled = false; }
}

/* ── Comprar: publicar un anuncio de compra ── */
