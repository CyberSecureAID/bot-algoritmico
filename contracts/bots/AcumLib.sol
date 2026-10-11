// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Rejilla, Nivel, IERC20, SafeT} from "./GBComun.sol";
import {SwapLib} from "./SwapLib.sol";

/*═══════════════════════════════════════════════════════════════════════
  AcumLib — Acumulador (librería externa, delegatecall).
  ───────────────────────────────────────────────────────────────────────
  Espejo de CashOutLib, con 3 diferencias:
   · ABRE comprando (quote -> base) una fracción inicial (iniBps); el resto
     queda como pólvora para recomprar más abajo.
   · Compra PROGRESIVA: mientras más baja el precio, más volumen por nivel
     (peso_k = BPS + factor*k; k=0 el trigger más cercano, k=n-1 el más hondo).
   · RE-DESPLIEGA con iniBps (no 50/50) tras vender todo en ganancia.
  Take-profit DINÁMICO: vende TODA la posición solo si recaudado ≥ C*(1+obj),
  o sea a promedio*(1+obj). Como el promedio (C/Q) baja con cada recompra, el
  punto de salida se mueve solo. NUNCA vende a pérdida. Sin oráculo.

  Campos de Rejilla usados:
    posicionBase=Q  costeQuote=C  polvora=D(reserva quote)
    objetivoBps=obj  pasoBps=paso(escalón)  factorBps=factor(progresivo)
    margenBps=iniBps(fracción inicial)  niveles=escalera
    niveles[k].minOutCompra = mínimo base al gastar dk  ·  minOutVenta = dk (gasto del nivel)
═══════════════════════════════════════════════════════════════════════*/
library AcumLib {
    using SwapLib for SwapLib.Dex[];
    using SafeT for address;

    uint256 constant BPS = 10000;

    event AcumAbierto(address indexed u, address base, address quote, uint256 posicion, uint256 polvora);
    event AcumCompra(address indexed u, uint32 nivel, uint256 gastoQuote, uint256 baseRecibida);
    event AcumResuelto(address indexed u, uint256 recaudado, uint256 ganancia, uint32 vuelta);

    error Cfg(); error Polvora(); error Vacio();

    // Parámetros de apertura empacados (evita "stack too deep" sin viaIR).
    struct Abrir { address base; address quote; uint24 feeTier; uint256 montoQuote; uint16 obj; uint16 paso; uint32 n; uint16 factor; uint16 iniBps; uint16 slip; }

    /* minOut con protección de slippage: cotiza y descuenta slip bps. 0 si el quoter no responde. */
    function _min(SwapLib.Dex[] storage dexes, uint256 pref, address tin, address tout, uint24 fee, uint256 amt, uint16 slip) internal returns (uint256) {
        uint256 q = dexes.cotiza(pref, tin, tout, fee, amt);
        return q==0 ? 0 : q*(BPS-slip)/BPS;
    }

    /* Arma la escalera PROGRESIVA desde el estado (Q,C,D,n,paso,factor).
       dk = D*(BPS+factor*k)/sumPesos ;  sumPesos = n*BPS + factor*n*(n-1)/2 (forma cerrada).
       minOutCompra_k = dk*Q*BPS / (C*(BPS-(k+1)*paso)). dk se guarda en minOutVenta. */
    function _armarProg(Rejilla storage r) internal {
        uint256 n = r.niveles.length;
        uint256 Q = r.posicionBase; uint256 C = r.costeQuote;
        uint256 factor = r.factorBps;
        uint256 sumW = n*BPS + factor*(n*(n-1))/2;
        for (uint32 k=0;k<n;k++){
            uint256 fuera = uint256(r.pasoBps)*(k+1);
            if (fuera>=BPS || C==0 || r.polvora==0 || sumW==0) { r.niveles[k] = Nivel(0,0,0); continue; }
            uint256 dk = r.polvora*(BPS + factor*k)/sumW;
            uint256 m = dk*Q*BPS/(C*(BPS - fuera));
            r.niveles[k] = Nivel(uint128(m), uint128(dk), 1);
        }
    }

    /* ABRIR: compra iniBps% a mercado (posición); el resto queda como pólvora; arma escalera. */
    function abrir(
        Rejilla storage r, SwapLib.Dex[] storage dexes, uint256 dexPref, address u, Abrir memory p
    ) external {
        if (!(p.n>0 && p.paso>0 && uint256(p.paso)*p.n < BPS && p.iniBps>0 && p.iniBps<BPS && p.montoQuote>1)) revert Cfg();
        r.base=p.base; r.quote=p.quote; r.feeTier=p.feeTier; r.modo=1;
        r.objetivoBps=p.obj; r.pasoBps=p.paso; r.factorBps=p.factor; r.margenBps=p.iniBps; r.slippageBps=p.slip;
        uint256 ini = p.montoQuote * p.iniBps / BPS;
        uint256 mo = _min(dexes,dexPref,p.quote,p.base,p.feeTier,ini,p.slip);
        p.quote.safeTransferFrom(u, address(this), ini);
        r.posicionBase = dexes.swapUno(dexPref, p.quote, p.base, p.feeTier, u, ini, mo);
        r.costeQuote = ini;
        r.polvora = p.montoQuote - ini;
        delete r.niveles;
        for (uint32 k=0;k<p.n;k++) r.niveles.push(Nivel(0,0,0));
        _armarProg(r);
        r.activa = true; r.creadaEn = uint64(block.timestamp);
        emit AcumAbierto(u, p.base, p.quote, r.posicionBase, r.polvora);
    }

    /* COMPRAR NIVEL (keeper): gasta dk (progresivo, guardado en minOutVenta) quote -> base. */
    function comprarNivel(
        Rejilla storage r, SwapLib.Dex[] storage dexes, uint256 dexPref, address u, uint32 k
    ) external {
        if (!(k<r.niveles.length && r.niveles[k].estado==1)) revert Cfg();
        uint256 d = r.niveles[k].minOutVenta;
        if (!(d>0 && r.polvora>=d)) revert Polvora();
        r.niveles[k].estado = 0;
        r.quote.safeTransferFrom(u, address(this), d);
        uint256 got = dexes.swapUno(dexPref, r.quote, r.base, r.feeTier, u, d, r.niveles[k].minOutCompra);
        r.posicionBase += got; r.costeQuote += d; r.polvora -= d;
        r.comprasHechas += 1; r.ultimaOpEn = uint64(block.timestamp);
        emit AcumCompra(u, k, d, got);
    }

    /* RESOLVER (keeper): vende TODA la posición con piso C*(1+obj) (promedio+obj); re-despliega. */
    function resolver(
        Rejilla storage r, SwapLib.Dex[] storage dexes, uint256 dexPref, address u
    ) external {
        if (r.posicionBase==0) revert Vacio();
        uint256 piso = r.costeQuote * (BPS + r.objetivoBps) / BPS;
        r.base.safeTransferFrom(u, address(this), r.posicionBase);
        uint256 W = dexes.swapUno(dexPref, r.base, r.quote, r.feeTier, u, r.posicionBase, piso); // revierte si < piso
        emit AcumResuelto(u, W, W>r.costeQuote ? W-r.costeQuote : 0, r.ciclos);
        r.ventasHechas += 1;
        _redesplegar(r, dexes, dexPref, u, W + r.polvora);   // re-despliega con TODO el capital
    }

    /* Re-despliegue (frame propio): compra iniBps% a mercado, resto a pólvora, re-arma escalera. */
    function _redesplegar(Rejilla storage r, SwapLib.Dex[] storage dexes, uint256 dexPref, address u, uint256 W) internal {
        uint256 ini = W * r.margenBps / BPS;
        uint256 mo = _min(dexes,dexPref,r.quote,r.base,r.feeTier,ini,r.slippageBps);
        r.quote.safeTransferFrom(u, address(this), ini);
        r.posicionBase = dexes.swapUno(dexPref, r.quote, r.base, r.feeTier, u, ini, mo);
        r.costeQuote = ini;
        r.polvora = W - ini;
        r.ciclos += 1; r.ultimaOpEn = uint64(block.timestamp);
        _armarProg(r);
    }
}
