// POST /api/expenses/classify
// Body: { monthYear: 'YYYY-MM' } | { expenseIds: string[], guessedCategoryIds?: string[] }
// GET  /api/expenses/classify?monthYear=YYYY-MM → { suggestions }
//
// Clasifica en el SERVIDOR los gastos sin ítem de presupuesto: botón
// "Clasificar con IA" del panel (por mes) y alta desde el formulario web (por
// ids). Antes esto corría en el navegador, donde no hay API key de IA: no se
// clasificaba nada y la UI igual reportaba cada fila como hecha. Devuelve los
// conteos REALES (solo lo que el RPC de asignación confirmó).
//
// `guessedCategoryIds` (subconjunto de `expenseIds`): gastos cuya categoría
// ADIVINÓ el cliente (palabras clave de la importación), no el usuario. Solo
// a esos — y a los que no tienen categoría — el historial les puede cambiar la
// categoría; la que eligió el usuario (OTROS incluido) se respeta.
//
// El GET no asigna nada: devuelve las sugerencias del historial manual del
// usuario para preseleccionarlas (marcadas) en el panel.

import { z } from 'zod';

import {
  clasificarGastos,
  sugerirDesdeHistorial,
  type GastoAClasificar,
} from '@/lib/services/expense-classification';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const BodySchema = z
  .object({
    monthYear: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
    expenseIds: z.array(z.string().uuid()).min(1).max(200).optional(),
    guessedCategoryIds: z.array(z.string()).max(200).optional(),
  })
  .refine(b => !!b.monthYear || !!b.expenseIds, {
    message: 'Se requiere monthYear o expenseIds',
  });

export interface ClassifyResponse {
  total: number;
  assigned: number;
  byHistory: number;
  byAi: number;
  /** Gastos de meses sin presupuesto: quedan sin asignar. */
  skippedNoBudget: number;
  /** Con presupuesto, pero ningún ítem encajó (o la asignación falló). */
  unmatched: number;
  /** A cuántos el historial les cambió la categoría. */
  recategorized: number;
}

type Cliente = Awaited<ReturnType<typeof createClient>>;

/** Gastos del mes sin ítem asignado (mismo RPC que el panel). */
async function pendientesDelMes(
  supabase: Cliente,
  userId: string,
  monthYear: string,
): Promise<{ gastos: GastoAClasificar[] } | { error: string }> {
  const { data, error } = await supabase.rpc('get_unclassified_expenses', {
    p_user_id: userId,
    p_month_year: monthYear,
  });
  if (error) return { error: error.message };
  return {
    gastos: ((data as unknown[]) ?? []).map(row => {
      const r = row as {
        id: string;
        description: string | null;
        category_name: string | null;
        transaction_date: string;
      };
      return {
        id: r.id,
        description: r.description ?? '',
        categoryName: r.category_name ?? '',
        monthYear: r.transaction_date.slice(0, 7),
      };
    }),
  };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 });
  }

  const monthYear = new URL(request.url).searchParams.get('monthYear') ?? '';
  if (!/^\d{4}-\d{2}$/.test(monthYear)) {
    return Response.json({ error: 'monthYear inválido' }, { status: 400 });
  }

  const pendientes = await pendientesDelMes(supabase, user.id, monthYear);
  if ('error' in pendientes) {
    return Response.json({ error: pendientes.error }, { status: 500 });
  }
  const suggestions = await sugerirDesdeHistorial(
    supabase,
    user.id,
    pendientes.gastos,
  );
  return Response.json({ suggestions });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return Response.json(
      { error: 'Body inválido: se requiere monthYear o expenseIds' },
      { status: 400 },
    );
  }

  let gastos: GastoAClasificar[];
  if (body.expenseIds) {
    // Solo gastos del usuario que siguen sin ítem: no se pisa una asignación
    // que ya existe (p. ej. una manual).
    const { data, error } = await supabase
      .from('transactions')
      .select('id, description, category_name, month_year')
      .eq('user_id', user.id)
      .in('id', body.expenseIds)
      .is('budget_item_id', null);
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    const adivinadas = new Set(body.guessedCategoryIds ?? []);
    gastos = ((data as unknown[]) ?? []).map(row => {
      const r = row as {
        id: string;
        description: string | null;
        category_name: string | null;
        month_year: string;
      };
      return {
        id: r.id,
        description: r.description ?? '',
        categoryName: r.category_name ?? '',
        monthYear: r.month_year,
        ...(adivinadas.has(r.id) && { categoriaAdivinada: true }),
      };
    });
  } else {
    const pendientes = await pendientesDelMes(
      supabase,
      user.id,
      body.monthYear as string,
    );
    if ('error' in pendientes) {
      return Response.json({ error: pendientes.error }, { status: 500 });
    }
    gastos = pendientes.gastos;
  }

  const r = await clasificarGastos(supabase, user.id, gastos);

  const respuesta: ClassifyResponse = {
    total: r.total,
    assigned: r.asignados.length,
    byHistory: r.asignados.filter(a => a.source === 'historial').length,
    byAi: r.asignados.filter(a => a.source === 'ai').length,
    skippedNoBudget: r.sinPresupuesto,
    unmatched: r.sinCoincidencia,
    recategorized: r.categoriasCambiadas,
  };
  return Response.json(respuesta);
}
