import React, { useState } from 'react';
import { SaveIcon, EditIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
type BudgetItem = {
  id: number;
  description: string;
  date: string;
  classification: string;
  control: string;
  budgeted: number;
  actual: number | null;
};
type BudgetTableProps = {
  month: string;
  year: number;
};
export function BudgetTable({
  month,
  year
}: BudgetTableProps) {
  // Sample data - in a real app this would come from an API
  const initialBudgetItems: BudgetItem[] = [{
    id: 1,
    description: 'Alquiler',
    date: `5 ${month} ${year}`,
    classification: 'Fijo',
    control: 'Necesario',
    budgeted: 850,
    actual: 850
  }, {
    id: 2,
    description: 'Supermercado',
    date: `15 ${month} ${year}`,
    classification: 'Variable',
    control: 'Necesario',
    budgeted: 400,
    actual: 387.5
  }, {
    id: 3,
    description: 'Electricidad',
    date: `20 ${month} ${year}`,
    classification: 'Variable',
    control: 'Necesario',
    budgeted: 120,
    actual: null
  }, {
    id: 4,
    description: 'Internet',
    date: `10 ${month} ${year}`,
    classification: 'Fijo',
    control: 'Necesario',
    budgeted: 60,
    actual: 60
  }, {
    id: 5,
    description: 'Suscripciones',
    date: `1 ${month} ${year}`,
    classification: 'Fijo',
    control: 'Discrecional',
    budgeted: 35,
    actual: 35
  }, {
    id: 6,
    description: 'Restaurantes',
    date: `- ${month} ${year}`,
    classification: 'Variable',
    control: 'Discrecional',
    budgeted: 150,
    actual: 175.2
  }, {
    id: 7,
    description: 'Gimnasio',
    date: `5 ${month} ${year}`,
    classification: 'Fijo',
    control: 'Discrecional',
    budgeted: 45,
    actual: 45
  }, {
    id: 8,
    description: 'Transporte',
    date: `- ${month} ${year}`,
    classification: 'Variable',
    control: 'Necesario',
    budgeted: 80,
    actual: 62.3
  }];
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(initialBudgetItems);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const handleEdit = (item: BudgetItem) => {
    setEditingId(item.id);
    setEditValue(item.actual !== null ? item.actual.toString() : '');
  };
  const handleSave = (id: number) => {
    setBudgetItems(items => items.map(item => item.id === id ? {
      ...item,
      actual: parseFloat(editValue) || 0
    } : item));
    setEditingId(null);
  };
  const handleCancel = () => {
    setEditingId(null);
  };
  return <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-xl font-semibold">
          Presupuesto de {month} {year}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Descripción
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Clasificación
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Control
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Presupuestado
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Real
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {budgetItems.map((item, index) => <tr key={item.id} className={`${index % 2 === 1 ? 'bg-white/5' : ''} hover:bg-white/10 transition-colors duration-150`}>
                <td className="px-4 py-3 text-sm">{item.description}</td>
                <td className="px-4 py-3 text-sm">{item.date}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.classification === 'Fijo' ? 'bg-blue-900/30 text-blue-300' : 'bg-purple-900/30 text-purple-300'}`}>
                    {item.classification}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.control === 'Necesario' ? 'bg-emerald-900/30 text-emerald-300' : 'bg-amber-900/30 text-amber-300'}`}>
                    {item.control}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  ${item.budgeted.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm">
                  {editingId === item.id ? <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-24 bg-white/10 border border-white/20 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus /> : <span className={`font-medium ${item.actual !== null && item.actual > item.budgeted ? 'text-rose-400' : item.actual !== null && item.actual < item.budgeted ? 'text-emerald-400' : ''}`}>
                      {item.actual !== null ? `$${item.actual.toFixed(2)}` : '—'}
                    </span>}
                </td>
                <td className="px-4 py-3 text-sm">
                  {editingId === item.id ? <div className="flex space-x-2">
                      <button onClick={() => handleSave(item.id)} className="p-1 hover:bg-white/10 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Guardar">
                        <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
                      </button>
                      <button onClick={handleCancel} className="p-1 hover:bg-white/10 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Cancelar">
                        <XCircleIcon className="h-5 w-5 text-rose-400" />
                      </button>
                    </div> : <button onClick={() => handleEdit(item)} className="p-1 hover:bg-white/10 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Editar">
                      <EditIcon className="h-5 w-5 text-gray-400" />
                    </button>}
                </td>
              </tr>)}
          </tbody>
        </table>
      </div>
    </div>;
}