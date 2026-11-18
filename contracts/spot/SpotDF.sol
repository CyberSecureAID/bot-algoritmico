// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/* ─────────────────────────────────────────────────────────────────────────────
   SpotDF.sol — El contrato que opera la seccion Spot de DecFreedom. Proxy UUPS.
   Red: BNB Smart Chain. Swaps por PancakeSwap V2. Clona el andamiaje PROBADO y
   desplegado de contracts/terminal/TerminalSwap.sol (multi-owner de dos pasos,
   reparto de comision que nunca revierte, reporte a Contabilidad por oraculo, guard
   de reentrancia, pausa, envio seguro con retiro pull) y le añade el corazon de Spot:
   abrir y cerrar posiciones long y short con auto-conversion, cobrando 1% SOLO sobre
   la ganancia.

   ░░ NO CUSTODIAL (por pre-aprobacion / allowance) ░░
   Los fondos del usuario SIEMPRE viven en SU wallet. El contrato NUNCA guarda capital
   entre operaciones: en cada abrir o cerrar, el dinero entra de la wallet y sale a la
   wallet en la MISMA transaccion. No hay un bote con los fondos de todos, asi que no
   hay honeypot que robar: aunque alguien vaciara el contrato, no habria nada dentro.

   Como funciona el automatico (TP / SL / limit) sin que el usuario firme cada vez:
   el usuario firma UNA aprobacion (approve) por adelantado de los tokens que opera.
   Con esa aprobacion, cuando el precio llega, el keeper de la plataforma llama a cerrar:
   el contrato tira (transferFrom) justo lo de esa posicion desde la wallet del usuario,
   hace el swap al precio validado y devuelve el resultado a la misma wallet. El usuario
   puede revocar la aprobacion cuando quiera. El keeper SOLO puede cerrar respetando el
   piso (floorOut) que el usuario fijo, asi un cierre automatico nunca lo liquida peor
   del precio que acepto.

     · LONG X: el capital se convierte a USDT y con el USDT se compra X; X va a la wallet
       del usuario. Al cerrar, el contrato tira X de la wallet, lo vende por USDT: la
       ganancia es en USDT. Si gana, 1% de la ganancia.
     · SHORT X: el capital se convierte a USDT y el USDT va a la wallet del usuario como
       colateral; se guarda cuanta X compraria ese USDT hoy (la referencia). Al cerrar, el
       contrato tira el USDT de la wallet y compra X: si bajo, compra MAS X que la
       referencia y esa diferencia es la ganancia (en la moneda). Si gana, 1% de esa X.

   Comision: 1% (tope fijo FEE_MAX_BPS), SOLO al cerrar en POSITIVO. Se toma de la ganancia,
   se convierte a BNB y se reparte EXACTO: 10% Staking, 45% owner1, 45% owner2. Se reporta a
   Contabilidad el valor en USD (clave keccak("spot")). Abrir una posicion es GRATIS.

   Anti-gap: todo swap exige minOut y deadline que fija quien llama; un movimiento rapido que
   deje el precio peor que minOut revierte, no ejecuta un mal llenado. Nunca deja aprobaciones
   abiertas hacia el router: aprueba lo justo de cada swap y lo deja en cero.

   AVISO: maneja ordenes de pago de usuarios por allowance. Exige auditoria profesional
   independiente y pruebas en testnet de BSC antes de mainnet con dinero real.
   ───────────────────────────────────────────────────────────────────────────── */

interface IRouterV2 {
    function WETH() external pure returns (address);
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
    function swapExactETHForTokensSupportingFeeOnTransferTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external payable;
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external;
}
interface IContabilidadS { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; }
interface IOraculoS { function precioUSD(address token) external view returns (uint256); } // precioUSD(address(0)) = USD por 1 BNB (18 dec)

contract SpotDF is Initializable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    /* ─────────── Roles e interconexion (molde de TerminalSwap) ─────────── */
    mapping(address => bool) public esOwner;
    address[] private ownersList;
    address public owner1;
    address public owner2;
    address public owner1Propuesto;
    address public owner2Propuesto;
    mapping(address => bool) public esKeeper;   // puede disparar cierres (TP/SL), respetando el piso del usuario
    address public staking;
    address public contabilidad;
    address public oraculo;
    address public router;                        // PancakeSwap V2 Router
    address public wbnb;                          // leido del router al inicializar
    address public usdt;                          // base de cuenta de las posiciones

    /* ─────────── Comision ─────────── */
    uint256 public constant BPS = 10000;
    uint256 public constant FEE_MAX_BPS = 100;    // 1%: tope fijo en el codigo
    uint256 public feeBps;                         // comision SOBRE LA GANANCIA al cerrar en positivo
    uint256 public stakingBps;                     // parte de la comision al staking (1000 = 10%)
    bytes32 public constant CLAVE_CONT = keccak256("spot");

    mapping(address => uint256) public saldoRetirable; // pull: BNB que un destino no pudo recibir
    bool public pausado;
    bool private _entrada;

    /* ─────────── Posiciones (solo registro; los fondos viven en la wallet del usuario) ─────────── */
    struct Pos {
        address user;      // dueño (en su wallet estan los fondos)
        address coin;      // moneda operada (la de la grafica)
        bool    esShort;   // false = long, true = short
        uint256 qty;       // long: cantidad de coin del usuario comprometida (en su wallet)
        uint256 costo;     // long: USDT invertido (base de coste). short: USDT colateral (en su wallet)
        uint256 refQty;    // short: cantidad de coin de referencia (lo que el USDT compraba al abrir)
        uint256 floorOut;  // minimo de salida que el usuario acepta en un cierre por keeper
        uint40  t;         // apertura
        bool    abierta;
    }
    Pos[] public posiciones;                       // id = indice
    mapping(address => uint256[]) public posDe;    // wallet => ids
    uint256 public abiertasTotal;

    /* Parametros para abrir (en un struct para no agotar la pila: "stack too deep").
       coin: moneda de la grafica. input: con que paga (address(0)=BNB via msg.value).
       pagar: cantidad del token input (si es BNB se ignora y vale msg.value; el input token
              necesita approve previo a este contrato).
       rutaAUsdt: ruta PancakeSwap input->USDT (vacia validada si input ya es USDT).
       minUsdt: minimo de USDT de esa conversion (anti-gap).
       rutaCoin: long = ruta USDT->coin (swap real). short = ruta USDT->coin (solo cotizar referencia).
       minCoin: long = minimo de coin a comprar. short = 0 (no se compra al abrir).
       floorOut: minimo de salida que aceptas si un keeper te cierra. deadline: limite. */
    struct Abrir {
        address coin; address input; uint256 pagar;
        address[] rutaAUsdt; uint256 minUsdt;
        address[] rutaCoin; uint256 minCoin;
        uint256 floorOut; uint256 deadline;
    }

    /* ─────────── Estadisticas ─────────── */
    uint256 public comisionBNB;    // comision total convertida a BNB
    uint256 public cierresGanadores;
    uint256 public operaciones;

    /* ─────────── Eventos ─────────── */
    event Abierta(uint256 indexed id, address indexed user, address indexed coin, bool esShort, uint256 costoUsdt, uint256 qty, uint256 refQty);
    event Cerrada(uint256 indexed id, address indexed user, address indexed coin, bool esShort, uint256 salida, uint256 ganancia, uint256 feeCobrado, address porQuien);
    event Abandonada(uint256 indexed id, address indexed user);
    event ComisionRepartida(uint256 aStaking, uint256 aOwner1, uint256 aOwner2, bool stakingOk);
    event PisoCambiado(uint256 indexed id, uint256 floorOut);
    event OwnerCambiado(address indexed quien, bool esOwner);
    event OwnerPropuesto(uint8 cual, address propuesto);
    event KeeperCambiado(address indexed quien, bool v);
    event ParamCambiado(string nombre, address valor);
    event ComisionConfigurada(uint256 feeBps, uint256 stakingBps);
    event Pausa(bool pausado);
    event Retiro(address indexed quien, uint256 monto);

    error NoAutorizado(); error Reentrada(); error Pausado(); error Params(); error Cantidad(); error Ruta(); error Vencido(); error NoAbierta();

    modifier soloOwner() { if (!esOwner[msg.sender]) revert NoAutorizado(); _; }
    modifier noReentrada() { if (_entrada) revert Reentrada(); _entrada = true; _; _entrada = false; }
    modifier activo() { if (pausado) revert Pausado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _owner1, address _owner2, address _staking, address _contabilidad, address _oraculo, address _router, address _usdt) external initializer {
        if (_owner1 == address(0) || _owner2 == address(0) || _router == address(0) || _usdt == address(0)) revert Params();
        owner1 = _owner1; owner2 = _owner2;
        staking = _staking; contabilidad = _contabilidad; oraculo = _oraculo;
        router = _router; usdt = _usdt;
        wbnb = IRouterV2(_router).WETH();
        feeBps = 100;        // 1% de la ganancia
        stakingBps = 1000;   // 10% de la comision va al staking
        _addOwner(_owner1); _addOwner(_owner2);
        emit ComisionConfigurada(feeBps, stakingBps);
    }

    function _authorizeUpgrade(address) internal override soloOwner {}

    /* ═══════════════════════════════════════════════════════════════════════════
       ABRIR LONG — el capital se vuelve USDT, con el USDT se compra la moneda y la
       moneda se MANDA A LA WALLET del usuario. Solo se registra la posicion (para el
       calculo del fee y para que el keeper pueda cerrarla despues con su approve).
       ═══════════════════════════════════════════════════════════════════════════ */
    function abrirLong(Abrir calldata q) external payable activo noReentrada returns (uint256 id) {
        if (q.coin == address(0) || q.coin == usdt) revert Params();
        if (block.timestamp > q.deadline) revert Vencido();
        uint256 enUsdt = _recibirComoUsdt(q.input, q.pagar, q.rutaAUsdt, q.minUsdt, q.deadline);
        if (enUsdt == 0) revert Cantidad();
        uint256 qty = _swapToken(usdt, q.coin, enUsdt, q.minCoin, q.rutaCoin, q.deadline);
        if (qty == 0) revert Cantidad();
        IERC20(q.coin).safeTransfer(msg.sender, qty);     // la moneda va a la WALLET del usuario (no custodia)
        id = _registrar(q.coin, false, qty, enUsdt, 0, q.floorOut);
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       ABRIR SHORT — el capital se vuelve USDT y el USDT se MANDA A LA WALLET del usuario
       como colateral. Se guarda cuanta moneda compraria ese USDT ahora (la referencia).
       ═══════════════════════════════════════════════════════════════════════════ */
    function abrirShort(Abrir calldata q) external payable activo noReentrada returns (uint256 id) {
        if (q.coin == address(0) || q.coin == usdt) revert Params();
        if (block.timestamp > q.deadline) revert Vencido();
        uint256 enUsdt = _recibirComoUsdt(q.input, q.pagar, q.rutaAUsdt, q.minUsdt, q.deadline);
        if (enUsdt == 0) revert Cantidad();
        uint256 refQty = _cotizar(enUsdt, q.rutaCoin, usdt, q.coin);
        if (refQty == 0) revert Cantidad();
        IERC20(usdt).safeTransfer(msg.sender, enUsdt);     // el USDT (colateral) va a la WALLET del usuario
        id = _registrar(q.coin, true, 0, enUsdt, refQty, q.floorOut);
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       CERRAR — tira los fondos de la WALLET del usuario (necesita su approve previo),
       hace el swap y devuelve el resultado a la misma wallet, todo en una tx. Lo puede
       llamar el dueño (en cualquier momento) o un keeper (solo para TP/SL y SIEMPRE
       respetando el piso floorOut). minOut lo fija quien llama (anti-gap); si no es el
       dueño, minOut debe ser >= floorOut. ruta: long = coin->USDT; short = USDT->coin.
       ═══════════════════════════════════════════════════════════════════════════ */
    function cerrar(uint256 id, address[] calldata ruta, uint256 minOut, uint256 deadline) external noReentrada {
        if (id >= posiciones.length) revert Params();
        Pos storage p = posiciones[id];
        if (!p.abierta) revert NoAbierta();
        if (block.timestamp > deadline) revert Vencido();
        if (msg.sender != p.user) {
            if (!esKeeper[msg.sender]) revert NoAutorizado();
            if (minOut < p.floorOut) revert Cantidad();     // un keeper nunca cierra por debajo del piso
        }
        p.abierta = false;                                   // efecto antes de interaccion
        abiertasTotal -= 1; operaciones += 1;
        if (!p.esShort) _cerrarLong(id, p, ruta, minOut, deadline);
        else            _cerrarShort(id, p, ruta, minOut, deadline);
    }

    function _cerrarLong(uint256 id, Pos storage p, address[] calldata ruta, uint256 minOut, uint256 deadline) internal {
        // Traer la moneda DESDE la wallet del usuario (approve previo). Medir lo recibido (tokens con impuesto).
        uint256 antes = IERC20(p.coin).balanceOf(address(this));
        IERC20(p.coin).safeTransferFrom(p.user, address(this), p.qty);
        uint256 tengo = IERC20(p.coin).balanceOf(address(this)) - antes;
        if (tengo == 0) revert Cantidad();
        uint256 proceeds = _swapToken(p.coin, usdt, tengo, minOut, ruta, deadline);
        uint256 ganancia = proceeds > p.costo ? (proceeds - p.costo) : 0;
        uint256 cobrado = 0;
        if (ganancia > 0) { cobrado = _cobrarFee(usdt, ganancia * feeBps / BPS, p.user, deadline); if (cobrado > 0) cierresGanadores += 1; }
        uint256 alUsuario = proceeds - cobrado;
        if (alUsuario > 0) IERC20(usdt).safeTransfer(p.user, alUsuario);
        emit Cerrada(id, p.user, p.coin, false, proceeds, ganancia, cobrado, msg.sender);
    }

    function _cerrarShort(uint256 id, Pos storage p, address[] calldata ruta, uint256 minOut, uint256 deadline) internal {
        // Traer el USDT (colateral) DESDE la wallet del usuario (approve previo).
        IERC20(usdt).safeTransferFrom(p.user, address(this), p.costo);
        uint256 nuevaQty = _swapToken(usdt, p.coin, p.costo, minOut, ruta, deadline);
        uint256 ganancia = nuevaQty > p.refQty ? (nuevaQty - p.refQty) : 0;   // ganancia EN la moneda
        uint256 cobrado = 0;
        if (ganancia > 0) { cobrado = _cobrarFee(p.coin, ganancia * feeBps / BPS, p.user, deadline); if (cobrado > 0) cierresGanadores += 1; }
        uint256 alUsuario = nuevaQty - cobrado;
        if (alUsuario > 0) IERC20(p.coin).safeTransfer(p.user, alUsuario);
        emit Cerrada(id, p.user, p.coin, true, nuevaQty, ganancia, cobrado, msg.sender);
    }

    /** El usuario descarta una posicion SIN mover fondos (p.ej. si ya movio la moneda por
        fuera). Solo limpia el registro; no toca dinero. */
    function abandonar(uint256 id) external {
        Pos storage p = posiciones[id];
        if (msg.sender != p.user) revert NoAutorizado();
        if (!p.abierta) revert NoAbierta();
        p.abierta = false; abiertasTotal -= 1;
        emit Abandonada(id, msg.sender);
    }

    /* ═══════════════════════════════════════════════════════════════════════════
       Internos de fondos
       ═══════════════════════════════════════════════════════════════════════════ */

    /** Recibe el pago del usuario (BNB o token, con approve previo si es token) y lo deja en
        USDT dentro del contrato SOLO durante esta tx. Devuelve el USDT obtenido (medido). */
    function _recibirComoUsdt(address input, uint256 pagar, address[] calldata ruta, uint256 minUsdt, uint256 deadline) internal returns (uint256) {
        uint256 antes = IERC20(usdt).balanceOf(address(this));
        if (input == address(0)) {
            if (msg.value == 0) revert Cantidad();
            _validarRuta(ruta, wbnb, usdt);
            IRouterV2(router).swapExactETHForTokensSupportingFeeOnTransferTokens{value: msg.value}(minUsdt, ruta, address(this), deadline);
        } else if (input == usdt) {
            if (msg.value != 0) revert Params();
            if (pagar == 0) revert Cantidad();
            IERC20(usdt).safeTransferFrom(msg.sender, address(this), pagar);
        } else {
            if (msg.value != 0) revert Params();
            if (pagar == 0) revert Cantidad();
            uint256 antesIn = IERC20(input).balanceOf(address(this));
            IERC20(input).safeTransferFrom(msg.sender, address(this), pagar);
            uint256 rec = IERC20(input).balanceOf(address(this)) - antesIn;
            if (rec == 0) revert Cantidad();
            _validarRuta(ruta, input, usdt);
            IERC20(input).forceApprove(router, rec);
            IRouterV2(router).swapExactTokensForTokensSupportingFeeOnTransferTokens(rec, minUsdt, ruta, address(this), deadline);
            IERC20(input).forceApprove(router, 0);
        }
        uint256 got = IERC20(usdt).balanceOf(address(this)) - antes;
        if (got < minUsdt) revert Cantidad();
        return got;
    }

    /** Swap token->token (el contrato ya tiene `amount`), midiendo la salida real. Valida extremos. */
    function _swapToken(address from, address to, uint256 amount, uint256 minOut, address[] calldata ruta, uint256 deadline) internal returns (uint256) {
        if (amount == 0) revert Cantidad();
        _validarRuta(ruta, from, to);
        uint256 antes = IERC20(to).balanceOf(address(this));
        IERC20(from).forceApprove(router, amount);
        IRouterV2(router).swapExactTokensForTokensSupportingFeeOnTransferTokens(amount, minOut, ruta, address(this), deadline);
        IERC20(from).forceApprove(router, 0);
        uint256 got = IERC20(to).balanceOf(address(this)) - antes;
        if (got < minOut) revert Cantidad();
        return got;
    }

    /** Toma `feeAmt` de `feeAsset`, lo convierte a BNB y lo reparte. Devuelve el feeAsset
        REALMENTE cobrado: feeAmt si todo salio bien, 0 si no se pudo convertir (en ese caso
        NO se cobra al usuario y nada queda atascado). */
    function _cobrarFee(address feeAsset, uint256 feeAmt, address user, uint256 deadline) internal returns (uint256) {
        if (feeAmt == 0) return 0;
        address[] memory ruta;
        if (feeAsset == usdt) { ruta = new address[](2); ruta[0] = usdt; ruta[1] = wbnb; }
        else { ruta = new address[](3); ruta[0] = feeAsset; ruta[1] = usdt; ruta[2] = wbnb; }
        uint256 minBnb;
        try IRouterV2(router).getAmountsOut(feeAmt, ruta) returns (uint256[] memory a) { minBnb = a[a.length - 1] * 90 / 100; } catch { return 0; }
        if (minBnb == 0) return 0;
        uint256 antes = address(this).balance;
        IERC20(feeAsset).forceApprove(router, feeAmt);
        try IRouterV2(router).swapExactTokensForETHSupportingFeeOnTransferTokens(feeAmt, minBnb, ruta, address(this), deadline) {
            IERC20(feeAsset).forceApprove(router, 0);
            uint256 feeBnb = address(this).balance - antes;
            if (feeBnb == 0) return 0;
            comisionBNB += feeBnb;
            _repartir(feeBnb);
            _reportar(user, feeBnb);
            return feeAmt;
        } catch {
            IERC20(feeAsset).forceApprove(router, 0);
            return 0;
        }
    }

    function _cotizar(uint256 amount, address[] calldata ruta, address from, address to) internal view returns (uint256) {
        _validarRuta(ruta, from, to);
        uint256[] memory a = IRouterV2(router).getAmountsOut(amount, ruta);
        return a[a.length - 1];
    }

    function _validarRuta(address[] calldata ruta, address from, address to) internal pure {
        if (ruta.length < 2 || ruta.length > 4) revert Ruta();
        if (ruta[0] != from || ruta[ruta.length - 1] != to) revert Ruta();
    }

    function _registrar(address coin, bool esShort, uint256 qty, uint256 costo, uint256 refQty, uint256 floorOut) internal returns (uint256 id) {
        id = posiciones.length;
        posiciones.push(Pos({ user: msg.sender, coin: coin, esShort: esShort, qty: qty, costo: costo, refQty: refQty, floorOut: floorOut, t: uint40(block.timestamp), abierta: true }));
        posDe[msg.sender].push(id);
        abiertasTotal += 1; operaciones += 1;
        emit Abierta(id, msg.sender, coin, esShort, costo, qty, refQty);
    }

    /* ═══════════ Reparto de la comision: 10% staking, 45% owner1, 45% owner2 (molde TerminalSwap) ═══════════ */
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
    function _reportar(address wallet, uint256 feeBNB) internal {
        if (contabilidad == address(0)) return;
        uint256 usd = _bnbAUsd(feeBNB);
        uint256 aStk = usd * stakingBps / BPS;
        try IContabilidadS(contabilidad).reportar(wallet, CLAVE_CONT, usd, aStk, usd - aStk) {} catch {}
    }
    function _bnbAUsd(uint256 bnb) internal view returns (uint256) {
        if (oraculo == address(0) || bnb == 0) return 0;
        try IOraculoS(oraculo).precioUSD(address(0)) returns (uint256 p) { return bnb * p / 1e18; } catch { return 0; }
    }

    /* ═══════════ Lecturas ═══════════ */
    function posicionInfo(uint256 id) external view returns (Pos memory) { return posiciones[id]; }
    function posicionesDe(address w) external view returns (uint256[] memory) { return posDe[w]; }
    function totalPosiciones() external view returns (uint256) { return posiciones.length; }

    /** El usuario sube o baja su piso de cierre por keeper (no afecta a su cierre manual). */
    function setFloor(uint256 id, uint256 floorOut) external {
        Pos storage p = posiciones[id];
        if (msg.sender != p.user) revert NoAutorizado();
        if (!p.abierta) revert NoAbierta();
        p.floorOut = floorOut;
        emit PisoCambiado(id, floorOut);
    }

    /* ═══════════ Owners (molde exacto de TerminalSwap) ═══════════ */
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

    /* ═══════════ Keeper y parametros ═══════════ */
    function setKeeper(address a, bool v) external soloOwner { if (a == address(0)) revert Params(); esKeeper[a] = v; emit KeeperCambiado(a, v); }
    function setStaking(address a) external soloOwner { staking = a; emit ParamCambiado("staking", a); }
    function setContabilidad(address a) external soloOwner { contabilidad = a; emit ParamCambiado("contabilidad", a); }
    function setOraculo(address a) external soloOwner { oraculo = a; emit ParamCambiado("oraculo", a); }
    function setRouter(address a) external soloOwner { if (a == address(0)) revert Params(); router = a; wbnb = IRouterV2(a).WETH(); emit ParamCambiado("router", a); }
    function setUsdt(address a) external soloOwner { if (a == address(0)) revert Params(); usdt = a; emit ParamCambiado("usdt", a); }
    function setComision(uint256 _feeBps, uint256 _stakingBps) external soloOwner {
        if (_feeBps > FEE_MAX_BPS || _stakingBps > BPS) revert Params();
        feeBps = _feeBps; stakingBps = _stakingBps;
        emit ComisionConfigurada(_feeBps, _stakingBps);
    }
    function pausar(bool v) external soloOwner { pausado = v; emit Pausa(v); }

    /* El BNB solo entra desde el router (al convertir el fee a BNB). El pago de un abrir llega
       como msg.value a abrir*, no por aqui. Asi nada de BNB se atasca. */
    receive() external payable { if (msg.sender != router) revert Cantidad(); }

    uint256[40] private __gap;
}
