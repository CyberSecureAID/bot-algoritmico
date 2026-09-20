// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  GRIDBOT — Bot de rejilla (grid trading) NO CUSTODIAL · La Bolita Cubana  │
 * │  ------------------------------------------------------------------------ │
 * │  Compra/venta automática por niveles aprovechando la volatilidad, SIN     │
 * │  guardarle fondos a nadie y SIN ninguna API de pago. Motor: PancakeSwap   │
 * │  Router V2 on-chain (gratis). Vigilancia: keeper (worker Cloudflare).     │
 * │                                                                           │
 * │  PERMISO ÚNICO (trabajar mientras el usuario duerme):                     │
 * │   El usuario firma UNA VEZ el approve de sus dos tokens. A partir de ahí   │
 * │   el keeper ejecuta los pasos sin que él firme cada operación.            │
 * │                                                                           │
 * │  SIN CUSTODIA (invariante central):                                       │
 * │   El dinero SIEMPRE vive en la wallet del usuario. Cada swap sale DIRECTO  │
 * │   a su wallet. No hay saldo dentro del contrato → no hay que "retirar":    │
 * │   las ganancias ya están en su wallet. Cada rejilla es independiente      │
 * │   (clave keccak(usuario,base,quote)); no hay bote común entre usuarios.   │
 * │                                                                           │
 * │  RIESGO CONTROLADO (obligatorio en grid serio):                           │
 * │   · Stop-Loss / Take-Profit: cierran y liquidan la posición a estable si  │
 * │     el precio cae/sube al límite. Lo dispara el keeper, pero SOLO si el    │
 * │     precio de verdad tocó el límite (verificado on-chain).                │
 * │   · Slippage tope por operación. Cooldown anti-churn.                     │
 * │                                                                           │
 * │  NO ACTUALIZABLE (sin proxy) a propósito: mueve tokens que el usuario le  │
 * │  aprueba; ser inmutable es lo que hace confiable ese permiso.             │
 * │                                                                           │
 * │  PANEL COMPLETO on-chain (resumen()): posición, coste, ganancia realizada,│
 * │  volumen, compras, ventas, ciclos, creado/última op, TP/SL.               │
 * │                                                                           │
 * │  RETROALIMENTA LA BANCA: la comisión se cobra del token de ENTRADA (una   │
 * │  moneda de la lotería); parte va a la banca vía aportarDesdeBot().        │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

/* ───────────────────────── Interfaces mínimas ───────────────────────── */

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 v) external returns (bool);
    function transferFrom(address from, address to, uint256 v) external returns (bool);
    function approve(address spender, uint256 v) external returns (bool);
    function allowance(address o, address s) external view returns (uint256);
}

interface IV3SwapRouter {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee; address recipient;
        uint256 deadline; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IQuoterV2 {
    struct QuoteExactInputSingleParams {
        address tokenIn; address tokenOut; uint256 amountIn; uint24 fee; uint160 sqrtPriceLimitX96;
    }
    function quoteExactInputSingle(QuoteExactInputSingleParams memory params)
        external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate);
}

interface IBolita {
    function aportarDesdeBot(address token, uint256 cantidad) external payable;
    function monedaRegistrada(address token) external view returns (bool);
    function aportadorBot() external view returns (address);
}

/**
 * Gancho OPCIONAL de lógica futura. El núcleo solo NOTIFICA lo que ocurrió;
 * el módulo NO recibe tokens, NI allowances, NI capacidad de mover fondos.
 * Es puramente informativo/extensible: estrategias, estadísticas, recompensas,
 * señales… Puede reemplazarse con setModulo() sin redesplegar el núcleo.
 */
interface IGridModulo {
    function alOperar(
        address usuario, bytes32 clave, bool compra,
        uint256 entrada, uint256 salida, int256 gananciaAcum
    ) external;
    function alCerrar(address usuario, bytes32 clave, bool porTPSL, uint256 quoteRecibido) external;
}

/* ───────────────────── Helpers ERC20 tolerantes ────────────────────── */
library SafeT {
    function _call(address token, bytes memory data) private {
        (bool ok, bytes memory ret) = token.call(data);
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))));
    }
    function safeTransfer(address t, address to, uint256 v) internal {
        _call(t, abi.encodeWithSelector(IERC20.transfer.selector, to, v));
    }
    function safeTransferFrom(address t, address from, address to, uint256 v) internal {
        _call(t, abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, v));
    }
    function forceApprove(address t, address spender, uint256 v) internal {
        (bool ok, bytes memory ret) = t.call(abi.encodeWithSelector(IERC20.approve.selector, spender, 0));
        ok; ret;
        _call(t, abi.encodeWithSelector(IERC20.approve.selector, spender, v));
    }
}

/* ────────────────────────────── Contrato ───────────────────────────── */

contract GridBotV10 is Initializable, UUPSUpgradeable {
    using SafeT for address;

    /* ---- Constantes de red (BSC mainnet). Inmutables = sin rug de router. */
    address public constant ROUTER_V3 = 0x1b81D678ffb9C0263b24A97847620C99d213eB14; // Pancake V3 SwapRouter
    address public constant QUOTER_V3 = 0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997; // Pancake V3 QuoterV2
    address public constant WBNB     = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    uint256 public constant BPS      = 10000;
    uint256 public constant FEE_MAX  = 100;   // 1% tope duro de comisión total
    uint256 public constant SLIP_MAX = 1000;  // 10% tope duro de slippage
    uint256 public constant MAX_NIV  = 100;   // niveles máximos por rejilla
    uint256 public constant MES      = 30 days; // duración de la suscripción

    /* ---- Administración (solo parámetros; nunca fondos de usuarios) ---- */
    address public owner;
    address public ownerPendiente;
    address public keeper;
    address public beneficiario;
    address public bolita;
    address public modulo;   // gancho opcional de lógica futura (SIN poder sobre fondos)
    uint256 public feeBps;    // 0.10% total
    uint256 public bancaShareBps;  // 50% de la comisión → banca (=0.05%)
    uint256 public slippageMax;   // 5%
    bool    public pausado;

    /* ---- GAS DEL USUARIO ----
       El usuario deja una bolsa pequeña de BNB para gas (ej. ~2 USD). Cada
       operación que dispara el keeper le REEMBOLSA su gas desde esa bolsa, así
       el owner NUNCA paga el gas de nadie. Es saldo del usuario, aislado y
       retirable cuando quiera (retirarGas). No es su capital de trading (ese
       sigue en su wallet vía allowance): es solo su tanque de gas. */
    mapping(address => uint256) public gasSaldo;      // BNB (wei) por usuario para gas
    uint256 public gasMinOp;          // mínimo de gas para permitir una op del keeper
    uint256 public gasOverhead;               // gas base (tx+transfer) que el reembolso no ve, ajustable

    uint256 private _lock;
    modifier noReentrada() { require(_lock == 1); _lock = 2; _; _lock = 1; }
    modifier soloOwner()  { require(msg.sender == owner,  "no owner");  _; }

    /* ---- Nivel (2 slots). estado: 0 dormido · 1 ARMADO_COMPRA · 2 ARMADO_VENTA */
    struct Nivel { uint128 minOutCompra; uint128 minOutVenta; uint8 estado; }
    struct NivelIn { uint128 minOutCompra; uint128 minOutVenta; uint8 estado; }

    /** Config de creación agrupada (evita "stack too deep" y limpia la llamada). */
    struct ConfigIn {
        address   base;
        address   quote;
        address[] pathCompra;
        address[] pathVenta;
        uint256   ordenQuote;
        uint256   ordenBase;
        NivelIn[] niveles;
        uint16    slippageBps;
        uint32    cooldownSeg;
        uint128   tpUnitOut;
        uint128   slUnitOut;
        uint24    feeTier;      // 500 = 0.05% (pool V3)
        uint8     modo;         // 0 = rejilla · 1 = acumulador (venta única en ganancia)
        uint16    objetivoBps;  // acumulador: ganancia mínima para vender TODO (bps, ej. 1000 = 10%)
        uint16    factorBps;    // acumulador: cuánto MÁS se compra por nivel al bajar (progresivo)
        uint256   compraInicialQuote; // acumulador: cuánto comprar a mercado al abrir (ej. 30% del total)
        uint16    margenBps;    // cuadrícula: no vender bajo (promedio + este margen). 0 = venta normal
        uint256   botId;        // V9: id del bot (0 = clave clásica; >0 = varios bots por par)
        uint256   intervalo;    // V10 DCA (modo 3): segundos entre compras
        uint32    comprasMax;   // V10 DCA: nº total de compras (0 = infinito)
    }

    struct Rejilla {
        address   base;
        address   quote;
        address[] pathCompra;   // quote → … → base
        address[] pathVenta;    // base  → … → quote
        uint256   ordenQuote;   // quote fijo por compra
        uint256   ordenBase;    // base  fijo por venta (y unidad-sonda para TP/SL)
        uint256   posicionBase; // base neto acumulado por la rejilla (vive en la wallet del usuario)
        uint256   costeQuote;   // coste (quote) de esa posición → PnL por promedio ponderado
        uint256   volumenQuote; // volumen acumulado (en quote)
        int256    gananciaQuote;// ganancia REALIZADA acumulada (en quote; puede ser negativa)
        uint256   gasGastadoWei;// gas real reembolsado por esta rejilla (BNB wei)
        uint128   tpUnitOut;    // Take-Profit: quote que rinde ordenBase al vender (0 = off)
        uint128   slUnitOut;    // Stop-Loss:   idem, por abajo (0 = off)
        uint64    creadaEn;
        uint64    ultimaOpEn;
        uint32    comprasHechas;
        uint32    ventasHechas;
        uint32    ciclos;       // ventas que cerraron posición (ciclos completados)
        uint32    cooldownSeg;
        uint16    slippageBps;
        bool      activa;
        Nivel[]   niveles;      // ordenados de menor a mayor precio
        uint24    feeTier;      // pool V3 (añadido al final: no rompe el layout existente)
        uint8     modo;         // 0 = rejilla · 1 = acumulador
        uint16    objetivoBps;  // acumulador: ganancia mínima para vender todo
        uint16    factorBps;    // acumulador: progresión de volumen por nivel
        uint16    margenBps;    // cuadrícula: margen mínimo de venta sobre el promedio
        uint256   intervalo;    // V10 DCA (modo 3): segundos entre compras
        uint32    comprasMax;   // V10 DCA: nº total de compras (0 = infinito)
    }

    mapping(bytes32 => Rejilla) private rejillas;
    mapping(bytes32 => address) public duenoDe;
    mapping(address => bytes32[]) public clavesDe;

    /* ---- Catálogo de monedas SUGERIDAS para la UI (curado por el owner). ----
       NO limita el trading: cualquier token con ruta en Pancake se puede operar
       vía crearRejilla. Esto es solo el listado que la web muestra por defecto,
       para que el owner pueda "habilitar" desde el panel una moneda más volátil
       que pida un usuario. */
    struct TokenInfo { bool activo; string simbolo; }
    mapping(address => TokenInfo) public tokenInfo;
    mapping(address => bool) private _vistoToken;
    address[] public tokens;

    struct Resumen {
        address base; address quote; bool activa;
        uint256 niveles; uint256 armados;
        uint256 creadaEn; uint256 ultimaOpEn;
        uint256 comprasHechas; uint256 ventasHechas; uint256 ciclos; uint256 totalOps;
        uint256 posicionBase; uint256 costeQuote;
        uint256 volumenQuote; int256 gananciaQuote;
        uint256 gasSaldoWei; uint256 gasGastadoWei;
        uint256 ordenQuote; uint256 ordenBase;
        uint128 tpUnitOut; uint128 slUnitOut;
        uint16 slippageBps; uint32 cooldownSeg;
        uint24 feeTier;
        uint256 intervalo; uint32 comprasMax;
    }

    /* ---- Eventos ---- */
    event RejillaCreada(address indexed usuario, address indexed base, address indexed quote, bytes32 clave, uint256 niveles, bool nueva);
    event RejillaCancelada(address indexed usuario, bytes32 clave);
    event RejillaActiva(bytes32 indexed clave, bool activa);
    event Cerrada(address indexed usuario, bytes32 indexed clave, bool porTPSL, uint256 baseVendida, uint256 quoteRecibido);
    event Ajuste(bytes32 indexed clave, string que, uint256 a, uint256 b);
    event Ejecutado(address indexed usuario, bytes32 indexed clave, uint256 indice, bool compra, uint256 entrada, uint256 salida);
    event Comision(address indexed token, uint256 aBanca, uint256 aOwner);
    event ParamCambiado(string que, address valor);
    event TokenListado(address indexed token, string simbolo, bool activo);
    event GasDepositado(address indexed usuario, uint256 monto, uint256 saldo);
    event GasRetirado(address indexed usuario, uint256 monto);
    event GasReembolsado(address indexed usuario, address indexed keeper, uint256 monto);
    event SuscripcionPagada(address indexed usuario, uint256 monto, uint256 hasta);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    /** Inicializa el proxy (se llama UNA vez, al desplegar el proxy). */
    function initialize(address _bolita) public initializer {
        owner = msg.sender; keeper = msg.sender; beneficiario = msg.sender;
        bolita = _bolita;
        feeBps = 10; bancaShareBps = 5000; slippageMax = 500;
        gasMinOp = 0.003 ether; gasOverhead = 50000;
        _lock = 1;
    }

    /** Solo el owner puede actualizar la implementación (UUPS). */
    function _authorizeUpgrade(address) internal override soloOwner {}

    /* ═══════════════════════ Gas del usuario (tanque BNB) ═══════════════════════ */

    /** Enviar BNB directo al contrato recarga el gas del que envía. */
    receive() external payable { _acreditarGas(msg.sender, msg.value); }

    /** Recarga tu propio tanque de gas. */
    function depositarGas() external payable { _acreditarGas(msg.sender, msg.value); }

    /** Recarga el tanque de gas de otra dirección (p. ej. la web por el usuario). */
    function depositarGasPara(address usuario) external payable { _acreditarGas(usuario, msg.value); }

    function _acreditarGas(address usuario, uint256 v) internal {
        require(v > 0);
        gasSaldo[usuario] += v;
        emit GasDepositado(usuario, v, gasSaldo[usuario]);
    }

    /** Retira tu BNB de gas cuando quieras (es tuyo, no hay custodia de tu capital). */
    function retirarGas(uint256 monto) external noReentrada {
        uint256 s = gasSaldo[msg.sender];
        require(monto > 0 && monto <= s);
        gasSaldo[msg.sender] = s - monto;
        (bool ok, ) = payable(msg.sender).call{value: monto}("");
        require(ok);
        emit GasRetirado(msg.sender, monto);
    }

    /** Reembolsa al keeper el gas de la operación desde el tanque del usuario.
        Si quien ejecuta es el propio usuario, no hay reembolso (ya pagó su gas). */
    function _reembolsarGas(address usuario, Rejilla storage r, uint256 gasIni) internal {
        if (msg.sender != keeper) return;
        uint256 usado = (gasIni - gasleft()) + gasOverhead;
        uint256 costo = usado * tx.gasprice;
        uint256 saldo = gasSaldo[usuario];
        uint256 pago = costo > saldo ? saldo : costo;
        if (pago == 0) return;
        gasSaldo[usuario] = saldo - pago;
        r.gasGastadoWei += pago;
        (bool ok, ) = payable(keeper).call{value: pago}("");
        require(ok);
        emit GasReembolsado(usuario, keeper, pago);
    }

    /* ═══════════════════════ Bot Acumulador ═══════════════════════ */

    /** Vende TODA la posición acumulada, solo si está en ganancia >= objetivo.
     *  No cierra el bot: re-arma las compras y sigue trabajando (infinito). */
    /* ═══════════════════════ Bot DCA (modo 3) ═══════════════════════ */
    /** Compra `ordenQuote` de quote->base a la wallet del usuario, cuando ya pasó el
     *  intervalo desde la última compra. Disparo por TIEMPO (no por precio). */
    function comprarDCA(bytes32 k) public noReentrada {
        uint256 gasIni = gasleft();
        require(!pausado);
        address usuario = duenoDe[k];
        require(usuario != address(0));
        require(msg.sender == keeper || msg.sender == usuario);
        require(activo(usuario));
        Rejilla storage r = rejillas[k];
        require(r.activa);
        require(r.modo == 3);
        require(block.timestamp >= uint256(r.ultimaOpEn) + r.intervalo);
        if (msg.sender == keeper) require(gasSaldo[usuario] >= gasMinOp);

        (uint256 baseOut, uint256 quoteIn) = _paso(usuario, r.quote, r.base, r.feeTier, r.ordenQuote, 0, r.slippageBps);
        _contabilizarCompra(r, baseOut, quoteIn);
        r.comprasHechas += 1;
        r.ultimaOpEn = uint64(block.timestamp);
        if (r.comprasMax > 0 && r.comprasHechas >= r.comprasMax) r.activa = false;

        emit Ejecutado(usuario, k, 0, true, quoteIn, baseOut);
        _notificarOp(usuario, k, true, quoteIn, baseOut, r.gananciaQuote);
        _reembolsarGas(usuario, r, gasIni);
    }

    function venderAcumulado(address usuario, address base, address quote) external {
        venderAcumulado(clave(usuario, base, quote));
    }
    function venderAcumulado(bytes32 k) public noReentrada {
        uint256 gasIni = gasleft();
        require(!pausado);
        address usuario = duenoDe[k];
        require(usuario != address(0));
        require(msg.sender == keeper || msg.sender == usuario);
        require(activo(usuario));
        Rejilla storage r = rejillas[k];
        require(r.activa);
        require(r.modo == 1);
        require(r.posicionBase > 0);
        if (msg.sender == keeper) require(gasSaldo[usuario] >= gasMinOp);

        uint256 vender = r.posicionBase;
        uint256 saldoU = IERC20(r.base).balanceOf(usuario);
        uint256 permiso = IERC20(r.base).allowance(usuario, address(this));
        if (vender > saldoU)  vender = saldoU;
        if (vender > permiso) vender = permiso;
        require(vender > 0);

        // Exigir ganancia: lo que rinde vender >= coste proporcional + objetivo.
        uint256 valor = _quote(r.base, r.quote, r.feeTier, vender);
        uint256 costeProp = vender >= r.posicionBase ? r.costeQuote : (r.costeQuote * vender) / r.posicionBase;
        require(valor * BPS >= costeProp * (BPS + r.objetivoBps));

        uint256 recibido = _pull(r.base, usuario, vender);
        uint256 qG = _quote(r.base, r.quote, r.feeTier, recibido);
        uint256 quoteOut = _comisionYSwap(usuario, r.base, r.quote, r.feeTier, recibido, qG, r.slippageBps);
        _contabilizarVenta(r, recibido, quoteOut);
        r.ventasHechas += 1;
        r.ultimaOpEn = uint64(block.timestamp);

        // Re-armar TODOS los niveles como compra y seguir (bot infinito).
        uint256 n = r.niveles.length;
        for (uint256 i = 0; i < n; i++) r.niveles[i].estado = 1;

        emit Ejecutado(usuario, k, n, false, recibido, quoteOut);
        _notificarOp(usuario, k, false, recibido, quoteOut, r.gananciaQuote);
        _reembolsarGas(usuario, r, gasIni);
    }

    /** Lee el modo del bot (para el keeper): 0 = rejilla · 1 = acumulador, y su objetivo. */
    function modoDe(address usuario, address base, address quote) external view returns (uint8 modo, uint16 objetivoBps) {
        return modoDe(clave(usuario, base, quote));
    }
    function modoDe(bytes32 k) public view returns (uint8 modo, uint16 objetivoBps) {
        Rejilla storage r = rejillas[k];
        return (r.modo, r.objetivoBps);
    }

    /* ═══════════════════════ Suscripción mensual ═══════════════════════ */

    /** Paga la suscripción (BNB fijo) y habilita 30 días. El BNB va DIRECTO al owner. */
    function suscribir() external payable noReentrada {
        require(precioSuscripcion > 0);
        require(msg.value >= precioSuscripcion);
        uint256 desde = suscritoHasta[msg.sender] > block.timestamp ? suscritoHasta[msg.sender] : block.timestamp;
        uint256 hasta = desde + MES;
        suscritoHasta[msg.sender] = hasta;
        (bool ok, ) = payable(owner).call{value: msg.value}("");
        require(ok);
        emit SuscripcionPagada(msg.sender, msg.value, hasta);
    }

    /** ¿El usuario tiene el mes activo? */
    function activo(address usuario) public view returns (bool) {
        return suscritoHasta[usuario] >= block.timestamp;
    }

    /** Fija el precio de la suscripción en wei de BNB (ej. ~$1). */
    function setPrecioSuscripcion(uint256 wei_) external soloOwner { precioSuscripcion = wei_; }

    /* ── Notificación al módulo externo (opcional). Aislada: gas topado y
       envuelta en try/catch → si el módulo falla o es malicioso, NO revierte
       la operación del usuario y NO tiene ningún poder sobre los fondos. ── */
    function _notificarOp(address usuario, bytes32 k, bool compra, uint256 entrada, uint256 salida, int256 gAcum) internal {
        address m = modulo;
        if (m == address(0)) return;
        try IGridModulo(m).alOperar{gas: 120000}(usuario, k, compra, entrada, salida, gAcum) {} catch {}
    }
    function _notificarCierre(address usuario, bytes32 k, bool porTPSL, uint256 quoteRecibido) internal {
        address m = modulo;
        if (m == address(0)) return;
        try IGridModulo(m).alCerrar{gas: 120000}(usuario, k, porTPSL, quoteRecibido) {} catch {}
    }

    /* ═══════════════════════ Usuario: crear / reconfigurar ═══════════════════════ */

    /**
     * Crea o RECONFIGURA la rejilla del que llama. Reconfigurar (misma pareja)
     * CONSERVA historial y posición: creadaEn, ganancias, volumen, contadores y
     * posicionBase/costeQuote. Así se cambia nº de cuadrículas (50→65), rango o
     * tamaño de orden en caliente sin perder el panel ni la posición.
     * El usuario debe APROBAR este contrato para gastar base y quote (en la web).
     */
    function crearRejilla(ConfigIn calldata c) external noReentrada {
        require(c.base != address(0) && c.quote != address(0) && c.base != c.quote);
        require(c.niveles.length > 0 && c.niveles.length <= MAX_NIV);
        require(c.ordenQuote > 0);
        if (c.modo != 3) require(c.ordenBase > 0);   // DCA (modo 3) solo compra: no usa ordenBase
        if (c.modo == 3) require(c.intervalo > 0);
        uint16 slip = c.slippageBps == 0 ? uint16(slippageMax) : c.slippageBps;
        require(slip <= SLIP_MAX);
        require(c.feeTier == 100 || c.feeTier == 500 || c.feeTier == 2500 || c.feeTier == 10000);
        require(activo(msg.sender));

        bytes32 k = claveBot(msg.sender, c.base, c.quote, c.botId);
        Rejilla storage r = rejillas[k];
        bool primeraVez = duenoDe[k] == address(0);
        bool fresco = !r.activa;   // cerrado o nunca creado -> arranque limpio: resetea stats y compra inicial
        if (fresco) {
            r.posicionBase = 0; r.costeQuote = 0; r.volumenQuote = 0;
            r.gananciaQuote = 0; r.gasGastadoWei = 0;
            r.comprasHechas = 0; r.ventasHechas = 0; r.ciclos = 0;
            r.creadaEn = uint64(block.timestamp);
        }

        delete r.niveles;
        r.base = c.base; r.quote = c.quote;
        r.ordenQuote = c.ordenQuote; r.ordenBase = c.ordenBase;
        r.slippageBps = slip; r.cooldownSeg = c.cooldownSeg;
        r.tpUnitOut = c.tpUnitOut; r.slUnitOut = c.slUnitOut;
        r.feeTier = c.feeTier;
        r.modo = c.modo;
        r.objetivoBps = c.objetivoBps;
        r.factorBps = c.factorBps;
        r.margenBps = c.margenBps;
        r.intervalo = c.intervalo;
        r.comprasMax = c.comprasMax;
        require(c.margenBps <= 5000);
        if (c.modo == 1) require(c.objetivoBps >= 10 && c.objetivoBps <= 10000);
        r.activa = true;

        if (primeraVez) {
            clavesDe[msg.sender].push(k);
            duenoDe[k] = msg.sender;
        }

        for (uint256 j = 0; j < c.niveles.length; j++) {
            require(c.niveles[j].estado <= 2);
            r.niveles.push(Nivel(c.niveles[j].minOutCompra, c.niveles[j].minOutVenta, c.niveles[j].estado));
        }
        // ═══ POSICIÓN INICIAL (grid real) ═══
        // Compra a mercado, en UNA sola operación, el inventario que necesitan las
        // ventas armadas (parte de arriba). Así hay posición desde el primer segundo
        // y la ganancia/pérdida no realizada se mueve con el mercado, como Pionex.
        if (fresco) {
            uint256 gastar = 0;
            if (c.modo == 1) {
                gastar = c.compraInicialQuote;          // acumulador: compra inicial a mercado (ej. 30%)
            } else if (c.modo == 0) {
                uint256 nSells = 0;
                for (uint256 s = 0; s < r.niveles.length; s++) if (r.niveles[s].estado == 2) nSells++;
                gastar = nSells * r.ordenQuote;          // grid: inventario de las ventas armadas
            } else if (c.modo == 3) {
                gastar = c.ordenQuote;                   // DCA: la primera compra se hace al crear
            }
            // modo 2 (Auto-Sell): no compra nada; el usuario ya tiene la cripto en su wallet.
            if (gastar > 0) {
                (uint256 baseOut, uint256 quoteIn) = _paso(msg.sender, r.quote, r.base, r.feeTier, gastar, 0, slip);
                _contabilizarCompra(r, baseOut, quoteIn);
                r.comprasHechas += 1;
                r.ultimaOpEn = uint64(block.timestamp);
                emit Ejecutado(msg.sender, k, 0, true, quoteIn, baseOut);
            }
            if (c.modo == 3 && r.comprasMax > 0 && r.comprasHechas >= r.comprasMax) r.activa = false;
        }
        // Auto-Sell (modo 2): registra la posición que el usuario YA tiene (no la compra).
        if (c.modo == 2 && fresco) {
            r.posicionBase = c.ordenBase;          // cantidad declarada a vender (vive en la wallet del usuario)
            r.costeQuote = c.compraInicialQuote;   // valor actual declarado (para calcular la ganancia real)
        }
        emit RejillaCreada(msg.sender, c.base, c.quote, k, c.niveles.length, fresco);
    }

    function activarRejilla(address base, address quote, bool activa) external {
        activarRejilla(clave(msg.sender, base, quote), activa);
    }
    function activarRejilla(bytes32 k, bool activa) public {
        require(duenoDe[k] == msg.sender);
        rejillas[k].activa = activa;
        emit RejillaActiva(k, activa);
    }

    function ajustarSlippage(address base, address quote, uint16 slippageBps) external {
        bytes32 k = _keyDe(msg.sender, base, quote);
        require(slippageBps > 0 && slippageBps <= SLIP_MAX);
        rejillas[k].slippageBps = slippageBps;
        emit Ajuste(k, "slippage", slippageBps, 0);
    }

    function ajustarCooldown(address base, address quote, uint32 cooldownSeg) external {
        bytes32 k = _keyDe(msg.sender, base, quote);
        rejillas[k].cooldownSeg = cooldownSeg;
        emit Ajuste(k, "cooldown", cooldownSeg, 0);
    }

    /** Fija/actualiza Take-Profit y Stop-Loss en caliente (0 = desactivar). */
    function setTPSL(address base, address quote, uint128 tpUnitOut, uint128 slUnitOut) external {
        bytes32 k = _keyDe(msg.sender, base, quote);
        rejillas[k].tpUnitOut = tpUnitOut;
        rejillas[k].slUnitOut = slUnitOut;
        emit Ajuste(k, "tpsl", tpUnitOut, slUnitOut);
    }

    /** Apaga la rejilla sin vender (el usuario conserva su posición en base). */
    function cancelarRejilla(address base, address quote) external {
        cancelarRejilla(clave(msg.sender, base, quote));
    }
    function cancelarRejilla(bytes32 k) public {
        require(duenoDe[k] == msg.sender);
        delete rejillas[k].niveles;
        rejillas[k].activa = false;
        emit RejillaCancelada(msg.sender, k);
    }

    /** Cierra AHORA: liquida la posición de la rejilla a quote y la apaga. */
    function cerrarAhora(address base, address quote) external {
        cerrarAhora(clave(msg.sender, base, quote));
    }
    function cerrarAhora(bytes32 k) public noReentrada {
        require(duenoDe[k] == msg.sender);
        _cerrar(msg.sender, k, false);
    }

    /* ═══════════════════════ Keeper: ejecutar / cerrar ═══════════════════════ */

    /**
     * Dispara el nivel `i`. Lo puede llamar el KEEPER o el propio DUEÑO de la
     * rejilla (resiliencia: si el keeper se cae, el usuario no queda atrapado).
     * Verifica estado + precio on-chain, cambia el token, manda el resultado al
     * usuario y re-arma el vecino. El destino del swap es SIEMPRE el usuario.
     */
    function ejecutar(address usuario, address base, address quote, uint256 i) external {
        ejecutar(clave(usuario, base, quote), i);
    }
    function ejecutar(bytes32 k, uint256 i)
        public noReentrada
    {
        uint256 gasIni = gasleft();
        require(!pausado);
        address usuario = duenoDe[k];
        require(usuario != address(0));
        require(msg.sender == keeper || msg.sender == usuario);
        Rejilla storage r = rejillas[k];
        require(r.activa);
        require(activo(usuario));
        require(i < r.niveles.length);
        // El keeper solo opera si el usuario tiene gas para reembolsar. Si el
        // dueño ejecuta su propia rejilla, paga su gas y no necesita tanque.
        if (msg.sender == keeper) require(gasSaldo[usuario] >= gasMinOp);
        if (r.cooldownSeg > 0) require(block.timestamp >= r.ultimaOpEn + r.cooldownSeg);

        Nivel storage nv = r.niveles[i];
        uint256 len = r.niveles.length;

        if (nv.estado == 1) {
            // Acumulador: más volumen mientras más abajo (promedia mejor el precio).
            uint256 montoC = r.ordenQuote;
            if (r.modo == 1 && r.factorBps > 0) montoC = r.ordenQuote * (BPS + uint256(r.factorBps) * (len - 1 - i)) / BPS;
            (uint256 baseOut, uint256 quoteIn) =
                _paso(usuario, r.quote, r.base, r.feeTier, montoC, nv.minOutCompra, r.slippageBps);
            nv.estado = 0;
            r.comprasHechas += 1;
            r.ultimaOpEn = uint64(block.timestamp);
            _contabilizarCompra(r, baseOut, quoteIn);
            if (r.modo == 0 && i + 1 < len) r.niveles[i + 1].estado = 2;
            emit Ejecutado(usuario, k, i, true, quoteIn, baseOut);
            _notificarOp(usuario, k, true, quoteIn, baseOut, r.gananciaQuote);
        } else if (nv.estado == 2) {
            // Venta inteligente: no vender bajo (coste promedio del tramo + margen).
            uint256 minV = nv.minOutVenta;
            if (r.margenBps > 0 && r.posicionBase > 0) {
                uint256 costeOrden = r.costeQuote * r.ordenBase / r.posicionBase;   // coste del ordenBase que se vende
                uint256 minMargen = costeOrden * (BPS + r.margenBps) / BPS;
                if (minMargen > minV) minV = minMargen;
            }
            (uint256 quoteOut, uint256 baseIn) =
                _paso(usuario, r.base, r.quote, r.feeTier, r.ordenBase, minV, r.slippageBps);
            nv.estado = 0;
            r.ventasHechas += 1;
            r.ultimaOpEn = uint64(block.timestamp);
            _contabilizarVenta(r, baseIn, quoteOut);
            if (r.modo == 2) { r.activa = false; }          // Auto-Sell: vende una vez y se cierra
            else if (i > 0) { r.niveles[i - 1].estado = 1; }
            emit Ejecutado(usuario, k, i, false, baseIn, quoteOut);
            _notificarOp(usuario, k, false, baseIn, quoteOut, r.gananciaQuote);
        } else {
            revert();
        }
        _reembolsarGas(usuario, r, gasIni);
    }

    /**
     * Cierre por Take-Profit / Stop-Loss. Solo keeper, pero SOLO se ejecuta si
     * el precio de Pancake de verdad alcanzó el TP o el SL (verificado aquí).
     * Liquida la posición a quote y la manda al usuario. No puede abusar.
     */
    function cerrarPorTPSL(address usuario, address base, address quote)
        external noReentrada
    {
        require(!pausado);
        require(msg.sender == keeper || msg.sender == usuario);
        bytes32 k = clave(usuario, base, quote);
        _cerrar(usuario, k, true);
    }

    /* ───────────────────────────── Internas ───────────────────────────── */

    /** Revierte si el precio no alcanzó ni el Take-Profit ni el Stop-Loss. */
    function _requiereTPSL(Rejilla storage r) internal {
        uint256 precio = _quote(r.base, r.quote, r.feeTier, r.ordenBase);
        require(
            (r.tpUnitOut > 0 && precio >= r.tpUnitOut) || (r.slUnitOut > 0 && precio <= r.slUnitOut),
            "TP/SL no alcanzado"
        );
    }

    function _cerrar(address usuario, bytes32 k, bool porTPSL) internal {
        uint256 gasIni = gasleft();
        Rejilla storage r = rejillas[k];
        require(r.ordenBase > 0);
        if (msg.sender == keeper) require(gasSaldo[usuario] >= gasMinOp);

        if (porTPSL) _requiereTPSL(r);

        // Liquida solo lo que la rejilla acumuló, acotado por saldo/allowance del usuario.
        uint256 vender = r.posicionBase;
        uint256 saldoU = IERC20(r.base).balanceOf(usuario);
        uint256 permiso = IERC20(r.base).allowance(usuario, address(this));
        if (vender > saldoU)  vender = saldoU;
        if (vender > permiso) vender = permiso;

        uint256 recibido; uint256 quoteOut;
        if (vender > 0) {
            recibido = _pull(r.base, usuario, vender);
            uint256 qG = _quote(r.base, r.quote, r.feeTier, recibido);
            quoteOut = _comisionYSwap(usuario, r.base, r.quote, r.feeTier, recibido, qG, r.slippageBps);
            _contabilizarVenta(r, recibido, quoteOut);
            r.ventasHechas += 1;
            r.ultimaOpEn = uint64(block.timestamp);
        }

        r.activa = false;
        uint256 n = r.niveles.length;
        for (uint256 i = 0; i < n; i++) r.niveles[i].estado = 0;
        emit Cerrada(usuario, k, porTPSL, recibido, quoteOut);
        _notificarCierre(usuario, k, porTPSL, quoteOut);
        _reembolsarGas(usuario, r, gasIni);
    }

    /** Cotiza (QuoterV2) cuánto rinde `amountIn` de tokenIn en tokenOut, pool `fee`. */
    function _quote(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn) internal returns (uint256 out) {
        (out, , , ) = IQuoterV2(QUOTER_V3).quoteExactInputSingle(
            IQuoterV2.QuoteExactInputSingleParams({
                tokenIn: tokenIn, tokenOut: tokenOut, amountIn: amountIn, fee: fee, sqrtPriceLimitX96: 0
            })
        );
    }

    /** Un paso de rejilla: trae, verifica que el precio alcanzó el nivel, comisión y swap V3. */
    function _paso(
        address usuario, address tokenIn, address tokenOut, uint24 fee,
        uint256 amountIn, uint256 minOutNivel, uint16 slip
    ) internal returns (uint256 salida, uint256 entradaReal) {
        entradaReal = _pull(tokenIn, usuario, amountIn);
        uint256 qGross = _quote(tokenIn, tokenOut, fee, entradaReal);
        require(qGross >= minOutNivel);
        salida = _comisionYSwap(usuario, tokenIn, tokenOut, fee, entradaReal, qGross, slip);
    }

    /** Jala `amountIn` del usuario y devuelve lo realmente recibido (fee-on-transfer). */
    function _pull(address tokenIn, address usuario, uint256 amountIn) internal returns (uint256 recibido) {
        require(amountIn > 0);
        uint256 antes = IERC20(tokenIn).balanceOf(address(this));
        tokenIn.safeTransferFrom(usuario, address(this), amountIn);
        recibido = IERC20(tokenIn).balanceOf(address(this)) - antes;
        require(recibido > 0);
    }

    /** Comisión sobre `recibido`, swap del neto por V3 con slippage y salida al usuario. */
    function _comisionYSwap(
        address usuario, address tokenIn, address tokenOut, uint24 fee,
        uint256 recibido, uint256 qGross, uint16 slip
    ) internal returns (uint256 salida) {
        uint256 net = _netoTrasComision(tokenIn, recibido);
        // minOut real: proporcional al neto (tras comisión) con margen de slippage
        uint256 minReal = (qGross * net / recibido) * (BPS - slip) / BPS;
        uint256 balAntes = IERC20(tokenOut).balanceOf(usuario);
        tokenIn.forceApprove(ROUTER_V3, net);
        IV3SwapRouter(ROUTER_V3).exactInputSingle(
            IV3SwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn, tokenOut: tokenOut, fee: fee, recipient: usuario,
                deadline: block.timestamp, amountIn: net, amountOutMinimum: minReal, sqrtPriceLimitX96: 0
            })
        );
        salida = IERC20(tokenOut).balanceOf(usuario) - balAntes;
    }

    /** Cobra la comisión sobre `recibido` y devuelve el neto a intercambiar. */
    function _netoTrasComision(address tokenIn, uint256 recibido) internal returns (uint256 net) {
        uint256 fee = (recibido * feeBps) / BPS;
        net = recibido - fee;
        _cobrarComision(tokenIn, fee);
    }

    function _contabilizarCompra(Rejilla storage r, uint256 baseComprada, uint256 quoteGastado) internal {
        r.posicionBase += baseComprada;
        r.costeQuote   += quoteGastado;
        r.volumenQuote += quoteGastado;
    }

    /** PnL realizada por coste promedio ponderado. */
    function _contabilizarVenta(Rejilla storage r, uint256 baseVendida, uint256 proceeds) internal {
        uint256 costeVendido = 0;
        if (r.posicionBase > 0) {
            uint256 baseCoste = baseVendida <= r.posicionBase ? baseVendida : r.posicionBase;
            costeVendido = (r.costeQuote * baseCoste) / r.posicionBase;
            r.posicionBase -= baseCoste;
            r.costeQuote   -= costeVendido;
            r.ciclos       += 1;
        }
        r.gananciaQuote += int256(proceeds) - int256(costeVendido);
        r.volumenQuote  += proceeds;
    }

    /** Reparte la comisión: parte a la banca de la lotería, resto al owner. */
    function _cobrarComision(address tokenIn, uint256 fee) internal {
        if (fee == 0) return;
        uint256 aBanca = (fee * bancaShareBps) / BPS;
        uint256 aOwner = fee - aBanca;
        bool puedeBanca = aBanca > 0
            && bolita != address(0)
            && IBolita(bolita).monedaRegistrada(tokenIn)
            && IBolita(bolita).aportadorBot() == address(this);
        if (puedeBanca) {
            tokenIn.forceApprove(bolita, aBanca);
            IBolita(bolita).aportarDesdeBot(tokenIn, aBanca);
        } else {
            aOwner += aBanca; aBanca = 0;
        }
        if (aOwner > 0) tokenIn.safeTransfer(beneficiario, aOwner);
        emit Comision(tokenIn, aBanca, aOwner);
    }

    function _keyDe(address usuario, address base, address quote) internal view returns (bytes32 k) {
        k = clave(usuario, base, quote);
        require(duenoDe[k] == usuario);
    }

    /* ═══════════════════════════ Lecturas (web / keeper) ════════════════════ */

    function claveBot(address usuario, address base, address quote, uint256 botId) public pure returns (bytes32) {
        if (botId == 0) return clave(usuario, base, quote);
        return keccak256(abi.encodePacked(usuario, base, quote, botId));
    }
    function clave(address usuario, address base, address quote) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(usuario, base, quote));
    }

    function nivelesDe(bytes32 k) external view returns (Nivel[] memory) { return rejillas[k].niveles; }

    function misRejillas(address usuario) external view returns (bytes32[] memory) { return clavesDe[usuario]; }

    /** Todo el panel del usuario en una sola llamada. */
    function resumen(address usuario, address base, address quote) external view returns (Resumen memory R) {
        return resumen(clave(usuario, base, quote));
    }
    function resumen(bytes32 k) public view returns (Resumen memory R) {
        Rejilla storage r = rejillas[k];
        address usuario = duenoDe[k];
        uint256 arm; uint256 n = r.niveles.length;
        for (uint256 i = 0; i < n; i++) if (r.niveles[i].estado != 0) arm++;
        R = Resumen({
            base: r.base, quote: r.quote, activa: r.activa,
            niveles: n, armados: arm,
            creadaEn: r.creadaEn, ultimaOpEn: r.ultimaOpEn,
            comprasHechas: r.comprasHechas, ventasHechas: r.ventasHechas, ciclos: r.ciclos,
            totalOps: uint256(r.comprasHechas) + uint256(r.ventasHechas),
            posicionBase: r.posicionBase, costeQuote: r.costeQuote,
            volumenQuote: r.volumenQuote, gananciaQuote: r.gananciaQuote,
            gasSaldoWei: gasSaldo[usuario], gasGastadoWei: r.gasGastadoWei,
            ordenQuote: r.ordenQuote, ordenBase: r.ordenBase,
            tpUnitOut: r.tpUnitOut, slUnitOut: r.slUnitOut,
            slippageBps: r.slippageBps, cooldownSeg: r.cooldownSeg,
            feeTier: r.feeTier,
            intervalo: r.intervalo, comprasMax: r.comprasMax
        });
    }

    /* ═════════════════════════ Owner: solo parámetros ═══════════════════════ */

    function setKeeper(address k) external soloOwner { keeper = k; emit ParamCambiado("keeper", k); }
    function setBeneficiario(address b) external soloOwner { require(b != address(0)); beneficiario = b; emit ParamCambiado("beneficiario", b); }
    function setBolita(address b) external soloOwner { bolita = b; emit ParamCambiado("bolita", b); }

    /** Enchufa/quita el módulo de lógica futura (address(0) = ninguno).
        El módulo solo recibe notificaciones; nunca toca fondos. */
    function setModulo(address m) external soloOwner { modulo = m; emit ParamCambiado("modulo", m); }

    function setComision(uint256 _feeBps, uint256 _bancaShareBps) external soloOwner {
        require(_feeBps <= FEE_MAX);
        require(_bancaShareBps <= BPS);
        feeBps = _feeBps; bancaShareBps = _bancaShareBps;
    }

    function setSlippageMax(uint256 s) external soloOwner { require(s <= SLIP_MAX); slippageMax = s; }
    function setPausado(bool p) external soloOwner { pausado = p; }

    /** Ajusta el mínimo de gas exigido por op y el overhead de reembolso. */
    function setGasMinOp(uint256 wei_) external soloOwner { gasMinOp = wei_; }
    function setGasOverhead(uint256 g) external soloOwner { require(g <= 200000); gasOverhead = g; }

    /** Transferencia de owner en DOS pasos (el nuevo debe aceptar). Evita
        perder el control por poner una dirección equivocada. */
    function transferirOwner(address n) external soloOwner {
        require(n != address(0));
        ownerPendiente = n;
        emit ParamCambiado("ownerPendiente", n);
    }
    function aceptarOwner() external {
        require(msg.sender == ownerPendiente);
        owner = ownerPendiente;
        ownerPendiente = address(0);
        emit ParamCambiado("owner", owner);
    }

    /* ---- Catálogo de monedas para la UI (no limita el trading) ---- */

    /** Habilita/actualiza una moneda en el catálogo que muestra la web. */
    function agregarToken(address token, string calldata simbolo) external soloOwner {
        require(token != address(0));
        if (!_vistoToken[token]) { _vistoToken[token] = true; tokens.push(token); }
        tokenInfo[token] = TokenInfo(true, simbolo);
        emit TokenListado(token, simbolo, true);
    }

    /** Oculta una moneda del catálogo (no borra: la web filtra por 'activo'). */
    function quitarToken(address token) external soloOwner {
        tokenInfo[token].activo = false;
        emit TokenListado(token, tokenInfo[token].simbolo, false);
    }

    function tokensListados() external view returns (address[] memory) { return tokens; }
    function numTokens() external view returns (uint256) { return tokens.length; }

    /** Todo lo del panel admin (owner + banca) en una sola llamada. */
    function configAdmin() external view returns (
        address _owner, address _keeper, address _beneficiario, address _bolita,
        uint256 _feeBps, uint256 _bancaShareBps, uint256 _slippageMax, bool _pausado, uint256 _numTokens
    ) {
        return (owner, keeper, beneficiario, bolita, feeBps, bancaShareBps, slippageMax, pausado, tokens.length);
    }

    /**
     * Rescata SOLO el saldo propio del contrato (polvo de comisión / fee-on-
     * transfer). En operación normal el contrato no retiene fondos de usuarios.
     */
    function rescatarResiduo(address token, address para) external soloOwner noReentrada {
        require(para != address(0));
        uint256 b = IERC20(token).balanceOf(address(this));
        require(b > 0);
        token.safeTransfer(para, b);
    }

    /* ---- Suscripción: BNB fijo cada 30 días, va DIRECTO al owner ---- */
    uint256 public precioSuscripcion;                 // wei de BNB por 30 días (lo fija el owner)
    mapping(address => uint256) public suscritoHasta; // timestamp hasta el que el usuario está activo

    /** Reserva de espacio para nuevas variables en futuras versiones (no tocar). */
    uint256[43] private __gap;
}
