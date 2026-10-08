/* disclaimer.js. Aviso de riesgo y terminos tipo "cookies". Sale a CUALQUIER
   visitante al entrar, una sola vez (se recuerda en localStorage). Archivo
   independiente: no importa ni toca ningun otro modulo; si se quita el <script>,
   desaparece y ya.
   Objetivo: SOBRECUMPLIR lo que Blockaid espera de un producto de trading
   automatizado (sin rendimiento garantizado, software que solo ejecuta los
   parametros del usuario, sin custodia, responsabilidad del usuario, contratos
   verificables en cadena).
   Cuño corporativo (assets/portada/red/disclaimer.webp): en ESCRITORIO va abajo
   a la derecha y el texto lo ENVUELVE; su base se alinea con la base de los
   botones (banner compacto, sin huecos) midiendo en vivo. En MOVIL va centrado
   arriba, como encabezado, con los dos botones al pie. */
(function () {
  'use strict';
  var KEY = 'cc_risk_ack_v5';
  try { if (localStorage.getItem(KEY)) return; } catch (e) {}

  var WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
  var SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';
  var SEAL = '/assets/portada/red/disclaimer.webp';
  var SEAL_D = 176;

  var css = ''
    + '.cc-disc{position:fixed;right:92px;bottom:24px;left:auto;z-index:190;'
    + 'width:min(720px,54vw);box-sizing:border-box;padding:18px 20px;border-radius:15px;'
    + 'background:linear-gradient(180deg,rgba(14,16,20,.975),rgba(8,9,12,.975));'
    + 'border:1px solid #5c4a1e;box-shadow:0 22px 60px rgba(0,0,0,.62),inset 0 1px 0 rgba(247,219,141,.12),0 6px 0 #352810;'
    + 'font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#d4dae1;display:flow-root;'
    + 'transform:translateY(18px);opacity:0;transition:transform .34s ease,opacity .34s ease}'
    + '.cc-disc.in{transform:none;opacity:1}'
    + '.cc-disc-top{display:none}'
    + '.cc-disc-push{float:right;width:1px;height:0}'
    + '.cc-disc-fl{float:right;clear:right;width:' + SEAL_D + 'px;height:' + SEAL_D + 'px;margin:0 0 0 20px;shape-outside:margin-box;user-select:none;pointer-events:none}'
    + '.cc-disc-fl img,.cc-disc-top img{width:100%;height:auto;display:block;filter:drop-shadow(0 6px 15px rgba(0,0,0,.55))}'
    + '.cc-disc-h{display:flex;align-items:center;gap:9px;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:14.5px;color:#E8B84B;margin-bottom:9px}'
    + '.cc-disc-h svg{width:17px;height:17px;flex:none}'
    + '.cc-disc-t{font-size:12.5px;line-height:1.58;color:#c4ccd4;margin:0 0 8px}'
    + '.cc-disc-t.last{margin-bottom:0}'
    + '.cc-disc-a{display:flex;align-items:center;gap:12px;margin-top:16px}'
    + '.cc-disc-btn{flex:1 1 0;max-width:220px;min-width:0;'
    + 'display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;text-decoration:none;'
    + 'height:44px;padding:0 18px;border-radius:11px;'
    + 'font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:.2px;white-space:nowrap;'
    + 'border:1px solid #c79426;color:#241900;'
    + 'background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426);'
    + 'box-shadow:0 4px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5);text-shadow:0 1px 0 rgba(255,255,255,.28)}'
    + '.cc-disc-btn svg{width:15px;height:15px;flex:none}'
    + '.cc-disc-btn:hover{filter:brightness(1.06)}'
    + '.cc-disc-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}'
    + '@media(max-width:900px){.cc-disc{left:14px;right:14px;width:auto;bottom:88px;padding:16px;'
    + 'max-height:calc(100dvh - 110px);overflow:auto;scrollbar-width:thin;scrollbar-color:rgba(232,184,75,.5) transparent}'
    + '.cc-disc-push,.cc-disc-fl{display:none}'
    + '.cc-disc-top{display:block;width:124px;margin:2px auto 14px}'
    + '.cc-disc-a{flex-wrap:wrap}.cc-disc-btn{flex:1 1 0;max-width:none}}';

  /* Alinea la base del cuño con la base de los botones midiendo en vivo. El cuño
     se empuja hacia abajo con un "push" invisible; iteramos porque al moverlo el
     texto re-fluye. En movil no hace nada (el cuño va arriba, sin flotar). */
  function place(el) {
    var push = el.querySelector('.cc-disc-push');
    var fl = el.querySelector('.cc-disc-fl');
    var btn = el.querySelector('.cc-disc-a');
    if (!push || !fl || !btn) return;
    if (getComputedStyle(fl).display === 'none') { push.style.height = '0px'; return; }
    push.style.height = '0px';
    var cur = 0, best = 0, bestAbs = 1e9;
    for (var i = 0; i < 16; i++) {
      var d = Math.round(btn.getBoundingClientRect().bottom - fl.getBoundingClientRect().bottom);
      var a = d < 0 ? -d : d;
      if (a < bestAbs) { bestAbs = a; best = cur; }
      if (d === 0) break;
      cur = cur + Math.round(d * 0.55); if (cur < 0) cur = 0;
      push.style.height = cur + 'px';
    }
    if (bestAbs > 0) push.style.height = best + 'px';
  }

  function show() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var el = document.createElement('section');
    el.className = 'cc-disc'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Risk notice and terms');
    el.innerHTML = ''
      + '<div class="cc-disc-top"><img src="' + SEAL + '" alt="Disclaimer seal" width="124" height="124"></div>'
      + '<div class="cc-disc-push" aria-hidden="true"></div>'
      + '<div class="cc-disc-fl"><img src="' + SEAL + '" alt="Disclaimer seal" width="' + SEAL_D + '" height="' + SEAL_D + '"></div>'
      + '<div class="cc-disc-h">' + WARN + 'Risk notice</div>'
      + '<p class="cc-disc-t">This is a decentralized platform, and we never hold or move your funds: you alone control your wallet and your keys.</p>'
      + '<p class="cc-disc-t">Nothing we offer guarantees a fixed return, a profit, or the safety of your capital, in the short or long term. Crypto is a volatile, variable market and you can lose part or all of what you put in, so use only money you can afford to lose. Our bots and tools execute only the parameters you choose: they do not predict the market or ensure any result, and past or simulated results never guarantee future ones.</p>'
      + '<p class="cc-disc-t last">This is not financial, investment, legal, or tax advice. You are responsible for your own decisions and for how you use these tools, and we are not liable for your losses or for any misuse. Every contract we run is public and verifiable on BscScan.</p>'
      + '<div class="cc-disc-a">'
      +   '<button class="cc-disc-btn" type="button" id="cc-disc-ok">I understand</button>'
      +   '<a class="cc-disc-btn" href="transparency.html" role="button">' + SHIELD + 'Full transparency</a>'
      + '</div>';
    document.body.appendChild(el);
    place(el);
    requestAnimationFrame(function () { el.classList.add('in'); place(el); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(el); });
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { place(el); }, 150); });
    el.querySelector('#cc-disc-ok').addEventListener('click', function () {
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      el.classList.remove('in');
      setTimeout(function () { try { el.remove(); } catch (e) {} }, 340);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
