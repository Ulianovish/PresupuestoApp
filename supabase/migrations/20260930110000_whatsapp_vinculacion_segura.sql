-- S02 — Vinculación de WhatsApp segura con varios usuarios.
--
-- 1. Códigos pendientes únicos. Con un solo usuario daba igual que dos filas
--    tuvieran el mismo código; con varios, `VINCULAR 123456` podría canjear el
--    código de otra persona. El índice único parcial garantiza que entre los
--    códigos sin usar no haya repetidos: el canje (UPDATE … WHERE code = …
--    AND used_at IS NULL) afecta como mucho una fila, y la app reintenta con
--    otro código si el INSERT choca (23505).
-- 2. Intentos fallidos de vinculación por número (whatsapp_link_attempts):
--    5 fallos en 15 minutos bloquean el número (adivinar un código de 6
--    dígitos). Solo el webhook (service-role) la toca.
--
-- Idempotente. NO se aplica a producción durante la implementación (H8).

-- 1a. Limpieza previa para que el índice único se pueda crear.
--     Códigos vencidos y sin usar: ya no sirven para nada.
DELETE FROM public.whatsapp_link_codes
WHERE used_at IS NULL
  AND expires_at <= now();

--     Si aún quedaran códigos vigentes repetidos, se conserva solo el más
--     nuevo de cada uno (quien tenía el más viejo genera otro en Ajustes).
DELETE FROM public.whatsapp_link_codes c
WHERE c.used_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_link_codes d
    WHERE d.code = c.code
      AND d.used_at IS NULL
      AND (d.created_at, d.id) > (c.created_at, c.id)
  );

-- 1b. Un código pendiente no se repite.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_link_codes_code_pending_uq
  ON public.whatsapp_link_codes (code)
  WHERE used_at IS NULL;

-- 2. Intentos fallidos de VINCULAR por número.
CREATE TABLE IF NOT EXISTS public.whatsapp_link_attempts (
  id bigserial PRIMARY KEY,
  phone_e164 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_link_attempts_phone_created_idx
  ON public.whatsapp_link_attempts (phone_e164, created_at DESC);

-- La purga de cada VINCULAR borra lo anterior a la ventana de CUALQUIER
-- número (created_at < …): sin este índice recorrería la tabla entera.
CREATE INDEX IF NOT EXISTS whatsapp_link_attempts_created_idx
  ON public.whatsapp_link_attempts (created_at);

-- RLS activo SIN políticas: nadie salvo service_role/postgres entra.
ALTER TABLE public.whatsapp_link_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_link_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.whatsapp_link_attempts_id_seq FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, DELETE ON public.whatsapp_link_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.whatsapp_link_attempts_id_seq TO service_role;

-- ============================================================================
-- Verificación manual (después de aplicar, H8; todo de solo lectura)
-- ============================================================================
-- Índices creados:
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND tablename IN ('whatsapp_link_codes', 'whatsapp_link_attempts');
--
-- RLS activo en la tabla de intentos (espera true):
-- SELECT relrowsecurity FROM pg_class
--  WHERE oid = 'public.whatsapp_link_attempts'::regclass;
--
-- Sin políticas (espera 0 filas):
-- SELECT policyname FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'whatsapp_link_attempts';
--
-- Privilegios (espera solo postgres y service_role):
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema = 'public' AND table_name = 'whatsapp_link_attempts';
--
-- Ningún código pendiente repetido (espera 0 filas):
-- SELECT code, count(*) FROM public.whatsapp_link_codes
--  WHERE used_at IS NULL GROUP BY code HAVING count(*) > 1;
