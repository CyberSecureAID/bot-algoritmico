/* aviso.js: aviso legal del modulo Terminal (sello rojo, mismo motor que swap, bots y launchpad).
   avisoTerminal() al entrar a la pagina. BLOQUEANTE, una vez por navegador.
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
    + '.av-a{display:flex;align-items:stretch;justify-content:center;gap:12px;margin-top:14px}'
    + '.av-btn{flex:1 1 0;max-width:230px;min-width:0;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;text-decoration:none;height:46px;padding:0 18px;border-radius:12px;'
    + 'font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:.2px;white-space:nowrap;border:1px solid #c79426;color:#241900;'
    + 'background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426);box-shadow:0 4px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5);text-shadow:0 1px 0 rgba(255,255,255,.28);transition:filter .15s,opacity .15s}'
    + '.av-btn svg{width:15px;height:15px;flex:none}.av-btn:hover{filter:brightness(1.06)}'
    + '.av-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}'
    + '.av-btn.off{opacity:.4;cursor:not-allowed;filter:grayscale(.55)}.av-btn.off:active{transform:none}'
    + '.av-btn.sec{background:linear-gradient(180deg,#1b2027,#0d1117);color:#E8B84B;border-color:#8f6a1a;box-shadow:0 4px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06);text-shadow:none}.av-btn.sec:active{box-shadow:0 1px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06)}'
    + '@media(max-width:620px){.av-scroll{padding:18px 16px 16px}.av-fl{display:none}'
    + '.av-top{display:block;width:112px;margin:0 auto 14px}.av-h{justify-content:center;text-align:center}'
    + '.av-a{flex-direction:column}.av-btn{flex:1 1 auto;width:100%;max-width:none}}';
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
      +       (enlace ? '<a class="av-btn sec" href="' + enlace + '" role="button">' + SHIELD + 'Transparency</a>' : '')
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

/* Ventana informativa (sin firma): mismo marco, boton unico para cerrar. */
function mostrarInfo({ titulo, cuerpo, ok }) {
  css();
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'av-ov';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', titulo);
    ov.innerHTML = ''
      + '<section class="av-box"><div class="av-scroll">'
      +   '<div class="av-h">' + SHIELD + titulo + '</div>' + cuerpo
      +   '<div class="av-foot"><div class="av-a"><button class="av-btn" type="button" id="av-ok">' + ok + '</button></div></div>'
      + '</div></section>';
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('in'));
    const cerrar = () => { ov.classList.remove('in'); setTimeout(() => { try { ov.remove(); } catch (_) {} }, 320); resolve(true); };
    ov.querySelector('#av-ok').addEventListener('click', cerrar);
    ov.addEventListener('click', (e) => { if (e.target === ov) cerrar(); });
  });
}

/* ─────────── Aviso de la TERMINAL ─────────── */
export function avisoTerminal() {
  return mostrar({
    key: 'df_terminal_ack_v1',
    titulo: 'Before you use the Terminal',
    ok: 'Terminal',
    enlace: '../../transparency.html',
    firma: 'I have read and I accept the <b>Terms and Conditions</b> of the Terminal. I understand that every token shown here is created by third parties, that the security check is informative and not a recommendation, and that DecFreedom is not liable for any loss.',
    cuerpo: ''
      + '<p class="av-t"><span class="g">DecFreedom sells nothing and recommends nothing.</span> We build and lend the tools, the charts, the security reader and the swap window, and nothing more. We do not create, own, review, endorse, promote or sell any token shown here; every one of them is deployed by anonymous third parties we have no connection to and no control over. The Terminal is a non custodial, self service window on public blockchain data, and what you choose to buy or sell on it is your decision alone.</p>'
      + '<p class="av-t"><b>A green verdict is not our word that a token is good.</b> The Security Check is an automated reading of public blockchain data, nothing more. When it says a token looks safe it means that, at the moment it was read, the common on chain traps were not detected, not that we have validated, vouched for or blessed the project. A contract can change after it is read, a data source can be wrong, and a token with a clean report can still go to zero or turn against you. <span class="g">DecFreedom is not responsible for any token here, for who created it, for what it does, or for any loss from buying or selling it.</span></p>'
      + '<p class="av-t"><b>New tokens are the riskiest asset in crypto.</b> Most of them lose all their value within hours. Many are built to steal: honeypots that block selling, hidden taxes, liquidity that is pulled, supply that is minted. Speed does not make them safer; it makes mistakes faster.</p>'
      + '<ul class="av-li">'
      +   '<li><b>The security check is a reading, not a guarantee.</b> It reads what the contract allows today (selling, taxes, minting, pausing, ownership, liquidity locks) from public data. A contract can be changed later, a scanner can be wrong, and a token with no red flags can still go to zero. "Safe to trade" means no trap was found, not that you will make money.</li>'
      +   '<li><b>Prices move in seconds.</b> The estimate you see is not the amount you will receive. Slippage, token taxes and other traders change the result. Set your slippage knowingly; a high slippage can be exploited by bots.</li>'
      +   '<li><b>You trade from your wallet.</b> Every swap goes from your wallet through the public TerminalSwap contract to PancakeSwap and back to your wallet in one transaction. Nothing is held, pooled or managed by DecFreedom. We cannot refund, reverse or recover anything.</li>'
      +   '<li><b>You are responsible.</b> For your decisions, for the laws and taxes that apply where you live and for every signature you approve in your wallet. Trading new tokens may be restricted in your jurisdiction.</li>'
      + '</ul>'
      + '<div class="av-cost">'
      +   '<p><span class="g">Fees.</span> Each swap pays a <b>1% fee</b> in BNB to the DecFreedom ecosystem (0.10% to staking, 0.45% to each platform owner), taken inside the same transaction by the public TerminalSwap contract. PancakeSwap keeps its own pool fee and you pay the network gas. If a transaction reverts, nothing is charged except gas.</p>'
      +   '<p><span class="g">Non custodial.</span> We never hold your funds, we have no access to your keys and we cannot act on your behalf. Review every signature your wallet shows you.</p>'
      + '</div>'
      + '<p class="av-t">This is not financial, investment, legal or tax advice. By continuing you confirm you are of legal age where you live, that you understand these risks and that you act on your own decision.</p>'
  });
}

/* ─────────── How it works ─────────── */
export function comoFunciona() {
  return mostrarInfo({
    titulo: 'How the Terminal works',
    ok: 'Got it',
    cuerpo: ''
      + '<p class="av-t">The Terminal is a non custodial trading desk for brand new tokens on BNB Chain. It catches a coin the second its pair goes live, x rays its contract before you risk a cent, and lets you chart it, set alerts and trade it from your own wallet, without ever leaving the page or handing over your keys. <b>New to this?</b> A new token is a coin that was just created and has only just started trading. Its first minutes hold the highest potential and the highest risk; the Terminal is built to let you read that risk before you act.</p>'
      + '<ul class="av-li">'
      +   '<li><b>Prime Mover &amp; Top Movers.</b> The single biggest gainer on BNB Chain at this exact moment sits at the top, and the coins pumping hardest over the last 24 hours just below, both updated live. You see momentum as it forms instead of reading about it once it is over.</li>'
      +   '<li><b>New Pairs, the live feed.</b> Every fresh PancakeSwap pair against BNB or USDT, every coin born in the DecFreedom Launchpad, and any contract you paste, read straight off the chain within seconds. This is where the first minute opportunities, and the first minute risks, live.</li>'
      +   '<li><b>Filters.</b> Narrow that feed to your own rules, by liquidity, buyers, volume or age, so you only see the launches that fit your strategy and skip the noise.</li>'
      +   '<li><b>Tap any coin, open the Full Chart.</b> The card on the side shows a live example of what an open position looks like here. Tap it, or any coin in the feed, to open that coin in Open Full Chart: a professional candle chart with multiple timeframes, a drag to measure ruler that reads the exact move between two points, the full security report on one side and your trade panel on the other, all on one screen.</li>'
      +   '<li><b>Security Check.</b> One tap reads the contract live and keeps re reading it: can you actually sell, the real buy and sell tax, whether the owner can mint, pause or change the rules, how concentrated the supply is, and whether liquidity is locked or burned. It cross checks several independent on chain sources at once and scores the creator wallet against a history of past scams. The verdict is a clear traffic light, green, caution or do not buy, with a full report you can download. A block explorer will not tell you that a coin cannot be sold, that the tax is 40%, or that the deployer is tied to ten earlier rug pulls. This does.</li>'
      +   '<li><b>Price alerts, including Tron.</b> Set a target price, or a percentage move, and you get a notification the instant the price touches it while the Terminal is open, never before. You can set alerts on Tron coins too, not only BNB Chain, and every alert you create is listed together so none ever gets lost. Right click the chart to set one at the exact level under your cursor.</li>'
      +   '<li><b>Positions &amp; History.</b> Every buy you make here becomes a position with its live profit or loss as the price moves, and jumps straight back to its chart so you can set an alert to take profit or cut a loss. Your swaps and orders are recorded in History, so you can review what you did, when and at what price.</li>'
      + '</ul>'
      + '<div class="av-cost">'
      +   '<p><span class="g">Your wallet, always.</span> Every trade goes from your wallet through a public smart contract to PancakeSwap and back to you in a single transaction. Nothing is pooled, held or managed for you, and you approve every signature yourself.</p>'
      +   '<p><span class="g">Free to look, $2.50 a month to go deep.</span> The live feed and the charts are open to everyone. Unlocking the Terminal turns on Prime Mover and Top Movers, the full multi source security diagnosis on every coin, the downloadable report and the Protect safety mode on your buys, for $2.50 a month paid in BNB. One payment unlocks the whole Terminal for 30 days.</p>'
      + '</div>'
      + '<p class="av-t"><b>No promises.</b> The Terminal helps you find and act on moves early, and people do make real money here, but we guarantee nothing. There is no assurance any coin will move, and a new token can lose all of its value in minutes. Only ever buy with money you are fully prepared to lose. We hand you the information and the tools to act fast; the market risk, and the decision, stay entirely yours.</p>'
  });
}
