// tutorial.js: Guia de los bots. Módulo independiente (no toca la lógica existente).

const $ = (id) => document.getElementById(id);

/* ───────── Iconos ───────── */
const ICO = {
  grid: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  acum: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>`,
  cash: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  dca:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>`
};
const COL = { grid: '#4d9fff', acum: '#b47cff', cash: '#E8B84B', dca: '#34d97b' };

/* ───────── Contenido ───────── */
const BOTS = {
  grid: {
    nom: 'Smart Grid', tag: 'Profit from the ups and downs of the price',
    idea: 'It splits a price range into steps. Buys low, sells high, and repeats every time the price moves inside that range.',
    pasos: [
      'You choose a minimum and a maximum price.',
      'The bot spreads your money across several steps.',
      'Every time the price drops one step, it buys.',
      'Every time it rises one step, it sells with profit.'
    ],
    eco: 'The market almost never goes up in a straight line: it rises, falls, corrects and rises again. That swing, which annoys most people, is <em>exactly where the profit comes from</em> here. Each completed step leaves a small gain, and many small repeated gains add up.',
    cadena: 'Every order runs from a contract on BNB Smart Chain against PancakeSwap liquidity. Your funds <em>never leave your control</em>: the bot only has permission to trade the pair you defined.',
    para: 'For sideways or choppy markets, when you do not want to guess the direction.'
  },
  acum: {
    nom: 'Accumulator', tag: 'The balance between patience and profit', destacado: true,
    idea: 'Buys more the cheaper it gets, improves your average price, and sells everything together when the whole position reaches the gain you set.',
    pasos: [
      'It makes an initial purchase at market price.',
      'If the price drops, it buys again, and <em>buys more</em> than the previous time.',
      'Each cheap purchase <em>lowers your average</em> entry price.',
      'When the total gains the % you chose, it sells everything together and starts again.'
    ],
    eco: 'Here is the key, and it is simple: if the price falls, instead of losing sleep, <em>the bot buys cheaper and in larger size</em>. That drags your average price down. And since your average dropped, you <em>no longer need the market back at the top</em> to profit: a rebound is enough.',
    cadena: 'Every purchase and the final sale are recorded on the blockchain, with price and time. You can audit your average price and your real profit whenever you want; you do not depend on anyone telling you.',
    para: 'For those entering with capital who want dips to work for them instead of against them.'
  },
  cash: {
    nom: 'Cash Out', tag: 'Turn what you already hold into a working position',
    idea: 'You already hold the coin. The bot sells half now as a stablecoin reserve, keeps half as position, buys back on dips with the reserve, and sells everything once the position is worth your cost plus your target.',
    pasos: [
      'You choose the coin you already hold and how much to commit.',
      'Half is sold right away: that is your reserve in USDT or USDC.',
      'On each dip, it buys back one level with the reserve, lowering your average.',
      'At cost plus your target, it sells everything and starts a new 50/50 cycle.'
    ],
    eco: 'The most expensive mistake is usually not buying badly, but <em>holding through a drop with nothing in reserve</em>. Keeping half in stablecoin means every dip becomes a cheaper buy, and the exit is fixed in advance: the price arrives, it executes, done.',
    cadena: 'The rules live in the contract, not on our server. The sale of everything only happens above your cost plus target: <em>the contract refuses any sale below that floor</em>. Only you can cancel it.',
    para: 'For those who already have a position and want a disciplined exit with a cushion for dips.'
  },
  dca: {
    nom: 'DCA · Auto buy', tag: 'Build a position without stress',
    idea: 'Buys a fixed amount every set period, whatever the price does. The calmest way to enter the market.',
    pasos: [
      'You choose which coin to buy and what to pay with.',
      'You set how much to buy and how often.',
      'The bot buys on its own, every cycle.',
      'Your crypto lands straight in your wallet.'
    ],
    eco: 'Nobody nails the exact bottom, not even professionals. Buying spread over time, sometimes you buy high and sometimes low, and <em>the average brings you close to a fair price</em> without asking you to guess anything. It is the most boring strategy, and for that very reason one of the most sensible.',
    cadena: 'Each scheduled purchase executes on chain at its exact time and leaves its record. You can stop the plan whenever you want: you are in charge.',
    para: 'For those who want to enter little by little, without stress and without watching charts.'
  }
};

/* ───────── Estilos ───────── */
function estilos() {
  if ($('tuto-css')) return;
  const s = document.createElement('style'); s.id = 'tuto-css';
  s.textContent = `
  #colmena-app .tuto-fila{margin:0 0 16px}
  #colmena-app .tuto-lab{font-family:var(--mono,monospace);font-size:10.5px;color:var(--ink-3,#7d8794);text-transform:uppercase;letter-spacing:.9px;margin-bottom:9px;display:flex;align-items:center;gap:7px}
  #colmena-app .tuto-lab b{color:var(--gold,#E8B84B);font-weight:800;letter-spacing:.3px}
  #colmena-app .tuto-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
  #colmena-app .tuto-b{position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;padding:14px 8px 12px;border-radius:14px;cursor:pointer;background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid var(--bc,#2b3139);box-shadow:0 4px 0 rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.04);transition:filter .14s,box-shadow .14s}
  #colmena-app .tuto-b:hover{filter:brightness(1.16);box-shadow:0 4px 0 rgba(0,0,0,.32),0 8px 20px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06)}
  #colmena-app .tuto-b:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(0,0,0,.32)}
  #colmena-app .tuto-b .ti{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.05);border:1px solid var(--bc,#2b3139);color:var(--bc,#eaecef)}
  #colmena-app .tuto-b .tn{font-family:var(--display,sans-serif);font-weight:700;font-size:12px;color:var(--ink,#eaecef);text-align:center;line-height:1.2}
  #colmena-app .tuto-b .tv{font-family:var(--mono,monospace);font-size:9px;color:var(--ink-3,#7d8794);display:flex;align-items:center;gap:3px}
  #colmena-app .tuto-b .rec{position:absolute;top:-8px;right:-5px;font-family:var(--display,sans-serif);font-weight:800;font-size:8.5px;padding:4px 9px;border-radius:10px;color:#f7db8d;letter-spacing:.3px;
    background:linear-gradient(180deg,#8f4de0,#6a2fb0 55%,#4a1d80);
    border:1px solid transparent;background-origin:border-box;background-clip:padding-box,border-box;
    background-image:linear-gradient(180deg,#8f4de0,#6a2fb0 55%,#4a1d80),linear-gradient(150deg,#f7db8d,#c79426 35%,#8f6a1a 58%,#f0d488 80%,#c79426);
    box-shadow:0 2px 0 #3a1566,0 5px 12px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.22);
    text-shadow:0 1px 2px rgba(0,0,0,.6);white-space:nowrap;overflow:hidden;z-index:2}
  #colmena-app .tuto-b .rec::after{content:'';position:absolute;top:0;bottom:0;left:-60%;width:45%;background:linear-gradient(105deg,transparent,rgba(255,255,255,.4),transparent);transform:skewX(-20deg);animation:recShine2 6s ease-in-out infinite}
  @keyframes recShine2{0%,88%{left:-60%}100%{left:130%}}
  @media(prefers-reduced-motion:reduce){#colmena-app .tuto-b .rec::after{animation:none}}
  @media(max-width:560px){
    #colmena-app .tuto-grid{grid-template-columns:1fr 1fr;gap:8px}
    #colmena-app .tuto-b{padding:12px 6px 10px}
    #colmena-app .tuto-b .ti{width:34px;height:34px;border-radius:10px}
    #colmena-app .tuto-b .tn{font-size:11px}
  }

  #tuto-overlay{position:fixed;inset:0;z-index:9200;display:none;align-items:center;justify-content:center;background:rgba(3,5,8,.8);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);padding:18px}
  #tuto-overlay.show{display:flex}
  #tuto-overlay *{box-sizing:border-box}
  #tuto-overlay .tu-card{width:100%;max-width:640px;max-height:92vh;overflow:auto;background:linear-gradient(180deg,#12161c,#0b0e12);border:1px solid #2b3139;border-radius:20px;box-shadow:0 40px 120px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.04);padding:24px;position:relative;animation:tuIn .18s ease both}
  @keyframes tuIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  #tuto-overlay .tu-x{position:absolute;top:15px;right:15px;width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;display:grid;place-items:center;cursor:pointer;font-size:16px;z-index:3}
  #tuto-overlay .tu-x:hover{color:#fff;background:rgba(255,255,255,.1)}
  #tuto-overlay .tu-h{display:flex;align-items:center;gap:13px;padding-right:44px;padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid #2b3139}
  #tuto-overlay .tu-ico{width:52px;height:52px;flex:0 0 auto;border-radius:15px;display:grid;place-items:center;background:rgba(255,255,255,.05);border:1px solid var(--c);color:var(--c);box-shadow:0 4px 0 rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.07)}
  #tuto-overlay .tu-nom{font-family:var(--display,sans-serif);font-weight:800;font-size:22px;color:var(--c);line-height:1.15}
  #tuto-overlay .tu-tag{font-family:var(--mono,monospace);font-size:11.5px;color:#7d8794;margin-top:3px}
  #tuto-overlay .tu-rec{display:inline-block;margin-left:8px;font-family:var(--display,sans-serif);font-weight:800;font-size:9.5px;padding:3px 9px;border-radius:10px;color:#e5d2ff;background:rgba(180,124,255,.22);border:1px solid rgba(200,160,255,.5);vertical-align:middle}
  #tuto-overlay .tu-idea{font-family:var(--sans,sans-serif);font-size:14.5px;color:#eaecef;line-height:1.6;background:rgba(255,255,255,.03);border-left:3px solid var(--c);border-radius:0 12px 12px 0;padding:14px 16px;margin-bottom:18px}
  #tuto-overlay .tu-sec{margin-bottom:18px}
  #tuto-overlay .tu-st{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:1px;margin-bottom:9px}
  #tuto-overlay .tu-paso{display:flex;gap:11px;align-items:flex-start;padding:11px 13px;border-radius:11px;background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid #2b3139;margin-bottom:7px;box-shadow:0 2px 0 rgba(0,0,0,.3)}
  #tuto-overlay .tu-paso .n{flex:0 0 auto;width:24px;height:24px;border-radius:8px;display:grid;place-items:center;font-family:var(--display,sans-serif);font-weight:800;font-size:12px;background:var(--c);color:#0b0e12;box-shadow:0 2px 0 rgba(0,0,0,.4)}
  #tuto-overlay .tu-paso .t{font-family:var(--sans,sans-serif);font-size:13px;color:#b7bdc6;line-height:1.5;padding-top:2px}
  #tuto-overlay .tu-p{font-family:var(--sans,sans-serif);font-size:13.5px;color:#8b96a3;line-height:1.65;margin:0}
  #tuto-overlay .tu-p em{color:var(--c);font-style:normal;font-weight:600}
  #tuto-overlay .tu-box{background:rgba(255,255,255,.02);border:1px solid #2b3139;border-radius:13px;padding:14px 16px}
  #tuto-overlay .tu-para{font-family:var(--mono,monospace);font-size:11.5px;color:#7d8794;text-align:center;line-height:1.6;padding:12px;border-radius:11px;background:rgba(255,255,255,.02);border:1px dashed #2b3139;margin-bottom:16px}
  #tuto-overlay .tu-cta{width:100%;padding:14px;border-radius:12px;font-family:var(--display,sans-serif);font-weight:800;font-size:15px;cursor:pointer;border:1px solid var(--c);background:var(--c);color:#0b0e12;box-shadow:0 4px 0 rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.3)}
  #tuto-overlay .tu-cta:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.45)}
  @media(max-width:560px){
    #tuto-overlay{padding:0}
    #tuto-overlay .tu-card{max-width:100%;max-height:100vh;height:100vh;border-radius:0;border:none;padding:18px 15px}
    #tuto-overlay .tu-nom{font-size:19px}
    #tuto-overlay .tu-ico{width:44px;height:44px;border-radius:13px}
    #tuto-overlay .tu-idea{font-size:13.5px;padding:12px 14px}
  }
  `;
  document.head.appendChild(s);
}

/* ───────── Fila de 4 bots (se inyecta en "¿Tienes dudas?") ───────── */
export function filaBots() {
  const b = (k) => {
    const d = BOTS[k];
    return `<button type="button" class="tuto-b" data-tuto="${k}" style="--bc:${COL[k]}">
      ${d.destacado ? '<span class="rec">Recomendado</span>' : ''}
      <span class="ti">${ICO[k]}</span>
      <span class="tn">${d.nom}</span>
      <span class="tv">View guide</span>
    </button>`;
  };
  return `<div class="tuto-fila">
    <div class="tuto-lab">Bot guide · <b>tap one to learn</b></div>
    <div class="tuto-grid">${b('grid')}${b('acum')}${b('cash')}${b('dca')}</div>
  </div>`;
}

/* ───────── Overlay ───────── */
function overlay() {
  let o = $('tuto-overlay');
  if (o) return o;
  o = document.createElement('div'); o.id = 'tuto-overlay';
  o.innerHTML = `<div class="tu-card" id="tu-card"></div>`;
  document.body.appendChild(o);
  o.addEventListener('click', (e) => { if (e.target === o) cerrar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  return o;
}
function cerrar() { const o = $('tuto-overlay'); if (o) o.classList.remove('show'); }

/* ───────── Abrir guía de un bot ───────── */
export function abrirTutorial(k) {
  const d = BOTS[k]; if (!d) return;
  estilos();
  const o = overlay(); const card = $('tu-card');
  card.style.setProperty('--c', COL[k]);
  card.innerHTML = `
  <button class="tu-x" id="tu-x" aria-label="Cerrar">✕</button>
  <div class="tu-h">
    <div class="tu-ico">${ICO[k]}</div>
    <div>
      <div class="tu-nom">${d.nom}${d.destacado ? '<span class="tu-rec">Recommended</span>' : ''}</div>
      <div class="tu-tag">${d.tag}</div>
    </div>
  </div>

  <div class="tu-idea">${d.idea}</div>

  <div class="tu-sec">
    <div class="tu-st">How it works, step by step</div>
    ${d.pasos.map((p, i) => `<div class="tu-paso"><span class="n">${i + 1}</span><span class="t">${p}</span></div>`).join('')}
  </div>

  <div class="tu-sec">
    <div class="tu-st">Why it works</div>
    <div class="tu-box"><p class="tu-p">${d.eco}</p></div>
  </div>

  <div class="tu-sec">
    <div class="tu-st">What the blockchain guarantees you</div>
    <div class="tu-box"><p class="tu-p">${d.cadena}</p></div>
  </div>

  <div class="tu-para">${d.para}</div>
  <button class="tu-cta" id="tu-usar">Usar ${d.nom}</button>`;

  $('tu-x').onclick = cerrar;
  const usar = $('tu-usar');
  if (usar) usar.onclick = () => {
    cerrar();
    const btn = document.querySelector(`#colmena-app .bot-tab[data-tipo="${k}"]`);
    if (btn) { btn.click(); btn.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  };
  o.classList.add('show');
  card.scrollTop = 0;
}

/* ───────── Cablear la fila ───────── */
export function wireFila(root) {
  estilos();
  (root || document).querySelectorAll('[data-tuto]').forEach((b) => {
    b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); abrirTutorial(b.getAttribute('data-tuto')); };
  });
}
