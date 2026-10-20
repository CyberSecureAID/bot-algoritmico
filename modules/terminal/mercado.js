/* terminal/mercado.js. Datos de mercado por token (modulo sellado, SIN servidor propio).
   Fuente: DexScreener (gratis, sin key, con CORS), la misma que ya usa Shield. De cada token saca
   market cap, volumen 24h, compradores 24h (txns de compra) y cambio 24h, todo REAL, nada inventado.
   Un token recien nacido aun sin indexar devuelve null (se muestra como 0 hasta que DexScreener lo tenga).
   Cache por token con TTL para no repetir llamadas. */
const API = 'https://api.dexscreener.com/latest/dex/tokens/';
const TTL = 60000;
const low = (s) => String(s || '').toLowerCase();
const _cache = new Map();          // token -> { t, d }
const _enCurso = new Set();        // tokens con peticion en vuelo

function mejorPar(pares, token) {
  const t = low(token);
  const bsc = (pares || []).filter((p) => p && p.chainId === 'bsc' && p.baseToken && low(p.baseToken.address) === t);
  if (!bsc.length) return null;
  bsc.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
  return bsc[0];
}
function deDex(p) {
  if (!p) return null;
  const x = (p.txns && p.txns.h24) ? p.txns.h24 : {};
  return {
    precioUsd: Number(p.priceUsd) || 0,
    mc: Number(p.marketCap || p.fdv || 0) || 0,
    vol24: (p.volume && p.volume.h24 != null) ? Number(p.volume.h24) || 0 : 0,
    buys24: Number(x.buys || 0) || 0,
    cambio24: (p.priceChange && p.priceChange.h24 != null) ? Number(p.priceChange.h24) : null,
    liq: (p.liquidity && p.liquidity.usd != null) ? Number(p.liquidity.usd) || 0 : 0
  };
}

/* Lo que haya en cache para un token (o null si no hay o caduco). Lectura sincrona para pintar. */
export function mercadoDe(token) { const c = _cache.get(low(token)); return (c && Date.now() - c.t < TTL) ? c.d : null; }
/* true si ya se consulto este token (haya datos o no): distingue "cargando" de "sin mercado aun". */
export function mercadoListo(token) { const c = _cache.get(low(token)); return !!(c && Date.now() - c.t < TTL); }

/* Carga (en lotes de 30) los tokens que falten o esten caducos. Resuelve cuando termina. */
export async function cargarMercado(tokens) {
  const faltan = [];
  for (const tk of (tokens || [])) { const k = low(tk); const c = _cache.get(k); if ((!c || Date.now() - c.t >= TTL) && !_enCurso.has(k)) faltan.push(tk); }
  if (!faltan.length) return;
  faltan.forEach((tk) => _enCurso.add(low(tk)));
  try {
    for (let i = 0; i < faltan.length; i += 30) {
      const lote = faltan.slice(i, i + 30);
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 9000);
        const r = await fetch(API + lote.join(','), { headers: { accept: 'application/json' }, signal: ctrl.signal });
        clearTimeout(to);
        const d = await r.json();
        const pares = d && d.pairs ? d.pairs : [];
        for (const tk of lote) { _cache.set(low(tk), { t: Date.now(), d: deDex(mejorPar(pares, tk)) }); }
      } catch (_) { for (const tk of lote) if (!_cache.has(low(tk))) _cache.set(low(tk), { t: Date.now(), d: null }); }
    }
  } finally { faltan.forEach((tk) => _enCurso.delete(low(tk))); }
}
