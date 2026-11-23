# Fase 2 — Disparador de órdenes: investigación del mecanismo

> Investigación del problema, antes de diseñar ningún contrato. Responde a lo que
> más te preocupa: cómo se dispara una orden (take profit, stop loss, apertura
> limit en long o short) en el precio correcto y en el momento correcto, sin
> margen de error por lag ni por movimientos rápidos, y quién la dispara de forma
> sostenible aunque no haya volumen grande. Alcance global de la plataforma, no
> solo análisis.

---

## Decisiones tomadas (14 nov 2026)

- **Alcance**: arrancamos solo por el área de análisis (spot): take profit, stop loss
  y apertura limit en long y short. Nada global todavía.
- **Fuente de la recompensa**: la comisión del protocolo que ya se cobra, con tope.
  No sale del operador.

---

## 0. La verdad primero, para no construir sobre una mentira

En una blockchain **no existe el "precio exacto en el instante exacto"** como un
tick continuo. El precio on chain solo existe en cada bloque, y una transacción
tarda en propagarse, entrar en un bloque y ejecutarse. Para cuando entra, el
mercado ya se movió un poco. Esto es física de redes, no un defecto que se pueda
programar para desaparecer. Ni Binance, ni ningún DEX, ni Chainlink disparan en el
tick perfecto. Prometer eso sería mentirte y montar un sistema que falla el primer
día con dinero real.

Lo que sí se puede garantizar, y es lo verdaderamente quirúrgico, es esto:

> **La orden NUNCA se ejecuta en un precio equivocado. Se ejecuta solo cuando el
> nivel se ha cumplido de verdad, a un precio fresco y validado, y tan rápido como
> la red permite. Quien dispara solo propone; el contrato es el que decide.**

Un reloj suizo no adivina el futuro: no se equivoca nunca y es constante. Esa es la
meta correcta. A continuación, cómo se logra de forma tajante.

---

## 1. La garantía de que nunca dispara en un precio que no corresponde

El miedo central que planteaste (que a alguien le cierren un take profit en pérdida,
o le abran en un valor que no fijó) se elimina con cuatro candados, todos del lado
del contrato, no del que dispara:

**1.1 Validación condicional en la ejecución.** El que dispara (humano o bot) llama
a una función de ejecutar. El contrato, en ese mismo momento, lee el precio del
oráculo y comprueba la condición: un take profit de un long solo pasa si el precio
subió al objetivo o más; un stop de un long solo pasa si bajó al stop o menos; una
apertura short solo pasa si el precio subió al nivel. **Si la condición no se
cumple, la transacción revierte.** El que disparó mal solo pierde su propio gas. Tu
orden queda intacta. No hay forma de accionarla en un precio que no corresponde.

Esto ya está probado en el repo: `contracts/Futuros/OrdenesLimite.sol` hace
exactamente esto para futuros (`if (!toca) revert PrecioNoAlcanzado()`), con
ejecución pública y propina. Es la prueba de que el patrón funciona aquí, no teoría.

**1.2 Dirección imposible de invertir.** El contrato fija que un take profit va por
encima de la entrada y un stop por debajo (y al revés en short). No se puede guardar
un take profit "en pérdida" ni por error de interfaz ni por malicia. La interfaz
avanzada lo refuerza visualmente, pero el candado real es on chain.

**1.3 Precio fresco de verdad: oráculo pull (Pyth), no un valor viejo.** El punto
que mata el lag. Pyth es un oráculo de tipo pull: fuera de la cadena publica el
precio firmado cada 50 a 200 milisegundos; el que dispara **adjunta ese precio
firmado y reciente dentro de la misma transacción** que ejecuta la orden. El
contrato verifica las firmas (3 de 5 de los emisores de Pyth) y usa ese precio. Así
el precio con el que se decide es el real de ese segundo, no uno rancio guardado en
la cadena. No es Chainlink, no se paga en LINK. En el repo ya está integrado:
`contracts/Futuros/OracleGuard.sol` cruza el oráculo base con Pyth y rechaza si
difieren más de un umbral.

**1.4 Freno anti gap y banda de slippage.** `OracleGuard` ya trae un circuit breaker:
si el precio salta más de un 15 por ciento de golpe (una caída de flash crash,
una manipulación), levanta bandera y congela las operaciones hasta que un admin
revise. Y el llenado se hace dentro de una banda de slippage máxima, así un
movimiento rápido no te ejecuta a un precio absurdo: si no cabe en la banda, revierte
y se reintenta en el siguiente bloque. Nadie te llena en un pico falso.

**1.5 El suelo de velocidad: BSC hoy.** BNB Smart Chain ya produce bloques cada 0.45
a 0.75 segundos (hard forks Maxwell y Fermi). Es decir, la ejecución sigue al precio
real con menos de un segundo de retraso. No se puede bajar de la física de la red,
pero sub segundo es tan ceñido como los mejores perp DEX del mercado.

**Resumen de la sección:** no prometemos el tick perfecto. Garantizamos que la orden
solo se ejecuta cuando el nivel se cumplió de verdad, con precio fresco y validado,
dentro de una banda, con freno ante saltos, y en menos de un segundo. Equivocarse es
imposible por diseño. Eso es el reloj suizo.

---

## 2. Quién dispara: el modelo de trabajadores (el corazón de tu pregunta)

Aquí está lo que de verdad te preocupa, y tienes toda la razón en tu objeción.

### 2.1 Por qué los keepers públicos profesionales no bastan

Investigué los modelos reales (GMX, Synthetix, Drift, UniswapX, CoW, 1inch Fusion).
La conclusión coincide con la tuya: la actividad de keepers y solvers **se concentra
en unas pocas firmas muy capitalizadas**, con infraestructura de baja latencia, y
solo aparecen donde hay volumen y recompensa que les rinda. A bajo volumen, no
vienen. Montar la plataforma esperando que vengan sería construir sobre arena. Por
eso no puede ser la solución general. Puede ser una capa, la de crecimiento, no el
cimiento.

### 2.2 La arquitectura correcta: tres capas, una sola lista de órdenes

Todas las capas leen la MISMA lista de órdenes on chain y todas pasan por el MISMO
contrato validador de la sección 1. Nadie custodia fondos de nadie. Nadie puede
ejecutar mal. Solo cambia quién aprieta el gatillo.

**Capa 1 — Keeper base de la plataforma (la garantía absoluta).**
La plataforma corre su propio vigilante siempre encendido, redundante (dos o tres
instancias en servidores baratos, independientes entre sí, y NO atadas a Cloudflare;
puede ser un VPS, una máquina propia, lo que sea). Vigila el precio en vivo y dispara
cada orden que se vuelve ejecutable. Esto garantiza que TODA orden se dispara aunque
no venga nadie más. Es el mismo arranque que usaron GMX y Synthetix: el protocolo
corre sus propios keepers al principio. Es barato porque el trabajo duro (validar) es
on chain; el vigilante solo manda la transacción cuando `ejecutable()` da verdadero.
Esta capa, sola, ya hace funcionar todo. Las otras dos la mejoran, no la sustituyen.

**Capa 2 — Personas naturales (el "Fire and Earn", tu idea).**
Una sección nueva, gamificada, donde cualquier persona corre un trabajador ligero
(una página en su navegador, o algo descargable) que vigila las órdenes pendientes y
las dispara a cambio de recompensa, con su panel de ganancias. Aquí hay que ser
honesto en un punto para que no quede rústico: un humano no puede ganarle a un bot en
una carrera de milisegundos, ni puede firmar a mano una actualización de Pyth y una
transacción en medio segundo. Entonces el "taca taca taca" real no es dar clics a
ciegas: es correr el trabajador, y que el software prepare la transacción mientras la
persona participa y cobra. La gamificación está en el panel, las rachas, el ranking y
las ganancias, no en pelear latencia contra una granja de servidores.

Para que los humanos de verdad ganen algo y no se lo lleven todo los bots, la
recompensa usa un mecanismo de **recompensa creciente** (estilo subasta holandesa,
como UniswapX): cuando una orden se vuelve ejecutable, su recompensa empieza pequeña
y **sube en cada bloque hasta que alguien la dispara**. Los bots rapidísimos se
llevan al instante las de recompensa baja (las muy jugosas), pero hay un montón de
órdenes pequeñas que a un bot no le compensa por su coste fijo: esas suben de
recompensa hasta que a una persona sí le vale la pena. Así el sistema reparte solo:
los bots toman la cabeza, las personas toman la cola larga que los bots ignoran, y se
garantiza que toda orden acaba disparada porque la recompensa sube hasta que vale la
pena. Opcional, para blindar a los humanos: un pequeño sistema de reputación o
fianza, donde un trabajador registrado tiene una ventana corta de prioridad antes de
que se abra a todos, de modo que no sea una guerra de gas pura.

**Capa 3 — Bots públicos permissionless (descentralización al crecer).**
La función de ejecutar es abierta: cualquiera puede dispararla. Así, a medida que la
plataforma mueva volumen, los bots profesionales y las firmas de solvers entran solos
y toman carga, descentralizando el sistema y quitándole peso al keeper base. Esta es
la capa que tú ya sabías que necesita volumen. La diferencia es que aquí NO es la
dependencia: llega como bonus cuando el volumen la justifica, y mientras tanto las
capas 1 y 2 ya sostienen todo.

### 2.3 Por qué las órdenes NUNCA quedan obsoletas (el punto que más importa)

El riesgo que hay que matar: si las órdenes dependieran de que haya gente disparando,
al abrir sin trabajadores, o de madrugada, o si todos duermen a la misma hora, los
take profit, stop loss y limit quedarían muertos. Obsolescencia igual a desinterés
igual a negocio roto. Tienes toda la razón, y por eso el diseño NO cuelga de los
humanos.

La verdad técnica de base: en EVM nada se auto dispara. Un contrato no puede
ejecutarse solo entre bloques; siempre hace falta que ALGUIEN de fuera mande la
transacción. No hay forma de evitar que exista un vigilante. La única pregunta real
es quién lo corre. Y la respuesta, desde el minuto cero, es la plataforma.

**La Capa 1, el keeper propio, es la garantía, no los humanos.** Es software
corriendo 24/7 en servidores, no personas. No duerme, no tiene horario, no le importa
la zona horaria, no le importa si los trabajadores son todos cubanos o si en España
no coincide nadie. Dispara cada orden en cuanto se vuelve ejecutable, haya cero
trabajadores o mil. Las Capas 2 y 3 (personas y bots públicos) son ganancia extra que
descentraliza y le quita coste a la plataforma con el tiempo, pero si no aparece
nadie, no se rompe nada. Las órdenes funcionan igual el día del lanzamiento, a las 3
de la mañana, con el público vacío.

Para que ese keeper base sea de reloj suizo y no un punto débil:
- **Redundancia**: dos o tres instancias en infraestructura independiente (distintos
  proveedores o máquinas). Si una cae, las otras siguen. Alta disponibilidad normal.
- **Autofinanciado**: el propio keeper es también un ejecutor, así que cobra la
  recompensa de cada orden que dispara, y con eso se paga su gas. A volumen cero no
  hay órdenes que disparar, así que tampoco hay coste. El coste escala con el uso, y
  el uso genera la comisión que lo cubre. Cuadra en toda etapa.
- **Vigilancia de salud**: monitoreo con alertas y reinicio automático. Si una
  instancia se atasca, otra toma el relevo en segundos.
- **No es Cloudflare ni LINK**: es un proceso propio en un VPS o una máquina. Tu
  aversión era a Cloudflare como cron gestionado y a pagar en LINK; esto no es
  ninguna de las dos.

Para que el modelo sea honesto: sí, esto significa que la plataforma corre una pieza
de infraestructura. No existe la magia de que las órdenes se disparen sin que nada
corra en ningún lado, porque la cadena no se vigila a sí misma. Lo que sí logramos es
que esa pieza no pueda hacer trampa (el contrato valida todo), que cualquiera pueda
sustituirla (ejecución permissionless), y que con el tiempo deje de ser la única que
trabaja. GMX, Synthetix y dYdX arrancaron exactamente así: con sus propios keepers, y
descentralizando después. Los humanos y los bots públicos son la evolución, no el
cimiento.

### 2.4 Qué es ese keeper, y cuánto cuesta (y por qué NO es Cloudflare)

Aclaración importante, porque aquí había confusión. El keeper que tenemos HOY sí está
en Cloudflare (`bolita-keeper-bot...workers.dev`), y es justo el que te da problemas y
el que vamos a QUITAR. El keeper base nuevo NO es Cloudflare: es un proceso nuestro,
corriendo en un servidor nuestro (un VPS), que controlamos del todo. Cuando digo
"keeper propio de la plataforma" me refiero a eso, no a Cloudflare.

Segunda aclaración, clave: el keeper NO aloja usuarios. No es un servidor que aguante
50.000 personas. A los usuarios los sirve GitHub Pages (gratis e ilimitado) y las
operaciones las procesa la blockchain (BSC mueve millones de transacciones al día). El
keeper es una pieza diminuta: solo lee la LISTA de órdenes abiertas y, cuando una se
vuelve ejecutable, manda su transacción. Escala con el número de ÓRDENES, no de
usuarios, y revisar diez mil órdenes contra el precio en cada bloque es un bucle en
memoria que no cuesta casi nada. Aunque haya 50.000 usuarios, el keeper sigue siendo
un bot pequeño.

Qué hace, en concreto:
1. Se conecta a un RPC de BSC, a Pyth (para el precio firmado) y a un WebSocket de
   precio en vivo.
2. Carga las órdenes abiertas del contrato y escucha las nuevas por eventos.
3. En cada bloque (~0.75s) mira cuáles son ejecutables.
4. Por cada una arma la transacción (actualización de Pyth mas `ejecutar(id)`), la
   firma con una wallet caliente y la envía.
5. Corren dos o tres copias en servidores independientes. Como la ejecución es
   idempotente, si dos disparan la misma, una gana y la otra revierte sin daño; para
   no gastar gas de más, cada copia se encarga de un tramo de IDs.

El costo, para tu situación real (en Cuba, sin tarjeta, sin comprar hardware):
- **Nada de nube de pago ni de tarjeta.** Oracle, AWS y similares piden tarjeta y
  además suelen geobloquear a Cuba. Descartados, no es el camino.
- **El keeper corre en un aparato que YA tengas.** Lo mejor: un **teléfono Android
  viejo** (tuyo, de un familiar, de un amigo) con la app **Termux**, que es gratis, no
  pide tarjeta y no necesita root. Corre el bot 24/7, enchufado, gastando muy poca luz.
  Es un montaje documentado y común, hay gente alojando servidores enteros así. Si no
  hay un teléfono libre, sirve tu propia PC mientras esté encendida.
- **La luz y los apagones, el punto honesto.** Un solo aparato en una casa de Cuba no
  da 100% de tiempo activo por los cortes de luz e internet. La solución NO es dinero,
  es REPARTIR: tú mas una o dos personas de confianza (en barrios distintos, o familia
  o amigos fuera de Cuba) corren el mismo keeper gratis, cada uno en su aparato. Cuando
  a uno se le va la luz, otro cubre. Los apagones suelen ser rotativos por zona, así que
  aparatos en sitios distintos se cubren entre sí. Y de paso, eso ya ES la red
  descentralizada que queríamos, sembrada por tu propia gente en vez de alquilada a una
  empresa gringa.
- **Datos:** el bot gasta poco ancho de banda (el precio son unos pocos MB por hora,
  las transacciones son diminutas). Mejor en wifi o Nauta de casa para no gastar datos
  del móvil.
- **Lo único que es dinero de verdad, el gas en BNB:** una carga pequeña una sola vez
  (lo que puedas, aunque sean 5 USD para empezar), a 0.012 USD por disparo, reembolsada
  por la comisión de cada orden. No es suscripción, es un saldo que se repone solo.

Honestidad sobre el tiempo activo: la garantía de que NUNCA se dispara en un precio
equivocado es absoluta y no depende de quién corra el keeper, eso lo blinda el
contrato. Lo que sí depende de cuántos aparatos estén encendidos es la RAPIDEZ con que
se dispara. Con un solo teléfono, en un apagón largo con todo caído, una orden podría
dispararse más tarde (al volver la luz, si el precio sigue cumpliendo) o no dispararse
si el precio ya se fue. Con dos o tres personas en sitios distintos ese hueco se vuelve
mínimo. Es el único precio de no pagar infraestructura, y se paga con comunidad, no con
dinero. Encaja con el espíritu del proyecto: gente, no servidores alquilados.

---

## 3. La recompensa sostenible sin que le afecte al operador

Dijiste que la comisión del que dispara no puede afectar al operador. Correcto.
Alguien tiene que pagar al trabajador, así que la pregunta es de dónde sale sin
tocar la posición ni el PnL del que puso la orden. Opciones, con su realidad:

- **Fuente principal: la comisión de trading que ya se cobra.** Todo exchange cobra
  una comisión taker al ejecutar (Binance ronda 0.04 por ciento). Una parte de esa
  comisión, que el operador paga de todas formas como en cualquier lado, financia la
  recompensa del trabajador. El operador no pierde nada extra sobre su posición: paga
  la comisión normal del mercado, y de ahí se paga a quien disparó. Limpio y estándar.
- **Alternativa o complemento: un depósito fijo de ejecución (tanque de gas).** Igual
  que el bot ya pide hoy un saldo de gas, el operador pre carga unos centavos fijos,
  conocidos de antemano, para el gas y la propina del disparo. No es un recorte
  sorpresa de su ganancia, es un coste de servicio que acepta al poner la orden. Es lo
  más parecido a lo que ya existe en el repo.
- **En aperturas limit, el diferencial del swap.** La mejora de precio al rutear por
  el DEX puede cubrir parte de la propina.

Recomendación: principal la comisión del protocolo, con la recompensa creciente
topada por arriba para que nunca pase de un límite pequeño. Así es sostenible incluso
a bajo volumen (porque la recompensa sube hasta donde haga falta para que alguien
dispare, pero con tope), y nunca le pesa al operador más que la comisión normal.

Nota importante: el contrato `OrdenesLimite.sol` que ya existe cobra la propina DEL
MARGEN del operador. Eso es justo lo que tú NO quieres. En la versión de spot hay que
cambiar ese origen de fondos por la comisión del protocolo o el tanque de gas. Lo
dejo señalado para cuando toque.

---

## 4. Casos límite que hay que cerrar (para que sea de verdad quirúrgico)

- **Front running del propio operador.** Separar la orden en dos tiempos: crear y
  ejecutar. El precio de ejecución se fija en el bloque del que dispara, DESPUÉS de
  que la orden existe, nunca al antojo del operador. Es el modelo de GMX y evita que
  alguien se auto ejecute con un precio viejo favorable.
- **Doble disparo.** La orden se marca inactiva antes de cualquier llamada externa
  (idempotencia). Dos trabajadores que disparen la misma: uno gana, al otro le
  revierte sin daño. Ya resuelto así en `OrdenesLimite.sol`.
- **Mercado rápido / mecha.** La banda de slippage y la revalidación por bloque evitan
  llenados en un pico. Si no cabe, no se ejecuta y se reintenta al bloque siguiente.
- **Manipulación del oráculo.** Cruce base contra Pyth con umbral de desvío, más el
  circuit breaker anti gap. Ya en `OracleGuard.sol`.
- **Censura / liveness.** Como la ejecución es permissionless y además corre el keeper
  base de la plataforma, ninguna parte puede impedir que una orden válida se dispare.

---

## 5. Qué ya existe en el repo y qué faltaría (sin diseñar el contrato aún)

Ya hecho y probado, reutilizable como cimiento:
- Oráculo endurecido con Pyth y freno anti gap: `contracts/Futuros/OracleGuard.sol`.
- Patrón de orden con precio objetivo, ejecución pública, validación on chain,
  idempotencia y propina: `contracts/Futuros/OrdenesLimite.sol` (para futuros).
- Un keeper ya operativo (hoy en Cloudflare, `bolita-keeper-bot`), que sirve de
  referencia de la Capa 1, pero que hay que sacar de Cloudflare a infraestructura
  propia redundante.
- La lógica de disparo por nivel con anti gap, ya escrita en cliente, en
  `modules/trading-demo/motor.js` (`onPrecio`): es simulación local, pero es el modelo
  exacto de UX de "cuando la mecha toca el nivel, dispara".

Lo que faltaría construir (más adelante, cuando aprobemos el modelo):
- La capa de spot del disparador (equivalente a `OrdenesLimite` pero abriendo o
  cerrando posición spot vía el swap, con la propina pagada por el protocolo, no por
  el operador).
- La recompensa creciente y el registro de trabajadores.
- El keeper base propio, redundante y fuera de Cloudflare.
- La sección "Fire and Earn" con interfaz avanzada e intuitiva.

> Como pediste, aquí NO diseño el `.sol`. Esto es la resolución del mecanismo. El
> contrato se piensa después, y solo si apruebas este modelo.

---

## 6. Decisiones que necesito de ti para la siguiente etapa

1. ~~Fuente de la recompensa~~ → **decidido: comisión del protocolo con tope.**
2. ~~Alcance~~ → **decidido: solo análisis (spot) para empezar.**
3. **La Capa 2 humana**: la activamos desde el inicio junto al keeper base, o primero
   dejamos el keeper base sólido y añadimos el "Fire and Earn" después. (Mi
   recomendación: keeper base primero, humanos después, porque el keeper base ya
   garantiza que todo funcione y así no bloqueamos el lanzamiento esperando a la capa
   humana.)
4. **Keeper base fuera de Cloudflare**: dónde lo corremos (VPS propio, varias
   máquinas independientes). Esto es operación, no código, y conviene decidirlo
   pronto porque es la pieza que garantiza que nada quede obsoleto.

Dime y paso a la etapa de diseño detallado del mecanismo, todavía sin contrato, con
diagramas de flujo y la economía de la recompensa al detalle.

---

## Fuentes

- Pyth, modelo pull y precio firmado on demand: [docs.pyth.network](https://docs.pyth.network/price-feeds/how-pyth-works/cross-chain)
- GMX, ejecución en dos pasos con keepers y oráculo (protección MEV): [Cyfrin Updraft, how GMX works](https://updraft.cyfrin.io/courses/gmx-perpetuals-trading/foundation/how-gmx-works)
- Intents y solvers (UniswapX subasta holandesa, CoW batch, Across relayers): [crypto.news](https://crypto.news/what-are-intents-and-solvers-the-invisible-layer-executing-your-defi-trades/)
- Modelos de keeper con incentivo (Synthetix perps, Drift DLOB): [docs.synthetix.io](https://docs.synthetix.io/user-docs/v2-user-docs/integrations/perps-integration-guide/perps-keeper), [docs.drift.trade](https://docs-v2.drift.trade/about-v3/keepers/keepers-and-dlob-faq)
- BSC bloques sub segundo (Maxwell 0.75s, Fermi 0.45s): [bnbchain.org Maxwell](https://www.bnbchain.org/en/blog/bnb-chain-announces-maxwell-hardfork-bsc-moves-to-0-75-second-block-times), [bnbchain.org Fermi](https://www.bnbchain.org/en/blog/fermi-hard-fork-accelerates-bsc-to-0-45-second-block-times)
