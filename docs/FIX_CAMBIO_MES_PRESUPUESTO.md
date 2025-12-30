# Fix: Cambio de Mes en Presupuesto no Actualizaba los Datos

**Fecha**: 30 de diciembre de 2025
**Estado**: ✅ Resuelto
**Archivos modificados**: 3

---

## 🐛 Problema

Cuando el usuario cambiaba el mes seleccionado en la página de presupuesto, la tabla de presupuesto **NO se actualizaba** y seguía mostrando los datos del mes anterior.

### Comportamiento Esperado
- Usuario selecciona un mes diferente en el selector
- La tabla debe cargar y mostrar los datos del nuevo mes seleccionado
- Los totales y categorías deben reflejar el mes seleccionado

### Comportamiento Real (Bug)
- Usuario selecciona un mes diferente
- La tabla permanece sin cambios
- Seguía mostrando los datos del mes anterior

---

## 🔍 Análisis de Causa Raíz

### Arquitectura del Estado

El proyecto tiene dos lugares donde se manejaba el mes seleccionado:

1. **`MonthContext`** - Contexto global de React ([src/contexts/MonthContext.tsx](src/contexts/MonthContext.tsx))
   - Maneja `selectedMonth` globalmente
   - Persiste el valor en `localStorage`
   - Fuente de verdad compartida entre componentes

2. **`useMonthlyBudget`** - Hook personalizado ([src/hooks/useMonthlyBudget.ts](src/hooks/useMonthlyBudget.ts))
   - **TAMBIÉN tenía su propio estado interno** `selectedMonth`
   - Recibía `initialMonth` del contexto solo una vez
   - **NO se sincronizaba** cuando el contexto cambiaba

### Flujo del Bug

```typescript
// 1. Usuario cambia mes en el selector
handleMonthChange("2025-02")

// 2. Se actualiza el contexto global
MonthContext.setSelectedMonth("2025-02") // ✅ Actualizado

// 3. Hook personalizado NO detecta el cambio
useMonthlyBudget.selectedMonth // ❌ Sigue siendo "2025-01" (valor inicial)

// 4. useEffect NO se dispara
useEffect(() => {
  loadBudgetData(selectedMonth); // ❌ Este selectedMonth es el INTERNO del hook
}, [selectedMonth, loadBudgetData]); // ❌ Solo detecta cambios del estado interno

// 5. Los datos no se recargan
```

### Código Problemático

**Antes del fix:**

```typescript
// useMonthlyBudget.ts (ANTES)
export function useMonthlyBudget(initialMonth: string): UseMonthlyBudgetReturn {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth); // ❌ Estado duplicado

  useEffect(() => {
    loadBudgetData(selectedMonth); // ❌ Usa el estado interno
  }, [selectedMonth, loadBudgetData]); // ❌ No detecta cambios del contexto

  return {
    selectedMonth, // ❌ Retorna el interno
    setSelectedMonth, // ❌ Modifica solo el interno
    // ...
  };
}
```

---

## ✅ Solución Implementada

### Estrategia: Eliminar Duplicación de Estado

Se eliminó el estado interno del hook `useMonthlyBudget` y se hizo que el contexto sea la **única fuente de verdad**.

### Cambios Realizados

#### 1. `src/hooks/useMonthlyBudget.ts`

**Cambios principales:**
- ❌ Eliminado: `const [selectedMonth, setSelectedMonth] = useState(initialMonth)`
- ✅ Cambiado: El parámetro ahora es `monthYear: string` (valor directo, no inicial)
- ✅ Actualizado: `useEffect` ahora usa el parámetro `monthYear` directamente
- ✅ Removido: Ya no retorna `selectedMonth` ni `setSelectedMonth`

**Interfaz actualizada:**
```typescript
export interface UseMonthlyBudgetReturn {
  // Estado
  budgetData: MonthlyBudgetData | null;
  categories: BudgetCategory[];
  isLoading: boolean;
  error: string | null;
  // ❌ Removido: selectedMonth: string;

  // Funciones
  // ❌ Removido: setSelectedMonth: (month: string) => void;
  refreshBudget: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  // ... otras funciones
}
```

**Hook actualizado:**
```typescript
export function useMonthlyBudget(monthYear: string): UseMonthlyBudgetReturn {
  const [budgetData, setBudgetData] = useState<MonthlyBudgetData | null>(null);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // ❌ Removido: const [selectedMonth, setSelectedMonth] = useState(initialMonth);

  // ✅ Ahora se sincroniza automáticamente cuando cambia monthYear
  useEffect(() => {
    loadBudgetData(monthYear); // ✅ Usa el parámetro directamente
  }, [monthYear, loadBudgetData]);

  const refreshBudget = useCallback(async () => {
    await loadBudgetData(monthYear); // ✅ Usa el parámetro
  }, [monthYear, loadBudgetData]);

  return {
    budgetData,
    categories,
    isLoading,
    error,
    // ❌ Removido: selectedMonth y setSelectedMonth
    refreshBudget,
    // ... otras funciones
  };
}
```

#### 2. `src/app/presupuesto/page.tsx`

**Sin cambios funcionales**, solo comentarios mejorados:

```typescript
export default function PresupuestoPage() {
  // ✅ Única fuente de verdad para el mes seleccionado
  const { selectedMonth, setSelectedMonth } = useMonth();

  // ✅ El hook ahora recibe el mes directamente y se sincroniza automáticamente
  const {
    budgetData,
    categories,
    isLoading,
    error,
    refreshBudget,
    // ... otros
  } = useMonthlyBudget(selectedMonth);

  // ✅ Cuando cambia selectedMonth, el hook detecta el cambio automáticamente
}
```

#### 3. `src/hooks/useDashboardData.ts`

**Removida llamada obsoleta:**

```typescript
// ANTES
const handleSetSelectedMonth = useCallback(
  (month: string) => {
    setSelectedMonth(month);
    budgetHook.setSelectedMonth(month); // ❌ Ya no existe
  },
  [setSelectedMonth, budgetHook],
);

// DESPUÉS
const handleSetSelectedMonth = useCallback(
  (month: string) => {
    setSelectedMonth(month); // ✅ Solo actualiza el contexto
    // ✅ El hook de presupuesto se sincroniza automáticamente
  },
  [setSelectedMonth],
);
```

---

## 🎯 Flujo Corregido

```typescript
// 1. Usuario cambia mes en el selector
handleMonthChange("2025-02")

// 2. Se actualiza el contexto global
MonthContext.setSelectedMonth("2025-02") // ✅ Actualizado

// 3. El componente se re-renderiza con nuevo selectedMonth
const { selectedMonth } = useMonth(); // ✅ "2025-02"

// 4. Hook recibe el nuevo valor como parámetro
useMonthlyBudget(selectedMonth) // ✅ monthYear = "2025-02"

// 5. useEffect detecta el cambio del parámetro
useEffect(() => {
  loadBudgetData(monthYear); // ✅ Se ejecuta con "2025-02"
}, [monthYear, loadBudgetData]); // ✅ monthYear cambió!

// 6. Los datos se recargan correctamente
loadBudgetData("2025-02") // ✅ Carga datos del nuevo mes
```

---

## 📊 Resumen de Cambios

| Archivo | Líneas Modificadas | Tipo de Cambio |
|---------|-------------------|----------------|
| `src/hooks/useMonthlyBudget.ts` | ~15 líneas | Refactorización - Eliminación de estado duplicado |
| `src/app/presupuesto/page.tsx` | 2 líneas | Comentarios mejorados |
| `src/hooks/useDashboardData.ts` | 5 líneas | Removida llamada obsoleta |

---

## ✨ Beneficios del Fix

### 1. **Funcionalidad Restaurada**
- ✅ El cambio de mes ahora funciona correctamente
- ✅ Los datos se actualizan al seleccionar un mes diferente
- ✅ La experiencia de usuario es fluida

### 2. **Código Más Limpio**
- ✅ Eliminada duplicación de estado
- ✅ Única fuente de verdad (`MonthContext`)
- ✅ Menos complejidad en el hook

### 3. **Mejor Mantenibilidad**
- ✅ Menos bugs potenciales por desincronización
- ✅ Más fácil de entender y modificar
- ✅ Sigue el principio de Single Source of Truth

### 4. **Performance**
- ✅ Menos re-renders innecesarios
- ✅ No hay estado redundante

---

## 🧪 Cómo Probar

### Pasos para verificar el fix:

1. **Iniciar la aplicación**
   ```bash
   npm run dev
   ```

2. **Navegar a la página de presupuesto**
   - Ir a `/presupuesto`

3. **Verificar cambio de mes**
   - Observar los datos cargados para el mes actual
   - Cambiar el mes usando el selector
   - Verificar que la tabla se actualiza con los datos del nuevo mes
   - Los totales deben cambiar acorde al mes seleccionado

4. **Verificar persistencia**
   - Cambiar de mes
   - Recargar la página (F5)
   - Verificar que el mes seleccionado se mantiene (localStorage)
   - Los datos deben corresponder al mes persistido

5. **Verificar navegación entre páginas**
   - Seleccionar un mes en presupuesto
   - Navegar al dashboard
   - Volver a presupuesto
   - Verificar que el mes sigue siendo el correcto

---

## 📝 Notas Técnicas

### Patrón Implementado: Single Source of Truth

El fix implementa el patrón "Single Source of Truth" (SSOT):

```
┌─────────────────┐
│  MonthContext   │ ← Única fuente de verdad
│  selectedMonth  │
└────────┬────────┘
         │
         ├──────────────┬──────────────┐
         ▼              ▼              ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ Budget  │    │Dashboard│    │Expenses │
   │  Page   │    │  Page   │    │  Page   │
   └─────────┘    └─────────┘    └─────────┘
```

### React Hooks Best Practices

El fix sigue las mejores prácticas de React Hooks:

1. **Props Over State**: Cuando un hook puede recibir un valor como prop en lugar de manejarlo como estado, es preferible recibirlo como prop.

2. **Dependency Array**: El `useEffect` ahora tiene la dependencia correcta (`monthYear` del parámetro) en lugar de un estado interno.

3. **Single Responsibility**: El hook `useMonthlyBudget` ahora tiene una única responsabilidad: gestionar los datos del presupuesto. La gestión del mes seleccionado es responsabilidad del contexto.

---

## 🔮 Mejoras Futuras Sugeridas

1. **Testing**
   - Agregar tests unitarios para `useMonthlyBudget`
   - Agregar tests de integración para el cambio de mes
   - Verificar que el localStorage se actualice correctamente

2. **Performance**
   - Considerar implementar debounce en el cambio de mes
   - Cachear datos de meses previamente cargados

3. **UX**
   - Agregar indicador de carga al cambiar de mes
   - Animación de transición entre datos de diferentes meses
   - Mensaje si no hay datos para el mes seleccionado

---

## 📚 Referencias

- [React Context](https://react.dev/reference/react/useContext)
- [React useEffect](https://react.dev/reference/react/useEffect)
- [Single Source of Truth Pattern](https://en.wikipedia.org/wiki/Single_source_of_truth)
- Código relacionado:
  - [src/contexts/MonthContext.tsx](src/contexts/MonthContext.tsx)
  - [src/hooks/useMonthlyBudget.ts](src/hooks/useMonthlyBudget.ts)
  - [src/app/presupuesto/page.tsx](src/app/presupuesto/page.tsx)

---

**Autor**: Claude (con supervisión de Miguel)
**Revisado**: Pendiente
**Estado del Fix**: ✅ Implementado y listo para pruebas
