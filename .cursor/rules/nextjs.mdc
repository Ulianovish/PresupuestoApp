---
description: Next.js 14+ Best Practices & Development Rules with Atomic Design for Budget Management Application
globs: ["**/*.tsx", "**/*.ts", "**/*.jsx", "**/*.js", "**/app/**/*", "**/components/**/*", "**/lib/**/*", "**/hooks/**/*", "**/utils/**/*"]
alwaysApply: true
---

# Next.js + Atomic Design Best Practices

## 🎯 Project Context
This is a budget management application built with Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui components, and organized using **Atomic Design methodology**.

## 🧪 Atomic Design Methodology

### Five Levels of Component Hierarchy
1. **Atoms** - Basic building blocks (buttons, inputs, labels)
2. **Molecules** - Simple combinations of atoms (search box, form field)
3. **Organisms** - Complex groups of molecules (header, table, form)
4. **Templates** - Page layouts and structure
5. **Pages** - Specific instances of templates with real data

## 📁 Project Structure & Organization

### File Naming Conventions
- Use **PascalCase** for React components: `BudgetTable.tsx`, `CurrencyInput.tsx`
- Use **camelCase** for utilities and hooks: `formatCurrency.ts`, `useLocalStorage.ts`
- Use **kebab-case** for pages and routes: `budget-overview.tsx`, `debt-management.tsx`
- Use **lowercase** for configuration files: `next.config.js`, `tailwind.config.js`

### Atomic Design Folder Structure
```
src/
├── app/                    # Next.js App Router (Pages Level)
│   ├── (dashboard)/       # Route groups
│   ├── presupuesto/       # Budget pages
│   ├── deudas/           # Debt pages
│   ├── globals.css        # Global styles
│   └── layout.tsx         # Root layout
├── components/            # Atomic Design Structure
│   ├── atoms/            # Basic UI elements
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Label/
│   │   ├── CurrencyInput/
│   │   ├── DatePicker/
│   │   └── Icon/
│   ├── molecules/        # Simple component combinations
│   │   ├── FormField/
│   │   ├── SearchBox/
│   │   ├── BudgetItem/
│   │   ├── TransactionRow/
│   │   └── Card/
│   ├── organisms/        # Complex component groups
│   │   ├── Header/
│   │   ├── Navigation/
│   │   ├── BudgetTable/
│   │   ├── TransactionForm/
│   │   ├── DebtSummary/
│   │   └── FinancialChart/
│   ├── templates/        # Page layouts
│   │   ├── DashboardLayout/
│   │   ├── BudgetPageLayout/
│   │   └── DebtPageLayout/
│   └── ui/              # shadcn/ui components (Atoms level)
├── lib/                  # Utilities and configurations
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
├── constants/           # Application constants
└── utils/               # Helper functions
```

## 🚀 Next.js Specific Rules

### App Router (Next.js 13+)
- **ALWAYS** use App Router over Pages Router for new projects
- Use `layout.tsx` for shared layouts between routes
- Use `page.tsx` for route components (Pages level in Atomic Design)
- Use `loading.tsx` for loading states
- Use `error.tsx` for error boundaries
- Use `not-found.tsx` for 404 pages

### Server vs Client Components
- **DEFAULT** to Server Components unless client interactivity is needed
- **Templates and Pages** should be Server Components when possible
- **Organisms** can be Server Components if they don't need interactivity
- **Molecules and Atoms** are typically Client Components when interactive
- Use `"use client"` directive ONLY when necessary:
  - Event handlers (onClick, onChange)
  - State management (useState, useReducer)
  - Browser APIs (localStorage, window)
  - Custom hooks that use client-side features

### Data Fetching
- Use `fetch()` with caching strategies in Server Components (Pages/Templates)
- Use React Query/SWR for client-side data fetching in Organisms
- Implement proper error handling with try-catch blocks
- Use TypeScript interfaces for API responses

```typescript
// ✅ Good: Server Component data fetching (Page level)
async function BudgetPage({ params }: { params: { month: string } }) {
  const data = await fetch(`/api/budget/${params.month}`, {
    cache: 'revalidate',
    next: { revalidate: 3600 }
  });
  return <BudgetPageTemplate data={data} month={params.month} />;
}

// ✅ Good: Client Component with React Query (Organism level)
"use client";
function TransactionsList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions'],
    queryFn: fetchTransactions
  });
}
```

## 🧪 Atomic Design Component Rules

### 1. Atoms (Basic UI Elements)
- **Purpose**: Smallest functional components
- **Characteristics**: No dependencies on other components
- **Size**: 20-50 lines typically
- **Examples**: Button, Input, Label, Icon, CurrencyInput

```typescript
// ✅ Good: Atom component structure
interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function CurrencyInput({ 
  value, 
  onChange, 
  placeholder = "0.00",
  disabled = false 
}: CurrencyInputProps) {
  // Simple, focused functionality
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value) || 0;
    onChange(numValue);
  };

  return (
    <input
      type="number"
      step="0.01"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
    />
  );
}
```

### 2. Molecules (Simple Combinations)
- **Purpose**: Combine atoms for specific functionality
- **Characteristics**: Usually 2-5 atoms combined
- **Size**: 50-100 lines typically
- **Examples**: FormField, SearchBox, BudgetItem, TransactionRow

```typescript
// ✅ Good: Molecule component structure
interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export default function FormField({ 
  label, 
  error, 
  required = false, 
  children 
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label className={required ? 'required' : ''}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
```

### 3. Organisms (Complex Groups)
- **Purpose**: Combine molecules and atoms for complete functionality
- **Characteristics**: Can manage their own state and data
- **Size**: 100-200 lines typically
- **Examples**: Header, BudgetTable, TransactionForm, Navigation

```typescript
// ✅ Good: Organism component structure
interface BudgetTableProps {
  items: BudgetItem[];
  onItemUpdate: (id: string, value: number) => void;
  loading?: boolean;
}

export default function BudgetTable({ 
  items, 
  onItemUpdate, 
  loading = false 
}: BudgetTableProps) {
  // Complex functionality and state management
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('category');
  
  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.description.toLowerCase().includes(filter.toLowerCase())
    );
  }, [items, filter]);

  if (loading) return <BudgetTableSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <SearchBox 
          value={filter}
          onChange={setFilter}
          placeholder="Buscar partida..."
        />
        <SortSelect value={sortBy} onChange={setSortBy} />
      </div>
      
      <div className="space-y-2">
        {filteredItems.map(item => (
          <BudgetItem
            key={item.id}
            item={item}
            onUpdate={(value) => onItemUpdate(item.id, value)}
          />
        ))}
      </div>
    </div>
  );
}
```

### 4. Templates (Page Layouts)
- **Purpose**: Define page structure and layout
- **Characteristics**: Focus on layout, not content
- **Size**: 50-150 lines typically
- **Examples**: DashboardLayout, BudgetPageLayout, DebtPageLayout

```typescript
// ✅ Good: Template component structure
interface BudgetPageTemplateProps {
  header: React.ReactNode;
  summary: React.ReactNode;
  budgetTable: React.ReactNode;
  sidebar?: React.ReactNode;
}

export default function BudgetPageTemplate({
  header,
  summary,
  budgetTable,
  sidebar
}: BudgetPageTemplateProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header section */}
      <header className="bg-white shadow-sm">
        {header}
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main content area */}
          <div className="lg:col-span-3 space-y-6">
            {summary}
            {budgetTable}
          </div>

          {/* Sidebar */}
          {sidebar && (
            <div className="lg:col-span-1">
              {sidebar}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

### 5. Pages (Specific Instances)
- **Purpose**: Connect templates with real data
- **Characteristics**: Handle data fetching and state management
- **Size**: 100-200 lines typically
- **Examples**: Next.js page components in app/ directory

```typescript
// ✅ Good: Page component structure (Next.js App Router)
interface BudgetPageProps {
  params: { month: string };
}

export default async function BudgetPage({ params }: BudgetPageProps) {
  // Server Component - fetch data
  const [budgetData, userPreferences] = await Promise.all([
    fetchBudgetData(params.month),
    fetchUserPreferences()
  ]);

  return (
    <BudgetPageTemplate
      header={
        <PageHeader 
          title={`Presupuesto ${params.month}`}
          breadcrumbs={[
            { label: 'Dashboard', href: '/' },
            { label: 'Presupuesto', href: '/presupuesto' },
            { label: params.month }
          ]}
        />
      }
      summary={
        <BudgetSummary 
          total={budgetData.summary.total}
          spent={budgetData.summary.spent}
          remaining={budgetData.summary.remaining}
        />
      }
      budgetTable={
        <BudgetTableWrapper 
          items={budgetData.items}
          month={params.month}
        />
      }
      sidebar={
        <BudgetSidebar 
          quickActions={budgetData.quickActions}
          recentTransactions={budgetData.recentTransactions}
        />
      }
    />
  );
}
```

## 🎨 Component Development Rules

### General Component Structure
```typescript
// ✅ Perfect component structure for any atomic level
interface ComponentNameProps {
  // Props interface first - be specific about atomic level
  title: string;
  variant?: 'primary' | 'secondary'; // Atoms should have variants
  children?: React.ReactNode; // Molecules/Organisms can have children
  onAction?: (data: ActionData) => void; // Clear event handlers
  className?: string; // Allow styling customization
}

export default function ComponentName({ 
  title, 
  variant = 'primary', 
  children,
  onAction,
  className = ''
}: ComponentNameProps) {
  // 1. Hooks at the top (more common in Organisms)
  const [state, setState] = useState<string>('');
  
  // 2. Derived state and computations
  const computedValue = useMemo(() => {
    return someComputation(state);
  }, [state]);
  
  // 3. Event handlers
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onAction?.(computedValue);
  }, [onAction, computedValue]);
  
  // 4. Early returns for loading/error states
  if (loading) return <ComponentSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  
  // 5. Render logic
  return (
    <div className={`component-base ${className}`}>
      {/* JSX content */}
    </div>
  );
}
```

### Component Best Practices by Level

#### Atoms
- **Single responsibility**: One specific UI function
- **No business logic**: Pure UI components
- **High reusability**: Used across multiple molecules
- **Consistent variants**: primary, secondary, error, etc.
- **Accessibility**: ARIA labels, keyboard navigation

#### Molecules  
- **Combine related atoms**: Group atoms that work together
- **Simple logic**: Basic state management if needed
- **Clear purpose**: Specific use case (e.g., search box, form field)
- **Flexible composition**: Allow customization through props

#### Organisms
- **Complex functionality**: Handle business logic
- **State management**: Can use hooks for local state
- **Data fetching**: Can fetch their own data if needed
- **Error handling**: Handle and display errors appropriately

#### Templates
- **Layout focus**: Define structure, not content
- **Responsive design**: Handle different screen sizes
- **Slot-based**: Accept content through props
- **Consistent spacing**: Use design system spacing

#### Pages
- **Data orchestration**: Fetch and manage page-level data
- **SEO optimization**: Handle metadata and structure
- **Error boundaries**: Wrap in error boundaries
- **Loading states**: Handle loading and error states

## 🎨 Styling & UI Rules

### Tailwind CSS with Atomic Design
- **Atoms**: Use utility classes directly, create variants
- **Molecules**: Combine utility classes, may need custom CSS
- **Organisms**: Use CSS modules or styled-components for complex layouts
- **Templates**: Focus on layout utilities (grid, flex, spacing)
- **Pages**: Minimal styling, mostly layout containers

```typescript
// ✅ Good: Atom with Tailwind variants
const buttonVariants = {
  primary: 'bg-blue-500 hover:bg-blue-600 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
  error: 'bg-red-500 hover:bg-red-600 text-white'
};

// ✅ Good: Molecule with composed styling
<FormField className="space-y-2">
  <Label className="text-sm font-medium">Amount</Label>
  <CurrencyInput className="w-full" />
</FormField>
```

### shadcn/ui Integration
- **Use as Atoms**: shadcn/ui components are perfect atoms
- **Customize consistently**: Use CSS variables for theming
- **Compose into Molecules**: Combine shadcn components
- **Follow component patterns**: Use shadcn composition patterns

## 🔧 Performance & Optimization

### Code Splitting by Atomic Level
```typescript
// ✅ Good: Dynamic imports for heavy organisms
const BudgetChart = dynamic(() => import('@/components/organisms/BudgetChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false
});

// ✅ Good: Lazy load complete page sections
const ReportsSection = dynamic(() => import('@/components/organisms/ReportsSection'));
```

### Memoization Strategy
- **Atoms**: Usually don't need memoization
- **Molecules**: Memoize if expensive calculations
- **Organisms**: Often benefit from React.memo
- **Templates**: Memoize if complex layout logic

```typescript
// ✅ Good: Memoized organism
export default React.memo(function BudgetTable({ items, onUpdate }: BudgetTableProps) {
  // Component logic
}, (prevProps, nextProps) => {
  return prevProps.items === nextProps.items;
});
```

## 📊 State Management with Atomic Design

### State Ownership Rules
- **Atoms**: No internal state (controlled components)
- **Molecules**: Simple local state only
- **Organisms**: Complex local state, may connect to global state
- **Templates**: No state (layout only)
- **Pages**: Page-level state and data fetching

```typescript
// ✅ Good: State management in organism
export default function TransactionForm() {
  // Local state for form
  const [formData, setFormData] = useState<TransactionFormData>({
    amount: 0,
    category: '',
    description: ''
  });
  
  // Global state connection
  const { addTransaction } = useTransactionStore();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addTransaction(formData);
    setFormData({ amount: 0, category: '', description: '' });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Amount">
        <CurrencyInput 
          value={formData.amount}
          onChange={(value) => setFormData(prev => ({ ...prev, amount: value }))}
        />
      </FormField>
      {/* More form fields */}
    </form>
  );
}
```

## 🧪 Testing Strategy by Atomic Level

### Testing Approach
- **Atoms**: Unit tests for all variants and states
- **Molecules**: Integration tests for atom interactions
- **Organisms**: Integration tests for complete functionality
- **Templates**: Layout and responsive tests
- **Pages**: E2E tests for complete user flows

```typescript
// ✅ Good: Atom testing
describe('CurrencyInput', () => {
  it('formats currency correctly', () => {
    render(<CurrencyInput value={1234.56} onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('1234.56')).toBeInTheDocument();
  });
});

// ✅ Good: Organism testing
describe('BudgetTable', () => {
  it('filters items correctly', () => {
    render(<BudgetTable items={mockItems} onItemUpdate={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'groceries' }
    });
    expect(screen.getByText('Groceries')).toBeInTheDocument();
  });
});
```

## 🎯 Budget Application Specific Rules

### Financial Component Naming
- **Atoms**: `CurrencyInput`, `AmountDisplay`, `CategoryTag`
- **Molecules**: `BudgetItem`, `TransactionRow`, `DebtCard`
- **Organisms**: `BudgetTable`, `TransactionForm`, `DebtSummary`
- **Templates**: `BudgetPageLayout`, `DashboardLayout`
- **Pages**: `BudgetPage`, `DebtManagementPage`

### Financial Data Handling
- **Atoms**: Handle display formatting only
- **Molecules**: Simple calculations (totals, differences)
- **Organisms**: Complex financial logic (amortization, budgeting)
- **Templates**: No financial logic
- **Pages**: Data fetching and validation

### Validation Rules
- **Atoms**: Input validation (format, range)
- **Molecules**: Field-level validation
- **Organisms**: Form-level validation
- **Templates**: No validation
- **Pages**: API validation and error handling

## 📝 Documentation Rules

### Component Documentation
- **Always document**: Purpose, props, usage examples
- **Atomic level**: Specify the atomic design level
- **Dependencies**: List other components used
- **Variants**: Document all available variants

```typescript
/**
 * CurrencyInput - Atom Level
 * 
 * A specialized input component for entering monetary values.
 * Handles currency formatting and validation.
 * 
 * @param value - The current monetary value
 * @param onChange - Callback when value changes
 * @param placeholder - Placeholder text (default: "0.00")
 * @param disabled - Whether the input is disabled
 * 
 * @example
 * <CurrencyInput 
 *   value={amount}
 *   onChange={setAmount}
 *   placeholder="Enter amount"
 * />
 */
```

## 🚀 Migration and Refactoring Guidelines

### Converting Existing Components
1. **Identify atomic level**: Determine if it's an atom, molecule, etc.
2. **Extract atoms**: Pull out reusable basic elements
3. **Compose molecules**: Combine atoms into functional groups
4. **Restructure organisms**: Break down complex components
5. **Create templates**: Extract layout patterns
6. **Simplify pages**: Focus on data orchestration

### Gradual Migration Strategy
- Start with **atoms** (most reusable)
- Build **molecules** from new atoms
- Refactor **organisms** to use new molecules
- Create **templates** for common layouts
- Update **pages** to use new structure

Remember: **Think in atomic levels. Start small, compose up. Keep each level focused on its specific responsibility.**
