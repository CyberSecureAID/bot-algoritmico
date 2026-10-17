// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/* ─────────────────────────────────────────────────────────────────────────
   FeatureTokens.sol. Espacios PREMIUM del Launchpad de DecFreedom.
   Proxy UUPS (este es el contrato de implementacion). Multi-owner, sin timelock.
   Contrato NUEVO e independiente: NO toca el Launchpad ni ningun otro contrato.

   Que hace:
     · 50 espacios ordenados por posicion (1 = la mas visible). Cada espacio se
       reserva por 30 dias de suscripcion, pagando en BNB el equivalente a un
       precio en USD por tanda (10 tandas de 5). Hay 1 dia de gracia para renovar.
     · reservar(slot, token): en UNA sola tx (atomica) paga y ubica un token SUYO
       en un espacio LIBRE. Se verifica ON-CHAIN (solo lectura) que msg.sender es
       el creador del token en el Launchpad, o el vendedor de un listado activo en
       el Mercado (List Your Token). Nadie puede ubicar un token ajeno.
     · renovar(slot): el inquilino suma 30 dias (antes de vencer, al final vigente;
       en gracia, desde ahora). Permitido incluso en pausa, para no perjudicar a
       quien ya pago.
     · liberarMio(slot): el inquilino retira su PROPIO token antes de tiempo (lo puso
       por error, era de prueba o ya no lo quiere). Solo quien lo publico, sin reembolso;
       el espacio queda libre al instante y el token puede ubicarse en otro.
     · Cobro en BNB con valor en USD via el oraculo YA desplegado del ecosistema
       (precioUSD(address(0)) = USD por 1 BNB). Si el oraculo no responde, cae al
       respaldo por tanda. Se reembolsa el exceso. Reparto 20% staking / 40% owner1
       / 40% owner2, con envio seguro (pull) anti-bloqueo.
     · Expiracion sin bots: el estado se calcula por fecha en las lecturas; un
       espacio vencido + gracia se da por LIBRE y se sobrescribe en la siguiente
       reserva. estadoEspacios() devuelve los 50 en UNA sola llamada.

   Seguridad: pragma fijo, checks-effects-interactions, guard de reentrancia,
   pausa de emergencia (solo bloquea reservar; renovar nunca se bloquea), control
   de acceso multi-owner, handover de owner en dos pasos, validacion de entradas,
   y envio de BNB seguro (si un receptor rechaza, su parte queda retirable).
   Toda lectura de otros contratos (Launchpad, Mercado, Oraculo) es SOLO LECTURA.
   ───────────────────────────────────────────────────────────────────────── */

// Launchpad ya desplegado: info(token) da el creador on-chain de una moneda creada.
interface ILaunchpadFT {
    function info(address token) external view returns (address creador, uint16 sueloBps, bool antibot, uint64 creadoEn);
}

// Mercado "List Your Token" ya desplegado: para tokens SIN liquidez, el dueño es el vendedor
// de un listado ACTIVO de ese token. Se leen los ids del token y, de cada uno, su ficha.
interface IMercadoFT {
    struct ListadoM {
        address vendedor; address token; string nombre; string simbolo; string logo;
        uint256 precio; uint256 enVenta; uint256 ganancia; uint64 creado; uint64 ultimoRetiro; bool activo;
    }
    function listadosDeToken(address token) external view returns (uint256[] memory);
    function ver(uint256 id) external view returns (ListadoM memory);
}

// Oraculo ya desplegado (OraculoPrecios). precioUSD(address(0)) = USD por 1 BNB (18 dec).
interface IOraculoFT { function precioUSD(address token) external view returns (uint256); }

// Contabilidad del ecosistema (opcional; si falla, no rompe el flujo).
interface IContabilidadFT { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; }

contract FeatureTokens is Initializable, UUPSUpgradeable {

    /* ─────────── Roles e interconexion ─────────── */
    mapping(address => bool) public esOwner;
    address[] private ownersList;
    address public owner1;
    address public owner2;
    address public staking;
    address public contabilidad;

    // Fuentes de verdad externas (SOLO LECTURA). Editables por si se actualizan/upgradean.
    address public launchpad;   // proxy del Launchpad (creador de cada moneda)
    address public mercado;     // MercadoTokens (List Your Token, sin liquidez)
    address public oraculo;     // OraculoPrecios (BNB/USD)

    /* ─────────── Constantes del producto ─────────── */
    uint8   public constant ESPACIOS = 50;
    uint8   public constant TIERS = 10;            // tandas de 5 (slot/5)
    uint64  public constant DURACION = 30 days;
    uint64  public constant GRACIA = 1 days;
    uint16  public constant BPS = 10000;
    uint16  public constant REP_STAKING_BPS = 2000;  // 20%
    uint16  public constant REP_OWNER1_BPS  = 4000;  // 40% (owner2 = resto exacto)
    uint256 public constant PRECIO_TIER_MAX = 1000e18;  // tope de seguridad por tanda (USD, 18 dec)
    bytes32 public constant CLAVE_CONT = keccak256("featuretokens");

    /* ─────────── Estado ─────────── */
    struct Espacio { address token; address inquilino; uint64 expira; }
    Espacio[50] public espacios;                 // indice 0..49 = posicion 1..50
    uint256[10] public precioTierUSD;            // precio mensual por tanda (USD, 18 dec)
    uint256[10] public fallbackBNBTier;          // respaldo en BNB por tanda si el oraculo no responde

    mapping(address => uint256) public saldoRetirable;   // pull: BNB que un receptor no pudo recibir
    address public owner1Propuesto;              // handover en dos pasos
    address public owner2Propuesto;
    bool public pausado;
    bool private _entrada;

    uint256[40] private __gap;

    /* ─────────── Eventos ─────────── */
    event Reservado(uint8 indexed slot, address indexed token, address indexed inquilino, uint64 expira, uint256 bnb, uint256 usd);
    event Renovado(uint8 indexed slot, address indexed token, address indexed inquilino, uint64 expira, uint256 bnb, uint256 usd);
    event Liberado(uint8 indexed slot, address token);
    event PagoRepartido(uint256 total, uint256 aStaking, uint256 aOwner1, uint256 aOwner2);
    event PrecioCambiado(uint8 indexed tier, uint256 usd);
    event FallbackCambiado(uint8 indexed tier, uint256 bnb);
    event OwnerCambiado(address indexed quien, bool esOwner);
    event OwnerPropuesto(uint8 cual, address propuesto);
    event ParamCambiado(string nombre, address valor);
    event Pausa(bool pausado);
    event Retiro(address indexed quien, uint256 monto);
    event TokenRetirado(uint8 indexed slot, address indexed token, address indexed inquilino);

    /* ─────────── Errores ─────────── */
    error NoAutorizado(); error Reentrada(); error Pausado(); error Params();
    error SlotMalo(); error NoDisponible(); error NoEresDueno(); error TokenEnUso();
    error PagoInsuficiente(); error Cantidad();

    modifier soloOwner() { if (!esOwner[msg.sender]) revert NoAutorizado(); _; }
    modifier noReentrada() { if (_entrada) revert Reentrada(); _entrada = true; _; _entrada = false; }
    modifier activo() { if (pausado) revert Pausado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    /** Inicializa el proxy. owner1/owner2 pueden ser la misma wallet (owner2 se cambia luego).
        _preciosUSD y _fallbackBNB: uno por tanda (10). staking/contabilidad pueden ir en cero. */
    function initialize(
        address _owner1, address _owner2, address _staking, address _contabilidad,
        address _launchpad, address _mercado, address _oraculo,
        uint256[10] calldata _preciosUSD, uint256[10] calldata _fallbackBNB
    ) external initializer {
        if (_owner1 == address(0) || _owner2 == address(0) || _launchpad == address(0) || _mercado == address(0) || _oraculo == address(0)) revert Params();
        // UUPSUpgradeable no guarda estado: su init es un no-op; no se llama (igual que LaunchpadDF).
        owner1 = _owner1; owner2 = _owner2; staking = _staking; contabilidad = _contabilidad;
        launchpad = _launchpad; mercado = _mercado; oraculo = _oraculo;
        for (uint8 i = 0; i < TIERS; i++) {
            if (_preciosUSD[i] == 0 || _preciosUSD[i] > PRECIO_TIER_MAX) revert Params();
            precioTierUSD[i] = _preciosUSD[i];
            fallbackBNBTier[i] = _fallbackBNB[i];
        }
        _addOwner(_owner1); _addOwner(_owner2);
    }

    function _authorizeUpgrade(address) internal override soloOwner {}

    /* ═══════════ Reservar (pagar + ubicar, atomico) ═══════════ */
    /** Reserva un espacio LIBRE y ubica un token tuyo, en UNA sola tx. Carrera: si dos reservan el
        mismo slot, la 2a ve el slot ocupado y revierte (no se le cobra; solo gasta gas). */
    function reservar(uint8 slot, address token) external payable activo noReentrada {
        if (slot >= ESPACIOS) revert SlotMalo();
        if (token == address(0)) revert Params();
        if (_estado(slot) != 0) revert NoDisponible();              // 0 = libre
        if (!_esDueno(token, msg.sender)) revert NoEresDueno();
        if (_tokenActivoEnOtro(token, slot)) revert TokenEnUso();   // un token = un solo espacio a la vez
        uint256 req = costoBNB(slot);
        if (msg.value < req) revert PagoInsuficiente();

        // EFECTOS antes que INTERACCIONES
        uint64 expira = uint64(block.timestamp) + DURACION;
        espacios[slot] = Espacio({ token: token, inquilino: msg.sender, expira: expira });

        uint256 usd = precioTierUSD[slot / 5];
        _repartir(req);
        uint256 exceso = msg.value - req;
        if (exceso > 0) _enviarSeguro(msg.sender, exceso);
        _reportar(msg.sender, usd);
        emit Reservado(slot, token, msg.sender, expira, req, usd);
    }

    /* ═══════════ Renovar (solo el inquilino; permitido aun en pausa) ═══════════ */
    function renovar(uint8 slot) external payable noReentrada {
        if (slot >= ESPACIOS) revert SlotMalo();
        Espacio storage e = espacios[slot];
        if (e.inquilino != msg.sender || e.token == address(0)) revert NoAutorizado();
        if (block.timestamp > uint256(e.expira) + GRACIA) revert NoDisponible();   // ya vencio + gracia: ya es libre
        uint256 req = costoBNB(slot);
        if (msg.value < req) revert PagoInsuficiente();

        // Antes de vencer: suma 30 dias al final vigente. En gracia (ya vencido): 30 dias desde ahora.
        uint64 base = block.timestamp < e.expira ? e.expira : uint64(block.timestamp);
        uint64 expira = base + DURACION;
        e.expira = expira;

        uint256 usd = precioTierUSD[slot / 5];
        _repartir(req);
        uint256 exceso = msg.value - req;
        if (exceso > 0) _enviarSeguro(msg.sender, exceso);
        _reportar(msg.sender, usd);
        emit Renovado(slot, e.token, msg.sender, expira, req, usd);
    }

    /* ═══════════ Retirar MI token antes de tiempo (solo el inquilino) ═══════════ */
    /** El inquilino quita su propio token del espacio cuando quiere (lo puso por error, era de prueba
        o ya no lo quiere). Solo quien lo publico. SIN reembolso. El espacio queda LIBRE al instante y
        el token puede volver a ubicarse en otro. No mueve BNB (sin riesgo de reentrancia). */
    function liberarMio(uint8 slot) external {
        if (slot >= ESPACIOS) revert SlotMalo();
        Espacio storage e = espacios[slot];
        if (e.inquilino != msg.sender || e.token == address(0)) revert NoAutorizado();
        address t = e.token;
        espacios[slot] = Espacio({ token: address(0), inquilino: address(0), expira: 0 });
        emit TokenRetirado(slot, t, msg.sender);
    }

    /* ═══════════ Costo en BNB de un espacio ═══════════ */
    /** USD de la tanda convertido a BNB con el oraculo (USD por 1 BNB, 18 dec). Si el oraculo no
        responde o da 0, cae al respaldo de la tanda. El front la lee ANTES de firmar y envia value ×1.02. */
    function costoBNB(uint8 slot) public view returns (uint256) {
        if (slot >= ESPACIOS) revert SlotMalo();
        uint8 tier = slot / 5;
        uint256 usd = precioTierUSD[tier];
        address o = oraculo;
        if (o != address(0)) {
            try IOraculoFT(o).precioUSD(address(0)) returns (uint256 p) {
                if (p > 0) return usd * 1e18 / p;
            } catch {}
        }
        return fallbackBNBTier[tier];
    }

    /* ═══════════ Lecturas ═══════════ */
    /** Estado de un espacio: 0 libre, 1 activo, 2 en gracia (solo el inquilino puede renovar). */
    function _estado(uint8 slot) internal view returns (uint8) {
        Espacio storage e = espacios[slot];
        if (e.token == address(0)) return 0;
        if (block.timestamp <= e.expira) return 1;
        if (block.timestamp <= uint256(e.expira) + GRACIA) return 2;
        return 0;   // vencido + gracia => libre
    }

    /** Los 50 espacios en UNA sola llamada (lee el oraculo una vez). El front pinta todo con esto. */
    function estadoEspacios() external view returns (
        address[50] memory token, address[50] memory inquilino, uint64[50] memory expira,
        uint8[50] memory estado, uint256[50] memory precioUSD, uint256[50] memory precioBNB
    ) {
        uint256 pBNB = 0;
        address o = oraculo;
        if (o != address(0)) { try IOraculoFT(o).precioUSD(address(0)) returns (uint256 p) { if (p > 0) pBNB = p; } catch {} }
        for (uint8 i = 0; i < ESPACIOS; i++) {
            Espacio storage e = espacios[i];
            token[i] = e.token; inquilino[i] = e.inquilino; expira[i] = e.expira;
            estado[i] = _estado(i);
            uint8 tier = i / 5;
            uint256 usd = precioTierUSD[tier];
            precioUSD[i] = usd;
            precioBNB[i] = pBNB > 0 ? (usd * 1e18 / pBNB) : fallbackBNBTier[tier];
        }
    }

    function espacio(uint8 slot) external view returns (address token, address inquilino, uint64 expira, uint8 estado) {
        if (slot >= ESPACIOS) revert SlotMalo();
        Espacio storage e = espacios[slot];
        return (e.token, e.inquilino, e.expira, _estado(slot));
    }
    function estadoDe(uint8 slot) external view returns (uint8) { if (slot >= ESPACIOS) revert SlotMalo(); return _estado(slot); }
    function precioUSDtier(uint8 tier) external view returns (uint256) { if (tier >= TIERS) revert Params(); return precioTierUSD[tier]; }
    function owners() external view returns (address[] memory) { return ownersList; }
    function version() external pure returns (uint256) { return 1; }

    /* ═══════════ Verificacion de dueño (SOLO LECTURA de otros contratos) ═══════════ */
    /** true si `who` es el creador del token en el Launchpad, o el vendedor de un listado ACTIVO de
        ese token en el Mercado. Con try/catch para no romperse si un contrato externo falla. */
    function _esDueno(address token, address who) internal view returns (bool) {
        // 1) Moneda creada en el Launchpad (cubre monedas de antes y despues del cambio de fabrica:
        //    el creador se registra en el MISMO proxy en todos los casos).
        try ILaunchpadFT(launchpad).info(token) returns (address creador, uint16, bool, uint64) {
            if (creador != address(0) && creador == who) return true;
        } catch {}
        // 2) Token listado SIN liquidez: vendedor de un listado activo de ese token.
        try IMercadoFT(mercado).listadosDeToken(token) returns (uint256[] memory ids) {
            uint256 n = ids.length; if (n > 30) n = 30;   // acotado
            for (uint256 k = 0; k < n; k++) {
                try IMercadoFT(mercado).ver(ids[k]) returns (IMercadoFT.ListadoM memory L) {
                    if (L.activo && L.token == token && L.vendedor == who) return true;
                } catch {}
            }
        } catch {}
        return false;
    }

    /** ¿El token ya ocupa OTRO espacio (activo o en gracia)? Un token no puede estar en dos a la vez. */
    function _tokenActivoEnOtro(address token, uint8 exceptoSlot) internal view returns (bool) {
        for (uint8 i = 0; i < ESPACIOS; i++) {
            if (i == exceptoSlot) continue;
            if (espacios[i].token == token && _estado(i) != 0) return true;
        }
        return false;
    }

    /* ═══════════ Reparto, envio seguro y retiro (patron del ecosistema) ═══════════ */
    /** 20% staking (si no acepta, a owners), 40% owner1, 40% owner2 (resto exacto, sin polvo). */
    function _repartir(uint256 req) internal {
        uint256 aStk = req * REP_STAKING_BPS / BPS;
        uint256 a1 = req * REP_OWNER1_BPS / BPS;
        uint256 a2 = req - aStk - a1;   // resto exacto
        bool okS = false;
        if (aStk > 0 && staking != address(0)) {
            (okS,) = staking.call{value: aStk}(abi.encodeWithSignature("depositarRecompensaBNB(uint16)", uint16(10000)));
        }
        if (!okS) { a1 += aStk / 2; a2 += aStk - aStk / 2; aStk = 0; }
        if (owner1 == owner2) {
            _enviarSeguro(owner1, a1 + a2);
        } else {
            _enviarSeguro(owner1, a1);
            _enviarSeguro(owner2, a2);
        }
        emit PagoRepartido(req, aStk, a1, a2);
    }

    /** Envio de BNB que NUNCA revierte: si el receptor rechaza, su monto queda retirable (pull). */
    function _enviarSeguro(address a, uint256 m) internal {
        if (m == 0 || a == address(0)) return;
        (bool ok,) = payable(a).call{value: m, gas: 30000}("");
        if (!ok) saldoRetirable[a] += m;
    }

    /** Retira lo que un envio no pudo entregar (owners/staking/inquilino que rechazaron BNB). */
    function retirar() external noReentrada {
        uint256 m = saldoRetirable[msg.sender];
        if (m == 0) revert Cantidad();
        saldoRetirable[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: m}("");
        require(ok, "retiro");
        emit Retiro(msg.sender, m);
    }

    function _reportar(address wallet, uint256 usd) internal {
        if (contabilidad == address(0)) return;
        uint256 aStk = usd * REP_STAKING_BPS / BPS;
        try IContabilidadFT(contabilidad).reportar(wallet, CLAVE_CONT, usd, aStk, usd - aStk) {} catch {}
    }

    /* ═══════════ Admin (multi-owner) ═══════════ */
    function setPrecioTier(uint8 tier, uint256 usd) external soloOwner {
        if (tier >= TIERS || usd == 0 || usd > PRECIO_TIER_MAX) revert Params();
        precioTierUSD[tier] = usd; emit PrecioCambiado(tier, usd);
    }
    function setFallbackTier(uint8 tier, uint256 bnb) external soloOwner {
        if (tier >= TIERS) revert Params();
        fallbackBNBTier[tier] = bnb; emit FallbackCambiado(tier, bnb);
    }
    function setOraculo(address a) external soloOwner { if (a == address(0)) revert Params(); oraculo = a; emit ParamCambiado("oraculo", a); }
    function setLaunchpad(address a) external soloOwner { if (a == address(0)) revert Params(); launchpad = a; emit ParamCambiado("launchpad", a); }
    function setMercado(address a) external soloOwner { if (a == address(0)) revert Params(); mercado = a; emit ParamCambiado("mercado", a); }
    function setStaking(address a) external soloOwner { staking = a; emit ParamCambiado("staking", a); }
    function setContabilidad(address a) external soloOwner { contabilidad = a; emit ParamCambiado("contabilidad", a); }
    function pausar(bool v) external soloOwner { pausado = v; emit Pausa(v); }

    /** Limpia un espacio YA vencido (cosmetico; las lecturas ya lo dan por libre). NUNCA expulsa a un
        inquilino vigente: exige estado libre. */
    function liberar(uint8 slot) external soloOwner {
        if (slot >= ESPACIOS) revert SlotMalo();
        if (_estado(slot) != 0) revert NoDisponible();
        address t = espacios[slot].token;
        espacios[slot] = Espacio({ token: address(0), inquilino: address(0), expira: 0 });
        emit Liberado(slot, t);
    }

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

    /* Handover en DOS pasos (sin esperas): proponer (owner) + aceptar (la wallet nueva). */
    function proponerOwner1(address a) external soloOwner { if (a == address(0)) revert Params(); owner1Propuesto = a; emit OwnerPropuesto(1, a); }
    function aceptarOwner1() external { if (msg.sender != owner1Propuesto) revert NoAutorizado(); owner1 = msg.sender; _addOwner(msg.sender); owner1Propuesto = address(0); emit ParamCambiado("owner1", msg.sender); }
    function proponerOwner2(address a) external soloOwner { if (a == address(0)) revert Params(); owner2Propuesto = a; emit OwnerPropuesto(2, a); }
    function aceptarOwner2() external { if (msg.sender != owner2Propuesto) revert NoAutorizado(); owner2 = msg.sender; _addOwner(msg.sender); owner2Propuesto = address(0); emit ParamCambiado("owner2", msg.sender); }

    /* El BNB entra solo por reservar / renovar (payable, con value comprobado). */
    receive() external payable { revert Cantidad(); }
}
