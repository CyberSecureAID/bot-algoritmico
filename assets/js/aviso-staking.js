/* aviso-staking.js: aviso legal del area de Staking (sello rojo, mismo motor que swap y bots).
   avisoStaking() al entrar a la pagina. BLOQUEANTE, una vez por navegador.
   La casilla y los botones van al FINAL del texto, dentro del area con scroll: para firmar
   hay que bajar hasta ahi. Textos en ingles. Sin guiones. NO se nombra la fuente del farming. */

const SEAL = 'assets/portada/red/disclaimer.webp';
const WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
const SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';

let _css = false;
function css() {
  if (_css) return; _css = true;
  const st = document.createElement('style'); st.id = 'av-css';
  st.textContent = ''
    + '.av-ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;background:rgba(6,8,11,.78);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);opacity:0;transition:opacity .3s ease}'
    + '.av-ov.in{opacity:1}'
    + '.av-box{width:min(600px,100%);max-height:calc(100dvh - 36px);display:flex;flex-direction:column;box-sizing:border-box;border-radius:16px;'
    + 'background:linear-gradient(180deg,rgba(15,17,21,.99),rgba(9,10,13,.99));border:1px solid #5c4a1e;box-shadow:0 26px 70px rgba(0,0,0,.66),inset 0 1px 0 rgba(247,219,141,.12),0 6px 0 #352810;'
    + 'font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#d4dae1;transform:translateY(14px);transition:transform .3s ease}'
    + '.av-ov.in .av-box{transform:none}'
    + '.av-scroll{overflow:auto;padding:22px 24px 20px;display:flow-root;scrollbar-width:thin;scrollbar-color:rgba(232,184,75,.5) transparent;min-height:0}'
    + '.av-foot{clear:both;margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06)}'
    + '.av-top{display:none}'
    + '.av-fl{float:right;width:138px;height:138px;margin:2px 0 8px 18px;shape-outside:margin-box;user-select:none;pointer-events:none}'
    + '.av-fl img,.av-top img{width:100%;height:auto;display:block;filter:drop-shadow(0 6px 15px rgba(0,0,0,.55))}'
    + '.av-h{display:flex;align-items:center;gap:9px;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:15px;color:#E8B84B;margin:0 0 10px}'
    + '.av-h svg{width:18px;height:18px;flex:none}'
    + '.av-t{font-size:12.5px;line-height:1.6;color:#c4ccd4;margin:0 0 9px}'
    + '.av-t b{color:#e9eef3}'
    + '.av-t .g{color:#E8B84B;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700}'
    + '.av-li{list-style:none;margin:0 0 9px;padding:0}'
    + '.av-li li{font-size:12.5px;line-height:1.55;color:#c4ccd4;padding:5px 0;border-top:1px solid rgba(255,255,255,.055)}'
    + '.av-li li b{color:#E8B84B;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700}'
    + '.av-cost{clear:both;margin:12px 0 0;padding:13px 15px;border-radius:12px;background:rgba(232,184,75,.06);border:1px solid rgba(232,184,75,.22)}'
    + '.av-cost p{font-size:12.5px;line-height:1.6;color:#c4ccd4;margin:0}.av-cost p+p{margin-top:7px}'
    + '.av-cost .g{color:#E8B84B;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700}'
    + '.av-chk{display:flex;align-items:flex-start;gap:10px;margin:0;cursor:pointer;font-size:12.5px;line-height:1.5;color:#d4dae1}'
    + '.av-chk input{appearance:none;-webkit-appearance:none;flex:none;width:20px;height:20px;margin:0;border-radius:6px;border:1.5px solid #c79426;background:rgba(0,0,0,.4);cursor:pointer;position:relative}'
    + '.av-chk input:checked{background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426);border-color:#c79426}'
    + '.av-chk input:checked::after{content:"";position:absolute;left:6.5px;top:2.5px;width:5px;height:10px;border:solid #241900;border-width:0 2.4px 2.4px 0;transform:rotate(45deg)}'
    + '.av-a{display:flex;align-items:center;gap:12px;margin-top:14px}'
    + '.av-btn{flex:1 1 0;max-width:240px;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;text-decoration:none;height:46px;padding:0 18px;border-radius:12px;'
    + 'font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:.2px;white-space:nowrap;border:1px solid #c79426;color:#241900;'
    + 'background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426);box-shadow:0 4px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5);text-shadow:0 1px 0 rgba(255,255,255,.28);transition:filter .15s,opacity .15s}'
    + '.av-btn svg{width:15px;height:15px;flex:none}.av-btn:hover{filter:brightness(1.06)}'
    + '.av-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}'
    + '.av-btn.off{opacity:.4;cursor:not-allowed;filter:grayscale(.55)}.av-btn.off:active{transform:none}'
    + '.av-btn.sec{background:rgba(255,255,255,.04);color:#c4ccd4;border-color:#2c3946;box-shadow:none;text-shadow:none}'
    + '@media(max-width:620px){.av-scroll{padding:18px 16px 16px}.av-fl{display:none}'
    + '.av-top{display:block;width:112px;margin:0 auto 14px}.av-h{justify-content:center;text-align:center}'
    + '.av-a{flex-wrap:wrap}.av-btn{flex:1 1 100%;max-width:none}}';
  document.head.appendChild(st);
}

/* Muestra un aviso. Resuelve true al aceptar, false al cancelar (si hay boton de cancelar). */
function mostrar({ key, titulo, cuerpo, firma, ok, cancelar, enlace }) {
  try { if (localStorage.getItem(key)) return Promise.resolve(true); } catch (_) {}
  css();
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'av-ov';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', titulo);
    ov.innerHTML = ''
      + '<section class="av-box">'
      +   '<div class="av-scroll">'
      +     '<div class="av-top"><img src="' + SEAL + '" alt="" width="112" height="112"></div>'
      +     '<div class="av-fl"><img src="' + SEAL + '" alt="" width="138" height="138"></div>'
      +     '<div class="av-h">' + WARN + titulo + '</div>'
      +     cuerpo
      +   '<div class="av-foot">'
      +     '<label class="av-chk"><input type="checkbox" id="av-agree"><span>' + firma + '</span></label>'
      +     '<div class="av-a">'
      +       '<button class="av-btn off" type="button" id="av-ok" disabled>' + ok + '</button>'
      +       (cancelar ? '<button class="av-btn sec" type="button" id="av-no">' + cancelar + '</button>' : '')
      +       (enlace ? '<a class="av-btn sec" href="' + enlace + '" role="button">' + SHIELD + 'Full transparency</a>' : '')
      +     '</div>'
      +   '</div>'
      +   '</div>'
      + '</section>';
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('in'));
    ov.addEventListener('click', (e) => { if (e.target === ov) { e.preventDefault(); e.stopPropagation(); } });

    const chk = ov.querySelector('#av-agree'), okb = ov.querySelector('#av-ok');
    chk.addEventListener('change', () => {
      if (chk.checked) { okb.classList.remove('off'); okb.removeAttribute('disabled'); }
      else { okb.classList.add('off'); okb.setAttribute('disabled', ''); }
    });
    const cerrar = (v) => { ov.classList.remove('in'); setTimeout(() => { try { ov.remove(); } catch (_) {} }, 320); resolve(v); };
    okb.addEventListener('click', () => {
      if (!chk.checked) return;
      try { localStorage.setItem(key, '1'); } catch (_) {}
      cerrar(true);
    });
    const no = ov.querySelector('#av-no'); if (no) no.addEventListener('click', () => cerrar(false));
  });
}

/* --------------- Aviso del STAKING --------------- */
export function avisoStaking() {
  return mostrar({
    key: 'df_staking_ack_v1',
    titulo: 'Before you stake',
    ok: 'Enter Staking',
    enlace: '/transparency',
    firma: 'I have read and I accept the <b>Terms and Conditions</b>. I understand that rewards are variable and not guaranteed, and that I stake at my own risk.',
    cuerpo: ''
      + '<p class="av-t"><span class="g">DecFreedom does not guarantee any reward, yield or return, and is not liable for any loss.</span> Staking is a non custodial feature built on a public, verifiable contract on BNB Smart Chain. Your funds move only when you sign, and the contract releases them back to your wallet according to its own rules.</p>'
      + '<p class="av-t"><b>Rewards are variable and are never promised.</b> What you earn depends on how much the platform generates and on how many people stake at the same time. Rewards can go up, go down, or be zero for a period. No figure shown anywhere is a promise of future earnings.</p>'
      + '<ul class="av-li">'
      +   '<li><b>Where rewards come from.</b> Rewards are funded by the real activity of the platform and shared among stakers by their participation. They are not a fixed interest rate and they are not paid by DecFreedom out of its own pocket.</li>'
      +   '<li><b>Locks and withdrawals.</b> You withdraw according to the contract rules. If a lock or a waiting period applies, it is enforced by the contract and nobody, not even the platform owners, can bypass it.</li>'
      +   '<li><b>Smart contract risk.</b> Every contract is public and verifiable on BscScan, but interacting with any smart contract carries risk. You alone decide to take part.</li>'
      +   '<li><b>Your wallet, your keys.</b> We never hold your assets and cannot reverse a transaction once it is signed. Review every signature your wallet shows you.</li>'
      + '</ul>'
      + '<p class="av-t">This is not financial, investment, legal or tax advice. By continuing you confirm you understand these risks and that you act on your own decision.</p>'
  });
}
