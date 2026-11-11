// Pantallas del menú lateral y el permiso que exige cada una.
// El menú solo muestra las opciones que el rol puede abrir,
// y la ruta vuelve a comprobar el permiso por si se escribe la dirección a mano.

export const MENU = [
  { ruta: '/', etiqueta: 'Inicio', permiso: 'verDashboard' },
  { ruta: '/analisis', etiqueta: 'Análisis visual', permiso: 'ejecutarCasos' },
  { ruta: '/entrenamiento', etiqueta: 'Entrenamiento', permiso: 'ejecutarCasos' },
  { ruta: '/alertas', etiqueta: 'Alertas', permiso: 'verAlertas' },
  { ruta: '/historial', etiqueta: 'Historial', permiso: 'verHistorial' },
  { ruta: '/reglas', etiqueta: 'Reglas', permiso: 'configurarReglas' },
  { ruta: '/bandeja', etiqueta: 'Bandeja simulada', permiso: 'verBandeja' },
];
