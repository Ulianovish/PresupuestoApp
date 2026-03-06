import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import { Database } from '@/types/database';

/**
 * Cliente de Supabase para uso en el servidor
 * Usado en Server Components y Server Actions
 */
export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // La llamada a `setAll` falla en Server Components
            // Esto es esperado si se llama desde un Server Component
          }
        },
      },
    },
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
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );
};
