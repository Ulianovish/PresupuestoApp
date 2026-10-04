'use client';

/**
 * IndicadoresPage - Page Level
 *
 * Los 12 índices del test de realidad financiera, más el formulario de los
 * datos personales que cuatro de ellos necesitan.
 */

import React, { useCallback, useEffect, useState } from 'react';

import IndicesPanel from '@/components/organisms/IndicesPanel/IndicesPanel';
import PerfilFinancieroPanel from '@/components/organisms/PerfilFinancieroPanel/PerfilFinancieroPanel';
import { useMonth } from '@/contexts/MonthContext';
import {
  calcularIndices,
  type DatosFinancieros,
  type Indice,
} from '@/lib/indices-financieros';
import { formatMonthName } from '@/lib/services/expenses';
import { getDatosFinancieros } from '@/lib/services/indices';

export default function IndicadoresPage() {
  const { selectedMonth } = useMonth();
  const [indices, setIndices] = useState<Indice[]>([]);
  const [datos, setDatos] = useState<DatosFinancieros | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const cargar = useCallback(async () => {
    setIsLoading(true);
    try {
      const d = await getDatosFinancieros(selectedMonth);
      setDatos(d);
      setIndices(calcularIndices(d));
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold text-blue-400">
          Indicadores {formatMonthName(selectedMonth)}
        </h1>
        <p className="text-gray-300">Mi realidad financiera en 12 índices</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Calculando índices...</p>
      ) : (
        <IndicesPanel
          indices={indices}
          nombreMes={formatMonthName(selectedMonth)}
        />
      )}

      <PerfilFinancieroPanel
        onSaved={cargar}
        ingresoTrabajadoMes={
          datos ? datos.ingresosMes - datos.ingresoResidualMes : 0
        }
        nombreMes={formatMonthName(selectedMonth)}
      />
    </main>
  );
}
