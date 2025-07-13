# 💰 Aplicación de Presupuesto Personal

Una aplicación moderna de gestión de presupuestos personales construida con **Next.js 14+**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Supabase** y organizada siguiendo la metodología **Atomic Design**.

## 🎯 Características Principales

- **Gestión de Presupuesto**: Crea y gestiona tu presupuesto mensual con categorías personalizables
- **Seguimiento en Tiempo Real**: Visualiza gastos y restantes con actualizaciones automáticas
- **Análisis Inteligente**: Gráficos interactivos y alertas de límites de presupuesto
- **Diseño Moderno**: Interfaz con glassmorphism, gradientes y micro-interacciones
- **Responsive**: Diseño adaptativo para todos los dispositivos
- **Autenticación Segura**: Sistema de usuarios con Supabase Auth
- **Base de Datos Normalizada**: Datos estructurados con RLS para seguridad

## 🧪 Estructura Atomic Design

### Niveles de Componentes

#### 1. **Atoms** (Átomos)
Componentes básicos y reutilizables:
- `CurrencyInput` - Entrada especializada para valores monetarios
- `Button` - Botón con variantes gradient y glass
- `Card` - Tarjeta con efectos glassmorphism
- `Input` - Campo de entrada base
- `Label` - Etiqueta de formulario

#### 2. **Molecules** (Moléculas)
Combinaciones simples de átomos:
- `FormField` - Campo de formulario con label y validación
- `BudgetItem` - Tarjeta de elemento de presupuesto
- `SearchBox` - Búsqueda con filtros
- `TransactionRow` - Fila de transacción

#### 3. **Organisms** (Organismos)
Componentes complejos con lógica de negocio:
- `BudgetTable` - Tabla completa de presupuesto con filtros y ordenamiento
- `TransactionForm` - Formulario de transacciones
- `DebtSummary` - Resumen de deudas
- `FinancialChart` - Gráficos financieros

#### 4. **Templates** (Plantillas)
Estructuras de página:
- `BudgetPageLayout` - Layout para páginas de presupuesto
- `DashboardLayout` - Layout del dashboard principal
- `DebtPageLayout` - Layout para páginas de deudas

#### 5. **Pages** (Páginas)
Instancias específicas con datos reales:
- `BudgetPage` - Página principal de presupuesto
- `HomePage` - Página de inicio
- `DebtManagementPage` - Página de gestión de deudas

## 🚀 Tecnologías Utilizadas

### Frontend
- **Next.js 14+** - Framework React con App Router
- **TypeScript** - Tipado estático para mayor seguridad
- **Tailwind CSS** - Framework CSS utility-first
- **shadcn/ui** - Biblioteca de componentes UI
- **Lucide React** - Iconos modernos
- **Atomic Design** - Metodología de diseño de componentes

### Backend y Base de Datos
- **Supabase** - Backend-as-a-Service (BaaS)
- **PostgreSQL** - Base de datos relacional
- **Row Level Security (RLS)** - Seguridad a nivel de fila
- **Real-time** - Actualizaciones en tiempo real

### Validación y Formularios
- **Zod** - Validación de esquemas TypeScript
- **React Hook Form** - Gestión de formularios
- **SWR** - Fetching de datos y caché

## 📁 Estructura del Proyecto

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # Estilos globales
│   ├── layout.tsx         # Layout raíz
│   ├── page.tsx           # Página de inicio
│   ├── presupuesto/       # Páginas de presupuesto
│   │   └── page.tsx       # Página principal de presupuesto
│   └── gastos/           # Páginas de gastos
│       └── page.tsx       # Página de gastos
├── components/            # Estructura Atomic Design
│   ├── atoms/            # Componentes básicos
│   │   ├── Button/
│   │   ├── CurrencyInput/
│   │   ├── Card/
│   │   └── ...
│   ├── molecules/        # Combinaciones simples
│   │   ├── FormField/
│   │   ├── BudgetItem/
│   │   └── ...
│   ├── organisms/        # Componentes complejos
│   │   ├── BudgetTable/
│   │   └── ...
│   ├── templates/        # Estructuras de página
│   │   ├── BudgetPageLayout/
│   │   └── ...
│   ├── pages/           # Páginas específicas
│   └── ui/              # Componentes shadcn/ui
├── lib/                 # Utilidades y configuraciones
│   ├── supabase/        # Configuración de Supabase
│   │   ├── client.ts    # Cliente para navegador
│   │   └── server.ts    # Cliente para servidor
│   ├── actions/         # Server Actions
│   ├── validations/     # Esquemas de validación Zod
│   └── utils.ts         # Utilidades generales
├── hooks/               # Custom React hooks
│   └── supabase/        # Hooks específicos de Supabase
├── types/               # Definiciones de TypeScript
│   └── database.ts      # Tipos generados de Supabase
└── utils/               # Funciones utilitarias
```

## 🎨 Sistema de Diseño SIRME

### Principios de Diseño
- **Minimalismo Funcional**: Interfaces limpias priorizando usabilidad
- **Modernidad**: Glassmorphism y micro-interacciones sutiles
- **Accesibilidad**: Cumplimiento WCAG con focus visible y contraste adecuado
- **Responsividad**: Diseño mobile-first con adaptación perfecta
- **Consistencia**: Sistema de componentes atómicos asegurando coherencia visual

### Variantes de Componentes
- **Gradient**: Para acciones primarias (gradiente azul a púrpura)
- **Glass**: Para efectos glassmorphism en fondos oscuros
- **Outline**: Para acciones secundarias
- **Destructive**: Para acciones peligrosas

## 🚀 Instalación y Uso

### Prerrequisitos
- Node.js 18+ 
- npm o yarn
- Cuenta en Supabase

### Instalación

#### 1. Clonar el Repositorio
```bash
git clone <repository-url>
cd presupuesto
```

#### 2. Instalar Dependencias
```bash
npm install
```

#### 3. Configurar Supabase
Sigue la **[Guía de Configuración de Supabase](./CONFIGURACION_SUPABASE.md)** paso a paso.

#### 4. Configurar Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto:

```env
# Configuración de Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_project_url_aquí
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aquí
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aquí

# URL de la aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Clave secreta para NextAuth
NEXTAUTH_SECRET=tu_clave_secreta_muy_larga_y_aleatoria
NEXTAUTH_URL=http://localhost:3001
```

#### 5. Ejecutar la Aplicación
```bash
npm run dev
```

Abre [http://localhost:3001](http://localhost:3001) en tu navegador.

### Scripts Disponibles
```bash
# Desarrollo
npm run dev          # Servidor de desarrollo
npm run build        # Construir para producción
npm run start        # Servidor de producción
npm run lint         # Ejecutar ESLint

# Base de datos
npm run db:types     # Generar tipos TypeScript desde Supabase
npm run db:reset     # Resetear base de datos local
npm run db:migrate   # Ejecutar migraciones
npm run db:seed      # Llenar con datos de prueba

# Supabase (requiere CLI)
npm run supabase:start   # Iniciar Supabase local
npm run supabase:stop    # Detener Supabase local
npm run supabase:status  # Estado de Supabase
```

## 🧪 Testing

```bash
# Ejecutar tests unitarios
npm run test

# Ejecutar tests de integración
npm run test:integration

# Ejecutar tests end-to-end
npm run test:e2e
```

## 📊 Funcionalidades

### Gestión de Presupuesto
- ✅ Crear categorías de presupuesto personalizadas
- ✅ Establecer montos mensuales por categoría
- ✅ Seguimiento de gastos en tiempo real
- ✅ Alertas de límites de presupuesto
- ✅ Filtros y ordenamiento avanzados
- ✅ Plantillas de presupuesto reutilizables

### Análisis y Reportes
- ✅ Gráficos de gastos por categoría
- ✅ Progreso de metas financieras
- ✅ Historial de transacciones
- ✅ Exportación de reportes
- ✅ Análisis por clasificación (Fijo, Variable, Discrecional)
- ✅ Análisis por control (Necesario, Discrecional)

### Gestión de Deudas
- ✅ Registro de deudas
- ✅ Planes de pago
- ✅ Seguimiento de amortización
- ✅ Alertas de vencimientos

### Seguridad y Usuarios
- ✅ Autenticación con Supabase Auth
- ✅ Perfiles de usuario personalizados
- ✅ Seguridad a nivel de fila (RLS)
- ✅ Validación en cliente y servidor
- ✅ Datos privados por usuario

### Tiempo Real
- ✅ Actualizaciones automáticas
- ✅ Sincronización entre dispositivos
- ✅ Notificaciones en tiempo real

## 🏗️ Arquitectura de la Aplicación

### Enfoque Híbrido Supabase
La aplicación utiliza un enfoque híbrido que combina:
- **Lectura (RLS)**: Datos leídos directamente desde el cliente con Row Level Security
- **Escritura (Server Actions)**: Operaciones de escritura a través de Server Actions con validación
- **Tiempo Real**: Actualizaciones automáticas con Supabase Realtime

### Base de Datos Normalizada
- **5 Tablas de Lookup**: Estados, clasificaciones, controles, tipos de transacción, monedas
- **8 Tablas Principales**: Perfiles, categorías, plantillas, elementos, transacciones, etc.
- **Índices Optimizados**: Para consultas rápidas y eficientes
- **Políticas RLS**: Seguridad a nivel de fila para cada usuario

### Flujo de Datos
```
Cliente → SWR → Supabase Client → RLS → PostgreSQL (Lectura)
Cliente → Server Action → Zod Validation → Supabase Server → PostgreSQL (Escritura)
PostgreSQL → Supabase Realtime → Cliente (Tiempo Real)
```

## 🔧 Configuración Avanzada

### Variables de Entorno Completas
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_project_url_aquí
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aquí
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aquí

# App
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=Presupuesto Personal

# Auth
NEXTAUTH_SECRET=tu_clave_secreta_muy_larga_y_aleatoria
NEXTAUTH_URL=http://localhost:3001

# Desarrollo
NODE_ENV=development
```

### Personalización de Tema
Los colores y estilos se pueden personalizar en:
- `src/app/globals.css` - Variables CSS globales y tema oscuro
- `tailwind.config.js` - Configuración de Tailwind
- `components.json` - Configuración de shadcn/ui
- `src/lib/validations/schemas.ts` - Colores para categorías y estados

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📚 Documentación y Recursos

### Guías y Documentación
- **[Guía de Configuración de Supabase](./CONFIGURACION_SUPABASE.md)** - Configuración completa paso a paso
- **[Documentación de Supabase](https://supabase.com/docs)** - Documentación oficial de Supabase
- **[Atomic Design](./design-system.md)** - Arquitectura de componentes
- **[shadcn/ui](https://ui.shadcn.com/)** - Documentación de componentes UI

### Recursos Útiles
- **[Next.js 14 Documentation](https://nextjs.org/docs)** - Documentación oficial de Next.js
- **[Tailwind CSS](https://tailwindcss.com/docs)** - Documentación de Tailwind
- **[Zod](https://zod.dev/)** - Validación de esquemas TypeScript
- **[React Hook Form](https://react-hook-form.com/)** - Gestión de formularios
- **[SWR](https://swr.vercel.app/)** - Fetching de datos

### Comandos de Desarrollo
```bash
# Generar tipos desde Supabase
npm run db:types

# Resetear base de datos (desarrollo)
npm run db:reset

# Ver estado de Supabase
npm run supabase:status

# Construir para producción
npm run build
```

## 🆘 Soporte

Si tienes preguntas o necesitas ayuda:
1. **Revisa la [Guía de Configuración](./CONFIGURACION_SUPABASE.md)** - Soluciona problemas comunes
2. **Consulta la documentación** - Enlaces arriba
3. **Abre un issue en GitHub** - Para reportar bugs
4. **Revisa los logs** - En el dashboard de Supabase

## 🔍 Troubleshooting

### Problemas Comunes
- **Error de conexión**: Verifica las variables de entorno
- **RLS Policy**: Verifica que el usuario esté autenticado
- **Tipos TypeScript**: Regenera los tipos con `npm run db:types`
- **CORS**: Verifica la configuración de URLs en Supabase

---

**Desarrollado con ❤️ usando Next.js, Supabase, shadcn/ui y Atomic Design**
