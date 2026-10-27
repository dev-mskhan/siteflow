import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler|@reduxjs|react-redux|redux|immer|reselect|use-sync-external-store)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/](recharts|d3-[\w-]+|victory-vendor)[\\/]/.test(id)) return 'vendor-charts';
          if (/[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'vendor-motion';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 3001,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
