import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SesionProvider } from './auth/SesionContext.jsx';
import Layout from './app/Layout.jsx';
import RutaProtegida from './app/RutaProtegida.jsx';
import Ingresar from './pages/Ingresar.jsx';
import PantallaPendiente from './components/PantallaPendiente.jsx';
import Analisis from './pages/Analisis.jsx';
import Entrenamiento from './pages/Entrenamiento.jsx';
import Alertas from './pages/Alertas.jsx';
import Reglas from './pages/Reglas.jsx';
import Inicio from './pages/Inicio.jsx';
import Historial from './pages/Historial.jsx';
import Bandeja from './pages/Bandeja.jsx';

// Cada pantalla con su permiso (Proyecto, sección 9) y su fase de construcción.
const PANTALLAS = [
  {
    ruta: '/',
    permiso: 'verDashboard',
    titulo: 'Inicio',
    componente: Inicio,
    fase: 7,
    descripcion: 'Indicadores calculados desde las sesiones guardadas y alertas pendientes.',
  },
  {
    ruta: '/analisis',
    permiso: 'ejecutarCasos',
    titulo: 'Análisis visual',
    componente: Analisis,
    fase: '3 a 5',
    descripcion: 'Elegir un caso de uso, iniciar la escena simulada y ver regiones, ocupación y alertas.',
  },
  {
    ruta: '/entrenamiento',
    permiso: 'ejecutarCasos',
    titulo: 'Entrenamiento (ilustrativo)',
    componente: Entrenamiento,
    fase: 5,
    descripcion: 'Animación en seis etapas de cómo se prepararía un modelo. No es un entrenamiento real.',
  },
  {
    ruta: '/alertas',
    permiso: 'verAlertas',
    titulo: 'Alertas',
    componente: Alertas,
    fase: 6,
    descripcion: 'Revisar la evidencia y avanzar cada alerta: nueva → revisada → cerrada con observación.',
  },
  {
    ruta: '/historial',
    permiso: 'verHistorial',
    titulo: 'Historial',
    componente: Historial,
    fase: 7,
    descripcion: 'Sesiones guardadas con filtros y exportación CSV.',
  },
  {
    ruta: '/reglas',
    permiso: 'configurarReglas',
    titulo: 'Reglas',
    componente: Reglas,
    fase: 6,
    descripcion: 'Umbrales, duraciones y severidades de las reglas; los cambios aplican a sesiones nuevas.',
  },
  {
    ruta: '/bandeja',
    permiso: 'verBandeja',
    titulo: 'Bandeja simulada',
    componente: Bandeja,
    fase: 7,
    descripcion: 'Correos que recibiría el administrador; no se envían.',
  },
];

export default function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/ingresar" element={<Ingresar />} />
          <Route
            element={
              <RutaProtegida>
                <Layout />
              </RutaProtegida>
            }
          >
            {PANTALLAS.map((p) => (
              <Route
                key={p.ruta}
                path={p.ruta}
                element={
                  <RutaProtegida permiso={p.permiso}>
                    {p.componente ? (
                      <p.componente />
                    ) : (
                      <PantallaPendiente titulo={p.titulo} descripcion={p.descripcion} fase={p.fase} />
                    )}
                  </RutaProtegida>
                }
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SesionProvider>
  );
}
