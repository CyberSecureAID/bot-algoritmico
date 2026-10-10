// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Rejilla, Nivel, IERC20, SafeT} from "./GBComun.sol";
import {SwapLib} from "./SwapLib.sol";

/*═══════════════════════════════════════════════════════════════════════
  CashOutLib — Cash Out Avanzado (librería externa, delegatecall).
  ───────────────────────────────────────────────────────────────────────
  Lógica probada en el núcleo (29/29). Aquí opera sobre el almacenamiento
  real del GridBot (struct Rejilla) y usa SwapLib como motor de swap.
  NO CUSTODIAL: el capital vive en la wallet del usuario; el contrato solo
  jala lo justo para cada operación y el swap entrega de vuelta a la wallet.

  Campos de Rejilla usados:
    posicionBase = Q (moneda)   costeQuote = C (costo quote)
    polvora      = D (reserva)  ordenQuote = gasto por nivel (fijo al montar)
    objetivoBps  = % objetivo    pasoBps    = separacion de niveles
    niveles      = escalera de compra (minOutCompra + estado)
  Decimal-agnostico: todo en cantidades, sin oraculo.
═══════════════════════════════════════════════════════════════════════*/
library CashOutLib {
    using SwapLib for SwapLib.Dex[];
    using SafeT for address;

    uint256 constant BPS = 10000;

    event CashOutAbierto(address indexed u, address base, address quote, uint256 posicion, uint256 polvora);
    event CashOutCompra(address indexed u, uint32 nivel, uint256 gastoQuote, uint256 baseRecibida);
    event CashOutResuelto(address indexed u, uint256 recaudado, uint256 ganancia, uint32 vuelta);

    error Cfg(); error Polvora(); error Vacio();

    // Parametros de apertura empacados (evita "stack too deep" sin viaIR).
    struct Abrir { address base; address quote; uint24 feeTier; uint256 montoBase; uint16 obj; uint16 paso; uint32 n; uint16 slip; }

    /* Calcula un minOut con proteccion de slippage: cotiza en el DEX y descuenta
       slip bps. Si el quoter no responde (0), devuelve 0 (sin proteccion, no bloquea).
       Protege los swaps grandes (apertura con cientos de miles) contra sandwich/MEV. */
    function _min(SwapLib.Dex[] storage dexes, uint256 pref, address tin, address tout, uint24 fee, uint256 amt, uint16 slip) internal returns (uint256) {
        uint256 q = dexes.cotiza(pref, tin, tout, fee, amt);
        return q==0 ? 0 : q*(BPS-slip)/BPS;
    }

    /* Reconstruye la escalera desde el estado actual (Q,C,polvora,N,paso).
       trigger_k = (C/Q)*(1 - (k+1)*paso/BPS); min base por gastar dPorNivel:
       dPorNivel*Q*BPS / (C*(BPS-(k+1)*paso)) */
    function _armar(Rejilla storage r) internal {
        uint32 n = uint32(r.niveles.length);
        uint256 dPorNivel = r.polvora / n;
        r.ordenQuote = dPorNivel;
        uint256 Q = r.posicionBase; uint256 C = r.costeQuote; uint16 paso = r.pasoBps;
        for (uint32 k=0;k<n;k++){
            uint256 fuera = uint256(paso)*(k+1);
            if (fuera >= BPS || dPorNivel==0 || C==0) { r.niveles[k] = Nivel(0,0,0); continue; }
            uint256 m = (dPorNivel * Q * BPS) / (C * (BPS - fuera));
            r.niveles[k] = Nivel(uint128(m), 0, 1);
        }
    }

    /* ABRIR: vende 50% de la moneda -> quote (polvora); 50% queda como posicion. */
    function abrir(
        Rejilla storage r, SwapLib.Dex[] storage dexes, uint256 dexPref, address u, Abrir memory p
    ) external {
        if (!(p.n>0 && p.paso>0 && uint256(p.paso)*p.n < BPS && p.montoBase>1)) revert Cfg();
        r.base=p.base; r.quote=p.quote; r.feeTier=p.feeTier; r.modo=2;
        r.objetivoBps=p.obj; r.pasoBps=p.paso; r.slippageBps=p.slip;
        uint256 mitad = p.montoBase/2;
        // jalar la mitad a vender y venderla; el swap entrega el quote a la wallet (u)
        uint256 mo = _min(dexes,dexPref,p.base,p.quote,p.feeTier,mitad,p.slip); // minOut calculado antes (libera pila)
        p.base.safeTransferFrom(u, address(this), mitad);
        uint256 d = dexes.swapUno(dexPref, p.base, p.quote, p.feeTier, u, mitad, mo);
        r.polvora = d;
        r.posicionBase = p.montoBase - mitad;   // la otra mitad sigue en la wallet del usuario
        r.costeQuote = d;
        // armar escalera: N niveles
        delete r.niveles;
        for (uint32 k=0;k<p.n;k++) r.niveles.push(Nivel(0,0,0));
        _armar(r);
        r.activa = true; r.creadaEn = uint64(block.timestamp);
        emit CashOutAbierto(u, p.base, p.quote, r.posicionBase, d);
    }

    /* COMPRAR NIVEL (keeper): gasta ordenQuote de quote -> base al trigger del nivel k. */
    function comprarNivel(
        Rejilla storage r, SwapLib.Dex[] storage dexes, uint256 dexPref, address u, uint32 k
    ) external {
        if (!(k<r.niveles.length && r.niveles[k].estado==1)) revert Cfg();
        uint256 d = r.ordenQuote;
        if (!(d>0 && r.polvora>=d)) revert Polvora();
        r.niveles[k].estado = 0;
        r.quote.safeTransferFrom(u, address(this), d);
        uint256 got = dexes.swapUno(dexPref, r.quote, r.base, r.feeTier, u, d, r.niveles[k].minOutCompra);
        r.posicionBase += got; r.costeQuote += d; r.polvora -= d;
        r.comprasHechas += 1; r.ultimaOpEn = uint64(block.timestamp);
        emit CashOutCompra(u, k, d, got);
    }

    /* RESOLVER (keeper): vende TODA la posicion con piso C*(1+obj); re-monta 50/50.
       El re-montaje va en su propia funcion para no caer en "stack too deep" sin viaIR. */
    function resolver(
        Rejilla storage r, SwapLib.Dex[] storage dexes, uint256 dexPref, address u
    ) external {
        if (r.posicionBase==0) revert Vacio();
        uint256 piso = r.costeQuote * (BPS + r.objetivoBps) / BPS;
        r.base.safeTransferFrom(u, address(this), r.posicionBase);
        uint256 W = dexes.swapUno(dexPref, r.base, r.quote, r.feeTier, u, r.posicionBase, piso); // recaudado; revierte si < piso
        emit CashOutResuelto(u, W, W>r.costeQuote ? W-r.costeQuote : 0, r.ciclos);
        r.ventasHechas += 1;
        _remontar(r, dexes, dexPref, u, W + r.polvora);   // re-monta con TODO el capital (recaudado + polvora)
    }

    /* Re-montaje 50/50 (frame propio): mitad polvora, mitad posicion (comprada con
       proteccion de slippage); reconstruye la escalera sin huecos. */
    function _remontar(Rejilla storage r, SwapLib.Dex[] storage dexes, uint256 dexPref, address u, uint256 W) internal {
        uint256 wPos = W/2;
        r.polvora = W - wPos;
        uint256 mo = _min(dexes,dexPref,r.quote,r.base,r.feeTier,wPos,r.slippageBps); // minOut calculado antes (libera pila)
        r.quote.safeTransferFrom(u, address(this), wPos);
        r.posicionBase = dexes.swapUno(dexPref, r.quote, r.base, r.feeTier, u, wPos, mo);
        r.costeQuote = wPos;
        r.ciclos += 1; r.ultimaOpEn = uint64(block.timestamp);
        _armar(r);
    }
}
