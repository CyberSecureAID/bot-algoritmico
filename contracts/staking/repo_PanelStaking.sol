// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*═══════════════════════════════════════════════════════════════════════
  PanelStaking — vistas ricas de SOLO LECTURA para el frontend del Staking.
  ═══════════════════════════════════════════════════════════════════════
  No mueve fondos. Lee del contrato Staking y del Oráculo y arma la foto
  completa para inversores de gran volumen:
   · Posición del usuario: capital por moneda (INTACTO), en uso (prestado a
     Futuros, GENERANDO ingresos), disponible, valor USD, ganancia por
     valorización, pendiente por cobrar, % de participación, depósitos con
     fecha y plazo.
   · Global: TVL total y por moneda, capital en uso vs libre, nº de stakers,
     repartido histórico, participación real vs asignada.
  CLAVE: el "capital" del usuario NUNCA baja porque esté prestado. Se muestra
  siempre completo, con el desglose en uso/disponible para que se entienda
  que su dinero está TRABAJANDO, no desaparecido.
═══════════════════════════════════════════════════════════════════════*/

interface IStakingPanel {
    struct Deposito { address token; uint256 monto; uint256 valorUSD; uint40 cuando; uint40 vence; bool holdMoneda; bool retirado; }
    function participacionDe(address a) external view returns (uint256 pesoReal, uint256 pesoAsignado, uint256 total);
    function pendienteDe(address a, address token) external view returns (uint256);
    function depositosDe(address a) external view returns (Deposito[] memory);
    function porcentajeDe(address a) external view returns (uint256);
    function numStakers() external view returns (uint256);
    function totalPeso() external view returns (uint256);
    function totalReal() external view returns (uint256);
    function totalAsignado() external view returns (uint256);
    function capitalPorToken(address token) external view returns (uint256);
    function prestado(address token) external view returns (uint256);
    function repartidoTotal(address token) external view returns (uint256);
    function tokensRecompensa(uint256 i) external view returns (address);
    function numTokensRecompensa() external view returns (uint256);
    function listaStakers(uint256 i) external view returns (address);
}
interface IOraculoPanel {
    function precioUSD(address token) external view returns (uint256);
    function valorUSD(address token, uint256 cantidad) external view returns (uint256);
}
interface IERC20Sym { function symbol() external view returns (string memory); function decimals() external view returns (uint8); }

contract PanelStaking {
    IStakingPanel public staking;
    IOraculoPanel public oraculo;
    address public principal;

    constructor(address _staking, address _oraculo, address _principal) {
        staking = IStakingPanel(_staking); oraculo = IOraculoPanel(_oraculo); principal = _principal;
    }
    function setContratos(address _staking, address _oraculo) external {
        require(msg.sender == principal, "no");
        staking = IStakingPanel(_staking); oraculo = IOraculoPanel(_oraculo);
    }

    /*──────────────── Posición del usuario ────────────────*/
    struct PosicionUsuario {
        uint256 pesoReal;          // su participación real en USD (fijada al depositar)
        uint256 pesoAsignado;      // participación asignada por el admin (USD)
        uint256 valorActualUSD;    // valor de mercado AHORA de su capital (por valorización)
        int256  gananciaValoriza;  // valorActual - peso depositado (puede ser + o −)
        uint256 porcentaje;        // % del bote en base 1e6
        uint256 numDepositos;
        uint256 numActivos;
    }
    function posicionUsuario(address a) external view returns (PosicionUsuario memory p) {
        (uint256 real, uint256 asig, ) = staking.participacionDe(a);
        p.pesoReal = real; p.pesoAsignado = asig; p.porcentaje = staking.porcentajeDe(a);
        IStakingPanel.Deposito[] memory ds = staking.depositosDe(a);
        p.numDepositos = ds.length;
        uint256 valorAhora;
        for (uint256 i; i < ds.length; i++) {
            if (ds[i].retirado) continue;
            p.numActivos++;
            valorAhora += oraculo.valorUSD(ds[i].token, ds[i].monto);
        }
        p.valorActualUSD = valorAhora;
        p.gananciaValoriza = int256(valorAhora) - int256(real);
    }

    /// Desglose del capital del usuario por moneda: total, en uso y disponible.
    /// El total NUNCA baja porque esté prestado: en uso significa "trabajando".
    struct CapitalMoneda { address token; string simbolo; uint8 decimales; uint256 total; uint256 enUso; uint256 disponible; uint256 valorUSD; }
    function capitalDeUsuario(address a) external view returns (CapitalMoneda[] memory out) {
        IStakingPanel.Deposito[] memory ds = staking.depositosDe(a);
        // agrupar por token
        address[] memory toks = new address[](ds.length);
        uint256[] memory montos = new uint256[](ds.length);
        uint256 n;
        for (uint256 i; i < ds.length; i++) {
            if (ds[i].retirado) continue;
            uint256 j; bool found;
            for (j = 0; j < n; j++) if (toks[j] == ds[i].token) { found = true; break; }
            if (!found) { toks[n] = ds[i].token; montos[n] = ds[i].monto; n++; }
            else montos[j] += ds[i].monto;
        }
        out = new CapitalMoneda[](n);
        for (uint256 k; k < n; k++) {
            address t = toks[k];
            uint256 capTotal = staking.capitalPorToken(t);
            uint256 prest = staking.prestado(t);
            // proporción del usuario en ese token
            uint256 miMonto = montos[k];
            uint256 miEnUso = capTotal == 0 ? 0 : prest * miMonto / capTotal;
            out[k] = CapitalMoneda({
                token: t, simbolo: _sym(t), decimales: _dec(t),
                total: miMonto, enUso: miEnUso, disponible: miMonto - miEnUso,
                valorUSD: oraculo.valorUSD(t, miMonto)
            });
        }
    }

    /// Pendiente por cobrar de cada token de recompensa.
    struct Recompensa { address token; string simbolo; uint256 pendiente; }
    function recompensasDe(address a) external view returns (Recompensa[] memory out) {
        uint256 n = staking.numTokensRecompensa();
        out = new Recompensa[](n);
        for (uint256 i; i < n; i++) { address t = staking.tokensRecompensa(i); out[i] = Recompensa(t, _sym(t), staking.pendienteDe(a, t)); }
    }

    /*──────────────── Global (para el inversor y el panel admin) ────────────────*/
    struct Global {
        uint256 tvlUSD;            // valor total bloqueado en USD (peso total)
        uint256 realUSD;           // participación real
        uint256 asignadoUSD;       // participación asignada por admin
        uint256 numStakers;
    }
    function global() external view returns (Global memory g) {
        g.tvlUSD = staking.totalPeso();
        g.realUSD = staking.totalReal();
        g.asignadoUSD = staking.totalAsignado();
        g.numStakers = staking.numStakers();
    }

    /// TVL por moneda con desglose en uso / disponible.
    struct TVLMoneda { address token; string simbolo; uint256 total; uint256 enUso; uint256 disponible; uint256 valorUSD; uint256 repartido; }
    function tvlPorMoneda(address[] calldata tokens) external view returns (TVLMoneda[] memory out) {
        out = new TVLMoneda[](tokens.length);
        for (uint256 i; i < tokens.length; i++) {
            address t = tokens[i];
            uint256 cap = staking.capitalPorToken(t);
            uint256 prest = staking.prestado(t);
            out[i] = TVLMoneda({
                token: t, simbolo: _sym(t), total: cap, enUso: prest, disponible: cap - prest,
                valorUSD: oraculo.valorUSD(t, cap), repartido: staking.repartidoTotal(t)
            });
        }
    }

    /*──────────────── Internas ────────────────*/
    function _sym(address t) internal view returns (string memory) {
        if (t == address(0)) return "BNB";
        try IERC20Sym(t).symbol() returns (string memory s) { return s; } catch { return "?"; }
    }
    function _dec(address t) internal view returns (uint8) {
        if (t == address(0)) return 18;
        try IERC20Sym(t).decimals() returns (uint8 d) { return d; } catch { return 18; }
    }
}
