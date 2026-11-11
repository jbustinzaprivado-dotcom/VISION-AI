// Análisis simulado (fase 4): lee la posición y el tamaño de las figuras de un cuadro
// —no píxeles— y calcula regiones, ocupación, obstrucciones, zonas libres y cambios.
// No decide alertas: eso lo hace el motor de reglas (fase 6) con este resultado.
import { generarCuadro } from '../simulation/motor.js';
import { estaDentro, ocupacion } from './geometria.js';

export const UMBRAL_LIBRE = 0.01; // por debajo, la región se considera libre
export const UMBRAL_CAMBIO = 0.005; // diferencias menores son ruido y no se informan

const redondear = (v) => Math.round(v * 10000) / 10000;
const analizables = (regiones) => regiones.filter((r) => r.clase !== 'suelo');

function medirRegion(region, objetos) {
  const dentro = objetos.filter((o) => estaDentro(region, o));
  // Ocupación: todo lo que cubre la región. Obstrucción: solo objetos, no personas.
  const ocup = redondear(ocupacion(region, objetos));
  return {
    region: region.id,
    clase: region.clase,
    ocupacion: ocup,
    obstruccion: redondear(ocupacion(region, objetos.filter((o) => o.clase !== 'persona'))),
    personas: dentro.filter((o) => o.clase === 'persona').length,
    objetos: dentro.map((o) => o.id),
    libre: ocup < UMBRAL_LIBRE,
  };
}

function describirObjeto(objeto, regiones) {
  const hecho = {
    id: objeto.id,
    clase: objeto.clase,
    x: objeto.x,
    y: objeto.y,
    enMovimiento: objeto.enMovimiento,
    atributos: objeto.atributos,
    regiones: regiones.filter((r) => estaDentro(r, objeto)).map((r) => r.id),
  };
  if (objeto.clase === 'producto') {
    const d = objeto.atributos.defecto;
    hecho.proporcionDefecto = d ? redondear(d.w * d.h) : 0; // área defectuosa ÷ área del producto
  }
  return hecho;
}

// Analiza un cuadro. `referencia` son las mediciones del inicio de la sesión,
// para comparar momentos; si falta, no se informan cambios.
export function analizarCuadro(cuadro, referencia = null) {
  const regiones = analizables(cuadro.regiones);
  const mediciones = regiones.map((r) => medirRegion(r, cuadro.objetos));

  const cambios = [];
  if (referencia) {
    for (const m of mediciones) {
      const antes = referencia.find((x) => x.region === m.region)?.ocupacion ?? 0;
      const diferencia = redondear(m.ocupacion - antes);
      if (Math.abs(diferencia) >= UMBRAL_CAMBIO) {
        cambios.push({ region: m.region, antes, despues: m.ocupacion, diferencia });
      }
    }
  }

  return {
    modo: 'PROTOTIPO',
    cuadro: cuadro.indice,
    t: cuadro.t,
    regiones: regiones.map((r) => ({ id: r.id, clase: r.clase, nombre: r.nombre, area: redondear(r.w * r.h) })),
    mediciones,
    cambios,
    objetos: cuadro.objetos.map((o) => describirObjeto(o, regiones)),
    alertas: [], // las agrega el motor de reglas (fase 6)
  };
}

// Prepara el análisis de una sesión: toma el cuadro 0 como referencia
// y devuelve una función que analiza cualquier cuadro comparándolo con el inicio.
export function crearAnalizador(guion, semilla) {
  const inicio = analizarCuadro(generarCuadro(guion, 0, semilla));
  return (cuadro) => analizarCuadro(cuadro, inicio.mediciones);
}
