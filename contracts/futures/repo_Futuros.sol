// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*═══════════════════════════════════════════════════════════════════════
  Futuros — motor de posiciones apalancadas con liquidez del Staking.
  ═══════════════════════════════════════════════════════════════════════
  · El trader abre una posición con su margen y un apalancamiento. El motor
    pide al Staking la liquidez que hace falta (margen × apalancamiento).
  · LONG: compra la moneda al entrar; al cerrar la vende. Gana si sube.
  · SHORT: vende la moneda al entrar (la liquidez la pone); al cerrar la
    recompra. Gana si baja.
  · El capital del que aporta liquidez SIEMPRE se devuelve completo. La
    ganancia/pérdida del trader sale del movimiento del mercado.
  · Comisiones abrir/cerrar y funding: 50 % stakers / 50 % plataforma.
  · Liquidación: 75 % repone la liquidez usada; del 25 % restante, 50/50.
  · Apalancamiento máximo PROPORCIONAL a la liquidez disponible (tope 200×).
  · Cierre y conversión a USDT instantáneos. Precio por Oráculo.
  · UUPS + espera 48 h · CEI + no reentrada · owner y % de Tarifas.

  NOTA: este contrato modela el saldo de cada posición en USDT usando el
  precio del Oráculo (mark price). El swap real en PancakeSwap y el keeper
  que dispara liquidaciones se integran en la fase de ejecución; aquí queda
  toda la contabilidad, el préstamo/devolución al Staking y el reparto.
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/utils/SafeERC20.sol";

interface ITarifasFut {
    function esAdmin(address cuenta) external view returns (bool);
    function comisionBps(bytes32 servicio) external view returns (uint16);
}
interface IOraculoFut { function precioUSD(address token) external view returns (uint256); }
interface IStakingFut {
    function prestar(address token, uint256 monto, address a) external;
    function devolver(address token, uint256 monto) external;
    function depositarRecompensa(address token, uint256 monto, uint16 bpsAStakers) external;
    function disponibleParaPrestar(address token) external view returns (uint256);
}

contract Futuros is Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    bytes32 public constant SERVICIO = "futuros";
    uint16  public constant REPARTO_STAKERS = 5000;   // 50 % de lo de Futuros va a stakers
    address public constant USDT = 0x55d398326f99059fF775485246999027B3197955;

    enum Estado { Abierta, Cerrada, Liquidada }

    struct Posicion {
        address trader;
        address token;          // activo (BTCB, WBNB…)
        bool    esLong;
        uint256 margen;         // capital del trader (USDT)
        uint256 tamano;         // margen × apalancamiento (USDT) = liquidez pedida
        uint256 precioEntrada;  // USD 18 dec
        uint256 liq;            // precio de liquidación
        address respaldo;       // USDT (long) o el token (short)
        uint256 montoRespaldo;  // cantidad prestada del respaldo (se devuelve igual)
        uint40  abierta;
        uint40  ultimoFunding;
        Estado  estado;
    }

    ITarifasFut public tarifas;
    IOraculoFut public oraculo;
    IStakingFut public staking;
    address public principal;

    address public propuestaImpl; uint40 public propuestaEn; uint40 public constant ESPERA_UPGRADE = 48 hours;
    bool public pausado;

    uint16 public apalancamientoMax;     // tope global (ej. 200)
    uint16 public margenLiquidacionBps;  // margen de mantenimiento (ej. 75 = 0,75 %)
    uint256 public fundingPeriodo;       // cada cuánto se cobra funding
    uint16  public fundingBps;           // % por periodo

    mapping(uint256 => Posicion) public posiciones;
    uint256 public numPosiciones;
    mapping(address => uint256[]) internal posicionesDe;
    mapping(address => bool) public mercadoActivo;   // tokens operables

    uint256[42] private __gap;

    event Abrir(uint256 indexed id, address indexed trader, address indexed token, bool esLong, uint256 margen, uint256 tamano, uint256 precio);
    event Cerrar(uint256 indexed id, int256 pnl, uint256 comision);
    event Liquidar(uint256 indexed id, uint256 repuesto, uint256 aStakers, uint256 aPlataforma);
    event Funding(uint256 indexed id, uint256 monto);
    event Config(bytes32 indexed clave, uint256 valor, address direccion);
    event UpgradePropuesto(address impl, uint40 ejecutableDesde);

    error NoAutorizado(); error Pausado(); error MontoInvalido(); error Apalancamiento();
    error SinLiquidez(); error MercadoInactivo(); error EstadoInvalido(); error NoLiquidable();
    error Upgrade();

    modifier soloAdmin() { if (!(msg.sender == principal || (address(tarifas) != address(0) && tarifas.esAdmin(msg.sender)))) revert NoAutorizado(); _; }
    modifier activo() { if (pausado) revert Pausado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _principal) external initializer {
        __UUPSUpgradeable_init(); __ReentrancyGuard_init();
        principal = _principal;
        apalancamientoMax = 200;
        margenLiquidacionBps = 75;      // se liquida al perder ~la totalidad del margen
        fundingPeriodo = 8 hours;
        fundingBps = 5;                 // 0,05 % por periodo
    }

    /*──────────────── Config (admin) ────────────────*/
    function setTarifas(address t) external soloAdmin { tarifas = ITarifasFut(t); emit Config("tarifas", 0, t); }
    function setOraculo(address o) external soloAdmin { oraculo = IOraculoFut(o); emit Config("oraculo", 0, o); }
    function setStaking(address s) external soloAdmin { staking = IStakingFut(s); emit Config("staking", 0, s); }
    function setPrincipal(address p) external { if (msg.sender != principal) revert NoAutorizado(); principal = p; emit Config("principal", 0, p); }
    function setApalancamientoMax(uint16 v) external soloAdmin { apalancamientoMax = v; emit Config("apalancMax", v, address(0)); }
    function setMargenLiquidacion(uint16 v) external soloAdmin { margenLiquidacionBps = v; emit Config("margenLiq", v, address(0)); }
    function setFunding(uint256 periodo, uint16 bps) external soloAdmin { fundingPeriodo = periodo; fundingBps = bps; emit Config("funding", bps, address(0)); }
    function setMercado(address token, bool v) external soloAdmin { mercadoActivo[token] = v; emit Config("mercado", v ? 1 : 0, token); }
    function pausar(bool v) external soloAdmin { pausado = v; emit Config("pausa", v ? 1 : 0, address(0)); }

    /*──────────────── Upgrade 48 h ────────────────*/
    function proponerUpgrade(address impl) external soloAdmin { propuestaImpl = impl; propuestaEn = uint40(block.timestamp); emit UpgradePropuesto(impl, uint40(block.timestamp) + ESPERA_UPGRADE); }
    function _authorizeUpgrade(address impl) internal view override soloAdmin {
        if (impl != propuestaImpl || impl == address(0) || block.timestamp < propuestaEn + ESPERA_UPGRADE) revert Upgrade();
    }

    /*──────────────── Apalancamiento proporcional ────────────────*/
    /// Apalancamiento máximo real: el menor entre el tope global y lo que
    /// permita la liquidez disponible frente al margen del trader.
    /// Long se respalda con USDT; short se respalda con el propio token.
    /// El apalancamiento máximo depende de la liquidez de ESA moneda en el stake.
    function apalancamientoDisponible(address token, bool esLong, uint256 margen) public view returns (uint16) {
        if (margen == 0) return 0;
        address respaldo = esLong ? USDT : token;
        // liquidez disponible del respaldo, valorada en USDT para comparar con el margen
        uint256 dispToken = staking.disponibleParaPrestar(respaldo);
        uint256 dispUSD = esLong ? dispToken : (dispToken * oraculo.precioUSD(token) / 1e18);
        uint256 maxPorLiquidez = dispUSD / margen;
        uint256 tope = apalancamientoMax;
        return uint16(maxPorLiquidez < tope ? maxPorLiquidez : tope);
    }

    /*──────────────── Abrir ────────────────*/
    function abrir(address token, bool esLong, uint256 margen, uint16 apalancamiento) external activo nonReentrant returns (uint256 id) {
        if (!mercadoActivo[token]) revert MercadoInactivo();
        if (margen == 0) revert MontoInvalido();
        if (apalancamiento == 0 || apalancamiento > apalancamientoDisponible(token, esLong, margen)) revert Apalancamiento();

        // cobra el margen del trader en USDT
        IERC20(USDT).safeTransferFrom(msg.sender, address(this), margen);

        uint256 tamano = margen * apalancamiento;   // exposición en USDT
        uint16 bps = address(tarifas) != address(0) ? tarifas.comisionBps(SERVICIO) : 4;
        uint256 comision = tamano * bps / 10000;
        _repartir(comision);

        uint256 precio = oraculo.precioUSD(token);
        // Respaldo: LONG usa USDT (se comprará el token). SHORT usa el token
        // (se venderá). La cantidad de respaldo equivale al tamaño en USDT.
        address respaldo = esLong ? USDT : token;
        uint256 montoRespaldo = esLong ? tamano : (tamano * 1e18 / precio);   // token: tamaño/precio
        if (staking.disponibleParaPrestar(respaldo) < montoRespaldo) revert SinLiquidez();
        staking.prestar(respaldo, montoRespaldo, address(this));

        id = ++numPosiciones;
        Posicion storage p = posiciones[id];
        p.trader = msg.sender; p.token = token; p.esLong = esLong;
        p.margen = margen - comision; p.tamano = tamano; p.precioEntrada = precio;
        p.respaldo = respaldo; p.montoRespaldo = montoRespaldo;
        p.abierta = uint40(block.timestamp); p.ultimoFunding = uint40(block.timestamp); p.estado = Estado.Abierta;
        p.liq = _precioLiq(esLong, precio, apalancamiento);
        posicionesDe[msg.sender].push(id);
        emit Abrir(id, msg.sender, token, esLong, margen - comision, tamano, precio);
    }

    /*──────────────── Cerrar ────────────────*/
    function cerrar(uint256 id) external nonReentrant {
        Posicion storage p = posiciones[id];
        if (p.trader != msg.sender) revert NoAutorizado();
        if (p.estado != Estado.Abierta) revert EstadoInvalido();

        uint256 precio = oraculo.precioUSD(p.token);
        int256 pnl = _pnl(p, precio);   // ganancia (+) o pérdida (−) en USDT

        // comisión de cierre 50/50
        uint16 bps = address(tarifas) != address(0) ? tarifas.comisionBps(SERVICIO) : 4;
        uint256 comision = p.tamano * bps / 10000;

        // devuelve el respaldo al Staking, en la MISMA moneda y cantidad que se prestó
        IERC20(p.respaldo).forceApprove(address(staking), p.montoRespaldo);
        staking.devolver(p.respaldo, p.montoRespaldo);

        _repartir(comision);
        // liquida el margen del trader con su PnL
        int256 resultado = int256(p.margen) + pnl - int256(comision);
        uint256 aTrader = resultado > 0 ? uint256(resultado) : 0;
        p.estado = Estado.Cerrada;
        if (aTrader > 0) IERC20(USDT).safeTransfer(p.trader, aTrader);
        emit Cerrar(id, pnl, comision);
    }

    /*──────────────── Liquidar ────────────────*/
    /// Cualquiera (o el keeper) liquida una posición cuyo precio cruzó la liq.
    function liquidar(uint256 id) external nonReentrant {
        Posicion storage p = posiciones[id];
        if (p.estado != Estado.Abierta) revert EstadoInvalido();
        uint256 precio = oraculo.precioUSD(p.token);
        bool liquidable = p.esLong ? precio <= p.liq : precio >= p.liq;
        if (!liquidable) revert NoLiquidable();

        // devuelve el respaldo al Staking en su misma moneda
        IERC20(p.respaldo).forceApprove(address(staking), p.montoRespaldo);
        staking.devolver(p.respaldo, p.montoRespaldo);

        // el margen del trader se pierde: 75 % repone lo usado (ya cubierto al
        // devolver la liquidez), del 25 % restante 50/50 stakers/plataforma.
        uint256 margen = p.margen;
        uint256 restante = margen * 2500 / 10000;   // 25 %
        uint256 aStakers = restante / 2;
        uint256 aPlataforma = restante - aStakers;
        if (aStakers > 0) { IERC20(USDT).forceApprove(address(staking), aStakers); staking.depositarRecompensa(USDT, aStakers, 10000); }
        // el 75 % + la mitad del 25 % queda como colchón/plataforma
        p.estado = Estado.Liquidada;
        emit Liquidar(id, margen - restante, aStakers, aPlataforma);
    }

    /*──────────────── Funding ────────────────*/
    function cobrarFunding(uint256 id) external nonReentrant {
        Posicion storage p = posiciones[id];
        if (p.estado != Estado.Abierta) revert EstadoInvalido();
        if (block.timestamp < p.ultimoFunding + fundingPeriodo) revert EstadoInvalido();
        uint256 periodos = (block.timestamp - p.ultimoFunding) / fundingPeriodo;
        uint256 monto = p.tamano * fundingBps * periodos / 10000;
        if (monto > p.margen) monto = p.margen;
        p.margen -= monto; p.ultimoFunding = uint40(block.timestamp);
        _repartir(monto);
        emit Funding(id, monto);
    }

    /*──────────────── Vistas ────────────────*/
    function posicion(uint256 id) external view returns (Posicion memory) { return posiciones[id]; }
    function posicionesDeUsuario(address a) external view returns (uint256[] memory) { return posicionesDe[a]; }
    function pnlActual(uint256 id) external view returns (int256) {
        Posicion storage p = posiciones[id];
        return _pnl(p, oraculo.precioUSD(p.token));
    }

    /*──────────────── Internas ────────────────*/
    /// PnL en USDT según el movimiento del precio, sobre el tamaño de la posición.
    function _pnl(Posicion storage p, uint256 precio) internal view returns (int256) {
        int256 dif = int256(precio) - int256(p.precioEntrada);
        if (!p.esLong) dif = -dif;
        // pnl = tamaño × (dif / precioEntrada)
        return int256(p.tamano) * dif / int256(p.precioEntrada);
    }
    function _precioLiq(bool esLong, uint256 entrada, uint16 apal) internal pure returns (uint256) {
        // se liquida cuando la pérdida ~= margen: mueve 1/apalancamiento
        uint256 delta = entrada / apal;
        return esLong ? entrada - delta : entrada + delta;
    }
    /// Reparte una comisión: 50 % a stakers (vía Staking), 50 % queda en plataforma.
    function _repartir(uint256 comision) internal {
        if (comision == 0) return;
        uint256 aStakers = comision * REPARTO_STAKERS / 10000;
        if (aStakers > 0 && address(staking) != address(0)) {
            IERC20(USDT).forceApprove(address(staking), aStakers);
            staking.depositarRecompensa(USDT, aStakers, 10000);
        }
    }
    receive() external payable {}
}
