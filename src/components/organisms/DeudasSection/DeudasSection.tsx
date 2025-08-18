/**
 * DeudasSection - Organism Level Component
 *
 * Componente que renderiza la sección de deudas con lista editable de registros.
 * Muestra una tabla con todas las deudas editables o un estado vacío si no hay datos.
 * Incluye funcionalidad completa de CRUD para deudas.
 *
 * @param deudas - Lista de deudas
 * @param formatCurrency - Función para formatear moneda
 * @param onEditDeuda - Callback para editar una deuda
 * @param onDeleteDeuda - Callback para eliminar una deuda
 * @param isLoading - Estado de carga para operaciones async
 *
 * @example
 * <DeudasSection
 *   deudas={[]}
 *   formatCurrency={(amount) => `$${amount.toLocaleString()}`}
 *   onEditDeuda={handleEdit}
 *   onDeleteDeuda={handleDelete}
 *   isLoading={false}
 * />
 */

import React from 'react';

import { AlertCircle, CreditCard } from 'lucide-react';

import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import DeudaRow from '@/components/molecules/DeudaRow/DeudaRow';
import QuickAddButtons from '@/components/molecules/QuickAddButtons/QuickAddButtons';

interface Deuda {
  id: string;
  descripcion: string;
  acreedor: string;
  monto: number;
  fecha_vencimiento: string;
  pagada: boolean;
}

// Tipo para datos de edición compatible con DeudaRow
interface DeudaEditCallback {
  descripcion?: string;
  acreedor?: string;
  monto?: number;
  fecha_vencimiento?: string;
}

interface DeudasSectionProps {
  deudas: Deuda[];
  formatCurrency: (amount: number) => string;
  onEditDeuda: (
    id: string,
    datosActualizados: DeudaEditCallback,
  ) => Promise<void>;
  onDeleteDeuda: (id: string) => Promise<void>;
  onQuickAddDeuda?: () => void;
  isLoading?: boolean;
}

export default function DeudasSection({
  deudas,
  formatCurrency,
  onEditDeuda,
  onDeleteDeuda,
  onQuickAddDeuda,
  isLoading = false,
}: DeudasSectionProps) {
  return (
    <Card variant="glass" className="h-fit">
      <CardHeader className="px-6 py-4">
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Deudas Pendientes
          </div>
          {onQuickAddDeuda && (
            <QuickAddButtons onAction={onQuickAddDeuda} type="deuda" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {deudas.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No hay deudas registradas</p>
          </div>
        ) : (
          <div className="space-y-3 p-2">
            {deudas.map(deuda => (
              <DeudaRow
                key={deuda.id}
                deuda={deuda}
                formatCurrency={formatCurrency}
                onEdit={onEditDeuda}
                onDelete={onDeleteDeuda}
                isLoading={isLoading}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
