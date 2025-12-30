-- Forzar la corrección del constraint único en categories
-- Esta migración asegura que el constraint único sea por usuario

-- Primero, eliminar cualquier constraint único existente en la columna name
DO $$ 
BEGIN
    -- Eliminar constraint categories_name_key si existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'categories_name_key' 
        AND table_name = 'categories'
    ) THEN
        ALTER TABLE categories DROP CONSTRAINT categories_name_key;
        RAISE NOTICE 'Constraint categories_name_key eliminado';
    END IF;
    
    -- Eliminar constraint categories_name_user_id_key si existe para recrearlo
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'categories_name_user_id_key' 
        AND table_name = 'categories'
    ) THEN
        ALTER TABLE categories DROP CONSTRAINT categories_name_user_id_key;
        RAISE NOTICE 'Constraint categories_name_user_id_key eliminado para recrear';
    END IF;
END $$;

-- Crear el constraint único compuesto correcto
ALTER TABLE categories 
ADD CONSTRAINT categories_name_user_id_key UNIQUE (name, user_id);

-- Verificar que el constraint se creó correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'categories_name_user_id_key' 
        AND table_name = 'categories'
    ) THEN
        RAISE NOTICE 'Constraint categories_name_user_id_key creado exitosamente';
    ELSE
        RAISE EXCEPTION 'Error: No se pudo crear el constraint categories_name_user_id_key';
    END IF;
END $$;