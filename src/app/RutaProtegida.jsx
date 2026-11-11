import { Navigate } from 'react-router-dom';
import { useSesion } from '../auth/SesionContext.jsx';

// Sin usuario elegido: vuelve a la pantalla de ingreso.
// Con usuario sin permiso: muestra "Acceso denegado" (prueba PF-01).
export default function RutaProtegida({ permiso, children }) {
  const { usuario, puede } = useSesion();
  if (!usuario) return <Navigate to="/ingresar" replace />;
  if (permiso && !puede(permiso)) {
    return (
      <section className="panel aviso" role="alert">
        <h1>Acceso denegado</h1>
        <p>Tu rol de ejemplo no tiene permiso para abrir esta pantalla.</p>
      </section>
    );
  }
  return children;
}
