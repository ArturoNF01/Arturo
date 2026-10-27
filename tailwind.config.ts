import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // El azul del banner de la portada (#0b2570, el 800) es el principal; el
        // 900 es el azul marino del programa impreso. Del 500 al 600 salen los
        // botones y los enlaces.
        ciess: {
          50: '#eef3fd', 100: '#dce6fb', 200: '#bccaf3', 300: '#8da6e8',
          400: '#5679d9', 500: '#2a56c6', 600: '#1c44ad', 700: '#123290',
          800: '#0b2570', 900: '#001b57', 950: '#000f33',
        },
        accent: { 500: '#c7ae6f', 600: '#8f7424' },
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
