// Deps reales de `account-prompt.ts` (Supabase + Twilio). Separadas para que
// los orquestadores (webhook, agente, fotos) las armen en una línea y los
// tests de la lógica no carguen nada de esto.

import { createInvoiceDirect } from '@/lib/services/invoices';
import {
  cargarPromptCuenta,
  cargarUsoCuentas,
  corregirResolucionPrompt,
  crearPromptCuenta,
  estadoFactura,
  liberarPromptCuenta,
  listarCuentasActivas,
  moverFacturaDeCuenta,
  moverTransaccionesDeCuenta,
  reclamarPromptCuenta,
  ultimoPromptAbierto,
} from '@/lib/services/whatsapp-account-prompts';
import { readState, writeState } from '@/lib/whatsapp/agent/state';
import { dispararAlertasWhatsapp } from '@/lib/whatsapp/alerts';
import {
  sendWhatsAppContent,
  sendWhatsAppMessage,
} from '@/lib/whatsapp/transport';

import type { EleccionDeps, PreguntaDeps } from './account-prompt';

export function depsPreguntaCuenta(): PreguntaDeps {
  return {
    listarCuentas: listarCuentasActivas,
    cargarUso: cargarUsoCuentas,
    crearPrompt: crearPromptCuenta,
    sendMessage: sendWhatsAppMessage,
    sendContent: sendWhatsAppContent,
    contentSid: process.env.TWILIO_CONTENT_SID_CUENTAS || undefined,
  };
}

export function depsEleccionCuenta(
  userId: string,
  phone: string,
): EleccionDeps {
  return {
    ...depsPreguntaCuenta(),
    cargarPrompt: cargarPromptCuenta,
    ultimoPromptAbierto,
    reclamarPrompt: reclamarPromptCuenta,
    liberarPrompt: liberarPromptCuenta,
    corregirResolucion: corregirResolucionPrompt,
    moverTransacciones: moverTransaccionesDeCuenta,
    moverFactura: moverFacturaDeCuenta,
    estadoFactura,
    registrarFactura: (invoiceId, accountName) =>
      createInvoiceDirect(userId, invoiceId, accountName, {
        registeredPhone: phone,
      }),
    onExpenseCreated: e =>
      dispararAlertasWhatsapp(userId, e.budgetItemIds, e.monthYear),
    // La memoria del agente no puede quedar contando otra cosa: el "último
    // gasto" sigue diciendo Efectivo, o la factura sigue "esperando cuenta".
    alResolver: async ({ targetKind, targetIds, cuenta }) => {
      const estado = await readState(phone);
      if (
        targetKind === 'transactions' &&
        estado.lastEntity &&
        targetIds.includes(estado.lastEntity.transactionId)
      ) {
        await writeState(phone, userId, {
          lastEntity: { ...estado.lastEntity, accountName: cuenta },
        });
      }
      if (
        targetKind === 'invoice' &&
        estado.pending &&
        targetIds.includes(estado.pending.invoiceId)
      ) {
        await writeState(phone, userId, { pending: null });
      }
    },
  };
}
