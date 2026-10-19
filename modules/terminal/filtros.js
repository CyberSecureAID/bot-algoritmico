/* terminal/filtros.js. Ventana de filtros de la Terminal (modulo sellado).
   New pairs es un torrente: aqui se abre la misma lista pero VACIA y bajo control. No aparece ningun token
   hasta que marcas un filtro; a partir de ahi la ventana vuelve a leer la lista viva cada segundo y muestra
   solo lo que pasa los filtros marcados (punto verde = activo). Cada token se audita una sola vez (cache
   compartida con la ficha) y su semaforo aparece en la columna Check. Los filtros de seguridad se aplican
   segun llegan los resultados; los tokens aun sin datos del escaner cuentan como "checking" y no se muestran.
   Ocho filtros (numero par: en movil van de dos en dos). "Custom checks" abre la lista de comprobaciones. */

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const log = (...a) => { try { console.info('[TERM-FIL]', ...a); } catch (_) {} };

const CHIPS = [
  { k: 'liq', t: 'With liquidity' },
  { k: 'top', t: 'Highest liquidity' },
  { k: 'sell', t: 'Can be sold' },
  { k: 'nored', t: 'No red flags' },
  { k: 'bnb', t: 'BNB pairs' },
  { k: 'usdt', t: 'USDT pairs' },
  { k: 'lp', t: 'Launchpad only' },
  { k: 'custom', t: 'Custom checks' }
];
const CHECKS = [
  { k: 'sellable', t: 'Can be sold', d: 'Not a honeypot; buying and selling allowed' },
  { k: 'lowTax', t: 'Taxes under 10%', d: 'Buy and sell tax both below 10%' },
  { k: 'notMintable', t: 'Not mintable', d: 'No new supply can be created' },
  { k: 'noPause', t: 'Cannot be paused', d: 'The owner cannot freeze transfers' },
  { k: 'noBlacklist', t: 'No blacklist', d: 'No wallet can be blocked from selling' },
  { k: 'verified', t: 'Source verified', d: 'The code is public on BscScan' },
  { k: 'renounced', t: 'Ownership renounced', d: 'No owner, no hidden owner, no take back' },
  { k: 'lpSecured', t: 'Liquidity secured', d: 'At least 90% of the pool burned or locked' },
  { k: 'creatorSmall', t: 'Creator under 20%', d: 'The creator holds less than 20% of supply' },
  { k: 'notConcentrated', t: 'Top 10 under 70%', d: 'The ten largest wallets hold less than 70%' }
];
const TXT = { ok: 'Safe', warn: 'Caution', bad: 'Do not buy', pend: 'Checking' };

let _css = false;
function css() {
  if (_css) return; _css = true;
  const st = document.createElement('style'); st.id = 'tm-fil-css';
  st.textContent = ''
    + '.tm-fil{position:relative;width:100%;max-width:1100px;height:calc(100vh - 32px);display:flex;flex-direction:column;background:linear-gradient(180deg,#121820,#0b0e12);border:1px solid #2a333f;border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.65),0 0 0 1px rgba(232,184,75,.06),inset 0 1px 0 rgba(255,255,255,.06);overflow:hidden}'
    + '.tm-fil-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px 10px}'
    + '.tm-fil-head .tm-sec-tt{min-width:0}'
    + '.tm-fil-acts{display:flex;align-items:center;gap:8px;flex:0 0 auto}'
    + '.tm-chips{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:4px 18px 12px}'
    + '.tm-chip{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 10px;border-radius:11px;border:1px solid #2a333f;background:linear-gradient(180deg,#1b2027,#0d1117);color:#b7bdc6;font-family:"Chakra Petch",var(--display);font-weight:700;font-size:12.5px;letter-spacing:.2px;white-space:nowrap;cursor:pointer;box-shadow:0 3px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06);transition:color .15s,border-color .15s}'
    + '.tm-chip i{width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:#2b333d;box-shadow:inset 0 1px 2px rgba(0,0,0,.6);transition:background .15s,box-shadow .15s}'
    + '.tm-chip:hover{color:#eaecef;border-color:#8f6a1a}'
    + '.tm-chip.on{color:#f1cf6a;border-color:rgba(232,184,75,.55)}'
    + '.tm-chip.on i{background:#2ee86a;box-shadow:0 0 8px rgba(46,232,106,.9),0 0 0 2px rgba(46,232,106,.25)}'
    + '.tm-chip:active{transform:translateY(2px);box-shadow:0 1px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06)}'
    + '.tm-chip b{font-family:var(--mono);font-size:10.5px;color:#2ee86a;font-weight:700}'
    + '.tm-fil-body{flex:1 1 auto;min-height:0;overflow:auto;padding:0 18px 16px;scrollbar-width:none}'
    + '.tm-fil-body::-webkit-scrollbar{width:0;height:0;display:none}'
    + '.tm-fil-empty{padding:44px 14px;text-align:center;font-family:var(--mono);font-size:12.5px;color:var(--ink-3);line-height:1.7}'
    + '.tm-fil-empty b{display:block;font-family:"Chakra Petch",var(--display);font-size:15px;color:var(--ink-2);margin-bottom:6px}'
    + '.tm-fil-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px 8px;font-family:var(--mono);font-size:11px;color:var(--ink-3)}'
    + '.tm-fil-bar .vivo{display:inline-flex;align-items:center;gap:6px;color:#8ef0b0}.tm-fil-bar .vivo i{width:7px;height:7px;border-radius:50%;background:#2ee86a;animation:tmFilPend 1.4s ease-in-out infinite}'
    + '.tm-cc{position:relative;width:100%;max-width:480px;max-height:calc(100vh - 32px);overflow-y:auto;scrollbar-width:none;background:linear-gradient(180deg,#171d25,#0d1117);border:1px solid var(--line);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.06);padding:16px 18px 18px}'
    + '.tm-cc::-webkit-scrollbar{width:0;height:0;display:none}'
    + '.tm-cc-list{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column;gap:6px}'
    + '.tm-cc-list label{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:rgba(11,14,17,.6);cursor:pointer}'
    + '.tm-cc-list label.on{border-color:rgba(46,232,106,.35)}'
    + '.tm-cc-list input{appearance:none;-webkit-appearance:none;flex:0 0 auto;width:20px;height:20px;margin:0;border-radius:6px;border:1.5px solid #c79426;background:rgba(0,0,0,.4);cursor:pointer;position:relative}'
    + '.tm-cc-list input:checked{background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426)}'
    + '.tm-cc-list input:checked::after{content:"";position:absolute;left:6.5px;top:2.5px;width:5px;height:10px;border:solid #241900;border-width:0 2.4px 2.4px 0;transform:rotate(45deg)}'
    + '.tm-cc-list b{display:block;font-size:13px;color:var(--ink);font-weight:600}.tm-cc-list span{display:block;font-size:11.5px;color:var(--ink-3)}'
    + '.tm-cc-note{margin:0 0 12px;font-family:var(--mono);font-size:11px;color:var(--ink-3);line-height:1.5}'
    + '@media(max-width:760px){.tm-ov.tm-ov-fil{padding:8px}.tm-fil{height:calc(100vh - 16px);border-radius:16px}.tm-fil-head,.tm-chips,.tm-fil-bar{padding-left:12px;padding-right:12px}.tm-fil-body{padding:0 10px 12px}'
    + '.tm-chips{grid-template-columns:repeat(2,minmax(0,1fr))}.tm-chip{font-size:12px;padding:0 8px}.tm-fil-head .tm-sec-txt span{display:none}'
    + '.tm-ov-fil .tm-c-chain,.tm-ov-fil .tm-chain{display:none}}';   /* en movil Chain cede su sitio a Check (semaforo) */
  document.head.appendChild(st);
}

/* Lista de comprobaciones a exigir. Resuelve con el conjunto elegido (vacio = sin filtro). */
function elegirChecks(actuales) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'tm-ov';
    ov.innerHTML = `<div class="tm-cc" role="dialog" aria-modal="true">
      <div class="tm-f-head"><div class="tm-f-tt"><div class="tm-f-tx"><b>Custom checks</b><span>Show only tokens that pass every check you mark</span></div></div><button class="tm-f-x" type="button" aria-label="Close">✕</button></div>
      <p class="tm-cc-note">The more checks you mark, the fewer tokens pass. Newborn tokens rarely pass more than five or six. Ownership renounced and liquidity secured are the rarest in the first minutes.</p>
      <ul class="tm-cc-list">${CHECKS.map((c) => `<li><label class="${actuales.has(c.k) ? 'on' : ''}"><input type="checkbox" data-k="${c.k}" ${actuales.has(c.k) ? 'checked' : ''}><div><b>${c.t}</b><span>${c.d}</span></div></label></li>`).join('')}</ul>
      <div class="tm-f-acts"><button class="tm-b sec" type="button" id="tm-cc-clear">Clear</button><button class="tm-b" type="button" id="tm-cc-ok">Apply</button></div>
    </div>`;
    document.body.appendChild(ov);
    const sel = new Set(actuales);
    ov.querySelectorAll('input').forEach((i) => { i.onchange = () => { i.checked ? sel.add(i.dataset.k) : sel.delete(i.dataset.k); i.closest('label').classList.toggle('on', i.checked); }; });
    const fin = (v) => { try { ov.remove(); } catch (_) {} resolve(v); };
    ov.querySelector('.tm-f-x').onclick = () => fin(actuales);
    ov.addEventListener('click', (e) => { if (e.target === ov) fin(actuales); });
    $('tm-cc-clear').onclick = () => fin(new Set());
    $('tm-cc-ok').onclick = () => fin(sel);
  });
}

/* Abre la ventana. deps: items() lista viva, fila(it,i,extra), thead(extra), abrirFicha(it),
   auditarCache(it), auditoriaDe(it) y bnbUsd() del modulo principal. */
export function abrirFiltros(deps) {
  css();
  const prev = $('tm-fil-ov'); if (prev) prev.remove();
  const on = new Set(); let checks = new Set();
  const ov = document.createElement('div'); ov.id = 'tm-fil-ov'; ov.className = 'tm-ov tm-ov-fil';
  ov.innerHTML = `<div class="tm-fil" role="dialog" aria-modal="true">
    <div class="tm-fil-head">
      <div class="tm-sec-tt"><div class="tm-sec-txt"><b>New pairs</b><span>Same live list, under control: nothing shows until you mark a filter.</span></div></div>
      <div class="tm-fil-acts"><button class="tm-f-x" type="button" aria-label="Close">✕</button></div>
    </div>
    <div class="tm-chips" id="tm-chips">${CHIPS.map((c) => `<button class="tm-chip" type="button" data-k="${c.k}"><i></i><span>${c.t}</span></button>`).join('')}</div>
    <div class="tm-fil-bar"><span id="tm-fil-n"></span><span class="vivo"><i></i><span id="tm-fil-t">Live</span></span></div>
    <div class="tm-fil-body" id="tm-fil-body"></div>
  </div>`;
  document.body.appendChild(ov);
  const abierto = () => !!$('tm-fil-ov');
  let timer = null;
  const cerrar = () => { clearInterval(timer); try { ov.remove(); } catch (_) {} };
  ov.querySelector('.tm-f-x').onclick = cerrar;
  ov.addEventListener('click', (e) => { if (e.target === ov) cerrar(); });

  const celda = (it) => { const r = deps.auditoriaDe(it); const n = r ? r.nivel : 'pend'; return `<td class="tm-chk"><span class="tm-sem-p ${n}" title="${TXT[n]}"><i></i><span>${TXT[n]}</span></span></td>`; };
  const hayFiltro = () => on.size > 0;
  const necesitaDatos = () => on.has('sell') || on.has('nored') || (on.has('custom') && checks.size > 0);
  const pasa = (it) => {
    if (on.has('liq') && !(it.liquidez > 0)) return false;
    if (on.has('lp') && it.fuente !== 'launchpad') return false;
    if (on.has('bnb') && !on.has('usdt') && it.moneda !== 'BNB') return false;
    if (on.has('usdt') && !on.has('bnb') && it.moneda !== 'USDT') return false;
    if (necesitaDatos()) {
      const r = deps.auditoriaDe(it);
      if (!r || r.nivel === 'pend' || !r.datos || !r.datos.checks) return false;   // sin datos del escaner aun: no se muestra
      if (on.has('sell') && !r.datos.checks.sellable) return false;
      if (on.has('nored') && r.nivel !== 'ok') return false;   // solo verde: ni problema critico ni aviso (lo mismo que 'Safe to trade' en la ficha)
      if (on.has('custom')) for (const k of checks) if (!r.datos.checks[k]) return false;
    }
    return true;
  };
  const liqUsd = (it) => (it.moneda === 'USDT' ? it.liquidez : it.liquidez * (deps.bnbUsd ? deps.bnbUsd() : 1));

  // Auditoria continua de lo que entra en la lista viva, de 3 en 3, con cache. Nunca audita dos veces el mismo token.
  const enCola = new Set(); const cola = [];
  const encolar = (vivo) => { for (const it of vivo) { const k = it.token.toLowerCase(); if (!enCola.has(k) && !deps.auditoriaDe(it)) { enCola.add(k); cola.push(it); } } };
  const worker = async () => { while (abierto()) { const it = cola.shift(); if (!it) { await new Promise((r) => setTimeout(r, 400)); continue; } try { await deps.auditarCache(it); } catch (e) { log('audit fallo', it.token, e && e.message); } enCola.delete(it.token.toLowerCase()); await new Promise((r) => setTimeout(r, 250)); } };
  [0, 1, 2].forEach(worker);

  let ultimaClave = '';
  const pintar = (forzar) => {
    const host = $('tm-fil-body'); if (!host) return;
    const vivo = deps.items();
    if (hayFiltro()) encolar(vivo);
    let lista = hayFiltro() ? vivo.filter(pasa) : [];
    if (on.has('top')) lista = lista.slice().sort((a, b) => liqUsd(b) - liqUsd(a));
    const checking = hayFiltro() && necesitaDatos() ? vivo.filter((it) => { const r = deps.auditoriaDe(it); return !r || r.nivel === 'pend'; }).length : 0;
    $('tm-fil-n').textContent = hayFiltro() ? `${lista.length} of ${vivo.length} tokens` + (checking ? ` · ${checking} checking` : '') : `${vivo.length} tokens in the live list`;
    const clave = lista.map((it) => it.token + ':' + (deps.auditoriaDe(it) || {}).nivel).join('|');
    if (!forzar && clave === ultimaClave) return;   // nada cambio: no se repinta (sin parpadeo)
    ultimaClave = clave;
    if (!hayFiltro()) { host.innerHTML = '<div class="tm-fil-empty"><b>Mark a filter to start</b>The list stays empty until you choose what you want to see. It then updates by itself every second.</div>'; return; }
    if (!lista.length) { host.innerHTML = '<div class="tm-fil-empty"><b>No token passes these filters yet</b>' + (checking ? 'Security checks are still running for ' + checking + ' token' + (checking > 1 ? 's' : '') + '; matches appear as results arrive.' : 'New pairs keep coming in: this window keeps watching.') + '</div>'; return; }
    host.innerHTML = `<table class="tm-table">${deps.thead('<th class="tm-c-chk"><span class="tm-lg">Check</span><span class="tm-sm">Chk</span></th>')}<tbody>${lista.map((it, i) => deps.fila(it, i, celda(it))).join('')}</tbody></table>`;
    host.querySelectorAll('.tm-copyc').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); try { navigator.clipboard.writeText(b.dataset.copy); } catch (_) {} }; });
    host.querySelectorAll('.tm-row').forEach((r) => { r.onclick = () => { const it = deps.items().find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (it) deps.abrirFicha(it); }; });
  };
  const pintarChips = () => { ov.querySelectorAll('.tm-chip').forEach((b) => { const k = b.dataset.k; b.classList.toggle('on', on.has(k)); if (k === 'custom') b.querySelector('span').innerHTML = 'Custom checks' + (checks.size ? ' <b>' + checks.size + '</b>' : ''); }); };

  ov.querySelectorAll('.tm-chip').forEach((b) => {
    b.onclick = async () => {
      const k = b.dataset.k;
      if (k === 'custom') { checks = await elegirChecks(checks); if (checks.size) on.add('custom'); else on.delete('custom'); }
      else if (on.has(k)) on.delete(k); else on.add(k);
      pintarChips(); pintar(true);
      log('filtros', [...on].join(','), checks.size ? [...checks].join(',') : '');
    };
  });
  pintarChips(); pintar(true);
  timer = setInterval(() => { if (!abierto()) { clearInterval(timer); return; } pintar(false); }, 1000);   // lectura viva cada segundo
  log('abierto');
}
