/**
 * Checklist de configuración del dashboard (S12).
 *
 * El estado de cada ítem se calcula desde los datos del usuario: no hay una
 * columna por ítem que se pueda desfasar. Solo el "ocultar" se guarda
 * (profiles.onboarding_dismissed_at).
 */

import { todayBogota } from '@/lib/whatsapp/format';

import type { SupabaseClient } from '@supabase/supabase-js';

export type ChecklistInput = {
  accountCount: number;
  deudaCount: number;
  linkedPhoneCount: number;
  hasDocumento: boolean;
  /** Hay algún rubro del mes actual con budgeted_amount > 0. */
  hasBudgetAmounts: boolean;
};

export type ChecklistItemId =
  | 'cuentas'
  | 'deudas'
  | 'whatsapp'
  | 'documento'
  | 'presupuesto';

export type ChecklistItem = {
  id: ChecklistItemId;
  label: string;
  href: string;
  done: boolean;
};

export function computeChecklist(input: ChecklistInput): ChecklistItem[] {
  return [
    {
      id: 'cuentas',
      label: 'Agrega tus cuentas',
      href: '/settings',
      // El kit ya crea "Efectivo": solo cuenta si agregó al menos otra.
      done: input.accountCount > 1,
    },
    {
      id: 'deudas',
      label: 'Registra tarjetas y deudas',
      href: '/deudas',
      done: input.deudaCount > 0,
    },
    {
      id: 'whatsapp',
      label: 'Vincula WhatsApp',
      href: '/settings',
      done: input.linkedPhoneCount > 0,
    },
    {
      id: 'documento',
      // La cédula se guarda por número vinculado (whatsapp_links.documento):
      // sin número, Ajustes no tiene dónde cargarla.
      label:
        input.linkedPhoneCount > 0
          ? 'Carga tu cédula para facturas DIAN'
          : 'Carga tu cédula para facturas DIAN (primero vincula WhatsApp)',
      href: '/settings',
      done: input.hasDocumento,
    },
    {
      id: 'presupuesto',
      label: 'Ponle montos a tu presupuesto',
      href: '/presupuesto',
      // El kit siembra los rubros en 0: hecho cuando alguno del mes tiene monto.
      done: input.hasBudgetAmounts,
    },
  ];
}

/** Solo el número de filas: head:true no trae ninguna. */
const CONTEO = { count: 'exact', head: true } as const;

/**
 * Datos de la checklist con 5 conteos en paralelo, todos filtrados por el
 * usuario (además de RLS). `monthYear` ('YYYY-MM') es el mes de los rubros
 * que cuentan para "presupuesto"; por defecto el actual de Bogotá. Lanza si
 * alguna consulta falla: quien llama decide no mostrar la checklist antes que
 * mostrarla con datos falsos.
 */
export async function loadChecklistInput(
  supabase: SupabaseClient,
  userId: string,
  monthYear: string = todayBogota().slice(0, 7),
): Promise<ChecklistInput> {
  const [cuentas, deudas, links, linksConDocumento, presupuesto] =
    await Promise.all([
      supabase
        .from('accounts')
        .select('id', CONTEO)
        .eq('user_id', userId)
        .eq('is_active', true),
      // Solo deudas activas: borrar una deuda es es_activo = false.
      supabase
        .from('deudas')
        .select('id', CONTEO)
        .eq('user_id', userId)
        .eq('es_activo', true),
      supabase
        .from('whatsapp_links')
        .select('id', CONTEO)
        .eq('user_id', userId),
      supabase
        .from('whatsapp_links')
        .select('id', CONTEO)
        .eq('user_id', userId)
        .not('documento', 'is', null)
        // Un documento vacío no es una cédula cargada.
        .neq('documento', ''),
      // Rubros del mes con monto: el join !inner con budget_templates (FK
      // budget_items_template_id_fkey) deja filtrar por month_year.
      supabase
        .from('budget_items')
        .select('id, budget_templates!inner(month_year)', CONTEO)
        .eq('user_id', userId)
        .eq('budget_templates.month_year', monthYear)
        .gt('budgeted_amount', 0),
    ]);

  const resultados: Array<[string, { error: { code: string } | null }]> = [
    ['accounts', cuentas],
    ['deudas', deudas],
    ['whatsapp_links', links],
    ['whatsapp_links.documento', linksConDocumento],
    ['budget_items.mes', presupuesto],
  ];
  for (const [nombre, r] of resultados) {
    if (r.error) {
      // Solo el nombre de la consulta y el código: nada del usuario.
      throw new Error(`loadChecklistInput: ${nombre} ${r.error.code}`);
    }
  }

  return {
    accountCount: cuentas.count ?? 0,
    deudaCount: deudas.count ?? 0,
    linkedPhoneCount: links.count ?? 0,
    hasDocumento: (linksConDocumento.count ?? 0) > 0,
    hasBudgetAmounts: (presupuesto.count ?? 0) > 0,
  };
}

/** Lo que la checklist necesita del perfil (lo lee el dashboard una vez). */
export type PerfilChecklist = { onboarding_dismissed_at: string | null };

/**
 * Lo que el dashboard necesita: los ítems si hay que mostrar la checklist, o
 * null si no (la ocultó, ya hizo todo, o algo falló). Nunca lanza: la
 * checklist es opcional y no debe tumbar el dashboard.
 *
 * `perfil` es la fila de profiles que el dashboard ya leyó; null = no hay
 * fila o la lectura falló. Una fila sin la columna (migración S09 sin
 * aplicar) da undefined y se trata como ocultada.
 */
export async function loadDashboardChecklist(
  supabase: SupabaseClient,
  userId: string,
  perfil: PerfilChecklist | null,
): Promise<ChecklistItem[] | null> {
  if (!perfil || perfil.onboarding_dismissed_at !== null) {
    return null;
  }

  let input: ChecklistInput;
  try {
    input = await loadChecklistInput(supabase, userId);
  } catch (err) {
    // El mensaje de loadChecklistInput solo trae la consulta y el código.
    console.error(
      'loadDashboardChecklist:',
      err instanceof Error ? err.message : 'error desconocido',
    );
    return null;
  }

  const items = computeChecklist(input);
  return items.some(i => !i.done) ? items : null;
}

export const DISMISS_ERROR_MESSAGE =
  'No pudimos ocultar la lista. Intenta de nuevo.';

/**
 * "Ocultar" la checklist: la esconde al instante y guarda con `dismiss`
 * (dismissChecklistAction, contratos §5.2). Si devuelve `{ ok: false }` o la
 * llamada lanza (p. ej. error de red), la tarjeta vuelve y sale un aviso.
 */
export async function hideChecklist(deps: {
  dismiss: () => Promise<{ ok: boolean }>;
  setOculta: (oculta: boolean) => void;
  notify: (message: string) => void;
}): Promise<void> {
  deps.setOculta(true);
  let ok = false;
  try {
    ok = (await deps.dismiss()).ok;
  } catch {
    ok = false;
  }
  if (!ok) {
    deps.setOculta(false);
    deps.notify(DISMISS_ERROR_MESSAGE);
  }
}
