// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/* ─────────────────────────────────────────────────────────────────────────
   Terminal.sol — contrato-hub de la sección TERMINAL de DecFreedom.
   Proxy UUPS (este es el contrato de implementación). Multi-owner. No custodial.
   Interconectado al ecosistema: Staking, Contabilidad y Oráculo de precios.

   Qué hace (un solo contrato para toda la sección Terminal):
     1) SWAP de tokens recién nacidos (PancakeSwap V2): comprar (BNB -> token) y vender
        (token -> BNB). Los tokens salen del router DIRECTO a la wallet del usuario.
        Soporta tokens con impuesto. Cobra el 1% (tope fijo) sobre el BNB.
     2) REFERIDOS: este contrato ES la base de datos de referidos de la plataforma
        (on-chain, sin servidor). Guarda quién trajo a quién (se fija una sola vez) y
        paga al referidor su parte en cada intercambio/suscripción.
     3) SUSCRIPCIONES por servicio (Prime Mover, Top Movers, Recent Activity, Security
        Check, Protect): precio anclado a USD y cobrado en su equivalente en BNB vía el
        Oráculo. 30 días, renovable (suma sobre lo que quedaba). Los owners NO pagan.
     4) CONTABILIDAD: reporta a Contabilidad lo generado por la sección Terminal.

   Reparto de la comisión (1%) y de cada suscripción, SIEMPRE con referidos:
     · 0.10% (10% del cobro) al Staking  [base]
     · 0.10% (10% del cobro) al Referidor; si NO hay referidor, ese 0.10% se suma al
       Staking (de modo que el Staking recibe 0.20% cuando no hay referidor).
     · 0.80% (80% del cobro) a los owners, 0.40%/0.40% (owner1/owner2).
     Tres/cuatro envíos separados. Si un destino rechaza BNB, su parte queda retirable
     (pull) y NUNCA bloquea el flujo. Si el Staking no acepta, su parte va a los owners.

   Seguridad: pragma fijo, guard de reentrancia, pausa de emergencia, comisión con tope
   en el código (1%), minOut y deadline los fija el usuario (slippage), envío seguro a los
   destinos, el router solo lo cambia un owner, y receive() solo acepta BNB del router.
   El contrato nace SABIENDO quién es owner1 y owner2 (initialize revierte si faltan).
   ───────────────────────────────────────────────────────────────────────── */

interface IRouterV2 {
    function WETH() external pure returns (address);
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
    function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external;
}
interface IContabilidadT { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; }
// Oráculo ya desplegado del ecosistema (OraculoPrecios). precioUSD(address(0)) = USD por 1 BNB (18 dec).
interface IOraculoT { function precioUSD(address token) external view returns (uint256); }

contract Terminal is Initializable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    /* ─────────── Roles e interconexión ─────────── */
    mapping(address => bool) public esOwner;
    address[] private ownersList;
    address public owner1;
    address public owner2;
    address public owner1Propuesto;        // handover en dos pasos
    address public owner2Propuesto;
    address public staking;
    address public contabilidad;
    address public oraculo;
    address public router;                 // PancakeSwap V2 Router
    address public wbnb;                   // leído del router al inicializar
    address public usdt;                   // ruta BNB -> USDT -> token para pares contra USDT

    /* ─────────── Comisión y reparto ─────────── */
    uint256 public constant BPS = 10000;
    uint256 public constant FEE_MAX_BPS = 100;        // 1%: tope fijo en el código
    uint256 public feeBps;                             // comisión sobre el BNB
    uint256 public stakingBps;                         // parte del cobro al staking (1000 = 10% del cobro = 0.10% del volumen)
    uint256 public refBps;                             // parte del cobro al referidor (1000 = 10% del cobro = 0.10% del volumen)
    bytes32 public constant CLAVE_CONT = keccak256("terminal");

    /* ─────────── Referidos (base de datos on-chain) ─────────── */
    mapping(address => address) public referidoDe;     // wallet => quién la trajo (se fija una vez)
    mapping(address => uint256) public ganadoRef;      // referidor => BNB total ganado (estadística)
    mapping(address => uint256) public refContar;      // referidor => nº de wallets que trajo

    /* ─────────── Suscripciones por servicio ─────────── */
    uint256 public constant SUB_DIAS = 30;
    mapping(bytes32 => uint256) public precioUSD;                       // servicio => precio en USD (18 dec). 2.5e18 = $2.50
    mapping(bytes32 => bool)    public servicioActivo;                  // servicio habilitado para cobrar
    mapping(address => mapping(bytes32 => uint256)) public expira;      // wallet => servicio => timestamp de expiración

    /* ─────────── Pull de BNB no entregado ─────────── */
    mapping(address => uint256) public saldoRetirable;
    bool public pausado;
    bool private _entrada;

    /* ─────────── Estadísticas (lectura) ─────────── */
    uint256 public volumenBNB;             // BNB operado en swaps
    uint256 public comisionBNB;            // comisión total retenida en swaps
    uint256 public ingresoSubBNB;          // BNB cobrado por suscripciones
    uint256 public operaciones;            // nº de swaps
    uint256 public suscripciones;          // nº de suscripciones cobradas

    /* ─────────── Eventos ─────────── */
    event Compra(address indexed wallet, address indexed token, address quote, uint256 bnbIn, uint256 bnbNeto, uint256 comision);
    event Venta(address indexed wallet, address indexed token, address quote, uint256 tokIn, uint256 bnbOut, uint256 comision);
    event Suscripcion(address indexed wallet, bytes32 indexed servicio, uint256 pagadoWei, uint256 expira);
    event Repartida(address indexed quien, bytes32 indexed servicio, uint256 aStaking, uint256 aRef, address ref, uint256 aOwner1, uint256 aOwner2, bool stakingOk);
    event ReferidoFijado(address indexed wallet, address indexed referidor);
    event PrecioServicio(bytes32 indexed servicio, uint256 usd, bool activo);
    event OwnerCambiado(address indexed quien, bool esOwner);
    event OwnerPropuesto(uint8 cual, address propuesto);
    event ParamCambiado(string nombre, address valor);
    event ComisionConfigurada(uint256 feeBps, uint256 stakingBps, uint256 refBps);
    event Pausa(bool pausado);
    event Retiro(address indexed quien, uint256 monto);

    error NoAutorizado(); error Reentrada(); error Pausado(); error Params(); error Cantidad();
    error Ruta(); error Vencido(); error Servicio(); error Oraculo(); error PagoInsuf();

    modifier soloOwner() { if (!esOwner[msg.sender]) revert NoAutorizado(); _; }
    modifier noReentrada() { if (_entrada) revert Reentrada(); _entrada = true; _; _entrada = false; }
    modifier activo() { if (pausado) revert Pausado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    /** _owner1 y _owner2: los dos owners (pueden ser hoy la misma wallet, se tratan como dos destinos).
        _router: PancakeSwap V2 Router (0x10ED43C718714eb63d5aA57B78B54704E256024E). _usdt: USDT de BNB Chain.
        El contrato queda con owners CONOCIDOS desde el inicio y con los 6 servicios y sus precios cargados. */
    function initialize(
        address _owner1,
        address _owner2,
        address _staking,
        address _contabilidad,
        address _oraculo,
        address _router,
        address _usdt
    ) external initializer {
        if (_owner1 == address(0) || _owner2 == address(0) || _router == address(0) || _usdt == address(0)) revert Params();
        owner1 = _owner1; owner2 = _owner2;
        staking = _staking; contabilidad = _contabilidad; oraculo = _oraculo;
        router = _router; usdt = _usdt;
        wbnb = IRouterV2(_router).WETH();
        feeBps = 100;        // 1%
        stakingBps = 1000;   // 10% del cobro = 0.10% del volumen
        refBps = 1000;       // 10% del cobro = 0.10% del volumen
        _addOwner(_owner1); _addOwner(_owner2);

        // Servicios y precios por defecto (claves = keccak256 del nombre, igual que el front: ethers.id(nombre)).
        _setPrecio(keccak256("prime"),        25e17, true);  // $2.50
        _setPrecio(keccak256("movers"),       25e17, true);  // $2.50
        _setPrecio(keccak256("acts"),         25e17, true);  // $2.50
        _setPrecio(keccak256("checks-lobby"), 1e18,  true);  // $1.00 (vista rápida ~10%)
        _setPrecio(keccak256("checks-ofc"),   25e17, true);  // $2.50 (reporte completo)
        _setPrecio(keccak256("protect"),      25e17, true);  // $2.50

        emit ComisionConfigurada(feeBps, stakingBps, refBps);
    }

    function _authorizeUpgrade(address) internal override soloOwner {}

    /* ═══════════ Comprar: BNB -> token ═══════════ */
    function comprar(address token, address quote, uint256 minOut, uint256 deadline) external payable {
        _comprar(token, quote, minOut, deadline, address(0));
    }
    /** Igual que comprar, pero fija tu referidor la primera vez (del enlace ?ref=0x...). */
    function comprar(address token, address quote, uint256 minOut, uint256 deadline, address referidor) external payable {
        _comprar(token, quote, minOut, deadline, referidor);
    }
    function _comprar(address token, address quote, uint256 minOut, uint256 deadline, address referidor) internal activo noReentrada {
        if (msg.value == 0) revert Cantidad();
        if (block.timestamp > deadline) revert Vencido();
        _fijarRef(msg.sender, referidor);
        address[] memory ruta = _rutaCompra(token, quote);
        uint256 fee = msg.value * feeBps / BPS;
        uint256 neto = msg.value - fee;
        IRouterV2(router).swapExactETHForTokensSupportingFeeOnTransferTokens{value: neto}(minOut, ruta, msg.sender, deadline);
        volumenBNB += msg.value; comisionBNB += fee; operaciones += 1;
        emit Compra(msg.sender, token, quote, msg.value, neto, fee);
        _repartir(msg.sender, fee, CLAVE_CONT);
        _reportar(msg.sender, fee);
    }

    /* ═══════════ Vender: token -> BNB ═══════════ */
    function vender(address token, address quote, uint256 cantidad, uint256 minOut, uint256 deadline) external {
        _vender(token, quote, cantidad, minOut, deadline, address(0));
    }
    function vender(address token, address quote, uint256 cantidad, uint256 minOut, uint256 deadline, address referidor) external {
        _vender(token, quote, cantidad, minOut, deadline, referidor);
    }
    function _vender(address token, address quote, uint256 cantidad, uint256 minOut, uint256 deadline, address referidor) internal activo noReentrada {
        if (cantidad == 0) revert Cantidad();
        if (block.timestamp > deadline) revert Vencido();
        _fijarRef(msg.sender, referidor);
        address[] memory ruta = _rutaVenta(token, quote);
        uint256 antesTok = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), cantidad);
        uint256 rec = IERC20(token).balanceOf(address(this)) - antesTok;      // tokens con impuesto entregan menos
        if (rec == 0) revert Cantidad();
        IERC20(token).forceApprove(router, rec);
        uint256 antesBNB = address(this).balance;
        IRouterV2(router).swapExactTokensForETHSupportingFeeOnTransferTokens(rec, minOut, ruta, address(this), deadline);
        IERC20(token).forceApprove(router, 0);
        uint256 bruto = address(this).balance - antesBNB;
        if (bruto < minOut) revert Cantidad();
        uint256 fee = bruto * feeBps / BPS;
        uint256 neto = bruto - fee;
        volumenBNB += bruto; comisionBNB += fee; operaciones += 1;
        emit Venta(msg.sender, token, quote, rec, neto, fee);
        (bool ok,) = payable(msg.sender).call{value: neto}("");
        require(ok, "pago");
        _repartir(msg.sender, fee, CLAVE_CONT);
        _reportar(msg.sender, fee);
    }

    /* ═══════════ Cotizaciones (para la interfaz) ═══════════ */
    function cotizarCompra(address token, address quote, uint256 bnbIn) external view returns (uint256 tokOut, uint256 comision) {
        comision = bnbIn * feeBps / BPS;
        uint256[] memory a = IRouterV2(router).getAmountsOut(bnbIn - comision, _rutaCompra(token, quote));
        tokOut = a[a.length - 1];
    }
    function cotizarVenta(address token, address quote, uint256 tokIn) external view returns (uint256 bnbBruto, uint256 bnbNeto, uint256 comision) {
        uint256[] memory a = IRouterV2(router).getAmountsOut(tokIn, _rutaVenta(token, quote));
        bnbBruto = a[a.length - 1];
        comision = bnbBruto * feeBps / BPS;
        bnbNeto = bnbBruto - comision;
    }

    /* ═══════════ Suscripciones por servicio ═══════════ */
    /** Precio del servicio en wei de BNB, equivalente a su precio en USD vía el Oráculo.
        Devuelve 0 si el servicio no está activo o el Oráculo no responde (el front lo maneja). */
    function priceWei(bytes32 servicio) public view returns (uint256) {
        if (!servicioActivo[servicio]) return 0;
        uint256 usd = precioUSD[servicio];
        if (usd == 0 || oraculo == address(0)) return 0;
        try IOraculoT(oraculo).precioUSD(address(0)) returns (uint256 p) {
            if (p == 0) return 0;
            return usd * 1e18 / p;          // USD(18) * 1e18 / (USD por BNB, 18) = wei de BNB
        } catch { return 0; }
    }

    /** Expiración de la suscripción de `wallet` a `servicio` (timestamp). Owners => infinito (no pagan). */
    function subscriptionExpiry(address wallet, bytes32 servicio) external view returns (uint256) {
        if (esOwner[wallet]) return type(uint256).max;
        return expira[wallet][servicio];
    }

    /** Suscribe `servicio` por 30 días (renovable; suma sobre lo que quedaba). Cobra el equivalente
        en BNB a su precio en USD. Reparte igual que el swap (staking/referido/owners) y reporta. El
        exceso de BNB enviado se devuelve. Los owners no deben llamar aquí (no pagan). */
    function subscribe(bytes32 servicio) external payable {
        _subscribe(servicio, address(0));
    }
    function subscribe(bytes32 servicio, address referidor) external payable {
        _subscribe(servicio, referidor);
    }
    function _subscribe(bytes32 servicio, address referidor) internal activo noReentrada {
        if (esOwner[msg.sender]) revert NoAutorizado();        // los owners no pagan
        if (!servicioActivo[servicio]) revert Servicio();
        uint256 precio = priceWei(servicio);
        if (precio == 0) revert Oraculo();
        if (msg.value < precio) revert PagoInsuf();
        _fijarRef(msg.sender, referidor);

        uint256 base = expira[msg.sender][servicio];
        if (base < block.timestamp) base = block.timestamp;    // caducada o nueva: parte de ahora
        uint256 nuevo = base + SUB_DIAS * 86400;
        expira[msg.sender][servicio] = nuevo;
        ingresoSubBNB += precio; suscripciones += 1;
        emit Suscripcion(msg.sender, servicio, precio, nuevo);

        _repartir(msg.sender, precio, servicio);
        _reportar(msg.sender, precio);
        if (msg.value > precio) _enviarSeguro(msg.sender, msg.value - precio);   // devuelve el exceso
    }

    /* ═══════════ Reparto: 0.10% staking, 0.10% referido (al staking si no hay), resto 0.80% owners ═══════════ */
    struct Rep { uint256 aStk; uint256 aRef; uint256 a1; uint256 a2; bool okS; }
    function _repartir(address quien, uint256 monto, bytes32 servicio) internal {
        if (monto == 0) return;
        Rep memory r;
        r.aStk = monto * stakingBps / BPS;
        r.aRef = monto * refBps / BPS;
        address ref = referidoDe[quien];
        if (ref == address(0) || r.aRef == 0) { r.aStk += r.aRef; r.aRef = 0; ref = address(0); }   // sin referidor: su parte al staking
        uint256 pool = monto - r.aStk - r.aRef;                 // parte de los owners
        r.a1 = pool / 2;
        r.a2 = pool - r.a1;

        if (r.aStk > 0 && staking != address(0)) {
            (r.okS,) = staking.call{value: r.aStk}(abi.encodeWithSignature("depositarRecompensaBNB(uint16)", uint16(10000)));
        }
        if (!r.okS && r.aStk > 0) { r.a1 += r.aStk / 2; r.a2 += r.aStk - r.aStk / 2; r.aStk = 0; }   // staking no acepta: a los owners

        if (r.aRef > 0) { _enviarSeguro(ref, r.aRef); unchecked { ganadoRef[ref] += r.aRef; } }
        _enviarSeguro(owner1, r.a1);
        _enviarSeguro(owner2, r.a2);
        emit Repartida(quien, servicio, r.aStk, r.aRef, ref, r.a1, r.a2, r.okS);
    }

    /** Envío de BNB que NUNCA revierte: si el receptor rechaza, su monto queda retirable (pull). */
    function _enviarSeguro(address a, uint256 m) internal {
        if (m == 0 || a == address(0)) return;
        (bool ok,) = payable(a).call{value: m, gas: 30000}("");
        if (!ok) saldoRetirable[a] += m;
    }
    function retirar() external noReentrada {
        uint256 m = saldoRetirable[msg.sender];
        if (m == 0) revert Cantidad();
        saldoRetirable[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: m}("");
        require(ok, "retiro");
        emit Retiro(msg.sender, m);
    }

    /* ═══════════ Contabilidad (nunca rompe el flujo) ═══════════ */
    function _reportar(address wallet, uint256 montoBNB) internal {
        if (contabilidad == address(0)) return;
        uint256 usd = _bnbAUsd(montoBNB);
        if (usd == 0) return;
        uint256 aStk = usd * stakingBps / BPS;
        try IContabilidadT(contabilidad).reportar(wallet, CLAVE_CONT, usd, aStk, usd - aStk) {} catch {}
    }
    function _bnbAUsd(uint256 bnb) internal view returns (uint256) {
        if (oraculo == address(0) || bnb == 0) return 0;
        try IOraculoT(oraculo).precioUSD(address(0)) returns (uint256 p) { return bnb * p / 1e18; } catch { return 0; }
    }

    /* ═══════════ Referidos ═══════════ */
    /** Registra tu referidor sin operar (desde el enlace decfreedom.com/...?ref=0x...). Una sola vez. */
    function registrarReferido(address referidor) external { _fijarRef(msg.sender, referidor); }
    function _fijarRef(address wallet, address referidor) internal {
        if (referidoDe[wallet] != address(0)) return;          // ya tiene: no se cambia
        if (referidor == address(0) || referidor == wallet) return;
        referidoDe[wallet] = referidor;
        unchecked { refContar[referidor] += 1; }
        emit ReferidoFijado(wallet, referidor);
    }

    /* ═══════════ Rutas ═══════════ */
    function _rutaCompra(address token, address quote) internal view returns (address[] memory ruta) {
        if (token == address(0) || token == wbnb) revert Params();
        if (quote == address(0) || quote == wbnb) { ruta = new address[](2); ruta[0] = wbnb; ruta[1] = token; }
        else if (quote == usdt) { ruta = new address[](3); ruta[0] = wbnb; ruta[1] = usdt; ruta[2] = token; }
        else revert Ruta();
    }
    function _rutaVenta(address token, address quote) internal view returns (address[] memory ruta) {
        if (token == address(0) || token == wbnb) revert Params();
        if (quote == address(0) || quote == wbnb) { ruta = new address[](2); ruta[0] = token; ruta[1] = wbnb; }
        else if (quote == usdt) { ruta = new address[](3); ruta[0] = token; ruta[1] = usdt; ruta[2] = wbnb; }
        else revert Ruta();
    }

    /* ═══════════ Owners (panel) ═══════════ */
    function owners() external view returns (address[] memory) { return ownersList; }
    function addOwner(address a) external soloOwner { _addOwner(a); }
    function removeOwner(address a) external soloOwner {
        if (!esOwner[a] || a == owner1 || a == owner2) revert Params();
        esOwner[a] = false;
        for (uint256 k = 0; k < ownersList.length; k++) if (ownersList[k] == a) { ownersList[k] = ownersList[ownersList.length - 1]; ownersList.pop(); break; }
        emit OwnerCambiado(a, false);
    }
    function _addOwner(address a) internal { if (a == address(0)) revert Params(); if (!esOwner[a]) { esOwner[a] = true; ownersList.push(a); emit OwnerCambiado(a, true); } }
    function setOwner1(address a) external soloOwner { if (a == address(0)) revert Params(); owner1 = a; _addOwner(a); emit ParamCambiado("owner1", a); }
    function setOwner2(address a) external soloOwner { if (a == address(0)) revert Params(); owner2 = a; _addOwner(a); emit ParamCambiado("owner2", a); }
    function proponerOwner1(address a) external soloOwner { if (a == address(0)) revert Params(); owner1Propuesto = a; emit OwnerPropuesto(1, a); }
    function aceptarOwner1() external { if (msg.sender != owner1Propuesto) revert NoAutorizado(); owner1 = msg.sender; _addOwner(msg.sender); owner1Propuesto = address(0); emit ParamCambiado("owner1", msg.sender); }
    function proponerOwner2(address a) external soloOwner { if (a == address(0)) revert Params(); owner2Propuesto = a; emit OwnerPropuesto(2, a); }
    function aceptarOwner2() external { if (msg.sender != owner2Propuesto) revert NoAutorizado(); owner2 = msg.sender; _addOwner(msg.sender); owner2Propuesto = address(0); emit ParamCambiado("owner2", msg.sender); }

    /* ═══════════ Parámetros (panel) ═══════════ */
    function setStaking(address a) external soloOwner { staking = a; emit ParamCambiado("staking", a); }
    function setContabilidad(address a) external soloOwner { contabilidad = a; emit ParamCambiado("contabilidad", a); }
    function setOraculo(address a) external soloOwner { oraculo = a; emit ParamCambiado("oraculo", a); }
    function setRouter(address a) external soloOwner { if (a == address(0)) revert Params(); router = a; wbnb = IRouterV2(a).WETH(); emit ParamCambiado("router", a); }
    function setUsdt(address a) external soloOwner { if (a == address(0)) revert Params(); usdt = a; emit ParamCambiado("usdt", a); }
    /** feeBps nunca por encima del 1%. stakingBps + refBps no pueden pasar del 100% del cobro. */
    function setComision(uint256 _feeBps, uint256 _stakingBps, uint256 _refBps) external soloOwner {
        if (_feeBps > FEE_MAX_BPS || _stakingBps + _refBps > BPS) revert Params();
        feeBps = _feeBps; stakingBps = _stakingBps; refBps = _refBps;
        emit ComisionConfigurada(_feeBps, _stakingBps, _refBps);
    }
    /** Precio de un servicio en USD (18 dec) y si está activo. 0 en usd desactiva el cobro efectivo. */
    function setPrecioServicio(bytes32 servicio, uint256 usd, bool activoServicio) external soloOwner { _setPrecio(servicio, usd, activoServicio); }
    function _setPrecio(bytes32 servicio, uint256 usd, bool activoServicio) internal {
        precioUSD[servicio] = usd; servicioActivo[servicio] = activoServicio;
        emit PrecioServicio(servicio, usd, activoServicio);
    }
    function pausar(bool v) external soloOwner { pausado = v; emit Pausa(v); }

    /* El BNB entra solo al vender (desde el router) o como msg.value en comprar/subscribe. */
    receive() external payable { if (msg.sender != router) revert Cantidad(); }

    uint256[40] private __gap;
}
