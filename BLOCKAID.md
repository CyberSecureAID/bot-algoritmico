# Procedimiento de apelación ante Blockaid (falso positivo)

> **Qué es esto.** Blockaid es el motor que usa MetaMask (entre otras wallets) para
> marcar sitios como maliciosos. Marcó nuestro dominio por error. Este documento
> guarda todo lo necesario para apelar, y sirve de plantilla si vuelve a ocurrir
> con el dominio definitivo.

---

## 1. Datos del proyecto (para rellenar cualquier formulario)

| Dato | Valor |
|---|---|
| Dominio actual (provisional) | criptocubaoficial.com |
| Registrador del dominio | Hostinger |
| Operador | Jesús — alias `@JesusDevTrader` |
| Correo de contacto | yamicelanvivesqui@gmail.com |
| GitHub (código público) | https://github.com/CyberSecureAID/bot-algoritmico |
| Wallet de desarrollo marcada | `0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d` |
| Red | BNB Smart Chain (chainId 56) |
| Equipo | 2 personas, no anónimas |
| Estado | En desarrollo, sin apertura al público |

**Perfiles públicos del operador** (demuestran identidad real):
- Telegram: https://t.me/JesusDevTrader
- X: https://x.com/JesusDevTrader
- Instagram: https://www.instagram.com/JesusDevTrader
- LinkedIn: https://www.linkedin.com/in/jesusdevtrader
- YouTube: https://www.youtube.com/@JesusDevTrader

**Tickets abiertos:** #1440814 · referencia 91XN4Z-64DX3

---

## 2. La evidencia técnica que gana el caso

Blockaid busca señales de sitios que roban fondos. Estas son las pruebas de que
nuestro sitio no hace nada de eso, y **todas son verificables por terceros**.

### 2.1 Métodos que el sitio pide a la wallet (inventario completo)

Estos son los únicos, no hay más:

| Método | Cuándo | Qué hace |
|---|---|---|
| `eth_requestAccounts` | Solo al pulsar "Connect wallet" | Pide autorización de cuenta |
| `eth_accounts` | Al cargar | Lee cuentas ya autorizadas (silencioso) |
| `eth_chainId` | Al cargar | Lee la red actual |
| `wallet_switchEthereumChain` | Tras conectar | Cambia a BNB Smart Chain |
| `wallet_addEthereumChain` | Si falta la red | Añade BNB Smart Chain |
| `wallet_revokePermissions` | Al desconectar | Revoca permisos (lo pide el usuario) |

### 2.2 Lo que el sitio NO hace (el argumento más fuerte)

- **No usa `eth_sign`**, `personal_sign` ni `eth_signTypedData`. Son los métodos
  asociados a las estafas de firma ciega. No existen en el código. Verificable
  buscando en el repositorio público.
- **No pide frase semilla, frase de recuperación ni clave privada.** No existe
  ningún campo de ese tipo en la aplicación.
- **No solicita ninguna transacción al cargar.** La página se abre y no aparece
  ningún aviso de la wallet.
- **No carga scripts de publicidad, rastreo ni analítica de terceros.**

### 2.3 Contratos desplegados (proxy, verificados en BscScan)

Ninguno contiene una función capaz de retirar fondos de la wallet de un usuario.
Es comprobable leyendo el código verificado de cada uno.

```
0x7FdE85E0bD53208F380980cfE317A9D4982434Ab   Contabilidad
0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3   Oráculo de precios
0x068729CBB708713266FFdE2374e51db2B063FD7C   Tarifas
0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4   Staking
0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B   Bots
0x39c48394068299Aa3e3ab114F16bfc3DE11F4112   Listado de tokens
0x17B47a8Fb97F8980b96c94E4b9137182e0Bf8025   Mercado P2P
0xC01B61B702011747B4c0Ee6B5F2d0F2b4B66880c   Perfiles P2P
0x24E34b95dBd7786b0d11E00e7FA256A8763B6D05   Wallet Shield
0x71763E9Ad60d3D2Baa833496F8b4f8eeD497B65F   Gas Faucet
```

> Nota: son direcciones de **proxy**, y eso es correcto. BscScan los verifica como
> `ERC1967Proxy.sol` y muestra la implementación detrás. No hay que cambiar nada.

### 2.4 Código fuente

No hay compilación ni empaquetado. El sitio se sirve como módulos ES directamente
desde el repositorio, así que **el código desplegado es idéntico al público**.
Cualquiera puede comparar un archivo servido con el del repositorio.

### 2.5 Por qué creemos que se disparó el falso positivo

- Dominio nuevo, sin historial de reputación.
- La wallet de desarrollo recibió varios pagos pequeños de prueba en poco tiempo
  (todos desde wallets propias, durante pruebas).
- El sitio usa vocabulario de trading (bots, swap, futuros).

Ninguna de esas señales implica comportamiento malicioso, pero un sistema
automático puede leerlas como riesgo.

---

## 3. Procedimiento paso a paso

### Paso 1 — Reunir las capturas

Necesitamos **dos** capturas de pantalla:

**Captura A.** El sitio recién abierto en el navegador de la wallet, **sin que haya
salido ninguna ventana pidiendo nada**. Debe verse la página cargada y ninguna
ventana de MetaMask encima. Esto prueba que al entrar no pedimos firmas.

**Captura B.** El momento en que se pulsa "Connect wallet" y aparece la ventana
estándar de la wallet pidiendo conectar la cuenta. Esto prueba que lo único que
pedimos es la conexión normal.

### Paso 2 — Enviar la respuesta

Responder al hilo del ticket con el texto de la sección 4 de este documento,
adjuntando las dos capturas.

### Paso 3 — Verificación del dominio (cuando la pidan)

Blockaid puede pedir una prueba de propiedad mediante un registro DNS.

1. Entrar a **Hostinger** → panel del dominio → **Zona DNS**.
2. Añadir un registro nuevo de tipo **TXT**.
3. En "Nombre" poner `@` (o lo que indiquen ellos).
4. En "Valor" pegar el token exacto que envíen.
5. Guardar y esperar unos minutos.
6. Responder al ticket avisando de que el registro ya está publicado.

### Paso 4 — Seguimiento

Si en 72 horas no hay respuesta, responder al mismo ticket pidiendo actualización.
No abrir tickets nuevos: los fusionan y se pierde el hilo.

---

## 4. Texto a enviar (en inglés, copiar tal cual)

> Ver el archivo `BLOCKAID-MENSAJE.md` en esta misma carpeta.

---

## 5. Si vuelve a pasar con el dominio definitivo

1. Actualizar en este documento el dominio nuevo y su registrador.
2. Repetir los pasos 1 a 4.
3. Añadir un argumento que ahora no tenemos: **historial**. Un dominio con meses
   de actividad y usuarios reales se marca mucho menos.

**Recomendación para el lanzamiento:** antes de abrir al público con el dominio
definitivo, solicitar a Blockaid una **verificación proactiva** (no reactiva).
Es distinto: se pide que revisen el sitio antes de que su sistema lo marque.

---

## 6. Qué NO hacer

- No enviar documentación legal ni licencias. No las necesitamos y pedirlas es
  parte de su formulario genérico. Somos una aplicación descentralizada de código
  abierto en desarrollo.
- No abrir tickets nuevos por el mismo asunto.
- No discutir su criterio. Aportar evidencia y dejar que decidan.

---

*Última actualización: septiembre de 2026.*
