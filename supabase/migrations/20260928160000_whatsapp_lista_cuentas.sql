-- Lista de cuentas del bot de WhatsApp ("¿con qué cuenta fue?").
--
-- Cuando el bot registra un gasto y no sabe con qué cuenta se pagó, manda una
-- lista interactiva (Twilio `twilio/list-picker`) con las 6 cuentas más
-- usadas y el usuario toca una. Hace falta:
--   1. saber QUÉ número registró cada gasto: la app la comparten dos
--      personas, cada una con su número, y la lista de cada una tiene que
--      arrancar por SUS cuentas;
--   2. guardar cada pregunta, para que el toque (que llega sin estado, en
--      otra invocación del webhook) sepa a qué factura o gastos apunta;
--   3. un ranking de uso por cuenta que se pueda pedir en una sola consulta.

-- 1. Número que registró el gasto (E.164, "+573001234567"). NULL = la app,
-- una importación o un gasto anterior a este cambio.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS registered_phone text;

-- 2. Preguntas de cuenta. Una fila por lista mandada; el id de cada ítem de
-- la lista es `cta:<id de esta fila>:<id de la cuenta>`.
--   target_kind = 'invoice'      → target_ids = [la factura retenida en
--                                  pending_review; se registra al elegir]
--   target_kind = 'transactions' → target_ids = los gastos ya registrados con
--                                  la cuenta por defecto; se les cambia
CREATE TABLE IF NOT EXISTS public.whatsapp_account_prompts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164           text NOT NULL,
  target_kind          text NOT NULL
                       CHECK (target_kind IN ('invoice', 'transactions')),
  target_ids           uuid[] NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  resolved_at          timestamptz,
  resolved_account_id  uuid REFERENCES public.accounts(id) ON DELETE SET NULL
);

-- "La última pregunta abierta de este número" (respuesta escrita en vez de
-- tocar la lista).
CREATE INDEX IF NOT EXISTS idx_whatsapp_account_prompts_abiertas
  ON public.whatsapp_account_prompts (phone_e164, created_at DESC)
  WHERE resolved_at IS NULL;

-- Solo el webhook (service-role) toca esta tabla; el navegador nunca.
-- RLS activo SIN políticas = nadie más entra (mismo criterio que
-- whatsapp_conversations). El REVOKE es el cinturón además de los tirantes.
ALTER TABLE public.whatsapp_account_prompts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_account_prompts FROM anon, authenticated;

-- 3. Uso por cuenta en los últimos p_days días (gastos, no ingresos): cuántos
-- registró ESTE número y cuántos todo el usuario. Una factura cuenta como UN
-- gasto (sus ítems comparten electronic_invoice_id). Los gastos a cuotas con
-- fecha futura no cuentan. `last_used` es sin límite de días, para ordenar
-- las cuentas que no se usaron en la ventana.
CREATE OR REPLACE FUNCTION public.whatsapp_account_usage(
  p_user_id uuid,
  p_phone   text,
  p_days    integer DEFAULT 90
)
RETURNS TABLE (
  account_id uuid,
  uses_phone bigint,
  uses_user  bigint,
  last_used  date
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    t.account_id,
    COUNT(DISTINCT COALESCE(t.electronic_invoice_id, t.id)) FILTER (
      WHERE t.registered_phone = p_phone
        AND t.transaction_date >= CURRENT_DATE - p_days
    ) AS uses_phone,
    COUNT(DISTINCT COALESCE(t.electronic_invoice_id, t.id)) FILTER (
      WHERE t.transaction_date >= CURRENT_DATE - p_days
    ) AS uses_user,
    MAX(t.transaction_date) AS last_used
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.account_id IS NOT NULL
    AND t.transaction_date <= CURRENT_DATE
    AND t.type_id = (SELECT id FROM public.transaction_types WHERE name = 'Gasto')
  GROUP BY t.account_id;
$$;

-- Recibe p_user_id por parámetro: solo el webhook (service-role) la llama.
-- Postgres le da EXECUTE a PUBLIC por defecto en las funciones.
REVOKE EXECUTE ON FUNCTION public.whatsapp_account_usage(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.whatsapp_account_usage(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.whatsapp_account_usage(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_account_usage(uuid, text, integer) TO service_role;
