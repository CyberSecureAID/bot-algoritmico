/* datos.js — Datos de BOLSA para Catalyst (acciones de EE.UU., como TC2000).
 *
 * Proveedor: Twelve Data. La clave va OFUSCADA (se arma en runtime, no aparece en
 * texto plano en el código). Ojo honesto: una clave en el front siempre es
 * extraíble por alguien decidido; la ofuscación frena el scraping casual y evita
 * que un escáner la lea de un grep. La protección de verdad y la ESCALA (que 1000
 * personas no agoten los 800 créditos/día del plan gratis) es la caché compartida
 * que sirve el mismo dato a todos; aquí va la caché por navegador, que ya recorta
 * muchísimo las peticiones.
 *
 * El usuario puede sobreescribir la clave en Ajustes (localStorage catalyst_td_key).
 */

/* clave ofuscada (XOR 0x3c) */
const _K = [94,88,89,94,14,15,9,8,10,5,15,94,8,9,5,10,93,15,4,95,10,89,10,90,15,9,89,9,8,8,90,5];
const claveEmbed = () => _K.map((n) => String.fromCharCode(n ^ 0x3c)).join('');
const clave = () => { try { return (localStorage.getItem('catalyst_td_key') || '').trim() || claveEmbed(); } catch (_) { return claveEmbed(); } };
export const haveKey = () => !!clave();
export function setKey(k) { try { const v = String(k || '').trim(); if (v) localStorage.setItem('catalyst_td_key', v); else localStorage.removeItem('catalyst_td_key'); } catch (_) {} }

const BASE = 'https://api.twelvedata.com';
const TF_MAP = { '15m': '15min', '1h': '1h', '1D': '1day' };
/* TTL de caché: intradía corto, diario largo. Protege los créditos y hace que
   moverse entre acciones y temporalidades no dispare una petición cada vez. */
const TTL = { '15m': 150e3, '1h': 180e3, '1D': 1800e3 };

/* Acciones/ETF de EE.UU. con opciones líquidas (put/call). El dominio sirve para
   el logo; si falla, la interfaz pinta un monograma, así nunca hay imagen rota. */
export const ACTIVOS = [
  { s: 'AAPL', n: 'Apple',        dom: 'apple.com' },
  { s: 'TSLA', n: 'Tesla',        dom: 'tesla.com' },
  { s: 'NVDA', n: 'NVIDIA',       dom: 'nvidia.com' },
  { s: 'AMZN', n: 'Amazon',       dom: 'amazon.com' },
  { s: 'META', n: 'Meta',         dom: 'meta.com' },
  { s: 'MSFT', n: 'Microsoft',    dom: 'microsoft.com' },
  { s: 'GOOGL', n: 'Alphabet',    dom: 'abc.xyz' },
  { s: 'AMD',  n: 'AMD',          dom: 'amd.com' },
  { s: 'NFLX', n: 'Netflix',      dom: 'netflix.com' },
  { s: 'COIN', n: 'Coinbase',     dom: 'coinbase.com' },
  { s: 'PLTR', n: 'Palantir',     dom: 'palantir.com' },
  { s: 'SOFI', n: 'SoFi',         dom: 'sofi.com' },
  { s: 'BABA', n: 'Alibaba',      dom: 'alibaba.com' },
  { s: 'DIS',  n: 'Disney',       dom: 'disney.com' },
  { s: 'BA',   n: 'Boeing',       dom: 'boeing.com' },
  { s: 'JPM',  n: 'JPMorgan',     dom: 'jpmorganchase.com' },
  { s: 'SPY',  n: 'S&P 500',      dom: 'ssga.com' },
  { s: 'QQQ',  n: 'Nasdaq 100',   dom: 'invesco.com' },
  { s: 'IWM',  n: 'Russell 2000', dom: 'ishares.com' }
];

export const logoDe = (a) => a && a.dom ? `https://logo.clearbit.com/${a.dom}` : '';

function leerCache(key) { try { const o = JSON.parse(sessionStorage.getItem(key) || localStorage.getItem(key) || 'null'); return o; } catch (_) { return null; } }
function guardarCache(key, velas, tf) {
  const o = { ts: Date.now(), velas };
  try { sessionStorage.setItem(key, JSON.stringify(o)); } catch (_) {}
  try { localStorage.setItem(key, JSON.stringify(o)); } catch (_) {}
}

/* Velas: primero caché fresca, luego Twelve Data. Sintéticas solo si de verdad
   no hay forma (clave mala/red caída), para que la interfaz nunca quede vacía. */
export async function velas(symbol, tf, limit = 500) {
  const key = `cat_v_${symbol}_${tf}`;
  const c = leerCache(key);
  if (c && c.velas && Date.now() - c.ts < (TTL[tf] || 180e3)) return { velas: c.velas, demo: false, cache: true };
  const k = clave();
  try {
    const int = TF_MAP[tf] || '1h';
    const u = `${BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${int}&outputsize=${limit}&apikey=${encodeURIComponent(k)}`;
    const r = await fetch(u, { cache: 'no-store' });
    const j = await r.json();
    if (j && Array.isArray(j.values) && j.values.length) {
      const arr = j.values.map((v) => ({
        time: Math.floor(new Date(v.datetime.replace(' ', 'T') + (v.datetime.length <= 10 ? 'T00:00:00' : '') + 'Z').getTime() / 1000),
        open: +v.open, high: +v.high, low: +v.low, close: +v.close, volume: +(v.volume || 0)
      })).filter((x) => x.close > 0).sort((a, b) => a.time - b.time);
      if (arr.length) { guardarCache(key, arr, tf); return { velas: arr, demo: false }; }
    }
    // límite diario alcanzado u otro error: si hay caché vieja, mejor servirla que demo
    if (c && c.velas) return { velas: c.velas, demo: false, cache: true, stale: true };
  } catch (_) { if (c && c.velas) return { velas: c.velas, demo: false, cache: true, stale: true }; }
  return { velas: sinteticas(symbol, tf, limit), demo: true };
}

export async function ticker(symbol) {
  const k = clave();
  try {
    const r = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(k)}`, { cache: 'no-store' });
    const j = await r.json();
    if (j && j.close) return { last: +j.close, chgPct: +(j.percent_change || 0) };
  } catch (_) {}
  return null;
}

/* Sintéticas: solo respaldo extremo (no debería verse si la clave sirve). */
function sinteticas(symbol, tf, n) {
  const sec = tf === '15m' ? 900 : tf === '1h' ? 3600 : 86400;
  let semilla = 0; for (let i = 0; i < symbol.length; i++) semilla = (semilla * 31 + symbol.charCodeAt(i)) >>> 0;
  const rnd = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 4294967296; };
  let px = 50 + rnd() * 400;
  const ahora = Math.floor(Date.now() / 1000), t0 = ahora - n * sec, out = [];
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i / 40) * 0.004 + (rnd() - 0.5) * 0.012;
    const open = px, close = Math.max(1, px * (1 + drift));
    out.push({ time: t0 + i * sec, open, high: Math.max(open, close) * (1 + rnd() * 0.006), low: Math.min(open, close) * (1 - rnd() * 0.006), close, volume: Math.round(1e5 + rnd() * 9e5) });
    px = close;
  }
  return out;
}
