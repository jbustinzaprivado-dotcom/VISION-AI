import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import App from './App.jsx';
import './styles.css';
import './components/ui/useTema.js'; // aplica el tema guardado antes de dibujar
import { sembrarReglas } from './data/repositorio.js';

// Primera vez en este navegador: guarda las reglas iniciales.
sembrarReglas().catch((e) => console.error('No se pudieron preparar los datos:', e));

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
