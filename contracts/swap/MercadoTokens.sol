// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/*═══════════════════════════════════════════════════════════════════════
  MercadoTokens — Listado libre de tokens (sin liquidez) para vender en el swap.
  ═══════════════════════════════════════════════════════════════════════
  · Cualquiera lista SU token: paga $12 en BNB, envía los tokens al contrato,
    pone precio y elige recibir en BNB o USDT. Nombre, símbolo y contrato son
    obligatorios (sirven de búsqueda).
  · Los compradores pagan (BNB o USDT según el listado) y reciben los tokens.
    El pago se acumula a nombre del vendedor dentro del contrato.
  · El vendedor retira cuando quiere: GANANCIAS (con 3% de comisión, repartida
    1% staking / 1% owner1 / 1% owner2) y TOKENS sobrantes (sin comisión).
  · Ganancia no retirada en 2 AÑOS pasa al staking (recompensa a los stakers).
    Los tokens NO caducan: siempre son del vendedor.
  · Estos tokens NO se operan en futuros ni spot: solo se intercambian aquí.
    El usuario es responsable; la plataforma no los respalda.
  · UUPS. Multi-owner vía Tarifas. No custodia el capital de trading de nadie:
    solo retiene lo que cada vendedor depositó a la venta y sus ganancias.
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IERC20M {
    function balanceOf(address) external view returns (uint256);
    function transfer(address,uint256) external returns (bool);
    function transferFrom(address,address,uint256) external returns (bool);
    function decimals() external view returns (uint8);
}
interface IWBNBM { function deposit() external payable; }
interface IStakingM { function depositarRecompensa(address,uint256,uint16) external; }
interface ITarifasM { function esAdmin(address) external view returns (bool); }
interface IOraculoM { function precioUSD(address) external view returns (uint256); }
interface IFactoryM { function getPair(address,address) external view returns (address); }
interface IPairM { function getReserves() external view returns (uint112,uint112,uint32); function token0() external view returns (address); }
interface IERC20Dec { function decimals() external view returns (uint8); }

library SafeM {
    function _c(address t, bytes memory d) private { (bool ok, bytes memory r)=t.call(d); require(ok && (r.length==0||abi.decode(r,(bool))), "erc20"); }
    function sTransfer(address t,address to,uint256 v) internal { _c(t,abi.encodeWithSelector(IERC20M.transfer.selector,to,v)); }
    function sFrom(address t,address f,address to,uint256 v) internal { _c(t,abi.encodeWithSelector(IERC20M.transferFrom.selector,f,to,v)); }
}

contract MercadoTokens is Initializable, UUPSUpgradeable {
    using SafeM for address;

    address public constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address public constant USDT_TK = 0x55d398326f99059fF775485246999027B3197955;
    address public constant FACTORY = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73; // PancakeSwap V2
    uint256 public constant BPS  = 10000;
    uint256 public constant DOS_ANuOS = 730 days;
    uint256 public constant CANDADO = 30 days;   // el vendedor no retira ganancias hasta 30 días tras listar

    address public owner;
    address public ownerPendiente;
    address public owner2;
    address public tarifas;
    address public staking;
    address public oraculo;
    uint256 public costoListadoUSD;   // 1200 = $12.00 (2 decimales)
    uint256 public comisionRetiroBps; // 300 = 3%
    bool    public pausado;
    uint256 private _lock;

    struct Listado {
        address vendedor;
        address token;        // contrato del token a la venta
        string  nombre;       // obligatorio (búsqueda)
        string  simbolo;      // obligatorio (búsqueda)
        string  logo;         // URL del logo (Firebase); opcional
        uint256 precio;       // precio por 1 token, en wei de BNB
        uint256 enVenta;      // tokens que quedan a la venta (en unidades del token)
        uint256 ganancia;     // ganancia acumulada del vendedor (en la moneda de pago)
        uint64  creado;
        uint64  ultimoRetiro; // para la regla de 2 años
        bool    activo;
    }

    // id incremental por listado
    uint256 public totalListados;
    mapping(uint256 => Listado) public listados;
    mapping(address => uint256[]) public listadosDe;      // listados por vendedor
    mapping(address => uint256[]) public listadosPorToken; // listados por contrato de token

    function _esAdmin(address a) internal view returns (bool) {
        return a == owner || a == owner2 || (tarifas != address(0) && ITarifasM(tarifas).esAdmin(a));
    }
    modifier soloOwner() { require(_esAdmin(msg.sender), "no owner"); _; }
    modifier noReentrada() { require(_lock==1); _lock=2; _; _lock=1; }

    event Listado_(uint256 indexed id, address indexed vendedor, address indexed token, string nombre, string simbolo, uint256 precio);
    event Comprado(uint256 indexed id, address indexed comprador, uint256 cantidadToken, uint256 pagado);
    event Devuelto(uint256 indexed id, address indexed comprador, uint256 cantidadToken, uint256 bnbDevuelto);
    event GananciaRetirada(uint256 indexed id, address indexed vendedor, uint256 bruto, uint256 comision, uint256 neto);
    event TokensRetirados(uint256 indexed id, address indexed vendedor, uint256 cantidad);
    event GananciaAlStaking(uint256 indexed id, uint256 monto);
    event ListadoCerrado(uint256 indexed id);
    event Param(string que, address v);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _tarifas, address _staking, address _oraculo, address _owner2) public initializer {
        owner = msg.sender; owner2 = _owner2;
        tarifas=_tarifas; staking=_staking; oraculo=_oraculo;
        costoListadoUSD = 2500;      // $25
        comisionRetiroBps = 500;     // 5%
        maxLiquidezUSD = 250000e18;  // $250k: por encima, no se puede listar
        _lock = 1;
    }
    function _authorizeUpgrade(address) internal override soloOwner {}

    /* ─────────── Precio del listado en BNB (desde el oráculo) ─────────── */
    function costoListadoBNB() public view returns (uint256) {
        if (oraculo == address(0)) return 0;
        uint256 pBNB = IOraculoM(oraculo).precioUSD(address(0)); // USD por 1 BNB (18 dec)
        if (pBNB == 0) return 0;
        return (costoListadoUSD * 1e18 * 1e18) / (100 * pBNB);
    }


    /* Liquidez REAL del token en PancakeSwap (la mayor entre su par con WBNB y con USDT),
       valorada en USD (18 dec). Se usa para bloquear monedas ya establecidas. */
    function liquidezUSD(address token) public view returns (uint256) {
        uint256 lWbnb = _liqPar(token, WBNB, true);
        uint256 lUsdt = _liqPar(token, USDT_TK, false);
        return lWbnb >= lUsdt ? lWbnb : lUsdt;
    }
    /* Liquidez de un par (token/ref). refEsBNB=true → la reserva ref se valora con el
       precio de BNB del oráculo; false → ref es USDT ($1). Devuelve el valor en USD de
       la reserva del lado 'ref' (que representa la mitad del pool), 18 dec. */
    function _liqPar(address token, address ref, bool refEsBNB) internal view returns (uint256) {
        address par = IFactoryM(FACTORY).getPair(token, ref);
        if (par == address(0)) return 0;
        (uint112 r0, uint112 r1,) = IPairM(par).getReserves();
        address t0 = IPairM(par).token0();
        uint256 reservaRef = (t0 == ref) ? uint256(r0) : uint256(r1);
        if (reservaRef == 0) return 0;
        if (refEsBNB) {
            uint256 pBNB = 0;
            try IOraculoM(oraculo).precioUSD(address(0)) returns (uint256 p) { pBNB = p; } catch {}
            if (pBNB == 0) return 0;
            // reservaRef está en wei de WBNB (18 dec). USD = reservaRef * pBNB / 1e18. Es media pool → x2.
            return (reservaRef * pBNB / 1e18) * 2;
        } else {
            // USDT tiene 18 dec en BSC y vale $1. Media pool → x2.
            return reservaRef * 2;
        }
    }

    /* ─────────── Listar un token ─────────── */
    /** El vendedor paga $12 en BNB (msg.value), envía `cantidad` de su token
        (debe haber hecho approve antes), y define nombre/símbolo/precio/moneda. */
    struct ListarIn {
        address token; string nombre; string simbolo; string logo;
        uint256 cantidad; uint256 precio;
    }
    function listar(ListarIn calldata p) external payable noReentrada returns (uint256 id) {
        require(!pausado, "pausado");
        require(p.token != address(0) && p.cantidad > 0 && p.precio > 0, "datos");
        require(bytes(p.nombre).length > 0 && bytes(p.simbolo).length > 0, "nombre/simbolo");
        require(!prohibido[p.token], "token no permitido");
        // Filtro de liquidez: si el token está establecido (mucha liquidez) y NO es un
        // permitido especial, se bloquea. Los permitidos (USDT.z) sí pasan.
        if (!permitidoConLiquidez[p.token]) {
            require(liquidezUSD(p.token) <= maxLiquidezUSD, "token con demasiada liquidez");
        }
        uint256 recibido = _cobrarYTraer(p.token, p.cantidad);
        id = ++totalListados;
        Listado storage L = listados[id];
        // Nombre/símbolo ANCLADO para tokens especiales (ej. USDT.z): no se puede falsear.
        string memory nom = p.nombre;
        string memory sim = p.simbolo;
        if (bytes(nombreAnclado[p.token]).length > 0) nom = nombreAnclado[p.token];
        if (bytes(simboloAnclado[p.token]).length > 0) sim = simboloAnclado[p.token];
        L.vendedor = msg.sender; L.token = p.token; L.nombre = nom; L.simbolo = sim; L.logo = p.logo;
        L.precio = p.precio; L.enVenta = recibido;
        L.creado = uint64(block.timestamp); L.ultimoRetiro = uint64(block.timestamp); L.activo = true;
        listadosDe[msg.sender].push(id);
        listadosPorToken[p.token].push(id);
        emit Listado_(id, msg.sender, p.token, nom, sim, p.precio);
    }
    /** Cobra el listado en BNB, trae los tokens del vendedor, devuelve lo recibido. */
    function _cobrarYTraer(address token, uint256 cantidad) internal returns (uint256 recibido) {
        // Los owner/admin listan GRATIS (no pagan los $25). El resto sí paga.
        if (!_esAdmin(msg.sender)) {
            uint256 costo = costoListadoBNB();
            require(costo > 0 && msg.value >= costo, "paga el listado en BNB");
            _repartirBNB(costo);
            if (msg.value > costo) { (bool ok,)=payable(msg.sender).call{value: msg.value - costo}(""); require(ok); }
        } else {
            // si un admin envió BNB por error, se lo devolvemos
            if (msg.value > 0) { (bool ok,)=payable(msg.sender).call{value: msg.value}(""); require(ok); }
        }
        uint256 antes = IERC20M(token).balanceOf(address(this));
        token.sFrom(msg.sender, address(this), cantidad);
        recibido = IERC20M(token).balanceOf(address(this)) - antes;
        require(recibido > 0, "sin tokens");
    }

    /* ─────────── Comprar tokens de un listado ─────────── */
    /** `cantidadToken` = cuántos tokens quiere comprar. Paga precio*cantidad en
        la moneda del listado (BNB por msg.value, o USDT por transferFrom). */
    function comprar(uint256 id, uint256 cantidadToken) external payable noReentrada {
        require(!pausado, "pausado");
        Listado storage L = listados[id];
        require(L.activo, "inactivo");
        require(cantidadToken > 0 && cantidadToken <= L.enVenta, "cantidad");
        uint8 dt = _dec(L.token);
        uint256 coste = (L.precio * cantidadToken) / (10 ** dt);
        require(coste > 0, "coste 0");
        require(msg.value >= coste, "BNB insuficiente");
        if (msg.value > coste) { (bool ok,)=payable(msg.sender).call{value: msg.value - coste}(""); require(ok); }
        L.ganancia += coste;
        L.enVenta -= cantidadToken;
        pagadoPor[id][msg.sender] += coste;
        compradoPor[id][msg.sender] += cantidadToken;
        L.token.sTransfer(msg.sender, cantidadToken);
        emit Comprado(id, msg.sender, cantidadToken, coste);
    }

    /* ─────────── Seguridad 1: el comprador puede DEVOLVER lo que compró ───────────
       Solo la wallet que compró puede devolver, y solo hasta la cantidad que
       compró. Recupera EXACTAMENTE el BNB que pagó (proporcional a lo que devuelve).
       El vendedor recupera sus tokens de vuelta al inventario. */
    function devolver(uint256 id, uint256 cantidadToken) external noReentrada {
        Listado storage L = listados[id];
        require(cantidadToken > 0, "cantidad");
        uint256 comprado = compradoPor[id][msg.sender];
        require(comprado >= cantidadToken, "no compraste tanto");
        // Traer los tokens PRIMERO y medir lo REALMENTE recibido (soporta fee-on-transfer).
        uint256 antes = IERC20M(L.token).balanceOf(address(this));
        L.token.sFrom(msg.sender, address(this), cantidadToken);
        uint256 recibido = IERC20M(L.token).balanceOf(address(this)) - antes;
        require(recibido > 0 && recibido <= comprado, "sin tokens");
        // El BNB a devolver se calcula sobre lo REALMENTE recibido (no sobre cantidadToken).
        uint256 pagado = pagadoPor[id][msg.sender];
        uint256 aDevolver = (pagado * recibido) / comprado;
        require(aDevolver > 0 && aDevolver <= L.ganancia, "sin fondos para devolver");
        // actualizar contadores con lo recibido
        compradoPor[id][msg.sender] = comprado - recibido;
        pagadoPor[id][msg.sender] = pagado - aDevolver;
        L.ganancia -= aDevolver;
        L.enVenta += recibido;   // vuelve al inventario del vendedor
        // pagar el BNB de vuelta al comprador
        (bool ok,)=payable(msg.sender).call{value: aDevolver}(""); require(ok);
        emit Devuelto(id, msg.sender, recibido, aDevolver);
    }


    /* ─────────── Retirar ganancias (3% comisión) ─────────── */
    function retirarGanancia(uint256 id) external noReentrada {
        Listado storage L = listados[id];
        require(L.vendedor == msg.sender, "no vendedor");
        require(block.timestamp >= uint256(L.creado) + CANDADO, "fondos bloqueados 30 dias");
        uint256 bruto = L.ganancia;
        require(bruto > 0, "sin ganancia");
        L.ganancia = 0;
        L.ultimoRetiro = uint64(block.timestamp);
        uint256 com = (bruto * comisionRetiroBps) / BPS;
        uint256 neto = bruto - com;
        _repartirComision(com);
        (bool ok,)=payable(msg.sender).call{value: neto}(""); require(ok);
        emit GananciaRetirada(id, msg.sender, bruto, com, neto);
    }

    /* ─────────── Retirar tokens sobrantes (sin comisión) ─────────── */
    function retirarTokens(uint256 id, uint256 cantidad) external noReentrada {
        Listado storage L = listados[id];
        require(L.vendedor == msg.sender, "no vendedor");
        require(cantidad > 0 && cantidad <= L.enVenta, "cantidad");
        L.enVenta -= cantidad;
        L.token.sTransfer(msg.sender, cantidad);
        if (L.enVenta == 0 && L.ganancia == 0) { L.activo = false; emit ListadoCerrado(id); }
        emit TokensRetirados(id, msg.sender, cantidad);
    }

    /* ─────────── Reponer tokens a un listado existente (sin pagar de nuevo) ─────────── */
    function reponer(uint256 id, uint256 cantidad) external noReentrada {
        Listado storage L = listados[id];
        require(L.vendedor == msg.sender, "no vendedor");
        require(L.activo && cantidad > 0, "datos");
        uint256 antes = IERC20M(L.token).balanceOf(address(this));
        L.token.sFrom(msg.sender, address(this), cantidad);
        L.enVenta += IERC20M(L.token).balanceOf(address(this)) - antes;
    }

    /* ─────────── Cambiar precio / logo del listado ─────────── */
    function setPrecio(uint256 id, uint256 precio) external { Listado storage L=listados[id]; require(L.vendedor==msg.sender,"no vendedor"); require(precio>0,"precio"); L.precio=precio; }
    function setLogo(uint256 id, string calldata logo) external { Listado storage L=listados[id]; require(L.vendedor==msg.sender,"no vendedor"); L.logo=logo; }

    /* ─────────── Regla de 2 años: cualquiera puede barrer ganancias viejas al staking ─────────── */
    /** Si el vendedor no retira su ganancia en 2 años, pasa al staking. Los
        tokens NO se tocan (siempre son suyos). Lo puede disparar cualquiera. */
    function barrerGananciaVieja(uint256 id) external noReentrada {
        Listado storage L = listados[id];
        require(L.ganancia > 0, "sin ganancia");
        require(block.timestamp >= uint256(L.ultimoRetiro) + DOS_ANuOS, "aun no");
        uint256 monto = L.ganancia; L.ganancia = 0; L.ultimoRetiro = uint64(block.timestamp);
        // la ganancia vieja va al staking (envuelta a WBNB) como recompensa
        if (staking != address(0)) { IWBNBM(WBNB).deposit{value: monto}(); _depositarStaking(WBNB, monto); }
        emit GananciaAlStaking(id, monto);
    }

    /* ─────────── Búsqueda / lecturas (para el frontend) ─────────── */
    function listadosDeVendedor(address v) external view returns (uint256[] memory) { return listadosDe[v]; }
    function listadosDeToken(address t) external view returns (uint256[] memory) { return listadosPorToken[t]; }
    function ver(uint256 id) external view returns (Listado memory) { return listados[id]; }
    /** Página de listados activos (para explorar). desde/hasta por id. */
    function pagina(uint256 desde, uint256 hasta) external view returns (Listado[] memory arr) {
        if (hasta > totalListados) hasta = totalListados;
        if (desde < 1) desde = 1;
        uint256 n = hasta >= desde ? (hasta - desde + 1) : 0;
        arr = new Listado[](n);
        for (uint256 i = 0; i < n; i++) arr[i] = listados[desde + i];
    }


    /** Segundos que faltan para que el vendedor pueda retirar ganancias (0 = ya puede). */
    function faltaCandado(uint256 id) external view returns (uint256) {
        uint256 fin = uint256(listados[id].creado) + CANDADO;
        return block.timestamp >= fin ? 0 : fin - block.timestamp;
    }

    /* ─────────── Internas de pago/comisión ─────────── */
    function _dec(address token) internal view returns (uint8) { try IERC20M(token).decimals() returns (uint8 d) { return d; } catch { return 18; } }
    function _pagar(address a, uint256 monto) internal {
        if (monto == 0) return;
        (bool ok,)=payable(a).call{value: monto}(""); require(ok);
    }
    function _repartirBNB(uint256 monto) internal {
        // el $25 del listado: 1/5 staking (=$5), resto 50/50 a los dos owners ($10 c/u)
        uint256 aStaking = monto / 5;
        uint256 resto = monto - aStaking;
        if (aStaking > 0 && staking != address(0)) { IWBNBM(WBNB).deposit{value: aStaking}(); _depositarStaking(WBNB, aStaking); }
        else resto = monto;
        uint256 mitad = resto / 2;
        if (mitad > 0) { (bool o1,)=payable(owner).call{value: mitad}(""); require(o1); }
        uint256 r = resto - mitad;
        address d2 = owner2 == address(0) ? owner : owner2;
        if (r > 0) { (bool o2,)=payable(d2).call{value: r}(""); require(o2); }
    }
    function _repartirComision(uint256 com) internal {
        if (com == 0) return;
        // 5%: 1% staking, 2% owner1, 2% owner2 → del total: 1/5 staking, 2/5 y 2/5.
        uint256 aStaking = com / 5;
        uint256 rest = com - aStaking;
        uint256 aOwner1 = rest / 2;
        uint256 aOwner2 = rest - aOwner1;
        if (aStaking > 0 && staking != address(0)) { IWBNBM(WBNB).deposit{value: aStaking}(); _depositarStaking(WBNB, aStaking); }
        else { aOwner1 += aStaking; }
        _pagar(owner, aOwner1);
        _pagar(owner2 == address(0) ? owner : owner2, aOwner2);
    }
    function _depositarStaking(address token, uint256 monto) internal {
        // aprobar y depositar como recompensa (bpsAStakers=10000). Si falla, no revierte el flujo.
        (bool okA,) = token.call(abi.encodeWithSelector(IERC20M.transfer.selector, staking, 0)); okA;
        try IERC20M(token).transfer(staking, 0) {} catch {}
        // usar approve+depositarRecompensa
        (bool ok1,) = token.call(abi.encodeWithSignature("approve(address,uint256)", staking, monto));
        ok1;
        (bool ok2,) = staking.call(abi.encodeWithSignature("depositarRecompensa(address,uint256,uint16)", token, monto, uint16(10000)));
        ok2;
    }

    /* ─────────── Owner (panel) ─────────── */
    function setOwner2(address a) external soloOwner { owner2 = a; emit Param("owner2", a); }
    function setStaking(address a) external soloOwner { staking = a; emit Param("staking", a); }
    function setOraculo(address a) external soloOwner { oraculo = a; emit Param("oraculo", a); }
    function setCostoListado(uint256 usd2dec) external soloOwner { costoListadoUSD = usd2dec; }
    function setComisionRetiro(uint256 bps) external soloOwner { require(bps <= 1000, "max 10%"); comisionRetiroBps = bps; }
    function setPausado(bool p) external soloOwner { pausado = p; }
    /* Marca/desmarca un token como prohibido de listar (monedas conocidas). */
    function setProhibido(address token, bool v) external soloOwner { prohibido[token] = v; }
    function setProhibidos(address[] calldata toks, bool v) external soloOwner { for (uint256 i=0;i<toks.length;i++) prohibido[toks[i]] = v; }
    function setMaxLiquidez(uint256 usd18) external soloOwner { maxLiquidezUSD = usd18; }
    /* Permite un token aunque tenga liquidez, y ancla su nombre/símbolo (anti-fraude). */
    function permitirConLiquidez(address token, bool v, string calldata nombre, string calldata simbolo) external soloOwner {
        permitidoConLiquidez[token] = v;
        nombreAnclado[token] = nombre;
        simboloAnclado[token] = simbolo;
    }

    /* Cambio de owner en dos pasos (el nuevo debe aceptar). */
    function transferirOwner(address n) external soloOwner { require(n != address(0)); ownerPendiente = n; emit Param("ownerPendiente", n); }
    function aceptarOwner() external { require(msg.sender == ownerPendiente); owner = ownerPendiente; ownerPendiente = address(0); emit Param("owner", owner); }

    /* Rescate: recupera SOLO tokens/BNB atascados que no pertenezcan a ningún
       listado (polvo, envíos por error). No toca lo que está a la venta ni las
       ganancias (esos viven en los listados y solo el vendedor los retira). */
    function rescatarBNB(address para, uint256 monto) external soloOwner noReentrada { require(para != address(0)); (bool ok,)=payable(para).call{value: monto}(""); require(ok); }
    function rescatarToken(address token, address para, uint256 monto) external soloOwner noReentrada { require(para != address(0)); token.sTransfer(para, monto); }

    receive() external payable {}
    // Seguridad (añadidos AL FINAL para no romper el storage en el upgrade):
    mapping(uint256 => mapping(address => uint256)) public pagadoPor;   // BNB pagado por wallet en el listado
    mapping(uint256 => mapping(address => uint256)) public compradoPor; // tokens comprados por wallet en el listado
    // Tokens PROHIBIDOS de listar manualmente (por si acaso). Anti-estafa.
    mapping(address => bool) public prohibido;
    // Límite de liquidez: si un token supera esto en PancakeSwap, NO se puede listar.
    uint256 public maxLiquidezUSD;   // en USD con 18 decimales (250000e18 = $250k)
    // Tokens PERMITIDOS aunque tengan liquidez (excepciones), con nombre/símbolo ANCLADO.
    mapping(address => bool)   public permitidoConLiquidez;
    mapping(address => string) public nombreAnclado;   // nombre forzado (ej. "USDT.z")
    mapping(address => string) public simboloAnclado;  // símbolo forzado (ej. "USDT.z")
    uint256[33] private __gap;
}
