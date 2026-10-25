/* terminal/compra.js. Compra y venta de un token desde la Terminal (modulo sellado).
   Ventana con el MISMO aspecto que nuestro swap (tarjetas You pay / You receive, pildoras de moneda,
   boton verde), con dos pestañas: Buy (BNB -> token) y Sell (token -> BNB). Por debajo va al contrato
   Terminal (PancakeSwap V2), que retiene el 1% y entrega directo a la wallet del usuario.
   No custodial: nada se queda en ningun sitio. Lecturas por RPC con rotacion; la firma por la wallet.
   Todo en consola con [TERM-BUY]. */

import * as ethers from './ethers.min.js';
import * as wallet from './wallet.js';
import { TERMINAL, WBNB, USDT, SCAN_URL, SLIPPAGE, PRESETS_BNB } from './config.js';
import { referidorGuardado } from './referidos.js';
import { conRotacion } from './rpc.js';
import { precioBNBUSDT } from './motor.js';
import { registrarCompra, registrarVenta } from './posiciones.js';

const log = (...a) => { try { console.info('[TERM-BUY]', ...a); } catch (_) {} };
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const $ = (id) => document.getElementById(id);

const ABI = [
  'function comprar(address token, address quote, uint256 minOut, uint256 deadline, address referidor) payable',
  'function vender(address token, address quote, uint256 cantidad, uint256 minOut, uint256 deadline, address referidor)',
  'function cotizarCompra(address token, address quote, uint256 bnbIn) view returns (uint256 tokOut, uint256 comision)',
  'function cotizarVenta(address token, address quote, uint256 tokIn) view returns (uint256 bnbBruto, uint256 bnbNeto, uint256 comision)'
];
const ERC20 = ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'];
/* Logo de BNB: la misma imagen de CoinGecko que usa nuestro swap. */
const LOGO_BNB = 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png';

/* ── RPC con rotacion (lecturas) y firmante (escritura) ── */
function inyectado() {
  try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); if (p) return p; } catch (_) {}
  if (typeof window !== 'undefined' && window.ethereum) return window.ethereum;
  throw new Error('No wallet');
}
async function firmante() { return new ethers.BrowserProvider(inyectado()).getSigner(); }

/* quote del par: WBNB o USDT (el contrato elige la ruta). Un par contra USDT va BNB -> USDT -> token. */
function quoteDe(it) { return it && it.quote && String(it.quote).toLowerCase() === USDT.toLowerCase() ? USDT : WBNB; }

/* ── Lecturas ── */
export async function cotizarCompra(token, quote, bnbWei) {
  const r = await conRotacion((p) => new ethers.Contract(TERMINAL, ABI, p).cotizarCompra(token, quote, bnbWei));
  return { tokOut: r[0], comision: r[1] };
}
export async function cotizarVenta(token, quote, tokWei) {
  const r = await conRotacion((p) => new ethers.Contract(TERMINAL, ABI, p).cotizarVenta(token, quote, tokWei));
  return { bruto: r[0], neto: r[1], comision: r[2] };
}
export async function saldoBNB(cuenta) { return conRotacion((p) => p.getBalance(cuenta)); }
export async function saldoToken(token, cuenta) { return conRotacion((p) => new ethers.Contract(token, ERC20, p).balanceOf(cuenta)); }
export async function permisoToken(token, cuenta) { return conRotacion((p) => new ethers.Contract(token, ERC20, p).allowance(cuenta, TERMINAL)); }

/* ── Escrituras: estimateGas primero (revela el motivo del revert antes de firmar), luego la tx ── */
async function enviar(fnEstimar, fnTx) {
  const est = await fnEstimar();
  const tx = await fnTx(est + est * 35n / 100n);
  log('tx enviada', tx.hash);
  const rc = await tx.wait();
  if (!rc || rc.status !== 1) throw new Error('La transaccion fallo');
  return rc;
}
export async function comprar({ token, quote, bnbWei, minOut }) {
  const c = new ethers.Contract(TERMINAL, ABI, await firmante());
  const dl = Math.floor(Date.now() / 1000) + 180;
  const ref = referidorGuardado() || ethers.ZeroAddress;
  return enviar(() => c.comprar.estimateGas(token, quote, minOut, dl, ref, { value: bnbWei }), (g) => c.comprar(token, quote, minOut, dl, ref, { value: bnbWei, gasLimit: g }));
}
export async function aprobar(token, cantidad) {
  const t = new ethers.Contract(token, ERC20, await firmante());
  return enviar(() => t.approve.estimateGas(TERMINAL, cantidad), (g) => t.approve(TERMINAL, cantidad, { gasLimit: g }));
}
export async function vender({ token, quote, cantidad, minOut }) {
  const c = new ethers.Contract(TERMINAL, ABI, await firmante());
  const dl = Math.floor(Date.now() / 1000) + 180;
  const ref = referidorGuardado() || ethers.ZeroAddress;
  return enviar(() => c.vender.estimateGas(token, quote, cantidad, minOut, dl, ref), (g) => c.vender(token, quote, cantidad, minOut, dl, ref, { gasLimit: g }));
}

/* ── Formato ── */
const fmtP = (p, sig = 4) => { if (!(p > 0)) return '0'; if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 4 }); const z = Math.floor(-Math.log10(p)); return p.toFixed(Math.min(18, z + sig)).replace(/\.?0+$/, ''); };
const numC = (v) => (v >= 1e6 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toLocaleString('en-US', { maximumFractionDigits: v >= 1 ? 4 : 8 }));
const fmtBNB = (w, d = 6) => (+ethers.formatEther(w)).toFixed(d).replace(/\.?0+$/, '') || '0';
const TW = (a) => { try { return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/' + ethers.getAddress(a) + '/logo.png'; } catch (_) { return ''; } };

/* Marca del token: monograma con sus iniciales sobre un anillo de color derivado del contrato (siempre
   el mismo para el mismo token). Propio, sin emoji, sin logo ajeno. Si Trust Wallet tiene su logo, aparece encima. */
function tono(addr) { let h = 0; const s = String(addr || '').toLowerCase(); for (let i = 2; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; }
function marcaToken(it) {
  const sim = String(it.simbolo || '?').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const ini = sim.length >= 2 ? sim.slice(0, 2) : (sim || '?');
  const h = tono(it.token);
  const src = TW(it.token);
  return `<span class="tmc-ico tmc-mono" style="--h:${h}"><span class="tmc-fb">${esc(ini)}</span>${src ? `<img src="${esc(src)}" alt="" onload="this.parentElement.classList.add('conlogo')" onerror="this.style.display='none'">` : ''}</span>`;
}
const marcaBNB = () => `<span class="tmc-ico tmc-bnb"><span class="tmc-fb">B</span><img src="${LOGO_BNB}" alt="" onload="this.parentElement.classList.add('conlogo')" onerror="this.style.display='none'"></span>`;

/* ── Ventana de compra y venta ──
   it: item del feed (token, simbolo, nombre, decimales, quote). aud: resultado de la auditoria
   ({nivel}) o null. Con nivel 'bad' la compra queda bloqueada (vender si se permite: salir siempre se puede). */
export function abrirCompra(it, aud, modoInicial) {
  if (!it) return;
  const prev = $('tmc-ov'); if (prev) prev.remove();
  const sym = esc(it.simbolo || 'TOKEN');
  const dec = Number(it.decimales) || 18;
  const quote = quoteDe(it);
  const nivel = aud && aud.nivel ? aud.nivel : 'pend';
  let modo = (modoInicial === 'sell') ? 'sell' : 'buy';   // 'buy' | 'sell'
  let bnbUsd = 0, saldo = null, saldoTok = null, permiso = 0n, slipBps = SLIPPAGE.porDefecto;
  let cot = null, cotPara = 0n, ocupado = false, firmando = false, mensaje = false;

  const ov = document.createElement('div'); ov.id = 'tmc-ov'; ov.className = 'tmc-ov';
  ov.innerHTML = `<div class="tmc-card" role="dialog" aria-modal="true">
      <div class="tmc-head">
        <div class="tmc-tt">${marcaToken(it)}<div class="tmc-tt-tx"><b>${esc(it.nombre || 'Token')}</b><span>${sym} · PancakeSwap ${quote === USDT ? 'USDT' : 'BNB'} pair</span></div></div>
        <button class="tmc-x" type="button" aria-label="Close">✕</button>
      </div>
      <div class="tmc-body">
        <div class="tmc-tabs" role="tablist"><button type="button" class="${modo === 'buy' ? 'on' : ''}" data-m="buy" role="tab">Buy</button><button type="button" class="${modo === 'sell' ? 'on' : ''}" data-m="sell" role="tab">Sell</button></div>
        <div class="tmc-cards">
          <div class="tmc-box">
            <div class="tmc-box-top"><span class="tmc-lbl">You pay</span><span class="tmc-bal" id="tmc-bal"></span></div>
            <div class="tmc-box-mid"><input class="tmc-amt" id="tmc-amt" inputmode="decimal" placeholder="0.0" autocomplete="off"><span class="tmc-tok" id="tmc-tok-in"></span></div>
            <div class="tmc-box-bot"><span class="tmc-usd" id="tmc-usd"></span><button class="tmc-max" id="tmc-max" type="button">MAX</button></div>
          </div>
          <div class="tmc-presets" id="tmc-presets">${PRESETS_BNB.map((v) => `<button type="button" data-v="${v}">${v} BNB</button>`).join('')}</div>
          <div class="tmc-flip" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg></div>
          <div class="tmc-box">
            <div class="tmc-box-top"><span class="tmc-lbl">You receive (est.)</span><span class="tmc-bal" id="tmc-min"></span></div>
            <div class="tmc-box-mid"><div class="tmc-out" id="tmc-out">0.0</div><span class="tmc-tok" id="tmc-tok-out"></span></div>
            <div class="tmc-box-bot"><span class="tmc-lbl">Slippage</span><span class="tmc-slip" id="tmc-slip">${SLIPPAGE.opciones.map((b) => `<button type="button" data-b="${b}" class="${b === slipBps ? 'on' : ''}">${b / 100}%</button>`).join('')}<input class="tmc-slip-in" id="tmc-slip-in" inputmode="decimal" placeholder="Custom" maxlength="5" autocomplete="off"></span></div>
          </div>
        </div>
        <div class="tmc-rev" id="tmc-rev" hidden></div>
        <div class="tmc-prot"><span class="tmc-prot-meter ok" id="tmc-prot-meter"></span></div>
        <div class="tmc-info" id="tmc-info"></div>
        <button class="tmc-go" id="tmc-go" type="button">Swap</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const cerrar = () => { try { ov.remove(); } catch (_) {} };
  ov.querySelector('.tmc-x').onclick = () => { if (!firmando) cerrar(); };
  ov.addEventListener('click', (e) => { if (e.target === ov && !firmando) cerrar(); });
  const abierto = () => !!$('tmc-ov');

  const info = $('tmc-info'), out = $('tmc-out'), amt = $('tmc-amt'), go = $('tmc-go'), balEl = $('tmc-bal'), usdEl = $('tmc-usd'), minEl = $('tmc-min');
  const pillBNB = `${marcaBNB()}<b>BNB</b>`, pillTok = `${marcaToken(it)}<b>${sym}</b>`;
  const pintarPildoras = () => { $('tmc-tok-in').innerHTML = modo === 'buy' ? pillBNB : pillTok; $('tmc-tok-out').innerHTML = modo === 'buy' ? pillTok : pillBNB; if (go) go.classList.toggle('sell', modo === 'sell'); const pp = $('tmc-presets'); if (pp) pp.hidden = modo !== 'buy'; };

  const entrada = () => { try { const v = (amt.value || '0').replace(/[^0-9.]/g, '') || '0'; return modo === 'buy' ? ethers.parseEther(v) : ethers.parseUnits(v, dec); } catch (_) { return 0n; } };
  const salidaEst = () => (cot ? (modo === 'buy' ? cot.tokOut : cot.neto) : 0n);
  // minimo que exige el contrato: compra = tokens tras slippage; venta = BNB BRUTO tras slippage (la comision sale despues)
  const minOut = () => { if (!cot) return 0n; const base = modo === 'buy' ? cot.tokOut : cot.bruto; return base - base * BigInt(slipBps) / 10000n; };
  const fmtSalida = (w) => (modo === 'buy' ? numC(Number(ethers.formatUnits(w, dec))) : fmtBNB(w));

  const pintarSaldo = () => {
    const c = wallet.cuentaActual(); if (!c) { balEl.textContent = ''; return; }
    if (modo === 'buy') balEl.textContent = saldo == null ? 'Balance: …' : `Balance: ${(+ethers.formatEther(saldo)).toFixed(4)} BNB`;
    else balEl.textContent = saldoTok == null ? 'Balance: …' : `Balance: ${numC(Number(ethers.formatUnits(saldoTok, dec)))} ${sym}`;
  };
  const pintarCot = () => {
    const w = entrada();
    usdEl.textContent = (bnbUsd > 0 && w > 0n && modo === 'buy') ? `~$${fmtP(Number(ethers.formatEther(w)) * bnbUsd)}` : '';
    if (!cot || !(w > 0n) || cotPara !== w) { out.textContent = w > 0n ? '…' : '0.0'; minEl.textContent = ''; if (!mensaje) info.textContent = ''; pintarRev(); return; }
    out.textContent = fmtSalida(salidaEst());
    const minNeto = modo === 'buy' ? minOut() : minOut() - minOut() * 100n / 10000n;   // venta: minimo que te llega, ya sin el 1%
    minEl.textContent = `Min: ${fmtSalida(minNeto)} ${modo === 'buy' ? sym : 'BNB'}`;
    pintarRev();
  };
  // Detalle de la operacion: tasa, impacto en precio, minimo que recibes, comision y slippage. Se ve antes de confirmar.
  const pintarRev = () => {
    const rev = $('tmc-rev'); if (!rev) return;
    const w = entrada();
    if (!cot || !(w > 0n) || cotPara !== w || !(salidaEst() > 0n)) { rev.hidden = true; rev.innerHTML = ''; return; }
    const bnb = modo === 'buy' ? Number(ethers.formatEther(w - cot.comision)) : Number(ethers.formatEther(cot.bruto));
    const toks = modo === 'buy' ? Number(ethers.formatUnits(cot.tokOut, dec)) : Number(ethers.formatUnits(w, dec));
    const px = toks > 0 ? bnb / toks : 0;                       // precio efectivo de la operacion (BNB por token)
    const spot = Number(it.precio) || 0;                        // precio spot del feed, en la moneda del par
    let impact = null;
    if (spot > 0 && px > 0) { const pxCmp = quote === USDT ? (bnbUsd > 0 ? px * bnbUsd : 0) : px; if (pxCmp > 0) impact = modo === 'buy' ? (pxCmp / spot - 1) * 100 : (1 - pxCmp / spot) * 100; }
    const impAbs = impact == null ? null : Math.abs(impact);
    const impCls = impAbs == null ? '' : impAbs < 1 ? 'ok' : impAbs < 5 ? 'warn' : 'bad';
    const minNeto = modo === 'buy' ? minOut() : minOut() - minOut() * 100n / 10000n;
    const slipCls = slipBps > 1500 ? 'bad' : slipBps > 500 ? 'warn' : '';
    const fila = (l, v, cls) => `<div class="tmc-rev-r"><span>${l}</span><b class="${cls || ''}">${v}</b></div>`;
    rev.hidden = false;
    rev.innerHTML =
      fila('Rate', px > 0 ? `1 ${sym} = ${fmtP(px, 3)} BNB${bnbUsd > 0 ? ` · $${fmtP(px * bnbUsd, 3)}` : ''}` : '—')
      + (impact != null ? fila('Price impact', `${impAbs < 0.01 ? '&lt;0.01' : impAbs.toFixed(2)}%`, 'tmc-imp ' + impCls) : '')
      + fila('Min received', `${fmtSalida(minNeto)} ${modo === 'buy' ? sym : 'BNB'}`)
      + fila('Fee', `${fmtBNB(cot.comision, 5)} BNB`)
      + fila('Max slippage', `${slipBps / 100}%`, slipCls ? 'tmc-imp ' + slipCls : '')
      + (impCls === 'bad' ? `<div class="tmc-rev-warn">High price impact. The pool is thin for this size; trade less or expect a worse price.</div>` : '')
      + (slipBps > 1500 ? `<div class="tmc-rev-warn">Very high slippage. A bot could take up to ${slipBps / 100}% of this trade.</div>` : '');
  };
  // Medidor de proteccion siempre visible: cuanto puede sacar un bot (= tu slippage). El contrato nunca
  // te entrega menos de tu minimo; si el precio se pasa, la tx revierte y no pierdes fondos.
  const pintarProt = () => {
    const m = $('tmc-prot-meter'); if (!m) return;
    const pn = slipBps / 100; const cls = slipBps <= 300 ? 'ok' : slipBps <= 1000 ? 'warn' : 'bad';
    m.className = 'tmc-prot-meter ' + cls;
    m.textContent = 'A bot can take ≤ ' + (Number.isInteger(pn) ? pn : pn.toFixed(1)) + '%';
  };
  // Estado del boton. Nunca "Close": si no se puede operar, dice por que.
  const estado = () => {
    if (ocupado) return;
    if (modo === 'buy' && nivel === 'bad') { go.disabled = true; go.textContent = 'Do not buy'; mensaje = true; info.textContent = 'The security check found a critical issue. Buying is blocked.'; return; }
    if (!wallet.cuentaActual()) { go.disabled = false; go.textContent = 'Connect wallet'; return; }
    const w = entrada();
    if (!(w > 0n)) { go.disabled = true; go.textContent = 'Enter an amount'; return; }
    const sal = modo === 'buy' ? saldo : saldoTok;
    if (sal != null && w > sal) { go.disabled = true; go.textContent = modo === 'buy' ? 'Insufficient BNB' : `Insufficient ${sym}`; return; }
    if (!cot || cotPara !== w) { go.disabled = true; go.textContent = 'Getting quote…'; return; }
    if (!(salidaEst() > 0n)) { go.disabled = true; go.textContent = 'No liquidity'; return; }
    if (modo === 'sell' && permiso < w) { go.disabled = false; go.textContent = `Approve ${sym}`; return; }
    go.disabled = false; go.textContent = modo === 'buy' ? (nivel === 'pend' ? 'Swap (not checked yet)' : 'Swap') : 'Sell';
  };
  pintarPildoras(); pintarSaldo(); pintarCot(); estado(); pintarProt();
  log('abierto', { token: it.token, quote, nivel, cuenta: wallet.cuentaActual() || null });

  const leerSaldos = async () => {
    const c = wallet.cuentaActual(); if (!c) { saldo = null; saldoTok = null; pintarSaldo(); return; }
    await Promise.all([
      saldoBNB(c).then((v) => { saldo = v; }).catch((e) => log('saldo fallo', e && e.message)),
      saldoToken(it.token, c).then((v) => { saldoTok = v; }).catch((e) => log('saldo token fallo', e && e.message)),
      permisoToken(it.token, c).then((v) => { permiso = v; }).catch(() => {})
    ]);
    if (abierto()) { pintarSaldo(); estado(); }
  };
  let _tk = 0, _timer = null;
  const cotizar = async () => {
    const w = entrada(); if (!(w > 0n)) { cot = null; cotPara = 0n; pintarCot(); estado(); return; }
    const tk = ++_tk;
    try {
      const r = modo === 'buy' ? await cotizarCompra(it.token, quote, w) : await cotizarVenta(it.token, quote, w);
      if (tk !== _tk || !abierto()) return; cot = r; cotPara = w;
      log('cotiza', modo, amt.value, '->', fmtSalida(salidaEst()));
    } catch (e) { if (tk !== _tk) return; cot = modo === 'buy' ? { tokOut: 0n, comision: 0n } : { bruto: 0n, neto: 0n, comision: 0n }; cotPara = w; log('cotiza fallo', e && (e.shortMessage || e.message)); }
    pintarCot(); estado();
  };
  const programar = () => { mensaje = false; cot = null; pintarCot(); estado(); clearTimeout(_timer); _timer = setTimeout(cotizar, 350); };
  const cambiarModo = (m) => {
    if (ocupado || m === modo) return;
    modo = m; cot = null; cotPara = 0n; mensaje = false; amt.value = '';
    ov.querySelectorAll('.tmc-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    pintarPildoras(); pintarSaldo(); pintarCot(); estado();
  };

  precioBNBUSDT().then((p) => { bnbUsd = p || 0; if (abierto()) pintarCot(); }).catch(() => {});
  leerSaldos();
  amt.addEventListener('input', () => { const pp = $('tmc-presets'); if (pp) pp.querySelectorAll('button').forEach((x) => x.classList.remove('on')); programar(); });
  const presetModal = $('tmc-presets');
  if (presetModal) presetModal.querySelectorAll('button').forEach((b) => { b.onclick = () => { if (modo !== 'buy') return; amt.value = String(parseFloat(b.dataset.v) || 0); presetModal.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); programar(); }; });
  ov.querySelectorAll('.tmc-tabs button').forEach((b) => { b.onclick = () => cambiarModo(b.dataset.m); });
  const slipIn = $('tmc-slip-in');
  $('tmc-slip').querySelectorAll('button').forEach((b) => { b.onclick = () => { slipBps = Number(b.dataset.b); if (slipIn) slipIn.value = ''; $('tmc-slip').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); pintarCot(); estado(); pintarProt(); }; });
  if (slipIn) slipIn.oninput = () => { const v = parseFloat((slipIn.value || '').replace(/[^0-9.]/g, '')); if (v > 0) slipBps = Math.max(10, Math.min(5000, Math.round(v * 100))); $('tmc-slip').querySelectorAll('button').forEach((x) => x.classList.remove('on')); pintarCot(); estado(); pintarProt(); };
  $('tmc-max').onclick = async () => {
    if (!wallet.cuentaActual()) { go.click(); return; }
    if (saldo == null || saldoTok == null) await leerSaldos();
    if (modo === 'buy') { let m = (saldo || 0n) - ethers.parseEther('0.003'); if (m < 0n) m = 0n; amt.value = fmtBNB(m); }   // margen para el gas
    else amt.value = ethers.formatUnits(saldoTok || 0n, dec).replace(/\.0$/, '');
    programar();
  };
  const refrescarCada = setInterval(() => { if (!abierto()) { clearInterval(refrescarCada); return; } if (!ocupado && entrada() > 0n) cotizar(); }, 8000);

  const fallo = (e) => {
    log('fallo', e);
    const m = ((e && (e.reason || e.shortMessage || e.message)) || '').toLowerCase();
    if (m.includes('user rejected') || m.includes('denied') || m.includes('4001')) return 'You cancelled.';
    if (m.includes('insufficient_output') || m.includes('slippage')) return 'Price moved more than your slippage. Raise it or try again.';
    if (m.includes('insufficient funds') || m.includes('insufficient')) return 'Not enough BNB for the swap and gas.';
    if (m.includes('pausado')) return 'Swaps are paused right now.';
    if (m.includes('vencido')) return 'The quote expired. Try again.';
    if (m.includes('transfer_failed') || m.includes('transferhelper') || m.includes('transfer_from_failed')) return 'The token refused the transfer. It may block this side of the trade (honeypot behavior).';
    return 'The transaction could not be completed.' + (e && e.reason ? ' (' + String(e.reason).slice(0, 100) + ')' : '');
  };
  const trabajando = (txt) => { ocupado = true; firmando = true; go.disabled = true; go.textContent = txt; amt.disabled = true; go.classList.add('busy'); };
  const libre = () => { firmando = false; ocupado = false; amt.disabled = false; go.classList.remove('busy'); estado(); };

  go.onclick = async () => {
    if (!wallet.cuentaActual()) {
      try { await wallet.conectar(); } catch (e) { log('conectar fallo', e && e.message); }
      await leerSaldos(); estado(); return;
    }
    const w = entrada(); if (!(w > 0n) || !cot || cotPara !== w || !(salidaEst() > 0n)) return;
    // Venta sin permiso: primero approve exacto, luego el boton pasa a Sell.
    if (modo === 'sell' && permiso < w) {
      trabajando('Confirm approval in your wallet…'); mensaje = true; info.textContent = `Allow the Terminal contract to take ${numC(Number(ethers.formatUnits(w, dec)))} ${sym} from your wallet.`;
      try { await aprobar(it.token, w); permiso = w; mensaje = false; pintarCot(); log('approve ok'); }
      catch (e) { mensaje = true; info.textContent = fallo(e); }
      libre(); return;
    }
    const min = minOut();
    trabajando('Confirm in your wallet…'); mensaje = true;
    info.innerHTML = modo === 'buy'
      ? `You pay <b>${fmtBNB(w)} BNB</b> for at least <b>${numC(Number(ethers.formatUnits(min, dec)))} ${sym}</b>.`
      : `You sell <b>${numC(Number(ethers.formatUnits(w, dec)))} ${sym}</b> for at least <b>${fmtBNB(min - min * 100n / 10000n)} BNB</b>.`;
    try {
      const cuenta = wallet.cuentaActual();
      const balAntes = (modo === 'buy' && cuenta) ? await saldoToken(it.token, cuenta).catch(() => 0n) : 0n;
      const rc = modo === 'buy' ? await comprar({ token: it.token, quote, bnbWei: w, minOut: min }) : await vender({ token: it.token, quote, cantidad: w, minOut: min });
      firmando = false; go.classList.remove('busy'); go.textContent = modo === 'buy' ? 'Swap complete' : 'Sold';
      info.innerHTML = `Done. ${modo === 'buy' ? 'The ' + sym + ' is' : 'The BNB is'} in your wallet. <a href="${SCAN_URL}/tx/${esc(rc.hash)}" target="_blank" rel="noopener">View on BscScan</a>`;
      log('ok', modo, rc.hash);
      // Registrar la posicion (no custodial, solo en el navegador) para "My positions".
      try {
        if (cuenta && modo === 'buy') {
          const balDespues = await saldoToken(it.token, cuenta).catch(() => 0n);
          const recibido = balDespues > balAntes ? balDespues - balAntes : 0n;
          registrarCompra(cuenta, it, recibido, w, bnbUsd);
        } else if (cuenta && modo === 'sell') { registrarVenta(cuenta, it.token, w); }
      } catch (_) {}
      // El boton se queda unos segundos; luego la ventana vuelve a estar lista para otra operacion.
      setTimeout(() => { ocupado = false; amt.disabled = false; amt.value = ''; cot = null; cotPara = 0n; if (abierto()) { pintarCot(); estado(); leerSaldos(); } }, 3000);
    } catch (e) {
      mensaje = true; info.textContent = fallo(e);
      libre();
    }
  };
}
