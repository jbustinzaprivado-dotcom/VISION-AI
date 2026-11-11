// Lee un guion en un instante t (segundos de simulación).
// Las posiciones de la ruta son el CENTRO de la figura, en coordenadas 0..1.

// Devuelve { x, y } o null si la figura todavía no aparece o ya salió.
export function posicionEn(objeto, t) {
  const ruta = objeto.ruta;
  if (t < ruta[0].t) return null;
  if (objeto.sale != null && t >= objeto.sale) return null;

  for (let i = 0; i < ruta.length - 1; i++) {
    const a = ruta[i];
    const b = ruta[i + 1];
    if (t <= b.t) {
      const f = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  const ultimo = ruta[ruta.length - 1];
  return { x: ultimo.x, y: ultimo.y }; // se queda en su último punto
}

// ¿Se está moviendo en el instante t? (está entre dos puntos distintos de su ruta)
export function enMovimiento(objeto, t) {
  if (!posicionEn(objeto, t)) return false;
  const ruta = objeto.ruta;
  for (let i = 0; i < ruta.length - 1; i++) {
    const a = ruta[i];
    const b = ruta[i + 1];
    if (t >= a.t && t < b.t) return a.x !== b.x || a.y !== b.y;
  }
  return false;
}

// Atributos vigentes en t: los iniciales más los cambios ya ocurridos.
export function atributosEn(elemento, t) {
  const actuales = { ...(elemento.atributos ?? {}) };
  for (const c of elemento.cambios ?? []) {
    if (c.t <= t) actuales[c.atributo] = c.valor;
  }
  return actuales;
}

// Estado completo de la escena en t: qué figuras hay, dónde y con qué atributos.
export function escenaEn(guion, t) {
  const objetos = [];
  for (const o of guion.objetos) {
    const pos = posicionEn(o, t);
    if (!pos) continue;
    objetos.push({
      id: o.id,
      clase: o.clase,
      x: pos.x,
      y: pos.y,
      w: o.w,
      h: o.h,
      enMovimiento: enMovimiento(o, t),
      atributos: atributosEn(o, t),
    });
  }
  const regiones = guion.regiones.map((r) => ({ ...r, atributos: atributosEn(r, t) }));
  return { t, regiones, objetos };
}
