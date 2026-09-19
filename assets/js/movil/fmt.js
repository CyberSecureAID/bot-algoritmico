/* movil/fmt.js — Formato uniforme, compacto y legible para toda la app móvil. */

/* Reutilizamos la MISMA tabla de logos que llena la web (incluye respaldos).
   Si CoinGecko está bloqueado/limitado (p.ej. dentro del navegador de una
   wallet), la web igual carga desde GitHub; así el móvil hereda esos logos. */
import { LOGOS as WEB_LOGOS } from '../gridbot/estado.js?v=1';

/* Logos conocidos servidos desde GitHub (Trust Wallet assets / raw), que SÍ
   cargan dentro del navegador de MetaMask/Trust/SafePal (a diferencia de
   assets.coingecko.com, que ahí suele fallar). */
const TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
export const LOGOS = {
  BTC:  `${TW}/bitcoin/info/logo.png`,
  ETH:  `${TW}/ethereum/info/logo.png`,
  BNB:  'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  WBNB: `${TW}/smartchain/assets/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c/logo.png`,
  USDT: `${TW}/smartchain/assets/0x55d398326f99059fF775485246999027B3197955/logo.png`,
  USDC: `${TW}/smartchain/assets/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d/logo.png`,
  BUSD: `${TW}/smartchain/assets/0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56/logo.png`,
  DAI:  `${TW}/smartchain/assets/0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3/logo.png`,
  CAKE: `${TW}/smartchain/assets/0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82/logo.png`,
  PAXG: `${TW}/ethereum/assets/0x45804880De22913dAFE09f4980848ECE6EcbAf78/logo.png`,
  BABYDOGE: `${TW}/smartchain/assets/0xc748673057861a797275CD8A068AbB95A902e8de/logo.png`,
  EUR:  'https://flagcdn.com/w80/eu.png',
  GBP:  'https://flagcdn.com/w80/gb.png',
  // Monedas del mercado (cadenas nativas / tokens conocidos) desde GitHub:
  SOL:  `${TW}/solana/info/logo.png`,
  XRP:  `${TW}/ripple/info/logo.png`,
  DOGE: `${TW}/doge/info/logo.png`,
  ADA:  `${TW}/cardano/info/logo.png`,
  AVAX: `${TW}/avalanchec/info/logo.png`,
  DOT:  `${TW}/polkadot/info/logo.png`,
  MATIC:`${TW}/polygon/info/logo.png`,
  POL:  `${TW}/polygon/info/logo.png`,
  LTC:  `${TW}/litecoin/info/logo.png`,
  TRX:  `${TW}/tron/info/logo.png`,
  ATOM: `${TW}/cosmos/info/logo.png`,
  NEAR: `${TW}/near/info/logo.png`,
  APT:  `${TW}/aptos/info/logo.png`,
  SUI:  `${TW}/sui/info/logo.png`,
  FIL:  `${TW}/filecoin/info/logo.png`,
  LINK: `${TW}/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png`,
  UNI:  `${TW}/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png`,
  SHIB: `${TW}/ethereum/assets/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE/logo.png`,
  PEPE: `${TW}/ethereum/assets/0x6982508145454Ce325dDbE47a25d4ec3d2311933/logo.png`,
  ARB:  `${TW}/arbitrum/info/logo.png`,
  OP:   `${TW}/optimism/info/logo.png`,
  INJ:  `${TW}/ethereum/assets/0xe28b3B32B6c345A34Ff64674606124Dd5Aceca30/logo.png`,
};

/* Devuelve la MEJOR URL de logo disponible para una moneda, probando en orden:
   1) la tabla que llena la web (CoinGecko o su respaldo), 2) nuestros logos de
   GitHub, 3) la cache de CoinGecko del móvil. */
export function logoDe(id, cg, cache) {
  const k = String(id || '').toUpperCase().replace(/\s+/g, '');
  try { if (WEB_LOGOS && WEB_LOGOS[k] && WEB_LOGOS[k].img) return WEB_LOGOS[k].img; } catch (_) {}
  if (LOGOS[k]) return LOGOS[k];
  if (cg && cache && cache[cg] && cache[cg].img) return cache[cg].img;
  return '';
}

/* Valor monetario en USD: 2 decimales; muy pequeños como "<$0.01". */
export function money(v) {
  v = Number(v);
  if (!isFinite(v)) return '$0.00';
  if (v === 0) return '$0.00';
  if (v > 0 && v < 0.01) return '<$0.01';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Igual que money pero sin el símbolo $ (para "≈ 11.03"). */
export function money0(v) { return money(v).replace('$', ''); }

/* Cantidad de tokens: compacta. Grandes → B/M/K; normales → 2 dec; muy
   pequeñas → hasta 4-6 dígitos significativos sin colas interminables. */
export function cantidad(v) {
  v = Number(v);
  if (!isFinite(v) || v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'B';
  if (a >= 1e6) return (v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'M';
  if (a >= 1e3) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (a >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (a >= 0.01) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/* Precio de mercado (para listas/gráficas): compacto según magnitud. */
export function precio(p) {
  p = Number(p);
  if (!isFinite(p)) return '';
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 0.01) return p.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return p.toLocaleString('en-US', { maximumFractionDigits: 8 });
}
