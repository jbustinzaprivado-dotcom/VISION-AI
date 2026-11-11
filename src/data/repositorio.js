// Capa de datos: guardar y leer sesiones, alertas, eventos y reglas.
// Aquí se aplican las reglas de integridad (Arquitectura, A5):
//   RI-01 todo resultado y toda alerta pertenecen a una sesión existente
//   RI-03 una sesión terminada no recibe resultados nuevos
//   RI-04 una alerta solo avanza nueva → revisada → cerrada (con observación)
//   RI-05 la sesión guarda caso, semilla y versión del guion (y de las reglas) para repetirla
import { db } from './db.js';
import reglasIniciales from '../rules/reglas.json';
import { validarReglas } from '../simulation/validar.js';
import { validarCambioAlerta } from '../rules/alertas.js';
import { puede } from '../auth/roles.js';
import { esFinal, puedeTransicionar } from './estadosSesion.js';
import { resumir } from './resumen.js';
import { procesarSesion } from '../rules/motorReglas.js';
import { CASOS } from '../simulation/casos.js';

// Destinatario de la bandeja simulada. No es una dirección real: nada se envía (decisión D1 pendiente).
export const DESTINATARIO_SIMULADO = 'Administrador (bandeja simulada)';

const ahora = () => new Date().toISOString();

// ---------- Reglas (versionadas: un cambio crea una versión nueva, RN-G4) ----------

// Guarda las reglas iniciales la primera vez. Se llama al abrir la aplicación
// (no dentro de una consulta en vivo, que solo puede leer).
export async function sembrarReglas() {
  if ((await db.reglas.count()) > 0) return;
  await db.reglas.bulkPut(reglasIniciales.reglas.map((r) => ({ ...r, creadaPor: 'sistema', creadaEn: ahora() })));
}

// La versión más reciente de cada regla. Solo lee: si todavía no se guardaron,
// devuelve las iniciales del archivo (son las mismas, versión 1).
export async function reglasVigentes() {
  const todas = await db.reglas.toArray();
  if (todas.length === 0) return reglasIniciales.reglas;
  const ultima = new Map();
  for (const r of todas) if (!ultima.has(r.id) || ultima.get(r.id).version < r.version) ultima.set(r.id, r);
  return [...ultima.values()].sort((a, b) => a.caso.localeCompare(b.caso) || a.id.localeCompare(b.id));
}

export async function historialRegla(id) {
  return (await db.reglas.where('id').equals(id).sortBy('version')).reverse();
}

// Guarda los cambios como una versión nueva. Las versiones anteriores no se tocan,
// así las sesiones que ya las usaron siguen siendo coherentes.
export async function guardarVersionRegla(id, cambios, usuario) {
  if (!puede(usuario.rol, 'configurarReglas')) throw new Error('Solo el administrador cambia reglas.');
  await sembrarReglas();
  const [actual] = await historialRegla(id);
  if (!actual) throw new Error(`No existe la regla ${id}.`);
  const nueva = {
    ...actual,
    ...cambios,
    condicion: { ...actual.condicion, ...(cambios.condicion ?? {}) },
    version: actual.version + 1,
    creadaPor: usuario.nombre,
    creadaEn: ahora(),
  };
  const errores = validarReglas({ reglas: [nueva] }).filter((e) => !e.includes('reemplaza'));
  if (errores.length) throw new Error(errores.join(' · '));
  await db.reglas.put(nueva);
  return nueva;
}

// ---------- Sesiones ----------

export async function crearSesion({ guion, semilla, velocidad, usuario, reglas }) {
  const momento = ahora();
  const sesion = {
    id: crypto.randomUUID(),
    caso: guion.caso,
    nombreCaso: guion.nombre,
    semilla,
    velocidad,
    versionGuion: guion.version,
    reglas: reglas.filter((r) => r.caso === guion.caso).map((r) => ({ id: r.id, version: r.version })),
    usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    origen: 'prototipo',
    // En el prototipo pasa de "en cola" a "preparada" y a "en ejecución" al instante.
    estado: 'en_ejecucion',
    historialEstados: [
      { estado: 'en_cola', en: momento },
      { estado: 'preparada', en: momento },
      { estado: 'en_ejecucion', en: momento },
    ],
    creadaEn: momento,
    actualizadaEn: momento,
    resumen: null,
  };
  await db.sesiones.add(sesion);
  return sesion;
}

export async function cambiarEstadoSesion(id, nuevo, resumen = null) {
  return db.transaction('rw', db.sesiones, db.correos, async () => {
    const sesion = await db.sesiones.get(id);
    if (!sesion) throw new Error('La sesión no existe.');
    if (sesion.estado === nuevo) return sesion;
    if (!puedeTransicionar(sesion.estado, nuevo)) {
      throw new Error(`La sesión está ${sesion.estado} y no puede pasar a ${nuevo}.`);
    }
    const momento = ahora();
    const cambios = {
      estado: nuevo,
      actualizadaEn: momento,
      historialEstados: [...sesion.historialEstados, { estado: nuevo, en: momento }],
    };
    if (resumen) cambios.resumen = resumen;
    await db.sesiones.update(id, cambios);
    if (nuevo === 'completada') await db.correos.put(correoResumen({ ...sesion, ...cambios }));
    return { ...sesion, ...cambios };
  });
}

// ---------- Bandeja de correo simulada (no se envía nada) ----------

function correoAlerta(alerta, sesion) {
  return {
    id: `correo|${alerta.id}`,
    tipo: 'alerta',
    sesion: sesion.id,
    alerta: alerta.id,
    para: DESTINATARIO_SIMULADO,
    asunto: `[PROTOTIPO] Alerta alta ${alerta.codigo} · ${sesion.caso} ${sesion.nombreCaso}`,
    cuerpo:
      `${alerta.mensaje}.\n` +
      `Segundo ${alerta.t.toFixed(1).replace('.', ',')} de la sesión (cuadro ${alerta.cuadro}), evidencia: ${alerta.objetivo}.\n` +
      `La alerta requiere revisión humana en la pantalla Alertas.`,
    estado: 'no enviado (simulado)',
    creadoEn: ahora(),
  };
}

function correoResumen(sesion) {
  const r = sesion.resumen ?? {};
  return {
    id: `correo|resumen|${sesion.id}`,
    tipo: 'resumen',
    sesion: sesion.id,
    para: DESTINATARIO_SIMULADO,
    asunto: `[PROTOTIPO] Sesión completada · ${sesion.caso} ${sesion.nombreCaso}`,
    cuerpo:
      `Sesión ejecutada por ${sesion.usuario.nombre} con la semilla ${sesion.semilla}.\n` +
      `Alertas: ${r.alertas ?? 0} · advertencias: ${r.advertencias ?? 0} · informativas: ${r.informativas ?? 0}.\n` +
      (r.descripcion ? `Resultado esperado del guion: ${r.descripcion}` : ''),
    estado: 'no enviado (simulado)',
    creadoEn: ahora(),
  };
}

// Guarda los eventos del motor de reglas. Es idempotente: guardar dos veces el mismo
// evento no crea duplicados ni pisa una alerta ya revisada.
export async function registrarEventos(sesionId, eventos) {
  if (eventos.length === 0) return;
  return db.transaction('rw', db.sesiones, db.alertas, db.eventos, db.correos, async () => {
    const sesion = await db.sesiones.get(sesionId);
    if (!sesion) throw new Error('RI-01: la sesión no existe.');
    if (esFinal(sesion.estado)) throw new Error('RI-03: la sesión ya terminó y no recibe resultados.');

    for (const e of eventos) {
      const id = `${sesionId}|${e.clave}`;
      if (e.tipo === 'alerta') {
        if (await db.alertas.get(id)) continue;
        const alerta = {
          ...e,
          id,
          sesion: sesionId,
          caso: sesion.caso,
          estado: 'nueva',
          situacion: 'activa',
          observacion: '',
          creadaEn: ahora(),
          revisadaPor: null,
          cerradaPor: null,
          version: 1, // contador de cambios de la alerta (no confundir con versionRegla)
        };
        await db.alertas.add(alerta);
        // Cada alerta alta deja en la bandeja simulada el aviso que recibiría el administrador.
        if (alerta.severidad === 'alta') await db.correos.put(correoAlerta(alerta, sesion));
      } else {
        await db.eventos.put({ ...e, id, sesion: sesionId, caso: sesion.caso });
        if (e.tipo === 'cierre') {
          // La situación terminó: la alerta queda pendiente de revisión, pero ya no está activa.
          const abiertas = await db.alertas.where('sesion').equals(sesionId).toArray();
          const alerta = abiertas.find((a) => a.regla === e.regla && a.objetivo === e.objetivo && a.situacion === 'activa');
          if (alerta) await db.alertas.update(alerta.id, { situacion: 'terminada', terminadaEn: e.t });
        }
      }
    }
  });
}

// ---------- Datos de ejemplo ----------

// Si el historial se borró (o es la primera vez), carga una sesión completada de cada caso,
// generada con la misma simulación. Quedan marcadas como datos de ejemplo.
export async function cargarDatosEjemplo(usuario) {
  const reglas = await reglasVigentes();
  for (const guion of CASOS) {
    const sesion = await crearSesion({ guion, semilla: guion.semilla, velocidad: 1, usuario, reglas });
    await db.sesiones.update(sesion.id, { ejemplo: true });
    const eventos = procesarSesion(guion, guion.semilla, reglas);
    await registrarEventos(sesion.id, eventos);
    await cambiarEstadoSesion(sesion.id, 'completada', resumir(guion, eventos));
  }
}

// ---------- Alertas ----------

export async function cambiarEstadoAlerta(id, nuevoEstado, observacion, usuario) {
  return db.transaction('rw', db.alertas, async () => {
    const alerta = await db.alertas.get(id);
    if (!alerta) throw new Error('La alerta no existe.');
    const error = validarCambioAlerta(alerta, nuevoEstado, observacion, usuario.rol);
    if (error) throw new Error(error);
    const quien = { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol, en: ahora() };
    const cambios = { estado: nuevoEstado, version: alerta.version + 1 };
    if (nuevoEstado === 'revisada') cambios.revisadaPor = quien;
    if (nuevoEstado === 'cerrada') {
      cambios.cerradaPor = quien;
      cambios.observacion = observacion.trim();
    }
    if (observacion && nuevoEstado === 'revisada') cambios.observacion = observacion.trim();
    await db.alertas.update(id, cambios);
    return { ...alerta, ...cambios };
  });
}
