// Resumen que se guarda al completar una sesión (lo usan el historial y el dashboard).
export function resumir(guion, eventos) {
  const cuenta = (tipo) => eventos.filter((e) => e.tipo === tipo).length;
  const sumarPor = (lista, campo) => lista.reduce((acc, e) => ({ ...acc, [e[campo]]: (acc[e[campo]] ?? 0) + 1 }), {});
  return {
    alertas: cuenta('alerta'),
    advertencias: cuenta('advertencia'),
    informativas: cuenta('informativa'),
    porSeveridad: sumarPor(eventos.filter((e) => e.tipo === 'alerta'), 'severidad'),
    afluencia: eventos.filter((e) => e.regla === 'RN-04.2').length,
    // Los eventos de cierre repiten la clasificación de su alerta: no se cuentan dos veces.
    clasificaciones: sumarPor(eventos.filter((e) => e.clasificacion && e.tipo !== 'cierre'), 'clasificacion'),
    // Productos que pasan por inspección (solo CU-03): base para la tasa de conformidad.
    productos: guion.objetos.filter((o) => o.clase === 'producto').length,
    descripcion: guion.esperado?.resumen ?? '',
  };
}
