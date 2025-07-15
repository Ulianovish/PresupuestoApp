/**
 * DeudasSection - Organism Level Component
 *
 * Componente que renderiza la sección de deudas con la lista de registros.
 * Muestra una tabla con todas las deudas o un estado vacío si no hay datos.
 *
 * @param deudas - Lista de deudas
 * @param formatCurrency - Función para formatear moneda
 *
 * @example
 * <DeudasSection
 *   deudas={[]}
 *   formatCurrency={(amount) => `$${amount.toLocaleString()}`}
 * />
 */

import React from 'react';

import { AlertCircle, CreditCard } from 'lucide-react';

import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';

interface Deuda {
  id: string;
  descripcion: string;
  acreedor: string;
  monto: number;
  fecha_vencimiento: string;
  pagada: boolean;
}

interface DeudasSectionProps {
  deudas: Deuda[];
  formatCurrency: (amount: number) => string;
}

export default function DeudasSection({
  deudas,
  formatCurrency,
}: DeudasSectionProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          Deudas Pendientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deudas.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No hay deudas registradas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deudas.slice(0, 5).map(deuda => (
              <div
                key={deuda.id}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
              >
                <div>
                  <p className="text-white font-medium">{deuda.descripcion}</p>
                  <p className="text-sm text-gray-400">
                    {deuda.acreedor} • Vence:{' '}
                    {new Date(deuda.fecha_vencimiento).toLocaleDateString(
                      'es-CO',
                    )}
                  </p>
                </div>
                <p
                  className={`font-bold ${deuda.pagada ? 'text-green-400' : 'text-orange-400'}`}
                >
                  {formatCurrency(deuda.monto)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
