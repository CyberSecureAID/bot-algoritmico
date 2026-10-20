/* terminal/precio.js. Precio en USD EN VIVO de un token, sea cual sea su fuente (modulo sellado).
   La Terminal naciо leyendo solo reservas de PancakeSwap V2 (precioActual). Para que la busqueda sea GLOBAL
   (tokens sin par V2: Launchpad, V3, otras DEX) y multicadena (Tron), el precio tiene que venir de la fuente
   correcta segun el item. Un solo punto para todo: el OFC y el vigilante de alertas llaman aqui.
     - fuentePrecio 'v2'  -> reservas del par (precioActual, grafico.js). El unico que ademas grafica.
     - fuentePrecio 'dex' -> precio en USD de DexScreener (cualquier DEX de BSC).
     - fuentePrecio 'tron'-> precio en USD de TronScan (lo rellena tron.js). */
import { precioActual } from './grafico.js';
import { DEXSCREENER_TOK } from './config.js';

const low = (s) => String(s || '').toLowerCase();

/* Precio en USD desde DexScreener (par de mas liquidez en BSC). */
export async function precioDex(token) {
  try {
    const r = await fetch(DEXSCREENER_TOK + token); const j = await r.json();
    const ps = ((j && j.pairs) || []).filter((p) => p && p.chainId === 'bsc' && p.baseToken && low(p.baseToken.address) === low(token));
    if (!ps.length) return 0;
    ps.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
    return Number(ps[0].priceUsd) || 0;
  } catch (_) { return 0; }
}

/* Precio en USD en vivo del item, por su fuente. Nunca lanza: si falla, 0. */
export async function precioUsdVivo(it, bnbUsd = 0) {
  if (!it) return 0;
  const f = it.fuentePrecio || 'v2';
  if (f === 'dex') return await precioDex(it.token);
  if (f === 'tron') { try { const { precioTron } = await import('./tron.js'); return await precioTron(it.token); } catch (_) { return it.precioUsd || 0; } }
  // v2: reservas del par
  try { return await precioActual({ par: it.par, token: it.token, decToken: it.decimales || 18, decQuote: 18, bnbUsd, quoteEsUSDT: it.moneda === 'USDT' }); }
  catch (_) { return 0; }
}
