// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*═══════════════════════════════════════════════════════════════════════
  OrdenesLimite — órdenes límite para Futuros (satélite).
  ═══════════════════════════════════════════════════════════════════════
  El usuario deja una orden a un PRECIO OBJETIVO. Cuando el precio lo toca,
  cualquiera puede ejecutarla (keeper o bots públicos) a cambio de una propina,
  y el satélite abre la posición REAL en Futuros en nombre del usuario.
  · Crear: cobra el margen del usuario (en la stable) y guarda la orden.
  · Cancelar: el dueño recupera su margen.
  · Ejecutar: pública + propina + idempotente. Si el precio tocó el objetivo,
    aprueba el margen a Futuros y llama Futuros.abrir(trader=dueño).
  · Multi-owner (Tarifas) + proxy UUPS 48h + pausa + reentrancy + SafeERC20.
  · Interconectado: Futuros, Oráculo (precio), Contabilidad (reporta), Tarifas.
  REQUISITO: Futuros.setSatelite(estaDireccion, true) para que pueda abrir.
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/utils/SafeERC20.sol";

interface ITarifas      { function esAdmin(address) external view returns (bool); }
interface IOraculo      { function precioUSD(address token) external view returns (uint256); }
interface IContabilidad { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; }
interface IFuturos {
    enum Lado { Long, Short }
    struct ParamsAbrir { address token; address stable; Lado lado; uint256 margen; uint16 lev; uint256 tp; uint256 sl; address trader; }
    function abrir(ParamsAbrir memory q) external returns (uint256);
    function LEV_MAX() external view returns (uint16);
    function tokenOperable(address) external view returns (bool);
    function stableColateral(address) external view returns (bool);
}

contract OrdenesLimite is Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant SRV = keccak256("ordeneslimite");
    uint40  public constant ESPERA_UPGRADE = 48 hours;

    enum Lado { Long, Short }

    struct Orden {
        address trader; address token; address stable; Lado lado;
        uint256 precio;   // precio objetivo (USD 1e18)
        uint256 margen; uint16 lev; uint256 tp; uint256 sl;
        uint40 creada; bool activa;
    }

    ITarifas public tarifas;
    IFuturos public futuros;
    IOraculo public oraculo;
    IContabilidad public contabilidad;
    address public principal;

    Orden[] private _ordenes;
    mapping(address => uint256[]) public ordenesDe;

    uint16 public propinaBps;   // propina al ejecutor (ej. 10 = 0.1% del margen)
    bool public pausado;
    address public propuestaImpl; uint40 public propuestaEn;

    event OrdenCreada(uint256 indexed id, address indexed trader, address token, Lado lado, uint256 precio, uint256 margen, uint16 lev);
    event OrdenCancelada(uint256 indexed id, address indexed trader);
    event OrdenEjecutada(uint256 indexed id, address indexed trader, address ejecutor, uint256 posicionId);
    event Config(string campo, uint256 valor, address quien);
    event Pausa(bool v);
    event UpgradePropuesto(address impl, uint40 cuando);

    error NoAutorizado();
    error Pausado();
    error ParamInvalido();
    error NoDueno();
    error Inactiva();
    error PrecioNoAlcanzado();
    error EsperaUpgrade();

    modifier soloAdmin() {
        if (!(msg.sender == principal || (address(tarifas) != address(0) && tarifas.esAdmin(msg.sender)))) revert NoAutorizado();
        _;
    }
    modifier vivo() { if (pausado) revert Pausado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _principal, address _tarifas, address _futuros, address _oraculo, address _contabilidad) external initializer {
        if (_futuros == address(0) || _oraculo == address(0)) revert ParamInvalido();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        principal = _principal;
        tarifas = ITarifas(_tarifas);
        futuros = IFuturos(_futuros);
        oraculo = IOraculo(_oraculo);
        contabilidad = IContabilidad(_contabilidad);
        propinaBps = 10;   // 0.1% del margen al ejecutor
        emit Config("init", 0, _principal);
    }

    /*───────────── Crear orden límite ─────────────*/
    function crear(address token, address stable, Lado lado, uint256 precio, uint256 margen, uint16 lev, uint256 tp, uint256 sl)
        external vivo nonReentrant returns (uint256 id)
    {
        require(futuros.tokenOperable(token), "token no operable");
        require(futuros.stableColateral(stable), "stable no valida");
        require(precio > 0 && margen > 0 && lev >= 1 && lev <= futuros.LEV_MAX(), "params");
        // cobrar el margen del usuario (fee-on-transfer safe)
        uint256 antes = IERC20(stable).balanceOf(address(this));
        IERC20(stable).safeTransferFrom(msg.sender, address(this), margen);
        uint256 recibido = IERC20(stable).balanceOf(address(this)) - antes;

        id = _ordenes.length;
        _ordenes.push(Orden(msg.sender, token, stable, lado, precio, recibido, lev, tp, sl, uint40(block.timestamp), true));
        ordenesDe[msg.sender].push(id);
        emit OrdenCreada(id, msg.sender, token, lado, precio, recibido, lev);
    }

    /*───────────── Cancelar (dueño recupera su margen) ─────────────*/
    function cancelar(uint256 id) external nonReentrant {
        Orden storage o = _ordenes[id];
        if (!o.activa) revert Inactiva();
        if (o.trader != msg.sender && msg.sender != principal) revert NoDueno();
        o.activa = false;
        IERC20(o.stable).safeTransfer(o.trader, o.margen);
        emit OrdenCancelada(id, o.trader);
    }

    /*───────────── Ejecutar (pública, con propina, idempotente) ─────────────*/
    function ejecutar(uint256 id) external vivo nonReentrant {
        Orden storage o = _ordenes[id];
        if (!o.activa) revert Inactiva();
        uint256 p = oraculo.precioUSD(o.token);
        require(p > 0, "sin precio");
        // Long: se activa cuando el precio BAJA al objetivo o menos.
        // Short: cuando el precio SUBE al objetivo o más.
        bool toca = o.lado == Lado.Long ? (p <= o.precio) : (p >= o.precio);
        if (!toca) revert PrecioNoAlcanzado();

        o.activa = false;   // idempotente: ya no se puede re-ejecutar

        // propina al ejecutor, del margen (incentiva a keeper/bots públicos)
        uint256 propina = o.margen * propinaBps / 10000;
        uint256 margenNeto = o.margen - propina;
        if (propina > 0) IERC20(o.stable).safeTransfer(msg.sender, propina);

        // aprobar el margen neto a Futuros y abrir la posición del dueño
        IERC20(o.stable).forceApprove(address(futuros), margenNeto);
        uint256 posId = futuros.abrir(IFuturos.ParamsAbrir(
            o.token, o.stable, IFuturos.Lado(uint8(o.lado)), margenNeto, o.lev, o.tp, o.sl, o.trader
        ));

        // reportar a Contabilidad
        if (address(contabilidad) != address(0)) {
            try contabilidad.reportar(o.trader, SRV, 0, 0, 0) {} catch {}
        }
        emit OrdenEjecutada(id, o.trader, msg.sender, posId);
    }

    /*───────────── Vistas ─────────────*/
    function orden(uint256 id) external view returns (Orden memory) { return _ordenes[id]; }
    function idsDe(address trader) external view returns (uint256[] memory) { return ordenesDe[trader]; }
    function total() external view returns (uint256) { return _ordenes.length; }
    // ¿se puede ejecutar ahora? (para el keeper/frontend)
    function ejecutable(uint256 id) external view returns (bool) {
        Orden storage o = _ordenes[id];
        if (!o.activa) return false;
        uint256 p = oraculo.precioUSD(o.token);
        if (p == 0) return false;
        return o.lado == Lado.Long ? (p <= o.precio) : (p >= o.precio);
    }

    /*───────────── Administración ─────────────*/
    function setPropinaBps(uint16 b) external soloAdmin { if (b > 200) revert ParamInvalido(); propinaBps = b; emit Config("propinaBps", b, msg.sender); }
    function setContratos(address _tarifas, address _futuros, address _oraculo, address _contab) external soloAdmin {
        if (_tarifas != address(0)) tarifas = ITarifas(_tarifas);
        if (_futuros != address(0)) futuros = IFuturos(_futuros);
        if (_oraculo != address(0)) oraculo = IOraculo(_oraculo);
        if (_contab  != address(0)) contabilidad = IContabilidad(_contab);
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
