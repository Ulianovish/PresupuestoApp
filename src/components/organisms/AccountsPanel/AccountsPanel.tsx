'use client';

/**
 * AccountsPanel - Organism Level
 *
 * Administra las cuentas donde se registran los gastos (Nequi, TC Falabella,
 * Efectivo...): listar, crear, renombrar, cambiar el tipo y desactivar.
 *
 * Renombrar es seguro: los gastos apuntan a la cuenta por id, así que
 * conservan su vínculo. Desactivar es un borrado suave: la cuenta deja de
 * aparecer en los selectores pero el historial de gastos se mantiene.
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import ConfirmModal from '@/components/atoms/ConfirmModal/ConfirmModal';
import {
  listAccounts,
  createAccount,
  updateAccount,
  deactivateAccount,
  type AccountWithUsage,
} from '@/lib/actions/accounts';

const TYPE_OPTIONS = [
  { value: 'bank', label: 'Banco' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'credit', label: 'Crédito' },
];

const typeLabel = (t: string) =>
  TYPE_OPTIONS.find(o => o.value === t)?.label ?? 'Banco';

export default function AccountsPanel() {
  const [accounts, setAccounts] = useState<AccountWithUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('bank');

  // Creación
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('bank');

  // Confirmación de desactivar
  const [confirm, setConfirm] = useState<AccountWithUsage | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setAccounts(await listAccounts());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!newName.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const result = await createAccount({ name: newName, type: newType });
      if (result.success) {
        toast.success('Cuenta creada');
        setNewName('');
        setNewType('bank');
        await load();
      } else {
        toast.error(result.error || 'No se pudo crear la cuenta');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (acc: AccountWithUsage) => {
    setEditingId(acc.id);
    setEditName(acc.name);
    setEditType(acc.type);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const result = await updateAccount(editingId, {
        name: editName,
        type: editType,
      });
      if (result.success) {
        toast.success('Cuenta actualizada');
        setEditingId(null);
        await load();
      } else {
        toast.error(result.error || 'No se pudo actualizar la cuenta');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm) return;
    const target = confirm;
    setConfirm(null);
    const result = await deactivateAccount(target.id);
    if (result.success) {
      toast.success('Cuenta desactivada');
      await load();
    } else {
      toast.error(result.error || 'No se pudo desactivar la cuenta');
    }
  };

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
      <h3 className="mb-1 text-lg font-medium text-white">Cuentas</h3>
      <p className="mb-4 text-sm text-slate-400">
        Cuentas donde se registran los gastos. Renombrarlas no afecta los gastos
        ya registrados; desactivarlas solo las oculta de los selectores.
      </p>

      {/* Crear cuenta */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleCreate();
            }
          }}
          placeholder="Nombre de la cuenta"
          className="flex-1 min-w-[180px] rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        />
        <select
          value={newType}
          onChange={e => setNewType(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        >
          {TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="gradient"
          onClick={handleCreate}
          disabled={isSaving || !newName.trim()}
          className="flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Agregar
        </Button>
      </div>

      {/* Listado */}
      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando cuentas...</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-slate-400">
          Aún no tienes cuentas. Crea la primera arriba.
        </p>
      ) : (
        <ul className="space-y-2">
          {accounts.map(acc => (
            <li
              key={acc.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
            >
              {editingId === acc.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSaveEdit();
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    autoFocus
                    className="flex-1 min-w-[160px] rounded border border-blue-500 bg-slate-700 px-2 py-1 text-sm text-white outline-none"
                  />
                  <select
                    value={editType}
                    onChange={e => setEditType(e.target.value)}
                    className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-sm text-white outline-none"
                  >
                    {TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="gradient"
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editName.trim()}
                    title="Guardar"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                    title="Cancelar"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-[140px] text-sm text-white">
                    {acc.name}
                  </span>
                  <span className="rounded-full bg-slate-700/70 px-2 py-0.5 text-xs text-slate-300">
                    {typeLabel(acc.type)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {acc.usage} {acc.usage === 1 ? 'gasto' : 'gastos'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(acc)}
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirm(acc)}
                    className="text-red-400 hover:text-red-300"
                    title="Desactivar"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDeactivate}
        title="Desactivar cuenta"
        message={
          confirm
            ? `¿Desactivar "${confirm.name}"? Dejará de aparecer al registrar gastos. Los ${confirm.usage} gastos que ya la usan conservan su historial.`
            : ''
        }
      />
    </section>
  );
}
