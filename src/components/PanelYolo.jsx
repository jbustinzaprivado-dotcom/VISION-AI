import { Loader2, ScanSearch } from 'lucide-react';

// Panel de la capa YOLO: qué detectó el modelo entrenado con escenas generadas en el
// cuadro actual, comparado con la verdad de la simulación (cajas y clases).
const pct = (v) => `${Math.round(v * 100)} %`;
const dec = (v) => v.toFixed(2).replace('.', ',');

export default function PanelYolo({ estado, error, vision }) {
  return (
    <section className="panel-yolo" aria-label="Detector YOLO">
      <h2>
        <ScanSearch className="icono" aria-hidden="true" /> Detector YOLO
      </h2>
      {estado === 'cargando' && (
        <p className="nota">
          <Loader2 className="icono girando" aria-hidden="true" /> Cargando el modelo (unos 15 MB, solo la primera vez)…
        </p>
      )}
      {estado === 'error' && <p className="error">{error}</p>}
      {estado === 'listo' && !vision && <p className="nota">Inicia o mueve la escena para detectar objetos.</p>}
      {estado === 'listo' && vision && <Contenido vision={vision} />}
      <p className="nota">
        Red neuronal YOLOv8n entrenada con imágenes de los cuatro generadores. Solo ve la imagen de la cámara; se compara
        con la geometría real (acierto: misma clase e IoU ≥ 0,5). Las alertas siguen saliendo de la geometría.
      </p>
    </section>
  );
}

function Contenido({ vision }) {
  const { deteccion: d, promedio: m } = vision;
  return (
    <>
      <div className="metricas-cv">
        <Metrica titulo="Objetos" valor={`${vision.cajas.length} / ${vision.reales}`} detalle="detectados / reales" />
        <Metrica titulo="Precisión" valor={pct(d.precision)} detalle={`${d.fp} falsos positivos`} />
        <Metrica titulo="Recall" valor={pct(d.recall)} detalle={`${d.fn} sin detectar`} />
        <Metrica titulo="Clase correcta" valor={pct(vision.aciertoClase)} detalle={`IoU medio ${dec(d.iouMedio)}`} />
      </div>
      <p className="nota">
        Cuadro {vision.cuadro} · inferencia en {Math.round(vision.ms)} ms.
        <br />
        Promedio de {m.cuadros} {m.cuadros === 1 ? 'cuadro' : 'cuadros'}: precisión {pct(m.precision / m.cuadros)}, recall{' '}
        {pct(m.recall / m.cuadros)}, clase correcta {pct(m.clase / m.cuadros)}, {Math.round(m.ms / m.cuadros)} ms.
      </p>
      <table className="tabla-cv">
        <thead>
          <tr>
            <th scope="col">Clase</th>
            <th scope="col">Reales</th>
            <th scope="col">YOLO</th>
            <th scope="col">Aciertos</th>
          </tr>
        </thead>
        <tbody>
          {vision.porClase.map((f) => (
            <tr key={f.nombre}>
              <th scope="row">{f.nombre}</th>
              <td>{f.reales}</td>
              <td>{f.detectadas}</td>
              <td className={f.aciertos < f.reales || f.detectadas > f.aciertos ? 'cambio' : ''}>{f.aciertos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Metrica({ titulo, valor, detalle }) {
  return (
    <div className="metrica-cv">
      <span className="kpi-titulo">{titulo}</span>
      <strong>{valor}</strong>
      <span className="kpi-detalle">{detalle}</span>
    </div>
  );
}
