import { Navigate } from 'react-router-dom';
import { useSesion } from '../auth/SesionContext.jsx';
import { ROLES, USUARIOS_EJEMPLO } from '../auth/roles.js';

const QUE_HACE = {
  administrador: 'Todo, incluida la configuración de reglas.',
  supervisor: 'Ejecuta casos, revisa y cierra alertas, exporta reportes.',
  operador: 'Ejecuta casos y revisa alertas; exporta solo lo propio.',
  auditor: 'Consulta dashboard, historial y alertas en solo lectura.',
};

// Inicio de sesión simulado: no hay contraseñas, solo se elige un rol de ejemplo.
export default function Ingresar() {
  const { usuario, entrar } = useSesion();
  if (usuario) return <Navigate to="/" replace />;

  return (
    <div className="ingreso">
      <section className="panel">
        <span className="rotulo">PROTOTIPO</span>
        <h1>VISION AI</h1>
        <p>
          Simulación de cómo un sistema de visión artificial entiende un entorno. Elige un rol de
          ejemplo para entrar; cada rol ve solo lo que tiene permitido.
        </p>
        <ul className="roles">
          {USUARIOS_EJEMPLO.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => entrar(u.id)}>
                <strong>{ROLES[u.rol]}</strong>
                <span>{QUE_HACE[u.rol]}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="nota">Inicio de sesión simulado: no es una seguridad real.</p>
      </section>
    </div>
  );
}
