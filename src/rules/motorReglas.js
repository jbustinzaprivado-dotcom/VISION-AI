// Motor de reglas (fase 6). Recibe el resultado del análisis de cada cuadro y
// decide alertas, advertencias e informativas según las reglas de reglas.json.
//   RN-G1: una situación genera alerta solo si dura la duración mínima de su regla.
//   RN-G2: una sola alerta por región u objeto mientras la situación siga;
//          si termina y vuelve a ocurrir, se crea otra.
//   `reemplaza`: si se cumple la regla grave (RN-02.2), no se crea la leve (RN-02.1).
import { crearAnalizador } from '../analysis/analizar.js';
import { distancia } from '../analysis/geometria.js';
import { generarCuadro, totalCuadros } from '../simulation/motor.js';

const EPS = 1e-6;
const listaClases = (region) => (Array.isArray(region) ? region : [region]);

export function crearEstado() {
  return { activos: new Map(), previo: null };
}

// Situaciones que cumplen la condición de una regla en este cuadro.
// Cada una tiene una clave (el objeto o la región implicada) y un valor de evidencia.
function coincidencias(condicion, r, previo) {
  const clases = listaClases(condicion.region);
  const claseRegion = Object.fromEntries(r.regiones.map((x) => [x.id, x.clase]));
  const regionDe = (o) => o.regiones.find((id) => clases.includes(claseRegion[id]));
  const delTipo = r.objetos.filter((o) => !condicion.clase || o.clase === condicion.clase);
  const enRegion = delTipo.map((o) => ({ o, region: regionDe(o) })).filter((x) => x.region);
  const porObjeto = (filtro, valor = () => null) =>
    enRegion.filter(({ o }) => filtro(o)).map(({ o, region }) => ({ clave: o.id, tipoClave: 'objeto', region, valor: valor(o) }));
  const mediciones = r.mediciones.filter((m) => clases.includes(m.clase));
  const porRegion = (campo, comparar) =>
    mediciones.filter((m) => comparar(m[campo])).map((m) => ({ clave: m.region, tipoClave: 'region', region: m.region, valor: m[campo] }));

  switch (condicion.tipo) {
    case 'presencia':
      return porObjeto(() => true);
    case 'presenciaCerca':
      return porObjeto((p) =>
        r.objetos.some(
          (c) => c.clase === condicion.cerca && (!condicion.enMovimiento || c.enMovimiento) && distancia(p, c) < condicion.radio,
        ),
      );
    case 'ocupacion':
      return porRegion('ocupacion', (v) => v > condicion.umbral);
    case 'obstruccion':
      return porRegion('obstruccion', (v) => v > condicion.umbral);
    case 'conteo':
      return porRegion('personas', (v) => v > condicion.umbral);
    case 'cambioOcupacion':
      return r.cambios
        .filter((c) => clases.includes(claseRegion[c.region]) && Math.abs(c.diferencia) > condicion.umbral)
        .map((c) => ({ clave: c.region, tipoClave: 'region', region: c.region, valor: c.diferencia }));
    case 'cruce': {
      // Solo el cuadro en que la figura entra a la región.
      const antes = new Map((previo?.objetos ?? []).map((o) => [o.id, o.regiones]));
      return porObjeto((o) => !(antes.get(o.id) ?? []).some((id) => clases.includes(claseRegion[id])));
    }
    case 'atributo':
      return porObjeto((o) => o.atributos[condicion.atributo] === condicion.valor);
    case 'defecto':
      return porObjeto(
        (o) =>
          condicion.comparacion === 'mayor'
            ? o.proporcionDefecto > condicion.umbral
            : o.proporcionDefecto > 0 && o.proporcionDefecto <= condicion.umbral,
        (o) => o.proporcionDefecto,
      );
    case 'faltante':
      return porObjeto((o) => o.atributos.etiqueta === false || o.atributos.piezaFaltante === true);
    default:
      throw new Error(`Tipo de condición desconocido: ${condicion.tipo}`);
  }
}

// Evalúa un cuadro. Devuelve los eventos nuevos:
//   { tipo: 'alerta' | 'advertencia' | 'informativa', ... } cuando una regla se cumple
//   { tipo: 'cierre', ... } cuando termina una situación que ya había generado alerta
export function evaluarCuadro(reglas, resultado, estado) {
  const t = resultado.t;
  const activas = reglas.filter((r) => r.activa);
  const vigentes = new Map(); // clave interna → { regla, situacion }

  for (const regla of activas) {
    for (const s of coincidencias(regla.condicion, resultado, estado.previo)) {
      vigentes.set(`${regla.id}|${s.clave}`, { regla, situacion: s });
    }
  }

  const eventos = [];
  const porEmitir = [];
  for (const [clave, { regla, situacion }] of vigentes) {
    let activo = estado.activos.get(clave);
    if (!activo) {
      activo = { desde: t, emitida: false, regla, situacion };
      estado.activos.set(clave, activo);
    }
    activo.situacion = situacion;
    if (!activo.emitida && t - activo.desde >= regla.duracion - EPS) porEmitir.push(activo);
  }

  // Reemplazo: si la regla grave se cumple para la misma figura o región, la leve no se emite.
  for (const activo of porEmitir) {
    activo.emitida = true;
    const reemplazada = activas.some(
      (r) => r.reemplaza === activo.regla.id && vigentes.has(`${r.id}|${activo.situacion.clave}`),
    );
    if (reemplazada) {
      activo.reemplazada = true;
      continue;
    }
    eventos.push(crearEvento(activo.regla.accion, activo.regla, activo.situacion, resultado));
  }

  // Situaciones que terminaron (RN-G2: si vuelven, se crea otra alerta).
  for (const [clave, activo] of estado.activos) {
    if (vigentes.has(clave)) continue;
    if (activo.emitida && !activo.reemplazada && activo.regla.accion === 'alerta') {
      eventos.push(crearEvento('cierre', activo.regla, activo.situacion, resultado));
    }
    estado.activos.delete(clave);
  }

  estado.previo = resultado;
  return eventos;
}

function crearEvento(tipo, regla, situacion, resultado) {
  return {
    clave: `${regla.id}|${situacion.clave}|${resultado.cuadro}`,
    tipo,
    regla: regla.id,
    codigo: regla.codigo ?? regla.id,
    versionRegla: regla.version,
    severidad: regla.severidad,
    mensaje: regla.mensaje,
    clasificacion: regla.clasificacion ?? null,
    objetivo: situacion.clave,
    tipoObjetivo: situacion.tipoClave,
    region: situacion.region,
    valor: situacion.valor,
    t: resultado.t,
    cuadro: resultado.cuadro,
  };
}

// Recorre la sesión completa (60 s) y devuelve todos los eventos en orden.
// Como la simulación es determinista, el resultado es siempre el mismo:
// la pantalla lo calcula una vez y muestra los eventos hasta el instante actual.
export function procesarSesion(guion, semilla, reglas) {
  const propias = reglas.filter((r) => r.caso === guion.caso);
  const analizar = crearAnalizador(guion, semilla);
  const estado = crearEstado();
  const eventos = [];
  for (let i = 0; i < totalCuadros(guion); i++) {
    eventos.push(...evaluarCuadro(propias, analizar(generarCuadro(guion, i, semilla)), estado));
  }
  return eventos;
}

// Alertas cuya situación sigue activa en el instante t (para resaltarlas en el visor).
export function alertasActivas(eventos, t) {
  const activas = new Map();
  for (const e of eventos) {
    if (e.t > t) break;
    const id = `${e.regla}|${e.objetivo}`;
    if (e.tipo === 'alerta') activas.set(id, e);
    if (e.tipo === 'cierre') activas.delete(id);
  }
  return [...activas.values()];
}
