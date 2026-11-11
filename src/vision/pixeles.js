// Análisis por PÍXELES con OpenCV (visión por computadora clásica).
// A diferencia del análisis geométrico, aquí no se usan las posiciones de las
// figuras: solo la imagen que "ve" la cámara simulada.
//
// Pasos (sustracción de fondo):
//   1. Diferencia absoluta entre el cuadro actual y la imagen del lugar vacío.
//   2. Mayor diferencia entre los canales de color (rojo, verde, azul) y umbral: los
//      píxeles que cambiaron son "primer plano". Se usa el canal que más cambió, y no la
//      escala de grises, porque dos colores distintos con brillo parecido (un carro gris
//      sobre una salida verde) casi no se diferencian en gris: bajo contraste.
//   3. Apertura y cierre morfológicos: quitan ruido y rellenan huecos.
//   4. Ocupación de cada región = píxeles de primer plano ÷ píxeles de la región.
//   5. Contornos externos → cajas de los objetos detectados.
//
// Entradas: `frame` y `fondo` con la forma de un ImageData ({ data, width, height }).
// Las regiones llegan en coordenadas 0..1; los resultados salen también en 0..1.

export const PARAMETROS = { umbral: 28, nucleoApertura: 3, nucleoCierre: 5, areaMinima: 24 };

export function analizarPixeles(cv, { frame, fondo, regiones = [], parametros = {} }) {
  const p = { ...PARAMETROS, ...parametros };
  const inicio = performance.now();
  const W = frame.width;
  const H = frame.height;
  const mats = [];
  const nuevo = (m) => (mats.push(m), m);

  try {
    const actual = nuevo(cv.matFromImageData(frame));
    const vacio = nuevo(cv.matFromImageData(fondo));
    const diferencia = nuevo(new cv.Mat());
    cv.absdiff(actual, vacio, diferencia);
    const canales = nuevo(new cv.MatVector());
    cv.split(diferencia, canales);
    const rojo = nuevo(canales.get(0));
    const verde = nuevo(canales.get(1));
    const azul = nuevo(canales.get(2));
    nuevo(canales.get(3)); // alfa: no se usa (siempre opaco), pero hay que liberarlo
    const cambio = nuevo(new cv.Mat());
    cv.max(rojo, verde, cambio);
    cv.max(cambio, azul, cambio);
    const mascara = nuevo(new cv.Mat());
    cv.threshold(cambio, mascara, p.umbral, 255, cv.THRESH_BINARY);
    const apertura = nuevo(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(p.nucleoApertura, p.nucleoApertura)));
    cv.morphologyEx(mascara, mascara, cv.MORPH_OPEN, apertura);
    const cierre = nuevo(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(p.nucleoCierre, p.nucleoCierre)));
    cv.morphologyEx(mascara, mascara, cv.MORPH_CLOSE, cierre);

    // Ocupación por región: proporción de píxeles de primer plano dentro de su rectángulo.
    const ocupacion = {};
    for (const r of regiones) {
      const x = Math.max(0, Math.round(r.x * W));
      const y = Math.max(0, Math.round(r.y * H));
      const w = Math.min(W - x, Math.round(r.w * W));
      const h = Math.min(H - y, Math.round(r.h * H));
      if (w <= 0 || h <= 0) continue;
      const roi = nuevo(mascara.roi(new cv.Rect(x, y, w, h)));
      ocupacion[r.id] = cv.countNonZero(roi) / (w * h);
    }

    // Contornos externos → cajas detectadas.
    const contornos = nuevo(new cv.MatVector());
    const jerarquia = nuevo(new cv.Mat());
    cv.findContours(mascara, contornos, jerarquia, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const cajas = [];
    for (let i = 0; i < contornos.size(); i++) {
      const c = contornos.get(i);
      const rect = cv.boundingRect(c);
      c.delete();
      if (rect.width * rect.height < p.areaMinima) continue;
      cajas.push({ x: rect.x / W, y: rect.y / H, w: rect.width / W, h: rect.height / H });
    }

    return {
      ocupacion,
      cajas,
      pixelesPrimerPlano: cv.countNonZero(mascara) / (W * H),
      mascara: { data: new Uint8Array(mascara.data), width: W, height: H }, // 1 canal: 0 o 255
      ms: performance.now() - inicio,
    };
  } finally {
    for (const m of mats) m.delete(); // OpenCV.js no libera memoria solo: hay que borrar cada Mat
  }
}
