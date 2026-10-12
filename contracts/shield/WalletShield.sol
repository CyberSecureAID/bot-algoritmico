// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/* ─────────────────────────────────────────────────────────────────────────────
   WalletShield.sol — Contrato de suscripción de la sección Wallet Shield
   (servicios de seguridad de wallets de Cripto Cuba).

   Qué hace:
     · Cobra el acceso (equivalente configurable en USD, pagado en BNB) por 30 días.
     · Reparte el pago: owner1, owner2, staking y el pozo de gas (GasFaucet).
     · Multi-owner: los owners no pagan y pueden añadir/quitar otros owners.
     · El precio se puede cambiar desde el panel admin (owners).
     · Reporta cada cobro a Contabilidad (para el panel admin y el staking).
     · Recibe múltiples criptomonedas (para nutrir el sistema desde otras fuentes).

   Seguridad (OWASP Smart Contract Top 10, 2026):
     · Pragma fijo (0.8.24), no floating.
     · Checks-Effects-Interactions + guard de reentrancia.
     · Pull-over-push donde aplica; llamadas externas con manejo de fallo.
     · Acceso restringido y validación de entradas en toda función admin.
   ──────────────────────────────────────────────────────────────────────────── */

interface IOraculo   { function precioUSD(address) external view returns (uint256); } // USD por 1 BNB (18 dec)
interface IContabilidad { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; function tocarWallet(address wallet) external; }
interface IGasFaucet { function nutrir() external payable; }
interface IERC20Min  { function transfer(address,uint256) external returns (bool); function balanceOf(address) external view returns (uint256); }

contract WalletShield is Initializable, UUPSUpgradeable {
    // ─────────── Roles ───────────
    mapping(address => bool) public esOwner;   // multi-owner
    address[] private ownersList;               // para enumerar en el panel
    address public owner1;                      // recibe su parte del cobro
    address public owner2;                      // recibe su parte del cobro

    // ─────────── Interconexión ───────────
    address public oraculo;         // precio BNB/USD
    address public contabilidad;    // reportes al panel + staking
    address public staking;         // recibe el 10% (o el bps configurado)
    address public gasFaucet;       // pozo de gas de la sección

    // ─────────── Parámetros de cobro (configurables) ───────────
    uint256 public precioUSD_;      // precio de acceso en USD con 2 decimales ($5.00 = 500)
    uint256 public duracion;        // duración del acceso (por defecto 30 días)
    uint256 public bpsOwner1;       // reparto en base 10000 (bps)
    uint256 public bpsOwner2;
    uint256 public bpsStaking;
    uint256 public bpsFaucet;       // el resto va al gas faucet
    // por defecto: $5 => owner1 30% ($1.50), owner2 30% ($1.50), staking 10% ($0.50), faucet 30% ($1.50)

    // ─────────── Estado de suscripciones ───────────
    mapping(address => uint40) public expiraEn;   // timestamp hasta el que la wallet tiene acceso

    // ─────────── Seguridad ───────────
    bool private _entrada;          // guard de reentrancia
    bool public pausado;            // circuit breaker

    // ─────────── Lista negra comunitaria (v2, variables SOLO anadidas al final) ───────────
    // Clave de una direccion:
    //   BSC/EVM: bytes32(uint256(uint160(addr)))          (claveBSC)
    //   Tron:    keccak256(bytes(direccion en texto))      (claveTron)
    mapping(bytes32 => uint32)  public reportes;        // reportes acumulados en la epoca actual
    mapping(bytes32 => uint32)  public epoca;           // sube al limpiar: invalida los "ya reporto" sin recorrer nada
    mapping(bytes32 => mapping(uint32 => mapping(address => bool))) private _yaReporto; // clave => epoca => reportero
    mapping(bytes32 => bool)    public vetada;          // confirmada por un owner (peso maximo)
    mapping(bytes32 => bool)    public protegida;       // nuestras direcciones: no se pueden reportar
    uint32 public umbralReportes;                       // reportes para considerarla "reportada" (0 = 1)

    // ─────────── Eventos ───────────
    event AccesoComprado(address indexed wallet, uint256 pagadoBNB, uint40 expira);
    event OwnerAgregado(address indexed nuevo);
    event OwnerQuitado(address indexed quien);
    event PrecioCambiado(uint256 nuevoUSD);
    event RepartoCambiado(uint256 o1, uint256 o2, uint256 stk, uint256 fauc);
    event ParamCambiado(string que, address valor);
    event Pausado(bool estado);
    event Recibido(address indexed de, uint256 monto);
    event Reportada(bytes32 indexed clave, address indexed por, uint32 total);
    event Limpiada(bytes32 indexed clave, uint32 nuevaEpoca);
    event Vetada(bytes32 indexed clave, bool estado);
    event Protegida(bytes32 indexed clave, bool estado);

    // ─────────── Errores (gas-eficientes) ───────────
    error NoAutorizado();
    error EnPausa();
    error Reentrada();
    error ParametroInvalido();
    error PagoInsuficiente();
    error SinOraculo();
    error SinAcceso();
    error DireccionProtegida();
    error YaReportada();

    modifier soloOwner() { if (!esOwner[msg.sender]) revert NoAutorizado(); _; }
    modifier noReentrante() { if (_entrada) revert Reentrada(); _entrada = true; _; _entrada = false; }
    modifier vivo() { if (pausado) revert EnPausa(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _oraculo, address _contabilidad, address _staking, address _owner1, address _owner2) public initializer {
        if (_oraculo == address(0) || _owner1 == address(0) || _owner2 == address(0)) revert ParametroInvalido();
        // los dos owners iniciales (parámetros) son los owners; NO el msg.sender,
        // porque al desplegar vía proxy msg.sender es el desplegador de Remix.
        _agregarOwner(_owner1);
        if (!esOwner[_owner2]) _agregarOwner(_owner2);
        owner1 = _owner1; owner2 = _owner2;
        oraculo = _oraculo; contabilidad = _contabilidad; staking = _staking;

        precioUSD_ = 500;          // $5.00
        duracion   = 30 days;
        bpsOwner1  = 3000;         // 30%
        bpsOwner2  = 3000;         // 30%
        bpsStaking = 1000;         // 10%
        bpsFaucet  = 3000;         // 30%
    }

    /* ══════════════════ COMPRA DE ACCESO ══════════════════ */

    /** Precio actual del acceso en BNB (wei), según el oráculo. */
    function precioBNB() public view returns (uint256) {
        uint256 pBNB = IOraculo(oraculo).precioUSD(address(0));  // USD por 1 BNB (18 dec)
        if (pBNB == 0) revert SinOraculo();
        // precioUSD_ tiene 2 decimales. BNB wei = (precioUSD_/100) * 1e18 / (pBNB/1e18)
        return (precioUSD_ * 1e18 * 1e18) / (100 * pBNB);
    }

    /** ¿La wallet tiene acceso activo ahora mismo? Los owners siempre sí, sin pagar. */
    function tieneAcceso(address wallet) public view returns (bool) {
        if (esOwner[wallet]) return true;
        return expiraEn[wallet] >= block.timestamp;
    }

    /** Comprar/renovar 30 días de acceso pagando en BNB. Los owners no pagan. */
    function comprarAcceso() external payable vivo noReentrante {
        // los owners tienen acceso permanente y no pagan
        if (esOwner[msg.sender]) { expiraEn[msg.sender] = type(uint40).max; emit AccesoComprado(msg.sender, 0, type(uint40).max); return; }

        uint256 costo = precioBNB();
        if (msg.value < costo) revert PagoInsuficiente();

        // ── EFFECTS: fijar la expiración antes de mover fondos ──
        uint40 base = expiraEn[msg.sender] >= block.timestamp ? expiraEn[msg.sender] : uint40(block.timestamp);
        uint40 nuevaExp = base + uint40(duracion);
        expiraEn[msg.sender] = nuevaExp;

        // ── INTERACTIONS: repartir el pago ──
        uint256 aO1  = (costo * bpsOwner1)  / 10000;
        uint256 aO2  = (costo * bpsOwner2)  / 10000;
        uint256 aStk = (costo * bpsStaking) / 10000;
        uint256 aFau = costo - aO1 - aO2 - aStk;   // el resto (evita polvo por redondeo)

        if (aO1 > 0) _enviarBNB(owner1, aO1);
        if (aO2 > 0) _enviarBNB(owner2, aO2);
        if (aStk > 0 && staking != address(0)) _enviarBNB(staking, aStk);
        if (aFau > 0 && gasFaucet != address(0)) { try IGasFaucet(gasFaucet).nutrir{value: aFau}() {} catch { _enviarBNB(gasFaucet, aFau); } }

        // devolver el exceso pagado
        if (msg.value > costo) _enviarBNB(msg.sender, msg.value - costo);

        // reportar a Contabilidad (para el panel admin y el staking)
        if (contabilidad != address(0)) {
            uint256 stkUSD = (precioUSD_ * bpsStaking) / 10000;      // parte en USD (2 dec) al staking
            uint256 ownUSD = (precioUSD_ * (bpsOwner1 + bpsOwner2)) / 10000;
            try IContabilidad(contabilidad).reportar(msg.sender, keccak256("walletshield"), precioUSD_, stkUSD, ownUSD) {} catch {}
        }

        emit AccesoComprado(msg.sender, costo, nuevaExp);
    }

    /* ══════════════════ ADMINISTRACIÓN (multi-owner) ══════════════════ */

    function agregarOwner(address nuevo) external soloOwner { if (nuevo == address(0)) revert ParametroInvalido(); _agregarOwner(nuevo); }
    function _agregarOwner(address nuevo) internal { if (!esOwner[nuevo]) { esOwner[nuevo] = true; ownersList.push(nuevo); emit OwnerAgregado(nuevo); } }

    function quitarOwner(address quien) external soloOwner {
        if (!esOwner[quien]) revert ParametroInvalido();
        // no permitir quedarse sin owners
        uint256 vivos; for (uint256 i; i < ownersList.length; i++) { if (esOwner[ownersList[i]]) vivos++; }
        if (vivos <= 1) revert ParametroInvalido();
        esOwner[quien] = false;
        emit OwnerQuitado(quien);
    }

    /** Lista de owners activos (para el panel admin). */
    function ownersActivos() external view returns (address[] memory) {
        uint256 n; for (uint256 i; i < ownersList.length; i++) { if (esOwner[ownersList[i]]) n++; }
        address[] memory out = new address[](n); uint256 j;
        for (uint256 i; i < ownersList.length; i++) { if (esOwner[ownersList[i]]) { out[j++] = ownersList[i]; } }
        return out;
    }

    /** Cambiar el precio de acceso (en USD, 2 decimales). $5.00 = 500. */
    function setPrecioUSD(uint256 nuevoUSD) external soloOwner { if (nuevoUSD == 0) revert ParametroInvalido(); precioUSD_ = nuevoUSD; emit PrecioCambiado(nuevoUSD); }

    /** Cambiar la duración del acceso. */
    function setDuracion(uint256 segundos_) external soloOwner { if (segundos_ < 1 days) revert ParametroInvalido(); duracion = segundos_; }

    /** Cambiar el reparto (bps, deben sumar 10000). */
    function setReparto(uint256 o1, uint256 o2, uint256 stk, uint256 fauc) external soloOwner {
        if (o1 + o2 + stk + fauc != 10000) revert ParametroInvalido();
        bpsOwner1 = o1; bpsOwner2 = o2; bpsStaking = stk; bpsFaucet = fauc;
        emit RepartoCambiado(o1, o2, stk, fauc);
    }

    /** Cambiar las wallets que reciben el reparto de owners. */
    function setOwnersPago(address _o1, address _o2) external soloOwner { if (_o1 == address(0) || _o2 == address(0)) revert ParametroInvalido(); owner1 = _o1; owner2 = _o2; }

    /** Conectar/actualizar los contratos del ecosistema. */
    function setOraculo(address a) external soloOwner { if (a == address(0)) revert ParametroInvalido(); oraculo = a; emit ParamCambiado("oraculo", a); }
    function setContabilidad(address a) external soloOwner { contabilidad = a; emit ParamCambiado("contabilidad", a); }
    function setStaking(address a) external soloOwner { staking = a; emit ParamCambiado("staking", a); }
    function setGasFaucet(address a) external soloOwner { gasFaucet = a; emit ParamCambiado("gasFaucet", a); }

    /** Circuit breaker de emergencia. */
    function setPausado(bool v) external soloOwner { pausado = v; emit Pausado(v); }

    /* ══════════════════ LISTA NEGRA COMUNITARIA (v2) ══════════════════
       Los suscriptores reportan wallets que estafaron; cualquiera consulta. Las direcciones
       del ecosistema (este contrato, los owners, el oraculo, contabilidad, staking, faucet y
       las que un owner marque como protegidas) NO se pueden reportar. Un owner puede vetar
       una direccion (confirmada), quitarle el veto o limpiar sus reportes. */

    function claveBSC(address a) public pure returns (bytes32) { return bytes32(uint256(uint160(a))); }
    function claveTron(string calldata t) public pure returns (bytes32) { return keccak256(bytes(t)); }

    /** ¿Es una direccion del ecosistema? Dinamico: si cambian los parametros, cambia la respuesta. */
    function esNuestra(address a) public view returns (bool) {
        if (a == address(this) || a == owner1 || a == owner2 || esOwner[a]) return true;
        if (a == oraculo || a == contabilidad || a == staking || a == gasFaucet) return true;
        return protegida[claveBSC(a)];
    }

    function reportarBSC(address a) external vivo { 
        if (a == address(0) || a == msg.sender) revert ParametroInvalido();
        if (esNuestra(a)) revert DireccionProtegida();
        _reportar(claveBSC(a));
    }
    function reportarTron(string calldata t) external vivo {
        bytes memory b = bytes(t);
        if (b.length != 34 || b[0] != "T") revert ParametroInvalido();
        bytes32 k = keccak256(b);
        if (protegida[k]) revert DireccionProtegida();
        _reportar(k);
    }
    function _reportar(bytes32 k) internal {
        if (!tieneAcceso(msg.sender)) revert SinAcceso();
        uint32 e = epoca[k];
        if (_yaReporto[k][e][msg.sender]) revert YaReportada();
        _yaReporto[k][e][msg.sender] = true;
        uint32 n = reportes[k] + 1;
        reportes[k] = n;
        emit Reportada(k, msg.sender, n);
    }

    /** Consulta: reportes acumulados, vetada por owner, protegida (nuestra), y si supera el umbral. */
    function consultar(bytes32 k) public view returns (uint32 n, bool veto, bool prot, bool reportada) {
        n = reportes[k]; veto = vetada[k]; prot = protegida[k];
        uint32 u = umbralReportes == 0 ? 1 : umbralReportes;
        reportada = veto || n >= u;
    }
    function consultarBSC(address a) external view returns (uint32 n, bool veto, bool prot, bool reportada) {
        (n, veto, prot, reportada) = consultar(claveBSC(a));
        if (esNuestra(a)) { prot = true; reportada = false; }
    }
    function consultarTron(string calldata t) external view returns (uint32 n, bool veto, bool prot, bool reportada) {
        return consultar(keccak256(bytes(t)));
    }
    function yaReporto(bytes32 k, address quien) external view returns (bool) { return _yaReporto[k][epoca[k]][quien]; }

    // ── administracion de la lista (solo owners) ──
    function vetar(bytes32 k, bool v) external soloOwner { vetada[k] = v; emit Vetada(k, v); }
    function limpiar(bytes32 k) external soloOwner { reportes[k] = 0; vetada[k] = false; epoca[k] += 1; emit Limpiada(k, epoca[k]); }
    function setProtegida(bytes32 k, bool v) external soloOwner { protegida[k] = v; emit Protegida(k, v); }
    function setProtegidasBSC(address[] calldata lista, bool v) external soloOwner {
        for (uint256 i; i < lista.length; i++) { bytes32 k = claveBSC(lista[i]); protegida[k] = v; emit Protegida(k, v); }
    }
    function setUmbralReportes(uint32 u) external soloOwner { umbralReportes = u; }

    /* ══════════════════ FONDOS ══════════════════ */

    /** Recibir BNB (para nutrir desde otras fuentes o donaciones). */
    receive() external payable { emit Recibido(msg.sender, msg.value); }

    /** Retirar BNB atascado (solo owner) — pull para el tesoro. */
    function retirarBNB(address para, uint256 monto) external soloOwner noReentrante {
        if (para == address(0) || monto > address(this).balance) revert ParametroInvalido();
        _enviarBNB(para, monto);
    }

    /** Rescatar tokens ERC20 enviados por error (solo owner). */
    function rescatarToken(address token, address para, uint256 monto) external soloOwner {
        if (para == address(0)) revert ParametroInvalido();
        IERC20Min(token).transfer(para, monto);
    }

    /// Solo un owner puede actualizar el contrato (UUPS).
    function _authorizeUpgrade(address) internal override soloOwner {}

    function _enviarBNB(address para, uint256 monto) internal {
        (bool ok, ) = payable(para).call{value: monto}("");
        require(ok, "BNB transfer failed");
    }
}
