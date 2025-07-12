import React from 'react';
import { ChevronDownIcon, FilterIcon } from 'lucide-react';
export function TransactionsTable() {
  const transactions = [{
    id: 1,
    date: '15 Jul 2023',
    concept: 'Supermercado Día',
    category: 'Alimentación',
    account: 'Tarjeta Visa',
    amount: -85.5
  }, {
    id: 2,
    date: '14 Jul 2023',
    concept: 'Transferencia recibida',
    category: 'Ingreso',
    account: 'Banco Santander',
    amount: 1500.0
  }, {
    id: 3,
    date: '12 Jul 2023',
    concept: 'Netflix',
    category: 'Entretenimiento',
    account: 'Tarjeta Mastercard',
    amount: -12.99
  }, {
    id: 4,
    date: '10 Jul 2023',
    concept: 'Uber',
    category: 'Transporte',
    account: 'Tarjeta Visa',
    amount: -24.3
  }, {
    id: 5,
    date: '08 Jul 2023',
    concept: 'Café Starbucks',
    category: 'Comidas fuera',
    account: 'Efectivo',
    amount: -5.75
  }];
  return <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-xl font-semibold">Transacciones Recientes</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="relative">
            <button className="flex items-center space-x-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200">
              <FilterIcon size={16} />
              <span>Categoría</span>
              <ChevronDownIcon size={16} />
            </button>
          </div>
          <div className="relative">
            <button className="flex items-center space-x-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200">
              <FilterIcon size={16} />
              <span>Cuenta</span>
              <ChevronDownIcon size={16} />
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Concepto
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Categoría
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Cuenta
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Monto
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {transactions.map(transaction => <tr key={transaction.id} className="hover:bg-white/5 transition-colors duration-150">
                <td className="px-4 py-3 text-sm">{transaction.date}</td>
                <td className="px-4 py-3 text-sm">{transaction.concept}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${transaction.category === 'Ingreso' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-blue-900/30 text-blue-300'}`}>
                    {transaction.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{transaction.account}</td>
                <td className={`px-4 py-3 text-sm font-medium ${transaction.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {transaction.amount >= 0 ? '+' : ''}$
                  {Math.abs(transaction.amount).toFixed(2)}
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
}