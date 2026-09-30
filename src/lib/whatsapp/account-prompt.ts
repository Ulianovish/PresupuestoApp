// Orquesta la pregunta "¿con qué cuenta fue?" por WhatsApp: manda la lista
// (plantilla `twilio/list-picker`) o, si no se puede, la pregunta por texto; y
// aplica la respuesta, venga de un toque en la lista (`ListId`) o del nombre
// escrito. Deps inyectadas para testear sin red ni DB (las reales están en
// `account-prompt-deps.ts`).
//
// Cada pregunta es una fila de `whatsapp_account_prompts` que apunta a lo que
// hay que resolver: una factura retenida (`invoice`, se registra al elegir) o
// gastos ya registrados con la cuenta por defecto (`transactions`, se les
// cambia la cuenta). El id de cada ítem de la lista lleva la pregunta y la
// cuenta, así que no hace falta estado de conversación y puede haber varias
// listas abiertas a la vez.

import { pegarAlertas } from '@/lib/whatsapp/alerts';
import { formatCOP, todayBogota } from '@/lib/whatsapp/format';

import {
  armarVariablesLista,
  interpretarRespuestaCuenta,
  OPCIONES_LISTA,
  pareceRespuestaDeCuenta,
  rankearCuentas,
  textoPreguntaCuenta,
  type CuentaActiva,
  type UsoCuenta,
} from './account-picker';

export type TargetKind = 'invoice' | 'transactions';

export interface PromptCuenta {
  id: string;
  userId: string;
  phone: string;
  targetKind: TargetKind;
  targetIds: string[];
  createdAt: string;
  resolvedAt: string | null;
  resolvedAccountId: string | null;
}

export interface PreguntaDeps {
  listarCuentas: (userId: string) => Promise<CuentaActiva[]>;
  /** Uso por cuenta de este número y de todo el usuario (ver `rankearCuentas`). */
  cargarUso: (userId: string, phone: string) => Promise<UsoCuenta[]>;
  /** Crea la fila de la pregunta; devuelve su id. */
  crearPrompt: (p: {
    userId: string;
    phone: string;
    targetKind: TargetKind;
    targetIds: string[];
  }) => Promise<string | null>;
  sendMessage: (to: string, body: string) => Promise<{ ok: boolean }>;
  sendContent: (
    to: string,
    contentSid: string,
    variables: Record<string, string>,
  ) => Promise<{ ok: boolean }>;
  /** `TWILIO_CONTENT_SID_CUENTAS`. Sin él se pregunta por texto. */
  contentSid?: string;
}

export interface RegistroFactura {
  ok: boolean;
  itemsFound: number;
  totalItems: number;
  totalAmount?: number;
  budgetItemIds?: string[];
  monthYear?: string;
  error?: string;
}

export interface EleccionDeps extends PreguntaDeps {
  /** La pregunta por id Y número: una lista de otro número no se puede tocar. */
  cargarPrompt: (
    promptId: string,
    phone: string,
  ) => Promise<PromptCuenta | null>;
  /** La última pregunta sin resolver del número, de las últimas 24 h. */
  ultimoPromptAbierto: (phone: string) => Promise<PromptCuenta | null>;
  /**
   * Marca la pregunta como resuelta SOLO si seguía abierta (un UPDATE
   * condicional): de dos toques simultáneos gana uno, y el otro ve la
   * pregunta ya resuelta en vez de registrar la factura otra vez.
   */
  reclamarPrompt: (promptId: string, accountId: string) => Promise<boolean>;
  /** Deshace `reclamarPrompt` cuando no se llegó a escribir nada. */
  liberarPrompt: (promptId: string) => Promise<void>;
  /** Cambia la cuenta de una pregunta ya resuelta (el usuario corrigió). */
  corregirResolucion: (promptId: string, accountId: string) => Promise<void>;
  moverTransacciones: (
    userId: string,
    ids: string[],
    accountId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Cambia la cuenta de los gastos de una factura ya registrada. */
  moverFactura: (
    userId: string,
    invoiceId: string,
    cuenta: { id: string; name: string },
  ) => Promise<{ ok: boolean; movidos: number; error?: string }>;
  estadoFactura: (
    userId: string,
    invoiceId: string,
  ) => Promise<{ status: string; cuenta: string | null } | null>;
  /** `createInvoiceDirect` (rechaza si ya no está en pending_review). */
  registrarFactura: (
    invoiceId: string,
    accountName: string,
  ) => Promise<RegistroFactura>;
  onExpenseCreated: (e: {
    categoria: string;
    budgetItemIds: string[];
    monthYear: string;
  }) => Promise<string[]>;
  /**
   * Sincroniza la memoria de la conversación tras aplicar la cuenta (el
   * `lastEntity` que apunta a esos gastos, el `pending` de esa factura).
   * Best-effort.
   */
  alResolver?: (r: {
    targetKind: TargetKind;
    targetIds: string[];
    cuenta: string;
  }) => Promise<void>;
}

const MAX_CUERPO = 1024;

export interface PreguntaInput {
  userId: string;
  phone: string;
  targetKind: TargetKind;
  targetIds: string[];
  /** Confirmación de lo que ya pasó; va arriba de la pregunta, en el mismo mensaje si entra. */
  previo?: string | null;
  pregunta: string;
  /** Cuentas que matcheó el texto del usuario: van primero en la lista. */
  candidatas?: string[];
  /** Reusar una pregunta existente (re-preguntar tras un nombre ambiguo). */
  promptId?: string;
}

/**
 * Manda la pregunta de cuenta. Nunca lanza por la parte opcional: si la
 * lista no se puede armar o mandar (sin plantilla, menos de 6 cuentas, tabla
 * sin migrar, Twilio la rechaza), cae a la pregunta por texto.
 */
export async function preguntarCuenta(
  deps: PreguntaDeps,
  input: PreguntaInput,
): Promise<{ via: 'lista' | 'texto'; promptId: string | null }> {
  const [cuentas, uso] = await Promise.all([
    deps.listarCuentas(input.userId).catch(err => {
      console.error('preguntarCuenta: no pude listar las cuentas:', err);
      return [] as CuentaActiva[];
    }),
    deps.cargarUso(input.userId, input.phone).catch(err => {
      console.error('preguntarCuenta: no pude cargar el uso de cuentas:', err);
      return [] as UsoCuenta[];
    }),
  ]);
  const ranking = rankearCuentas(cuentas, uso, input.candidatas ?? []);

  let promptId: string | null = input.promptId ?? null;
  if (!promptId && input.targetIds.length > 0) {
    try {
      promptId = await deps.crearPrompt({
        userId: input.userId,
        phone: input.phone,
        targetKind: input.targetKind,
        targetIds: input.targetIds,
      });
    } catch (err) {
      console.error('preguntarCuenta: no pude guardar la pregunta:', err);
      promptId = null;
    }
  }

  let cuerpo = input.previo
    ? `${input.previo}\n\n${input.pregunta}`
    : input.pregunta;

  if (deps.contentSid && promptId && ranking.length >= OPCIONES_LISTA) {
    if (cuerpo.length > MAX_CUERPO && input.previo) {
      await deps.sendMessage(input.phone, input.previo);
      cuerpo = input.pregunta;
    }
    const vars = armarVariablesLista(cuerpo, promptId, ranking);
    if (vars) {
      const res = await deps.sendContent(input.phone, deps.contentSid, vars);
      if (res.ok) return { via: 'lista', promptId };
      console.error(
        'preguntarCuenta: Twilio rechazó la lista, pregunto por texto',
      );
    }
  }

  await deps.sendMessage(input.phone, textoPreguntaCuenta(cuerpo, ranking));
  return { via: 'texto', promptId };
}

/** Confirmación de una factura registrada por la lista (mismo tono que handle-agent). */
async function confirmarFactura(
  deps: EleccionDeps,
  cuenta: string,
  res: RegistroFactura,
): Promise<string> {
  const monthYear = res.monthYear ?? todayBogota().slice(0, 7);
  const rubros = res.budgetItemIds ?? [];
  let alertas: string[] = [];
  if (rubros.length > 0) {
    // Best-effort: los gastos YA están escritos.
    try {
      alertas = await deps.onExpenseCreated({
        categoria: 'FACTURA',
        budgetItemIds: rubros,
        monthYear,
      });
    } catch (err) {
      console.error('manejarEleccionCuenta: onExpenseCreated falló:', err);
    }
  }
  const total =
    res.totalAmount != null ? ` por ${formatCOP(res.totalAmount)}` : '';
  const base = res.ok
    ? `✅ Listo, quedó en ${cuenta}: registré tu factura${total} (${res.itemsFound} ítems).`
    : `⚠️ Registré ${res.itemsFound} de ${res.totalItems} ítems de tu factura en ${cuenta} (esos ya están en tus gastos, no se perdieron). Los que faltan, cargalos a mano en Gastos; no la reenvíes, duplicaría los que ya quedaron.`;
  return pegarAlertas(base, alertas);
}

async function sincronizar(
  deps: EleccionDeps,
  prompt: PromptCuenta,
  cuenta: string,
): Promise<void> {
  if (!deps.alResolver) return;
  try {
    await deps.alResolver({
      targetKind: prompt.targetKind,
      targetIds: prompt.targetIds,
      cuenta,
    });
  } catch (err) {
    console.error('manejarEleccionCuenta: alResolver falló:', err);
  }
}

/** Cambia la cuenta de algo ya resuelto (el usuario tocó otra opción). */
async function corregir(
  deps: EleccionDeps,
  prompt: PromptCuenta,
  cuenta: CuentaActiva,
): Promise<string> {
  if (prompt.targetKind === 'transactions') {
    const r = await deps.moverTransacciones(
      prompt.userId,
      prompt.targetIds,
      cuenta.id,
    );
    if (!r.ok) {
      return '❌ No pude cambiar la cuenta. Probá de nuevo o cambiala en la app.';
    }
  } else {
    const invoiceId = prompt.targetIds[0];
    const estado = await deps.estadoFactura(prompt.userId, invoiceId);
    if (estado?.status === 'pending_review') {
      // Otro toque la está registrando en este momento.
      return '⏳ Todavía estoy registrando esa factura; probá de nuevo en un momento.';
    }
    if (estado?.status !== 'approved') {
      return '⚠️ Esa factura quedó a medias o ya no existe; revisala en la app.';
    }
    if (estado.cuenta === cuenta.name) return `👍 Ya estaba en ${cuenta.name}.`;
    const r = await deps.moverFactura(prompt.userId, invoiceId, {
      id: cuenta.id,
      name: cuenta.name,
    });
    if (!r.ok || r.movidos === 0) {
      return '❌ No encontré los gastos de esa factura para cambiarles la cuenta; cambiala en la app.';
    }
  }
  await deps.corregirResolucion(prompt.id, cuenta.id);
  await sincronizar(deps, prompt, cuenta.name);
  return `✅ Listo, quedó en ${cuenta.name}.`;
}

/** Aplica la cuenta elegida a la pregunta y devuelve el texto a responder. */
async function aplicarCuenta(
  deps: EleccionDeps,
  prompt: PromptCuenta,
  cuenta: CuentaActiva,
  reintento = false,
): Promise<string> {
  if (prompt.resolvedAt) {
    if (prompt.resolvedAccountId === cuenta.id) {
      return `👍 Ya estaba en ${cuenta.name}.`;
    }
    return corregir(deps, prompt, cuenta);
  }

  if (!(await deps.reclamarPrompt(prompt.id, cuenta.id))) {
    // Otro toque (o el nombre escrito) la resolvió entre la lectura y acá.
    const fresco = await deps.cargarPrompt(prompt.id, prompt.phone);
    if (!fresco || reintento) {
      return '⚠️ No pude aplicar la cuenta. Probá de nuevo en un momento.';
    }
    return aplicarCuenta(deps, fresco, cuenta, true);
  }

  if (prompt.targetKind === 'transactions') {
    // Un UPDATE de cuenta es idempotente: si falla (o lanza), se libera la
    // pregunta y el usuario puede volver a tocar sin riesgo.
    const r = await deps
      .moverTransacciones(prompt.userId, prompt.targetIds, cuenta.id)
      .catch((err: unknown) => {
        console.error('aplicarCuenta: moverTransacciones lanzó:', err);
        return { ok: false };
      });
    if (!r.ok) {
      await deps.liberarPrompt(prompt.id);
      return '❌ No pude cambiar la cuenta. Probá de nuevo o cambiala en la app.';
    }
    await sincronizar(deps, prompt, cuenta.name);
    return `✅ Listo, quedó en ${cuenta.name}.`;
  }

  const invoiceId = prompt.targetIds[0];
  let res: RegistroFactura;
  try {
    res = await deps.registrarFactura(invoiceId, cuenta.name);
  } catch (err) {
    // Registrar una factura NO es idempotente: si lanzó a mitad de camino,
    // parte de sus ítems pueden ser gastos reales. La pregunta queda tomada
    // (un segundo toque no la vuelve a registrar) y se manda a revisar.
    console.error('aplicarCuenta: registrarFactura lanzó:', err);
    return '❌ Tuve un problema registrando la factura. Revisala en la app antes de volver a tocar la cuenta.';
  }
  if (res.ok || res.itemsFound > 0) {
    await sincronizar(deps, prompt, cuenta.name);
    return confirmarFactura(deps, cuenta.name, res);
  }

  // No se escribió nada. Puede que ya estuviera registrada por otro camino
  // (la app, o el agente con el nombre escrito): entonces el toque es una
  // corrección de la cuenta, no un registro nuevo.
  const estado = await deps.estadoFactura(prompt.userId, invoiceId);
  if (estado?.status === 'approved') {
    return corregir(deps, { ...prompt, resolvedAt: 'ya' }, cuenta);
  }
  await deps.liberarPrompt(prompt.id);
  if (estado?.status === 'pending_review') {
    return `❌ No pude registrar la factura: ${res.error ?? 'error desconocido'}. Tocá la cuenta de nuevo en un momento.`;
  }
  return '⚠️ Esa factura ya no está esperando cuenta; revisala en la app.';
}

/** Un toque en la lista (`ListId` = `cta:<promptId>:<accountId>`). */
export async function manejarEleccionCuenta(
  deps: EleccionDeps,
  input: { userId: string; phone: string; promptId: string; accountId: string },
): Promise<void> {
  const prompt = await deps.cargarPrompt(input.promptId, input.phone);
  if (!prompt || prompt.userId !== input.userId) {
    await deps.sendMessage(
      input.phone,
      'No encontré esa pregunta 🤔. Si hace falta, cambiá la cuenta desde la app.',
    );
    return;
  }
  const cuentas = await deps.listarCuentas(input.userId);
  const cuenta = cuentas.find(c => c.id === input.accountId);
  if (!cuenta) {
    await deps.sendMessage(
      input.phone,
      'Esa cuenta ya no está activa. Elegí otra o escribime el nombre.',
    );
    return;
  }
  const texto = await aplicarCuenta(deps, prompt, cuenta);
  await deps.sendMessage(input.phone, texto);
}

/**
 * El usuario escribió el nombre en vez de tocar la lista ("Nequi Coco"). Solo
 * se toma como respuesta si hay una pregunta abierta y el mensaje es un
 * nombre de cuenta corto, sin monto: "40k huevos" sigue yendo al agente.
 * Devuelve true si lo manejó (el llamador no tiene que pasarlo al agente).
 */
export async function intentarCuentaEscrita(
  deps: EleccionDeps,
  input: { userId: string; phone: string; body: string },
): Promise<boolean> {
  if (!pareceRespuestaDeCuenta(input.body)) return false;

  const prompt = await deps.ultimoPromptAbierto(input.phone);
  if (!prompt || prompt.userId !== input.userId) return false;

  const cuentas = await deps.listarCuentas(input.userId);
  const r = interpretarRespuestaCuenta(
    input.body,
    cuentas.map(c => c.name),
  );
  if (r.kind === 'no-es-cuenta') return false;

  if (r.kind === 'ambigua') {
    await preguntarCuenta(deps, {
      userId: input.userId,
      phone: input.phone,
      targetKind: prompt.targetKind,
      targetIds: prompt.targetIds,
      pregunta: `¿Cuál? ${r.candidatas.join(' o ')}.`,
      candidatas: r.candidatas,
      promptId: prompt.id,
    });
    return true;
  }

  const cuenta = cuentas.find(c => c.name === r.cuenta);
  if (!cuenta) return false;
  const texto = await aplicarCuenta(deps, prompt, cuenta);
  await deps.sendMessage(input.phone, texto);
  return true;
}
