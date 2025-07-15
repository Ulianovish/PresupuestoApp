# �� Presupuesto 2025 - Aplicación de Gestión Financiera Personal

Una aplicación moderna de gestión de presupuestos desarrollada con Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, y Supabase.

## ✨ Características

- 📊 **Dashboard Interactivo** - Vista general de tu situación financiera
- 💰 **Gestión de Presupuestos** - Crea y administra presupuestos mensuales
- 📝 **Registro de Gastos** - Seguimiento detallado de todos tus gastos
- 💳 **Ingresos y Deudas** - Gestión completa de ingresos y deudas
- 🔐 **Autenticación Segura** - Sistema de login con Supabase Auth
- 📱 **Responsive Design** - Funciona perfectamente en móvil y desktop
- 🎨 **Diseño Moderno** - Interfaz elegante con glassmorphism y gradientes

## 🚀 Deployment y Producción

### 🔥 Deploy Rápido (5 minutos)
El deployment más fácil es con **Vercel**:

1. **📋 Sigue el checklist**: [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md)
2. **📖 Guía completa**: [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)
3. **🪟 Problemas en Windows**: [`WINDOWS_DEPLOYMENT_ISSUES.md`](./WINDOWS_DEPLOYMENT_ISSUES.md)

### 🛠️ Scripts de Deployment

```bash
# Script automático de deployment
./scripts/deploy.sh

# Fix para problemas en Windows
scripts/windows-build-fix.bat
```

### ⚡ Deploy Directo con Vercel CLI
```bash
npm install -g vercel
vercel --prod
```

## 🗄️ Base de Datos

La aplicación usa **Supabase** como backend:
- **PostgreSQL** como base de datos
- **Row Level Security (RLS)** para seguridad
- **Autenticación** integrada
- **Migraciones SQL** incluidas

### Migraciones SQL (ejecutar en orden):
1. `supabase_schema.sql`
2. `supabase_monthly_budget_migration.sql`
3. `supabase_expenses_monthly_migration.sql`
4. `supabase_ingresos_deudas.sql`

## 🔧 Desarrollo Local

### Prerrequisitos
- Node.js 18+
- npm o yarn
- Cuenta en Supabase

### Instalación
```bash
# Clonar repositorio
git clone <your-repo>
cd Presupuesto

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# Ejecutar en desarrollo
npm run dev
```

### Variables de Entorno Requeridas
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🏗️ Tecnologías

### Frontend
- **Next.js 15** - Framework React con App Router
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Styling utility-first
- **shadcn/ui** - Componentes UI modernos
- **Lucide React** - Iconos

### Backend
- **Supabase** - Backend as a Service
- **PostgreSQL** - Base de datos
- **Row Level Security** - Seguridad a nivel de fila

### Herramientas de Desarrollo
- **ESLint** - Linting
- **Prettier** - Formateo de código
- **Husky** - Git hooks
- **TypeScript** - Type checking

## 📁 Estructura del Proyecto

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── auth/              # Páginas de autenticación
│   ├── dashboard/         # Dashboard principal
│   ├── presupuesto/       # Gestión de presupuestos
│   ├── gastos/            # Registro de gastos
│   └── ingresos-deudas/   # Gestión de ingresos y deudas
├── components/            # Componentes React (Atomic Design)
│   ├── atoms/            # Componentes básicos
│   ├── molecules/        # Combinaciones simples
│   ├── organisms/        # Componentes complejos
│   ├── templates/        # Layouts de página
│   └── ui/               # shadcn/ui components
├── lib/                  # Utilidades y configuraciones
├── hooks/                # Custom React hooks
├── types/                # Definiciones TypeScript
└── constants/            # Constantes de la aplicación
```

## 🧪 Testing y Calidad

```bash
# Linting
npm run lint
npm run lint:fix

# Type checking
npm run type-check

# Formateo
npm run format
npm run format:check

# Build de producción
npm run build
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -am 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crea un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para detalles.

## 🆘 Soporte

- **📖 Documentación completa**: Revisa las guías en la carpeta `docs/`
- **🐛 Problemas**: Abre un issue en GitHub
- **💬 Preguntas**: Utiliza las Discussions de GitHub

---

**Desarrollado con ❤️ usando Next.js y Supabase**

¡Listo para hacer deploy! 🚀
