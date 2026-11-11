import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CASOS } from '../simulation/casos.js';
import { EPOCAS, ETAPAS, curvas, ejemplos, matrizConfusion, puntuaciones, validacion } from '../training/entrenamiento.js';
import MiniEscena from '../components/MiniEscena.jsx';

// Animación ILUSTRATIVA de cómo se prepararía un modelo, en seis etapas.
// Los datos salen de fórmulas fijas: no hay entrenamiento real.
const MS_POR_EPOCA = 200;
const MS_POR_ETAPA = 4500;
const pct = (v) => `${Math.round(v * 100)} %`;
const dec = (v) => v.toFixed(2).replace('.', ',');

function prefiereMenosMovimiento() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function Entrenamiento() {
  const [idCaso, setIdCaso] = useState(CASOS[0].caso);
  const guion = CASOS.find((c) => c.caso === idCaso);
  const [etapa, setEtapa] = useState(0);
  const [epoca, setEpoca] = useState(0);
  const [automatico, setAutomatico] = useState(false);
  const [umbral, setUmbral] = useState(0.5);

  const datos = useMemo(
    () => ({
      curvas: curvas(idCaso),
      ejemplos: ejemplos(guion),
      validacion: validacion(guion),
      puntuaciones: puntuaciones(idCaso),
    }),
    [idCaso, guion],
  );

  // Al cambiar de caso, la animación vuelve al principio.
  useEffect(() => {
    setEtapa(0);
    setEpoca(0);
    setAutomatico(false);
  }, [idCaso]);

  // Etapa 3: las épocas avanzan solas (o aparecen todas si se pidió menos movimiento).
  const enEntrenamiento = ETAPAS[etapa].id === 'entrenamiento';
  useEffect(() => {
    if (!enEntrenamiento || epoca >= EPOCAS) return undefined;
    if (prefiereMenosMovimiento()) {
      setEpoca(EPOCAS);
      return undefined;
    }
    const id = setTimeout(() => setEpoca((e) => e + 1), MS_POR_EPOCA);
    return () => clearTimeout(id);
  }, [enEntrenamiento, epoca]);

  // Reproducción automática: pasa a la siguiente etapa cuando la actual terminó.
  useEffect(() => {
    if (!automatico || etapa >= ETAPAS.length - 1) return undefined;
    if (enEntrenamiento && epoca < EPOCAS) return undefined;
    const id = setTimeout(() => setEtapa((e) => e + 1), MS_POR_ETAPA);
    return () => clearTimeout(id);
  }, [automatico, etapa, enEntrenamiento, epoca]);

  const irA = (n) => setEtapa(Math.max(0, Math.min(ETAPAS.length - 1, n)));
  const reiniciar = () => {
    setEtapa(0);
    setEpoca(0);
    setAutomatico(false);
  };

  return (
    <div className="entrenamiento">
      <header className="analisis-cabecera">
        <h1>Entrenamiento</h1>
        <p className="aviso-ilustrativo">
          <span className="rotulo">PROTOTIPO</span> Ilustrativo: no es un entrenamiento real. Las curvas y los
          resultados salen de fórmulas fijas.
        </p>
        <div className="casos" role="group" aria-label="Caso de uso">
          {CASOS.map((c) => (
            <button key={c.caso} type="button" className={c.caso === idCaso ? '' : 'secundario'}
              aria-pressed={c.caso === idCaso} onClick={() => setIdCaso(c.caso)}>
              {c.caso} · {c.nombre}
            </button>
          ))}
        </div>
      </header>

      <ol className="etapas">
        {ETAPAS.map((e, i) => (
          <li key={e.id}>
            <button type="button" className={i === etapa ? '' : 'secundario'} aria-current={i === etapa ? 'step' : undefined}
              onClick={() => irA(i)}>
              {e.titulo}
            </button>
          </li>
        ))}
      </ol>

      <section className="panel etapa" aria-live="polite">
        <h2>{ETAPAS[etapa].titulo}</h2>
        <ContenidoEtapa id={ETAPAS[etapa].id} datos={datos} epoca={epoca} umbral={umbral} setUmbral={setUmbral} guion={guion} />
      </section>

      <div className="botones">
        <button type="button" className="secundario" onClick={() => irA(etapa - 1)} disabled={etapa === 0}>
          Anterior
        </button>
        <button type="button" className="secundario" onClick={() => irA(etapa + 1)} disabled={etapa === ETAPAS.length - 1}>
          Siguiente
        </button>
        <button type="button" onClick={() => setAutomatico((a) => !a)}>
          {automatico ? 'Detener reproducción' : 'Reproducir todo'}
        </button>
        <button type="button" className="secundario" onClick={reiniciar}>
          Reiniciar
        </button>
      </div>
    </div>
  );
}

function ContenidoEtapa({ id, datos, epoca, umbral, setUmbral, guion }) {
  if (id === 'ejemplos') {
    return (
      <>
        <p>El modelo aprende de ejemplos en los que cada figura ya tiene su caja y su clase marcadas.</p>
        <div className="galeria">
          {datos.ejemplos.map((e) => (
            <figure key={e.t}>
              <MiniEscena escena={e} etiquetas titulo={`Ejemplo etiquetado en t=${e.t} s`} />
              <figcaption>Muestra en t = {e.t} s · {e.objetos.length} figuras etiquetadas</figcaption>
            </figure>
          ))}
        </div>
      </>
    );
  }

  if (id === 'preparacion') {
    const muestra = datos.ejemplos[1];
    const pasos = [
      { titulo: 'Original', estilo: {} },
      { titulo: 'Redimensionada', estilo: { width: '60%' } },
      { titulo: 'Normalizada (escala de grises)', estilo: { filter: 'grayscale(1) contrast(1.2)' } },
      { titulo: 'Aumentada (volteo horizontal)', estilo: { transform: 'scaleX(-1)' } },
    ];
    return (
      <>
        <p>Antes de entrenar, cada muestra se ajusta a un tamaño fijo, se normaliza y se generan variaciones para tener más ejemplos.</p>
        <div className="galeria">
          {pasos.map((p) => (
            <figure key={p.titulo}>
              <MiniEscena escena={muestra} estilo={p.estilo} titulo={p.titulo} />
              <figcaption>{p.titulo}</figcaption>
            </figure>
          ))}
        </div>
      </>
    );
  }

  if (id === 'entrenamiento') {
    const visibles = datos.curvas.slice(0, epoca);
    const ultima = visibles.at(-1);
    return (
      <>
        <p>En cada época el modelo revisa todos los ejemplos: el error baja y la precisión sube.</p>
        <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={EPOCAS} aria-valuenow={epoca}>
          <span style={{ width: `${(epoca / EPOCAS) * 100}%` }} />
        </div>
        <p className="nota">
          Época {epoca} de {EPOCAS}
          {ultima && ` · error ${dec(ultima.error)} · precisión ${pct(ultima.precision)}`}
        </p>
        <div className="grafico">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={visibles} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#e2e8f0" />
              <XAxis dataKey="epoca" type="number" domain={[1, EPOCAS]} label={{ value: 'Época', position: 'insideBottom', offset: -4 }} />
              <YAxis domain={[0, 1.4]} />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Line type="monotone" dataKey="error" name="Error (pérdida)" stroke="#dc2626" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="precision" name="Precisión" stroke="#0891b2" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </>
    );
  }

  if (id === 'validacion') {
    const { escena, pares } = datos.validacion;
    const media = pares.reduce((s, p) => s + p.iou, 0) / pares.length;
    return (
      <>
        <p>
          Con ejemplos que el modelo no vio, se comparan las cajas reales (verde) con las predichas (rojo punteado). El
          IoU mide cuánto se solapan: 1 es perfecto.
        </p>
        <div className="validacion">
          <MiniEscena escena={{ ...escena, objetos: [] }} cajas={pares} titulo="Cajas reales frente a predichas" />
          <table>
            <thead>
              <tr><th scope="col">Figura</th><th scope="col">IoU</th></tr>
            </thead>
            <tbody>
              {pares.map((p) => (
                <tr key={p.id}><td>{p.id}</td><td>{dec(p.iou)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="nota">IoU medio: {dec(media)}</p>
      </>
    );
  }

  if (id === 'umbral') {
    const m = matrizConfusion(datos.puntuaciones, umbral);
    return (
      <>
        <p>
          El umbral decide desde qué confianza se acepta una detección. Más alto: menos falsas alarmas (más precisión),
          pero se escapan más casos (menos recall).
        </p>
        <label className="deslizador">
          Umbral: <strong>{dec(umbral)}</strong>
          <input type="range" min={0.1} max={0.9} step={0.05} value={umbral} onChange={(e) => setUmbral(Number(e.target.value))} />
        </label>
        <table className="matriz">
          <caption>Matriz de confusión (120 muestras de validación)</caption>
          <thead>
            <tr><th /><th scope="col">Predicho: sí</th><th scope="col">Predicho: no</th></tr>
          </thead>
          <tbody>
            <tr><th scope="row">Real: sí</th><td>{m.vp} aciertos</td><td>{m.fn} no detectados</td></tr>
            <tr><th scope="row">Real: no</th><td>{m.fp} falsas alarmas</td><td>{m.vn} descartes correctos</td></tr>
          </tbody>
        </table>
        <p className="nota">Precisión {pct(m.precision)} · Recall {pct(m.recall)}</p>
      </>
    );
  }

  const final = datos.curvas.at(-1);
  return (
    <div className="listo">
      <span className="insignia">Modelo de prototipo listo</span>
      <p>
        {guion.caso} · {guion.nombre}: precisión final ilustrativa {pct(final.precision)} tras {EPOCAS} épocas.
      </p>
      <p className="nota">Recuerda: es una animación didáctica. El análisis de la escena usa geometría, no este modelo.</p>
      <Link to="/analisis" className="enlace-boton">Ir a Análisis visual</Link>
    </div>
  );
}
