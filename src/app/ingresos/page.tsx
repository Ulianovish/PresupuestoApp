import { redirect } from 'next/navigation';

import IngresosPage from '@/components/pages/IngresosPage';
import { getCurrentUser } from '@/lib/actions/auth';

export default async function IngresosRoutePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  return <IngresosPage user={user} />;
}
