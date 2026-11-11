import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { guardarVersionRegla, historialRegla, reglasVigentes } from '../data/repositorio.js';
import { useSesion } from '../auth/SesionContext.jsx';
import { useAvisos } from '../components/ui/Avisos.jsx';
import { Save } from 'lucide-react';
import reglasJson from '../rules/reglas.json';
import { casoPorId } from '../simulation/casos.js';

// Reglas: solo el administrador entra (la ruta lo exige).
// Guardar crea una versión nueva; las sesiones nuevas usan la versión vigente
// y las anteriores conservan la que usaron (RN-G4).
const ORDEN = ['CU-02', 'CU-04', 'CU-01', 'CU-03'];
const ES_PROPORCION = ['ocupacion', 'obstruccion', 'cambioOcupacion', 'defecto'];

export default function Reglas() {
  const reglas = useLiveQuery(reglasVigentes, []);

  return (
    <div className="reglas-pagina">
      <h1>Reglas</h1>
      <p className="nota">
        Los valores son iniciales y se ajustan aquí. Al guardar se crea una versión nueva: las sesiones nuevas la usan y
        las anteriores conservan la suya.
      </p>
      <details className="panel">
        <summary>Reglas generales</summary>
        <ul>
          {reglasJson.generales.map((g) => (
            <li key={g.codigo}>
              <strong>{g.codigo}</strong>: {g.texto}
            </li>
          ))}
        </ul>
      </details>

      {reglas === undefined ? (
        <p className="nota">Cargando…</p>
      ) : (
        ORDEN.map((caso) => (
          <section key={caso} className="panel grupo-reglas">
            <h2>
              {caso} · {casoPorId(caso).nombre}
            </h2>
            {reglas
              .filter((r) => r.caso === caso)
              .map((r) => (
                <FilaRegla key={`${r.id}-${r.version}`} regla={r} />
              ))}
          </section>
        ))
      )}
    </div>
  );
}

function FilaRegla({ regla }) {
  const { usuario } = useSesion();
  const avisar = useAvisos();
  const c = regla.condicion;
  const tieneUmbral = typeof c.umbral === 'number';
  const proporcion = ES_PROPORCION.includes(c.tipo);
  // Las proporciones se editan en porcentaje (más fácil de leer); se guardan entre 0 y 1.
  const [valores, setValores] = useState({
    umbral: tieneUmbral ? (proporcion ? Math.round(c.umbral * 100) : c.umbral) : '',
    radio: c.radio ?? '',
    duracion: regla.duracion,
    severidad: regla.severidad,
    activa: regla.activa,
  });
  const [mensaje, setMensaje] = useState(null);
  const versiones = useLiveQuery(() => historialRegla(regla.id), [regla.id, regla.version]);
  const cambiar = (campo) => (e) =>
    setValores((v) => ({ ...v, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    if (proporcion && (Number(valores.umbral) < 0 || Number(valores.umbral) > 100)) {
      setMensaje({ ok: false, texto: 'El umbral es un porcentaje: debe estar entre 0 y 100.' });
      return;
    }
    const condicion = {};
    if (tieneUmbral) condicion.umbral = proporcion ? Number(valores.umbral) / 100 : Number(valores.umbral);
    if (c.radio != null) condicion.radio = Number(valores.radio);
    try {
      const nueva = await guardarVersionRegla(
        regla.id,
        { condicion, duracion: Number(valores.duracion), severidad: valores.severidad, activa: valores.activa },
        usuario,
      );
      setMensaje({ ok: true, texto: `Guardada como versión ${nueva.version}.` });
      avisar({ tipo: 'exito', titulo: `${regla.codigo ?? regla.id} guardada como versión ${nueva.version}`, texto: 'Las sesiones nuevas usarán este valor.' });
    } catch (err) {
      setMensaje({ ok: false, texto: err.message });
    }
  }

  return (
    <form className="fila-regla" onSubmit={guardar}>
      <div className="fila-titulo">
        <strong>{regla.codigo ?? regla.id}</strong> {regla.nombre}
        <span className="nota"> · versión {regla.version}{versiones && versiones.length > 1 ? ` (${versiones.length} versiones)` : ''}</span>
      </div>
      <div className="fila-campos">
        {tieneUmbral && (
          <label>
            Umbral{proporcion ? ' (%)' : ''}
            <input type="number" step="any" value={valores.umbral} onChange={cambiar('umbral')} required />
          </label>
        )}
        {c.radio != null && (
          <label>
            Radio (0–1)
            <input type="number" step="0.01" value={valores.radio} onChange={cambiar('radio')} required />
          </label>
        )}
        <label>
          Duración (s)
          <input type="number" step="0.5" min="0" value={valores.duracion} onChange={cambiar('duracion')} required />
        </label>
        <label>
          Severidad
          <select value={valores.severidad} onChange={cambiar('severidad')}>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
            <option value="informativa">Informativa</option>
          </select>
        </label>
        <label className="casilla">
          <input type="checkbox" checked={valores.activa} onChange={cambiar('activa')} /> Activa
        </label>
        <button type="submit">
          <Save className="icono" aria-hidden="true" />
          Guardar versión
        </button>
      </div>
      {mensaje && (
        <p className={mensaje.ok ? 'nota' : 'error'} role={mensaje.ok ? 'status' : 'alert'}>
          {mensaje.texto}
        </p>
      )}
    </form>
  );
}
