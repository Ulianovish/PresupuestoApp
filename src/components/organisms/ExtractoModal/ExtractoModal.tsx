'use client';

/**
 * ExtractoModal - Organism
 *
 * Carga el extracto de una deuda (Excel, CSV o PDF), deja que un modelo lo
 * lea y muestra lo que entendió para que la persona lo confirme antes de
 * guardarlo mes a mes.
 *
 * Nada se guarda sin confirmación: una columna mal interpretada dejaría
 * saldos falsos repartidos en varios meses, y eso casi no se nota después.
 */

import React, { useRef, useState } from 'react';

import { FileUp, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import CurrencyInput from '@/components/atoms/CurrencyInput/CurrencyInput';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fusionarFila, type ValoresMes } from '@/lib/extractos/extracto';
import { textoDelArchivo } from '@/lib/extractos/leer-archivo';
import { getDeudasMes, saveDeudaMes } from '@/lib/services/deudas-mes';
import { formatMonthName } from '@/lib/services/expenses';

interface DeudaRef {
  id: string;
  descripcion: string;
  acreedor: string;
}

interface ExtractoModalProps {
  deuda: DeudaRef | null;
  onClose: () => void;
  /** Se llama tras guardar, para que la página recargue los valores del mes. */
  onGuardado: () => void;
}

interface FilaRevision {
  mes: string;
  valores: ValoresMes;
  incluir: boolean;
  /** true si ese mes ya tenía datos guardados que se van a reemplazar. */
  pisaDatos: boolean;
}

type Estado = 'archivo' | 'leyendo' | 'revision' | 'guardando';

export default function ExtractoModal({
  deuda,
  onClose,
  onGuardado,
}: ExtractoModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>('archivo');
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [filas, setFilas] = useState<FilaRevision[]>([]);

  const cerrar = () => {
    setEstado('archivo');
    setFilas([]);
    setNombreArchivo('');
    onClose();
  };

  const procesarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !deuda) return;

    setNombreArchivo(file.name);
    setEstado('leyendo');

    try {
      const texto = await textoDelArchivo(file);

      const res = await fetch('/api/deudas/extracto', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          texto,
          descripcion: deuda.descripcion,
          acreedor: deuda.acreedor,
        }),
      });
      const data = (await res.json()) as {
        filas?: Array<{
          mes: string;
          saldo: number | null;
          cuota: number | null;
          cuotasPagas: number | null;
          cuotasFaltantes: number | null;
        }>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'No se pudo leer el extracto');

      const leidas = data.filas ?? [];
      if (leidas.length === 0) {
        toast.error('No se encontraron cortes mensuales en el archivo');
        setEstado('archivo');
        return;
      }

      // Lo que el extracto no trae se completa con lo que ya hay en ese mes,
      // para no borrar datos buenos con ceros.
      const revision: FilaRevision[] = [];
      for (const fila of leidas) {
        const delMes = await getDeudasMes(fila.mes);
        const actual = delMes.find(d => d.deudaId === deuda.id);
        revision.push({
          mes: fila.mes,
          valores: fusionarFila(
            fila,
            actual
              ? {
                  saldoPendiente: actual.saldoPendiente,
                  valorCuota: actual.valorCuota,
                  cuotasPagas: actual.cuotasPagas,
                  cuotasFaltantes: actual.cuotasFaltantes,
                }
              : null,
          ),
          incluir: true,
          pisaDatos: actual?.tieneFoto === true,
        });
      }

      setFilas(revision);
      setEstado('revision');
    } catch (error) {
      console.error('Error procesando el extracto:', error);
      toast.error(
        error instanceof Error ? error.message : 'No se pudo leer el archivo',
      );
      setEstado('archivo');
    }
  };

  const editar = (mes: string, campo: keyof ValoresMes, valor: number) => {
    setFilas(prev =>
      prev.map(f =>
        f.mes === mes ? { ...f, valores: { ...f.valores, [campo]: valor } } : f,
      ),
    );
  };

  const guardar = async () => {
    if (!deuda) return;
    const elegidas = filas.filter(f => f.incluir);
    if (elegidas.length === 0) {
      toast.error('No hay meses seleccionados');
      return;
    }

    setEstado('guardando');
    let guardados = 0;
    for (const fila of elegidas) {
      const { success } = await saveDeudaMes(deuda.id, fila.mes, fila.valores);
      if (success) guardados++;
    }

    if (guardados === elegidas.length) {
      toast.success(
        `${guardados} ${guardados === 1 ? 'mes actualizado' : 'meses actualizados'}`,
      );
    } else {
      toast.error(
        `Se guardaron ${guardados} de ${elegidas.length} meses. Revisa los que faltan.`,
      );
    }
    onGuardado();
    cerrar();
  };

  const seleccionados = filas.filter(f => f.incluir).length;

  return (
    <Dialog
      open={deuda !== null}
      onOpenChange={abierto => !abierto && cerrar()}
    >
      <DialogContent className="sm:max-w-[760px] bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <FileUp className="w-5 h-5 mr-2 text-blue-400" />
            Cargar extracto
            {deuda && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                {deuda.descripcion}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {estado === 'archivo' && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-400">
              Sube el extracto en Excel, CSV o PDF. Se lee en tu equipo y solo
              se envía el texto para interpretarlo; después confirmas qué se
              guarda.
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-slate-600 py-10 text-center text-gray-300 transition-colors hover:border-blue-500 hover:text-white"
            >
              <Upload className="mx-auto mb-2 h-6 w-6" />
              Elegir archivo
              <span className="mt-1 block text-xs text-gray-500">
                .xlsx, .xls, .csv o .pdf
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              onChange={procesarArchivo}
              className="hidden"
            />
          </div>
        )}

        {estado === 'leyendo' && (
          <div className="mt-4 flex flex-col items-center gap-3 py-10 text-gray-300">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            <p className="text-sm">Leyendo {nombreArchivo}…</p>
          </div>
        )}

        {(estado === 'revision' || estado === 'guardando') && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-gray-400">
              Esto es lo que se entendió de{' '}
              <span className="text-gray-200">{nombreArchivo}</span>. Corrige lo
              que haga falta y desmarca los meses que no quieras tocar.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-xs uppercase text-gray-500">
                    <th className="py-2 pr-2"> </th>
                    <th className="py-2 pr-2">Mes</th>
                    <th className="py-2 pr-2">Saldo</th>
                    <th className="py-2 pr-2">Cuota</th>
                    <th className="py-2 pr-2">Pagas</th>
                    <th className="py-2">Faltan</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(fila => (
                    <tr
                      key={fila.mes}
                      className={`border-b border-slate-700/50 ${fila.incluir ? '' : 'opacity-40'}`}
                    >
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={fila.incluir}
                          onChange={e =>
                            setFilas(prev =>
                              prev.map(f =>
                                f.mes === fila.mes
                                  ? { ...f, incluir: e.target.checked }
                                  : f,
                              ),
                            )
                          }
                          className="h-4 w-4 accent-blue-500"
                        />
                      </td>
                      <td className="py-2 pr-2 whitespace-nowrap text-white">
                        {formatMonthName(fila.mes)}
                        {fila.pisaDatos && (
                          <span
                            className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300"
                            title="Este mes ya tiene datos guardados y se van a reemplazar."
                          >
                            reemplaza
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <CurrencyInput
                          value={fila.valores.saldoPendiente}
                          onChange={v => editar(fila.mes, 'saldoPendiente', v)}
                          className="w-32"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <CurrencyInput
                          value={fila.valores.valorCuota}
                          onChange={v => editar(fila.mes, 'valorCuota', v)}
                          className="w-32"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <input
                          type="number"
                          min={0}
                          value={fila.valores.cuotasPagas}
                          onChange={e =>
                            editar(
                              fila.mes,
                              'cuotasPagas',
                              Number(e.target.value) || 0,
                            )
                          }
                          className="w-16 rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-white"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          min={0}
                          value={fila.valores.cuotasFaltantes}
                          onChange={e =>
                            editar(
                              fila.mes,
                              'cuotasFaltantes',
                              Number(e.target.value) || 0,
                            )
                          }
                          className="w-16 rounded border border-slate-600 bg-slate-700/50 px-2 py-1 text-white"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setEstado('archivo')}
                disabled={estado === 'guardando'}
              >
                Otro archivo
              </Button>
              <Button
                onClick={guardar}
                disabled={estado === 'guardando' || seleccionados === 0}
              >
                {estado === 'guardando' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  `Guardar ${seleccionados} ${seleccionados === 1 ? 'mes' : 'meses'}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
