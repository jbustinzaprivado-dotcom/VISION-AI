import { useEffect, useState } from 'react';
import { Download, Loader2, PackageOpen } from 'lucide-react';
import ExportadorDataset from '../vision/yolo/ExportadorDataset.jsx';
import { CLASES_YOLO, OPCIONES_DATASET } from '../vision/yolo/dataset.js';
import ResultadosYolo from './ResultadosYolo.jsx';
import { GENERADORES } from '../simulation/generadores.js';
import { CASOS } from '../simulation/casos.js';

// Entrenamiento REAL (DT-9): exportar escenas generadas como dataset de YOLO y ver
// los resultados del modelo que se entrenó con ellas y que usa la capa "YOLO".
const SESIONES = [4, 8, 12, 20];
const CUADROS = [10, 25, 40];

export default function SeccionYolo() {
  const [opciones, setOpciones] = useState({ sesiones: OPCIONES_DATASET.sesiones, cuadros: OPCIONES_DATASET.cuadros });
  const [exportando, setExportando] = useState(null); // { hecho, total } mientras se arma
  const [archivo, setArchivo] = useState(null); // { url, nombre, tamano, imagenes }
  // Sesiones de cada generador más una de cada caso fijo.
  const imagenes = (Object.keys(GENERADORES).length * opciones.sesiones + CASOS.length) * opciones.cuadros;

  useEffect(() => () => archivo && URL.revokeObjectURL(archivo.url), [archivo]);

  const listo = (blob, plan) => {
    setExportando(null);
    setArchivo({ url: URL.createObjectURL(blob), nombre: `vision-ai-dataset-yolo-${plan.opciones.semilla}.zip`, tamano: blob.size, imagenes: plan.cuadros.length });
    // En desarrollo, el servidor local guarda una copia para entrenar (entrenamiento/dataset.zip).
    if (import.meta.env.DEV) fetch('/__guardar-dataset', { method: 'POST', body: blob }).catch(() => {});
  };

  return (
    <section className="panel seccion-yolo" aria-labelledby="titulo-yolo">
      <h2 id="titulo-yolo">Entrenamiento real con YOLO</h2>
      <p>
        A diferencia de la animación de arriba, esto sí es un entrenamiento real: las escenas de los cuatro generadores se
        exportan como imágenes con sus etiquetas y se entrena un detector YOLO con ellas. La capa <strong>YOLO</strong> de
        Análisis visual usa ese modelo sobre la cámara simulada.
      </p>

      <h3>1. Exportar el dataset</h3>
      <p className="nota">
        Cada imagen sale de la cámara limpia (480 × 270) y sus etiquetas de la geometría exacta de la simulación. Clases:{' '}
        {CLASES_YOLO.join(', ')}. La validación usa sesiones que no están en el entrenamiento.
      </p>
      <div className="generador">
        <label>
          Sesiones por generador
          <select value={opciones.sesiones} disabled={Boolean(exportando)} onChange={(e) => setOpciones({ ...opciones, sesiones: Number(e.target.value) })}>
            {SESIONES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>
          Cuadros por sesión
          <select value={opciones.cuadros} disabled={Boolean(exportando)} onChange={(e) => setOpciones({ ...opciones, cuadros: Number(e.target.value) })}>
            {CUADROS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" disabled={Boolean(exportando)} onClick={() => { setArchivo(null); setExportando({ hecho: 0, total: imagenes }); }}>
          {exportando ? <Loader2 className="icono girando" aria-hidden="true" /> : <PackageOpen className="icono" aria-hidden="true" />}
          {exportando ? `Dibujando ${exportando.hecho} de ${exportando.total}…` : `Generar dataset (${imagenes} imágenes)`}
        </button>
      </div>
      {exportando && (
        <ExportadorDataset opciones={opciones} onProgreso={(hecho, total) => setExportando({ hecho, total })} onListo={listo} />
      )}
      {archivo && (
        <p>
          <a className="enlace-boton" href={archivo.url} download={archivo.nombre}>
            <Download className="icono" aria-hidden="true" /> Descargar {archivo.nombre}
          </a>{' '}
          <span className="nota">{archivo.imagenes} imágenes · {(archivo.tamano / 1048576).toFixed(1).replace('.', ',')} MB</span>
        </p>
      )}

      <h3>2. Entrenar</h3>
      <p className="nota">
        Sube el .zip a Google Colab o Kaggle y ejecuta <code>entrenamiento/entrenar_yolo.ipynb</code> (o{' '}
        <code>entrenar_yolo.py</code> en una computadora con Python). Al final exporta <code>modelo.onnx</code> y{' '}
        <code>resultados.json</code>, que se copian a <code>src/vision/yolo/modelo/</code>.
      </p>

      <h3>3. Resultados del modelo publicado</h3>
      <ResultadosYolo />
    </section>
  );
}
