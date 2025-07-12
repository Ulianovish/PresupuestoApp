import React, { useState } from 'react';
import { FilterBar } from '../components/budget/FilterBar';
import { BudgetTable } from '../components/budget/BudgetTable';
import { SummaryCards } from '../components/budget/SummaryCards';
export function PresupuestoMensual() {
  const currentMonth = new Date().toLocaleString('es-ES', {
    month: 'long'
  });
  const [month, setMonth] = useState(currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1));
  const [year, setYear] = useState(new Date().getFullYear());
  return <div className="flex flex-col min-h-screen w-full bg-gray-900 text-white">
      <main className="flex-1 px-4 md:px-6 lg:px-8 pb-12 pt-24">
        <section className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 shadow-md mb-6">
          <h1 className="text-2xl font-bold">
            PRESUPUESTO MENSUAL {month.toUpperCase()}
          </h1>
          <p className="text-base text-gray-300 mt-1">Presupuestado vs Real</p>
        </section>
        <FilterBar onMonthChange={setMonth} onYearChange={setYear} />
        <div className="mt-6">
          <BudgetTable month={month} year={year} />
        </div>
        <div className="mt-8">
          <SummaryCards />
        </div>
      </main>
    </div>;
}