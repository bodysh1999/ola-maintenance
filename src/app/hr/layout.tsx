import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['admin', 'hr']);
  return <AppShell profile={profile}>{children}</AppShell>;
}
