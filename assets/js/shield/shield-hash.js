/* shield-hash.js — Verificación de transacción por hash.
   Lee una transacción de la BNB Smart Chain por su hash y devuelve todo lo que
   se puede comprobar: si existe, si fue exitosa, de qué wallet salió, a cuál
   llegó, cuánto se envió (BNB o token, con símbolo y logo), en qué bloque, cuántas
   confirmaciones tiene, el gas gastado y la fecha. Datos 100% reales del RPC. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';

const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io', 'https://bsc.publicnode.com'];
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }

export function esHash(s) { return /^0x[0-9a-fA-F]{64}$/.test((s || '').trim()); }

const ABI_ERC = ['function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function name() view returns (string)'];

/* Verifica una transacción por su hash. */
export async function verificar(hash) {
  if (!esHash(hash)) throw new Error('invalid hash');
  const prov = lector();
  const [tx, receipt, bloqueActual] = await Promise.all([
    prov.getTransaction(hash),
    prov.getTransactionReceipt(hash),
    prov.getBlockNumber()
  ]);
  if (!tx) return { existe: false };

  // precio del gas efectivo y comisión pagada
  const gasPrice = receipt && receipt.gasPrice ? receipt.gasPrice : (tx.gasPrice || 0n);
  const gasUsado = receipt ? receipt.gasUsed : 0n;
  const comisionBNB = Number(ethers.formatEther(gasUsado * gasPrice));
  const gweiPrecio = Number(ethers.formatUnits(gasPrice, 'gwei'));

  // tipo de transacción según el input y el destino
  const input = tx.data || tx.input || '0x';
  const selector = (input && input.length >= 10) ? input.slice(0, 10) : '';
  const METODOS = {
    '0xa9059cbb': 'Token transfer', '0x095ea7b3': 'Token approval', '0x23b872dd': 'Token transfer (from)',
    '0x38ed1739': 'Swap (tokens for tokens)', '0x7ff36ab5': 'Swap (BNB for tokens)', '0x18cbafe5': 'Swap (tokens for BNB)',
    '0x5c11d795': 'Swap (fee-supporting)', '0xfb3bdb41': 'Swap (BNB for exact tokens)', '0x8803dbee': 'Swap (tokens for exact tokens)',
    '0xe8e33700': 'Add liquidity', '0xf305d719': 'Add liquidity (BNB)', '0xbaa2abde': 'Remove liquidity',
    '0xd0e30db0': 'Deposit (wrap)', '0x2e1a7d4d': 'Withdraw (unwrap)', '0x': 'BNB transfer'
  };
  let tipoTx = 'Contract interaction';
  if (!selector || selector === '0x' || input === '0x') tipoTx = (Number(ethers.formatEther(tx.value || 0n)) > 0) ? 'BNB transfer' : 'Contract call';
  else if (METODOS[selector]) tipoTx = METODOS[selector];

  const out = {
    existe: true,
    hash: hash,
    exitosa: receipt ? receipt.status === 1 : null,
    pendiente: !receipt,
    de: tx.from,
    para: tx.to,
    bloque: receipt ? receipt.blockNumber : null,
    confirmaciones: receipt ? (bloqueActual - receipt.blockNumber + 1) : 0,
    valorBNB: Number(ethers.formatEther(tx.value || 0n)),
    gasUsado: gasUsado.toString(),
    gasLimit: tx.gasLimit ? tx.gasLimit.toString() : null,
    gweiPrecio: gweiPrecio,
    comisionBNB: comisionBNB,
    comisionUSD: 0,
    nonce: tx.nonce != null ? tx.nonce : null,
    posicion: receipt && receipt.index != null ? receipt.index : (receipt && receipt.transactionIndex != null ? receipt.transactionIndex : null),
    tipoTx: tipoTx,
    selector: selector,
    numEventos: receipt && receipt.logs ? receipt.logs.length : 0,
    ts: 0,
    transferencias: []
  };

  // fecha del bloque
  if (receipt) {
    try { const b = await prov.getBlock(receipt.blockNumber); if (b) out.ts = b.timestamp * 1000; } catch (_) {}
  }

  // ¿movió BNB nativo?
  if (out.valorBNB > 0) {
    out.transferencias.push({ tipo: 'BNB', de: tx.from, para: tx.to, cantidad: out.valorBNB, symbol: 'BNB', logo: 'https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png', decimals: 18 });
  }

  // ¿movió tokens? leer los eventos Transfer del receipt
  if (receipt && receipt.logs) {
    const tokensVistos = {};
    for (const log of receipt.logs) {
      if (log.topics && log.topics[0] === TRANSFER_TOPIC && log.topics.length >= 3) {
        const token = (log.address || '').toLowerCase();
        const de = '0x' + log.topics[1].slice(26);
        const para = '0x' + log.topics[2].slice(26);
        let cantidad = 0n;
        try { cantidad = BigInt(log.data); } catch (_) {}
        // leer metadata del token (una vez por token)
        if (!tokensVistos[token]) {
          tokensVistos[token] = { symbol: '?', decimals: 18 };
          try {
            const c = new ethers.Contract(token, ABI_ERC, prov);
            const [sym, dec] = await Promise.all([c.symbol().catch(() => '?'), c.decimals().catch(() => 18)]);
            tokensVistos[token] = { symbol: String(sym), decimals: Number(dec) };
          } catch (_) {}
        }
        const meta = tokensVistos[token];
        let cs = token; try { cs = ethers.getAddress(token); } catch (_) {}
        out.transferencias.push({
          tipo: 'token', token: token, de: de, para: para,
          cantidad: Number(ethers.formatUnits(cantidad, meta.decimals)),
          symbol: meta.symbol, decimals: meta.decimals,
          logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/' + cs + '/logo.png'
        });
      }
    }
  }

  // precio USD de las transferencias (DeFiLlama)
  try {
    const ids = out.transferencias.map(function (t) { return t.tipo === 'BNB' ? ('bsc:' + WBNB) : ('bsc:' + t.token); });
    ids.push('bsc:' + WBNB);  // siempre, para la comisión
    if (ids.length) {
      const pr = await fetch('https://coins.llama.fi/prices/current/' + [...new Set(ids)].join(','));
      const pd = await pr.json(); const coins = pd.coins || {};
      for (const t of out.transferencias) {
        const k = t.tipo === 'BNB' ? ('bsc:' + WBNB) : ('bsc:' + t.token);
        if (coins[k] && coins[k].price) t.usd = t.cantidad * coins[k].price;
      }
      // comisión en USD con el precio de BNB
      const pB = coins['bsc:' + WBNB]; if (pB && pB.price) out.comisionUSD = out.comisionBNB * pB.price;
    }
  } catch (_) {}

  return out;
}
