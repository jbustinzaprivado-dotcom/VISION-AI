import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useAvisos } from '../components/ui/Avisos.jsx';
import { GENERADORES } from '../simulation/generadores.js';
import { Dices, Shuffle } from 'lucide-react';
import { useVisionPixeles } from '../vision/useVisionPixeles.js';
import CapturaCamara from '../vision/CapturaCamara.jsx';
import PanelOpenCV from '../components/PanelOpenCV.jsx';
import { claveGuion } from '../data/useSesionAnalisis.js';

// Opciones iniciales de cada generador (almacén, línea de calidad...).
const OPCIONES_GENERADORES = Object.fromEntries(Object.entries(GENERADORES).map(([id, g]) => [id, g.opcionesIniciales]));

// Análisis visual: elegir caso → ver la escena simulada → controlarla.
// El análisis de regiones (fase 4) y las alertas (fase 6) se agregan sobre esta pantalla.
export default function Analisis() {
  const [idCaso, setIdCaso] = useState(CASOS[0].caso);
  const [semilla, setSemilla] = useState(CASOS[0].semilla);
  const [opcionesPorGenerador, setOpcionesPorGenerador] = useState(OPCIONES_GENERADORES);
  const generador = GENERADORES[idCaso] ?? null; // null = guion fijo
  const opciones = generador ? opcionesPorGenerador[idCaso] : null;
  // Guion fijo del caso, o uno generado a partir de la semilla y las opciones.
  const guion = useMemo(
    () => (generador ? generador.generar(semilla, opciones) : CASOS.find((c) => c.caso === idCaso)),
    [generador, idCaso, semilla, opciones],
  );
  const [presentacion, setPresentacion] = useState(true);
  const [capas, setCapas] = useState(['regiones', 'detecciones', 'figuras']);
  const { reloj, escena, controles, fps } = useSimulacion(guion, semilla);
  const { usuario } = useSesion();
  const { eventos, sesion, acciones, error, cargando } = useSesionAnalisis({ guion, semilla, reloj, controles, usuario });
  const ocurridos = useMemo(() => eventos.filter((e) => e.t <= reloj.t), [eventos, reloj.t]);
  const activas = useMemo(() => alertasActivas(eventos, reloj.t), [eventos, reloj.t]);
  const controlesSesion = { ...controles, ...acciones };

  // Avisos emergentes: cada alerta nueva mientras la escena corre y el fin de la sesión.
  const avisar = useAvisos();
  const alertasVistas = useRef(0);
  const cantidadAlertas = ocurridos.filter((e) => e.tipo === 'alerta').length;
  useEffect(() => {
    if (cantidadAlertas > alertasVistas.current && !reloj.pausado) {
      const nueva = ocurridos.filter((e) => e.tipo === 'alerta').at(-1);
      avisar({ tipo: 'alerta', titulo: `Alerta ${nueva.severidad} · ${nueva.codigo}`, texto: `${nueva.mensaje} (${nueva.objetivo})` });
    }
    alertasVistas.current = cantidadAlertas;
  }, [cantidadAlertas, ocurridos, reloj.pausado, avisar]);
  const terminadaAntes = useRef(false);
  useEffect(() => {
    const terminada = Boolean(sesion?.terminada);
    if (terminada && !terminadaAntes.current) {
      avisar({ tipo: 'exito', titulo: 'Sesión completada', texto: `${guion.caso} se guardó en el historial con ${cantidadAlertas} ${cantidadAlertas === 1 ? 'alerta' : 'alertas'}.` });
    }
    terminadaAntes.current = terminada;
  }, [sesion, guion, cantidadAlertas, avisar]);

  const alternarCapa = (id) =>
    setCapas((actuales) => (actuales.includes(id) ? actuales.filter((c) => c !== id) : [...actuales, id]));
  const evento = eventoActual(guion, reloj.t);

  // El análisis corre a frecuencia fija: solo cambia cuando cambia el número de cuadro.
  const analizar = useMemo(() => crearAnalizador(guion, semilla), [guion, semilla]);
  const cuadro = useMemo(() => generarCuadro(guion, escena.indice, semilla), [guion, escena.indice, semilla]);
  const resultado = useMemo(() => analizar(cuadro), [analizar, cuadro]);

  // Capa OpenCV: visión por píxeles sobre la cámara limpia, comparada con la geometría.
  const conOpenCV = capas.includes('opencv');
  const visionCv = useVisionPixeles({
    activo: conOpenCV,
    claveEscena: `${claveGuion(guion)}|${semilla}`,
    resultadoGeometrico: resultado,
    avisar,
  });
  const nombresRegiones = useMemo(() => Object.fromEntries(guion.regiones.map((r) => [r.id, r.nombre])), [guion]);

  function elegirCaso(id) {
    setIdCaso(id);
    setSemilla(GENERADORES[id] ? semilla : CASOS.find((c) => c.caso === id).semilla);
  }
  const cambiarOpcion = (campo) => (e) =>
    setOpcionesPorGenerador((todas) => ({
      ...todas,
      [idCaso]: { ...todas[idCaso], [campo.id]: campo.numerico ? Number(e.target.value) : e.target.value },
    }));
  const nuevaEscena = () => setSemilla(Math.floor(Math.random() * 1_000_000));

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
          {Object.entries(GENERADORES).map(([id, g]) => (
            <button
              key={id}
              type="button"
              className={id === idCaso ? '' : 'secundario'}
              aria-pressed={id === idCaso}
              onClick={() => elegirCaso(id)}
              title="Escena creada a partir de la semilla: cada semilla produce una escena y una historia distintas"
            >
              <Shuffle className="icono" aria-hidden="true" />
              {g.caso} · {g.nombre}
            </button>
          ))}
        </div>
        {generador && (
          <div className="generador" role="group" aria-label={`Opciones: ${generador.nombre}`}>
            {generador.campos.map((campo) => (
              <label key={campo.id}>
                {campo.etiqueta}
                <select value={opciones[campo.id]} onChange={cambiarOpcion(campo)}>
                  {campo.valores.map((v) => (
                    <option key={v.valor} value={v.valor}>{v.texto}</option>
                  ))}
                </select>
              </label>
            ))}
            <button type="button" onClick={nuevaEscena}>
              <Dices className="icono" aria-hidden="true" />
              Nueva escena
            </button>
            <p className="nota">{guion.esperado.resumen} Misma semilla y opciones: misma escena.</p>
          </div>
        )}
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
          <VisorEscena escena={escena} resultado={resultado} capas={capas} alertas={activas} guion={guion}
            cajasOpenCV={conOpenCV ? visionCv.vision?.pixeles.cajas ?? [] : []} />
          {conOpenCV && visionCv.listo && <CapturaCamara cuadro={cuadro} onCaptura={visionCv.onCaptura} />}
          <Leyenda capas={capas} />

          {presentacion && (
            <p className="subtitulo" aria-live="polite">
              {evento ? `${String(evento.t).replace('.', ',')} s · ${evento.texto}` : 'Pulsa Iniciar para reproducir la escena.'}
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
          {conOpenCV && <PanelOpenCV estado={visionCv.estado} error={visionCv.error} vision={visionCv.vision} nombres={nombresRegiones} />}
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
    opencv: 'OpenCV (píxeles): cajas magenta = objetos que OpenCV encontró analizando solo la imagen; se comparan con la geometría real en el panel lateral.',
    detecciones: 'Detecciones: caja cian y clase de cada figura, como la marcaría un detector (calculada con la geometría, no con imágenes).',
    trayectorias: 'Trayectorias: recorrido de los últimos 4 segundos de cada figura que se mueve.',
    figuras: 'Personas: casco amarillo, chaleco naranja con franjas; translúcida = poco visible. Productos: etiqueta blanca, defecto rojo. Montacargas: baliza intermitente al moverse.',
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
