/**
 * ColumnFilter - Molecule Level
 *
 * Filtro de columna al estilo Excel: un ícono de embudo en el encabezado abre
 * un panel con buscador y casillas de los valores únicos de esa columna.
 * Los cambios se confirman con "Aplicar" (como el OK de Excel) y se quitan con
 * "Limpiar". El ícono se resalta cuando la columna tiene un filtro activo.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { ArrowDownAZ, ArrowUpAZ, Filter } from 'lucide-react';

interface ColumnFilterProps {
  /** Texto del encabezado. */
  label: string;
  /** Valores de la columna (pueden venir repetidos). */
  values: string[];
  /** Valores seleccionados; null = sin filtro (se muestran todos). */
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
  /** Alinea el panel a la derecha para que no se salga de la tabla. */
  alignRight?: boolean;
  /** Dirección de orden activa en esta columna (null = sin ordenar). */
  sortDir?: 'asc' | 'desc' | null;
  /** Ordena por esta columna; se llama con la dirección elegida. */
  onSort?: (dir: 'asc' | 'desc') => void;
}

export default function ColumnFilter({
  label,
  values,
  selected,
  onChange,
  alignRight = false,
  sortDir = null,
  onSort,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const unique = useMemo(
    () =>
      Array.from(new Set(values)).sort((a, b) =>
        a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }),
      ),
    [values],
  );

  // Al abrir, el borrador parte del filtro actual (o todo marcado si no hay).
  useEffect(() => {
    if (open) {
      setDraft(new Set(selected ?? unique));
      setQuery('');
    }
  }, [open, selected, unique]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const visible = unique.filter(v =>
    v.toLowerCase().includes(query.toLowerCase()),
  );
  const allVisibleChecked =
    visible.length > 0 && visible.every(v => draft.has(v));

  const toggle = (v: string) =>
    setDraft(d => {
      const next = new Set(d);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  const toggleAllVisible = () =>
    setDraft(d => {
      const next = new Set(d);
      if (allVisibleChecked) visible.forEach(v => next.delete(v));
      else visible.forEach(v => next.add(v));
      return next;
    });

  const apply = () => {
    // Si quedaron todos marcados, equivale a no tener filtro.
    onChange(draft.size === unique.length ? null : Array.from(draft));
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setOpen(false);
  };

  const isActive = selected !== null;

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1">
      <span>{label}</span>
      {sortDir && (
        <span
          className="text-blue-400"
          title={`Orden ${sortDir === 'asc' ? 'ascendente' : 'descendente'}`}
        >
          {sortDir === 'asc' ? '▲' : '▼'}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={isActive ? 'Filtro activo — clic para editar' : 'Filtrar'}
        className={`p-0.5 rounded transition-colors ${
          isActive
            ? 'text-blue-400 bg-blue-500/20'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
      >
        <Filter className="w-3 h-3" />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1 z-50 w-64 bg-slate-800 border border-white/20 rounded-lg shadow-xl p-2 normal-case ${
            alignRight ? 'right-0' : 'left-0'
          }`}
        >
          {onSort && (
            <div className="flex gap-1 mb-2 pb-2 border-b border-white/10">
              <button
                type="button"
                onClick={() => {
                  onSort('asc');
                  setOpen(false);
                }}
                className={`flex-1 flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-white/10 ${
                  sortDir === 'asc'
                    ? 'text-blue-300 bg-blue-500/15'
                    : 'text-gray-300'
                }`}
              >
                <ArrowUpAZ className="w-3 h-3" />
                Ascendente
              </button>
              <button
                type="button"
                onClick={() => {
                  onSort('desc');
                  setOpen(false);
                }}
                className={`flex-1 flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-white/10 ${
                  sortDir === 'desc'
                    ? 'text-blue-300 bg-blue-500/15'
                    : 'text-gray-300'
                }`}
              >
                <ArrowDownAZ className="w-3 h-3" />
                Descendente
              </button>
            </div>
          )}

          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full mb-2 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white outline-none focus:border-blue-500"
          />

          <label className="flex items-center gap-2 px-1 py-1 text-xs text-gray-200 cursor-pointer hover:bg-white/5 rounded">
            <input
              type="checkbox"
              checked={allVisibleChecked}
              onChange={toggleAllVisible}
            />
            <span className="font-medium">(Seleccionar todo)</span>
          </label>

          <div className="max-h-56 overflow-y-auto border-t border-white/10 mt-1 pt-1">
            {visible.length === 0 ? (
              <p className="text-xs text-gray-400 px-1 py-2">Sin resultados</p>
            ) : (
              visible.map(v => (
                <label
                  key={v}
                  className="flex items-center gap-2 px-1 py-1 text-xs text-gray-200 cursor-pointer hover:bg-white/5 rounded"
                >
                  <input
                    type="checkbox"
                    checked={draft.has(v)}
                    onChange={() => toggle(v)}
                  />
                  <span className="truncate">{v || '(vacío)'}</span>
                </label>
              ))
            )}
          </div>

          <div className="flex justify-between gap-2 mt-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={clear}
              className="px-2 py-1 text-xs text-gray-300 hover:text-white"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={draft.size === 0}
              className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
