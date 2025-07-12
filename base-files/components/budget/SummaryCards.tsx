import React from 'react';
import { DollarSignIcon, BarChartIcon, TrendingUpIcon } from 'lucide-react';
export function SummaryCards() {
  // In a real app, these values would be calculated from the budget items
  const totalBudgeted = 1740.0;
  const totalActual = 1615.0;
  const difference = totalBudgeted - totalActual;
  const isPositive = difference > 0;
  return <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <SummaryCard title="Total Presupuestado" amount={`$${totalBudgeted.toFixed(2)}`} icon={<DollarSignIcon className="h-6 w-6 text-blue-400" />} />
      <SummaryCard title="Total Real" amount={`$${totalActual.toFixed(2)}`} icon={<BarChartIcon className="h-6 w-6 text-purple-400" />} />
      <SummaryCard title="Diferencia" amount={`${isPositive ? '+' : ''}$${Math.abs(difference).toFixed(2)}`} icon={<TrendingUpIcon className="h-6 w-6 text-emerald-400" />} amountColor={isPositive ? 'text-emerald-400' : 'text-rose-400'} />
    </div>;
}
function SummaryCard({
  title,
  amount,
  icon,
  amountColor = 'text-white'
}: {
  title: string;
  amount: string;
  icon: React.ReactNode;
  amountColor?: string;
}) {
  return <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:translate-y-[-2px]">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-300">{title}</h3>
          <p className={`mt-2 text-2xl font-semibold ${amountColor}`}>
            {amount}
          </p>
        </div>
        <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
      </div>
    </div>;
}