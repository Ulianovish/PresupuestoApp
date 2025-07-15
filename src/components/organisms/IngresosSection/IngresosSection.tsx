/**
 * IngresosSection - Organism Level Component
 *
 * Componente que renderiza la sección de ingresos con la lista de registros.
 * Muestra una tabla con todos los ingresos o un estado vacío si no hay datos.
 *
 * @param ingresos - Lista de ingresos
 * @param formatCurrency - Función para formatear moneda
 *
 * @example
 * <IngresosSection
 *   ingresos={[]}
 *   formatCurrency={(amount) => `$${amount.toLocaleString()}`}
 * />
 */

import React from 'react';

import { TrendingUp } from 'lucide-react';

import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';

interface Ingreso {
  id: string;
  descripcion: string;
  fuente: string;
  monto: number;
  fecha: string;
}

interface IngresosSectionProps {
  ingresos: Ingreso[];
  formatCurrency: (amount: number) => string;
}

export default function IngresosSection({
  ingresos,
  formatCurrency,
}: IngresosSectionProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Ingresos Recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ingresos.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No hay ingresos registrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ingresos.slice(0, 5).map(ingreso => (
              <div
                key={ingreso.id}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div>
                  <p className="text-white font-medium">
                    {ingreso.descripcion}
                  </p>
                  <p className="text-sm text-gray-400">
                    {ingreso.fuente} • {ingreso.fecha}
                  </p>
                </div>
                <p
                  className={`font-bold ${ingreso.monto > 0 ? 'text-emerald-400' : 'text-gray-500'}`}
                >
                  {ingreso.monto > 0
                    ? formatCurrency(ingreso.monto)
                    : 'Pendiente'}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
