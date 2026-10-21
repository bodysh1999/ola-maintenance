import { requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole(['technician']);
  return <AppShell profile={profile}>{children}</AppShell>;
}
