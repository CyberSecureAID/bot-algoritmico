/* disclaimer-bots.js. Aviso de los bots. Modal BLOQUEANTE: no se cierra tocando
   fuera ni con Escape; solo se cierra marcando la casilla de aceptacion y pulsando
   el boton. Sale al entrar a la pantalla de bots (app.html / movil.html), una sola
   vez por navegador (localStorage). Mismo estilo que el disclaimer del lobby (sello
   dorado). Enumera los bots, deja claro que NINGUNO garantiza beneficios, el costo
   por abrir un bot y la pausa a los 30 dias. Sin un solo guion en el texto.
   Movil: sello arriba centrado, botones abajo. Objetivo: sobrecumplir Blockaid
   (autocustodia, software que solo ejecuta parametros del usuario, sin rendimiento
   garantizado, responsabilidad del usuario, comisiones claras, contratos verificables).
   Independiente: no importa ni toca ningun otro modulo. */
(function () {
  'use strict';
  var KEY = 'cc_bots_ack_v2';
  try { if (localStorage.getItem(KEY)) return; } catch (e) {}

  var WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
  var SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';
  var SEAL = '/assets/portada/red/disclaimer.webp';

  var css = ''
    + '.ccb-ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;'
    + 'padding:18px;box-sizing:border-box;background:rgba(6,8,11,.78);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);'
    + 'opacity:0;transition:opacity .3s ease}'
    + '.ccb-ov.in{opacity:1}'
    + '.ccb-disc{width:min(560px,100%);max-height:calc(100dvh - 36px);overflow:auto;box-sizing:border-box;'
    + 'padding:22px 24px;border-radius:16px;display:flow-root;'
    + 'background:linear-gradient(180deg,rgba(15,17,21,.99),rgba(9,10,13,.99));'
    + 'border:1px solid #5c4a1e;box-shadow:0 26px 70px rgba(0,0,0,.66),inset 0 1px 0 rgba(247,219,141,.12),0 6px 0 #352810;'
    + 'font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#d4dae1;'
    + 'scrollbar-width:thin;scrollbar-color:rgba(232,184,75,.5) transparent;'
    + 'transform:translateY(14px);transition:transform .3s ease}'
    + '.ccb-ov.in .ccb-disc{transform:none}'
    + '.ccb-disc-top{display:none}'
    + '.ccb-disc-fl{float:right;width:150px;height:150px;margin:2px 0 8px 18px;shape-outside:margin-box;user-select:none;pointer-events:none}'
    + '.ccb-disc-fl img,.ccb-disc-top img{width:100%;height:auto;display:block;filter:drop-shadow(0 6px 15px rgba(0,0,0,.55))}'
    + '.ccb-disc-h{display:flex;align-items:center;gap:9px;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:15px;color:#E8B84B;margin:0 0 10px}'
    + '.ccb-disc-h svg{width:18px;height:18px;flex:none}'
    + '.ccb-disc-t{font-size:12.5px;line-height:1.6;color:#c4ccd4;margin:0 0 9px}'
    + '.ccb-disc-t b{color:#e9eef3}'
    + '.ccb-disc-t .g{color:#E8B84B;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700}'
    + '.ccb-disc-t.last{margin-bottom:0}'
    + '.ccb-chk{display:flex;align-items:flex-start;gap:10px;clear:both;margin:14px 0 0;cursor:pointer;font-size:12.5px;line-height:1.5;color:#d4dae1}'
    + '.ccb-chk input{appearance:none;-webkit-appearance:none;flex:none;width:20px;height:20px;margin:0;border-radius:6px;border:1.5px solid #c79426;background:rgba(0,0,0,.4);cursor:pointer;position:relative;transition:background .15s}'
    + '.ccb-chk input:checked{background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426);border-color:#c79426}'
    + '.ccb-chk input:checked::after{content:"";position:absolute;left:6.5px;top:2.5px;width:5px;height:10px;border:solid #241900;border-width:0 2.4px 2.4px 0;transform:rotate(45deg)}'
    + '.ccb-disc-a{display:flex;align-items:center;gap:12px;clear:both;margin-top:16px}'
    + '.ccb-disc-btn{flex:1 1 0;max-width:240px;min-width:0;'
    + 'display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;text-decoration:none;'
    + 'height:46px;padding:0 18px;border-radius:12px;'
    + 'font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:.2px;white-space:nowrap;'
    + 'border:1px solid #c79426;color:#241900;'
    + 'background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426);'
    + 'box-shadow:0 4px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5);text-shadow:0 1px 0 rgba(255,255,255,.28);transition:filter .15s,opacity .15s}'
    + '.ccb-disc-btn svg{width:15px;height:15px;flex:none}'
    + '.ccb-disc-btn:hover{filter:brightness(1.06)}'
    + '.ccb-disc-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}'
    + '.ccb-disc-btn.off{opacity:.4;cursor:not-allowed;filter:grayscale(.55)}'
    + '.ccb-disc-btn.off:active{transform:none}'
    + '@media(max-width:620px){.ccb-disc{padding:18px 16px}'
    + '.ccb-disc-fl{display:none}'
    + '.ccb-disc-top{display:block;width:118px;margin:0 auto 14px}'
    + '.ccb-disc-h{justify-content:center;text-align:center}'
    + '.ccb-disc-a{flex-wrap:wrap}.ccb-disc-btn{flex:1 1 100%;max-width:none}}';

  function show() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var ov = document.createElement('div'); ov.className = 'ccb-ov';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Bots notice and terms');
    var el = document.createElement('section'); el.className = 'ccb-disc';
    el.innerHTML = ''
      + '<div class="ccb-disc-top"><img src="' + SEAL + '" alt="" width="118" height="118"></div>'
      + '<div class="ccb-disc-fl"><img src="' + SEAL + '" alt="" width="150" height="150"></div>'
      + '<div class="ccb-disc-h">' + WARN + 'Before you use the bots</div>'
      + '<p class="ccb-disc-t">Advanced, high frequency automated bots that run their own strategies on chain. Powerful, but still only tools. Please read this first.</p>'
      + '<p class="ccb-disc-t">The bots: <b>Smart Grid</b> buys and sells across price levels. <b>Accumulator</b> buys on the way down, averages your entry and sells the whole position at your target. <b>Cash Out</b> sells crypto you already hold at the price or percentage you set. <b>DCA</b> buys a fixed amount on the schedule you set.</p>'
      + '<p class="ccb-disc-t"><span class="g">No bot here guarantees any profit.</span> Not daily, not monthly, not of any kind. Each bot executes only the parameters you choose. It does not predict the market, and no past or simulated result ensures a future one. Crypto is volatile and you can lose part or all of your capital, so use only what you can afford to lose.</p>'
      + '<p class="ccb-disc-t">You keep full custody of your funds and your keys. This is not financial, investment, legal or tax advice. You alone are responsible for your decisions. Every contract is public and verifiable on BscScan.</p>'
      + '<p class="ccb-disc-t last"><span class="g">Cost.</span> Opening any bot costs the equivalent in BNB of <b>2.50 US dollars</b> (that is 2.50 dollars, not 2.50 BNB). It then runs free for 30 days. After 30 days it pauses: it does not close and it does not sell, your funds stay safe. To run it 30 more days, just credit 2.50 US dollars again.</p>'
      + '<label class="ccb-chk"><input type="checkbox" id="ccb-agree"><span>I have read and I accept the <b>Terms and Conditions</b>. I understand these bots do not guarantee any profit and that I use them at my own risk.</span></label>'
      + '<div class="ccb-disc-a">'
      +   '<button class="ccb-disc-btn off" type="button" id="ccb-ok" disabled>Enter the bots</button>'
      +   '<a class="ccb-disc-btn" href="transparency.html" role="button">' + SHIELD + 'Full transparency</a>'
      + '</div>';
    ov.appendChild(el);
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('in'); });

    // Bloqueante: tocar fuera NO cierra (no hay handler de cierre en el fondo).
    ov.addEventListener('click', function (e) { if (e.target === ov) { e.preventDefault(); e.stopPropagation(); } });

    var chk = el.querySelector('#ccb-agree');
    var ok = el.querySelector('#ccb-ok');
    chk.addEventListener('change', function () {
      if (chk.checked) { ok.classList.remove('off'); ok.removeAttribute('disabled'); }
      else { ok.classList.add('off'); ok.setAttribute('disabled', ''); }
    });
    ok.addEventListener('click', function () {
      if (!chk.checked) return;
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      ov.classList.remove('in');
      setTimeout(function () { try { ov.remove(); } catch (e) {} }, 320);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
