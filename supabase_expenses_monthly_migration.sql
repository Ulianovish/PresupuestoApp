-- ============================================
-- MIGRACIÓN PARA GASTOS MENSUALES
-- Extensión del sistema de transacciones para manejo mensual
-- ============================================

-- Primero verificamos si la tabla transactions existe y revisar su estructura
-- Si no existe, la creamos con la estructura necesaria

-- Crear tabla accounts si no existe (para las cuentas como Nequi, TC Falabella, etc.)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- "Nequi", "TC Falabella", "Efectivo", "Banco Santander"
    type VARCHAR(50) DEFAULT 'bank', -- 'bank', 'cash', 'credit'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Crear índices para accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active);

-- Modificar la tabla transactions para gastos mensuales
-- Agregar campos necesarios si no existen
DO $$ 
BEGIN
    -- Agregar month_year para manejo mensual
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'transactions' AND column_name = 'month_year') THEN
        ALTER TABLE transactions ADD COLUMN month_year VARCHAR(7); -- Formato 'YYYY-MM'
    END IF;
    
    -- Agregar account_id si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'transactions' AND column_name = 'account_id') THEN
        ALTER TABLE transactions ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
    END IF;
    
    -- Agregar lugar para ubicación del gasto
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'transactions' AND column_name = 'place') THEN
        ALTER TABLE transactions ADD COLUMN place VARCHAR(255);
    END IF;
    
    -- Agregar category_name para categoría directa (VIVIENDA, DEUDAS, etc.)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'transactions' AND column_name = 'category_name') THEN
        ALTER TABLE transactions ADD COLUMN category_name VARCHAR(100);
    END IF;
    
    -- Hacer budget_item_id opcional para gastos directos
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'transactions' AND column_name = 'budget_item_id' AND is_nullable = 'NO') THEN
        ALTER TABLE transactions ALTER COLUMN budget_item_id DROP NOT NULL;
    END IF;

END $$;

-- Actualizar transacciones existentes con month_year basado en transaction_date
UPDATE transactions 
SET month_year = TO_CHAR(transaction_date, 'YYYY-MM')
WHERE month_year IS NULL;

-- Hacer month_year obligatorio después de la actualización
ALTER TABLE transactions ALTER COLUMN month_year SET NOT NULL;

-- Crear índices para optimizar consultas de gastos mensuales
CREATE INDEX IF NOT EXISTS idx_transactions_user_month ON transactions(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_transactions_month_year ON transactions(month_year);
CREATE INDEX IF NOT EXISTS idx_transactions_category_name ON transactions(category_name);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);

-- NOTA: Las cuentas se crearán automáticamente por usuario cuando sean necesarias
-- No insertamos cuentas predefinidas sin user_id para evitar violaciones de restricciones

-- Insertar categorías adicionales para gastos si no existen
INSERT INTO categories (name, description, color, icon) VALUES
('MERCADO', 'Gastos en supermercado y alimentación', '#10b981', 'shopping-cart'),
('OTROS', 'Gastos diversos no categorizados', '#78716c', 'more-horizontal')
ON CONFLICT (name) DO NOTHING;

-- Función para obtener gastos por mes y usuario
CREATE OR REPLACE FUNCTION get_expenses_by_month(
    p_user_id UUID,
    p_month_year VARCHAR(7)
)
RETURNS TABLE (
    id UUID,
    description TEXT,
    amount DECIMAL(12,2),
    transaction_date DATE,
    category_name VARCHAR(100),
    account_name VARCHAR(255),
    place VARCHAR(255),
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.description,
        t.amount,
        t.transaction_date,
        t.category_name,
        a.name as account_name,
        t.place,
        t.created_at
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN transaction_types tt ON t.type_id = tt.id
    WHERE t.user_id = p_user_id 
      AND t.month_year = p_month_year
      AND tt.name = 'Gasto' -- Solo gastos, no ingresos
    ORDER BY t.transaction_date DESC, t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para insertar/actualizar gasto mensual
CREATE OR REPLACE FUNCTION upsert_monthly_expense(
    p_user_id UUID,
    p_description TEXT,
    p_amount DECIMAL(12,2),
    p_transaction_date DATE,
    p_category_name VARCHAR(100),
    p_account_name VARCHAR(255),
    p_place VARCHAR(255) DEFAULT NULL,
    p_month_year VARCHAR(7) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_account_id UUID;
    v_transaction_id UUID;
    v_month_year VARCHAR(7);
BEGIN
    -- Calcular month_year si no se proporciona
    IF p_month_year IS NULL THEN
        v_month_year := TO_CHAR(p_transaction_date, 'YYYY-MM');
    ELSE
        v_month_year := p_month_year;
    END IF;
    
    -- Buscar o crear cuenta
    SELECT id INTO v_account_id
    FROM accounts 
    WHERE name = p_account_name AND user_id = p_user_id;
    
    IF v_account_id IS NULL THEN
        -- Determinar tipo de cuenta basado en el nombre y crear la cuenta
        INSERT INTO accounts (user_id, name, type)
        VALUES (
            p_user_id, 
            p_account_name, 
            CASE 
                WHEN p_account_name ILIKE '%TC%' OR p_account_name ILIKE '%tarjeta%' OR p_account_name ILIKE '%credito%' THEN 'credit'
                WHEN p_account_name ILIKE '%efectivo%' OR p_account_name ILIKE '%cash%' THEN 'cash'
                ELSE 'bank'
            END
        )
        RETURNING id INTO v_account_id;
    END IF;
    
    -- Insertar transacción
    INSERT INTO transactions (
        user_id,
        description,
        amount,
        transaction_date,
        category_name,
        account_id,
        place,
        month_year,
        type_id
    ) VALUES (
        p_user_id,
        p_description,
        p_amount,
        p_transaction_date,
        p_category_name,
        v_account_id,
        p_place,
        v_month_year,
        (SELECT id FROM transaction_types WHERE name = 'Gasto')
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener resumen de gastos por categoría en un mes
CREATE OR REPLACE FUNCTION get_expenses_summary_by_month(
    p_user_id UUID,
    p_month_year VARCHAR(7)
)
RETURNS TABLE (
    category_name VARCHAR(100),
    total_amount DECIMAL(12,2),
    transaction_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.category_name,
        SUM(t.amount) as total_amount,
        COUNT(*) as transaction_count
    FROM transactions t
    LEFT JOIN transaction_types tt ON t.type_id = tt.id
    WHERE t.user_id = p_user_id 
      AND t.month_year = p_month_year
      AND tt.name = 'Gasto'
    GROUP BY t.category_name
    ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener meses disponibles con gastos
CREATE OR REPLACE FUNCTION get_available_expense_months(p_user_id UUID)
RETURNS TABLE (month_year VARCHAR(7)) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT t.month_year
    FROM transactions t
    LEFT JOIN transaction_types tt ON t.type_id = tt.id
    WHERE t.user_id = p_user_id
      AND tt.name = 'Gasto'
    ORDER BY t.month_year DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar RLS para accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Políticas para accounts
CREATE POLICY "Los usuarios pueden ver sus propias cuentas"
    ON accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias cuentas"
    ON accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias cuentas"
    ON accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias cuentas"
    ON accounts FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at en accounts
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON COLUMN transactions.month_year IS 'Mes y año en formato YYYY-MM para agrupación mensual';
COMMENT ON COLUMN transactions.category_name IS 'Nombre directo de la categoría (VIVIENDA, DEUDAS, etc.)';
COMMENT ON COLUMN transactions.place IS 'Lugar donde se realizó el gasto';
COMMENT ON TABLE accounts IS 'Cuentas bancarias y métodos de pago de los usuarios';

-- Verificación final
SELECT 'Migración de gastos mensuales completada exitosamente' as resultado; 