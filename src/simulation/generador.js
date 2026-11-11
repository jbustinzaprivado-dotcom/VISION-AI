// Generador procedural del almacén (CU-02).
// En lugar de leer un guion escrito a mano, arma uno nuevo a partir de una semilla
// y unas opciones: distribución de pasillos y estanterías, mercadería, rutas de
// personas y montacargas, e incidentes (intrusión en zona restringida, obstrucción
// de la zona de tránsito). La misma semilla con las mismas opciones produce siempre
// la misma escena; cada semilla distinta, una escena distinta.
//
// El resultado tiene exactamente el formato de un guion (simulation/guiones/*.json),
// así que el motor, el análisis y las reglas lo procesan sin cambios.
import seedrandom from 'seedrandom';

export const VERSION_GENERADOR = 1;
export const OPCIONES_INICIALES = { personas: 3, montacargas: 1, riesgo: 'medio' };
export const RIESGOS = {
  bajo: { nombre: 'Bajo', intrusion: 0.2, obstruccion: 0.2, cercania: 0.2 },
  medio: { nombre: 'Medio', intrusion: 0.6, obstruccion: 0.5, cercania: 0.5 },
  alto: { nombre: 'Alto', intrusion: 1, obstruccion: 0.9, cercania: 0.85 },
};

const DURACION = 60;
const r3 = (v) => Math.round(v * 1000) / 1000;
const r1 = (v) => Math.round(v * 10) / 10;
const coma = (v) => String(v).replace('.', ','); // decimales con coma en los textos

export function normalizarOpciones(opciones = {}) {
  const o = { ...OPCIONES_INICIALES, ...opciones };
  return {
    personas: Math.max(1, Math.min(6, Math.round(Number(o.personas) || 1))),
    montacargas: Math.max(1, Math.min(2, Math.round(Number(o.montacargas) || 1))),
    riesgo: RIESGOS[o.riesgo] ? o.riesgo : 'medio',
  };
}

export function generarAlmacen(semilla, opciones = {}) {
  const op = normalizarOpciones(opciones);
  const riesgo = RIESGOS[op.riesgo];
  const azar = seedrandom(`almacen|v${VERSION_GENERADOR}|${semilla}|${op.personas}|${op.montacargas}|${op.riesgo}`);
  const entre = (a, b) => a + azar() * (b - a);
  const entero = (a, b) => Math.floor(entre(a, b + 1));
  const sucede = (p) => azar() < p;

  // ---------- Distribución ----------
  const filas = entero(2, 3); // filas de estantería, cada una con su pasillo debajo
  const bloqueX = 0.05;
  const bloqueW = r3(entre(0.55, 0.6));
  const altoEstante = 0.1;
  const separacion = 0.03;
  const altoPasillo = r3((0.92 - filas * altoEstante - (2 * filas - 1) * separacion) / filas);
  const regiones = [{ id: 'suelo-1', clase: 'suelo', nombre: 'Suelo', x: 0, y: 0, w: 1, h: 1 }];
  const pasillos = [];
  let y = 0.04;
  for (let i = 1; i <= filas; i++) {
    regiones.push({ id: `estanteria-${i}`, clase: 'estanteria', nombre: `Estantería ${i}`, x: bloqueX, y: r3(y), w: bloqueW, h: altoEstante });
    y += altoEstante + separacion;
    const pasillo = { id: `pasillo-${i}`, clase: 'pasillo', nombre: i === 1 ? 'Pasillo principal' : `Pasillo ${i}`, x: bloqueX, y: r3(y), w: bloqueW, h: altoPasillo };
    regiones.push(pasillo);
    pasillos.push(pasillo);
    y += altoPasillo + separacion;
  }

  // Zona de tránsito a la derecha y zona restringida arriba o abajo de ella.
  const zonaX = r3(bloqueX + bloqueW + 0.06);
  const zonaW = r3(Math.min(0.96 - zonaX, 0.28));
  const restringidaAbajo = sucede(0.5);
  const altoRestringida = 0.18;
  const restringida = {
    id: 'restringida-1', clase: 'restringida', nombre: 'Zona restringida',
    x: zonaX, y: restringidaAbajo ? r3(0.96 - altoRestringida) : 0.04, w: zonaW, h: altoRestringida,
  };
  const transito = {
    id: 'transito-1', clase: 'transito', nombre: 'Zona de tránsito',
    x: zonaX, y: restringidaAbajo ? 0.04 : r3(0.04 + altoRestringida + 0.04), w: zonaW, h: r3(0.92 - altoRestringida - 0.04),
  };
  regiones.push(transito, restringida);

  const centro = (reg) => ({ x: reg.x + reg.w / 2, y: reg.y + reg.h / 2 });
  const dentro = (reg, margen = 0.04) => ({
    x: r3(entre(reg.x + margen, reg.x + reg.w - margen)),
    y: r3(entre(reg.y + margen, reg.y + reg.h - margen)),
  });

  // ---------- Mercadería en los pasillos (sin saturarlos) ----------
  const objetos = [];
  const eventos = [{ t: 0, texto: `Almacén generado: ${filas} filas de estanterías, ${op.personas} ${op.personas === 1 ? 'persona' : 'personas'} y ${op.montacargas} ${op.montacargas === 1 ? 'montacargas' : 'montacargas'}.` }];
  let nCaja = 0;
  let nPallet = 0;
  for (const p of pasillos) {
    const cantidad = entero(1, 3);
    for (let k = 0; k < cantidad; k++) {
      const pallet = sucede(0.4);
      const lado = pallet ? 0.08 : 0.045;
      const pos = { x: r3(entre(p.x + 0.05 + (p.w - 0.1) * (k / cantidad), p.x + 0.05 + (p.w - 0.1) * ((k + 1) / cantidad))), y: r3(entre(p.y + lado, p.y + p.h - lado)) };
      objetos.push(pallet
        ? { id: `pallet-${++nPallet}`, clase: 'pallet', w: lado, h: lado * 1.4, ruta: [{ t: 0, ...pos }] }
        : { id: `caja-${++nCaja}`, clase: 'caja', w: lado, h: lado * 1.4, ruta: [{ t: 0, ...pos }] });
    }
  }

  // ---------- Incidentes planificados ----------
  // Intrusión: una persona entra a la zona restringida durante un tiempo.
  let intrusion = null;
  if (sucede(riesgo.intrusion)) {
    const inicio = r1(entre(12, 38));
    const duracion = r1(op.riesgo === 'alto' ? entre(3.6, 6) : entre(1.5, 5.5));
    intrusion = { inicio, fin: r1(inicio + duracion), conMontacargas: sucede(riesgo.cercania) };
  }
  // Obstrucción: un pallet grande queda en la zona de tránsito.
  let obstruccion = null;
  if (sucede(riesgo.obstruccion)) {
    const inicio = r1(entre(15, 40));
    obstruccion = { inicio, fin: r1(Math.min(DURACION - 2, inicio + entre(3, 14))) };
  }

  // ---------- Montacargas ----------
  // Borde de la zona restringida del lado del tránsito: ahí espera el montacargas.
  const bordeRestringida = restringidaAbajo ? restringida.y - 0.05 : restringida.y + restringida.h + 0.05;
  const haciaAfuera = restringidaAbajo ? -1 : 1; // dirección que se aleja de la zona restringida
  for (let m = 1; m <= op.montacargas; m++) {
    const pasillo = pasillos[entero(0, pasillos.length - 1)];
    const yPasillo = r3(centro(pasillo).y);
    const xTransito = r3(transito.x + transito.w * (m === 1 ? 0.62 : 0.3));
    // El primero acude al borde de la zona restringida si el incidente lo requiere.
    const cerca = m === 1 && intrusion?.conMontacargas;
    const llegada = cerca ? r1(Math.max(3, intrusion.inicio - 2)) : r1(entre(4, 30));
    const salida = r1(llegada - 6);
    const ruta = [
      { t: Math.max(0, salida), x: 0.02, y: yPasillo },
      { t: r1(llegada - 2), x: r3(pasillo.x + pasillo.w - 0.02), y: yPasillo },
    ];
    let fin;
    if (cerca) {
      // Llega al borde cuando la persona entra y maniobra (sigue en movimiento) mientras ella está dentro.
      ruta.push({ t: llegada, x: xTransito, y: r3(bordeRestringida + haciaAfuera * 0.12) });
      ruta.push({ t: intrusion.inicio, x: xTransito, y: r3(bordeRestringida) });
      let paso = 0;
      for (let tt = intrusion.inicio + 1; tt <= intrusion.fin + 1; tt += 1) {
        paso += 1;
        ruta.push({ t: r1(tt), x: xTransito, y: r3(bordeRestringida + haciaAfuera * (paso % 2 ? 0.03 : 0)) });
      }
      fin = r1(Math.min(DURACION - 8, intrusion.fin + 1.5));
    } else {
      ruta.push({ t: llegada, x: xTransito, y: r3(entre(transito.y + 0.08, transito.y + transito.h - 0.08)) });
      fin = r1(llegada + 3);
    }
    ruta.push({ t: r1(fin + 4), x: xTransito, y: r3(centro(transito).y) });
    ruta.push({ t: r1(fin + 7), x: 0.98, y: r3(centro(transito).y) });
    const finCerca = fin;
    objetos.push({ id: `montacargas-${m}`, clase: 'montacargas', w: 0.08, h: 0.08, ruta: limpiarRuta(ruta), sale: Math.min(DURACION, r1(finCerca + 8)) });
    eventos.push({ t: Math.max(0, salida), texto: `Entra el montacargas ${m} por ${pasillo.nombre.toLowerCase()}.` });
  }

  // ---------- Personas ----------
  for (let p = 1; p <= op.personas; p++) {
    const id = `persona-${p}`;
    if (p === 1 && intrusion) {
      // La persona del incidente camina por el pasillo más cercano a la zona restringida hasta
      // el final, sigue por el corredor libre entre las estanterías y las zonas (sin
      // atravesar estantes) y entra a la zona restringida; luego vuelve por el mismo camino.
      const pasilloP = restringidaAbajo ? pasillos.at(-1) : pasillos[0];
      const yP = r3(centro(pasilloP).y);
      const corredorX = r3(restringida.x - 0.03); // a mitad del hueco entre estanterías y zonas
      const afuera = { x: corredorX, y: r3(centro(restringida).y) };
      const adentro = { x: r3(restringida.x + restringida.w * 0.45), y: r3(centro(restringida).y + (restringidaAbajo ? -0.02 : 0.02)) };
      const ruta = [
        { t: r1(Math.max(0, intrusion.inicio - 6)), x: 0.04, y: yP },
        { t: r1(intrusion.inicio - 2.2), x: corredorX, y: yP },
        { t: r1(intrusion.inicio - 0.4), ...afuera },
        { t: intrusion.inicio, ...adentro },
        { t: intrusion.fin, ...adentro },
        { t: r1(intrusion.fin + 0.6), ...afuera },
        { t: r1(intrusion.fin + 2.4), x: corredorX, y: yP },
        { t: r1(intrusion.fin + 6), x: 0.04, y: yP },
      ];
      objetos.push({ id, clase: 'persona', w: 0.03, h: 0.1, ruta: limpiarRuta(ruta), sale: Math.min(DURACION, r1(intrusion.fin + 6.5)) });
      eventos.push({ t: intrusion.inicio, texto: `Una persona entra a la zona restringida${intrusion.conMontacargas ? ' con el montacargas en movimiento cerca' : ''}.` });
      if (intrusion.fin - intrusion.inicio > 3) {
        eventos.push({ t: r1(intrusion.inicio + 3), texto: `Pasan 3 segundos en la zona restringida: corresponde una alerta (${intrusion.conMontacargas ? 'RN-02.2 si el montacargas sigue cerca' : 'RN-02.1'}).` });
      }
      continue;
    }
    // Las demás recorren un pasillo de ida y vuelta.
    const pasillo = pasillos[entero(0, pasillos.length - 1)];
    const yP = r3(entre(pasillo.y + 0.05, pasillo.y + pasillo.h - 0.05));
    const inicio = r1(entre(0, 30));
    const ida = r1(inicio + entre(6, 12));
    const vuelta = r1(Math.min(DURACION - 1, ida + entre(6, 12)));
    const ruta = [
      { t: inicio, x: 0.03, y: yP },
      { t: ida, x: r3(pasillo.x + pasillo.w - 0.03), y: yP },
      { t: vuelta, x: 0.03, y: yP },
    ];
    objetos.push({ id, clase: 'persona', w: 0.03, h: 0.1, ruta, sale: Math.min(DURACION, r1(vuelta + 0.5)) });
  }

  // ---------- Pallet que obstruye el tránsito ----------
  if (obstruccion) {
    const pos = dentro(transito, 0.12);
    objetos.push({ id: `pallet-${++nPallet}`, clase: 'pallet', w: r3(transito.w * 0.85), h: r3(transito.w * 0.85 * 1.05), ruta: [{ t: obstruccion.inicio, ...pos }], sale: obstruccion.fin });
    eventos.push({ t: obstruccion.inicio, texto: 'Un pallet queda en la zona de tránsito.' });
    if (obstruccion.fin - obstruccion.inicio > 5) {
      eventos.push({ t: r1(obstruccion.inicio + 5), texto: 'La zona de tránsito lleva 5 segundos obstruida: alerta de obstrucción (RN-02.3).' });
    }
    eventos.push({ t: obstruccion.fin, texto: 'Se retira el pallet de la zona de tránsito.' });
  }

  eventos.sort((a, b) => a.t - b.t);
  return {
    caso: 'CU-02',
    nombre: 'Almacén generado',
    prioridad: 1,
    version: 1,
    duracion: DURACION,
    semilla: Number.isInteger(semilla) ? semilla : 0,
    generado: { version: VERSION_GENERADOR, opciones: op, intrusion, obstruccion },
    regiones,
    objetos,
    eventos: eventos.filter((e, i, l) => e.t >= 0 && e.t <= DURACION && (i === 0 || e.texto !== l[i - 1].texto)),
    esperado: {
      alertas: [],
      advertencias: [],
      informativas: [],
      resumen: `Escena generada (riesgo ${RIESGOS[op.riesgo].nombre.toLowerCase()}): ${describirIncidentes(intrusion, obstruccion)}.`,
    },
  };
}

// Quita puntos fuera de 0..duración, ordena y evita tiempos repetidos.
function limpiarRuta(ruta) {
  const salida = [];
  for (const p of ruta) {
    const punto = { t: Math.max(0, Math.min(DURACION, r1(p.t))), x: Math.max(0, Math.min(1, r3(p.x))), y: Math.max(0, Math.min(1, r3(p.y))) };
    if (salida.length && punto.t <= salida.at(-1).t) punto.t = r1(salida.at(-1).t + 0.1);
    if (punto.t <= DURACION) salida.push(punto);
  }
  return salida;
}

function describirIncidentes(intrusion, obstruccion) {
  const partes = [];
  if (intrusion) partes.push(`intrusión de ${coma(r1(intrusion.fin - intrusion.inicio))} s en la zona restringida${intrusion.conMontacargas ? ' con montacargas cerca' : ''}`);
  if (obstruccion) partes.push(`obstrucción del tránsito durante ${coma(r1(obstruccion.fin - obstruccion.inicio))} s`);
  return partes.length ? partes.join(' y ') : 'sin incidentes planificados';
}

// Reconstruye el guion de una sesión guardada (para la evidencia y el historial).
export function guionDeSesion(sesion, casoPorId) {
  if (sesion?.generado) return generarAlmacen(sesion.semilla, sesion.generado.opciones);
  return casoPorId(sesion.caso);
}
