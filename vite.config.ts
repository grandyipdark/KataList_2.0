
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga las variables de entorno desde el archivo .env
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Force empty string if undefined to prevent build issues or literal undefined in code
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    server: {
      port: 5173,
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
    optimizeDeps: {
      exclude: ['@sqlite.org/sqlite-wasm'],
    },
  };
});