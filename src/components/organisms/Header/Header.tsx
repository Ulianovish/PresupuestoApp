/**
 * Header - Organism Level
 * 
 * Header principal con navegación para la app de presupuesto.
 * Incluye enlaces a Dashboard, Presupuesto, Gastos y Test, con iconos y glassmorphism.
 * Es fixed y semitransparente al hacer scroll.
 * Muestra siempre los valores de presupuesto total y gastado.
 * En móviles, usa un menú lateral deslizable con icono de hamburguesa.
 * Incluye menú de usuario con email y logout.
 */
"use client";

import Link from "next/link";
import { LayoutDashboard, PieChart, ReceiptText, FlaskConical, Wallet, TrendingUp, Menu, User, LogOut, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useBudgetData } from "@/hooks/useBudgetData";
import MobileSidebar from "@/components/molecules/MobileSidebar/MobileSidebar";
import { supabase } from "@/lib/supabase/client";
import { logoutAction } from "@/lib/actions/auth";
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const { summary, formatCurrency, isLoading } = useBudgetData();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Verificar autenticación y obtener usuario
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error verificando autenticación:', error);
      }
    };

    checkAuth();

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Función para abrir/cerrar el menú móvil
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Función para abrir/cerrar el menú de usuario
  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  // Función para logout
  const handleLogout = async () => {
    try {
      await logoutAction();
    } catch (error) {
      console.error('Error al hacer logout:', error);
    }
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
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-300">Total:</span>
              <span className="font-semibold text-white">
                {isLoading ? "..." : formatCurrency(summary.totalBudget)}
              </span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-300">Gastado:</span>
              <span className="font-semibold text-white">
                {isLoading ? "..." : formatCurrency(summary.totalSpent)}
              </span>
            </div>
          </div>

          {/* Navegación desktop */}
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

          {/* Menú de usuario y menú móvil */}
          <div className="flex items-center gap-3">
            {/* Menú de usuario - visible cuando está logueado */}
            {user && (
              <div className="relative">
                <button
                  onClick={toggleUserMenu}
                  className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Menú de usuario"
                  aria-expanded={isUserMenuOpen}
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User size={16} className="text-white" />
                  </div>
                  <span className="text-sm font-medium truncate max-w-32">
                    {user.email?.split('@')[0]}
                  </span>
                  <ChevronDown size={16} className={`transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown del menú de usuario */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800/95 backdrop-blur-sm rounded-lg border border-white/20 shadow-xl z-50">
                    <div className="p-4 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <User size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.email?.split('@')[0]}</p>
                          <p className="text-gray-400 text-sm">{user.email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <form action={logoutAction}>
                        <button
                          type="submit"
                          className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                          <LogOut size={18} />
                          <span>Cerrar Sesión</span>
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botón de menú móvil */}
            <button
              onClick={toggleMobileMenu}
              className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Abrir menú de navegación"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu size={24} />
            </button>
          </div>
        </nav>
      </header>

      {/* Menú lateral móvil */}
      <MobileSidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />

      {/* Overlay para cerrar menú de usuario al hacer clic fuera */}
      {isUserMenuOpen && (
        <div 
          className="fixed inset-0 z-30" 
          onClick={() => setIsUserMenuOpen(false)}
        />
      )}
    </>
  );
} 