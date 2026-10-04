// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*═══════════════════════════════════════════════════════════════════════
  AnalisisPro — acceso de pago a las herramientas de análisis técnico
  (Liquidity Pools, Heat/Hair Pools, Smart Levels) de la plataforma.
  ═══════════════════════════════════════════════════════════════════════
  · Cobra en BNB o USDT (precio en USD, convertido por el oráculo).
  · DOS planes: mensual y anual (ambos editables por los owners).
  · PRUEBA GRATIS de 10 min, UNA sola vez por wallet, registrada ON-CHAIN
    (no en caché): borrar caché o crear sesión nueva no la renueva.
  · Acceso por TIEMPO sin keeper: tieneAcceso(wallet) es una LECTURA que
    devuelve false sola al vencer (block.timestamp >= accesoHasta).
  · REPARTO del cobro 50/50 a owner1 y owner2 (editable). Nada a stakers.
  · Multi-owner (añadir/quitar/cambiar owners). Owners NO pagan.
  · Interconectado con Contabilidad (reporta cada cobro).
  · Proxy UUPS con espera de 48h · pausa de emergencia · no reentrada ·
    fee-on-transfer (mide saldo antes/después en USDT).
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/utils/SafeERC20.sol";

interface ITarifas      { function esAdmin(address cuenta) external view returns (bool); }
interface IOraculo      { function precioUSD(address token) external view returns (uint256); } // USD por 1 token (18 dec)
interface IContabilidad { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; }

contract AnalisisPro is Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant SRV = keccak256("analisispro");
    uint40  public constant ESPERA_UPGRADE = 48 hours;

    /*───────────── Estado ─────────────*/
    ITarifas public tarifas;          // multi-owner central + comprobación de admin
    IOraculo public oraculo;          // precio BNB/USDT en USD
    IContabilidad public contabilidad;
    address  public principal;        // owner de arranque

    // owners de pago (reciben el 50/50) + lista multi-owner propia
    address public owner1;
    address public owner2;
    mapping(address => bool) public esOwner;
    address[] private _owners;

    address public USDT;              // stablecoin aceptada para pagar

    // precios en USD con 2 decimales ($20.00 = 2000 ; $100.00 = 10000)
    uint256 public precioMesUSD;
    uint256 public precioAnioUSD;
    uint32  public duracionMes;       // segundos del plan mensual
    uint32  public duracionAnio;      // segundos del plan anual
    uint32  public duracionPrueba;    // segundos de la prueba gratis (600 = 10 min)

    // reparto en bps (5000/5000 por defecto)
    uint16 public bpsOwner1;
    uint16 public bpsOwner2;

    // acceso por wallet
    mapping(address => uint40) public accesoHasta;   // timestamp hasta el que tiene acceso
    mapping(address => bool)   public pruebaUsada;   // ya consumió su prueba gratis

    // upgrade con espera
    address public propuestaImpl; uint40 public propuestaEn;
    // pausa
    bool public pausado;

    /*───────────── Eventos ─────────────*/
    event Inicializado(address principal, address owner1, address owner2);
    event AccesoComprado(address indexed wallet, uint8 plan, address token, uint256 pagado, uint40 hasta);
    event PruebaUsada(address indexed wallet, uint40 hasta);
    event OwnerAgregado(address owner);
    event OwnerQuitado(address owner);
    event OwnersPagoCambiados(address owner1, address owner2);
    event Config(string campo, uint256 valor, address quien);
    event Pausa(bool v);
    event UpgradePropuesto(address impl, uint40 cuando);

    /*───────────── Errores ─────────────*/
    error NoAutorizado();
    error Pausado();
    error ParamInvalido();
    error PagoInsuficiente();
    error PruebaYaUsada();
    error EsperaUpgrade();

    /*───────────── Modificadores ─────────────*/
    modifier soloAdmin() {
        if (!(msg.sender == principal || esOwner[msg.sender] || (address(tarifas) != address(0) && tarifas.esAdmin(msg.sender)))) revert NoAutorizado();
        _;
    }
    modifier vivo() { if (pausado) revert Pausado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    /*───────────── Inicialización ─────────────*/
    function initialize(
        address _principal,
        address _tarifas,
        address _oraculo,
        address _contabilidad,
        address _owner1,
        address _owner2,
        address _usdt
    ) external initializer {
        if (_owner1 == address(0) || _owner2 == address(0) || _oraculo == address(0)) revert ParamInvalido();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        principal = _principal;
        tarifas = ITarifas(_tarifas);
        oraculo = IOraculo(_oraculo);
        contabilidad = IContabilidad(_contabilidad);
        USDT = _usdt;
        owner1 = _owner1; owner2 = _owner2;
        _agregarOwner(_owner1);
        _agregarOwner(_owner2);
        if (_principal != address(0)) _agregarOwner(_principal);

        precioMesUSD  = 2000;    // $20.00
        precioAnioUSD = 10000;   // $100.00
        duracionMes   = 30 days;
        duracionAnio  = 365 days;
        duracionPrueba = 600;    // 10 minutos
        bpsOwner1 = 5000; bpsOwner2 = 5000;   // 50/50
        emit Inicializado(_principal, _owner1, _owner2);
    }

    /*───────────── Lectura de acceso (el corazón del "sin keeper") ─────────────*/
    function tieneAcceso(address wallet) public view returns (bool) {
        if (esOwner[wallet]) return true;                 // owners siempre, gratis
        return accesoHasta[wallet] > block.timestamp;     // se apaga solo al vencer
    }
    function segundosRestantes(address wallet) external view returns (uint256) {
        if (esOwner[wallet]) return type(uint256).max;
        uint40 h = accesoHasta[wallet];
        return h > block.timestamp ? (h - block.timestamp) : 0;
    }

    // precio del plan en wei del token elegido (token=USDT o address(0)=BNB)
    function precioToken(uint8 plan, address token) public view returns (uint256) {
        uint256 usd2 = plan == 1 ? precioAnioUSD : precioMesUSD;   // USD con 2 decimales
        if (token == USDT) {
            // USDT tiene 18 decimales en BSC: usd (2 dec) → 18 dec
            return (usd2 * 1e18) / 100;
        }
        // BNB: usar el oráculo (USD por 1 BNB, 18 dec)
        uint256 pBNB = oraculo.precioUSD(address(0));
        if (pBNB == 0) revert ParamInvalido();
        return (usd2 * 1e18 * 1e18) / (100 * pBNB);
    }

    /*───────────── Comprar acceso (BNB o USDT) ─────────────*/
    // plan: 0 = mensual, 1 = anual. token: USDT o address(0) para BNB (payable).
    function comprarAcceso(uint8 plan, address token) external payable vivo nonReentrant {
        // owners no pagan: acceso permanente
        if (esOwner[msg.sender]) { accesoHasta[msg.sender] = type(uint40).max; emit AccesoComprado(msg.sender, plan, token, 0, type(uint40).max); return; }
        if (plan > 1) revert ParamInvalido();
        uint32 dur = plan == 1 ? duracionAnio : duracionMes;
        uint256 usd2 = plan == 1 ? precioAnioUSD : precioMesUSD;

        uint256 costo = precioToken(plan, token);

        // EFFECTS: fijar la nueva expiración antes de mover fondos
        uint40 base = accesoHasta[msg.sender] > block.timestamp ? accesoHasta[msg.sender] : uint40(block.timestamp);
        uint40 hasta = base + uint40(dur);
        accesoHasta[msg.sender] = hasta;

        // INTERACTIONS: cobrar y repartir 50/50
        if (token == USDT) {
            // mide saldo antes/después (fee-on-transfer)
            uint256 antes = IERC20(USDT).balanceOf(address(this));
            IERC20(USDT).safeTransferFrom(msg.sender, address(this), costo);
            uint256 recibido = IERC20(USDT).balanceOf(address(this)) - antes;
            uint256 aO1 = recibido * bpsOwner1 / 10000;
            uint256 aO2 = recibido - aO1;
            if (aO1 > 0) IERC20(USDT).safeTransfer(owner1, aO1);
            if (aO2 > 0) IERC20(USDT).safeTransfer(owner2, aO2);
        } else {
            if (msg.value < costo) revert PagoInsuficiente();
            uint256 aO1 = costo * bpsOwner1 / 10000;
            uint256 aO2 = costo - aO1;
            _enviarBNB(owner1, aO1);
            _enviarBNB(owner2, aO2);
            if (msg.value > costo) _enviarBNB(msg.sender, msg.value - costo);  // devolver exceso
        }

        // reportar a Contabilidad (100% a owners, 0 a staking)
        if (address(contabilidad) != address(0)) {
            try contabilidad.reportar(msg.sender, SRV, usd2, 0, usd2) {} catch {}
        }
        emit AccesoComprado(msg.sender, plan, token, costo, hasta);
    }

    /*───────────── Prueba gratis 10 min (una vez por wallet) ─────────────*/
    function pruebaGratis() external vivo nonReentrant {
        if (esOwner[msg.sender]) return;                 // owners ya tienen acceso
        if (pruebaUsada[msg.sender]) revert PruebaYaUsada();
        if (accesoHasta[msg.sender] > block.timestamp) revert PruebaYaUsada();  // ya tiene acceso pagado
        pruebaUsada[msg.sender] = true;
        uint40 hasta = uint40(block.timestamp) + duracionPrueba;
        accesoHasta[msg.sender] = hasta;
        emit PruebaUsada(msg.sender, hasta);
    }

    /*───────────── Administración (multi-owner, como WalletShield) ─────────────*/
    function agregarOwner(address nuevo) external soloAdmin { if (nuevo == address(0)) revert ParamInvalido(); _agregarOwner(nuevo); }
    function _agregarOwner(address nuevo) internal { if (!esOwner[nuevo]) { esOwner[nuevo] = true; _owners.push(nuevo); emit OwnerAgregado(nuevo); } }
    function quitarOwner(address quien) external soloAdmin {
        if (!esOwner[quien]) return;
        if (quien == owner1 || quien == owner2) revert ParamInvalido();   // no quitar un owner de pago sin cambiarlo antes
        esOwner[quien] = false;
        for (uint256 i = 0; i < _owners.length; i++) { if (_owners[i] == quien) { _owners[i] = _owners[_owners.length - 1]; _owners.pop(); break; } }
        emit OwnerQuitado(quien);
    }
    function owners() external view returns (address[] memory) { return _owners; }

    // cambiar owner1 u owner2 a otra dirección (lo que el usuario pidió)
    function setOwnersPago(address _o1, address _o2) external soloAdmin {
        if (_o1 == address(0) || _o2 == address(0)) revert ParamInvalido();
        _agregarOwner(_o1); _agregarOwner(_o2);
        owner1 = _o1; owner2 = _o2;
        emit OwnersPagoCambiados(_o1, _o2);
    }

    function setPrecios(uint256 mesUSD2, uint256 anioUSD2) external soloAdmin { if (mesUSD2 == 0 || anioUSD2 == 0) revert ParamInvalido(); precioMesUSD = mesUSD2; precioAnioUSD = anioUSD2; emit Config("precios", mesUSD2, msg.sender); }
    function setDuraciones(uint32 mes, uint32 anio, uint32 prueba) external soloAdmin { if (mes < 1 days || anio < 1 days) revert ParamInvalido(); duracionMes = mes; duracionAnio = anio; duracionPrueba = prueba; emit Config("duraciones", mes, msg.sender); }
    function setReparto(uint16 o1, uint16 o2) external soloAdmin { if (uint256(o1) + o2 != 10000) revert ParamInvalido(); bpsOwner1 = o1; bpsOwner2 = o2; emit Config("reparto", o1, msg.sender); }
    function setContratos(address _tarifas, address _oraculo, address _contab, address _usdt) external soloAdmin {
        if (_tarifas != address(0)) tarifas = ITarifas(_tarifas);
        if (_oraculo != address(0)) oraculo = IOraculo(_oraculo);
        if (_contab  != address(0)) contabilidad = IContabilidad(_contab);
        if (_usdt    != address(0)) USDT = _usdt;
        emit Config("contratos", 0, msg.sender);
    }
    function setPausa(bool v) external soloAdmin { pausado = v; emit Pausa(v); }

    // conceder acceso manual (p.ej. promociones) — solo admin
    function concederAcceso(address wallet, uint40 hasta) external soloAdmin { accesoHasta[wallet] = hasta; }

    /*───────────── BNB helper ─────────────*/
    function _enviarBNB(address a, uint256 v) internal { if (v == 0) return; (bool ok, ) = payable(a).call{value: v}(""); if (!ok) revert ParamInvalido(); }

    /*───────────── Upgrade (UUPS con espera 48h) ─────────────*/
    function proponerUpgrade(address impl) external soloAdmin { propuestaImpl = impl; propuestaEn = uint40(block.timestamp); emit UpgradePropuesto(impl, uint40(block.timestamp)); }
    function _authorizeUpgrade(address impl) internal view override soloAdmin {
        if (impl != propuestaImpl) revert ParamInvalido();
        if (propuestaEn == 0 || block.timestamp < propuestaEn + ESPERA_UPGRADE) revert EsperaUpgrade();
    }

    receive() external payable {}
    uint256[40] private __hueco;
}
