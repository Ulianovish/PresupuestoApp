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
