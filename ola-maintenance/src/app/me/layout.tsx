import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';
import { STAFF_ROLES } from '@/lib/hr';

export default async function MeLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole([...STAFF_ROLES]);
  return <AppShell profile={profile}>{children}</AppShell>;
}
