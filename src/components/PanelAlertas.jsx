// Lista de lo que el motor de reglas decidió hasta el instante actual.
// Cada severidad lleva texto (no solo color).
export const ETIQUETA_SEVERIDAD = { alta: 'Alta', media: 'Media', baja: 'Baja', informativa: 'Informativa' };
const seg = (t) => `${t.toFixed(1).replace('.', ',')} s`;

export default function PanelAlertas({ eventos, activas, sesion }) {
  const alertas = eventos.filter((e) => e.tipo === 'alerta');
  const advertencias = eventos.filter((e) => e.tipo === 'advertencia');
  const informativas = eventos.filter((e) => e.tipo === 'informativa');
  const cierres = eventos.filter((e) => e.tipo === 'cierre');
  const activa = (e) => activas.some((a) => a.regla === e.regla && a.objetivo === e.objetivo);
  const afluencia = informativas.filter((e) => e.regla === 'RN-04.2').length;
  const otrasInfo = informativas.filter((e) => e.regla !== 'RN-04.2');

  return (
    <section className="panel-alertas" aria-label="Alertas y avisos">
      <h2>Alertas y avisos</h2>
      <p className="nota">
        {sesion
          ? sesion.terminada
            ? 'Sesión completada y guardada en el historial.'
            : 'Sesión registrada: las alertas se guardan al ocurrir.'
          : 'Vista previa: pulsa Iniciar para registrar la sesión y guardar sus alertas.'}
      </p>

      {alertas.length === 0 && advertencias.length === 0 && <p className="nota">Sin alertas por ahora.</p>}

      <ul className="lista-alertas">
        {alertas.map((a) => (
          <li key={a.clave} className={`sev-${a.severidad}`}>
            <span className={`insignia-sev sev-${a.severidad}`}>{ETIQUETA_SEVERIDAD[a.severidad]}</span>
            <strong>{a.codigo}</strong> · {seg(a.t)}
            <span className="detalle">{a.mensaje}</span>
            <span className="detalle">
              Evidencia: {a.objetivo} · cuadro {a.cuadro} · {activa(a) ? 'situación activa' : 'situación terminada'} · se revisa en Alertas
            </span>
          </li>
        ))}
        {advertencias.map((a) => (
          <li key={a.clave} className="sev-advertencia">
            <span className="insignia-sev sev-advertencia">Advertencia</span>
            <strong>{a.codigo}</strong> · {seg(a.t)}
            <span className="detalle">{a.mensaje} ({a.objetivo}). Sin alerta.</span>
          </li>
        ))}
      </ul>

      {(otrasInfo.length > 0 || afluencia > 0 || cierres.length > 0) && (
        <details>
          <summary>Informativas ({otrasInfo.length + afluencia}) y situaciones terminadas ({cierres.length})</summary>
          <ul className="lista-info">
            {afluencia > 0 && <li>Afluencia: {afluencia} personas cruzaron la entrada (RN-04.2).</li>}
            {otrasInfo.map((e) => (
              <li key={e.clave}>
                {seg(e.t)} · {e.codigo}: {e.clasificacion ?? e.mensaje} ({e.objetivo})
              </li>
            ))}
            {cierres.map((e) => (
              <li key={e.clave}>
                {seg(e.t)} · Terminó la situación de {e.codigo} ({e.objetivo})
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
