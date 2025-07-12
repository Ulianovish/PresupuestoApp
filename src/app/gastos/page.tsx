/**
 * AgregarTransaccionPage - Página para agregar transacciones/gastos
 * Permite agregar una nueva transacción y verla como fila editable en la tabla.
 */
"use client";

import { useState } from "react";
import Button from "@/components/atoms/Button/Button";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";

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
  // Estado para el formulario
  const [form, setForm] = useState<Omit<Transaccion, "id" | "editable">>({
    detalle: "",
    fecha: "",
    capitulo: capitulos[0],
    cuenta: cuentas[0],
    lugar: "",
    valor: 0,
  });

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
    // Limpia el formulario
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
        {/* Formulario para agregar nuevo gasto */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle>Agregar nuevo gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 md:grid-cols-6 gap-4" onSubmit={handleAgregar}>
              <input
                name="detalle"
                value={form.detalle}
                onChange={handleFormChange}
                placeholder="Detalle"
                className="col-span-2 rounded-md bg-slate-800 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                name="fecha"
                type="date"
                value={form.fecha}
                onChange={handleFormChange}
                className="col-span-1 rounded-md bg-slate-800 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <select
                name="capitulo"
                value={form.capitulo}
                onChange={handleFormChange}
                className="col-span-1 rounded-md bg-slate-800 text-white px-3 py-2"
              >
                {capitulos.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                name="cuenta"
                value={form.cuenta}
                onChange={handleFormChange}
                className="col-span-1 rounded-md bg-slate-800 text-white px-3 py-2"
              >
                {cuentas.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                name="lugar"
                value={form.lugar}
                onChange={handleFormChange}
                placeholder="Lugar"
                className="col-span-1 rounded-md bg-slate-800 text-white px-3 py-2"
              />
              <input
                name="valor"
                type="number"
                value={form.valor}
                onChange={handleFormChange}
                placeholder="$ Valor"
                className="col-span-1 rounded-md bg-slate-800 text-white px-3 py-2"
                required
                min={0}
              />
              <div className="col-span-1 flex items-center">
                <Button type="submit" variant="gradient" size="lg">
                  Agregar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

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
                          <td className="px-4 py-2 text-emerald-300 font-semibold">${t.valor.toLocaleString()}</td>
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
      </div>
    </div>
  );
} 