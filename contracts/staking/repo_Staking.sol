// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*═══════════════════════════════════════════════════════════════════════
  Staking — bóveda no custodial y motor de liquidez de la plataforma.
  ═══════════════════════════════════════════════════════════════════════
  DISEÑO (ver README-V6):
  · El capital reposa en la MONEDA que se depositó y se devuelve en la MISMA
    moneda y cantidad exacta (si pones 1 BTC, retiras 1 BTC).
  · El PESO en el reparto se fija en USD por ORÁCULO al momento del depósito
    (nunca lo que declara el usuario). Reparto justo entre monedas distintas.
  · Reparto multi-token con "accumulated reward per share": gas constante y
    exacto al céntimo aunque haya millones de stakers.
  · Participación = real (depositada, valorada en USD) + asignada por el admin.
    La asignada cobra recompensas pero NO retira capital que no existe.
  · Cada contrato de la plataforma envía su parte (Swap/P2P 20 %, Futuros 50 %);
    el emisor pasa los bps; el panel los edita en cada contrato / en Tarifas.
  · Opción del usuario por depósito: holdear en su moneda o conservar en USDT
    (la conversión la gestiona el front; aquí se guarda la preferencia).
  · UUPS + espera 48 h · CEI + no reentrada · pausa y retiro de emergencia ·
    owner y comisión de unstake leídos de Tarifas.
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable@5.0.2/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/utils/SafeERC20.sol";

interface ITarifasStk {
    function esAdmin(address cuenta) external view returns (bool);
    function unstakeBps() external view returns (uint16);
}
interface IOraculo {
    function valorUSD(address token, uint256 cantidad) external view returns (uint256);
    function aceptado(address token) external view returns (bool);
}

contract Staking is Initializable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    uint256 private constant PRECISION = 1e18;

    struct Deposito {
        address token; uint256 monto; uint256 valorUSD;
        uint40 cuando; uint40 vence; bool holdMoneda; bool retirado;
    }
    struct Staker {
        uint256 pesoReal; uint256 pesoAsignado;
        mapping(address => uint256) rewardDebt;
        mapping(address => uint256) pendiente;
        Deposito[] depositos; uint40 primeraVez;
    }
    struct Asignacion { address cuenta; uint256 pesoUSD; string etiqueta; uint40 cuando; bool activa; }

    ITarifasStk public tarifas;
    IOraculo    public oraculo;
    address public principal;
    address public propuestaImpl; uint40 public propuestaEn; uint40 public constant ESPERA_UPGRADE = 48 hours;
    bool public pausado; uint40 public pausadoDesde; uint32 public diasEmergencia; uint40 public cooldownUnstake;

    uint256 public totalPeso; uint256 public totalReal; uint256 public totalAsignado;
    mapping(address => uint256) public capitalPorToken;
    mapping(address => uint256) public prestado;   // token => capital fuera, en manos del motor

    address[] public tokensRecompensa;
    mapping(address => bool) public esTokenRecompensa;
    mapping(address => uint256) public accPorShare;
    mapping(address => uint256) public repartidoTotal;
    mapping(address => uint256) public plataformaAcumulada;
    mapping(address => uint256) public origenAportado;

    mapping(address => Staker) internal stakers;
    address[] public listaStakers;

    mapping(address => bool) public tokenPermitido;
    mapping(address => bool) public contratoAutorizado;
    mapping(address => bool) public bloqueado;
    uint40[] public plazos;
    Asignacion[] public asignaciones;
    mapping(address => uint256) public idxAsignacion;
    mapping(address => uint40) public solicitudUnstake;

    uint256[36] private __gap;

    event Stake(address indexed cuenta, uint256 indexed idDeposito, address token, uint256 monto, uint256 valorUSD, uint40 vence, bool holdMoneda);
    event Unstake(address indexed cuenta, uint256 indexed idDeposito, address token, uint256 neto, uint256 comision);
    event Recompensa(address indexed cuenta, address indexed token, uint256 monto);
    event RecompensaRecibida(address indexed origen, address indexed token, uint256 total, uint256 aStakers, uint256 aPlataforma);
    event ParticipacionAsignada(address indexed cuenta, uint256 pesoUSD, string etiqueta);
    event ParticipacionRetirada(address indexed cuenta, uint256 pesoUSD);
    event Prestamo(address indexed motor, address indexed token, uint256 monto);
    event Devolucion(address indexed motor, address indexed token, uint256 monto);
    event TokenRecompensa(address indexed token, bool alta);
    event Config(bytes32 indexed clave, uint256 valor, address direccion);
    event Pausa(bool activa);
    event UpgradePropuesto(address impl, uint40 ejecutableDesde);

    error NoAutorizado(); error Pausado(); error MontoInvalido(); error TokenNoPermitido();
    error Bloqueado(); error PlazoInvalido(); error NoVencido(); error YaRetirado();
    error Cooldown(); error Upgrade(); error Limite(); error SinFondos(); error NoAceptado();

    modifier soloAdmin() { if (!(msg.sender == principal || (address(tarifas) != address(0) && tarifas.esAdmin(msg.sender)))) revert NoAutorizado(); _; }
    modifier activo() { if (pausado) revert Pausado(); _; }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _principal) external initializer {
        __UUPSUpgradeable_init(); __ReentrancyGuard_init();
        principal = _principal; diasEmergencia = 7;
        plazos.push(30 days); plazos.push(90 days); plazos.push(180 days); plazos.push(365 days);
    }

    function setTarifas(address t) external soloAdmin { tarifas = ITarifasStk(t); emit Config("tarifas", 0, t); }
    function setOraculo(address o) external soloAdmin { oraculo = IOraculo(o); emit Config("oraculo", 0, o); }
    function setPrincipal(address p) external { if (msg.sender != principal) revert NoAutorizado(); principal = p; emit Config("principal", 0, p); }
    function permitirToken(address t, bool v) external soloAdmin { tokenPermitido[t] = v; emit Config("tokenPermitido", v ? 1 : 0, t); }
    function autorizarContrato(address c, bool v) external soloAdmin { contratoAutorizado[c] = v; emit Config("contratoAutorizado", v ? 1 : 0, c); }
    function bloquearWallet(address a, bool v) external soloAdmin { bloqueado[a] = v; emit Config("bloqueada", v ? 1 : 0, a); }
    function setPlazos(uint40[] calldata ps) external soloAdmin { delete plazos; for (uint256 i; i < ps.length; i++) plazos.push(ps[i]); emit Config("plazos", ps.length, address(0)); }
    function setCooldownUnstake(uint40 s) external soloAdmin { cooldownUnstake = s; emit Config("cooldown", s, address(0)); }
    function setDiasEmergencia(uint32 d) external soloAdmin { diasEmergencia = d; emit Config("diasEmergencia", d, address(0)); }
    function altaTokenRecompensa(address t) external soloAdmin { _altaToken(t); }
    function pausar(bool v) external soloAdmin { pausado = v; pausadoDesde = v ? uint40(block.timestamp) : 0; emit Pausa(v); }

    function proponerUpgrade(address impl) external soloAdmin { propuestaImpl = impl; propuestaEn = uint40(block.timestamp); emit UpgradePropuesto(impl, uint40(block.timestamp) + ESPERA_UPGRADE); }
    function _authorizeUpgrade(address impl) internal view override soloAdmin {
        if (impl != propuestaImpl || impl == address(0) || block.timestamp < propuestaEn + ESPERA_UPGRADE) revert Upgrade();
    }

    function depositarRecompensa(address token, uint256 monto, uint16 bpsAStakers) external nonReentrant {
        if (!contratoAutorizado[msg.sender]) revert NoAutorizado();
        if (monto == 0 || bpsAStakers > 10000) revert MontoInvalido();
        _altaToken(token);
        uint256 antes = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), monto);
        _repartir(token, IERC20(token).balanceOf(address(this)) - antes, bpsAStakers);
    }
    function depositarRecompensaBNB(uint16 bpsAStakers) external payable nonReentrant {
        if (!contratoAutorizado[msg.sender]) revert NoAutorizado();
        if (msg.value == 0 || bpsAStakers > 10000) revert MontoInvalido();
        _altaToken(address(0)); _repartir(address(0), msg.value, bpsAStakers);
    }
    function _repartir(address token, uint256 recibido, uint16 bps) internal {
        uint256 aStakers = recibido * bps / 10000;
        origenAportado[msg.sender] += recibido;
        plataformaAcumulada[token] += recibido - aStakers;
        if (aStakers > 0 && totalPeso > 0) { accPorShare[token] += aStakers * PRECISION / totalPeso; repartidoTotal[token] += aStakers; }
        else if (aStakers > 0) plataformaAcumulada[token] += aStakers;
        emit RecompensaRecibida(msg.sender, token, recibido, aStakers, recibido - aStakers);
    }

    function _settle(address a) internal {
        Staker storage s = stakers[a];
        uint256 peso = s.pesoReal + s.pesoAsignado;
        uint256 n = tokensRecompensa.length;
        for (uint256 i; i < n; i++) {
            address t = tokensRecompensa[i];
            uint256 ganado = peso * accPorShare[t] / PRECISION;
            if (ganado > s.rewardDebt[t]) s.pendiente[t] += ganado - s.rewardDebt[t];
            s.rewardDebt[t] = ganado;
        }
    }
    function _resetDebt(address a) internal {
        Staker storage s = stakers[a];
        uint256 peso = s.pesoReal + s.pesoAsignado;
        uint256 n = tokensRecompensa.length;
        for (uint256 i; i < n; i++) { address t = tokensRecompensa[i]; s.rewardDebt[t] = peso * accPorShare[t] / PRECISION; }
    }

    function stake(address token, uint256 monto, uint40 plazo, bool holdMoneda) external activo nonReentrant returns (uint256 id) {
        if (bloqueado[msg.sender]) revert Bloqueado();
        if (!tokenPermitido[token]) revert TokenNoPermitido();
        if (monto == 0) revert MontoInvalido();
        if (address(oraculo) == address(0) || !oraculo.aceptado(token)) revert NoAceptado();
        bool plazoOk; for (uint256 i; i < plazos.length; i++) if (plazos[i] == plazo) { plazoOk = true; break; }
        if (!plazoOk) revert PlazoInvalido();
        uint256 vUSD = oraculo.valorUSD(token, monto);
        if (vUSD == 0) revert NoAceptado();
        _settle(msg.sender);
        uint256 antes = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), monto);
        if (IERC20(token).balanceOf(address(this)) - antes != monto) revert MontoInvalido();
        Staker storage s = stakers[msg.sender];
        if (s.primeraVez == 0) { s.primeraVez = uint40(block.timestamp); listaStakers.push(msg.sender); }
        s.pesoReal += vUSD; totalReal += vUSD; totalPeso += vUSD; capitalPorToken[token] += monto;
        id = s.depositos.length;
        s.depositos.push(Deposito(token, monto, vUSD, uint40(block.timestamp), uint40(block.timestamp) + plazo, holdMoneda, false));
        _resetDebt(msg.sender);
        emit Stake(msg.sender, id, token, monto, vUSD, uint40(block.timestamp) + plazo, holdMoneda);
    }

    function solicitarUnstake() external { solicitudUnstake[msg.sender] = uint40(block.timestamp); }

    function unstake(uint256 id) external nonReentrant {
        if (cooldownUnstake > 0 && block.timestamp < solicitudUnstake[msg.sender] + cooldownUnstake) revert Cooldown();
        Staker storage s = stakers[msg.sender];
        if (id >= s.depositos.length) revert MontoInvalido();
        Deposito storage d = s.depositos[id];
        if (d.retirado) revert YaRetirado();
        if (block.timestamp < d.vence) revert NoVencido();
        _settle(msg.sender);
        d.retirado = true;
        s.pesoReal -= d.valorUSD; totalReal -= d.valorUSD; totalPeso -= d.valorUSD;
        capitalPorToken[d.token] -= d.monto;
        _resetDebt(msg.sender);
        uint16 bps = address(tarifas) != address(0) ? tarifas.unstakeBps() : 100;
        uint256 comision = d.monto * bps / 10000;
        plataformaAcumulada[d.token] += comision;
        _enviar(d.token, msg.sender, d.monto - comision);
        emit Unstake(msg.sender, id, d.token, d.monto - comision, comision);
    }

    function reclamar(address token) public nonReentrant {
        _settle(msg.sender);
        Staker storage s = stakers[msg.sender];
        uint256 m = s.pendiente[token];
        if (m == 0) revert SinFondos();
        s.pendiente[token] = 0; _enviar(token, msg.sender, m);
        emit Recompensa(msg.sender, token, m);
    }
    function reclamarTodo() external nonReentrant {
        _settle(msg.sender);
        Staker storage s = stakers[msg.sender];
        uint256 n = tokensRecompensa.length;
        for (uint256 i; i < n; i++) { address t = tokensRecompensa[i]; uint256 m = s.pendiente[t]; if (m > 0) { s.pendiente[t] = 0; _enviar(t, msg.sender, m); emit Recompensa(msg.sender, t, m); } }
    }

    function asignarParticipacion(address cuenta, uint256 pesoUSD, string calldata etiqueta) external soloAdmin nonReentrant {
        if (cuenta == address(0) || pesoUSD == 0) revert MontoInvalido();
        _settle(cuenta);
        Staker storage s = stakers[cuenta];
        if (s.primeraVez == 0) { s.primeraVez = uint40(block.timestamp); listaStakers.push(cuenta); }
        s.pesoAsignado += pesoUSD; totalAsignado += pesoUSD; totalPeso += pesoUSD;
        _resetDebt(cuenta);
        uint256 pos = idxAsignacion[cuenta];
        if (pos == 0) { asignaciones.push(Asignacion(cuenta, pesoUSD, etiqueta, uint40(block.timestamp), true)); idxAsignacion[cuenta] = asignaciones.length; }
        else { Asignacion storage a = asignaciones[pos - 1]; a.pesoUSD += pesoUSD; a.activa = true; a.cuando = uint40(block.timestamp); }
        emit ParticipacionAsignada(cuenta, pesoUSD, etiqueta);
    }
    function quitarParticipacion(address cuenta, uint256 pesoUSD) external soloAdmin nonReentrant {
        _settle(cuenta);
        Staker storage s = stakers[cuenta];
        if (pesoUSD > s.pesoAsignado) pesoUSD = s.pesoAsignado;
        s.pesoAsignado -= pesoUSD; totalAsignado -= pesoUSD; totalPeso -= pesoUSD;
        _resetDebt(cuenta);
        uint256 pos = idxAsignacion[cuenta];
        if (pos != 0) { Asignacion storage a = asignaciones[pos - 1]; a.pesoUSD = s.pesoAsignado; a.activa = s.pesoAsignado > 0; }
        emit ParticipacionRetirada(cuenta, pesoUSD);
    }

    /// El motor de Futuros pide prestado capital (queda registrado como prestado).
    function prestar(address token, uint256 monto, address a) external nonReentrant {
        if (!contratoAutorizado[msg.sender]) revert NoAutorizado();
        uint256 disponible = capitalPorToken[token] - prestado[token];
        if (monto > disponible) revert Limite();
        prestado[token] += monto;
        _enviar(token, a, monto);
        emit Prestamo(msg.sender, token, monto);
    }
    /// El motor devuelve el capital prestado (con lo que corresponda).
    function devolver(address token, uint256 monto) external nonReentrant {
        if (!contratoAutorizado[msg.sender]) revert NoAutorizado();
        uint256 antes = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), monto);
        uint256 recibido = IERC20(token).balanceOf(address(this)) - antes;
        prestado[token] = prestado[token] > recibido ? prestado[token] - recibido : 0;
        emit Devolucion(msg.sender, token, recibido);
    }
    /// Capital libre de un token (no prestado).
    function disponibleParaPrestar(address token) external view returns (uint256) {
        return capitalPorToken[token] > prestado[token] ? capitalPorToken[token] - prestado[token] : 0;
    }

    function retirarPlataforma(address token, address a, uint256 monto) external soloAdmin nonReentrant {
        if (monto > plataformaAcumulada[token]) revert Limite();
        plataformaAcumulada[token] -= monto; _enviar(token, a, monto);
    }
    function rescatable(address token) public view returns (uint256) {
        uint256 bal = token == address(0) ? address(this).balance : IERC20(token).balanceOf(address(this));
        uint256 reservado = capitalPorToken[token] + plataformaAcumulada[token];
        if (reservado >= prestado[token]) reservado -= prestado[token]; // lo prestado no está en balance
        return bal > reservado ? bal - reservado : 0;
    }
    function rescatar(address token, address a, uint256 monto) external soloAdmin nonReentrant {
        if (monto > rescatable(token)) revert Limite();
        _enviar(token, a, monto);
    }
    function retiroEmergencia() external nonReentrant {
        if (!pausado || block.timestamp < pausadoDesde + uint256(diasEmergencia) * 1 days) revert NoVencido();
        Staker storage s = stakers[msg.sender];
        _settle(msg.sender);
        uint256 n = s.depositos.length;
        for (uint256 i; i < n; i++) {
            Deposito storage d = s.depositos[i];
            if (d.retirado) continue;
            d.retirado = true;
            s.pesoReal -= d.valorUSD; totalReal -= d.valorUSD; totalPeso -= d.valorUSD;
            capitalPorToken[d.token] -= d.monto;
            _enviar(d.token, msg.sender, d.monto);
            emit Unstake(msg.sender, i, d.token, d.monto, 0);
        }
        _resetDebt(msg.sender);
    }

    function participacionDe(address a) external view returns (uint256 pesoReal, uint256 pesoAsignado, uint256 total) {
        Staker storage s = stakers[a]; return (s.pesoReal, s.pesoAsignado, s.pesoReal + s.pesoAsignado);
    }
    function pendienteDe(address a, address token) external view returns (uint256) {
        Staker storage s = stakers[a];
        uint256 peso = s.pesoReal + s.pesoAsignado;
        uint256 ganado = peso * accPorShare[token] / PRECISION;
        uint256 extra = ganado > s.rewardDebt[token] ? ganado - s.rewardDebt[token] : 0;
        return s.pendiente[token] + extra;
    }
    function depositosDe(address a) external view returns (Deposito[] memory) { return stakers[a].depositos; }
    function numStakers() external view returns (uint256) { return listaStakers.length; }
    function numTokensRecompensa() external view returns (uint256) { return tokensRecompensa.length; }
    function numAsignaciones() external view returns (uint256) { return asignaciones.length; }
    function numPlazos() external view returns (uint256) { return plazos.length; }
    function primeraVezDe(address a) external view returns (uint40) { return stakers[a].primeraVez; }
    function porcentajeDe(address a) external view returns (uint256) {
        if (totalPeso == 0) return 0;
        Staker storage s = stakers[a]; return (s.pesoReal + s.pesoAsignado) * 1e6 / totalPeso;
    }

    function _altaToken(address t) internal { if (!esTokenRecompensa[t]) { esTokenRecompensa[t] = true; tokensRecompensa.push(t); emit TokenRecompensa(t, true); } }
    function _enviar(address token, address a, uint256 monto) internal {
        if (monto == 0) return;
        if (token == address(0)) { (bool ok, ) = payable(a).call{value: monto}(""); if (!ok) revert SinFondos(); }
        else IERC20(token).safeTransfer(a, monto);
    }
    receive() external payable {}
}
