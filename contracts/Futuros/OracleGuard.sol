// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*═══════════════════════════════════════════════════════════════════════
  OracleGuard — oráculo endurecido anti-manipulación y anti-gap.
  ═══════════════════════════════════════════════════════════════════════
  · Es DROP-IN del oráculo: expone precioUSD/valorUSD/aceptado con las MISMAS
    firmas, así Futuros puede apuntar aquí con setContratos sin cambiar nada.
  · FUENTES: el OraculoPrecios desplegado (siempre disponible, base) + Pyth
    (opcional, si el token tiene feed y está fresco). Si ambos difieren más de
    'maxDesvioBps', se RECHAZA (revert) para no dar un precio manipulado.
  · CIRCUIT BREAKER: registra el último precio de referencia por token; si el
    precio salta más de 'maxMovBps' respecto al último, levanta la bandera de
    gap y (si está activo) revierte precioSeguro para FRENAR operaciones hasta
    que un admin lo revise. Protege contra caídas de -60% en segundos.
  · Multi-owner (Tarifas) + proxy UUPS 48h + pausa.
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/UUPSUpgradeable.sol";

interface ITarifas { function esAdmin(address) external view returns (bool); }
interface IOraculoBase {
    function precioUSD(address token) external view returns (uint256);       // 18 dec
    function valorUSD(address token, uint256 cantidad) external view returns (uint256);
    function aceptado(address token) external view returns (bool);
}
// Pyth (pull): getPriceNoOlderThan devuelve la última actualización si es fresca.
interface IPyth {
    struct Price { int64 price; uint64 conf; int32 expo; uint publishTime; }
    function getPriceNoOlderThan(bytes32 id, uint age) external view returns (Price memory);
}

contract OracleGuard is Initializable, UUPSUpgradeable {
    uint40 public constant ESPERA_UPGRADE = 48 hours;

    ITarifas public tarifas;
    IOraculoBase public base;       // OraculoPrecios desplegado (0xf51b..)
    IPyth public pyth;              // Pyth Core (0x4D7E..), opcional
    address public principal;

    // Pyth: feed id por token (0x0 = token sin feed → solo base)
    mapping(address => bytes32) public pythId;
    uint256 public pythMaxAge;      // segundos máximos de antigüedad de Pyth (ej. 60)

    // tolerancias (en bps, base 10000)
    uint16 public maxDesvioBps;     // desvío máx entre base y Pyth antes de rechazar (ej. 300 = 3%)
    uint16 public maxMovBps;        // movimiento máx vs referencia antes de marcar gap (ej. 1500 = 15%)

    // circuit breaker
    mapping(address => uint256) public refPrecio;   // última referencia por token
    mapping(address => uint40)  public refCuando;
    bool public breakerActivo;      // si true, precioSeguro revierte cuando hay gap
    mapping(address => bool) public gapToken;       // token marcado con gap (requiere reset admin)

    bool public pausado;
    address public propuestaImpl; uint40 public propuestaEn;

    event Config(string campo, uint256 valor, address quien);
    event Gap(address token, uint256 precioViejo, uint256 precioNuevo);
    event GapReset(address token, address quien);
    event Pausa(bool v);
    event UpgradePropuesto(address impl, uint40 cuando);

    error NoAutorizado();
    error Pausado();
    error ParamInvalido();
    error DesvioExcesivo();
    error GapDetectado();
    error EsperaUpgrade();

    modifier soloAdmin() {
        if (!(msg.sender == principal || (address(tarifas) != address(0) && tarifas.esAdmin(msg.sender)))) revert NoAutorizado();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _principal, address _tarifas, address _base, address _pyth) external initializer {
        if (_base == address(0)) revert ParamInvalido();
        __UUPSUpgradeable_init();
        principal = _principal;
        tarifas = ITarifas(_tarifas);
        base = IOraculoBase(_base);
        pyth = IPyth(_pyth);
        pythMaxAge   = 60;      // 60s
        maxDesvioBps = 300;     // 3%
        maxMovBps    = 1500;    // 15% de salto marca gap
        breakerActivo = true;
        emit Config("init", 0, _principal);
    }

    /*───────────── Lectura de precio (DROP-IN: mismas firmas) ─────────────*/

    // precio validado: base + Pyth (si hay feed fresco), con sanity check de desvío.
    function precioUSD(address token) public view returns (uint256) {
        uint256 pBase = base.precioUSD(token);
        require(pBase > 0, "sin base");

        // si el token tiene feed Pyth, cruzar y validar desvío
        bytes32 id = pythId[token];
        if (id != bytes32(0) && address(pyth) != address(0)) {
            uint256 pPyth = _precioPyth(id);
            if (pPyth > 0) {
                uint256 alto = pBase > pPyth ? pBase : pPyth;
                uint256 bajo = pBase > pPyth ? pPyth : pBase;
                // desvío = (alto-bajo)/bajo. Si supera maxDesvioBps → precio dudoso, rechazar.
                if ((alto - bajo) * 10000 / bajo > maxDesvioBps) revert DesvioExcesivo();
                // precio = mediana de 2 = promedio (robusto, ya validado)
                return (pBase + pPyth) / 2;
            }
        }
        return pBase;
    }

    // precio SEGURO para operar: igual que precioUSD pero además aplica el circuit
    // breaker. Si el token está marcado con gap y el breaker está activo, revierte
    // (frena aperturas/operaciones) hasta que un admin resetee. Es VIEW: no muta.
    function precioSeguro(address token) external view returns (uint256) {
        if (breakerActivo && gapToken[token]) revert GapDetectado();
        uint256 p = precioUSD(token);
        // detectar salto vs referencia (solo lectura; el marcado se hace en chequearGap)
        uint256 ref = refPrecio[token];
        if (breakerActivo && ref > 0) {
            uint256 alto = p > ref ? p : ref;
            uint256 bajo = p > ref ? ref : p;
            if ((alto - bajo) * 10000 / bajo > maxMovBps) revert GapDetectado();
        }
        return p;
    }

    function valorUSD(address token, uint256 cantidad) external view returns (uint256) {
        return base.valorUSD(token, cantidad);   // la conversión de cantidad la hace la base
    }
    function aceptado(address token) external view returns (bool) { return base.aceptado(token); }

    // precio de Pyth normalizado a 18 dec (0 si no está fresco o inválido)
    function _precioPyth(bytes32 id) internal view returns (uint256) {
        try pyth.getPriceNoOlderThan(id, pythMaxAge) returns (IPyth.Price memory pr) {
            if (pr.price <= 0) return 0;
            uint256 precio = uint256(uint64(pr.price));
            int32 e = pr.expo;                    // típicamente -8
            // normalizar a 18 decimales
            if (e <= 0) {
                uint256 dec = uint256(uint32(-e));
                if (dec <= 18) return precio * (10 ** (18 - dec));
                return precio / (10 ** (dec - 18));
            } else {
                return precio * (10 ** uint256(uint32(e))) * 1e18;
            }
        } catch { return 0; }
    }

    /*───────────── Circuit breaker (actualizar referencia / marcar gap) ─────────────*/

    // Cualquiera puede llamar para actualizar la referencia y marcar gap si procede.
    // Es la vía que MUTA estado (precioSeguro es view y no puede). Un keeper o el
    // propio flujo de Futuros puede llamarla; también se puede llamar manual.
    function chequearGap(address token) external {
        if (pausado) revert Pausado();
        uint256 p = precioUSD(token);
        uint256 ref = refPrecio[token];
        if (ref > 0) {
            uint256 alto = p > ref ? p : ref;
            uint256 bajo = p > ref ? ref : p;
            if ((alto - bajo) * 10000 / bajo > maxMovBps) {
                gapToken[token] = true;
                emit Gap(token, ref, p);
            }
        }
        refPrecio[token] = p;
        refCuando[token] = uint40(block.timestamp);
    }

    /*───────────── Administración ─────────────*/
    function setPythId(address token, bytes32 id) external soloAdmin { pythId[token] = id; emit Config("pythId", uint256(id), msg.sender); }
    function setPythMaxAge(uint256 s) external soloAdmin { if (s == 0) revert ParamInvalido(); pythMaxAge = s; }
    function setMaxDesvioBps(uint16 b) external soloAdmin { if (b == 0 || b > 5000) revert ParamInvalido(); maxDesvioBps = b; }
    function setMaxMovBps(uint16 b) external soloAdmin { if (b == 0 || b > 9000) revert ParamInvalido(); maxMovBps = b; }
    function setBreakerActivo(bool v) external soloAdmin { breakerActivo = v; emit Config("breaker", v ? 1 : 0, msg.sender); }
    function resetGap(address token) external soloAdmin { gapToken[token] = false; refPrecio[token] = precioUSD(token); emit GapReset(token, msg.sender); }
    function setContratos(address _tarifas, address _base, address _pyth) external soloAdmin {
        if (_tarifas != address(0)) tarifas = ITarifas(_tarifas);
        if (_base != address(0)) base = IOraculoBase(_base);
        pyth = IPyth(_pyth);
        emit Config("contratos", 0, msg.sender);
    }
    function setPausa(bool v) external soloAdmin { pausado = v; emit Pausa(v); }

    /*───────────── Upgrade (UUPS 48h) ─────────────*/
    function proponerUpgrade(address impl) external soloAdmin { propuestaImpl = impl; propuestaEn = uint40(block.timestamp); emit UpgradePropuesto(impl, uint40(block.timestamp)); }
    function _authorizeUpgrade(address impl) internal view override soloAdmin {
        if (impl != propuestaImpl) revert ParamInvalido();
        if (propuestaEn == 0 || block.timestamp < propuestaEn + ESPERA_UPGRADE) revert EsperaUpgrade();
    }

    uint256[40] private __hueco;
}
