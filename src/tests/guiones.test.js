// Fase 2: los guiones y las reglas están completos y son coherentes.
// Además de validar el formato, se comprueba con geometría que cada guion
// produce la situación que el documento pide en el momento indicado (Proyecto, sección 5.3).
import { describe, expect, it } from 'vitest';
import reglas from '../rules/reglas.json';
import { CASOS, casoPorId } from '../simulation/casos.js';
import { validarGuion, validarReglas } from '../simulation/validar.js';
import { escenaEn } from '../simulation/trayectoria.js';
import { distancia, estaDentro, ocupacion } from '../analysis/geometria.js';

// Instantes de t1 a t2 (incluidos) cada 0,1 s.
function instantes(t1, t2) {
  const lista = [];
  for (let i = Math.round(t1 * 10); i <= Math.round(t2 * 10); i++) lista.push(i / 10);
  return lista;
}
const region = (guion, id) => guion.regiones.find((r) => r.id === id);
const figura = (escena, id) => escena.objetos.find((o) => o.id === id);
const personasEn = (escena, reg) =>
  escena.objetos.filter((o) => o.clase === 'persona' && estaDentro(reg, o)).length;
const ocupacionEn = (guion, t, idRegion) => {
  const escena = escenaEn(guion, t);
  return ocupacion(region(guion, idRegion), escena.objetos);
};

describe('formato de los datos', () => {
  it('hay cuatro casos, con el almacén como principal', () => {
    expect(CASOS.map((c) => c.caso)).toEqual(['CU-02', 'CU-04', 'CU-01', 'CU-03']);
  });

  it.each(CASOS.map((c) => [c.caso, c]))('%s: guion válido', (_, guion) => {
    expect(validarGuion(guion, reglas)).toEqual([]);
  });

  it('reglas válidas', () => {
    expect(validarReglas(reglas)).toEqual([]);
  });

  it('el validador rechaza coordenadas fuera de 0..1 (RI-02)', () => {
    const malo = structuredClone(casoPorId('CU-02'));
    malo.objetos[0].ruta[0].x = 1.4;
    expect(validarGuion(malo, reglas).some((m) => m.includes('fuera de 0..1'))).toBe(true);
  });

  it('el validador rechaza una regla con umbral imposible', () => {
    const malas = structuredClone(reglas);
    malas.reglas[2].condicion.umbral = 30; // 30 en vez de 0,30
    expect(validarReglas(malas).length).toBeGreaterThan(0);
  });
});

describe('CU-02 · Almacén inteligente', () => {
  const g = casoPorId('CU-02');

  it('t 20–23: persona en zona restringida con el montacargas moviéndose cerca', () => {
    const restringida = region(g, 'restringida-1');
    for (const t of instantes(20, 23.7)) {
      const escena = escenaEn(g, t);
      const persona = figura(escena, 'persona-1');
      const montacargas = figura(escena, 'montacargas-1');
      expect(estaDentro(restringida, persona)).toBe(true);
      expect(montacargas.enMovimiento).toBe(true);
      expect(distancia(persona, montacargas)).toBeLessThan(0.2);
    }
    expect(figura(escenaEn(g, 19.5), 'persona-1') && estaDentro(restringida, figura(escenaEn(g, 19.5), 'persona-1'))).toBe(false);
  });

  it('t 30–50: zona de tránsito obstruida sobre el 30 %; antes y después, no', () => {
    for (const t of instantes(30, 49.9)) expect(ocupacionEn(g, t, 'transito-1')).toBeGreaterThan(0.3);
    for (const t of instantes(0, 29.9)) expect(ocupacionEn(g, t, 'transito-1')).toBeLessThan(0.3);
    for (const t of instantes(50, 60)) expect(ocupacionEn(g, t, 'transito-1')).toBeLessThan(0.3);
  });

  it('t 12–17: sube la ocupación del pasillo central; ningún pasillo pasa del 80 %', () => {
    expect(ocupacionEn(g, 14, 'pasillo-1')).toBeGreaterThan(ocupacionEn(g, 0, 'pasillo-1'));
    for (const t of instantes(0, 60)) {
      expect(ocupacionEn(g, t, 'pasillo-1')).toBeLessThan(0.8);
      expect(ocupacionEn(g, t, 'pasillo-2')).toBeLessThan(0.8);
    }
  });
});

describe('CU-04 · Flujo y ocupación en tienda', () => {
  const g = casoPorId('CU-04');
  const caja1 = region(g, 'caja-1');

  it('más de 6 personas en la caja 1 desde antes de t=30 hasta la apertura de la caja 2', () => {
    const conMasDe6 = instantes(0, 60).filter((t) => personasEn(escenaEn(g, t), caja1) > 6);
    expect(conMasDe6[0]).toBeGreaterThanOrEqual(29);
    expect(conMasDe6[0]).toBeLessThanOrEqual(30);
    expect(conMasDe6.at(-1)).toBeGreaterThanOrEqual(42);
    expect(conMasDe6.at(-1)).toBeLessThan(44);
  });

  it('los pasillos y la caja 2 nunca superan 6 personas (sin alertas falsas)', () => {
    for (const t of instantes(0, 60)) {
      const escena = escenaEn(g, t);
      for (const id of ['pasillo-1', 'pasillo-2', 'caja-2']) {
        expect(personasEn(escena, region(g, id))).toBeLessThanOrEqual(6);
      }
    }
  });

  it('nueve personas cruzan la línea de entrada', () => {
    const entrada = region(g, 'entrada-1');
    const cruzaron = new Set();
    for (const t of instantes(0, 60)) {
      for (const o of escenaEn(g, t).objetos) {
        if (o.clase === 'persona' && estaDentro(entrada, o)) cruzaron.add(o.id);
      }
    }
    expect(cruzaron.size).toBe(9);
  });

  it('la caja 2 se abre en t=42', () => {
    expect(escenaEn(g, 41.9).regiones.find((r) => r.id === 'caja-2').atributos.abierta).toBe(false);
    expect(escenaEn(g, 42).regiones.find((r) => r.id === 'caja-2').atributos.abierta).toBe(true);
  });
});

describe('CU-01 · Seguridad industrial', () => {
  const g = casoPorId('CU-01');
  const area = region(g, 'area-trabajo-1');

  it('t 8–14: el trabajador B está en el área sin casco; luego se lo pone', () => {
    for (const t of instantes(8, 13.9)) {
      const b = figura(escenaEn(g, t), 'trabajador-b');
      expect(estaDentro(area, b)).toBe(true);
      expect(b.atributos.casco).toBe(false);
    }
    expect(figura(escenaEn(g, 14), 'trabajador-b').atributos.casco).toBe(true);
  });

  it('t 22: el trabajador C, poco visible, está en el área', () => {
    const c = figura(escenaEn(g, 22), 'trabajador-c');
    expect(estaDentro(area, c)).toBe(true);
    expect(c.atributos.pocoVisible).toBe(true);
  });

  it('t 40–50: la salida de emergencia está bloqueada más del 50 %; antes de t=39, no', () => {
    for (const t of instantes(40, 50)) expect(ocupacionEn(g, t, 'salida-1')).toBeGreaterThan(0.5);
    for (const t of instantes(0, 39)) expect(ocupacionEn(g, t, 'salida-1')).toBeLessThan(0.5);
  });

  it('solo B incumple el EPP (A y C tienen casco y chaleco)', () => {
    for (const t of instantes(0, 60)) {
      for (const o of escenaEn(g, t).objetos) {
        if (o.clase !== 'persona' || o.id === 'trabajador-b') continue;
        expect(o.atributos.casco && o.atributos.chaleco).toBe(true);
      }
    }
  });
});

describe('CU-03 · Control de calidad', () => {
  const g = casoPorId('CU-03');
  const inspeccion = region(g, 'inspeccion-1');
  const proporcionDefecto = (p) => (p.atributos.defecto ? p.atributos.defecto.w * p.atributos.defecto.h : 0);

  it.each([
    [9, 'producto-2', 0.03],
    [21, 'producto-4', 0.01],
  ])('t %s: %s pasa por inspección con defecto del %s', (t, id, proporcion) => {
    const p = figura(escenaEn(g, t), id);
    expect(estaDentro(inspeccion, p)).toBe(true);
    expect(proporcionDefecto(p)).toBeCloseTo(proporcion, 6);
  });

  it('t 33: pasa por inspección el producto sin etiqueta', () => {
    const p = figura(escenaEn(g, 33), 'producto-6');
    expect(estaDentro(inspeccion, p)).toBe(true);
    expect(p.atributos.etiqueta).toBe(false);
  });

  it('resultado esperado: 2 no conformes y 1 conforme con observación', () => {
    const productos = g.objetos;
    const noConformes = productos.filter(
      (p) => proporcionDefecto(p) > 0.02 || !p.atributos.etiqueta || p.atributos.piezaFaltante,
    );
    const conObservacion = productos.filter((p) => proporcionDefecto(p) > 0 && proporcionDefecto(p) <= 0.02);
    expect(noConformes.map((p) => p.id)).toEqual(['producto-2', 'producto-6']);
    expect(conObservacion.map((p) => p.id)).toEqual(['producto-4']);
  });
});
