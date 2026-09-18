// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*═══════════════════════════════════════════════════════════════════════
  OraculoPrecios — valor en USD de cualquier token de BNB Smart Chain.
  ═══════════════════════════════════════════════════════════════════════
  Base del sistema de Staking: para repartir el 20 %/50 % de forma justa entre
  monedas distintas hay que valorar cada aporte en un valor común (USD). Nunca
  se confía en lo que declara el usuario.

  Dos fuentes, en este orden:
    1. **Chainlink** (preferente): si el admin asignó un feed <token>/USD, se
       lee `latestRoundData()`. Es el estándar para BNB, BTC, ETH, CAKE, etc.
    2. **PancakeSwap V2** (fallback para shitcoins sin feed): se toma el precio
       del par token↔referencia (USDT o WBNB) leyendo reservas, y si va contra
       WBNB se convierte a USD con el feed de BNB/USD. El admin marca qué token
       usa qué ruta; si un token no tiene ni feed ni par con liquidez, NO se
       acepta (protege la liquidez del staking).

  Solo lectura + configuración del admin. UUPS (proxy) con espera de 48 h.
  El owner se lee de Tarifas (todo interconectado).
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/UUPSUpgradeable.sol";

interface ITarifasOrac { function esAdmin(address cuenta) external view returns (bool); }

interface AggregatorV3 {
    function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    function decimals() external view returns (uint8);
}

interface IERC20Dec { function decimals() external view returns (uint8); }

interface IPancakeFactory { function getPair(address a, address b) external view returns (address); }
interface IPancakePair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract OraculoPrecios is Initializable, UUPSUpgradeable {
    /*──────────────── Constantes de BSC ────────────────*/
    address public constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address public constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    IPancakeFactory public FACTORY;   // PancakeSwap V2 factory (editable por si cambia)

    enum Fuente { Ninguna, Chainlink, PancakeUSDT, PancakeWBNB }

    ITarifasOrac public tarifas;
    address public principal;

    address public propuestaImpl;
    uint40  public propuestaEn;
    uint40  public constant ESPERA_UPGRADE = 48 hours;

    // Config por token.
    mapping(address => Fuente) public fuente;         // cómo se valora cada token
    mapping(address => address) public feed;          // token => aggregator Chainlink <token>/USD
    address public feedBNB;                            // BNB/USD (para la ruta PancakeWBNB)
    uint256 public maxAntiguedad;                      // segundos: rechaza feed obsoleto

    uint256[45] private __gap;

    event ConfigToken(address indexed token, Fuente fuente, address feed);
    event Config(bytes32 indexed clave, uint256 valor, address direccion);
    event UpgradePropuesto(address impl, uint40 ejecutableDesde);

    error NoAutorizado();
    error SinFuente();
    error PrecioInvalido();
    error Obsoleto();
    error SinPar();
    error Upgrade();

    modifier soloAdmin() {
        if (!(msg.sender == principal || (address(tarifas) != address(0) && tarifas.esAdmin(msg.sender)))) revert NoAutorizado();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _principal) external initializer {
        __UUPSUpgradeable_init();
        principal = _principal;
        maxAntiguedad = 1 hours;
        feedBNB = 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE; // Chainlink BNB/USD en BSC
        FACTORY = IPancakeFactory(0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73);
    }

    /*──────────────── Config (admin) ────────────────*/
    function setTarifas(address t) external soloAdmin { tarifas = ITarifasOrac(t); emit Config("tarifas", 0, t); }
    function setPrincipal(address p) external { if (msg.sender != principal) revert NoAutorizado(); principal = p; emit Config("principal", 0, p); }
    function setFeedBNB(address f) external soloAdmin { feedBNB = f; emit Config("feedBNB", 0, f); }
    function setFactory(address f) external soloAdmin { FACTORY = IPancakeFactory(f); emit Config("factory", 0, f); }
    function setMaxAntiguedad(uint256 s) external soloAdmin { maxAntiguedad = s; emit Config("maxAntiguedad", s, address(0)); }

    /// Asigna a un token una fuente de precio.
    /// - Chainlink: pasar el aggregator <token>/USD en `f`.
    /// - PancakeUSDT / PancakeWBNB: `f` se ignora (se usan las reservas del par).
    function configurarToken(address token, Fuente fu, address f) external soloAdmin {
        fuente[token] = fu;
        if (fu == Fuente.Chainlink) feed[token] = f; else feed[token] = address(0);
        emit ConfigToken(token, fu, f);
    }

    /*──────────────── Upgrade con espera 48 h ────────────────*/
    function proponerUpgrade(address impl) external soloAdmin { propuestaImpl = impl; propuestaEn = uint40(block.timestamp); emit UpgradePropuesto(impl, uint40(block.timestamp) + ESPERA_UPGRADE); }
    function _authorizeUpgrade(address impl) internal view override soloAdmin {
        if (impl != propuestaImpl || impl == address(0) || block.timestamp < propuestaEn + ESPERA_UPGRADE) revert Upgrade();
    }

    /*──────────────── Precio ────────────────*/
    /// Precio de 1 token en USD, con 18 decimales (1e18 = $1).
    function precioUSD(address token) public view returns (uint256) {
        // USDT y stablecoins configuradas valen $1.
        if (token == USDT) return 1e18;
        Fuente fu = fuente[token];
        if (fu == Fuente.Chainlink) return _chainlink(feed[token]);
        if (fu == Fuente.PancakeUSDT) return _pancake(token, USDT, 1e18);
        if (fu == Fuente.PancakeWBNB) { uint256 pBNB = _chainlink(feedBNB); return _pancake(token, WBNB, pBNB); }
        revert SinFuente();
    }

    /// Valor en USD (18 decimales) de una `cantidad` de `token` (en sus decimales).
    function valorUSD(address token, uint256 cantidad) external view returns (uint256) {
        uint8 dec = _decimals(token);
        return precioUSD(token) * cantidad / (10 ** dec);
    }

    /// ¿Este token se puede aceptar en el staking? (tiene fuente válida y da precio > 0)
    function aceptado(address token) external view returns (bool) {
        if (token == USDT) return true;
        if (fuente[token] == Fuente.Ninguna) return false;
        (bool ok, uint256 p) = _try(token);
        return ok && p > 0;
    }

    /*──────────────── Internas ────────────────*/
    function _chainlink(address agg) internal view returns (uint256) {
        if (agg == address(0)) revert SinFuente();
        (, int256 answer, , uint256 updatedAt, ) = AggregatorV3(agg).latestRoundData();
        if (answer <= 0) revert PrecioInvalido();
        if (maxAntiguedad != 0 && block.timestamp > updatedAt + maxAntiguedad) revert Obsoleto();
        uint8 d = AggregatorV3(agg).decimals();
        return uint256(answer) * 1e18 / (10 ** d);   // normaliza a 18 decimales
    }

    /// Precio de `token` en USD (18 dec) usando el par token↔ref de PancakeSwap.
    /// `precioRefUSD` = precio en USD (18 dec) del token de referencia (USDT=1e18, WBNB=BNB/USD).
    function _pancake(address token, address ref, uint256 precioRefUSD) internal view returns (uint256) {
        address par = FACTORY.getPair(token, ref);
        if (par == address(0)) revert SinPar();
        (uint112 r0, uint112 r1, ) = IPancakePair(par).getReserves();
        address t0 = IPancakePair(par).token0();
        (uint256 resToken, uint256 resRef) = t0 == token ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
        if (resToken == 0) revert PrecioInvalido();
        uint8 decToken = _decimals(token);
        uint8 decRef = _decimals(ref);
        // precio token en ref = resRef/resToken, ajustando decimales; luego a USD.
        // valor(1 token) = (resRef / 10^decRef) / (resToken / 10^decToken) * precioRefUSD
        uint256 num = resRef * (10 ** decToken) * precioRefUSD;
        uint256 den = resToken * (10 ** decRef);
        return num / den;
    }

    function _decimals(address token) internal view returns (uint8) {
        if (token.code.length == 0) return 18;
        try IERC20Dec(token).decimals() returns (uint8 d) { return d; } catch { return 18; }
    }

    function _try(address token) internal view returns (bool ok, uint256 p) {
        try this.precioUSD(token) returns (uint256 v) { return (true, v); } catch { return (false, 0); }
    }
}
