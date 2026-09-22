/* firebase-perfil.js — Guarda y lee el perfil (nombre + foto) por wallet en Firestore.
   Misma dinámica que los logos: API REST, sin SDK, funciona en web y móvil.
   La foto llega ya comprimida (WebP pequeño) desde el mismo reductor de imagen. */

const PROJECT = 'criptocuba-logos';
const API_KEY = 'AIzaSyA1xJSheXdcUo5v0jZXGWTvYr3rfK5SifQ';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/perfiles`;

/* Guarda el perfil de una wallet. Solo manda los campos que cambian.
   nombre: string (o null para no tocar). foto: dataURL WebP (o null para no tocar). */
export async function guardarPerfil(wallet, { nombre, foto } = {}) {
  if (!wallet) return false;
  const id = wallet.toLowerCase();
  const fields = { ts: { integerValue: String(Date.now()) } };
  if (typeof nombre === 'string') fields.nombre = { stringValue: nombre.slice(0, 58) };
  if (typeof foto === 'string') { if (foto.length > 88000) return false; fields.foto = { stringValue: foto }; }
  // Firestore PATCH necesita updateMask para no borrar los otros campos.
  const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  try {
    const r = await fetch(`${BASE}/${id}?${mask}&key=${API_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    return r.ok;
  } catch (_) { return false; }
}

/* Lee el perfil de una wallet. Devuelve { nombre, foto } (campos vacíos si no hay). */
export async function leerPerfil(wallet) {
  if (!wallet) return { nombre: '', foto: '' };
  const id = wallet.toLowerCase();
  try {
    const r = await fetch(`${BASE}/${id}?key=${API_KEY}`);
    if (!r.ok) return { nombre: '', foto: '' };
    const d = await r.json();
    const f = d.fields || {};
    return {
      nombre: (f.nombre && f.nombre.stringValue) || '',
      foto: (f.foto && f.foto.stringValue) || ''
    };
  } catch (_) { return { nombre: '', foto: '' }; }
}

/* Lee varios perfiles (para el panel admin: quién es cada wallet). */
export async function leerPerfiles(wallets) {
  const out = {};
  await Promise.all((wallets || []).map(async (w) => {
    const p = await leerPerfil(w);
    if (p.nombre || p.foto) out[w.toLowerCase()] = p;
  }));
  return out;
}
