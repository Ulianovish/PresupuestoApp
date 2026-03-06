import { redirect } from 'next/navigation';

import DeudasPage from '@/components/pages/DeudasPage';
import { getCurrentUser } from '@/lib/actions/auth';

export default async function DeudasRoutePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  return <DeudasPage user={user} />;
}
