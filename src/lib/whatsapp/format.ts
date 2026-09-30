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

/**
 * "Hoy" en Bogotá como `Date` local (medianoche), para cálculos que necesitan
 * un objeto `Date` (p. ej. `diasRestantesDelMes`). NO usar `new Date()`: en
 * producción el server corre en UTC, así que entre las 7pm y la medianoche
 * hora Colombia ya está en el día siguiente.
 *
 * Construida a partir de `todayBogota()` a propósito: esta duplicación
 * (`hoyBogota` del turno del agente + `todayYmd` del webhook) ya existió una
 * vez y se eliminó por riesgo de que las dos definiciones divergieran. No
 * reintroducirla — este es el único lugar donde se arma el `Date`.
 */
export function hoyBogotaDate(): Date {
  const [aa, mm, dd] = todayBogota().split('-').map(Number);
  return new Date(aa, mm - 1, dd);
}

/**
 * Enmascara un número E.164 para mostrarlo en la app sin exponerlo entero:
 * "+573001234567" → "+57 300 ••• 4567". Otros formatos dejan el prefijo y los
 * últimos 4.
 */
export function enmascararTelefono(phone: string): string {
  const colombiano = phone.match(/^\+57(\d{3})\d+(\d{4})$/);
  if (colombiano) return `+57 ${colombiano[1]} ••• ${colombiano[2]}`;
  if (phone.length < 9) return `••• ${phone.slice(-2)}`;
  return `${phone.slice(0, 4)} ••• ${phone.slice(-4)}`;
}

/**
 * Fecha de un timestamp ISO en horario de Bogotá, p. ej. "29/9/2026". Las
 * páginas se renderizan en el servidor, que en producción corre en UTC: sin
 * `timeZone`, lo vinculado entre las 7pm y la medianoche saldría con el día
 * siguiente.
 */
export function formatearFechaBogota(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
  });
}
