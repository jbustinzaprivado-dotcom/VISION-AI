// YOLO (DT-9): dataset exportado (plan y etiquetas) y pasos puros de la inferencia.
import { describe, expect, it } from 'vitest';
import { CLASES_YOLO, cajasReales, cuadroDelPlan, dataYaml, etiquetasYolo, leeme, planDataset } from '../vision/yolo/dataset.js';
import { ENTRADA_MODELO, decodificar, detectar, prepararEntrada, suprimirSolapadas } from '../vision/yolo/inferencia.js';
import { GENERADORES } from '../simulation/generadores.js';
import { CASOS } from '../simulation/casos.js';

const plan = planDataset({ sesiones: 5, cuadros: 6 });

describe('plan del dataset', () => {
  it('incluye sesiones de cada generador y de los casos fijos, con la cantidad pedida de cuadros', () => {
    const fuentes = new Set(plan.sesiones.map((s) => s.fuente));
    for (const id of Object.keys(GENERADORES)) expect(fuentes.has(id)).toBe(true);
    for (const c of CASOS) expect(fuentes.has(c.caso)).toBe(true);
    expect(plan.sesiones).toHaveLength(Object.keys(GENERADORES).length * 5 + CASOS.length);
    expect(plan.cuadros).toHaveLength(plan.sesiones.length * 6);
  });

  it('la validación usa sesiones completas que no están en el entrenamiento', () => {
    const val = plan.sesiones.filter((s) => s.particion === 'val');
    for (const id of Object.keys(GENERADORES)) expect(val.filter((s) => s.fuente === id).length).toBeGreaterThanOrEqual(1);
    const claves = (p) => new Set(plan.sesiones.filter((s) => s.particion === p).map((s) => `${s.fuente}-${s.semilla}`));
    const entrenamiento = claves('train');
    for (const k of claves('val')) expect(entrenamiento.has(k)).toBe(false);
    for (const c of plan.cuadros) expect(c.particion).toBe(c.sesion.particion);
  });

  it('es repetible y los nombres de archivo no se repiten', () => {
    const otro = planDataset({ sesiones: 5, cuadros: 6 });
    expect(otro.cuadros.map((c) => c.nombre)).toEqual(plan.cuadros.map((c) => c.nombre));
    expect(new Set(plan.cuadros.map((c) => c.nombre)).size).toBe(plan.cuadros.length);
    expect(planDataset({ sesiones: 5, cuadros: 6, semilla: 8 }).cuadros.map((c) => c.nombre)).not.toEqual(plan.cuadros.map((c) => c.nombre));
  });

  it('data.yaml y LEEME describen las 7 clases y las particiones', () => {
    const yaml = dataYaml();
    CLASES_YOLO.forEach((c, i) => expect(yaml).toContain(`  ${i}: ${c}`));
    expect(yaml).toContain('train: images/train');
    expect(leeme(plan)).toContain(`Imágenes: ${plan.cuadros.length}`);
  });
});

describe('etiquetas YOLO', () => {
  it('una línea por objeto visible, con clase válida y coordenadas dentro de la imagen', () => {
    let lineas = 0;
    for (const entrada of plan.cuadros.slice(0, 80)) {
      const texto = etiquetasYolo(cuadroDelPlan(entrada));
      for (const l of texto.split('\n').filter(Boolean)) {
        const [c, xc, yc, w, h] = l.split(' ').map(Number);
        expect(Number.isInteger(c) && c >= 0 && c < CLASES_YOLO.length).toBe(true);
        for (const v of [xc, yc, w, h]) expect(v).toBeGreaterThanOrEqual(0);
        expect(xc - w / 2).toBeGreaterThanOrEqual(-1e-6);
        expect(xc + w / 2).toBeLessThanOrEqual(1 + 1e-6);
        expect(yc + h / 2).toBeLessThanOrEqual(1 + 1e-6);
        lineas++;
      }
    }
    expect(lineas).toBeGreaterThan(80);
  });

  it('recorta lo que sale por el borde y no etiqueta lo que casi no se ve', () => {
    const objeto = (x, w = 0.1) => ({ id: 'p', clase: 'persona', x, y: 0.5, w, h: 0.1 });
    const [mitad] = cajasReales({ objetos: [objeto(0.02)] }); // 70 % visible
    expect(mitad.x).toBe(0);
    expect(mitad.w).toBeCloseTo(0.07);
    expect(cajasReales({ objetos: [objeto(-0.03)] })).toEqual([]); // 20 % visible
    expect(cajasReales({ objetos: [{ ...objeto(0.5), clase: 'desconocida' }] })).toEqual([]);
  });
});

// Imagen sintética RGBA: fondo negro con un rectángulo de color.
function imagen(ancho, alto, rect, color = [255, 128, 0]) {
  const data = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++) {
      const o = (y * ancho + x) * 4;
      const dentro = x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      data.set(dentro ? [...color, 255] : [0, 0, 0, 255], o);
    }
  return { data, width: ancho, height: alto };
}

describe('inferencia: preparar la entrada', () => {
  it('480 × 270 entra sin escalar, centrada con relleno gris arriba y abajo (288 de alto)', () => {
    const e = prepararEntrada(imagen(480, 270, { x: 10, y: 0, w: 1, h: 1 }));
    expect(e.dims).toEqual([1, 3, ENTRADA_MODELO.alto, ENTRADA_MODELO.ancho]);
    expect(e.escala).toBe(1);
    expect(e.padX).toBe(0);
    expect(e.padY).toBe(9);
    const plano = 288 * 480;
    expect(e.datos[0]).toBeCloseTo(114 / 255); // relleno
    expect(e.datos[9 * 480 + 10]).toBeCloseTo(1); // rojo del píxel (10, 0)
    expect(e.datos[plano + 9 * 480 + 10]).toBeCloseTo(128 / 255); // verde
    expect(e.datos[2 * plano + 9 * 480 + 10]).toBe(0); // azul
  });

  it('una imagen más grande se reduce manteniendo la proporción', () => {
    const e = prepararEntrada(imagen(960, 540, { x: 0, y: 0, w: 2, h: 2 }));
    expect(e.escala).toBe(0.5);
    expect(e.padY).toBe(9);
  });
});

describe('inferencia: decodificar y NMS', () => {
  // Salida falsa con el formato de YOLOv8: [1, 4 + clases, N].
  function salida(propuestas) {
    const filas = 4 + CLASES_YOLO.length;
    const n = propuestas.length;
    const datos = new Float32Array(filas * n);
    propuestas.forEach((p, j) => {
      [p.cx, p.cy, p.w, p.h].forEach((v, f) => (datos[f * n + j] = v));
      datos[(4 + p.clase) * n + j] = p.conf;
    });
    return { datos, dims: [1, filas, n] };
  }
  const entrada = { escala: 1, padX: 0, padY: 9, original: { ancho: 480, alto: 270 } };

  it('pasa de píxeles de la entrada a coordenadas 0..1 de la cámara, descontando el relleno', () => {
    const { datos, dims } = salida([{ cx: 240, cy: 144, w: 48, h: 27, clase: 0, conf: 0.9 }]);
    const [c] = decodificar(datos, dims, entrada);
    expect(c.nombre).toBe('persona');
    expect(c.x).toBeCloseTo(0.45);
    expect(c.y).toBeCloseTo((144 - 9 - 13.5) / 270);
    expect(c.w).toBeCloseTo(0.1);
    expect(c.h).toBeCloseTo(0.1);
  });

  it('descarta lo que no llega al umbral y une cajas repetidas de la misma clase', () => {
    const { datos, dims } = salida([
      { cx: 100, cy: 100, w: 40, h: 40, clase: 3, conf: 0.8 },
      { cx: 102, cy: 101, w: 40, h: 40, clase: 3, conf: 0.7 }, // misma caja, menos confianza
      { cx: 102, cy: 101, w: 40, h: 40, clase: 4, conf: 0.6 }, // otra clase: se mantiene
      { cx: 300, cy: 100, w: 40, h: 40, clase: 3, conf: 0.2 }, // bajo el umbral
    ]);
    const cajas = detectar(datos, dims, entrada);
    expect(cajas.map((c) => [c.nombre, c.confianza.toFixed(1)])).toEqual([['pallet', '0.8'], ['caja', '0.6']]);
    expect(suprimirSolapadas([])).toEqual([]);
  });
});
