// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/* ─────────────────────────────────────────────────────────────────────────
   TerminalSwap.sol. Compra y venta de tokens recien nacidos para la Terminal de DecFreedom.
   Proxy UUPS (este es el contrato de implementacion). Multi-owner. Interconectado al
   ecosistema: Staking, Contabilidad y Oraculo de precios.

   Que hace:
     · comprar: el usuario manda BNB. El contrato retiene la comision (1%) y manda el resto a
       PancakeSwap V2 por la ruta exacta del par (BNB -> token, o BNB -> USDT -> token). Los
       tokens salen del router DIRECTO a la wallet del usuario. Soporta tokens con impuesto.
     · vender: el usuario manda tokens (approve antes). El contrato los vende en PancakeSwap V2
       por BNB, retiene la comision (1%) del BNB recibido y entrega el resto al usuario.
     · Comision: 1% (tope fijo, no se puede subir). Reparto EXACTO en tres envios separados:
       0.10% al Staking, 0.45% al owner1, 0.45% al owner2. Siempre tres envios, aunque owner1
       y owner2 sean hoy la misma wallet (se tratan como dos destinos distintos).
     · Reporta a Contabilidad (clave keccak("terminal")) el valor de la comision en USD, usando
       el Oraculo del ecosistema. Si Contabilidad u Oraculo no responden, el swap NO se bloquea.

   Por que existe: nuestro swap (GridBot + SwapLib) solo opera en PancakeSwap V3. Los tokens
   nuevos nacen en PancakeSwap V2. Este contrato es el puente V2 de la Terminal.

   Seguridad: NO custodial (no guarda capital de nadie; el BNB de una venta entra y sale en la
   misma tx), pragma fijo, guard de reentrancia, pausa de emergencia, minOut y deadline los fija
   el usuario (proteccion de slippage), comision con tope en el codigo, envio seguro a los
   destinos de la comision (si uno rechaza BNB, su parte queda retirable; nunca bloquea el swap),
   el router solo se puede cambiar por un owner, y receive() solo acepta BNB del router.
   ───────────────────────────────────────────────────────────────────────── */

interface IRouterV2 {
    function WETH() external pure returns (address);
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
    function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external;
}
interface IContabilidadTS { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; }
// Oraculo ya desplegado del ecosistema (OraculoPrecios). precioUSD(address(0)) = USD por 1 BNB (18 dec).
interface IOraculoTS { function precioUSD(address token) external view returns (uint256); }

contract TerminalSwap is Initializable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    /* ─────────── Roles e interconexion ─────────── */
    mapping(address => bool) public esOwner;
    address[] private ownersList;
    address public owner1;
    address public owner2;
    address public staking;
    address public contabilidad;
    address public oraculo;
    address public router;                 // PancakeSwap V2 Router
    address public wbnb;                   // leido del router al inicializar
    address public usdt;                   // ruta BNB -> USDT -> token para pares contra USDT
    address public owner1Propuesto;        // handover en dos pasos
    address public owner2Propuesto;

    /* ─────────── Comision ─────────── */
    uint256 public constant BPS = 10000;
    uint256 public constant FEE_MAX_BPS = 100;        // 1%: tope fijo en el codigo
    uint256 public feeBps;                             // comision sobre el BNB (compra: entrada; venta: salida)
    uint256 public stakingBps;                         // parte de la comision que va al staking (1000 = 10%)
    bytes32 public constant CLAVE_CONT = keccak256("terminal");

    mapping(address => uint256) public saldoRetirable; // pull: BNB que un destino no pudo recibir
    bool public pausado;
    bool private _entrada;

    /* ─────────── Estadisticas (lectura) ─────────── */
    uint256 public volumenBNB;             // BNB operado (entradas de compra + salidas de venta)
    uint256 public comisionBNB;            // comision total retenida
    uint256 public operaciones;

    /* ─────────── Eventos ─────────── */
    event Compra(address indexed wallet, address indexed token, address quote, uint256 bnbIn, uint256 bnbNeto, uint256 comision);
    event Venta(address indexed wallet, address indexed token, address quote, uint256 tokIn, uint256 bnbOut, uint256 comision);
    event ComisionRepartida(uint256 aStaking, uint256 aOwner1, uint256 aOwner2, bool stakingOk);
    event OwnerCambiado(address indexed quien, bool esOwner);
    event OwnerPropuesto(uint8 cual, address propuesto);
    event ParamCambiado(string nombre, address valor);
    event ComisionConfigurada(uint256 feeBps, uint256 stakingBps);
    event Pausa(bool pausado);
    event Retiro(address indexed quien, uint256 monto);

    error NoAutorizado(); error Reentrada(); error Pausado(); error Params(); error Cantidad(); error Ruta(); error Vencido();

    modifier soloOwner() { if (!esOwner[msg.sender]) revert NoAutorizado(); _; }
    modifier noReentrada() { if (_entrada) revert Reentrada(); _entrada = true; _; _entrada = false; }
    modifier activo() { if (pausado) revert Pausado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    /** _owner1 y _owner2: los dos owners (pueden ser hoy la misma wallet). _router: PancakeSwap V2
        Router (0x10ED43C718714eb63d5aA57B78B54704E256024E). _usdt: USDT de BNB Chain. */
    function initialize(address _owner1, address _owner2, address _staking, address _contabilidad, address _oraculo, address _router, address _usdt) external initializer {
        if (_owner1 == address(0) || _owner2 == address(0) || _router == address(0) || _usdt == address(0)) revert Params();
        owner1 = _owner1; owner2 = _owner2;
        staking = _staking; contabilidad = _contabilidad; oraculo = _oraculo;
        router = _router; usdt = _usdt;
        wbnb = IRouterV2(_router).WETH();
        feeBps = 100;        // 1%
        stakingBps = 1000;   // 10% de la comision = 0.10% del total
        _addOwner(_owner1); _addOwner(_owner2);
        emit ComisionConfigurada(feeBps, stakingBps);
    }

    function _authorizeUpgrade(address) internal override soloOwner {}

    /* ═══════════ Comprar: BNB -> token ═══════════ */
    /** token: el que se compra. quote: address(0) o WBNB si el par es contra BNB; usdt si el par es
        contra USDT (ruta BNB -> USDT -> token). minOut: minimo de tokens a recibir (slippage, lo fija
        el usuario con cotizarCompra). deadline: timestamp limite. Los tokens llegan directo a msg.sender. */
    function comprar(address token, address quote, uint256 minOut, uint256 deadline) external payable activo noReentrada {
        if (msg.value == 0) revert Cantidad();
        if (block.timestamp > deadline) revert Vencido();
        address[] memory ruta = _rutaCompra(token, quote);
        uint256 fee = msg.value * feeBps / BPS;
        uint256 neto = msg.value - fee;
        IRouterV2(router).swapExactETHForTokensSupportingFeeOnTransferTokens{value: neto}(minOut, ruta, msg.sender, deadline);
        volumenBNB += msg.value; comisionBNB += fee; operaciones += 1;
        emit Compra(msg.sender, token, quote, msg.value, neto, fee);
        _repartir(fee);
        _reportar(msg.sender, fee);
    }

    /* ═══════════ Vender: token -> BNB ═══════════ */
    /** El usuario aprueba `cantidad` del token a este contrato antes. minOut: minimo de BNB a recibir
        ANTES de la comision (lo que devuelve cotizarVenta como bruto). El BNB neto va a msg.sender. */
    function vender(address token, address quote, uint256 cantidad, uint256 minOut, uint256 deadline) external activo noReentrada {
        if (cantidad == 0) revert Cantidad();
        if (block.timestamp > deadline) revert Vencido();
        address[] memory ruta = _rutaVenta(token, quote);
        // Traer los tokens midiendo lo recibido (tokens con impuesto entregan menos).
        uint256 antesTok = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), cantidad);
        uint256 rec = IERC20(token).balanceOf(address(this)) - antesTok;
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
        _repartir(fee);
        _reportar(msg.sender, fee);
    }

    /* ═══════════ Cotizaciones (para la interfaz) ═══════════ */
    /** Tokens que recibiria el usuario por `bnbIn` (ya descontada la comision). Sin impuesto del token. */
    function cotizarCompra(address token, address quote, uint256 bnbIn) external view returns (uint256 tokOut, uint256 comision) {
        comision = bnbIn * feeBps / BPS;
        uint256[] memory a = IRouterV2(router).getAmountsOut(bnbIn - comision, _rutaCompra(token, quote));
        tokOut = a[a.length - 1];
    }
    /** BNB bruto que daria el router por `tokIn` y BNB neto tras la comision. Sin impuesto del token. */
    function cotizarVenta(address token, address quote, uint256 tokIn) external view returns (uint256 bnbBruto, uint256 bnbNeto, uint256 comision) {
        uint256[] memory a = IRouterV2(router).getAmountsOut(tokIn, _rutaVenta(token, quote));
        bnbBruto = a[a.length - 1];
        comision = bnbBruto * feeBps / BPS;
        bnbNeto = bnbBruto - comision;
    }

    /* ═══════════ Reparto de la comision: 10% staking, 45% owner1, 45% owner2 ═══════════ */
    /** Suma EXACTA (la ultima parte es el resto). Tres envios separados SIEMPRE. Si el staking no
        acepta (contrato no autorizado alli, por ejemplo), su parte va a los owners a medias. */
    function _repartir(uint256 fee) internal {
        if (fee == 0) return;
        uint256 aStk = fee * stakingBps / BPS;
        uint256 resto = fee - aStk;
        uint256 a1 = resto / 2;
        uint256 a2 = resto - a1;
        bool okS = false;
        if (aStk > 0 && staking != address(0)) {
            (okS,) = staking.call{value: aStk}(abi.encodeWithSignature("depositarRecompensaBNB(uint16)", uint16(10000)));
        }
        if (!okS && aStk > 0) { a1 += aStk / 2; a2 += aStk - aStk / 2; aStk = 0; }
        _enviarSeguro(owner1, a1);
        _enviarSeguro(owner2, a2);
        emit ComisionRepartida(aStk, a1, a2, okS);
    }

    /** Envio de BNB que NUNCA revierte: si el receptor rechaza, su monto queda retirable (pull). */
    function _enviarSeguro(address a, uint256 m) internal {
        if (m == 0 || a == address(0)) return;
        (bool ok,) = payable(a).call{value: m, gas: 30000}("");
        if (!ok) saldoRetirable[a] += m;
    }

    /** Retira lo que un envio no pudo entregar. */
    function retirar() external noReentrada {
        uint256 m = saldoRetirable[msg.sender];
        if (m == 0) revert Cantidad();
        saldoRetirable[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: m}("");
        require(ok, "retiro");
        emit Retiro(msg.sender, m);
    }

    /* ═══════════ Contabilidad (nunca rompe el flujo) ═══════════ */
    function _reportar(address wallet, uint256 feeBNB) internal {
        if (contabilidad == address(0)) return;
        uint256 usd = _bnbAUsd(feeBNB);
        uint256 aStk = usd * stakingBps / BPS;
        try IContabilidadTS(contabilidad).reportar(wallet, CLAVE_CONT, usd, aStk, usd - aStk) {} catch {}
    }
    function _bnbAUsd(uint256 bnb) internal view returns (uint256) {
        if (oraculo == address(0) || bnb == 0) return 0;
        try IOraculoTS(oraculo).precioUSD(address(0)) returns (uint256 p) { return bnb * p / 1e18; } catch { return 0; }
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
    /** Cambio directo (un paso) de la wallet que cobra como owner1 / owner2. Solo un owner. */
    function setOwner1(address a) external soloOwner { if (a == address(0)) revert Params(); owner1 = a; _addOwner(a); emit ParamCambiado("owner1", a); }
    function setOwner2(address a) external soloOwner { if (a == address(0)) revert Params(); owner2 = a; _addOwner(a); emit ParamCambiado("owner2", a); }
    /* Handover en DOS pasos: proponer (owner) + aceptar (la wallet nueva). */
    function proponerOwner1(address a) external soloOwner { if (a == address(0)) revert Params(); owner1Propuesto = a; emit OwnerPropuesto(1, a); }
    function aceptarOwner1() external { if (msg.sender != owner1Propuesto) revert NoAutorizado(); owner1 = msg.sender; _addOwner(msg.sender); owner1Propuesto = address(0); emit ParamCambiado("owner1", msg.sender); }
    function proponerOwner2(address a) external soloOwner { if (a == address(0)) revert Params(); owner2Propuesto = a; emit OwnerPropuesto(2, a); }
    function aceptarOwner2() external { if (msg.sender != owner2Propuesto) revert NoAutorizado(); owner2 = msg.sender; _addOwner(msg.sender); owner2Propuesto = address(0); emit ParamCambiado("owner2", msg.sender); }

    /* ═══════════ Parametros (panel) ═══════════ */
    function setStaking(address a) external soloOwner { staking = a; emit ParamCambiado("staking", a); }
    function setContabilidad(address a) external soloOwner { contabilidad = a; emit ParamCambiado("contabilidad", a); }
    function setOraculo(address a) external soloOwner { oraculo = a; emit ParamCambiado("oraculo", a); }
    function setRouter(address a) external soloOwner { if (a == address(0)) revert Params(); router = a; wbnb = IRouterV2(a).WETH(); emit ParamCambiado("router", a); }
    function setUsdt(address a) external soloOwner { if (a == address(0)) revert Params(); usdt = a; emit ParamCambiado("usdt", a); }
    /** feeBps nunca por encima del 1%. stakingBps: parte de la comision para el staking (max 100%). */
    function setComision(uint256 _feeBps, uint256 _stakingBps) external soloOwner {
        if (_feeBps > FEE_MAX_BPS || _stakingBps > BPS) revert Params();
        feeBps = _feeBps; stakingBps = _stakingBps;
        emit ComisionConfigurada(_feeBps, _stakingBps);
    }
    function pausar(bool v) external soloOwner { pausado = v; emit Pausa(v); }

    /* El BNB entra solo por comprar (msg.value) o desde el router al vender. */
    receive() external payable { if (msg.sender != router) revert Cantidad(); }

    uint256[40] private __gap;
}
