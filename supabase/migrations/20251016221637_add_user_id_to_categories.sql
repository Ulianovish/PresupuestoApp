-- Agregar columna user_id a la tabla categories
-- Esto permite que cada categoría pertenezca a un usuario específico

-- Agregar la columna user_id
ALTER TABLE categories 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Actualizar las categorías existentes para asignarlas al primer usuario (temporal)
-- En un entorno de producción, esto debería manejarse de manera diferente
UPDATE categories 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Hacer que la columna user_id sea obligatoria
ALTER TABLE categories 
ALTER COLUMN user_id SET NOT NULL;

-- Eliminar las políticas RLS anteriores
DROP POLICY IF EXISTS "Permitir lectura pública de categorías" ON categories;
DROP POLICY IF EXISTS "Permitir inserción de categorías a usuarios autenticados" ON categories;
DROP POLICY IF EXISTS "Permitir actualización de categorías a usuarios autenticados" ON categories;
DROP POLICY IF EXISTS "Permitir eliminación de categorías a usuarios autenticados" ON categories;

-- Crear nuevas políticas RLS basadas en user_id
CREATE POLICY "Los usuarios pueden ver sus propias categorías"
    ON categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias categorías"
    ON categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias categorías"
    ON categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias categorías"
    ON categories FOR DELETE
    USING (auth.uid() = user_id);

-- Crear índice para optimizar consultas por user_id
CREATE INDEX idx_categories_user_id ON categories(user_id);