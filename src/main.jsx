import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { sembrarReglas } from './data/repositorio.js';

// Primera vez en este navegador: guarda las reglas iniciales.
sembrarReglas().catch((e) => console.error('No se pudieron preparar los datos:', e));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
