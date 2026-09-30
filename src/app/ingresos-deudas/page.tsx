import { redirect } from 'next/navigation';

import IngresosDeudas from '@/components/pages/IngresosDeudas';
import { getCurrentUser } from '@/lib/actions/auth';
import { loginUrl } from '@/lib/auth/login-url';

/**
 * IngresosDeudas Page
 *
 * Página para gestionar ingresos y deudas.
 * Permite agregar, editar y eliminar tanto gastos como deudas.
 * Requiere autenticación del usuario.
 */
export default async function IngresosDeudaPage() {
  // Verificar autenticación en el servidor
  const user = await getCurrentUser();

  if (!user) {
    redirect(loginUrl('/ingresos-deudas'));
  }

  // Pasar datos del usuario al componente cliente
  return <IngresosDeudas user={user} />;
}
