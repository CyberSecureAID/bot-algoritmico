// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*═══════════════════════════════════════════════════════════════════════
  Futuros — motor de posiciones apalancadas (perpetuo) de la plataforma.
  ═══════════════════════════════════════════════════════════════════════
  FASE 1 — ESQUELETO (cimientos). Sin lógica de operaciones todavía.
  DISEÑO (ver notas FASE0 + README-V6):
  · Posiciones long/short respaldadas por la LIQUIDEZ del Staking: el motor pide
    prestado (prestar), ejecuta spot en PancakeSwap, y al cerrar repone (devolver).
  · El trader solo arriesga su MARGEN. Liquidación al perder ~75% del margen; la
    línea depende del apalancamiento: liq = entrada·(1 ∓ 0.75/lev).
  · Apalancamiento AUTORREGULADO por la liquidez libre (disponibleParaPrestar).
    Techo absoluto 200x.
  · Funding cada 8h mientras la posición sigue abierta (ínfimo); se manda al
    Staking, que lo reparte entre los aportantes de liquidez.
  · HISTORIAL y PNL por wallet (para el frontend).
  · Multi-owner, comisiones y % leídos de Tarifas (un solo sitio).
  · Precio desde el Oráculo desplegado (+ capas de respaldo en fases siguientes).
  · SATÉLITES autorizados (Sprint Scalper, y más adelante Fondeo) operan EN NOMBRE
    de un trader con el margen real que aportan; solo el núcleo toca dinero real.
  · UUPS + espera 48h · CEI + no reentrada · pausa y freno de emergencia.
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/utils/SafeERC20.sol";

/*───────────── Interfaces de los contratos YA DESPLEGADOS ─────────────*/
interface ITarifas {
    function esAdmin(address cuenta) external view returns (bool);
    function comisionBps(bytes32 servicio) external view returns (uint16);
}
interface IStaking {
    function prestar(address token, uint256 monto, address a) external;
    function devolver(address token, uint256 monto) external;
    function disponibleParaPrestar(address token) external view returns (uint256);
    function depositarRecompensa(address token, uint256 monto, uint16 bpsAStakers) external;
}
interface IOraculo {
    function precioUSD(address token) external view returns (uint256);
    function valorUSD(address token, uint256 cantidad) external view returns (uint256);
    function aceptado(address token) external view returns (bool);
}
interface IContabilidad { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; }
interface IPancakeRouter {
    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts);
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
    function getAmountsIn(uint256 amountOut, address[] calldata path) external view returns (uint256[] memory amounts);
}
interface IWBNB {
    function deposit() external payable;
    function withdraw(uint256) external;
}
interface IERC20Dec { function decimals() external view returns (uint8); }

contract FuturosV2 is Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    /*───────────────────────── Constantes ─────────────────────────*/
    uint256 private constant PRECISION    = 1e18;
    uint16  public  constant LEV_MAX       = 200;      // techo absoluto 200x
    uint16  public  constant LIQ_BPS       = 7500;     // se liquida al perder 75% del margen
    uint32  public  constant FUNDING_CADA  = 8 hours;  // intervalo de funding
    bytes32 public  constant SRV_FUTUROS   = keccak256("futuros");

    /*───────────────────────── Tipos ─────────────────────────*/
    enum Lado { Long, Short }

    struct ParamsAbrir {
        address token; address stable; Lado lado; uint256 margen;
        uint16 lev; uint256 tp; uint256 sl; address trader;
    }

    struct Posicion {
        address trader;        // dueño de la posición (o el trader en nombre de quien abrió un satélite)
        address origen;        // quién la abrió: el propio trader, o un satélite autorizado
        address token;         // par operado (la moneda base; la quote es una stable)
        address stable;        // stablecoin del margen/colateral (USDT por defecto)
        Lado    lado;          // Long o Short
        uint256 margen;        // capital real del trader (en 'stable')
        uint16  lev;           // apalancamiento (1..200)
        uint256 tamano;        // tamaño de la posición en USD (margen·lev), 1e18
        uint256 unidades;      // cantidad de 'token' comprada (long) o tomada prestada (short)
        uint256 precioEntrada; // precio USD de entrada (1e18)
        uint256 tp;            // take profit (precio 1e18, 0 = sin TP)
        uint256 sl;            // stop loss (precio 1e18, 0 = sin SL)
        uint256 precioLiq;     // precio de liquidación (1e18)
        uint40  abierta;       // timestamp de apertura
        uint40  ultimoFunding; // último cobro de funding
        uint40  vence;         // Sprint Scalper: timestamp de cierre forzado (0 = perpetua)
        bool    activa;        // sigue abierta
    }

    struct Resumen {           // historial/PNL por wallet (resumen acumulado)
        uint256 abiertas;      // nº de posiciones abiertas ahora
        uint256 cerradas;      // nº de posiciones cerradas
        int256  pnlRealizado;  // PNL realizado acumulado (con signo), en USD 1e18
        uint256 volumen;       // volumen total operado (USD 1e18)
    }

    /*───────────────────────── Estado ─────────────────────────*/
    ITarifas public tarifas;
    IStaking public staking;
    IOraculo public oraculo;
    address  public principal;

    // upgrade con espera (igual patrón que el Staking)
    address public propuestaImpl; uint40 public propuestaEn;
    uint40  public constant ESPERA_UPGRADE = 48 hours;

    // pausa / emergencia
    bool    public pausado; uint40 public pausadoDesde;

    // tokens operables (base) y stablecoins de colateral, administrables
    mapping(address => bool) public tokenOperable;   // monedas que se pueden operar (BTC, ETH, BNB...)
    mapping(address => bool) public stableColateral;  // stablecoins aceptadas como margen (USDT, USDC...)

    // satélites autorizados (Sprint Scalper, Fondeo en su día)
    mapping(address => bool) public satelite;

    // posiciones
    Posicion[] private _posiciones;                         // todas (índice = id)
    mapping(address => uint256[]) public posicionesDe;    // ids por trader
    mapping(address => Resumen)  public resumenDe;        // historial/PNL por trader

    // parámetros editables (con respaldo en Tarifas para comisiones)
    uint16 public fundingBps;     // funding por intervalo de 8h (ej. 1 = 0.01%)
    uint16 public propinaBps;     // propina al liquidador (ej. 50 = 0.5%)
    uint16 public aStakersBps;    // % de las comisiones/ganancias que va a stakers (5000 = 50%)
    uint16 public slippageBps;    // tolerancia de slippage en los swaps (ej. 100 = 1%)
    uint16 public comisionLiquidacionBps; // comisión SOLO en liquidación/SL (ej. 150 = 1.5%). Abrir/cerrar normal = 0.

    // infraestructura de ejecución (PancakeSwap) y monedas base
    IPancakeRouter public router;     // router de PancakeSwap (o DEX elegido)
    address public WBNB;              // wrapped BNB
    address public USDT;              // stablecoin principal de colateral

    // control de exposición (open interest) por token, para no sobrepasar la liquidez
    mapping(address => uint256) public expuestoLong;   // unidades de token comprometidas en longs
    mapping(address => uint256) public expuestoShort;  // unidades de token comprometidas en shorts
    uint16 public maxExposicionBps;   // tope de exposición por token vs liquidez (ej. 8000 = 80% del pool)

    /*───────────────────────── Eventos ─────────────────────────*/
    event Inicializado(address principal);
    event Config(string campo, uint256 valor, address quien);
    event TokenOperable(address token, bool v);
    event StableColateral(address token, bool v);
    event SateliteSet(address sat, bool v);
    event Pausa(bool v);
    event UpgradePropuesto(address impl, uint40 cuando);
    event TPSLEditado(uint256 indexed id, uint256 tp, uint256 sl);
    event Abierta(uint256 indexed id, address indexed trader, address token, Lado lado, uint256 margen, uint16 lev, uint256 precio);
    event Cerrada(uint256 indexed id, address indexed trader, int256 pnl, uint256 precioSalida, address liquidador);
    event Funding(uint256 indexed id, uint256 cobro, uint256 periodos);

    /*───────────────────────── Errores ─────────────────────────*/
    error NoAutorizado();
    error Pausado();
    error EsperaUpgrade();
    error ParamInvalido();

    /*───────────────────────── Modificadores ─────────────────────────*/
    modifier soloAdmin() {
        if (!(msg.sender == principal || (address(tarifas) != address(0) && tarifas.esAdmin(msg.sender)))) revert NoAutorizado();
        _;
    }
    modifier activo() { if (pausado) revert Pausado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    /*───────────────────────── Inicialización ─────────────────────────*/
    function initialize(
        address _principal,
        address _tarifas,
        address _staking,
        address _oraculo,
        address _usdt,
        address _router,
        address _wbnb
    ) external initializer {
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        principal = _principal;
        tarifas   = ITarifas(_tarifas);
        staking   = IStaking(_staking);
        oraculo   = IOraculo(_oraculo);
        router    = IPancakeRouter(_router);
        WBNB      = _wbnb;
        USDT      = _usdt;
        // valores de arranque (editables por admin)
        fundingBps  = 1;      // 0.01% cada 8h (como Binance)
        propinaBps  = 50;     // 0.5% al liquidador
        aStakersBps = 5000;   // 50% a stakers
        slippageBps = 100;    // 1% de tolerancia en swaps
        comisionLiquidacionBps = 150; // 1.5% solo en liquidación/SL (editable)
        maxExposicionBps = 8000;      // una posición no puede usar más del 80% del pool libre
        // USDT como stablecoin de colateral por defecto
        if (_usdt != address(0)) { stableColateral[_usdt] = true; emit StableColateral(_usdt, true); }
        emit Inicializado(_principal);
    }

    /*───────────────────────── Administración ─────────────────────────*/
    function setTokenOperable(address token, bool v) external soloAdmin { tokenOperable[token] = v; emit TokenOperable(token, v); }
    function setStableColateral(address token, bool v) external soloAdmin { stableColateral[token] = v; emit StableColateral(token, v); }
    function setSatelite(address sat, bool v) external soloAdmin { satelite[sat] = v; emit SateliteSet(sat, v); }

    function setFundingBps(uint16 b) external soloAdmin { if (b > 100) revert ParamInvalido(); fundingBps = b; emit Config("fundingBps", b, msg.sender); }
    function setPropinaBps(uint16 b) external soloAdmin { if (b > 500) revert ParamInvalido(); propinaBps = b; emit Config("propinaBps", b, msg.sender); }
    function setAStakersBps(uint16 b) external soloAdmin { if (b > 10000) revert ParamInvalido(); aStakersBps = b; emit Config("aStakersBps", b, msg.sender); }

    function setContratos(address _tarifas, address _staking, address _oraculo) external soloAdmin {
        if (_tarifas != address(0)) tarifas = ITarifas(_tarifas);
        if (_staking != address(0)) staking = IStaking(_staking);
        if (_oraculo != address(0)) oraculo = IOraculo(_oraculo);
        emit Config("contratos", 0, msg.sender);
    }

    function setPausa(bool v) external soloAdmin { pausado = v; pausadoDesde = v ? uint40(block.timestamp) : 0; emit Pausa(v); }
    function setRouter(address _router) external soloAdmin { router = IPancakeRouter(_router); emit Config("router", 0, msg.sender); }
    function setSlippageBps(uint16 b) external soloAdmin { if (b > 1000) revert ParamInvalido(); slippageBps = b; emit Config("slippageBps", b, msg.sender); }
    function setComisionLiquidacionBps(uint16 b) external soloAdmin { if (b > 500) revert ParamInvalido(); comisionLiquidacionBps = b; emit Config("comisionLiqBps", b, msg.sender); }
    function setMaxExposicionBps(uint16 b) external soloAdmin { if (b == 0 || b > 10000) revert ParamInvalido(); maxExposicionBps = b; emit Config("maxExposicionBps", b, msg.sender); }

    /*───────────────────────── Vistas (lectura) ─────────────────────────*/
    function totalPosiciones() external view returns (uint256) { return _posiciones.length; }
    function idsDe(address trader) external view returns (uint256[] memory) { return posicionesDe[trader]; }
    function resumen(address trader) external view returns (Resumen memory) { return resumenDe[trader]; }
    function posicion(uint256 id) external view returns (Posicion memory) { return _posiciones[id]; }

    /// máximo apalancamiento posible AHORA para un margen dado, según liquidez libre.
    /// (lógica real en Fase 2; aquí deja la base del autorregulado)
    function levMaximo(address token, address stable, uint256 margen) external view returns (uint16) {
        if (margen == 0) return LEV_MAX;
        uint256 libre = staking.disponibleParaPrestar(stable);
        if (libre == 0) return 0;
        // tamaño máximo ≈ libre; lev ≈ tamaño / margen, tope 200x
        uint256 lev = (libre * 1) / margen;
        if (lev > LEV_MAX) return LEV_MAX;
        token; // (en Fase 2 se afina por par)
        return uint16(lev);
    }

    /*═══════════════════════ EJECUCIÓN: swaps reales en el DEX ═══════════════════════*/
    // Hace un swap exacto token->token por el DEX, mide lo recibido (fee-on-transfer safe).
    function _swap(address desde, address hacia, uint256 montoIn) internal returns (uint256 recibido) {
        if (montoIn == 0) return 0;
        address[] memory path;
        if (desde == WBNB || hacia == WBNB) {
            path = new address[](2); path[0] = desde; path[1] = hacia;
        } else {
            // ruta vía WBNB si no hay par directo con la stable (simplificado; en prod se elige mejor ruta)
            path = new address[](3); path[0] = desde; path[1] = WBNB; path[2] = hacia;
        }
        // mínimo aceptable según tolerancia de slippage sobre el precio del oráculo
        uint256[] memory prevista = router.getAmountsOut(montoIn, path);
        uint256 minOut = prevista[prevista.length - 1] * (10000 - slippageBps) / 10000;
        IERC20(desde).forceApprove(address(router), montoIn);
        uint256 antes = IERC20(hacia).balanceOf(address(this));
        router.swapExactTokensForTokens(montoIn, minOut, path, address(this), block.timestamp + 300);
        recibido = IERC20(hacia).balanceOf(address(this)) - antes;
    }

    // precio de liquidación según lado y apalancamiento: liq = entrada·(1 ∓ LIQ_BPS/lev/10000)
    function _calcLiq(uint256 entrada, uint16 lev, Lado lado) internal pure returns (uint256) {
        // mueve (0.75/lev) del precio. LIQ_BPS=7500 → 0.75. factor = LIQ_BPS/lev/10000
        uint256 delta = entrada * LIQ_BPS / lev / 10000;
        if (lado == Lado.Long) return entrada > delta ? entrada - delta : 0;
        return entrada + delta;
    }

    /*═══════════════════════ ABRIR POSICIÓN ═══════════════════════*/
    // Abre una posición. El trader aporta 'margen' en 'stable'. 'origen' indica quién la
    // abre: address(0)=el propio msg.sender; o un satélite autorizado abre en nombre de 'trader'.
    // Apertura directa (el propio usuario). Firma simple para el frontend.
    function abrirPosicion(address token, address stable, Lado lado, uint256 margen, uint16 lev, uint256 tp, uint256 sl)
        external returns (uint256)
    {
        return abrir(ParamsAbrir(token, stable, lado, margen, lev, tp, sl, msg.sender));
    }

    /*═══ SPRINT SCALPER: posición que se cierra sola por tiempo (1-5 min) ═══*/
    // Multiplicador fijo 100x, sin elegir apalancamiento. 'segundos' entre 60 y 300.
    uint16 public constant SCALPER_LEV = 100;
    function abrirSprint(address token, address stable, Lado lado, uint256 margen, uint256 sl, uint32 segundos)
        external nonReentrant activo returns (uint256 id)
    {
        require(segundos >= 60 && segundos <= 300, "tiempo 1-5min");
        require(tokenOperable[token] && stableColateral[stable], "no operable");
        require(margen > 0, "margen");
        uint256 tamanoUSD = margen * SCALPER_LEV;
        IERC20(stable).safeTransferFrom(msg.sender, address(this), margen);
        uint256 precio = oraculo.precioUSD(token);
        require(precio > 0, "precio");
        uint256 unidades = (lado == Lado.Long)
            ? _ejecutarLong(token, stable, margen, tamanoUSD)
            : _ejecutarShort(token, stable, tamanoUSD, precio);
        id = _posiciones.length;
        _posiciones.push(Posicion({
            trader: msg.sender, origen: msg.sender, token: token, stable: stable, lado: lado,
            margen: margen, lev: SCALPER_LEV, tamano: tamanoUSD, unidades: unidades,
            precioEntrada: precio, tp: 0, sl: sl, precioLiq: _calcLiq(precio, SCALPER_LEV, lado),
            abierta: uint40(block.timestamp), ultimoFunding: uint40(block.timestamp),
            vence: uint40(block.timestamp + segundos), activa: true
        }));
        posicionesDe[msg.sender].push(id);
        Resumen storage r = resumenDe[msg.sender];
        r.abiertas += 1; r.volumen += tamanoUSD;
        emit Abierta(id, msg.sender, token, lado, margen, SCALPER_LEV, precio);
    }

    // Cierre por vencimiento de un Sprint (pública, con propina al gatillador).
    function cerrarVencido(uint256 id) external nonReentrant {
        Posicion storage p = _posiciones[id];
        require(p.activa && p.vence != 0, "no sprint");
        require(block.timestamp >= p.vence, "aun no vence");
        _cerrarInterno(id, msg.sender);
    }

    // Apertura (directa o desde satélite). El satélite pasa 'trader'; el pagador es msg.sender.
    function abrir(ParamsAbrir memory q) public nonReentrant activo returns (uint256 id) {
        address dueno = satelite[msg.sender] ? q.trader : msg.sender;
        require(dueno != address(0), "trader?");
        require(tokenOperable[q.token], "token no operable");
        require(stableColateral[q.stable], "stable no valida");
        require(q.margen > 0 && q.lev >= 1 && q.lev <= LEV_MAX, "params");

        uint256 tamanoUSD = q.margen * q.lev;
        IERC20(q.stable).safeTransferFrom(msg.sender, address(this), q.margen);

        uint256 precio = oraculo.precioUSD(q.token);
        require(precio > 0, "precio");
        uint256 unidades = (q.lado == Lado.Long)
            ? _ejecutarLong(q.token, q.stable, q.margen, tamanoUSD)
            : _ejecutarShort(q.token, q.stable, tamanoUSD, precio);

        id = _crearPosicion(dueno, q, tamanoUSD, unidades, precio);
        emit Abierta(id, dueno, q.token, q.lado, q.margen, q.lev, precio);
    }

    function _ejecutarLong(address token, address stable, uint256 margen, uint256 tamanoUSD) internal returns (uint256 unidades) {
        uint256 prestarStable = tamanoUSD > margen ? tamanoUSD - margen : 0;
        uint256 libre = staking.disponibleParaPrestar(stable);
        require(prestarStable <= libre, "liquidez");
        // límite de exposición: no usar más del maxExposicionBps% del pool libre en una posición
        require(prestarStable <= libre * maxExposicionBps / 10000, "excede exposicion");
        if (prestarStable > 0) staking.prestar(stable, prestarStable, address(this));
        unidades = _swap(stable, token, tamanoUSD);
        expuestoLong[token] += unidades;
    }

    function _ejecutarShort(address token, address stable, uint256 tamanoUSD, uint256 precio) internal returns (uint256 unidades) {
        // unidades del token = valor USD / precio, ajustado a los DECIMALES reales del token.
        // precio es USD con 18 dec; tamanoUSD es USD con 18 dec (margen en stable 18 dec * lev).
        uint8 dec = IERC20Dec(token).decimals();
        unidades = tamanoUSD * (10 ** dec) / precio;
        uint256 libreT = staking.disponibleParaPrestar(token);
        require(libreT >= unidades, "liquidez token");
        require(unidades <= libreT * maxExposicionBps / 10000, "excede exposicion");
        staking.prestar(token, unidades, address(this));
        _swap(token, stable, unidades);
        expuestoShort[token] += unidades;
    }

    function _crearPosicion(address dueno, ParamsAbrir memory q, uint256 tamanoUSD, uint256 unidades, uint256 precio)
        internal returns (uint256 id)
    {
        id = _posiciones.length;
        _posiciones.push(Posicion({
            trader: dueno, origen: msg.sender, token: q.token, stable: q.stable, lado: q.lado,
            margen: q.margen, lev: q.lev, tamano: tamanoUSD, unidades: unidades,
            precioEntrada: precio, tp: q.tp, sl: q.sl, precioLiq: _calcLiq(precio, q.lev, q.lado),
            abierta: uint40(block.timestamp), ultimoFunding: uint40(block.timestamp), vence: 0, activa: true
        }));
        posicionesDe[dueno].push(id);
        Resumen storage r = resumenDe[dueno];
        r.abiertas += 1; r.volumen += tamanoUSD;
    }

    /*═══════════════════════ CERRAR POSICIÓN ═══════════════════════*/
    // Cierra una posición (por el dueño, o por satélite que la abrió). Calcula PNL, repone
    // el préstamo al Staking, cobra comisión de cierre y reparte.
    function cerrar(uint256 id) public nonReentrant returns (int256 pnl) {
        Posicion storage p = _posiciones[id];
        require(p.activa, "cerrada");
        require(msg.sender == p.trader || msg.sender == p.origen || msg.sender == principal, "no dueno");
        pnl = _cerrarInterno(id, address(0));
    }

    // cierre interno. 'liquidador' != 0 cuando lo gatilla una liquidación (recibe propina).
    function _cerrarInterno(uint256 id, address liquidador) internal returns (int256 pnl) {
        Posicion storage p = _posiciones[id];
        pnl = (p.lado == Lado.Long) ? _cerrarLong(p) : _cerrarShort(p);
        _liquidarCuentas(id, liquidador, pnl);
        emit Cerrada(id, p.trader, pnl, oraculo.precioUSD(p.token), liquidador);
    }

    function _cerrarLong(Posicion storage p) internal returns (int256 pnl) {
        uint256 recibido = _swap(p.token, p.stable, p.unidades);
        expuestoLong[p.token] -= p.unidades;
        uint256 prestado = p.tamano > p.margen ? p.tamano - p.margen : 0;
        if (prestado > 0) { IERC20(p.stable).forceApprove(address(staking), prestado); staking.devolver(p.stable, prestado); }
        pnl = int256(recibido) - int256(p.tamano);
    }

    function _cerrarShort(Posicion storage p) internal returns (int256 pnl) {
        uint256 costo = _costoRecomprar(p.stable, p.token, p.unidades);
        uint256 obtenido = _swap(p.stable, p.token, costo);
        IERC20(p.token).forceApprove(address(staking), obtenido);
        staking.devolver(p.token, obtenido);
        expuestoShort[p.token] -= p.unidades;
        pnl = int256(p.tamano) - int256(costo);
    }

    function _liquidarCuentas(uint256 id, address liquidador, int256 pnl) internal {
        Posicion storage p = _posiciones[id];
        // COMISIÓN: 0 al abrir y 0 al cerrar en condiciones normales (más competitivo
        // que Binance). SOLO se cobra cuando es liquidación o stop loss (liquidador != 0).
        bool esLiquidacion = (liquidador != address(0));
        uint256 comision = esLiquidacion ? (p.margen * comisionLiquidacionBps / 10000) : 0;

        int256 saldoTrader = int256(p.margen) + pnl - int256(comision);
        if (saldoTrader < 0) saldoTrader = 0; // nunca debe más que su margen

        // propina al liquidador: sale DE la comisión de liquidación (no es extra).
        uint256 propina = 0;
        if (esLiquidacion && comision > 0) {
            propina = comision * propinaBps / 10000;
            if (propina > comision) propina = comision;
            if (propina > 0) IERC20(p.stable).safeTransfer(liquidador, propina);
        }
        // el resto de la comisión se reparte 50/50 plataforma/stakers.
        uint256 comisionNeta = comision > propina ? comision - propina : 0;
        if (comisionNeta > 0) {
            IERC20(p.stable).forceApprove(address(staking), comisionNeta);
            staking.depositarRecompensa(p.stable, comisionNeta, aStakersBps);
        }
        if (saldoTrader > 0) IERC20(p.stable).safeTransfer(p.trader, uint256(saldoTrader));

        // V2: reportar a Contabilidad (la comisión de liquidación/SL que se cobró)
        if (esLiquidacion && comision > 0 && contabilidad != address(0)) {
            try IContabilidad(contabilidad).reportar(p.trader, keccak256("futuros"), comision, comisionNeta * aStakersBps / 10000, comisionNeta) {} catch {}
        }

        p.activa = false;
        Resumen storage r = resumenDe[p.trader];
        if (r.abiertas > 0) r.abiertas -= 1;
        r.cerradas += 1;
        r.pnlRealizado += pnl;
    }

    // cuánto stable cuesta recomprar 'unidades' de token (para cerrar un short)
    function _costoRecomprar(address stable, address token, uint256 unidades) internal view returns (uint256) {
        address[] memory path;
        if (stable == WBNB || token == WBNB) { path = new address[](2); path[0] = stable; path[1] = token; }
        else { path = new address[](3); path[0] = stable; path[1] = WBNB; path[2] = token; }
        // COSTO REAL del DEX: cuánto 'stable' hace falta para obtener 'unidades' de token.
        // getAmountsIn da el precio real de PancakeSwap (no solo el oráculo). Con respaldo
        // al oráculo si el router fallara, y margen de slippage.
        try router.getAmountsIn(unidades, path) returns (uint256[] memory ins) {
            return ins[0] * (10000 + slippageBps) / 10000;
        } catch {
            uint256 precio = oraculo.precioUSD(token);
            uint8 dec = IERC20Dec(token).decimals();
            uint256 costo = unidades * precio / (10 ** dec);
            return costo * (10000 + slippageBps) / 10000;
        }
    }

    /*═══════════════════════ LIQUIDACIÓN (pública, con propina) ═══════════════════════*/
    // Cualquiera puede llamar. Si el precio cruzó la liquidación o el SL, cierra y paga propina.
    // Idempotente: si ya está cerrada, revierte suave.
    function liquidar(uint256 id) external nonReentrant {
        Posicion storage p = _posiciones[id];
        require(p.activa, "cerrada");
        uint256 precio = oraculo.precioUSD(p.token);
        bool procede;
        if (p.lado == Lado.Long) {
            procede = precio <= p.precioLiq || (p.sl != 0 && precio <= p.sl);
        } else {
            procede = precio >= p.precioLiq || (p.sl != 0 && precio >= p.sl);
        }
        require(procede, "no liquidable");
        _cerrarInterno(id, msg.sender);
    }

    // Ejecuta un take profit si el precio lo alcanzó (pública, con propina para el gatillador).
    function ejecutarTP(uint256 id) external nonReentrant {
        Posicion storage p = _posiciones[id];
        require(p.activa && p.tp != 0, "sin TP");
        uint256 precio = oraculo.precioUSD(p.token);
        bool procede = p.lado == Lado.Long ? precio >= p.tp : precio <= p.tp;
        require(procede, "TP no alcanzado");
        _cerrarInterno(id, msg.sender);
    }

    /*═══════════════════════ FUNDING cada 8h ═══════════════════════*/
    // Cualquiera puede gatillar el cobro de funding de una posición abierta cuando toca.
    // El funding sale del margen del trader y se manda al Staking (reparto a aportantes).
    function cobrarFunding(uint256 id) external nonReentrant {
        Posicion storage p = _posiciones[id];
        require(p.activa, "cerrada");
        uint256 trans = (block.timestamp - p.ultimoFunding) / FUNDING_CADA;
        require(trans > 0, "aun no");
        uint256 cobro = p.tamano * fundingBps * trans / 10000;
        if (cobro > p.margen) cobro = p.margen;
        p.margen -= cobro;
        p.ultimoFunding = uint40(p.ultimoFunding + trans * FUNDING_CADA);
        if (cobro > 0) {
            IERC20(p.stable).forceApprove(address(staking), cobro);
            staking.depositarRecompensa(p.stable, cobro, 10000); // 100% a stakers (es por su liquidez)
        }
        emit Funding(id, cobro, trans);
    }

    /*═══════════════════════ V2: editar TP/SL ═══════════════════════*/
    // El dueño de una posición abierta ajusta su TP y/o SL. El SL no puede
    // colocarse más allá del precio de liquidación (protege el pool de staking).
    function editarTPSL(uint256 id, uint256 nuevoTP, uint256 nuevoSL) external nonReentrant {
        Posicion storage pos = _posiciones[id];
        require(pos.activa, "cerrada");
        require(pos.trader == msg.sender || msg.sender == principal, "no dueno");
        if (pos.lado == Lado.Long) {
            // long: SL por debajo de la entrada y por ENCIMA de la liquidación
            require(nuevoSL == 0 || nuevoSL > pos.precioLiq, "SL<=liq");
        } else {
            // short: SL por encima de la entrada y por DEBAJO de la liquidación
            require(nuevoSL == 0 || nuevoSL < pos.precioLiq, "SL>=liq");
        }
        pos.tp = nuevoTP;
        pos.sl = nuevoSL;
        emit TPSLEditado(id, nuevoTP, nuevoSL);
    }

    /*═══════════════════════ V2: conexión a Contabilidad ═══════════════════════*/
    function setContabilidad(address c) external soloAdmin { contabilidad = c; emit Config("contabilidad", 0, msg.sender); }

    /*───────────────────────── Upgrade (UUPS con espera) ─────────────────────────*/
    function proponerUpgrade(address impl) external soloAdmin {
        propuestaImpl = impl; propuestaEn = uint40(block.timestamp);
        emit UpgradePropuesto(impl, uint40(block.timestamp));
    }
    function _authorizeUpgrade(address impl) internal view override soloAdmin {
        if (impl != propuestaImpl) revert ParamInvalido();
        if (propuestaEn == 0 || block.timestamp < propuestaEn + ESPERA_UPGRADE) revert EsperaUpgrade();
    }

    // ═══ V2: variables NUEVAS (añadidas al final, no mueven el storage anterior) ═══
    address public contabilidad;   // contrato de Contabilidad para reportar

    // hueco reducido: se usó 1 slot (contabilidad), quedan 39.
    uint256[39] private __hueco;
}
