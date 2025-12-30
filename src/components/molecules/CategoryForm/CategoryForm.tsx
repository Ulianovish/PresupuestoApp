/**
 * CategoryForm - Molecule Level
 *
 * Formulario para crear nuevas categorías de presupuesto.
 * Incluye campos para nombre, descripción, color e icono.
 * Utiliza validación con Zod y manejo de estados de carga.
 *
 * @param onSubmit - Función que se ejecuta al enviar el formulario
 * @param loading - Estado de carga del formulario
 * @param onCancel - Función que se ejecuta al cancelar
 *
 * @example
 * <CategoryForm
 *   onSubmit={handleCreateCategory}
 *   loading={isCreating}
 *   onCancel={handleCloseModal}
 * />
 */
'use client';

import { useState } from 'react';

import { Palette, Tag, FileText, Sparkles } from 'lucide-react';
import { z } from 'zod';

import Button from '@/components/atoms/Button/Button';
import FormField from '@/components/molecules/FormField/FormField';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Schema de validación
const categorySchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(50, 'El nombre no puede exceder 50 caracteres'),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Selecciona un color válido')
    .optional(),
  icon: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  onSubmit: (data: CategoryFormData) => Promise<void>;
  loading?: boolean;
  onCancel?: () => void;
}

// Colores predefinidos para las categorías
const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#EC4899', // Pink
  '#6366F1', // Indigo
];

// Iconos predefinidos (usando nombres de Lucide React)
const PRESET_ICONS = [
  'Home',
  'Car',
  'ShoppingCart',
  'Utensils',
  'Gamepad2',
  'Heart',
  'Book',
  'Plane',
  'Coffee',
  'Gift',
  'Music',
  'Camera',
  'Dumbbell',
  'Stethoscope',
  'GraduationCap',
];

export default function CategoryForm({
  onSubmit,
  loading = false,
  onCancel,
}: CategoryFormProps) {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: PRESET_COLORS[0],
    icon: PRESET_ICONS[0],
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof CategoryFormData, string>>
  >({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validar datos
      const validatedData = categorySchema.parse(formData);
      setErrors({});

      // Enviar datos
      await onSubmit(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof CategoryFormData, string>> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof CategoryFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  const handleInputChange = (field: keyof CategoryFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Campo Nombre */}
      <FormField
        label="Nombre de la categoría"
        error={errors.name}
        required
        htmlFor="category-name"
      >
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="category-name"
            type="text"
            placeholder="Ej: Alimentación, Transporte..."
            value={formData.name}
            onChange={e => handleInputChange('name', e.target.value)}
            className={cn(
              'pl-10',
              errors.name && 'border-red-500 focus:border-red-500',
            )}
            disabled={loading}
          />
        </div>
      </FormField>

      {/* Campo Descripción */}
      <FormField
        label="Descripción (opcional)"
        error={errors.description}
        htmlFor="category-description"
      >
        <div className="relative">
          <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Textarea
            id="category-description"
            placeholder="Describe brevemente esta categoría..."
            value={formData.description}
            onChange={e => handleInputChange('description', e.target.value)}
            className={cn(
              'pl-10 min-h-[80px] resize-none',
              errors.description && 'border-red-500 focus:border-red-500',
            )}
            disabled={loading}
          />
        </div>
      </FormField>

      {/* Selector de Color */}
      <FormField label="Color" error={errors.color}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              Selecciona un color para la categoría
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => handleInputChange('color', color)}
                className={cn(
                  'w-10 h-10 rounded-lg border-2 transition-all duration-200',
                  'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400',
                  formData.color === color
                    ? 'border-gray-800 shadow-lg scale-110'
                    : 'border-gray-300 hover:border-gray-400',
                )}
                style={{ backgroundColor: color }}
                disabled={loading}
              >
                {formData.color === color && (
                  <Sparkles className="h-4 w-4 text-white mx-auto" />
                )}
              </button>
            ))}
          </div>
        </div>
      </FormField>

      {/* Selector de Icono */}
      <FormField label="Icono (opcional)" error={errors.icon}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              Elige un icono representativo
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2 max-h-32 overflow-y-auto">
            {PRESET_ICONS.map(iconName => (
              <button
                key={iconName}
                type="button"
                onClick={() => handleInputChange('icon', iconName)}
                className={cn(
                  'w-10 h-10 rounded-lg border-2 transition-all duration-200',
                  'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400',
                  'flex items-center justify-center',
                  formData.icon === iconName
                    ? 'border-blue-500 bg-blue-50 shadow-lg scale-110'
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
                )}
                disabled={loading}
              >
                <span className="text-xs font-medium text-gray-600">
                  {iconName.slice(0, 2)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </FormField>

      {/* Botones de acción */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          variant="gradient"
          loading={loading}
          className="flex-1"
        >
          Crear Categoría
        </Button>

        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
