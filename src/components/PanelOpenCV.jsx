import { useEffect, useRef } from 'react';
import { Cpu, Loader2 } from 'lucide-react';

// Panel de la capa OpenCV: compara lo que estimó la visión por píxeles con la
// verdad de la simulación (geometría) en el cuadro actual y en promedio.
const pct = (v) => `${Math.round(v * 100)} %`;
const dec = (v) => v.toFixed(2).replace('.', ',');
const signo = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;

export default function PanelOpenCV({ estado, error, vision, nombres }) {
  return (
    <section className="panel-opencv" aria-label="Visión por píxeles con OpenCV">
      <h2>
        <Cpu className="icono" aria-hidden="true" /> Visión por píxeles (OpenCV)
      </h2>
      {estado === 'cargando' && (
        <p className="nota">
          <Loader2 className="icono girando" aria-hidden="true" /> Cargando OpenCV (unos 4 MB, solo la primera vez)…
        </p>
      )}
      {estado === 'error' && <p className="error">{error}</p>}
      {estado === 'listo' && !vision && <p className="nota">Inicia o mueve la escena para analizar los píxeles.</p>}
      {estado === 'listo' && vision && <Contenido vision={vision} nombres={nombres} />}
      <p className="nota">
        OpenCV solo ve la imagen: resta el lugar vacío, aplica umbral y morfología y busca contornos. Se compara con la
        geometría real del mismo cuadro. Las alertas siguen saliendo de la geometría.
      </p>
    </section>
  );
}

function Contenido({ vision, nombres }) {
  const { deteccion: d, ocupacion: o, pixeles: p, promedio: m } = vision;
  return (
    <>
      <div className="metricas-cv">
        <Metrica titulo="Objetos" valor={`${p.cajas.length} / ${vision.reales}`} detalle="detectados / reales" />
        <Metrica titulo="Precisión" valor={pct(d.precision)} detalle={`${d.fp} falsos positivos`} />
        <Metrica titulo="Recall" valor={pct(d.recall)} detalle={`${d.fn} sin detectar`} />
        <Metrica titulo="IoU medio" valor={dec(d.iouMedio)} detalle="de las cajas emparejadas" />
      </div>
      <p className="nota">
        Cuadro {vision.cuadro} · procesado en {Math.round(p.ms)} ms · error medio de ocupación {Math.round(o.errorMedio * 100)} puntos.
        <br />
        Promedio de {m.cuadros} {m.cuadros === 1 ? 'cuadro' : 'cuadros'}: precisión {pct(m.precision / m.cuadros)}, recall{' '}
        {pct(m.recall / m.cuadros)}, IoU {dec(m.iou / m.cuadros)}, error {Math.round((m.error / m.cuadros) * 100)} puntos.
      </p>
      <table className="tabla-cv">
        <thead>
          <tr>
            <th scope="col">Región</th>
            <th scope="col">Real</th>
            <th scope="col">OpenCV</th>
            <th scope="col">Error</th>
          </tr>
        </thead>
        <tbody>
          {o.filas.map((f) => (
            <tr key={f.region}>
              <th scope="row">{nombres[f.region] ?? f.region}</th>
              <td>{pct(f.real)}</td>
              <td>{pct(f.estimada)}</td>
              <td className={Math.abs(f.error) >= 0.05 ? 'cambio' : ''}>{signo(f.error)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figure className="mascara-cv">
        <Mascara mascara={p.mascara} />
        <figcaption>Máscara de primer plano: lo que OpenCV considera "objeto" (blanco).</figcaption>
      </figure>
    </>
  );
}

function Metrica({ titulo, valor, detalle }) {
  return (
    <div className="metrica-cv">
      <span className="kpi-titulo">{titulo}</span>
      <strong>{valor}</strong>
      <span className="kpi-detalle">{detalle}</span>
    </div>
  );
}

// Dibuja la máscara binaria (1 canal) en un canvas pequeño.
function Mascara({ mascara }) {
  const lienzo = useRef(null);
  useEffect(() => {
    const c = lienzo.current;
    if (!c) return;
    const imagen = new ImageData(mascara.width, mascara.height);
    for (let i = 0; i < mascara.data.length; i++) {
      const v = mascara.data[i];
      imagen.data[i * 4] = v;
      imagen.data[i * 4 + 1] = v;
      imagen.data[i * 4 + 2] = v;
      imagen.data[i * 4 + 3] = 255;
    }
    c.getContext('2d').putImageData(imagen, 0, 0);
  }, [mascara]);
  return <canvas ref={lienzo} width={mascara.width} height={mascara.height} />;
}
