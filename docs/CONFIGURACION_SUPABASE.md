# 🚀 Guía de Configuración de Supabase - Paso a Paso

## ✅ Pasos Completados

- [x] Instalación de dependencias
- [x] Creación de estructura de carpetas
- [x] Configuración de clientes Supabase
- [x] Creación de tipos TypeScript
- [x] Esquemas de validación con Zod
- [x] Script SQL para base de datos

## 📋 Pasos Pendientes

### Paso 1: Crear Proyecto en Supabase

1. **Ir a Supabase**
   - Ve a [https://supabase.com](https://supabase.com)
   - Crea una cuenta o inicia sesión

2. **Crear Nuevo Proyecto**
   - Haz clic en "New project"
   - Organización: Elige tu organización personal
   - **Name**: `presupuesto-app`
   - **Database Password**: (Crea una contraseña segura y guárdala)
   - **Region**: South America (São Paulo) - o el más cercano a ti
   - **Plan**: Free tier está bien para empezar

3. **Esperar a que se Complete**
   - El proyecto tardará unos minutos en crearse
   - Una vez listo, tendrás acceso al dashboard

### Paso 2: Configurar Base de Datos

1. **Ir al Editor SQL**
   - En el dashboard de Supabase, ve a "SQL Editor"
   - Selecciona "New query"

2. **Ejecutar Script SQL**
   - Copia todo el contenido del archivo `supabase_schema.sql` que está en la raíz del proyecto
   - Pégalo en el editor SQL
   - Haz clic en "Run" o presiona Ctrl+Enter

3. **Verificar Creación**
   - Deberías ver el mensaje: "Script de configuración de base de datos ejecutado exitosamente"
   - Ve a "Table Editor" para ver las tablas creadas

### Paso 3: Configurar Variables de Entorno

1. **Obtener Keys de Supabase**
   - Ve a "Settings" → "API"
   - Copia las siguientes keys:
     - `Project URL`
     - `anon public key`
     - `service_role key` (¡Mantén esta secreta!)

2. **Crear archivo .env.local**
   - En la raíz del proyecto, crea un archivo `.env.local`
   - Añade las siguientes variables:

```env
# Configuración de Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_project_url_aquí
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aquí
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aquí

# URL de la aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Clave secreta para NextAuth (genera una aleatoria)
NEXTAUTH_SECRET=tu_clave_secreta_muy_larga_y_aleatoria
NEXTAUTH_URL=http://localhost:3001
```

3. **Actualizar .gitignore**
   - Verifica que `.env.local` esté en tu `.gitignore`
   - Nunca subas las keys al repositorio

### Paso 4: Configurar Autenticación

1. **Habilitar Proveedores de Auth**
   - Ve a "Authentication" → "Providers"
   - Habilita "Email"
   - Opcionalmente, habilita Google, GitHub, etc.

2. **Configurar URL de Redirección**
   - Ve a "Authentication" → "URL Configuration"
   - **Site URL**: `http://localhost:3001`
   - **Redirect URLs**: `http://localhost:3001/auth/callback`

3. **Configurar Email Templates** (Opcional)
   - Ve a "Authentication" → "Email Templates"
   - Personaliza los templates de confirmación y recuperación

### Paso 5: Configurar Políticas RLS

Las políticas RLS ya están configuradas en el script SQL, pero puedes verificar:

1. **Verificar Políticas**
   - Ve a "Authentication" → "Policies"
   - Deberías ver políticas para todas las tablas
   - Cada tabla debe tener políticas para SELECT, INSERT, UPDATE, DELETE

2. **Verificar Usuarios**
   - Ve a "Authentication" → "Users"
   - Aquí aparecerán los usuarios cuando se registren

### Paso 6: Probar la Configuración

1. **Ejecutar el Proyecto**
   ```bash
   npm run dev
   ```

2. **Verificar Conexión**
   - Abre la consola del navegador
   - No deberías ver errores de conexión con Supabase

3. **Probar Autenticación**
   - Intenta registrar un usuario
   - Verifica que aparezca en "Authentication" → "Users"
   - Verifica que se cree automáticamente en la tabla `profiles`

### Paso 7: Añadir Datos de Prueba (Opcional)

1. **Crear Usuario de Prueba**
   - Regístrate en la aplicación
   - Ve a Supabase → "Authentication" → "Users"
   - Copia el UUID del usuario

2. **Añadir Datos de Prueba**
   - Ve a "SQL Editor"
   - Ejecuta el siguiente script (reemplaza `tu_user_uuid` con el UUID real):

```sql
-- Insertar datos de prueba
INSERT INTO budget_items (
  user_id,
  category_id,
  classification_id,
  control_id,
  status_id,
  name,
  description,
  budgeted_amount,
  spent_amount
) VALUES (
  'tu_user_uuid',
  (SELECT id FROM categories WHERE name = 'VIVIENDA' LIMIT 1),
  (SELECT id FROM classifications WHERE name = 'Fijo' LIMIT 1),
  (SELECT id FROM controls WHERE name = 'Necesario' LIMIT 1),
  (SELECT id FROM budget_statuses WHERE name = 'Activo' LIMIT 1),
  'Arriendo',
  'Pago mensual de arriendo',
  1200000.00,
  0.00
);
```

### Paso 8: Configurar Backup y Monitoreo

1. **Configurar Backup**
   - Ve a "Settings" → "Database"
   - Configura backups automáticos
   - Descarga un backup inicial

2. **Configurar Monitoreo**
   - Ve a "Reports"
   - Familiarízate con las métricas
   - Configura alertas si es necesario

## 🔧 Comandos Útiles

```bash
# Instalar CLI de Supabase (opcional)
npm install -g supabase

# Inicializar proyecto local (opcional)
supabase init

# Generar tipos TypeScript actualizados
npx supabase gen types typescript --project-id tu-project-id > src/types/database.ts

# Ejecutar migraciones (para desarrollo avanzado)
supabase db reset
```

## 🚨 Troubleshooting

### Error: "Invalid API Key"
- Verifica que las keys en `.env.local` sean correctas
- Verifica que no tengas espacios extra
- Reinicia el servidor de desarrollo

### Error: "Row Level Security"
- Verifica que las políticas RLS estén habilitadas
- Verifica que el usuario esté autenticado
- Revisa los logs en Supabase Dashboard

### Error: "CORS"
- Verifica que la URL de tu aplicación esté en la configuración de Supabase
- Verifica que uses `http://localhost:3001` en desarrollo

### Error: "Database Connection"
- Verifica que las variables de entorno estén correctas
- Verifica que el proyecto de Supabase esté activo
- Revisa el status de Supabase en su página de estado

## 🎯 Siguientes Pasos

Una vez completada la configuración:

1. **Crear los primeros components de UI**
   - Formularios de login/register
   - Componentes de presupuesto
   - Dashboards básicos

2. **Implementar Server Actions**
   - Acciones para crear/editar elementos
   - Validaciones en el servidor
   - Manejo de errores

3. **Añadir funcionalidad real-time**
   - Actualizaciones en tiempo real
   - Notificaciones
   - Sincronización entre dispositivos

4. **Optimizar y escalar**
   - Implementar caché
   - Optimizar consultas
   - Añadir índices adicionales

## 📞 Soporte

Si tienes problemas:
1. Revisa la documentación oficial de Supabase
2. Revisa los logs en el dashboard de Supabase
3. Verifica que todas las variables de entorno estén correctas
4. Comprueba que el script SQL se ejecutó sin errores

¡Listo! 🎉 Una vez completados estos pasos, tendrás Supabase completamente configurado y listo para usar con tu aplicación de presupuesto. 