/**
 * Checklist de configuración del dashboard (S12).
 *
 * El estado de cada ítem se calcula desde los datos del usuario: no hay una
 * columna por ítem que se pueda desfasar. Solo el "ocultar" se guarda
 * (profiles.onboarding_dismissed_at).
 */

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
