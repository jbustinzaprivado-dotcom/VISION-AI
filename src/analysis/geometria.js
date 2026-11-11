// Cálculos geométricos básicos. Todo en coordenadas 0..1.
// Las regiones son rectángulos { x, y, w, h } con (x, y) en la esquina superior izquierda.
// Las figuras tienen (x, y) en su centro; cajaDe las convierte a rectángulo.

export function cajaDe(figura) {
  return { x: figura.x - figura.w / 2, y: figura.y - figura.h / 2, w: figura.w, h: figura.h };
}

export function areaSuperpuesta(a, b) {
  const ancho = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const alto = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ancho * alto;
}

// ¿El centro de la figura está dentro de la región?
export function estaDentro(region, figura) {
  return (
    figura.x >= region.x &&
    figura.x <= region.x + region.w &&
    figura.y >= region.y &&
    figura.y <= region.y + region.h
  );
}

// Proporción de la región cubierta por figuras (entre 0 y 1).
export function ocupacion(region, figuras) {
  const cubierto = figuras.reduce((suma, f) => suma + areaSuperpuesta(region, cajaDe(f)), 0);
  return Math.min(1, cubierto / (region.w * region.h));
}

// IoU (intersección sobre unión): cuánto se solapan dos rectángulos, de 0 a 1.
export function iou(a, b) {
  const interseccion = areaSuperpuesta(a, b);
  const union = a.w * a.h + b.w * b.h - interseccion;
  return union > 0 ? interseccion / union : 0;
}

export function distancia(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
