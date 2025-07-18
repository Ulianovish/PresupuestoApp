# Guía de Implementación: Ingresos y Deudas con Supabase

Esta guía te ayudará a configurar las nuevas funcionalidades de ingresos y deudas conectadas con Supabase.

## 📋 Requisitos Previos

- ✅ Proyecto de Supabase configurado
- ✅ Esquema base instalado (`supabase_schema.sql`)
- ✅ Variables de entorno configuradas
- ✅ Usuario registrado en la aplicación

## 🚀 Paso 1: Ejecutar Script SQL en Supabase

### 1.1 Acceder al Editor SQL de Supabase
1. Ve a tu dashboard de Supabase: [supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto de presupuesto
3. En el menú lateral, haz clic en **"SQL Editor"**

### 1.2 Ejecutar el Script de Extensión
1. Crea una nueva consulta haciendo clic en **"New query"**
2. Copia y pega el contenido completo del archivo `supabase_ingresos_deudas.sql`
3. Haz clic en **"Run"** para ejecutar el script
4. Verifica que aparezca el mensaje: `"Extensión de ingresos y deudas instalada exitosamente"`

### 1.3 Verificar Tablas Creadas
Ejecuta esta consulta para verificar que las tablas se crearon correctamente:

```sql
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
```

Deberías ver:
- `deudas` con `rowsecurity = true`
- `ingresos` con `rowsecurity = true`

## 🔧 Paso 2: Verificar Configuración de la Aplicación

### 2.1 Variables de Entorno
Asegúrate de que estas variables estén configuradas en tu `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### 2.2 Verificar Archivos Nuevos
Confirma que estos archivos existan en tu proyecto:
- ✅ `src/lib/services/ingresos-deudas.ts`
- ✅ `src/hooks/useIngresosDeudas.ts`
- ✅ `src/components/pages/IngresosDeudas.tsx` (actualizado)

## 🧪 Paso 3: Probar la Funcionalidad

### 3.1 Iniciar el Servidor de Desarrollo
```bash
# Si el puerto 3001 está ocupado, mata el proceso primero
# En Windows:
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F

# Luego inicia el servidor
npm run dev
```

### 3.2 Navegar a la Página de Ingresos/Deudas
1. Ve a [http://localhost:3001](http://localhost:3001)
2. Inicia sesión con tu usuario
3. Navega a **"Ingresos/Deudas"** en el menú

### 3.3 Verificar Datos Iniciales
Al cargar la página por primera vez, deberías ver:

**Ingresos de Ejemplo:**
- Phi Dimension: $16,000,000
- Hactch Works: $16,400,000
- Hasugue: Pendiente
- MOF: Pendiente
- Apto 216: Pendiente
- Parking: $100,000

**Deudas de Ejemplo:**
- Crédito vehículo (Banco Davivienda): $25,000,000
- Hipoteca casa (Banco de Bogotá): $45,000,000

**Resumen Financiero:**
- Total Ingresos: $32,500,000
- Total Deudas: $70,000,000
- Balance Neto: -$37,500,000

## ✨ Paso 4: Probar Funcionalidades

### 4.1 Agregar Nuevo Ingreso
1. Haz clic en **"Agregar Ingreso"**
2. Completa el formulario:
   - **Descripción**: "Bono navideño"
   - **Fuente**: "Phi Dimension"
   - **Monto**: "1500000"
   - **Fecha**: Fecha actual
3. Haz clic en **"Agregar"**
4. ✅ Verifica que aparezca en la lista
5. ✅ Verifica que se actualicen las tarjetas de resumen

### 4.2 Agregar Nueva Deuda
1. Haz clic en **"Agregar Deuda"**
2. Completa el formulario:
   - **Descripción**: "Tarjeta de crédito"
   - **Acreedor**: "Banco Popular"
   - **Monto**: "2000000"
   - **Fecha Vencimiento**: Fecha futura
3. Haz clic en **"Agregar"**
4. ✅ Verifica que aparezca en la lista
5. ✅ Verifica que se actualicen las tarjetas de resumen

### 4.3 Verificar Persistencia
1. Recarga la página (F5)
2. ✅ Los datos agregados deben permanecer
3. Cierra sesión e inicia sesión nuevamente
4. ✅ Los datos deben seguir ahí

## 🔍 Paso 5: Verificar en Supabase Dashboard

### 5.1 Ver Datos en la Base de Datos
1. Ve a tu dashboard de Supabase
2. Haz clic en **"Table Editor"**
3. Selecciona la tabla **"ingresos"**
4. ✅ Verifica que veas los ingresos que agregaste
5. Selecciona la tabla **"deudas"**
6. ✅ Verifica que veas las deudas que agregaste

### 5.2 Verificar Seguridad RLS
Los datos deben estar filtrados por usuario. Solo deberías ver:
- Tus propios ingresos
- Tus propias deudas
- No datos de otros usuarios

## 🐛 Solución de Problemas

### Error: "No se pudieron cargar los ingresos"
**Posibles causas:**
1. **Usuario no autenticado**: Verifica que hayas iniciado sesión
2. **RLS policies**: Verifica que las políticas RLS estén configuradas
3. **Variables de entorno**: Verifica la configuración de Supabase

**Solución:**
```sql
-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename IN ('ingresos', 'deudas');
```

### Error: "Usuario no autenticado" al agregar datos
**Posibles causas:**
1. Sesión expirada
2. Configuración incorrecta de Supabase

**Solución:**
1. Cierra sesión y vuelve a iniciar sesión
2. Verifica las variables de entorno
3. Revisa la consola del navegador para errores

### Los datos no se muestran después de agregarlos
**Posibles causas:**
1. Error en la función de actualización del estado
2. Error en la consulta de Supabase

**Solución:**
1. Abre las herramientas de desarrollador (F12)
2. Ve a la pestaña "Console"
3. Busca errores en rojo
4. Haz clic en el botón de recarga (🔄) en la página

### Problemas de conexión con Supabase
**Verificaciones:**
1. ✅ URL de Supabase correcta
2. ✅ Clave anónima correcta
3. ✅ Proyecto activo en Supabase
4. ✅ Sin límites de facturación excedidos

## 📊 Funciones Útiles de Supabase

### Consultar Total de Ingresos de un Usuario
```sql
SELECT get_total_ingresos('USER_ID_AQUI');
```

### Consultar Total de Deudas de un Usuario
```sql
SELECT get_total_deudas('USER_ID_AQUI');
```

### Consultar Balance Neto de un Usuario
```sql
SELECT get_balance_neto('USER_ID_AQUI');
```

### Ver Todos los Ingresos con Detalles
```sql
SELECT 
    i.*,
    p.email as usuario_email
FROM ingresos i
JOIN profiles p ON i.user_id = p.id
WHERE i.es_activo = true
ORDER BY i.created_at DESC;
```

## 🎯 Próximos Pasos

Una vez que todo funcione correctamente, puedes:

1. **Personalizar datos**: Eliminar los datos de ejemplo y agregar tus propios ingresos y deudas reales
2. **Explorar funcionalidades**: Usa los botones de recarga y verifica que todo se sincroniza
3. **Probar en móvil**: La interfaz es responsive y funciona en dispositivos móviles
4. **Integrar con dashboard**: Los datos se pueden usar en otras partes de la aplicación

## 🚀 Funcionalidades Adicionales Disponibles

El sistema incluye funciones avanzadas que puedes aprovechar:

- **Soft delete**: Los registros se marcan como inactivos en lugar de eliminarse
- **Timestamps automáticos**: `created_at` y `updated_at` se manejan automáticamente
- **Validación de datos**: El frontend valida que los campos sean correctos
- **Formateo de moneda**: Automático en pesos colombianos
- **Estados de carga**: Indicadores visuales durante las operaciones
- **Manejo de errores**: Mensajes claros cuando algo falla

¡Tu aplicación de presupuesto ahora tiene gestión completa de ingresos y deudas con Supabase! 🎉 