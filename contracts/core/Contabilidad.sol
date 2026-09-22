// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/*═══════════════════════════════════════════════════════════════════════
  Contabilidad — el "contable" central del exchange (privado, solo owners).
  ═══════════════════════════════════════════════════════════════════════
  · Cada servicio (GridBot, MercadoTokens, Futuros, Swap, Academy, PrizePool…)
    le REPORTA su actividad: cuánto generó, de qué wallet, y para el staking.
  · Suma todo: total generado (histórico + por mes), por servicio, ganancia de
    cada owner, total al staking, nº de operaciones, y WALLETS ÚNICAS (cada
    wallet cuenta una sola vez; se marca "registrada" la primera vez).
  · Datos PRIVADOS: solo owners/admins pueden leer los totales.
  · LISTA NEGRA de wallets: los owners pueden bloquear una wallet; los demás
    contratos consultan `bloqueada(wallet)` y rechazan a las bloqueadas.
  · Historial detallado (pagos con hash): NO se guarda en storage (caro). Cada
    reporte EMITE un evento; el panel admin los lee de la cadena con su hash.
  · UUPS (actualizable). Multi-owner vía Tarifas. No custodia dinero: solo cuenta.
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface ITarifasC { function esAdmin(address) external view returns (bool); }

contract Contabilidad is Initializable, UUPSUpgradeable {

    address public owner;
    address public ownerPendiente;
    address public tarifas;

    // Contratos AUTORIZADOS a reportar actividad (GridBot, MercadoTokens, etc.).
    mapping(address => bool) public reportador;

    // ───────── Totales globales ─────────
    uint256 public generadoTotalUSD;   // todo lo que ha generado la plataforma (USD, 18 dec)
    uint256 public aStakingTotalUSD;   // total repartido al staking
    uint256 public aOwnersTotalUSD;    // total repartido a owners
    uint256 public operacionesTotal;   // nº total de operaciones/actividades
    uint256 public walletsUnicas;      // nº de wallets distintas que han interactuado

    // Por servicio (clave = hash del nombre del servicio, ej. keccak("gridbot"))
    mapping(bytes32 => uint256) public generadoPorServicio;
    mapping(bytes32 => uint256) public operacionesPorServicio;

    // Por owner (cuánto se le ha atribuido a cada wallet de owner)
    mapping(address => uint256) public gananciaDeOwner;

    // Por mes (clave = año*100 + mes, ej. 202609). Para "este mes / el pasado".
    mapping(uint256 => uint256) public generadoEnMes;
    mapping(uint256 => uint256) public operacionesEnMes;
    mapping(uint256 => uint256) public walletsNuevasEnMes;

    // Registro de wallets vistas (para contar únicas) y lista negra.
    mapping(address => bool) public vista;       // ¿esta wallet ya se contó?
    mapping(address => uint40) public primeraVez; // timestamp de su primera actividad
    mapping(address => bool) public bloqueada;    // lista negra

    modifier soloOwner() { require(msg.sender == owner || (tarifas != address(0) && ITarifasC(tarifas).esAdmin(msg.sender)), "no owner"); _; }
    modifier soloReportador() { require(reportador[msg.sender], "no autorizado"); _; }

    // Eventos = el historial detallado que lee el panel (con el hash de cada tx).
    event Actividad(address indexed wallet, bytes32 indexed servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD, uint256 mes);
    event PagoStaking(address indexed wallet, address indexed token, uint256 monto, bytes32 indexed servicio);
    event WalletNueva(address indexed wallet, uint40 cuando);
    event WalletBloqueada(address indexed wallet, bool valor);
    event Reportador(address indexed quien, bool valor);
    event OwnerParam(string que, address valor);

    uint256[40] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _tarifas) public initializer {
        owner = msg.sender;
        tarifas = _tarifas;
    }
    function _authorizeUpgrade(address) internal override soloOwner {}

    /* ═══════════ Reporte de actividad (lo llaman los contratos autorizados) ═══════════ */
    /** Un servicio reporta que generó `generadoUSD`, de la `wallet`, repartido en
        `aStakingUSD` (al staking) y `aOwnersUSD` (a owners). `servicio` identifica la fuente. */
    function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external soloReportador {
        uint256 mes = _mesActual();
        // wallet única
        if (wallet != address(0) && !vista[wallet]) {
            vista[wallet] = true; primeraVez[wallet] = uint40(block.timestamp);
            walletsUnicas += 1; walletsNuevasEnMes[mes] += 1;
            emit WalletNueva(wallet, uint40(block.timestamp));
        }
        // totales
        generadoTotalUSD += generadoUSD;
        aStakingTotalUSD += aStakingUSD;
        aOwnersTotalUSD += aOwnersUSD;
        operacionesTotal += 1;
        generadoPorServicio[servicio] += generadoUSD;
        operacionesPorServicio[servicio] += 1;
        generadoEnMes[mes] += generadoUSD;
        operacionesEnMes[mes] += 1;
        emit Actividad(wallet, servicio, generadoUSD, aStakingUSD, aOwnersUSD, mes);
    }

    /** Atribuye ganancia a un owner concreto (para el desglose por owner). */
    function reportarOwner(address ownerWallet, uint256 montoUSD) external soloReportador {
        gananciaDeOwner[ownerWallet] += montoUSD;
    }

    /** Registra un pago del staking a un usuario (emite evento con el token/monto;
        el hash de la tx lo tiene el panel al leer el evento). */
    function reportarPagoStaking(address wallet, address token, uint256 monto, bytes32 servicio) external soloReportador {
        emit PagoStaking(wallet, token, monto, servicio);
    }

    /** Marca una wallet como vista aunque no genere dinero (ej. solo abrió un bot). */
    function tocarWallet(address wallet) external soloReportador {
        if (wallet != address(0) && !vista[wallet]) {
            vista[wallet] = true; primeraVez[wallet] = uint40(block.timestamp);
            walletsUnicas += 1; walletsNuevasEnMes[_mesActual()] += 1;
            emit WalletNueva(wallet, uint40(block.timestamp));
        }
    }

    /* ═══════════ Lista negra de wallets (solo owner) ═══════════ */
    function bloquear(address wallet, bool v) external soloOwner { bloqueada[wallet] = v; emit WalletBloqueada(wallet, v); }
    function bloquearVarias(address[] calldata ws, bool v) external soloOwner { for (uint256 i=0;i<ws.length;i++){ bloqueada[ws[i]]=v; emit WalletBloqueada(ws[i], v);} }

    /* ═══════════ Lecturas (privadas: solo owners) ═══════════ */
    function resumen() external view soloOwner returns (
        uint256 generado, uint256 aStaking, uint256 aOwners, uint256 operaciones, uint256 wallets
    ) {
        return (generadoTotalUSD, aStakingTotalUSD, aOwnersTotalUSD, operacionesTotal, walletsUnicas);
    }
    function verMes(uint256 aaaamm) external view soloOwner returns (uint256 generado, uint256 operaciones, uint256 walletsNuevas) {
        return (generadoEnMes[aaaamm], operacionesEnMes[aaaamm], walletsNuevasEnMes[aaaamm]);
    }
    function verServicio(bytes32 s) external view soloOwner returns (uint256 generado, uint256 operaciones) {
        return (generadoPorServicio[s], operacionesPorServicio[s]);
    }
    function mesActual() external view returns (uint256) { return _mesActual(); }

    /* ═══════════ Admin ═══════════ */
    function setReportador(address quien, bool v) external soloOwner { reportador[quien] = v; emit Reportador(quien, v); }
    function setReportadores(address[] calldata qs, bool v) external soloOwner { for (uint256 i=0;i<qs.length;i++){ reportador[qs[i]]=v; emit Reportador(qs[i], v);} }
    function setTarifas(address a) external soloOwner { tarifas = a; emit OwnerParam("tarifas", a); }
    function transferirOwner(address n) external soloOwner { require(n != address(0)); ownerPendiente = n; }
    function aceptarOwner() external { require(msg.sender == ownerPendiente); owner = ownerPendiente; ownerPendiente = address(0); emit OwnerParam("owner", owner); }

    /* ═══════════ Utilidad: mes actual (aaaamm) ═══════════ */
    function _mesActual() internal view returns (uint256) {
        // cálculo de año y mes desde el timestamp (algoritmo civil, sin librería).
        uint256 z = block.timestamp / 86400 + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe/1460 + doe/36524 - doe/146096) / 365;
        uint256 y = yoe + era * 400;
        uint256 doy = doe - (365*yoe + yoe/4 - yoe/100);
        uint256 mp = (5*doy + 2)/153;
        uint256 m = mp < 10 ? mp + 3 : mp - 9;
        if (m <= 2) y += 1;
        return y * 100 + m;
    }
}
