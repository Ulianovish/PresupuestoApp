-- Kit inicial y columnas de onboarding (S09).
-- Contratos: docs/agile/contracts.md §1.2, §1.3 y enmiendas v2 §5.1. Decisión: ADR-001.
--
-- 1. profiles gana onboarding_completed_at / onboarding_dismissed_at. Los
--    usuarios que ya existen quedan con ambas en now(): no ven la bienvenida ni
--    la checklist. El backfill solo corre la vez que se crean las columnas, así
--    que re-ejecutar la migración no marca como "ya hizo onboarding" a nadie
--    que se haya registrado después.
-- 2. _seed_starter_kit(p_user_id, p_month_year): interna, idempotente (si el
--    usuario ya tiene alguna categoría ACTIVA no hace nada y devuelve false;
--    quien las desactivó todas puede recargar el kit). Antes de insertar nada
--    verifica que el estado Activo y los 12 pares clasificación/control
--    resuelvan por nombre. Inserta (o reactiva) 6 categorías, la cuenta
--    Efectivo, la plantilla del mes y los rubros que falten (NOT EXISTS por
--    plantilla + categoría + lower(nombre)) en la misma transacción. NO usa
--    upsert_monthly_budget: su guard exige auth.uid() = p_user_id y dentro del
--    trigger de signup auth.uid() es NULL. Sin EXECUTE para nadie salvo el
--    dueño (postgres).
-- 3. ensure_starter_kit(): pública para authenticated, sin parámetro de
--    usuario (no se puede apuntar a otro). La llaman /bienvenida y el
--    dashboard para reparar a quien el trigger le falló.
-- 4. handle_new_user(): mismo insert de profiles y DESPUÉS la siembra dentro de
--    BEGIN … EXCEPTION WHEN OTHERS → WARNING: un error del kit nunca bloquea
--    el registro.
--
-- OJO: accounts, budget_templates y budget_items tienen FK user_id → profiles(id).
-- La siembra necesita que el perfil exista (en el trigger se inserta justo antes);
-- sin perfil falla con 23503 (ensureStarterKitAction lo devuelve como error, §5.2).


-- ============================================================================
-- 1. profiles: columnas de onboarding + backfill de usuarios existentes
-- ============================================================================
DO $migracion$
DECLARE
    v_columnas_nuevas boolean;
BEGIN
    v_columnas_nuevas := NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'onboarding_completed_at'
    );

    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
      ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz;

    IF v_columnas_nuevas THEN
        UPDATE public.profiles
           SET onboarding_completed_at = now(),
               onboarding_dismissed_at = now();
    END IF;
END
$migracion$;
