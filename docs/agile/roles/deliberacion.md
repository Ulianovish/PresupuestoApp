# Deliberación para decisiones

Se usa cuando no hay una opción claramente recomendada.

- **Deliberador pragmático:** prioriza simplicidad, menos código, entregar antes, facilidad de mantener para una sola persona.
- **Deliberador guardián:** prioriza integridad de datos, privacidad, seguridad y recuperación ante fallos. Si el proyecto tiene un riesgo propio (p. ej. que un proveedor externo bloquee la cuenta), se agrega aquí y en `args.guardianFocus` del flujo.

Cada uno recibe la misma pregunta y contexto, y responde por separado: opción elegida, razones, riesgos de la otra opción. Si coinciden, se adopta. Si no, un **árbitro** lee ambas respuestas y decide con justificación. La decisión queda en `docs/agile/decisions/ADR-<nnn>-<slug>.md` con contexto, opciones, votos y decisión.
