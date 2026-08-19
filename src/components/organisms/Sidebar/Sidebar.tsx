/**
 * Sidebar - Organism Level
 *
 * Navegación principal en una barra lateral fija a la izquierda (escritorio):
 * logo, usuario, enlaces con icono, resumen de presupuesto, selector de año y
 * acceso a ajustes/cerrar sesión. La sección activa queda resaltada.
 *
 * En móvil se muestra una barra superior delgada con el botón de menú, que
 * abre el MobileSidebar existente.
 */
'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Calendar,
  ChevronsLeft,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  Settings,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';

import MobileSidebar from '@/components/molecules/MobileSidebar/MobileSidebar';
import { useMonth } from '@/contexts/MonthContext';
import { useBudgetData } from '@/hooks/useBudgetData';
import { logoutAction } from '@/lib/actions/auth';
import { supabase } from '@/lib/supabase/client';

import type { User as SupabaseUser } from '@supabase/supabase-js';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ingresos', label: 'Ingresos', icon: TrendingUp },
  { href: '/presupuesto', label: 'Presupuesto', icon: PieChart },
  { href: '/gastos', label: 'Gastos', icon: Wallet },
  { href: '/deudas', label: 'Deudas', icon: CreditCard },
  { href: '/test', label: 'Test', icon: FlaskConical },
];

interface SidebarProps {
  /** Oculta la barra lateral en escritorio para ganar espacio. */
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const { summary, formatCurrency, isLoading } = useBudgetData();
  const {
    selectedYear,
    setSelectedYear,
    getAvailableYears,
    selectedMonth,
    setSelectedMonth,
    getAvailableMonths,
  } = useMonth();
  const pathname = usePathname();

  // Usuario autenticado (para mostrar su correo y el cierre de sesión)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error verificando autenticación:', error);
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <>
      {/* Barra lateral (escritorio) */}
      <aside
        className={`${
          collapsed ? 'hidden' : 'hidden lg:flex'
        } fixed left-0 top-0 z-40 h-screen w-64 flex-col border-r border-white/10 bg-slate-800/40 backdrop-blur-md`}
      >
        {/* Logo + botón para ocultar */}
        <div className="flex items-center justify-between px-5 py-5">
          <Link
            href="/dashboard"
            className="text-2xl font-bold tracking-tight text-blue-400 select-none"
          >
            Presupuesto
          </Link>
          {onToggle && (
            <button
              onClick={onToggle}
              className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Ocultar menú"
              title="Ocultar menú"
            >
              <ChevronsLeft size={18} />
            </button>
          )}
        </div>

        {/* Usuario */}
        {user && (
          <div className="mx-3 mb-4 flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
              <User size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {user.email?.split('@')[0]}
              </p>
              <p className="truncate text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
        )}

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto px-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                    isActive(href)
                      ? 'bg-blue-500/20 text-blue-300 font-medium'
                      : 'text-gray-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Resumen de presupuesto */}
        <div className="mx-3 mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-gray-300">
              <Wallet className="h-3.5 w-3.5 text-blue-400" />
              Total
            </span>
            <span className="font-semibold text-white">
              {isLoading ? '...' : formatCurrency(summary.totalBudget)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-gray-300">
              <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              Gastado
            </span>
            <span className="font-semibold text-white">
              {isLoading ? '...' : formatCurrency(summary.totalSpent)}
            </span>
          </div>
        </div>

        {/* Mes */}
        <div className="mx-3 mb-3">
          <label className="mb-1 flex items-center gap-2 text-xs text-gray-300">
            <Calendar size={14} className="text-blue-400" />
            <span>Mes</span>
          </label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {getAvailableMonths().map(m => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Año */}
        <div className="mx-3 mb-3">
          <label className="mb-1 flex items-center gap-2 text-xs text-gray-300">
            <Calendar size={14} className="text-blue-400" />
            <span>Año</span>
          </label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
            className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {getAvailableYears().map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Ajustes y cerrar sesión */}
        <div className="border-t border-white/10 p-3">
          <Link
            href="/settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive('/settings')
                ? 'bg-blue-500/20 text-blue-300'
                : 'text-gray-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Settings size={18} />
            <span>Ajustes y cuentas</span>
          </Link>
          {user && (
            <form action={logoutAction}>
              <button
                type="submit"
                className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut size={18} />
                <span>Cerrar sesión</span>
              </button>
            </form>
          )}
        </div>
      </aside>

      {/* Botón flotante para mostrar la barra cuando está oculta (escritorio) */}
      {collapsed && onToggle && (
        <button
          onClick={onToggle}
          className="hidden lg:flex fixed left-3 top-3 z-40 items-center gap-2 rounded-lg border border-white/20 bg-slate-800/80 px-3 py-2 text-white backdrop-blur-md transition-colors hover:bg-white/10"
          aria-label="Mostrar menú"
          title="Mostrar menú"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Barra superior (móvil) */}
      <header className="lg:hidden fixed left-0 right-0 top-0 z-40 border-b border-white/20 bg-slate-800/60 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="rounded-lg p-2 text-white transition-colors hover:bg-white/10"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <span className="text-lg font-bold tracking-tight text-blue-400">
            Presupuesto
          </span>
          <span className="text-xs text-gray-300">
            {isLoading ? '...' : formatCurrency(summary.totalSpent)}
          </span>
        </div>
      </header>

      <MobileSidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
    </>
  );
}
