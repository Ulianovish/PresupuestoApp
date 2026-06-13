-- Permite facturas por VISIÓN (foto sin CUFE): cufe_code pasa a nullable y se
-- agrega `source` para distinguir el origen. El UNIQUE(user_id, cufe_code)
-- sigue válido: Postgres trata múltiples NULL como distintos.
ALTER TABLE public.electronic_invoices
  ALTER COLUMN cufe_code DROP NOT NULL;

ALTER TABLE public.electronic_invoices
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'dian_cufe';
