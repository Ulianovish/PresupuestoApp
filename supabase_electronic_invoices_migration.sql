-- =====================================================
-- MIGRACIÓN: Facturas Electrónicas DIAN
-- Fecha: 2025-01-22
-- Propósito: Crear tabla para almacenar códigos CUFE y datos de facturas electrónicas
-- =====================================================

-- 1. Crear tabla principal de facturas electrónicas
CREATE TABLE IF NOT EXISTS electronic_invoices (
  -- Campos principales
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Datos de la factura DIAN
  cufe_code VARCHAR(255) NOT NULL UNIQUE, -- Código CUFE único de la factura
  supplier_name VARCHAR(255), -- Nombre del proveedor/empresa
  supplier_nit VARCHAR(50), -- NIT del proveedor
  
  -- Información financiera
  invoice_date DATE NOT NULL, -- Fecha de emisión de la factura
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0, -- Monto total de la factura
  
  -- Datos técnicos
  extracted_data JSONB, -- Datos completos extraídos del PDF (items, impuestos, etc.)
  pdf_url TEXT, -- URL del PDF descargado (opcional)
  
  -- Metadatos
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Cuando se procesó la factura
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_user_id 
ON electronic_invoices(user_id);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_cufe 
ON electronic_invoices(cufe_code);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_date 
ON electronic_invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_supplier 
ON electronic_invoices(supplier_name);

-- Índice compuesto para consultas por usuario y fecha
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_user_date 
ON electronic_invoices(user_id, invoice_date DESC);

-- 3. Configurar Row Level Security (RLS)
ALTER TABLE electronic_invoices ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: Los usuarios solo pueden ver sus propias facturas
CREATE POLICY "Users can view their own electronic invoices" 
ON electronic_invoices FOR SELECT 
USING (auth.uid() = user_id);

-- Política para INSERT: Los usuarios solo pueden insertar facturas para sí mismos
CREATE POLICY "Users can insert their own electronic invoices" 
ON electronic_invoices FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Política para UPDATE: Los usuarios solo pueden actualizar sus propias facturas
CREATE POLICY "Users can update their own electronic invoices" 
ON electronic_invoices FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política para DELETE: Los usuarios solo pueden eliminar sus propias facturas
CREATE POLICY "Users can delete their own electronic invoices" 
ON electronic_invoices FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Modificar tabla transactions para agregar relación con facturas electrónicas
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS electronic_invoice_id UUID 
REFERENCES electronic_invoices(id) ON DELETE SET NULL;

-- Crear índice para la nueva relación
CREATE INDEX IF NOT EXISTS idx_transactions_electronic_invoice 
ON transactions(electronic_invoice_id);

-- 5. Función para actualizar timestamp de updated_at
CREATE OR REPLACE FUNCTION update_electronic_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Crear trigger para actualizar updated_at automáticamente
CREATE TRIGGER electronic_invoices_updated_at_trigger
  BEFORE UPDATE ON electronic_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_electronic_invoices_updated_at();

-- 7. Funciones útiles para trabajar con facturas electrónicas

-- Función para verificar si un CUFE ya existe para un usuario
CREATE OR REPLACE FUNCTION check_cufe_exists(
  p_user_id UUID,
  p_cufe_code VARCHAR(255)
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM electronic_invoices 
    WHERE user_id = p_user_id 
    AND cufe_code = p_cufe_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener facturas por usuario y rango de fechas
CREATE OR REPLACE FUNCTION get_electronic_invoices_by_date_range(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  cufe_code VARCHAR(255),
  supplier_name VARCHAR(255),
  supplier_nit VARCHAR(50),
  invoice_date DATE,
  total_amount DECIMAL(15,2),
  processed_at TIMESTAMP WITH TIME ZONE,
  has_expenses BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ei.id,
    ei.cufe_code,
    ei.supplier_name,
    ei.supplier_nit,
    ei.invoice_date,
    ei.total_amount,
    ei.processed_at,
    EXISTS(
      SELECT 1 
      FROM transactions t 
      WHERE t.electronic_invoice_id = ei.id
    ) as has_expenses
  FROM electronic_invoices ei
  WHERE ei.user_id = p_user_id
    AND (p_start_date IS NULL OR ei.invoice_date >= p_start_date)
    AND (p_end_date IS NULL OR ei.invoice_date <= p_end_date)
  ORDER BY ei.invoice_date DESC, ei.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas de facturas por proveedor
CREATE OR REPLACE FUNCTION get_invoice_stats_by_supplier(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  supplier_name VARCHAR(255),
  supplier_nit VARCHAR(50),
  invoice_count BIGINT,
  total_amount DECIMAL(15,2),
  avg_amount DECIMAL(15,2),
  last_invoice_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ei.supplier_name,
    ei.supplier_nit,
    COUNT(*) as invoice_count,
    SUM(ei.total_amount) as total_amount,
    AVG(ei.total_amount) as avg_amount,
    MAX(ei.invoice_date) as last_invoice_date
  FROM electronic_invoices ei
  WHERE ei.user_id = p_user_id
    AND (p_start_date IS NULL OR ei.invoice_date >= p_start_date)
    AND (p_end_date IS NULL OR ei.invoice_date <= p_end_date)
  GROUP BY ei.supplier_name, ei.supplier_nit
  ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Comentarios para documentación
COMMENT ON TABLE electronic_invoices IS 'Almacena facturas electrónicas procesadas desde códigos QR de la DIAN';
COMMENT ON COLUMN electronic_invoices.cufe_code IS 'Código único de factura electrónica (CUFE) de la DIAN';
COMMENT ON COLUMN electronic_invoices.extracted_data IS 'Datos JSON extraídos del PDF: items, impuestos, totales, etc.';
COMMENT ON COLUMN electronic_invoices.pdf_url IS 'URL del PDF original de la factura (opcional)';
COMMENT ON COLUMN transactions.electronic_invoice_id IS 'Referencia a la factura electrónica que originó este gasto';

-- 9. Insertar datos de ejemplo para testing (opcional - comentado por defecto)
/*
-- Datos de ejemplo para pruebas - DESCOMENTAR SOLO EN DESARROLLO
INSERT INTO electronic_invoices (
  user_id, 
  cufe_code, 
  supplier_name, 
  supplier_nit, 
  invoice_date, 
  total_amount,
  extracted_data
) VALUES (
  -- Usar UUID de un usuario de prueba
  '00000000-0000-0000-0000-000000000000',
  '12345678-1234-1234-1234-123456789012',
  'Tienda de Ejemplo S.A.S.',
  '900123456-1',
  '2025-01-20',
  150000.00,
  '{"items": [{"description": "Producto de prueba", "quantity": 1, "price": 150000}], "taxes": {"iva": 24000}, "subtotal": 126000}'
);
*/

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================

-- Para aplicar esta migración:
-- 1. Conectarse a Supabase
-- 2. Ejecutar este script en el SQL Editor
-- 3. Verificar que todas las tablas, índices y funciones se crearon correctamente
-- 4. Probar las políticas de RLS con usuarios de prueba 