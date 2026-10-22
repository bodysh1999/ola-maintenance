import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getI18n, getSettings } from '@/lib/session';
import { hexToRgbTriplet } from '@/lib/format';
import { I18nProvider } from '@/components/client';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: { default: s.name_ar, template: `%s · ${s.name_ar}` }, description: 'Maintenance & after-sales services' };
}

export const viewport: Viewport = { themeColor: '#3C2E52', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, d }, s] = await Promise.all([getI18n(), getSettings()]);
  const style = {
    '--brand': hexToRgbTriplet(s.primary_color),
    '--accent': hexToRgbTriplet(s.accent_color),
  } as React.CSSProperties;

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} style={style}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Noto+Kufi+Arabic:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-sans">
        <I18nProvider d={d} locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
