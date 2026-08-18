// Formateo compartido para los mensajes salientes de WhatsApp.
// Módulo aparte y SIN dependencias: NO importar de '@/lib/services/expenses'
// (ese módulo crea un cliente de Supabase de navegador a nivel de módulo y
// rompería en servidor).

/** Formatea un monto en pesos colombianos, p. ej. 20000 -> "$ 20.000". */
export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Fecha "hoy" en horario de Colombia (no UTC): `en-CA` formatea YYYY-MM-DD.
 * Evita adelantar el día para gastos enviados de noche (UTC-5).
 *
 * Única definición del repo: antes vivía duplicada como `hoyBogota` (el turno
 * del agente) y `todayYmd` (el webhook), idénticas y con riesgo de divergir.
 */
export function todayBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/** Primer día del mes de una fecha YYYY-MM-DD (o del mes en curso). */
export function primerDiaDelMes(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}
