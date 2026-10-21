/* terminal/gecko.js. Velas (OHLCV) desde GeckoTerminal — fuente GRATIS, sin API key, accesible desde el
   navegador (CORS), que cubre TRON y BSC por pool. Es el RESPALDO del grafico cuando un token no tiene par V2
   de PancakeSwap (Tron, V3, tokens de otras DEX) y por eso el metodo de eventos Sync no puede dibujar nada: asi
   una moneda que SI tiene grafico en el mundo real (Pepe en Tron, un USDT.z, etc.) tambien lo tiene aqui.
   Devuelve el MISMO formato de vela {time,open,high,low,close} para que el render no cambie. Modulo sellado:
   sin imports; una sola API publica. Ritmo: GeckoTerminal permite ~30 llamadas/min, de sobra para una ficha. */

// DOS origenes para las MISMAS velas: GeckoTerminal y el espejo on-chain de CoinGecko (mismo dataset, distinto
// CDN, los dos gratis, sin key y con CORS abierto). Si uno limita por ritmo (GeckoTerminal ~30/min) o falla, se
// prueba el otro -> mas monedas tienen grafica. Ambos usan la MISMA ruta despues de su base.
const GT_BASES = ['https://api.geckoterminal.com/api/v2', 'https://api.coingecko.com/api/v3/onchain'];
const RED_GT = { bsc: 'bsc', tron: 'tron' };

/* tfSec (segundos del selector del OFC) -> timeframe+aggregate de GeckoTerminal. */
function tfGecko(sec) {
  if (sec <= 60) return { tf: 'minute', agg: 1 };
  if (sec <= 300) return { tf: 'minute', agg: 5 };
  if (sec <= 900) return { tf: 'minute', agg: 15 };
  if (sec <= 3600) return { tf: 'hour', agg: 1 };
  if (sec <= 14400) return { tf: 'hour', agg: 4 };
  return { tf: 'day', agg: 1 };
}
/* Pide la MISMA ruta a los dos origenes en cascada: el primero que responda OK gana. path empieza por '/'. */
async function jget(path) {
  let lastErr = null;
  for (const base of GT_BASES) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 11000);
    try { const r = await fetch(base + path, { signal: c.signal, headers: { accept: 'application/json' } }); clearTimeout(t); if (r.ok) return await r.json(); lastErr = new Error('HTTP ' + r.status); }
    catch (e) { clearTimeout(t); lastErr = e; }
  }
  throw lastErr || new Error('gecko');
}

const _poolCache = new Map();
/* Pool de MAS liquidez del token en GeckoTerminal (orden por defecto), o null si no cotiza en ninguna DEX. */
export async function poolGecko(token, red) {
  const net = RED_GT[red] || 'bsc'; const key = net + ':' + String(token).toLowerCase();
  if (_poolCache.has(key)) return _poolCache.get(key);
  let pool = null;
  try {
    const j = await jget('/networks/' + net + '/tokens/' + encodeURIComponent(token) + '/pools');
    const d = (j && j.data) || [];
    if (d.length && d[0].attributes && d[0].attributes.address) pool = d[0].attributes.address;
  } catch (_) {}
  _poolCache.set(key, pool); return pool;
}

/* Velas del token al timeframe pedido. [] si no hay pool o no hay datos. */
export async function velasGecko(token, red, tfSec) {
  const net = RED_GT[red] || 'bsc';
  const pool = await poolGecko(token, red); if (!pool) return [];
  const { tf, agg } = tfGecko(tfSec || 900);
  let j; try { j = await jget('/networks/' + net + '/pools/' + encodeURIComponent(pool) + '/ohlcv/' + tf + '?aggregate=' + agg + '&limit=300&currency=usd'); } catch (_) { return []; }
  const lista = j && j.data && j.data.attributes && j.data.attributes.ohlcv_list;
  if (!Array.isArray(lista) || !lista.length) return [];
  // ohlcv_list: cada fila [ts, O, H, L, C, vol], la MAS NUEVA primero -> se recorre al reves para dejarlas
  // en orden ascendente (lightweight-charts exige tiempos estrictamente crecientes).
  const velas = [];
  for (let i = lista.length - 1; i >= 0; i--) {
    const row = lista[i]; if (!Array.isArray(row) || row.length < 5) continue;
    const t = Math.floor(Number(row[0])), o = Number(row[1]), h = Number(row[2]), l = Number(row[3]), c = Number(row[4]);
    if (!(o > 0) || !isFinite(c) || !(c > 0)) continue;
    velas.push({ time: t, open: o, high: Math.max(o, h, c), low: Math.min(o, l, c), close: c });
  }
  for (let i = 1; i < velas.length; i++) if (velas[i].time <= velas[i - 1].time) velas[i].time = velas[i - 1].time + 1;
  return velas;
}

/* Precio en vivo (ultimo cierre) desde GeckoTerminal, para tokens sin otra fuente de precio. 0 si no hay. */
export async function precioGecko(token, red) {
  try { const v = await velasGecko(token, red, 900); return v.length ? v[v.length - 1].close : 0; } catch (_) { return 0; }
}
