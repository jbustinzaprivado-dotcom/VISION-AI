// Base de datos del navegador (IndexedDB) con Dexie.
// Todo queda en el navegador de quien usa la aplicación; no hay servidor.
import Dexie from 'dexie';

export const db = new Dexie('vision-ai');

// Índices: el primero es la clave; los demás permiten buscar y filtrar.
db.version(1).stores({
  sesiones: 'id, caso, estado, creadaEn, usuario.id',
  alertas: 'id, sesion, caso, estado, severidad, regla, creadaEn',
  eventos: 'id, sesion, caso, tipo, regla',
  reglas: '[id+version], id, caso',
});

// Versión 2 (fase 7): bandeja de correo simulada. Dexie conserva los datos de la versión 1.
db.version(2).stores({
  correos: 'id, sesion, tipo, creadoEn',
});
