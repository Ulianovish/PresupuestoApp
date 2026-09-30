import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  // tsconfig usa jsx "preserve" (lo compila Next); los tests necesitan
  // transformar JSX para poder renderizar componentes.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
  },
});
