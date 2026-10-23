import { getI18n, requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';
import { Alert, Card, CardHeader, PageHeader } from '@/components/ui';
import { MfaManager } from '@/components/privacy-client';

const ALL = ['admin', 'supervisor', 'technician', 'owner', 'sales', 'hr', 'employee'] as const;

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const [profile, sp, { d }] = await Promise.all([requireRole([...ALL]), searchParams, getI18n()]);
  const p = d.privacy;
  return (
    <AppShell profile={profile} gates={false}>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title={p.security} />
        {sp.required && <Alert tone="warn">{p.mfaRequired}</Alert>}
        <Card>
          <CardHeader title={p.mfaTitle} subtitle={p.mfaBody} />
          <div className="p-5"><MfaManager /></div>
        </Card>
      </div>
    </AppShell>
  );
}
