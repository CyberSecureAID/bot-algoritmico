/* ══════════════════════════════════════════════════════════════════════
   futuros-movil.js — Interfaz de Futuros para MÓVIL (fix 7 parte 2)
   ══════════════════════════════════════════════════════════════════════
   Estilo app de exchange: gráfica arriba, panel de orden abajo. Reutiliza
   la gráfica de velas limpia (futuros-grafica.js) y el clic/toque para
   operar (futuros-orden.js) que ya se hicieron para la web.

   Igual que Spot móvil pero con: aislado/cruzado, apalancamiento hasta 200×,
   y sin bots (los bots solo van en Spot). Fase actual: interfaz (sin contrato).

   Texto en español (base), traducido por idioma.js.
*/

const PARES = [
  ['BTCUSDT','BTC','bitcoin'],['ETHUSDT','ETH','ethereum'],['BNBUSDT','BNB','binancecoin'],
  ['SOLUSDT','SOL','solana'],['XRPUSDT','XRP','ripple'],['DOGEUSDT','DOGE','dogecoin'],
  ['ADAUSDT','ADA','cardano'],['AVAXUSDT','AVAX','avalanche-2'],['LINKUSDT','LINK','chainlink'],
  ['DOTUSDT','DOT','polkadot'],['NEARUSDT','NEAR','near'],['LTCUSDT','LTC','litecoin'],
  ['ATOMUSDT','ATOM','cosmos'],['UNIUSDT','UNI','uniswap'],['INJUSDT','INJ','injective-protocol'],
  ['APTUSDT','APT','aptos'],['ARBUSDT','ARB','arbitrum'],['OPUSDT','OP','optimism'],
  ['FILUSDT','FIL','filecoin'],['SUIUSDT','SUI','sui']
];

let _cssPuesto = false;
const LOGOS = {};

function estilos() {
  if (_cssPuesto) return;
  _cssPuesto = true;
  const css = `
  #fm{display:flex;flex-direction:column;height:100%;
    --gold:#E8B84B;--up:#22c55e;--up-d:#16a34a;--down:#f6465d;--down-d:#e11d48;
    --ink:#eef1f6;--ink2:#a9b2bd;--ink3:#7d8794;--ink4:#4a5561;--line:#232b36;
    --disp:'Plus Jakarta Sans',sans-serif;--mono:'IBM Plex Mono',monospace}
  #fm .fm-top{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line)}
  #fm .fm-sel{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid var(--line);
    border-radius:11px;padding:7px 11px;cursor:pointer}
  #fm .fm-sel img{width:22px;height:22px;border-radius:50%}
  #fm .fm-sel b{font-family:var(--disp);font-weight:800;font-size:15px;color:var(--ink)}
  #fm .fm-sel .cv{color:var(--ink3);font-size:10px}
  #fm .fm-px{margin-left:auto;text-align:right}
  #fm .fm-px b{font-family:var(--mono);font-size:15px;color:var(--ink)}
  #fm .fm-px span{display:block;font-family:var(--mono);font-size:11px;font-weight:700}
  #fm .fm-px .up{color:var(--up)} #fm .fm-px .down{color:var(--down)}

  #fm .fm-tf{display:flex;gap:2px;padding:6px 10px;border-bottom:1px solid var(--line);overflow-x:auto}
  #fm .fm-tf button{flex:0 0 auto;background:none;border:none;color:var(--ink3);font-family:var(--mono);
    font-size:11px;font-weight:700;padding:5px 9px;border-radius:7px;cursor:pointer}
  #fm .fm-tf button.on{color:var(--gold);background:rgba(232,184,75,.12)}

  #fm .fm-chart{position:relative;height:38vh;min-height:220px;border-bottom:1px solid var(--line)}
  #fm .fm-chart .fg-cv{width:100%;height:100%;display:block}
  #fm .fm-chart .fg-load{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:var(--mono);font-size:12px;color:var(--ink3)}

  #fm .fm-panel{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:11px}
  #fm .fm-ls{display:flex;gap:8px}
  #fm .fm-ls button{flex:1;height:42px;border-radius:11px;border:1px solid var(--line);background:rgba(10,14,19,.6);
    color:var(--ink2);font-weight:800;font-size:14px;cursor:pointer}
  #fm .fm-ls button.on.long{background:linear-gradient(180deg,#2fd67d,var(--up-d));border-color:#15803d;color:#052e13}
  #fm .fm-ls button.on.short{background:linear-gradient(180deg,#fb5c6f,var(--down-d));border-color:#be123c;color:#fff}

  #fm .fm-mode{display:flex;gap:7px}
  #fm .fm-mode button{flex:1;height:32px;border-radius:9px;border:1px solid var(--line);background:rgba(10,14,19,.55);
    color:var(--ink2);font-family:var(--mono);font-size:11px;font-weight:700;cursor:pointer}
  #fm .fm-mode button b{color:var(--gold);font-family:var(--disp)}

  #fm .fm-lbl{font-family:var(--mono);font-size:10px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
  #fm .fm-box{display:flex;align-items:center;background:rgba(10,14,19,.55);border:1px solid var(--line);border-radius:10px;padding:0 12px;height:46px}
  #fm .fm-box input{flex:1;min-width:0;background:transparent;border:none;outline:none;color:var(--ink);font-family:var(--disp);font-weight:700;font-size:18px}
  #fm .fm-box input::placeholder{color:var(--ink4)} #fm .fm-box .u{font-family:var(--disp);font-weight:700;font-size:12px;color:var(--ink2)}

  #fm .fm-lev-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
  #fm .fm-lev-val{font-family:var(--disp);font-weight:800;font-size:17px;color:var(--gold)}
  #fm input[type=range]{width:100%;accent-color:var(--gold);cursor:pointer}

  #fm .fm-info{display:flex;flex-direction:column;gap:5px;padding:10px 12px;background:rgba(10,14,19,.4);border:1px solid var(--line);border-radius:11px}
  #fm .fm-info .r{display:flex;justify-content:space-between;font-family:var(--mono);font-size:11.5px}
  #fm .fm-info .r span{color:var(--ink3)} #fm .fm-info .r b{color:var(--ink)} #fm .fm-info .r b.liq{color:var(--down)}

  #fm .fm-go{height:50px;border:none;border-radius:12px;font-weight:800;font-size:15px;cursor:pointer;color:#052e13;
    background:linear-gradient(180deg,#2fd67d,var(--up-d));box-shadow:0 4px 0 #0f5c30}
  #fm .fm-go.short{color:#fff;background:linear-gradient(180deg,#fb5c6f,var(--down-d));box-shadow:0 4px 0 #8f0f2e}
  #fm .fm-go:active{transform:translateY(2px)}

  #fm .fm-pos{border-top:1px solid var(--line);padding-top:10px}
  #fm .fm-pos-empty{font-family:var(--mono);font-size:12px;color:var(--ink4);text-align:center;padding:14px}

  /* Selector de moneda a pantalla completa. */
  .fm-sheet{position:fixed;inset:0;z-index:400;display:flex;flex-direction:column;background:#0b0e13}
  .fm-sheet .sh-head{display:flex;align-items:center;gap:10px;padding:14px;border-bottom:1px solid #232b36}
  .fm-sheet .sh-head b{font-family:'Plus Jakarta Sans';font-weight:800;font-size:17px;color:#eef1f6}
  .fm-sheet .sh-x{margin-left:auto;width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid #232b36;color:#7d8794}
  .fm-sheet .sh-list{flex:1;overflow-y:auto;padding:8px}
  .fm-sheet .sh-opt{display:flex;align-items:center;gap:11px;padding:12px;border-radius:11px;cursor:pointer}
  .fm-sheet .sh-opt:active{background:rgba(232,184,75,.08)}
  .fm-sheet .sh-opt img{width:28px;height:28px;border-radius:50%}
  .fm-sheet .sh-opt b{font-family:'Plus Jakarta Sans';font-weight:700;font-size:15px;color:#eef1f6}
  `;
  const st = document.createElement('style');
  st.id = 'fm-css';
  st.textContent = css;
  document.head.appendChild(st);
}

const fmt = (p) => !p ? '—' : (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 1 }) : p >= 1 ? p.toFixed(2) : p.toPrecision(4));
function liqDe(e, l, esL) { const f = 0.75; return esL ? e * (1 - f / l) : e * (1 + f / l); }

export async function pintarFuturos(host) {
  if (!host) return;
  estilos();

  let sim = 'BTCUSDT', tf = '15m', lado = 'long', lev = 10, modo = 'aislado', precio = 0, chg = 0;

  host.innerHTML = `
    <div id="fm">
      <div class="fm-top">
        <button class="fm-sel" id="fm-sel"><span id="fm-ico"></span><b id="fm-sym">BTC/USDT</b><span class="cv">▼</span></button>
        <div class="fm-px"><b id="fm-price">—</b><span id="fm-chg">—</span></div>
      </div>
      <div class="fm-tf" id="fm-tf">
        ${['1m','5m','15m','1h','4h','1d'].map(t => `<button data-tf="${t}"${t === '15m' ? ' class="on"' : ''}>${t}</button>`).join('')}
      </div>
      <div class="fm-chart" id="fm-chart"></div>
      <div class="fm-panel">
        <div class="fm-ls">
          <button class="long on" data-lado="long">Long</button>
          <button class="short" data-lado="short">Short</button>
        </div>
        <div class="fm-mode">
          <button id="fm-mode">Aislado</button>
          <button id="fm-levbtn">Apalanc. <b id="fm-levbtn-v">10×</b></button>
        </div>
        <div>
          <div class="fm-lbl">Margen</div>
          <div class="fm-box"><input id="fm-margen" type="text" inputmode="decimal" placeholder="0.00"><span class="u">USDT</span></div>
        </div>
        <div>
          <div class="fm-lev-top"><span class="fm-lbl" style="margin:0">Apalancamiento</span><span class="fm-lev-val" id="fm-lev">10×</span></div>
          <input type="range" id="fm-range" min="1" max="200" value="10" step="1">
        </div>
        <div class="fm-info">
          <div class="r"><span>Tamaño de posición</span><b id="fm-size">—</b></div>
          <div class="r"><span>Precio de liquidación</span><b class="liq" id="fm-liq">—</b></div>
        </div>
        <button class="fm-go" id="fm-go">Abrir Long</button>
        <div class="fm-pos">
          <div class="fm-lbl">Tus posiciones</div>
          <div class="fm-pos-empty" id="fm-pos-list">No tienes posiciones abiertas.</div>
        </div>
      </div>
    </div>`;

  const $ = (id) => document.getElementById(id);

  // Cargar logos de CoinGecko.
  (async () => {
    try {
      const ids = PARES.map(p => p[2]).join(',');
      const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + ids + '&per_page=250');
      if (r.ok) { (await r.json()).forEach(c => LOGOS[c.id] = c.image); actualizarIco(); }
    } catch (_) {}
  })();
  const logoDe = (cg) => LOGOS[cg] ? `<img src="${LOGOS[cg]}">` : '';
  function actualizarIco() { const p = PARES.find(x => x[0] === sim); if (p && LOGOS[p[2]]) $('fm-ico').innerHTML = logoDe(p[2]); }

  // Gráfica.
  const { crearGrafica } = await import('../futuros-grafica.js?v=3');
  const { conectarFuturos, pintarPosiciones, posiciones, abrirDesdePanel, cerrarPosicion } = await import('../futuros-orden.js?v=3');
  const g = crearGrafica($('fm-chart'));
  g.cargar(sim, tf);
  conectarFuturos(g.cfg);
  g.alDibujar((api) => pintarPosiciones(api));

  function refrescar() {
    precio = g.cfg.precioActual() || precio;
    const margen = parseFloat(($('fm-margen').value || '').replace(/,/g, '')) || 0;
    $('fm-size').textContent = margen ? fmt(margen * lev) + ' USDT' : '—';
    $('fm-liq').textContent = (precio && margen) ? '$' + fmt(liqDe(precio, lev, lado === 'long')) : '—';
    const ps = posiciones();
    $('fm-pos-list').innerHTML = ps.length
      ? ps.map(p => `<div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:12px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">
          <span style="color:${p.lado === 'long' ? '#22c55e' : '#f6465d'};font-weight:800">${p.lado === 'long' ? 'LONG' : 'SHORT'} ${p.lev}×</span>
          <span style="color:#a9b2bd">$${fmt(p.precio)}</span></div>`).join('')
      : 'No tienes posiciones abiertas.';
  }

  $('fm-tf').querySelectorAll('button').forEach(b => b.onclick = () => {
    $('fm-tf').querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); tf = b.dataset.tf; g.setTemporalidad(tf);
  });
  host.querySelectorAll('.fm-ls button').forEach(b => b.onclick = () => {
    lado = b.dataset.lado; host.querySelectorAll('.fm-ls button').forEach(x => x.classList.remove('on')); b.classList.add('on');
    const go = $('fm-go'); go.classList.toggle('short', lado === 'short'); go.textContent = lado === 'long' ? 'Abrir Long' : 'Abrir Short'; refrescar();
  });
  $('fm-range').oninput = (e) => { lev = +e.target.value; $('fm-lev').textContent = lev + '×'; $('fm-levbtn-v').textContent = lev + '×'; refrescar(); };
  $('fm-margen').oninput = refrescar;
  $('fm-mode').onclick = () => { const a = modo === 'aislado'; modo = a ? 'cruzado' : 'aislado'; $('fm-mode').textContent = a ? 'Cruzado' : 'Aislado'; };
  $('fm-go').onclick = () => {
    const margen = parseFloat(($('fm-margen').value || '').replace(/,/g, '')) || 0;
    if (!margen) { $('fm-margen').focus(); return; }
    abrirDesdePanel({ lado, margen, lev });
    const go = $('fm-go'); const t = go.textContent; go.textContent = 'Muy pronto — en desarrollo'; setTimeout(() => { go.textContent = t; }, 1500); refrescar();
  };

  // Selector de moneda a pantalla completa.
  $('fm-sel').onclick = () => {
    const sh = document.createElement('div');
    sh.className = 'fm-sheet';
    sh.innerHTML = `<div class="sh-head"><b>Elige la moneda</b><button class="sh-x">✕</button></div>
      <div class="sh-list">${PARES.map(p => `<div class="sh-opt" data-sim="${p[0]}">${logoDe(p[2])}<b>${p[1]}/USDT</b></div>`).join('')}</div>`;
    document.body.appendChild(sh);
    sh.querySelector('.sh-x').onclick = () => sh.remove();
    sh.querySelectorAll('.sh-opt').forEach(o => o.onclick = () => {
      sim = o.dataset.sim; const p = PARES.find(x => x[0] === sim);
      $('fm-sym').textContent = p[1] + '/USDT'; $('fm-ico').innerHTML = logoDe(p[2]);
      g.cargar(sim, tf); sh.remove();
    });
  };

  // Precio en vivo.
  async function tick() {
    try {
      const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=' + sim);
      if (r.ok) { const j = await r.json(); precio = +j.lastPrice; chg = +j.priceChangePercent;
        $('fm-price').textContent = '$' + fmt(precio);
        const ce = $('fm-chg'); ce.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'; ce.className = chg >= 0 ? 'up' : 'down';
      }
    } catch (_) {}
    refrescar();
  }
  tick(); const iv = setInterval(tick, 3000);
  host._limpiarFut = () => clearInterval(iv);

  refrescar();
}
