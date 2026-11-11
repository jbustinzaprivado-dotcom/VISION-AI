import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Las librerías grandes van en archivos aparte: el navegador las guarda en caché
        // y la aplicación propia se descarga más rápido.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          konva: ['konva', 'react-konva'],
          graficos: ['recharts'],
          datos: ['dexie', 'dexie-react-hooks', 'seedrandom'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.js'],
  },
});
