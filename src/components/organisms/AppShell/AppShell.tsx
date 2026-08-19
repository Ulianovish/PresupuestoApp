/**
 * AppShell - Organism Level
 *
 * Estructura de la app: barra lateral + contenido. Guarda si la barra está
 * oculta (para ganar espacio) y ajusta el margen del contenido en consecuencia.
 * La preferencia se recuerda entre sesiones en localStorage.
 */
'use client';

import { useEffect, useState } from 'react';

import Sidebar from '@/components/organisms/Sidebar/Sidebar';

const STORAGE_KEY = 'sidebar-collapsed';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Restaurar la preferencia guardada
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className={collapsed ? '' : 'lg:pl-64'}>{children}</div>
    </>
  );
}
