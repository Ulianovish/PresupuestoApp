# ADR-007 — Las 4 tareas de deuda de S10 no están escritas en ningún lado

Estado: aceptada (2026-09-30, deliberación por consenso). **Cumplida** en la ronda de corrección 1 de S13: la lista llegó y se implementó (ver Actualización).

> Número: ADR-006 ya existe en el flujo `feat/prueba-jev` (`ADR-006-la-categoria-correcta-es-la-del-usuario.md`); este es el siguiente libre para no chocar al integrar.

## Contexto
El orquestador anunció "4 tareas de deuda de S10" para hacer después de S13, pero la lista no está escrita en el repositorio: una búsqueda de "deuda" en `docs/agile` no encuentra nada ligado a S10. `4464d6a` cerró S10 y los commits siguientes (`dde6787` a `11e389a`) son todos de S13. `ad85751`, `8fc93c0` y `8a39af3` cerraron la deuda de S08 y son anteriores al cierre de S10, así que no pueden cubrir esta.

## Opciones
1. Pedirle al orquestador la lista literal (archivo, hallazgo y criterio) y relanzar el implementador en `stream/app` desde `11e389a`.
2. Dar la deuda por cerrada.
3. Abrir una historia de limpieza aparte para después.

## Votos
- Perfil pragmático: opción 1. Pedir la lista es lo más barato; la 2 cierra algo que nadie comprobó y la 3 agrega planificación sin resolver que falta la lista. S13 no depende de esas tareas.
- Perfil de riesgos/seguridad: opción 1. Mientras no se sepa qué son, alguna podría tocar teléfonos en fixtures o logs, el número completo en el navegador, el control de propiedad al desvincular o el webhook del bot. Nunca la 2. Si el orquestador tampoco tiene la lista, la salida es la 3, registrada como "deuda de S10 sin especificar, pendiente de recuperar".

## Decisión
Opción 1, con estas condiciones:
- (a) Cuando llegue la lista, se anota literal en las Desviaciones de `docs/agile/stories/S10-estados-vacios-y-navegacion.md` antes de tocar código.
- (b) Si alguna toca teléfonos, desvincular o el webhook, va primero y se verifica con tests sin números reales.
- (c) Mientras no llegue la lista, no se mezcla nada de esa deuda con los commits de S13.
- Si el orquestador tampoco la tiene: opción 3, con la deuda registrada como "sin especificar, pendiente de recuperar". Nunca la 2.

## Consecuencias
En el relanzamiento que aplica esta decisión la lista **no** llegó. No se implementa nada de esa deuda; queda registrada en las Desviaciones de S10 como pendiente de recuperar. No cambia ningún contrato.

## Actualización (ronda de corrección 1 de S13)
La lista llegó en las instrucciones del orquestador. Según la condición (a), se anotó literal en las Desviaciones de S10 (`4706c02`) antes de tocar código. Ninguna de las 4 tareas toca teléfonos, desvincular ni el webhook, así que la condición (b) no aplica. Se implementaron en commits propios, separados de los de S13 (condición (c)):
1. `shouldReloadAfterStarterKit` + refresco con try/catch en `/presupuesto`: `01b7c37`.
2. Spy de `console.warn` en `beforeEach` + `afterEach(vi.restoreAllMocks)` en `onboarding.test.ts`: `76d927a`.
3. `initializeMonth` fuera de `useMonthlyBudget`: `db7c496`.
4. Accesos rápidos del dashboard sin `<button>` dentro de `<a>` (`Button` acepta `href`): `8f5048d`.
La salida "sin especificar, pendiente de recuperar" queda superada.
