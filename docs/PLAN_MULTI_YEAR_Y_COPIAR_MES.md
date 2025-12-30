# Plan de Implementación: Multi-Año y Copiar Mes Anterior

**Fecha**: 30 de diciembre de 2025
**Estado**: 📝 Planificado
**Prioridad**: Alta (necesario para 2026)

---

## 🎯 Objetivos

### 1. **Selector de Año en el Avatar**
- Permitir al usuario seleccionar el año actual (2025, 2026, 2027, etc.)
- El selector debe estar integrado en el menú del avatar/usuario
- Debe persistir la selección en localStorage
- Cambiar el año debe actualizar automáticamente los meses disponibles

### 2. **Copiar Mes Anterior**
- Botón/opción para copiar todos los items de presupuesto del mes anterior
- Debe copiar: categorías, items, montos presupuestados
- NO debe copiar: montos reales (spent_amount, real_amount)
- Debe estar disponible cuando se crea un nuevo presupuesto mensual

---

## 📋 Análisis de Arquitectura Actual

### Estado Actual
- El `MonthContext` maneja solo `selectedMonth` en formato `YYYY-MM`
- Los servicios esperan `month_year` en formato `YYYY-MM`
- La tabla `budget_templates` tiene campo `month_year` como VARCHAR
- El selector de meses está hardcodeado para 2025

### Limitaciones Identificadas
1. ❌ No hay concepto de "año seleccionado" separado
2. ❌ Los meses están hardcodeados en `getAvailableMonths()` solo para 2025
3. ❌ No hay funcionalidad para copiar presupuestos
4. ❌ La base de datos no tiene constraints para prevenir duplicados por mes

---

## 🏗️ Arquitectura Propuesta

### Opción 1: Ampliar MonthContext con Año (Recomendada)

**Ventajas:**
- Consistente con el patrón actual
- El contexto ya maneja la selección temporal
- Cambios mínimos en componentes existentes

**Estructura:**
```typescript
interface MonthContextType {
  selectedMonth: string;     // "2025-01"
  selectedYear: number;      // 2025
  setSelectedMonth: (month: string) => void;
  setSelectedYear: (year: number) => void;
  getAvailableYears: () => number[];
  getAvailableMonths: () => Array<{ value: string; label: string }>;
  getCurrentMonth: () => string;
}
```

### Opción 2: Contexto Separado para Año

**Ventajas:**
- Separación de concerns
- Más flexible para futuras extensiones

**Desventajas:**
- Más complejidad
- Dos contextos para gestionar

---

## 📝 Plan de Implementación Detallado

### Fase 1: Actualizar MonthContext ✅ Recomendada

#### 1.1 Ampliar el Contexto
```typescript
// src/contexts/MonthContext.tsx

export function MonthProvider({ children }: MonthProviderProps) {
  // Estado del año seleccionado
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedYear');
      return saved ? parseInt(saved) : new Date().getFullYear();
    }
    return new Date().getFullYear();
  });

  // selectedMonth se deriva del año
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedMonth = localStorage.getItem('selectedMonth');
      if (savedMonth) {
        // Validar que el mes pertenezca al año seleccionado
        const year = savedMonth.split('-')[0];
        if (parseInt(year) === selectedYear) {
          return savedMonth;
        }
      }
    }
    // Default: mes actual del año seleccionado
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${selectedYear}-${month}`;
  });

  // Persistir año en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedYear', selectedYear.toString());
    }
  }, [selectedYear]);

  // Función para cambiar año
  const handleSetSelectedYear = useCallback((year: number) => {
    setSelectedYear(year);
    // Ajustar el mes seleccionado al nuevo año
    const currentMonth = selectedMonth.split('-')[1];
    setSelectedMonth(`${year}-${currentMonth}`);
  }, [selectedMonth]);

  // Obtener años disponibles (ej: 2024-2030)
  const getAvailableYears = useCallback((): number[] => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let year = 2024; year <= currentYear + 3; year++) {
      years.push(year);
    }
    return years;
  }, []);

  // Obtener meses del año seleccionado
  const getAvailableMonths = useCallback((): Array<{ value: string; label: string }> => {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return monthNames.map((name, index) => {
      const month = String(index + 1).padStart(2, '0');
      return {
        value: `${selectedYear}-${month}`,
        label: `${name} ${selectedYear}`
      };
    });
  }, [selectedYear]);

  return (
    <MonthContext.Provider value={{
      selectedMonth,
      selectedYear,
      setSelectedMonth,
      setSelectedYear: handleSetSelectedYear,
      getAvailableYears,
      getAvailableMonths,
      getCurrentMonth,
    }}>
      {children}
    </MonthContext.Provider>
  );
}
```

#### 1.2 Actualizar servicios
```typescript
// src/lib/services/budget.ts

// Eliminar getAvailableMonths() hardcodeado
// El contexto ahora proporciona esta función
```

### Fase 2: Componente Selector de Año en Header

#### 2.1 Ubicación del Selector
El selector de año debe estar en el menú dropdown del avatar/usuario, junto con las opciones existentes.

**Archivo a modificar:**
- `src/components/organisms/Header/Header.tsx` (o donde esté el avatar dropdown)

#### 2.2 UI Propuesta
```
┌──────────────────────────────┐
│  👤 miguelulianovish        │
│  migueuli@gmail.com          │
├──────────────────────────────┤
│  📅 Año: [2025 ▼]           │  ← NUEVO
├──────────────────────────────┤
│  🔄 Actualizar               │
│  🚪 Cerrar Sesión            │
└──────────────────────────────┘
```

#### 2.3 Implementación
```typescript
// Dentro del dropdown del usuario
<div className="px-3 py-2">
  <label className="text-sm text-gray-400">Año</label>
  <select
    value={selectedYear}
    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
    className="w-full mt-1 bg-slate-700 border-slate-600 rounded text-white"
  >
    {getAvailableYears().map(year => (
      <option key={year} value={year}>{year}</option>
    ))}
  </select>
</div>
```

### Fase 3: Funcionalidad Copiar Mes Anterior

#### 3.1 Nuevo Servicio en Backend

**Archivo:** `src/lib/services/budget.ts`

```typescript
export interface CopyMonthOptions {
  sourceMonthYear: string;  // "2025-12"
  targetMonthYear: string;  // "2026-01"
}

export async function copyBudgetFromPreviousMonth(
  options: CopyMonthOptions
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    // 1. Obtener presupuesto del mes anterior
    const sourceBudget = await getBudgetByMonth(options.sourceMonthYear);

    if (!sourceBudget || sourceBudget.categories.length === 0) {
      throw new Error('No hay datos en el mes origen para copiar');
    }

    // 2. Crear template para el nuevo mes
    const templateId = await createMonthlyBudget(
      options.targetMonthYear,
      `Presupuesto ${options.targetMonthYear} (copiado)`
    );

    if (!templateId) {
      throw new Error('Error creando template del nuevo mes');
    }

    // 3. Copiar cada item (sin montos reales)
    const copyPromises = sourceBudget.categories.flatMap(category =>
      category.items.map(item =>
        createBudgetItem(templateId, category.id, {
          descripcion: item.descripcion,
          fecha: item.fecha.replace(
            options.sourceMonthYear,
            options.targetMonthYear
          ), // Ajustar año
          clasificacion: item.clasificacion,
          control: item.control,
          presupuestado: item.presupuestado,
          real: 0, // ⭐ NO copiar montos reales
        })
      )
    );

    await Promise.all(copyPromises);
    return true;
  } catch (error) {
    console.error('Error copiando presupuesto:', error);
    return false;
  }
}

// Función helper para obtener el mes anterior
export function getPreviousMonth(monthYear: string): string {
  const [year, month] = monthYear.split('-').map(Number);

  if (month === 1) {
    // Enero -> Diciembre del año anterior
    return `${year - 1}-12`;
  }

  return `${year}-${String(month - 1).padStart(2, '0')}`;
}
```

#### 3.2 UI para Copiar Mes

**Opción A: Modal de Confirmación**
Cuando el usuario intenta crear un presupuesto para un mes nuevo, mostrar:

```
┌────────────────────────────────────┐
│  Crear Presupuesto Enero 2026      │
├────────────────────────────────────┤
│  ¿Copiar datos del mes anterior?   │
│                                    │
│  Se copiará el presupuesto de:     │
│  Diciembre 2025                    │
│                                    │
│  ⚠️ Solo se copiarán los montos    │
│  presupuestados, no los reales     │
│                                    │
│  [Crear Vacío]  [Copiar y Crear]  │
└────────────────────────────────────┘
```

**Opción B: Botón en BudgetStatusPanels**
Cuando no hay datos para el mes:

```typescript
// src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.tsx

<div className="flex gap-3">
  <Button onClick={() => onCreateBudget(selectedMonth)}>
    Crear Presupuesto Vacío
  </Button>

  <Button
    variant="outline"
    onClick={async () => {
      const previousMonth = getPreviousMonth(selectedMonth);
      const success = await copyBudgetFromPreviousMonth({
        sourceMonthYear: previousMonth,
        targetMonthYear: selectedMonth,
      });

      if (success) {
        toast.success('Presupuesto copiado exitosamente');
        onRefresh();
      } else {
        toast.error('Error al copiar presupuesto');
      }
    }}
  >
    📋 Copiar del mes anterior
  </Button>
</div>
```

### Fase 4: Migraciones de Base de Datos (Opcional pero Recomendado)

#### 4.1 Agregar Constraint Único
```sql
-- supabase/migrations/add_unique_constraint_budget_templates.sql

-- Evitar duplicados de template por mes y usuario
ALTER TABLE budget_templates
ADD CONSTRAINT unique_user_month_year
UNIQUE (user_id, month_year);
```

#### 4.2 Índices para Performance
```sql
-- Optimizar búsquedas por month_year
CREATE INDEX idx_budget_templates_month_year
ON budget_templates(month_year);

CREATE INDEX idx_budget_items_template_id
ON budget_items(template_id);
```

---

## 🧪 Testing Plan

### Casos de Prueba

1. **Cambio de Año**
   - ✅ Seleccionar año 2026
   - ✅ Verificar que los meses se actualicen (Enero 2026 - Diciembre 2026)
   - ✅ Persistencia en localStorage
   - ✅ Datos se cargan correctamente del nuevo año

2. **Copiar Mes Anterior**
   - ✅ Copiar de Diciembre 2025 a Enero 2026
   - ✅ Verificar que solo se copien montos presupuestados
   - ✅ Verificar que las fechas se ajusten al nuevo mes
   - ✅ Verificar que todas las categorías e items se copien

3. **Edge Cases**
   - ✅ Copiar cuando no hay datos del mes anterior
   - ✅ Cambiar de año y volver (navegación)
   - ✅ Crear múltiples meses del mismo año

---

## 📦 Archivos a Modificar

### Contextos
- ✏️ `src/contexts/MonthContext.tsx` - Ampliar con año

### Servicios
- ✏️ `src/lib/services/budget.ts` - Agregar `copyBudgetFromPreviousMonth`
- ✏️ `src/lib/services/budget.ts` - Eliminar `getAvailableMonths` hardcodeado

### Componentes
- ✏️ `src/components/organisms/Header/Header.tsx` - Agregar selector de año
- ✏️ `src/components/organisms/BudgetHeader/BudgetHeader.tsx` - Usar meses del contexto
- ✏️ `src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.tsx` - Botón copiar mes
- ✏️ `src/app/presupuesto/page.tsx` - Actualizar para usar nuevo contexto

### Hooks
- ✏️ `src/hooks/useMonthlyBudget.ts` - Sin cambios (ya usa monthYear del contexto)

### Base de Datos (Opcional)
- 📄 `supabase/migrations/add_unique_constraint_budget_templates.sql` - Nueva migración

---

## 🚀 Orden de Implementación Sugerido

### Sprint 1: Multi-Año (2-3 horas)
1. ✅ Actualizar `MonthContext` con selectedYear
2. ✅ Agregar selector de año en Header
3. ✅ Actualizar componentes que usan `getAvailableMonths()`
4. ✅ Testing de cambio de año

### Sprint 2: Copiar Mes Anterior (2-3 horas)
1. ✅ Implementar servicio `copyBudgetFromPreviousMonth`
2. ✅ Agregar UI (botón/modal) para copiar
3. ✅ Integrar con BudgetStatusPanels
4. ✅ Testing de copia de presupuesto

### Sprint 3: Refinamiento (1 hora)
1. ✅ Agregar migraciones de BD (constraints)
2. ✅ Mejorar UX (loading states, toast notifications)
3. ✅ Testing completo end-to-end

---

## ⚠️ Consideraciones Importantes

### Performance
- Al cambiar de año, se cargarán datos de un mes que puede no existir todavía
- Considerar agregar cach con SWR para evitar requests duplicados

### UX
- Mostrar indicador visual cuando no hay datos para un mes
- Confirmación antes de copiar (no se puede deshacer fácilmente)
- Mensaje claro de qué se está copiando y qué no

### Seguridad
- Validar que el usuario solo pueda copiar SUS propios presupuestos
- RLS policies en Supabase ya cubren esto, pero validar en frontend también

### Datos
- ¿Qué pasa con las facturas electrónicas? (NO copiar)
- ¿Qué pasa con las transacciones? (NO copiar)
- Solo copiar estructura de presupuesto (templates e items)

---

## 📚 Referencias

- [MonthContext actual](src/contexts/MonthContext.tsx)
- [Servicio de Budget](src/lib/services/budget.ts)
- [useMonthlyBudget Hook](src/hooks/useMonthlyBudget.ts)
- [BudgetStatusPanels](src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.tsx)

---

**Siguiente Paso Sugerido**: Comenzar con Sprint 1 - Multi-Año

¿Deseas que proceda con la implementación del Sprint 1 (Multi-Año)?
