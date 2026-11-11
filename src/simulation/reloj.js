// Reloj de simulación: lleva su propio tiempo, independiente de la hora real.
// Funciones puras: reciben un reloj y devuelven uno nuevo (fáciles de probar).

export const FPS = 12; // cuadros de análisis por segundo (el documento pide 10–15)
export const VELOCIDADES = [0.5, 1, 2, 4];

export function crearReloj(duracion) {
  return { t: 0, duracion, velocidad: 1, pausado: true, terminado: false };
}

// Avanza según el tiempo real transcurrido (segundos) multiplicado por la velocidad.
export function avanzar(reloj, dtReal) {
  if (reloj.pausado || reloj.terminado) return reloj;
  const t = Math.min(reloj.duracion, reloj.t + dtReal * reloj.velocidad);
  const terminado = t >= reloj.duracion;
  return { ...reloj, t, terminado, pausado: terminado };
}

export function iniciar(reloj) {
  if (reloj.terminado) return reloj; // una sesión terminada no se reanuda
  return { ...reloj, pausado: false };
}

export function pausar(reloj) {
  return { ...reloj, pausado: true };
}

export function cambiarVelocidad(reloj, velocidad) {
  if (!VELOCIDADES.includes(velocidad)) throw new Error(`Velocidad no permitida: ${velocidad}`);
  return { ...reloj, velocidad };
}

// Paso a paso: pausa y avanza exactamente al siguiente cuadro.
export function pasoAPaso(reloj) {
  if (reloj.terminado) return reloj;
  const t = Math.min(reloj.duracion, (indiceCuadro(reloj.t) + 1) / FPS);
  return { ...reloj, t, pausado: true, terminado: t >= reloj.duracion };
}

// Salta a un instante (línea de tiempo). Queda en pausa.
export function saltarA(reloj, t) {
  const limitado = Math.max(0, Math.min(reloj.duracion, t));
  return { ...reloj, t: limitado, pausado: true, terminado: limitado >= reloj.duracion };
}

export function reiniciar(reloj) {
  return { ...crearReloj(reloj.duracion), velocidad: reloj.velocidad };
}

export function indiceCuadro(t) {
  return Math.floor(t * FPS + 1e-9);
}
