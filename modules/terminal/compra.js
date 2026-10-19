/* terminal/compra.js. Compra de un token desde la Terminal (modulo sellado).
   Ventana con el MISMO aspecto que nuestro swap (tarjetas You pay / You receive, pildoras de moneda,
   boton verde). Por debajo va al contrato TerminalSwap (PancakeSwap V2), que retiene el 1% y manda
   los tokens directo a la wallet del usuario. No custodial: nada se queda en ningun sitio.
   Lecturas por RPC con rotacion; la firma por la wallet conectada. Todo en consola con [TERM-BUY]. */

import * as ethers from './ethers.min.js';
import * as wallet from './wallet.js';
import { RPCS, TERMINAL_SWAP, WBNB, USDT, SCAN_URL, SLIPPAGE } from './config.js';
import { precioBNBUSDT } from './motor.js';

const log = (...a) => { try { console.info('[TERM-BUY]', ...a); } catch (_) {} };
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const $ = (id) => document.getElementById(id);

const ABI = [
  'function comprar(address token, address quote, uint256 minOut, uint256 deadline) payable',
  'function cotizarCompra(address token, address quote, uint256 bnbIn) view returns (uint256 tokOut, uint256 comision)',
  'function pausado() view returns (bool)'
];

/* ── RPC con rotacion (lecturas) y firmante (escritura) ── */
let _rpcIdx = 0; const _prov = {};
function provRPC(i) { const u = RPCS[((i % RPCS.length) + RPCS.length) % RPCS.length]; if (!_prov[u]) _prov[u] = new ethers.JsonRpcProvider(u, 56, { staticNetwork: true }); return _prov[u]; }
async function conRotacion(fn) { let err; for (let k = 0; k < RPCS.length; k++) { const i = _rpcIdx + k; try { return await fn(provRPC(i)); } catch (e) { err = e; _rpcIdx = (i + 1) % RPCS.length; } } throw err; }
function inyectado() {
  try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); if (p) return p; } catch (_) {}
  if (typeof window !== 'undefined' && window.ethereum) return window.ethereum;
  throw new Error('No wallet');
}
async function firmante() { return new ethers.BrowserProvider(inyectado()).getSigner(); }

/* quote del par: WBNB o USDT (el contrato elige la ruta). Un par contra USDT va BNB -> USDT -> token. */
function quoteDe(it) { return it && it.quote && String(it.quote).toLowerCase() === USDT.toLowerCase() ? USDT : WBNB; }

export async function cotizarCompra(token, quote, bnbWei) {
  const c = (p) => new ethers.Contract(TERMINAL_SWAP, ABI, p);
  const r = await conRotacion((p) => c(p).cotizarCompra(token, quote, bnbWei));
  return { tokOut: r[0], comision: r[1] };
}
export async function saldoBNB(cuenta) { return conRotacion((p) => p.getBalance(cuenta)); }

/* Compra real: estimateGas primero (revela el motivo del revert antes de firmar), luego la tx. */
export async function comprar({ token, quote, bnbWei, minOut }) {
  const c = new ethers.Contract(TERMINAL_SWAP, ABI, await firmante());
  const deadline = Math.floor(Date.now() / 1000) + 180;
  const est = await c.comprar.estimateGas(token, quote, minOut, deadline, { value: bnbWei });
  const tx = await c.comprar(token, quote, minOut, deadline, { value: bnbWei, gasLimit: est + est * 35n / 100n });
  log('tx enviada', tx.hash);
  const rc = await tx.wait();
  if (!rc || rc.status !== 1) throw new Error('La transaccion fallo');
  return rc;
}

/* ── Formato ── */
const fmtP = (p, sig = 4) => { if (!(p > 0)) return '0'; if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 4 }); const z = Math.floor(-Math.log10(p)); return p.toFixed(Math.min(18, z + sig)).replace(/\.?0+$/, ''); };
const numC = (v) => (v >= 1e6 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toLocaleString('en-US', { maximumFractionDigits: v >= 1 ? 4 : 8 }));
const TW = (a) => { try { return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/' + ethers.getAddress(a) + '/logo.png'; } catch (_) { return ''; } };
const ICO_BNB = '<svg viewBox="0 0 126.61 126.61" fill="#F3BA2F" width="16" height="16"><path d="M38.73 53.2 63.3 28.63l24.6 24.6 14.3-14.31L63.3 0 24.42 38.89z"/><path d="M0 63.3l14.3-14.3 14.31 14.3-14.31 14.3z"/><path d="M38.73 73.41 63.3 97.98l24.59-24.58 14.31 14.29-38.9 38.91L24.42 87.7z"/><path d="M98 63.3l14.3-14.3 14.31 14.3-14.31 14.31z"/><path d="M77.83 63.3 63.3 48.77 52.56 59.51l-1.24 1.23-2.54 2.55 14.52 14.53z"/></svg>';
const ico = (src) => `<span class="tmc-ico"><span class="tmc-fb">${ICO_BNB}</span>${src ? `<img src="${esc(src)}" alt="" onload="this.parentElement.classList.add('conlogo')" onerror="this.style.display='none'">` : ''}</span>`;

/* ── Ventana de compra ──
   it: item del feed (token, simbolo, nombre, decimales, quote). aud: resultado de la auditoria
   ({nivel}) o null. Con nivel 'bad' la compra queda bloqueada y el boton explica por que. */
export function abrirCompra(it, aud) {
  if (!it) return;
  const prev = $('tmc-ov'); if (prev) prev.remove();
  const sym = esc(it.simbolo || 'TOKEN');
  const dec = Number(it.decimales) || 18;
  const quote = quoteDe(it);
  const nivel = aud && aud.nivel ? aud.nivel : 'pend';
  let bnbUsd = 0, saldo = null, slipBps = SLIPPAGE.porDefecto, cot = null, cotPara = 0n, ocupado = false, firmando = false, mensaje = false;

  const ov = document.createElement('div'); ov.id = 'tmc-ov'; ov.className = 'tmc-ov';
  ov.innerHTML = `<div class="tmc-card" role="dialog" aria-modal="true">
      <div class="tmc-head">
        <div class="tmc-tt">${ico(TW(it.token))}<div class="tmc-tt-tx"><b>${esc(it.nombre || 'Token')}</b><span>${sym} · PancakeSwap ${quote === USDT ? 'USDT' : 'BNB'} pair</span></div></div>
        <button class="tmc-x" type="button" aria-label="Close">✕</button>
      </div>
      <div class="tmc-body">
        <div class="tmc-cards">
          <div class="tmc-box">
            <div class="tmc-box-top"><span class="tmc-lbl">You pay</span><span class="tmc-bal" id="tmc-bal"></span></div>
            <div class="tmc-box-mid"><input class="tmc-amt" id="tmc-amt" inputmode="decimal" placeholder="0.0" autocomplete="off"><span class="tmc-tok">${ico(TW(WBNB))}<b>BNB</b></span></div>
            <div class="tmc-box-bot"><span class="tmc-usd" id="tmc-usd"></span><button class="tmc-max" id="tmc-max" type="button">MAX</button></div>
          </div>
          <div class="tmc-flip" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg></div>
          <div class="tmc-box">
            <div class="tmc-box-top"><span class="tmc-lbl">You receive (est.)</span><span class="tmc-bal" id="tmc-min"></span></div>
            <div class="tmc-box-mid"><div class="tmc-out" id="tmc-out">0.0</div><span class="tmc-tok">${ico(TW(it.token))}<b>${sym}</b></span></div>
            <div class="tmc-box-bot"><span class="tmc-lbl">Slippage</span><span class="tmc-slip" id="tmc-slip">${SLIPPAGE.opciones.map((b) => `<button type="button" data-b="${b}" class="${b === slipBps ? 'on' : ''}">${b / 100}%</button>`).join('')}</span></div>
          </div>
        </div>
        <div class="tmc-info" id="tmc-info"></div>
        <button class="tmc-go" id="tmc-go" type="button">Swap</button>
        <p class="tmc-note" id="tmc-note">Fee 1%, split on chain: 0.10% to stakers and 0.90% to the platform. The tokens go straight from PancakeSwap to your wallet. New tokens can lose all their value; a token tax, if any, is not included in the estimate.</p>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const cerrar = () => { try { ov.remove(); } catch (_) {} };
  ov.querySelector('.tmc-x').onclick = () => { if (!firmando) cerrar(); };
  ov.addEventListener('click', (e) => { if (e.target === ov && !firmando) cerrar(); });
  const abierto = () => !!$('tmc-ov');

  const info = $('tmc-info'), out = $('tmc-out'), amt = $('tmc-amt'), go = $('tmc-go'), balEl = $('tmc-bal'), usdEl = $('tmc-usd'), minEl = $('tmc-min');
  const bnbWei = () => { try { return ethers.parseEther((amt.value || '0').replace(/[^0-9.]/g, '') || '0'); } catch (_) { return 0n; } };
  const minOut = () => cot ? cot.tokOut - cot.tokOut * BigInt(slipBps) / 10000n : 0n;

  const pintarSaldo = () => { const c = wallet.cuentaActual(); balEl.textContent = !c ? '' : (saldo == null ? 'Balance: …' : `Balance: ${(+ethers.formatEther(saldo)).toFixed(4)} BNB`); };
  const pintarCot = () => {
    const w = bnbWei();
    usdEl.textContent = (bnbUsd > 0 && w > 0n) ? `~$${fmtP(Number(ethers.formatEther(w)) * bnbUsd)}` : '';
    if (!cot || !(w > 0n) || cotPara !== w) { out.textContent = w > 0n ? '…' : '0.0'; minEl.textContent = ''; return; }
    out.textContent = numC(Number(ethers.formatUnits(cot.tokOut, dec)));
    minEl.textContent = `Min: ${numC(Number(ethers.formatUnits(minOut(), dec)))} ${sym}`;
    const px = Number(ethers.formatEther(w - cot.comision)) / Number(ethers.formatUnits(cot.tokOut, dec));
    if (!mensaje) info.innerHTML = px > 0 ? `1 ${sym} = <b>${fmtP(px, 3)} BNB</b>${bnbUsd > 0 ? ` (~$${fmtP(px * bnbUsd, 3)})` : ''} · fee <b>${(+ethers.formatEther(cot.comision)).toFixed(5)} BNB</b>` : '';
  };
  // Estado del boton. Nunca "Close": si no se puede comprar, dice por que.
  const estado = () => {
    if (ocupado) return;
    if (nivel === 'bad') { go.disabled = true; go.textContent = 'Do not buy'; info.textContent = 'The security check found a critical issue. Buying is blocked.'; return; }
    if (!wallet.cuentaActual()) { go.disabled = false; go.textContent = 'Connect wallet'; return; }
    const w = bnbWei();
    if (!(w > 0n)) { go.disabled = true; go.textContent = 'Enter an amount'; return; }
    if (saldo != null && w > saldo) { go.disabled = true; go.textContent = 'Insufficient BNB'; return; }
    if (!cot || cotPara !== w) { go.disabled = true; go.textContent = 'Getting quote…'; return; }
    if (!(cot.tokOut > 0n)) { go.disabled = true; go.textContent = 'No liquidity'; return; }
    go.disabled = false; go.textContent = nivel === 'pend' ? 'Swap (not checked yet)' : 'Swap';
  };
  pintarSaldo(); pintarCot(); estado();
  log('abierto', { token: it.token, quote, nivel, cuenta: wallet.cuentaActual() || null });

  const leerSaldo = async () => {
    const c = wallet.cuentaActual(); if (!c) { saldo = null; pintarSaldo(); return; }
    try { saldo = await saldoBNB(c); } catch (e) { log('saldo fallo', e && e.message); }
    if (abierto()) { pintarSaldo(); estado(); }
  };
  let _tk = 0, _timer = null;
  const cotizar = async () => {
    const w = bnbWei(); if (!(w > 0n)) { cot = null; cotPara = 0n; pintarCot(); estado(); return; }
    const tk = ++_tk;
    try { const r = await cotizarCompra(it.token, quote, w); if (tk !== _tk || !abierto()) return; cot = r; cotPara = w; log('cotiza', ethers.formatEther(w), 'BNB ->', ethers.formatUnits(r.tokOut, dec), sym); }
    catch (e) { if (tk !== _tk) return; cot = { tokOut: 0n, comision: 0n }; cotPara = w; log('cotiza fallo', e && (e.shortMessage || e.message)); }
    pintarCot(); estado();
  };
  const programar = () => { mensaje = false; cot = null; pintarCot(); estado(); clearTimeout(_timer); _timer = setTimeout(cotizar, 350); };

  precioBNBUSDT().then((p) => { bnbUsd = p || 0; if (abierto()) pintarCot(); }).catch(() => {});
  leerSaldo();
  amt.addEventListener('input', programar);
  $('tmc-slip').querySelectorAll('button').forEach((b) => { b.onclick = () => { slipBps = Number(b.dataset.b); $('tmc-slip').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); pintarCot(); }; });
  $('tmc-max').onclick = async () => {
    if (!wallet.cuentaActual()) { go.click(); return; }
    if (saldo == null) await leerSaldo();
    let m = (saldo || 0n) - ethers.parseEther('0.003'); if (m < 0n) m = 0n;   // margen para el gas
    amt.value = (+ethers.formatEther(m)).toFixed(6).replace(/\.?0+$/, ''); programar();
  };
  const refrescarCada = setInterval(() => { if (!abierto()) { clearInterval(refrescarCada); return; } if (!ocupado && bnbWei() > 0n) cotizar(); }, 8000);

  go.onclick = async () => {
    if (!wallet.cuentaActual()) {
      try { await wallet.conectar(); } catch (e) { log('conectar fallo', e && e.message); }
      await leerSaldo(); estado(); return;
    }
    const w = bnbWei(); if (!(w > 0n) || !cot || cotPara !== w || !(cot.tokOut > 0n)) return;
    const min = minOut();
    ocupado = true; firmando = true; go.disabled = true; go.textContent = 'Confirm in your wallet…'; amt.disabled = true;
    info.innerHTML = `You pay <b>${(+ethers.formatEther(w)).toFixed(6)} BNB</b> for at least <b>${numC(Number(ethers.formatUnits(min, dec)))} ${sym}</b>.`;
    try {
      const rc = await comprar({ token: it.token, quote, bnbWei: w, minOut: min });
      firmando = false; go.textContent = 'Swap complete';
      mensaje = true;
      info.innerHTML = `Done. The ${sym} is in your wallet. <a href="${SCAN_URL}/tx/${esc(rc.hash)}" target="_blank" rel="noopener">View on BscScan</a>`;
      log('ok', rc.hash);
      // El boton se queda en "Swap complete" unos segundos; luego la ventana vuelve a estar lista para otra compra.
      setTimeout(() => { ocupado = false; amt.disabled = false; amt.value = ''; cot = null; cotPara = 0n; if (abierto()) { pintarCot(); estado(); leerSaldo(); } }, 3000);
    } catch (e) {
      log('comprar fallo', e);
      const m = ((e && (e.reason || e.shortMessage || e.message)) || '').toLowerCase();
      let txt;
      if (m.includes('user rejected') || m.includes('denied') || m.includes('4001')) txt = 'You cancelled the swap.';
      else if (m.includes('insufficient_output') || m.includes('slippage')) txt = 'Price moved more than your slippage. Raise it or try again.';
      else if (m.includes('insufficient funds') || m.includes('insufficient')) txt = 'Not enough BNB for the swap and gas.';
      else if (m.includes('pausado')) txt = 'Swaps are paused right now.';
      else if (m.includes('vencido')) txt = 'The quote expired. Try again.';
      else if (m.includes('transfer_failed') || m.includes('transferhelper')) txt = 'The token refused the transfer. It may block buys (honeypot behavior).';
      else txt = 'The swap could not be completed.' + (e && e.reason ? ' (' + String(e.reason).slice(0, 100) + ')' : '');
      mensaje = true; info.textContent = txt;
      firmando = false; ocupado = false; amt.disabled = false; estado();
    }
  };
}
