/**
 * InlineCombobox - Molecule Level
 *
 * Selector editable inline con autocompletado: muestra el valor como botón y,
 * al hacer clic, abre un campo de texto que filtra las opciones (flechas para
 * navegar, Enter/Tab para elegir, Escape para cerrar).
 *
 * Se usa para editar la categoría y la cuenta en la tabla de Gastos, y la
 * categoría en el panel de gastos sin clasificar del Presupuesto.
 */

import React, { useState, useRef, useEffect } from 'react';

export default function InlineCombobox({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: string[];
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter(o =>
    o.toLowerCase().includes(query.toLowerCase()),
  );

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Auto-focus al abrir
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setHighlighted(0);
    }
  }, [open]);

  // Resetear highlight cuando cambia el query
  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  const select = (name: string) => {
    if (name !== value) onSelect(name);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) select(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={ref} className="relative">
      {open ? (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value}
          className="w-full min-w-[120px] px-2 py-0.5 text-xs bg-slate-700 border border-blue-500 rounded text-white outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-blue-300 hover:bg-white/10 transition-colors cursor-pointer"
          title="Click para editar categoría"
        >
          {value}
        </button>
      )}

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 min-w-[160px] max-h-48 overflow-y-auto bg-slate-800 border border-white/20 rounded-lg shadow-xl">
          {filtered.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onMouseDown={e => {
                e.preventDefault(); // Evita que el input pierda foco antes del click
                select(opt);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                i === highlighted
                  ? 'bg-blue-600/40 text-white'
                  : opt === value
                    ? 'bg-white/10 text-blue-300'
                    : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
