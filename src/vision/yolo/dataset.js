// Dataset para entrenar YOLO con escenas generadas (DT-9).
// Funciones puras: deciden qué cuadros se exportan y escriben sus etiquetas en el
// formato de YOLO. Las imágenes las dibuja la cámara limpia (ver ExportadorDataset).
import seedrandom from 'seedrandom';
import { GENERADORES } from '../../simulation/generadores.js';
import { CASOS } from '../../simulation/casos.js';
import { generarCuadro, totalCuadros } from '../../simulation/motor.js';
import { cajaDe } from '../../analysis/geometria.js';

// Clases que aprende el modelo (el orden es el índice de clase de YOLO).
export const CLASES_YOLO = ['persona', 'montacargas', 'carro', 'pallet', 'caja', 'producto', 'estante'];

export const OPCIONES_DATASET = { sesiones: 12, cuadros: 25, validacion: 0.2, semilla: 7 };

// Parte visible de un objeto: los que entran o salen por el borde se recortan y,
// si se ve menos del 40 % de su caja, no se etiquetan (tampoco se distinguirían).
const VISIBLE_MINIMO = 0.4;

function recortar(c) {
  const x0 = Math.max(0, c.x);
  const y0 = Math.max(0, c.y);
  const x1 = Math.min(1, c.x + c.w);
  const y1 = Math.min(1, c.y + c.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

// Cajas reales del cuadro con su clase (normalizadas 0..1, recortadas al cuadro).
export function cajasReales(cuadro) {
  const cajas = [];
  for (const o of cuadro.objetos) {
    const clase = CLASES_YOLO.indexOf(o.clase);
    if (clase < 0) continue;
    const completa = cajaDe(o);
    const visible = recortar(completa);
    if (visible.w * visible.h < VISIBLE_MINIMO * completa.w * completa.h) continue;
    cajas.push({ ...visible, clase, id: o.id });
  }
  return cajas;
}

// Una línea por objeto: "clase xCentro yCentro ancho alto" (todo 0..1).
export function etiquetasYolo(cuadro) {
  const f = (v) => v.toFixed(6);
  return cajasReales(cuadro)
    .map((c) => `${c.clase} ${f(c.x + c.w / 2)} ${f(c.y + c.h / 2)} ${f(c.w)} ${f(c.h)}`)
    .join('\n');
}

// Opciones al azar para un generador, tomadas de sus propios campos.
function opcionesAlAzar(generador, rng) {
  return Object.fromEntries(generador.campos.map((c) => [c.id, c.valores[Math.floor(rng() * c.valores.length)].valor]));
}

// Cuadros repartidos por toda la sesión, con un pequeño desplazamiento al azar.
function elegirCuadros(guion, cantidad, rng) {
  const total = totalCuadros(guion);
  const paso = total / cantidad;
  return Array.from({ length: cantidad }, (_, i) => Math.min(total - 1, Math.floor(i * paso + rng() * paso)));
}

// Plan completo: sesiones de cada generador (con semillas y opciones al azar) y los
// casos fijos. La validación usa sesiones enteras distintas a las de entrenamiento,
// para que el modelo se evalúe con escenas que nunca vio.
export function planDataset(opciones = {}) {
  const o = { ...OPCIONES_DATASET, ...opciones };
  const rng = seedrandom(`dataset-${o.semilla}`);
  const sesiones = [];
  for (const [id, generador] of Object.entries(GENERADORES)) {
    const enValidacion = Math.max(1, Math.round(o.sesiones * o.validacion));
    for (let n = 0; n < o.sesiones; n++) {
      const semilla = 10000 + Math.floor(rng() * 90000);
      const opcionesGen = opcionesAlAzar(generador, rng);
      sesiones.push({ fuente: id, semilla, opciones: opcionesGen, particion: n < enValidacion ? 'val' : 'train', guion: generador.generar(semilla, opcionesGen) });
    }
  }
  for (const caso of CASOS) sesiones.push({ fuente: caso.caso, semilla: caso.semilla, opciones: null, particion: 'train', guion: caso });

  const cuadros = [];
  for (const s of sesiones) {
    for (const indice of elegirCuadros(s.guion, o.cuadros, rng)) {
      const nombre = `${s.fuente}-${s.semilla}-${String(indice).padStart(3, '0')}`;
      cuadros.push({ nombre, particion: s.particion, sesion: s, indice });
    }
  }
  return { opciones: o, sesiones, cuadros };
}

// El cuadro de la simulación (con su ruido) que se dibuja para una entrada del plan.
export function cuadroDelPlan(entrada) {
  return generarCuadro(entrada.sesion.guion, entrada.indice, entrada.sesion.semilla);
}

// Archivo de configuración que lee Ultralytics para entrenar.
export function dataYaml() {
  return ['path: .', 'train: images/train', 'val: images/val', '', 'names:', ...CLASES_YOLO.map((c, i) => `  ${i}: ${c}`), ''].join('\n');
}

// Descripción legible del dataset (va dentro del zip).
export function leeme(plan) {
  const cuenta = (p) => plan.cuadros.filter((c) => c.particion === p).length;
  return [
    'Dataset VISION AI para YOLO (escenas generadas, DT-9)',
    '',
    `Imágenes: ${plan.cuadros.length} (entrenamiento ${cuenta('train')}, validación ${cuenta('val')}), 480 × 270, JPG.`,
    `Clases: ${CLASES_YOLO.join(', ')}.`,
    `Sesiones por generador: ${plan.opciones.sesiones}; cuadros por sesión: ${plan.opciones.cuadros}; semilla del dataset: ${plan.opciones.semilla}.`,
    'La validación usa sesiones completas que no aparecen en el entrenamiento.',
    'Etiquetas: formato YOLO (clase xc yc w h, normalizado), sacadas de la geometría exacta de la simulación.',
    '',
    'Sesiones:',
    ...plan.sesiones.map((s) => `  ${s.particion}\t${s.fuente}\tsemilla ${s.semilla}\t${s.opciones ? JSON.stringify(s.opciones) : 'caso fijo'}`),
    '',
  ].join('\n');
}
