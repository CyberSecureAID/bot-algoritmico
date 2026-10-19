/* launchpad/perfil.js. Mi perfil dentro del Launchpad, sin salir de la pagina.
   Lee y guarda el MISMO perfil (nombre + foto por wallet) que el lobby, en Firestore por
   API REST (copia de assets/js/firebase-perfil.js), asi que lo que cambias aqui se ve
   fuera y al reves. Sellado: solo usa ./wallet.js. */

import * as wallet from './wallet.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ───── Mismo almacen que el lobby ───── */
const PROJECT = 'criptocuba-logos';
const API_KEY = 'AIzaSyA1xJSheXdcUo5v0jZXGWTvYr3rfK5SifQ';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/perfiles`;

async function guardarPerfil(cuenta, { nombre, foto } = {}) {
  if (!cuenta) return false;
  const id = cuenta.toLowerCase();
  const fields = { ts: { integerValue: String(Date.now()) } };
  if (typeof nombre === 'string') fields.nombre = { stringValue: nombre.slice(0, 58) };
  if (typeof foto === 'string') { if (foto.length > 88000) return false; fields.foto = { stringValue: foto }; }
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join('&');
  try {
    const r = await fetch(`${BASE}/${id}?${mask}&key=${API_KEY}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
    return r.ok;
  } catch (_) { return false; }
}
async function leerPerfil(cuenta) {
  if (!cuenta) return { nombre: '', foto: '' };
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${BASE}/${cuenta.toLowerCase()}?key=${API_KEY}`, { signal: ctrl.signal }); clearTimeout(to);
    if (!r.ok) return { nombre: '', foto: '' };
    const f = (await r.json()).fields || {};
    return { nombre: (f.nombre && f.nombre.stringValue) || '', foto: (f.foto && f.foto.stringValue) || '' };
  } catch (_) { return { nombre: '', foto: '' }; }
}

/* Foto: recortada al cuadrado y reducida a 128 px WebP, igual que List your token. */
function reducirFoto(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader(); r.onerror = reject;
    r.onload = () => { const im = new Image(); im.onerror = reject; im.onload = () => {
      const s = Math.min(im.width, im.height); const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
      cv.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 128, 128);
      let out = cv.toDataURL('image/webp', 0.82); if (!out.startsWith('data:image/webp')) out = cv.toDataURL('image/jpeg', 0.82); resolve(out);
    }; im.src = r.result; };
    r.readAsDataURL(file);
  });
}

const USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.7-3.6 3.4-5.4 7-5.4s6.3 1.8 7 5.4"/></svg>';
const CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>';

let _css = false;
function css() {
  if (_css) return; _css = true;
  const st = document.createElement('style'); st.id = 'lp-perfil-css';
  st.textContent = `
  #lp-perfil{position:fixed;inset:0;z-index:9700;display:flex;align-items:flex-start;justify-content:flex-end;padding:66px 14px 14px;background:rgba(3,5,8,.55);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
  #lp-perfil .pf-c{width:min(380px,100%);max-height:calc(100vh - 80px);overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:18px;padding:18px;box-shadow:0 26px 70px rgba(0,0,0,.7);animation:lpPf .16s ease both;font-family:var(--display,sans-serif)}
  @keyframes lpPf{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
  #lp-perfil .pf-top{display:flex;align-items:center;gap:14px;padding-right:36px}
  #lp-perfil .pf-ava{position:relative;width:66px;height:66px;border-radius:50%;flex:0 0 auto;background:#0b0e12;border:1px solid #2b3139;display:grid;place-items:center;color:var(--ink-3,#7d8794);overflow:hidden;cursor:pointer}
  #lp-perfil .pf-ava img{width:100%;height:100%;object-fit:cover}
  #lp-perfil .pf-ava svg{width:28px;height:28px}
  #lp-perfil .pf-ava .cam{position:absolute;right:-2px;bottom:-2px;width:24px;height:24px;border-radius:50%;background:var(--gold,#E8B84B);color:#3a2800;display:grid;place-items:center;border:2px solid #0b0e12}
  #lp-perfil .pf-ava .cam svg{width:12px;height:12px}
  #lp-perfil .pf-nom{display:flex;align-items:center;gap:6px;min-width:0}
  #lp-perfil .pf-nom input{flex:1;min-width:0;background:#0b0e12;border:1px solid #2b3139;border-radius:10px;color:#fff;font-family:var(--display,sans-serif);font-weight:700;font-size:15px;padding:9px 11px;outline:none;color-scheme:dark}
  #lp-perfil .pf-nom input:focus{border-color:var(--gold-soft,#C9A84B)}
  #lp-perfil .pf-sub{font-family:var(--mono,monospace);font-size:11px;color:var(--ink-3,#7d8794);margin-top:6px;display:flex;align-items:center;gap:8px}
  #lp-perfil .pf-sub button{background:none;border:0;color:var(--gold,#E8B84B);font-family:var(--mono,monospace);font-size:11px;cursor:pointer;padding:0}
  #lp-perfil .pf-kv{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid rgba(255,255,255,.06);font-size:13px;color:var(--ink-3,#7d8794);margin-top:4px}
  #lp-perfil .pf-kv:first-of-type{margin-top:14px}
  #lp-perfil .pf-kv b{color:#fff;font-family:var(--display,sans-serif)}
  #lp-perfil .pf-kv b.oro{color:var(--gold,#E8B84B)}
  #lp-perfil .pf-acts{display:flex;gap:8px;margin-top:14px}
  #lp-perfil .pf-b{flex:1;min-height:42px;border-radius:11px;border:1px solid #3a424c;background:linear-gradient(180deg,#1b2027,#0d1117);color:var(--gold,#E8B84B);font-family:var(--display,sans-serif);font-weight:700;font-size:13px;cursor:pointer;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;padding:0 10px}
  #lp-perfil .pf-b.rojo{color:#ffc2ca;border-color:#8c2531}
  #lp-perfil .pf-msg{min-height:16px;margin-top:8px;font-family:var(--mono,monospace);font-size:11px;color:var(--ink-3,#7d8794);text-align:center}
  #lp-perfil .pf-x{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:50%;border:1px solid #2b3139;background:#0b0e12;color:var(--ink-2,#b7bdc6);cursor:pointer}
  #lp-perfil .pf-c{position:relative}
  @media(max-width:560px){#lp-perfil{padding:62px 10px 10px;justify-content:center}}`;
  document.head.appendChild(st);
}

/* Abre el panel. `alCambiar` se llama cuando el usuario desconecta o cambia de wallet. */
export async function abrirPerfil({ alCambiar } = {}) {
  const prev = $('lp-perfil'); if (prev) { prev.remove(); return; }
  css();
  const cuenta = wallet.cuentaActual(); if (!cuenta) return;
  const d = document.createElement('div'); d.id = 'lp-perfil';
  let info = null; try { info = wallet.walletInfo && wallet.walletInfo(); } catch (_) {}
  const nombreWallet = (info && info.name) || 'Wallet';
  d.innerHTML = `<div class="pf-c">
    <button class="pf-x" id="pf-x" type="button">✕</button>
    <div class="pf-top">
      <div class="pf-ava" id="pf-ava" title="Change photo">${USER}<span class="cam">${CAM}</span><input type="file" id="pf-file" accept="image/*" style="display:none"></div>
      <div style="flex:1;min-width:0">
        <div class="pf-nom"><input id="pf-nombre" maxlength="24" placeholder="Your name or alias" autocomplete="off"></div>
        <div class="pf-sub"><span id="pf-dir">${esc(cuenta.slice(0, 6))}…${esc(cuenta.slice(-4))}</span><button type="button" id="pf-copiar">copy</button><a href="https://bscscan.com/address/${esc(cuenta)}" target="_blank" rel="noopener" style="color:var(--ink-3,#7d8794)">BscScan</a></div>
      </div>
    </div>
    <div class="pf-kv"><span>Wallet</span><b>${esc(nombreWallet)}</b></div>
    <div class="pf-kv"><span>Network</span><b class="oro">BNB Smart Chain</b></div>
    <div class="pf-kv"><span>Coins created here</span><b id="pf-coins">…</b></div>
    <div class="pf-acts">
      <button class="pf-b" id="pf-guardar" type="button">Save</button>
      <a class="pf-b" href="../../index.html?abrir=perfil">Full profile</a>
      <button class="pf-b rojo" id="pf-off" type="button">Disconnect</button>
    </div>
    <div class="pf-msg" id="pf-msg"></div>
  </div>`;
  document.body.appendChild(d);
  d.onclick = (e) => { if (e.target === d) d.remove(); };
  $('pf-x').onclick = () => d.remove();
  let foto = '';
  const pintarAva = () => { const a = $('pf-ava'); if (!a) return; a.innerHTML = (foto ? `<img src="${foto}" alt="">` : USER) + `<span class="cam">${CAM}</span><input type="file" id="pf-file" accept="image/*" style="display:none">`; $('pf-file').onchange = async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; try { foto = await reducirFoto(f); pintarAva(); $('pf-msg').textContent = 'Photo ready, press Save.'; } catch (_) { $('pf-msg').textContent = 'Could not read that image.'; } }; a.onclick = (e) => { if (e.target.id !== 'pf-file') $('pf-file').click(); }; };
  pintarAva();
  try { const c = JSON.parse(localStorage.getItem('lp-tokens') || '[]'); const n = c.filter((t) => (t.creador || '').toLowerCase() === cuenta.toLowerCase()).length; const el = $('pf-coins'); if (el) el.textContent = String(n); } catch (_) { const el = $('pf-coins'); if (el) el.textContent = '0'; }
  $('pf-copiar').onclick = () => { try { navigator.clipboard.writeText(cuenta); $('pf-copiar').textContent = 'copied'; setTimeout(() => { const b = $('pf-copiar'); if (b) b.textContent = 'copy'; }, 1500); } catch (_) {} };
  $('pf-guardar').onclick = async () => {
    const nombre = ($('pf-nombre').value || '').trim();
    $('pf-msg').textContent = 'Saving…';
    const ok = await guardarPerfil(cuenta, { nombre, foto: foto || null });
    $('pf-msg').textContent = ok ? 'Saved. It shows the same everywhere on DecFreedom.' : 'Could not save right now. Try again in a moment.';
  };
  $('pf-off').onclick = async () => { d.remove(); try { await wallet.desconectar(); } catch (_) {} if (alCambiar) alCambiar(); };
  // Datos guardados (nombre y foto), sin bloquear la apertura.
  leerPerfil(cuenta).then((p) => { if (!$('lp-perfil')) return; if (p.nombre && $('pf-nombre')) $('pf-nombre').value = p.nombre; if (p.foto) { foto = p.foto; pintarAva(); } });
}
