/**
 * AgregarTransaccionPage - Página para agregar transacciones/gastos
 * Permite agregar una nueva transacción mediante un botón flotante que abre un modal
 * con tres opciones: manual, escanear factura o escanear código CUFE.
 */
"use client";

import { useState } from "react";
import Button from "@/components/atoms/Button/Button";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";

// Definimos la estructura de una transacción
interface Transaccion {
  id: number;
  detalle: string;
  fecha: string;
  capitulo: string;
  cuenta: string;
  lugar: string;
  valor: number;
  editable?: boolean;
}

// Opciones de ejemplo para selects
const capitulos = ["VIVIENDA", "DEUDAS", "TRANSPORTE", "MERCADO", "OTROS"];
const cuentas = ["Nequi", "TC Falabella", "Efectivo", "Banco Santander"];

// Datos mockeados de ejemplo
const transaccionesMock: Transaccion[] = [
  {
    id: 1,
    detalle: "Arriendo",
    fecha: "2025-03-01",
    capitulo: "VIVIENDA",
    cuenta: "Nequi",
    lugar: "",
    valor: 1410000,
  },
  {
    id: 2,
    detalle: "Administración",
    fecha: "2025-03-01",
    capitulo: "VIVIENDA",
    cuenta: "Nequi",
    lugar: "",
    valor: 324000,
  },
  {
    id: 3,
    detalle: "Cobro cuota manejo",
    fecha: "2025-03-24",
    capitulo: "DEUDAS",
    cuenta: "TC Falabella",
    lugar: "",
    valor: 14495,
  },
  {
    id: 4,
    detalle: "Didi",
    fecha: "2025-03-21",
    capitulo: "TRANSPORTE",
    cuenta: "TC Falabella",
    lugar: "",
    valor: 6930,
  },
  {
    id: 5,
    detalle: "Gasolina",
    fecha: "2025-03-15",
    capitulo: "TRANSPORTE",
    cuenta: "TC Falabella",
    lugar: "",
    valor: 50000,
  },
  {
    id: 6,
    detalle: "Lacena",
    fecha: "2025-03-14",
    capitulo: "MERCADO",
    cuenta: "TC Falabella",
    lugar: "",
    valor: 38277,
  },
];

export default function GastosPage() {
  // Estado para la lista de transacciones (inicializado con mock)
  const [transacciones, setTransacciones] = useState<Transaccion[]>(transaccionesMock);
  
  // Estado para el modal y la opción seleccionada
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'manual' | 'factura' | 'cufe' | null>(null);
  
  // Estado para el formulario
  const [form, setForm] = useState<Omit<Transaccion, "id" | "editable">>({
    detalle: "",
    fecha: "",
    capitulo: capitulos[0],
    cuenta: cuentas[0],
    lugar: "",
    valor: 0,
  });

  // Función para formatear moneda consistente con otras páginas
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Maneja cambios en el formulario
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === "valor" ? Number(value) : value }));
  };

  // Agrega una nueva transacción a la tabla
  const handleAgregar = (e: React.FormEvent) => {
    e.preventDefault();
    setTransacciones((prev) => [
      ...prev,
      {
        id: Date.now(),
        ...form,
        editable: true, // La nueva fila es editable
      },
    ]);
    // Limpia el formulario y cierra el modal
    setForm({ detalle: "", fecha: "", capitulo: capitulos[0], cuenta: cuentas[0], lugar: "", valor: 0 });
    setModalOpen(false);
    setSelectedOption(null);
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
    setModalOpen(false);
    setSelectedOption(null);
    setForm({ detalle: "", fecha: "", capitulo: capitulos[0], cuenta: cuentas[0], lugar: "", valor: 0 });
  };

  // Maneja cambios en una fila editable
  const handleRowChange = (id: number, name: string, value: string | number) => {
    setTransacciones((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, [name]: name === "valor" ? Number(value) : value } : t
      )
    );
  };

  // Guarda la edición de una fila
  const handleGuardar = (id: number) => {
    setTransacciones((prev) =>
      prev.map((t) => (t.id === id ? { ...t, editable: false } : t))
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-blue-400 text-center mb-6">
          Gastos
        </h1>

        {/* Tabla de transacciones */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle>Transacciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Detalle</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Fecha</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Capítulo</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Cuenta</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Lugar</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">Valor</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {transacciones.map((t) => (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors duration-150">
                      {t.editable ? (
                        <>
                          <td className="px-4 py-2">
                            <input
                              value={t.detalle}
                              onChange={e => handleRowChange(t.id, "detalle", e.target.value)}
                              className="rounded-md bg-slate-800 text-white px-2 py-1 w-full"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="date"
                              value={t.fecha}
                              onChange={e => handleRowChange(t.id, "fecha", e.target.value)}
                              className="rounded-md bg-slate-800 text-white px-2 py-1 w-full"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={t.capitulo}
                              onChange={e => handleRowChange(t.id, "capitulo", e.target.value)}
                              className="rounded-md bg-slate-800 text-white px-2 py-1 w-full"
                            >
                              {capitulos.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <select
                              value={t.cuenta}
                              onChange={e => handleRowChange(t.id, "cuenta", e.target.value)}
                              className="rounded-md bg-slate-800 text-white px-2 py-1 w-full"
                            >
                              {cuentas.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={t.lugar}
                              onChange={e => handleRowChange(t.id, "lugar", e.target.value)}
                              className="rounded-md bg-slate-800 text-white px-2 py-1 w-full"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={t.valor}
                              onChange={e => handleRowChange(t.id, "valor", e.target.value)}
                              className="rounded-md bg-slate-800 text-white px-2 py-1 w-full"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Button variant="gradient" size="sm" onClick={() => handleGuardar(t.id)}>
                              Guardar
                            </Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 text-white">{t.detalle}</td>
                          <td className="px-4 py-2 text-white">{t.fecha}</td>
                          <td className="px-4 py-2 text-blue-300">{t.capitulo}</td>
                          <td className="px-4 py-2 text-white">{t.cuenta}</td>
                          <td className="px-4 py-2 text-white">{t.lugar}</td>
                          <td className="px-4 py-2 text-emerald-300 font-semibold">{formatCurrency(t.valor)}</td>
                          <td></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Botón flotante para agregar gasto */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <button
              className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full w-16 h-16 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50"
              onClick={() => setModalOpen(true)}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[600px] bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                {selectedOption === null ? "Agregar nuevo gasto" : 
                 selectedOption === 'manual' ? "Agregar gasto manualmente" :
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
            
            {selectedOption === null ? (
              // Vista de opciones principales
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
            ) : selectedOption === 'manual' ? (
              // Vista del formulario manual
              <div className="py-4">
                <form className="space-y-4" onSubmit={handleAgregar}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Detalle</label>
                      <input
                        name="detalle"
                        value={form.detalle}
                        onChange={handleFormChange}
                        placeholder="Descripción del gasto"
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Fecha</label>
                      <input
                        name="fecha"
                        type="date"
                        value={form.fecha}
                        onChange={handleFormChange}
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Capítulo</label>
                      <select
                        name="capitulo"
                        value={form.capitulo}
                        onChange={handleFormChange}
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {capitulos.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Cuenta</label>
                      <select
                        name="cuenta"
                        value={form.cuenta}
                        onChange={handleFormChange}
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {cuentas.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Lugar</label>
                      <input
                        name="lugar"
                        value={form.lugar}
                        onChange={handleFormChange}
                        placeholder="Lugar del gasto"
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">Valor</label>
                      <input
                        name="valor"
                        type="number"
                        value={form.valor}
                        onChange={handleFormChange}
                        placeholder="$ 0"
                        className="w-full rounded-md bg-slate-700 text-white px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        min={0}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleGoBack}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      Volver
                    </Button>
                    <Button type="submit" variant="gradient">
                      Agregar Gasto
                    </Button>
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