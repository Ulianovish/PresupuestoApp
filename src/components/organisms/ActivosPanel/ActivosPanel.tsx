'use client';

/**
 * ActivosPanel - Organism Level
 *
 * Los bienes de la persona: listar, crear, editar y eliminar.
 *
 * De aquí salen el patrimonio líquido y el índice de endeudamiento, así que
 * la suma del listado se muestra arriba, separando lo líquido de lo que no se
 * puede convertir en dinero rápido.
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import ConfirmModal from '@/components/atoms/ConfirmModal/ConfirmModal';
import CurrencyInput from '@/components/atoms/CurrencyInput/CurrencyInput';
import {
  createActivo,
  deleteActivo,
  listActivos,
  updateActivo,
  type Activo,
  type NuevoActivo,
} from '@/lib/services/activos';
import { obtenerDeudas, type Deuda } from '@/lib/services/ingresos-deudas';

/** Tipos sugeridos; el campo es libre y acepta cualquier otro. */
const TIPOS_SUGERIDOS = [
  'Inmueble',
  'Vehículo',
  'Inversión',
  'Ahorro',
  'Negocio',
  'Cesantías',
  'Otro',
];

const VACIO: NuevoActivo = {
  nombre: '',
  tipo: '',
  valor: 0,
  es_liquido: false,
  fecha_valoracion: '',
  nota: '',
  deuda_id: null,
};

const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n);

export default function ActivosPanel() {
  const [activos, setActivos] = useState<Activo[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<NuevoActivo>({ ...VACIO });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Activo | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [lista, lasDeudas] = await Promise.all([
        listActivos(),
        obtenerDeudas().catch(() => [] as Deuda[]),
      ]);
      setActivos(lista);
      setDeudas(lasDeudas.filter(d => d.es_activo !== false));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = activos.reduce((t, a) => t + a.valor, 0);
  const totalLiquido = activos
    .filter(a => a.es_liquido)
    .reduce((t, a) => t + a.valor, 0);

  // Tipos ya usados + sugeridos, para el autocompletado del campo libre.
  const tipos = Array.from(
    new Set([...activos.map(a => a.tipo), ...TIPOS_SUGERIDOS]),
  ).sort();

  const guardar = async () => {
    if (!form.nombre.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const resultado = editingId
        ? await updateActivo(editingId, form)
        : await createActivo(form);
      if (resultado.success) {
        toast.success(editingId ? 'Activo actualizado' : 'Activo agregado');
        setForm({ ...VACIO });
        setEditingId(null);
        await load();
      } else {
        toast.error(resultado.error || 'No se pudo guardar el activo');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const editar = (a: Activo) => {
    setEditingId(a.id);
    setForm({
      nombre: a.nombre,
      tipo: a.tipo,
      valor: a.valor,
      es_liquido: a.es_liquido,
      fecha_valoracion: a.fecha_valoracion ?? '',
      nota: a.nota ?? '',
      deuda_id: a.deuda_id,
    });
  };

  const eliminar = async () => {
    if (!confirm) return;
    const objetivo = confirm;
    setConfirm(null);
    const r = await deleteActivo(objetivo.id);
    if (r.success) {
      toast.success('Activo eliminado');
      await load();
    } else {
      toast.error(r.error || 'No se pudo eliminar');
    }
  };

  const nombreDeuda = (id: string | null) => {
    if (!id) return null;
    const d = deudas.find(x => x.id === id);
    return d ? `${d.descripcion} · ${d.acreedor}` : null;
  };

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-lg font-medium text-white">Activos</h3>
          <p className="text-sm text-slate-400">
            Todo lo que tienes. De aquí salen tu patrimonio líquido y tu índice
            de endeudamiento.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-400">
            {formatCOP(total)}
          </p>
          <p className="text-xs text-slate-400">
            {formatCOP(totalLiquido)} convertible en dinero rápido
          </p>
        </div>
      </div>

      {/* Alta y edición */}
      <div className="mb-4 grid gap-2 rounded-lg bg-white/5 p-3 sm:grid-cols-2">
        <input
          type="text"
          value={form.nombre}
          onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
          placeholder="Nombre (Apartamento 216)"
          className="rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        />
        <input
          type="text"
          list="tipos-activo"
          value={form.tipo}
          onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
          placeholder="Tipo (Inmueble, Vehículo...)"
          className="rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        />
        <datalist id="tipos-activo">
          {tipos.map(t => (
            <option key={t} value={t} />
          ))}
        </datalist>

        <CurrencyInput
          value={form.valor}
          onChange={valor => setForm(p => ({ ...p, valor }))}
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="Valor actual"
        />
        <input
          type="date"
          value={form.fecha_valoracion ?? ''}
          onChange={e =>
            setForm(p => ({ ...p, fecha_valoracion: e.target.value }))
          }
          title="Fecha de la valoración"
          className="rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        />

        <select
          value={form.deuda_id ?? ''}
          onChange={e =>
            setForm(p => ({ ...p, deuda_id: e.target.value || null }))
          }
          className="rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        >
          <option value="">Sin deuda asociada</option>
          {deudas.map(d => (
            <option key={d.id} value={d.id}>
              {d.descripcion} · {d.acreedor}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 px-1 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.es_liquido ?? false}
            onChange={e =>
              setForm(p => ({ ...p, es_liquido: e.target.checked }))
            }
            className="h-4 w-4 rounded border-slate-600 bg-slate-700"
          />
          Se convierte en dinero rápido
        </label>

        <input
          type="text"
          value={form.nota ?? ''}
          onChange={e => setForm(p => ({ ...p, nota: e.target.value }))}
          placeholder="Nota (opcional)"
          className="rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 sm:col-span-2"
        />

        <div className="flex gap-2 sm:col-span-2">
          <Button
            size="sm"
            variant="gradient"
            onClick={guardar}
            disabled={isSaving || !form.nombre.trim()}
            className="flex items-center gap-1"
          >
            {editingId ? (
              <Check className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {editingId ? 'Guardar cambios' : 'Agregar activo'}
          </Button>
          {editingId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setForm({ ...VACIO });
              }}
            >
              <X className="mr-1 h-3 w-3" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Listado */}
      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando activos...</p>
      ) : activos.length === 0 ? (
        <p className="text-sm text-slate-400">
          Aún no tienes activos registrados. Agrega el primero arriba.
        </p>
      ) : (
        <ul className="space-y-2">
          {activos.map(a => (
            <li
              key={a.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
            >
              <div className="min-w-[160px] flex-1">
                <p className="text-sm text-white">
                  {a.nombre}
                  {a.es_liquido && (
                    <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                      líquido
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {a.tipo}
                  {a.fecha_valoracion
                    ? ` · valorado ${a.fecha_valoracion}`
                    : ''}
                  {nombreDeuda(a.deuda_id)
                    ? ` · financia ${nombreDeuda(a.deuda_id)}`
                    : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-emerald-300">
                {formatCOP(a.valor)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => editar(a)}
                title="Editar"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirm(a)}
                className="text-red-400 hover:text-red-300"
                title="Eliminar"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={eliminar}
        title="Eliminar activo"
        message={
          confirm
            ? `¿Eliminar "${confirm.nombre}" (${formatCOP(confirm.valor)})? Dejará de contar en tu patrimonio; su histórico de valoraciones se conserva.`
            : ''
        }
      />
    </section>
  );
}
