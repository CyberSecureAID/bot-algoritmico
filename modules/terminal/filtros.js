/* terminal/filtros.js. Ventana de filtros de la Terminal (modulo sellado).
   La lista "New pairs" se mueve sin parar. Aqui se abre una copia CONGELADA (snapshot) de esa misma
   lista, con el mismo aspecto, y encima una fila de filtros marcables (punto verde cuando estan activos):
     With liquidity · Highest liquidity · Safe only · BNB pairs · USDT pairs · Custom checks
   "Custom checks" abre la lista de comprobaciones de la auditoria para elegir cuales exigir.
   Cada token del snapshot se audita (con cache compartida) y su semaforo aparece en una columna "Check";
   los filtros de seguridad se aplican a medida que llegan los resultados. "Refresh" toma otra foto. */

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const log = (...a) => { try { console.info('[TERM-FIL]', ...a); } catch (_) {} };

const CHIPS = [
  { k: 'liq', t: 'With liquidity' },
  { k: 'top', t: 'Highest liquidity' },
  { k: 'safe', t: 'Safe only' },
  { k: 'bnb', t: 'BNB pairs' },
  { k: 'usdt', t: 'USDT pairs' },
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
    + '.tm-fil-acts .tm-b{flex:0 0 auto;height:36px;min-width:0;padding:0 14px;font-size:12.5px}'
    + '.tm-chips{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;padding:4px 18px 12px}'
    + '.tm-chip{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 10px;border-radius:11px;border:1px solid #2a333f;background:linear-gradient(180deg,#1b2027,#0d1117);color:#b7bdc6;font-family:"Chakra Petch",var(--display);font-weight:700;font-size:12.5px;letter-spacing:.2px;white-space:nowrap;cursor:pointer;box-shadow:0 3px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06);transition:color .15s,border-color .15s}'
    + '.tm-chip i{width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:#2b333d;box-shadow:inset 0 1px 2px rgba(0,0,0,.6);transition:background .15s,box-shadow .15s}'
    + '.tm-chip:hover{color:#eaecef;border-color:#8f6a1a}'
    + '.tm-chip.on{color:#f1cf6a;border-color:rgba(232,184,75,.55)}'
    + '.tm-chip.on i{background:#2ee86a;box-shadow:0 0 8px rgba(46,232,106,.9),0 0 0 2px rgba(46,232,106,.25)}'
    + '.tm-chip:active{transform:translateY(2px);box-shadow:0 1px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06)}'
    + '.tm-chip b{font-family:var(--mono);font-size:10.5px;color:#2ee86a;font-weight:700}'
    + '.tm-fil-body{flex:1 1 auto;min-height:0;overflow:auto;padding:0 18px 16px;scrollbar-width:none}'
    + '.tm-fil-body::-webkit-scrollbar{width:0;height:0;display:none}'
    + '.tm-fil-empty{padding:40px 10px;text-align:center;font-family:var(--mono);font-size:12.5px;color:var(--ink-3);line-height:1.6}'
    + '.tm-fil-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px 8px;font-family:var(--mono);font-size:11px;color:var(--ink-3)}'
    + '.tm-chk{width:92px}.tm-c-chk{width:92px}'
    + '.tm-sem-p{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:999px;font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.3px;white-space:nowrap;border:1px solid var(--line);color:var(--ink-3);background:rgba(255,255,255,.04)}'
    + '.tm-sem-p i{width:7px;height:7px;border-radius:50%;background:#6b7580;flex:0 0 auto}'
    + '.tm-sem-p.ok{color:#8ef0b0;border-color:rgba(46,232,106,.35)}.tm-sem-p.ok i{background:#2ee86a;box-shadow:0 0 6px rgba(46,232,106,.8)}'
    + '.tm-sem-p.warn{color:#f1cf6a;border-color:rgba(232,184,75,.4)}.tm-sem-p.warn i{background:var(--gold);box-shadow:0 0 6px rgba(232,184,75,.8)}'
    + '.tm-sem-p.bad{color:#ff9aa9;border-color:rgba(246,70,93,.45)}.tm-sem-p.bad i{background:#f6465d;box-shadow:0 0 6px rgba(246,70,93,.8)}'
    + '.tm-sem-p.pend i{animation:tmFilPend 1s ease-in-out infinite}@keyframes tmFilPend{50%{opacity:.3}}'
    + '.tm-cc{position:relative;width:100%;max-width:480px;max-height:calc(100vh - 32px);overflow-y:auto;scrollbar-width:none;background:linear-gradient(180deg,#171d25,#0d1117);border:1px solid var(--line);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.06);padding:16px 18px 18px}'
    + '.tm-cc::-webkit-scrollbar{width:0;height:0;display:none}'
    + '.tm-cc-list{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column;gap:6px}'
    + '.tm-cc-list label{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:rgba(11,14,17,.6);cursor:pointer}'
    + '.tm-cc-list label.on{border-color:rgba(46,232,106,.35)}'
    + '.tm-cc-list input{appearance:none;-webkit-appearance:none;flex:0 0 auto;width:20px;height:20px;margin:0;border-radius:6px;border:1.5px solid #c79426;background:rgba(0,0,0,.4);cursor:pointer;position:relative}'
    + '.tm-cc-list input:checked{background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426)}'
    + '.tm-cc-list input:checked::after{content:"";position:absolute;left:6.5px;top:2.5px;width:5px;height:10px;border:solid #241900;border-width:0 2.4px 2.4px 0;transform:rotate(45deg)}'
    + '.tm-cc-list b{display:block;font-size:13px;color:var(--ink);font-weight:600}.tm-cc-list span{display:block;font-size:11.5px;color:var(--ink-3)}'
    + '@media(max-width:900px){.tm-chips{grid-template-columns:repeat(3,minmax(0,1fr))}}'
    + '@media(max-width:760px){.tm-ov.tm-ov-fil{padding:8px}.tm-fil{height:calc(100vh - 16px);border-radius:16px}.tm-fil-head,.tm-chips,.tm-fil-bar{padding-left:12px;padding-right:12px}.tm-fil-body{padding:0 10px 12px}'
    + '.tm-chips{grid-template-columns:repeat(2,minmax(0,1fr))}.tm-chip{font-size:12px;padding:0 8px}.tm-fil-head .tm-sec-txt span{display:none}'
    + '.tm-chk,.tm-c-chk{width:30px;padding-left:4px;padding-right:4px}.tm-table th.tm-c-chk{font-size:0}.tm-sem-p{padding:0;width:22px;justify-content:center;border-color:transparent;background:none}.tm-sem-p span{display:none}'
    + '.tm-ov-fil .tm-c-chain,.tm-ov-fil .tm-chain{display:none}}';   /* en movil la columna Chain cede su sitio al semaforo */
  document.head.appendChild(st);
}

/* Lista de comprobaciones a exigir. Resuelve con el conjunto elegido (vacio = sin filtro). */
function elegirChecks(actuales) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'tm-ov';
    ov.innerHTML = `<div class="tm-cc" role="dialog" aria-modal="true">
      <div class="tm-f-head"><div class="tm-f-tt"><div class="tm-f-tx"><b>Custom checks</b><span>Show only tokens that pass every check you mark</span></div></div><button class="tm-f-x" type="button" aria-label="Close">✕</button></div>
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

/* Abre la ventana. deps: items() copia de la lista, fila(it,i,extra), thead(extra), abrirFicha(it),
   auditarCache(it) y auditoriaDe(it) del modulo principal. */
export function abrirFiltros(deps) {
  css();
  const prev = $('tm-fil-ov'); if (prev) prev.remove();
  const on = new Set(); let checks = new Set();
  let snap = deps.items(); let tomado = Date.now();
  const ov = document.createElement('div'); ov.id = 'tm-fil-ov'; ov.className = 'tm-ov tm-ov-fil';
  ov.innerHTML = `<div class="tm-fil" role="dialog" aria-modal="true">
    <div class="tm-fil-head">
      <div class="tm-sec-tt"><div class="tm-sec-txt"><b>New pairs</b><span>A still copy of the live list. Mark the filters you want; the list does not move until you refresh.</span></div></div>
      <div class="tm-fil-acts"><button class="tm-b sec" type="button" id="tm-fil-refresh">Refresh</button><button class="tm-f-x" type="button" aria-label="Close">✕</button></div>
    </div>
    <div class="tm-chips" id="tm-chips">${CHIPS.map((c) => `<button class="tm-chip" type="button" data-k="${c.k}"><i></i><span>${c.t}</span></button>`).join('')}</div>
    <div class="tm-fil-bar"><span id="tm-fil-n"></span><span id="tm-fil-t"></span></div>
    <div class="tm-fil-body" id="tm-fil-body"></div>
  </div>`;
  document.body.appendChild(ov);
  const cerrar = () => { try { ov.remove(); } catch (_) {} };
  ov.querySelector('.tm-f-x').onclick = cerrar;
  ov.addEventListener('click', (e) => { if (e.target === ov) cerrar(); });
  const abierto = () => !!$('tm-fil-ov');

  const celda = (it) => { const r = deps.auditoriaDe(it); const n = r ? r.nivel : 'pend'; return `<td class="tm-chk"><span class="tm-sem-p ${n}" title="${TXT[n]}"><i></i><span>${TXT[n]}</span></span></td>`; };
  const pasa = (it) => {
    if (on.has('liq') && !(it.liquidez > 0)) return false;
    if (on.has('bnb') && !on.has('usdt') && it.moneda !== 'BNB') return false;
    if (on.has('usdt') && !on.has('bnb') && it.moneda !== 'USDT') return false;
    const r = deps.auditoriaDe(it);
    if (on.has('safe') && !(r && r.nivel === 'ok')) return false;
    if (on.has('custom') && checks.size) { if (!r || !r.datos || !r.datos.checks) return false; for (const k of checks) if (!r.datos.checks[k]) return false; }
    return true;
  };
  const liqUsd = (it) => (it.moneda === 'USDT' ? it.liquidez : it.liquidez * (deps.bnbUsd ? deps.bnbUsd() : 1));
  const pintar = () => {
    const host = $('tm-fil-body'); if (!host) return;
    let lista = snap.filter(pasa);
    if (on.has('top')) lista = lista.slice().sort((a, b) => liqUsd(b) - liqUsd(a));
    $('tm-fil-n').textContent = `${lista.length} of ${snap.length} tokens`;
    $('tm-fil-t').textContent = 'Snapshot ' + new Date(tomado).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (!snap.length) { host.innerHTML = '<div class="tm-fil-empty">The live list is still empty. Wait for the first pairs and press Refresh.</div>'; return; }
    if (!lista.length) { host.innerHTML = '<div class="tm-fil-empty">No token in this snapshot passes the marked filters.' + ((on.has('safe') || on.has('custom')) ? '<br>Security checks are still running for some tokens; results appear as they arrive.' : '') + '</div>'; return; }
    host.innerHTML = `<table class="tm-table">${deps.thead('<th class="tm-c-chk">Check</th>')}<tbody>${lista.map((it, i) => deps.fila(it, i, celda(it))).join('')}</tbody></table>`;
    host.querySelectorAll('.tm-copyc').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); try { navigator.clipboard.writeText(b.dataset.copy); } catch (_) {} }; });
    host.querySelectorAll('.tm-row').forEach((r) => { r.onclick = () => { const it = snap.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (it) deps.abrirFicha(it); }; });
  };
  const pintarChips = () => { ov.querySelectorAll('.tm-chip').forEach((b) => { const k = b.dataset.k; b.classList.toggle('on', on.has(k)); if (k === 'custom') b.querySelector('span').innerHTML = 'Custom checks' + (checks.size ? ' <b>' + checks.size + '</b>' : ''); }); };

  // Auditorias del snapshot, de 4 en 4, con cache; cada resultado repinta (los filtros de seguridad se aplican al llegar).
  let gen = 0;
  const auditarTodo = async () => {
    const g = ++gen; const cola = snap.slice(); let repintar = null;
    const programa = () => { if (repintar) return; repintar = setTimeout(() => { repintar = null; if (abierto() && g === gen) pintar(); }, 250); };
    const worker = async () => { while (cola.length && abierto() && g === gen) { const it = cola.shift(); try { await deps.auditarCache(it); } catch (e) { log('audit fallo', it.token, e && e.message); } programa(); } };
    await Promise.all([0, 1, 2, 3].map(worker));
    log('snapshot auditado', snap.length);
  };

  ov.querySelectorAll('.tm-chip').forEach((b) => {
    b.onclick = async () => {
      const k = b.dataset.k;
      if (k === 'custom') { checks = await elegirChecks(checks); if (checks.size) on.add('custom'); else on.delete('custom'); }
      else if (on.has(k)) on.delete(k); else on.add(k);
      pintarChips(); pintar();
    };
  });
  $('tm-fil-refresh').onclick = () => { snap = deps.items(); tomado = Date.now(); pintar(); auditarTodo(); log('refresh', snap.length); };
  pintarChips(); pintar(); auditarTodo();
  log('abierto', snap.length, 'tokens');
}
