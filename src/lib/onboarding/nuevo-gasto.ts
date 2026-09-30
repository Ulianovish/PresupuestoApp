/**
 * "Agregar Gasto" del dashboard (S10): navega a /gastos?nuevo=1 y /gastos abre
 * el formulario de gasto nuevo al ver el parámetro. Después se quita de la URL
 * para que recargar o volver atrás no reabra el formulario.
 */

export const NUEVO_GASTO_PARAM = 'nuevo';
export const NUEVO_GASTO_HREF = `/gastos?${NUEVO_GASTO_PARAM}=1`;

/** `search` como `window.location.search` ("?a=1") o sin "?". */
export function wantsNewExpenseForm(search: string): boolean {
  return new URLSearchParams(search).get(NUEVO_GASTO_PARAM) === '1';
}

/** URL relativa sin el parámetro `nuevo`, conservando los demás. */
export function stripNewExpenseParam(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(NUEVO_GASTO_PARAM);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
