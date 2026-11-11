// Generador procedural de seguridad industrial (CU-01): plantas válidas, repetibles y
// distintas, y propiedades de las reglas RN-01 en cualquier planta generada.
import { describe, expect, it } from 'vitest';
import reglas from '../rules/reglas.json';
import { generarSeguridad, normalizarOpcionesSeguridad } from '../simulation/generadorSeguridad.js';
import { GENERADORES, guionDeSesion } from '../simulation/generadores.js';
import { validarGuion } from '../simulation/validar.js';
import { procesarSesion } from '../rules/motorReglas.js';
import { crearAnalizador } from '../analysis/analizar.js';
import { generarCuadro, totalCuadros } from '../simulation/motor.js';
import { casoPorId } from '../simulation/casos.js';

const SEMILLAS = Array.from({ length: 20 }, (_, i) => 900 + i * 61);
const RIESGOS = ['bajo', 'medio', 'alto'];

// Recorre la sesión y mide tramos continuos de cada situación que vigilan las reglas.
function medir(g, s) {
  const analizar = crearAnalizador(g, s);
  const abiertos = {};
  const tramos = { casco: [], chaleco: [], pocoVisible: [], salida: [] };
  const seguir = (clave, tipo, activo, t) => {
    if (activo && abiertos[clave] == null) abiertos[clave] = t;
    if (!activo && abiertos[clave] != null) {
      tramos[tipo].push(t - abiertos[clave]);
      abiertos[clave] = null;
    }
  };
  for (let i = 0; i < totalCuadros(g); i++) {
    const r = analizar(generarCuadro(g, i, s));
    const enArea = (o) => o.regiones.some((id) => id.startsWith('area-trabajo'));
    for (const o of r.objetos.filter((x) => x.clase === 'persona')) {
      seguir(`casco|${o.id}`, 'casco', enArea(o) && o.atributos.casco === false, r.t);
      seguir(`chaleco|${o.id}`, 'chaleco', enArea(o) && o.atributos.chaleco === false, r.t);
      seguir(`visible|${o.id}`, 'pocoVisible', enArea(o) && o.atributos.pocoVisible === true, r.t);
    }
    for (const m of r.mediciones.filter((x) => x.clase === 'salida-emergencia')) seguir(`salida|${m.region}`, 'salida', m.obstruccion > 0.5, r.t);
  }
  for (const [clave, t0] of Object.entries(abiertos)) {
    if (t0 == null) continue;
    const tipo = { casco: 'casco', chaleco: 'chaleco', visible: 'pocoVisible', salida: 'salida' }[clave.split('|')[0]];
    // Sigue activo en el último cuadro: se cuenta como si hubiera terminado en el cuadro siguiente,
    // igual que los tramos cerrados (su fin es el primer cuadro inactivo).
    tramos[tipo].push(g.duracion - t0 + 1 / 12);
  }
  return tramos;
}

describe('generador procedural de seguridad industrial', () => {
  it.each(RIESGOS)('riesgo %s: plantas válidas con 2 a 6 trabajadores', (riesgo) => {
    for (const s of SEMILLAS.slice(0, 10)) for (const trabajadores of [2, 4, 6]) expect(validarGuion(generarSeguridad(s, { riesgo, trabajadores }), reglas)).toEqual([]);
  });

  it('misma semilla y opciones, misma planta; otra semilla, otra planta', () => {
    expect(generarSeguridad(5, { riesgo: 'alto' })).toEqual(generarSeguridad(5, { riesgo: 'alto' }));
    const distintas = new Set(SEMILLAS.map((s) => JSON.stringify(generarSeguridad(s).regiones)));
    expect(distintas.size).toBeGreaterThan(15);
    expect(normalizarOpcionesSeguridad({ trabajadores: 50, riesgo: 'z' })).toEqual({ trabajadores: 6, riesgo: 'medio' });
  });

  it('respeta la cantidad de trabajadores y el riesgo alto genera más incidentes que el bajo', () => {
    expect(generarSeguridad(1, { trabajadores: 5 }).objetos.filter((o) => o.clase === 'persona')).toHaveLength(5);
    const total = (riesgo) =>
      SEMILLAS.reduce((suma, s) => {
        const c = generarSeguridad(s, { riesgo, trabajadores: 6 }).generado.conteo;
        return suma + c.sinCasco + c.sinChaleco + c.pocoVisible + c.bloqueos;
      }, 0);
    expect(total('alto')).toBeGreaterThan(total('bajo'));
  });
});

describe('propiedades de las reglas RN-01 en plantas generadas', () => {
  const casos = RIESGOS.flatMap((riesgo) => SEMILLAS.slice(0, 10).map((s) => [riesgo, s]));

  it.each(casos)('riesgo %s, semilla %s: alertas y advertencias exactamente donde corresponden', (riesgo, s) => {
    const g = generarSeguridad(s, { riesgo, trabajadores: 6 });
    const ev = procesarSesion(g, s, reglas.reglas);
    const cuenta = (regla, tipo) => ev.filter((e) => e.regla === regla && e.tipo === tipo).length;
    const t = medir(g, s);
    // RN-01.1: sin casco o sin chaleco en el área durante más de 2 s.
    expect(cuenta('RN-01.1-casco', 'alerta')).toBe(t.casco.filter((d) => d > 2.05).length);
    expect(cuenta('RN-01.1-chaleco', 'alerta')).toBe(t.chaleco.filter((d) => d > 2.05).length);
    // RN-01.3: cada vez que una figura poco visible está en el área, una advertencia (sin alerta).
    expect(cuenta('RN-01.3', 'advertencia')).toBe(t.pocoVisible.length);
    // RN-01.2: salida obstruida más del 50 % durante más de 5 s.
    expect(cuenta('RN-01.2', 'alerta')).toBe(t.salida.filter((d) => d > 5.05).length);
  });
});

describe('registro', () => {
  it('la planta generada está registrada y su sesión se reconstruye', () => {
    expect(GENERADORES['GEN-01'].caso).toBe('CU-01');
    const g = generarSeguridad(33, { trabajadores: 3 });
    expect(guionDeSesion({ caso: 'CU-01', semilla: 33, generado: g.generado }, casoPorId)).toEqual(g);
  });
});
