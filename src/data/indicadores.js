// Indicadores del dashboard. Se calculan SIEMPRE desde las sesiones y alertas
// guardadas (nada de números fijos), así coinciden con los datos (PF-09).

export const ORDEN_CASOS = ['CU-02', 'CU-04', 'CU-01', 'CU-03'];

export function calcularIndicadores(sesiones, alertas) {
  const completadas = sesiones.filter((s) => s.estado === 'completada');
  const contarPor = (lista, campo) => lista.reduce((acc, x) => ({ ...acc, [x[campo]]: (acc[x[campo]] ?? 0) + 1 }), {});

  // Calidad: tasa de conformidad = productos conformes ÷ productos inspeccionados (sesiones completadas de CU-03).
  const calidad = completadas.filter((s) => s.caso === 'CU-03' && s.resumen);
  const productos = calidad.reduce((s, x) => s + (x.resumen.productos ?? 0), 0);
  const noConformes = calidad.reduce((s, x) => s + (x.resumen.clasificaciones?.['No conforme'] ?? 0), 0);

  return {
    sesiones: {
      total: sesiones.length,
      completadas: completadas.length,
      canceladas: sesiones.filter((s) => s.estado === 'cancelada').length,
      enCurso: sesiones.filter((s) => s.estado === 'en_ejecucion' || s.estado === 'pausada').length,
    },
    alertas: {
      total: alertas.length,
      nuevas: alertas.filter((a) => a.estado === 'nueva').length,
      revisadas: alertas.filter((a) => a.estado === 'revisada').length,
      cerradas: alertas.filter((a) => a.estado === 'cerrada').length,
      pendientes: alertas.filter((a) => a.estado !== 'cerrada').length,
      porSeveridad: contarPor(alertas, 'severidad'),
    },
    porCaso: ORDEN_CASOS.map((caso) => ({
      caso,
      sesiones: completadas.filter((s) => s.caso === caso).length,
      alertas: alertas.filter((a) => a.caso === caso).length,
      pendientes: alertas.filter((a) => a.caso === caso && a.estado !== 'cerrada').length,
    })),
    afluencia: completadas.filter((s) => s.caso === 'CU-04').reduce((s, x) => s + (x.resumen?.afluencia ?? 0), 0),
    conformidad: productos > 0 ? { productos, noConformes, tasa: (productos - noConformes) / productos } : null,
  };
}
