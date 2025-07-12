import React from 'react';
import { DollarSignIcon, TrendingDownIcon, CalendarIcon } from 'lucide-react';
export function SummaryCards() {
  // In a real app, these values would be calculated from the debt items
  const totalInitialDebt = 213000;
  const totalRemainingDebt = 158700;
  const nextTotalPayment = 1600;
  const nextPaymentDate = '1 Feb 2025';
  return <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <SummaryCard title="Deuda Inicial Total" amount={`$${totalInitialDebt.toLocaleString('es-ES')}`} icon={<DollarSignIcon className="h-6 w-6 text-blue-400" />} />
      <SummaryCard title="Saldo Pendiente Total" amount={`$${totalRemainingDebt.toLocaleString('es-ES')}`} icon={<TrendingDownIcon className="h-6 w-6 text-purple-400" />} />
      <SummaryCard title="Próximo Pago Total" amount={`$${nextTotalPayment.toLocaleString('es-ES')}`} subtitle={`${nextPaymentDate}`} icon={<CalendarIcon className="h-6 w-6 text-emerald-400" />} />
    </div>;
}
function SummaryCard({
  title,
  amount,
  subtitle,
  icon
}: {
  title: string;
  amount: string;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:translate-y-[-2px]">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-300">{title}</h3>
          <p className="mt-2 text-2xl font-semibold text-white">{amount}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
      </div>
    </div>;
}