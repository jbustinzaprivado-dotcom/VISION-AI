import { useEffect, useRef, useState } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Escena3D } from './escena3d.js';

// Vista 3D de la escena (DT-10). Muestra el mismo cuadro que la vista 2D, con las
// alertas activas marcadas. Se puede girar (arrastrar), acercar (rueda) y volver a
// las vistas fijas. Three.js se descarga solo al elegir esta vista.
const BOTONES = [
  { id: 'camara', texto: 'Cámara' },
  { id: 'cenital', texto: 'Cenital' },
  { id: 'lateral', texto: 'Lateral' },
];

const reloj = (t) => {
  const s = Math.floor(t);
  return `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
};

export default function Visor3D({ escena, guion, alertas = [] }) {
  const contenedor = useRef(null);
  const tres = useRef(null);
  const [vista, setVista] = useState('camara');
  const [error, setError] = useState(null);

  useEffect(() => {
    const el = contenedor.current;
    let e;
    try {
      e = new Escena3D(el, { Controles: OrbitControls });
    } catch (err) {
      setError(err.message);
      return undefined;
    }
    tres.current = e;
    // Al girar o acercar con el mouse ya no es ninguna de las vistas fijas.
    e.controles?.addEventListener('start', () => setVista(null));
    // Ancho del contenedor y alto 16:9; oculto (ancho 0) no se redimensiona.
    const medir = () => el.clientWidth > 0 && e.redimensionar(el.clientWidth, Math.round((el.clientWidth * 9) / 16));
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => {
      observador.disconnect();
      e.liberar();
      tres.current = null;
    };
  }, []);

  useEffect(() => {
    tres.current?.sincronizar({ guion, escena, alertas });
  }, [guion, escena, alertas]);

  const elegir = (id) => {
    setVista(id);
    tres.current?.vista(id);
  };

  if (error) {
    return (
      <p className="panel aviso" role="alert">
        Este navegador no pudo iniciar la vista 3D (WebGL): {error}. Usa la vista 2D.
      </p>
    );
  }

  return (
    <div className="visor visor-3d" ref={contenedor} aria-label={`Vista 3D de ${guion.nombre}`} role="img">
      <div className="visor-3d-vistas" role="group" aria-label="Punto de vista">
        {BOTONES.map((b) => (
          <button key={b.id} type="button" className={b.id === vista ? '' : 'secundario'} aria-pressed={b.id === vista} onClick={() => elegir(b.id)}>
            {b.texto}
          </button>
        ))}
      </div>
      <div className="visor-3d-franja" aria-hidden="true">
        <span>{`CAM-${guion.caso.slice(3)} · ${guion.nombre.toUpperCase()} · 3D`}</span>
        <span className="rec">● REC {reloj(escena.t)}</span>
        <span className="rotulo-3d">PROTOTIPO</span>
      </div>
      <p className="visor-3d-ayuda">Arrastra para girar · rueda para acercar</p>
    </div>
  );
}
