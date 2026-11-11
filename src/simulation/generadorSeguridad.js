// Generador procedural de seguridad industrial (CU-01).
// Cada semilla arma una planta distinta (una o dos áreas de trabajo, vía de
// circulación, acceso y una o dos salidas de emergencia) y un turno de trabajadores
// que entran por el acceso y se mueven dentro de su área. Según el riesgo, algunos
// entran sin casco o sin chaleco (y a veces se lo ponen después), alguno queda poco
// visible, y un carro puede bloquear una salida de emergencia durante un tiempo.
// Misma semilla y opciones, mismo turno.
//
// Produce un guion con el formato de los JSON: motor, análisis y reglas sin cambios.
import seedrandom from 'seedrandom';

export const VERSION_GENERADOR_SEGURIDAD = 1;
export const OPCIONES_SEGURIDAD = { trabajadores: 4, riesgo: 'medio' };
// Probabilidad por trabajador de cada incidente (a lo sumo uno por trabajador) y de un bloqueo de salida.
export const RIESGOS_SEGURIDAD = {
  bajo: { nombre: 'Bajo', sinCasco: 0.05, sinChaleco: 0.05, pocoVisible: 0.05, bloqueo: 0.15 },
  medio: { nombre: 'Medio', sinCasco: 0.18, sinChaleco: 0.12, pocoVisible: 0.1, bloqueo: 0.5 },
  alto: { nombre: 'Alto', sinCasco: 0.3, sinChaleco: 0.2, pocoVisible: 0.15, bloqueo: 0.9 },
};

const DURACION = 60;
const VELOCIDAD = 0.16;
const r3 = (v) => Math.round(v * 1000) / 1000;
const r1 = (v) => Math.round(v * 10) / 10;

export function normalizarOpcionesSeguridad(opciones = {}) {
  const o = { ...OPCIONES_SEGURIDAD, ...opciones };
  return {
    trabajadores: Math.max(2, Math.min(6, Math.round(Number(o.trabajadores) || 4))),
    riesgo: RIESGOS_SEGURIDAD[o.riesgo] ? o.riesgo : 'medio',
  };
}

export function generarSeguridad(semilla, opciones = {}) {
  const op = normalizarOpcionesSeguridad(opciones);
  const riesgo = RIESGOS_SEGURIDAD[op.riesgo];
  const azar = seedrandom(`seguridad|v${VERSION_GENERADOR_SEGURIDAD}|${semilla}|${op.trabajadores}|${op.riesgo}`);
  const entre = (a, b) => a + azar() * (b - a);
  const entero = (a, b) => Math.floor(entre(a, b + 1));
  const tramo = (a, b) => Math.max(0.3, Math.hypot(a.x - b.x, a.y - b.y) / VELOCIDAD);

  // ---------- Distribución ----------
  const yVia = r3(entre(0.7, 0.74));
  const dosAreas = azar() < 0.5;
  const areas = dosAreas
    ? [
        { id: 'area-trabajo-1', clase: 'area-trabajo', nombre: 'Área de trabajo 1', x: 0.17, y: r3(entre(0.08, 0.14)), w: 0.29, h: r3(entre(0.46, 0.52)) },
        { id: 'area-trabajo-2', clase: 'area-trabajo', nombre: 'Área de trabajo 2', x: 0.5, y: r3(entre(0.08, 0.14)), w: 0.3, h: r3(entre(0.46, 0.52)) },
      ]
    : [{ id: 'area-trabajo-1', clase: 'area-trabajo', nombre: 'Área de trabajo', x: r3(entre(0.17, 0.24)), y: r3(entre(0.08, 0.14)), w: r3(entre(0.48, 0.56)), h: r3(entre(0.46, 0.52)) }];
  const yAcceso = r3(entre(0.2, 0.4));
  const dosSalidas = azar() < 0.4;
  const salidas = (dosSalidas ? [0.08, 0.4] : [r3(entre(0.1, 0.36))]).map((y, i) => ({
    id: `salida-${i + 1}`, clase: 'salida-emergencia', nombre: dosSalidas ? `Salida de emergencia ${i + 1}` : 'Salida de emergencia', x: 0.88, y, w: 0.08, h: 0.2,
  }));
  const regiones = [
    { id: 'suelo-1', clase: 'suelo', nombre: 'Suelo', x: 0, y: 0, w: 1, h: 1 },
    { id: 'acceso-1', clase: 'entrada', nombre: 'Acceso', x: 0.03, y: yAcceso, w: 0.06, h: 0.2 },
    ...areas,
    { id: 'via-1', clase: 'via', nombre: 'Vía de circulación', x: 0.03, y: yVia, w: 0.94, h: 0.14 },
    ...salidas,
  ];
  const objetos = [];
  const eventos = [{ t: 0, texto: `Planta generada: ${areas.length === 1 ? 'un área de trabajo' : 'dos áreas de trabajo'}, ${salidas.length === 1 ? 'una salida' : 'dos salidas'} de emergencia y ${op.trabajadores} trabajadores.` }];
  const conteo = { sinCasco: 0, sinChaleco: 0, pocoVisible: 0, bloqueos: 0 };

  // ---------- Trabajadores ----------
  const corredorX = 0.12; // entre el acceso y las áreas: nadie corta camino por otra zona
  for (let n = 1; n <= op.trabajadores; n++) {
    const area = areas[entero(0, areas.length - 1)];
    const dentro = () => ({ x: r3(entre(area.x + 0.04, area.x + area.w - 0.04)), y: r3(entre(area.y + 0.07, area.y + area.h - 0.07)) });
    const atributos = { casco: true, chaleco: true, pocoVisible: false };
    const cambios = [];

    const dado = azar();
    let incidente = null;
    if (dado < riesgo.sinCasco) incidente = 'sinCasco';
    else if (dado < riesgo.sinCasco + riesgo.sinChaleco) incidente = 'sinChaleco';
    else if (dado < riesgo.sinCasco + riesgo.sinChaleco + riesgo.pocoVisible) incidente = 'pocoVisible';

    // Entrada por el acceso, corredor y área; luego recorre puntos del área.
    const llegada = r1(entre(0, 30));
    const yEntrada = r3(yAcceso + 0.1);
    const puntos = [{ x: 0.01, y: yEntrada }, { x: corredorX, y: yEntrada }];
    const primero = dentro();
    puntos.push({ x: corredorX, y: primero.y }, primero);
    const ruta = [];
    let t = llegada;
    puntos.forEach((p, i) => {
      if (i > 0) t = r1(t + tramo(puntos[i - 1], p));
      ruta.push({ t, ...p });
    });
    const enArea = t; // momento en que llega a su primer punto dentro del área
    let anterior = primero;
    while (t < DURACION - 1) {
      const pausa = entre(1.5, 5);
      ruta.push({ t: r1(Math.min(DURACION, t + pausa)), ...anterior });
      t = r1(t + pausa);
      if (t >= DURACION) break;
      const siguiente = dentro();
      t = r1(t + tramo(anterior, siguiente));
      ruta.push({ t: Math.min(DURACION, t), ...siguiente });
      anterior = siguiente;
    }

    if (incidente === 'sinCasco' || incidente === 'sinChaleco') {
      const prenda = incidente === 'sinCasco' ? 'casco' : 'chaleco';
      atributos[prenda] = false;
      conteo[incidente] += 1;
      eventos.push({ t: r1(Math.min(DURACION, enArea)), texto: `El trabajador ${n} está en el área sin ${prenda}.` });
      // A veces se lo pone después de un rato; otras, sigue así todo el turno.
      if (azar() < 0.6) {
        const tPone = r1(enArea + entre(1, 9));
        if (tPone < DURACION) {
          cambios.push({ t: tPone, atributo: prenda, valor: true });
          eventos.push({ t: tPone, texto: `El trabajador ${n} se pone el ${prenda}.` });
        }
      }
    }
    if (incidente === 'pocoVisible') {
      atributos.pocoVisible = true;
      conteo.pocoVisible += 1;
      eventos.push({ t: r1(Math.min(DURACION, enArea)), texto: `El trabajador ${n} queda poco visible: advertencia para revisión, sin alerta (RN-01.3).` });
    }

    const trabajador = { id: `trabajador-${n}`, clase: 'persona', w: 0.03, h: 0.1, atributos, ruta: limpiarRuta(ruta) };
    if (cambios.length) trabajador.cambios = cambios;
    objetos.push(trabajador);
  }

  // ---------- Carros por la vía (y bloqueo de una salida) ----------
  const yCarril = r3(yVia + 0.07);
  const xSubida = 0.84; // corredor entre las áreas y las salidas
  const bloquea = azar() < riesgo.bloqueo;
  const nCarros = op.riesgo === 'alto' ? 2 : 1;
  for (let c = 1; c <= nCarros; c++) {
    const inicio = r1(entre(3, 25));
    const ruta = [{ t: inicio, x: 0.06, y: yCarril }];
    if (c === 1 && bloquea) {
      const salida = salidas[entero(0, salidas.length - 1)];
      const centro = { x: r3(salida.x + salida.w / 2), y: r3(salida.y + salida.h / 2) };
      let t = r1(inicio + tramo({ x: 0.06, y: yCarril }, { x: xSubida, y: yCarril }));
      ruta.push({ t, x: xSubida, y: yCarril });
      t = r1(t + tramo({ x: xSubida, y: yCarril }, { x: xSubida, y: centro.y }));
      ruta.push({ t, x: xSubida, y: centro.y });
      t = r1(t + 1.2);
      ruta.push({ t, ...centro });
      const duracion = r1(entre(3, 13));
      const libera = r1(Math.min(DURACION - 0.5, t + duracion));
      ruta.push({ t: libera, ...centro });
      ruta.push({ t: r1(libera + 1.2), x: xSubida, y: centro.y });
      ruta.push({ t: r1(libera + 1.2 + tramo({ x: xSubida, y: centro.y }, { x: xSubida, y: yCarril })), x: xSubida, y: yCarril });
      conteo.bloqueos += 1;
      eventos.push({ t, texto: `Un carro se detiene frente a la ${salida.nombre.toLowerCase()}.` });
      if (libera - t > 5) eventos.push({ t: r1(t + 5), texto: 'La salida lleva 5 segundos bloqueada: alerta alta de área bloqueada (RN-01.2).' });
      eventos.push({ t: libera, texto: `El carro libera la ${salida.nombre.toLowerCase()}.` });
    } else {
      ruta.push({ t: r1(inicio + tramo({ x: 0.06, y: yCarril }, { x: 0.94, y: yCarril })), x: 0.94, y: yCarril });
    }
    const limpia = limpiarRuta(ruta);
    const carro = { id: `carro-${c}`, clase: 'carro', w: 0.1, h: 0.15, ruta: limpia };
    const fin = limpia.at(-1).t;
    if (fin + 0.5 <= DURACION) carro.sale = r1(fin + 0.5);
    objetos.push(carro);
  }

  eventos.sort((a, b) => a.t - b.t);
  const partes = [];
  if (conteo.sinCasco) partes.push(`${conteo.sinCasco} sin casco`);
  if (conteo.sinChaleco) partes.push(`${conteo.sinChaleco} sin chaleco`);
  if (conteo.pocoVisible) partes.push(`${conteo.pocoVisible} poco visible`);
  if (conteo.bloqueos) partes.push('una salida bloqueada');
  return {
    caso: 'CU-01',
    nombre: 'Planta generada',
    prioridad: 3,
    version: 1,
    duracion: DURACION,
    semilla: Number.isInteger(semilla) ? semilla : 0,
    generado: { version: VERSION_GENERADOR_SEGURIDAD, opciones: op, conteo },
    regiones,
    objetos,
    eventos: eventos.filter((e) => e.t >= 0 && e.t <= DURACION),
    esperado: {
      alertas: [],
      advertencias: [],
      informativas: [],
      resumen: `Planta generada (riesgo ${RIESGOS_SEGURIDAD[op.riesgo].nombre.toLowerCase()}): ${op.trabajadores} trabajadores; ${partes.length ? partes.join(', ') : 'sin incidentes planificados'}.`,
    },
  };
}

// Ordena los tiempos, evita repetidos y termina la ruta en la duración de la sesión.
function limpiarRuta(ruta) {
  const salida = [];
  for (const p of ruta) {
    const punto = { t: Math.max(0, r1(p.t)), x: Math.max(0, Math.min(1, r3(p.x))), y: Math.max(0, Math.min(1, r3(p.y))) };
    if (salida.length && punto.t <= salida.at(-1).t) punto.t = r1(salida.at(-1).t + 0.1);
    if (punto.t > DURACION) {
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

