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
