import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSesion } from '../auth/SesionContext.jsx';
import { ROLES } from '../auth/roles.js';
import { MENU } from './menu.js';
import ManejoErrores from '../components/ManejoErrores.jsx';

// Marco común: menú lateral, cabecera con el rótulo PROTOTIPO y área de trabajo.
export default function Layout() {
  const { usuario, salir, puede } = useSesion();
  const location = useLocation(); // al cambiar de pantalla se limpia un error anterior
  const opciones = MENU.filter((m) => puede(m.permiso));

  return (
    <div className="marco">
      <aside className="menu">
        <div className="logo">VISION AI</div>
        <nav aria-label="Menú principal">
          {opciones.map((m) => (
            <NavLink key={m.ruta} to={m.ruta} end={m.ruta === '/'}>
              {m.etiqueta}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="contenido">
        <header className="cabecera">
          <span className="rotulo" title="Todos los resultados vienen de una simulación">
            PROTOTIPO
          </span>
          <span className="usuario">
            {usuario.nombre} · <strong>{ROLES[usuario.rol]}</strong>
          </span>
          <button type="button" className="secundario" onClick={salir}>
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
