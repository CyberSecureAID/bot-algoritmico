/* aviso.js: avisos legales del modulo swap (sello rojo, mismo estilo que el de los bots).
   Dos avisos, BLOQUEANTES (no se cierran tocando fuera ni con Escape):
     avisoSwap()    al entrar a la pagina del swap. Una vez por navegador.
     avisoListing() al abrir "List your token". Una vez por navegador. Devuelve false si cancela.
   La casilla y los botones van al FINAL del texto, dentro del area con scroll: para firmar
   hay que bajar hasta ahi (no hay candado que bloquee la casilla). Textos en ingles. Sin guiones. Independiente: no importa nada de fuera. */

const SEAL = './img/disclaimer.webp';
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

/* ─────────── Aviso del SWAP ─────────── */
export function avisoSwap() {
  return mostrar({
    key: 'df_swap_ack_v1',
    titulo: 'Before you use the swap',
    ok: 'Enter the swap',
    enlace: '../../transparency.html',
    firma: 'I have read and I accept the <b>Terms and Conditions</b>. I understand that DecFreedom does not verify any token, does not guarantee any outcome and that I use the swap at my own risk.',
    cuerpo: ''
      + '<p class="av-t"><span class="g">DecFreedom does not guarantee the price, the execution or the outcome of any swap, and is not liable for any loss.</span> The swap is a non custodial interface over public liquidity on BNB Smart Chain. Your funds never leave your wallet until you sign, and every transaction is executed by public, verifiable contracts.</p>'
      + '<p class="av-t"><b>Anyone can create a token on BNB Smart Chain with any name or logo,</b> including fake versions of existing tokens and tokens that claim to represent projects that have no token. A name, a symbol or a logo proves nothing. If you buy an arbitrary token you may be unable to sell it back: some tokens block sales, charge hidden taxes, limit how much you can transfer or let their creator mint, freeze or drain them.</p>'
      + '<ul class="av-li">'
      +   '<li><b>Tokens you import or search.</b> Showing a token here does not mean it has been reviewed, approved or endorsed. You alone are responsible for checking the contract on BscScan before you trade.</li>'
      +   '<li><b>Community listings.</b> Tokens marked Community listing are sold by independent sellers at a price they set, not by DecFreedom. The 30 day return guarantee is a contract rule, not a promise about the value, the project or the future of that token.</li>'
      +   '<li><b>Price and slippage.</b> The amount you receive is an estimate. The final amount depends on liquidity and on the state of the network at execution, within the slippage limit you accept. Transactions can fail and gas spent on a failed transaction is not refundable.</li>'
      +   '<li><b>Your wallet, your keys.</b> We never hold your assets and cannot reverse, cancel or recover a transaction once it is signed. Review every signature your wallet shows you.</li>'
      + '</ul>'
      + '<p class="av-t">This is not financial, investment, legal or tax advice. By continuing you confirm you understand these risks and that you act on your own decision.</p>'
  });
}

/* ─────────── Aviso de LIST YOUR TOKEN ─────────── */
export function avisoListing() {
  return mostrar({
    key: 'df_listing_ack_v1',
    titulo: 'Before you list a token',
    ok: 'I agree, continue',
    cancelar: 'Cancel',
    firma: 'I have read and I accept the <b>Terms and Conditions</b> of List your token. I understand the fee is non refundable, that earnings are locked for 30 days, that buyers can return tokens during that period, and that DecFreedom is not liable for my listing.',
    cuerpo: ''
      + '<p class="av-t"><span class="g">DecFreedom is not responsible for your token, for its sales or for its lack of sales, and takes no liability for any loss derived from listing it here.</span> List your token is a non custodial, self service tool that runs on a public contract (MercadoTokens). We do not review, approve, promote or endorse any token, and we do not manage the funds of any sale.</p>'
      + '<ul class="av-li">'
      +   '<li><b>You are the seller.</b> You decide the name, the symbol, the logo, the amount and the price. You declare that you are entitled to sell those tokens, that the information you enter is true and that your token does not infringe the rights of anyone. Listing a token that imitates another project, or misleading buyers in any way, is your sole responsibility.</li>'
      +   '<li><b>No sales are guaranteed.</b> Listing does not create demand, does not provide liquidity and does not place your token on any exchange. If nobody buys, nothing is owed to you and the fee is not refunded.</li>'
      +   '<li><b>30 day safety lock.</b> What buyers pay stays locked in the contract for 30 days from the moment you list. You cannot withdraw those earnings earlier, nobody can, not even the platform owners. Until you withdraw them, any buyer can return the tokens and get back what they paid for them. This rule exists to protect buyers and it cannot be waived.</li>'
      +   '<li><b>Your tokens stay yours.</b> Unsold tokens can be withdrawn at any time. If your token applies a transfer tax, blocks transfers to contracts or limits amounts, the listing may fail or you may receive less: that is a property of your token, not of the platform.</li>'
      +   '<li><b>Removal.</b> The platform may hide or block a listing that is reported as fraudulent, that imitates another token or that breaks the law, without refunding the fee. On chain data cannot be deleted.</li>'
      + '</ul>'
      + '<div class="av-cost">'
      +   '<p><span class="g">Fee.</span> Listing costs the equivalent of <b>$25 in BNB</b> at the oracle price when the transaction executes. The fee is charged once, at listing time, and is not refundable, whether or not your token sells. Your wallet sends a small extra margin that the contract returns in the same transaction.</p>'
      +   '<p><span class="g">Withdrawal fee.</span> When you withdraw earnings a <b>5% fee</b> applies on the amount withdrawn. Withdrawing unsold tokens is free, except for network gas.</p>'
      +   '<p>By signing below you accept these terms as binding. If you do not agree, do not list.</p>'
      + '</div>'
      + '<p class="av-t">This is not financial, investment, legal or tax advice. Every contract is public and verifiable on BscScan.</p>'
  });
}
