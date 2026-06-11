-- Vinculación de números de WhatsApp con presupuestos (user_id).
-- Varios números pueden apuntar al mismo user_id (familia → un presupuesto).

CREATE TABLE IF NOT EXISTS public.whatsapp_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164    text NOT NULL UNIQUE,                       -- +573001234567
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text,
  default_account_name text,
  linked_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_links_user
  ON public.whatsapp_links(user_id);

ALTER TABLE public.whatsapp_links ENABLE ROW LEVEL SECURITY;

-- El dueño ve y borra sus números. INSERT/UPDATE los hace el webhook con
-- service-role (bypassa RLS); no hay política de INSERT/UPDATE para usuarios.
CREATE POLICY "Dueño ve sus números"
  ON public.whatsapp_links FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Dueño borra sus números"
  ON public.whatsapp_links FOR DELETE
  USING (auth.uid() = user_id);

-- Códigos temporales de vinculación (un solo uso, caducan).
CREATE TABLE IF NOT EXISTS public.whatsapp_link_codes (
  code        text NOT NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_link_codes_code
  ON public.whatsapp_link_codes(code);

ALTER TABLE public.whatsapp_link_codes ENABLE ROW LEVEL SECURITY;

-- El usuario crea y ve sus propios códigos (la Server Action corre con su sesión).
-- El canje lo hace el webhook con service-role (bypassa RLS).
CREATE POLICY "Usuario crea sus códigos"
  ON public.whatsapp_link_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuario ve sus códigos"
  ON public.whatsapp_link_codes FOR SELECT
  USING (auth.uid() = user_id);
