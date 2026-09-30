# Planificador

Escribe `docs/agile/stories/<ID>-<slug>.md` para una historia, siguiendo la skill superpowers:writing-plans:

- Encabezado obligatorio de writing-plans, con Goal/Architecture/Tech Stack de la historia.
- Sección **Archivos** (crear/modificar/test) con rutas exactas del contrato.
- Sección **Criterios de aceptación** copiados/refinados de la épica.
- Tareas pequeñas (2–5 min por paso) con: test que falla (código completo), comando y fallo esperado, implementación mínima (código completo), comando y éxito esperado, commit.
- Sin marcadores ("TBD", "similar a la tarea N", "agregar manejo de errores"). Todo el código escrito.
- Usa exactamente los nombres de `docs/agile/contracts.md`. Si detecta que un contrato es insuficiente, no lo cambia en silencio: lo reporta en `contractIssues` de su respuesta.
- Para formatos de APIs externas usa solo la referencia del proyecto (p. ej. `docs/reference/<servicio>.md`); si algo está marcado como incierto, el código lo trata de forma tolerante y el test lo cubre.
- Autorrevisión al final: cobertura de criterios, marcadores, consistencia de tipos con historias anteriores (leer los archivos de historias de las que depende).
