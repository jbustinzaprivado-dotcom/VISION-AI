// Fase 4: el análisis simulado entrega resultados que coinciden con el guion.
// Se analiza cada cuadro tal como lo genera el motor (con el ruido de la semilla 2026).
import { describe, expect, it } from 'vitest';
import { analizarCuadro, crearAnalizador } from '../analysis/analizar.js';
import { generarCuadro, totalCuadros } from '../simulation/motor.js';
import { FPS } from '../simulation/reloj.js';
import { CASOS, casoPorId } from '../simulation/casos.js';

const SEMILLA = 2026;

// Resultados de todos los cuadros de un caso, con su instante t.
function analizarSesion(guion) {
  const analizar = crearAnalizador(guion, SEMILLA);
  const lista = [];
  for (let i = 0; i < totalCuadros(guion); i++) lista.push(analizar(generarCuadro(guion, i, SEMILLA)));
  return lista;
}
const sesiones = Object.fromEntries(CASOS.map((c) => [c.caso, analizarSesion(c)]));
const en = (caso, t) => sesiones[caso][Math.round(t * FPS)];
const entre = (caso, t1, t2) => sesiones[caso].filter((r) => r.t >= t1 && r.t <= t2);
const medicion = (r, id) => r.mediciones.find((m) => m.region === id);
const objeto = (r, id) => r.objetos.find((o) => o.id === id);

describe('formato del resultado (Arquitectura, A3)', () => {
  it.each(CASOS.map((c) => [c.caso]))('%s: modo PROTOTIPO y valores entre 0 y 1 (RI-02)', (caso) => {
    for (const r of sesiones[caso]) {
      expect(r.modo).toBe('PROTOTIPO');
      expect(r.alertas).toEqual([]);
      expect(r.regiones.some((x) => x.clase === 'suelo')).toBe(false);
      for (const m of r.mediciones) {
        expect(m.ocupacion).toBeGreaterThanOrEqual(0);
        expect(m.ocupacion).toBeLessThanOrEqual(1);
        expect(m.obstruccion).toBeLessThanOrEqual(m.ocupacion + 1e-9);
      }
      for (const c of r.cambios) expect(Math.abs(c.diferencia)).toBeLessThanOrEqual(1);
    }
  });

  it('la misma semilla produce el mismo análisis', () => {
    const g = casoPorId('CU-02');
    expect(analizarSesion(g)).toEqual(sesiones['CU-02']);
  });

  it('sin referencia no se informan cambios', () => {
    expect(analizarCuadro(generarCuadro(casoPorId('CU-02'), 400, SEMILLA)).cambios).toEqual([]);
  });

  it('en el cuadro inicial no hay cambios respecto de sí mismo', () => {
    for (const caso of Object.keys(sesiones)) expect(sesiones[caso][0].cambios).toEqual([]);
  });
});

describe('CU-02 · Almacén: regiones, ocupación, obstrucción y cambios', () => {
  it('al inicio la zona de tránsito y la zona restringida están libres', () => {
    expect(medicion(en('CU-02', 0), 'transito-1').libre).toBe(true);
    expect(medicion(en('CU-02', 0), 'restringida-1').libre).toBe(true);
  });

  it('t 12–17: el montacargas sube la ocupación del pasillo central', () => {
    expect(medicion(en('CU-02', 14), 'pasillo-1').ocupacion).toBeGreaterThan(medicion(en('CU-02', 0), 'pasillo-1').ocupacion);
  });

  it('t 20–23: la persona está en la zona restringida y el montacargas se mueve', () => {
    for (const r of entre('CU-02', 20, 23.5)) {
      expect(objeto(r, 'persona-1').regiones).toContain('restringida-1');
      expect(objeto(r, 'montacargas-1').enMovimiento).toBe(true);
    }
  });

  it('una persona ocupa la región pero no la obstruye', () => {
    const m = medicion(en('CU-02', 22), 'restringida-1');
    expect(m.ocupacion).toBeGreaterThan(0);
    expect(m.obstruccion).toBe(0);
    expect(m.personas).toBe(1);
  });

  it('t 30–50: tránsito obstruido más del 30 %; antes y después, no', () => {
    for (const r of entre('CU-02', 30, 49.9)) expect(medicion(r, 'transito-1').obstruccion).toBeGreaterThan(0.3);
    for (const r of [...entre('CU-02', 0, 29.9), ...entre('CU-02', 50, 60)]) {
      expect(medicion(r, 'transito-1').obstruccion).toBeLessThan(0.3);
    }
  });

  it('comparación con el inicio: cambio mayor a 20 puntos en t 30–50 y zona liberada en t 50', () => {
    const cambio = (r) => r.cambios.find((c) => c.region === 'transito-1');
    expect(cambio(en('CU-02', 35)).diferencia).toBeGreaterThan(0.2);
    expect(cambio(en('CU-02', 55))).toBeUndefined();
    expect(medicion(en('CU-02', 55), 'transito-1').libre).toBe(true);
  });
});

describe('CU-04 · Tienda: personas por región', () => {
  it('más de 6 personas en la caja 1 entre t ≈ 29 y la apertura de la caja 2', () => {
    const conMasDe6 = sesiones['CU-04'].filter((r) => medicion(r, 'caja-1').personas > 6).map((r) => r.t);
    expect(conMasDe6[0]).toBeGreaterThanOrEqual(29);
    expect(conMasDe6[0]).toBeLessThanOrEqual(30);
    expect(conMasDe6.at(-1)).toBeGreaterThanOrEqual(42);
    expect(conMasDe6.at(-1)).toBeLessThan(44);
  });

  it('después de abrir la caja 2: 4 personas en la caja 1 y 3 en la caja 2', () => {
    const r = en('CU-04', 50);
    expect(medicion(r, 'caja-1').personas).toBe(4);
    expect(medicion(r, 'caja-2').personas).toBe(3);
  });

  it('ninguna otra región supera 6 personas', () => {
    for (const r of sesiones['CU-04']) {
      for (const id of ['pasillo-1', 'pasillo-2', 'caja-2']) expect(medicion(r, id).personas).toBeLessThanOrEqual(6);
    }
  });
});

describe('CU-01 · Seguridad industrial', () => {
  it('t 8–14: B está en el área de trabajo sin casco', () => {
    for (const r of entre('CU-01', 8.1, 13.9)) {
      const b = objeto(r, 'trabajador-b');
      expect(b.regiones).toContain('area-trabajo-1');
      expect(b.atributos.casco).toBe(false);
    }
  });

  it('t 40–50: salida de emergencia obstruida más del 50 %', () => {
    for (const r of entre('CU-01', 40, 50)) expect(medicion(r, 'salida-1').obstruccion).toBeGreaterThan(0.5);
    for (const r of entre('CU-01', 0, 39)) expect(medicion(r, 'salida-1').obstruccion).toBeLessThan(0.5);
  });
});

describe('CU-03 · Control de calidad: área defectuosa', () => {
  it.each([
    [9, 'producto-2', 0.03],
    [21, 'producto-4', 0.01],
    [33, 'producto-6', 0],
  ])('t %s: %s en inspección con defecto %s', (t, id, proporcion) => {
    const p = objeto(en('CU-03', t), id);
    expect(p.regiones).toContain('inspeccion-1');
    expect(p.proporcionDefecto).toBeCloseTo(proporcion, 6);
  });
});
