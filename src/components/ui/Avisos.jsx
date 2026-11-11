import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

// Avisos emergentes (toasts): confirman una acción sin interrumpir.
// Uso: const avisar = useAvisos(); avisar({ tipo: 'exito', titulo: 'Guardado', texto: '...' });
const AvisosContext = createContext(() => {});
const ICONOS = { exito: CheckCircle2, error: XCircle, alerta: AlertTriangle, info: Info };
const DURACION_MS = 4500;

export function AvisosProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const siguiente = useRef(1);

  const quitar = useCallback((id) => setAvisos((lista) => lista.filter((a) => a.id !== id)), []);
  const avisar = useCallback(
    ({ tipo = 'info', titulo, texto }) => {
      const id = siguiente.current++;
      setAvisos((lista) => [...lista.slice(-3), { id, tipo, titulo, texto }]);
      setTimeout(() => quitar(id), DURACION_MS);
    },
    [quitar],
  );
  const valor = useMemo(() => avisar, [avisar]);

  return (
    <AvisosContext.Provider value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => {
          const Icono = ICONOS[a.tipo] ?? Info;
          return (
            <div key={a.id} className={`aviso-emergente ${a.tipo}`}>
              <Icono className="icono" aria-hidden="true" />
              <div>
                <strong>{a.titulo}</strong>
                {a.texto && <p>{a.texto}</p>}
              </div>
              <button type="button" className="fantasma" onClick={() => quitar(a.id)} aria-label="Cerrar aviso">
                <X className="icono" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </AvisosContext.Provider>
  );
}

export function useAvisos() {
  return useContext(AvisosContext);
}
