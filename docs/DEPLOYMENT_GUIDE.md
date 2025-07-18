# 🚀 Guía de Deployment - Aplicación de Presupuestos 2025

Esta guía te ayudará a hacer deploy de tu aplicación Next.js con Supabase en producción.

## 📋 Variables de Entorno Requeridas

Crea un archivo `.env.local` (para desarrollo) y configura estas variables en tu plataforma de hosting:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# App Configuration  
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production

# Optional: Analytics
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=your_ga_id
```

## 🗄️ Configuración de Supabase

### 1. Crear Proyecto en Supabase
```bash
# 1. Ve a https://supabase.com y crea un nuevo proyecto
# 2. Anota la URL y la clave anónima del proyecto
# 3. Ejecuta las migraciones SQL en el editor SQL de Supabase
```

### 2. Ejecutar Migraciones
Ejecuta estos archivos SQL en el orden indicado en el editor SQL de Supabase:

1. `supabase_schema.sql`
2. `supabase_monthly_budget_migration.sql`  
3. `supabase_expenses_monthly_migration.sql`
4. `supabase_ingresos_deudas.sql`

### 3. Configurar Políticas RLS (Row Level Security)
```sql
-- Habilitar RLS en todas las tablas principales
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE deudas ENABLE ROW LEVEL SECURITY;

-- Políticas básicas para usuarios autenticados
CREATE POLICY "Users can read own data" ON monthly_budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own data" ON monthly_budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own data" ON monthly_budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own data" ON monthly_budgets FOR DELETE USING (auth.uid() = user_id);
```

## 🌐 Opciones de Hosting

### Opción 1: Vercel (Recomendado)

**Ventajas:**
- Optimizado para Next.js
- Deploy automático desde GitHub
- Edge functions integradas
- SSL automático

**Pasos:**
1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Deploy automático

### Opción 2: Netlify

**Ventajas:**
- Fácil configuración
- Formularios integrados
- Edge functions

**Pasos:**
1. Conecta tu repositorio a Netlify
2. Configura el build command: `npm run build`
3. Configura las variables de entorno

### Opción 3: Railway

**Ventajas:**
- Económico
- PostgreSQL incluido
- Deployments desde GitHub

## 🔧 Configuración de Next.js para Producción

Actualizar `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimizaciones para producción
  poweredByHeader: false,
  compress: true,
  
  // Configuración de imágenes
  images: {
    domains: ['your-domain.com'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
```

## 📱 Deploy en Vercel (Paso a Paso)

### 1. Preparar el Repositorio
```bash
# Asegúrate de que todo esté commiteado
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Configurar Vercel
1. Ve a [vercel.com](https://vercel.com)
2. Conecta tu cuenta de GitHub
3. Importa tu repositorio
4. Configura las variables de entorno

### 3. Variables de Entorno en Vercel
```
NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
NEXT_PUBLIC_APP_URL = https://your-vercel-app.vercel.app
NODE_ENV = production
```

### 4. Deploy
- Vercel detectará automáticamente que es un proyecto Next.js
- Build command: `npm run build`
- Output directory: `.next`

## 🚀 Deploy en Netlify (Paso a Paso)

### 1. Configurar Build Settings
```bash
# Build command
npm run build

# Publish directory  
.next

# Functions directory (si usas)
netlify/functions
```

### 2. Archivo `netlify.toml`
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

## 🔒 Configuración de Seguridad

### 1. CORS en Supabase
Configura CORS en tu proyecto Supabase:
```
https://your-domain.com
https://your-vercel-app.vercel.app
```

### 2. Variables de Entorno Seguras
- Nunca hardcodees credenciales
- Usa variables de entorno para todo
- Regenera claves para producción

## 🧪 Testing en Producción

### 1. Checklist de Testing
- [ ] Autenticación funciona
- [ ] CRUD operations funcionan
- [ ] Rutas protegidas funcionan
- [ ] Responsive design
- [ ] Performance (Core Web Vitals)
- [ ] SEO básico

### 2. Herramientas de Monitoring
```bash
# Google PageSpeed Insights
https://pagespeed.web.dev/

# Lighthouse CI
npm install -g @lhci/cli
```

## 🌍 Dominio Personalizado

### Vercel
1. Compra un dominio
2. Ve a Project Settings > Domains
3. Agrega tu dominio
4. Configura DNS records

### Netlify
1. Ve a Site Settings > Domain management
2. Agrega tu dominio custom
3. Configura DNS

## 📊 Analytics y Monitoring

### Google Analytics
```typescript
// src/lib/analytics.ts
export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

export const gtag = (...args: any[]) => {
  (window as any).gtag(...args);
};
```

### Vercel Analytics
```bash
npm install @vercel/analytics
```

## 🔄 CI/CD Pipeline

### GitHub Actions para Testing
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run build
```

## 🆘 Troubleshooting

### Errores Comunes

1. **Build Failures**
   - Verificar TypeScript errors
   - Revisar variables de entorno
   - Verificar dependencies

2. **Supabase Connection Issues**
   - Verificar URLs y keys
   - Revisar CORS settings
   - Verificar RLS policies

3. **Performance Issues**
   - Optimizar imágenes
   - Implementar lazy loading
   - Revisar bundle size

### Logs y Debugging
```bash
# Vercel logs
vercel logs

# Build logs locales
npm run build 2>&1 | tee build.log
```

## 📚 Recursos Adicionales

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Netlify Deployment Guide](https://docs.netlify.com/)

---

¡Listo para hacer deploy! 🚀