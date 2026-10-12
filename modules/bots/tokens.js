/**
 * MONEDAS ADMITIDAS
 * =================
 *
 * Cada moneda declara sus propios limites en SU PROPIA UNIDAD, no en dolares.
 * Asi los premios quedan en fracciones pequeñas: satoshis, milesimas de BNB,
 * unidades de TRX. Nadie cobra cifras enormes y la banca no se expone.
 *
 * Para añadir una moneda: añade una entrada aqui. El resto de la aplicacion
 * la recoge sola — los limites, el formato y la deteccion de saldo salen de
 * este archivo.
 *
 * `address: null` significa moneda nativa de la red (BNB en BSC).
 */

export const RED = {
  chainIdHex: '0x38',
  chainId: 56,
  nombre: 'BNB Smart Chain',
  rpc: 'https://bsc-dataseed.binance.org',
  explorador: 'https://bscscan.com',
  moneda: { nombre: 'BNB', simbolo: 'BNB', decimals: 18 }
};

export const MONEDAS = {
  BNB: {
    id: 'BNB', cg: 'binancecoin',
    simbolo: 'BNB',
    nombre: 'BNB',
    address: null,              // nativa
    decimals: 18,
    icono: 'B',   // respaldo si no carga el logo remoto
    color: '#F0B90B',
    // Limites en unidades de la moneda
    minApuesta: 0.0002,         // ~$0.12
    maxPorJugada: 0.004,        // ~$2.40
    maxPorPersona: 0.01,        // ~$6 por sorteo
    maxPago: 0.03,              // ~$18 — techo de lo que puede cobrar UNA jugada
    // Como mostrarla
    decimalesVista: 5,
    unidadPequena: { nombre: 'gwei', factor: 1e9 }
  },

  USDT: {
    id: 'USDT', cg: 'tether',
    simbolo: 'USDT',
    nombre: 'Tether',
    address: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,               // USDT en BSC usa 18, no 6
    icono: 'T',
    color: '#26A17B',
    minApuesta: 0.10,
    maxPorJugada: 2.00,
    maxPorPersona: 5.00,
    maxPago: 15.00,
    decimalesVista: 2,
    unidadPequena: { nombre: 'centavos', factor: 100 }
  },

  USDC: {
    id: 'USDC', cg: 'usd-coin',
    simbolo: 'USDC',
    nombre: 'USD Coin',
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    decimals: 18,
    icono: 'C',
    color: '#2775CA',
    minApuesta: 0.10,
    maxPorJugada: 2.00,
    maxPorPersona: 5.00,
    maxPago: 15.00,
    decimalesVista: 2,
    unidadPequena: { nombre: 'centavos', factor: 100 }
  },

  BTCB: {
    id: 'BTCB', cg: 'bitcoin', categoria: 'l1',
    simbolo: 'BTCB',
    nombre: 'Bitcoin BEP20',
    address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    decimals: 18,
    icono: 'B',
    color: '#F7931A',
    // En satoshis: minimo 200 sat, maximo 4.000 sat por jugada
    minApuesta: 0.000002,
    maxPorJugada: 0.00004,
    maxPorPersona: 0.0001,
    maxPago: 0.0002,            // 20.000 sat — techo por jugada
    decimalesVista: 8,
    unidadPequena: { nombre: 'sat', factor: 1e8 }
  },

  ETH: {
    id: 'ETH', cg: 'ethereum', categoria: 'l1',
    simbolo: 'ETH',
    nombre: 'Ethereum BEP20',
    address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    decimals: 18,
    icono: 'E',
    color: '#627EEA',
    minApuesta: 0.00005,
    maxPorJugada: 0.001,
    maxPorPersona: 0.0025,
    maxPago: 0.006,
    decimalesVista: 6,
    unidadPequena: { nombre: 'gwei', factor: 1e9 }
  },

  USDTZ: {
    id: 'USDTZ',
    simbolo: 'USDT.z',
    nombre: 'USDT.z',
    address: '0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4',
    decimals: 18,
    icono: 'Z',
    color: '#26A17B',
    minApuesta: 0.10,
    maxPorJugada: 2.00,
    maxPorPersona: 5.00,
    maxPago: 15.00,
    decimalesVista: 2,
    unidadPequena: { nombre: 'centavos', factor: 100 }
  },

  BABYDOGE: {
    id: 'BABYDOGE',
    simbolo: 'BabyDoge',
    nombre: 'Baby Doge Coin',
    address: '0xc748673057861a797275CD8A068AbB95A902e8de',
    decimals: 9,
    icono: '🐶',
    color: '#F4B733',
    comisionPct: 10,            // Baby Doge cobra ~10% por transferencia
    precioUSD: 0.0000000003,    // ~0.3 mil-millonésimas de dólar (referencia)
    minApuesta: 30000000,       // ~$0.01
    maxPorJugada: 3000000000,
    maxPorPersona: 7000000000,
    maxPago: 24000000000,
    decimalesVista: 0,
    unidadPequena: { nombre: '', factor: 1 }
  },

  EXT: {
    id: 'EXT',
    simbolo: 'EXT',
    nombre: 'ExactTrader',
    address: '0xd86b5cd7cFC28a1e4Fd6b39F133bF64EF24c5246',
    decimals: 18,
    icono: 'X',
    color: '#8B5CF6',
    precioUSD: 0.000031664,     // precio de referencia
    minApuesta: 100000,
    maxPorJugada: 2000000,
    maxPorPersona: 5000000,
    maxPago: 16000000,
    decimalesVista: 0,
    unidadPequena: { nombre: '', factor: 1 }
  },

  // ---- Volátiles operables por el bot (estándar, sin impuesto de transferencia) ----
  SOL: {
    id: 'SOL', cg: 'solana', soloBot: true, categoria: 'l1', simbolo: 'SOL', nombre: 'Solana (Binance-Peg)',
    address: '0x570A5D26f7765Ecb712C0924E4De545B89fD43dF', decimals: 18,
    icono: '◎', color: '#14F195',
    minApuesta: 0.0008, maxPorJugada: 0.015, maxPorPersona: 0.04, maxPago: 0.1,
    decimalesVista: 4, unidadPequena: { nombre: '', factor: 1 }
  },
  DOGE: {
    id: 'DOGE', cg: 'dogecoin', soloBot: true, categoria: 'meme', simbolo: 'DOGE', nombre: 'Dogecoin (Binance-Peg)',
    address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', decimals: 8,
    icono: 'Ð', color: '#C2A633',
    minApuesta: 0.6, maxPorJugada: 12, maxPorPersona: 30, maxPago: 75,
    decimalesVista: 2, unidadPequena: { nombre: '', factor: 1 }
  },
  XRP: {
    id: 'XRP', cg: 'ripple', soloBot: true, categoria: 'l1', simbolo: 'XRP', nombre: 'XRP (Binance-Peg)',
    address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', decimals: 18,
    icono: '✕', color: '#25A768',
    minApuesta: 0.05, maxPorJugada: 1, maxPorPersona: 2.5, maxPago: 6,
    decimalesVista: 3, unidadPequena: { nombre: '', factor: 1 }
  },
  CAKE: {
    id: 'CAKE', cg: 'pancakeswap-token', soloBot: true, categoria: 'defi', simbolo: 'CAKE', nombre: 'PancakeSwap',
    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18,
    icono: '🥞', color: '#D1884F',
    minApuesta: 0.04, maxPorJugada: 0.8, maxPorPersona: 2, maxPago: 5,
    decimalesVista: 3, unidadPequena: { nombre: '', factor: 1 }
  },
  LINK: {
    id: 'LINK', cg: 'chainlink', soloBot: true, categoria: 'defi', simbolo: 'LINK', nombre: 'Chainlink (Binance-Peg)',
    address: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', decimals: 18,
    icono: '⬡', color: '#2A5ADA',
    minApuesta: 0.005, maxPorJugada: 0.1, maxPorPersona: 0.25, maxPago: 0.6,
    decimalesVista: 4, unidadPequena: { nombre: '', factor: 1 }
  },
  ADA: {
    id: 'ADA', cg: 'cardano', soloBot: true, categoria: 'l1', simbolo: 'ADA', nombre: 'Cardano (Binance-Peg)',
    address: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', decimals: 18,
    icono: '₳', color: '#0033AD',
    minApuesta: 0.13, maxPorJugada: 2.6, maxPorPersona: 6.6, maxPago: 16,
    decimalesVista: 3, unidadPequena: { nombre: '', factor: 1 }
  },
  DOT:   { id:'DOT', cg:'polkadot',   soloBot:true, categoria:'l1',   simbolo:'DOT',   nombre:'Polkadot (Binance-Peg)',   address:'0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', decimals:18, icono:'●', color:'#E6007A', decimalesVista:3, minApuesta:0.01, maxPorJugada:0.2, maxPorPersona:0.5, maxPago:1.2, unidadPequena:{nombre:'',factor:1} },
  LTC:   { id:'LTC', cg:'litecoin',   soloBot:true, categoria:'l1',   simbolo:'LTC',   nombre:'Litecoin (Binance-Peg)',   address:'0x4338665CBB7B2485A8855A139b75D5e34AB0DB94', decimals:18, icono:'Ł', color:'#345D9D', decimalesVista:4, minApuesta:0.002, maxPorJugada:0.04, maxPorPersona:0.1, maxPago:0.25, unidadPequena:{nombre:'',factor:1} },
  AVAX:  { id:'AVAX', cg:'avalanche-2',  soloBot:true, categoria:'l1',   simbolo:'AVAX',  nombre:'Avalanche (Binance-Peg)',  address:'0x1CE0c2827e2eF14D5C4f29a091d735A204794041', decimals:18, icono:'▲', color:'#E84142', decimalesVista:3, minApuesta:0.01, maxPorJugada:0.2, maxPorPersona:0.5, maxPago:1.2, unidadPequena:{nombre:'',factor:1} },
  MATIC: { id:'MATIC', cg:'matic-network', soloBot:true, categoria:'l1',   simbolo:'POL',   nombre:'Polygon (Binance-Peg)',    address:'0xCC42724C6683B7E57334c4E856f4c9965ED682bD', decimals:18, icono:'⬢', color:'#8247E5', decimalesVista:3, minApuesta:0.5, maxPorJugada:10, maxPorPersona:25, maxPago:60, unidadPequena:{nombre:'',factor:1} },
  ATOM:  { id:'ATOM', cg:'cosmos',  soloBot:true, categoria:'l1',   simbolo:'ATOM',  nombre:'Cosmos (Binance-Peg)',     address:'0x0Eb3a705fc54725037CC9e008bDede697f62F335', decimals:18, icono:'⚛', color:'#2E3148', decimalesVista:3, minApuesta:0.02, maxPorJugada:0.4, maxPorPersona:1, maxPago:2.5, unidadPequena:{nombre:'',factor:1} },
  NEAR:  { id:'NEAR', cg:'near',  soloBot:true, categoria:'l1',   simbolo:'NEAR',  nombre:'NEAR Protocol (Binance-Peg)', address:'0x1Fa4a73a3F0133f0025378af00236f3aBDEE5D63', decimals:18, icono:'Ⓝ', color:'#00EC97', decimalesVista:3, minApuesta:0.05, maxPorJugada:1, maxPorPersona:2.5, maxPago:6, unidadPequena:{nombre:'',factor:1} },
  FIL:   { id:'FIL', cg:'filecoin',   soloBot:true, categoria:'l1',   simbolo:'FIL',   nombre:'Filecoin (Binance-Peg)',   address:'0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153', decimals:18, icono:'⨎', color:'#0090FF', decimalesVista:3, minApuesta:0.02, maxPorJugada:0.4, maxPorPersona:1, maxPago:2.5, unidadPequena:{nombre:'',factor:1} },
  BCH:   { id:'BCH', cg:'bitcoin-cash',   soloBot:true, categoria:'l1',   simbolo:'BCH',   nombre:'Bitcoin Cash (Binance-Peg)', address:'0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf', decimals:18, icono:'Ƀ', color:'#0AC18E', decimalesVista:5, minApuesta:0.0005, maxPorJugada:0.01, maxPorPersona:0.025, maxPago:0.06, unidadPequena:{nombre:'',factor:1} },
  ETC:   { id:'ETC', cg:'ethereum-classic',   soloBot:true, categoria:'l1',   simbolo:'ETC',   nombre:'Ethereum Classic (Binance-Peg)', address:'0x3d6545b08693daE087E957cb1180ee38B9e3c25E', decimals:18, icono:'ξ', color:'#328332', decimalesVista:4, minApuesta:0.005, maxPorJugada:0.1, maxPorPersona:0.25, maxPago:0.6, unidadPequena:{nombre:'',factor:1} },
  EOS:   { id:'EOS', cg:'eos',   soloBot:true, categoria:'l1',   simbolo:'EOS',   nombre:'EOS (Binance-Peg)',        address:'0x56b6fB708fC5732DEC1Afc8D8556423A2EDcCbD6', decimals:18, icono:'Ⓔ', color:'#443F54', decimalesVista:3, minApuesta:0.1, maxPorJugada:2, maxPorPersona:5, maxPago:12, unidadPequena:{nombre:'',factor:1} },
  UNI:   { id:'UNI', cg:'uniswap',   soloBot:true, categoria:'defi', simbolo:'UNI',   nombre:'Uniswap (Binance-Peg)',    address:'0xBf5140A22578168FD562DCcF235E5D43A02ce9B1', decimals:18, icono:'🦄', color:'#FF007A', decimalesVista:3, minApuesta:0.02, maxPorJugada:0.4, maxPorPersona:1, maxPago:2.5, unidadPequena:{nombre:'',factor:1} },
  AAVE:  { id:'AAVE', cg:'aave',  soloBot:true, categoria:'defi', simbolo:'AAVE',  nombre:'Aave (Binance-Peg)',       address:'0xfb6115445Bff7b52FeB98650C87f44907E58f802', decimals:18, icono:'👻', color:'#B6509E', decimalesVista:4, minApuesta:0.001, maxPorJugada:0.02, maxPorPersona:0.05, maxPago:0.12, unidadPequena:{nombre:'',factor:1} },
  XVS:   { id:'XVS', cg:'venus',   soloBot:true, categoria:'defi', simbolo:'XVS',   nombre:'Venus',                   address:'0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63', decimals:18, icono:'V', color:'#F4B731', decimalesVista:3, minApuesta:0.01, maxPorJugada:0.2, maxPorPersona:0.5, maxPago:1.2, unidadPequena:{nombre:'',factor:1} },
  INJ:   { id:'INJ', cg:'injective-protocol',   soloBot:true, categoria:'defi', simbolo:'INJ',   nombre:'Injective (Binance-Peg)',  address:'0xa2B726B1145A4773F68593CF171187d8EBe4d495', decimals:18, icono:'🥷', color:'#00A6FB', decimalesVista:3, minApuesta:0.02, maxPorJugada:0.4, maxPorPersona:1, maxPago:2.5, unidadPequena:{nombre:'',factor:1} },
  TWT:   { id:'TWT', cg:'trust-wallet-token',   soloBot:true, categoria:'defi', simbolo:'TWT',   nombre:'Trust Wallet Token',      address:'0x4B0F1812e5Df2A09796481Ff14017e6005508003', decimals:18, icono:'🛡', color:'#3375BB', decimalesVista:3, minApuesta:0.1, maxPorJugada:2, maxPorPersona:5, maxPago:12, unidadPequena:{nombre:'',factor:1} },
  SHIB:  { id:'SHIB', cg:'shiba-inu',  soloBot:true, categoria:'meme', simbolo:'SHIB',  nombre:'Shiba Inu (Binance-Peg)',  address:'0x2859e4544C4bB03966803b044A93563Bd2D0DD4D', decimals:18, icono:'🐕', color:'#FFA409', decimalesVista:0, minApuesta:100000, maxPorJugada:2000000, maxPorPersona:5000000, maxPago:12000000, unidadPequena:{nombre:'',factor:1} },
  FLOKI: { id:'FLOKI', cg:'floki', soloBot:true, categoria:'meme', simbolo:'FLOKI', nombre:'Floki',                   address:'0xfb5B838b6cfEEdC2873aB27866079AC55363D37E', decimals:9,  icono:'🐶', color:'#F0841E', decimalesVista:0, minApuesta:1000, maxPorJugada:20000, maxPorPersona:50000, maxPago:120000, unidadPequena:{nombre:'',factor:1} }
};

// Enlaces para comprar cada moneda (plataformas seguras y reconocidas).
export const COMPRAR_URL = {
  BNB:      'https://www.moonpay.com/buy/bnb',
  USDT:     'https://pancakeswap.finance/swap?outputCurrency=0x55d398326f99059fF775485246999027B3197955',
  USDC:     'https://pancakeswap.finance/swap?outputCurrency=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BTCB:     'https://pancakeswap.finance/swap?outputCurrency=0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  ETH:      'https://pancakeswap.finance/swap?outputCurrency=0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
  USDTZ:    'https://pancakeswap.finance/swap?outputCurrency=0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4',
  BABYDOGE: 'https://pancakeswap.finance/swap?outputCurrency=0xc748673057861a797275CD8A068AbB95A902e8de',
  EXT:      'https://smartdefi.com/token/bsc/0xd86b5cd7cFC28a1e4Fd6b39F133bF64EF24c5246/(chart//secondary:swap)',
  SOL:      'https://pancakeswap.finance/swap?outputCurrency=0x570A5D26f7765Ecb712C0924E4De545B89fD43dF',
  DOGE:     'https://pancakeswap.finance/swap?outputCurrency=0xbA2aE424d960c26247Dd6c32edC70B295c744C43',
  XRP:      'https://pancakeswap.finance/swap?outputCurrency=0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE',
  CAKE:     'https://pancakeswap.finance/swap?outputCurrency=0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  LINK:     'https://pancakeswap.finance/swap?outputCurrency=0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD',
  ADA:      'https://pancakeswap.finance/swap?outputCurrency=0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47'
};

export const LISTA_MONEDAS = Object.values(MONEDAS).filter((m) => !m.soloBot); // lotería: sin monedas solo-bot
export const LISTA_TODAS   = Object.values(MONEDAS);                              // bot: todas

/**
 * Formatea una cantidad en la unidad de la moneda.
 * Recorta ceros a la derecha para que no se vea "0.00200000".
 */
/**
 * Formatea cifras GRANDES de forma compacta para que no se desborden:
 *   1 234        -> "1,234"
 *   45 300       -> "45.3 K"
 *   1 500 000    -> "1.5 M"
 *   33 200 000000 -> "33.2 B"  (miles de millones)
 *   2 500 000000000 -> "2.5 T" (billones)
 * Ideal para Baby Doge y tokens de precio ínfimo donde con pocos dólares se
 * compran miles de millones de unidades.
 */
export function compacto(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2).replace(/\.?0+$/, '') + ' T';
  if (abs >= 1e9)  return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' B';
  if (abs >= 1e6)  return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + ' M';
  if (abs >= 1e4)  return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + ' K';
  // Por debajo de 10.000, con separador de miles
  return Math.round(n).toLocaleString('en-US');
}

export function formatear(cantidad, moneda, { conSimbolo = true } = {}) {
  if (cantidad === null || cantidad === undefined || isNaN(cantidad)) return '—';

  let txt;
  if (cantidad === 0) {
    txt = '0';
  } else if (cantidad >= 10000) {
    // Cifras grandes: forma compacta (Baby Doge, EXT...) para no desbordar.
    txt = compacto(cantidad);
  } else if (cantidad < 1 / Math.pow(10, moneda.decimalesVista)) {
    txt = cantidad.toFixed(8).replace(/\.?0+$/, '');
  } else {
    txt = cantidad.toFixed(moneda.decimalesVista).replace(/\.?0+$/, '');
  }

  return conSimbolo ? `${txt} ${moneda.simbolo}` : txt;
}

/**
 * Version corta para el saldo grande del banner: separa la parte entera
 * de los decimales para poder darles tamaños distintos.
 */
export function partirSaldo(cantidad, moneda) {
  if (cantidad === null || cantidad === undefined || isNaN(cantidad)) {
    return { entero: '0', decimal: '', simbolo: moneda.simbolo };
  }
  // Cifras grandes: forma compacta, todo en la parte "entera" (sin decimales
  // sueltos que descuadren), para que no se desborde el saldo.
  if (cantidad >= 10000) {
    return { entero: compacto(cantidad), decimal: '', simbolo: moneda.simbolo };
  }
  const dec = cantidad > 0 && cantidad < 1 / Math.pow(10, moneda.decimalesVista)
    ? 8 : moneda.decimalesVista;
  const txt = cantidad.toFixed(dec).replace(/\.?0+$/, '');
  const [entero, decimal = ''] = txt.split('.');
  return { entero, decimal, simbolo: moneda.simbolo };
}

/** La misma cantidad expresada en su unidad pequeña: satoshis, gwei, centavos. */
export function enUnidadPequena(cantidad, moneda) {
  if (!moneda.unidadPequena) return null;
  const v = cantidad * moneda.unidadPequena.factor;
  const redondeado = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${redondeado.toLocaleString('es')} ${moneda.unidadPequena.nombre}`;
}

/** Convierte de unidades base (wei) a decimal. */
export function desdeBase(valorHex, decimals) {
  const bruto = BigInt(valorHex);
  const divisor = 10n ** BigInt(decimals);
  const entera = bruto / divisor;
  const resto = bruto % divisor;
  const frac = resto.toString().padStart(decimals, '0');
  return parseFloat(`${entera}.${frac}`);
}
