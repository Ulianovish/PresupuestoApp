import { redirect } from 'next/navigation';

import IngresosPage from '@/components/pages/IngresosPage';
import { getCurrentUser } from '@/lib/actions/auth';
import { loginUrl } from '@/lib/auth/login-url';

export default async function IngresosRoutePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(loginUrl('/ingresos'));
  }

  return <IngresosPage user={user} />;
}
