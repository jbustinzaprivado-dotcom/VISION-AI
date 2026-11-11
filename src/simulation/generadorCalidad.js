// Generador procedural de la línea de control de calidad (CU-03).
// A partir de una semilla y unas opciones arma una línea distinta: posición y ancho
// de la cinta, punto de inspección, velocidad, ritmo de llegada y tamaño de los
// productos, y qué productos traen incidentes (defecto mayor o menor al 2 %, sin
// etiqueta, pieza faltante). Misma semilla y opciones, misma línea.
//
// Produce un guion con el formato de los JSON: motor, análisis y reglas sin cambios.
import seedrandom from 'seedrandom';

export const VERSION_GENERADOR_CALIDAD = 1;
export const OPCIONES_CALIDAD = { cadencia: 'media', velocidad: 'normal', riesgo: 'medio' };
export const CADENCIAS = { baja: { nombre: 'Baja', intervalo: 8 }, media: { nombre: 'Media', intervalo: 6 }, alta: { nombre: 'Alta', intervalo: 4.5 } };
export const VELOCIDADES_CINTA = { lenta: { nombre: 'Lenta', v: 0.07 }, normal: { nombre: 'Normal', v: 0.1 }, rapida: { nombre: 'Rápida', v: 0.13 } };
// Probabilidad de que un producto traiga cada tipo de incidente (a lo sumo uno por producto).
export const RIESGOS_CALIDAD = {
  bajo: { nombre: 'Bajo', defectoMayor: 0.06, defectoMenor: 0.08, sinEtiqueta: 0.03, piezaFaltante: 0.03 },
  medio: { nombre: 'Medio', defectoMayor: 0.14, defectoMenor: 0.12, sinEtiqueta: 0.07, piezaFaltante: 0.06 },
  alto: { nombre: 'Alto', defectoMayor: 0.25, defectoMenor: 0.15, sinEtiqueta: 0.12, piezaFaltante: 0.1 },
};

const DURACION = 60;
const r3 = (v) => Math.round(v * 1000) / 1000;
const r1 = (v) => Math.round(v * 10) / 10;
const coma = (v) => String(v).replace('.', ',');

export function normalizarOpcionesCalidad(opciones = {}) {
  const o = { ...OPCIONES_CALIDAD, ...opciones };
  return {
    cadencia: CADENCIAS[o.cadencia] ? o.cadencia : 'media',
    velocidad: VELOCIDADES_CINTA[o.velocidad] ? o.velocidad : 'normal',
    riesgo: RIESGOS_CALIDAD[o.riesgo] ? o.riesgo : 'medio',
  };
}

export function generarCalidad(semilla, opciones = {}) {
  const op = normalizarOpcionesCalidad(opciones);
  const azar = seedrandom(`calidad|v${VERSION_GENERADOR_CALIDAD}|${semilla}|${op.cadencia}|${op.velocidad}|${op.riesgo}`);
  const entre = (a, b) => a + azar() * (b - a);
  const v = VELOCIDADES_CINTA[op.velocidad].v; // fracción de la escena por segundo
  const intervalo = CADENCIAS[op.cadencia].intervalo;
  const riesgo = RIESGOS_CALIDAD[op.riesgo];

  // ---------- Línea ----------
  const altoCinta = r3(entre(0.2, 0.26));
  const yCinta = r3(entre(0.28, 0.5));
  const anchoInspeccion = 0.08;
  const xInspeccion = r3(entre(0.32, 0.6));
  const centroInspeccion = xInspeccion + anchoInspeccion / 2;
  const regiones = [
    { id: 'suelo-1', clase: 'suelo', nombre: 'Suelo', x: 0, y: 0, w: 1, h: 1 },
    // La velocidad queda como atributo de la cinta: los rodillos se animan con ella.
    { id: 'cinta-1', clase: 'cinta', nombre: 'Cinta transportadora', x: 0, y: yCinta, w: 1, h: altoCinta, atributos: { velocidad: v } },
    { id: 'inspeccion-1', clase: 'inspeccion', nombre: 'Punto de inspección', x: xInspeccion, y: r3(yCinta - 0.04), w: anchoInspeccion, h: r3(altoCinta + 0.08) },
  ];

  // ---------- Productos ----------
  // Cada producto pasa por el centro de la inspección en el instante ti.
  const objetos = [];
  const eventos = [{ t: 0, texto: `Línea generada: cinta ${VELOCIDADES_CINTA[op.velocidad].nombre.toLowerCase()}, un producto cada ${coma(intervalo)} s aproximadamente.` }];
  const conteo = { noConformes: 0, conObservacion: 0, conformes: 0 };
  let ti = r1(entre(2, 2 + intervalo));
  let n = 0;
  while (ti <= DURACION - 2) {
    n += 1;
    const w = r3(entre(0.07, 0.09));
    const h = r3(Math.min(altoCinta * 0.75, entre(0.12, 0.15)));
    const y = r3(yCinta + altoCinta / 2);
    const atributos = { defecto: null, etiqueta: true, piezaFaltante: false };

    // A lo sumo un incidente por producto (así cada uno tiene una sola clasificación).
    const dado = azar();
    let incidente = null;
    if (dado < riesgo.defectoMayor) incidente = 'mayor';
    else if (dado < riesgo.defectoMayor + riesgo.defectoMenor) incidente = 'menor';
    else if (dado < riesgo.defectoMayor + riesgo.defectoMenor + riesgo.sinEtiqueta) incidente = 'sinEtiqueta';
    else if (dado < riesgo.defectoMayor + riesgo.defectoMenor + riesgo.sinEtiqueta + riesgo.piezaFaltante) incidente = 'piezaFaltante';

    if (incidente === 'mayor' || incidente === 'menor') {
      // Área del defecto relativa al producto: mayor > 2 %; menor entre 0,4 % y 2 %.
      const area = incidente === 'mayor' ? entre(0.025, 0.09) : entre(0.004, 0.019);
      const forma = entre(0.6, 1.6);
      const dw = r3(Math.min(0.6, Math.sqrt(area * forma)));
      const dh = r3(Math.min(0.6, area / dw));
      atributos.defecto = { x: r3(entre(0.05, 0.95 - dw)), y: r3(entre(0.3, 0.95 - dh)), w: dw, h: dh };
    }
    if (incidente === 'sinEtiqueta') atributos.etiqueta = false;
    if (incidente === 'piezaFaltante') atributos.piezaFaltante = true;

    // Ruta en línea recta a velocidad v: x(t) = centroInspeccion + v (t - ti).
    const tInicio = ti - centroInspeccion / v;
    const tFin = ti + (1 - centroInspeccion) / v;
    const ruta = [];
    if (tInicio >= 0) ruta.push({ t: r1(tInicio), x: 0, y });
    else ruta.push({ t: 0, x: r3(centroInspeccion - v * ti), y });
    if (tFin <= DURACION) ruta.push({ t: r1(tFin), x: 1, y });
    else ruta.push({ t: DURACION, x: r3(centroInspeccion + v * (DURACION - ti)), y });
    const objeto = { id: `producto-${n}`, clase: 'producto', w, h, atributos, ruta };
    if (tFin <= DURACION) objeto.sale = r1(tFin);
    objetos.push(objeto);

    const nombre = `Producto ${n}`;
    if (incidente === 'mayor') {
      conteo.noConformes += 1;
      eventos.push({ t: r1(ti), texto: `${nombre} con defecto del ${coma(r1(atributos.defecto.w * atributos.defecto.h * 100))} %: «no conforme» (RN-03.1).` });
    } else if (incidente === 'menor') {
      conteo.conObservacion += 1;
      eventos.push({ t: r1(ti), texto: `${nombre} con defecto del ${coma(r1(atributos.defecto.w * atributos.defecto.h * 100))} %: «conforme con observación» (RN-03.2).` });
    } else if (incidente === 'sinEtiqueta') {
      conteo.noConformes += 1;
      eventos.push({ t: r1(ti), texto: `${nombre} sin etiqueta: «no conforme» (RN-03.3).` });
    } else if (incidente === 'piezaFaltante') {
      conteo.noConformes += 1;
      eventos.push({ t: r1(ti), texto: `${nombre} con pieza faltante: «no conforme» (RN-03.3).` });
    } else {
      conteo.conformes += 1;
    }

    // El siguiente llega con una variación del ritmo, sin chocar con el anterior.
    const separacionMinima = (w + 0.03) / v;
    ti = r1(ti + Math.max(separacionMinima, intervalo * entre(0.75, 1.25)));
  }

  eventos.sort((a, b) => a.t - b.t);
  return {
    caso: 'CU-03',
    nombre: 'Línea de calidad generada',
    prioridad: 3,
    version: 1,
    duracion: DURACION,
    semilla: Number.isInteger(semilla) ? semilla : 0,
    generado: { version: VERSION_GENERADOR_CALIDAD, opciones: op, conteo },
    regiones,
    objetos,
    eventos,
    esperado: {
      alertas: [],
      advertencias: [],
      informativas: [],
      resumen: `Línea generada (riesgo ${RIESGOS_CALIDAD[op.riesgo].nombre.toLowerCase()}): ${n} productos; ${conteo.noConformes} no conformes, ${conteo.conObservacion} con observación y ${conteo.conformes} conformes.`,
    },
  };
}
