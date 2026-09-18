// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*═══════════════════════════════════════════════════════════════════════
  Tarifas — registro central de comisiones de toda la plataforma.
  ═══════════════════════════════════════════════════════════════════════
  · Un solo sitio para cambiar comisiones: el panel admin escribe aquí y
    todos los contratos (P2P, Swap, Futuros, Bots…) leen de aquí.
  · Por servicio: puntos básicos, y por token: mínimo y máximo.
  · Wallets exentas, códigos promocionales (con registro de quién los usó),
    descuento Pro (50 %).
  · Multi-admin: principal + hasta 3 directores con los mismos poderes.
  · UUPS con espera de 48 h para actualizarse.
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/UUPSUpgradeable.sol";

interface IPro {
    function esPro(address cuenta) external view returns (bool);
}

contract Tarifas is Initializable, UUPSUpgradeable {
    /*──── Servicios ────*/
    bytes32 public constant P2P     = "p2p";
    bytes32 public constant SWAP    = "swap";
    bytes32 public constant FUTUROS = "futuros";
    bytes32 public constant BOTS    = "bots";

    struct Codigo { uint16 descuentoBps; uint40 caduca; uint32 maxUsos; uint32 usos; bool activo; bytes32 servicio; }

    address public principal;
    address public principalPendiente;
    mapping(address => bool) public esDirector;
    uint8 public numDirectores;
    uint8 public constant MAX_DIRECTORES = 3;

    address public propuestaImpl;
    uint40  public propuestaEn;
    uint40  public constant ESPERA_UPGRADE = 48 hours;

    IPro public pro;
    uint16 public descuentoProBps;                                  // 5000 = 50 %
    mapping(bytes32 => uint16) public bps;                          // servicio => comisión
    mapping(bytes32 => mapping(address => uint256)) public minimo;  // servicio => token => mínimo
    mapping(bytes32 => mapping(address => uint256)) public maximo;  // servicio => token => máximo (0 = sin tope)
    mapping(address => bool) public exento;
    mapping(address => bool) public contratoAutorizado;             // pueden registrar uso de códigos
    mapping(bytes32 => Codigo) public codigos;
    mapping(bytes32 => mapping(address => uint40)) public usoCodigo;

    uint256[40] private __gap;

    event Config(bytes32 indexed clave, bytes32 indexed servicio, uint256 valor, address direccion);
    event CodigoCreado(bytes32 indexed hash, bytes32 servicio, uint16 descuentoBps, uint40 caduca, uint32 maxUsos);
    event CodigoUsado(bytes32 indexed hash, address indexed por, bytes32 servicio);
    event UpgradePropuesto(address impl, uint40 ejecutableDesde);

    error NoAutorizado();
    error Limite();
    error Upgrade();

    modifier soloAdmin() { if (!esAdmin(msg.sender)) revert NoAutorizado(); _; }
    modifier soloPrincipal() { if (msg.sender != principal) revert NoAutorizado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _principal) external initializer {
        __UUPSUpgradeable_init();
        principal = _principal;
        descuentoProBps = 5000;
        bps[P2P] = 30;      // 0,30 %
        bps[SWAP] = 15;     // 0,15 %
        bps[FUTUROS] = 4;   // 0,04 %
        bps[BOTS] = 0;
    }

    /*──── Admin ────*/
    function esAdmin(address a) public view returns (bool) { return a == principal || esDirector[a]; }
    function esExento(address a) external view returns (bool) { return exento[a] || esAdmin(a); }
    function agregarDirector(address d) external soloPrincipal {
        if (d == address(0) || esDirector[d] || numDirectores >= MAX_DIRECTORES) revert Limite();
        esDirector[d] = true; numDirectores++; emit Config("director+", 0, 1, d);
    }
    function quitarDirector(address d) external soloPrincipal {
        if (!esDirector[d]) revert Limite();
        esDirector[d] = false; numDirectores--; emit Config("director-", 0, 0, d);
    }
    function proponerPrincipal(address n) external soloPrincipal { principalPendiente = n; }
    function aceptarPrincipal() external { if (msg.sender != principalPendiente) revert NoAutorizado(); principal = msg.sender; principalPendiente = address(0); emit Config("principal", 0, 0, msg.sender); }

    function proponerUpgrade(address impl) external soloAdmin { propuestaImpl = impl; propuestaEn = uint40(block.timestamp); emit UpgradePropuesto(impl, uint40(block.timestamp) + ESPERA_UPGRADE); }
    function _authorizeUpgrade(address impl) internal view override soloAdmin {
        if (impl != propuestaImpl || impl == address(0) || block.timestamp < propuestaEn + ESPERA_UPGRADE) revert Upgrade();
    }

    /*──── Configuración ────*/
    function setPro(address p) external soloAdmin { pro = IPro(p); emit Config("pro", 0, 0, p); }
    function setDescuentoPro(uint16 b) external soloAdmin { if (b > 10000) revert Limite(); descuentoProBps = b; emit Config("descuentoPro", 0, b, address(0)); }
    function setBps(bytes32 servicio, uint16 b) external soloAdmin { if (b > 1000) revert Limite(); bps[servicio] = b; emit Config("bps", servicio, b, address(0)); }
    function setMinMax(bytes32 servicio, address token, uint256 mn, uint256 mx) external soloAdmin { minimo[servicio][token] = mn; maximo[servicio][token] = mx; emit Config("minmax", servicio, mn, token); }
    function setExento(address a, bool v) external soloAdmin { exento[a] = v; emit Config("exento", 0, v ? 1 : 0, a); }
    function autorizarContrato(address c, bool v) external soloAdmin { contratoAutorizado[c] = v; emit Config("contrato", 0, v ? 1 : 0, c); }
    function crearCodigo(bytes32 hash, bytes32 servicio, uint16 descuentoBps, uint40 caduca, uint32 maxUsos) external soloAdmin {
        if (descuentoBps > 10000) revert Limite();
        codigos[hash] = Codigo(descuentoBps, caduca, maxUsos, 0, true, servicio);
        emit CodigoCreado(hash, servicio, descuentoBps, caduca, maxUsos);
    }
    function desactivarCodigo(bytes32 hash) external soloAdmin { codigos[hash].activo = false; }

    /*──── Consultas de los contratos ────*/
    function comisionBps(bytes32 servicio) external view returns (uint16) { return bps[servicio]; }
    function comisionP2PBps() external view returns (uint16) { return bps[P2P]; }

    /// Puntos básicos que corresponden a esta cuenta en este servicio (exentos 0, Pro con descuento).
    function bpsDe(bytes32 servicio, address cuenta) public view returns (uint16 b) {
        if (exento[cuenta] || esAdmin(cuenta)) return 0;
        b = bps[servicio];
        if (address(pro) != address(0) && pro.esPro(cuenta)) b = uint16(uint256(b) * (10000 - descuentoProBps) / 10000);
    }

    /// Comisión final sobre un bruto, aplicando descuento de código, mínimo y máximo por token.
    function calcular(bytes32 servicio, address cuenta, address token, uint256 bruto, uint16 descuentoBps) external view returns (uint256 c) {
        uint16 b = bpsDe(servicio, cuenta);
        if (b == 0) return 0;
        c = bruto * b / 10000;
        if (descuentoBps > 0) c -= c * descuentoBps / 10000;
        uint256 mn = minimo[servicio][token]; uint256 mx = maximo[servicio][token];
        if (c < mn) c = mn;
        if (mx != 0 && c > mx) c = mx;
        if (c > bruto) c = bruto;
    }

    /// Un contrato autorizado registra que `usuario` usa el código. Devuelve el descuento (0 si no aplica).
    function aplicarCodigo(bytes32 hash, address usuario, bytes32 servicio) external returns (uint16) {
        if (!contratoAutorizado[msg.sender]) revert NoAutorizado();
        if (hash == bytes32(0)) return 0;
        Codigo storage k = codigos[hash];
        if (!k.activo || (k.servicio != bytes32(0) && k.servicio != servicio)) return 0;
        if ((k.caduca != 0 && block.timestamp > k.caduca) || (k.maxUsos != 0 && k.usos >= k.maxUsos)) return 0;
        if (usoCodigo[hash][usuario] != 0) return 0;
        k.usos++; usoCodigo[hash][usuario] = uint40(block.timestamp);
        emit CodigoUsado(hash, usuario, servicio);
        return k.descuentoBps;
    }
}
