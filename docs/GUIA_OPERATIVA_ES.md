# Guía operativa de CofferHouse Scout

Esta guía explica qué pretende comunicar cada apartado de Scout, cómo puede ayudar a investigar un mercado, qué indicadores utiliza, qué puede modificar el usuario y cuáles son sus límites. Está escrita para personas que no necesitan dominar DeFi para comenzar a formular mejores preguntas.

Scout es una herramienta experimental de investigación. **No recomienda invertir, prestar ni pedir prestado.** Sus estados `PASS`, `REVIEW` y `REJECT` describen el resultado de una política técnica visible; no predicen rentabilidad ni garantizan seguridad.

## Agent Hub

El Hub muestra el sistema completo y distingue capacidades reales de planes futuros. `LIVE` significa que el agente funciona en la aplicación; `NEXT BUILD` identifica el siguiente desarrollo; `PLANNED` y `FUTURE · GATED` no contienen botones de acción falsos.

- **Scout:** observa y explica riesgo.
- **Opportunity:** compara y selecciona oportunidades justificadas.
- **Strategy Lab:** convierte candidatos elegibles en propuestas acotadas de asignación.
- **Action Center:** separa la investigación de una posible acción mediante una sola aprobación informada.
- **Guardian:** vigila una intención aprobada y detecta deterioros sin fingir que existe una posición financiada.
- **Automation Sandbox:** comprueba listas permitidas, topes, vencimiento, pausa y revocación como simulación; nunca instala permisos ni mueve fondos.
- **Guardian:** vigilará estrategias o posiciones registradas.
- **Automation:** administrará permisos revocables y límites de ejecución.

La meta de la suite es que cada agente entregue evidencia estructurada al siguiente. La automatización real con fondos permanecerá bloqueada hasta contar con arquitectura de wallet, contratos revisados y autorización explícita.

## Opportunity Agent

Opportunity recibe todos los resultados de Scout y aplica límites de investigación definidos por el usuario. Su finalidad es reducir una lista de mercados a candidatos explicables; `ELIGIBLE FOR RESEARCH` no significa “recomendado para invertir”.

### Parámetros modificables

- **Capital to research:** capital que el usuario quiere analizar. No consulta ni reserva saldo real.
- **Min Supply APY:** tasa observada mínima requerida para considerar el mercado.
- **Min Liquidity:** liquidez disponible mínima.
- **Max Utilization:** utilización máxima aceptada para continuar investigando.
- **Max Liquidity Impact:** porcentaje máximo de la liquidez observada que puede representar el monto analizado.

Las preferencias se guardan sólo en ese navegador. `RESET` recupera los valores predeterminados.

### Elegibilidad

Un mercado queda bloqueado cuando:

- Scout lo clasifica como `REJECT`;
- falta liquidez, utilización o Supply APY;
- su liquidez está por debajo del mínimo;
- su utilización supera el máximo;
- su Supply APY está por debajo del mínimo.

Un mercado `REVIEW` puede aparecer como candidato de investigación porque el agente conserva todas sus advertencias y todavía no propone ejecutar.

### Tamaño máximo de investigación

Se calcula como el menor valor entre el capital indicado y el porcentaje máximo permitido de la liquidez observada. Es un límite comparativo, no una recomendación de posición.

### Research Score

- 65% resultado de la política Scout;
- 15% profundidad de liquidez;
- 10% margen de utilización;
- 10% relevancia del Supply APY observado.

La puntuación ordena candidatos. No representa seguridad, probabilidad de ganancia ni rendimiento futuro, y nunca elimina un bloqueo.

### Opportunity Receipt

Registra política, preferencias, candidatos, bloqueos, advertencias, montos máximos y huella SHA-256. Puede verificarse con `VERIFY RECEIPT FILE`.

## Strategy Lab

Strategy Lab recibe exclusivamente candidatos que Opportunity marcó como elegibles para investigación. Su propósito es mostrar cómo podría distribuirse un capital hipotético bajo límites explícitos; no recomienda una cartera ni consulta, bloquea o mueve fondos reales.

### Parámetros modificables

- **Capital:** monto total que se desea modelar.
- **Reserve:** porcentaje que permanece fuera de las posiciones propuestas.
- **Max Markets:** número máximo de mercados que puede incluir la propuesta.
- **Max per Market:** concentración máxima del capital total en un solo mercado.
- **Min Research Score:** puntuación mínima de Opportunity para considerar un candidato.

### Método de asignación

El agente retira primero la reserva, selecciona los candidatos mejor clasificados y distribuye el capital desplegable según su `Research Score`. Cada asignación respeta tanto el límite de concentración como el tamaño máximo calculado por Opportunity. Si los límites impiden distribuir todo, el excedente aparece como `UNALLOCATED`; no se fuerza dentro de un mercado.

### Indicadores

- **Proposed Allocation:** suma de los montos hipotéticos asignados.
- **Reserve:** capital separado intencionalmente.
- **Observed Weighted APY:** promedio ponderado de las tasas observadas de las posiciones propuestas.
- **Annualized at Observed Rate:** cálculo aritmético suponiendo que la tasa actual permaneciera igual durante un año.
- **Review / Exit Conditions:** cambios que obligarían a revisar la investigación, como mayor utilización, menor liquidez, evidencia ausente o un resultado `REJECT` de Scout.

El rendimiento anualizado no es una predicción ni garantía. Strategy no modela todavía fluctuación futura de tasas, pérdidas, impuestos, gas, liquidaciones ni riesgo contractual adicional.

### Strategy Receipt

Registra entradas, límites, asignaciones, exclusiones, condiciones de revisión y huella SHA-256. Sirve para demostrar exactamente qué propuesta produjo el agente con esa evidencia.

### Próxima ampliación: pools DEX

Los ocho mercados actuales proceden del adaptador de lending de Morpho; no representan toda la liquidez de Arc. La siguiente capa incorporará pools de Uniswap y contratos elegidos por el usuario con métricas propias de swaps y LP: TVL, volumen, comisiones, impacto, slippage, concentración, volatilidad y pérdida impermanente. Los activos especulativos podrán incluirse conscientemente, pero la elección del usuario no borrará las advertencias.

## Lectura rápida de los estados

| Estado | Qué significa | Qué no significa |
|---|---|---|
| `PASS` | El mercado superó todos los controles activos con los datos disponibles. | No significa “sin riesgo”, auditado ni recomendado. |
| `REVIEW` | Falta información, una condición merece análisis humano o existe una dependencia no verificada. | No significa aprobación provisional. |
| `REJECT` | Se activó por lo menos un límite duro de la política. Scout no permitiría avanzar bajo ese perfil. | No demuestra fraude ni asegura que el mercado vaya a fallar. |

El estado tiene prioridad sobre la puntuación: cualquier control `REJECT` produce un resultado global `REJECT`; si no existe rechazo pero hay algún control `REVIEW`, el resultado global es `REVIEW`.

## 1. Barra superior

### `ARC MAINNET · READ ONLY`

**Objetivo:** indicar la red que Scout pretende observar y recordar que la aplicación no puede ejecutar operaciones.

**Ayuda para decidir:** evita confundir datos de otra cadena o interpretar la interfaz como una cartera conectada.

**Qué puede modificar el usuario:** nada desde la interfaz. La red compatible forma parte de la política y del adaptador.

**Importante:** “read only” significa que Scout no tiene custodia, firma, wallet, calldata ni permisos para enviar transacciones.

## 2. Portada y estado de los datos

### `LIVE ARC DATA`, `CONNECTING` o `SAFE FALLBACK`

**Objetivo:** comunicar si los mercados visibles llegaron del proveedor en vivo o de observaciones demostrativas.

- `LIVE ARC DATA`: Morpho devolvió mercados listados de Arc.
- `CONNECTING`: la solicitud sigue en curso.
- `SAFE FALLBACK`: el proveedor falló o no devolvió mercados; se muestran ejemplos claramente etiquetados.

**Ayuda para decidir:** antes de interpretar cifras, el usuario debe comprobar si son observaciones en vivo.

**Qué puede modificar:** nada directamente. `RUN NEW SCAN` solicita otra observación.

**Límite:** que un dato sea “live” no garantiza que sea correcto, completo o suficientemente reciente para ejecutar una operación.

## 3. Panel `SCOUT EVERY MARKET`

Este panel resume el trabajo del agente sobre todos los mercados cargados.

### `DOWNLOAD RECEIPT`

Descarga un JSON que contiene la política, las observaciones, el resultado de cada mercado y una huella SHA-256.

**Para qué sirve:** conservar evidencia reproducible de lo que Scout observó y decidió en ese momento.

**No demuestra:** que el proveedor original decía la verdad, que el mercado fue aprobado o que el archivo fue publicado onchain.

### `VERIFY RECEIPT FILE`

Permite volver a cargar un recibo Scout o de simulación.

- `AUTHENTIC CONTENT`: el contenido coincide con su huella SHA-256.
- `VERIFICATION FAILED`: el archivo no tiene un esquema reconocido, no es JSON válido o fue modificado.

**Ejemplo:** cambiar manualmente la liquidez o la puntuación invalida la verificación.

**Límite:** integridad no es identidad. Una huella válida prueba que el archivo no cambió después de sellarse; no prueba quién lo publicó, salvo que en el futuro el hash sea anclado y atribuido onchain.

### `RUN NEW SCAN`

Solicita datos recientes, vuelve a evaluar todos los mercados y compara la nueva observación con la anterior.

**Cuándo usarlo:** cuando se quiera revisar cambios recientes, probar el monitor o actualizar cifras antes de analizar una simulación.

## 4. `ACTIVE POLICY PROFILE`

**Objetivo:** definir los límites de riesgo usados para evaluar exactamente los mismos datos.

El usuario puede elegir uno de tres perfiles. Cambiar el perfil no cambia el mercado: cambia el grado de tolerancia con el que se analiza.

| Parámetro | Capital Preservation | Balanced | Yield Discovery |
|---|---:|---:|---:|
| Liquidez preferida mínima | $10,000,000 | $5,000,000 | $2,000,000 |
| Rechazo por liquidez inferior a | $2,000,000 | $1,000,000 | $500,000 |
| Utilización preferida máxima | 70% | 80% | 85% |
| Rechazo por utilización desde | 85% | 90% | 95% |
| Edad máxima preferida | 10 min | 15 min | 30 min |
| Fuentes de precio requeridas | 2 | 2 | 1 |
| Volatilidad máxima de referencia | 35% | 55% | 75% |
| Integridad mínima requerida | 95% | 90% | 85% |

### ¿Por qué modificar el perfil?

- **Capital Preservation:** para investigación conservadora donde se prefieren mercados profundos y márgenes amplios.
- **Balanced:** punto de partida general; no es una recomendación universal.
- **Yield Discovery:** permite explorar mercados más pequeños o utilizados, pero no elimina la revisión humana ni la verificación contractual.

**Regla importante:** un perfil más tolerante puede elevar la puntuación o evitar un rechazo cuantitativo, pero no convierte información faltante en información verificada.

## 5. Resumen `MARKETS / PASS / REVIEW / REJECT`

**Objetivo:** mostrar la distribución de resultados del escaneo completo.

- `MARKETS`: número de mercados evaluados.
- `PASS`: superan los ocho controles activos.
- `REVIEW`: requieren análisis humano.
- `REJECT`: activaron por lo menos un límite duro.

**Uso para el inversor:** permite detectar rápidamente si el universo observado está dentro o fuera del perfil elegido.

**Límite:** no debe elegirse un mercado únicamente porque aparece en la columna con mejor resultado.

## 6. `AGENT MODE · SESSION RUNTIME`

**Objetivo:** ejecutar automáticamente nuevos ciclos mientras la pestaña permanezca abierta.

### Indicadores

- `CURRENT PHASE`: etapa actual del agente.
- `CYCLES`: número de ciclos completados en esa sesión.
- `LAST`: hora de la última ejecución.
- `NEXT RUN`: hora prevista para la siguiente.
- `FREQUENCY`: cada 1, 5 o 15 minutos.

### Controles modificables

- `START AGENT` / `STOP AGENT`.
- Frecuencia de 1, 5 o 15 minutos.

### ¿Por qué cambiar la frecuencia?

- 1 minuto: demostraciones o vigilancia muy activa; genera más solicitudes y ruido.
- 5 minutos: equilibrio para una sesión de observación.
- 15 minutos: investigación menos urgente y menor consumo de solicitudes.

**Límite:** cerrar, recargar o suspender la pestaña puede detener este agente. Para operación sin navegador existe el runtime del servidor.

## 7. `SERVER AGENT · 24/7 CORE`

**Objetivo:** mostrar si existe un agente desplegado que pueda trabajar sin mantener abierta la página.

### Estados principales

- `DEPLOYMENT SETUP REQUIRED`: faltan credenciales o servicios externos.
- `READY FOR FIRST SCHEDULED RUN`: la memoria está configurada, pero todavía no existe un ciclo guardado.
- `DURABLE AGENT ONLINE`: existe un ciclo persistido correctamente.
- `AGENT DEGRADED · SOURCE FAILURE`: la última ejecución falló y se guardó el diagnóstico.

### Indicadores

- `LAST SERVER RUN`: hora del último ciclo.
- `LAST DECISION`: `NO_ACTION`, `WATCH`, `REVIEW` o `ESCALATE`.
- `DURABLE HISTORY`: ciclos almacenados, hasta 100.
- `INDEPENDENT ARC RPC CHECK`: verificación de bytecode de activo prestado, colateral y oráculo.
- `LAST AGENT EXECUTION TRACE`: evidencia de `OBSERVE → VERIFY → EVALUATE → COMPARE → DECIDE → RECORD`.

### Capacidades del despliegue

Los indicadores `READY/OFF` informan si están configurados:

- memoria durable;
- scheduler protegido;
- alertas externas;
- análisis Gemini;
- confirmación humana;
- verificación RPC de Arc;
- anclaje de recibos en Arc.

**Qué puede modificar un usuario normal:** nada desde la página. Son controles operativos del responsable del despliegue.

**Límite de la verificación RPC:** confirma que una dirección contiene bytecode; no certifica que el contrato sea seguro, que el oráculo entregue un precio correcto ni que haya sido auditado.

## 8. Inteligencia acotada y revisión humana

Cuando Gemini está configurado, puede convertir la evidencia del ciclo en un resumen para el operador.

**Puede recomendar únicamente:** `MONITOR`, `HUMAN_REVIEW` o `PAUSE_AUTOMATION`.

**No puede:** cambiar un `PASS/REVIEW/REJECT`, inventar datos, firmar o ejecutar.

Una alerta material requiere confirmación de un operador mediante un token protegido. La confirmación registra responsable, fecha y nota; el agente no puede aprobar su propia alerta.

## 9. `SNAPSHOT MONITOR`

**Objetivo:** comparar observaciones consecutivas y destacar cambios suficientemente grandes para merecer atención.

### Cambios detectados

- mercado nuevo;
- mercado que deja de aparecer;
- transición entre `PASS`, `REVIEW` y `REJECT`;
- cambio porcentual de liquidez;
- cambio en puntos porcentuales de utilización.

### `CHANGE ALERT LIMITS`

El usuario puede modificar:

- `LIQUIDITY CHANGE %`, valor predeterminado: 5%;
- `UTILIZATION POINTS`, valor predeterminado: 2 puntos.

Los valores se guardan en ese navegador.

### ¿Por qué modificarlos?

- Umbral menor: detecta movimientos pequeños, pero produce más ruido.
- Umbral mayor: muestra sólo movimientos grandes, pero puede ocultar deterioros graduales.

Ejemplo: pasar de 70% a 73% de utilización es un aumento de **3 puntos**, no un aumento de 3% relativo.

### `HISTORICAL OBSERVATIONS · THIS BROWSER`

Conserva las diez comparaciones más recientes localmente. `CLEAR` elimina ese historial del navegador, no la memoria durable del servidor.

## 10. Ranking de mercados

**Objetivo:** ordenar todos los mercados para que el usuario revise primero los resultados más favorables dentro de la política seleccionada.

Orden aplicado:

1. `PASS`, después `REVIEW`, después `REJECT`;
2. mayor puntuación;
3. mayor liquidez;
4. nombre del mercado.

Cada fila muestra nombre, Market ID abreviado, primer motivo que requiere atención y resultado.

**Qué puede modificar:** seleccionar una fila cambia el mercado mostrado; no cambia sus datos.

## 11. Selector `SELECT A MARKET`

Mercados con el mismo par de activos pueden tener diferentes parámetros, oráculos o Market IDs. Por eso Scout muestra la identidad abreviada y no supone que dos filas con el mismo nombre sean equivalentes.

**Uso correcto:** confirmar siempre el Market ID y las direcciones antes de comparar o documentar un resultado.

## 12. Veredicto y puntuación

La tarjeta muestra el estado y una puntuación sobre 100.

### Cómo se calcula

Cada uno de los ocho controles aporta:

- `PASS`: 12.5 puntos;
- `REVIEW`: 6 puntos;
- `REJECT`: 0 puntos.

La suma se redondea al entero más cercano.

### Cómo interpretarla

La puntuación permite comparar el cumplimiento de una política. **No representa una probabilidad de seguridad, solvencia o ganancia.** Un `81/100` no significa que el mercado sea “81% seguro”.

Dos mercados con la misma puntuación pueden tener advertencias completamente distintas; siempre debe revisarse el detalle de los controles.

## 13. Métricas principales

### `LIQUIDITY`

Capital disponible para ser prestado o retirado según la observación del proveedor.

- Mayor liquidez suele ofrecer más capacidad y menor sensibilidad a una operación individual.
- Baja liquidez puede limitar salidas o hacer que una operación cambie rápidamente la utilización.

### `UTILIZATION`

Proporción de los activos suministrados que ya están prestados.

- Utilización alta puede reducir la liquidez disponible.
- Utilización baja no garantiza demanda, rentabilidad ni seguridad.

### `SUPPLY APY`

Tasa anualizada observada para proveedores de liquidez.

**No es fija ni garantizada.** Puede cambiar con utilización, parámetros del mercado y condiciones externas.

### `DATA AGE`

Minutos transcurridos desde la observación según el modelo normalizado.

Una observación reciente puede estar incompleta; una observación completa puede quedar obsoleta. Frescura e integridad son controles separados.

## 14. Identidad del mercado

### `MARKET ID`

Identificador único del mercado en Morpho. Es esencial cuando existen pares repetidos.

### `LOAN ASSET`

Dirección del activo que se presta y se toma prestado.

### `COLLATERAL`

Dirección del activo entregado como garantía.

### `ORACLE`

Dirección utilizada por el mercado para determinar el valor relativo del colateral.

### `LLTV`

Loan-to-Liquidation Value: relación máxima de deuda respecto al valor del colateral antes de entrar en condiciones de liquidación según el diseño del mercado.

Un LLTV más alto permite mayor apalancamiento, pero deja menos margen frente a caídas del colateral. Scout lo muestra como dato; no lo usa actualmente como control independiente de puntuación.

### `BORROW APY`

Tasa anualizada observada para quien pide prestado. No incluye necesariamente todos los costos, incentivos ni variaciones futuras.

Los enlaces abren el explorador para continuar la investigación. La presencia de una dirección válida no equivale a auditoría.

## 15. `POLICY COMPARISON`

**Objetivo:** enseñar cómo cambia el resultado del mismo mercado bajo los tres perfiles.

La tarjeta activa corresponde al perfil aplicado al resto de la pantalla. Las otras dos son comparaciones informativas.

**Pregunta útil:** “¿Este mercado cambia de `REJECT` a `REVIEW` sólo porque toleré menos liquidez, o porque realmente resolví una advertencia?”

## 16. Simulador `PREVIEW A HYPOTHETICAL BORROW`

**Objetivo:** estimar el efecto inmediato de un préstamo hipotético sobre liquidez, utilización y política.

### Valor modificable

`USD EQUIVALENT`: monto mayor que cero y no superior a la liquidez disponible.

Scout sugiere inicialmente el menor valor entre $100,000 y 10% de la liquidez del mercado. El usuario puede reemplazarlo.

### Cálculo

- Liquidez proyectada = liquidez actual − préstamo hipotético.
- Deuda proyectada = deuda actual + préstamo hipotético.
- Utilización proyectada = deuda proyectada ÷ activos suministrados × 100.
- La política completa se vuelve a ejecutar sobre el estado proyectado.

### Resultado

Muestra antes y después de:

- liquidez disponible;
- utilización;
- estado y puntuación.

`DOWNLOAD SIMULATION` aparece solamente después de obtener una simulación válida.

### Qué no modela

- movimiento futuro del precio;
- slippage;
- tasas dinámicas después del instante simulado;
- liquidación individual de una posición;
- gas o comisiones;
- restricciones de wallet;
- transacciones reales.

No prepara, firma ni envía una operación.

## 17. Los ocho `POLICY CHECKS`

### 1. `Supported network`

Confirma que el mercado pertenece a Arc. Otra red produce rechazo.

### 2. `Available liquidity`

Compara la liquidez con los límites preferidos y de rechazo del perfil activo.

### 3. `Market utilization`

Compara la utilización con los límites preferidos y duros.

### 4. `Contract status`

- `allowlisted`: aprobado únicamente por una allowlist local explícita.
- `listed`: aparece listado por el protocolo, pero CofferHouse todavía no lo ha verificado.
- `blocked`: rechazo explícito.
- otros estados: revisión humana.

La comprobación RPC puede confirmar bytecode, pero no sustituye la aprobación de CofferHouse.

### 5. `Data freshness`

Compara la edad de la observación con el máximo del perfil.

### 6. `Independent price sources`

Compara el número de fuentes declaradas con el mínimo requerido. Actualmente, muchos mercados en vivo muestran una sola fuente y permanecen en revisión.

Cantidad no equivale a calidad: dos fuentes pueden compartir la misma dependencia o fallar de manera correlacionada.

### 7. `Collateral volatility`

Compara la volatilidad verificada con el máximo del perfil. Si no existe un feed verificado, el resultado es `REVIEW`; Scout no inventa el dato.

### 8. `Required data present`

Evalúa si los campos necesarios para el análisis básico están presentes. En el adaptador actual se consideran liquidez, utilización, supply APY y dirección del oráculo.

**Límite:** 100% de integridad significa que están presentes esos campos requeridos; no que se disponga de toda la información económica posible.

## 18. `SOURCE`, `OBSERVED` y explorador

- `SOURCE`: proveedor utilizado.
- `OBSERVED`: momento asociado con la observación.
- `Open Arc explorer`: acceso a evidencia adicional onchain.

**Buenas prácticas:** comparar la hora, Market ID y direcciones del recibo con la pantalla y el explorador.

## 19. Flujo operativo sugerido

1. Confirmar `LIVE ARC DATA`.
2. Elegir el perfil que representa el objetivo de investigación.
3. Revisar la distribución general de `PASS/REVIEW/REJECT`.
4. Elegir un mercado por Market ID, no sólo por nombre.
5. Leer el primer motivo y después los ocho controles completos.
6. Revisar liquidez, utilización, LLTV, APY, oráculo y edad del dato.
7. Comparar los tres perfiles para entender qué límite cambia el resultado.
8. Ejecutar simulaciones pequeñas, medianas y cercanas al límite que se pretende estudiar.
9. Revisar si el estado o la puntuación empeoran después de la simulación.
10. Ejecutar un nuevo escaneo y revisar cambios materiales.
11. Descargar y conservar el recibo relevante.
12. Verificar nuevamente el archivo antes de compartirlo o utilizarlo como evidencia.
13. Realizar investigación externa y revisión humana antes de cualquier decisión financiera.

## 20. Preguntas que Scout ayuda a formular

- ¿La liquidez es suficiente para el tamaño de operación que estoy considerando?
- ¿Cuánto cambiaría la utilización después de una operación hipotética?
- ¿El resultado favorable depende de usar un perfil más tolerante?
- ¿Qué información falta y por qué Scout pide revisión humana?
- ¿Existen mercados con el mismo par pero distinta identidad contractual?
- ¿La liquidez o utilización cambió materialmente desde la observación anterior?
- ¿El servidor realmente está monitoreando o sólo está lista la interfaz?
- ¿Las direcciones contienen bytecode en Arc?
- ¿El recibo que recibí conserva exactamente el contenido original?

## 21. Preguntas que Scout todavía no responde

- ¿El oráculo es económicamente resistente a manipulación?
- ¿Cuál es la concentración de proveedores y prestatarios?
- ¿Cuál es la volatilidad histórica verificada del colateral?
- ¿Qué dependencias comparten las fuentes de precio?
- ¿El contrato fue auditado y cuáles fueron los hallazgos?
- ¿Cuál será el APY futuro?
- ¿Una posición específica sería liquidada bajo diferentes escenarios de precio?
- ¿Conviene invertir?

Estas preguntas representan investigación futura y revisión especializada; no deben resolverse suponiendo datos.
