/**
 * IngresosSection - Organism Level Component
 *
 * Componente que renderiza la sección de ingresos con lista editable de registros.
 * Muestra una tabla con todos los ingresos editables o un estado vacío si no hay datos.
 * Ahora incluye funcionalidad completa de CRUD (crear, leer, actualizar, eliminar).
 *
 * @param ingresos - Lista de ingresos
 * @param formatCurrency - Función para formatear moneda
 * @param onEditIngreso - Callback para editar un ingreso
 * @param onDeleteIngreso - Callback para eliminar un ingreso
 * @param isLoading - Estado de carga para operaciones async
 *
 * @example
 * <IngresosSection
 *   ingresos={[]}
 *   formatCurrency={(amount) => `$${amount.toLocaleString()}`}
 *   onEditIngreso={handleEdit}
 *   onDeleteIngreso={handleDelete}
 *   isLoading={false}
 * />
 */

import React from 'react';

import { TrendingUp } from 'lucide-react';

import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import IngresoRow from '@/components/molecules/IngresoRow/IngresoRow';
import QuickAddButtons from '@/components/molecules/QuickAddButtons/QuickAddButtons';

interface Ingreso {
  id: string;
  descripcion: string;
  fuente: string;
  monto: number;
  fecha: string;
}

// Tipo para datos de edición compatible con IngresoRow
interface IngresoEditCallback {
  descripcion?: string;
  fuente?: string;
  monto?: number;
  fecha?: string;
}

interface IngresosSectionProps {
  ingresos: Ingreso[];
  formatCurrency: (amount: number) => string;
  onEditIngreso: (
    id: string,
    datosActualizados: IngresoEditCallback,
  ) => Promise<void>;
  onDeleteIngreso: (id: string) => Promise<void>;
  onQuickAddIngreso?: () => void;
  isLoading?: boolean;
}

export default function IngresosSection({
  ingresos,
  formatCurrency,
  onEditIngreso,
  onDeleteIngreso,
  onQuickAddIngreso,
  isLoading = false,
}: IngresosSectionProps) {
  // Función wrapper para convertir tipos
  const handleEditIngreso = async (
    id: string,
    datosActualizados: IngresoEditCallback,
  ) => {
    await onEditIngreso(id, datosActualizados);
  };

  return (
    <Card variant="glass" className="h-fit">
      <CardHeader className="px-6 py-4">
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Ingresos Recientes
          </div>
          {onQuickAddIngreso && (
            <QuickAddButtons onAction={onQuickAddIngreso} type="ingreso" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {ingresos.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No hay ingresos registrados</p>
          </div>
        ) : (
          <div className="space-y-3 p-2">
            {ingresos.map(ingreso => (
              <IngresoRow
                key={ingreso.id}
                ingreso={ingreso}
                formatCurrency={formatCurrency}
                onEdit={handleEditIngreso}
                onDelete={onDeleteIngreso}
                isLoading={isLoading}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
