-- Modificar constraint de unique key para que sea por usuario
-- Esto permite que diferentes usuarios tengan categorías con el mismo nombre

-- Eliminar el constraint único global existente
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- Crear un constraint único compuesto por name + user_id
-- Esto permite que cada usuario tenga categorías con nombres únicos, pero diferentes usuarios pueden tener categorías con el mismo nombre
ALTER TABLE categories ADD CONSTRAINT categories_name_user_id_key UNIQUE (name, user_id);