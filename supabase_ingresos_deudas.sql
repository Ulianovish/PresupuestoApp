-- ============================================
-- EXTENSIÓN PARA INGRESOS Y DEUDAS
-- Aplicación de Presupuesto Personal
-- ============================================

-- ============================================
-- TABLA DE INGRESOS
-- ============================================

CREATE TABLE ingresos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    descripcion VARCHAR(255) NOT NULL,
    fuente VARCHAR(255) NOT NULL, -- Empresa, freelance, etc.
    monto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    fecha DATE NOT NULL,
    tipo VARCHAR(50) DEFAULT 'ingreso',
    es_activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- TABLA DE DEUDAS
-- ============================================

CREATE TABLE deudas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    descripcion VARCHAR(255) NOT NULL,
    acreedor VARCHAR(255) NOT NULL, -- Banco, persona, etc.
    monto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    fecha_vencimiento DATE NOT NULL,
    pagada BOOLEAN DEFAULT false,
    tipo VARCHAR(50) DEFAULT 'deuda',
    es_activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- Índices para ingresos
CREATE INDEX idx_ingresos_user_id ON ingresos(user_id);
CREATE INDEX idx_ingresos_fecha ON ingresos(fecha);
CREATE INDEX idx_ingresos_activo ON ingresos(es_activo);
CREATE INDEX idx_ingresos_fuente ON ingresos(fuente);

-- Índices para deudas
CREATE INDEX idx_deudas_user_id ON deudas(user_id);
CREATE INDEX idx_deudas_fecha_vencimiento ON deudas(fecha_vencimiento);
CREATE INDEX idx_deudas_pagada ON deudas(pagada);
CREATE INDEX idx_deudas_acreedor ON deudas(acreedor);
CREATE INDEX idx_deudas_activo ON deudas(es_activo);

-- ============================================
-- TRIGGERS PARA TIMESTAMPS
-- ============================================

-- Triggers para actualizar updated_at automáticamente
CREATE TRIGGER update_ingresos_updated_at
    BEFORE UPDATE ON ingresos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deudas_updated_at
    BEFORE UPDATE ON deudas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================

-- Habilitar RLS en las nuevas tablas
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE deudas ENABLE ROW LEVEL SECURITY;

-- Políticas para ingresos
CREATE POLICY "Los usuarios pueden ver sus propios ingresos"
    ON ingresos FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propios ingresos"
    ON ingresos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propios ingresos"
    ON ingresos FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propios ingresos"
    ON ingresos FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para deudas
CREATE POLICY "Los usuarios pueden ver sus propias deudas"
    ON deudas FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias deudas"
    ON deudas FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias deudas"
    ON deudas FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias deudas"
    ON deudas FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- DATOS INICIALES PARA TESTING
-- ============================================

-- Nota: Estos datos se insertarán con el user_id correcto cuando el usuario esté autenticado
-- Por ahora los dejamos como comentarios para referencia

/*
-- Ejemplos de ingresos iniciales (usar con user_id real)
INSERT INTO ingresos (user_id, descripcion, fuente, monto, fecha) VALUES
('USER_ID_AQUI', 'Salario mensual', 'Phi Dimension', 16000000.00, '2025-01-01'),
('USER_ID_AQUI', 'Proyecto freelance', 'Hactch Works', 16400000.00, '2025-01-01'),
('USER_ID_AQUI', 'Consultoría', 'Hasugue', 0.00, '2025-01-01'),
('USER_ID_AQUI', 'Inversión MOF', 'MOF', 0.00, '2025-01-01'),
('USER_ID_AQUI', 'Arriendo apartamento', 'Apto 216', 0.00, '2025-01-01'),
('USER_ID_AQUI', 'Arriendo parqueadero', 'Parking', 100000.00, '2025-01-01');

-- Ejemplos de deudas iniciales (usar con user_id real)
INSERT INTO deudas (user_id, descripcion, acreedor, monto, fecha_vencimiento) VALUES
('USER_ID_AQUI', 'Crédito vehículo', 'Banco Davivienda', 25000000.00, '2025-02-15'),
('USER_ID_AQUI', 'Hipoteca casa', 'Banco de Bogotá', 45000000.00, '2025-02-01');
*/

-- ============================================
-- FUNCIONES HELPER
-- ============================================

-- Función para obtener total de ingresos de un usuario
CREATE OR REPLACE FUNCTION get_total_ingresos(usuario_id UUID)
RETURNS DECIMAL(12,2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(monto) 
         FROM ingresos 
         WHERE user_id = usuario_id 
           AND es_activo = true 
           AND monto > 0),
        0.00
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener total de deudas de un usuario
CREATE OR REPLACE FUNCTION get_total_deudas(usuario_id UUID)
RETURNS DECIMAL(12,2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(monto) 
         FROM deudas 
         WHERE user_id = usuario_id 
           AND es_activo = true 
           AND pagada = false),
        0.00
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener balance neto de un usuario
CREATE OR REPLACE FUNCTION get_balance_neto(usuario_id UUID)
RETURNS DECIMAL(12,2) AS $$
BEGIN
    RETURN get_total_ingresos(usuario_id) - get_total_deudas(usuario_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE ingresos IS 'Tabla para gestionar los ingresos de los usuarios';
COMMENT ON TABLE deudas IS 'Tabla para gestionar las deudas de los usuarios';

COMMENT ON COLUMN ingresos.descripcion IS 'Descripción del ingreso (ej: Salario mensual)';
COMMENT ON COLUMN ingresos.fuente IS 'Fuente del ingreso (ej: Empresa XYZ)';
COMMENT ON COLUMN ingresos.monto IS 'Cantidad del ingreso en la moneda base';

COMMENT ON COLUMN deudas.descripcion IS 'Descripción de la deuda (ej: Crédito vehículo)';
COMMENT ON COLUMN deudas.acreedor IS 'Entidad a la que se debe (ej: Banco Popular)';
COMMENT ON COLUMN deudas.monto IS 'Cantidad adeudada en la moneda base';
COMMENT ON COLUMN deudas.fecha_vencimiento IS 'Fecha límite para el pago';
COMMENT ON COLUMN deudas.pagada IS 'Indica si la deuda ya fue pagada completamente';

-- ============================================
-- VERIFICACIÓN FINAL
-- ============================================

-- Verificar que las tablas se crearon correctamente
SELECT 
    tablename,
    tableowner,
    hasindexes,
    hastriggers,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('ingresos', 'deudas')
ORDER BY tablename;

-- Mostrar funciones creadas
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN ('get_total_ingresos', 'get_total_deudas', 'get_balance_neto');

SELECT 'Extensión de ingresos y deudas instalada exitosamente' AS status; 