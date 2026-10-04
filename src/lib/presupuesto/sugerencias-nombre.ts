/**
 * Sugerencias de nombre de ítem a partir de los que ya se usaron en meses
 * anteriores.
 *
 * Crear "Emb..." a mano cada mes es como nacen los ítems repetidos ("Embutidos"
 * y "Embutido" conviviendo), y con ellos los totales partidos en dos. Que el
 * nombre viejo esté a un Tab de distancia es más barato que limpiar duplicados
 * después.
 */

/** Sin tildes y en minúsculas, para comparar. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Nombres que encajan con lo escrito. Sin texto devuelve la lista completa
 * (recortada): la idea es poder mirar lo que ya existe antes de escribir.
 *
 * Los que EMPIEZAN por lo escrito van primero —es lo que uno espera completar
 * con Tab— y después los que lo contienen. Se descarta el que ya es idéntico:
 * no hay nada que completar.
 */
export function filtrarNombres(
  nombres: string[],
  texto: string,
  max = 8,
): string[] {
  const vistos = new Set<string>();
  const unicos = nombres.filter(n => {
    const k = normalizar(n);
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  const q = normalizar(texto);
  if (!q) return unicos.slice(0, max);

  const empiezan: string[] = [];
  const contienen: string[] = [];
  for (const nombre of unicos) {
    const n = normalizar(nombre);
    if (n === q) continue;
    if (n.startsWith(q)) empiezan.push(nombre);
    else if (n.includes(q)) contienen.push(nombre);
  }
  return [...empiezan, ...contienen].slice(0, max);
}
