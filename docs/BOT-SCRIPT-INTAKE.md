# Incorporar bots y scripts del propietario

## Estado

Los scripts originales se recibieron el 18 de octubre: 11 paquetes y 14 muestras Python. La revisión inicial está en [BOT-INVENTORY-2026-10-18.md](BOT-INVENTORY-2026-10-18.md). No se ejecutaron ni se incorporaron las fuentes sin sanear. Los módulos de investigación
y el sandbox de Agent Suite no prueban que un bot DDCA o ejecutor externo exista,
esté limpio o funcione. No sustituirlos por código inventado.

## Qué entregar

Un ZIP con el código fuente, archivos de dependencias y una nota breve de qué hace
cada bot. Incluir configuraciones de ejemplo vacías si existen. Excluir `.env`,
claves privadas, frases semilla, keystores, tokens API reales, bases con datos
personales, logs privados, `node_modules`, entornos virtuales y builds.
Si una credencial está incrustada en el código, sustituirla antes de compartirla.
Una credencial publicada o expuesta se revoca/rota; borrarla del archivo no basta.

## Revisión antes de ejecutar o publicar

1. Inventariar archivos, propósito, lenguaje, dependencias, licencias y procedencia.
   Leer primero el código; no ejecutar instaladores ni hooks automáticamente.
2. Revisar secretos sin reproducir sus valores en informes, logs, commits o PR.
   Sustituir configuración por variables y crear ejemplos sin datos reales.
3. Separar lógica, configuración, conectores y ejecución. Eliminar duplicados y
   archivos generados conservando las funciones y reglas del propietario.
4. Identificar permisos de wallet, contratos, redes, aprobaciones, límites de gasto,
   slippage, reintentos y comportamiento ante errores.
5. Probar en modo lectura/simulación y luego testnet. Comprobar que reintentar una
   tarea no duplique compras, órdenes, transfers o alertas.
6. Preparar README por herramienta, comandos reproducibles, dependencias fijadas,
   límites conocidos y pruebas relevantes.
7. Elegir ubicación según el inventario: Agent Suite para módulos compartidos de
   investigación; repositorio separado para ejecutores con dependencias, permisos
   o despliegue propios. No decidirlo antes de leer los scripts.
8. Abrir una rama y PR revisables. Publicar solo el código aprobado; no incluir
   fondos, accesos reales o activación de operaciones en la importación.

`.gitignore` reduce incorporaciones accidentales, pero no detecta secretos
incrustados y no elimina archivos ya versionados. Siempre revisar el diff final.
