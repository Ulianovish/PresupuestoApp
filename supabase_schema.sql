-- ============================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
-- Aplicación de Presupuesto Personal
-- ============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLAS DE LOOKUP (CONFIGURACIÓN)
-- ============================================

-- Tabla de estados de presupuesto
CREATE TABLE budget_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Color hexadecimal
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de clasificaciones
CREATE TABLE classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Color hexadecimal
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de controles
CREATE TABLE controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Color hexadecimal
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de tipos de transacción
CREATE TABLE transaction_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Color hexadecimal
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de monedas
CREATE TABLE currencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(3) NOT NULL UNIQUE,
    symbol VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- TABLAS PRINCIPALES
-- ============================================

-- Tabla de perfiles de usuario
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    avatar_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de categorías
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Color hexadecimal
    icon VARCHAR(50), -- Nombre del icono
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de plantillas de presupuesto
CREATE TABLE budget_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de elementos de presupuesto
CREATE TABLE budget_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    template_id UUID REFERENCES budget_templates(id) ON DELETE SET NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    classification_id UUID NOT NULL REFERENCES classifications(id) ON DELETE RESTRICT,
    control_id UUID NOT NULL REFERENCES controls(id) ON DELETE RESTRICT,
    status_id UUID NOT NULL REFERENCES budget_statuses(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    budgeted_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    spent_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de transacciones
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    budget_item_id UUID NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
    type_id UUID NOT NULL REFERENCES transaction_types(id) ON DELETE RESTRICT,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================
-- DATOS INICIALES (LOOKUP TABLES)
-- ============================================

-- Estados de presupuesto
INSERT INTO budget_statuses (name, description, color) VALUES
('Activo', 'Presupuesto activo y en uso', '#10b981'),
('Inactivo', 'Presupuesto pausado temporalmente', '#f59e0b'),
('Completado', 'Presupuesto terminado exitosamente', '#3b82f6'),
('Cancelado', 'Presupuesto cancelado', '#ef4444');

-- Clasificaciones
INSERT INTO classifications (name, description, color) VALUES
('Fijo', 'Gastos fijos que no cambian mes a mes', '#6366f1'),
('Variable', 'Gastos que cambian según el consumo', '#8b5cf6'),
('Discrecional', 'Gastos opcionales y de entretenimiento', '#ec4899');

-- Controles
INSERT INTO controls (name, description, color) VALUES
('Necesario', 'Gastos esenciales para vivir', '#10b981'),
('Discrecional', 'Gastos opcionales que se pueden reducir', '#f59e0b');

-- Tipos de transacción
INSERT INTO transaction_types (name, description, color) VALUES
('Ingreso', 'Dinero que entra a tu presupuesto', '#10b981'),
('Gasto', 'Dinero que sale de tu presupuesto', '#ef4444'),
('Transferencia', 'Movimiento entre categorías', '#3b82f6');

-- Monedas
INSERT INTO currencies (name, code, symbol) VALUES
('Peso Colombiano', 'COP', '$'),
('Dólar Americano', 'USD', '$'),
('Euro', 'EUR', '€'),
('Peso Mexicano', 'MXN', '$');

-- Categorías predefinidas
INSERT INTO categories (name, description, color, icon) VALUES
('VIVIENDA', 'Gastos relacionados con la vivienda', '#3b82f6', 'home'),
('ALIMENTACIÓN', 'Gastos en comida y bebida', '#10b981', 'restaurant'),
('TRANSPORTE', 'Gastos de movilidad y transporte', '#f59e0b', 'car'),
('SALUD', 'Gastos médicos y de salud', '#ef4444', 'heart'),
('EDUCACIÓN', 'Gastos educativos y formación', '#8b5cf6', 'book'),
('ENTRETENIMIENTO', 'Gastos de ocio y diversión', '#ec4899', 'star'),
('DEUDAS', 'Pagos de deudas y préstamos', '#6b7280', 'credit-card'),
('AHORROS', 'Dinero destinado a ahorros', '#059669', 'piggy-bank'),
('OTROS', 'Gastos diversos no categorizados', '#78716c', 'more-horizontal');

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

-- Índices para mejorar el rendimiento de las consultas
CREATE INDEX idx_budget_items_user_id ON budget_items(user_id);
CREATE INDEX idx_budget_items_category_id ON budget_items(category_id);
CREATE INDEX idx_budget_items_classification_id ON budget_items(classification_id);
CREATE INDEX idx_budget_items_control_id ON budget_items(control_id);
CREATE INDEX idx_budget_items_status_id ON budget_items(status_id);
CREATE INDEX idx_budget_items_template_id ON budget_items(template_id);
CREATE INDEX idx_budget_items_active ON budget_items(is_active);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_budget_item_id ON transactions(budget_item_id);
CREATE INDEX idx_transactions_type_id ON transactions(type_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);

CREATE INDEX idx_budget_templates_user_id ON budget_templates(user_id);
CREATE INDEX idx_budget_templates_active ON budget_templates(is_active);

-- ============================================
-- TRIGGERS PARA ACTUALIZAR TIMESTAMPS
-- ============================================

-- Función para actualizar el timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar updated_at automáticamente
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_templates_updated_at
    BEFORE UPDATE ON budget_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_items_updated_at
    BEFORE UPDATE ON budget_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ============================================

-- Habilitar RLS en todas las tablas que lo requieren
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Los usuarios pueden ver su propio perfil"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden insertar su propio perfil"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Políticas para budget_templates
CREATE POLICY "Los usuarios pueden ver sus propias plantillas"
    ON budget_templates FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias plantillas"
    ON budget_templates FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias plantillas"
    ON budget_templates FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias plantillas"
    ON budget_templates FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para budget_items
CREATE POLICY "Los usuarios pueden ver sus propios elementos de presupuesto"
    ON budget_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propios elementos de presupuesto"
    ON budget_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propios elementos de presupuesto"
    ON budget_items FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propios elementos de presupuesto"
    ON budget_items FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para transactions
CREATE POLICY "Los usuarios pueden ver sus propias transacciones"
    ON transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias transacciones"
    ON transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias transacciones"
    ON transactions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias transacciones"
    ON transactions FOR DELETE
    USING (auth.uid() = user_id);

-- Las tablas de lookup (configuración) son públicas para lectura
ALTER TABLE budget_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir lectura pública de tablas de lookup
CREATE POLICY "Permitir lectura pública de estados de presupuesto"
    ON budget_statuses FOR SELECT
    USING (true);

CREATE POLICY "Permitir lectura pública de clasificaciones"
    ON classifications FOR SELECT
    USING (true);

CREATE POLICY "Permitir lectura pública de controles"
    ON controls FOR SELECT
    USING (true);

CREATE POLICY "Permitir lectura pública de tipos de transacción"
    ON transaction_types FOR SELECT
    USING (true);

CREATE POLICY "Permitir lectura pública de monedas"
    ON currencies FOR SELECT
    USING (true);

CREATE POLICY "Permitir lectura pública de categorías"
    ON categories FOR SELECT
    USING (true);

-- ============================================
-- FUNCIÓN PARA CREAR PERFIL AUTOMÁTICO
-- ============================================

-- Función para crear un perfil automáticamente cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE budget_statuses IS 'Estados posibles de los presupuestos';
COMMENT ON TABLE classifications IS 'Clasificaciones de gastos: Fijo, Variable, Discrecional';
COMMENT ON TABLE controls IS 'Controles de gastos: Necesario, Discrecional';
COMMENT ON TABLE transaction_types IS 'Tipos de transacciones: Ingreso, Gasto, Transferencia';
COMMENT ON TABLE currencies IS 'Monedas disponibles en el sistema';
COMMENT ON TABLE categories IS 'Categorías de gastos predefinidas';
COMMENT ON TABLE profiles IS 'Perfiles de usuario extendidos';
COMMENT ON TABLE budget_templates IS 'Plantillas de presupuesto reutilizables';
COMMENT ON TABLE budget_items IS 'Elementos individuales de presupuesto';
COMMENT ON TABLE transactions IS 'Transacciones registradas por los usuarios';

-- ============================================
-- PERMISOS PARA FUNCIONES
-- ============================================

-- Otorgar permisos necesarios para que las funciones trabajen correctamente
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ============================================
-- FINALIZACIÓN DEL SCRIPT
-- ============================================

-- Verificar que todo se haya creado correctamente
SELECT 
    schemaname,
    tablename,
    tableowner,
    tablespace,
    hasindexes,
    hasrules,
    hastriggers,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN (
        'budget_statuses',
        'classifications', 
        'controls',
        'transaction_types',
        'currencies',
        'categories',
        'profiles',
        'budget_templates',
        'budget_items',
        'transactions'
    )
ORDER BY tablename;

-- Mostrar mensaje de finalización
SELECT 'Script de configuración de base de datos ejecutado exitosamente' AS status; 