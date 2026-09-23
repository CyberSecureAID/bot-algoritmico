// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/*═══════════════════════════════════════════════════════════════════════
  GridBotV11 — Motor de bots (grid, acumulador, auto-sell, DCA) + swap.
  ═══════════════════════════════════════════════════════════════════════
  · NO CUSTODIAL: el dinero vive en la wallet del usuario. Cada swap sale
    directo a su wallet. El contrato no guarda capital de nadie.
  · MULTI-DEX de fábrica con fallback automático (Pancake → Uniswap → …),
    en la MISMA transacción, sin keeper. Router/quoter EDITABLES: si un DEX
    cambia una dirección, se corrige desde el panel sin redesplegar.
  · COBRO FLEXIBLE de bots (sin keeper, "lazy"):
      · 1er bot de cada wallet: GRATIS 30 días.
      · Bots extra al abrir: $2.50 en BNB al instante. Máx 8 por wallet.
      · A los 30 días, para seguir: $2.50 una vez (no por bot). Si no paga,
        los bots se PAUSAN (nunca se cierran solos). Un bot pausado SÍ se
        puede cerrar por el usuario (recupera su posición).
      · Reparto de cada cobro: 20% staking, 80% a los owners.
  · SWAP envuelve/desenvuelve BNB↔WBNB (resuelve el WBNB atascado).
  · Multi-owner vía Tarifas. UUPS. Reparto de comisión: 20% staking / 80% tesorería.
═══════════════════════════════════════════════════════════════════════*/

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {SwapLib} from "./SwapLib.sol";

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address,uint256) external returns (bool);
    function transferFrom(address,address,uint256) external returns (bool);
    function approve(address,uint256) external returns (bool);
    function allowance(address,address) external view returns (uint256);
}
interface IWBNB { function deposit() external payable; function withdraw(uint256) external; }
interface IStakingBot { function depositarRecompensa(address,uint256,uint16) external; }
interface ITarifasBot { function esAdmin(address) external view returns (bool); }
interface IOraculoBot { function precioUSD(address) external view returns (uint256); }

library SafeT {
    function _c(address t, bytes memory d) private { (bool ok, bytes memory r)=t.call(d); require(ok && (r.length==0||abi.decode(r,(bool)))); }
    function safeTransfer(address t,address to,uint256 v) internal { _c(t,abi.encodeWithSelector(IERC20.transfer.selector,to,v)); }
    function safeTransferFrom(address t,address f,address to,uint256 v) internal { _c(t,abi.encodeWithSelector(IERC20.transferFrom.selector,f,to,v)); }
}

interface IContabilidadGB { function reportar(address wallet, bytes32 servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external; }

contract GridBotV11 is Initializable, UUPSUpgradeable {
    using SafeT for address;
    using SwapLib for SwapLib.Dex[];

    address public constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    uint256 public constant BPS = 10000;
    uint256 public constant FEE_MAX = 100;
    uint256 public constant SLIP_MAX = 1000;
    uint256 public constant MAX_NIV = 100;
    uint256 public constant MES = 30 days;

    struct Nivel { uint128 minOutCompra; uint128 minOutVenta; uint8 estado; }
    struct ConfigIn {
        address base; address quote; uint256 ordenQuote; uint256 ordenBase;
        Nivel[] niveles; uint16 slippageBps; uint32 cooldownSeg;
        uint128 tpUnitOut; uint128 slUnitOut; uint24 feeTier;
        uint8 modo; uint16 objetivoBps; uint16 factorBps; uint256 compraInicialQuote;
        uint16 margenBps; uint256 botId; uint256 intervalo; uint32 comprasMax;
    }
    struct Rejilla {
        address   base;
        address   quote;
        address[] pathCompra;
        address[] pathVenta;
        uint256   ordenQuote;
        uint256   ordenBase;
        uint256   posicionBase;
        uint256   costeQuote;
        uint256   volumenQuote;
        int256    gananciaQuote;
        uint256   gasGastadoWei;
        uint128   tpUnitOut;
        uint128   slUnitOut;
        uint64    creadaEn;
        uint64    ultimaOpEn;
        uint32    comprasHechas;
        uint32    ventasHechas;
        uint32    ciclos;
        uint32    cooldownSeg;
        uint16    slippageBps;
        bool      activa;
        Nivel[]   niveles;
        uint24    feeTier;
        uint8     modo;
        uint16    objetivoBps;
        uint16    factorBps;
        uint16    margenBps;
        uint256   intervalo;
        uint32    comprasMax;
        bool      pausadaPago;   // V11: nuevo campo AL FINAL (no rompe layout)
    }
    struct TokenInfo { bool activo; string simbolo; }

    /* ---- Admin (orden EXACTO del V10 desplegado, NO tocar el orden) ---- */
    address public owner;
    address public ownerPendiente;
    address public keeper;
    address public beneficiario;      // V10 (se mantiene por layout; ya no se usa activamente)
    address public bolita;            // V10 (idem)
    address public modulo;
    uint256 public feeBps;
    uint256 public bancaShareBps;     // V10 (se mantiene por layout)
    uint256 public slippageMax;
    bool    public pausado;
    mapping(address => uint256) public gasSaldo;
    uint256 public gasMinOp;
    uint256 public gasOverhead;
    uint256 private _lock;
    mapping(bytes32 => Rejilla) private rejillas;
    mapping(bytes32 => address) public duenoDe;
    mapping(address => bytes32[]) public clavesDe;
    mapping(address => TokenInfo) public tokenInfo;
    mapping(address => bool) private _vistoToken;
    address[] public tokens;
    uint256 public precioSuscripcion;                 // V10
    mapping(address => uint256) public suscritoHasta; // V10

    /* ---- V11: variables NUEVAS, todas AL FINAL (ocupan parte del antiguo __gap) ---- */
    address public staking;
    address public tesoreria;
    address public tarifas;
    address public oraculo;
    address public owner2;
    uint256 public stakingBps;
    uint256 public costoBotUSD;
    uint256 public maxBots;
    mapping(address => uint32) public botsAbiertos;
    mapping(address => uint40) public pagadoHasta;
    mapping(address => bool)   public cobroAuto;
    SwapLib.Dex[] public dexes;
    uint256 public dexPref;
    bool    public v11Iniciado;
    address public contabilidad;   // contable central (reporta actividad). AL FINAL: no rompe storage.

    uint256[23] private __gap;

    modifier noReentrada() { require(_lock==1); _lock=2; _; _lock=1; }
    modifier soloOwner() { require(msg.sender==owner || msg.sender==owner2 || (tarifas!=address(0) && ITarifasBot(tarifas).esAdmin(msg.sender)), "no owner"); _; }

    /* ---- Bot (grid) ---- */


    /* ---- Eventos ---- */
    event RejillaCreada(address indexed u, address indexed base, address indexed quote, bytes32 clave, bool nueva, bool cobrada);
    event RejillaActiva(bytes32 indexed clave, bool activa);
    event RejillaPausadaPago(address indexed u, bytes32 clave);
    event Cerrada(address indexed u, bytes32 indexed clave, uint256 baseVendida, uint256 quoteRecibido);
    event Ejecutado(address indexed u, bytes32 indexed clave, uint256 i, bool compra, uint256 entrada, uint256 salida);
    event Comision(address indexed token, uint256 aStaking, uint256 aTesoreria);
    event CobroBot(address indexed u, uint256 montoBNB, uint40 hasta);
    event SwapHecho(address indexed u, address tokenIn, address tokenOut, uint256 entrada, uint256 salida);
    event ParamCambiado(string que, address valor);


    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address _staking, address _tesoreria, address _tarifas, address _oraculo) public initializer {
        owner = msg.sender; keeper = msg.sender;
        staking=_staking; tesoreria=_tesoreria; tarifas=_tarifas; oraculo=_oraculo;
        feeBps=10; stakingBps=2000; slippageMax=500;
        gasMinOp=0.003 ether; gasOverhead=50000;
        costoBotUSD=250; maxBots=8;
        _lock=1;
    }
    function _authorizeUpgrade(address) internal override soloOwner {}

    /* ═══════════ Multi-DEX (panel) ═══════════ */
    function agregarDex(address router, address quoter, string calldata nombre) external soloOwner {
        require(router!=address(0) && quoter!=address(0));
        dexes.push(SwapLib.Dex({router:router,quoter:quoter,nombre:nombre,activo:true,fallos:0,ultimoUso:0}));
    }
    function setDexDireccion(uint256 i, address router, address quoter) external soloOwner { require(i<dexes.length); dexes[i].router=router; dexes[i].quoter=quoter; }
    function setDexPref(uint256 i) external soloOwner { require(i<dexes.length && dexes[i].activo); dexPref=i; }

    /* ═══════════ Cobro de bots (lazy, sin keeper) ═══════════ */

    /** Precio del bot en BNB (wei), calculado desde el oráculo: costoBotUSD/precioBNB. */
    function costoBotBNB() public view returns (uint256) {
        if (oraculo == address(0)) return 0;
        uint256 pBNB = IOraculoBot(oraculo).precioUSD(address(0)); // USD por 1 BNB, 18 dec
        if (pBNB == 0) return 0;
        // costoBotUSD tiene 2 decimales ($2.50 = 250). BNB wei = (250/100) * 1e18 / (pBNB/1e18)
        return (costoBotUSD * 1e18 * 1e18) / (100 * pBNB);
    }

    /** ¿La wallet está al día para operar bots? (o no tiene ninguno todavía) */
    function alDia(address u) public view returns (bool) {
        if (botsAbiertos[u] == 0) return true;
        return pagadoHasta[u] >= block.timestamp;
    }

    /** Paga el uso mensual de los bots ($2.50 en BNB). Renueva 30 días. */
    function pagarMes() external payable noReentrada { _cobrarMes(msg.sender, msg.value); }
    function _cobrarMes(address u, uint256 enviado) internal {
        uint256 costo = costoBotBNB();
        require(costo > 0, "sin precio");
        require(enviado >= costo, "BNB insuficiente");
        uint256 base = pagadoHasta[u] > block.timestamp ? pagadoHasta[u] : uint40(block.timestamp);
        uint40 hasta = uint40(uint256(base) + MES);
        pagadoHasta[u] = hasta;
        _repartirCobro(costo);
        // devolver el vuelto si envió de más
        if (enviado > costo) { (bool ok,)=payable(u).call{value: enviado-costo}(""); require(ok); }
        emit CobroBot(u, costo, hasta);
        // Reportar a Contabilidad: el bot generó costoBotUSD (20% staking, 80% owners).
        _reportarCont(u,costoBotUSD*1e16,0,0);
    }

    /** Reparte un cobro en BNB: 20% staking, 80% a los dos owners (50/50). */
    function _repartirCobro(uint256 monto) internal {
        uint256 aStaking = (monto * stakingBps) / BPS;
        uint256 aOwners = monto - aStaking;
        if (aStaking > 0 && staking != address(0)) {
            // envuelve a WBNB y deposita al staking
            IWBNB(WBNB).deposit{value: aStaking}();
            IERC20(WBNB).approve(staking, aStaking);
            (bool ok,) = staking.call(abi.encodeWithSignature("depositarRecompensa(address,uint256,uint16)", WBNB, aStaking, uint16(10000)));
            if (!ok) { aOwners += aStaking; } // si falla, va a owners
        }
        uint256 mitad = aOwners / 2;
        if (mitad > 0) { (bool o1,)=payable(owner).call{value: mitad}(""); require(o1); }
        uint256 resto = aOwners - mitad;
        address dest2 = owner2 == address(0) ? owner : owner2;
        if (resto > 0) { (bool o2,)=payable(dest2).call{value: resto}(""); require(o2); }
    }

    /* ═══════════ Gas del usuario ═══════════ */
    receive() external payable { _acreditarGas(msg.sender, msg.value); }
    function depositarGas() external payable { _acreditarGas(msg.sender, msg.value); }
    function _acreditarGas(address u, uint256 v) internal { require(v>0); gasSaldo[u]+=v; }
    function retirarGas(uint256 m) external noReentrada { uint256 s=gasSaldo[msg.sender]; require(m>0&&m<=s); gasSaldo[msg.sender]=s-m; (bool ok,)=payable(msg.sender).call{value:m}(""); require(ok); }
    function _reembolsarGas(address u, uint256 gasIni) internal {
        if (msg.sender != keeper) return;
        uint256 costo = ((gasIni - gasleft()) + gasOverhead) * tx.gasprice;
        uint256 saldo = gasSaldo[u]; uint256 pago = costo > saldo ? saldo : costo;
        if (pago == 0) return;
        gasSaldo[u] = saldo - pago;
        (bool ok,)=payable(keeper).call{value:pago}(""); require(ok);
    }

    /* ═══════════ SWAP directo (área de swap) ═══════════ */
    /** Swap simple con fallback multi-DEX. Envuelve/desenvuelve BNB↔WBNB.
        tokenIn/out = WBNB para envolver/desenvolver; address(0) = BNB nativo. */
    function swap(address tokenIn, address tokenOut, uint24 feeTier, uint256 amountIn, uint256 minOut) external payable noReentrada returns (uint256 salida) {
        require(!pausado);
        // Caso envolver: BNB -> WBNB
        if (tokenIn == address(0) && tokenOut == WBNB) {
            require(msg.value == amountIn && amountIn > 0);
            IWBNB(WBNB).deposit{value: amountIn}();
            IERC20(WBNB).transfer(msg.sender, amountIn);
            emit SwapHecho(msg.sender, address(0), WBNB, amountIn, amountIn);
            return amountIn;
        }
        // Caso desenvolver: WBNB -> BNB
        if (tokenIn == WBNB && tokenOut == address(0)) {
            IERC20(WBNB).transferFrom(msg.sender, address(this), amountIn);
            IWBNB(WBNB).withdraw(amountIn);
            (bool ok,)=payable(msg.sender).call{value: amountIn}(""); require(ok);
            emit SwapHecho(msg.sender, WBNB, address(0), amountIn, amountIn);
            return amountIn;
        }
        // Swap normal por DEX (con comisión) — en función aparte para no agotar la pila
        salida = _swapNormal(tokenIn, tokenOut, feeTier, amountIn, minOut);
    }

    function _swapNormal(address tokenIn, address tokenOut, uint24 feeTier, uint256 amountIn, uint256 minOut) internal returns (uint256 salida) {
        address tin = tokenIn == address(0) ? WBNB : tokenIn;
        uint256 real;
        if (tokenIn == address(0)) { require(msg.value == amountIn); IWBNB(WBNB).deposit{value: amountIn}(); real = amountIn; }
        else { real = _pull(tin, msg.sender, amountIn); }
        uint256 net = _comision(tin, real);
        address tout = tokenOut == address(0) ? WBNB : tokenOut;
        address dest = tokenOut == address(0) ? address(this) : msg.sender;
        salida = dexes.swapUno(dexPref, tin, tout, feeTier, dest, net, minOut);
        if (tokenOut == address(0)) { IWBNB(WBNB).withdraw(salida); (bool ok,)=payable(msg.sender).call{value: salida}(""); require(ok); }
        emit SwapHecho(msg.sender, tokenIn, tokenOut, real, salida);
    }

    /* ═══════════ Crear / reconfigurar bot ═══════════ */
    function crearRejilla(ConfigIn calldata c) external payable noReentrada {
        require(c.base!=address(0) && c.quote!=address(0) && c.base!=c.quote);
        _reportarCont(msg.sender,0,0,0);
        require(c.niveles.length>0 && c.niveles.length<=MAX_NIV);
        require(c.ordenQuote>0);
        if (c.modo!=3) require(c.ordenBase>0);
        if (c.modo==3) require(c.intervalo>0);
        uint16 slip = c.slippageBps==0 ? uint16(slippageMax) : c.slippageBps;
        require(slip<=SLIP_MAX);
        require(c.feeTier==100||c.feeTier==500||c.feeTier==2500||c.feeTier==10000);

        bytes32 k = claveBot(msg.sender, c.base, c.quote, c.botId);
        Rejilla storage r = rejillas[k];
        bool primeraVez = duenoDe[k]==address(0);
        bool fresco = !r.activa;

        // ── COBRO: el 1er bot de la wallet es gratis; los demás cuestan al abrir ──
        bool cobrada = false;
        if (fresco) {
            uint32 nBots = botsAbiertos[msg.sender];
            require(nBots < maxBots, "limite de bots");
            if (nBots == 0) {
                // primer bot: gratis, arranca su mes
                pagadoHasta[msg.sender] = uint40(block.timestamp + MES);
            } else {
                // bot extra: cobra $2.50 en BNB ahora
                uint256 costo = costoBotBNB();
                require(costo>0 && msg.value>=costo, "paga el bot en BNB");
                _repartirCobro(costo);
                if (msg.value>costo) { (bool ok,)=payable(msg.sender).call{value: msg.value-costo}(""); require(ok); }
                cobrada = true;
            }
            botsAbiertos[msg.sender] = nBots + 1;
        }

        if (fresco) {
            r.posicionBase=0; r.costeQuote=0; r.volumenQuote=0; r.gananciaQuote=0;
            r.comprasHechas=0; r.ventasHechas=0; r.ciclos=0; r.creadaEn=uint64(block.timestamp);
        }
        delete r.niveles;
        r.base=c.base; r.quote=c.quote; r.ordenQuote=c.ordenQuote; r.ordenBase=c.ordenBase;
        r.slippageBps=slip; r.cooldownSeg=c.cooldownSeg; r.tpUnitOut=c.tpUnitOut; r.slUnitOut=c.slUnitOut;
        r.feeTier=c.feeTier; r.modo=c.modo; r.objetivoBps=c.objetivoBps; r.factorBps=c.factorBps;
        r.margenBps=c.margenBps; r.intervalo=c.intervalo; r.comprasMax=c.comprasMax;
        require(c.margenBps<=5000);
        if (c.modo==1) require(c.objetivoBps>=10 && c.objetivoBps<=10000);
        r.activa=true; r.pausadaPago=false;
        if (primeraVez) { clavesDe[msg.sender].push(k); duenoDe[k]=msg.sender; }
        for (uint256 j=0;j<c.niveles.length;j++){ require(c.niveles[j].estado<=2); r.niveles.push(Nivel(c.niveles[j].minOutCompra,c.niveles[j].minOutVenta,c.niveles[j].estado)); }

        // posición inicial
        if (fresco) {
            uint256 gastar=0;
            if (c.modo==1) gastar=c.compraInicialQuote;
            else if (c.modo==0) { uint256 nS=0; for(uint256 s=0;s<r.niveles.length;s++) if(r.niveles[s].estado==2) nS++; gastar=nS*r.ordenQuote; }
            else if (c.modo==3) gastar=c.ordenQuote;
            if (gastar>0) { (uint256 bOut,uint256 qIn)=_paso(msg.sender,r.quote,r.base,r.feeTier,gastar,0,slip); _compra(r,bOut,qIn); r.comprasHechas+=1; r.ultimaOpEn=uint64(block.timestamp); emit Ejecutado(msg.sender,k,0,true,qIn,bOut); }
            if (c.modo==3 && r.comprasMax>0 && r.comprasHechas>=r.comprasMax) r.activa=false;
            if (c.modo==2) { r.posicionBase=c.ordenBase; r.costeQuote=c.compraInicialQuote; }
        }
        emit RejillaCreada(msg.sender, c.base, c.quote, k, fresco, cobrada);
    }

    /* ═══════════ Ejecutar nivel (keeper o dueño) ═══════════ */
    function ejecutar(bytes32 k, uint256 i) public noReentrada {
        uint256 gasIni=gasleft();
        require(!pausado);
        address u=duenoDe[k]; require(u!=address(0));
        require(msg.sender==keeper || msg.sender==u);
        Rejilla storage r=rejillas[k];
        require(r.activa);
        // ── COBRO LAZY: si venció el mes, pausar (no operar) hasta pagar ──
        if (!alDia(u)) { r.pausadaPago=true; emit RejillaPausadaPago(u,k); revert("mes vencido: paga para seguir"); }
        require(!r.pausadaPago);
        require(i<r.niveles.length);
        if (msg.sender==keeper) require(gasSaldo[u]>=gasMinOp);
        if (r.cooldownSeg>0) require(block.timestamp>=r.ultimaOpEn+r.cooldownSeg);

        Nivel storage nv=r.niveles[i]; uint256 len=r.niveles.length;
        if (nv.estado==1) {
            uint256 montoC=r.ordenQuote;
            if (r.modo==1 && r.factorBps>0) montoC=r.ordenQuote*(BPS+uint256(r.factorBps)*(len-1-i))/BPS;
            (uint256 bOut,uint256 qIn)=_paso(u,r.quote,r.base,r.feeTier,montoC,nv.minOutCompra,r.slippageBps);
            nv.estado=0; r.comprasHechas+=1; r.ultimaOpEn=uint64(block.timestamp); _compra(r,bOut,qIn);
            if (r.modo==0 && i+1<len) r.niveles[i+1].estado=2;
            emit Ejecutado(u,k,i,true,qIn,bOut);
        } else if (nv.estado==2) {
            uint256 minV=nv.minOutVenta;
            if (r.margenBps>0 && r.posicionBase>0) { uint256 co=r.costeQuote*r.ordenBase/r.posicionBase; uint256 mm=co*(BPS+r.margenBps)/BPS; if(mm>minV) minV=mm; }
            (uint256 qOut,uint256 bIn)=_paso(u,r.base,r.quote,r.feeTier,r.ordenBase,minV,r.slippageBps);
            nv.estado=0; r.ventasHechas+=1; r.ultimaOpEn=uint64(block.timestamp); _venta(r,bIn,qOut);
            if (r.modo==2) r.activa=false; else if (i>0) r.niveles[i-1].estado=1;
            emit Ejecutado(u,k,i,false,bIn,qOut);
        } else revert();
        _reembolsarGas(u,gasIni);
    }

    /* ═══════════ Cerrar / cancelar (funciona aunque esté pausada) ═══════════ */
    function cerrarAhora(bytes32 k) public noReentrada {
        require(duenoDe[k]==msg.sender);
        _cerrar(msg.sender,k);
    }
    function _cerrar(address u, bytes32 k) internal {
        Rejilla storage r=rejillas[k]; require(r.ordenBase>0 || r.posicionBase>0);
        uint256 vender=r.posicionBase;
        uint256 saldoU=IERC20(r.base).balanceOf(u);
        uint256 permiso=IERC20(r.base).allowance(u,address(this));
        if (vender>saldoU) vender=saldoU; if (vender>permiso) vender=permiso;
        uint256 recibido; uint256 qOut;
        if (vender>0) { recibido=_pull(r.base,u,vender); uint256 net=_comision(r.base,recibido); qOut=dexes.swapUno(dexPref,r.base,r.quote,r.feeTier,u,net,0); _venta(r,recibido,qOut); r.ventasHechas+=1; }
        r.activa=false;
        uint256 n=r.niveles.length; for(uint256 i=0;i<n;i++) r.niveles[i].estado=0;
        if (botsAbiertos[u]>0) botsAbiertos[u]-=1;
        emit Cerrada(u,k,recibido,qOut);
    }

    /* ── Reporte a la Contabilidad (nunca rompe el flujo principal) ──
       reportar() marca la wallet como usuaria aunque el generado sea 0. */
    function _reportarCont(address wallet, uint256 gen, uint256 aStk, uint256 aOwn) internal {
        if (contabilidad == address(0)) return;
        try IContabilidadGB(contabilidad).reportar(wallet, 0x64025969a9b73963ca660a4c03c8a64d5174dd9862a435636a3c0b41e2ccc448, gen, aStk, aOwn) {} catch {}
    }

    /* ═══════════ Internas de swap/contabilidad ═══════════ */
    struct PasoIn { address u; address tin; address tout; uint24 fee; uint256 amt; uint256 minNivel; uint16 slip; }
    function _paso(address u, address tin, address tout, uint24 fee, uint256 amt, uint256 minNivel, uint16 slip) internal returns (uint256 salida, uint256 entradaReal) {
        return _pasoS(PasoIn(u, tin, tout, fee, amt, minNivel, slip));
    }
    function _pasoS(PasoIn memory p) internal returns (uint256 salida, uint256 entradaReal) {
        entradaReal = _pull(p.tin, p.u, p.amt);
        uint256 qG = dexes.cotiza(dexPref, p.tin, p.tout, p.fee, entradaReal);
        require(qG >= p.minNivel);
        uint256 net = _comision(p.tin, entradaReal);
        uint256 minReal = (qG * net / entradaReal) * (BPS - p.slip) / BPS;
        salida = dexes.swapUno(dexPref, p.tin, p.tout, p.fee, p.u, net, minReal);
    }
    function _pull(address t, address u, uint256 amt) internal returns (uint256 rec) {
        require(amt>0); uint256 antes=IERC20(t).balanceOf(address(this));
        t.safeTransferFrom(u,address(this),amt); rec=IERC20(t).balanceOf(address(this))-antes; require(rec>0);
    }
    function _comision(address tin, uint256 recibido) internal returns (uint256 net) {
        uint256 fee=(recibido*feeBps)/BPS; net=recibido-fee;
        if (fee==0) return net;
        uint256 aStaking=(fee*stakingBps)/BPS; uint256 aTes=fee-aStaking;
        if (aStaking>0 && staking!=address(0)) {
            IERC20(tin).approve(staking,aStaking);
            (bool ok,)=staking.call(abi.encodeWithSignature("depositarRecompensa(address,uint256,uint16)",tin,aStaking,uint16(10000)));
            if(!ok){ aTes+=aStaking; aStaking=0; }
        }
        if (aTes>0 && tesoreria!=address(0)) tin.safeTransfer(tesoreria,aTes);
        else if (aTes>0) tin.safeTransfer(owner,aTes);
        emit Comision(tin,aStaking,aTes);
    }
    function _compra(Rejilla storage r, uint256 b, uint256 q) internal { r.posicionBase+=b; r.costeQuote+=q; r.volumenQuote+=q; }
    function _venta(Rejilla storage r, uint256 b, uint256 proc) internal {
        uint256 cv=0;
        if (r.posicionBase>0){ uint256 bc=b<=r.posicionBase?b:r.posicionBase; cv=r.costeQuote*bc/r.posicionBase; r.posicionBase-=bc; r.costeQuote-=cv; r.ciclos+=1; }
        r.gananciaQuote+=int256(proc)-int256(cv); r.volumenQuote+=proc;
    }

    /* ═══════════ Lecturas ═══════════ */
    function claveBot(address u, address base, address quote, uint256 botId) public pure returns (bytes32) {
        if (botId==0) return keccak256(abi.encodePacked(u,base,quote));
        return keccak256(abi.encodePacked(u,base,quote,botId));
    }
    function misRejillas(address u) external view returns (bytes32[] memory) { return clavesDe[u]; }

    /* ═══════════ Owner (panel) ═══════════ */
    function setKeeper(address k) external soloOwner { keeper=k; }
    function setOwner2(address a) external soloOwner { owner2=a; emit ParamCambiado("owner2",a); }
    function setStaking(address a) external soloOwner { staking=a; }
    function setOraculo(address a) external soloOwner { oraculo=a; }
    function setContabilidad(address a) external soloOwner { contabilidad=a; }
    function setComision(uint256 _feeBps, uint256 _stakingBps) external soloOwner { require(_feeBps<=FEE_MAX && _stakingBps<=BPS); feeBps=_feeBps; stakingBps=_stakingBps; }
    function setCostoBot(uint256 usd2dec) external soloOwner { costoBotUSD=usd2dec; }
    function setPausado(bool p) external soloOwner { pausado=p; }
}
