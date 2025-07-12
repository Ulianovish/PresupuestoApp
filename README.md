# Presupuesto 2025 - Aplicación de Gestión de Presupuesto

Una aplicación moderna de gestión de presupuesto construida con **Next.js 14+**, **TypeScript**, **Tailwind CSS**, **shadcn/ui** y organizada siguiendo la metodología **Atomic Design**.

## 🎯 Características Principales

- **Gestión de Presupuesto**: Crea y gestiona tu presupuesto mensual con categorías personalizables
- **Seguimiento en Tiempo Real**: Visualiza gastos y restantes con actualizaciones automáticas
- **Análisis Inteligente**: Gráficos interactivos y alertas de límites de presupuesto
- **Diseño Moderno**: Interfaz con glassmorphism, gradientes y micro-interacciones
- **Responsive**: Diseño adaptativo para todos los dispositivos

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

- **Next.js 14+** - Framework React con App Router
- **TypeScript** - Tipado estático para mayor seguridad
- **Tailwind CSS** - Framework CSS utility-first
- **shadcn/ui** - Biblioteca de componentes UI
- **Lucide React** - Iconos modernos
- **Atomic Design** - Metodología de diseño de componentes

## 📁 Estructura del Proyecto

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # Estilos globales
│   ├── layout.tsx         # Layout raíz
│   ├── page.tsx           # Página de inicio
│   └── presupuesto/       # Páginas de presupuesto
│       └── page.tsx       # Página principal de presupuesto
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
└── types/               # Definiciones de TypeScript
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

### Instalación
```bash
# Clonar el repositorio
git clone <repository-url>
cd presupuesto

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev
```

### Scripts Disponibles
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Construir para producción
npm run start        # Servidor de producción
npm run lint         # Ejecutar ESLint
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
- ✅ Crear categorías de presupuesto
- ✅ Establecer montos mensuales
- ✅ Seguimiento de gastos en tiempo real
- ✅ Alertas de límites de presupuesto
- ✅ Filtros y ordenamiento

### Análisis y Reportes
- ✅ Gráficos de gastos por categoría
- ✅ Progreso de metas financieras
- ✅ Historial de transacciones
- ✅ Exportación de reportes

### Gestión de Deudas
- ✅ Registro de deudas
- ✅ Planes de pago
- ✅ Seguimiento de amortización
- ✅ Alertas de vencimientos

## 🔧 Configuración Avanzada

### Variables de Entorno
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=Presupuesto 2025
```

### Personalización de Tema
Los colores y estilos se pueden personalizar en:
- `src/app/globals.css` - Variables CSS globales
- `tailwind.config.js` - Configuración de Tailwind
- `components.json` - Configuración de shadcn/ui

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Si tienes preguntas o necesitas ayuda:
- Abre un issue en GitHub
- Revisa la documentación en `/docs`
- Contacta al equipo de desarrollo

---

**Desarrollado con ❤️ usando Next.js, shadcn/ui y Atomic Design**
