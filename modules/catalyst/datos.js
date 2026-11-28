/* datos.js — Adaptador de datos de BOLSA para Catalyst.
 *
 * TC2000 (donde analiza el colega) es de ACCIONES de EE.UU. El precio OHLC de una
 * acción líquida es estándar, así que coincide muy de cerca con TC2000. Proveedor
 * por defecto: Twelve Data (plan gratis, funciona desde el navegador con CORS,
 * intradía 15min/1h + diario). Es un ADAPTADOR: cambiar de proveedor = cambiar
 * solo este archivo.
 *
 * CLAVE DE API: se lee de localStorage('catalyst_td_key'). Mientras no haya clave
 * o la API falle, se usan datos SINTÉTICOS (marcados como demo) para que el
 * gráfico y toda la interfaz se vean y se puedan probar igual. El dato real lo
 * confirma el usuario en su navegador con su clave.
 */

const BASE = 'https://api.twelvedata.com';
const TF_MAP = { '15m': '15min', '1h': '1h', '1D': '1day' };

/* Acciones de EE.UU. con opciones líquidas (put/call). Punto de partida; se
   puede ampliar. El dominio sirve para el logo (Clearbit) sin tocar nada más. */
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
  { s: 'SPY',  n: 'S&P 500 ETF',  dom: 'ssga.com' },
  { s: 'QQQ',  n: 'Nasdaq 100 ETF', dom: 'invesco.com' },
  { s: 'COIN', n: 'Coinbase',     dom: 'coinbase.com' }
];

export const logoDe = (a) => a && a.dom ? `https://logo.clearbit.com/${a.dom}` : '';

const clave = () => { try { return localStorage.getItem('catalyst_td_key') || ''; } catch (_) { return ''; } };
export const haveKey = () => !!clave();
export function setKey(k) { try { localStorage.setItem('catalyst_td_key', String(k || '').trim()); } catch (_) {} }

/* Velas reales desde Twelve Data; si no hay clave o falla, sintéticas (demo). */
export async function velas(symbol, tf, limit = 500) {
  const k = clave();
  if (k) {
    try {
      const int = TF_MAP[tf] || '1h';
      const u = `${BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${int}&outputsize=${limit}&apikey=${encodeURIComponent(k)}`;
      const r = await fetch(u, { cache: 'no-store' });
      const j = await r.json();
      if (j && Array.isArray(j.values) && j.values.length) {
        // Twelve Data devuelve lo más nuevo primero; lightweight-charts quiere viejo->nuevo.
        const arr = j.values.map((v) => ({
          time: Math.floor(new Date(v.datetime.replace(' ', 'T') + (v.datetime.length <= 10 ? 'T00:00:00' : '') + 'Z').getTime() / 1000),
          open: +v.open, high: +v.high, low: +v.low, close: +v.close, volume: +(v.volume || 0)
        })).filter((c) => c.close > 0).sort((a, b) => a.time - b.time);
        if (arr.length) return { velas: arr, demo: false };
      }
      // si la API respondió con error (p.ej. límite o símbolo), caemos a demo
    } catch (_) {}
  }
  return { velas: sinteticas(symbol, tf, limit), demo: true };
}

/* Cotización rápida (último precio y % del día). Demo si no hay clave. */
export async function ticker(symbol) {
  const k = clave();
  if (k) {
    try {
      const r = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(k)}`, { cache: 'no-store' });
      const j = await r.json();
      if (j && j.close) return { last: +j.close, chgPct: +(j.percent_change || 0), demo: false };
    } catch (_) {}
  }
  return null;
}

/* ── Datos sintéticos: random-walk con volatilidad realista, deterministas por
   símbolo+tf para que no "salten" entre recargas. Solo para ver la interfaz. ── */
function sinteticas(symbol, tf, n) {
  const sec = tf === '15m' ? 900 : tf === '1h' ? 3600 : 86400;
  let semilla = 0; for (let i = 0; i < symbol.length; i++) semilla = (semilla * 31 + symbol.charCodeAt(i)) >>> 0;
  const rnd = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 4294967296; };
  let px = 50 + rnd() * 400;
  const ahora = Math.floor(Date.now() / 1000);
  const t0 = ahora - n * sec;
  const out = [];
  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i / 40) * 0.004 + (rnd() - 0.5) * 0.012;
    const open = px;
    const close = Math.max(1, px * (1 + drift));
    const hi = Math.max(open, close) * (1 + rnd() * 0.006);
    const lo = Math.min(open, close) * (1 - rnd() * 0.006);
    out.push({ time: t0 + i * sec, open, high: hi, low: lo, close, volume: Math.round(1e5 + rnd() * 9e5) });
    px = close;
  }
  return out;
}
