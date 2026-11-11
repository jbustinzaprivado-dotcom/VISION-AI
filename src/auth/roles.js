// Roles y permisos del prototipo (Proyecto, sección 9).
// El inicio de sesión es simulado: el usuario elige un rol de ejemplo
// y la aplicación solo muestra lo que ese rol puede hacer.

export const ROLES = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  auditor: 'Auditor',
};

// Usuarios de ejemplo, uno por rol. No son personas reales.
export const USUARIOS_EJEMPLO = [
  { id: 'u-admin', nombre: 'Administrador de ejemplo', rol: 'administrador' },
  { id: 'u-super', nombre: 'Supervisor de ejemplo', rol: 'supervisor' },
  { id: 'u-oper', nombre: 'Operador de ejemplo', rol: 'operador' },
  { id: 'u-audit', nombre: 'Auditor de ejemplo', rol: 'auditor' },
];

// Matriz de permisos. Cada permiso lista los roles que lo tienen.
// exportarCSV distingue entre exportar todo y exportar solo lo propio.
export const PERMISOS = {
  ejecutarCasos: ['administrador', 'supervisor', 'operador'],
  verDashboard: ['administrador', 'supervisor', 'operador', 'auditor'],
  verHistorial: ['administrador', 'supervisor', 'operador', 'auditor'],
  verAlertas: ['administrador', 'supervisor', 'operador', 'auditor'],
  revisarAlertas: ['administrador', 'supervisor', 'operador'],
  cerrarAlertas: ['administrador', 'supervisor'],
  exportarCSV: ['administrador', 'supervisor', 'operador', 'auditor'],
  configurarReglas: ['administrador'],
  // La bandeja simulada muestra los avisos que recibiría el administrador.
  verBandeja: ['administrador'],
};

export function puede(rol, permiso) {
  const roles = PERMISOS[permiso];
  if (!roles) throw new Error(`Permiso desconocido: ${permiso}`);
  return roles.includes(rol);
}

// El operador solo exporta sus propias sesiones; los demás, todo.
export function alcanceExportacion(rol) {
  if (!puede(rol, 'exportarCSV')) return 'ninguno';
  return rol === 'operador' ? 'propios' : 'todos';
}

// El auditor ve, pero no cambia nada.
export function esSoloLectura(rol) {
  return rol === 'auditor';
}
