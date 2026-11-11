// Carga diferida del detector YOLO (DT-9): ONNX Runtime Web (WebAssembly) y el
// modelo entrenado con escenas generadas. Solo se descargan al activar la capa
// "YOLO"; Vite los publica en /assets con nombre único, así quedan en caché.
import { ENTRADA_MODELO, detectar, prepararEntrada } from './inferencia.js';

// El modelo se busca con glob: si todavía no se entrenó, la app funciona igual y la
// capa avisa que falta (en vez de romper la compilación).
const MODELOS = import.meta.glob('./modelo/modelo.onnx', { query: '?url', import: 'default' });

let promesa = null;

export function cargarYolo() {
  if (!promesa) {
    promesa = crear().catch((error) => {
      promesa = null; // permite reintentar si falló la descarga
      throw error;
    });
  }
  return promesa;
}

async function crear() {
  const cargarModelo = Object.values(MODELOS)[0];
  if (!cargarModelo) throw new Error('Todavía no hay un modelo entrenado (falta src/vision/yolo/modelo/modelo.onnx).');
  const [ort, { default: wasm }, modelo] = await Promise.all([
    import('onnxruntime-web/wasm'),
    import('onnxruntime-web/ort-wasm-simd-threaded.wasm?url'),
    cargarModelo(),
  ]);
  ort.env.wasm.wasmPaths = { wasm };
  // Sin aislamiento entre orígenes el navegador no permite varios hilos: se usa uno.
  ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  let sesion;
  try {
    sesion = await ort.InferenceSession.create(modelo, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  } catch (e) {
    throw new Error(`No se pudo cargar el modelo YOLO: ${e.message}`);
  }
  const nombreEntrada = sesion.inputNames[0];
  const nombreSalida = sesion.outputNames[0];

  // Detecta objetos en una imagen RGBA (ImageData). Devuelve cajas 0..1 y el tiempo.
  async function detectarEn(imagen) {
    const inicio = performance.now();
    const entrada = prepararEntrada(imagen, ENTRADA_MODELO);
    const tensor = new ort.Tensor('float32', entrada.datos, entrada.dims);
    const salidas = await sesion.run({ [nombreEntrada]: tensor });
    const salida = salidas[nombreSalida];
    const cajas = detectar(salida.data, salida.dims, entrada);
    tensor.dispose?.();
    salida.dispose?.();
    return { cajas, ms: performance.now() - inicio };
  }
  return { detectarEn };
}
