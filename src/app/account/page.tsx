import Link from 'next/link';
import { ChevronLeft, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { getI18n, requireRole } from '@/lib/session';
import { AppShell } from '@/components/app-shell';
import { Card, PageHeader } from '@/components/ui';

const ALL = ['admin', 'supervisor', 'technician', 'owner', 'sales', 'hr', 'employee'] as const;

export default async function AccountPage() {
  const profile = await requireRole([...ALL]);
  const { d } = await getI18n();
  const p = d.privacy;
  const items = [
    { href: '/account/data', icon: LockKeyhole, title: p.myData, sub: p.myDataSub },
    { href: '/account/security', icon: ShieldCheck, title: p.security, sub: p.mfaBody },
    { href: '/account/password', icon: KeyRound, title: p.password, sub: d.common.changePassword },
  ];
  return (
    <AppShell profile={profile}>
      <div className="mx-auto max-w-2xl">
        <PageHeader title={p.account} subtitle={`${profile.full_name} · ${profile.email ?? ''}`} />
        <Card className="divide-y divide-sand-100">
          {items.map((it) => (
            <Link key={it.href} href={it.href} className="flex items-center gap-4 p-5 transition hover:bg-sand-50">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/[.06] text-brand"><it.icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{it.title}</span>
                <span className="block text-sm text-stone-450">{it.sub}</span>
              </span>
              <ChevronLeft className="h-4 w-4 text-stone-400 ltr:rotate-180" />
            </Link>
          ))}
        </Card>
      </div>
    </AppShell>
  );
}
