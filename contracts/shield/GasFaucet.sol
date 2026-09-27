// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/* ─────────────────────────────────────────────────────────────────────────────
   GasFaucet.sol — Pozo de gas de Wallet Shield.

   Dos funciones:
     1) FAUCET GENERAL: una wallet puede reclamar una pequeña cantidad de BNB
        (para gas) UNA vez cada 30 días. Pensado para gente que se quedó sin gas
        y no puede mover sus fondos.
     2) "NOSOTROS PAGAMOS TU GAS" en la evacuación de emergencia: entrega la
        cantidad EXACTA de gas para UNA transacción, hasta 1 vez por semana por
        wallet (anti-abuso). La cantidad se adapta a lo que pida la red, nunca fija.

   Se alimenta desde WalletShield (parte del cobro) y desde cualquier otra fuente
   (otros contratos del ecosistema, donaciones). Multi-owner, configurable.

   Seguridad: pragma fijo, guard de reentrancia, checks-effects-interactions,
   límites por wallet/tiempo, y comprobación de saldo antes de pagar.
   ──────────────────────────────────────────────────────────────────────────── */

interface IOraculoF { function precioUSD(address) external view returns (uint256); }

contract GasFaucet is Initializable, UUPSUpgradeable {
    // ─────────── Roles ───────────
    mapping(address => bool) public esOwner;
    address[] private ownersList;
    mapping(address => bool) public autorizado;   // contratos que pueden pedir "pagar gas" (p.ej. la evacuación)

    // ─────────── Interconexión ───────────
    address public oraculo;   // para calcular equivalentes en USD si se desea

    // ─────────── Parámetros (configurables) ───────────
    uint256 public montoFaucetWei;     // cuánto BNB entrega el faucet general por reclamo
    uint256 public cooldownFaucet;     // cada cuánto puede reclamar una wallet (30 días)
    uint256 public maxGasCoverWei;     // tope de gas que cubrimos por transacción de evacuación
    uint256 public cooldownGasCover;   // cada cuánto cubrimos gas por wallet (7 días)

    // ─────────── Estado ───────────
    mapping(address => uint40) public ultimoFaucet;     // último reclamo del faucet general
    mapping(address => uint40) public ultimoGasCover;   // última cobertura de gas de evacuación

    // ─────────── Seguridad ───────────
    bool private _entrada;
    bool public pausado;

    // ─────────── Eventos ───────────
    event FaucetReclamado(address indexed wallet, uint256 monto);
    event GasCubierto(address indexed wallet, uint256 monto, address indexed pedidoPor);
    event Nutrido(address indexed de, uint256 monto);
    event OwnerAgregado(address indexed nuevo);
    event OwnerQuitado(address indexed quien);
    event AutorizadoCambiado(address indexed quien, bool estado);
    event ParamCambiado(string que, uint256 valor);
    event Pausado(bool estado);

    // ─────────── Errores ───────────
    error NoAutorizado();
    error EnPausa();
    error Reentrada();
    error ParametroInvalido();
    error EnfriamientoActivo();
    error PozoVacio();

    modifier soloOwner() { if (!esOwner[msg.sender]) revert NoAutorizado(); _; }
    modifier noReentrante() { if (_entrada) revert Reentrada(); _entrada = true; _; _entrada = false; }
    modifier vivo() { if (pausado) revert EnPausa(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _oraculo, address _dueno) public initializer {
        if (_dueno == address(0)) revert ParametroInvalido();
        _agregarOwner(_dueno);
        oraculo = _oraculo;
        // valores por defecto (ajustables desde el panel)
        montoFaucetWei   = 0.0004 ether;   // ~$0.25 aprox; cubre decenas de tx en BSC
        cooldownFaucet   = 30 days;
        maxGasCoverWei   = 0.0015 ether;   // tope para UNA transacción de evacuación
        cooldownGasCover = 7 days;
    }

    /* ══════════════════ 1 · FAUCET GENERAL ══════════════════ */

    /** ¿Puede esta wallet reclamar el faucet ahora? */
    function puedeReclamar(address wallet) public view returns (bool) {
        return block.timestamp >= uint256(ultimoFaucet[wallet]) + cooldownFaucet;
    }

    /** Cuándo podrá reclamar de nuevo (timestamp). 0 si puede ya. */
    function proximoReclamo(address wallet) external view returns (uint256) {
        uint256 t = uint256(ultimoFaucet[wallet]) + cooldownFaucet;
        return block.timestamp >= t ? 0 : t;
    }

    /** Reclamar el faucet general (una vez cada 30 días por wallet). */
    function reclamarFaucet() external vivo noReentrante {
        if (!puedeReclamar(msg.sender)) revert EnfriamientoActivo();
        uint256 monto = montoFaucetWei;
        if (address(this).balance < monto) revert PozoVacio();
        // EFFECTS antes de enviar
        ultimoFaucet[msg.sender] = uint40(block.timestamp);
        // INTERACTIONS
        _enviar(msg.sender, monto);
        emit FaucetReclamado(msg.sender, monto);
    }

    /* ══════════════════ 2 · "PAGAMOS TU GAS" (evacuación) ══════════════════ */

    /** Un contrato autorizado (la evacuación) pide que cubramos el gas de UNA
        transacción para 'wallet'. Cantidad adaptada a lo que pida la red (no fija),
        con tope y anti-abuso (1 vez/semana por wallet). Devuelve cuánto se envió;
        0 si no se pudo (pozo vacío o enfriamiento) — así el llamador sabe que el
        usuario debe pagar su propio gas (el fallback lo maneja la evacuación). */
    function cubrirGas(address wallet, uint256 gasWeiNecesario) external vivo noReentrante returns (uint256 enviado) {
        if (!autorizado[msg.sender]) revert NoAutorizado();
        if (wallet == address(0)) revert ParametroInvalido();
        // anti-abuso: 1 vez por semana por wallet
        if (block.timestamp < uint256(ultimoGasCover[wallet]) + cooldownGasCover) return 0;
        // cantidad = lo que pide la red, con tope
        uint256 monto = gasWeiNecesario;
        if (monto > maxGasCoverWei) monto = maxGasCoverWei;
        if (monto == 0) return 0;
        if (address(this).balance < monto) return 0;   // pozo vacío → 0 (el usuario pagará su gas)
        // EFFECTS
        ultimoGasCover[wallet] = uint40(block.timestamp);
        // INTERACTIONS
        _enviar(wallet, monto);
        emit GasCubierto(wallet, monto, msg.sender);
        return monto;
    }

    /** ¿Podemos cubrir gas a esta wallet ahora? (para que la UI lo consulte antes). */
    function puedeCubrirGas(address wallet) external view returns (bool) {
        if (pausado) return false;
        if (block.timestamp < uint256(ultimoGasCover[wallet]) + cooldownGasCover) return false;
        return address(this).balance >= 1;  // hay algo en el pozo
    }

    /* ══════════════════ NUTRIR EL POZO ══════════════════ */

    /** Cualquier contrato/fuente nutre el pozo con BNB. */
    function nutrir() external payable { emit Nutrido(msg.sender, msg.value); }
    receive() external payable { emit Nutrido(msg.sender, msg.value); }

    /* ══════════════════ ADMINISTRACIÓN ══════════════════ */

    function agregarOwner(address nuevo) external soloOwner { if (nuevo == address(0)) revert ParametroInvalido(); _agregarOwner(nuevo); }
    function _agregarOwner(address nuevo) internal { if (!esOwner[nuevo]) { esOwner[nuevo] = true; ownersList.push(nuevo); emit OwnerAgregado(nuevo); } }
    function quitarOwner(address quien) external soloOwner {
        if (!esOwner[quien]) revert ParametroInvalido();
        uint256 vivos; for (uint256 i; i < ownersList.length; i++) { if (esOwner[ownersList[i]]) vivos++; }
        if (vivos <= 1) revert ParametroInvalido();
        esOwner[quien] = false; emit OwnerQuitado(quien);
    }
    function ownersActivos() external view returns (address[] memory) {
        uint256 n; for (uint256 i; i < ownersList.length; i++) { if (esOwner[ownersList[i]]) n++; }
        address[] memory out = new address[](n); uint256 j;
        for (uint256 i; i < ownersList.length; i++) { if (esOwner[ownersList[i]]) out[j++] = ownersList[i]; }
        return out;
    }

    /** Autorizar/desautorizar un contrato para pedir cobertura de gas (la evacuación). */
    function setAutorizado(address quien, bool v) external soloOwner { if (quien == address(0)) revert ParametroInvalido(); autorizado[quien] = v; emit AutorizadoCambiado(quien, v); }

    function setMontoFaucet(uint256 wei_) external soloOwner { montoFaucetWei = wei_; emit ParamCambiado("montoFaucet", wei_); }
    function setCooldownFaucet(uint256 s) external soloOwner { if (s < 1 days) revert ParametroInvalido(); cooldownFaucet = s; emit ParamCambiado("cooldownFaucet", s); }
    function setMaxGasCover(uint256 wei_) external soloOwner { maxGasCoverWei = wei_; emit ParamCambiado("maxGasCover", wei_); }
    function setCooldownGasCover(uint256 s) external soloOwner { if (s < 1 hours) revert ParametroInvalido(); cooldownGasCover = s; emit ParamCambiado("cooldownGasCover", s); }
    function setOraculo(address a) external soloOwner { oraculo = a; }
    function setPausado(bool v) external soloOwner { pausado = v; emit Pausado(v); }

    /** Retirar BNB del pozo (solo owner) — por si hay que reubicar fondos. */
    function retirarBNB(address para, uint256 monto) external soloOwner noReentrante {
        if (para == address(0) || monto > address(this).balance) revert ParametroInvalido();
        _enviar(para, monto);
    }

    /// Solo un owner puede actualizar el contrato (UUPS).
    function _authorizeUpgrade(address) internal override soloOwner {}

    function _enviar(address para, uint256 monto) internal {
        (bool ok, ) = payable(para).call{value: monto}("");
        require(ok, "BNB transfer failed");
    }

    /** Saldo del pozo (para el panel y la UI). */
    function saldoPozo() external view returns (uint256) { return address(this).balance; }
}
