// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./TokenDF.sol";

/* ─────────────────────────────────────────────────────────────────────────
   LaunchpadDF.sol. Fabrica de monedas + pools + candados de DecFreedom.
   Proxy UUPS (este es el contrato de implementacion). Multi-owner.

   Que hace:
     · crearToken: despliega un TokenDF (inmutable, supply fijo) a nombre del creador. Gratis.
     · crearPool: el creador deposita monedas + BNB o USDT. El pool vive AQUI (producto
       constante). No hay LP tokens: la liquidez queda bloqueada hasta la fecha elegida
       (o para siempre). Solo el creador puede retirarla, solo tras la fecha.
     · comprar / vender: swap contra el pool. En cada VENTA, del quote que recibe el
       vendedor sale el 0.5% al ecosistema (0.20% owner1, 0.20% owner2, 0.10% staking)
       y la parte del suelo (sueloBps) a la reserva del propio token. Comprar y
       transferir no pagan nada. Los owners no pagan comision.
     · Lanzamiento justo (24 h desde que abre el pool): maximo 1% del supply comprado
       del pool por wallet, y no se puede comprar y vender en el mismo bloque.
     · Reporta a Contabilidad (sin romper el flujo si falla).

   Seguridad: pragma fijo, checks-effects-interactions, guard de reentrancia,
   pausa de emergencia (solo compras/ventas/creacion; retirar liquidez vencida nunca
   se bloquea), validacion de entradas en todo lo admin.
   ───────────────────────────────────────────────────────────────────────── */

interface IContabilidadLP { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; }

contract LaunchpadDF is Initializable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    /* ─────────── Roles e interconexion ─────────── */
    mapping(address => bool) public esOwner;
    address[] private ownersList;
    address public owner1;
    address public owner2;
    address public staking;
    address public contabilidad;
    address public usdt;

    /* ─────────── Constantes del producto ─────────── */
    uint16 public constant BPS = 10000;
    uint16 public constant FEE_POOL_BPS = 30;      // 0.3% se queda en las reservas del pool
    uint16 public constant ECO_BPS = 50;           // 0.5% de lo que recibe el vendedor
    uint16 public constant ECO_OWNER1_BPS = 20;    // 0.20%
    uint16 public constant ECO_OWNER2_BPS = 20;    // 0.20%
    uint16 public constant ECO_STAKING_BPS = 10;   // 0.10%
    uint16 public constant SUELO_MIN_BPS = 100;    // 1%
    uint16 public constant SUELO_MAX_BPS = 500;    // 5%
    uint16 public constant FUNDADOR_MAX_PCT = 20;
    uint16 public constant LANZ_MAX_BPS = 100;     // 1% del supply por wallet en el lanzamiento
    uint64 public constant LANZ_SEG = 24 hours;
    uint64 public constant MES = 30 days;
    uint256 public constant SUPPLY_MIN = 1000e18;
    uint256 public constant SUPPLY_MAX = 1e15 * 1e18;
    bytes32 public constant CLAVE_CONT = keccak256("launchpad");

    /* ─────────── Estado ─────────── */
    struct Info { address creador; uint16 sueloBps; bool antibot; uint64 creadoEn; }
    struct Pool { address quote; uint256 rTok; uint256 rQuote; uint64 abiertoEn; uint64 desbloqueo; bool activo; bool retirado; }

    address[] public tokens;
    mapping(address => Info) public info;
    mapping(address => Pool) public pools;
    mapping(address => address[]) private _deCreador;
    mapping(address => mapping(address => uint256)) public compradoLanz;   // token => wallet => comprado en las 24 h
    mapping(address => mapping(address => uint256)) public ultimaCompraBloque;

    bool private _entrada;
    bool public pausado;

    /* ─────────── Eventos ─────────── */
    event TokenCreado(address indexed token, address indexed creador, string nombre, string simbolo, uint256 supply, uint16 sueloBps, uint256 vestTotal, uint64 vestDuracion, bool antibot);
    event PoolAbierto(address indexed token, address indexed creador, address quote, uint256 tok, uint256 quoteCant, uint64 desbloqueo);
    event Compra(address indexed token, address indexed wallet, uint256 quoteIn, uint256 tokOut, uint256 precio);
    event Venta(address indexed token, address indexed wallet, uint256 tokIn, uint256 quoteOut, uint256 eco, uint256 suelo, uint256 precio);
    event LiquidezRetirada(address indexed token, uint256 tok, uint256 quoteCant);
    event OwnerCambiado(address indexed quien, bool esOwner);
    event ParamCambiado(string nombre, address valor);
    event Pausa(bool pausado);

    error NoAutorizado(); error Reentrada(); error Pausado(); error Params(); error SinPool(); error Bloqueado();
    error Slippage(); error Lanzamiento(); error Cantidad(); error YaExiste();

    modifier soloOwner() { if (!esOwner[msg.sender]) revert NoAutorizado(); _; }
    modifier noReentrada() { if (_entrada) revert Reentrada(); _entrada = true; _; _entrada = false; }
    modifier activo() { if (pausado) revert Pausado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _owner1, address _owner2, address _staking, address _contabilidad, address _usdt) external initializer {
        if (_owner1 == address(0) || _owner2 == address(0) || _usdt == address(0)) revert Params();
        // UUPSUpgradeable no guarda estado: su init es un no-op. No se llama para no depender
        // de que exista en la version de OZ que resuelva el compilador (Remix a veces trae otra).
        owner1 = _owner1; owner2 = _owner2; staking = _staking; contabilidad = _contabilidad; usdt = _usdt;
        _addOwner(_owner1); _addOwner(_owner2);
    }

    function _authorizeUpgrade(address) internal override soloOwner {}

    /* ═══════════ Crear moneda (gratis) ═══════════ */
    function crearToken(
        string calldata nombre, string calldata simbolo, uint256 supply,
        uint16 sueloBps, uint8 fundadorPct, uint8 vestingMeses, bool antibot
    ) external activo noReentrada returns (address token) {
        if (bytes(nombre).length < 2 || bytes(nombre).length > 32) revert Params();
        if (bytes(simbolo).length < 3 || bytes(simbolo).length > 6) revert Params();
        if (supply < SUPPLY_MIN || supply > SUPPLY_MAX) revert Params();
        if (sueloBps != 0 && (sueloBps < SUELO_MIN_BPS || sueloBps > SUELO_MAX_BPS)) revert Params();
        if (fundadorPct > FUNDADOR_MAX_PCT) revert Params();
        if (fundadorPct > 0 && !(vestingMeses == 3 || vestingMeses == 6 || vestingMeses == 12 || vestingMeses == 24)) revert Params();

        uint256 vestTotal = supply * fundadorPct / 100;
        uint64 vestDur = fundadorPct > 0 ? uint64(vestingMeses) * MES : 0;
        token = address(new TokenDF(nombre, simbolo, supply, msg.sender, address(this), sueloBps, vestTotal, vestDur));

        info[token] = Info({ creador: msg.sender, sueloBps: sueloBps, antibot: antibot, creadoEn: uint64(block.timestamp) });
        tokens.push(token);
        _deCreador[msg.sender].push(token);
        _reportar(msg.sender, 0, 0, 0);
        emit TokenCreado(token, msg.sender, nombre, simbolo, supply, sueloBps, vestTotal, vestDur, antibot);
    }

    /* ═══════════ Abrir el pool (una vez, solo el creador) ═══════════ */
    /** quote: address(0) = BNB (manda msg.value == cantQuote); usdt = USDT (approve antes).
        candadoMeses: 6, 12, 24 o 0 = para siempre. */
    function crearPool(address token, uint256 cantTok, address quote, uint256 cantQuote, uint8 candadoMeses) external payable activo noReentrada {
        Info memory i = info[token];
        if (i.creador != msg.sender) revert NoAutorizado();
        Pool storage p = pools[token];
        if (p.activo || p.retirado) revert YaExiste();
        if (!(candadoMeses == 0 || candadoMeses == 6 || candadoMeses == 12 || candadoMeses == 24)) revert Params();
        if (!(quote == address(0) || quote == usdt)) revert Params();
        if (cantTok == 0 || cantQuote == 0) revert Cantidad();

        // Traer la liquidez. El token es estandar (sin tasa): lo recibido es lo pedido.
        uint256 tokReal = _pull(token, msg.sender, cantTok);
        uint256 quoteReal;
        if (quote == address(0)) { if (msg.value != cantQuote) revert Cantidad(); quoteReal = msg.value; }
        else { if (msg.value != 0) revert Cantidad(); quoteReal = _pull(quote, msg.sender, cantQuote); }

        p.quote = quote; p.rTok = tokReal; p.rQuote = quoteReal;
        p.abiertoEn = uint64(block.timestamp);
        p.desbloqueo = candadoMeses == 0 ? 0 : uint64(block.timestamp) + uint64(candadoMeses) * MES;
        p.activo = true;
        TokenDF(payable(token)).fijarActivoReserva(quote);
        emit PoolAbierto(token, msg.sender, quote, tokReal, quoteReal, p.desbloqueo);
    }

    /* ═══════════ Comprar ═══════════ */
    function comprar(address token, uint256 minOut) external payable activo noReentrada returns (uint256 out) {
        Pool storage p = pools[token];
        if (!p.activo || p.quote != address(0)) revert SinPool();
        if (msg.value == 0) revert Cantidad();
        out = _comprar(token, p, msg.sender, msg.value);
        if (out < minOut) revert Slippage();
    }
    function comprarConToken(address token, uint256 cantQuote, uint256 minOut) external activo noReentrada returns (uint256 out) {
        Pool storage p = pools[token];
        if (!p.activo || p.quote == address(0)) revert SinPool();
        if (cantQuote == 0) revert Cantidad();
        uint256 real = _pull(p.quote, msg.sender, cantQuote);
        out = _comprar(token, p, msg.sender, real);
        if (out < minOut) revert Slippage();
    }
    function _comprar(address token, Pool storage p, address quien, uint256 quoteIn) internal returns (uint256 out) {
        uint256 neto = quoteIn - quoteIn * FEE_POOL_BPS / BPS;
        out = p.rTok * neto / (p.rQuote + neto);
        if (out == 0) revert Cantidad();
        _guardCompra(token, p, quien, out);
        p.rQuote += quoteIn;            // la comision del pool se queda en las reservas
        p.rTok -= out;
        IERC20(token).safeTransfer(quien, out);
        emit Compra(token, quien, quoteIn, out, precio(token));
    }
    function _guardCompra(address token, Pool storage p, address quien, uint256 out) internal {
        if (!info[token].antibot || block.timestamp >= p.abiertoEn + LANZ_SEG) return;
        uint256 tope = IERC20(token).totalSupply() * LANZ_MAX_BPS / BPS;
        uint256 acum = compradoLanz[token][quien] + out;
        if (acum > tope) revert Lanzamiento();
        compradoLanz[token][quien] = acum;
        ultimaCompraBloque[token][quien] = block.number;
    }

    /* ═══════════ Vender ═══════════ */
    struct V { uint256 out; uint256 eco; uint256 suelo; }

    function vender(address token, uint256 cantTok, uint256 minOut) external activo noReentrada returns (uint256 paraTi) {
        Pool storage p = pools[token];
        if (!p.activo) revert SinPool();
        if (cantTok == 0) revert Cantidad();
        if (info[token].antibot && block.timestamp < p.abiertoEn + LANZ_SEG && ultimaCompraBloque[token][msg.sender] == block.number) revert Lanzamiento();
        uint256 real = _pull(token, msg.sender, cantTok);
        V memory v = _venta(token, p, real);
        paraTi = v.out - v.eco - v.suelo;
        if (paraTi < minOut) revert Slippage();
        if (v.suelo > 0) _alimentarSuelo(token, p.quote, v.suelo);
        if (v.eco > 0) _repartirEco(p.quote, v.out);
        _pagar(p.quote, msg.sender, paraTi);
        _reportar(msg.sender, 0, 0, 0);
        emit Venta(token, msg.sender, real, paraTi, v.eco, v.suelo, precio(token));
    }

    /** Efectos de la venta: actualiza reservas y devuelve bruto, comision y suelo. */
    function _venta(address token, Pool storage p, uint256 real) internal returns (V memory v) {
        uint256 neto = real - real * FEE_POOL_BPS / BPS;
        v.out = p.rQuote * neto / (p.rTok + neto);
        if (v.out == 0) revert Cantidad();
        p.rTok += real;
        p.rQuote -= v.out;
        v.eco = esOwner[msg.sender] ? 0 : v.out * ECO_BPS / BPS;
        v.suelo = v.out * info[token].sueloBps / BPS;
    }

    function _alimentarSuelo(address token, address quote, uint256 monto) internal {
        if (quote == address(0)) TokenDF(payable(token)).depositarReserva{value: monto}();
        else { IERC20(quote).forceApprove(token, monto); TokenDF(payable(token)).depositarReservaToken(monto); }
    }

    /** 0.20% owner1, 0.20% owner2, 0.10% staking (si el staking no acepta, su parte va a los owners). */
    function _repartirEco(address quote, uint256 out) internal {
        uint256 eco = out * ECO_BPS / BPS;              // exactamente lo descontado al vendedor
        uint256 a1 = out * ECO_OWNER1_BPS / BPS;
        uint256 aS = out * ECO_STAKING_BPS / BPS;
        uint256 a2 = eco - a1 - aS;                     // el resto (sin polvo de redondeo en el contrato)
        bool okS = false;
        if (aS > 0 && staking != address(0)) {
            if (quote == address(0)) {
                (okS,) = staking.call{value: aS}(abi.encodeWithSignature("depositarRecompensaBNB(uint16)", uint16(10000)));
            } else {
                IERC20(quote).forceApprove(staking, aS);
                (okS,) = staking.call(abi.encodeWithSignature("depositarRecompensa(address,uint256,uint16)", quote, aS, uint16(10000)));
                if (!okS) IERC20(quote).forceApprove(staking, 0);
            }
        }
        if (!okS) { a1 += aS / 2; a2 += aS - aS / 2; }
        _pagar(quote, owner1, a1);
        _pagar(quote, owner2 == address(0) ? owner1 : owner2, a2);
    }

    /* ═══════════ Retirar liquidez (solo el creador, solo vencido el candado) ═══════════ */
    function retirarLiquidez(address token) external noReentrada {
        Pool storage p = pools[token];
        if (info[token].creador != msg.sender) revert NoAutorizado();
        if (!p.activo) revert SinPool();
        if (p.desbloqueo == 0 || block.timestamp < p.desbloqueo) revert Bloqueado();
        uint256 t = p.rTok; uint256 q = p.rQuote;
        p.rTok = 0; p.rQuote = 0; p.activo = false; p.retirado = true;
        IERC20(token).safeTransfer(msg.sender, t);
        _pagar(p.quote, msg.sender, q);
        emit LiquidezRetirada(token, t, q);
    }

    /* ═══════════ Lecturas ═══════════ */
    /** Precio en quote por 1 moneda (18 decimales). */
    function precio(address token) public view returns (uint256) {
        Pool storage p = pools[token];
        return p.rTok == 0 ? 0 : p.rQuote * 1e18 / p.rTok;
    }
    function cotizarCompra(address token, uint256 quoteIn) external view returns (uint256 out) {
        Pool storage p = pools[token]; if (!p.activo) return 0;
        uint256 neto = quoteIn - quoteIn * FEE_POOL_BPS / BPS;
        out = p.rTok * neto / (p.rQuote + neto);
    }
    /** Lo que recibe el vendedor ya descontados pool, ecosistema y suelo. */
    function cotizarVenta(address token, uint256 tokIn, address vendedor) external view returns (uint256 paraTi, uint256 eco, uint256 suelo) {
        Pool storage p = pools[token]; if (!p.activo) return (0, 0, 0);
        uint256 neto = tokIn - tokIn * FEE_POOL_BPS / BPS;
        uint256 out = p.rQuote * neto / (p.rTok + neto);
        eco = esOwner[vendedor] ? 0 : out * ECO_BPS / BPS;
        suelo = out * info[token].sueloBps / BPS;
        paraTi = out - eco - suelo;
    }
    function tokensDe(address creador) external view returns (address[] memory) { return _deCreador[creador]; }
    function totalTokens() external view returns (uint256) { return tokens.length; }
    function destinos() external view returns (address, address, address) { return (owner1, owner2, staking); }
    function owners() external view returns (address[] memory) { return ownersList; }

    /* ═══════════ Admin (multi-owner) ═══════════ */
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
    function setStaking(address a) external soloOwner { staking = a; emit ParamCambiado("staking", a); }
    function setContabilidad(address a) external soloOwner { contabilidad = a; emit ParamCambiado("contabilidad", a); }
    function pausar(bool v) external soloOwner { pausado = v; emit Pausa(v); }

    /* ═══════════ Internas ═══════════ */
    function _pull(address t, address de, uint256 m) internal returns (uint256 rec) {
        uint256 antes = IERC20(t).balanceOf(address(this));
        IERC20(t).safeTransferFrom(de, address(this), m);
        rec = IERC20(t).balanceOf(address(this)) - antes;
        if (rec == 0) revert Cantidad();
    }
    function _pagar(address quote, address a, uint256 m) internal {
        if (m == 0) return;
        if (quote == address(0)) { (bool ok,) = payable(a).call{value: m}(""); require(ok, "pago"); }
        else IERC20(quote).safeTransfer(a, m);
    }
    function _reportar(address wallet, uint256 gen, uint256 aStk, uint256 aOwn) internal {
        if (contabilidad == address(0)) return;
        try IContabilidadLP(contabilidad).reportar(wallet, CLAVE_CONT, gen, aStk, aOwn) {} catch {}
    }

    /* El BNB entra solo por comprar / crearPool (con msg.value comprobado). */
    receive() external payable { revert Cantidad(); }

    uint256[40] private __gap;
}
