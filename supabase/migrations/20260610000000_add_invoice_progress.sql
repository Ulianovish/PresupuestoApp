-- Progreso visible del procesamiento de una factura (CUFE) corriendo en
-- background. La UI lo lee por polling para mostrar una barra en vivo sin
-- depender de una conexión SSE abierta.
ALTER TABLE public.electronic_invoices
  ADD COLUMN IF NOT EXISTS progress_percent integer,
  ADD COLUMN IF NOT EXISTS progress_message text;
