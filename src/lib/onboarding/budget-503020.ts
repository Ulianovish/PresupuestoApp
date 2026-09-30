// Sugerencia 50/30/20 del paso 2 de la bienvenida (contratos §2.7 con la
// enmienda §5.2: 'Calidad de Vida' cuenta como deseo y el 20 % es ahorro).
// Módulo puro y sin dependencias: se usa en el navegador (OnboardingWizard)
// y en tests.

export type KitItem = { id: string; classificationName: string };

type Grupo = 'necesidades' | 'deseos';

/**
 * Porcentaje del ingreso de cada grupo. Enteros a propósito: `ingreso * 30`
 * es exacto y `ingreso * 0.3` arrastra error de coma flotante que, al
 * redondear hacia abajo, puede quitar 1.000 pesos.
 */
const PORCENTAJE: Record<Grupo, number> = {
  necesidades: 50,
  deseos: 30,
};

/** El 20 % de ahorro no se reparte en rubros: va siempre a ahorroSinAsignar. */
const PORCENTAJE_AHORRO = 20;

/**
 * Clasificación (normalizada) → grupo. Lo que no está aquí ('impuestos' o
 * cualquier clasificación desconocida) queda en 0 y no cuenta en ningún grupo.
 */
const GRUPO_POR_CLASIFICACION: Record<string, Grupo> = {
  basico: 'necesidades',
  'estilo de vida': 'deseos',
  caprichos: 'deseos',
  'calidad de vida': 'deseos',
};

/** Los montos sugeridos son múltiplos de 1.000 COP, redondeados hacia abajo. */
const REDONDEO = 1000;

function normalizar(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * true si la clasificación entra en la regla (necesidades o deseos). Los
 * rubros de 'Impuestos' o de clasificaciones desconocidas no reciben monto de
 * la sugerencia: quien la aplica debe conservar lo que ya tenían.
 */
export function inRule503020(classificationName: string): boolean {
  return normalizar(classificationName ?? '') in GRUPO_POR_CLASIFICACION;
}

/**
 * Reparte `income` entre los rubros según su clasificación: 50 % necesidades
 * ('Basico') y 30 % deseos ('Estilo de Vida' | 'Caprichos' | 'Calidad de
 * Vida'). El 20 % de ahorro va siempre a `ahorroSinAsignar`, junto con el
 * porcentaje de un grupo sin rubros. Dentro de cada grupo, partes iguales
 * redondeadas hacia abajo a múltiplos de 1.000. Con `income <= 0` (o no
 * finito) todo queda en 0.
 */
export function suggest503020(
  income: number,
  items: KitItem[],
): { amounts: Record<string, number>; ahorroSinAsignar: number } {
  const amounts: Record<string, number> = {};
  for (const item of items) amounts[item.id] = 0;

  if (!Number.isFinite(income) || income <= 0) {
    return { amounts, ahorroSinAsignar: 0 };
  }
  const ingreso = Math.floor(income);

  const miembros: Record<Grupo, string[]> = {
    necesidades: [],
    deseos: [],
  };
  for (const item of items) {
    const grupo =
      GRUPO_POR_CLASIFICACION[normalizar(item.classificationName ?? '')];
    if (grupo) miembros[grupo].push(item.id);
  }

  let porcentajeSinAsignar = PORCENTAJE_AHORRO;
  for (const grupo of Object.keys(PORCENTAJE) as Grupo[]) {
    const ids = miembros[grupo];
    if (ids.length === 0) {
      porcentajeSinAsignar += PORCENTAJE[grupo];
      continue;
    }
    const porItem =
      Math.floor(
        (ingreso * PORCENTAJE[grupo]) / (100 * ids.length * REDONDEO),
      ) * REDONDEO;
    for (const id of ids) amounts[id] = porItem;
  }

  const ahorroSinAsignar =
    Math.floor((ingreso * porcentajeSinAsignar) / (100 * REDONDEO)) * REDONDEO;

  return { amounts, ahorroSinAsignar };
}
