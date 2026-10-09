# Activación operativa del micro-agente

Esta guía empieza cuando el código ya está desplegado. No compartas secretos por chat, capturas, GitHub, archivos `.env` ni el frontend.

## Resultado esperado

Al terminar, Scout podrá ejecutar sin un navegador el ciclo:

`OBSERVE → VERIFY → INTEROP → EVALUATE → COMPARE → DECIDE → RECORD`

La autonomía se limita a investigación, memoria, alertas y evidencia. No habrá wallet del servidor, custodia, firma ni ejecución financiera.

## Cómo trabajaremos con el propietario

No es necesario ejecutar toda esta guía de una vez. El endpoint público `/api/health` incluye `ownerActivation`, que devuelve un solo siguiente paso, su comprobación y el orden correspondiente. Cada vez que el propietario termine un paso, se vuelve a revisar ese endpoint antes de continuar.

Los secretos se escriben directamente en Upstash, Vercel o GitHub. Nunca deben copiarse al chat, una captura, un issue, un commit ni una variable que comience con `VITE_`.

## Lo que debe crear el propietario

### 1. Memoria durable en Upstash

1. Crear una base Redis permanente en Upstash.
2. En la sección **Connect → REST**, copiar:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN` estándar
3. Agregar ambos valores como variables **server-side** en Vercel.
4. Abrir `https://cofferhouse-scout.vercel.app/api/health` y comprobar que `required` muestre `durable-memory` con `ready: true`. Solamente entonces continuar al paso 2.

El token estándar puede escribir y nunca debe exponerse en el navegador. Scout lo necesita para snapshots, sesiones, historial, Guardian, Interop y deduplicación de alertas.

### 2. Generar dos secretos diferentes

Generarlos con un administrador de contraseñas o localmente. Deben tener al menos 32 caracteres y no deben ser iguales:

- `CRON_SECRET`: autoriza el scheduler.
- `SCOUT_OPERATOR_TOKEN`: autoriza reconocimiento humano e inscripción de Guardian.

Agregar ambos en Vercel. No usar prefijo `VITE_`.

Después del redeploy, comprobar que `ownerActivation.id` cambió de `ADD_CRON_SECRET` a `RUN_FIRST_CYCLE`.

### 3. RPC de Arc

Crear un endpoint HTTPS dedicado para Arc mainnet con un proveedor compatible y guardarlo en Vercel como `ARC_RPC_URL`.

El RPC permite:

- verificar bytecode de contratos referenciados;
- observar ventanas acotadas de eventos CCTP V2;
- reforzar la evidencia de integración con Arc.

No se necesita llave privada ni wallet financiada para este runtime read-only.

### 4. Scheduler de GitHub

En `CofferHouse/cofferhouse-agent-suite` abrir:

**Settings → Secrets and variables → Actions → New repository secret**

Crear:

- `SCOUT_AGENT_URL` = `https://cofferhouse-scout.vercel.app`
- `CRON_SECRET` = exactamente el mismo valor guardado en Vercel

Después abrir **Actions → Scout Agent Cycle → Run workflow** para la primera ejecución manual.

### 5. Redeploy y comprobación

Después de guardar las variables en Vercel, ejecutar un redeploy y comprobar:

```bash
npm run verify:production -- https://cofferhouse-scout.vercel.app
```

La secuencia correcta es:

1. `READY_FOR_FIRST_RUN` después de configurar memoria y scheduler.
2. Ejecutar manualmente **Scout Agent Cycle**.
3. `OPERATIONAL` después de que el ciclo quede guardado.
4. Confirmar que un segundo ciclo aumenta el historial.

Cada ejecución toma un bloqueo durable atómico con vencimiento automático. Si GitHub Actions y el cron diario coinciden, el segundo intento recibe `ALREADY_RUNNING` y no duplica observaciones ni alertas. El panel puede mostrar la fase actual del ciclo.

## Opcionales posteriores

- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`: canal nativo recomendado para alertas materiales deduplicadas.
- `SCOUT_ALERT_WEBHOOK_URL`: canal webhook genérico alternativo.
- `UNISWAP_API_KEY`: cotizaciones oficiales read-only.
- `GEMINI_API_KEY`: explicación acotada; no cambia decisiones.
- `SCOUT_RECEIPT_REGISTRY_ADDRESS`: solamente después de desplegar y revisar el contrato.

Ninguno de estos opcionales debe bloquear la primera demostración del micro-agente.

## Evidencia que guardaremos para los concursos

- Respuesta de `/api/health` con estado `OPERATIONAL`.
- Resumen público de `/api/agent/status` con hora de ejecución e historial.
- Captura de **DURABLE AGENT ONLINE**.
- Un ciclo manual y otro programado.
- Recibo descargado y verificación de alteración.
- Commit exacto utilizado por Vercel.

## Solución de problemas

- `SETUP_REQUIRED`: falta Upstash o `CRON_SECRET` válido.
- `READY_FOR_FIRST_RUN`: configuración correcta, todavía no existe un ciclo almacenado.
- `DEGRADED_STALE`: el último ciclo supera el margen esperado; revisar GitHub Actions y Vercel.
- `RUNNING`: existe un ciclo protegido vigente y se muestra su fase actual.
- `DEGRADED_RECOVERABLE`: el último intento falló, pero el último ciclo exitoso se preservó y el siguiente scheduler puede reintentar.
- `DEGRADED_INTERRUPTED`: un intento quedó marcado como activo por más de tres minutos; el bloqueo expira automáticamente y permite recuperación.
- HTTP 409 `ALREADY_RUNNING`: otro scheduler ya posee el bloqueo temporal; no se ejecutó un ciclo duplicado.
- HTTP 401 en `/api/agent/run`: los valores `CRON_SECRET` de GitHub y Vercel no coinciden.
- HTTP 503: Upstash no está configurado o usa valores de ejemplo.
- Interop `UNAVAILABLE`: revisar `ARC_RPC_URL`; Scout conserva su evaluación determinista aunque esa verificación falle.
