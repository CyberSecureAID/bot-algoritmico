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

/* Lista de monedas que el usuario ELIMINO de su panel (My Coins), guardada por wallet en Firestore
   para que SOBREVIVA a borrar cache o cambiar de dispositivo. localStorage no basta: al limpiar datos
   del sitio se pierde y las borradas reaparecen.
   Coleccion PROPIA "ocultos", doc = wallet en minuscula, con SOLO los campos lista + ts. No se puede
   reutilizar "monedas" porque su regla hace hasOnly(['logo','web',...,'ts']) y rechazaria el campo
   "lista". Requiere en las reglas de Firestore un bloque:  match /ocultos/{wallet} { allow read: if
   true; allow create, update: if request.resource.data.keys().hasOnly(['lista','ts']); allow delete:
   if false; }  (añadido, sin tocar logos/perfiles/monedas). */
const BASE_OCULTOS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/ocultos`;
export async function leerOcultos(wallet) {
  if (!wallet) return [];
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${BASE_OCULTOS}/${String(wallet).toLowerCase()}?key=${API_KEY}`, { signal: ctrl.signal }); clearTimeout(to);
    if (!r.ok) return [];
    const f = (await r.json()).fields || {};
    const vals = f.lista && f.lista.arrayValue && f.lista.arrayValue.values;
    return Array.isArray(vals) ? vals.map((v) => String(v.stringValue || '').toLowerCase()).filter(Boolean) : [];
  } catch (_) { return []; }
}
export async function guardarOcultos(wallet, lista) {
  if (!wallet) return false;
  const values = [...new Set((lista || []).map((a) => String(a).toLowerCase()).filter(Boolean))].map((a) => ({ stringValue: a }));
  const fields = { ts: { integerValue: String(Date.now()) }, lista: { arrayValue: { values } } };
  const mask = 'updateMask.fieldPaths=lista&updateMask.fieldPaths=ts';
  try {
    const r = await fetch(`${BASE_OCULTOS}/${String(wallet).toLowerCase()}?${mask}&key=${API_KEY}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
    return r.ok;
  } catch (_) { return false; }
}

/* Monedas ELIMINADAS globalmente por su creador: desaparecen de TODA la plataforma, para cualquiera
   (no solo para la wallet que las borro). Coleccion "eliminados", doc = direccion del token en
   minuscula, con la FIRMA del creador: { firma, firmante, ts }. El front solo oculta un token si
   verifyMessage(mensaje, firma) recupera EXACTAMENTE al creador on-chain (info[token].creador); una
   firma de un tercero no pasa, asi nadie oculta moneda ajena. WRITE-ONCE: la regla deja CREAR pero
   no sobrescribir ni borrar, asi nadie puede "des-ocultar" lo que el creador oculto. Requiere en las
   reglas de Firestore (añadido, sin tocar logos/perfiles/monedas/ocultos/historial):
     match /eliminados/{token} { allow read: if true;
       allow create: if request.resource.data.keys().hasOnly(['firma','firmante','ts'])
                     && request.resource.data.firma is string && request.resource.data.firma.size() < 300
                     && request.resource.data.firmante is string && request.resource.data.firmante.size() < 60
                     && request.resource.data.ts is int;
       allow update, delete: if false; } */
const BASE_ELIM = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/eliminados`;
export async function leerEliminados() {
  const out = {};
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${BASE_ELIM}?key=${API_KEY}&pageSize=300`, { signal: ctrl.signal }); clearTimeout(to);
    if (!r.ok) return out;
    const docs = (await r.json()).documents || [];
    for (const d of docs) {
      const id = String(d.name || '').split('/').pop().toLowerCase();
      const f = d.fields || {};
      const firma = f.firma && f.firma.stringValue;
      if (id && firma) out[id] = { firma, firmante: (f.firmante && f.firmante.stringValue) || '', ts: Number((f.ts && f.ts.integerValue) || 0) };
    }
  } catch (_) {}
  return out;
}
export async function guardarEliminado(token, firma, firmante) {
  if (!token || !firma) return false;
  const id = String(token).toLowerCase();
  const fields = { firma: { stringValue: String(firma) }, firmante: { stringValue: String(firmante || '').toLowerCase() }, ts: { integerValue: String(Date.now()) } };
  const mask = 'updateMask.fieldPaths=firma&updateMask.fieldPaths=firmante&updateMask.fieldPaths=ts';
  try {
    const r = await fetch(`${BASE_ELIM}/${id}?${mask}&key=${API_KEY}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
    return r.ok;
  } catch (_) { return false; }
}

/* CACHE del historial del panel (velas, 24h, volumen y transacciones) por token, en Firestore, para
   que SOBREVIVA a borrar cache y cargue al instante. La cadena sigue siendo la FUENTE DE VERDAD: esto
   es solo un acelerador (se lee primero, se completa con la cadena, se reescribe). Los trades se guardan
   como una cadena JSON (campo "trades") para no pelear con el formato de arrays de Firestore.
   Coleccion "historial", doc = direccion del token en minuscula. Requiere en las reglas:
     match /historial/{token} { allow read: if true;
       allow create, update: if request.resource.data.keys().hasOnly(['trades','apertura','bloque','ts'])
                     && request.resource.data.trades is string && request.resource.data.trades.size() < 400000;
       allow delete: if false; } */
const BASE_HIST = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/historial`;
export async function leerHistorial(token) {
  if (!token) return null;
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${BASE_HIST}/${String(token).toLowerCase()}?key=${API_KEY}`, { signal: ctrl.signal }); clearTimeout(to);
    if (!r.ok) return null;
    const f = (await r.json()).fields || {};
    let trades = []; try { trades = JSON.parse((f.trades && f.trades.stringValue) || '[]'); } catch (_) { trades = []; }
    let apertura = null; try { apertura = JSON.parse((f.apertura && f.apertura.stringValue) || 'null'); } catch (_) { apertura = null; }
    const bloque = Number((f.bloque && f.bloque.integerValue) || 0);
    return { trades: Array.isArray(trades) ? trades : [], apertura, bloque };
  } catch (_) { return null; }
}
export async function guardarHistorial(token, datos) {
  if (!token || !datos) return false;
  const trades = JSON.stringify((datos.trades || []).slice(0, 150));
  if (trades.length > 390000) return false;   // no desbordar el limite de 1 MB del documento
  const fields = {
    trades: { stringValue: trades },
    apertura: { stringValue: JSON.stringify(datos.apertura || null) },
    bloque: { integerValue: String(Math.floor(datos.bloque || 0)) },
    ts: { integerValue: String(Date.now()) }
  };
  const mask = ['trades', 'apertura', 'bloque', 'ts'].map((k) => `updateMask.fieldPaths=${k}`).join('&');
  try {
    const r = await fetch(`${BASE_HIST}/${String(token).toLowerCase()}?${mask}&key=${API_KEY}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
    return r.ok;
  } catch (_) { return false; }
}

/* Logos de los tokens LISTADOS en "List Your Token": esos se guardan en la coleccion "logos"
   (no "monedas"), por eso leerMoneda no los encuentra. Misma cuenta y key, otra coleccion.
   Devuelve { direccionMinuscula: dataUrl } de las que tienen logo. No lanza nunca. */
const BASE_LOGOS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/logos`;
export async function leerLogoListado(token) {
  if (!token) return '';
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${BASE_LOGOS}/${String(token).toLowerCase()}?key=${API_KEY}`, { signal: ctrl.signal }); clearTimeout(to);
    if (!r.ok) return '';
    const f = (await r.json()).fields || {};
    return (f.logo && f.logo.stringValue) || '';
  } catch (_) { return ''; }
}
export async function leerLogosListados(tokens) {
  const out = {};
  await Promise.all((tokens || []).map(async (t) => {
    const l = await leerLogoListado(t);
    if (l) out[String(t).toLowerCase()] = l;
  }));
  return out;
}
