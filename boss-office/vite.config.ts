import { defineConfig } from 'vite';

// Use '/' for Railway, '/the-system/' for GitHub Pages
const basePath = process.env.RAILWAY_ENVIRONMENT ? '/' : '/the-system/';

export default defineConfig({
  base: basePath,
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
