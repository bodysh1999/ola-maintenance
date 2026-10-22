import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: 'rgb(var(--brand) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        ink: '#1E1828',
        sand: { 50: '#F7F5F9', 100: '#EFECF3', 200: '#E4DFEA', 300: '#CFC8DA' },
        stone: { 450: '#7F7889' },
      },
      fontFamily: { sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'], display: ['"Noto Kufi Arabic"', '"IBM Plex Sans Arabic"', 'sans-serif'] },
      borderRadius: { xl: '14px', '2xl': '20px', arch: '999px 999px 24px 24px' },
      boxShadow: {
        card: '0 1px 2px rgba(42,31,58,.04), 0 6px 20px -10px rgba(42,31,58,.12)',
        lift: '0 16px 40px -16px rgba(42,31,58,.35)',
      },
    },
  },
  plugins: [],
} satisfies Config;
