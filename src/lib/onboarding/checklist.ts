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
      label: 'Carga tu cédula para facturas DIAN',
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
        .not('documento', 'is', null),
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
