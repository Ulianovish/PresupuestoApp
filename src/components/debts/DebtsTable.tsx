import React, { useState, Fragment } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
type Debt = {
  id: number;
  name: string;
  initialAmount: number;
  remainingBalance: number;
  interestRate: number;
  nextPaymentDate: string;
  status: 'Activa' | 'Pagada';
  type: 'Préstamo' | 'Tarjeta' | 'Hipoteca';
  paymentSchedule: {
    date: string;
    amount: number;
    balanceAfter: number;
  }[];
};
type DebtsTableProps = {
  debtType: string;
  status: string;
  searchQuery: string;
};
export function DebtsTable({
  debtType,
  status,
  searchQuery
}: DebtsTableProps) {
  // Sample data - in a real app this would come from an API
  const debts: Debt[] = [{
    id: 1,
    name: 'Hipoteca Casa Principal',
    initialAmount: 180000,
    remainingBalance: 145000,
    interestRate: 3.5,
    nextPaymentDate: '2025-02-01',
    status: 'Activa',
    type: 'Hipoteca',
    paymentSchedule: [{
      date: '2025-02-01',
      amount: 950,
      balanceAfter: 144050
    }, {
      date: '2025-03-01',
      amount: 950,
      balanceAfter: 143100
    }, {
      date: '2025-04-01',
      amount: 950,
      balanceAfter: 142150
    }]
  }, {
    id: 2,
    name: 'Préstamo Coche',
    initialAmount: 25000,
    remainingBalance: 12500,
    interestRate: 4.2,
    nextPaymentDate: '2025-02-15',
    status: 'Activa',
    type: 'Préstamo',
    paymentSchedule: [{
      date: '2025-02-15',
      amount: 450,
      balanceAfter: 12050
    }, {
      date: '2025-03-15',
      amount: 450,
      balanceAfter: 11600
    }, {
      date: '2025-04-15',
      amount: 450,
      balanceAfter: 11150
    }]
  }, {
    id: 3,
    name: 'Tarjeta Visa',
    initialAmount: 3000,
    remainingBalance: 1200,
    interestRate: 18.9,
    nextPaymentDate: '2025-02-05',
    status: 'Activa',
    type: 'Tarjeta',
    paymentSchedule: [{
      date: '2025-02-05',
      amount: 200,
      balanceAfter: 1000
    }, {
      date: '2025-03-05',
      amount: 200,
      balanceAfter: 800
    }, {
      date: '2025-04-05',
      amount: 200,
      balanceAfter: 600
    }]
  }, {
    id: 4,
    name: 'Préstamo Personal',
    initialAmount: 5000,
    remainingBalance: 0,
    interestRate: 7.5,
    nextPaymentDate: '-',
    status: 'Pagada',
    type: 'Préstamo',
    paymentSchedule: []
  }];
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const toggleRow = (id: number) => {
    setExpandedRows(prevState => prevState.includes(id) ? prevState.filter(rowId => rowId !== id) : [...prevState, id]);
  };
  const filteredDebts = debts.filter(debt => {
    const matchesType = debtType === 'Todas' || debt.type === debtType;
    const matchesStatus = status === 'Todas' || debt.status === status;
    const matchesSearch = searchQuery === '' || debt.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });
  const formatDate = (dateString: string) => {
    if (dateString === '-') return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };
  return <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-xl font-semibold">Tus Deudas</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Deuda
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Monto Inicial
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Saldo Pendiente
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Tasa de Interés
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Próximo Pago
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredDebts.length === 0 ? <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No se encontraron deudas que coincidan con los filtros.
                </td>
              </tr> : filteredDebts.map((debt, index) => <Fragment key={debt.id}>
                  <tr className={`${index % 2 === 1 ? 'bg-white/5' : ''} hover:bg-white/10 transition-colors duration-150`}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <button onClick={() => toggleRow(debt.id)} className={`mr-2 p-1 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500 ${debt.status === 'Pagada' ? 'opacity-0 pointer-events-none' : ''}`} aria-label={expandedRows.includes(debt.id) ? 'Ocultar detalles' : 'Mostrar detalles'} disabled={debt.status === 'Pagada'}>
                          {expandedRows.includes(debt.id) ? <ChevronUpIcon className="h-4 w-4 text-gray-400" /> : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
                        </button>
                        <div>
                          <div className="font-medium">{debt.name}</div>
                          <div className="flex items-center mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${debt.status === 'Activa' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-gray-900/50 text-gray-400'}`}>
                              {debt.status}
                            </span>
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300">
                              {debt.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      ${debt.initialAmount.toLocaleString('es-ES')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      ${debt.remainingBalance.toLocaleString('es-ES')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {debt.interestRate}%
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {formatDate(debt.nextPaymentDate)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <button className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${debt.status === 'Activa' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-800/50 text-gray-500 cursor-not-allowed'}`} disabled={debt.status !== 'Activa'}>
                        Registrar Pago
                      </button>
                    </td>
                  </tr>
                  {expandedRows.includes(debt.id) && debt.status === 'Activa' && <tr className="bg-white/5">
                        <td colSpan={6} className="px-4 py-0">
                          <div className="overflow-hidden transition-all duration-300 max-h-80">
                            <div className="py-4 pl-10 pr-4">
                              <h4 className="text-sm font-medium text-gray-300 mb-3">
                                Cronograma de Pagos
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-white/10 border border-white/10 rounded-md">
                                  <thead className="bg-white/5">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                                        Fecha
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                                        Monto
                                      </th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">
                                        Saldo Tras Pago
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/10">
                                    {debt.paymentSchedule.map((payment, idx) => <tr key={idx} className={idx % 2 === 1 ? 'bg-white/5' : ''}>
                                          <td className="px-4 py-2 text-xs">
                                            {formatDate(payment.date)}
                                          </td>
                                          <td className="px-4 py-2 text-xs">
                                            $
                                            {payment.amount.toLocaleString('es-ES')}
                                          </td>
                                          <td className="px-4 py-2 text-xs">
                                            $
                                            {payment.balanceAfter.toLocaleString('es-ES')}
                                          </td>
                                        </tr>)}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>}
                </Fragment>)}
          </tbody>
        </table>
      </div>
    </div>;
}