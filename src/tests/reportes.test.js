// Fase 7: dashboard, historial, CSV y bandeja simulada.
// Criterio de salida: los indicadores coinciden con los datos guardados (PF-09).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../data/db.js';
import { cambiarEstadoAlerta, cargarDatosEjemplo } from '../data/repositorio.js';
import { calcularIndicadores } from '../data/indicadores.js';
import { COLUMNAS_ALERTAS, COLUMNAS_SESIONES, aCSV } from '../data/csv.js';
import { USUARIOS_EJEMPLO, puede } from '../auth/roles.js';

const usuario = (rol) => USUARIOS_EJEMPLO.find((u) => u.rol === rol);
const leer = async () => [await db.sesiones.toArray(), await db.alertas.toArray()];

beforeEach(async () => {
  await db.delete();
  await db.open();
  await cargarDatosEjemplo(usuario('operador'));
});

describe('indicadores del dashboard', () => {
  it('PF-09: coinciden con las cuatro sesiones de ejemplo', async () => {
    const ind = calcularIndicadores(...(await leer()));
    expect(ind.sesiones).toMatchObject({ total: 4, completadas: 4, canceladas: 0 });
    // CU-02: 2 · CU-04: 1 · CU-01: 2 · CU-03: 2
    expect(ind.alertas).toMatchObject({ total: 7, nuevas: 7, pendientes: 7, cerradas: 0 });
    expect(ind.alertas.porSeveridad).toEqual({ alta: 4, media: 3 });
    expect(ind.porCaso.map((c) => [c.caso, c.alertas])).toEqual([
      ['CU-02', 2],
      ['CU-04', 1],
      ['CU-01', 2],
      ['CU-03', 2],
    ]);
    expect(ind.afluencia).toBe(9);
    expect(ind.conformidad).toEqual({ productos: 9, noConformes: 2, tasa: 7 / 9 });
  });

  it('PF-09: el total de alertas es la suma de los resúmenes de las sesiones', async () => {
    const [sesiones, alertas] = await leer();
    const suma = sesiones.reduce((s, x) => s + x.resumen.alertas, 0);
    expect(calcularIndicadores(sesiones, alertas).alertas.total).toBe(suma);
  });

  it('cerrar una alerta se refleja en los indicadores', async () => {
    const [a] = await db.alertas.toArray();
    await cambiarEstadoAlerta(a.id, 'revisada', '', usuario('operador'));
    await cambiarEstadoAlerta(a.id, 'cerrada', 'Atendida', usuario('supervisor'));
    const ind = calcularIndicadores(...(await leer()));
    expect(ind.alertas).toMatchObject({ cerradas: 1, pendientes: 6 });
  });

  it('sin datos no hay divisiones entre cero', () => {
    const ind = calcularIndicadores([], []);
    expect(ind.sesiones.total).toBe(0);
    expect(ind.conformidad).toBeNull();
  });
});

describe('bandeja de correo simulada', () => {
  it('un aviso por cada alerta alta y un resumen por sesión completada; nada se envía', async () => {
    const correos = await db.correos.toArray();
    expect(correos.filter((c) => c.tipo === 'alerta')).toHaveLength(4);
    expect(correos.filter((c) => c.tipo === 'resumen')).toHaveLength(4);
    for (const c of correos) {
      expect(c.estado).toBe('no enviado (simulado)');
      expect(c.asunto).toContain('[PROTOTIPO]');
    }
  });

  it('solo el administrador ve la bandeja', () => {
    expect(puede('administrador', 'verBandeja')).toBe(true);
    for (const rol of ['supervisor', 'operador', 'auditor']) expect(puede(rol, 'verBandeja')).toBe(false);
  });
});

describe('exportación CSV', () => {
  const meta = { reporte: 'Prueba', usuario: 'Operador de ejemplo', fecha: '2026-11-10', filtros: 'caso=todos' };

  it('PF-09: el CSV lleva la marca PROTOTIPO, quién lo generó, los filtros y todas las columnas', async () => {
    const [sesiones] = await leer();
    const lineas = aCSV(sesiones, COLUMNAS_SESIONES, meta).split('\r\n');
    expect(lineas[0]).toContain('PROTOTIPO');
    expect(lineas[0]).toContain('Operador de ejemplo');
    expect(lineas[0]).toContain('caso=todos');
    expect(lineas[1].split(';')).toEqual(COLUMNAS_SESIONES.map((c) => c.titulo));
    expect(lineas).toHaveLength(2 + sesiones.length);
    expect(lineas.slice(2).every((l) => l.endsWith(';PROTOTIPO'))).toBe(true);
  });

  it('el reporte de alertas tiene una fila por alerta', async () => {
    const [, alertas] = await leer();
    expect(aCSV(alertas, COLUMNAS_ALERTAS, meta).split('\r\n')).toHaveLength(2 + alertas.length);
  });

  it('los textos con ";", comillas o saltos de línea se escapan', () => {
    const csv = aCSV([{ x: 'a;b "c"\nd' }], [{ titulo: 'x', valor: (f) => f.x }]);
    expect(csv.split('\r\n')[1]).toBe('"a;b ""c""\nd"');
  });

  it('10 000 filas se generan en menos de 5 segundos', async () => {
    const [, alertas] = await leer();
    const muchas = Array.from({ length: 10000 }, (_, i) => ({ ...alertas[i % alertas.length], id: `a${i}` }));
    const inicio = performance.now();
    const csv = aCSV(muchas, COLUMNAS_ALERTAS, meta);
    expect(performance.now() - inicio).toBeLessThan(5000);
    expect(csv.split('\r\n')).toHaveLength(10002);
  });
});
