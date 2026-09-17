// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*═══════════════════════════════════════════════════════════════════════
  MercadoP2P — escrow entre personas, sin custodia de la plataforma.
  ═══════════════════════════════════════════════════════════════════════
  · El vendedor deposita lo que vende en un ANUNCIO (con stock). Varios
    compradores pueden tomar partes (cada uno abre su ORDEN).
  · Cada orden se libera por TRAMOS: el comprador paga fuera de cadena,
    marca pagado (con referencia rastreable), el vendedor libera ese tramo.
  · Comisión en la moneda vendida, leída de Tarifas (o local), con
    descuentos (código promocional, Pro 50 %, exentos) y referidos (25 %).
  · Disputas con árbitro aleatorio, resolución parcial y reasignación.
  · Multi-owner (principal + directores), pausa de emergencia, retirada de
    emergencia, actualizaciones con espera de 48 h (UUPS).
  · Cualquier BEP-20 (token != 0) o BNB nativo (token == 0).
  · Anuncios "libres" (personalizado): sin escrow ni comisión, solo publican
    y conectan.
  Los perfiles, calificaciones y badges viven en PerfilesP2P (contrato aparte).
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/utils/SafeERC20.sol";

interface ITarifas {
    function comisionBps(bytes32 servicio) external view returns (uint16);
    function bpsDe(bytes32 servicio, address cuenta) external view returns (uint16);
    function calcular(bytes32 servicio, address cuenta, address token, uint256 bruto, uint16 descuentoBps) external view returns (uint256);
    function aplicarCodigo(bytes32 hash, address usuario, bytes32 servicio) external returns (uint16);
    function esExento(address cuenta) external view returns (bool);
    function esAdmin(address cuenta) external view returns (bool);
}
interface IPerfiles {
    function puedeOperar(address a) external view returns (bool);          // sin ban ni pausa
    function completadas(address a) external view returns (uint32);
    function maxOrdenesAbiertas(address a) external view returns (uint32);
    function ordenesAbiertas(address a) external view returns (uint32);
    /// evento: 0 primeraVez · 1 completada · 2 cancelada · 3 perdióDisputa · 4 tramoLiberado (dato = segundos) · 5 orden+ · 6 orden-
    function registrar(address a, uint8 evento, uint64 dato) external;
}

contract MercadoP2P is Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    /*──────────────── Tipos ────────────────*/
    enum Estado { Abierta, Pagada, Disputa, Completada, Cancelada, Resuelta }

    struct Anuncio {
        address vendedor;
        address token;          // address(0) = BNB nativo
        uint256 disponible;     // stock aún no tomado (en escrow)
        uint256 minOrden;
        uint256 maxOrden;
        uint256 precioFiat;     // precio por unidad, 2 decimales (ej. 3650 = 36.50)
        uint32  minCompletadas; // requisito para tomar
        uint8   tramosDefecto;
        bool    libre;          // personalizado: sin escrow
        bool    pausado;
        bool    soloPro;
        address privadoPara;    // solo esta wallet puede tomar (0 = cualquiera)
        string  fiat;           // "USD", "CUP", "MXN", "otra…"
        string  metodo;         // "Transferencia", "Efectivo", …
        string  queVendo;       // solo en anuncios libres
    }

    struct Orden {
        uint256 idAnuncio;
        address vendedor;
        address comprador;
        address token;
        uint256 monto;          // total de la orden
        uint256 liberado;       // ya entregado al comprador
        uint256[] tramos;       // tamaños (suman monto)
        uint8   tramoActual;
        Estado  estado;
        uint40  limite;         // fecha límite del estado actual
        uint40  pagadoEn;       // cuándo se marcó pagado el tramo actual
        uint16  descuentoBps;   // del código promocional
        address arbitro;
        uint40  disputaEn;
    }

    struct Comprobante { bytes32 hash; uint40 cuando; }   // la referencia va en el evento TramoPagado
    struct StatsArbitro { uint32 resueltas; uint64 tiempoAcumulado; }

    /*──────────────── Estado ────────────────*/
    address public principal;           // owner local de arranque; los directores se gestionan en Tarifas

    address public propuestaImpl;
    uint40  public propuestaEn;
    uint40  public constant ESPERA_UPGRADE = 48 hours;

    bool    public pausado;
    uint40  public pausadoDesde;
    uint32  public diasEmergencia;      // días de pausa para permitir retiro de emergencia

    ITarifas public tarifas;            // si es 0, se usa comisionBpsLocal sin descuentos
    IPerfiles public perfiles;          // si es 0, sin límites de reputación
    uint16   public comisionBpsLocal;
    uint16   public porcentajePadrinoBps;
    bytes32  public constant SERVICIO = "p2p";
    mapping(address => uint256) public custodiado;                          // token => en escrow de usuarios
    mapping(address => uint256) public referidosPendientes;                 // token => saldo de padrinos sin cobrar
    mapping(address => uint256) public comisionesAcumuladas;               // token => monto
    mapping(address => mapping(address => uint256)) public saldoReferido;  // padrino => token => monto
    mapping(address => address) public padrino;


    uint40 public tPagar;      // segundos para que el comprador marque pagado
    uint40 public tLiberar;    // segundos para que el vendedor libere tras el pago
    uint40 public tDisputa;    // segundos para que el árbitro actúe

    mapping(address => bool) public tokenVetado;
    mapping(address => bool) public bloqueado;                       // por el owner
    mapping(address => mapping(address => bool)) public bloqueoUsuario; // a bloquea a b

    address[] public arbitros;
    mapping(address => bool) public esArbitro;
    mapping(address => StatsArbitro) public statsArbitro;

    uint256 public numAnuncios;
    uint256 public numOrdenes;
    mapping(uint256 => Anuncio) internal anuncios;
    mapping(uint256 => Orden)   internal ordenes;
    mapping(uint256 => mapping(uint8 => Comprobante)) public comprobantes;   // orden => tramo
    mapping(uint256 => mapping(address => bytes32)) public acuerdo;          // orden => parte => hash
    mapping(address => uint256[]) internal ordenesDe;
    mapping(address => uint256[]) internal anunciosDe;

    mapping(address => uint256) public volumenToken;
    uint256 public ordenesCompletadasTotal;

    bytes32 public versionDisclaimer;
    mapping(address => bytes32) public aceptoDisclaimer;

    uint256[40] private __gap;

    /*──────────────── Eventos ────────────────*/
    event AnuncioCreado(uint256 indexed id, address indexed vendedor, address indexed token, uint256 monto, bool libre);
    event AnuncioActualizado(uint256 indexed id, uint256 disponible, bool pausado);
    event OrdenCreada(uint256 indexed id, uint256 indexed idAnuncio, address indexed comprador, address vendedor, uint256 monto, uint8 tramos);
    event TramoPagado(uint256 indexed id, uint8 tramo, address indexed comprador, bytes32 hash, string referencia);
    event TramoLiberado(uint256 indexed id, uint8 tramo, uint256 neto, uint256 comision);
    event OrdenCompletada(uint256 indexed id, address indexed vendedor, address indexed comprador, uint256 monto);
    event OrdenCancelada(uint256 indexed id, address indexed por, uint8 motivo); // 0 vendedor,1 comprador,2 tiempo,3 emergencia
    event DisputaAbierta(uint256 indexed id, address indexed por, address arbitro);
    event DisputaResuelta(uint256 indexed id, address indexed arbitro, uint16 bpsAlComprador, string motivo);
    event ArbitroReasignado(uint256 indexed id, address nuevo);
    event AcuerdoSellado(uint256 indexed id, address indexed parte, bytes32 hash);
    event ComisionRepartida(uint256 indexed id, address indexed token, uint256 plataforma, address indexed padrino, uint256 aPadrino);
    event PadrinoRegistrado(address indexed ahijado, address indexed padrino);
    event Config(bytes32 indexed clave, uint256 valor, address direccion);
    event Pausa(bool activa);
    event UpgradePropuesto(address impl, uint40 ejecutableDesde);
    event DisclaimerVersion(bytes32 hash);
    event DisclaimerAceptado(address indexed cuenta, bytes32 hash);

    /*──────────────── Errores ────────────────*/
    error NoAutorizado();
    error Pausado();
    error EstadoInvalido();
    error MontoInvalido();
    error TokenVetado();
    error Bloqueado();
    error Baneado();
    error Requisitos();
    error Disclaimer();
    error Tiempo();
    error Tramos();
    error NoArbitros();
    error Upgrade();
    error Limite();
    error Transferencia();

    /*──────────────── Modificadores ────────────────*/
    modifier soloOwner() { if (!esOwner(msg.sender)) revert NoAutorizado(); _; }
    modifier soloPrincipal() { if (msg.sender != principal) revert NoAutorizado(); _; }
    modifier activo() { if (pausado) revert Pausado(); _; }
    modifier puedeOperar() {
        if (bloqueado[msg.sender]) revert Bloqueado();
        if (address(perfiles) != address(0) && !perfiles.puedeOperar(msg.sender)) revert Baneado();
        if (versionDisclaimer != bytes32(0) && aceptoDisclaimer[msg.sender] != versionDisclaimer) revert Disclaimer();
        _;
    }

    /*──────────────── Inicialización ────────────────*/
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _principal) external initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        principal = _principal;
        comisionBpsLocal = 30;        // 0,30 %
        porcentajePadrinoBps = 2500;  // 25 % de la comisión al padrino
        tPagar = 30 minutes;
        tLiberar = 24 hours;
        tDisputa = 3 days;
        diasEmergencia = 7;
    }

    /*──────────────── Owner: el principal local o cualquier admin de Tarifas ────────────────*/
    function esOwner(address a) public view returns (bool) { return a == principal || (address(tarifas) != address(0) && tarifas.esAdmin(a)); }
    function setPrincipal(address p) external soloPrincipal { principal = p; emit Config("principal", 0, p); }

    /*──────────────── Upgrade con espera de 48 h ────────────────*/
    function proponerUpgrade(address impl) external soloOwner {
        propuestaImpl = impl; propuestaEn = uint40(block.timestamp);
        emit UpgradePropuesto(impl, uint40(block.timestamp) + ESPERA_UPGRADE);
    }
    function _authorizeUpgrade(address impl) internal view override soloOwner {
        if (impl != propuestaImpl || propuestaImpl == address(0) || block.timestamp < propuestaEn + ESPERA_UPGRADE) revert Upgrade();
    }

    /*──────────────── Configuración (owner) ────────────────*/
    function setTarifas(address t) external soloOwner { tarifas = ITarifas(t); emit Config("tarifas", 0, t); }
    function setPerfiles(address p) external soloOwner { perfiles = IPerfiles(p); emit Config("perfiles", 0, p); }
    function setComisionLocal(uint16 bps) external soloOwner { if (bps > 1000) revert Limite(); comisionBpsLocal = bps; emit Config("comisionBps", bps, address(0)); }
    function setPorcentajePadrino(uint16 bps) external soloOwner { if (bps > 5000) revert Limite(); porcentajePadrinoBps = bps; emit Config("padrinoBps", bps, address(0)); }
    function setTiempos(uint40 _pagar, uint40 _liberar, uint40 _disputa, uint32 _diasEmergencia) external soloOwner {
        tPagar = _pagar; tLiberar = _liberar; tDisputa = _disputa; diasEmergencia = _diasEmergencia;
        emit Config("tiempos", _pagar, address(0));
    }
    function vetarToken(address t, bool v) external soloOwner { tokenVetado[t] = v; emit Config("tokenVetado", v ? 1 : 0, t); }
    function bloquearWallet(address a, bool v) external soloOwner { bloqueado[a] = v; emit Config("bloqueada", v ? 1 : 0, a); }
    function setArbitro(address a, bool v) external soloOwner {
        if (v && !esArbitro[a]) { esArbitro[a] = true; arbitros.push(a); }
        else if (!v && esArbitro[a]) {
            esArbitro[a] = false;
            uint256 n = arbitros.length;
            for (uint256 i = 0; i < n; i++) if (arbitros[i] == a) { arbitros[i] = arbitros[n - 1]; arbitros.pop(); break; }
        }
        emit Config("arbitro", v ? 1 : 0, a);
    }
    function setDisclaimer(bytes32 hash) external soloOwner { versionDisclaimer = hash; emit DisclaimerVersion(hash); }
    function pausar(bool v) external soloOwner {
        pausado = v; pausadoDesde = v ? uint40(block.timestamp) : 0;
        emit Pausa(v);
    }
    function retirarComisiones(address token, address a) external soloOwner nonReentrant {
        uint256 m = comisionesAcumuladas[token]; comisionesAcumuladas[token] = 0;
        _enviar(token, a, m);
    }
    /// Rescata SOLO lo enviado por error: nunca el escrow de usuarios, ni comisiones, ni saldos de padrinos.
    function rescatable(address token) public view returns (uint256) {
        uint256 bal = token == address(0) ? address(this).balance : IERC20(token).balanceOf(address(this));
        uint256 reservado = custodiado[token] + comisionesAcumuladas[token] + referidosPendientes[token];
        return bal > reservado ? bal - reservado : 0;
    }
    function rescatar(address token, address a, uint256 monto) external soloOwner nonReentrant {
        if (monto > rescatable(token)) revert Limite();
        _enviar(token, a, monto);
    }

    /*──────────────── Usuario: disclaimer, padrino, bloqueos, código ────────────────*/
    function aceptarDisclaimer() external { aceptoDisclaimer[msg.sender] = versionDisclaimer; emit DisclaimerAceptado(msg.sender, versionDisclaimer); }
    function registrarPadrino(address p) external {
        if (padrino[msg.sender] != address(0) || p == msg.sender || p == address(0)) revert Limite();
        padrino[msg.sender] = p; emit PadrinoRegistrado(msg.sender, p);
    }
    function bloquearUsuario(address a, bool v) external { bloqueoUsuario[msg.sender][a] = v; }

    /*──────────────── Anuncios ────────────────*/
    struct ParamsAnuncio {
        address token; uint256 monto; uint256 minOrden; uint256 maxOrden; uint256 precioFiat;
        uint8 tramosDefecto; string fiat; string metodo; uint32 minCompletadas; bool soloPro; address privadoPara;
    }

    function crearAnuncio(ParamsAnuncio calldata p) external payable activo puedeOperar nonReentrant returns (uint256 id) {
        _validar(p);
        _recibir(p.token, p.monto);
        id = _guardarAnuncio(p);
    }

    function _validar(ParamsAnuncio calldata p) internal view {
        if (tokenVetado[p.token]) revert TokenVetado();
        if (p.monto == 0 || p.minOrden == 0 || p.maxOrden < p.minOrden || p.maxOrden > p.monto) revert MontoInvalido();
        if (p.tramosDefecto == 0 || p.tramosDefecto > 10) revert Tramos();
    }
    function _guardarAnuncio(ParamsAnuncio calldata p) internal returns (uint256 id) {
        id = ++numAnuncios;
        Anuncio storage a = anuncios[id];
        a.vendedor = msg.sender; a.token = p.token; a.disponible = p.monto; a.minOrden = p.minOrden; a.maxOrden = p.maxOrden;
        a.precioFiat = p.precioFiat; a.tramosDefecto = p.tramosDefecto; a.fiat = p.fiat; a.metodo = p.metodo;
        a.minCompletadas = p.minCompletadas; a.soloPro = p.soloPro; a.privadoPara = p.privadoPara;
        anunciosDe[msg.sender].push(id);
        _primeraVez(msg.sender);
        emit AnuncioCreado(id, msg.sender, p.token, p.monto, false);
    }

    function pausarAnuncio(uint256 id, bool v) external {
        Anuncio storage a = anuncios[id];
        if (a.vendedor != msg.sender) revert NoAutorizado();
        a.pausado = v; emit AnuncioActualizado(id, a.disponible, v);
    }
    function agregarStock(uint256 id, uint256 monto) external payable activo puedeOperar nonReentrant {
        Anuncio storage a = anuncios[id];
        if (a.vendedor != msg.sender || a.libre) revert NoAutorizado();
        _recibir(a.token, monto);
        a.disponible += monto; emit AnuncioActualizado(id, a.disponible, a.pausado);
    }
    function retirarStock(uint256 id, uint256 monto) external nonReentrant {
        Anuncio storage a = anuncios[id];
        if (a.vendedor != msg.sender) revert NoAutorizado();
        if (monto > a.disponible) revert MontoInvalido();
        a.disponible -= monto;
        if (!a.libre) _pagarDeEscrow(a.token, msg.sender, monto);
        emit AnuncioActualizado(id, a.disponible, a.pausado);
    }

    /*──────────────── Órdenes ────────────────*/
    /// Toma una parte del anuncio. `tramos` vacío = partes iguales según tramosDefecto.
    function tomarAnuncio(uint256 idAnuncio, uint256 monto, uint256[] calldata tramos, bytes32 codigo)
        external activo puedeOperar nonReentrant returns (uint256 id)
    {
        Anuncio storage a = anuncios[idAnuncio];
        if (a.vendedor == address(0) || a.pausado || a.libre) revert EstadoInvalido();
        if (a.vendedor == msg.sender) revert NoAutorizado();
        if (bloqueoUsuario[a.vendedor][msg.sender] || bloqueoUsuario[msg.sender][a.vendedor]) revert Bloqueado();
        if (a.privadoPara != address(0) && a.privadoPara != msg.sender) revert NoAutorizado();
        if (monto < a.minOrden || monto > a.maxOrden || monto > a.disponible) revert MontoInvalido();
        if (a.soloPro && !_esPro(msg.sender)) revert Requisitos();
        if (address(perfiles) != address(0)) {
            if (a.minCompletadas > 0 && perfiles.completadas(msg.sender) < a.minCompletadas) revert Requisitos();
            if (perfiles.ordenesAbiertas(msg.sender) >= perfiles.maxOrdenesAbiertas(msg.sender)) revert Limite();
        }

        a.disponible -= monto;
        id = ++numOrdenes;
        Orden storage o = ordenes[id];
        o.idAnuncio = idAnuncio; o.vendedor = a.vendedor; o.comprador = msg.sender; o.token = a.token; o.monto = monto;
        o.estado = Estado.Abierta; o.limite = uint40(block.timestamp) + tPagar;
        o.tramos = _tramos(monto, tramos, a.tramosDefecto);
        o.descuentoBps = _aplicarCodigo(codigo);

        ordenesDe[msg.sender].push(id); ordenesDe[a.vendedor].push(id);
        _reg(msg.sender, 5, 0);
        _primeraVez(msg.sender);
        emit AnuncioActualizado(idAnuncio, a.disponible, a.pausado);
        emit OrdenCreada(id, idAnuncio, msg.sender, a.vendedor, monto, uint8(o.tramos.length));
    }

    /// El comprador marca pagado el tramo actual, con comprobante rastreable.
    function marcarPagado(uint256 id, bytes32 hashComprobante, string calldata referencia) external {
        Orden storage o = ordenes[id];
        if (o.comprador != msg.sender) revert NoAutorizado();
        if (o.estado != Estado.Abierta) revert EstadoInvalido();
        o.estado = Estado.Pagada; o.pagadoEn = uint40(block.timestamp); o.limite = uint40(block.timestamp) + tLiberar;
        comprobantes[id][o.tramoActual] = Comprobante(hashComprobante, uint40(block.timestamp));
        emit TramoPagado(id, o.tramoActual, msg.sender, hashComprobante, referencia);
    }

    /// El vendedor libera el tramo actual (menos comisión). Si es el último, la orden se completa.
    function liberar(uint256 id) external nonReentrant {
        Orden storage o = ordenes[id];
        if (o.vendedor != msg.sender) revert NoAutorizado();
        if (o.estado != Estado.Pagada) revert EstadoInvalido();
        uint8 tramo = o.tramoActual;
        uint256 bruto = o.tramos[tramo];
        (uint256 comision, uint256 aPadrino, address p) = _comision(o, bruto);
        uint256 neto = bruto - comision;
        // efectos
        o.liberado += bruto;
        custodiado[o.token] -= bruto;
        if (comision > 0) {
            comisionesAcumuladas[o.token] += comision - aPadrino;
            if (aPadrino > 0) { saldoReferido[p][o.token] += aPadrino; referidosPendientes[o.token] += aPadrino; }
            emit ComisionRepartida(id, o.token, comision - aPadrino, p, aPadrino);
        }
        _reg(msg.sender, 4, uint64(block.timestamp - o.pagadoEn));
        bool ultimo = tramo + 1 == o.tramos.length;
        if (ultimo) { o.estado = Estado.Completada; o.limite = 0; _completar(o, id); }
        else { o.tramoActual = tramo + 1; o.estado = Estado.Abierta; o.limite = uint40(block.timestamp) + tPagar; }
        emit TramoLiberado(id, tramo, neto, comision);
        // interacción
        _enviar(o.token, o.comprador, neto);
    }

    /// El comprador se retira sin penalización mientras no haya marcado pagado ningún tramo.
    function desistir(uint256 id) external nonReentrant {
        Orden storage o = ordenes[id];
        if (o.comprador != msg.sender) revert NoAutorizado();
        if (o.estado != Estado.Abierta || o.tramoActual != 0) revert EstadoInvalido();
        _cancelar(o, id, 1);
    }
    /// El vendedor cancela solo si el comprador aún no pagó nada.
    function cancelarVendedor(uint256 id) external nonReentrant {
        Orden storage o = ordenes[id];
        if (o.vendedor != msg.sender) revert NoAutorizado();
        if (o.estado != Estado.Abierta || o.tramoActual != 0) revert EstadoInvalido();
        _cancelar(o, id, 0);
    }
    /// Cualquiera: si el comprador no marcó pagado a tiempo (tramo 0), la orden cae.
    function cancelarPorTiempo(uint256 id) external nonReentrant {
        Orden storage o = ordenes[id];
        if (o.estado != Estado.Abierta || block.timestamp <= o.limite) revert Tiempo();
        _cancelar(o, id, 2);
    }
    /// Retirada de emergencia: si el contrato lleva pausado más de diasEmergencia, el vendedor recupera lo no liberado.
    /// Retirada de emergencia (cualquiera de las dos partes): si el contrato lleva pausado más de
    /// diasEmergencia. Abierta: todo lo no liberado vuelve al vendedor. Pagada/Disputa: el tramo que el
    /// comprador marcó pagado va al comprador y el resto al vendedor.
    function retiroEmergencia(uint256 id) external nonReentrant {
        if (!pausado || block.timestamp < pausadoDesde + uint256(diasEmergencia) * 1 days) revert Tiempo();
        Orden storage o = ordenes[id];
        if (msg.sender != o.vendedor && msg.sender != o.comprador) revert NoAutorizado();
        if (o.estado == Estado.Completada || o.estado == Estado.Cancelada || o.estado == Estado.Resuelta) revert EstadoInvalido();
        uint256 resto = o.monto - o.liberado;
        uint256 aComprador = (o.estado == Estado.Abierta) ? 0 : o.tramos[o.tramoActual];
        if (aComprador > resto) aComprador = resto;
        o.estado = Estado.Cancelada; o.liberado = o.monto; o.limite = 0;
        _cerrarAbierta(o);
        _repartir(o.token, resto, o.comprador, aComprador, o.vendedor);
        emit OrdenCancelada(id, msg.sender, 3);
    }
    /*──────────────── Acuerdo y disputas ────────────────*/
    function abrirDisputa(uint256 id) external {
        Orden storage o = ordenes[id];
        if (o.estado != Estado.Pagada) revert EstadoInvalido();
        if (msg.sender == o.comprador) { if (block.timestamp <= o.limite) revert Tiempo(); }
        else if (msg.sender != o.vendedor) revert NoAutorizado();
        if (arbitros.length == 0) revert NoArbitros();
        o.estado = Estado.Disputa; o.disputaEn = uint40(block.timestamp);
        o.arbitro = _arbitroAleatorio(id, 0);
        emit DisputaAbierta(id, msg.sender, o.arbitro);
    }

    /// Resolución parcial: bpsAlComprador de lo NO liberado va al comprador, el resto al vendedor.
    function resolver(uint256 id, uint16 bpsAlComprador, string calldata motivo) external nonReentrant {
        Orden storage o = ordenes[id];
        if (o.estado != Estado.Disputa || msg.sender != o.arbitro) revert NoAutorizado();
        if (bpsAlComprador > 10000) revert Limite();
        uint256 resto = o.monto - o.liberado;
        uint256 aComprador = resto * bpsAlComprador / 10000;
        o.estado = Estado.Resuelta; o.liberado = o.monto; o.limite = 0;
        // quien pierde la disputa
        address perdedor = bpsAlComprador >= 5000 ? o.vendedor : o.comprador;
        _registrarPerdida(perdedor);
        StatsArbitro storage sa = statsArbitro[msg.sender];
        sa.resueltas++; sa.tiempoAcumulado += uint64(block.timestamp - o.disputaEn);
        _cerrarAbierta(o);
        _repartir(o.token, resto, o.comprador, aComprador, o.vendedor);
        emit DisputaResuelta(id, msg.sender, bpsAlComprador, motivo);
    }

    /*──────────────── Referidos ────────────────*/
    function cobrarReferidos(address token) external nonReentrant {
        uint256 m = saldoReferido[msg.sender][token]; saldoReferido[msg.sender][token] = 0;
        referidosPendientes[token] -= m;
        _enviar(token, msg.sender, m);
    }

    /*──────────────── Vistas ────────────────*/
    function orden(uint256 id) external view returns (Orden memory) { return ordenes[id]; }
    function anuncio(uint256 id) external view returns (Anuncio memory) { return anuncios[id]; }
    function _esPro(address a) internal view returns (bool) {
        if (address(tarifas) == address(0)) return false;
        return tarifas.bpsDe(SERVICIO, a) < tarifas.comisionBps(SERVICIO);
    }
    /// Para PerfilesP2P: ¿pueden calificarse mutuamente por esta orden?
    function puedeCalificar(uint256 id, address quien, address aQuien) external view returns (bool) {
        Orden storage o = ordenes[id];
        if (o.estado != Estado.Completada && o.estado != Estado.Resuelta) return false;
        return (quien == o.vendedor && aQuien == o.comprador) || (quien == o.comprador && aQuien == o.vendedor);
    }

    /*──────────────── Internas ────────────────*/
    function _recibir(address token, uint256 monto) internal {
        if (token == address(0)) { if (msg.value != monto) revert MontoInvalido(); }
        else {
            if (msg.value != 0) revert MontoInvalido();
            uint256 antes = IERC20(token).balanceOf(address(this));
            IERC20(token).safeTransferFrom(msg.sender, address(this), monto);
            if (IERC20(token).balanceOf(address(this)) - antes != monto) revert TokenVetado(); // fee-on-transfer: no se admite
        }
        custodiado[token] += monto;
    }
    /// Saca `monto` del escrow contable y lo envía.
    function _pagarDeEscrow(address token, address a, uint256 monto) internal { custodiado[token] -= monto; _enviar(token, a, monto); }
    function _repartir(address token, uint256 total, address comprador, uint256 aComprador, address vendedor) internal {
        custodiado[token] -= total;
        if (aComprador > 0) _enviar(token, comprador, aComprador);
        if (total - aComprador > 0) _enviar(token, vendedor, total - aComprador);
    }
    function _enviar(address token, address a, uint256 monto) internal {
        if (monto == 0) return;
        if (token == address(0)) { (bool ok, ) = payable(a).call{value: monto}(""); if (!ok) revert Transferencia(); }
        else IERC20(token).safeTransfer(a, monto);
    }
    function _tramos(uint256 monto, uint256[] calldata custom, uint8 n) internal pure returns (uint256[] memory t) {
        if (custom.length > 0) {
            if (custom.length > 10) revert Tramos();
            uint256 suma; for (uint256 i = 0; i < custom.length; i++) { if (custom[i] == 0) revert Tramos(); suma += custom[i]; }
            if (suma != monto) revert Tramos();
            return custom;
        }
        t = new uint256[](n);
        uint256 base = monto / n; uint256 resto = monto - base * n;
        for (uint256 i = 0; i < n; i++) t[i] = base;
        t[n - 1] += resto;
    }
    function _aplicarCodigo(bytes32 c) internal returns (uint16) {
        if (c == bytes32(0) || address(tarifas) == address(0)) return 0;
        return tarifas.aplicarCodigo(c, msg.sender, SERVICIO);
    }
    function _comision(Orden storage o, uint256 bruto) internal view returns (uint256 c, uint256 aPadrino, address p) {
        if (address(tarifas) != address(0)) c = tarifas.calcular(SERVICIO, o.vendedor, o.token, bruto, o.descuentoBps);
        else { c = bruto * comisionBpsLocal / 10000; if (o.descuentoBps > 0) c -= c * o.descuentoBps / 10000; }
        if (c == 0) return (0, 0, address(0));
        p = padrino[o.vendedor];
        if (p != address(0) && !bloqueado[p]) aPadrino = c * porcentajePadrinoBps / 10000;
    }
    function _completar(Orden storage o, uint256 id) internal {
        _reg(o.vendedor, 1, 0); _reg(o.comprador, 1, 0);
        volumenToken[o.token] += o.monto; ordenesCompletadasTotal++;
        _cerrarAbierta(o);
        emit OrdenCompletada(id, o.vendedor, o.comprador, o.monto);
    }
    function _cancelar(Orden storage o, uint256 id, uint8 motivo) internal {
        o.estado = Estado.Cancelada; o.limite = 0;
        Anuncio storage a = anuncios[o.idAnuncio];
        a.disponible += o.monto - o.liberado;   // vuelve al stock del anuncio
        _cerrarAbierta(o);
        _reg(motivo == 0 ? o.vendedor : o.comprador, 2, 0);
        emit OrdenCancelada(id, msg.sender, motivo);
        emit AnuncioActualizado(o.idAnuncio, a.disponible, a.pausado);
    }
    function _cerrarAbierta(Orden storage o) internal { _reg(o.comprador, 6, 0); }
    function _registrarPerdida(address a) internal { _reg(a, 3, 0); }
    function _reg(address a, uint8 ev, uint64 dato) internal { if (address(perfiles) != address(0)) perfiles.registrar(a, ev, dato); }
    function _arbitroAleatorio(uint256 id, uint256 salt) internal view returns (address) {
        uint256 i = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), block.timestamp, id, salt, msg.sender))) % arbitros.length;
        return arbitros[i];
    }
    function _primeraVez(address a) internal { _reg(a, 0, 0); }

    receive() external payable {}
}
