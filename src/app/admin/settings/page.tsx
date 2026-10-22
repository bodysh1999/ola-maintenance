import { getI18n, getSettings, requireRole } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { SettingsForm, NotifyTestForm } from './settings-form';
import { providerFor } from '@/lib/notify/providers';

export default async function SettingsPage() {
  await requireRole(['admin']);
  const [{ d }, s] = await Promise.all([getI18n(), getSettings()]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={d.admin.settings.title} />
      <SettingsForm s={s} providers={{ sms: providerFor('sms'), whatsapp: providerFor('whatsapp'), email: providerFor('email') }} />
      <div className="mt-6"><NotifyTestForm /></div>
    </div>
  );
}
