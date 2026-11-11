import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, writeFileSync } from 'node:fs';

// Solo en desarrollo: guarda el dataset exportado desde Entrenamiento en
// entrenamiento/dataset.zip para entrenar YOLO en esta computadora (DT-9).
// No existe en la versión publicada.
const guardarDataset = {
  name: 'guardar-dataset',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__guardar-dataset', (req, res) => {
      if (req.method !== 'POST') return res.writeHead(405).end();
      const partes = [];
      req.on('data', (p) => partes.push(p));
      req.on('end', () => {
        mkdirSync('entrenamiento', { recursive: true });
        writeFileSync('entrenamiento/dataset.zip', Buffer.concat(partes));
        res.writeHead(204).end();
      });
    });
  },
};

export default defineConfig({
  plugins: [react(), guardarDataset],
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
