// Ciclo de vida de una alerta (RN-G3 y RI-04): nueva → revisada → cerrada.
// Solo avanza; para cerrar hay que escribir una observación y tener permiso.
import { puede } from '../auth/roles.js';

export const ESTADOS_ALERTA = ['nueva', 'revisada', 'cerrada'];
const SIGUIENTE = { nueva: 'revisada', revisada: 'cerrada' };

// Devuelve null si el cambio es válido, o el motivo por el que se rechaza.
export function validarCambioAlerta(alerta, nuevoEstado, observacion, rol) {
  if (SIGUIENTE[alerta.estado] !== nuevoEstado) {
    return `Una alerta ${alerta.estado} no puede pasar a ${nuevoEstado}: el ciclo es nueva → revisada → cerrada.`;
  }
  if (nuevoEstado === 'revisada' && !puede(rol, 'revisarAlertas')) {
    return 'Tu rol no puede revisar alertas.';
  }
  if (nuevoEstado === 'cerrada') {
    if (!puede(rol, 'cerrarAlertas')) return 'Solo el supervisor o el administrador pueden cerrar alertas.';
    if (!observacion || !observacion.trim()) return 'Para cerrar la alerta hay que escribir una observación.';
  }
  return null;
}

export function siguienteEstado(estado) {
  return SIGUIENTE[estado] ?? null;
}
