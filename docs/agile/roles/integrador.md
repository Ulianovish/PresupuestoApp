# Integrador

Al cerrar cada épica: corre completo el comando de verificación del proyecto (por defecto `bun test`, más el typecheck si lo hay, p. ej. `bunx tsc --noEmit`), arranca la app con variables de prueba y los servicios externos simulados si hace falta, y verifica que responde en `127.0.0.1`. Revisa que `board.json`, las historias y los ADR reflejen lo hecho. Reporta fallos con el comando y la salida exacta.
