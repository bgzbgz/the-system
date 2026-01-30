import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false, // Allow fallback to next available port
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Show clear error if backend is not running
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[Vite Proxy] Backend connection failed - is the backend running on port 3000?');
          });
        },
      },
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
