import React, { useState } from 'react';
import { FilterBar } from '../components/debts/FilterBar';
import { DebtsTable } from '../components/debts/DebtsTable';
import { SummaryCards } from '../components/debts/SummaryCards';
import { QuickActions } from '../components/debts/QuickActions';
export function GestionDeudas() {
  const [debtType, setDebtType] = useState<string>('Todas');
  const [status, setStatus] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  return <div className="flex flex-col min-h-screen w-full bg-gray-900 text-white">
      <main className="flex-1 px-4 md:px-6 lg:px-8 pb-12 pt-24">
        <section className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 shadow-md mb-6">
          <h1 className="text-2xl font-bold">GESTIÓN DE DEUDAS</h1>
          <p className="text-base text-gray-300 mt-1">
            Administra tus préstamos y créditos
          </p>
        </section>
        <FilterBar onDebtTypeChange={setDebtType} onStatusChange={setStatus} onSearchChange={setSearchQuery} />
        <div className="mt-6">
          <DebtsTable debtType={debtType} status={status} searchQuery={searchQuery} />
        </div>
        <div className="mt-8">
          <SummaryCards />
        </div>
        <div className="mt-8 fixed bottom-8 right-8 md:right-12 z-10">
          <QuickActions />
        </div>
      </main>
    </div>;
}