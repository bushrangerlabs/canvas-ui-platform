import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Relative base so assets load correctly through HA ingress proxy prefix
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // In production, output to server/public/ so @fastify/static serves it
    outDir: mode === 'production' ? '../server/public' : 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the local server in dev
      '/api': 'http://localhost:3100',
      '/ws': { target: 'ws://localhost:3100', ws: true },
    },
  },
}))
