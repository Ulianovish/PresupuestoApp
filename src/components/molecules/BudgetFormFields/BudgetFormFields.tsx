/**
 * BudgetFormFields - Molecule Level
 *
 * Campos del formulario para agregar/editar items de presupuesto.
 * Carga clasificaciones y controles dinámicamente desde la BD.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

import CurrencyInput from '@/components/atoms/CurrencyInput/CurrencyInput';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface BudgetFormData {
  descripcion: string;
  fecha: string;
  clasificacion: string;
  control: string;
  presupuestado: number;
  real: number;
  deuda_id?: string | null;
}

interface LookupItem {
  id: string;
  name: string;
}

interface DeudaOption {
  id: string;
  descripcion: string;
}

interface BudgetFormFieldsProps {
  formData: BudgetFormData;
  onFormDataChange: (
    data: BudgetFormData | ((prev: BudgetFormData) => BudgetFormData),
  ) => void;
  classifications?: LookupItem[];
  controls?: LookupItem[];
  deudas?: DeudaOption[];
  /** Mes seleccionado en formato YYYY-MM, usado para componer la fecha */
  selectedMonth?: string;
  /** Nombres de items ya existentes, para autocompletar la descripción */
  descriptionSuggestions?: string[];
}

/** Normaliza texto para comparar sin acentos ni mayúsculas */
function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Input de descripción con autocompletado a partir de items ya existentes.
 * - Mientras se escribe, muestra coincidencias de la base.
 * - Flechas ↑/↓ para navegar, Enter para aceptar la resaltada.
 * - Si no hay nada resaltado, Enter se deja pasar (el modal guarda).
 */
function DescriptionAutocomplete({
  value,
  onChange,
  suggestions,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = normalizeText(value.trim());
    if (!q) return [];
    return suggestions
      .filter(s => {
        const n = normalizeText(s);
        return n.includes(q) && n !== q;
      })
      .slice(0, 8);
  }, [value, suggestions]);

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
    if (!showList) return; // sin lista: dejar pasar Enter al modal (guardar)
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => (h + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => (h <= 0 ? filtered.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && highlight < filtered.length) {
        e.preventDefault();
        e.stopPropagation(); // evitar que el modal guarde
        select(filtered[highlight]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // cerrar la lista sin cerrar el modal
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        id="descripcion"
        autoComplete="off"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => {
          if (value.trim()) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="bg-slate-700/50 border-slate-600 text-white"
        placeholder="Nombre del item"
      />
      {showList && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto bg-slate-800 border border-white/20 rounded-lg shadow-xl">
          {filtered.map((s, i) => (
            <button
              key={s}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                select(s);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
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

/** Extrae solo el día (número) de un valor de fecha guardado, p.ej. "05/04/2026" -> "5" */
function extractDay(fecha: string): string {
  const match = fecha?.match(/^\d+/);
  return match ? String(parseInt(match[0], 10)) : '';
}

/**
 * Compone una fecha "DD/MM/AAAA" a partir del día escrito y el mes seleccionado.
 * Toma el mes y el año del mes seleccionado (YYYY-MM) y limita el día al
 * máximo válido de ese mes. Devuelve '' si no hay día válido.
 */
function composeFecha(dayStr: string, monthYear?: string): string {
  const day = parseInt(dayStr, 10);
  if (!dayStr || isNaN(day) || day < 1 || !monthYear) return '';
  const [year, month] = monthYear.split('-').map(Number);
  if (!year || !month) return '';
  const maxDay = new Date(year, month, 0).getDate(); // días del mes
  const clamped = Math.min(day, maxDay);
  const dd = String(clamped).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${dd}/${mm}/${year}`;
}

export default function BudgetFormFields({
  formData,
  onFormDataChange,
  classifications = [],
  controls = [],
  deudas,
  selectedMonth,
  descriptionSuggestions = [],
}: BudgetFormFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Campo descripción con autocompletado */}
      <div className="space-y-2">
        <Label htmlFor="descripcion" className="text-white">
          Descripción
        </Label>
        <DescriptionAutocomplete
          value={formData.descripcion}
          onChange={v =>
            onFormDataChange(prev => ({ ...prev, descripcion: v }))
          }
          suggestions={descriptionSuggestions}
        />
      </div>

      {/* Campo fecha: solo se escribe el día; el mes y año se toman del mes seleccionado */}
      <div className="space-y-2">
        <Label htmlFor="fecha" className="text-white">
          Día
        </Label>
        <Input
          id="fecha"
          type="number"
          min={1}
          max={31}
          inputMode="numeric"
          value={extractDay(formData.fecha)}
          onChange={e =>
            onFormDataChange(prev => ({
              ...prev,
              fecha: composeFecha(e.target.value, selectedMonth),
            }))
          }
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="Ej: 5"
        />
        {formData.fecha ? (
          <p className="text-xs text-gray-400">Fecha: {formData.fecha}</p>
        ) : (
          <p className="text-xs text-gray-500">
            Escribe el día y se guardará como DD/MM/AAAA del mes seleccionado.
          </p>
        )}
      </div>

      {/* Campo clasificación - dropdown */}
      <div className="space-y-2">
        <Label className="text-white">Clasificación</Label>
        <select
          value={formData.clasificacion}
          onChange={e =>
            onFormDataChange(prev => ({
              ...prev,
              clasificacion: e.target.value,
            }))
          }
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {classifications.map(c => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Campo control - dropdown */}
      <div className="space-y-2">
        <Label className="text-white">Control</Label>
        <select
          value={formData.control}
          onChange={e =>
            onFormDataChange(prev => ({
              ...prev,
              control: e.target.value,
            }))
          }
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {controls.map(c => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Campo presupuestado */}
      <div className="space-y-2">
        <Label htmlFor="presupuestado" className="text-white">
          Presupuestado
        </Label>
        <CurrencyInput
          value={formData.presupuestado}
          onChange={value =>
            onFormDataChange(prev => ({
              ...prev,
              presupuestado: value,
            }))
          }
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="$0"
        />
      </div>

      {/* Campo real */}
      <div className="space-y-2">
        <Label htmlFor="real" className="text-white">
          Real
        </Label>
        <CurrencyInput
          value={formData.real}
          onChange={value =>
            onFormDataChange(prev => ({
              ...prev,
              real: value,
            }))
          }
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="$0"
        />
      </div>

      {/* Vincular deuda (opcional) */}
      {deudas && deudas.length > 0 && (
        <div className="space-y-2">
          <Label className="text-white">Vincular Deuda (opcional)</Label>
          <select
            value={formData.deuda_id || ''}
            onChange={e =>
              onFormDataChange(prev => ({
                ...prev,
                deuda_id: e.target.value || null,
              }))
            }
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sin deuda vinculada</option>
            {deudas.map(d => (
              <option key={d.id} value={d.id}>
                {d.descripcion}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
