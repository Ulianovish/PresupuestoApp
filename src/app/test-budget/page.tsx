'use client';

import React, { useState } from 'react';

import Button from '@/components/atoms/Button/Button';
import Card from '@/components/atoms/Card/Card';

/**
 * Página de test para debuggear la creación de presupuestos
 */
export default function TestBudgetPage() {
  const [selectedMonth, setSelectedMonth] = useState('2025-08');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([]);
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<Record<string, unknown> | null>(null);

  // Función para probar la creación de presupuesto usando API
  const testCreateBudget = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      console.error('🧪 Test - Iniciando test de creación para:', selectedMonth);

      const response = await fetch('/api/budget/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month_year: selectedMonth,
          template_name: `Presupuesto Test ${selectedMonth}`,
        }),
      });

      const data = await response.json();
      console.error('🧪 Test - Respuesta API:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Error en la API');
      }

      setResult(data);
      console.error('🧪 Test - ✅ Presupuesto creado exitosamente');

      // Recargar templates después de crear
      await loadTemplates();
    } catch (err: unknown) {
      console.error('🧪 Test - Error:', err);
      setError(err.message || 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  // Función para cargar templates existentes con conteo de items
  const loadTemplates = async () => {
    try {
      console.error('🧪 Test - Cargando templates con conteo de items...');

      // Importar función para obtener templates con items
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        console.error('🧪 Test - Usuario no autenticado');
        return;
      }

      // Obtener templates básicos
      const { data: basicTemplates, error: templateError } = await supabase
        .from('budget_templates')
        .select('*')
        .eq('user_id', user.user.id)
        .order('month_year', { ascending: true });

      if (templateError) {
        console.error('🧪 Test - Error obteniendo templates:', templateError);
        return;
      }

      // Para cada template, contar sus budget_items
      const templatesWithCounts = await Promise.all(
        (basicTemplates || []).map(async template => {
          const { data: items, error: itemsError } = await supabase
            .from('budget_items')
            .select('id', { count: 'exact' })
            .eq('template_id', template.id)
            .eq('is_active', true);

          return {
            ...template,
            items_count: itemsError ? 0 : items?.length || 0,
          };
        }),
      );

      setTemplates(templatesWithCounts);
      console.error(
        '🧪 Test - Templates cargados con conteos:',
        templatesWithCounts,
      );
    } catch (err) {
      console.error('🧪 Test - Error en loadTemplates:', err);

      // Fallback: usar API original
      try {
        const response = await fetch('/api/budget/create');
        const data = await response.json();

        if (response.ok) {
          setTemplates(data.templates || []);
          console.error(
            '🧪 Test - Templates cargados (fallback):',
            data.templates,
          );
        }
      } catch (fallbackErr) {
        console.error('🧪 Test - Error en fallback:', fallbackErr);
      }
    }
  };

  // Función para reparar presupuestos existentes sin items
  const fixExistingBudgets = async () => {
    setIsFixing(true);
    setFixResult(null);

    try {
      console.error(
        '🔧 Test - Iniciando reparación de presupuestos existentes...',
      );

      // Importar la función de reparación
      const { fixExistingBudgetsWithoutItems } = await import(
        '@/lib/services/budget-fix'
      );

      const result = await fixExistingBudgetsWithoutItems();

      console.error('🔧 Test - Resultado de reparación:', result);
      setFixResult(result);

      // Recargar templates después de reparar
      await loadTemplates();
    } catch (err: unknown) {
      console.error('🔧 Test - Error en reparación:', err);
      setError(`Error en reparación: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsFixing(false);
    }
  };

  // Cargar templates al montar el componente
  React.useEffect(() => {
    loadTemplates();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            🧪 Test de Creación de Presupuesto
          </h1>
          <p className="text-gray-300">
            Página para debuggear la funcionalidad de creación de presupuestos
            mensuales
          </p>
        </div>

        {/* Controles de test */}
        <Card variant="glass" className="p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Crear Nuevo Presupuesto
          </h2>

          <div className="space-y-4">
            {/* Selector de mes */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mes (YYYY-MM):
              </label>
              <input
                type="text"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                placeholder="2025-08"
                pattern="[0-9]{4}-[0-9]{2}"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Botón de test */}
            <Button
              variant="gradient"
              onClick={testCreateBudget}
              disabled={isLoading || !selectedMonth}
              className="w-full"
            >
              {isLoading
                ? 'Creando...'
                : `Crear Presupuesto para ${selectedMonth}`}
            </Button>
          </div>
        </Card>

        {/* Herramientas de reparación */}
        <Card variant="glass" className="p-6 border-amber-500/20">
          <h2 className="text-xl font-semibold text-amber-400 mb-4">
            🔧 Reparar Presupuestos Existentes
          </h2>

          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Esta herramienta copia budget_items del mes anterior a
              presupuestos que no tienen items.
            </p>

            <Button
              variant="outline"
              onClick={fixExistingBudgets}
              disabled={isFixing}
              className="w-full text-amber-400 border-amber-600 hover:bg-amber-700/20"
            >
              {isFixing ? 'Reparando...' : '🔧 Reparar Presupuestos Sin Items'}
            </Button>
          </div>
        </Card>

        {/* Resultados */}
        {error && (
          <Card variant="glass" className="p-6 border-red-500/20">
            <h3 className="text-lg font-semibold text-red-400 mb-2">
              ❌ Error
            </h3>
            <pre className="text-red-300 text-sm overflow-auto">{error}</pre>
          </Card>
        )}

        {result && (
          <Card variant="glass" className="p-6 border-green-500/20">
            <h3 className="text-lg font-semibold text-green-400 mb-2">
              ✅ Resultado Exitoso
            </h3>
            <pre className="text-green-300 text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </Card>
        )}

        {fixResult && (
          <Card variant="glass" className="p-6 border-amber-500/20">
            <h3 className="text-lg font-semibold text-amber-400 mb-2">
              🔧 Resultado de Reparación
            </h3>
            <div className="space-y-2 text-amber-300">
              <p>
                Templates reparados:{' '}
                <span className="font-bold">{fixResult.templatesFixed}</span>
              </p>
              <p>
                Items creados:{' '}
                <span className="font-bold">{fixResult.totalItemsCreated}</span>
              </p>
            </div>
            <pre className="text-amber-300 text-sm overflow-auto mt-4 bg-amber-900/20 p-2 rounded">
              {JSON.stringify(fixResult, null, 2)}
            </pre>
          </Card>
        )}

        {/* Templates existentes */}
        <Card variant="glass" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              Templates Existentes ({templates.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={loadTemplates}
              className="text-gray-300 border-gray-600 hover:bg-gray-700"
            >
              🔄 Actualizar
            </Button>
          </div>

          {templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map((template, index) => (
                <div
                  key={template.id || index}
                  className="p-3 bg-slate-700/50 rounded-lg border border-slate-600"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        {template.name}
                      </div>
                      <div className="text-gray-400 text-sm">
                        Mes: {template.month_year} | ID:{' '}
                        {template.id?.slice(0, 8)}...
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-gray-400 text-sm">
                        {template.is_active ? '✅ Activo' : '❌ Inactivo'}
                      </div>
                      <div className="text-xs">
                        {template.items_count !== undefined ? (
                          <span
                            className={
                              template.items_count > 0
                                ? 'text-green-400'
                                : 'text-red-400'
                            }
                          >
                            {template.items_count} items
                          </span>
                        ) : (
                          <span className="text-gray-500">Items: ?</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-4">
              No hay templates de presupuesto creados
            </div>
          )}
        </Card>

        {/* Información adicional */}
        <Card variant="glass" className="p-6">
          <h3 className="text-lg font-semibold text-white mb-2">
            ℹ️ Información de Debug
          </h3>
          <div className="text-gray-300 text-sm space-y-1">
            <p>
              • Esta página usa la API <code>/api/budget/create</code> para
              testear
            </p>
            <p>
              • Los logs aparecen en la consola del navegador y del servidor
            </p>
            <p>
              • La función SQL usada es <code>upsert_monthly_budget</code>
            </p>
            <p>
              • El mes actual debería ser creado automáticamente desde la página
              principal
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
