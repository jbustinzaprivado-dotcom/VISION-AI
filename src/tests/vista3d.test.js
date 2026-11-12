// Vista 3D (DT-10): conversión al mundo 3D y escena de Three.js "sin pantalla".
import { describe, expect, it } from 'vitest';
import { ALTO_CINTA, MUNDO, aMundo, marcados, rumbo, ubicar } from '../vista3d/mapeo.js';
import { Escena3D } from '../vista3d/escena3d.js';
import { generarSeguridad } from '../simulation/generadorSeguridad.js';
import { generarCalidad } from '../simulation/generadorCalidad.js';
import { generarTienda } from '../simulation/generadorTienda.js';
import { escenaConRuido } from '../simulation/motor.js';
import { procesarSesion, alertasActivas } from '../rules/motorReglas.js';
import reglas from '../rules/reglas.json';

describe('mapeo al mundo 3D', () => {
  it('la escena 0..1 ocupa 16 × 9 m centrados en el origen', () => {
    expect(aMundo(0, 0)).toEqual({ x: -MUNDO.ancho / 2, z: -MUNDO.fondo / 2 });
    expect(aMundo(0.5, 0.5)).toEqual({ x: 0, z: 0 });
    expect(aMundo(1, 1)).toEqual({ x: MUNDO.ancho / 2, z: MUNDO.fondo / 2 });
  });

  it('los productos apoyan sobre la cinta; el resto, en el piso', () => {
    const cinta = { clase: 'cinta', x: 0, y: 0.4, w: 1, h: 0.2 };
    expect(ubicar({ clase: 'producto', x: 0.5, y: 0.5, w: 0.05, h: 0.1 }, [cinta]).base).toBe(ALTO_CINTA);
    expect(ubicar({ clase: 'producto', x: 0.5, y: 0.9, w: 0.05, h: 0.1 }, [cinta]).base).toBe(0);
    expect(ubicar({ clase: 'persona', x: 0.5, y: 0.5, w: 0.03, h: 0.1 }, [cinta]).base).toBe(0);
  });

  it('el rumbo sigue el movimiento y no tiembla con desplazamientos mínimos', () => {
    expect(rumbo({ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 })).toBeCloseTo(0); // hacia +x
    expect(Math.abs(rumbo({ x: 0.5, y: 0.5 }, { x: 0.4, y: 0.5 }))).toBeCloseTo(Math.PI); // hacia -x (±π es lo mismo)
    expect(rumbo({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.6 })).toBeCloseTo(-Math.PI / 2); // hacia el frente (+z)
    expect(rumbo({ x: 0.5, y: 0.5 }, { x: 0.501, y: 0.5 }, 1.2)).toBe(1.2);
    expect(rumbo(null, { x: 0.5, y: 0.5 }, 0.7)).toBe(0.7);
  });

  it('separa las alertas de figuras y de regiones', () => {
    const m = marcados([{ objetivo: 'p1' }, { objetivo: 'salida-1', tipoObjetivo: 'region' }]);
    expect([...m.figuras]).toEqual(['p1']);
    expect([...m.regiones]).toEqual(['salida-1']);
  });
});

// Figuras de la escena 3D (los grupos con id de figura).
const figuras3D = (e) => e.escena.children.filter((o) => o.userData.firma);

describe('escena 3D sincronizada con la simulación', () => {
  it('una figura 3D por objeto, en su lugar, y las regiones del guion', () => {
    const g = generarSeguridad(77, { trabajadores: 5, riesgo: 'alto' });
    const e = new Escena3D();
    for (const t of [0, 10, 30, 59]) {
      const escena = escenaConRuido(g, t, 77);
      e.sincronizar({ guion: g, escena });
      const f3 = figuras3D(e);
      expect(f3).toHaveLength(escena.objetos.length);
      for (const o of escena.objetos) {
        const grupo = f3.find((x) => x.userData.id === o.id);
        const u = ubicar(o, escena.regiones);
        expect(grupo.position.x).toBeCloseTo(u.x);
        expect(grupo.position.z).toBeCloseTo(u.z);
      }
    }
    expect(e.regiones.children).toHaveLength(g.regiones.filter((r) => r.clase !== 'suelo').length);
  });

  it('marca las alertas activas y las quita cuando se cierran', () => {
    const g = generarSeguridad(2026, { trabajadores: 6, riesgo: 'alto' });
    const eventos = procesarSesion(g, 2026, reglas.reglas);
    const e = new Escena3D();
    let vistas = 0;
    for (let t = 0; t <= g.duracion; t += 0.5) {
      const alertas = alertasActivas(eventos, t);
      e.sincronizar({ guion: g, escena: escenaConRuido(g, t, 2026), alertas });
      expect(e.marcas.size).toBeLessThanOrEqual(alertas.length);
      vistas = Math.max(vistas, e.marcas.size);
    }
    expect(vistas).toBeGreaterThan(0);
    e.sincronizar({ guion: g, escena: escenaConRuido(g, 0, 2026), alertas: [] });
    expect(e.marcas.size).toBe(0);
  });

  it('los productos van sobre la cinta y los poco visibles son translúcidos', () => {
    const g = generarCalidad(5, { cadencia: 'alta' });
    const e = new Escena3D();
    e.sincronizar({ guion: g, escena: escenaConRuido(g, 20, 5) });
    const productos = figuras3D(e).filter((x) => x.userData.clase === 'producto');
    expect(productos.length).toBeGreaterThan(0);
    for (const p of productos) expect(p.position.y).toBe(ALTO_CINTA);

    const planta = generarSeguridad(3, { trabajadores: 6, riesgo: 'alto' });
    const poco = planta.objetos.find((o) => o.atributos?.pocoVisible || o.cambios?.some((c) => c.atributos?.pocoVisible));
    if (poco) {
      for (let t = 0; t <= planta.duracion; t += 1) {
        const escena = escenaConRuido(planta, t, 3);
        const o = escena.objetos.find((x) => x.id === poco.id);
        if (!o?.atributos?.pocoVisible) continue;
        e.sincronizar({ guion: planta, escena });
        const grupo = figuras3D(e).find((x) => x.userData.id === poco.id);
        grupo.traverse((m) => m.isMesh && expect(m.material.opacity).toBeLessThan(0.5));
        break;
      }
    }
  });

  it('al cambiar de escena descarta las figuras anteriores', () => {
    const e = new Escena3D();
    const a = generarTienda(8, { afluencia: 'alta' });
    e.sincronizar({ guion: a, escena: escenaConRuido(a, 30, 8) });
    const b = generarCalidad(8);
    const escenaB = escenaConRuido(b, 5, 8);
    e.sincronizar({ guion: b, escena: escenaB });
    expect(figuras3D(e)).toHaveLength(escenaB.objetos.length);
    expect(figuras3D(e).every((x) => x.userData.clase === 'producto')).toBe(true);
  });
});
