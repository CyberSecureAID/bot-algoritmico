/* gridbot/estado.js — Estado compartido de la app de bots.
   LOGOS es la caché de logos y precios (id -> {img, price, chg}) que llenan
   CoinGecko y que leen las tarjetas, el selector y el swap. Solo se muta. */

export const LOGOS = {};

/* Estado de la carga de logos/precios desde CoinGecko (compartido). */
export const LOGO_ST = { cargando: false, ok: false };
