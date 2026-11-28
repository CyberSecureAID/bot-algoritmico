/* alertas.js — Suscripción a alertas por correo (Web3Forms), sin servidor propio.
 *
 * El usuario (o el colega) deja su correo para que le avisemos cuando una entrada
 * de la estrategia esté CERCA de cumplirse. Web3Forms manda el correo sin backend.
 *
 * Honesto sobre el alcance, para no prometer de más:
 *  - La detección corre en el NAVEGADOR mientras Catalyst está abierto: cuando las
 *    condiciones se acercan, se dispara el aviso. Con la pestaña abierta, funciona
 *    sin Cloudflare ni servidor.
 *  - Aviso 24/7 con el navegador cerrado necesita un proceso siempre encendido
 *    (el mismo tema del keeper) -> queda para después.
 *
 * Clave pública de Web3Forms: localStorage('catalyst_w3f_key'). Es una access key
 * de formulario (pensada para ir en el front); el correo llega a la cuenta dueña.
 */

const $ = (id) => document.getElementById(id);
const w3fKey = () => { try { return localStorage.getItem('catalyst_w3f_key') || ''; } catch (_) { return ''; } };

export function abrirAlertas(S) {
  if ($('cat-al')) return;
  const e = S.estr, a = S.activo;
  const back = document.createElement('div'); back.id = 'cat-al';
  back.innerHTML = `
    <div class="cat-al-card" role="dialog" aria-modal="true">
      <button class="cat-al-x" id="cat-al-x" aria-label="Close">×</button>
      <h3>Alert me when it's close</h3>
      <p class="cat-al-sub">We'll email you when <b>${a.s}</b> is about to meet the setup
        <span class="cat-al-tag ${e.lado}">${e.nombre} · ${e.lado === 'call' ? 'CALL' : 'PUT'}</span></p>
      <form id="cat-al-form">
        <input type="email" id="cat-al-email" placeholder="your@email.com" required autocomplete="email">
        <label class="cat-al-chk"><input type="checkbox" id="cat-al-near" checked> Avisarme <b>antes</b> (cuando está por cumplirse, no después)</label>
        <button type="submit" class="cat-al-go" id="cat-al-go">Subscribe to this alert</button>
      </form>
      <p class="cat-al-note" id="cat-al-note">You'll get the alert while Catalyst is open in your browser. Round-the-clock alerts with the tab closed need the always-on service (coming later).</p>
    </div>`;
  document.body.appendChild(back);
  estilos();
  const cerrar = () => back.remove();
  $('cat-al-x').onclick = cerrar;
  back.addEventListener('click', (ev) => { if (ev.target === back) cerrar(); });
  $('cat-al-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = $('cat-al-email').value.trim();
    const antes = $('cat-al-near').checked;
    const go = $('cat-al-go'); go.disabled = true; go.textContent = 'Saving…';
    const key = w3fKey();
    const payload = {
      subject: `Catalyst alert · ${a.s} · ${e.nombre}`,
      from_name: 'DecFreedom Catalyst',
      email,
      message: `Subscribe ${email} to Catalyst alerts.\nStock: ${a.s} (${a.n})\nStrategy: ${e.nombre} (${e.lado.toUpperCase()})\nTimeframe: ${e.tfEntrada}\nNotify: ${antes ? 'before (approaching)' : 'on trigger'}`
    };
    let ok = false;
    if (key) {
      try {
        const r = await fetch('https://api.web3forms.com/submit', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ access_key: key, ...payload })
        });
        const j = await r.json().catch(() => ({}));
        ok = !!j.success;
      } catch (_) {}
    }
    // Guarda la suscripción localmente para que el detector (mientras la pestaña
    // esté abierta) sepa a quién avisar aunque Web3Forms aún no esté configurado.
    try {
      const subs = JSON.parse(localStorage.getItem('catalyst_subs') || '[]');
      subs.push({ email, sym: a.s, estr: e.id, antes, ts: Date.now() });
      localStorage.setItem('catalyst_subs', JSON.stringify(subs.slice(-200)));
    } catch (_) {}
    const note = $('cat-al-note');
    if (ok) { go.textContent = '✓ Subscribed'; note.textContent = 'Done. We will email you when this setup is close.'; note.className = 'cat-al-note okk'; }
    else if (!key) { go.disabled = false; go.textContent = 'Subscribe to this alert'; note.innerHTML = 'Saved on this device. To actually send the emails, add your free <b>Web3Forms</b> access key (Catalyst settings). Nothing else needed — no server.'; }
    else { go.disabled = false; go.textContent = 'Try again'; note.textContent = 'Could not reach the email service. Check the Web3Forms key and try again.'; }
  });
}

let _css = false;
function estilos() {
  if (_css) return; _css = true;
  const st = document.createElement('style');
  st.textContent = `
  #cat-al{position:fixed;inset:0;z-index:9600;display:grid;place-items:center;padding:18px;background:rgba(5,7,10,.72);backdrop-filter:blur(3px)}
  .cat-al-card{position:relative;width:min(420px,100%);background:linear-gradient(180deg,#12161d,#0a0e13);border:1px solid #29313b;border-radius:16px;padding:24px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#eaecef}
  .cat-al-x{position:absolute;top:12px;right:14px;width:30px;height:30px;border-radius:8px;border:1px solid #29313b;background:rgba(255,255,255,.04);color:#a7b0bb;font-size:18px;cursor:pointer}
  .cat-al-card h3{font-family:'Chakra Petch',system-ui,sans-serif;font-size:20px;margin:0 0 8px}
  .cat-al-sub{font-size:13px;line-height:1.5;color:#c4ccd4;margin:0 0 16px}
  .cat-al-tag{display:inline-block;margin-top:6px;font-family:'IBM Plex Mono',monospace;font-size:11px;padding:3px 9px;border-radius:7px;border:1px solid #29313b}
  .cat-al-tag.call{color:#2ee86a;border-color:rgba(46,232,106,.4)}.cat-al-tag.put{color:#ff5b6e;border-color:rgba(255,91,110,.4)}
  #cat-al-form{display:flex;flex-direction:column;gap:12px}
  #cat-al-email{height:46px;border-radius:11px;border:1px solid #29313b;background:#0b0e12;color:#eaecef;padding:0 14px;font-family:inherit;font-size:14px}
  #cat-al-email:focus{outline:none;border-color:#C9A84B}
  .cat-al-chk{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.4;color:#c4ccd4;cursor:pointer}
  .cat-al-chk input{margin-top:2px}
  .cat-al-go{height:48px;border-radius:12px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#241900;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:14px;cursor:pointer}
  .cat-al-go:disabled{opacity:.6;cursor:default}
  .cat-al-note{font-size:11.5px;line-height:1.5;color:#7c868f;margin:14px 0 0}
  .cat-al-note.okk{color:#2ee86a}`;
  document.head.appendChild(st);
}
