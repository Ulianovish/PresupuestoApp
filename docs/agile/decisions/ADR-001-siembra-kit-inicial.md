# ADR-001 — Siembra del kit inicial: trigger con red de seguridad + acción idempotente

Estado: aceptada (2026-09-30, orquestador).

## Contexto
Un usuario nuevo arranca con 0 categorías y 0 rubros; el clasificador, el bot y /gastos dependen de que existan. Opciones: sembrar en `handle_new_user` (trigger de signup) o en una acción de servidor al primer ingreso.

## Opciones
1. Solo trigger: garantiza el kit aunque el usuario nunca abra la web, pero un error en el trigger rompe el registro.
2. Solo acción de servidor: no puede romper el registro, pero un usuario que llegue por otro camino queda sin kit.
3. Ambas, sobre una función idempotente.

## Decisión
Opción 3. `_seed_starter_kit(p_user_id, p_month_year)` idempotente (no hace nada si el usuario ya tiene categorías). `handle_new_user` la llama dentro de `BEGIN … EXCEPTION WHEN OTHERS → WARNING`, así que nunca bloquea el registro. `ensure_starter_kit()` (sin parámetro de usuario, usa `auth.uid()`) la llama desde `/bienvenida` y el dashboard para reparar.

La siembra no usa `upsert_monthly_budget`: su guard exige `auth.uid() = p_user_id` y dentro del trigger de signup `auth.uid()` es NULL.

## Consecuencias
El kit vive en un solo lugar (SQL). Cambiarlo es una migración nueva. El usuario existente no se toca (ya tiene categorías).
