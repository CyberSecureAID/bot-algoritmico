/* terminal/protect.js. Disclaimer de la compra protegida (anti sandwich), TODO interno, sin mandar a nadie
   fuera. Sale cuando el usuario ACTIVA el boton Protected. Explica que la proteccion suma un fee: el total
   pasa a 2% en BNB (1% normal + 1% de proteccion), por compra y por venta.
   Reparto del 2% que hara el contrato (guardado aqui para cuando se despliegue): 0.8 owner1, 0.8 owner2,
   0.2 staking, 0.2 referido; sin referido, 0.4 staking. Hoy el contrato vivo cobra 1% plano: el 1% extra
   solo se cobra cuando se despliegue el contrato nuevo. */

const ICO = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.4 7.6 8 9 4.6-1.4 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>';

/* Muestra el disclaimer y llama onResp(true) si el usuario acepta activar, onResp(false) si cancela. */
export function disclaimerProtect(onResp) {
  try { const p = document.getElementById('tg-pdisc-ov'); if (p) p.remove(); } catch (_) {}
  const ov = document.createElement('div'); ov.id = 'tg-pdisc-ov'; ov.className = 'tg-pdisc-ov';
  ov.innerHTML = `<div class="tg-pdisc" role="dialog" aria-modal="true">
      <span class="tg-pdisc-ic">${ICO}</span>
      <b class="tg-pdisc-t">Protected trading</b>
      <p class="tg-pdisc-p">Your order is sent with tight slippage so a bot can take as little as possible, and it reverts here before it ever fills at a bad price. Nothing leaves to anyone.</p>
      <p class="tg-pdisc-fee">Protected trades carry a protection fee. Your total fee becomes <b>2% in BNB</b> (1% standard plus 1% protection), on each buy and sell.</p>
      <div class="tg-pdisc-btns"><button class="tg-pdisc-no" type="button">Cancel</button><button class="tg-pdisc-yes" type="button">Enable protection</button></div>
    </div>`;
  document.body.appendChild(ov);
  const cerrar = (v) => { try { ov.remove(); } catch (_) {} if (onResp) { try { onResp(v); } catch (_) {} } };
  ov.querySelector('.tg-pdisc-yes').onclick = () => cerrar(true);
  ov.querySelector('.tg-pdisc-no').onclick = () => cerrar(false);
  ov.addEventListener('click', (e) => { if (e.target === ov) cerrar(false); });
}
