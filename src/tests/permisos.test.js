import { describe, expect, it } from 'vitest';
import { alcanceExportacion, esSoloLectura, puede } from '../auth/roles.js';
import { MENU } from '../app/menu.js';

describe('matriz de permisos (Proyecto, sección 9)', () => {
  it('PF-01: el operador no puede abrir la pantalla de reglas', () => {
    expect(puede('operador', 'configurarReglas')).toBe(false);
    const reglas = MENU.find((m) => m.ruta === '/reglas');
    expect(puede('operador', reglas.permiso)).toBe(false);
  });

  it('solo el administrador configura reglas', () => {
    expect(puede('administrador', 'configurarReglas')).toBe(true);
    expect(puede('supervisor', 'configurarReglas')).toBe(false);
    expect(puede('auditor', 'configurarReglas')).toBe(false);
  });

  it('el auditor no ejecuta casos ni revisa alertas, pero consulta', () => {
    expect(puede('auditor', 'ejecutarCasos')).toBe(false);
    expect(puede('auditor', 'revisarAlertas')).toBe(false);
    expect(puede('auditor', 'verHistorial')).toBe(true);
    expect(esSoloLectura('auditor')).toBe(true);
  });

  it('cerrar alertas: administrador y supervisor, no el operador', () => {
    expect(puede('supervisor', 'cerrarAlertas')).toBe(true);
    expect(puede('operador', 'cerrarAlertas')).toBe(false);
    expect(puede('operador', 'revisarAlertas')).toBe(true);
  });

  it('el operador exporta solo lo propio; los demás, todo', () => {
    expect(alcanceExportacion('operador')).toBe('propios');
    expect(alcanceExportacion('auditor')).toBe('todos');
  });

  it('un permiso inexistente es un error, no un "no" silencioso', () => {
    expect(() => puede('administrador', 'borrarTodo')).toThrow();
  });
});
