import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getI18n } from '@/lib/session';
import { Alert } from '@/components/ui';
import { PasswordForm } from './password-form';

export default async function PasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { d } = await getI18n();
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-brand text-accent"><KeyRound className="h-6 w-6" /></div>
        <h1 className="text-2xl font-semibold">{d.common.changePassword}</h1>
        {user.user_metadata?.must_change_password && <Alert tone="info" className="mt-4">{d.auth.mustChange}</Alert>}
        <PasswordForm />
      </div>
    </div>
  );
}
