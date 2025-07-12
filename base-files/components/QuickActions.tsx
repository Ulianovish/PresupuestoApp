import React from 'react';
import { PlusIcon, TrendingUpIcon, CoinsIcon } from 'lucide-react';
export function QuickActions() {
  return <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 shadow-md">
      <h2 className="text-xl font-semibold mb-6">Acciones Rápidas</h2>
      <div className="space-y-4">
        <ActionButton icon={<PlusIcon className="mr-2 h-5 w-5" />} label="Agregar transacción" variant="primary" />
        <ActionButton icon={<CoinsIcon className="mr-2 h-5 w-5" />} label="Nuevo activo" variant="ghost" />
        <ActionButton icon={<TrendingUpIcon className="mr-2 h-5 w-5" />} label="Registrar deuda" variant="ghost" />
      </div>
      <div className="mt-8 p-4 bg-white/5 rounded-lg">
        <h3 className="text-sm font-medium text-gray-300 mb-2">
          Resumen mensual
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">Ingresos totales</span>
            <span className="text-sm font-medium text-emerald-400">
              $10,540.00
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Gastos totales</span>
            <span className="text-sm font-medium text-rose-400">$6,280.50</span>
          </div>
          <div className="h-px bg-white/10 my-2"></div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Balance</span>
            <span className="text-sm font-medium text-emerald-400">
              +$4,259.50
            </span>
          </div>
        </div>
      </div>
    </div>;
}
function ActionButton({
  icon,
  label,
  variant = 'ghost'
}: {
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'ghost';
}) {
  return <button className={`w-full flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${variant === 'primary' ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-md' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
      {icon}
      {label}
    </button>;
}