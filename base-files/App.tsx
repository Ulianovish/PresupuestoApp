import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { HeroDashboard } from './components/HeroDashboard';
import { FinancialChart } from './components/FinancialChart';
import { TransactionsTable } from './components/TransactionsTable';
import { QuickActions } from './components/QuickActions';
import { Footer } from './components/Footer';
import { PresupuestoMensual } from './pages/PresupuestoMensual';
import { GestionDeudas } from './pages/GestionDeudas';
export function App() {
  // For demonstration purposes, we'll show the GestionDeudas page
  // In a real app, this would be handled by a router
  const [currentPage, setCurrentPage] = useState('gestionDeudas'); // This could be state that changes based on navigation
  return <div className="flex flex-col min-h-screen w-full bg-gray-900 text-white">
      <Navbar />
      {currentPage === 'home' && <main className="flex-1 px-4 md:px-6 lg:px-8 pb-12 pt-24">
          <HeroDashboard />
          <FinancialChart />
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <TransactionsTable />
            <QuickActions />
          </div>
        </main>}
      {currentPage === 'presupuestoMensual' && <PresupuestoMensual />}
      {currentPage === 'gestionDeudas' && <GestionDeudas />}
      <Footer />
    </div>;
}