// Parser puro de un gasto escrito en lenguaje natural simple.
// Reconoce un monto (con k/mil y separadores) y toma el resto como descripción.

import { isCopAmountSuffix, parseCopAmount } from '@/lib/money/parse-cop';

export interface QuickExpense {
  amount: number;
  description: string;
}

// Palabras de relleno que no aportan a la descripción.
const STOPWORDS = new Set([
  'gasté',
  'gaste',
  'en',
  'de',
  'por',
  'pague',
  'pagué',
  '$',
]);

// Tope de monto (exclusivo): un gasto por texto de 100 millones COP o más casi
// siempre es un typo ("999999k", "100 millones" por "100 mil"). Desde ahí
// tratamos el texto como no-gasto (→ null).
const MAX_AMOUNT = 100_000_000;

/**
 * Convierte un token de monto ("20k", "15.000", "2", "1.5k", "563.091,09") a
 * número, o null. Las reglas de separadores viven en `parseCopAmount`.
 */
function parseAmountToken(raw: string): number | null {
  return parseCopAmount(raw);
}

export function parseQuickExpense(text: string): QuickExpense | null {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);

  // "2 mil" / "1.5 mil" / "2 millones" / "20 lucas": número seguido del
  // sufijo como palabra aparte.
  for (let i = 0; i < tokens.length - 1; i++) {
    if (isCopAmountSuffix(tokens[i + 1])) {
      const suffixAmount = parseCopAmount(`${tokens[i]} ${tokens[i + 1]}`);
      if (suffixAmount != null) {
        const rest = [...tokens.slice(0, i), ...tokens.slice(i + 2)]
          .filter(w => !STOPWORDS.has(w.toLowerCase()))
          .join(' ')
          .trim();
        if (!rest) return null;
        if (suffixAmount >= MAX_AMOUNT) return null;
        return { amount: suffixAmount, description: rest };
      }
    }
  }

  // Buscar el primer token que sea monto; el resto (sin stopwords) es descripción.
  let amount: number | null = null;
  let amountIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const a = parseAmountToken(tokens[i]);
    if (a != null) {
      amount = a;
      amountIdx = i;
      break;
    }
  }
  if (amount == null || amount >= MAX_AMOUNT) return null;

  const description = tokens
    .filter((_, i) => i !== amountIdx)
    .filter(w => !STOPWORDS.has(w.toLowerCase()))
    .join(' ')
    .trim();
  if (!description) return null;

  return { amount, description };
}
