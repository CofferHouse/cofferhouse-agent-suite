# Estado del proyecto — 18 de octubre de 2026

Este inventario separa código existente, operación comprobada y componentes recibidos pero aún
no integrados. No es una auditoría ni una declaración de lanzamiento completo.

## Qué está registrado

| Componente | Evidencia o estado | Siguiente trabajo |
| --- | --- | --- |
| Scout y runtime de investigación | `/api/agent/status` devuelve `online`, ciclo `2026-10-18T15:00:23.079Z` (09:00 CDMX), decisión `WATCH`; `/api/health` indica `CORE_ACTIVATION_COMPLETE` | Vigilar continuidad, fallos y frescura de las fuentes |
| Opportunity, Strategy, DEX, Guardian, Automation e Interop | Módulos y pruebas presentes en Agent Suite | Validación funcional de cada flujo; no confundir investigación/sandbox con ejecución financiera |
| Holder Center | Selector de periodos y verificación de manifiestos integrados en `main` mediante PR #2 | Mantener el catálogo de periodos reales y preparar configuración de producción |
| Dependencias servidor | PR #3 integrado; auditoría anterior pasó de 9 entradas altas a 0 altas; 27 entradas bajas/moderadas siguen documentadas | Resolver compatibilidad y avisos restantes; no equivale a auditoría completa |
| Membresías, ascenso y sacrificio | Colección existente de mainnet conservada; ensayo en testnet realizado | Metadata real, COFFERS y configuración de activación; no volver a subir la colección |
| Rewards | Distribuidor de testnet publicado; generador y verificadores en `cofferhouse-contracts`, PR #1 integrado | Reconciliar evidencia del claim y preparar administración, financiación y configuración de producción |
| Bots ejecutores y scripts del propietario | Recibidos 11 paquetes y 14 muestras; inventario estático inicial terminado, sin ejecución | Sanear credenciales, deduplicar y probar por familia; ver BOT-INVENTORY-2026-10-18.md |
| Telegram | Rutas de vinculación, preferencias, desconexión y entrega presentes | Comprobar la activación real del canal; no crear otro bot sin coordinarlo |
| Alerta de MetaMask | Reporte enviado a Blockaid el 15 de octubre; recepción confirmada | Esperar/revisar clasificación; el envío no prueba retirada ni falso positivo |

## Ensayo y discrepancia de evidencia

El propietario confirma el 18 de octubre que ya completamos el ensayo y que envió
capturas. Esa confirmación se registra y no se debe volver a pedir todo el ensayo
como si no se hubiera realizado.

La consulta independiente del contrato de referencia
`0x91c838c6c2f1d63900c3cbeb980b2012b747f9f4`, en Arc Testnet (5042002), al bloque
67860300, devuelve para el periodo 1:

- wallet `0x659012c655c2af95cbb5d33671f479853a8be147`: `claimed=false`;
- presupuesto: `1000000000000000000000` unidades mínimas de TESTCOFFERS;
- `paid=0`, `totalPoints=11`, `claimedPoints=0`.

Por tanto, el ensayo se registra como realizado según el propietario, pero el
pago de ese periodo concreto no se marca como confirmado en cadena. Queda por
reconciliar la red, periodo, contrato y transacción de las capturas. No se inventa
un hash ni se vuelve a publicar o ejecutar un claim automáticamente.

## Pendientes del lanzamiento

1. Cerrar metadata/reveal y disponibilidad de los archivos de niveles, conservando
   colección, reservas aprobadas y configuración del mint.
2. Definir administradores, fuente de fees, frecuencia de reparto y hosting durable
   de manifiestos. El lanzamiento de COFFERS/launchpad se decide después del mint.
3. Limpiar y probar los bots y scripts externos recibidos; todavía no son una entrega
   terminada ni un componente operativo de este repositorio.
4. Completar validación de interfaz/wallet de los flujos de producción y revisión
   de seguridad, manteniendo visible la política de auditoría posterior elegida
   por el propietario; ninguna prueba sustituye esa revisión.
5. Ampliar oportunidades multichain en USDC primero como investigación verificable.
   Rutas, gas, liquidez y riesgo deben comprobarse antes de ejecutar capital.

Los documentos de hackatón se conservan como históricos, no como prioridad actual.
La prioridad expresada por el propietario es preparar el lanzamiento de membresías.

## Incorporación de bots y scripts

Ver [inventario inicial](BOT-INVENTORY-2026-10-18.md) y [procedimiento de incorporación](BOT-SCRIPT-INTAKE.md). No subir carpetas sin revisar ni
ejecutar un bot con permisos reales durante la inspección.
