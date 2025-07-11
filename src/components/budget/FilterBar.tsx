import React, { useState } from 'react';
import { ChevronDownIcon, FilterIcon, CalendarIcon } from 'lucide-react';
type FilterBarProps = {
  onMonthChange: (month: string) => void;
  onYearChange: (year: number) => void;
};
export function FilterBar({
  onMonthChange,
  onYearChange
}: FilterBarProps) {
  const [category, setCategory] = useState<string>('Todas');
  const [account, setAccount] = useState<string>('Todas');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(months[currentMonth]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const categories = ['Todas', 'Hogar', 'Alimentación', 'Transporte', 'Entretenimiento', 'Salud'];
  const accounts = ['Todas', 'Efectivo', 'Tarjeta Visa', 'Tarjeta Mastercard', 'Banco Santander'];
  const handleApplyFilters = () => {
    onMonthChange(selectedMonth);
    onYearChange(selectedYear);
    setShowMonthPicker(false);
  };
  return <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 shadow-md">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative">
          <label htmlFor="category" className="block text-xs text-gray-400 mb-1">
            Categoría
          </label>
          <div className="relative">
            <select id="category" value={category} onChange={e => setCategory(e.target.value)} className="appearance-none bg-white/5 border border-white/10 text-white rounded-md pl-3 pr-10 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500">
              {categories.map(cat => <option key={cat} value={cat} className="bg-gray-800">
                  {cat}
                </option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
        <div className="relative">
          <label htmlFor="account" className="block text-xs text-gray-400 mb-1">
            Cuenta
          </label>
          <div className="relative">
            <select id="account" value={account} onChange={e => setAccount(e.target.value)} className="appearance-none bg-white/5 border border-white/10 text-white rounded-md pl-3 pr-10 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500">
              {accounts.map(acc => <option key={acc} value={acc} className="bg-gray-800">
                  {acc}
                </option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
        <div className="relative">
          <label className="block text-xs text-gray-400 mb-1">Mes/Año</label>
          <button className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-3 py-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500" onClick={() => setShowMonthPicker(!showMonthPicker)}>
            <CalendarIcon className="h-4 w-4" />
            <span>
              {selectedMonth} {selectedYear}
            </span>
            <ChevronDownIcon className="h-4 w-4" />
          </button>
          {showMonthPicker && <div className="absolute z-10 mt-1 bg-gray-800 border border-white/20 rounded-md shadow-lg p-3 w-60">
              <div className="grid grid-cols-3 gap-1 mb-2">
                {months.map((month, index) => <button key={month} className={`text-sm px-2 py-1 rounded ${selectedMonth === month ? 'bg-blue-500 text-white' : 'hover:bg-white/10'}`} onClick={() => setSelectedMonth(month)}>
                    {month.substring(0, 3)}
                  </button>)}
              </div>
              <div className="flex justify-between items-center mt-2">
                <button className="text-sm hover:bg-white/10 px-2 py-1 rounded" onClick={() => setSelectedYear(selectedYear - 1)}>
                  &lt;
                </button>
                <span>{selectedYear}</span>
                <button className="text-sm hover:bg-white/10 px-2 py-1 rounded" onClick={() => setSelectedYear(selectedYear + 1)}>
                  &gt;
                </button>
              </div>
            </div>}
        </div>
        <div className="ml-auto">
          <button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-md shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500" onClick={handleApplyFilters}>
            Aplicar
          </button>
        </div>
      </div>
    </div>;
}