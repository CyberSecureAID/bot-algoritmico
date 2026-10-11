// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Rejilla, Nivel, IERC20, SafeT} from "./GBComun.sol";
import {SwapLib} from "./SwapLib.sol";

/*═══════════════════════════════════════════════════════════════════════
  DcaLib — DCA inteligente (librería externa, delegatecall).
  ───────────────────────────────────────────────────────────────────────
  El DCA actual solo compraba UNA vez al abrir (no había compra programada
  on-chain). Aquí se completa:
   · compra PROGRAMADA (keeper): respeta el intervalo y el tope de compras,
     y PROMEDIA de verdad (acumula C y Q).
   · take-profit OPCIONAL (el usuario lo activa con objetivoBps>0): vende
     TODA la posición SOLO si el PROMEDIO está en +obj. El piso C*(1+obj)
     evalúa el promedio por construcción => NUNCA vende por las compras
     recientes si en promedio aún se pierde. Tras vender, el capital queda
     en la wallet para seguir comprando los días programados.
  No custodial. Sin oráculo.

  Campos de Rejilla usados: posicionBase=Q, costeQuote=C, ordenQuote=gasto por
  compra, objetivoBps=take-profit% (0=desactivado), intervalo, comprasMax,
  ultimaOpEn, slippageBps.
═══════════════════════════════════════════════════════════════════════*/
library DcaLib {
    using SwapLib for SwapLib.Dex[];
    using SafeT for address;

    uint256 constant BPS = 10000;

    event DcaCompra(address indexed u, uint256 gasto, uint256 recibido, uint32 compra);
    event DcaTomaGanancia(address indexed u, uint256 recaudado, uint256 ganancia);

    error Cfg(); error Pronto(); error Lleno(); error NoTP(); error Vacio();

    function _min(SwapLib.Dex[] storage dexes, uint256 pref, address tin, address tout, uint24 fee, uint256 amt, uint16 slip) internal returns (uint256) {
        uint256 q = dexes.cotiza(pref, tin, tout, fee, amt);
        return q==0 ? 0 : q*(BPS-slip)/BPS;
    }

    /* COMPRA PROGRAMADA (keeper): respeta intervalo y tope; promedia (C,Q). */
    function comprar(
        Rejilla storage r, SwapLib.Dex[] storage dexes, uint256 dexPref, address u
    ) external {
        if (r.modo != 3) revert Cfg();
        if (block.timestamp < uint256(r.ultimaOpEn) + r.intervalo) revert Pronto();
        if (r.comprasMax>0 && r.comprasHechas >= r.comprasMax) revert Lleno();
        uint256 d = r.ordenQuote;
        uint256 mo = _min(dexes,dexPref,r.quote,r.base,r.feeTier,d,r.slippageBps);
        r.quote.safeTransferFrom(u, address(this), d);
        uint256 got = dexes.swapUno(dexPref, r.quote, r.base, r.feeTier, u, d, mo);
        r.posicionBase += got; r.costeQuote += d; r.volumenQuote += d;
        r.comprasHechas += 1; r.ultimaOpEn = uint64(block.timestamp);
        emit DcaCompra(u, d, got, r.comprasHechas);
    }

    /* TAKE-PROFIT OPCIONAL (keeper): vende TODO solo si el PROMEDIO está en +obj.
       piso = C*(1+obj) sobre TODO lo acumulado => salvaguarda del promedio. */
    function resolver(
        Rejilla storage r, SwapLib.Dex[] storage dexes, uint256 dexPref, address u
    ) external {
        if (r.objetivoBps == 0) revert NoTP();       // take-profit desactivado por el usuario
        if (r.posicionBase == 0) revert Vacio();
        uint256 piso = r.costeQuote * (BPS + r.objetivoBps) / BPS;
        r.base.safeTransferFrom(u, address(this), r.posicionBase);
        uint256 W = dexes.swapUno(dexPref, r.base, r.quote, r.feeTier, u, r.posicionBase, piso); // revierte si < piso
        emit DcaTomaGanancia(u, W, W>r.costeQuote ? W-r.costeQuote : 0);
        r.posicionBase = 0; r.costeQuote = 0;         // reinicia; W queda en la wallet para seguir comprando
        r.ventasHechas += 1; r.ciclos += 1; r.ultimaOpEn = uint64(block.timestamp);
    }
}
