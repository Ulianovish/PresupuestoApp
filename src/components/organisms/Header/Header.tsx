/**
 * Header - Organism Level
 * 
 * Header principal con navegación para la app de presupuesto.
 * Incluye enlaces a Dashboard, Presupuesto, Gastos y Test, con iconos y glassmorphism.
 * Es fixed y semitransparente al hacer scroll.
 * Muestra siempre los valores de presupuesto total y gastado.
 * En móviles, usa un menú lateral deslizable con icono de hamburguesa.
 */
"use client";

import Link from "next/link";
import { LayoutDashboard, PieChart, ReceiptText, FlaskConical, Wallet, TrendingUp, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useBudgetData } from "@/hooks/useBudgetData";
import MobileSidebar from "@/components/molecules/MobileSidebar/MobileSidebar";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { summary, formatCurrency, isLoading } = useBudgetData();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Función para abrir/cerrar el menú móvil
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-slate-900/80 backdrop-blur-md shadow-lg border-b border-white/20"
            : "bg-white/10 dark:bg-slate-800/30 backdrop-blur-md border-b border-white/20"
        }`}
      >
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
          {/* Logo y título */}
          <div className="flex items-center gap-3">
            <span className="text-xl sm:text-2xl font-bold text-blue-400 tracking-tight select-none">
              Presupuesto
            </span>
          </div>

          {/* Valores de presupuesto - visible en desktop */}
          <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
            {isLoading ? (
              <div className="flex items-center gap-4">
                <div className="animate-pulse flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500/30 rounded"></div>
                  <div className="w-20 h-4 bg-blue-500/30 rounded"></div>
                </div>
                <div className="w-px h-6 bg-white/20"></div>
                <div className="animate-pulse flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500/30 rounded"></div>
                  <div className="w-20 h-4 bg-green-500/30 rounded"></div>
                </div>
              </div>
            ) : (
              <>
                {/* Presupuesto Total */}
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-blue-400" />
                  <div className="text-sm">
                    <span className="text-gray-400">Total: </span>
                    <span className="font-semibold text-blue-300">
                      {formatCurrency(summary.totalBudget)}
                    </span>
                  </div>
                </div>

                {/* Separador */}
                <div className="w-px h-6 bg-white/20"></div>

                {/* Gastado */}
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-green-400" />
                  <div className="text-sm">
                    <span className="text-gray-400">Gastado: </span>
                    <span className="font-semibold text-green-300">
                      {formatCurrency(summary.totalSpent)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Valores de presupuesto compactos para móviles */}
          <div className="flex lg:hidden items-center gap-2 px-2 py-1 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
            {isLoading ? (
              <div className="animate-pulse flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500/30 rounded"></div>
                <div className="w-16 h-3 bg-blue-500/30 rounded"></div>
              </div>
            ) : (
              <>
                <Wallet size={14} className="text-blue-400" />
                <div className="text-xs">
                  <span className="font-semibold text-blue-300">
                    {formatCurrency(summary.totalBudget).replace(/\s/g, '')}
                  </span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="font-semibold text-green-300">
                    {formatCurrency(summary.totalSpent).replace(/\s/g, '')}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Navegación Desktop */}
          <ul className="hidden lg:flex gap-6 text-md font-medium">
            <li>
              <Link href="/dashboard" className="flex items-center gap-1 text-white hover:text-blue-400 transition-colors">
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </Link>
            </li>
            <li>
              <Link href="/presupuesto" className="flex items-center gap-1 text-white hover:text-blue-400 transition-colors">
                <PieChart size={18} />
                <span>Presupuesto</span>
              </Link>
            </li>
            <li>
              <Link href="/gastos" className="flex items-center gap-1 text-white hover:text-blue-400 transition-colors">
                <ReceiptText size={18} />
                <span>Gastos</span>
              </Link>
            </li>
            <li>
              <Link href="/test" className="flex items-center gap-1 text-white hover:text-blue-400 transition-colors">
                <FlaskConical size={18} />
                <span>Test</span>
              </Link>
            </li>
          </ul>

          {/* Botón de menú móvil */}
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Abrir menú de navegación"
            aria-expanded={isMobileMenuOpen}
          >
            <Menu size={24} />
          </button>
        </nav>
      </header>

      {/* Menú lateral móvil */}
      <MobileSidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
    </>
  );
} 