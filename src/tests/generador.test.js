// Generador procedural del almacén: escenas válidas, repetibles y distintas, y
// pruebas de propiedades: las reglas se cumplen en CUALQUIER escena generada,
// no solo en los guiones escritos a mano.
import { describe, expect, it } from 'vitest';
import reglas from '../rules/reglas.json';
import { generarAlmacen, normalizarOpciones } from '../simulation/generador.js';
import { validarGuion } from '../simulation/validar.js';
import { procesarSesion } from '../rules/motorReglas.js';
import { crearAnalizador } from '../analysis/analizar.js';
import { generarCuadro, totalCuadros } from '../simulation/motor.js';

const SEMILLAS = Array.from({ length: 40 }, (_, i) => 1000 + i * 37);
const RIESGOS = ['bajo', 'medio', 'alto'];

// Recorre la sesión y mide, para cada persona, los tramos continuos dentro de la zona
// restringida, y para la zona de tránsito, los tramos obstruidos más del 30 %.
function medir(guion, semilla) {
  const analizar = crearAnalizador(guion, semilla);
  const tramos = { restringida: {}, obstruccion: [] };
  const abiertos = {};
  let obstruidaDesde = null;
  for (let i = 0; i < totalCuadros(guion); i++) {
    const r = analizar(generarCuadro(guion, i, semilla));
    for (const o of r.objetos.filter((x) => x.clase === 'persona')) {
      const dentro = o.regiones.includes('restringida-1');
      if (dentro && abiertos[o.id] == null) abiertos[o.id] = r.t;
      if (!dentro && abiertos[o.id] != null) {
        (tramos.restringida[o.id] ??= []).push(r.t - abiertos[o.id]);
        abiertos[o.id] = null;
      }
    }
    const ob = r.mediciones.find((m) => m.region === 'transito-1').obstruccion > 0.3;
    if (ob && obstruidaDesde == null) obstruidaDesde = r.t;
    if (!ob && obstruidaDesde != null) {
      tramos.obstruccion.push(r.t - obstruidaDesde);
      obstruidaDesde = null;
    }
  }
  return tramos;
}

describe('generador procedural del almacén', () => {
  it.each(RIESGOS)('riesgo %s: 40 escenas válidas (formato, coordenadas 0..1, tiempos)', (riesgo) => {
    for (const s of SEMILLAS) {
      const g = generarAlmacen(s, { riesgo, personas: 4, montacargas: 2 });
      expect(validarGuion(g, reglas)).toEqual([]);
    }
  });

  it('la misma semilla y opciones producen la misma escena; otra semilla, otra escena', () => {
    expect(generarAlmacen(7, { personas: 3 })).toEqual(generarAlmacen(7, { personas: 3 }));
    expect(generarAlmacen(7)).not.toEqual(generarAlmacen(8));
    const distribuciones = new Set(SEMILLAS.map((s) => JSON.stringify(generarAlmacen(s).regiones)));
    expect(distribuciones.size).toBeGreaterThan(30);
  });

  it('respeta las opciones (personas y montacargas) y las limita a valores razonables', () => {
    const g = generarAlmacen(5, { personas: 5, montacargas: 2 });
    expect(g.objetos.filter((o) => o.clase === 'persona')).toHaveLength(5);
    expect(g.objetos.filter((o) => o.clase === 'montacargas')).toHaveLength(2);
    expect(normalizarOpciones({ personas: 99, montacargas: -1, riesgo: 'extremo' })).toEqual({ personas: 6, montacargas: 1, riesgo: 'medio' });
  });

  it('las personas nunca atraviesan las estanterías (caminan por pasillos y corredores)', () => {
    for (const riesgo of RIESGOS) {
      for (const s of SEMILLAS.slice(0, 15)) {
        const g = generarAlmacen(s, { riesgo, personas: 4 });
        const estanterias = g.regiones.filter((r) => r.clase === 'estanteria');
        for (let i = 0; i < totalCuadros(g); i += 3) {
          const cuadro = generarCuadro(g, i, s);
          for (const o of cuadro.objetos.filter((x) => x.clase === 'persona')) {
            const pisa = estanterias.find((e) => o.x > e.x && o.x < e.x + e.w && o.y > e.y && o.y < e.y + e.h);
            expect(pisa, `${riesgo}/${s}: ${o.id} en ${pisa?.id} (t=${cuadro.t})`).toBeUndefined();
          }
        }
      }
    }
  });

  it('cada escena se analiza completa en menos de medio segundo', () => {
    const inicio = performance.now();
    procesarSesion(generarAlmacen(42, { personas: 6, montacargas: 2, riesgo: 'alto' }), 42, reglas.reglas);
    expect(performance.now() - inicio).toBeLessThan(500);
  });
});

describe('propiedades de las reglas en escenas generadas', () => {
  const casos = RIESGOS.flatMap((riesgo) => SEMILLAS.slice(0, 20).map((s) => [riesgo, s]));

  it.each(casos)('riesgo %s, semilla %s: cada permanencia de más de 3 s en zona restringida tiene alerta, y solo esas', (riesgo, s) => {
    const g = generarAlmacen(s, { riesgo });
    const eventos = procesarSesion(g, s, reglas.reglas);
    const alertasZona = eventos.filter((e) => e.tipo === 'alerta' && (e.regla === 'RN-02.1' || e.regla === 'RN-02.2'));
    const { restringida } = medir(g, s);
    const largas = Object.values(restringida).flat().filter((d) => d > 3.05).length;
    // RN-G1 y RN-G2: una alerta por cada permanencia larga; ninguna por las cortas.
    expect(alertasZona.length).toBe(largas);
  });

  it.each(casos)('riesgo %s, semilla %s: cada obstrucción de 5 s o más tiene alerta RN-02.3', (riesgo, s) => {
    const g = generarAlmacen(s, { riesgo });
    const eventos = procesarSesion(g, s, reglas.reglas);
    const { obstruccion } = medir(g, s);
    expect(eventos.filter((e) => e.regla === 'RN-02.3' && e.tipo === 'alerta').length).toBe(obstruccion.filter((d) => d > 5.05).length);
  });

  it('con riesgo alto siempre hay incidentes, y la regla de proximidad (RN-02.2) aparece en varias escenas', () => {
    let conAlerta = 0;
    let conProximidad = 0;
    for (const s of SEMILLAS) {
      const ev = procesarSesion(generarAlmacen(s, { riesgo: 'alto' }), s, reglas.reglas).filter((e) => e.tipo === 'alerta');
      if (ev.length) conAlerta++;
      if (ev.some((e) => e.regla === 'RN-02.2')) conProximidad++;
    }
    expect(conAlerta).toBe(SEMILLAS.length);
    expect(conProximidad).toBeGreaterThan(SEMILLAS.length / 2);
  });

  it('el riesgo bajo produce en promedio menos alertas que el alto', () => {
    const promedio = (riesgo) =>
      SEMILLAS.reduce((s, sem) => s + procesarSesion(generarAlmacen(sem, { riesgo }), sem, reglas.reglas).filter((e) => e.tipo === 'alerta').length, 0) /
      SEMILLAS.length;
    expect(promedio('bajo')).toBeLessThan(promedio('alto'));
  });
});
