/**
 * BudgetItemSelect - Molecule Level
 *
 * Selector del ítem de presupuesto de un gasto. Reemplaza al <select> nativo
 * porque el navegador no deja capturar el clic derecho dentro de la lista
 * nativa: aquí cada ítem admite clic derecho para renombrarlo o eliminarlo.
 *
 * - Clic izquierdo: asigna ese ítem al gasto.
 * - Clic derecho sobre un ítem: menú mínimo con Renombrar / Eliminar.
 * - Los ítems se agrupan bajo su categoría, igual que el <optgroup> anterior.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';

import { ChevronDown, Pencil, Trash2 } from 'lucide-react';

import type { BudgetItemRef } from '@/lib/services/expenses';

interface BudgetItemSelectProps {
  /** Ítem asignado actualmente ('' = sin asignar). */
  value: string;
  /** Ítems seleccionables, ya filtrados por la categoría del gasto. */
  items: BudgetItemRef[];
  onSelect: (itemId: string) => void;
  onCreate?: () => void;
  /** Renombra el ítem del presupuesto (afecta a todos los gastos que lo usan). */
  onRenameItem?: (itemId: string, newName: string) => Promise<void>;
  /** Elimina el ítem; los gastos asignados quedan sin asignar. */
  onDeleteItem?: (itemId: string) => Promise<void>;
}

/** Agrupa los ítems por categoría conservando el orden de llegada. */
function groupByCategory(
  items: BudgetItemRef[],
): Array<[string, BudgetItemRef[]]> {
  const groups = new Map<string, BudgetItemRef[]>();
  for (const it of items) {
    const arr = groups.get(it.category_name) ?? [];
    arr.push(it);
    groups.set(it.category_name, arr);
  }
  return Array.from(groups.entries());
}

export default function BudgetItemSelect({
  value,
  items,
  onSelect,
  onCreate,
  onRenameItem,
  onDeleteItem,
}: BudgetItemSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const selected = items.find(i => i.id === value);

  const closeAll = () => {
    setOpen(false);
    setMenuFor(null);
    setRenamingId(null);
    setConfirmDeleteId(null);
  };

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeAll();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const commitRename = async (id: string) => {
    const name = draftName.trim();
    setRenamingId(null);
    setMenuFor(null);
    if (name && name !== items.find(i => i.id === id)?.name) {
      await onRenameItem?.(id, name);
    }
  };

  const commitDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setMenuFor(null);
    setOpen(false);
    await onDeleteItem?.(id);
  };

  return (
    <div ref={ref} className="relative w-[130px] flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={selected ? selected.name : 'Sin asignar'}
        className={`flex w-full items-center justify-between gap-1 rounded-lg border px-2 py-1 text-left text-xs ${
          value
            ? 'border-slate-600 bg-slate-700/60 text-white'
            : 'border-red-500/50 bg-slate-700/60 text-red-300'
        }`}
      >
        <span className="truncate">
          {selected ? selected.name : 'Sin asignar'}
        </span>
        <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-70" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-white/20 bg-slate-800 py-1 shadow-xl">
          <button
            type="button"
            onClick={() => {
              onSelect('');
              closeAll();
            }}
            className="block w-full px-3 py-1.5 text-left text-xs text-gray-300 hover:bg-white/5"
          >
            Sin asignar
          </button>

          {onCreate && (
            <button
              type="button"
              onClick={() => {
                closeAll();
                onCreate();
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-emerald-300 hover:bg-white/5"
            >
              ➕ Crear nuevo ítem…
            </button>
          )}

          {groupByCategory(items).map(([cat, its]) => (
            <div key={cat}>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-gray-500">
                {cat}
              </div>
              {its.map(it => (
                <div key={it.id} className="relative">
                  {renamingId === it.id ? (
                    <input
                      autoFocus
                      value={draftName}
                      onChange={e => setDraftName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void commitRename(it.id);
                        } else if (e.key === 'Escape') {
                          setRenamingId(null);
                        }
                      }}
                      onBlur={() => void commitRename(it.id)}
                      className="mx-2 my-0.5 w-[calc(100%-1rem)] rounded border border-blue-500 bg-slate-700 px-2 py-1 text-xs text-white outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(it.id);
                        closeAll();
                      }}
                      onContextMenu={e => {
                        e.preventDefault();
                        setConfirmDeleteId(null);
                        setMenuFor(menuFor === it.id ? null : it.id);
                      }}
                      title="Clic para asignar · clic derecho para editar o eliminar"
                      className={`block w-full px-3 py-1.5 pl-5 text-left text-xs hover:bg-white/5 ${
                        it.id === value
                          ? 'bg-white/10 font-medium text-blue-300'
                          : 'text-gray-200'
                      }`}
                    >
                      {it.name}
                    </button>
                  )}

                  {menuFor === it.id && (
                    <div className="mx-2 mb-1 rounded border border-white/20 bg-slate-900 p-1">
                      {confirmDeleteId === it.id ? (
                        <div className="px-2 py-1 text-[11px] text-gray-300">
                          <p className="mb-1">
                            ¿Eliminar “{it.name}”? Los gastos que lo usen quedan
                            sin asignar.
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void commitDelete(it.id)}
                              className="rounded bg-red-600 px-2 py-0.5 text-white hover:bg-red-500"
                            >
                              Eliminar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-2 py-0.5 text-gray-300 hover:bg-white/10"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setDraftName(it.name);
                              setRenamingId(it.id);
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-gray-200 hover:bg-white/10"
                          >
                            <Pencil className="h-3 w-3" />
                            Renombrar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(it.id)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-red-400 hover:bg-white/10"
                          >
                            <Trash2 className="h-3 w-3" />
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
