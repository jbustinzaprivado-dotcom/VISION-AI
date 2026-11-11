import { useCallback, useEffect, useRef, useState } from 'react';
import { cargarYolo } from './modelo.js';
import { cajasReales, CLASES_YOLO } from './dataset.js';
import { emparejar } from '../metricas.js';

// Une la cámara limpia con el detector YOLO: carga el modelo al activarse, detecta
// en cada captura y compara con la verdad geométrica del mismo cuadro (cajas y
// clases). Si el modelo todavía está ocupado, se guarda solo la captura más reciente
// y se procesa al terminar (así, en pausa, el panel siempre muestra el cuadro visible).
// Lleva el promedio de la sesión desde que se activó (se reinicia al cambiar de escena).
export function useVisionYolo({ activo, claveEscena, avisar }) {
  const [estado, setEstado] = useState('inactivo'); // inactivo | cargando | listo | error
  const [error, setError] = useState(null);
  const [vision, setVision] = useState(null);
  const detector = useRef(null);
  const ocupado = useRef(false);
  const pendiente = useRef(null);
  const acumulado = useRef(null);
  const escena = useRef(claveEscena);

  useEffect(() => {
    if (!activo || detector.current) {
      if (activo && detector.current) setEstado('listo');
      return undefined;
    }
    let vigente = true;
    setEstado('cargando');
    avisar?.({ tipo: 'info', titulo: 'Cargando YOLO', texto: 'Modelo y ONNX Runtime (unos 15 MB), solo la primera vez; luego quedan en caché.' });
    cargarYolo()
      .then((d) => {
        detector.current = d;
        if (vigente) setEstado('listo');
      })
      .catch((e) => {
        if (!vigente) return;
        setEstado('error');
        setError(e.message);
        avisar?.({ tipo: 'error', titulo: 'No se pudo cargar YOLO', texto: e.message });
      });
    return () => {
      vigente = false;
    };
  }, [activo, avisar]);

  useEffect(() => {
    escena.current = claveEscena;
    acumulado.current = null;
    setVision(null);
  }, [claveEscena]);

  const procesar = useCallback(async ({ frame, cuadro }) => {
    ocupado.current = true;
    const clave = escena.current;
    try {
      const { cajas, ms } = await detector.current.detectarEn(frame);
      if (clave !== escena.current) return; // llegó tarde: la escena ya cambió
      const reales = cajasReales(cuadro);
      const d = emparejar(cajas, reales, 0.5);
      const claseCorrecta = d.pares.filter((p) => cajas[p.i].clase === reales[p.j].clase).length;
      const porClase = CLASES_YOLO.map((nombre, c) => ({
        nombre,
        reales: reales.filter((r) => r.clase === c).length,
        detectadas: cajas.filter((x) => x.clase === c).length,
        aciertos: d.pares.filter((p) => reales[p.j].clase === c && cajas[p.i].clase === c).length,
      })).filter((f) => f.reales || f.detectadas);
      const aciertoClase = d.vp ? claseCorrecta / d.vp : 1;

      const a = acumulado.current ?? { cuadros: 0, precision: 0, recall: 0, iou: 0, clase: 0, ms: 0 };
      acumulado.current = {
        cuadros: a.cuadros + 1,
        precision: a.precision + d.precision,
        recall: a.recall + d.recall,
        iou: a.iou + d.iouMedio,
        clase: a.clase + aciertoClase,
        ms: a.ms + ms,
      };
      setVision({ cuadro: cuadro.indice, cajas, ms, deteccion: d, aciertoClase, porClase, reales: reales.length, promedio: { ...acumulado.current } });
    } catch (e) {
      setEstado('error');
      setError(e.message);
    } finally {
      ocupado.current = false;
      const siguiente = pendiente.current;
      pendiente.current = null;
      if (siguiente) procesar(siguiente);
    }
  }, []);

  const onCaptura = useCallback(
    (captura) => {
      if (!detector.current) return;
      if (ocupado.current) pendiente.current = captura;
      else procesar(captura);
    },
    [procesar],
  );

  return { estado, error, vision, onCaptura, listo: estado === 'listo' };
}
