// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/* ─────────────────────────────────────────────────────────────────────────
   TokenDF.sol. La moneda que crea el Launchpad de DecFreedom.

   Inmutable: sin proxy, sin owner, sin pausa, sin lista negra, sin mint.
   Supply fijo acunado una sola vez en el constructor. Las transferencias NUNCA
   se restringen ni se gravan: es un BEP-20 estandar a todos los efectos.

   Lo que si lleva dentro, acotado por los parametros fijados al crearla:
     · Reserva del suelo: la fabrica (el pool) le deposita una parte de cada
       venta. Cualquier holder puede quemar monedas y cobrar su parte
       proporcional de la reserva (redimir). La reserva solo entra; solo sale
       hacia quien quema. suelo = reserva / totalSupply.
     · Goteo del fundador: la parte del creador queda aqui dentro y se libera
       de forma lineal (sin cliff, sin adelantos, sin override).
   ───────────────────────────────────────────────────────────────────────── */

contract TokenDF is ERC20, ERC20Burnable {
    using SafeERC20 for IERC20;

    address public immutable fabrica;     // Launchpad (proxy): el unico que deposita en la reserva
    address public immutable creador;     // quien la creo (recibe el goteo)
    uint16  public immutable sueloBps;    // parte de cada venta que alimenta la reserva (0 = sin suelo)

    // Activo de la reserva: address(0) = BNB, otro = ERC20 (USDT). Lo fija la fabrica al abrir el pool.
    address public activoReserva;
    bool    public activoFijado;
    uint256 public reserva;               // lo que respalda el suelo (en activoReserva)

    // Goteo del fundador (lineal)
    uint256 public immutable vestTotal;
    uint64  public immutable vestInicio;
    uint64  public immutable vestDuracion;  // segundos; 0 si vestTotal == 0
    uint256 public vestReclamado;

    bool private _entrada;

    event ReservaDepositada(uint256 monto, uint256 reservaTotal);
    event Redimido(address indexed holder, uint256 quemado, uint256 pagado);
    event GoteoReclamado(uint256 monto, uint256 reclamadoTotal);

    error SoloFabrica(); error SoloCreador(); error Reentrada(); error SinReserva(); error Cantidad(); error Activo();

    modifier noReentrada() { if (_entrada) revert Reentrada(); _entrada = true; _; _entrada = false; }

    constructor(
        string memory nombre_, string memory simbolo_, uint256 supply_,
        address creador_, address fabrica_, uint16 sueloBps_, uint256 vestTotal_, uint64 vestDuracion_
    ) ERC20(nombre_, simbolo_) {
        require(creador_ != address(0) && fabrica_ != address(0), "dir");
        require(vestTotal_ <= supply_, "vest");
        require(vestTotal_ == 0 || vestDuracion_ > 0, "dur");
        fabrica = fabrica_; creador = creador_; sueloBps = sueloBps_;
        vestTotal = vestTotal_; vestInicio = uint64(block.timestamp); vestDuracion = vestTotal_ == 0 ? 0 : vestDuracion_;
        if (vestTotal_ > 0) _mint(address(this), vestTotal_);
        _mint(creador_, supply_ - vestTotal_);
    }

    /* ─────────── Reserva del suelo (solo la fabrica deposita) ─────────── */
    function fijarActivoReserva(address activo) external {
        if (msg.sender != fabrica) revert SoloFabrica();
        if (activoFijado) revert Activo();
        activoReserva = activo; activoFijado = true;
    }
    function depositarReserva() external payable {
        if (msg.sender != fabrica) revert SoloFabrica();
        if (!activoFijado || activoReserva != address(0)) revert Activo();
        if (msg.value == 0) revert Cantidad();
        reserva += msg.value;
        emit ReservaDepositada(msg.value, reserva);
    }
    function depositarReservaToken(uint256 monto) external {
        if (msg.sender != fabrica) revert SoloFabrica();
        if (!activoFijado || activoReserva == address(0)) revert Activo();
        if (monto == 0) revert Cantidad();
        uint256 antes = IERC20(activoReserva).balanceOf(address(this));
        IERC20(activoReserva).safeTransferFrom(msg.sender, address(this), monto);
        uint256 real = IERC20(activoReserva).balanceOf(address(this)) - antes;
        reserva += real;
        emit ReservaDepositada(real, reserva);
    }

    /** Suelo por moneda (18 decimales del activo de la reserva). */
    function suelo() public view returns (uint256) {
        uint256 ts = totalSupply();
        return ts == 0 ? 0 : reserva * 1e18 / ts;
    }

    /** Quema `cantidad` y cobra su parte proporcional de la reserva. Cualquier holder. */
    function redimir(uint256 cantidad) external noReentrada {
        if (cantidad == 0) revert Cantidad();
        if (reserva == 0) revert SinReserva();
        uint256 pago = reserva * cantidad / totalSupply();   // antes de quemar: proporcion sobre el supply actual
        _burn(msg.sender, cantidad);                          // efectos
        reserva -= pago;
        if (activoReserva == address(0)) { (bool ok,) = payable(msg.sender).call{value: pago}(""); require(ok, "pago"); }
        else IERC20(activoReserva).safeTransfer(msg.sender, pago);
        emit Redimido(msg.sender, cantidad, pago);
    }

    /* ─────────── Goteo del fundador ─────────── */
    function liberado() public view returns (uint256) {
        if (vestTotal == 0) return 0;
        if (block.timestamp >= vestInicio + vestDuracion) return vestTotal;
        return vestTotal * (block.timestamp - vestInicio) / vestDuracion;
    }
    function reclamable() public view returns (uint256) { return liberado() - vestReclamado; }
    function reclamarGoteo() external noReentrada {
        if (msg.sender != creador) revert SoloCreador();
        uint256 m = reclamable();
        if (m == 0) revert Cantidad();
        vestReclamado += m;
        _transfer(address(this), creador, m);
        emit GoteoReclamado(m, vestReclamado);
    }

    /* El BNB solo entra por depositarReserva (con msg.sender comprobado). */
    receive() external payable { revert SoloFabrica(); }
}
