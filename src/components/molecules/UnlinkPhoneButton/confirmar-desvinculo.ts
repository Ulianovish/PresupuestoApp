/**
 * Lógica de "Desvincular" (S13), aparte del componente para probarla sin DOM.
 * Devuelve `true` si el modal debe cerrarse (solo cuando la acción salió bien).
 */
import type { UnlinkLinkResult } from '@/lib/actions/whatsapp';

export const MSG_DESVINCULADO = 'Número desvinculado';
export const MSG_ERROR_INESPERADO = 'No se pudo desvincular el número.';

export interface DesvinculoDeps {
  unlink: (linkId: string) => Promise<UnlinkLinkResult>;
  toast: {
    success: (message: string) => unknown;
    error: (message: string) => unknown;
  };
}

export async function confirmarDesvinculo(
  linkId: string,
  { unlink, toast }: DesvinculoDeps,
): Promise<boolean> {
  try {
    const res = await unlink(linkId);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(MSG_DESVINCULADO);
    return true;
  } catch {
    toast.error(MSG_ERROR_INESPERADO);
    return false;
  }
}
