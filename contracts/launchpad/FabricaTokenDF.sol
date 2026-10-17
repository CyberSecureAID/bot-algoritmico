// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./TokenDF.sol";

/* ─────────────────────────────────────────────────────────────────────────
   FabricaTokenDF.sol. Fabrica minima de monedas TokenDF.

   Por que existe: el codigo de CREACION de TokenDF pesa ~9 KB. Si el Launchpad
   lo lleva embebido (usando `new TokenDF(...)` dentro de su propio codigo), la
   implementacion supera el limite de 24576 bytes del EVM (EIP-170) al añadirle
   el cobro por creacion, y no se podria desplegar en BSC. Sacando el `new` a
   este contrato, la implementacion del Launchpad baja ~9 KB y entra con holgura.

   Que hace: solo despliega. No custodia nada, no tiene owner, no es actualizable.
   TokenDF sigue siendo EXACTAMENTE el mismo contrato de siempre (no se toca), asi
   que su verificacion automatica de un clic en BscScan se mantiene.

   Seguridad: la `fabrica` del token que se despliega es `msg.sender` (quien llama).
   Cuando lo llama el Launchpad, la fabrica del token queda siendo el Launchpad,
   que es quien luego deposita la reserva del suelo. Si cualquier otro llamara a
   `desplegar`, crearia un TokenDF suelto cuya fabrica seria el mismo; es inofensivo:
   el Launchpad solo confia en los tokens que el mismo registro (mapping `info`).
   ───────────────────────────────────────────────────────────────────────── */

contract FabricaTokenDF {
    event TokenDesplegado(address indexed token, address indexed fabrica, address indexed creador);

    /// Despliega un TokenDF. `fabrica` del token = msg.sender (el Launchpad que llama).
    function desplegar(
        string calldata nombre,
        string calldata simbolo,
        uint256 supply,
        address creador,
        uint16 sueloBps,
        uint256 vestTotal,
        uint64 vestDur
    ) external returns (address token) {
        token = address(new TokenDF(nombre, simbolo, supply, creador, msg.sender, sueloBps, vestTotal, vestDur));
        emit TokenDesplegado(token, msg.sender, creador);
    }
}
