// Entrenamiento ILUSTRATIVO (Proyecto, sección 5.2): no es un entrenamiento real.
// Genera, con fórmulas fijas y una semilla, los datos que la animación muestra
// en seis etapas. La misma entrada produce siempre los mismos datos.
import seedrandom from 'seedrandom';
import { escenaEn } from '../simulation/trayectoria.js';
import { cajaDe, iou } from '../analysis/geometria.js';

export const ETAPAS = [
  { id: 'ejemplos', titulo: '1. Ejemplos etiquetados' },
  { id: 'preparacion', titulo: '2. Preparación de datos' },
  { id: 'entrenamiento', titulo: '3. Entrenamiento' },
  { id: 'validacion', titulo: '4. Validación' },
  { id: 'umbral', titulo: '5. Ajuste del umbral' },
  { id: 'listo', titulo: '6. Modelo de prototipo listo' },
];

export const EPOCAS = 30;
const limitar = (v) => Math.max(0, Math.min(1, v));
const redondear = (v) => Math.round(v * 1000) / 1000;
// Cada caso tiene curvas un poco distintas.
const AJUSTE = { 'CU-01': 0, 'CU-02': 1, 'CU-03': 2, 'CU-04': 3 };

// Curvas de error (baja) y precisión (sube) época a época.
export function curvas(caso) {
  const k = AJUSTE[caso] ?? 0;
  const puntos = [];
  for (let e = 1; e <= EPOCAS; e++) {
    const error = 0.12 + 0.03 * k + 1.1 * Math.exp(-e / (5 + k)) + 0.02 * Math.sin(e * 1.7);
    const precision = 0.93 - 0.02 * k - 0.6 * Math.exp(-e / (4 + k)) + 0.01 * Math.sin(e * 2.3);
    puntos.push({ epoca: e, error: redondear(Math.max(0, error)), precision: redondear(limitar(precision)) });
  }
  return puntos;
}

// Cuatro escenas del guion en distintos momentos, con sus etiquetas (la "verdad").
export function ejemplos(guion) {
  return [0.15, 0.35, 0.55, 0.75].map((f) => escenaEn(guion, Math.round(guion.duracion * f)));
}

// Validación: cajas reales frente a cajas "predichas" (las reales con un desvío
// controlado por la semilla) y su IoU.
export function validacion(guion, semilla = 2026) {
  const escena = escenaEn(guion, momentoConMasFiguras(guion));
  const azar = seedrandom(`validacion|${guion.caso}|${semilla}`);
  return {
    escena,
    pares: escena.objetos.map((o) => {
      const real = cajaDe(o);
      const prediccion = {
        x: real.x + (azar() - 0.5) * real.w * 0.4,
        y: real.y + (azar() - 0.5) * real.h * 0.4,
        w: real.w * (0.85 + azar() * 0.3),
        h: real.h * (0.85 + azar() * 0.3),
      };
      return { id: o.id, clase: o.clase, real, prediccion, iou: redondear(iou(real, prediccion)) };
    }),
  };
}

function momentoConMasFiguras(guion) {
  let mejor = 0;
  let maximo = -1;
  for (let t = 0; t <= guion.duracion; t += 1) {
    const n = escenaEn(guion, t).objetos.length;
    if (n > maximo) {
      maximo = n;
      mejor = t;
    }
  }
  return mejor;
}

// Puntuaciones de confianza de 120 muestras de validación (50 positivas, 70 negativas).
export function puntuaciones(caso, semilla = 2026) {
  const azar = seedrandom(`umbral|${caso}|${semilla}`);
  const muestras = [];
  for (let i = 0; i < 50; i++) muestras.push({ real: true, puntuacion: redondear(limitar(0.45 + azar() * 0.55)) });
  for (let i = 0; i < 70; i++) muestras.push({ real: false, puntuacion: redondear(limitar(azar() * 0.65)) });
  return muestras;
}

// Matriz de confusión con un umbral: desde el umbral, la muestra se predice positiva.
export function matrizConfusion(muestras, umbral) {
  let vp = 0;
  let fp = 0;
  let fn = 0;
  let vn = 0;
  for (const m of muestras) {
    const predicha = m.puntuacion >= umbral;
    if (predicha && m.real) vp++;
    else if (predicha && !m.real) fp++;
    else if (!predicha && m.real) fn++;
    else vn++;
  }
  return {
    vp, fp, fn, vn,
    precision: vp + fp > 0 ? redondear(vp / (vp + fp)) : 1,
    recall: vp + fn > 0 ? redondear(vp / (vp + fn)) : 0,
  };
}
