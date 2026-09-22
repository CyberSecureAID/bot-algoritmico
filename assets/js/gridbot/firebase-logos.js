/* firebase-logos.js — Guarda y lee los logos de los tokens en Firestore (gratis).
   El logo llega ya comprimido (WebP pequeño, pocos KB) desde el reductor del listing.
   Usa la API REST de Firestore (sin SDK pesado, funciona en web y móvil). */

const PROJECT = 'criptocuba-logos';
const API_KEY = 'AIzaSyA1xJSheXdcUo5v0jZXGWTvYr3rfK5SifQ';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/logos`;

/* Guarda el logo de un token. tokenId = dirección del contrato en minúsculas.
   Devuelve true si se guardó. Si falla (o ya existía), no rompe nada. */
export async function guardarLogo(tokenAddr, dataUrlWebp) {
  if (!tokenAddr || !dataUrlWebp) return false;
  // Las reglas de Firestore rechazan >90KB. Validamos antes para no perder el logo.
  if (dataUrlWebp.length > 88000) return false;
  const id = tokenAddr.toLowerCase();
  try {
    const r = await fetch(`${BASE}?documentId=${id}&key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { logo: { stringValue: dataUrlWebp } } })
    });
    return r.ok;
  } catch (_) { return false; }
}

/* Lee el logo de un token. Devuelve el dataURL (string) o '' si no hay. */
export async function leerLogo(tokenAddr) {
  if (!tokenAddr) return '';
  const id = tokenAddr.toLowerCase();
  try {
    const r = await fetch(`${BASE}/${id}?key=${API_KEY}`);
    if (!r.ok) return '';
    const d = await r.json();
    return (d.fields && d.fields.logo && d.fields.logo.stringValue) || '';
  } catch (_) { return ''; }
}

/* Lee varios logos a la vez (para pintar una lista). Devuelve { addr: dataUrl }. */
export async function leerLogos(addrs) {
  const out = {};
  await Promise.all((addrs || []).map(async (a) => {
    const l = await leerLogo(a);
    if (l) out[a.toLowerCase()] = l;
  }));
  return out;
}
