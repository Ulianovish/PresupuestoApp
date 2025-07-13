/**
 * GastosPage - Página para gestionar gastos mensuales
 * Conectada con Supabase, incluye selector de mes y funcionalidad CRUD completa
 */
"use client";

import React, { useState } from "react";
import Button from "@/components/atoms/Button/Button";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";
import MonthSelector from "@/components/atoms/MonthSelector/MonthSelector";
import { useMonthlyExpenses } from "@/hooks/useMonthlyExpenses";
import { migrateJulyExpenses, checkMigrationStatus } from "@/scripts/migrate-july-expenses";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  EXPENSE_CATEGORIES, 
  ACCOUNT_TYPES, 
  formatCurrency, 
  formatMonthName,
  ExpenseFormData,
  ExpenseTransaction 
} from "@/lib/services/expenses";

// Interfaz para el formulario
interface FormData {
  description: string;
  amount: number;
  transaction_date: string;
  category_name: string;
  account_name: string;
  place: string;
}

export default function GastosPage() {
  // Hook para manejar gastos mensuales
  const {
    expenseData,
    accounts,
    loading,
    error,
    selectedMonth,
    availableMonths,
    isModalOpen,
    isEditing,
    editingTransaction,
    setSelectedMonth,
    refreshExpenses,
    openModal,
    closeModal,
    addExpense,
    editExpense,
    updateExpense,
    deleteExpense,
    getTotalByCategory,
    getTransactionsByCategory
  } = useMonthlyExpenses();

  // Estados locales
  const [selectedOption, setSelectedOption] = useState<'manual' | 'factura' | 'cufe' | null>(null);
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{
    hasJulyData: boolean;
    expenseCount: number;
    totalAmount: number;
  } | null>(null);

  // Estado del formulario
  const [form, setForm] = useState<FormData>({
    description: "",
    amount: 0,
    transaction_date: new Date().toISOString().slice(0, 10),
    category_name: EXPENSE_CATEGORIES[0],
    account_name: ACCOUNT_TYPES[0],
    place: "",
  });

  // Cargar datos de migración al mostrar el panel
  const handleShowMigrationPanel = async () => {
    setShowMigrationPanel(true);
    try {
      const status = await checkMigrationStatus();
      setMigrationStatus(status);
    } catch (error) {
      console.error('Error verificando estado de migración:', error);
    }
  };

  // Ejecutar migración de julio
  const handleMigrateJuly = async () => {
    try {
      const result = await migrateJulyExpenses();
      
              if (result.success) {
          await refreshExpenses();
          setSelectedMonth('2025-07');
          setShowMigrationPanel(false);
          alert('¡Migración completada exitosamente!');
        } else {
          alert(`Error en migración: ${result.errors.join(', ')}`);
        }
    } catch (error) {
      console.error('Error ejecutando migración:', error);
      alert('Error ejecutando migración');
    }
  };

  // Maneja cambios en el formulario
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ 
      ...prev, 
      [name]: name === "amount" ? Number(value) : value 
    }));
  };

  // Preparar formulario para edición
  const handleEditTransaction = (transaction: ExpenseTransaction) => {
    setForm({
      description: transaction.description,
      amount: transaction.amount,
      transaction_date: transaction.transaction_date,
      category_name: transaction.category_name,
      account_name: transaction.account_name,
      place: transaction.place || ""
    });
    editExpense(transaction);
  };

  // Agregar o actualizar gasto
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const expenseData: ExpenseFormData = {
        description: form.description,
        amount: form.amount,
        transaction_date: form.transaction_date,
        category_name: form.category_name,
        account_name: form.account_name,
        place: form.place || undefined
      };

      if (isEditing && editingTransaction) {
        await updateExpense(editingTransaction.id, expenseData);
      } else {
        await addExpense(expenseData);
      }

      // Limpiar formulario y cerrar modal
      setForm({
        description: "",
        amount: 0,
        transaction_date: new Date().toISOString().slice(0, 10),
        category_name: EXPENSE_CATEGORIES[0],
        account_name: ACCOUNT_TYPES[0],
        place: "",
      });
      closeModal();
      setSelectedOption(null);
      
    } catch (error) {
      console.error('Error guardando gasto:', error);
    }
  };

  // Maneja la selección de opción en el modal
  const handleOptionSelect = (option: 'manual' | 'factura' | 'cufe') => {
    setSelectedOption(option);
  };

  // Vuelve a la vista de opciones
  const handleGoBack = () => {
    setSelectedOption(null);
  };

  // Cierra el modal y resetea estados
  const handleCloseModal = () => {
    closeModal();
    setSelectedOption(null);
    setForm({
      description: "",
      amount: 0,
      transaction_date: new Date().toISOString().slice(0, 10),
      category_name: EXPENSE_CATEGORIES[0],
      account_name: ACCOUNT_TYPES[0],
      place: "",
    });
  };

  // Eliminar gasto con confirmación
  const handleDeleteExpense = async (transactionId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este gasto?')) {
      try {
        await deleteExpense(transactionId);
      } catch (error) {
        console.error('Error eliminando gasto:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header con título y controles */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-bold text-blue-400">
            Gastos - {formatMonthName(selectedMonth)}
          </h1>
          
          <div className="flex flex-wrap gap-4 items-center">
            {/* Selector de mes */}
            <MonthSelector
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={availableMonths.map(month => ({
                value: month,
                label: formatMonthName(month)
              }))}
              disabled={loading}
            />
            
            {/* Botón de actualizar */}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshExpenses}
              disabled={loading}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              🔄 Actualizar
            </Button>

            {/* Botón de migración (solo para julio) */}
            {selectedMonth === '2025-07' && (
              <Button
                variant="glass"
                size="sm"
                onClick={handleShowMigrationPanel}
                className="text-amber-400"
              >
                📦 Migrar Datos
              </Button>
            )}
          </div>
        </div>

        {/* Panel de migración */}
        {showMigrationPanel && (
                     <Card variant="glass" className="p-6 border-amber-500/20">
             <CardHeader>
               <CardTitle className="text-amber-400">🚀 Migración de Datos - Julio 2025</CardTitle>
             </CardHeader>
            <CardContent>
              {migrationStatus && (
                <div className="space-y-4">
                  {migrationStatus.hasJulyData ? (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                                             <p className="text-green-400">
                         ✅ Ya tienes {migrationStatus.expenseCount} gastos en julio 2025
                       </p>
                      <p className="text-slate-300">
                        Total: {formatCurrency(migrationStatus.totalAmount)}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                                             <p className="text-slate-300">
                         No tienes gastos registrados para julio 2025. 
                         ¿Quieres migrar los datos de ejemplo?
                       </p>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <p className="text-blue-400 font-semibold">Datos a migrar:</p>
                        <ul className="text-slate-300 text-sm mt-2 space-y-1">
                          <li>• Arriendo - $1,410,000</li>
                          <li>• Administración - $324,000</li>
                          <li>• Cobro cuota manejo - $14,495</li>
                          <li>• Didi - $6,930</li>
                          <li>• Gasolina - $50,000</li>
                          <li>• Lacena - $38,277</li>
                        </ul>
                      </div>
                      <div className="flex gap-3">
                                                 <Button variant="gradient" onClick={handleMigrateJuly}>
                           Migrar Datos de Julio
                         </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowMigrationPanel(false)}
                          className="border-slate-600 text-slate-300"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Estados de carga y error */}
        {loading && (
          <Card variant="glass" className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-300">Cargando gastos...</p>
          </Card>
        )}

        {error && (
          <Card variant="glass" className="p-6 border-red-500/20">
            <div className="text-red-400">
              ❌ Error: {error}
            </div>
          </Card>
        )}

        {/* Resumen de gastos */}
        {expenseData && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expenseData.summary.map((category) => (
              <Card key={category.category_name} variant="glass" className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-blue-300 font-semibold">{category.category_name}</h3>
                    <p className="text-slate-400 text-sm">{category.transaction_count} transacciones</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-300 font-bold">
                      {formatCurrency(category.total_amount)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
            
            {/* Total general */}
            <Card variant="gradient-border" className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-purple-300 font-semibold">TOTAL</h3>
                  <p className="text-slate-400 text-sm">{expenseData.transactions.length} transacciones</p>
                </div>
                <div className="text-right">
                  <p className="text-purple-300 font-bold text-lg">
                    {formatCurrency(expenseData.total_amount)}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tabla de transacciones */}
        {expenseData && !loading && (
          <Card variant="glass" className="p-6">
            <CardHeader>
              <CardTitle>Transacciones de {formatMonthName(selectedMonth)}</CardTitle>
            </CardHeader>
            <CardContent>
              {expenseData.transactions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 mb-4">No hay gastos registrados para este mes</p>
                  <Button variant="gradient" onClick={openModal}>
                    Agregar Primer Gasto
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Descripción</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Fecha</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Categoría</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Cuenta</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Lugar</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Valor</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {expenseData.transactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-white/5 transition-colors duration-150">
                          <td className="px-4 py-2 text-white">{transaction.description}</td>
                          <td className="px-4 py-2 text-white">{transaction.transaction_date}</td>
                          <td className="px-4 py-2 text-blue-300">{transaction.category_name}</td>
                          <td className="px-4 py-2 text-white">{transaction.account_name}</td>
                          <td className="px-4 py-2 text-white">{transaction.place || '-'}</td>
                          <td className="px-4 py-2 text-emerald-300 font-semibold">
                            {formatCurrency(transaction.amount)}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditTransaction(transaction)}
                                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                              >
                                ✏️
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteExpense(transaction.id)}
                                className="border-red-600 text-red-300 hover:bg-red-700"
                              >
                                🗑️
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Botón flotante para agregar gasto */}
        <Dialog open={isModalOpen} onOpenChange={isModalOpen ? handleCloseModal : openModal}>
          <DialogTrigger asChild>
            <button
              className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full w-16 h-16 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50"
              onClick={openModal}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[600px] bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                {selectedOption === null ? (isEditing ? "Editar gasto" : "Agregar nuevo gasto") : 
                 selectedOption === 'manual' ? (isEditing ? "Editar gasto" : "Agregar gasto manualmente") :
                 selectedOption === 'factura' ? "Escanear factura" :
                 "Escanear código CUFE"}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {selectedOption === null ? "Selecciona cómo quieres agregar tu gasto" :
                 selectedOption === 'manual' ? "Completa los datos del gasto" :
                 selectedOption === 'factura' ? "Funcionalidad próximamente disponible" :
                 "Funcionalidad próximamente disponible"}
              </DialogDescription>
            </DialogHeader>
            
            {selectedOption === null && !isEditing ? (
              // Vista de opciones principales (solo para agregar nuevo)
              <div className="grid grid-cols-1 gap-4 py-4">
                <button
                  onClick={() => handleOptionSelect('manual')}
                  className="flex items-center gap-4 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                >
                  <div className="bg-blue-500 p-3 rounded-full">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="text-white font-semibold">Agregar gasto manual</h3>
                    <p className="text-slate-400 text-sm">Ingresa los datos del gasto manualmente</p>
                  </div>
                </button>

                <button
                  onClick={() => handleOptionSelect('factura')}
                  className="flex items-center gap-4 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                >
                  <div className="bg-emerald-500 p-3 rounded-full">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="text-white font-semibold">Escanear factura</h3>
                    <p className="text-slate-400 text-sm">Toma foto de la factura para extraer datos</p>
                  </div>
                </button>

                <button
                  onClick={() => handleOptionSelect('cufe')}
                  className="flex items-center gap-4 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors duration-200"
                >
                  <div className="bg-amber-500 p-3 rounded-full">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="text-white font-semibold">Escanear código CUFE</h3>
                    <p className="text-slate-400 text-sm">Escanea el código QR de factura electrónica</p>
                  </div>
                </button>
              </div>
            ) : (selectedOption === 'manual' || isEditing) ? (
              // Vista del formulario manual
              <div className="py-4">
                <form className="space-y-4" onSubmit={handleSubmitExpense}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Descripción</label>
                      <input
                        name="description"
                        value={form.description}
                        onChange={handleFormChange}
                        placeholder="Descripción del gasto"
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Fecha</label>
                      <input
                        name="transaction_date"
                        type="date"
                        value={form.transaction_date}
                        onChange={handleFormChange}
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Categoría</label>
                      <select
                        name="category_name"
                        value={form.category_name}
                        onChange={handleFormChange}
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {EXPENSE_CATEGORIES.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Cuenta</label>
                      <select
                        name="account_name"
                        value={form.account_name}
                        onChange={handleFormChange}
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {ACCOUNT_TYPES.map((account) => (
                          <option key={account} value={account}>{account}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Lugar</label>
                      <input
                        name="place"
                        value={form.place}
                        onChange={handleFormChange}
                        placeholder="Lugar del gasto (opcional)"
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Valor</label>
                      <input
                        name="amount"
                        type="number"
                        value={form.amount}
                        onChange={handleFormChange}
                        placeholder="$ 0"
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        min={0}
                        step="any"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between pt-4">
                    {!isEditing && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleGoBack}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        Volver
                      </Button>
                    )}
                    <div className="flex gap-3 ml-auto">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCloseModal}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700"
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" variant="gradient" loading={loading}>
                        {isEditing ? 'Actualizar Gasto' : 'Agregar Gasto'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            ) : (
              // Vista para opciones no implementadas (factura y CUFE)
              <div className="py-8 text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-white font-semibold mb-2">Próximamente disponible</h3>
                  <p className="text-slate-400 mb-6">
                    Esta funcionalidad estará disponible en una próxima actualización.
                  </p>
                </div>
                <Button variant="outline" onClick={handleGoBack} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                  Volver
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 