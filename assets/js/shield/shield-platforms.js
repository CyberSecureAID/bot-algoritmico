/* shield-platforms.js — Directorio de plataformas conocidas de BNB Smart Chain.
   Cruza los spenders (contratos con permiso) de una wallet contra una lista de
   protocolos famosos y verificados, para mostrar "te conectaste a estas
   plataformas" marcando cuáles son conocidas/seguras y cuáles desconocidas.
   NUESTROS propios contratos SIEMPRE se marcan como seguros (nunca peligrosos). */

// Nuestros contratos (Cripto Cuba) — SIEMPRE confiables.
const NUESTROS = {
  '0x4e86430bc2260fe359d1ea7eef8b595fb241f93b': 'Cripto Cuba · Bots & Swap',
  '0x39c48394068299aa3e3ab114f16bfc3de11f4112': 'Cripto Cuba · Token Listing',
  '0x17b47a8fb97f8980b96c94e4b9137182e0bf8025': 'Cripto Cuba · P2P Market',
  '0xdc4802d8871cef57a34e4e0e3b1a87226a4a84c4': 'Cripto Cuba · Staking'
};

// Protocolos famosos y verificados de BSC (routers y contratos principales).
const PLATAFORMAS = {
  // PancakeSwap (el mayor DEX de BSC)
  '0x10ed43c718714eb63d5aa57b78b54704e256024e': { nombre: 'PancakeSwap', tipo: 'DEX · Swap', seguro: true },
  '0x05ff2b0db69458a0750badebc4f9e13add608c7f': { nombre: 'PancakeSwap', tipo: 'DEX · Swap (V1)', seguro: true },
  '0x13f4ea83d0bd40e75c8222255bc855a974568dd4': { nombre: 'PancakeSwap', tipo: 'DEX · Smart Router V3', seguro: true },
  '0x1b81d678ffb9c0263b24a97847620c99d213eb14': { nombre: 'PancakeSwap', tipo: 'DEX · Router V3', seguro: true },
  '0xd9c500dff816a1da21a48a732d3498bf09dc9aeb': { nombre: 'PancakeSwap', tipo: 'DEX · Wallet', seguro: true },
  '0x46a15b0b27311cedf172ab29e4f4766fbe7f4364': { nombre: 'PancakeSwap', tipo: 'DEX · Position Manager', seguro: true },
  '0xec4b9d1fd8a3534e31fce1636c7479bcd29213e4': { nombre: 'PancakeSwap', tipo: 'DEX · Universal Router', seguro: true },
  // Venus (lending)
  '0xfd36e2c2a6789db23113685031d7f16329158384': { nombre: 'Venus', tipo: 'Lending · Comptroller', seguro: true },
  '0xa07c5b74c9b40447a954e1466938b865b6bbea36': { nombre: 'Venus', tipo: 'Lending · vBNB', seguro: true },
  // Biswap
  '0x3a6d8ca21d1cf76f653a67577fa0d27453350dd8': { nombre: 'Biswap', tipo: 'DEX · Router', seguro: true },
  // ApeSwap
  '0xc0788a3ad43d79aa53b09c2eacc313a787d1d607': { nombre: 'ApeSwap', tipo: 'DEX · Router', seguro: true },
  // 1inch
  '0x1111111254eeb25477b68fb85ed929f73a960582': { nombre: '1inch', tipo: 'DEX Aggregator', seguro: true },
  '0x111111125421ca6dc452d289314280a0f8842a65': { nombre: '1inch', tipo: 'DEX Aggregator (V6)', seguro: true },
  // 0x / Matcha
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': { nombre: '0x Protocol', tipo: 'DEX Aggregator', seguro: true },
  // Uniswap on BSC
  '0xb971ef87ede563556b2ed4b1c0b0019111dd85d2': { nombre: 'Uniswap', tipo: 'DEX · Router V3', seguro: true },
  // THENA
  '0xd4ae6eca985340dd434d38f470accce4dc78d109': { nombre: 'THENA', tipo: 'DEX · Router', seguro: true },
  // Wombat
  '0x489833311676b566f888119c29bd997dc6c95830': { nombre: 'Wombat', tipo: 'Stableswap', seguro: true },
  // Alpaca
  '0xa625ab01b08ce023b2a342dbb12a16f2c8489a8f': { nombre: 'Alpaca Finance', tipo: 'Leveraged Yield', seguro: true },
  // Radiant
  '0xd50cf00b6e600dd036ba8ef475677d816d6c4281': { nombre: 'Radiant Capital', tipo: 'Lending', seguro: true },
  // Tokens comunes que a veces reciben approve (stablecoins/wrapped) — no son dApps pero se reconocen
  '0x55d398326f99059ff775485246999027b3197955': { nombre: 'Tether (USDT)', tipo: 'Stablecoin', seguro: true },
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': { nombre: 'USD Coin (USDC)', tipo: 'Stablecoin', seguro: true }
};

/* Analiza los spenders (permisos) y devuelve las plataformas a las que se conectó. */
export function plataformasDe(permisos) {
  const vistas = new Map();
  for (const p of (permisos || [])) {
    const sp = (p.spender || '').toLowerCase();
    if (!sp) continue;
    if (vistas.has(sp)) continue;
    if (NUESTROS[sp]) {
      vistas.set(sp, { addr: sp, nombre: NUESTROS[sp], tipo: 'Our platform', estado: 'nuestro' });
    } else if (PLATAFORMAS[sp]) {
      const pl = PLATAFORMAS[sp];
      vistas.set(sp, { addr: sp, nombre: pl.nombre, tipo: pl.tipo, estado: 'conocido' });
    } else {
      vistas.set(sp, { addr: sp, nombre: null, tipo: 'Unrecognised contract', estado: 'desconocido' });
    }
  }
  const lista = [...vistas.values()];
  // ordenar: nuestros primero, luego conocidos, luego desconocidos
  const orden = { nuestro: 0, conocido: 1, desconocido: 2 };
  lista.sort(function (a, b) { return orden[a.estado] - orden[b.estado]; });
  return {
    plataformas: lista,
    conocidas: lista.filter(function (x) { return x.estado === 'conocido'; }).length,
    nuestras: lista.filter(function (x) { return x.estado === 'nuestro'; }).length,
    desconocidas: lista.filter(function (x) { return x.estado === 'desconocido'; }).length
  };
}
