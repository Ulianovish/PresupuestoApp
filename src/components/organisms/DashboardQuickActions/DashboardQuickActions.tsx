/**
 * DashboardQuickActions - Organism Level Component
 *
 * Componente que renderiza los botones de acciones rápidas del dashboard.
 * Incluye botones para agregar gasto, editar presupuesto y ver gastos.
 *
 * @example
 * <DashboardQuickActions />
 */

import React from 'react';

import Link from 'next/link';

import { Plus, Edit3, PieChart } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import { NUEVO_GASTO_HREF } from '@/lib/onboarding/nuevo-gasto';

export default function DashboardQuickActions() {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Agregar Gasto: /gastos abre el formulario al ver ?nuevo=1 */}
      <Link href={NUEVO_GASTO_HREF} className="flex-1">
        <Button variant="gradient" size="lg" className="w-full">
          <Plus className="w-5 h-5 mr-2" />
          Agregar Gasto
        </Button>
      </Link>

      {/* Editar Presupuesto */}
      <Link href="/presupuesto" className="flex-1">
        <Button variant="glass" size="lg" className="w-full">
          <Edit3 className="w-5 h-5 mr-2" />
          Editar Presupuesto
        </Button>
      </Link>

      {/* Ver Gastos */}
      <Link href="/gastos" className="flex-1">
        <Button
          variant="outline"
          size="lg"
          className="w-full text-white border-slate-600 hover:bg-slate-700"
        >
          <PieChart className="w-5 h-5 mr-2" />
          Ver Gastos
        </Button>
      </Link>
    </div>
  );
}
