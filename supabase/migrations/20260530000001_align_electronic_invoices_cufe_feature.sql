-- Alinea una tabla electronic_invoices preexistente (esquema viejo de scaffolding:
-- solo extracted_data/pdf_url) con el modelo del feature CUFE→Gastos.
-- Idempotente: en una DB nueva (donde la migración 20260530000000 ya creó la tabla
-- con todas las columnas) estos ADD COLUMN IF NOT EXISTS son no-ops.

ALTER TABLE public.electronic_invoices
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'COP',
  ADD COLUMN IF NOT EXISTS subtotal numeric(14,2),
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS selected_account_name text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS processing_time_ms integer,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'electronic_invoices_status_check'
  ) THEN
    ALTER TABLE public.electronic_invoices
      ADD CONSTRAINT electronic_invoices_status_check
      CHECK (status IN ('processing', 'pending_review', 'approved', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_user_status
  ON public.electronic_invoices(user_id, status);
