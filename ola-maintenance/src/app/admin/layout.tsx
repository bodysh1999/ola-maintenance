import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['admin', 'supervisor']);
  return <AppShell profile={profile}>{children}</AppShell>;
}
