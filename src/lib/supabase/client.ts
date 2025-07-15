import { createBrowserClient } from '@supabase/ssr';

import { Database } from '@/types/database';

/**
 * Cliente de Supabase para uso en el navegador
 * Usado en Client Components para operaciones de lectura y real-time
 */
export const createClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
};

/**
 * Instancia del cliente para uso general
 */
export const supabase = createClient();
