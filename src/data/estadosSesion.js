// Estados de una sesión de análisis (Arquitectura, A6): 7 estados, 3 finales.
// en_cola → preparada → en_ejecucion ⇄ pausada → completada; cancelada y fallida también son finales.
// Una sesión terminada no se reabre: para repetirla se crea otra con la misma semilla.

export const ETIQUETAS_SESION = {
  en_cola: 'En cola',
  preparada: 'Preparada',
  en_ejecucion: 'En ejecución',
  pausada: 'Pausada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  fallida: 'Fallida',
};

const TRANSICIONES = {
  en_cola: ['preparada', 'cancelada'],
  preparada: ['en_ejecucion', 'cancelada'],
  en_ejecucion: ['pausada', 'completada', 'cancelada', 'fallida'],
  pausada: ['en_ejecucion', 'completada', 'cancelada', 'fallida'],
};

export const FINALES = ['completada', 'cancelada', 'fallida'];

export function esFinal(estado) {
  return FINALES.includes(estado);
}

// Pedir el estado en que ya está no cambia nada (es válido); lo demás sigue la tabla.
export function puedeTransicionar(actual, nuevo) {
  if (actual === nuevo) return true;
  return (TRANSICIONES[actual] ?? []).includes(nuevo);
}
