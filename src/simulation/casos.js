// Los cuatro casos de uso, ordenados por prioridad (el almacén es el principal).
import cu01 from './guiones/cu-01.json';
import cu02 from './guiones/cu-02.json';
import cu03 from './guiones/cu-03.json';
import cu04 from './guiones/cu-04.json';

export const CASOS = [cu02, cu04, cu01, cu03];

export function casoPorId(id) {
  return CASOS.find((c) => c.caso === id) ?? null;
}
