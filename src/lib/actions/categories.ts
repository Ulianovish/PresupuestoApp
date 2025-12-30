'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

// Schema de validación para crear una nueva categoría
const createCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(50, 'El nombre no puede exceder 50 caracteres'),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'El color debe ser un código hexadecimal válido')
    .optional(),
  icon: z.string().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export async function createCategory(input: CreateCategoryInput) {
  try {
    // Validar los datos de entrada
    const validatedData = createCategorySchema.parse(input);

    // Crear cliente de Supabase
    const supabase = await createClient();

    // Verificar que el usuario esté autenticado
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      };
    }

    // Verificar si ya existe una categoría con ese nombre para este usuario
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('name', validatedData.name)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (existingCategory) {
      return {
        success: false,
        error:
          'Ya tienes una categoría con ese nombre. Por favor, elige un nombre diferente.',
      };
    }

    // Insertar la nueva categoría
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: validatedData.name,
        description: validatedData.description || null,
        color: validatedData.color || null,
        icon: validatedData.icon || null,
        is_active: true,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear categoría:', error);

      // Manejar errores específicos
      if (error.code === '23505') {
        // Error de constraint único - nombre duplicado
        return {
          success: false,
          error:
            'Ya tienes una categoría con ese nombre. Por favor, elige un nombre diferente.',
        };
      }

      if (error.code === '42501') {
        // Error de RLS - problemas de permisos
        return {
          success: false,
          error:
            'No tienes permisos para crear esta categoría. Verifica que estés autenticado.',
        };
      }

      // Error genérico
      return {
        success: false,
        error: 'Error al crear la categoría. Por favor, intenta nuevamente.',
      };
    }

    // Revalidar la página del presupuesto para actualizar los datos
    revalidatePath('/presupuesto');

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error en createCategory:', error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Datos de entrada inválidos',
        fieldErrors: error.flatten().fieldErrors,
      };
    }

    return {
      success: false,
      error: 'Error interno del servidor',
    };
  }
}
