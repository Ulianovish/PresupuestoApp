/**
 * MobileSidebar - Molecule Level
 *
 * Menú lateral deslizable para navegación en dispositivos móviles.
 * Incluye animaciones, overlay de fondo, y accesibilidad completa.
 *
 * @param isOpen - Estado de apertura/cierre del menú
 * @param onClose - Función para cerrar el menú
 * @param className - Clases CSS adicionales
 *
 * @example
 * <MobileSidebar
 *   isOpen={isMenuOpen}
 *   onClose={() => setIsMenuOpen(false)}
 * />
 */
'use client';

import { useEffect, useRef } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  LayoutDashboard,
  PieChart,
  ReceiptText,
  FlaskConical,
  TrendingUp,
  X,
  Home,
} from 'lucide-react';

import { cn } from '@/lib/utils';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

// Enlaces de navegación
const navigationLinks = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Panel principal de control',
  },
  {
    href: '/presupuesto',
    label: 'Presupuesto',
    icon: PieChart,
    description: 'Gestión de presupuesto mensual',
  },
  {
    href: '/gastos',
    label: 'Gastos',
    icon: ReceiptText,
    description: 'Seguimiento de gastos',
  },
  {
    href: '/ingresos-deudas',
    label: 'Ingresos/Deudas',
    icon: TrendingUp,
    description: 'Gestión de ingresos y deudas',
  },
  {
    href: '/test',
    label: 'Test',
    icon: FlaskConical,
    description: 'Página de pruebas',
  },
];

export default function MobileSidebar({
  isOpen,
  onClose,
  className = '',
}: MobileSidebarProps) {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Manejo de tecla ESC para cerrar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevenir scroll del body cuando el menú está abierto
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Focus trap - mantener el foco dentro del menú
  useEffect(() => {
    if (isOpen && sidebarRef.current) {
      const firstFocusableElement = sidebarRef.current.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;

      if (firstFocusableElement) {
        firstFocusableElement.focus();
      }
    }
  }, [isOpen]);

  // Si no está abierto, no renderizar nada
  if (!isOpen) return null;

  return (
    <div className={cn('fixed inset-0 z-50 lg:hidden', className)}>
      {/* Overlay de fondo */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menú lateral */}
      <div
        ref={sidebarRef}
        className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-slate-900/95 backdrop-blur-md border-r border-white/20 shadow-xl transform transition-transform duration-300 ease-in-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-menu-title"
      >
        <div className="flex flex-col h-full">
          {/* Header del menú */}
          <div className="flex items-center justify-between p-6 border-b border-white/20">
            <div>
              <h2
                id="mobile-menu-title"
                className="text-xl font-bold text-blue-400 tracking-tight"
              >
                Presupuesto
              </h2>
              <p className="text-sm text-gray-400 mt-1">Navegación principal</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Cerrar menú"
            >
              <X size={24} />
            </button>
          </div>

          {/* Lista de navegación */}
          <nav className="flex-1 p-6">
            <ul className="space-y-2">
              {navigationLinks.map(link => {
                const isActive = pathname === link.href;
                const Icon = link.icon;

                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group',
                        isActive
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 border border-transparent'
                      )}
                    >
                      <Icon
                        size={20}
                        className={cn(
                          'transition-colors',
                          isActive
                            ? 'text-blue-400'
                            : 'text-gray-400 group-hover:text-white'
                        )}
                      />
                      <div>
                        <div className="font-medium">{link.label}</div>
                        <div className="text-xs text-gray-500 group-hover:text-gray-400">
                          {link.description}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer del menú */}
          <div className="p-6 border-t border-white/20">
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <Home size={16} />
              <span>Aplicación de Presupuesto</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Versión 1.0 - Construido con Next.js y shadcn/ui
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
