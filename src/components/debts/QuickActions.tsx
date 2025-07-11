import React from 'react';
import { PlusIcon, CheckSquareIcon } from 'lucide-react';
export function QuickActions() {
  return <div className="flex flex-col space-y-3">
      <button className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden" aria-label="Nueva Deuda">
        <PlusIcon className="h-6 w-6" />
      </button>
      <div className="hidden md:flex md:flex-col md:space-y-3">
        <button className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-md shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <PlusIcon className="h-5 w-5 mr-2" />
          <span>Nueva Deuda</span>
        </button>
        <button className="flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <CheckSquareIcon className="h-5 w-5 mr-2" />
          <span>Pagar Múltiples</span>
        </button>
      </div>
    </div>;
}