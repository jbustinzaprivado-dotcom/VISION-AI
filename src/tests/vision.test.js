// Visión por píxeles con OpenCV.js (se ejecuta el OpenCV real, en WebAssembly).
// Se usan imágenes sintéticas con objetos de posición conocida para comprobar
// que la sustracción de fondo, la ocupación y los contornos son correctos.
import { beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { prepararCv } from '../vision/opencv.js';
import { analizarPixeles } from '../vision/pixeles.js';
import { compararOcupacion, emparejar } from '../vision/metricas.js';

const W = 200;
const H = 100;
let cv;

// Imagen RGBA de un color, con rectángulos de otro color (coordenadas en píxeles).
function imagen(fondo, rectangulos = [], color = [230, 180, 60]) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) data.set([...fondo, 255], i * 4);
  for (const r of rectangulos) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) data.set([...color, 255], (y * W + x) * 4);
  }
  return { data, width: W, height: H };
}
const norm = (r) => ({ x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H });

// En las pruebas (Node) OpenCV se carga directo; en el navegador, con carga diferida.
beforeAll(async () => {
  const requerir = createRequire(import.meta.url);
  ({ cv } = await prepararCv(requerir('@techstark/opencv-js')));
}, 30000);

describe('análisis por píxeles (OpenCV)', () => {
  const objetos = [
    { x: 20, y: 20, w: 30, h: 20 },
    { x: 120, y: 50, w: 40, h: 30 },
  ];
  const fondo = imagen([40, 50, 60]);
  const frame = imagen([40, 50, 60], objetos);

  it('sin cambios respecto del fondo no detecta nada', () => {
    const r = analizarPixeles(cv, { frame: fondo, fondo, regiones: [] });
    expect(r.cajas).toEqual([]);
    expect(r.pixelesPrimerPlano).toBe(0);
  });

  it('encuentra cada objeto como un contorno con su caja', () => {
    const r = analizarPixeles(cv, { frame, fondo });
    expect(r.cajas).toHaveLength(2);
    const m = emparejar(r.cajas, objetos.map(norm), 0.5);
    expect(m.vp).toBe(2);
    expect(m.iouMedio).toBeGreaterThan(0.95);
  });

  it('calcula la ocupación de cada región a partir de los píxeles', () => {
    const regiones = [
      { id: 'a', ...norm({ x: 0, y: 0, w: 100, h: 100 }) }, // contiene el primer objeto: 600 / 10 000 px
      { id: 'b', ...norm({ x: 100, y: 0, w: 100, h: 100 }) }, // contiene el segundo: 1200 / 10 000 px
    ];
    const r = analizarPixeles(cv, { frame, fondo, regiones });
    expect(r.ocupacion.a).toBeCloseTo(0.06, 2);
    expect(r.ocupacion.b).toBeCloseTo(0.12, 2);
  });

  it('ignora manchas más chicas que el área mínima (ruido)', () => {
    const conRuido = imagen([40, 50, 60], [...objetos, { x: 90, y: 5, w: 2, h: 2 }]);
    expect(analizarPixeles(cv, { frame: conRuido, fondo }).cajas).toHaveLength(2);
  });

  it('un cambio de color leve (bajo el umbral) no cuenta como objeto', () => {
    const casiIgual = imagen([40, 50, 60], objetos, [48, 58, 68]);
    expect(analizarPixeles(cv, { frame: casiIgual, fondo }).cajas).toEqual([]);
  });
});

describe('métricas de comparación', () => {
  it('empareja detecciones con objetos reales y calcula precisión y recall', () => {
    const reales = [{ x: 0, y: 0, w: 0.2, h: 0.2 }, { x: 0.5, y: 0.5, w: 0.2, h: 0.2 }];
    const detectadas = [{ x: 0.01, y: 0, w: 0.2, h: 0.2 }, { x: 0.8, y: 0.1, w: 0.1, h: 0.1 }];
    const m = emparejar(detectadas, reales);
    expect(m).toMatchObject({ vp: 1, fp: 1, fn: 1, precision: 0.5, recall: 0.5 });
  });

  it('sin detecciones ni objetos no divide entre cero', () => {
    expect(emparejar([], [])).toMatchObject({ precision: 1, recall: 1, iouMedio: 0 });
  });

  it('compara ocupación estimada y real, con error medio absoluto', () => {
    const c = compararOcupacion({ a: 0.3, b: 0.1 }, [
      { region: 'a', ocupacion: 0.25 },
      { region: 'b', ocupacion: 0.2 },
      { region: 'c', ocupacion: 0.5 }, // sin estimación: no se compara
    ]);
    expect(c.filas).toHaveLength(2);
    expect(c.errorMedio).toBeCloseTo(0.075, 6);
  });
});
