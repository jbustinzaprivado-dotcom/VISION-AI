// Fase 3: reloj de simulación y motor de escenas con semilla.
import { describe, expect, it } from 'vitest';
import * as R from '../simulation/reloj.js';
import { RUIDO, generarCuadro, totalCuadros, eventoActual } from '../simulation/motor.js';
import { escenaEn } from '../simulation/trayectoria.js';
import { CASOS, casoPorId } from '../simulation/casos.js';

describe('reloj de simulación', () => {
  it('empieza en pausa y no avanza hasta iniciar', () => {
    const r = R.crearReloj(60);
    expect(R.avanzar(r, 1).t).toBe(0);
    expect(R.avanzar(R.iniciar(r), 1).t).toBe(1);
  });

  it('la velocidad multiplica el avance (0,5×, 1×, 2×, 4×)', () => {
    let r = R.iniciar(R.crearReloj(60));
    r = R.cambiarVelocidad(r, 4);
    expect(R.avanzar(r, 1).t).toBe(4);
    r = R.cambiarVelocidad(r, 0.5);
    expect(R.avanzar(r, 1).t).toBe(0.5);
    expect(() => R.cambiarVelocidad(r, 3)).toThrow();
  });

  it('se detiene en la duración y no se reanuda una vez completada', () => {
    let r = R.avanzar(R.iniciar(R.crearReloj(60)), 100);
    expect(r.t).toBe(60);
    expect(r.terminado).toBe(true);
    expect(r.pausado).toBe(true);
    expect(R.iniciar(r).pausado).toBe(true);
  });

  it('PF-04: paso a paso avanza exactamente un cuadro y deja en pausa', () => {
    let r = R.iniciar(R.crearReloj(60));
    r = R.pasoAPaso(r);
    expect(r.pausado).toBe(true);
    expect(R.indiceCuadro(r.t)).toBe(1);
    r = R.pasoAPaso(r);
    expect(R.indiceCuadro(r.t)).toBe(2);
  });

  it('saltar en la línea de tiempo limita al rango y pausa', () => {
    const r = R.saltarA(R.iniciar(R.crearReloj(60)), 75);
    expect(r.t).toBe(60);
    expect(R.saltarA(r, -3).t).toBe(0);
  });

  it('reiniciar vuelve a 0 y conserva la velocidad elegida', () => {
    const r = R.reiniciar(R.cambiarVelocidad(R.saltarA(R.crearReloj(60), 30), 2));
    expect(r.t).toBe(0);
    expect(r.velocidad).toBe(2);
  });
});

describe('motor de escenas con semilla', () => {
  it(`la frecuencia es de 10 a 15 cuadros por segundo (${R.FPS})`, () => {
    expect(R.FPS).toBeGreaterThanOrEqual(10);
    expect(R.FPS).toBeLessThanOrEqual(15);
  });

  it.each(CASOS.map((c) => [c.caso, c]))('PF-02 · %s: la misma semilla produce la misma sesión', (_, guion) => {
    for (let i = 0; i < totalCuadros(guion); i++) {
      expect(generarCuadro(guion, i, 2026)).toEqual(generarCuadro(guion, i, 2026));
    }
  });

  it('otra semilla produce otra variación', () => {
    const g = casoPorId('CU-04');
    const a = generarCuadro(g, 300, 2026);
    const b = generarCuadro(g, 300, 7);
    expect(a.objetos).not.toEqual(b.objetos);
  });

  it('saltar a un cuadro da lo mismo que reproducir hasta él', () => {
    const g = casoPorId('CU-02');
    const recorridos = [];
    for (let i = 0; i <= 250; i++) recorridos.push(generarCuadro(g, i, 2026));
    expect(generarCuadro(g, 250, 2026)).toEqual(recorridos[250]);
  });

  it('el ruido es pequeño y las coordenadas siguen entre 0 y 1', () => {
    for (const g of CASOS) {
      for (let i = 0; i < totalCuadros(g); i += 7) {
        const cuadro = generarCuadro(g, i, 2026);
        const real = escenaEn(g, cuadro.t);
        for (const o of cuadro.objetos) {
          const original = real.objetos.find((x) => x.id === o.id);
          expect(Math.abs(o.x - original.x)).toBeLessThanOrEqual(RUIDO + 1e-12);
          expect(Math.abs(o.y - original.y)).toBeLessThanOrEqual(RUIDO + 1e-12);
          expect(o.x).toBeGreaterThanOrEqual(0);
          expect(o.x).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('las figuras quietas que no son personas no se mueven', () => {
    const g = casoPorId('CU-02');
    const caja = (i) => generarCuadro(g, i, 2026).objetos.find((o) => o.id === 'caja-1');
    expect(caja(5)).toEqual(caja(500));
  });

  it('el subtítulo muestra el último evento ocurrido', () => {
    const g = casoPorId('CU-01');
    expect(eventoActual(g, 9).t).toBe(8);
    expect(eventoActual(g, 45.5).t).toBe(45);
  });
});
