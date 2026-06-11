// Helpers puros para interpretar mensajes entrantes de WhatsApp.

/** "whatsapp:+573001234567" -> "+573001234567". */
export function normalizeWhatsappFrom(from: string): string {
  return (from || '').trim().replace(/^whatsapp:/i, '');
}

export type ParsedCommand =
  | { kind: 'link'; code: string }
  | { kind: 'help' }
  | { kind: 'other'; text: string };

/** Interpreta el cuerpo del mensaje como un comando conocido. */
export function parseCommand(body: string): ParsedCommand {
  const trimmed = (body || '').trim();
  const link = trimmed.match(/^vincular\s+(\d{6})$/i);
  if (link) {
    return { kind: 'link', code: link[1] };
  }
  if (/^(ayuda|help)$/i.test(trimmed)) {
    return { kind: 'help' };
  }
  return { kind: 'other', text: trimmed };
}
