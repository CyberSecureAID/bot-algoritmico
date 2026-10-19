# Keeper propio redundante sustituye a Cloudflare

## 1. Veredicto en 5 líneas

Recomiendo un keeper propio en dos VPS de proveedores distintos (Hostinger KVM 2 pagado en cripto más Hetzner o Vultr), activo-pasivo con lease, clave en KMS, envío por RPC privado y vigilancia externa gratuita; Cloudflare queda, como mucho, de latido de respaldo. Es la única opción que cumple los cinco criterios: 99,95 a 99,99 % alcanzable, cero poder sobre fondos (el contrato V15 ya verifica minOut, intervalo y pago), 160 a 600 USD al año, mantenible por una persona y sin proveedor único. Cloudflare de pago arregla la cuota y la CPU, no el cron: tres incidentes de Cron Triggers entre el 12 y el 15 de octubre de 2026 y ninguna garantía de entrega documentada. Los keepers como servicio están en rotación (Chainlink Automation deprecado, Defender apagado el 1-jul-2026, Gelato en disputa). Confianza: alta al descartar Cloudflare Free y los keepers gestionados; media-alta en el diseño de dos VPS, cuya disponibilidad es objetivo de ingeniería y no SLA.

## 2. Tabla comparativa de las opciones

| Opción | Fiabilidad | Costo anual est. | Esfuerzo | Riesgos | BSC | No custodia |
|---|---|---|---|---|---|---|
| Cloudflare Free | Baja: cron sin garantía, 10 ms CPU, 50 subpeticiones, 100k req/día | 0 USD | Ya hecho | Cron se borra en deploys, incidentes oct-2026, URL pública sin auth | Sí | Sí |
| Cloudflare de pago bien configurado | Media: quita cuota y CPU, no cambia el cron ni da SLA | 60 USD | Bajo | Mismos incidentes, sin soporte técnico, sin WebSocket persistente | Sí | Sí |
| Chainlink CRE | Alta en teoría (DON), sin historial en BSC | No verificado | Alto: SDK, WASM, aprobación, 3 workflows | Lock-in alto, early access, cron mínimo 30 s | Sí | Sí |
| Gelato / KeeperHub | Disputada: docs vivas vs cierre 31-mar-2026 según KeeperHub | Gas +30 % más G-Units (no verificado) | Medio | Churn, ejecutor único, BSC no confirmado en KeeperHub | Gelato sí | Sí |
| VPS propio en Hostinger | ~99,9 % (SLA sin términos) | 108 a 180 USD | Medio | Nodo único, créditos de CPU, renovación manual con cripto | Sí | Sí |
| VPS en 2 proveedores (Hostinger + otro) | 99,95 a 99,99 % objetivo | 160 a 260 USD; 540 a 600 con RPC de pago | Medio-alto al inicio | Failover propio; doble envío si falla la idempotencia | Sí | Sí |
| Serverless / schedulers gestionados | Media: granularidad 1 min, sin WebSocket | 60 a 300 USD | Medio | No reaccionan en segundos; un worker fijo cuesta lo mismo que un VPS | Sí | Sí |
| Ejecución on-chain incentivada | Alta si hay searchers; incierta en protocolos pequeños | Propina (centavos) | Alto: contrato nuevo y auditoría | Nadie integra el contrato; caso Orbs 2025 (152 k USD) | Sí | Sí, la más fuerte |
| Cuentas abstractas / claves de sesión | Depende del bundler (Pimlico) | No verificado; markup 5 a 25 % | Alto | ERC-7715 en Draft, lock-in, debilita el "no custodial" | Sí (7702) | Parcial |

## 3. Diagnóstico probable de lo ocurrido en Cloudflare

Hecho verificado en el repo: el Worker `bolita-keeper-bot` (repo `CyberSecureAID/bolita-keeper`, README.md:171-174) corre un cron por minuto que "no trabaja: reparte" hacia hasta 30 copias `/parte` por su URL pública (README.md:190-199); `/registrar` y `/estado` son públicos (README.md:176-179). Cada invocación cron y cada `fetch` a la URL pública cuenta como request; los subrequests no ([Pricing](https://developers.cloudflare.com/workers/platform/pricing/), 2026-10-19).

1. **Fan-out fijo más reintentos (más probable).** 1 cron más 30 `/parte` por minuto son hasta 44.640 requests al día con un solo bot (inferencia); un cron externo a `/run` (README-V3.md:42) o reintentos ante 403/429 superan los 100k. Comprobar en Metrics: requests cron frente a HTTP; en Logs, ruta `/parte`; `MAX_PARTES` en Settings.
2. **Límite de KV.** El Worker escribe estado cada corrida (README.md:277-278): unas 1.440 escrituras al día frente a las 1.000 del plan Free. Comprobar en Storage & Databases > KV y releer el correo: si dice "KV operations", es esto.
3. **Escáneres contra `workers.dev`.** Un Worker Free recibió 85.250 requests de una sola IP el 15-ago-2026 ([SumGuy](https://sumguy.com/bots-ate-my-worker-quota/)). Comprobar en Logs > Query Builder por ruta, user-agent e IP.

Cobro sin activación: esperar 48 h, revisar Billing > Invoices y Plans; si hay cargo sin plan, abrir caso en Support > Billing > Create a Case (disponible en Free) con fecha, importe e ID de transacción ([Soporte](https://developers.cloudflare.com/support/contacting-cloudflare-support/)); el chargeback es último recurso.

## 4. Arquitectura recomendada en pasos simples

1. **Contrato sin cambios de lógica.** `ejecutar` ya exige keeper o dueño y revierte sin `minOut`, sin intervalo DCA o sin mes pagado (GridBotV15.sol:323-371; DcaLib.sol:46). El disparador solo elige cuándo. Basta `setKeeper`.
2. **Nodo A: Hostinger KVM 2** (8,99 USD/mes promo a 24 meses, 14,99 renovación), por CoinGate y prepagado porque con cripto no hay auto-renovación.
3. **Nodo B: Hetzner CX23 (~6,5 USD) o Vultr HF (6 USD, cripto vía BitPay)** en otra región, mismo código bajo systemd.
4. **Un solo líder:** lease con TTL en Upstash o Neon (gratis); el pasivo toma el mando si caduca más de 15 a 20 s; cada intención se registra antes de firmar; la tx firmada se difunde a dos RPC.
5. **Clave en AWS o GCP KMS**, nunca en el VPS; hot wallet con 0,05 a 0,2 BNB solo para gas.
6. **RPC:** Alchemy o NodeReal primario, Ankr o QuickNode secundario, públicos como terciario. Transacciones por PancakeSwap MEV Guard; bloXroute `bsc_private_tx` solo para el sniper.
7. **Monitoreo:** healthchecks.io y cron-job.org (gratis) con alertas Telegram por latido perdido, BNB bajo, tx sin minar y bloque atrasado.
8. **Cloudflare:** apagar `workers.dev` y el cron; conservarlo solo como tercer latido o `/estado`.

## 5. Costos

Base verificada: BNB 727,50 USD ([CoinGecko](https://www.coingecko.com/en/coins/bnb), 2026-10-19); gas medio 1,611 gwei el 30-sep-2026, rango 0,69 a 2,25 esa semana ([YCharts](https://ycharts.com/indicators/binance_smart_chain_average_gas_price)); mínimo 0,05 gwei desde el 1-oct-2025 ([Coinfomania](https://coinfomania.com/bnb-chain-gas-fee-0-05-gwei-transaction-cost-2025/)). Gas por `ejecutar` estimado en 230k (no verificado; el README midió 0,0000205 BNB, unos 0,015 USD, coherente con 0,1 gwei).

- **Por ejecución:** 0,008 USD a 0,05 gwei; 0,017 a 0,1 gwei; 0,27 a 1,611 gwei. Gelato o Chainlink añadirían 30 %.
- **Infraestructura:** 2 VPS 160 a 260 USD al año; con RPC de pago 540 a 600; KMS despreciable.
- **Grid de 100 niveles:** vuelta completa 2N-1 = 199 tx: 3,3 USD a 0,1 gwei, 54 USD a 1,611 gwei, a cargo del tanque `gasSaldo` del usuario.
- **1.000 usuarios:** 2.500 USD/mes; el gas lo reembolsa el usuario, la plataforma paga infraestructura (~50 USD/mes) y reverts. **10.000 usuarios:** 25.000 USD/mes; el cuello es RPC (150 a 250 USD/mes).

Comisiones: el contrato ya es híbrido (2,50 USD/bot/mes, 0,10 % por swap, gas reembolsado desde `gasSaldo`). Propuesta: mantenerlo; añadir un tope de gas price para el keeper (por ejemplo 0,3 gwei) sobre el cual el usuario activa "ejecución prioritaria" con gas más 20 %; tanque mínimo proporcional a 2N-1 por grid; y 0,5 a 1 % en el sniper, como GMGN, Maestro y Banana Gun (1 %), porque compite por inclusión y paga 15 a 30 veces más gas.

## 6. Riesgos principales y qué haría cambiar la recomendación

- **Doble envío en un failover:** cuesta gas, no fondos; `minOut` y los estados de nivel revierten la segunda llamada.
- **RPC como techo real:** los públicos limitan a 10k/5 min sin WebSocket; sin RPC de pago no se baja de un minuto de latencia.
- **Hostinger:** throttling al 30 % tras 3 h de CPU al 100 %, renovación manual con cripto, quejas de suspensión (no verificado); por eso el segundo nodo va en otro proveedor.
- **MEV en el sniper:** el RPC privado es probabilístico (4 a 5 s; tras un reorg la tx se hace pública); exige minOut estricto y deadline corto.

Cambiaría la recomendación si CRE publica precios y abre el registro sin aprobación (sería el respaldo descentralizado); si Cloudflare documenta garantía de entrega del cron (valdría como segundo nodo); si el contrato adopta "cualquiera ejecuta con propina" y searchers lo integran (bastaría un VPS de respaldo); o si el equipo crece.

## 7. Próximos pasos concretos y ordenados

1. Exportar de Cloudflare: código del Worker, cron real, métricas de requests y KV, logs de 3 días. Confirmar el fan-out.
2. Apagar `workers.dev` y el cron; abrir el caso de Billing.
3. Contratar Hostinger KVM 2 (24 meses, cripto) y Hetzner o Vultr; crear la clave en KMS y fondear 0,05 BNB.
4. Portar la lógica a un proceso persistente con systemd, lease, idempotencia y nonce explícito; reutilizar Multicall3 y el dry-run.
5. Medir gas real de 20 a 50 `ejecutar` en BscScan.
6. `setKeeper` a la nueva dirección; retirar BNB de la wallet antigua.
7. Activar healthchecks.io, cron-job.org y Telegram; simular la caída del nodo A.
8. Fijar tope de gas price y tanque mínimo por grid; reflejarlo en la UI.
9. Fase 2: reevaluar CRE cuando publique precios y el modo "cualquiera ejecuta con propina".

---

# Anexo

## A. Convenciones

Hecho verificado: afirmación con URL y fecha de acceso (todas 2026-10-19) o con referencia `archivo:línea` del repositorio local auditado. Inferencia: deducción a partir de hechos verificados. Opinión: juicio del redactor. "No verificado": no confirmado en fuente primaria.

## B. Hallazgos por pista

### B.1 Auditoría del repositorio (hechos verificados por archivo y línea)

- El código del Worker no está en el repo auditado; vive en `CyberSecureAID/bolita-keeper`, archivo `src/worker.js`, Worker `bolita-keeper-bot`, URL `bolita-keeper-bot.yamicelanvivesqui.workers.dev` (README.md:9-10, 171-174). No existe `wrangler.toml` ni handler `scheduled()` en el repo.
- Rutas del Worker: `/estado` (público), `/registrar?u=0xWallet` (público, llamado por la web al crear cada bot), `/parte?n=N&de=M&key=TOKEN`, `/run?key=ADMIN_TOKEN` (README.md:176-179; README-V3.md:27, 42).
- Diseño por invocación: "La corrida principal no trabaja: reparte. Llama a hasta 30 copias de sí misma en paralelo. Cada copia atiende 400 bots"; Multicall3 para 150 datos por petición; dry-run antes de cada tx; tope interno de 38 subpeticiones frente al límite de 50 (README.md:190-199).
- Frecuencia: cron cada minuto (README-V4.md:87-91; PROJECT-TRUTH-MAP.md:253; README-V3.md:43, 115).
- Fragilidad documentada: "el disparador vive en el cron interno de Cloudflare, que en el plan gratuito + deploys por Git es frágil: se borra o Cloudflare lo pausa" (README-V3.md:39); "Revisar por qué Cloudflare disparaba de más (correos de límite sin uso): posible bucle" (README-V7.md:398); "~959 errores" en métricas (PROJECT-TRUTH-MAP.md:381).
- Contrato: `ejecutar(bytes32 k, uint256 i)` exige `msg.sender==keeper || msg.sender==u` (GridBotV15.sol:327); revierte si no está al día el pago (331); exige `gasSaldo[u] >= gasMinOp` de 0,003 BNB solo cuando llama el keeper (333, 117); reembolsa gas usado más 50.000 de overhead al keeper desde el tanque del usuario (195-202). `keeper` es una sola dirección fijada con `setKeeper` por el owner (47, 461). `MAX_NIV = 100` (39). Cobro 2,50 USD por apertura vía oráculo (139-145, 259-271), reparto 20 % staking y 80 % owners (170-185). Comisión por swap `feeBps=10` (116).
- No custodial verificado: "el dinero vive en la wallet del usuario. Cada swap sale directo a su wallet" (GridBotV15.sol:7-8); `safeTransferFrom(u → this)` seguido de swap con `recipient = u` (422-432; AcumLib.sol:92-93; CashOutLib.sol:71-72; DcaLib.sol:50-51).
- Sin oráculo en ejecución: la decisión de precio está codificada en el `minOut` de cada nivel (CashOutLib.sol:20; AcumLib.sol:18; DcaLib.sol:19; AUDITORIA-BOTS-Y-REDISENO.md:14). DCA verifica el intervalo on-chain con `Pronto()` (DcaLib.sol:46).
- Transacciones por ciclo (inferencia): grid de N niveles, vuelta completa 2N-1 tx; Accumulator y Cash Out N+2 tx; DCA comprasMax (+1) tx. Con el preset "Tranquilo" de 24 cuadrículas, unas 47 tx.
- Frontend: nunca llama `ejecutar`; solo `GET /registrar` con fallo silencioso (modules/bots/bots-ui.js:460-463; PROJECT-TRUTH-MAP.md:254). Polling de lectura contra RPC públicos: P&L cada 10 s con 19 a 23 llamadas por tarjeta, gas cada 45 s, gráfica cada 6 s (bots-ui.js:2522, 1015-1024, 2225-2238).
- Estimación diaria con un bot (inferencia): 1.440 invocaciones cron; de 0 a 43.200 `/parte`; total 1.440 a 44.640 requests; 1.440 a 44.640 lecturas KV; 1.440 a 2.880 escrituras KV; 2 transacciones útiles.
- Puntos únicos de fallo en cadena (inferencia): cron, Worker, KV, RPC público, `KEEPER_PRIVATE_KEY` y saldo de `0x34D5…4419` (admin.js:37), dirección `keeper` del contrato, tanque del usuario, `pagadoHasta`, router PancakeSwap V3 con fallback multi-DEX.
- El equipo ya había decidido "Nada que dependa de Cloudflare u otro servidor para ejecutar dinero" (ROADMAP-SERVICIOS.md:29) y "cualquiera liquida/ejecuta con propina + Cloudflare de respaldo" (README-V7.md:396-397), pero el modo con propina no está implementado en V15 (inferencia).

### B.2 Cloudflare Workers (hechos verificados, acceso 2026-10-19)

- Free: 100.000 requests/día con reinicio a medianoche UTC, 10 ms de CPU por invocación, 50 subrequests, 5 Cron Triggers por cuenta; error 1027 al superar la cuota con ruta "fail open" o "fail closed" ([Limits](https://developers.cloudflare.com/workers/platform/limits/)).
- Paid: 5 USD/mes mínimo, 10 M requests incluidos y 0,30 USD por millón extra, 30 M CPU-ms, CPU por invocación 30 s por defecto, cron hasta 15 min; los subrequests no se facturan; el ejemplo oficial cuenta un cron horario como 720 requests al mes ([Pricing](https://developers.cloudflare.com/workers/platform/pricing/)).
- KV Free: 100.000 lecturas, 1.000 escrituras, 1.000 borrados y 1.000 list al día; al superarse, la operación falla ([Pricing](https://developers.cloudflare.com/workers/platform/pricing/)).
- Cron Triggers: sin intervalo mínimo documentado, sin garantías de entrega ni reintentos documentados; "Scheduled Workers run on underutilized machines"; cambios tardan hasta 15 min; cada deploy con Wrangler sustituye los triggers por los del archivo de configuración ([Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)).
- Incidentes: "Workers Cron Triggers issues" 15-oct-2026, ~1,1 h ([IsDown](https://isdown.app/status/cloudflare/incidents/670885-workers-cron-triggers-issues)); "Cron Trigger Activation Issues" 13-oct-2026, ~9 h ([IsDown](https://isdown.app/status/cloudflare/incidents/669416-cloudflare-workers-cron-trigger-activation-issues)); ídem 12-oct-2026, ~3 h ([IsDown](https://isdown.app/status/cloudflare/incidents/669003-cloudflare-workers-cron-trigger-activation-issues)). Hilo comunitario de mayo de 2026 con crons Free que dejaron de dispararse tras deploys y mención de ejecuciones duplicadas el 19-may-2026 ([Community](https://community.cloudflare.com/t/cron-trigger-silently-stopped-dispatching/928936/1)); la duplicación no tiene post-mortem oficial (no verificado).
- SLA: solo "Enterprise Subscription SLA" al 99,99 % con créditos; excluye bindings de almacenamiento; no menciona Cron Triggers ([Workers SLA](https://www.cloudflare.com/workers-service-level-agreement)). Free y PAYG: "No SLAs are offered"; Free solo puede abrir casos de billing, account y registrar ([Contacting Support](https://developers.cloudflare.com/support/contacting-cloudflare-support/)).
- `workers.dev` es pública, "intended for personal or hobby projects"; se desactiva en Settings > Domains & Routes o con `workers_dev = false`; Preview y Version URLs siguen activas ([workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)).
- Métricas: "Total" incluye todas las requests salvo las bloqueadas por WAF; estados `success`, `clientDisconnected`, `scriptThrewException`, `exceededResources`, `internalError`; hasta 3 meses de histórico ([Metrics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)). Workers Logs Free: 200.000 eventos/día y 3 días de retención ([Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)).
- Caso de escáneres: 94.504 requests en un día, 85.250 de una IP de Singapur contra `/blog//wp-login.php`, 71.004 en una hora (15-ago-2026) ([SumGuy](https://sumguy.com/bots-ate-my-worker-quota/)); fuente personal, no oficial.
- Cobro sin activación: esperar 48 h, limpiar caché, abrir ticket con ID de factura pidiendo aplicación manual; reembolsos por ticket ([Community Billing FAQ](https://community.cloudflare.com/t/billing-payment-subscription-issues/836351)).
- Inferencia: Paid elimina el 1027 y sube la CPU a 30 s, suficiente para firmar; no cambia la fiabilidad del cron ni evita que escáneres consuman cuota (pasan a costar 0,30 USD por millón).

### B.3 Keepers descentralizados en BSC (hechos verificados, acceso 2026-10-19)

- Chainlink Automation: "v1.x has been deprecated as of June 30, 2026" y "v2.1 has been deprecated as of July 31, 2026"; migrar a CRE ([docs.chain.link](https://docs.chain.link/chainlink-automation)). La tabla aún lista BNB mainnet con registry `0xDc21…A2C`, premium 30 % y gasto mínimo 0,1 LINK ([supported-networks](https://docs.chain.link/chainlink-automation/overview/supported-networks)); la documentación de contratos solo describe v2.1 ([automation-contracts](https://docs.chain.link/chainlink-automation/reference/automation-contracts.md)). Inferencia: el registry de BNB es v2.1 y está apagado; no confirmado on-chain. Fuente secundaria del 4-ago-2026: "Once a registry reached its sunset date, its upkeeps stopped being performed" ([dev.to](https://dev.to/0xramprasad/chainlink-runtime-environment-cre-2nh0)).
- Chainlink CRE: BNB Chain mainnet y testnet soportados desde CLI v1.0.0 ([supported-networks-ts](https://docs.chain.link/cre/supported-networks-ts.md)); cron mínimo 30 s, log trigger, bridge `AutomationReceiver` a `performUpkeep` ([cla-migration-ts](https://docs.chain.link/cre/reference/cla-migration-ts.md)); "Workflow deployment requires approval", cuota por defecto 3 workflows por organización ([deploying-workflows](https://docs.chain.link/cre/guides/operations/deploying-workflows.md)); sin precios públicos, remite a soporte in-app ([gelato-migration-ts](https://docs.chain.link/cre/reference/gelato-migration-ts)). Opinión: fricción alta para un desarrollador solo en octubre de 2026.
- Gelato Web3 Functions: tabla de redes con "Binance Smart Chain, Mainnet", página "Last updated 1 month ago" ([docs.gelato.cloud](https://docs.gelato.cloud/web3-services/web3-functions/supported-networks)); premium BNB 30 %, G-Units, 1Balance en USDC, "Transaction pays itself", página "Last updated 2 months ago" ([subscription-and-payments](https://docs.gelato.cloud/web3-services/web3-functions/subscription-and-payments)); Legacy Automate deprecado el 30-jun-2024 ([legacy-automate-migration-guide](https://docs.gelato.cloud/web3-services/web3-functions/legacy-automate-migration-guide)).
- OpenZeppelin Defender hosted retirado el 1-jul-2026; sustituido por Relayer y Monitor open-source en Docker con soporte Vault y AWS KMS ([Defender sunset FAQ](https://www.openzeppelin.com/news/defender-sunset-faq)).
- KeeperHub: "Defender shut down on July 1, 2026"; wallets Turnkey no custodiales; "EVM and Solana" sin nombrar BSC; sin precios ([KeeperHub Defender migration](https://docs.keeperhub.com/guides/defender-migration)); "Gelato is sunsetting Web3 Functions on March 31, 2026" ([KeeperHub Gelato migration](https://docs.keeperhub.com/guides/gelato-migration)). Fuente comercial interesada.
- Tenderly Web3 Actions: activo, solo plan de pago con ventas; 400 ejecuciones/5 min secuencial ([docs.tenderly.co](https://docs.tenderly.co/web3-actions/tutorials-and-quickstarts)). PowerPool PowerAgent solo Ethereum ([docs.powerpool.finance](https://docs.powerpool.finance/powerpool-and-poweragent-network/powerpool-overview/contracts-and-links)). Keep3r v2 solo Ethereum y Optimism ([GitHub](https://github.com/keep3r-network/keep3r-network-v2)). Autonomy Network sin evidencia de actividad (no verificado).
- Inferencia: ningún servicio vivo en BSC ofrece un mercado abierto de "cualquiera ejecuta con propina"; con miles de usuarios lo viable es un único workflow o task batched, nunca uno por usuario.

### B.4 Infraestructura propia (hechos verificados, acceso 2026-10-19)

- Hostinger KVM: KVM 1 6,49 USD promo y 11,99 renovación; KVM 2 (2 vCPU, 8 GB, 100 GB NVMe, 8 TB) 8,99 promo y 14,99 renovación; KVM 4 12,99 y 28,99; promo a 24 meses pagado por adelantado; backups semanales ([Hostinger VPS](https://www.hostinger.com/vps-hosting); [comparativa 1-oct-2026](https://www.hostinger.com/compare/hostinger-vs-hetzner)). Solo los planes VPS permiten crontab y procesos de larga duración ([Soporte](https://www.hostinger.com/support/?p=1373)). Créditos de CPU: baseline 60 %, unas 3 h al 100 % y después límite al 30 % en KVM 2 o superior ([Soporte CPU credits](https://www.hostinger.com/support/?p=19381)). Pago cripto por CoinGate desde 2021 ([Hostinger blog](https://www.hostinger.com/blog/hostinger-coingate-expanding-opportunities-in-crypto-payments/)); USDT y BNB solo en fuentes secundarias (no verificado); sin auto-renovación con cripto (fuente comercial, no verificado). SLA 99,9 % sin términos publicados. Ubicaciones: Francia, Alemania, Lituania, Reino Unido, India, Indonesia, Malasia, EE. UU. y Brasil ([Soporte ubicaciones](https://www.hostinger.com/support/1583267-where-are-hostinger-servers-located/)).
- Hetzner CX23: 2 vCPU, 4 GB, ~5,99 EUR con IPv4 (comparativa agosto 2026, [kimmo.suominen.com](https://kimmo.suominen.com/stuff/cpc-2026-08.txt)); SLA 99,9 % con créditos hasta el 100 % de la factura ([SLA](https://www.hetzner.com/legal/cloud-server/)); no acepta cripto ([Cherry Servers](https://www.cherryservers.com/blog/does-hetzner-accept-crypto)).
- Vultr: HF 1 vCPU, 1 GB, 6 USD ([Pricing](https://www.vultr.com/pricing/)); BitPay con BTC, ETH, LTC, USDC, DOGE y otras ([Payment methods](https://docs.vultr.com/support/platform/billing/what-payment-methods-do-you-accept)). OVH VPS-1 4,54 USD con backup diario y SLA 99,9 % ([OVH](https://us.ovhcloud.com/vps/)). DigitalOcean desde 4 USD, SLA 99,99 % (términos no verificados), sin cripto ([DO](https://www.digitalocean.com/pricing/droplets)).
- Schedulers: EventBridge precisión mínima 1 minuto ([AWS](https://docs.amazonaws.cn/en_us/eventbridge/latest/userguide/eb-create-rule-schedule.html)); cron-job.org gratis, 1 vez por minuto, alertas Telegram ([cron-job.org](https://cron-job.org/en/)); Railway Hobby 5 USD ([Railway](https://railway.com/pricing)); Render workers desde 7 USD ([Render](https://render.com/pricing)); Fly shared-cpu 1 GB 5,70 USD ([Fly](https://fly.io/docs/about/pricing/)); healthchecks.io 20 checks gratis ([healthchecks.io](https://healthchecks.io/pricing/)).
- RPC: públicos de BNB Chain a 10k/5 min, sin WSS y con `eth_getLogs` deshabilitado ([BNB Chain RPC docs](https://docs.bnbchain.org/bnb-smart-chain/developers/rpc/)); Alchemy Free 30 M CU/mes ([Alchemy](https://www.alchemy.com/pricing)); NodeReal Free 10 M CU, Growth 31 USD/mes anual ([NodeReal](https://nodereal.io/pricing)); QuickNode Build 34 USD anual o 49 mensual ([QuickNode](https://www.quicknode.com/pricing)); Ankr PAYG, WSS solo en Premium ([Ankr](https://www.ankr.com/docs/rpc-service/service-plans/)).
- Inferencia de niveles: A (1 VPS, ~99,9 %, 5 a 9 USD/mes); B (2 VPS en 2 proveedores con lease, 99,95 a 99,99 %, 11 a 13 USD/mes); C (B más RPC de pago, 45 a 50 USD/mes). 99,999 % fuera de alcance para una sola persona.

### B.5 Economía, MEV y seguridad (hechos verificados, acceso 2026-10-19)

- BNB 727,50 USD ([CoinGecko](https://www.coingecko.com/en/coins/bnb)). Gas medio diario: 1,611 gwei el 30-sep-2026; 0,838 el 29-sep; 2,250 el 27-sep; 0,6949 el 26-sep ([YCharts](https://ycharts.com/indicators/binance_smart_chain_average_gas_price)). Mínimo 0,05 gwei desde el 1-oct-2025 ([Coinfomania](https://coinfomania.com/bnb-chain-gas-fee-0-05-gwei-transaction-cost-2025/)). QuickNode mostraba 8,2 gwei, incoherente, se descarta (no verificado) ([QuickNode gas tracker](https://www.quicknode.com/gas-tracker/bsc-bnb-smart-chain)).
- Block time 0,45 s desde Fermi, 14-ene-2026, finalidad ~1,125 s ([BNB Chain blog](https://www.bnbchain.org/en/blog/fermi-hard-fork-accelerates-bsc-to-0-45-second-block-times)); Maxwell 30-jun-2025 a 0,75 s ([BlockEden](https://blockeden.xyz/blog/2026/01/08/bnb-chain-fermi-upgrade-sub-second-blocks/)).
- Gas units por acción: estimación no verificada (BscScan bloqueado por el proxy); 230.000 para swap con reparto de comisión.
- MEV: PBS vía BEP-322 con builders en lista blanca; 48 Club 56,7 % y BlockRazor 39,8 % de bloques entre mayo y noviembre de 2025, ~92 % del MEV ([arXiv 2602.15395](https://arxiv.org/html/2602.15395v1)). RPC privados gratuitos (PancakeSwap, 48 Club, Merkle, BlockRazor) con confirmación de 4 a 5 s ([docs.bnbchain.org MEV](https://docs.bnbchain.org/bnb-smart-chain/validator/mev/user-guide/)); PancakeSwap MEV Guard `https://bscrpc.pancakeswap.finance`, gratuito ([PancakeSwap](https://docs.pancakeswap.finance/trading-tools/pancakeswap-mev-guard.md)); bloXroute `bsc_private_tx` con `mev_builders` y BackRunMe ([bloXroute](https://docs.bloxroute.com/bsc/submit-transactions/bsc-private-transactions)); tras un reorg las txs se hacen públicas, recomiendan checks en contrato ([48 Club FAQ](https://docs.48.club/)).
- Competencia: GMGN, BonkBot, Trojan 1 %; Banana Gun 1 % en auto-snipes; Maestro 1 % más suscripción ([Datawallet, 21-jul-2026](https://www.datawallet.com/crypto/best-crypto-telegram-bots)); 3Commas Pro 37 USD/mes, Expert 59 ([ToolRadar](https://toolradar.com/tools/3commas/pricing)).
- Claves: nunca en `.env` ni en secret managers recuperables; KMS con secp256k1 (AWS ECC_SECG_P256K1, GCP EC_SIGN_SECP256K1_SHA256), 0,03 USD por 10.000 firmas, 50 a 200 ms ([Para](https://blog.getpara.com/comparing-backend-transaction-signing-architectures/)); módulo de firma dedicado que autentique cada petición ([NCC Group](https://www.nccgroup.com/research/state-of-the-art-of-private-key-security-in-blockchain-ops-3-private-key-storage-and-signing-module/)). Inferencia: hot wallet con 0,05 BNB cubre ~2.170 ejecuciones a 0,1 gwei; rotación trimestral vía `setKeeper`; playbook de compromiso = `setPausado` + `setKeeper` desde el owner, barrer BNB, deshabilitar la clave en KMS.
- Tron: Energy a 100 sun desde el 29-ago-2025, sin cuota gratuita; transferencia USDT ~65.000 Energy, 2 a 4 USD quemando TRX ([CoinsDo](https://waas.coinsdo.com/en/blog/trc20-fees-explained-energy-bandwidth-usdt-costs); [OneKey](https://onekey.so/blog/ecosystem/usdt-trc20-transfer-fees-energy-bandwidth/); [developers.tron.network](https://developers.tron.network/docs/resource-model)); TronGrid gratuito 100.000 req/día y 15 QPS; sin WebSocket, polling del /event API ([Chainstack, 15-oct-2026](https://chainstack.com/best-tron-rpc-providers-2026/)). Inferencia: un swap con reparto consumiría 150.000 a 300.000 Energy, 4,5 a 9 USD quemando TRX, 300 a 500 veces BSC; viable solo con Energy obtenida por staking o delegada desde cuenta fría; no existe keeper como servicio en Tron (ausencia de resultados, no prueba).

### B.6 Ejecución on-chain incentivada y cuentas abstractas (hechos verificados, acceso 2026-10-19)

- 1inch LOP v4 en BSC; resolvers con KYC/KYB y Access NFTs ([GitHub](https://github.com/1inch/limit-order-protocol); [1inch Business](https://business.1inch.com/portal/documentation/resolvers/introduction)). KyberSwap LO: relay off-chain y settlement on-chain ([KyberSwap](https://docs.kyberswap.com/developer-guide/start-here/foundational-solutions/off-chain-relay.md)). UniswapX en BNB desde el 9-jun-2026 ([Uniswap changelog](https://developers.uniswap.org/docs/changelog/completed-notifications/uniswapx-live-on-avalanche-base-bnb-and-tempo.md)).
- Orbs dLIMIT en PancakeSwap: takers cobran en token de salida, coste ~2x swap, "tiny orders" pueden no ejecutarse ([Orbs FAQ](https://orbs.com/dtwap-and-dlimit-faq)). Incidente de abril de 2025 en BNB Chain: 36 órdenes, 152.496,26 USD, órdenes de mercado sin protección de precio, remedio = adapter permisionado ([Orbs Disclosure](https://www.orbs.com/dTWAP-dLIMIT-Disclosure-2025-04-03)).
- Range orders V3: ejecución a precio medio del rango, ticks cuantizados, retirada manual y riesgo de reversión ([Uniswap docs](https://developers.uniswap.org/docs/sdks/v3/guides/managing-liquidity/range-orders)); equivalencia con PancakeSwap V3 es inferencia. Inferencia: reduce transacciones (mint, collect, re-mint) pero no elimina el keeper, que debe retirar tras cada cruce.
- EIP-7702 activo en BSC con Pascal (BEP-441), mainnet mediados de marzo de 2025 ([BNB Chain Forum](https://forum.bnbchain.org/t/faq-about-pascal-hardfork/3093)). Pimlico soporta BSC con EntryPoint v0.6 a v0.9 y 7702 ([Pimlico](https://docs.pimlico.io/infra/platform/supported-chains)). MetaMask smart account en BNB Chain ([MetaMask](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account)). ERC-7715 en Draft, solo define `expiry` ([EIP-7715](https://eips.ethereum.org/EIPS/eip-7715)). Delegator 7702 malicioso documentado ([DeFiHackLabs](https://defihacklabs.substack.com/p/top-7702-delegator-revealed-as-phishing)). Coste por UserOp en BSC: no verificado.
- Opinión: las session keys debilitan la afirmación "no custodial" porque el operador puede iniciar operaciones; solo es defendible si el alcance (router, función, par, cap, expiry) es verificable on-chain. El modelo actual (contrato verifica, keeper dispara) es más fuerte y ya está implementado.

## C. Tabla completa de costos

| Concepto | Valor | Base |
|---|---|---|
| Gas por `ejecutar` (230k gas) | 0,0084 USD a 0,05 gwei; 0,0167 a 0,1 gwei; 0,27 a 1,611 gwei | BNB 727,50 USD; gas units estimado |
| Medición del README | 0,0000205 BNB por operación (~0,015 USD a 727,50) | README.md:319-322 |
| 1.000 ejecuciones | 8,4 / 16,7 / 269,5 USD | Aritmética |
| Con premium 30 % (Gelato, Chainlink histórico) | 10,9 / 21,7 / 350 USD | Fórmula oficial |
| Usuario ligero (60 ejec./mes) | 0,50 / 1,00 / 16,17 USD al mes | A cargo del tanque del usuario |
| Grid 100 niveles, vuelta completa (199 tx) | 1,67 / 3,32 / 53,7 USD | 2N-1 tx |
| Tanque mínimo `gasMinOp` | 0,003 BNB = 2,18 USD | GridBotV15.sol:117 |
| Hot wallet keeper 0,05 BNB | 36 USD, ~2.170 ejecuciones a 0,1 gwei | Inferencia |
| Cloudflare Paid | 60 USD/año | 5 USD/mes |
| Hostinger KVM 2 | 108 USD/año promo (24 meses), 180 en renovación | hostinger.com |
| Hetzner CX23 | ~78 USD/año | ~6,5 USD/mes |
| Vultr HF 1 GB | 72 USD/año | 6 USD/mes |
| Dos nodos (Hostinger + Hetzner) | 186 a 258 USD/año | Suma |
| RPC de pago (NodeReal Growth o QuickNode Build) | 372 a 588 USD/año | 31 a 49 USD/mes |
| Total nivel B sin RPC de pago | 130 a 260 USD/año | |
| Total nivel C con RPC de pago | 540 a 850 USD/año | |
| KMS por firma | 0,03 USD por 10.000 firmas; cuota fija de clave no verificada | Para blog |
| Chainlink CRE | No verificado | Sin precio público |
| Ingreso 1.000 usuarios | 2.500 USD/mes (30.000 USD/año) | 2,50 USD/bot |
| Ingreso 10.000 usuarios | 25.000 USD/mes | Ídem |
| 0,10 % sobre 1.000 usuarios × 60 swaps × ticket 100 USD | 6.000 USD/mes | Ticket supuesto |

## D. Análisis de contradicciones

1. **Gelato: vivo o cerrado.** La pista de keepers encontró docs de Gelato actualizadas hace 1 y 2 meses que listan BSC y precios; la pista on-chain encontró que KeeperHub afirma el cierre de Web3 Functions el 31-mar-2026. La documentación propia de Gelato es fuente primaria y más fiable sobre el estado actual, pero las fechas "last updated" son relativas y KeeperHub es específico; además Chainlink publicó el 16-feb-2026 una guía de migración Gelato a CRE, señal de transición. Conclusión: estado disputado, verificable en 5 minutos en app.gelato.cloud; en cualquier caso descalificado como dependencia única.
2. **Chainlink Automation.** Las tablas de docs aún listan BNB mainnet, pero el banner oficial deprecia v1.x el 30-jun-2026 y v2.1 el 31-jul-2026. Prevalece el banner: no usar Automation clásico; CRE es el sustituto.
3. **Gas price de BSC.** YCharts/BscScan 0,69 a 2,25 gwei en septiembre 2026 frente a 8,2 gwei de QuickNode. Prevalece YCharts (serie fechada); QuickNode se considera caché anómala.
4. **Cobro por apertura.** El encabezado de GridBotV15 dice "1er bot GRATIS 30 días", pero el código cobra 2,50 USD en cada apertura fresca (259-271). Prevalece el código.
5. **Causa del límite en Cloudflare.** La pista Cloudflare ranqueó escáneres primero; la auditoría del repo aporta el fan-out fijo y las escrituras KV. Con ambos datos, el fan-out y KV son más específicos al síntoma "disparaba de más".
6. **Hostinger cripto.** Fuentes secundarias listan USDT y BNB; la página oficial no cargó. Tratar como probable, no verificado.

## E. Lagunas (no verificado)

- Código real del Worker, `MAX_PARTES`, cron efectivo, métricas de requests y KV, y si existe cron externo a `/run`.
- Gas units reales de `ejecutar` en BscScan; gas price p50 de inclusión en octubre de 2026.
- Precios de Chainlink CRE, G-Units de Gelato, KeeperHub, bloXroute y 48 Club premium.
- Términos de SLA de Hostinger y Vultr; lista oficial de criptomonedas aceptadas por Hostinger; cuota fija mensual de una clave en AWS o GCP KMS.
- Latencia medida de Gelato o CRE en BSC; tasa de fill de órdenes pequeñas por searchers en BSC.
- Energy real de un swap en SunSwap; precio de TRX en octubre de 2026; keepers en Tron.
- Coste por UserOperation en BSC; soporte de Safe y Binance Wallet para 7702.
- Versión desplegada en el proxy `0x4e86…F93B` y dirección `keeper` on-chain actual.

## F. Fuentes (todas accedidas el 2026-10-19)

Repositorio local `/home/claude/declive/`: `contracts/bots/GridBotV15.sol`, `DcaLib.sol`, `AcumLib.sol`, `CashOutLib.sol`, `SwapLib.sol`; `modules/bots/bots-ui.js`, `motor.js`, `orden.js`, `config.js`; `assets/js/admin.js`; `README.md`, `README-V3.md`, `README-V4.md`, `README-V7.md`, `README-V8.md`, `PROJECT-TRUTH-MAP.md`, `ROADMAP-SERVICIOS.md`, `AUDITORIA-BOTS-Y-REDISENO.md`.

Cloudflare: https://developers.cloudflare.com/workers/platform/pricing/ ; https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/workers/configuration/cron-triggers/ ; https://developers.cloudflare.com/workers/configuration/routing/workers-dev/ ; https://developers.cloudflare.com/workers/observability/metrics-and-analytics/ ; https://developers.cloudflare.com/workers/observability/logs/workers-logs/ ; https://www.cloudflare.com/workers-service-level-agreement ; https://developers.cloudflare.com/support/contacting-cloudflare-support/ ; https://community.cloudflare.com/t/billing-payment-subscription-issues/836351 ; https://community.cloudflare.com/t/cron-trigger-silently-stopped-dispatching/928936/1 ; https://isdown.app/status/cloudflare/incidents/670885-workers-cron-triggers-issues ; https://isdown.app/status/cloudflare/incidents/669416-cloudflare-workers-cron-trigger-activation-issues ; https://isdown.app/status/cloudflare/incidents/669003-cloudflare-workers-cron-trigger-activation-issues ; https://sumguy.com/bots-ate-my-worker-quota/

Keepers: https://docs.chain.link/chainlink-automation ; https://docs.chain.link/chainlink-automation/overview/supported-networks ; https://docs.chain.link/chainlink-automation/overview/automation-economics ; https://docs.chain.link/chainlink-automation/reference/automation-contracts.md ; https://docs.chain.link/cre/supported-networks-ts.md ; https://docs.chain.link/cre/reference/cla-migration-ts.md ; https://docs.chain.link/cre/guides/operations/deploying-workflows.md ; https://docs.chain.link/cre/reference/gelato-migration-ts ; https://dev.to/0xramprasad/chainlink-runtime-environment-cre-2nh0 ; https://docs.gelato.cloud/web3-services/web3-functions/supported-networks ; https://docs.gelato.cloud/web3-services/web3-functions/subscription-and-payments ; https://docs.gelato.cloud/web3-services/web3-functions/legacy-automate-migration-guide ; https://www.openzeppelin.com/news/defender-sunset-faq ; https://docs.keeperhub.com/guides/defender-migration ; https://docs.keeperhub.com/guides/gelato-migration ; https://docs.tenderly.co/web3-actions/tutorials-and-quickstarts ; https://docs.powerpool.finance/powerpool-and-poweragent-network/powerpool-overview/contracts-and-links ; https://github.com/keep3r-network/keep3r-network-v2

Infraestructura: https://www.hostinger.com/vps-hosting ; https://www.hostinger.com/compare/hostinger-vs-hetzner ; https://www.hostinger.com/support/?p=1373 ; https://www.hostinger.com/support/?p=19381 ; https://www.hostinger.com/support/1583267-where-are-hostinger-servers-located/ ; https://www.hostinger.com/blog/hostinger-coingate-expanding-opportunities-in-crypto-payments/ ; https://coingate.com/blog/post/hostinger-starts-accepting-cryptocurrency-payments-via-coingate ; https://www.solcard.cc/blog/pay-hostinger-with-crypto ; https://www.cherryservers.com/blog/does-hetzner-accept-crypto ; https://www.cherryservers.com/blog/buy-vps-with-crypto ; https://www.hetzner.com/legal/cloud-server/ ; https://kimmo.suominen.com/stuff/cpc-2026-08.txt ; https://www.vultr.com/pricing/ ; https://docs.vultr.com/support/platform/billing/what-payment-methods-do-you-accept ; https://us.ovhcloud.com/vps/ ; https://www.digitalocean.com/pricing/droplets ; https://aws.amazon.com/eventbridge/pricing/ ; https://docs.amazonaws.cn/en_us/eventbridge/latest/userguide/eb-create-rule-schedule.html ; https://cloud.google.com/scheduler/pricing ; https://railway.com/pricing ; https://render.com/pricing ; https://fly.io/docs/about/pricing/ ; https://cron-job.org/en/ ; https://healthchecks.io/pricing/ ; https://upstash.com/pricing/qstash ; https://docs.bnbchain.org/bnb-smart-chain/developers/rpc/ ; https://www.quicknode.com/pricing ; https://www.alchemy.com/pricing ; https://nodereal.io/pricing ; https://www.ankr.com/docs/rpc-service/service-plans/ ; https://www.vpsbenchmarks.com/hosters/hostinger

Economía, MEV y seguridad: https://www.coingecko.com/en/coins/bnb ; https://ycharts.com/indicators/binance_smart_chain_average_gas_price ; https://coinfomania.com/bnb-chain-gas-fee-0-05-gwei-transaction-cost-2025/ ; https://www.quicknode.com/gas-tracker/bsc-bnb-smart-chain ; https://www.bnbchain.org/en/blog/fermi-hard-fork-accelerates-bsc-to-0-45-second-block-times ; https://blockeden.xyz/blog/2026/01/08/bnb-chain-fermi-upgrade-sub-second-blocks/ ; https://www.dwellir.com/gas-tracker/binance-smart-chain ; https://crypto.news/binance-founder-proposes-lowering-bsc-gas-fees-by-three-to-10-times/ ; https://www.datawallet.com/crypto/best-crypto-telegram-bots ; https://toolradar.com/tools/3commas/pricing ; https://arxiv.org/html/2602.15395v1 ; https://docs.bnbchain.org/bnb-smart-chain/validator/mev/user-guide/ ; https://docs.bloxroute.com/bsc/submit-transactions/bsc-private-transactions ; https://docs.pancakeswap.finance/trading-tools/pancakeswap-mev-guard.md ; https://docs.48.club/ ; https://blog.getpara.com/comparing-backend-transaction-signing-architectures/ ; https://www.nccgroup.com/research/state-of-the-art-of-private-key-security-in-blockchain-ops-3-private-key-storage-and-signing-module/ ; https://developers.tron.network/docs/resource-model ; https://developers.tron.network/docs/feelimit ; https://onekey.so/blog/ecosystem/usdt-trc20-transfer-fees-energy-bandwidth/ ; https://waas.coinsdo.com/en/blog/trc20-fees-explained-energy-bandwidth-usdt-costs ; https://chainstack.com/best-tron-rpc-providers-2026/

On-chain y cuentas abstractas: https://github.com/1inch/limit-order-protocol ; https://business.1inch.com/portal/documentation/resolvers/introduction ; https://docs.kyberswap.com/developer-guide/start-here/foundational-solutions/off-chain-relay.md ; https://orbs.com/dtwap-and-dlimit-faq ; https://www.orbs.com/dTWAP-dLIMIT-Disclosure-2025-04-03 ; https://www.theblock.co/post/287714/pancakeswap-integrates-orbs-tools-dlimit-dtwap ; https://developers.uniswap.org/docs/changelog/completed-notifications/uniswapx-live-on-avalanche-base-bnb-and-tempo.md ; https://developers.uniswap.org/docs/sdks/v3/guides/managing-liquidity/range-orders ; https://faq.carbondefi.xyz/ ; https://forum.bnbchain.org/t/faq-about-pascal-hardfork/3093 ; https://docs.pimlico.io/infra/platform/supported-chains ; https://docs.zerodev.app/meta-infra/rpcs ; https://eips.ethereum.org/EIPS/eip-7715 ; https://docs.metamask.io/delegation-toolkit/experimental/erc-7715-request-permissions ; https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account ; https://beincrypto.com/trust-wallet-ethereum-eip7702-support/ ; https://defihacklabs.substack.com/p/top-7702-delegator-revealed-as-phishing
