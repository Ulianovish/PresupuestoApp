-- PK en whatsapp_link_codes (faltaba). Necesaria para replicación/realtime de
-- Supabase y para identificar una fila de código de forma única.
ALTER TABLE public.whatsapp_link_codes
  ADD COLUMN IF NOT EXISTS id uuid PRIMARY KEY DEFAULT gen_random_uuid();
