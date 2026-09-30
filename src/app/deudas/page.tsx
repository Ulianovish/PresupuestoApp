import { redirect } from 'next/navigation';

import DeudasPage from '@/components/pages/DeudasPage';
import { getCurrentUser } from '@/lib/actions/auth';
import { loginUrl } from '@/lib/auth/login-url';

export default async function DeudasRoutePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(loginUrl('/deudas'));
  }

  return <DeudasPage user={user} />;
}
