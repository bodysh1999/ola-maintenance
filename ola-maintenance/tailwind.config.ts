import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: 'rgb(var(--brand) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        ink: '#1B1D1C',
        sand: { 50: '#FBF9F5', 100: '#F5F1E9', 200: '#E9E2D4', 300: '#D8CDB8' },
        stone: { 450: '#8A8578' },
      },
      fontFamily: { sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'] },
      borderRadius: { xl: '14px', '2xl': '20px' },
      boxShadow: {
        card: '0 1px 2px rgba(27,29,28,.04), 0 4px 16px -8px rgba(27,29,28,.08)',
        lift: '0 12px 32px -12px rgba(27,29,28,.22)',
      },
    },
  },
  plugins: [],
} satisfies Config;
