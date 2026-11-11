import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

// Diálogo de confirmación accesible (reemplaza a window.confirm):
// el foco va al botón de confirmar, Escape cancela y el clic fuera también.
export default function Dialogo({ abierto, titulo, texto, confirmar = 'Confirmar', peligro = false, onConfirmar, onCancelar }) {
  const boton = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const anterior = document.activeElement;
    boton.current?.focus();
    const tecla = (e) => {
      if (e.key === 'Escape') onCancelar();
    };
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      anterior?.focus?.();
    };
  }, [abierto, onCancelar]);

  if (!abierto) return null;
  return (
    <div className="dialogo-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCancelar()}>
      <div className="dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dialogo-titulo" aria-describedby="dialogo-texto">
        <h2 id="dialogo-titulo">
          {peligro && <AlertTriangle className="icono" aria-hidden="true" style={{ color: 'var(--peligro)' }} />}
          {titulo}
        </h2>
        <p id="dialogo-texto">{texto}</p>
        <div className="botones">
          <button type="button" className="secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" ref={boton} className={peligro ? 'peligro' : ''} onClick={onConfirmar}>
            {confirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
