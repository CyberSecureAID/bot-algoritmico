// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/* ─────────────────────────────────────────────────────────────────────────
   VerificadorFTtestnet.sol  ·  SOLO TESTNET  ·  NO DESPLEGAR EN MAINNET

   Sirve para probar FeatureTokens de punta a punta en BSC testnet sin el
   Launchpad, el Mercado y el Oraculo reales (que viven en mainnet). Hace de
   los tres a la vez para el test:

     · info(token)            -> como el Launchpad: dice quien es el creador.
     · listadosDeToken(token) -> como el Mercado: vacio (no hace falta para el test).
     · precioUSD(address(0))  -> como el Oraculo: USD por 1 BNB (lo fijas tu).

   USO EN TESTNET:
     1) Despliega este contrato.
     2) setBnbUSD(600e18)  (o el precio que quieras simular).
     3) marcarCreador(tuTokenDePrueba, tuWallet)  (te hace "dueño" de ese token).
     4) En FeatureTokens (testnet): setLaunchpad(este), setMercado(este), setOraculo(este).
     5) Reserva con tu wallet y tu token de prueba. Ya puedes probar todo el flujo
        con BNB de testnet: reservar, renovar, exceso, expiracion, pausa, etc.

   En MAINNET NO se usa: ahi FeatureTokens apunta al Launchpad, Mercado y Oraculo reales.
   ───────────────────────────────────────────────────────────────────────── */
contract VerificadorFTtestnet {
    mapping(address => address) public creadorDe;
    uint256 public bnbUSD;   // USD por 1 BNB, 18 dec (1e18 = $1)

    function marcarCreador(address token, address creador) external { creadorDe[token] = creador; }
    function setBnbUSD(uint256 p) external { bnbUSD = p; }

    // Interfaz Launchpad
    function info(address token) external view returns (address creador, uint16 sueloBps, bool antibot, uint64 creadoEn) {
        return (creadorDe[token], 0, false, 0);
    }
    // Interfaz Mercado (vacia: en el test, la propiedad va por el camino "creado")
    function listadosDeToken(address) external pure returns (uint256[] memory a) { return a; }

    // Interfaz Oraculo
    function precioUSD(address) external view returns (uint256) { return bnbUSD; }
}
