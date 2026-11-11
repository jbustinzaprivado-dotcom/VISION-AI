// Fase 6: datos guardados en el navegador (IndexedDB simulada en las pruebas).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../data/db.js';
import {
  cambiarEstadoAlerta,
  cambiarEstadoSesion,
  crearSesion,
  guardarVersionRegla,
  historialRegla,
  registrarEventos,
  reglasVigentes,
} from '../data/repositorio.js';
import { esFinal, puedeTransicionar } from '../data/estadosSesion.js';
import { perteneceASesion } from '../data/useSesionAnalisis.js';
import { procesarSesion } from '../rules/motorReglas.js';
import { casoPorId } from '../simulation/casos.js';
import { USUARIOS_EJEMPLO } from '../auth/roles.js';

const usuario = (rol) => USUARIOS_EJEMPLO.find((u) => u.rol === rol);
const guion = casoPorId('CU-01');

async function sesionConAlertas() {
  const reglas = await reglasVigentes();
  const sesion = await crearSesion({ guion, semilla: 2026, velocidad: 1, usuario: usuario('operador'), reglas });
  await registrarEventos(sesion.id, procesarSesion(guion, 2026, reglas));
  return sesion;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('sesión de la pantalla de análisis', () => {
  it('una sesión solo recibe eventos de su caso y su semilla (cambio de caso sin aviso RI-03)', () => {
    const sesion = { id: 's1', caso: 'CU-04', semilla: 2026 };
    expect(perteneceASesion(sesion, casoPorId('CU-04'), 2026)).toBe(true);
    expect(perteneceASesion(sesion, casoPorId('CU-01'), 2026)).toBe(false); // se cambió de caso
    expect(perteneceASesion(sesion, casoPorId('CU-04'), 7)).toBe(false); // se cambió la semilla
    expect(perteneceASesion(null, casoPorId('CU-04'), 2026)).toBe(false);
  });
});

describe('estados de la sesión', () => {
  it('solo avanza; los estados finales no se reabren', () => {
    expect(puedeTransicionar('en_ejecucion', 'pausada')).toBe(true);
    expect(puedeTransicionar('pausada', 'en_ejecucion')).toBe(true);
    expect(puedeTransicionar('completada', 'en_ejecucion')).toBe(false);
    expect(puedeTransicionar('cancelada', 'pausada')).toBe(false);
    expect(esFinal('fallida')).toBe(true);
  });

  it('crear una sesión guarda caso, semilla y versiones de guion y reglas (RI-05)', async () => {
    const s = await sesionConAlertas();
    const guardada = await db.sesiones.get(s.id);
    expect(guardada).toMatchObject({ caso: 'CU-01', semilla: 2026, versionGuion: 1, estado: 'en_ejecucion' });
    expect(guardada.reglas.every((r) => r.version === 1)).toBe(true);
    expect(guardada.historialEstados.map((h) => h.estado)).toEqual(['en_cola', 'preparada', 'en_ejecucion']);
  });

  it('una sesión completada no se reanuda ni recibe resultados (RI-03)', async () => {
    const s = await sesionConAlertas();
    await cambiarEstadoSesion(s.id, 'completada');
    await expect(cambiarEstadoSesion(s.id, 'en_ejecucion')).rejects.toThrow();
    await expect(registrarEventos(s.id, [{ tipo: 'alerta', clave: 'x' }])).rejects.toThrow('RI-03');
  });

  it('no se guardan eventos de una sesión inexistente (RI-01)', async () => {
    await expect(registrarEventos('no-existe', [{ tipo: 'alerta', clave: 'x' }])).rejects.toThrow('RI-01');
  });
});

describe('alertas guardadas', () => {
  it('registrar dos veces los mismos eventos no duplica alertas', async () => {
    const s = await sesionConAlertas();
    await registrarEventos(s.id, procesarSesion(guion, 2026, await reglasVigentes()));
    expect(await db.alertas.where('sesion').equals(s.id).count()).toBe(2);
  });

  it('el cierre de la situación marca la alerta como terminada, sin cerrarla', async () => {
    const s = await sesionConAlertas();
    const epp = (await db.alertas.toArray()).find((a) => a.regla === 'RN-01.1-casco');
    expect(epp.situacion).toBe('terminada');
    expect(epp.estado).toBe('nueva');
  });

  it('PF-06: el operador revisa y el supervisor cierra con observación', async () => {
    await sesionConAlertas();
    const [a] = await db.alertas.toArray();
    await cambiarEstadoAlerta(a.id, 'revisada', '', usuario('operador'));
    const cerrada = await cambiarEstadoAlerta(a.id, 'cerrada', 'Se verificó con el turno', usuario('supervisor'));
    expect(cerrada.estado).toBe('cerrada');
    expect(cerrada.revisadaPor.rol).toBe('operador');
    expect(cerrada.cerradaPor.rol).toBe('supervisor');
    expect(cerrada.observacion).toBe('Se verificó con el turno');
    expect(cerrada.versionRegla).toBe(1); // la versión de la regla no cambia al revisar
    expect(cerrada.version).toBe(3); // la alerta sí registra sus dos cambios
  });

  it('PF-07: cerrar como operador o sin observación se rechaza', async () => {
    await sesionConAlertas();
    const [a] = await db.alertas.toArray();
    await cambiarEstadoAlerta(a.id, 'revisada', '', usuario('operador'));
    await expect(cambiarEstadoAlerta(a.id, 'cerrada', 'ok', usuario('operador'))).rejects.toThrow('supervisor');
    await expect(cambiarEstadoAlerta(a.id, 'cerrada', '   ', usuario('supervisor'))).rejects.toThrow('observación');
  });

  it('no se salta ni retrocede de estado (RI-04); el auditor no revisa', async () => {
    await sesionConAlertas();
    const [a] = await db.alertas.toArray();
    await expect(cambiarEstadoAlerta(a.id, 'cerrada', 'x', usuario('supervisor'))).rejects.toThrow('ciclo');
    await expect(cambiarEstadoAlerta(a.id, 'revisada', '', usuario('auditor'))).rejects.toThrow();
  });
});

describe('reglas versionadas (RN-G4)', () => {
  it('leer las reglas no escribe (se puede usar en una consulta en vivo)', async () => {
    await db.transaction('r', db.reglas, async () => {
      const reglas = await reglasVigentes();
      expect(reglas.length).toBeGreaterThan(0);
    });
    expect(await db.reglas.count()).toBe(0);
  });

  it('PF-08: cambiar el umbral crea una versión nueva y conserva la anterior', async () => {
    await reglasVigentes();
    const nueva = await guardarVersionRegla('RN-04.1', { condicion: { umbral: 8 } }, usuario('administrador'));
    expect(nueva.version).toBe(2);
    expect(nueva.condicion).toMatchObject({ tipo: 'conteo', umbral: 8 });
    const historial = await historialRegla('RN-04.1');
    expect(historial.map((r) => r.version)).toEqual([2, 1]);
    expect(historial[1].condicion.umbral).toBe(6);
    expect((await reglasVigentes()).find((r) => r.id === 'RN-04.1').version).toBe(2);
  });

  it('una sesión creada antes del cambio conserva la versión que usó', async () => {
    const reglas = await reglasVigentes();
    const s = await crearSesion({ guion: casoPorId('CU-04'), semilla: 2026, velocidad: 1, usuario: usuario('operador'), reglas });
    await guardarVersionRegla('RN-04.1', { duracion: 8 }, usuario('administrador'));
    const guardada = await db.sesiones.get(s.id);
    expect(guardada.reglas.find((r) => r.id === 'RN-04.1').version).toBe(1);
  });

  it('solo el administrador cambia reglas y los valores imposibles se rechazan', async () => {
    await reglasVigentes();
    await expect(guardarVersionRegla('RN-04.1', { duracion: 2 }, usuario('supervisor'))).rejects.toThrow('administrador');
    await expect(guardarVersionRegla('RN-02.3', { condicion: { umbral: 30 } }, usuario('administrador'))).rejects.toThrow();
  });
});
