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
export const LAUNCHPAD = '0x0000000000000000000000000000000000000000';   // proxy UUPS: fabrica de tokens + pools + candados + destinos (owner1, owner2, staking)

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
