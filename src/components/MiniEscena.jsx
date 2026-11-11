import clases from '../simulation/clases.json';

// Escena en miniatura (SVG) para la animación de entrenamiento.
// `etiquetas` dibuja la caja y la clase de cada figura, como en un conjunto de datos etiquetado.
// `cajas` permite dibujar pares real/predicha (etapa de validación).
const W = 160;
const H = 90;

export default function MiniEscena({ escena, etiquetas = false, cajas = [], resaltado = null, estilo, titulo }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mini-escena" style={estilo} role="img" aria-label={titulo}>
      <rect width={W} height={H} fill="#f8fafc" />
      {escena.regiones
        .filter((r) => r.clase !== 'suelo')
        .map((r) => (
          <rect key={r.id} x={r.x * W} y={r.y * H} width={r.w * W} height={r.h * H}
            fill={clases.regiones[r.clase].color} opacity={0.5} />
        ))}
      {escena.objetos.map((o) => {
        const x = (o.x - o.w / 2) * W;
        const y = (o.y - o.h / 2) * H;
        return (
          <g key={o.id}>
            <rect x={x} y={y} width={o.w * W} height={o.h * H} fill={clases.objetos[o.clase].color} />
            {etiquetas && (
              <>
                <rect x={x - 1} y={y - 1} width={o.w * W + 2} height={o.h * H + 2} fill="none" stroke="#16a34a" strokeWidth={0.8} />
                <text x={x} y={y - 2} fontSize={4} fill="#166534">{clases.objetos[o.clase].nombre}</text>
              </>
            )}
          </g>
        );
      })}
      {cajas.map((c) => (
        <g key={c.id}>
          <rect x={c.real.x * W} y={c.real.y * H} width={c.real.w * W} height={c.real.h * H} fill="none" stroke="#16a34a" strokeWidth={0.8} />
          <rect x={c.prediccion.x * W} y={c.prediccion.y * H} width={c.prediccion.w * W} height={c.prediccion.h * H}
            fill="none" stroke="#dc2626" strokeWidth={0.8} strokeDasharray="2 1.5" />
        </g>
      ))}
      {resaltado && (
        <rect x={resaltado.x * W - 1.5} y={resaltado.y * H - 1.5} width={resaltado.w * W + 3} height={resaltado.h * H + 3}
          fill="none" stroke="#dc2626" strokeWidth={1.5} rx={1.5} />
      )}
    </svg>
  );
}
