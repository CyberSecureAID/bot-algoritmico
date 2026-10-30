/* niveles/config.js — CATÁLOGO ÚNICO de pares (PARES) y temporalidades (TFS).

   [UNIFICACIÓN] Antes cada sección (Smart Pools, Heat Pools, Liquidity Pools)
   tenía su propia lista con distinta cantidad de monedas. Ahora las tres
   importan ESTA lista, así que todas muestran exactamente las mismas monedas,
   con el mismo logo y el mismo orden. Para añadir o quitar una moneda se toca
   solo aquí.

   Campos:
     id    — símbolo corto que ve el usuario (BTC, ETH…)
     s     — par real en Binance para las velas (BTCUSDT…)
     n     — nombre completo
     cg    — id en CoinGecko para el logo (vacío si no tiene; usa `ico`)
     grupo — 'cripto' (por defecto) | 'divisa' (Forex) | 'materia' (materias primas)
     ico   — texto/emoji de respaldo para el logo cuando no hay cg (EUR, GBP…)

   Cada par de esta lista ya funcionaba en alguna de las tres secciones: no hay
   ninguno inventado. Operar (spot, clic derecho) seguirá dependiendo de que la
   moneda tenga contrato en tokens.js (eso se amplía al integrar los contratos);
   el filtro del selector marca cuáles son operables. */

export const PARES = [
  /* ── Criptomonedas ── */
  { id: 'BTC',    s: 'BTCUSDT',    n: 'Bitcoin',              cg: 'bitcoin' },
  { id: 'ETH',    s: 'ETHUSDT',    n: 'Ethereum',             cg: 'ethereum' },
  { id: 'BNB',    s: 'BNBUSDT',    n: 'BNB',                  cg: 'binancecoin' },
  { id: 'SOL',    s: 'SOLUSDT',    n: 'Solana',               cg: 'solana' },
  { id: 'XRP',    s: 'XRPUSDT',    n: 'XRP',                  cg: 'ripple' },
  { id: 'DOGE',   s: 'DOGEUSDT',   n: 'Dogecoin',             cg: 'dogecoin' },
  { id: 'ADA',    s: 'ADAUSDT',    n: 'Cardano',              cg: 'cardano' },
  { id: 'AVAX',   s: 'AVAXUSDT',   n: 'Avalanche',            cg: 'avalanche-2' },
  { id: 'LINK',   s: 'LINKUSDT',   n: 'Chainlink',            cg: 'chainlink' },
  { id: 'DOT',    s: 'DOTUSDT',    n: 'Polkadot',             cg: 'polkadot' },
  { id: 'POL',    s: 'POLUSDT',    n: 'Polygon',              cg: 'matic-network' },
  { id: 'LTC',    s: 'LTCUSDT',    n: 'Litecoin',             cg: 'litecoin' },
  { id: 'TRX',    s: 'TRXUSDT',    n: 'TRON',                 cg: 'tron' },
  { id: 'BCH',    s: 'BCHUSDT',    n: 'Bitcoin Cash',         cg: 'bitcoin-cash' },
  { id: 'SHIB',   s: 'SHIBUSDT',   n: 'Shiba Inu',            cg: 'shiba-inu' },
  { id: 'PEPE',   s: 'PEPEUSDT',   n: 'Pepe',                 cg: 'pepe' },
  { id: 'NEAR',   s: 'NEARUSDT',   n: 'NEAR',                 cg: 'near' },
  { id: 'SUI',    s: 'SUIUSDT',    n: 'Sui',                  cg: 'sui' },
  { id: 'ARB',    s: 'ARBUSDT',    n: 'Arbitrum',             cg: 'arbitrum' },
  { id: 'OP',     s: 'OPUSDT',     n: 'Optimism',             cg: 'optimism' },
  { id: 'ATOM',   s: 'ATOMUSDT',   n: 'Cosmos',               cg: 'cosmos' },
  { id: 'UNI',    s: 'UNIUSDT',    n: 'Uniswap',              cg: 'uniswap' },
  { id: 'INJ',    s: 'INJUSDT',    n: 'Injective',            cg: 'injective-protocol' },
  { id: 'TON',    s: 'TONUSDT',    n: 'Toncoin',              cg: 'the-open-network' },
  { id: 'APT',    s: 'APTUSDT',    n: 'Aptos',                cg: 'aptos' },
  { id: 'FIL',    s: 'FILUSDT',    n: 'Filecoin',             cg: 'filecoin' },
  { id: 'ETC',    s: 'ETCUSDT',    n: 'Ethereum Classic',     cg: 'ethereum-classic' },
  { id: 'HBAR',   s: 'HBARUSDT',   n: 'Hedera',               cg: 'hedera-hashgraph' },
  { id: 'ICP',    s: 'ICPUSDT',    n: 'Internet Computer',    cg: 'internet-computer' },
  { id: 'IMX',    s: 'IMXUSDT',    n: 'Immutable',            cg: 'immutable-x' },
  { id: 'RENDER', s: 'RENDERUSDT', n: 'Render',               cg: 'render-token' },
  { id: 'STX',    s: 'STXUSDT',    n: 'Stacks',               cg: 'blockstack' },
  { id: 'TIA',    s: 'TIAUSDT',    n: 'Celestia',             cg: 'celestia' },
  { id: 'SEI',    s: 'SEIUSDT',    n: 'Sei',                  cg: 'sei-network' },
  { id: 'ALGO',   s: 'ALGOUSDT',   n: 'Algorand',             cg: 'algorand' },
  { id: 'VET',    s: 'VETUSDT',    n: 'VeChain',              cg: 'vechain' },
  { id: 'GALA',   s: 'GALAUSDT',   n: 'Gala',                 cg: 'gala' },
  { id: 'SAND',   s: 'SANDUSDT',   n: 'The Sandbox',          cg: 'the-sandbox' },
  { id: 'MANA',   s: 'MANAUSDT',   n: 'Decentraland',         cg: 'decentraland' },
  { id: 'AXS',    s: 'AXSUSDT',    n: 'Axie Infinity',        cg: 'axie-infinity' },
  { id: 'AAVE',   s: 'AAVEUSDT',   n: 'Aave',                 cg: 'aave' },
  { id: 'MKR',    s: 'MKRUSDT',    n: 'Maker',                cg: 'maker' },
  { id: 'GRT',    s: 'GRTUSDT',    n: 'The Graph',            cg: 'the-graph' },
  { id: 'LDO',    s: 'LDOUSDT',    n: 'Lido DAO',             cg: 'lido-dao' },
  { id: 'CRV',    s: 'CRVUSDT',    n: 'Curve',                cg: 'curve-dao-token' },
  { id: 'SNX',    s: 'SNXUSDT',    n: 'Synthetix',            cg: 'havven' },
  { id: 'RUNE',   s: 'RUNEUSDT',   n: 'THORChain',            cg: 'thorchain' },
  { id: 'FLOW',   s: 'FLOWUSDT',   n: 'Flow',                 cg: 'flow' },
  { id: 'CHZ',    s: 'CHZUSDT',    n: 'Chiliz',               cg: 'chiliz' },
  { id: 'THETA',  s: 'THETAUSDT',  n: 'Theta Network',        cg: 'theta-token' },
  { id: 'XLM',    s: 'XLMUSDT',    n: 'Stellar',              cg: 'stellar' },
  { id: 'XTZ',    s: 'XTZUSDT',    n: 'Tezos',                cg: 'tezos' },
  { id: 'EOS',    s: 'EOSUSDT',    n: 'EOS',                  cg: 'eos' },
  { id: 'IOTA',   s: 'IOTAUSDT',   n: 'IOTA',                 cg: 'iota' },
  { id: 'CAKE',   s: 'CAKEUSDT',   n: 'PancakeSwap',          cg: 'pancakeswap-token' },
  { id: 'DYDX',   s: 'DYDXUSDT',   n: 'dYdX',                 cg: 'dydx-chain' },
  { id: 'JUP',    s: 'JUPUSDT',    n: 'Jupiter',              cg: 'jupiter-exchange-solana' },
  { id: 'PYTH',   s: 'PYTHUSDT',   n: 'Pyth Network',         cg: 'pyth-network' },
  { id: 'WIF',    s: 'WIFUSDT',    n: 'dogwifhat',            cg: 'dogwifcoin' },
  { id: 'BONK',   s: 'BONKUSDT',   n: 'Bonk',                 cg: 'bonk' },
  { id: 'FLOKI',  s: 'FLOKIUSDT',  n: 'Floki',                cg: 'floki' },
  { id: 'JASMY',  s: 'JASMYUSDT',  n: 'JasmyCoin',            cg: 'jasmycoin' },
  { id: 'ENA',    s: 'ENAUSDT',    n: 'Ethena',               cg: 'ethena' },
  { id: 'FET',    s: 'FETUSDT',    n: 'Artificial Superintelligence', cg: 'fetch-ai' },
  { id: 'ORDI',   s: 'ORDIUSDT',   n: 'ORDI',                 cg: 'ordinals' },
  { id: 'W',      s: 'WUSDT',      n: 'Wormhole',             cg: 'wormhole' },
  { id: 'STRK',   s: 'STRKUSDT',   n: 'Starknet',             cg: 'starknet' },
  { id: 'PENDLE', s: 'PENDLEUSDT', n: 'Pendle',               cg: 'pendle' },
  { id: 'ENS',    s: 'ENSUSDT',    n: 'Ethereum Name Service', cg: 'ethereum-name-service' },
  { id: 'COMP',   s: 'COMPUSDT',   n: 'Compound',             cg: 'compound-governance-token' },
  { id: 'DASH',   s: 'DASHUSDT',   n: 'Dash',                 cg: 'dash' },
  { id: 'ZEC',    s: 'ZECUSDT',    n: 'Zcash',                cg: 'zcash' },
  { id: 'KAVA',   s: 'KAVAUSDT',   n: 'Kava',                 cg: 'kava' },
  { id: 'MINA',   s: 'MINAUSDT',   n: 'Mina',                 cg: 'mina-protocol' },
  { id: 'ROSE',   s: 'ROSEUSDT',   n: 'Oasis',                cg: 'oasis-network' },
  { id: 'ZIL',    s: 'ZILUSDT',    n: 'Zilliqa',              cg: 'zilliqa' },
  { id: 'QNT',    s: 'QNTUSDT',    n: 'Quant',                cg: 'quant-network' },
  { id: 'GMT',    s: 'GMTUSDT',    n: 'GMT',                  cg: 'stepn' },
  { id: 'APE',    s: 'APEUSDT',    n: 'ApeCoin',              cg: 'apecoin' },
  { id: 'LRC',    s: 'LRCUSDT',    n: 'Loopring',             cg: 'loopring' },
  { id: 'ANKR',   s: 'ANKRUSDT',   n: 'Ankr',                 cg: 'ankr' },
  { id: 'WLD',    s: 'WLDUSDT',    n: 'Worldcoin',            cg: 'worldcoin-wld' },
  { id: 'NOT',    s: 'NOTUSDT',    n: 'Notcoin',              cg: 'notcoin' },

  /* ── Forex (análisis; no operable en spot BNB Chain) ── */
  { id: 'EUR',    s: 'EURUSDT',    n: 'Euro',                 cg: '', grupo: 'divisa', ico: '€' },
  { id: 'GBP',    s: 'GBPUSDT',    n: 'Libra esterlina',      cg: '', grupo: 'divisa', ico: '£' },

  /* ── Materias primas ── */
  { id: 'PAXG',   s: 'PAXGUSDT',   n: 'Oro (PAX Gold)',       cg: 'pax-gold', grupo: 'materia' }
];

export const TFS = [
  { id: '1m',  n: '1m' },
  { id: '3m',  n: '3m' },
  { id: '5m',  n: '5m' },
  { id: '15m', n: '15m' },
  { id: '30m', n: '30m' },
  { id: '1h',  n: '1H' },
  { id: '2h',  n: '2H' },
  { id: '4h',  n: '4H' },
  { id: '6h',  n: '6H' },
  { id: '12h', n: '12H' },
  { id: '1d',  n: '1D' },
  { id: '1w',  n: '1W' }
];
