import { vi } from 'vitest';

/**
 * Cadena falsa de PostgREST para tests: todos los métodos devuelven la misma
 * cadena y, al hacer await (directo, o vía single/maybeSingle), resuelve
 * `resultado`.
 */
export function cadena(resultado: unknown) {
  const chain: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'ilike', 'order', 'insert']) {
    chain[metodo] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue(resultado);
  chain.maybeSingle = vi.fn().mockResolvedValue(resultado);
  chain.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(ok, ko);
  return chain as Record<string, ReturnType<typeof vi.fn>>;
}
