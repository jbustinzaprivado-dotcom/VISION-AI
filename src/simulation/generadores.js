// Registro de los generadores procedurales: uno por caso de uso.
// La pantalla de análisis arma sus botones y opciones desde aquí, y la evidencia y
// el historial usan `guionDeSesion` para reconstruir exactamente una escena generada.
import { OPCIONES_INICIALES, RIESGOS, generarAlmacen } from './generador.js';
import { CADENCIAS, OPCIONES_CALIDAD, RIESGOS_CALIDAD, VELOCIDADES_CINTA, generarCalidad } from './generadorCalidad.js';

const lista = (obj) => Object.entries(obj).map(([valor, d]) => ({ valor, texto: d.nombre }));
const numeros = (desde, hasta) => Array.from({ length: hasta - desde + 1 }, (_, i) => ({ valor: desde + i, texto: String(desde + i) }));

export const GENERADORES = {
  'GEN-02': {
    caso: 'CU-02',
    nombre: 'Almacén generado',
    generar: generarAlmacen,
    opcionesIniciales: OPCIONES_INICIALES,
    campos: [
      { id: 'personas', etiqueta: 'Personas', valores: numeros(1, 6), numerico: true },
      { id: 'montacargas', etiqueta: 'Montacargas', valores: numeros(1, 2), numerico: true },
      { id: 'riesgo', etiqueta: 'Riesgo de incidentes', valores: lista(RIESGOS) },
    ],
  },
  'GEN-03': {
    caso: 'CU-03',
    nombre: 'Línea de calidad generada',
    generar: generarCalidad,
    opcionesIniciales: OPCIONES_CALIDAD,
    campos: [
      { id: 'cadencia', etiqueta: 'Ritmo de llegada', valores: lista(CADENCIAS) },
      { id: 'velocidad', etiqueta: 'Velocidad de la cinta', valores: lista(VELOCIDADES_CINTA) },
      { id: 'riesgo', etiqueta: 'Riesgo de defectos', valores: lista(RIESGOS_CALIDAD) },
    ],
  },
};

const PORCASO = Object.fromEntries(Object.values(GENERADORES).map((g) => [g.caso, g]));

// Reconstruye el guion de una sesión guardada: fijo, o generado con su semilla y opciones.
export function guionDeSesion(sesion, casoPorId) {
  if (sesion?.generado && PORCASO[sesion.caso]) return PORCASO[sesion.caso].generar(sesion.semilla, sesion.generado.opciones);
  return casoPorId(sesion.caso);
}
