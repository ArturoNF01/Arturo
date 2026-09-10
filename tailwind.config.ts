import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ciess: {
          50: '#eef4fb', 100: '#d7e5f5', 200: '#b0cbea', 300: '#7fa9db',
          400: '#4d84c9', 500: '#2e5c8a', 600: '#254a70', 700: '#1d3a58',
          800: '#152a41', 900: '#0e1c2c', 950: '#080f18',
        },
        accent: { 500: '#c9a227', 600: '#a8871d' },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
} satisfies Config;
