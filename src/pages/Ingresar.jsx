import { Navigate } from 'react-router-dom';
import { ChevronRight, Eye, ScanEye, ShieldCheck, UserCog, Wrench } from 'lucide-react';
import { useSesion } from '../auth/SesionContext.jsx';
import { ROLES, USUARIOS_EJEMPLO } from '../auth/roles.js';

const QUE_HACE = {
  administrador: 'Todo, incluida la configuración de reglas y la bandeja simulada.',
  supervisor: 'Ejecuta casos, revisa y cierra alertas, exporta reportes.',
  operador: 'Ejecuta casos y revisa alertas; exporta solo lo propio.',
  auditor: 'Consulta dashboard, historial y alertas en solo lectura.',
};
const ICONO_ROL = { administrador: UserCog, supervisor: ShieldCheck, operador: Wrench, auditor: Eye };

// Inicio de sesión simulado: no hay contraseñas, solo se elige un rol de ejemplo.
export default function Ingresar() {
  const { usuario, entrar } = useSesion();
  if (usuario) return <Navigate to="/" replace />;

  return (
    <div className="ingreso">
      <section className="panel">
        <span className="rotulo">PROTOTIPO</span>
        <h1>
          <span className="logo-icono">
            <ScanEye className="icono" aria-hidden="true" />
          </span>
          VISION AI
        </h1>
        <p>
          Simulación de cómo un sistema de visión artificial entiende un entorno: una cámara simulada recorre cuatro
          casos de uso y el sistema analiza regiones, ocupación y riesgos cuadro a cuadro.
        </p>
        <p className="nota">Elige un rol de ejemplo para entrar; cada rol ve solo lo que tiene permitido.</p>
        <ul className="roles">
          {USUARIOS_EJEMPLO.map((u) => {
            const Icono = ICONO_ROL[u.rol];
            return (
              <li key={u.id}>
                <button type="button" onClick={() => entrar(u.id)}>
                  <span className="rol-icono">
                    <Icono className="icono" aria-hidden="true" />
                  </span>
                  <strong>{ROLES[u.rol]}</strong>
                  <ChevronRight className="icono flecha" aria-hidden="true" />
                  <span>{QUE_HACE[u.rol]}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="nota">Inicio de sesión simulado: no es una seguridad real.</p>
      </section>
    </div>
  );
}
