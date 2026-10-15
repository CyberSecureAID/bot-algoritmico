/* launchpad/config.js. Direcciones y constantes del modulo Launchpad (sellado).
   Fase 1: solo interfaz. Las direcciones del contrato quedan en cero hasta el despliegue;
   la web lo detecta y avisa "pending" en vez de intentar firmar. */

export const RED = { chainIdHex: '0x38', nombre: 'BNB Smart Chain' };
export const RPCS = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
  'https://bsc.publicnode.com'
];

/* Contratos del launchpad (se rellenan en la fase de contrato). */
export const LAUNCHPAD = '0x2c27B653F4fF3d7D0a4581A272E16E0E4E514128';   // proxy UUPS: fabrica de tokens + pools + candados + destinos (owner1, owner2, staking)
export const LAUNCHPAD_IMPL = '0x7f49C8E63a9706c18c880a286fbB80AB27cCE8e4';   // implementacion verificada: su Standard JSON incluye TokenDF.sol (base para verificar cada moneda)

/* Verificacion automatica de cada moneda en BscScan (Etherscan V2: una sola API, BSC = chainid 56).
   Misma key publica que ya usa Wallet Shield (solo lectura y verificacion de codigo). */
export const SCAN = {
  api: 'https://api.etherscan.io/v2/api',
  chainId: 56,
  key: 'TZQ4M8PRW6J794MWDB1D2WM3FPVVC6NKB6',
  contrato: 'TokenDF.sol:TokenDF'
};

/* Precio de BNB en USDT (API publica y gratuita de CoinGecko). Se usa solo para MOSTRAR
   los valores del panel en USDT, que es lo que un creador quiere ver, aunque el par sea BNB.
   No interviene en ninguna transaccion: las operaciones siguen en la moneda del par. */
export const COINGECKO_BNB = 'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd';

/* Monedas con las que se puede poner liquidez. */
export const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
export const USDT = '0x55d398326f99059fF775485246999027B3197955';
export const LIQUIDEZ = [
  { id: 'BNB',  simbolo: 'BNB',  address: null, decimals: 18 },
  { id: 'USDT', simbolo: 'USDT', address: USDT, decimals: 18 }
];

/* Reglas del producto (las mismas que aplicara el contrato). */
export const REGLAS = {
  decimales: 18,
  comisionEcosistemaBps: 50,         // 0.5% de lo que recibe el vendedor, en BNB/USDT: 0.20 owner1, 0.20 owner2, 0.10 staking
  comisionPoolBps: 30,               // 0.3% se queda en las reservas del pool
  sueloMinBps: 100, sueloMaxBps: 500, // 1% a 5% de cada venta a la reserva del suelo
  fundadorMaxPct: 20,                // el creador puede quedarse hasta el 20% del supply
  vestingMeses: [3, 6, 12, 24],
  candadoMeses: [6, 12, 24, 0],      // 0 = para siempre
  candadoMinMeses: 6,
  antibot: { maxWalletBps: 100, horas: 24 },
  simboloMin: 3, simboloMax: 6, nombreMax: 32
};

export const PRESETS_SUPPLY = [
  { t: '1 million', v: 1000000 },
  { t: '100 million', v: 100000000 },
  { t: '1 billion', v: 1000000000 }
];

export const LOGO_MAX_PX = 128;   // mismo tamano que List your token: cabe de sobra en Firestore
