/* disclaimer.js. Aviso de riesgo tipo "cookies". Sale a CUALQUIER visitante al
   entrar a la pagina, una sola vez (se recuerda en localStorage). Deja claro que
   no se garantiza ningun rendimiento. Es un archivo independiente: no importa ni
   toca ningun otro modulo de la pagina; si se quita el <script>, desaparece y ya.
   Requisito de Blockaid: aviso visible de "returns not guaranteed" al llegar. */
(function () {
  'use strict';
  var KEY = 'cc_risk_ack_v1';
  try { if (localStorage.getItem(KEY)) return; } catch (e) {}

  var css = ''
    + '.cc-disc{position:fixed;left:20px;bottom:20px;z-index:190;width:min(520px,calc(100vw - 40px));'
    + 'box-sizing:border-box;padding:16px 18px;border-radius:14px;'
    + 'background:linear-gradient(180deg,rgba(14,16,20,.97),rgba(8,9,12,.97));'
    + 'border:1px solid #5c4a1e;box-shadow:0 18px 50px rgba(0,0,0,.6),inset 0 1px 0 rgba(247,219,141,.12),0 5px 0 #352810;'
    + 'font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#d4dae1;'
    + 'transform:translateY(18px);opacity:0;transition:transform .34s ease,opacity .34s ease}'
    + '.cc-disc.in{transform:none;opacity:1}'
    + '.cc-disc-h{display:flex;align-items:center;gap:8px;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:13.5px;color:#E8B84B;margin-bottom:7px}'
    + '.cc-disc-h svg{width:16px;height:16px;flex:none}'
    + '.cc-disc-t{font-size:12.5px;line-height:1.55;color:#c4ccd4;margin:0}'
    + '.cc-disc-a{display:flex;align-items:center;gap:16px;margin-top:13px}'
    + '.cc-disc-ok{flex:none;cursor:pointer;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:12.5px;'
    + 'height:36px;padding:0 22px;border-radius:9px;border:1px solid #c79426;color:#241900;'
    + 'background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426);box-shadow:0 3px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}'
    + '.cc-disc-ok:hover{filter:brightness(1.06)}'
    + '.cc-disc-ok:active{transform:translateY(2px);box-shadow:0 1px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}'
    + '.cc-disc-more{font-size:11.5px;color:#9aa6b2;text-decoration:none;border-bottom:1px solid rgba(154,166,178,.35)}'
    + '.cc-disc-more:hover{color:#E8B84B;border-color:#8f6a1a}'
    + '@media(max-width:560px){.cc-disc{left:14px;right:14px;width:auto;bottom:88px;padding:14px}}';

  function show() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var el = document.createElement('section');
    el.className = 'cc-disc'; el.setAttribute('role', 'note'); el.setAttribute('aria-label', 'Risk notice');
    el.innerHTML = ''
      + '<div class="cc-disc-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>Before you start</div>'
      + '<p class="cc-disc-t">This is a decentralized platform. Nothing we offer guarantees a fixed return or profit, in the short or long term. Crypto is a variable market where prices rise and fall, and you can lose part or all of what you put in. Our tools are yours to use, and we are not responsible for their misuse. This is not financial advice, and we never hold your funds: you alone control your wallet and your keys.</p>'
      + '<div class="cc-disc-a"><button class="cc-disc-ok" type="button">I understand</button><a class="cc-disc-more" href="transparency.html">Full transparency</a></div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('in'); });
    el.querySelector('.cc-disc-ok').addEventListener('click', function () {
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      el.classList.remove('in');
      setTimeout(function () { try { el.remove(); } catch (e) {} }, 340);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
