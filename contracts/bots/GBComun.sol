// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/*═══════════════════════════════════════════════════════════════════════
  GBComun — tipos, interfaces y utilidades compartidas por el contrato
  principal (GridBotV13) y las librerias externas de logica de bots.
  ───────────────────────────────────────────────────────────────────────
  OJO DE ORO: el struct Rejilla define el ORDEN DEL ALMACENAMIENTO de cada
  bot dentro del mapping del contrato principal. Los campos EXISTENTES van
  en el MISMO orden que el V13 desplegado. Los campos NUEVOS van SIEMPRE AL
  FINAL, nunca intercalados, para no corromper los bots ni los saldos.
═══════════════════════════════════════════════════════════════════════*/

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address,uint256) external returns (bool);
    function transferFrom(address,address,uint256) external returns (bool);
    function approve(address,uint256) external returns (bool);
    function allowance(address,address) external view returns (uint256);
}
interface IWBNB { function deposit() external payable; function withdraw(uint256) external; }
interface IStakingBot { function depositarRecompensa(address,uint256,uint16) external; }
interface ITarifasBot { function esAdmin(address) external view returns (bool); }
interface IOraculoBot { function precioUSD(address) external view returns (uint256); }
interface IContabilidadGB { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; }

library SafeT {
    function _c(address t, bytes memory d) private { (bool ok, bytes memory r)=t.call(d); require(ok && (r.length==0||abi.decode(r,(bool)))); }
    function safeTransfer(address t,address to,uint256 v) internal { _c(t,abi.encodeWithSelector(IERC20.transfer.selector,to,v)); }
    function safeTransferFrom(address t,address f,address to,uint256 v) internal { _c(t,abi.encodeWithSelector(IERC20.transferFrom.selector,f,to,v)); }
}

/* ---- Estructuras de bot ---- */
struct Nivel { uint128 minOutCompra; uint128 minOutVenta; uint8 estado; }

struct ConfigIn {
    address base; address quote; uint256 ordenQuote; uint256 ordenBase;
    Nivel[] niveles; uint16 slippageBps; uint32 cooldownSeg;
    uint128 tpUnitOut; uint128 slUnitOut; uint24 feeTier;
    uint8 modo; uint16 objetivoBps; uint16 factorBps; uint256 compraInicialQuote;
    uint16 margenBps; uint256 botId; uint256 intervalo; uint32 comprasMax;
}

struct Rejilla {
    // ── Campos EXISTENTES (orden EXACTO del V13 desplegado, NO TOCAR) ──
    address   base;
    address   quote;
    address[] pathCompra;
    address[] pathVenta;
    uint256   ordenQuote;
    uint256   ordenBase;
    uint256   posicionBase;
    uint256   costeQuote;
    uint256   volumenQuote;
    int256    gananciaQuote;
    uint256   gasGastadoWei;
    uint128   tpUnitOut;
    uint128   slUnitOut;
    uint64    creadaEn;
    uint64    ultimaOpEn;
    uint32    comprasHechas;
    uint32    ventasHechas;
    uint32    ciclos;
    uint32    cooldownSeg;
    uint16    slippageBps;
    bool      activa;
    Nivel[]   niveles;
    uint24    feeTier;
    uint8     modo;
    uint16    objetivoBps;
    uint16    factorBps;
    uint16    margenBps;
    uint256   intervalo;
    uint32    comprasMax;
    bool      pausadaPago;        // V11
    // ── Campos NUEVOS (V13.1), SIEMPRE al final, nunca intercalados ──
    uint256   polvora;            // Cash Out: USDT de reserva (contabilidad). El capital vive en la wallet del usuario.
    uint16    pasoBps;            // Cash Out: separacion entre niveles de la escalera.
}

struct TokenInfo { bool activo; string simbolo; }
