import { Globe, Mail, MessageCircle, Phone } from 'lucide-react';
import type { Dict } from '@/lib/i18n';
import type { CompanySettings } from '@/lib/types';
import { cx } from './ui';

/** Call / WhatsApp / email buttons from company settings */
export function ContactButtons({ s, d, className }: { s: CompanySettings; d: Dict; className?: string }) {
  const btn = 'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium transition';
  return (
    <div className={cx('flex flex-wrap gap-2', className)}>
      {s.support_phone && (
        <a href={`tel:${s.support_phone}`} className={cx(btn, 'bg-brand text-white hover:bg-brand/90')}>
          <Phone className="h-4 w-4" />{d.owner.callUs}
        </a>
      )}
      {s.whatsapp && (
        <a href={`https://wa.me/${s.whatsapp}`} target="_blank" rel="noreferrer" className={cx(btn, 'bg-emerald-600 text-white hover:bg-emerald-700')}>
          <MessageCircle className="h-4 w-4" />{d.owner.whatsapp}
        </a>
      )}
      {s.support_email && (
        <a href={`mailto:${s.support_email}`} className={cx(btn, 'border border-sand-300 bg-white text-ink hover:bg-sand-50')}>
          <Mail className="h-4 w-4" />{d.owner.emailUs}
        </a>
      )}
    </div>
  );
}

/** Website + social accounts as small text links */
export function SocialLinks({ s, light, className }: { s: CompanySettings; light?: boolean; className?: string }) {
  const links = [
    s.website_url && { href: s.website_url, label: s.website_url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), icon: true },
    s.instagram_url && { href: s.instagram_url, label: 'Instagram' },
    s.snapchat_url && { href: s.snapchat_url, label: 'Snapchat' },
    s.tiktok_url && { href: s.tiktok_url, label: 'TikTok' },
  ].filter(Boolean) as { href: string; label: string; icon?: boolean }[];
  if (!links.length) return null;
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs', light ? 'text-white/60' : 'text-stone-450', className)}>
      {links.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noreferrer" dir="ltr" className={cx('inline-flex items-center gap-1 hover:underline', light ? 'hover:text-white' : 'hover:text-ink')}>
          {l.icon && <Globe className="h-3.5 w-3.5" />}{l.label}
        </a>
      ))}
    </div>
  );
}
