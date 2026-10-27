import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : undefined;
const supabaseHost = supabaseUrl?.hostname;
const isDev = process.env.NODE_ENV !== 'production';

// Content-Security-Policy: scripts only from this site; data only to this site + Supabase (REST, storage, realtime)
const sb = supabaseUrl ? `${supabaseUrl.origin} ${supabaseUrl.origin.replace(/^http/, 'ws')}` : '';
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`, // Next.js inline bootstrap
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self' ${sb}`,
  `frame-src 'self' ${supabaseUrl?.origin ?? ''} https://www.google.com https://maps.google.com https://www.openstreetmap.org`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig: NextConfig = {
  images: { remotePatterns: supabaseHost ? [{ protocol: 'https', hostname: supabaseHost }] : [] },
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
      ],
    }];
  },
};
export default nextConfig;
