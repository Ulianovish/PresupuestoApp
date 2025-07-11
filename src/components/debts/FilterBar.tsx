import React, { useState } from 'react';
import { ChevronDownIcon, SearchIcon } from 'lucide-react';
type FilterBarProps = {
  onDebtTypeChange: (debtType: string) => void;
  onStatusChange: (status: string) => void;
  onSearchChange: (search: string) => void;
};
export function FilterBar({
  onDebtTypeChange,
  onStatusChange,
  onSearchChange
}: FilterBarProps) {
  const [debtType, setDebtType] = useState<string>('Todas');
  const [status, setStatus] = useState<string>('Todas');
  const [search, setSearch] = useState<string>('');
  const debtTypes = ['Todas', 'Préstamo', 'Tarjeta', 'Hipoteca'];
  const statuses = ['Todas', 'Activa', 'Pagada'];
  const handleApplyFilters = () => {
    onDebtTypeChange(debtType);
    onStatusChange(status);
    onSearchChange(search);
  };
  return <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 shadow-md">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="relative">
          <label htmlFor="debtType" className="block text-xs text-gray-400 mb-1">
            Tipo de Deuda
          </label>
          <div className="relative">
            <select id="debtType" value={debtType} onChange={e => setDebtType(e.target.value)} className="appearance-none bg-white/5 border border-white/10 text-white rounded-md pl-3 pr-10 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500">
              {debtTypes.map(type => <option key={type} value={type} className="bg-gray-800">
                  {type}
                </option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
        <div className="relative">
          <label htmlFor="status" className="block text-xs text-gray-400 mb-1">
            Estado
          </label>
          <div className="relative">
            <select id="status" value={status} onChange={e => setStatus(e.target.value)} className="appearance-none bg-white/5 border border-white/10 text-white rounded-md pl-3 pr-10 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500">
              {statuses.map(s => <option key={s} value={s} className="bg-gray-800">
                  {s}
                </option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
        <div className="relative flex-grow">
          <label htmlFor="search" className="block text-xs text-gray-400 mb-1">
            Buscar
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input id="search" type="text" placeholder="Buscar por nombre de deuda..." value={search} onChange={e => setSearch(e.target.value)} className="block w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-md shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500" onClick={handleApplyFilters}>
            Aplicar
          </button>
        </div>
      </div>
    </div>;
}