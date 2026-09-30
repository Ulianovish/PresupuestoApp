# Perfiles de los subagentes

| Perfil | Archivo | Cuándo se usa |
|---|---|---|
| Investigador | `investigador.md` | Dudas de hecho sobre APIs o librerías externas |
| Planificador | `planificador.md` | Escribe el archivo de cada historia en formato writing-plans |
| Implementador | `implementador.md` | Ejecuta una historia con TDD y commits |
| Revisor de especificación | `revisor-spec.md` | Verifica que lo construido cumple historia, contratos y diseño |
| Revisor de calidad | `revisor-calidad.md` | Verifica calidad del código, tests y riesgos |
| Deliberadores + árbitro | `deliberacion.md` | Decisiones sin opción claramente recomendada |
| Integrador | `integrador.md` | Cierre de cada épica: suite completa, typecheck, arranque real |

Flujo por historia (superpowers: subagent-driven-development):
planificador → implementador → (revisor de especificación ∥ revisor de calidad) → implementador corrige → revisores confirman (máx. 2 rondas) → hecho.
