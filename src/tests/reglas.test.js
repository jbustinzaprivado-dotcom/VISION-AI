// Fase 6: el motor de reglas crea cada alerta en el momento correcto (PF-05),
// sin duplicados (RN-G2), y respeta duraciones, reemplazos y reglas desactivadas.
import { describe, expect, it } from 'vitest';
import reglas from '../rules/reglas.json';
import { alertasActivas, procesarSesion } from '../rules/motorReglas.js';
import { CASOS, casoPorId } from '../simulation/casos.js';

const SEMILLA = 2026;
const TOLERANCIA = 0.5; // segundos, salvo que el guion indique otra
const sesiones = Object.fromEntries(CASOS.map((c) => [c.caso, procesarSesion(c, SEMILLA, reglas.reglas)]));
const deTipo = (caso, tipo) => sesiones[caso].filter((e) => e.tipo === tipo);

describe.each(CASOS.map((c) => [c.caso, c]))('%s: eventos según el guion', (caso, guion) => {
  it('PF-05: las alertas son exactamente las esperadas, en su segundo', () => {
    const alertas = deTipo(caso, 'alerta');
    expect(alertas.map((a) => a.regla).sort()).toEqual(guion.esperado.alertas.map((a) => a.regla).sort());
    for (const esperada of guion.esperado.alertas) {
      const a = alertas.find((x) => x.regla === esperada.regla);
      expect(Math.abs(a.t - esperada.t)).toBeLessThanOrEqual(esperada.tolerancia ?? TOLERANCIA);
      if (esperada.objeto) expect(a.objetivo).toBe(esperada.objeto);
      if (esperada.region) expect(a.objetivo).toBe(esperada.region);
    }
  });

  it('las advertencias son exactamente las esperadas', () => {
    const adv = deTipo(caso, 'advertencia');
    expect(adv.map((a) => a.regla)).toEqual(guion.esperado.advertencias.map((a) => a.regla));
    for (const esperada of guion.esperado.advertencias) {
      const a = adv.find((x) => x.regla === esperada.regla);
      expect(Math.abs(a.t - esperada.t)).toBeLessThanOrEqual(esperada.tolerancia ?? TOLERANCIA);
    }
  });

  it('aparecen las informativas esperadas', () => {
    const info = deTipo(caso, 'informativa');
    for (const esperada of guion.esperado.informativas) {
      const deRegla = info.filter((x) => x.regla === esperada.regla);
      if (esperada.conteo != null) expect(deRegla).toHaveLength(esperada.conteo);
      else {
        const a = deRegla.find((x) => !esperada.objeto || x.objetivo === esperada.objeto);
        expect(a).toBeDefined();
        expect(Math.abs(a.t - esperada.t)).toBeLessThanOrEqual(esperada.tolerancia ?? TOLERANCIA);
      }
    }
  });

  it('PF-05: sin duplicados, una alerta por situación (RN-G2)', () => {
    const claves = deTipo(caso, 'alerta').map((a) => `${a.regla}|${a.objetivo}`);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('la misma semilla produce los mismos eventos', () => {
    expect(procesarSesion(guion, SEMILLA, reglas.reglas)).toEqual(sesiones[caso]);
  });
});

describe('comportamiento del motor', () => {
  it('RN-02.2 reemplaza a RN-02.1: no hay alerta leve para la misma persona', () => {
    expect(deTipo('CU-02', 'alerta').some((a) => a.regla === 'RN-02.1')).toBe(false);
  });

  it('cuando la situación termina se registra el cierre (el casco de B en t=14)', () => {
    const cierre = deTipo('CU-01', 'cierre').find((e) => e.regla === 'RN-01.1-casco');
    expect(cierre.t).toBeCloseTo(14, 0);
  });

  it('alertas activas: la de EPP está activa en t=12 y ya no en t=15', () => {
    const ev = sesiones['CU-01'];
    expect(alertasActivas(ev, 12).map((a) => a.regla)).toContain('RN-01.1-casco');
    expect(alertasActivas(ev, 15).map((a) => a.regla)).not.toContain('RN-01.1-casco');
  });

  it('CU-03: clasificación de los productos', () => {
    const porProducto = Object.fromEntries(
      sesiones['CU-03'].filter((e) => e.clasificacion).map((e) => [e.objetivo, e.clasificacion]),
    );
    expect(porProducto).toEqual({
      'producto-2': 'No conforme',
      'producto-4': 'Conforme con observación',
      'producto-6': 'No conforme',
    });
  });

  it('una regla desactivada no genera alertas', () => {
    const sinCongestion = reglas.reglas.map((r) => (r.id === 'RN-04.1' ? { ...r, activa: false } : r));
    const ev = procesarSesion(casoPorId('CU-04'), SEMILLA, sinCongestion);
    expect(ev.some((e) => e.regla === 'RN-04.1')).toBe(false);
  });

  it('un umbral distinto cambia el resultado (PF-08: se aplica en la sesión que lo usa)', () => {
    const masEstricta = reglas.reglas.map((r) =>
      r.id === 'RN-04.1' ? { ...r, condicion: { ...r.condicion, umbral: 8 }, version: 2 } : r,
    );
    const ev = procesarSesion(casoPorId('CU-04'), SEMILLA, masEstricta);
    expect(ev.some((e) => e.regla === 'RN-04.1')).toBe(false);
  });

  it('una duración más larga retrasa la alerta (RN-G1)', () => {
    const lenta = reglas.reglas.map((r) => (r.id === 'RN-02.3' ? { ...r, duracion: 10 } : r));
    const a = procesarSesion(casoPorId('CU-02'), SEMILLA, lenta).find((e) => e.regla === 'RN-02.3');
    expect(a.t).toBeCloseTo(40, 0);
  });
});
