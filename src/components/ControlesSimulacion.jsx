import { FPS, VELOCIDADES } from '../simulation/reloj.js';

// Controles de la sesión: iniciar/pausar, reiniciar, paso a paso, velocidad
// y línea de tiempo con marcas en los eventos del guion.
export default function ControlesSimulacion({ reloj, eventos, controles }) {
  const { t, duracion, pausado, terminado, velocidad } = reloj;

  return (
    <div className="controles">
      <div className="botones">
        {pausado ? (
          <button type="button" onClick={controles.iniciar} disabled={terminado}>
            {t === 0 ? 'Iniciar' : 'Reanudar'}
          </button>
        ) : (
          <button type="button" onClick={controles.pausar}>
            Pausar
          </button>
        )}
        <button type="button" className="secundario" onClick={controles.reiniciar}>
          Reiniciar
        </button>
        <button type="button" className="secundario" onClick={controles.pasoAPaso} disabled={terminado}>
          Paso a paso
        </button>
        <div className="velocidades" role="group" aria-label="Velocidad">
          {VELOCIDADES.map((v) => (
            <button
              key={v}
              type="button"
              className={v === velocidad ? '' : 'secundario'}
              aria-pressed={v === velocidad}
              onClick={() => controles.velocidad(v)}
            >
              {String(v).replace('.', ',')}×
            </button>
          ))}
        </div>
        <span className="tiempo" aria-live="off">
          {t.toFixed(1).replace('.', ',')} s / {duracion} s{terminado ? ' · completada' : ''}
        </span>
      </div>

      <div className="linea-tiempo">
        <input
          type="range"
          min={0}
          max={duracion}
          step={1 / FPS}
          value={t}
          aria-label="Línea de tiempo"
          onChange={(e) => controles.saltarA(Number(e.target.value))}
        />
        <div className="marcas">
          {eventos.map((ev, i) => (
            <button
              key={`${ev.t}-${i}`}
              type="button"
              className="marca"
              style={{ left: `${(ev.t / duracion) * 100}%` }}
              title={`${String(ev.t).replace('.', ',')} s: ${ev.texto}`}
              aria-label={`Ir al segundo ${ev.t}`}
              onClick={() => controles.saltarA(ev.t)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
