'use client';

/**
 * ItemNameAutocomplete - Molecule
 *
 * Campo de nombre de ítem con la lista de los nombres ya usados en meses
 * anteriores detrás. Al enfocarlo se ve lo que ya existe; al escribir, se
 * filtra; con Tab se acepta la sugerencia resaltada (o la primera).
 *
 * Tab y no solo Enter porque Enter en estos modales guarda, y el gesto de
 * completar no debería tener que competir con el de confirmar.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { filtrarNombres } from '@/lib/presupuesto/sugerencias-nombre';

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Nombres ya usados por el usuario (de cualquier mes). */
  suggestions: string[];
  id?: string;
  placeholder?: string;
  className?: string;
  /** Enter cuando no hay nada resaltado (lo usa el modal para guardar). */
  onEnter?: () => void;
}

export default function ItemNameAutocomplete({
  value,
  onChange,
  suggestions,
  id,
  placeholder = 'Nombre del ítem',
  className = 'bg-slate-700/50 border-slate-600 text-white',
  onEnter,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filtrarNombres(suggestions, value),
    [suggestions, value],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const showList = open && filtered.length > 0;

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setHighlight(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) {
      if (e.key === 'Enter' && onEnter) {
        e.preventDefault();
        onEnter();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => (h + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => (h <= 0 ? filtered.length - 1 : h - 1));
    } else if (e.key === 'Tab') {
      // Sin nada resaltado, Tab completa con la primera: es la que se ve
      // arriba de la lista y la que uno viene leyendo mientras escribe.
      e.preventDefault();
      select(filtered[highlight >= 0 ? highlight : 0]);
    } else if (e.key === 'Enter') {
      if (highlight >= 0) {
        e.preventDefault();
        e.stopPropagation();
        select(filtered[highlight]);
      } else if (onEnter) {
        e.preventDefault();
        onEnter();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // cerrar la lista, no el modal
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        autoComplete="off"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={className}
        placeholder={placeholder}
      />
      {showList && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-white/20 bg-slate-800 shadow-xl">
          <p className="border-b border-white/10 px-3 py-1.5 text-[11px] text-gray-500">
            De meses anteriores · Tab para completar
          </p>
          {filtered.map((s, i) => (
            <button
              key={s}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                select(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                i === highlight
                  ? 'bg-blue-500/30 text-white'
                  : 'text-gray-200 hover:bg-white/5'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
