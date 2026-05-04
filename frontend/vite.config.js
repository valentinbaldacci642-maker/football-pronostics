import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'pwa-64x64.png', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'PronosDesFoufous',
        short_name: 'PronosDesFoufous',
        description: 'Meilleurs pronostics football du jour avec indice de confiance réel',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['sports'],
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        runtimeCaching: [
          // API backend Render — NetworkFirst: données fraîches, fallback cache si hors ligne
          {
            urlPattern: ({ url }) =>
              url.hostname.includes('onrender.com') || url.hostname.includes('vercel.app'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60, // 1h
              },
              networkTimeoutSeconds: 15,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Logos équipes/ligues — CacheFirst: images statiques
          {
            urlPattern: ({ url }) =>
              url.hostname.includes('api-sports.io') ||
              url.hostname.includes('media.api-sports.io'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'logos-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 jours
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts — CacheFirst: ne changent jamais
          {
            urlPattern: ({ url }) =>
              url.hostname.includes('fonts.googleapis.com') ||
              url.hostname.includes('fonts.gstatic.com'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 an
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          store: ['zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
