// Pasos de YOLO que no dependen de ONNX Runtime (funciones puras, probadas en Node):
//   1. prepararEntrada: imagen RGBA → tensor RGB 0..1 (canales separados), con el
//      mismo relleno gris centrado que usa Ultralytics ("letterbox").
//   2. decodificar: salida del modelo [1, 4 + clases, N] → cajas con clase y confianza.
//   3. suprimirSolapadas (NMS): de varias cajas sobre el mismo objeto queda la mejor.
// Las cajas resultantes van normalizadas 0..1 respecto de la imagen original.
import { iou } from '../../analysis/geometria.js';
import { CLASES_YOLO } from './dataset.js';

export const ENTRADA_MODELO = { alto: 288, ancho: 480 };
export const UMBRAL_CONFIANZA = 0.4;
export const UMBRAL_SOLAPE = 0.5;
const GRIS = 114 / 255;

export function prepararEntrada(imagen, { alto, ancho } = ENTRADA_MODELO) {
  const escala = Math.min(alto / imagen.height, ancho / imagen.width);
  const w = Math.round(imagen.width * escala);
  const h = Math.round(imagen.height * escala);
  const padX = Math.floor((ancho - w) / 2);
  const padY = Math.floor((alto - h) / 2);
  const plano = alto * ancho;
  const datos = new Float32Array(3 * plano).fill(GRIS);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(imagen.height - 1, Math.floor(y / escala));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(imagen.width - 1, Math.floor(x / escala));
      const o = (sy * imagen.width + sx) * 4;
      const d = (y + padY) * ancho + (x + padX);
      datos[d] = imagen.data[o] / 255;
      datos[plano + d] = imagen.data[o + 1] / 255;
      datos[2 * plano + d] = imagen.data[o + 2] / 255;
    }
  }
  return { datos, dims: [1, 3, alto, ancho], escala, padX, padY, original: { ancho: imagen.width, alto: imagen.height } };
}

// La salida de YOLOv8 viene por filas: primero las 4 coordenadas (centro y tamaño en
// píxeles de la entrada) de las N propuestas, luego la puntuación de cada clase.
export function decodificar(salida, dims, entrada, umbral = UMBRAL_CONFIANZA) {
  const [, filas, n] = dims;
  const clases = filas - 4;
  const { escala, padX, padY, original } = entrada;
  const cajas = [];
  for (let j = 0; j < n; j++) {
    let mejor = 0;
    let clase = -1;
    for (let c = 0; c < clases; c++) {
      const p = salida[(4 + c) * n + j];
      if (p > mejor) {
        mejor = p;
        clase = c;
      }
    }
    if (mejor < umbral) continue;
    const cx = (salida[j] - padX) / escala;
    const cy = (salida[n + j] - padY) / escala;
    const w = salida[2 * n + j] / escala;
    const h = salida[3 * n + j] / escala;
    cajas.push({
      x: (cx - w / 2) / original.ancho,
      y: (cy - h / 2) / original.alto,
      w: w / original.ancho,
      h: h / original.alto,
      clase,
      nombre: CLASES_YOLO[clase] ?? `clase ${clase}`,
      confianza: mejor,
    });
  }
  return cajas;
}

// NMS por clase: se recorre de mayor a menor confianza y se descarta lo que se
// superpone demasiado con una caja ya aceptada de la misma clase.
export function suprimirSolapadas(cajas, umbral = UMBRAL_SOLAPE) {
  const ordenadas = [...cajas].sort((a, b) => b.confianza - a.confianza);
  const aceptadas = [];
  for (const c of ordenadas) {
    if (aceptadas.some((a) => a.clase === c.clase && iou(a, c) > umbral)) continue;
    aceptadas.push(c);
  }
  return aceptadas;
}

export function detectar(salida, dims, entrada, umbral = UMBRAL_CONFIANZA) {
  return suprimirSolapadas(decodificar(salida, dims, entrada, umbral));
}
