import { getI18n, getSettings, requireRole } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { SettingsForm } from './settings-form';

export default async function SettingsPage() {
  await requireRole(['admin']);
  const [{ d }, s] = await Promise.all([getI18n(), getSettings()]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={d.admin.settings.title} />
      <SettingsForm s={s} />
    </div>
  );
}
