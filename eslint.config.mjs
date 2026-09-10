import next from 'eslint-config-next';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // El guion del navegador de la vista previa se incrusta tal cual en el HTML
  // generado: no forma parte de la aplicación ni pasa por el compilador.
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'guiones/navegador/**'] },
  ...next,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
