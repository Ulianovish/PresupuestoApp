/**
 * PresupuestoPage - Página de presupuesto mensual con Supabase
 * Permite seleccionar mes y muestra datos reales de la base de datos
 */
"use client";

import React, { useState, useEffect } from "react";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";
import Button from "@/components/atoms/Button/Button";
import MonthSelector from "@/components/atoms/MonthSelector/MonthSelector";
import { ChevronDown, ChevronRight, Edit, Plus, Database, AlertCircle, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMonthlyBudget } from "@/hooks/useMonthlyBudget";
import { getAvailableMonths, formatCurrency } from "@/lib/services/budget";
import { migrateJulyData, checkMigrationStatus } from "@/scripts/migrate-july-data";

// Estado del modal
interface ModalState {
  isOpen: boolean;
  mode: 'add' | 'edit';
  categoriaId: string;
  item?: {
    id: string;
    descripcion: string;
    fecha: string;
    clasificacion: string;
    control: string;
    presupuestado: number;
    real: number;
  };
}

// Interfaz para el formulario
interface FormData {
  descripcion: string;
  fecha: string;
  clasificacion: 'Fijo' | 'Variable' | 'Discrecional';
  control: 'Necesario' | 'Discrecional';
  presupuestado: number;
  real: number;
}

export default function PresupuestoPage() {
  // Hook personalizado para manejar presupuesto mensual
  const {
    budgetData,
    categories,
    isLoading,
    error,
    selectedMonth,
    setSelectedMonth,
    refreshBudget,
    toggleCategory,
    addBudgetItem,
    editBudgetItem,
    initializeMonth
  } = useMonthlyBudget('2025-07');

  // Estado del modal
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    mode: 'add',
    categoriaId: '',
    item: undefined
  });

  // Estado del formulario
  const [formData, setFormData] = useState<FormData>({
    descripcion: '',
    fecha: '',
    clasificacion: 'Fijo',
    control: 'Necesario',
    presupuestado: 0,
    real: 0
  });

  // Estado de migración
  const [migrationStatus, setMigrationStatus] = useState<{
    checking: boolean;
    migrated: boolean;
    migrating: boolean;
  }>({
    checking: true,
    migrated: false,
    migrating: false
  });

  // Verificar estado de migración al cargar
  useEffect(() => {
    checkMigration();
  }, []);

  /**
   * Verifica si los datos ya fueron migrados
   */
  const checkMigration = async () => {
    setMigrationStatus(prev => ({ ...prev, checking: true }));
    
    try {
      const status = await checkMigrationStatus();
      setMigrationStatus(prev => ({
        ...prev,
        checking: false,
        migrated: status.migrated
      }));
    } catch (error) {
      console.error('Error verificando migración:', error);
      setMigrationStatus(prev => ({
        ...prev,
        checking: false,
        migrated: false
      }));
    }
  };

  /**
   * Ejecuta la migración de datos de julio
   */
  const handleMigration = async () => {
    setMigrationStatus(prev => ({ ...prev, migrating: true }));
    
    try {
      const result = await migrateJulyData();
      
      if (result.success) {
        setMigrationStatus(prev => ({
          ...prev,
          migrating: false,
          migrated: true
        }));
        
        // Refrescar los datos después de la migración
        await refreshBudget();
      } else {
        throw new Error(result.error || 'Error en la migración');
      }
    } catch (error) {
      console.error('Error durante la migración:', error);
      setMigrationStatus(prev => ({ ...prev, migrating: false }));
    }
  };

  /**
   * Maneja el cambio de mes
   */
  const handleMonthChange = async (newMonth: string) => {
    setSelectedMonth(newMonth);
    
    // Si el mes no tiene datos, ofrecer crearlo
    if (!categories.length && !isLoading) {
      const shouldCreate = confirm(`No hay datos para ${getAvailableMonths().find(m => m.value === newMonth)?.label}. ¿Deseas crear un presupuesto para este mes?`);
      
      if (shouldCreate) {
        await initializeMonth(newMonth);
      }
    }
  };

  /**
   * Abre el modal para agregar un nuevo item
   */
  const openAddModal = (categoriaId: string) => {
    setModalState({
      isOpen: true,
      mode: 'add',
      categoriaId,
      item: undefined
    });
    setFormData({
      descripcion: '',
      fecha: '',
      clasificacion: 'Fijo',
      control: 'Necesario',
      presupuestado: 0,
      real: 0
    });
  };

  /**
   * Abre el modal para editar un item
   */
  const openEditModal = (categoriaId: string, item: any) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      categoriaId,
      item
    });
    setFormData({
      descripcion: item.descripcion,
      fecha: item.fecha,
      clasificacion: item.clasificacion,
      control: item.control,
      presupuestado: item.presupuestado,
      real: item.real
    });
  };

  /**
   * Cierra el modal
   */
  const closeModal = () => {
    setModalState({
      isOpen: false,
      mode: 'add',
      categoriaId: '',
      item: undefined
    });
    setFormData({
      descripcion: '',
      fecha: '',
      clasificacion: 'Fijo',
      control: 'Necesario',
      presupuestado: 0,
      real: 0
    });
  };

  /**
   * Guarda los cambios del formulario
   */
  const handleSave = async () => {
    try {
      if (modalState.mode === 'add') {
        const success = await addBudgetItem(modalState.categoriaId, formData);
        if (!success) {
          alert('Error al agregar el item del presupuesto');
          return;
        }
      } else if (modalState.mode === 'edit' && modalState.item) {
        const success = await editBudgetItem(modalState.item.id, formData);
        if (!success) {
          alert('Error al actualizar el item del presupuesto');
          return;
        }
      }
      
      closeModal();
    } catch (error) {
      console.error('Error guardando:', error);
      alert('Error al guardar los cambios');
    }
  };

  /**
   * Obtiene el color para las clasificaciones
   */
  const getClasificacionColor = (clasificacion: string) => {
    switch (clasificacion) {
      case "Fijo":
        return "bg-blue-900/30 text-blue-300";
      case "Variable":
        return "bg-purple-900/30 text-purple-300";
      case "Discrecional":
        return "bg-amber-900/30 text-amber-300";
      default:
        return "bg-gray-900/30 text-gray-300";
    }
  };

  /**
   * Obtiene el color para los controles
   */
  const getControlColor = (control: string) => {
    switch (control) {
      case "Necesario":
        return "bg-emerald-900/30 text-emerald-300";
      case "Discrecional":
        return "bg-amber-900/30 text-amber-300";
      default:
        return "bg-gray-900/30 text-gray-300";
    }
  };

  // Opciones para el selector de mes
  const monthOptions = getAvailableMonths();
  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header con selector de mes */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400 mb-2">
              Presupuesto Mensual
            </h1>
            <p className="text-gray-300">
              Presupuestado vs Real - {selectedMonthLabel}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Selector de mes */}
            <MonthSelector
              value={selectedMonth}
              onChange={handleMonthChange}
              options={monthOptions}
              disabled={isLoading}
              className="min-w-[200px]"
            />

            {/* Botón de refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshBudget}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Panel de migración (solo si no hay datos migrados) */}
        {migrationStatus.checking ? (
          <Card variant="glass" className="p-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
              <span className="text-gray-300">Verificando datos...</span>
            </div>
          </Card>
        ) : !migrationStatus.migrated && selectedMonth === '2025-07' ? (
          <Card variant="glass" className="p-6 border-amber-500/20">
            <div className="flex items-start gap-4">
              <Database className="w-6 h-6 text-amber-400 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-400 mb-2">
                  Migrar Datos Iniciales
                </h3>
                <p className="text-gray-300 mb-4">
                  Para empezar con datos reales de julio 2025, puedes migrar los datos de ejemplo a Supabase.
                  Esto creará todas las categorías y elementos del presupuesto en la base de datos.
                </p>
                <Button
                  variant="gradient"
                  onClick={handleMigration}
                  disabled={migrationStatus.migrating}
                  className="flex items-center gap-2"
                >
                  {migrationStatus.migrating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Migrando datos...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      Migrar Datos de Julio
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Mensaje de error */}
        {error && (
          <Card variant="glass" className="p-6 border-red-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-red-400 mb-1">Error</h3>
                <p className="text-gray-300">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Estado de carga */}
        {isLoading && (
          <Card variant="glass" className="p-8">
            <div className="flex items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
              <span className="text-gray-300 text-lg">Cargando presupuesto...</span>
            </div>
          </Card>
        )}

        {/* Tabla de categorías */}
        {!isLoading && categories.length > 0 && (
          <Card variant="glass" className="p-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Categorías de Presupuesto</span>
                <div className="text-sm text-gray-400">
                  Total: {formatCurrency(budgetData?.total_presupuestado || 0)} / {formatCurrency(budgetData?.total_real || 0)}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Descripción
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Clasificación
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Control
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Presupuestado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Real
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {categories.map((categoria) => (
                      <React.Fragment key={categoria.id}>
                        {/* Fila de categoría principal */}
                        <tr
                          className="bg-slate-800/50 hover:bg-slate-800/70 cursor-pointer transition-colors"
                          onClick={() => toggleCategory(categoria.id)}
                        >
                          <td className="px-4 py-4 font-semibold text-white flex items-center">
                            {categoria.expanded ? (
                              <ChevronDown className="w-4 h-4 mr-2" />
                            ) : (
                              <ChevronRight className="w-4 h-4 mr-2" />
                            )}
                            {categoria.nombre}
                          </td>
                          <td className="px-4 py-4 text-gray-300">-</td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-200">
                              Categoría
                            </span>
                          </td>
                          <td className="px-4 py-4 text-gray-300">-</td>
                          <td className="px-4 py-4 font-semibold text-blue-300">
                            {formatCurrency(categoria.totalPresupuestado)}
                          </td>
                          <td className="px-4 py-4 font-semibold text-emerald-300">
                            {formatCurrency(categoria.totalReal)}
                          </td>
                          <td className="px-4 py-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e?.stopPropagation();
                                openAddModal(categoria.id);
                              }}
                              className="flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Agregar
                            </Button>
                          </td>
                        </tr>

                        {/* Items de la categoría */}
                        {categoria.expanded &&
                          categoria.items.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-white/5 transition-colors bg-slate-900/30"
                            >
                              <td className="px-4 py-3 pl-12 text-gray-200">
                                {item.descripcion}
                              </td>
                              <td className="px-4 py-3 text-gray-300">
                                {item.fecha}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getClasificacionColor(
                                    item.clasificacion
                                  )}`}
                                >
                                  {item.clasificacion}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getControlColor(
                                    item.control
                                  )}`}
                                >
                                  {item.control}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-blue-300">
                                {formatCurrency(item.presupuestado)}
                              </td>
                              <td className="px-4 py-3 text-emerald-300">
                                {item.real > 0 ? formatCurrency(item.real) : "—"}
                              </td>
                              <td className="px-4 py-3">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditModal(categoria.id, item)}
                                  className="flex items-center gap-1"
                                >
                                  <Edit className="w-3 h-3" />
                                  Editar
                                </Button>
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mensaje cuando no hay datos */}
        {!isLoading && categories.length === 0 && !error && (
          <Card variant="glass" className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No hay datos para este mes</h3>
              <p className="text-sm">
                {selectedMonth === '2025-07' 
                  ? 'Usa el botón "Migrar Datos de Julio" para empezar con datos de ejemplo.'
                  : `No hay presupuesto creado para ${selectedMonthLabel}. Puedes crear uno nuevo.`
                }
              </p>
            </div>
            {selectedMonth !== '2025-07' && (
              <Button
                variant="gradient"
                onClick={() => initializeMonth(selectedMonth)}
                className="mt-4"
              >
                Crear Presupuesto para {selectedMonthLabel}
              </Button>
            )}
          </Card>
        )}

        {/* Modal para agregar/editar items */}
        <Dialog open={modalState.isOpen} onOpenChange={closeModal}>
          <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                {modalState.mode === 'add' ? 'Agregar Detalle' : 'Editar Detalle'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="descripcion" className="text-white">
                  Descripción
                </Label>
                <Input
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="Nombre del item"
                />
              </div>

              {/* Fecha */}
              <div className="space-y-2">
                <Label htmlFor="fecha" className="text-white">
                  Fecha
                </Label>
                <Input
                  id="fecha"
                  value={formData.fecha}
                  onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="Ej: 5/mes, 15/mes"
                />
              </div>

              {/* Clasificación */}
              <div className="space-y-2">
                <Label className="text-white">Clasificación</Label>
                <div className="flex gap-4">
                  {['Fijo', 'Variable', 'Discrecional'].map((tipo) => (
                    <label key={tipo} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="clasificacion"
                        value={tipo}
                        checked={formData.clasificacion === tipo}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          clasificacion: e.target.value as 'Fijo' | 'Variable' | 'Discrecional'
                        }))}
                        className="text-blue-500"
                      />
                      <span className="text-white text-sm">{tipo}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Control */}
              <div className="space-y-2">
                <Label className="text-white">Control</Label>
                <div className="flex gap-4">
                  {['Necesario', 'Discrecional'].map((tipo) => (
                    <label key={tipo} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="control"
                        value={tipo}
                        checked={formData.control === tipo}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          control: e.target.value as 'Necesario' | 'Discrecional'
                        }))}
                        className="text-blue-500"
                      />
                      <span className="text-white text-sm">{tipo}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Presupuestado */}
              <div className="space-y-2">
                <Label htmlFor="presupuestado" className="text-white">
                  Presupuestado
                </Label>
                <Input
                  id="presupuestado"
                  type="number"
                  value={formData.presupuestado}
                  onChange={(e) => setFormData(prev => ({ ...prev, presupuestado: Number(e.target.value) }))}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="0"
                />
              </div>

              {/* Real */}
              <div className="space-y-2">
                <Label htmlFor="real" className="text-white">
                  Real
                </Label>
                <Input
                  id="real"
                  type="number"
                  value={formData.real}
                  onChange={(e) => setFormData(prev => ({ ...prev, real: Number(e.target.value) }))}
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="0"
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button variant="gradient" onClick={handleSave}>
                  {modalState.mode === 'add' ? 'Agregar' : 'Guardar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 