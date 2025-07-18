# ✅ Checklist de Deployment - Presupuesto 2025

Este checklist te guía paso a paso para hacer el deployment de tu aplicación.

## 🚀 Opción Rápida - Deploy con Vercel (Recomendado)

### ✅ Pre-requisitos
- [x] Cuenta en [GitHub](https://github.com)
- [x] Cuenta en [Vercel](https://vercel.com)
- [x] Cuenta en [Supabase](https://supabase.com)
- [x] Código commiteado en GitHub

### ✅ Configuración de Supabase (5 min)

1. **Crear proyecto en Supabase:**
   - [x] Ve a [supabase.com](https://supabase.com)
   - [x] Crear nuevo proyecto
   - [ ] Anota la **Project URL** y **Anon Key**

2. **Ejecutar migraciones SQL:**
   - [x] Ve al **SQL Editor** en Supabase
   - [x] Ejecuta en orden: `supabase_schema.sql`
   - [x] Ejecuta: `supabase_monthly_budget_migration.sql`
   - [x] Ejecuta: `supabase_expenses_monthly_migration.sql`
   - [x] Ejecuta: `supabase_ingresos_deudas.sql`

3. **Configurar autenticación:**
   - [ ] Ve a **Authentication > Settings**
   - [ ] Habilita **Email confirmation**
   - [ ] Configura **Site URL**: `https://tu-app.vercel.app`

### ✅ Deploy en Vercel (3 min)

1. **Conectar repositorio:**
   - [x] Ve a [vercel.com](https://vercel.com)
   - [x] Click "Import Project"
   - [x] Conecta tu repositorio GitHub

2. **Configurar variables de entorno:**
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = tu-clave-anon
   NODE_ENV = production
   ```

3. **Deploy:**
   - [ ] Click "Deploy"
   - [ ] Esperar build (2-3 min)
   - [ ] ¡Listo! 🎉

### ✅ Testing (2 min)
- [ ] Abrir la URL de Vercel
- [ ] Probar registro de usuario
- [ ] Probar login
- [ ] Crear un presupuesto
- [ ] Verificar responsive en móvil

---

## 🔧 Opción Manual - Deploy paso a paso

### ✅ Preparación Local

1. **Verificar código:**
   ```bash
   # Verificar que no hay errores
   npm run lint
   npm run type-check
   npm run build
   ```
   - [ ] ESLint pasa sin errores
   - [ ] TypeScript pasa sin errores  
   - [ ] Build exitoso

2. **Commitear cambios:**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```
   - [ ] Código en GitHub actualizado

### ✅ Configuración de Base de Datos

1. **Supabase setup:**
   - [ ] Proyecto creado en Supabase
   - [ ] Migraciones SQL ejecutadas
   - [ ] RLS policies configuradas
   - [ ] URL y keys copiadas

### ✅ Deploy Automático con Script

```bash
# Ejecutar script de deployment
./scripts/deploy.sh
```

El script te guiará por:
- [ ] Pre-deployment checks
- [ ] Selección de plataforma
- [ ] Deploy automático
- [ ] Post-deployment tests

### ✅ Deploy Manual - Vercel CLI

1. **Instalar Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Primer deploy:**
   ```bash
   vercel
   # Seguir instrucciones del CLI
   ```

3. **Deploy a producción:**
   ```bash
   vercel --prod
   ```

### ✅ Deploy Manual - Netlify

1. **Instalar Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Build y deploy:**
   ```bash
   npm run build
   netlify deploy --prod --dir=.next
   ```

---

## 🌍 Configuración Avanzada

### ✅ Dominio Personalizado (Opcional)

**Para Vercel:**
- [ ] Comprar dominio (GoDaddy, Namecheap, etc.)
- [ ] Ir a Project Settings > Domains en Vercel
- [ ] Agregar dominio
- [ ] Configurar DNS records según instrucciones

**Para Netlify:**
- [ ] Ir a Site Settings > Domain management
- [ ] Agregar dominio custom
- [ ] Configurar DNS

### ✅ Analytics y Monitoring (Opcional)

1. **Google Analytics:**
   - [ ] Crear propiedad en GA4
   - [ ] Agregar `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` en variables de entorno
   - [ ] Verificar tracking

2. **Vercel Analytics:**
   ```bash
   npm install @vercel/analytics
   ```
   - [ ] Implementar en layout.tsx
   - [ ] Verificar métricas

### ✅ Configuración de Seguridad

1. **Variables de entorno:**
   - [ ] Todas las keys están en variables de entorno
   - [ ] No hay credenciales hardcodeadas
   - [ ] Variables de producción diferentes a desarrollo

2. **Supabase security:**
   - [ ] RLS habilitado en todas las tablas
   - [ ] Políticas configuradas correctamente
   - [ ] CORS configurado con tu dominio

3. **Headers de seguridad:**
   - [ ] Headers configurados en `next.config.ts`
   - [ ] HTTPS forzado
   - [ ] CSP configurado (opcional)

---

## 🆘 Troubleshooting

### ❌ Problemas Comunes

**Build falla:**
- [ ] Verificar TypeScript errors: `npm run type-check`
- [ ] Verificar ESLint errors: `npm run lint`
- [ ] Verificar variables de entorno
- [ ] Revisar imports/exports

**Supabase no conecta:**
- [ ] Verificar URL y keys
- [ ] Verificar CORS en Supabase
- [ ] Verificar que las tablas existen
- [ ] Verificar RLS policies

**404 en rutas:**
- [ ] Verificar que los archivos page.tsx existen
- [ ] Verificar next.config.ts
- [ ] Verificar middleware.ts

**Authentication no funciona:**
- [ ] Verificar Site URL en Supabase
- [ ] Verificar email templates
- [ ] Verificar redirect URLs

### 🔍 Debug Tips

```bash
# Ver logs de Vercel
vercel logs

# Debug build local
npm run build 2>&1 | tee build.log

# Verificar variables de entorno
echo $NEXT_PUBLIC_SUPABASE_URL
```

---

## 🎯 Métricas de Éxito

### ✅ Performance Targets
- [ ] **Lighthouse Score** > 90
- [ ] **First Contentful Paint** < 2s
- [ ] **Largest Contentful Paint** < 2.5s
- [ ] **Cumulative Layout Shift** < 0.1

### ✅ Funcionalidad
- [ ] **Auth flow** funcionando
- [ ] **CRUD operations** funcionando
- [ ] **Responsive design** en móvil
- [ ] **Error handling** apropiado

### ✅ Testing en Diferentes Dispositivos
- [ ] **Desktop** (Chrome, Firefox, Safari)
- [ ] **Mobile** (iOS Safari, Android Chrome)
- [ ] **Tablet** (iPad, Android tablet)

---

## 📚 Recursos de Ayuda

- [Documentación Next.js Deployment](https://nextjs.org/docs/deployment)
- [Guía Vercel](https://vercel.com/docs)
- [Documentación Supabase](https://supabase.com/docs)
- [Troubleshooting Next.js](https://nextjs.org/docs/messages)

---

**¿Necesitas ayuda?** 
- Revisa los logs de error específicos
- Consulta la documentación oficial
- Busca en Stack Overflow con el error específico
- Pregunta en Discord de Next.js o Vercel

🚀 **¡Listo para el deploy!**