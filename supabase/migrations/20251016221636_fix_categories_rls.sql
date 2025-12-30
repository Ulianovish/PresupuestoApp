-- Agregar políticas RLS faltantes para la tabla categories
-- Esto permite que los usuarios autenticados puedan crear, actualizar y eliminar categorías

-- Política para permitir INSERT a usuarios autenticados
CREATE POLICY "Permitir inserción de categorías a usuarios autenticados"
    ON categories FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Política para permitir UPDATE a usuarios autenticados
CREATE POLICY "Permitir actualización de categorías a usuarios autenticados"
    ON categories FOR UPDATE
    USING (auth.uid() IS NOT NULL);

-- Política para permitir DELETE a usuarios autenticados
CREATE POLICY "Permitir eliminación de categorías a usuarios autenticados"
    ON categories FOR DELETE
    USING (auth.uid() IS NOT NULL);