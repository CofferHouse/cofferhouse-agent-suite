# Inventario inicial de bots — 18 de octubre de 2026

## Alcance real de esta revisión

Recibidos 11 paquetes y 14 muestras Python sueltas. Las 14 muestras coinciden
exactamente con archivos de los paquetes: no son 14 proyectos adicionales.
Los archivos comprimidos contienen 6,116 entradas de archivo, gran parte de ellas
dependencias, entornos virtuales y datos generados. Se seleccionaron 165 archivos
de código/configuración/documentación propia para inventario estático, incluidos
149 Python. Los 149 pasan análisis de sintaxis con `ast.parse`, y los 7 JavaScript pasan `node --check`; eso no prueba
dependencias, rentabilidad, corrección de estrategia ni funcionamiento en vivo.

No se ejecutaron ni importaron los bots, no se instalaron sus dependencias, no se
contactaron exchanges usando credenciales y no se enviaron órdenes o firmas.
Los originales, logs, CSV privados, credenciales y fuentes sin sanear no se suben
en este PR. El inventario automático se complementó con lectura dirigida de los
ejecutores, configuración, auxiliares de credenciales y documentación; no equivale
a una auditoría línea por línea de todos los archivos.

## Familias recibidas

| Paquete | Archivos seleccionados | Qué contiene | Trabajo previo a incorporación |
| --- | ---: | --- | --- |
| Binance Bot | 2 | Pruebas de API Binance y de construcción/firma de órdenes Predict testnet | Separar diagnósticos de firma; documentar configuración y dependencias |
| Copy Trading | 1 | Evaluador de traders con consultas a Hyperliquid | Normalizar métricas, validación de datos y pruebas de evaluación; no asumir que copia operaciones |
| Trades Bot | 8 | Señales LSR, alertas Telegram, estado/journal y simuladores | Retirar configuración privada, aislar datos operativos y probar deduplicación |
| Scalping bot | 1 | Backtest EMA con ccxt/pandas/pandas_ta | Separar descarga y cálculo; modelar fees/funding y reproducibilidad |
| Scanner | 2 | Scanner de arbitraje deportivo y un bot BTC Polymarket con funciones de ejecución real | Separar scanner de ejecutor; fijar presupuestos, estado y límites |
| Predict Fun | 64 | Versiones de bots, pruebas, análisis, backtests y módulos de conexión/decisión/stop-loss | Elegir versión base tras comparar comportamiento; no asumir que el sufijo mayor es mejor |
| Predict Fun - copia | 21 | Variante modular de Predict; 16 archivos idénticos con la otra carpeta, otros distintos | Deduplicar solo coincidencias exactas y conservar diferencias hasta revisarlas |
| polybot | 45 | Bots Polymarket BTC/ETH/SOL/DOGE/BNB/XRP, diagnósticos, credenciales y backtests | Extraer motor común manteniendo diferencias de estrategia; unificar configuración y SDK |
| Polymarket_bot | 6 | Estrategia, descubrimiento, creación de credenciales y README | El README invoca `bot.py`, pero ese archivo no está en este ZIP; no está completo como paquete ejecutable |
| Hibachi Grid Bot | 5 | Grid Python y otra variante JS de RiseX, más auxiliares | Sanear credenciales, simulación por defecto y reconciliación de órdenes |
| RiseX Grid Bot | 10 | Grid JS, registro de signer, pruebas y manifiestos npm | Separar administración de signer y ejecución; sanear auxiliares y controles de órdenes |

Las 16 parejas exactas entre las carpetas Predict se detectaron por hash completo.
Las variantes BTC/ETH/SOL/etc. no se declaran equivalentes por parecerse o por nombre.

## Bloqueos de publicación y ejecución

1. **Credenciales incrustadas.** Hay literales con forma de clave privada/API y
   configuración de Telegram en auxiliares/generadores. No se reproducen valores,
   prefijos ni fragmentos aquí. Si siguen vigentes, se revocan/rotan con el proveedor
   o se reemplazan según el tipo de clave antes de reutilizarlas. No se comprobó su
   vigencia ni se usaron para autenticar. Eliminar el literal no revoca una clave.
2. **Modo real por defecto en grids.** Los grids principales de Hibachi y RiseX
   tienen `DRY_RUN` falso y configuración de apalancamiento. El inicio de RiseX
   incluye registro de signer si falta. Eso debe separarse del arranque normal;
   importar o iniciar una prueba no debe ampliar permisos ni enviar órdenes.
3. **Reconciliación de órdenes.** Ambos grids tratan una orden ausente de la lista
   abierta como ejecutada y preparan reposición. Ausencia no demuestra fill: hay
   que distinguir cancelación, rechazo, ejecución parcial y datos incompletos.
   Sus rutas de cancelación también vacían el estado local tras errores, lo que
   puede perder seguimiento de órdenes aún abiertas. Probar estos casos con mocks.
4. **Dependencias incompletas.** Solo el ZIP pequeño de Polymarket y RiseX incluyen
   manifiestos propios seleccionados. Tener una carpeta `venv` o `node_modules` no
   sustituye un manifiesto reproducible. Coexisten imports de clientes CLOB v1/v2;
   falta fijar y verificar la compatibilidad de cada familia.
5. **Supuestos de estrategia.** Hay comentarios de slippage que no coinciden con
   los números configurados (por ejemplo 500 bps está comentado como 40%, aunque
   equivale a 5%). Revisar unidades, fees, sizing, latencia y resolución del mercado;
   resultados CSV y señales simuladas no prueban fills o beneficio real.

## Orden de limpieza propuesto

1. Sanear credenciales y establecer un arranque que falle cerrado, con simulación
   por defecto y autorización explícita para cualquier ejecución.
2. Incorporar primero herramientas de lectura y backtests con entradas públicas o
   fixtures sintéticos. No publicar historiales personales de trading como fixtures.
3. Refactorizar grid Hibachi/RiseX y ejecutores Predict/Polymarket por familia,
   preservando reglas originales y probando estados de órdenes, reintentos,
   ejecución parcial, límites y parada.
4. Crear repositorio de bots/ejecución separado de Agent Suite: sus dependencias,
   permisos y despliegue tienen un ciclo distinto. Reutilizar en Agent Suite solo
   señales y resultados normalizados; no añadir claves de trading al frontend.
5. Publicar cada entrega saneada en un PR con pruebas y límites explícitos. El
   inventario inicial no habilita operaciones con dinero ni afirma auditoría.

## Relación con CofferHouse

Los scripts apuntan a varios servicios externos y no son automáticamente bots
de Arc ni funcionan todos en USDC. Cada integración necesita verificar red,
activo de liquidación, gas, permisos y fuente de datos. El runtime Scout existente
sigue siendo investigación; su estado online no significa que estos ejecutores
estén desplegados. Ningún cambio de este PR modifica la colección de membresías.
