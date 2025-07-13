'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema } from '@/lib/validations/schemas';

/**
 * Server Action para el login de usuarios
 * Maneja autenticación y redirección automática
 */
export async function loginAction(formData: FormData) {
  try {
    // Extraer datos del FormData
    const rawData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    };

    // Validar datos con Zod
    const validatedData = loginSchema.parse(rawData);
    
    // Crear cliente de Supabase
    const supabase = createClient();

    // Intentar login
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });

    if (error) {
      console.error('Error de login:', error);
      // Redirigir con error en query params
      redirect(`/auth/login?error=${encodeURIComponent(getAuthErrorMessage(error.message))}`);
    }

    if (data.user) {
      console.log('✅ Login exitoso para:', validatedData.email);
      
      // Revalidar y redireccionar
      revalidatePath('/', 'layout');
      redirect('/dashboard');
    }

    // Si llegamos aquí, algo salió mal
    redirect('/auth/login?error=Error de autenticación');

  } catch (error) {
    console.error('Error en loginAction:', error);
    
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error;
    }
    
    // Para errores de validación u otros
    redirect('/auth/login?error=Datos inválidos');
  }
}

/**
 * Server Action para el registro de usuarios
 * Crea cuenta y perfil automáticamente
 */
export async function registerAction(formData: FormData) {
  try {
    // Extraer datos del FormData
    const rawData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      confirmPassword: formData.get('confirmPassword') as string,
      fullName: formData.get('fullName') as string,
    };

    // Validar datos con Zod
    const validatedData = registerSchema.parse(rawData);
    
    // Crear cliente de Supabase
    const supabase = createClient();

    // Intentar registro
    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: {
          full_name: validatedData.fullName,
        },
      },
    });

    if (error) {
      console.error('Error de registro:', error);
      redirect(`/auth/register?error=${encodeURIComponent(getAuthErrorMessage(error.message))}`);
    }

    if (data.user) {
      console.log('✅ Registro exitoso para:', validatedData.email);

      // Si el registro fue exitoso pero requiere confirmación
      if (!data.session) {
        redirect('/auth/login?message=Revisa tu email para confirmar tu cuenta');
      }

      // Si el registro fue exitoso y hay sesión activa
      revalidatePath('/', 'layout');
      redirect('/dashboard');
    }

    // Si llegamos aquí, algo salió mal
    redirect('/auth/register?error=Error de registro');

  } catch (error) {
    console.error('Error en registerAction:', error);
    
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error;
    }
    
    // Para errores de validación u otros
    redirect('/auth/register?error=Datos inválidos');
  }
}

/**
 * Server Action para logout
 * Cierra sesión y redirecciona al home
 */
export async function logoutAction() {
  try {
    const supabase = createClient();
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error de logout:', error);
      redirect('/?error=Error al cerrar sesión');
    }

    console.log('✅ Logout exitoso');
    
    revalidatePath('/', 'layout');
    redirect('/');

  } catch (error) {
    console.error('Error en logoutAction:', error);
    
    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error;
    }
    
    redirect('/?error=Error al cerrar sesión');
  }
}

/**
 * Función para obtener el usuario actual
 * Útil para verificar autenticación en Server Components
 */
export async function getCurrentUser() {
  try {
    const supabase = createClient();
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error obteniendo usuario:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error en getCurrentUser:', error);
    return null;
  }
}

/**
 * Función para verificar si el usuario está autenticado
 * Útil para middleware y protección de rutas
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

/**
 * Helper para convertir errores de Supabase a mensajes amigables
 */
function getAuthErrorMessage(errorMessage: string): string {
  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'Email o contraseña incorrectos',
    'Email not confirmed': 'Debes confirmar tu email antes de iniciar sesión',
    'User already registered': 'Este email ya está registrado',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
    'Unable to validate email address: invalid format': 'Formato de email inválido',
    'signup_disabled': 'El registro está deshabilitado temporalmente',
  };

  return errorMap[errorMessage] || 'Error de autenticación. Intenta nuevamente.';
} 