// Fase 5: datos del entrenamiento ilustrativo y capas del visor.
import { describe, expect, it } from 'vitest';
import { EPOCAS, ETAPAS, curvas, ejemplos, matrizConfusion, puntuaciones, validacion } from '../training/entrenamiento.js';
import { iou } from '../analysis/geometria.js';
import { CASOS, casoPorId } from '../simulation/casos.js';

describe('entrenamiento ilustrativo', () => {
  it('tiene las seis etapas del documento', () => {
    expect(ETAPAS).toHaveLength(6);
    expect(ETAPAS.at(-1).titulo).toContain('Modelo de prototipo listo');
  });

  it.each(CASOS.map((c) => [c.caso]))('%s: curvas fijas, el error baja y la precisión sube', (caso) => {
    const c = curvas(caso);
    expect(c).toHaveLength(EPOCAS);
    expect(curvas(caso)).toEqual(c); // siempre las mismas
    expect(c.at(-1).error).toBeLessThan(c[0].error);
    expect(c.at(-1).precision).toBeGreaterThan(c[0].precision);
    for (const p of c) {
      expect(p.precision).toBeGreaterThanOrEqual(0);
      expect(p.precision).toBeLessThanOrEqual(1);
      expect(p.error).toBeGreaterThanOrEqual(0);
    }
  });

  it('los ejemplos etiquetados salen del guion del caso', () => {
    const e = ejemplos(casoPorId('CU-04'));
    expect(e).toHaveLength(4);
    expect(e.some((x) => x.objetos.length > 0)).toBe(true);
  });

  it('IoU: 1 para cajas iguales, 0 sin solape, 1/3 para medio solape', () => {
    const a = { x: 0, y: 0, w: 0.2, h: 0.2 };
    expect(iou(a, a)).toBe(1);
    expect(iou(a, { x: 0.5, y: 0.5, w: 0.1, h: 0.1 })).toBe(0);
    expect(iou(a, { x: 0.1, y: 0, w: 0.2, h: 0.2 })).toBeCloseTo(1 / 3, 6);
  });

  it('validación: IoU entre 0 y 1, reproducible con la misma semilla', () => {
    const v = validacion(casoPorId('CU-02'));
    expect(v.pares.length).toBeGreaterThan(0);
    for (const p of v.pares) {
      expect(p.iou).toBeGreaterThan(0);
      expect(p.iou).toBeLessThanOrEqual(1);
    }
    expect(validacion(casoPorId('CU-02'))).toEqual(v);
  });

  it('matriz de confusión: suma todas las muestras y el umbral equilibra precisión y recall', () => {
    const muestras = puntuaciones('CU-02');
    expect(muestras).toHaveLength(120);
    const bajo = matrizConfusion(muestras, 0.2);
    const alto = matrizConfusion(muestras, 0.8);
    for (const m of [bajo, alto]) expect(m.vp + m.fp + m.fn + m.vn).toBe(120);
    expect(alto.precision).toBeGreaterThanOrEqual(bajo.precision);
    expect(alto.recall).toBeLessThanOrEqual(bajo.recall);
  });

  it('casos límite: umbral muy alto sin predicciones no divide entre cero', () => {
    const m = matrizConfusion([{ real: true, puntuacion: 0.3 }], 0.9);
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(0);
  });
});
