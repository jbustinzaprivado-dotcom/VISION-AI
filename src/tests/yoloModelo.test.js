// Prueba de punta a punta del modelo YOLO publicado (DT-9): imágenes reales de la
// validación (escenas que el modelo no vio al entrenar) pasan por los mismos pasos que
// en el navegador (prepararEntrada → ONNX Runtime → detectar) y se comparan con sus
// etiquetas. Confirma que la preparación y la decodificación en JavaScript coinciden
// con lo que aprendió el modelo en Python.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as ort from 'onnxruntime-web';
import { ENTRADA_MODELO, detectar, prepararEntrada } from '../vision/yolo/inferencia.js';
import { emparejar } from '../vision/metricas.js';

const ruta = (r) => fileURLToPath(new URL(r, import.meta.url));
const MODELO = ruta('../vision/yolo/modelo/modelo.onnx');
const imagenes = JSON.parse(readFileSync(ruta('./fixtures/yolo-val.json'), 'utf8'));

function etiquetasACajas(lineas) {
  return lineas.map((l) => {
    const [c, xc, yc, w, h] = l.split(' ').map(Number);
    return { clase: c, x: xc - w / 2, y: yc - h / 2, w, h };
  });
}

describe.skipIf(!existsSync(MODELO))('modelo YOLO publicado', () => {
  let sesion;

  it('carga y tiene la entrada que espera la aplicación', async () => {
    sesion = await ort.InferenceSession.create(readFileSync(MODELO));
    expect(sesion.inputNames).toHaveLength(1);
    expect(sesion.outputNames).toHaveLength(1);
  });

  it.each(Object.keys(imagenes))('%s: encuentra los objetos con la clase correcta', async (nombre) => {
    const info = imagenes[nombre];
    const data = new Uint8ClampedArray(gunzipSync(readFileSync(ruta(`./fixtures/${nombre}.rgba.gz`))));
    const entrada = prepararEntrada({ data, width: info.ancho, height: info.alto }, ENTRADA_MODELO);
    const salidas = await sesion.run({ [sesion.inputNames[0]]: new ort.Tensor('float32', entrada.datos, entrada.dims) });
    const salida = salidas[sesion.outputNames[0]];
    const cajas = detectar(salida.data, salida.dims, entrada);
    const reales = etiquetasACajas(info.etiquetas);

    const d = emparejar(cajas, reales, 0.5);
    const claseCorrecta = d.pares.filter((p) => cajas[p.i].clase === reales[p.j].clase).length;
    expect(d.recall, `${nombre}: ${cajas.length} detectadas de ${reales.length}`).toBeGreaterThanOrEqual(0.75);
    expect(d.precision).toBeGreaterThanOrEqual(0.75);
    expect(claseCorrecta).toBe(d.vp);
  });
});
