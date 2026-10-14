/* launchpad/firebase-tokens.js. Perfil publico de una moneda del launchpad (logo + redes)
   en Firestore, por API REST, en la MISMA cuenta que los perfiles y los logos del swap.
   Coleccion "monedas", clave = direccion del token en minuscula.
   Copia el patron de perfil.js (PATCH + updateMask: crea o fusiona, nunca borra).
   Sellado: no importa nada de fuera del modulo. */

const PROJECT = 'criptocuba-logos';
const API_KEY = 'AIzaSyA1xJSheXdcUo5v0jZXGWTvYr3rfK5SifQ';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/monedas`;

/* Redes permitidas. Las reglas de Firestore cubren este conjunto; la UI decide cuales enseña. */
export const REDES = ['web', 'x', 'telegram', 'discord', 'instagram', 'linkedin', 'reddit', 'youtube', 'tiktok', 'facebook', 'github', 'medium'];

function vacio() { const o = { logo: '' }; for (const k of REDES) o[k] = ''; return o; }

/* Crea o fusiona el perfil de la moneda. Solo escribe los campos presentes (updateMask),
   asi nunca pisa lo que ya hubiera guardado. Devuelve true si Firestore acepto. */
export async function guardarMoneda(token, datos = {}) {
  if (!token) return false;
  const id = String(token).toLowerCase();
  const fields = { ts: { integerValue: String(Date.now()) } };
  if (typeof datos.logo === 'string') { if (datos.logo.length > 88000) return false; fields.logo = { stringValue: datos.logo }; }
  for (const k of REDES) { if (typeof datos[k] === 'string') fields[k] = { stringValue: datos[k].slice(0, 290) }; }
  const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${k}`).join('&');
  try {
    const r = await fetch(`${BASE}/${id}?${mask}&key=${API_KEY}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
    return r.ok;
  } catch (_) { return false; }
}

/* Lee el perfil de una moneda. Nunca lanza: si no existe o falla, devuelve vacio. */
export async function leerMoneda(token) {
  if (!token) return vacio();
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${BASE}/${String(token).toLowerCase()}?key=${API_KEY}`, { signal: ctrl.signal }); clearTimeout(to);
    if (!r.ok) return vacio();
    const f = (await r.json()).fields || {};
    const o = vacio();
    o.logo = (f.logo && f.logo.stringValue) || '';
    for (const k of REDES) o[k] = (f[k] && f[k].stringValue) || '';
    return o;
  } catch (_) { return vacio(); }
}

/* Lectura en lote para "My coins": devuelve { direccionMinuscula: datos } solo de las que tienen algo. */
export async function leerMonedas(tokens) {
  const out = {};
  await Promise.all((tokens || []).map(async (t) => {
    const d = await leerMoneda(t);
    if (d.logo || REDES.some((k) => d[k])) out[String(t).toLowerCase()] = d;
  }));
  return out;
}
