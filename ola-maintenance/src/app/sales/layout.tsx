import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['admin', 'sales']);
  return <AppShell profile={profile}>{children}</AppShell>;
}
