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



---
description: shadcn/ui Best Practices & Design System Rules for SIRME Budget Application
globs: ["**/*.tsx", "**/*.ts", "**/components/ui/**/*", "**/components/atoms/**/*", "**/components/molecules/**/*"]
alwaysApply: true
---

# shadcn/ui + SIRME Design System Rules

## 🎯 Project Context
This budget management application uses shadcn/ui as the foundation for **Atoms** in our Atomic Design system, enhanced with **glassmorphism**, **gradients**, and **micro-interactions** following the SIRME design philosophy.

## 🎨 Design Philosophy Integration

### Core Principles
- **Minimalismo Funcional**: Clean interfaces prioritizing usability
- **Modernidad**: Glassmorphism and subtle micro-interactions
- **Accesibilidad**: WCAG compliance with visible focus and proper contrast
- **Responsividad**: Mobile-first design with perfect adaptation
- **Consistencia**: Atomic component system ensuring visual coherence

## 🌈 Color System Integration

### Primary Colors with shadcn/ui
- **Primary**: `from-blue-500 to-purple-600` (Main gradient)
- **Secondary**: `from-emerald-500 to-teal-600` (Success/Users)
- **Accent**: `from-amber-500 to-orange-600` (Warnings/Highlights)
- **Muted**: Slate-based grays for text and backgrounds

### CSS Variables Override
```css
:root {
  --primary: 221 83% 53%;          /* Blue-500 */
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 94%;
  --secondary-foreground: 222.2 84% 4.9%;
  --accent: 210 40% 94%;
  --accent-foreground: 222.2 84% 4.9%;
  --muted: 210 40% 94%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221 83% 53%;
}

.dark {
  --primary: 221 83% 53%;
  --primary-foreground: 210 40% 98%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 221 83% 53%;
}
```

## 🧪 shadcn/ui Components as Atoms

### Button Component Enhancement
```typescript
// components/atoms/Button/Button.tsx
import { Button as ShadcnButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ComponentProps<typeof ShadcnButton> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'gradient' | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

export default function Button({ 
  className, 
  variant = 'default', 
  size = 'default',
  loading = false,
  children,
  disabled,
  ...props 
}: ButtonProps) {
  const variants = {
    gradient: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200',
    glass: 'bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm border border-white/20 dark:border-slate-700/20 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-all duration-200',
  };

  return (
    <ShadcnButton
      className={cn(
        variant === 'gradient' && variants.gradient,
        variant === 'glass' && variants.glass,
        loading && 'pointer-events-none opacity-70',
        className
      )}
      variant={variant === 'gradient' || variant === 'glass' ? 'default' : variant}
      size={size}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </ShadcnButton>
  );
}
```

### Card Component with Glassmorphism
```typescript
// components/atoms/Card/Card.tsx
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CardProps extends React.ComponentProps<typeof ShadcnCard> {
  variant?: 'default' | 'glass' | 'gradient-border';
  hover?: boolean;
  blur?: boolean;
}

export default function Card({ 
  className, 
  variant = 'default',
  hover = false,
  blur = false,
  children,
  ...props 
}: CardProps) {
  const variants = {
    glass: 'bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm border border-white/20 dark:border-slate-700/20',
    'gradient-border': 'bg-white/5 dark:bg-slate-800/20 backdrop-blur-sm border-2 border-transparent bg-gradient-to-r from-blue-500/20 to-purple-500/20 bg-clip-padding',
  };

  return (
    <ShadcnCard
      className={cn(
        variant === 'glass' && variants.glass,
        variant === 'gradient-border' && variants['gradient-border'],
        hover && 'hover:shadow-xl hover:scale-[1.02] transition-all duration-300',
        blur && 'backdrop-blur-sm',
        className
      )}
      {...props}
    >
      {children}
    </ShadcnCard>
  );
}
```

### Input Component with Enhanced Focus
```typescript
// components/atoms/Input/Input.tsx
import { Input as ShadcnInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InputProps extends React.ComponentProps<typeof ShadcnInput> {
  variant?: 'default' | 'glass' | 'gradient-focus';
  error?: boolean;
}

export default function Input({ 
  className, 
  variant = 'default',
  error = false,
  ...props 
}: InputProps) {
  const variants = {
    glass: 'bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm border border-white/20 dark:border-slate-700/20 focus:bg-white/20 dark:focus:bg-slate-700/30',
    'gradient-focus': 'focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200',
  };

  return (
    <ShadcnInput
      className={cn(
        variant === 'glass' && variants.glass,
        variant === 'gradient-focus' && variants['gradient-focus'],
        error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
        className
      )}
      {...props}
    />
  );
}
```

## 🔧 Component Customization Rules

### 1. Button Variants
- **Use `gradient` variant** for primary actions (Submit, Save, Create)
- **Use `glass` variant** for secondary actions on dark backgrounds
- **Use `outline` variant** for tertiary actions
- **Always add loading states** for async operations

```typescript
// ✅ Good: Primary action with gradient
<Button variant="gradient" size="lg" loading={isSubmitting}>
  Crear Presupuesto
</Button>

// ✅ Good: Secondary action with glass effect
<Button variant="glass" size="default">
  Cancelar
</Button>

// ❌ Bad: No loading state for async operation
<Button onClick={handleSubmit}>Submit</Button>
```

### 2. Card Styling
- **Use `glass` variant** for main content cards
- **Use `gradient-border` variant** for highlighted content
- **Always add hover effects** for interactive cards
- **Include backdrop-blur** for glassmorphism effect

```typescript
// ✅ Good: Main content card with glassmorphism
<Card variant="glass" hover className="p-6">
  <CardHeader>
    <CardTitle className="text-gradient">Budget Summary</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>

// ✅ Good: Highlighted card with gradient border
<Card variant="gradient-border" className="p-4">
  <div className="relative">
    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg blur-xl"></div>
    <div className="relative">
      {/* Content */}
    </div>
  </div>
</Card>
```

### 3. Form Components
- **Use `glass` variant** for inputs on dark backgrounds
- **Use `gradient-focus` variant** for enhanced focus states
- **Always handle error states** with proper styling
- **Include proper labels** and ARIA attributes

```typescript
// ✅ Good: Form field with glassmorphism
<div className="space-y-2">
  <Label htmlFor="amount">Amount</Label>
  <Input 
    id="amount"
    variant="glass"
    placeholder="Enter amount"
    error={!!errors.amount}
    aria-describedby={errors.amount ? "amount-error" : undefined}
  />
  {errors.amount && (
    <p id="amount-error" className="text-sm text-red-500">
      {errors.amount}
    </p>
  )}
</div>
```

## 🎨 Design System Integration

### Color Usage Guidelines
- **Primary Actions**: Use gradient variants (`from-blue-500 to-purple-600`)
- **Success States**: Use emerald gradients (`from-emerald-500 to-teal-600`)
- **Warning States**: Use amber gradients (`from-amber-500 to-orange-600`)
- **Error States**: Use red with proper contrast
- **Neutral Elements**: Use slate-based colors

### Typography with shadcn/ui
```typescript
// Typography component integration
<div className="space-y-4">
  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
    Dashboard Principal
  </h1>
  <p className="text-muted-foreground">
    Gestiona tu presupuesto mensual
  </p>
</div>
```

### Spacing and Layout
- **Use consistent spacing**: `space-y-4`, `space-x-4` for related elements
- **Container margins**: `mx-auto px-4` for responsive containers
- **Card padding**: `p-6` for large cards, `p-4` for medium cards
- **Grid layouts**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` for responsive grids

## 🌓 Dark Mode Support

### Theme Variables
```typescript
// Always use CSS variables for theme-aware colors
<div className="bg-card text-card-foreground border-border">
  <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
    Action
  </Button>
</div>
```

### Glassmorphism in Dark Mode
```typescript
// Different opacity for light/dark modes
<Card className="bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm border border-white/20 dark:border-slate-700/20">
  {/* Content */}
</Card>
```

## 📱 Responsive Design

### Mobile-First Approach
```typescript
// Responsive button sizes
<Button 
  size="sm" 
  className="w-full md:w-auto md:text-base"
  variant="gradient"
>
  Create Budget
</Button>

// Responsive card layouts
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card variant="glass" className="p-4 md:p-6">
    {/* Content */}
  </Card>
</div>
```

### Breakpoint Usage
- **Mobile**: `< 768px` - Stack cards vertically, smaller buttons
- **Tablet**: `768px - 1024px` - 2-column layouts, medium buttons
- **Desktop**: `> 1024px` - 3+ column layouts, larger buttons

## ✨ Animation and Micro-interactions

### Transition Standards
```typescript
// Standard transition duration
<Button className="transition-all duration-200 hover:shadow-xl hover:scale-105">
  Interactive Button
</Button>

// Loading states with spin animation
<Button disabled className="relative">
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  </div>
  <span className="invisible">Loading...</span>
</Button>
```

### Hover Effects
- **Cards**: `hover:shadow-xl hover:scale-[1.02]`
- **Buttons**: `hover:shadow-lg hover:scale-105`
- **Interactive elements**: `hover:bg-opacity-80`

## 🧪 Testing and Accessibility

### Focus Management
```typescript
// Proper focus indicators
<Button className="focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 focus:ring-offset-background">
  Accessible Button
</Button>

// Focus trap for modals
<Dialog>
  <DialogContent className="focus:outline-none">
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### ARIA Compliance
- **Always use proper labels**: `aria-label`, `aria-describedby`
- **Semantic HTML**: Use correct HTML elements
- **Keyboard navigation**: Ensure all interactive elements are reachable
- **Screen reader support**: Provide meaningful descriptions

## 🔄 Component Composition Rules

### Atomic Design with shadcn/ui
- **Atoms**: Enhanced shadcn/ui components with SIRME styling
- **Molecules**: Combinations of 2-3 atoms with specific functionality
- **Organisms**: Complex combinations with business logic
- **Templates**: Layout structures using shadcn/ui layout components

### Example Composition
```typescript
// Molecule: BudgetCard (combining Card, Button, and Badge atoms)
export default function BudgetCard({ budget, onEdit, onDelete }) {
  return (
    <Card variant="glass" hover className="p-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-gradient">{budget.name}</CardTitle>
        <Badge variant="secondary">{budget.status}</Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-2xl font-bold">${budget.amount}</div>
          <div className="flex gap-2">
            <Button variant="gradient" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## 📝 Documentation Standards

### Component Documentation
```typescript
/**
 * EnhancedButton - Atom Level
 * 
 * Enhanced shadcn/ui Button with SIRME design system integration.
 * Supports glassmorphism, gradients, and loading states.
 * 
 * @param variant - Button style variant including custom 'gradient' and 'glass'
 * @param size - Button size (default, sm, lg, icon)
 * @param loading - Shows loading spinner when true
 * @param children - Button content
 * 
 * @example
 * <Button variant="gradient" size="lg" loading={isSubmitting}>
 *   Create Budget
 * </Button>
 */
```

### Usage Guidelines
- **Always document** custom variants and props
- **Include examples** of proper usage
- **Specify atomic level** (Atom, Molecule, Organism)
- **List dependencies** on other components

## 🚀 Performance Considerations

### Bundle Optimization
```typescript
// Dynamic imports for heavy components
const DataTable = dynamic(() => import('@/components/ui/data-table'), {
  loading: () => <TableSkeleton />,
  ssr: false
});

// Lazy loading for complex organisms
const BudgetChart = dynamic(() => import('@/components/organisms/BudgetChart'));
```

### Memory Management
- **Use React.memo** for expensive components
- **Implement proper cleanup** in useEffect hooks
- **Avoid inline styles** when possible
- **Use CSS variables** for theme switching

Remember: **Always prioritize user experience over visual complexity. Every animation and effect should serve a functional purpose.**


# Supabase Best Practices for Budget Management

## 🎯 Project Context
This budget management application uses Supabase as the backend-as-a-service with PostgreSQL database, real-time subscriptions, authentication, and Row Level Security (RLS) for multi-user financial data management.

## 📊 Database Schema Design

### Core Tables Structure
```sql
-- Users table (handled by Supabase Auth)
-- profiles table for extended user data

-- Categories table
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts table (bank accounts, cash, etc.)
CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank', 'cash', 'credit', 'investment')),
  balance DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget templates
CREATE TABLE budget_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  total_income DECIMAL(10,2) DEFAULT 0,
  total_expenses DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- Budget items
CREATE TABLE budget_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_template_id UUID REFERENCES budget_templates(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  budgeted_amount DECIMAL(10,2) NOT NULL,
  actual_amount DECIMAL(10,2) DEFAULT 0,
  item_type TEXT NOT NULL CHECK (item_type IN ('income', 'expense')),
  due_date DATE,
  is_recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  budget_item_id UUID REFERENCES budget_items(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer')),
  transaction_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debts
CREATE TABLE debts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  remaining_amount DECIMAL(10,2) NOT NULL,
  interest_rate DECIMAL(5,2) DEFAULT 0,
  minimum_payment DECIMAL(10,2) NOT NULL,
  due_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Database Indexes
```sql
-- Performance indexes
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_budget_items_template ON budget_items(budget_template_id);
CREATE INDEX idx_categories_user_active ON categories(user_id) WHERE is_active = true;
CREATE INDEX idx_accounts_user_active ON accounts(user_id) WHERE is_active = true;
CREATE INDEX idx_budget_templates_user_month ON budget_templates(user_id, month_year);
```

## 🔐 Row Level Security (RLS) Policies

### Enable RLS on all tables
```sql
-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- Categories policies
CREATE POLICY "Users can view own categories" ON categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON categories
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for other tables...
```

## 🔧 Supabase Configuration

### Environment Variables
```typescript
// .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Supabase Client Setup
```typescript
// lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';

export const createClient = () => {
  return createClientComponentClient<Database>();
};

// lib/supabase/server.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export const createServerClient = () => {
  return createServerComponentClient<Database>({
    cookies,
  });
};

// lib/supabase/middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });
  await supabase.auth.getSession();
  return res;
}
```

## 🎯 TypeScript Integration

### Generate Types
```bash
# Generate TypeScript types from Supabase schema
npx supabase gen types typescript --project-id your-project-id > types/supabase.ts
```

### Type Definitions
```typescript
// types/supabase.ts (auto-generated + custom extensions)
export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          color: string;
          icon: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          color?: string;
          icon?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          color?: string;
          icon?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      // More table definitions...
    };
    Views: {
      // View definitions
    };
    Functions: {
      // Function definitions
    };
  };
}

// Custom types for application
export type Category = Database['public']['Tables']['categories']['Row'];
export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];

// Extended types with relationships
export type TransactionWithCategory = Transaction & {
  category: Category | null;
  account: Account | null;
};

export type BudgetItemWithCategory = BudgetItem & {
  category: Category | null;
};
```

## 🔍 Query Patterns and Best Practices

### Data Fetching Hooks
```typescript
// hooks/useCategories.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Category, CategoryInsert, CategoryUpdate } from '@/types/supabase';

export function useCategories() {
  const supabase = createClient();
  
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Category[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  
  return useMutation({
    mutationFn: async (category: CategoryInsert) => {
      const { data, error } = await supabase
        .from('categories')
        .insert([category])
        .select()
        .single();
      
      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

// Similar patterns for other entities...
```

### Budget Queries
```typescript
// hooks/useBudget.ts
export function useBudgetTemplate(monthYear: string) {
  const supabase = createClient();
  
  return useQuery({
    queryKey: ['budget', monthYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_templates')
        .select(`
          *,
          budget_items (
            *,
            category (*)
          )
        `)
        .eq('month_year', monthYear)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!monthYear,
  });
}

export function useTransactionsForMonth(monthYear: string) {
  const supabase = createClient();
  const [year, month] = monthYear.split('-');
  
  return useQuery({
    queryKey: ['transactions', monthYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          category (*),
          account (*)
        `)
        .gte('transaction_date', `${year}-${month}-01`)
        .lt('transaction_date', `${year}-${month.padStart(2, '0')}-31`)
        .order('transaction_date', { ascending: false });
      
      if (error) throw error;
      return data as TransactionWithCategory[];
    },
  });
}
```

## ⚡ Real-time Subscriptions

### Real-time Hooks
```typescript
// hooks/useRealtimeTransactions.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function useRealtimeTransactions() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  
  useEffect(() => {
    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
          queryClient.invalidateQueries({ queryKey: ['budget'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, supabase]);
}

// Use in layout or main components
export function useRealtimeSync() {
  useRealtimeTransactions();
  // Add other real-time subscriptions as needed
}
```

## 🔐 Authentication Patterns

### Auth Helper Hook
```typescript
// hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  
  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };
    
    getInitialSession();
    
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    
    return () => subscription.unsubscribe();
  }, [supabase.auth]);
  
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };
  
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };
  
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };
  
  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };
}
```

### Protected Route Component
```typescript
// components/auth/ProtectedRoute.tsx
'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/atoms/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({ 
  children, 
  fallback 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);
  
  if (loading) {
    return fallback || <LoadingSpinner />;
  }
  
  if (!user) {
    return null;
  }
  
  return <>{children}</>;
}
```

## 📈 Performance Optimization

### Query Optimization Rules
```typescript
// ✅ Good: Specific field selection
const { data } = await supabase
  .from('transactions')
  .select('id, amount, description, transaction_date')
  .limit(20);

// ❌ Bad: Select all fields when not needed
const { data } = await supabase
  .from('transactions')
  .select('*');

// ✅ Good: Use indexes for filtering
const { data } = await supabase
  .from('transactions')
  .select('*')
  .eq('user_id', userId) // Indexed column
  .gte('transaction_date', startDate) // Indexed column
  .order('transaction_date', { ascending: false });

// ✅ Good: Pagination with count
const { data, count } = await supabase
  .from('transactions')
  .select('*', { count: 'exact' })
  .range(0, 49); // First 50 records
```

### Caching Strategy
```typescript
// hooks/useCachedQuery.ts
export function useCachedBudgetData(monthYear: string) {
  return useQuery({
    queryKey: ['budget', monthYear],
    queryFn: () => fetchBudgetData(monthYear),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 3,
  });
}
```

## 🛡️ Error Handling

### Error Handling Patterns
```typescript
// utils/supabase/errorHandler.ts
import { PostgrestError } from '@supabase/supabase-js';

export class SupabaseError extends Error {
  constructor(
    message: string,
    public originalError: PostgrestError,
    public code?: string
  ) {
    super(message);
    this.name = 'SupabaseError';
  }
}

export function handleSupabaseError(error: PostgrestError): never {
  // Log error for debugging
  console.error('Supabase Error:', error);
  
  // Map common errors to user-friendly messages
  switch (error.code) {
    case 'PGRST116':
      throw new SupabaseError('No data found', error, 'NOT_FOUND');
    case '23505':
      throw new SupabaseError('This record already exists', error, 'DUPLICATE');
    case '23503':
      throw new SupabaseError('Related record not found', error, 'FOREIGN_KEY');
    default:
      throw new SupabaseError(
        'An unexpected database error occurred',
        error,
        'UNKNOWN'
      );
  }
}

// Usage in hooks
export function useCreateTransaction() {
  return useMutation({
    mutationFn: async (transaction: TransactionInsert) => {
      const { data, error } = await supabase
        .from('transactions')
        .insert([transaction])
        .select()
        .single();
      
      if (error) {
        handleSupabaseError(error);
      }
      
      return data;
    },
    onError: (error) => {
      if (error instanceof SupabaseError) {
        toast.error(error.message);
      } else {
        toast.error('An unexpected error occurred');
      }
    },
  });
}
```

## 🔄 Database Functions and Triggers

### Useful Database Functions
```sql
-- Function to update account balance after transaction
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE accounts 
    SET balance = balance + 
      CASE 
        WHEN NEW.transaction_type = 'income' THEN NEW.amount
        WHEN NEW.transaction_type = 'expense' THEN -NEW.amount
        ELSE 0
      END
    WHERE id = NEW.account_id;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    UPDATE accounts 
    SET balance = balance - 
      CASE 
        WHEN OLD.transaction_type = 'income' THEN OLD.amount
        WHEN OLD.transaction_type = 'expense' THEN -OLD.amount
        ELSE 0
      END
    WHERE id = OLD.account_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update account balances
CREATE TRIGGER update_account_balance_trigger
  AFTER INSERT OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balance();
```

## 📊 Budget-Specific Patterns

### Budget Calculation Functions
```typescript
// utils/budget/calculations.ts
export async function calculateBudgetSummary(
  monthYear: string
): Promise<BudgetSummary> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .rpc('calculate_budget_summary', {
      month_year: monthYear
    });
    
  if (error) handleSupabaseError(error);
  
  return data;
}

// Database function for budget calculations
CREATE OR REPLACE FUNCTION calculate_budget_summary(month_year TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_budgeted_income', COALESCE(SUM(CASE WHEN item_type = 'income' THEN budgeted_amount ELSE 0 END), 0),
    'total_budgeted_expenses', COALESCE(SUM(CASE WHEN item_type = 'expense' THEN budgeted_amount ELSE 0 END), 0),
    'total_actual_income', COALESCE(SUM(CASE WHEN item_type = 'income' THEN actual_amount ELSE 0 END), 0),
    'total_actual_expenses', COALESCE(SUM(CASE WHEN item_type = 'expense' THEN actual_amount ELSE 0 END), 0)
  ) INTO result
  FROM budget_items bi
  JOIN budget_templates bt ON bi.budget_template_id = bt.id
  WHERE bt.month_year = month_year
    AND bt.user_id = auth.uid();
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 🔧 Development Workflow

### Migration Management
```bash
# Initialize Supabase locally
supabase init

# Start local development
supabase start

# Create new migration
supabase migration new create_budget_tables

# Apply migrations
supabase db push

# Generate types after schema changes
supabase gen types typescript --local > types/supabase.ts
```

### Testing with Supabase
```typescript
// utils/testing/supabase-mock.ts
export const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  })),
  auth: {
    getSession: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
};

// Setup in tests
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}));
```

## 📝 Documentation and Monitoring

### Query Documentation
```typescript
/**
 * Fetches budget template with all related budget items and categories
 * for a specific month. Includes transaction aggregations.
 * 
 * @param monthYear - Format: 'YYYY-MM'
 * @returns Budget template with nested items and calculations
 * 
 * @example
 * const budget = await getBudgetWithItems('2024-01');
 */
export async function getBudgetWithItems(monthYear: string) {
  // Implementation...
}
```

Remember: **Always use RLS policies, validate data types, handle errors gracefully, and optimize queries for performance. Keep financial data secure and maintain audit trails.**
description:
globs:
alwaysApply: true
---
