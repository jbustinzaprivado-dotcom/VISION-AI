import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Resultados REALES del entrenamiento del modelo publicado (los escribe
// entrenamiento/entrenar_yolo.py en src/vision/yolo/modelo/resultados.json).
// Si todavía no hay modelo entrenado, la sección lo dice.
const encontrados = import.meta.glob('../vision/yolo/modelo/resultados.json', { eager: true, import: 'default' });
const RESULTADOS = Object.values(encontrados)[0] ?? null;

// Con un decimal: redondear 99,6 % a "100 %" exageraría el resultado.
const pct = (v) => `${(v * 100).toFixed(1).replace('.', ',')} %`;
const dec = (v) => v.toFixed(2).replace('.', ',');

export default function ResultadosYolo({ resultados = RESULTADOS }) {
  if (!resultados) return <p className="nota">Todavía no hay un modelo entrenado en el proyecto.</p>;
  const r = resultados;
  const f = r.final;
  return (
    <>
      <p>
        Modelo <strong>{r.modelo}</strong> entrenado {r.epocas} épocas con {r.imagenes.train} imágenes de entrenamiento y {r.imagenes.val}{' '}
        de validación ({r.equipo}). Resultado sobre las escenas de validación:
      </p>
      <div className="metricas-cv">
        <Metrica titulo="mAP50" valor={pct(f.mAP50)} detalle="aciertos con IoU ≥ 0,5" />
        <Metrica titulo="mAP50-95" valor={pct(f.mAP50_95)} detalle="exigiendo cajas más ajustadas" />
        <Metrica titulo="Precisión" valor={pct(f.precision)} detalle="detecciones correctas" />
        <Metrica titulo="Recall" valor={pct(f.recall)} detalle="objetos encontrados" />
      </div>
      <div className="grafico" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={r.historial} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--borde)" />
            <XAxis dataKey="epoca" stroke="var(--texto-suave)" fontSize={12} />
            <YAxis domain={[0, 1]} stroke="var(--texto-suave)" fontSize={12} tickFormatter={(v) => `${Math.round(v * 100)}`} />
            <Tooltip formatter={(v) => pct(v)} labelFormatter={(e) => `Época ${e}`} />
            <Legend />
            <Line type="monotone" dataKey="mAP50" name="mAP50" stroke="var(--accion)" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="mAP50_95" name="mAP50-95" stroke="var(--exito)" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="tabla-cv">
        <caption>Por clase (validación)</caption>
        <thead>
          <tr>
            <th scope="col">Clase</th>
            <th scope="col">Objetos</th>
            <th scope="col">mAP50</th>
            <th scope="col">mAP50-95</th>
          </tr>
        </thead>
        <tbody>
          {r.clases.map((c) => (
            <tr key={c.clase}>
              <th scope="row">{c.clase}</th>
              <td>{c.instancias}</td>
              <td>{pct(c.mAP50)}</td>
              <td>{pct(c.mAP50_95)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nota">
        Inferencia en el navegador con ONNX Runtime Web ({dec(r.tamanoMB)} MB, entrada {r.entrada.join(' × ')}). Entrenado el{' '}
        {new Date(`${r.fecha}T12:00:00`).toLocaleDateString('es')}.
      </p>
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
