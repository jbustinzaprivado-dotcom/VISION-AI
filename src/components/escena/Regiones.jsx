import { Arrow, Group, Line, Rect, Shape, Text } from 'react-konva';
import clases from '../../simulation/clases.json';

// Dibujo de cada región con la apariencia de su tipo (vista cenital, como una cámara
// de seguridad en el techo). Todo son figuras vectoriales: no hay imágenes (DT-2).
// `t` es el tiempo de simulación: la cinta transportadora se mueve con él.

const ETIQUETA = { fontSize: 10, fontStyle: 'bold', fill: '#e2e8f0', letterSpacing: 0.5 };

export function RegionDibujo({ region: r, px, py, t }) {
  const x = px(r.x);
  const y = py(r.y);
  const w = px(r.w);
  const h = py(r.h);
  const cerrada = r.atributos?.abierta === false;
  const color = clases.regiones[r.clase].color;
  const nombre = cerrada ? `${r.nombre} (cerrada)` : r.nombre;

  return (
    <Group x={x} y={y}>
      <Contenido clase={r.clase} w={w} h={h} color={color} t={t} cerrada={cerrada} velocidad={r.atributos?.velocidad ?? 0.1} />
      <Rect width={w} height={h} stroke={color} strokeWidth={1} opacity={cerrada ? 0.35 : 0.7} dash={cerrada ? [6, 4] : undefined} />
      {/* El nombre va abajo a la izquierda: arriba quedan las etiquetas de detección y de las capas.
          Las salidas de emergencia ya llevan su rótulo "SALIDA" (y son angostas): no repiten el nombre. */}
      {r.clase !== 'salida-emergencia' && (
        <>
          <Rect x={3} y={h - 17} width={nombre.length * 6.1 + 8} height={14} fill="rgba(2,6,23,0.55)" cornerRadius={3} />
          <Text text={nombre.toUpperCase()} x={7} y={h - 15} {...ETIQUETA} />
        </>
      )}
    </Group>
  );
}

function Contenido({ clase, w, h, color, t, cerrada, velocidad }) {
  switch (clase) {
    case 'pasillo': {
      // Pasillo: piso más claro y línea de carril discontinua en el eje largo.
      const horizontal = w >= h;
      return (
        <>
          <Rect width={w} height={h} fill={color} opacity={0.16} />
          <Line
            points={horizontal ? [8, h / 2, w - 8, h / 2] : [w / 2, 8, w / 2, h - 8]}
            stroke="#fde68a"
            strokeWidth={2}
            dash={[14, 10]}
            opacity={0.55}
          />
        </>
      );
    }
    case 'estanteria': {
      // Estantería: módulos con sus divisiones y cajas almacenadas.
      const modulos = Math.max(3, Math.round(w / 42));
      return (
        <>
          <Rect width={w} height={h} fill="#3b3631" />
          {Array.from({ length: modulos }, (_, i) => {
            const mx = (w / modulos) * i;
            const mw = w / modulos;
            return (
              <Group key={i} x={mx}>
                <Rect x={2} y={h * 0.18} width={mw - 4} height={h * 0.64} fill="#57504a" stroke="#78716c" strokeWidth={1} />
                <Rect x={mw * 0.15} y={h * 0.26} width={mw * 0.3} height={h * 0.48} fill={i % 3 === 0 ? '#b45309' : '#92400e'} opacity={0.85} />
                <Rect x={mw * 0.55} y={h * 0.26} width={mw * 0.3} height={h * 0.48} fill={i % 2 === 0 ? '#a16207' : '#b45309'} opacity={0.75} />
              </Group>
            );
          })}
        </>
      );
    }
    case 'transito':
      // Zona de tránsito: borde de seguridad amarillo y negro.
      return (
        <>
          <Rect width={w} height={h} fill={color} opacity={0.1} />
          <Rect width={w} height={h} stroke="#111827" strokeWidth={5} />
          <Rect width={w} height={h} stroke="#facc15" strokeWidth={5} dash={[12, 12]} />
        </>
      );
    case 'restringida':
      // Zona restringida: rayado diagonal rojo.
      return (
        <Group clipX={0} clipY={0} clipWidth={w} clipHeight={h}>
          <Rect width={w} height={h} fill="#7f1d1d" opacity={0.35} />
          <Shape
            sceneFunc={(ctx, forma) => {
              ctx.beginPath();
              for (let d = -h; d < w; d += 14) {
                ctx.moveTo(d, h);
                ctx.lineTo(d + h, 0);
              }
              ctx.fillStrokeShape(forma);
            }}
            stroke="#f87171"
            strokeWidth={3}
            opacity={0.35}
          />
        </Group>
      );
    case 'entrada':
      return (
        <>
          <Rect width={w} height={h} fill={color} opacity={0.25} />
          <Arrow points={[w * 0.2, h / 2, w * 0.85, h / 2]} pointerLength={6} pointerWidth={8} fill="#4ade80" stroke="#4ade80" strokeWidth={2} />
        </>
      );
    case 'caja':
      // Zona de caja: piso y mostrador con su registradora.
      return (
        <>
          <Rect width={w} height={h} fill={color} opacity={cerrada ? 0.06 : 0.16} />
          <Rect x={w * 0.82} y={h * 0.12} width={w * 0.14} height={h * 0.76} fill="#4c1d95" opacity={cerrada ? 0.35 : 0.85} cornerRadius={3} />
          <Rect x={w * 0.85} y={h * 0.42} width={w * 0.08} height={h * 0.14} fill={cerrada ? '#475569' : '#a78bfa'} cornerRadius={2} />
        </>
      );
    case 'area-trabajo':
      return (
        <>
          <Rect width={w} height={h} fill={color} opacity={0.12} />
          <Rect x={4} y={4} width={w - 8} height={h - 8} stroke="#7dd3fc" strokeWidth={1} dash={[3, 5]} opacity={0.6} />
        </>
      );
    case 'via':
      return (
        <>
          <Rect width={w} height={h} fill="#334155" opacity={0.55} />
          <Line points={[10, h / 2, w - 10, h / 2]} stroke="#e2e8f0" strokeWidth={2} dash={[18, 12]} opacity={0.6} />
        </>
      );
    case 'salida-emergencia':
      return (
        <>
          <Rect width={w} height={h} fill="#166534" opacity={0.75} />
          <Text text="SALIDA" width={w} y={h / 2 - 12} align="center" fontSize={11} fontStyle="bold" fill="#ffffff" />
          <Arrow points={[w * 0.25, h / 2 + 8, w * 0.75, h / 2 + 8]} pointerLength={5} pointerWidth={6} fill="#ffffff" stroke="#ffffff" strokeWidth={2} />
        </>
      );
    case 'cinta': {
      // Cinta transportadora: rodillos que se desplazan con el tiempo de simulación.
      const paso = 14;
      // Los productos avanzan `velocidad` (fracción de la escena) por segundo y la cinta ocupa
      // todo el ancho: los rodillos se desplazan velocidad × w píxeles por segundo.
      const avance = (t * velocidad * w) % paso;
      return (
        <Group clipX={0} clipY={0} clipWidth={w} clipHeight={h}>
          <Rect width={w} height={h} fill="#1f2937" />
          <Shape
            sceneFunc={(ctx, forma) => {
              ctx.beginPath();
              for (let lx = -paso + avance; lx < w; lx += paso) {
                ctx.moveTo(lx, 4);
                ctx.lineTo(lx, h - 4);
              }
              ctx.fillStrokeShape(forma);
            }}
            stroke="#475569"
            strokeWidth={2}
          />
          <Rect width={w} height={4} fill="#64748b" />
          <Rect y={h - 4} width={w} height={4} fill="#64748b" />
        </Group>
      );
    }
    case 'inspeccion': {
      // Punto de inspección: arco con una línea de escaneo que sube y baja.
      const fase = (Math.sin(t * 3) + 1) / 2;
      return (
        <>
          <Rect width={w} height={h} fill={color} opacity={0.18} />
          <Rect width={w} height={h} stroke="#fb923c" strokeWidth={2} />
          <Line points={[0, h * fase, w, h * fase]} stroke="#fdba74" strokeWidth={2} opacity={0.9} shadowColor="#fb923c" shadowBlur={8} />
        </>
      );
    }
    default:
      return <Rect width={w} height={h} fill={color} opacity={0.2} />;
  }
}

