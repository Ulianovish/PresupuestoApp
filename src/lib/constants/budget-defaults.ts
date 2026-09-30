/**
 * Valores por defecto de los rubros que crea la app (contratos §2.5).
 *
 * Se buscan POR NOMBRE en los catálogos (classifications, controls,
 * budget_statuses). Antes se tomaba el primero activo en orden alfabético,
 * que en producción es "Basico"/"Eliminar": todo rubro nuevo nacía marcado
 * como gasto básico que había que eliminar.
 */

/** Nombre de la categoría cuyos rubros usan los valores de deuda. */
export const DEUDAS_CATEGORY_NAME = 'DEUDAS';

/** Clasificación de un rubro nuevo cualquiera. */
export const DEFAULT_ITEM_CLASSIFICATION = 'Estilo de Vida';

/** Control de un rubro nuevo cualquiera. */
export const DEFAULT_ITEM_CONTROL = 'Reducir';

/** Clasificación de los rubros de la categoría DEUDAS. */
export const DEUDA_ITEM_CLASSIFICATION = 'Basico';

/** Control de los rubros de la categoría DEUDAS. */
export const DEUDA_ITEM_CONTROL = 'Necesario';

/** Estado de todo rubro nuevo. */
export const DEFAULT_ITEM_STATUS = 'Activo';
