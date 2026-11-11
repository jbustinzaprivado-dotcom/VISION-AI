import { useEffect, useRef } from 'react';
import { Layer, Rect, Stage } from 'react-konva';
import { RegionDibujo } from '../components/escena/Regiones.jsx';
import { FiguraDibujo } from '../components/escena/Figuras.jsx';

// Cámara "limpia" para OpenCV: un lienzo oculto que dibuja solo lo que vería una
// cámara real (suelo, zonas y objetos), sin marcos de alerta, etiquetas ni la
// interfaz de la cámara. En cada cuadro entrega dos imágenes:
//   frame → la escena completa
//   fondo → el lugar vacío en el mismo instante (solo suelo y zonas)
// La resolución es fija y reducida (480 × 270): suficiente para el análisis y rápida.
export const ANCHO_CAPTURA = 480;
export const ALTO_CAPTURA = 270;

export default function CapturaCamara({ cuadro, onCaptura }) {
  const escenario = useRef(null);
  const capaFondo = useRef(null);
  useEffect(() => {
    const stage = escenario.current;
    if (!stage) return;
    const leer = (lienzo) => lienzo.getContext('2d').getImageData(0, 0, ANCHO_CAPTURA, ALTO_CAPTURA);
    const fondo = leer(capaFondo.current.toCanvas({ pixelRatio: 1 }));
    const frame = leer(stage.toCanvas({ pixelRatio: 1 }));
    onCaptura({ frame, fondo, cuadro });
    // Solo se captura cuando cambia el cuadro analizado (12 por segundo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuadro]);

  return (
    <div aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', visibility: 'hidden' }}>
      <Stage ref={escenario} width={ANCHO_CAPTURA} height={ALTO_CAPTURA} listening={false}>
        <CapasLimpias cuadro={cuadro} refFondo={capaFondo} />
      </Stage>
    </div>
  );
}

// Lo que ve la cámara limpia: suelo y zonas (capa de fondo) y los objetos encima.
// También la usa el exportador del dataset de YOLO, así entrena con las mismas imágenes.
export function CapasLimpias({ cuadro, refFondo }) {
  const px = (v) => v * ANCHO_CAPTURA;
  const py = (v) => v * ALTO_CAPTURA;
  const regiones = cuadro.regiones.filter((r) => r.clase !== 'suelo');
  return (
    <>
      <Layer ref={refFondo}>
        <Rect width={ANCHO_CAPTURA} height={ALTO_CAPTURA} fill="#1b2332" />
        {regiones.map((r) => (
          <RegionDibujo key={r.id} region={r} px={px} py={py} t={cuadro.t} />
        ))}
      </Layer>
      <Layer>
        {cuadro.objetos.map((o) => (
          <FiguraDibujo key={o.id} figura={o} px={px} py={py} t={cuadro.t} />
        ))}
      </Layer>
    </>
  );
}
