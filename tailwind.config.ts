import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}', './manifest.json'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
