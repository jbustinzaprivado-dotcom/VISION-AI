import { useCallback, useEffect, useRef, useState } from 'react';
import { cargarOpenCV } from './opencv.js';
import { analizarPixeles } from './pixeles.js';
import { compararOcupacion, emparejar } from './metricas.js';
import { cajaDe } from '../analysis/geometria.js';

// Une la cámara limpia con OpenCV: carga OpenCV al activarse, analiza cada captura
// y la compara con la verdad geométrica del mismo cuadro. Lleva además el promedio
// de la sesión desde que se activó (se reinicia al cambiar de escena).
export function useVisionPixeles({ activo, claveEscena, resultadoGeometrico, avisar }) {
  const [estado, setEstado] = useState('inactivo'); // inactivo | cargando | listo | error
  const [error, setError] = useState(null);
  const [vision, setVision] = useState(null);
  const cv = useRef(null);
  const acumulado = useRef(null);
  const geometrico = useRef(resultadoGeometrico);
  geometrico.current = resultadoGeometrico;

  useEffect(() => {
    if (!activo || cv.current) {
      if (activo && cv.current) setEstado('listo');
      return;
    }
    let vigente = true;
    setEstado('cargando');
    avisar?.({ tipo: 'info', titulo: 'Cargando OpenCV', texto: 'Unos 4 MB, solo la primera vez; luego queda en caché.' });
    cargarOpenCV()
      .then(({ cv: listo }) => {
        cv.current = listo;
        if (vigente) setEstado('listo');
      })
      .catch((e) => {
        if (!vigente) return;
        setEstado('error');
        setError(e.message);
        avisar?.({ tipo: 'error', titulo: 'No se pudo cargar OpenCV', texto: e.message });
      });
    return () => {
      vigente = false;
    };
  }, [activo, avisar]);

  // Al cambiar de escena se reinicia el promedio.
  useEffect(() => {
    acumulado.current = null;
    setVision(null);
  }, [claveEscena]);

  const onCaptura = useCallback(({ frame, fondo, cuadro }) => {
    const geo = geometrico.current;
    if (!cv.current || !geo || geo.cuadro !== cuadro.indice) return;
    const regiones = cuadro.regiones.filter((r) => r.clase !== 'suelo');
    const pixeles = analizarPixeles(cv.current, { frame, fondo, regiones });
    const reales = cuadro.objetos.map((o) => cajaDe(o));
    const deteccion = emparejar(pixeles.cajas, reales);
    const ocupacion = compararOcupacion(pixeles.ocupacion, geo.mediciones);

    const a = acumulado.current ?? { cuadros: 0, iou: 0, precision: 0, recall: 0, error: 0, ms: 0 };
    acumulado.current = {
      cuadros: a.cuadros + 1,
      iou: a.iou + deteccion.iouMedio,
      precision: a.precision + deteccion.precision,
      recall: a.recall + deteccion.recall,
      error: a.error + ocupacion.errorMedio,
      ms: a.ms + pixeles.ms,
    };
    setVision({ cuadro: cuadro.indice, pixeles, deteccion, ocupacion, reales: reales.length, promedio: { ...acumulado.current } });
  }, []);

  return { estado, error, vision, onCaptura, listo: estado === 'listo' };
}
