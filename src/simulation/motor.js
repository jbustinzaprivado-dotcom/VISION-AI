// Motor de escenas: convierte el guion en cuadros.
// La semilla agrega una pequeña variación (ruido) a las figuras que se mueven
// y a las personas, para que la escena se vea natural; la misma semilla
// produce siempre exactamente la misma escena (Proyecto, sección 5.1).
import seedrandom from 'seedrandom';
import { escenaEn } from './trayectoria.js';
import { FPS, indiceCuadro } from './reloj.js';

export const RUIDO = 0.002; // desplazamiento máximo, en coordenadas 0..1

const limitar = (v) => Math.max(0, Math.min(1, v));

// Escena en el instante t con el ruido del cuadro al que pertenece.
// El generador se crea por cuadro: el resultado no depende del orden en que
// se recorren los cuadros (saltar en la línea de tiempo da lo mismo que reproducir).
export function escenaConRuido(guion, t, semilla) {
  const indice = indiceCuadro(t);
  const escena = escenaEn(guion, t);
  const azar = seedrandom(`${guion.caso}|${semilla}|${indice}`);
  const objetos = escena.objetos.map((o) => {
    if (!o.enMovimiento && o.clase !== 'persona') return o;
    const dx = (azar() * 2 - 1) * RUIDO;
    const dy = (azar() * 2 - 1) * RUIDO;
    return { ...o, x: limitar(o.x + dx), y: limitar(o.y + dy) };
  });
  return { ...escena, indice, objetos };
}

// Cuadro número `indice` de la sesión (lo que recibirá el análisis en la fase 4).
export function generarCuadro(guion, indice, semilla) {
  const t = Math.min(guion.duracion, indice / FPS);
  return escenaConRuido(guion, t, semilla);
}

export function totalCuadros(guion) {
  return Math.floor(guion.duracion * FPS) + 1;
}

// Evento del guion vigente en t (para los subtítulos del modo presentación).
export function eventoActual(guion, t) {
  let actual = null;
  for (const ev of guion.eventos) if (ev.t <= t) actual = ev;
  return actual;
}
