// Helpers puros de CurrencyInput: qué se muestra en el input y qué valor se
// emite. Viven aparte del componente para poder testearlos sin DOM.

import { parseCopAmount } from '@/lib/money/parse-cop';

export interface CurrencyEdit {
  /** Texto a mostrar en el input ("$1.234,5"). */
  display: string;
  /** Valor emitido, siempre en pesos enteros (redondeado). */
  value: number;
}

const MAX_DECIMALES = 2;

/** Pesos enteros con agrupación es-CO ("$1.900.000"); el cero queda vacío. */
export function formatCurrencyDisplay(num: number): string {
  if (!num) return '';
  return `$${num.toLocaleString('es-CO')}`;
}

/**
 * Interpreta el texto del input después de una tecla. Los "." son la
 * agrupación que pone el propio input, así que se descartan y se reagrupa; la
 * "," es el separador decimal y se respeta (máx. 2 decimales) para que se
 * pueda escribir "563.091,09". El valor emitido se redondea a pesos.
 */
export function editCurrencyText(raw: string): CurrencyEdit {
  const limpio = raw.replace(/[^0-9,]/g, '');
  if (!limpio) return { display: '', value: 0 };

  const coma = limpio.indexOf(',');
  const tieneComa = coma !== -1;
  const enteraTxt = (tieneComa ? limpio.slice(0, coma) : limpio) || '0';
  const decimales = tieneComa
    ? limpio
        .slice(coma + 1)
        .replace(/,/g, '')
        .slice(0, MAX_DECIMALES)
    : '';

  const entera = Number(enteraTxt);
  const value = Math.round(Number(`${entera}.${decimales || '0'}`));
  const display = `$${entera.toLocaleString('es-CO')}${tieneComa ? `,${decimales}` : ''}`;
  return { display, value };
}

/**
 * Interpreta un texto pegado con las reglas colombianas de `parseCopAmount`
 * ("563.091,09" → 563091, no 56309109). null si no es un monto: el input
 * se queda como estaba.
 */
export function pasteCurrencyText(text: string): CurrencyEdit | null {
  const value = parseCopAmount(text);
  if (value === null) return null;
  return { display: formatCurrencyDisplay(value), value };
}
