// Métricas para comparar lo que estimó OpenCV (píxeles) con la verdad de la
// simulación (geometría). Funciones puras: no dependen de OpenCV.
import { iou } from '../analysis/geometria.js';

// Empareja cajas detectadas con cajas reales (de mayor a menor IoU, una con una).
// Un par cuenta como acierto si su IoU alcanza el umbral.
export function emparejar(detectadas, reales, umbralIoU = 0.3) {
  const candidatos = [];
  detectadas.forEach((d, i) => reales.forEach((r, j) => candidatos.push({ i, j, iou: iou(d, r) })));
  candidatos.sort((a, b) => b.iou - a.iou);
  const usadasD = new Set();
  const usadasR = new Set();
  const pares = [];
  for (const c of candidatos) {
    if (c.iou < umbralIoU) break;
    if (usadasD.has(c.i) || usadasR.has(c.j)) continue;
    usadasD.add(c.i);
    usadasR.add(c.j);
    pares.push(c);
  }
  const vp = pares.length;
  const fp = detectadas.length - vp;
  const fn = reales.length - vp;
  return {
    pares,
    vp,
    fp,
    fn,
    precision: detectadas.length ? vp / detectadas.length : 1,
    recall: reales.length ? vp / reales.length : 1,
    iouMedio: vp ? pares.reduce((s, p) => s + p.iou, 0) / vp : 0,
  };
}

// Compara la ocupación estimada por píxeles con la medida geométrica de cada región.
export function compararOcupacion(estimada, mediciones) {
  const filas = mediciones
    .filter((m) => estimada[m.region] != null)
    .map((m) => ({ region: m.region, real: m.ocupacion, estimada: estimada[m.region], error: estimada[m.region] - m.ocupacion }));
  const errorMedio = filas.length ? filas.reduce((s, f) => s + Math.abs(f.error), 0) / filas.length : 0;
  return { filas, errorMedio };
}
