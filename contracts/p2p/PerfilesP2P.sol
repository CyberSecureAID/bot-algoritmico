// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*═══════════════════════════════════════════════════════════════════════
  PerfilesP2P — identidad pública, reputación y confianza del Marketplace.
  ═══════════════════════════════════════════════════════════════════════
  · Perfil y contacto (Telegram, WhatsApp, teléfono, horario, instrucciones,
    país y ciudad). Foto y nombre de Pro viven fuera de cadena (Firebase).
  · Calificaciones 1–5 con comentario (hash) solo entre las dos partes de
    una orden completada o resuelta; una por orden y por sentido.
  · Badge "verificado" que marca el admin.
  · Estadísticas: completadas, canceladas, disputas perdidas, tiempo medio
    de liberación, antigüedad.
  · Baneo automático (2 disputas perdidas), pausa por cancelaciones
    repetidas, límite de órdenes simultáneas que crece con la reputación.
  · El escrow (MercadoP2P) es el único que puede registrar eventos.
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/UUPSUpgradeable.sol";

interface IMercado { function puedeCalificar(uint256 id, address quien, address aQuien) external view returns (bool); }

interface ITarifas {
    function comisionBps(bytes32 servicio) external view returns (uint16);
    function bpsDe(bytes32 servicio, address cuenta) external view returns (uint16);
    function calcular(bytes32 servicio, address cuenta, address token, uint256 bruto, uint16 descuentoBps) external view returns (uint256);
    function aplicarCodigo(bytes32 hash, address usuario, bytes32 servicio) external returns (uint16);
    function esExento(address cuenta) external view returns (bool);
    function esAdmin(address cuenta) external view returns (bool);
}

contract PerfilesP2P is Initializable, UUPSUpgradeable {
    struct Perfil { string telegram; string whatsapp; string telefono; string horario; string instrucciones; string pais; string ciudad; }
    struct Stats {
        uint32 completadas; uint32 canceladas; uint32 disputasPerdidas; uint32 tramosLiberados;
        uint64 tiempoLiberar; uint40 primeraVez; uint32 ordenesAbiertas;
        uint32 sumaEstrellas; uint32 numCalificaciones;
    }
    struct Calificacion { address de; uint8 estrellas; bytes32 comentario; uint40 cuando; }

    address public principal;
    ITarifas public tarifas;            // esAdmin() central; si es 0, solo principal
    IMercado public mercado;            // único que puede registrar
    address public propuestaImpl; uint40 public propuestaEn; uint40 public constant ESPERA_UPGRADE = 48 hours;

    uint40 public pausaCancel;          // duración de la pausa tras cancelar 3 veces en 24 h
    uint32 public diasBan;
    uint32 public maxOrdenesTope;

    mapping(address => Perfil) internal perfiles;
    mapping(address => Stats)  public stats;
    mapping(address => bool)   public verificado;
    mapping(address => uint40) public banHasta;
    mapping(address => uint40) public pausaHasta;
    mapping(address => uint32) public cancelaciones24h;
    mapping(address => uint40) public ventanaCancel;
    mapping(address => Calificacion[]) internal calificacionesDe;              // recibidas
    mapping(uint256 => mapping(address => bool)) public calificoEnOrden;        // orden => quien => ya calificó
    uint256 public usuariosTotal;

    uint256[40] private __gap;

    event PerfilActualizado(address indexed cuenta);
    event Calificado(address indexed a, address indexed por, uint256 indexed orden, uint8 estrellas, bytes32 comentario);
    event Verificado(address indexed cuenta, bool valor);
    event Ban(address indexed cuenta, uint40 hasta);
    event PausaCancel(address indexed cuenta, uint40 hasta);
    event Config(bytes32 indexed clave, uint256 valor, address direccion);
    event UpgradePropuesto(address impl, uint40 ejecutableDesde);

    error NoAutorizado(); error Limite(); error Upgrade(); error YaCalifico(); error NoPermitido();

    modifier soloAdmin() { if (!esAdmin(msg.sender)) revert NoAutorizado(); _; }
    modifier soloMercado() { if (msg.sender != address(mercado)) revert NoAutorizado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _principal) external initializer {
        __UUPSUpgradeable_init();
        principal = _principal;
        pausaCancel = 6 hours; diasBan = 15; maxOrdenesTope = 10;
    }

    function esAdmin(address a) public view returns (bool) {
        return a == principal || (address(tarifas) != address(0) && tarifas.esAdmin(a));
    }
    function setTarifas(address t) external soloAdmin { tarifas = ITarifas(t); emit Config("tarifas", 0, t); }
    function setMercado(address m) external soloAdmin { mercado = IMercado(m); emit Config("mercado", 0, m); }
    function setPrincipal(address p) external { if (msg.sender != principal) revert NoAutorizado(); principal = p; emit Config("principal", 0, p); }
    function setReglas(uint40 _pausaCancel, uint32 _diasBan, uint32 _tope) external soloAdmin { pausaCancel = _pausaCancel; diasBan = _diasBan; maxOrdenesTope = _tope; emit Config("reglas", _diasBan, address(0)); }
    function setVerificado(address a, bool v) external soloAdmin { verificado[a] = v; emit Verificado(a, v); }
    function levantarBan(address a) external soloAdmin { banHasta[a] = 0; pausaHasta[a] = 0; emit Ban(a, 0); }

    function proponerUpgrade(address impl) external soloAdmin { propuestaImpl = impl; propuestaEn = uint40(block.timestamp); emit UpgradePropuesto(impl, uint40(block.timestamp) + ESPERA_UPGRADE); }
    function _authorizeUpgrade(address impl) internal view override soloAdmin {
        if (impl != propuestaImpl || impl == address(0) || block.timestamp < propuestaEn + ESPERA_UPGRADE) revert Upgrade();
    }

    /*──── Perfil ────*/
    function setPerfil(Perfil calldata p) external { perfiles[msg.sender] = p; emit PerfilActualizado(msg.sender); }
    function perfil(address a) external view returns (Perfil memory) { return perfiles[a]; }

    /*──── Calificaciones ────*/
    function calificar(uint256 orden, address aQuien, uint8 estrellas, bytes32 comentario) external {
        if (estrellas < 1 || estrellas > 5) revert Limite();
        if (address(mercado) == address(0) || !mercado.puedeCalificar(orden, msg.sender, aQuien)) revert NoPermitido();
        if (calificoEnOrden[orden][msg.sender]) revert YaCalifico();
        calificoEnOrden[orden][msg.sender] = true;
        calificacionesDe[aQuien].push(Calificacion(msg.sender, estrellas, comentario, uint40(block.timestamp)));
        Stats storage s = stats[aQuien]; s.sumaEstrellas += estrellas; s.numCalificaciones++;
        emit Calificado(aQuien, msg.sender, orden, estrellas, comentario);
    }
    function calificaciones(address a, uint256 desde, uint256 cuantas) external view returns (Calificacion[] memory r) {
        Calificacion[] storage all = calificacionesDe[a];
        uint256 n = all.length; if (desde >= n) return r;
        uint256 fin = desde + cuantas > n ? n : desde + cuantas;
        r = new Calificacion[](fin - desde);
        for (uint256 i = desde; i < fin; i++) r[i - desde] = all[i];
    }
    /// Media de estrellas ×100 (450 = 4,50).
    function mediaEstrellas(address a) external view returns (uint256) {
        Stats storage s = stats[a]; return s.numCalificaciones == 0 ? 0 : uint256(s.sumaEstrellas) * 100 / s.numCalificaciones;
    }

    /*──── Reputación (solo el escrow escribe) ────*/
    function registrar(address a, uint8 ev, uint64 dato) external soloMercado {
        Stats storage s = stats[a];
        if (ev == 0) { if (s.primeraVez == 0) { s.primeraVez = uint40(block.timestamp); usuariosTotal++; } }
        else if (ev == 1) s.completadas++;
        else if (ev == 2) _cancelacion(a, s);
        else if (ev == 3) { s.disputasPerdidas++; if (s.disputasPerdidas % 2 == 0) { banHasta[a] = uint40(block.timestamp) + uint40(diasBan) * 1 days; emit Ban(a, banHasta[a]); } }
        else if (ev == 4) { s.tiempoLiberar += dato; s.tramosLiberados++; }
        else if (ev == 5) s.ordenesAbiertas++;
        else if (ev == 6) { if (s.ordenesAbiertas > 0) s.ordenesAbiertas--; }
    }
    function _cancelacion(address a, Stats storage s) internal {
        s.canceladas++;
        if (block.timestamp > ventanaCancel[a] + 24 hours) { ventanaCancel[a] = uint40(block.timestamp); cancelaciones24h[a] = 0; }
        cancelaciones24h[a]++;
        if (cancelaciones24h[a] >= 3) { pausaHasta[a] = uint40(block.timestamp) + pausaCancel; cancelaciones24h[a] = 0; emit PausaCancel(a, pausaHasta[a]); }
    }

    /*──── Consultas del escrow y del front ────*/
    function puedeOperar(address a) external view returns (bool) { return banHasta[a] <= block.timestamp && pausaHasta[a] <= block.timestamp; }
    function completadas(address a) external view returns (uint32) { return stats[a].completadas; }
    function ordenesAbiertas(address a) external view returns (uint32) { return stats[a].ordenesAbiertas; }
    /// 1 al empezar, +1 cada 3 completadas, hasta el tope.
    function maxOrdenesAbiertas(address a) external view returns (uint32) { uint32 n = 1 + stats[a].completadas / 3; return n > maxOrdenesTope ? maxOrdenesTope : n; }
    function velocidadLiberacion(address a) external view returns (uint64) { Stats storage s = stats[a]; return s.tramosLiberados == 0 ? 0 : s.tiempoLiberar / s.tramosLiberados; }
    /// Completadas frente a completadas + canceladas, en % ×100.
    function tasaFinalizacion(address a) external view returns (uint256) { Stats storage s = stats[a]; uint256 t = uint256(s.completadas) + s.canceladas; return t == 0 ? 0 : uint256(s.completadas) * 10000 / t; }
}
