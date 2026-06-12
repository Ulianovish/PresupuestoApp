// Parser puro de un gasto escrito en lenguaje natural simple.
// Reconoce un monto (con k/mil y separadores) y toma el resto como descripción.

export interface QuickExpense {
  amount: number;
  description: string;
}

// Palabras de relleno que no aportan a la descripción.
const STOPWORDS = new Set(['gasté', 'gaste', 'en', 'de', 'por', 'pague', 'pagué', '$']);

// Tope de monto: un gasto por texto > 100 millones COP casi siempre es un typo
// ("999999k"). Por encima de esto tratamos el texto como no-gasto (→ null).
const MAX_AMOUNT = 100_000_000;

/** Convierte un token de monto ("20k", "15.000", "2", "1.5k") a número, o null. */
function parseAmountToken(raw: string): number | null {
  let t = raw.toLowerCase().replace(/\$/g, '');
  let multiplier = 1;
  if (t.endsWith('k')) {
    multiplier = 1000;
    t = t.slice(0, -1);
  }
  // Quitar separadores de miles con punto/coma cuando hay 3 dígitos detrás.
  // "15.000" → "15000"; pero "1.5" (decimal con k) se respeta.
  if (multiplier === 1000) {
    t = t.replace(',', '.'); // decimal con k: "1,5k" → 1.5
  } else {
    t = t.replace(/[.,](?=\d{3}\b)/g, ''); // miles: "15.000" → "15000"
    t = t.replace(',', '.');
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * multiplier);
}

export function parseQuickExpense(text: string): QuickExpense | null {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);

  // "2 mil" / "1.5 mil": número seguido de "mil".
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/^mil$/i.test(tokens[i + 1])) {
      const base = Number(tokens[i].replace(',', '.'));
      if (Number.isFinite(base) && base > 0) {
        const rest = [...tokens.slice(0, i), ...tokens.slice(i + 2)]
          .filter(w => !STOPWORDS.has(w.toLowerCase()))
          .join(' ')
          .trim();
        if (!rest) return null;
        const milAmount = Math.round(base * 1000);
        if (milAmount > MAX_AMOUNT) return null;
        return { amount: milAmount, description: rest };
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
  if (amount == null || amount > MAX_AMOUNT) return null;

  const description = tokens
    .filter((_, i) => i !== amountIdx)
    .filter(w => !STOPWORDS.has(w.toLowerCase()))
    .join(' ')
    .trim();
  if (!description) return null;

  return { amount, description };
}
