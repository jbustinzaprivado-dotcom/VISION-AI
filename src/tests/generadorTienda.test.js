// Generador procedural de la tienda (CU-04): escenas válidas, repetibles y distintas,
// y propiedades de las reglas RN-04 en cualquier tienda generada.
import { describe, expect, it } from 'vitest';
import reglas from '../rules/reglas.json';
import { AFLUENCIAS, generarTienda, normalizarOpcionesTienda } from '../simulation/generadorTienda.js';
import { GENERADORES, guionDeSesion } from '../simulation/generadores.js';
import { validarGuion } from '../simulation/validar.js';
import { procesarSesion } from '../rules/motorReglas.js';
import { crearAnalizador } from '../analysis/analizar.js';
import { generarCuadro, totalCuadros } from '../simulation/motor.js';
import { escenaEn } from '../simulation/trayectoria.js';
import { areaSuperpuesta, cajaDe, estaDentro } from '../analysis/geometria.js';
import { casoPorId } from '../simulation/casos.js';

const SEMILLAS = Array.from({ length: 20 }, (_, i) => 300 + i * 53);
const RIESGOS = ['bajo', 'medio', 'alto'];
const AFL = Object.keys(AFLUENCIAS);

// Tramos continuos en que una región de pasillo o caja tuvo más de 6 personas.
function tramosConMasDe6(g, s) {
  const analizar = crearAnalizador(g, s);
  const desde = {};
  const tramos = [];
  for (let i = 0; i < totalCuadros(g); i++) {
    const r = analizar(generarCuadro(g, i, s));
    for (const m of r.mediciones.filter((x) => x.clase === 'pasillo' || x.clase === 'caja')) {
      const lleno = m.personas > 6;
      if (lleno && desde[m.region] == null) desde[m.region] = r.t;
      if (!lleno && desde[m.region] != null) {
        tramos.push({ region: m.region, duracion: r.t - desde[m.region] });
        desde[m.region] = null;
      }
    }
  }
  // Sigue lleno en el último cuadro: se mide hasta el cuadro siguiente, como los tramos cerrados.
  for (const [region, t0] of Object.entries(desde)) if (t0 != null) tramos.push({ region, duracion: g.duracion - t0 + 1 / 12, abierto: true });
  return tramos;
}

describe('generador procedural de la tienda', () => {
  it.each(RIESGOS)('riesgo %s: escenas válidas con toda afluencia', (riesgo) => {
    for (const s of SEMILLAS.slice(0, 10)) for (const afluencia of AFL) expect(validarGuion(generarTienda(s, { riesgo, afluencia }), reglas)).toEqual([]);
  });

  it('misma semilla y opciones, misma tienda; otra semilla, otra tienda', () => {
    expect(generarTienda(4, { riesgo: 'alto' })).toEqual(generarTienda(4, { riesgo: 'alto' }));
    const distintas = new Set(SEMILLAS.map((s) => JSON.stringify(generarTienda(s).objetos.map((o) => o.ruta[0]))));
    expect(distintas.size).toBe(SEMILLAS.length);
    expect(normalizarOpcionesTienda({ afluencia: 'x', riesgo: 'y' })).toEqual({ afluencia: 'media', riesgo: 'medio' });
  });

  it('la afluencia elegida se cumple: llegan todos los clientes', () => {
    for (const [id, a] of Object.entries(AFLUENCIAS)) {
      for (const s of SEMILLAS.slice(0, 5)) {
        const g = generarTienda(s, { afluencia: id, riesgo: 'bajo' });
        expect(g.objetos.filter((o) => o.clase === 'persona')).toHaveLength(a.clientes);
      }
    }
  });

  it('los clientes no atraviesan estantes ni entran a una caja antes de que se abra', () => {
    for (const riesgo of RIESGOS) {
      for (const s of SEMILLAS.slice(0, 8)) {
        const g = generarTienda(s, { riesgo, afluencia: 'alta' });
        const estantes = g.objetos.filter((o) => o.clase === 'estante').map((o) => cajaDe({ ...o, ...o.ruta[0] }));
        for (let t = 0; t <= g.duracion; t += 0.5) {
          const e = escenaEn(g, t);
          const cerradas = e.regiones.filter((r) => r.clase === 'caja' && r.atributos.abierta === false);
          for (const p of e.objetos.filter((o) => o.clase === 'persona')) {
            for (const est of estantes) expect(areaSuperpuesta(cajaDe(p), est), `${riesgo}/${s} ${p.id} t=${t}`).toBe(0);
            for (const c of cerradas) expect(estaDentro(c, p), `${riesgo}/${s} ${p.id} en ${c.id} cerrada t=${t}`).toBe(false);
          }
        }
      }
    }
  });
});

describe('propiedades de las reglas RN-04 en tiendas generadas', () => {
  const casos = RIESGOS.flatMap((riesgo) => SEMILLAS.slice(0, 10).map((s) => [riesgo, s]));

  it.each(casos)('riesgo %s, semilla %s: cada cliente suma una vez a la afluencia (RN-04.2)', (riesgo, s) => {
    const g = generarTienda(s, { riesgo, afluencia: 'alta' });
    const eventos = procesarSesion(g, s, reglas.reglas);
    const cruces = eventos.filter((e) => e.regla === 'RN-04.2');
    expect(cruces).toHaveLength(g.generado.clientes);
    expect(new Set(cruces.map((e) => e.objetivo)).size).toBe(g.generado.clientes);
  });

  it.each(casos)('riesgo %s, semilla %s: una alerta de congestión por cada región con más de 6 personas durante más de 5 s', (riesgo, s) => {
    const g = generarTienda(s, { riesgo, afluencia: 'alta' });
    const alertas = procesarSesion(g, s, reglas.reglas).filter((e) => e.regla === 'RN-04.1' && e.tipo === 'alerta');
    const largos = tramosConMasDe6(g, s).filter((x) => x.duracion > 5.05);
    expect(alertas).toHaveLength(largos.length);
  });

  it('el riesgo alto produce en promedio más congestión que el bajo', () => {
    const promedio = (riesgo) =>
      SEMILLAS.reduce((suma, s) => suma + procesarSesion(generarTienda(s, { riesgo, afluencia: 'alta' }), s, reglas.reglas).filter((e) => e.regla === 'RN-04.1' && e.tipo === 'alerta').length, 0) /
      SEMILLAS.length;
    expect(promedio('alto')).toBeGreaterThan(promedio('bajo'));
  });
});

describe('registro', () => {
  it('la tienda generada está registrada y su sesión se reconstruye', () => {
    expect(GENERADORES['GEN-04'].caso).toBe('CU-04');
    const g = generarTienda(21, { afluencia: 'baja' });
    expect(guionDeSesion({ caso: 'CU-04', semilla: 21, generado: g.generado }, casoPorId)).toEqual(g);
  });
});
