/* launchpad/perfil-moneda.js. Editor del perfil publico de la moneda (logo + redes) y la
   fila de redes de la cabecera. Guarda en Firestore (coleccion "monedas") por direccion.
   Autocontenido como perfil.js: su propio overlay, su propia CSS y su propio reductor de
   imagen (128 px webp, igual que el resto). Sellado: solo importa ./firebase-tokens.js. */

import { guardarMoneda } from './firebase-tokens.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Las 6 redes que se enseñan (las reglas de Firestore cubren mas, por si cambia). */
const REDES_UI = [
  { k: 'web', lab: 'Website', ph: 'https://yourcoin.com', base: 'https://', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18"/></svg>' },
  { k: 'x', lab: 'X', ph: 'https://x.com/yourcoin', base: 'https://x.com/', ic: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.24 2.25h3.31l-7.23 8.26L23 21.75h-6.38l-5-6.53-5.72 6.53H2.6l7.73-8.84L1.5 2.25h6.54l4.5 5.95zM17.1 19.77h1.83L7.02 4.13H5.06z"/></svg>' },
  { k: 'instagram', lab: 'Instagram', ph: 'https://instagram.com/yourcoin', base: 'https://instagram.com/', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>' },
  { k: 'youtube', lab: 'YouTube', ph: 'https://youtube.com/@yourcoin', base: 'https://youtube.com/', ic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.3l5.2 2.7L10 14.7z" fill="currentColor" stroke="none"/></svg>' },
  { k: 'tiktok', lab: 'TikTok', ph: 'https://tiktok.com/@yourcoin', base: 'https://tiktok.com/', ic: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 0h-3.2v16.3a2.8 2.8 0 1 1-2-2.7v-3.3a6 6 0 1 0 5.2 5.9V8.2a7.9 7.9 0 0 0 4.5 1.4V6.3a4.6 4.6 0 0 1-4.5-4.6z"/></svg>' },
  { k: 'facebook', lab: 'Facebook', ph: 'https://facebook.com/yourcoin', base: 'https://facebook.com/', ic: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.33l-.53 3.49h-2.8v8.44C19.61 23.08 24 18.09 24 12.07z"/></svg>' }
];

/* Link seguro: solo http(s). Si es URL se usa tal cual; si es dominio se le antepone https;
   si es un usuario suelto se le antepone la base de esa red. Nunca deja pasar javascript: */
function hrefRed(k, v, base) {
  v = String(v || '').trim();
  if (!v) return '';
  if (/^(javascript|data|vbscript):/i.test(v)) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/\.[a-z]{2,}(\/|$)/i.test(v)) return 'https://' + v.replace(/^\/+/, '');
  return (base || 'https://') + v.replace(/^\/+/, '');
}

/* Fila de iconos de la cabecera. Solo enseña las redes con enlace. Publica (todos la ven). */
export function filaRedes(redes) {
  if (!redes) return '';
  css();
  const items = REDES_UI.map((r) => {
    const href = hrefRed(r.k, redes[r.k], r.base);
    if (!href) return '';
    return `<a href="${esc(href)}" target="_blank" rel="noopener nofollow" title="${r.lab}" aria-label="${r.lab}">${r.ic}</a>`;
  }).filter(Boolean).join('');
  return items ? `<div class="lp-soc">${items}</div>` : '';
}

/* Reductor propio: cuadrado 128 px webp (igual que el logo del asistente). */
function reducir(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader(); r.onerror = reject;
    r.onload = () => {
      const im = new Image(); im.onerror = reject;
      im.onload = () => {
        const s = Math.min(im.width, im.height);
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
        cv.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 128, 128);
        let out = cv.toDataURL('image/webp', 0.85); if (!out.startsWith('data:image/webp')) out = cv.toDataURL('image/jpeg', 0.85);
        resolve(out);
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/* Editor (solo el creador). `alGuardar` se llama tras guardar bien, para repintar el panel. */
export async function abrirEditorMoneda(t, alGuardar) {
  const prev = $('em-bg'); if (prev) prev.remove();
  css();
  let logo = t.logo || '';
  const red = t.redes || {};
  const d = document.createElement('div'); d.id = 'em-bg'; d.className = 'em-bg';
  d.innerHTML = `<div class="em">
    <button class="em-x" id="em-x" type="button">✕</button>
    <div class="em-t">Logo and links</div>
    <div class="em-s">Public page of <b>${esc(t.simbolo || 'your coin')}</b>. Saved by contract address, visible to everyone.</div>
    <label class="em-logo" for="em-file"><div class="em-ava" id="em-ava">${logo ? `<img src="${esc(logo)}" alt="">` : esc((t.simbolo || '?')[0].toUpperCase())}</div><div><b>${logo ? 'Change logo' : 'Upload a logo'}</b><span>Square looks best. We shrink it to 128 px webp so it loads fast everywhere.</span></div></label>
    <input type="file" id="em-file" accept="image/*" style="display:none">
    <div class="em-campos">
      ${REDES_UI.map((r) => `<label class="em-f"><span>${r.ic}${esc(r.lab)}</span><input type="url" inputmode="url" id="emr-${r.k}" placeholder="${esc(r.ph)}" value="${esc(red[r.k] || '')}" autocomplete="off"></label>`).join('')}
    </div>
    <div class="em-acts"><button class="em-b gris" id="em-cancel" type="button">Cancel</button><button class="em-b" id="em-save" type="button">Save</button></div>
    <div class="em-msg" id="em-msg"></div>
  </div>`;
  document.body.appendChild(d);
  d.onclick = (e) => { if (e.target === d) d.remove(); };
  $('em-x').onclick = () => d.remove();
  $('em-cancel').onclick = () => d.remove();
  const pintarAva = () => { const a = $('em-ava'); if (a) a.innerHTML = logo ? `<img src="${esc(logo)}" alt="">` : esc((t.simbolo || '?')[0].toUpperCase()); };
  $('em-file').onchange = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const m = $('em-msg'); if (m) m.textContent = 'Shrinking your logo…';
    try { logo = await reducir(f); pintarAva(); if (m) m.textContent = 'Logo ready, press Save.'; } catch (_) { if (m) m.textContent = 'Could not read that image. Try a PNG or JPG.'; }
  };
  $('em-save').onclick = async () => {
    const m = $('em-msg'); const b = $('em-save');
    const datos = {};
    if (logo && logo !== t.logo) datos.logo = logo;
    for (const r of REDES_UI) { const el = $('emr-' + r.k); datos[r.k] = (el && el.value ? el.value.trim() : ''); }
    b.disabled = true; if (m) m.textContent = 'Saving…';
    const ok = await guardarMoneda(t.address, datos);
    if (ok) { if (m) m.textContent = 'Saved. It shows on your coin for everyone.'; setTimeout(() => { d.remove(); if (alGuardar) alGuardar(); }, 550); }
    else { b.disabled = false; if (m) m.textContent = 'Could not save right now. Try again in a moment.'; }
  };
}

let _css = false;
function css() {
  if (_css) return; _css = true;
  const st = document.createElement('style'); st.id = 'lp-moneda-css';
  st.textContent = `
  .lp-soc{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px}
  .lp-soc a{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#0b0e12;border:1px solid #2b3139;color:var(--ink-3,#7d8794);transition:color .15s,border-color .15s,transform .08s}
  .lp-soc a:hover{color:var(--gold,#E8B84B);border-color:var(--gold-soft,#C9A84B);transform:translateY(-1px)}
  .lp-soc a svg{width:15px;height:15px;display:block}
  .em-bg{position:fixed;inset:0;z-index:9800;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(3,5,8,.6);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
  .em{position:relative;width:min(460px,100%);max-height:calc(100vh - 32px);overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:20px;padding:22px 20px 18px;box-shadow:0 26px 70px rgba(0,0,0,.7);font-family:var(--display,sans-serif);animation:emIn .18s ease both}
  @keyframes emIn{from{opacity:0;transform:translateY(8px) scale(.99)}to{opacity:1;transform:none}}
  .em-x{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:1px solid #2b3139;background:#0b0e12;color:var(--ink-2,#b7bdc6);font-size:15px;cursor:pointer}
  .em-t{font-family:'Chakra Petch',var(--display,sans-serif);font-weight:700;font-size:20px;color:#fff;padding-right:40px}
  .em-s{font-size:12.5px;line-height:1.5;color:var(--ink-3,#7d8794);margin:6px 0 16px}
  .em-s b{color:var(--gold,#E8B84B)}
  .em-logo{display:flex;align-items:center;gap:14px;padding:12px;border-radius:14px;border:1px dashed #3a424c;background:#0b0e12;cursor:pointer;margin-bottom:14px}
  .em-logo:hover{border-color:var(--gold-soft,#C9A84B)}
  .em-ava{width:60px;height:60px;border-radius:50%;flex:0 0 auto;background:#12161c;border:1px solid #2b3139;display:grid;place-items:center;font-family:var(--display,sans-serif);font-weight:800;font-size:22px;color:var(--gold,#E8B84B);overflow:hidden}
  .em-ava img{width:100%;height:100%;object-fit:cover}
  .em-logo b{display:block;font-size:13.5px;color:#fff}
  .em-logo span{display:block;font-size:11.5px;color:var(--ink-3,#7d8794);margin-top:2px;line-height:1.4}
  .em-campos{display:flex;flex-direction:column;gap:9px}
  .em-f span{display:flex;align-items:center;gap:7px;font-family:var(--mono,monospace);font-size:10px;letter-spacing:.4px;text-transform:uppercase;color:var(--ink-3,#7d8794);margin:0 0 5px}
  .em-f span svg{width:14px;height:14px;flex:0 0 auto}
  .em-f input{width:100%;background:#0b0e12;border:1px solid #2b3139;border-radius:11px;color:#fff;font-family:var(--display,sans-serif);font-size:14px;padding:11px 13px;outline:none;color-scheme:dark}
  .em-f input:focus{border-color:var(--gold-soft,#C9A84B)}
  .em-f input::placeholder{color:#4d5763}
  .em-acts{display:flex;gap:9px;margin-top:16px}
  .em-b{flex:1;min-height:46px;border-radius:12px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;font-family:var(--display,sans-serif);font-weight:800;font-size:14px;cursor:pointer}
  .em-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:var(--ink-2,#b7bdc6)}
  .em-b:disabled{opacity:.6;cursor:default}
  .em-msg{min-height:16px;margin-top:9px;font-family:var(--mono,monospace);font-size:11.5px;color:var(--ink-3,#7d8794);text-align:center}`;
  document.head.appendChild(st);
}
