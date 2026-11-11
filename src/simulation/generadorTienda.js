// Generador procedural de la tienda (CU-04).
// Cada semilla arma una tienda distinta (pasillos, cajas, entrada) y una jornada de
// clientes: llegan por la entrada (solos o en grupos), recorren un pasillo, hacen fila
// en la caja abierta con menos gente, pagan y salen por el lado de las cajas.
// Las filas se calculan con una simulación de colas: cada caja atiende a un cliente
// por vez. Si una caja se congestiona y hay otra cerrada, esta se abre y atiende a los
// que llegan después. Misma semilla y opciones, misma jornada.
//
// Produce un guion con el formato de los JSON: motor, análisis y reglas sin cambios.
import seedrandom from 'seedrandom';

export const VERSION_GENERADOR_TIENDA = 1;
export const OPCIONES_TIENDA = { afluencia: 'media', riesgo: 'medio' };
export const AFLUENCIAS = { baja: { nombre: 'Baja', clientes: 9 }, media: { nombre: 'Media', clientes: 14 }, alta: { nombre: 'Alta', clientes: 20 } };
export const RIESGOS_TIENDA = {
  bajo: { nombre: 'Bajo', cerradas: 0, grupos: 0, ventana: 40 },
  medio: { nombre: 'Medio', cerradas: 1, grupos: 0.3, ventana: 34 },
  alto: { nombre: 'Alto', cerradas: 2, grupos: 0.6, ventana: 26 },
};

const DURACION = 60;
const VELOCIDAD = 0.2; // de la escena por segundo al caminar
const LIMITE = 6; // RN-04.1: más de 6 personas en una región
const r3 = (v) => Math.round(v * 1000) / 1000;
const r1 = (v) => Math.round(v * 10) / 10;

export function normalizarOpcionesTienda(opciones = {}) {
  const o = { ...OPCIONES_TIENDA, ...opciones };
  return {
    afluencia: AFLUENCIAS[o.afluencia] ? o.afluencia : 'media',
    riesgo: RIESGOS_TIENDA[o.riesgo] ? o.riesgo : 'medio',
  };
}

export function generarTienda(semilla, opciones = {}) {
  const op = normalizarOpcionesTienda(opciones);
  const riesgo = RIESGOS_TIENDA[op.riesgo];
  const azar = seedrandom(`tienda|v${VERSION_GENERADOR_TIENDA}|${semilla}|${op.afluencia}|${op.riesgo}`);
  const entre = (a, b) => a + azar() * (b - a);
  const entero = (a, b) => Math.floor(entre(a, b + 1));

  // ---------- Distribución ----------
  const nPasillos = entero(2, 3);
  const nCajas = entero(2, 3);
  const apilar = (n) => {
    const h = (0.88 - (n - 1) * 0.04) / n;
    return Array.from({ length: n }, (_, i) => ({ y: r3(0.06 + i * (h + 0.04)), h: r3(h) }));
  };
  const yEntrada = r3(entre(0.32, 0.52));
  const regiones = [
    { id: 'suelo-1', clase: 'suelo', nombre: 'Suelo', x: 0, y: 0, w: 1, h: 1 },
    { id: 'entrada-1', clase: 'entrada', nombre: 'Línea de entrada', x: 0.02, y: yEntrada, w: 0.04, h: 0.24 },
  ];
  const pasillos = apilar(nPasillos).map((f, i) => ({ id: `pasillo-${i + 1}`, clase: 'pasillo', nombre: `Pasillo ${i + 1}`, x: 0.12, w: 0.48, ...f }));
  const cerradas = Math.min(riesgo.cerradas, nCajas - 1); // siempre queda al menos una abierta
  const cajas = apilar(nCajas).map((f, i) => {
    const abierta = i < nCajas - cerradas;
    return { id: `caja-${i + 1}`, clase: 'caja', nombre: `Caja ${i + 1}`, x: 0.68, w: 0.28, ...f, atributos: { abierta } };
  });
  regiones.push(...pasillos, ...cajas);

  // Estantes en el centro de cada pasillo; los clientes caminan por encima o por debajo.
  const objetos = pasillos.map((p, i) => ({ id: `estante-${i + 1}`, clase: 'estante', w: 0.34, h: 0.05, ruta: [{ t: 0, x: 0.36, y: r3(p.y + p.h / 2) }] }));

  // Puestos dentro de cada caja: 5 columnas × 2 filas (los que no caben esperan afuera).
  const puestos = (caja) =>
    Array.from({ length: 10 }, (_, k) => ({ x: r3(caja.x + 0.035 + (k % 5) * 0.045), y: r3(caja.y + caja.h * (k < 5 ? 0.33 : 0.7)) }));
  const espera = (caja, k) => ({ x: r3(caja.x - 0.025), y: r3(caja.y + caja.h * (0.2 + 0.12 * (k % 6))) });

  // ---------- Clientes: llegada y recorrido por un pasillo ----------
  const nClientes = AFLUENCIAS[op.afluencia].clientes;
  const clientes = [];
  const abiertas = nCajas - cerradas;
  const eventos = [{ t: 0, texto: `Tienda generada: ${nPasillos} pasillos y ${nCajas} cajas (${abiertas} ${abiertas === 1 ? 'abierta' : 'abiertas'}).` }];
  let t = r1(entre(1, 3));
  const eventosGrupo = [];
  while (clientes.length < nClientes) {
    const grupo = azar() < riesgo.grupos ? Math.min(nClientes - clientes.length, entero(3, 5)) : 1;
    if (grupo > 1) eventosGrupo.push({ t, texto: `Llega un grupo de ${grupo} clientes.` });
    for (let g = 0; g < grupo; g++) {
      const pasillo = pasillos[entero(0, pasillos.length - 1)];
      const carril = r3(pasillo.y + pasillo.h / 2 + (azar() < 0.5 ? -1 : 1) * Math.min(0.08, pasillo.h * 0.3));
      clientes.push({
        llegada: r1(t + g * 0.6),
        pasillo,
        carril,
        x1: r3(entre(0.16, 0.34)),
        x2: r3(entre(0.38, 0.56)),
        recorrido: r1(entre(4, 11)),
        servicio: r1(entre(4, 6.5)),
      });
    }
    // Intervalo medio = ventana ÷ clientes: todos llegan dentro de la ventana del riesgo.
    t = r1(t + (grupo > 1 ? entre(3, 6) : entre(0.4, (2 * riesgo.ventana) / nClientes - 0.4)));
  }

  // Todos llegan dentro de los primeros 45 s (para que alcancen a recorrer y pagar):
  // si la última llegada se pasa, las llegadas se comprimen en proporción.
  const ultima = Math.max(...clientes.map((c) => c.llegada));
  const escala = ultima > 45 ? 45 / ultima : 1;
  for (const c of clientes) c.llegada = r1(c.llegada * escala);
  for (const e of eventosGrupo) eventos.push({ t: r1(e.t * escala), texto: e.texto });

  // Momento en que cada cliente llega a la zona de cajas (pasillo derecho, x = 0,64).
  const tramo = (a, b) => Math.max(0.4, Math.hypot(a.x - b.x, a.y - b.y) / VELOCIDAD);
  for (const c of clientes) {
    const p0 = { x: 0.01, y: yEntrada + 0.12 };
    const p1 = { x: 0.09, y: p0.y };
    const p2 = { x: 0.09, y: c.carril };
    const p3 = { x: c.x1, y: c.carril };
    const p4 = { x: c.x2, y: c.carril };
    const p5 = { x: 0.64, y: c.carril };
    c.puntos = [p0, p1, p2, p3, p4, p5];
    c.tiempos = [c.llegada];
    for (let i = 1; i < c.puntos.length; i++) {
      const extra = i === 4 ? c.recorrido : 0; // tiempo mirando productos entre p3 y p4
      c.tiempos.push(r1(c.tiempos[i - 1] + tramo(c.puntos[i - 1], c.puntos[i]) + extra));
    }
    c.alPasillo = c.tiempos.at(-1);
  }

  // ---------- Simulación de las filas ----------
  const simular = (aperturas) => {
    const ocupados = cajas.map(() => []); // por caja: { hasta, puesto }
    const libreDesde = cajas.map(() => 0);
    const orden = [...clientes].sort((a, b) => a.alPasillo - b.alPasillo);
    for (const c of orden) {
      const disponibles = cajas.map((cj, i) => i).filter((i) => cajas[i].atributos.abierta || (aperturas[i] != null && aperturas[i] <= c.alPasillo));
      const enFila = (i, tt) => ocupados[i].filter((o) => o.desde <= tt && o.hasta > tt).length;
      const i = disponibles.reduce((mejor, j) => (enFila(j, c.alPasillo) < enFila(mejor, c.alPasillo) ? j : mejor), disponibles[0]);
      const caja = cajas[i];
      const llegada = r1(c.alPasillo + tramo({ x: 0.64, y: c.carril }, { x: caja.x + 0.06, y: caja.y + caja.h / 2 }));
      const usados = new Set(ocupados[i].filter((o) => o.desde <= llegada && o.hasta > llegada).map((o) => o.puesto));
      let puesto = 0;
      while (usados.has(puesto)) puesto++;
      const inicio = Math.max(llegada, libreDesde[i]);
      const fin = r1(inicio + c.servicio);
      libreDesde[i] = fin;
      ocupados[i].push({ desde: llegada, hasta: fin, puesto });
      Object.assign(c, { caja: i, llegadaCaja: llegada, fin, puesto });
    }
    return ocupados;
  };

  // Primera pasada con las cajas iniciales. Si una caja supera el límite y hay otra
  // cerrada, esta se abre unos segundos después y se repite la simulación.
  const aperturas = {};
  let ocupados = simular(aperturas);
  const primeraCongestion = () => {
    let mejor = null;
    ocupados.forEach((lista, i) => {
      for (const o of lista) {
        const tt = o.desde;
        const n = lista.filter((x) => x.desde <= tt && x.hasta > tt && x.puesto < 10).length;
        if (n > LIMITE && (mejor == null || tt < mejor.t)) mejor = { t: tt, caja: i };
      }
    });
    return mejor;
  };
  const congestion = primeraCongestion();
  const cerrada = cajas.findIndex((c) => !c.atributos.abierta);
  if (congestion && cerrada >= 0) {
    const tApertura = r1(congestion.t + entre(5.5, 8));
    if (tApertura < DURACION - 8) {
      aperturas[cerrada] = tApertura;
      cajas[cerrada].cambios = [{ t: tApertura, atributo: 'abierta', valor: true }];
      ocupados = simular(aperturas);
      eventos.push({ t: tApertura, texto: `Se abre la ${cajas[cerrada].nombre.toLowerCase()} por la congestión.` });
    }
  }

  // ---------- Rutas de los clientes ----------
  clientes.forEach((c, n) => {
    const caja = cajas[c.caja];
    const lugar = c.puesto < 10 ? puestos(caja)[c.puesto] : espera(caja, c.puesto);
    const ruta = c.puntos.map((p, i) => ({ t: c.tiempos[i], x: r3(p.x), y: r3(p.y) }));
    ruta.push({ t: r1(c.alPasillo + 0.4), x: 0.64, y: r3(lugar.y) });
    ruta.push({ t: c.llegadaCaja, x: lugar.x, y: lugar.y });
    ruta.push({ t: c.fin, x: lugar.x, y: lugar.y });
    const salida = r1(c.fin + tramo(lugar, { x: 0.99, y: lugar.y }));
    ruta.push({ t: salida, x: 0.99, y: lugar.y });
    const persona = { id: `persona-${n + 1}`, clase: 'persona', w: 0.03, h: 0.1, ruta: limpiarRuta(ruta) };
    if (salida + 0.2 <= DURACION) persona.sale = r1(salida + 0.2);
    objetos.push(persona);
  });

  // Evento de congestión (si hubo) en el momento en que se superó el límite.
  const resultado = primeraCongestion();
  if (resultado) {
    eventos.push({ t: r1(resultado.t), texto: `Se forma una fila de más de ${LIMITE} personas en la ${cajas[resultado.caja].nombre.toLowerCase()}: si dura más de 5 s, hay alerta de congestión (RN-04.1).` });
  }

  eventos.sort((a, b) => a.t - b.t);
  return {
    caso: 'CU-04',
    nombre: 'Tienda generada',
    prioridad: 2,
    version: 1,
    duracion: DURACION,
    semilla: Number.isInteger(semilla) ? semilla : 0,
    generado: { version: VERSION_GENERADOR_TIENDA, opciones: op, clientes: clientes.length, aperturas },
    regiones,
    objetos,
    eventos: eventos.filter((e) => e.t >= 0 && e.t <= DURACION),
    esperado: {
      alertas: [],
      advertencias: [],
      informativas: [],
      resumen: `Tienda generada (afluencia ${AFLUENCIAS[op.afluencia].nombre.toLowerCase()}, riesgo ${RIESGOS_TIENDA[op.riesgo].nombre.toLowerCase()}): ${clientes.length} clientes${resultado ? ', con congestión en caja' : ', sin congestión prevista'}${Object.keys(aperturas).length ? ' y apertura de otra caja' : ''}.`,
    },
  };
}

// Ordena los tiempos, evita repetidos y limita todo a la duración y a 0..1.
function limpiarRuta(ruta) {
  const salida = [];
  for (const p of ruta) {
    const punto = { t: Math.max(0, r1(p.t)), x: Math.max(0, Math.min(1, r3(p.x))), y: Math.max(0, Math.min(1, r3(p.y))) };
    if (salida.length && punto.t <= salida.at(-1).t) punto.t = r1(salida.at(-1).t + 0.1);
    if (punto.t > DURACION) {
      // Interpola la posición en el último segundo de la sesión y termina ahí.
      const a = salida.at(-1);
      if (a && a.t < DURACION) {
        const f = (DURACION - a.t) / (punto.t - a.t);
        salida.push({ t: DURACION, x: r3(a.x + (punto.x - a.x) * f), y: r3(a.y + (punto.y - a.y) * f) });
      }
      break;
    }
    salida.push(punto);
  }
  return salida;
}
