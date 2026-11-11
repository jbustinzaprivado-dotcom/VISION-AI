import { useEffect, useRef, useState } from 'react';
import { Stage } from 'react-konva';
import { ALTO_CAPTURA, ANCHO_CAPTURA, CapasLimpias } from '../CapturaCamara.jsx';
import { cuadroDelPlan, dataYaml, etiquetasYolo, leeme, planDataset } from './dataset.js';

// Dibuja, uno por uno, los cuadros del plan con la cámara limpia (oculta) y arma un
// .zip listo para Ultralytics: images/, labels/, data.yaml y LEEME.txt.
// Al terminar entrega el archivo con onListo(blob, plan).
export default function ExportadorDataset({ opciones, onProgreso, onListo }) {
  const [plan] = useState(() => planDataset(opciones));
  const [paso, setPaso] = useState(0);
  const escenario = useRef(null);
  const archivos = useRef({});
  const entrada = plan.cuadros[paso];
  const cuadro = entrada ? cuadroDelPlan(entrada) : null;

  useEffect(() => {
    let vigente = true;
    const stage = escenario.current;
    if (!entrada || !stage) return undefined;
    stage.toCanvas({ pixelRatio: 1 }).toBlob(
      async (jpg) => {
        if (!vigente) return;
        const datos = new Uint8Array(await jpg.arrayBuffer());
        const { nombre, particion } = entrada;
        archivos.current[`images/${particion}/${nombre}.jpg`] = datos;
        archivos.current[`labels/${particion}/${nombre}.txt`] = new TextEncoder().encode(etiquetasYolo(cuadro));
        onProgreso?.(paso + 1, plan.cuadros.length);
        if (paso + 1 < plan.cuadros.length) setPaso(paso + 1);
        else onListo?.(await empaquetar(archivos.current, plan), plan);
      },
      'image/jpeg',
      0.92,
    );
    return () => {
      vigente = false;
    };
    // Avanza cuadro por cuadro: solo depende del paso actual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  if (!cuadro) return null;
  return (
    <div aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', visibility: 'hidden' }}>
      <Stage ref={escenario} width={ANCHO_CAPTURA} height={ALTO_CAPTURA} listening={false}>
        <CapasLimpias cuadro={cuadro} />
      </Stage>
    </div>
  );
}

// El compresor se carga solo al exportar. Las imágenes JPG ya vienen comprimidas.
async function empaquetar(archivos, plan) {
  const { zipSync, strToU8 } = await import('fflate');
  const todo = { ...archivos, 'data.yaml': strToU8(dataYaml()), 'LEEME.txt': strToU8(leeme(plan)) };
  const entradas = Object.fromEntries(Object.entries(todo).map(([ruta, datos]) => [ruta, [datos, { level: ruta.endsWith('.jpg') ? 0 : 6 }]]));
  return new Blob([zipSync(entradas)], { type: 'application/zip' });
}
