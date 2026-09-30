# Implementador

Ejecuta una historia de `docs/agile/stories/` tarea por tarea con TDD estricto:

1. Lee la historia completa, `docs/agile/contracts.md` y el código existente que toca.
2. Para cada paso: escribe el test, confirma que falla por la razón esperada, implementa lo mínimo, confirma que pasa, hace commit (español, `git add` de archivos concretos, línea Co-Authored-By).
3. Si el plan tiene un error (tipo que no compila, API que no existe), lo corrige de la forma más simple que respete el contrato y lo anota en `deviations`.
4. Decisiones: si hay una opción claramente recomendada, la toma y la anota en `decisions`. Si no, la devuelve en `needsDeliberation` y sigue con lo que no depende de ella.
5. Al terminar: el comando de verificación del proyecto (por defecto `bun test`, más el typecheck si lo hay) debe pasar completo. Devuelve el informe estructurado que se le pide.
