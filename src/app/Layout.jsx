import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  BrainCircuit,
  Cctv,
  History,
  LayoutDashboard,
  LogOut,
  Mail,
  Monitor,
  Moon,
  ScanEye,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { useSesion } from '../auth/SesionContext.jsx';
import { ROLES } from '../auth/roles.js';
import { MENU } from './menu.js';
import ManejoErrores from '../components/ManejoErrores.jsx';
import { useTema } from '../components/ui/useTema.js';

// Ícono de cada pantalla del menú (menu.js queda sin dependencias de interfaz).
const ICONOS = {
  '/': LayoutDashboard,
  '/analisis': Cctv,
  '/entrenamiento': BrainCircuit,
  '/alertas': Bell,
  '/historial': History,
  '/reglas': SlidersHorizontal,
  '/bandeja': Mail,
};
const TEMAS = {
  sistema: { icono: Monitor, texto: 'Tema: según el sistema' },
  claro: { icono: Sun, texto: 'Tema: claro' },
  oscuro: { icono: Moon, texto: 'Tema: oscuro' },
};
const iniciales = (nombre) =>
  nombre
    .split(' ')
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

// Marco común: menú lateral, cabecera con el rótulo PROTOTIPO y área de trabajo.
export default function Layout() {
  const { usuario, salir, puede } = useSesion();
  const location = useLocation(); // al cambiar de pantalla se limpia un error anterior
  const { tema, siguiente } = useTema();
  const opciones = MENU.filter((m) => puede(m.permiso));
  const IconoTema = TEMAS[tema].icono;

  return (
    <div className="marco">
      <aside className="menu">
        <div className="logo">
          <span className="logo-icono">
            <ScanEye className="icono" aria-hidden="true" />
          </span>
          <span>
            VISION AI
            <small>Análisis visual simulado</small>
          </span>
        </div>
        <nav aria-label="Menú principal">
          {opciones.map((m) => {
            const Icono = ICONOS[m.ruta];
            return (
              <NavLink key={m.ruta} to={m.ruta} end={m.ruta === '/'}>
                {Icono && <Icono className="icono" aria-hidden="true" />}
                {m.etiqueta}
              </NavLink>
            );
          })}
        </nav>
        <p className="menu-pie">Prototipo académico · los datos se guardan solo en este navegador.</p>
      </aside>

      <div className="contenido">
        <header className="cabecera">
          <span className="rotulo" title="Todos los resultados vienen de una simulación">
            PROTOTIPO
          </span>
          <span className="usuario">
            <span className="avatar" aria-hidden="true">
              {iniciales(usuario.nombre)}
            </span>
            <span>
              {usuario.nombre} · <strong>{ROLES[usuario.rol]}</strong>
            </span>
          </span>
          <button type="button" className="fantasma" onClick={siguiente} title={TEMAS[tema].texto} aria-label={`${TEMAS[tema].texto}. Cambiar tema`}>
            <IconoTema className="icono" aria-hidden="true" />
          </button>
          <button type="button" className="secundario" onClick={salir}>
            <LogOut className="icono" aria-hidden="true" />
            Cambiar rol
          </button>
        </header>
        <main className="trabajo">
          <ManejoErrores key={location.pathname}>
            <Outlet />
          </ManejoErrores>
        </main>
      </div>
    </div>
  );
}
