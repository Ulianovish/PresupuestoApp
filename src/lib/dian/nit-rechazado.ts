// Reconoce el error de los scrapers cuando la DIAN rechazó todos los NIT que se
// probaron en el formulario de búsqueda. Módulo puro (sin DB ni red) porque lo
// usan tanto el motor (`process-invoice.ts`, para no arrancar el respaldo) como
// el agente de WhatsApp (`handle-agent.ts`, para explicarle al usuario qué
// mandar), y este último no puede arrastrar Supabase.

/**
 * `true` si el mensaje es un rechazo de NIT. Es determinista: el otro motor
 * prueba la misma lista de NIT contra la misma DIAN y falla igual, solo que
 * gastando captchas pagos y ~3 min.
 */
export function esRechazoDeNit(message: string): boolean {
  return /rechazó todos los NIT/i.test(message || '');
}
