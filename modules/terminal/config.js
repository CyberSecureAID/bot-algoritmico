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

/* four.meme (BNB Chain): TokenManager2 emite TokenCreate por cada moneda creada ahi (tokens creados desde
   el 5 de septiembre de 2024). Direccion contrastada en dos fuentes independientes: la documentacion de
   Bitquery (four-meme-api) y el repositorio four-meme-community/four-meme-ai (references/contract-addresses.md). */
export const FOURMEME = '0x5c952063c7fc8610FFDB798152D69F0B9550762b';
export const FOURMEME_URL = 'https://four.meme/token/';

/* Launchpad de DecFreedom (proxy): emite TokenCreado por cada moneda creada aqui. */
export const LAUNCHPAD = '0x2c27B653F4fF3d7D0a4581A272E16E0E4E514128';

/* Precio BNB/USD para mostrar liquidez y precio en dolares. */
export const COINGECKO_BNB = 'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd';

/* Feed: cuantos bloques hacia atras al abrir (BSC ~0.45 s por bloque: 4000 ~ 30 min), cuantos
   por consulta (los RPC publicos limitan el rango de eth_getLogs) y cada cuanto se sondea. */
export const FEED = { bloquesInicio: 4000, bloquesPorConsulta: 1000, sondeoMs: 3000, maxFilas: 80,
  /* four.meme crea cientos de tokens por hora sin par ni liquidez: encendido inunda la lista y tapa los pares
     reales de PancakeSwap. Apagado por defecto; ponlo en true para incluirlos. */
  fourMeme: false };

export const SCAN_URL = 'https://bscscan.com';

/* Terminal (proxy UUPS ERC1967): compra/venta por PancakeSwap V2 + registro de referidos + suscripciones
   por servicio. Comision del 1% repartida en cadena: 0.10% staking + 0.10% referidor (o 0.20% staking si no
   hay referidor) y 0.80% a los owners (0.40%/0.40%). Se interactua SIEMPRE con el PROXY. Implementacion:
   0x2c9e4D29546E6b4398178fdE9618658C1348b49F. Sustituye al antiguo TerminalSwap. */
export const TERMINAL = '0x458aA14D2B1144b34f0FD22e2F9d7031B5f288B7';
/* Slippage por defecto y opciones (en bps). Tokens recien nacidos: pools finas, se mueve rapido. */
export const SLIPPAGE = { porDefecto: 300, opciones: [100, 300, 1000] };

/* Historial del creador (defensa de entrada): BscScan via Etherscan V2 lista los contratos que ya desplego
   una wallet; DexScreener da la liquidez viva de cada uno. Son APIs publicas, sin servidor nuestro. La key
   es la misma del ecosistema (rate-limit, no es un secreto; ya va del lado del cliente en el resto del sitio). */
export const BSCSCAN_API = 'TZQ4M8PRW6J794MWDB1D2WM3FPVVC6NKB6';
export const BSCSCAN_V2 = 'https://api.etherscan.io/v2/api';
export const DEXSCREENER_TOK = 'https://api.dexscreener.com/latest/dex/tokens/';

/* Comision de Terminal: 1% en BNB, por compra y por venta. El reparto exacto lo hace el contrato. */
export const FEE_BPS = 100;
/* Compra protegida (anti sandwich), TODO interno, sin depender de nadie externo. "Protegido" = slippage
   ajustado: el contrato exige un minimo (minOut), asi que un bot solo puede sacar hasta ese slippage y, si
   el precio se pasa, la tx REVIERTE aqui mismo y no pierdes fondos (solo el intento). */
export const PROTECCION = { slipProtegido: 300, opciones: [100, 300, 1000] };
/* Montos de compra rapida (un toque), en BNB. */
export const PRESETS_BNB = [0.05, 0.1, 0.5, 1];
