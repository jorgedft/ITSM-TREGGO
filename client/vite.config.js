import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Service worker propio (src/sw.js) para poder recibir notificaciones
      // push reales además del precache normal de la PWA.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // El bundle principal supera el límite default de Workbox (2 MiB).
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      // Apunta a los archivos directamente en la raíz de public/
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'logo.png', '*.png'],
      manifest: {
        name: 'ITSM — Gestión TI',
        short_name: 'ITSM TI',
        description: 'Sistema ITSM/ITAM para el departamento de TI',
        theme_color: '#0ea5e9',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { 
            src: '/icon-192.png', 
            sizes: '192x192', 
            type: 'image/png',
            purpose: 'any maskable'
          },
          { 
            src: '/icon-512.png', 
            sizes: '512x512', 
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          { name: 'Nuevo Ticket', url: '/tickets/new', description: 'Abrir ticket de soporte' },
          { name: 'Inventario',   url: '/assets',      description: 'Ver inventario' },
        ],
      },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: { '@': '/src' },
  },
});