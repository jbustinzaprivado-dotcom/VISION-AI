// Vista 3D (DT-10): de las coordenadas del guion (0..1, vista cenital 16:9) al mundo
// 3D en metros. Funciones puras, sin Three.js, para poder probarlas en Node.
//
// La escena mide 16 × 9 m. El eje x del guion es el x del mundo y el y del guion es
// la profundidad (z); la altura (y del mundo) la pone cada tipo de figura.
export const MUNDO = { ancho: 16, fondo: 9 };

// Altura de cada figura (m) y a qué altura apoya. Los productos van sobre la cinta.
export const ALTURAS = {
  persona: 1.75,
  montacargas: 2.1,
  pallet: 0.9, // tarima + carga
  caja: 0.55,
  carro: 1.1,
  estante: 1.6,
  producto: 0.3,
};
export const ALTO_CINTA = 0.85;
export const ALTO_ESTANTERIA = 2.1;
export const ALTO_GENERICO = 1;

export function aMundo(x, y) {
  return { x: (x - 0.5) * MUNDO.ancho, z: (y - 0.5) * MUNDO.fondo };
}

export function tamanoEnMundo(figura) {
  return { ancho: figura.w * MUNDO.ancho, fondo: figura.h * MUNDO.fondo };
}

// Posición y medidas 3D de una figura del cuadro.
export function ubicar(figura, regiones = []) {
  const { x, z } = aMundo(figura.x, figura.y);
  const { ancho, fondo } = tamanoEnMundo(figura);
  const sobreCinta = figura.clase === 'producto' && regiones.some((r) => r.clase === 'cinta' && dentro(r, figura));
  return { x, z, base: sobreCinta ? ALTO_CINTA : 0, ancho, fondo, alto: ALTURAS[figura.clase] ?? ALTO_GENERICO };
}

function dentro(r, f) {
  return f.x >= r.x && f.x <= r.x + r.w && f.y >= r.y && f.y <= r.y + r.h;
}

// Rectángulo de una región en el piso (centro y medidas en metros).
export function ubicarRegion(r) {
  const { x, z } = aMundo(r.x + r.w / 2, r.y + r.h / 2);
  return { x, z, ancho: r.w * MUNDO.ancho, fondo: r.h * MUNDO.fondo };
}

// Hacia dónde mira una figura: según hacia dónde se movió desde el cuadro anterior.
// Si casi no se movió, conserva el rumbo que tenía (sin "temblar" por el ruido).
// Ángulo en radianes alrededor del eje vertical; 0 = mirando hacia +x.
export function rumbo(anterior, actual, previo = 0, minimo = 0.004) {
  if (!anterior) return previo;
  const dx = actual.x - anterior.x;
  const dy = actual.y - anterior.y;
  if (Math.hypot(dx, dy) < minimo) return previo;
  return Math.atan2(-dy * MUNDO.fondo, dx * MUNDO.ancho);
}

// Objetivos (figuras y regiones) con alerta activa.
export function marcados(alertas) {
  return {
    figuras: new Set(alertas.filter((a) => a.tipoObjetivo !== 'region').map((a) => a.objetivo)),
    regiones: new Set(alertas.filter((a) => a.tipoObjetivo === 'region').map((a) => a.objetivo)),
  };
}
