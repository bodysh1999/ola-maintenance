import { redirect } from 'next/navigation';
import { getCurrentProfile, homeFor } from '@/lib/session';

export default async function Root() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) redirect('/login');
  redirect(homeFor(profile.role));
}
