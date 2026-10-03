/**
 * Sidebar - Organism Level
 *
 * Navegación principal en una barra lateral fija a la izquierda (escritorio):
 * logo, usuario, enlaces con icono, selectores de mes y año y acceso a
 * ajustes/cerrar sesión. La sección activa queda resaltada. No muestra
 * montos: los totales reales están en el dashboard y en presupuesto.
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
  Gauge,
  Landmark,
  LayoutDashboard,
  Moon,
  Sun,
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
import { useTema } from '@/contexts/ThemeContext';
import { logoutAction } from '@/lib/actions/auth';
import { supabase } from '@/lib/supabase/client';

import type { User as SupabaseUser } from '@supabase/supabase-js';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ingresos', label: 'Ingresos', icon: TrendingUp },
  { href: '/presupuesto', label: 'Presupuesto', icon: PieChart },
  { href: '/gastos', label: 'Gastos', icon: Wallet },
  { href: '/deudas', label: 'Deudas', icon: CreditCard },
  { href: '/activos', label: 'Activos', icon: Landmark },
  { href: '/indicadores', label: 'Indicadores', icon: Gauge },
];

interface SidebarProps {
  /** Oculta la barra lateral en escritorio para ganar espacio. */
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const {
    selectedYear,
    setSelectedYear,
    getAvailableYears,
    selectedMonth,
    setSelectedMonth,
    getAvailableMonths,
  } = useMonth();
  const pathname = usePathname();
  const { tema, alternarTema } = useTema();

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
        } fixed left-0 top-0 z-40 h-screen w-64 flex-col border-r border-slate-300 dark:border-white/10 bg-slate-800/40 backdrop-blur-md`}
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
              className="rounded-lg p-1.5 text-slate-600 dark:text-gray-300 transition-colors hover:bg-slate-200/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
              aria-label="Ocultar menú"
              title="Ocultar menú"
            >
              <ChevronsLeft size={18} />
            </button>
          )}
        </div>

        {/* Usuario */}
        {user && (
          <div className="mx-3 mb-4 flex items-center gap-3 rounded-lg bg-slate-200/50 dark:bg-white/5 px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
              <User size={18} className="text-slate-900 dark:text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {user.email?.split('@')[0]}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-gray-400">
                {user.email}
              </p>
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
                      : 'text-slate-700 dark:text-gray-200 hover:bg-slate-200/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mes */}
        <div className="mx-3 mb-3">
          <label className="mb-1 flex items-center gap-2 text-xs text-slate-600 dark:text-gray-300">
            <Calendar size={14} className="text-blue-400" />
            <span>Mes</span>
          </label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-200/60 dark:bg-slate-700/50 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {getAvailableMonths().map(m => (
              <option key={m.value} value={m.value}>
                {/* Solo el mes: el año ya se elige en el selector de abajo */}
                {m.label.replace(` ${selectedYear}`, '')}
              </option>
            ))}
          </select>
        </div>

        {/* Año */}
        <div className="mx-3 mb-3">
          <label className="mb-1 flex items-center gap-2 text-xs text-slate-600 dark:text-gray-300">
            <Calendar size={14} className="text-blue-400" />
            <span>Año</span>
          </label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-200/60 dark:bg-slate-700/50 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {getAvailableYears().map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        {/* Ajustes y cerrar sesión */}
        <div className="border-t border-slate-300 dark:border-white/10 p-3">
          {/* Interruptor de tema */}
          <button
            type="button"
            onClick={alternarTema}
            role="switch"
            aria-checked={tema === 'oscuro'}
            className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-gray-200 transition-colors hover:bg-slate-200/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
            title={
              tema === 'oscuro'
                ? 'Cambiar a tema claro'
                : 'Cambiar a tema oscuro'
            }
          >
            {tema === 'oscuro' ? <Moon size={18} /> : <Sun size={18} />}
            <span className="flex-1 text-left">
              {tema === 'oscuro' ? 'Tema oscuro' : 'Tema claro'}
            </span>
            <span
              className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                tema === 'oscuro' ? 'bg-blue-500' : 'bg-slate-500'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                  tema === 'oscuro' ? 'left-4.5' : 'left-0.5'
                }`}
              />
            </span>
          </button>

          <Link
            href="/settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive('/settings')
                ? 'bg-blue-500/20 text-blue-300'
                : 'text-slate-700 dark:text-gray-200 hover:bg-slate-200/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Settings size={18} />
            <span>Ajustes y cuentas</span>
          </Link>
          {user && (
            <form action={logoutAction}>
              <button
                type="submit"
                className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-gray-200 transition-colors hover:bg-slate-200/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
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
          className="hidden lg:flex fixed left-3 top-3 z-40 items-center gap-2 rounded-lg border border-slate-300 dark:border-white/20 bg-slate-800/80 px-3 py-2 text-slate-900 dark:text-white backdrop-blur-md transition-colors hover:bg-slate-200/70 dark:hover:bg-white/10"
          aria-label="Mostrar menú"
          title="Mostrar menú"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Barra superior (móvil) */}
      <header className="lg:hidden fixed left-0 right-0 top-0 z-40 border-b border-slate-300 dark:border-white/20 bg-slate-800/60 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="rounded-lg p-2 text-slate-900 dark:text-white transition-colors hover:bg-slate-200/70 dark:hover:bg-white/10"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <span className="text-lg font-bold tracking-tight text-blue-400">
            Presupuesto
          </span>
          {/* Espaciador del ancho del botón de menú: mantiene el título centrado */}
          <span className="w-[38px]" aria-hidden="true" />
        </div>
      </header>

      <MobileSidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
    </>
  );
}
