import { useMemo, useState } from 'react';
import { CASOS } from '../simulation/casos.js';
import { eventoActual, generarCuadro } from '../simulation/motor.js';
import { useSimulacion } from '../simulation/useSimulacion.js';
import { crearAnalizador } from '../analysis/analizar.js';
import VisorEscena, { CAPAS } from '../components/VisorEscena.jsx';
import ControlesSimulacion from '../components/ControlesSimulacion.jsx';
import PanelResultados from '../components/PanelResultados.jsx';
import PanelAlertas from '../components/PanelAlertas.jsx';
import { useSesion } from '../auth/SesionContext.jsx';
import { useSesionAnalisis } from '../data/useSesionAnalisis.js';
import { alertasActivas } from '../rules/motorReglas.js';

// Análisis visual: elegir caso → ver la escena simulada → controlarla.
// El análisis de regiones (fase 4) y las alertas (fase 6) se agregan sobre esta pantalla.
export default function Analisis() {
  const [idCaso, setIdCaso] = useState(CASOS[0].caso);
  const guion = CASOS.find((c) => c.caso === idCaso);
  const [semilla, setSemilla] = useState(guion.semilla);
  const [presentacion, setPresentacion] = useState(true);
  const [capas, setCapas] = useState(['regiones', 'figuras']);
  const { reloj, escena, controles, fps } = useSimulacion(guion, semilla);
  const { usuario } = useSesion();
  const { eventos, sesion, acciones, error, cargando } = useSesionAnalisis({ guion, semilla, reloj, controles, usuario });
  const ocurridos = useMemo(() => eventos.filter((e) => e.t <= reloj.t), [eventos, reloj.t]);
  const activas = useMemo(() => alertasActivas(eventos, reloj.t), [eventos, reloj.t]);
  const controlesSesion = { ...controles, ...acciones };

  const alternarCapa = (id) =>
    setCapas((actuales) => (actuales.includes(id) ? actuales.filter((c) => c !== id) : [...actuales, id]));
  const evento = eventoActual(guion, reloj.t);

  // El análisis corre a frecuencia fija: solo cambia cuando cambia el número de cuadro.
  const analizar = useMemo(() => crearAnalizador(guion, semilla), [guion, semilla]);
  const resultado = useMemo(
    () => analizar(generarCuadro(guion, escena.indice, semilla)),
    [analizar, guion, escena.indice, semilla],
  );

  function elegirCaso(id) {
    setIdCaso(id);
    setSemilla(CASOS.find((c) => c.caso === id).semilla);
  }

  return (
    <div className="analisis">
      <header className="analisis-cabecera">
        <h1>Análisis visual</h1>
        <div className="casos" role="group" aria-label="Caso de uso">
          {CASOS.map((c) => (
            <button
              key={c.caso}
              type="button"
              className={c.caso === idCaso ? '' : 'secundario'}
              aria-pressed={c.caso === idCaso}
              onClick={() => elegirCaso(c.caso)}
            >
              {c.caso} · {c.nombre}
            </button>
          ))}
        </div>
        <div className="opciones">
          <label>
            Semilla{' '}
            <input
              type="number"
              value={semilla}
              onChange={(e) => setSemilla(Number.parseInt(e.target.value, 10) || 0)}
            />
          </label>
          <label>
            <input type="checkbox" checked={presentacion} onChange={(e) => setPresentacion(e.target.checked)} />{' '}
            Modo presentación
          </label>
        </div>
        <fieldset className="capas">
          <legend>Capas</legend>
          {CAPAS.map((c) => (
            <label key={c.id}>
              <input type="checkbox" checked={capas.includes(c.id)} onChange={() => alternarCapa(c.id)} /> {c.etiqueta}
            </label>
          ))}
        </fieldset>
      </header>

      <div className="analisis-cuerpo">
        <div className="analisis-escena">
          <VisorEscena escena={escena} resultado={resultado} capas={capas} alertas={activas} />
          <Leyenda capas={capas} />

          {presentacion && (
            <p className="subtitulo" aria-live="polite">
              {evento ? `${evento.t} s · ${evento.texto}` : 'Pulsa Iniciar para reproducir la escena.'}
            </p>
          )}

          <ControlesSimulacion reloj={reloj} eventos={guion.eventos} controles={controlesSesion} />
          {error && (
            <p className="panel aviso" role="alert">
              No se pudo guardar: {error}
            </p>
          )}
        </div>
        <div className="analisis-lateral">
          {cargando ? <p className="nota">Cargando reglas…</p> : <PanelAlertas eventos={ocurridos} activas={activas} sesion={sesion} />}
          <PanelResultados resultado={resultado} />
        </div>
      </div>

      <p className="nota">
        Cuadro {escena.indice} · Dibujo: {fps == null ? '—' : `${fps} cuadros/s`} · La escena se genera con figuras a
        partir del guion {guion.caso} (versión {guion.version}); la misma semilla produce siempre la misma escena.
      </p>
    </div>
  );
}

// Explica qué significa cada capa activa; nada se comunica solo con color.
function Leyenda({ capas }) {
  const textos = {
    ocupacion: 'Ocupación: de verde (vacía) a rojo (llena), con el porcentaje escrito.',
    calor: 'Mapa de calor: más intenso cuantas más personas hay en la región; se indica el número.',
    cambios: 'Cambios: borde punteado en las regiones cuya ocupación cambió respecto del inicio (más grueso desde 20 puntos).',
    figuras: 'Personas: casco amarillo, chaleco naranja; translúcida = poco visible. Productos: etiqueta blanca, defecto rojo.',
  };
  const activos = capas.filter((c) => textos[c]);
  if (activos.length === 0) return null;
  return (
    <ul className="leyenda">
      {activos.map((c) => (
        <li key={c}>{textos[c]}</li>
      ))}
    </ul>
  );
}
