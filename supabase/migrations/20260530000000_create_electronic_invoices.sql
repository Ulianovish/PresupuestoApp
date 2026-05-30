-- Tabla para facturas electrónicas DIAN procesadas desde un CUFE.
-- Sirve como borrador (status) y como guarda anti-reprocesamiento (unique cufe).

CREATE TABLE IF NOT EXISTS electronic_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cufe_code TEXT NOT NULL,
    supplier_name TEXT,
    supplier_nit TEXT,
    invoice_date DATE,
    currency TEXT DEFAULT 'COP',
    subtotal NUMERIC(14,2),
    total_amount NUMERIC(14,2),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'pending_review', 'approved', 'error')),
    selected_account_name TEXT,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ
);

-- Guarda anti-reprocesamiento: un CUFE único por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS idx_electronic_invoices_user_cufe
    ON electronic_invoices(user_id, cufe_code);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_user_status
    ON electronic_invoices(user_id, status);

ALTER TABLE electronic_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver sus propias facturas"
    ON electronic_invoices FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias facturas"
    ON electronic_invoices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias facturas"
    ON electronic_invoices FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias facturas"
    ON electronic_invoices FOR DELETE
    USING (auth.uid() = user_id);
