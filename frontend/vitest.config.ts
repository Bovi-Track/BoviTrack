import { defineConfig } from 'vitest/config'

// Valores ficticios: los tests de reglas no llaman a Supabase.
// El cliente se construye al importar los módulos de dominio.
export default defineConfig({
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:54321'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
  },
  test: {
    environment: 'happy-dom',
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
  },
})
