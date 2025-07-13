import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import DashboardContent from '@/components/pages/DashboardContent';

/**
 * DashboardPage - Página principal del dashboard
 * Server Component protegido que requiere autenticación
 * Renderiza el contenido del dashboard con datos de presupuesto
 */
export default async function DashboardPage() {
  // Verificar autenticación en el servidor
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/auth/login');
  }

  // Pasar datos del usuario al componente cliente
  return <DashboardContent user={user} />;
} 