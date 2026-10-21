import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  // `loadEnv` also reads plain `.env` files, which keeps the base path
  // configuration identical on Windows, macOS and Linux.
  // Set BASE_PATH=/my-repo/ in `.env.production` (or as a shell variable) when
  // the application is published under a sub-path such as GitHub Pages.
  const env = loadEnv(mode, process.cwd(), '');
  const envBase = (env.BASE_PATH ?? process.env.BASE_PATH ?? '').trim();
  const base =
    envBase === '' || envBase === '/' ? '/' : envBase.endsWith('/') ? envBase : `${envBase}/`;

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
    },
    server: {
      port: 5173,
      open: false,
    },
    preview: {
      port: 4173,
    },
  };
});
