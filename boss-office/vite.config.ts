import { defineConfig } from 'vite';

export default defineConfig({
  base: '/the-system/', // GitHub Pages base path
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
  define: {
    // Use Railway backend in production
    'import.meta.env.VITE_API_URL': JSON.stringify('https://the-system-production.up.railway.app'),
  },
});
