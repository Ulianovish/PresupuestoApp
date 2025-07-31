# 🔍 Validación de Migración: Facturas Electrónicas DIAN

## 📋 Checklist de Validación

### ✅ 1. Verificar Creación de Tabla

```sql
-- Verificar que la tabla se creó correctamente
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'electronic_invoices';

-- Verificar estructura de columnas
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'electronic_invoices'
ORDER BY ordinal_position;
```

### ✅ 2. Verificar Índices

```sql
-- Verificar que todos los índices se crearon
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'electronic_invoices';
```

**Índices esperados:**
- `idx_electronic_invoices_user_id`
- `idx_electronic_invoices_cufe`
- `idx_electronic_invoices_date`
- `idx_electronic_invoices_supplier`
- `idx_electronic_invoices_user_date`

### ✅ 3. Verificar RLS (Row Level Security)

```sql
-- Verificar que RLS está habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'electronic_invoices';

-- Verificar políticas de seguridad
SELECT polname, polcmd, polroles, polqual, polwithcheck
FROM pg_policy
WHERE polrelid = 'electronic_invoices'::regclass;
```

**Políticas esperadas:**
- "Users can view their own electronic invoices" (SELECT)
- "Users can insert their own electronic invoices" (INSERT)
- "Users can update their own electronic invoices" (UPDATE)
- "Users can delete their own electronic invoices" (DELETE)

### ✅ 4. Verificar Funciones Creadas

```sql
-- Verificar que las funciones se crearon
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN (
  'check_cufe_exists',
  'get_electronic_invoices_by_date_range',
  'get_invoice_stats_by_supplier',
  'update_electronic_invoices_updated_at'
);
```

### ✅ 5. Verificar Trigger

```sql
-- Verificar que el trigger se creó
SELECT trigger_name, event_manipulation, action_timing, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'electronic_invoices_updated_at_trigger';
```

### ✅ 6. Verificar Modificación de transactions

```sql
-- Verificar que se agregó la nueva columna
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'transactions' 
AND column_name = 'electronic_invoice_id';

-- Verificar índice en la nueva columna
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'transactions'
AND indexname = 'idx_transactions_electronic_invoice';
```

---

## 🧪 Pruebas Funcionales

### Prueba 1: Insertar Factura de Prueba

```sql
-- Insertar una factura de prueba (cambiar user_id por uno válido)
INSERT INTO electronic_invoices (
  user_id,
  cufe_code,
  supplier_name,
  supplier_nit,
  invoice_date,
  total_amount,
  extracted_data
) VALUES (
  'YOUR_USER_ID_HERE', -- Cambiar por un UUID de usuario válido
  '12345678-1234-1234-1234-123456789012',
  'Prueba Migración S.A.S.',
  '900123456-1',
  '2025-01-22',
  100000.00,
  '{"items": [{"description": "Producto de prueba", "quantity": 1, "unit_price": 100000, "total_price": 100000}], "totals": {"subtotal": 84034, "tax_amount": 15966, "total_amount": 100000}}'::jsonb
);
```

### Prueba 2: Verificar Función check_cufe_exists

```sql
-- Probar la función de verificación de CUFE (cambiar user_id)
SELECT check_cufe_exists(
  'YOUR_USER_ID_HERE',
  '12345678-1234-1234-1234-123456789012'
) as cufe_exists;
```

**Resultado esperado:** `true`

### Prueba 3: Probar Función de Consulta por Fechas

```sql
-- Probar función de consulta por rango de fechas (cambiar user_id)
SELECT * FROM get_electronic_invoices_by_date_range(
  'YOUR_USER_ID_HERE',
  '2025-01-01',
  '2025-12-31'
);
```

### Prueba 4: Verificar Trigger de updated_at

```sql
-- Actualizar la factura de prueba
UPDATE electronic_invoices 
SET supplier_name = 'Prueba Migración ACTUALIZADA S.A.S.'
WHERE cufe_code = '12345678-1234-1234-1234-123456789012';

-- Verificar que updated_at se actualizó
SELECT cufe_code, supplier_name, created_at, updated_at
FROM electronic_invoices
WHERE cufe_code = '12345678-1234-1234-1234-123456789012';
```

**Verificar:** `updated_at` debe ser más reciente que `created_at`

### Prueba 5: Probar Relación con transactions

```sql
-- Crear un gasto relacionado con la factura (cambiar user_id)
INSERT INTO transactions (
  user_id,
  description,
  amount,
  transaction_date,
  category_name,
  month_year,
  type_id,
  electronic_invoice_id
) VALUES (
  'YOUR_USER_ID_HERE',
  'Gasto desde factura electrónica',
  100000.00,
  '2025-01-22',
  'OTROS',
  '2025-01',
  (SELECT id FROM transaction_types WHERE name = 'Gasto'),
  (SELECT id FROM electronic_invoices WHERE cufe_code = '12345678-1234-1234-1234-123456789012')
);

-- Verificar la relación
SELECT 
  ei.cufe_code,
  ei.supplier_name,
  t.description,
  t.amount
FROM electronic_invoices ei
LEFT JOIN transactions t ON ei.id = t.electronic_invoice_id
WHERE ei.cufe_code = '12345678-1234-1234-1234-123456789012';
```

---

## 🔧 Limpieza de Datos de Prueba

```sql
-- Eliminar datos de prueba después de validar
DELETE FROM transactions 
WHERE electronic_invoice_id IN (
  SELECT id FROM electronic_invoices 
  WHERE cufe_code = '12345678-1234-1234-1234-123456789012'
);

DELETE FROM electronic_invoices 
WHERE cufe_code = '12345678-1234-1234-1234-123456789012';
```

---

## ⚠️ Problemas Comunes y Soluciones

### Error: "relation does not exist"
**Causa:** La tabla no se creó correctamente  
**Solución:** Verificar que el script SQL se ejecutó sin errores

### Error: "permission denied for table"
**Causa:** Problemas con las políticas RLS  
**Solución:** Verificar que las políticas se crearon correctamente

### Error: "function does not exist"
**Causa:** Las funciones no se crearon  
**Solución:** Re-ejecutar la sección de funciones del script

### Error: "foreign key constraint fails"
**Causa:** Problema con la relación a transactions  
**Solución:** Verificar que la tabla transactions existe

---

## 📊 Métricas de Validación

Al completar la validación, deberías tener:

- ✅ 1 tabla nueva (`electronic_invoices`)
- ✅ 5 índices creados
- ✅ 4 políticas RLS activas
- ✅ 3 funciones personalizadas
- ✅ 1 trigger activo
- ✅ 1 columna nueva en `transactions`
- ✅ 1 índice adicional en `transactions`

---

## 🎯 Siguiente Paso

Una vez validada la migración exitosamente, puedes proceder con:

1. **Actualizar tipos TypeScript** ✅ (Ya completado)
2. **Crear servicios del frontend** (Fase 3)
3. **Implementar función Vercel** (Fase 2)

**Nota:** Guarda los UUIDs de usuarios reales para las pruebas, ya que las políticas RLS requieren autenticación válida. 