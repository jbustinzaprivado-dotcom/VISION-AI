import clases from '../simulation/clases.json';

const pct = (v) => `${Math.round(v * 100)} %`;
const signo = (v) => (v > 0 ? `+${pct(v)}` : pct(v));

// Panel lateral del análisis: muestra lo que calculó el análisis del cuadro actual.
// Solo presenta datos; no calcula nada.
export default function PanelResultados({ resultado }) {
  const nombres = Object.fromEntries(resultado.regiones.map((r) => [r.id, r.nombre]));
  const cambios = Object.fromEntries(resultado.cambios.map((c) => [c.region, c]));
  const enInspeccion = resultado.objetos.filter(
    (o) => o.clase === 'producto' && o.regiones.some((id) => id.startsWith('inspeccion')),
  );
  const totalPersonas = resultado.objetos.filter((o) => o.clase === 'persona').length;

  return (
    <aside className="panel-resultados" aria-label="Resultados del análisis">
      <h2>Resultado del cuadro {resultado.cuadro}</h2>
      <p className="nota">
        {resultado.objetos.length} {resultado.objetos.length === 1 ? 'figura' : 'figuras'} en escena ·{' '}
        {totalPersonas} {totalPersonas === 1 ? 'persona' : 'personas'}
      </p>

      <table>
        <thead>
          <tr>
            <th scope="col">Región</th>
            <th scope="col">Ocupación</th>
            <th scope="col" title="Cambio de ocupación respecto del inicio">Cambio</th>
          </tr>
        </thead>
        <tbody>
          {resultado.mediciones.map((m) => (
            <tr key={m.region}>
              <th scope="row">
                <span className="punto" style={{ background: clases.regiones[m.clase].color }} />
                {nombres[m.region]}
                <span className="detalle">
                  {m.libre ? 'Libre' : `Objetos ${pct(m.obstruccion)}`}
                  {m.personas > 0 && ` · ${m.personas} ${m.personas === 1 ? 'persona' : 'personas'}`}
                </span>
              </th>
              <td>
                <div className="barra" role="img" aria-label={`Ocupación ${pct(m.ocupacion)}`}>
                  <span style={{ width: pct(m.ocupacion) }} />
                </div>
                {pct(m.ocupacion)}
              </td>
              <td className={cambios[m.region] ? 'cambio' : 'nota'}>
                {cambios[m.region] ? signo(cambios[m.region].diferencia) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {enInspeccion.length > 0 && (
        <div className="inspeccion">
          <h3>En inspección</h3>
          {enInspeccion.map((p) => (
            <p key={p.id}>
              <strong>{p.id}</strong>: defecto {pct(p.proporcionDefecto)}
              {!p.atributos.etiqueta && ' · sin etiqueta'}
              {p.atributos.piezaFaltante && ' · pieza faltante'}
            </p>
          ))}
        </div>
      )}
      <p className="nota">Resultados simulados: se calculan con la geometría de las figuras, no con imágenes.</p>
    </aside>
  );
}
