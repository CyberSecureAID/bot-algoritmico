/* terminal/config.js. Direcciones y constantes del modulo Terminal (sellado).
   Todas las direcciones son las que ya usa el ecosistema (swap y launchpad); nada inventado. */

export const RED = { chainIdHex: '0x38', nombre: 'BNB Smart Chain' };
export const RPCS = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
  'https://bsc.publicnode.com'
];

/* PancakeSwap V2: la fabrica emite PairCreated cada vez que nace un par. */
export const FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
export const WBNB    = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
export const USDT    = '0x55d398326f99059fF775485246999027B3197955';

/* Launchpad de DecFreedom (proxy): emite TokenCreado por cada moneda creada aqui. */
export const LAUNCHPAD = '0x2c27B653F4fF3d7D0a4581A272E16E0E4E514128';

/* Precio BNB/USD para mostrar liquidez y precio en dolares. */
export const COINGECKO_BNB = 'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd';

/* Feed: cuantos bloques hacia atras al abrir (BSC ~0.45 s por bloque: 4000 ~ 30 min), cuantos
   por consulta (los RPC publicos limitan el rango de eth_getLogs) y cada cuanto se sondea. */
export const FEED = { bloquesInicio: 4000, bloquesPorConsulta: 1000, sondeoMs: 3000, maxFilas: 80 };

export const SCAN_URL = 'https://bscscan.com';
