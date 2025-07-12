import React from 'react';
import { HomeIcon, DatabaseIcon, TrendingUpIcon, PlaneIcon } from 'lucide-react';
export function Navbar() {
  return <header className="fixed top-0 left-0 right-0 z-50">
      <nav className="bg-white/10 backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                Presupuesto 2025
              </span>
            </div>
            <div className="hidden md:flex space-x-6">
              <NavLink href="#" icon={<DatabaseIcon size={18} />} label="Datos" />
              <NavLink href="#" icon={<div size={18} />} label="Transacciones" />
              <NavLink href="#" icon={<TrendingUpIcon size={18} />} label="Deudas" />
              <NavLink href="#" icon={<HomeIcon size={18} />} label="Activos" />
              <NavLink href="#" icon={<PlaneIcon size={18} />} label="Viajes" />
            </div>
            <div className="md:hidden">
              <button className="p-2 rounded-md text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>
    </header>;
}
function NavLink({
  href,
  icon,
  label
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return <a href={href} className="flex items-center px-2 py-1 text-sm font-medium rounded-md text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200">
      <span className="mr-1.5">{icon}</span>
      {label}
    </a>;
}