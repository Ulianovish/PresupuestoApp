/**
 * BudgetPageLayout - Template Level
 *
 * Defines the layout structure for budget pages.
 * Focuses on layout, not content - accepts content through props.
 *
 * @param header - Header content (navigation, title, etc.)
 * @param mainContent - Main content area (budget table, forms, etc.)
 * @param sidebar - Optional sidebar content (quick actions, summary, etc.)
 * @param className - Additional CSS classes
 *
 * @example
 * <BudgetPageLayout
 *   header={<PageHeader title="Presupuesto Mensual" />}
 *   mainContent={<BudgetTable items={items} />}
 *   sidebar={<QuickActions />}
 * />
 */
'use client';

import { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface BudgetPageLayoutProps {
  header: ReactNode;
  mainContent: ReactNode;
  sidebar?: ReactNode;
  className?: string;
}

export default function BudgetPageLayout({
  header,
  mainContent,
  sidebar,
  className = '',
}: BudgetPageLayoutProps) {
  return (
    <div className={cn('min-h-screen bg-slate-900', className)}>
      {/* Header */}
      {header && (
        <header className="bg-slate-800 border-b border-slate-700">
          {header}
        </header>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-3">{mainContent}</div>

          {/* Sidebar */}
          {sidebar && (
            <div className="lg:col-span-1">
              <div className="sticky top-8">{sidebar}</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
