-- ============================================================
-- LIMPIEZA DE ITEMS DE PRESUPUESTO DUPLICADOS
-- ============================================================
-- Contexto: por un bug en "Copiar mes anterior" (que añadía los items
-- del mes anterior sin verificar si el mes ya tenía datos), se crearon
-- filas duplicadas en budget_items (mismo template/categoría/nombre/monto).
--
-- Ejecutar en el SQL Editor de Supabase. Hacer primero el PASO 1
-- (solo lectura) para revisar cuántos duplicados hay ANTES de borrar.
-- ============================================================

-- ------------------------------------------------------------
-- PASO 1 — PREVISUALIZAR: contar duplicados por grupo
-- (no borra nada). Cada fila muestra un grupo de items idénticos
-- y cuántas copias tiene. "copias" = total; se conservará 1.
-- ------------------------------------------------------------
SELECT
    template_id,
    category_id,
    name,
    budgeted_amount,
    classification_id,
    control_id,
    COUNT(*) AS copias,
    COUNT(*) - 1 AS copias_a_borrar
FROM budget_items
WHERE is_active = true
GROUP BY template_id, category_id, name, budgeted_amount, classification_id, control_id
HAVING COUNT(*) > 1
ORDER BY copias DESC;

-- ------------------------------------------------------------
-- PASO 2 — BORRAR duplicados conservando la copia más antigua
-- de cada grupo (la primera por created_at, luego por id).
--
-- ⚠️ ACCIÓN DESTRUCTIVA. Recomendado: hacer un backup/export de
-- budget_items antes de ejecutar. Revisa el resultado del PASO 1.
--
-- Descomenta el bloque para ejecutarlo.
-- ------------------------------------------------------------
-- WITH ranked AS (
--     SELECT
--         id,
--         ROW_NUMBER() OVER (
--             PARTITION BY template_id, category_id, name,
--                          budgeted_amount, classification_id, control_id
--             ORDER BY created_at ASC, id ASC
--         ) AS rn
--     FROM budget_items
--     WHERE is_active = true
-- )
-- DELETE FROM budget_items
-- WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ------------------------------------------------------------
-- Alternativa NO destructiva (soft-delete): en lugar de borrar,
-- marca los duplicados como inactivos (is_active = false) para que
-- dejen de aparecer pero queden en la base por si hace falta revertir.
-- ------------------------------------------------------------
-- WITH ranked AS (
--     SELECT
--         id,
--         ROW_NUMBER() OVER (
--             PARTITION BY template_id, category_id, name,
--                          budgeted_amount, classification_id, control_id
--             ORDER BY created_at ASC, id ASC
--         ) AS rn
--     FROM budget_items
--     WHERE is_active = true
-- )
-- UPDATE budget_items
-- SET is_active = false, updated_at = NOW()
-- WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
