// Comprueba que guiones y reglas estén completos y sean coherentes (criterio de la fase 2).
// Devuelve una lista de errores en texto; lista vacía = todo bien.
import clases from './clases.json';

const CASOS = ['CU-01', 'CU-02', 'CU-03', 'CU-04'];
const SEVERIDADES = ['alta', 'media', 'baja', 'informativa'];
const ACCIONES = ['alerta', 'advertencia', 'informativa'];
const TIPOS = ['presencia', 'presenciaCerca', 'ocupacion', 'obstruccion', 'cambioOcupacion', 'conteo', 'cruce', 'atributo', 'defecto', 'faltante'];
const EPS = 1e-9;

const enRango = (v) => typeof v === 'number' && v >= 0 && v <= 1; // RI-02

export function validarGuion(guion, reglas) {
  const errores = [];
  const e = (msg) => errores.push(`${guion.caso ?? '¿caso?'}: ${msg}`);

  if (!CASOS.includes(guion.caso)) e(`caso desconocido "${guion.caso}"`);
  if (!guion.nombre) e('falta el nombre');
  if (!(guion.duracion > 0)) e('la duración debe ser mayor que 0');
  if (!Number.isInteger(guion.semilla)) e('la semilla debe ser un entero');
  if (!Number.isInteger(guion.version) || guion.version < 1) e('la versión debe ser un entero desde 1');
  const enTiempo = (t) => typeof t === 'number' && t >= 0 && t <= guion.duracion;

  const ids = new Set();
  const idUnico = (id) => {
    if (!id) e('elemento sin id');
    else if (ids.has(id)) e(`id repetido "${id}"`);
    else ids.add(id);
  };

  const revisarCambios = (el) => {
    for (const c of el.cambios ?? []) {
      if (!enTiempo(c.t)) e(`${el.id}: cambio fuera de la duración (t=${c.t})`);
      if (!el.atributos || !(c.atributo in el.atributos)) {
        e(`${el.id}: cambia "${c.atributo}", que no está en sus atributos iniciales`);
      }
    }
  };

  for (const r of guion.regiones ?? []) {
    idUnico(r.id);
    if (!clases.regiones[r.clase]) e(`${r.id}: clase de región desconocida "${r.clase}"`);
    if (![r.x, r.y, r.w, r.h].every(enRango)) e(`${r.id}: coordenadas fuera de 0..1`);
    if (r.x + r.w > 1 + EPS || r.y + r.h > 1 + EPS) e(`${r.id}: se sale de la escena`);
    if (!(r.w > 0 && r.h > 0)) e(`${r.id}: tamaño nulo`);
    revisarCambios(r);
  }

  for (const o of guion.objetos ?? []) {
    idUnico(o.id);
    if (!clases.objetos[o.clase]) e(`${o.id}: clase de figura desconocida "${o.clase}"`);
    if (!(o.w > 0 && o.w <= 1 && o.h > 0 && o.h <= 1)) e(`${o.id}: tamaño fuera de rango`);
    if (!Array.isArray(o.ruta) || o.ruta.length === 0) {
      e(`${o.id}: no tiene ruta`);
      continue;
    }
    o.ruta.forEach((p, i) => {
      if (!enTiempo(p.t)) e(`${o.id}: punto ${i} fuera de la duración (t=${p.t})`);
      if (!enRango(p.x) || !enRango(p.y)) e(`${o.id}: punto ${i} fuera de 0..1`);
      if (i > 0 && p.t < o.ruta[i - 1].t) e(`${o.id}: la ruta no está ordenada en el tiempo`);
    });
    if (o.sale != null && (!enTiempo(o.sale) || o.sale <= o.ruta[0].t)) {
      e(`${o.id}: "sale" debe ser posterior a su aparición y dentro de la duración`);
    }
    const d = o.atributos?.defecto;
    if (d) {
      if (![d.x, d.y, d.w, d.h].every(enRango) || d.x + d.w > 1 + EPS || d.y + d.h > 1 + EPS) {
        e(`${o.id}: el defecto debe estar dentro del producto (0..1)`);
      }
    }
    revisarCambios(o);
  }

  (guion.eventos ?? []).forEach((ev, i, lista) => {
    if (!enTiempo(ev.t)) e(`evento ${i} fuera de la duración`);
    if (!ev.texto) e(`evento ${i} sin texto`);
    if (i > 0 && ev.t < lista[i - 1].t) e('los eventos no están ordenados en el tiempo');
  });

  const esperado = guion.esperado;
  if (!esperado) e('falta "esperado"');
  else {
    const idsReglas = new Map(reglas.reglas.map((r) => [r.id, r]));
    for (const grupo of ['alertas', 'advertencias', 'informativas']) {
      for (const x of esperado[grupo] ?? []) {
        const regla = idsReglas.get(x.regla);
        if (!regla) e(`esperado.${grupo}: regla inexistente "${x.regla}"`);
        else if (regla.caso !== guion.caso) e(`esperado.${grupo}: ${x.regla} pertenece a ${regla.caso}`);
        if (x.objeto && !ids.has(x.objeto)) e(`esperado.${grupo}: objeto inexistente "${x.objeto}"`);
        if (x.region && !ids.has(x.region)) e(`esperado.${grupo}: región inexistente "${x.region}"`);
      }
    }
  }
  return errores;
}

export function validarReglas(datos) {
  const errores = [];
  const ids = new Set();
  for (const r of datos.reglas ?? []) {
    const e = (msg) => errores.push(`${r.id ?? '¿regla?'}: ${msg}`);
    if (!r.id) e('regla sin id');
    else if (ids.has(r.id)) e('id repetido');
    else ids.add(r.id);
    if (!CASOS.includes(r.caso)) e(`caso desconocido "${r.caso}"`);
    if (!r.nombre || !r.mensaje) e('falta nombre o mensaje');
    if (!SEVERIDADES.includes(r.severidad)) e(`severidad inválida "${r.severidad}"`);
    if (!ACCIONES.includes(r.accion)) e(`acción inválida "${r.accion}"`);
    if (!(typeof r.duracion === 'number' && r.duracion >= 0)) e('la duración debe ser un número desde 0');
    if (typeof r.activa !== 'boolean') e('"activa" debe ser verdadero o falso');
    if (!Number.isInteger(r.version) || r.version < 1) e('la versión debe ser un entero desde 1');

    const c = r.condicion ?? {};
    if (!TIPOS.includes(c.tipo)) e(`tipo de condición desconocido "${c.tipo}"`);
    const regiones = Array.isArray(c.region) ? c.region : [c.region];
    for (const reg of regiones) {
      if (!clases.regiones[reg]) e(`clase de región desconocida "${reg}"`);
    }
    if (c.clase && !clases.objetos[c.clase]) e(`clase de figura desconocida "${c.clase}"`);
    if (c.cerca && !clases.objetos[c.cerca]) e(`clase de figura desconocida "${c.cerca}"`);
    if (['ocupacion', 'obstruccion', 'cambioOcupacion', 'defecto'].includes(c.tipo) && !enRango(c.umbral)) {
      e('el umbral de una proporción debe estar entre 0 y 1');
    }
    if (c.tipo === 'conteo' && !(Number.isInteger(c.umbral) && c.umbral > 0)) e('el umbral de conteo debe ser un entero positivo');
    if (c.tipo === 'presenciaCerca' && !enRango(c.radio)) e('el radio debe estar entre 0 y 1');
  }
  for (const r of datos.reglas ?? []) {
    if (r.reemplaza && !ids.has(r.reemplaza)) errores.push(`${r.id}: reemplaza a una regla inexistente "${r.reemplaza}"`);
  }
  return errores;
}
