// Generador procedural de la línea de control de calidad (CU-03): escenas válidas,
// repetibles y distintas, y propiedades de las reglas RN-03 en cualquier línea generada.
import { describe, expect, it } from 'vitest';
import reglas from '../rules/reglas.json';
import { CADENCIAS, VELOCIDADES_CINTA, generarCalidad, normalizarOpcionesCalidad } from '../simulation/generadorCalidad.js';
import { GENERADORES, guionDeSesion } from '../simulation/generadores.js';
import { generarAlmacen } from '../simulation/generador.js';
import { validarGuion } from '../simulation/validar.js';
import { procesarSesion } from '../rules/motorReglas.js';
import { crearAnalizador } from '../analysis/analizar.js';
import { generarCuadro, totalCuadros } from '../simulation/motor.js';
import { cajaDe, areaSuperpuesta } from '../analysis/geometria.js';
import { casoPorId } from '../simulation/casos.js';
import { resumir } from '../data/resumen.js';

const SEMILLAS = Array.from({ length: 25 }, (_, i) => 500 + i * 41);
const RIESGOS = ['bajo', 'medio', 'alto'];
const COMBINACIONES = Object.keys(CADENCIAS).flatMap((cadencia) => Object.keys(VELOCIDADES_CINTA).map((velocidad) => ({ cadencia, velocidad })));

// Clasificación que corresponde a un producto según sus atributos (Proyecto, sección 11).
function clasificacionEsperada(p) {
  const a = p.atributos;
  const defecto = a.defecto ? a.defecto.w * a.defecto.h : 0;
  if (defecto > 0.02 || !a.etiqueta || a.piezaFaltante) return 'No conforme';
  if (defecto > 0) return 'Conforme con observación';
  return null;
}

describe('generador procedural de la línea de calidad', () => {
  it.each(RIESGOS)('riesgo %s: escenas válidas en todas las combinaciones de ritmo y velocidad', (riesgo) => {
    for (const s of SEMILLAS.slice(0, 8)) {
      for (const c of COMBINACIONES) expect(validarGuion(generarCalidad(s, { ...c, riesgo }), reglas)).toEqual([]);
    }
  });

  it('misma semilla y opciones, misma línea; otra semilla, otra línea', () => {
    expect(generarCalidad(9, { riesgo: 'alto' })).toEqual(generarCalidad(9, { riesgo: 'alto' }));
    const distintas = new Set(SEMILLAS.map((s) => JSON.stringify(generarCalidad(s).regiones)));
    expect(distintas.size).toBeGreaterThan(20);
  });

  it('respeta las opciones: más ritmo, más productos; la cinta guarda su velocidad', () => {
    const contar = (cadencia) => generarCalidad(3, { cadencia }).objetos.length;
    expect(contar('alta')).toBeGreaterThan(contar('baja'));
    for (const [id, vel] of Object.entries(VELOCIDADES_CINTA)) {
      const cinta = generarCalidad(3, { velocidad: id }).regiones.find((r) => r.clase === 'cinta');
      expect(cinta.atributos.velocidad).toBe(vel.v);
    }
    expect(normalizarOpcionesCalidad({ cadencia: 'loca', velocidad: 'x', riesgo: 'y' })).toEqual({ cadencia: 'media', velocidad: 'normal', riesgo: 'medio' });
  });

  it('los productos nunca se superponen en la cinta', () => {
    for (const s of SEMILLAS.slice(0, 10)) {
      const g = generarCalidad(s, { cadencia: 'alta', velocidad: 'lenta', riesgo: 'alto' });
      for (let i = 0; i < totalCuadros(g); i += 4) {
        const cajas = generarCuadro(g, i, s).objetos.map(cajaDe);
        for (let a = 0; a < cajas.length; a++) for (let b = a + 1; b < cajas.length; b++) expect(areaSuperpuesta(cajas[a], cajas[b])).toBe(0);
      }
    }
  });
});

describe('propiedades de las reglas RN-03 en líneas generadas', () => {
  const casos = RIESGOS.flatMap((riesgo) => SEMILLAS.slice(0, 12).map((s) => [riesgo, s]));

  it.each(casos)('riesgo %s, semilla %s: cada producto pasa por inspección y recibe exactamente su clasificación', (riesgo, s) => {
    const g = generarCalidad(s, { riesgo });
    const eventos = procesarSesion(g, s, reglas.reglas).filter((e) => e.tipo !== 'cierre');
    const porProducto = {};
    for (const e of eventos) if (e.clasificacion) (porProducto[e.objetivo] ??= []).push(e.clasificacion);

    // Todos los productos llegan al punto de inspección dentro de la sesión.
    const analizar = crearAnalizador(g, s);
    const inspeccionados = new Set();
    for (let i = 0; i < totalCuadros(g); i++) {
      for (const o of analizar(generarCuadro(g, i, s)).objetos) if (o.regiones.includes('inspeccion-1')) inspeccionados.add(o.id);
    }
    for (const p of g.objetos) {
      expect(inspeccionados.has(p.id), `${p.id} no pasó por inspección`).toBe(true);
      const esperada = clasificacionEsperada(p);
      expect(porProducto[p.id] ?? [], p.id).toEqual(esperada ? [esperada] : []);
    }
    // El conteo del generador coincide con el resumen que se guarda en el historial.
    const r = resumir(g, eventos);
    expect(r.clasificaciones['No conforme'] ?? 0).toBe(g.generado.conteo.noConformes);
    expect(r.clasificaciones['Conforme con observación'] ?? 0).toBe(g.generado.conteo.conObservacion);
    expect(r.productos).toBe(g.objetos.length);
  });

  it('el riesgo alto produce en promedio más productos no conformes que el bajo', () => {
    const promedio = (riesgo) => SEMILLAS.reduce((suma, s) => suma + generarCalidad(s, { riesgo }).generado.conteo.noConformes, 0) / SEMILLAS.length;
    expect(promedio('alto')).toBeGreaterThan(promedio('bajo'));
  });
});

describe('registro de generadores', () => {
  it('reconstruye la escena de una sesión guardada (almacén, calidad y caso fijo)', () => {
    const almacen = generarAlmacen(11, { personas: 2 });
    const calidad = generarCalidad(11, { cadencia: 'alta' });
    expect(guionDeSesion({ caso: 'CU-02', semilla: 11, generado: almacen.generado }, casoPorId)).toEqual(almacen);
    expect(guionDeSesion({ caso: 'CU-03', semilla: 11, generado: calidad.generado }, casoPorId)).toEqual(calidad);
    expect(guionDeSesion({ caso: 'CU-03', semilla: 2026, generado: null }, casoPorId)).toBe(casoPorId('CU-03'));
    expect(Object.values(GENERADORES).map((g) => g.caso)).toEqual(['CU-02', 'CU-04', 'CU-01', 'CU-03']);
  });
});
