import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

/**
 * Cliente de Supabase para uso en el servidor
 * Usado en Server Components y Server Actions
 */
export const createClient = () => {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // La llamada a `set` falla en middleware
            // Esto es esperado y no es un error
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // La llamada a `remove` falla en middleware
            // Esto es esperado y no es un error
          }
        },
      },
    }
  );
};

/**
 * Cliente de Supabase con privilegios de administrador
 * Solo para uso en Server Actions que requieren permisos elevados
 */
export const createAdminClient = () => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() { return undefined; },
        set() { },
        remove() { },
      },
    }
  );
}; 