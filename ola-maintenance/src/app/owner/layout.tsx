import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['owner']);
  return <AppShell profile={profile}>{children}</AppShell>;
}
