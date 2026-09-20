// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/* ═══════════════════════════════════════════════════════════════════════
   SwapLib — motor de swap con FALLBACK MULTI-DEX automático.
   ═══════════════════════════════════════════════════════════════════════
   Se despliega como librería EXTERNA (no cuenta para el límite de 24KB del
   contrato principal). Intenta el swap en el DEX preferido; si falla, prueba
   el siguiente, todo en la MISMA transacción del usuario. Sin keeper, sin
   espera. Cada DEX expone el router V3 (exactInputSingle) y quoter V3.
   ═══════════════════════════════════════════════════════════════════════ */

interface IERC20L { function balanceOf(address) external view returns (uint256); function approve(address,uint256) external returns (bool); }

interface IV3Router {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee; address recipient;
        uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata p) external payable returns (uint256);
}
interface IV3Quoter {
    struct QuoteExactInputSingleParams { address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96; }
    function quoteExactInputSingle(QuoteExactInputSingleParams memory p) external returns (uint256 amountOut, uint160, uint32, uint256);
}

library SwapLib {
    struct Dex { address router; address quoter; string nombre; bool activo; uint32 fallos; uint40 ultimoUso; }

    /** Cotiza en el DEX i. Devuelve 0 si falla (para poder comparar/saltar). */
    function cotizar(Dex[] storage dexes, uint256 i, address tin, address tout, uint24 fee, uint256 amt) public returns (uint256 out) {
        if (i >= dexes.length || !dexes[i].activo) return 0;
        try IV3Quoter(dexes[i].quoter).quoteExactInputSingle(
            IV3Quoter.QuoteExactInputSingleParams({ tokenIn: tin, tokenOut: tout, amountIn: amt, fee: fee, sqrtPriceLimitX96: 0 })
        ) returns (uint256 o, uint160, uint32, uint256) { return o; } catch { return 0; }
    }

    /** Cotiza empezando por el preferido; si da 0, prueba los demás. Devuelve
        (cotización, índice del DEX que respondió). */
    function mejorCotizacion(Dex[] storage dexes, uint256 pref, address tin, address tout, uint24 fee, uint256 amt)
        public returns (uint256 out, uint256 idx)
    {
        out = cotizar(dexes, pref, tin, tout, fee, amt);
        if (out > 0) return (out, pref);
        for (uint256 i = 0; i < dexes.length; i++) {
            if (i == pref) continue;
            uint256 o = cotizar(dexes, i, tin, tout, fee, amt);
            if (o > 0) return (o, i);
        }
        return (0, pref);
    }

    /** Ejecuta el swap con fallback: intenta el DEX `idx`; si revierte, prueba
        los demás en la misma tx. Registra fallos/uso. Devuelve lo recibido por
        el `recipient` (medido por diferencia de balance) y el DEX usado. */
    function swapConFallback(
        Dex[] storage dexes, uint256 idx,
        address tin, address tout, uint24 fee,
        address recipient, uint256 amountIn, uint256 minOut
    ) public returns (uint256 recibido, uint256 usado) {
        uint256 antes = IERC20L(tout).balanceOf(recipient);
        // orden de intento: primero idx, luego el resto
        for (uint256 pass = 0; pass < dexes.length; pass++) {
            uint256 i = pass == 0 ? idx : (pass - 1 == idx ? dexes.length : pass - 1);
            if (i >= dexes.length || !dexes[i].activo) continue;
            IERC20L(tin).approve(dexes[i].router, 0);
            IERC20L(tin).approve(dexes[i].router, amountIn);
            try IV3Router(dexes[i].router).exactInputSingle(
                IV3Router.ExactInputSingleParams({
                    tokenIn: tin, tokenOut: tout, fee: fee, recipient: recipient,
                    deadline: block.timestamp, amountIn: amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0
                })
            ) returns (uint256) {
                recibido = IERC20L(tout).balanceOf(recipient) - antes;
                if (recibido > 0) { dexes[i].ultimoUso = uint40(block.timestamp); return (recibido, i); }
            } catch {
                if (dexes[i].fallos < type(uint32).max) dexes[i].fallos++;
            }
        }
        revert("todos los DEX fallaron");
    }
}
