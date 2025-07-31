-- =====================================================
-- SCRIPT DE PRUEBA RÁPIDA - Facturas Electrónicas DIAN
-- Verificar que las tablas necesarias existen antes de la migración
-- =====================================================

-- 1. Verificar que la tabla transactions existe
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'transactions';

-- 2. Verificar estructura de la tabla transactions
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;

-- 3. Verificar que la tabla transaction_types existe
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'transaction_types';

-- 4. Verificar que existe el tipo 'Gasto'
SELECT id, name, description 
FROM transaction_types 
WHERE name = 'Gasto';

-- 5. Verificar que la tabla profiles existe (para las referencias)
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'profiles';

-- 6. Verificar que auth.users está disponible
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_name = 'uid' 
AND routine_schema = 'auth';

-- =====================================================
-- RESULTADOS ESPERADOS:
-- =====================================================
-- - transactions: debe existir como tabla
-- - transaction_types: debe existir con registro 'Gasto'
-- - profiles: debe existir como tabla
-- - auth.uid: debe existir como función
-- =====================================================

-- Si todos estos resultados son positivos, 
-- puedes proceder con la migración completa:
-- supabase_electronic_invoices_migration.sql 