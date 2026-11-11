// Carga diferida de OpenCV.js (WebAssembly, unos 3,9 MB comprimidos).
// Solo se descarga cuando el usuario activa la capa "OpenCV": el resto de la
// aplicación no la necesita. Vite publica el archivo en /assets con un nombre
// único, así que el navegador lo guarda en caché permanente y lo descarga una vez.
//
// Se carga con una etiqueta <script> (y no con import) porque el módulo de OpenCV
// trae un método `then` que confunde a las promesas al importarlo como módulo.
let promesa = null;

export function cargarOpenCV(cargador = cargarEnNavegador) {
  if (!promesa) {
    promesa = cargador()
      .then(prepararCv)
      .catch((error) => {
        promesa = null; // permite reintentar si falló la descarga
        throw error;
      });
  }
  return promesa;
}

async function cargarEnNavegador() {
  const { default: url } = await import('@techstark/opencv-js/dist/opencv.js?url');
  await new Promise((listo, fallo) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = listo;
    script.onerror = () => fallo(new Error('No se pudo descargar OpenCV.js. Revisa la conexión y vuelve a intentarlo.'));
    document.head.appendChild(script);
  });
  return window.cv;
}

// OpenCV puede llegar como promesa o como módulo que aún se está inicializando.
// Se devuelve { cv } envuelto para que `await` no intente "desenvolver" el módulo.
export async function prepararCv(cv) {
  let listo = cv;
  if (listo instanceof Promise) listo = await listo;
  if (!listo.Mat) await new Promise((fin) => (listo.onRuntimeInitialized = fin));
  return { cv: listo };
}
