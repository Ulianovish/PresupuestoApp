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
